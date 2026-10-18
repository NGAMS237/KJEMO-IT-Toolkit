# KJEMO IT Toolkit

Bibliothèque et générateur local de procédures de dépannage Windows et Active Directory.

Le site ne se connecte à aucun ordinateur et ne stocke aucune donnée : les formulaires génèrent un script PowerShell dans le navigateur. Lis toujours l’aperçu avant de copier ou de télécharger un script.

## Analyse de disque

L’assistant **Analyser et libérer de l’espace disque** fonctionne sur un disque ou un dossier Windows et :

- classe les fichiers et dossiers lourds;
- reconnaît notamment `node_modules`, `.next`, `dist`, `build`, `out`, `coverage`, `.turbo`, `.cache`, `__pycache__` et `vendor`;
- marque comme protégés `.git`, `.env`, les bases, les sauvegardes et les zones système;
- produit un rapport CSV, HTML ou les deux sur le Bureau;
- reste en mode rapport par défaut;
- peut proposer une sélection vers la corbeille après `CONFIRMER`.

Le scan demande Windows PowerShell 5.1 ou PowerShell 7 sur Windows. La corbeille est réservée à une session interactive et peut échouer pour un fichier verrouillé ou sans permission; l’erreur est alors affichée sans supprimer définitivement l’élément.

## Active Directory avancé

Le catalogue **Active Directory** couvre cinq sous-rubriques, de la structure de
l’annuaire à la santé du domaine. Trois règles gouvernent l’ensemble de ces
outils, sans exception :

1. **Diagnostic par défaut.** Toute opération modifiante s’ouvre en mode
   Diagnostic et n’écrit qu’après un choix explicite. Le mode Diagnostic
   affiche ce qui serait fait, en simulation, et le dit.
2. **Aucun secret dans le navigateur.** Aucun champ de mot de passe, aucun
   identifiant dans un script, une URL, un presse-papiers ou un rapport. Quand
   un secret est nécessaire, le script le demande localement, à la console, au
   moment de son exécution : `Read-Host -AsSecureString` pour une
   réinitialisation, `Get-Credential` pour une réparation de canal sécurisé.
3. **Aucune suppression automatique.** Un utilisateur, un groupe, une unité
   d’organisation ou un ordinateur n’est jamais supprimé par un script de ce
   projet. Désactiver, déplacer en quarantaine, exporter : oui. Supprimer :
   c’est une décision humaine, et la procédure est documentée en cas
   exceptionnel, avec ce qu’elle détruit.

### Structure et OU

- **Créer une hiérarchie d’unités d’organisation** — plusieurs OU d’un coup,
  parents avant enfants, échappement RFC 4514, protection contre la suppression
  accidentelle, rien n’est jamais écrasé.

### Utilisateurs et groupes

- **Importer des utilisateurs depuis un CSV** — schéma attendu affiché, doublons
  et OU vérifiés avant écriture; aucun mot de passe dans le fichier ni dans le
  site.
- **Créer et vérifier des groupes** — portée et catégorie, idempotence, rappel
  du modèle AGDLP.
- **Importer les membres de groupes depuis un CSV** — ajoute, ne retire jamais.
- **Dossiers personnels et profils itinérants** — `HomeDirectory`, `HomeDrive`,
  `ProfilePath`; les anciennes valeurs sont sauvegardées en CSV avant toute
  écriture.

### Cycle de vie des comptes

- **État de santé des comptes** — rapport en lecture seule : désactivés,
  expirés, verrouillés, mots de passe expirés ou sans expiration, inactifs,
  comptes privilégiés.
- **Débloquer et remettre en service un compte** — établit d’abord *pourquoi* la
  connexion échoue, puis n’applique que la correction demandée.

### Maintenance des objets

- **Rechercher et déplacer un objet** — montre le trajet, refuse d’agir si
  plusieurs objets correspondent, consigne l’emplacement d’origine.
- **Audit des délégations sur les OU** — lit les ACL, traduit les GUID, sépare
  l’hérité de l’explicite, signale les droits trop larges et les identités
  orphelines. Aucune ACL n’est réécrite.
- **Recenser et mettre en quarantaine les ordinateurs inactifs** — exporte
  l’inventaire complet avant toute action; sans export, rien n’est tenté.

### Santé du domaine

- **Santé du DNS pour Active Directory** — enregistrements SRV, zones directe et
  inverse, redirecteurs, service Netlogon.
- **Rapport dcdiag interprété** — la sortie brute est conservée et fait foi; le
  code de sortie ne conclut rien.
- **État de la réplication entre contrôleurs** — liens, latence, codes d’erreur
  traduits, sortie brute de repadmin conservée.
