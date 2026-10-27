# Matrice des commandes du cours → fiche → route → état réel

Produite par `node test/matrice-commandes-cours.mjs --ecrire` ; `--verifier` échoue si ce fichier est périmé, et le banc échoue si une commande déclarée n’a aucune route dans le catalogue. **« Couverte » veut dire : une fiche rédigée à la main ou une commande rapide contient cette commande dans une ligne à copier. Ce n’est pas une exécution : aucune commande n’a été lancée sur une machine réelle** (Ubuntu, Windows, Samba, RAID : NON EXÉCUTÉ).

Commandes suivies : 83 · avec route : 83 · sans route : 0.

## Fichiers et dossiers

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `pwd` | Résumé Linux | `cours-se-reperer` | `#/tache/cours-se-reperer` | Documentaire : relu, non exécuté |
| `ls` | Résumé Linux | `cours-archives`, `cours-copier-deplacer`, `cours-creer-compte-local`, `cours-creer-dossiers-fichiers` (+21) | `#/tache/cours-archives` `#/tache/cours-copier-deplacer` `#/tache/cours-creer-compte-local` `#/tache/cours-creer-dossiers-fichiers` (+21) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `cd` | Résumé Linux | `cours-partition-formater-monter`, `cours-se-reperer`, `cours-smbclient-transferts` | `#/tache/cours-partition-formater-monter` `#/tache/cours-se-reperer` `#/tache/cours-smbclient-transferts` | Documentaire : relu, non exécuté |
| `mkdir` | Résumé Linux | `cours-archives`, `cours-creer-dossiers-fichiers`, `cours-partition-formater-monter`, `cours-raid1-creer` (+5) | `#/tache/cours-archives` `#/tache/cours-creer-dossiers-fichiers` `#/tache/cours-partition-formater-monter` `#/tache/cours-raid1-creer` (+5) | Documentaire : relu, non exécuté |
| `touch` | Résumé Linux | `cours-creer-dossiers-fichiers`, `cours-raid1-creer`, `cr-umask` | `#/tache/cours-creer-dossiers-fichiers` `#/tache/cours-raid1-creer` `#/tache/cr-umask` | Documentaire : relu, non exécuté |
| `cp` | Résumé Linux | `cours-copier-deplacer`, `cours-partition-formater-monter`, `cours-quotas-utilisateur`, `cours-raid1-creer` (+2) | `#/tache/cours-copier-deplacer` `#/tache/cours-partition-formater-monter` `#/tache/cours-quotas-utilisateur` `#/tache/cours-raid1-creer` (+2) | Documentaire : relu, non exécuté |
| `mv` | Résumé Linux | `cours-copier-deplacer` | `#/tache/cours-copier-deplacer` | Documentaire : relu, non exécuté |
| `rm` | Résumé Linux | `cours-supprimer-prudemment` | `#/tache/cours-supprimer-prudemment` | Documentaire : relu, non exécuté |
| `rmdir` | Résumé Linux | `cours-supprimer-prudemment` | `#/tache/cours-supprimer-prudemment` | Documentaire : relu, non exécuté |
| `ln` | S10.2 | `cours-liens` | `#/tache/cours-liens` | Documentaire : relu, non exécuté |
| `file` | S10.1 | `cours-identifier-fichier` | `#/tache/cours-identifier-fichier` | Documentaire : relu, non exécuté |
| `stat` | Formatif 7 | `cours-droits-dossier-partage`, `cours-identifier-fichier`, `cr-find-inscriptible`, `cr-find-setuid` (+9) | `#/tache/cours-droits-dossier-partage` `#/tache/cours-identifier-fichier` `#/tache/cr-find-inscriptible` `#/tache/cr-find-setuid` (+9) | Documentaire : relu, non exécuté |
| `find` | S10.1 | `cours-find-fichiers`, `cr-find-inscriptible`, `cr-find-setuid`, `cr-netplan-generate` | `#/tache/cours-find-fichiers` `#/tache/cr-find-inscriptible` `#/tache/cr-find-setuid` `#/tache/cr-netplan-generate` | Documentaire : relu, non exécuté |
| `locate` | S10.1 | `cours-trouver-commande` | `#/tache/cours-trouver-commande` | Documentaire : relu, non exécuté |
| `which` | S10.1 | `cours-trouver-commande` | `#/tache/cours-trouver-commande` | Documentaire : relu, non exécuté |
| `tar` | S10.1 | `cours-archives` | `#/tache/cours-archives` | Documentaire : relu, non exécuté |
| `gzip` | S10.1 | `cours-gzip-fichier` | `#/tache/cours-gzip-fichier` | Documentaire : relu, non exécuté |

