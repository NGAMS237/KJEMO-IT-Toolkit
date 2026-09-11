# Journal des changements

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
