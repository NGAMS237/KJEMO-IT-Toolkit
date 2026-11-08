/**
 * cours-fiches-cisco-tp-vtp-dtp.mjs — CISCO-TP-VTP-DTP-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * UNE fiche « TP complet » À CHAMPS pour le formatif 6 (Packet Tracer : configurer VTP et DTP) :
 * un commutateur de distribution (DS1) et deux commutateurs d'accès (AS1, AS2). DTP forme les
 * trunks, VTP propage les VLAN du serveur vers les clients. Les noms, les ports, le domaine et
 * le TABLEAU des VLAN sont des champs (exemple : DS1 / AS1 / AS2, Fa0/7 et Fa0/9, CCNA-LAB,
 * VLAN 10 à 50) : le Toolkit ne présume jamais tes valeurs.
 *
 * Cinq phases, dans l'ordre qui marche :
 *   1  Les liens : câbles et DTP (DS1, AS1, AS2)
 *   2  DS1 : serveur VTP, domaine, mot de passe et VLAN
 *   3  AS1 et AS2 : clients VTP
 *   4  Vérifier chez les clients
 *   5  Enregistrer
 *
 * AUCUN mot de passe n'est saisi ici : le mot de passe VTP se tape sur chaque commutateur.
 * Rédigée à la main, dans nos mots. Le Toolkit n'exécute aucune commande : rien n'a été essayé
 * dans Packet Tracer ni sur du matériel réel.
 */
import { V_COURS } from './cours-outils.mjs';

const C2960 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960';
const SRC_VTP = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring VTP', url: `${C2960}/swvtp.html` };
const SRC_VLAN = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring VLANs (trunks, DTP)', url: `${C2960}/swvlan.html` };

const V_TP = `${V_COURS} Les valeurs proposées sont des exemples de laboratoire ; les sorties montrées sont écrites pour expliquer, pas copiées d’un équipement, et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.`;

// Lignes : l'invite s'affiche à côté, elle n'est jamais copiée. Le nom d'hôte étant un champ, l'invite est générique.
const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const swu = L('Switch>');
const sw = L('SW#');
const swc = L('SW(config)#');
const swv = L('SW(config-vlan)#');
const swi = L('SW(config-if)#');

const etape = (effet) => (phase, titre, explication, lignes, attendu, extra = {}) => ({ titre, phase, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');
const MOT = { hoteDs: 'nom', hoteAs1: 'nom', hoteAs2: 'nom', domaine: 'domaine', version: 'version', modeDs: 'mode', modeAs: 'mode', dsPort1: 'port', dsPort2: 'port', as1Port: 'port', as2Port: 'port', vlan: 'numéro-vlan', nom: 'nom-vlan' };
const forme = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, id) => MOT[id] ?? 'valeur');
const opt = (option, explication) => ({ option: forme(option), explication: forme(explication) });

const P1 = 'Phase 1 — Les liens : câbles et DTP (DS1, AS1, AS2)';
const P2 = 'Phase 2 — DS1 : serveur VTP, domaine, mot de passe et VLAN';
const P3 = 'Phase 3 — AS1 et AS2 : clients VTP';
const P4 = 'Phase 4 — Vérifier chez les clients';
const P5 = 'Phase 5 — Enregistrer';

/** Une ligne du tableau = un VLAN : son bloc de commandes se copie seul. */
const PAR_VLAN = (groupe) => ({ table: 'vlans', groupe });

const COLONNES_VLAN = [
  { id: 'vlan', label: 'VLAN', type: 'vlan', exemple: '10', aide: 'De 2 à 1001 (hors 1002-1005) : seuls ces VLAN se propagent par VTP.' },
  { id: 'nom', label: 'Nom', type: 'nomVlan', exemple: 'VLAN10', aide: 'Une lettre d’abord, sans espace.' },
];