## Lire, chercher et filtrer du texte

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `cat` | Résumé Linux | `cours-bash-boucles`, `cours-bash-condition`, `cours-bash-fonctions`, `cours-creer-dossiers-fichiers` (+13) | `#/tache/cours-bash-boucles` `#/tache/cours-bash-condition` `#/tache/cours-bash-fonctions` `#/tache/cours-creer-dossiers-fichiers` (+13) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `more` | Résumé Linux | `cours-comparer-trier` | `#/tache/cours-comparer-trier` | Documentaire : relu, non exécuté |
| `head` | Résumé Linux | `cours-lire-fichiers`, `cours-processus`, `cr-getfacl-releve`, `cr-ssh-test-config` (+1) | `#/tache/cours-lire-fichiers` `#/tache/cours-processus` `#/tache/cr-getfacl-releve` `#/tache/cr-ssh-test-config` (+1) | Documentaire : relu, non exécuté |
| `tail` | Résumé Linux | `cours-lire-fichiers` | `#/tache/cours-lire-fichiers` | Documentaire : relu, non exécuté |
| `wc` | Résumé Linux | `cours-grep-wc` | `#/tache/cours-grep-wc` | Documentaire : relu, non exécuté |
| `grep` | Résumé Linux | `cours-grep-wc`, `cours-processus`, `cours-samba-import-csv`, `cours-ubuntu-jonction-ad` (+24) | `#/tache/cours-grep-wc` `#/tache/cours-processus` `#/tache/cours-samba-import-csv` `#/tache/cours-ubuntu-jonction-ad` (+24) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `sort` | Résumé Linux | `cours-comparer-trier`, `cours-redirections-tubes`, `linux-espace-disque` | `#/tache/cours-comparer-trier` `#/tache/cours-redirections-tubes` `#/tache/linux-espace-disque` | Documentaire : relu, non exécuté |
| `cut` | Résumé Linux | `cours-redirections-tubes`, `cr-passwd-etat` | `#/tache/cours-redirections-tubes` `#/tache/cr-passwd-etat` | Documentaire : relu, non exécuté |
| `awk` | Résumé Linux | `cr-nfs-ecoute` | `#/tache/cr-nfs-ecoute` | Documentaire : relu, non exécuté |
| `diff` | Résumé Linux | `cours-archives`, `cours-comparer-trier` | `#/tache/cours-archives` `#/tache/cours-comparer-trier` | Documentaire : relu, non exécuté |
| `tr` | Résumé Linux | `cours-comparer-trier` | `#/tache/cours-comparer-trier` | Documentaire : relu, non exécuté |
| `echo` | Résumé Linux | `cours-afficher-texte`, `cours-bash-boucles`, `cours-bash-condition`, `cours-bash-fonctions` (+8) | `#/tache/cours-afficher-texte` `#/tache/cours-bash-boucles` `#/tache/cours-bash-condition` `#/tache/cours-bash-fonctions` (+8) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |

