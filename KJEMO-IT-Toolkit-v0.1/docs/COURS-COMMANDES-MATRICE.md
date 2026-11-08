# Matrice des commandes du cours → fiche → route → état réel

Produite par `node test/matrice-commandes-cours.mjs --ecrire` ; `--verifier` échoue si ce fichier est périmé, et le banc échoue si une commande déclarée n’a aucune route dans le catalogue. **« Couverte » veut dire : une fiche rédigée à la main ou une commande rapide contient cette commande dans une ligne à copier. Ce n’est pas une exécution : aucune commande n’a été lancée sur une machine réelle** (Ubuntu, Windows, Samba, RAID : NON EXÉCUTÉ).

Commandes suivies : 83 · avec route : 83 · sans route : 0.

## Fichiers et dossiers

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `pwd` | Résumé Linux | `cours-se-reperer`, `linux-sudo-su-expliquer` | `#/tache/cours-se-reperer` `#/tache/linux-sudo-su-expliquer` | Documentaire : relu, non exécuté |
| `ls` | Résumé Linux | `cours-archives`, `cours-copier-deplacer`, `cours-creer-compte-local`, `cours-creer-dossiers-fichiers` (+26) | `#/tache/cours-archives` `#/tache/cours-copier-deplacer` `#/tache/cours-creer-compte-local` `#/tache/cours-creer-dossiers-fichiers` (+26) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `cd` | Résumé Linux | `cours-partition-formater-monter`, `cours-raid1-creer`, `cours-se-reperer`, `cours-smbclient-transferts` | `#/tache/cours-partition-formater-monter` `#/tache/cours-raid1-creer` `#/tache/cours-se-reperer` `#/tache/cours-smbclient-transferts` | Documentaire : relu, non exécuté |
| `mkdir` | Résumé Linux | `cours-archives`, `cours-creer-dossiers-fichiers`, `cours-partition-formater-monter`, `cours-raid1-creer` (+7) | `#/tache/cours-archives` `#/tache/cours-creer-dossiers-fichiers` `#/tache/cours-partition-formater-monter` `#/tache/cours-raid1-creer` (+7) | Documentaire : relu, non exécuté |
| `touch` | Résumé Linux | `cours-creer-dossiers-fichiers`, `cours-droits-fichier`, `cours-raid1-creer`, `cr-umask` | `#/tache/cours-creer-dossiers-fichiers` `#/tache/cours-droits-fichier` `#/tache/cours-raid1-creer` `#/tache/cr-umask` | Documentaire : relu, non exécuté |
| `cp` | Résumé Linux | `cours-copier-deplacer`, `cours-partition-formater-monter`, `cours-quotas-utilisateur`, `cours-raid1-creer` (+5) | `#/tache/cours-copier-deplacer` `#/tache/cours-partition-formater-monter` `#/tache/cours-quotas-utilisateur` `#/tache/cours-raid1-creer` (+5) | Documentaire : relu, non exécuté |
| `mv` | Résumé Linux | `cours-copier-deplacer`, `linux-hostname-changer`, `linux-sed-remplacer`, `samba-ad-installer` | `#/tache/cours-copier-deplacer` `#/tache/linux-hostname-changer` `#/tache/linux-sed-remplacer` `#/tache/samba-ad-installer` | Documentaire : relu, non exécuté |
| `rm` | Résumé Linux | `cours-donner-dossier-compte`, `cours-smbclient-transferts`, `cours-supprimer-prudemment`, `cours-ubuntu-jonction-ad` (+3) | `#/tache/cours-donner-dossier-compte` `#/tache/cours-smbclient-transferts` `#/tache/cours-supprimer-prudemment` `#/tache/cours-ubuntu-jonction-ad` (+3) | Documentaire : relu, non exécuté |
| `rmdir` | Résumé Linux | `cours-partition-formater-monter`, `cours-samba-partage-utilisateurs`, `cours-supprimer-prudemment`, `samba-partage-parcourir` | `#/tache/cours-partition-formater-monter` `#/tache/cours-samba-partage-utilisateurs` `#/tache/cours-supprimer-prudemment` `#/tache/samba-partage-parcourir` | Documentaire : relu, non exécuté |
| `ln` | S10.2 | `cours-liens`, `samba-ad-installer` | `#/tache/cours-liens` `#/tache/samba-ad-installer` | Documentaire : relu, non exécuté |
| `file` | S10.1 | `cours-identifier-fichier`, `linux-fins-ligne-windows` | `#/tache/cours-identifier-fichier` `#/tache/linux-fins-ligne-windows` | Documentaire : relu, non exécuté |
| `stat` | Formatif 7 | `cours-droits-dossier-partage`, `cours-identifier-fichier`, `cr-find-inscriptible`, `cr-find-setuid` (+9) | `#/tache/cours-droits-dossier-partage` `#/tache/cours-identifier-fichier` `#/tache/cr-find-inscriptible` `#/tache/cr-find-setuid` (+9) | Documentaire : relu, non exécuté |
| `find` | S10.1 | `cours-find-fichiers`, `cr-find-inscriptible`, `cr-find-setuid`, `cr-netplan-generate` | `#/tache/cours-find-fichiers` `#/tache/cr-find-inscriptible` `#/tache/cr-find-setuid` `#/tache/cr-netplan-generate` | Documentaire : relu, non exécuté |
| `locate` | S10.1 | `cours-trouver-commande` | `#/tache/cours-trouver-commande` | Documentaire : relu, non exécuté |
| `which` | S10.1 | `cours-trouver-commande` | `#/tache/cours-trouver-commande` | Documentaire : relu, non exécuté |
| `tar` | S10.1 | `cours-archives`, `win-archive-creer`, `win-archive-extraire` | `#/tache/cours-archives` `#/tache/win-archive-creer` `#/tache/win-archive-extraire` | Documentaire : relu, non exécuté |
| `gzip` | S10.1 | `cours-gzip-fichier` | `#/tache/cours-gzip-fichier` | Documentaire : relu, non exécuté |

