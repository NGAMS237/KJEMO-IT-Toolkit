## JOURNAL-LABO-06 (2026-11-05)

- Retour : « je ne vois pas les câbles ». L’éditeur de schéma a maintenant une palette « Câbles », comme les Connexions de Packet Tracer : câble droit, croisé, trunk 802.1Q, console, série (WAN), fibre, sans fil, VPN/logique. On choisit un câble, un bandeau dit quoi faire, puis on clique le premier et le deuxième équipement ; le mode reste actif pour enchaîner les câbles (« Terminer » ou Échap pour sortir).
- Interfaces et adresses : chaque câble a, de chaque côté, l’interface (suggestions tirées de la fiche de l’équipement) et son adresse IP ; elles s’affichent sur le schéma, dans le PDF et sa description. Une interface d’un équipement de l’inventaire y est enregistrée (ajoutée ou mise à jour) ; une interface déjà connue remplit son adresse.
- Un équipement posé depuis la palette peut être « ajouté à l’inventaire » (avec les interfaces déjà saisies sur ses câbles) ; la fiche d’un équipement lié montre ses interfaces et adresses dans le panneau.
- Légende des câbles utilisés sous la feuille et dans le PDF. Schéma du TP VLAN : câbles droits vers les postes avec l’adresse de chaque poste, trunk plus long pour des étiquettes lisibles. Les anciens styles « plein » et « tirets » deviennent « câble droit » et « VPN ».
- Tests : journal.test.mjs (193) et browser-journal.test.mjs (93).

## JOURNAL-LABO-05 (2026-11-05)

- Éditeur de schéma d’architecture dans chaque labo (section Architecture), « façon Packet Tracer » pour documenter (rien ne s’exécute) : palette (routeur, commutateur, pare-feu, point d’accès, serveur, poste, VM, réseau virtuel, service cloud, Internet, autre), équipements de l’inventaire (nom et adresse repris en direct), zones colorées (VLAN, site, réseau Azure), textes, et types personnels (nom + code, ex. Caméra IP « CAM ») pour les projets futurs.
- Glisser-déposer aimanté à la grille, agrandissement des zones par le coin, « Relier à… » pour créer un lien (câble, trunk épais, tirets pour VPN ou sans-fil) avec étiquette et interfaces de chaque côté, clavier (flèches, Suppr, Échap), liste des éléments pour choisir sans souris.
- Depuis la fiche du TP VLAN, le schéma est prérempli : R1, SW1 et le trunk 802.1Q avec les interfaces saisies, une zone par VLAN avec son poste et son port.
- PDF : le schéma est dessiné en vectoriel dans la section Architecture (net à toute taille), avec une description textuelle ; export du schéma seul en SVG. Le moteur PDF sait maintenant tracer courbes, cercles, rectangles arrondis et tirets.
- Supprimer un équipement de l’inventaire garde son nom sur les schémas. Les types personnels sont dans la sauvegarde du journal.
- Tests : journal.test.mjs (186) et browser-journal.test.mjs (86). Rien n’est simulé : le schéma documente, il ne vérifie pas la configuration ; les fichiers .pkt ne sont pas lus.

## JOURNAL-LABO-04 (2026-11-05)

- Correctif « le PDF ne marche pas » : dans l’aperçu claude.ai, la page est isolée et un lien de téléchargement n’y fait rien. L’export PDF, le PDF de l’inventaire et la sauvegarde passent maintenant par la fonction d’enregistrement de l’aperçu (une confirmation s’affiche) ; ailleurs (GitHub Pages, serveur local), c’est un téléchargement ordinaire. Un refus ou une impossibilité est dit dans la barre au lieu d’un faux « téléchargé ».
- Test : browser-journal.test.mjs simule l’aperçu (enregistrement accepté puis refusé) : 67 vérifications.

## JOURNAL-LABO-02 et 03 (2026-11-05)

