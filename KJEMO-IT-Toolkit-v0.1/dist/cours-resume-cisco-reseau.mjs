/**
 * cours-resume-cisco-reseau.mjs — KJEMO-CISCO-COURS-RESEAU-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * RÉSUMÉS PLIABLES des cours « Architecture réseau II » des semaines 1 à 5 et
 * du TP2, pour se rafraîchir la mémoire plus tard : l'essentiel, les schémas,
 * les commandes à retenir, les pièges et des questions à réponse cachée.
 *
 * Écrits dans nos mots à partir des cours, de la note de cours, du formatif 3.1
 * et de l'énoncé du TP2 ; les diapositives ne sont pas republiées (voir
 * schemas-cisco-reseau.mjs pour les schémas originaux). Les exemples de
 * configuration sont à lire, pas à exécuter : les fiches du catalogue donnent
 * les mêmes commandes avec des paramètres validés.
 */

// ---------------------------------------------------------------------------
// Semaine 1 : révision et VLSM
// ---------------------------------------------------------------------------
export const RESUME_S01 = {
  titre: 'Résumé du cours — Semaine 1 : révision et VLSM',
  intro: 'À relire avant un examen : les rappels d’Architecture réseau I (ARP, DHCP, DNS, commutateur, routeur) et le découpage en sous-réseaux de tailles variables.',
  essentiel: [
    'L’adresse MAC (48 bits) identifie une carte réseau dans un réseau local et sert au commutateur ; l’adresse IP identifie une machine d’un réseau à l’autre et sert au routeur.',
    'Pour trouver l’adresse du réseau, on fait un ET binaire entre l’adresse IP et le masque : les bits à 1 du masque gardent la partie réseau, le reste devient zéro.',
    'VLSM (masque de longueur variable) donne à chaque réseau un masque adapté à son besoin réel, au lieu de découper un bloc en parts égales : on perd moins d’adresses.',
    'En VLSM, on range les besoins du plus grand au plus petit, puis chaque bloc commence où le précédent se termine, sur une frontière de sa taille.',
    'Dans un réseau, la première adresse est celle du réseau et la dernière celle de diffusion : hôtes utilisables = adresses − 2.',
    'Un commutateur apprend les adresses MAC (table CAM), inonde quand il ne connaît pas la destination, puis réachemine seulement vers le bon port ; un routeur choisit une interface selon l’adresse IP de destination.',
  ],
  sections: [
    {
      id: 'revision-l2', titre: 'Rappels : ARP, DHCP, DNS',
      points: [
        'ARP traduit une adresse IP en adresse MAC dans le réseau local. La table du poste se lit avec « arp -a ».',
        'DHCP donne adresse, masque, passerelle et DNS en quatre échanges (DORA : Discover, Offer, Request, Acknowledge). La note de cours demande de bien connaître la théorie DHCP.',
        'Pour déboguer un nom qui ne se résout pas, on regarde dans l’ordre : le fichier des noms locaux (hosts), le cache DNS du poste (ipconfig /flushdns pour le vider), puis le résolveur DNS.',
        'Un nom se résout en descendant la hiérarchie : racine, domaine de premier niveau (TLD), serveur de noms (NS), zone. Enregistrements à connaître : A, CNAME, TXT, NS, PTR, MX.',
      ],
    },
    {
      id: 'commutateur-routeur', titre: 'Commutateur et routeur',
      points: [
        'Le commutateur fonctionne en trois temps : apprentissage (il note l’adresse MAC source et le port), inondation (destination inconnue : toutes les sorties) et réacheminement sélectif (destination connue : un seul port).',
        'Un technicien doit maîtriser les numéros de ports : Fa0/1, Gi0/1… La table d’adresses se lit avec « show mac address-table ».',
        'Le routeur interconnecte des réseaux : chacune de ses interfaces appartient à un réseau IP différent, et il décide de l’interface de sortie d’après sa table de routage.',
        'Une table de routage contient les réseaux connectés et des routes statiques ou apprises ; un routeur ne sait joindre que ce qu’il connaît.',
      ],
    },
    {
      id: 'masques', titre: 'Masques et nombre d’hôtes', schemas: ['vlsm-masques'],
      points: [
        'Les tableaux « VLSM Chart » (classes A, B, C) donnent pour chaque préfixe le masque et le nombre d’adresses : dans le dernier octet, /24 = 256, /25 = 128, /26 = 64, /27 = 32, /28 = 16, /29 = 8, /30 = 4.',
        'Le pas entre deux réseaux d’un même masque est la taille du bloc : un /27 donne des réseaux en .0, .32, .64, .96…',
        'Exemple : 192.168.68.210 avec 255.255.255.128 donne le réseau 192.168.68.128 (le dernier octet 210 devient 128 : 210 en binaire commence par 1, le bit gardé par le masque).',
        'Liens routeur à routeur : un /30 (deux hôtes) suffit ; un /29 donne six hôtes si on prévoit de l’espace.',
      ],
    },
    {
      id: 'vlsm', titre: 'Découper avec VLSM', schemas: ['vlsm-decoupage'],
      points: [
        'Démarche : lister les besoins (hôtes, plus les routeurs), choisir pour chacun le plus petit masque qui convient, trier du plus grand au plus petit, puis placer les blocs l’un après l’autre.',
        'Un bloc doit commencer à une adresse multiple de sa taille : un /26 (64 adresses) commence en .0, .64, .128 ou .192.',
        'Le découpage traditionnel (parts égales) gaspille des adresses : un lien de deux routeurs n’a pas besoin d’un /24.',
        'Un VLSM n’est qu’un plan : pour le vérifier, on contrôle que les blocs ne se chevauchent pas et que chacun contient assez d’hôtes.',
      ],
    },
  ],
  commandes: [
    { cmd: 'arp -a', sert: 'Afficher la table ARP du poste : adresses IP et MAC connues.' },
    { cmd: 'ipconfig /all', sert: 'Voir l’adresse MAC, l’adresse IP, le masque, la passerelle et les DNS d’un poste Windows.' },
    { cmd: 'ipconfig /flushdns', sert: 'Vider le cache DNS du poste Windows.' },
    { cmd: 'show mac address-table', sert: 'Lire la table d’adresses MAC d’un commutateur (CAM).' },
    { cmd: 'show ip route', sert: 'Lire la table de routage d’un routeur.' },
  ],
  pieges: [
    'Compter la première et la dernière adresse d’un réseau comme des hôtes utilisables.',
    'Placer un bloc VLSM sur une adresse qui n’est pas multiple de sa taille.',
    'Découper du plus petit au plus grand : les gros blocs ne trouvent plus de place alignée.',
    'Confondre adresse MAC (locale, couche 2) et adresse IP (logique, couche 3).',
  ],
  questions: [
    { q: 'Comment trouve-t-on l’adresse réseau à partir d’une adresse IP et d’un masque ?', r: 'Par un ET binaire : chaque bit de l’adresse est conservé là où le masque vaut 1, et mis à zéro ailleurs. Avec 255.255.255.128, le dernier octet devient 0 ou 128.' },
    { q: 'Combien d’hôtes utilisables dans un /27 ? Et dans un /30 ?', r: 'Un /27 a 32 adresses, donc 30 hôtes. Un /30 a 4 adresses, donc 2 hôtes : juste assez pour un lien entre deux routeurs.' },
    { q: 'Pourquoi trier les besoins du plus grand au plus petit en VLSM ?', r: 'Les gros blocs ont besoin d’une adresse de départ alignée sur leur taille ; en les plaçant d’abord, les petits blocs remplissent ce qui reste sans trou ni chevauchement.' },
    { q: 'Dans quel ordre vérifier un nom qui ne se résout pas ?', r: 'Le fichier hosts du poste, puis le cache DNS (à vider avec ipconfig /flushdns), puis le résolveur DNS configuré.' },
    { q: 'Que fait un commutateur d’une trame dont il ne connaît pas la destination ?', r: 'Il l’inonde : il la renvoie sur tous les ports sauf celui d’arrivée. Quand la réponse revient, il apprend l’adresse et réachemine ensuite vers un seul port.' },
  ],
};

