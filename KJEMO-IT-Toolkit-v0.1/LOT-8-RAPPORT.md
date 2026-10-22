# LOT 8 — Azure et Microsoft Entra ID — rapport de livraison

Date : 22 octobre 2026 · Branche : `claude/lot-8-azure-entra-id` · Base : `78a2c8b9eecce70c14fa2da9ce3077d6d14ebacf` (`reconciliation/lot7`).

## 1. État en une phrase

**Développé localement, testé localement (scripts exécutés contre des doublures
PowerShell 7, navigateur Chromium réel). NON poussé, NON testé en CI GitHub, NON
fusionné, NON déployé. Windows PowerShell 5.1 : NON EXÉCUTÉ. Tenant, abonnement
ou équipement Azure réel : NON EXÉCUTÉ.**

## 2. Niveaux de preuve (à ne jamais confondre)

| Niveau | Ce qui a été fait | Ce que cela prouve | Ce que cela ne prouve pas |
|---|---|---|---|
| Génération / syntaxe | 192 scripts générés ; analyse AST sous pwsh 7.4.6 ; absence de syntaxe réservée à PowerShell 7 | Les scripts sont syntaxiquement valides et construits comme prévu | Qu'ils s'exécutent, et a fortiori sous 5.1 |
| Exécution avec doublures | `test/azure-assistants.test.mjs` : chaque assistant exécuté contre des doublures PowerShell (pwsh 7.4.6), journal d'appels, tripwires sur ~50 commandes qui modifient | La logique de garde, les refus, les constats, les exports, l'absence d'appel modifiant | Que les vrais objets Azure/Graph ont la forme supposée par les doublures |
| Navigateur | `test/browser-azure.test.mjs` : Chromium réel, serveur local | Routes, formulaires, validation, confirmations, copie, téléchargement, formats, 390 px | Rien sur l'exécution du script |
| CI GitHub | Étapes ajoutées aux workflows ; **jamais jouées à distance** | — | **NON EXÉCUTÉ** |
| Tenant réel | Aucun | — | **NON EXÉCUTÉ** : aucune connexion, aucune ressource, aucun abonnement touché |

## 3. Livré

24 assistants, catégorie « Azure et Entra ID », six sous-rubriques, `.ps1`
(`platform: 'Multi'`, Windows PowerShell 5.1 et PowerShell 7), 21 en lecture seule.

| Famille | Assistants |
|---|---|
| Connexion, contexte et accès (3) | `azure-contexte`, `azure-abonnements-rg`, `azure-rbac` |
| Microsoft Entra ID (4) | `entra-recherche`, `entra-appartenances`, `entra-roles`, `entra-mfa` |
| Machines virtuelles (5) | `azure-vm-inventaire`, `azure-vm-etat`, `azure-vm-disques-interfaces`, `azure-vm-demarrage`*, `azure-vm-arret`* |
| Réseau Azure (4) | `azure-reseau-vnets`, `azure-reseau-interfaces-ip`, `azure-reseau-nsg`, `azure-reseau-dns` |
| Stockage et protection (4) | `azure-stockage-inventaire`, `azure-stockage-exposition`, `azure-sauvegarde-coffres`, `azure-sauvegarde-restauration`* |
| Surveillance et coûts (4) | `azure-journal-activite`, `azure-alertes-diagnostics`, `azure-budgets`, `azure-ressources-inutilisees` |

\* Seuls assistants qui agissent (`Start-AzVM`, `Stop-AzVM`,
`Restore-AzRecoveryServicesBackupItem`) : mode Diagnostic = `-WhatIf` ; mode
Appliquer = phrase exacte (`DEMARRER <vm>`, `ARRETER <vm>`,
`RESTAURER <vm> VERS <groupe-cible>`) comparée avec `-ceq`. **Pas de `-Force`** :
l'invite native de `Stop-AzVM` sert de seconde confirmation. Restauration : groupe
cible ≠ groupe source, nom de cible contenant lab/test/restore/restauration/
sandbox/labo, compte de transit dans la région du coffre ; restaure les disques,
pas une machine.

