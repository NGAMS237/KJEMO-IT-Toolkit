/**
 * cours-fiches-cisco-show.mjs — KJEMO-CISCO-SHOW-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * UNE fiche de référence : les commandes « show » les plus utiles sur un
 * commutateur ou un routeur Cisco IOS, rangées par groupe (identité,
 * configuration, interfaces, VLAN, Spanning Tree, EtherChannel, routage, DHCP,
 * NAT, sécurité, diagnostic). Chaque commande est expliquée dans le dépliant
 * « Comprendre les commandes ». Toutes les étapes sont en LECTURE : rien ne
 * change sur l'équipement. Rédigée à la main, dans nos mots.
 *
 * Selon le modèle et la version d'IOS (et dans Packet Tracer), certaines sorties
 * diffèrent ou certaines commandes n'existent pas : le message « Invalid input »
 * veut alors dire que l'équipement ne la connaît pas, pas que tu as fait une
 * erreur de configuration. Les commandes ne sont jamais exécutées par le
 * Toolkit : rien n'a été essayé sur du matériel réel ni dans Packet Tracer.
 */
import { V_COURS } from './cours-outils.mjs';

const CISCO = 'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios';
const SRC_REF = { label: 'Cisco IOS — Configuration Fundamentals Command Reference (show)', url: `${CISCO}/fundamentals/command/cf_command_ref.html` };
const SRC_FILTRE = { label: 'Cisco IOS — Configuration Fundamentals : filtrer la sortie d’une commande show', url: `${CISCO}/fundamentals/configuration/xe-16/fundamentals-xe-16-book/cf-cli-basics.html` };

const V_CISCO = `${V_COURS} Les sorties dépendent du modèle et de la version d’IOS ; rien n’a été essayé dans Packet Tracer ni sur du matériel réel.`;

const priv = (cmd) => ({ invite: 'Device#', cmd });