- Exemples d’aide au remplissage : chaque champ vide du Journal de labo montre un exemple adapté à la catégorie (Cisco, Système, Azure, Autre) ; chaque tableau vide montre une ligne d’exemple ; les cellules vides affichent « ex. … ».
- « Voir un exemple rempli » : un labo d’EXEMPLE complet par catégorie (TP VLAN, jonction Samba AD, VNet et VM Azure, réseau de bureau), non enregistré tant qu’on ne le décide pas, pour voir un dossier et son PDF.
- Inventaire des équipements (`#/inventaire`) : un équipement existe une fois ; fiche qui s’adapte au système (interfaces et table de routage avec colonne « Pourquoi » pour tous, VLAN pour Cisco, services pour les serveurs et postes, règles de filtrage pour Azure et les pare-feu), exemples par système, recherche (nom, adresse, interface), export PDF de l’inventaire complet.
- Section « Équipements » dans chaque labo : cocher les équipements de l’inventaire et noter leur rôle dans ce projet ; créer un équipement depuis le labo (il y est ajouté) ; supprimer un équipement le retire des labos (annoncé avant).
- Depuis la fiche du TP VLAN, « Documenter dans le journal » crée aussi SW1 (SVI de gestion, trunk, VLAN, passerelle par défaut) et R1 (une sous-interface par VLAN, routes connectées calculées), sans jamais écraser un équipement du même nom.
- PDF du labo : section « Équipements » (synthèse) et « Annexe A. Fiches des équipements » (interfaces, table de routage, VLAN, services, règles).
- Sauvegarde du journal (version 2) : l’inventaire est inclus et restauré.
- Tests : journal.test.mjs (157) et browser-journal.test.mjs (63). Rien n’est envoyé ; les tables de routage se remplissent à la main (aucune lecture automatique de « show ip route »).

## JOURNAL-LABO-01 (2026-11-05)

- Nouvel espace « Journal de labo » (menu latéral, routes `#/journal` et `#/journal/<id>`) : documenter ses labos et projets (Réseau Cisco, Système, Azure, Autre) au format d’un dossier d’entreprise. Référence automatique (LAB-RES-2026-001…), version, état (brouillon, en service, archivé), classification, auteur, historique des révisions.
- Saisie guidée en neuf sections : objet et environnement, architecture, plan d’adressage, configuration (blocs de commandes), validation (À tester / Conforme / Non conforme), exploitation (accès, où sont rangés les identifiants, sauvegarde, retour arrière), incidents et solutions, références, captures (6 au plus, fichier ou Ctrl+V, converties en JPEG et gardées dans IndexedDB).
- « Documenter dans le journal » sur chaque fiche : crée le labo avec le titre, l’adressage (VLAN de gestion et tableau de VLAN pour le TP), les commandes rendues avec tes valeurs (phase par phase, sans étapes facultatives ni d’annulation), la vérification finale et le renvoi aux étapes « Annuler ».
- Export PDF A4 fabriqué dans le navigateur (moteur maison `pdf-a4.mjs`, sans dépendance ni réseau) : page de garde avec contrôle du document, historique et sommaire paginé, sections numérotées, tableaux coupés entre les pages avec en-tête répété, code en Courier, captures légendées, « Page X / N ». Fichier nommé `<référence>_v<version>.pdf`.
- Aucun mot de passe : tout texte qui en contient un (« secret Cisco123 », « mot de passe : … », « --admin-password … », clé privée…) est refusé avec la ligne fautive ; `***` est accepté.
- Nouvelle version (résumé obligatoire), duplication, suppression confirmée dans la page, labos « à revoir » après 60 jours, filtres et recherche, sauvegarde et restauration du journal (fichier JSON avec les captures).
- Tests : journal.test.mjs (99 vérifications, dont toutes les fiches du catalogue converties en labo, PDF vérifié par xref, qpdf et pdftotext) et browser-journal.test.mjs (42). browser-portes : la barre latérale compte six entrées.
- Rien n’est envoyé : stockage du navigateur et téléchargement local. L’affichage du PDF est vérifié avec qpdf, pdftotext et pdftoppm, pas dans chaque lecteur PDF.

## CISCO-TP-VLAN-03 (2026-11-05)

