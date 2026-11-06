/**
 * cours-fiches-cisco-s09.mjs — KJEMO-CISCO-S09-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiches Cisco IOS tirées de la semaine 9 d'« Architecture réseau II »
 * (420-FBL-LI) : DHCPv4 sur routeur (serveur, relais, client, dépannage),
 * adressage et routes statiques IPv6, SLAAC, DHCPv6 sans état et avec état,
 * relais DHCPv6 et vérifications.
 *
 * Rédigées à la main, dans nos mots : ni les diapositives ni les énoncés des
 * formatifs ne sont republiés. Les commandes viennent des diapositives, des
 * énoncés Packet Tracer / Lab et de leurs solutions. Quand un document se
 * contredit, la fiche suit l'étape écrite et le dit (voir le cours).
 * Les commandes ne sont jamais exécutées par le Toolkit : rien n'a été essayé
 * sur du matériel réel ni dans Packet Tracer.
 */
import { V_COURS } from './cours-outils.mjs';

const CISCO = 'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios';
const SRC_DHCP4 = { label: 'Cisco IOS — Configuring the Cisco IOS DHCP Server', url: `${CISCO}/ipaddr_dhcp/configuration/xe-16/dhcp-xe-16-book/config-dhcp-server.html` };
const SRC_RELAIS = { label: 'Cisco IOS — Configuring the Cisco IOS DHCP Relay Agent', url: `${CISCO}/ipaddr_dhcp/configuration/xe-16/dhcp-xe-16-book/dhcp-relay-agent.html` };
const SRC_CLIENT = { label: 'Cisco IOS — Configuring the Cisco IOS DHCP Client', url: `${CISCO}/ipaddr_dhcp/configuration/xe-16/dhcp-xe-16-book/config-dhcp-client.html` };
const SRC_V6 = { label: 'Cisco IOS — IPv6 Addressing and Basic Connectivity', url: `${CISCO}/ipv6_basic/configuration/xe-16/ip6b-xe-16-book/ip6-addrg-bsc-con-xe.html` };
const SRC_V6ROUTE = { label: 'Cisco IOS — Implementing Static Routes for IPv6', url: `${CISCO}/ipv6_basic/configuration/xe-16/ip6b-xe-16-book/ip6-staticrt-xe.html` };
const SRC_DHCP6 = { label: 'Cisco IOS — Implementing DHCP for IPv6', url: `${CISCO}/ipv6_basic/configuration/xe-16/ip6b-xe-16-book/ip6-dhcp-xe.html` };

const CATEGORIE = 'Réseau et Cisco';
const V_CISCO = `${V_COURS} Les sorties montrées sont des exemples écrits pour expliquer, pas des captures d’équipement ; rien n’a été essayé dans Packet Tracer.`;

const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const priv = L('Router#');
const cfg = L('Router(config)#');
const itf = L('Router(config-if)#');
const dh4 = L('Router(dhcp-config)#');
const dh6 = L('Router(config-dhcpv6)#');
const poste = (cmd) => ({ invite: 'C:\\>', cmd });

