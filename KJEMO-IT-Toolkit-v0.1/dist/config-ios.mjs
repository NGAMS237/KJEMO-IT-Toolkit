/**
 * config-ios.mjs — JOURNAL-LABO-09 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Configuration d'un équipement du schéma, du plus simple au plus complet, et
 * génération des commandes Cisco IOS correspondantes (dans l'ordre qui marche).
 *   Simple        : nom, VLAN, ports (accès, trunk, adresse), gestion,
 *                   sous-interfaces d'un routeur, adresse IP d'un poste.
 *   Intermédiaire : VLAN natif et autorisés, VLAN voix, port-security, VTP,
 *                   SSH (sans mot de passe écrit), DHCP, routes statiques.
 *   Complet       : STP (Rapid-PVST, racines, PortFast, BPDU Guard),
 *                   EtherChannel (LACP, PAgP), routage par SVI (ip routing),
 *                   OSPF, HSRP, NAT (PAT).
 * Les adresses s'écrivent « 192.168.10.1/24 » : le masque est calculé.
 * AUCUN secret : les lignes « secret » s'arrêtent avant le mot de passe, à
 * taper sur l'équipement. Les commandes sont vérifiées pour leur forme et leur
 * ordre, PAS exécutées sur un équipement. Module PUR.
 */
import { secretDans } from './journal.mjs';
import { developperPorts, modele, modeleDefaut, MODELE_PERSO, clePort } from './modeles.mjs';

export const NIVEAUX = [
  { id: 'simple', label: 'Simple' }, { id: 'intermediaire', label: 'Intermédiaire' }, { id: 'complet', label: 'Complet' },
];
const RANG = { simple: 0, intermediaire: 1, complet: 2 };
export const auNiveau = (niveau, requis) => RANG[niveau ?? 'simple'] >= RANG[requis];

/** Famille de configuration d'un type de nœud. */
export function famille(type) {
  if (type === 'routeur') return 'routeur';
  if (type === 'commutateur') return 'commutateur';
  if (type === 'commutateur-l3') return 'commutateur-l3';
  if (['poste', 'portable', 'telephone-ip', 'imprimante', 'smartphone', 'camera-ip', 'serveur', 'nas', 'vm'].includes(type)) return 'hote';
  return null;   // pare-feu ASA, point d'accès, cloud : documentés, sans génération de commandes
}
export const estIos = (type) => ['routeur', 'commutateur', 'commutateur-l3'].includes(famille(type));

/* ---------------------------------------------------------------------------
 * Adresses
 * ------------------------------------------------------------------------ */
/** « 192.168.10.1/24 » → { ip, prefixe, masque, reseau, wildcard } ; null si invalide (préfixe obligatoire). */
export function cidr(texte) {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*\/\s*(\d{1,2})\s*$/.exec(String(texte ?? ''));
  if (!m) return null;
  const o = m.slice(1, 5).map(Number); const p = Number(m[5]);
  if (o.some((x) => x > 255) || p > 32) return null;
  const n = o.reduce((a, x) => a * 256 + x, 0);
  const mq = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
  const vers = (v) => [24, 16, 8, 0].map((s) => (v >>> s) & 255).join('.');
  return { ip: vers(n), prefixe: p, masque: vers(mq), reseau: vers((n & mq) >>> 0), wildcard: vers((~mq) >>> 0), entier: n, entierReseau: (n & mq) >>> 0 };
}
export const ipSeule = (t) => /^\s*(\d{1,3}\.){3}\d{1,3}\s*$/.test(String(t ?? '')) && String(t).trim().split('.').every((x) => Number(x) <= 255);
/** Liste de VLAN « 10,20,30-35 » valide (1 à 4094). */
export const listeVlans = (t) => /^\s*\d{1,4}(\s*-\s*\d{1,4})?(\s*,\s*\d{1,4}(\s*-\s*\d{1,4})?)*\s*$/.test(String(t ?? '')) && String(t).match(/\d+/g).every((v) => Number(v) >= 1 && Number(v) <= 4094);
const vlanOk = (v) => /^\d{1,4}$/.test(String(v ?? '')) && Number(v) >= 1 && Number(v) <= 4094;

/* ---------------------------------------------------------------------------
 * Modèle de configuration
 * ------------------------------------------------------------------------ */
const t = (v, max = 80) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const b = (v) => v === true;
const liste = (v, max, f) => (Array.isArray(v) ? v : []).slice(0, max).map(f).filter(Boolean);

export function configVide() {
  return {
    niveau: 'simple', domaine: '', banniere: '',
    gestion: { vlan: '', adresse: '', passerelle: '' },
    ssh: { actif: false, utilisateur: 'admin' },
    vlans: [], vtp: { mode: '', domaine: '' }, ports: {},
    sousInterfaces: [], svis: [], ipRouting: false,
    stp: { mode: '', primaire: '', secondaire: '', portfastDefaut: false, bpduguardDefaut: false },
    canaux: [], statiques: [], ospf: { processus: '', routerId: '', reseaux: [], passifs: '' },
    dhcp: { exclusions: [], pools: [] }, hsrp: [], nat: { reseaux: '', sortie: '' },
    hote: { adresse: '', passerelle: '', dns: '' },
  };
}

const MODES_PORT = ['', 'access', 'trunk', 'routed'];
const PROTOCOLES = { lacp: ['active', 'passive'], pagp: ['desirable', 'auto'], on: ['on'] };

