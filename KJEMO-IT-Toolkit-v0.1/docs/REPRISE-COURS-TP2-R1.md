# Point de reprise — KJEMO-COURS-TP2-01-R1

Écrit dans le dépôt pour qu'une session suivante (ou une autre personne) reparte sans l'historique de la conversation. **Dernier état connu : voir « État de la livraison » en bas.**

## Références

| Élément | Valeur |
|---|---|
| Dépôt | `NGAMS237/KJEMO-IT-Toolkit` ; site `https://ngams237.github.io/KJEMO-IT-Toolkit/` |
| Branche de travail | `claude/commandes-cours-tp2-01` |
| Base | `main` = `b83d725509e96b2b650d61b6f23186c591a59d51` (vérifié par `git ls-remote` : main n'a pas bougé) |
| PR n° 13 (filtre de plateforme) | correctif `083014f09d048f82dfa4e51d44a62c1ffc9bf4dd` **inclus** dans la branche (`git merge-base --is-ancestor` vérifié) |
| Ancien HEAD à corriger | `ab5b419a123e022f57552fb0ad67605292fa99af` (arbre `721de3e…`) |
| Sujet d'origine | TP2-A26 (cinq parties A à E, 45 éléments). Les documents d'origine ne sont PAS dans le dépôt |

## Ce que la revue précédente (2 197 contrôles) ne prouvait pas, et ce qui a été corrigé

La revue Codex avait vérifié les empreintes, l'import et les contrôles internes ; elle ne prouvait ni la fidélité au sujet, ni l'exécution réelle. L'ancienne lecture du sujet avait été **reconstruite** parce que deux documents n'étaient plus lisibles. Elle est remplacée par une relecture complète du vrai énoncé (texte et sept images).

| Défaut identifié | Correction | Où |
|---|---|---|
| Parcours A à E reconstruits, pas fidèles | Parcours réécrits d'après l'énoncé : A 5 éléments (24 pts), B 18 (22), C 8 (14), D 9 (20), E 5 (12) = 45 | `dist/cours.mjs` |
| CSV au mauvais format | Séparateur `;`, trois champs login ; mot de passe ; département, en-tête facultative, `Finance` au singulier. Modèle public entièrement FICTIF (`FICTIF-…`) ; le vrai CSV reste sur la VM ; aucun mot de passe réel n'entre dans l'application | `dist/labo.mjs`, fiche `cours-samba-import-csv` |
| Script d'import non vérifié | Script unique `dist/cours-script-import.mjs`, exécuté par `test/cours-import.test.mjs` contre un FAUX `samba-tool` (79 contrôles + 9 contre-épreuves) : CRLF, BOM, doublons, lignes invalides, compte et groupe existants, échec de création, essai sans écriture, aucun mot de passe en sortie, codes de sortie | `test/cours-import.test.mjs` |
| A5, B1, D7 « non couverts » | Trois fiches écrites : `cours-windows-connexion-domaine`, `cours-hyperviseur-ajouter-disque` (VMware, VirtualBox, Proxmox VE, Hyper-V), `cours-windows-acces-partage` (CMD, PowerShell, interface graphique ; erreur 1219 ; `net use` ciblé, jamais `/delete` global) | `dist/cours-fiches-clients.mjs` |
| D5/D6 et transferts SMB inutilisables en arrivée directe | Chaque étape porte sa **machine** (serveur, client Ubuntu, Windows…) ; la copie est SÉPARÉE par poste ; les prérequis sont montrés avec un lien ; les liens de parcours visent la méthode ET l'étape (`#/tache/<id>/methode/<m>/etape/<n>`) avec contrôle du titre | `dist/procedures.mjs`, `dist/vue-taches.mjs` |
| Littéral « compte » à remplacer à la main | Paramètre validé (`identifiant`) ; test qui refuse tout `<…>` et tout mot « compte » littéral dans une commande | `test/cours.test.mjs` section 8 |
| Mélange Linux / smbclient / PowerShell / CMD / interface | Une méthode par langage ; le validateur refuse CMD qui contient PowerShell/Linux ; GUI sans commande ; copie globale refusée quand plusieurs postes | `dist/procedures.mjs` |
| Commandes du mémo sans route | 17 fiches ajoutées (processus, sessions, comptes locaux, archives, localisation, comparaison, état, arrêt, entretien ext4, edquota, smbstatus, planification, ifconfig, service, printf) ; matrice commande → fiche → route recalculée | `dist/cours-fiches-memo.mjs`, `test/matrice-commandes-cours.mjs` |

## Décisions

- **Hyperviseur non précisé par l'énoncé** : une seule fiche à interface graphique avec quatre séries d'étapes ; l'étudiant choisit. La vérification sous Ubuntu (`lsblk`) est commune.
- **Partie E** : le document de cours de l'étudiant utilise `valid users` + `read list` ; les fiches suivent ce document (un compte dans `read list` reste en lecture seule même sur un partage inscriptible ; un compte dans les deux listes reçoit l'écriture).
- **Service Samba** : sur un contrôleur de domaine, `samba-ad-dc` ; les fiches utilisent `smbcontrol all reload-config`, valable des deux côtés.
- **`samba-tool user create LOGIN MOT_DE_PASSE`** met le mot de passe dans la ligne de commande : usage de laboratoire isolé seulement, dit dans la fiche.
- **Couvert** = une fiche écrite à la main permet d'accomplir la tâche (préparation, action, vérification, résultat attendu). **Ce n'est pas une exécution.**
- Les 17 ambiguïtés réelles de l'énoncé sont listées dans `dist/cours.mjs` (`ambiguites`) et dans [COURS-TP2-01-MATRICE.md](COURS-TP2-01-MATRICE.md).

