# KJEMO IT Toolkit — Handoff mis à jour

Date : 2026-09-11

## État

- Dépôt : `https://github.com/NGAMS237/KJEMO-IT-Toolkit`
- Branche examinée : `main`
- HEAD distant au début du travail : `148d332`
- Architecture conservée : HTML, CSS et JavaScript sans dépendance, publiables sur GitHub Pages.
- V0.2 du module de stockage préparée pour publication par GitHub Actions.
- Le workflow `.github/workflows/deploy-pages.yml` publie uniquement `KJEMO-IT-Toolkit-v0.1/dist`.

## Module livré localement

L’outil `disk-scan` :

1. analyse un disque ou un dossier;
2. classe les fichiers et dossiers par taille;
3. identifie les artefacts recréables fréquents des projets SaaS;
4. protège `.git`, `.env`, les bases, les sauvegardes et les zones système;
5. génère un rapport CSV, HTML ou les deux sur le Bureau;
6. propose, seulement si l’utilisateur le choisit, une sélection interactive vers la corbeille.

Le navigateur ne lit pas le disque et n’exécute rien. Il ne fait que générer le script PowerShell.

## Décisions de sécurité

- Le défaut est le rapport seulement.
- La corbeille exige le mot exact `CONFIRMER`, puis une liste de numéros.
- Les dossiers volumineux ordinaires restent informatifs; les dossiers proposés automatiquement sont limités aux artefacts recréables.
- Un élément verrouillé ou inaccessible produit une erreur contrôlée; aucune suppression permanente de secours n’est tentée.
- Les scripts ne contiennent aucun secret ni mot de passe.

## Validation effectuée

- `node --check dist/app.js` : PASS.
- Génération de 170 lignes PowerShell : PASS côté générateur.
- Chemin avec espaces et apostrophe : échappement PASS.
- Bornes `Top` et `MinimumSizeGB` : PASS.
- Modes `csv`, `html`, `both`, `report` et `recycle` : PASS côté générateur.
- `git diff --check` : PASS.
- À faire sur Windows : parser et exécuter en laboratoire avec PowerShell 5.1 puis PowerShell 7, sur un dossier de test contenant un faux projet, `.git`, `.env`, un fichier `.db` et un dossier `node_modules`.

## Références techniques

- `Get-ChildItem` : https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-childitem
- `Export-Csv` : https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/export-csv
- `ConvertTo-Html` : https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/convertto-html
- Envoi d’un fichier à la corbeille : https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualbasic.fileio.filesystem.deletefile
- Envoi d’un dossier à la corbeille : https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualbasic.fileio.filesystem.deletedirectory

## Suite recommandée

Vérifier le déploiement GitHub Pages, tester ensuite le script sur Windows, puis décider si le prochain travail porte sur l’optimisation d’un scan de racine système ou sur l’enrichissement Windows Server/Active Directory.