/** Valide et borne une configuration brute (rien d'inconnu n'est gardé). */
export function normaliserConfig(brut) {
  const c = configVide(); const x = brut && typeof brut === 'object' ? brut : {};
  c.niveau = RANG[x.niveau] !== undefined ? x.niveau : 'simple';
  c.domaine = t(x.domaine, 80); c.banniere = t(x.banniere, 160);
  c.gestion = { vlan: t(x.gestion?.vlan, 4), adresse: t(x.gestion?.adresse, 20), passerelle: t(x.gestion?.passerelle, 15) };
  c.ssh = { actif: b(x.ssh?.actif), utilisateur: t(x.ssh?.utilisateur, 30) || 'admin' };
  c.vlans = liste(x.vlans, 64, (v) => (v && t(v.id, 4) ? { id: t(v.id, 4), nom: t(v.nom, 32).replace(/\s+/g, '_') } : null));
  c.vtp = { mode: ['', 'server', 'client', 'transparent'].includes(x.vtp?.mode) ? x.vtp.mode : '', domaine: t(x.vtp?.domaine, 32) };
  for (const [nom, p] of Object.entries(x.ports && typeof x.ports === 'object' ? x.ports : {}).slice(0, 128)) {
    if (!p || typeof p !== 'object' || !t(nom, 30)) continue;
    c.ports[t(nom, 30)] = {
      mode: MODES_PORT.includes(p.mode) ? p.mode : '', vlan: t(p.vlan, 4), voix: t(p.voix, 4), natif: t(p.natif, 4), autorises: t(p.autorises, 60),
      adresse: t(p.adresse, 20), description: t(p.description, 60), eteint: b(p.eteint), portfast: b(p.portfast), bpduguard: b(p.bpduguard),
      securite: b(p.securite), securiteMax: t(p.securiteMax, 3), helper: t(p.helper, 15), nat: ['', 'inside', 'outside'].includes(p.nat) ? p.nat : '',
    };
  }
  c.sousInterfaces = liste(x.sousInterfaces, 32, (s) => (s && t(s.port, 30) ? { port: t(s.port, 30), vlan: t(s.vlan, 4), adresse: t(s.adresse, 20), natif: b(s.natif), helper: t(s.helper, 15), nat: ['', 'inside', 'outside'].includes(s.nat) ? s.nat : '' } : null));
  c.svis = liste(x.svis, 32, (s) => (s && t(s.vlan, 4) ? { vlan: t(s.vlan, 4), adresse: t(s.adresse, 20), helper: t(s.helper, 15) } : null));
  c.ipRouting = b(x.ipRouting);
  c.stp = { mode: ['', 'pvst', 'rapid-pvst'].includes(x.stp?.mode) ? x.stp.mode : '', primaire: t(x.stp?.primaire, 60), secondaire: t(x.stp?.secondaire, 60),
    portfastDefaut: b(x.stp?.portfastDefaut), bpduguardDefaut: b(x.stp?.bpduguardDefaut) };
  c.canaux = liste(x.canaux, 16, (k) => {
    if (!k || !t(k.groupe, 3)) return null;
    const protocole = PROTOCOLES[k.protocole] ? k.protocole : 'lacp';
    return { groupe: t(k.groupe, 3), protocole, mode: PROTOCOLES[protocole].includes(k.mode) ? k.mode : PROTOCOLES[protocole][0],
      ports: (Array.isArray(k.ports) ? k.ports : String(k.ports ?? '').split(',')).map((p) => t(p, 30)).filter(Boolean).slice(0, 8),
      usage: ['trunk', 'access'].includes(k.usage) ? k.usage : 'trunk', vlan: t(k.vlan, 4), natif: t(k.natif, 4), autorises: t(k.autorises, 60) };
  });
  c.statiques = liste(x.statiques, 32, (r) => (r && (t(r.reseau) || t(r.saut)) ? { reseau: t(r.reseau, 20), saut: t(r.saut, 30) } : null));
  c.ospf = { processus: t(x.ospf?.processus, 5), routerId: t(x.ospf?.routerId, 15), passifs: t(x.ospf?.passifs, 120),
    reseaux: liste(x.ospf?.reseaux, 32, (r) => (r && t(r.reseau) ? { reseau: t(r.reseau, 20), zone: t(r.zone, 10) || '0' } : null)) };
  c.dhcp = {
    exclusions: liste(x.dhcp?.exclusions, 16, (e) => (e && t(e.debut) ? { debut: t(e.debut, 15), fin: t(e.fin, 15) } : null)),
    pools: liste(x.dhcp?.pools, 16, (p) => (p && t(p.nom) ? { nom: t(p.nom, 32).replace(/\s+/g, '_'), reseau: t(p.reseau, 20), passerelle: t(p.passerelle, 15), dns: t(p.dns, 40), domaine: t(p.domaine, 60) } : null)),
  };
  c.hsrp = liste(x.hsrp, 16, (h) => (h && t(h.interface) ? { interface: t(h.interface, 30), groupe: t(h.groupe, 4), ip: t(h.ip, 15), priorite: t(h.priorite, 3), preempt: b(h.preempt) } : null));
  c.nat = { reseaux: t(x.nat?.reseaux, 160), sortie: t(x.nat?.sortie, 30) };
  c.hote = { adresse: t(x.hote?.adresse, 20), passerelle: t(x.hote?.passerelle, 15), dns: t(x.hote?.dns, 40) };
  return c;
}

/** Tous les textes d'une configuration (pour la garde « aucun secret »). */
export function textesConfig(c) {
  return JSON.stringify(c).replace(/"[a-zA-Z]+":/g, ' ');
}
export function secretConfig(c) {
  return secretDans(textesConfig(c));
}

/* ---------------------------------------------------------------------------
 * Vérifications (avertissements, jamais bloquantes sauf secret)
 * ------------------------------------------------------------------------ */
