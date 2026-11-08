/**
 * cours-fiches-cisco-tp-pvst.mjs — CISCO-TP-PVST-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * UNE fiche « TP complet » À CHAMPS pour le TP Packet Tracer « Configuration du protocole PVST+ » :
 * trois commutateurs (S1, S2, S3) reliés par des trunks. Partie 1 : VLAN, ports d'accès, trunks
 * à VLAN natif, adresses de gestion. Partie 2 : PVST+ et équilibrage de charge par racines
 * différentes selon les VLAN. Partie 3 : PortFast et protection BPDU sur les ports des postes.
 *
 * Les noms, les VLAN, les ports et les adresses sont des champs (exemple : S1 / S2 / S3, VLAN 10 à
 * 80 et 99, trunks Fa0/1 à Fa0/4, ports Fa0/6, Fa0/18 et Fa0/11, gestion 172.31.99.0/24) : le
 * Toolkit ne présume jamais tes valeurs. Aucun mot de passe n'est en jeu.
 *
 * Cinq phases :  1 VLAN, ports et trunks (S1, S2, S3) · 2 vérifier et joindre les commutateurs ·
 *                3 PVST+ et racines · 4 PortFast et protection BPDU · 5 vérifier et enregistrer.
 *
 * Rédigée à la main, dans nos mots. Le Toolkit n'exécute aucune commande : rien n'a été essayé dans
 * Packet Tracer ni sur du matériel réel.
 */
import { V_COURS } from './cours-outils.mjs';

const C2960 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960';
const SRC_STP = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring STP', url: `${C2960}/swstp.html` };
const SRC_VLAN = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring VLANs (accès, trunks)', url: `${C2960}/swvlan.html` };
const SRC_OPT = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring Optional Spanning-Tree Features (PortFast, BPDU guard)', url: `${C2960}/swoptsp.html` };

const V_TP = `${V_COURS} Les valeurs proposées sont des exemples de laboratoire ; les sorties montrées sont écrites pour expliquer, pas copiées d’un équipement, et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.`;

const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const swu = L('Switch>');
const sw = L('SW#');
const swc = L('SW(config)#');
const swv = L('SW(config-vlan)#');
const swi = L('SW(config-if)#');
const swr = L('SW(config-if-range)#');

const etape = (effet) => (phase, titre, explication, lignes, attendu, extra = {}) => ({ titre, phase, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');
const MOT = { hoteS1: 'nom', hoteS2: 'nom', hoteS3: 'nom', vlan: 'numéro-vlan', nom: 'nom-vlan', vlanNatif: 'numéro-vlan', vlanGestion: 'numéro-vlan', modeStp: 'mode',
  portS1: 'port', portS2: 'port', portS3: 'port', vlanS1: 'numéro-vlan', vlanS2: 'numéro-vlan', vlanS3: 'numéro-vlan', trunkDebut: 'premier-port', trunkFin: 'dernier-port',
  ipS1: 'adresse', ipS2: 'adresse', ipS3: 'adresse', gestionPrefixeMasque: 'masque', racineS1: 'liste-vlan', racineS2: 'liste-vlan', racineS3: 'liste-vlan' };
const forme = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, id) => MOT[id] ?? 'valeur');
const opt = (option, explication) => ({ option: forme(option), explication: forme(explication) });

const P1 = 'Phase 1 — VLAN, ports d’accès, trunks et gestion (S1, S2, S3)';
const P2 = 'Phase 2 — Vérifier les VLAN et joindre les commutateurs';
const P3 = 'Phase 3 — PVST+ et équilibrage de charge';
const P4 = 'Phase 4 — PortFast et protection BPDU';
const P5 = 'Phase 5 — Vérifier et enregistrer';