/** [titre, explication, attendu, [[commande, à quoi elle sert], …]] */
const GROUPES = [
  ['Identifier l’équipement', 'Pour savoir à quel équipement tu parles : modèle, version d’IOS, depuis quand il tourne, qui est connecté.',
    'Le modèle, la version d’IOS, la durée de fonctionnement et la liste des sessions ouvertes.', [
      ['show version', 'Modèle, version d’IOS, mémoire, temps depuis le dernier démarrage et registre de configuration.'],
      ['show inventory', 'Numéros de série et modules installés (absent sur certains équipements virtuels).'],
      ['show flash:', 'Les fichiers de la mémoire flash, dont l’image du système (IOS).'],
      ['show clock', 'La date et l’heure de l’équipement (utile pour lire les journaux).'],
      ['show users', 'Qui est connecté en ce moment (console, lignes vty), et depuis où.'],
      ['show history', 'Les dernières commandes que tu as tapées dans cette session.'],
    ]],
  ['Lire la configuration', 'Pour relire ce qui est réglé. Les filtres après le « | » évitent de faire défiler tout le fichier.',
    'La configuration active, ou seulement les blocs ou lignes demandés.', [
      ['show running-config', 'La configuration ACTIVE (en mémoire vive) : ce qui s’applique maintenant, perdu au redémarrage si elle n’est pas enregistrée.'],
      ['show startup-config', 'La configuration ENREGISTRÉE (NVRAM) : celle que l’équipement retrouve au démarrage.'],
      ['show running-config | section interface', 'Seulement les blocs « interface » de la configuration active.'],
      ['show running-config | include ip route', 'Seulement les lignes qui contiennent « ip route » (remplace par le mot cherché).'],
      ['show running-config | begin line vty', 'Affiche la configuration à partir de la première ligne « line vty ».'],
    ]],
  ['Interfaces : état et adresses', 'Le premier réflexe quand « ça ne marche pas » : l’interface est-elle allumée (up) et a-t-elle la bonne adresse ?',
    'Un tableau par interface avec l’adresse, l’état physique (Status) et l’état du protocole (Protocol).', [
      ['show ip interface brief', 'Le tableau le plus utile : une ligne par interface avec son adresse IPv4 et ses états « up » ou « down ».'],
      ['show interfaces status', 'Commutateur : état, VLAN, duplex, vitesse et type de chaque port (repère « err-disabled »).'],
      ['show interfaces', 'Détail de toutes les interfaces : adresse MAC, débit, erreurs, collisions.'],
      ['show interfaces description', 'Les descriptions posées sur les interfaces, avec leur état.'],
      ['show ip interface', 'Détail IPv4 par interface, dont la liste d’accès appliquée.'],
      ['show ipv6 interface brief', 'Comme « show ip interface brief », mais pour les adresses IPv6 (globale et link-local).'],
    ]],
  ['Table MAC, ARP et voisins', 'Pour retrouver où est branchée une machine et qui est connecté à côté.',
    'Des adresses MAC avec le port et le VLAN, des adresses IP avec leur MAC, ou la liste des voisins directs.', [
      ['show mac address-table', 'Commutateur : quelle adresse MAC est apprise sur quel port et dans quel VLAN.'],
      ['show mac address-table dynamic', 'Seulement les adresses apprises automatiquement (sans les statiques).'],
      ['show ip arp', 'Routeur : la correspondance adresse IP ↔ adresse MAC des machines récemment jointes.'],
      ['show cdp neighbors', 'Les équipements Cisco branchés directement (nom, port local, port distant).'],
      ['show cdp neighbors detail', 'Comme la commande précédente, avec l’adresse IP et la version d’IOS du voisin.'],
      ['show lldp neighbors', 'Les voisins directs selon LLDP, le protocole d’autres fabricants (à activer d’abord).'],
    ]],
  ['VLAN, trunks, VTP et DTP', 'Pour vérifier quels VLAN existent, quels ports sont des trunks et comment VTP et DTP négocient.',
    'La liste des VLAN avec leurs ports, les trunks avec les VLAN autorisés, et l’état de VTP.', [
      ['show vlan brief', 'Les VLAN et les ports d’accès qui leur appartiennent (les ports trunk n’y figurent pas).'],
      ['show interfaces trunk', 'Les ports en trunk, leur VLAN natif, les VLAN autorisés et ceux réellement actifs.'],
      ['show vtp status', 'Mode VTP (serveur, client, transparent), domaine et numéro de révision.'],
      ['show dtp', 'L’état de la négociation DTP sur le commutateur.'],
    ]],
  ['Spanning Tree', 'Pour savoir qui est le pont racine et quels ports sont bloqués pour éviter les boucles.',
    'Le pont racine, le rôle (racine, désigné, alternatif) et l’état (transmission, blocage) de chaque port.', [
      ['show spanning-tree', 'Pour chaque VLAN : le pont racine, ce commutateur et le rôle et l’état de chaque port.'],
      ['show spanning-tree summary', 'Résumé : mode (PVST, Rapid PVST) et nombre de ports dans chaque état.'],
      ['show spanning-tree root', 'Qui est la racine de chaque VLAN et à quel coût.'],
      ['show spanning-tree blockedports', 'Seulement les ports bloqués par Spanning Tree.'],
    ]],
  ['EtherChannel', 'Pour vérifier qu’un groupe de liens agrégés est formé et quels ports en font partie.',
    'Chaque port-channel avec son protocole et ses ports, marqués (P) quand ils sont regroupés.', [
      ['show etherchannel summary', 'Le tableau de référence : groupes, protocole (PAgP, LACP ou statique) et ports (P = regroupé, D = hors service).'],
      ['show etherchannel detail', 'Détail de chaque groupe et de chaque port membre.'],
      ['show etherchannel port-channel', 'Détail des interfaces port-channel (durée de vie, ports actifs).'],
      ['show pagp neighbor', 'Les voisins PAgP (propriétaire Cisco).'],
      ['show lacp neighbor', 'Les voisins LACP (norme 802.3ad).'],
    ]],
  ['Sécurité des ports', 'Pour voir si un port est verrouillé, quelles adresses sont autorisées et quels ports sont tombés en err-disabled.',
    'Le maximum d’adresses, le nombre de violations, la sanction et les ports bloqués.', [
      ['show port-security', 'Pour chaque port sécurisé : maximum, adresses apprises, violations et sanction.'],
      ['show port-security address', 'Les adresses MAC autorisées (sticky ou statiques) et leur port.'],
      ['show interfaces status err-disabled', 'Seulement les ports mis hors service par une violation ou une erreur.'],
      ['show errdisable recovery', 'Si la remise en service automatique est active et après combien de temps.'],
    ]],
  ['Routage IPv4', 'Pour savoir par où le routeur envoie un paquet et quels protocoles tournent.',
    'La table de routage avec un code par origine (C connecté, S statique, R RIP, S* route par défaut).', [
      ['show ip route', 'La table de routage complète, avec le code de chaque route et son saut suivant.'],
      ['show ip route connected', 'Seulement les réseaux directement connectés (codes C et L).'],
      ['show ip route static', 'Seulement les routes statiques (code S).'],
      ['show ip route rip', 'Seulement les routes apprises par RIP (code R) avec leur distance et leur métrique.'],
      ['show ip protocols', 'Les protocoles de routage actifs, les réseaux annoncés et les voisins.'],
      ['show ip rip database', 'Les routes que RIP connaît, y compris celles résumées.'],
    ]],
  ['Routage et voisins IPv6', 'Les équivalents IPv6 : table de routage, voisins et protocoles.',
    'La table de routage IPv6 et les voisins découverts.', [
      ['show ipv6 route', 'La table de routage IPv6 (codes C, L, S, …).'],
      ['show ipv6 route static', 'Seulement les routes statiques IPv6.'],
      ['show ipv6 neighbors', 'L’équivalent d’ARP en IPv6 : adresses IPv6 et MAC des voisins.'],
      ['show ipv6 protocols', 'Les protocoles de routage IPv6 actifs.'],
    ]],
  ['DHCP', 'Pour savoir qui a reçu une adresse, quel pool est utilisé et s’il y a des conflits.',
    'Les baux accordés, l’état du pool et les adresses en conflit.', [
      ['show ip dhcp binding', 'Les baux DHCPv4 accordés : adresse, client et date d’expiration.'],
      ['show ip dhcp pool', 'L’état de chaque pool : plage, adresses prêtées et restantes.'],
      ['show ip dhcp conflict', 'Les adresses retirées du pool parce qu’une autre machine les utilisait déjà.'],
      ['show ip dhcp server statistics', 'Compteurs de messages DHCP (Discover, Offer, Request, Ack).'],
      ['show ipv6 dhcp pool', 'Les pools DHCPv6 et leurs options.'],
      ['show ipv6 dhcp binding', 'Les clients DHCPv6 avec leur adresse (DHCPv6 avec état).'],
    ]],
  ['NAT et PAT', 'Pour voir quelles adresses sont traduites et si les règles reçoivent du trafic.',
    'Les traductions en cours (adresse privée ↔ publique) et les compteurs.', [
      ['show ip nat translations', 'La table de traduction : inside local, inside global, outside global, avec les ports du PAT.'],
      ['show ip nat statistics', 'Les interfaces inside et outside, le nombre de traductions et les compteurs « hits » et « misses ».'],
    ]],
  ['Accès à distance et listes d’accès', 'Pour vérifier SSH, les lignes d’accès et les listes de contrôle d’accès.',
    'La version de SSH et les sessions, les lignes configurées et les listes d’accès avec leurs compteurs.', [
      ['show ip ssh', 'SSH est-il actif, en quelle version, et avec quels délais.'],
      ['show ssh', 'Les sessions SSH ouvertes en ce moment.'],
      ['show line', 'Les lignes console, auxiliaire et vty avec leur état.'],
      ['show access-lists', 'Les listes d’accès et le nombre de paquets qui ont correspondu à chaque règle.'],
    ]],
  ['Santé et journaux', 'Pour comprendre une panne ou une lenteur : messages récents, charge du processeur et mémoire.',
    'Les messages d’événements récents et des pourcentages de charge.', [
      ['show logging', 'Le journal des messages (liens qui tombent, erreurs) et le niveau enregistré.'],
      ['show processes cpu', 'La charge du processeur sur 5 secondes, 1 minute et 5 minutes.'],
      ['show memory statistics', 'La mémoire utilisée et libre.'],
      ['show debugging', 'Les débogages actifs : à contrôler après un test pour ne pas inonder la console.'],
    ]],
  ['Filtrer et lire plus vite', 'Ces astuces s’ajoutent à n’importe quel « show » pour ne garder que l’utile.',
    'Seulement les lignes demandées, sans pause « --More-- ».', [
      ['show ip interface brief | include up', 'Ne garde que les lignes qui contiennent « up » (include = contient).'],
      ['show running-config | exclude !', 'Retire les lignes de séparation « ! » pour raccourcir la sortie (exclude = ne contient pas).'],
      ['show ip route | include ^S', 'Ne garde que les lignes qui COMMENCENT par S, soit les routes statiques (^ = début de ligne).'],
      ['terminal length 0', 'Supprime la pause « --More-- » pour la session en cours (ne change pas la configuration).'],
    ]],
];

