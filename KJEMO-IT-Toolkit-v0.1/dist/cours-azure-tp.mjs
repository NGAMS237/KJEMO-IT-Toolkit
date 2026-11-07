/**
 * cours-azure-tp.mjs — AZURE-TP-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les travaux pratiques d'Infonuagique I (session A26), rangés dans « Mes
 * cours et TP » :
 *
 *   TP1  ÉNERGIA : planifier l'adressage de quatre réseaux et créer les zones
 *        DNS privées (14 % de la note, 20 points au barème de l'énoncé)
 *   TP2  Banque Tardi : App Service, stockage privé, deux VNet, appairage,
 *        points de terminaison privés et routes (17 %, 17 points)
 *
 * Comme les autres cours, ces parcours ne contiennent AUCUNE commande : chaque
 * demande de l'énoncé renvoie à la fiche, et à l'étape de la fiche, qui y
 * répond. Les énoncés sont résumés dans nos mots, non republiés. Rien n'est
 * exécuté par le Toolkit : le travail se fait dans ton abonnement, avec tes
 * captures d'écran (le compte qui configure doit y être visible).
 */
import { versCli } from './cours-azure-cli.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const AVERTISSEMENT = 'Les fiches expliquent comment faire avec Azure CLI dans un abonnement de laboratoire ; elles ne remplacent pas ton énoncé, ne produisent aucune capture et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Le travail remis demande des captures du PORTAIL Azure avec le compte visible. Les ressources sont facturées tant qu’elles existent : arrête ou supprime ce que tu n’utilises plus.';
const SOURCE_TP1 = 'Énoncé « A26 - Infonuagique I - Travail pratique 1 » fourni par l’étudiant (non republié ici), à remettre sur LEA au plus tard le dimanche 25 octobre 2026. Résumé dans nos mots ; en cas de doute, c’est l’énoncé qui fait foi.';
const SOURCE_TP2 = 'Énoncé « A26 - Infonuagique I - Travail pratique 2 » fourni par l’étudiant (non republié ici), à remettre sur LEA au plus tard le jeudi 12 novembre 2026 à 23 h 59 (−10 % par jour de retard). Résumé dans nos mots ; le schéma de l’énoncé n’est pas reproduit ; en cas de doute, c’est l’énoncé qui fait foi.';
const CALCUL = 'Travail de réflexion et de calcul à rédiger toi-même dans le document remis : l’éditeur de schéma du Journal (modèle « TP1 ÉNERGIA », bouton « Découper selon les besoins ») calcule les plages, mais la justification est la tienne.';