const PARAMS = [
  { id: 'hoteDs', label: 'nom du commutateur de distribution (serveur)', type: 'hote', exemple: 'DS1', aide: 'Celui de l’énoncé : DS1.' },
  { id: 'hoteAs1', label: 'nom du premier commutateur d’accès (client)', type: 'hote', exemple: 'AS1', aide: 'Celui de l’énoncé : AS1.' },
  { id: 'hoteAs2', label: 'nom du deuxième commutateur d’accès (client)', type: 'hote', exemple: 'AS2', aide: 'Celui de l’énoncé : AS2.' },
  { id: 'dsPort1', label: 'port de DS1 vers AS1', type: 'interfaceIos', exemple: 'Fa0/7', aide: 'Le port de DS1 relié à AS1 (F0/7 dans l’énoncé).' },
  { id: 'as1Port', label: 'port de AS1 vers DS1', type: 'interfaceIos', exemple: 'Fa0/7', aide: 'Le port de AS1 relié à DS1 (F0/7 dans l’énoncé).' },
  { id: 'dsPort2', label: 'port de DS1 vers AS2', type: 'interfaceIos', exemple: 'Fa0/9', aide: 'Le port de DS1 relié à AS2 (F0/9 dans l’énoncé).' },
  { id: 'as2Port', label: 'port de AS2 vers DS1', type: 'interfaceIos', exemple: 'Fa0/9', aide: 'Le port de AS2 relié à DS1 (F0/9 dans l’énoncé).' },
  { id: 'modeDs', label: 'mode du port côté DS1', type: 'choix', choix: ['dynamic desirable', 'trunk'], exemple: 'dynamic desirable', aide: '« dynamic desirable » : DS1 propose le trunk (c’est ce que demande le formatif). « trunk » : fixe, sans négociation (le choix le plus sûr en réel).' },
  { id: 'modeAs', label: 'mode du port côté AS1 et AS2', type: 'choix', choix: ['dynamic auto', 'dynamic desirable', 'trunk'], exemple: 'dynamic auto', aide: '« dynamic auto » répond seulement : il faut un autre bout « desirable » ou « trunk ». Si tu fixes « trunk » côté DS1, mets aussi « trunk » ici.' },
  { id: 'domaine', label: 'nom du domaine VTP', type: 'identifiant', exemple: 'CCNA-LAB', aide: 'Identique sur les trois commutateurs, SENSIBLE À LA CASSE (CCNA-LAB n’est pas ccna-lab). Le mot de passe VTP n’est jamais saisi ici.' },
  { id: 'version', label: 'version de VTP', type: 'choix', choix: ['2', '1'], exemple: '2', aide: 'La même sur les trois commutateurs (2 par défaut dans ce TP).' },
  { id: 'vlans', label: 'tableau des VLAN (créés sur le serveur)', type: 'table', min: 1, max: 8, colonnes: COLONNES_VLAN, coherence: 'planVlan',
    exemple: [{ vlan: '10', nom: 'VLAN10' }, { vlan: '20', nom: 'VLAN20' }, { vlan: '30', nom: 'VLAN30' }, { vlan: '40', nom: 'VLAN40' }, { vlan: '50', nom: 'VLAN50' }] },
];