const etape = (effet) => (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');

const ENABLE = 'Mode de configuration globale (enable puis configure terminal).';
const PRIV = 'Mode privilégié (enable).';

const MASQUES = ['255.0.0.0', '255.128.0.0', '255.192.0.0', '255.224.0.0', '255.240.0.0', '255.248.0.0', '255.252.0.0', '255.254.0.0',
  '255.255.0.0', '255.255.128.0', '255.255.192.0', '255.255.224.0', '255.255.240.0', '255.255.248.0', '255.255.252.0', '255.255.254.0',
  '255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.255.248', '255.255.255.252'];
const MASQUE = { id: 'masque', label: 'masque du réseau', type: 'choix', choix: MASQUES, exemple: '255.255.255.0', aide: 'Le masque en notation pointée : /24 = 255.255.255.0, /26 = 255.255.255.192.' };
const POOL = (exemple, aide) => ({ id: 'pool', label: 'nom du pool', type: 'identifiant', exemple, aide: aide ?? 'Lettres, chiffres, « - » ou « _ » ; IOS distingue les majuscules des minuscules, retape le nom exactement pareil à chaque endroit.' });
const DNS4 = { id: 'dns', label: 'adresse du serveur DNS', type: 'ipv4', exemple: '192.168.11.5', aide: 'L’adresse que les postes recevront comme serveur DNS.' };
const DOMAINE = { id: 'domaine', label: 'nom de domaine donné aux clients', type: 'fqdn', exemple: 'example.com', aide: 'Le suffixe DNS que les clients recevront (example.com est un nom réservé aux exemples).' };
const DNS6 = (exemple) => ({ id: 'dns', label: 'adresse IPv6 du serveur DNS', type: 'ipv6', exemple, aide: 'L’adresse IPv6 du serveur DNS que les clients recevront, écrite sans préfixe.' });
const ITF_ROUTEUR = (exemple, label = 'interface du routeur', aide) => ({ id: 'interface', label, type: 'interfaceRouteur', exemple, aide: aide ?? 'Une interface physique de ROUTEUR : Gi0/0, Gi0/0/1 ou Se0/0/0. Les numéros d’un routeur partent de 0.' });
const GUA = { id: 'adresse', label: 'adresse IPv6 de l’interface avec son préfixe', type: 'cidr6', exemple: '2001:db8:acad:1::1/64', aide: 'Une adresse globale unicast (2000::/3) et son préfixe, en général /64. 2001:db8::/32 est réservé à la documentation : parfait pour un laboratoire.' };
const LIEN = { id: 'lien', label: 'adresse link-local de l’interface', type: 'ipv6', exemple: 'fe80::1', aide: 'Une adresse commençant par FE80, facile à reconnaître (fe80::1 sur le routeur 1). Elle n’a besoin d’être unique que sur le lien.' };

function ficheIos({ id, titre, resume, effet, intentions, motsCles, params = [], privileges, etapes, verification, retour = null, depannage = null, sources, figures = [], rappel = null }) {
  return {
    id,
    titre,
    categorie: CATEGORIE,
    resume,
    effet,
    intentions,
    motsCles,
    params,
    methodes: [{ id: 'ios', privileges, etapes, verification, retour, ...(depannage ? { depannage } : {}) }],
    assistant: null,
    sources,
    validation: V_CISCO,
    origine: 'cours',
    ...(figures.length ? { figures } : {}),
    ...(rappel ? { rappel } : {}),
  };
}

export const COURS_CISCO_S09 = [
  // ===========================================================================
  // DHCPv4 sur un routeur
  // ===========================================================================
  ficheIos({
    id: 'cours-dhcp4-serveur-routeur',
    titre: 'Faire d’un routeur Cisco un serveur DHCPv4 (exclusions et pool)',
    resume: 'Réserve les adresses fixes, crée un pool avec réseau, passerelle, DNS et domaine, puis lit les baux accordés. Pratique pour une petite filiale sans serveur dédié.',
    effet: 'modification',
    intentions: ['serveur dhcp routeur cisco', 'ip dhcp pool', 'ip dhcp excluded-address', 'dhcp sur un routeur', 'distribuer des adresses ip avec un routeur', 'default-router dns-server'],
    motsCles: ['dhcp', 'dhcpv4', 'pool', 'excluded-address', 'default-router', 'dns-server', 'bail', 'cisco', 'routeur'],
    params: [
      { id: 'debut', label: 'première adresse à exclure', type: 'ipv4', exemple: '192.168.10.1', aide: 'Début de la plage réservée aux adresses fixes (interface du routeur, serveurs, imprimantes). Ces adresses ne seront jamais prêtées.' },
      { id: 'fin', label: 'dernière adresse à exclure', type: 'ipv4', exemple: '192.168.10.10', aide: 'Fin de la plage réservée. Pour exclure une seule adresse, on ne tape que la première : voir l’explication de l’étape 1.' },
      POOL('LAN-POOL-1'),
      { id: 'reseau', label: 'adresse du réseau à desservir', type: 'ipv4', exemple: '192.168.10.0', aide: 'L’adresse du RÉSEAU (la première du bloc), pas celle d’un hôte.' },
      MASQUE,
      { id: 'passerelle', label: 'passerelle par défaut donnée aux clients', type: 'ipv4', exemple: '192.168.10.1', aide: 'Normalement l’adresse de l’interface du routeur sur ce réseau.' },
      DNS4,
      DOMAINE,
    ],
    privileges: ENABLE,
    etapes: [
      mod('Exclure les adresses fixes', 'Le serveur prête toute adresse libre du pool, y compris celles déjà données à la main : il faut donc les exclure d’abord. Une plage s’écrit « début fin » ; pour une adresse seule, on écrit uniquement cette adresse (par exemple « ip dhcp excluded-address 192.168.10.254 »).',
        [cfg('ip dhcp excluded-address {{debut}} {{fin}}')], 'Aucun message.'),
      mod('Créer le pool et ses options', 'Le nom du pool est sensible à la casse. « network » fixe le bloc prêté ; « default-router » est la passerelle donnée aux clients ; « dns-server » et « domain-name » sont les options qui complètent l’adressage. Dans Packet Tracer, un serveur DHCP dédié (icône Server) se règle aussi dans l’onglet Services > DHCP, sans ligne de commande.',
        [cfg('ip dhcp pool {{pool}}'), dh4('network {{reseau}} {{masque}}'), dh4('default-router {{passerelle}}'), dh4('dns-server {{dns}}'), dh4('domain-name {{domaine}}'), dh4('exit')], 'L’invite passe à « (dhcp-config)# » puis revient à « (config)# ».'),
      lec('Contrôler la configuration', 'La première commande montre exclusions et pools tels que le routeur les a retenus ; la deuxième liste les baux déjà accordés (vide tant qu’aucun poste n’a demandé d’adresse) ; la troisième donne des compteurs.',
        [priv('show running-config | section dhcp'), priv('show ip dhcp binding'), priv('show ip dhcp server statistics')], 'Les exclusions et le pool apparaissent ; après qu’un poste (réglé sur « Automatique » ou « DHCP ») a demandé une adresse, « binding » montre l’adresse, l’identifiant du client et « Automatic ».'),
    ],
    verification: ['show running-config | section dhcp montre les exclusions et le pool, et show ip dhcp binding liste une adresse du pool pour chaque poste réglé en DHCP.'],
    retour: 'Pour tout retirer : retire d’abord le pool, puis les exclusions (étapes « Annuler » ci-dessous).',
    depannage: [
      { symptome: 'Le poste garde une adresse 169.254.x.x', cause: 'Aucun serveur ne répond : pool absent, interface éteinte, ou serveur sur un autre réseau sans relais.', action: 'Vérifie « show ip interface brief », le nom du pool et le « network » ; si le serveur est ailleurs, voir la fiche du relais DHCPv4.' },
      { symptome: 'Deux machines ont la même adresse', cause: 'Une adresse fixe n’a pas été exclue du pool.', action: 'Ajoute-la dans « ip dhcp excluded-address », puis libère et renouvelle le bail du poste.' },
      { symptome: 'Les postes ont une adresse mais ne sortent pas du réseau', cause: 'La passerelle (default-router) est fausse ou absente.', action: 'Compare « default-router » avec l’adresse de l’interface du routeur.' },
    ],
    sources: [SRC_DHCP4],
    figures: ['dhcp4-dora'],
    rappel: { titre: 'Rappel : DHCPv4', points: ['Le client obtient son adresse en quatre échanges : Discover, Offer, Request, Acknowledge (DORA).', 'Le serveur prête une adresse pour une durée (le bail) ; le client la renouvelle avant la fin du bail.', 'Sans serveur dédié, un routeur Cisco peut jouer le rôle de serveur pour une petite structure.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dhcp4-relais',
    titre: 'Relayer le DHCPv4 vers un autre réseau (ip helper-address)',
    resume: 'Sur l’interface qui regarde les postes, fait suivre leurs diffusions DHCP vers le serveur situé sur un autre réseau.',
    effet: 'modification',
    intentions: ['ip helper-address', 'relais dhcp', 'dhcp relay agent', 'serveur dhcp sur un autre réseau', 'le poste ne reçoit pas d’adresse dhcp', 'agent de relais'],
    motsCles: ['helper-address', 'relais', 'dhcp', 'diffusion', 'broadcast', 'cisco', 'routeur', 'udp 67'],
    params: [
      ITF_ROUTEUR('Gi0/0', 'interface du routeur côté postes', 'L’interface où sont branchés les postes qui demandent une adresse (pas celle qui mène au serveur).'),
      { id: 'serveur', label: 'adresse du serveur DHCP', type: 'ipv4', exemple: '192.168.11.6', aide: 'L’adresse que le routeur doit joindre en monodiffusion : celle du serveur, ou celle de l’interface du routeur-serveur la plus proche.' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Désigner le serveur sur l’interface côté postes', 'Les demandes DHCP sont des DIFFUSIONS : un routeur ne les transmet pas. Avec « ip helper-address », le routeur les reçoit et les renvoie en monodiffusion vers le serveur. La commande va sur l’interface d’où viennent les demandes. Par défaut, elle fait aussi suivre sept autres services UDP (heure, TACACS, DNS, TFTP, deux ports NetBIOS et le DHCP lui-même).',
        [cfg('interface {{interface}}'), itf('ip helper-address {{serveur}}')], 'Aucun message.'),
      lec('Contrôler', 'La configuration de l’interface doit montrer l’adresse d’assistance. Vérifie aussi que « no service dhcp » n’a pas été tapé : cette commande coupe serveur ET relais.',
        [priv('show running-config interface {{interface}}'), priv('show running-config | include no service dhcp')], 'Une ligne « ip helper-address » avec l’adresse du serveur ; la deuxième commande ne renvoie rien.'),
    ],
    verification: ['L’interface côté postes porte « ip helper-address » vers le serveur, « no service dhcp » est absent, et un poste réglé en DHCP reçoit une adresse du bon pool.'],
    retour: 'Pour retirer le relais : « no ip helper-address » sur la même interface (étape « Annuler »).',
    depannage: [
      { symptome: 'Le poste n’obtient toujours rien', cause: 'La commande est sur la mauvaise interface (côté serveur au lieu de côté postes), ou le routeur n’a pas de route vers le serveur.', action: 'Place-la côté postes et teste un ping vers l’adresse du serveur depuis le routeur.' },
      { symptome: 'Le relais marche mais les postes reçoivent un mauvais réseau', cause: 'Le pool du serveur ne correspond pas au réseau des postes : le serveur choisit le pool selon l’adresse de l’interface qui relaie.', action: 'Crée côté serveur un pool dont le « network » contient l’adresse de l’interface de relais.' },
    ],
    sources: [SRC_RELAIS],
    figures: ['dhcp4-relais'],
    rappel: { titre: 'Rappel : relais DHCPv4', points: ['La demande DHCP part en diffusion : elle ne franchit pas un routeur.', 'Plutôt que d’installer un serveur par réseau, on met « ip helper-address » sur l’interface côté postes.', 'Le routeur renvoie la demande en monodiffusion vers le serveur et rapporte la réponse au poste.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dhcp4-client-routeur',
    titre: 'Interface de routeur client DHCP (adresse IPv4 reçue)',
    resume: 'Règle une interface de routeur sur « adresse reçue par DHCP », comme un poste : utile pour le routeur de bordure d’une petite structure qui reçoit son adresse du fournisseur.',
    effet: 'modification',
    intentions: ['ip address dhcp', 'routeur client dhcp', 'interface routeur adresse automatique', 'routeur de bordure adresse du fai', 'obtenir une adresse du fournisseur'],
    motsCles: ['ip address dhcp', 'client dhcp', 'routeur', 'fai', 'isp', 'cisco', 'soho'],
    params: [ITF_ROUTEUR('Gi0/1', 'interface du routeur qui reçoit l’adresse', 'L’interface branchée au réseau du fournisseur (ou du serveur DHCP).')],
    privileges: ENABLE,
    etapes: [
      mod('Demander l’adresse et allumer l’interface', 'Au lieu d’« ip address » suivi d’une adresse fixe, on écrit « ip address dhcp ». L’interface doit être allumée (no shutdown) pour envoyer sa demande. Dans Packet Tracer, le bouton « Fast Forward Time » accélère l’attente.',
        [cfg('interface {{interface}}'), itf('ip address dhcp'), itf('no shutdown')], 'Après quelques secondes, IOS journalise un message « DHCP-6-ADDRESS_ASSIGN » avec l’adresse reçue.'),
      lec('Contrôler l’adresse reçue', 'La première commande liste l’adresse de chaque interface ; la mention « DHCP » dans la colonne Method confirme l’origine. La deuxième montre le détail pour cette interface.',
        [priv('show ip interface brief'), priv('show ip interface {{interface}}')], 'L’interface est « up/up » avec une adresse, « Address determined by DHCP » dans le détail.'),
    ],
    verification: ['show ip interface brief affiche une adresse sur l’interface avec la méthode DHCP, et un ping vers la passerelle du fournisseur répond.'],
    retour: 'Pour revenir à une adresse fixe : « no ip address dhcp », puis « ip address » avec la nouvelle adresse (étape « Annuler »).',
    depannage: [
      { symptome: 'L’adresse reste « unassigned »', cause: 'Interface éteinte, câble absent ou aucun serveur DHCP de l’autre côté.', action: 'Vérifie « show ip interface brief » (up/up) et que l’autre routeur a bien un pool pour ce lien.' },
    ],
    sources: [SRC_CLIENT],
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dhcp4-depanner',
    titre: 'Dépanner DHCPv4 sur un routeur : interface, relais, baux et débogage',
    resume: 'Parcourt dans l’ordre les causes d’un poste sans adresse : interface, relais, service DHCP, baux et conflits, puis débogage ciblé des messages DHCP.',
    effet: 'modification',
    intentions: ['dépanner dhcp', 'conflit d’adresses dhcp', 'show ip dhcp conflict', 'debug ip dhcp server events', 'no service dhcp', 'le poste ne reçoit pas d’adresse'],
    motsCles: ['dépannage', 'dhcp', 'conflit', 'debug', 'binding', 'helper-address', 'udp 67', 'cisco'],
    params: [ITF_ROUTEUR('Gi0/0', 'interface du routeur côté postes', 'L’interface qui sert de passerelle aux postes en panne.')],
    privileges: PRIV,
    etapes: [
      lec('1. Vérifier l’interface côté postes', 'Un routeur qui ne voit pas son lien ne répondra jamais. L’interface doit être « up » et « line protocol is up ».',
        [priv('show ip interface brief'), priv('show interfaces {{interface}}')], '« up » et « line protocol is up » sur l’interface côté postes.'),
      lec('2. Vérifier le relais et le service DHCP', 'Le relais doit être sur l’interface qui reçoit les demandes, et « no service dhcp » doit être absent : il éteint serveur et relais.',
        [priv('show running-config interface {{interface}}'), priv('show running-config | include no service dhcp')], 'Une ligne « ip helper-address » si le serveur est ailleurs ; aucune ligne « no service dhcp ».'),
      lec('3. Lire les baux, le pool et les conflits', 'Si deux postes se disputent une adresse, le serveur la signale comme conflit. Un bail expiré peut être redonné à un autre poste pendant que le premier garde son adresse.',
        [priv('show ip dhcp binding'), priv('show ip dhcp pool'), priv('show ip dhcp conflict')], 'Les baux accordés, le nombre d’adresses prêtées par pool, et la liste des conflits (vide si tout va bien).'),
      mod('4. Cibler les messages DHCP avec le débogage', 'Une liste d’accès étendue ne laisse passer que les ports UDP 67 et 68 (messages DHCP), puis « debug ip packet » n’affiche que ceux-là. Une demande qui arrive porte l’adresse source 0.0.0.0 (le poste n’a pas encore d’adresse) et la destination 255.255.255.255 (diffusion). Le débogage peut inonder la console sur un routeur chargé : à utiliser brièvement en laboratoire.',
        [cfg('access-list 100 permit udp any any eq 67'), cfg('access-list 100 permit udp any any eq 68'), priv('debug ip packet 100'), priv('debug ip dhcp server events')], 'Des lignes « IP: s=0.0.0.0 … d=255.255.255.255 » quand un poste demande, puis les attributions « DHCPD: assigned IP address … ».', { facultatif: true }),
      mod('5. Arrêter le débogage', 'Toujours arrêter le débogage quand c’est fini, puis retirer la liste d’accès de test.',
        [priv('undebug all'), cfg('no access-list 100')], 'Plus de messages ; « show debugging » n’affiche rien.', { facultatif: true }),
    ],
    verification: ['Le poste reçoit une adresse du bon pool, « show ip dhcp binding » la liste et « show ip dhcp conflict » est vide.'],
    retour: 'Le débogage et la liste d’accès de test s’enlèvent à l’étape 5.',
    depannage: [
      { symptome: 'Le poste utilise une adresse déjà prise', cause: 'Son bail a expiré, le serveur n’a pas répondu au redémarrage, et le poste a gardé sa dernière adresse.', action: 'Sur le poste, libère puis renouvelle le bail (Windows : ipconfig /release puis ipconfig /renew ; Packet Tracer : Desktop > IP Configuration, rebascule sur DHCP).' },
      { symptome: 'Rien ne s’affiche pendant le débogage', cause: 'Aucune demande n’arrive jusqu’au routeur : problème de câble, de port de commutateur ou de VLAN.', action: 'Teste le poste avec une adresse fixe pour isoler le lien, puis vérifie le port du commutateur et le VLAN.' },
    ],
    sources: [SRC_DHCP4, SRC_RELAIS],
    rappel: { titre: 'Rappel : dépannage DHCPv4', points: ['Ordre conseillé : lien physique, port du commutateur, relais, service DHCP, pool et baux.', 'Tester avec une adresse fixe sépare un problème de lien d’un problème de DHCP.', 'Un bail expiré peut être réattribué : deux postes se retrouvent alors avec la même adresse.'] },
  }),
  // ===========================================================================
  // IPv6 : adressage, vérification, routes statiques
  // ===========================================================================
  ficheIos({
    id: 'cours-ipv6-adresser-interface',
    titre: 'Adresser une interface de routeur en IPv6 (globale et link-local)',
    resume: 'Active le routage IPv6, pose l’adresse globale et l’adresse link-local d’une interface, puis l’allume.',
    effet: 'modification',
    intentions: ['ipv6 address', 'ipv6 unicast-routing', 'adresse ipv6 sur un routeur', 'adresse link-local fe80', 'configurer ipv6 interface', 'ipv6 address link-local'],
    motsCles: ['ipv6', 'unicast-routing', 'link-local', 'fe80', 'gua', 'adresse globale', 'cisco', 'routeur', '2001:db8'],
    params: [ITF_ROUTEUR('Gi0/0'), GUA, LIEN],
    privileges: ENABLE,
    etapes: [
      mod('Activer le routage IPv6', 'Le routage IPv6 est désactivé par défaut. « ipv6 unicast-routing » est nécessaire pour que le routeur transfère des paquets IPv6 ET envoie des annonces de routeur (RA) ; sans elle, SLAAC ne fonctionne pas pour les postes.',
        [cfg('ipv6 unicast-routing')], 'Aucun message.'),
      mod('Poser les adresses et allumer l’interface', 'On pose l’adresse globale avec son préfixe, puis l’adresse link-local. Sans la deuxième ligne, IOS fabrique sa propre adresse link-local à partir de l’adresse MAC : écrire fe80::1 la rend facile à reconnaître et à saisir comme passerelle des postes. Sur un lien série côté DCE, ajoute aussi « clock rate » (voir la fiche d’adressage IPv4). Dans Packet Tracer, les postes se règlent dans Desktop > IP Configuration, en IPv6 manuel (adresse, préfixe, passerelle = l’adresse link-local) ou en « Automatic ».',
        [cfg('interface {{interface}}'), itf('ipv6 address {{adresse}}'), itf('ipv6 address {{lien}} link-local'), itf('no shutdown')], 'Aucun message ; l’interface passe « up ».'),
      lec('Contrôler', 'Montre l’état et les adresses IPv6 de l’interface. Détail complet des vérifications : fiche « Vérifier IPv6 ».',
        [priv('show ipv6 interface brief')], 'L’interface est « [up/up] » avec son adresse link-local (FE80::1) et son adresse globale.'),
    ],
    verification: ['show ipv6 interface brief affiche l’interface [up/up] avec FE80::1 et l’adresse globale attendue.'],
    retour: 'Pour retirer les adresses : « no ipv6 address » sur l’interface (étape « Annuler »).',
    depannage: [
      { symptome: 'Les postes en « Automatic » n’obtiennent pas d’adresse', cause: 'Le routage IPv6 n’est pas activé : le routeur n’envoie pas d’annonces de routeur.', action: 'Tape « ipv6 unicast-routing » en configuration globale.' },
      { symptome: 'Le ping d’un poste vers le routeur échoue', cause: 'Mauvaise passerelle sur le poste : il faut l’adresse link-local du routeur (fe80::1), pas son adresse globale seulement.', action: 'Règle la passerelle du poste sur l’adresse link-local de l’interface.' },
    ],
    sources: [SRC_V6],
    figures: ['ipv6-adresse', 'ipv6-types'],
    rappel: { titre: 'Rappel : adresses IPv6', points: ['128 bits, écrits en 8 groupes de 4 chiffres hexadécimaux séparés par « : ».', 'On peut supprimer les zéros de tête d’un groupe, et remplacer UNE seule suite de groupes à zéro par « :: ».', 'Le préfixe habituel d’un réseau local est /64 : 64 bits de réseau, 64 bits d’identifiant d’interface.', 'Chaque interface IPv6 a une adresse link-local (FE80::/10), utilisée sur le lien et comme passerelle des postes.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ipv6-verifier',
    titre: 'Vérifier IPv6 : interfaces, table de routage et ping',
    resume: 'Lit les adresses IPv6 des interfaces et la table de routage IPv6, puis teste une destination. Lecture seule.',
    effet: 'lecture',
    intentions: ['show ipv6 interface brief', 'show ipv6 route', 'ping ipv6', 'vérifier ipv6', 'table de routage ipv6', 'ipv6config'],
    motsCles: ['ipv6', 'show ipv6', 'ping', 'table de routage', 'vérification', 'cisco', 'routeur'],
    params: [{ id: 'cible', label: 'adresse IPv6 à tester', type: 'ipv6', exemple: '2001:db8:acad:1::10', aide: 'L’adresse IPv6 d’un poste ou d’une interface distante, écrite sans préfixe.' }],
    privileges: PRIV,
    etapes: [
      lec('Lire les adresses des interfaces', 'Chaque interface montre son état, son adresse link-local (FE80::…) et son adresse globale.',
        [priv('show ipv6 interface brief')], 'Les interfaces utilisées sont « [up/up] » avec leurs adresses.'),
      lec('Lire la table de routage IPv6', 'Codes : C réseau directement connecté, L adresse locale de l’interface (/128), S route statique, S* route statique par défaut (::/0). Les adresses FE80 servent à nommer le routeur suivant.',
        [priv('show ipv6 route')], 'Un « C » et un « L » par interface active, plus les routes « S » ou « S* » écrites.'),
      lec('Tester la connexion', 'Un ping envoie 5 requêtes ; « !!!!! » veut dire que toutes ont reçu une réponse. Sur un poste Windows, « ipconfig » (ou « ipv6config » dans Packet Tracer) montre l’adresse du poste.',
        [priv('ping {{cible}}')], '« Success rate is 100 percent (5/5) » : la route aller et la route retour fonctionnent.'),
    ],
    verification: ['Les interfaces sont [up/up], les réseaux distants apparaissent dans show ipv6 route et le ping répond à 100 %.'],
    sources: [SRC_V6],
    rappel: { titre: 'Rappel : lire une table IPv6', points: ['C = connecté, L = adresse locale (/128), S = statique, S* = statique par défaut.', 'Entre crochets : [distance administrative/métrique]. Une route statique vaut [1/0].', 'Un ping qui échoue vers un réseau lointain veut souvent dire qu’il manque la route retour.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ipv6-routes-statiques',
    titre: 'Route statique IPv6 : récursive, connectée ou spécifiée',
    resume: 'Les trois formes d’une route statique IPv6 vers un réseau distant : par l’adresse du routeur suivant, par l’interface de sortie, ou par les deux.',
    effet: 'modification',
    intentions: ['ipv6 route', 'route statique ipv6', 'route récursive ipv6', 'route connectée directement ipv6', 'route entièrement spécifiée ipv6', 'router en ipv6'],
    motsCles: ['ipv6 route', 'route statique', 'récursive', 'next hop', 'entièrement spécifiée', 'cisco', 'routeur'],
    params: [
      { id: 'reseau', label: 'réseau distant à atteindre avec son préfixe', type: 'cidr6', exemple: '2001:db8:1:2::/64', aide: 'Le réseau qui n’est pas directement connecté à ce routeur.' },
      { id: 'saut', label: 'adresse du routeur suivant', type: 'ipv6', exemple: '2001:db8:1:a001::2', aide: 'L’adresse de l’interface du routeur voisin, sur le lien qui mène au réseau distant.' },
      ITF_ROUTEUR('Se0/0/0', 'interface de sortie du routeur', 'L’interface de ce routeur qui mène au routeur suivant.'),
    ],
    privileges: ENABLE,
    etapes: [
      mod('Activer le routage IPv6', 'Sans cette commande le routeur ne transfère pas de paquets IPv6. À taper une fois sur chaque routeur.',
        [cfg('ipv6 unicast-routing')], 'Aucun message.'),
      mod('Forme 1 — route récursive (par le routeur suivant)', 'On donne l’adresse du routeur suivant : IOS cherche lui-même par quelle interface le joindre (deux consultations de la table). Une route par réseau distant.',
        [cfg('ipv6 route {{reseau}} {{saut}}')], 'Aucun message ; une ligne « S » apparaît dans la table.'),
      mod('Forme 2 — route connectée directement (par l’interface)', 'On donne seulement l’interface de sortie : convient aux liens point à point comme un lien série. Choisis UNE forme par réseau distant.',
        [cfg('ipv6 route {{reseau}} {{interface}}')], 'Aucun message ; la route apparaît avec « directly connected, » et le nom de l’interface.', { facultatif: true }),
      mod('Forme 3 — route entièrement spécifiée (interface ET routeur suivant)', 'On donne les deux : seule forme possible quand le routeur suivant est une adresse link-local (FE80::…), car elle n’a de sens que sur une interface précise. Ne combine pas avec la forme 1 ou 2 pour le même réseau.',
        [cfg('ipv6 route {{reseau}} {{interface}} {{saut}}')], 'Aucun message ; la route apparaît avec l’interface et l’adresse du routeur suivant.', { facultatif: true }),
      lec('Contrôler', 'Les routes statiques portent le code S. Contrôle aussi, depuis un poste, qu’un ping traverse tout le chemin : la route RETOUR doit exister sur l’autre routeur.',
        [priv('show ipv6 route static'), priv('show ipv6 route')], 'Une ligne S par route écrite, avec [1/0].'),
    ],
    verification: ['show ipv6 route static affiche la route avec le bon réseau, et un ping de bout en bout répond dans les deux sens.'],
    retour: 'Pour retirer une route : retape-la avec « no » devant (étape « Annuler »).',
    depannage: [
      { symptome: 'La route n’apparaît pas dans la table', cause: 'Le routeur suivant n’est pas joignable (interface éteinte) ou le routage IPv6 n’est pas activé.', action: 'Vérifie « show ipv6 interface brief » et « ipv6 unicast-routing ».' },
      { symptome: 'Le ping s’arrête au milieu du chemin', cause: 'Il manque la route retour sur un des routeurs (une route statique ne se déduit pas dans l’autre sens).', action: 'Écris la route vers le réseau de départ sur le routeur d’arrivée.' },
    ],
    sources: [SRC_V6ROUTE],
    figures: ['ipv6-routes-statiques'],
    rappel: { titre: 'Rappel : routes statiques IPv6', points: ['La commande est « ipv6 route préfixe/longueur adresse-du-saut ou interface ».', 'Trois formes : récursive, connectée directement, entièrement spécifiée.', 'Il faut une route à l’aller ET au retour pour chaque réseau distant.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-ipv6-defaut-flottante',
    titre: 'Route IPv6 par défaut (::/0) et route flottante de secours',
    resume: 'Une route par défaut IPv6 vers le routeur qui mène au reste du monde, et une route de secours à distance plus élevée qui reste cachée tant que la principale existe.',
    effet: 'modification',
    intentions: ['ipv6 route ::/0', 'route par défaut ipv6', 'route statique flottante ipv6', 'distance administrative ipv6', 'route de secours ipv6'],
    motsCles: ['ipv6 route', '::/0', 'défaut', 'flottante', 'distance administrative', 'secours', 'cisco', 'routeur'],
    params: [
      { id: 'saut', label: 'routeur suivant de la route principale', type: 'ipv6', exemple: '2001:db8:acad:4::2', aide: 'L’adresse IPv6 du routeur qui mène vers le reste du réseau (ou vers le fournisseur).' },
      { id: 'secours', label: 'routeur suivant de la route de secours', type: 'ipv6', exemple: '2001:db8:acad:6::2', aide: 'L’adresse du routeur voisin sur le lien de secours.' },
      { id: 'distance', label: 'distance administrative de la route de secours', type: 'entier', min: 2, max: 254, exemple: '5', aide: 'Plus grande que celle de la route principale (1 par défaut pour une route statique) : la route de secours reste cachée tant que la principale est valide.' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Écrire la route par défaut', '« ::/0 » est l’équivalent IPv6 de 0.0.0.0/0 : tout ce qui ne correspond à aucune autre route part vers ce routeur.',
        [cfg('ipv6 route ::/0 {{saut}}')], 'Aucun message ; une ligne « S* ::/0 » apparaît.'),
      mod('Ajouter la route de secours (flottante)', 'Même destination, autre chemin, avec une distance administrative plus grande en dernier argument. Elle n’entre dans la table que si la route principale disparaît.',
        [cfg('ipv6 route ::/0 {{secours}} {{distance}}')], 'Aucun message ; la route de secours n’apparaît pas dans la table tant que la principale est active.', { facultatif: true }),
      lec('Contrôler', 'La route principale est marquée S* ; la route flottante reste invisible tant qu’elle n’est pas utilisée. Pour la voir, regarde la configuration.',
        [priv('show ipv6 route static'), priv('show running-config | include ipv6 route')], '« S* ::/0 [1/0] via … » ; les deux lignes « ipv6 route » dans la configuration.'),
    ],
    verification: ['show ipv6 route static montre S* ::/0 via le routeur principal, et la route de secours apparaît seulement si on éteint le lien principal.'],
    retour: 'Pour retirer les routes : « no ipv6 route » avec les mêmes arguments (étape « Annuler »).',
    sources: [SRC_V6ROUTE],
    rappel: { titre: 'Rappel : route par défaut et flottante', points: ['::/0 correspond à toutes les destinations : c’est la route de dernier recours.', 'Une route statique a une distance de 1 ; la route flottante a une distance plus grande et ne s’active qu’en cas de panne.'] },
  }),
  // ===========================================================================
  // SLAAC et DHCPv6
  // ===========================================================================
  ficheIos({
    id: 'cours-dhcp6-slaac',
    titre: 'SLAAC : laisser les postes se fabriquer leur adresse IPv6',
    resume: 'Le routeur annonce le préfixe et lui-même comme passerelle ; chaque poste compose son identifiant d’interface. Aucun serveur DHCPv6.',
    effet: 'modification',
    intentions: ['slaac', 'autoconfiguration sans état ipv6', 'annonce de routeur ra icmpv6', 'configurer slaac sur un routeur', 'adresse ipv6 automatique des postes', 'eui-64'],
    motsCles: ['slaac', 'ra', 'router advertisement', 'ipv6', 'autoconfiguration', 'eui-64', 'cisco', 'routeur'],
    params: [ITF_ROUTEUR('Gi0/0/1', 'interface du routeur côté postes', 'L’interface du réseau local où les postes se fabriqueront une adresse.'), GUA, LIEN],
    privileges: ENABLE,
    etapes: [
      mod('Activer le routage IPv6', 'Indispensable : c’est ce qui fait envoyer au routeur les annonces de routeur ICMPv6 (RA). Un routeur qui a une adresse IPv6 sans cette commande n’est pas un « routeur IPv6 ».',
        [cfg('ipv6 unicast-routing')], 'Aucun message.'),
      mod('Poser l’adresse globale sur l’interface côté postes', 'Le préfixe de l’adresse (ici /64) est celui que les postes recevront. Les RA partent de l’adresse link-local du routeur, que les postes utiliseront comme passerelle.',
        [cfg('interface {{interface}}'), itf('ipv6 address {{adresse}}'), itf('ipv6 address {{lien}} link-local'), itf('no shutdown')], 'Aucun message ; l’interface passe « up ».'),
      lec('Contrôler sur le routeur et sur le poste', 'Sur le poste (Windows : paramètres de la carte réseau réglés sur IPv6 automatique ; Packet Tracer : Desktop > IP Configuration > Automatic), « ipconfig /all » montre une adresse globale dans le préfixe annoncé, et la passerelle fe80::1. Sur le routeur, le détail de l’interface décrit les annonces envoyées.',
        [priv('show ipv6 interface {{interface}}'), poste('ipconfig /all')], 'Le poste a une adresse 2001:db8:acad:1:… et la passerelle par défaut est l’adresse link-local du routeur.'),
    ],
    verification: ['Le poste reçoit une adresse globale dans le préfixe annoncé, sa passerelle est FE80::1 et le ping vers le routeur répond.'],
    retour: 'Pour arrêter SLAAC sur cette interface : « no ipv6 address » sur l’interface, ou « no ipv6 unicast-routing » pour stopper toutes les annonces (étape « Annuler »).',
    depannage: [
      { symptome: 'Le poste n’a que son adresse link-local', cause: 'Pas de RA reçue : « ipv6 unicast-routing » absente, interface éteinte, ou poste non réglé sur IPv6 automatique.', action: 'Vérifie le routage IPv6 sur le routeur, l’état de l’interface et le réglage du poste.' },
      { symptome: 'Le poste a une adresse mais pas de serveur DNS', cause: 'SLAAC seul ne donne ni DNS ni domaine.', action: 'Ajoute un DHCPv6 sans état (fiche suivante).' },
    ],
    sources: [SRC_V6, SRC_DHCP6],
    figures: ['ipv6-eui64', 'dhcp6-ra-flags'],
    rappel: { titre: 'Rappel : SLAAC', points: ['Le routeur envoie des annonces de routeur (RA) : préfixe, longueur du préfixe et passerelle (son adresse link-local).', 'Le poste fabrique son identifiant d’interface de 64 bits : EUI-64 (à partir de l’adresse MAC) ou nombre aléatoire (Windows depuis Vista).', 'SLAAC ne donne pas d’adresse de serveur DNS.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dhcp6-sans-etat',
    titre: 'Serveur DHCPv6 sans état sur un routeur (SLAAC + DNS)',
    resume: 'Les postes fabriquent leur adresse avec SLAAC et reçoivent du routeur seulement des informations complémentaires : serveur DNS et nom de domaine.',
    effet: 'modification',
    intentions: ['dhcpv6 sans état', 'ipv6 dhcp pool', 'ipv6 nd other-config-flag', 'ipv6 dhcp server', 'stateless dhcpv6', 'dns ipv6 pour les clients slaac', 'indicateur o'],
    motsCles: ['dhcpv6', 'sans état', 'stateless', 'other-config-flag', 'ipv6 dhcp pool', 'dns', 'cisco', 'routeur'],
    params: [
      POOL('IPV6-STATELESS', 'Le nom du pool DHCPv6, par exemple en majuscules pour mieux le repérer dans la configuration.'),
      DNS6('2001:db8:acad:1::254'),
      DOMAINE,
      ITF_ROUTEUR('Gi0/0/1', 'interface du routeur côté postes', 'L’interface qui porte déjà l’adresse IPv6 du réseau local (fiche d’adressage IPv6).'),
    ],
    privileges: ENABLE,
    etapes: [
      mod('Activer le routage IPv6', 'Nécessaire pour que le routeur envoie des annonces de routeur (RA), même s’il n’est pas lui-même le serveur d’adresses.',
        [cfg('ipv6 unicast-routing')], 'Aucun message.'),
      mod('Créer le pool des informations complémentaires', 'Le pool sans état ne contient pas de préfixe d’adresse, seulement le serveur DNS et le domaine. L’invite devient « (config-dhcpv6)# ».',
        [cfg('ipv6 dhcp pool {{pool}}'), dh6('dns-server {{dns}}'), dh6('domain-name {{domaine}}'), dh6('exit')], 'L’invite revient à « (config)# ».'),
      mod('Lier le pool à l’interface et lever l’indicateur O', 'L’indicateur O (Other) des RA passe à 1 : les postes savent qu’un serveur DHCPv6 leur donne d’autres informations. L’indicateur A reste à 1 par défaut, donc les postes continuent de fabriquer leur adresse avec SLAAC. L’interface doit déjà avoir son adresse IPv6.',
        [cfg('interface {{interface}}'), itf('ipv6 nd other-config-flag'), itf('ipv6 dhcp server {{pool}}')], 'Aucun message.'),
      lec('Contrôler', 'Sur le routeur, « show ipv6 dhcp pool » liste le pool et ses options. Sur le poste (redémarre-le ou rebascule-le en automatique), « ipconfig /all » doit maintenant montrer le serveur DNS et le suffixe de domaine donnés par le pool.',
        [priv('show ipv6 dhcp pool'), poste('ipconfig /all')], 'Le pool apparaît avec son serveur DNS et son domaine ; le poste affiche le DNS et le suffixe du pool.'),
    ],
    verification: ['Le poste garde son adresse SLAAC et reçoit en plus le serveur DNS et le domaine du pool.'],
    retour: 'Pour défaire : retire le lien et l’indicateur sur l’interface, puis supprime le pool (étape « Annuler »).',
    depannage: [
      { symptome: 'Le poste n’affiche ni DNS ni domaine', cause: 'L’indicateur O n’est pas levé, le pool n’est pas lié à la bonne interface, ou le poste n’a pas relancé sa demande.', action: 'Vérifie les deux lignes sur l’interface, puis redémarre le poste ou désactive/réactive sa carte.' },
    ],
    sources: [SRC_DHCP6],
    figures: ['dhcp6-ra-flags', 'dhcp6-qui-donne-quoi'],
    rappel: { titre: 'Rappel : DHCPv6 sans état', points: ['Adresse : SLAAC (le poste la fabrique). Informations en plus : DHCPv6 (DNS, domaine).', 'L’indicateur O des RA passe à 1 avec « ipv6 nd other-config-flag ».', 'Le serveur ne garde aucun bail : c’est ce qui le rend « sans état ».'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dhcp6-avec-etat',
    titre: 'Serveur DHCPv6 avec état sur un routeur (le serveur donne l’adresse)',
    resume: 'Le routeur prête de vraies adresses d’un préfixe, avec baux, plus le DNS et le domaine ; l’indicateur M des annonces dit aux postes de les demander.',
    effet: 'modification',
    intentions: ['dhcpv6 avec état', 'stateful dhcpv6', 'ipv6 nd managed-config-flag', 'address prefix lifetime', 'ipv6 dhcp pool prefixe', 'indicateur m', 'show ipv6 dhcp binding'],
    motsCles: ['dhcpv6', 'avec état', 'stateful', 'managed-config-flag', 'address prefix', 'lifetime', 'bail', 'cisco', 'routeur'],
    params: [
      POOL('IPV6-STATEFUL', 'Le nom du pool DHCPv6.'),
      { id: 'prefixe', label: 'préfixe des adresses à prêter', type: 'cidr6', exemple: '2001:db8:cafe:1::/64', aide: 'Le préfixe dans lequel le serveur choisit les adresses ; en général le préfixe du réseau des postes.' },
      DNS6('2001:db8:cafe:aaaa::5'),
      DOMAINE,
      ITF_ROUTEUR('Gi0/1', 'interface du routeur côté postes', 'L’interface qui porte déjà l’adresse IPv6 du réseau des postes (fiche d’adressage IPv6).'),
    ],
    privileges: ENABLE,
    etapes: [
      mod('Activer le routage IPv6', 'Nécessaire pour que le routeur envoie des annonces de routeur (RA).',
        [cfg('ipv6 unicast-routing')], 'Aucun message.'),
      mod('Créer le pool d’adresses', '« address prefix » désigne les adresses que le serveur peut prêter ; « lifetime infinite » donne un bail sans fin (sinon, on indique la durée de validité et la durée préférée en secondes). Le DNS et le domaine complètent la configuration.',
        [cfg('ipv6 dhcp pool {{pool}}'), dh6('address prefix {{prefixe}} lifetime infinite'), dh6('dns-server {{dns}}'), dh6('domain-name {{domaine}}'), dh6('exit')], 'L’invite revient à « (config)# ».'),
      mod('Lier le pool à l’interface et lever l’indicateur M', 'L’indicateur M (Managed) à 1 dit aux postes d’obtenir leur adresse d’un serveur DHCPv6. L’interface doit déjà avoir son adresse IPv6.',
        [cfg('interface {{interface}}'), itf('ipv6 dhcp server {{pool}}'), itf('ipv6 nd managed-config-flag')], 'Aucun message.'),
      lec('Contrôler', 'Le pool montre son préfixe, ses options et le nombre de clients actifs ; « binding » liste chaque client avec l’adresse qu’il a reçue. Côté client, l’adresse globale vient maintenant du préfixe du pool.',
        [priv('show ipv6 dhcp pool'), priv('show ipv6 dhcp binding')], '« Active clients: 1 » et, dans binding, l’adresse du client dans le préfixe du pool.'),
    ],
    verification: ['show ipv6 dhcp binding liste le client et son adresse, prise dans le préfixe du pool.'],
    retour: 'Pour défaire : retire le lien et l’indicateur sur l’interface, puis supprime le pool (étape « Annuler »).',
    depannage: [
      { symptome: 'Le client n’obtient pas d’adresse du pool', cause: 'L’indicateur M n’est pas levé, le pool n’est pas lié à la bonne interface, ou le préfixe du pool n’est pas celui du réseau du client.', action: 'Revois les deux lignes de l’interface et le préfixe du pool.' },
      { symptome: 'Le client a deux adresses globales', cause: 'L’indicateur A vaut encore 1 : le client se fabrique aussi une adresse SLAAC en plus de celle du serveur.', action: 'Normal par défaut ; la décision finale revient au système du poste.' },
    ],
    sources: [SRC_DHCP6],
    figures: ['dhcp6-ra-flags', 'dhcp6-qui-donne-quoi'],
    rappel: { titre: 'Rappel : DHCPv6 avec état', points: ['Le serveur donne l’adresse complète (préfixe ET identifiant d’interface), le DNS et le domaine, et garde la liste des baux.', 'L’indicateur M des RA passe à 1 avec « ipv6 nd managed-config-flag ».', 'La décision finale reste au poste : il suit la suggestion des RA, il n’y est pas obligé.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dhcp6-relais',
    titre: 'Relayer le DHCPv6 vers un serveur situé sur un autre réseau',
    resume: 'Sur l’interface qui regarde les postes, fait suivre leurs demandes DHCPv6 vers le serveur, avec ou sans interface de sortie.',
    effet: 'modification',
    intentions: ['ipv6 dhcp relay destination', 'relais dhcpv6', 'agent de relais dhcpv6', 'serveur dhcpv6 sur un autre réseau', 'dhcpv6 relay agent'],
    motsCles: ['dhcpv6', 'relais', 'relay destination', 'agent de relais', 'ipv6', 'cisco', 'routeur'],
    params: [
      ITF_ROUTEUR('Gi0/0/1', 'interface du routeur côté postes', 'L’interface où sont branchés les clients DHCPv6.'),
      { id: 'serveur', label: 'adresse IPv6 du serveur DHCPv6', type: 'ipv6', exemple: '2001:db8:acad:1::2', aide: 'L’adresse du serveur DHCPv6 (ou de son interface), écrite sans préfixe.' },
      { ...ITF_ROUTEUR('Gi0/0/0', 'interface de sortie vers le serveur', 'L’interface du routeur qui mène au serveur ; obligatoire seulement si l’adresse du serveur est une adresse link-local.'), id: 'sortie' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Désigner le serveur sur l’interface côté postes', 'La commande se place sur l’interface tournée vers les clients DHCPv6 et indique où envoyer leurs demandes. Les clients utilisent de la multidiffusion, qui ne franchit pas un routeur : sans relais, un serveur d’un autre réseau ne reçoit rien.',
        [cfg('interface {{interface}}'), itf('ipv6 dhcp relay destination {{serveur}}')], 'Aucun message.'),
      mod('Variante : préciser l’interface de sortie', 'À utiliser à la place de la ligne précédente quand l’adresse du saut suivant est une adresse link-local (FE80::…), qui n’a de sens que sur une interface précise. Exemple du cours : la même commande avec « G0/0/0 » à la fin.',
        [itf('ipv6 dhcp relay destination {{serveur}} {{sortie}}')], 'Aucun message.', { facultatif: true }),
      lec('Contrôler', 'La configuration de l’interface doit montrer la ligne du relais. Le poste doit ensuite recevoir ses informations du serveur éloigné.',
        [priv('show running-config interface {{interface}}')], 'Une ligne « ipv6 dhcp relay destination … » sur l’interface côté postes.'),
    ],
    verification: ['L’interface côté postes porte le relais et le client obtient ses informations du serveur éloigné.'],
    retour: 'Pour retirer le relais : « no ipv6 dhcp relay destination » avec la même adresse (étape « Annuler »).',
    sources: [SRC_DHCP6],
    figures: ['dhcp6-relais'],
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dhcp6-verifier',
    titre: 'Vérifier DHCPv6 : pool, baux, annonces du routeur et poste',
    resume: 'Lit le pool DHCPv6, la liste des baux, les annonces de routeur reçues par un routeur client et l’adresse du poste. Lecture seule.',
    effet: 'lecture',
    intentions: ['show ipv6 dhcp pool', 'show ipv6 dhcp binding', 'vérifier dhcpv6', 'show ipv6 interface', 'ipconfig all ipv6', 'quel client a quelle adresse ipv6'],
    motsCles: ['dhcpv6', 'show ipv6 dhcp', 'binding', 'pool', 'ra', 'ipv6', 'vérification', 'cisco'],
    params: [ITF_ROUTEUR('Gi0/1', 'interface à examiner', 'L’interface dont on veut lire les annonces de routeur et l’adresse reçue.')],
    privileges: PRIV,
    etapes: [
      lec('Sur le serveur : lire le pool', 'Montre le préfixe prêté, le serveur DNS, le domaine et le nombre de clients actifs.',
        [priv('show ipv6 dhcp pool')], 'Le pool avec « Active clients » (0 si personne n’a encore demandé).'),
      lec('Sur le serveur : lire les baux', 'Chaque client est identifié par son adresse link-local et son DUID ; l’adresse reçue est dans le préfixe du pool.',
        [priv('show ipv6 dhcp binding')], 'Une entrée « Client: FE80::… » avec son adresse.'),
      lec('Sur un routeur client : lire l’adresse reçue et la passerelle', 'Le détail de l’interface montre l’adresse globale obtenue, les groupes multicast rejoints et le routeur par défaut appris par annonce.',
        [priv('show ipv6 interface {{interface}}')], 'Une adresse globale unicast dans le préfixe attendu et une ligne « Default router is FE80::… ».'),
      lec('Sur un poste Windows', 'Montre l’adresse IPv6, la passerelle (adresse link-local du routeur), le DNS et le suffixe reçus du pool. Packet Tracer : « ipv6config » dans la fenêtre d’invite de commandes.',
        [poste('ipconfig /all')], 'Adresse IPv6, DNS et suffixe cohérents avec le pool.'),
    ],
    verification: ['Le pool, les baux et la configuration du poste racontent la même histoire : même préfixe, même DNS, même domaine.'],
    sources: [SRC_DHCP6],
  }),
];
