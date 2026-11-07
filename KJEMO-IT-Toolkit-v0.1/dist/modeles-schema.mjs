/**
 * modeles-schema.mjs — JOURNAL-LABO-10 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Modèles de schéma pour partir de la situation d'un TP plutôt que d'une
 * feuille blanche. Ils posent la STRUCTURE donnée par l'énoncé (zones,
 * ressources, besoins en adresses) ; les choix demandés à l'étudiant (plages
 * CIDR, appairages, zones DNS, routes, règles) restent à faire, avec les
 * outils de l'éditeur (« Découper selon les besoins », Proposer…).
 *   - Infonuagique I · TP1 (ÉNERGIA) : deux filiales indépendantes, Canada et
 *     France, besoins en adresses par type d'actif ;
 *   - Infonuagique I · TP2 (banque Tardi) : App Service, compte de stockage
 *     privé, VNET1 et VNET2 et leurs sous-réseaux, comme le schéma de l'énoncé.
 * Module PUR.
 */
import { schemaVide } from './schema.mjs';

let compteur = 0;
const id = (p) => `${p}m${(compteur++).toString(36).padStart(4, '0')}${Math.random().toString(36).slice(2, 8)}`;
const zone = (genre, nom, x, y, l, h, config = {}) => ({ id: id('z'), nom, genre, couleur: 'bleu', x, y, l, h, config });
const noeud = (type, nom, x, y, config = null, note = '') => ({ id: id('n'), type, nom, note, modele: null, ports: '', equipementId: null, typePerso: null, x, y, config });
const lien = (de, a, style, etiquette = '') => ({ id: id('l'), de: de.id, a: a.id, style, etiquette, etiquetteDe: '', etiquetteA: '', adresseDe: '', adresseA: '' });

/** TP1 : quatre réseaux (filiale × région), quatre sous-réseaux chacun avec le besoin de l'énoncé. */
function tp1() {
  const s = schemaVide(); s.azure = { groupe: 'rg-energia', region: 'canadacentral' };
  const sites = [
    ['Solaria-Canada', 'canadacentral', 'rg-solaria', [40, 8, 120, 1], 10, 40],
    ['Solaria-France', 'francecentral', 'rg-solaria', [25, 5, 60, 1], 510, 40],
    ['Hydrix-Canada', 'canadacentral', 'rg-hydrix', [15, 10, 80, 1], 10, 320],
    ['Hydrix-France', 'francecentral', 'rg-hydrix', [10, 4, 40, 1], 510, 320],
  ];
  for (const [nom, region, groupe, besoins, x, y] of sites) {
    s.zones.push(zone('vnet', `vnet-${nom.toLowerCase()}`, x, y, 480, 270, { espace: '', region, groupe }));
    const noms = ['snet-apps', 'snet-db', 'snet-vm', 'GatewaySubnet'];
    noms.forEach((n, i) => s.zones.push(zone('sous-reseau', n, x + 15 + (i % 2) * 230, y + 40 + Math.floor(i / 2) * 110, 220, 100, { plage: '', besoin: String(besoins[i]) })));
  }
  s.textes.push({ id: id('t'), texte: 'Remplace x : espace de chaque VNet, puis « Découper selon les besoins ». Zones DNS : à ajouter.', x: 14, y: 22 });
  return s;
}

