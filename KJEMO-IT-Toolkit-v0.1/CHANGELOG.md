## CLAVIER-01 (2026-10-31)
- 8 fiches : Linux (voir la disposition, fixer avec localectl, régler la session GNOME/setxkbmap, changer la langue du système) et Windows (voir langues et claviers, garder une seule langue, désactiver Alt+Maj, régler le format régional).
- Causes ciblées d’un clavier qui change tout seul : plusieurs dispositions installées, raccourci de basculement, réglage de session qui prend le dessus, écran de connexion distinct, langue transmise par SSH.
- Testé : contrat, rangement, recherche, valeurs refusées. Les commandes localectl, gsettings et PowerShell ne sont PAS exécutées sur un vrai poste.

## LINUX-COMPTES-01 (2026-10-31)
- 5 fiches : lister les comptes locaux, lister les groupes locaux (avec membres), changer un mot de passe local (passwd), voir un compte Samba AD (samba-tool user show), changer un mot de passe Samba AD (samba-tool user setpassword).
- Un mot de passe ne se retrouve pas (seule l’empreinte est stockée) : il se remplace. Dit dans les fiches.
- Testé : getent/awk exécutés pour de vrai ; les commandes samba-tool ne sont PAS exécutées sur un vrai contrôleur de domaine.

## LINUX-SIMPLES-01 (2026-10-31)
- Constat : `sed -i` et les contrôles de CSV n'existaient pas comme fiches (seulement dans quelques assistants du catalogue pro), alors que le TP2 en a besoin (CSV à séparateurs, fins de ligne Windows).
- 5 fiches à commande directe (`dist/procedures-linux-simples.mjs`) : remplacer du texte (sed -i avec copie .bak, aperçu avant), afficher ou supprimer des lignes, vérifier le format d'un CSV (séparateur, colonnes, ^M), extraire une colonne (cut), corriger les fins de ligne Windows.
- Rangées dans « Lire, chercher et filtrer du texte » (catalogue) et dans un nouveau sous-groupe « Modifier, corriger, vérifier un fichier » du groupe Lire et filtrer du texte (aide-mémoire).
- Le séparateur est un choix fermé (; , : |) ; les mots saisis sont validés (aucune barre oblique ni point-virgule).
- Test `linux-simples.test.mjs` (68) : les commandes rendues sont EXÉCUTÉES pour de vrai (bash, sed, awk, cut, diff, file) sur de vrais fichiers temporaires.

## WINDOWS-SIMPLES-01 (2026-10-30)
- Constat : l'aide-mémoire Windows manquait des commandes simples du quotidien (vider les caches, tracert, processus, arrêt, robocopy, winget…). Vérification des doublons avant construction : vider le cache DNS, ping, résoudre un nom, voir l'IP, IP fixe, bail DHCP, SFC/DISM, gpupdate, services, journal, espace disque existaient déjà et ne sont pas refaits.
- 55 fiches à commande directe, en trois fichiers (`dist/procedures-windows-simples.mjs` réseau, `procedures-windows-poste.mjs` poste, `procedures-windows-ad-simples.mjs` Active Directory) : 7 caches (identifiants, Store, Windows Update, presse-papiers, Kerberos, ARP, NetBIOS), réseau (ipconfig /all, release/renew, tracert, pathping, Winsock, routes, ARP, clé Wi-Fi, pare-feu état / ouvrir / fermer), informations système (résumé, version, uptime, nom, renommer, groupes, licence, BitLocker), processus (trouver, gourmands, fermer), arrêt (shutdown, annuler, sessions), fichiers (chkdsk, robocopy, chercher, hash, zip, dézip, takeown), logiciels (winget installer / mettre à jour, correctifs), réglages (tâche planifiée, variable, PATH, Bureau à distance, heure), comptes locaux (mot de passe, administrateurs, désactiver), consultation AD (membres, infos, ordinateur, contrôleur, mot de passe).
- Aide-mémoire : 2 groupes nouveaux (Système, processus et arrêt ; Disque, fichiers et logiciels), sous-groupes « Vider les caches », « Routes et voisins », « Pare-feu », « Réparer la pile réseau » ; les trois fiches communes Windows/Linux (ping, résoudre un nom, vider le cache DNS) sont enfin visibles dans l'aide-mémoire (groupe Réseau). 7 groupes Windows au total.
- Garde-fous : aucun mot de passe écrit (Read-Host -AsSecureString) ; administrateurs désignés par SID (indépendant de la langue) ; robocopy sans /MIR ni /PURGE ; dézip sans -Force ; droits sauvegardés avant takeown ; fermeture de processus précédée d'une lecture ; avertissements (RDP jamais sur Internet, clé Wi-Fi affichée à l'écran).
- Tests : `windows-simples.test.mjs` (898), `browser-windows-simples.test.mjs` (40) ; memo.test.mjs ajusté (7 groupes Windows).
- Non exécuté sur un poste Windows réel ; URL Microsoft Learn écrites de mémoire, non ouvertes. Commandes dépendantes de la langue (messages affichés) décrites « selon la langue ».

