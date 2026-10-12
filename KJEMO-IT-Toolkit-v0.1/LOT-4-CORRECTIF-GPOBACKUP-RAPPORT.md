# LOT 4 — Correctif `Get-GPOBackup` · rapport

**Dépôt** : `NGAMS237/KJEMO-IT-Toolkit`
**Branche** : `claude/lot-4-gpo-avance`
**Commit** : `4c37ce2` — *LOT 4 — Correctif inventaire et restauration des sauvegardes GPO*
**Parent** : `4faf2ea` (fin du LOT 4 initial)

---

## 1. État réel du dépôt, vérifié et non supposé

```
git status --short        (vide, arbre propre)
git branch --show-current claude/lot-4-gpo-avance
git rev-parse HEAD        4faf2ea3ab7a165bc364006545f3eb561972704d   (avant correctif)
git rev-parse origin/main a84a85c60690bcd38a0e08e4c2b6bfb3fe786b8b
git remote -v             origin https://github.com/NGAMS237/KJEMO-IT-Toolkit.git
```

`git log --oneline -15` à ce moment-là :

```
4faf2ea LOT 4 (9/n) — Matrices, captures, sources et documentation
7881934 LOT 4 (8/n) — Tests, contre-épreuves et vérification des sources
6d673c8 LOT 4 (7/n) — Huit jeux de données réellement distincts pour les outils GPO
5bed395 LOT 4 (6/n) — Logiciels, raccourcis, navigateur, sauvegarde et comparaison
b73f7f3 LOT 4 (5/n) — Verrouillage, USB, Defender, pare-feu et mises à jour
c629322 LOT 4 (4/n) — Lecteurs, imprimantes, scripts et redirection
e293aa3 LOT 4 (3/n) — Création, liens, héritage, sécurité et WMI
e8c78de LOT 4 (2/n) — Diagnostic, inventaire, gpresult et gpupdate
08302f9 LOT 4 (1/n) — Socle GPO, validateurs et référence des 296 scripts
fb09321 LOT 3 — CI : chemins du banc de sauvegarde transmis en littéraux PowerShell
8696cc7 LOT 3 — corriger affichage de version PowerShell dans la CI
e212eb4 LOT 3 — Correctifs Codex v2 : sauvegarde bloquante, DC explicite et CI Windows
c59068f LOT 3 (8/n) — Tests navigateur, sécurité, responsive et documentation
33039f3 LOT 3 (7/n) — Canal sécurisé et rapport complet du domaine
b30f47c LOT 3 (6/n) — DNS Active Directory, DCDIAG et REPADMIN
```

**Conséquence** : `main` est à `a84a85c`. **Ni le LOT 3 ni le LOT 4 n'y sont.** Le
travail se poursuit donc depuis `claude/lot-4-gpo-avance`, jamais depuis `main`.
Aucun `git am` n'a réécrit de SHA dans ce dépôt de travail.

---

## 2. Le défaut

`gpo-backup-restore-compare` appelait `Get-GPOBackup`.

**Cette applet de commande n'existe pas.** Le module `GroupPolicy` fournit
`Backup-GPO`, `Restore-GPO`, `Import-GPO`, `Get-GPOReport`, `Get-GPO`,
`New-GPO`, `New-GPLink`, `Set-GPLink`, `Get-GPInheritance`,
`Get-GPPermission`, `Set-GPPermission`, `Get-GPRegistryValue`,
`Set-GPRegistryValue` et `Get-GPResultantSetOfPolicy` — **rien pour lister les
sauvegardes**.

