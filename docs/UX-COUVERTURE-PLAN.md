# Plan de couverture — assistants sans fiche courte (UX-COHERENCE-03)

Document **distinct** de la correction de cohérence : aucune de ces fiches n'a été générée automatiquement. 155 des 211 assistants n'ont ni fiche, ni commande rapide liée ; ils restent pleinement utilisables (assistant complet, script PowerShell / Bash / Cisco IOS identifié en tête de page). Chiffres calculés par `couverture()` (dist/taches.mjs).

## Règles pour chaque future fiche

- Rédigée à la main depuis la documentation officielle ; sources et limites de validation citées.
- Seules les méthodes qui existent réellement (CMD, PowerShell, Linux / Bash, Cisco IOS, interface graphique) ; aucun faux équivalent. Une méthode CMD n'est ajoutée que si la commande CMD existe et produit le même effet ; sinon elle est omise.
- Interface graphique = chemin de navigation et actions, jamais une commande simulée.
- Reprend l'assistant comme lien « Assistant complet » ; l'assistant renvoie vers la fiche (liens réciproques déjà en place).
- Banc : `test/taches.test.mjs`, `test/coherence.test.mjs` couvrent automatiquement toute nouvelle fiche.

## Paliers

- **P1** (96) — Lecture seule / diagnostic — à couvrir en premier : aucun risque d’effet, la fiche courte est le plus utile (une commande, un résultat attendu).
- **P2** (57) — Modification réversible — fiche avec effet visible avant l’action, retour exact, paramètres validés.
- **P3** (2) — Effet destructif — fiche seulement avec confirmation explicite et retour documenté ; peut rester assistant seul.

## Ordre de travail proposé (par famille, paliers P1 d'abord)

| Famille | Assistants seuls | dont P1 | dont P2 | dont P3 | Remarque |
|---|---|---|---|---|---|
| Poste de travail Windows | 30 | 22 | 7 | 1 | Priorité 1 : tâches courantes de dépannage ; apporter PowerShell + CMD + interface graphique quand ils existent. |
| Azure et Entra ID | 21 | 18 | 3 | 0 | Priorité 3 : lectures Azure CLI / PowerShell. |
| Réseau | 19 | 14 | 5 | 0 | Priorité 1 : lectures (ping, DNS, ports) ; CMD pertinent. |
| GPO | 18 | 9 | 8 | 1 | Priorité 3 : lectures (gpresult) d’abord. |
| Active Directory | 16 | 5 | 11 | 0 | Priorité 2 : lectures AD d’abord (PowerShell ; CMD seulement pour dsquery/net). |
| Windows Server | 15 | 8 | 7 | 0 | Priorité 2 : lectures, puis rôles. |
| Imprimantes | 13 | 5 | 8 | 0 | Priorité 3. |
| Réseau et Cisco | 12 | 6 | 6 | 0 | Priorité 2 : lectures `show` par équipement. |
| Linux et services réseau | 11 | 9 | 2 | 0 | Priorité 4 : déjà 112 commandes rapides ; couvrir le reste. |

## Liste complète

### P1 — 96

**Windows Server** (8)

- `server-health-report` — Diagnostic complet Windows Server (Script PowerShell)
- `dhcp-leases-diagnostic` — Diagnostiquer les baux DHCP (Script PowerShell)
- `dns-diagnostic` — Diagnostiquer un serveur DNS Windows (Script PowerShell)
- `file-permissions-audit` — Auditer les permissions NTFS et SMB (Script PowerShell)
- `smb-sessions-diagnostic` — Diagnostiquer les sessions et fichiers SMB ouverts (Script PowerShell)
- `internet-client-diagnostic` — Diagnostiquer l’accès Internet d’un client (Script PowerShell)
- `ics-readiness` — Préparer et vérifier un partage de connexion Internet ICS (Script PowerShell)
- `rras-nat-readiness` — Vérifier les prérequis RRAS et NAT (Script PowerShell)

**Active Directory** (5)

