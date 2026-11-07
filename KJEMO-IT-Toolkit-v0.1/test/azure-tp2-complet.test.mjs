/**
 * azure-tp2-complet.test.mjs — le modèle « TP2 » du labo Azure couvre l'énoncé de bout en bout (Ex1 à Ex4) :
 * schéma complet, vérification sans avertissement, commandes, tests, document et PDF.
 */
import { modeleSchema } from '../dist/modeles-schema.mjs';
import * as C from '../dist/config-azure.mjs';
import * as SC from '../dist/schema.mjs';
import * as SR from '../dist/schema-remplir.mjs';
import * as J from '../dist/journal.mjs';
import * as JP from '../dist/journal-pdf.mjs';
import { planPortail } from '../dist/plan-portail.mjs';

let ok = 0; let ko = 0;
const assert = (c, m, d = '') => { if (c) ok += 1; else { ko += 1; console.log(`  [FAIL]  ${m}${d ? ` — ${d}` : ''}`); } };

const m = modeleSchema('azure-tp2-tardi');
const s = SC.normaliserSchema(m.construire()).schema;
const ctx = C.contexteAzure(s);
const v = (n) => ctx.vnets.find((x) => x.nom === n);
const sous = (vn, n) => ctx.sousReseaux.find((x) => x.vnet?.nom === vn && x.nom === n);

assert(C.verifierAzure(s).length === 0, 'modèle prêt : aucun avertissement', C.verifierAzure(s).join(' | '));
assert(['CoreSubnet', 'GatewaySubnet', 'AppServiceOutboundSubnet', 'VMSubnet', 'AppServiceInboundSubnet'].every((n) => sous('VNET1', n)) && ctx.sousReseaux.filter((x) => x.vnet?.nom === 'VNET1').length === 5, 'VNET1 : les cinq sous-réseaux de l’énoncé');
assert(['DataSubnet', 'GatewaySubnet', 'VMSubnet', 'StorageSubnet'].every((n) => sous('VNET2', n)) && ctx.sousReseaux.filter((x) => x.vnet?.nom === 'VNET2').length === 4, 'VNET2 : les quatre sous-réseaux de l’énoncé');
assert(v('VNET1').c.appairages.includes(v('VNET2').id) && v('VNET2').c.appairages.includes(v('VNET1').id), 'appairage VNET1 ↔ VNET2 posé');

const script = C.texteAzure(C.scriptAzure(s));
const a = (t, d) => assert(script.includes(t), d);
// Ex1
a('az storage queue create --account-name sttardi -n queue1', 'Ex1 : file queue1');
a('az storage container-rm create -g rg-tardi --storage-account sttardi -n blob1', 'Ex1 : conteneur blob1');
a('az storage blob upload --account-name sttardi -c blob1', 'Ex1 : fichier déposé dans blob1');
a('--sku B1 --is-linux', 'Ex1 : plan B1 Linux'); a('--container-image-name index.docker.io/romaric/tpasr:latest', 'Ex1 : image Docker Hub'); a('WEBSITES_PORT=8080', 'Ex1 : port 8080');
a('StorageConnectionString="$CHAINE"', 'Ex1 : chaîne StorageConnectionString'); assert(J.secretDans(script) === null && !/AccountKey=/.test(script), 'Ex1 : aucune clé écrite');
// Ex2
a('--public-network-access Disabled', 'Ex2 : stockage fermé à Internet'); a('--group-id blob', 'Ex2 : point privé blob'); a('--group-id queue', 'Ex2 : point privé queue');
assert(/private-endpoint create -g rg-tardi -n pe-sttardi-blob -l canadacentral --vnet-name VNET2 --subnet StorageSubnet/.test(script), 'Ex2 : points privés dans StorageSubnet de VNET2');
// Ex3
a('az network vnet peering create -g rg-tardi -n VNET1-vers-VNET2', 'Ex3 : appairage'); a('az webapp vnet-integration add -g rg-tardi -n WebAPP1 --vnet VNET1 --subnet AppServiceOutboundSubnet', 'Ex3 : intégration VNet');
a('--group-id sites', 'Ex3 : point privé de l’application'); assert(/private-endpoint create -g rg-tardi -n pe-webapp1 [^\n]*--vnet-name VNET1 --subnet AppServiceInboundSubnet/.test(script), 'Ex3 : point privé de l’application dans AppServiceInboundSubnet');
a('publicNetworkAccess=Disabled', 'Ex3 : application isolée d’Internet');
for (const z of ['privatelink.blob.core.windows.net', 'privatelink.queue.core.windows.net', 'privatelink.azurewebsites.net']) a(`private-dns zone create -g rg-tardi -n ${z}`, `Ex3 : zone ${z}`);
assert(/-z privatelink\.blob\.core\.windows\.net -n lien-VNET1/.test(script) && /-z privatelink\.blob\.core\.windows\.net -n lien-VNET2/.test(script), 'Ex3 : zone blob liée à VNET1 et VNET2');
// Ex4
a('--route-table-name rt-vmsubnet -n vers-passerelle --address-prefix 0.0.0.0/0 --next-hop-type VirtualNetworkGateway', 'Ex4 : VMSubnet → passerelle');
a('--address-prefix 12.12.12.0/30 --next-hop-type None', 'Ex4 : 12.12.12.0/30 supprimé');
for (const p of ['0.0.0.0/0', 'AppService.CanadaCentral', 'AppService.CanadaEast', 'EventHub.CanadaCentral', 'EventHub.CanadaEast']) a(`--route-table-name rt-datasubnet`, 'Ex4 : table de DataSubnet') || 0;
for (const p of ['0.0.0.0/0', 'AppService.CanadaCentral', 'AppService.CanadaEast', 'EventHub.CanadaCentral', 'EventHub.CanadaEast']) assert(script.includes(`--route-table-name rt-datasubnet`) && new RegExp(`rt-datasubnet -n \\S+ --address-prefix ${p.replace('.', '\\.')} --next-hop-type VirtualAppliance --next-hop-ip-address 10\\.3\\.2\\.100`).test(script), `Ex4 : DataSubnet ${p} → 10.3.2.100`);
a('--vnet-name VNET1 -n VMSubnet --route-table rt-vmsubnet', 'Ex4 : table associée à VMSubnet'); a('--vnet-name VNET2 -n DataSubnet --route-table rt-datasubnet', 'Ex4 : table associée à DataSubnet');
assert(!/az vm create[^\n]*nva/.test(script) && script.includes('Rien à créer : l’appliance n’existe pas'), 'Ex4 : appliance fictive, aucune VM créée');
a('--vnet-name VNET2 -n VMSubnet --route-table rt-vmsubnet', 'Ex4 : la table de VMSubnet va aux deux VMSubnet (VNET2)');

