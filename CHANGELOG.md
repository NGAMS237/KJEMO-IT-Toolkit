# Journal des changements

## Intégration Azure + Cisco (branche claude/integration-azure-cisco)

Réunit LOT 8 (`8633b46`, Azure et Entra ID, 24 assistants) et RESEAU-CISCO-01 (`5168d9e`, Réseau et Cisco, 19 assistants) sur la base commune `78a2c8b`. Aucun lot n'est écrasé.

- Catalogue : 196 assistants = 153 historiques + 24 Azure + 19 Cisco ; 10 catégories canoniques ; 9 visibles, 10 cartes avec « Tout », Imprimantes masquée tant qu'elle est vide.
- 12 fichiers en conflit résolus à la main (voir `INTEGRATION-AZURE-CISCO-RAPPORT.md`) ; les blocs pédagogiques `cloud` ET `cisco`, les trois formats de téléchargement (.ps1 BOM, .sh, .ios.txt sans BOM) sont conservés.
- Le lien `KJEMO-IT-Toolkit-v0.1/node_modules`, suivi par erreur par le checkpoint Cisco, est retiré du suivi ; `.gitignore` protège `node_modules` (dossier ET lien).
- Matrices : LOT 7 inchangées (153 / 1 224 / 368), LOT 8 et Cisco vérifiées séparément.
- Nouveau banc navigateur d'intégration (Azure puis Cisco, Cisco puis Azure, sans rechargement).
- Corrections de bancs : compte d'outils du banc Cisco calculé ; contre-épreuve LOT 7 M01 re-ciblée sur le site d'appel initial après le refactor `normaliserSortie` ; compteurs de catégories 9 → 10 (LOT 7 navigateur, Cisco navigateur, identité).
- Non fait : push, CI distante, Windows PowerShell 5.1, essai sur tenant Azure ou équipement Cisco réels.

## LOT 8 — Azure et Microsoft Entra ID (branche claude/lot-8-azure-entra-id)

**Etat : developpe localement, teste localement. NON pousse, NON teste en CI
GitHub, NON fusionne, NON deploye. Windows PowerShell 5.1 : NON EXECUTE.
Tenant / abonnement Azure reel : NON EXECUTE.** Base `78a2c8b`.

- **24 assistants** dans la nouvelle categorie « Azure et Entra ID » (6 familles,
  `.ps1`, 5.1 et 7). 21 en lecture seule ; 3 agissent apres `-WhatIf` et phrase
  exacte (`DEMARRER <vm>`, `ARRETER <vm>`, `RESTAURER <vm> VERS <groupe>`), sans `-Force`.
- Aucune connexion, aucun changement de contexte, aucune cle / SAS / secret.
  Identifiants tronques dans les rapports. Une donnee illisible rend le rapport
  INCOMPLET : jamais « sain ». Sortie Console / JSON / CSV (CSV neutralise contre les formules).
- Garde de secrets en champ : filet commun (heuristique, pas une garantie).
- Defaut mobile corrige : les noms d'actions Azure sans point de coupure
  debordaient a 390 px (`overflow-wrap` sur `.cloud-bloc`).
- Bancs : `test/azure-assistants.test.mjs` (doublures PowerShell, contre-epreuves),
  `test/browser-azure.test.mjs` (Playwright), `test/matrices-lot8.mjs`. Branches dans
  `package.json` et dans les deux workflows (job Windows : 5.1 et 7).
- Matrices `LOT-8-*.json`, `docs/CATALOGUE-24-ASSISTANTS-AZURE.md`,
  `LOT-8-SOURCES.json` (81 sources Azure/Entra/Graph verifiees en ligne),
  `docs/labs-azure/` (3 guides NON EXECUTES), `LOT-8-RAPPORT.md`.
- Les 440 / 712 / 856 scripts historiques et les matrices LOT 7 sont inchanges.
## RESEAU-CISCO-01 — Réseau et Cisco : socle IOS, VLAN, trunks, DTP, VTP

**Etat : developpe localement, teste localement. NON pousse (acces GitHub refuse
depuis la session), NON teste en CI distante, NON fusionne, NON deploye.
Packet Tracer et commutateur reel : NON EXECUTE.** Branche `claude/reseau-cisco-01`,
base `78a2c8b`, sans dependance au code Azure du LOT 8.

- 19 assistants (nouvelle categorie « Reseau et Cisco », 6 sous-rubriques) : socle
  (modes IOS, identification, console/SSH, sauvegarde, interface, gestion IP, table
  MAC, port-security x2) puis VLAN, port d'acces, trunks, DTP (simulation), VTP
  (diagnostic, configuration v1/v2, raccordement) et parcours de diagnostic.