- `ad-account-health` — État de santé des comptes du domaine (Script PowerShell)
- `ad-delegation-audit` — Audit des délégations sur les unités d’organisation (Script PowerShell)
- `ad-dns-health` — Santé du DNS pour Active Directory (Script PowerShell)
- `ad-dcdiag-report` — Rapport dcdiag interprété (Script PowerShell)
- `ad-domain-full-report` — Rapport complet de santé du domaine (Script PowerShell)

**GPO** (9)

- `gpo-inventory-report` — Inventorier les GPO du domaine (Script PowerShell)
- `gpo-health-report` — Diagnostiquer la santé des stratégies de groupe (Script PowerShell)
- `gpo-link-audit` — Auditer l’héritage et les liens GPO (Script PowerShell)
- `gpo-wmi-filter-readiness` — Vérifier un filtre WMI avant association (Script PowerShell)
- `gpo-drive-mapping` — Préparer le mappage de lecteurs réseau (Script PowerShell)
- `gpo-printer-deployment` — Préparer le déploiement d’une imprimante (Script PowerShell)
- `gpo-logon-startup-scripts` — Préparer des scripts de connexion et de démarrage (Script PowerShell)
- `gpo-folder-redirection` — Préparer une redirection de dossiers (Script PowerShell)
- `gpo-firewall-defender` — Auditer et préparer Pare-feu et Microsoft Defender par GPO (Script PowerShell)

**Réseau** (14)

- `network-full-report` — Produire un rapport réseau complet (Script PowerShell)
- `network-baseline` — Capturer et comparer deux états réseau (Script PowerShell)
- `latency-packet-loss` — Mesurer latence, gigue et perte de paquets (Script PowerShell)
- `gateway-diagnostic` — Diagnostiquer la passerelle par défaut (Script PowerShell)
- `ip-conflict-detection` — Chercher un conflit d’adresse IPv4 (Script PowerShell)
- `adapter-metric-multihoming` — Diagnostiquer cartes multiples et métriques (Script PowerShell)
- `rpc-connectivity-test` — Tester la connectivité RPC (Script PowerShell)
- `ldap-ldaps-connectivity` — Tester la connectivité LDAP et LDAPS (Script PowerShell)
- `smb-connectivity-test` — Tester la connectivité SMB (Script PowerShell)
- `http-https-tls-test` — Tester HTTP, HTTPS et le certificat TLS (Script PowerShell)
- `route-table-diagnostic` — Diagnostiquer la table de routage (Script PowerShell)
- `network-share-diagnostic` — Diagnostiquer un partage inaccessible (Script PowerShell)
- `wifi-vpn-diagnostic` — Diagnostiquer le Wi-Fi ou le VPN (Script PowerShell)
- `ipv4-subnet-calculator` — Calculer un sous-réseau IPv4 (Script PowerShell)

**Poste de travail Windows** (22)

- `workstation-inventory` — Inventaire matériel et logiciel du poste (Script PowerShell)
- `microphone-diagnostic` — Diagnostiquer le microphone (Script PowerShell)
- `webcam-diagnostic` — Diagnostiquer la webcam (Script PowerShell)
- `bluetooth-diagnostic` — Diagnostiquer le Bluetooth (Script PowerShell)
- `display-diagnostic` — Diagnostiquer les écrans et la résolution (Script PowerShell)
- `driver-audit` — Auditer les pilotes du poste (Script PowerShell)
- `windows-update-diagnostic` — Diagnostiquer Windows Update (Script PowerShell)
- `application-wont-start` — Diagnostiquer une application qui ne démarre pas (Script PowerShell)
- `slow-boot-diagnostic` — Diagnostic du démarrage lent (Script PowerShell)
- `bluescreen-diagnostic` — Diagnostic des écrans bleus (Script PowerShell)
- `user-profile-diagnostic` — Diagnostic d’un profil utilisateur (Script PowerShell)
- `workstation-performance-report` — Rapport de performance du poste (Script PowerShell)
- `local-accounts-audit` — Audit des comptes locaux (Script PowerShell)
- `windows-access-recovery` — Récupération d’accès Windows (Script PowerShell)
- `firewall-audit` — Audit du pare-feu Windows (Script PowerShell)
- `defender-audit` — Audit de Microsoft Defender (Script PowerShell)
- `safe-mode-preparation` — Préparation au mode sans échec (Script PowerShell)
- `workstation-storage-diagnostic` — Diagnostic du stockage du poste (Script PowerShell)
- `recycle-bin-cleanup` — Nettoyage encadré de la corbeille (Script PowerShell)
- `browser-cache-diagnostic` — Diagnostic des caches de navigateurs (Script PowerShell)
- `windows-domain-join-readiness` — Vérifier qu’un poste Windows peut rejoindre un domaine (Script PowerShell)
- `windows-domain-join-diagnostic` — Diagnostiquer une jonction de domaine qui a échoué, ou un poste joint qui ne s’ouvre plus (Script PowerShell)