const PAR_VLAN = (groupe) => ({ table: 'vlans', groupe });
const COLONNES_VLAN = [
  { id: 'vlan', label: 'VLAN', type: 'vlan', exemple: '10', aide: 'De 2 à 1001 (hors 1002-1005). Créé sur CHAQUE commutateur : ici pas de VTP.' },
  { id: 'nom', label: 'Nom', type: 'nomVlan', exemple: 'VLAN10', aide: 'Une lettre d’abord, sans espace. L’énoncé ne nomme pas les VLAN : le nom est facultatif dans le TP, mais la fiche en demande un.' },
];
const PAR_SW = (n, d, p, v, ip) => [
  { id: `hoteS${n}`, label: `nom du commutateur S${n}`, type: 'hote', exemple: `S${n}`, aide: `Celui de l’énoncé : S${n}.` },
  { id: `portS${n}`, label: `port d’accès de S${n} vers son PC`, type: 'interfaceIos', exemple: p, aide: `Le port de S${n} relié au poste (${p.replace('Fa', 'F')} dans l’énoncé).` },
  { id: `vlanS${n}`, label: `VLAN du port d’accès de S${n}`, type: 'vlan', exemple: v, aide: 'Doit figurer dans le tableau des VLAN.' },
  { id: `ipS${n}`, label: `adresse de gestion de S${n}`, type: 'ipv4', exemple: ip, aide: 'Sur l’interface du VLAN de gestion.' },
];

const PARAMS = [
  ...PAR_SW(1, '', 'Fa0/6', '30', '172.31.99.1'),
  ...PAR_SW(2, '', 'Fa0/18', '20', '172.31.99.2'),
  ...PAR_SW(3, '', 'Fa0/11', '10', '172.31.99.3'),
  { id: 'vlans', label: 'tableau des VLAN (créés sur chaque commutateur)', type: 'table', min: 1, max: 12, colonnes: COLONNES_VLAN, coherence: 'planVlan',
    exemple: [10, 20, 30, 40, 50, 60, 70, 80, 99].map((v) => ({ vlan: String(v), nom: `VLAN${v}` })) },
  { id: 'trunkDebut', label: 'premier port de trunk (identique sur S1, S2, S3)', type: 'interfaceIos', exemple: 'Fa0/1', aide: 'Début de la plage des ports reliant les commutateurs entre eux (F0/1 dans l’énoncé).' },
  { id: 'trunkFin', label: 'dernier port de trunk', type: 'interfaceIos', exemple: 'Fa0/4', aide: 'Fin de la plage (F0/4 dans l’énoncé).' },
  { id: 'vlanNatif', label: 'VLAN natif des trunks', type: 'vlan', exemple: '99', aide: 'Le même aux deux bouts de chaque trunk ; 99 dans l’énoncé. Pas le VLAN 1.' },
  { id: 'vlanGestion', label: 'VLAN de gestion', type: 'vlan', exemple: '99', aide: 'Le VLAN qui porte l’adresse de chaque commutateur (99 dans l’énoncé).' },
  { id: 'gestionPrefixe', label: 'préfixe du réseau de gestion', type: 'prefixe', exemple: '24', aide: '8 à 30 (24 = 255.255.255.0).' },
  { id: 'modeStp', label: 'mode de Spanning Tree', type: 'choix', choix: ['pvst', 'rapid-pvst'], exemple: 'pvst', aide: 'L’énoncé demande PVST+ (« pvst »). « rapid-pvst » converge plus vite.' },
  { id: 'racineS1', label: 'VLAN dont S1 est la racine principale (sans le VLAN 1)', type: 'listeVlans', exemple: '10,30,50,70', aide: 'Séparés par des virgules ; le VLAN 1 est traité à part (il va avec S1 dans l’énoncé).' },
  { id: 'racineS3', label: 'VLAN dont S3 est la racine principale', type: 'listeVlans', exemple: '20,40,60,80,99', aide: 'Les autres VLAN du tableau : aucun VLAN ne doit avoir deux racines principales.' },
  { id: 'racineS2', label: 'VLAN dont S2 est la racine secondaire (tous)', type: 'listeVlans', exemple: '10,20,30,40,50,60,70,80,99', aide: 'Tous les VLAN du tableau (sans le VLAN 1) : S2 prend la relève si une racine principale tombe.' },
];

