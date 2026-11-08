/**
 * cours-fiches-cisco-tp-etherchannel.mjs — CISCO-TP-ETHERCHANNEL-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * UNE fiche « TP complet » À CHAMPS pour le TP Packet Tracer « Configurer EtherChannel » : trois
 * commutateurs (S1, S2, S3) reliés par trois canaux. Canal 1 (S1–S3) en PAgP, canal 2 (S1–S2) en LACP,
 * canal 3 (S2–S3) en LACP « négocié » (un bout passive, l'autre active). Puis Spanning Tree : S1
 * devient racine du VLAN 1 pour que le canal Gigabit ne soit plus bloqué.
 *
 * Les noms, les ports, les numéros de groupe et les modes sont des champs (exemple : S1 / S2 / S3,
 * Fa0/21-22, Gi0/1-2, Fa0/23-24, groupes 1, 2 et 3). Le Toolkit ne présume jamais tes valeurs.
 * Aucun mot de passe n'est en jeu.
 *
 * Cinq phases :  1 noms et état des ports · 2 canal 1 PAgP · 3 canal 2 LACP · 4 canal 3 LACP négocié ·
 *                5 Spanning Tree, vérification finale et enregistrement.
 *
 * Rédigée à la main, dans nos mots. Le Toolkit n'exécute aucune commande : rien n'a été essayé dans
 * Packet Tracer ni sur du matériel réel.
 */
import { V_COURS } from './cours-outils.mjs';

const C2960 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960';
const SRC_EC = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring EtherChannels', url: `${C2960}/swethchl.html` };
const SRC_STP = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring STP', url: `${C2960}/swstp.html` };

const V_TP = `${V_COURS} Les valeurs proposées sont des exemples de laboratoire ; les sorties montrées sont écrites pour expliquer, pas copiées d’un équipement, et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.`;

const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const swu = L('Switch>');
const sw = L('SW#');
const swc = L('SW(config)#');
const swi = L('SW(config-if)#');
const swr = L('SW(config-if-range)#');

const etape = (effet) => (phase, titre, explication, lignes, attendu, extra = {}) => ({ titre, phase, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');

const MOT = { hoteS1: 'nom', hoteS2: 'nom', hoteS3: 'nom', methodeRacine: 'méthode' };
for (const n of [1, 2, 3]) { MOT[`c${n}PortA`] = 'premier-port'; MOT[`c${n}PortB`] = 'deuxième-port'; MOT[`c${n}Groupe`] = 'numéro-groupe'; for (const s of [1, 2, 3]) MOT[`c${n}ModeS${s}`] = 'mode'; }
const forme = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, id) => MOT[id] ?? 'valeur');
const opt = (option, explication) => ({ option: forme(option), explication: forme(explication) });

const P1 = 'Phase 1 — Noms et état des ports';
const P2 = 'Phase 2 — Canal 1 : PAgP entre S1 et S3';
const P3 = 'Phase 3 — Canal 2 : LACP entre S1 et S2';
const P4 = 'Phase 4 — Canal 3 : LACP négocié entre S2 et S3';
const P5 = 'Phase 5 — Spanning Tree, vérification et enregistrement';

const hote = (n) => ({ id: `hoteS${n}`, label: `nom du commutateur S${n}`, type: 'hote', exemple: `S${n}`, aide: `Celui de l’énoncé : S${n}.` });
const canal = (n, a, b, g, cote1, cote2, modes, m1, m2, liaison) => [
  { id: `c${n}PortA`, label: `canal ${n} : premier port`, type: 'interfaceIos', exemple: a, distinctDe: [`c${n}PortB`], aide: `Premier port du canal ${n} (${liaison}). Le même sur les deux commutateurs de ce canal dans l’énoncé.` },
  { id: `c${n}PortB`, label: `canal ${n} : deuxième port`, type: 'interfaceIos', exemple: b, distinctDe: [`c${n}PortA`], aide: 'Un AUTRE port du même type et de la même vitesse.' },
  { id: `c${n}Groupe`, label: `canal ${n} : numéro du groupe (channel-group)`, type: 'entier', min: 1, max: 6, exemple: g, aide: 'De 1 à 6 sur un 2960. Le numéro est local à chaque commutateur ; l’énoncé prend le même aux deux bouts.' },
  { id: `c${n}ModeS${cote1}`, label: `canal ${n} : mode de S${cote1}`, type: 'choix', choix: modes, exemple: m1, aide: modes[0] === 'desirable' ? 'desirable propose (PAgP), auto répond. Deux « auto » ne forment rien.' : 'active propose (LACP), passive répond. Deux « passive » ne forment rien.' },
  { id: `c${n}ModeS${cote2}`, label: `canal ${n} : mode de S${cote2}`, type: 'choix', choix: modes, exemple: m2, aide: 'Doit être compatible avec l’autre bout, du même protocole.' },
];

