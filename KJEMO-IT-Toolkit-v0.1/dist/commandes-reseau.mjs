/**
 * commandes-reseau.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides du réseau, du DNS et du pare-feu.
 *
 * DEUX EXCEPTIONS À LA RÈGLE « UNE COMMANDE RAPIDE OBSERVE »
 *
 * Presque toutes les commandes de ce fichier sont en lecture. Deux ne le sont
 * pas, et ce sont des choix explicites :
 *
 *   ufw allow / ufw delete   Ouvrir un port est court, isolé, et son
 *                            annulation est EXACTE : la même règle, retirée
 *                            par son numéro. Créer un assistant pour cela
 *                            ajouterait quatre écrans à une opération qui en
 *                            demande un, et transformerait l'application en
 *                            mur de scripts.
 *   netplan try              Elle APPLIQUE, mais elle revient toute seule en
 *                            arrière après 120 secondes si personne ne
 *                            confirme — ce qui en fait la seule façon sûre de
 *                            changer le réseau d'une machine distante. Elle
 *                            exige un terminal interactif, donc elle ne peut
 *                            être qu'une commande tapée à la main : aucun
 *                            script ne peut la lancer utilement.
 *
 * `netplan apply` n'est PAS ici, et ne le sera pas. Elle applique sans retour,
 * et sur une machine administrée à distance elle coupe la session au moment
 * même où elle s'applique.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

export const commandesReseau = [
  // =========================================================================
  // L'ÉTAT LOCAL — LIEN, ADRESSES, ROUTES, VOISINS
  // =========================================================================
  {
    id: 'cr-ip-link',
    notion: 'linux-network-diagnostic',
    besoin: 'Voir l’état du LIEN de chaque interface : allumée, éteinte, ou allumée sans signal.',
    commande: 'ip -brief link show',
    exemple: 'ip -brief link show',
    parametres: [],
    options: [
      { option: '-brief', explication: '-brief condense une interface par ligne. La sortie par défaut d’« ip link » occupe trois lignes par interface, ce qui noie la comparaison dès qu’il y en a plus de deux.' },
    ],
    resultat: 'Une ligne par interface : nom, état, adresse matérielle. Trois états à ne pas confondre — « DOWN » administrativement éteinte ; « UP » suivi de NO-CARRIER allumée mais SANS signal, donc câble débranché, port de commutateur éteint ou VLAN absent côté commutateur ; « UP » avec LOWER_UP le lien est établi. NO-CARRIER est le cas qu’on cherche le plus longtemps, parce qu’une lecture rapide y voit « UP ».',
    verification: 'ip -brief address show',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-network-diagnostic',
    source: `${MAN}/man8/ip.8.html`,
  },
  {
    id: 'cr-ip-adresse',
    notion: 'linux-network-diagnostic',
    besoin: 'Lire les adresses IP configurées, toutes interfaces confondues.',
    commande: 'ip -brief address show',
    exemple: 'ip -brief address show',
    parametres: [],
    options: [
      { option: '-brief', explication: '-brief met une interface par ligne, avec toutes ses adresses à la suite.' },
    ],
    resultat: 'Une ligne par interface, avec ses adresses. Une adresse en 169.254.x.x est la signature d’un DHCP qui n’a PAS répondu : l’interface s’en est attribué une elle-même, et elle n’est pas routable. C’est la panne qui ressemble le plus à « j’ai une adresse, donc le réseau marche ». Plusieurs adresses sur une interface, en revanche, est normal et courant.',
    verification: 'ip route show default',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-network-diagnostic',
    source: `${MAN}/man8/ip-address.8.html`,
  },
  {
    id: 'cr-ip-route',
    notion: 'linux-network-diagnostic',
    besoin: 'Savoir par où sort ce qui n’est pas sur le réseau local.',
    commande: 'ip route show default',
    exemple: 'ip route show default',
    parametres: [],
    options: [
      { option: 'show', explication: 'Le sous-commande « show » liste. « ip route add » et « ip route del » modifient, et leur effet disparaît au prochain redémarrage : une correction durable va dans la configuration Netplan.' },
      { option: 'default', explication: 'Le filtre « default » ne garde que la route par défaut. Sans lui, la table complète s’affiche — utile aussi, mais la question « par où sort-on ? » a sa réponse ici.' },
    ],
    resultat: 'La ligne commence par « default via <passerelle> dev <interface> ». Aucune sortie signifie AUCUNE route par défaut : tout ce qui sort du réseau local échoue avec « Network is unreachable », message qu’on prend pour une panne du réseau distant — alors que le réseau local, lui, continue de fonctionner. Plusieurs lignes signifient plusieurs routes par défaut : le noyau choisit celle dont la métrique est la plus basse.',
    verification: 'ip route show',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-network-diagnostic',
    source: `${MAN}/man8/ip-route.8.html`,
  },
  {
    id: 'cr-ip-neigh',
    notion: 'linux-network-diagnostic',
    besoin: 'Voir les machines du réseau local vues récemment — et repérer une adresse IP dupliquée.',
    commande: 'ip neigh show',
    exemple: 'ip neigh show',
    parametres: [],
    options: [],
    resultat: 'Une ligne par voisin : adresse IP, interface, adresse matérielle, état. « REACHABLE » est bon, « STALE » signifie seulement « pas vérifié récemment », « FAILED » que la machine n’a pas répondu. C’est le seul endroit où se voit une adresse IP dupliquée sur le réseau : deux adresses matérielles pour la même adresse IP, et la connexion marche une fois sur deux — une panne qui résiste à tous les diagnostics qui ne regardent que la machine locale.',
    verification: 'ping -c 3 <ADRESSE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-network-diagnostic',
    source: `${MAN}/man8/ip-neighbour.8.html`,
  },
  {
    id: 'cr-ss-ecoute',
    notion: 'linux-network-diagnostic',
    besoin: 'Savoir quels services écoutent, sur quels ports, et sur quelle adresse.',
    commande: 'sudo ss -lntup',
    exemple: 'sudo ss -lntup',
    parametres: [],
    options: [
      { option: '-lntup', explication: 'Cinq options courtes groupées, et chacune compte : -l ne garde que les sockets en ÉCOUTE ; -n n’essaie pas de traduire les numéros de port en noms de service, ce qui évite une attente quand le DNS est en panne ; -t ajoute TCP ; -u ajoute UDP — sans -t ni -u, la liste est vide ; -p affiche le PROCESSUS, et cette colonne reste vide sans privilège.' },
    ],
    resultat: 'Une ligne par socket en écoute. La colonne « Local Address:Port » est la plus importante : « 127.0.0.1:<port> » n’est joignable QUE depuis la machine, « 0.0.0.0:<port> » depuis partout où le réseau et le pare-feu le permettent, et « [::]:<port> » est la même chose en IPv6 — qu’une règle de pare-feu écrite pour IPv4 seulement ne couvre pas. C’est la cause de la moitié des « le service tourne mais je ne peux pas m’y connecter », et le pare-feu n’y est pour rien.',
    verification: 'sudo ufw status verbose',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-firewall-audit',
    source: `${MAN}/man8/ss.8.html`,
  },
  {
    id: 'cr-ping',
    notion: 'linux-network-diagnostic',
    besoin: 'Vérifier qu’une machine répond, en commençant par la passerelle.',
    commande: 'ping -c 3 <CIBLE>',
    exemple: 'ping -c 3 192.168.30.1',
    parametres: [
      { jeton: '<CIBLE>', role: 'Une adresse IP ou un nom. Commence TOUJOURS par la passerelle, dont l’adresse est dans « ip route show default » : inutile de chercher plus loin si le premier saut ne répond pas.', exemple: '192.168.30.1' },
    ],
    options: [
      { option: '-c', explication: '-c borne le nombre de paquets. Sans lui, ping tourne jusqu’à interruption — et dans un script, indéfiniment.' },
    ],
    resultat: 'Trois lignes de réponse et un résumé, ou un message qui dit lequel des trois étages est en cause : « Name or service not known » la RÉSOLUTION, « Network is unreachable » la ROUTE, un délai d’attente sans réponse le lien ou un pare-feu. Réserve importante : beaucoup de pare-feux bloquent ICMP et laissent passer le reste — un ping qui échoue ne prouve pas qu’un hôte est éteint.',
    verification: 'ip route show default',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-network-diagnostic',
    source: `${MAN}/man8/ping.8.html`,
  },
  {
    id: 'cr-tracepath',
    notion: 'linux-network-diagnostic',
    besoin: 'Voir OÙ la progression s’arrête, ce qu’un ping qui échoue ne dit pas.',
    commande: 'tracepath -m 10 <CIBLE>',
    exemple: 'tracepath -m 10 archive.ubuntu.com',
    parametres: [
      { jeton: '<CIBLE>', role: 'Le nom ou l’adresse à joindre.', exemple: 'archive.ubuntu.com' },
    ],
    options: [
      { option: '-m', explication: '-m borne le nombre de sauts. Sans lui, tracepath en essaie trente, ce qui fait attendre longtemps quand le chemin est coupé au deuxième.' },
    ],
    resultat: 'Un saut par ligne, avec le temps de réponse et la MTU découverte. Le dernier saut qui répond est le dernier équipement joignable : la panne est juste après. Des « no reply » au milieu d’un chemin qui aboutit sont normaux — certains équipements ne répondent pas et se contentent de transmettre. tracepath n’a pas besoin de privilège, contrairement à traceroute dans certaines configurations.',
    verification: 'ping -c 3 <CIBLE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-network-diagnostic',
    source: `${MAN}/man8/tracepath.8.html`,
  },

  // =========================================================================
  // LA RÉSOLUTION DE NOMS
  // =========================================================================
  {
    id: 'cr-resolvectl-status',
    notion: 'linux-dns-diagnostic',
    besoin: 'Connaître les serveurs DNS RÉELLEMENT interrogés — ce que /etc/resolv.conf ne dit plus.',
    commande: 'resolvectl status',
    exemple: 'resolvectl status',
    parametres: [],
    options: [],
    resultat: 'Les serveurs sont groupés PAR INTERFACE, parce que chacune apporte les siens — par DHCP ou par Netplan. C’est l’information que /etc/resolv.conf ne donne plus : sur Ubuntu, ce fichier ne contient que « nameserver 127.0.0.53 », l’adresse du résolveur local, et le lire pour connaître les serveurs du réseau est l’erreur de diagnostic la plus fréquente du sujet. « DNS Domain » donne les domaines de recherche, qui complètent un nom court.',
    verification: 'ls -l /etc/resolv.conf',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-dns-diagnostic',
    source: `${MAN}/man1/resolvectl.1.html`,
  },
  {
    id: 'cr-resolvectl-query',
    notion: 'linux-dns-diagnostic',
    besoin: 'Résoudre un nom en interrogeant le résolveur du système, et savoir si la réponse vient du cache.',
    commande: 'resolvectl query <NOM>',
    exemple: 'resolvectl query archive.ubuntu.com',
    parametres: [
      { jeton: '<NOM>', role: 'Le nom à résoudre. Une adresse IP fonctionne aussi, et donne la résolution inverse.', exemple: 'archive.ubuntu.com' },
    ],
    options: [],
    resultat: 'L’adresse, l’interface qui a servi, et la provenance de la réponse. La mention « cache » en fin de sortie signifie qu’elle vient du CACHE local et non du serveur : une entrée périmée peut donc paraître correcte. En cas d’échec, le message est précis — « No appropriate name servers » veut dire qu’aucune interface n’a de serveur, « Query timed out » que le serveur déclaré ne répond pas.',
    verification: 'getent hosts <NOM>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-dns-diagnostic',
    source: `${MAN}/man1/resolvectl.1.html`,
  },
  {
    id: 'cr-resolvectl-srv',
    notion: 'linux-dns-diagnostic',
    besoin: 'Vérifier que le DNS connaît un domaine Active Directory, avant d’essayer d’y joindre une machine.',
    commande: 'resolvectl query --type=SRV _ldap._tcp.<DOMAINE>',
    exemple: 'resolvectl query --type=SRV _ldap._tcp.kjemo.local',
    parametres: [
      { jeton: '<DOMAINE>', role: 'Le realm du domaine, avec son point — par exemple kjemo.local. Un nom sans point est un nom NetBIOS, et les enregistrements SRV ne se cherchent pas avec lui.', exemple: 'kjemo.local' },
    ],
    options: [
      { option: '--type', explication: '--type choisit le type d’enregistrement. SRV est celui qui publie « quel serveur rend tel service pour ce domaine » : un client ne trouve pas un contrôleur par son nom, il interroge ces enregistrements.' },
    ],
    resultat: 'Une ligne par contrôleur publié, avec son port et sa priorité. Aucune réponse signifie que le DNS interrogé ne connaît pas le domaine : une jonction échouerait, et le message côté client parlerait d’un « domaine introuvable » sans jamais mentionner SRV. Cause la plus fréquente : le client interroge un DNS public, qui ne connaît pas — et ne peut pas connaître — les enregistrements d’un domaine interne.',
    verification: 'resolvectl query --type=SRV _kerberos._udp.<DOMAINE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-dns-diagnostic',
    source: `${MAN}/man1/resolvectl.1.html`,
  },
  {
    id: 'cr-getent-hosts',
    notion: 'linux-dns-diagnostic',
    besoin: 'Résoudre un nom par le chemin que suivent les programmes ordinaires, /etc/hosts compris.',
    commande: 'getent hosts <NOM>',
    exemple: 'getent hosts archive.ubuntu.com',
    parametres: [
      { jeton: '<NOM>', role: 'Le nom à résoudre.', exemple: 'archive.ubuntu.com' },
    ],
    options: [
      { option: 'hosts', explication: 'Le nom de la BASE interrogée. getent passe par la bibliothèque C, donc par /etc/hosts PUIS par le résolveur, dans l’ordre fixé par /etc/nsswitch.conf : c’est exactement ce que fera une application.' },
    ],
    resultat: 'L’adresse et le nom, ou rien du tout avec un code de retour non nul. La différence avec « dig » est le fond du sujet : si getent répond et que dig échoue, la réponse venait de /etc/hosts ou d’un cache ; si dig répond et que getent échoue, c’est la configuration du résolveur local qui est en cause. Un seul des deux tests ne distingue pas ces deux pannes.',
    verification: 'grep <NOM> /etc/hosts',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-dns-diagnostic',
    source: `${MAN}/man1/getent.1.html`,
  },

  // =========================================================================
  // LE PARE-FEU — DEUX COMMANDES QUI MODIFIENT, ET LEUR ANNULATION EXACTE
  // =========================================================================
  {
    id: 'cr-ufw-status',
    notion: 'linux-firewall-audit',
    besoin: 'Lire les règles du pare-feu et, surtout, ses politiques par défaut.',
    commande: 'sudo ufw status verbose',
    exemple: 'sudo ufw status verbose',
    parametres: [],
    options: [
      { option: 'verbose', explication: 'Sans « verbose », ufw status liste les règles et TAIT les politiques par défaut — qui décident du sort de tout ce qu’aucune règle ne nomme. C’est l’information la plus importante de la sortie.' },
    ],
    resultat: 'L’état — actif ou inactif — les politiques par défaut, puis une ligne par règle. La ligne « Default: deny (incoming) » est la bonne configuration d’un serveur : tout ce qui n’est pas autorisé est refusé. En « allow (incoming) », tout service qui écoute devient joignable dès qu’il démarre, y compris celui qu’on vient d’installer sans y penser. Et « Status: inactive » ne veut PAS dire « aucune règle » : UFW n’est qu’une interface qui écrit des règles nftables, et nftables peut en porter d’autres.',
    verification: 'sudo nft list ruleset',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-firewall-audit',
    source: `${MAN}/man8/ufw.8.html`,
  },
  {
    id: 'cr-nft-ruleset',
    notion: 'linux-firewall-audit',
    besoin: 'Lire ce que le noyau applique VRAIMENT, UFW compris.',
    commande: 'sudo nft list ruleset',
    exemple: 'sudo nft list ruleset',
    parametres: [],
    options: [],
    resultat: 'Les tables, les chaînes et les règles telles que le noyau les applique — y compris celles qu’UFW a écrites, puisqu’UFW écrit ici. La mention « policy » en fin de déclaration de chaîne décide du sort de ce qu’aucune règle ne nomme : « policy drop » refuse en silence, « policy accept » accepte tout le reste. Une sortie vide signifie AUCUN filtrage : tout service qui écoute est joignable depuis tout ce qui peut atteindre la machine.',
    verification: 'sudo ss -lntup',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'linux-firewall-audit',
    source: `${MAN}/man8/nft.8.html`,
  },
  {
    id: 'cr-ufw-allow',
    notion: 'linux-firewall-audit',
    besoin: 'Autoriser un port à travers le pare-feu — opération courte dont l’annulation est exacte.',
    commande: 'sudo ufw allow <PORT>/tcp',
    exemple: 'sudo ufw allow 22/tcp',
    parametres: [
      { jeton: '<PORT>', role: 'Le numéro du port à autoriser. Vérifie d’abord qu’un service y écoute vraiment : ouvrir un port où rien n’écoute ne sert à rien aujourd’hui, et exposera sans décision le service qui s’y liera un jour.', exemple: '22' },
    ],
    options: [
      { option: 'allow', explication: 'Le verbe. « ufw deny » refuse explicitement, ce qui n’a d’intérêt que devant une politique par défaut permissive ; « ufw limit » autorise en bridant les tentatives répétées, utile pour SSH.' },
    ],
    resultat: '« Rule added » et « Rule added (v6) » : la règle est appliquée IMMÉDIATEMENT, et elle survit au redémarrage. La seconde ligne n’apparaît que si IPV6=yes dans /etc/default/ufw — sinon la règle ne vaut que pour IPv4, et le service reste joignable en IPv6 alors que tous les tests faits en IPv4 confirment que « c’est bien fermé ». Avant d’ACTIVER ufw sur une machine distante, autorise SSH d’abord : dans l’autre ordre, la session se coupe à l’activation.',
    verification: 'sudo ufw status numbered',
    risque: 'reversible',
    retourArriere: 'sudo ufw status numbered, puis sudo ufw delete <NUMERO>',
    assistant: 'linux-firewall-audit',
    source: `${MAN}/man8/ufw.8.html`,
  },
  {
    id: 'cr-ufw-delete',
    notion: 'linux-firewall-audit',
    besoin: 'Retirer une règle de pare-feu, par son numéro, sans se tromper de règle.',
    commande: 'sudo ufw delete <NUMERO>',
    exemple: 'sudo ufw delete 3',
    parametres: [
      { jeton: '<NUMERO>', role: 'Le numéro de la règle, lu dans « sudo ufw status numbered » JUSTE AVANT. Les numéros se décalent à chaque suppression : en retirer deux d’affilée avec les numéros de la première lecture supprime la mauvaise règle.', exemple: '3' },
    ],
    options: [
      { option: 'delete', explication: 'Le verbe. « ufw delete » accepte aussi la règle écrite en entier — « ufw delete allow 22/tcp » — ce qui évite le piège des numéros qui se décalent, mais exige de reproduire la règle exactement.' },
    ],
    resultat: 'La règle est affichée et retirée, immédiatement. Relis la liste après CHAQUE suppression : les numéros se décalent, et c’est l’erreur classique quand on en retire plusieurs. Retirer la règle qui autorise SSH depuis une session SSH ne coupe pas la session en cours — les connexions établies continuent — mais aucune NOUVELLE connexion ne sera possible.',
    verification: 'sudo ufw status numbered',
    risque: 'reversible',
    retourArriere: 'sudo ufw allow <PORT>/tcp, en reprenant la règle affichée au moment de la suppression',
    assistant: 'linux-firewall-audit',
    source: `${MAN}/man8/ufw.8.html`,
  },

  // =========================================================================
  // NETPLAN — LA SEULE FAÇON SÛRE D'APPLIQUER
  // =========================================================================
  {
    id: 'cr-netplan-generate',
    notion: 'netplan-readiness',
    besoin: 'Vérifier qu’une configuration Netplan est valide, sans l’appliquer.',
    commande: 'sudo netplan generate --root-dir <DOSSIER>',
    exemple: 'sudo netplan generate --root-dir /tmp/essai-netplan',
    parametres: [
      { jeton: '<DOSSIER>', role: 'Un dossier qui contient une copie de l’arborescence à valider, c’est-à-dire un sous-dossier etc/netplan. Netplan y lit la configuration et y écrit ce qu’il produirait, sans toucher au système.', exemple: '/tmp/essai-netplan' },
    ],
    options: [
      { option: '--root-dir', explication: '--root-dir confine la lecture ET l’écriture au dossier donné. Sans lui, netplan generate lit /etc/netplan et écrit dans /run : cela n’applique rien non plus — la page de manuel le dit — mais cela remplace les fichiers que le moteur relira au prochain démarrage.' },
    ],
    resultat: 'Aucune sortie si la configuration est valide. Sinon, un message qui nomme le fichier, la ligne et la clé en cause. La page de manuel est explicite : « It does not apply the generated configuration ». Attention à ce que cette validation NE dit pas : elle valide la FORME. Une adresse déjà prise sur le réseau, un VLAN absent côté commutateur ou une passerelle qui ne route rien passent la validation et coupent la connexion.',
    verification: 'find <DOSSIER>/run -type f',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'netplan-readiness',
    source: `${MAN}/man8/netplan-generate.8.html`,
  },
  {
    id: 'cr-netplan-try',
    notion: 'netplan-readiness',
    besoin: 'Appliquer une configuration réseau sur une machine distante sans risquer de perdre l’accès.',
    commande: 'sudo netplan try',
    exemple: 'sudo netplan try',
    parametres: [],
    options: [
      { option: 'try', explication: 'Le sous-commande « try » applique, attend une confirmation au clavier, et REVIENT tout seul en arrière après 120 secondes si personne ne confirme. C’est ce qui la distingue de « netplan apply », qui applique sans retour — et qui n’a donc pas sa place dans ces commandes rapides.' },
    ],
    resultat: 'La configuration est appliquée, puis netplan demande « Do you want to keep these settings? ». Si la session se coupe : ne touche à rien et attends deux minutes, la configuration précédente revient toute seule. C’est la seule commande d’application sûre à distance, et elle exige un terminal interactif — aucun script ne peut la lancer utilement, car sans terminal elle appliquerait puis laisserait revenir en arrière. Ouvre une SECONDE session avant de la lancer : c’est elle qui permettra de vérifier et de corriger.',
    verification: 'ip -brief address show',
    risque: 'attention',
    retourArriere: 'Ne rien faire pendant 120 secondes : netplan try remet la configuration précédente seul. Après confirmation, retirer le fichier ajouté dans /etc/netplan puis relancer sudo netplan try',
    assistant: 'netplan-readiness',
    source: `${MAN}/man8/netplan-try.8.html`,
  },
];
