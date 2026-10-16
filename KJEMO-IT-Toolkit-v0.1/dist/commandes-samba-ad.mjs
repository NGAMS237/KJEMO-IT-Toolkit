/**
 * commandes-samba-ad.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides d'un contrôleur de domaine Samba. ELLES OBSERVENT
 * TOUTES.
 *
 * Aucune commande de samba-tool qui AGIT ne figure ici, et la liste de ce qui
 * est écarté vaut d'être lue :
 *
 *   domain provision   irréversible. Il n'existe pas de « dé-provisionner ».
 *   user create        demande un mot de passe à la console.
 *   setpassword        de même.
 *   getpassword        EXPOSE un secret de la base. Il ne sert à aucun
 *   syncpasswords      diagnostic, et le mettre dans un bloc copiable serait
 *                      offrir un secret à qui relit l'historique du terminal.
 *   user delete        emporte l'identifiant de sécurité du compte : le
 *                      recréer avec le même nom ne lui rend ni ses accès, ni
 *                      ses appartenances, ni la propriété de ses fichiers.
 *   kinit              demande un mot de passe. `klist`, qui LIT le cache, est
 *                      ici ; `kinit` est dans les procédures, à taper.
 *
 * Ces actions vivent dans les assistants, qui vérifient d'abord et remettent
 * ensuite — ou, pour le provisionnement, qui remettent un cahier de manœuvre
 * et n'exécutent rien.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';
const WIKI_AD = 'https://wiki.samba.org/index.php/Setting_up_Samba_as_an_Active_Directory_Domain_Controller';

export const commandesSambaAd = [
  {
    id: 'cr-ad-hosts',
    notion: 'samba-ad-dc-readiness',
    besoin: 'Vérifier que le nom du contrôleur ne résout pas vers le bouclage.',
    commande: 'getent hosts <FQDN>',
    exemple: 'getent hosts dc1.kjemo.lan',
    parametres: [
      { jeton: '<FQDN>', role: 'Le nom pleinement qualifié du contrôleur, tel que « hostname -f » le rend.', exemple: 'dc1.kjemo.lan' },
    ],
    options: [],
    resultat: 'Une ligne : l’adresse, puis les noms. C’est le prérequis qu’on saute, et celui qui coûte le plus cher. Le wiki officiel l’écrit ainsi : « The host name and FQDN must not resolve to the 127.0.0.1 IP address or any other IP address than the one used on the LAN interface of the DC. » Ubuntu met souvent le nom de la machine en face de 127.0.1.1 dans /etc/hosts — et dans cet état le provisionnement RÉUSSIT : le contrôleur publie cette adresse dans son propre DNS, et aucun client ne peut s’y connecter. L’erreur apparaît alors sur les clients, pas sur le serveur.',
    verification: 'ip -brief address show scope global',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-dc-readiness',
    source: WIKI_AD,
  },
  {
    id: 'cr-ad-srv-ldap',
    notion: 'samba-ad-health',
    besoin: 'Vérifier l’enregistrement SRV par lequel un client trouve un contrôleur.',
    commande: 'host -t SRV _ldap._tcp.<REALM>.',
    exemple: 'host -t SRV _ldap._tcp.kjemo.lan.',
    parametres: [
      { jeton: '<REALM>', role: 'Le nom DNS complet du domaine. Le point final n’est pas une faute de frappe : il rend le nom absolu et empêche que la liste « search » du résolveur n’y ajoute un suffixe.', exemple: 'kjemo.lan' },
    ],
    options: [
      { option: '-t', explication: '-t choisit le type d’enregistrement. Sans lui, host rend les adresses, et un SRV n’est pas une adresse : la réponse serait vide sans que rien n’indique pourquoi.' },
    ],
    resultat: 'La réponse attendue ressemble à « _ldap._tcp.kjemo.lan has SRV record 0 100 389 dc1.kjemo.lan. ». Un client ne trouve pas un contrôleur par son nom : il interroge cet enregistrement. Son absence est la PREMIÈRE cause d’échec de jonction, et le message de Windows ne parle jamais de SRV — il dit que le domaine est introuvable. Deux causes à distinguer : le DNS du domaine ne sert pas la zone, ou la machine qui interroge n’utilise pas ce DNS.',
    verification: 'host -t SRV _kerberos._udp.kjemo.lan.',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: WIKI_AD,
  },
  {
    id: 'cr-ad-srv-kerberos',
    notion: 'samba-ad-health',
    besoin: 'Vérifier l’enregistrement SRV de Kerberos, qui est l’autre moitié de la jonction.',
    commande: 'host -t SRV _kerberos._udp.<REALM>.',
    exemple: 'host -t SRV _kerberos._udp.kjemo.lan.',
    parametres: [
      { jeton: '<REALM>', role: 'Le nom DNS complet du domaine, avec son point final.', exemple: 'kjemo.lan' },
    ],
    options: [
      { option: '-t', explication: '-t choisit le type. Noter « _udp » et non « _tcp » : Kerberos s’annonce en UDP, et chercher le mauvais protocole fait conclure à une absence qui n’existe pas.' },
    ],
    resultat: 'Une réponse SRV désignant le contrôleur et le port 88. Les deux enregistrements se vérifient ensemble : avec _ldap._tcp seul, un client TROUVE le domaine et ne peut pas s’y AUTHENTIFIER — deux symptômes différents, et celui-là ressemble à un problème de mot de passe.',
    verification: 'ss -lntup | grep -E "[:.]88$"',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: WIKI_AD,
  },
  {
    id: 'cr-ad-a',
    notion: 'samba-ad-health',
    besoin: 'Vérifier l’adresse que le contrôleur publie pour lui-même.',
    commande: 'host -t A <FQDN>.',
    exemple: 'host -t A dc1.kjemo.lan.',
    parametres: [
      { jeton: '<FQDN>', role: 'Le nom pleinement qualifié du contrôleur, avec son point final.', exemple: 'dc1.kjemo.lan' },
    ],
    options: [
      { option: '-t', explication: '-t A ne demande que l’enregistrement d’adresse, ce qui rend la réponse lisible d’un coup d’œil.' },
    ],
    resultat: 'L’adresse publiée dans le DNS du domaine. Les enregistrements SRV désignent un contrôleur par son NOM : si ce nom résout vers une adresse de bouclage, les SRV sont parfaits et personne ne peut atteindre le contrôleur. C’est la trace d’un provisionnement fait alors que /etc/hosts pointait vers 127.0.1.1 — et corriger /etc/hosts après coup ne corrige pas l’enregistrement déjà publié.',
    verification: 'getent hosts dc1.kjemo.lan',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: WIKI_AD,
  },
  {
    id: 'cr-ad-ports',
    notion: 'samba-ad-health',
    besoin: 'Voir lesquels des cinq services du contrôleur écoutent.',
    commande: 'ss -lntup | grep -E \'[:.](53|88|389|445|464)[[:space:]]\'',
    exemple: 'ss -lntup | grep -E \'[:.](53|88|389|445|464)[[:space:]]\'',
    parametres: [],
    options: [
      { option: '-lntup', explication: 'Cinq options courtes groupées : -l en écoute seulement ; -n sans traduire les ports ; -t TCP ; -u UDP — le DNS et Kerberos s’annoncent aussi en UDP, et sans -u la moitié manque ; -p le processus.' },
      { option: '-E', explication: '-E active les expressions régulières étendues, pour le groupe alternatif.' },
    ],
    resultat: 'Une ligne par service qui écoute. Un contrôleur n’est pas un service mais cinq dans le même processus : 53 le DNS, 88 Kerberos, 389 LDAP, 445 SMB, 464 le changement de mot de passe. « Le 445 répond » ne dit rien des quatre autres, et pourtant c’est ainsi qu’on déclare un contrôleur en bonne santé. Sans le 53, aucun client ne TROUVE le domaine ; sans le 88, personne ne s’y AUTHENTIFIE — et ce sont deux pannes qu’on confond.',
    verification: 'systemctl is-active samba-ad-dc',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: `${MAN}/man8/ss.8.html`,
  },
  {
    id: 'cr-ad-partages',
    notion: 'samba-ad-health',
    besoin: 'Vérifier que sysvol et netlogon sont servis, sans mot de passe.',
    commande: 'smbclient -L localhost -N',
    exemple: 'smbclient -L localhost -N',
    parametres: [],
    options: [
      { option: '-L', explication: '-L liste les partages offerts, au lieu d’ouvrir une session.' },
      { option: '-N', explication: '-N se connecte en ANONYME, sans demander de mot de passe. C’est la vérification que donne le wiki officiel, et c’est pourquoi elle peut être une commande rapide : aucun secret n’est en jeu.' },
    ],
    resultat: 'La liste doit contenir sysvol et netlogon. Ces deux partages ne sont pas décoratifs : sysvol porte les stratégies de groupe, netlogon les scripts d’ouverture de session. Leur absence ne casse pas l’authentification — elle casse tout ce qui en dépend, ce qui est bien plus difficile à relier à une cause. Une liste vide, elle, signifie que le serveur SMB du contrôleur ne répond pas du tout.',
    verification: 'ss -lntup | grep -E "[:.]445[[:space:]]"',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: WIKI_AD,
  },
  {
    id: 'cr-ad-niveau',
    notion: 'samba-ad-health',
    besoin: 'Lire les niveaux fonctionnels du domaine et de la forêt.',
    commande: 'sudo samba-tool domain level show',
    exemple: 'sudo samba-tool domain level show',
    parametres: [],
    options: [
      { option: 'level show', explication: 'La sous-commande « show » LIT. Ses voisines « raise » et « lower » modifient, et elles n’ont pas leur place dans un bloc copiable : élever un niveau fonctionnel exclut définitivement les contrôleurs plus anciens du domaine.' },
    ],
    resultat: 'Les niveaux du domaine et de la forêt. Ils bornent les fonctions disponibles et, surtout, les versions de Windows qui peuvent être contrôleurs de ce domaine. On les élève ; on ne les abaisse pas — et c’est pour cela que « raise » ne figure pas ici. La lecture demande root : elle passe par la base du domaine.',
    verification: 'sudo samba-tool domain info 127.0.0.1',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: `${MAN}/man8/samba-tool.8.html`,
  },
  {
    id: 'cr-ad-comptes',
    notion: 'samba-ad-user-manage',
    besoin: 'Lister les comptes d’utilisateurs du domaine.',
    commande: 'sudo samba-tool user list',
    exemple: 'sudo samba-tool user list',
    parametres: [],
    options: [
      { option: 'user list', explication: 'La sous-commande « list » LIT. Les comptes de MACHINES n’y figurent pas : ils se listent avec « samba-tool computer list », et les confondre fait chercher un poste parmi les utilisateurs.' },
    ],
    resultat: 'Un compte par ligne. Deux rappels. D’abord, ces comptes ne sont pas ceux d’Unix : « getent passwd » ne les voit pas tant que winbind n’est pas en place, et conclure à une absence depuis la mauvaise source est fréquent. Ensuite, un compte peut figurer ici et être DÉSACTIVÉ : c’est « samba-tool user show <compte> » qui le dit, dans l’attribut userAccountControl.',
    verification: 'sudo samba-tool computer list',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-user-manage',
    source: `${MAN}/man8/samba-tool.8.html`,
  },
  {
    id: 'cr-ad-replication',
    notion: 'samba-ad-health',
    besoin: 'Lire ce que ce contrôleur sait de sa réplication.',
    commande: 'sudo samba-tool drs showrepl',
    exemple: 'sudo samba-tool drs showrepl',
    parametres: [],
    options: [
      { option: 'showrepl', explication: 'La sous-commande « showrepl » LIT. « drs replicate » déclenche une réplication : utile, et pas une commande à copier sans contexte.' },
    ],
    resultat: 'L’état des liens de réplication, vu depuis CE contrôleur. Deux limites à garder en tête. Cette commande ne dit pas ce que les autres contrôleurs savent de celui-ci : une réplication saine dans un sens et cassée dans l’autre est le cas le plus courant, et un seul côté ne le montre jamais — relance-la sur chaque partenaire. Et sur un contrôleur unique, la sortie est vide : cela ne prouve rien, puisqu’il n’y a personne avec qui répliquer. Si elle échoue, regarde l’heure avant tout le reste : la réplication passe par Kerberos, et Kerberos refuse un écart d’horloge.',
    verification: 'timedatectl',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: `${MAN}/man8/samba-tool.8.html`,
  },
  {
    id: 'cr-ad-klist',
    notion: 'samba-ad-health',
    besoin: 'Lire les tickets Kerberos déjà en cache, sans en demander.',
    commande: 'klist',
    exemple: 'klist',
    parametres: [],
    options: [],
    resultat: 'Le cache de tickets de la session courante, ou « No credentials cache found » — qui est normal et ne prouve rien. Cette commande LIT ; c’est « kinit administrator » qui DEMANDE un ticket, et elle exige un mot de passe : elle n’est donc pas une commande rapide, et elle figure dans les procédures des assistants. Quand un ticket est là, vérifie que son principal porte le realm en MAJUSCULES : le wiki insiste — « Always enter the Kerberos realm in uppercase » — et un ticket obtenu pour un autre realm explique des refus que rien d’autre n’explique.',
    verification: 'timedatectl',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-ad-health',
    source: 'https://web.mit.edu/Kerberos/krb5-devel/doc/user/user_commands/klist.html',
  },
];