const PARAMS = [
  hote(1), hote(2), hote(3),
  ...canal(1, 'Fa0/21', 'Fa0/22', '1', 1, 3, ['desirable', 'auto'], 'desirable', 'desirable', 'S1 et S3, PAgP'),
  ...canal(2, 'Gi0/1', 'Gi0/2', '2', 1, 2, ['active', 'passive'], 'active', 'active', 'S1 et S2, LACP'),
  ...canal(3, 'Fa0/23', 'Fa0/24', '3', 2, 3, ['active', 'passive'], 'passive', 'active', 'S2 et S3, LACP négocié'),
  { id: 'methodeRacine', label: 'façon de rendre S1 racine du VLAN 1', type: 'choix', choix: ['root primary', 'priority 24576'], exemple: 'root primary', aide: 'L’énoncé donne les deux : « root primary » ajuste la priorité tout seul ; « priority 24576 » la fixe à la main.' },
];

/** Bloc d'un canal sur un commutateur : trunk statique, extinction, groupe, rallumage, interface logique en trunk. */
const bloc = (n, mode) => [
  swc(`interface range {{c${n}PortA}} , {{c${n}PortB}}`), swr('switchport mode trunk'), swr('shutdown'), swr(`channel-group {{c${n}Groupe}} mode {{c${n}Mode${mode}}}`), swr('no shutdown'),
  swc(`interface port-channel {{c${n}Groupe}}`), swi('switchport mode trunk'), swi('end'),
];
const optBloc = (n, mode) => [
  opt(`interface range {{c${n}PortA}} , {{c${n}PortB}}`, 'Choisit les deux ports du canal d’un coup.'),
  opt('switchport mode trunk', 'Trunk statique : sans lui, DTP peut laisser un port en accès et le canal ne se forme pas.'),
  opt('shutdown', 'Éteint les ports avant de les grouper, pour éviter qu’une protection du commutateur les mette en erreur.'),
  opt(`channel-group {{c${n}Groupe}} mode {{c${n}Mode${mode}}}`, 'Range les ports dans le groupe, crée le port-channel et fixe le mode de négociation.'),
  opt(`interface port-channel {{c${n}Groupe}}`, 'Interface logique du canal : un réglage ici s’applique à tous les ports du canal.'),
];
const EXPL = (n, proto, autre) => `Sur ce commutateur, canal ${n} (${proto}) vers ${autre}. L’ordre compte : trunk statique d’abord, ports éteints, puis le groupe et son mode, puis les ports rallumés, enfin l’interface du port-channel en trunk. Les deux ports, sur les DEUX commutateurs, doivent être réglés pareil (même vitesse, même duplex, même VLAN natif, mêmes VLAN autorisés).`;
const ATT = (n) => `« Creating a port-channel interface Port-channel ${n} » (avec le numéro du groupe) s’affiche à la création du groupe ; aucun message d’erreur.`;
const IMP_ORDRE = 'Fais le canal sur LES DEUX commutateurs avant de vérifier : le canal ne se forme qu’avec l’autre bout. Si rien ne se forme, éteins puis rallume les ports aux deux bouts.';

