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