## Comptes, groupes et droits

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `id` | Résumé Linux | `cours-creer-compte-local`, `cours-groupes-locaux`, `cours-sessions-utilisateurs`, `cours-ubuntu-jonction-ad` (+2) | `#/tache/cours-creer-compte-local` `#/tache/cours-groupes-locaux` `#/tache/cours-sessions-utilisateurs` `#/tache/cours-ubuntu-jonction-ad` (+2) | Documentaire : relu, non exécuté |
| `whoami` | Formatif 7 | `cours-windows-connexion-domaine` | `#/tache/cours-windows-connexion-domaine` | Documentaire : relu, non exécuté |
| `who` | S10.1 | `cours-arret-redemarrage`, `cours-sessions-utilisateurs`, `cours-supprimer-compte-local` | `#/tache/cours-arret-redemarrage` `#/tache/cours-sessions-utilisateurs` `#/tache/cours-supprimer-compte-local` | Documentaire : relu, non exécuté |
| `groups` | Résumé Linux | `cours-sessions-utilisateurs` | `#/tache/cours-sessions-utilisateurs` | Documentaire : relu, non exécuté |
| `last` | S10.1 | `cours-sessions-utilisateurs` | `#/tache/cours-sessions-utilisateurs` | Documentaire : relu, non exécuté |
| `useradd` | Résumé Linux | `cours-creer-compte-local` | `#/tache/cours-creer-compte-local` | Documentaire : relu, non exécuté |
| `usermod` | Résumé Linux | `cours-groupes-locaux` | `#/tache/cours-groupes-locaux` | Documentaire : relu, non exécuté |
| `userdel` | S10.1 | `cours-supprimer-compte-local` | `#/tache/cours-supprimer-compte-local` | Documentaire : relu, non exécuté |
| `passwd` | Résumé Linux | `cours-creer-compte-local`, `cr-passwd-etat` | `#/tache/cours-creer-compte-local` `#/tache/cr-passwd-etat` | Documentaire : relu, non exécuté |
| `chmod` | Résumé Linux | `cours-bash-boucles`, `cours-bash-condition`, `cours-bash-fonctions`, `cours-droits-dossier-partage` (+4) | `#/tache/cours-bash-boucles` `#/tache/cours-bash-condition` `#/tache/cours-bash-fonctions` `#/tache/cours-droits-dossier-partage` (+4) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `chown` | Résumé Linux | `cours-donner-dossier-compte` | `#/tache/cours-donner-dossier-compte` | Documentaire : relu, non exécuté |
| `su` | Résumé Linux | `cours-ubuntu-jonction-ad` | `#/tache/cours-ubuntu-jonction-ad` | Documentaire : relu, non exécuté |
| `sudo` | Résumé Linux | `cours-donner-dossier-compte`, `cours-samba-import-csv` | `#/tache/cours-donner-dossier-compte` `#/tache/cours-samba-import-csv` | Documentaire ; script d’import exécuté contre un FAUX samba-tool |

## Services, processus et journaux

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `systemctl` | Cours Samba | `cours-service-ancien`, `cours-ubuntu-jonction-ad`, `cr-ad-ports`, `cr-cockpit-ecoute` (+15) | `#/tache/cours-service-ancien` `#/tache/cours-ubuntu-jonction-ad` `#/tache/cr-ad-ports` `#/tache/cr-cockpit-ecoute` (+15) | Documentaire : relu, non exécuté |
| `service` | Résumé Linux | `cours-service-ancien` | `#/tache/cours-service-ancien` | Documentaire : relu, non exécuté |
| `ps` | S10.1 | `cours-processus` | `#/tache/cours-processus` | Documentaire : relu, non exécuté |
| `top` | S10.1 | `cours-processus` | `#/tache/cours-processus` | Documentaire : relu, non exécuté |
| `kill` | S10.1 | `cours-processus` | `#/tache/cours-processus` | Documentaire : relu, non exécuté |
| `free` | S10.1 | `cours-etat-systeme` | `#/tache/cours-etat-systeme` | Documentaire : relu, non exécuté |
| `shutdown` | S10.1 | `cours-arret-redemarrage` | `#/tache/cours-arret-redemarrage` | Documentaire : relu, non exécuté |
| `at` | S10.1 | `cours-planifier-taches` | `#/tache/cours-planifier-taches` | Documentaire : relu, non exécuté |
| `crontab` | S10.1 | `cours-planifier-taches` | `#/tache/cours-planifier-taches` | Documentaire : relu, non exécuté |
| `journalctl` | catalogue | `cours-ubuntu-jonction-ad`, `cr-cockpit-certificats`, `cr-cockpit-journal`, `cr-journalctl-erreurs` (+12) | `#/tache/cours-ubuntu-jonction-ad` `#/tache/cr-cockpit-certificats` `#/tache/cr-cockpit-journal` `#/tache/cr-journalctl-erreurs` (+12) | Documentaire : relu, non exécuté |
| `date` | Résumé Linux | `cours-redirections-tubes` | `#/tache/cours-redirections-tubes` | Documentaire : relu, non exécuté |