Contrat commun (fabrique `outilAzure`, `dist/noyau-azure.mjs`) : aucun script ne
contient `Connect-*`, `Set-AzContext`, `Select-AzSubscription` ; une garde compare
tenant et abonnement *attendus* à ceux de la session et refuse sinon ; toute
lecture échoue bruyamment (`-ErrorAction Stop`) : INACCESSIBLE / INTROUVABLE /
ERREUR est classé ATTENTION, jamais OK ; la conclusion n'est jamais « sain »
(REFUS, RÉSULTAT INCOMPLET, « n point(s) à examiner », ou « aucun point… ne couvre
que ce qui a été lu ») ; identifiants tronqués (8 caractères + `-****`) ; aucun
cmdlet de clé / SAS / mot de passe ; rapport Console / JSON / CSV (CSV neutralisé
contre les formules). Les budgets sont des alertes, pas des plafonds ; un
résultat vide n'est pas une absence ; le MFA rapporté est l'*enregistrement*
(retard ~36 h), pas l'exigence ; Network Watcher n'est pas utilisé.

**Détection de secrets : heuristique.** Un filet commun refuse, dans tout champ
texte, les motifs de secrets connus (y compris `p@ssw0rd`). Une détection textuelle
n'est pas une garantie universelle : un secret au format inconnu peut passer.

## 4. Corrections de relecture préservées

RBAC : identifiant de portée tronqué ; « aucune affectation » classé ATTENTION
(possible droit de lecture insuffisant) ; groupe facultatif en portée Abonnement.
Validation : un champ ignoré par la portée choisie est quand même contrôlé
(secrets, injections). `-Force` retiré. Champs facultatifs déclarés. Assertions
vides remplacées par des comparaisons sur contenu ; mutation de garde de contexte
rendue applicable (le banc vérifie que la mutation s'applique avant de conclure à
sa détection) ; faux positifs de la détection statique corrigés.

## 5. Preuves exécutées (cette session, Linux, pwsh 7.4.6, Node 22, Chromium 1194)

| Banc | Résultat | Remarque |
|---|---|---|
| `test/azure-assistants.test.mjs` | **3 277 OK, 0 échec** | 9 sections (catalogue, entrées hostiles, scripts générés, syntaxe AST, exécution avec doublures, actions, constats, exports Console/JSON/CSV × 24, contre-épreuves) |
| `test/browser-azure.test.mjs` | **810 OK, 0 échec** | 24 routes directes, copie, téléchargement (BOM, nom `<id>.ps1`), 3 formats × 24, validation / hostiles / secrets, confirmations, 390 px |
| `test/browser-identity.test.mjs` | 7 935 OK, 0 échec | 177 outils |
| `test/browser-lot7.test.mjs` | 2 272 OK, 0 échec | après adaptation du compte de catégories (8 → 9) |
| `test/browser-lot7-contre-epreuves.test.mjs` | 57 OK, 0 échec | 16 pannes injectées |
| `test/browser-poste-b.test.mjs` | 418 OK, 0 échec | |
| `test/identity.test.mjs` | 83 763 OK, 0 échec | |
| `test/generate-ps1.mjs` | 440/440 et 712/712 identiques | voir §7 |
| `test/baseline-856.test.mjs` | 10 OK, 0 échec | |
| `test/check-ps1-bom.mjs` | 1 077 OK | |
| `test/matrices-lot7.mjs --verifier` | OK (153 outils, 1 224 scripts, 368 sources) | périmètre LOT 7 inchangé |
| `test/matrices-lot8.mjs --verifier` | OK (24 outils, 192 scripts, 38 commandes) | dérive détectée sur modification volontaire, puis restaurée |
| `test/ci-workflows.test.mjs` | 83 OK | |
| Autres bancs de la suite (`sh-hygiene`, `shquote`, `scanner-bash`, `commandes-rapides`, `dette-6b-format`, `cmdlets-export`, `Test-KjemoCmdlets.ps1`, `fiches-poste-b`, `poste-verrous`, `jonction-domaine`, `sauvegarde/dns/route-bloquant`, `mouchards-linux`, `sh-shellcheck`, `negatifs-lot7` et ses contre-épreuves, `netplan-v2`, `capacites-linux`) | tous code 0 | |
| `test/sources-microsoft.mjs` (en ligne) | 2 782 OK, **2 échecs** | non liés au LOT 8 : `gnu.org` (503 transitoire) et la page NFS d'Ubuntu (titre sans mot de l'URL). Les 81 sources Azure / Entra / Graph sont VÉRIFIÉES (code 200, titre cohérent) ; `-WhatIf` est bien documenté pour `Start-AzVM`, `Stop-AzVM`, `Restore-AzRecoveryServicesBackupItem` |

