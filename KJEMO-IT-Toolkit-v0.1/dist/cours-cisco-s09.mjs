/**
 * cours-cisco-s09.mjs — KJEMO-CISCO-S09-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Cours « Architecture réseau II — Semaine 9 : DHCP et IPv6 » rangé dans « Mes
 * cours Cisco » : les trois diapositives (DHCPv4, IPv6, DHCPv6) et les quatre
 * exercices du formatif 8 (Packet Tracer DHCPv4, adressage IPv6, routes
 * statiques et par défaut IPv6, laboratoire DHCPv6), suivis de la théorie sans
 * commande à connaître pour l'examen.
 *
 * Chaque parcours renvoie vers des fiches : il ne contient aucune commande. Les
 * fiches déjà au catalogue (nom de l'équipement, mots de passe, ports inutilisés,
 * enregistrement, ping) sont citées, jamais refaites. Les énoncés sont résumés
 * dans nos mots ; les documents d'origine ne sont pas republiés.
 */
import { RESUME_S09 } from './cours-resume-cisco-s09.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const AVERTISSEMENT = 'Les fiches expliquent comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) ; elles ne remplacent pas ton énoncé et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Le Toolkit n’exécute aucune commande et rien n’a été essayé dans Packet Tracer ni sur du matériel Cisco réel.';