export function verifierConfig(n, c) {
  const msgs = [];
  const fam = famille(n.type);
  const ports = n.modele === MODELE_PERSO ? developperPorts(n.ports) : developperPorts(modele(n.modele ?? modeleDefaut(n.type))?.ports ?? '');
  const connu = new Set(ports.map(clePort));
  const adr = (v, quoi) => { if (v && !cidr(v)) msgs.push(`${quoi} : « ${v} » n’est pas une adresse avec préfixe (ex. 192.168.10.1/24).`); };
  const ip = (v, quoi) => { if (v && !ipSeule(v)) msgs.push(`${quoi} : « ${v} » n’est pas une adresse IP.`); };
  for (const v of c.vlans) if (!vlanOk(v.id) || (Number(v.id) >= 1002 && Number(v.id) <= 1005)) msgs.push(`VLAN ${v.id} : numéro invalide ou réservé (1002 à 1005).`);
  const ids = c.vlans.map((v) => v.id); if (new Set(ids).size !== ids.length) msgs.push('Un même VLAN est déclaré deux fois.');
  for (const [p, cp] of Object.entries(c.ports)) {
    if (!connu.has(clePort(p)) && !/^vlan\d+$/i.test(p)) msgs.push(`Port ${p} : il n’existe pas sur ce modèle.`);
    if (cp.mode === 'access' && cp.vlan && !ids.includes(cp.vlan) && cp.vlan !== '1' && fam !== 'routeur') msgs.push(`Port ${p} : le VLAN ${cp.vlan} n’est pas créé sur cet équipement.`);
    if (cp.mode === 'trunk' && cp.autorises && !listeVlans(cp.autorises)) msgs.push(`Port ${p} : liste de VLAN autorisés invalide (ex. 10,20,99).`);
    if (cp.mode === 'routed' && fam === 'commutateur') msgs.push(`Port ${p} : un 2960 (niveau 2) n’a pas de port routé ; utilise un commutateur de cœur ou une SVI.`);
    if (cp.mode === 'trunk' && fam === 'routeur') msgs.push(`Port ${p} : un routeur n’a pas de mode trunk ; utilise des sous-interfaces.`);
    adr(cp.adresse, `Port ${p}`);
    if (cp.adresse && cp.mode !== 'routed' && fam !== 'routeur') msgs.push(`Port ${p} : une adresse sur un port de commutateur demande le mode « routé » (niveau 3).`);
    if (cp.securite && cp.mode !== 'access') msgs.push(`Port ${p} : port-security seulement sur un port d’accès.`);
  }
  for (const s of c.sousInterfaces) { if (!vlanOk(s.vlan)) msgs.push(`Sous-interface de ${s.port} : VLAN invalide.`); adr(s.adresse, `Sous-interface ${s.port}.${s.vlan}`); }
  for (const s of c.svis) adr(s.adresse, `SVI Vlan${s.vlan}`);
  if (c.svis.length && fam === 'commutateur-l3' && !c.ipRouting) msgs.push('Des SVI avec adresse sur un commutateur de cœur : coche « ip routing » pour router entre les VLAN.');
  if (c.svis.length > 1 && fam === 'commutateur') msgs.push('Un 2960 ne route pas : une seule SVI (gestion) a du sens.');
  adr(c.gestion.adresse, 'Adresse de gestion'); ip(c.gestion.passerelle, 'Passerelle de gestion');
  if (c.ssh.actif && !c.domaine) msgs.push('SSH : un nom de domaine est obligatoire pour générer la clé RSA.');
  if (c.ssh.actif && !n.nom && !n.equipementId) msgs.push('SSH : donne un nom d’hôte à l’équipement (IOS refuse « Switch » ou « Router »).');
  for (const k of c.canaux) {
    if (k.ports.length < 2) msgs.push(`EtherChannel ${k.groupe} : il faut au moins deux ports.`);
    for (const p of k.ports) if (!connu.has(clePort(p))) msgs.push(`EtherChannel ${k.groupe} : le port ${p} n’existe pas sur ce modèle.`);
  }
  for (const r of c.statiques) { if (r.reseau && !cidr(r.reseau)) msgs.push(`Route statique : « ${r.reseau} » doit être un réseau avec préfixe (0.0.0.0/0 pour la route par défaut).`); }
  for (const r of c.ospf.reseaux) if (!cidr(r.reseau)) msgs.push(`OSPF : « ${r.reseau} » doit être un réseau avec préfixe.`);
  if (c.ospf.reseaux.length && !c.ospf.processus) msgs.push('OSPF : indique le numéro de processus (ex. 1).');
  ip(c.ospf.routerId, 'Router-ID OSPF');
  for (const p of c.dhcp.pools) { adr(p.reseau, `Pool DHCP ${p.nom}`); ip(p.passerelle, `Passerelle du pool ${p.nom}`); }
  for (const h of c.hsrp) ip(h.ip, `HSRP ${h.interface}`);
  if (c.nat.sortie && !c.nat.reseaux) msgs.push('NAT : indique les réseaux internes à traduire.');
  for (const r of c.nat.reseaux.split(',').map((x) => x.trim()).filter(Boolean)) if (!cidr(r)) msgs.push(`NAT : « ${r} » doit être un réseau avec préfixe.`);
  if (fam === 'hote') { adr(c.hote.adresse, 'Adresse du poste'); ip(c.hote.passerelle, 'Passerelle du poste'); }
  return msgs;
}

/* ---------------------------------------------------------------------------
 * Génération des commandes IOS
 * ------------------------------------------------------------------------ */
const nomComplet = (p) => String(p).replace(/^Fa(?=\d)/, 'FastEthernet').replace(/^Gi(?=\d)/, 'GigabitEthernet').replace(/^Te(?=\d)/, 'TenGigabitEthernet').replace(/^Se(?=\d)/, 'Serial');
/** ASCII seulement (IOS) : accents retirés. */
const ascii = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
const listeAvecPlages = (l) => l.join(',');

/**
 * Commandes IOS d'un routeur ou d'un commutateur. `nom` : nom d'hôte.
 * Renvoie { blocs: [{ titre, lignes }], avertissements }. Les blocs vides sont omis.
 */