const bloc = (n) => [
  swc('interface {{portS' + n + '}}'), swi('switchport mode access'), swi('no shutdown'), swi('switchport access vlan {{vlanS' + n + '}}'), swi('exit'),
  swc('interface range {{trunkDebut}} - {{trunkFin}}'), swr('switchport mode trunk'), swr('switchport trunk native vlan {{vlanNatif}}'), swr('exit'),
  swc('interface vlan {{vlanGestion}}'), swi('ip address {{ipS' + n + '}} {{gestionPrefixeMasque}}'), swi('no shutdown'), swi('end'),
];
const optBloc = (n) => [
  opt('switchport mode access', 'Fixe le port du poste en accès : un seul VLAN, sans étiquette.'),
  opt('switchport access vlan {{vlanS' + n + '}}', 'Affecte le port au VLAN du poste ; le VLAN doit exister (étape précédente).'),
  opt('interface range {{trunkDebut}} - {{trunkFin}}', 'Choisit plusieurs ports d’un coup : ici les ports de trunk.'),
  opt('switchport trunk native vlan {{vlanNatif}}', 'VLAN natif : les trames sans étiquette y vont ; le même aux deux bouts.'),
  opt('ip address {{ipS' + n + '}} {{gestionPrefixeMasque}}', 'Adresse de gestion du commutateur, sur l’interface virtuelle du VLAN de gestion.'),
];
const EXPL_BLOC = (n) => `Sur S${n} : le port du poste passe en accès dans son VLAN, les ports de trunk entre commutateurs reçoivent le VLAN natif, et l’interface du VLAN de gestion reçoit l’adresse. L’ordre compte : le VLAN existe déjà (étape précédente), puis le port, les trunks, l’adresse. Le VLAN natif doit être le même aux deux bouts, sinon IOS signale un écart de VLAN natif.`;