- **Vérifier et réparer le canal sécurisé** — refusé sur un contrôleur de
  domaine, où la commande n’a pas de sens.
- **Rapport complet de santé du domaine** — forêt, FSMO, sites, réplication,
  DNS, SYSVOL et NETLOGON, temps, Kerberos, LDAP, RPC, comptes sensibles, objets
  obsolètes. Synthèse en tête.

SYSVOL n’est **jamais** reconstruit automatiquement. La synchronisation
autoritaire ou non autoritaire reste une procédure manuelle, documentée dans le
bloc d’annulation du rapport complet, avec avertissement critique et renvoi à la
procédure Microsoft.

## Poste de travail Windows

Le catalogue **Poste de travail Windows** couvre 30 assistants en huit
sous-rubriques. Les mêmes trois règles que pour Active Directory s'appliquent,
et quatre s'y ajoutent, propres au poste de travail :

4. **Aucun redémarrage, aucun arrêt, aucune fermeture de console.** Aucun
   script de ce catalogue ne redémarre le poste, ne l'arrête, ne ferme
   PowerShell ni ne contient un `exit` susceptible de fermer la fenêtre de la
   personne. Quand un redémarrage est nécessaire, le script le DIT et laisse
   la personne le décider.
5. **Aucune désactivation d'une protection.** Ni le pare-feu, ni Microsoft
   Defender, ni une exclusion d'analyse ne sont modifiés. Les assistants
   d'audit sont en lecture seule, et les exclusions existantes sont affichées
   comme une information potentiellement sensible.
6. **Aucun contournement d'identité.** Pas de modification de la base SAM,
   pas de remplacement d'`utilman.exe`, pas de compte administrateur
   clandestin, pas de contournement de BitLocker, pas d'outil de cassage.
   L'assistant de récupération d'accès est documentaire : si l'identité ou
   l'autorisation n'est pas établie, il ne propose aucune méthode intrusive.
7. **Aucun chemin de nettoyage libre.** Le seul assistant qui supprime des
   fichiers travaille sur une **liste blanche interne** d'emplacements
   temporaires, jamais sur un chemin saisi par la personne. Il refuse les
   racines de volume, les chemins UNC, les chemins relatifs, les dossiers
   personnels, `.git`, `.env`, les bases et les sauvegardes, et il ne
   traverse jamais un lien symbolique, une jonction ou un point de réanalyse.
   Il ne « nettoie » jamais `C:`.

### Diagnostic général
- **Diagnostic complet du poste Windows** — `workstation-health-report`
- **Inventaire matériel et logiciel du poste** — `workstation-inventory`

### Périphériques
- **Diagnostiquer le son du poste** — `audio-diagnostic`
- **Diagnostiquer le microphone** — `microphone-diagnostic`
- **Diagnostiquer la webcam** — `webcam-diagnostic`
- **Diagnostiquer le Bluetooth** — `bluetooth-diagnostic`
- **Diagnostiquer les écrans et la résolution** — `display-diagnostic`
- **Auditer les pilotes du poste** — `driver-audit`

### Mises à jour et applications
- **Diagnostiquer Windows Update** — `windows-update-diagnostic`
- **Réparation encadrée de Windows Update** — `windows-update-repair`
- **Diagnostiquer une application qui ne démarre pas** — `application-wont-start`
- **Diagnostiquer un processus bloqué** — `process-hung`

### Performance et incidents
- **Diagnostic du démarrage lent** — `slow-boot-diagnostic` : dernier
  démarrage, services automatiques non démarrés, tâches planifiées, éléments
  de démarrage, événements, espace disque, charge. Ne désactive rien.
- **Diagnostic des écrans bleus** — `bluescreen-diagnostic` : événements
  BugCheck, codes connus, présence et dates des minidumps. Le contenu des
  dumps n'est ni lu ni téléversé, et le rapport ne prétend pas analyser un
  vidage mémoire sans moteur de débogage.
- **Diagnostic d'un profil utilisateur** — `user-profile-diagnostic` :
  profil temporaire, correspondance SID/profil, ruche chargée, événements du
  service de profils. Aucune suppression dans `ProfileList`, aucun renommage.
- **Rapport de performance du poste** — `workstation-performance-report` :
  la température n'est relevée que si une source Windows fiable la fournit, et
  une mesure absente est annoncée absente, jamais présentée comme normale.

### Comptes et services
- **Audit des comptes locaux** — `local-accounts-audit` : lecture seule.
  Aucun secret révélé, aucun mot de passe testé.
- **Récupération d'accès Windows** — `windows-access-recovery` :
  documentaire, et explicite sur ce qu'il refuse de proposer.