Contre-épreuves du banc Azure (chaque garde est éprouvée sur un script mutilé, et
l'applicabilité de la mutation est vérifiée avant de conclure) : ajout de
`Connect-AzAccount` (détecté en statique *et* par tripwire), ajout de `-Force`,
retrait de `-ErrorAction Stop`, garde `-ceq` remplacée par `-eq`, garde de
contexte retirée (la lecture part alors sur le mauvais tenant), ajout de
`ConvertTo-SecureString -AsPlainText`, ajout de `Remove-AzDisk`.

**Défauts trouvés par les bancs pendant ce lot :** (a) débordement horizontal à
390 px sur `azure-vm-arret` / `azure-vm-demarrage` (noms d'actions Azure sans point
de coupure), corrigé par `overflow-wrap:anywhere` sur `.cloud-bloc` ; (b) le banc
navigateur du LOT 7 figeait « 8 catégories » : la neuvième (Azure) est désormais
déclarée explicitement (`NB_CATEGORIES = 9`) ; (c) l'ordre d'exécution : un banc
qui n'avait aucune fiche à parcourir (catalogue lu avec un mauvais nom de
catégorie) aurait passé à vide, d'où une assertion « 24 fiches » en tête.

## 6. Moteurs PowerShell : annoncé vs réellement éprouvé

| Moteur | Annoncé par les fiches | Éprouvé |
|---|---|---|
| PowerShell 7.4.6 (Linux) | oui | **oui**, syntaxe + exécution avec doublures |
| Windows PowerShell 5.1 | oui (`#Requires -Version 5.1`, BOM, ASCII/UTF-8 vérifiés) | **NON EXÉCUTÉ**. Analyse syntaxique : la syntaxe réservée à 7 est cherchée et absente. Banc rendu exécutable sous 5.1 (`KJEMO_POWERSHELL=powershell.exe`) et **branché dans le job Windows de la CI — jamais joué** |
| Modules Az / Microsoft.Graph réels | — | **NON EXÉCUTÉ** (doublures seulement) |

Chaque fiche affiche dans son bloc « Dans Azure » ce qui a été validé et ce qui
ne l'a pas été ; le banc vérifie que les moteurs annoncés correspondent aux
moteurs éprouvés.

## 7. Les ensembles de 440, 712 et 856 scripts (et 880, 1 072)

Ce sont des **références de non-régression emboîtées**, pas des périmètres
concurrents. Aucune empreinte historique n'a été remplacée.

| Ensemble | Fichier de référence | Ancrage | Contenu |
|---|---|---|---|
| 440 | `test/scripts-baseline.json` (garde « Identité vs SHA de base 4c37ce2 » de `generate-ps1.mjs`) | SHA `4c37ce2` | scripts des premiers lots jusqu'au LOT 6A initial (chaîne d'ancrages 64, 176, 296, 440) |
| 712 | `test/scripts-baseline-712.json` | SHA `803870c` (LOT 6A v3 final) | les 440 + 272 scripts des LOTS 5 et 6A |
| 856 | `test/scripts-baseline-856.json`, comparée par `baseline-856.test.mjs` | phase 0 du LOT 7, arbre `433dec50`, au-dessus de `aff0f7a` | les 712 + 144 scripts du LOT 6B (18 assistants × 8 jeux de données) |
| 880 | matrices LOT 7 | LOT 7 | 856 + 24 scripts de jonction de domaine ; avec 344 `.sh` : 1 224 scripts |
| 1 072 `.ps1` | `test/generated/` | ce lot | 880 + **192** scripts Azure (24 × 8) |