const etape = (titre, explication, attendu, lignes, extra = {}) => ({
  titre, effet: 'lecture', explication, lignes: lignes.map(([cmd]) => priv(cmd)), attendu,
  options: lignes.map(([cmd, sert]) => ({ option: cmd.replace('{{interface}}', 'INTERFACE').replace('{{vlan}}', 'VLAN'), explication: sert })), ...extra,
});

const CIBLE = etape('Cibler une interface ou un VLAN précis',
  'Quand le tableau d’ensemble ne suffit plus, on regarde UNE interface ou UN VLAN. Choisis-les dans les cases : ces cinq commandes sont les seules de la fiche qui en ont besoin.',
  'Le détail d’une interface, sa configuration, son mode (accès ou trunk), sa sécurité de port, puis un VLAN et son arbre Spanning Tree.',
  [
    ['show interfaces {{interface}}', 'Le détail d’une interface : état, débit, erreurs, adresse MAC et compteurs.'],
    ['show interfaces {{interface}} switchport', 'Commutateur : mode administratif et réel (accès ou trunk), VLAN d’accès, VLAN natif et VLAN autorisés.'],
    ['show running-config interface {{interface}}', 'Seulement les lignes de configuration de cette interface.'],
    ['show port-security interface {{interface}}', 'La sécurité de ce port : maximum, adresses, violations et sanction.'],
    ['show vlan id {{vlan}}', 'Un VLAN précis : son nom, son état et ses ports.'],
    ['show spanning-tree vlan {{vlan}}', 'L’arbre Spanning Tree d’un VLAN : racine, rôles et états des ports.'],
  ]);

