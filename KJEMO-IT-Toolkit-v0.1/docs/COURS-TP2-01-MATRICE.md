# Matrice de couverture — Serveurs II — TP2 : comptes, stockage et partages Samba

Produite par `node test/matrice-cours.mjs --ecrire` à partir de `dist/cours.mjs` ; `--verifier` échoue si ce fichier est périmé. Les énoncés sont résumés dans nos propres mots (les documents d’origine ne sont pas republiés). **Les parcours sont NOTRE lecture de l’énoncé : en cas de doute, c’est l’énoncé qui fait foi.** Aucune commande n’a été exécutée sur une machine réelle.

Éléments : 44 · couverts par une fiche : 41 · non couverts : 3 (A5, B1, D7).

## A — Créer les comptes depuis un fichier CSV (24 points)

Un script lit un fichier CSV et crée, sur le contrôleur de domaine, les comptes et les groupes de départements ; test de connexion depuis Windows.

À lire d’abord : `cours-bash-boucles` (étape 1) ; `cours-samba-groupes` (étape 1).

| Élément | Demande (résumée) | Fiche · étape | Effet de l’étape | État |
|---|---|---|---|---|
| A1 | Écrire le fichier CSV des employés (login, département). | `cours-samba-import-csv` · 1 « Écrire le fichier CSV (valeurs fictives) » | modification | Couvert |
| A2 | Écrire le script qui lit le CSV et crée groupes, comptes et appartenances. | `cours-samba-import-csv` · 2 « Écrire le script » + `cours-samba-import-csv` · 3 « Rendre le script exécutable » | modification | Couvert |
| A3 | Lancer le script en essai, puis pour de bon. | `cours-samba-import-csv` · 4 « Essai à blanc (rien n’est créé) » + `cours-samba-import-csv` · 5 « Appliquer » | lecture, modification | Couvert |
| A4 | Lister les comptes et les groupes créés (captures demandées). | `cours-samba-import-csv` · 6 « Vérifier les comptes et les groupes » | lecture | Couvert |
| A5 | Tester une connexion depuis un poste Windows pour un compte de chaque département. | — | — | **NON COUVERT** — Pas de fiche pour l’ouverture de session Windows avec un compte de domaine. Pour joindre le poste au domaine, voir l’assistant « Joindre un poste Windows à un domaine ». |

## B — Disques, système de fichiers et quotas (22 points)

Un disque de 1 Go : partition, ext4, étiquette, UUID, montage, fstab, quotas utilisateur, propriétaire du dossier.

À lire d’abord : `cours-lire-fichiers` (étape 1).

| Élément | Demande (résumée) | Fiche · étape | Effet de l’étape | État |
|---|---|---|---|---|
| B1 | Ajouter un disque de 1 Go à la machine virtuelle. | — | — | **NON COUVERT** — Ce geste se fait dans l’hyperviseur (VMware, VirtualBox, Proxmox…), pas dans le système invité : hors catalogue. Puis lis lsblk. |
| B2 | Retrouver le nom que le système a donné au nouveau disque. | `cours-partition-formater-monter` · 1 « Repérer le disque neuf » | lecture | Couvert |
| B3 | Lancer fdisk sur ce disque. | `cours-partition-formater-monter` · 3 « Créer la partition avec fdisk » | destructif | Couvert |
| B4 | Créer une partition primaire. | `cours-partition-formater-monter` · 3 « Créer la partition avec fdisk » | destructif | Couvert |
| B5 | Forcer la relecture de la table de partitions. | `cours-partition-formater-monter` · 4 « Forcer le noyau à relire la table » | modification | Couvert |
| B6 | Créer un système de fichiers ext4 dans la partition. | `cours-partition-formater-monter` · 5 « Créer le système de fichiers ext4 » | destructif | Couvert |
| B7 | Donner une étiquette au système de fichiers. | `cours-partition-formater-monter` · 6 « Attribuer une étiquette » | modification | Couvert |
| B8 | Relever l’UUID du système de fichiers. | `cours-partition-formater-monter` · 7 « Lire l’étiquette et l’UUID » | lecture | Couvert |
| B9 | Créer le dossier qui servira de point de montage. | `cours-partition-formater-monter` · 8 « Créer le dossier de montage et monter » | modification | Couvert |
| B10 | Monter la partition sur ce dossier. | `cours-partition-formater-monter` · 8 « Créer le dossier de montage et monter » | modification | Couvert |
| B11 | Créer un premier fichier dans la partition montée. | `cours-partition-formater-monter` · 9 « Écrire un premier fichier » | modification | Couvert |
| B12 | Écrire la ligne de /etc/fstab qui monte la partition par son étiquette. | `cours-partition-formater-monter` · 10 « Prévoir le montage automatique (par étiquette) » + `cours-partition-formater-monter` · 11 « Contrôler fstab avant tout redémarrage » | modification, lecture | Couvert |
| B13 | Afficher l’occupation des systèmes de fichiers, lisiblement. | `cours-partition-formater-monter` · 12 « Voir l’occupation, lisiblement » | lecture | Couvert |
| B14 | Activer l’option de quotas utilisateur dans fstab et remonter. | `cours-quotas-utilisateur` · 3 « Ajouter usrquota à la ligne du montage » + `cours-quotas-utilisateur` · 4 « Remonter pour appliquer l’option » | modification, interruption | Couvert |
| B15 | Créer et activer les quotas sur la partition. | `cours-quotas-utilisateur` · 5 « Créer les fichiers de quotas » + `cours-quotas-utilisateur` · 6 « Activer les quotas » | modification | Couvert |
| B16 | Fixer une limite souple de 260 Mo à un compte, limite stricte = souple + 10 Ko. | `cours-quotas-utilisateur` · 7 « Fixer les limites du compte » | modification | Couvert — Unités à trancher : voir l’ambiguïté sur « Mo ». |
| B17 | Donner le dossier monté à un compte et à un groupe. | `cours-donner-dossier-compte` · 3 « Changer propriétaire et groupe » | modification | Couvert |
| B18 | Se connecter avec ce compte et y créer un dossier et un fichier. | `cours-donner-dossier-compte` · 4 « Tester l’écriture avec ce compte » + `cours-creer-dossiers-fichiers` · 1 « Créer le dossier » | modification | Couvert |

