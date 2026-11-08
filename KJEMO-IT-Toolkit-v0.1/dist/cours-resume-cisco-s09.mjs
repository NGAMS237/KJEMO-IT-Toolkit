/**
 * cours-resume-cisco-s09.mjs — KJEMO-CISCO-S09-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * RÉSUMÉ PLIABLE du cours de la semaine 9 d'« Architecture réseau II » (DHCPv4,
 * IPv6, DHCPv6) : l'essentiel, les schémas, les commandes à retenir, les pièges
 * et des questions à réponse cachée, pour se rafraîchir la mémoire avant un
 * examen. Écrit dans nos mots à partir des trois diapositives et des énoncés
 * du formatif 8 ; les diapositives ne sont pas republiées (schémas originaux
 * dans schemas-cisco-s09.mjs). Les exemples sont à lire, pas à exécuter : les
 * fiches du catalogue donnent les mêmes commandes avec des paramètres validés.
 */
export const RESUME_S09 = {
  titre: 'Résumé du cours — Semaine 9 : DHCPv4, IPv6 et DHCPv6',
  intro: 'À relire avant un examen ou un laboratoire : DORA et le relais DHCPv4, la structure d’une adresse IPv6, les routes statiques IPv6, puis SLAAC, DHCPv6 sans état et avec état.',
  essentiel: [
    'Un poste obtient son adresse IPv4 par DHCP en quatre échanges (Discover, Offer, Request, Acknowledge) ; le bail doit être renouvelé avant son expiration.',
    'Un routeur Cisco peut faire office de serveur DHCPv4 : on exclut d’abord les adresses fixes, puis on crée un pool (réseau, passerelle, DNS, domaine).',
    'Les demandes DHCP sont des diffusions : pour joindre un serveur sur un autre réseau, on met « ip helper-address » sur l’interface côté postes.',
    'Une adresse IPv6 fait 128 bits (8 groupes de 4 chiffres hexadécimaux) ; on abrège en supprimant les zéros de tête et en remplaçant UNE suite de groupes à zéro par « :: ».',
    'Chaque interface IPv6 a une adresse link-local (FE80::/10), utilisée comme passerelle des postes ; l’adresse globale unicast sort de 2000::/3.',
    'Le routage IPv6 n’est pas actif par défaut : « ipv6 unicast-routing » est nécessaire pour transférer les paquets ET pour envoyer des annonces de routeur.',
    'Trois façons d’obtenir une adresse globale : SLAAC (le poste la fabrique), DHCPv6 sans état (SLAAC plus DNS par DHCPv6) et DHCPv6 avec état (le serveur donne tout). Les indicateurs A, O et M des annonces de routeur le suggèrent au poste.',
  ],
  sections: [
    {
      id: 'dhcp4-principe', titre: 'DHCPv4 : DORA et bail', schemas: ['dhcp4-dora'],
      points: [
        'DHCPDISCOVER (diffusion) cherche un serveur ; DHCPOFFER propose une adresse libre ; DHCPREQUEST (diffusion) accepte l’offre et informe les autres serveurs ; DHCPACK (monodiffusion) confirme le bail.',
        'Avant la fin du bail, le client envoie un DHCPREQUEST directement au serveur qui l’a accordé ; sans réponse, il rediffuse pour qu’un autre serveur renouvelle.',
        'Avant de confirmer, le serveur vérifie avec un ping que l’adresse n’est pas déjà utilisée.',
        'Dans le message DHCP, le code OP vaut 1 pour une requête et 2 pour une réponse ; le serveur écrit l’adresse prêtée dans « Votre adresse IP » et s’identifie avec l’option Server Identifier.',
      ],
    },
    {
      id: 'dhcp4-config', titre: 'DHCPv4 sur un routeur : trois étapes',
      points: [
        'Étape 1 : exclure les adresses fixes (« ip dhcp excluded-address début fin ») pour éviter les doublons.',
        'Étape 2 : créer le pool (« ip dhcp pool NOM ») avec « network », « default-router », « dns-server » et « domain-name ». Le nom est sensible à la casse.',
        'Étape 3 : tâches spécifiques facultatives (autres options, durée du bail).',
        'Vérifier : « show running-config | section dhcp », « show ip dhcp binding » et « show ip dhcp server statistics ».',
        'Un routeur peut aussi être CLIENT DHCP : « ip address dhcp » sur l’interface, puis « no shutdown ».',
      ],
    },
    {
      id: 'dhcp4-relais', titre: 'Relais DHCPv4', schemas: ['dhcp4-relais'],
      points: [
        'Un serveur DHCP par réseau coûte cher à gérer ; on préfère un seul serveur et un relais sur chaque routeur.',
        '« ip helper-address » va sur l’interface qui reçoit les demandes des postes, pas sur celle qui mène au serveur.',
        'Par défaut, la commande fait suivre huit services UDP : heure (37), TACACS (49), DNS (53), DHCP/BOOTP (67 et 68), TFTP (69) et NetBIOS (137 et 138).',
      ],
    },
    {
      id: 'dhcp4-depannage', titre: 'Dépanner DHCPv4',
      points: [
        'Ordre : lien physique et interface, port du commutateur, relais, service DHCP, puis pool et baux.',
        'Un poste qui garde une adresse expirée peut créer un conflit si le serveur l’a redonnée à un autre.',
        '« no service dhcp » coupe serveur ET relais : à chercher dans la configuration.',
        'Une liste d’accès étendue (UDP 67 et 68) avec « debug ip packet » isole les messages DHCP ; une demande porte la source 0.0.0.0 et la destination 255.255.255.255. « debug ip dhcp server events » montre les attributions.',
        'Toujours terminer par « undebug all ».',
      ],
    },
    {
      id: 'ipv6-adresses', titre: 'Adresses IPv6 : écriture et types', schemas: ['ipv6-adresse', 'ipv6-types'],
      points: [
        'Un groupe de 16 bits s’appelle un « hextet ». Format préféré : x:x:x:x:x:x:x:x.',
        'Règle 1 : on retire les zéros de tête d’un groupe (0DB8 devient DB8) ; Règle 2 : « :: » remplace une seule suite de groupes à zéro.',
        'Le préfixe habituel d’un réseau local est /64 : 64 bits de réseau et 64 bits d’identifiant d’interface.',
        'Unicast (une interface), multidiffusion (plusieurs destinations : FF02::1 tous les nœuds, FF02::2 tous les routeurs) et anycast (le plus proche). IPv6 n’a pas de diffusion.',
        'Une adresse d’hôte tout à zéro est réservée comme anycast de routeur de sous-réseau ; tout à un est permise, car il n’y a pas de diffusion.',
        'Sous-réseaux IPv6 : on compte en hexadécimal dans l’ID de sous-réseau ; pas de conversion binaire, et on ne redécoupe pas un lien WAN.',
      ],
    },
    {
      id: 'ipv6-config', titre: 'Configurer et vérifier IPv6 sur un routeur',
      points: [
        '« ipv6 unicast-routing » en configuration globale, puis « ipv6 address adresse/préfixe » et « no shutdown » sur chaque interface.',
        'Adresse link-local statique : « ipv6 address FE80::1 link-local » ; FE80::1 peut se répéter sur chaque interface, car elle n’a besoin d’être unique que sur son lien.',
        'Une adresse globale génère automatiquement une adresse link-local si on n’en écrit pas.',
        'Vérifier : « show ipv6 interface brief », « show ipv6 route », « ping adresse ». Sur un poste Windows : « ipconfig ».',
      ],
    },
    {
      id: 'ipv6-routes', titre: 'Routes statiques IPv6', schemas: ['ipv6-routes-statiques'],
      points: [
        'La commande est « ipv6 route préfixe/longueur routeur-suivant ou interface [distance] ».',
        'Récursive : par l’adresse du routeur suivant ; connectée directement : par l’interface ; entièrement spécifiée : interface ET routeur suivant ; par défaut : « ipv6 route ::/0 … » ; flottante : même route avec une distance plus grande (5 dans l’exemple).',
        'Il faut une route à l’aller et au retour pour chaque réseau distant.',
        'Dans « show ipv6 route » : C connecté, L adresse locale (/128), S statique, S* statique par défaut.',
      ],
    },
    {
      id: 'ipv6-eui64', titre: 'SLAAC et identifiant d’interface', schemas: ['ipv6-eui64', 'dhcp6-ra-flags'],
      points: [
        'SLAAC : le routeur annonce préfixe, longueur et passerelle par des messages RA ICMPv6 envoyés depuis son adresse link-local ; le poste fabrique son identifiant d’interface.',
        'EUI-64 : couper l’adresse MAC en deux, insérer FFFE, inverser le 7e bit du premier octet. On reconnaît un EUI-64 à FFFE au milieu.',
        'Windows (depuis Vista) utilise un identifiant aléatoire au lieu d’un EUI-64.',
        'Un routeur n’est un « routeur IPv6 » que s’il transfère les paquets IPv6, peut avoir des routes IPv6 et envoie des RA.',
        'Indicateurs des RA : A (adresse par SLAAC), O (autres informations par DHCPv6 sans état), M (adresse par DHCPv6 avec état). Le poste suit la suggestion, mais décide en dernier.',
      ],
    },
    {
      id: 'dhcp6', titre: 'DHCPv6 : sans état, avec état et relais', schemas: ['dhcp6-qui-donne-quoi', 'dhcp6-relais'],
      points: [
        'Sans état : « ipv6 dhcp pool », « dns-server », « domain-name », puis sur l’interface « ipv6 nd other-config-flag » et « ipv6 dhcp server NOM ». L’adresse vient de SLAAC.',
        'Avec état : le pool contient « address prefix préfixe/longueur [lifetime …] » ; sur l’interface, « ipv6 dhcp server NOM » et « ipv6 nd managed-config-flag » (M passe de 0 à 1).',
        'Relais : « ipv6 dhcp relay destination adresse [interface] » sur l’interface côté client ; l’interface de sortie n’est requise que pour une adresse link-local.',
        'Vérifier : « show ipv6 dhcp pool », « show ipv6 dhcp binding », « show ipv6 interface » sur un routeur client et « ipconfig /all » sur un poste Windows.',
      ],
    },
  ],
  commandes: [
    { cmd: 'ip dhcp excluded-address 192.168.10.1 192.168.10.10', sert: 'Réserver une plage d’adresses fixes : elles ne seront pas prêtées.' },
    { cmd: 'ip dhcp pool LAN-POOL-1', sert: 'Créer un pool DHCPv4 et entrer dans sa configuration (network, default-router, dns-server, domain-name).' },
    { cmd: 'ip helper-address 192.168.11.6', sert: 'Sur l’interface côté postes : relayer le DHCP (et sept autres services UDP) vers ce serveur.' },
    { cmd: 'ip address dhcp', sert: 'Sur une interface de routeur : demander son adresse IPv4 à un serveur DHCP.' },
    { cmd: 'show ip dhcp binding', sert: 'Lister les baux accordés (adresse, client, type).' },
    { cmd: 'ipv6 unicast-routing', sert: 'Activer le routage IPv6 et l’envoi des annonces de routeur.' },
    { cmd: 'ipv6 address 2001:db8:acad:1::1/64', sert: 'Poser l’adresse globale d’une interface.' },
    { cmd: 'ipv6 address FE80::1 link-local', sert: 'Fixer l’adresse link-local d’une interface.' },
    { cmd: 'ipv6 route 2001:db8:1:2::/64 2001:db8:1:a001::2', sert: 'Route statique récursive vers un réseau distant.' },
    { cmd: 'ipv6 route ::/0 2001:db8:acad:4::2', sert: 'Route par défaut IPv6 ; avec une distance plus grande à la fin, route flottante de secours.' },
    { cmd: 'ipv6 nd other-config-flag', sert: 'Lever l’indicateur O : DHCPv6 sans état.' },
    { cmd: 'ipv6 nd managed-config-flag', sert: 'Lever l’indicateur M : DHCPv6 avec état.' },
    { cmd: 'ipv6 dhcp server IPV6-STATELESS', sert: 'Lier un pool DHCPv6 à l’interface.' },
    { cmd: 'ipv6 dhcp relay destination 2001:db8:acad:1::2 G0/0/0', sert: 'Relayer les demandes DHCPv6 vers un serveur éloigné.' },
    { cmd: 'show ipv6 interface brief', sert: 'Lire l’état et les adresses IPv6 des interfaces.' },
    { cmd: 'show ipv6 dhcp binding', sert: 'Lister les clients DHCPv6 avec leur adresse.' },
  ],
  pieges: [
    'Oublier « ipv6 unicast-routing » : le routeur n’envoie pas d’annonces et SLAAC ne marche pas.',
    'Mettre « ip helper-address » sur l’interface côté serveur au lieu de l’interface côté postes.',
    'Oublier d’exclure les adresses fixes (interface du routeur, serveurs) : deux machines finissent avec la même adresse.',
    'Écrire deux « :: » dans la même adresse IPv6, ou supprimer des zéros de FIN de groupe (seuls les zéros de tête se suppriment).',
    'Donner aux postes la passerelle globale au lieu de l’adresse link-local du routeur.',
    'N’écrire la route statique IPv6 que dans un sens : le ping part mais la réponse ne revient pas.',
    'Confondre sans état (indicateur O, adresse par SLAAC) et avec état (indicateur M, adresse par le serveur).',
    'Laisser un débogage actif : il inonde la console ; toujours « undebug all ».',
  ],
  questions: [
    { q: 'Pourquoi un poste ne reçoit-il pas d’adresse quand le serveur DHCP est sur un autre réseau ?', r: 'La demande est une diffusion et le routeur ne la transmet pas. On configure « ip helper-address » avec l’adresse du serveur sur l’interface côté postes : le routeur transforme la diffusion en monodiffusion.' },
    { q: 'Quels sont les quatre messages DHCPv4 et lesquels sont des diffusions ?', r: 'DHCPDISCOVER et DHCPREQUEST sont des diffusions envoyées par le poste ; DHCPOFFER et DHCPACK viennent du serveur (le DHCPACK est en monodiffusion).' },
    { q: 'Écris 2001:0DB8:0000:0000:0000:0000:0000:0001 en abrégé.', r: '2001:DB8::1 : on retire le zéro de tête de 0DB8 et de 0001, puis une seule fois « :: » remplace les cinq groupes à zéro consécutifs.' },
    { q: 'Calcule l’identifiant EUI-64 pour l’adresse MAC 00-50-56-83-63-6D.', r: '0250:56FF:FE83:636D : on coupe en 00-50-56 et 83-63-6D, on insère FFFE entre les deux, puis on inverse le 7e bit du premier octet (00 devient 02).' },
    { q: 'Quelle commande lève l’indicateur O ? Et l’indicateur M ?', r: '« ipv6 nd other-config-flag » pour O (DHCPv6 sans état) et « ipv6 nd managed-config-flag » pour M (DHCPv6 avec état), toutes deux sur l’interface côté postes.' },
    { q: 'Quelle différence entre DHCPv6 sans état et avec état ?', r: 'Sans état : l’adresse vient de SLAAC et le serveur ne donne que le DNS et le domaine, sans garder de bail. Avec état : le serveur donne l’adresse complète en plus et garde la liste des baux.' },
    { q: 'Quelles sont les trois formes d’une route statique IPv6, et laquelle faut-il pour un saut link-local ?', r: 'Récursive (adresse du routeur suivant), connectée directement (interface de sortie) et entièrement spécifiée (interface et routeur suivant). Pour un saut link-local, il faut la forme entièrement spécifiée, car cette adresse n’a de sens que sur une interface.' },
  ],
};
