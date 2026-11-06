/**
 * inventaire.mjs — JOURNAL-LABO-03 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Inventaire des équipements du Journal de labo. Un équipement existe UNE
 * fois ; les labos y font référence (avec le rôle qu'il joue dans le projet).
 * La fiche d'un équipement s'adapte à son système :
 *   - socle commun : nom, type, modèle, version, adresse, rôle, accès, site ;
 *   - interfaces et table de routage (avec une colonne « Pourquoi ») pour tous ;
 *   - VLAN pour un équipement Cisco ;
 *   - services pour un serveur ou un poste (Système) ;
 *   - règles de filtrage pour Azure (groupe de sécurité) et pour un pare-feu.
 * Mêmes règles que le journal : AUCUN secret (la garde est partagée), rien ne
 * quitte le navigateur. Module PUR.
 */
import { secretDans, jour, nouvelId } from './journal.mjs';
import { TYPES_AZURE } from './azure-types.mjs';

export const CLE_INVENTAIRE = 'kjemo.inventaire.v1';
export const MAX_EQUIPEMENTS = 300;

export const SYSTEMES = [
  { id: 'cisco', label: 'Cisco' },
  { id: 'systeme', label: 'Système' },
  { id: 'azure', label: 'Azure' },
  { id: 'autre', label: 'Autre' },
];
export const TYPES_EQUIPEMENT = [
  { id: 'routeur', label: 'Routeur', systemes: ['cisco', 'autre'] },
  { id: 'commutateur', label: 'Commutateur', systemes: ['cisco', 'autre'] },
  { id: 'pare-feu', label: 'Pare-feu', systemes: ['cisco', 'systeme', 'autre'] },
  { id: 'point-acces', label: 'Point d’accès', systemes: ['cisco', 'autre'] },
  { id: 'serveur', label: 'Serveur', systemes: ['systeme', 'autre'] },
  { id: 'poste', label: 'Poste client', systemes: ['systeme', 'autre'] },
  { id: 'vm', label: 'Machine virtuelle', systemes: ['azure', 'systeme'] },
  { id: 'reseau-virtuel', label: 'Réseau virtuel', systemes: ['azure'] },
  { id: 'service-cloud', label: 'Service cloud', systemes: ['azure', 'autre'] },
  { id: 'commutateur-l3', label: 'Commutateur de cœur (niveau 3)', systemes: ['cisco', 'autre'] },
  { id: 'portable', label: 'Portable', systemes: ['systeme', 'autre'] },
  { id: 'telephone-ip', label: 'Téléphone IP', systemes: ['cisco', 'systeme', 'autre'] },
  { id: 'imprimante', label: 'Imprimante', systemes: ['systeme', 'autre'] },
  { id: 'smartphone', label: 'Smartphone', systemes: ['systeme', 'autre'] },
  { id: 'camera-ip', label: 'Caméra IP', systemes: ['systeme', 'autre'] },
  { id: 'nas', label: 'NAS', systemes: ['systeme', 'autre'] },
  { id: 'sous-reseau', label: 'Sous-réseau', systemes: ['azure'] },
  { id: 'passerelle-vpn', label: 'Passerelle VPN', systemes: ['azure'] },
  { id: 'nuage-operateur', label: 'Nuage de l’opérateur', systemes: ['autre'] },
  // Ressources Azure (JOURNAL-LABO-10)
  ...TYPES_AZURE.filter((t) => !['vm', 'service-cloud', 'passerelle-vpn'].includes(t.id)).map((t) => ({ id: t.id, label: t.label, systemes: ['azure'] })),
  { id: 'autre', label: 'Autre équipement', systemes: ['cisco', 'systeme', 'azure', 'autre'] },
];
export const systeme = (id) => SYSTEMES.find((s) => s.id === id) ?? SYSTEMES[3];
export const typeEquipement = (id) => TYPES_EQUIPEMENT.find((t) => t.id === id) ?? TYPES_EQUIPEMENT.at(-1);

