# UX-NAVIGATION-CATALOGUE-01 — décision du 24 octobre 2026

## État et objectif

Décision validée par Blaise : organiser toutes les cartes en groupes, sous-groupes et, lorsque nécessaire, sous-sous-groupes. Chantier planifié ; aucune modification de l'interface par ce document. À coordonner avec UX-COHERENCE-03, sans chantier concurrent sur les mêmes composants.

Objectif : retrouver une tâche et ses commandes sans connaître le nom d'un assistant ni parcourir une longue liste. La recherche et la navigation par sujet doivent aboutir aux mêmes contenus.

## Observations sur le site publié

Visite ciblée de l'accueil, de la rubrique Linux, de la recherche Samba, de l'assistant `samba-diagnostic` et de la commande `cr-samba-testparm` ; ce n'est pas un audit exhaustif des autres cartes.

- Linux affiche 158 entrées mêlées ; ses sous-rubriques sont annoncées dans le descriptif mais ne constituent pas un menu navigable dans ce parcours.
- Recherche « samba », tous contenus dans Linux : 26 résultats affichés. Ce nombre de résultats ne mesure pas 26 fonctions Samba distinctes.
- Même recherche, filtre « Procédures et scénarios » : zéro résultat et message « Aucun outil ne correspond », alors que des commandes et assistants existent.
- Le diagnostic Samba existe avec résumé et script Bash ; la commande simple `testparm -s` est accessible. Samba est donc présent mais insuffisamment repérable.
- Une commande en lecture seule peut être classée sous le titre générique « Appliquer » ; adapter le vocabulaire à l'action.

Référence publiée : UX-02b fusionnée par PR #10, main `9c8a9be87ccd9c99a42b7f945c5fd0aa4d531a75`, déploiement GitHub Actions `40093797235` réussi. Ces constats concernent la navigation, pas une validation sur équipements réels.

## Contrat commun à toutes les cartes

1. Trois niveaux de classement au maximum avant la fiche, sans imposer des niveaux vides : domaine → famille → sujet → tâche. Sous-rubriques réellement cliquables et fil d'Ariane.
2. À chaque niveau : noms courts, nombre d'entrées compréhensible, liste compacte et recherche dans le périmètre choisi, avec option explicite pour rechercher partout.
3. Classer par tâche et sujet. Commande, procédure/scénario et assistant complet sont des badges et filtres, pas trois arborescences séparées. Relier les contenus associés sans dupliquer leurs définitions.
4. La plateforme et la méthode sont distinctes : CMD, PowerShell, Bash, Cisco IOS ou GUI seulement lorsque la méthode existe. Garder Vue rapide et Pas à pas sur les fiches compatibles ; identifier clairement les assistants qui produisent un script.
5. Si un filtre masque des contenus correspondants, préciser « Aucun résultat dans ce type de contenu » et proposer les autres types disponibles ; ne pas suggérer l'absence globale de l'outil.
6. Préserver les identifiants, anciennes routes, favoris et historique. Menu, cartes, recherche et liens internes s'appuient sur le même classement.
7. Ne pas multiplier les cartes ni les explications. Menus repliables, couleurs avec libellés, ombres discrètes, navigation clavier et affichage mobile.
8. Aucun changement des protections des scripts ni aucune création automatique de procédures techniques non relues.

## Classement initial à valider contre l'inventaire

| Carte / domaine existant | Familles proposées |
|---|---|
| Poste de travail Windows | Diagnostic ; fichiers et stockage ; comptes ; applications et mises à jour ; services et processus ; sécurité ; réparation |
| Analyse des disques | Occupation ; gros fichiers ; analyse avancée — réutiliser disk-scan |
| Windows Server | Rôles ; fichiers et partages ; DHCP ; DNS ; maintenance |
| Active Directory | Santé du domaine ; utilisateurs ; groupes ; ordinateurs ; OU ; jonction |
| GPO | Diagnostic ; création et liens ; ciblage ; paramètres utilisateur ; paramètres ordinateur |
| Réseau | Adressage ; DNS ; connectivité ; ports ; routes ; Wi-Fi/VPN ; calculs |
| Linux et services réseau | Fichiers ; utilisateurs et permissions ; stockage ; services et système ; réseau ; accès distant ; partages ; domaine et annuaire ; Bash |
| Réseau et Cisco | Socle IOS ; interfaces ; VLAN ; trunks/DTP ; VTP ; routage ; sécurité ; diagnostic |
| Azure et Entra ID | Contexte et accès ; identités ; machines virtuelles ; réseau ; stockage et protection ; surveillance et coûts |
| Imprimantes | Diagnostic ; configuration ; partage et connexion ; travaux et files ; spouleur ; Linux/CUPS |

Ce tableau est une proposition de classement, pas la promesse de fonctions déjà développées. Inventorier avant d'afficher une famille et ne créer aucune rubrique vide. Les intitulés définitifs et éventuels rapprochements de cartes seront revus sur cette base.

### Priorité Linux et Samba

- Linux → Partages de fichiers → Samba/SMB → tâche.
- Linux → Partages de fichiers → NFS → tâche.
- Linux → Domaine et annuaire → Samba Active Directory → tâche.
- Linux → Stockage → partitions, montages, RAID ou quotas → tâche.
- Linux → Utilisateurs et permissions → comptes, groupes, sudo ou ACL → tâche.
- Linux → Accès distant → SSH ou Cockpit → tâche.

Dans Samba/SMB, rendre les tâches existantes visibles : prérequis, création de partage, permissions, connexion client et diagnostic. Distinguer les contenus existants des compléments encore prévus par SAMBA-ADV-01 ; ne pas déclarer ces compléments réalisés par un reclassement.

## Exécution et critères d'acceptation

Commencer par l'inventaire et la navigation Linux/Samba, puis appliquer le même composant aux autres cartes. Proposer leur classement avant une restructuration majeure. Conserver la numérotation et le périmètre des LOTS 10 à 12.

- Inventaire complet : chaque entrée a un chemin de classement ; aucune entrée orpheline ou inaccessible ; compteurs et filtres cohérents.
- Parcours visiteur sans recherche : retrouver Samba, une commande Linux de permissions, une tâche Windows CMD/PowerShell et une tâche Cisco depuis leur carte.
- Parcours avec recherche et filtre restrictif : contenus masqués signalés avec accès direct aux autres types.
- Vérifier les liens existants, le retour et le fil d'Ariane, les changements de périmètre, les favoris, le clavier et le mobile à 390 px.
- Captures et tests adaptés ; preuves distinctes pour local, CI et site déployé.
- Livraison sur branche dédiée et revue ; aucune fusion ni publication de ce nouveau chantier sans autorisation.