- Fiche « TP complet : VLAN, SSH et routage inter-VLAN » rendue REMPLISSABLE (même identifiant) : champs pour le VLAN de gestion (99 au départ), son adresse, sa passerelle, son préfixe, le poste et le port de gestion, le trunk, les noms du commutateur et du routeur, le domaine et le premier administrateur SSH.
- TABLEAU de VLAN extensible (de 1 à 6 lignes : numéro, nom, réseau, préfixe, passerelle, ports, poste de test) : on démarre avec UN VLAN, on ajoute une ligne par besoin et les blocs de création, de ports, de trunk, de sous-interfaces, de tests et d’annulation suivent. Contrôles : VLAN en double, VLAN égal à celui de gestion, réseaux qui se recouvrent ou recouvrent le réseau de gestion, ports déjà pris (gestion, trunk, autre VLAN), passerelle hors réseau.
- Neuf phases, 30 étapes : la phase 9 « Plus tard » ajoute un VLAN au trunk avec « allowed vlan add » et crée puis teste un deuxième administrateur SSH (champ dédié ; la ligne « username … secret » s’arrête avant le mot de passe).
- Annulations réécrites avec les champs (9 étapes, ordre inverse), cours à sept parcours A–G (G : « Plus tard »), résumé et deux schémas mis à jour (VLAN de gestion 99, premier VLAN, emplacement « à ajouter »).
- Moteur : le préfixe est « utilisé » par son masque pointé ; le contrôle du tableau accepte « exclureVlan » et « reseauGestion ».
- Tests : cisco-tp-vlan réécrit (111 vérifications avec 1 puis 3 lignes), annulations (colonnes du tableau reconnues), browser-cisco-reseau (compteur de cours Cisco).
- NON EXÉCUTÉ dans Packet Tracer ni sur du matériel réel : les commandes sont vérifiées pour leur ordre, leur cohérence et leur rendu seulement.

## CISCO-TP-VLAN-02 (2026-11-05)
- Retour du terrain : « crypto key generate rsa » répondait « Please define a domain-name first ». La fiche TP posait bien le domaine, mais sur la même étape que le nom d’hôte et sans le faire contrôler. Corrigé : étape 2 plus explicite (les DEUX lignes sont obligatoires, avec « enable » en tête), étape 7 qui relit d’abord « show running-config | include ^hostname|^ip domain » avant de générer la clé, message de correction pour chacune des deux erreurs IOS, et entrée de dépannage dédiée. « enable » ajouté aussi avant la configuration du routeur.
- Testé : test/cisco-tp-vlan.test.mjs (75) et suites cours, taches, trouver, coherence, annulations, cisco-reseau. NON EXÉCUTÉ dans Packet Tracer ni sur du matériel réel.

## CISCO-TP-VLAN-01 (2026-11-05)
- Vérification d’abord : les morceaux existaient séparément (créer un VLAN, affecter un port, DTP/trunk, scénario SSH, scénario inter-VLAN générique) mais aucun TP complet en une seule suite.
- Nouvelle fiche « TP complet : 3 VLAN, SSH et routage inter-VLAN (de A à Z) » : 24 étapes en 8 phases (console : état, nom, VLAN 10/20/30, adresse de gestion ; SSH ; première connexion depuis le poste de gestion ; par SSH : ports d’accès et trunk ; routeur sur un bâton ; autres postes ; tests dont SSH à travers le routeur ; enregistrement), 6 étapes « Annuler », dépannage et 2 schémas. Plan d’adressage fixe d’exemple (VLAN 10, 20, 30 ; Fa0/1 à Fa0/3 ; trunk Gi0/1 ; routeur Gi0/0 ; commutateur 192.168.30.2). Le mot de passe se tape sur l’équipement : jamais écrit.
- Nouveau cours « TP complet — 3 VLAN, SSH et routage inter-VLAN » (6 parcours A–F, résumé pliable, 2 schémas : topologie et chemin d’un paquet).
- Visibilité : première entrée de « Réseau et Cisco » dans le classement, premier groupe de la section Cisco de l’aide-mémoire, bandeau épinglé en tête de l’aide-mémoire (avant le bandeau show) et en tête de « Mes cours et TP » (sans filtre ou filtre Cisco).
- Correctif : les pastilles de groupes masqués de l’aide-mémoire passent à la ligne au lieu de déborder sur mobile.
- Testé : test/cisco-tp-vlan.test.mjs (71, dont l’ORDRE des commandes, l’encapsulation avant l’adresse de chaque sous-interface et le plan d’adressage) et toutes les suites Node et navigateur. NON EXÉCUTÉ dans Packet Tracer ni sur du matériel réel : la syntaxe varie selon le modèle (par exemple « switchport trunk encapsulation dot1q » avant « mode trunk » sur certains commutateurs, signalé dans la fiche).

