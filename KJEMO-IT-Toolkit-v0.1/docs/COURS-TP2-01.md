# KJEMO-COMMANDES-COURS-TP2-01 (R1) — Mes cours et TP, fiches de cours, laboratoire

**État : développé localement (branche `claude/commandes-cours-tp2-01`, bâtie sur `main` b83d725 + le correctif de la PR n° 13), testé localement (statique + Chromium 390 px et 1280 px). Pas testé en CI GitHub, non fusionné, non déployé. AUCUNE commande n'a été exécutée sur une machine réelle** : le Toolkit montre des commandes, il n'en lance aucune. Seul le script d'import CSV a été exécuté, contre un FAUX `samba-tool`.

Cette version **R1 remplace la lecture reconstruite** du sujet par une relecture complète de l'énoncé TP2-A26 (texte et images). Point de reprise : [REPRISE-COURS-TP2-R1.md](REPRISE-COURS-TP2-R1.md). Matrices (produites par des scripts, vérifiées en CI) :

- [COURS-TP2-01-MATRICE.md](COURS-TP2-01-MATRICE.md) : élément du sujet → fiche, méthode, étape, machine, état ;
- [COURS-COMMANDES-MATRICE.md](COURS-COMMANDES-MATRICE.md) : commande des notes de cours → fiche ou commande rapide → route → état réel.

## 1. Ce qui existe

| Pièce | Rôle |
|---|---|
| 50 fiches rédigées à la main (`dist/cours-fiches-*.mjs`, agrégées dans `dist/procedures-cours.mjs`) | Bases Linux/Bash, stockage, quotas, RAID 1, Samba, DNS Samba, jonction Ubuntu, RSAT, postes clients (Windows, Ubuntu, hyperviseur), compléments du mémo. Même contrat que les autres procédures. Aucune n'est générée. |
| `dist/cours.mjs` | Le cours « Serveurs II — TP2 » : parcours A à E (45 éléments, 92 points), fiches, méthodes et étapes citées, soutien, 17 ambiguïtés, gabarit pour un prochain TP. |
| `dist/cours-script-import.mjs` | Le script Bash d'import CSV : un seul texte, affiché dans la fiche ET exécuté par le banc. |
| `dist/labo.mjs`, `dist/vue-cours.mjs` | « Mon laboratoire » (sans secret), CSV modèle FICTIF, progression, marquage HTML. |
| `dist/procedures.mjs` | Champ d'étape `machine`, copie par poste, `suppose`, `prerequis` ; types `peripherique`, `etiquetteExt4` ; contrôles `distinctDe`, `superieurA`. |
| `dist/vue-taches.mjs`, `dist/app.js` | Puces « Sur : … », barre de copie par poste, encadré « Avant de commencer », route `#/tache/<id>/methode/<m>/etape/<n>/depuis/<cours>/<Lettre>`. |

## 2. Fidélité au sujet (ce qui a été corrigé en R1)

| Partie | Points | Éléments | Fiches principales |
|---|---|---|---|
| A — Comptes depuis un CSV | 24 | A1–A5 | `cours-samba-import-csv`, `cours-samba-groupes`, `cours-windows-connexion-domaine` |
| B — Disques, ext4, quotas | 22 | B1–B18 | `cours-hyperviseur-ajouter-disque`, `cours-partition-formater-monter`, `cours-quotas-utilisateur`, `cours-donner-dossier-compte` |
| C — RAID 1 | 14 | C1–C8 | `cours-raid1-creer`, `cours-raid1-panne-secours` |
| D — Partages Samba | 20 | D1–D7, D8.1, D8.2 | `cours-samba-partage-groupe`, `cours-ubuntu-acces-partage`, `cours-windows-acces-partage`, `cours-smbclient-transferts` |
| E — Partage par groupe, réceptionniste en lecture seule | 12 | E1–E5 | `cours-samba-partage-utilisateurs`, `cours-samba-partage-groupe` |

« Couvert » signifie : la tâche peut être accomplie en suivant la fiche (préparation, action, vérification, résultat attendu, capture demandée). Ce n'est pas une exécution.

**CSV.** Le format de l'énoncé : séparateur `;`, trois champs (login ; mot de passe ; département), `Finance` au singulier. Le script accepte une en-tête facultative, les fins de ligne Windows et un BOM, rejette les lignes invalides en donnant leur numéro (jamais leur contenu), ignore les doublons et les comptes ou groupes qui existent déjà SANS les modifier, vérifie chaque commande `samba-tool` (code de retour puis relecture), affiche un résumé et sort avec 0 (tout va bien), 1 (usage ou système) ou 2 (au moins une ligne rejetée ou en échec). Avec `-n`, il ne fait que lire. Les guillemets autour des champs ne sont **pas** pris en charge (la ligne est rejetée). Le modèle public ne contient que des valeurs fictives (`FICTIF-…`) ; le vrai CSV reste sur la machine virtuelle de l'étudiant, avec des droits `600`, et se supprime (`shred -u`) après le laboratoire. Aucun mot de passe réel n'est saisi dans l'application ni écrit dans un rapport. Ce n'est pas une pratique professionnelle : en entreprise, mot de passe temporaire aléatoire et changement obligatoire à la première connexion.

