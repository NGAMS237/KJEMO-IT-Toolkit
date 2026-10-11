# LOT 4 — Stratégies de groupe avancées · rapport

**Dépôt** : `NGAMS237/KJEMO-IT-Toolkit`
**Branche** : `claude/lot-4-gpo-avance`
**SHA de base** : `fb09321` (`fb0932112b098d9c7d519fd9f57902172ffecf21`) — le
LOT 3 corrigé, **pas** `main`.

Partir de `main` (`a84a85c`) aurait logiquement supprimé les quinze assistants
Active Directory du LOT 3. La base est donc la pointe de la branche LOT 3, avec
son correctif de CI.

---

## 1. Les dix-huit assistants

| # | Identifiant | Sous-rubrique | Risque | Mode Appliquer |
|---|---|---|---|---|
| 1 | `gpo-inventory-report` | Diagnostic et inventaire | diagnostic | non |
| 2 | `gpo-health-report` | Diagnostic et inventaire | diagnostic | non |
| 3 | `gpo-resultant-set` | Diagnostic et inventaire | diagnostic | non |
| 4 | `gpo-refresh-diagnostic` | Diagnostic et inventaire | caution | oui |
| 5 | `gpo-create-link` | Création, liens et ciblage | caution | oui |
| 6 | `gpo-link-audit` | Création, liens et ciblage | diagnostic | non |
| 7 | `gpo-security-filter` | Création, liens et ciblage | caution | oui |
| 8 | `gpo-wmi-filter-readiness` | Création, liens et ciblage | diagnostic | non |
| 9 | `gpo-drive-mapping` | Environnement utilisateur | diagnostic | **non — préparation seule** |
| 10 | `gpo-printer-deployment` | Environnement utilisateur | diagnostic | **non — préparation seule** |
| 11 | `gpo-logon-startup-scripts` | Environnement utilisateur | diagnostic | **non — préparation seule** |
| 12 | `gpo-folder-redirection` | Environnement utilisateur | diagnostic | **non — préparation seule** |
| 13 | `gpo-session-desktop` | Sécurité des postes et serveurs | caution | oui |
| 14 | `gpo-device-restrictions` | Sécurité des postes et serveurs | caution | oui |
| 15 | `gpo-firewall-defender` | Sécurité des postes et serveurs | diagnostic | **non — aucun mode ne désactive quoi que ce soit** |
| 16 | `gpo-windows-update-services` | Sécurité des postes et serveurs | caution | oui |
| 17 | `gpo-software-shortcuts-browser` | Déploiement et maintenance | caution | oui (navigateur seulement) |
| 18 | `gpo-backup-restore-compare` | Déploiement et maintenance | **destructive** | oui, sous trois verrous |

`gpo-password`, du LOT 1, n'est **pas** dupliqué : la catégorie GPO compte donc
19 assistants au total.

---

## 2. Comptages

| | Avant LOT 4 | Après LOT 4 |
|---|---|---|
| Outils au catalogue | 37 | **55** |
| Scripts générés (8 jeux × outils) | 296 | **440** |
| Scripts figés par la référence | 176 | **296** |
| Empreintes distinctes parmi les nouveaux scripts | — | **144 / 144** |

Les 296 scripts d'avant le LOT 4 sont **identiques octet par octet** à chaque
exécution du banc. Aucun n'a changé.

---

## 3. Résultats des tests

Chaque ligne précise **de quelle nature** est la preuve. C'est le point qui
compte le plus dans ce rapport.

### 3.1 Test statique (lecture de code, aucune exécution)

| Contrôle | Résultat |
|---|---|
| `node --check` sur tous les modules de `dist/` et `test/` | **OK** |
| Aucun second exemplaire de validateur ou de générateur | **OK** |
| `generators.mjs` modifié de 2 lignes seulement | **OK** |

### 3.2 Génération JavaScript (exécution de `generate()`)

| Contrôle | Résultat |
|---|---|
| `generate(defaults)` pour les 55 outils | **55 / 55, 0 erreur** |
| 8 jeux de données valides par outil | **440 scripts, 0 erreur** |
| `generate()` en mode `Appliquer` pour les 8 outils GPO qui en proposent un | **8 / 8** |
| `validate()` sur valeurs valides **et** invalides, par champ | **OK** — voir §4 |
| Garde d'identité : 296 scripts d'avant le lot | **296 / 296 identiques** |
| Empreintes distinctes parmi les 144 nouveaux | **144 / 144** |
| BOM UTF-8 (EF BB BF) sur les 440 fichiers | **440 / 440** |
| **Total des assertions** `identity.test.mjs` | **18 482 OK, 0 ÉCHEC** |

