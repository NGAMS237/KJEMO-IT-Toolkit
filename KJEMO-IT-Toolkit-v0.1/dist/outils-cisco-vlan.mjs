/**
 * outils-cisco-vlan.mjs — RESEAU-CISCO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * PARTIE B : VLAN, trunks, DTP, VTP — 10 assistants.
 *
 *  1. cisco-vlan-inventaire     lire les VLAN et l'affectation des ports
 *  2. cisco-vlan-creation       créer / nommer UN VLAN (aucune suppression)
 *  3. cisco-port-access         affecter UN port d'accès à un VLAN
 *  4. cisco-trunk-preparation   préparer UN trunk (ajouter / retirer des VLAN, natif)
 *  5. cisco-trunk-diagnostic    lire l'état d'un trunk
 *  6. cisco-dtp-simulation      simulation pédagogique de DTP
 *  7. cisco-vtp-diagnostic      lire l'état VTP (+ analyse d'une sortie collée)
 *  8. cisco-vtp-configuration   mode / domaine / version 1 ou 2 (jamais le mot de passe)
 *  9. cisco-vtp-raccordement    liste de contrôle avant de rejoindre un domaine VTP
 * 10. cisco-parcours-diagnostic parcours guidés + analyse de sorties collées
 *
 * Interdits constants : aucune suppression de VLAN, aucun effacement de
 * vlan.dat, aucun reset, aucun changement global de ports, aucun
 * « allowed vlan » sans add/remove, aucun VTP v3, aucun mot de passe VTP saisi.
 */

import { outilCisco } from './noyau-cisco.mjs';
import { SRC } from './sources-cisco.mjs';
import {
  validerChoixCisco, validerInterfaceIos, validerVlanIos, validerListeVlansIos, validerNomVlanIos,
  validerDomaineVtp, validerSortieCollee,
} from './validateurs-cisco.mjs';
import {
  PREREQ_COMMUN, ERREUR_MODE, ERREUR_PERTE_ACCES, RETOUR_STANDARD,
} from './outils-cisco-socle.mjs';
import { MODES_DTP, simulerDtp, matriceDtp, analyserParcours, SCENARIOS, analyserVtpStatus } from './analyse-cisco.mjs';

const F_VLAN = 'VLAN et ports d’accès';
const F_TRUNK = 'Trunks et DTP';
const F_VTP = 'VTP et diagnostic';

const bool = (x) => x === true || x === 'true';
const champInterface = (aide) => ({ id: 'ciscoInterface', label: 'Interface (une seule)', type: 'text', default: 'Fa0/9', help: aide ?? 'Fa0/9, Gi0/1 ou Gi1/0/9 selon la numérotation choisie. Pas de plage.' });

