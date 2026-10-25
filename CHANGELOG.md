# Journal des changements

## UX-NAVIGATION-CATALOGUE-01 — Navigation par groupes et sous-groupes de toutes les cartes (branche claude/ux-navigation-catalogue-01)

**Etat : developpe localement, teste localement (statique + navigateur Chromium). NON teste en CI GitHub, NON fusionne, NON deploye. Aucune commande n'a ete executee sur un poste, un equipement ou un tenant.**

- Classement commun `dist/classement.mjs` (362 entrees sur 362 classees, 0 orpheline, 0 rubrique vide, trois niveaux au plus) : menu lateral, cartes de rubrique, recherche, fil d'Ariane et compteurs lisent la meme source. Tableau : `docs/UX-CLASSEMENT-COMPLET.md`.
- Routes `#/rubrique/<domaine>[/<groupe>[/<sujet>]]` et `#/assistants/…` ; routes existantes, favoris, historique, copies, telechargements inchanges.
- Panneau de rubrique (fil d'Ariane, cartes des groupes), listes titrees par groupe/sujet/section, groupes sous le domaine ouvert dans le menu lateral.
- Fiches : fil d'Ariane cliquable jusqu'au groupe et bouton « Retour : <groupe> » ; un lien direct garde le retour historique vers la liste complète (le fil d'Ariane mène au groupe).
- Recherche limitee au perimetre choisi + « Rechercher dans tout le catalogue » (requete conservee).
- Bandeau « un filtre masque des resultats existants » (type ou plateforme) : filtre, nombre, requete, perimetre, autres types avec leur nombre.
- Phase en lecture seule titree « Consulter » au lieu de « Appliquer ».
- Linux / Samba : trois sections reunissant fiches, commandes rapides et assistants. SAMBA-ADV-01 (samba-tool groupes, smbclient get/put) : NON realise, annonce comme tel dans la rubrique.
- Correctif de contraste : survol et sélection du menu latéral (groupes et domaines) et compteurs utilisaient `#fff` / `--muted-2` : 1,23:1 (survol, thème clair) et 3,8–4,2:1 (compteurs). Couleurs désormais issues des jetons du thème (`--text-strong`, `--muted`), sélection doublée d'un trait et du gras. Contrôle de contraste ≥ 4,5 des éléments de navigation (menu, cartes, fil d'Ariane, bandeau, périmètre, fiche) en clair, sombre et système, au repos, au survol et à la sélection ; la règle fautive réinjectée fait échouer le banc.
- Bancs : `test/classement.test.mjs` (statique, contre-epreuves) et `test/browser-navigation.test.mjs` (navigateur : cinq parcours sans recherche, filtres, clavier, 390 px) ; anciens bancs rejoues sans changer d'assertion.
- Limites : Windows, PowerShell 5.1, Cisco, Ubuntu reels et CI GitHub : NON EXECUTES.

## UX-COHERENCE-03 — Audit de cohérence : types de contenu, méthodes nommées, liens réciproques (branche claude/ux-coherence-03)

**Etat : developpe localement, teste localement (statique + navigateur Chromium). NON teste en CI GitHub, NON fusionne, NON deploye. Aucune commande n'a ete executee sur un poste, un equipement ou un tenant.**

- Audit de 362 routes (211 assistants, 39 fiches dont 4 scenarios, 112 commandes rapides) : un assistant n'offrant qu'un script est legitime ; l'ecart observe venait d'une integration oubliee de UX-02b dans la page assistant. Tableau complet : `docs/UX-COHERENCE-03.md`.
- Page assistant : en-tete identique a celui des fiches (type « ASSISTANT COMPLET », plateforme, langage, favori) ; ancre « Script » remplacee par « Script PowerShell » / « Script Bash » / « Commandes Cisco IOS » ; section « Interface graphique » (meme nom que l'onglet des fiches) ; effet affiche une seule fois ; ton de la ligne « Effet » aligne sur le badge (vert lecture, ambre modification, rouge destructif).
- Plateformes : les 24 assistants Azure etaient classes « Windows » (le filtre Azure ne les trouvait pas) ; ils sont classes Azure.
- Liens reciproques : l'assistant renvoie vers sa fiche ET vers ses commandes rapides (29 assistants n'avaient aucun lien).
- Methode nommee partout : pastille de methode sur chaque carte de resultat et dans l'en-tete des fiches a methode unique.
- Recherche : grille des categories repliee pendant une recherche (resultats visibles sans defiler) ; un seul bouton « effacer ».
- Bancs : `test/coherence.test.mjs` (statique) et `test/browser-coherence.test.mjs` (navigateur, 362 routes sans rechargement) ; contre-epreuves par mutation ; anciens bancs rejoues sans changer d'assertion.
- Plan distinct pour les 155 assistants sans fiche courte : `docs/UX-COUVERTURE-PLAN.md` (aucune fiche generee automatiquement).
- Limites : Windows, PowerShell 5.1, Cisco, Ubuntu reels et CI GitHub : NON EXECUTES.

## UX-COMMANDES-PROCEDURES-02b — Vue rapide finalisee, methodes CMD verifiees, livraison reparee (branche claude/ux-commandes-procedures-02b)

**Etat : developpe localement, teste localement (statique + navigateur Chromium). NON teste en CI GitHub, NON fusionne, NON deploye. Aucune commande n'a ete executee sur un equipement, un tenant, une imprimante ou un poste reels. Base : bf73ef4 (= origin/main). Les lots ne sont pas renumerotes.**

- Vue rapide recomposee : une carte par phase d'execution (equipement ET phase, ordre reel), blocs de commandes continus, precautions de la phase AVANT les commandes, pauses (reponse, secret) signalees en une ligne, bouton Copier par segment (un segment s'arrete apres chaque pause, ne melange jamais deux equipements), raisons de refus en quelques mots, hypotheses repliees, aide des champs au focus. Numeros d'etapes identiques a ceux du Pas a pas (les renvois « etape 3 » restent exacts). Hauteur mesuree a valeurs, dimensions et theme identiques : SSH Cisco -22 %, inter-VLAN -19 %, SSH Linux -21 %, diagnostic Windows -15 %, mobile -18 a -27 % ; texte non reduit, aucune commande masquee. Le Pas a pas est inchange.
- Methodes CMD : 14 methodes inventoriees (docs/UX-METHODES-CMD.md), banc dedie `test/cmd-methodes.test.mjs`. Defauts corriges : `<PID>` litteral copiable (« ports en ecoute » CMD) → parametre `pid` reserve a CMD (`methodes: ['cmd']`) ; IP fixe sans DNS alors que la documentation exige un DNS statique → etape DNS (PowerShell, CMD, interface graphique) et retour arriere exact (adresse ET DNS, `source=dhcp`) ; `netstat -ano -p tcp` (IPv4 seul) → `netstat -ano | findstr LISTENING` ; `%` et `^` refuses dans les noms (metacaracteres CMD) ; difference nslookup / Resolve-DnsName et format wevtutil dits. Nouvelle methode CMD : journal Windows (`wevtutil qe`). Espace disque : pas de methode CMD (lacune documentee, pas d'onglet vide).
- Contrat : un repere litteral `<...>` dans une commande, une cmdlet PowerShell ou une commande Linux dans un onglet CMD, un parametre reserve employe dans une autre methode sont refuses. Il a revele 3 commandes rapides LOT 7 (`stat ... <un des fichiers trouves>`, `getent group <un des groupes listes>`) dont les reperes se copiaient tels quels : transformes en parametres a l'adaptation (donnees LOT 7 inchangees).
- Regression corrigee : les puces « Contenu » etaient comptees dans le filtre de plateforme (conteneur separe `#natureFilters`).
- Livraison : patch limite aux changements UX depuis bf73ef4 ; verification en clone neuf (base presente, bundle valide, `git am` sans conflit, arbre identique).
- Bancs : `cmd-methodes` 337+, `scenarios` 800+, `browser-scenarios` 184 ; anciens bancs rejoues.
- Limites : PowerShell 5.1, Windows, Cisco, Ubuntu reels et CI GitHub : NON EXECUTES. Sources netsh lues dans la documentation archivee Windows Server 2008 R2 ; pages Cisco et sshd(8) toujours non confirmees.

## UX-COMMANDES-PROCEDURES-02 — Vue rapide, pas à pas, scénarios (branche claude/ux-commandes-procedures-02)

**Etat : developpe localement, teste localement (statique + navigateur Chromium). NON pousse si GitHub refuse l'ecriture, NON teste en CI GitHub, NON fusionne, NON deploye. Aucune commande n'a ete executee sur un equipement, un tenant, une imprimante ou un poste reels. Les lots ne sont pas renumerotes.**

- Une tache, deux vues : selecteur « Vue rapide » / « Pas a pas » sur chaque fiche. Technicien ouvre la vue rapide, Debutant le pas a pas ; la bascule locale ne change pas le mode global ; les deux vues sont rendues depuis la MEME definition (test sur toutes les fiches, methodes et valeurs).
- Plateforme et methode separees ; CMD ajoute la ou une methode native existe (ex. IP fixe via netsh, diagnostic reseau, ports en ecoute) ; GUI en liste de chemins de menu dans la vue rapide.
- 4 scenarios reutilisant les etapes elementaires par reference (`reprendre`) : SSH sur un commutateur Cisco, plusieurs VLAN + routage inter-VLAN par routeur (table de parametres validee : doublons, chevauchements, passerelle/poste dans le sous-reseau, ports uniques), SSH sous Linux/Bash, diagnostic reseau Windows (PowerShell et CMD).
- Copie : blocs titres par equipement, copie d'une etape, d'une phase ou de la sequence d'un equipement ; refus motive quand la copie globale serait trompeuse (interactif, etapes entrecroisees, plusieurs machines, valeurs manquantes) ; secrets jamais saisis ni copies (la commande s'arrete avant le secret) ; dossier de procedure .md telechargeable.
- Correction technique : la persistance VLAN est precisee (vlan.dat pour 2-1005 en VTP server/client ; configuration pour transparent et VLAN etendus ; ports et interfaces seulement dans la running-config) ; l'enregistrement est une etape separee, explicite, modelisee comme interaction.
- Catalogue : nombres coherents menu/cartes (335 entrees = 39 fiches dont 4 scenarios + 112 commandes + assistants listes ; 211 assistants toujours accessibles), legende explicite, filtre « Contenu » (procedures et scenarios / commandes / assistants). 5 nouvelles fiches courtes (IP fixe Windows, espace disque Linux, ports en ecoute Linux et Windows, interfaces et routes Cisco) ; couverture partielle : 155 assistants restent accessibles uniquement par l'assistant complet.
- Pages d'assistants : compatibilite/limites/validation repliees derriere un titre explicite, essentiel visible (prerequis, droits, effet) ; scripts, protections et validations inchanges.
- Bancs : `test/scenarios.test.mjs` (548), `test/browser-scenarios.test.mjs` (31) ; `taches` 777 et `browser-taches` 120 adaptes au nouveau rendu SANS changer d'objectif (3 assertions V1 : texte de l'etape 1 de « Creer un VLAN », compteur d'effets importants, pliage Technicien -> vue rapide). Bancs historiques navigateur (identite 8553, LOT 7 2274, Cisco 1028, Azure 810, integration 257, impression 319, poste B 418) verts.
- Sources : pages relues par lecture web (New-NetIPAddress, Get-NetTCPConnection, netstat, ping, ipconfig, Resolve-DnsName, Test-Connection, ss, sshd_config, ssh-keygen) ; NON confirmees (non lisibles par l'outil) : pages Cisco Catalyst 1000 et IOS, sshd(8), du/df/lsblk, netsh interface ip. Une source consultee ne vaut pas essai reel.
- Limites : Windows PowerShell 5.1, commutateur/routeur reels, Packet Tracer, Ubuntu reel, CI GitHub : NON EXECUTES. La variante commutateur L3 du routage inter-VLAN n'est volontairement pas developpee.

## UX-COMMANDES-PROCEDURES-01 — Commandes et procédures (branche claude/ux-commandes-procedures-01)

**Etat : developpe localement, teste localement (statique + navigateur Chromium). NON pousse si GitHub refuse l'ecriture, NON teste en CI GitHub, NON fusionne, NON deploye. Aucune commande n'a ete executee sur un equipement, un tenant ou un poste reels : chaque fiche porte « validation non executee ». Les lots ne sont pas renumerotes.**

- Accueil recentre sur la tache : titre « Commandes et procedures IT », recherche « Quelle commande ou procedure cherches-tu ? », filtres de plateforme, categories compactes, favoris et recents, lignes de resultat compactes. Le catalogue complet reste accessible (`#/assistants` = les 211 assistants, recherche historique).
- Nouvelle page tache `#/tache/<id>` : explication courte, plateforme/privilege/effet, methodes reelles seulement (Bash, PowerShell, CMD, Cisco IOS, GUI), etapes numerotees, un bloc de commande par etape avec bouton Copier, resultat attendu, verification, formulaire de parametres reflete dans les commandes.
- Le texte copie est CALCULE depuis les donnees (jamais lu dans le DOM) : pas d'invite, pas de numerotation ; copie refusee tant qu'un parametre manque ou qu'un espace reserve reste ; types de parametres delegues aux validateurs existants ; type `arg` strict. Cisco : mode affiche a cote de l'etape, lecture/configuration/verification/enregistrement separes, aucun enregistrement persistant silencieux (`facultatif`, exclu de « copier tout »).
- Couverture reelle : **30 fiches redigees + 112 commandes rapides adaptees**, reliees a 56 assistants ; **155 assistants restent accessibles uniquement par l'assistant complet** (liste dans `docs/UX-COUVERTURE.md`). Rien n'a ete invente pour gonfler ces chiffres.
- Gros scripts : resume avant le script (lit / modifie / produit / privileges / effet), script replie derriere « Afficher le script complet », Copier/Telecharger et encodages inchanges (.ps1 BOM, .sh LF sans BOM, .ios.txt ASCII/LF).
- Visuel : cartes d'etape, blocs contrastes, themes clair/sombre, bleu = instruction, vert = resultat attendu (ne signifie jamais qu'un test a ete fait), orange = effet important, rouge = destructif, toujours avec etiquette ; clavier, focus, mouvement reduit.
- Bancs : `test/taches.test.mjs` (721 controles statiques), `test/browser-taches.test.mjs` (120 controles navigateur). Bancs historiques adaptes SANS changer leur objectif (ils ouvrent `#/assistants`) ; aucune assertion supprimee ou videe.
- Defauts trouves et corriges : contrat des commandes rapides (intentions, titres longs, id a majuscule, jetons de verification), bruit de recherche (coupe de longue traine), pliages parasites qui cassaient le banc identite, texte de carte de categorie, message de resultat vide, defilement de l'apercu, hauteur du champ de recherche.
- Limites : sources officielles : 13 pages re-confirmees par lecture web ; 8 pages (5 Cisco 15.2(7)E et 3 Microsoft Learn : net stop, net start, repadmin ; 24 autres etaient deja confirmees au LOT 7) n'ont pas pu etre lues par l'outil et restent « non confirmees ». Windows PowerShell 5.1, laboratoire Cisco/Azure/AD reels : NON EXECUTES.

