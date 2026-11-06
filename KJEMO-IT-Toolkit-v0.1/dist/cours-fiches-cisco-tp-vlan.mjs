/**
 * cours-fiches-cisco-tp-vlan.mjs — KJEMO-CISCO-TP-VLAN-01/03 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * UNE fiche « TP complet » À CHAMPS : de la création des VLAN jusqu'au routage
 * inter-VLAN (routeur « sur un bâton »), en passant par l'accès SSH au
 * commutateur. On remplit les champs (VLAN de gestion, adresses, ports, premier
 * administrateur) et le TABLEAU des VLAN : une seule ligne au départ, on en
 * ajoute d'autres au besoin (jusqu'à 6) et chaque commande se recalcule.
 *
 * Les étapes sont rangées en neuf phases, dans l'ordre du laboratoire :
 *   1  Console du commutateur : état, nom, VLAN, adresse de gestion
 *   2  Console du commutateur : SSH
 *   3  Poste de gestion : première connexion SSH
 *   4  Par SSH : ports d'accès et trunk
 *   5  Routeur : une sous-interface par VLAN
 *   6  Les postes des VLAN
 *   7  Tests de bout en bout (dont un SSH à travers le routeur)
 *   8  Enregistrer
 *   9  Plus tard : ajouter un VLAN ou un deuxième administrateur
 *
 * Valeurs d'EXEMPLE (VLAN de gestion 99, un VLAN 10, Fa0/1, trunk Gi0/1,
 * routeur Gi0/0) : le Toolkit ne présume jamais tes ports ni tes adresses.
 * Aucun mot de passe n'est saisi ici : il se tape sur l'équipement.
 *
 * Rédigée à la main, dans nos mots. Le Toolkit n'exécute aucune commande : rien
 * n'a été essayé dans Packet Tracer ni sur du matériel réel.
 */
import { V_COURS } from './cours-outils.mjs';

const C2960 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960';
const C1000 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst1000/software/release/15-2_7_e';
const SRC_VLAN = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring VLANs (accès, trunks)', url: `${C2960}/swvlan.html` };
const SRC_SSH = { label: 'Catalyst 1000 — Configuring Secure Shell', url: `${C1000}/configuration_guides/sec/b_1527e_security_c1000_cg/configuring_secure_shell.html` };
const SRC_ITF = { label: 'Catalyst 1000 — Interface Characteristics (accès et trunk)', url: `${C1000}/configuration_guides/int_hw/b_1527e_int_and_hw_c1000_cg/configuring_interface_characteristics.html` };

const V_TP = `${V_COURS} Les valeurs proposées sont des exemples de laboratoire ; les sorties montrées sont écrites pour expliquer, pas copiées d’un équipement, et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.`;

// Lignes : l'invite s'affiche à côté, elle n'est jamais copiée. Le nom d'hôte étant un champ, l'invite est générique.
const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const swu = L('Switch>');
const sw = L('SW#');
const swc = L('SW(config)#');
const swv = L('SW(config-vlan)#');
const swi = L('SW(config-if)#');
const swl = L('SW(config-line)#');
const rtu = L('Router>');
const rt = L('R#');
const rtc = L('R(config)#');
const rti = L('R(config-if)#');
const rts = L('R(config-subif)#');
const pc = L('PC>');

const etape = (effet) => (phase, titre, explication, lignes, attendu, extra = {}) => ({ titre, phase, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');
// Les options sont affichées telles quelles (jamais remplacées) : on y montre la FORME de la commande,
// avec un mot pour chaque champ, sans « {{ }} ».
const MOT = { hoteSw: 'nom', hoteRouteur: 'nom', domaine: 'domaine', vlanGestion: 'numéro-vlan', vlan: 'numéro-vlan', nom: 'nom-vlan', gestionSwitch: 'adresse', gestionPasserelle: 'passerelle', gestionPrefixeMasque: 'masque', gestionPoste: 'adresse', admin: 'compte', admin2: 'compte', passerelle: 'passerelle', masque: 'masque', port: 'port', trunkSw: 'port', routeurItf: 'interface', portGestion: 'port', vlansPlan: 'liste-vlan', suivant_poste: 'adresse' };
const forme = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, id) => MOT[id] ?? 'valeur');
const opt = (option, explication) => ({ option: forme(option), explication: forme(explication) });

const P1 = 'Phase 1 — Console du commutateur : état, nom, VLAN et adresse de gestion';
const P2 = 'Phase 2 — Console du commutateur : SSH';
const P3 = 'Phase 3 — Poste de gestion : première connexion SSH';
const P4 = 'Phase 4 — Par SSH : ports d’accès et trunk';
const P5 = 'Phase 5 — Routeur : une sous-interface par VLAN';
const P6 = 'Phase 6 — Les postes des VLAN';
const P7 = 'Phase 7 — Tests de bout en bout';
const P8 = 'Phase 8 — Enregistrer';
const P9 = 'Phase 9 — Plus tard : ajouter un VLAN ou un deuxième administrateur';

/** Une ligne du tableau = un VLAN : son bloc de commandes se copie seul. */
const PAR_VLAN = (groupe, extra = {}) => ({ table: 'plan', groupe, ...extra });
const PAR_POSTE = (groupe) => ({ table: 'plan', separe: true, groupe });

