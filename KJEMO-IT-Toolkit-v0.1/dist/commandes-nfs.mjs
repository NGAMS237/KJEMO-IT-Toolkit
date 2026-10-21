/**
 * commandes-nfs.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides de NFS. ONZE OBSERVENT, DEUX AGISSENT.
 *
 * La répartition n'est pas un hasard, et elle est l'inverse de ce qu'on trouve
 * ailleurs sur le sujet. `exportfs -ra` figure ici parce qu'il faut bien
 * l'écrire quelque part — l'assistant nfs-export-create s'arrête juste avant
 * et l'affiche — mais il est classé « attention », et son bloc dit ce qu'il
 * fait vraiment :
 *
 *   « Reexport all directories, synchronizing /var/lib/nfs/etab with
 *     /etc/exports [...] This option removes entries in /var/lib/nfs/etab
 *     which have been deleted from /etc/exports [...] and removes any entries
 *     from the kernel export table which are no longer valid. »
 *
 * Il APPLIQUE, et il RETIRE. On le lit partout présenté comme « recharger la
 * configuration », ce qui laisse croire à une opération neutre : un export
 * ajouté à la main sans passer par le fichier disparaît au premier `-ra`, et
 * les clients montés dessus se retrouvent bloqués sur leur point de montage.
 *
 * Deux commandes auraient pu figurer ici, et n'y sont pas :
 *
 *   exportfs -ua   elle retire TOUT, et sa page de manuel le dit sans
 *                  détour : « This effectively shuts down all NFS activity. »
 *                  Un bloc copiable qui coupe tous les partages d'un serveur
 *                  n'a pas sa place à côté de commandes de lecture.
 *   exportfs -o … hôte:/chemin
 *                  elle exporte sans écrire dans le fichier. Ce qui paraît
 *                  pratique est exactement le piège : l'export existe,
 *                  fonctionne, et disparaît au prochain `-ra` ou au prochain
 *                  redémarrage, sans que rien n'en garde la trace.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

export const commandesNfs = [
  {
    id: 'cr-nfs-table',
    notion: 'nfs-server-readiness',
    besoin: 'Savoir ce que cette machine exporte RÉELLEMENT en ce moment, options comprises.',
    commande: 'exportfs -v',
    exemple: 'exportfs -v',
    parametres: [],
    options: [
      { option: '-v', explication: '-v ajoute la liste des options d’export à chaque ligne. Sans lui, on obtient les chemins et les clients, et pas ce qui décide de tout : « ro » ou « rw », et la présence ou l’absence de root_squash.' },
    ],
    resultat: 'Une ligne par couple chemin/client, avec les options EFFECTIVES — celles qu’on n’a pas écrites comprises. Les valeurs par défaut, que la page d’exportfs(8) donne explicitement, sont sync, ro, root_squash et wdelay : un export dont on a oublié « rw » apparaît donc en « ro » ici, et le client dira « Read-only file system » sans que rien n’ait échoué. C’est cette table, et non /etc/exports, qui est servie : la table vient de /var/lib/nfs/etab, lue par rpc.mountd. Si une ligne du fichier n’apparaît pas ici, c’est que la table n’a pas été resynchronisée depuis la dernière modification.',
    verification: 'exportfs -s',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-server-readiness',
    source: `${MAN}/man8/exportfs.8.html`,
  },
  {
    id: 'cr-nfs-fichier',
    notion: 'nfs-server-readiness',
    besoin: 'Lire les lignes actives de /etc/exports, sans les commentaires qui en occupent la moitié.',
    commande: 'sudo grep -vE \'^[[:space:]]*(#|$)\' -- /etc/exports',
    exemple: 'sudo grep -vE \'^[[:space:]]*(#|$)\' -- /etc/exports',
    parametres: [],
    options: [
      { option: '-vE', explication: 'Deux options courtes de grep groupées : -v inverse la sélection — on garde les lignes qui ne correspondent PAS au motif ; -E active les expressions régulières étendues, nécessaires pour la parenthèse et la barre verticale.' },
      { option: '--', explication: 'Le double tiret arrête la lecture des options : il protège le nom de fichier qui suit, et c’est une habitude à prendre même quand le nom est connu.' },
    ],
    resultat: 'Les seules lignes qui comptent, sans les commentaires du fichier livré par le paquet — qui en contient une douzaine et fait croire à une configuration là où il n’y a rien. Ce qu’on lit ici est la SOURCE, pas l’état du service : comparer cette sortie à celle d’« exportfs -v » est le diagnostic le plus utile du sujet, parce que l’écart entre les deux explique à lui seul la moitié des « j’ai pourtant modifié le fichier ».',
    verification: 'exportfs -v',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-server-readiness',
    source: `${MAN}/man5/exports.5.html`,
  },
  {
    id: 'cr-nfs-audit-ouverts',
    notion: 'nfs-server-readiness',
    besoin: 'Chercher dans /etc/exports les trois formes qui ouvrent un partage à tout le monde.',
    commande: 'sudo grep -nE \'(^|[[:space:]])\\*\\(|no_root_squash|/0\\(\' -- /etc/exports',
    exemple: 'sudo grep -nE \'(^|[[:space:]])\\*\\(|no_root_squash|/0\\(\' -- /etc/exports',
    parametres: [],
    options: [
      { option: '-nE', explication: 'Deux options courtes de grep groupées : -n affiche le numéro de ligne, ce qui permet d’aller corriger au bon endroit au lieu de relire le fichier entier ; -E active les expressions régulières étendues, pour les parenthèses et la barre verticale.' },
      { option: '--', explication: 'Le double tiret arrête la lecture des options et protège le nom de fichier qui suit.' },
    ],
    resultat: 'Rien, dans le bon cas — et c’est une sortie vide qu’il faut savoir lire comme une réponse. Chaque ligne trouvée est un problème nommé. « * » est l’entrée qu’exports(5) appelle « anonymous » et qui « will match all clients » : toute machine joignant le port 2049 obtient le partage, et NFSv3 en sec=sys fait confiance à l’UID que le client annonce — il suffit donc d’être root chez soi. « /0 » est le même « * » écrit en CIDR, avec l’apparence d’une restriction. « no_root_squash » donne à root du client les droits de root sur les fichiers exportés, et sa page de manuel le réserve aux clients sans disque. Aucun de ces trois ne produit de symptôme : tout fonctionne, et c’est exactement pourquoi il faut les chercher.',
    verification: 'exportfs -v',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-server-readiness',
    source: `${MAN}/man5/exports.5.html`,
  },
  {
    id: 'cr-nfs-showmount',
    notion: 'nfs-server-readiness',
    besoin: 'Voir ce qu’un client DÉCOUVRE en interrogeant le serveur.',
    commande: 'showmount -e <SERVEUR>',
    exemple: 'showmount -e localhost',
    parametres: [
      { jeton: '<SERVEUR>', role: 'Le nom ou l’adresse du serveur NFS. « localhost » éprouve la machine sans passer par le réseau, ce qui sépare la panne locale de la panne de chemin.', exemple: 'localhost' },
    ],
    options: [
      { option: '-e', explication: '-e affiche la liste des exports du serveur, au lieu de la liste des clients qui ont monté — qui est la sortie par défaut et qui n’est, elle, qu’un historique peu fiable.' },
    ],
    resultat: 'La liste des exports telle que rpc.mountd la publie. Si elle est vide alors qu’« exportfs -v » montre des lignes, ce n’est pas la configuration qui est en cause : cherche du côté de rpcbind, puis du pare-feu. Et « clnt_create: RPC: Program not registered » veut dire que rpc.mountd ou rpcbind ne tourne pas — pas que le partage n’existe pas. Depuis un poste distant, cette même commande dit en une ligne si le problème est le serveur ou le réseau.',
    verification: 'rpcinfo -p localhost',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-server-readiness',
    source: `${MAN}/man8/showmount.8.html`,
  },
  {
    id: 'cr-nfs-rpcinfo',
    notion: 'nfs-server-readiness',
    besoin: 'Vérifier que les programmes RPC de NFS sont bien enregistrés.',
    commande: 'rpcinfo -p localhost | grep -E \'nfs|mountd\'',
    exemple: 'rpcinfo -p localhost | grep -E \'nfs|mountd\'',
    parametres: [],
    options: [
      { option: '-p', explication: '-p interroge le portmapper de la machine indiquée et liste tous les programmes RPC qu’il connaît, avec leur version et leur port.' },
      { option: '-E', explication: '-E de grep active les expressions régulières étendues, nécessaires pour la barre verticale qui sépare les deux motifs.' },
    ],
    resultat: 'Les enregistrements de « nfs » et de « mountd », avec leurs versions. Leur absence alors que nfs-server est actif désigne rpcbind, et non la configuration des exports : c’est lui qui tient ce registre. L’information utile est aussi la liste des VERSIONS annoncées — un client qui exige NFSv3 sur un serveur qui n’annonce que la 4 échoue avec un message qui ne parle pas de version.',
    verification: 'systemctl is-active rpcbind',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-server-readiness',
    source: `${MAN}/man8/rpcinfo.8.html`,
  },
  {
    id: 'cr-nfs-ecoute',
    notion: 'nfs-server-readiness',
    besoin: 'Vérifier que les ports de NFS sont en écoute, sans se faire piéger par la colonne du pair.',
    commande: 'ss -lntu | awk \'{print $5}\' | grep -E \':(2049|111)$\'',
    exemple: 'ss -lntu | awk \'{print $5}\' | grep -E \':(2049|111)$\'',
    parametres: [],
    options: [
      { option: '-lntu', explication: 'Quatre options courtes de ss groupées : -l ne montre que les sockets en écoute ; -n n’essaie pas de traduire les numéros de port en noms de service ; -t les sockets TCP ; -u les sockets UDP, que NFSv3 utilise encore.' },
      { option: '-E', explication: '-E de grep active les expressions régulières étendues, pour la parenthèse et la barre verticale.' },
    ],
    resultat: 'Une ligne par adresse locale en écoute sur 2049 ou 111. 2049 est NFS lui-même ; 111 est le portmapper, dont NFSv3 et showmount dépendent. Le passage par « awk {print $5} » n’est pas une coquetterie : il isole la colonne de l’adresse LOCALE. Chercher « 2049 » n’importe où sur la ligne attraperait aussi la colonne du PAIR, qui contient « 0.0.0.0:* » sur chaque ligne de socket en écoute — et ferait conclure à une écoute qui n’existe pas. C’est exactement le défaut qu’un banc de ce dépôt a trouvé dans l’assistant Cockpit, et la leçon vaut ici.',
    verification: 'exportfs -v',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-server-readiness',
    source: `${MAN}/man8/ss.8.html`,
  },
  {
    id: 'cr-nfs-service',
    notion: 'nfs-server-readiness',
    besoin: 'Lire l’état du service NFS et les dernières lignes qu’il a écrites.',
    commande: 'systemctl status nfs-server --no-pager',
    exemple: 'systemctl status nfs-server --no-pager',
    parametres: [],
    options: [
      { option: '--no-pager', explication: '--no-pager écrit directement sur la sortie. Sans lui, systemctl ouvre un afficheur qui attend une touche, et dans un script cela ressemble à un blocage — même piège que journalctl.' },
    ],
    resultat: 'L’état de l’unité, son démarrage au boot, et ses dernières lignes de journal. Sur Ubuntu l’unité s’appelle nfs-server.service ; « nfs-kernel-server » en est un alias, et les deux noms circulent dans les mêmes tutoriels. Un service actif sans aucun export servi est un cas normal, et non une panne : il attend que la table soit synchronisée avec le fichier.',
    verification: 'systemctl is-enabled nfs-server',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-server-readiness',
    source: `${MAN}/man8/rpc.nfsd.8.html`,
  },
  {
    id: 'cr-nfs-clients-connectes',
    notion: 'nfs-export-create',
    besoin: 'Savoir qui est monté sur ce serveur AVANT de toucher aux exports.',
    commande: 'ss -tn state established "( sport = :2049 )"',
    exemple: 'ss -tn state established "( sport = :2049 )"',
    parametres: [],
    options: [
      { option: '-tn', explication: 'Deux options courtes de ss groupées : -t limite aux sockets TCP, les seuls qui portent une session NFS établie ; -n n’essaie pas de traduire les ports en noms, pour que « 2049 » reste lisible comme tel.' },
    ],
    resultat: 'Une ligne par connexion établie vers le port 2049 : ce sont les clients actuellement montés. C’est la commande à lancer AVANT « exportfs -ra » ou avant de retirer une ligne du fichier. Un client dont l’export disparaît ne reçoit pas de message : son point de montage se bloque, et le processus qui lisait un fichier reste suspendu. Une sortie vide est la bonne nouvelle qu’on cherchait. Le filtre entre parenthèses est la syntaxe d’expression de ss, et les guillemets empêchent l’interpréteur de lire les parenthèses comme les siennes.',
    verification: 'exportfs -v',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'nfs-export-create',
    source: `${MAN}/man8/ss.8.html`,
  },
  {
    id: 'cr-nfs-montages-client',
    notion: 'nfs-server-readiness',
    besoin: 'Lister les montages NFS de cette machine, et les options qu’ils portent vraiment.',
    commande: 'findmnt -t nfs,nfs4',
    exemple: 'findmnt -t nfs,nfs4',
    parametres: [],
    options: [
      { option: '-t', explication: '-t limite la sortie aux types de systèmes de fichiers nommés. « nfs » et « nfs4 » apparaissent tous deux selon la version négociée, et n’en demander qu’un laisse croire qu’il n’y a aucun montage.' },
    ],
    resultat: 'Une ligne par montage NFS : point de montage, source, type et options effectives. C’est la lecture à faire côté CLIENT, et elle répond à une question que « mount » seul rend confuse : la version réellement négociée apparaît dans les options, sous « vers= ». Un montage demandé en NFSv3 et obtenu en 4.2 se comporte autrement sur les verrous et sur les sous-répertoires, et personne ne l’a demandé.',
    verification: 'cat /proc/mounts',
    risque: 'lecture',
    retourArriere: null,
    assistant: null,
    source: `${MAN}/man8/findmnt.8.html`,
  },
  {
    id: 'cr-nfs-options-effectives',
    notion: 'nfs-server-readiness',
    besoin: 'Lire les options effectives d’UN montage NFS précis, version comprise.',
    commande: 'findmnt -o TARGET,SOURCE,FSTYPE,OPTIONS --target <POINT>',
    exemple: 'findmnt -o TARGET,SOURCE,FSTYPE,OPTIONS --target /mnt/essai',
    parametres: [
      { jeton: '<POINT>', role: 'Le point de montage côté client, ou n’importe quel chemin situé dessous — findmnt remonte au montage qui le porte.', exemple: '/mnt/essai' },
    ],
    options: [
      { option: '-o', explication: '-o choisit les colonnes affichées, dans l’ordre donné. La sortie par défaut est large et la colonne des options s’y trouve tronquée, ce qui cache précisément le « vers= » qu’on cherche.' },
      { option: '--target', explication: '--target désigne un chemin et affiche le montage qui le contient, au lieu d’exiger le point de montage exact. C’est ce qui permet de poser la question sur un fichier quand on ne sait pas où commence le montage.' },
    ],
    resultat: 'Une ligne : cible, source, type et options. « vers= » donne la version NFS réellement négociée ; « hard » ou « soft » dit ce qui se passera si le serveur ne répond plus — avec « hard », le défaut, l’accès se bloque indéfiniment plutôt que d’échouer, et c’est voulu : nfs(5) explique qu’un « soft » peut rendre des erreurs d’entrée-sortie silencieuses et corrompre des données. La réponse à « mon poste se figé quand le serveur tombe » est dans cette ligne, et ce n’est pas une panne.',
    verification: 'findmnt -t nfs,nfs4',
    risque: 'lecture',
    retourArriere: null,
    assistant: null,
    source: `${MAN}/man5/nfs.5.html`,
  },
  {
    id: 'cr-nfs-appliquer',
    notion: 'nfs-export-create',
    besoin: 'Mettre en service le contenu de /etc/exports, en sachant ce que cela retire.',
    commande: 'sudo exportfs -ra',
    exemple: 'sudo exportfs -ra',
    parametres: [],
    options: [
      { option: '-ra', explication: 'Deux options courtes d’exportfs groupées : -r réexporte tout en synchronisant la table /var/lib/nfs/etab avec /etc/exports, ce qui inclut le RETRAIT des entrées qui ont disparu du fichier ; -a porte l’opération sur l’ensemble des répertoires plutôt que sur un couple chemin/client nommé en argument.' },
    ],
    resultat: 'Aucune sortie quand tout va bien — et c’est ce silence qui fait croire à une commande neutre. Ce n’en est PAS une. Sa page de manuel écrit que -r « removes entries in /var/lib/nfs/etab which have been deleted from /etc/exports » et « removes any entries from the kernel export table which are no longer valid ». Donc : un export ajouté à la main avec « exportfs -o … » sans passer par le fichier disparaît ici, et les clients montés dessus se bloquent sur leur point de montage sans recevoir de message. Ce n’est pas non plus une validation : il n’existe aucune option d’essai à blanc dans exportfs, et le lancer « pour voir » coupe les montages de quelqu’un pour voir. Lance-la en sachant qui est connecté, puis RELIS avec « exportfs -v ».',
    verification: 'exportfs -v',
    risque: 'attention',
    retourArriere: 'sudo cp -p /etc/exports.kjemo-<horodatage>.bak /etc/exports && sudo exportfs -ra',
    assistant: 'nfs-export-create',
    source: `${MAN}/man8/exportfs.8.html`,
  },
  {
    id: 'cr-nfs-montage-essai',
    notion: 'nfs-export-create',
    besoin: 'Éprouver un export depuis un client, avant d’écrire quoi que ce soit dans /etc/fstab.',
    commande: 'sudo mount -t nfs <SERVEUR>:<EXPORT> <POINT>',
    exemple: 'sudo mount -t nfs 192.168.30.10:/srv/nfs/partage /mnt/essai',
    parametres: [
      { jeton: '<SERVEUR>', role: 'L’adresse ou le nom du serveur NFS. Une adresse d’abord : un nom ajoute la résolution DNS aux causes possibles d’échec.', exemple: '192.168.30.10' },
      { jeton: '<EXPORT>', role: 'Le chemin exporté, tel qu’il apparaît dans « showmount -e » — et non le chemin où tu veux le monter.', exemple: '/srv/nfs/partage' },
      { jeton: '<POINT>', role: 'Un dossier vide qui existe déjà sur le client. Monter sur un dossier non vide masque son contenu tant que le montage tient.', exemple: '/mnt/essai' },
    ],
    options: [
      { option: '-t', explication: '-t nomme le type de système de fichiers, ici « nfs ». Le noyau choisit alors mount.nfs, qui négocie la version la plus élevée que les deux machines acceptent — ce qui explique qu’un montage demandé en NFSv3 puisse arriver en 4.2.' },
    ],
    resultat: 'Aucune sortie en cas de succès ; le montage apparaît alors dans « findmnt -t nfs,nfs4 ». Un montage d’essai AVANT la ligne de /etc/fstab, et non après : une entrée fstab fautive peut retarder ou bloquer le démarrage de la machine, et on découvre alors le problème au pire moment. Les trois refus ont chacun un sens précis — « access denied by server » veut dire que l’adresse du client ne correspond à aucune ligne d’export ; un blocage sans message désigne un pare-feu qui absorbe le trafic du port 2049 ; et « Read-only file system » à la première écriture signifie que l’export est en « ro », ce qui est le défaut.',
    verification: 'findmnt -o TARGET,SOURCE,FSTYPE,OPTIONS --target /mnt/essai',
    risque: 'reversible',
    retourArriere: 'sudo umount /mnt/essai',
    assistant: 'nfs-export-create',
    source: `${MAN}/man8/mount.nfs.8.html`,
  },
];
