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

    npm run generate        # régénère les scripts et compare aux empreintes de référence
    npm run test:identity   # contrat des fiches, validateurs et contre-épreuves
    npm run test:browser    # parcours réel dans Chromium, responsive compris
    npm run test:bom        # BOM UTF-8 des scripts PowerShell livrés
    node scripts/verifier-sources.mjs   # chaque source officielle répond, et porte le bon titre

`npm run generate` produit un script par outil et par jeu de valeurs, puis
compare chaque empreinte SHA-256 à `test/scripts-baseline.json`. Les scripts des
lots précédents doivent rester **identiques octet par octet** : toute
modification involontaire fait échouer la commande.

## Publication

Le workflow GitHub Actions publie le dossier `dist/` sur GitHub Pages. Dans le dépôt GitHub, sélectionner **Settings → Pages → Source : GitHub Actions**.
