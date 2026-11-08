/**
 * cours-fiches-cisco-reseau.mjs — KJEMO-CISCO-COURS-RESEAU-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiches Cisco IOS tirées des cours « Architecture réseau II » des semaines
 * 1 à 5 : configuration de base, adresse de gestion, vitesse et duplex,
 * diagnostic d'un port, ports inutilisés, sécurité des ports, interface de
 * routeur, routes statiques (et de secours), ping et traceroute, RIPv2, puis
 * VTP, VLAN étendus, DTP et dépannage, et enfin la configuration portable.
 *
 * Rédigées à la main, dans nos mots : ni les diapositives ni les énoncés ne
 * sont republiés. Ce qui existait déjà n'est pas refait : SSH (scénario
 * `scenario-cisco-ssh-commutateur`), VLAN (`cisco-creer-vlan`), lecture des
 * routes (`cisco-voir-routes`) et les assistants VTP / DTP / port-security sont
 * REPRIS, pas dupliqués : les fiches qui les prolongent portent `assistant`.
 * Les commandes ne sont jamais exécutées par le Toolkit.
 */
import { V_COURS } from './cours-outils.mjs';

const C2960 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960';
const SRC_INT = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring Interface Characteristics', url: `${C2960}/swint.html` };
const SRC_TRAFIC = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring Port-Based Traffic Control (port security)', url: `${C2960}/swtrafc.html` };
const SRC_VTP = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring VTP', url: `${C2960}/swvtp.html` };
const SRC_VLAN = { label: 'Catalyst 2960 (12.2(55)SE) — Configuring VLANs (trunks, DTP)', url: `${C2960}/swvlan.html` };
const SRC_ADMIN = { label: 'Catalyst 2960 (12.2(55)SE) — Administering the Switch', url: `${C2960}/swadmin.html` };
const SRC_RIP = { label: 'Cisco — Routing Information Protocol (RIP) : foire aux questions', url: 'https://www.cisco.com/c/en/us/support/docs/ip/routing-information-protocol-rip/13788-3.html' };
const SRC_ROUTE = { label: 'Cisco — Comment le routeur choisit la meilleure route (distance administrative)', url: 'https://www.cisco.com/c/en/us/support/docs/ip/border-gateway-protocol-bgp/15986-admin-distance.html' };

const CATEGORIE = 'Réseau et Cisco';
const V_CISCO = `${V_COURS} Les sorties montrées sont des exemples écrits pour expliquer, pas des captures d’équipement.`;

// Lignes IOS : l'invite s'affiche à côté, elle n'est jamais copiée.
const L = (invite) => (cmd, extra = {}) => ({ invite, cmd, ...extra });
const priv = L('Router#');
const cfg = L('Router(config)#');
const itf = L('Router(config-if)#');
const rte = L('Router(config-router)#');
const lig = L('Device(config-line)#');
const swp = L('Switch#');
const swc = L('Switch(config)#');
const swi = L('Switch(config-if)#');
const swr = L('Switch(config-if-range)#');
const dev = L('Device#');
const devc = L('Device(config)#');

const etape = (effet) => (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet, explication, lignes, attendu, ...extra });
const lec = etape('lecture');
const mod = etape('modification');
const cut = etape('interruption');

/** Masques en notation pointée, du /8 au /30 (le préfixe fait foi, le masque se recopie). */
const MASQUES = ['255.0.0.0', '255.128.0.0', '255.192.0.0', '255.224.0.0', '255.240.0.0', '255.248.0.0', '255.252.0.0', '255.254.0.0',
  '255.255.0.0', '255.255.128.0', '255.255.192.0', '255.255.224.0', '255.255.240.0', '255.255.248.0', '255.255.252.0', '255.255.254.0',
  '255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.255.248', '255.255.255.252'];
const MASQUE = { id: 'masque', label: 'masque de sous-réseau', type: 'choix', choix: MASQUES, exemple: '255.255.255.224', aide: 'Le masque en notation pointée : /24 = 255.255.255.0, /27 = 255.255.255.224, /29 = 255.255.255.248, /30 = 255.255.255.252. Le tableau « masques » du résumé les donne tous.' };
const INTERFACE_ROUTEUR = { id: 'interface', label: 'interface du routeur', type: 'interfaceRouteur', exemple: 'Gi0/0', aide: 'Une interface physique de ROUTEUR : Gi0/0, Gi0/0/0, Fa0/0 ou Se0/0/0 (série). Les numéros d’un routeur partent de 0.' };
const INTERFACE_COMMUTATEUR = { id: 'interface', label: 'port du commutateur', type: 'interfaceIos', exemple: 'Fa0/6', aide: 'Un port du commutateur (Fa0/6, Gi0/1…). Les numéros d’un commutateur partent de 1.' };

/** Fiche IOS (une seule méthode « ios »). */
function ficheIos({ id, titre, resume, effet, intentions, motsCles, params = [], privileges, etapes, verification, retour = null, depannage = null, sources, figures = [], rappel = null, assistant = null }) {
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
    assistant,
    sources,
    validation: V_CISCO,
    origine: 'cours',
    ...(figures.length ? { figures } : {}),
    ...(rappel ? { rappel } : {}),
  };
}

const ENABLE = 'Mode de configuration globale (enable puis configure terminal).';