### 3.3 Analyse PowerShell

| Moteur | Résultat |
|---|---|
| PowerShell 7.4.6 (`pwsh`), analyseur `Parser::ParseFile` sur les 440 scripts | **440 scripts, 0 échec** |
| Aller-retour JS → .ps1 → PowerShell → JSON | **16 OK, 0 ÉCHEC** |
| Contre-épreuve de sauvegarde bloquante, `--powershell pwsh` | **21 OK, 0 ÉCHEC** |
| **Windows PowerShell 5.1** | **NON EXÉCUTÉ.** Cette machine est sous Linux ; PowerShell 5.1 n'y existe pas et ne peut pas y être installé. Il n'est **pas** déclaré réussi par déduction. Les deux étapes de CI qui l'exécutent sur `windows-latest` restent le seul juge. |

### 3.4 Test navigateur (Chromium réel, Playwright, site servi en local)

| Contrôle | Résultat |
|---|---|
| Copier / aperçu / téléchargement strictement identiques (hors BOM et CRLF) | **OK** |
| Routes directes `#/outil/<id>` | **OK** |
| Recherche, favoris, historique | **OK** |
| Modes Débutant et Technicien | **OK** |
| Thèmes Clair, Sombre, Système | **OK** |
| Responsive 390 px, sans débordement horizontal | **OK — 0 px mesuré** |
| Accessibilité clavier et focus visible | **OK** |
| Aucune apostrophe typographique U+2018/U+2019 dans un script généré | **OK** |
| **Total des assertions** `browser-identity.test.mjs` | **3 045 OK, 0 ÉCHEC** |

### 3.5 Contre-épreuves (preuve que les contrôles détectent)

Les huit demandées, toutes présentes et toutes vérifiées :

| # | Contre-épreuve | Où | Résultat |
|---|---|---|---|
| 1 | Modification d'un script historique | `identity.test.mjs` | détectée |
| 2 | Retrait d'une validation | `identity.test.mjs` — chaque champ obligatoire refuse le vide, sur 51 champs GPO obligatoires | détectée |
| 3 | Ajout de `-Confirm:$false` | `auditerAnnulation()` sur une fiche fabriquée | détectée |
| 4 | Ajout d'un `-Force` non autorisé | `auditerAnnulation()` sur une fiche fabriquée | détectée |
| 5 | Modification d'une `Default Domain Policy` | formulaire + `generate()` + texte du script, sur les 7 assistants qui désignent une GPO nommée | détectée |
| 6 | Restauration sans sauvegarde réussie | ordre d'évaluation vérifié : le blocage précède `Restore-GPO` | détectée |
| 7 | Faux mode Diagnostic qui écrit | aucune écriture avant la garde `$Mode -eq 'Appliquer'`, sur les 18 scripts | détectée |
| 8 | Source Microsoft « contenu introuvable » | `sources-microsoft.mjs` passe une URL inexistante à son propre contrôle | détectée (404, titre `404 - Content not found`) |

**Contrôles positifs** : les 55 outils réels passent l'audit d'annulation ; les
18 annulations GPO aussi ; un nom de GPO ordinaire n'est pas bloqué par le
garde-fou ; un titre Microsoft valide n'est pas pris pour une page morte.

### 3.6 Exécution locale réelle

Ce qui a **réellement tourné** sur cette machine : Node v22.22.2, PowerShell
7.4.6, Chromium via Playwright, et les appels HTTPS vers `learn.microsoft.com`.

### 3.7 Exécution sur un domaine Windows Server réel

**AUCUNE.** Aucun des dix-huit assistants n'a été exécuté sur un contrôleur de
domaine, ni sur un poste joint à un domaine. Aucune applet `GroupPolicy` n'a
été appelée pour de vrai.

**Ce lot n'est pas « testé sur Windows Server ».** Il est testé par génération,
par analyse syntaxique PowerShell 7, par navigateur et par contre-épreuves.
C'est différent, et c'est dit ici parce que le confondre serait mentir.

---

## 4. Validateurs

