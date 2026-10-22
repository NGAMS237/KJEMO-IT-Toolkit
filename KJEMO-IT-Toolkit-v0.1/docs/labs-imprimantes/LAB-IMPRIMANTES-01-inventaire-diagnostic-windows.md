# Laboratoire Imprimantes 1 — Inventorier et diagnostiquer une file Windows sans rien changer

> **Statut : guide NON EXÉCUTÉ.** Ce laboratoire n'a été joué sur aucun poste Windows ni sur aucune
> imprimante réelle. Les scripts ont été éprouvés uniquement contre des doublures PowerShell 7
> (banc `test/impression-assistants.test.mjs`) ; Windows PowerShell 5.1 n'a pas été utilisé.
> Les résultats ci-dessous sont des *résultats attendus à vérifier*, pas des résultats observés.

## Objectif
Savoir distinguer une **imprimante Windows** (objet local avec un pilote et un port), une **imprimante
réseau directe** (port TCP/IP vers l'adresse de l'appareil) et une **file partagée** (`\\serveur\partage`),
puis lire l'état d'une file **sans rien modifier**.

## Matériel et machines
- Une VM ou un poste Windows 10/11 (ou Windows Server 2019 et plus) avec le module PrintManagement (présent par défaut).
- **Sans imprimante physique** : il suffit d'une imprimante logicielle déjà installée (par exemple « Microsoft Print to PDF »)
  pour lire un inventaire, un port, un pilote et un spouleur. Le test réseau (étape 4) a besoin d'un hôte qui répond sur un port.
- **Avec une imprimante réseau** : son adresse IP et son port (9100 pour RAW, 631 pour IPP, 515 pour LPD).
- Aucun pilote n'est téléchargé ni installé par ces assistants.

## Parcours (générer, lire le script, puis le coller dans PowerShell)
1. `imp-win-inventaire` — inventaire des imprimantes, ports et pilotes. *Attendu :* un tableau d'imprimantes avec nom, pilote, port,
   état, partage ; le rapport précise le type (locale / connexion à une file partagée) et rappelle qu'un état « Normal » ne prouve pas qu'une page sort.
2. `imp-win-spouleur` — service Spooler, dépendances, journal récent. *Attendu :* service `Running`, type de démarrage `Automatic` ;
   si le journal est illisible sans droits, le rapport le dit au lieu d'écrire « aucune erreur ».
3. `imp-win-diagnostic-file` — saisir le **nom exact** de l'imprimante. *Attendu :* travaux de la file, âge, propriétaire ; un travail
   ancien est signalé « possiblement bloqué ». Un nom inconnu ou ambigu est refusé, jamais approché par préfixe.
4. `imp-win-reseau` — hôte, protocole (RAW / LPR / IPP / IPPS / SMB) et port. *Attendu :* résolution DNS, puis test TCP sur le port **réellement choisi**
   (pas seulement un ping). Le rapport écrit que « port ouvert » ne prouve pas qu'une page sortira.
5. `imp-win-partage-unc` — pour une file partagée, vérifier l'accessibilité de `\\serveur\partage` en lecture.

## Points de vigilance
- Les cinq fiches sont en **lecture seule** ; elles n'appellent aucune cmdlet d'écriture.
- Ni `ping`, ni état `Normal`, ni port ouvert ne prouvent l'impression : seul un travail réel imprimé le prouve (voir laboratoire 2).
- Un utilisateur non administrateur voit moins de travaux et peut ne pas lire le journal : le rapport l'indique.

## Résultats attendus / limites
| Étape | Attendu | Limite |
|---|---|---|
| 1 | inventaire complet | pilote « présent » ≠ pilote adapté |
| 2 | Spooler `Running` | journal peut exiger des droits |
| 3 | travaux listés, âge calculé | nom du document masqué par défaut |
| 4 | DNS + TCP sur le port choisi | pas de preuve d'impression |
| 5 | accès lecture au partage | dépend des droits de l'utilisateur |

## Compte rendu à remplir (par vous, après essai)
| Étape | Résultat observé | Écart avec l'attendu |
|---|---|---|
| … | *à remplir* | *à remplir* |