## AZURE-COURS-01 (2026-10-28)
- Source : 9 PDF de cours Azure (infonuagique, introduction à Azure, réseau virtuel, résolution de noms, peering et routage, accès privé, équilibrage de charge, activation de l'abonnement). Le PDF 04 reçu en double n'est traité qu'une fois. Doublons évités : les assistants azure-contexte, azure-rbac, azure-abonnements-rg, azure-reseau-vnets, azure-reseau-dns, azure-reseau-interfaces-ip, azure-stockage-exposition et azure-vm-inventaire sont réutilisés ; une seule fiche est repliée sous chaque assistant.
- 19 fiches Azure CLI à commande directe (`dist/cours-fiches-azure.mjs`) : groupe de ressources, verrou, rôle d'un coéquipier, VNet, sous-réseau, plan d'adressage, IP publique/privée, VM, DNS public et privé, peering (création et état), routes effectives et personnalisée, service endpoint, private endpoint, load balancer (création et état). Aucune commande de suppression dans le parcours principal.
- 5 cours (`dist/cours-azure.mjs`) avec résumé pliable (`dist/cours-resume-azure.mjs`) et 10 schémas originaux (`dist/schemas-azure.mjs`, 32 schémas au total).
- 4 groupes d'aide-mémoire Azure (bases, réseau, routage et accès privé, équilibrage) et 2 familles du catalogue.
- Validateurs : nomAzure et compteStockage (refus testés).
- Deux ambiguïtés de diapositives à confirmer avec l'enseignant : AZ03-1 (Windows ou Linux pour les VM) et AZ06-1 (service endpoint ou private endpoint).
- Tests : `azure-cours.test.mjs` (924), `browser-azure-cours.test.mjs` (71) ; tests existants ajustés (cours, memo, cisco-s07).
- Non exécuté sur un abonnement Azure réel ; URL Microsoft Learn écrites de mémoire, non ouvertes. Pas de fiche pour App Service, Application Gateway, Traffic Manager ni Front Door.

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

## CISCO-COURS-RESEAU-01 (2026-10-28)
- Source : 12 fichiers de cours (S01 à S05, tableaux VLSM, formatif, TP2, note de cours). Vérification des doublons avant construction : les assistants cisco-identification, cisco-gestion-ip, cisco-port-security-config, cisco-vtp-configuration, cisco-dtp-simulation et cisco-vtp-diagnostic sont réutilisés (fiches repliées sous leur assistant), rien n'est recréé.
- 17 fiches Cisco à commande directe (`dist/cours-fiches-cisco-reseau.mjs`) : base et gestion, ports du commutateur, routes statiques / par défaut / flottantes, RIP, VTP, DTP, dépannage.
- 5 cours (`dist/cours-cisco-reseau.mjs`) : S01 révision et VLSM, S02 commutateur et sécurité, S02-S03 routage, S05 VLAN/VTP/DTP, TP2 routage statique. Chacun avec son résumé pliable (`dist/cours-resume-cisco-reseau.mjs`).
- 14 schémas originaux (`dist/schemas-cisco-reseau.mjs`), 22 schémas Cisco au total.
- 3 groupes d'aide-mémoire Cisco (adressage et routage, accès et ports, VLAN/VTP/DTP).
- Validateurs : interface Serial, adresse MAC au format IOS, texte ASCII.
- TP2 : 4 ambiguïtés de l'énoncé signalées comme propositions à confirmer avec l'enseignant (192.158.5.66, S0/0/0 de R1 et R3 identiques, lien R2-R3 absent du tableau 1, adresses PC5/PC6).
- Tests : `cisco-reseau.test.mjs` (996), `browser-cisco-reseau.test.mjs` (72) ; tests existants ajustés (cisco-s07, memo, cours).
- Non exécuté sur Packet Tracer ni sur du matériel Cisco ; URL de sources écrites de mémoire, non ouvertes.

## CISCO-S07-01 (2026-10-28)
- Premier cours Cisco : semaine 7 EtherChannel et Spanning Tree (3 parcours, 6 exercices du formatif 07), 9 fiches IOS, groupe « Commutation Cisco » de l'aide-mémoire, famille du catalogue.
- Résumé pliable du cours (essentiel, schémas, commandes, pièges, questions à réponse cachée) ; schémas SVG originaux dans les fiches. Voir `docs/CISCO-S07-01.md`.

## UX-FENETRE-01 (2026-10-28)
- Fiche en fenêtre (croix, Échap, fond, retour navigateur) au-dessus de la page d'origine ; lien direct = pleine page.
- Accueil par plateforme : portes, menu, cours, aide-mémoire et catalogue filtrés ; cartes « Bientôt » ; tableau d'avancement sur « Toutes ». Voir `docs/UX-FENETRE-01.md`.