Nouveaux validateurs, tous dans `dist/validateurs.mjs`, aucun doublon :

`validerNomGpo`, `validerNomGpoModifiable`, `refuseGpoParDefaut`,
`validerPorteeGpo`, `validerEtatLien`, `validerApplicationLien`,
`validerOrdreLien`, `validerCheminSysvol`, `validerNomScriptGpo`,
`validerRequeteWql`, `validerEspaceNomsWmi`, `validerMinutes`, `validerHeure`,
`validerUrlHttps`, plus les constantes `GPO_INTOUCHABLES`,
`EXTENSIONS_SCRIPT_GPO`, `PORTEES_GPO`, `ETATS_LIEN`, `APPLICATIONS_LIEN`.

Quelques refus qui méritent d'être nommés :

- `validerNomGpo` refuse `\ / : * ? " < > |` — ces caractères cassent le nom du
  dossier que `Backup-GPO` crée.
- `validerRequeteWql` exige un `SELECT`, exige une classe après `FROM`, et
  refuse `DELETE`, `UPDATE`, `INSERT`, `DROP`, `CREATE`, `EXEC`, `CALL`, le
  point-virgule et le saut de ligne.
- `validerCheminSysvol` exige `\SYSVOL\` ou `\NETLOGON\` : un script de
  connexion posé ailleurs n'est pas répliqué.
- `validerUrlHttps` refuse `http://`, `javascript:`, `data:`, les espaces et
  tout caractère de citation.
- `refuseGpoParDefaut` normalise en NFKD et retire les accents : `Défault
  Dömain Pölicy` est reconnu.

Chaque `generate()` commence par `assertValid(this, v)`. **Toute valeur
utilisateur passe par `psB64()`**, qui l'encode en Base64 et la restitue côté
PowerShell — ce qui neutralise les apostrophes typographiques, le dollar,
l'accent grave et les guillemets.

---

## 5. Sources Microsoft

| | |
|---|---|
| URL distinctes citées par le catalogue | **135** |
| Vérifiées en ligne (code HTTP **et** titre de la page) | **135 / 135** |
| Échecs | **0** |
| Contrôles exécutés | **541** |
| Liens morts trouvés et remplacés | **3** |

Les trois liens remplacés étaient des pages `troubleshoot/windows-server/` qui
renvoient aujourd'hui un 404 : une page de diagnostic de stratégie, et deux
pages d'impression. Elles ont cédé la place à des pages vérifiées.

**Le contrôle regarde le titre, pas seulement le code HTTP** : Microsoft Learn
sert certaines pages mortes avec un code 200, et un contrôle de code seul ne
prouverait rien. Deux exceptions documentées : les pages d'archive, dont le
dernier segment d'URL est un identifiant (`cc754699(v=ws.11)`) et ne peut rien
recouper, et les pages renommées, acceptées si l'URL finale reste dans la même
section de la documentation.

Détail complet : `LOT-4-SOURCES.json`.

---

## 6. Fichiers modifiés

| Fichier | Nature |
|---|---|
| `dist/outils-gpo.mjs` | **créé** — 4 722 lignes, les 18 assistants |
| `dist/validateurs.mjs` | étendu — +202 lignes, aucun doublon |
| `dist/generators.mjs` | **+2 lignes** — un `import`, une boucle d'assemblage |
| `test/scripts-baseline.json` | référence passée de 176 à 296 scripts, chaîne d'ancrages |
| `test/identity.test.mjs` | section LOT 4, contre-épreuves |
| `test/generate-ps1.mjs` | valeurs GPO pour les 8 jeux de données |
| `test/sources-microsoft.mjs` | **créé** — banc de vérification des sources |
| `test/captures-lot4.mjs` | **créé** — production des preuves visuelles |
| `package.json` | 2 scripts npm ajoutés |
| `LOT-4-*.json`, `LOT-4-*.md`, `docs/captures-lot4/` | livrables |

Aucun autre fichier n'est touché. Aucune dépendance ajoutée. Aucun framework,
aucun bundler, aucun backend.

---

## 7. Captures

Dans `docs/captures-lot4/` :

