# Matrice de couverture — Serveurs II — TP2 : comptes, stockage et partages Samba

Produite par `node test/matrice-cours.mjs --ecrire` à partir de `dist/cours.mjs` ; `--verifier` échoue si ce fichier est périmé. Les énoncés sont résumés dans nos propres mots (les documents d’origine ne sont pas republiés). **Les parcours sont NOTRE lecture de l’énoncé : en cas de doute, c’est l’énoncé qui fait foi.** Couvert = une fiche écrite à la main permet d’accomplir la tâche (préparation, action, vérification, résultat attendu) ; ce n’est PAS une exécution : aucune commande n’a été lancée sur Ubuntu, Windows, Samba ou RAID réels. Seul le script d’import CSV a été exécuté, contre un faux samba-tool.

Éléments : 45 · couverts par une fiche : 45 · non couverts : 0 ().

## A — Créer les comptes depuis un fichier CSV (24 points)

Un script lit un CSV (login, mot de passe, département) et crée, sur le contrôleur de domaine, les comptes et les groupes de départements (Ventes et marketing, Finance, Technologies de l’information, Direction) ; test de connexion depuis un poste Windows pour un utilisateur de chaque département.

À lire d’abord : `cours-bash-boucles` (étape 1) ; `cours-samba-groupes` (étape 2).

| Élément | Demande (résumée) | Fiche · méthode · étape | Effet de l’étape | État de la couverture |
|---|---|---|---|---|
| A1 | Fichier CSV : login, mot de passe et département de chaque employé de l’entreprise (capture du contenu demandée). | `cours-samba-script-menu` · étape 1 « Écrire le MODÈLE public du CSV (valeurs fictives) » + `cours-samba-script-menu` · étape 2 « Mettre tes vrais comptes dans le CSV — sur la VM seulement » | modification | Couvert — Le modèle public est fictif ; le vrai CSV reste sur ta VM (droits 600, supprimé après le labo). |
| A2 | Script à menu (while, case, fonctions) qui lit le CSV et, pour chaque ligne, crée le groupe du département, le compte et son appartenance (capture du script demandée). | `cours-samba-script-menu` · étape 3 « Écrire le script à menu » + `cours-samba-script-menu` · étape 4 « Rendre le script exécutable » + `cours-samba-script-menu` · étape 5 « Lancer le menu et choisir 1 : créer les comptes » | modification | Couvert — Version du niveau du cours ; la version renforcée (essai à blanc) reste dans cours-samba-import-csv. |
| A3 | Liste des comptes Samba : samba-tool user list (capture). | `cours-samba-script-menu` · étape 6 « Contrôler : comptes, groupes et membres (choix 2, 3, 4) » | lecture | Couvert |
| A4 | Liste des groupes Samba : samba-tool group list (capture). | `cours-samba-script-menu` · étape 6 « Contrôler : comptes, groupes et membres (choix 2, 3, 4) » + `cours-samba-groupes` · étape 4 « Lister les membres » | lecture | Couvert |
| A5 | Test de connexion depuis un poste Windows pour un utilisateur de CHAQUE département. | `cours-windows-connexion-domaine` · gui étape 3 « Ouvrir la session avec le compte du département » [client-windows] + `cours-windows-connexion-domaine` · cmd étape 2 « Le groupe du département » [client-windows] | lecture | Couvert |

## B — Disques, système de fichiers et quotas (22 points)

Un disque de 1 Go : partition, ext4, étiquette data_tp2, UUID, point de montage /DATA_TP2, fichier test_tp2, fstab, quotas utilisateur (christian_chef), propriétaire du dossier. Serveur seulement.

À lire d’abord : `cours-lire-fichiers` (étape 1).