/** Champs du socle commun. `exemples` : un exemple par système, affiché en indication. */
export const CHAMPS_EQUIPEMENT = [
  { id: 'nom', label: 'Nom', max: 80, exemples: { cisco: 'R1', systeme: 'SRV-LINUX01', azure: 'vm-web01', autre: 'NAS-BUREAU' } },
  { id: 'modele', label: 'Modèle', max: 120, exemples: { cisco: 'ISR 4321', systeme: 'VM VMware Workstation', azure: 'Standard_B2s', autre: 'Synology DS220+' } },
  { id: 'version', label: 'Système et version', max: 120, exemples: { cisco: 'IOS XE 16.9', systeme: 'Ubuntu Server 24.04 LTS', azure: 'Ubuntu 22.04 LTS', autre: 'DSM 7.2' } },
  { id: 'adresse', label: 'Adresse de gestion', max: 120, exemples: { cisco: '192.168.99.1', systeme: '192.168.30.10', azure: '10.10.1.4 (privée)', autre: '192.168.1.20' } },
  { id: 'role', label: 'Rôle', max: 300, exemples: { cisco: 'Routage inter-VLAN et sortie Internet', systeme: 'Serveur SSH et services internes', azure: 'Serveur web de test', autre: 'Partage de fichiers du bureau' } },
  { id: 'acces', label: 'Accès (sans mot de passe)', max: 300, exemples: { cisco: 'Console, puis ssh admin@192.168.99.1', systeme: 'ssh admin@192.168.30.10', azure: 'ssh azureuser@<IP publique> (clé dans le portail)', autre: 'https://192.168.1.20:5001' } },
  { id: 'emplacement', label: 'Emplacement', max: 200, exemples: { cisco: 'Baie du labo B-204', systeme: 'Hôte VMware du poste 12', azure: 'rg-lab-canadaeast · Canada Est', autre: 'Bureau, étagère réseau' } },
  { id: 'notes', label: 'Notes', max: 2000, long: true, exemples: { cisco: 'Licence de base. Sauvegarde de la config dans le dépôt Git du labo.', systeme: 'Mises à jour automatiques le dimanche.', azure: 'Arrêter la VM après le labo pour limiter le coût.', autre: 'Disques en RAID 1.' } },
];