| Fichier | Ce qu'il montre |
|---|---|
| `01-accueil-bureau-clair.png` | accueil 1440 px, thème clair |
| `02-accueil-bureau-sombre.png` | même page, thème sombre |
| `03-recherche-gpo.png` | recherche « sauvegarde gpo » |
| `04-fiche-debutant.png` | fiche en mode Débutant |
| `05-fiche-technicien.png` | même fiche en mode Technicien |
| `06-validation-refusee.png` | `Default Domain Policy` saisie — refus |
| `06b-validation-refusee-gros-plan.png` | le message de refus, lisible |
| `07-rapport-genere.png` | aperçu du script d'inventaire |
| `08-mobile-390-accueil.png` | accueil à 390 px — **0 px de débordement** |
| `09-mobile-390-fiche.png` | fiche à 390 px — **0 px de débordement** |
| `10-mobile-390-sombre.png` | 390 px, thème sombre |

---

## 8. Règles de sécurité : ce qui est vérifié sur les scripts générés

Les 18 scripts, en mode Diagnostic **et** en mode Appliquer, ne contiennent
aucun de ces motifs — vérifié par assertion :

`-Confirm:$false` · `Invoke-Expression` · `Remove-GPO` · `Remove-GPLink` ·
`Set-ExecutionPolicy` · désactivation de Defender · désactivation du pare-feu ·
`Restart-Computer` · `shutdown` · `gpupdate /boot` · `gpupdate /logoff` ·
`ConvertTo-SecureString` · `-AsPlainText`

S'y ajoutent : en-tête `#Requires -Version 5.1` sur chaque script, aucune
apostrophe typographique littérale, aucun champ de formulaire ne demandant un
mot de passe ou un secret, aucun identifiant écrit dans un rapport.

> **Avertissement, pour mémoire** : certains scripts **historiques** du projet
> contiennent déjà `-Force`. Ce rapport ne prétend pas le contraire. Le
> contrôle ci-dessus porte sur les scripts du LOT 4.

---

## 9. Limites connues

1. **Aucune exécution sur un domaine réel.** Le comportement des applets
   `GroupPolicy` sur un domaine vivant n'est pas prouvé.
2. **Windows PowerShell 5.1 n'a pas été exécuté localement.** Seule la CI sur
   `windows-latest` peut le faire.
3. **Quatre assistants ne configurent rien** — c'est voulu et documenté
   (`LOT-4-DECISIONS.md` §1), mais il faut le savoir avant de les ouvrir.
4. La comparaison de `gpo-backup-restore-compare` lit les valeurs de registre
   et les modèles d'administration des deux rapports XML. **Les préférences et
   les paramètres de sécurité ne sont pas couverts** par cette comparaison ;
   le script le dit, et renvoie aux rapports HTML complets.
5. La lecture du code produit d'un paquet MSI passe par l'interface
   d'automatisation de Windows Installer — documentée, mais c'est bien un objet
   COM. Si cette lecture échoue, l'assistant le signale et continue.
6. `gpo-resultant-set` interroge une machine distante : il demande que WinRM et
   le pare-feu le permettent, ce que le script vérifie mais ne corrige pas.

---

## 10. État de livraison

| | |
|---|---|
| Branche | `claude/lot-4-gpo-avance` |
| SHA de base | `fb09321` — LOT 3 corrigé |
| SHA final | voir `SHA256SUMS-LOT-4.txt` et le patch |
| Poussé ? | **Non.** Le proxy refuse : `NGAMS237/KJEMO-IT-Toolkit is not in this session's authorized repository set` → HTTP 403. **Aucun jeton n'a été demandé, aucune restriction contournée.** |
| Patch de repli | `LOT-4-GPO-AVANCEES-fb09321.patch`, applicable avec `git am` |
| Fusion dans `main` | **aucune** |
| Déploiement | **aucun** |
| Réseau, Imprimantes, Linux | **non commencés**, conformément à la consigne |

### Appliquer le patch

```
git fetch origin claude/lot-3-active-directory-avance
git checkout -b claude/lot-4-gpo-avance fb09321
git am LOT-4-GPO-AVANCEES-fb09321.patch
git push origin claude/lot-4-gpo-avance
```

Le patch du LOT 3 (`LOT-3-CI-CORRECTIF-8696cc7.patch`) doit être appliqué
**d'abord**, puisque `fb09321` en est le résultat.

---

## Verdict

**READY FOR CODEX REVIEW.**

Avec les réserves nommées au §9 — et en particulier celle-ci, qui n'est pas une
formalité : **aucun de ces dix-huit assistants n'a jamais parlé à un vrai
contrôleur de domaine.**