const ETAPES = [
  // 1 à 6 --------------------------------------------------------------------
  mod(P1, 'S1 : nommer le commutateur',
    'Tu es en console sur S1 : mode privilégié, mode de configuration, puis le nom d’hôte pour reconnaître le commutateur dans les sorties.',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteS1}}')],
    'L’invite prend le nouveau nom dès que la commande est acceptée.'),
  mod(P1, 'S1 : créer les VLAN',
    'Les VLAN se créent sur CHAQUE commutateur : il n’y a pas de VTP dans ce TP. Un bloc par ligne du tableau.',
    [swc('vlan {{vlan}}'), swv('name {{nom}}'), swv('exit')],
    'Aucun message. « show vlan brief » liste les VLAN créés, sans port affecté tant que l’étape suivante n’est pas faite.',
    { repeter: PAR_VLAN('VLAN {{vlan}} ({{nom}})'),
      options: [opt('vlan {{vlan}}', 'Crée le VLAN et passe en « config-vlan ».'), opt('name {{nom}}', 'Nom du VLAN, sans espace.')] }),
  mod(P1, 'S2 : nommer le commutateur',
    'Même chose sur S2, dans sa propre console.',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteS2}}')],
    'L’invite prend le nouveau nom dès que la commande est acceptée.'),
  mod(P1, 'S2 : créer les VLAN',
    'Les mêmes VLAN, avec les mêmes numéros que sur S1 (sinon ils ne passent pas sur les trunks).',
    [swc('vlan {{vlan}}'), swv('name {{nom}}'), swv('exit')],
    'Aucun message. Les VLAN existent, encore vides.',
    { repeter: PAR_VLAN('VLAN {{vlan}} ({{nom}})') }),
  mod(P1, 'S3 : nommer le commutateur',
    'Même chose sur S3, dans sa propre console.',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteS3}}')],
    'L’invite prend le nouveau nom dès que la commande est acceptée.'),
  mod(P1, 'S3 : créer les VLAN',
    'Les mêmes VLAN, avec les mêmes numéros que sur S1 et S2.',
    [swc('vlan {{vlan}}'), swv('name {{nom}}'), swv('exit')],
    'Aucun message. Les VLAN existent, encore vides.',
    { repeter: PAR_VLAN('VLAN {{vlan}} ({{nom}})') }),
  // 4 à 6 --------------------------------------------------------------------
  mod(P1, 'S1 : port d’accès, trunks et adresse de gestion', EXPL_BLOC(1), bloc(1),
    'Aucun message d’erreur. Les voyants des trunks passent au vert dès que le voisin est configuré aussi.',
    { options: optBloc(1), important: 'Un port affecté à un VLAN qui n’existe pas devient inactif : les VLAN d’abord, comme à l’étape précédente.' }),
  mod(P1, 'S2 : port d’accès, trunks et adresse de gestion', EXPL_BLOC(2), bloc(2),
    'Aucun message d’erreur.', { options: optBloc(2) }),
  mod(P1, 'S3 : port d’accès, trunks et adresse de gestion', EXPL_BLOC(3), bloc(3),
    'Aucun message d’erreur.', { options: optBloc(3) }),
  // 7 -----------------------------------------------------------------------
  lec(P2, 'Vérifier les VLAN et les trunks (S1, S2, S3)',
    'À faire sur chacun des trois commutateurs. Tous les VLAN du tableau doivent figurer dans la liste, le port d’accès dans son VLAN, et les ports de trunk doivent apparaître avec le VLAN natif attendu.',
    [sw('show vlan brief'), sw('show interfaces trunk')],
    'Tous les VLAN du tableau actifs ; « Native vlan » égal au VLAN natif choisi sur chaque port de trunk ; état « trunking ».',
    { verification: true,
      options: [opt('show vlan brief', 'Les VLAN et les ports qu’ils contiennent.'), opt('show interfaces trunk', 'Ports en trunk, VLAN natif, VLAN autorisés et transmis.')] }),
  // 8 -----------------------------------------------------------------------
  lec(P2, 'Joindre les autres commutateurs par ping',
    'Depuis S1, ping vers l’adresse de gestion de S2 puis de S3 : si les trois répondent, les trunks et le VLAN de gestion fonctionnent. Les premiers paquets peuvent se perdre le temps de la résolution ARP.',
    [sw('ping {{ipS2}}'), sw('ping {{ipS3}}')],
    'Des « ! » pour les réponses (le premier point « . » est normal) : « Success rate is 100 percent » ou 80 percent au premier essai.',
    { verification: true, options: [opt('ping {{ipS2}}', 'Teste la joignabilité de S2 par le VLAN de gestion.')] }),
  // 9 à 11 -------------------------------------------------------------------
  mod(P3, 'S1 : PVST+ et racine principale de ses VLAN',
    'Choisis le mode de Spanning Tree (identique sur les trois commutateurs), puis fais de S1 la racine principale du VLAN 1 et de ses VLAN. Chaque VLAN a sa propre racine : en répartissant les VLAN entre S1 et S3, les ports bloqués d’un VLAN transmettent pour l’autre, ce qui équilibre la charge.',
    [sw('configure terminal'), swc('spanning-tree mode {{modeStp}}'), swc('spanning-tree vlan 1 root primary'), swc('spanning-tree vlan {{racineS1}} root primary'), swc('end')],
    'Aucun message. « show spanning-tree » indiquera « This bridge is the root » pour ces VLAN.',
    { important: 'Le VLAN 1 n’entre pas dans les listes de VLAN de la fiche : il a sa propre ligne. Ne donne jamais la même racine principale à deux commutateurs pour le même VLAN.',
      options: [opt('spanning-tree mode {{modeStp}}', 'Mode de Spanning Tree : pvst (un arbre par VLAN) ou rapid-pvst.'), opt('spanning-tree vlan {{racineS1}} root primary', 'Abaisse la priorité de ce commutateur pour qu’il devienne racine de ces VLAN.')] }),
  mod(P3, 'S2 : PVST+ et racine secondaire de tous les VLAN',
    'S2 est la relève : racine secondaire de tous les VLAN. Si S1 ou S3 tombe, S2 devient la racine à sa place. Même mode que les autres.',
    [sw('configure terminal'), swc('spanning-tree mode {{modeStp}}'), swc('spanning-tree vlan 1 root secondary'), swc('spanning-tree vlan {{racineS2}} root secondary'), swc('end')],
    'Aucun message. Aucun VLAN n’a S2 pour racine tant que S1 et S3 fonctionnent.',
    { options: [opt('spanning-tree vlan {{racineS2}} root secondary', 'Priorité intermédiaire : racine de secours pour ces VLAN.')] }),
  mod(P3, 'S3 : PVST+ et racine principale de ses VLAN',
    'S3 est la racine principale des autres VLAN (ceux de S1 ne doivent pas figurer ici). Même mode que les autres commutateurs.',
    [sw('configure terminal'), swc('spanning-tree mode {{modeStp}}'), swc('spanning-tree vlan {{racineS3}} root primary'), swc('end')],
    'Aucun message. « show spanning-tree » indiquera « This bridge is the root » pour ces VLAN.',
    { options: [opt('spanning-tree vlan {{racineS3}} root primary', 'Abaisse la priorité de ce commutateur pour qu’il devienne racine de ces VLAN.')] }),
  // 12 ----------------------------------------------------------------------
  lec(P3, 'Vérifier les racines (S1, S2, S3)',
    'Sur chaque commutateur : le mode STP, puis la racine de chaque VLAN. « This bridge is the root » doit apparaître pour les VLAN de S1 sur S1 et pour ceux de S3 sur S3 ; S2 n’est racine d’aucun.',
    [sw('show spanning-tree summary'), sw('show spanning-tree')],
    'Mode « PVST » (ou Rapid PVST) ; pour chaque VLAN, « Root ID » avec l’adresse MAC du bon commutateur et, sur la racine, « This bridge is the root ».',
    { verification: true,
      options: [opt('show spanning-tree summary', 'Mode STP et nombre de ports par état pour chaque VLAN.'), opt('show spanning-tree', 'Racine, priorité et état de chaque port, VLAN par VLAN.')] }),
  // 13 à 15 -----------------------------------------------------------------
  mod(P4, 'S1 : PortFast et protection BPDU sur le port du poste',
    'PortFast fait passer le port du poste en transmission presque tout de suite (pas d’attente d’écoute et d’apprentissage). La protection BPDU coupe le port (err-disabled) s’il reçoit un message de commutateur : un commutateur branché par erreur ne peut pas perturber l’arbre. Uniquement sur les ports vers des postes.',
    [sw('configure terminal'), swc('interface {{portS1}}'), swi('spanning-tree portfast'), swi('spanning-tree bpduguard enable'), swi('end')],
    'Un avertissement rappelle que PortFast ne doit servir que pour un poste ; aucun autre message.',
    { important: 'Jamais sur un lien entre commutateurs : PortFast risquerait de créer une boucle temporaire.',
      options: [opt('spanning-tree portfast', 'Le port passe en transmission presque immédiatement.'), opt('spanning-tree bpduguard enable', 'Coupe le port s’il reçoit un BPDU.')] }),
  mod(P4, 'S2 : PortFast et protection BPDU sur le port du poste',
    'Même chose sur S2, avec son port d’accès.',
    [sw('configure terminal'), swc('interface {{portS2}}'), swi('spanning-tree portfast'), swi('spanning-tree bpduguard enable'), swi('end')],
    'Un avertissement rappelle que PortFast ne doit servir que pour un poste ; aucun autre message.'),
  mod(P4, 'S3 : PortFast et protection BPDU sur le port du poste',
    'Même chose sur S3, avec son port d’accès.',
    [sw('configure terminal'), swc('interface {{portS3}}'), swi('spanning-tree portfast'), swi('spanning-tree bpduguard enable'), swi('end')],
    'Un avertissement rappelle que PortFast ne doit servir que pour un poste ; aucun autre message.'),
  // 16 ----------------------------------------------------------------------
  lec(P5, 'Relire la configuration et PortFast',
    'À faire sur chaque commutateur : PortFast et BPDU guard sont-ils sur le bon port, et la configuration complète correspond-elle au tableau ?',
    [sw('show spanning-tree interface {{portS1}} portfast'), sw('show running-config')],
    'PortFast « enabled » pour le port du poste ; dans la configuration : le mode STP, les racines, « spanning-tree portfast » et « spanning-tree bpduguard enable » sous le port d’accès.',
    { verification: true,
      important: 'Les trois commutateurs : remplace le port par celui de chaque commutateur (S2 : port de S2, S3 : port de S3) quand tu relis.',
      options: [opt('show running-config', 'La configuration courante, à comparer avec le tableau.')] }),
  // 17 ----------------------------------------------------------------------
  mod(P5, 'Enregistrer la configuration (S1, S2, S3)',
    'À faire sur les trois commutateurs : sinon tout disparaît au redémarrage.',
    [sw('copy running-config startup-config')],
    '« Destination filename [startup-config]? » : Entrée ; puis « Building configuration… [OK] ».',
    { interactions: [{ attend: 'Destination filename [startup-config]?', reponds: 'Entrée (garde le nom proposé).' }],
      options: [opt('copy running-config startup-config', 'Enregistre la configuration courante au démarrage.')] }),
];

