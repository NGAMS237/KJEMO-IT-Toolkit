# Inventaire de couverture UX-COMMANDES-PROCEDURES-01 / 02

Chiffres calculés par `couverture()` (dist/taches.mjs) ; aucune fiche n'a été inventée pour gonfler ces nombres. **Couverture partielle : les 211 assistants ne sont pas tous couverts par une fiche courte.**

- Assistants complets (routes #/outil/<id> inchangées) : 211
- Fiches rédigées : 39, dont 4 scénarios multi-équipements et 35 fiches élémentaires
- Commandes rapides adaptées (LOT 7) : 112
- Assistants reliés à une fiche ou à une commande rapide : 56
- Assistants accessibles uniquement par l'assistant complet : 155
- Entrées listées au catalogue (fiches + commandes + assistants non repliés sous une fiche) : 335
- Fiches par plateforme (un scénario multi-plateforme compte dans chacune) : Cisco 10, Linux 9, Windows 25, Azure 4

## Fiches

- cisco-creer-vlan — Créer un VLAN (procedure)
- cisco-affecter-port-vlan — Mettre un port dans un VLAN (procedure)
- cisco-etat-interfaces — Voir l’état des ports du commutateur (procedure)
- cisco-enregistrer-config — Enregistrer la configuration du commutateur (procedure)
- linux-voir-ip-reseau — Voir l’IP, la passerelle et le DNS sous Linux (procedure)
- linux-etat-service — Voir l’état d’un service Linux (procedure)
- linux-redemarrer-service — Redémarrer un service Linux (procedure)
- windows-voir-ip — Voir l’adresse IP d’un poste Windows (procedure)
- windows-etat-service — Voir l’état d’un service Windows (procedure)
- vider-cache-dns — Vider le cache DNS (procedure)
- imprimantes-inventaire-windows — Lister les imprimantes, ports et pilotes (procedure)
- imprimante-file-bloquee — Débloquer une file d’impression (procedure)
- azure-contexte-courant — Vérifier le compte et l’abonnement Azure actifs (procedure)
- tester-ping — Tester si une machine répond (ping) (procedure)
- tester-port-tcp — Tester si un port TCP est ouvert (procedure)
- resoudre-nom-dns — Résoudre un nom DNS (procedure)
- renouveler-bail-dhcp — Renouveler l’adresse IP (DHCP) (procedure)
- redemarrer-service-windows — Redémarrer un service Windows (procedure)
- reparer-fichiers-systeme — Réparer les fichiers système (SFC, DISM) (procedure)
- appliquer-strategies-groupe — Forcer l’application des stratégies de groupe (procedure)
- espace-disque-windows — Voir l’espace libre des disques Windows (procedure)
- journal-evenements-windows — Lire les dernières erreurs du journal Windows (procedure)
- ad-debloquer-compte — Débloquer un compte Active Directory (procedure)
- ad-etat-replication — Voir l’état de la réplication Active Directory (procedure)
- cisco-voir-vlans — Voir les VLAN du commutateur (procedure)
- cisco-voir-trunks — Voir les liaisons trunk (procedure)
- cisco-trouver-adresse-mac — Trouver sur quel port se trouve une adresse MAC (procedure)
- azure-changer-abonnement — Choisir l’abonnement Azure actif (procedure)
- azure-lister-groupes-ressources — Lister les groupes de ressources Azure (procedure)
- azure-etat-machines-virtuelles — Voir l’état des machines virtuelles Azure (procedure)
- windows-ip-fixe — Donner une adresse IP fixe à un poste Windows (procedure)
- linux-espace-disque — Voir l’espace disque sous Linux (procedure)
- linux-ports-ecoute — Voir les ports en écoute sous Linux (procedure)
- windows-ports-ecoute — Voir les ports en écoute sous Windows (procedure)
- cisco-voir-routes — Voir les interfaces et la table de routage d’un routeur (procedure)
- scenario-cisco-ssh-commutateur — Configurer SSH sur un commutateur Cisco (scenario)
- scenario-cisco-inter-vlan-routeur — Routage inter-VLAN avec un routeur (plusieurs VLAN) (scenario)
- scenario-linux-ssh — Installer et vérifier un serveur SSH sous Linux (scenario)
- scenario-windows-diagnostic-reseau — Diagnostiquer la connexion réseau d’un poste Windows (scenario)

## Assistants accessibles uniquement par l'assistant complet

### Réseau (19)

- static-ip — Configurer une IP statique
- wifi-repair — Diagnostiquer et réinitialiser le Wi-Fi
- network-full-report — Produire un rapport réseau complet
- network-baseline — Capturer et comparer deux états réseau
- latency-packet-loss — Mesurer latence, gigue et perte de paquets
- gateway-diagnostic — Diagnostiquer la passerelle par défaut
- ip-conflict-detection — Chercher un conflit d’adresse IPv4
- adapter-metric-multihoming — Diagnostiquer cartes multiples et métriques
- dns-client-change — Changer les serveurs DNS d’une carte
- rpc-connectivity-test — Tester la connectivité RPC
- ldap-ldaps-connectivity — Tester la connectivité LDAP et LDAPS
- smb-connectivity-test — Tester la connectivité SMB
- http-https-tls-test — Tester HTTP, HTTPS et le certificat TLS
- route-table-diagnostic — Diagnostiquer la table de routage
- route-manager — Préparer et poser une route statique
- arp-neighbor-diagnostic — Diagnostiquer le voisinage ARP et IPv6
- network-share-diagnostic — Diagnostiquer un partage inaccessible
- wifi-vpn-diagnostic — Diagnostiquer le Wi-Fi ou le VPN
- ipv4-subnet-calculator — Calculer un sous-réseau IPv4

### Active Directory (16)

- ad-ou — Créer une unité d’organisation
- ad-user — Créer un utilisateur AD
- second-dc — Ajouter un deuxième contrôleur
- ad-ou-hierarchy — Créer une hiérarchie d’unités d’organisation
- ad-users-csv — Importer des utilisateurs depuis un CSV
- ad-groups — Créer et vérifier des groupes Active Directory
- ad-group-members-csv — Importer les membres de groupes depuis un CSV
- ad-home-profile-paths — Dossiers personnels et profils itinérants
- ad-account-health — État de santé des comptes du domaine
- ad-object-search-move — Rechercher et déplacer un objet Active Directory
- ad-delegation-audit — Audit des délégations sur les unités d’organisation
- ad-computer-cleanup — Recenser et mettre en quarantaine les ordinateurs inactifs
- ad-dns-health — Santé du DNS pour Active Directory
- ad-dcdiag-report — Rapport dcdiag interprété
- ad-secure-channel — Vérifier et réparer le canal sécurisé du domaine
- ad-domain-full-report — Rapport complet de santé du domaine

### Windows Server (15)

- shared-folder — Créer un dossier partagé
- server-health-report — Diagnostic complet Windows Server
- dhcp-install-authorize — Installer et autoriser un serveur DHCP
- dhcp-scope-options — Créer une étendue et configurer ses options DHCP
- dhcp-reservation — Créer une réservation DHCP
- dhcp-leases-diagnostic — Diagnostiquer les baux DHCP
- dhcp-backup — Sauvegarder la configuration DHCP
- dns-diagnostic — Diagnostiquer un serveur DNS Windows
- dns-zone — Créer une zone DNS directe ou inversée
- dns-record — Créer un enregistrement DNS
- file-permissions-audit — Auditer les permissions NTFS et SMB
- smb-sessions-diagnostic — Diagnostiquer les sessions et fichiers SMB ouverts
- internet-client-diagnostic — Diagnostiquer l’accès Internet d’un client
- ics-readiness — Préparer et vérifier un partage de connexion Internet ICS
- rras-nat-readiness — Vérifier les prérequis RRAS et NAT

### GPO (18)

- gpo-password — Politique de mots de passe du domaine
- gpo-inventory-report — Inventorier les GPO du domaine
- gpo-health-report — Diagnostiquer la santé des stratégies de groupe
- gpo-refresh-diagnostic — Actualiser et diagnostiquer gpupdate
- gpo-create-link — Créer une GPO et la lier à une OU
- gpo-link-audit — Auditer l’héritage et les liens GPO
- gpo-security-filter — Vérifier le filtrage de sécurité d’une GPO
- gpo-wmi-filter-readiness — Vérifier un filtre WMI avant association
- gpo-drive-mapping — Préparer le mappage de lecteurs réseau
- gpo-printer-deployment — Préparer le déploiement d’une imprimante
- gpo-logon-startup-scripts — Préparer des scripts de connexion et de démarrage
- gpo-folder-redirection — Préparer une redirection de dossiers
- gpo-session-desktop — Configurer verrouillage automatique et fond d’écran
- gpo-device-restrictions — Préparer les restrictions USB et périphériques
- gpo-firewall-defender — Auditer et préparer Pare-feu et Microsoft Defender par GPO
- gpo-windows-update-services — Préparer Windows Update et les services par GPO
- gpo-software-shortcuts-browser — Préparer déploiement logiciel, raccourcis et navigateur
- gpo-backup-restore-compare — Sauvegarder, comparer et restaurer une GPO

### Poste de travail Windows (30)

- workstation-inventory — Inventaire matériel et logiciel du poste
- audio-diagnostic — Diagnostiquer le son du poste
- microphone-diagnostic — Diagnostiquer le microphone
- webcam-diagnostic — Diagnostiquer la webcam
- bluetooth-diagnostic — Diagnostiquer le Bluetooth
- display-diagnostic — Diagnostiquer les écrans et la résolution
- driver-audit — Auditer les pilotes du poste
- windows-update-diagnostic — Diagnostiquer Windows Update
- windows-update-repair — Réparation encadrée de Windows Update
- application-wont-start — Diagnostiquer une application qui ne démarre pas
- process-hung — Diagnostiquer un processus bloqué
- slow-boot-diagnostic — Diagnostic du démarrage lent
- bluescreen-diagnostic — Diagnostic des écrans bleus
- user-profile-diagnostic — Diagnostic d’un profil utilisateur
- workstation-performance-report — Rapport de performance du poste
- local-accounts-audit — Audit des comptes locaux
- windows-access-recovery — Récupération d’accès Windows
- firewall-audit — Audit du pare-feu Windows
- defender-audit — Audit de Microsoft Defender
- defender-scan — Analyse Microsoft Defender encadrée
- dism-repair — Vérification et réparation avec DISM
- restore-point-create — Création d’un point de restauration
- safe-mode-preparation — Préparation au mode sans échec
- workstation-storage-diagnostic — Diagnostic du stockage du poste
- temp-cleanup — Nettoyage sécurisé des fichiers temporaires
- recycle-bin-cleanup — Nettoyage encadré de la corbeille
- browser-cache-diagnostic — Diagnostic des caches de navigateurs
- windows-domain-join-readiness — Vérifier qu’un poste Windows peut rejoindre un domaine
- windows-domain-join — Joindre un poste Windows à un domaine, sans secret et sans redémarrage automatique
- windows-domain-join-diagnostic — Diagnostiquer une jonction de domaine qui a échoué, ou un poste joint qui ne s’ouvre plus

### Linux et services réseau (11)

- linux-health-report — Rapport général de santé Linux
- linux-system-inventory — Inventaire matériel et logiciel
- linux-boot-diagnostic — Diagnostic d’un démarrage lent
- linux-log-diagnostic — Recherche guidée dans les journaux
- bash-script-starter — Squelette de script Bash robuste
- bash-file-batch — Traitement par lot d’un ensemble de fichiers
- bash-backup-directory — Sauvegarde locale datée d’un dossier
- bash-csv-report — Rapport CSV système, correctement échappé
- cron-readiness — Préparation et diagnostic d’une tâche cron
- linux-user-audit — Audit des comptes locaux
- samba-ad-dc-provision — Préparer le provisionnement d’un contrôleur de domaine, sans le lancer

### Azure et Entra ID (21)

- azure-rbac — Affectations de rôles Azure (RBAC) et diagnostic des accès
- entra-recherche — Rechercher des utilisateurs ou des groupes Microsoft Entra
- entra-appartenances — Appartenances Entra : groupes d’un utilisateur ou membres d’un groupe
- entra-roles — Rôles Microsoft Entra actifs et permissions nécessaires
- entra-mfa — Enregistrement de l’authentification multifacteur (MFA) : ce qui est lisible
- azure-vm-etat — Configuration, état et éléments de dépannage d’une machine virtuelle
- azure-vm-disques-interfaces — Diagnostic des disques managés et des interfaces réseau d’une machine
- azure-vm-demarrage — Démarrer une machine virtuelle Azure (prévisualisation, puis action confirmée)
- azure-vm-arret — Arrêter et désallouer une machine virtuelle Azure (prévisualisation, puis action confirmée)
- azure-reseau-vnets — Réseaux virtuels (VNet) et sous-réseaux : plan d’adressage et diagnostic
- azure-reseau-interfaces-ip — Interfaces réseau et adresses IP (privées et publiques)
- azure-reseau-nsg — Groupes de sécurité réseau (NSG) : règles et accès administratifs exposés
- azure-reseau-dns — DNS Azure et diagnostic de connectivité depuis le poste
- azure-stockage-inventaire — Inventaire des comptes de stockage et de leurs réglages de sécurité
- azure-stockage-exposition — Exposition et accès d’UN compte de stockage (conteneurs, réseau, protection)
- azure-sauvegarde-coffres — Coffres Recovery Services et état des sauvegardes de machines virtuelles
- azure-sauvegarde-restauration — Restaurer les disques d’une machine sauvegardée vers une cible de laboratoire distincte
- azure-journal-activite — Journal d’activité : qui a fait quoi, et ce qui a échoué
- azure-alertes-diagnostics — Alertes et paramètres de diagnostic : ce qui est surveillé
- azure-budgets — Budgets Azure : lire les alertes de dépense (pas un plafond)
- azure-ressources-inutilisees — Ressources de laboratoire potentiellement inutilisées (inventaire)

### Réseau et Cisco (12)

- cisco-modes-ios — Modes IOS, invites, aide et erreurs de contexte
- cisco-identification — Identifier un commutateur et fixer son nom et sa bannière
- cisco-console-ssh — Accès console et SSH : comptes locaux, clé, lignes vty
- cisco-gestion-ip — Adresse de gestion du commutateur : interface VLAN, passerelle, ping
- cisco-port-security-etat — Port-security : état, adresses sécurisées, violations et port bloqué
- cisco-port-security-config — Port-security : configurer UN port, ou le remettre en service après correction
- cisco-trunk-preparation — Trunk : préparer UN lien (VLAN autorisés, VLAN natif)
- cisco-dtp-simulation — DTP : simulation pédagogique (auto, desirable, access, trunk)
- cisco-vtp-diagnostic — VTP : diagnostic (mode, domaine, version, révision)
- cisco-vtp-configuration — VTP : mode, domaine et version (v1 / v2)
- cisco-vtp-raccordement — VTP : liste de contrôle avant de rejoindre un domaine existant
- cisco-parcours-diagnostic — Parcours guidés : trunk absent, VLAN non transporté, VLAN non propagé, PC injoignables

### Imprimantes (13)

- imp-win-spouleur — État du spouleur d’impression Windows
- imp-win-reseau — Joignabilité réseau d’une imprimante, par protocole
- imp-win-partage-unc — Contrôle d’une file partagée \\serveur\partage
- imp-win-config-reseau — Configurer une imprimante réseau (port TCP/IP + imprimante)
- imp-win-connexion-partage — Se connecter à une file partagée \\serveur\partage
- imp-win-defaut — Définir l’imprimante par défaut du compte courant
- imp-win-page-test — Imprimer une page de test Windows
- imp-win-annuler-travail — Annuler UN travail d’impression identifié
- imp-win-spouleur-redemarrer — Redémarrer le spouleur d’impression
- imp-cups-inventaire — Inventaire des destinations CUPS
- imp-cups-diagnostic-file — Diagnostic d’une file CUPS
- imp-cups-annuler-travail — Annuler UN travail d’impression CUPS
- imp-cups-reactiver-file — Réactiver une file CUPS (cupsenable ou cupsaccept)