const ETAPES = [
  // 1 à 3 --------------------------------------------------------------------
  mod(P1, 'S1 : nommer le commutateur',
    'Tu es en console sur S1 : mode privilégié, mode de configuration, puis le nom d’hôte pour reconnaître le commutateur dans les sorties.',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteS1}}')],
    'L’invite prend le nouveau nom dès que la commande est acceptée.'),
  mod(P1, 'S2 : nommer le commutateur', 'Même chose sur S2, dans sa propre console.',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteS2}}')],
    'L’invite prend le nouveau nom dès que la commande est acceptée.'),
  mod(P1, 'S3 : nommer le commutateur', 'Même chose sur S3, dans sa propre console.',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteS3}}')],
    'L’invite prend le nouveau nom dès que la commande est acceptée.'),
  // 4 -----------------------------------------------------------------------
  lec(P1, 'Lire l’état des ports avant de les grouper (S1, S2, S3)',
    'À faire sur chacun des trois commutateurs, avant le moindre canal : les ports qui vont ensemble doivent avoir la même vitesse, le même duplex et le même mode. Les liens entre les commutateurs sont visibles dans la liste.',
    [sw('show interfaces status'), sw('show interfaces trunk')],
    'Une ligne par port avec état, VLAN (ou « trunk »), duplex et vitesse ; les ports des canaux ont les mêmes valeurs deux à deux.',
    { verification: true,
      important: 'Par défaut, un 2960 laisse les ports en DTP « dynamic auto » : sans « switchport mode trunk », ils restent des ports d’accès. « switchport nonegotiate » coupe DTP sur un port, mais n’est pas nécessaire ici.',
      options: [opt('show interfaces status', 'État, VLAN, duplex et vitesse de tous les ports.'), opt('show interfaces trunk', 'Ports en trunk, VLAN natif et VLAN autorisés.')] }),
  // 5 à 7 canal 1 -------------------------------------------------------------
  mod(P2, 'S1 : canal 1 (PAgP) vers S3', EXPL(1, 'PAgP, le protocole Cisco', 'S3'), bloc(1, 'S1'), ATT(1),
    { options: optBloc(1, 'S1'), important: IMP_ORDRE }),
  mod(P2, 'S3 : canal 1 (PAgP) vers S1', EXPL(1, 'PAgP, le protocole Cisco', 'S1'), bloc(1, 'S3'), ATT(1),
    { options: optBloc(1, 'S3'), important: 'desirable–desirable et desirable–auto forment un canal ; auto–auto ne forme rien.' }),
  lec(P2, 'Vérifier le canal 1 (S1 et S3)',
    'Sur S1 puis sur S3 : une ligne par canal avec l’état du port-channel et celui de chaque port. Le trunk doit montrer le port-channel et non plus les ports seuls.',
    [sw('show etherchannel summary'), sw('show interfaces trunk')],
    'Po1(SU), protocole PAgP, ports du canal marqués (P) ; « Port-channel1 » en trunking.',
    { verification: true, options: [opt('show etherchannel summary', 'Canaux, protocole utilisé et état de chaque port (P = dans le canal, I = seul, s = suspendu).')] }),
  // 8 à 10 canal 2 -------------------------------------------------------------
  mod(P3, 'S1 : canal 2 (LACP) vers S2', EXPL(2, 'LACP, la norme 802.3ad', 'S2'), bloc(2, 'S1'), ATT(2),
    { options: optBloc(2, 'S1'), important: 'Prends un numéro de groupe différent de celui déjà utilisé sur ce commutateur.' }),
  mod(P3, 'S2 : canal 2 (LACP) vers S1', EXPL(2, 'LACP, la norme 802.3ad', 'S1'), bloc(2, 'S2'), ATT(2),
    { options: optBloc(2, 'S2'), important: 'active–active et active–passive forment un canal ; passive–passive ne forme rien.' }),
  lec(P3, 'Vérifier le canal 2 (S1 et S2)',
    'Sur S1 puis sur S2 : le résumé doit lister le canal 2 en LACP, en plus du canal 1 sur S1.',
    [sw('show etherchannel summary')],
    'Po2(SU), protocole LACP, ports marqués (P) ; sur S1 le canal 1 est toujours en PAgP.',
    { verification: true }),
  // 11 à 13 canal 3 -------------------------------------------------------------
  mod(P4, 'S2 : canal 3 (LACP, mode de S2) vers S3', EXPL(3, 'LACP négocié', 'S3'), bloc(3, 'S2'), ATT(3),
    { options: optBloc(3, 'S2'), important: 'Un bout « passive » ne propose pas : il attend que l’autre bout, « active », lance la négociation.' }),
  mod(P4, 'S3 : canal 3 (LACP, mode de S3) vers S2', EXPL(3, 'LACP négocié', 'S2'), bloc(3, 'S3'), ATT(3),
    { options: optBloc(3, 'S3'), important: IMP_ORDRE }),
  lec(P4, 'Vérifier le canal 3 (S2 et S3)',
    'Sur S2 puis sur S3 : le canal 3 doit apparaître en LACP, avec les deux ports dans le canal.',
    [sw('show etherchannel summary')],
    'Po3(SU), protocole LACP, ports marqués (P) ; S2 montre aussi le canal 2.',
    { verification: true }),
  // 14 à 17 ---------------------------------------------------------------------
  lec(P5, 'Voir ce que Spanning Tree a bloqué (S1)',
    'Même avec les canaux, Spanning Tree continue de surveiller les boucles. Sur S1, regarde quel canal est racine et lequel est alternatif (bloqué) : sans réglage, ce peut être le canal Gigabit, plus rapide, qui est bloqué.',
    [sw('show spanning-tree active')],
    'Pour le VLAN 1 : un port-channel en rôle « Root » (transmission) et un autre en « Altn » (blocage).',
    { options: [opt('show spanning-tree active', 'Rôle et état des ports actifs, VLAN par VLAN.')] }),
  mod(P5, 'S1 : racine de Spanning Tree pour le VLAN 1',
    'Fais de S1 la racine du VLAN 1 : plus aucun de ses ports ne reste bloqué par rapport à un autre commutateur, et le canal Gigabit repasse en transmission. Une seule des deux façons suffit.',
    [sw('configure terminal'), swc('spanning-tree vlan 1 {{methodeRacine}}'), swc('end')],
    'Aucun message ; STP recalcule l’arbre (quelques secondes).',
    { options: [opt('spanning-tree vlan 1 {{methodeRacine}}', '« root primary » abaisse la priorité sous celle des autres ; « priority 24576 » la fixe à la main.')],
      important: 'Dans Packet Tracer, appuie sur l’avance rapide si le calcul semble long.' }),
  lec(P5, 'Vérifier les canaux et l’arbre (S1, S2, S3)',
    'À faire sur chaque commutateur : tous les canaux sont actifs, et sur S1 plus aucun port-channel n’est bloqué (S1 est racine).',
    [sw('show etherchannel summary'), sw('show spanning-tree active')],
    'Sur S1 : Po1 et Po2 en (SU) ; dans l’arbre, « This bridge is the root » et des ports désignés en transmission (FWD) ; S2 et S3 : leurs deux canaux en (SU).',
    { verification: true }),
  mod(P5, 'Enregistrer la configuration (S1, S2, S3)',
    'À faire sur les trois commutateurs : sinon tout disparaît au redémarrage.',
    [sw('copy running-config startup-config')],
    '« Destination filename [startup-config]? » : Entrée ; puis « Building configuration… [OK] ».',
    { interactions: [{ attend: 'Destination filename [startup-config]?', reponds: 'Entrée (garde le nom proposé).' }],
      options: [opt('copy running-config startup-config', 'Enregistre la configuration courante au démarrage.')] }),
];