## CISCO-SHOW-01 (2026-11-04)
- Nouvelle fiche de référence « Commandes show Cisco : toutes les lectures utiles, par groupe » : 15 groupes (identifier l’équipement, configuration, interfaces, MAC/ARP/voisins, VLAN/trunks/VTP/DTP, Spanning Tree, EtherChannel, sécurité des ports, routage IPv4 et IPv6, DHCP, NAT/PAT, accès à distance et ACL, santé et journaux, filtres), 76 commandes, chacune expliquée dans « Comprendre les commandes », plus une étape « Cibler une interface ou un VLAN » avec valeurs à saisir. Lecture seule.
- Visibilité : première entrée de « Réseau et Cisco » dans le classement, premier groupe de la section Cisco de l’aide-mémoire, bandeau épinglé en haut de l’aide-mémoire (et de la section Cisco), et rappel dans le « soutien » des 8 cours Cisco.
- Testé : test/cisco-show.test.mjs (264) et toutes les suites Node et navigateur. NON EXÉCUTÉ dans Packet Tracer ni sur un équipement réel : la disponibilité de chaque commande selon le modèle et la version d’IOS n’est pas démontrée.

## CISCO-NAT-01 (2026-11-04)
- Notes de cours du jour intégrées : nouveau cours « Architecture réseau II — NAT, PAT, types d’adresses et récapitulation » (Mes cours et TP > Cisco), parcours A (NAT, PAT, redirection de port, socket, NAT64), B (modes de diffusion dont la télévision IP d’un hôtel, types IPv6, SLAAC et DHCP), C (routes statiques, récapitulatives, flottantes) et D (rappel express VTP, VLAN, RIP, SSH, sécurité des ports).
- 7 fiches IOS : NAT statique, NAT dynamique, PAT (overload), redirection de port, lire et vider la table NAT, route statique récapitulative (avec variante Null0), résumé RIPv2. Annulations incluses. Nouveau groupe d’aide-mémoire « NAT, PAT et redirection de port » (6 groupes Cisco) et rubrique « NAT et PAT » du classement.
- Résumé pliable (7 points essentiels, 7 sections, 13 commandes, 8 pièges, 6 questions) et 9 schémas SVG originaux : vocabulaire NAT, trois types, table PAT, socket et ports, NAT64, types d’adresses IPv6 et usages réels, modes de diffusion, télévision IP d’un hôtel, récapitulation de routes.
- NAT64 expliqué sans fiche : sa syntaxe varie selon la plateforme et n’existe pas dans Packet Tracer (ambiguïté N-2). « route recap » lu comme récapitulation de routes (confirmé). WDS (Windows) non traité : lot à part.
- Testé : test/cisco-nat.test.mjs (472, dont masques génériques, récapitulation /22 et adresse NAT64 recalculés) et toutes les suites Node et navigateur. NON EXÉCUTÉ dans Packet Tracer ni sur un routeur réel.

## MEMO-SECTIONS-01 (2026-11-04)
- Aide-mémoire réorganisé par plateforme : quatre sections (Linux et serveurs, Windows, Cisco, Azure) avec leur nombre de fiches ; les cinq groupes Cisco sont réunis dans l’ordre du cours (accès et ports, VLAN/VTP/DTP, commutation, adressage et routage, DHCP et IPv6) au lieu d’être dispersés.
- Puces de plateforme directement sur la page (Toutes, Linux, Windows, Cisco, Azure), boutons « Tout déplier » / « Tout replier » ; sous un filtre de plateforme, les groupes s’ouvrent d’emblée.
- Testé : test/memo.test.mjs (598, dont sections et contre-épreuve), suites navigateur portes, plateformes, cours, choix.

