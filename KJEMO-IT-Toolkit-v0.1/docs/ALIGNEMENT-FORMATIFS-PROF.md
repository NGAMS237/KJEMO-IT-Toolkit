# Alignement avec les corrigés des formatifs 1 et 2 du prof

Interprétation retenue : « menus » = **menus de scripts Bash** (`while` + `case` + fonctions, comme la question 5 du corrigé), ajoutés au TP2 (partie A) et au cours.

Statut : développé et testé localement (simulation avec un faux `samba-tool`). Rien n’a été exécuté sur une vraie machine, ni publié.

| Notion du corrigé du prof | Où dans l’application | Statut |
|---|---|---|
| `test $# = 3`, `let`, `case` avec `x\|X`, `exit 1` (calculatrice) | `cours-bash-condition`, étape facultative « calculatrice du cours » | ajouté |
| `while ((c != 0))`, `let`, `for i in *` + `-d`, `while IFS=: read` | `cours-bash-boucles` (le `select` a été retiré : hors cours) | adapté |
| `function nom { }`, arguments, `return` | `cours-bash-fonctions` | déjà aligné |
| Menu `while [ "$rep" -eq 1 ]` + `case` + `read -r` + `clear` | `cours-bash-menu` | ajouté |
| `read -p`, `clear` | `cours-afficher-texte` | ajouté |
| `grep "^$util:" /etc/passwd`, `id` | `cours-scripts-menu` (menu utilisateurs), `cours-grep-wc` | aligné |
| `find` : `-iname`, `-regex`, `-size`, `-perm`, `-user`, `-exec ls -l {} \;`, `2>/dev/null`, `wc -l` | `cours-find-fichiers` | complété |
| Accolades `{a,b}`, `mkdir`, `touch` | `cours-creer-dossiers-fichiers` | déjà couvert |
| `chmod` en octal, `ls -l` | `cours-droits-fichier` | ajouté |
| `useradd`, `usermod -G`/`-g`, `groups`, `userdel`, `groupadd`, `groupdel` | `cours-groupes-locaux` (+ `groups`, `usermod -g`), `cours-creer-compte-local`, `cours-supprimer-compte-local` | complété |
| Script à menu qui crée les comptes depuis le CSV (TP2 A) | `cours-samba-script-menu` ; parcours A1–A4 et prérequis E y renvoient | ajouté |
| Import CSV avec essai `-n` et contrôles | `cours-samba-import-csv` | conservé, marqué « renforcé, hors cours » |

Le CSV réel (mots de passe) reste local à la VM ; le modèle public est fictif et les mots de passe `FICTIF-*` sont refusés par le script.
