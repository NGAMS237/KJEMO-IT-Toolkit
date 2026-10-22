/**
 * commandes-services.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides des services, des journaux, des paquets et de l'heure.
 *
 * TOUTES EN LECTURE, et c'est une décision, pas un oubli.
 *
 * Le modèle du lot est explicite : une commande rapide pour OBSERVER, un
 * assistant pour AGIR. Pour les services, cette frontière a une raison de plus
 * que d'habitude : `systemctl restart` se tape en trois secondes et ne se
 * défait pas. Ce qui a été interrompu l'a été — pour une base de données ou
 * une file d'attente, les opérations en cours sont perdues, et c'est le
 * service qui en décide, pas systemd.
 *
 * Une commande rapide ne peut pas relire `is-active` après deux secondes, ne
 * peut pas refuser d'arrêter SSH depuis une session SSH, et ne peut pas
 * afficher le journal de l'unité quand l'action échoue. Les trois sont dans
 * `systemd-service-control`.
 *
 * Même raisonnement pour `apt-get install`, absent d'ici : la seule forme
 * offerte est `-s`, la SIMULATION, qui ne touche à rien et affiche le plan —
 * y compris les suppressions qu'une vraie installation entraînerait.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

export const commandesServices = [
  // =========================================================================
  // L'ÉTAT D'UNE UNITÉ — TROIS QUESTIONS, TROIS COMMANDES
  // =========================================================================
  {
    id: 'cr-systemctl-is-active',
    notion: 'systemd-service-diagnostic',
    besoin: 'Savoir si un service tourne MAINTENANT, en une seule ligne de réponse.',
    commande: 'systemctl is-active <UNITE>',
    exemple: 'systemctl is-active ssh.service',
    parametres: [
      { jeton: '<UNITE>', role: 'Le nom de l\'unité, suffixe compris. Sans suffixe, systemd ajoute « .service » — ce qui est faux si l\'unité est un .socket ou un .timer.', exemple: 'ssh.service' },
    ],
    options: [],
    resultat: 'Un seul mot : « active », « inactive », « failed » ou « activating ». Le code de retour vaut 0 seulement pour « active », ce qui rend la commande utilisable dans un test. « inactive » n\'est pas toujours une anomalie : un service oneshot terminé, ou un service déclenché par un socket, est normalement inactif.',
    verification: 'systemctl status <UNITE> --no-pager',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-diagnostic',
    source: `${MAN}/man1/systemctl.1.html`,
  },
  {
    id: 'cr-systemctl-is-enabled',
    notion: 'systemd-service-diagnostic',
    besoin: 'Savoir si un service démarrera au PROCHAIN démarrage — question différente de « tourne-t-il ? ».',
    commande: 'systemctl is-enabled <UNITE>',
    exemple: 'systemctl is-enabled ssh.service',
    parametres: [
      { jeton: '<UNITE>', role: 'Le nom de l\'unité, suffixe compris.', exemple: 'ssh.service' },
    ],
    options: [],
    resultat: 'Un mot : « enabled », « disabled », « static » ou « masked ». « static » veut dire que l\'unité n\'a pas de section [Install] : elle n\'est pas destinée à être activée, elle est démarrée par une dépendance — et « enable » n\'y changerait rien. « masked » veut dire qu\'elle est remplacée par un lien vers /dev/null : elle est indémarrable, y compris par ses dépendances, et le message d\'erreur de « start » ne parle pas du masquage.',
    verification: 'systemctl cat <UNITE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-control',
    source: `${MAN}/man1/systemctl.1.html`,
  },
  {
    id: 'cr-systemctl-cat',
    notion: 'systemd-service-diagnostic',
    besoin: 'Lire la configuration RÉELLEMENT en vigueur d\'une unité, drop-ins compris.',
    commande: 'systemctl cat <UNITE>',
    exemple: 'systemctl cat ssh.service',
    parametres: [
      { jeton: '<UNITE>', role: 'Le nom de l\'unité, suffixe compris.', exemple: 'ssh.service' },
    ],
    options: [],
    resultat: 'Le fichier de l\'unité, puis chacun de ses fichiers drop-in, dans l\'ordre où systemd les lit, chacun précédé de son chemin. C\'est la différence avec « cat /lib/systemd/system/ssh.service » : un drop-in sous /etc/systemd/system/ssh.service.d/ peut changer n\'importe quelle directive, et lire le fichier du paquet seul, c\'est lire une configuration qui n\'est pas celle en vigueur.',
    verification: 'systemctl show -p DropInPaths --value <UNITE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-diagnostic',
    source: `${MAN}/man1/systemctl.1.html`,
  },
  {
    id: 'cr-systemctl-failed',
    notion: 'systemd-service-diagnostic',
    besoin: 'Lister les unités en échec, y compris celles tombées depuis longtemps et devenues invisibles dans le journal.',
    commande: 'systemctl list-units --state=failed --no-pager',
    exemple: 'systemctl list-units --state=failed --no-pager',
    parametres: [],
    options: [
      { option: '--state', explication: '--state filtre sur l\'état de charge ou d\'activation. « failed » ne garde que les unités en échec — sans ce filtre, la liste contient des centaines d\'unités saines.' },
      { option: '--no-pager', explication: '--no-pager empêche systemctl d\'ouvrir un pager qui attend une touche. Indispensable dans un script : sans lui, un script lancé sans terminal reste bloqué là, sans rien dire.' },
    ],
    resultat: 'Une ligne par unité en échec, ou « 0 loaded units listed » s\'il n\'y en a aucune. C\'est la commande à lancer en premier sur une machine qui « va mal sans qu\'on sache pourquoi » : un service tombé il y a deux semaines n\'écrit plus rien, et n\'apparaît donc pas dans les dernières lignes du journal.',
    verification: 'journalctl -u <UNITE> -n 30 --no-pager',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-diagnostic',
    source: `${MAN}/man1/systemctl.1.html`,
  },

  // =========================================================================
  // LE JOURNAL
  // =========================================================================
  {
    id: 'cr-journalctl-unite',
    notion: 'systemd-service-diagnostic',
    besoin: 'Lire les dernières lignes de journal d\'un service, pour savoir pourquoi il a échoué.',
    commande: 'journalctl -u <UNITE> -n 50 --no-pager',
    exemple: 'journalctl -u ssh.service -n 50 --no-pager',
    parametres: [
      { jeton: '<UNITE>', role: 'Le nom de l\'unité. Attention : une unité mal orthographiée rend zéro ligne SANS erreur, ce qui ressemble à « tout va bien ».', exemple: 'ssh.service' },
    ],
    options: [
      { option: '-u', explication: '-u filtre sur une unité. C\'est ce qui distingue le journal d\'un service de celui de la machine entière.' },
      { option: '-n', explication: '-n limite au nombre de lignes les plus RÉCENTES. Sans lui, journalctl affiche tout depuis le début, ce qui se compte en centaines de milliers de lignes.' },
      { option: '--no-pager', explication: '--no-pager évite le pager qui attend une touche, et qui bloque un script lancé sans terminal.' },
    ],
    resultat: 'Les cinquante dernières lignes de cette unité, la plus récente en bas. Pour un service en échec, la cause est presque toujours dans les dix dernières lignes avant l\'arrêt.',
    verification: 'systemctl is-active <UNITE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-diagnostic',
    source: `${MAN}/man1/journalctl.1.html`,
  },
  {
    id: 'cr-journalctl-erreurs',
    notion: 'systemd-service-diagnostic',
    besoin: 'Voir les erreurs du système depuis le dernier démarrage, sans les noyer dans les lignes d\'information.',
    commande: 'journalctl -b -p err --no-pager -n 200',
    exemple: 'journalctl -b -p err --no-pager -n 200',
    parametres: [],
    options: [
      { option: '-b', explication: '-b limite au démarrage courant. Il ne dépend pas de l\'horloge — c\'est le filtre le plus fiable quand on soupçonne un problème d\'heure. « -b -1 » lit le démarrage précédent, souvent la seule façon de voir pourquoi la machine a redémarré.' },
      { option: '-p', explication: '-p fixe la priorité MINIMALE. Les priorités sont hiérarchiques : « err » inclut crit, alert et emerg, et exclut warning, notice et info.' },
      { option: '--no-pager', explication: '--no-pager évite le pager qui attend une touche.' },
      { option: '-n', explication: '-n limite au nombre de lignes les plus récentes.' },
    ],
    resultat: 'Les erreurs du démarrage courant, la plus récente en bas. Zéro ligne est une bonne nouvelle ici — contrairement à un filtre par unité, où zéro ligne peut simplement vouloir dire que le nom était faux.',
    verification: 'systemctl list-units --state=failed --no-pager',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-diagnostic',
    source: `${MAN}/man1/journalctl.1.html`,
  },
  {
    id: 'cr-journalctl-persistance',
    notion: 'systemd-service-diagnostic',
    besoin: 'Savoir si le journal survit au redémarrage — avant de chercher des lignes qui n\'existent plus.',
    commande: 'journalctl --list-boots --no-pager',
    exemple: 'journalctl --list-boots --no-pager',
    parametres: [],
    options: [
      { option: '--list-boots', explication: '--list-boots énumère les démarrages présents dans le journal, avec leur identifiant et leurs dates.' },
      { option: '--no-pager', explication: '--no-pager évite le pager qui attend une touche.' },
    ],
    resultat: 'Une ligne par démarrage connu. UNE SEULE ligne sur une machine qui a démarré plusieurs fois veut dire que le journal n\'est pas persistant : il vit en mémoire, et tout ce qui précède le dernier démarrage a disparu. C\'est pourtant toujours cela qu\'on cherche, puisqu\'on enquête après un incident. Le signe décisif est l\'existence de /var/log/journal : avec Storage=auto, la valeur par défaut, journald n\'écrit sur disque que si ce dossier existe.',
    verification: 'ls -d /var/log/journal',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-diagnostic',
    source: `${MAN}/man5/journald.conf.5.html`,
  },
  {
    id: 'cr-journalctl-place',
    notion: 'systemd-service-diagnostic',
    besoin: 'Savoir quelle place occupent les journaux, avant de se demander s\'il faut en supprimer.',
    commande: 'journalctl --disk-usage',
    exemple: 'journalctl --disk-usage',
    parametres: [],
    options: [
      { option: '--disk-usage', explication: '--disk-usage donne la taille totale occupée par les journaux, sur disque et en mémoire.' },
    ],
    resultat: 'Une ligne : « Archived and active journals take up … ». Le plafond vient de SystemMaxUse dans journald.conf, et vaut par défaut 10 pour cent du système de fichiers. Plafonner là vaut mieux que vider à la main : la décision est prise une fois, et elle s\'applique avant que le disque soit plein — alors qu\'un journal supprimé ne revient pas, et c\'est au milieu d\'une enquête qu\'on s\'en aperçoit.',
    verification: 'grep -E \'^[^#]*SystemMaxUse\' /etc/systemd/journald.conf',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'systemd-service-diagnostic',
    source: `${MAN}/man1/journalctl.1.html`,
  },

  // =========================================================================
  // LES PAQUETS
  // =========================================================================
  {
    id: 'cr-apt-cache-policy',
    notion: 'linux-package-diagnostic',
    besoin: 'Savoir si un paquet existe dans les dépôts, et quelle version serait installée.',
    commande: 'apt-cache policy <PAQUET>',
    exemple: 'apt-cache policy quota',
    parametres: [
      { jeton: '<PAQUET>', role: 'Le nom exact du paquet. Sans argument, apt-cache policy affiche à la place les dépôts configurés et leurs priorités.', exemple: 'quota' },
    ],
    options: [],
    resultat: 'La version installée, la version candidate — celle qu\'une installation poserait — et la liste des dépôts qui la fournissent. Un candidat « (none) » veut dire que le paquet n\'existe pas dans les dépôts configurés : le nom est faux, ou le composant universe est désactivé. C\'est la réponse qu\'il faut avant de conclure, à partir de « Unable to locate package », que le nom est mauvais : le problème est souvent l\'index.',
    verification: 'dpkg -l <PAQUET>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-package-diagnostic',
    source: `${MAN}/man8/apt-cache.8.html`,
  },
  {
    id: 'cr-apt-simulation',
    notion: 'linux-package-diagnostic',
    besoin: 'Savoir ce qu\'une installation ferait VRAIMENT — y compris ce qu\'elle retirerait — sans rien installer.',
    commande: 'sudo apt-get -s install <PAQUETS>',
    exemple: 'sudo apt-get -s install quota acl',
    parametres: [
      { jeton: '<PAQUETS>', role: 'Un ou plusieurs noms de paquets, séparés par des espaces. Aucun joker : APT les accepte et choisit large.', exemple: 'quota acl' },
    ],
    options: [
      { option: '-s', explication: '-s simule : aucune écriture, aucun téléchargement, aucune installation. APT calcule le plan et l\'affiche, c\'est tout. C\'est la seule forme d\'install présente dans ces commandes rapides, et c\'est délibéré.' },
    ],
    resultat: 'Le plan complet, préfixé par verbe : « Inst » installer, « Conf » configurer, « Remv » RETIRER. Les lignes « Remv » sont celles qui comptent : pour satisfaire une dépendance, APT peut proposer de retirer des paquets — parfois un service en production. C\'est écrit, dans un paragraphe suivi d\'un « Do you want to continue? [Y/n] » auquel on répond oui sans lire, et avec « -y » il n\'y a même plus de question. Demander deux paquets et en voir vingt dans le plan est en revanche normal : ce sont les dépendances.',
    verification: 'apt-cache policy <PAQUETS>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-package-diagnostic',
    source: `${MAN}/man8/apt-get.8.html`,
  },
  {
    id: 'cr-apt-upgradable',
    notion: 'linux-package-diagnostic',
    besoin: 'Lister les paquets pour lesquels une mise à jour est disponible.',
    commande: 'apt list --upgradable',
    exemple: 'apt list --upgradable',
    parametres: [],
    options: [
      { option: '--upgradable', explication: '--upgradable ne garde que les paquets installés dont une version plus récente est disponible. Sans lui, « apt list » énumère tout ce que les dépôts connaissent.' },
    ],
    resultat: 'Une ligne par paquet à mettre à jour, avec la version actuelle et la nouvelle. La réponse dépend de l\'index LOCAL : si l\'index est vieux, la liste l\'est aussi — « ls -ld /var/lib/apt/lists » donne sa date. Appliquer ces mises à jour est une opération de maintenance planifiée : elle peut redémarrer des services, et parfois demander un redémarrage.',
    verification: 'ls -ld /var/lib/apt/lists',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-package-diagnostic',
    source: `${MAN}/man8/apt.8.html`,
  },
  {
    id: 'cr-apt-mark-hold',
    notion: 'linux-package-diagnostic',
    besoin: 'Voir les paquets gelés, cause discrète d\'un correctif de sécurité qui ne s\'applique jamais.',
    commande: 'apt-mark showhold',
    exemple: 'apt-mark showhold',
    parametres: [],
    options: [],
    resultat: 'Un nom de paquet par ligne, ou rien du tout. Un paquet gelé n\'est jamais mis à jour par apt, et apt ne le signale pas : il obéit. C\'est la cause la plus silencieuse d\'un correctif qui n\'arrive pas — et parfois un gel posé il y a deux ans pour une raison que personne ne se rappelle. Pour dégeler : « sudo apt-mark unhold <paquet> ».',
    verification: 'apt list --upgradable',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-package-diagnostic',
    source: `${MAN}/man8/apt-mark.8.html`,
  },
  {
    id: 'cr-dpkg-etat',
    notion: 'linux-package-diagnostic',
    besoin: 'Lire l\'état réel d\'un paquet dans dpkg, qui tient l\'état — et non dans apt, qui l\'utilise.',
    commande: 'dpkg -l <PAQUET>',
    exemple: 'dpkg -l quota',
    parametres: [
      { jeton: '<PAQUET>', role: 'Le nom du paquet. Sans argument, dpkg -l liste tout ce que la base connaît.', exemple: 'quota' },
    ],
    options: [
      { option: '-l', explication: '-l liste les paquets et leur état. La première colonne est la plus utile, et personne ne la lit.' },
    ],
    resultat: 'Les deux premières lettres de la ligne donnent l\'état : « ii » installé et configuré, c\'est-à-dire normal ; « iU » ou « iF » installé mais NON configuré — une installation interrompue, le paquet est là et ne fonctionne pas, et tant qu\'il y est aucune autre installation ne passera ; « rc » retiré mais sa configuration reste dans /etc, inoffensif jusqu\'au jour où une réinstallation reprend des réglages oubliés. Un « iU » se répare avec « sudo dpkg --configure -a » puis « sudo apt-get -f install ».',
    verification: 'apt-cache policy <PAQUET>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-package-diagnostic',
    source: `${MAN}/man1/dpkg.1.html`,
  },

  // =========================================================================
  // L'HEURE
  // =========================================================================
  {
    id: 'cr-timedatectl-show',
    notion: 'linux-time-sync-diagnostic',
    besoin: 'Lire le fuseau, l\'état NTP demandé et l\'état réellement synchronisé, dans un format stable.',
    commande: 'timedatectl show',
    exemple: 'timedatectl show',
    parametres: [],
    options: [
      { option: 'show', explication: 'Le sous-commande « show » rend des lignes « Clef=valeur », stables et faites pour être lues par un programme. La sortie de « timedatectl » sans argument est faite pour un humain et change de forme entre versions : elle ne s\'analyse pas.' },
    ],
    resultat: 'Les lignes qui comptent sont deux, et on les confond tout le temps : « NTP=yes » dit que la synchronisation est DEMANDÉE, « NTPSynchronized=yes » dit qu\'une correction a RÉELLEMENT eu lieu. Un serveur peut avoir NTP=yes depuis six mois et NTPSynchronized=no parce que le port 123/udp est bloqué en sortie : tout semble configuré, et l\'heure dérive. « LocalRTC=no » signifie que l\'horloge matérielle est en UTC, le réglage attendu sur un serveur.',
    verification: 'timedatectl timesync-status',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-time-sync-diagnostic',
    source: `${MAN}/man1/timedatectl.1.html`,
  },
  {
    id: 'cr-timedatectl-timesync',
    notion: 'linux-time-sync-diagnostic',
    besoin: 'Savoir quel serveur de temps est réellement interrogé, et de combien l\'horloge était fausse.',
    commande: 'timedatectl timesync-status',
    exemple: 'timedatectl timesync-status',
    parametres: [],
    options: [
      { option: 'timesync-status', explication: 'Ce sous-commande interroge systemd-timesyncd. Elle ne répond que si c\'est lui le client de temps de la machine : avec chrony, c\'est « chronyc tracking » qui renseigne.' },
    ],
    resultat: 'Le serveur retenu, son adresse, la strate, l\'écart mesuré (Offset) et l\'intervalle d\'interrogation. C\'est la seule façon de vérifier qu\'un serveur imposé par le réseau est bien celui qui sert. Un Offset de quelques millisecondes est normal ; une seconde ou plus mérite attention — la tolérance de Kerberos est de cinq minutes, et au-delà une jonction de domaine échoue avec « Clock skew too great », message qui ne parle pas d\'heure.',
    verification: 'journalctl -u systemd-timesyncd -n 20 --no-pager',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-time-sync-diagnostic',
    source: `${MAN}/man8/systemd-timesyncd.service.8.html`,
  },
  {
    id: 'cr-hwclock-show',
    notion: 'linux-time-sync-diagnostic',
    besoin: 'Lire l\'horloge matérielle, celle qui donne l\'heure au démarrage avant que le réseau soit là.',
    commande: 'sudo hwclock --show',
    exemple: 'sudo hwclock --show',
    parametres: [],
    options: [
      { option: '--show', explication: '--show LIT l\'horloge matérielle et n\'y écrit rien. À ne pas confondre avec « --systohc », qui y écrit : sur une machine qui démarre aussi sous Windows, cela décale l\'heure de l\'autre système.' },
    ],
    resultat: 'La date et l\'heure de l\'horloge de la carte mère. Comparée à l\'heure système, elle explique une heure fausse juste après un démarrage, qui se corrige ensuite : c\'est l\'horloge matérielle qui sert au démarrage, avant que le client NTP ait pu joindre un serveur. Sur une machine virtuelle, cette horloge est souvent simulée par l\'hyperviseur et la question a moins de sens.',
    verification: 'timedatectl show -p LocalRTC --value',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-time-sync-diagnostic',
    source: `${MAN}/man8/hwclock.8.html`,
  },
];