export function commandesIos(n, c, { nom = '' } = {}) {
  const fam = famille(n.type);
  if (!estIos(n.type)) return { blocs: [], avertissements: ['Pas de commandes IOS pour ce type d’équipement.'] };
  const blocs = []; const B = (titre, lignes) => { if (lignes.length) blocs.push({ titre, lignes }); };
  const hote = ascii(nom).replace(/\s+/g, '-').slice(0, 63);
  B('Base', ['enable', 'configure terminal', ...(hote ? [`hostname ${hote}`] : []), 'no ip domain-lookup', ...(c.domaine ? [`ip domain-name ${ascii(c.domaine)}`] : []),
    ...(c.banniere ? [`banner motd # ${ascii(c.banniere)} #`] : []), 'service password-encryption']);
  if (fam !== 'routeur') {
    if (c.vtp.mode) B('VTP', [`vtp mode ${c.vtp.mode}`, ...(c.vtp.domaine ? [`vtp domain ${ascii(c.vtp.domaine)}`] : [])]);
    B('VLAN', c.vlans.flatMap((v) => [`vlan ${v.id}`, ...(v.nom ? [` name ${ascii(v.nom)}`] : []), ' exit']));
    const stp = [];
    if (c.stp.mode) stp.push(`spanning-tree mode ${c.stp.mode}`);
    if (c.stp.primaire) stp.push(`spanning-tree vlan ${c.stp.primaire} root primary`);
    if (c.stp.secondaire) stp.push(`spanning-tree vlan ${c.stp.secondaire} root secondary`);
    if (c.stp.portfastDefaut) stp.push('spanning-tree portfast default');
    if (c.stp.bpduguardDefaut) stp.push('spanning-tree portfast bpduguard default');
    B('Spanning Tree', stp);
  }
  // Ports physiques (hors EtherChannel, configurés à part).
  const dansCanal = new Set(c.canaux.flatMap((k) => k.ports.map(clePort)));
  const encapsulation = n.modele === '3560-24ps';   // les 3560 demandent l'encapsulation avant le mode trunk
  const lignesPort = (cp, { routeur = fam === 'routeur' } = {}) => {
    const l = [];
    if (cp.description) l.push(` description ${ascii(cp.description)}`);
    if (!routeur) {
      if (cp.mode === 'access') {
        l.push(' switchport mode access'); if (cp.vlan) l.push(` switchport access vlan ${cp.vlan}`);
        if (cp.voix) l.push(` switchport voice vlan ${cp.voix}`);
        if (cp.securite) { l.push(' switchport port-security'); if (cp.securiteMax) l.push(` switchport port-security maximum ${cp.securiteMax}`); l.push(' switchport port-security mac-address sticky', ' switchport port-security violation restrict'); }
        if (cp.portfast) l.push(' spanning-tree portfast'); if (cp.bpduguard) l.push(' spanning-tree bpduguard enable');
      } else if (cp.mode === 'trunk') {
        if (encapsulation) l.push(' switchport trunk encapsulation dot1q');
        l.push(' switchport mode trunk'); if (cp.natif) l.push(` switchport trunk native vlan ${cp.natif}`); if (cp.autorises) l.push(` switchport trunk allowed vlan ${cp.autorises.replace(/\s+/g, '')}`);
      } else if (cp.mode === 'routed') l.push(' no switchport');
    }
    const a = cidr(cp.adresse); if (a && (routeur || cp.mode === 'routed')) l.push(` ip address ${a.ip} ${a.masque}`);
    if (cp.helper) l.push(` ip helper-address ${cp.helper}`);
    if (cp.nat) l.push(` ip nat ${cp.nat}`);
    l.push(cp.eteint ? ' shutdown' : ' no shutdown');
    return l;
  };
  const parents = new Set(c.sousInterfaces.map((s) => clePort(s.port)));
  const portsLignes = [];
  for (const [p, cp] of Object.entries(c.ports)) {
    if (dansCanal.has(clePort(p)) || /^vlan\d+$/i.test(p)) continue;
    const vide = !cp.mode && !cp.adresse && !cp.description && !cp.eteint && !cp.helper && !cp.nat;
    if (vide && !parents.has(clePort(p))) continue;
    portsLignes.push(`interface ${nomComplet(p)}`, ...lignesPort(cp), ' exit');
  }
  // Interfaces parentes des sous-interfaces non décrites : on les allume.
  for (const p of parents) if (!Object.keys(c.ports).some((x) => clePort(x) === p)) {
    const vrai = c.sousInterfaces.find((s) => clePort(s.port) === p).port;
    portsLignes.push(`interface ${nomComplet(vrai)}`, ' no shutdown', ' exit');
  }
  B('Ports', portsLignes);
  const canaux = [];
  for (const k of c.canaux) {
    if (k.ports.length < 2) continue;
    canaux.push(`interface range ${k.ports.map(nomComplet).join(' , ')}`, ...(fam === 'routeur' ? [] : [` switchport mode ${k.usage}`]), ` channel-group ${k.groupe} mode ${k.mode}`, ' no shutdown', ' exit');
    canaux.push(`interface Port-channel${k.groupe}`);
    if (fam !== 'routeur') {
      if (k.usage === 'trunk') { if (encapsulation) canaux.push(' switchport trunk encapsulation dot1q'); canaux.push(' switchport mode trunk'); if (k.natif) canaux.push(` switchport trunk native vlan ${k.natif}`); if (k.autorises) canaux.push(` switchport trunk allowed vlan ${k.autorises.replace(/\s+/g, '')}`); }
      else { canaux.push(' switchport mode access'); if (k.vlan) canaux.push(` switchport access vlan ${k.vlan}`); }
    }
    canaux.push(' exit');
  }
  B('EtherChannel', canaux);
  B('Sous-interfaces (routeur sur un bâton)', c.sousInterfaces.flatMap((s) => {
    const a = cidr(s.adresse);
    return [`interface ${nomComplet(s.port)}.${s.vlan}`, ` encapsulation dot1Q ${s.vlan}${s.natif ? ' native' : ''}`, ...(a ? [` ip address ${a.ip} ${a.masque}`] : []),
      ...(s.helper ? [` ip helper-address ${s.helper}`] : []), ...(s.nat ? [` ip nat ${s.nat}`] : []), ' exit'];
  }));
  if (fam !== 'routeur') {
    const g = cidr(c.gestion.adresse);
    B('Adresse de gestion', [...(c.gestion.vlan && g ? [`interface vlan ${c.gestion.vlan}`, ` ip address ${g.ip} ${g.masque}`, ' no shutdown', ' exit'] : []),
      ...(c.gestion.passerelle ? [`ip default-gateway ${c.gestion.passerelle}`] : [])]);
    B('Routage entre VLAN (SVI)', [...(c.ipRouting ? ['ip routing'] : []), ...c.svis.flatMap((s) => {
      const a = cidr(s.adresse);
      return [`interface vlan ${s.vlan}`, ...(a ? [` ip address ${a.ip} ${a.masque}`] : []), ...(s.helper ? [` ip helper-address ${s.helper}`] : []), ' no shutdown', ' exit'];
    })]);
  }
  B('HSRP', c.hsrp.flatMap((h) => [`interface ${nomComplet(h.interface)}`, ' standby version 2', ` standby ${h.groupe || 1} ip ${h.ip}`, ...(h.priorite ? [` standby ${h.groupe || 1} priority ${h.priorite}`] : []), ...(h.preempt ? [` standby ${h.groupe || 1} preempt`] : []), ' exit']));
  B('DHCP', [...c.dhcp.exclusions.map((e) => `ip dhcp excluded-address ${e.debut}${e.fin ? ` ${e.fin}` : ''}`), ...c.dhcp.pools.flatMap((p) => {
    const r = cidr(p.reseau);
    return [`ip dhcp pool ${ascii(p.nom)}`, ...(r ? [` network ${r.reseau} ${r.masque}`] : []), ...(p.passerelle ? [` default-router ${p.passerelle}`] : []),
      ...(p.dns ? [` dns-server ${p.dns.replace(/[,;]\s*/g, ' ')}`] : []), ...(p.domaine ? [` domain-name ${ascii(p.domaine)}`] : []), ' exit'];
  })]);
  B('Routes statiques', c.statiques.map((r) => { const x = cidr(r.reseau); return x && r.saut ? `ip route ${x.reseau} ${x.masque} ${nomComplet(r.saut)}` : null; }).filter(Boolean));
  if (c.ospf.processus && (c.ospf.reseaux.length || c.ospf.routerId)) {
    B('OSPF', [`router ospf ${c.ospf.processus}`, ...(c.ospf.routerId ? [` router-id ${c.ospf.routerId}`] : []),
      ...c.ospf.reseaux.map((r) => { const x = cidr(r.reseau); return x ? ` network ${x.reseau} ${x.wildcard} area ${r.zone}` : null; }).filter(Boolean),
      ...c.ospf.passifs.split(',').map((p) => p.trim()).filter(Boolean).map((p) => ` passive-interface ${nomComplet(p)}`), ' exit']);
  }
  const natRes = c.nat.reseaux.split(',').map((x) => cidr(x.trim())).filter(Boolean);
  if (natRes.length && c.nat.sortie) B('NAT (PAT)', [...natRes.map((r) => `access-list 1 permit ${r.reseau} ${r.wildcard}`), `ip nat inside source list 1 interface ${nomComplet(c.nat.sortie)} overload`]);
  if (c.ssh.actif) {
    // La ligne « secret » s'arrête avant le mot de passe : il se tape sur l'équipement.
    B('SSH', [...(c.domaine ? [] : ['! ip domain-name est obligatoire avant la cle RSA']), `username ${ascii(c.ssh.utilisateur)} privilege 15 secret`, 'crypto key generate rsa modulus 2048', 'ip ssh version 2',
      'line vty 0 15', ' login local', ' transport input ssh', ' exit']);
  }
  B('Fin', ['end', 'copy running-config startup-config']);
  return { blocs, avertissements: verifierConfig(n, c) };
}

