# Catalogue des 46 assistants du LOT 7

Genere par `node test/matrices-lot7.mjs` : ne pas editer a la main (le banc
`--verifier` echoue si ce fichier derive).

43 assistants Linux (Bash, `.sh`) et 3 assistants de jonction de domaine
(PowerShell, `.ps1`, classes dans « Poste de travail Windows »).

Niveaux de risque des fiches : `diagnostic` (lecture seule), `safe`,
`caution` (modifie la machine apres confirmation exacte), `destructive`
(peut detruire des donnees). Ubuntu Server reel : NON EXECUTE.

## Diagnostic Linux (4)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `linux-boot-diagnostic` | Diagnostic d’un démarrage lent | diagnostic | .sh | aucun | 4 |
| `linux-health-report` | Rapport général de santé Linux | diagnostic | .sh | aucun | 5 |
| `linux-log-diagnostic` | Recherche guidée dans les journaux | diagnostic | .sh | aucun | 4 |
| `linux-system-inventory` | Inventaire matériel et logiciel | diagnostic | .sh | root-partiel | 6 |

## Bash et automatisation (5)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `bash-backup-directory` | Sauvegarde locale datée d’un dossier | caution | .sh | aucun | 4 |
| `bash-csv-report` | Rapport CSV système, correctement échappé | diagnostic | .sh | aucun | 4 |
| `bash-file-batch` | Traitement par lot d’un ensemble de fichiers | diagnostic | .sh | aucun | 4 |
| `bash-script-starter` | Squelette de script Bash robuste | diagnostic | .sh | aucun | 4 |
| `cron-readiness` | Préparation et diagnostic d’une tâche cron | diagnostic | .sh | aucun | 4 |

## Utilisateurs et permissions (5)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `linux-permission-acl` | Accorder des droits à un compte ou un groupe par ACL | caution | .sh | root | 6 |
| `linux-permission-audit` | Auditer les permissions d’un chemin et de ses parents | diagnostic | .sh | root-partiel | 7 |
| `linux-permission-change` | Changer le propriétaire, le groupe et le mode d’un chemin | caution | .sh | root | 7 |
| `linux-user-audit` | Audit des comptes locaux | diagnostic | .sh | root-partiel | 6 |
| `linux-user-create` | Créer un compte local, verrouillé à la création | caution | .sh | root | 8 |

## Services et journaux (4)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `linux-package-diagnostic` | Diagnostiquer l’état des paquets et simuler une installation | diagnostic | .sh | root-partiel | 5 |
| `linux-time-sync-diagnostic` | Diagnostiquer l’heure et la synchronisation NTP | diagnostic | .sh | root-partiel | 6 |
| `systemd-service-control` | Démarrer, arrêter ou activer une unité systemd | caution | .sh | root | 4 |
| `systemd-service-diagnostic` | Diagnostiquer un service systemd et lire son journal | diagnostic | .sh | root-partiel | 4 |

## Réseau Linux (4)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `linux-dns-diagnostic` | Diagnostiquer la résolution de noms, par interface | diagnostic | .sh | aucun | 4 |
| `linux-firewall-audit` | Auditer le pare-feu, et le croiser avec les ports en écoute | diagnostic | .sh | root-partiel | 5 |
| `linux-network-diagnostic` | Diagnostiquer le réseau : lien, route, puis résolution | diagnostic | .sh | root-partiel | 8 |
| `netplan-readiness` | Préparer une configuration Netplan, validée sans être appliquée | caution | .sh | root | 6 |

## SSH et accès distant (4)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `ssh-client-diagnostic` | Diagnostiquer un client SSH qui ne se connecte pas | diagnostic | .sh | aucun | 4 |
| `ssh-hardening-audit` | Auditer le durcissement SSH, et préparer un fichier additionnel validé | caution | .sh | root | 4 |
| `ssh-key-readiness` | Vérifier que l’authentification par clé peut fonctionner | diagnostic | .sh | root-partiel | 4 |
| `ssh-server-readiness` | Diagnostiquer un serveur SSH qui ne répond pas | diagnostic | .sh | root-partiel | 6 |

## Cockpit (2)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `cockpit-connection-diagnostic` | Diagnostiquer une console Cockpit qui ne répond pas | diagnostic | .sh | root-partiel | 6 |
| `cockpit-install-readiness` | Vérifier qu’une machine est prête pour Cockpit | diagnostic | .sh | root-partiel | 6 |

## Samba (3)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `samba-diagnostic` | Diagnostiquer un partage Samba qui ne répond pas comme prévu | diagnostic | .sh | root-partiel | 5 |
| `samba-readiness` | Vérifier qu’une machine peut servir un partage Samba | diagnostic | .sh | root-partiel | 5 |
| `samba-share-create` | Déclarer un partage Samba, validé avant d’être mis en service | caution | .sh | root | 5 |

## Samba AD (4)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `samba-ad-dc-provision` | Préparer le provisionnement d’un contrôleur de domaine, sans le lancer | caution | .sh | root | 5 |
| `samba-ad-dc-readiness` | Vérifier les prérequis d’un contrôleur de domaine Samba | diagnostic | .sh | root-partiel | 5 |
| `samba-ad-health` | Lire la santé d’un contrôleur de domaine Samba | diagnostic | .sh | root-partiel | 5 |
| `samba-ad-user-manage` | Lire les comptes du domaine, et préparer les commandes qui les changent | diagnostic | .sh | root-partiel | 4 |

## NFS (2)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `nfs-export-create` | Préparer une ligne d’export NFS, écrite et relue — l’application reste manuelle | caution | .sh | root | 6 |
| `nfs-server-readiness` | Vérifier qu’une machine peut exporter en NFS — et auditer ce qu’elle exporte déjà | diagnostic | .sh | root-partiel | 6 |

## Stockage Linux (6)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `linux-disk-partition-mount` | Partitionner, formater et monter un disque de données | destructive | .sh | root | 8 |
| `linux-quota-enable` | Activer les quotas disque sur un système de fichiers | caution | .sh | root | 6 |
| `linux-quota-limits` | Poser une limite de quota à un utilisateur ou un groupe | caution | .sh | root | 5 |
| `linux-raid-member-manage` | Remplacer, retirer ou ajouter un membre de RAID | caution | .sh | root | 4 |
| `linux-raid1-create` | Créer un RAID 1 avec disque de secours facultatif | destructive | .sh | root | 6 |
| `linux-storage-diagnostic` | Inventaire du stockage avant toute intervention | diagnostic | .sh | root-partiel | 8 |

## Jonction de domaine — Poste de travail Windows (3)

| Identifiant | Titre | Risque | Sortie | Privileges | Sources |
|---|---|---|---|---|---|
| `windows-domain-join` | Joindre un poste Windows à un domaine, sans secret et sans redémarrage automatique | caution | .ps1 | — | 6 |
| `windows-domain-join-diagnostic` | Diagnostiquer une jonction de domaine qui a échoué, ou un poste joint qui ne s’ouvre plus | diagnostic | .ps1 | — | 6 |
| `windows-domain-join-readiness` | Vérifier qu’un poste Windows peut rejoindre un domaine | diagnostic | .ps1 | — | 6 |