**Linux et services réseau** (9)

- `linux-health-report` — Rapport général de santé Linux (Script Bash)
- `linux-system-inventory` — Inventaire matériel et logiciel (Script Bash)
- `linux-boot-diagnostic` — Diagnostic d’un démarrage lent (Script Bash)
- `linux-log-diagnostic` — Recherche guidée dans les journaux (Script Bash)
- `bash-script-starter` — Squelette de script Bash robuste (Script Bash)
- `bash-file-batch` — Traitement par lot d’un ensemble de fichiers (Script Bash)
- `bash-csv-report` — Rapport CSV système, correctement échappé (Script Bash)
- `cron-readiness` — Préparation et diagnostic d’une tâche cron (Script Bash)
- `linux-user-audit` — Audit des comptes locaux (Script Bash)

**Azure et Entra ID** (18)

- `azure-rbac` — Affectations de rôles Azure (RBAC) et diagnostic des accès (Script PowerShell)
- `entra-recherche` — Rechercher des utilisateurs ou des groupes Microsoft Entra (Script PowerShell)
- `entra-appartenances` — Appartenances Entra : groupes d’un utilisateur ou membres d’un groupe (Script PowerShell)
- `entra-roles` — Rôles Microsoft Entra actifs et permissions nécessaires (Script PowerShell)
- `entra-mfa` — Enregistrement de l’authentification multifacteur (MFA) : ce qui est lisible (Script PowerShell)
- `azure-vm-etat` — Configuration, état et éléments de dépannage d’une machine virtuelle (Script PowerShell)
- `azure-vm-disques-interfaces` — Diagnostic des disques managés et des interfaces réseau d’une machine (Script PowerShell)
- `azure-reseau-vnets` — Réseaux virtuels (VNet) et sous-réseaux : plan d’adressage et diagnostic (Script PowerShell)
- `azure-reseau-interfaces-ip` — Interfaces réseau et adresses IP (privées et publiques) (Script PowerShell)
- `azure-reseau-nsg` — Groupes de sécurité réseau (NSG) : règles et accès administratifs exposés (Script PowerShell)
- `azure-reseau-dns` — DNS Azure et diagnostic de connectivité depuis le poste (Script PowerShell)
- `azure-stockage-inventaire` — Inventaire des comptes de stockage et de leurs réglages de sécurité (Script PowerShell)
- `azure-stockage-exposition` — Exposition et accès d’UN compte de stockage (conteneurs, réseau, protection) (Script PowerShell)
- `azure-sauvegarde-coffres` — Coffres Recovery Services et état des sauvegardes de machines virtuelles (Script PowerShell)
- `azure-journal-activite` — Journal d’activité : qui a fait quoi, et ce qui a échoué (Script PowerShell)
- `azure-alertes-diagnostics` — Alertes et paramètres de diagnostic : ce qui est surveillé (Script PowerShell)
- `azure-budgets` — Budgets Azure : lire les alertes de dépense (pas un plafond) (Script PowerShell)
- `azure-ressources-inutilisees` — Ressources de laboratoire potentiellement inutilisées (inventaire) (Script PowerShell)