export const COURS_CISCO_S09_PARCOURS = [
  {
    id: 'cisco-s09-dhcp-ipv6',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — Semaine 9 : DHCP et IPv6 (formatif 8)',
    resume: 'DHCPv4 sur un routeur (serveur, relais, client), adressage et routes statiques IPv6, SLAAC et DHCPv6 sans état, avec état et relais, avec le résumé pliable, les schémas et les quatre exercices du formatif 8.',
    source: 'Diapositives « DHCPv4 », « IPv6 » et « DHCPv6 » (chapitres 7 et 8 de CCNA 2 v7) et fichiers du formatif 8 (Packet Tracer DHCPv4, adressage IPv6, routes statiques IPv6, laboratoire DHCPv6) fournis par l’étudiant, non republiés ici : les parcours et le résumé sont écrits dans nos mots. En cas de doute, le document d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_S09,
    parcours: [
      {
        lettre: 'A',
        titre: 'Formatif 8 — DHCPv4 : serveur, relais et client sur routeur (Packet Tracer 7.2.10)',
        resume: 'R2 sert de serveur DHCP aux LAN de R1 et de R3 : exclusions, deux pools, relais sur R1 et R3, puis R2 devient client DHCP du fournisseur et on vérifie les baux et les pings.',
        prerequis: [f('cours-rt-interface-ip', 2, { titre: 'Poser l’adresse', pourquoi: 'les interfaces des routeurs doivent déjà être adressées d’après le tableau de l’énoncé.' })],
        items: [
          { id: 'A1', texte: 'Sur R2, exclure les dix premières adresses du LAN de R1 et du LAN de R3.', refs: [f('cours-dhcp4-serveur-routeur', 1, { titre: 'Exclure' })], note: 'Deux fois la même commande, une par réseau (192.168.10.1 à .10 et 192.168.30.1 à .10).' },
          { id: 'A2', texte: 'Créer les pools « R1-LAN » et « R3-LAN » avec réseau, passerelle et serveur DNS.', refs: [f('cours-dhcp4-serveur-routeur', 2, { titre: 'Créer le pool' })], note: 'Le nom est sensible à la casse. Une fois la fiche remplie pour R1-LAN, refais-la pour R3-LAN. Voir l’ambiguïté S09-1 sur l’adresse réseau du premier pool.' },
          { id: 'A3', texte: 'Configurer R1 et R3 comme agents de relais vers R2.', refs: [f('cours-dhcp4-relais', 1, { titre: 'Désigner le serveur' })], note: 'L’adresse d’assistance est celle de l’interface série de R2 tournée vers chaque routeur (10.1.1.2 pour R1, 10.2.2.2 pour R3).' },
          { id: 'A4', texte: 'Régler PC1 et PC2 pour recevoir leur adresse par DHCP.', refs: [], couvert: false, note: 'Se fait dans Packet Tracer sur chaque PC : Desktop, IP Configuration, option « DHCP ». Aucune commande IOS.' },
          { id: 'A5', texte: 'Faire de l’interface G0/1 de R2 un client DHCP.', refs: [f('cours-dhcp4-client-routeur', 1, { titre: 'Demander l’adresse' })], note: 'Le bouton « Fast Forward Time » de Packet Tracer accélère l’attente.' },
          { id: 'A6', texte: 'Vérifier les baux, puis envoyer des pings entre les PC et les autres appareils.', refs: [f('cours-dhcp4-serveur-routeur', 3, { titre: 'Contrôler' }), f('cours-dhcp4-depanner', 3, { titre: 'Lire les baux' }), f('cours-rt-tester', 1, { titre: 'Ping' })] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Formatif 8 — Adressage IPv6 (Packet Tracer 8.2.5.3)',
        resume: 'Activer le routage IPv6 sur R1, adresser ses trois interfaces (adresse globale et link-local FE80::1), régler les serveurs et les clients, puis tester par navigateur et par ping.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Activer le routage IPv6 sur R1.', refs: [f('cours-ipv6-adresser-interface', 1, { titre: 'Activer le routage' })] },
          { id: 'B2', texte: 'Adresser G0/0, G0/1 et S0/0/0 : adresse globale, link-local FE80::1, interface allumée.', refs: [f('cours-ipv6-adresser-interface', 2, { titre: 'Poser les adresses' })], note: 'Une fois par interface, avec l’adresse du tableau de l’énoncé (…:1:1::1, …:1:2::1 et …:1:A001::2).' },
          { id: 'B3', texte: 'Régler les adresses IPv6 des deux serveurs et des quatre clients, avec la passerelle FE80::1.', refs: [], couvert: false, note: 'Se fait dans Packet Tracer sur chaque appareil : Desktop, IP Configuration, IPv6 en configuration manuelle (adresse avec /64, passerelle FE80::1). Aucune commande IOS.' },
          { id: 'B4', texte: 'Ouvrir les pages web des serveurs depuis les clients en tapant leur adresse IPv6.', refs: [], couvert: false, note: 'Se fait dans le navigateur de Packet Tracer (Desktop, Web Browser) : on tape l’adresse IPv6 du serveur à la place d’un nom.' },
          { id: 'B5', texte: 'Tester le ping vers le fournisseur depuis les clients.', refs: [f('cours-ipv6-verifier', 3, { titre: 'Tester' })], note: 'Dans Packet Tracer, la fenêtre « Command Prompt » d’un client accepte « ping » suivi de l’adresse.' },
        ],
      },
      {
        lettre: 'C',
        titre: 'Formatif 8 — Routes statiques et par défaut IPv6 (Packet Tracer 6.2.4.4)',
        resume: 'Trois routeurs en ligne : analyser le réseau, activer le routage IPv6, puis écrire des routes récursives sur R1, une route connectée et une route entièrement spécifiée sur R2, et une route par défaut sur R3.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Compter les réseaux et les routes statiques nécessaires à chaque routeur.', refs: [], couvert: false, note: 'Question d’analyse, sans commande. D’après le tableau de l’énoncé : cinq réseaux (trois LAN et deux liens série) ; R1 et R3 voient deux réseaux chacun, R2 en voit trois. À toi de confirmer avec le schéma.' },
          { id: 'C2', texte: 'Activer le routage IPv6 sur chaque routeur.', refs: [f('cours-ipv6-routes-statiques', 1, { titre: 'Activer le routage' })] },
          { id: 'C3', texte: 'Sur R1, écrire une route récursive vers chaque réseau non connecté.', refs: [f('cours-ipv6-routes-statiques', 2, { titre: 'Forme 1' })], note: 'Trois routes, toutes par l’adresse de R2 sur le lien série (…:A001::2).' },
          { id: 'C4', texte: 'Sur R2, écrire une route connectée directement vers le LAN de R1 et une route entièrement spécifiée vers le LAN de R3.', refs: [f('cours-ipv6-routes-statiques', 3, { titre: 'Forme 2' }), f('cours-ipv6-routes-statiques', 4, { titre: 'Forme 3' })], note: 'La forme 2 utilise Serial0/0/0 ; la forme 3 utilise Serial0/0/1 et l’adresse de R3 (…:A002::2).' },
          { id: 'C5', texte: 'Sur R3, écrire une route par défaut récursive.', refs: [f('cours-ipv6-defaut-flottante', 1, { titre: 'route par défaut' })] },
          { id: 'C6', texte: 'Vérifier la configuration : adresse du poste, adresses des interfaces, table de routage, puis pings de bout en bout.', refs: [f('cours-ipv6-verifier', 1, { titre: 'interfaces' }), f('cours-ipv6-verifier', 2, { titre: 'table' }), f('cours-ipv6-verifier', 3, { titre: 'Tester' })], note: 'Dans Packet Tracer, la commande d’un poste pour lire sa configuration IPv6 est « ipv6config » ; sous Windows, c’est « ipconfig ».' },
        ],
      },
      {
        lettre: 'D',
        titre: 'Formatif 8 — Laboratoire DHCPv6 : SLAAC, sans état et avec état (8.5.1)',
        resume: 'Réglages de base des équipements, SLAAC sur R1, serveur DHCPv6 sans état pour PC-A, puis serveur DHCPv6 avec état pour le réseau de R2, avec relais.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'Réglages de base des commutateurs et des routeurs : nom, mots de passe, chiffrement, bannière, ports inutilisés, enregistrement.', refs: [f('cours-base-peripherique', 1, { titre: 'Nommer' }), f('cours-base-peripherique', 4, { titre: 'privilégié' }), f('cours-base-peripherique', 2, { titre: 'console' }), f('cours-base-peripherique', 5, { titre: 'Chiffrer' }), f('cours-base-peripherique', 6, { titre: 'bannière' }), f('cours-sw-ports-inutilises', 2, { titre: 'Éteindre' }), f('cisco-enregistrer-config')], note: 'Les commutateurs sont facultatifs dans le laboratoire. Les mots de passe sont ceux de l’énoncé de laboratoire : n’en reprends jamais pour un équipement réel.' },
          { id: 'D2', texte: 'Activer le routage IPv6 sur R1 et adresser ses interfaces (adresse globale et link-local).', refs: [f('cours-ipv6-adresser-interface', 1, { titre: 'Activer le routage' }), f('cours-ipv6-adresser-interface', 2, { titre: 'Poser les adresses' })], note: 'Voir l’ambiguïté S09-3 : le tableau et les commandes de l’énoncé ne donnent pas le même préfixe pour G0/0/0.' },
          { id: 'D3', texte: 'Vérifier que PC-A reçoit une adresse par SLAAC et dire d’où vient la partie hôte.', refs: [f('cours-dhcp6-slaac', 3, { titre: 'Contrôler' })], note: 'Poste Windows : carte réseau réglée sur IPv6 automatique. La partie hôte vient soit d’un EUI-64 calculé depuis l’adresse MAC, soit d’un nombre aléatoire (voir le résumé).' },
          { id: 'D4', texte: 'Créer un pool DHCPv6 sans état « R1-STATELESS » (DNS et domaine) et le lier à G0/0/1 avec l’indicateur O.', refs: [f('cours-dhcp6-sans-etat', 2, { titre: 'Créer le pool' }), f('cours-dhcp6-sans-etat', 3, { titre: 'Lier le pool' })] },
          { id: 'D5', texte: 'Redémarrer PC-A, relire « ipconfig /all » et noter ce qui a changé.', refs: [f('cours-dhcp6-sans-etat', 4, { titre: 'Contrôler' })], note: 'Le serveur DNS et le suffixe de domaine du pool doivent apparaître ; l’adresse reste celle de SLAAC.' },
          { id: 'D6', texte: 'Créer un pool DHCPv6 avec état « R1-STATEFUL » (préfixe /80, DNS, domaine) et le lier à G0/0/0 avec l’indicateur M.', refs: [f('cours-dhcp6-avec-etat', 2, { titre: 'Créer le pool' }), f('cours-dhcp6-avec-etat', 3, { titre: 'Lier le pool' })], note: 'Voir l’ambiguïté S09-3 sur le préfixe du pool (aaa ou aaaa).' },
          { id: 'D7', texte: 'Relayer les demandes du réseau de R2 vers le serveur DHCPv6 de R1.', refs: [f('cours-dhcp6-relais', 1, { titre: 'Désigner le serveur' })], note: 'Le corrigé du laboratoire montre ce relais sur l’interface côté clients de R2, avec l’adresse de R1 et l’interface de sortie G0/0/0.' },
          { id: 'D8', texte: 'Vérifier le pool, les baux et la configuration des clients.', refs: [f('cours-dhcp6-verifier', 1, { titre: 'pool' }), f('cours-dhcp6-verifier', 2, { titre: 'baux' }), f('cours-dhcp6-verifier', 4, { titre: 'Windows' })] },
        ],
      },
      {
        lettre: 'E',
        titre: 'Théorie à connaître (sans commande)',
        resume: 'Les questions de cours sur DHCP et IPv6 : messages DHCP, écriture des adresses, types d’adresses, EUI-64, découpage en sous-réseaux, coexistence avec IPv4.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'DHCPv4 : les quatre messages, le bail, son renouvellement et les champs principaux du message.', refs: [], couvert: false, note: 'Question de cours : voir le résumé pliable (section DHCPv4) et le schéma DORA.' },
          { id: 'E2', texte: 'Abréger une adresse IPv6 avec les deux règles, et repérer une écriture invalide.', refs: [], couvert: false, note: 'Calcul à la main : voir le schéma « Structure et abréviation d’une adresse IPv6 ».' },
          { id: 'E3', texte: 'Types d’adresses IPv6 : unicast globale, link-local, multidiffusion, anycast ; rôle du préfixe /64.', refs: [], couvert: false, note: 'Question de cours : voir le schéma des types d’adresses.' },
          { id: 'E4', texte: 'Calculer un identifiant EUI-64 à partir d’une adresse MAC.', refs: [], couvert: false, note: 'Calcul à la main : voir le schéma EUI-64 (couper, insérer FFFE, inverser le 7e bit).' },
          { id: 'E5', texte: 'Découper un réseau IPv6 en sous-réseaux avec l’ID de sous-réseau.', refs: [], couvert: false, note: 'On compte en hexadécimal dans les 16 bits de l’ID de sous-réseau ; pas de conversion binaire.' },
          { id: 'E6', texte: 'Comparer IPv4 et IPv6 et décrire les méthodes de coexistence : double pile, tunnel, traduction.', refs: [], couvert: false, note: 'Question de cours (théorie seulement) : aucune commande à taper, voir le résumé pliable.' },
          { id: 'E7', texte: 'Choisir entre SLAAC, DHCPv6 sans état et DHCPv6 avec état d’après les indicateurs A, O et M.', refs: [], couvert: false, note: 'Voir le résumé pliable et les schémas « Indicateurs A, O et M » et « Qui fournit quoi ».' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-rt-tester', pourquoi: 'ping et traceroute pour tester un plan d’adressage.' },
      { fiche: 'cisco-enregistrer-config', pourquoi: 'enregistrer la configuration quand le travail est validé.' },
      { fiche: 'cours-dhcp4-depanner', pourquoi: 'chercher pourquoi un poste ne reçoit pas d’adresse.' },
    ],
    ambiguites: [
      { id: 'S09-1', sujet: 'Réseau du pool R1-LAN (formatif DHCPv4)', texte: 'L’étape écrite de l’énoncé donne « network 192.168.10.0 255.255.255.0 », mais le script de réponse de la dernière page écrit « network 192.168.1.0 ». Seule l’étape écrite correspond au LAN de R1 (192.168.10.0/24) : c’est elle qu’il faut suivre.' },
      { id: 'S09-2', sujet: 'Tableau d’adressage du formatif DHCPv4', texte: 'Le tableau donne le masque 255.255.255.0 à l’interface série de R3 alors que le lien R2–R3 est un /30 comme l’autre lien (10.2.2.0/30), et écrit « 192168.20.1 » pour la passerelle du serveur DNS (une faute de frappe pour 192.168.20.1). Confirme avec ton fichier de départ.' },
      { id: 'S09-3', sujet: 'Adresses du laboratoire DHCPv6', texte: 'Le tableau d’adressage place G0/0/0 de R1 dans 2001:db8:acad:2::/64 alors que les commandes utilisent 2001:db8:acad:3::1/64. Le DNS annoncé dans le texte est 2001:db8:acad::1 mais la commande écrit ::254. Le préfixe du pool avec état est « 2001:db8:acad:3:aaaa::/80 » dans le texte et « …:aaa::/80 » dans la commande. Les lignes de R2 du tableau sont barrées, mais le corrigé contient bien un relais sur R2. Suis les commandes de l’étape écrite et vérifie les valeurs auprès de ton enseignant.' },
      { id: 'S09-4', sujet: 'Codes de cours dans les noms de fichiers', texte: 'Le texte du formatif cite des fichiers « 420-4P5-LI – S09 … » alors que les fichiers fournis portent le code 420-FBL-LI : ce sont les mêmes exercices, l’ancien code est resté dans le texte.' },
      { id: 'S09-5', sujet: 'Commande de lecture IPv6 d’un poste', texte: 'Le corrigé du formatif d’adressage et de routes demande « ipv6config » : cette commande n’existe que dans l’invite de Packet Tracer. Sous Windows réel, on lit la configuration IPv6 avec « ipconfig ».' },
    ],
  },
];