## LOT 9 — Imprimantes (branche claude/lot-9-imprimantes)

**Etat : developpe localement, teste localement. NON pousse (GitHub a refuse l'ecriture), NON teste en CI GitHub, NON fusionne, NON deploye.
Windows PowerShell 5.1 : NON EXECUTE. Imprimante, spouleur ou CUPS reels : NON EXECUTE.** Base : checkpoint d'integration `0c4aa86`.

- **15 assistants** dans la categorie « Imprimantes » : 11 Windows (PrintManagement, CIM, Spooler ; `.ps1`) et 4 CUPS (`.sh`). 211 assistants au total, 10 categories visibles.
- Parcours A (lecture : inventaire, file, spouleur, reseau par protocole, file partagee), B (configuration guidee : port TCP/IP + imprimante avec pilote DEJA installe, connexion de file partagee, imprimante par defaut du compte, page de test), C (deblocage cible : un travail, spouleur), D (CUPS : inventaire, diagnostic, annulation d'un travail, reactivation d'une file).
- Garde-fous : aucun pilote telecharge ou installe ; cibles par nom EXACT (jamais joker ni prefixe) ; phrase de confirmation exacte embarquee dans le script ; lecture avant action et relecture apres ; `-WhatIf` uniquement pour `Add-PrinterPort`, `Remove-PrintJob`, `Restart-Service` ; aucune purge generale du spool ; jamais « repare » deduit d'un code de sortie.
- Bancs : doublures PowerShell 7 et faux binaires CUPS, analyse par arbre syntaxique, contre-epreuves (garde retiree, appel interdit injecte, `-WhatIf` invente), navigateur (routes, validation, phrase, .ps1 avec BOM, .sh sans BOM en LF, 390 px).
- Matrices `LOT-9-MATRICE-*.json` avec detection de derive ; `LOT-9-SOURCES.json` (18 pages officielles Microsoft/OpenPrinting confirmees par lecture web) ; inventaire `dist/cmdlets.mjs` complete (7 cmdlets) ; scripts `package.json` et etapes `validate-linux.yml` ajoutes.
- Corrections trouvees par le banc : message TCP CUPS qui confondait refus et delai ; raison d'arret CUPS non affichee en sortie Console ; directive ShellCheck deplacee par une edition ; detecteur de mot interdit sans « reparé ».
- Laboratoires `docs/labs-imprimantes/` : 3 guides NON EXECUTES.

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