## Lire, chercher et filtrer du texte

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `cat` | Résumé Linux | `cours-bash-boucles`, `cours-bash-condition`, `cours-bash-fonctions`, `cours-bash-menu` (+19) | `#/tache/cours-bash-boucles` `#/tache/cours-bash-condition` `#/tache/cours-bash-fonctions` `#/tache/cours-bash-menu` (+19) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `more` | Résumé Linux | `cours-comparer-trier` | `#/tache/cours-comparer-trier` | Documentaire : relu, non exécuté |
| `head` | Résumé Linux | `cours-lire-fichiers`, `cours-processus`, `cours-samba-script-menu`, `cr-getfacl-releve` (+3) | `#/tache/cours-lire-fichiers` `#/tache/cours-processus` `#/tache/cours-samba-script-menu` `#/tache/cr-getfacl-releve` (+3) | Documentaire : relu, non exécuté |
| `tail` | Résumé Linux | `cours-lire-fichiers` | `#/tache/cours-lire-fichiers` | Documentaire : relu, non exécuté |
| `wc` | Résumé Linux | `cours-find-fichiers`, `cours-grep-wc`, `linux-sed-lignes`, `samba-compte-voir` | `#/tache/cours-find-fichiers` `#/tache/cours-grep-wc` `#/tache/linux-sed-lignes` `#/tache/samba-compte-voir` | Documentaire : relu, non exécuté |
| `grep` | Résumé Linux | `cours-grep-wc`, `cours-processus`, `cours-samba-import-csv`, `cours-ubuntu-jonction-ad` (+35) | `#/tache/cours-grep-wc` `#/tache/cours-processus` `#/tache/cours-samba-import-csv` `#/tache/cours-ubuntu-jonction-ad` (+35) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `sort` | Résumé Linux | `cours-comparer-trier`, `cours-redirections-tubes`, `linux-csv-colonne`, `linux-csv-verifier` (+1) | `#/tache/cours-comparer-trier` `#/tache/cours-redirections-tubes` `#/tache/linux-csv-colonne` `#/tache/linux-csv-verifier` (+1) | Documentaire : relu, non exécuté |
| `cut` | Résumé Linux | `cours-redirections-tubes`, `cr-passwd-etat`, `linux-csv-colonne` | `#/tache/cours-redirections-tubes` `#/tache/cr-passwd-etat` `#/tache/linux-csv-colonne` | Documentaire : relu, non exécuté |
| `awk` | Résumé Linux | `cr-nfs-ecoute`, `linux-comptes-locaux-lister`, `linux-csv-verifier`, `linux-groupes-locaux-lister` | `#/tache/cr-nfs-ecoute` `#/tache/linux-comptes-locaux-lister` `#/tache/linux-csv-verifier` `#/tache/linux-groupes-locaux-lister` | Documentaire : relu, non exécuté |
| `diff` | Résumé Linux | `cours-archives`, `cours-comparer-trier`, `linux-sed-remplacer` | `#/tache/cours-archives` `#/tache/cours-comparer-trier` `#/tache/linux-sed-remplacer` | Documentaire : relu, non exécuté |
| `tr` | Résumé Linux | `cours-comparer-trier` | `#/tache/cours-comparer-trier` | Documentaire : relu, non exécuté |
| `echo` | Résumé Linux | `cours-afficher-texte`, `cours-bash-boucles`, `cours-bash-condition`, `cours-bash-fonctions` (+15) | `#/tache/cours-afficher-texte` `#/tache/cours-bash-boucles` `#/tache/cours-bash-condition` `#/tache/cours-bash-fonctions` (+15) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |

## Comptes, groupes et droits

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `id` | Résumé Linux | `cours-bash-menu`, `cours-creer-compte-local`, `cours-groupes-locaux`, `cours-sessions-utilisateurs` (+9) | `#/tache/cours-bash-menu` `#/tache/cours-creer-compte-local` `#/tache/cours-groupes-locaux` `#/tache/cours-sessions-utilisateurs` (+9) | Documentaire : relu, non exécuté |
| `whoami` | Formatif 7 | `cours-windows-connexion-domaine`, `linux-sudo-su-expliquer`, `linux-systeme-identite`, `win-nom-poste-utilisateur` (+1) | `#/tache/cours-windows-connexion-domaine` `#/tache/linux-sudo-su-expliquer` `#/tache/linux-systeme-identite` `#/tache/win-nom-poste-utilisateur` (+1) | Documentaire : relu, non exécuté |
| `who` | S10.1 | `cours-arret-redemarrage`, `cours-sessions-utilisateurs`, `cours-supprimer-compte-local`, `linux-kiosque-configurer` | `#/tache/cours-arret-redemarrage` `#/tache/cours-sessions-utilisateurs` `#/tache/cours-supprimer-compte-local` `#/tache/linux-kiosque-configurer` | Documentaire : relu, non exécuté |
| `groups` | Résumé Linux | `cours-groupes-locaux`, `cours-sessions-utilisateurs`, `linux-groupes-locaux-lister` | `#/tache/cours-groupes-locaux` `#/tache/cours-sessions-utilisateurs` `#/tache/linux-groupes-locaux-lister` | Documentaire : relu, non exécuté |
| `last` | S10.1 | `cours-sessions-utilisateurs` | `#/tache/cours-sessions-utilisateurs` | Documentaire : relu, non exécuté |
| `useradd` | Résumé Linux | `cours-creer-compte-local` | `#/tache/cours-creer-compte-local` | Documentaire : relu, non exécuté |
| `usermod` | Résumé Linux | `cours-groupes-locaux` | `#/tache/cours-groupes-locaux` | Documentaire : relu, non exécuté |
| `userdel` | S10.1 | `cours-creer-compte-local`, `cours-supprimer-compte-local` | `#/tache/cours-creer-compte-local` `#/tache/cours-supprimer-compte-local` | Documentaire : relu, non exécuté |
| `passwd` | Résumé Linux | `cours-creer-compte-local`, `cr-passwd-etat`, `linux-comptes-locaux-lister`, `linux-mot-de-passe-local` | `#/tache/cours-creer-compte-local` `#/tache/cr-passwd-etat` `#/tache/linux-comptes-locaux-lister` `#/tache/linux-mot-de-passe-local` | Documentaire : relu, non exécuté |
| `chmod` | Résumé Linux | `cours-bash-boucles`, `cours-bash-condition`, `cours-bash-fonctions`, `cours-bash-menu` (+9) | `#/tache/cours-bash-boucles` `#/tache/cours-bash-condition` `#/tache/cours-bash-fonctions` `#/tache/cours-bash-menu` (+9) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `chown` | Résumé Linux | `cours-donner-dossier-compte` | `#/tache/cours-donner-dossier-compte` | Documentaire : relu, non exécuté |
| `su` | Résumé Linux | `cours-ubuntu-jonction-ad`, `linux-sudo-su-expliquer` | `#/tache/cours-ubuntu-jonction-ad` `#/tache/linux-sudo-su-expliquer` | Documentaire : relu, non exécuté |
| `sudo` | Résumé Linux | `cours-donner-dossier-compte`, `cours-samba-import-csv`, `cours-samba-script-menu`, `linux-kiosque-configurer` (+1) | `#/tache/cours-donner-dossier-compte` `#/tache/cours-samba-import-csv` `#/tache/cours-samba-script-menu` `#/tache/linux-kiosque-configurer` (+1) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |

## Services, processus et journaux

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `systemctl` | Cours Samba | `cours-service-ancien`, `cours-ubuntu-jonction-ad`, `cours-ubuntu-jonction-ad-graphique`, `cr-ad-ports` (+18) | `#/tache/cours-service-ancien` `#/tache/cours-ubuntu-jonction-ad` `#/tache/cours-ubuntu-jonction-ad-graphique` `#/tache/cr-ad-ports` (+18) | Documentaire : relu, non exécuté |
| `service` | Résumé Linux | `cours-base-peripherique`, `cours-service-ancien` | `#/tache/cours-base-peripherique` `#/tache/cours-service-ancien` | Documentaire : relu, non exécuté |
| `ps` | S10.1 | `cours-processus` | `#/tache/cours-processus` | Documentaire : relu, non exécuté |
| `top` | S10.1 | `cours-processus` | `#/tache/cours-processus` | Documentaire : relu, non exécuté |
| `kill` | S10.1 | `cours-processus` | `#/tache/cours-processus` | Documentaire : relu, non exécuté |
| `free` | S10.1 | `cours-etat-systeme` | `#/tache/cours-etat-systeme` | Documentaire : relu, non exécuté |
| `shutdown` | S10.1 | `cours-arret-redemarrage`, `cours-dhcp4-client-routeur`, `cours-ec-depanner`, `cours-ec-lacp` (+8) | `#/tache/cours-arret-redemarrage` `#/tache/cours-dhcp4-client-routeur` `#/tache/cours-ec-depanner` `#/tache/cours-ec-lacp` (+8) | Documentaire : relu, non exécuté |
| `at` | S10.1 | `cours-planifier-taches` | `#/tache/cours-planifier-taches` | Documentaire : relu, non exécuté |
| `crontab` | S10.1 | `cours-planifier-taches` | `#/tache/cours-planifier-taches` | Documentaire : relu, non exécuté |
| `journalctl` | catalogue | `cours-ubuntu-jonction-ad`, `cr-cockpit-certificats`, `cr-cockpit-journal`, `cr-journalctl-erreurs` (+12) | `#/tache/cours-ubuntu-jonction-ad` `#/tache/cr-cockpit-certificats` `#/tache/cr-cockpit-journal` `#/tache/cr-journalctl-erreurs` (+12) | Documentaire : relu, non exécuté |
| `date` | Résumé Linux | `cours-redirections-tubes` | `#/tache/cours-redirections-tubes` | Documentaire : relu, non exécuté |

## Réseau

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `ip` | S1 | `cours-base-peripherique`, `cours-dhcp4-client-routeur`, `cours-dhcp4-relais`, `cours-dhcp4-serveur-routeur` (+28) | `#/tache/cours-base-peripherique` `#/tache/cours-dhcp4-client-routeur` `#/tache/cours-dhcp4-relais` `#/tache/cours-dhcp4-serveur-routeur` (+28) | Documentaire : relu, non exécuté |
| `ifconfig` | S1 | `cours-ifconfig-ancien` | `#/tache/cours-ifconfig-ancien` | Documentaire : relu, non exécuté |
| `ping` | S1 | `cours-ipv6-verifier`, `cours-rt-tester`, `cours-sw-gestion-ip`, `cours-tp-vlan-ssh-intervlan` (+9) | `#/tache/cours-ipv6-verifier` `#/tache/cours-rt-tester` `#/tache/cours-sw-gestion-ip` `#/tache/cours-tp-vlan-ssh-intervlan` (+9) | Documentaire : relu, non exécuté |
| `netplan` | S1 | `cours-ubuntu-jonction-ad`, `cr-netplan-generate`, `cr-netplan-try`, `samba-ad-installer` | `#/tache/cours-ubuntu-jonction-ad` `#/tache/cr-netplan-generate` `#/tache/cr-netplan-try` `#/tache/samba-ad-installer` | Documentaire : relu, non exécuté |
| `host` | S1 | `cr-ad-a`, `cr-ad-srv-kerberos`, `cr-ad-srv-ldap` | `#/tache/cr-ad-a` `#/tache/cr-ad-srv-kerberos` `#/tache/cr-ad-srv-ldap` | Documentaire : relu, non exécuté |
| `smbclient` | Cours Samba | `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs`, `cours-smbclient-transferts`, `cours-ubuntu-acces-partage` (+3) | `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` `#/tache/cours-smbclient-transferts` `#/tache/cours-ubuntu-acces-partage` (+3) | Documentaire : relu, non exécuté |

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
| `mount` | Formatif 3 | `cours-partition-formater-monter`, `cours-quotas-utilisateur`, `cours-raid1-creer`, `cr-mount` (+4) | `#/tache/cours-partition-formater-monter` `#/tache/cours-quotas-utilisateur` `#/tache/cours-raid1-creer` `#/tache/cr-mount` (+4) | Documentaire : relu, non exécuté |
| `umount` | Formatif 3 | `cours-disque-entretien`, `cours-partition-formater-monter`, `cours-raid1-creer`, `cours-raid1-panne-secours` (+4) | `#/tache/cours-disque-entretien` `#/tache/cours-partition-formater-monter` `#/tache/cours-raid1-creer` `#/tache/cours-raid1-panne-secours` (+4) | Documentaire : relu, non exécuté |
| `partprobe` | Formatif 3 | `cours-partition-formater-monter` | `#/tache/cours-partition-formater-monter` | Documentaire : relu, non exécuté |
| `mdadm` | Formatif 4 | `cours-raid1-creer`, `cours-raid1-panne-secours`, `cr-mdadm-detail`, `cr-mdadm-detail-scan` (+2) | `#/tache/cours-raid1-creer` `#/tache/cours-raid1-panne-secours` `#/tache/cr-mdadm-detail` `#/tache/cr-mdadm-detail-scan` (+2) | Documentaire : relu, non exécuté |
| `quotacheck` | Formatif 3 | `cours-quotas-utilisateur` | `#/tache/cours-quotas-utilisateur` | Documentaire : relu, non exécuté |
| `quotaon` | Formatif 3 | `cours-quotas-utilisateur`, `cr-quotaoff`, `cr-quotaon` | `#/tache/cours-quotas-utilisateur` `#/tache/cr-quotaoff` `#/tache/cr-quotaon` | Documentaire : relu, non exécuté |
| `edquota` | Formatif 3 | `cours-quota-edquota` | `#/tache/cours-quota-edquota` | Documentaire : relu, non exécuté |