// ---------------------------------------------------------------------------
// Semaine 2 : commutateur, SSH, sécurité des ports
// ---------------------------------------------------------------------------
export const RESUME_S02 = {
  titre: 'Résumé du cours — Semaine 2 : commutateur, SSH et sécurité des ports',
  intro: 'À relire avant le TP ou l’examen : démarrage et récupération, voyants, adresse de gestion, duplex, SSH, ports inutilisés et port-security.',
  essentiel: [
    'Au démarrage, le commutateur fait un test matériel (POST), lance le chargeur d’amorçage, puis charge IOS depuis la mémoire flash et lit la configuration enregistrée dans la NVRAM.',
    'Si IOS ne se charge pas, le chargeur d’amorçage donne un accès de secours par le câble console, en coupant puis rétablissant l’alimentation.',
    'Pour administrer à distance un commutateur, il faut une adresse sur l’interface virtuelle (SVI) et une passerelle par défaut ; SSH doit remplacer Telnet.',
    'Vitesse et duplex peuvent se négocier ou se fixer ; les deux bouts doivent concorder, sinon c’est un duplex mismatch. auto-MDIX s’adapte au type de câble.',
    'Un port inutilisé est une porte ouverte : on l’éteint. Les ports utilisés se protègent avec la sécurité des ports (adresses MAC autorisées, sanction en cas de violation).',
    'La clé RSA qui active SSH se génère à partir du nom d’hôte ET du nom de domaine : sans eux, la commande est refusée.',
  ],
  sections: [
    {
      id: 'demarrage', titre: 'Démarrage et voyants',
      points: [
        'Séquence : POST (test du processeur, de la mémoire et de la flash), chargeur d’amorçage, chargement d’IOS depuis la flash, lecture de la configuration initiale en NVRAM.',
        'Récupération : câble console branché, on débranche l’alimentation puis on la rebranche en maintenant le bouton Mode selon le modèle, pour entrer dans le chargeur.',
        'Voyant système : éteint = hors tension, vert = normal, orange = défaut. Voyant d’un port : vert = lien établi, vert clignotant = trafic, orange = bloqué (Spanning Tree), éteint = pas de lien ou port arrêté.',
        'Les autres voyants indiquent le duplex, la vitesse (éteint 10, vert 100, vert clignotant 1000 Mbit/s) et le mode PoE.',
      ],
    },
    {
      id: 'gestion', titre: 'Adresse de gestion et ports', schemas: ['sw-etats-port'],
      points: [
        'L’adresse de gestion se pose sur une interface VLAN (SVI) avec « ip address », puis « no shutdown » ; sur un commutateur de niveau 2, la passerelle se donne avec « ip default-gateway ».',
        'Duplex : full = envoi et réception en même temps ; half = un sens à la fois. La négociation convient aux équipements inconnus ; vers un serveur connu, on peut fixer les deux bouts.',
        'Pour lire un port : « show interfaces status » donne le tableau, « show interfaces F0/6 » le détail et les compteurs d’erreurs. up/up est le seul état sain.',
        'Un lien « up » avec des erreurs CRC et des collisions tardives évoque un duplex mismatch ou un mauvais câble.',
      ],
    },
    {
      id: 'ssh', titre: 'SSH : accès distant sécurisé', schemas: ['sw-ssh-ordre'],
      points: [
        'SSH chiffre l’authentification et la session ; Telnet envoie tout en clair. Après activation de SSH, on interdit Telnet avec « transport input ssh ».',
        'Ordre : nom d’hôte, domaine (ip domain-name), clé RSA (crypto key generate rsa), compte local, lignes vty (login local, transport input ssh), puis ip ssh version 2.',
        '« show ip ssh » vérifie la prise en charge et l’état ; depuis un poste, « ssh -l nom adresse » teste l’accès. Le formatif 3.1 demande d’enlever le câble console pour tester l’accès SSH.',
        'Les mots de passe se tapent sur la console : les fiches ne les contiennent jamais.',
      ],
    },
    {
      id: 'portsec', titre: 'Sécurité des ports', schemas: ['sw-portsec-modes'],
      points: [
        'Ports inutilisés : « interface range » puis « shutdown » ; on peut aussi les parquer dans un VLAN sans usage.',
        'Port-security : le port doit être en accès. On fixe un maximum d’adresses, et les adresses sont statiques, dynamiques ou sticky (apprises puis gardées dans la configuration).',
        'Violations : protect (ignore sans rien dire), restrict (ignore, journalise et compte), shutdown (coupe le port : err-disabled). shutdown est le mode par défaut.',
        'Pour rallumer un port tombé en err-disabled : retirer l’appareil fautif, puis « shutdown » et « no shutdown ».',
      ],
    },
    {
      id: 'config-portable', titre: 'Sauvegarder et transférer une configuration',
      points: [
        'On peut copier « show running-config » dans un fichier texte, puis le coller sur un autre routeur en mode de configuration globale (physique ou Packet Tracer).',
        'Seuls les noms d’interface changent d’un modèle à l’autre (par exemple GigabitEthernet0/0/1 devient 0/1/0 avec le module d’extension).',
        'Les lignes de cryptographie (clés RSA, pubkey-chain…) ne se transfèrent jamais et provoquent des erreurs dans Packet Tracer : on les ignore ou on les retire, puis on régénère les clés.',
        'On termine par « copy running-config startup-config » pour enregistrer.',
      ],
    },
  ],
  commandes: [
    { cmd: 'interface vlan 1 / ip address A M / no shutdown', sert: 'Donner l’adresse de gestion au commutateur.' },
    { cmd: 'ip default-gateway A', sert: 'Fixer la passerelle d’un commutateur de niveau 2.' },
    { cmd: 'speed / duplex / mdix auto', sert: 'Fixer la vitesse et le duplex, ou laisser l’auto-MDIX choisir le câble.' },
    { cmd: 'show interfaces status', sert: 'Voir l’état, le VLAN, le duplex et la vitesse de tous les ports.' },
    { cmd: 'crypto key generate rsa', sert: 'Générer la clé qui active SSH (nom d’hôte et domaine requis).' },
    { cmd: 'switchport port-security maximum N', sert: 'Limiter le nombre d’adresses MAC admises sur un port.' },
    { cmd: 'switchport port-security violation shutdown|restrict|protect', sert: 'Choisir la sanction.' },
    { cmd: 'show port-security interface F0/6', sert: 'Lire l’état de la sécurité d’un port.' },
  ],
  pieges: [
    'Fixer la vitesse ou le duplex d’un seul côté du lien.',
    'Appliquer la sécurité des ports à un port encore en mode dynamique.',
    'Éteindre une plage de ports en y incluant un port actif.',
    'Générer la clé RSA avant d’avoir mis le nom d’hôte et le domaine.',
    'Coller dans Packet Tracer les lignes de cryptographie d’un routeur physique.',
  ],
  questions: [
    { q: 'Quelle adresse faut-il pour administrer un commutateur à distance ?', r: 'Une adresse IP sur l’interface virtuelle (SVI) et, pour joindre un autre réseau, une passerelle par défaut avec ip default-gateway.' },
    { q: 'Quel est l’ordre de configuration de SSH ?', r: 'Nom d’hôte, nom de domaine, génération de la clé RSA, compte local, lignes vty avec login local et transport input ssh, puis ip ssh version 2.' },
    { q: 'Qu’est-ce qu’un duplex mismatch et comment le reconnaît-on ?', r: 'Un bout est fixé en full, l’autre négocie et retombe en half. Le lien est up mais lent, avec erreurs CRC et collisions tardives.' },
    { q: 'Quelle différence entre protect, restrict et shutdown ?', r: 'Tous ignorent les trames illégales ; restrict journalise et compte les violations ; shutdown fait de même et coupe le port (err-disabled).' },
    { q: 'Que change sticky par rapport à une adresse dynamique ?', r: 'L’adresse apprise est ajoutée à la configuration courante et survit à un redémarrage une fois la configuration enregistrée.' },
    { q: 'Pourquoi éteindre les ports inutilisés ?', r: 'Un port libre permet de brancher un appareil non autorisé ; l’éteindre (et le parquer dans un VLAN sans usage) retire cette porte d’entrée.' },
  ],
};

