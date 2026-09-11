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

Le projet est volontairement sans dépendance. Ouvrir `dist/index.html` dans un navigateur suffit pour consulter l’application.

## Publication

Le workflow GitHub Actions publie le dossier `dist/` sur GitHub Pages. Dans le dépôt GitHub, sélectionner **Settings → Pages → Source : GitHub Actions**.