## C — RAID 1 : création, panne, remplacement, disque de secours (14 points)

Un miroir de deux disques de 1 Go, formaté, rempli de fichiers ; une panne simulée, le remplacement du disque, puis un disque de secours.

À lire d’abord : `cours-creer-dossiers-fichiers` (étape 1).

| Élément | Demande (résumée) | Fiche · étape | Effet de l’étape | État |
|---|---|---|---|---|
| C1 | Créer le RAID 1 avec deux nouveaux disques. | `cours-raid1-creer` · 4 « Créer le miroir » | destructif | Couvert |
| C2 | Donner l’état du RAID. | `cours-raid1-creer` · 5 « Suivre la synchronisation » | lecture | Couvert |
| C3 | Formater le RAID. | `cours-raid1-creer` · 6 « Formater la matrice en ext4 » | destructif | Couvert |
| C4 | Créer trois fichiers texte dans le RAID. | `cours-raid1-creer` · 7 « Monter la matrice » + `cours-creer-dossiers-fichiers` · 3 « Écrire une ligne dans un fichier » | modification | Couvert |
| C5 | Simuler la panne d’un des disques. | `cours-raid1-panne-secours` · 2 « LABORATOIRE — simuler la panne d’un disque » | interruption | Couvert |
| C6 | Donner l’état du RAID après la panne. | `cours-raid1-panne-secours` · 3 « Lire l’état après la panne » | lecture | Couvert |
| C7 | Remplacer le disque en panne. | `cours-raid1-panne-secours` · 4 « Retirer le disque défaillant » + `cours-raid1-panne-secours` · 6 « Ajouter le disque de remplacement » + `cours-raid1-panne-secours` · 7 « Suivre la reconstruction » | modification, destructif, lecture | Couvert |
| C8 | Ajouter un disque de secours et suivre toutes les étapes de la section correspondante du formatif. | `cours-raid1-panne-secours` · 8 « Ajouter un disque de secours (spare) » + `cours-raid1-panne-secours` · 9 « Contrôler les rôles » | destructif, lecture | Couvert — Le formatif crée parfois le RAID AVEC le disque de secours ; la fiche l’ajoute après coup. |

## D — Partage Samba : un compte écrit, un compte lit (20 points)

Un dossier partagé dans le RAID, deux comptes aux droits différents, test de configuration, accès depuis Ubuntu et Windows 11, puis smbclient.

À lire d’abord : `cours-samba-groupes` (étape 2) ; `cours-droits-dossier-partage` (étape 2).

