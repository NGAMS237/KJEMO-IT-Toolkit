/**
 * cours-fiches-cisco.mjs — KJEMO-CISCO-S07-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiches Cisco IOS tirées du cours de la semaine 7 (« Architecture réseau II —
 * EtherChannel », chapitre 6 de CCNA 2 v7) et des six exercices Packet Tracer
 * du formatif 07 : EtherChannel (PAgP, LACP, statique), vérification,
 * dépannage, puis Spanning Tree (PVST+, Rapid PVST+, ponts racines, PortFast).
 *
 * Rédigées à la main, dans nos mots : ni les diapositives, ni les énoncés ne
 * sont republiés. Chaque fiche porte, au besoin, des SCHÉMAS ORIGINAUX
 * (`figures`, voir schemas-cisco.mjs) et un RAPPEL DE COURS pliable (`rappel`).
 * Les commandes affichées ne sont jamais exécutées par le Toolkit : elles se
 * collent dans la console d'un commutateur de laboratoire (Packet Tracer ou
 * matériel), après lecture.
 */
import { V_COURS } from './cours-outils.mjs';

const C2960 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960';
const SRC_EC = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring EtherChannels', url: `${C2960}/swethchl.html` };
const SRC_EC_NOTE = { label: 'Cisco — EtherChannel entre Catalyst (exemple de configuration)', url: 'https://www.cisco.com/c/en/us/support/docs/lan-switching/etherchannel/12033-89.html' };
const SRC_STP = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring STP', url: `${C2960}/swstp.html` };
const SRC_RSTP = { label: 'Cisco — Understand Rapid Spanning Tree Protocol (802.1w)', url: 'https://www.cisco.com/c/en/us/support/docs/lan-switching/spanning-tree-protocol/24062-146.html' };
const SRC_PORTFAST = { label: 'Cisco — Spanning Tree PortFast BPDU Guard Enhancement', url: 'https://www.cisco.com/c/en/us/support/docs/lan-switching/spanning-tree-protocol/10586-65.html' };

const CATEGORIE = 'Réseau et Cisco';
const V_CISCO = `${V_COURS} Les sorties montrées sont des exemples écrits pour expliquer, pas des captures d’équipement.`;

// Lignes IOS : l'invite s'affiche à côté, elle n'est jamais copiée.
const priv = (cmd) => ({ invite: 'Switch#', cmd });
const cfg = (cmd) => ({ invite: 'Switch(config)#', cmd });
const rng = (cmd) => ({ invite: 'Switch(config-if-range)#', cmd });
const itf = (cmd) => ({ invite: 'Switch(config-if)#', cmd });