**Réseau et Cisco** (6)

- `cisco-modes-ios` — Modes IOS, invites, aide et erreurs de contexte (Commandes Cisco IOS)
- `cisco-port-security-etat` — Port-security : état, adresses sécurisées, violations et port bloqué (Commandes Cisco IOS)
- `cisco-dtp-simulation` — DTP : simulation pédagogique (auto, desirable, access, trunk) (Commandes Cisco IOS)
- `cisco-vtp-diagnostic` — VTP : diagnostic (mode, domaine, version, révision) (Commandes Cisco IOS)
- `cisco-vtp-raccordement` — VTP : liste de contrôle avant de rejoindre un domaine existant (Commandes Cisco IOS)
- `cisco-parcours-diagnostic` — Parcours guidés : trunk absent, VLAN non transporté, VLAN non propagé, PC injoignables (Commandes Cisco IOS)

**Imprimantes** (5)

- `imp-win-spouleur` — État du spouleur d’impression Windows (Script PowerShell)
- `imp-win-reseau` — Joignabilité réseau d’une imprimante, par protocole (Script PowerShell)
- `imp-win-partage-unc` — Contrôle d’une file partagée \\serveur\partage (Script PowerShell)
- `imp-cups-inventaire` — Inventaire des destinations CUPS (Script Bash)
- `imp-cups-diagnostic-file` — Diagnostic d’une file CUPS (Script Bash)

### P2 — 57

**Réseau** (5)

- `static-ip` — Configurer une IP statique (Script PowerShell)
- `wifi-repair` — Diagnostiquer et réinitialiser le Wi-Fi (Script PowerShell)
- `dns-client-change` — Changer les serveurs DNS d’une carte (Script PowerShell)
- `route-manager` — Préparer et poser une route statique (Script PowerShell)
- `arp-neighbor-diagnostic` — Diagnostiquer le voisinage ARP et IPv6 (Script PowerShell)

**Active Directory** (11)

- `ad-ou` — Créer une unité d’organisation (Script PowerShell)
- `ad-user` — Créer un utilisateur AD (Script PowerShell)
- `second-dc` — Ajouter un deuxième contrôleur (Script PowerShell)
- `ad-ou-hierarchy` — Créer une hiérarchie d’unités d’organisation (Script PowerShell)
- `ad-users-csv` — Importer des utilisateurs depuis un CSV (Script PowerShell)
- `ad-groups` — Créer et vérifier des groupes Active Directory (Script PowerShell)
- `ad-group-members-csv` — Importer les membres de groupes depuis un CSV (Script PowerShell)
- `ad-home-profile-paths` — Dossiers personnels et profils itinérants (Script PowerShell)
- `ad-object-search-move` — Rechercher et déplacer un objet Active Directory (Script PowerShell)
- `ad-computer-cleanup` — Recenser et mettre en quarantaine les ordinateurs inactifs (Script PowerShell)
- `ad-secure-channel` — Vérifier et réparer le canal sécurisé du domaine (Script PowerShell)

**Windows Server** (7)

- `shared-folder` — Créer un dossier partagé (Script PowerShell)
- `dhcp-install-authorize` — Installer et autoriser un serveur DHCP (Script PowerShell)
- `dhcp-scope-options` — Créer une étendue et configurer ses options DHCP (Script PowerShell)
- `dhcp-reservation` — Créer une réservation DHCP (Script PowerShell)
- `dhcp-backup` — Sauvegarder la configuration DHCP (Script PowerShell)
- `dns-zone` — Créer une zone DNS directe ou inversée (Script PowerShell)
- `dns-record` — Créer un enregistrement DNS (Script PowerShell)

**GPO** (8)

