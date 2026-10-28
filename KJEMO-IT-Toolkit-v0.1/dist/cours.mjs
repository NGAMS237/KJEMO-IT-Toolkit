/**
 * cours.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Mes cours et TP » : des PARCOURS qui renvoient vers les fiches du
 * catalogue. Un parcours ne contient aucune commande : il dit quelle fiche, et
 * quelle ÉTAPE de cette fiche, répond à chaque demande d'un travail pratique.
 * Corriger une commande dans la fiche corrige donc tous les parcours.
 *
 * Les lettres et numéros du travail (A, B7, C5…) sont conservés comme ALIAS DE
 * RECHERCHE : taper « TP2 B7 » ou « b7 » retrouve la fiche. Ils ne sont pas des
 * identifiants de fiche.
 *
 * Ce module est PUR (aucun DOM, aucun stockage). Les énoncés sont résumés dans
 * nos propres mots : les documents d'origine ne sont pas republiés.
 *
 * Une entrée « couvert: false » dit CE QUI N'EST PAS COUVERT, plutôt que de le
 * taire.
 */

import { RESUME_S07 } from './cours-resume-cisco.mjs';
import { IDS_SCHEMAS } from './schemas-cisco.mjs';

export const ROUTE_COURS = '#/cours';
export const ROUTE_LABO = '#/labo';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });

export const COURS = [
  {
    id: 'serveurs2-tp2',
    plateformes: ['Linux'],
    titre: 'Serveurs II — TP2 : comptes, stockage et partages Samba',
    resume: 'Un serveur Samba contrôleur de domaine (entreprise fictive « Québec consulting international ») : comptes créés par script depuis un CSV, disque de 1 Go et quotas, RAID 1, partages Samba pour des comptes et pour le groupe Direction, clients Ubuntu Desktop et Windows 11.',
    source: 'Énoncé TP2-A26 et notes de cours fournis par l’étudiant (non republiés ici). Les demandes A à E ci-dessous suivent l’ordre de l’énoncé, résumées dans nos mots ; en cas de doute, c’est l’énoncé qui fait foi.',
    avertissement: 'Les fiches expliquent comment faire ; elles ne remplacent pas ton énoncé, ne produisent aucune capture et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Les mots de passe se tapent sur les machines, jamais dans cette application.',
    parcours: [
      {
        lettre: 'A',
        titre: 'Créer les comptes depuis un fichier CSV',
        points: 24,
        resume: 'Un script lit un CSV (login, mot de passe, département) et crée, sur le contrôleur de domaine, les comptes et les groupes de départements (Ventes et marketing, Finance, Technologies de l’information, Direction) ; test de connexion depuis un poste Windows pour un utilisateur de chaque département.',
        prerequis: [
          f('cours-bash-boucles', 1, { titre: 'Écrire le script', pourquoi: 'while read et IFS : la base du script (exemple du cours : lecture de /etc/passwd).' }),
          f('cours-samba-groupes', 2, { titre: 'Créer le groupe', pourquoi: 'créer un groupe et y ajouter des membres avec samba-tool (document « Exemple de partage d’un dossier par groupe »).' }),
        ],
        items: [
          { id: 'A1', texte: 'Fichier CSV : login, mot de passe et département de chaque employé de l’entreprise (capture du contenu demandée).', refs: [f('cours-samba-script-menu', 1, { titre: 'MODÈLE' }), f('cours-samba-script-menu', 2, { titre: 'vrais comptes' })], note: 'Le modèle public est fictif ; le vrai CSV reste sur ta VM (droits 600, supprimé après le labo).' },
          { id: 'A2', texte: 'Script à menu (while, case, fonctions) qui lit le CSV et, pour chaque ligne, crée le groupe du département, le compte et son appartenance (capture du script demandée).', refs: [f('cours-samba-script-menu', 3, { titre: 'Écrire le script' }), f('cours-samba-script-menu', 4), f('cours-samba-script-menu', 5, { titre: 'choisir 1' })], note: 'Version du niveau du cours ; la version renforcée (essai à blanc) reste dans cours-samba-import-csv.' },
          { id: 'A3', texte: 'Liste des comptes Samba : samba-tool user list (capture).', refs: [f('cours-samba-script-menu', 6, { titre: 'Contrôler' })] },
          { id: 'A4', texte: 'Liste des groupes Samba : samba-tool group list (capture).', refs: [f('cours-samba-script-menu', 6, { titre: 'Contrôler' }), f('cours-samba-groupes', 4, { titre: 'Lister les membres' })] },
          { id: 'A5', texte: 'Test de connexion depuis un poste Windows pour un utilisateur de CHAQUE département.', refs: [f('cours-windows-connexion-domaine', 3, { methode: 'gui', titre: 'Ouvrir la session' }), f('cours-windows-connexion-domaine', 2, { methode: 'cmd', titre: 'groupe du département' })] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Disques, système de fichiers et quotas',
        points: 22,
        resume: 'Un disque de 1 Go : partition, ext4, étiquette data_tp2, UUID, point de montage /DATA_TP2, fichier test_tp2, fstab, quotas utilisateur (christian_chef), propriétaire du dossier. Serveur seulement.',
        prerequis: [
          f('cours-lire-fichiers', 1, { titre: 'Tout afficher', pourquoi: 'lire fstab et les sorties de commandes.' }),
        ],
        items: [
          { id: 'B1', texte: 'Ajouter un nouveau disque de 1 Go (après avoir supprimé les disques du dernier formatif).', refs: [f('cours-hyperviseur-ajouter-disque', 1, { methode: 'gui', titre: 'Choisir ton hyperviseur' })], note: 'Dans l’hyperviseur (quatre séries d’étapes : VMware, VirtualBox, Proxmox VE, Hyper-V). Menus relus dans la documentation, non exécutés.' },
          { id: 'B2', texte: 'Vérifier le nom associé au nouveau disque (par exemple /dev/sdb).', refs: [f('cours-hyperviseur-ajouter-disque', 2, { methode: 'linux', titre: 'APRÈS' }), f('cours-partition-formater-monter', 1, { titre: 'Repérer le disque' })] },
          { id: 'B3', texte: 'Lancer fdisk pour créer une partition dans ce disque.', refs: [f('cours-partition-formater-monter', 3, { titre: 'fdisk' })] },
          { id: 'B4', texte: 'Créer une nouvelle partition primaire.', refs: [f('cours-partition-formater-monter', 3, { titre: 'fdisk' })] },
          { id: 'B5', texte: 'Forcer la mise à jour de la table des partitions.', refs: [f('cours-partition-formater-monter', 4, { titre: 'relire' })] },
          { id: 'B6', texte: 'Créer un système de fichiers ext4 dans la partition.', refs: [f('cours-partition-formater-monter', 5, { titre: 'ext4' })] },
          { id: 'B7', texte: 'Lui attribuer l’étiquette data_tp2.', refs: [f('cours-partition-formater-monter', 6, { titre: 'étiquette' })] },
          { id: 'B8', texte: 'Donner l’UUID du système de fichiers.', refs: [f('cours-partition-formater-monter', 7, { titre: 'UUID' })] },
          { id: 'B9', texte: 'Créer, depuis la racine, le répertoire DATA_TP2 (point de montage).', refs: [f('cours-partition-formater-monter', 8, { titre: 'dossier de montage' })] },
          { id: 'B10', texte: 'Monter le système de fichiers PAR SON NOM DE PÉRIPHÉRIQUE sur DATA_TP2.', refs: [f('cours-partition-formater-monter', 8, { titre: 'dossier de montage' })] },
          { id: 'B11', texte: 'Se placer dans le point de montage et créer le fichier test_tp2 contenant la phrase demandée.', refs: [f('cours-partition-formater-monter', 9, { titre: 'test_tp2' })], note: 'La phrase exacte de l’énoncé est reprise dans la fiche.' },
          { id: 'B12', texte: 'Donner la ligne de /etc/fstab qui monte automatiquement ce système de fichiers PAR SON LABEL data_tp2.', refs: [f('cours-partition-formater-monter', 10, { titre: 'montage automatique' }), f('cours-partition-formater-monter', 11, { titre: 'Contrôler fstab' })] },
          { id: 'B13', texte: 'Commande qui affiche l’occupation des systèmes de fichiers de façon lisible.', refs: [f('cours-partition-formater-monter', 12, { titre: 'occupation' })] },
          { id: 'B14', texte: 'Modifier avec nano la ligne de fstab pour activer les quotas utilisateur et remonter.', refs: [f('cours-quotas-utilisateur', 3, { titre: 'usrquota' }), f('cours-quotas-utilisateur', 4, { titre: 'Remonter' })] },
          { id: 'B15', texte: 'Commandes qui créent et activent les quotas sur DATA_TP2.', refs: [f('cours-quotas-utilisateur', 1, { titre: 'Installer' }), f('cours-quotas-utilisateur', 5, { titre: 'Créer les fichiers' }), f('cours-quotas-utilisateur', 6, { titre: 'Activer' })] },
          { id: 'B16', texte: 'Limite soft de 260 Mo pour christian_chef (hard = soft + 10 Ko).', refs: [f('cours-quotas-utilisateur', 7, { titre: 'limites' })], note: 'Unités à trancher : voir l’ambiguïté sur « Mo ».' },
          { id: 'B17', texte: 'Changer propriétaire et groupe de DATA_TP2 en christian_chef:users.', refs: [f('cours-donner-dossier-compte', 3, { titre: 'propriétaire' })], note: 'Un compte du domaine ne se résout comme propriétaire que si le serveur le voit (getent passwd) : voir l’ambiguïté correspondante.' },
          { id: 'B18', texte: 'Se connecter avec christian_chef et créer un répertoire et un fichier dans DATA_TP2.', refs: [f('cours-donner-dossier-compte', 4, { titre: 'Tester l’écriture' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'RAID 1 : création, panne, remplacement, disque de secours',
        points: 14,
        resume: 'Un miroir de deux disques de 1 Go, formaté, rempli de trois fichiers ; une panne simulée, le remplacement du disque, puis un disque de secours (section 8 du formatif). Serveur seulement.',
        prerequis: [
          f('cours-creer-dossiers-fichiers', 1, { titre: 'Créer le dossier', pourquoi: 'créer les fichiers de test dans le RAID.' }),
        ],
        items: [
          { id: 'C1', texte: 'Créer un RAID 1 avec deux nouveaux disques de 1 Go.', refs: [f('cours-raid1-creer', 4, { titre: 'Créer le miroir' })], note: 'Le formatif demande md1 à la place de md0 : la matrice est un champ de la fiche.' },
          { id: 'C2', texte: 'Donner l’état du RAID.', refs: [f('cours-raid1-creer', 5, { titre: 'synchronisation' })] },
          { id: 'C3', texte: 'Formater le RAID.', refs: [f('cours-raid1-creer', 6, { titre: 'Formater' })] },
          { id: 'C4', texte: 'Créer trois fichiers texte dans le RAID (touch, cat ou nano).', refs: [f('cours-raid1-creer', 7, { titre: 'Monter' }), f('cours-raid1-creer', 8, { titre: 'trois fichiers' })] },
          { id: 'C5', texte: 'Simuler la panne d’un des disques du RAID.', refs: [f('cours-raid1-panne-secours', 2, { titre: 'simuler la panne' })] },
          { id: 'C6', texte: 'Donner l’état du RAID après la panne.', refs: [f('cours-raid1-panne-secours', 3, { titre: 'après la panne' })] },
          { id: 'C7', texte: 'Remplacer le disque en panne.', refs: [f('cours-raid1-panne-secours', 4, { titre: 'Retirer' }), f('cours-raid1-panne-secours', 6, { titre: 'remplacement' }), f('cours-raid1-panne-secours', 7, { titre: 'reconstruction' })] },
          { id: 'C8', texte: 'Ajouter un disque de secours et suivre toutes les étapes de la section 8 du formatif (rôles, bascule du secours).', refs: [f('cours-raid1-panne-secours', 8, { titre: 'secours' }), f('cours-raid1-panne-secours', 9, { titre: 'faire tomber' }), f('cours-raid1-panne-secours', 11, { titre: 'rôles' })], note: 'Le formatif crée parfois le RAID AVEC le disque de secours ; la fiche l’ajoute après coup, comme la capture de l’énoncé (mdadm --manage … --add).' },
        ],
      },
      {
        lettre: 'D',
        titre: 'Partage Samba : un compte écrit, un compte lit',
        points: 20,
        resume: 'Le dossier partage_tp2 (777) dans le RAID, deux comptes user1tp2 (écriture) et user2tp2 (lecture), test de configuration, accès depuis Ubuntu Desktop et Windows 11, puis smbclient dans les deux sens.',
        prerequis: [
          f('cours-samba-groupes', 1, { titre: 'Lister', pourquoi: 'comprendre comptes et groupes du domaine avant d’en créer.' }),
          f('cours-droits-dossier-partage', 4, { titre: 'Laboratoire', pourquoi: 'distinguer le réglage de laboratoire (777) du réglage professionnel.' }),
        ],
        items: [
          { id: 'D1', texte: 'Dans le RAID, créer le répertoire à partager partage_tp2 avec les permissions 777.', refs: [f('cours-samba-partage-utilisateurs', 1, { titre: 'Créer le dossier' }), f('cours-samba-partage-utilisateurs', 4, { titre: '777' })], note: '777 est un réglage de LABORATOIRE (étape séparée de la fiche).' },
          { id: 'D2', texte: 'Configurer le partage dans smb.conf : affichable, user1tp2 écrit, user2tp2 lit seulement, description visible dans le voisinage réseau.', refs: [f('cours-samba-partage-utilisateurs', 2, { titre: 'deux comptes' }), f('cours-samba-partage-utilisateurs', 6, { titre: 'section de partage' })] },
          { id: 'D3', texte: 'Tester les paramètres de smb.conf avec testparm.', refs: [f('cours-samba-partage-utilisateurs', 7, { titre: 'Tester la configuration' })] },
          { id: 'D4', texte: 'Sur le client Ubuntu Desktop, configurer la carte réseau pour atteindre le serveur.', refs: [f('cours-ubuntu-reseau-client', 1, { methode: 'gui', titre: 'carte réseau' }), f('cours-ubuntu-reseau-client', 2, { methode: 'linux', titre: 'Fixer l’adresse' })], assistants: ['netplan-readiness'] },
          { id: 'D5', texte: 'Depuis Ubuntu, montrer que user1tp2 peut écrire dans le dossier partagé.', refs: [f('cours-ubuntu-acces-partage', 3, { methode: 'linux', titre: 'créer un dossier' }), f('cours-ubuntu-acces-partage', 2, { methode: 'gui', titre: 'compte en écriture' })] },
          { id: 'D6', texte: 'Depuis Ubuntu, montrer que user2tp2 NE PEUT PAS écrire mais peut lire.', refs: [f('cours-ubuntu-acces-partage', 4, { methode: 'linux', titre: 'lire' }), f('cours-ubuntu-acces-partage', 5, { methode: 'linux', titre: 'refus attendu' })] },
          { id: 'D7', texte: 'Même chose que D5 et D6, mais avec un client Windows 11.', refs: [f('cours-windows-acces-partage', 1, { methode: 'gui', titre: 'Ouvrir le partage' }), f('cours-windows-acces-partage', 3, { methode: 'cmd', titre: 'compte en écriture' }), f('cours-windows-acces-partage', 3, { methode: 'powershell', titre: 'compte en écriture' })], note: 'Changer de compte vers le même serveur demande de retirer la connexion existante (erreur 1219) : étape ciblée, jamais « net use * /delete ».' },
          { id: 'D8.1', texte: 'Avec smbclient depuis Ubuntu, télécharger deux fichiers créés d’abord sur le serveur dans le dossier partagé.', refs: [f('cours-smbclient-transferts', 1, { titre: 'Créer les deux fichiers' }), f('cours-smbclient-transferts', 5, { titre: 'Télécharger' })], note: 'L’énoncé cite deux fois « fichier1tp2 » : lu comme fichier1tp2 et fichier2tp2.' },
          { id: 'D8.2', texte: 'Depuis Ubuntu, créer depot1 et depot2 et les déposer dans le dossier partagé avec smbclient.', refs: [f('cours-smbclient-transferts', 8, { titre: 'depot1' }), f('cours-smbclient-transferts', 9, { titre: 'Déposer' })] },
        ],
      },
      {
        lettre: 'E',
        titre: 'Partage d’un dossier par groupe Samba (Direction)',
        points: 12,
        resume: 'Un dossier partagé pour le groupe Samba Direction : droits 770, déclaration dans smb.conf, tous les membres lisent et écrivent sauf la réceptionniste (lecture seule), test d’écriture avec elle.',
        prerequis: [
          f('cours-samba-groupes', 5, { titre: 'gid', pourquoi: 'lire le gid du groupe Direction.' }),
          f('cours-samba-script-menu', 5, { titre: 'choisir 1', pourquoi: 'les comptes du département Direction viennent du CSV de la partie A.' }),
        ],
        items: [
          { id: 'E1', texte: 'Créer le répertoire partagé du groupe Direction.', refs: [f('cours-samba-partage-groupe', 1, { titre: 'Créer le dossier' })] },
          { id: 'E2', texte: 'Donner le dossier au groupe et passer ses droits en 770 (chmod 770).', refs: [f('cours-samba-partage-groupe', 2, { titre: 'gid' }), f('cours-samba-partage-groupe', 3, { titre: 'Donner' }), f('cours-samba-partage-groupe', 4, { titre: '770' })] },
          { id: 'E3', texte: 'Ajouter la configuration du partage dans /etc/samba/smb.conf.', refs: [f('cours-samba-partage-groupe', 6, { titre: 'Déclarer' }), f('cours-samba-partage-groupe', 7, { titre: 'recharger' })] },
          { id: 'E4', texte: 'Tous les utilisateurs du département lisent et écrivent, sauf la réceptionniste qui lit seulement.', refs: [f('cours-samba-partage-groupe', 6, { titre: 'Déclarer' }), f('cours-samba-partage-groupe', 8, { titre: 'écriture permise' })], note: 'read list = le compte de la réceptionniste ; jamais dans write list.' },
          { id: 'E5', texte: 'Test d’écriture avec la réceptionniste : montrer qu’elle n’a pas le droit d’écrire.', refs: [f('cours-samba-partage-groupe', 9, { titre: 'refus attendu' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-samba-import-csv', pourquoi: 'Version renforcée (hors cours) : essai à blanc et contrôles avant d’appliquer.' },
      { fiche: 'cours-bash-menu', pourquoi: 'Le menu while + case + fonctions des formatifs.' },
      { fiche: 'cours-samba-script-menu', pourquoi: 'Le script à menu de la partie A au niveau du cours.' },
      { fiche: 'cours-droits-fichier', pourquoi: 'ls -l et chmod en octal (formatif 2).' },
      { fiche: 'cours-samba-groupes', pourquoi: 'Gérer les groupes Samba (créer, ajouter, lister, gid).' },
      { fiche: 'cours-ubuntu-jonction-ad', pourquoi: 'Joindre un poste Ubuntu au domaine (realmd, SSSD, PAM).' },
      { fiche: 'cours-samba-dns', pourquoi: 'Enregistrements A, zone inverse et PTR dans le DNS de Samba.' },
      { fiche: 'cours-rsat-windows', pourquoi: 'Installer les consoles AD et DNS sur un poste Windows.' },
      { fiche: 'cours-bash-condition', pourquoi: 'if et case pour écrire un script.' },
      { fiche: 'cours-bash-fonctions', pourquoi: 'Fonctions et arguments d’un script.' },
      { fiche: 'cours-se-reperer', pourquoi: 'pwd, ls, cd : les bases du terminal.' },
      { fiche: 'cours-grep-wc', pourquoi: 'Chercher dans un fichier de configuration.' },
      { fiche: 'cours-liens', pourquoi: 'Liens durs et symboliques.' },
      { fiche: 'cours-identifier-fichier', pourquoi: 'file, stat : reconnaître la nature d’un fichier.' },
      { fiche: 'cours-copier-deplacer', pourquoi: 'cp, mv : copier et déplacer sans écraser par mégarde.' },
      { fiche: 'cours-supprimer-prudemment', pourquoi: 'rm, rmdir : supprimer en sachant ce qui part.' },
      { fiche: 'cours-find-fichiers', pourquoi: 'find : retrouver un fichier par son nom, sa taille ou sa date.' },
      { fiche: 'cours-redirections-tubes', pourquoi: '>, >>, | : rediriger et enchaîner les commandes.' },
      { fiche: 'cours-groupes-locaux', pourquoi: 'Comptes et groupes LOCAUX (par opposition au domaine).' },
      { fiche: 'cours-creer-compte-local', pourquoi: 'useradd, passwd : créer un compte LOCAL, mot de passe saisi au terminal (résumé Linux).' },
      { fiche: 'cours-afficher-texte', pourquoi: 'echo et printf : afficher du texte et des menus (S2, menus Bash).' },
      { fiche: 'cours-processus', pourquoi: 'ps, top, kill : voir et arrêter un processus (notes S10.1).' },
      { fiche: 'cours-sessions-utilisateurs', pourquoi: 'who, w, last, groups : qui est connecté et à quels groupes (notes S10.1, S9).' },
      { fiche: 'cours-supprimer-compte-local', pourquoi: 'userdel, deluser : retirer un compte LOCAL (notes S10.1, résumé Linux).' },
      { fiche: 'cours-archives', pourquoi: 'tar : sauvegarder un dossier (notes S10.1, dont deux options fausses corrigées).' },
      { fiche: 'cours-gzip-fichier', pourquoi: 'gzip et gunzip sur un seul fichier (notes S10.1).' },
      { fiche: 'cours-trouver-commande', pourquoi: 'which, type, man, locate : trouver une commande ou un fichier (notes S10.1).' },
      { fiche: 'cours-comparer-trier', pourquoi: 'diff, sort, uniq, tr, more : comparer et transformer du texte (résumé Linux).' },
      { fiche: 'cours-etat-systeme', pourquoi: 'free, uptime, uname, df : état du système (formatif 3, S10.1).' },
      { fiche: 'cours-arret-redemarrage', pourquoi: 'shutdown, reboot : arrêter ou redémarrer (S10.1, RAID1 : « Faites un reboot »).' },
      { fiche: 'cours-disque-entretien', pourquoi: 'tune2fs, fsck : forcer et lancer une vérification (formatif 3, étape tune2fs -C 1000).' },
      { fiche: 'cours-quota-edquota', pourquoi: 'edquota : fixer un quota avec l’éditeur (formatif 3) ; variante interactive de setquota.' },
      { fiche: 'cours-samba-connexions', pourquoi: 'smbstatus : voir les connexions actives (cours Samba).' },
      { fiche: 'cours-planifier-taches', pourquoi: 'at et crontab : planifier une commande (S10.1).' },
      { fiche: 'cours-ifconfig-ancien', pourquoi: 'ifconfig -a et son remplaçant ip (notes S1).' },
      { fiche: 'cours-service-ancien', pourquoi: 'service et systemctl : même résultat, deux commandes (résumé Linux).' },
    ],
    ambiguites: [
      { id: 'amb-identifiants', sujet: 'A — logins, mots de passe et noms de départements', texte: 'L’énoncé n’impose ni la liste complète des logins ni les mots de passe : seuls quelques exemples apparaissent dans les images (christian_chef, julie_emp1, dominique_chef). Le CSV public de l’application est donc entièrement FICTIF ; ton vrai fichier reste sur TA machine virtuelle et aucun vrai mot de passe n’est saisi dans l’application.' },
      { id: 'amb-csv-format', sujet: 'A/D — format du CSV', texte: 'Les images montrent un séparateur point-virgule sans ligne d’en-tête, alors que la phrase de l’énoncé contient une double virgule parasite. Le script accepte donc le point-virgule, une en-tête facultative, les fins de ligne Windows, les lignes vides ou invalides (comptées et signalées) et les doublons (ignorés avec avertissement).' },
      { id: 'amb-finance', sujet: 'A — « Finance » ou « Finances »', texte: 'Les images écrivent « Finance » au singulier, certaines phrases « Finances ». Les fiches utilisent « Finance » ; garde l’orthographe exacte de TON énoncé pour les noms de groupes.' },
      { id: 'amb-hyperviseur', sujet: 'B1 — hyperviseur non précisé', texte: 'L’énoncé demande d’ajouter un disque sans nommer l’hyperviseur. La fiche GUI propose quatre cas (VirtualBox, VMware, Proxmox, Hyper-V) ; choisis celui de ton laboratoire. Seule la vérification sous Ubuntu (lsblk) est commune.' },
      { id: 'amb-mo', sujet: 'B16 — « 260 Mo »', texte: 'Mo = 1 000 000 octets, ou Mio = 1 048 576 ? En blocs de 1 Kio, 260 Mio = 266 240 ; 260 Mo = environ 253 906. La fiche propose 266240 / 266250 (Mio, souple + 10 Kio). Demande à ton enseignant l’unité attendue.' },
      { id: 'amb-fichiers', sujet: 'D8.1 — deux fichiers du même nom', texte: 'L’énoncé écrit deux fois « fichier1tp2 ». Lu comme fichier1tp2 et fichier2tp2. Deux noms identiques ne transfèrent qu’un fichier.' },
      { id: 'amb-777', sujet: 'D1 — permissions 777', texte: '777 donne tous les droits à tout le monde au niveau Unix : seul Samba filtre. Acceptable pour un laboratoire isolé, jamais en production. Les fiches séparent les deux réglages.' },
      { id: 'amb-service', sujet: 'D — redémarrer Samba', texte: 'Les notes disent « systemctl restart smbd ». Sur un CONTRÔLEUR DE DOMAINE, le service s’appelle samba-ad-dc (smbd est masqué). Les fiches utilisent smbcontrol reload-config, valable des deux côtés.' },
      { id: 'amb-comptes', sujet: 'D2 — « utilisateurs Samba »', texte: 'Sur un contrôleur de domaine, les comptes se créent avec samba-tool (smbpasswd concerne un serveur de fichiers autonome). Les fiches suivent samba-tool ; le mot de passe de samba-tool user create apparaît dans la ligne de commande : usage de laboratoire uniquement.' },
      { id: 'amb-direction', sujet: 'A/E — groupe de la direction et réceptionniste', texte: 'L’énoncé ne nomme ni le groupe de la direction ni le login de la réceptionniste. Ils sont des paramètres de la fiche (valeurs d’exemple fictives), à remplacer par ceux de ton CSV.' },
      { id: 'amb-windows', sujet: 'A5/D7 — jonction et connexion Windows', texte: 'L’énoncé ne détaille pas la jonction de Windows 11 au domaine. Les fiches supposent le poste déjà joint (voir la mention « suppose » de chaque fiche) et traitent la connexion avec un compte du domaine, la vérification du département, le partage autorisé (lecture/écriture) et l’écriture refusée.' },
      { id: 'amb-readwrite', sujet: 'E — réceptionniste en lecture seule', texte: 'read list rend un compte en lecture seule même si le partage est inscriptible ; un compte présent dans read list ET write list reçoit l’écriture (manuel de smb.conf). Les fiches suivent le document de cours (valid users + read list).' },
      { id: 'amb-quota-ad', sujet: 'B16–B17 — compte du domaine comme propriétaire', texte: 'chown et les quotas ne fonctionnent que si le système sait résoudre le compte (winbind ou SSSD). Vérifie avec getent passwd avant ; sinon utilise un compte local.' },
      { id: 'amb-run', sujet: 'C — arrêt et relance du RAID', texte: 'Les notes relancent avec --run après --stop. Après un arrêt, la matrice n’existe plus : on la ré-assemble avec --assemble --scan. Son nom peut alors changer (md127).' },
      { id: 'amb-hdc', sujet: 'C7 — « /dev/hdc »', texte: 'L’exemple de remplacement des notes cite un disque IDE ancien (hdc). Utilise le nom réel de TON disque, lu avec lsblk : il n’est jamais présumé.' },
      { id: 'amb-quotacheck', sujet: 'B15 — quotacheck', texte: 'Les notes écrivent « quotacheck -c ». La fiche écrit « -cu » (quotas utilisateur explicitement). Sur un noyau allégé, la prise en charge des quotas peut demander un paquet de modules supplémentaires.' },
      { id: 'amb-ref', sujet: 'E — nom du document de référence', texte: 'L’énoncé renvoie à « S06-Exemple de partage… » alors que le fichier fourni s’appelle « S05-Exemple de partage… » : même document, numéro différent.' },
    ],
  },
  {
    id: 'cisco-s07-etherchannel',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — Semaine 7 : EtherChannel et Spanning Tree',
    resume: 'Regrouper des liens entre commutateurs Cisco (PAgP, LACP, mode on), vérifier et dépanner un canal, puis régler Spanning Tree (PVST+, Rapid PVST+, ponts racines, PortFast). Six exercices Packet Tracer du formatif 07 et un résumé pliable du cours avec schémas.',
    source: 'Cours de la semaine 7 (« EtherChannel », chapitre 6 de CCNA 2 v7) et formatif 07 (six exercices Packet Tracer) fournis par l’étudiant, non republiés ici : les parcours résument les demandes dans nos mots et les schémas sont originaux. En cas de doute, ton énoncé fait foi.',
    avertissement: 'Les fiches expliquent comment faire dans la console d’un commutateur de laboratoire (Packet Tracer ou matériel) ; elles ne remplacent pas ton énoncé et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Le Toolkit n’exécute aucune commande et ne se connecte à aucun équipement.',
    rappelCours: RESUME_S07,
    parcours: [
      {
        lettre: 'A',
        titre: 'Configurer des EtherChannel (PAgP et LACP)',
        resume: 'Exercices « Configure EtherChannel » (6.2.4) et « Implement EtherChannel » (6.4.1) : trois commutateurs, trois canaux, un en PAgP et deux en LACP, avec des ports d’abord réglés en trunk statique.',
        prerequis: [
          f('cours-ec-avant-de-grouper', 1, { titre: 'Voir la vitesse', pourquoi: 'lire l’état des ports avant de les regrouper.' }),
        ],
        items: [
          { id: 'A1', texte: 'Donner un nom aux commutateurs, puis relever l’état, la vitesse, le duplex et le mode des ports qui relient les commutateurs.', refs: [f('cours-ec-avant-de-grouper', 1, { titre: 'Voir la vitesse' }), f('cours-ec-avant-de-grouper', 2, { titre: 'trunk' })] },
          { id: 'A2', texte: 'Régler tous les ports du futur canal en trunk statique (sinon DTP peut les laisser en accès).', refs: [f('cours-ec-pagp', 1, { titre: 'Régler les ports en trunk' })] },
          { id: 'A3', texte: 'Canal 1 en PAgP (desirable des deux côtés) sur deux ports Fast Ethernet : éteindre, channel-group, rallumer.', refs: [f('cours-ec-pagp', 1, { titre: 'éteindre' }), f('cours-ec-pagp', 2, { titre: 'groupe' }), f('cours-ec-pagp', 3, { titre: 'Rallumer' })] },
          { id: 'A4', texte: 'Régler l’interface port-channel du canal 1 en trunk, sur les deux commutateurs.', refs: [f('cours-ec-pagp', 4, { titre: 'port-channel' })] },
          { id: 'A5', texte: 'Vérifier le canal 1 : résumé EtherChannel, trunks et Spanning Tree. Si le canal manque, éteindre puis rallumer les ports aux deux bouts.', refs: [f('cours-ec-pagp', 5, { titre: 'Vérifier le canal' }), f('cours-ec-verifier', 1, { titre: 'Résumé' }), f('cours-ec-verifier', 5, { titre: 'Spanning Tree' })] },
          { id: 'A6', texte: 'Canal 2 en LACP (active des deux côtés) sur deux ports Gigabit entre deux autres commutateurs.', refs: [f('cours-ec-lacp', 1, { titre: 'trunk' }), f('cours-ec-lacp', 2, { titre: 'groupe' }), f('cours-ec-lacp', 3, { titre: 'Rallumer' }), f('cours-ec-lacp', 4, { titre: 'port-channel' })] },
          { id: 'A7', texte: 'Canal 3 en LACP « négocié » : un bout en active qui propose, l’autre en passive qui répond.', refs: [f('cours-ec-lacp', 2, { titre: 'groupe' })], note: 'Le mode se choisit avec le paramètre « mode » de la fiche : active sur un commutateur, passive sur l’autre.' },
          { id: 'A8', texte: 'Contrôler les trois canaux avec le résumé EtherChannel sur chaque commutateur.', refs: [f('cours-ec-verifier', 1, { titre: 'Résumé' })] },
          { id: 'A9', texte: 'Exercice 6.4.1 : construire la topologie (trois commutateurs 2960, câbles droits, noms SWA, SWB, SWC) avant de configurer.', refs: [], couvert: false, note: 'La construction de la topologie se fait dans Packet Tracer (glisser les commutateurs, câbler les ports du tableau) ; le catalogue ne couvre que les commandes de configuration.' },
          { id: 'A10', texte: 'Exercice 6.4.1 : un canal PAgP entre SWA et SWB, un canal LACP entre SWA et SWC, un canal LACP de secours entre SWB et SWC où SWC propose et SWB répond.', refs: [f('cours-ec-pagp', 2, { titre: 'groupe' }), f('cours-ec-lacp', 2, { titre: 'groupe' })] },
          { id: 'A11', texte: 'Variante du cours : un EtherChannel statique en mode on, sur les deux bouts.', refs: [f('cours-ec-statique', 2, { titre: 'groupe' })] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Vérifier et dépanner des EtherChannel',
        resume: 'Exercice « Troubleshoot EtherChannel » (6.3.4) : quatre commutateurs et six canaux mal configurés par un technicien ; on lit, on compare au tableau fourni, puis on corrige les modes de port, les affectations et les protocoles.',
        prerequis: [
          f('cours-ec-verifier', 1, { titre: 'Résumé', pourquoi: 'savoir lire Po(SU), Po(SD) et les ports (P) ou (I).' }),
        ],
        items: [
          { id: 'B1', texte: 'Repérer les ports restés en mode accès au lieu de trunk (physiques et port-channel).', refs: [f('cours-ec-avant-de-grouper', 2, { titre: 'trunk' }), f('cours-ec-avant-de-grouper', 3, { titre: 'mode' })] },
          { id: 'B2', texte: 'Corriger ces ports en trunk, d’abord les ports physiques puis les interfaces port-channel.', refs: [f('cours-ec-depanner', 5, { titre: 'Retirer l’ancien groupe' }), f('cours-ec-pagp', 4, { titre: 'port-channel' })] },
          { id: 'B3', texte: 'Comparer le résumé EtherChannel de chaque commutateur au tableau des groupes et des ports fourni.', refs: [f('cours-ec-depanner', 1, { titre: 'état du canal' }), f('cours-ec-verifier', 1, { titre: 'Résumé' })] },
          { id: 'B4', texte: 'Corriger les ports affectés au mauvais groupe (par exemple deux ports dans un groupe qui ne correspond pas au tableau).', refs: [f('cours-ec-depanner', 4, { titre: 'Éteindre' }), f('cours-ec-depanner', 5, { titre: 'Retirer l’ancien groupe' }), f('cours-ec-depanner', 6, { titre: 'Rallumer' })] },
          { id: 'B5', texte: 'Repérer et corriger un protocole incompatible : PAgP configuré d’un côté face à LACP de l’autre.', refs: [f('cours-ec-depanner', 2, { titre: 'interfaces logiques' }), f('cours-ec-depanner', 5, { titre: 'Retirer l’ancien groupe' })], note: 'Les deux bouts d’un canal utilisent le même protocole : choisis le mode du tableau (LACP actif) sur le commutateur fautif.' },
          { id: 'B6', texte: 'Vérifier que les six canaux sont en service (SU) avec leurs ports dans le canal (P).', refs: [f('cours-ec-depanner', 7, { titre: 'Contrôler' }), f('cours-ec-verifier', 1, { titre: 'Résumé' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Spanning Tree : redondance, PVST+ et Rapid PVST+',
        resume: 'Trois exercices : « Examining a Redundant Design » (3.1.1.5), « Configuring PVST+ » (3.3.1.5) et « Configuring Rapid PVST+ » (3.3.2.2). On observe la convergence, on règle le mode et les ponts racines par VLAN, puis PortFast et la protection BPDU.',
        prerequis: [
          f('cours-stp-lire', 1, { titre: 'Voir tous les arbres', pourquoi: 'lire racine, rôles et états des ports.' }),
        ],
        items: [
          { id: 'C1', texte: 'Vérifier la convergence : quels liens montants transmettent, lesquels sont bloqués.', refs: [f('cours-stp-lire', 1, { titre: 'Voir tous les arbres' }), f('cours-stp-lire', 3, { titre: 'ports actifs' })] },
          { id: 'C2', texte: 'Suivre un ping entre deux ordinateurs en mode simulation (ARP puis ICMP) et noter le chemin sans boucle.', refs: [], couvert: false, note: 'Le mode simulation et les scénarios de Packet Tracer ne s’apprennent pas par une commande ; observe le chemin, puis relis les ports actifs avec la fiche « Lire l’état de Spanning Tree ».' },
          { id: 'C3', texte: 'Supprimer un lien, puis un commutateur, attendre la convergence et noter le nouveau chemin actif.', refs: [f('cours-stp-lire', 3, { titre: 'ports actifs' }), f('cours-stp-lire', 2, { titre: 'un seul VLAN' })] },
          { id: 'C4', texte: 'PVST+ : mettre les ports d’utilisateurs en accès, créer les VLAN du plan et les affecter.', refs: [f('cisco-creer-vlan'), f('cisco-affecter-port-vlan')] },
          { id: 'C5', texte: 'PVST+ : régler le mode « pvst » sur les trois commutateurs.', refs: [f('cours-stp-racines', 1, { titre: 'Choisir le mode' })] },
          { id: 'C6', texte: 'PVST+ : un commutateur racine principale de certains VLAN, un autre racine principale des autres, le troisième racine secondaire de tous.', refs: [f('cours-stp-racines', 2, { titre: 'Désigner' }), f('cours-stp-racines', 3, { titre: 'VLAN 1' })] },
          { id: 'C7', texte: 'Vérifier avec show spanning-tree que chaque VLAN a la racine prévue.', refs: [f('cours-stp-racines', 4, { titre: 'Contrôler' }), f('cours-stp-lire', 1, { titre: 'Voir tous les arbres' })] },
          { id: 'C8', texte: 'PortFast puis protection BPDU sur les ports d’accès des postes.', refs: [f('cours-stp-portfast-bpduguard', 2, { titre: 'PortFast' }), f('cours-stp-portfast-bpduguard', 3, { titre: 'protection BPDU' })] },
          { id: 'C9', texte: 'Rapid PVST+ : régler le mode « rapid-pvst », reprendre les ponts racines, PortFast et BPDU guard.', refs: [f('cours-stp-racines', 1, { titre: 'Choisir le mode' }), f('cours-stp-racines', 2, { titre: 'Désigner' }), f('cours-stp-portfast-bpduguard', 2, { titre: 'PortFast' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-ec-statique', pourquoi: 'le mode « on » du cours, et pourquoi il est risqué.' },
      { fiche: 'cisco-voir-trunks', pourquoi: 'lire les trunks (VLAN autorisés, natif) avant et après un canal.' },
      { fiche: 'cisco-enregistrer-config', pourquoi: 'sauvegarder la configuration une fois le travail validé.' },
    ],
    ambiguites: [
      { id: 'S07-1', sujet: 'Nom des interfaces', texte: 'Les exercices utilisent des noms courts (F0/21, G0/1) comme dans Packet Tracer ; le Toolkit les écrit en entier (FastEthernet0/21), ce qui est équivalent dans IOS. Vérifie la numérotation de TON équipement.' },
      { id: 'S07-2', sujet: 'Groupes et ports du tableau', texte: 'Le numéro de groupe est local à chaque commutateur. Suis toujours le tableau de TON énoncé pour savoir quels ports vont dans quel groupe et avec quel protocole ; les valeurs des fiches ne sont que des exemples.' },
    ],
  },
];

export const COURS_PAR_ID = new Map(COURS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Alias de recherche
// ---------------------------------------------------------------------------

function variantes(coursCle, item) {
  // « B7 » → « tp2 b7 », « b7 », « b 7 ». Les lettres seules ne sont pas indexées (trop vagues).
  const code = item.id.toLowerCase();
  const sans = code.replace(/\./g, ' ');
  return [`${coursCle} ${sans}`, sans, `${coursCle} ${sans.replace(/^([a-z])(\d)/, '$1 $2')}`];
}

const CLE_COURS = { 'serveurs2-tp2': 'tp2', 'cisco-s07-etherchannel': 's07' };

const ALIAS = (() => {
  const m = new Map();
  for (const c of COURS) {
    const cle = CLE_COURS[c.id] ?? c.id;
    for (const p of c.parcours) {
      for (const it of p.items) {
        for (const r of it.refs) {
          const liste = m.get(r.fiche) ?? new Set();
          variantes(cle, it).forEach((v) => liste.add(v));
          liste.add(`${cle} ${p.lettre.toLowerCase()} ${p.titre.toLowerCase()}`);
          m.set(r.fiche, liste);
        }
      }
    }
  }
  return m;
})();

/** Alias de recherche d'une fiche (lettres et numéros du travail). */
export function aliasesDe(ficheId) {
  return [...(ALIAS.get(ficheId) ?? [])];
}

// ---------------------------------------------------------------------------
// Liens
// ---------------------------------------------------------------------------

/** #/tache/<id>[/methode/<m>][/etape/<n>[/depuis/<cours>/<lettre>]] */
export function lienEtape(ref, { coursId = null, lettre = null } = {}) {
  let h = `#/tache/${ref.fiche}`;
  if (ref.methode) h += `/methode/${ref.methode}`;
  if (ref.etape) h += `/etape/${ref.etape}`;
  if (ref.etape && coursId && lettre) h += `/depuis/${coursId}/${lettre}`;
  return h;
}

/** Décode la partie après #/tache/ : { id, methode, etape, coursId, lettre } ou null. */
export function lireRouteTache(hash) {
  const m = /^#\/tache\/([A-Za-z0-9_-]+)(?:\/methode\/(linux|powershell|cmd|ios|azure|gui|scenario))?(?:\/etape\/(\d{1,3})(?:\/depuis\/([A-Za-z0-9_-]+)\/([A-Z]))?)?$/.exec(hash || '');
  if (!m) return null;
  return { id: m[1], methode: m[2] ?? null, etape: m[3] ? Number(m[3]) : null, coursId: m[4] ?? null, lettre: m[5] ?? null };
}

export function routeParcours(coursId, lettre = null) {
  return lettre ? `${ROUTE_COURS}/${coursId}/${lettre}` : (coursId ? `${ROUTE_COURS}/${coursId}` : ROUTE_COURS);
}

export function lireRouteCours(hash) {
  const m = /^#\/cours(?:\/([A-Za-z0-9_-]+)(?:\/([A-Z]|resume))?)?$/.exec(hash || '');
  if (!m) return null;
  return { coursId: m[1] ?? null, lettre: m[2] ?? null };
}

// ---------------------------------------------------------------------------
// Contrat d'un cours — vérifié par le banc, jamais au chargement
// ---------------------------------------------------------------------------

/**
 * Anomalies du RÉSUMÉ PLIABLE d'un cours (liste vide = conforme) : de quoi se
 * rafraîchir la mémoire (essentiel, sections, commandes, pièges, questions), des
 * schémas qui existent tous, et aucun texte vide.
 */
export function incoherencesRappel(r) {
  const pb = [];
  const txt = (v) => (typeof v === 'string' ? v.trim() : '');
  if (txt(r.titre).length < 10) pb.push('résumé : titre absent');
  if (txt(r.intro).length < 20) pb.push('résumé : introduction absente');
  if ((r.essentiel ?? []).length < 3) pb.push('résumé : « l’essentiel » demande au moins 3 points');
  for (const [k, x] of (r.essentiel ?? []).entries()) if (txt(x).length < 20) pb.push(`résumé : point essentiel ${k + 1} trop court`);
  if (!(r.sections ?? []).length) pb.push('résumé : aucune section');
  const ids = new Set();
  for (const sec of r.sections ?? []) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(txt(sec.id))) pb.push(`résumé : identifiant de section mal formé (${sec.id})`);
    if (ids.has(sec.id)) pb.push(`résumé : section ${sec.id} en double`);
    ids.add(sec.id);
    if (txt(sec.titre).length < 6) pb.push(`résumé : section ${sec.id} sans titre`);
    if (!(sec.points ?? []).length) pb.push(`résumé : section ${sec.id} sans point`);
    for (const x of sec.points ?? []) if (txt(x).length < 20) pb.push(`résumé : section ${sec.id} : un point est trop court`);
    for (const sch of sec.schemas ?? []) if (!IDS_SCHEMAS.includes(sch)) pb.push(`résumé : section ${sec.id} : schéma inconnu « ${sch} »`);
  }
  if (!(r.commandes ?? []).length) pb.push('résumé : aucune commande à retenir');
  for (const c of r.commandes ?? []) if (txt(c.cmd).length < 3 || txt(c.sert).length < 10) pb.push(`résumé : commande « ${c.cmd} » sans explication`);
  if ((r.questions ?? []).length < 3) pb.push('résumé : au moins 3 questions d’auto-évaluation');
  for (const q of r.questions ?? []) if (txt(q.q).length < 10 || txt(q.r).length < 20) pb.push(`résumé : question incomplète (« ${txt(q.q).slice(0, 30)} »)`);
  return pb;
}

/**
 * Anomalies d'un cours (liste vide = conforme).
 * `fiches` : (id) → { etapes: n } | null ; `assistants` : (id) → bool.
 */
export function incoherencesCours(cours, { fiches, assistants = () => true }) {
  const pb = [];
  const txt = (v) => (typeof v === 'string' ? v.trim() : '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(txt(cours.id))) pb.push('cours : id mal formé');
  if (txt(cours.titre).length < 8) pb.push('cours : titre trop court');
  if (txt(cours.source).length < 20) pb.push('cours : source absente (d’où viennent les parcours ?)');
  if (txt(cours.avertissement).length < 20) pb.push('cours : avertissement absent');
  if (!cours.parcours?.length) pb.push('cours : aucun parcours');
  const lettres = new Set(); const items = new Set();
  const verifierRef = (r, ou) => {
    const fiche = fiches(r.fiche);
    if (!fiche) { pb.push(`${ou} : fiche inconnue « ${r.fiche} »`); return; }
    // Les étapes sont numérotées PAR méthode : sans méthode, c'est la première de la fiche.
    const mid = r.methode ?? fiche.methodeParDefaut ?? null;
    if (r.methode && fiche.methodes && !(r.methode in fiche.methodes)) { pb.push(`${ou} : méthode « ${r.methode} » absente de ${r.fiche}`); return; }
    const n = mid && fiche.methodes ? fiche.methodes[mid] : fiche.etapes;
    if (r.etape !== null && r.etape !== undefined && (!Number.isInteger(r.etape) || r.etape < 1 || r.etape > n)) {
      pb.push(`${ou} : étape ${r.etape} absente de ${r.fiche} (${n} étape(s))`);
    }
    // Garde-fou : le titre cité doit apparaître dans le titre de l'étape visée (une étape insérée ne décale pas le lien en silence).
    if (r.titre && r.etape && fiche.titres) {
      const t = (fiche.titres[mid ?? fiche.methodeParDefaut] ?? [])[r.etape - 1];
      if (!t || !t.toLowerCase().includes(r.titre.toLowerCase())) pb.push(`${ou} : l’étape ${r.etape} de ${r.fiche} ne s’intitule pas « ${r.titre} » (« ${t ?? '—'} »)`);
    }
  };
  for (const p of cours.parcours ?? []) {
    if (!/^[A-Z]$/.test(p.lettre ?? '')) pb.push(`parcours « ${p.titre} » : lettre invalide`);
    if (lettres.has(p.lettre)) pb.push(`parcours ${p.lettre} en double`);
    lettres.add(p.lettre);
    if (txt(p.titre).length < 6) pb.push(`parcours ${p.lettre} : titre trop court`);
    if (txt(p.resume).length < 20) pb.push(`parcours ${p.lettre} : résumé absent`);
    if (!p.items?.length) pb.push(`parcours ${p.lettre} : aucun élément`);
    for (const r of p.prerequis ?? []) verifierRef(r, `parcours ${p.lettre} (prérequis)`);
    for (const it of p.items ?? []) {
      const ou = `élément ${it.id}`;
      if (!new RegExp(`^${p.lettre}\\d{1,2}(\\.\\d)?$`).test(it.id ?? '')) pb.push(`${ou} : l’identifiant doit commencer par la lettre du parcours ${p.lettre}`);
      if (items.has(it.id)) pb.push(`${ou} en double`);
      items.add(it.id);
      if (txt(it.texte).length < 12) pb.push(`${ou} : texte absent`);
      const couvert = it.couvert !== false;
      if (couvert && !it.refs?.length) pb.push(`${ou} : couvert mais sans fiche (mettre couvert:false et dire pourquoi)`);
      if (!couvert) {
        if (it.refs?.length) pb.push(`${ou} : marqué non couvert mais cite une fiche`);
        if (txt(it.note).length < 20) pb.push(`${ou} : non couvert sans explication`);
      }
      for (const r of it.refs ?? []) verifierRef(r, ou);
      for (const a of it.assistants ?? []) if (!assistants(a)) pb.push(`${ou} : assistant inconnu « ${a} »`);
    }
  }
  for (const s of cours.soutien ?? []) verifierRef({ fiche: s.fiche, etape: null }, 'soutien');
  if (cours.rappelCours) pb.push(...incoherencesRappel(cours.rappelCours));
  const amb = new Set();
  for (const a of cours.ambiguites ?? []) {
    if (amb.has(a.id)) pb.push(`ambiguïté ${a.id} en double`);
    amb.add(a.id);
    if (txt(a.texte).length < 30 || txt(a.sujet).length < 6) pb.push(`ambiguïté ${a.id} : sujet ou texte trop court`);
  }
  return pb;
}

// ---------------------------------------------------------------------------
// Gabarit pour un prochain TP
// ---------------------------------------------------------------------------

/**
 * Squelette à copier pour un autre travail pratique. Il suit EXACTEMENT le
 * contrat d'incoherencesCours : mêmes champs, mêmes règles. Aucune valeur
 * réelle : tout est à remplacer.
 */
export const GABARIT_TP = {
  id: 'cours-tp-exemple',
  titre: 'Nom du cours — TPn : titre du travail',
  resume: 'Une phrase sur ce que le travail demande.',
  source: 'D’où viennent ces parcours (notes, énoncé) — non republié ici.',
  avertissement: 'Les fiches expliquent comment faire ; elles ne prouvent rien et ne remplacent pas l’énoncé.',
  parcours: [{
    lettre: 'A',
    titre: 'Première partie du travail',
    points: 0,
    resume: 'Ce que cette partie demande, en une ou deux phrases.',
    prerequis: [{ fiche: 'id-d-une-fiche-du-catalogue', etape: 1, pourquoi: 'pourquoi la lire d’abord' }],
    items: [
      { id: 'A1', texte: 'Ce que la première demande exige, dans tes mots.', refs: [{ fiche: 'id-d-une-fiche-du-catalogue', etape: 1 }] },
      { id: 'A2', texte: 'Une demande que le catalogue ne couvre pas.', refs: [], couvert: false, note: 'Dire PRÉCISÉMENT ce qui manque et où le faire.' },
    ],
  }],
  soutien: [],
  ambiguites: [],
};