/** Texte à copier : un bloc par ligne, sans les titres. */
export const texteCommandes = (r) => r.blocs.flatMap((bl) => bl.lignes).join('\n');

/* ---------------------------------------------------------------------------
 * Proposition à partir du schéma (moins de champs à remplir)
 * ------------------------------------------------------------------------ */
const VLAN_ZONE = /vlan\s*(\d{1,4})(?:\s*[·:\-–]\s*([^·]+?))?(?:\s*·\s*(\d+\.\d+\.\d+\.\d+\/\d+))?\s*$/i;
/** Zone « VLAN 10 · VENTES · 192.168.10.0/24 » → { vlan, nom, reseau }. */
export function lireZone(z) {
  const m = VLAN_ZONE.exec(String(z?.nom ?? ''));
  if (!m) return null;
  const reseau = /(\d+\.\d+\.\d+\.\d+\/\d+)/.exec(z.nom)?.[1] ?? '';
  return { vlan: m[1], nom: (m[2] ?? '').trim().replace(/\s+/g, '_').slice(0, 32), reseau };
}
const x2ip = (v) => (cidr(v)?.ip ?? (ipSeule(v) ? String(v).trim() : ''));
const zoneDe = (n, zones) => zones.filter((z) => n.x >= z.x && n.x <= z.x + z.l && n.y >= z.y && n.y <= z.y + z.h).sort((a, b) => a.l * a.h - b.l * b.h)[0] ?? null;
const ACCES_HOTE = new Set(['hote']);

/**
 * Configuration proposée pour un nœud, déduite du schéma : VLAN des zones,
 * ports câblés (accès vers un poste dans un VLAN, trunk vers un autre
 * équipement réseau, EtherChannel pour des câbles parallèles), sous-interfaces
 * d'un routeur relié par trunk, adresse d'un poste. Les valeurs déjà saisies
 * ne sont jamais remplacées. Renvoie { config, ajouts } (ajouts : descriptions).
 */