Résultat après ajout d'Azure : 440/440 et 712/712 identiques octet par octet, 856
inchangés, 632 « nouveaux » scripts hors référence 440 (= 176 + 240 + 24 + 192, soit
LOT 5, LOT 6, jonction, Azure) et 360 hors référence 712. Les matrices du LOT 7
gardent leur photographie (153 outils / 1 224 scripts / 368 sources) en
**excluant** Azure ; les matrices LOT 8 sont distinctes (`LOT-8-MATRICE-*.json`).

## 8. Git

- Base : `78a2c8b9eecce70c14fa2da9ce3077d6d14ebacf` ; `git ls-remote` (lecture) au
  22 octobre : `reconciliation/lot7` toujours à `78a2c8b9`, `main` à `aff0f7a`.
- PR n° 7 (LOT 7) : **ouverte et non fusionnée selon la confirmation de Codex** ;
  **non revérifiée par moi** (l'API GitHub répond 403 « accès non activé » : un 403
  ne prouve pas l'absence d'une branche ou d'une PR).
- LOT 6C V2 : livraison distincte ; **non vérifié comme intégré**, non réappliqué.
  Aucun ancien bundle LOT 7 / 6C n'a été réappliqué.
- Commits du LOT 8 depuis la base : `d801ce4`, `1a79808`, `ec1c7c5`, `aa55888`,
  `97c4dbd`, `774ceb4`, puis les commits de livraison (voir le manifeste).
- Dépendances ajoutées : aucune (Playwright 1.44.1 déjà présent).
- Écarts d'intégration à prévoir : `dist/generators.mjs`, `dist/categories.mjs`,
  `dist/cmdlets.mjs`, `dist/app.js` (bloc cloud), `dist/styles.css`,
  `test/identity.test.mjs`, `test/generate-ps1.mjs`, `test/matrices-lot7.mjs`,
  `test/browser-identity.test.mjs`, `test/browser-lot7.test.mjs` : tous modifiés
  de façon ciblée, sans affaiblir de règle.

## 9. Limites et défauts connus

- Aucun essai sur un tenant réel : les **formes d'objets** renvoyées par Az /
  Microsoft.Graph (noms de propriétés, valeurs d'énumération) sont supposées par
  les doublures et peuvent différer selon la version des modules.
- Windows PowerShell 5.1 non exécuté (voir §6).
- Le rapport JSON contient `Machine` (nom d'hôte local) : à retirer avant de le
  partager si ce nom est sensible.
- Détection de secrets : heuristique.
- CI GitHub : étapes ajoutées (Linux : banc Azure pwsh, navigateur Azure, matrices
  LOT 8 ; Windows : banc Azure sous 5.1 puis 7) ; **aucune exécution distante**.
  Si le job 5.1 échoue, c'est l'information attendue, pas un échec du rapport.
- Les trois laboratoires (`docs/labs-azure/`) sont des guides NON EXÉCUTÉS.

## 10. Livrables

Code : `dist/validateurs-azure.mjs`, `dist/noyau-azure.mjs`, `dist/outils-azure*.mjs`
(six fichiers), `dist/outils-azure.mjs` · Bancs : `test/azure-assistants.test.mjs`,
`test/azure/*`, `test/browser-azure.test.mjs`, `test/matrices-lot8.mjs` ·
Matrices : `LOT-8-MATRICE-OUTILS.json`, `LOT-8-MATRICE-SCRIPTS.json`,
`LOT-8-MATRICE-COMMANDES.json`, `LOT-8-SOURCES.json` ·
Catalogue : `docs/CATALOGUE-24-ASSISTANTS-AZURE.md` · Roadmap :
`docs/FEUILLE-DE-ROUTE.md` · `CHANGELOG.md` · Laboratoires :
`docs/labs-azure/LAB-AZURE-0{1,2,3}-*.md` · Patch, bundle et manifeste SHA-256 :
voir le dossier de livraison.