## Tests (à rejouer : `npm run test:cours && npm run test:cours:import && npm run test:matrice:cours && npm run test:matrice:commandes && npm run test:browser:cours`)

| Banc | Rôle |
|---|---|
| `test/cours.test.mjs` | 50 fiches (contrat), sécurité, validateurs, parcours et références (fiche, méthode, étape, titre), 17 ambiguïtés, alias, laboratoire, script affiché = script testé, machines, prérequis, Windows et hyperviseur, recherche par commande |
| `test/cours-import.test.mjs` | Script d'import contre un faux `samba-tool` |
| `test/matrice-cours.mjs --verifier` / `test/matrice-commandes-cours.mjs --verifier` | Matrices à jour ; une commande sans route fait échouer |
| `test/browser-cours.test.mjs` | Chromium : 3 gestes jusqu'à l'étape, méthode GUI, puces de poste, copie séparée, prérequis, CSV, 390 px |
| Bancs historiques | Rejoués sans changer d'assertion (voir le rapport de test) |

Une seule assertion a changé de valeur attendue sur les anciens bancs : `test/cmd-methodes.test.mjs` attend désormais **16** fiches à méthode CMD au lieu de 14 (les deux nouvelles fiches Windows y figurent, par leur identifiant). Aucune assertion n'a été supprimée ni affaiblie.

## Reste à faire

1. Publier : le dépôt est refusé en écriture depuis la session (voir ci-dessous) → pousser la branche depuis le poste de l'étudiant avec le bundle fourni.
2. Ouvrir ou actualiser la PR vers `main`, laisser tourner la CI complète, corriger si besoin.
3. Fusionner par commit de fusion si les contrôles requis passent ; suivre le déploiement GitHub Pages ; parcourir le site PUBLIC (filtres Linux/Windows et retour à « Toutes », « Mes cours et TP », B7 depuis TP2, import CSV, partages Windows, laboratoire, copie, menus, mobile) et confirmer le commit déployé.
4. Jouer les fiches sur un Ubuntu, un Samba AD et un Windows 11 de laboratoire (rien n'a été exécuté sur une machine réelle).
5. SAMBA-ADV-01 : les ASSISTANTS guidés restent à faire (les fiches ne les remplacent pas).

## État de la livraison

Voir le rapport final de la session : développé, testé localement, testé en CI, fusionné, déployé et vérifié sur le site public, non exécuté. **Au moment de l'écriture : développé et testé localement ; la publication GitHub a été refusée (accès en écriture absent) et n'a PAS été contournée ; rien n'est publié, fusionné ni déployé.**