export function proposerConfig(schema, noeudId, existante = null, { niveau = null } = {}) {
  const n = schema.noeuds.find((x) => x.id === noeudId);
  const c = normaliserConfig(existante ?? n?.config); const ajouts = [];
  if (!n) return { config: c, ajouts };
  if (niveau) c.niveau = niveau;
  const fam = famille(n.type);
  const noeuds = new Map(schema.noeuds.map((x) => [x.id, x]));
  const zonesVlan = schema.zones.map((z) => ({ z, v: lireZone(z) })).filter((x) => x.v);
  const liens = schema.liens.filter((l) => l.de === n.id || l.a === n.id).map((l) => ({ l, monPort: l.de === n.id ? l.etiquetteDe : l.etiquetteA, monAdr: l.de === n.id ? l.adresseDe : l.adresseA, autre: noeuds.get(l.de === n.id ? l.a : l.de), sonPort: l.de === n.id ? l.etiquetteA : l.etiquetteDe }));
  const port = (p) => { if (!c.ports[p]) c.ports[p] = normaliserConfig({ ports: { [p]: {} } }).ports[p]; return c.ports[p]; };
  if (fam === 'commutateur' || fam === 'commutateur-l3') {
    for (const { v } of zonesVlan) if (!c.vlans.some((x) => x.id === v.vlan)) { c.vlans.push({ id: v.vlan, nom: v.nom }); ajouts.push(`VLAN ${v.vlan}${v.nom ? ` ${v.nom}` : ''}`); }
    const tousVlans = c.vlans.map((v) => v.id).join(',');
    // Câbles parallèles vers un même équipement réseau : EtherChannel (niveau complet).
    const parVoisin = new Map();
    for (const x of liens) if (x.monPort && x.autre && famille(x.autre.type) !== 'hote') parVoisin.set(x.autre.id, [...(parVoisin.get(x.autre.id) ?? []), x]);
    for (const [, groupe] of parVoisin) {
      if (groupe.length < 2 || !auNiveau(c.niveau, 'complet')) continue;
      const ports = groupe.map((x) => x.monPort);
      if (c.canaux.some((k) => k.ports.some((p) => ports.map(clePort).includes(clePort(p))))) continue;
      const g = String(c.canaux.length + 1);
      c.canaux.push({ groupe: g, protocole: 'lacp', mode: 'active', ports, usage: 'trunk', vlan: '', natif: '', autorises: tousVlans });
      ajouts.push(`EtherChannel ${g} (${ports.join(', ')}) vers ${groupe[0].autre.nom || 'le voisin'}`);
    }
    const dansCanal = new Set(c.canaux.flatMap((k) => k.ports.map(clePort)));
    for (const x of liens) {
      if (!x.monPort || dansCanal.has(clePort(x.monPort)) || !x.autre) continue;
      const cp = port(x.monPort);
      if (!cp.description) cp.description = `Vers ${x.autre.nom || x.autre.type} ${x.sonPort || ''}`.trim();
      if (cp.mode) continue;
      if (ACCES_HOTE.has(famille(x.autre.type))) {
        const zone = zoneDe(x.autre, schema.zones); const v = zone ? lireZone(zone) : null;
        cp.mode = 'access'; if (v) cp.vlan = v.vlan;
        if (x.autre.type === 'telephone-ip') { cp.voix = c.vlans.find((y) => /voi|tel/i.test(y.nom))?.id ?? ''; }
        if (auNiveau(c.niveau, 'complet')) { cp.portfast = true; cp.bpduguard = true; }
        ajouts.push(`${x.monPort} en accès${v ? ` VLAN ${v.vlan}` : ''}`);
      } else if (['routeur', 'commutateur', 'commutateur-l3', 'point-acces'].includes(x.autre.type)) {
        cp.mode = 'trunk'; if (auNiveau(c.niveau, 'intermediaire') && tousVlans) cp.autorises = tousVlans;
        ajouts.push(`${x.monPort} en trunk`);
      }
    }
    // Adresse de gestion : l'adresse du lien vers… ou la note du nœud, dans le VLAN de gestion (nom « GESTION »).
    const gestion = c.vlans.find((v) => /gest|mgmt|admin/i.test(v.nom));
    if (fam === 'commutateur' && gestion && !c.gestion.vlan) { c.gestion.vlan = gestion.id; ajouts.push(`gestion dans le VLAN ${gestion.id}`); }
    if (fam === 'commutateur' && c.gestion.vlan && !c.gestion.adresse && cidr(n.note)) { c.gestion.adresse = n.note.trim(); ajouts.push(`adresse de gestion ${c.gestion.adresse}`); }
    if (fam === 'commutateur' && c.gestion.adresse && !c.gestion.passerelle) {
      const gw = passerelleProposee(schema, c.gestion.adresse, n.id);
      if (gw) { c.gestion.passerelle = gw; ajouts.push(`passerelle de gestion ${gw}`); }
    }
    // Spanning Tree (complet) : Rapid-PVST partout ; le commutateur de cœur est la racine de tous les VLAN.
    if (auNiveau(c.niveau, 'complet') && c.vlans.length) {
      if (!c.stp.mode) { c.stp.mode = 'rapid-pvst'; ajouts.push('Rapid-PVST'); }
      if (fam === 'commutateur-l3' && !c.stp.primaire && !c.stp.secondaire) {
        const autreRacine = schema.noeuds.some((x) => x.id !== n.id && x.type === 'commutateur-l3' && x.config?.stp?.primaire);
        if (autreRacine) { c.stp.secondaire = tousVlans; ajouts.push(`racine secondaire des VLAN ${tousVlans}`); }
        else { c.stp.primaire = tousVlans; ajouts.push(`racine primaire des VLAN ${tousVlans}`); }
      }
    }
    if (fam === 'commutateur-l3' && auNiveau(c.niveau, 'complet')) {
      for (const { v } of zonesVlan) {
        if (c.svis.some((s) => s.vlan === v.vlan) || !v.reseau) continue;
        const r = cidr(v.reseau); if (!r) continue;
        const gw = `${r.reseau.split('.').slice(0, 3).join('.')}.${(Number(r.reseau.split('.')[3]) + 1)}/${r.prefixe}`;
        c.svis.push({ vlan: v.vlan, adresse: gw, helper: '' }); ajouts.push(`SVI Vlan${v.vlan} ${gw}`);
      }
      if (c.svis.length && !c.ipRouting) { c.ipRouting = true; ajouts.push('ip routing'); }
    }
  }
  if (fam === 'routeur') {
    for (const x of liens) {
      if (!x.monPort) continue;
      const cp = port(x.monPort);
      if (!cp.description && x.autre) cp.description = `Vers ${x.autre.nom || x.autre.type} ${x.sonPort || ''}`.trim();
      if (x.monAdr && !cp.adresse && cidr(x.monAdr)) { cp.adresse = x.monAdr; ajouts.push(`${x.monPort} ${x.monAdr}`); }
      // Relié par un trunk à un commutateur : une sous-interface par VLAN des zones.
      if (x.l.style === 'trunk' && x.autre && ['commutateur', 'commutateur-l3'].includes(x.autre.type)) {
        for (const { v } of zonesVlan) {
          if (c.sousInterfaces.some((s) => clePort(s.port) === clePort(x.monPort) && s.vlan === v.vlan)) continue;
          const r = cidr(v.reseau);
          const gw = r ? `${r.reseau.split('.').slice(0, 3).join('.')}.${Number(r.reseau.split('.')[3]) + 1}/${r.prefixe}` : '';
          c.sousInterfaces.push({ port: x.monPort, vlan: v.vlan, adresse: gw, natif: false, helper: '', nat: '' });
          ajouts.push(`sous-interface ${x.monPort}.${v.vlan}${gw ? ` ${gw}` : ''}`);
        }
      }
    }
  }
  // Routeur ou cœur relié à Internet / à l'opérateur : route par défaut (intermédiaire), NAT PAT (complet).
  if (fam === 'routeur' || fam === 'commutateur-l3') {
    const sortie = liens.find((x) => x.monPort && x.autre && ['internet', 'nuage-operateur'].includes(x.autre.type));
    if (sortie && auNiveau(c.niveau, 'intermediaire') && !c.statiques.some((r) => cidr(r.reseau)?.prefixe === 0)) {
      const enFace = String(x2ip(sortie.l.de === n.id ? sortie.l.adresseA : sortie.l.adresseDe));
      c.statiques.push({ reseau: '0.0.0.0/0', saut: enFace || sortie.monPort }); ajouts.push(`route par défaut vers ${enFace || sortie.monPort}`);
    }
    if (sortie && auNiveau(c.niveau, 'complet') && !c.nat.sortie) {
      const internes = [...new Set(zonesVlan.map(({ v }) => v.reseau).filter((r) => cidr(r)))];
      if (internes.length) {
        c.nat = { reseaux: internes.join(', '), sortie: sortie.monPort };
        port(sortie.monPort).nat = 'outside';
        for (const si of c.sousInterfaces) if (!si.nat) si.nat = 'inside';
        for (const [p, cp] of Object.entries(c.ports)) if (clePort(p) !== clePort(sortie.monPort) && cidr(cp.adresse) && !cp.nat) cp.nat = 'inside';
        ajouts.push(`NAT PAT vers ${sortie.monPort}`);
      }
    }
  }
  if (fam === 'hote') {
    const lien = liens.find((x) => x.monAdr);
    if (!c.hote.adresse && (lien?.monAdr || cidr(n.note))) { c.hote.adresse = (lien?.monAdr || n.note).trim(); ajouts.push(`adresse ${c.hote.adresse}`); }
    if (c.hote.adresse && !c.hote.passerelle) {
      const gw = passerelleProposee(schema, c.hote.adresse, n.id);
      if (gw) { c.hote.passerelle = gw; ajouts.push(`passerelle ${gw}`); }
    }
  }
  return { config: normaliserConfig(c), ajouts };
}