const COLONNES_PLAN = [
  { id: 'vlan', label: 'VLAN', type: 'vlan', exemple: '10', aide: 'De 2 à 4094 (hors 1002-1005) ; différent du VLAN de gestion.' },
  { id: 'nom', label: 'Nom', type: 'nomVlan', exemple: 'VENTES', aide: 'Une lettre d’abord, sans espace.' },
  { id: 'reseau', label: 'Réseau', type: 'ipv4', exemple: '192.168.10.0', aide: 'Adresse du réseau (se termine par 0 pour un /24).' },
  { id: 'prefixe', label: 'Préfixe', type: 'prefixe', exemple: '24', aide: '8 à 30.' },
  { id: 'passerelle', label: 'Passerelle', type: 'ipv4', exemple: '192.168.10.1', aide: 'Adresse du routeur dans ce VLAN : celle des postes.' },
  { id: 'ports', label: 'Ports d’accès', type: 'listeInterfaces', exemple: 'Fa0/1', aide: 'Les ports du commutateur de ce VLAN, séparés par des virgules (ex. Fa0/1,Fa0/2).' },
  { id: 'poste', label: 'Poste de test', type: 'ipv4', exemple: '192.168.10.10', aide: 'Adresse à donner au poste de ce VLAN.' },
];

const PARAMS = [
  { id: 'hoteSw', label: 'nom du commutateur', type: 'hote', exemple: 'SW1', aide: 'Différent de « Switch » : IOS refuse de générer la clé SSH avec le nom par défaut.' },
  { id: 'domaine', label: 'nom de domaine', type: 'fqdn', exemple: 'tp.local', aide: 'Obligatoire pour la clé SSH : celui de ton laboratoire ou de l’école.' },
  { id: 'admin', label: 'premier administrateur SSH', type: 'identifiant', exemple: 'admin', aide: 'Lettres, chiffres, point, tiret. Le mot de passe se tape sur le commutateur : il n’est jamais saisi ici.' },
  { id: 'vlanGestion', label: 'VLAN de gestion', type: 'vlan', exemple: '99', aide: 'Le VLAN qui porte l’adresse du commutateur et le poste d’administration (99 est l’usage courant). Pas le VLAN 1.' },
  { id: 'gestionSwitch', label: 'adresse du commutateur', type: 'ipv4', exemple: '192.168.99.2', aide: 'L’adresse de gestion : celle à laquelle on se connecte en SSH.' },
  { id: 'gestionPasserelle', label: 'passerelle du VLAN de gestion', type: 'ipv4', exemple: '192.168.99.1', aide: 'L’adresse du routeur dans le VLAN de gestion.' },
  { id: 'gestionPrefixe', label: 'préfixe du réseau de gestion', type: 'prefixe', exemple: '24', aide: '8 à 30 (24 = 255.255.255.0).' },
  { id: 'gestionPoste', label: 'adresse du poste de gestion', type: 'ipv4', exemple: '192.168.99.10', aide: 'Le poste d’administration, dans le réseau de gestion.' },
  { id: 'portGestion', label: 'port du poste de gestion', type: 'interfaceIos', exemple: 'Fa0/24', aide: 'Le port du commutateur où est branché le poste d’administration. Il ne doit figurer dans aucune ligne du tableau.' },
  { id: 'trunkSw', label: 'port du commutateur vers le routeur', type: 'interfaceIos', exemple: 'Gi0/1', aide: 'Le port (Gi0/1, Gi1/0/1…) relié au routeur. Il ne doit figurer dans aucune ligne du tableau.' },
  { id: 'hoteRouteur', label: 'nom du routeur', type: 'hote', exemple: 'R1', aide: 'Le nom d’hôte du routeur.' },
  { id: 'routeurItf', label: 'interface du routeur vers le commutateur', type: 'interfaceRouteur', exemple: 'Gi0/0', aide: 'L’interface physique du routeur relié au commutateur (Gi0/0, Gi0/0/0…).' },
  { id: 'plan', label: 'tableau des VLAN', type: 'table', min: 1, max: 6, colonnes: COLONNES_PLAN, coherence: 'planVlan', exclure: ['trunkSw', 'portGestion'], exclureVlan: ['vlanGestion'],
    reseauGestion: { passerelle: 'gestionPasserelle', prefixe: 'gestionPrefixe' },
    agregats: [{ id: 'vlansPlan', colonne: 'vlan' }],
    exemple: [{ vlan: '10', nom: 'VENTES', reseau: '192.168.10.0', prefixe: '24', passerelle: '192.168.10.1', ports: 'Fa0/1', poste: '192.168.10.10' }] },
  { id: 'admin2', label: 'deuxième administrateur SSH (plus tard)', type: 'identifiant', exemple: 'tech2', aide: 'Seulement pour la phase 9. Pour un troisième, change simplement ce nom et recopie le bloc.' },
];