| Élément | Demande (résumée) | Fiche · méthode · étape | Effet de l’étape | État de la couverture |
|---|---|---|---|---|
| B1 | Ajouter un nouveau disque de 1 Go (après avoir supprimé les disques du dernier formatif). | `cours-hyperviseur-ajouter-disque` · gui étape 1 « Choisir ton hyperviseur » [hyperviseur] | lecture | Couvert — Dans l’hyperviseur (quatre séries d’étapes : VMware, VirtualBox, Proxmox VE, Hyper-V). Menus relus dans la documentation, non exécutés. |
| B2 | Vérifier le nom associé au nouveau disque (par exemple /dev/sdb). | `cours-hyperviseur-ajouter-disque` · linux étape 2 « Lister les disques APRÈS l’ajout » [serveur] + `cours-partition-formater-monter` · étape 1 « Repérer le disque neuf » | lecture | Couvert |
| B3 | Lancer fdisk pour créer une partition dans ce disque. | `cours-partition-formater-monter` · étape 3 « Créer la partition avec fdisk » | destructif | Couvert |
| B4 | Créer une nouvelle partition primaire. | `cours-partition-formater-monter` · étape 3 « Créer la partition avec fdisk » | destructif | Couvert |
| B5 | Forcer la mise à jour de la table des partitions. | `cours-partition-formater-monter` · étape 4 « Forcer le noyau à relire la table » | modification | Couvert |
| B6 | Créer un système de fichiers ext4 dans la partition. | `cours-partition-formater-monter` · étape 5 « Créer le système de fichiers ext4 » | destructif | Couvert |
| B7 | Lui attribuer l’étiquette data_tp2. | `cours-partition-formater-monter` · étape 6 « Attribuer une étiquette » | modification | Couvert |
| B8 | Donner l’UUID du système de fichiers. | `cours-partition-formater-monter` · étape 7 « Lire l’étiquette et l’UUID » | lecture | Couvert |
| B9 | Créer, depuis la racine, le répertoire DATA_TP2 (point de montage). | `cours-partition-formater-monter` · étape 8 « Créer le dossier de montage et monter » | modification | Couvert |
| B10 | Monter le système de fichiers PAR SON NOM DE PÉRIPHÉRIQUE sur DATA_TP2. | `cours-partition-formater-monter` · étape 8 « Créer le dossier de montage et monter » | modification | Couvert |
| B11 | Se placer dans le point de montage et créer le fichier test_tp2 contenant la phrase demandée. | `cours-partition-formater-monter` · étape 9 « Se placer dans le point de montage et créer test_tp2 » | modification | Couvert — La phrase exacte de l’énoncé est reprise dans la fiche. |
| B12 | Donner la ligne de /etc/fstab qui monte automatiquement ce système de fichiers PAR SON LABEL data_tp2. | `cours-partition-formater-monter` · étape 10 « Prévoir le montage automatique (par étiquette) » + `cours-partition-formater-monter` · étape 11 « Contrôler fstab avant tout redémarrage » | modification, lecture | Couvert |
| B13 | Commande qui affiche l’occupation des systèmes de fichiers de façon lisible. | `cours-partition-formater-monter` · étape 12 « Voir l’occupation, lisiblement » | lecture | Couvert |
| B14 | Modifier avec nano la ligne de fstab pour activer les quotas utilisateur et remonter. | `cours-quotas-utilisateur` · étape 3 « Ajouter usrquota à la ligne du montage » + `cours-quotas-utilisateur` · étape 4 « Remonter pour appliquer l’option » | modification, interruption | Couvert |
| B15 | Commandes qui créent et activent les quotas sur DATA_TP2. | `cours-quotas-utilisateur` · étape 1 « Installer les outils de quotas » + `cours-quotas-utilisateur` · étape 5 « Créer les fichiers de quotas » + `cours-quotas-utilisateur` · étape 6 « Activer les quotas » | modification | Couvert |
| B16 | Limite soft de 260 Mo pour christian_chef (hard = soft + 10 Ko). | `cours-quotas-utilisateur` · étape 7 « Fixer les limites du compte » | modification | Couvert — Unités à trancher : voir l’ambiguïté sur « Mo ». |
| B17 | Changer propriétaire et groupe de DATA_TP2 en christian_chef:users. | `cours-donner-dossier-compte` · étape 3 « Changer propriétaire et groupe » | modification | Couvert — Un compte du domaine ne se résout comme propriétaire que si le serveur le voit (getent passwd) : voir l’ambiguïté correspondante. |
| B18 | Se connecter avec christian_chef et créer un répertoire et un fichier dans DATA_TP2. | `cours-donner-dossier-compte` · étape 4 « Tester l’écriture avec ce compte » | modification | Couvert |

## C — RAID 1 : création, panne, remplacement, disque de secours (14 points)

Un miroir de deux disques de 1 Go, formaté, rempli de trois fichiers ; une panne simulée, le remplacement du disque, puis un disque de secours (section 8 du formatif). Serveur seulement.

À lire d’abord : `cours-creer-dossiers-fichiers` (étape 1).

| Élément | Demande (résumée) | Fiche · méthode · étape | Effet de l’étape | État de la couverture |
|---|---|---|---|---|
| C1 | Créer un RAID 1 avec deux nouveaux disques de 1 Go. | `cours-raid1-creer` · étape 4 « Créer le miroir » | destructif | Couvert — Le formatif demande md1 à la place de md0 : la matrice est un champ de la fiche. |
| C2 | Donner l’état du RAID. | `cours-raid1-creer` · étape 5 « Suivre la synchronisation » | lecture | Couvert |
| C3 | Formater le RAID. | `cours-raid1-creer` · étape 6 « Formater la matrice en ext4 » | destructif | Couvert |
| C4 | Créer trois fichiers texte dans le RAID (touch, cat ou nano). | `cours-raid1-creer` · étape 7 « Monter la matrice » + `cours-raid1-creer` · étape 8 « Créer trois fichiers texte dans la matrice » | modification | Couvert |
| C5 | Simuler la panne d’un des disques du RAID. | `cours-raid1-panne-secours` · étape 2 « LABORATOIRE — simuler la panne d’un disque » | interruption | Couvert |
| C6 | Donner l’état du RAID après la panne. | `cours-raid1-panne-secours` · étape 3 « Lire l’état après la panne » | lecture | Couvert |
| C7 | Remplacer le disque en panne. | `cours-raid1-panne-secours` · étape 4 « Retirer le disque défaillant » + `cours-raid1-panne-secours` · étape 6 « Ajouter le disque de remplacement » + `cours-raid1-panne-secours` · étape 7 « Suivre la reconstruction » | modification, destructif, lecture | Couvert |
| C8 | Ajouter un disque de secours et suivre toutes les étapes de la section 8 du formatif (rôles, bascule du secours). | `cours-raid1-panne-secours` · étape 8 « Ajouter un disque de secours (spare) » + `cours-raid1-panne-secours` · étape 9 « LABORATOIRE — faire tomber un disque actif pour voir le secours prendre sa place » + `cours-raid1-panne-secours` · étape 11 « Contrôler les rôles » | destructif, interruption, lecture | Couvert — Le formatif crée parfois le RAID AVEC le disque de secours ; la fiche l’ajoute après coup, comme la capture de l’énoncé (mdadm --manage … --add). |

