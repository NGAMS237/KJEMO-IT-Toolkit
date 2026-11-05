/**
 * cours-fiches-cisco-tp-vlan.mjs — KJEMO-CISCO-TP-VLAN-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * UNE fiche « TP complet » : de la création de trois VLAN jusqu'au routage
 * inter-VLAN (routeur « sur un bâton »), en passant par l'accès SSH au
 * commutateur. Les étapes sont rangées en huit phases dans l'ordre où on les
 * fait au laboratoire :
 *
 *   1  Console du commutateur : nom et trois VLAN
 *   2  Console du commutateur : SSH
 *   3  Poste de gestion : première connexion SSH
 *   4  Par SSH : ports d'accès et trunk
 *   5  Routeur : une sous-interface par VLAN
 *   6  Les deux autres postes
 *   7  Tests de bout en bout (dont un SSH à travers le routeur)
 *   8  Enregistrer
 *
 * Plan d'adressage FIXE (exemple de laboratoire) : la fiche l'affiche en tête,
 * les commandes le reprennent mot pour mot. Pour un autre plan, remplace les
 * numéros de VLAN, les adresses et les ports dans les commandes copiées.
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

const V_TP = `${V_COURS} Le plan d’adressage est un exemple de laboratoire ; les sorties montrées sont écrites pour expliquer, pas copiées d’un équipement, et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.`;

// Lignes : l'invite s'affiche à côté, elle n'est jamais copiée.
const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const swu = L('Switch>');
const sw = L('Switch#');
const swc = L('Switch(config)#');
const swv = L('Switch(config-vlan)#');
const swi = L('Switch(config-if)#');
const swl = L('Switch(config-line)#');
const s1 = L('SW1#');
const s1c = L('SW1(config)#');
const s1i = L('SW1(config-if)#');
const s1l = L('SW1(config-line)#');
const s1r = L('SW1(config-if-range)#');
const rtu = L('Router>');
const rt = L('R1#');
const rtc = L('R1(config)#');
const rti = L('R1(config-if)#');
const rts = L('R1(config-subif)#');
const pc = L('PC>');

const etape = (effet) => (phase, titre, explication, lignes, attendu, extra = {}) => ({ titre, phase, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');
const opt = (option, explication) => ({ option, explication });

export const PLAN_TP_VLAN = {
  vlans: [
    { id: 10, nom: 'VENTES', reseau: '192.168.10.0/24', passerelle: '192.168.10.1', poste: '192.168.10.10', port: 'FastEthernet0/1' },
    { id: 20, nom: 'TECHNIQUE', reseau: '192.168.20.0/24', passerelle: '192.168.20.1', poste: '192.168.20.10', port: 'FastEthernet0/2' },
    { id: 30, nom: 'GESTION', reseau: '192.168.30.0/24', passerelle: '192.168.30.1', poste: '192.168.30.10', port: 'FastEthernet0/3' },
  ],
  commutateur: { nom: 'SW1', adresseGestion: '192.168.30.2', trunk: 'GigabitEthernet0/1' },
  routeur: { nom: 'R1', interface: 'GigabitEthernet0/0' },
  compte: 'admin',
  domaine: 'tp.local',
};

const P1 = 'Phase 1 — Console du commutateur : état, nom et trois VLAN';
const P2 = 'Phase 2 — Console du commutateur : SSH';
const P3 = 'Phase 3 — Poste de gestion : première connexion SSH';
const P4 = 'Phase 4 — Par SSH : ports d’accès et trunk';
const P5 = 'Phase 5 — Routeur : une sous-interface par VLAN';
const P6 = 'Phase 6 — Les deux autres postes';
const P7 = 'Phase 7 — Tests de bout en bout';
const P8 = 'Phase 8 — Enregistrer';

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
    [swu('enable'), sw('configure terminal'), swc('hostname SW1'), s1c('ip domain-name tp.local')],
    'L’invite devient « SW1(config)# » dès que le nom est accepté. « ip domain-name » ne répond rien : vérifie-le avec l’étape suivante de contrôle avant de générer la clé.',
    { options: [
      opt('hostname SW1', 'Donne son nom au commutateur ; l’invite change tout de suite.'),
      opt('ip domain-name tp.local', 'Le domaine du laboratoire : il entre dans le nom de la clé SSH (SW1.tp.local).'),
    ] }),
  // 3 ------------------------------------------------------------------------
  mod(P1, 'Créer les trois VLAN et leur donner un nom',
    'Un VLAN = un réseau logique séparé sur le même commutateur. Les noms sont facultatifs mais rendent « show vlan brief » lisible. Le VLAN 30 sert à la gestion : le commutateur et le poste d’administration y seront.',
    [s1c('vlan 10'), swv('name VENTES'), swv('exit'), s1c('vlan 20'), swv('name TECHNIQUE'), swv('exit'), s1c('vlan 30'), swv('name GESTION'), swv('exit')],
    'Aucun message. Les trois VLAN existent, encore vides (aucun port).',
    { important: 'Un VLAN doit exister avant qu’on y affecte un port ou qu’on crée son interface VLAN. C’est pourquoi on les crée tous d’abord, y compris les deux dont on ne se sert qu’à la phase 4.',
      options: [
        opt('vlan 10', 'Crée le VLAN 10 (ou y entre s’il existe) ; l’invite passe en « config-vlan ».'),
        opt('name VENTES', 'Nom du VLAN, sans espace ; purement descriptif.'),
      ] }),
  // 4 ------------------------------------------------------------------------
  mod(P1, 'Mettre le port du poste de gestion dans le VLAN 30',
    'On branche le poste d’administration sur FastEthernet0/3 et on le place dans le VLAN 30 : c’est de là qu’on se connectera en SSH. Le port est en mode « access » : il porte un seul VLAN, sans étiquette.',
    [s1c('interface fastEthernet 0/3'), s1i('switchport mode access'), s1i('switchport access vlan 30'), s1i('exit')],
    'Aucun message. « show vlan brief » montrera Fa0/3 dans GESTION.',
    { options: [
      opt('switchport mode access', 'Fixe le port en accès : un seul VLAN, trames non étiquetées.'),
      opt('switchport access vlan 30', 'Affecte le port au VLAN 30 ; le VLAN doit déjà exister.'),
    ] }),
  // 5 ------------------------------------------------------------------------
  mod(P1, 'Donner une adresse de gestion au commutateur',
    'Un commutateur de niveau 2 n’a pas d’adresse sur ses ports : on lui en donne une sur une interface VLAN (SVI). Ici dans le VLAN 30, avec la passerelle du futur routeur pour qu’on puisse le joindre depuis les autres VLAN.',
    [s1c('interface vlan 30'), s1i('ip address 192.168.30.2 255.255.255.0'), s1i('no shutdown'), s1i('exit'), s1c('ip default-gateway 192.168.30.1')],
    'Après quelques secondes : « %LINEPROTO-5-UPDOWN: Line protocol on Interface Vlan30, changed state to up ». L’interface reste « down » tant qu’aucun port du VLAN 30 n’est branché et allumé.',
    { important: 'Ne mets jamais l’adresse de gestion sur le VLAN 1 en production : ce VLAN contient tous les ports par défaut. Ici le VLAN 30 est dédié.',
      options: [
        opt('interface vlan 30', 'L’interface virtuelle (SVI) du VLAN 30 : c’est elle qui porte l’adresse du commutateur.'),
        opt('ip address 192.168.30.2 255.255.255.0', 'L’adresse de gestion et son masque (/24).'),
        opt('ip default-gateway 192.168.30.1', 'Passerelle d’un commutateur de niveau 2 : sans elle, il ne répond qu’aux postes de son propre VLAN.'),
      ] }),
  // 6 ------------------------------------------------------------------------
  mod(P2, 'Créer le compte local',
    'SSH demande un nom d’utilisateur et un mot de passe. La ligne est volontairement incomplète : tu tapes toi-même le mot de passe juste après « secret ». Il ne passe jamais par cette page.',
    [s1c('username admin privilege 15 secret', { secret: true })],
    'Aucun message : l’invite revient. Le mot de passe n’apparaît jamais dans la configuration, seulement son empreinte.',
    { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « secret » suivi d’une espace.', reponds: 'Tape le mot de passe demandé par ton énoncé sur la console, puis Entrée. Il s’affiche en clair pendant la frappe : vérifie que personne ne regarde.' }],
      options: [opt('username admin privilege 15 secret', 'Crée le compte « admin » avec tous les droits (niveau 15) ; « secret » stocke une empreinte du mot de passe, pas le mot de passe.')] }),
  // 7 ------------------------------------------------------------------------
  mod(P2, 'Contrôler le nom et le domaine, puis générer la clé RSA',
    'La clé identifie le commutateur auprès des clients SSH. Premier réflexe : relire le nom d’hôte et le domaine (ils doivent apparaître, et le nom ne doit plus être « Switch »). 2048 bits est le minimum raisonnable ; la génération prend quelques secondes.',
    [s1('show running-config | include ^hostname|^ip domain'), s1('configure terminal'), s1c('crypto key generate rsa modulus 2048')],
    'Le contrôle affiche « hostname SW1 » et « ip domain-name tp.local ». Puis « The key modulus size is 2048 bits » et « %SSH-5-ENABLED: SSH 1.99 has been enabled ».',
    { interactions: [{ attend: 'Do you really want to replace them? [yes/no] (seulement si une clé existe déjà)', reponds: 'no — sauf si tu veux volontairement la remplacer : tous les clients devront accepter la nouvelle empreinte.' }],
      important: 'Si IOS répond « Please define a hostname other than Switch » : « hostname SW1 ». S’il répond « Please define a domain-name first » : « ip domain-name tp.local » en configuration globale, puis relance la génération. Si tu as tapé « crypto key generate rsa » sans « modulus », IOS te demande la taille : réponds 2048.',
      options: [opt('show running-config | include ^hostname|^ip domain', 'Relit seulement la ligne du nom d’hôte et celle du domaine.'), opt('crypto key generate rsa modulus 2048', 'Génère la paire de clés RSA de l’hôte, de 2048 bits ; elle active SSH.')] }),
  // 8 ------------------------------------------------------------------------
  mod(P2, 'Activer SSH version 2 sur les lignes de connexion',
    'SSH version 2, puis les lignes vty (les connexions à distance) vérifient le compte local et n’acceptent plus que SSH.',
    [s1c('ip ssh version 2'), s1c('line vty 0 15'), s1l('login local'), s1l('transport input ssh'), s1l('end')],
    'Aucun message ; l’invite revient au mode privilégié « SW1# ».',
    { important: 'Garde la console ouverte jusqu’à ce que la connexion SSH de la phase 3 réussisse : avec « transport input ssh », Telnet est refusé tout de suite. Selon le modèle, la plage des lignes est « 0 4 » ou « 0 15 » : « show running-config | section line vty » te la montre.',
      options: [
        opt('ip ssh version 2', 'N’accepte que SSH version 2 (la 1 est dépassée).'),
        opt('line vty 0 15', 'Sélectionne les lignes de connexion à distance.'),
        opt('login local', 'Les connexions vérifient les comptes créés sur le commutateur.'),
        opt('transport input ssh', 'N’autorise que SSH sur ces lignes (refuse Telnet).'),
      ] }),
  // 9 ------------------------------------------------------------------------
  lec(P3, 'Régler et vérifier l’adresse du poste de gestion',
    'Le poste d’administration est branché sur FastEthernet0/3. Réglage : adresse 192.168.30.10, masque 255.255.255.0, passerelle 192.168.30.1. Dans Packet Tracer : clique sur le poste, onglet « Desktop », « IP Configuration ». Sous Windows : Paramètres réseau, propriétés IPv4. La commande ci-dessous ne fait que VÉRIFIER le réglage.',
    [pc('ipconfig')],
    'Adresse IPv4 192.168.30.10, masque 255.255.255.0, passerelle par défaut 192.168.30.1.',
    { options: [opt('ipconfig', 'Affiche l’adresse, le masque et la passerelle du poste (sous Linux : « ip address »).')] }),
  // 10 -----------------------------------------------------------------------
  lec(P3, 'Se connecter en SSH au commutateur',
    'Premier test depuis le poste de gestion : il est dans le même VLAN que l’adresse de gestion, donc aucun routeur n’est nécessaire. La même commande « ssh -l admin 192.168.30.2 » marche dans Packet Tracer, sous Windows 10 et suivants, Linux et macOS (« ssh admin@192.168.30.2 » est la forme équivalente). Le mot de passe se tape dans le terminal.',
    [pc('ssh -l admin 192.168.30.2')],
    'L’invite « SW1# » (le compte est de niveau 15) : tu travailles maintenant par SSH, sans câble console. Sous Windows ou Linux, la première connexion demande d’accepter l’empreinte de la clé (yes).',
    { important: '« Connection refused » : revois la phase 2. « Destination host unreachable » : revois l’adresse du poste, le port Fa0/3 et l’interface VLAN 30.',
      options: [
        opt('ssh -l admin 192.168.30.2', 'Ouvre une session SSH ; -l donne le nom du compte (forme équivalente : ssh admin@192.168.30.2).'),
      ] }),
  // 11 -----------------------------------------------------------------------
  lec(P4, 'Confirmer que tu travailles bien par SSH',
    'À partir d’ici, tout se fait dans la session SSH (la console peut rester branchée, au cas où). « show users » montre qui est connecté et par où : la ligne marquée d’un astérisque, c’est toi.',
    [s1('show users'), s1('show ip ssh')],
    'Une ligne « vty » avec ton compte « admin » et l’adresse du poste ; « SSH Enabled - version 2.0 ».',
    { options: [
      opt('show users', 'Les sessions ouvertes : console (con) ou vty (SSH).'),
      opt('show ip ssh', 'SSH est-il actif, en quelle version.'),
    ] }),
  // 12 -----------------------------------------------------------------------
  mod(P4, 'Affecter les ports d’accès des deux autres VLAN',
    'Un port par VLAN : Fa0/1 pour les ventes (VLAN 10), Fa0/2 pour le technique (VLAN 20). Le port Fa0/3 (gestion) est déjà fait.',
    [s1('configure terminal'), s1c('interface fastEthernet 0/1'), s1i('switchport mode access'), s1i('switchport access vlan 10'), s1i('exit'), s1c('interface fastEthernet 0/2'), s1i('switchport mode access'), s1i('switchport access vlan 20'), s1i('exit')],
    'Aucun message. « show vlan brief » classera Fa0/1 dans VENTES et Fa0/2 dans TECHNIQUE.',
    { important: 'Ne touche pas à Fa0/3 : c’est le port de ta session SSH.',
      options: [opt('switchport access vlan 10', 'Place le port dans le VLAN 10 ; le poste branché dessus appartient désormais à ce réseau.')] }),
  // 13 -----------------------------------------------------------------------
  mod(P4, 'Créer le trunk vers le routeur',
    'Le lien commutateur → routeur doit porter les trois VLAN sur un seul câble : c’est un trunk (802.1Q), où chaque trame porte une étiquette avec son numéro de VLAN. On limite la liste aux trois VLAN du TP.',
    [s1c('interface gigabitEthernet 0/1'), s1i('switchport mode trunk'), s1i('switchport trunk allowed vlan 10,20,30'), s1i('end')],
    'Aucun message, puis « %LINEPROTO-5-UPDOWN … changed state to up » quand le routeur sera branché et allumé.',
    { important: '« allowed vlan » REMPLACE la liste, il n’ajoute pas : écris toujours les trois VLAN. Si « switchport mode trunk » répond « Invalid input », ce modèle demande d’abord « switchport trunk encapsulation dot1q ». Ta session SSH passe par Fa0/3, pas par ce trunk : elle ne coupe pas.',
      options: [
        opt('switchport mode trunk', 'Fixe le port en trunk : il transporte plusieurs VLAN, avec étiquettes.'),
        opt('switchport trunk allowed vlan 10,20,30', 'Ne laisse passer que ces VLAN sur le trunk.'),
      ] }),
  // 14 -----------------------------------------------------------------------
  mod(P4, 'Éteindre les ports inutilisés (facultatif)',
    'Bonne pratique : un port non utilisé est éteint. Ici de Fa0/4 à Fa0/24 ; les ports Gi sont laissés tels quels, ne touche surtout pas à Gi0/1 (le trunk).',
    [s1('configure terminal'), s1c('interface range fastEthernet 0/4 - 24'), s1r('shutdown'), s1r('end')],
    'Les ports passent en « administratively down ».',
    { facultatif: true, options: [opt('interface range fastEthernet 0/4 - 24', 'Applique les commandes suivantes à toute la plage de ports.')] }),
  // 15 -----------------------------------------------------------------------
  lec(P4, 'Vérifier les VLAN et le trunk',
    'Contrôle de la partie commutateur avant de passer au routeur.',
    [s1('show vlan brief'), s1('show interfaces trunk')],
    'VENTES : Fa0/1 ; TECHNIQUE : Fa0/2 ; GESTION : Fa0/3. Gi0/1 n’est pas listé dans les VLAN (il est en trunk) mais apparaît dans « show interfaces trunk » avec le mode « on », l’encapsulation 802.1q, le statut « trunking » et les VLAN 10,20,30 autorisés.',
    { options: [
      opt('show vlan brief', 'Les VLAN et leurs ports d’accès (les ports trunk n’y figurent pas).'),
      opt('show interfaces trunk', 'Les trunks actifs : mode, encapsulation, VLAN natif, VLAN autorisés et VLAN réellement transmis.'),
    ] }),
  // 16 -----------------------------------------------------------------------
  mod(P5, 'Routeur : allumer l’interface physique',
    'Sur le routeur R1, l’interface physique GigabitEthernet0/0 n’aura PAS d’adresse : elle porte seulement les sous-interfaces. Il suffit de l’allumer.',
    [rtu('enable'), rt('configure terminal'), rtc('hostname R1'), rtc('interface gigabitEthernet 0/0'), rti('no shutdown'), rti('exit')],
    'Aucun message d’erreur ; l’interface passe « up » quand le câble vers Gi0/1 du commutateur est branché.',
    { important: 'Ne donne pas d’adresse IP à l’interface physique : chaque passerelle est portée par sa sous-interface.',
      options: [opt('no shutdown', 'Allume l’interface (un routeur les livre éteintes).')] }),
  // 17 -----------------------------------------------------------------------
  mod(P5, 'Créer une sous-interface par VLAN',
    'Chaque sous-interface est numérotée comme son VLAN (Gi0/0.10 pour le VLAN 10…), déclare l’étiquette 802.1Q à lire et porte l’adresse de la passerelle du VLAN. L’ordre compte : « encapsulation » AVANT « ip address ».',
    [rtc('interface gigabitEthernet 0/0.10'), rts('encapsulation dot1Q 10'), rts('ip address 192.168.10.1 255.255.255.0'), rts('exit'),
      rtc('interface gigabitEthernet 0/0.20'), rts('encapsulation dot1Q 20'), rts('ip address 192.168.20.1 255.255.255.0'), rts('exit'),
      rtc('interface gigabitEthernet 0/0.30'), rts('encapsulation dot1Q 30'), rts('ip address 192.168.30.1 255.255.255.0'), rts('end')],
    'Aucun message d’erreur. Si IOS dit « overlaps with … », une adresse chevauche un autre réseau déjà posé.',
    { important: 'Le routage entre ces trois réseaux se fait tout seul : ils sont « directement connectés », sans route statique.',
      options: [
        opt('interface gigabitEthernet 0/0.10', 'Crée la sous-interface 10 de l’interface physique (le numéro après le point est libre, on le fait suivre le VLAN).'),
        opt('encapsulation dot1Q 10', 'Cette sous-interface lit et écrit les trames étiquetées VLAN 10.'),
        opt('ip address 192.168.10.1 255.255.255.0', 'L’adresse de la passerelle du VLAN 10 ; les postes la prennent comme passerelle.'),
      ] }),
  // 18 -----------------------------------------------------------------------
  lec(P5, 'Vérifier le routeur',
    'Les trois sous-interfaces doivent être « up » avec l’adresse de leur passerelle, et chaque réseau doit apparaître comme directement connecté.',
    [rt('show ip interface brief'), rt('show ip route')],
    'Gi0/0.10, .20 et .30 en « up / up » avec leurs adresses ; trois routes « C » (connectées) 192.168.10.0/24, 192.168.20.0/24 et 192.168.30.0/24, et trois routes « L » (locales).',
    { options: [
      opt('show ip interface brief', 'État et adresse de chaque interface, sous-interfaces comprises.'),
      opt('show ip route', 'La table de routage : « C » = réseau directement connecté, « L » = adresse du routeur lui-même.'),
    ] }),
  // 19 -----------------------------------------------------------------------
  lec(P6, 'Régler les adresses du poste Ventes et du poste Technique',
    'Poste Ventes (sur Fa0/1) : 192.168.10.10, masque 255.255.255.0, passerelle 192.168.10.1. Poste Technique (sur Fa0/2) : 192.168.20.10, masque 255.255.255.0, passerelle 192.168.20.1. Même réglage que pour le poste de gestion (Packet Tracer : Desktop > IP Configuration ; Windows : propriétés IPv4) ; la commande ne fait que le vérifier.',
    [pc('ipconfig')],
    'Sur chaque poste : l’adresse du plan et la passerelle du VLAN. Une passerelle fausse est la première cause d’un ping qui n’aboutit pas hors du VLAN.',
    { options: [opt('ipconfig', 'Affiche adresse, masque et passerelle par défaut du poste.')] }),
  // 20 -----------------------------------------------------------------------
  lec(P7, 'Tester chaque VLAN : joindre sa passerelle',
    'Premier test, le plus simple : chaque poste joint la passerelle de SON VLAN. Cela valide le poste, le port d’accès, le trunk et la sous-interface.',
    [pc('ping 192.168.10.1'), pc('ping 192.168.20.1'), pc('ping 192.168.30.1')],
    'Des réponses « Reply from … ». Lance chaque ping depuis le poste du VLAN concerné. Le premier paquet peut se perdre pendant la résolution ARP : c’est normal, les suivants répondent.',
    { options: [opt('ping 192.168.10.1', 'Envoie des paquets à la passerelle et attend la réponse.')] }),
  // 21 -----------------------------------------------------------------------
  lec(P7, 'Tester le routage entre VLAN',
    'Le test du TP : depuis le poste Ventes, joindre le poste Technique et le poste de gestion. Le trafic monte au routeur par le trunk, est routé, puis redescend dans l’autre VLAN.',
    [pc('ping 192.168.20.10'), pc('ping 192.168.30.10'), pc('tracert 192.168.20.10')],
    'Des réponses. « tracert » montre deux sauts : 192.168.10.1 (la passerelle) puis 192.168.20.10 (le poste). Si le ping marche dans le VLAN mais pas entre VLAN, le coupable est presque toujours le trunk, une sous-interface ou une passerelle.',
    { important: 'Les pare-feu des systèmes d’exploitation (Windows) bloquent souvent le ping reçu : si Packet Tracer répond mais pas un vrai poste, regarde d’abord son pare-feu.',
      options: [
        opt('ping 192.168.20.10', 'Test de bout en bout entre deux VLAN.'),
        opt('tracert 192.168.20.10', 'Montre les routeurs traversés ; sous Linux : « traceroute ».'),
      ] }),
  // 22 -----------------------------------------------------------------------
  lec(P7, 'Joindre le commutateur par SSH depuis un autre VLAN',
    'Preuve finale, la plus parlante : le poste Ventes (VLAN 10) ouvre une session SSH sur l’adresse de gestion du commutateur (VLAN 30). Pour y arriver il faut TOUT : le port d’accès, le trunk, le routeur, la passerelle par défaut du commutateur et SSH.',
    [pc('ssh -l admin 192.168.30.2')],
    'L’invite « SW1# » après le mot de passe. Si ça échoue alors que le ping 192.168.30.2 répond, relis « ip default-gateway » sur le commutateur ; si le ping échoue aussi, relis le routage.',
    { options: [opt('ssh -l admin 192.168.30.2', 'Ouvre la session SSH sur le commutateur depuis un autre VLAN, à travers le routeur.')] }),
  // 23 -----------------------------------------------------------------------
  lec(P7, 'Lire les tables pour comprendre ce qui s’est passé',
    'Après les tests, les tables montrent le chemin : le commutateur a appris les adresses MAC par VLAN, le routeur a la correspondance IP ↔ MAC de chaque passerelle.',
    [s1('show mac address-table'), rt('show ip arp'), rt('show ip route connected')],
    'Dans la table MAC : un poste par VLAN sur les ports Fa0/1 à Fa0/3, et l’adresse MAC du routeur sur Gi0/1 dans les trois VLAN. Dans la table ARP : les postes des trois réseaux.',
    { options: [
      opt('show mac address-table', 'Commutateur : quelle adresse MAC est apprise sur quel port et dans quel VLAN.'),
      opt('show ip arp', 'Routeur : correspondance adresse IP ↔ adresse MAC des machines jointes.'),
      opt('show ip route connected', 'Seulement les réseaux directement connectés au routeur.'),
    ] }),
  // 24 -----------------------------------------------------------------------
  mod(P8, 'Enregistrer la configuration des deux équipements',
    'À faire seulement quand tous les tests ont réussi. Sans cela, tout disparaît au redémarrage. Une fois sur le commutateur (par SSH), une fois sur le routeur.',
    [s1('copy running-config startup-config'), rt('copy running-config startup-config')],
    '« Destination filename [startup-config]? » : Entrée. Puis « [OK] ». Selon le modèle, « write memory » fait la même chose.',
    { important: 'Si tu as encore besoin de défaire des essais, fais-le avant d’enregistrer.',
      options: [opt('copy running-config startup-config', 'Copie la configuration active (mémoire vive) vers la configuration de démarrage (NVRAM).')] }),
];

export const COURS_CISCO_TP_VLAN = [{
  id: 'cours-tp-vlan-ssh-intervlan',
  titre: 'TP complet : 3 VLAN, SSH et routage inter-VLAN (de A à Z)',
  categorie: 'Réseau et Cisco',
  resume: 'Le TP en une seule suite : créer trois VLAN (10, 20, 30), affecter les ports, se connecter en SSH au commutateur, installer le trunk, configurer le routeur « sur un bâton » (une sous-interface par VLAN), tester de bout en bout, puis enregistrer.',
  effet: 'modification',
  intentions: ['tp vlan', 'tp vlan complet', 'vlan complet', 'tp inter-vlan', 'vlan ssh', 'tp 3 vlan', 'créer 3 vlan routage inter-vlan ssh', 'vlan jusqu au routage inter-vlan', 'routage inter-vlan étape par étape', 'router on a stick tp', 'vlan ssh trunk routeur', 'tp vlan commutateur routeur', 'configurer vlan 10 20 30', 'sous-interface dot1q trois vlan'],
  motsCles: ['tp', 'vlan', 'inter-vlan', 'intervlan', 'routage', 'ssh', 'trunk', 'routeur', 'commutateur', 'sous-interface', 'dot1q', 'router-on-a-stick', 'passerelle', 'cisco', 'ios', 'laboratoire', 'packet tracer',
    'switchport access vlan', 'switchport mode trunk', 'encapsulation dot1q', 'interface vlan', 'ip default-gateway', 'crypto key generate rsa', 'line vty', 'transport input ssh'],
  params: [],
  methodes: [{
    id: 'ios',
    privileges: 'Console du commutateur puis du routeur, mode privilégié (enable) puis configuration globale. Dès la phase 3, le commutateur se configure par SSH.',
    etapes: ETAPES,
    verification: [
      'Les trois postes joignent leur passerelle (192.168.10.1, 192.168.20.1, 192.168.30.1).',
      'Le poste Ventes joint le poste Technique et le poste de gestion : le routage entre VLAN fonctionne.',
      'Le poste Ventes ouvre une session SSH sur 192.168.30.2 à travers le routeur.',
      '« show interfaces trunk » montre le trunk sur Gi0/1 avec les VLAN 10, 20 et 30.',
    ],
    retour: 'Pour défaire : les étapes « Annuler » en bas de cette fiche, dans l’ordre inverse (routeur, trunk, ports, VLAN, SSH).',
    depannage: [
      { symptome: 'Le ping marche dans le VLAN mais pas d’un VLAN à l’autre', cause: 'Trunk absent ou VLAN non autorisé, sous-interface éteinte ou mal numérotée, mauvaise passerelle sur le poste.', action: '« show interfaces trunk » (VLAN autorisés), « show ip interface brief » sur le routeur (sous-interfaces « up/up »), et « ipconfig » sur le poste.' },
      { symptome: 'La sous-interface refuse l’adresse IP (« overlaps » ou rien ne s’affiche)', cause: '« encapsulation dot1Q » oubliée ou posée après l’adresse, ou adresse qui chevauche un autre réseau.', action: 'Repose « encapsulation dot1Q N » AVANT « ip address » et relis « show running-config interface gigabitEthernet 0/0.N ».' },
      { symptome: 'SSH : « Connection refused » ou délai dépassé', cause: 'Clé RSA absente, lignes vty qui n’autorisent pas SSH, ou interface VLAN 30 éteinte.', action: '« show ip ssh » (SSH actif ?), « show running-config | section line vty », « show ip interface brief » (Vlan30 « up/up »).' },
      { symptome: 'Le ping du commutateur répond depuis le VLAN 30 mais pas depuis les autres', cause: 'La passerelle par défaut du commutateur manque ou est fausse.', action: '« show running-config | include default-gateway » ; sinon « ip default-gateway 192.168.30.1 ».' },
      { symptome: '« Please define a hostname other than Switch » ou « Please define a domain-name first » à la génération de la clé', cause: 'Le nom d’hôte est resté « Switch » ou le domaine n’a pas été posé : les deux sont exigés avant « crypto key generate rsa ».', action: 'En configuration globale : « hostname SW1 » puis « ip domain-name tp.local », vérifie avec « show running-config | include ^hostname|^ip domain », puis relance « crypto key generate rsa modulus 2048 ».' },
      { symptome: '« Invalid input detected » sur « switchport mode trunk »', cause: 'Ce modèle négocie encore l’encapsulation et exige de la fixer d’abord.', action: 'Tape « switchport trunk encapsulation dot1q » juste avant « switchport mode trunk ».' },
    ],
  }],
  assistant: null,
  sources: [SRC_VLAN, SRC_SSH, SRC_ITF],
  validation: V_TP,
  origine: 'cours',
  figures: ['tp-vlan-topologie', 'tp-vlan-chemin'],
  rappel: { titre: 'Rappel : l’ordre qui marche', points: ['VLAN d’abord, puis les ports, puis l’adresse de gestion : un port ne peut être affecté qu’à un VLAN qui existe.', 'Le poste de gestion et l’adresse du commutateur sont dans le MÊME VLAN : le trunk peut alors être modifié sans couper la session SSH.', 'Routeur sur un bâton : une sous-interface par VLAN, « encapsulation dot1Q N » avant « ip address ».', 'Chaque poste prend la passerelle de SON VLAN ; le commutateur prend la sienne avec « ip default-gateway ».'] },
}];
