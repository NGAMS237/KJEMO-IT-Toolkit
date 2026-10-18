# Sources officielles

Chaque fiche cite ses sources. Côté Windows, une source doit commencer par
`https://learn.microsoft.com/`. Linux n'a pas d'éditeur unique : la liste des
domaines acceptés est dans `dist/sources-linux.mjs`, justifiée domaine par
domaine, avec un critère : la source est **primaire** (publiée par ceux qui
écrivent le logiciel ou maintiennent la distribution). Un blogue, un forum ou
un article « 10 commandes à connaître » n'est jamais accepté.

Le LOT 7 cite 368 URL distinctes (`LOT-7-SOURCES.json`) : Microsoft Learn 239,
manpages Ubuntu 117, Cockpit 2, documentation Ubuntu 3, wiki Samba 3, Netplan 1,
GNU 1, The Open Group 1, MIT 1.

## Vérification en ligne (`LOT-7-SOURCES-VERIFIEES.json`)

`node test/sources-microsoft.mjs` ouvre chaque URL et contrôle le code HTTP, le
titre et son recoupement avec l'URL. Résultat au 2026-10-18 : 445 sources
vérifiées (celles du dépôt entier), **2 écarts, non masqués** :

- `gnu.org/software/bash/manual/bash.html` : 503 pendant le banc, puis 200 à
  trois reprises (« Bash Reference Manual ») : indisponibilité transitoire.
- `documentation.ubuntu.com/…/install-nfs/` : page présente (200) dont le titre
  (« Network File System (NFS) ») ne recoupe pas le mot `install` de l'URL :
  faux positif de l'heuristique, page renommée.

Ni l'un ni l'autre n'a été « corrigé » en assouplissant le banc.
Un contrôle de forme hors ligne (`npm run test:sources:horsligne`) tourne en CI.