**Plusieurs postes.** Les fiches D5/D6/D7 et les transferts SMB se jouent sur plusieurs machines. Chaque étape porte sa machine (serveur, client Ubuntu, client Windows, hyperviseur) ; la copie est séparée par poste et jamais en un seul bloc ; quand une commande demande un mot de passe au terminal, la copie d'ensemble est refusée et l'écran le dit. Un encadré « Avant de commencer » expose les préparations (partage créé, compte en écriture, client joint) avec un lien vers la fiche qui les fait, y compris à l'arrivée directe sur la fiche.

**Windows.** Une méthode par langage : CMD, PowerShell, interface graphique ; jamais mêlés. Un seul jeu d'identifiants par serveur est possible (erreur 1219) : la fiche retire UNE connexion ciblée (`net use \\serveur\partage /delete`), jamais toutes ; `cmdkey /list` pour voir les identifiants mémorisés.

**Hyperviseur.** L'énoncé ne dit pas lequel : la fiche donne quatre séries d'étapes (VMware, VirtualBox, Proxmox VE, Hyper-V) relues dans la documentation des éditeurs ; l'étudiant choisit le sien.

## 3. Décisions de conception

- **Un parcours n'est pas une copie.** Corriger une commande dans la fiche corrige tous les parcours. Les lettres et numéros du TP (A, B7, D8.1…) sont des alias de recherche (« TP2 B7 », « b7 »).
- **Les parcours sont notre lecture de l'énoncé.** Les documents d'origine ne sont pas republiés. En cas de doute, l'énoncé fait foi ; les 17 ambiguïtés réelles sont écrites.
- **Une case cochée n'est pas une preuve.** La progression ne garde que des identifiants d'éléments.
- **Architecture statique, aucun serveur.** Le stockage local ne contient que le laboratoire (non sensible) et la progression ; il est protégé par try/catch.
- **Aucune présomption de disque.** Aucune commande ne contient `/dev/sdb` ni `/dev/md127` : ce sont des paramètres validés.
- **Laboratoire ≠ professionnel.** `chmod 777` est une étape facultative nommée « LABORATOIRE » ; systemd-resolved n'est jamais désactivé ; aucun sudo pour tous les comptes du domaine.
- **Liens robustes.** Un lien de parcours nomme la fiche, la méthode, l'étape ET un fragment du titre de l'étape : si la fiche est réordonnée, le banc échoue au lieu d'envoyer vers la mauvaise étape.
- **Accueil sobre.** Les fiches de cours se trouvent par la recherche (par nom de commande, par intention ou par code du TP), les rubriques du catalogue et « Mes cours et TP ».

## 4. Couverture des commandes du mémo

83 commandes suivies par domaine (fichiers, texte, comptes, services/processus, réseau, stockage, Samba, Bash), toutes avec une route : [COURS-COMMANDES-MATRICE.md](COURS-COMMANDES-MATRICE.md). 17 fiches ont été ajoutées pour des commandes citées par les notes et qui n'avaient aucune route : `ps`/`top`/`kill`, `who`/`w`/`last`/`groups`, `useradd`, `userdel`, `tar`, `gzip`, `which`/`type`/`man`/`locate`, `diff`/`sort`/`uniq`/`tr`/`more`, `free`/`uptime`/`uname`, `shutdown`/`reboot`, `tune2fs`/`fsck`, `edquota`, `smbstatus`, `at`/`crontab`, `ifconfig`, `service`, `printf`. Quand les notes se trompent (`tar -zxcf`, `gzip -gv`), la fiche donne la bonne syntaxe et le dit.

## 5. Classement

412 entrées classées, 0 orpheline, 0 rubrique vide, trois niveaux au plus (`node test/classement.test.mjs`). Familles Linux : Fichiers et dossiers (repérer, manipuler, archiver, localiser), Texte, Services (systemd, processus et arrêt, tâches planifiées), Comptes locaux, Stockage, Réseau, Partages, Annuaire, Bash. La fiche RSAT est sous *Active Directory*, la session de domaine Windows aussi. Le filtre de plateforme de la PR n° 13 est conservé.

## 6. Tests

Voir le point de reprise pour la liste des bancs. Évolution justifiée d'un test existant : `test/cmd-methodes.test.mjs` attend 16 fiches à méthode CMD (deux fiches Windows de plus, nommées) ; `test/classement.test.mjs` utilise `estPlaceDirect`. Aucune assertion supprimée ni affaiblie.

## 7. Non couvert, non vérifié

- **Rien n'a été exécuté** sur Ubuntu, Samba AD, Windows 11, un hyperviseur ou un RAID réels.
- `samba-tool user create --must-change-at-next-login` et `--random-password` : options NON confirmées ; absentes de toute commande.
- Renommage `md0` → `md127` après arrêt : pratique connue, non confirmée par le manuel de `mdadm`.
- Menus des hyperviseurs : relus dans la documentation, non vérifiés sur une version précise.
- Le comportement exact de `samba-tool` sur un domaine réel (le banc d'import utilise un double).

## 8. Pour un prochain TP

Le gabarit JSON téléchargeable depuis « Mes cours et TP » suit le contrat de `incoherencesCours`. Ajouter un cours = ajouter un objet dans `COURS` ; `node test/cours.test.mjs` vérifie que fiche, méthode, étape et titre cités existent.