const ETAPES = [
  // 1 ------------------------------------------------------------------------
  lec(P1, 'Lire l’état de départ du commutateur',
    'Tu es en console sur le commutateur. Avant de modifier quoi que ce soit, tu regardes l’état de départ : quels VLAN existent (au départ, seulement le VLAN 1 et les quatre VLAN réservés) et quelles interfaces sont allumées.',
    [sw('show vlan brief'), sw('show ip interface brief')],
    'Le VLAN 1 « default » contient tous les ports ; les VLAN 1002 à 1005 sont réservés. Aucune interface VLAN n’a d’adresse.',
    { options: [
      opt('show vlan brief', 'Liste des VLAN avec leur nom, leur état et les ports qui y sont affectés.'),
      opt('show ip interface brief', 'Une ligne par interface : adresse IPv4 et états « up » ou « down ».'),
    ] }),
  // 2 ------------------------------------------------------------------------
  mod(P1, 'Nommer le commutateur et son domaine',
    'Deux réglages OBLIGATOIRES avant SSH : le nom d’hôte ET le domaine. Sans l’un des deux, IOS refuse de générer la clé (« Please define a hostname other than Switch » ou « Please define a domain-name first »). Tape bien LES DEUX lignes, dans l’ordre ; « enable » passe du mode utilisateur (>) au mode privilégié (#).',
    [swu('enable'), sw('configure terminal'), swc('hostname {{hoteSw}}'), swc('ip domain-name {{domaine}}')],
    'L’invite prend le nouveau nom dès qu’il est accepté. « ip domain-name » ne répond rien : le contrôle de l’étape de la clé RSA le vérifie.',
    { options: [
      opt('hostname {{hoteSw}}', 'Donne son nom au commutateur ; l’invite change tout de suite.'),
      opt('ip domain-name {{domaine}}', 'Le domaine du laboratoire : il entre dans le nom de la clé SSH.'),
    ] }),
  // 3 ------------------------------------------------------------------------
  mod(P1, 'Créer le VLAN de gestion',
    'Le VLAN de gestion porte l’adresse du commutateur et le poste d’administration. On le crée en premier : l’interface VLAN et le port du poste en ont besoin.',
    [swc('vlan {{vlanGestion}}'), swv('name GESTION'), swv('exit')],
    'Aucun message. Le VLAN de gestion existe, encore vide.',
    { options: [
      opt('vlan {{vlanGestion}}', 'Crée le VLAN de gestion (ou y entre s’il existe) ; l’invite passe en « config-vlan ».'),
      opt('name GESTION', 'Nom du VLAN, sans espace ; purement descriptif.'),
    ] }),
  // 4 ------------------------------------------------------------------------
  mod(P1, 'Créer les VLAN du tableau et leur donner un nom',
    'Un VLAN = un réseau logique séparé sur le même commutateur. Un bloc par ligne du tableau. Tu pars avec UN VLAN ; ajoute une ligne au tableau chaque fois que tu en veux un de plus : son bloc apparaît ici.',
    [swc('vlan {{vlan}}'), swv('name {{nom}}'), swv('exit')],
    'Aucun message. Les VLAN existent, encore vides (aucun port).',
    { repeter: PAR_VLAN('VLAN {{vlan}} ({{nom}})'),
      important: 'Un VLAN doit exister avant qu’on y affecte un port ou qu’on crée son interface VLAN. C’est pourquoi on les crée tous d’abord.',
      options: [
        opt('vlan {{vlan}}', 'Crée le VLAN (ou y entre s’il existe) ; l’invite passe en « config-vlan ».'),
        opt('name {{nom}}', 'Nom du VLAN, sans espace ; purement descriptif.'),
      ] }),
  // 5 ------------------------------------------------------------------------
  mod(P1, 'Mettre le port du poste de gestion dans le VLAN de gestion',
    'Tu branches le poste d’administration sur le port prévu et tu le places dans le VLAN de gestion : c’est de là qu’on se connectera en SSH. Le port est en mode « access » : il porte un seul VLAN, sans étiquette.',
    [swc('interface {{portGestion}}'), swi('switchport mode access'), swi('switchport access vlan {{vlanGestion}}'), swi('exit')],
    'Aucun message. « show vlan brief » montrera ce port dans GESTION.',
    { options: [
      opt('switchport mode access', 'Fixe le port en accès : un seul VLAN, trames non étiquetées.'),
      opt('switchport access vlan {{vlanGestion}}', 'Affecte le port au VLAN de gestion ; le VLAN doit déjà exister.'),
    ] }),
  // 6 ------------------------------------------------------------------------
  mod(P1, 'Donner une adresse de gestion au commutateur',
    'Un commutateur de niveau 2 n’a pas d’adresse sur ses ports : on lui en donne une sur une interface VLAN (SVI), ici celle du VLAN de gestion, avec la passerelle du futur routeur pour qu’on puisse le joindre depuis les autres VLAN.',
    [swc('interface vlan {{vlanGestion}}'), swi('ip address {{gestionSwitch}} {{gestionPrefixeMasque}}'), swi('no shutdown'), swi('exit'), swc('ip default-gateway {{gestionPasserelle}}')],
    'Après quelques secondes : « %LINEPROTO-5-UPDOWN: Line protocol on Interface Vlan…, changed state to up ». L’interface reste « down » tant qu’aucun port du VLAN de gestion n’est branché et allumé.',
    { important: 'Ne mets jamais l’adresse de gestion sur le VLAN 1 en production : ce VLAN contient tous les ports par défaut.',
      options: [
        opt('interface vlan {{vlanGestion}}', 'L’interface virtuelle (SVI) du VLAN de gestion : c’est elle qui porte l’adresse du commutateur.'),
        opt('ip address {{gestionSwitch}} {{gestionPrefixeMasque}}', 'L’adresse de gestion et son masque.'),
        opt('ip default-gateway {{gestionPasserelle}}', 'Passerelle d’un commutateur de niveau 2 : sans elle, il ne répond qu’aux postes de son propre VLAN.'),
      ] }),
  // 7 ------------------------------------------------------------------------
  mod(P2, 'Créer le compte local du premier administrateur',
    'SSH demande un nom d’utilisateur et un mot de passe. La ligne est volontairement incomplète : tu tapes toi-même le mot de passe juste après « secret ». Il ne passe jamais par cette page.',
    [swc('username {{admin}} privilege 15 secret', { secret: true })],
    'Aucun message : l’invite revient. Le mot de passe n’apparaît jamais dans la configuration, seulement son empreinte.',
    { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « secret » suivi d’une espace.', reponds: 'Tape le mot de passe demandé par ton énoncé sur la console, puis Entrée. Il s’affiche en clair pendant la frappe : vérifie que personne ne regarde.' }],
      options: [opt('username {{admin}} privilege 15 secret', 'Crée le compte avec tous les droits (niveau 15) ; « secret » stocke une empreinte du mot de passe, pas le mot de passe.')] }),
  // 8 ------------------------------------------------------------------------
  mod(P2, 'Contrôler le nom et le domaine, puis générer la clé RSA',
    'La clé identifie le commutateur auprès des clients SSH. Premier réflexe : relire le nom d’hôte et le domaine (ils doivent apparaître, et le nom ne doit plus être « Switch »). 2048 bits est le minimum raisonnable ; la génération prend quelques secondes.',
    [sw('show running-config | include ^hostname|^ip domain'), sw('configure terminal'), swc('crypto key generate rsa modulus 2048')],
    'Le contrôle affiche « hostname » et « ip domain-name » avec tes valeurs. Puis « The key modulus size is 2048 bits » et « %SSH-5-ENABLED: SSH 1.99 has been enabled ».',
    { interactions: [{ attend: 'Do you really want to replace them? [yes/no] (seulement si une clé existe déjà)', reponds: 'no — sauf si tu veux volontairement la remplacer : tous les clients devront accepter la nouvelle empreinte.' }],
      important: 'Si IOS répond « Please define a hostname other than Switch » : refais l’étape « Nommer le commutateur et son domaine ». S’il répond « Please define a domain-name first » : « ip domain-name » en configuration globale, puis relance la génération. Si tu as tapé « crypto key generate rsa » sans « modulus », IOS te demande la taille : réponds 2048.',
      options: [
        opt('show running-config | include ^hostname|^ip domain', 'Relit seulement la ligne du nom d’hôte et celle du domaine.'),
        opt('crypto key generate rsa modulus 2048', 'Génère la paire de clés RSA de l’hôte, de 2048 bits ; elle active SSH.'),
      ] }),
  // 9 ------------------------------------------------------------------------
  mod(P2, 'Activer SSH version 2 sur les lignes de connexion',
    'SSH version 2, puis les lignes vty (les connexions à distance) vérifient le compte local et n’acceptent plus que SSH.',
    [swc('ip ssh version 2'), swc('line vty 0 15'), swl('login local'), swl('transport input ssh'), swl('end')],
    'Aucun message ; l’invite revient au mode privilégié.',
    { important: 'Garde la console ouverte jusqu’à ce que la connexion SSH de la phase 3 réussisse : avec « transport input ssh », Telnet est refusé tout de suite. Selon le modèle, la plage des lignes est « 0 4 » ou « 0 15 » : « show running-config | section line vty » te la montre.',
      options: [
        opt('ip ssh version 2', 'N’accepte que SSH version 2 (la 1 est dépassée).'),
        opt('line vty 0 15', 'Sélectionne les lignes de connexion à distance.'),
        opt('login local', 'Les connexions vérifient les comptes créés sur le commutateur.'),
        opt('transport input ssh', 'N’autorise que SSH sur ces lignes (refuse Telnet).'),
      ] }),
  // 10 -----------------------------------------------------------------------
  lec(P3, 'Régler et vérifier l’adresse du poste de gestion',
    'Le poste d’administration est branché sur le port de gestion. Réglage : l’adresse du champ « adresse du poste de gestion », le masque du réseau de gestion et, comme passerelle, celle du VLAN de gestion. Dans Packet Tracer : clique sur le poste, onglet « Desktop », « IP Configuration ». Sous Windows : Paramètres réseau, propriétés IPv4. La commande ci-dessous ne fait que VÉRIFIER le réglage.',
    [pc('ipconfig')],
    'L’adresse IPv4, le masque et la passerelle par défaut que tu as saisis dans les champs.',
    { options: [opt('ipconfig', 'Affiche l’adresse, le masque et la passerelle du poste (sous Linux : « ip address »).')] }),
  // 11 -----------------------------------------------------------------------
  lec(P3, 'Se connecter en SSH au commutateur',
    'Premier test depuis le poste de gestion : il est dans le même VLAN que l’adresse de gestion, donc aucun routeur n’est nécessaire. La même commande marche dans Packet Tracer, sous Windows 10 et suivants, Linux et macOS (« ssh compte@adresse » est la forme équivalente). Le mot de passe se tape dans le terminal.',
    [pc('ssh -l {{admin}} {{gestionSwitch}}')],
    'L’invite du commutateur (le compte est de niveau 15) : tu travailles maintenant par SSH, sans câble console. Sous Windows ou Linux, la première connexion demande d’accepter l’empreinte de la clé (yes).',
    { important: '« Connection refused » : revois la phase 2. « Destination host unreachable » : revois l’adresse du poste, le port de gestion et l’interface VLAN de gestion.',
      options: [opt('ssh -l {{admin}} {{gestionSwitch}}', 'Ouvre une session SSH ; -l donne le nom du compte (forme équivalente : ssh compte@adresse).')] }),
  // 12 -----------------------------------------------------------------------
  lec(P3, 'Confirmer que tu travailles bien par SSH',
    'À partir d’ici, tout se fait dans la session SSH (la console peut rester branchée, au cas où). « show users » montre qui est connecté et par où : la ligne marquée d’un astérisque, c’est toi.',
    [sw('show users'), sw('show ip ssh')],
    'Une ligne « vty » avec ton compte et l’adresse du poste ; « SSH Enabled - version 2.0 ».',
    { options: [
      opt('show users', 'Les sessions ouvertes : console (con) ou vty (SSH).'),
      opt('show ip ssh', 'SSH est-il actif, en quelle version.'),
    ] }),
  // 13 -----------------------------------------------------------------------
  mod(P4, 'Entrer en configuration globale',
    'Les étapes suivantes modifient le commutateur : on passe d’abord en configuration globale (par SSH).',
    [sw('configure terminal')],
    'L’invite devient « (config)# ».'),
  // 14 -----------------------------------------------------------------------
  mod(P4, 'Affecter les ports d’accès de chaque VLAN',
    'Un bloc par VLAN du tableau, un « interface » par port : chaque port passe en accès dans son VLAN. Le port du poste de gestion est déjà fait et n’est pas touché (il porte ta session SSH).',
    [swc('interface {{port}}'), swi('switchport mode access'), swi('switchport access vlan {{vlan}}'), swi('exit')],
    'Aucun message. « show vlan brief » classera chaque port dans son VLAN. Les postes branchés perdent leur connexion le temps de renouveler leur adresse.',
    { repeter: PAR_VLAN('VLAN {{vlan}}', { liste: 'ports', alias: 'port' }),
      important: 'Si tu as ajouté un VLAN plus tard, copie seulement le bloc de sa ligne.',
      options: [opt('switchport access vlan {{vlan}}', 'Place le port dans ce VLAN ; le poste branché dessus appartient désormais à ce réseau.')] }),
  // 15 -----------------------------------------------------------------------
  mod(P4, 'Créer le trunk vers le routeur',
    'Le lien commutateur → routeur doit porter tous les VLAN sur un seul câble : c’est un trunk (802.1Q), où chaque trame porte une étiquette avec son numéro de VLAN. La liste contient le VLAN de gestion et les VLAN du tableau.',
    [swc('interface {{trunkSw}}'), swi('switchport mode trunk'), swi('switchport trunk allowed vlan {{vlanGestion}},{{vlansPlan}}'), swi('end')],
    'Aucun message, puis « %LINEPROTO-5-UPDOWN … changed state to up » quand le routeur sera branché et allumé.',
    { important: '« allowed vlan » REMPLACE la liste, il n’ajoute pas : c’est pourquoi cette commande les écrit tous. Pour un VLAN ajouté plus tard, utilise « add » (phase 9). Si « switchport mode trunk » répond « Invalid input », ce modèle demande d’abord « switchport trunk encapsulation dot1q ». Ta session SSH passe par le port de gestion, pas par ce trunk : elle ne coupe pas.',
      options: [
        opt('switchport mode trunk', 'Fixe le port en trunk : il transporte plusieurs VLAN, avec étiquettes.'),
        opt('switchport trunk allowed vlan {{vlanGestion}},{{vlansPlan}}', 'Ne laisse passer que ces VLAN sur le trunk (remplace la liste).'),
      ] }),
  // 16 -----------------------------------------------------------------------
  lec(P4, 'Vérifier les VLAN et le trunk',
    'Contrôle de la partie commutateur avant de passer au routeur.',
    [sw('show vlan brief'), sw('show interfaces trunk')],
    'Chaque VLAN avec ses ports d’accès (le port du trunk n’y figure pas). « show interfaces trunk » liste le port du trunk avec le mode « on », l’encapsulation 802.1q, le statut « trunking » et tes VLAN autorisés.',
    { options: [
      opt('show vlan brief', 'Les VLAN et leurs ports d’accès (les ports trunk n’y figurent pas).'),
      opt('show interfaces trunk', 'Les trunks actifs : mode, encapsulation, VLAN natif, VLAN autorisés et VLAN réellement transmis.'),
    ] }),
  // 17 -----------------------------------------------------------------------
  mod(P5, 'Routeur : nommer et allumer l’interface physique',
    'Sur le routeur, l’interface physique n’aura PAS d’adresse : elle porte seulement les sous-interfaces. Il suffit de l’allumer.',
    [rtu('enable'), rt('configure terminal'), rtc('hostname {{hoteRouteur}}'), rtc('interface {{routeurItf}}'), rti('no shutdown'), rti('exit')],
    'Aucun message d’erreur ; l’interface passe « up » quand le câble vers le port du trunk est branché.',
    { important: 'Ne donne pas d’adresse IP à l’interface physique : chaque passerelle est portée par sa sous-interface.',
      options: [opt('no shutdown', 'Allume l’interface (un routeur les livre éteintes).')] }),
  // 18 -----------------------------------------------------------------------
  mod(P5, 'Créer la sous-interface du VLAN de gestion',
    'La sous-interface du VLAN de gestion est la passerelle du commutateur et du poste d’administration. Elle est numérotée comme le VLAN, déclare l’étiquette 802.1Q à lire et porte l’adresse de la passerelle. « encapsulation » AVANT « ip address ».',
    [rtc('interface {{routeurItf}}.{{vlanGestion}}'), rts('encapsulation dot1Q {{vlanGestion}}'), rts('ip address {{gestionPasserelle}} {{gestionPrefixeMasque}}'), rts('exit')],
    'Aucun message d’erreur.',
    { options: [
      opt('interface {{routeurItf}}.{{vlanGestion}}', 'Crée la sous-interface (le numéro après le point est libre, on le fait suivre le VLAN).'),
      opt('encapsulation dot1Q {{vlanGestion}}', 'Cette sous-interface lit et écrit les trames étiquetées de ce VLAN.'),
    ] }),
  // 19 -----------------------------------------------------------------------
  mod(P5, 'Créer une sous-interface par VLAN du tableau',
    'Un bloc par ligne du tableau : sous-interface numérotée comme le VLAN, encapsulation 802.1Q de ce VLAN, et l’adresse de la passerelle avec son masque.',
    [rtc('interface {{routeurItf}}.{{vlan}}'), rts('encapsulation dot1Q {{vlan}}'), rts('ip address {{passerelle}} {{masque}}'), rts('exit')],
    'Aucun message d’erreur. Un chevauchement de réseaux serait refusé par IOS (« overlaps with … ») : le tableau est déjà contrôlé ici.',
    { repeter: PAR_VLAN('VLAN {{vlan}} — {{passerelle}}/{{prefixe}}'),
      important: 'Le routage entre ces réseaux se fait tout seul : ils sont « directement connectés », sans route statique.',
      options: [
        opt('encapsulation dot1Q {{vlan}}', 'Cette sous-interface lit et écrit les trames étiquetées de ce VLAN.'),
        opt('ip address {{passerelle}} {{masque}}', 'L’adresse de la passerelle du VLAN ; les postes la prennent comme passerelle.'),
      ] }),
  // 20 -----------------------------------------------------------------------
  lec(P5, 'Vérifier le routeur',
    'Les sous-interfaces doivent être « up » avec l’adresse de leur passerelle, et chaque réseau doit apparaître comme directement connecté.',
    [rti('end'), rt('show ip interface brief'), rt('show ip route')],
    'Une sous-interface « up / up » par VLAN (gestion comprise), avec les adresses saisies ; une route « C » (connectée) et une route « L » (locale) par réseau.',
    { options: [
      opt('show ip interface brief', 'État et adresse de chaque interface, sous-interfaces comprises.'),
      opt('show ip route', 'La table de routage : « C » = réseau directement connecté, « L » = adresse du routeur lui-même.'),
    ] }),
  // 21 -----------------------------------------------------------------------
  lec(P6, 'Régler les adresses des postes de chaque VLAN',
    'Un poste par VLAN, branché sur un port d’accès de son VLAN : donne-lui l’adresse « Poste de test » de sa ligne du tableau, le masque du réseau et, comme passerelle, la « Passerelle » de la même ligne. Packet Tracer : Desktop > IP Configuration ; Windows : propriétés IPv4. La commande ne fait que le vérifier.',
    [pc('ipconfig')],
    'Sur chaque poste : l’adresse de sa ligne et la passerelle de son VLAN. Une passerelle fausse est la première cause d’un ping qui n’aboutit pas hors du VLAN.',
    { repeter: PAR_POSTE('Poste du VLAN {{vlan}} ({{nom}}) — {{poste}}, passerelle {{passerelle}}'),
      options: [opt('ipconfig', 'Affiche adresse, masque et passerelle par défaut du poste.')] }),
  // 22 -----------------------------------------------------------------------
  lec(P7, 'Joindre la passerelle de son VLAN depuis chaque poste',
    'Premier test, le plus simple : chaque poste joint la passerelle de SON VLAN. Cela valide le poste, le port d’accès, le trunk et la sous-interface. Lance chaque bloc sur le poste du VLAN indiqué.',
    [pc('ping {{passerelle}}')],
    'Des réponses « Reply from … ». Le premier paquet peut se perdre pendant la résolution ARP : c’est normal, les suivants répondent.',
    { repeter: PAR_POSTE('Poste du VLAN {{vlan}} → passerelle {{passerelle}}'),
      options: [opt('ping {{passerelle}}', 'Envoie des paquets à la passerelle et attend la réponse.')] }),
  // 23 -----------------------------------------------------------------------
  lec(P7, 'Joindre le poste de gestion depuis chaque VLAN (routage entre VLAN)',
    'Le test du TP : depuis le poste de chaque VLAN, joindre le poste de gestion, dans un AUTRE VLAN. Le trafic monte au routeur par le trunk, est routé, puis redescend dans le VLAN de gestion.',
    [pc('ping {{gestionPoste}}')],
    'Des réponses. Si le ping marche dans le VLAN mais pas entre VLAN, le coupable est presque toujours le trunk, une sous-interface ou une passerelle.',
    { repeter: PAR_POSTE('Poste du VLAN {{vlan}} → poste de gestion {{gestionPoste}}'),
      important: 'Les pare-feu des systèmes d’exploitation (Windows) bloquent souvent le ping reçu : si Packet Tracer répond mais pas un vrai poste, regarde d’abord son pare-feu.',
      options: [opt('ping {{gestionPoste}}', 'Test de bout en bout entre deux VLAN.')] }),
  // 24 -----------------------------------------------------------------------
  lec(P7, 'Joindre le poste d’un autre VLAN du tableau (facultatif)',
    'À partir de deux VLAN dans le tableau : chaque poste joint le poste de la ligne SUIVANTE (la dernière joint la première). Avec une seule ligne, ce test n’apporte rien : passe.',
    [pc('ping {{suivant_poste}}')],
    'Des réponses : le routage entre ces VLAN fonctionne.',
    { facultatif: true, repeter: PAR_POSTE('Poste du VLAN {{vlan}} → poste du VLAN {{suivant_vlan}} ({{suivant_poste}})'),
      options: [opt('ping {{suivant_poste}}', 'Joint le poste du VLAN suivant du tableau, à travers le routeur.')] }),
  // 25 -----------------------------------------------------------------------
  lec(P7, 'Joindre le commutateur par SSH depuis chaque VLAN',
    'Preuve finale, la plus parlante : le poste de chaque VLAN ouvre une session SSH sur l’adresse de gestion du commutateur, dans le VLAN de gestion. Pour y arriver il faut TOUT : le port d’accès, le trunk, le routeur, la passerelle par défaut du commutateur et SSH.',
    [pc('ssh -l {{admin}} {{gestionSwitch}}')],
    'L’invite du commutateur après le mot de passe. Si ça échoue alors que le ping de l’adresse du commutateur répond, relis « ip default-gateway » sur le commutateur ; si le ping échoue aussi, relis le routage.',
    { repeter: PAR_POSTE('Poste du VLAN {{vlan}} → SSH vers {{gestionSwitch}}'),
      options: [opt('ssh -l {{admin}} {{gestionSwitch}}', 'Ouvre la session SSH sur le commutateur depuis un autre VLAN, à travers le routeur.')] }),
  // 26 -----------------------------------------------------------------------
  lec(P7, 'Lire les tables pour comprendre ce qui s’est passé',
    'Après les tests, les tables montrent le chemin : le commutateur a appris les adresses MAC par VLAN, le routeur a la correspondance IP ↔ MAC de chaque passerelle.',
    [sw('show mac address-table'), rt('show ip arp'), rt('show ip route connected')],
    'Dans la table MAC : un poste par VLAN sur son port, et l’adresse MAC du routeur sur le port du trunk dans chaque VLAN. Dans la table ARP : les postes des réseaux testés.',
    { options: [
      opt('show mac address-table', 'Commutateur : quelle adresse MAC est apprise sur quel port et dans quel VLAN.'),
      opt('show ip arp', 'Routeur : correspondance adresse IP ↔ adresse MAC des machines jointes.'),
      opt('show ip route connected', 'Seulement les réseaux directement connectés au routeur.'),
    ] }),
  // 27 -----------------------------------------------------------------------
  mod(P8, 'Enregistrer la configuration des deux équipements',
    'À faire seulement quand tous les tests ont réussi. Sans cela, tout disparaît au redémarrage. Une fois sur le commutateur (par SSH), une fois sur le routeur.',
    [sw('copy running-config startup-config'), rt('copy running-config startup-config')],
    '« Destination filename [startup-config]? » : Entrée. Puis « [OK] ». Selon le modèle, « write memory » fait la même chose.',
    { important: 'Si tu as encore besoin de défaire des essais, fais-le avant d’enregistrer.',
      options: [opt('copy running-config startup-config', 'Copie la configuration active (mémoire vive) vers la configuration de démarrage (NVRAM).')] }),
  // 28 -----------------------------------------------------------------------
  mod(P9, 'Plus tard : laisser passer un nouveau VLAN sur le trunk',
    'Pour AJOUTER un VLAN après coup : ajoute une ligne au tableau, puis refais, pour CETTE ligne seulement, les blocs des étapes « Créer les VLAN du tableau », « Affecter les ports d’accès », « Créer une sous-interface par VLAN » et les tests. Ici, « add » ajoute le VLAN au trunk SANS effacer les autres (contrairement à la commande de la phase 4).',
    [sw('configure terminal'), swc('interface {{trunkSw}}'), swi('switchport trunk allowed vlan add {{vlan}}'), swi('end')],
    'Aucun message. « show interfaces trunk » liste le nouveau VLAN dans « allowed » puis « forwarding ».',
    { facultatif: true, repeter: PAR_VLAN('Ajouter le VLAN {{vlan}} au trunk'),
      important: 'Copie le bloc du VLAN NOUVEAU seulement : les autres sont déjà autorisés.',
      options: [opt('switchport trunk allowed vlan add {{vlan}}', 'Ajoute ce VLAN à la liste du trunk sans remplacer la liste existante.')] }),
  // 29 -----------------------------------------------------------------------
  mod(P9, 'Plus tard : créer le compte d’un deuxième administrateur',
    'Même principe que le premier compte : la ligne est volontairement incomplète, tu tapes le mot de passe toi-même. Pour un troisième administrateur, change le nom dans le champ et recopie le bloc. Fais-le dans une session déjà ouverte (SSH ou console).',
    [sw('configure terminal'), swc('username {{admin2}} privilege 15 secret', { secret: true })],
    'Aucun message : l’invite revient. Le mot de passe n’apparaît jamais dans la configuration, seulement son empreinte.',
    { facultatif: true,
      interactions: [{ secret: true, attend: 'La ligne copiée se termine par « secret » suivi d’une espace.', reponds: 'Tape le mot de passe du deuxième administrateur sur l’équipement, puis Entrée. Il s’affiche en clair pendant la frappe : vérifie que personne ne regarde.' }],
      important: 'Les lignes de connexion (« login local ») acceptent tout de suite le nouveau compte : rien d’autre à régler. Pour un compte limité, retire « privilege 15 ».',
      options: [opt('username {{admin2}} privilege 15 secret', 'Crée le compte du deuxième administrateur ; « secret » stocke une empreinte du mot de passe.')] }),
  // 30 -----------------------------------------------------------------------
  lec(P9, 'Plus tard : tester la connexion du deuxième administrateur',
    'Depuis le poste de gestion (ou un autre VLAN), ouvre une NOUVELLE session avec le nouveau compte, puis relis la liste des comptes.',
    [pc('ssh -l {{admin2}} {{gestionSwitch}}'), sw('show running-config | include ^username')],
    'La connexion réussit avec le deuxième compte. La liste montre une ligne « username » par administrateur, avec une empreinte (jamais le mot de passe).',
    { facultatif: true,
      options: [
        opt('ssh -l {{admin2}} {{gestionSwitch}}', 'Ouvre une session SSH avec le deuxième compte.'),
        opt('show running-config | include ^username', 'Relit seulement les lignes des comptes locaux.'),
      ] }),
];

