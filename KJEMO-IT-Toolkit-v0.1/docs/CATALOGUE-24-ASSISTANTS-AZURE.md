# Catalogue des 24 assistants Azure et Microsoft Entra ID (LOT 8)

Genere par `node test/matrices-lot8.mjs` : ne pas editer a la main (le mode
`--verifier` echoue si ce fichier derive).

Tous produisent un script PowerShell (`.ps1`, Windows PowerShell 5.1 et
PowerShell 7). Ils **ne se connectent jamais** : la personne ouvre sa session
(`Connect-AzAccount`, `Connect-MgGraph`) elle-meme. Trois seulement agissent
(demarrer, arreter, restaurer) et seulement apres une phrase de confirmation
exacte ; les autres sont en lecture seule. Aucun essai reel sur un tenant :
NON EXECUTE.

## Connexion, contexte et accès (3)

| Identifiant | Titre | Risque | Lecture seule | Action `-WhatIf` |
|---|---|---|---|---|
| `azure-abonnements-rg` | Inventaire des abonnements et des groupes de ressources | diagnostic | oui | — |
| `azure-contexte` | Prérequis et contexte Azure : suis-je au bon endroit ? | diagnostic | oui | — |
| `azure-rbac` | Affectations de rôles Azure (RBAC) et diagnostic des accès | diagnostic | oui | — |

## Surveillance et coûts (4)

| Identifiant | Titre | Risque | Lecture seule | Action `-WhatIf` |
|---|---|---|---|---|
| `azure-alertes-diagnostics` | Alertes et paramètres de diagnostic : ce qui est surveillé | diagnostic | oui | — |
| `azure-budgets` | Budgets Azure : lire les alertes de dépense (pas un plafond) | diagnostic | oui | — |
| `azure-journal-activite` | Journal d’activité : qui a fait quoi, et ce qui a échoué | diagnostic | oui | — |
| `azure-ressources-inutilisees` | Ressources de laboratoire potentiellement inutilisées (inventaire) | diagnostic | oui | — |

## Réseau Azure (4)

| Identifiant | Titre | Risque | Lecture seule | Action `-WhatIf` |
|---|---|---|---|---|
| `azure-reseau-dns` | DNS Azure et diagnostic de connectivité depuis le poste | diagnostic | oui | — |
| `azure-reseau-interfaces-ip` | Interfaces réseau et adresses IP (privées et publiques) | diagnostic | oui | — |
| `azure-reseau-nsg` | Groupes de sécurité réseau (NSG) : règles et accès administratifs exposés | diagnostic | oui | — |
| `azure-reseau-vnets` | Réseaux virtuels (VNet) et sous-réseaux : plan d’adressage et diagnostic | diagnostic | oui | — |

## Stockage et protection (4)

| Identifiant | Titre | Risque | Lecture seule | Action `-WhatIf` |
|---|---|---|---|---|
| `azure-sauvegarde-coffres` | Coffres Recovery Services et état des sauvegardes de machines virtuelles | diagnostic | oui | — |
| `azure-sauvegarde-restauration` | Restaurer les disques d’une machine sauvegardée vers une cible de laboratoire distincte | caution | non | Restore-AzRecoveryServicesBackupItem |
| `azure-stockage-exposition` | Exposition et accès d’UN compte de stockage (conteneurs, réseau, protection) | diagnostic | oui | — |
| `azure-stockage-inventaire` | Inventaire des comptes de stockage et de leurs réglages de sécurité | diagnostic | oui | — |

## Machines virtuelles (5)

| Identifiant | Titre | Risque | Lecture seule | Action `-WhatIf` |
|---|---|---|---|---|
| `azure-vm-arret` | Arrêter et désallouer une machine virtuelle Azure (prévisualisation, puis action confirmée) | caution | non | Stop-AzVM |
| `azure-vm-demarrage` | Démarrer une machine virtuelle Azure (prévisualisation, puis action confirmée) | caution | non | Start-AzVM |
| `azure-vm-disques-interfaces` | Diagnostic des disques managés et des interfaces réseau d’une machine | diagnostic | oui | — |
| `azure-vm-etat` | Configuration, état et éléments de dépannage d’une machine virtuelle | diagnostic | oui | — |
| `azure-vm-inventaire` | Inventaire des machines virtuelles Azure et de leur état réel | diagnostic | oui | — |

## Microsoft Entra ID (4)

| Identifiant | Titre | Risque | Lecture seule | Action `-WhatIf` |
|---|---|---|---|---|
| `entra-appartenances` | Appartenances Entra : groupes d’un utilisateur ou membres d’un groupe | diagnostic | oui | — |
| `entra-mfa` | Enregistrement de l’authentification multifacteur (MFA) : ce qui est lisible | diagnostic | oui | — |
| `entra-recherche` | Rechercher des utilisateurs ou des groupes Microsoft Entra | diagnostic | oui | — |
| `entra-roles` | Rôles Microsoft Entra actifs et permissions nécessaires | diagnostic | oui | — |
