# KJEMO IT Toolkit

Bibliothèque et générateur local de procédures de dépannage Windows et Active Directory.

Le site ne se connecte à aucun ordinateur et ne stocke aucune donnée : les formulaires génèrent un script PowerShell dans le navigateur. Lis toujours l’aperçu avant de copier ou de télécharger un script.

## Première version

- Configuration IPv4 statique et DNS
- Création d’OU et d’utilisateurs Active Directory
- Création de dossiers partagés SMB
- Ajout d’un deuxième contrôleur de domaine
- Diagnostic / réinitialisation légère du Wi-Fi
- Analyse non destructive des dossiers lourds
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