## D — Partage Samba : un compte écrit, un compte lit (20 points)

Le dossier partage_tp2 (777) dans le RAID, deux comptes user1tp2 (écriture) et user2tp2 (lecture), test de configuration, accès depuis Ubuntu Desktop et Windows 11, puis smbclient dans les deux sens.

À lire d’abord : `cours-samba-groupes` (étape 1) ; `cours-droits-dossier-partage` (étape 4).

| Élément | Demande (résumée) | Fiche · méthode · étape | Effet de l’étape | État de la couverture |
|---|---|---|---|---|
| D1 | Dans le RAID, créer le répertoire à partager partage_tp2 avec les permissions 777. | `cours-samba-partage-utilisateurs` · étape 1 « Créer le dossier à partager » + `cours-samba-partage-utilisateurs` · étape 4 « Régler les droits Unix du dossier — LABORATOIRE (777) » | modification | Couvert — 777 est un réglage de LABORATOIRE (étape séparée de la fiche). |
| D2 | Configurer le partage dans smb.conf : affichable, user1tp2 écrit, user2tp2 lit seulement, description visible dans le voisinage réseau. | `cours-samba-partage-utilisateurs` · étape 2 « Créer les deux comptes du domaine » + `cours-samba-partage-utilisateurs` · étape 6 « Ajouter la section de partage » | modification | Couvert |
| D3 | Tester les paramètres de smb.conf avec testparm. | `cours-samba-partage-utilisateurs` · étape 7 « Tester la configuration » | lecture | Couvert |
| D4 | Sur le client Ubuntu Desktop, configurer la carte réseau pour atteindre le serveur. | `cours-ubuntu-reseau-client` · gui étape 1 « Ouvrir les paramètres de la carte réseau » [client-ubuntu] + `cours-ubuntu-reseau-client` · linux étape 2 « Fixer l’adresse IPv4 » [client-ubuntu] | lecture, interruption | Couvert |
| D5 | Depuis Ubuntu, montrer que user1tp2 peut écrire dans le dossier partagé. | `cours-ubuntu-acces-partage` · linux étape 3 « Compte en écriture : créer un dossier » [client-ubuntu] + `cours-ubuntu-acces-partage` · gui étape 2 « S’authentifier avec le compte en écriture » [client-ubuntu] | modification, lecture | Couvert |
| D6 | Depuis Ubuntu, montrer que user2tp2 NE PEUT PAS écrire mais peut lire. | `cours-ubuntu-acces-partage` · linux étape 4 « Compte en lecture seule : lire » [client-ubuntu] + `cours-ubuntu-acces-partage` · linux étape 5 « Compte en lecture seule : essayer d’écrire (refus attendu) » [client-ubuntu] | lecture | Couvert |
| D7 | Même chose que D5 et D6, mais avec un client Windows 11. | `cours-windows-acces-partage` · gui étape 1 « Ouvrir le partage dans l’Explorateur » [client-windows] + `cours-windows-acces-partage` · cmd étape 3 « Se connecter avec le compte en écriture » [client-windows] + `cours-windows-acces-partage` · powershell étape 3 « Se connecter avec le compte en écriture » [client-windows] | lecture, modification | Couvert — Changer de compte vers le même serveur demande de retirer la connexion existante (erreur 1219) : étape ciblée, jamais « net use * /delete ». |
| D8.1 | Avec smbclient depuis Ubuntu, télécharger deux fichiers créés d’abord sur le serveur dans le dossier partagé. | `cours-smbclient-transferts` · étape 1 « Créer les deux fichiers dans le dossier partagé » [serveur] + `cours-smbclient-transferts` · étape 5 « Télécharger les deux fichiers (get) » [client-ubuntu] | modification | Couvert — L’énoncé cite deux fois « fichier1tp2 » : lu comme fichier1tp2 et fichier2tp2. |
| D8.2 | Depuis Ubuntu, créer depot1 et depot2 et les déposer dans le dossier partagé avec smbclient. | `cours-smbclient-transferts` · étape 8 « Créer depot1 et depot2 sur le client » [client-ubuntu] + `cours-smbclient-transferts` · étape 9 « Déposer les deux fichiers (put) » [client-ubuntu] | modification | Couvert |

## E — Partage d’un dossier par groupe Samba (Direction) (12 points)

Un dossier partagé pour le groupe Samba Direction : droits 770, déclaration dans smb.conf, tous les membres lisent et écrivent sauf la réceptionniste (lecture seule), test d’écriture avec elle.

À lire d’abord : `cours-samba-groupes` (étape 5) ; `cours-samba-script-menu` (étape 5).

