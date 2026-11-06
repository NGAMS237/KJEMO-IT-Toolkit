/**
 * modeles.mjs — JOURNAL-LABO-08 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Modèles d'équipements et leurs PORTS, comme dans Packet Tracer : en posant
 * un équipement on choisit son modèle (2960 pour l'accès, 3560 ou 3650 pour le
 * cœur, routeurs 4321 / 2911 / 1941, ASA 5506-X, téléphone IP…) et ses ports
 * existent aussitôt ; au câblage, un menu propose les ports libres. Un modèle
 * « personnalisé » accepte une liste écrite à la main (« Gi0/1-4, Se0/0/0 »).
 * Les noms de ports suivent la notation IOS abrégée (Fa, Gi, Se) ou celle du
 * système (ens18, Ethernet0). Module PUR.
 */

/**
 * `ports` : plages au format « Préfixe<début>-<fin> » (le dernier nombre varie).
 * `type` : type de nœud du schéma ; `defaut` : modèle proposé pour ce type.
 */
export const MODELES = [
  // Commutateurs d'accès (niveau 2)
  { id: '2960-24tt', label: 'Catalyst 2960-24TT (accès)', type: 'commutateur', defaut: true, ports: 'Fa0/1-24, Gi0/1-2, Vlan1, Console' },
  { id: '2960-48tt', label: 'Catalyst 2960-48TT (accès)', type: 'commutateur', ports: 'Fa0/1-48, Gi0/1-2, Vlan1, Console' },
  { id: '2960-24tc', label: 'Catalyst 2960-24TC-L (accès)', type: 'commutateur', ports: 'Fa0/1-24, Gi0/1-2, Vlan1, Console' },
  // Commutateurs de cœur / distribution (niveau 3)
  { id: '3650-24ps', label: 'Catalyst 3650-24PS (cœur, niveau 3)', type: 'commutateur-l3', defaut: true, ports: 'Gi1/0/1-24, Gi1/1/1-4, Vlan1, Console' },
  { id: '3560-24ps', label: 'Catalyst 3560-24PS (cœur, niveau 3)', type: 'commutateur-l3', ports: 'Fa0/1-24, Gi0/1-2, Vlan1, Console' },
  { id: '9300-24t', label: 'Catalyst 9300-24T (cœur, niveau 3)', type: 'commutateur-l3', ports: 'Gi1/0/1-24, Te1/1/1-4, Vlan1, Console' },
  // Routeurs
  { id: '4321', label: 'ISR 4321', type: 'routeur', defaut: true, ports: 'Gi0/0/0-1, Se0/1/0-1, Console' },
  { id: '2911', label: 'ISR 2911', type: 'routeur', ports: 'Gi0/0-2, Se0/0/0-1, Console' },
  { id: '1941', label: 'ISR 1941', type: 'routeur', ports: 'Gi0/0-1, Se0/0/0-1, Console' },
  // Sécurité, sans-fil
  { id: 'asa-5506', label: 'ASA 5506-X', type: 'pare-feu', defaut: true, ports: 'Gi1/1-8, Management1/1, Console' },
  { id: 'ap-pt', label: 'Point d’accès', type: 'point-acces', defaut: true, ports: 'Gi0, Sans fil' },
  { id: 'wlc-3504', label: 'Contrôleur sans fil 3504', type: 'point-acces', ports: 'Gi1-4, Console' },
  // Terminaux
  { id: 'pc', label: 'PC (Packet Tracer)', type: 'poste', defaut: true, ports: 'FastEthernet0, Wireless0, RS232' },
  { id: 'poste-windows', label: 'Poste Windows', type: 'poste', ports: 'Ethernet0, Wi-Fi' },
  { id: 'poste-ubuntu', label: 'Poste Ubuntu', type: 'poste', ports: 'ens33, wlan0' },
  { id: 'portable', label: 'Portable', type: 'portable', defaut: true, ports: 'FastEthernet0, Wireless0, RS232' },
  { id: '7960', label: 'Téléphone IP 7960', type: 'telephone-ip', defaut: true, ports: 'Switch, PC' },
  { id: 'imprimante', label: 'Imprimante réseau', type: 'imprimante', defaut: true, ports: 'FastEthernet0' },
  { id: 'smartphone', label: 'Smartphone', type: 'smartphone', defaut: true, ports: 'Wireless0' },
  { id: 'camera-ip', label: 'Caméra IP', type: 'camera-ip', defaut: true, ports: 'Ethernet0' },
  // Serveurs
  { id: 'serveur-linux', label: 'Serveur Linux', type: 'serveur', defaut: true, ports: 'ens18, ens19' },
  { id: 'serveur-windows', label: 'Serveur Windows', type: 'serveur', ports: 'Ethernet0, Ethernet1' },
  { id: 'serveur-pt', label: 'Serveur (Packet Tracer)', type: 'serveur', ports: 'FastEthernet0' },
  { id: 'nas', label: 'NAS', type: 'nas', defaut: true, ports: 'LAN1-2' },
  // Azure / cloud
  { id: 'vm-azure', label: 'VM Azure', type: 'vm', defaut: true, ports: 'nic0, nic1' },
  { id: 'vnet', label: 'Réseau virtuel Azure', type: 'reseau-virtuel', defaut: true, ports: 'Appairage 1-4' },
  { id: 'sous-reseau', label: 'Sous-réseau Azure', type: 'sous-reseau', defaut: true, ports: 'Lien 1-8' },
  { id: 'vpn-gateway', label: 'Passerelle VPN Azure', type: 'passerelle-vpn', defaut: true, ports: '' },
  { id: 'service-cloud', label: 'Service cloud', type: 'service-cloud', defaut: true, ports: '' },
  // Ressources Azure : pas de ports physiques, un lien se pose sans menu (flux, liaison privée).
  ...[['app-service', 'App Service (Linux)'], ['fonction', 'Function App'], ['stockage', 'Compte de stockage StorageV2'], ['base-sql', 'Azure SQL Database'],
    ['event-hub', 'Espace de noms Event Hubs'], ['point-terminaison-prive', 'Point de terminaison privé'], ['nsg', 'Groupe de sécurité réseau'], ['table-routage', 'Table de routage'],
    ['zone-dns', 'Zone DNS'], ['equilibreur', 'Équilibreur de charge Standard'], ['passerelle-app', 'Application Gateway v2'], ['ip-publique', 'IP publique Standard'],
    ['passerelle-nat', 'Passerelle NAT'], ['front-door', 'Front Door Standard'], ['pare-feu-azure', 'Azure Firewall'], ['bastion', 'Azure Bastion'],
    ['appliance', 'Appliance virtuelle (VM)'], ['coffre-cles', 'Key Vault'], ['log-analytics', 'Espace Log Analytics']]
    .map(([type, label]) => ({ id: `az-${type}`, label, type, defaut: true, ports: '' })),
  // WAN
  { id: 'internet', label: 'Internet', type: 'internet', defaut: true, ports: 'Lien 1-8' },
  { id: 'operateur', label: 'Nuage de l’opérateur', type: 'nuage-operateur', defaut: true, ports: 'Lien 1-8' },
];
export const MODELE_PERSO = 'perso';
export const modele = (id) => MODELES.find((m) => m.id === id) ?? null;
export const modelesDuType = (type) => MODELES.filter((m) => m.type === type);
/** Modèle proposé pour un type de nœud (null pour « autre » et les types personnels). */
export const modeleDefaut = (type) => MODELES.find((m) => m.type === type && m.defaut)?.id ?? null;

