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
| LOT 7 | Linux, Bash, Samba, NFS : 46 assistants (43 Linux + 3 jonction de domaine), 112 commandes rapides, 19 familles de tests négatifs | développé localement, testé localement (Bash réel + doublures, Chromium réel) — **non poussé, non testé en CI, non fusionné, non déployé, non testé sur Ubuntu Server réel** |

L'état exact des LOTS 6A et 6B au moment de leur livraison est consigné dans
leurs rapports respectifs, section « État du push, de la fusion et du
déploiement ». Aucun des deux n'a été exécuté sur un poste Windows réel.

## Lots prévus, non commencés

Les lots ci-dessous sont **consignés, pas développés**. Aucun code, aucune
fiche, aucun test ne leur correspond dans le dépôt. Ils ne sont pas des
sous-rubriques d'un lot existant : en particulier, **Bash, Samba et Azure ne
sont pas des catégories du LOT 6B**, et ne doivent pas y être ajoutés.

### LOT 6C — Correctif de la dette 6B (consigné, non commencé)
18 assistants et 144 scripts du LOT 6B portent un sélecteur « Format du
rapport » qui ne commande rien (valeur lue, jamais utilisée). Le LOT 7 les
**détecte et les liste** (`npm run test:dette-6b`) sans modifier les 856 scripts
de référence. Le correctif réclame de nouvelles empreintes : c'est un lot à part.

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

## Navigation et fiche cibles — consignées, non implémentées

La hiérarchie cible à quatre niveaux (Microsoft Windows ; Linux et services
réseau ; Réseau et Cisco ; Cloud et outils multiplateformes) et le modèle de
fiche cible (onglets CMD/PowerShell/GUI, copie impossible tant qu'un
placeholder subsiste, etc.) sont décrits dans
[`ARCHITECTURE-MULTIPLATEFORME.md`](ARCHITECTURE-MULTIPLATEFORME.md). Aucune
ligne de code ne les réalise ; les identifiants et routes existants sont
préservés.

## Observations du LOT 7 non corrigées (volontairement)

- Netplan (corrigé au 27/n, voir le CHANGELOG) : `50-cloud-init.yaml` n'a
  jamais été le nom proposé (le défaut est `99-kjemo-reseau.yaml`) ; il
  n'apparaissait que dans un message et une erreur courante, mais le formulaire
  l'acceptait. La passerelle égale à l'hôte, au réseau ou à la diffusion était
  acceptée. Les deux sont refusées.
- `networking.service` : le script en parle mieux que le formulaire.
- Point de montage contenant des espaces ou `;` : refusé par prudence.
- Les commandes rapides ne sont affichées par aucun écran.
- Copie du bandeau d'accueil écrite pour Windows seulement.
- Le bouton retour passe à la ligne à 390 px ; les liens de sources de moins de
  24 px sont exemptés de la règle WCAG 2.5.8.
- N19 (jonction PowerShell) est éprouvée statiquement (niveau 1), pas exécutée.
- `chown` et `mknod` réels ne sont exécutables que si la capacité existe.