/** Tableaux de la fiche. `pour(systeme, type)` dit s'ils s'affichent. */
export const TABLEAUX_EQUIPEMENT = {
  interfaces: {
    label: 'Interfaces', ajout: '+ Ajouter une interface', pour: () => true,
    colonnes: [{ id: 'nom', label: 'Interface' }, { id: 'adresse', label: 'Adresse / préfixe' }, { id: 'vlan', label: 'VLAN / sous-réseau' }, { id: 'etat', label: 'État' }, { id: 'description', label: 'Description' }],
    exemples: {
      cisco: { nom: 'Gi0/0.10', adresse: '192.168.10.1/24', vlan: '10', etat: 'up', description: 'Passerelle VENTES' },
      systeme: { nom: 'ens18', adresse: '192.168.30.10/24', vlan: '30', etat: 'up', description: 'Réseau des serveurs' },
      azure: { nom: 'nic-web01', adresse: '10.10.1.4', vlan: 'snet-web', etat: 'up', description: 'Carte réseau de la VM' },
      autre: { nom: 'LAN1', adresse: '192.168.1.20/24', vlan: '-', etat: 'up', description: 'Réseau du bureau' },
    },
  },
  routes: {
    label: 'Table de routage', ajout: '+ Ajouter une route', pour: () => true,
    colonnes: [{ id: 'type', label: 'Type' }, { id: 'destination', label: 'Destination' }, { id: 'via', label: 'Via (prochain saut)' }, { id: 'interface', label: 'Interface' }, { id: 'pourquoi', label: 'Pourquoi' }],
    exemples: {
      cisco: { type: 'S*', destination: '0.0.0.0/0', via: '203.0.113.1', interface: 'Gi0/1', pourquoi: 'Sortie Internet' },
      systeme: { type: 'défaut', destination: 'default', via: '192.168.30.1', interface: 'ens18', pourquoi: 'Passerelle du VLAN 30' },
      azure: { type: 'Système', destination: '0.0.0.0/0', via: 'Internet', interface: '', pourquoi: 'Sortie par défaut' },
      autre: { type: 'défaut', destination: '0.0.0.0/0', via: '192.168.1.1', interface: 'LAN1', pourquoi: 'Box Internet' },
    },
  },
  vlans: {
    label: 'VLAN', ajout: '+ Ajouter un VLAN', pour: (s, t) => s === 'cisco' && ['commutateur', 'commutateur-l3', 'routeur', 'point-acces', 'autre'].includes(t),
    colonnes: [{ id: 'numero', label: 'Numéro' }, { id: 'nom', label: 'Nom' }, { id: 'ports', label: 'Ports' }, { id: 'reseau', label: 'Réseau' }],
    exemples: { cisco: { numero: '10', nom: 'VENTES', ports: 'Fa0/1-12', reseau: '192.168.10.0/24' } },
  },
  services: {
    label: 'Services', ajout: '+ Ajouter un service', pour: (s, t) => s === 'systeme' || ['serveur', 'poste', 'vm', 'nas'].includes(t),
    colonnes: [{ id: 'nom', label: 'Service' }, { id: 'port', label: 'Port' }, { id: 'etat', label: 'État' }, { id: 'note', label: 'Note' }],
    exemples: { systeme: { nom: 'ssh', port: '22/tcp', etat: 'actif', note: 'Accès des administrateurs' }, azure: { nom: 'nginx', port: '443/tcp', etat: 'actif', note: 'Site de test' } },
  },
  dns: {
    label: 'Enregistrements DNS', ajout: '+ Ajouter un enregistrement', pour: (s, t) => t === 'zone-dns',
    colonnes: [{ id: 'nom', label: 'Nom' }, { id: 'type', label: 'Type' }, { id: 'valeur', label: 'Valeur' }],
    exemples: { azure: { nom: 'hrapp', type: 'A', valeur: '10.1.1.10' } },
  },
  regles: {
    label: 'Règles de filtrage', ajout: '+ Ajouter une règle', pour: (s, t) => s === 'azure' || t === 'pare-feu',
    colonnes: [{ id: 'priorite', label: 'Priorité' }, { id: 'nom', label: 'Nom' }, { id: 'port', label: 'Port' }, { id: 'source', label: 'Source' }, { id: 'action', label: 'Action' }],
    exemples: { azure: { priorite: '100', nom: 'allow-ssh-admin', port: '22', source: 'IP du cégep', action: 'Autoriser' }, systeme: { priorite: '1', nom: 'ssh', port: '22/tcp', source: '192.168.99.0/24', action: 'Autoriser' }, cisco: { priorite: '10', nom: 'permit-gestion', port: '22', source: '192.168.99.0/24', action: 'Autoriser' } },
  },
};
/** Exemple d'une ligne de tableau pour un système (ou le premier disponible). */
export function exempleLigne(nom, systemeId) {
  const ex = TABLEAUX_EQUIPEMENT[nom]?.exemples ?? {};
  return ex[systemeId] ?? ex.cisco ?? Object.values(ex)[0] ?? {};
}

const texte = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').slice(0, max);
const MAX_LIGNES = 80;

export function equipementVide({ systemeId = 'cisco', typeId = null, id = `e${nouvelId().slice(1)}`, date = new Date() } = {}) {
  const s = systeme(systemeId).id;
  const t = typeId && typeEquipement(typeId).systemes.includes(s) ? typeId : TYPES_EQUIPEMENT.find((x) => x.systemes.includes(s)).id;
  const e = { id, systeme: s, type: t, modifieLe: jour(date) };
  for (const c of CHAMPS_EQUIPEMENT) e[c.id] = '';
  for (const n of Object.keys(TABLEAUX_EQUIPEMENT)) e[n] = [];
  return e;
}