// ---------------------------------------------------------------------------
// Semaines 2 et 3 : routage statique et dynamique
// ---------------------------------------------------------------------------
export const RESUME_ROUTAGE = {
  titre: 'Résumé du cours — Semaines 2 et 3 : routage statique et RIP',
  intro: 'À relire avant le TP2 ou l’examen de mi-session : routes statiques, route par défaut, route flottante, puis RIP et les notions de routage dynamique.',
  essentiel: [
    'Un routeur ne sait joindre que les réseaux de sa table de routage : les réseaux directement connectés, puis ceux qu’on lui apprend à la main (routes statiques) ou par un protocole (routage dynamique).',
    'Une route statique s’écrit « ip route réseau masque voisin » ; il faut aussi la route retour sur l’autre routeur, sinon le ping n’aboutit pas.',
    'Le nombre de routes statiques d’un routeur = réseaux du schéma − réseaux directement connectés (à moins d’une route par défaut ou d’un résumé).',
    'Une route par défaut (0.0.0.0/0) sert « à défaut » ; une route flottante, avec une distance administrative plus grande, ne sert qu’en secours.',
    'Le routage dynamique évite d’écrire les routes à la main sur un réseau de plus de quelques routeurs, et s’adapte aux pannes ; RIP en est le plus simple.',
    'En cas d’égalité de métrique, le routeur répartit la charge entre les chemins (équilibrage à coût égal).',
  ],
  sections: [
    {
      id: 'statique', titre: 'Routes statiques', schemas: ['rt-statique', 'rt-table'],
      points: [
        'On les utilise pour une route par défaut vers un fournisseur, pour les réseaux hors du domaine de routage, ou quand l’administrateur veut imposer le chemin exact.',
        'Deux écritures : par adresse du voisin (« via 10.0.12.2 ») ou par interface de sortie, plus sûre sur un lien point à point.',
        'IOS n’installe la route que si le voisin est joignable ; elle apparaît avec le code S. Une route par défaut apparaît avec S*.',
        'Priorité : le masque le plus long gagne (route la plus précise), puis la distance administrative la plus faible (0 connecté, 1 statique, 120 RIP).',
      ],
    },
    {
      id: 'flottante', titre: 'Route par défaut et route flottante', schemas: ['rt-flottante'],
      points: [
        'ip route 0.0.0.0 0.0.0.0 voisin : tous les paquets sans route plus précise partent vers ce voisin.',
        'Route flottante : on ajoute la même route par un autre voisin, avec une distance plus grande (par exemple 5). Elle reste cachée jusqu’à la panne de la route principale.',
        'Le TP2 le demande en partie 2 : on retire le lien R1–R3 et les réseaux A-163 et B-235 doivent se joindre via R2.',
      ],
    },
    {
      id: 'dynamique', titre: 'Routage dynamique : les notions',
      points: [
        'Un protocole de routage échange des messages, tient des structures de données et applique un algorithme pour choisir le meilleur chemin selon une métrique (nombre de sauts, bande passante…).',
        'Vecteur de distance (RIP) : mises à jour périodiques, métrique cumulative. État de liens (OSPF, IS-IS) : chaque routeur connaît la carte complète (algorithme de Dijkstra), convergence rapide. EIGRP est hybride.',
        'IGP : dans une organisation (RIP, OSPF, EIGRP). EGP : entre organisations ; il n’y en a qu’un, BGP.',
        'Sans classe (classless) : le masque circule dans les annonces ; avec classe (classful) : seuls les réseaux A, B, C.',
      ],
    },
    {
      id: 'rip', titre: 'RIP : le protocole le plus simple', schemas: ['rip-principe', 'rip-resume-auto'],
      points: [
        'RIP annonce ses routes toutes les 30 secondes ; la métrique est le nombre de sauts, 15 au plus (16 = inaccessible) ; sa distance administrative est 120.',
        'RIPv2 ajoute le masque (réseaux sans classe) ; on le démarre avec « router rip » puis « version 2 », puis on annonce les réseaux avec « network » (réseaux de classe : IOS convertit un sous-réseau).',
        '« no auto-summary » empêche le regroupement en réseau de classe aux frontières, qui casserait des réseaux discontinus.',
        '« passive-interface » écoute sans envoyer sur l’interface vers les postes. « default-information originate » propage une route par défaut statique aux autres routeurs.',
        'Vérifier : « show ip protocols » (version, réseaux annoncés, voisins) et « show ip route rip » (routes R).',
      ],
    },
  ],
  commandes: [
    { cmd: 'interface Gi0/0 / ip address A M / no shutdown', sert: 'Configurer et allumer une interface de routeur (éteinte par défaut).' },
    { cmd: 'clock rate 64000', sert: 'Donner la cadence sur le bout DCE d’un lien série (un seul côté).' },
    { cmd: 'ip route R M voisin', sert: 'Route statique vers un réseau distant.' },
    { cmd: 'ip route 0.0.0.0 0.0.0.0 voisin', sert: 'Route par défaut.' },
    { cmd: 'ip route R M voisin 5', sert: 'Route statique flottante (distance 5).' },
    { cmd: 'router rip / version 2 / no auto-summary / network R', sert: 'Activer RIPv2 et annoncer un réseau.' },
    { cmd: 'show ip route / show ip protocols', sert: 'Lire la table de routage et le détail du protocole.' },
    { cmd: 'ping A / traceroute A', sert: 'Tester la connectivité et repérer où le chemin casse.' },
  ],
  pieges: [
    'Oublier la route retour : le ping part mais rien ne revient.',
    'Oublier « no shutdown » sur une interface de routeur.',
    'Mettre une adresse de réseau (ou de diffusion) sur une interface.',
    'Écrire « network » avec un sous-réseau et croire que RIP annonce exactement ce sous-réseau.',
    'Laisser une route statique de distance 1 qui masque RIP sans le vouloir.',
    'Mettre clock rate sur les deux bouts d’un lien série.',
  ],
  questions: [
    { q: 'Combien de routes statiques faut-il sur un routeur ?', r: 'Autant que de réseaux du schéma qui ne lui sont pas directement connectés, sauf si une route par défaut ou un résumé en couvre plusieurs.' },
    { q: 'Pourquoi un ping échoue-t-il alors que la route aller est correcte ?', r: 'Parce que le chemin retour n’existe pas : l’autre routeur ne sait pas renvoyer la réponse vers le réseau d’origine.' },
    { q: 'À quoi sert la distance administrative d’une route flottante ?', r: 'À la rendre moins prioritaire que la route principale : IOS garde la plus faible distance, et ne sort la route de secours que si la principale disparaît.' },
    { q: 'Quelle différence entre RIPv1 et RIPv2 ?', r: 'RIPv2 envoie le masque (sans classe) et peut se passer de résumé automatique ; RIPv1 est par classe et ne le fait pas.' },
    { q: 'Que veut dire un « 16 » dans RIP ?', r: 'Le réseau est inaccessible : RIP compte 15 sauts au plus.' },
    { q: 'Quand préférer le routage statique au routage dynamique ?', r: 'Pour un petit réseau, une route par défaut vers un fournisseur ou quand on veut imposer le chemin ; au-delà de quelques routeurs, le dynamique évite la maintenance et s’adapte aux pannes.' },
  ],
};

