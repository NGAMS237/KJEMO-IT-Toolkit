/**
 * cours-resume-cisco-tp-vlan.mjs — KJEMO-CISCO-TP-VLAN-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * RÉSUMÉ PLIABLE du TP « VLAN, SSH et routage inter-VLAN » : l'essentiel, la
 * topologie et le chemin d'un paquet (schémas originaux de
 * schemas-cisco-tp-vlan.mjs), l'ordre des phases, les commandes à retenir, les
 * pièges et des questions à réponse cachée. Écrit dans nos mots ; les adresses
 * sont un exemple de laboratoire.
 */
export const RESUME_TP_VLAN = {
  titre: 'Résumé du TP — VLAN, SSH et routage inter-VLAN',
  intro: 'À relire avant de commencer ou avant un examen : pourquoi cet ordre, ce que fait chaque équipement, comment un paquet passe d’un VLAN à l’autre et ce qui casse le plus souvent.',
  essentiel: [
    'Un VLAN est un réseau logique : deux postes de VLAN différents ne se parlent pas, même sur le même commutateur, tant qu’un routeur (ou un commutateur de niveau 3) ne les relie pas.',
    'Un port d’accès (access) porte UN VLAN sans étiquette ; un trunk porte plusieurs VLAN sur un seul câble, chaque trame étant marquée de son numéro de VLAN (norme 802.1Q).',
    'Un routeur « sur un bâton » relie les VLAN avec un seul câble : l’interface physique est découpée en sous-interfaces, une par VLAN, et chaque sous-interface est la passerelle de son réseau.',
    'Un commutateur de niveau 2 s’administre par une adresse sur une interface VLAN (SVI), plus une passerelle par défaut pour répondre aux autres réseaux ; SSH remplace Telnet parce qu’il chiffre la session.',
    'L’ordre qui marche : le VLAN de gestion et les VLAN du tableau d’abord, puis l’adresse de gestion, puis SSH, puis les ports et le trunk, puis le routeur, puis les tests, puis l’enregistrement.',
    'Pour ajouter un VLAN plus tard : une ligne de plus dans le tableau de la fiche, copier seulement son bloc, et l’ajouter au trunk avec « add » ; pour un deuxième administrateur : un deuxième compte local, testé par SSH.',
    'Mettre le poste d’administration et l’adresse du commutateur dans le MÊME VLAN permet de modifier le trunk et les autres ports sans couper la session SSH.',
  ],
  sections: [
    {
      id: 'tp-plan', titre: 'Le plan du TP et les neuf phases', schemas: ['tp-vlan-topologie'],
      points: [
        'Le VLAN de gestion (99 dans l’exemple) porte le commutateur et le poste d’administration ; on y ajoute les VLAN du tableau (un seul au départ : 10, ventes), chacun dans son réseau /24 ; la passerelle de chaque réseau est l’adresse .1, portée par le routeur.',
        'Phases : 1 nom et VLAN, 2 SSH, 3 première connexion SSH, 4 ports et trunk, 5 routeur, 6 autres postes, 7 tests, 8 enregistrer, 9 plus tard (VLAN de plus, deuxième administrateur).',
        'Les phases 1 et 2 se font en console ; à partir de la phase 3, le commutateur se configure par SSH depuis le poste de gestion.',
      ],
    },
    {
      id: 'tp-chemin', titre: 'Comment un paquet passe d’un VLAN à l’autre', schemas: ['tp-vlan-chemin'],
      points: [
        'Le poste envoie à SA passerelle (pas au poste visé) parce que l’adresse de destination est dans un autre réseau.',
        'Sur le trunk, la trame du VLAN 10 porte l’étiquette 10 en montant, puis l’étiquette du VLAN visé (99 pour la gestion) en redescendant : même câble, deux passages.',
        'Le routage entre les réseaux ne demande aucune route statique : ils sont directement connectés au routeur (routes « C » dans « show ip route »).',
      ],
    },
    {
      id: 'tp-ssh', titre: 'SSH sur le commutateur', schemas: [],
      points: [
        'Ordre exigé par IOS : nom d’hôte, domaine, compte local, clé RSA, puis « login local » et « transport input ssh » sur les lignes vty.',
        'Le mot de passe se tape sur l’équipement : il ne doit jamais être copié depuis une fiche ni stocké dans un fichier.',
        'Test final : depuis un VLAN du tableau, ouvrir une session SSH sur l’adresse de gestion (192.168.99.2 dans l’exemple) prouve que le trunk, le routeur et la passerelle du commutateur fonctionnent ensemble.',
      ],
    },
  ],
  commandes: [
    { cmd: 'vlan 10', sert: 'Créer le VLAN 10 (puis « name VENTES » pour lui donner un nom).' },
    { cmd: 'switchport mode access', sert: 'Fixer un port en accès : un seul VLAN, sans étiquette.' },
    { cmd: 'switchport access vlan 10', sert: 'Affecter le port d’accès au VLAN 10.' },
    { cmd: 'interface vlan 99', sert: 'Créer l’interface virtuelle de gestion du VLAN de gestion sur le commutateur.' },
    { cmd: 'ip default-gateway 192.168.99.1', sert: 'Donner sa passerelle à un commutateur de niveau 2.' },
    { cmd: 'crypto key generate rsa modulus 2048', sert: 'Générer la clé qui active SSH (nom d’hôte et domaine requis).' },
    { cmd: 'line vty 0 15', sert: 'Entrer dans les lignes de connexion à distance.' },
    { cmd: 'transport input ssh', sert: 'N’autoriser que SSH sur les lignes (refuse Telnet).' },
    { cmd: 'switchport mode trunk', sert: 'Transformer le port vers le routeur en trunk 802.1Q.' },
    { cmd: 'switchport trunk allowed vlan 99,10', sert: 'Limiter le trunk aux VLAN du TP (remplace la liste).' },
    { cmd: 'switchport trunk allowed vlan add 20', sert: 'Ajouter un VLAN à la liste sans effacer les autres.' },
    { cmd: 'username tech2 privilege 15 secret', sert: 'Créer le compte d’un deuxième administrateur (le mot de passe se tape sur l’équipement).' },
    { cmd: 'interface gigabitEthernet 0/0.10', sert: 'Créer la sous-interface du VLAN 10 sur le routeur.' },
    { cmd: 'encapsulation dot1Q 10', sert: 'Dire à la sous-interface de lire les trames étiquetées VLAN 10.' },
    { cmd: 'show interfaces trunk', sert: 'Vérifier le trunk : mode, VLAN autorisés et transmis.' },
    { cmd: 'show ip route', sert: 'Vérifier que les réseaux du TP sont directement connectés au routeur.' },
  ],
  pieges: [
    'Affecter un port à un VLAN qui n’existe pas encore : le port devient inactif ; crée les VLAN d’abord.',
    'Oublier « ip default-gateway » sur le commutateur : il répond dans son VLAN, mais pas aux postes des autres VLAN, donc pas de SSH inter-VLAN.',
    'Écrire « encapsulation dot1Q » après « ip address » sur la sous-interface, ou oublier le numéro : l’adresse est refusée.',
    'Donner une adresse IP à l’interface physique du routeur en plus des sous-interfaces.',
    '« switchport trunk allowed vlan » sans « add » remplace la liste : un VLAN oublié ne passe plus sur le trunk.',
    'Mauvaise passerelle sur un poste : le ping marche dans le VLAN mais jamais entre VLAN.',
    'Restreindre les lignes à SSH avant d’avoir testé la connexion, sans garder la console ouverte.',
    'Oublier d’enregistrer : tout disparaît au redémarrage.',
  ],
  questions: [
    { q: 'Pourquoi deux postes de VLAN différents ne se parlent-ils pas sans routeur ?', r: 'Chaque VLAN est un réseau IP distinct : un poste n’envoie directement qu’aux adresses de son propre réseau, et le commutateur ne laisse pas passer les trames d’un VLAN dans l’autre. Il faut un équipement de niveau 3 pour router d’un réseau à l’autre.' },
    { q: 'À quoi sert une sous-interface, et pourquoi en faut-il une par VLAN ?', r: 'Elle permet à un seul câble physique de jouer le rôle de plusieurs interfaces : chaque sous-interface lit les trames d’un seul VLAN (encapsulation dot1Q N) et porte l’adresse de passerelle de ce réseau.' },
    { q: 'Quelle est la différence entre un port d’accès et un trunk ?', r: 'Un port d’accès appartient à un seul VLAN et n’étiquette pas les trames ; un trunk transporte plusieurs VLAN sur le même câble en marquant chaque trame d’une étiquette 802.1Q avec son numéro de VLAN.' },
    { q: 'Pourquoi met-on le poste de gestion et l’adresse du commutateur dans le même VLAN ?', r: 'Pour que la session SSH ne dépende pas du trunk ni du routeur : on peut alors modifier le trunk et les autres ports sans se couper l’accès.' },
    { q: 'Le ping fonctionne dans un VLAN mais pas vers un autre : que lire en premier ?', r: 'La passerelle du poste (ipconfig), puis « show ip interface brief » sur le routeur (sous-interfaces up/up), puis « show interfaces trunk » sur le commutateur (VLAN autorisés).' },
  ],
};