const etape = (effet) => (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');

const PORT_A = { id: 'portA', label: 'premier port du canal', type: 'interfaceIos', exemple: 'Fa0/21', distinctDe: ['portB'], aide: 'Un port du commutateur (Fa0/21, Gi0/1…). Les deux ports doivent être du même type.' };
const PORT_B = { id: 'portB', label: 'deuxième port du canal', type: 'interfaceIos', exemple: 'Fa0/22', distinctDe: ['portA'], aide: 'Un AUTRE port, du même type et de la même vitesse que le premier.' };
const GROUPE = { id: 'groupe', label: 'numéro du groupe (channel-group)', type: 'entier', min: 1, max: 6, exemple: '1', aide: 'De 1 à 6 sur un 2960. Ce numéro est LOCAL à chaque commutateur : il peut différer d’un bout à l’autre, mais mieux vaut le garder identique.' };

const DEPANNAGE_CANAL = [
  { symptome: 'Po1(SD) dans show etherchannel summary, ports marqués (I)', cause: 'Les deux bouts ne s’entendent pas : modes incompatibles (auto-auto, passive-passive), PAgP d’un côté et LACP de l’autre, ou « on » face à un mode négocié.', action: 'Lis la configuration des deux bouts, puis éteins les ports, retire le groupe (no channel-group), remets un mode compatible et rallume.' },
  { symptome: 'Un port est suspendu (s) ou le canal ne se forme pas, bien que les modes concordent', cause: 'Les ports ne sont pas réglés pareil : accès d’un côté et trunk de l’autre, VLAN autorisés ou VLAN natif différents, vitesse ou duplex différents.', action: 'Compare « show interfaces trunk » des deux bouts et mets tous les ports du canal dans le même mode.' },
  { symptome: 'Le canal est actif, mais un lien reste à plat', cause: 'Un port a été affecté au mauvais groupe, ou un port du tableau manque.', action: 'Reprends le tableau des groupes et compare-le à « show etherchannel summary » sur chaque commutateur.' },
];

/** Fiche IOS (une seule méthode « ios »). */
function ficheIos({ id, titre, resume, effet, intentions, motsCles, params = [], privileges, etapes, verification, retour = null, depannage = null, sources, figures = [], rappel = null }) {
  return {
    id,
    titre,
    categorie: CATEGORIE,
    resume,
    effet,
    intentions,
    motsCles,
    params,
    methodes: [{ id: 'ios', privileges, etapes, verification, retour, ...(depannage ? { depannage } : {}) }],
    assistant: null,
    sources,
    validation: V_CISCO,
    origine: 'cours',
    ...(figures.length ? { figures } : {}),
    ...(rappel ? { rappel } : {}),
  };
}

const TROIS_ETAPES_CANAL = (mode) => [
  mod('Régler les ports en trunk et les éteindre', 'Les ports du canal doivent être réglés pareil. On les éteint d’abord (shutdown) pour que la protection du commutateur ne les mette pas en erreur pendant que tu tapes la suite. À faire sur les DEUX commutateurs.',
    [cfg('interface range {{portA}} , {{portB}}'), rng('switchport mode trunk'), rng('shutdown')],
    'Aucun message : les ports sont éteints.',
    { important: 'Le mode trunk statique évite que DTP laisse un port en accès. Ne mélange jamais un port en accès et un port en trunk dans le même canal.' }),
  mod('Mettre les ports dans le groupe', `channel-group crée l’interface logique (le port-channel) si elle n’existe pas et y range les ports. Mode « ${mode} » : voir le tableau des modes du schéma.`,
    [rng(`channel-group {{groupe}} mode {{mode}}`)],
    'Le message « Creating a port-channel interface Port-channel N » s’affiche.',
    { options: [{ option: 'channel-group N', explication: 'Range les ports dans le groupe N et crée l’interface Port-channel N.' }, { option: 'mode', explication: 'Façon de négocier avec l’autre bout (desirable/auto pour PAgP ; active/passive pour LACP ; on pour aucun protocole).' }] }),
  mod('Rallumer les ports', 'no shutdown rend les ports à la vie : le canal peut se négocier.',
    [rng('no shutdown')], 'Aucun message, puis les voyants des liens repassent au vert.'),
  mod('Régler l’interface du port-channel', 'Tout réglage de couche 2 fait ici s’applique à TOUS les ports du canal. On y met le trunk (et, si besoin, les VLAN autorisés ou le VLAN natif).',
    [cfg('interface port-channel {{groupe}}'), itf('switchport mode trunk')],
    'Aucun message en cas de succès.'),
  lec('Vérifier le canal', 'Une ligne par canal : « Po » suivi de lettres entre parenthèses pour l’état du canal, puis les ports membres avec leur état.',
    [priv('show etherchannel summary'), priv('show interfaces trunk')],
    'Po1(SU) : S = couche 2, U = en service ; chaque port membre est marqué (P). Le trunk liste le port-channel et non plus les ports seuls.',
    { important: 'Si le canal n’apparaît pas, éteins puis rallume les ports aux deux bouts (shutdown, no shutdown), puis relis.' }),
];

export const COURS_CISCO = [
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ec-avant-de-grouper',
    titre: 'Vérifier les ports avant de former un EtherChannel',
    resume: 'Lit l’état, la vitesse, le duplex et le mode (accès ou trunk) des ports qui vont former le canal. Lecture seule ; c’est le premier geste, car un seul port réglé autrement empêche le canal.',
    effet: 'lecture',
    intentions: ['vérifier les ports avant etherchannel', 'ports trunk avant port-channel', 'préparer un etherchannel', 'ports compatibles etherchannel'],
    motsCles: ['etherchannel', 'port-channel', 'trunk', 'vitesse', 'duplex', 'cisco', 'ports'],
    params: [{ id: 'interface', label: 'port à examiner', type: 'interfaceIos', exemple: 'Fa0/21', aide: 'Un port du futur canal (Fa0/21, Gi0/1…).' }],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Voir la vitesse, le duplex et l’état de tous les ports', 'Une ligne par port : état, VLAN (ou « trunk »), duplex et vitesse. Les ports du futur canal doivent avoir les mêmes.', [priv('show interfaces status')], 'Colonnes Status, Vlan, Duplex, Speed. Les ports du canal affichent le même duplex et la même vitesse.'),
      lec('Voir les ports en trunk', 'Montre le mode, le VLAN natif et les VLAN autorisés de chaque trunk.', [priv('show interfaces trunk')], 'Les ports prévus sont en « trunking », avec le MÊME VLAN natif et les mêmes VLAN autorisés.'),
      lec('Voir le mode d’un port précis', 'Lit le mode administratif (static access, trunk, dynamic…) d’un port.', [priv('show interfaces {{interface}} switchport')], '« Administrative Mode: trunk » et « Operational Mode: trunk » pour un port de canal en trunk.'),
    ],
    verification: ['Tous les ports du futur canal ont le même type, la même vitesse, le même duplex, le même mode et les mêmes VLAN.'],
    sources: [SRC_EC],
    figures: ['ec-regles'],
    rappel: { titre: 'Rappel : ce qui doit concorder', points: ['Même type de port (Fast Ethernet et Gigabit ne se mélangent pas), même vitesse, même duplex.', 'Tous en accès dans le même VLAN, ou tous en trunk avec le même VLAN natif et les mêmes VLAN autorisés.', 'Au plus huit ports par canal.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ec-pagp',
    titre: 'Créer un EtherChannel PAgP (Cisco) entre deux commutateurs',
    resume: 'Regroupe deux ports en un canal logique négocié avec PAgP, le protocole propre à Cisco. À faire sur les deux commutateurs, avec desirable d’un côté au moins.',
    effet: 'modification',
    intentions: ['etherchannel pagp', 'channel-group desirable', 'regrouper deux liens cisco', 'agrégation de liens pagp', 'port-channel pagp', 'channel-group mode auto', 'formatif 6.2.4 pagp'],
    motsCles: ['etherchannel', 'pagp', 'desirable', 'auto', 'channel-group', 'port-channel', 'trunk', 'cisco', 'interface range'],
    params: [PORT_A, PORT_B, GROUPE,
      { id: 'mode', label: 'mode PAgP de ce commutateur', type: 'choix', choix: ['desirable', 'auto'], exemple: 'desirable', aide: 'desirable propose le canal ; auto attend la proposition. Deux côtés « auto » ne forment rien.' }],
    privileges: 'Mode de configuration globale (enable puis configure terminal).',
    etapes: TROIS_ETAPES_CANAL('PAgP'),
    verification: ['show etherchannel summary affiche PoN(SU) avec le protocole PAgP et les deux ports marqués (P), sur les deux commutateurs.'],
    retour: 'Pour défaire : éteins les ports (shutdown), « no channel-group » sur les ports, « no interface port-channel N » en configuration globale, puis rallume.',
    depannage: DEPANNAGE_CANAL,
    sources: [SRC_EC, SRC_EC_NOTE],
    figures: ['ec-faisceau', 'ec-ordre', 'ec-modes'],
    rappel: { titre: 'Rappel : PAgP', points: ['PAgP est propriétaire Cisco ; il envoie des paquets toutes les 30 secondes pour négocier le canal et surveiller sa cohérence.', 'desirable propose activement, auto répond seulement, on force le canal sans protocole.', 'desirable-desirable et desirable-auto forment un canal ; auto-auto ne forme rien.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ec-lacp',
    titre: 'Créer un EtherChannel LACP (802.3ad) entre deux commutateurs',
    resume: 'Regroupe deux ports en un canal logique négocié avec LACP, la norme IEEE qui fonctionne aussi entre fabricants. À faire sur les deux commutateurs, avec active d’un côté au moins.',
    effet: 'modification',
    intentions: ['etherchannel lacp', 'channel-group active', 'lacp 802.3ad', 'agrégation de liens lacp', 'port-channel lacp', 'channel-group mode passive', 'formatif 6.2.4 lacp'],
    motsCles: ['etherchannel', 'lacp', 'active', 'passive', '802.3ad', 'channel-group', 'port-channel', 'trunk', 'cisco'],
    params: [PORT_A, PORT_B, GROUPE,
      { id: 'mode', label: 'mode LACP de ce commutateur', type: 'choix', choix: ['active', 'passive'], exemple: 'active', aide: 'active propose le canal ; passive attend la proposition. Deux côtés « passive » ne forment rien.' }],
    privileges: 'Mode de configuration globale (enable puis configure terminal).',
    etapes: TROIS_ETAPES_CANAL('LACP'),
    verification: ['show etherchannel summary affiche PoN(SU) avec le protocole LACP et les deux ports marqués (P), sur les deux commutateurs.'],
    retour: 'Pour défaire : éteins les ports (shutdown), « no channel-group » sur les ports, « no interface port-channel N » en configuration globale, puis rallume.',
    depannage: DEPANNAGE_CANAL,
    sources: [SRC_EC],
    figures: ['ec-faisceau', 'ec-modes'],
    rappel: { titre: 'Rappel : LACP', points: ['LACP est la norme IEEE 802.3ad : elle sert aussi avec du matériel d’autres fabricants. Les commutateurs Cisco gèrent PAgP et LACP.', 'active propose activement, passive répond seulement, on force le canal sans protocole.', 'active-active et active-passive forment un canal ; passive-passive ne forme rien.', 'Dans un même canal, les deux bouts utilisent le MÊME protocole : jamais PAgP face à LACP.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ec-statique',
    titre: 'Créer un EtherChannel statique (mode on, sans protocole)',
    resume: 'Force le regroupement de deux ports sans PAgP ni LACP. Les deux bouts doivent être en « on » ; rien ne vérifie la cohérence, donc une erreur de câblage ou de réglage passe inaperçue.',
    effet: 'modification',
    intentions: ['etherchannel statique', 'channel-group mode on', 'port-channel sans protocole', 'etherchannel inconditionnel', 'canal forcé'],
    motsCles: ['etherchannel', 'statique', 'on', 'channel-group', 'port-channel', 'sans protocole', 'cisco'],
    params: [PORT_A, PORT_B, GROUPE],
    privileges: 'Mode de configuration globale (enable puis configure terminal).',
    etapes: TROIS_ETAPES_CANAL('on').map((e) => ({ ...e, lignes: (e.lignes ?? []).map((l) => ({ ...l, cmd: l.cmd.replace('mode {{mode}}', 'mode on') })) })),
    verification: ['show etherchannel summary affiche PoN(SU) avec le protocole « - » (aucun) et les ports marqués (P), sur les deux commutateurs.'],
    retour: 'Pour défaire : éteins les ports (shutdown), « no channel-group » sur les ports, « no interface port-channel N », puis rallume.',
    depannage: [{ symptome: 'Boucle ou ports en erreur après avoir activé le mode on d’un seul côté', cause: 'Sans protocole, un bout croit à un canal tandis que l’autre voit deux liens séparés : Spanning Tree détecte une boucle.', action: 'Éteins les ports des deux bouts, mets « on » des DEUX côtés (ou passe en desirable/active), puis rallume.' }],
    sources: [SRC_EC, SRC_EC_NOTE],
    figures: ['ec-modes'],
    rappel: { titre: 'Rappel : mode on', points: ['« on » force le canal : aucun paquet de négociation n’est échangé.', '« on » ne s’associe qu’à « on » : face à un mode négocié, rien ne se forme.', 'Préfère un mode négocié (desirable ou active) : il détecte les erreurs de configuration.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ec-verifier',
    titre: 'Vérifier un EtherChannel : show etherchannel et port-channel',
    resume: 'Quatre lectures pour contrôler un canal : le résumé de tous les canaux, l’état de l’interface logique, le détail d’un canal et le rôle d’un port membre. Lecture seule.',
    effet: 'lecture',
    intentions: ['show etherchannel summary', 'vérifier etherchannel', 'état du port-channel', 'show interfaces port-channel', 'show etherchannel port-channel', 'show interfaces etherchannel', 'lire les lettres SU P I D'],
    motsCles: ['etherchannel', 'summary', 'port-channel', 'SU', 'show etherchannel', 'show interfaces', 'cisco', 'vérifier'],
    params: [
      GROUPE,
      { id: 'interface', label: 'port membre à examiner', type: 'interfaceIos', exemple: 'Fa0/1', aide: 'Un des ports du canal (Fa0/1, Gi0/1…).' },
    ],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Résumé de tous les canaux', 'Une ligne par canal : numéro, interface logique avec ses lettres d’état, protocole et ports membres avec les leurs.', [priv('show etherchannel summary')], 'Po1(SU) et les ports (P) : le canal fonctionne. Po1(SD) et les ports (I) : il est en panne.', { important: 'Lettres du canal : S couche 2, U en service, D en panne. Lettres d’un port : P dans le canal, I isolé, s suspendu, w en attente, D down.' }),
      lec('État de l’interface logique', 'Lit l’interface Port-channel comme n’importe quelle interface : état, débit total, duplex.', [priv('show interfaces port-channel {{groupe}}')], '« Port-channel1 is up, line protocol is up » et un débit égal à la somme des liens.'),
      lec('Détail d’un canal', 'Donne, pour chaque canal, ses ports, son protocole et son compteur de ports actifs.', [priv('show etherchannel port-channel')], 'Le groupe, le protocole (PAgP ou LACP) et la liste des ports avec leur état.'),
      lec('Rôle d’un port membre', 'Sur un port du canal, indique son état dans le groupe et le mode négocié.', [priv('show interfaces {{interface}} etherchannel')], 'Le port est « Port state = Up Mstr In-Bndl » quand il fait partie du faisceau.'),
      lec('Voir ce que Spanning Tree en pense', 'Le canal compte pour UN seul lien : STP ne liste que le port-channel, pas ses ports.', [priv('show spanning-tree active')], 'L’interface « Po1 » apparaît à la place des deux ports physiques.'),
    ],
    verification: ['Le canal est Po(SU), chaque port membre est (P), et Spanning Tree voit un seul lien.'],
    sources: [SRC_EC],
    figures: ['ec-sommaire'],
    rappel: { titre: 'Rappel : lire le résumé', points: ['Le résumé (show etherchannel summary) est la première commande à lancer, avant de chercher une cause.', '(SU) pour le canal et (P) pour les ports : tout va bien.', '(SD) et (I) : le canal ne s’est pas formé ; passe à la fiche « Dépanner un EtherChannel ».'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ec-depanner',
    titre: 'Dépanner un EtherChannel qui ne se forme pas',
    resume: 'Lit l’état du canal et la configuration, puis corrige les ports : mode incompatible, port en accès ou groupe erroné. Les corrections éteignent brièvement les ports du canal.',
    effet: 'modification',
    intentions: ['dépanner etherchannel', 'etherchannel ne fonctionne pas', 'port-channel down', 'Po1 SD', 'modes pagp incompatibles', 'corriger channel-group', 'formatif 6.3.4 dépannage'],
    motsCles: ['etherchannel', 'dépannage', 'port-channel', 'channel-group', 'incompatible', 'SD', 'pagp', 'lacp', 'cisco', 'trunk'],
    params: [PORT_A, PORT_B, GROUPE,
      { id: 'mode', label: 'mode correct à remettre', type: 'choix', choix: ['desirable', 'auto', 'active', 'passive', 'on'], exemple: 'desirable', aide: 'Un mode du MÊME protocole que l’autre bout et compatible avec le sien (voir le schéma des modes).' }],
    privileges: 'Mode privilégié (enable) pour lire ; configuration globale pour corriger.',
    etapes: [
      lec('Lire l’état du canal', 'Premier réflexe : le résumé dit si le canal est en service (SU) ou en panne (SD), et si les ports sont dans le canal (P) ou isolés (I).', [priv('show etherchannel summary')], 'Un canal en panne : Po1(SD) et ports (I).'),
      lec('Lire la configuration des interfaces logiques', 'Montre, pour chaque port-channel, le mode du trunk, les VLAN autorisés et le VLAN natif. Fais la même lecture sur l’AUTRE commutateur et compare.', [priv('show run | begin interface Port-channel')], 'La section « interface Port-channel » avec ses lignes switchport. Cherche tout écart entre les deux bouts.'),
      lec('Lire la configuration des ports du canal', 'Chaque port doit porter le même channel-group, le même mode et le même réglage de trunk. Le mode (desirable, auto, active…) se lit sur la ligne « channel-group ».', [priv('show interfaces {{portA}} switchport'), priv('show interfaces trunk')], 'Les deux ports ont le même mode administratif et les mêmes VLAN autorisés.'),
      mod('Éteindre les ports du canal', 'On éteint avant de corriger, pour ne pas laisser un état à moitié formé.', [cfg('interface range {{portA}} , {{portB}}'), rng('shutdown')], 'Aucun message : les ports sont éteints.'),
      mod('Retirer l’ancien groupe puis remettre le bon', 'no channel-group enlève les ports de leur groupe actuel ; channel-group les remet avec le mode voulu. Remets aussi le même trunk sur les ports si un port était en accès.', [rng('no channel-group'), rng('switchport mode trunk'), rng('channel-group {{groupe}} mode {{mode}}')], 'Le message « Creating a port-channel interface Port-channel N » peut s’afficher.', { important: 'Cette correction se fait sur le commutateur fautif ; fais la même lecture à l’autre bout pour savoir lequel est fautif.' }),
      mod('Rallumer les ports', 'Les ports renégocient le canal avec leur voisin.', [rng('no shutdown')], 'Les voyants repassent au vert.'),
      lec('Contrôler que le canal est en service', 'Même commande qu’à l’étape 1.', [priv('show etherchannel summary')], 'Po(SU) avec ports (P) ; sinon recommence par l’étape 2 sur l’autre commutateur.'),
    ],
    verification: ['show etherchannel summary affiche PoN(SU) avec les ports (P) sur les deux commutateurs.'],
    retour: 'Si tu as mis un mauvais mode, refais les étapes 4 à 6 avec le bon.',
    depannage: DEPANNAGE_CANAL,
    sources: [SRC_EC, SRC_EC_NOTE],
    figures: ['ec-depannage', 'ec-modes'],
    rappel: { titre: 'Rappel : quatre causes courantes', points: ['Ports en accès ou en trunk selon les ports : tous doivent être pareils.', 'VLAN autorisés différents ou VLAN natif différent entre les ports.', 'Modes de négociation incompatibles (auto-auto, passive-passive, PAgP face à LACP).', 'Mauvais port ou mauvais numéro de groupe : compare au tableau du travail.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-stp-lire',
    titre: 'Lire l’état de Spanning Tree et retrouver le chemin actif',
    resume: 'Affiche la racine, le rôle et l’état de chaque port, par VLAN. Lecture seule ; utile pour comprendre quel lien est bloqué et par où passent les trames.',
    effet: 'lecture',
    intentions: ['show spanning-tree', 'quel port est bloqué', 'pont racine stp', 'lire spanning tree', 'chemin sans boucle', 'convergence stp', 'formatif 3.1.1.5 redondance'],
    motsCles: ['spanning-tree', 'stp', 'racine', 'bloqué', 'forwarding', 'blocking', 'show spanning-tree', 'cisco'],
    params: [{ id: 'vlan', label: 'VLAN à examiner', type: 'vlan', exemple: '10', aide: 'Un seul VLAN (PVST+ calcule un arbre par VLAN).' }],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Voir tous les arbres', 'Pour chaque VLAN : l’identité de la racine, l’identité de ce commutateur, puis une ligne par port avec son rôle et son état.', [priv('show spanning-tree')], 'Root ID (la racine), Bridge ID (ce commutateur) et, par port, un rôle (Root, Desg, Altn) et un état (FWD, BLK).'),
      lec('Voir un seul VLAN', 'Limite la lecture à l’arbre d’un VLAN.', [priv('show spanning-tree vlan {{vlan}}')], '« This bridge is the root » si ce commutateur est la racine de ce VLAN.'),
      lec('Voir les ports actifs seulement', 'Ne liste que les ports qui transmettent ; un canal apparaît comme un seul port « Po ».', [priv('show spanning-tree active')], 'Les ports en FWD ; les ports bloqués (BLK) n’y sont pas.'),
      lec('Résumé des modes et des racines', 'Dit le mode STP (pvst, rapid-pvst), et pour chaque VLAN s’il y a des ports bloqués.', [priv('show spanning-tree summary')], 'Une ligne « Switch is in … mode » puis un tableau par VLAN.'),
    ],
    verification: ['Tu sais dire quelle est la racine, quels ports transmettent et lesquels sont bloqués.'],
    sources: [SRC_STP, SRC_RSTP],
    figures: ['stp-boucle'],
    rappel: { titre: 'Rappel : Spanning Tree', points: ['STP évite les boucles en laissant un seul chemin actif et en bloquant les autres.', 'Il élit une racine (plus petite priorité, puis plus petite adresse MAC) ; chaque autre commutateur choisit son meilleur chemin vers elle.', 'Quand un lien actif tombe, un port bloqué le remplace après la convergence.', 'Un EtherChannel compte pour un seul lien : STP ne le bloque pas.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-stp-racines',
    titre: 'Choisir PVST+ ou Rapid PVST+ et fixer les ponts racines',
    resume: 'Règle le mode de Spanning Tree puis désigne ce commutateur comme racine principale ou secondaire des VLAN choisis, pour répartir les VLAN entre deux racines. Modifie la configuration STP.',
    effet: 'modification',
    intentions: ['spanning-tree mode rapid-pvst', 'root primary', 'root secondary', 'configurer pvst+', 'configurer rapid pvst+', 'répartir la charge stp', 'équilibrage de charge vlan', 'formatif 3.3.1.5 pvst', 'formatif 3.3.2.2 rapid pvst'],
    motsCles: ['spanning-tree', 'pvst', 'rapid-pvst', 'root primary', 'root secondary', 'racine', 'vlan', 'priorité', 'cisco', 'stp'],
    params: [
      { id: 'modeStp', label: 'mode de Spanning Tree', type: 'choix', choix: ['pvst', 'rapid-pvst'], exemple: 'rapid-pvst', aide: 'pvst : l’ancien comportement (convergence lente). rapid-pvst : convergence en quelques secondes (802.1w).' },
      { id: 'role', label: 'rôle de ce commutateur', type: 'choix', choix: ['primary', 'secondary'], exemple: 'primary', aide: 'primary : prend la priorité la plus basse. secondary : prend la relève si la racine principale tombe.' },
      { id: 'vlans', label: 'VLAN concernés (autres que le VLAN 1)', type: 'listeVlans', exemple: '10,30,50,70', aide: 'Séparés par des virgules ; des plages sont admises (10-30). Le VLAN 1 se traite à l’étape suivante.' },
    ],
    privileges: 'Mode de configuration globale (enable puis configure terminal).',
    etapes: [
      mod('Choisir le mode de Spanning Tree', 'À régler sur TOUS les commutateurs du réseau. Rapid PVST+ remplace les anciens délais par une négociation rapide entre ports voisins.', [cfg('spanning-tree mode {{modeStp}}')], 'Aucun message.', { options: [{ option: 'pvst', explication: 'Un arbre par VLAN, convergence lente (ancien 802.1D).' }, { option: 'rapid-pvst', explication: 'Un arbre par VLAN, convergence rapide (802.1w).' }] }),
      mod('Désigner ce commutateur racine de certains VLAN', 'La commande abaisse la priorité de ce commutateur pour qu’il l’emporte dans l’élection. Une racine principale par groupe de VLAN, une secondaire pour la panne.', [cfg('spanning-tree vlan {{vlans}} root {{role}}')], 'Aucun message. Un VLAN absent de la liste garde sa priorité par défaut.', { options: [{ option: 'root primary', explication: 'Met la priorité à 24576 (ou assez bas pour devenir racine).' }, { option: 'root secondary', explication: 'Met la priorité à 28672 : prend la relève si la racine tombe.' }] }),
      mod('Faire de même pour le VLAN 1', 'Le VLAN 1 n’entre pas dans la liste de l’étape précédente.', [cfg('spanning-tree vlan 1 root {{role}}')], 'Aucun message.'),
      lec('Contrôler le résultat', 'Lit le mode et les racines. « This bridge is the root » apparaît pour les VLAN dont ce commutateur est racine.', [priv('show spanning-tree summary'), priv('show spanning-tree')], 'Le mode choisi est affiché ; les VLAN désignés montrent ce commutateur comme racine (ou secondaire).'),
    ],
    verification: ['Le mode est celui voulu sur tous les commutateurs, et chaque VLAN a la racine prévue.'],
    retour: 'Pour revenir à la priorité par défaut d’un VLAN : « no spanning-tree vlan N root » (ou « spanning-tree vlan N priority 32768 »).',
    depannage: [{ symptome: 'Le commutateur n’est pas devenu racine malgré « root primary »', cause: 'Un autre commutateur a une priorité plus basse encore, ou le même VLAN n’existe pas sur ce commutateur.', action: 'Lis « show spanning-tree vlan N » : la ligne Root ID dit qui est racine ; crée le VLAN s’il manque.' }],
    sources: [SRC_STP, SRC_RSTP],
    figures: ['stp-racines', 'stp-boucle'],
    rappel: { titre: 'Rappel : PVST+ et Rapid PVST+', points: ['PVST+ calcule un arbre Spanning Tree par VLAN ; on peut donc avoir une racine différente par VLAN.', 'En répartissant les VLAN entre deux racines, on répartit aussi le trafic entre les liens (équilibrage de charge).', 'Rapid PVST+ (802.1w) converge bien plus vite que PVST+ (802.1D).', 'root primary = priorité la plus basse ; root secondary = remplaçante.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-stp-portfast-bpduguard',
    titre: 'Activer PortFast et la protection BPDU sur un port d’accès',
    resume: 'Fait passer un port d’accès vers un poste directement en transmission (PortFast) et le coupe s’il reçoit un message de commutateur (BPDU guard). Réservé aux ports vers des postes, jamais vers un autre commutateur.',
    effet: 'modification',
    intentions: ['portfast', 'bpduguard', 'bpdu guard', 'spanning-tree portfast', 'protéger un port d’accès', 'port err-disabled bpdu'],
    motsCles: ['portfast', 'bpduguard', 'bpdu', 'spanning-tree', 'port d’accès', 'err-disabled', 'cisco', 'stp'],
    params: [{ id: 'interface', label: 'port d’accès vers un poste', type: 'interfaceIos', exemple: 'Fa0/6', aide: 'Un port qui relie un ORDINATEUR ou une imprimante. À répéter pour chaque port d’accès.' }],
    privileges: 'Mode de configuration globale (enable puis configure terminal).',
    etapes: [
      mod('Vérifier que le port est un port d’accès', 'PortFast saute les états d’écoute et d’apprentissage : sur un lien entre commutateurs, il risquerait de créer une boucle temporaire.', [cfg('interface {{interface}}'), itf('switchport mode access')], 'Aucun message.', { important: 'Applique cette fiche uniquement à un port qui relie un poste. Jamais à un lien entre commutateurs.' }),
      mod('Activer PortFast', 'Le port passe presque tout de suite en transmission, au lieu d’attendre la convergence.', [itf('spanning-tree portfast')], 'Un avertissement rappelle que PortFast ne doit servir que pour un poste.'),
      mod('Activer la protection BPDU', 'Si ce port reçoit un BPDU (message d’un commutateur), il se met en erreur (err-disabled) : un commutateur branché par erreur ne perturbe pas l’arbre.', [itf('spanning-tree bpduguard enable')], 'Aucun message.'),
      lec('Contrôler', 'Montre le mode PortFast et la protection BPDU de ce port.', [priv('show spanning-tree summary'), priv('show spanning-tree interface {{interface}} portfast')], 'PortFast « enabled » pour ce port ; BPDU guard « Enabled » dans le résumé.'),
    ],
    verification: ['Le port est en PortFast avec la protection BPDU, et reste en transmission quand on y branche un poste.'],
    retour: 'Pour défaire : « no spanning-tree portfast » et « no spanning-tree bpduguard enable » sur le port. Pour réactiver un port tombé en err-disabled : « shutdown » puis « no shutdown ».',
    depannage: [{ symptome: 'Le port tombe en err-disabled après avoir branché un appareil', cause: 'L’appareil est un commutateur (ou un poste qui relaie des BPDU) : la protection BPDU a coupé le port, comme prévu.', action: 'Débranche l’appareil, puis « shutdown » et « no shutdown » sur le port. Retire PortFast si ce port doit servir de lien entre commutateurs.' }],
    sources: [SRC_PORTFAST, SRC_STP],
    figures: ['stp-boucle'],
    rappel: { titre: 'Rappel : PortFast et BPDU guard', points: ['PortFast met un port d’accès en transmission presque immédiatement.', 'BPDU guard coupe (err-disabled) un port PortFast qui reçoit un BPDU : il protège les frontières du domaine STP.', 'À réserver aux ports vers des postes, jamais aux liens entre commutateurs.'] },
  }),
];