| Élément | Demande (résumée) | Fiche · méthode · étape | Effet de l’étape | État de la couverture |
|---|---|---|---|---|
| E1 | Créer le répertoire partagé du groupe Direction. | `cours-samba-partage-groupe` · étape 1 « Créer le dossier » [serveur] | modification | Couvert |
| E2 | Donner le dossier au groupe et passer ses droits en 770 (chmod 770). | `cours-samba-partage-groupe` · étape 2 « Lire le gid du groupe » [serveur] + `cours-samba-partage-groupe` · étape 3 « Donner le dossier au groupe » [serveur] + `cours-samba-partage-groupe` · étape 4 « Limiter l’accès au groupe (770) » [serveur] | lecture, modification | Couvert |
| E3 | Ajouter la configuration du partage dans /etc/samba/smb.conf. | `cours-samba-partage-groupe` · étape 6 « Déclarer le partage » [serveur] + `cours-samba-partage-groupe` · étape 7 « Tester puis recharger » [serveur] | modification, lecture | Couvert |
| E4 | Tous les utilisateurs du département lisent et écrivent, sauf la réceptionniste qui lit seulement. | `cours-samba-partage-groupe` · étape 6 « Déclarer le partage » [serveur] + `cours-samba-partage-groupe` · étape 8 « Membre du groupe : créer un dossier (écriture permise) » [client-ubuntu] | modification | Couvert — read list = le compte de la réceptionniste ; jamais dans write list. |
| E5 | Test d’écriture avec la réceptionniste : montrer qu’elle n’a pas le droit d’écrire. | `cours-samba-partage-groupe` · étape 9 « Réceptionniste : essayer d’écrire (refus attendu) » [client-ubuntu] | lecture | Couvert |

## Fiches de soutien

| Fiche | Pourquoi |
|---|---|
| `cours-samba-import-csv` | Version renforcée (hors cours) : essai à blanc et contrôles avant d’appliquer. |
| `cours-bash-menu` | Le menu while + case + fonctions des formatifs. |
| `cours-samba-script-menu` | Le script à menu de la partie A au niveau du cours. |
| `cours-droits-fichier` | ls -l et chmod en octal (formatif 2). |
| `cours-samba-groupes` | Gérer les groupes Samba (créer, ajouter, lister, gid). |
| `cours-ubuntu-jonction-ad` | Joindre un poste Ubuntu au domaine (realmd, SSSD, PAM). |
| `cours-samba-dns` | Enregistrements A, zone inverse et PTR dans le DNS de Samba. |
| `cours-rsat-windows` | Installer les consoles AD et DNS sur un poste Windows. |
| `cours-bash-condition` | if et case pour écrire un script. |
| `cours-bash-fonctions` | Fonctions et arguments d’un script. |
| `cours-se-reperer` | pwd, ls, cd : les bases du terminal. |
| `cours-grep-wc` | Chercher dans un fichier de configuration. |
| `cours-liens` | Liens durs et symboliques. |
| `cours-identifier-fichier` | file, stat : reconnaître la nature d’un fichier. |
| `cours-copier-deplacer` | cp, mv : copier et déplacer sans écraser par mégarde. |
| `cours-supprimer-prudemment` | rm, rmdir : supprimer en sachant ce qui part. |
| `cours-find-fichiers` | find : retrouver un fichier par son nom, sa taille ou sa date. |
| `cours-redirections-tubes` | >, >>, \| : rediriger et enchaîner les commandes. |
| `cours-groupes-locaux` | Comptes et groupes LOCAUX (par opposition au domaine). |
| `cours-creer-compte-local` | useradd, passwd : créer un compte LOCAL, mot de passe saisi au terminal (résumé Linux). |
| `cours-afficher-texte` | echo et printf : afficher du texte et des menus (S2, menus Bash). |
| `cours-processus` | ps, top, kill : voir et arrêter un processus (notes S10.1). |
| `cours-sessions-utilisateurs` | who, w, last, groups : qui est connecté et à quels groupes (notes S10.1, S9). |
| `cours-supprimer-compte-local` | userdel, deluser : retirer un compte LOCAL (notes S10.1, résumé Linux). |
| `cours-archives` | tar : sauvegarder un dossier (notes S10.1, dont deux options fausses corrigées). |
| `cours-gzip-fichier` | gzip et gunzip sur un seul fichier (notes S10.1). |
| `cours-trouver-commande` | which, type, man, locate : trouver une commande ou un fichier (notes S10.1). |
| `cours-comparer-trier` | diff, sort, uniq, tr, more : comparer et transformer du texte (résumé Linux). |
| `cours-etat-systeme` | free, uptime, uname, df : état du système (formatif 3, S10.1). |
| `cours-arret-redemarrage` | shutdown, reboot : arrêter ou redémarrer (S10.1, RAID1 : « Faites un reboot »). |
| `cours-disque-entretien` | tune2fs, fsck : forcer et lancer une vérification (formatif 3, étape tune2fs -C 1000). |
| `cours-quota-edquota` | edquota : fixer un quota avec l’éditeur (formatif 3) ; variante interactive de setquota. |
| `cours-samba-connexions` | smbstatus : voir les connexions actives (cours Samba). |
| `cours-planifier-taches` | at et crontab : planifier une commande (S10.1). |
| `cours-ifconfig-ancien` | ifconfig -a et son remplaçant ip (notes S1). |
| `cours-service-ancien` | service et systemctl : même résultat, deux commandes (résumé Linux). |

## Ambiguïtés de l’énoncé