## CISCO-S09-01 (2026-11-04)
- Cours de la semaine 9 intégré (Mes cours et TP > Cisco > « Architecture réseau II — Semaine 9 ») : parcours A à D = les 4 exercices du formatif 08 (DHCPv4 PT 7.2.10, adressage IPv6 PT 8.2.5.3, routes IPv6 statique et par défaut PT 6.2.4.4, DHCPv6 labo 8.5.1), parcours E = théorie.
- 13 fiches IOS rangées sous Réseau Cisco (DHCPv4 sur routeur ; IPv6 : adresses et routes ; SLAAC et DHCPv6), dans l’aide-mémoire (groupe « DHCP et IPv6 Cisco »), avec annulations. Types de paramètre ipv6 et cidr6.
- Résumé pliable (essentiel, 9 sections, 16 commandes, 8 pièges, 7 questions) et 9 schémas SVG originaux (DORA, relais, structure et types d’adresses IPv6, EUI-64, indicateurs A/O/M, qui fournit quoi, routes statiques, relais DHCPv6).
- Ambiguïtés S09-1 à S09-5 signalées (sources contradictoires : l’étape écrite l’emporte). Étapes graphiques de Packet Tracer marquées « non couvert » avec explication.
- Testé : test/cisco-s09.test.mjs (679), suites Node et navigateur existantes. NON EXÉCUTÉ dans Packet Tracer ni sur un routeur réel.

## KIOSQUE-01 (2026-11-02)
- Trois fiches « mode kiosque », chacune avec l’option graphique en premier, les commandes, la vérification, la sortie du kiosque et le retrait :
  - Windows : « Configurer un kiosque Windows (une seule application) » — Paramètres › Comptes › Autres utilisateurs › Configurer un kiosque (Edge plein écran) ou PowerShell (New-LocalUser, Set-AssignedAccess, Get-/Clear-AssignedAccess, retrait d’un kiosque posé par XML/MDM). Rangée dans Aide-mémoire › Poste Windows › Comptes locaux.
  - Ubuntu : « Configurer un kiosque Ubuntu (une page web en plein écran) » — compte dédié, connexion automatique GDM (custom.conf avec sauvegarde), Firefox --kiosk lancé par un fichier autostart, veille désactivée, sortie par Ctrl+Alt+F3, retrait complet.
  - Azure : « Déployer un kiosque Windows avec Intune (profil Azure) » — profil Kiosque du centre d’administration Intune (application unique, Edge, ouverture automatique) ; Azure CLI pour le groupe d’appareils Entra ID, l’appartenance et le contrôle de l’affectation.
- Honnêteté : sources Microsoft Learn et guide GNOME lues ; NON exécuté sur un vrai poste, Ubuntu ou locataire Intune. Libellés des écrans non vérifiés. Set-AssignedAccess ne gère qu’une application du Store (pour Edge : option graphique). La création du profil Intune se fait dans le portail (le corps Graph du kiosque à application unique n’a pas pu être confirmé). Appels Graph en version beta, consentement d’Azure CLI parfois refusé.
- Testé : test/kiosque.test.mjs (86) — syntaxe PowerShell (pwsh) et Bash (bash -n) de chaque ligne, et exécution réelle du sed de GDM (lignes commentées ou déjà actives) et du fichier .desktop produit.

