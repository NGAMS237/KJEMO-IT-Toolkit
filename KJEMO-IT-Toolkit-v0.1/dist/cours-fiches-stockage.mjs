/**
 * cours-fiches-stockage.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Disques, systèmes de fichiers, quotas et RAID 1, en procédures pas à pas.
 *
 * RÈGLES PROPRES À CE FICHIER
 *  - Aucun périphérique n'est présumé : /dev/sdb, /dev/sdc, /dev/md0 ou
 *    /dev/md127 n'apparaissent JAMAIS dans une commande, seulement comme
 *    exemple d'un champ. La personne les lit d'abord dans « lsblk » ou
 *    « /proc/mdstat » et les saisit elle-même (type « peripherique »).
 *  - Toute étape destructive dit CE QUI SERA EFFACÉ et sur quoi.
 *  - Les réglages de laboratoire sont séparés des réglages professionnels.
 */
import { MAN, lec, mod, des, itr, sh, ficheLinux } from './cours-outils.mjs';

const WIKI_MD = 'https://raid.wiki.kernel.org/index.php/RAID_setup';

export const COURS_STOCKAGE = [
  ficheLinux({
    id: 'cours-partition-formater-monter',
    titre: 'Partitionner, formater et monter un nouveau disque (fdisk, ext4)',
    resume: 'Crée une partition sur un disque que TU désignes, la formate en ext4, lui donne une étiquette, la monte sur un dossier et prépare le montage automatique par étiquette dans /etc/fstab. Le partitionnement et le formatage EFFACENT ce que le disque contenait.',
    effet: 'destructif',
    intentions: ['fdisk partition ext4', 'ajouter un disque linux', 'mkfs.ext4 e2label', 'monter un disque fstab', 'partprobe', 'blkid uuid', 'formater une partition linux'],
    motsCles: ['fdisk', 'partprobe', 'mkfs.ext4', 'e2label', 'blkid', 'mount', 'fstab', 'lsblk', 'ext4', 'étiquette', 'uuid', 'partition', 'disque'],
    params: [
      { id: 'disque', label: 'disque entier à partitionner', type: 'peripherique', portee: 'disque', exemple: '/dev/sdb', aide: 'Exemple seulement. Lis la colonne NAME et la taille dans « lsblk » (étape 1) : le disque neuf, sans partition ni point de montage. Ne jamais présumer.' },
      { id: 'partition', label: 'partition créée', type: 'peripherique', portee: 'partition', exemple: '/dev/sdb1', aide: 'Exemple seulement. C’est le disque ci-dessus suivi du numéro de partition que fdisk a créée (relu dans « lsblk » à l’étape 4).' },
      { id: 'etiquette', label: 'étiquette du système de fichiers', type: 'etiquetteExt4', exemple: 'data_tp2', aide: '16 caractères au plus (lettres, chiffres, « _ », « - »).' },
      { id: 'pointMontage', label: 'dossier de montage', type: 'chemin', exemple: '/DATA_TP2', aide: 'Chemin absolu sans espace ; sera créé s’il n’existe pas.' },
    ],
    privileges: 'Administrateur : sudo. Le disque doit être ajouté à la machine (ou à la VM) AVANT de commencer.',
    etapes: [
      lec('Repérer le disque neuf', 'Liste tous les disques avec leur taille, leurs partitions et leurs points de montage. Le disque que tu viens d’ajouter est celui qui a la bonne taille et AUCUNE partition ni point de montage. Si un doute subsiste, arrête-toi : ce qui suit efface.', [sh('lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINTS')], 'Une ligne par disque et partition. Le disque neuf a un TYPE « disk », la taille attendue et rien dans FSTYPE, LABEL ni MOUNTPOINTS.', { important: 'Ne jamais présumer le nom du disque : sdb, sdc, vdb et nvme1n1 sont tous possibles selon la machine.' }),
      lec('Vérifier que le disque est vide', 'wipefs, sans option, ne fait que LISTER les signatures (système de fichiers, RAID, table de partitions) déjà présentes. Aucune sortie signifie un disque vierge ; des lignes signifient que ce disque contient déjà quelque chose.', [sh('sudo wipefs {{disque}}')], 'Aucune sortie pour un disque vierge. Toute ligne est la preuve que le disque a déjà servi.', { important: 'S’il affiche des signatures et que tu n’es pas sûr de pouvoir les perdre, STOP : choisis un autre disque.' }),
      des('Créer la partition avec fdisk', 'fdisk ouvre une session interactive. RIEN n’est écrit sur le disque tant que tu n’as pas tapé « w » (« q » quitte sans rien écrire) ; une fois « w » tapé, l’ancienne table de partitions est ÉCRASÉE et ce que le disque contenait n’est plus accessible.', [sh('sudo fdisk {{disque}}')], 'fdisk affiche « Command (m for help): » et attend tes réponses (voir les interruptions ci-dessous).', {
        interactions: [
          { attend: 'Command (m for help):', reponds: 'n (nouvelle partition)' },
          { attend: 'Partition type: p primary / e extended (affiché sur une table DOS)', reponds: 'p (primaire)' },
          { attend: 'Partition number', reponds: 'Entrée pour garder 1' },
          { attend: 'First sector', reponds: 'Entrée pour accepter la valeur proposée' },
          { attend: 'Last sector, +/-sectors or +/-size{K,M,G,T,P}', reponds: 'Entrée pour utiliser tout le disque, ou une taille comme +500M pour n’en prendre qu’une partie' },
          { attend: 'Command (m for help):', reponds: 'p pour relire la table AVANT d’écrire' },
          { attend: 'Command (m for help):', reponds: 'w pour écrire la table et quitter (ou q pour tout annuler)' },
        ],
        important: 'Cette étape remplace la table de partitions du disque désigné : les partitions et données qu’il contenait deviennent inaccessibles. Vérifie encore une fois le nom du disque avant de taper w.',
      }),
      mod('Forcer le noyau à relire la table', 'partprobe informe le noyau de la nouvelle table, sans redémarrer. Sans lui, la nouvelle partition peut ne pas apparaître tout de suite.', [sh('sudo partprobe {{disque}}'), sh('lsblk {{disque}}')], 'lsblk montre maintenant une ligne « part » sous le disque : c’est la partition à saisir plus haut.'),
      des('Créer le système de fichiers ext4', 'mkfs.ext4 écrit un système de fichiers vierge dans la partition : tout ce qu’elle contenait est PERDU. Si elle contient déjà un système de fichiers, mkfs le signale et demande confirmation.', [sh('sudo mkfs.ext4 {{partition}}')], 'Des lignes « Creating filesystem… », « Writing superblocks and filesystem accounting information: done ».', {
        interactions: [{ attend: 'Proceed anyway? (y,N)  (seulement si la partition contient déjà un système de fichiers)', reponds: 'N — sauf si tu es CERTAIN de vouloir effacer ce qui s’y trouve.' }],
        important: 'Efface le contenu de la partition désignée. Si l’étape 2 affichait des signatures, ne continue pas sans avoir compris pourquoi.',
      }),
      mod('Attribuer une étiquette', 'e2label écrit le nom du système de fichiers (on peut aussi le faire à la création avec mkfs.ext4 -L). L’étiquette sert ensuite à le monter sans dépendre du nom du disque, qui peut changer.', [sh('sudo e2label {{partition}} {{etiquette}}')], 'Aucun message en cas de succès.'),
      lec('Lire l’étiquette et l’UUID', 'blkid affiche l’identifiant unique (UUID) et l’étiquette. L’UUID est le moyen le plus stable de désigner un système de fichiers dans /etc/fstab (à la place de LABEL=, écris UUID=valeur-relevée).', [sh('sudo blkid {{partition}}')], 'Une ligne avec LABEL, UUID et TYPE="ext4".', { verification: true }),
      mod('Créer le dossier de montage et monter', 'Un système de fichiers n’est utilisable qu’une fois monté sur un dossier. Ce montage-ci disparaît au redémarrage tant que fstab n’est pas renseigné (étape suivante).', [sh('sudo mkdir -p {{pointMontage}}'), sh('sudo mount {{partition}} {{pointMontage}}')], 'Aucun message en cas de succès.'),
      mod('Écrire un premier fichier', 'Un fichier créé dans le point de montage vit désormais sur la nouvelle partition. sudo tee écrit avec les droits de l’administrateur (le dossier appartient à root).', [sh('echo premier fichier de la partition | sudo tee {{pointMontage}}/test_tp2')], 'La ligne de texte est affichée en retour par tee.'),
      mod('Prévoir le montage automatique (par étiquette)', 'Sauvegarde fstab, puis y ajoute une ligne qui monte la partition par son étiquette à chaque démarrage. « 0 2 » = pas de dump, vérifié après la racine.', [sh('sudo cp -a /etc/fstab /etc/fstab.avant-cours'), sh('echo \'LABEL={{etiquette}} {{pointMontage}} ext4 defaults 0 2\' | sudo tee -a /etc/fstab')], 'tee affiche la ligne ajoutée.', { important: 'Une ligne fstab erronée peut empêcher la machine de démarrer normalement. Ne redémarre pas avant d’avoir fait l’étape suivante.' }),
      lec('Contrôler fstab avant tout redémarrage', 'findmnt --verify analyse /etc/fstab (fautes de syntaxe, point de montage manquant, périphérique introuvable) sans rien monter. mount -a, ensuite, tente de monter tout ce qui est déclaré et pas encore monté.', [sh('sudo findmnt --verify'), sh('sudo mount -a')], 'findmnt ne signale aucune erreur ; mount -a ne répond rien. Si une erreur apparaît, restaure /etc/fstab.avant-cours.', { options: [{ option: '--verify', explication: 'findmnt : contrôle la cohérence de fstab au lieu de lister les montages.' }, { option: '-a', explication: 'mount : monte tous les systèmes de fichiers de fstab qui ne le sont pas encore.' }], verification: true }),
      lec('Voir l’occupation, lisiblement', 'df -h affiche, en unités lisibles, la taille, l’espace utilisé et libre de chaque système de fichiers monté.', [sh('df -h {{pointMontage}}')], 'Une ligne pour la nouvelle partition, montée sur le dossier choisi.', { options: [{ option: '-h', explication: 'Unités lisibles (Ko, Mo, Go) au lieu de blocs bruts.' }], verification: true }),
    ],
    verification: ['lsblk montre la partition avec son étiquette et son point de montage ; df -h la liste ; findmnt --verify ne signale rien.'],
    retour: 'Pour défaire : sudo umount (dossier), supprime la ligne ajoutée de /etc/fstab (ou restaure /etc/fstab.avant-cours), puis relance fdisk pour supprimer la partition. Les données effacées par mkfs, elles, ne reviennent pas.',
    sources: [
      { label: 'fdisk(8)', url: `${MAN}/man8/fdisk.8.html` },
      { label: 'partprobe(8)', url: `${MAN}/man8/partprobe.8.html` },
      { label: 'mkfs.ext4 (mke2fs)(8)', url: `${MAN}/man8/mke2fs.8.html` },
      { label: 'e2label (tune2fs)(8)', url: `${MAN}/man8/e2label.8.html` },
      { label: 'blkid(8)', url: `${MAN}/man8/blkid.8.html` },
      { label: 'fstab(5)', url: `${MAN}/man5/fstab.5.html` },
      { label: 'findmnt(8)', url: `${MAN}/man8/findmnt.8.html` },
      { label: 'wipefs(8)', url: `${MAN}/man8/wipefs.8.html` },
    ],
  }),

  ficheLinux({
    id: 'cours-quotas-utilisateur',
    titre: 'Activer les quotas utilisateur sur une partition ext4',
    resume: 'Ajoute l’option usrquota au montage, crée les fichiers de quotas, les active, fixe une limite souple et une limite stricte pour un compte et affiche la consommation. Modifie /etc/fstab : sauvegarde d’abord.',
    effet: 'modification',
    intentions: ['quotas utilisateur linux', 'usrquota fstab', 'quotacheck quotaon', 'edquota setquota', 'limite disque par utilisateur', 'repquota'],
    motsCles: ['quota', 'usrquota', 'quotacheck', 'quotaon', 'edquota', 'setquota', 'repquota', 'fstab', 'limite soft hard'],
    params: [
      { id: 'pointMontage', label: 'dossier de montage de la partition', type: 'chemin', exemple: '/DATA_TP2', aide: 'Le point de montage de la partition déjà formatée et montée.' },
      { id: 'utilisateur', label: 'compte à limiter', type: 'identifiant', exemple: 'alice', aide: 'Un compte que le système sait résoudre (getent passwd).' },
      { id: 'souple', label: 'limite souple (en Kio)', type: 'entier', min: 1, max: 4294967295, exemple: '266240', aide: 'En blocs de 1 Kio : 260 Mio = 266240. Dépassable pendant la période de grâce.' },
      { id: 'stricte', label: 'limite stricte (en Kio)', type: 'entier', min: 1, max: 4294967295, superieurA: 'souple', exemple: '266250', aide: 'Jamais dépassable. Au moins égale à la limite souple (ex. souple + 10 Kio).' },
    ],
    privileges: 'Administrateur : sudo.',
    etapes: [
      mod('Installer les outils de quotas', 'Le paquet « quota » fournit quotacheck, quotaon, edquota, setquota, quota et repquota.', [sh('sudo apt install quota')], 'apt installe le paquet (ou indique qu’il est déjà installé).', { important: 'Sur un noyau « cloud » ou allégé, la prise en charge des quotas peut manquer : si quotaon échoue plus loin avec un message sur le noyau, installe le paquet linux-modules-extra de ta version de noyau.' }),
      mod('Sauvegarder fstab', 'Garde une copie pour pouvoir revenir en arrière.', [sh('sudo cp -a /etc/fstab /etc/fstab.avant-quotas')], 'Aucun message.'),
      mod('Ajouter usrquota à la ligne du montage', 'Dans la ligne qui monte la partition, remplace « defaults » par « defaults,usrquota ». Rien d’autre ne doit changer sur la ligne.', [sh('sudo nano /etc/fstab')], 'nano s’ouvre sur le fichier ; la ligne devient « LABEL=… point-de-montage ext4 defaults,usrquota 0 2 » (selon ta ligne actuelle).', {
        interactions: [
          { attend: '(nano est ouvert)', reponds: 'Repère la ligne de ta partition, ajoute « ,usrquota » après « defaults » (sans espace).' },
          { attend: '(enregistrer et quitter)', reponds: 'Ctrl+O puis Entrée pour enregistrer, Ctrl+X pour quitter.' },
        ],
        important: 'Une faute dans fstab peut gêner le prochain démarrage : relis la ligne et passe à l’étape suivante avant de redémarrer.',
      }),
      itr('Remonter pour appliquer l’option', 'mount -o remount réapplique les options sans démonter. Si des processus utilisent le dossier, ils continuent à fonctionner.', [sh('sudo mount -o remount {{pointMontage}}'), sh('findmnt -no OPTIONS {{pointMontage}}')], 'La liste des options contient « usrquota ». Sinon, relis la ligne fstab : l’option n’est pas prise en compte.', { verification: true }),
      mod('Créer les fichiers de quotas', 'quotacheck parcourt la partition, calcule la consommation de chaque compte et crée le fichier de quotas (-c : créer, -u : quotas utilisateur).', [sh('sudo quotacheck -cu {{pointMontage}}')], 'Pas de message d’erreur ; un fichier aquota.user apparaît à la racine de la partition.', { options: [{ option: '-c', explication: 'Crée les fichiers de quotas au lieu de les lire.' }, { option: '-u', explication: 'Concerne les quotas par utilisateur.' }] }),
      mod('Activer les quotas', 'quotaon met en application la comptabilité et les limites sur la partition.', [sh('sudo quotaon -v {{pointMontage}}')], 'Un message indiquant que les quotas utilisateur sont activés sur la partition.', { options: [{ option: '-v', explication: 'Affiche ce qui est activé.' }] }),
      mod('Fixer les limites du compte', 'setquota -u compte limite-souple limite-stricte limite-inodes-souple limite-inodes-stricte partition. Les blocs sont en Kio ; 0 signifie « pas de limite » (ici sur le nombre de fichiers). edquota -u compte fait la même chose dans un éditeur.', [sh('sudo setquota -u {{utilisateur}} {{souple}} {{stricte}} 0 0 {{pointMontage}}')], 'Aucun message en cas de succès.', { important: 'La limite souple est dépassable pendant la période de grâce ; la stricte ne l’est jamais. Aucune des deux n’efface de données.' }),
      lec('Vérifier', 'quota -u affiche la consommation et les limites du compte ; repquota liste tous les comptes de la partition.', [sh('sudo quota -u {{utilisateur}}'), sh('sudo repquota -s {{pointMontage}}')], 'La ligne du compte montre ses blocs utilisés et les limites choisies.', { verification: true }),
    ],
    verification: ['quota -u affiche les limites choisies pour le compte.'],
    retour: 'sudo setquota -u compte 0 0 0 0 partition retire les limites ; sudo quotaoff partition désactive la comptabilité ; restaure /etc/fstab.avant-quotas pour retirer l’option.',
    sources: [
      { label: 'quotacheck(8)', url: `${MAN}/man8/quotacheck.8.html` },
      { label: 'quotaon(8)', url: `${MAN}/man8/quotaon.8.html` },
      { label: 'setquota(8)', url: `${MAN}/man8/setquota.8.html` },
      { label: 'edquota(8)', url: `${MAN}/man8/edquota.8.html` },
      { label: 'repquota(8)', url: `${MAN}/man8/repquota.8.html` },
    ],
  }),

  ficheLinux({
    id: 'cours-donner-dossier-compte',
    titre: 'Donner un dossier à un compte et tester l’écriture',
    resume: 'Change le propriétaire et le groupe d’un dossier, puis vérifie qu’il peut y créer un dossier et un fichier. Fonctionne avec un compte local ou un compte du domaine que le système sait résoudre.',
    effet: 'modification',
    intentions: ['chown linux', 'changer le propriétaire d un dossier', 'compte du domaine propriétaire dossier', 'tester l écriture d un utilisateur', 'sudo -u'],
    motsCles: ['chown', 'propriétaire', 'groupe', 'sudo -u', 'getent', 'wbinfo', 'écriture', 'test'],
    params: [
      { id: 'dossier', label: 'dossier à donner', type: 'chemin', exemple: '/DATA_TP2', aide: 'Chemin absolu sans espace.' },
      { id: 'compte', label: 'compte propriétaire', type: 'identifiant', exemple: 'alice', aide: 'Un compte que « getent passwd » retrouve. Pour un compte de domaine, le format peut exiger le préfixe du domaine : vérifie à l’étape 1.' },
      { id: 'groupe', label: 'groupe propriétaire', type: 'identifiant', exemple: 'users', aide: 'Un groupe que « getent group » retrouve.' },
    ],
    privileges: 'Administrateur : sudo.',
    etapes: [
      lec('Vérifier que le système connaît le compte et le groupe', 'chown n’accepte que ce que le système sait résoudre. Une sortie vide signifie que le nom est inconnu (pour un compte de domaine : winbind ou SSSD non configuré, ou nom à préfixer).', [sh('getent passwd {{compte}}'), sh('getent group {{groupe}}')], 'Une ligne par commande. Si l’une est vide, ne continue pas : chown échouerait.', { important: 'Pour un compte de domaine Samba, « wbinfo -i compte » est la vérification équivalente ; son résultat donne aussi les identifiants numériques utilisables avec chown.' }),
      lec('Relever l’état actuel', 'Garde le propriétaire et le groupe actuels : c’est ton retour en arrière.', [sh('ls -ld {{dossier}}')], 'Une ligne avec les droits, le propriétaire et le groupe actuels.'),
      mod('Changer propriétaire et groupe', 'chown compte:groupe donne le dossier au compte et au groupe (le dossier seulement ; ajoute -R pour tout son contenu).', [sh('sudo chown {{compte}}:{{groupe}} {{dossier}}')], 'Aucun message en cas de succès.'),
      mod('Tester l’écriture avec ce compte', 'sudo -u exécute la commande en tant que le compte : s’il a le droit d’écrire dans le dossier, le dossier et le fichier sont créés.', [sh('sudo -u {{compte}} mkdir {{dossier}}/dossier-test'), sh('sudo -u {{compte}} touch {{dossier}}/dossier-test/fichier-test')], 'Aucun message. Une erreur « Permission non accordée » signifie que les droits du dossier n’autorisent pas le compte.'),
      lec('Vérifier', 'Liste le dossier : le propriétaire des éléments créés doit être le compte.', [sh('ls -lR {{dossier}}')], 'Le dossier et le fichier de test appartiennent au compte.', { verification: true }),
    ],
    verification: ['Le dossier appartient au compte et au groupe choisis, et le compte a pu y écrire.'],
    retour: 'Remets le propriétaire et le groupe relevés à l’étape 2 : sudo chown ancien-compte:ancien-groupe dossier. Supprime le dossier de test avec rm -r.',
    sources: [{ label: 'chown(1)', url: `${MAN}/man1/chown.1.html` }, { label: 'getent(1)', url: `${MAN}/man1/getent.1.html` }, { label: 'sudo(8)', url: `${MAN}/man8/sudo.8.html` }],
  }),

  ficheLinux({
    id: 'cours-raid1-creer',
    titre: 'Créer un RAID 1 (miroir) avec mdadm, le formater et le monter',
    resume: 'Assemble deux disques que TU désignes en un miroir, attend la synchronisation, formate la matrice, la monte et rend sa déclaration persistante. La création EFFACE les deux disques ; le nom de la matrice (md0, md127…) est lu, jamais présumé.',
    effet: 'destructif',
    intentions: ['raid1 mdadm', 'créer un raid 1 linux', 'mdadm --create', 'miroir de disques linux', 'proc mdstat', 'md127'],
    motsCles: ['mdadm', 'raid1', 'raid', 'miroir', 'mdstat', 'md0', 'md127', 'mdadm.conf', 'update-initramfs', 'disque', 'ext4'],
    params: [
      { id: 'disque1', label: 'premier disque du miroir', type: 'peripherique', portee: 'disque', distinctDe: ['disque2'], exemple: '/dev/sdb', aide: 'Exemple seulement. Disque entier, vide, lu dans « lsblk ». Jamais présumé.' },
      { id: 'disque2', label: 'second disque du miroir', type: 'peripherique', portee: 'disque', distinctDe: ['disque1'], exemple: '/dev/sdc', aide: 'Exemple seulement. Un AUTRE disque entier, vide, de taille égale ou supérieure.' },
      { id: 'matrice', label: 'nom de la matrice à créer', type: 'peripherique', portee: 'md', exemple: '/dev/md1', aide: 'Un nom libre : vérifie dans /proc/mdstat qu’il n’est pas déjà pris (étape 2). Le nom lu au démarrage peut différer (md127) si la matrice n’est pas déclarée.' },
      { id: 'pointMontage', label: 'dossier de montage', type: 'chemin', exemple: '/DATA_EXT4', aide: 'Chemin absolu sans espace ; créé s’il n’existe pas.' },
      { id: 'uuid', label: 'UUID du système de fichiers de la matrice', type: 'uuid', exemple: '3f9a1c52-7d14-4b6e-9a0e-5c8d2f41b7aa', aide: 'Relevé par blkid à l’étape 8 ; sert à la ligne fstab.' },
    ],
    privileges: 'Administrateur : sudo. Deux disques supplémentaires doivent déjà être attachés à la machine.',
    etapes: [
      lec('Repérer les deux disques neufs', 'Les deux disques du miroir sont ceux qui n’ont AUCUNE partition ni point de montage. Sur un doute, arrête-toi : la création les efface.', [sh('lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS')], 'Deux disques du même gabarit, sans FSTYPE ni MOUNTPOINTS.', { important: 'Ne jamais présumer les noms des disques ni celui de la matrice.' }),
      lec('Vérifier qu’aucune matrice n’existe déjà', '/proc/mdstat liste les matrices actives. mdadm --examine lit la signature RAID d’un disque : « No md superblock detected » signifie qu’il n’a jamais servi à un RAID.', [sh('cat /proc/mdstat'), sh('sudo mdadm --examine {{disque1}} {{disque2}}')], 'Pas de matrice portant le nom que tu veux ; « No md superblock detected » pour chaque disque.', { important: 'Si un disque affiche une signature RAID, il appartenait à une matrice : ne continue pas avant de savoir si ses données comptent encore.' }),
      mod('Installer mdadm', 'Le paquet fournit la commande mdadm.', [sh('sudo apt install mdadm')], 'apt installe le paquet (ou indique qu’il est déjà installé).', { interactions: [{ attend: 'Configuration de postfix / envoi de courriel (selon le système)', reponds: 'Choisis « Aucune configuration » si l’assistant le propose, sauf besoin d’alertes par courriel.' }] }),
      des('Créer le miroir', 'mdadm écrit un bloc de métadonnées sur chacun des deux disques et lance la synchronisation : tout ce que les deux disques contenaient devient inaccessible. --level=1 = miroir, --raid-devices=2 = deux disques actifs.', [sh('sudo mdadm --create {{matrice}} --level=1 --raid-devices=2 {{disque1}} {{disque2}}')], 'mdadm indique que la matrice a démarré (« array … started »).', { options: [{ option: '--create', explication: 'Crée une nouvelle matrice.' }, { option: '--level=1', explication: 'Niveau RAID 1 : miroir, chaque disque contient la même chose.' }, { option: '--raid-devices=2', explication: 'Nombre de disques actifs de la matrice.' }], interactions: [{ attend: 'Continue creating array? [y/N]', reponds: 'y seulement si les deux disques sont bien ceux vérifiés aux étapes 1 et 2.' }], important: 'Efface le contenu des DEUX disques désignés. Relis leurs noms avant de répondre y.' }),
      lec('Suivre la synchronisation', '/proc/mdstat montre la matrice et, tant qu’elle se synchronise, une barre de progression. [UU] signifie que les deux disques sont à jour ; [U_] qu’il en manque un. mdadm --detail donne le détail.', [sh('cat /proc/mdstat'), sh('sudo mdadm --detail {{matrice}}')], 'La matrice en « active raid1 » avec [2/2] [UU] ; State : clean (ou « clean, resyncing » pendant la synchronisation).', { verification: true, important: 'Relis le NOM réel de la matrice dans /proc/mdstat : au redémarrage il peut devenir md127 si elle n’est pas déclarée (étape 9).' }),
      des('Formater la matrice en ext4', 'Crée un système de fichiers vierge sur la matrice (et non sur les disques). Efface ce que la matrice contenait — ici, rien, puisqu’elle vient d’être créée.', [sh('sudo mkfs.ext4 {{matrice}}')], '« Writing superblocks and filesystem accounting information: done ».', { important: 'Efface le contenu de la matrice désignée. Vérifie son nom dans /proc/mdstat.' }),
      mod('Monter la matrice', 'Crée le dossier de montage et y monte la matrice.', [sh('sudo mkdir -p {{pointMontage}}'), sh('sudo mount {{matrice}} {{pointMontage}}'), sh('df -h {{pointMontage}}')], 'df -h montre la matrice montée sur le dossier, avec environ la taille d’UN disque.'),
      lec('Relever l’UUID du système de fichiers', 'blkid donne l’UUID du système de fichiers de la matrice : il survit à un changement de nom de la matrice (md0 → md127).', [sh('sudo blkid {{matrice}}')], 'Une ligne avec UUID="…" et TYPE="ext4".', { verification: true }),
      mod('Rendre la matrice persistante', 'Déclare la matrice dans mdadm.conf pour qu’elle reprenne son nom au démarrage, régénère l’image de démarrage, puis ajoute une ligne fstab par UUID. « nofail » évite de bloquer le démarrage si la matrice est absente.', [
        sh('sudo cp -a /etc/fstab /etc/fstab.avant-raid'),
        sh('sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf'),
        sh('sudo update-initramfs -u'),
        sh('echo \'UUID={{uuid}} {{pointMontage}} ext4 defaults,nofail 0 2\' | sudo tee -a /etc/fstab'),
        sh('sudo findmnt --verify'),
      ], 'tee affiche la ligne de la matrice puis la ligne fstab ; findmnt --verify ne signale aucune erreur.', { important: 'Ne lance pas cette étape deux fois : elle ajouterait des lignes en double dans mdadm.conf et fstab. Ne redémarre qu’après findmnt --verify.' }),
    ],
    verification: ['/proc/mdstat montre [UU] ; df -h affiche la matrice montée ; après redémarrage, relis le nom réel de la matrice avant toute commande.'],
    retour: 'Démonter (sudo umount), arrêter (sudo mdadm --stop matrice), effacer les métadonnées de chaque disque (sudo mdadm --zero-superblock disque), retirer les lignes ajoutées à mdadm.conf et à fstab, puis sudo update-initramfs -u. Les données effacées ne reviennent pas.',
    sources: [
      { label: 'mdadm(8)', url: `${MAN}/man8/mdadm.8.html` },
      { label: 'mdadm.conf(5)', url: `${MAN}/man5/mdadm.conf.5.html` },
      { label: 'mke2fs(8)', url: `${MAN}/man8/mke2fs.8.html` },
      { label: 'Linux RAID wiki — mise en place', url: WIKI_MD },
    ],
  }),

  ficheLinux({
    id: 'cours-raid1-panne-secours',
    titre: 'RAID 1 : panne simulée, remplacement et disque de secours',
    resume: 'Sur un RAID 1 DE LABORATOIRE, déclare un disque défaillant, le retire, ajoute un disque de remplacement puis un disque de secours (spare) qui prendra automatiquement la relève. La simulation dégrade la matrice : ne la fais jamais sur un RAID qui porte des données réelles.',
    effet: 'interruption',
    intentions: ['mdadm fail remove add', 'simuler une panne raid', 'remplacer un disque raid', 'disque de secours spare mdadm', 'mdadm --fail', 'mdadm --stop', 'raid dégradé'],
    motsCles: ['mdadm', 'fail', 'remove', 'add', 'spare', 'secours', 'panne', 'dégradé', 'mdstat', 'zero-superblock', 'stop', 'assemble'],
    params: [
      { id: 'matrice', label: 'matrice RAID existante', type: 'peripherique', portee: 'md', exemple: '/dev/md1', aide: 'Exemple seulement. Lis le nom RÉEL dans /proc/mdstat (étape 1) : après un redémarrage, md0 est souvent devenu md127.' },
      { id: 'disquePanne', label: 'disque à déclarer défaillant', type: 'peripherique', portee: 'disque', distinctDe: ['disqueRemplacement', 'disqueSecours'], exemple: '/dev/sdc', aide: 'Exemple seulement. Un des deux disques listés par mdadm --detail (étape 1), sinon la commande échoue.' },
      { id: 'disqueRemplacement', label: 'disque de remplacement', type: 'peripherique', portee: 'disque', distinctDe: ['disquePanne', 'disqueSecours'], exemple: '/dev/sdd', aide: 'Exemple seulement. Un disque entier hors de la matrice, de taille suffisante ; son contenu sera effacé par la reconstruction.' },
      { id: 'disqueSecours', label: 'disque de secours (spare)', type: 'peripherique', portee: 'disque', distinctDe: ['disquePanne', 'disqueRemplacement'], exemple: '/dev/sde', aide: 'Exemple seulement. Un autre disque entier, inutilisé ; son contenu sera effacé si la matrice l’utilise.' },
      { id: 'pointMontage', label: 'dossier de montage de la matrice', type: 'chemin', exemple: '/DATA_EXT4', aide: 'Utilisé seulement pour l’arrêt propre (étape finale).' },
    ],
    privileges: 'Administrateur : sudo. Matrice RAID 1 saine et de laboratoire.',
    etapes: [
      lec('Lire l’état de départ', 'Relève le nom réel de la matrice et les disques qui la composent. Une matrice saine affiche [UU]. C’est ta référence pour la suite.', [sh('cat /proc/mdstat'), sh('sudo mdadm --detail {{matrice}}')], '« active raid1 », [2/2] [UU], State : clean, Active Devices : 2.', { important: 'Si la matrice est déjà dégradée ([U_]), ne simule rien : répare-la d’abord.' }),
      itr('LABORATOIRE — simuler la panne d’un disque', 'Marque le disque comme défaillant (faulty). La matrice continue de fonctionner sur le seul disque restant : c’est précisément ce que le RAID 1 garantit. Aucune donnée n’est effacée, mais la redondance est perdue.', [sh('sudo mdadm {{matrice}} --fail {{disquePanne}}')], 'mdadm confirme « set … faulty in … ».', { options: [{ option: '--fail', explication: 'Déclare le disque défaillant (forme courte : -f).' }], important: 'Réservé à un RAID de laboratoire. Tant que la matrice est dégradée, la perte du second disque détruit les données.' }),
      lec('Lire l’état après la panne', 'Le disque défaillant porte la marque (F) et la matrice affiche [U_] : un seul disque est actif.', [sh('cat /proc/mdstat'), sh('sudo mdadm --detail {{matrice}}')], '[2/1] [U_], State : clean, degraded, Failed Devices : 1.', { verification: true }),
      mod('Retirer le disque défaillant', 'Retire de la matrice le disque marqué défaillant. mdadm refuse de retirer un disque encore actif : c’est le garde-fou.', [sh('sudo mdadm {{matrice}} --remove {{disquePanne}}')], 'mdadm confirme « hot removed … ».', { options: [{ option: '--remove', explication: 'Retire un disque défaillant de la matrice (forme courte : -r).' }] }),
      des('Effacer d’éventuelles anciennes métadonnées RAID du disque de remplacement', 'Si le disque de remplacement a déjà fait partie d’une matrice, son ancien bloc de métadonnées peut perturber l’ajout. Cette commande efface UNIQUEMENT ces métadonnées sur le disque désigné.', [sh('sudo mdadm --zero-superblock {{disqueRemplacement}}')], 'Aucun message en cas de succès (« Unrecognised md component device » si le disque n’avait jamais servi : sans conséquence).', { facultatif: true, important: 'Efface les métadonnées RAID du disque de remplacement, et seulement de lui. Relis son nom avant de lancer.' }),
      des('Ajouter le disque de remplacement', 'Le disque est ajouté et la matrice se reconstruit : tout ce que le disque contenait est écrasé par une copie du disque survivant.', [sh('sudo mdadm {{matrice}} --add {{disqueRemplacement}}')], 'mdadm confirme « added … ». /proc/mdstat montre une reconstruction (recovery) avec un pourcentage.', { options: [{ option: '--add', explication: 'Ajoute un disque à la matrice (forme courte : -a).' }], important: 'Efface le contenu du disque de remplacement. Attends la fin de la reconstruction avant toute autre manipulation.' }),
      lec('Suivre la reconstruction', 'Relance la commande jusqu’à ce que la reconstruction soit terminée et que la matrice affiche de nouveau [UU].', [sh('cat /proc/mdstat'), sh('sudo mdadm --detail {{matrice}}')], 'recovery = xx % pendant la reconstruction, puis [2/2] [UU] et State : clean.', { verification: true }),
      des('Ajouter un disque de secours (spare)', 'Quand la matrice est saine, un disque ajouté devient disque de secours : il ne sert à rien tant qu’un disque actif n’échoue pas, puis prend automatiquement sa place. Son contenu est écrasé le jour où il est utilisé. (À la création, la même chose s’obtient avec --spare-devices=1 suivi du disque.)', [sh('sudo mdadm {{matrice}} --add {{disqueSecours}}')], 'mdadm confirme « added … ». mdadm --detail affiche « Spare Devices : 1 ».', { important: 'Le disque de secours est effacé le jour où la matrice l’utilise. N’y garde rien.' }),
      lec('Contrôler les rôles', 'Chaque disque a un rôle dans le tableau final : « active sync » pour les deux disques du miroir, « spare » pour le disque de secours.', [sh('sudo mdadm --detail {{matrice}}')], 'Active Devices : 2, Working Devices : 3, Spare Devices : 1.', { verification: true }),
      itr('Arrêter proprement la matrice (facultatif)', 'On démonte d’abord, puis on arrête : arrêter une matrice montée échoue. Pour la relancer ensuite, on la ré-assemble avec --assemble --scan ; --run ne sert qu’à démarrer une matrice partiellement assemblée, pas à la recréer après un arrêt.', [sh('sudo umount {{pointMontage}}'), sh('sudo mdadm --stop {{matrice}}'), sh('sudo mdadm --assemble --scan'), sh('cat /proc/mdstat')], 'La matrice disparaît de /proc/mdstat après --stop, puis réapparaît après --assemble --scan (peut-être sous un autre nom : relis-le).', { facultatif: true, important: 'Les services qui utilisent le dossier de montage doivent être arrêtés avant umount, sinon il répond « target is busy ».' }),
    ],
    verification: ['La matrice affiche [UU] avec un disque de secours (Spare Devices : 1).'],
    retour: 'Rien à défaire pour une simulation menée à son terme : la matrice a retrouvé deux disques actifs. Pour retirer le disque de secours : sudo mdadm matrice --remove disque-de-secours.',
    sources: [
      { label: 'mdadm(8)', url: `${MAN}/man8/mdadm.8.html` },
      { label: 'Linux RAID wiki — mise en place', url: WIKI_MD },
    ],
  }),
];