// Documentation
const lab = { ...J.entreeVide({ categorieId: 'azure', date: new Date('2026-11-07T10:00:00'), existantes: [] }), titre: m.titre, objet: m.objet, environnement: m.environnement, architecture: m.architecture, retourArriere: m.retourArriere, referencesTexte: m.captures, schema: s };
const { entree: e } = SR.remplirDepuisSchema(lab, { inventaire: [], date: new Date('2026-11-07T10:00:00') });
assert(e.adressage.length >= 9 && e.configuration.length >= 8 && e.validation.length >= 8, 'document : plan, blocs de commandes et tests repris du schéma', `${e.adressage.length}/${e.configuration.length}/${e.validation.length}`);
assert(/12 novembre 2026/.test(e.environnement) && /F1/.test(e.retourArriere) && /Ex4/.test(e.referencesTexte), 'document : remise, retour au plan F1 et liste de captures par exercice');
assert(J.MAX_CAPTURES >= 20, 'journal : assez de captures pour les quatre exercices', String(J.MAX_CAPTURES));
assert(!Object.keys(J.normaliserEntree(e).erreurs).length, 'labo valide (aucun secret, champs conformes)', JSON.stringify(J.normaliserEntree(e).erreurs));
const pdf = JP.pdfJournal(J.normaliserEntree(e).entree ?? e, { date: new Date('2026-11-07T10:00:00Z') });
assert(pdf.octets?.length > 2000 && pdf.pages >= 2, 'PDF du labo généré');