/** TP2 : l'architecture de l'énoncé (banque Tardi). */
function tp2() {
  const s = schemaVide(); s.azure = { groupe: 'rg-tardi', region: 'canadacentral' };
  const internet = noeud('internet', 'Internet', 90, 50);
  const app = noeud('app-service', 'WebAPP1', 430, 50, { niveau: 'intermediaire', plan: 'asp-tardi', sku: 'B1', pile: 'conteneur', image: 'romaric/tpasr:latest', registre: 'https://index.docker.io', port: '8080',
    chaines: [{ nom: 'StorageConnectionString', source: '', genre: 'Custom' }] });
  s.zones.push(zone('vnet', 'VNET1', 30, 105, 790, 205, { espace: '' }));
  ['CoreSubnet', 'GatewaySubnet', 'AppServiceOutboundSubnet', 'VMSubnet', 'AppServiceInboundSubnet'].forEach((n, i) => s.zones.push(zone('sous-reseau', n, 42 + i * 155, 135, 150, 160,
    n === 'AppServiceOutboundSubnet' ? { plage: '', delegation: 'Microsoft.Web/serverFarms' } : { plage: '' })));
  s.zones.push(zone('vnet', 'VNET2', 30, 325, 790, 265, { espace: '' }));
  [['DataSubnet', 42, 180], ['GatewaySubnet', 232, 180], ['VMSubnet', 422, 180], ['StorageSubnet', 612, 200]].forEach(([n, x, l]) => s.zones.push(zone('sous-reseau', n, x, 355, l, 225, { plage: '' })));
  const st = noeud('stockage', 'sttardi', 905, 470, { niveau: 'intermediaire', sku: 'Standard_LRS', conteneurs: 'blob1', files: 'queue1', acces: 'desactive' });
  app.config.chaines[0].source = st.id;
  const peBlob = noeud('point-terminaison-prive', 'pe-sttardi-blob', 670, 450, { sousRessource: 'blob', dns: true });
  const peQueue = noeud('point-terminaison-prive', 'pe-sttardi-queue', 760, 530, { sousRessource: 'queue', dns: true });
  s.noeuds.push(internet, app, peBlob, peQueue, st);
  s.liens.push(lien(internet, app, 'trafic', 'Trafic entrant'), lien(app, peBlob, 'trafic', 'Trafic sortant'), lien(peBlob, st, 'liaison-privee'), lien(peQueue, st, 'liaison-privee'));
  s.textes.push({ id: id('t'), texte: 'Un point de terminaison privé par sous-ressource utilisée (blob, queue).', x: 560, y: 595 });
  return s;
}

/** Démonstration de l'enseignant (VNETDemo) : application web, sortie par un sous-réseau intégré, point privé vers le stockage. */
function demo() {
  const s = schemaVide(); s.azure = { groupe: 'rg-demo', region: 'canadacentral' };
  const internet = noeud('internet', 'Internet', 60, 40);
  const app = noeud('app-service', 'WebApp', 400, 40, { niveau: 'intermediaire', plan: 'asp-demo', sku: 'B1', pile: 'conteneur', image: '', chaines: [] });
  s.zones.push(zone('vnet', 'VNETDemo', 170, 150, 520, 330, { espace: '' }));
  s.zones.push(zone('sous-reseau', 'AppServiceOutboundSubnet', 260, 190, 340, 80, { plage: '', delegation: 'Microsoft.Web/serverFarms' }));
  s.zones.push(zone('sous-reseau', 'StorageSubnet', 260, 300, 340, 160, { plage: '' }));
  const pe = noeud('point-terminaison-prive', 'pe-stdemo-blob', 400, 360, { sousRessource: 'blob', dns: true });
  const st = noeud('stockage', 'stdemo01', 400, 520, { niveau: 'intermediaire', sku: 'Standard_LRS', conteneurs: 'blob1', files: '', acces: 'desactive' });
  s.noeuds.push(internet, app, pe, st);
  s.liens.push(lien(internet, app, 'trafic', 'Trafic entrant'), lien(app, pe, 'trafic', 'Trafic sortant'), lien(pe, st, 'liaison-privee'));
  s.textes.push({ id: id('t'), texte: 'Un seul VNet, deux sous-réseaux : sortie de l’application (délégué) et point privé. Plages à remplir.', x: 14, y: 14 });
  return s;
}