| Élément | Demande (résumée) | Fiche · étape | Effet de l’étape | État |
|---|---|---|---|---|
| D1 | Créer, dans le RAID, le dossier à partager avec les droits demandés. | `cours-samba-partage-utilisateurs` · 1 « Créer le dossier à partager » + `cours-samba-partage-utilisateurs` · 4 « Régler les droits Unix du dossier — LABORATOIRE (777) » | modification | Couvert — L’énoncé demande 777 : c’est un réglage de LABORATOIRE (étape facultative de la fiche) ; le réglage professionnel est à côté. |
| D2 | Déclarer le partage dans smb.conf : visible, avec description, un compte en écriture, un compte en lecture. | `cours-samba-partage-utilisateurs` · 2 « Créer les deux comptes du domaine » + `cours-samba-partage-utilisateurs` · 6 « Ajouter la section de partage » | modification | Couvert |
| D3 | Tester les paramètres avec testparm. | `cours-samba-partage-utilisateurs` · 7 « Tester la configuration » | lecture | Couvert |
| D4 | Configurer la carte réseau du client Ubuntu pour atteindre le serveur. | `cours-ubuntu-jonction-ad` · 2 « Pointer le DNS vers le contrôleur de domaine » | interruption | Couvert — Le réglage DNS par netplan est dans la fiche de jonction ; l’assistant Netplan prépare une configuration complète. |
| D5 | Montrer, depuis Ubuntu, que le compte en écriture peut écrire. | `cours-smbclient-transferts` · 3 « Ouvrir la session interactive » | interruption | Couvert |
| D6 | Montrer que le compte en lecture ne peut pas écrire mais peut lire. | `cours-smbclient-transferts` · 3 « Ouvrir la session interactive » | interruption | Couvert |
| D7 | Refaire D5 et D6 depuis un client Windows 11. | — | — | **NON COUVERT** — Pas de fiche pour l’accès graphique à un partage depuis Windows (\\serveur\partage). À faire dans l’explorateur de fichiers. |
| D8.1 | Avec smbclient, télécharger deux fichiers du partage vers le client. | `cours-smbclient-transferts` · 3 « Ouvrir la session interactive » + `cours-smbclient-transferts` · 4 « Variante sans session : tout en une commande » | interruption, modification | Couvert — L’énoncé cite deux fois le même nom de fichier : lu comme deux fichiers distincts. |
| D8.2 | Avec smbclient, déposer deux fichiers créés sur le client dans le partage. | `cours-smbclient-transferts` · 2 « Préparer deux fichiers à déposer » + `cours-smbclient-transferts` · 3 « Ouvrir la session interactive » | modification, interruption | Couvert |

## E — Partage d’un dossier par groupe Samba (12 points)

Un dossier pour le groupe d’un département : droits 770, déclaration dans smb.conf, lecture et écriture pour tous sauf un compte en lecture seule, test d’écriture.

À lire d’abord : `cours-samba-groupes` (étape 2) ; `cours-samba-import-csv` (étape 1).

| Élément | Demande (résumée) | Fiche · étape | Effet de l’étape | État |
|---|---|---|---|---|
| E1 | Créer le dossier partagé du groupe. | `cours-samba-partage-groupe` · 1 « Créer le dossier » | modification | Couvert |
| E2 | Donner le dossier au groupe et mettre ses droits en 770. | `cours-samba-partage-groupe` · 2 « Lire le gid du groupe » + `cours-samba-partage-groupe` · 3 « Donner le dossier au groupe » + `cours-samba-partage-groupe` · 4 « Limiter l’accès au groupe (770) » | lecture, modification | Couvert |
| E3 | Déclarer le partage dans smb.conf (groupe en lecture et écriture, un compte en lecture seule). | `cours-samba-partage-groupe` · 6 « Déclarer le partage » | modification | Couvert — Un compte présent à la fois dans read list et write list reçoit l’écriture : la fiche utilise deux groupes. |
| E4 | Tester, avec le compte en lecture seule, qu’il ne peut pas écrire. | `cours-samba-partage-groupe` · 7 « Tester puis recharger » + `cours-samba-partage-groupe` · 8 « Tester en écriture avec un compte en lecture seule » + `cours-smbclient-transferts` · 3 « Ouvrir la session interactive » | lecture, interruption | Couvert |

## Fiches de soutien

| Fiche | Pourquoi |
|---|---|
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

## Ambiguïtés de l’énoncé

