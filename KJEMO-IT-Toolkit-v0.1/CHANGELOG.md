## UX-MEMO-WINDOWS-01 (2026-10-28)
- Constat : dans l'aide-mémoire Windows, « Créer une OU » et la plupart des lignes ouvraient un ASSISTANT (formulaire qui fabrique un script), sans commande visible ni bouton Copier, contrairement aux fiches Linux.
- 26 fiches Windows à COMMANDE DIRECTE (`dist/procedures-windows.mjs`) : Active Directory (voir/créer OU, créer utilisateur et groupe, ajouter un membre, réinitialiser un mot de passe, désactiver, déplacer, joindre un poste au domaine), GPO (lister, créer et lier, gpresult), DHCP (installer, étendue, réservation, baux), DNS (zone directe, inverse, enregistrement A), partages (créer, droits NTFS, voir, connecter un lecteur), comptes locaux. Chacune : formulaire de valeurs, commande copiable, vérification, retour arrière, lien vers l'assistant complet (conservé).
- Aucun mot de passe saisi ni écrit : PowerShell le demande (Read-Host -AsSecureString, Get-Credential).
- 5 nouveaux types de paramètres validés : dn, cheminWin, principal, mac, cidr (avec refus testés).
- Aide-mémoire : 5 groupes Windows faits uniquement de fiches à commande directe ; sous un filtre de plateforme, les groupes sans fiche sont regroupés dans une ligne qui les nomme (au lieu de blocs gris un par un). Azure reste volontairement sans groupe.
- Les nouvelles fiches (origine « memo ») n'encombrent pas les « tâches courantes » de l'accueil.
- Tests : `windows-fiches.test.mjs` (430), `memo.test.mjs`, `browser-portes.test.mjs`, `cmd-methodes.test.mjs` mis à jour. Non exécuté sur un contrôleur de domaine ou un poste réel.

## Alignement formatifs du prof (2026-10-28)
- 3 fiches : `cours-bash-menu`, `cours-samba-script-menu`, `cours-droits-fichier` (53 fiches de cours).
- Fiches adaptées au niveau du cours : condition (calculatrice), boucles (sans select), find, groupes locaux, afficher-texte.
- Parcours A du TP2 : script à menu ; l’import renforcé reste en soutien. Voir `docs/ALIGNEMENT-FORMATIFS-PROF.md`.

## CISCO-S07-01 (2026-10-28)
- Premier cours Cisco : semaine 7 EtherChannel et Spanning Tree (3 parcours, 6 exercices du formatif 07), 9 fiches IOS, groupe « Commutation Cisco » de l'aide-mémoire, famille du catalogue.
- Résumé pliable du cours (essentiel, schémas, commandes, pièges, questions à réponse cachée) ; schémas SVG originaux dans les fiches. Voir `docs/CISCO-S07-01.md`.

## UX-FENETRE-01 (2026-10-28)
- Fiche en fenêtre (croix, Échap, fond, retour navigateur) au-dessus de la page d'origine ; lien direct = pleine page.
- Accueil par plateforme : portes, menu, cours, aide-mémoire et catalogue filtrés ; cartes « Bientôt » ; tableau d'avancement sur « Toutes ». Voir `docs/UX-FENETRE-01.md`.