- **Diagnostic et contrôle d'un service Windows** — `windows-service-control` :
  un service nommé, jamais de joker ; refus des services critiques ; état
  initial mémorisé, identité et état relus juste avant l'action, résultat relu
  après, retour à l'état initial proposé, journal écrit avant toute action.

### Sécurité
- **Audit du pare-feu Windows** — `firewall-audit` : lecture seule. Aucun
  profil désactivé, aucune règle créée ni supprimée.
- **Audit de Microsoft Defender** — `defender-audit` : lecture seule. Les
  exclusions sont affichées comme une information sensible, jamais modifiées.
- **Analyse Microsoft Defender encadrée** — `defender-scan` : `Start-MpScan`
  seul. Chemin local strictement validé, confirmation écrite pour une analyse
  complète, aucun arrêt forcé de Defender.

### Réparation Windows
- **Vérification et réparation avec SFC** — `sfc-repair` : diagnostic,
  `/verifyonly` et `/scannow` nettement séparés. DISM n'est jamais enchaîné
  automatiquement, et le code de sortie n'est pas présenté comme suffisant.
- **Vérification et réparation avec DISM** — `dism-repair` : `/CheckHealth`,
  `/ScanHealth` et `/RestoreHealth` séparés. Aucune source arbitraire
  téléchargée, source locale strictement validée, SFC non enchaîné.
- **Création d'un point de restauration** — `restore-point-create` : création
  seulement si la protection système est disponible et le lecteur protégé.
  Aucune restauration n'est jamais déclenchée, et l'existence réelle du point
  est vérifiée après création.
- **Préparation au mode sans échec** — `safe-mode-preparation` : préparation
  et procédure graphique. Le BCD n'est jamais modifié ; les commandes `bcdedit`
  n'apparaissent qu'en aperçu documentaire marqué « NON EXECUTE », toujours
  accompagnées de leur annulation.

### Stockage et nettoyage
- **Diagnostic du stockage du poste** — `workstation-storage-diagnostic` :
  volumes, espace libre, temporaires, corbeille, caches, estimation du
  récupérable. Aucune suppression, et renvoi vers `disk-scan` pour l'analyse
  récursive avancée, qu'il ne duplique pas.
- **Nettoyage sécurisé des fichiers temporaires** — `temp-cleanup` : le seul
  assistant destructif du catalogue. Liste blanche interne, seuil d'âge
  explicite, aperçu et manifeste obligatoires, confirmation textuelle exacte,
  suppression fichier par fichier sans `-Recurse` ni `-Force`, et
  revérification du chemin canonique juste avant chaque suppression.
- **Nettoyage encadré de la corbeille** — `recycle-bin-cleanup` : diagnostic
  seul, sans bouton Appliquer. La décision et son motif sont écrits dans le
  script généré, avec la procédure graphique.
- **Diagnostic des caches de navigateurs** — `browser-cache-diagnostic` :
  diagnostic seul. Aucun navigateur fermé, aucune suppression, et le rapport
  nomme explicitement ce qu'il ne lit pas — mots de passe, cookies, jetons,
  sessions, favoris, historique, extensions, données synchronisées.

## Linux, Bash, Samba et NFS (LOT 7)

Le catalogue compte **153 outils** : 107 Windows et **46 du LOT 7**, dont 43
assistants Linux (sortie `.sh`, catégorie « Linux et services réseau », onze
sous-rubriques) et 3 assistants de jonction de domaine (PowerShell, rangés
dans « Poste de travail Windows »). Le dépôt livre **1224 scripts** de
référence (880 `.ps1` et 344 `.sh`) et **112 commandes rapides**.

Règles qui gouvernent les assistants Linux, sans exception :

1. **Diagnostic par défaut.** 28 assistants ne modifient rien ; 15 modifient
   la machine (13 « caution », 2 « destructive ») et exigent une phrase de
   confirmation exacte, annoncée par le script lui-même.
2. **Aucun secret** dans un champ, un script, une URL ou un rapport.
3. **Le script relit et refuse.** Un verrou est dans le script généré, pas
   seulement dans le formulaire : le banc négatif le prouve en armant puis en
   désarmant chaque verrou.
4. **Rien n'est appliqué à l'insu de la personne** : Netplan n'est jamais
   appliqué, NFS n'est jamais exporté, SSH n'est jamais redémarré sans preuve
   d'un second accès.

Niveau de preuve : exécution réelle de Bash avec des **doublures** (mouchards
sur le PATH) et ShellCheck. **Ubuntu Server réel, contrôleur Samba AD réel,
export NFS réel et jonction de domaine réelle : NON EXÉCUTÉ.** GitHub Actions :
NON EXÉCUTÉ tant qu'aucun push n'a eu lieu.