- Sortie `.ios.txt` : plateforme `Cisco`, ni BOM, ni CRLF, ASCII, aucun « ? » ni
  tabulation ; lecture seule par defaut ; mode Configuration = phrase exacte.
- Garde-fous : aucune connexion ; aucun mot de passe en champ (lignes « a taper a
  la main ») ; liste de VLAN d'un trunk jamais remplacee (add/remove) ; aucune
  suppression de VLAN, aucun `vlan.dat`, aucun reset, aucune plage d'interfaces ;
  sauvegarde persistante seulement dans son assistant ; VTP v3 refuse.
- Analyseur de sorties collees (`show vlan brief`, `show interfaces trunk`,
  `show vtp status`) : formats declares, « NON RECONNU » sinon, jamais un diagnostic
  execute. Echantillons ecrits a la main, non captures.
- Tests : `cisco-assistants` (3 009 controles), `browser-cisco` (1 028), matrices,
  sources (10 URL cisco.com confirmees par lecture web, 2 non confirmees).
- Bancs historiques recadres sans toucher a leurs perimetres (matrices LOT 7 : 153
  outils / 1 224 scripts / 368 sources ; sources Microsoft ; cmdlets).
- Corrige pendant le developpement : un saut de ligne final passait dans plusieurs
  validateurs ; les notes de commentaire n'etaient pas protegees d'un « \n ».
- Limites : syntaxe IOS rapprochee de la documentation, jamais essayee ; detection
  de secrets = heuristique ; `!` en mode utilisateur incertain (option
  « Commandes seules »).

## LOT 7 (27/n) — Netplan : passerelle et fichier cloud-init

**Etat inchange : developpe localement, teste localement. NON pousse, NON teste
en CI GitHub, NON fusionne, NON deploye.**

Un seul outil modifie : `netplan-readiness`. Seuls ses 8 scripts `.sh` changent ;
les 880 `.ps1` et les 336 autres `.sh` restent identiques octet par octet.

- **Constat.** `50-cloud-init.yaml` n'etait ni genere ni propose (le nom par
  defaut est `99-kjemo-reseau.yaml`) : il figurait dans un message informatif,
  un commentaire et une erreur courante. Mais le formulaire l'acceptait, et la
  mise en place l'aurait ecrase. De meme, la passerelle par defaut n'etait pas
  l'adresse de l'hote, mais le formulaire acceptait cette valeur.