/** Hub et spoke : un réseau central (passerelle VPN, appliance) et deux réseaux périphériques appairés au centre seulement. */
function hubSpoke() {
  const s = schemaVide(); s.azure = { groupe: 'rg-hub-spoke', region: 'canadacentral' };
  const hub = zone('vnet', 'vnet-hub', 250, 20, 500, 240, { espace: '' });
  const sp1 = zone('vnet', 'vnet-spoke1', 20, 310, 400, 220, { espace: '' });
  const sp2 = zone('vnet', 'vnet-spoke2', 580, 310, 400, 220, { espace: '' });
  hub.config = { espace: '', appairages: [sp1.id, sp2.id], accesVnet: true, transfert: true, transitPasserelle: true };
  for (const sp of [sp1, sp2]) sp.config = { espace: '', appairages: [hub.id], accesVnet: true, transfert: true, passerelleDistante: true };
  const sn = (nom, x, y, l, h) => zone('sous-reseau', nom, x, y, l, h, { plage: '' });
  s.zones.push(hub, sp1, sp2,
    sn('GatewaySubnet', 265, 55, 220, 190), sn('snet-nva', 515, 55, 220, 190),
    sn('snet-charge1', 35, 345, 370, 170), sn('snet-charge2', 595, 345, 370, 170));
  const gw = noeud('passerelle-vpn', 'vpngw-hub', 340, 130, { niveau: 'intermediaire', vnet: hub.id, sku: 'VpnGw1' });
  const nva = noeud('appliance', 'nva-hub', 590, 130, null);
  const vm1 = noeud('vm', 'vm-spoke1', 150, 420, null);
  const vm2 = noeud('vm', 'vm-spoke2', 710, 420, null);
  const rt = noeud('table-routage', 'rt-spokes', 480, 285, { niveau: 'intermediaire', sousReseaux: [sp1, sp2].map((z) => z.id), routes: [] });
  s.noeuds.push(gw, nva, vm1, vm2, rt);
  s.liens.push(lien(vm1, nva, 'trafic', 'via l’appliance'), lien(nva, vm2, 'trafic'));
  s.textes.push({ id: id('t'), texte: 'Appairage non transitif : spoke1 et spoke2 ne se joignent que par l’appliance (transfert de trafic + route UDR vers son IP). Espaces et plages : à remplir.', x: 20, y: 545 });
  return s;
}

export const MODELES_SCHEMA = [
  { id: 'azure-hub-spoke', label: 'Azure · Hub et spoke : passerelle partagée et appliance au centre', categorie: 'azure', construire: hubSpoke,
    titre: 'Réseau en étoile (hub et spoke) avec passerelle partagée',
    objet: 'Relier deux réseaux périphériques (spoke) à un réseau central (hub) par appairage : les spokes utilisent la passerelle VPN du hub, et leur trafic mutuel passe par une appliance du hub, car l’appairage n’est pas transitif.' },
  { id: 'azure-demo-webapp-stockage', label: 'Démo : application web et stockage par point privé (VNETDemo)', categorie: 'azure', construire: demo,
    titre: 'Démo : application web qui joint un stockage par point privé',
    objet: 'Trafic entrant public vers l’application ; trafic sortant par le sous-réseau d’intégration de VNETDemo ; point de terminaison privé dans StorageSubnet ; compte de stockage sans accès public.' },
  { id: 'azure-tp2-tardi', label: 'Infonuagique I · TP2 : App Service et stockage privé (banque Tardi)', categorie: 'azure', construire: tp2,
    titre: 'TP2 : accès privé à App Service et au stockage (banque Tardi)',
    objet: 'Déployer WebAPP1 (conteneur) qui utilise une file d’attente et un conteneur blob, rendre le compte de stockage privé (points de terminaison privés dans VNET2), isoler l’application dans VNET1 et mettre en place le routage demandé.' },
  { id: 'azure-tp1-energia', label: 'Infonuagique I · TP1 : VNet et zones DNS (ÉNERGIA, besoins par région)', categorie: 'azure', construire: tp1,
    titre: 'TP1 : planification des VNet et zones DNS (groupe ÉNERGIA)',
    objet: 'Planifier l’adressage des filiales Solaria et Hydrix (Canada, France), créer les réseaux virtuels et sous-réseaux, puis les zones DNS privées et leurs enregistrements.' },
];
export const modelesPour = (categorie) => MODELES_SCHEMA.filter((m) => m.categorie === categorie);
export const modeleSchema = (id) => MODELES_SCHEMA.find((m) => m.id === id) ?? null;