// Plan d'exécution dans le portail (préparer dans le labo, appliquer ensuite)
const plan = planPortail(s);
const txt = plan.blocs.map((b) => `${b.titre}\n${b.lignes.join('\n')}`).join('\n\n');
const t = (re, m) => assert(re.test(txt), m);
t(/Réseau virtuel VNET1[\s\S]*CoreSubnet : 10\.1\.0\.0\/24/, 'plan portail : VNET1 et ses sous-réseaux avec leurs plages');
t(/Appairage VNET1 ↔ VNET2/, 'plan portail : appairage');
t(/Autres registres de conteneurs ; image et étiquette = romaric\/tpasr:latest ; URL du serveur de registre = https:\/\/index\.docker\.io ; port = 8080/, 'plan portail : conteneur, image, registre, port');
t(/nom = StorageConnectionString ; type = Custom/, 'plan portail : variable de chaîne de connexion (valeur jamais écrite)');
t(/AppService\.CanadaEast, ; prochain saut|Étiquette de service, AppService\.CanadaEast ; prochain saut = Appliance virtuelle \(IP\), adresse 10\.3\.2\.100/, 'plan portail : route par étiquette de service');
t(/Sous-réseaux > Associer : VNET1 \/ VMSubnet ; VNET2 \/ VMSubnet/, 'plan portail : table des VMSubnet associée aux deux');
t(/Appliance fictive nva-fictive[\s\S]*Rien à créer dans le portail/, 'plan portail : appliance fictive, rien à créer');
t(/PIÈGE FRÉQUENT[\s\S]*Liens de réseau virtuel : il doit y avoir UN lien par réseau de la liste \(VNET2, VNET1\)/, 'plan portail : piège des liens DNS vers chaque réseau');
t(/pas conteneur-blob1/, 'plan portail : piège du nom de conteneur');
assert(plan.captures.length >= 10 && J.secretDans(txt) === null && !/AccountKey|DefaultEndpointsProtocol/.test(txt), 'plan portail : au moins 10 captures listées, aucun secret');
const pos = (x) => txt.indexOf(x);
assert(pos('Réseau virtuel VNET1') < pos('Compte de stockage sttardi') && pos('Compte de stockage sttardi') < pos('App Service WebAPP1') && pos('App Service WebAPP1') < pos('Point de terminaison privé pe-sttardi-blob'), 'plan portail : réseaux, stockage, application, puis points privés (ordre de déploiement)');
assert(e.configuration.some((b) => b.titre === 'Portail : Compte de stockage sttardi') && e.configuration.some((b) => b.titre === 'Portail : liste des captures à garder'), 'document : le plan du portail et la liste des captures sont repris dans la configuration');
assert(!Object.keys(J.normaliserEntree(e).erreurs).length, 'document avec le plan du portail : valide');
// Trait équipement ↔ sous-réseau (dessiné d'après la configuration, sans seconde donnée).
{
  const web = s.noeuds.find((n) => n.type === 'app-service');
  const ls = SC.liensSousReseau(s);
  const lw = ls.find((l) => l.noeud.id === web.id);
  assert(lw && lw.etiquette === 'Intégration VNet' && lw.zone.nom === 'AppServiceOutboundSubnet', 'App Service lié à son sous-réseau d’intégration');
  const sn = s.zones.find((z) => z.genre === 'sous-reseau' && z.nom !== 'AppServiceOutboundSubnet');
  const s2 = JSON.parse(JSON.stringify(s)); const w2 = s2.noeuds.find((n) => n.id === web.id);
  w2.x = 20; w2.y = 20; w2.config.integration = sn.id;
  const traits = (sch) => SC.dessinerSchema(sch).filter((o) => o.k === 'ligne' && o.trait === '#0a8fa6' && o.tirets?.[0] === 6);
  assert(traits(s2).length >= 1 && SC.dessinerSchema(s2).some((o) => o.k === 'etiquette' && o.t === 'Intégration VNet'), 'trait en tirets + étiquette vers le sous-réseau choisi');
  w2.config.integration = '';
  assert(SC.liensSousReseau(s2).every((l) => l.noeud.id !== web.id), 'intégration vidée : plus de trait');
  w2.config.integration = 'inexistant';
  assert(SC.liensSousReseau(s2).every((l) => l.noeud.id !== web.id), 'sous-réseau inexistant : ignoré');
  assert(/Liens vers des sous-réseaux : .*Intégration VNet/.test(SC.decrireSchema(s)), 'description du schéma : liens vers les sous-réseaux');
}

// Liens multiples (table de routage, NSG, NAT) : un trait par sous-réseau associé.
{
  const rts = s.noeuds.filter((n) => n.type === 'table-routage');
  const rtv = rts.find((n) => (n.config.sousReseaux ?? []).length === 2);
  const lr = SC.liensSousReseau(s).filter((l) => rtv && l.noeud.id === rtv.id);
  assert(rtv && lr.length === 2 && lr.every((l) => l.zone.nom === 'VMSubnet' && l.etiquette === 'Table de routage'), 'rt-vmsubnet : un trait vers chacun des deux VMSubnet');
  const s3 = JSON.parse(JSON.stringify(s)); const r3 = s3.noeuds.find((n) => n.id === rtv.id);
  r3.config.sousReseaux = [];
  assert(SC.liensSousReseau(s3).every((l) => l.noeud.id !== rtv.id), 'table de routage sans association : plus de trait');
  assert(['nsg', 'passerelle-nat'].every((t) => SC.LIENS_SOUS_RESEAU[t]?.multi), 'NSG et passerelle NAT : associations multiples');
}

console.log(`azure-tp2-complet : ${ok} vérification(s) réussie(s), ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
