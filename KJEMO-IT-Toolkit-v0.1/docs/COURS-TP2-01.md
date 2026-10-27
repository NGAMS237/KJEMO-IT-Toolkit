# KJEMO-COMMANDES-COURS-TP2-01 — Mes cours et TP, fiches de cours, laboratoire

**État : développé localement (branche `claude/commandes-cours-tp2-01`, bâtie sur `main` b83d725 + le correctif de la PR n° 13), testé localement (statique + Chromium 390 px et 1280 px). Pas testé en CI GitHub. Non fusionné, non déployé. AUCUNE commande n’a été exécutée sur une machine réelle** : le Toolkit montre des commandes, il n’en lance aucune, et ces fiches n’ont pas été jouées sur un Ubuntu, un Samba AD ou un Windows réels.

Matrice de couverture complète, élément par élément : [COURS-TP2-01-MATRICE.md](COURS-TP2-01-MATRICE.md) (produite par `node test/matrice-cours.mjs --ecrire`, vérifiée par `--verifier`).

## 1. Ce qui a été ajouté

| Pièce | Rôle |
|---|---|
| 28 fiches rédigées à la main (`dist/cours-fiches-*.mjs`, agrégées dans `dist/procedures-cours.mjs`) | Bases Linux/Bash, stockage, quotas, RAID 1, Samba, DNS Samba, jonction Ubuntu, RSAT. Même modèle que les autres procédures : même contrat, mêmes copies, mêmes vues « Vue rapide » et « Pas à pas ». Aucune n’est générée automatiquement. |
| `dist/cours.mjs` | Le cours « Serveurs II — TP2 » : parcours A à E, éléments, fiches et étapes citées, éléments non couverts, soutien, ambiguïtés, gabarit pour un prochain TP. Aucune commande ici : un parcours renvoie vers une fiche et une étape. |
| `dist/labo.mjs` | « Mon laboratoire » (15 champs sans secret ni disque), modèle de CSV fictif, progression. Module pur. |
| `dist/vue-cours.mjs` | Le marquage des deux espaces (HTML pur, testable sous Node). |
| `dist/app.js`, `index.html`, `styles.css` | Routes `#/cours`, `#/cours/<id>/<Lettre>`, `#/labo`, `#/tache/<id>/etape/<n>/depuis/<cours>/<Lettre>` ; entrées du menu ; bandeau d’accueil ; étape visée repérée ; « Utiliser mon laboratoire » ; stockage local protégé. |
| `dist/procedures.mjs` | Types de paramètres `peripherique` (disque / partition / matrice), `etiquetteExt4`, et contrôles croisés `distinctDe` et `superieurA`. |
| `dist/classement.mjs` | Liste `fiches` (une fiche nommée peut être rangée sans hôte), `estPlaceDirect`, nouvelles familles Linux. |

## 2. Décisions de conception

- **Un parcours n’est pas une copie.** Corriger une commande dans la fiche corrige tous les parcours. Les lettres et numéros du TP (A, B7, D8.1…) ne sont PAS des identifiants : ils servent d’alias de recherche (« TP2 B7 », « b7 »).
- **Les parcours sont notre lecture de l’énoncé.** Les documents d’origine ne sont pas republiés ; les demandes sont résumées dans nos mots. En cas de doute, l’énoncé fait foi.
- **Dire ce qui manque.** Trois éléments n’ont pas de fiche et le parcours l’écrit en toutes lettres (« Non couvert par le catalogue », pas seulement une couleur) : A5 (ouverture de session Windows avec un compte de domaine), B1 (ajouter un disque dans l’hyperviseur), D7 (accès graphique à un partage depuis Windows 11).
- **Une case cochée n’est pas une preuve.** L’écran et le parcours le disent ; la progression ne garde que des identifiants d’éléments.
- **Architecture statique, aucun serveur.** Le stockage local ne contient que le laboratoire (non sensible) et la progression ; chaque lecture et écriture est protégée (try/catch), et si le stockage est refusé l’écran fonctionne et le dit.
- **Aucune présomption de disque.** Aucune commande ne contient `/dev/sdb` ou `/dev/md127` : ils sont des paramètres validés (`peripherique`), l’exemple n’est qu’un exemple affiché, la première étape lit `lsblk`/`/proc/mdstat`, et chaque étape destructive dit ce qui sera effacé. Le laboratoire n’a pas de champ disque, UUID ou gid.
- **Laboratoire ≠ professionnel.** `chmod 777` est une étape facultative nommée « LABORATOIRE » à côté de l’étape professionnelle (2775 / 770) ; systemd-resolved n’est jamais désactivé (réglage netplan par `60-domaine-ad.yaml` et `netplan try`) ; aucun sudo pour tous les comptes du domaine ; le mode GPO permissif n’est qu’une étape « dernier recours » en lecture seule, présentée comme un diagnostic et non comme une réparation.
- **Piège `read list` / `write list`.** Selon le manuel de `smb.conf`, un compte présent dans les deux listes reçoit l’écriture. Les fiches utilisent donc `read only = yes` et un groupe d’écriture distinct, et le validateur `distinctDe` refuse deux fois le même compte ou groupe.
- **Accueil sobre.** « Tâches courantes » garde les tâches phares ; les fiches de cours se trouvent par la recherche, les rubriques du catalogue et « Mes cours et TP » (le banc `browser-taches` impose au plus 40 lignes à l’accueil).
- **Deux vues seulement** pour les fiches (Vue rapide, Pas à pas) ; un lien d’étape ouvre toujours « Pas à pas », seule vue qui numérote les étapes.

