/**
 * commandes-stockage.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Commandes rapides du stockage : observation, montage, quotas, RAID.
 *
 * Le contrat de ces objets, et la raison de chacun de leurs champs, vit dans
 * dist/commandes-rapides.mjs. Ici, seulement les donnees.
 *
 * TROIS PRINCIPES TENUS DANS TOUT CE FICHIER
 *
 * 1. Aucun commentaire dans `commande` ni dans `exemple`. Ce qui s'explique
 *    s'explique a cote du bloc, jamais dedans.
 * 2. Aucun peripherique code en dur dans `commande` : /dev/sdb n'est pas le
 *    disque de tout le monde, et une commande rapide qui nomme un disque
 *    invite a la coller sans regarder. Les jetons <...> sont explicites,
 *    l'exemple est realiste et SEPARE.
 * 3. Le retour en arriere est ecrit, ou son absence est ecrite. Jamais tu.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

export const commandesStockage = [
  // =========================================================================
  // OBSERVATION — les sept commandes exigees par la consigne
  // =========================================================================
  {
    id: 'cr-lsblk-f',
    notion: 'linux-storage-diagnostic',
    besoin: 'Voir les disques, les partitions, leur systeme de fichiers et leur UUID.',
    commande: 'lsblk -f',
    exemple: 'lsblk -f',
    parametres: [],
    options: [
      { option: '-f', explication: '-f affiche le systeme de fichiers, l\'etiquette, l\'UUID et le point de montage de chaque partition. Sans lui, lsblk ne montre que la taille et le type.' },
    ],
    resultat: 'Un arbre : chaque disque, puis ses partitions, avec FSTYPE, LABEL, UUID et MOUNTPOINTS. Une partition sans FSTYPE n\'est pas formatee ; une partition sans MOUNTPOINTS n\'est pas montee.',
    verification: 'blkid',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-storage-diagnostic',
    source: `${MAN}/man8/lsblk.8.html`,
  },
  {
    id: 'cr-blkid',
    notion: 'linux-storage-diagnostic',
    besoin: 'Recuperer l\'UUID exact d\'une partition, pour l\'ecrire dans /etc/fstab.',
    commande: 'blkid',
    exemple: 'blkid',
    parametres: [],
    options: [],
    resultat: 'Une ligne par peripherique bloc, avec UUID et TYPE. C\'est cet UUID, et non /dev/sdb1, qui doit aller dans /etc/fstab : les noms /dev/sdX changent d\'ordre au redemarrage, l\'UUID non.',
    verification: 'lsblk -f',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-storage-diagnostic',
    source: `${MAN}/man8/blkid.8.html`,
  },
  {
    id: 'cr-fdisk-l',
    notion: 'linux-storage-diagnostic',
    besoin: 'Lister les tables de partitions de tous les disques, sans rien modifier.',
    commande: 'sudo fdisk -l',
    exemple: 'sudo fdisk -l',
    parametres: [],
    options: [
      { option: '-l', explication: '-l liste et SORT. C\'est le seul mode de fdisk qui ne propose jamais d\'ecrire : sans -l, fdisk ouvre une session interactive sur le disque nomme.' },
    ],
    resultat: 'Pour chaque disque : taille, type de table (gpt ou dos), et la liste des partitions avec leurs secteurs de debut et de fin.',
    verification: 'lsblk',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-storage-diagnostic',
    source: `${MAN}/man8/fdisk.8.html`,
  },
  {
    id: 'cr-findmnt',
    notion: 'linux-storage-diagnostic',
    besoin: 'Voir ce qui est monte, ou, et avec quelles options.',
    commande: 'findmnt',
    exemple: 'findmnt',
    parametres: [],
    options: [],
    resultat: 'L\'arbre des montages, avec la source, le point de montage, le type et les options. C\'est la reponse fiable a « est-ce que ce disque est monte ? », plus sure que de lire /etc/fstab, qui dit l\'intention et non l\'etat.',
    verification: 'df -hT',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-storage-diagnostic',
    source: `${MAN}/man8/findmnt.8.html`,
  },
  {
    id: 'cr-df-hT',
    notion: 'linux-storage-diagnostic',
    besoin: 'Connaitre l\'espace libre de chaque systeme de fichiers monte.',
    commande: 'df -hT',
    exemple: 'df -hT',
    parametres: [],
    options: [
      { option: '-hT', explication: '-h donne les tailles en Ko, Mo, Go plutot qu\'en blocs ; -T ajoute la colonne du type de systeme de fichiers, qui permet de reconnaitre d\'un coup d\'oeil les montages temporaires tmpfs des vrais disques.' },
    ],
    resultat: 'Une ligne par systeme de fichiers monte : type, taille, utilise, disponible, pourcentage, point de montage.',
    verification: 'findmnt',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-storage-diagnostic',
    source: `${MAN}/man1/df.1.html`,
  },
  {
    id: 'cr-mdstat',
    notion: 'linux-storage-diagnostic',
    besoin: 'Savoir si un ensemble RAID logiciel est sain, degrade, ou en reconstruction.',
    commande: 'cat /proc/mdstat',
    exemple: 'cat /proc/mdstat',
    parametres: [],
    options: [],
    resultat: 'Une ligne par ensemble md. Les crochets disent tout : [UU] signifie deux membres actifs et sains, [U_] un membre manquant — l\'ensemble tourne encore mais ne protege plus. Une reconstruction en cours affiche sa progression et son temps restant.',
    verification: 'sudo mdadm --detail <ENSEMBLE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-storage-diagnostic',
    source: `${MAN}/man4/md.4.html`,
  },
  {
    id: 'cr-mdadm-detail',
    notion: 'linux-storage-diagnostic',
    besoin: 'Voir le detail d\'un ensemble RAID : ses membres, leur role, et l\'etat de chacun.',
    commande: 'sudo mdadm --detail <ENSEMBLE>',
    exemple: 'sudo mdadm --detail /dev/md1',
    parametres: [
      { jeton: '<ENSEMBLE>', role: 'Le peripherique RAID a inspecter, tel que /proc/mdstat le nomme.', exemple: '/dev/md1' },
    ],
    options: [
      { option: '--detail', explication: '--detail interroge un ensemble DEJA ASSEMBLE. Pour interroger un disque membre pris isolement, c\'est --examine qu\'il faut, et il lit alors le super-bloc du disque.' },
    ],
    resultat: 'Le niveau de RAID, l\'etat (clean, degraded, recovering), le nombre de membres actifs, de membres de secours et de membres en echec, puis la liste nominative avec le role de chacun.',
    verification: 'cat /proc/mdstat',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-storage-diagnostic',
    source: `${MAN}/man8/mdadm.8.html`,
  },
  {
    id: 'cr-mdadm-examine',
    notion: 'linux-raid1-create',
    besoin: 'Savoir si un disque porte DEJA un super-bloc RAID, avant de s\'en servir comme membre ou comme secours.',
    commande: 'sudo mdadm --examine <DISQUE>',
    exemple: 'sudo mdadm --examine /dev/sdb',
    parametres: [
      { jeton: '<DISQUE>', role: 'Le disque pris ISOLEMENT, pas l\'ensemble. C\'est son super-bloc qu\'on lit, celui que mdadm y a ecrit la derniere fois qu\'il a servi.', exemple: '/dev/sdb' },
    ],
    options: [
      { option: '--examine', explication: '--examine lit le super-bloc d\'un MEMBRE. Ne pas le confondre avec --detail, qui interroge un ensemble deja assemble : sur un disque seul, --detail repond qu\'il ne s\'agit pas d\'un ensemble, et on en conclut a tort que le disque est vierge.' },
    ],
    resultat: 'Si le disque a deja servi : le nom de l\'ensemble, son UUID, le niveau de RAID, et le role que ce disque y tenait. S\'il n\'a jamais servi : « No md superblock detected », et c\'est la reponse qu\'on espere avant de creer un ensemble neuf.',
    verification: 'sudo wipefs -n <DISQUE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-raid1-create',
    source: `${MAN}/man8/mdadm.8.html`,
  },
  {
    id: 'cr-mdadm-detail-scan',
    notion: 'linux-raid1-create',
    besoin: 'Obtenir la ligne ARRAY a recopier dans /etc/mdadm/mdadm.conf, pour que l\'ensemble soit reassemble au demarrage.',
    commande: 'sudo mdadm --detail --scan',
    exemple: 'sudo mdadm --detail --scan',
    parametres: [],
    options: [
      { option: '--detail', explication: '--detail demande le detail des ensembles.' },
      { option: '--scan', explication: '--scan dit a mdadm de parcourir les ensembles ACTIFS au lieu d\'en attendre un en argument. Combine a --detail, il imprime une ligne ARRAY par ensemble, dans la forme exacte attendue par mdadm.conf.' },
    ],
    resultat: 'Une ligne « ARRAY /dev/mdX metadata=... UUID=... » par ensemble actif. La commande AFFICHE seulement : elle ne touche ni a mdadm.conf ni a l\'initramfs. Les deux restent a faire a la main, et c\'est deliberement laisse a l\'operateur.',
    verification: 'cat /etc/mdadm/mdadm.conf',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-raid1-create',
    source: `${MAN}/man8/mdadm.8.html`,
  },

  // =========================================================================
  // MONTAGE — reversible, mais pas anodin
  // =========================================================================
  {
    id: 'cr-mount',
    notion: 'linux-disk-partition-mount',
    besoin: 'Monter une partition deja formatee sur un dossier, le temps de la session.',
    commande: 'sudo mount <PARTITION> <POINT_DE_MONTAGE>',
    exemple: 'sudo mount /dev/sdb1 /srv/donnees',
    parametres: [
      { jeton: '<PARTITION>', role: 'La partition a monter. Prends-la dans lsblk -f, pas de memoire : les lettres /dev/sdX changent d\'ordre au redemarrage.', exemple: '/dev/sdb1' },
      { jeton: '<POINT_DE_MONTAGE>', role: 'Un dossier qui doit DEJA exister. S\'il contient des fichiers, ils deviennent invisibles tant que le montage dure — ils ne sont pas effaces, mais on les croit perdus.', exemple: '/srv/donnees' },
    ],
    options: [],
    resultat: 'Aucune sortie si tout va bien. La partition apparait alors dans findmnt et dans df -hT.',
    verification: 'findmnt <POINT_DE_MONTAGE>',
    risque: 'reversible',
    retourArriere: 'sudo umount <POINT_DE_MONTAGE>',
    assistant: 'linux-disk-partition-mount',
    source: `${MAN}/man8/mount.8.html`,
  },
  {
    id: 'cr-umount',
    notion: 'linux-disk-partition-mount',
    besoin: 'Demonter proprement un systeme de fichiers avant de retirer un disque.',
    commande: 'sudo umount <POINT_DE_MONTAGE>',
    exemple: 'sudo umount /srv/donnees',
    parametres: [
      { jeton: '<POINT_DE_MONTAGE>', role: 'Le dossier ou la partition est montee. Le peripherique marche aussi, mais le point de montage est moins ambigu quand le meme disque est monte deux fois.', exemple: '/srv/donnees' },
    ],
    options: [],
    resultat: 'Aucune sortie si tout va bien. Un message « target is busy » signifie qu\'un processus travaille encore dedans — ou simplement qu\'un terminal y est positionne.',
    verification: 'findmnt <POINT_DE_MONTAGE>',
    risque: 'reversible',
    retourArriere: 'sudo mount <POINT_DE_MONTAGE>',
    assistant: 'linux-disk-partition-mount',
    source: `${MAN}/man8/umount.8.html`,
  },
  {
    id: 'cr-mount-a',
    notion: 'linux-disk-partition-mount',
    besoin: 'Verifier qu\'un /etc/fstab modifie ne cassera pas le prochain demarrage.',
    commande: 'sudo mount -a',
    exemple: 'sudo mount -a',
    parametres: [],
    options: [
      { option: '-a', explication: '-a monte TOUTES les lignes de /etc/fstab qui ne sont pas deja montees. C\'est le test a faire AVANT de redemarrer : une erreur ici s\'affiche et se corrige, la meme erreur au demarrage peut laisser la machine en mode de secours.' },
    ],
    resultat: 'Aucune sortie si chaque ligne de /etc/fstab est valide. Toute erreur affichee ici est une erreur qui se serait produite au demarrage.',
    verification: 'findmnt --verify',
    risque: 'attention',
    retourArriere: 'sudo umount <POINT_DE_MONTAGE> pour chaque montage ajoute, puis restaurer la sauvegarde de /etc/fstab',
    assistant: 'linux-disk-partition-mount',
    source: `${MAN}/man8/mount.8.html`,
  },

  // =========================================================================
  // QUOTAS
  // =========================================================================
  {
    id: 'cr-quotaon',
    notion: 'linux-quota-enable',
    besoin: 'Activer la comptabilite des quotas sur un systeme de fichiers deja prepare.',
    commande: 'sudo quotaon -v <POINT_DE_MONTAGE>',
    exemple: 'sudo quotaon -v /srv/donnees',
    parametres: [
      { jeton: '<POINT_DE_MONTAGE>', role: 'Le systeme de fichiers monte avec usrquota ou grpquota, et deja passe par quotacheck.', exemple: '/srv/donnees' },
    ],
    options: [
      { option: '-v', explication: '-v affiche ce qui a ete active. Sans lui, la commande reussit en silence et rien ne distingue « active » de « deja active ».' },
    ],
    resultat: 'Une ligne confirmant l\'activation pour les utilisateurs, les groupes, ou les deux, selon les options presentes dans /etc/fstab.',
    verification: 'sudo repquota -a',
    risque: 'reversible',
    retourArriere: 'sudo quotaoff -v <POINT_DE_MONTAGE>',
    assistant: 'linux-quota-enable',
    source: `${MAN}/man8/quotaon.8.html`,
  },
  {
    id: 'cr-repquota',
    notion: 'linux-quota-limits',
    besoin: 'Voir qui consomme quoi, et qui depasse sa limite.',
    commande: 'sudo repquota -as',
    exemple: 'sudo repquota -as',
    parametres: [],
    options: [
      { option: '-as', explication: '-a parcourt tous les systemes de fichiers ou les quotas sont actifs ; -s affiche les tailles en unites lisibles plutot qu\'en blocs de 1 Ko.' },
    ],
    resultat: 'Un tableau par systeme de fichiers : par utilisateur, l\'espace utilise, la limite souple, la limite dure, et le delai de grace restant. Un « + » dans la colonne d\'etat signale un depassement de la limite souple.',
    verification: 'sudo quota -s -u <UTILISATEUR>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-quota-limits',
    source: `${MAN}/man8/repquota.8.html`,
  },

  // =========================================================================
  // RAID — suivi, et rien de plus en commande rapide
  // =========================================================================
  {
    id: 'cr-mdadm-reconstruction',
    notion: 'linux-raid-member-manage',
    besoin: 'Suivre l\'avancement d\'une reconstruction RAID en cours.',
    commande: 'watch -n 5 cat /proc/mdstat',
    exemple: 'watch -n 5 cat /proc/mdstat',
    parametres: [],
    options: [
      { option: '-n', explication: '-n 5 relit le fichier toutes les cinq secondes. Une reconstruction se compte en dizaines de minutes : rafraichir plus vite n\'apprend rien et occupe le terminal pour rien.' },
    ],
    resultat: 'La ligne « recovery » avec son pourcentage et son temps restant estime, rafraichie. Quitter avec Ctrl+C : cela n\'interrompt pas la reconstruction, qui se poursuit dans le noyau.',
    verification: 'cat /proc/mdstat',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-raid-member-manage',
    source: `${MAN}/man4/md.4.html`,
  },
  // =========================================================================
  // QUOTAS — observation, et les deux actes reversibles
  // =========================================================================
  {
    id: 'cr-quota-utilisateur',
    notion: 'linux-quota-limits',
    besoin: 'Voir la limite et la consommation d\'un utilisateur precis.',
    commande: 'sudo quota -u -s <UTILISATEUR>',
    exemple: 'sudo quota -u -s blaise',
    parametres: [
      { jeton: '<UTILISATEUR>', role: 'Le compte a interroger. Il doit exister : getent passwd le confirme.', exemple: 'blaise' },
    ],
    options: [
      { option: '-u', explication: '-u interroge la comptabilite des UTILISATEURS. Pour un groupe, c\'est -g : les deux comptabilites sont independantes, et un fichier compte pour son proprietaire ET pour son groupe.' },
      { option: '-s', explication: '-s affiche les tailles en unites lisibles plutot qu\'en blocs de 1 Kio. Sans lui, « 921600 » est la vraie valeur, mais personne ne la lit comme 900 Mio.' },
    ],
    resultat: 'Une ligne par systeme de fichiers avec quota : espace utilise, limite souple, limite dure, delai de grace, puis les memes colonnes pour le nombre de fichiers. Aucune sortie signifie qu aucune limite ne s applique a ce compte.',
    verification: 'sudo repquota -s <POINT_DE_MONTAGE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-quota-limits',
    source: `${MAN}/man1/quota.1.html`,
  },
  {
    id: 'cr-quota-grace',
    notion: 'linux-quota-limits',
    besoin: 'Connaitre la periode de grace, c\'est-a-dire combien de temps la limite souple peut etre depassee.',
    commande: 'sudo repquota -s <POINT_DE_MONTAGE>',
    exemple: 'sudo repquota -s /srv/donnees',
    parametres: [
      { jeton: '<POINT_DE_MONTAGE>', role: 'Le systeme de fichiers equipe de quotas.', exemple: '/srv/donnees' },
    ],
    options: [
      { option: '-s', explication: '-s affiche des unites lisibles. Les deux premieres lignes de la sortie donnent la periode de grace pour l espace et pour les fichiers.' },
    ],
    resultat: 'Les lignes « Block grace time » et « Inode grace time », puis le tableau par utilisateur. La grace est GLOBALE au systeme de fichiers : la changer pour une personne la change pour tout le monde.',
    verification: 'sudo quota -u -s <UTILISATEUR>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-quota-limits',
    source: `${MAN}/man8/repquota.8.html`,
  },
  {
    id: 'cr-setquota-retirer',
    notion: 'linux-quota-limits',
    besoin: 'Retirer toute limite de quota a un utilisateur, sans toucher a ses fichiers.',
    commande: 'sudo setquota -u <UTILISATEUR> 0 0 0 0 <POINT_DE_MONTAGE>',
    exemple: 'sudo setquota -u blaise 0 0 0 0 /srv/donnees',
    parametres: [
      { jeton: '<UTILISATEUR>', role: 'Le compte dont on retire les limites.', exemple: 'blaise' },
      { jeton: '<POINT_DE_MONTAGE>', role: 'Le systeme de fichiers equipe de quotas.', exemple: '/srv/donnees' },
    ],
    options: [
      { option: '-u', explication: '-u vise la comptabilite des utilisateurs. Les quatre zeros sont, dans l ordre : espace souple, espace dur, fichiers souple, fichiers dur. Un zero signifie « aucune limite », et non « limite de zero ».' },
    ],
    resultat: 'Aucune sortie si tout va bien. L utilisateur n a plus aucune limite sur ce systeme de fichiers, et aucun de ses fichiers n a ete touche.',
    verification: 'sudo quota -u -s <UTILISATEUR>',
    risque: 'reversible',
    retourArriere: 'sudo setquota -u <UTILISATEUR> <ancien-souple> <ancien-dur> <ancien-isouple> <ancien-idur> <POINT_DE_MONTAGE>',
    assistant: 'linux-quota-limits',
    source: `${MAN}/man8/setquota.8.html`,
  },
  {
    id: 'cr-quotaoff',
    notion: 'linux-quota-enable',
    besoin: 'Desactiver la comptabilite des quotas sur un systeme de fichiers, sans rien supprimer.',
    commande: 'sudo quotaoff -v <POINT_DE_MONTAGE>',
    exemple: 'sudo quotaoff -v /srv/donnees',
    parametres: [
      { jeton: '<POINT_DE_MONTAGE>', role: 'Le systeme de fichiers dont on arrete la comptabilite.', exemple: '/srv/donnees' },
    ],
    options: [
      { option: '-v', explication: '-v affiche ce qui a ete desactive. Sans lui, la commande reussit en silence et rien ne distingue « desactive » de « deja desactive ».' },
    ],
    resultat: 'Une ligne par comptabilite arretee. Les limites ne sont pas effacees : elles redeviennent actives au prochain quotaon. Aucune donnee utilisateur n est touchee.',
    verification: 'sudo repquota -a',
    risque: 'reversible',
    retourArriere: 'sudo quotaon -v <POINT_DE_MONTAGE>',
    assistant: 'linux-quota-enable',
    source: `${MAN}/man8/quotaon.8.html`,
  },
];
