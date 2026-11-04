/**
 * cours-resume-cisco-nat.mjs — KJEMO-CISCO-NAT-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * RÉSUMÉ PLIABLE du cours « NAT, PAT, types d'adresses et récapitulation » :
 * l'essentiel, les schémas, les commandes à retenir, les pièges et des
 * questions à réponse cachée, plus un rappel express des sujets déjà vus (VTP,
 * VLAN, RIP, SSH, sécurité des ports, routes statiques). Écrit dans nos mots à
 * partir des notes de cours de l'étudiant ; schémas originaux dans
 * schemas-cisco-nat.mjs. Les exemples sont à lire, pas à exécuter.
 */
export const RESUME_NAT = {
  titre: 'Résumé du cours — NAT, PAT, adresses IPv6 et récapitulation',
  intro: 'À relire avant un examen : le vocabulaire et les trois types de NAT, le PAT et les ports, la redirection de port, NAT64, les modes de diffusion (dont la télévision IP d’un hôtel), les types d’adresses IPv6 et la récapitulation de routes.',
  essentiel: [
    'Le NAT remplace des adresses privées par des adresses publiques quand un paquet passe entre l’interface « inside » et l’interface « outside » du routeur.',
    'Trois types : NAT statique (une adresse pour une adresse, fixe), NAT dynamique (un pool d’adresses publiques prêtées) et PAT ou « overload » (une seule adresse publique partagée grâce aux ports).',
    'Un socket est une adresse IP plus un numéro de port (8.8.1.1:80) ; le client prend un port dynamique (49152 à 65535), le serveur garde son port connu : c’est ce qui permet au PAT de distinguer les conversations.',
    'La redirection de port (port forwarding) ouvre UN port de l’adresse publique vers UN port d’un serveur privé, au lieu de publier toute l’adresse.',
    'NAT64 traduit entre IPv6 et IPv4 : le DNS64 fabrique une adresse 64:ff9b::/96 qui contient l’adresse IPv4, et le routeur la retraduit.',
    'Quatre modes de livraison : monodiffusion (un à un), diffusion (un à tous, IPv4 seulement), multidiffusion (un à un groupe) et anycast (un au plus proche). IPv6 n’a pas de diffusion.',
    'Récapituler des routes, c’est garder les bits communs de réseaux contigus : quatre /24 voisins deviennent un /22, ce qui réduit la table de routage.',
  ],
  sections: [
    {
      id: 'nat-bases', titre: 'NAT : vocabulaire et trois types', schemas: ['nat-vocabulaire', 'nat-trois-types'],
      points: [
        'Inside local : l’adresse privée du poste vue de l’intérieur ; inside global : la même machine vue de l’extérieur ; outside global : l’adresse du correspondant sur Internet ; outside local : ce correspondant vu de l’intérieur, souvent identique.',
        'Sans « ip nat inside » et « ip nat outside » sur les deux interfaces, la règle existe mais rien n’est traduit : c’est l’oubli le plus fréquent.',
        'NAT statique : « ip nat inside source static local globale », pour publier un serveur. NAT dynamique : liste d’accès + « ip nat pool » + « ip nat inside source list … pool … ».',
        'Le NAT dynamique s’épuise quand il y a plus de postes que d’adresses dans le pool ; le PAT résout ce problème.',
      ],
    },
    {
      id: 'pat-ports', titre: 'PAT, sockets et ports', schemas: ['pat-table', 'socket-ports'],
      points: [
        'PAT : « ip nat inside source list N interface sortie overload ». Le mot « overload » fait tout : le routeur change aussi le numéro de port source pour distinguer les postes.',
        'Plages de ports : 0 à 1023 bien connus (80 web, 443 web chiffré, 22 SSH, 53 DNS), 1024 à 49151 enregistrés, 49152 à 65535 dynamiques (choisis par le client).',
        'Une connexion relie deux sockets, par exemple 192.168.10.10:51000 vers 8.8.1.1:80. Au retour, le routeur lit le port de destination pour retrouver le bon poste.',
        'Redirection de port : « ip nat inside source static tcp local portLocal globale portGlobal » ; seule cette conversation est ouverte, les autres ports restent fermés.',
      ],
    },
    {
      id: 'nat64', titre: 'NAT64 : de l’IPv6 vers l’IPv4', schemas: ['nat64'],
      points: [
        'Un poste IPv6 seul parle à un serveur IPv4 seul : le routeur NAT64 traduit les paquets entre les deux familles.',
        'Le DNS64 répond avec une adresse fabriquée : préfixe 64:ff9b::/96 suivi de l’adresse IPv4 en hexadécimal (8.8.8.8 devient 64:ff9b::808:808).',
        'À ne pas confondre avec le NAT classique, qui traduit de l’IPv4 privé vers l’IPv4 public. La syntaxe NAT64 varie selon la plateforme et n’existe pas dans Packet Tracer : on retient le principe.',
      ],
    },
    {
      id: 'diffusion', titre: 'Monodiffusion, multidiffusion, anycast', schemas: ['cast-types', 'multicast-iptv'],
      points: [
        'Monodiffusion : un seul destinataire (charger une page, un ping). Diffusion : tous les postes du réseau, IPv4 seulement (ARP, DHCPDISCOVER).',
        'Multidiffusion : un groupe qui s’est abonné, par IGMP en IPv4 ou MLD en IPv6. Exemple d’un hôtel : le serveur vidéo envoie un seul flux vers 239.1.1.1 et le commutateur le copie seulement vers les chambres qui regardent la chaîne.',
        'Sans multidiffusion, il faudrait un flux par chambre : cent chambres consommeraient cent fois la bande passante.',
        'Anycast : la même adresse sur plusieurs machines, le routage choisit la plus proche (par exemple les DNS publics 8.8.8.8 et 1.1.1.1).',
      ],
    },
    {
      id: 'ipv6-types', titre: 'Les types d’adresses IPv6 et leurs usages', schemas: ['ipv6-types-reels'],
      points: [
        'Globale unicast (2000::/3) : routable sur Internet. Link-local (FE80::/10) : entre voisins d’un même lien, jamais routée, sert de passerelle aux postes.',
        'Bouclage ::1/128 : tester sa propre pile réseau. Non spécifiée ::/128 : « je n’ai pas encore d’adresse », source d’un poste qui démarre ; ::/0 désigne la route par défaut.',
        'Locale unique FC00::/7 (FD00::/8 en pratique) : réseau privé interne, l’équivalent de 192.168.x.x, non routée sur Internet.',
        'IPv4 intégré : ::ffff:a.b.c.d pour les logiciels double pile, et le préfixe 64:ff9b::/96 pour NAT64.',
        'SLAAC (le poste fabrique son adresse) et DHCPv6 (sans état : DNS seulement ; avec état : toute l’adresse) sont détaillés dans le cours de la semaine 9.',
      ],
    },
    {
      id: 'recap', titre: 'Récapitulation de routes', schemas: ['route-recap'],
      points: [
        'On écrit les réseaux en binaire, on garde les bits communs, on met le reste à zéro : 192.168.0.0 à 192.168.3.0 (quatre /24) donnent 192.168.0.0/22, masque 255.255.252.0.',
        'Règle d’alignement : le nombre de réseaux regroupés est une puissance de 2 et le premier est un multiple de ce nombre. 192.168.1.0 à 192.168.4.0 ne se regroupent pas proprement.',
        'Route statique récapitulative : « ip route 192.168.0.0 255.255.252.0 saut ». Sur le routeur qui possède les réseaux, une route récapitulative vers Null0 évite les boucles.',
        'En RIPv2, le résumé manuel se pose sur l’interface qui annonce : « ip summary-address rip réseau masque ».',
      ],
    },
    {
      id: 'revision', titre: 'Rappel express : VTP, VLAN, RIP, SSH, sécurité des ports, routes statiques', schemas: [],
      points: [
        'VTP : trois modes (serveur, client, transparent) ; un client prend la configuration du serveur dont le numéro de révision est le plus élevé. VLAN : plage normale 1 à 1005, étendue 1006 à 4094.',
        'RIP : vecteur de distance, 15 sauts au plus, distance administrative 120 ; en version 2, « no auto-summary ». SSH : il faut un nom d’hôte, un nom de domaine et une clé RSA avant d’activer « transport input ssh ».',
        'Sécurité des ports : maximum d’adresses, apprentissage sticky et trois sanctions (protect, restrict, shutdown qui met le port en err-disabled).',
        'Routes statiques : distance 1 ; une route flottante a une distance plus grande et ne sert que si la route principale disparaît ; la route par défaut est 0.0.0.0/0.',
      ],
    },
  ],
  commandes: [
    { cmd: 'ip nat inside', sert: 'Sur l’interface côté postes : marquer le côté intérieur du NAT.' },
    { cmd: 'ip nat outside', sert: 'Sur l’interface côté Internet : marquer le côté extérieur du NAT.' },
    { cmd: 'ip nat inside source static 192.168.10.10 203.0.113.10', sert: 'NAT statique : une adresse privée pour une adresse publique.' },
    { cmd: 'ip nat pool POOL-PUBLIC 203.0.113.20 203.0.113.30 netmask 255.255.255.0', sert: 'Définir la réserve d’adresses publiques du NAT dynamique.' },
    { cmd: 'ip nat inside source list 1 pool POOL-PUBLIC', sert: 'NAT dynamique : les adresses permises par la liste 1 empruntent le pool.' },
    { cmd: 'ip nat inside source list 1 interface Se0/1/0 overload', sert: 'PAT : tout le réseau derrière l’adresse de l’interface de sortie.' },
    { cmd: 'ip nat inside source static tcp 192.168.10.10 80 203.0.113.10 8080', sert: 'Redirection de port : le port 8080 public arrive sur le port 80 du serveur.' },
    { cmd: 'show ip nat translations', sert: 'Lire la table NAT : adresses et ports traduits.' },
    { cmd: 'show ip nat statistics', sert: 'Voir les interfaces marquées et les compteurs hits et misses.' },
    { cmd: 'clear ip nat translation *', sert: 'Vider les traductions dynamiques avant un nouveau test.' },
    { cmd: 'ip route 192.168.0.0 255.255.252.0 10.0.0.2', sert: 'Route statique récapitulative : quatre /24 en un /22.' },
    { cmd: 'ip route 192.168.0.0 255.255.252.0 Null0', sert: 'Route récapitulative qui jette les paquets pour des adresses inexistantes, sur le routeur qui possède les réseaux.' },
    { cmd: 'ip summary-address rip 192.168.0.0 255.255.252.0', sert: 'Sur l’interface vers le voisin : annoncer un résumé en RIPv2.' },
  ],
  pieges: [
    'Oublier « ip nat inside » ou « ip nat outside » sur l’une des interfaces, ou les inverser : aucune traduction.',
    'Écrire la liste d’accès NAT avec un masque réseau au lieu d’un masque générique (wildcard), ou à côté du bon réseau.',
    'Croire que la liste d’accès NAT filtre le trafic : elle sert seulement à désigner qui est traduit.',
    'Oublier « overload » : un NAT dynamique sans surcharge n’a qu’un poste par adresse du pool.',
    'Oublier la route par défaut vers le fournisseur : la traduction marche, mais le paquet ne sort pas.',
    'Regrouper des réseaux non contigus ou non alignés : la route récapitulative couvre des réseaux qu’on n’a pas.',
    'Confondre NAT64 (IPv6 vers IPv4) et le NAT classique (IPv4 privé vers IPv4 public).',
    'Dire qu’IPv6 a une adresse de diffusion : elle n’existe pas, la multidiffusion FF02::1 la remplace.',
  ],
  questions: [
    { q: 'Quelle est la différence entre un NAT dynamique et un PAT ?', r: 'Le NAT dynamique prête UNE adresse publique du pool à chaque poste actif, donc le pool s’épuise. Le PAT (overload) fait partager une seule adresse à tous les postes en les distinguant par le numéro de port source.' },
    { q: 'À quoi sert la redirection de port et en quoi diffère-t-elle du NAT statique ?', r: 'Elle ouvre un port précis de l’adresse publique vers un port d’un serveur privé (par exemple 8080 vers 80). Le NAT statique, lui, associe toute une adresse privée à toute une adresse publique.' },
    { q: 'Pourquoi un client utilise-t-il un port dynamique et un serveur un port bien connu ?', r: 'Le serveur doit être trouvé à un port prévisible (80 pour le web). Le client, lui, prend un port libre entre 49152 et 65535 : ce port, avec son adresse, forme son socket et permet de reconnaître la réponse.' },
    { q: 'Pourquoi la télévision d’un hôtel utilise-t-elle la multidiffusion ?', r: 'Un seul flux est envoyé vers le groupe, et le commutateur ne le copie que vers les chambres qui ont rejoint le groupe (IGMP). En monodiffusion, il faudrait un flux par chambre.' },
    { q: 'Comment regroupe-t-on 192.168.0.0/24 à 192.168.3.0/24 en une seule route ?', r: 'Les 22 premiers bits sont communs : seuls les deux derniers bits du troisième octet changent. La route récapitulative est 192.168.0.0/22, masque 255.255.252.0.' },
    { q: 'Quelle adresse IPv6 un serveur DNS64 fabrique-t-il pour 8.8.8.8 ?', r: 'Le préfixe 64:ff9b::/96 suivi de l’adresse IPv4 en hexadécimal : 8.8.8.8 devient 0808:0808, donc 64:ff9b::808:808.' },
  ],
};