## 3. Classement (domaine → groupe → sujet → fiche)

Familles ajoutées sous **Linux et services réseau** : *Fichiers et dossiers* (sujets *Se repérer et identifier*, *Créer, copier, déplacer, supprimer*), *Lire, chercher et filtrer du texte*, et la famille *Bash et automatisation* reçoit les trois fiches de scripts. Les fiches de stockage, de comptes locaux, de permissions, de Samba (3 fiches) et d’annuaire (jonction Ubuntu, DNS Samba, import CSV, groupes) rejoignent les sujets existants ; la fiche RSAT est dans *Active Directory › Outils d’administration à distance (RSAT)*. La section Samba « couverture à venir » est conservée : les **assistants** guidés SAMBA-ADV-01 restent non réalisés (les fiches rédigées ne sont pas des assistants). Recalcul : 390 entrées classées, 0 orpheline, 0 rubrique vide, trois niveaux au plus (`node test/classement.test.mjs`).

Taxonomie de tâches visée (A–G, reconstruite) : A se repérer, B manipuler fichiers et dossiers, C lire/chercher/filtrer, D comptes, groupes et droits, E stockage (partitions, quotas, RAID), F partage et domaine (Samba, DNS, jonction), G scripts Bash.

## 4. Prérequis que le cours supposait et que le catalogue n’avait pas

Gestion de groupes Samba (`cours-samba-groupes`), transferts `smbclient` (`cours-smbclient-transferts`), jonction Ubuntu realmd/SSSD/PAM (`cours-ubuntu-jonction-ad`), DNS Samba (`cours-samba-dns`) et RSAT (`cours-rsat-windows`) : tous écrits, tous cités par un parcours ou par la liste de soutien.

## 5. Tests

| Banc | Résultat |
|---|---|
| `test/cours.test.mjs` (statique) | 2 197 vérifications, 0 échec : contrat des 28 fiches, classement, sécurité (aucun périphérique, aucun mot de passe, 777 réservé, GPO, systemd-resolved), validateurs, parcours et leurs 8 contre-épreuves, alias, laboratoire, CSV, progression |
| `test/browser-cours.test.mjs` (Chromium) | 56 vérifications, 0 échec : accueil → Mes cours et TP → parcours → étape en **3 gestes**, repère et retour, non-couverts écrits, progression, stockage refusé, laboratoire, CSV, gabarit, routes inconnues, 390 px |
| Bancs historiques rejoués sans changer d’assertion | taches 920, classement 507, coherence 4 419, scenarios 865, commandes-rapides 938, cmd-methodes 337, ci-workflows 92, négatifs LOT 7 959, dette-6b 183, identity 92 709, baseline-856 10, cisco 3 011, fiches-poste-b, navigateur : navigation 237, taches 120, coherence 45, scenarios 184, lot7 2 274, intégration Azure+Cisco 257 |

**Évolution justifiée d’un test existant :** `test/classement.test.mjs` contrôlait qu’une fiche « hôte connu » existait en la nommant en dur (`cisco-voir-routes`). Il appelle désormais `C.estPlaceDirect(e.id)`, qui couvre aussi les fiches rangées par la liste `fiches`. La contrainte est la même (chaque fiche doit avoir une place précise) ; une contre-épreuve vérifie que `estPlaceDirect` refuse un identifiant inconnu. **Aucune assertion n’a été affaiblie.**

Sources : 64 adresses HTTPS citées par les fiches, toutes joignables le 27 octobre 2026 (statut 200 ; ancres de la page Bash présentes). Joignable ≠ contenu relu mot à mot : le champ `validation` de chaque fiche dit « relues contre la documentation officielle et recoupées avec les notes de cours ; NON exécutées ».

## 6. Non couvert, non vérifié, reconstruit

**Non couvert par le catalogue :** A5, B1, D7 (ci-dessus).

**Non vérifié :**

- `samba-tool user create` avec `--must-change-at-next-login` et `--random-password` : options NON confirmées dans le manuel ; elles ne figurent dans aucune commande (le banc l’interdit).
- Comportement exact du renommage `md0` → `md127` après arrêt : pratique connue, non confirmée par le manuel de `mdadm` (l’avertissement est donné en des termes prudents).
- Effet réel de toute commande : rien n’a été exécuté.
- Deux des documents joints à la mission n’ont pas pu être relus après la première compaction de la session ; le contenu du TP et la taxonomie A–G ci-dessus sont **reconstruits** à partir de ce qui restait (notes et captures relues). À contrôler contre l’énoncé.

**Ambiguïtés de l’énoncé signalées dans le parcours :** unité « 260 Mo » (Mo ou Mio), deux fichiers du même nom, 777, `systemctl restart smbd` sur un contrôleur de domaine, « utilisateurs Samba » vs `samba-tool`, réceptionniste lecture seule, compte du domaine propriétaire (chown/quotas), `--run` après `--stop`, `/dev/hdc` ancien, `quotacheck -c`, nom du document de référence (S05/S06).

## 7. Pour un prochain TP

L’espace « Mes cours et TP » propose le téléchargement d’un **gabarit JSON** qui suit exactement le contrat de `incoherencesCours` (lettres, éléments, fiches citées, éléments non couverts avec explication, ambiguïtés). Ajouter un cours = ajouter un objet dans `COURS` ; `node test/cours.test.mjs` vérifie que chaque fiche et chaque étape citées existent.