// ---------------------------------------------------------------------------
// Semaine 5 : VLAN, VTP, DTP
// ---------------------------------------------------------------------------
export const RESUME_S05 = {
  titre: 'Résumé du cours — Semaine 5 : évolutivité des VLAN (VTP et DTP)',
  intro: 'À relire avant l’examen : comment VTP distribue les VLAN, le piège du numéro de révision, les VLAN étendus et la négociation des trunks avec DTP.',
  essentiel: [
    'Quand le nombre de commutateurs grandit, créer les VLAN et les trunks à la main devient pénible : VTP permet de gérer les VLAN sur un serveur et de les distribuer aux autres commutateurs.',
    'VTP a trois modes utiles : serveur (crée, modifie, supprime et annonce), client (reçoit et relaie, ne crée rien) et transparent (garde ses VLAN et relaie sans les adopter).',
    'Le numéro de révision de configuration fait foi : le plus élevé gagne. Un commutateur ajouté avec une révision plus élevée écrase les VLAN de tout le domaine.',
    'Domaine VTP et mot de passe doivent être identiques partout (le nom est sensible à la casse), et VTP ne circule que par un trunk.',
    'Un 2960 ne crée des VLAN étendus (1006 à 4094) qu’en mode VTP transparent.',
    'DTP négocie les trunks entre deux commutateurs voisins ; deux bouts « dynamic auto » ne forment pas de trunk.',
  ],
  sections: [
    {
      id: 'vtp', titre: 'VTP : modes et annonces', schemas: ['vtp-modes'],
      points: [
        'Trois types d’annonces : résumé (nom de domaine et numéro de révision), requête (demande de détails quand la révision est plus récente) et sous-ensemble (le contenu des VLAN).',
        'À la réception d’un résumé : si le domaine diffère, on ignore ; sinon on compare les révisions et l’on se met à jour seulement si la révision reçue est plus grande.',
        'Par défaut, un commutateur est serveur, sans domaine, avec élagage désactivé ; « show vtp status » affiche tout cela.',
        'Seul le serveur crée les VLAN ; chaque création ou renommage augmente le numéro de révision.',
      ],
    },
    {
      id: 'piege', titre: 'Le piège du numéro de révision', schemas: ['vtp-revision'],
      points: [
        'Un technicien branche un nouveau commutateur sans avoir effacé sa configuration ni son fichier vlan.dat : il peut avoir un numéro de révision plus élevé que celui du réseau.',
        'Si son domaine est le même, il impose sa base de VLAN à tous les commutateurs : les VLAN du réseau disparaissent.',
        'Avant de brancher un commutateur d’occasion, remets-le à neuf (révision 0) ou passe-le en mode transparent. La fiche « liste de contrôle avant de rejoindre un domaine » du catalogue détaille la vérification.',
      ],
    },
    {
      id: 'config-vtp', titre: 'Configurer VTP en cinq temps',
      points: [
        'Étape 1 : le mode du serveur ; étape 2 : domaine et mot de passe ; étape 3 : les clients ; étape 4 : créer les VLAN sur le serveur ; étape 5 : vérifier chez les clients.',
        'Les ports d’accès se règlent toujours localement sur chaque commutateur : VTP distribue les VLAN, pas l’affectation des ports.',
        'VLAN étendus : « vtp mode transparent » d’abord, puis « vlan 2000 ». Ils restent locaux au commutateur.',
      ],
    },
    {
      id: 'dtp', titre: 'DTP : négocier les trunks', schemas: ['dtp-modes'],
      points: [
        'access : port en accès permanent. dynamic auto : devient trunk si l’autre bout propose. dynamic desirable : propose activement le trunk. trunk : trunk permanent.',
        'Un trunk se forme si un bout est trunk ou desirable face à auto, desirable ou trunk. Deux auto ne forment rien ; trunk face à access donne un lien incohérent.',
        'DTP ne fonctionne que de point à point. « switchport nonegotiate » arrête d’envoyer des trames DTP sur un port fixé.',
        'Le plus sûr : fixer les deux bouts en trunk, avec le même VLAN natif et les VLAN autorisés prévus.',
      ],
    },
    {
      id: 'depannage', titre: 'Dépanner VTP et DTP',
      points: [
        'VTP : versions incompatibles, mots de passe différents, nom de domaine mal écrit (sensible à la casse). Pour éviter la faute de frappe, on définit le domaine sur UN commutateur et on le laisse se propager.',
        'DTP : mauvais modes aux deux bouts, VLAN natif différent, VLAN non autorisé sur le trunk.',
        'Démarche : trunk d’abord (show interfaces trunk), puis état VTP (show vtp status), puis VLAN (show vlan brief).',
      ],
    },
  ],
  commandes: [
    { cmd: 'show vtp status', sert: 'Voir mode, domaine, version, révision et nombre de VLAN.' },
    { cmd: 'vtp mode server|client|transparent', sert: 'Choisir le rôle du commutateur dans VTP.' },
    { cmd: 'vtp domain NOM', sert: 'Fixer le nom du domaine (identique partout, casse comprise).' },
    { cmd: 'vtp password', sert: 'Fixer le mot de passe du domaine (à taper sur la console).' },
    { cmd: 'switchport mode dynamic auto|desirable|trunk|access', sert: 'Choisir le mode DTP d’un port.' },
    { cmd: 'switchport nonegotiate', sert: 'Couper l’envoi de trames DTP sur un port fixé.' },
    { cmd: 'show interfaces trunk', sert: 'Lister les trunks, leur VLAN natif et les VLAN autorisés.' },
    { cmd: 'show interfaces F0/1 switchport', sert: 'Voir le mode administratif et le mode réel d’un port.' },
  ],
  pieges: [
    'Brancher un commutateur d’occasion sans l’avoir remis à neuf.',
    'Écrire le nom du domaine avec une autre casse (CCNA et Ccna sont différents).',
    'Créer un VLAN étendu sans passer le commutateur en mode transparent.',
    'Laisser deux bouts en dynamic auto et s’étonner de l’absence de trunk.',
    'Croire que VTP affecte aussi les ports aux VLAN : il ne distribue que la liste des VLAN.',
  ],
  questions: [
    { q: 'Que se passe-t-il si on branche un commutateur dont la révision VTP est plus élevée ?', r: 'S’il a le même domaine, il impose sa base de VLAN à tous les commutateurs du domaine, ce qui peut effacer les VLAN du réseau.' },
    { q: 'Quels rôles ont serveur, client et transparent ?', r: 'Le serveur crée et annonce les VLAN ; le client reçoit et relaie sans créer ; le transparent garde ses VLAN locaux et relaie sans adopter ceux des autres.' },
    { q: 'Pourquoi un VLAN étendu demande-t-il le mode transparent sur un 2960 ?', r: 'Parce que le commutateur n’admet les VLAN de 1006 à 4094 qu’en mode transparent ; ils restent donc locaux à ce commutateur.' },
    { q: 'Deux ports « dynamic auto » forment-ils un trunk ?', r: 'Non : aucun des deux ne propose. Il faut au moins un bout en desirable ou en trunk.' },
    { q: 'Dans quel ordre dépanner un client VTP qui ne reçoit pas les VLAN ?', r: 'Le trunk d’abord, puis le domaine et le mot de passe, la version, et enfin les numéros de révision.' },
  ],
};