- **B16 — « 260 Mo »** — Mo = 1 000 000 octets, ou Mio = 1 048 576 ? En blocs de 1 Kio, 260 Mio = 266 240 ; 260 Mo = environ 253 906. La fiche propose 266240 / 266250 (Mio, souple + 10 Kio). Demande à ton enseignant l’unité attendue.
- **D8.1 — deux fichiers du même nom** — L’énoncé écrit deux fois « fichier1tp2 ». Lu comme fichier1tp2 et fichier2tp2. Deux noms identiques ne transfèrent qu’un fichier.
- **D1 — permissions 777** — 777 donne tous les droits à tout le monde au niveau Unix : seul Samba filtre. Acceptable pour un laboratoire isolé, jamais en production. Les fiches séparent les deux réglages.
- **D — redémarrer Samba** — Les notes disent « systemctl restart smbd ». Sur un CONTRÔLEUR DE DOMAINE, le service s’appelle samba-ad-dc (smbd est masqué). Les fiches utilisent smbcontrol reload-config, valable des deux côtés.
- **D2 — « utilisateurs Samba »** — Sur un contrôleur de domaine, les comptes se créent avec samba-tool (smbpasswd concerne un serveur de fichiers autonome). Les fiches suivent samba-tool.
- **E — réceptionniste en lecture seule** — Un compte présent dans read list ET write list reçoit l’écriture (manuel de smb.conf). Avec un groupe d’écriture distinct, le compte en lecture seule reste sans écriture.
- **B16–B17 — compte du domaine comme propriétaire** — chown et les quotas ne fonctionnent que si le système sait résoudre le compte (winbind ou SSSD). Vérifie avec getent passwd avant ; sinon utilise un compte local.
- **C — arrêt et relance du RAID** — Les notes relancent avec --run après --stop. Après un arrêt, la matrice n’existe plus : on la ré-assemble avec --assemble --scan. Son nom peut alors changer (md127).
- **C7 — « /dev/hdc »** — L’exemple de remplacement des notes cite un disque IDE ancien (hdc). Utilise le nom réel de TON disque, lu avec lsblk : il n’est jamais présumé.
- **B15 — quotacheck** — Les notes écrivent « quotacheck -c ». La fiche écrit « -cu » (quotas utilisateur explicitement). Sur un noyau allégé, la prise en charge des quotas peut demander un paquet de modules supplémentaires.
- **E — nom du document de référence** — L’énoncé renvoie à « S06-Exemple de partage… » alors que le fichier fourni s’appelle « S05-Exemple de partage… » : même document, numéro différent.

## Fiches du cours (28)

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
| `cours-find-fichiers` | Trouver des fichiers par nom, type ou taille : find | 3 | lecture |
| `cours-redirections-tubes` | Rediriger et enchaîner : >, >>, 2>, \| | 3 | modification |
| `cours-groupes-locaux` | Créer un groupe local et y ajouter un compte | 4 | modification |
| `cours-droits-dossier-partage` | Régler les droits d’un dossier de groupe : chgrp, chmod | 5 | modification |
| `cours-bash-condition` | Écrire un script Bash avec if et case | 3 | modification |
| `cours-bash-boucles` | Écrire un script Bash avec for, while et select | 3 | modification |
| `cours-bash-fonctions` | Écrire un script Bash avec une fonction et des arguments | 3 | modification |
| `cours-partition-formater-monter` | Partitionner, formater et monter un nouveau disque (fdisk, ext4) | 12 | destructif |
| `cours-quotas-utilisateur` | Activer les quotas utilisateur sur une partition ext4 | 8 | modification |
| `cours-donner-dossier-compte` | Donner un dossier à un compte et tester l’écriture | 5 | modification |
| `cours-raid1-creer` | Créer un RAID 1 (miroir) avec mdadm, le formater et le monter | 9 | destructif |
| `cours-raid1-panne-secours` | RAID 1 : panne simulée, remplacement et disque de secours | 10 | interruption |
| `cours-samba-groupes` | Gérer les groupes Samba AD avec samba-tool | 6 | modification |
| `cours-samba-import-csv` | Créer des comptes et des groupes Samba depuis un fichier CSV | 7 | modification |
| `cours-samba-partage-utilisateurs` | Partage Samba : un compte en écriture, un en lecture | 9 | modification |
| `cours-samba-partage-groupe` | Partager un dossier avec un groupe Samba (lecture seule pour certains) | 8 | modification |
| `cours-smbclient-transferts` | Télécharger et déposer des fichiers avec smbclient | 5 | modification |
| `cours-samba-dns` | Gérer le DNS d’un domaine Samba : zone inverse, hôte A et PTR | 5 | modification |
| `cours-ubuntu-jonction-ad` | Joindre un poste Ubuntu à un domaine Samba AD (realmd et SSSD) | 13 | interruption |
| `cours-rsat-windows` | Installer les outils RSAT (AD et DNS) sur un poste Windows | 5 | modification |