export const COURS_CISCO_TP_PVST = [{
  id: 'cours-tp-pvst',
  titre: 'TP complet : PVST+, PortFast et BPDU guard (S1, S2, S3)',
  categorie: 'Réseau et Cisco',
  resume: 'Le TP PVST+ en une seule suite, à champs : VLAN sur chaque commutateur, ports d’accès, trunks à VLAN natif, adresses de gestion, PVST+ avec racines différentes selon les VLAN (équilibrage de charge), puis PortFast et protection BPDU sur les ports des postes.',
  effet: 'modification',
  intentions: ['tp pvst', 'tp pvst+ complet', 'configuration du protocole pvst+', 'pvst+ packet tracer', 'équilibrage de charge pvst+', 'racine principale racine secondaire', 'portfast bpduguard tp', 'spanning-tree vlan root primary tp', 'tp stp complet'],
  motsCles: ['tp', 'pvst', 'pvst+', 'spanning-tree', 'racine', 'root primary', 'root secondary', 'portfast', 'bpduguard', 'bpdu guard', 'vlan', 'trunk', 'vlan natif', 'équilibrage', 'packet tracer', 'cisco', 'ios', 'laboratoire',
    'spanning-tree mode pvst', 'spanning-tree vlan', 'switchport trunk native vlan', 'show spanning-tree'],
  params: PARAMS,
  methodes: [{
    id: 'ios',
    privileges: 'Console de chaque commutateur (S1, S2, S3), mode privilégié (enable) puis configuration globale.',
    etapes: ETAPES,
    verification: [
      '« show vlan brief » : tous les VLAN du tableau existent sur S1, S2 et S3 ; chaque port d’accès est dans son VLAN.',
      '« show interfaces trunk » : les ports de trunk sont en « trunking » avec le VLAN natif choisi, et les trois commutateurs se joignent par ping sur le VLAN de gestion.',
      '« show spanning-tree » : S1 est racine de ses VLAN, S3 des siens, S2 d’aucun ; PortFast et BPDU guard sont actifs sur les trois ports d’accès.',
    ],
    retour: 'Pour défaire : sur chaque port d’accès « no spanning-tree portfast » et « no spanning-tree bpduguard enable » ; sur chaque commutateur « no spanning-tree vlan N root » pour revenir à la priorité par défaut ; les VLAN se retirent avec « no vlan N » (les ports concernés deviennent inactifs).',
    depannage: [
      { symptome: 'Le ping entre commutateurs échoue', cause: 'Trunk absent, VLAN de gestion absent d’un commutateur, ou VLAN natif différent aux deux bouts.', action: '« show interfaces trunk » et « show vlan brief » des deux côtés : le VLAN de gestion doit exister partout et le VLAN natif être le même.' },
      { symptome: 'Un message « native VLAN mismatch » apparaît', cause: 'Le VLAN natif d’un trunk n’est pas le même aux deux bouts.', action: 'Refais « switchport trunk native vlan » avec le même numéro sur les deux ports reliés.' },
      { symptome: 'Un commutateur n’est pas devenu racine malgré « root primary »', cause: 'Un autre commutateur a une priorité encore plus basse, ou le VLAN n’existe pas sur ce commutateur.', action: '« show spanning-tree vlan N » : compare les priorités ; vérifie que le VLAN existe partout.' },
      { symptome: 'Deux commutateurs sont racine du même VLAN', cause: 'Le VLAN figure dans la liste « root primary » de deux commutateurs.', action: 'Garde chaque VLAN dans une seule liste de racine principale ; les autres commutateurs ne sont racine qu’en secondaire.' },
      { symptome: 'Le port du poste passe en err-disabled', cause: 'Il a reçu un BPDU : un commutateur (ou un équipement qui relaie des BPDU) y est branché.', action: 'Retire l’appareil, puis « shutdown » et « no shutdown » sur le port ; PortFast et BPDU guard ne servent que pour les postes.' },
    ],
  }],
  assistant: null,
  sources: [SRC_STP, SRC_VLAN, SRC_OPT],
  validation: V_TP,
  origine: 'cours',
  figures: ['stp-racines', 'stp-boucle'],
  rappel: { titre: 'Rappel : un arbre par VLAN', points: ['PVST+ calcule un arbre Spanning Tree par VLAN : on peut donc avoir une racine différente par VLAN.', 'Répartir les VLAN entre deux racines répartit aussi le trafic : un port bloqué pour un VLAN transmet pour l’autre.', 'Une racine secondaire prend la relève de toutes les racines principales ; une racine principale par VLAN, jamais deux.', 'PortFast et BPDU guard vont ensemble sur les ports des postes, jamais sur un lien entre commutateurs.'] },
}];