export const COURS_CISCO_TP_ETHERCHANNEL = [{
  id: 'cours-tp-etherchannel',
  titre: 'TP complet : EtherChannel PAgP et LACP (S1, S2, S3)',
  categorie: 'Réseau et Cisco',
  resume: 'Le TP « Configurer EtherChannel » en une seule suite, à champs : noms, état des ports, canal 1 en PAgP, canal 2 en LACP, canal 3 en LACP négocié (passive d’un côté, active de l’autre), puis S1 racine du VLAN 1 pour libérer le canal Gigabit.',
  effet: 'modification',
  intentions: ['tp etherchannel', 'tp etherchannel complet', 'configurer etherchannel packet tracer', 'etherchannel pagp lacp trois commutateurs', 'channel-group desirable active passive', 'port-channel trois canaux', 'liaison etherchannel redondante', 'spanning-tree vlan 1 root primary etherchannel'],
  motsCles: ['tp', 'etherchannel', 'pagp', 'lacp', 'desirable', 'auto', 'active', 'passive', 'channel-group', 'port-channel', 'trunk', 'spanning-tree', 'root primary', 'packet tracer', 'cisco', 'ios', 'laboratoire',
    'show etherchannel summary', 'interface range', 'switchport mode trunk'],
  params: PARAMS,
  methodes: [{
    id: 'ios',
    privileges: 'Console de chaque commutateur (S1, S2, S3), mode privilégié (enable) puis configuration globale.',
    etapes: ETAPES,
    verification: [
      '« show etherchannel summary » : S1 liste Po1 (PAgP) et Po2 (LACP) ; S2 liste Po2 et Po3 (LACP) ; S3 liste Po1 (PAgP) et Po3 (LACP) ; tous en (SU) avec les ports en (P).',
      '« show interfaces trunk » : les trunks sont portés par les interfaces Port-channel, avec le même VLAN natif aux deux bouts.',
      '« show spanning-tree active » sur S1 : S1 est racine du VLAN 1 et aucun canal n’est bloqué.',
    ],
    retour: 'Pour défaire un canal : sur chaque commutateur, éteins les ports (shutdown), « no channel-group » sur les ports, « no interface port-channel N » en configuration globale, puis rallume les ports. La racine se retire avec « no spanning-tree vlan 1 root » (ou « … priority »).',
    depannage: [
      { symptome: 'Po(SD) dans show etherchannel summary, ports marqués (I)', cause: 'Les deux bouts ne s’entendent pas : modes incompatibles (auto–auto, passive–passive), PAgP d’un côté et LACP de l’autre, ou canal fait d’un seul côté.', action: 'Compare les modes des deux commutateurs avec le tableau : desirable ou auto pour PAgP, active ou passive pour LACP, un côté au moins qui propose.' },
      { symptome: 'Un port est suspendu (s) ou n’entre pas dans le canal', cause: 'Les ports ne sont pas réglés pareil : accès d’un côté et trunk de l’autre, VLAN natif ou VLAN autorisés différents, vitesse ou duplex différents.', action: '« show interfaces trunk » et « show interfaces status » des deux côtés : mets les ports en « switchport mode trunk » avec les mêmes réglages.' },
      { symptome: 'Message d’erreur ou ports en erreur après channel-group', cause: 'Les ports n’ont pas été éteints avant d’être groupés, ce qui peut les mettre en erreur (EtherChannel Misconfig Guard).', action: 'Éteins les ports aux deux bouts (shutdown), vérifie les réglages, puis no shutdown.' },
      { symptome: 'Le canal est actif mais le trafic passe par un seul lien', cause: 'Spanning Tree a bloqué un canal complet (le Gigabit dans l’exemple) parce que S1 n’est pas racine.', action: 'Fais de S1 la racine du VLAN 1 (« spanning-tree vlan 1 root primary ») et relis « show spanning-tree active ».' },
      { symptome: 'Le canal 3 ne se forme pas', cause: 'Les deux bouts sont en passive : LACP n’est lancé par personne.', action: 'Mets au moins un des deux commutateurs en active.' },
    ],
  }],
  assistant: null,
  sources: [SRC_EC, SRC_STP],
  validation: V_TP,
  origine: 'cours',
  figures: ['tp-ec-topologie', 'tp-ec-propose', 'ec-ordre', 'ec-modes', 'ec-sommaire', 'tp-ec-stp', 'ec-regles', 'tp-ec-topologie-swa', 'tp-ec-correspondance'],
  rappel: { titre: 'Rappel : EtherChannel', points: ['Un EtherChannel regroupe des liens physiques en un lien logique : Spanning Tree le voit comme un seul lien et ne bloque plus les liens du groupe.', 'PAgP (Cisco) : desirable propose, auto répond. LACP (802.3ad, ouvert) : active propose, passive répond. « on » force le canal sans protocole.', 'Les ports d’un canal doivent être réglés pareil : même vitesse, même duplex, même mode, même VLAN natif, mêmes VLAN autorisés.', 'Le numéro de groupe est local à un commutateur ; éteins les ports avant de les grouper, puis rallume-les.'] },
}];