## Réseau

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `ip` | S1 | `cours-ifconfig-ancien`, `cours-ubuntu-jonction-ad`, `cours-ubuntu-reseau-client`, `cr-ad-hosts` (+10) | `#/tache/cours-ifconfig-ancien` `#/tache/cours-ubuntu-jonction-ad` `#/tache/cours-ubuntu-reseau-client` `#/tache/cr-ad-hosts` (+10) | Documentaire : relu, non exécuté |
| `ifconfig` | S1 | `cours-ifconfig-ancien` | `#/tache/cours-ifconfig-ancien` | Documentaire : relu, non exécuté |
| `ping` | S1 | `cours-ubuntu-reseau-client`, `cr-ip-neigh`, `cr-ping`, `cr-tracepath` (+3) | `#/tache/cours-ubuntu-reseau-client` `#/tache/cr-ip-neigh` `#/tache/cr-ping` `#/tache/cr-tracepath` (+3) | Documentaire : relu, non exécuté |
| `netplan` | S1 | `cours-ubuntu-jonction-ad`, `cr-netplan-generate`, `cr-netplan-try` | `#/tache/cours-ubuntu-jonction-ad` `#/tache/cr-netplan-generate` `#/tache/cr-netplan-try` | Documentaire : relu, non exécuté |
| `host` | S1 | `cr-ad-a`, `cr-ad-srv-kerberos`, `cr-ad-srv-ldap` | `#/tache/cr-ad-a` `#/tache/cr-ad-srv-kerberos` `#/tache/cr-ad-srv-ldap` | Documentaire : relu, non exécuté |
| `smbclient` | Cours Samba | `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs`, `cours-smbclient-transferts`, `cours-ubuntu-acces-partage` (+2) | `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` `#/tache/cours-smbclient-transferts` `#/tache/cours-ubuntu-acces-partage` (+2) | Documentaire : relu, non exécuté |