/**
 * Adresses d'un nœud qui peuvent servir de passerelle : ports, sous-interfaces,
 * SVI et IP virtuelles HSRP de sa configuration, adresses saisies sur ses câbles.
 */
export function adressesPasserelle(schema, noeud) {
  const r = [];
  const c = noeud.config ? normaliserConfig(noeud.config) : null;
  if (c) {
    for (const h of c.hsrp) if (ipSeule(h.ip)) r.push(h.ip.trim());   // l'IP virtuelle passe en premier
    for (const s of c.sousInterfaces) if (cidr(s.adresse)) r.push(s.adresse);
    for (const s of c.svis) if (cidr(s.adresse)) r.push(s.adresse);
    for (const p of Object.values(c.ports)) if (cidr(p.adresse)) r.push(p.adresse);
  }
  for (const l of schema.liens) {
    if (l.de === noeud.id && l.adresseDe) r.push(l.adresseDe);
    if (l.a === noeud.id && l.adresseA) r.push(l.adresseA);
  }
  return r;
}
const TYPES_PASSERELLE = new Set(['routeur', 'commutateur-l3', 'pare-feu']);
/** Passerelle d'une adresse « a.b.c.d/p » : une adresse d'un routeur, d'un cœur ou d'un pare-feu dans le même réseau. */
export function passerelleProposee(schema, adresse, saufId = null) {
  const a = cidr(adresse); if (!a) return '';
  for (const x of schema.noeuds) {
    if (x.id === saufId || !TYPES_PASSERELLE.has(x.type)) continue;
    for (const v of adressesPasserelle(schema, x)) {
      const g = cidr(v) ?? (ipSeule(v) ? cidr(`${v.trim()}/${a.prefixe}`) : null);
      if (g && g.ip !== a.ip && cidr(`${g.ip}/${a.prefixe}`).reseau === a.reseau) return g.ip;
    }
  }
  return '';
}

/* ---------------------------------------------------------------------------
 * Hôtes : configuration IP à saisir (Packet Tracer, Windows, Linux)
 * ------------------------------------------------------------------------ */
export function commandesHote(n, c, { nom = '' } = {}) {
  const a = cidr(c.hote.adresse);
  if (!a) return { blocs: [], avertissements: verifierConfig(n, c).concat(c.hote.adresse ? [] : ['Indique l’adresse du poste (ex. 192.168.10.10/24).']) };
  const dns = c.hote.dns.split(/[,;\s]+/).filter(Boolean);
  const blocs = [
    { titre: 'Packet Tracer (Desktop > IP Configuration)', lignes: [`IPv4 Address : ${a.ip}`, `Subnet Mask : ${a.masque}`, `Default Gateway : ${c.hote.passerelle || '-'}`, `DNS Server : ${dns[0] ?? '-'}`] },
    { titre: 'Windows (PowerShell administrateur)', lignes: [
      `New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress ${a.ip} -PrefixLength ${a.prefixe}${c.hote.passerelle ? ` -DefaultGateway ${c.hote.passerelle}` : ''}`,
      ...(dns.length ? [`Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses ${dns.join(',')}`] : []), 'ipconfig /all'] },
    { titre: 'Linux (NetworkManager)', lignes: [
      `sudo nmcli con mod "Wired connection 1" ipv4.method manual ipv4.addresses ${a.ip}/${a.prefixe}${c.hote.passerelle ? ` ipv4.gateway ${c.hote.passerelle}` : ''}${dns.length ? ` ipv4.dns "${dns.join(' ')}"` : ''}`,
      'sudo nmcli con up "Wired connection 1"', 'ip -br address'] },
  ];
  return { blocs, avertissements: verifierConfig(n, c), nom };
}

/** Commandes d'un nœud selon sa famille (IOS ou hôte). */
export function commandesNoeud(n, c, opts = {}) {
  if (famille(n.type) === 'hote') return commandesHote(n, c, opts);
  return commandesIos(n, c, opts);
}
/** Texte avec un titre de bloc en commentaire (« ! » pour IOS, « # » ailleurs). */
export function texteAvecTitres(n, r) {
  const k = estIos(n.type) ? '!' : '#';
  return r.blocs.map((bl) => [`${k} --- ${ascii(bl.titre)} ---`, ...bl.lignes].join('\n')).join('\n');
}

/* ---------------------------------------------------------------------------
 * Ce que la configuration apporte à la fiche d'inventaire et au plan d'adressage
 * ------------------------------------------------------------------------ */