export const COURS_CISCO_SHOW = [{
  id: 'cours-show-cisco',
  titre: 'Commandes show Cisco : toutes les lectures utiles, par groupe',
  categorie: 'Réseau et Cisco',
  resume: 'La fiche de référence : les commandes « show » les plus utiles d’un commutateur ou d’un routeur, rangées par groupe (interfaces, VLAN, routage, DHCP, NAT…), avec ce que chacune montre.',
  effet: 'lecture',
  intentions: ['commandes show cisco', 'toutes les commandes show', 'aide-mémoire show', 'liste des show', 'show utiles cisco', 'quelle commande show', 'commande pour voir', 'comment vérifier cisco', 'show ip interface brief', 'show running-config', 'show ip route', 'show vlan brief'],
  motsCles: ['show', 'afficher', 'voir', 'vérifier', 'lire', 'état', 'cisco', 'ios', 'commutateur', 'routeur', 'référence', 'aide-mémoire',
    'show version', 'show interfaces', 'show mac address-table', 'show cdp neighbors', 'show spanning-tree', 'show etherchannel summary', 'show port-security', 'show ip route', 'show ip protocols', 'show ip dhcp binding', 'show ip nat translations', 'show ip ssh', 'show logging', 'show arp', 'show vtp status', 'show interfaces trunk'],
  params: [
    { id: 'interface', label: 'interface à inspecter', type: 'interfaceIos', exemple: 'Gi0/1', aide: 'Le port ou l’interface visé : Gi0/1 (commutateur ou routeur), Fa0/24, Se0/0/0. Utilisé seulement par la dernière étape.' },
    { id: 'vlan', label: 'VLAN à inspecter', type: 'vlan', exemple: '10', aide: 'Le numéro du VLAN visé (1 à 4094). Utilisé seulement par la dernière étape.' },
  ],
  methodes: [{
    id: 'ios',
    privileges: 'Mode privilégié (enable). Les commandes « show » ne modifient rien sur l’équipement.',
    etapes: [...GROUPES.map(([t, e, a, l]) => etape(t, e, a, l)), CIBLE],
    verification: ['Tu sais quelle commande donne quoi : « show ip interface brief » pour l’état des interfaces, « show running-config » pour la configuration, « show ip route » pour les routes, et le groupe correspondant pour le reste.'],
    retour: null,
    depannage: [
      { symptome: 'Message « Invalid input detected » ou « Incomplete command »', cause: 'La commande n’existe pas sur ce modèle ou cette version d’IOS (par exemple une commande de commutateur tapée sur un routeur), ou elle est incomplète.', action: 'Vérifie le groupe (commutateur ou routeur) et ajoute l’argument manquant ; le « ? » à la fin d’une commande liste la suite possible.' },
      { symptome: 'La sortie s’arrête sur « --More-- »', cause: 'IOS affiche l’écran par écran.', action: 'Espace pour la page suivante, Entrée pour une ligne, q pour quitter ; ou « terminal length 0 » pour désactiver la pause.' },
    ],
  }],
  assistant: null,
  sources: [SRC_REF, SRC_FILTRE],
  validation: V_CISCO,
  origine: 'cours',
  rappel: { titre: 'Rappel : les cinq « show » à connaître par cœur', points: ['show ip interface brief : l’état et l’adresse de chaque interface.', 'show running-config : ce qui est configuré maintenant.', 'show ip route : par où part chaque paquet.', 'show vlan brief et show interfaces trunk : VLAN et trunks.', 'show cdp neighbors : qui est branché à côté.'] },
}];
