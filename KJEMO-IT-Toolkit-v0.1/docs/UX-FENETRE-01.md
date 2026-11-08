# UX-FENETRE-01 — fiche en fenêtre et accueil par plateforme

Statut : développé et testé localement (Chromium sans tête). Pas dans la CI distante, pas publié sur GitHub, pas déployé. Aucune commande n'est exécutée par l'application.

## Fiche en fenêtre
- Quand on ouvre une fiche **depuis une page de l'application** (accueil et recherche, aide-mémoire, groupe, catalogue, parcours d'un cours), la fiche s'ouvre dans une fenêtre au-dessus de cette page. La page reste derrière, à la même place, sans être redessinée.
- On défile dans la fenêtre. On ferme par **✕ Fermer** (toujours visible en haut), **Échap**, un clic sur le fond sombre, ou les liens « Retour… » de la fiche. Le focus revient sur la ligne d'où l'on est parti.
- La barre latérale et la barre du haut (recherche, thème, mode) restent utilisables : cliquer sur la navigation ferme naturellement la fenêtre.
- L'adresse reste `#/tache/<id>` : le lien se partage. Un lien ouvert directement (rien derrière) s'affiche en pleine page, comme avant. « Précédent » du navigateur ferme la fenêtre.
- Mobile (≤ 820 px) : la fenêtre occupe tout l'écran, croix de 44 px.

## Accueil par plateforme
- Les puces Toutes / Linux / Windows / Cisco / Azure règlent la même page d'accueil : les trois portes, le menu de gauche (« Mes cours Windows », « Aide-mémoire Windows », « Catalogue pro Windows »), la liste des cours, l'aide-mémoire et le catalogue ne montrent que cette plateforme.
- Ce qui n'existe pas encore (cours et aide-mémoire Windows, Cisco, Azure) est une carte pointillée « Bientôt », jamais un faux bouton. Les cartes de groupes d'aide-mémoire vides n'apparaissent pas sur l'accueil d'une plateforme ; la page Aide-mémoire garde les groupes grisés avec la raison.
- « Toutes » ajoute un tableau « Où en est chaque plateforme » (cours, fiches, entrées de catalogue) ; un clic sur le nom règle le filtre.
- Un cours déclare ses plateformes (`plateformes: ['Linux']`) : le prochain cours Windows remplira la porte sans changer la page.

## Tests
`test/browser-plateformes.test.mjs` (49), `test/vue-portes-plateforme.test.mjs` (11), `test/browser-portes.test.mjs` (63, adapté) ; bancs `cours`, `identity`, `lot7`, `taches`, `navigation`, etc. adaptés là où ils attendaient la fiche en pleine page.
Limite : testé sous Chromium seulement ; aucun lecteur d'écran réel essayé.