// ---------------------------------------------------------------------------
// 1. Inventaire des VLAN
// ---------------------------------------------------------------------------
export const ciscoVlanInventaire = outilCisco({
  id: 'cisco-vlan-inventaire',
  famille: F_VLAN,
  title: 'VLAN : inventaire des VLAN et des ports affectés',
  summary: 'Lire les VLAN existants, leur état et les ports qui y sont affectés, en entier, pour un VLAN ou pour une interface. Lecture seule.',
  keywords: ['vlan', 'show vlan brief', 'inventaire', 'ports', 'affectation', 'cisco'],
  interface: true,
  champs: [
    { id: 'ciscoVlanFiltre', label: 'Que lire ?', type: 'select', default: 'tous', options: [['tous', 'Tous les VLAN (résumé)'], ['vlan', 'Un VLAN précis'], ['interface', 'Les VLAN d’une interface']] },
    { id: 'ciscoVlan', label: 'VLAN (si « un VLAN précis »)', type: 'text', default: '10' },
    champInterface('Utilisée seulement si « les VLAN d’une interface ».'),
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const f = validerChoixCisco(v.ciscoVlanFiltre, ['tous', 'vlan', 'interface'], 'Le filtre'); if (!f.ok) errors.ciscoVlanFiltre = f.error; else val.filtre = f.valeur;
    if (val.filtre === 'vlan') { const x = validerVlanIos(v.ciscoVlan, { lecture: true }); if (!x.ok) errors.ciscoVlan = x.error; else val.vlan = x.valeur; }
    if (val.filtre === 'interface') { const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur; }
    return { errors, val };
  },
  lecture: (val) => {
    const l = [{ n: 'Tous les VLAN et leurs ports d acces :', c: 'show vlan brief' }];
    if (val.filtre === 'vlan') l.push({ n: `Detail du VLAN ${val.vlan} :`, c: `show vlan id ${val.vlan}` });
    if (val.filtre === 'interface') l.push({ n: `Mode et VLAN d acces de ${val.interface} :`, c: `show interfaces ${val.interface} switchport` });
    l.push({ n: 'Ports en trunk (ils n apparaissent PAS dans show vlan brief) :', c: 'show interfaces trunk' });
    return l;
  },
  prereqs: [...PREREQ_COMMUN],
  commonErrors: [
    { message: 'Un port « manque » dans show vlan brief', cause: 'Les ports en trunk ne sont pas listés par show vlan brief.', fix: 'Lis « show interfaces trunk » : le port y figure s’il est en trunk.' },
    ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Passe en mode privilégié.', 'Colle l’étape de lecture et lis chaque colonne.'],
  checks: ['Chaque VLAN attendu apparaît avec l’état « active ».', 'Les ports d’accès sont dans le bon VLAN ; les trunks sont listés à part.'],
  verifyAfter: ['Le nombre de VLAN correspond au plan d’adressage.', 'Chaque port d’accès attendu est listé dans le bon VLAN.'],
  rollback: RETOUR_STANDARD('Lecture seule : rien à défaire.', 'show vlan brief', 'show vlan brief'),
  source: SRC.vlan.url,
  sources: [SRC.vlan, SRC.vlanCommandes, SRC.trunks],
  cisco: {
    probleme: 'On ne sait pas quels VLAN existent sur un commutateur ni dans lequel se trouve chaque prise.',
    utilite: 'Avant toute modification, on lit l’existant : c’est la base de tout diagnostic VLAN.',
    exemple: 'Le technicien vérifie que RH (10), Compta (20) et Ventes (30) existent sur AS1 avant de brancher le nouvel étage.',
    lecture: ['show vlan brief : VLAN, nom, état, ports d’accès.', 'show vlan id N : détail d’un VLAN.', 'show interfaces trunk : les ports qui ne sont pas listés ailleurs.'],
    effets: ['Aucun : lecture seule.'],
    attendu: ['Les VLAN 1002 à 1005 apparaissent toujours (réservés).', 'Un port en trunk n’est pas listé dans la colonne Ports.'],
    limites: ['« show vlan brief » ne montre que les ports d’accès statiques.', 'Le résultat réel dépend du modèle et de la version ; rien n’a été exécuté ici.'],
  },
});

// ---------------------------------------------------------------------------
// 2. Création d'un VLAN
// ---------------------------------------------------------------------------
export const ciscoVlanCreation = outilCisco({
  id: 'cisco-vlan-creation',
  famille: F_VLAN,
  title: 'VLAN : créer et nommer UN VLAN',
  summary: 'Créer un VLAN (numéro 2 à 4094 hors 1002-1005) et lui donner un nom. Aucune suppression de VLAN, aucun effacement de vlan.dat.',
  keywords: ['vlan', 'création', 'nom', 'name', 'vlan.dat', 'cisco'],
  modifie: true,
  champs: [
    { id: 'ciscoVlan', label: 'Numéro du VLAN', type: 'text', default: '10', help: '2 à 4094. 1 et 1002-1005 sont réservés.' },
    { id: 'ciscoVlanNom', label: 'Nom du VLAN', type: 'text', default: 'RH', help: 'Lettre en premier, 32 caractères au plus, sans espace.' },
  ],
  parse(v) {
    const errors = {}; const val = {};
    const n = validerVlanIos(v.ciscoVlan); if (!n.ok) errors.ciscoVlan = n.error; else val.vlan = n.valeur;
    const m = validerNomVlanIos(v.ciscoVlanNom); if (!m.ok) errors.ciscoVlanNom = m.error; else val.nom = m.valeur;
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER VLAN ${val.vlan}`,
  lecture: (val) => [
    { n: `Ce VLAN existe-t-il deja ? (un nom existant serait ecrase) :`, c: `show vlan id ${val.vlan}` },
    { n: 'Tous les VLAN :', c: 'show vlan brief' },
  ],
  config: (val) => ['configure terminal', `vlan ${val.vlan}`, ` name ${val.nom}`, 'end'],
  verification: (val) => [{ n: 'Controle apres modification :', c: `show vlan id ${val.vlan}` }, { c: 'show vlan brief' }],
  retour: (val) => [{ n: `Le Toolkit ne genere AUCUNE suppression de VLAN (no vlan ${val.vlan} detache les ports et les rend inactifs). Pour revenir en arriere sur un nom, retape « name <ancien nom> » dans le VLAN apres l avoir lu a l etape 1.` }],
  prereqs: [...PREREQ_COMMUN, 'Le commutateur est en mode serveur ou transparent VTP : un client ne peut pas créer de VLAN.'],
  commonErrors: [
    { message: '% VLAN database editing is only allowed in VTP server or transparent mode', cause: 'Le commutateur est client VTP.', fix: 'Crée le VLAN sur le serveur du domaine, ou change de mode seulement si tu sais ce que tu fais (assistant VTP).' },
    { message: 'Le VLAN existe déjà avec un autre nom', cause: 'La commande name remplace le nom existant.', fix: 'Lis l’étape 1 avant de coller l’étape 2.' },
    ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Lis l’état du VLAN.', 'Entre « vlan N », puis « name X », puis « end ».', 'Contrôle avec show vlan brief.'],
  checks: ['show vlan id N : le VLAN apparaît avec le nom choisi et l’état « active ».'],
  verifyAfter: ['Le VLAN apparaît sur les autres commutateurs si VTP serveur, ou doit être créé à la main si transparent.', 'Le nom affiché est celui choisi (show vlan id).'],
  rollback: RETOUR_STANDARD('Le Toolkit ne génère pas de suppression de VLAN ; seul le nom se rétablit.', 'show vlan id <N>', 'configure terminal\nvlan <N>\n name <ancien nom>\nend'),
  source: SRC.vlan.url,
  sources: [SRC.vlan, SRC.vlanCommandes],
  cisco: {
    probleme: 'Un nouveau service a besoin de son propre domaine de diffusion, mais le VLAN n’existe pas encore.',
    utilite: 'On crée le VLAN et on le nomme pour que les ports puissent y être affectés et que le plan reste lisible.',
    exemple: 'Création du VLAN 10 « RH » sur DS1 avant d’y mettre Fa0/7.',
    lecture: ['show vlan id N : le VLAN existe-t-il déjà ?', 'show vlan brief : vue d’ensemble.'],
    effets: ['vlan N : crée (ou ouvre) le VLAN dans la base locale.', 'name X : nomme le VLAN.'],
    attendu: ['Le VLAN est listé « active » dans show vlan brief.'],
    limites: ['Aucune suppression de VLAN n’est proposée, volontairement.', 'En mode VTP serveur, la création est annoncée aux autres commutateurs du domaine.', 'Le comportement exact varie selon le modèle.'],
  },
});

// ---------------------------------------------------------------------------
// 3. Port d'accès
// ---------------------------------------------------------------------------
export const ciscoPortAccess = outilCisco({
  id: 'cisco-port-access',
  famille: F_VLAN,
  title: 'VLAN : affecter UN port d’accès à un VLAN',
  summary: 'Mettre un port en mode access et l’affecter à un VLAN existant. Un port à la fois, jamais de plage, jamais un trunk.',
  keywords: ['vlan', 'access', 'switchport access vlan', 'port', 'cisco'],
  modifie: true,
  interface: true,
  champs: [
    champInterface('Un port qui n’est PAS un trunk. Fa0/7, Gi0/1 ou Gi1/0/7.'),
    { id: 'ciscoVlan', label: 'VLAN d’accès', type: 'text', default: '10' },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    const n = validerVlanIos(v.ciscoVlan); if (!n.ok) errors.ciscoVlan = n.error; else val.vlan = n.valeur;
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER ${val.interface}`,
  lecture: (val) => [
    { n: 'Etat actuel du port (mode administratif et VLAN d acces) :', c: `show interfaces ${val.interface} switchport` },
    { n: 'Le VLAN doit exister :', c: `show vlan id ${val.vlan}` },
    { c: 'show interfaces trunk' },
  ],
  config: (val) => ['configure terminal', `interface ${val.interface}`, ' switchport mode access', ` switchport access vlan ${val.vlan}`, 'end'],
  verification: (val) => [{ n: 'Controle apres modification :', c: `show interfaces ${val.interface} switchport` }, { c: `show vlan id ${val.vlan}` }],
  retour: (val) => [{ n: `Relis l etape 1 pour connaitre l ancien VLAN d acces de ${val.interface}, puis retape :` }, 'configure terminal', `interface ${val.interface}`, ' switchport access vlan <ancien VLAN lu a l etape 1>', 'end', { n: 'Sans ancien VLAN connu, « no switchport access vlan » ramene le port au VLAN 1.' }],
  prereqs: [...PREREQ_COMMUN, 'Le VLAN existe déjà (assistant de création).', 'Le port n’est pas un lien vers un autre commutateur.'],
  commonErrors: [
    { message: 'Le PC n’obtient plus d’adresse après le changement', cause: 'Le serveur DHCP n’est pas atteignable depuis le nouveau VLAN.', fix: 'Vérifie le trunk et le service DHCP du VLAN avant de déplacer des postes.' },
    { message: 'Le port est affecté mais inactif', cause: 'Le VLAN n’existe pas sur ce commutateur.', fix: 'Crée-le d’abord ; lis show vlan brief.' },
    ERREUR_PERTE_ACCES, ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Lis le port et le VLAN.', 'Entre dans « interface <port> », « switchport mode access », « switchport access vlan N ».', 'Contrôle.'],
  checks: ['show interfaces <port> switchport : « Operational Mode: static access » et « Access Mode VLAN: N ».'],
  verifyAfter: ['Le poste branché obtient une adresse du bon réseau.', 'Le port n’apparaît plus dans l’ancien VLAN (show vlan brief).'],
  rollback: RETOUR_STANDARD('Remettre l’ancien VLAN lu avant modification.', 'show interfaces <port> switchport', 'configure terminal\ninterface <port>\n switchport access vlan <ancien>\nend'),
  source: SRC.vlan.url,
  sources: [SRC.vlan, SRC.vlanCommandes, SRC.interfaces],
  cisco: {
    probleme: 'Un poste est branché dans le mauvais VLAN, ou une nouvelle prise doit rejoindre un service.',
    utilite: 'L’affectation du port d’accès détermine le réseau logique du poste branché.',
    exemple: 'Fa0/7 (poste RH) passe dans le VLAN 10.',
    lecture: ['show interfaces <port> switchport : mode et VLAN actuel.', 'show vlan id N : le VLAN existe.', 'show interfaces trunk : le port n’est pas un trunk.'],
    effets: ['switchport mode access : le port n’appartient qu’à un VLAN.', 'switchport access vlan N : ce VLAN.'],
    attendu: ['Operational Mode : static access ; Access Mode VLAN : N.'],
    limites: ['Un seul port par opération ; aucune plage.', 'Packet Tracer accepte parfois un VLAN inexistant en le créant ; un matériel réel peut agir autrement.'],
  },
});

// ---------------------------------------------------------------------------
// 4. Préparation d'un trunk
// ---------------------------------------------------------------------------
export const ciscoTrunkPreparation = outilCisco({
  id: 'cisco-trunk-preparation',
  famille: F_TRUNK,
  title: 'Trunk : préparer UN lien (VLAN autorisés, VLAN natif)',
  summary: 'Passer UN port en trunk 802.1Q, AJOUTER ou RETIRER des VLAN autorisés (jamais remplacer la liste), régler le VLAN natif, couper DTP si voulu.',
  keywords: ['trunk', 'allowed vlan', 'add', 'remove', 'native vlan', 'nonegotiate', '802.1q', 'cisco'],
  modifie: true,
  interface: true,
  champs: [
    champInterface('Le port du lien vers l’autre commutateur. Une seule interface.'),
    { id: 'ciscoTrunkAction', label: 'VLAN autorisés', type: 'select', default: 'ajouter', options: [['ajouter', 'AJOUTER ces VLAN (add)'], ['retirer', 'RETIRER ces VLAN (remove)'], ['aucune', 'Ne pas toucher à la liste']] },
    { id: 'ciscoVlans', label: 'Liste de VLAN', type: 'text', default: '10,20,30', help: 'Ex. 10,20,30-35. Jamais « all », « none » ni « except » : ils remplaceraient la liste.' },
    { id: 'ciscoNatif', label: 'VLAN natif (facultatif)', type: 'text', default: '', help: 'Vide = ne pas changer. Il doit être identique des deux côtés du lien.' },
    { id: 'ciscoNonegotiate', label: 'Couper DTP sur ce port (switchport nonegotiate)', type: 'checkbox', default: false },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    const a = validerChoixCisco(v.ciscoTrunkAction, ['ajouter', 'retirer', 'aucune'], 'L’action sur la liste'); if (!a.ok) errors.ciscoTrunkAction = a.error; else val.action = a.valeur;
    if (val.action && val.action !== 'aucune') { const l = validerListeVlansIos(v.ciscoVlans); if (!l.ok) errors.ciscoVlans = l.error; else { val.liste = l.valeur; val.ids = l.ids; } }
    if (String(v.ciscoNatif ?? '').trim() !== '') { const n = validerVlanIos(v.ciscoNatif, { label: 'Le VLAN natif' }); if (!n.ok) errors.ciscoNatif = n.error; else val.natif = n.valeur; }
    val.nonego = bool(v.ciscoNonegotiate);
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER ${val.interface}`,
  lecture: (val) => [
    { n: 'Liste actuelle des VLAN autorises, VLAN natif, mode :', c: `show interfaces ${val.interface} switchport` },
    { c: 'show interfaces trunk' },
    { n: 'Qui est de l autre cote du lien ?', c: 'show cdp neighbors' },
    { c: 'show vlan brief' },
  ],
  config: (val) => {
    const l = [{ n: 'ATTENTION : toucher au trunk par lequel tu es connecte peut couper ta session. Garde un acces console.' }, 'configure terminal', `interface ${val.interface}`, ' switchport mode trunk'];
    if (val.action === 'ajouter') l.push(` switchport trunk allowed vlan add ${val.liste}`);
    if (val.action === 'retirer') l.push(` switchport trunk allowed vlan remove ${val.liste}`);
    if (val.natif) l.push(` switchport trunk native vlan ${val.natif}`);
    if (val.nonego) l.push(' switchport nonegotiate');
    l.push('end');
    return l;
  },
  verification: (val) => [{ n: 'Controle apres modification :', c: `show interfaces ${val.interface} switchport` }, { c: 'show interfaces trunk' }],
  retour: (val) => {
    const l = ['configure terminal', `interface ${val.interface}`];
    if (val.action === 'ajouter') l.push(` switchport trunk allowed vlan remove ${val.liste}`);
    if (val.action === 'retirer') l.push(` switchport trunk allowed vlan add ${val.liste}`);
    if (val.natif) l.push(' switchport trunk native vlan <ancien natif lu a l etape 1>');
    if (val.nonego) l.push(' no switchport nonegotiate');
    l.push('end');
    return l;
  },
  prereqs: [...PREREQ_COMMUN, 'Les deux extrémités du lien sont connues (show cdp neighbors) et le VLAN natif sera identique des deux côtés.', 'Sur le matériel de référence (802.1Q seul), « switchport trunk encapsulation » n’est ni nécessaire ni accepté.'],
  commonErrors: [
    { message: '%CDP-4-NATIVE_VLAN_MISMATCH', cause: 'Le VLAN natif diffère entre les deux extrémités.', fix: 'Aligne « switchport trunk native vlan » des deux côtés.' },
    { message: 'Un VLAN ne traverse pas le trunk', cause: 'Il n’est pas dans la liste des VLAN autorisés.', fix: 'Ajoute-le avec « allowed vlan add » ; jamais « allowed vlan N » seul : cela REMPLACE toute la liste.' },
    { message: 'Command rejected: An interface whose trunk encapsulation is "Auto" can not be configured to "trunk" mode.', cause: 'Matériel qui gère ISL et 802.1Q : l’encapsulation doit être fixée d’abord.', fix: 'Sur ce modèle, tape d’abord « switchport trunk encapsulation dot1q » à la main (non nécessaire sur les Catalyst 2960 / 1000).' },
    ERREUR_PERTE_ACCES, ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Lis le port, les trunks et les voisins.', 'Entre dans « interface <port> », passe en trunk, AJOUTE ou RETIRE les VLAN, règle le natif.', 'Contrôle des deux côtés.'],
  checks: ['show interfaces trunk : le port est « trunking », le natif attendu, les VLAN dans « allowed » puis « allowed and active ».'],
  verifyAfter: ['Les deux extrémités ont le même natif.', 'Un poste d’un VLAN ajouté joint son voisin de l’autre commutateur.'],
  rollback: RETOUR_STANDARD('Annuler l’ajout par un retrait, ou l’inverse, avec la même liste ; rétablir le natif lu.', 'show interfaces <port> switchport\nshow interfaces trunk', 'configure terminal\ninterface <port>\n switchport trunk allowed vlan remove <liste>\nend'),
  source: SRC.trunks.url,
  sources: [SRC.trunks, SRC.layer2Commandes, SRC.vlanCommandes],
  cisco: {
    probleme: 'Les VLAN d’un commutateur doivent atteindre l’autre : le lien qui les relie doit être un trunk qui transporte les bons VLAN.',
    utilite: 'On règle un trunk de façon explicite, en ajoutant ou retirant des VLAN sans jamais écraser la liste existante.',
    exemple: 'DS1 Fa0/9 vers AS2 Fa0/9 : on ajoute les VLAN 10, 20 et 30 sans toucher aux VLAN déjà transportés.',
    lecture: ['show interfaces <port> switchport : mode, natif, liste autorisée.', 'show interfaces trunk : trunks actifs.', 'show cdp neighbors : l’autre extrémité.'],
    effets: ['switchport mode trunk : le port devient un trunk 802.1Q fixe.', 'allowed vlan add/remove : modifie la liste sans la remplacer.', 'native vlan : VLAN des trames non étiquetées.', 'nonegotiate : plus de DTP sur ce port.'],
    attendu: ['Statut « trunking », liste « allowed » contenant les VLAN ajoutés.'],
    limites: ['La liste n’est jamais remplacée silencieusement ; « all », « none » et « except » sont refusés.', 'Matériel de référence : Cisco C1000-24T-4G-L, non testé.', 'Changer le natif d’un seul côté crée un défaut silencieux.'],
  },
});

// ---------------------------------------------------------------------------
// 5. Diagnostic d'un trunk
// ---------------------------------------------------------------------------
export const ciscoTrunkDiagnostic = outilCisco({
  id: 'cisco-trunk-diagnostic',
  famille: F_TRUNK,
  title: 'Trunk : diagnostic (lecture seule)',
  summary: 'Lire l’état d’un trunk : mode administratif et opérationnel, VLAN autorisés, actifs et en forwarding, natif, voisin CDP.',
  keywords: ['trunk', 'diagnostic', 'show interfaces trunk', 'switchport', 'native vlan', 'cisco'],
  interface: true,
  champs: [champInterface()],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    return { errors, val };
  },
  lecture: (val) => [
    { n: 'Tous les trunks actifs :', c: 'show interfaces trunk' },
    { n: `Mode administratif / operationnel de ${val.interface} :`, c: `show interfaces ${val.interface} switchport` },
    { n: `Etat physique :`, c: `show interfaces ${val.interface} status` },
    { n: `Etat DTP :`, c: `show dtp interface ${val.interface}` },
    { n: 'Voisin de l autre cote :', c: 'show cdp neighbors' },
    { n: 'Les VLAN existent-ils ici ?', c: 'show vlan brief' },
  ],
  finFichier: () => [
    'COMMENT LIRE LE RESULTAT',
    '- Status doit etre trunking. Si le port est absent de show interfaces trunk, il n est pas en trunk.',
    '- Native vlan : le meme des deux cotes, sinon message %CDP-4-NATIVE_VLAN_MISMATCH.',
    '- Vlans allowed on trunk -> allowed and active -> forwarding : un VLAN qui disparait entre deux listes explique pourquoi il ne passe pas.',
    '- Ce fichier ne produit aucun diagnostic : il liste les lectures a faire.',
  ],
  prereqs: [...PREREQ_COMMUN],
  commonErrors: [
    { message: 'show dtp interface : Invalid input', cause: 'Commande absente de ce modèle ou de ce simulateur.', fix: 'Saute cette ligne : show interfaces <port> switchport montre déjà le mode négocié.' },
    ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Colle la lecture.', 'Compare les deux extrémités.'],
  checks: ['Le port est « trunking » et le natif est identique des deux côtés.', 'Le VLAN attendu figure dans les trois listes.'],
  verifyAfter: ['Refaire la lecture sur l’autre commutateur.', 'Comparer les VLAN autorisés des deux extrémités.'],
  rollback: RETOUR_STANDARD('Lecture seule : rien à défaire.', 'show interfaces trunk', 'show interfaces trunk'),
  source: SRC.trunks.url,
  sources: [SRC.trunks, SRC.layer2Commandes],
  cisco: {
    probleme: 'Deux commutateurs sont reliés mais un VLAN ne passe pas, ou le trunk n’apparaît pas.',
    utilite: 'Un diagnostic de trunk lit le mode, le natif et trois listes de VLAN, dans cet ordre.',
    exemple: 'PC du VLAN 20 sur AS1 qui n’atteint pas AS2 : le VLAN 20 est-il dans « allowed » ? « active » ? « forwarding » ?',
    lecture: ['show interfaces trunk', 'show interfaces <port> switchport', 'show interfaces <port> status', 'show cdp neighbors'],
    effets: ['Aucun : lecture seule.'],
    attendu: ['Status trunking ; natif identique ; VLAN présent dans les trois listes.'],
    limites: ['Une procédure de lecture n’est pas un diagnostic exécuté.', 'Pour analyser une sortie collée, utilise l’assistant « parcours de diagnostic ».'],
  },
});

// ---------------------------------------------------------------------------
// 6. Simulation DTP
// ---------------------------------------------------------------------------
const OPTIONS_DTP = MODES_DTP.map(([k, l]) => [k, l]);
export const ciscoDtpSimulation = outilCisco({
  id: 'cisco-dtp-simulation',
  famille: F_TRUNK,
  title: 'DTP : simulation pédagogique (auto, desirable, access, trunk)',
  summary: 'Choisir le mode des deux extrémités et lire ce que DTP devrait produire. Simulation d’enseignement : rien n’est lu sur un équipement.',
  keywords: ['dtp', 'dynamic auto', 'dynamic desirable', 'access', 'trunk', 'nonegotiate', 'simulation', 'cisco'],
  interface: true,
  champs: [
    { id: 'ciscoDtpLocal', label: 'Mode côté DS1 (ce commutateur)', type: 'select', default: 'auto', options: OPTIONS_DTP },
    { id: 'ciscoDtpDistant', label: 'Mode côté AS1 (voisin)', type: 'select', default: 'desirable', options: OPTIONS_DTP },
    champInterface('Le port local, pour les lectures proposées (exercice du cours : Fa0/7 ou Fa0/9).'),
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const cles = MODES_DTP.map(([k]) => k);
    const a = validerChoixCisco(v.ciscoDtpLocal, cles, 'Le mode local'); if (!a.ok) errors.ciscoDtpLocal = a.error; else val.local = a.valeur;
    const b = validerChoixCisco(v.ciscoDtpDistant, cles, 'Le mode distant'); if (!b.ok) errors.ciscoDtpDistant = b.error; else val.distant = b.valeur;
    const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    return { errors, val };
  },
  lecture: (val) => [
    { n: 'Pour comparer la simulation a la realite (a faire des DEUX cotes) :', c: `show interfaces ${val.interface} switchport` },
    { c: `show dtp interface ${val.interface}` },
    { c: 'show interfaces trunk' },
  ],
  finFichier: (val) => {
    const r = simulerDtp(val.local, val.distant);
    const libelle = { trunk: 'TRUNK', access: 'ACCESS (pas de trunk)', incoherent: 'INCOHERENT (a corriger)', indetermine: 'INDETERMINE' }[r.resultat];
    return [
      'SIMULATION DTP (enseignement - rien n a ete lu sur un equipement)',
      `Cote local : ${val.local} ; cote distant : ${val.distant}`,
      `Resultat attendu : ${libelle}`,
      `Raison : ${r.raison}`,
      'Commandes correspondantes (a titre d explication, non collees par cet assistant) :',
      ...MODES_DTP.filter(([k]) => k === val.local || k === val.distant).map(([k, l]) => `  ${k} -> ${l.split(' — ')[0]}`),
      'Le comportement reel depend du modele, de la version et du simulateur : verifie avec show interfaces switchport des deux cotes.',
      'Exercice du cours : la configuration explicite (mode trunk fixe des deux cotes) est preferable a la negociation DTP.',
    ];
  },
  prereqs: [...PREREQ_COMMUN],
  commonErrors: [
    { message: 'Les deux côtés en dynamic auto : pas de trunk', cause: 'Personne ne propose le trunk.', fix: 'Passe un côté en desirable ou en trunk.' },
    { message: 'Trunk d’un côté, access de l’autre', cause: 'Configuration incohérente : les trames ne sont pas étiquetées de la même façon.', fix: 'Aligne les deux côtés.' },
    ERREUR_MODE,
  ],
  gui: ['Choisis le mode de chaque côté.', 'Lis le résultat attendu dans le fichier.', 'Compare avec show interfaces switchport sur les deux commutateurs en laboratoire.'],
  checks: ['Le résultat simulé correspond à la lecture réelle des deux côtés.'],
  verifyAfter: ['Confirme avec « show interfaces trunk » des deux côtés.', 'Relis show interfaces <port> switchport : mode opérationnel identique à la simulation.'],
  rollback: RETOUR_STANDARD('Lecture seule : rien à défaire.', 'show interfaces <port> switchport', 'show interfaces <port> switchport'),
  source: SRC.trunks.url,
  sources: [SRC.trunks, SRC.layer2Commandes],
  cisco: {
    probleme: 'Les modes dynamiques de DTP se négocient : on ne sait pas toujours prédire si le trunk va se former.',
    utilite: 'La simulation explique pourquoi auto/auto ne forme pas de trunk et pourquoi un trunk fixe face à un access est un défaut.',
    exemple: 'DS1 Fa0/7 en dynamic auto face à AS1 Fa0/7 en dynamic desirable : trunk attendu.',
    lecture: ['show interfaces <port> switchport : mode administratif et opérationnel.', 'show dtp interface <port> : état de la négociation.'],
    effets: ['Aucun : simulation et lecture seules.'],
    attendu: ['La matrice : auto/auto → access ; auto/desirable → trunk ; desirable/desirable → trunk ; trunk/access → incohérent.'],
    limites: ['Modèle d’enseignement : il ne reproduit pas tous les cas limites d’IOS ni de Packet Tracer.', 'Aucun résultat observé sur équipement n’est présenté ici.', 'Le mode par défaut des ports dépend du modèle.'],
  },
});
export { simulerDtp, matriceDtp };

// ---------------------------------------------------------------------------
// 7. Diagnostic VTP
// ---------------------------------------------------------------------------
export const ciscoVtpDiagnostic = outilCisco({
  id: 'cisco-vtp-diagnostic',
  famille: F_VTP,
  title: 'VTP : diagnostic (mode, domaine, version, révision)',
  summary: 'Lire l’état VTP et, si tu colles la sortie de « show vtp status », obtenir une lecture assistée de ses champs. Lecture seule.',
  keywords: ['vtp', 'show vtp status', 'domaine', 'révision', 'mode', 'version', 'cisco'],
  champs: [
    { id: 'ciscoSortieVtp', label: 'Sortie de « show vtp status » (facultatif)', type: 'textarea', default: '', help: 'Colle seulement cette sortie. Aucune configuration, aucun mot de passe : le Toolkit refuse ce qui y ressemble.' },
  ],
  parse(v) {
    const errors = {}; const val = {};
    const s = validerSortieCollee(v.ciscoSortieVtp, 'La sortie VTP'); if (!s.ok) errors.ciscoSortieVtp = s.error; else val.sortie = s.valeur;
    return { errors, val };
  },
  lecture: () => [
    { n: 'Etat VTP : mode, domaine, version, revision, nombre de VLAN :', c: 'show vtp status' },
    { n: 'VTP ne circule que sur les trunks :', c: 'show interfaces trunk' },
    { c: 'show vlan brief' },
    { n: '« show vtp password » n est PAS propose : il affiche le mot de passe en clair.' },
  ],
  finFichier: (val) => {
    if (!val.sortie) return ['ANALYSE : aucune sortie collee. Colle « show vtp status » pour obtenir une lecture assistee.'];
    const p = analyserVtpStatus(val.sortie);
    if (!p.reconnu) return [`ANALYSE : NON RECONNU - ${p.raison}`];
    const l = ['ANALYSE DE LA SORTIE COLLEE (lecture de texte, pas un diagnostic execute)',
      `Mode : ${p.mode} ; domaine : ${p.domaine === '' ? '(vide)' : p.domaine} ; version : ${p.version ?? 'non lue'} ; revision : ${p.revision ?? 'non lue'} ; VLAN : ${p.vlans ?? 'non lu'}`];
    if (p.mode === 'transparent') l.push('- Mode transparent : pas de synchronisation de la base de VLAN.');
    if (p.mode === 'client') l.push('- Mode client : pas de creation de VLAN locale.');
    if (p.mode === 'server') l.push('- Mode serveur : cree et annonce des VLAN. Une revision plus elevee que celle du domaine ecraserait les autres commutateurs.');
    if (p.revision !== null && p.revision > 0) l.push(`- Revision ${p.revision} : a comparer avec celle du domaine avant tout raccordement.`);
    if (p.version3) l.push('- Ce commutateur annonce VTP version 3 : le Toolkit ne couvre que v1 et v2.');
    l.push('- Manque : le mot de passe VTP et la revision des AUTRES commutateurs ne sont pas dans cette sortie.');
    return l;
  },
  prereqs: [...PREREQ_COMMUN],
  commonErrors: [
    { message: 'Les VLAN ne se propagent pas', cause: 'Domaine différent (sensible à la casse), mot de passe différent, pas de trunk, ou mode transparent.', fix: 'Compare « show vtp status » des deux commutateurs, puis les trunks.' },
    ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Colle la lecture.', 'Colle la sortie dans le champ pour une lecture assistée (facultatif).'],
  checks: ['Même domaine, même version, mode attendu ; trunk actif.'],
  verifyAfter: ['Refaire la lecture sur chaque commutateur du domaine.', 'Comparer la révision et le nombre de VLAN entre commutateurs.'],
  rollback: RETOUR_STANDARD('Lecture seule : rien à défaire.', 'show vtp status', 'show vtp status'),
  source: SRC.vtpTechnote.url,
  sources: [SRC.vtpTechnote, SRC.vtp2960l, SRC.vlanCommandes],
  cisco: {
    probleme: 'Les VLAN créés sur un commutateur n’apparaissent pas (ou apparaissent de façon inattendue) sur les autres.',
    utilite: 'La lecture du mode, du domaine, de la version et de la révision explique la propagation.',
    exemple: 'DS1 serveur, AS1 et AS2 clients, domaine CCNA-LAB : un VLAN créé sur DS1 doit se retrouver sur AS1 et AS2.',
    lecture: ['show vtp status', 'show interfaces trunk', 'show vlan brief'],
    effets: ['Aucun : lecture seule.'],
    attendu: ['Même domaine et même version ; la révision augmente à chaque modification sur le serveur.'],
    limites: ['Formats reconnus : sorties anglaises de « show vtp status » (IOS 12.2 à 15.2). Un autre format est signalé NON RECONNU.', 'VTP version 3 est hors périmètre.', 'La sortie collée n’est jamais recopiée dans les commandes.'],
  },
});

// ---------------------------------------------------------------------------
// 8. Configuration VTP
// ---------------------------------------------------------------------------
export const ciscoVtpConfiguration = outilCisco({
  id: 'cisco-vtp-configuration',
  famille: F_VTP,
  title: 'VTP : mode, domaine et version (v1 / v2)',
  summary: 'Régler le mode VTP, le domaine et la version 1 ou 2. Le mot de passe VTP se tape à la main. VTP v3 est hors périmètre.',
  keywords: ['vtp', 'mode', 'server', 'client', 'transparent', 'domain', 'version', 'cisco'],
  modifie: true,
  champs: [
    { id: 'ciscoVtpMode', label: 'Mode VTP', type: 'select', default: 'client', options: [['server', 'server — crée et annonce des VLAN'], ['client', 'client — reçoit les VLAN'], ['transparent', 'transparent — ne synchronise pas, relaie']] },
    { id: 'ciscoVtpDomaine', label: 'Domaine VTP', type: 'text', default: 'CCNA-LAB', help: 'Sensible à la casse.' },
    { id: 'ciscoVtpVersion', label: 'Version', type: 'select', default: '2', options: [['1', 'Version 1'], ['2', 'Version 2']] },
    { id: 'ciscoVtpRevisionLue', label: 'J’ai lu « show vtp status » : la révision de ce commutateur est inférieure ou égale à celle du domaine (ou son mode est transparent)', type: 'checkbox', default: false },
    { id: 'ciscoVtpMotDePasse', label: 'Le domaine utilise un mot de passe VTP (à taper à la main)', type: 'checkbox', default: false },
  ],
  parse(v) {
    const errors = {}; const val = {};
    const m = validerChoixCisco(v.ciscoVtpMode, ['server', 'client', 'transparent'], 'Le mode VTP'); if (!m.ok) errors.ciscoVtpMode = m.error; else val.vtpMode = m.valeur;
    const d = validerDomaineVtp(v.ciscoVtpDomaine); if (!d.ok) errors.ciscoVtpDomaine = d.error; else val.domaine = d.valeur;
    const n = validerChoixCisco(String(v.ciscoVtpVersion), ['1', '2'], 'La version VTP (1 ou 2 ; la version 3 est hors périmètre)'); if (!n.ok) errors.ciscoVtpVersion = n.error; else val.version = n.valeur;
    val.revisionLue = bool(v.ciscoVtpRevisionLue);
    val.motDePasse = bool(v.ciscoVtpMotDePasse);
    if (v.ciscoMode === 'Configuration' && val.vtpMode && val.vtpMode !== 'transparent' && !val.revisionLue) {
      errors.ciscoVtpRevisionLue = 'Avant de passer en server ou client, lis la révision (show vtp status) et coche la case : une révision plus élevée écraserait la base de VLAN du domaine.';
    }
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER VTP ${val.domaine}`,
  lecture: () => [
    { n: 'Etat actuel (revision, domaine, mode) :', c: 'show vtp status' },
    { c: 'show vlan brief' },
    { c: 'show interfaces trunk' },
  ],
  config: (val) => {
    const l = [{ n: 'ATTENTION : un commutateur dont la revision est plus elevee que celle du domaine ECRASE les VLAN des autres. Lis show vtp status avant.' }, 'configure terminal', `vtp mode ${val.vtpMode}`];
    if (val.vtpMode !== 'transparent') l.push(`vtp domain ${val.domaine}`);
    else l.push({ n: 'En mode transparent le domaine peut rester inchange.' });
    l.push(`vtp version ${val.version}`);
    if (val.motDePasse) l.push({ m: 'vtp password <mot de passe du domaine>  (a taper sur la console : il ne figure jamais dans ce fichier)' });
    l.push('end');
    return l;
  },
  verification: () => [{ n: 'Controle apres modification :', c: 'show vtp status' }, { c: 'show vlan brief' }],
  retour: () => [{ n: 'Relis l etape 1 pour connaitre mode, domaine et version d origine, puis retape-les. Les VLAN deja recus ou perdus ne se recuperent pas par un simple retour de mode.' }, 'configure terminal', 'vtp mode <ancien mode>', 'vtp version <ancienne version>', 'end'],
  prereqs: [...PREREQ_COMMUN, 'La révision VTP de ce commutateur est connue (show vtp status).', 'Pour une version 3 : hors périmètre de cet assistant.'],
  commonErrors: [
    { message: '%VTP-4-... domaine ou mot de passe incohérent', cause: 'Domaine (casse comprise) ou mot de passe différent.', fix: 'Aligne le domaine et retape le mot de passe à la main des deux côtés.' },
    { message: 'Tous les VLAN ont disparu après un raccordement', cause: 'Un commutateur de révision plus élevée a écrasé la base du domaine.', fix: 'Voir l’assistant de raccordement : on remet la révision à 0 AVANT de brancher.' },
    ERREUR_PERTE_ACCES, ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Lis show vtp status et note la révision.', 'Règle le mode, le domaine et la version.', 'Tape le mot de passe VTP à la main si le domaine en a un.', 'Contrôle.'],
  checks: ['show vtp status : mode, domaine, version attendus.'],
  verifyAfter: ['Les VLAN du domaine apparaissent sur les clients.', 'La révision augmente après une modification faite sur le serveur.'],
  rollback: RETOUR_STANDARD('Rétablir le mode, le domaine et la version lus avant modification.', 'show vtp status', 'configure terminal\nvtp mode <ancien>\nend'),
  source: SRC.vtpTechnote.url,
  sources: [SRC.vtpTechnote, SRC.vtp2960l, SRC.vlanCommandes],
  cisco: {
    probleme: 'Maintenir la même base de VLAN sur plusieurs commutateurs à la main est long et source d’erreurs.',
    utilite: 'VTP annonce les VLAN d’un serveur aux clients du même domaine.',
    exemple: 'DS1 serveur du domaine CCNA-LAB ; AS1 et AS2 clients ; VLAN 10, 20, 30, 40, 50 créés une seule fois sur DS1.',
    lecture: ['show vtp status : révision, mode, domaine.', 'show vlan brief.', 'show interfaces trunk : VTP circule sur les trunks.'],
    effets: ['vtp mode : serveur, client ou transparent.', 'vtp domain : appartenance au domaine.', 'vtp version : 1 ou 2.', 'Le mot de passe se tape à la main.'],
    attendu: ['show vtp status reflète le mode, le domaine et la version choisis.'],
    limites: ['VTP v1 et v2 seulement ; v3 est traité à part et n’est pas couvert.', 'Aucun mot de passe VTP n’est accepté dans les champs.', 'Un mauvais raccordement peut écraser la base de VLAN du domaine : lis le checklist de raccordement.'],
  },
});

// ---------------------------------------------------------------------------
// 9. Raccordement à un domaine VTP existant
// ---------------------------------------------------------------------------
export const ciscoVtpRaccordement = outilCisco({
  id: 'cisco-vtp-raccordement',
  famille: F_VTP,
  title: 'VTP : liste de contrôle avant de rejoindre un domaine existant',
  summary: 'Ce qu’il faut lire et vérifier AVANT de brancher un commutateur sur un domaine VTP en production ou en laboratoire, pour ne pas écraser les VLAN.',
  keywords: ['vtp', 'raccordement', 'révision', 'revision', 'domaine', 'checklist', 'cisco'],
  champs: [
    { id: 'ciscoDomaineCible', label: 'Domaine VTP à rejoindre', type: 'text', default: 'CCNA-LAB' },
  ],
  parse(v) {
    const errors = {}; const val = {};
    const d = validerDomaineVtp(v.ciscoDomaineCible); if (!d.ok) errors.ciscoDomaineCible = d.error; else val.domaine = d.valeur;
    return { errors, val };
  },
  lecture: () => [
    { n: 'A lire sur le commutateur QUI VA ETRE RACCORDE, lien debranche :', c: 'show vtp status' },
    { c: 'show vlan brief' },
    { n: 'A lire sur un commutateur du domaine :', c: 'show vtp status' },
  ],
  finFichier: (val) => [
    'LISTE DE CONTROLE (procedure - rien n est execute)',
    `1. Domaine vise : ${val.domaine} (casse comprise).`,
    '2. Sur le commutateur a raccorder, LIEN DEBRANCHE, lis la revision (show vtp status).',
    '3. Compare avec la revision du domaine. Si elle est PLUS ELEVEE que celle du domaine, ce commutateur ecraserait les VLAN des autres.',
    '4. Remise de la revision a 0 : passer le commutateur en mode transparent, puis en mode client (ou changer le nom de domaine puis le remettre). Confirme avec show vtp status que la revision vaut 0. Cette etape modifie la configuration : fais-la avec l assistant de configuration VTP.',
    '5. Aligne le mode (client), le domaine, la version (1 ou 2) et tape le mot de passe a la main si le domaine en a un.',
    '6. Verifie qu un trunk existe vers le domaine (show interfaces trunk) et que son VLAN natif est identique.',
    '7. Raccorde, puis relis show vtp status et show vlan brief des deux cotes.',
    '8. En cas de doute, ne branche pas : cree les VLAN a la main en mode transparent.',
    'Les versions 1 et 2 sont couvertes ; la version 3 se traite a part.',
  ],
  prereqs: [...PREREQ_COMMUN, 'Le commutateur à raccorder est débranché du domaine pendant les lectures.'],
  commonErrors: [
    { message: 'Les VLAN du domaine disparaissent après le branchement', cause: 'Le commutateur ajouté avait une révision plus élevée et un mode serveur ou client.', fix: 'Restaure la base de VLAN du domaine à partir d’une sauvegarde de configuration, puis applique la liste de contrôle.' },
    ERREUR_MODE,
  ],
  gui: ['Lis show vtp status sur le commutateur à raccorder (lien débranché).', 'Compare la révision avec celle du domaine.', 'Remets la révision à 0 si nécessaire.', 'Raccorde, puis contrôle.'],
  checks: ['Révision du nouveau commutateur à 0 ou inférieure à celle du domaine avant le branchement.', 'Domaine, version et mot de passe identiques.'],
  verifyAfter: ['show vlan brief identique des deux côtés après le raccordement.', 'La révision et le domaine sont inchangés sur les commutateurs déjà en place.'],
  rollback: RETOUR_STANDARD('Procédure de lecture : rien à défaire.', 'show vtp status', 'show vtp status'),
  source: SRC.vtp3850.url,
  sources: [SRC.vtp3850, SRC.vtpTechnote, SRC.vtp2960l],
  cisco: {
    probleme: 'Un commutateur ajouté avec une révision VTP élevée peut effacer tous les VLAN d’un domaine.',
    utilite: 'La liste de contrôle impose de lire et comparer les révisions avant de brancher.',
    exemple: 'Un ancien commutateur de laboratoire est ajouté au domaine CCNA-LAB : on met sa révision à 0 avant de le raccorder.',
    lecture: ['show vtp status sur chaque commutateur.', 'show vlan brief.'],
    effets: ['Aucun : liste de contrôle et lectures seulement.'],
    attendu: ['La révision du nouvel arrivant est inférieure ou égale à celle du domaine.'],
    limites: ['La technique de remise à zéro de la révision (transparent puis client, ou changement de domaine) est à confirmer avec show vtp status sur le modèle utilisé.', 'Aucune manipulation n’est exécutée par le Toolkit.', 'VTP v3 : hors périmètre.'],
  },
});

// ---------------------------------------------------------------------------
// 10. Parcours de diagnostic guidés
// ---------------------------------------------------------------------------
export const ciscoParcoursDiagnostic = outilCisco({
  id: 'cisco-parcours-diagnostic',
  famille: F_VTP,
  title: 'Parcours guidés : trunk absent, VLAN non transporté, VLAN non propagé, PC injoignables',
  summary: 'Choisir le symptôme : l’assistant produit les lectures dans le bon ordre et, si tu colles les sorties, résume ce qu’elles montrent, ce qui manque et les limites.',
  keywords: ['diagnostic', 'parcours', 'trunk absent', 'vlan non propagé', 'pc injoignables', 'show vlan brief', 'show interfaces trunk', 'show vtp status', 'cisco'],
  interface: true,
  champs: [
    { id: 'ciscoScenario', label: 'Symptôme', type: 'select', default: 'trunk-absent', options: SCENARIOS },
    { id: 'ciscoVlan', label: 'VLAN concerné (si connu)', type: 'text', default: '' },
    champInterface('Le port du lien suspect (facultatif pour certains parcours).'),
    { id: 'ciscoSortieVlan', label: 'Sortie de « show vlan brief » (facultatif)', type: 'textarea', default: '' },
    { id: 'ciscoSortieTrunk', label: 'Sortie de « show interfaces trunk » (facultatif)', type: 'textarea', default: '' },
    { id: 'ciscoSortieVtp', label: 'Sortie de « show vtp status » (facultatif)', type: 'textarea', default: '' },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const s = validerChoixCisco(v.ciscoScenario, SCENARIOS.map(([k]) => k), 'Le symptôme'); if (!s.ok) errors.ciscoScenario = s.error; else val.scenario = s.valeur;
    if (String(v.ciscoVlan ?? '').trim() !== '') { const n = validerVlanIos(v.ciscoVlan, { lecture: true }); if (!n.ok) errors.ciscoVlan = n.error; else val.vlan = n.valeur; }
    if (String(v.ciscoInterface ?? '').trim() !== '') { const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur; }
    val.sorties = {};
    for (const [champ, cle, nom] of [['ciscoSortieVlan', 'vlan', 'La sortie « show vlan brief »'], ['ciscoSortieTrunk', 'trunk', 'La sortie « show interfaces trunk »'], ['ciscoSortieVtp', 'vtp', 'La sortie « show vtp status »']]) {
      const r = validerSortieCollee(v[champ], nom); if (!r.ok) errors[champ] = r.error; else val.sorties[cle] = r.valeur;
    }
    return { errors, val };
  },
  lecture: (val) => {
    const i = val.interface;
    const l = [];
    switch (val.scenario) {
      case 'trunk-absent':
        l.push({ n: 'Y a-t-il un trunk ?', c: 'show interfaces trunk' });
        if (i) l.push({ n: 'Mode administratif / operationnel du port :', c: `show interfaces ${i} switchport` }, { c: `show interfaces ${i} status` }, { c: `show dtp interface ${i}` });
        l.push({ n: 'Voisin :', c: 'show cdp neighbors' });
        break;
      case 'vlan-non-transporte':
        l.push({ n: 'Le VLAN existe-t-il ici ?', c: 'show vlan brief' }, { n: 'Autorise / actif / forwarding sur le trunk :', c: 'show interfaces trunk' });
        if (val.vlan) l.push({ n: 'Etat de spanning-tree pour ce VLAN :', c: `show spanning-tree vlan ${val.vlan}` });
        break;
      case 'vlan-non-propage':
        l.push({ n: 'Mode, domaine, version, revision :', c: 'show vtp status' }, { n: 'VTP circule sur les trunks :', c: 'show interfaces trunk' }, { c: 'show vlan brief' });
        break;
      default:
        l.push({ n: 'Les PC sont-ils dans le bon VLAN ?', c: 'show vlan brief' }, { n: 'Le VLAN traverse-t-il le trunk ?', c: 'show interfaces trunk' });
        if (i) l.push({ c: `show interfaces ${i} switchport` });
        l.push({ n: 'Adresses MAC apprises dans le VLAN :', c: val.vlan ? `show mac address-table vlan ${val.vlan}` : 'show mac address-table dynamic' });
    }
    return l;
  },
  finFichier: (val) => {
    const a = analyserParcours({ scenario: val.scenario, vlan: val.vlan, interface: val.interface, sorties: val.sorties });
    const out = ['ANALYSE DES SORTIES COLLEES (lecture de texte, pas un diagnostic execute sur l equipement)'];
    if (a.constats.length === 0 && a.manque.length === 0) out.push('Aucune sortie collee : rien a analyser. Suis les lectures ci-dessus puis colle les resultats.');
    for (const c of a.constats) out.push(`- Constat : ${c}`);
    for (const m of a.manque) out.push(`- Manque : ${m}`);
    for (const l of a.limites) out.push(`- Limite : ${l}`);
    return out;
  },
  prereqs: [...PREREQ_COMMUN],
  commonErrors: [
    { message: 'Sortie NON RECONNUE', cause: 'Autre langue, autre version, texte tronqué ou mauvaise commande.', fix: 'Recolle la sortie complète de la commande demandée.' },
    ERREUR_MODE,
  ],
  gui: ['Choisis le symptôme.', 'Suis les lectures dans l’ordre.', 'Colle les sorties dans les champs prévus pour une lecture assistée.', 'Applique les corrections avec l’assistant adapté (une à la fois).'],
  checks: ['Chaque constat est relu à la console avant toute modification.'],
  verifyAfter: ['Refaire la lecture après correction.', 'Un poste du VLAN concerné joint un voisin de l’autre commutateur.'],
  rollback: RETOUR_STANDARD('Lecture seule : rien à défaire.', 'show interfaces trunk', 'show interfaces trunk'),
  source: SRC.trunks.url,
  sources: [SRC.trunks, SRC.vlan, SRC.vtpTechnote],
  cisco: {
    probleme: 'Un symptôme réseau (pas de trunk, VLAN absent d’un côté, PC injoignables) a plusieurs causes possibles et on ne sait pas par où commencer.',
    utilite: 'Chaque parcours donne l’ordre des lectures et, sur sorties collées, résume constats, données manquantes et limites.',
    exemple: 'VLAN 20 créé sur DS1 mais pas vu sur AS1 : parcours « VLAN non propagé » → mode, domaine, révision, trunk.',
    lecture: ['show vlan brief', 'show interfaces trunk', 'show vtp status', 'show interfaces <port> switchport'],
    effets: ['Aucun : lecture seule. La sortie collée n’est jamais recopiée dans les commandes.'],
    attendu: ['Un constat par anomalie lisible, la liste de ce qui manque, les limites.'],
    limites: ['Formats pris en charge : show vlan brief, show interfaces trunk, show vtp status, en anglais (IOS 12.2 à 15.2) ; sinon NON RECONNU.', 'Le verdict ne vaut que pour le texte collé ; il n’est pas un diagnostic exécuté.', 'Les échantillons de test sont écrits à la main, non capturés sur équipement.'],
  },
});

export const toolsCiscoVlan = [
  ciscoVlanInventaire, ciscoVlanCreation, ciscoPortAccess, ciscoTrunkPreparation, ciscoTrunkDiagnostic,
  ciscoDtpSimulation, ciscoVtpDiagnostic, ciscoVtpConfiguration, ciscoVtpRaccordement, ciscoParcoursDiagnostic,
];