const COURS_AZURE_TP_PARCOURS_BRUT = [
  // ===========================================================================
  {
    id: 'azure-tp1-energia',
    plateformes: ['Azure'],
    titre: 'Infonuagique I — TP1 : réseaux virtuels et zones DNS (groupe ÉNERGIA)',
    resume: 'Deux filiales indépendantes (Solaria et Hydrix), chacune au Canada et en France : planifier l’adressage (réseaux, sous-réseaux selon les besoins par type d’actif, zones DNS privées), puis créer les réseaux, les zones et quatre enregistrements.',
    source: SOURCE_TP1,
    avertissement: AVERTISSEMENT,
    rappelCours: {
      titre: 'Rappel du TP1 — adressage et zones DNS',
      intro: 'À relire avant de rédiger : comment passer des besoins en adresses aux blocs CIDR, et pourquoi des zones DNS privées par filiale, région et type d’actif.',
      essentiel: [
        'Un réseau virtuel appartient à UNE région : des filiales indépendantes qui travaillent dans deux régions demandent un réseau par filiale et par région, soit quatre réseaux ici, sans appairage entre filiales.',
        'Chaque sous-réseau reçoit la plus petite plage qui couvre son besoin, plus 5 adresses réservées par Azure ; les plages ne se chevauchent pas, ni dans un réseau ni entre réseaux.',
        'Des noms comme app.intra.canada.solaria.corp ne sont pas résolvables sur Internet : ce sont des zones DNS PRIVÉES, liées aux réseaux qui doivent les résoudre.',
        'Le réseau d’une région peut grandir jusqu’à 1 500 adresses : un /22 n’en offre que 1 024, il faut au moins un /21 (2 048) pour l’espace du réseau.',
      ],
      sections: [
        {
          id: 'decoupage', titre: 'Du besoin au bloc CIDR',
          points: [
            'Compte les adresses nécessaires (machines, plus 5 réservées par sous-réseau), puis choisis la puissance de deux qui les couvre : 120 postes demandent 125 adresses, donc un /25 (128).',
            'Place les plus gros besoins d’abord, alignés sur leur taille (méthode VLSM), pour ne pas gaspiller l’espace.',
            'Le sous-réseau de passerelle se nomme GatewaySubnet ; un /27 est le minimum conseillé pour une passerelle VPN.',
          ],
        },
        {
          id: 'dns', titre: 'Zones DNS privées',
          points: [
            'Une zone privée porte un nom de domaine (par exemple app.intra.canada.solaria.corp) ; elle est liée à un ou plusieurs réseaux virtuels.',
            'Les enregistrements A de la zone associent un nom logique (hrapp) à une adresse prise dans le bon sous-réseau.',
            'Pour que chaque administrateur ne gère que sa filiale et sa région, le rôle sur les zones se donne zone par zone, pas sur l’abonnement.',
          ],
        },
      ],
      commandes: [
        { cmd: 'az network vnet create', sert: 'Crée un réseau virtuel avec son espace d’adressage et son premier sous-réseau.' },
        { cmd: 'az network vnet subnet create', sert: 'Ajoute un sous-réseau avec sa plage CIDR.' },
        { cmd: 'az network private-dns zone create', sert: 'Crée une zone DNS privée avec le nom de domaine voulu.' },
        { cmd: 'az network private-dns record-set a add-record', sert: 'Ajoute un enregistrement A (nom logique vers adresse privée) dans la zone.' },
      ],
      pieges: [
        'Oublier la liaison de la zone privée au réseau : les noms existent mais ne se résolvent pas.',
        'Donner une adresse hors du sous-réseau prévu dans un enregistrement : l’énoncé exige qu’elle appartienne à tes plages.',
        'Prendre des plages qui se chevauchent entre filiales : plus aucun appairage ni VPN ne sera possible plus tard.',
        'Utiliser des valeurs différentes pour le « x » des exemples d’adresses : la même valeur sert à tous les réseaux.',
      ],
      questions: [
        { q: 'Pourquoi quatre réseaux virtuels et non deux ?', r: 'Un réseau virtuel est rattaché à une seule région, et les deux filiales doivent rester totalement indépendantes : un réseau par filiale et par région, soit Solaria Canada, Solaria France, Hydrix Canada et Hydrix France.' },
        { q: 'Quelle taille minimale pour l’espace d’un réseau qui peut atteindre 1 500 adresses ?', r: 'Un /21, qui offre 2 048 adresses. Un /22 n’en offre que 1 024, ce qui ne suffit pas.' },
        { q: 'Zone DNS publique ou privée pour xxx.db.intra.canada.solaria.corp ?', r: 'Privée : le domaine n’existe pas sur Internet et les bases de données ne sont accessibles qu’en privé. La zone est liée aux réseaux concernés.' },
        { q: 'Comment limiter un administrateur aux zones DNS de sa filiale et de sa région ?', r: 'En lui attribuant un rôle d’administration des zones DNS privées avec pour portée uniquement les zones de sa filiale dans sa région, jamais l’abonnement ni le groupe entier.' },
      ],
    },
    parcours: [
      {
        lettre: 'A',
        titre: 'Partie I : planifier l’adressage (réponses rédigées)',
        points: 8,
        resume: 'Quatre réponses à écrire dans le document : le nombre de réseaux virtuels et leur plage, les sous-réseaux avec leur plage dans un tableau, le type de zones DNS, et leurs noms de domaine. Aucune ressource n’est créée à cette étape.',
        prerequis: [f('cours-az-plan-adressage', 4, { titre: 'Lire les sous-réseaux', pourquoi: 'rappelle comment Azure compte les adresses d’un sous-réseau (5 réservées).' })],
        items: [
          { id: 'A1', texte: 'Combien de réseaux virtuels créer (justifier) et quelle plage CIDR pour chacun.', refs: [], couvert: false, note: CALCUL },
          { id: 'A2', texte: 'Quels sous-réseaux créer : un tableau « nom, réseau, plage CIDR » pour les applications, les bases de données, les postes virtuels et la passerelle de chaque réseau.', refs: [], couvert: false, note: CALCUL },
          { id: 'A3', texte: 'Quels types de zones DNS Azure créer (justifier).', refs: [], couvert: false, note: 'Réponse de raisonnement : les domaines de l’énoncé ne sont pas publics, donc zones DNS privées ; le rappel du cours explique pourquoi.' },
          { id: 'A4', texte: 'Quels noms de domaine pour les zones DNS (par filiale, par région et par type d’actif).', refs: [], couvert: false, note: 'À déduire du tableau de noms de l’énoncé : une zone par filiale, région et type d’actif (applications, bases de données, postes virtuels), soit douze zones, plus celle des passerelles (voir l’ambiguïté TP1-3) ; le nom d’hôte logique est le début de chaque enregistrement.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Partie 2 : mise en place dans Azure',
        points: 12,
        resume: 'Créer les réseaux et leurs sous-réseaux avec les plages de la partie I, déployer les zones DNS privées nécessaires (liées aux bons réseaux), puis ajouter les quatre enregistrements demandés avec des adresses prises dans tes sous-réseaux.',
        prerequis: [f('cours-az-groupe-ressources', 2, { titre: 'Créer le groupe', pourquoi: 'un groupe de ressources par filiale ou un seul : décide-le avant de créer.' })],
        items: [
          { id: 'B5', texte: 'Créer et configurer les réseaux virtuels et leurs sous-réseaux dans Azure, selon le plan de la partie I.', refs: [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet' }), f('cours-az-sous-reseau-ajouter', 2, { titre: 'Créer le sous-réseau' })], assistants: ['azure-reseau-vnets'] },
          { id: 'B6', texte: 'Déployer et configurer les zones DNS privées nécessaires et les lier aux réseaux.', refs: [f('cours-az-dns-zone-privee', 2, { titre: 'Créer la zone privée' }), f('cours-az-dns-zone-privee', 3, { titre: 'Lier la zone' })], assistants: ['azure-reseau-dns'] },
          { id: 'B7', texte: 'Ajouter les quatre enregistrements demandés (une application et une base de données de Solaria Canada, un poste virtuel et la passerelle VPN d’Hydrix France) avec des adresses prises dans tes sous-réseaux.', refs: [f('cours-az-dns-zone-privee', 4, { titre: 'enregistrement manuel' }), f('cours-az-dns-zone-privee', 5, { titre: 'Vérifier le lien' })], assistants: ['azure-reseau-dns'] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-role-coequipier', pourquoi: 'même mécanique que le rôle donné à un administrateur de zone : choisir le rôle et la portée (ici les zones, pas l’abonnement).' },
    ],
    ambiguites: [
      { id: 'TP1-1', sujet: 'Nombre de réseaux virtuels', texte: 'L’énoncé ne donne pas le nombre : il le demande. Un réseau est limité à une région et les filiales ne doivent rien partager, d’où quatre réseaux (filiale × région). Si ton enseignant attend une autre lecture (par exemple un réseau par filiale), justifie-la dans ta réponse.' },
      { id: 'TP1-2', sujet: 'Administrateurs DNS par région', texte: 'Le contexte parle d’un administrateur par filiale et par région qui ne gère que ses zones DNS, mais la liste des tâches demandées ne détaille pas cette attribution. Prévois-la (rôle sur la zone, jamais sur l’abonnement) et vérifie avec ton enseignant si elle doit être capturée.' },
      { id: 'TP1-3', sujet: 'Domaine des passerelles', texte: 'Le tableau de noms de l’énoncé ne prévoit que les applications, les bases de données et les postes virtuels, mais le quatrième enregistrement demandé est vpn.gw.intra.france.hydrix.corp. Une zone gw.intra.france.hydrix.corp (ou un enregistrement dans une zone parent) est nécessaire : explique ton choix dans ta réponse de la partie I.' },
    ],
  },
  // ===========================================================================
  {
    id: 'azure-tp2-tardi',
    plateformes: ['Azure'],
    titre: 'Infonuagique I — TP2 : accès privé à App Service et au stockage (banque Tardi)',
    resume: 'Déployer une application en conteneur qui utilise une file et un conteneur de blobs, créer les deux réseaux virtuels, rendre le stockage privé par des points de terminaison privés, isoler l’application dans son réseau, puis écrire les routes demandées par sous-réseau.',
    source: SOURCE_TP2,
    avertissement: AVERTISSEMENT,
    rappelCours: {
      titre: 'Rappel du TP2 — accès privé et routage',
      intro: 'À relire avant de commencer : l’ordre des opérations, pourquoi il faut un point de terminaison privé par sous-ressource, et comment les routes se choisissent.',
      essentiel: [
        'L’ordre compte : créer le stockage et son contenu, déployer l’application et la tester AVANT de fermer l’accès public du compte ; sinon tu ne peux plus rien y créer depuis ton poste.',
        'Un point de terminaison privé ne couvre qu’une sous-ressource (blob, queue…) : l’application qui utilise la file ET le conteneur en demande deux, chacun avec sa zone DNS privée.',
        'L’intégration au réseau virtuel d’App Service gère le trafic SORTANT (sous-réseau délégué à Microsoft.Web/serverFarms) ; le point de terminaison privé de l’application gère le trafic ENTRANT.',
        'Pour que l’application (VNET1) atteigne les points privés (VNET2), les deux réseaux doivent communiquer (appairage) et les zones DNS privées doivent être liées aux deux.',
        'Pour un même préfixe, une route personnalisée l’emporte sur la route système ; la route au préfixe le plus long gagne ; une table ne peut pas contenir deux fois le même préfixe.',
      ],
      sections: [
        {
          id: 'ordre', titre: 'Ordre des opérations',
          points: [
            'Exercice 1 : compte de stockage, file, conteneur, fichier, application B1 avec l’image, port 8080 et chaîne de connexion ; test des pages Messages et Lister Blobs.',
            'Exercice 2 : VNET2 et ses sous-réseaux, points privés du stockage dans le sous-réseau prévu, puis accès public fermé.',
            'Exercice 3 : VNET1 et ses sous-réseaux, intégration de l’application, appairage, zones liées, point privé de l’application, nouveaux tests.',
            'Exercice 4 : tables de routage et routes par sous-réseau.',
          ],
        },
        {
          id: 'routes', titre: 'Routes du TP',
          points: [
            'Vers l’extérieur du réseau : 0.0.0.0/0 avec le tronçon « passerelle de réseau virtuel ».',
            'Trafic à supprimer : le préfixe de la plage avec le tronçon « aucun ».',
            'Services Azure : le préfixe est une étiquette de service avec sa région (AppService.CanadaCentral), tronçon « appliance virtuelle » et son adresse.',
          ],
        },
      ],
      commandes: [
        { cmd: 'az webapp create', sert: 'Crée l’application à partir d’une image de conteneur dans un plan App Service.' },
        { cmd: 'az network private-endpoint create', sert: 'Crée un point de terminaison privé pour une sous-ressource (--group-id).' },
        { cmd: 'az webapp vnet-integration add', sert: 'Branche le trafic sortant de l’application sur un sous-réseau délégué.' },
        { cmd: 'az network vnet peering create', sert: 'Crée une moitié d’appairage entre deux réseaux virtuels (une par sens).' },
        { cmd: 'az network route-table route create', sert: 'Ajoute une route (préfixe ou étiquette de service, type de tronçon, adresse du saut).' },
      ],
      pieges: [
        'Fermer l’accès public du compte avant d’y avoir créé la file, le conteneur et le fichier.',
        'Créer un seul point privé et oublier la deuxième sous-ressource : une des deux pages de l’application échoue.',
        'Mettre le point privé dans le sous-réseau délégué à App Service : Azure le refuse.',
        'Oublier de lier les zones DNS privées au VNET1 : le nom du stockage se résout en adresse publique et l’accès échoue.',
        'Laisser le plan en B1 entre deux séances : il est facturé ; l’énoncé demande de revenir au gratuit.',
      ],
      questions: [
        { q: 'Pourquoi deux points de terminaison privés pour le stockage ?', r: 'Parce que l’application utilise la file (queue) et le conteneur (blob) : chaque sous-ressource a son propre point privé et sa propre zone DNS privée.' },
        { q: 'Quelle différence entre l’intégration au VNet et le point privé de l’application ?', r: 'L’intégration concerne le trafic sortant de l’application vers le réseau ; le point de terminaison privé concerne le trafic entrant vers l’application.' },
        { q: 'Pourquoi l’application dans VNET1 peut-elle joindre le stockage dans VNET2 ?', r: 'Parce que les deux réseaux sont appairés et que les zones DNS privées du stockage sont liées aussi à VNET1 : le nom se résout en adresse privée accessible par l’appairage.' },
        { q: 'Comment envoyer tout le trafic Internet de DataSubnet vers une appliance ?', r: 'Avec une table de routage associée à DataSubnet contenant 0.0.0.0/0 vers « appliance virtuelle » et l’adresse de l’appliance.' },
        { q: 'Pourquoi deux tables de routage pour VMSubnet et DataSubnet ?', r: 'Parce que les deux ont besoin de 0.0.0.0/0 avec des tronçons différents (passerelle d’un côté, appliance de l’autre), et qu’une table ne contient pas deux fois le même préfixe.' },
      ],
    },
    parcours: [
      {
        lettre: 'A',
        titre: 'Exercice 1 : déployer l’application et son stockage',
        points: 2,
        resume: 'Créer le compte de stockage avec sa file queue1 et son conteneur blob1 (et un fichier dedans), déployer l’application en conteneur Linux (plan B1, image romaric/tpasr:latest, port 8080), lui donner la chaîne de connexion du compte et vérifier les pages Messages et Lister Blobs.',
        prerequis: [f('cours-az-groupe-ressources', 2, { titre: 'Créer le groupe', pourquoi: 'un groupe de ressources pour tout le TP.' })],
        items: [
          { id: 'A1', texte: 'Créer un compte de stockage (nom de ton choix), y ajouter la file queue1 et le conteneur blob1, puis déposer un fichier dans blob1.', refs: [f('cours-az-stockage-file-conteneur', 2, { titre: 'Créer le compte' }), f('cours-az-stockage-file-conteneur', 3, { titre: 'file d’attente' }), f('cours-az-stockage-file-conteneur', 4, { titre: 'conteneur' }), f('cours-az-stockage-file-conteneur', 5, { titre: 'Déposer' })], note: 'N’exécute PAS l’étape « Fermer l’accès public » de la fiche ici : elle appartient à l’exercice 2.' },
          { id: 'A2', texte: 'Créer l’App Service avec l’option conteneur Linux et le plan B1, source « autres registres de conteneurs », image romaric/tpasr:latest, port 8080.', refs: [f('cours-az-app-service-creer', 2, { titre: 'Créer le plan' }), f('cours-az-app-service-creer', 3, { titre: 'Créer l’application' }), f('cours-az-app-service-creer', 4, { titre: 'port' })] },
          { id: 'A3', texte: 'Ajouter la chaîne de connexion du compte pour la variable StorageConnectionString (onglet des chaînes de connexion).', refs: [f('cours-az-app-service-creer', 5, { titre: 'chaîne de connexion' })] },
          { id: 'A4', texte: 'Tester les liens Messages et Lister Blobs de l’application et fournir les captures d’écran.', refs: [f('cours-az-app-service-creer', 6, { titre: 'Lire l’adresse' })], note: 'Les pages s’ouvrent dans un navigateur à l’adresse <nom>.azurewebsites.net ; la capture doit montrer le contenu attendu.' },
          { id: 'A5', texte: 'Ramener le plan de service à gratuit quand tu ne travailles pas sur le TP.', refs: [f('cours-az-app-service-creer', 7, { titre: 'plan gratuit' })], note: 'Repasse en B1 au début de chaque séance : le plan gratuit n’offre ni l’intégration au VNet ni les points privés, donc ne le garde que pendant les pauses des exercices 3 et 4.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Exercice 2 : VNET2 et stockage privé',
        points: 4,
        resume: 'Créer VNET2 avec les sous-réseaux du schéma (DataSubnet, GatewaySubnet, VMSubnet, StorageSubnet) en choisissant des plages sans chevauchement, puis configurer le compte de stockage comme le schéma : un point de terminaison privé par sous-ressource utilisée, zones DNS privées et accès public fermé.',
        prerequis: [f('cours-az-plan-adressage', 4, { titre: 'Lire les sous-réseaux', pourquoi: 'planifier les plages avant de créer.' })],
        items: [
          { id: 'B1', texte: 'Créer VNET2 et ses sous-réseaux avec des plages de ton choix en respectant les bonnes pratiques (pas de chevauchement, taille adaptée, GatewaySubnet en /27 au moins).', refs: [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet' }), f('cours-az-sous-reseau-ajouter', 2, { titre: 'Créer le sous-réseau' })], assistants: ['azure-reseau-vnets'] },
          { id: 'B2', texte: 'Créer un point de terminaison privé pour le conteneur (blob) du compte de stockage, dans le sous-réseau du schéma, avec sa zone DNS privée.', refs: [f('cours-az-point-prive-stockage-sous-ressource', 2, { titre: 'Créer le point' }), f('cours-az-point-prive-stockage-sous-ressource', 3, { titre: 'zone DNS privée' }), f('cours-az-point-prive-stockage-sous-ressource', 5, { titre: 'Inscrire' })] },
          { id: 'B3', texte: 'Créer un point de terminaison privé pour la file d’attente (queue) du compte, avec sa zone DNS privée.', refs: [f('cours-az-point-prive-stockage-sous-ressource', 2, { titre: 'Créer le point' }), f('cours-az-point-prive-stockage-sous-ressource', 3, { titre: 'zone DNS privée' }), f('cours-az-point-prive-stockage-sous-ressource', 5, { titre: 'Inscrire' })], note: 'Même fiche que B2, avec la sous-ressource « queue ».' },
          { id: 'B4', texte: 'Fermer l’accès public du compte de stockage (accessible seulement en privé).', refs: [f('cours-az-stockage-file-conteneur', 6, { titre: 'Fermer l’accès public' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Exercice 3 : VNET1, intégration et isolement de l’application',
        points: 7,
        resume: 'Créer VNET1 et ses sous-réseaux (CoreSubnet, GatewaySubnet, AppServiceOutboundSubnet, VMSubnet, AppServiceInboundSubnet), faire communiquer l’application avec le stockage privé (intégration sortante, appairage, zones DNS liées à VNET1), puis rendre l’application accessible uniquement depuis VNET1 avec un point de terminaison privé.',
        prerequis: [f('cours-az-app-service-creer', 2, { titre: 'Créer le plan', pourquoi: 'l’intégration au réseau et les points privés demandent un plan B1 ou plus : repasse en B1.' })],
        items: [
          { id: 'C1', texte: 'Créer VNET1 et ses sous-réseaux avec des plages de ton choix, sans chevauchement avec VNET2.', refs: [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet' }), f('cours-az-sous-reseau-ajouter', 2, { titre: 'Créer le sous-réseau' })], assistants: ['azure-reseau-vnets'] },
          { id: 'C2', texte: 'Faire communiquer VNET1 et VNET2 (appairage dans les deux sens, à l’état Connected).', refs: [f('cours-az-peering-creer', 2, { titre: 'Contrôler les deux plages' }), f('cours-az-peering-creer', 3, { titre: 'premier vers le second' }), f('cours-az-peering-creer', 4, { titre: 'sens inverse' }), f('cours-az-peering-creer', 5, { titre: 'Vérifier' })], note: 'L’énoncé ne cite pas le mot appairage pour cet exercice, mais l’application dans VNET1 ne peut joindre les points privés de VNET2 qu’avec un lien entre les deux réseaux (voir l’ambiguïté TP2-1).' },
          { id: 'C3', texte: 'Intégrer l’application à VNET1 par le sous-réseau de sortie délégué à App Service.', refs: [f('cours-az-app-service-integration-vnet', 2, { titre: 'Déléguer' }), f('cours-az-app-service-integration-vnet', 3, { titre: 'Intégrer' })] },
          { id: 'C4', texte: 'Lier les zones DNS privées du stockage à VNET1 pour que l’application résolve les noms du stockage en adresses privées.', refs: [f('cours-az-point-prive-stockage-sous-ressource', 4, { titre: 'Lier la zone' })], note: 'Refais cette étape pour chaque sous-ressource (blob et queue), avec VNET1 comme réseau.' },
          { id: 'C5', texte: 'Isoler l’application pour qu’elle ne soit accessible que depuis VNET1, par un point de terminaison privé (dans le sous-réseau d’entrée), sans accès public.', refs: [f('cours-az-app-service-point-prive', 3, { titre: 'Créer le point' }), f('cours-az-app-service-point-prive', 4, { titre: 'zone DNS privée' }), f('cours-az-app-service-point-prive', 5, { titre: 'Inscrire' }), f('cours-az-app-service-point-prive', 6, { titre: 'Fermer l’accès public' })] },
          { id: 'C6', texte: 'Vérifier que les fonctions Messages et Lire Blobs fonctionnent encore, depuis une machine de VNET1.', refs: [f('cours-az-app-service-point-prive', 7, { titre: 'Contrôler la résolution' }), f('cours-az-point-prive-stockage-sous-ressource', 6, { titre: 'Contrôler la résolution' })], note: 'Depuis ton poste (hors du réseau) l’application répond maintenant 403 : le test se fait depuis une machine du VNET1 (ou via le portail de l’application selon la consigne de ton enseignant).' },
        ],
      },
      {
        lettre: 'D',
        titre: 'Exercice 4 : routes par sous-réseau',
        points: 4,
        resume: 'Écrire les routes demandées : pour les sous-réseaux VMSubnet, tout ce qui sort du réseau vers la passerelle et une plage supprimée ; pour DataSubnet, Internet, App Service (deux régions) et Event Hubs (deux régions) vers une appliance fictive à l’adresse donnée.',
        prerequis: [f('cours-az-routes-effectives', 2, { titre: 'Lire les routes effectives', pourquoi: 'savoir lire les routes effectives d’une machine pour valider le résultat.' })],
        items: [
          { id: 'D1', texte: 'VMSubnet : tout trafic vers une destination hors du réseau dirigé vers la passerelle réseau.', refs: [f('cours-az-routes-etiquettes-service', 2, { titre: 'Créer la table' }), f('cours-az-routes-etiquettes-service', 3, { titre: 'passerelle' })], note: 'Les « subnets VMSubnet » sont deux (un par VNet) : la table est associée à chacun, voir D6.' },
          { id: 'D2', texte: 'VMSubnet : tout trafic vers la plage 12.12.12.0/30 supprimé.', refs: [f('cours-az-routes-etiquettes-service', 4, { titre: 'plage interdite' })] },
          { id: 'D3', texte: 'DataSubnet : tout trafic vers Internet dirigé vers l’appliance fictive à l’adresse donnée.', refs: [f('cours-az-routes-etiquettes-service', 6, { titre: 'table de DataSubnet' }), f('cours-az-routes-etiquettes-service', 7, { titre: 'Internet vers l’appliance' })] },
          { id: 'D4', texte: 'DataSubnet : tout trafic vers App Service de Canada Centre et de Canada Est dirigé vers l’appliance fictive.', refs: [f('cours-az-routes-etiquettes-service', 8, { titre: 'App Service et Event Hubs' })], note: 'La même étape crée les routes App Service et Event Hubs, une route par étiquette et par région.' },
          { id: 'D5', texte: 'DataSubnet : tout trafic vers Event Hubs de Canada Centre et de Canada Est dirigé vers l’appliance fictive.', refs: [f('cours-az-routes-etiquettes-service', 8, { titre: 'App Service et Event Hubs' })] },
          { id: 'D6', texte: 'Associer chaque table à ses sous-réseaux et relire le résultat pour la capture.', refs: [f('cours-az-routes-etiquettes-service', 5, { titre: 'Associer la table aux deux' }), f('cours-az-routes-etiquettes-service', 9, { titre: 'Associer la table à DataSubnet' }), f('cours-az-routes-etiquettes-service', 10, { titre: 'Relire les routes' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-table-routage-gerer', pourquoi: 'modifier, dissocier ou supprimer une route ou une table, et lire le prochain saut si une route ne fait pas ce que tu attends.' },
      { fiche: 'cours-az-app-service-restriction-ip', pourquoi: 'autre façon de limiter l’accès à l’application (par adresse ou sous-réseau) vue dans le module 06 ; le TP demande les points privés.' },
    ],
    ambiguites: [
      { id: 'TP2-1', sujet: 'Appairage entre VNET1 et VNET2', texte: 'L’énoncé parle de « faire communiquer deux réseaux » dans ses objectifs mais ne dit pas le mot appairage aux exercices 2 et 3 : l’application dans VNET1 doit pourtant joindre les points privés du stockage dans VNET2. Nos étapes créent l’appairage ; confirme avec ton enseignant si une autre solution est attendue.' },
      { id: 'TP2-2', sujet: '« Passerelle réseau » à l’exercice 4', texte: 'La route « vers la passerelle » utilise le tronçon passerelle de réseau virtuel. Aucune passerelle n’est créée dans le TP (une passerelle VPN prend de 30 à 45 minutes et coûte cher) : la route se crée quand même. Dis-le dans ton rapport.' },
      { id: 'TP2-3', sujet: 'Trafic « vers Internet »', texte: 'Nous lisons « tout trafic vers Internet » comme le préfixe 0.0.0.0/0 avec le tronçon appliance virtuelle. Les étiquettes de service des services Azure ont ensuite des routes plus précises qui passent en priorité.' },
      { id: 'TP2-4', sujet: 'Accès à l’application après l’isolement', texte: 'Une fois l’application accessible seulement par le point privé, ton poste ne la joint plus. L’énoncé dit de valider dans le portail ; prévois une machine dans VNET1 (par exemple une VM dans VMSubnet, accessible par Bastion) pour la capture finale.' },
    ],
  },
];

export const COURS_AZURE_TP_PARCOURS = versCli(COURS_AZURE_TP_PARCOURS_BRUT);
