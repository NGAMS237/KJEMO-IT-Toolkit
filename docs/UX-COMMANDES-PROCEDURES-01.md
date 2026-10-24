# UX-COMMANDES-PROCEDURES-01 — rapport

Critère principal : une personne retrouve-t-elle la bonne tâche et ses commandes sans parcourir plusieurs écrans d'explications ? Flux : RECHERCHER → CHOISIR LA TÂCHE → SUIVRE LES ÉTAPES → COPIER → VÉRIFIER.

## Choix de navigation
- Accueil : recherche centrale, filtres plateforme, catégories compactes, favoris/récents, résultats en lignes compactes (une ligne = titre, résumé d'une phrase, plateforme, effet).
- Trois natures d'entrée : procédure rédigée, commande rapide (LOT 7 adaptée au modèle de procédure), assistant complet (les 211 assistants, routes `#/outil/<id>` inchangées).
- Un assistant couvert par une fiche courte est replié sous elle dans les listes mais reste atteignable (`#/outil/<id>`, bouton « Assistant complet », `#/assistants`).
- Recherche : titre exact et intention d'abord, puis synonymes/accents/mots de plateforme ; requête ambiguë = pas de résultats forcés ; coupe de longue traîne.

## Choix de présentation
- Cartes d'étape numérotées, un bloc de commande par étape, bouton Copier par bloc et « Copier toutes les commandes » (désactivé pour les méthodes à séquence non copiable).
- Débutant : « Résultat attendu » visible ; Technicien : replié. Les effets importants restent toujours visibles.
- Couleurs : bleu instruction, vert résultat attendu, orange effet important, rouge destructif, toujours avec étiquette.

## Règles du moteur
Texte copié calculé depuis les données ; aucun prompt ni numéro copié ; copie bloquée si paramètre manquant ou invalide ; Cisco : mode à côté de l'étape, enregistrement jamais silencieux.

## Couverture
Voir `docs/UX-COUVERTURE.md` : 30 fiches rédigées + 112 commandes rapides, 56 assistants reliés, 155 assistants uniquement via l'assistant complet.

## Validation (ce qui a réellement tourné)
- Statique : `node test/taches.test.mjs` (721 contrôles).
- Navigateur Chromium (Playwright) : `node test/browser-taches.test.mjs` (120), plus les bancs historiques adaptés (identité, lot7, contre-épreuves lot7, cisco, azure, impression, poste-b, intégration).
- Non exécuté : CI GitHub distante, Windows PowerShell 5.1, laboratoires réels (Cisco, Azure, AD, imprimantes). Les fiches portent « validation non exécutée ».

## Lancer et relire
`cd KJEMO-IT-Toolkit-v0.1 && npm run test:taches && npm run test:browser:taches` ; ouvrir `dist/index.html` via un serveur statique ; routes `#/`, `#/assistants`, `#/tache/cisco-creer-vlan`.
