/**
 * cours-fiches-cisco-nat.mjs — KJEMO-CISCO-NAT-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiches Cisco IOS tirées des notes de cours du jour : NAT statique, NAT
 * dynamique, PAT (surcharge), redirection de port, vérification d'une table
 * NAT, et récapitulation de routes (route statique récapitulative, résumé
 * RIPv2). NAT64 est expliqué dans le cours, sans fiche : sa syntaxe change
 * selon la plateforme et n'existe pas dans Packet Tracer.
 *
 * Rédigées à la main, dans nos mots. Les commandes ne sont jamais exécutées
 * par le Toolkit : rien n'a été essayé sur du matériel réel ni dans Packet
 * Tracer.
 */
import { V_COURS } from './cours-outils.mjs';

const CISCO = 'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios';
const SRC_NAT = { label: 'Cisco IOS — Configuring NAT for IP Address Conservation', url: `${CISCO}/ipaddr_nat/configuration/xe-16/nat-xe-16-book/iadnat-addr-consv.html` };
const SRC_NATCMD = { label: 'Cisco IOS — IP Addressing Services Command Reference (ip nat)', url: `${CISCO}/ipaddr/command/ipaddr-cr-book/ipaddr-i4.html` };
const SRC_NULL = { label: 'Cisco — Route to Null Interface (note technique 14956)', url: 'https://www.cisco.com/c/en/us/support/docs/ip/ip-routed-protocols/14956-route-to-null-interface.html' };
const SRC_RIP = { label: 'Cisco IOS — Routing Information Protocol (ip summary-address rip)', url: `${CISCO}/iproute_rip/configuration/xe-16/irr-xe-16-book/irr-rip.html` };

const CATEGORIE = 'Réseau et Cisco';
const V_CISCO = `${V_COURS} Les sorties montrées sont des exemples écrits pour expliquer, pas des captures d’équipement ; rien n’a été essayé dans Packet Tracer.`;

const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const priv = L('Router#');
const cfg = L('Router(config)#');
const itf = L('Router(config-if)#');

