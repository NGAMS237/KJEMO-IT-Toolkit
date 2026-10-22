/**
 * commandes-permissions.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides des comptes, des permissions et des ACL.
 *
 * TOUTES EN LECTURE, et ce n'est pas un hasard.
 *
 * Le modèle du lot est explicite : une commande rapide pour OBSERVER, un
 * assistant pour AGIR. Les permissions sont le domaine où cette séparation
 * compte le plus, parce qu'un `chmod` se tape en trois secondes et qu'un
 * `chmod -R` mal visé ne se défait pas sans relevé préalable. Une commande
 * rapide ne peut pas écrire un fichier de restauration, ne peut pas le relire,
 * et ne peut pas refuser une racine système : les trois sont dans l'assistant.
 *
 * Il n'y a donc ici AUCUN chmod, AUCUN chown, AUCUN setfacl en écriture, et
 * aucune commande de risque « attention » ou « destructif ». Le contrat des
 * commandes rapides exigerait pour celles-là un assistant lié ; la question
 * ne se pose pas, puisqu'on n'en propose pas.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

export const commandesPermissions = [
  // =========================================================================
  // LIRE LES DROITS D'UN CHEMIN
  // =========================================================================
  {
    id: 'cr-stat-mode',
    notion: 'linux-permission-audit',
    besoin: 'Lire le mode, le propriétaire et le groupe d\'un chemin, dans un format stable.',
    commande: 'stat -c \'%A %a %U %G %n\' <CHEMIN>',
    exemple: 'stat -c \'%A %a %U %G %n\' /srv/donnees/equipe',
    parametres: [
      { jeton: '<CHEMIN>', role: 'Le fichier ou le dossier à examiner.', exemple: '/srv/donnees/equipe' },
    ],
    options: [
      { option: '-c', explication: '-c impose le FORMAT de sortie. C\'est ce qui distingue stat de « ls -l » : la sortie de ls est faite pour un humain et change avec la locale, la largeur du terminal et les alias de la distribution. Un format explicite se relit, se compare et s\'automatise.' },
      { option: '%A', explication: '%A donne le mode en lettres (drwxrws---). Un « + » final signalerait une ACL.' },
      { option: '%a', explication: '%a donne le même mode en octal (2770). C\'est la forme qu\'attend chmod.' },
      { option: '%U %G', explication: '%U est le nom du propriétaire, %G celui du groupe. Les variantes minuscules %u et %g donneraient les numéros, utiles quand le nom n\'existe plus.' },
      { option: '%n', explication: '%n rappelle le nom du fichier : indispensable dès qu\'on interroge plusieurs chemins d\'un coup.' },
    ],
    resultat: 'Une ligne par chemin : mode en lettres, mode en octal, propriétaire, groupe, nom. Sur un DOSSIER, le x du mode ne veut pas dire exécuter mais TRAVERSER — sans lui on ne peut pas entrer, même avec r.',
    verification: 'ls -ld <CHEMIN>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-audit',
    source: `${MAN}/man1/stat.1.html`,
  },
  {
    id: 'cr-namei-parents',
    notion: 'linux-permission-audit',
    besoin: 'Trouver LEQUEL des dossiers parents refuse l\'accès, quand un fichier parfaitement lisible reste inaccessible.',
    commande: 'namei -l <CHEMIN>',
    exemple: 'namei -l /srv/donnees/equipe/rapport.txt',
    parametres: [
      { jeton: '<CHEMIN>', role: 'Le chemin complet du fichier auquel l\'accès est refusé.', exemple: '/srv/donnees/equipe/rapport.txt' },
    ],
    options: [
      { option: '-l', explication: '-l affiche pour chaque segment du chemin son mode, son propriétaire et son groupe — c\'est tout l\'intérêt de la commande. Sans -l, namei ne donne que le type de chaque segment.' },
    ],
    resultat: 'Une ligne par segment du chemin, de la racine jusqu\'au fichier. Cherche un dossier (d) sans x dans le triplet qui te concerne : c\'est lui qui bloque. Pour ouvrir un fichier, il faut pouvoir TRAVERSER chacun de ses dossiers parents, et le message « Permission denied » nomme toujours le fichier, jamais le dossier fautif.',
    verification: 'stat -c \'%A %U %G %n\' <CHEMIN>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-audit',
    source: `${MAN}/man1/namei.1.html`,
  },
  {
    id: 'cr-ls-contenu',
    notion: 'linux-permission-audit',
    besoin: 'Voir d\'un coup d\'œil les droits de tout ce qu\'un dossier contient, y compris les entrées cachées.',
    commande: 'ls -la <DOSSIER>',
    exemple: 'ls -la /srv/donnees/equipe',
    parametres: [
      { jeton: '<DOSSIER>', role: 'Le dossier dont on veut lister le contenu.', exemple: '/srv/donnees/equipe' },
    ],
    options: [
      { option: '-la', explication: 'Deux options courtes groupées, et chacune garde son sens. -l donne le format long : type, mode, nombre de liens, propriétaire, groupe, taille, date, nom. -a montre aussi les entrées commençant par un point, que ls masque par défaut — et c\'est souvent dans celles-là que se cache le fichier de configuration qui pose problème. « -la » vaut donc « -l -a », et l\'ordre des lettres n\'importe pas.' },
    ],
    resultat: 'Une ligne par entrée. Un « + » à la fin du mode signale une ACL : les droits réels ne se lisent alors plus ici, mais avec getfacl. Attention, dans ce cas ls affiche le MASQUE de l\'ACL à la place des droits du groupe — on lit un plafond en croyant lire une permission.',
    verification: 'getfacl <DOSSIER>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-audit',
    source: `${MAN}/man1/ls.1.html`,
  },
  {
    id: 'cr-getfacl',
    notion: 'linux-permission-acl',
    besoin: 'Lire les ACL d\'un chemin, et surtout les droits RÉELLEMENT accordés après application du masque.',
    commande: 'getfacl -p <CHEMIN>',
    exemple: 'getfacl -p /srv/donnees/equipe',
    parametres: [
      { jeton: '<CHEMIN>', role: 'Le fichier ou le dossier dont on veut lire les ACL.', exemple: '/srv/donnees/equipe' },
    ],
    options: [
      { option: '-p', explication: '-p conserve le chemin tel qu\'il a été écrit, au lieu de retirer le « / » initial. C\'est ce qui rend la sortie réutilisable par « setfacl --restore » sans avoir à se placer dans le bon dossier.' },
    ],
    resultat: 'Les entrées de l\'ACL, une par ligne. Les lignes « #effective: » sont les plus importantes : elles donnent les droits réellement accordés après application du masque, qui est un PLAFOND. Une entrée « rwx » derrière un masque « r-x » accorde « r-x », et c\'est la cause la plus fréquente d\'une ACL qui semble correcte et ne fonctionne pas.',
    verification: 'stat -c \'%A\' <CHEMIN>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-acl',
    source: `${MAN}/man1/getfacl.1.html`,
  },
  {
    id: 'cr-getfacl-releve',
    notion: 'linux-permission-acl',
    besoin: 'Relever les ACL et les modes de toute une arborescence AVANT de les modifier, pour pouvoir y revenir.',
    commande: 'sudo getfacl -R -p <DOSSIER> > <FICHIER_RELEVE>',
    exemple: 'sudo getfacl -R -p /srv/donnees/equipe > ~/avant-acl.txt',
    parametres: [
      { jeton: '<DOSSIER>', role: 'Le dossier à relever, avec tout son contenu.', exemple: '/srv/donnees/equipe' },
      { jeton: '<FICHIER_RELEVE>', role: 'Où écrire le relevé. Choisis un emplacement HORS du dossier relevé : un relevé écrit dedans se retrouve modifié par l\'opération qu\'il doit permettre d\'annuler.', exemple: '~/avant-acl.txt' },
    ],
    options: [
      { option: '-R', explication: '-R parcourt récursivement le dossier. En LECTURE, la récursion ne présente aucun risque — c\'est en écriture qu\'elle en présente.' },
      { option: '-p', explication: '-p conserve les chemins complets, ce qui rend le relevé utilisable par « setfacl --restore » depuis n\'importe quel dossier.' },
    ],
    resultat: 'Un fichier texte contenant, pour chaque entrée de l\'arborescence, son propriétaire, son groupe, son mode POSIX et ses ACL. C\'est ce fichier que « sudo setfacl --restore=<FICHIER_RELEVE> » sait remettre en place : le relevé n\'est pas une précaution de forme, c\'est l\'annulation elle-même.',
    verification: 'head -20 <FICHIER_RELEVE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-acl',
    source: `${MAN}/man1/getfacl.1.html`,
  },

  // =========================================================================
  // CHERCHER LES POINTS SENSIBLES
  // =========================================================================
  {
    id: 'cr-find-inscriptible',
    notion: 'linux-permission-audit',
    besoin: 'Trouver les fichiers que n\'importe quel compte de la machine peut remplacer.',
    commande: 'find <DOSSIER> -xdev -type f -perm -0002',
    exemple: 'find /srv/donnees -xdev -type f -perm -0002',
    parametres: [
      { jeton: '<DOSSIER>', role: 'La racine de la recherche.', exemple: '/srv/donnees' },
    ],
    options: [
      { option: '-xdev', explication: '-xdev empêche find de descendre dans un autre système de fichiers. Sans lui, une recherche partie de / traverse les montages réseau et les systèmes virtuels, ce qui prend un temps considérable pour un résultat sans rapport avec la question.' },
      { option: '-type', explication: '-type f limite aux fichiers ordinaires : un dossier inscriptible par tous est une question différente, et souvent légitime (/tmp).' },
      { option: '-perm', explication: 'Le « - » devant le mode signifie « AU MOINS ces bits », et non « exactement ». 0002 est le bit d\'écriture pour « autres ». Sans le tiret, « -perm 0002 » ne trouverait que les fichiers dont le mode est exactement 0002, c\'est-à-dire pratiquement aucun.' },
    ],
    resultat: 'Un chemin par ligne. Chacun de ces fichiers peut être remplacé par n\'importe quel compte de la machine, y compris par un service compromis. Aucune sortie signifie qu\'il n\'y en a pas, et c\'est le résultat souhaitable.',
    verification: 'stat -c \'%a %n\' <un des fichiers trouvés>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-change',
    source: `${MAN}/man1/find.1.html`,
  },
  {
    id: 'cr-find-setuid',
    notion: 'linux-permission-audit',
    besoin: 'Recenser les programmes qui s\'exécutent avec les droits de leur propriétaire, et non de celui qui les lance.',
    commande: 'find <DOSSIER> -xdev -type f -perm -4000',
    exemple: 'find /usr -xdev -type f -perm -4000',
    parametres: [
      { jeton: '<DOSSIER>', role: 'La racine de la recherche. /usr et /bin sont les emplacements habituels.', exemple: '/usr' },
    ],
    options: [
      { option: '-xdev', explication: '-xdev reste dans le système de fichiers de départ.' },
      { option: '-type', explication: '-type f limite aux fichiers ordinaires : le bit setuid n\'a aucun effet sur un dossier, et les signaler noierait le résultat.' },
      { option: '-perm', explication: '4000 est le bit setuid, le quatrième chiffre du mode. Le « - » signifie « au moins ce bit ». Pour le setgid, c\'est -2000 ; pour le sticky bit, -1000.' },
    ],
    resultat: 'Un chemin par ligne. Ces programmes s\'exécutent avec les droits de leur propriétaire : un seul, s\'il appartient à root et contient un défaut, suffit à donner les pleins pouvoirs. Quelques-uns sont normaux et nécessaires (sudo, su, passwd, ping) ; ce qui compte est de reconnaître ceux qui ne devraient pas être là. Et un chmod récursif leur retirerait ce bit silencieusement, ce qui casserait les commandes qui en dépendent.',
    verification: 'stat -c \'%A %U %n\' <un des fichiers trouvés>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-audit',
    source: `${MAN}/man1/find.1.html`,
  },

  // =========================================================================
  // LIRE LES COMPTES ET LES GROUPES
  // =========================================================================
  {
    id: 'cr-id-compte',
    notion: 'linux-user-create',
    besoin: 'Savoir à quels groupes appartient réellement un compte, groupe principal compris.',
    commande: 'id <COMPTE>',
    exemple: 'id etudiant',
    parametres: [
      { jeton: '<COMPTE>', role: 'Le nom du compte. Sans argument, id répond pour la session en cours.', exemple: 'etudiant' },
    ],
    options: [],
    resultat: 'uid, gid du groupe principal, puis la liste de TOUS les groupes. C\'est la seule vue complète : un compte dont un groupe est le groupe PRINCIPAL n\'apparaît pas dans la liste des membres de ce groupe dans /etc/group, et il en a pourtant tous les droits. Attention : les groupes ajoutés à un compte ne prennent effet que dans une NOUVELLE session — une connexion déjà ouverte garde les groupes qu\'elle avait.',
    verification: 'getent group <un des groupes listés>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-user-create',
    source: `${MAN}/man1/id.1.html`,
  },
  {
    id: 'cr-getent-passwd',
    notion: 'linux-user-create',
    besoin: 'Vérifier qu\'un compte existe, et lire son dossier personnel et son interpréteur.',
    commande: 'getent passwd <COMPTE>',
    exemple: 'getent passwd etudiant',
    parametres: [
      { jeton: '<COMPTE>', role: 'Le nom du compte à chercher. Sans argument, getent liste tous les comptes.', exemple: 'etudiant' },
    ],
    options: [
      { option: 'passwd', explication: 'Le nom de la BASE interrogée, et non celui d\'un fichier : getent passe par les mêmes mécanismes que le système (/etc/passwd, mais aussi LDAP ou un annuaire, selon /etc/nsswitch.conf). Lire /etc/passwd directement raterait les comptes venus d\'un annuaire.' },
    ],
    resultat: 'Une ligne à sept champs séparés par « : » : nom, mot de passe (toujours « x », le vrai est dans /etc/shadow), UID, GID, commentaire, dossier personnel, interpréteur. Aucune sortie et un code de retour non nul signifient que le compte n\'existe pas — c\'est ainsi qu\'on le vérifie avant un useradd.',
    verification: 'id <COMPTE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-user-create',
    source: `${MAN}/man1/getent.1.html`,
  },
  {
    id: 'cr-passwd-etat',
    notion: 'linux-user-create',
    besoin: 'Savoir si un compte peut se connecter, sans jamais voir son mot de passe.',
    commande: 'sudo passwd -S <COMPTE>',
    exemple: 'sudo passwd -S etudiant',
    parametres: [
      { jeton: '<COMPTE>', role: 'Le compte dont on veut l\'état. Sans argument, passwd -S répond pour la session en cours.', exemple: 'etudiant' },
    ],
    options: [
      { option: '-S', explication: '-S, en majuscule, affiche l\'ÉTAT du mot de passe sans jamais en montrer le contenu ni le hachage. Ne pas confondre avec « passwd <compte> » sans option, qui en change un.' },
    ],
    resultat: 'Une ligne dont le DEUXIÈME champ répond à la question : « P » le mot de passe est utilisable, « L » le compte est verrouillé, « NP » il n\'y a aucun mot de passe. Un compte fraîchement créé par useradd sans mot de passe est en L ou NP, et aucune connexion par mot de passe n\'est possible tant qu\'il n\'est pas passé en P. Les champs suivants donnent la date du dernier changement et la politique d\'expiration.',
    verification: 'getent shadow <COMPTE> | cut -d: -f2 | cut -c1',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-user-create',
    source: `${MAN}/man1/passwd.1.html`,
  },
  {
    id: 'cr-umask',
    notion: 'linux-permission-audit',
    besoin: 'Connaître les droits que recevront les fichiers créés par cette session.',
    commande: 'umask -S',
    exemple: 'umask -S',
    parametres: [],
    options: [
      { option: '-S', explication: '-S affiche le masque sous forme symbolique (u=rwx,g=rx,o=rx), c\'est-à-dire les droits CONSERVÉS. Sans option, umask donne la valeur octale (0022), qui est au contraire ce qui est RETIRÉ — deux lectures inverses de la même information, et c\'est là que naît la confusion.' },
    ],
    resultat: 'Les droits par défaut de la session. 0022 donne 644 aux nouveaux fichiers et 755 aux nouveaux dossiers ; 0002 donne 664 et 775, ce qu\'un partage de groupe demande souvent. umask ne change rien à ce qui existe déjà : il ne décide que de l\'avenir. C\'est une primitive du shell, pas un programme : chaque session a la sienne, et la modifier durablement passe par un fichier de profil.',
    verification: 'touch /tmp/essai-umask && stat -c \'%a %n\' /tmp/essai-umask',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-permission-change',
    source: `${MAN}/man1/bash.1.html`,
  },
];