/**
 * Développe une liste de ports : « Fa0/1-3, Gi0/1 » → [Fa0/1, Fa0/2, Fa0/3, Gi0/1].
 * Une plage porte sur le DERNIER nombre ; 128 ports au plus ; doublons retirés.
 */
export function developperPorts(texte) {
  const out = [];
  for (const brut of String(texte ?? '').split(',')) {
    const p = brut.trim();
    if (!p) continue;
    const m = /^(.*?)(\d+)\s*-\s*(\d+)$/.exec(p);
    if (m && Number(m[3]) >= Number(m[2]) && Number(m[3]) - Number(m[2]) < 128) {
      for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push(`${m[1]}${i}`);
    } else out.push(p.slice(0, 30));
    if (out.length >= 128) break;
  }
  return [...new Set(out)].slice(0, 128);
}

/**
 * Ports d'un nœud : ceux de son modèle (ou sa liste personnalisée), puis les
 * interfaces de sa fiche d'inventaire qui n'y sont pas (sous-interfaces,
 * ports ajoutés à la main), puis les ports déjà utilisés par ses câbles.
 */
export function portsDuNoeud(n, { equipement = null, liens = [] } = {}) {
  const base = n.modele === MODELE_PERSO ? developperPorts(n.ports) : developperPorts(modele(n.modele ?? modeleDefaut(n.type))?.ports ?? '');
  const extra = [
    ...(equipement?.interfaces ?? []).map((i) => i.nom),
    ...liens.flatMap((l) => [l.de === n.id ? l.etiquetteDe : null, l.a === n.id ? l.etiquetteA : null]),
  ].filter(Boolean);
  const vus = new Set(base.map(clePort));
  for (const p of extra) if (!vus.has(clePort(p))) { vus.add(clePort(p)); base.push(p); }
  return base;
}