const etape = (effet) => (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');
const itr = etape('interruption');

const ENABLE = 'Mode de configuration globale (enable puis configure terminal).';

const MASQUES = ['255.0.0.0', '255.128.0.0', '255.192.0.0', '255.224.0.0', '255.240.0.0', '255.248.0.0', '255.252.0.0', '255.254.0.0',
  '255.255.0.0', '255.255.128.0', '255.255.192.0', '255.255.224.0', '255.255.240.0', '255.255.248.0', '255.255.252.0', '255.255.254.0',
  '255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.255.248', '255.255.255.252'];
const WILDCARDS = ['0.255.255.255', '0.127.255.255', '0.63.255.255', '0.31.255.255', '0.15.255.255', '0.7.255.255', '0.3.255.255', '0.1.255.255',
  '0.0.255.255', '0.0.127.255', '0.0.63.255', '0.0.31.255', '0.0.15.255', '0.0.7.255', '0.0.3.255', '0.0.1.255',
  '0.0.0.255', '0.0.0.127', '0.0.0.63', '0.0.0.31', '0.0.0.15', '0.0.0.7', '0.0.0.3'];
const ITF_ROUTEUR = (id, exemple, label, aide) => ({ id, label, type: 'interfaceRouteur', exemple, aide });
const INTERNE = ITF_ROUTEUR('interne', 'Gi0/0', 'interface côté réseau interne (inside)', 'L’interface qui regarde le réseau privé (les postes). Les numéros d’un routeur partent de 0 : Gi0/0, Gi0/0/1.');
const EXTERNE = ITF_ROUTEUR('externe', 'Se0/1/0', 'interface côté réseau externe (outside)', 'L’interface qui regarde Internet ou le fournisseur d’accès.');
const ACL = { id: 'acl', label: 'numéro de la liste d’accès standard', type: 'entier', min: 1, max: 99, exemple: '1', aide: 'Un nombre de 1 à 99 : la liste qui désigne QUELLES adresses internes ont le droit d’être traduites.' };
const RESEAU_INT = { id: 'reseau', label: 'réseau interne à traduire', type: 'ipv4', exemple: '192.168.10.0', aide: 'L’adresse du RÉSEAU privé (premier numéro de la plage).' };
const WILD = { id: 'wildcard', label: 'masque générique (wildcard) du réseau interne', type: 'choix', choix: WILDCARDS, exemple: '0.0.0.255', aide: 'L’inverse du masque : /24 = 0.0.0.255, /26 = 0.0.0.63.' };
const LOCALE = { id: 'locale', label: 'adresse interne du serveur (inside local)', type: 'ipv4', exemple: '192.168.10.10', aide: 'L’adresse PRIVÉE du serveur à rendre joignable depuis l’extérieur.' };
const GLOBALE = { id: 'globale', label: 'adresse publique (inside global)', type: 'ipv4', exemple: '203.0.113.10', aide: 'L’adresse PUBLIQUE sous laquelle le serveur apparaît dehors. 203.0.113.0/24 est réservé aux exemples.' };

const DESC_INTERFACES = 'IOS ne traduit que les paquets qui passent entre une interface « inside » et une interface « outside » : sans ces deux marques, la règle existe mais rien n’est traduit.';
const MARQUER = (titre = 'Marquer l’interface interne et l’interface externe') => mod(titre, DESC_INTERFACES,
  [cfg('interface {{interne}}'), itf('ip nat inside'), cfg('interface {{externe}}'), itf('ip nat outside')], 'Aucun message (IOS peut afficher un avis de traduction activée).');

function ficheIos({ id, titre, resume, effet, intentions, motsCles, params = [], privileges, etapes, verification, retour = null, depannage = null, sources, figures = [], rappel = null }) {
  return {
    id, titre, categorie: CATEGORIE, resume, effet, intentions, motsCles, params,
    methodes: [{ id: 'ios', privileges, etapes, verification, retour, ...(depannage ? { depannage } : {}) }],
    assistant: null, sources, validation: V_CISCO, origine: 'cours',
    ...(figures.length ? { figures } : {}),
    ...(rappel ? { rappel } : {}),
  };
}

export const COURS_CISCO_NAT = [
  // ===========================================================================
  // NAT
  // ===========================================================================
  ficheIos({
    id: 'cours-nat-statique',
    titre: 'NAT statique : une adresse interne = une adresse publique',
    resume: 'Associe pour de bon une adresse privée à une adresse publique (un serveur interne joignable de l’extérieur, un pour un).',
    effet: 'modification',
    intentions: ['nat statique', 'ip nat inside source static', 'rendre un serveur accessible de l’extérieur', 'traduction un pour un', 'inside local inside global'],
    motsCles: ['nat', 'statique', 'static', 'inside', 'outside', 'adresse publique', 'cisco', 'routeur'],
    params: [LOCALE, GLOBALE, INTERNE, EXTERNE],
    privileges: ENABLE,
    etapes: [
      mod('Écrire la correspondance', 'Une ligne suffit : l’adresse privée est toujours remplacée par la même adresse publique, dans les deux sens. La traduction existe en permanence dans la table, même sans trafic.',
        [cfg('ip nat inside source static {{locale}} {{globale}}')], 'Aucun message.'),
      MARQUER(),
      lec('Contrôler', 'La table doit montrer la ligne statique. Les compteurs de « show ip nat statistics » montent quand du trafic passe.',
        [priv('show ip nat translations'), priv('show ip nat statistics')], 'Une ligne « --- 203.0.113.10 192.168.10.10 --- --- » (inside global, inside local).'),
    ],
    verification: ['La table NAT contient la correspondance, les interfaces portent « ip nat inside » et « ip nat outside », et un poste externe atteint le serveur par son adresse publique.'],
    retour: 'Pour défaire : étapes « Annuler » (même ligne avec « no » devant, puis retrait des marques d’interface).',
    depannage: [
      { symptome: 'La traduction ne se fait pas', cause: 'Une des deux interfaces n’a pas sa marque inside ou outside, ou elles sont inversées.', action: 'Relis « show running-config interface » des deux côtés : l’interface vers les postes est « inside ».' },
      { symptome: 'La table est vide', cause: 'Aucune adresse publique routée vers ce routeur : le fournisseur ne sait pas où envoyer les paquets.', action: 'Vérifie que l’adresse publique appartient bien au lien du fournisseur (ou à une route vers ton routeur).' },
    ],
    sources: [SRC_NAT, SRC_NATCMD],
    figures: ['nat-vocabulaire', 'nat-trois-types'],
    rappel: { titre: 'Rappel : NAT statique', points: ['Un pour un : une adresse privée ↔ une adresse publique, fixe.', 'Sert à publier un serveur (web, courriel) depuis un réseau privé.', 'Toujours deux marques : « ip nat inside » côté postes, « ip nat outside » côté Internet.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-nat-dynamique',
    titre: 'NAT dynamique : un groupe d’adresses publiques à la demande',
    resume: 'Les postes internes empruntent chacun une adresse publique prise dans un pool, le temps de leur communication.',
    effet: 'modification',
    intentions: ['nat dynamique', 'ip nat pool', 'ip nat inside source list pool', 'pool d’adresses publiques', 'traduction dynamique'],
    motsCles: ['nat', 'dynamique', 'pool', 'access-list', 'inside', 'outside', 'cisco', 'routeur'],
    params: [
      ACL, RESEAU_INT, WILD,
      { id: 'pool', label: 'nom du pool NAT', type: 'identifiant', exemple: 'POOL-PUBLIC', aide: 'Lettres, chiffres, « - » ou « _ » ; IOS distingue les majuscules des minuscules.' },
      { id: 'debut', label: 'première adresse publique du pool', type: 'ipv4', exemple: '203.0.113.20', aide: 'Début de la plage d’adresses publiques prêtées aux postes.' },
      { id: 'fin', label: 'dernière adresse publique du pool', type: 'ipv4', exemple: '203.0.113.30', aide: 'Fin de la plage (même réseau que la première).' },
      { id: 'masquePool', label: 'masque du réseau des adresses publiques', type: 'choix', choix: MASQUES, exemple: '255.255.255.0', aide: 'Le masque du réseau public auquel appartiennent les adresses du pool.' },
      INTERNE, EXTERNE,
    ],
    privileges: ENABLE,
    etapes: [
      mod('Désigner qui a le droit d’être traduit', 'Une liste d’accès standard dit QUELLES adresses internes peuvent l’être ; ce n’est pas un filtre de trafic. Le masque est un masque générique (l’inverse du masque réseau).',
        [cfg('access-list {{acl}} permit {{reseau}} {{wildcard}}')], 'Aucun message.'),
      mod('Définir le pool d’adresses publiques', 'Le pool est la réserve d’adresses publiques. S’il y a plus de postes que d’adresses, les derniers n’ont pas de traduction : c’est la limite du NAT dynamique (le PAT règle ce problème).',
        [cfg('ip nat pool {{pool}} {{debut}} {{fin}} netmask {{masquePool}}')], 'Aucun message.'),
      mod('Relier la liste au pool', 'Cette ligne active la traduction : les adresses permises par la liste reçoivent une adresse du pool.',
        [cfg('ip nat inside source list {{acl}} pool {{pool}}')], 'Aucun message.'),
      MARQUER(),
      lec('Contrôler', 'Après un ping d’un poste vers l’extérieur, une ligne apparaît dans la table ; elle disparaît quand le délai expire.',
        [priv('show ip nat translations'), priv('show ip nat statistics')], 'Des lignes « --- 203.0.113.20 192.168.10.2 » ; les statistiques montrent le pool et les « hits ».'),
    ],
    verification: ['Liste, pool et règle existent ; les interfaces sont marquées ; un ping depuis un poste interne crée une ligne dans « show ip nat translations ».'],
    retour: 'Pour défaire : étapes « Annuler » (règle, pool, liste, marques d’interface).',
    depannage: [
      { symptome: 'Seuls les premiers postes sortent', cause: 'Le pool est plus petit que le nombre de postes : une adresse publique ne sert qu’à un poste à la fois.', action: 'Agrandis le pool, ou passe au PAT (surcharge) qui partage une adresse grâce aux ports.' },
      { symptome: 'Aucune traduction', cause: 'La liste ne contient pas le réseau du poste (mauvais masque générique) ou les marques inside/outside manquent.', action: 'Compare « show access-lists » à l’adresse du poste et relis les deux interfaces.' },
    ],
    sources: [SRC_NAT, SRC_NATCMD],
    figures: ['nat-vocabulaire', 'nat-trois-types'],
    rappel: { titre: 'Rappel : NAT dynamique', points: ['Liste d’accès = qui est traduit ; pool = avec quelles adresses publiques.', 'Une adresse publique par poste actif : le pool peut s’épuiser.', 'La ligne « ip nat inside source list … pool … » active le tout.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-nat-pat',
    titre: 'PAT (surcharge) : tout un réseau derrière une seule adresse publique',
    resume: 'Plusieurs postes partagent l’adresse publique de l’interface de sortie : le routeur les distingue par le numéro de port.',
    effet: 'modification',
    intentions: ['pat', 'nat overload', 'ip nat inside source list interface overload', 'partager une adresse publique', 'accès internet avec une seule adresse', 'surcharge nat'],
    motsCles: ['pat', 'nat', 'overload', 'surcharge', 'port', 'interface', 'access-list', 'inside', 'outside', 'cisco', 'routeur'],
    params: [ACL, RESEAU_INT, WILD, INTERNE, EXTERNE],
    privileges: ENABLE,
    etapes: [
      mod('Désigner qui a le droit d’être traduit', 'Même liste d’accès standard que pour le NAT dynamique : elle nomme les adresses internes autorisées.',
        [cfg('access-list {{acl}} permit {{reseau}} {{wildcard}}')], 'Aucun message.'),
      mod('Traduire vers l’adresse de l’interface de sortie, en surcharge', 'Le mot « overload » est ce qui fait le PAT : chaque conversation reçoit un numéro de port source différent, ce qui permet à des milliers de postes de partager une seule adresse. Si l’adresse de l’interface change (DHCP du fournisseur), la règle suit.',
        [cfg('ip nat inside source list {{acl}} interface {{externe}} overload')], 'Aucun message.'),
      MARQUER(),
      lec('Contrôler', 'Plusieurs lignes peuvent partager la même adresse « inside global » avec des ports différents (par exemple 203.0.113.2:1025 et :1026).',
        [priv('show ip nat translations'), priv('show ip nat statistics')], 'Des lignes « tcp 203.0.113.2:1025 192.168.10.2:1025 93.184.216.34:80 … ».'),
    ],
    verification: ['La règle « overload » existe, les interfaces sont marquées, et la table montre plusieurs postes internes sous la même adresse publique avec des ports différents.'],
    retour: 'Pour défaire : étapes « Annuler » (règle, liste, marques d’interface).',
    depannage: [
      { symptome: 'Les postes n’atteignent pas Internet', cause: 'Pas de route par défaut vers le fournisseur, ou interfaces inside/outside inversées.', action: 'Vérifie « show ip route » (une route S* 0.0.0.0/0) et les marques des interfaces.' },
      { symptome: 'La traduction se fait pour un poste mais pas pour un autre', cause: 'Le deuxième poste n’est pas couvert par la liste d’accès (mauvais masque générique).', action: 'Compare la liste « show access-lists » à l’adresse du poste.' },
    ],
    sources: [SRC_NAT, SRC_NATCMD],
    figures: ['nat-vocabulaire', 'pat-table', 'socket-ports'],
    rappel: { titre: 'Rappel : PAT', points: ['PAT = NAT avec « overload » : plusieurs postes, une seule adresse publique.', 'Le routeur distingue les conversations par le numéro de port source (plage dynamique 49152–65535).', 'C’est ce que fait la box d’une maison.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-nat-redirection-port',
    titre: 'Redirection de port (port forwarding) vers un serveur interne',
    resume: 'Fait arriver sur un serveur interne le trafic d’un port précis de l’adresse publique : par exemple le web (port 80) vers un serveur privé.',
    effet: 'modification',
    intentions: ['redirection de port', 'port forwarding', 'nat statique avec port', 'ip nat inside source static tcp', 'publier un serveur web derrière le pat', 'ouvrir un port'],
    motsCles: ['port forwarding', 'redirection', 'nat', 'statique', 'tcp', 'udp', 'port', 'inside', 'outside', 'cisco', 'routeur'],
    params: [
      { id: 'protocole', label: 'protocole', type: 'choix', choix: ['tcp', 'udp'], exemple: 'tcp', aide: 'tcp pour le web, le courriel, SSH ; udp pour le DNS, la voix.' },
      LOCALE,
      { id: 'portLocal', label: 'port du serveur interne', type: 'port', exemple: '80', aide: 'Le port sur lequel le serveur écoute (80 web, 443 web chiffré, 22 SSH).' },
      GLOBALE,
      { id: 'portGlobal', label: 'port ouvert côté public', type: 'port', exemple: '8080', aide: 'Le port que les clients externes devront taper. Il peut être différent du port interne.' },
      INTERNE, EXTERNE,
    ],
    privileges: ENABLE,
    etapes: [
      mod('Rediriger un port de l’adresse publique vers le serveur', 'Contrairement au NAT statique (toute l’adresse), seule UNE conversation est redirigée : le trafic arrivant sur le port public est envoyé au port du serveur interne. Les autres ports restent fermés, ce qui limite l’exposition.',
        [cfg('ip nat inside source static {{protocole}} {{locale}} {{portLocal}} {{globale}} {{portGlobal}}')], 'Aucun message.'),
      MARQUER(),
      lec('Contrôler', 'La ligne affiche le protocole et les deux ports. Teste depuis l’extérieur avec l’adresse publique et le port public (par exemple dans un navigateur : http://203.0.113.10:8080).',
        [priv('show ip nat translations'), priv('show ip nat statistics')], 'Une ligne « tcp 203.0.113.10:8080 192.168.10.10:80 --- --- ».'),
    ],
    verification: ['La table contient la redirection, les interfaces sont marquées, et le service répond depuis l’extérieur sur le port public.'],
    retour: 'Pour défaire : étapes « Annuler ».',
    depannage: [
      { symptome: 'Le service ne répond pas de l’extérieur', cause: 'Le pare-feu du serveur (ou une liste d’accès sur l’interface externe) bloque le port, ou le serveur n’écoute pas sur ce port.', action: 'Teste d’abord depuis le réseau interne vers le port local, puis ouvre le port public.' },
      { symptome: 'La commande est refusée', cause: 'La même adresse et le même port sont déjà utilisés par une autre règle.', action: 'Lis « show running-config | include ip nat » et retire l’ancienne règle.' },
    ],
    sources: [SRC_NAT, SRC_NATCMD],
    figures: ['nat-vocabulaire', 'socket-ports'],
    rappel: { titre: 'Rappel : redirection de port', points: ['Une adresse publique + un port public → un serveur privé + un port privé.', 'Plus précis que le NAT statique : seul le port choisi est ouvert.', 'Toujours « ip nat inside » et « ip nat outside » sur les interfaces.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-nat-verifier',
    titre: 'Lire et vider la table NAT',
    resume: 'Voir les traductions en cours, les compteurs, et au besoin effacer les traductions dynamiques pour repartir à zéro.',
    effet: 'lecture',
    intentions: ['show ip nat translations', 'voir la table nat', 'nat ne marche pas', 'clear ip nat translation', 'debug ip nat', 'statistiques nat'],
    motsCles: ['nat', 'show ip nat translations', 'statistics', 'clear', 'debug', 'inside', 'outside', 'cisco', 'routeur'],
    params: [],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Lire la table et les compteurs', '« translations » liste chaque correspondance (inside local = adresse privée, inside global = adresse publique) ; « statistics » donne les interfaces marquées, les « hits » et les « misses ». Des « misses » qui montent sans « hits » signalent une règle qui ne correspond à rien.',
        [priv('show ip nat translations'), priv('show ip nat translations verbose'), priv('show ip nat statistics')], 'Des lignes avec adresses et ports ; « Outside interfaces » et « Inside interfaces » nommées.'),
      lec('Contrôler les marques et les règles', 'La première commande doit montrer « ip nat inside » et « ip nat outside » sur les bonnes interfaces ; la seconde, les règles.',
        [priv('show running-config | include ip nat'), priv('show access-lists')], 'Une ligne « ip nat inside » et une « ip nat outside » ; les règles « ip nat inside source … ».'),
      itr('Effacer les traductions dynamiques', 'Utile avant un nouveau test, car une ancienne ligne peut masquer une erreur de configuration. Les communications en cours sont coupées et se rétablissent d’elles-mêmes. Les traductions statiques ne sont pas touchées.',
        [priv('clear ip nat translation *')], 'Aucun message ; la table se vide de ses lignes dynamiques.', { facultatif: true }),
    ],
    verification: ['Tu sais dire quelle adresse est privée (inside local) et laquelle est publique (inside global), et si le trafic correspond à une règle (les « hits » montent).'],
    retour: null,
    sources: [SRC_NAT],
    figures: ['nat-vocabulaire'],
    rappel: { titre: 'Rappel : lire la table NAT', points: ['inside local = adresse privée ; inside global = adresse publique de ce même poste.', 'outside global = adresse du correspondant sur Internet.', '« clear ip nat translation * » vide la table dynamique avant un nouveau test.'] },
  }),
  // ===========================================================================
  // Récapitulation de routes
  // ===========================================================================
  ficheIos({
    id: 'cours-route-recap-statique',
    titre: 'Route statique récapitulative (plusieurs réseaux en une ligne)',
    resume: 'Remplace plusieurs routes statiques vers des réseaux voisins par une seule route qui les couvre tous.',
    effet: 'modification',
    intentions: ['route récapitulative', 'résumé de routes', 'route sommaire', 'route summary', 'regrouper des routes statiques', 'supernet', 'agréger des routes', 'null0'],
    motsCles: ['récapitulation', 'route récapitulative', 'summary', 'ip route', 'null0', 'supernet', 'masque', 'routeur', 'cisco', 'routage'],
    params: [
      { id: 'reseau', label: 'adresse du réseau récapitulatif', type: 'ipv4', exemple: '192.168.0.0', aide: 'Le premier numéro de la plage regroupée : pour 192.168.0.0 à 192.168.3.0 (quatre /24), c’est 192.168.0.0.' },
      { id: 'masque', label: 'masque du réseau récapitulatif', type: 'choix', choix: MASQUES, exemple: '255.255.252.0', aide: 'Le masque qui couvre exactement les réseaux regroupés : quatre /24 voisins = /22 = 255.255.252.0.' },
      { id: 'saut', label: 'adresse du routeur voisin (saut suivant)', type: 'ipv4', exemple: '10.0.0.2', aide: 'Le voisin par lequel passer pour atteindre tous ces réseaux : le même pour chacun, sinon on ne peut pas les regrouper.' },
    ],
    privileges: ENABLE,
    etapes: [
      lec('Repérer les routes à regrouper', 'Les réseaux doivent être CONTIGUS, alignés sur une frontière de puissance de deux, et passer par le même voisin. Quatre /24 de 192.168.0.0 à 192.168.3.0 se regroupent en un /22 ; 192.168.1.0 à 192.168.4.0 ne se regroupent pas.',
        [priv('show ip route static')], 'Plusieurs lignes « S » vers des réseaux voisins avec le même saut suivant.'),
      mod('Ajouter la route récapitulative', 'Une seule ligne couvre tous les réseaux : moins de lignes dans la table, moins de mémoire, et une table plus stable (un lien d’un réseau regroupé qui tombe ne la modifie pas).',
        [cfg('ip route {{reseau}} {{masque}} {{saut}}')], 'Aucun message : une ligne S apparaît avec le /22 (ou le préfixe choisi).'),
      mod('Variante : route vers Null0 sur le routeur qui possède les réseaux', 'Sur le routeur qui porte vraiment ces réseaux, une route récapitulative vers l’interface Null0 (qui jette les paquets) évite qu’un paquet pour une adresse inexistante tourne en boucle. Les routes plus précises des réseaux réels restent prioritaires.',
        [cfg('ip route {{reseau}} {{masque}} Null0')], 'Aucun message : la ligne S apparaît « directly connected, Null0 ».', { facultatif: true }),
      lec('Contrôler', 'La route récapitulative doit apparaître avec le code S. Ensuite, retire les anciennes routes détaillées (« no ip route … ») et reteste : la communication doit continuer.',
        [priv('show ip route static'), priv('show ip route {{reseau}} {{masque}}')], 'Une ligne « S  192.168.0.0/22 [1/0] via 10.0.0.2 ».'),
    ],
    verification: ['Une seule route S couvre tous les réseaux regroupés et les pings vers chacun d’eux réussissent encore après le retrait des routes détaillées.'],
    retour: 'Pour défaire : étapes « Annuler ».',
    depannage: [
      { symptome: 'Un réseau n’est plus joignable après le regroupement', cause: 'Il n’appartient pas à la plage couverte (réseaux non contigus) ou son saut suivant est différent.', action: 'Recalcule la plage : le premier et le dernier réseau doivent tenir dans le préfixe choisi.' },
      { symptome: 'La commande est refusée', cause: 'L’adresse du réseau n’est pas alignée sur le masque (bits d’hôte non nuls).', action: 'Utilise le premier numéro de la plage : pour un /22, le troisième nombre doit être un multiple de 4.' },
    ],
    sources: [SRC_NULL, SRC_NATCMD],
    figures: ['route-recap'],
    rappel: { titre: 'Rappel : récapitulation', points: ['Regrouper des réseaux contigus en un préfixe plus court : quatre /24 voisins = un /22.', 'On cherche la partie commune des adresses en binaire : on garde ces bits, on met le reste à zéro.', 'Règle d’alignement : le nombre de réseaux regroupés est une puissance de 2 et le premier est un multiple de ce nombre.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-route-recap-rip',
    titre: 'Résumé de routes annoncé par RIPv2 (ip summary-address rip)',
    resume: 'Fait annoncer par RIPv2 un seul préfixe regroupant plusieurs réseaux, sur l’interface vers le voisin.',
    effet: 'modification',
    intentions: ['ip summary-address rip', 'résumé rip', 'route récapitulative rip', 'rip summary', 'regrouper les routes annoncées'],
    motsCles: ['rip', 'ripv2', 'summary-address', 'récapitulation', 'résumé', 'interface', 'routeur', 'cisco', 'routage'],
    params: [
      { id: 'interface', label: 'interface vers le voisin RIP', type: 'interfaceRouteur', exemple: 'Se0/0/0', aide: 'L’interface par laquelle le résumé est ANNONCÉ au voisin (pas celle des réseaux regroupés).' },
      { id: 'reseau', label: 'adresse du réseau récapitulatif', type: 'ipv4', exemple: '192.168.0.0', aide: 'Le premier numéro de la plage regroupée.' },
      { id: 'masque', label: 'masque du réseau récapitulatif', type: 'choix', choix: MASQUES, exemple: '255.255.252.0', aide: 'Quatre /24 voisins = /22 = 255.255.252.0.' },
    ],
    privileges: ENABLE,
    etapes: [
      lec('Contrôler RIPv2', 'Le résumé manuel n’existe qu’en RIP version 2. Vérifie la version et que « no auto-summary » est bien posé, sinon le résumé automatique de classe interfère.',
        [priv('show ip protocols')], '« Default version control: send version 2, receive version 2 » et « Automatic network summarization is not in effect ».'),
      mod('Annoncer le résumé sur l’interface du voisin', 'La commande est SUR L’INTERFACE de sortie : le voisin reçoit un seul préfixe au lieu de plusieurs routes. Les réseaux détaillés restent connus localement.',
        [cfg('interface {{interface}}'), itf('ip summary-address rip {{reseau}} {{masque}}')], 'Aucun message.'),
      lec('Contrôler chez le voisin', 'Sur le routeur voisin, la table doit montrer la ligne R avec le préfixe regroupé et non plus les réseaux détaillés (patiente un cycle de 30 secondes).',
        [priv('show ip route rip')], 'Une ligne « R  192.168.0.0/22 [120/1] via … ».'),
    ],
    verification: ['Le voisin ne voit plus qu’une route R pour le préfixe regroupé et les pings vers chaque réseau regroupé réussissent.'],
    retour: 'Pour défaire : étape « Annuler » (même commande avec « no » sur la même interface).',
    sources: [SRC_RIP],
    figures: ['route-recap'],
    rappel: { titre: 'Rappel : résumé RIPv2', points: ['Le résumé manuel RIP se pose sur l’interface qui annonce.', 'Il faut RIPv2 : la version 1 ne transporte pas de masque.', 'Le voisin reçoit un préfixe plus court : table plus petite.'] },
  }),
];