const ETAPES = [
  // 1 ------------------------------------------------------------------------
  lec(P1, 'Lire l’état de départ de DS1',
    'Tu es en console sur DS1. Avant de modifier quoi que ce soit, tu lis les trunks existants et l’état VTP. Les câbles se posent dans Packet Tracer : AS1 relié à DS1 (port de AS1 vers port de DS1 de l’énoncé), puis AS2 relié à DS1. Entre deux commutateurs, prends un câble « Copper Cross-Over » (ou le câble automatique) : un câble droit laisse le lien éteint.',
    [swu('enable'), sw('show interfaces trunk'), sw('show vtp status')],
    'Aucun trunk au départ (rien dans « show interfaces trunk »). « VTP Operating Mode : Server », domaine vide, « Configuration Revision : 0 ».',
    { options: [
      opt('show interfaces trunk', 'Liste des ports en trunk avec leur mode, leur état et les VLAN transportés.'),
      opt('show vtp status', 'Version, mode, domaine, révision et nombre de VLAN.'),
    ] }),
  // 2 ------------------------------------------------------------------------
  mod(P1, 'DS1 : proposer le trunk vers AS1 et AS2',
    'Sur DS1, tu fixes le mode DTP des deux ports. « dynamic desirable » veut dire « je propose un trunk à mon voisin » ; si le voisin répond (auto, desirable ou trunk), le trunk se forme tout seul. « no shutdown » garantit que le port est allumé.',
    [sw('configure terminal'), swc('hostname {{hoteDs}}'), swc('interface {{dsPort1}}'), swi('switchport mode {{modeDs}}'), swi('no shutdown'), swi('exit'), swc('interface {{dsPort2}}'), swi('switchport mode {{modeDs}}'), swi('no shutdown'), swi('end')],
    'Aucun message d’erreur. Quand le voisin est déjà câblé et configuré, « %LINEPROTO-5-UPDOWN … changed state to up » apparaît pour les ports.',
    { important: 'Les deux bouts en « dynamic auto » ne forment PAS de trunk : personne ne propose. Un bout en « access » face à un trunk casse le lien. En réel, préfère « trunk » fixe des deux côtés avec « switchport nonegotiate ».',
      options: [
        opt('switchport mode {{modeDs}}', 'Fixe le mode DTP du port : desirable propose un trunk, trunk le force.'),
        opt('no shutdown', 'Allume le port s’il était éteint.'),
      ] }),
  // 3 ------------------------------------------------------------------------
  mod(P1, 'AS1 : accepter le trunk vers DS1',
    'Sur AS1, le port relié à DS1 reçoit le mode du côté « répond ». Avec « dynamic auto », AS1 attend la proposition de DS1 et monte en trunk si elle arrive. Nomme aussi le commutateur pour le reconnaître dans les sorties.',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteAs1}}'), swc('interface {{as1Port}}'), swi('switchport mode {{modeAs}}'), swi('no shutdown'), swi('end')],
    'Aucun message d’erreur. L’invite prend le nom d’hôte.',
    { options: [
      opt('switchport mode {{modeAs}}', 'Mode DTP côté accès : auto répond à la proposition, trunk fixe le trunk.'),
    ] }),
  // 4 ------------------------------------------------------------------------
  mod(P1, 'AS2 : accepter le trunk vers DS1',
    'Même chose sur AS2, avec le port relié à DS1 (celui de l’énoncé : F0/9 côté DS1, et le port de AS2 qui y mène).',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteAs2}}'), swc('interface {{as2Port}}'), swi('switchport mode {{modeAs}}'), swi('no shutdown'), swi('end')],
    'Aucun message d’erreur. L’invite prend le nom d’hôte.',
    { options: [
      opt('switchport mode {{modeAs}}', 'Mode DTP côté accès.'),
    ] }),
  // 5 ------------------------------------------------------------------------
  lec(P1, 'Vérifier les trunks et le mode obtenu',
    'À faire sur DS1, puis sur AS1 et AS2. Réponses au formatif : « les ports DS1 devaient devenir des trunks » est vrai SEULEMENT si le voisin répond (auto, desirable ou trunk). Le mode affiché dans « show interfaces trunk » est « desirable » du côté DS1 et « auto » du côté AS (avec l’état « trunking »). Si la liste est vide, le trunk n’est pas monté : lis le dépannage.',
    [sw('show interfaces trunk'), sw('show interfaces {{dsPort1}} switchport')],
    'Les ports concernés apparaissent avec « Mode desirable » (DS1) ou « auto » (AS), « Status trunking » et l’encapsulation 802.1q. « Operational Mode : trunk » dans le détail du port.',
    { verification: true,
      options: [
        opt('show interfaces trunk', 'Ports en trunk, mode négocié, état et VLAN autorisés.'),
        opt('show interfaces {{dsPort1}} switchport', 'Mode configuré (Administrative) et mode réel (Operational) du port.'),
      ] }),
  // 6 ------------------------------------------------------------------------
  mod(P2, 'DS1 : mode serveur, domaine et version VTP',
    'DS1 devient le serveur : c’est lui qui crée les VLAN et les diffuse. Le nom du domaine est sensible à la casse et doit être écrit à l’identique sur les trois commutateurs ; la version aussi doit être la même.',
    [sw('configure terminal'), swc('vtp mode server'), swc('vtp domain {{domaine}}'), swc('vtp version {{version}}')],
    '« Setting device to VTP SERVER mode. », « Changing VTP domain name to … », « Setting device to VTP Version … ».',
    { important: 'Un nom de domaine écrit autrement isole le commutateur : définis-le correctement ici et recopie-le à l’identique ailleurs.',
      options: [
        opt('vtp mode server', 'Le serveur crée, modifie et diffuse les VLAN du domaine.'),
        opt('vtp domain {{domaine}}', 'Le nom du domaine, sensible à la casse.'),
        opt('vtp version {{version}}', 'La version de VTP : la même sur tous les commutateurs.'),
      ] }),
  // 7 ------------------------------------------------------------------------
  mod(P2, 'DS1 : mot de passe du domaine VTP',
    'La ligne est volontairement incomplète : tu tapes le mot de passe de ton énoncé juste après « password ». Il doit être identique sur DS1, AS1 et AS2. Le Toolkit ne le saisit ni ne le conserve.',
    [swc('vtp password', { secret: true })],
    'Aucun message de confirmation en cas de succès.',
    { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « password » suivi d’une espace.', reponds: 'Tape le mot de passe VTP demandé par ton énoncé, puis Entrée. Ne le relis pas avec « show vtp password » en public : il s’affiche en clair.' }],
      important: 'Si les clients ne reçoivent rien alors que le trunk et le domaine sont bons, le mot de passe diffère : refais « no vtp password » puis retape-le sur l’appareil fautif.' }),
  // 8 ------------------------------------------------------------------------
  mod(P2, 'DS1 : créer les VLAN du domaine',
    'Les VLAN se créent sur le serveur seulement : un client ne crée rien, ils lui arrivent par VTP. Un bloc par ligne du tableau ; chaque création augmente la révision VTP.',
    [swc('vlan {{vlan}}'), swv('name {{nom}}'), swv('exit')],
    'Aucun message. « show vlan brief » liste les VLAN créés (sans port : aucun n’y est encore affecté). La révision VTP monte à chaque création.',
    { repeter: PAR_VLAN('VLAN {{vlan}} ({{nom}})'),
      important: 'Seuls les VLAN de 2 à 1001 se propagent. Termine par « end » une fois tous les blocs tapés.',
      options: [
        opt('vlan {{vlan}}', 'Crée le VLAN et passe en « config-vlan ».'),
        opt('name {{nom}}', 'Nom du VLAN, sans espace.'),
      ] }),
  // 9 ------------------------------------------------------------------------
  mod(P3, 'AS1 : mode client, domaine et version VTP',
    'AS1 devient client : il reçoit les VLAN du serveur, il n’en crée pas. Même domaine (même casse) et même version que DS1.',
    [sw('configure terminal'), swc('vtp mode client'), swc('vtp domain {{domaine}}'), swc('vtp version {{version}}')],
    '« Setting device to VTP CLIENT mode. », « Changing VTP domain name to … ».',
    { options: [
      opt('vtp mode client', 'Le client reçoit et applique les VLAN du serveur ; il ne peut pas en créer.'),
      opt('vtp domain {{domaine}}', 'Le même domaine que le serveur, même casse.'),
    ] }),
  // 10 -----------------------------------------------------------------------
  mod(P3, 'AS1 : mot de passe du domaine VTP',
    'Le même mot de passe que sur DS1, tapé à la main juste après « password ».',
    [swc('vtp password', { secret: true })],
    'Aucun message de confirmation en cas de succès.',
    { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « password » suivi d’une espace.', reponds: 'Tape le mot de passe VTP demandé par ton énoncé, identique à celui de DS1, puis Entrée.' }] }),
  // 11 -----------------------------------------------------------------------
  mod(P3, 'AS2 : mode client, domaine et version VTP',
    'Même configuration que AS1 sur le deuxième commutateur d’accès.',
    [swu('enable'), sw('configure terminal'), swc('vtp mode client'), swc('vtp domain {{domaine}}'), swc('vtp version {{version}}')],
    '« Setting device to VTP CLIENT mode. », « Changing VTP domain name to … ».',
    { options: [
      opt('vtp mode client', 'Le client reçoit les VLAN du serveur.'),
      opt('vtp domain {{domaine}}', 'Le même domaine que le serveur, même casse.'),
    ] }),
  // 12 -----------------------------------------------------------------------
  mod(P3, 'AS2 : mot de passe du domaine VTP',
    'Le même mot de passe que sur DS1 et AS1, tapé à la main juste après « password ».',
    [swc('vtp password', { secret: true })],
    'Aucun message de confirmation en cas de succès.',
    { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « password » suivi d’une espace.', reponds: 'Tape le mot de passe VTP demandé par ton énoncé, identique à celui de DS1, puis Entrée.' }] }),
  // 13 -----------------------------------------------------------------------
  lec(P4, 'AS1 : les VLAN sont arrivés ?',
    'Sur AS1, tu compares avec DS1 : même domaine, même révision, et les VLAN créés sur le serveur dans la liste. Quelques secondes peuvent être nécessaires après le trunk et le mot de passe.',
    [sw('show vtp status'), sw('show vlan brief')],
    'Mode client, domaine du TP, « Configuration Revision » égale à celle de DS1, et les VLAN du tableau listés dans « show vlan brief » (sans port).',
    { verification: true,
      options: [
        opt('show vtp status', 'Mode, domaine, révision et nombre de VLAN : à comparer avec DS1.'),
        opt('show vlan brief', 'Les VLAN reçus du serveur doivent y figurer.'),
      ] }),
  // 14 -----------------------------------------------------------------------
  lec(P4, 'AS2 : les VLAN sont arrivés ?',
    'Même lecture sur AS2 : le domaine, la révision et la liste des VLAN doivent être ceux de DS1, sans qu’aucun VLAN n’ait été créé sur le client.',
    [sw('show vtp status'), sw('show vlan brief')],
    'Mode client, même domaine, même révision que DS1, et les VLAN du tableau dans « show vlan brief ».',
    { verification: true }),
  // 15 -----------------------------------------------------------------------
  lec(P4, 'DS1 : relire l’état du serveur',
    'Sur DS1, la révision est celle que les clients doivent atteindre ; le nombre de VLAN doit correspondre.',
    [sw('show vtp status'), sw('show vlan brief')],
    'Mode server, domaine du TP, révision égale à celle des clients, VLAN du tableau listés.',
    { verification: true }),
  // 16 -----------------------------------------------------------------------
  mod(P5, 'Enregistrer la configuration (DS1, AS1, AS2)',
    'À faire sur les trois commutateurs. Les VLAN reçus par VTP sont enregistrés dans un fichier à part (vlan.dat) : « copy running-config startup-config » garde le reste (modes, domaine, ports).',
    [sw('copy running-config startup-config')],
    '« Destination filename [startup-config]? » : Entrée ; puis « Building configuration… [OK] ».',
    { interactions: [{ attend: 'Destination filename [startup-config]?', reponds: 'Entrée (garde le nom proposé).' }],
      options: [
        opt('copy running-config startup-config', 'Enregistre la configuration courante au démarrage.'),
      ] }),
];

export const COURS_CISCO_TP_VTP_DTP = [{
  id: 'cours-tp-vtp-dtp',
  titre: 'TP complet : VTP et DTP (DS1, AS1, AS2)',
  categorie: 'Réseau et Cisco',
  resume: 'Le formatif 6 en une seule suite, à champs : câbler et former les trunks par DTP, créer le domaine VTP sur DS1 (mode serveur, mot de passe, VLAN), configurer AS1 et AS2 en clients, puis vérifier que les VLAN sont arrivés et enregistrer. Le mot de passe se tape sur chaque commutateur.',
  effet: 'modification',
  intentions: ['tp vtp dtp', 'formatif 6 vtp dtp', 'configurer vtp et dtp', 'vtp dtp packet tracer', 'dtp dynamic desirable vtp serveur client', 'les clients vtp ne reçoivent pas les vlan', 'vtp serveur client domaine mot de passe', 'tp vtp complet', 'formatif vtp dtp ds1 as1 as2'],
  motsCles: ['tp', 'formatif', 'vtp', 'dtp', 'ds1', 'as1', 'as2', 'trunk', 'vlan', 'serveur', 'client', 'domaine', 'desirable', 'dynamic auto', 'packet tracer', 'cisco', 'ios', 'laboratoire',
    'vtp mode server', 'vtp mode client', 'vtp domain', 'vtp password', 'switchport mode dynamic desirable', 'show vtp status', 'show interfaces trunk'],
  params: PARAMS,
  methodes: [{
    id: 'ios',
    privileges: 'Console de chaque commutateur (DS1, AS1, AS2), mode privilégié (enable) puis configuration globale.',
    etapes: ETAPES,
    verification: [
      '« show interfaces trunk » montre les ports vers AS1 et AS2 en trunk (desirable côté DS1, auto côté AS) sur les trois commutateurs.',
      '« show vtp status » : même domaine, même version et même numéro de révision sur DS1, AS1 et AS2.',
      '« show vlan brief » sur AS1 et AS2 : les VLAN du tableau sont présents (reçus du serveur, jamais créés sur le client).',
    ],
    retour: 'Pour défaire : sur chaque commutateur « vtp mode transparent » (il garde ses VLAN et n’en reçoit plus), « no vtp password », puis « switchport mode dynamic auto » sur les ports ; sur DS1 « no vlan N » pour chaque VLAN du tableau.',
    depannage: [
      { symptome: '« show interfaces trunk » ne renvoie rien sur un client', cause: 'Aucun trunk : lien éteint (câble droit au lieu d’un câble croisé, mauvais port), ou deux bouts en « dynamic auto », ou un bout en « access ».', action: '« show ip interface brief » (le port est-il up/up ?), « show interfaces PORT switchport » (Administrative et Operational Mode) des deux côtés ; mets un bout en desirable ou fixe « switchport mode trunk » des deux côtés.' },
      { symptome: 'Le trunk est monté mais le client ne reçoit aucun VLAN', cause: 'Domaine écrit autrement (casse comprise), mot de passe différent ou versions VTP différentes.', action: '« show vtp status » des trois commutateurs ; refais « vtp domain » à l’identique, « no vtp password » puis retape le mot de passe, et aligne « vtp version ».' },
      { symptome: 'Le client a déjà une révision plus haute que le serveur', cause: 'Un client qui a déjà servi ignore (ou écrase) le serveur dont la révision est plus basse.', action: 'Sur le client : « vtp mode transparent » puis « vtp mode client » (la révision retombe à 0).' },
      { symptome: 'Les VLAN ont été créés avant le domaine ou le mot de passe', cause: 'Aucune annonce n’a été envoyée avec les bons réglages.', action: 'Sur DS1, modifie un VLAN (par exemple « vlan 60 » puis « no vlan 60 ») pour forcer une nouvelle annonce.' },
      { symptome: '« switchport mode dynamic desirable » refusé', cause: 'Ce modèle négocie l’encapsulation et exige de la fixer d’abord (3560).', action: 'Tape « switchport trunk encapsulation dot1q » juste avant, puis le mode.' },
    ],
  }],
  assistant: null,
  sources: [SRC_VTP, SRC_VLAN],
  validation: V_TP,
  origine: 'cours',
  figures: ['vtp-modes', 'dtp-modes'],
  rappel: { titre: 'Rappel : DTP forme les trunks, VTP propage les VLAN', points: ['DTP négocie le trunk entre deux commutateurs voisins : desirable propose, auto répond, trunk est fixe ; deux « auto » ne forment rien.', 'VTP ne passe que par un trunk : trunk d’abord, puis domaine, version et mot de passe identiques, puis VLAN sur le serveur.', 'Un client ne crée aucun VLAN : il les reçoit ; un commutateur de révision plus élevée écrase la base du domaine.', 'En réel : « switchport mode trunk » + « switchport nonegotiate » des deux côtés, plutôt que de laisser DTP négocier.'] },
}];