// ---------------------------------------------------------------------------
// TP2 : trois routeurs, routes statiques
// ---------------------------------------------------------------------------
export const RESUME_TP2_CISCO = {
  titre: 'Résumé du TP2 — trois routeurs et routes statiques',
  intro: 'Pour préparer l’examen de mi-session : la démarche du TP2 dans Packet Tracer, le plan d’adressage et les points de l’énoncé à vérifier avant de l’appliquer.',
  essentiel: [
    'Le travail (5 % de la session, deux périodes) se fait dans Packet Tracer : on complète d’abord le tableau d’adressage (10 points), on configure ensuite les périphériques (70 points), on refait les tests après avoir retiré un lien, puis on monte le réseau physique (20 points).',
    'Convention de l’énoncé : adresses BASSES pour les postes, adresses HAUTES pour les commutateurs et les routeurs, dans la plage d’hôtes de chaque réseau.',
    'Configuration commune des commutateurs et routeurs : nom, no ip domain-lookup, mot de passe console, enable secret, service password-encryption et bannière.',
    'Il faut des routes statiques vers tous les réseaux non directement connectés, puis un ping entre tous les appareils.',
    'Partie 2 : on retire le lien R1–R3 et on modifie les routes pour que A-163 et B-235 se joignent par R2.',
  ],
  sections: [
    {
      id: 'plan', titre: 'Plan d’adressage', schemas: ['tp2-topologie', 'vlsm-masques'],
      points: [
        'Trois réseaux locaux en /27 (255.255.255.224) : A-163 en 192.168.5.64, B-235 en 192.168.5.160 et B-666 en 192.168.5.224 ; trois liens en /29 (255.255.255.248) entre routeurs.',
        'Un /27 offre 30 hôtes (de .65 à .94 pour A-163) et un /29 offre 6 hôtes (de .57 à .62 pour 10.123.145.56).',
        'Le tableau de l’énoncé donne l’adresse du réseau, la première et la dernière adresse d’hôte : le second tableau (périphériques, ports, masque, passerelle) se remplit avec ces plages.',
      ],
    },
    {
      id: 'verifier', titre: 'À vérifier dans l’énoncé avant d’appliquer',
      points: [
        'PC2 est noté 192.158.5.66 : c’est sans doute une faute de frappe pour 192.168.5.66, car il doit être dans le réseau A-163.',
        'Les interfaces S0/0/0 de R1 et de R3 portent la même adresse 10.123.145.56, qui est l’adresse du RÉSEAU et non une adresse d’hôte ; elles doivent avoir deux adresses différentes de .57 à .62.',
        'Le lien R2–R3 (10.123.145.72/29, avec .73 et .74) apparaît dans le second tableau mais pas dans le premier : il faut le compléter.',
        'Ces points sont des propositions à faire confirmer par l’enseignant : le Toolkit ne les tranche pas à ta place.',
      ],
    },
    {
      id: 'demarche', titre: 'Démarche conseillée',
      points: [
        'Compléter le tableau, puis construire la topologie, puis configurer les routeurs (interfaces, no shutdown, clock rate sur le DCE), les commutateurs (interface VLAN, passerelle), les postes, et enfin les routes.',
        'Tester un chemin à la fois avec ping, puis traceroute pour trouver où ça casse ; une route sans retour est l’oubli le plus courant.',
        'Partie 2 : après avoir retiré R1–R3, ajoute des routes qui passent par R2 (ou prépare dès le départ des routes flottantes).',
      ],
    },
  ],
  commandes: [
    { cmd: 'ip address A M / no shutdown', sert: 'Adresser et allumer une interface de routeur.' },
    { cmd: 'ip route R M voisin', sert: 'Route statique vers un réseau lointain.' },
    { cmd: 'ping A / traceroute A', sert: 'Vérifier la connectivité et repérer l’endroit où elle casse.' },
    { cmd: 'show ip route', sert: 'Contrôler les routes (codes C, L, S).' },
  ],
  pieges: [
    'Mettre l’adresse du réseau (.56) sur une interface au lieu d’une adresse d’hôte.',
    'Oublier le lien R2–R3 dans les routes.',
    'Oublier de refaire les routes et les tests après le retrait du lien R1–R3.',
  ],
  questions: [
    { q: 'Combien d’hôtes peut-on adresser dans un réseau /27 ? Et dans un /29 ?', r: 'Un /27 a 32 adresses, donc 30 hôtes ; un /29 a 8 adresses, donc 6 hôtes.' },
    { q: 'Quelle convention suit-on pour les adresses des postes et des équipements ?', r: 'Adresses basses pour les postes, adresses hautes pour les commutateurs et les routeurs, dans la plage d’hôtes de chaque réseau.' },
    { q: 'Comment compter les routes statiques d’un routeur dans ce TP ?', r: 'Nombre total de réseaux du schéma moins ceux qui lui sont directement connectés.' },
  ],
};