/** Valide un équipement. Renvoie { equipement, erreurs } (mêmes clés que le journal : « routes.2.via »). */
export function normaliserEquipement(brut = {}) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const erreurs = {};
  const e = equipementVide({ systemeId: b.systeme, typeId: b.type, id: /^e[\w]{3,40}$/.test(String(b.id ?? '')) ? b.id : undefined });
  e.modifieLe = /^\d{4}-\d{2}-\d{2}$/.test(String(b.modifieLe ?? '')) ? b.modifieLe : e.modifieLe;
  for (const c of CHAMPS_EQUIPEMENT) {
    e[c.id] = texte(b[c.id], c.max);
    if (c.id !== 'notes') e[c.id] = e[c.id].trim();
    const s = secretDans(e[c.id]); if (s) erreurs[c.id] = `Ce texte semble contenir ${s.quoi} (ligne ${s.ligne}). Remplace la valeur par *** : un mot de passe ne s’écrit jamais dans l’inventaire.`;
  }
  if (!e.nom) erreurs.nom = 'Donne un nom à l’équipement (ex. « R1 », « SRV-DC01 », « vm-web01 »).';
  for (const [nom, def] of Object.entries(TABLEAUX_EQUIPEMENT)) {
    const lignes = [];
    for (const l of (Array.isArray(b[nom]) ? b[nom] : []).slice(0, MAX_LIGNES)) {
      if (!l || typeof l !== 'object') continue;
      const propre = Object.fromEntries(def.colonnes.map((c) => [c.id, texte(l[c.id], 300).trim()]));
      if (def.colonnes.every((c) => !propre[c.id])) continue;
      const i = lignes.length;
      for (const c of def.colonnes) { const s = secretDans(propre[c.id]); if (s) erreurs[`${nom}.${i}.${c.id}`] = `Ce texte semble contenir ${s.quoi}. Remplace la valeur par ***.`; }
      lignes.push(propre);
    }
    e[nom] = lignes;
  }
  return { equipement: e, erreurs };
}

/** Les tableaux qui s'affichent pour cet équipement (les autres gardent leurs lignes, on les montre s'ils en ont). */
export function tableauxVisibles(e) {
  return Object.entries(TABLEAUX_EQUIPEMENT).filter(([n, d]) => d.pour(e.systeme, e.type) || (e[n]?.length ?? 0) > 0).map(([n]) => n);
}

/** Lit la valeur stockée ; écarte les équipements invalides (jamais réparés en silence). */
export function lireInventaire(brut) {
  const out = []; let ecartes = 0; const ids = new Set();
  for (const x of Array.isArray(brut?.equipements) ? brut.equipements : []) {
    const { equipement, erreurs } = normaliserEquipement(x);
    if (Object.keys(erreurs).length || ids.has(equipement.id)) { ecartes++; continue; }
    ids.add(equipement.id); out.push(equipement);
  }
  return { equipements: out.slice(0, MAX_EQUIPEMENTS), ecartes };
}

/** Labos qui utilisent un équipement. */
export function labosDe(equipementId, entrees) {
  return entrees.filter((e) => (e.equipements ?? []).some((l) => l.id === equipementId));
}

