# KJEMO-UX-ACCUEIL-01 — Accueil à trois portes, aide-mémoire, catalogue professionnel

**État : développé localement (branche `claude/commandes-cours-tp2-01`), testé localement (statique + Chromium 1280 px et 390 px). Pas testé en CI GitHub, non fusionné, non déployé.** Aucune commande n'a été exécutée sur une machine réelle.

## Problème constaté

Le TP2 n'était pas trouvable depuis l'accueil (il fallait deviner « Mes cours et TP »), les 412 entrées étaient rangées par domaine technique, deux rangées de filtres (plateforme et contenu) se superposaient, et il n'y avait pas de moyen de retour uniforme.

## Ce qui a changé

| Pièce | Rôle |
|---|---|
| `dist/memo.mjs` | Données et logique de l'**aide-mémoire** : 8 groupes (Fichiers, Texte, Comptes, Services, Réseau, Disques/RAID/quotas, Samba et domaine, Bash), sous-groupes, filtres calculés, routes, contrôle de cohérence. Module pur. |
| `dist/vue-portes.mjs` | Marquage HTML pur : trois portes, groupes, page Aide-mémoire, page de groupe, Catalogue pro, fil d'Ariane, boutons de retour, pastille de filtre. |
| `dist/app.js`, `dist/index.html`, `dist/styles.css` | Branchement : routes `#/memo`, `#/memo/<groupe>`, `#/catalogue` ; bouton **Accueil** persistant ; barre latérale colorée ; Échap = un pas en arrière. |

**Accueil.** Trois portes : *Mes cours et TP* (violet, avancement chiffré, bouton « Continuer » vers le premier parcours non terminé), *Aide-mémoire du cours* (vert), *Catalogue professionnel* (orange) ; puis les groupes de l'aide-mémoire, puis les « Tâches courantes ». La grille des domaines n'est plus dupliquée sur l'accueil (elle vit sous `#/catalogue`) et le filtre « Contenu » n'apparaît que pendant une recherche ou une liste.

**Couleur.** La couleur n'est jamais seule : chaque porte, groupe et lien de la barre latérale a une icône et un nom. Variantes claire et sombre.

**Retours.** Fil d'Ariane cliquable (Accueil en premier) ; retour en haut ET en bas des pages ; bouton Accueil dans la barre du haut ; dans une fiche de l'aide-mémoire, « ← Retour à <groupe> » ; depuis un parcours de cours, le retour reste le parcours ; Échap remonte d'un pas (fiche → groupe ou parcours → aide-mémoire → accueil). Échap ne fait rien dans un champ de saisie.

**Filtres.** Un seul filtre de plateforme, global. Quand il est actif, une pastille « Filtre : Linux » avec sa sortie « ✕ Toutes les plateformes » est visible sur les pages d'aide-mémoire et de catalogue. Dans l'aide-mémoire, trois puces : **Tous**, **Nouveautés**, **Liés au TP**, avec leurs compteurs. Un groupe qui n'a plus aucune fiche après filtre est **grisé et expliqué**, jamais supprimé.

## Comment l'aide-mémoire grandit

- Une fiche nouvelle = son identifiant ajouté dans la liste `fiches` d'un sous-groupe de `memo.mjs` ; un groupe nouveau = un objet de plus dans `MEMO_GROUPES`.
- « Nouveau » se calcule à partir de la table `AJOUTS` (date d'ajout) : sont nouvelles les fiches ajoutées dans les 14 jours qui précèdent la plus récente. Aucune horloge, résultat déterministe.
- « Liés au TP » se calcule à partir des références des parcours et du soutien de chaque cours (`fichesDuCours`) : un nouveau cours étend le filtre sans autre saisie.
- `incoherencesMemo` fait échouer `node test/memo.test.mjs` si une fiche est inconnue, rangée deux fois ou oubliée.

## Limites honnêtes

- Pour l'instant les 50 fiches sont toutes citées par le cours TP2 : « Liés au TP » égale donc « Tous » tant qu'un second cours n'existe pas. Idem pour « Nouveautés » : les fiches du lot R1 portent la même date d'ajout.
- Le fil d'Ariane des rubriques historiques commence toujours par « Catalogue » (vers l'accueil) ; une rubrique ouverte depuis le Catalogue pro ajoute le bouton « Retour au catalogue professionnel ».
- Backspace n'est pas lié (risque de perte de saisie) ; Échap et le bouton Précédent du navigateur le sont.
- Rien n'a été vérifié sur le site public : la publication GitHub est bloquée (voir REPRISE-COURS-TP2-R1.md).

## Tests

`node test/memo.test.mjs` (données, filtres, routes, marquage, contre-épreuves) et `node test/browser-portes.test.mjs` (portes, routes, retours, Échap, filtre et sortie, puces, groupes grisés, catalogue, 390 px). Les bancs historiques sont rejoués ; l'accueil conserve les « Tâches courantes » pour que leurs attentes restent valables.