/**
 * Clé de comparaison d'un port : « GigabitEthernet0/1 » et « Gi0/1 » sont le
 * même port (FastEthernet/Fa, GigabitEthernet/Gi, TenGigabitEthernet/Te, Serial/Se).
 */
export function clePort(p) {
  return String(p ?? '').trim().toLowerCase().replace(/\s+/g, '')
    .replace(/^tengigabitethernet(?=\d)/, 'te').replace(/^gigabitethernet(?=\d)/, 'gi').replace(/^fastethernet(?=\d)/, 'fa').replace(/^serial(?=\d)/, 'se');
}

/** Ports occupés d'un nœud : nom (en minuscules) → { lien, vers (id du nœud d'en face), portEnFace }. */
export function portsOccupes(n, liens) {
  const m = new Map();
  for (const l of liens) {
    if (l.de === n.id && l.etiquetteDe) m.set(clePort(l.etiquetteDe), { lien: l.id, vers: l.a, portEnFace: l.etiquetteA });
    if (l.a === n.id && l.etiquetteA) m.set(clePort(l.etiquetteA), { lien: l.id, vers: l.de, portEnFace: l.etiquetteDe });
  }
  return m;
}

/** Famille d'un équipement pour le choix droit / croisé (règle classique de l'Ethernet cuivre). */
const FAMILLE_COMMUTATION = new Set(['commutateur', 'commutateur-l3', 'point-acces']);
/**
 * Câble « automatique », comme l'éclair de Packet Tracer : console si un port
 * console est choisi, série entre ports série, sans fil pour un port sans fil,
 * fibre pour un port Te, sinon droit entre équipements de familles
 * différentes (commutateur–poste, commutateur–routeur) et croisé entre
 * semblables (commutateur–commutateur, routeur–routeur, poste–routeur).
 */
export function cableAutomatique(typeA, portA, typeB, portB) {
  const ports = [portA, portB].map((p) => String(p ?? '').toLowerCase());
  if (ports.some((p) => p.startsWith('console') || p === 'rs232')) return 'console';
  if (ports.every((p) => /^se/.test(p))) return 'serie';
  if (ports.some((p) => /wireless|sans fil|wi-fi|wlan/.test(p))) return 'sansfil';
  if (ports.some((p) => /^te/.test(p))) return 'fibre';
  // Azure : un point de terminaison privé vers sa ressource = liaison privée ; le reste = flux.
  const AZURE = new Set(['vm', 'app-service', 'fonction', 'stockage', 'base-sql', 'event-hub', 'point-terminaison-prive', 'nsg', 'table-routage', 'zone-dns', 'equilibreur', 'passerelle-app',
    'ip-publique', 'passerelle-nat', 'front-door', 'pare-feu-azure', 'bastion', 'appliance', 'coffre-cles', 'log-analytics', 'service-cloud', 'passerelle-vpn', 'reseau-virtuel', 'sous-reseau']);
  if (typeA === 'point-terminaison-prive' || typeB === 'point-terminaison-prive') return 'liaison-privee';
  if ((AZURE.has(typeA) && typeA !== 'vm') || (AZURE.has(typeB) && typeB !== 'vm') || (AZURE.has(typeA) && typeB === 'internet') || (AZURE.has(typeB) && typeA === 'internet')) return 'trafic';
  if (['internet', 'nuage-operateur'].some((t) => t === typeA || t === typeB)) return 'droit';
  return FAMILLE_COMMUTATION.has(typeA) === FAMILLE_COMMUTATION.has(typeB) ? 'croise' : 'droit';
}

/** Résumé des ports d'un modèle, pour l'écran : « Fa0/1–24, Gi0/1–2, Vlan1, Console ». */
export const resumePorts = (n) => (n.modele === MODELE_PERSO ? n.ports : modele(n.modele ?? modeleDefaut(n.type))?.ports ?? '').replace(/-/g, '–');