- **Passerelle.** Facultative en statique (sans elle, aucune route par defaut
  n'est ecrite). Renseignee, elle doit etre une IPv4 valide du meme sous-reseau,
  differente de l'hote, de l'adresse du reseau et de l'adresse de diffusion.
- **Fichier.** Un nom contenant `cloud-init` est refuse. Le script inventorie
  `/etc/netplan`, detecte les fichiers cloud-init (en-tete ou nom), les annonce,
  ne les modifie jamais, remet un candidat separe, le valide sur une copie,
  refuse un nom deja present, et s'arrete quand plusieurs fichiers declarent
  deja l'interface. Jamais de `netplan apply`.
- **Preuve.** `test/netplan-v2.test.mjs` : 31 refus, 51 controles positifs,
  22 contre-epreuves (chaque verrou arrache et vu).
- **Rapport final.** Une seule branche canonique, mesuree par
  `git branch --show-current` ; les bancs locaux et la verification en ligne
  des sources sont distingues explicitement.

## LOT 7 — Linux, Bash, Samba et NFS (commits 1 a 26)

**Etat : developpe localement, teste localement. NON pousse, NON teste en CI
GitHub, NON fusionne, NON deploye. Ubuntu Server reel, controleur Samba AD
reel, export NFS reel, jonction de domaine reelle : NON EXECUTE.**

- 46 assistants : 43 Linux (Bash) et 3 jonction de domaine (PowerShell) ;
  153 outils au total, 1224 scripts de reference (880 `.ps1`, 344 `.sh`),
  112 commandes rapides.
- 25/n : banc navigateur Chromium reel (8 categories, 46 routes, recherche,
  favoris, historique, clavier, 390 px) et 16 contre-epreuves ; 19 familles de
  tests negatifs (refus, controle positif, contre-epreuve) et 12 pannes
  produit injectees ; sonde de capacites (chown, mknod) ; dette 6B detectee
  sans modification ; CI Linux etendue sans continue-on-error.
- Correctif produit : l'apercu des assistants Bash utilise `normalizeScriptSh`
  (42 apercus etaient corrompus par la normalisation PowerShell).
- 26/n : documentation, matrices (`LOT-7-MATRICE-*.json`, generees par
  `test/matrices-lot7.mjs`), sources verifiees en ligne (2 ecarts documentes),
  feuille de route.

## LOT 6 correctif V3 — revue Codex finale

**Etat : developpe localement, teste localement. NON fusionne, NON deploye,
NON execute sur un poste Windows reel.**

Un seul commit correctif, au-dessus de f0ea43c, sur deux defauts.

- **Gardien de chemin, correctif de SECURITE.** Test-KjemoCheminSur ne
  comparait que le DERNIER segment du chemin canonique : il refusait
  `C:\Projet\.git` mais acceptait `C:\Projet\.git\journaux`,
  `C:\Projet\.env\logs`, `C:\Projet\.ssh\rapports` et
  `C:\Windows\Temp\Kjemo`. Un gardien que l'on contourne en ajoutant un
  sous-dossier ne garde rien. Il comparait en outre des NOMS de dossiers, donc
  tout dossier appele « Windows » etait refuse meme sur un disque de donnees.
  Desormais : les segments sensibles (.git, .env, .ssh, System Volume
  Information, $Recycle.Bin) sont refuses dans N'IMPORTE QUEL segment, sans
  tenir compte de la casse ; les racines systeme sont lues dans les variables
  Windows (SystemRoot, ProgramFiles, ProgramFiles(x86), ProgramData, Boot,
  Recovery) et le chemin est refuse s'il leur est egal ou situe dessous ; la
  racine des profils et un profil complet sont refuses, mais pas leurs
  sous-dossiers. Le message nomme la zone detectee.
  Deux commutateurs explicites levent UNIQUEMENT la regle des racines systeme :
  -RacineSystemeAutorisee pour les deux entrees internes de la liste blanche du
  nettoyage des temporaires, et -LectureSeule pour les trois assistants qui
  LISENT le chemin sans jamais y ecrire.
- **temp-cleanup, comptage final exact.** Un fichier reapparu pendant la
  verification finale restait dans le nombre annonce supprime et dans les
  octets annonces liberes. Deux resultats sont desormais distincts :
  « suppressions confirmees immediatement » et « absence confirmee a la
  verification finale ». Seul le second alimente le nombre et les megaoctets
  annonces, et la taille de chaque chemin est conservee pour que le total se
  recalcule exactement.

### Scripts modifies

48 scripts, soit 6 outils x 8 jeux de donnees : windows-update-repair,
application-wont-start, windows-service-control, defender-scan, dism-repair,
temp-cleanup. Aucun autre outil ne change.

16 de ces scripts (windows-update-repair et application-wont-start) faisaient
partie de la reference des 712. La baseline est donc REGENEREE, avec sa
justification et les empreintes d'avant conservees dans
test/scripts-baseline-712.json, section regenerationV3.

### Validation mesuree

- Identite des fiches : 43 730 OK, 0 echec.
- Generation : 856 fichiers, 712/712 identiques a la baseline regeneree.
- Contre-epreuves des verrous : 1 110 OK, 0 echec (832 avant ce correctif).
- Fiches du LOT 6B : 18/18. BOM : 861 OK. Inventaire AST : OK.
- Navigateur : 5 075 OK et 418 OK. Sources : 315 verifiees en ligne.
- **Windows PowerShell 5.1 : NON EXECUTE.**

## LOT 6B correctif V2 — revue Codex

**Etat : developpe localement, teste localement. NON fusionne, NON deploye,
NON execute sur un poste Windows reel.**

Un seul commit correctif, au-dessus du LOT 6B, sur quatre points releves par
la revue.

- `restore-point-create` : la deduction « protection systeme active parce que
  des points de restauration existent » est SUPPRIMEE. La documentation de la
  classe WMI SystemRestore est explicite : chaque instance est un POINT, pas un
  lecteur protege ; SystemRestoreConfig n'a aucun indicateur d'activation ; et
  la documentation de Enable-ComputerRestore renvoie a rstrui.exe. Aucune
  detection n'est fabriquee, aucune cle de registre non documentee n'est lue
  (la lecture de DisableSR est retiree). L'etat doit etre constate dans
  rstrui.exe ou Protection du systeme, puis declare dans un nouveau champ ; la
  creation reste bloquee tant qu'il ne l'est pas.
- Gardien du journal : il ENTOURE desormais le bloc d'ecriture au lieu d'etre
  applique apres. Un chemin refuse ne produit plus ni New-Item, ni
  Set-Content, ni Add-Content. Six formes de chemin eprouvees a l'execution
  pour les deux assistants concernes, avec contre-epreuve qui remet l'ancien
  ordre.
- `temp-cleanup` : quatre collections distinctes remplacent les compteurs
  meles ; chaque suppression est relue IMMEDIATEMENT ; un fichier n'entre dans
  les supprimes et dans l'espace annonce libere que si son absence est
  confirmee ; la verification finale porte sur TOUS les chemins annonces
  supprimes, pas sur un echantillon de cent.
- `safe-mode-preparation` : l'apercu bcdedit vise `"{current}"`, entre
  guillemets pour PowerShell, au lieu de `{default}`. Aucune occurrence active
  de `{default}` ne subsiste.

### Validation mesuree apres correction

- Identite des fiches : 43 261 OK, 0 echec.
- Generation : 856 fichiers, 712/712 scripts anterieurs identiques octet par
  octet. 32 scripts du LOT 6B changent, et seulement eux.
- Fiches du LOT 6B : 18/18, 0 en defaut.
- BOM UTF-8 : 861 OK, 0 echec.
- Contre-epreuves des verrous : 832 OK, 0 echec, sous PowerShell 7.4.6.
- Navigateur : 5 075 OK (catalogue) et 418 OK (LOT 6B), 0 echec.
- Sources : 315 verifiees en ligne, 0 echec.
- **Windows PowerShell 5.1 : NON EXECUTE.**

## LOT 6B — Poste de travail Windows, assistants 13 a 30

**Etat : developpe localement, teste localement. NON fusionne, NON deploye,
NON execute sur un poste Windows reel.** Les six etats a ne pas confondre sont
definis dans `KJEMO-IT-Toolkit-v0.1/docs/FEUILLE-DE-ROUTE.md`.

- Ajout de 18 assistants completant la categorie « Poste de travail Windows »,
  en cinq sous-rubriques : Performance et incidents, Comptes et services,
  Securite, Reparation Windows, Stockage et nettoyage.
- Catalogue porte a 107 outils et 856 scripts generes.
- Garde de non-regression sur les 712 scripts anterieurs au LOT 6B
  (`test/scripts-baseline-712.json`), verifiee octet par octet.
- Bancs d'execution etendus : les scripts sensibles sont REELLEMENT executes,
  cmdlets remplacees par des mouchards, avec contre-epreuves qui desarment
  chaque verrou tour a tour.
- Ajout de `test/fiches-poste-b.test.mjs` (contrat fiche par fiche, moteur
  impose) et de `test/browser-poste-b.test.mjs` (Chromium reel sur les
  18 fiches).
- Ajout des etapes correspondantes au workflow de validation, sous
  `powershell` ET `pwsh` separement, sans repli silencieux et sans
  `continue-on-error`.
- Verification en ligne des 313 sources citees : code HTTP, titre reel,
  detection des pages « contenu introuvable » qui repondent 200. Quatre liens
  morts remplaces (Win32_UserProfile, reference sfc, environnement de
  recuperation Windows, nettoyage de disque).
- Ajout de `docs/FEUILLE-DE-ROUTE.md` : lots livres, lots prevus (LOT 7 a
  LOT 12) consignes sans etre developpes.

### Validation mesuree

- Identite des fiches : 43 211 OK, 0 echec.
- Generation : 856 fichiers, 712/712 scripts anterieurs identiques octet par
  octet.
- Fiches du LOT 6B : 18 outils controles, 0 en defaut.
- Contre-epreuves des verrous : 682 OK, 0 echec, sous PowerShell 7.4.6.
- Navigateur : 5 075 OK (catalogue complet) et 410 OK (LOT 6B), 0 echec.
- Sources : 313 verifiees en ligne, 0 echec.
- **Windows PowerShell 5.1 : NON EXECUTE.** L'environnement de developpement
  est Linux ; seule la CI `windows-latest` peut le faire tourner.

## 2026-09-11 — v0.2

- Remplacement de l’ancien scan limité aux dossiers par une analyse des fichiers et dossiers lourds.
- Ajout d’un seuil de taille, d’une limite de résultats et du choix CSV, HTML ou CSV + HTML.
- Ajout de la reconnaissance des artefacts recréables de projets SaaS.
- Ajout de protections pour `.git`, `.env`, bases, sauvegardes et zones système.
- Ajout d’une sélection interactive vers la corbeille, désactivée par défaut et protégée par `CONFIRMER`.
- Ajout de bornes aux champs numériques du formulaire et prise en charge des attributs HTML `min`, `max` et `step`.
- Mise à jour du titre, de la description et de la version affichée.
- Ajout du workflow GitHub Actions qui publie le dossier statique `KJEMO-IT-Toolkit-v0.1/dist` sur GitHub Pages.
- Ajout d’un `index.html` à la racine pour rester compatible avec la publication Pages historique depuis `main`.

### Validation

- Syntaxe JavaScript : PASS avec `node --check`.
- Génération avec chemins contenant espaces et apostrophe : PASS.
- Génération des modes rapport seulement et corbeille contrôlée : PASS.
- `git diff --check` : PASS.
- Exécution PowerShell réelle : à confirmer sur Windows PowerShell 5.1 et PowerShell 7; PowerShell n’était pas installé dans l’environnement de développement.