/** Interfaces { nom, adresse, vlan, etat, description } décrites par la configuration. */
export function interfacesDepuisConfig(n, c) {
  const r = [];
  const fam = famille(n.type);
  for (const [p, cp] of Object.entries(c.ports)) {
    if (!cp.mode && !cp.adresse && !cp.description) continue;
    const vlan = cp.mode === 'access' ? cp.vlan : cp.mode === 'trunk' ? `trunk${cp.autorises ? ` ${cp.autorises}` : ''}` : '';
    r.push({ nom: p, adresse: cidr(cp.adresse) && (fam === 'routeur' || cp.mode === 'routed') ? cp.adresse : '', vlan, etat: cp.eteint ? 'shutdown' : '', description: cp.description });
  }
  for (const s of c.sousInterfaces) r.push({ nom: `${s.port}.${s.vlan}`, adresse: cidr(s.adresse) ? s.adresse : '', vlan: s.vlan, etat: '', description: `Passerelle du VLAN ${s.vlan}` });
  for (const k of c.canaux) r.push({ nom: `Port-channel${k.groupe}`, adresse: '', vlan: k.usage === 'trunk' ? `trunk${k.autorises ? ` ${k.autorises}` : ''}` : k.vlan, etat: '', description: `EtherChannel ${k.protocole.toUpperCase()} (${k.ports.join(', ')})` });
  if (fam !== 'routeur' && c.gestion.vlan && cidr(c.gestion.adresse)) r.push({ nom: `Vlan${c.gestion.vlan}`, adresse: c.gestion.adresse, vlan: c.gestion.vlan, etat: '', description: 'Gestion' });
  for (const s of c.svis) if (!(c.gestion.vlan === s.vlan && cidr(c.gestion.adresse))) r.push({ nom: `Vlan${s.vlan}`, adresse: cidr(s.adresse) ? s.adresse : '', vlan: s.vlan, etat: '', description: `Passerelle du VLAN ${s.vlan}` });
  if (fam === 'hote' && cidr(c.hote.adresse)) r.push({ nom: 'Carte réseau', adresse: c.hote.adresse, vlan: '', etat: '', description: c.hote.passerelle ? `Passerelle ${c.hote.passerelle}` : '' });
  return r;
}
/** Adresses pour le plan d'adressage : [{ interface, adresse, vlan, passerelle }]. */
export function adressesDepuisConfig(n, c) {
  const fam = famille(n.type);
  if (fam === 'hote') return cidr(c.hote.adresse) ? [{ interface: '', adresse: c.hote.adresse, vlan: '', passerelle: c.hote.passerelle }] : [];
  return interfacesDepuisConfig(n, c).filter((i) => i.adresse)
    .map((i) => ({ interface: i.nom, adresse: i.adresse, vlan: /^\d+$/.test(i.vlan) ? `VLAN ${i.vlan}` : '', passerelle: i.description === 'Gestion' ? c.gestion.passerelle : '' }));
}
/** Table de routage attendue : réseaux connectés (C), routes statiques (S), réseaux annoncés en OSPF. */
export function routesDepuisConfig(n, c) {
  const r = [];
  const fam = famille(n.type);
  if (fam === 'hote') {
    if (c.hote.passerelle) r.push({ type: 'défaut', destination: '0.0.0.0/0', via: c.hote.passerelle, interface: '', pourquoi: 'Passerelle du poste' });
    return r;
  }
  if (fam === 'commutateur') {
    if (c.gestion.passerelle) r.push({ type: 'défaut', destination: '0.0.0.0/0', via: c.gestion.passerelle, interface: '', pourquoi: 'ip default-gateway (gestion à distance)' });
    return r;
  }
  const vus = new Set();
  for (const i of interfacesDepuisConfig(n, c)) {
    const a = cidr(i.adresse); if (!a) continue;
    const dest = `${a.reseau}/${a.prefixe}`; if (vus.has(dest)) continue; vus.add(dest);
    r.push({ type: 'C', destination: dest, via: 'connecté', interface: i.nom, pourquoi: i.description || 'Réseau directement connecté' });
  }
  for (const s of c.statiques) {
    const a = cidr(s.reseau); if (!a || !s.saut) continue;
    const defaut = a.prefixe === 0;
    r.push({ type: defaut ? 'S*' : 'S', destination: `${a.reseau}/${a.prefixe}`, via: ipSeule(s.saut) ? s.saut : '', interface: ipSeule(s.saut) ? '' : s.saut, pourquoi: defaut ? 'Route par défaut' : 'Route statique' });
  }
  for (const o of c.ospf.reseaux) {
    const a = cidr(o.reseau); if (!a) continue;
    r.push({ type: 'OSPF', destination: `${a.reseau}/${a.prefixe}`, via: '', interface: '', pourquoi: `Annoncé en OSPF (zone ${o.zone})` });
  }
  return r;
}
/** VLAN { numero, nom, ports, reseau } avec les ports d'accès de chacun. */
export function vlansDepuisConfig(n, c, zones = []) {
  return c.vlans.map((v) => {
    const ports = Object.entries(c.ports).filter(([, p]) => p.mode === 'access' && p.vlan === v.id).map(([p]) => p);
    const z = zones.map(lireZone).find((x) => x && x.vlan === v.id);
    return { numero: v.id, nom: v.nom, ports: ports.join(', '), reseau: z?.reseau ?? '' };
  });
}

/** Commandes de vérification utiles selon ce qui est configuré (pour la section Validation). */
export function testsProposes(n, c, nom) {
  const tsts = [];
  const fam = famille(n.type);
  const T = (test, attendu) => tsts.push({ test: `${nom} : ${test}`, attendu, resultat: 'a-tester' });
  if (fam === 'hote') {
    const gw = c.hote.passerelle;
    if (gw) T(`ping ${gw}`, 'Réponses de la passerelle');
    return tsts;
  }
  if (!estIos(n.type)) return tsts;
  if (c.vlans.length) T('show vlan brief', `VLAN ${c.vlans.map((v) => v.id).join(', ')} actifs, ports d’accès dans le bon VLAN`);
  if (Object.values(c.ports).some((p) => p.mode === 'trunk') || c.canaux.some((k) => k.usage === 'trunk')) T('show interfaces trunk', 'Trunks actifs, VLAN autorisés attendus');
  if (c.canaux.length) T('show etherchannel summary', `Port-channel ${c.canaux.map((k) => k.groupe).join(', ')} en (SU) ou (RU), ports en (P)`);
  if (c.stp.mode || c.stp.primaire) T('show spanning-tree summary', `Mode ${c.stp.mode || 'pvst'}${c.stp.primaire ? `, racine des VLAN ${c.stp.primaire}` : ''}`);
  if (c.sousInterfaces.length || c.svis.length || Object.values(c.ports).some((p) => p.adresse)) T('show ip interface brief', 'Interfaces adressées up/up');
  if (c.statiques.length || c.ospf.reseaux.length || c.sousInterfaces.length || c.svis.length) T('show ip route', `Réseaux connectés${c.statiques.length ? ', routes S' : ''}${c.ospf.reseaux.length ? ', routes O' : ''}`);
  if (c.ospf.reseaux.length) T('show ip ospf neighbor', 'Voisins en état FULL');
  if (c.hsrp.length) T('show standby brief', 'Routeur actif et en attente attendus');
  if (c.dhcp.pools.length) T('show ip dhcp binding', 'Baux attribués aux postes');
  if (c.nat.sortie) T('show ip nat translations', 'Traductions des réseaux internes');
  if (c.ssh.actif) T('show ip ssh', 'SSH Enabled - version 2.0');
  if (Object.values(c.ports).some((p) => p.securite)) T('show port-security', 'Ports sécurisés, aucune violation');
  return tsts;
}
