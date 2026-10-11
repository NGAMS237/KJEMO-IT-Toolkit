# Feuille de route — KJEMO IT Toolkit

Ce document consigne ce qui est **fait**, et ce qui est **prévu sans être
commencé**. Il n'anticipe rien : un lot futur y tient trois lignes, pas une
spécification.

## Vocabulaire — six états distincts

Un même travail peut être à six endroits différents, et les confondre est la
première cause de mauvaise surprise. Dans tous les documents de ce projet :

| État | Ce que cela veut dire |
|---|---|
| **Développé localement** | Le code existe sur une branche de travail. Rien n'a été prouvé. |
| **Testé localement** | Les bancs du dépôt passent sur la machine de développement, sous l'interpréteur de cette machine. |
| **Testé en CI** | GitHub Actions a joué la validation complète sur `windows-latest`, sous `powershell` ET sous `pwsh`, séparément. |
| **Fusionné** | Le travail est dans `main`. |
| **Déployé** | La version publiée sur GitHub Pages contient ce travail. |
| **Testé sur une vraie machine** | Un script a été exécuté sur un poste Windows réel, avec du matériel réel, par une personne. |

Un lot « testé localement » n'est **pas** « testé en CI ». Un lot « fusionné »
n'est **pas** « testé sur une vraie machine ». Ces états ne se déduisent pas
l'un de l'autre et aucun document du projet ne doit les mélanger.

## Lots livrés

| Lot | Contenu | Dernier état connu |
|---|---|---|
| LOT 1 | Analyse de disque, première version | fusionné, déployé |
| LOT 2 | Socle de l'application, assembleur, validateurs | fusionné, déployé |
| LOT 3 | Active Directory avancé (15 assistants) | fusionné, déployé |
| LOT 4 | Stratégies de groupe (GPO) | fusionné, déployé |
| LOT 5 | Réseau avancé | fusionné, déployé |
| LOT 6A | Poste de travail Windows, assistants 1 à 12 | développé localement, testé localement — **non fusionné, non déployé** |
| LOT 6B | Poste de travail Windows, assistants 13 à 30 | développé localement, testé localement — **non fusionné, non déployé** |
| LOT 6B V2 | Correctif de la revue Codex sur quatre points | développé localement, testé localement — **non fusionné, non déployé** |
| LOT 6 V3 | Correctif de sécurité du gardien de chemin et du comptage final | développé localement, testé localement — **non fusionné, non déployé** |

L'état exact des LOTS 6A et 6B au moment de leur livraison est consigné dans
leurs rapports respectifs, section « État du push, de la fusion et du
déploiement ». Aucun des deux n'a été exécuté sur un poste Windows réel.

## Lots prévus, non commencés

Les lots ci-dessous sont **consignés, pas développés**. Aucun code, aucune
fiche, aucun test ne leur correspond dans le dépôt. Ils ne sont pas des
sous-rubriques d'un lot existant : en particulier, **Bash, Samba et Azure ne
sont pas des catégories du LOT 6B**, et ne doivent pas y être ajoutés.

### LOT 7 — Linux
Linux, Bash, services, journaux, paquets, SSH, stockage, Samba et NFS.

### LOT 8 — Azure et Entra ID
Azure, Entra ID, machines virtuelles, réseau Azure, stockage, sauvegarde et
diagnostics cloud.

### LOT 9 — Imprimantes
Imprimantes.

### LOT 10 — Disques, analyse avancée
Analyse et nettoyage avancés des disques. Prolonge `disk-scan`, qui reste
l'assistant de référence pour le parcours récursif et les gros dossiers ; les
assistants de stockage du LOT 6B y renvoient explicitement plutôt que de le
dupliquer.

### LOT 11 — Rapports, bilingue, qualité
Rapports, bilingue, sécurité transversale et qualité.

### LOT 12 — Exécution locale facultative
Exécution locale facultative et sécurisée, **seulement après une étude
d'architecture**. L'application est aujourd'hui un site statique qui
**génère** des scripts et ne les exécute jamais ; changer cela est une
décision d'architecture, pas une fonctionnalité à ajouter.

## Ce que ce document ne dit pas

- Il ne dit pas qu'un lot prévu est planifié dans le temps : aucune date n'y
  figure, et aucune ne doit y être ajoutée sans décision.
- Il ne dit pas qu'un lot livré est déployé : la colonne « dernier état
  connu » est à relire à chaque livraison, et un lot non fusionné y reste
  marqué non fusionné.
- Il ne remplace pas les rapports de lot, qui seuls portent les mesures.