export const COURS_CISCO_RESEAU = [
  // ===========================================================================
  // Configuration de base (TP2) et adresse de gestion
  // ===========================================================================
  ficheIos({
    id: 'cours-base-peripherique',
    titre: 'Configuration de base d’un commutateur ou d’un routeur',
    resume: 'Les réglages du début de chaque laboratoire : nom, résolution de noms coupée, mot de passe console, mot de passe privilégié chiffré, chiffrement des mots de passe et bannière. Les mots de passe se tapent sur la console, jamais dans la fiche.',
    effet: 'modification',
    intentions: ['configuration de base switch routeur', 'hostname no ip domain-lookup', 'mot de passe console enable secret', 'banner motd', 'service password-encryption', 'tp2 configuration des périphériques intermédiaires'],
    motsCles: ['hostname', 'domain-lookup', 'enable secret', 'line console', 'banner motd', 'service password-encryption', 'cisco', 'base'],
    params: [
      { id: 'hote', label: 'nom de l’équipement (hostname)', type: 'hote', exemple: 'R1', aide: 'Lettres, chiffres et tirets : R1, SW1… Ce nom change l’invite de commande.' },
      { id: 'message', label: 'texte de la bannière', type: 'texteAscii', max: 100, exemple: 'Acces interdit aux personnes non-autorisees', aide: 'Sans accent (IOS n’accepte que l’ASCII) et sans le caractère #, qui sert de délimiteur.' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Nommer l’équipement et couper la résolution de noms', 'hostname change le nom de l’invite. no ip domain-lookup empêche IOS de chercher un serveur DNS quand tu tapes une commande inconnue (sinon la console se fige pendant une minute).',
        [devc('hostname {{hote}}'), devc('no ip domain-lookup')], 'L’invite prend aussitôt le nouveau nom. Aucun autre message.'),
      mod('Protéger la console par un mot de passe', 'La ligne est volontairement incomplète : tu tapes toi-même le mot de passe juste après « password ». Il ne figure jamais dans la fiche.',
        [devc('line console 0'), lig('password', { secret: true })],
        'Aucun message : l’invite revient.',
        { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « password » suivi d’une espace.', reponds: 'Tape le mot de passe demandé par ton énoncé sur la console, puis Entrée. Il s’affiche en clair pendant la frappe : vérifie que personne ne regarde.' }] }),
      mod('Exiger ce mot de passe à la connexion', 'Sans login, la ligne console ne demande rien même si un mot de passe est posé.',
        [lig('login'), lig('exit')], 'Aucun message.'),
      mod('Protéger le mode privilégié (enable secret)', 'enable secret stocke une empreinte du mot de passe, contrairement à enable password. Même principe : tu tapes le mot de passe après « secret ».',
        [devc('enable secret', { secret: true })], 'Aucun message : l’invite revient.',
        { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « secret » suivi d’une espace.', reponds: 'Tape le mot de passe privilégié demandé par ton énoncé, puis Entrée.' }] }),
      mod('Chiffrer les mots de passe de la configuration', 'service password-encryption brouille (chiffrement faible de type 7) les mots de passe en clair qui restent, comme celui de la console.',
        [devc('service password-encryption')], 'Aucun message.',
        { important: 'C’est un brouillage, pas une vraie protection : un outil gratuit le défait. Il évite seulement qu’un mot de passe se lise par-dessus l’épaule dans la configuration.' }),
      mod('Poser la bannière du jour', 'La bannière s’affiche avant la connexion. Le « # » est le délimiteur de début et de fin du texte.',
        [devc('banner motd # {{message}} #')], 'Aucun message. La bannière apparaît à la prochaine connexion.',
        { important: 'Rédige un avertissement sobre (accès réservé). Jamais « bienvenue » : elle pourrait être citée contre toi dans un litige.' }),
      lec('Contrôler', 'Relit les lignes posées. Le mot de passe de la console apparaît brouillé.',
        [dev('show running-config'), dev('show startup-config')],
        'hostname, no ip domain-lookup, banner motd, enable secret 5 (empreinte), line con 0 avec password 7 et login.',
        { important: 'show startup-config ne montre que ce qui a été enregistré : si rien ne ressort, enregistre avec la fiche « Enregistrer la configuration du commutateur ».' }),
    ],
    verification: ['L’invite porte le nom voulu, la console et le mode privilégié demandent un mot de passe, et la bannière s’affiche à la reconnexion.'],
    retour: 'Pour défaire : « no banner motd », « no enable secret », « line console 0 » puis « no password » et « no login », « no service password-encryption », « ip domain-lookup ».',
    sources: [SRC_ADMIN],
    assistant: 'cisco-identification',
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-sw-gestion-ip',
    titre: 'Adresse de gestion d’un commutateur : interface VLAN et passerelle',
    resume: 'Donne une adresse IP au commutateur (l’interface virtuelle, SVI) et une passerelle par défaut, pour l’administrer à distance, par exemple en SSH depuis un autre réseau.',
    effet: 'modification',
    intentions: ['adresse ip commutateur interface vlan 1', 'default-gateway switch', 'svi gestion switch', 'ip de gestion du switch', 'tp2 vlan 1 ip switch'],
    motsCles: ['svi', 'interface vlan', 'ip address', 'default-gateway', 'gestion', 'switch', 'cisco', 'ssh'],
    params: [
      { id: 'vlan', label: 'VLAN de gestion', type: 'entier', min: 1, max: 4094, exemple: '1', aide: 'Le VLAN dont on veut l’adresse. Par défaut 1 ; en production, un VLAN dédié à la gestion.' },
      { id: 'ip', label: 'adresse IP du commutateur', type: 'ipv4', exemple: '192.168.5.93', aide: 'Une adresse d’hôte du réseau du VLAN. Convention du TP : adresse HAUTE pour les commutateurs et routeurs, basse pour les postes.' },
      MASQUE,
      { id: 'passerelle', label: 'passerelle par défaut', type: 'ipv4', exemple: '192.168.5.94', aide: 'L’adresse du routeur sur ce réseau. Sans elle, le commutateur ne répond pas aux machines d’autres réseaux.' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Donner l’adresse à l’interface VLAN', 'L’interface VLAN (SVI) est l’interface virtuelle par laquelle le commutateur lui-même joint le réseau. no shutdown l’allume : elle monte seulement si au moins un port du VLAN est actif.',
        [swc('interface vlan {{vlan}}'), swi('ip address {{ip}} {{masque}}'), swi('no shutdown'), swi('exit')],
        'Après quelques secondes : « %LINK-5-CHANGED: Interface Vlan1, changed state to up ».'),
      mod('Fixer la passerelle par défaut', 'Sur un commutateur de niveau 2, la passerelle se pose en configuration globale avec ip default-gateway (et non avec ip route).',
        [swc('ip default-gateway {{passerelle}}')], 'Aucun message.',
        { important: 'Sur un commutateur de niveau 3 qui route, on utilise plutôt « ip route 0.0.0.0 0.0.0.0 … » : ip default-gateway ne s’applique pas.' }),
      lec('Contrôler', 'L’interface doit être « up/up » avec la bonne adresse ; le ping vers la passerelle prouve la liaison.',
        [swp('show ip interface brief'), swp('ping {{passerelle}}')],
        'Vlan1 « up up » avec l’adresse choisie. Le ping affiche !!!!! (le premier point est normal : ARP).'),
    ],
    verification: ['show ip interface brief montre l’interface VLAN up/up avec la bonne adresse, et le ping vers la passerelle réussit.'],
    retour: 'Pour défaire : « no ip default-gateway » et, sur l’interface VLAN, « no ip address » ou « shutdown ».',
    depannage: [
      { symptome: 'Vlan1 reste « down/down »', cause: 'Aucun port du VLAN n’est actif (câbles débranchés ou ports éteints), ou l’interface a été laissée en shutdown.', action: 'Lis « show interfaces status » et branche ou rallume au moins un port de ce VLAN, puis « no shutdown » sur l’interface VLAN.' },
      { symptome: 'Le ping vers la passerelle échoue', cause: 'Mauvais masque, passerelle hors du réseau, ou le routeur n’a pas son interface allumée.', action: 'Compare l’adresse, le masque et la passerelle au plan d’adressage, puis lis « show ip interface brief » sur le routeur.' },
    ],
    sources: [SRC_ADMIN],
    assistant: 'cisco-gestion-ip',
  }),
  // ===========================================================================
  // Ports d'un commutateur (semaine 2)
  // ===========================================================================
  ficheIos({
    id: 'cours-sw-duplex-vitesse',
    titre: 'Régler la vitesse, le duplex et l’auto-MDIX d’un port',
    resume: 'Fixe à la main la vitesse et le duplex d’un port (liens vers un serveur ou un autre équipement connu), ou rend la main à la négociation automatique avec auto-MDIX. Les deux bouts doivent concorder.',
    effet: 'interruption',
    intentions: ['duplex vitesse port switch', 'speed duplex full', 'auto-mdix', 'duplex mismatch', 'negociation automatique port'],
    motsCles: ['speed', 'duplex', 'mdix', 'auto-negociation', 'port', 'switch', 'cisco'],
    params: [
      INTERFACE_COMMUTATEUR,
      { id: 'vitesse', label: 'vitesse (Mbit/s)', type: 'choix', choix: ['10', '100', '1000'], exemple: '100', aide: '10 ou 100 sur Fast Ethernet ; 1000 seulement sur un port Gigabit.' },
      { id: 'duplex', label: 'duplex', type: 'choix', choix: ['full', 'half'], exemple: 'full', aide: 'full = les deux sens en même temps (le cas normal) ; half = un sens à la fois.' },
    ],
    privileges: ENABLE,
    etapes: [
      lec('Lire l’état actuel du port', 'Les colonnes Duplex et Speed disent ce que le port a réellement négocié (a-full, a-100 : « a » = négocié automatiquement).',
        [swp('show interfaces {{interface}} status')], 'Une ligne : état connected, duplex et vitesse.'),
      cut('Fixer la vitesse et le duplex à la main', 'Utile vers un serveur ou un équipement connu qui n’annonce pas bien sa configuration. La liaison peut tomber quelques secondes. Fais la même chose à l’autre bout.',
        [swc('interface {{interface}}'), swi('speed {{vitesse}}'), swi('duplex {{duplex}}')],
        'Le lien retombe puis remonte. Aucun message d’erreur.',
        { important: 'Un seul bout fixé et l’autre en automatique produit un duplex mismatch : lien lent, erreurs CRC et collisions tardives. Fixe les deux bouts ou aucun.' }),
      mod('Revenir à la négociation automatique avec auto-MDIX', 'auto-MDIX détecte le type de câble (droit ou croisé) et s’adapte. Sur un 2960, la vitesse et le duplex doivent alors être en automatique.',
        [swc('interface {{interface}}'), swi('speed auto'), swi('duplex auto'), swi('mdix auto')],
        'Aucun message.', { facultatif: true }),
      lec('Contrôler', 'Relit l’état du port et son réglage.',
        [swp('show interfaces {{interface}} status'), swp('show running-config interface {{interface}}')],
        'Le port est « connected » avec le duplex et la vitesse voulus, ou négociés (a-full, a-100).'),
    ],
    verification: ['Les deux bouts affichent le même duplex et la même vitesse, sans erreur sur le port.'],
    retour: 'Pour revenir au réglage automatique : « speed auto » et « duplex auto » sur le port.',
    sources: [SRC_INT],
    figures: ['sw-etats-port'],
    rappel: { titre: 'Rappel : duplex, vitesse et auto-MDIX', points: ['Full duplex = envoi et réception en même temps, donc toute la bande passante dans chaque sens ; half duplex = un sens à la fois, avec collisions possibles.', 'La négociation automatique convient quand on ne connaît pas l’autre bout ; vers un équipement connu (serveur), on peut fixer les deux bouts à la main.', 'Un duplex mismatch (un bout fixé, l’autre auto) donne un lien « up » mais lent, avec erreurs CRC et collisions tardives.', 'auto-MDIX choisit tout seul câble droit ou croisé ; il demande vitesse et duplex en automatique.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-sw-diagnostiquer-port',
    titre: 'Diagnostiquer un port : état, protocole de ligne et erreurs',
    resume: 'Lit l’état d’un port (up, down, administratively down, err-disabled), l’état du protocole de ligne et les compteurs d’erreurs, puis oriente vers la cause : câble, port éteint, duplex ou protection.',
    effet: 'lecture',
    intentions: ['port down switch', 'show interfaces erreurs crc', 'line protocol down', 'administratively down', 'err-disabled diagnostic', 'dépanner problème accès réseau switch'],
    motsCles: ['show interfaces', 'line protocol', 'crc', 'collisions', 'err-disabled', 'administratively down', 'cisco', 'diagnostic'],
    params: [INTERFACE_COMMUTATEUR],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Vue d’ensemble des ports', 'Une ligne par port : état, VLAN, duplex, vitesse. C’est le premier regard pour voir quel port est down ou err-disabled.',
        [swp('show ip interface brief'), swp('show interfaces status')],
        'Status/Protocol : up/up = en service ; down/down = rien de branché ; administratively down = éteint ; err-disabled = coupé par une protection.'),
      lec('Détail d’un port', 'Le bloc donne l’état, le duplex, la vitesse, et les compteurs d’erreurs depuis le dernier effacement.',
        [swp('show interfaces {{interface}}')], '« FastEthernet0/6 is up, line protocol is up » ; en bas : input errors, CRC, collisions, late collision.'),
      lec('Compteurs d’erreurs seulement', 'Pour isoler les erreurs CRC, d’alignement, de trames trop courtes ou trop longues.',
        [swp('show interfaces {{interface}} counters errors')], 'Des compteurs à zéro ou presque. Une valeur qui grimpe avec le trafic signale un câble ou un duplex à corriger.'),
    ],
    verification: ['Tu peux dire pour le port : est-il en service, pourquoi sinon, et ses compteurs d’erreurs augmentent-ils ?'],
    depannage: [
      { symptome: 'Le port est « down / down »', cause: 'Câble absent ou défectueux, autre bout éteint ou en panne.', action: 'Vérifie le câble et l’état du port d’en face avant toute modification de configuration.' },
      { symptome: 'Le port est « administratively down »', cause: 'Quelqu’un l’a éteint avec shutdown.', action: 'Si c’est voulu, laisse-le ; sinon « interface … » puis « no shutdown ».' },
      { symptome: 'Le port est « up / down » (interface up, protocole down)', cause: 'Incohérence entre les deux bouts (encapsulation, type de lien) ou autre bout en erreur.', action: 'Compare la configuration des deux bouts et lis « show interfaces » des deux côtés.' },
      { symptome: 'Le port est « err-disabled »', cause: 'Une protection l’a coupé : sécurité des ports, BPDU guard, etc.', action: 'Corrige la cause (poste ou commutateur non autorisé), puis « shutdown » et « no shutdown ». Voir les fiches sécurité des ports et PortFast.' },
      { symptome: 'Le lien est up mais lent, avec des erreurs CRC et collisions tardives', cause: 'Duplex mismatch : un bout fixé, l’autre en automatique.', action: 'Aligne les deux bouts (fiche « vitesse, duplex et auto-MDIX »).' },
    ],
    sources: [SRC_INT],
    figures: ['sw-etats-port'],
    rappel: { titre: 'Rappel : lire « up » et « down »', points: ['Le premier mot est l’état de la couche 1 (le lien), le second est le protocole de ligne (la couche 2) : up/up est le seul état sain.', 'administratively down = éteint volontairement ; down/down = pas de lien physique.', 'Les erreurs CRC et les collisions tardives viennent surtout d’un mauvais câble ou d’un duplex mismatch.', 'On lit les deux bouts du lien avant de conclure.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-sw-ports-inutilises',
    titre: 'Désactiver les ports inutilisés d’un commutateur',
    resume: 'Éteint d’un coup une plage de ports non utilisés pour empêcher le branchement d’un appareil non autorisé, et peut les parquer dans un VLAN sans usage.',
    effet: 'modification',
    intentions: ['désactiver ports inutilisés', 'shutdown ports switch', 'interface range shutdown', 'sécuriser ports inutilisés vlan poubelle', 'blackhole vlan'],
    motsCles: ['shutdown', 'interface range', 'ports inutilisés', 'sécurité', 'vlan', 'switch', 'cisco'],
    params: [
      { id: 'premier', label: 'premier port de la plage', type: 'interfaceIos', exemple: 'Fa0/5', aide: 'Le premier port inutilisé (Fa0/5…).' },
      { id: 'dernier', label: 'numéro du dernier port de la plage', type: 'entier', min: 1, max: 48, exemple: '24', aide: 'Le NUMÉRO du dernier port, du même type : 24 pour aller jusqu’à Fa0/24.' },
      { id: 'parc', label: 'VLAN de parcage (sans usage)', type: 'vlan', exemple: '999', aide: 'Un VLAN que personne n’utilise (999). Il doit exister : crée-le d’abord avec la fiche « Créer un VLAN ».' },
    ],
    privileges: ENABLE,
    etapes: [
      lec('Repérer les ports en service', 'Ne touche que les ports que tu sais inutilisés : lis d’abord ceux qui sont connectés.',
        [swp('show interfaces status')], 'Les ports « connected » sont en service, les autres sont candidats.'),
      mod('Éteindre la plage', 'interface range choisit plusieurs ports d’un coup ; shutdown les éteint. Un appareil branché plus tard n’obtient aucun accès.',
        [swc('interface range {{premier}} - {{dernier}}'), swr('shutdown')], 'Les voyants de ces ports passent à l’orange ou s’éteignent.',
        { important: 'Contrôle la plage : si un port actif en fait partie, tu le coupes. Dans un TP, vérifie le plan avant.' }),
      mod('Parquer les ports dans un VLAN sans usage', 'En plus de l’extinction, on les place en accès dans un VLAN qui ne mène nulle part : si quelqu’un les rallume, il tombe dans le vide.',
        [swc('interface range {{premier}} - {{dernier}}'), swr('switchport mode access'), swr('switchport access vlan {{parc}}')], 'Aucun message si le VLAN existe.',
        { facultatif: true }),
      lec('Contrôler', 'Les ports de la plage sont désormais « disabled » (ou « notconnect » si seulement parqués).',
        [swp('show interfaces status')], 'Status « disabled » pour la plage, et le VLAN de parcage dans la colonne Vlan.'),
    ],
    verification: ['Tous les ports inutilisés sont « disabled », et seuls les ports voulus restent connectés.'],
    retour: 'Pour rendre un port : « interface … » puis « no shutdown » et remettre son VLAN d’origine.',
    sources: [SRC_INT],
    rappel: { titre: 'Rappel : fermer les ports inutilisés', points: ['Un port libre est une porte d’entrée : on l’éteint (shutdown) avant de mettre le commutateur en production.', 'interface range agit sur plusieurs ports à la fois : relis la plage avant de valider.', 'Le VLAN de parcage ajoute une seconde barrière : même rallumé, le port n’atteint rien d’utile.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-sw-portsec',
    titre: 'Sécurité des ports : limiter, apprendre et sanctionner (un port)',
    resume: 'Limite les adresses MAC admises sur un port d’accès, les apprend (sticky) ou les fixe, et choisit la sanction : ignorer (protect), journaliser (restrict) ou couper le port (shutdown).',
    effet: 'modification',
    intentions: ['port-security sticky', 'switchport port-security maximum', 'violation shutdown restrict protect', 'limiter adresses mac par port', 'remettre port err-disabled port-security', 'sécurité des ports tp2'],
    motsCles: ['port-security', 'sticky', 'violation', 'maximum', 'mac-address', 'err-disabled', 'switch', 'cisco', 'sécurité'],
    params: [
      INTERFACE_COMMUTATEUR,
      { id: 'maximum', label: 'nombre maximal d’adresses MAC', type: 'entier', min: 1, max: 132, exemple: '1', aide: 'Combien d’appareils différents le port admet. 1 pour un seul poste.' },
      { id: 'violation', label: 'sanction en cas de violation', type: 'choix', choix: ['shutdown', 'restrict', 'protect'], exemple: 'shutdown', aide: 'shutdown coupe le port (err-disabled) ; restrict ignore et journalise ; protect ignore sans rien dire.' },
      { id: 'mac', label: 'adresse MAC autorisée (étape facultative)', type: 'macIos', exemple: '0001.4321.abcd', aide: 'Au format IOS aaaa.bbbb.cccc. Sert seulement si tu fixes une adresse à la main.' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Mettre le port en accès', 'La sécurité des ports ne marche que sur un port d’accès ou un trunk fixé : jamais sur un port encore « dynamic ».',
        [swc('interface {{interface}}'), swi('switchport mode access')], 'Aucun message.'),
      mod('Activer la sécurité et fixer le maximum', 'Sans la deuxième ligne le maximum reste à 1. Au-delà de la limite, une nouvelle adresse est une violation.',
        [swi('switchport port-security'), swi('switchport port-security maximum {{maximum}}')], 'Aucun message.'),
      mod('Apprendre les adresses (sticky)', 'sticky mémorise la première adresse vue et l’ajoute à la configuration courante : elle survit à un redémarrage seulement une fois la configuration enregistrée.',
        [swi('switchport port-security mac-address sticky')], 'Aucun message. L’adresse apparaît après le premier trafic.'),
      mod('Fixer une adresse à la main', 'Variante à la place (ou en plus) de sticky : tu écris toi-même l’adresse autorisée.',
        [swi('switchport port-security mac-address {{mac}}')], 'Aucun message.', { facultatif: true }),
      mod('Choisir la sanction', 'shutdown est le mode par défaut et le plus strict : le port tombe en err-disabled à la première violation.',
        [swi('switchport port-security violation {{violation}}')], 'Aucun message.'),
      lec('Contrôler', 'Le résumé liste les ports sécurisés ; le détail donne le maximum, la sanction et le nombre de violations.',
        [swp('show port-security'), swp('show port-security interface {{interface}}'), swp('show port-security address')],
        'Port Status « Secure-up », Violation Mode et Maximum conformes, adresse apprise de type SecureSticky.'),
      cut('Remettre en service un port tombé en err-disabled', 'Après avoir retiré l’appareil fautif, on éteint puis rallume le port.',
        [swc('interface {{interface}}'), swi('shutdown'), swi('no shutdown')], 'Le port repasse à l’état « Secure-up ».', { facultatif: true }),
    ],
    verification: ['show port-security interface montre l’état Secure-up, le maximum voulu et la sanction choisie ; un appareil étranger déclenche la sanction.'],
    retour: 'Pour tout retirer : « no switchport port-security » sur le port (les adresses apprises disparaissent avec).',
    depannage: [
      { symptome: 'Le port est tombé en err-disabled juste après un branchement', cause: 'Une adresse MAC non autorisée est apparue : la sanction shutdown a coupé le port.', action: 'Débranche l’appareil, vérifie qu’il est légitime, puis « shutdown » et « no shutdown ».' },
      { symptome: 'La commande est refusée', cause: 'Le port est encore en mode dynamique (auto, desirable) ou en trunk non fixé.', action: 'Pose d’abord « switchport mode access » sur le port.' },
    ],
    sources: [SRC_TRAFIC],
    figures: ['sw-portsec-modes'],
    rappel: { titre: 'Rappel : sécurité des ports', points: ['Trois façons de connaître les adresses : statique (tu les écris), dynamique (apprises, perdues au redémarrage), sticky (apprises puis gardées dans la configuration).', 'Trois sanctions : protect (ignore sans le dire), restrict (ignore et journalise, compteur de violations), shutdown (coupe le port, err-disabled).', 'Le port doit être en accès (ou trunk fixé) pour que la fonction s’active.'] },
    assistant: 'cisco-port-security-config',
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-config-portable',
    titre: 'Sauvegarder une configuration en texte et la recharger ailleurs',
    resume: 'Copie la configuration d’un routeur dans un fichier texte, la recolle sur un autre routeur (physique ou Packet Tracer), ajuste les noms d’interfaces, retire les lignes de chiffrement qui ne se transfèrent pas, puis enregistre.',
    effet: 'modification',
    intentions: ['sauvegarder configuration fichier texte', 'transférer configuration routeur packet tracer', 'copier coller running-config', 'config portable routeur', 'formatif 3.1 sauvegarde transfert'],
    motsCles: ['running-config', 'copier coller', 'packet tracer', 'transfert', 'crypto', 'interfaces', 'cisco', 'sauvegarde'],
    params: [],
    privileges: 'Mode privilégié (enable) sur chaque routeur.',
    etapes: [
      lec('Afficher la configuration source', 'Dans la console du routeur d’origine, affiche toute la configuration. Sélectionne ensuite le texte après « Current configuration », copie-le et colle-le dans un fichier .txt : c’est ta configuration portable.',
        [priv('show running-config')], 'La configuration s’affiche en entier (appuie sur Espace pour passer les pages).'),
      lec('Noter les interfaces du routeur cible', 'Les numéros d’interface changent d’un modèle à l’autre. Relève ceux de la cible avant de coller.',
        [priv('show ip interface brief')], 'La liste des interfaces de ce routeur, par exemple GigabitEthernet0/1/0 à 0/1/3 avec le module d’extension ajouté dans Packet Tracer.'),
      mod('Préparer le fichier texte', 'Dans le fichier texte (pas sur le routeur) : remplace les noms d’interface par ceux de la cible et supprime les lignes de chiffrement (crypto key generate, ip ssh rsa keypair-name, ip ssh pubkey-chain…). Les clés SSH ne se transfèrent jamais : on les régénère sur la cible.',
        [priv('configure terminal')], 'L’invite passe en configuration globale : tu es prêt à coller.',
        { important: 'Packet Tracer n’accepte pas les commandes de cryptographie modernes d’un routeur physique. Les erreurs sur ces lignes sont attendues : ignore-les ou retire-les du fichier avant de coller.' }),
      mod('Coller le fichier dans la console', 'Colle d’un coup le contenu du fichier texte dans le terminal en configuration globale. Si des lignes sont refusées, lis le message et corrige le fichier plutôt que le routeur.',
        [cfg('end')], 'Retour à l’invite privilégiée, sans erreur sur les lignes utiles.'),
      mod('Enregistrer', 'La configuration collée vit en mémoire vive : elle disparaît au redémarrage tant qu’elle n’est pas enregistrée.',
        [priv('copy running-config startup-config')], 'Confirme le nom du fichier avec Entrée. « [OK] » s’affiche.'),
      lec('Contrôler', 'Compare l’état des interfaces au plan et teste une liaison.',
        [priv('show ip interface brief'), priv('show running-config')], 'Les interfaces voulues sont « up/up » avec les bonnes adresses.'),
    ],
    verification: ['Le routeur cible a la configuration voulue, enregistrée, sans lignes de chiffrement refusées.'],
    retour: 'Pour annuler avant d’enregistrer : redémarre le routeur sans sauvegarder (il reprend la configuration enregistrée).',
    sources: [SRC_ADMIN],
    rappel: { titre: 'Rappel : configuration portable', points: ['Une configuration copiée-collée est un simple texte : on l’édite dans un éditeur avant de l’appliquer.', 'Seuls les noms d’interface changent d’un modèle à l’autre ; le reste se transfère tel quel.', 'Les clés de chiffrement et SSH ne se transfèrent pas : on les génère sur le nouvel équipement.'] },
  }),
  // ===========================================================================
  // Routeur : adresses, routes statiques, ping et traceroute (semaines 1 à 3)
  // ===========================================================================
  ficheIos({
    id: 'cours-rt-interface-ip',
    titre: 'Donner une adresse IP à une interface de routeur (Gigabit, série)',
    resume: 'Configure l’adresse et le masque d’une interface de routeur et l’allume (une interface de routeur est éteinte par défaut). Sur un lien série, le bout DCE fixe aussi la fréquence d’horloge.',
    effet: 'modification',
    intentions: ['adresse ip interface routeur', 'ip address no shutdown routeur', 'interface série clock rate', 'configurer gigabitethernet routeur', 'tp2 interfaces routeur'],
    motsCles: ['ip address', 'no shutdown', 'clock rate', 'serial', 'gigabitethernet', 'routeur', 'cisco', 'interface'],
    params: [
      INTERFACE_ROUTEUR,
      { id: 'ip', label: 'adresse IP de l’interface', type: 'ipv4', exemple: '192.168.5.94', aide: 'Une adresse d’hôte du réseau (ni l’adresse du réseau, ni celle de diffusion). Convention du TP : adresse haute pour les routeurs.' },
      MASQUE,
    ],
    privileges: ENABLE,
    etapes: [
      lec('Voir les interfaces', 'Repère le nom exact de l’interface et son état avant de la configurer.',
        [priv('show ip interface brief')], 'Une ligne par interface : adresse (unassigned au départ) et état (administratively down au départ).'),
      mod('Poser l’adresse et allumer l’interface', 'ip address fixe l’adresse et le masque ; no shutdown allume l’interface, éteinte par défaut sur un routeur.',
        [cfg('interface {{interface}}'), itf('ip address {{ip}} {{masque}}'), itf('no shutdown')],
        '« %LINK-5-CHANGED: … changed state to up » quand le bout d’en face est branché et allumé.',
        { important: 'Les deux bouts d’un lien routeur à routeur sont dans le MÊME réseau, mais ont des adresses différentes : jamais l’adresse du réseau lui-même (premier numéro de la plage).' }),
      mod('Fixer l’horloge sur le bout DCE d’un lien série', 'Sur un lien série, un des deux bouts (le DCE, indiqué sur le câble) donne la cadence. Sans cela le protocole de ligne reste down. À faire sur UN seul bout.',
        [cfg('interface {{interface}}'), itf('clock rate 64000')], 'Aucun message. En laboratoire Packet Tracer, c’est le bout où le câble est marqué DCE.',
        { facultatif: true }),
      lec('Contrôler', 'L’interface doit être « up/up » ; le détail confirme l’adresse et le masque.',
        [priv('show ip interface brief'), priv('show interfaces {{interface}}')],
        'Status « up » et Protocol « up » avec la bonne adresse.'),
    ],
    verification: ['show ip interface brief affiche l’interface up/up avec l’adresse voulue ; le ping vers le voisin du lien réussit.'],
    retour: 'Pour défaire : « no ip address » et « shutdown » sur l’interface.',
    depannage: [
      { symptome: 'L’interface reste « administratively down »', cause: 'no shutdown n’a pas été tapé.', action: 'Entre dans l’interface et tape « no shutdown ».' },
      { symptome: 'Un lien série reste « up / down »', cause: 'Horloge absente sur le DCE, ou les deux bouts ne sont pas dans le même réseau.', action: 'Pose « clock rate » sur le bout DCE seulement et compare les deux adresses.' },
    ],
    sources: [SRC_ROUTE],
    figures: ['vlsm-masques'],
    rappel: { titre: 'Rappel : adresses d’un routeur', points: ['Une interface de routeur est éteinte tant qu’on n’a pas tapé no shutdown.', 'Chaque interface d’un routeur est dans un réseau DIFFÉRENT ; le routeur relie les réseaux.', 'Dans la plage d’un réseau, la première adresse est le réseau, la dernière est la diffusion : on n’y met aucun appareil.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-rt-statique',
    titre: 'Créer une route statique vers un réseau distant',
    resume: 'Dit au routeur par quel voisin atteindre un réseau qui n’est pas directement connecté (ip route). Chaque routeur doit connaître tous les réseaux lointains, et chacun doit avoir la route retour.',
    effet: 'modification',
    intentions: ['route statique cisco', 'ip route réseau masque next hop', 'routes statiques tp2', 'combien de routes statiques', 'ip route interface de sortie'],
    motsCles: ['ip route', 'route statique', 'next hop', 'saut suivant', 'interface de sortie', 'routeur', 'cisco', 'routage'],
    params: [
      { id: 'reseau', label: 'adresse du réseau de destination', type: 'ipv4', exemple: '192.168.5.160', aide: 'L’adresse du RÉSEAU (le premier numéro de la plage), par exemple 192.168.5.160 pour un /27.' },
      MASQUE,
      { id: 'saut', label: 'adresse du routeur voisin (saut suivant)', type: 'ipv4', exemple: '10.123.145.106', aide: 'L’adresse du voisin sur le lien que le paquet empruntera, dans un réseau connecté à ce routeur.' },
      { id: 'sortie', label: 'interface de sortie (variante)', type: 'interfaceRouteur', exemple: 'Se0/0/1', aide: 'Pour la variante par interface de sortie, sur un lien point à point.' },
    ],
    privileges: ENABLE,
    etapes: [
      lec('Voir les réseaux déjà connus', 'Repère les réseaux directement connectés (C) et ceux qui manquent. Le nombre de routes statiques à poser = réseaux du schéma moins ceux directement connectés.',
        [priv('show ip route')], 'Des lignes « C » (connecté) et « L » (adresse locale) ; aucune « S » encore.'),
      mod('Ajouter la route', 'Format : réseau, masque, puis l’adresse du voisin par lequel passer. Le voisin doit être joignable : son lien doit être connecté à ce routeur.',
        [cfg('ip route {{reseau}} {{masque}} {{saut}}')], 'Aucun message : la route apparaît dans la table avec le code S.'),
      mod('Variante : désigner l’interface de sortie', 'Sur un lien point à point (série), on peut donner l’interface au lieu du voisin. Utilise l’une ou l’autre pour un même réseau, pas les deux.',
        [cfg('ip route {{reseau}} {{masque}} {{sortie}}')], 'Aucun message. La route apparaît « directly connected, Serial… ».', { facultatif: true }),
      lec('Contrôler', 'La route doit apparaître avec le code S. Le ping depuis un poste lointain ne réussit que si le chemin retour existe aussi.',
        [priv('show ip route'), priv('show ip route {{reseau}}')], 'Une ligne « S  192.168.5.160/27 [1/0] via 10.123.145.106 ».'),
    ],
    verification: ['Le réseau lointain apparaît avec le code S dans show ip route, et un ping de bout en bout réussit dans les deux sens.'],
    retour: 'Pour retirer : la même commande précédée de « no » (« no ip route … »).',
    depannage: [
      { symptome: 'La route n’apparaît pas dans show ip route', cause: 'Le voisin n’est pas joignable (interface en panne ou adresse hors du réseau du lien) : IOS refuse d’installer la route.', action: 'Lis « show ip interface brief » et vérifie que le voisin est dans un réseau connecté.' },
      { symptome: 'Le ping échoue alors que l’aller est bon', cause: 'La route retour manque sur un autre routeur.', action: 'Pose la route inverse. Fais un ping depuis l’autre extrémité pour confirmer.' },
      { symptome: 'La route sort par la mauvaise interface', cause: 'Une route plus précise ou une distance plus faible gagne.', action: 'Lis « show ip route » : IOS retient le masque le plus long, puis la distance la plus faible.' },
    ],
    sources: [SRC_ROUTE],
    figures: ['rt-statique', 'rt-table'],
    rappel: { titre: 'Rappel : routes statiques', points: ['Une route statique est écrite à la main : ip route réseau masque voisin. Elle ne s’adapte pas à une panne.', 'Chaque routeur a besoin d’une route vers chaque réseau non directement connecté, et le chemin retour doit exister aussi.', 'Distance administrative : directement connecté 0, statique 1, RIP 120. La plus faible gagne.', 'IOS choisit d’abord le masque le plus long (route la plus précise).'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-rt-defaut-flottante',
    titre: 'Route par défaut et route statique de secours (flottante)',
    resume: 'Pose une route par défaut (0.0.0.0/0) vers le voisin qui mène à tout le reste, puis une route de secours avec une distance plus grande : elle ne sert que si la route principale disparaît.',
    effet: 'modification',
    intentions: ['route par défaut 0.0.0.0', 'route flottante secours', 'ip route distance administrative', 'lien de secours routage statique', 'tp2 partie 2 retirer lien r1 r3'],
    motsCles: ['route par défaut', '0.0.0.0', 'flottante', 'floating static', 'distance administrative', 'secours', 'cisco', 'ip route'],
    params: [
      { id: 'saut', label: 'voisin de la route principale ou par défaut', type: 'ipv4', exemple: '10.123.145.58', aide: 'Le voisin par lequel passe la route principale (et la route par défaut).' },
      { id: 'reseau', label: 'réseau à joindre en secours', type: 'ipv4', exemple: '192.168.5.160', aide: 'L’adresse du réseau pour lequel on prépare une route de secours.' },
      MASQUE,
      { id: 'secours', label: 'voisin de la route de secours', type: 'ipv4', exemple: '10.123.145.106', aide: 'Le voisin du chemin alternatif (le lien qui passe par un autre routeur).' },
      { id: 'distance', label: 'distance administrative de la route de secours', type: 'entier', min: 2, max: 254, exemple: '5', aide: 'Un nombre plus grand que la distance de la route principale (1 pour une statique). Plus il est grand, plus la route est « de dernier recours ».' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Poser la route par défaut', '0.0.0.0 avec le masque 0.0.0.0 couvre tous les réseaux non connus. Le paquet part vers ce voisin à défaut de route plus précise (utile vers Internet ou un réseau périphérique).',
        [cfg('ip route 0.0.0.0 0.0.0.0 {{saut}}')], 'Aucun message. « Gateway of last resort is … » apparaît dans show ip route.', { facultatif: true }),
      mod('Poser la route principale vers un réseau', 'La route normale, distance 1 par défaut.',
        [cfg('ip route {{reseau}} {{masque}} {{saut}}')], 'Aucun message.'),
      mod('Poser la route de secours avec une distance plus grande', 'Même destination, autre voisin, distance supérieure : IOS garde la route de distance la plus faible dans la table, et ne sort la route de secours que si la principale tombe.',
        [cfg('ip route {{reseau}} {{masque}} {{secours}} {{distance}}')], 'Aucun message. Seule la route principale figure dans la table : la route de secours « flotte » en réserve.'),
      lec('Contrôler', 'Seule la route principale s’affiche tant que le lien principal est bon. Pour tester la bascule, coupe le lien (shutdown du côté du lien principal) et relis la table.',
        [priv('show ip route'), priv('show running-config')], 'Avant la panne : la route principale (S). Après la coupure : la route de secours prend la place, avec [5/0].',
        { important: 'Ne teste la bascule qu’en laboratoire. Sur un réseau en service, couper un lien coupe aussi les utilisateurs.' }),
    ],
    verification: ['La route de secours reste invisible tant que la principale est bonne, et apparaît seule quand le lien principal est coupé.'],
    retour: 'Pour retirer : « no ip route … » avec les mêmes paramètres que ceux posés.',
    sources: [SRC_ROUTE],
    figures: ['rt-flottante'],
    rappel: { titre: 'Rappel : route flottante', points: ['Une route statique normale a la distance administrative 1. Pour la mettre en réserve, on lui donne une distance plus grande (5, par exemple).', 'La route de secours n’entre dans la table que quand la principale disparaît.', 'Le TP2 le demande en partie 2 : on retire un lien, et les réseaux se joignent par l’autre chemin.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-rt-tester',
    titre: 'Tester la connectivité d’un routeur : ping et traceroute',
    resume: 'Envoie des requêtes ping et suit le chemin avec traceroute depuis un routeur. Les symboles ! . et U disent si le paquet est passé, perdu ou refusé faute de route.',
    effet: 'lecture',
    intentions: ['ping routeur', 'traceroute cisco', 'tester connectivité réseau routeurs', 'symboles ping !!!!! U', 'tp2 vérifier la connectivité entre tous les périphériques'],
    motsCles: ['ping', 'traceroute', 'connectivité', 'icmp', 'routeur', 'cisco', 'test'],
    params: [{ id: 'cible', label: 'adresse à tester', type: 'ipv4', exemple: '192.168.5.190', aide: 'L’adresse d’un poste, d’un commutateur ou d’une interface de routeur.' }],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Ping', 'Envoie cinq requêtes. Chaque symbole résume une réponse. Le premier point est souvent normal : le temps de résoudre l’adresse MAC (ARP).',
        [priv('ping {{cible}}')], '!!!!! : succès. . : pas de réponse (délai dépassé). U : un routeur répond qu’il n’a aucune route.'),
      lec('Traceroute', 'Liste les routeurs traversés, un par ligne. Le dernier bon saut avant les astérisques désigne l’endroit où le chemin casse.',
        [priv('traceroute {{cible}}')], 'Une ligne par routeur traversé avec le temps de réponse ; des astérisques (* * *) à l’endroit de la coupure.'),
    ],
    verification: ['Tu sais dire si la cible répond, et sinon à quel saut le chemin s’arrête.'],
    depannage: [
      { symptome: 'Le ping affiche des points (.....)', cause: 'Les paquets partent mais aucune réponse ne revient : route retour absente ou pare-feu.', action: 'Vérifie les routes sur le chemin de retour, puis fais le ping depuis l’autre extrémité.' },
      { symptome: 'Le ping affiche U', cause: 'Un routeur du chemin n’a aucune route vers la destination.', action: 'Lis « show ip route » sur le routeur qui répond (le traceroute le désigne).' },
      { symptome: 'Seul le premier ping échoue', cause: 'Résolution ARP en cours : comportement normal.', action: 'Relance le ping : les suivants passent.' },
    ],
    sources: [SRC_ROUTE],
    rappel: { titre: 'Rappel : lire un ping', points: ['! réponse reçue ; . délai dépassé ; U destination inaccessible (un routeur n’a pas de route).', 'Un ping qui échoue ne dit pas si c’est l’aller ou le retour : traceroute, puis ping depuis l’autre bout.', 'Dans le TP2, tous les appareils doivent pouvoir se joindre : teste un chemin à la fois.'] },
  }),
  // ===========================================================================
  // RIP (semaine 3)
  // ===========================================================================
  ficheIos({
    id: 'cours-rip-configurer',
    titre: 'Configurer RIPv2 sur un routeur',
    resume: 'Active RIP version 2, désactive le résumé automatique, annonce les réseaux connectés (par réseau de classe), évite d’envoyer des mises à jour vers les postes, et peut propager une route par défaut.',
    effet: 'modification',
    intentions: ['rip version 2', 'router rip network no auto-summary', 'routage dynamique rip', 'passive-interface rip', 'default-information originate'],
    motsCles: ['rip', 'ripv2', 'router rip', 'network', 'no auto-summary', 'passive-interface', 'routage dynamique', 'cisco'],
    params: [
      { id: 'reseau1', label: 'premier réseau connecté à annoncer', type: 'ipv4', exemple: '192.168.5.0', aide: 'Un réseau directement connecté. RIP raisonne par réseau de classe : IOS convertit 192.168.5.x en 192.168.5.0 et 10.x.x.x en 10.0.0.0.' },
      { id: 'reseau2', label: 'second réseau connecté à annoncer', type: 'ipv4', exemple: '10.0.0.0', aide: 'Un autre réseau de classe connecté (par exemple le lien entre routeurs).' },
      { id: 'passive', label: 'interface vers les postes (sans mise à jour)', type: 'interfaceRouteur', exemple: 'Gi0/0', aide: 'L’interface qui mène au réseau local, où il n’y a pas d’autre routeur.' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Démarrer RIP en version 2 sans résumé automatique', 'La version 2 inclut le masque dans ses annonces (réseaux sans classe). no auto-summary empêche de regrouper les sous-réseaux en réseau de classe aux frontières, ce qui casserait des réseaux discontinus.',
        [cfg('router rip'), rte('version 2'), rte('no auto-summary')], 'Aucun message : l’invite passe à config-router.'),
      mod('Annoncer les réseaux connectés', 'network indique à RIP quelles interfaces utiliser : toute interface dont l’adresse est dans ce réseau envoie et reçoit des mises à jour.',
        [cfg('router rip'), rte('network {{reseau1}}'), rte('network {{reseau2}}')], 'Aucun message. Si tu écris un sous-réseau, IOS le convertit en réseau de classe.'),
      mod('Taire l’interface vers les postes', 'passive-interface écoute mais n’envoie plus de mises à jour sur cette interface : inutile (et un peu risqué) d’en parler à des ordinateurs.',
        [cfg('router rip'), rte('passive-interface {{passive}}')], 'Aucun message.'),
      mod('Propager la route par défaut aux autres routeurs', 'À faire seulement sur le routeur qui possède une route statique par défaut (vers Internet). Les autres l’apprennent par RIP.',
        [cfg('router rip'), rte('default-information originate')], 'Aucun message. Les voisins reçoivent une route « R* 0.0.0.0/0 ».', { facultatif: true }),
      lec('Contrôler', 'Le résumé montre la version, les réseaux annoncés, les voisins et les temporisateurs. Les routes apprises portent le code R.',
        [priv('show ip protocols'), priv('show ip route rip')], 'RIP version 2, auto-summarization désactivée, réseaux annoncés, voisins listés, routes « R » avec [120/n].'),
    ],
    verification: ['show ip protocols affiche RIP version 2 avec les bons réseaux, et show ip route montre des routes R vers les réseaux des autres routeurs.'],
    retour: 'Pour tout retirer : « no router rip » en configuration globale.',
    depannage: [
      { symptome: 'Aucune route R n’apparaît', cause: 'network manquant, mauvaise version (v1 d’un côté, v2 de l’autre), ou voisin éteint.', action: 'Lis « show ip protocols » des deux bouts, compare les versions et les réseaux annoncés.' },
      { symptome: 'Un réseau distant a disparu', cause: 'Plus de 15 sauts, ou mise à jour perdue (RIP efface une route après quelques cycles sans nouvelle).', action: 'Vérifie le lien, la distance en sauts et les temporisateurs de show ip protocols.' },
      { symptome: 'Deux routes vers le même réseau, une seule garde', cause: 'Une route statique (distance 1) l’emporte sur RIP (120).', action: 'C’est normal. Supprime la statique pour laisser RIP travailler.' },
    ],
    sources: [SRC_RIP],
    figures: ['rip-principe', 'rip-resume-auto'],
    rappel: { titre: 'Rappel : RIP', points: ['RIP est un protocole à vecteur de distance : il compte les sauts (15 au plus, 16 = inaccessible) et envoie ses routes toutes les 30 secondes.', 'RIPv2 transmet le masque (réseaux sans classe) ; RIPv1 est par classe et ne le fait pas.', 'no auto-summary est presque toujours souhaité en RIPv2.', 'Distance administrative de RIP : 120 (une statique, à 1, passe avant).'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-rip-verifier',
    titre: 'Vérifier et dépanner RIP : protocoles, routes et base de données',
    resume: 'Lit la configuration réelle de RIP, les routes apprises et la base de données pour trouver pourquoi un réseau n’arrive pas ou a disparu. Lecture seule.',
    effet: 'lecture',
    intentions: ['show ip protocols rip', 'show ip rip database', 'dépanner rip', 'routes rip manquantes', 'vérifier routage dynamique'],
    motsCles: ['show ip protocols', 'show ip route rip', 'rip database', 'dépannage', 'cisco', 'routage'],
    params: [],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Voir le protocole', 'La version, les temporisateurs, les réseaux annoncés, les voisins (Routing Information Sources) et la distance administrative.',
        [priv('show ip protocols')], 'Routing Protocol is « rip », version 2, réseaux listés, voisins avec leur dernier échange.'),
      lec('Voir les routes apprises', 'Ne garde que les routes RIP (code R) et leur coût en sauts.',
        [priv('show ip route rip')], 'Une ligne « R » par réseau distant avec [120/nombre de sauts] via le voisin.'),
      lec('Voir la base de données RIP', 'Montre les réseaux connus par RIP, y compris ceux qui n’ont pas été retenus dans la table.',
        [priv('show ip rip database')], 'Les réseaux avec leur chemin et leur métrique.'),
      lec('Relire la configuration de RIP', 'Compare avec ce que tu voulais poser.',
        [priv('show running-config')], 'Le bloc « router rip » avec version 2, no auto-summary, network et passive-interface.'),
    ],
    verification: ['Tu peux dire quelle version tourne, quels réseaux sont annoncés, et si chaque voisin envoie ses mises à jour.'],
    sources: [SRC_RIP],
    rappel: { titre: 'Rappel : lire RIP', points: ['Le code R dans show ip route désigne une route apprise par RIP, suivie de [120/n] : distance administrative et nombre de sauts.', 'show ip protocols montre aussi qui a envoyé des mises à jour récemment : un voisin muet est un voisin à vérifier.', 'Si un réseau manque, compare « network » des deux routeurs et leurs versions avant de toucher au reste.'] },
  }),
  // ===========================================================================
  // VLAN, VTP, DTP (semaine 5)
  // ===========================================================================
  ficheIos({
    id: 'cours-vtp-reseau',
    titre: 'Configurer VTP : serveur, domaine et clients',
    resume: 'Met en place VTP en cinq temps : le mode de chaque commutateur, le nom de domaine, le mot de passe, la création des VLAN sur le serveur, puis la vérification chez les clients. VTP ne circule que sur des trunks.',
    effet: 'modification',
    intentions: ['vtp serveur client', 'vtp domain password', 'configurer vtp', 'propager les vlan', 'vtp mode client', 'show vtp status'],
    motsCles: ['vtp', 'serveur', 'client', 'domaine', 'vlan', 'révision', 'cisco', 'trunk'],
    params: [
      { id: 'mode', label: 'mode VTP de ce commutateur', type: 'choix', choix: ['server', 'client'], exemple: 'client', aide: 'server crée et modifie les VLAN du domaine ; client reçoit seulement.' },
      { id: 'domaine', label: 'nom du domaine VTP', type: 'identifiant', exemple: 'CCNA', aide: 'Identique sur tous les commutateurs, SENSIBLE À LA CASSE (CCNA n’est pas Ccna).' },
      { id: 'vlan', label: 'numéro du VLAN à créer sur le serveur', type: 'vlan', exemple: '10', aide: 'De 2 à 1001 (les VLAN étendus demandent le mode transparent).' },
      { id: 'nom', label: 'nom du VLAN', type: 'nomVlan', exemple: 'Ventes', aide: 'Un nom court sans espace.' },
    ],
    privileges: ENABLE,
    etapes: [
      lec('Lire l’état de départ', 'Par défaut, un commutateur est serveur, sans domaine, avec un numéro de révision 0 (ou plus s’il a déjà servi).',
        [swp('show vtp status')], 'VTP Operating Mode : Server ; VTP Domain Name vide ; Configuration Revision : 0.',
        { important: 'Un commutateur ajouté avec un numéro de révision plus élevé que celui du réseau EFFACE les VLAN de tout le domaine. Remets à neuf (révision 0) tout commutateur d’occasion avant de le joindre.' }),
      mod('Choisir le mode et le domaine', 'Sur le serveur, mode server ; sur les autres, mode client. Le nom du domaine doit être identique partout, à la lettre.',
        [swc('vtp mode {{mode}}'), swc('vtp domain {{domaine}}')], '« Setting device to VTP … mode » puis « Changing VTP domain name to … ».'),
      mod('Poser le mot de passe du domaine', 'La ligne est volontairement incomplète : tu tapes le mot de passe après « password ». Il doit être identique partout.',
        [swc('vtp password', { secret: true })], 'Aucun message de confirmation en cas de succès.',
        { interactions: [{ secret: true, attend: 'La ligne copiée se termine par « password » suivi d’une espace.', reponds: 'Tape le mot de passe VTP demandé par ton énoncé, puis Entrée. Ne le relis pas avec show vtp password en public : il s’affiche en clair.' }] }),
      mod('Créer les VLAN sur le serveur seulement', 'Un client ne crée rien : les VLAN lui arrivent du serveur. Chaque création ou renommage incrémente le numéro de révision.',
        [swc('vlan {{vlan}}'), { invite: 'Switch(config-vlan)#', cmd: 'name {{nom}}' }], 'Aucun message. Le numéro de révision monte à chaque changement.',
        { facultatif: true }),
      lec('Vérifier chez les clients', 'Le client doit avoir le même domaine, le même numéro de révision que le serveur, et les VLAN du serveur dans sa liste.',
        [swp('show vtp status'), swp('show vlan brief')], 'Même Configuration Revision que le serveur ; les VLAN créés apparaissent dans la liste du client.'),
    ],
    verification: ['Le client affiche le domaine, la révision et la liste des VLAN du serveur.'],
    retour: 'Pour sortir un commutateur du jeu de VTP : « vtp mode transparent » (il garde ses VLAN locaux et n’en reçoit plus).',
    depannage: [
      { symptome: 'Le client ne reçoit aucun VLAN', cause: 'Pas de trunk entre eux, domaine différent (casse comprise), mot de passe différent, ou versions incompatibles.', action: 'Lis « show interfaces trunk » puis « show vtp status » des deux côtés.' },
      { symptome: 'Les VLAN du réseau ont disparu après l’ajout d’un commutateur', cause: 'Le nouveau commutateur avait une révision plus élevée et a écrasé la base du domaine.', action: 'Restaure les VLAN sur le serveur, puis remets à neuf tout commutateur avant son ajout.' },
    ],
    sources: [SRC_VTP],
    figures: ['vtp-modes', 'vtp-revision'],
    rappel: { titre: 'Rappel : VTP', points: ['VTP distribue la liste des VLAN d’un domaine à partir d’un serveur ; il ne transporte que les VLAN (pas l’affectation des ports).', 'Trois modes utiles : serveur (crée et diffuse), client (reçoit), transparent (ignore et relaie).', 'Le numéro de révision fait foi : le plus élevé gagne, y compris quand c’est un nouveau commutateur mal préparé.', 'Domaine et mot de passe doivent être identiques, au caractère près.'] },
    assistant: 'cisco-vtp-configuration',
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-vtp-transparent-etendus',
    titre: 'Mode VTP transparent et VLAN étendus (1006 à 4094)',
    resume: 'Passe le commutateur en mode transparent (il n’échange plus de VLAN par VTP) pour pouvoir créer des VLAN étendus au-delà de 1005 sur un 2960.',
    effet: 'modification',
    intentions: ['vtp transparent', 'vlan étendus', 'créer vlan 2000', 'vlan 1006 4094', 'mode transparent vtp'],
    motsCles: ['vtp', 'transparent', 'vlan étendu', 'vlan 2000', 'cisco', '2960'],
    params: [
      { id: 'vlan', label: 'numéro du VLAN étendu', type: 'entier', min: 1006, max: 4094, exemple: '2000', aide: 'De 1006 à 4094.' },
      { id: 'nom', label: 'nom du VLAN', type: 'nomVlan', exemple: 'Invites', aide: 'Un nom court sans espace.' },
    ],
    privileges: ENABLE,
    etapes: [
      mod('Passer en mode transparent', 'Un 2960 n’autorise les VLAN étendus qu’en mode transparent. Le commutateur garde ses propres VLAN et relaie ceux des autres sans les adopter.',
        [swc('vtp mode transparent')], '« Setting device to VTP TRANSPARENT mode. »'),
      mod('Créer le VLAN étendu', 'Le VLAN est local à ce commutateur : il ne se propage pas.',
        [swc('vlan {{vlan}}'), { invite: 'Switch(config-vlan)#', cmd: 'name {{nom}}' }], 'Aucun message.'),
      lec('Contrôler', 'Le mode est transparent et le VLAN étendu figure dans la liste (selon la version, il faut parfois lire la configuration).',
        [swp('show vtp status'), swp('show vlan brief')], 'VTP Operating Mode : Transparent ; le VLAN étendu est listé.'),
    ],
    verification: ['Le mode VTP est transparent et le VLAN étendu existe localement.'],
    retour: 'Pour retirer : « no vlan N » ; pour reprendre part à VTP : « vtp mode client » (ou server).',
    sources: [SRC_VTP],
    rappel: { titre: 'Rappel : VLAN étendus', points: ['Les VLAN normaux vont de 1 à 1005, les étendus de 1006 à 4094.', 'Sur un 2960, les étendus exigent le mode VTP transparent et restent locaux au commutateur.'] },
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-dtp-trunk',
    titre: 'Choisir le mode DTP d’un port : auto, desirable, trunk ou access',
    resume: 'Fixe le mode d’un port vis-à-vis de DTP, le protocole qui négocie les trunks. On lit d’abord le mode, puis on choisit : dynamic auto, dynamic desirable, trunk (fixe) ou access (fixe).',
    effet: 'modification',
    intentions: ['dtp dynamic desirable', 'switchport mode dynamic auto', 'négociation trunk', 'switchport mode trunk', 'switchport nonegotiate', 'show dtp interface'],
    motsCles: ['dtp', 'dynamic desirable', 'dynamic auto', 'trunk', 'access', 'nonegotiate', 'cisco', 'switchport'],
    params: [
      INTERFACE_COMMUTATEUR,
      { id: 'mode', label: 'mode du port', type: 'choix', choix: ['dynamic desirable', 'dynamic auto', 'trunk', 'access'], exemple: 'dynamic desirable', aide: 'desirable cherche activement à former un trunk ; auto répond seulement ; trunk et access sont fixes.' },
    ],
    privileges: ENABLE,
    etapes: [
      lec('Lire le mode actuel', 'Administrative Mode = ce qui est configuré ; Operational Mode = ce qui fonctionne réellement. S’ils diffèrent, la négociation a donné autre chose.',
        [swp('show interfaces {{interface}} switchport'), swp('show dtp interface {{interface}}')], 'Administrative Mode et Operational Mode du port, avec le type de trunk négocié.'),
      mod('Choisir le mode', 'dynamic auto et dynamic desirable laissent DTP négocier ; trunk et access sont fixes. Sur certains modèles (3560), il faut aussi « switchport trunk encapsulation dot1q » avant d’installer un trunk.',
        [swc('interface {{interface}}'), swi('switchport mode {{mode}}')], 'Aucun message.',
        { important: 'Deux bouts « dynamic auto » ne forment PAS de trunk : personne ne propose. Un bout en access face à un bout en trunk casse le lien.' }),
      mod('Couper la négociation sur un trunk fixe', 'Sur un port déjà fixé en trunk (ou en accès), cette commande arrête d’envoyer des trames DTP, utile vers un équipement qui n’en veut pas.',
        [swi('switchport nonegotiate')], 'Aucun message. Refusée si le port est encore en mode dynamique.', { facultatif: true }),
      lec('Contrôler', 'Le trunk apparaît avec son encapsulation, son VLAN natif et les VLAN autorisés.',
        [swp('show interfaces trunk'), swp('show interfaces {{interface}} switchport')], 'Le port apparaît dans show interfaces trunk avec le mode « on » ou « desirable » ou « auto » et le statut « trunking ».'),
    ],
    verification: ['Les deux bouts affichent un Operational Mode identique (trunk ou access) selon le choix.'],
    retour: 'Pour revenir au réglage par défaut : « switchport mode dynamic auto » (ou desirable selon le modèle).',
    sources: [SRC_VLAN],
    figures: ['dtp-modes'],
    rappel: { titre: 'Rappel : DTP', points: ['DTP négocie seulement entre deux commutateurs voisins, point à point.', 'Un trunk se forme si un bout est trunk ou desirable face à un bout trunk, desirable ou auto.', 'Deux auto ou un trunk face à un access ne donnent pas ce qu’on attend.'] },
    assistant: 'cisco-dtp-simulation',
  }),
  // -------------------------------------------------------------------------
  ficheIos({
    id: 'cours-vtp-dtp-depanner',
    titre: 'Dépanner VTP et DTP : trunk absent, VLAN non reçus',
    resume: 'Démarche de lecture quand un commutateur ne reçoit pas les VLAN ou que le trunk ne se forme pas : état VTP, trunks, mode du port, DTP. Lecture seule.',
    effet: 'lecture',
    intentions: ['dépanner vtp', 'dépanner dtp', 'trunk ne se forme pas', 'vlan non reçus client vtp', 'versions vtp incompatibles', 'vtp domain incorrect'],
    motsCles: ['vtp', 'dtp', 'trunk', 'dépannage', 'show vtp status', 'show interfaces trunk', 'cisco'],
    params: [INTERFACE_COMMUTATEUR],
    privileges: 'Mode privilégié (enable).',
    etapes: [
      lec('Lire l’état VTP', 'Version, domaine, mode, numéro de révision et nombre de VLAN : à comparer avec le serveur.',
        [swp('show vtp status')], 'VTP version, Domain Name, Operating Mode, Configuration Revision, nombre de VLAN.'),
      lec('Lire les trunks', 'VTP ne passe que par un trunk : le port doit y figurer avec le statut trunking.',
        [swp('show interfaces trunk')], 'Les ports en trunk, leur VLAN natif et les VLAN autorisés ; un port absent n’est pas en trunk.'),
      lec('Lire le mode du port', 'Compare Administrative Mode et Operational Mode, et le VLAN natif.',
        [swp('show interfaces {{interface}} switchport'), swp('show dtp interface {{interface}}')], 'Le mode négocié et le type de trunk.'),
      lec('Lire les VLAN', 'Vérifie que les VLAN attendus existent et que les ports sont dans les bons.',
        [swp('show vlan brief')], 'La liste des VLAN et des ports qu’ils contiennent.'),
    ],
    verification: ['Tu peux nommer la cause : pas de trunk, domaine ou mot de passe différent, versions incompatibles, VLAN natif différent.'],
    depannage: [
      { symptome: 'Le client ne reçoit rien', cause: 'Domaine VTP écrit autrement (casse), mot de passe différent, ou pas de trunk.', action: 'Définis le domaine sur UN commutateur et laisse-le se propager ; vérifie le trunk.' },
      { symptome: 'Versions incompatibles', cause: 'Un commutateur ne prend pas en charge la version de VTP utilisée.', action: 'Aligne les versions (« vtp version 2 ») ou choisis la version prise en charge par tous.' },
      { symptome: 'Le trunk ne se forme pas', cause: 'Deux bouts en dynamic auto, ou un bout en access face à un trunk.', action: 'Mets au moins un bout en desirable ou en trunk fixe.' },
      { symptome: 'Le trunk se forme mais le trafic d’un VLAN ne passe pas', cause: 'Le VLAN n’est pas autorisé sur le trunk, ou le VLAN natif diffère aux deux bouts.', action: 'Compare « show interfaces trunk » des deux côtés.' },
    ],
    sources: [SRC_VTP, SRC_VLAN],
    figures: ['vtp-revision', 'dtp-modes'],
    rappel: { titre: 'Rappel : démarche de dépannage', points: ['Toujours dans l’ordre : le lien (trunk), puis le domaine et le mot de passe VTP, puis la révision.', 'Un nom de domaine mal écrit isole le commutateur : définis-le sur un seul appareil et laisse-le se propager.', 'Compare les DEUX bouts : un trunk ou un VLAN natif différent suffit à casser le chemin.'] },
    assistant: 'cisco-vtp-diagnostic',
  }),
];