## OUTILS-ADMIN-01 (2026-11-02)
- Nouvelle fiche « Installer Cockpit sur Ubuntu et s’y connecter » : option graphique (https://adresse:9090, certificat auto-signé, accès administrateur) et commandes (apt, systemctl enable --now cockpit.socket, ss, ufw facultatif, annulation). Rangée dans Accès distant › Cockpit et dans l’aide-mémoire.
- Nouvelle fiche « Installer OpenRSAT sur Ubuntu » (RSAT libre de Tranquil IT pour Samba AD) : .deb officiel v0.4.519 (numéro de version en paramètre), contrôle DNS et ports 389/636, variante binaire autonome, annulation. Rangée dans Domaine et annuaire.
- La fiche RSAT Windows reçoit son option graphique (Fonctionnalités facultatives Windows 10/11, Gestionnaire de serveur) et son annulation.
- Honnêteté : sources officielles lues (cockpit-project.org, dépôt OpenRSAT, documentation Samba-AD de Tranquil IT) ; NON exécuté sur un vrai Ubuntu/Windows ; libellés des écrans (App Center, OpenRSAT, Paramètres) non vérifiés ; OpenRSAT est encore en développement.
- Testé : test/outils-admin.test.mjs (42) + suites existantes.

## EXAMEN-WS-02 (2026-11-02)
- « Mes cours et TP » contient maintenant « Examen Serveur I — Windows Server 2022 (6 questions) » : six parcours (Q1 à Q6) dont chaque point renvoie à l’étape précise de la fiche, en option graphique ou en PowerShell. Les fiches restent aussi dans l’aide-mémoire.
- Nouveau module dist/cours-windows-examen.mjs ; coché = « je l’ai fait », rien n’est exécuté.

## EXAMEN-WS-01 (2026-11-02)
- Nouveau groupe « Examen Windows Server 2022 » en TÊTE de l’aide-mémoire (7 fiches) : le plan des 6 questions de l’examen pratique Serveur I, puis une fiche par question. Chaque fiche offre l’option graphique (console) en premier onglet, les commandes PowerShell en second, et des étapes « Annuler ».
- Q2 « Ajouter un disque à un serveur Windows » (Initialize-Disk, New-Partition, Format-Volume ; Gestion des disques) et « Mettre un quota sur un dossier (FSRM) » (New-FsrmQuota strict ou souple ; console FSRM).
- Q3 « Planifier une sauvegarde incrémentale » (New-WBPolicy, Set-WBSchedule 13 h et 16 h, disque dédié, Start-WBBackup, wbadmin ; assistant de planification et restauration).
- Q4 « Créer un miroir RAID 1 sous Windows et le restaurer » (Gestion des disques, diskpart ; panne simulée et reconstruction).
- Q5 « Exclure une plage d’adresses d’une étendue DHCP » (Add-DhcpServerv4ExclusionRange ; console DHCP). Rangée dans le groupe de l’examen et dans le catalogue, sous DHCP.
- Q6 « Script PowerShell : créer un utilisateur, son dossier et son partage » (Read-Host, nom.prenom, New-SmbShare en lecture) avec un modèle param() + Import-Csv.
- « Examen Windows Server 2022 : les 6 questions et leurs fiches » : un lien vers chaque fiche, y compris les fiches déjà existantes (utilisateurs, groupes, IP fixe, installer DHCP, étendue).
- Honnêteté : commandes d’après la documentation Microsoft ; NON exécutées sur un vrai serveur. Non confirmés dans la documentation lue : la syntaxe diskpart (add disk=, break disk=… nokeep), le mode incrémentiel en PowerShell (la page Microsoft est incohérente avec elle-même) et les libellés exacts des assistants graphiques ; ces points sont signalés dans les fiches.
- Testé : test/windows-examen.test.mjs (106) ; chaque ligne PowerShell est analysée par PowerShell 7 et le bloc qui écrit le script du Q6 est exécuté pour de vrai. Tests existants adaptés (8 groupes Windows ; une ligne PowerShell peut commencer par « $ »).

## PARCOURIR-01 (2026-11-01)
- Nouvelle fiche « Parcourir un partage Samba depuis Ubuntu (smbclient, montage) » (aide-mémoire › Samba › Postes clients) : pourquoi « cd » et « ls -l » ne voient pas un partage, session interactive (invite smb:), une commande avec -c, montage cifs et démontage, option graphique Fichiers › Autres emplacements.
- Dépannage « le compte en lecture seule peut écrire » : afficher la section du partage (read list, write list) et comparer l’orthographe avec samba-tool user list.
- Testé : test/samba-partage-parcourir.test.mjs (11), dont l’extraction de la section du partage exécutée pour de vrai ; smbclient, mount.cifs et testparm NON exécutés.

## SUDO-SU-01 (2026-11-01)
- Nouvelle fiche « sudo, sudo -u, su et su - : lequel utiliser ? » (aide-mémoire › Linux › Comptes locaux) : qui suis-je (whoami), sudo (ton mot de passe), sudo -u, su - (mot de passe du compte), erreur « su -compte », annulation avec exit, remarque sur les comptes Samba.
- Testé : test/linux-simples.test.mjs (238).

## COMPTE-SAMBA-01 (2026-11-01)
- Nouvelle fiche « Créer un utilisateur Samba AD » (aide-mémoire › Samba › Comptes et groupes) : vérifier que le nom est libre, `samba-tool user create` (mot de passe à l’invite), vérification, et annulations (désactiver, supprimer).
- Option graphique en premier onglet : console dsa.msc (RSAT) — libellés non vérifiés sur un vrai poste.
- Testé : test/linux-simples.test.mjs (rendu de la commande, aucun mot de passe dans la commande, option graphique en premier).

## RECONSTRUIRE-01 (2026-11-01)
- Parcours « Reconstruire le domaine Samba AD : l’ordre des fiches » : sortir les clients, nouvelle VM, installer le contrôleur, DNS des clients, joindre, vérifier ; chaque étape dit sur quel poste et renvoie à sa fiche.
- Trois nouvelles fiches : « Régler le DNS d’un poste Windows », « Sortir Ubuntu d’un domaine dont le serveur n’existe plus » (realm leave sans --remove), « Sortir Windows d’un domaine dont le serveur n’existe plus ».
- Option graphique ajoutée en premier onglet de chaque fiche (ncpa.cpl, Cockpit, sysdm.cpl) et à « Joindre un poste Windows au domaine » ; mentionnée dans le résumé.
- Honnêteté : libellés de fenêtres, bouton Cockpit « quitter le domaine », Remove-Computer / WMI hors ligne NON vérifiés sur de vrais postes. Pour sortir un domaine, la voie classique est sysdm.cpl (pas Accès professionnel).
- Testé : test/domaine-reconstruire.test.mjs (50), dont le retrait de la ligne /etc/hosts exécuté pour de vrai.

## DC-INSTALL-01 (2026-11-01)
- Nouvelle fiche « Installer un contrôleur de domaine Samba AD sur Ubuntu » (aide-mémoire › Samba › Domaine, DNS et outils), d’après la documentation Ubuntu Server : nom complet et /etc/hosts (jamais 127.0.1.1), paquets samba-ad-dc/krb5-user/bind9-dnsutils, services smbd/nmbd/winbind masqués, provisionnement, nouveau mot de passe tapé au terminal, DNS en amont (jamais 127.0.0.53), systemd-resolved arrêté avant le démarrage, krb5.conf, vérifications (port 53, SRV, kinit), pare-feu.
- Étapes facultatives : adresse IP fixe (netplan try) et service de l’heure aux clients (chrony) — sans lui, un client réglé sur NTP=adresse du serveur n’obtient aucune réponse.
- Partie « Annuler ou défaire » complète : supprimer le domaine, remettre smb.conf, resolv.conf/systemd-resolved, /etc/hosts, services, et désinstaller les paquets.
- La fiche de jonction (commandes et graphique) renvoie vers elle comme prérequis.
- Testé : test/samba-ad-installer.test.mjs (16), dont le remplacement du « dns forwarder » et le retrait de la ligne 127.0.1.1 exécutés pour de vrai sur des fichiers temporaires ; test/browser-choix.test.mjs. samba-tool, systemctl, apt, chrony et netplan NON exécutés sur un vrai Ubuntu.

## JONCTION-GUI-01 (2026-11-01)
- Nouvelle fiche « Joindre Ubuntu à un domaine Samba AD par l’interface graphique » (aide-mémoire › Samba › Domaine, DNS et outils), alternative à la jonction par commandes : onglet graphique (Cockpit sur https://localhost:9090 › Vue d’ensemble › Joindre le domaine, puis ouverture de session compte@domaine ; variante Paramètres › Utilisateurs › Connexion d’entreprise) et onglet Terminal (contrôle du DNS du serveur, DNS du client par nmcli, domaine trouvé, installation, jonction, vérification, annulations).
- Le contrôle du port 53 du serveur vient en premier : un « Connection refused » côté client veut dire que rien n’écoute le DNS.
- Correction de la fiche par commandes : le nom complet du poste est maintenant écrit dans /etc/hosts (sinon sudo répond « impossible de résoudre l’hôte »), et retiré à l’annulation.
- Honnêteté : l’option Paramètres › Connexion d’entreprise vient du guide GNOME et n’est PAS vérifiée sur Ubuntu 24.04 ; le libellé exact du bouton « Quitter le domaine » de Cockpit n’est pas confirmé. Rien n’a été exécuté sur un vrai Ubuntu.
- Testé : test/jonction-graphique.test.mjs (11), test/browser-choix.test.mjs (24), batterie complète.

## ANNULER-01 (2026-10-31)
- 91 méthodes de fiches qui modifient un poste reçoivent des étapes « Annuler » COPIABLES (116 étapes) au lieu d’une simple phrase : DNS et DHCP Windows, pare-feu, partages, GPO, comptes AD et locaux, quotas, RAID 1, partition, Samba, VLAN, STP, routes, RIP, EtherChannel, adresse IP fixe, nom d’hôte, clavier et langue, ufw, montages, NFS (table centrale dist/annulations.mjs).
- Chaque étape est FACULTATIVE (jamais dans la copie de toute la fiche), signalée par la puce « Annulation » et rangée dans sa propre carte « Annuler ou défaire », après la vérification. Sur une fiche à deux postes, chaque annulation dit « Sur : Serveur » ou « Sur : Client Ubuntu ».
- Les valeurs d’origine à relire (ancien groupe, ancien nom…) sont des repères en majuscules (ANCIEN_GROUPE…) que l’explication nomme ; les autres commandes n’emploient que les paramètres déjà saisis. Le PATH Windows est reconstruit sans le dossier ajouté, sans valeur à recopier.
- Azure : aucune commande de suppression (règle du dépôt) ; seules les annulations sans « delete » sont ajoutées, les suppressions restent à taper à la main.
- Contrat : une étape d’annulation doit être facultative et modifier quelque chose. Méthodes clonées, jamais de tableau partagé modifié.
- Tests ajustés : la « dernière étape de la procédure est la vérification » ignore désormais les étapes « Annuler » ; browser-taches (8 blocs sur Créer un VLAN).
- Testé : test/annulations.test.mjs (1375), dont l’annulation sed exécutée pour de vrai (test/linux-simples). Les autres commandes d’annulation NON exécutées sur de vrais postes.

## TROUVER-01 (2026-10-31)
- Petit texte « À lire sur : poste + commande » sous les cases, généralisé : de 11 à environ 210 cases sur 501, via une table centrale (dist/trouver.mjs) par fiche, famille de fiches (Samba : le serveur) et plateforme (Linux, Windows, Cisco, Azure).
- Seules les valeurs qu’on LIT sont notées ; une valeur inventée (nouveau nom, groupe à créer, VNet à créer) n’a pas de note. Les scénarios n’en reçoivent pas.
- Les définitions de paramètres partagées entre fiches ne sont jamais modifiées (copie), pour qu’une note ne déteigne pas d’une fiche à l’autre.
- Classement Azure : test de la famille « Peering, routage » mis en accord avec la règle « une fiche suit son assistant hôte » (point de service du stockage).
- Testé : test/trouver.test.mjs (51), test/browser-choix.test.mjs (20). Commandes de lecture NON exécutées sur de vrais postes.

## JONCTION-01 (2026-10-31)
- Fiche « Joindre un poste Ubuntu à un domaine Samba AD » réécrite (même identifiant) : 30 étapes sur deux postes, chacune étiquetée « Sur : Serveur » ou « Sur : Client Ubuntu » avec copie séparée par poste. Préparation du serveur (service, heure, pare-feu, DNS A et PTR), préparation du client, jonction, confirmation sur le serveur, tests.
- Partie finale « Annuler ou purger » en étapes copiables : realm leave --remove, mkhomedir, cache SSSD, netplan et heure, nom d’hôte, désinstallation des paquets, puis sur le serveur compte machine et enregistrements DNS.
- Paramètres : petit texte sous chaque case (« À lire sur : Client Ubuntu  ip -br link »), champ `trouver` validé par le contrat.
- Testé : test/jonction-ad.test.mjs (118) et test/browser-choix.test.mjs. Commandes samba-tool, realm et SSSD NON exécutées sur un vrai serveur ni client.

## SYSTEME-01 (2026-10-31)
- 4 fiches : changer le nom de la machine Linux (hostnamectl et /etc/hosts), savoir sur quelle machine on est (nom, version, IP), installer le client SSH sous Ubuntu et sous Windows.
- Testé : mise à jour de /etc/hosts exécutée pour de vrai sur un fichier temporaire ; hostnamectl, apt et Add-WindowsCapability NON exécutés.

## CHOIX-LISTE-01 (2026-10-31)
- Les paramètres « choix » (disposition de clavier, langue, région Azure, masque, rôle…) s’affichent en liste déroulante au lieu d’un champ à taper. Un paramètre peut porter des libellés lisibles (QWERTY, AZERTY, QWERTZ) : la valeur technique reste celle qui est validée et copiée.
- Clavier : ajout de l’allemand et de l’espagnol, retrait du britannique (nom différent à la console). Testé : test/browser-choix.test.mjs.

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