- **A — logins, mots de passe et noms de départements** — L’énoncé n’impose ni la liste complète des logins ni les mots de passe : seuls quelques exemples apparaissent dans les images (christian_chef, julie_emp1, dominique_chef). Le CSV public de l’application est donc entièrement FICTIF ; ton vrai fichier reste sur TA machine virtuelle et aucun vrai mot de passe n’est saisi dans l’application.
- **A/D — format du CSV** — Les images montrent un séparateur point-virgule sans ligne d’en-tête, alors que la phrase de l’énoncé contient une double virgule parasite. Le script accepte donc le point-virgule, une en-tête facultative, les fins de ligne Windows, les lignes vides ou invalides (comptées et signalées) et les doublons (ignorés avec avertissement).
- **A — « Finance » ou « Finances »** — Les images écrivent « Finance » au singulier, certaines phrases « Finances ». Les fiches utilisent « Finance » ; garde l’orthographe exacte de TON énoncé pour les noms de groupes.
- **B1 — hyperviseur non précisé** — L’énoncé demande d’ajouter un disque sans nommer l’hyperviseur. La fiche GUI propose quatre cas (VirtualBox, VMware, Proxmox, Hyper-V) ; choisis celui de ton laboratoire. Seule la vérification sous Ubuntu (lsblk) est commune.
- **B16 — « 260 Mo »** — Mo = 1 000 000 octets, ou Mio = 1 048 576 ? En blocs de 1 Kio, 260 Mio = 266 240 ; 260 Mo = environ 253 906. La fiche propose 266240 / 266250 (Mio, souple + 10 Kio). Demande à ton enseignant l’unité attendue.
- **D8.1 — deux fichiers du même nom** — L’énoncé écrit deux fois « fichier1tp2 ». Lu comme fichier1tp2 et fichier2tp2. Deux noms identiques ne transfèrent qu’un fichier.
- **D1 — permissions 777** — 777 donne tous les droits à tout le monde au niveau Unix : seul Samba filtre. Acceptable pour un laboratoire isolé, jamais en production. Les fiches séparent les deux réglages.
- **D — redémarrer Samba** — Les notes disent « systemctl restart smbd ». Sur un CONTRÔLEUR DE DOMAINE, le service s’appelle samba-ad-dc (smbd est masqué). Les fiches utilisent smbcontrol reload-config, valable des deux côtés.
- **D2 — « utilisateurs Samba »** — Sur un contrôleur de domaine, les comptes se créent avec samba-tool (smbpasswd concerne un serveur de fichiers autonome). Les fiches suivent samba-tool ; le mot de passe de samba-tool user create apparaît dans la ligne de commande : usage de laboratoire uniquement.
- **A/E — groupe de la direction et réceptionniste** — L’énoncé ne nomme ni le groupe de la direction ni le login de la réceptionniste. Ils sont des paramètres de la fiche (valeurs d’exemple fictives), à remplacer par ceux de ton CSV.
- **A5/D7 — jonction et connexion Windows** — L’énoncé ne détaille pas la jonction de Windows 11 au domaine. Les fiches supposent le poste déjà joint (voir la mention « suppose » de chaque fiche) et traitent la connexion avec un compte du domaine, la vérification du département, le partage autorisé (lecture/écriture) et l’écriture refusée.
- **E — réceptionniste en lecture seule** — read list rend un compte en lecture seule même si le partage est inscriptible ; un compte présent dans read list ET write list reçoit l’écriture (manuel de smb.conf). Les fiches suivent le document de cours (valid users + read list).
- **B16–B17 — compte du domaine comme propriétaire** — chown et les quotas ne fonctionnent que si le système sait résoudre le compte (winbind ou SSSD). Vérifie avec getent passwd avant ; sinon utilise un compte local.
- **C — arrêt et relance du RAID** — Les notes relancent avec --run après --stop. Après un arrêt, la matrice n’existe plus : on la ré-assemble avec --assemble --scan. Son nom peut alors changer (md127).
- **C7 — « /dev/hdc »** — L’exemple de remplacement des notes cite un disque IDE ancien (hdc). Utilise le nom réel de TON disque, lu avec lsblk : il n’est jamais présumé.
- **B15 — quotacheck** — Les notes écrivent « quotacheck -c ». La fiche écrit « -cu » (quotas utilisateur explicitement). Sur un noyau allégé, la prise en charge des quotas peut demander un paquet de modules supplémentaires.
- **E — nom du document de référence** — L’énoncé renvoie à « S06-Exemple de partage… » alors que le fichier fourni s’appelle « S05-Exemple de partage… » : même document, numéro différent.

## Fiches du cours (136)

