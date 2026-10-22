# LOT 9 — Imprimantes · rapport de livraison

Branche `claude/lot-9-imprimantes`, base `0c4aa86` (checkpoint d'intégration Azure + Cisco, tag `integration-checkpoint-1`).
**Développé et testé localement. Non poussé (GitHub a refusé l'écriture : HTTP 403), CI distante non exécutée, non fusionné dans main, non déployé.**

## DÉVELOPPÉ
- 15 assistants « Imprimantes » : 11 Windows (`.ps1`, PrintManagement / CIM / Spooler) et 4 Linux/CUPS (`.sh`). Catalogue : 211 assistants, 10 catégories visibles.
- Parcours A (lecture : `imp-win-inventaire`, `-diagnostic-file`, `-spouleur`, `-reseau`, `-partage-unc`, `imp-cups-inventaire`, `-diagnostic-file`), B (`imp-win-config-reseau`, `-connexion-partage`, `-defaut`, `-page-test`), C (`imp-win-annuler-travail`, `-spouleur-redemarrer`, `imp-cups-annuler-travail`, `-reactiver-file`).
- Chaque action : mode Diagnostic par défaut, phrase exacte nominative embarquée dans le script, lecture avant, relecture après, cible par nom EXACT (jamais joker ni préfixe), aucun pilote téléchargé ni installé, aucun remplacement silencieux, aucune purge générale du spool.
- `-WhatIf` uniquement pour `Add-PrinterPort`, `Remove-PrintJob`, `Restart-Service` (support vérifié dans la documentation Microsoft ; `Add-Printer` : non annoncé).
- Bloc pédagogique dans l'interface (problème, exemple, première vérification, lu / écrit / effets, limites).
- Matrices `LOT-9-MATRICE-OUTILS/SCRIPTS/COMMANDES.json` (15 outils, 25 scripts, 21 commandes) avec détection de dérive ; `LOT-9-SOURCES.json` ; catalogue `docs/CATALOGUE-15-ASSISTANTS-IMPRIMANTES.md` ; 3 laboratoires `docs/labs-imprimantes/` (NON EXÉCUTÉS) ; feuille de route et CHANGELOG mis à jour.
- Câblage : 5 scripts `package.json`, 4 étapes de `.github/workflows/validate-linux.yml`, plan 5 bis de `test/ci-workflows.test.mjs` qui vérifie ce câblage ; 7 cmdlets ajoutées à `dist/cmdlets.mjs`.

## DÉFAUTS TROUVÉS PAR LES BANCS, ET CORRIGÉS
- CUPS : un délai TCP (code 124) et un refus étaient rapportés par le même message → deux messages distincts.
- CUPS : la raison d'arrêt de la file n'apparaissait pas dans la sortie Console → incluse dans le texte affiché.
- CUPS : en-tête de version et de privilèges ; texte non ASCII dans un `.sh` ; rapport silencieux en Console (bloc de constats ajouté).
- Directive ShellCheck séparée de sa commande par une édition → replacée.
- Détecteur de mot interdit : « réparé » (avec accent) n'était pas reconnu → corrigé.
- Régressions de compteurs causées par la nouvelle catégorie, corrigées en mettant la vérité à jour (10 → 11 cartes ; « Imprimantes » désormais visible ; définition du lot 7 bornée à sa catégorie car les 4 CUPS sont « Linux »). Aucune assertion supprimée ni affaiblie ; la règle « aucune carte sans outil » a été conservée et rendue explicite.

## TESTÉ LOCALEMENT (pwsh 7.4.6, bash, shellcheck, Playwright 1.44.1 / Chromium 1194)
| Banc | Résultat |
|---|---|
| Assistants Imprimantes (doublures PowerShell 7, faux binaires CUPS, arbre syntaxique, contre-épreuves) | 1 103 OK, 0 échec |
| Navigateur Imprimantes | 319 OK, 0 échec |
| Identité | 92 709 OK, 0 échec |
| Navigateur identité / poste B / LOT 7 / contre-épreuves LOT 7 | 8 553 / 418 / 2 274 / 57 OK, 0 échec |
| Azure (assistants / navigateur) | 3 277 / 810 OK |
| Cisco (assistants / navigateur) | 3 011 / 1 028 OK |
| Intégration navigateur | 257 OK |
| Négatifs LOT 7 / contre-épreuves | 959 / 40 OK |
| ci-workflows | 92 OK |
| baseline 856, sh-hygiene, shquote, ShellCheck, scanner Bash, commandes rapides, dette 6B | verts (exit 0) |
| Matrices LOT 7, LOT 8, Cisco, LOT 9 (`--verifier`) | sans dérive |
| Sources Imprimantes, sources Microsoft hors ligne, sources Cisco | verts |
| Cmdlets (export + `Test-KjemoCmdlets.ps1`) | 0 échec ; présence réelle NON VÉRIFIÉE (pas de Windows) |
| Mouchards, services, réseau, Samba, Samba AD, Cockpit, capacités, netplan, sauvegarde/DNS/route bloquants | exit 0 |

Sources : 18 pages officielles (Microsoft Learn, OpenPrinting) lues par outil web le 22/10/2026, toutes répondant avec le titre attendu ; `Restart-Service` documente bien `-WhatIf`. Une page qui répond ne prouve pas que chaque phrase de la fiche y figure.

## TESTÉ EN CI
Rien. Aucun workflow distant n'a tourné (push refusé).

## NON EXÉCUTÉ
- Windows PowerShell 5.1 (seule une analyse syntaxique PowerShell 7 a été faite — ce n'est pas une exécution sous 5.1).
- Toute imprimante réelle, tout spouleur Windows réel, tout cupsd réel : les bancs utilisent des doublures, qui ne valident aucun appareil réel. Le comportement réel des pilotes, de `Win32_Printer.PrintTestPage` et de `lpstat` n'est pas éprouvé.
- Les trois laboratoires.
- La détection de secrets est une heuristique textuelle, pas une garantie.

## RESTANT
- Pousser la branche et obtenir un CI vert (accès GitHub à rétablir).
- Essai sur un poste Windows 10/11 réel (5.1 et 7) et une VM Ubuntu avec CUPS ; compte rendu des laboratoires.
- Hors périmètre volontaire : pilotes, serveur d'impression complet, création de files CUPS (`lpadmin`), administration réseau de CUPS.
- Samba : voir la section « Traçabilité Samba » de `docs/FEUILLE-DE-ROUTE.md` (commit séparé) ; aucun complément développé.