## Samba et domaine

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `samba-tool` | Cours Samba | `cours-samba-dns`, `cours-samba-groupes`, `cours-samba-import-csv`, `cours-samba-partage-utilisateurs` (+12) | `#/tache/cours-samba-dns` `#/tache/cours-samba-groupes` `#/tache/cours-samba-import-csv` `#/tache/cours-samba-partage-utilisateurs` (+12) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `testparm` | Cours Samba | `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs`, `cr-samba-acces-hote`, `cr-samba-permissions` (+5) | `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` `#/tache/cr-samba-acces-hote` `#/tache/cr-samba-permissions` (+5) | Documentaire : relu, non exécuté |
| `smbstatus` | Cours Samba | `cours-samba-connexions` | `#/tache/cours-samba-connexions` | Documentaire : relu, non exécuté |
| `smbcontrol` | Cours Samba | `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs`, `cr-samba-sections` | `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` `#/tache/cr-samba-sections` | Documentaire : relu, non exécuté |
| `wbinfo` | Cours Samba | `cours-samba-groupes`, `cours-samba-partage-groupe` | `#/tache/cours-samba-groupes` `#/tache/cours-samba-partage-groupe` | Documentaire : relu, non exécuté |
| `net` | Cours Samba | `cours-windows-acces-partage`, `redemarrer-service-windows`, `win-partage-connecter` | `#/tache/cours-windows-acces-partage` `#/tache/redemarrer-service-windows` `#/tache/win-partage-connecter` | Documentaire : relu, non exécuté |

## Bash

| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |
|---|---|---|---|---|
| `read` | S2 | `cours-afficher-texte`, `cours-bash-menu`, `cours-samba-partage-groupe`, `cours-samba-partage-utilisateurs` (+1) | `#/tache/cours-afficher-texte` `#/tache/cours-bash-menu` `#/tache/cours-samba-partage-groupe` `#/tache/cours-samba-partage-utilisateurs` (+1) | Documentaire : relu, non exécuté |
| `exit` | S2 | `cours-base-peripherique`, `cours-bash-condition`, `cours-dhcp4-serveur-routeur`, `cours-dhcp6-avec-etat` (+6) | `#/tache/cours-base-peripherique` `#/tache/cours-bash-condition` `#/tache/cours-dhcp4-serveur-routeur` `#/tache/cours-dhcp6-avec-etat` (+6) | Documentaire ; script d’import exécuté contre un FAUX samba-tool |
| `printf` | S2 | `cours-afficher-texte`, `cours-bash-menu`, `cours-samba-script-menu`, `linux-kiosque-configurer` (+1) | `#/tache/cours-afficher-texte` `#/tache/cours-bash-menu` `#/tache/cours-samba-script-menu` `#/tache/linux-kiosque-configurer` (+1) | Documentaire : relu, non exécuté |