| Fiche | Titre | Étapes | Effet |
|---|---|---|---|
| `cours-se-reperer` | Se repérer dans les dossiers : pwd, ls, cd | 3 | lecture |
| `cours-identifier-fichier` | Identifier un fichier : file, stat, ls -i | 3 | lecture |
| `cours-creer-dossiers-fichiers` | Créer des dossiers et des fichiers : mkdir, touch, echo | 4 | modification |
| `cours-copier-deplacer` | Copier, déplacer et renommer : cp et mv | 4 | modification |
| `cours-supprimer-prudemment` | Supprimer prudemment : rm, rmdir | 4 | destructif |
| `cours-liens` | Créer un lien dur et un lien symbolique : ln | 4 | modification |
| `cours-lire-fichiers` | Lire un fichier : cat, less, head, tail | 4 | lecture |
| `cours-grep-wc` | Chercher un motif et compter : grep, wc | 3 | lecture |
| `cours-find-fichiers` | Trouver des fichiers par nom, type ou taille : find | 4 | lecture |
| `cours-redirections-tubes` | Rediriger et enchaîner : >, >>, 2>, \| | 3 | modification |
| `cours-groupes-locaux` | Créer un groupe local et y ajouter un compte | 9 | modification |
| `cours-droits-dossier-partage` | Régler les droits d’un dossier de groupe : chgrp, chmod | 6 | modification |
| `cours-bash-condition` | Écrire un script Bash avec if et case | 4 | modification |
| `cours-bash-boucles` | Écrire un script Bash avec for et while | 3 | modification |
| `cours-bash-fonctions` | Écrire un script Bash avec une fonction et des arguments | 3 | modification |
| `cours-partition-formater-monter` | Partitionner, formater et monter un nouveau disque (fdisk, ext4) | 14 | destructif |
| `cours-quotas-utilisateur` | Activer les quotas utilisateur sur une partition ext4 | 10 | modification |
| `cours-donner-dossier-compte` | Donner un dossier à un compte et tester l’écriture | 7 | modification |
| `cours-raid1-creer` | Créer un RAID 1 (miroir) avec mdadm, le formater et le monter | 14 | destructif |
| `cours-raid1-panne-secours` | RAID 1 : panne simulée, remplacement et disque de secours | 12 | interruption |
| `cours-samba-groupes` | Gérer les groupes Samba AD avec samba-tool | 6 | modification |
| `cours-samba-import-csv` | Import CSV Samba renforcé (essai -n, hors cours) | 11 | modification |
| `cours-samba-partage-utilisateurs` | Partage Samba : un compte en écriture, un en lecture | 12 | modification |
| `cours-samba-partage-groupe` | Partager un dossier avec un groupe Samba (un compte en lecture seule) | 12 | modification |
| `cours-smbclient-transferts` | Télécharger et déposer des fichiers avec smbclient | 12 | modification |
| `cours-samba-dns` | Gérer le DNS d’un domaine Samba : zone inverse, hôte A et PTR | 6 | modification |
| `cours-ubuntu-jonction-ad` | Joindre un poste Ubuntu à un domaine Samba AD (serveur et client) | 30 | interruption |
| `cours-rsat-windows` | Installer les outils RSAT (AD et DNS) sur un poste Windows | 5/6 | modification |
| `cours-hyperviseur-ajouter-disque` | Ajouter un disque virtuel de 1 Go à une VM et le repérer | 9/5 | destructif |
| `cours-ubuntu-reseau-client` | Configurer la carte réseau d’un client Ubuntu Desktop | 3/6 | interruption |
| `cours-ubuntu-acces-partage` | Accéder au partage Samba depuis Ubuntu : écriture et lecture seule | 6/7 | modification |
| `cours-windows-acces-partage` | Accéder au partage Samba depuis Windows 11 : écriture et lecture seule | 7/10/9 | modification |
| `cours-windows-connexion-domaine` | Ouvrir une session Windows avec un compte du domaine | 4/3/3 | lecture |
| `cours-processus` | Voir et arrêter des processus : ps, top, kill | 5 | interruption |
| `cours-sessions-utilisateurs` | Qui est connecté et à quels groupes : who, w, last, groups | 4 | lecture |
| `cours-supprimer-compte-local` | Supprimer un compte local : userdel et deluser | 4 | destructif |
| `cours-archives` | Archiver et compresser : tar et gzip | 5 | modification |
| `cours-gzip-fichier` | Compresser un seul fichier : gzip et gunzip | 4 | modification |
| `cours-trouver-commande` | Trouver une commande ou un fichier : which, type, man, locate | 4 | lecture |
| `cours-comparer-trier` | Comparer et transformer du texte : diff, sort, uniq, tr, more | 4 | lecture |
| `cours-etat-systeme` | État du système : free, uptime, uname, df | 4 | lecture |
| `cours-arret-redemarrage` | Arrêter ou redémarrer le serveur : shutdown et reboot | 4 | interruption |
| `cours-disque-entretien` | Entretenir un système de fichiers ext4 : tune2fs et fsck | 4 | modification |
| `cours-quota-edquota` | Fixer un quota avec l’éditeur : edquota et repquota | 4 | modification |
| `cours-samba-connexions` | Voir qui utilise un partage Samba : smbstatus | 3 | lecture |
| `cours-planifier-taches` | Planifier une commande : at et crontab | 5 | modification |
| `cours-ifconfig-ancien` | L’ancienne commande ifconfig et son remplaçant ip | 2 | lecture |
| `cours-service-ancien` | L’ancienne commande service et systemctl | 4 | interruption |
| `cours-creer-compte-local` | Créer un compte local : adduser ou useradd, puis passwd | 5 | modification |
| `cours-afficher-texte` | Afficher du texte : echo et printf | 4 | lecture |
| `cours-bash-menu` | Écrire un menu en Bash : while, case et fonctions | 3 | modification |
| `cours-samba-script-menu` | TP2 A : le script à menu qui crée les comptes depuis le CSV | 7 | modification |
| `cours-droits-fichier` | Lire et changer les droits d’un fichier : ls -l, chmod | 6 | modification |
| `cours-ec-avant-de-grouper` | Vérifier les ports avant de former un EtherChannel | 3 | lecture |
| `cours-ec-pagp` | Créer un EtherChannel PAgP (Cisco) entre deux commutateurs | 6 | modification |
| `cours-ec-lacp` | Créer un EtherChannel LACP (802.3ad) entre deux commutateurs | 6 | modification |
| `cours-ec-statique` | Créer un EtherChannel statique (mode on, sans protocole) | 6 | modification |
| `cours-ec-verifier` | Vérifier un EtherChannel : show etherchannel et port-channel | 5 | lecture |
| `cours-ec-depanner` | Dépanner un EtherChannel qui ne se forme pas | 7 | modification |
| `cours-stp-lire` | Lire l’état de Spanning Tree et retrouver le chemin actif | 4 | lecture |
| `cours-stp-racines` | Choisir PVST+ ou Rapid PVST+ et fixer les ponts racines | 6 | modification |
| `cours-stp-portfast-bpduguard` | Activer PortFast et la protection BPDU sur un port d’accès | 6 | modification |
| `cours-base-peripherique` | Configuration de base d’un commutateur ou d’un routeur | 9 | modification |
| `cours-sw-gestion-ip` | Adresse de gestion d’un commutateur : interface VLAN et passerelle | 4 | modification |
| `cours-sw-duplex-vitesse` | Régler la vitesse, le duplex et l’auto-MDIX d’un port | 4 | interruption |
| `cours-sw-diagnostiquer-port` | Diagnostiquer un port : état, protocole de ligne et erreurs | 3 | lecture |
| `cours-sw-ports-inutilises` | Désactiver les ports inutilisés d’un commutateur | 6 | modification |
| `cours-sw-portsec` | Sécurité des ports : limiter, apprendre et sanctionner (un port) | 9 | modification |
| `cours-config-portable` | Sauvegarder une configuration en texte et la recharger ailleurs | 6 | modification |
| `cours-rt-interface-ip` | Donner une adresse IP à une interface de routeur (Gigabit, série) | 5 | modification |
| `cours-rt-statique` | Créer une route statique vers un réseau distant | 5 | modification |
| `cours-rt-defaut-flottante` | Route par défaut et route statique de secours (flottante) | 5 | modification |
| `cours-rt-tester` | Tester la connectivité d’un routeur : ping et traceroute | 2 | lecture |
| `cours-rip-configurer` | Configurer RIPv2 sur un routeur | 6 | modification |
| `cours-rip-verifier` | Vérifier et dépanner RIP : protocoles, routes et base de données | 4 | lecture |
| `cours-vtp-reseau` | Configurer VTP : serveur, domaine et clients | 7 | modification |
| `cours-vtp-transparent-etendus` | Mode VTP transparent et VLAN étendus (1006 à 4094) | 5 | modification |
| `cours-dtp-trunk` | Choisir le mode DTP d’un port : auto, desirable, trunk ou access | 5 | modification |
| `cours-vtp-dtp-depanner` | Dépanner VTP et DTP : trunk absent, VLAN non reçus | 4 | lecture |
| `cours-dhcp4-serveur-routeur` | Faire d’un routeur Cisco un serveur DHCPv4 (exclusions et pool) | 5 | modification |
| `cours-dhcp4-relais` | Relayer le DHCPv4 vers un autre réseau (ip helper-address) | 3 | modification |
| `cours-dhcp4-client-routeur` | Interface de routeur client DHCP (adresse IPv4 reçue) | 3 | modification |
| `cours-dhcp4-depanner` | Dépanner DHCPv4 sur un routeur : interface, relais, baux et débogage | 5 | modification |
| `cours-ipv6-adresser-interface` | Adresser une interface de routeur en IPv6 (globale et link-local) | 4 | modification |
| `cours-ipv6-verifier` | Vérifier IPv6 : interfaces, table de routage et ping | 3 | lecture |
| `cours-ipv6-routes-statiques` | Route statique IPv6 : récursive, connectée ou spécifiée | 6 | modification |
| `cours-ipv6-defaut-flottante` | Route IPv6 par défaut (::/0) et route flottante de secours | 4 | modification |
| `cours-dhcp6-slaac` | SLAAC : laisser les postes se fabriquer leur adresse IPv6 | 4 | modification |
| `cours-dhcp6-sans-etat` | Serveur DHCPv6 sans état sur un routeur (SLAAC + DNS) | 6 | modification |
| `cours-dhcp6-avec-etat` | Serveur DHCPv6 avec état sur un routeur (le serveur donne l’adresse) | 6 | modification |
| `cours-dhcp6-relais` | Relayer le DHCPv6 vers un serveur situé sur un autre réseau | 4 | modification |
| `cours-dhcp6-verifier` | Vérifier DHCPv6 : pool, baux, annonces du routeur et poste | 4 | lecture |
| `cours-nat-statique` | NAT statique : une adresse interne = une adresse publique | 5 | modification |
| `cours-nat-dynamique` | NAT dynamique : un groupe d’adresses publiques à la demande | 8 | modification |
| `cours-nat-pat` | PAT (surcharge) : tout un réseau derrière une seule adresse publique | 7 | modification |
| `cours-nat-redirection-port` | Redirection de port (port forwarding) vers un serveur interne | 5 | modification |
| `cours-nat-verifier` | Lire et vider la table NAT | 3 | lecture |
| `cours-route-recap-statique` | Route statique récapitulative (plusieurs réseaux en une ligne) | 6 | modification |
| `cours-route-recap-rip` | Résumé de routes annoncé par RIPv2 (ip summary-address rip) | 4 | modification |
| `cours-show-cisco` | Commandes show Cisco : toutes les lectures utiles, par groupe | 16 | lecture |
| `cours-tp-vlan-ssh-intervlan` | TP complet : VLAN, SSH et routage inter-VLAN (de A à Z) | 39 | modification |
| `cours-az-groupe-ressources` | Créer un groupe de ressources | 3/3/3 | modification |
| `cours-az-verrou-ressource` | Poser un verrou contre la suppression accidentelle | 4/3/3 | modification |
| `cours-az-role-coequipier` | Donner un rôle Azure à un coéquipier | 4/3/3 | modification |
| `cours-az-vnet-creer` | Créer un réseau virtuel (VNet) avec son premier sous-réseau | 4/4/4 | modification |
| `cours-az-sous-reseau-ajouter` | Ajouter un sous-réseau à un réseau virtuel | 3/4/3 | modification |
| `cours-az-plan-adressage` | Relire le plan d’adressage d’un réseau virtuel | 3/4/4 | lecture |
| `cours-az-ip-publique-privee` | Adresses IP Azure : publique statique et privée fixe | 4/5/4 | modification |
| `cours-az-vm-creer-vnet` | Créer une machine virtuelle Linux dans un VNet | 6/6/5 | modification |
| `cours-az-dns-zone-publique` | Créer une zone DNS publique Azure | 3/3/3 | modification |
| `cours-az-dns-enregistrement-a` | Ajouter un enregistrement A ou CNAME dans une zone Azure | 4/5/5 | modification |
| `cours-az-dns-zone-privee` | Créer une zone DNS privée et la lier à un VNet | 4/5/5 | modification |
| `cours-az-peering-creer` | Appairer deux réseaux virtuels (peering) | 4/5/5 | modification |
| `cours-az-peering-verifier` | Vérifier l’état d’un appairage de réseaux virtuels | 3/4/3 | lecture |
| `cours-az-routes-effectives` | Lire les routes effectives d’une interface réseau | 2/3/2 | lecture |
| `cours-az-route-personnalisee` | Créer une route personnalisée (UDR) vers une appliance | 5/6/8 | interruption |
| `cours-az-point-service-stockage` | Limiter un compte de stockage à un sous-réseau (point de service) | 5/6/8 | interruption |
| `cours-az-point-prive-stockage` | Créer un point de terminaison privé pour un compte de stockage | 4/7/7 | modification |
| `cours-az-lb-creer` | Créer un équilibreur de charge public (Azure Load Balancer) | 7/7/8 | modification |
| `cours-az-lb-etat` | Lire la configuration et la santé d’un Azure Load Balancer | 5/6/5 | lecture |
| `cours-az-app-service-creer` | Créer une application App Service (conteneur Linux) | 9/8/8 | modification |
| `cours-az-app-service-restriction-ip` | Restreindre l’accès à une application App Service (IP, sous-réseau) | 7/8/8 | interruption |
| `cours-az-app-service-integration-vnet` | Intégrer App Service à un réseau virtuel (trafic sortant) | 4/5/5 | modification |
| `cours-az-app-service-point-prive` | Isoler App Service avec un point de terminaison privé (entrant) | 5/6/7 | interruption |
| `cours-az-stockage-file-conteneur` | Compte de stockage avec file et conteneur, puis accès public fermé | 6/7/7 | modification |
| `cours-az-point-prive-stockage-sous-ressource` | Point privé par sous-ressource du stockage (blob, queue…) | 4/7/6 | modification |
| `cours-az-table-routage-gerer` | Gérer une table de routage : lire, modifier, dissocier, supprimer | 8/9/9 | interruption |
| `cours-az-routes-etiquettes-service` | Routes du TP2 : passerelle, plage supprimée, appliance, étiquettes | 9/9/10 | interruption |
| `cours-az-tp-demo-webapp-stockage-prive` | TP démo : une application web joint un stockage par point privé | 10/11/13 | interruption |
| `cours-az-lb-interne` | Créer un équilibreur de charge interne (Azure Load Balancer) | 7/6/7 | modification |
| `cours-az-lb-regles-nat-sortant` | Load Balancer : règle NAT entrante et règle sortante (SNAT) | 6/8/8 | interruption |
| `cours-az-lb-inter-regions` | Créer un Load Balancer inter-régions (global) | 7/6/7 | modification |
| `cours-az-appgw-creer` | Créer une Application Gateway v2 (équilibreur HTTP, couche 7) | 10/6/8 | modification |
| `cours-az-appgw-waf` | Protéger une Application Gateway avec un WAF (politique OWASP) | 6/5/6 | modification |
| `cours-az-frontdoor-creer` | Créer un Azure Front Door (Standard ou Premium) | 7/7/7 | modification |
| `cours-az-trafficmanager-creer` | Créer un profil Traffic Manager (équilibrage par le DNS) | 6/6/6 | modification |
