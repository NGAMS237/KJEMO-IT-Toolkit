# LOT 3 — Correctif CI · rapport

**Dépôt** : `NGAMS237/KJEMO-IT-Toolkit` · **Pull Request** : #4
**Branche** : `claude/lot-3-active-directory-avance`
**Phase A — rien d'autre n'a été touché.**

---

## 1. SHA de départ

| | |
|---|---|
| SHA poussé, branche LOT 3 | `8696cc7` (`8696cc758cf4c275b00565e5332378bafa63391d`) |
| Vérifié par | `git fetch origin claude/lot-3-active-directory-avance` puis `git rev-parse FETCH_HEAD` |
| État au moment du correctif | les deux vérifications GitHub Actions rouges |

Le SHA attendu est confirmé : la branche distante est bien à `8696cc7`.

---

## 2. Les deux journaux

**Ce qui a pu être lu, et ce qui ne l'a pas été — dit franchement.**

Les journaux détaillés des deux exécutions sont derrière une authentification
GitHub que cette session n'a pas : la page du job affiche *« Sign in to view
logs »*, et l'API GitHub répond que l'accès au dépôt n'est pas activé pour
cette session. **Je n'ai donc pas lu les journaux complets.** Ce qui a été lu,
sur les pages publiques de la PR, du run et des jobs :

| Vérification | Étape en échec | Annotation |
|---|---|---|
| `PS Syntax Check — LOT 0` | **Contre-épreuve sauvegarde bloquante — Windows PowerShell 5.1** | `Process completed with exit code 1.` |
| `Validation complète` | **Contre-épreuve sauvegarde bloquante — Windows PowerShell 5.1** | `Process completed with exit code 1.` |

Les étapes précédentes — génération des scripts, analyse PowerShell 5.1,
analyse PowerShell 7, aller-retour Unicode — étaient vertes dans les deux
exécutions.

### Première erreur réelle de chacun

La même, à la même étape, avec le même code de sortie. **Les deux
vérifications échouaient pour une seule et même cause** : elles invoquent
toutes deux `test/sauvegarde-bloquante.test.mjs` sous Windows PowerShell 5.1.

---

## 3. Cause

`test/sauvegarde-bloquante.test.mjs` construit un banc PowerShell qui exécute
le script sous test. Il y insérait deux chemins — celui du journal et celui du
script sous test — avec `JSON.stringify`.

JSON double les antislashs. Une chaîne PowerShell entre **guillemets** ne
traite pas l'antislash comme un échappement : elle le garde tel quel. Un chemin
Windows `C:\Users\runneradmin\AppData\Local\Temp\banc.ps1` arrivait donc dans
le banc sous la forme `C:\\Users\\runneradmin\\...`, que PowerShell lit
littéralement, séparateurs doublés compris. Le fichier n'était pas trouvé, le
banc sortait en erreur, le job échouait.

Sous Linux, les chemins n'ont pas d'antislash : le défaut était invisible. Il
n'est apparu qu'au premier passage réel sur `windows-latest`.

---

## 4. Reproduction locale

PowerShell 5.1 n'existe pas sur cette machine. **La reproduction n'est donc pas
celle de l'environnement exact : c'est la reproduction de la *classe* du
défaut**, obtenue en donnant au banc un répertoire temporaire hostile sous
Linux.

```
TMPDIR="/tmp/kjemo $HOME o'brien" node test/sauvegarde-bloquante.test.mjs
```

| Version du banc | Résultat |
|---|---|
| Avant correctif | **11 OK, 7 ÉCHECS** — la passe A réussissait à vide, les passes B et C échouaient |
| Après correctif | **21 OK, 0 ÉCHEC** |

Le profil « A passe, B et C échouent » est exactement celui observé en CI.

---

## 5. Correctif

Un seul commit, `fb09321`
(`fb0932112b098d9c7d519fd9f57902172ffecf21`), posé sur `8696cc7` :

**LOT 3 — CI : chemins du banc de sauvegarde transmis en littéraux PowerShell**

1. Les chemins passent par un helper `psLitteral()` : littéral PowerShell entre
   apostrophes, apostrophe doublée. C'est la seule forme où **rien** n'est
   interprété — ni l'antislash, ni `$`, ni l'accent grave.
2. Le remplacement textuel d'un chemin encodé, dans la passe C, est remplacé
   par un **paramètre** `scriptSousTest` du banc.
3. Les bancs sont lancés par `spawnSync` : la sortie d'erreur de PowerShell est
   conservée et **imprimée en diagnostic dès qu'une passe échoue**. Le prochain
   échec, s'il arrive, sera lisible dans le journal de CI.
4. Chaque passe A, B et C vérifie désormais un `MARQUEUR_EXECUTION` : un script
   qui ne démarre pas ne peut plus faire « réussir » une passe à vide.
5. La doublure de `Join-Path` retirait les séparateurs finaux `/` mais pas `\` :
   son expression régulière passe à `'[\\/]+$'`.

**Le test est durci, pas assoupli : 18 assertions → 21.**

### Ce qui n'a pas été fait

- Aucun test retiré ni affaibli.
- Aucun `continue-on-error`.
- Aucune étape critique rendue conditionnelle.
- Ni PowerShell 5.1 ni PowerShell 7 contournés.
- `.github/workflows/validate.yml` **inchangé**.
- Les dix commits du LOT 3 n'ont pas été reconstruits.

---

## 6. SHA final et état

| | |
|---|---|
| SHA final du correctif | `fb09321` / `fb0932112b098d9c7d519fd9f57902172ffecf21` |
| Poussé ? | **Non.** Le proxy refuse : `access denied by the git proxy: NGAMS237/KJEMO-IT-Toolkit is not in this session's authorized repository set` → HTTP 403 |
| Aucun jeton demandé, aucune restriction contournée | conforme à la consigne |
| État GitHub Actions après correctif | **inconnu** — le correctif n'étant pas poussé, aucune exécution n'a eu lieu dessus. Déclarer le contraire serait une invention. |
| Pull Request #4 | **non fusionnée** |

### Patch de repli

`LOT-3-CI-CORRECTIF-8696cc7.patch`, applicable sur `8696cc7` :

```
git checkout claude/lot-3-active-directory-avance
git am LOT-3-CI-CORRECTIF-8696cc7.patch
git push origin claude/lot-3-active-directory-avance
```

L'empreinte SHA-256 du patch figure dans `SHA256SUMS-LOT-4.txt`.

---

## 7. Non-régression locale après correctif

Depuis un clone propre de la branche, à `fb09321` :

| Contrôle | Résultat |
|---|---|
| `node --check` sur tous les modules | OK |
| `test/identity.test.mjs` | OK |
| `test/generate-ps1.mjs` | 296 scripts, 176/176 historiques identiques octet par octet |
| `test/sauvegarde-bloquante.test.mjs --powershell pwsh` | 21 OK, 0 ÉCHEC |
| `test/sauvegarde-bloquante.test.mjs --powershell powershell` | **NON EXÉCUTÉ** — Windows PowerShell 5.1 n'existe pas sur cette machine |
| BOM UTF-8 | présent sur tous les `.ps1` |
| Aller-retour Unicode | OK |
| Analyse PowerShell 7 | 296 scripts, 0 échec |
| Chromium / Playwright | OK |

**Windows PowerShell 5.1 n'a pas été exécuté. Il n'est pas déclaré réussi.**
Seule l'exécution sur `windows-latest`, une fois le patch appliqué, le dira.