L'enfermer dans un `try/catch` puis se rabattre sur `manifest.xml` ne la faisait
pas exister. Cela masquait l'erreur, et le commentaire qui l'accompagnait
(« n'existe pas sur toutes les versions ») laissait croire qu'elle existait
ailleurs. C'est le genre de phrase qui survit dix ans dans un code.

---

## 3. Ce qui a été fait

### 3.1 Inventaire — une inspection de fichiers, annoncée comme telle

Le script lit maintenant le format de dossier que GPMC et `Backup-GPO`
produisent, inchangé depuis Windows Server 2003 :

```
<dossier>\manifest.xml              index des sauvegardes
<dossier>\{BackupId}\               une sauvegarde
<dossier>\{BackupId}\bkupInfo.xml
<dossier>\{BackupId}\gpreport.xml
```

Deux passes : l'index d'abord, puis les sous-dossiers `{BackupId}` — **qui font
foi**, parce qu'une copie présente et absente de l'index reste valide, et que
l'inverse n'est pas vrai. La fusion passe par `Add-KjemoSauvegarde`, qui
déduplique sur le `BackupId`.

Le rapport porte en première ligne :

> *Méthode : lecture du format de dossier produit par GPMC — Aucune applet de
> commande Microsoft ne liste les sauvegardes de GPO. Ce script lit manifest.xml
> et les dossiers {BackupId} écrits par Backup-GPO.*

### 3.2 Sauvegarde — l'objet renvoyé est gardé immédiatement

```powershell
$copie = Backup-GPO -Guid $gpo.Id -Path $Dossier -Domain $Domaine -Comment ... -ErrorAction Stop
$idFraiche = $copie.Id.ToString().Trim('{', '}')
$dossierFraiche = Join-Path $Dossier ("{" + $idFraiche + "}")
```

L'objet `Microsoft.GroupPolicy.GpoBackup` est conservé à la ligne suivante : son
`Id` est le seul identifiant fiable de la copie qui vient d'être écrite. Le
relire depuis le dossier serait déjà une supposition.

La copie n'est déclarée réussie (`$sauvegardeOk = $true`) qu'après vérification
du **dossier**, de **bkupInfo.xml** et de **gpreport.xml**. S'il en manque un, le
rapport le nomme.

### 3.3 Restauration — un identifiant, jamais « la plus récente »

`brIdSauvegarde` devient **obligatoire dès que l'action est Restaurer**, dans les
deux modes — y compris en Diagnostic, pour que l'aperçu montre la copie qui
serait restaurée.

Avant d'agir, le script imprime :

```
--- Restauration : ce qui va etre fait ---
  Strategie cible   : <nom> {<guid>}
  Domaine           : <fqdn>
  Dossier           : <unc>
  BackupId restaure : <guid>
  Copie du <horodatage> dans <dossier>
  Copie de secours  : <guid> dans <dossier>
```

Les cinq éléments demandés y sont. `Restore-GPO` est appelée avec `-BackupId`,
`-Path` et `-Domain` explicites, sur la copie **trouvée dans l'inventaire**
(`$copieChoisie`), pas sur une chaîne arbitraire.

### 3.4 Verrous conservés

| Verrou | État |
|---|---|
| Sauvegarde fraîche réussie | conservé — `$sauvegardeOk` |
| Sauvegarde relue | **renforcé** — dossier + bkupInfo.xml + gpreport.xml |
| Nom de la GPO retapé | conservé |
| Mode Appliquer explicite | conservé |
| Aucun `-Confirm:$false` | conservé, vérifié par assertion |
| Stratégies par défaut refusées | conservé |
| Aucune suppression de GPO | conservé |

Un verrou de plus : l'identifiant de sauvegarde obligatoire.

---

## 4. La garde des commandes externes

### 4.1 `dist/cmdlets.mjs` — inventaire déclaratif

| | |
|---|---|
| Applets de commande déclarées | **154** — module, système compatible, page Microsoft |
| Binaires Windows déclarés | **18** — `dcdiag`, `gpupdate.exe`, `netsh`, `icacls`, `ipconfig`… |
| Commandes explicitement bannies | **8**, chacune avec sa raison |

`Get-GPOBackup` figure parmi les bannies, avec son motif écrit noir sur blanc :
« N'existe pas. Le module GroupPolicy ne fournit aucune applet de commande pour
lister les sauvegardes. » Le message d'échec explique, au lieu de dire
« inconnue ».

### 4.2 `scripts/Test-KjemoCmdlets.ps1` — le banc

Il lit la **grammaire** de chaque script (AST PowerShell), pas une expression
régulière. Deux exclusions délibérées et documentées :

- les fonctions définies dans le script lui-même ;
- le contenu des blocs `-Filter` et `-FilterScript`, où `SamAccountName` est un
  nom de propriété et non une commande.

Avec `-VerifierPresence`, il interroge `Get-Command` pour chaque applet dont le
module est **réellement présent** sur la machine. Une applet absente parce que
son rôle n'est pas installé n'est pas une erreur ; une applet absente alors que
son module est chargé en est une.

**Contre-épreuve intégrée** : le banc fabrique un script contenant
`Get-GPOBackup` et une commande inventée, et échoue si son propre contrôle ne
les repère pas.

### 4.3 CI Windows

Deux étapes ajoutées à `.github/workflows/validate.yml`, avant les tests
navigateur, sans `continue-on-error` et sans `if` :

```
Contrôle des commandes GPO — Windows PowerShell 5.1
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-KjemoCmdlets.ps1 -VerifierPresence

Contrôle des commandes GPO — PowerShell 7
  pwsh -NoProfile -File ./scripts/Test-KjemoCmdlets.ps1 -VerifierPresence
```

Chaque étape **refuse de tourner sous le mauvais moteur** (`$PSVersionTable.PSEdition`)
plutôt que de se replier, et chaque journal affiche le moteur et sa version.

### 4.4 Documentation vérifiée

| | |
|---|---|
| URL distinctes contrôlées | **222** (135 des fiches + 87 de l'inventaire de commandes) |
| Vérifiées par code HTTP **et** titre | **222 / 222** |
| Échecs | **0** |
| Contrôles exécutés | **889** |
| Lien mort trouvé et remplacé | 1 (`windows-commands/repadmin`) |

---

## 5. Les deux autres défauts trouvés par cette garde

Ils sont corrigés ici. Les nommer vaut mieux que les glisser dans un commit où
personne ne les verrait.

### 5.1 `gpo-link-audit` — un reste de gabarit JavaScript

Le script généré contenait :

```powershell
[void]$cibles.Add((domainToDnMarqueur))
```

`domainToDnMarqueur` n'est ni une commande, ni une variable : c'est un marqueur
de gabarit resté en place. À l'exécution, PowerShell aurait cherché une commande
de ce nom et levé une erreur. **Aucun contrôle textuel ne l'aurait vu** — seule
l'analyse grammaticale le fait apparaître comme un appel de commande.

Corrigé : `$DomaineDn` est une variable encodée en Base64 comme toutes les
autres valeurs, et la racine du domaine est ajoutée aux cibles.

### 5.2 `gpo-windows-update-services` — une interpolation qui n'interpolait rien

```powershell
-Valeur ("de ${debut}h a ${fin}h")
```

`${debut}` et `${fin}` sont une syntaxe PowerShell valide — mais ces variables
n'existent pas dans le script, qui définit `$DebutActif` et `$FinActif`. Le
rapport aurait affiché « de h a h ». Corrigé en `$($DebutActif)` et
`$($FinActif)`.

Une assertion ajoutée refuse désormais, dans tout script généré, un `${...}` non
substitué ou un identifiant contenant « Marqueur ».

---

## 6. Scripts régénérés : combien, et pourquoi

| Outil | Fichiers changés | Raison |
|---|---|---|
| `gpo-backup-restore-compare` | 8 | le correctif demandé |
| `gpo-link-audit` | 8 | §5.1 — marqueur de gabarit |
| `gpo-windows-update-services` | 8 | §5.2 — interpolation morte |
| **Total** | **24 / 440** | |

**416 scripts sont inchangés**, dont les **296** d'avant le LOT 4, toujours
identiques octet par octet à la référence `fb09321`.

Un jeu de données a dû évoluer : `chemin-avec-apostrophe` demande une
restauration, qui exige désormais un identifiant de sauvegarde. Un GUID lui a
été donné. Sans cela, `generate()` aurait levé — ce qui est exactement le
comportement voulu.

---

## 7. Barrière CI — ce qui a réellement tourné

| Contrôle | Nature | Résultat |
|---|---|---|
| `node --check` sur tous les modules | statique | **OK** |
| Génération des 440 scripts | JavaScript | **440, 0 erreur** |
| Identité des 296 scripts d'avant LOT 4 | JavaScript | **296 / 296 identiques** |
| `identity.test.mjs` | JavaScript | **19 627 OK, 0 ÉCHEC** |
| BOM UTF-8 | fichiers | **440 scripts + 3 bancs, 0 échec** |
| Analyse PowerShell 7 des 440 scripts | PowerShell 7.4.6 | **440, 0 échec** |
| Aller-retour Unicode | PowerShell 7.4.6 | **16 OK, 0 ÉCHEC** |
| Contre-épreuve sauvegarde bloquante | PowerShell 7.4.6 | **21 OK, 0 ÉCHEC** |
| Contrôle des commandes | PowerShell 7.4.6 | **0 échec, 2 contre-épreuves OK** |
| Tests navigateur Chromium | navigateur réel | **3 045 OK, 0 ÉCHEC** |
| Sources Microsoft | réseau | **222 URL, 889 contrôles, 0 échec** |

### Ce qui n'a PAS tourné

| | |
|---|---|
| **Windows PowerShell 5.1** | **NON EXÉCUTÉ.** Machine Linux ; 5.1 n'y existe pas et ne peut pas y être installé. Ni le parsing, ni la contre-épreuve, ni le contrôle des commandes n'ont tourné sous ce moteur. Ils ne sont pas déclarés réussis par déduction. |
| **`Get-Command -VerifierPresence`** | **NON EXÉCUTÉ.** Aucun module Windows n'est présent ici. Le banc le dit lui-même quand c'est le cas, plutôt que d'afficher « 0 échec » et de laisser croire. |
| **Exécution sur un domaine réel** | **AUCUNE.** Aucune applet `GroupPolicy` n'a été appelée pour de vrai. `Backup-GPO` et `Restore-GPO` n'ont jamais tourné. |
| **GitHub Actions** | **AUCUNE EXÉCUTION.** Le push est refusé (§8) : rien n'a tourné sur `windows-latest`. Actions n'est pas déclaré vert. |

---

## 8. Push

```
git push origin HEAD:claude/lot-4-gpo-avance
remote: access denied by the git proxy: NGAMS237/KJEMO-IT-Toolkit is not in
        this session's authorized repository set
fatal: ... The requested URL returned error: 403
```

**Une seule tentative.** Aucun jeton demandé, aucune restriction contournée.

### Appliquer le patch — commandes exactes (CMD Windows)

```cmd
cd /d C:\chemin\vers\KJEMO-IT-Toolkit
git fetch origin
git checkout claude/lot-4-gpo-avance
git am LOT-4-CORRECTIF-GPOBACKUP.patch
git push origin claude/lot-4-gpo-avance
```

Le patch s'applique sur `4faf2ea`. Son empreinte SHA-256 figure dans
`SHA256SUMS-LOT5.txt`.

---

## 9. Verdict

**READY FOR CODEX REVIEW** pour la partie corrigée.

Le LOT 4 **n'est pas déclaré validé** : Windows PowerShell 5.1 n'a pas été
exécuté, la vérification de présence des applets n'a pas eu lieu, et aucune
exécution sur un domaine réel n'a été faite. Ces trois contrôles sont branchés
dans la CI et attendent un agent `windows-latest`.