## Stockage, RAID et quotas

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `fdisk` | Formatif 3 | `cours-hyperviseur-ajouter-disque`, `cours-partition-formater-monter`, `cr-fdisk-l` | `#/tache/cours-hyperviseur-ajouter-disque` `#/tache/cours-partition-formater-monter` `#/tache/cr-fdisk-l` | Documentaire : relu, non exécuté |
| `mkfs.ext4` | Formatif 3 | `cours-partition-formater-monter`, `cours-raid1-creer` | `#/tache/cours-partition-formater-monter` `#/tache/cours-raid1-creer` | Documentaire : relu, non exécuté |
| `e2label` | Formatif 3 | `cours-partition-formater-monter` | `#/tache/cours-partition-formater-monter` | Documentaire : relu, non exécuté |
| `tune2fs` | Formatif 3 | `cours-disque-entretien` | `#/tache/cours-disque-entretien` | Documentaire : relu, non exécuté |
| `fsck` | S10.1 | `cours-disque-entretien` | `#/tache/cours-disque-entretien` | Documentaire : relu, non exécuté |
| `blkid` | Formatif 3 | `cours-partition-formater-monter`, `cours-raid1-creer`, `cr-blkid`, `cr-lsblk-f` | `#/tache/cours-partition-formater-monter` `#/tache/cours-raid1-creer` `#/tache/cr-blkid` `#/tache/cr-lsblk-f` | Documentaire : relu, non exécuté |
| `df` | Formatif 3 | `cours-arret-redemarrage`, `cours-etat-systeme`, `cours-partition-formater-monter`, `cours-raid1-creer` (+3) | `#/tache/cours-arret-redemarrage` `#/tache/cours-etat-systeme` `#/tache/cours-partition-formater-monter` `#/tache/cours-raid1-creer` (+3) | Documentaire : relu, non exécuté |
| `du` | Résumé Linux | `cours-archives`, `cours-supprimer-compte-local`, `linux-espace-disque` | `#/tache/cours-archives` `#/tache/cours-supprimer-compte-local` `#/tache/linux-espace-disque` | Documentaire : relu, non exécuté |
| `mount` | Formatif 3 | `cours-partition-formater-monter`, `cours-quotas-utilisateur`, `cours-raid1-creer`, `cr-mount` (+2) | `#/tache/cours-partition-formater-monter` `#/tache/cours-quotas-utilisateur` `#/tache/cours-raid1-creer` `#/tache/cr-mount` (+2) | Documentaire : relu, non exécuté |
| `umount` | Formatif 3 | `cours-disque-entretien`, `cours-raid1-panne-secours`, `cr-umount` | `#/tache/cours-disque-entretien` `#/tache/cours-raid1-panne-secours` `#/tache/cr-umount` | Documentaire : relu, non exécuté |
| `partprobe` | Formatif 3 | `cours-partition-formater-monter` | `#/tache/cours-partition-formater-monter` | Documentaire : relu, non exécuté |
| `mdadm` | Formatif 4 | `cours-raid1-creer`, `cours-raid1-panne-secours`, `cr-mdadm-detail`, `cr-mdadm-detail-scan` (+2) | `#/tache/cours-raid1-creer` `#/tache/cours-raid1-panne-secours` `#/tache/cr-mdadm-detail` `#/tache/cr-mdadm-detail-scan` (+2) | Documentaire : relu, non exécuté |
| `quotacheck` | Formatif 3 | `cours-quotas-utilisateur` | `#/tache/cours-quotas-utilisateur` | Documentaire : relu, non exécuté |
| `quotaon` | Formatif 3 | `cours-quotas-utilisateur`, `cr-quotaon` | `#/tache/cours-quotas-utilisateur` `#/tache/cr-quotaon` | Documentaire : relu, non exécuté |
| `edquota` | Formatif 3 | `cours-quota-edquota` | `#/tache/cours-quota-edquota` | Documentaire : relu, non exécuté |

## Samba et domaine

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `samba-tool` | Cours Samba | `cours-samba-dns`, `cours-samba-groupes`, `cours-samba-import-csv`, `cours-samba-partage-utilisateurs` (+3) | `#/tache/cours-samba-dns` `#/tache/cours-samba-groupes` `#/tache/cours-samba-import-csv` `#/tache/cours-samba-partage-utilisateurs` (+3) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `testparm` | Cours Samba | `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs`, `cr-samba-acces-hote`, `cr-samba-permissions` (+3) | `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` `#/tache/cr-samba-acces-hote` `#/tache/cr-samba-permissions` (+3) | Documentaire : relu, non exécuté |
| `smbstatus` | Cours Samba | `cours-samba-connexions` | `#/tache/cours-samba-connexions` | Documentaire : relu, non exécuté |
| `smbcontrol` | Cours Samba | `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs`, `cr-samba-sections` | `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` `#/tache/cr-samba-sections` | Documentaire : relu, non exécuté |
| `wbinfo` | Cours Samba | `cours-samba-groupes`, `cours-samba-partage-groupe` | `#/tache/cours-samba-groupes` `#/tache/cours-samba-partage-groupe` | Documentaire : relu, non exécuté |
| `net` | Cours Samba | `cours-windows-acces-partage`, `redemarrer-service-windows` | `#/tache/cours-windows-acces-partage` `#/tache/redemarrer-service-windows` | Documentaire : relu, non exécuté |

## Bash

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `read` | S2 | `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs` | `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` | Documentaire : relu, non exécuté |
| `exit` | S2 | `cours-samba-import-csv`, `scenario-cisco-inter-vlan-routeur` | `#/tache/cours-samba-import-csv` `#/tache/scenario-cisco-inter-vlan-routeur` | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `printf` | S2 | `cours-afficher-texte` | `#/tache/cours-afficher-texte` | Documentaire : relu, non exécuté |