Documentation : [architecture multiplateforme](docs/ARCHITECTURE-MULTIPLATEFORME.md),
[commandes rapides](docs/COMMANDES-RAPIDES.md),
[sécurité Bash](docs/SECURITE-BASH.md),
[catalogue des 46 assistants](docs/CATALOGUE-46-ASSISTANTS.md),
[sources officielles](docs/SOURCES-OFFICIELLES.md). Matrices : `LOT-7-MATRICE-*.json`.

## Première version

- Configuration IPv4 statique et DNS
- Création d’OU et d’utilisateurs Active Directory
- Création de dossiers partagés SMB
- Ajout d’un deuxième contrôleur de domaine
- Diagnostic / réinitialisation légère du Wi-Fi
- Analyse non destructive des dossiers lourds
- Analyse détaillée du disque avec rapports CSV/HTML et corbeille contrôlée
- Politique de mots de passe du domaine
- Étapes équivalentes dans l’interface graphique Windows

## Utilisation

1. Ouvrir le site et choisir un outil.
2. Saisir les informations de l’environnement.
3. Vérifier l’aperçu PowerShell et les prérequis.
4. Copier ou télécharger le script.
5. Exécuter le script depuis une console PowerShell appropriée, avec les droits nécessaires.

## Règles de contribution

Chaque nouvel outil doit inclure :

- le symptôme ou l’objectif;
- les paramètres demandés;
- une vérification préalable;
- un script idempotent ou clairement limité;
- un niveau de risque;
- les étapes GUI équivalentes;
- une source officielle;
- une solution alternative lorsqu’elle est pertinente.

Ne jamais ajouter de mots de passe, clés API ou informations d’entreprise dans le dépôt.

## Développement local

Le projet est volontairement sans dépendance d’exécution. Ouvrir
`dist/index.html` dans un navigateur suffit pour consulter l’application.

### Tests

    npm run generate                 # régénère les scripts et compare aux empreintes de référence
    npm run test:identity            # contrat des fiches, validateurs et contre-épreuves
    npm run test:poste-verrous       # EXÉCUTE les scripts sensibles, cmdlets remplacées par des mouchards
    npm run test:fiches-poste-b      # contrat fiche par fiche des 18 assistants du LOT 6B
    npm run test:browser             # parcours réel dans Chromium des 107 outils, responsive compris
    npm run test:browser:poste-b     # parcours réel des 18 fiches du LOT 6B
    npm run test:bom                 # BOM UTF-8 des scripts PowerShell livrés
    npm run test:sources:6b          # chaque source officielle répond, et porte le bon titre
    npm run test:sources:horsligne   # contrôle de forme seul, sans appel réseau
    npm run test:linux               # chaîne Bash : hygiène, shQuote, ShellCheck, scanner, mouchards, commandes rapides
    npm run test:negatifs            # 19 familles de verrous : refus, contrôle positif, contre-épreuve
    npm run test:negatifs:contre-epreuves   # 12 pannes produit : le banc négatif doit rougir
    npm run test:browser:lot7        # Chromium réel : 8 catégories, 46 routes, recherche, clavier, 390 px
    npm run test:browser:lot7:contre-epreuves   # 16 mutations : le banc navigateur doit rougir
    npm run test:capacites           # sonde chown/mknod : NON EXÉCUTÉ (77) distinct d'une régression (1)
    npm run test:dette-6b            # liste, sans les modifier, les scripts au sélecteur « Format du rapport » mort
    node test/matrices-lot7.mjs --verifier   # les matrices et le catalogue n'ont pas dérivé

`npm run test:poste-verrous` et `npm run test:fiches-poste-b` acceptent
`--powershell <exe>`. L'interpréteur est alors **imposé** : si l'exécutable
demandé est absent, le banc échoue au lieu de se rabattre sur l'autre moteur.
Un résultat obtenu sous PowerShell 7 ne dit rien de Windows PowerShell 5.1.

`npm run generate` produit un script par outil et par jeu de valeurs, puis
compare chaque empreinte SHA-256 à `test/scripts-baseline.json`. Les scripts des
lots précédents doivent rester **identiques octet par octet** : toute
modification involontaire fait échouer la commande.

## Feuille de route

Les lots livrés et les lots prévus — sans les développer — sont consignés dans
[`docs/FEUILLE-DE-ROUTE.md`](docs/FEUILLE-DE-ROUTE.md). Ce document définit
aussi les six états à ne jamais confondre : développé localement, testé
localement, testé en CI, fusionné, déployé, testé sur une vraie machine.

## Publication

Le workflow GitHub Actions publie le dossier `dist/` sur GitHub Pages. Dans le dépôt GitHub, sélectionner **Settings → Pages → Source : GitHub Actions**.
