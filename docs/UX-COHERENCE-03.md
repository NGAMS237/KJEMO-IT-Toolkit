# UX-COHERENCE-03 — audit de cohérence de l'application

Base : `main` distant `9c8a9be` (fusion de UX-02b, arbre `d284eb57…`). Branche : `claude/ux-coherence-03`.
Audit : site publié (https://ngams237.github.io/KJEMO-IT-Toolkit/#/) puis version locale ; **362 routes** parcourues dans un vrai navigateur (211 `#/outil/<id>`, 151 `#/tache/<id>` : 39 fiches dont 4 scénarios, 112 commandes rapides). Les nombres sont recalculés par `couverture()` et par le banc, jamais recopiés.

## 1. Réponse à la question : normal, manquant ou régression ?

**Normal.** Un assistant complet ne propose qu'un script : c'est sa nature (formulaire → génération d'un script PowerShell, Bash ou de commandes Cisco IOS à copier ou télécharger). Les 211 assistants sont dans ce cas ; les 155 sans version courte n'ont donc ni Vue rapide, ni Pas à pas, ni onglets CMD / PowerShell / GUI — et ce n'est pas un défaut de rendu.

**Manquant (couverture, pas bug).** 155 assistants sans fiche courte, concentrés sur Windows (poste, serveur, AD, GPO), Azure et imprimantes ; les 112 commandes rapides sont toutes Linux / Bash ; aucune commande rapide Windows ni Cisco. Voir `docs/UX-COUVERTURE-PLAN.md` (plan distinct, priorisé, aucune fiche générée automatiquement).

**Intégration oubliée de UX-02b (corrigée ici).** Le moteur « fiches » avait reçu les en-têtes, badges de plateforme/méthode et favoris ; la page assistant, elle, était restée sur l'ancien gabarit : ancre générique « Script », aucune plateforme, aucun langage, aucun favori, pas de lien vers les commandes rapides. Pas de régression fonctionnelle : aucune fiche, commande, copie ou téléchargement n'a perdu de contenu.

## 2. Tableau des incohérences

| # | Route(s) | Problème constaté | Attendu | Correction |
|---|---|---|---|---|
| 1 | `#/outil/*` (211) | En-tête sans type, sans plateforme, sans langage, sans favori (une fiche les a) | Même en-tête que les fiches : type « ASSISTANT COMPLET », plateforme, langage, favori | `enteteAssistantMeta()` (vue-taches.mjs) ; tag `… · ASSISTANT COMPLET` ; `#toolFav` activable au clavier |
| 2 | `#/outil/*` (211) | Ancre de navigation « Script » identique pour PowerShell, Bash et Cisco IOS | Libellé = contenu réel | Ancre = `etiquetteSortie()` : « Script PowerShell », « Script Bash », « Commandes Cisco IOS » |
| 3 | `#/outil/*` Azure (24) | Classés plateforme « Windows » ; le filtre Azure ne les trouvait pas | Plateforme Azure | `Multi → Azure` dans `entreeAssistant` |
| 4 | `#/outil/*` (32 assistants : 29 par commande rapide seule, 3 par fiche et commande) | Une commande rapide renvoie à l'assistant, l'assistant ne renvoie pas à la commande | Lien réciproque | `liensDeAssistant()` + bloc « Commande(s) rapide(s) liée(s) » ; version courte inchangée pour les 27 fiches |
| 5 | `#/tache/*` fiches à méthode unique (21) et commandes (112) | La méthode n'est nommée nulle part (pas d'onglet) | Méthode visible | Pastille de méthode (`Cisco IOS`, `CMD`, `Linux / Bash`…) dans l'en-tête ; scénarios : méthodes de leurs équipements |
| 6 | Cartes de résultat (362) | Type et plateforme, jamais la méthode ni le langage | Méthode nommée sur chaque carte | `methodeBadgesMarkup()` dans `ligneResultatMarkup()` |
| 7 | `#/outil/*` diagnostic non marqué `readOnly` (67) et destructifs (4) | Ligne « Effet » en ambre, y compris pour « ne modifie rien » et pour un effet destructif | Vert = lecture, ambre = modification, rouge = destructif | Ton calculé comme le badge de la fiche (`sr-ok` / `sr-attention` / `sr-danger`) |
| 8 | `#/outil/*` | Même effet affiché trois fois dans l'en-tête | Une seule pastille | Pas de badge d'effet en double ; la pastille de risque et la ligne « Effet » restent |
| 9 | `#/outil/*` vs `#/tache/*` | Section « Méthode graphique » d'un côté, onglet « Interface graphique » de l'autre | Même nom | Section et résumé renommés « Interface graphique » |
| 10 | Accueil, recherche active | Grille des catégories repoussait les résultats sous la ligne de flottaison (≈ 855 px) | Résultats visibles sans défiler | Grille repliée pendant une recherche (barre latérale inchangée) |
| 11 | Champ de recherche (Chromium) | Deux boutons « effacer » (natif + personnalisé) | Un seul | Bouton natif masqué |

Contrôlé et **sans écart** : changements de méthode sans rechargement (aucune méthode vide, aucune commande dans l'interface graphique, aucun faux équivalent entre méthodes à commandes), changement de fiche (méthode initiale, valeurs saisies remises à zéro), changement d'assistant (aperçu à jour, Copier actif, pas de valeur héritée), retour navigateur, favoris et récents, 390 px sur chaque modèle de page, contrastes des pastilles (clair et sombre).

## 3. Pages où « Script » est légitime

Les 211 assistants, chacun identifié par son langage avant le gros bloc de code (ligne « Produit », ancre, titre de section, pastille) :

### Entrées par type et méthode

| Type | Méthode / langage | Entrées |
|---|---|---|
| Procédure (fiche) | Cisco IOS | 8 |
| Procédure (fiche) | Linux / Bash | 8 |
| Procédure (fiche) | PowerShell | 18 |
| Procédure (fiche) | CMD | 13 |
| Procédure (fiche) | Interface graphique | 9 |
| Procédure (fiche) | Azure CLI / PowerShell | 4 |
| Scénario | Cisco IOS | 2 |
| Scénario | PowerShell | 3 |
| Scénario | Linux / Bash | 1 |
| Scénario | CMD | 1 |
| Commande rapide | Linux / Bash | 112 |
| Assistant complet | Script PowerShell | 145 |
| Assistant complet | Script Bash | 47 |
| Assistant complet | Commandes Cisco IOS | 19 |

### Assistants par famille

| Famille | Assistants | Avec version courte | Script seul | Langage |
|---|---|---|---|---|
| Réseau | 24 | 5 | 19 | Script PowerShell 24 |
| Active Directory | 18 | 2 | 16 | Script PowerShell 18 |
| Windows Server | 15 | 0 | 15 | Script PowerShell 15 |
| GPO | 19 | 1 | 18 | Script PowerShell 19 |
| Analyse et nettoyage des disques | 1 | 1 | 0 | Script PowerShell 1 |
| Poste de travail Windows | 33 | 3 | 30 | Script PowerShell 33 |
| Linux et services réseau | 43 | 32 | 11 | Script Bash 43 |
| Azure et Entra ID | 24 | 3 | 21 | Script PowerShell 24 |
| Réseau et Cisco | 19 | 7 | 12 | Commandes Cisco IOS 19 |
| Imprimantes | 15 | 2 | 13 | Script PowerShell 11, Script Bash 4 |


Un assistant n'est **pas** transformé en procédure : l'écart de couverture est décrit dans le plan distinct.

## 4. Tests

- `test/coherence.test.mjs` (statique) : types, méthode jamais générique, plateformes, GUI sans commande, méthodes non vides, liens réciproques, cartes.
- `test/browser-coherence.test.mjs` (navigateur) : 362 routes sans rechargement (une seule vue visible, bon titre, bon type, bonne méthode, bon ton), changements de méthode/fiche/assistant, liens réciproques cliqués, filtres, favoris au clavier, récents, 390 px par modèle, contrastes.
- Contre-épreuves par mutation : réintroduire l'ancre « Script », `Multi → Windows` ou supprimer le lien vers les commandes fait échouer les bancs (le banc navigateur échoue sur l'ancre ; le banc statique relève 26 écarts pour `Multi → Windows` et 221 pour les liens supprimés).
- Les bancs historiques sont rejoués sans modification d'assertion ; résultats dans le rapport final de livraison.

**Limites.** Rendu, copies et génération sont vérifiés dans un navigateur ; **aucune commande n'est exécutée** sur un poste, un équipement Cisco, un serveur ou un tenant Azure. La CI GitHub (Windows/Linux) ne tourne qu'à la publication de la branche.

## 5. Captures avant / après

`captures/cmp-av-*` (main 9c8a9be) et `captures/cmp-ap-*` (cette branche) : recherche, assistant PowerShell, assistant avec version courte, assistant Cisco IOS, méthode CMD, inter-VLAN et SSH Cisco en Vue rapide ; bureau 1280 px et mobile 390 px, même thème sombre, mêmes valeurs d'exemple. La Vue rapide des fiches grandit d'environ 8 px (pastille de méthode) : aucun gain de compacité n'est revendiqué ici.