export const COURS_CISCO_TP_VLAN = [{
  id: 'cours-tp-vlan-ssh-intervlan',
  titre: 'TP complet : VLAN, SSH et routage inter-VLAN (de A à Z)',
  categorie: 'Réseau et Cisco',
  resume: 'Le TP en une seule suite, à champs : VLAN de gestion, un tableau de VLAN (un seul au départ, on en ajoute au besoin), SSH, trunk, routeur « sur un bâton », tests, enregistrement, puis ajout d’un VLAN ou d’un deuxième administrateur plus tard.',
  effet: 'modification',
  intentions: ['tp vlan', 'tp vlan complet', 'vlan complet', 'tp inter-vlan', 'vlan ssh', 'créer des vlan routage inter-vlan ssh', 'vlan jusqu au routage inter-vlan', 'routage inter-vlan étape par étape', 'router on a stick tp', 'vlan ssh trunk routeur', 'ajouter un vlan', 'ajouter un administrateur ssh', 'vlan de gestion 99'],
  motsCles: ['tp', 'vlan', 'inter-vlan', 'intervlan', 'routage', 'ssh', 'trunk', 'routeur', 'commutateur', 'sous-interface', 'dot1q', 'router-on-a-stick', 'passerelle', 'gestion', 'vlan 99', 'cisco', 'ios', 'laboratoire', 'packet tracer',
    'switchport access vlan', 'switchport mode trunk', 'encapsulation dot1q', 'interface vlan', 'ip default-gateway', 'crypto key generate rsa', 'line vty', 'transport input ssh', 'switchport trunk allowed vlan add'],
  params: PARAMS,
  methodes: [{
    id: 'ios',
    privileges: 'Console du commutateur puis du routeur, mode privilégié (enable) puis configuration globale. Dès la phase 3, le commutateur se configure par SSH.',
    etapes: ETAPES,
    verification: [
      'Chaque poste joint la passerelle de son VLAN, puis le poste de gestion (dans un autre VLAN) : le routage entre VLAN fonctionne.',
      'Le poste de chaque VLAN ouvre une session SSH sur l’adresse du commutateur, à travers le routeur.',
      '« show interfaces trunk » montre le trunk avec le VLAN de gestion et les VLAN du tableau.',
    ],
    retour: 'Pour défaire : les étapes « Annuler » en bas de cette fiche, dans l’ordre inverse (routeur, trunk, ports, gestion, VLAN, SSH).',
    depannage: [
      { symptome: 'Le ping marche dans le VLAN mais pas d’un VLAN à l’autre', cause: 'Trunk absent ou VLAN non autorisé, sous-interface éteinte ou mal numérotée, mauvaise passerelle sur le poste.', action: '« show interfaces trunk » (VLAN autorisés), « show ip interface brief » sur le routeur (sous-interfaces « up/up »), et « ipconfig » sur le poste.' },
      { symptome: 'La sous-interface refuse l’adresse IP (« overlaps » ou rien ne s’affiche)', cause: '« encapsulation dot1Q » oubliée ou posée après l’adresse, ou adresse qui chevauche un autre réseau.', action: 'Repose « encapsulation dot1Q N » AVANT « ip address » et relis « show running-config interface » de la sous-interface.' },
      { symptome: '« Please define a hostname other than Switch » ou « Please define a domain-name first » à la génération de la clé', cause: 'Le nom d’hôte est resté « Switch » ou le domaine n’a pas été posé : les deux sont exigés avant « crypto key generate rsa ».', action: 'En configuration globale : « hostname » puis « ip domain-name » avec tes valeurs, vérifie avec « show running-config | include ^hostname|^ip domain », puis relance « crypto key generate rsa modulus 2048 ».' },
      { symptome: 'SSH : « Connection refused » ou délai dépassé', cause: 'Clé RSA absente, lignes vty qui n’autorisent pas SSH, ou interface VLAN de gestion éteinte.', action: '« show ip ssh » (SSH actif ?), « show running-config | section line vty », « show ip interface brief » (interface VLAN de gestion « up/up »).' },
      { symptome: 'Le ping du commutateur répond depuis le VLAN de gestion mais pas depuis les autres', cause: 'La passerelle par défaut du commutateur manque ou est fausse.', action: '« show running-config | include default-gateway » ; sinon « ip default-gateway » avec la passerelle du VLAN de gestion.' },
      { symptome: 'Un VLAN ajouté plus tard ne passe pas', cause: 'Le VLAN n’est pas dans la liste du trunk, ou la sous-interface correspondante n’existe pas.', action: 'Phase 9 : « switchport trunk allowed vlan add » pour ce VLAN, puis le bloc de sa sous-interface sur le routeur.' },
      { symptome: '« Invalid input detected » sur « switchport mode trunk »', cause: 'Ce modèle négocie encore l’encapsulation et exige de la fixer d’abord.', action: 'Tape « switchport trunk encapsulation dot1q » juste avant « switchport mode trunk ».' },
    ],
  }],
  assistant: null,
  sources: [SRC_VLAN, SRC_SSH, SRC_ITF],
  validation: V_TP,
  origine: 'cours',
  figures: ['tp-vlan-topologie', 'tp-vlan-chemin'],
  rappel: { titre: 'Rappel : l’ordre qui marche', points: ['VLAN d’abord, puis les ports, puis l’adresse de gestion : un port ne peut être affecté qu’à un VLAN qui existe.', 'Le poste de gestion et l’adresse du commutateur sont dans le MÊME VLAN : le trunk peut alors être modifié sans couper la session SSH.', 'Routeur sur un bâton : une sous-interface par VLAN, « encapsulation dot1Q N » avant « ip address ».', 'Un VLAN de plus = une ligne de plus dans le tableau ; un administrateur de plus = le champ du deuxième compte (phase 9).'] },
}];