- `gpo-password` — Politique de mots de passe du domaine (Script PowerShell)
- `gpo-refresh-diagnostic` — Actualiser et diagnostiquer gpupdate (Script PowerShell)
- `gpo-create-link` — Créer une GPO et la lier à une OU (Script PowerShell)
- `gpo-security-filter` — Vérifier le filtrage de sécurité d’une GPO (Script PowerShell)
- `gpo-session-desktop` — Configurer verrouillage automatique et fond d’écran (Script PowerShell)
- `gpo-device-restrictions` — Préparer les restrictions USB et périphériques (Script PowerShell)
- `gpo-windows-update-services` — Préparer Windows Update et les services par GPO (Script PowerShell)
- `gpo-software-shortcuts-browser` — Préparer déploiement logiciel, raccourcis et navigateur (Script PowerShell)

**Poste de travail Windows** (7)

- `audio-diagnostic` — Diagnostiquer le son du poste (Script PowerShell)
- `windows-update-repair` — Réparation encadrée de Windows Update (Script PowerShell)
- `process-hung` — Diagnostiquer un processus bloqué (Script PowerShell)
- `defender-scan` — Analyse Microsoft Defender encadrée (Script PowerShell)
- `dism-repair` — Vérification et réparation avec DISM (Script PowerShell)
- `restore-point-create` — Création d’un point de restauration (Script PowerShell)
- `windows-domain-join` — Joindre un poste Windows à un domaine, sans secret et sans redémarrage automatique (Script PowerShell)

**Linux et services réseau** (2)

- `bash-backup-directory` — Sauvegarde locale datée d’un dossier (Script Bash)
- `samba-ad-dc-provision` — Préparer le provisionnement d’un contrôleur de domaine, sans le lancer (Script Bash)

**Azure et Entra ID** (3)

- `azure-vm-demarrage` — Démarrer une machine virtuelle Azure (prévisualisation, puis action confirmée) (Script PowerShell)
- `azure-vm-arret` — Arrêter et désallouer une machine virtuelle Azure (prévisualisation, puis action confirmée) (Script PowerShell)
- `azure-sauvegarde-restauration` — Restaurer les disques d’une machine sauvegardée vers une cible de laboratoire distincte (Script PowerShell)

**Réseau et Cisco** (6)

- `cisco-identification` — Identifier un commutateur et fixer son nom et sa bannière (Commandes Cisco IOS)
- `cisco-console-ssh` — Accès console et SSH : comptes locaux, clé, lignes vty (Commandes Cisco IOS)
- `cisco-gestion-ip` — Adresse de gestion du commutateur : interface VLAN, passerelle, ping (Commandes Cisco IOS)
- `cisco-port-security-config` — Port-security : configurer UN port, ou le remettre en service après correction (Commandes Cisco IOS)
- `cisco-trunk-preparation` — Trunk : préparer UN lien (VLAN autorisés, VLAN natif) (Commandes Cisco IOS)
- `cisco-vtp-configuration` — VTP : mode, domaine et version (v1 / v2) (Commandes Cisco IOS)

**Imprimantes** (8)

- `imp-win-config-reseau` — Configurer une imprimante réseau (port TCP/IP + imprimante) (Script PowerShell)
- `imp-win-connexion-partage` — Se connecter à une file partagée \\serveur\partage (Script PowerShell)
- `imp-win-defaut` — Définir l’imprimante par défaut du compte courant (Script PowerShell)
- `imp-win-page-test` — Imprimer une page de test Windows (Script PowerShell)
- `imp-win-annuler-travail` — Annuler UN travail d’impression identifié (Script PowerShell)
- `imp-win-spouleur-redemarrer` — Redémarrer le spouleur d’impression (Script PowerShell)
- `imp-cups-annuler-travail` — Annuler UN travail d’impression CUPS (Script Bash)
- `imp-cups-reactiver-file` — Réactiver une file CUPS (cupsenable ou cupsaccept) (Script Bash)

### P3 — 2

**GPO** (1)

- `gpo-backup-restore-compare` — Sauvegarder, comparer et restaurer une GPO (Script PowerShell)

**Poste de travail Windows** (1)

- `temp-cleanup` — Nettoyage sécurisé des fichiers temporaires (Script PowerShell)