/** Filtre et trie l'inventaire (système, recherche sans accents sur nom, adresse, rôle, interfaces). */
export function filtrerInventaire(equipements, { systemeId = null, requete = '' } = {}) {
  const n = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = n(requete).trim().split(/\s+/).filter(Boolean);
  return equipements
    .filter((e) => !systemeId || e.systeme === systemeId)
    .filter((e) => {
      if (!q.length) return true;
      const foin = n([e.nom, e.adresse, e.role, e.modele, e.version, e.emplacement, typeEquipement(e.type).label,
        ...e.interfaces.flatMap((l) => [l.nom, l.adresse]), ...e.routes.map((r) => r.destination)].join(' '));
      return q.every((m) => foin.includes(m));
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
}

/**
 * Équipements proposés par une fiche (aujourd'hui : le TP VLAN, SSH et routage
 * inter-VLAN) à partir des valeurs saisies : le commutateur (SVI de gestion,
 * trunk, VLAN) et le routeur (sous-interfaces, routes connectées).
 * Renvoie [{ equipement, role }] ; l'appelant réutilise un équipement du même nom.
 */
export function equipementsDepuisFiche(valeurs = {}, date = new Date()) {
  const v = valeurs; const out = [];
  const plan = Array.isArray(v.plan) ? v.plan : [];
  const pf = v.gestionPrefixe ? `/${v.gestionPrefixe}` : '';
  const reseauGestion = (() => {
    const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(String(v.gestionPasserelle ?? '')); const p = Number(v.gestionPrefixe);
    if (!m || !(p >= 8 && p <= 30)) return '';
    const n = m.slice(1).map(Number).reduce((a, x) => a * 256 + x, 0); const masque = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
    const r = (n & masque) >>> 0; return `${[24, 16, 8, 0].map((s) => (r >>> s) & 255).join('.')}/${p}`;
  })();
  if (v.hoteSw) {
    const e = equipementVide({ systemeId: 'cisco', typeId: 'commutateur', date });
    Object.assign(e, { nom: v.hoteSw, adresse: v.gestionSwitch ?? '', role: 'Commutateur : VLAN, ports d’accès et trunk vers le routeur',
      acces: v.admin && v.gestionSwitch ? `ssh ${v.admin}@${v.gestionSwitch} (depuis le VLAN de gestion)` : '' });
    if (v.vlanGestion) e.interfaces.push({ nom: `Vlan${v.vlanGestion}`, adresse: `${v.gestionSwitch ?? ''}${pf}`, vlan: String(v.vlanGestion), etat: 'up', description: 'Adresse de gestion (SVI)' });
    if (v.trunkSw) e.interfaces.push({ nom: v.trunkSw, adresse: '', vlan: [v.vlanGestion, ...plan.map((l) => l.vlan)].filter(Boolean).join(','), etat: 'up', description: 'Trunk 802.1Q vers le routeur' });
    if (v.portGestion) e.interfaces.push({ nom: v.portGestion, adresse: '', vlan: String(v.vlanGestion ?? ''), etat: 'up', description: 'Poste de gestion' });
    if (v.gestionPasserelle) e.routes.push({ type: 'défaut', destination: '0.0.0.0/0', via: v.gestionPasserelle, interface: v.vlanGestion ? `Vlan${v.vlanGestion}` : '', pourquoi: 'ip default-gateway : répondre aux autres VLAN' });
    if (v.vlanGestion) e.vlans.push({ numero: String(v.vlanGestion), nom: 'GESTION', ports: v.portGestion ?? '', reseau: reseauGestion });
    for (const l of plan) e.vlans.push({ numero: String(l.vlan ?? ''), nom: l.nom ?? '', ports: l.ports ?? '', reseau: l.reseau ? `${l.reseau}/${l.prefixe ?? ''}` : '' });
    out.push({ equipement: e, role: 'Commutateur du TP' });
  }
  if (v.hoteRouteur) {
    const e = equipementVide({ systemeId: 'cisco', typeId: 'routeur', date });
    Object.assign(e, { nom: v.hoteRouteur, adresse: v.gestionPasserelle ?? '', role: 'Routeur sur un bâton : une sous-interface par VLAN' });
    const itf = v.routeurItf ?? '';
    if (itf) e.interfaces.push({ nom: itf, adresse: '', vlan: '', etat: 'up', description: 'Interface physique, sans adresse (trunk)' });
    if (itf && v.vlanGestion) e.interfaces.push({ nom: `${itf}.${v.vlanGestion}`, adresse: `${v.gestionPasserelle ?? ''}${pf}`, vlan: String(v.vlanGestion), etat: 'up', description: 'Passerelle du VLAN de gestion' });
    if (reseauGestion) e.routes.push({ type: 'C', destination: reseauGestion, via: 'connecté', interface: itf && v.vlanGestion ? `${itf}.${v.vlanGestion}` : '', pourquoi: 'Réseau de gestion' });
    for (const l of plan) {
      if (itf) e.interfaces.push({ nom: `${itf}.${l.vlan}`, adresse: `${l.passerelle ?? ''}/${l.prefixe ?? ''}`, vlan: String(l.vlan ?? ''), etat: 'up', description: `Passerelle ${l.nom ?? ''}`.trim() });
      if (l.reseau) e.routes.push({ type: 'C', destination: `${l.reseau}/${l.prefixe ?? ''}`, via: 'connecté', interface: itf ? `${itf}.${l.vlan}` : '', pourquoi: `VLAN ${l.vlan} ${l.nom ?? ''}`.trim() });
    }
    out.push({ equipement: e, role: 'Routeur du TP (routage inter-VLAN)' });
  }
  return out.map((x) => ({ ...x, equipement: normaliserEquipement(x.equipement).equipement }));
}
