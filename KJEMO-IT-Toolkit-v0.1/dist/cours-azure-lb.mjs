/**
 * cours-azure-lb.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Les équilibreurs de charge d'Azure » : UN cours qui range TOUTES les
 * fiches d'équilibrage par grands groupes (couche 4 ou 7, régional ou global,
 * DNS) et par sous-groupes (public, interne, NAT et sortie, inter-régions,
 * Application Gateway, WAF, Front Door, Traffic Manager).
 *
 *   A  Choisir le bon équilibreur (théorie)
 *   B  Couche 4, régional : Azure Load Balancer
 *   C  Couche 4, global : Load Balancer inter-régions
 *   D  Couche 7, régional : Application Gateway et WAF
 *   E  Couche 7, global : Azure Front Door
 *   F  Par le DNS : Traffic Manager
 *
 * Comme les autres cours, ce parcours ne contient AUCUNE commande : chaque
 * demande renvoie à la fiche, et à l'étape de la fiche, qui y répond. Les
 * étapes citées sont celles de la méthode Azure CLI ; les mêmes travaux
 * existent dans les méthodes « Interface graphique » et PowerShell des fiches.
 * Rien n'est exécuté par le Toolkit.
 */
import { versCli } from './cours-azure-cli.mjs';

/** Renvoi vers l'étape d'une fiche (méthode Azure CLI : les étapes sont numérotées par méthode). */
const f = (fiche, etape = null, titre = null, extra = {}) => ({ fiche, etape, ...(titre ? { titre } : {}), methode: 'azure', ...extra });

const THEORIE = 'Notion à comprendre, sans commande à lancer : le résumé pliable et le schéma « Choisir un service d’équilibrage de charge » la couvrent.';
const AVERTISSEMENT = 'Les fiches expliquent comment faire dans un abonnement de laboratoire, au portail, en PowerShell ou avec Azure CLI ; elles ne remplacent pas ton énoncé et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Rien n’a été exécuté dans Azure par le Toolkit, les écrans sont des reconstitutions. Application Gateway, Front Door et les adresses publiques sont FACTURÉS tant qu’ils existent : supprime le groupe de ressources du laboratoire à la fin.';
const SOURCE = 'Synthèse du Toolkit à partir de la documentation Microsoft Learn et du tableau « Choisir un équilibreur de charge » du cours d’infonuagique (diapositives fournies par l’étudiant, non republiées ici) ; les parcours, le résumé et les schémas sont écrits dans nos mots. En cas de doute, ton énoncé et ton enseignant font foi.';

const RESUME_LB = {
  titre: 'Résumé du cours — Les équilibreurs de charge d’Azure',
  intro: 'À relire pour choisir le bon service : Azure propose quatre équilibreurs (Load Balancer, Application Gateway, Front Door, Traffic Manager) qui se distinguent par la couche réseau (4 ou 7) et par la portée (une région ou le monde entier).',
  essentiel: [
    'Deux questions décident : à quelle couche travaille-t-on (4 : adresse et port ; 7 : contenu HTTP) et sur quelle portée (une région ou plusieurs) ?',
    'Azure Load Balancer travaille en couche 4 dans une région (TCP, UDP) ; sa version inter-régions ajoute une adresse globale devant des équilibreurs régionaux.',
    'Application Gateway travaille en couche 7 dans une région : il lit la requête HTTP (nom d’hôte, chemin) et peut porter un pare-feu d’applications web (WAF).',
    'Front Door est un équilibreur de couche 7 global : la bordure mondiale de Microsoft reçoit le client puis relaie vers l’origine saine la plus rapide.',
    'Traffic Manager équilibre par le DNS : il ne voit jamais le trafic, il répond seulement avec l’adresse choisie ; le basculement dépend du TTL.',
  ],
  sections: [
    {
      id: 'choisir', titre: 'Choisir un équilibreur', schemas: ['az-lb-choix'],
      points: [
        'Couche 4 (Load Balancer) : très faible latence, tout trafic TCP ou UDP, mais aucune lecture du contenu des requêtes.',
        'Couche 7 (Application Gateway, Front Door) : routage par chemin ou nom d’hôte, terminaison TLS, WAF ; uniquement HTTP et HTTPS.',
        'Global (Front Door, Traffic Manager, LB inter-régions) : bascule entre régions ; régional (Load Balancer, Application Gateway) : répartit au sein d’une région.',
        'On combine souvent : Front Door ou Traffic Manager devant plusieurs régions, Application Gateway et Load Balancer dans chacune.',
      ],
    },
    {
      id: 'couche4', titre: 'Load Balancer : public, interne, NAT et sortie', schemas: ['az-lb-composants', 'az-lb-interne', 'az-lb-nat-sortant'],
      points: [
        'Quatre composants : frontale, règle, pool, sonde ; une frontale publique donne un équilibreur public, une frontale privée un équilibreur interne.',
        'Règle NAT entrante : un port de la frontale mène à UNE machine précise (par exemple SSH), alors qu’une règle de répartition choisit un serveur du pool.',
        'Règle sortante (SNAT) : choisit l’adresse publique et le nombre de ports des appels sortants ; on la crée AVANT de désactiver le SNAT par défaut de la règle de répartition.',
        'La référence Standard est fermée par défaut : un groupe de sécurité réseau doit autoriser le trafic et l’étiquette AzureLoadBalancer.',
      ],
    },
    {
      id: 'global4', titre: 'Load Balancer inter-régions', schemas: ['az-lb-inter-regions'],
      points: [
        'Frontale globale : une adresse IP publique de niveau Global, hébergée dans une région d’origine parmi celles que la documentation admet.',
        'Le pool est fait des frontaux d’équilibreurs régionaux publics Standard ; la santé d’une région vient des sondes de ses équilibreurs.',
        'Niveau 4 seulement (TCP, UDP) : pour le HTTP avec routage par chemin, on choisit Front Door.',
      ],
    },
    {
      id: 'couche7', titre: 'Application Gateway et WAF', schemas: ['az-lb-appgw'],
      points: [
        'Éléments : frontale, écouteur, règle de routage, paramètres HTTP, pool, sonde ; il vit dans un sous-réseau dédié et, en v2, a une adresse publique Standard statique.',
        'Le WAF se configure par une politique (jeu de règles OWASP, mode Détection ou Prévention) ; on commence en Détection et on relit les journaux avant de bloquer.',
        'Seule une passerelle de niveau WAF v2 porte une politique WAF ; le niveau coûte plus cher que Standard v2.',
      ],
    },
    {
      id: 'global7', titre: 'Front Door et Traffic Manager', schemas: ['az-lb-frontdoor', 'az-lb-trafficmanager'],
      points: [
        'Front Door : profil, point de terminaison, groupe d’origines (avec sonde), origines, route ; il voit le trafic (cache, TLS, WAF à la bordure).',
        'Traffic Manager : profil avec une méthode de routage (Priorité, Pondéré, Performance, Géographique, Sous-réseau, Multivaleur), points de terminaison et sonde.',
        'Avec Traffic Manager, le client contacte DIRECTEMENT le site après la réponse DNS ; un point en panne n’est écarté qu’à la fin du TTL.',
      ],
    },
  ],
  commandes: [
    { cmd: 'az network lb create --sku Standard', sert: 'Créer un Load Balancer (public avec une IP publique, interne avec un sous-réseau et une adresse privée).' },
    { cmd: 'az network lb outbound-rule create', sert: 'Créer la règle sortante qui choisit l’adresse et les ports SNAT des appels vers Internet.' },
    { cmd: 'az network cross-region-lb create', sert: 'Créer l’équilibreur global (inter-régions) devant des équilibreurs régionaux.' },
    { cmd: 'az network application-gateway create', sert: 'Créer une Application Gateway avec son écouteur, son pool, ses paramètres HTTP et sa règle.' },
    { cmd: 'az network application-gateway waf-policy create', sert: 'Créer la politique WAF (jeu de règles OWASP) à associer à la passerelle.' },
    { cmd: 'az afd profile create', sert: 'Créer le profil Azure Front Door (point de terminaison, groupe d’origines et route suivent).' },
    { cmd: 'az network traffic-manager profile create', sert: 'Créer un profil Traffic Manager avec sa méthode de routage et sa sonde.' },
  ],
  pieges: [
    'Utiliser Traffic Manager en croyant qu’il relaie le trafic : il ne fait que répondre au DNS, et le basculement attend le TTL.',
    'Désactiver le SNAT par défaut avant de créer la règle sortante : les machines perdent leur accès à Internet.',
    'Passer le WAF en Prévention sans avoir relu les journaux de la Détection : de vrais visiteurs peuvent être bloqués.',
    'Mettre autre chose qu’une passerelle dans le sous-réseau d’une Application Gateway.',
    'Ouvrir un port d’administration par une règle NAT sans limiter la source dans le groupe de sécurité réseau.',
  ],
  questions: [
    { q: 'Quel équilibreur choisir pour répartir du trafic HTTP entre deux régions avec routage par chemin ?', r: 'Azure Front Door : couche 7 et global. Le Load Balancer travaille en couche 4 et l’Application Gateway reste dans une seule région.' },
    { q: 'Quelle différence entre Traffic Manager et Front Door ?', r: 'Traffic Manager répond au DNS avec l’adresse choisie et ne voit pas le trafic (tout protocole). Front Door reçoit le trafic HTTP(S) à la bordure et le relaie : cache, TLS, WAF et basculement rapide.' },
    { q: 'Comment rendre un Load Balancer interne plutôt que public ?', r: 'En donnant à sa frontale une adresse privée d’un sous-réseau au lieu d’une IP publique : le service n’est alors joignable que depuis le réseau virtuel ou un réseau relié.' },
    { q: 'Dans quel ordre créer la règle sortante et désactiver le SNAT par défaut ?', r: 'D’abord la règle sortante (frontale de sortie et pool), puis la désactivation du SNAT par défaut de la règle de répartition ; l’ordre inverse coupe la sortie des machines.' },
    { q: 'Pourquoi commencer un WAF en mode Détection ?', r: 'Parce que la Détection journalise sans bloquer : on relit les journaux, on écarte les faux positifs, puis on passe en Prévention sans bloquer de vrais visiteurs.' },
  ],
};

const COURS_AZURE_LB_PARCOURS_BRUT = [
  {
    id: 'azure-09-equilibreurs',
    plateformes: ['Azure'],
    titre: 'Infonuagique — Tous les équilibreurs de charge d’Azure',
    resume: 'Choisir puis mettre en place chaque équilibreur d’Azure : Load Balancer (public, interne, NAT et sortie, inter-régions), Application Gateway avec WAF, Front Door et Traffic Manager. Chaque fiche a ses trois méthodes : portail, PowerShell et Azure CLI.',
    source: SOURCE,
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_LB,
    parcours: [
      // =======================================================================
      {
        lettre: 'A',
        titre: 'Choisir le bon équilibreur (théorie)',
        resume: 'Deux questions pour choisir : la couche (4 ou 7) et la portée (une région ou global). Aucune commande ici : le résumé et le schéma comparent les quatre services.',
        prerequis: [],
        items: [
          { id: 'A1.1', texte: 'Sous-groupe « Critères » : distinguer la couche 4 (adresse et port) de la couche 7 (contenu HTTP).', refs: [], couvert: false, note: THEORIE },
          { id: 'A1.2', texte: 'Sous-groupe « Critères » : distinguer un équilibreur régional d’un équilibreur global.', refs: [], couvert: false, note: THEORIE },
          { id: 'A2.1', texte: 'Sous-groupe « Décision » : choisir entre Load Balancer, Application Gateway, Front Door et Traffic Manager selon le besoin.', refs: [], couvert: false, note: 'Lecture du tableau comparatif du résumé : couche, portée, trafic géré et usage de chaque service ; la suite du cours met chacun en œuvre.' },
          { id: 'A2.2', texte: 'Sous-groupe « Décision » : savoir combiner les services (global devant, régional dans chaque région).', refs: [], couvert: false, note: THEORIE },
        ],
      },
      // =======================================================================
      {
        lettre: 'B',
        titre: 'Couche 4, régional : Azure Load Balancer',
        resume: 'Le Load Balancer répartit les connexions TCP et UDP vers les machines saines d’un pool, au sein d’une région. Quatre sous-groupes : l’équilibreur public, l’équilibreur interne, les règles NAT entrante et sortante, puis la lecture de l’état.',
        prerequis: [f('cours-az-vm-creer-vnet', 2, 'Créer la machine', { pourquoi: 'il faut au moins deux machines à mettre dans le pool.' })],
        items: [
          { id: 'B1.1', texte: 'Sous-groupe « Public » : créer l’adresse IP publique frontale, l’équilibreur et son pool.', refs: [f('cours-az-lb-creer', 2, 'adresse IP publique frontale'), f('cours-az-lb-creer', 3, 'Créer l’équilibreur')] },
          { id: 'B1.2', texte: 'Sous-groupe « Public » : configurer la sonde d’intégrité et la règle de répartition.', refs: [f('cours-az-lb-creer', 4, 'sonde'), f('cours-az-lb-creer', 5, 'règle')] },
          { id: 'B1.3', texte: 'Sous-groupe « Public » : ajouter les machines au pool et vérifier.', refs: [f('cours-az-lb-creer', 6, 'Ajouter un serveur'), f('cours-az-lb-creer', 7, 'Vérifier')] },
          { id: 'B2.1', texte: 'Sous-groupe « Interne » : créer un équilibreur dont la frontale a une adresse privée dans un sous-réseau.', refs: [f('cours-az-lb-interne', 2, 'Vérifier le sous-réseau'), f('cours-az-lb-interne', 3, 'Créer l’équilibreur interne')] },
          { id: 'B2.2', texte: 'Sous-groupe « Interne » : sonde, règle, serveurs du pool et vérification de la frontale privée.', refs: [f('cours-az-lb-interne', 4, 'sonde'), f('cours-az-lb-interne', 5, 'règle'), f('cours-az-lb-interne', 6, 'Ajouter un serveur'), f('cours-az-lb-interne', 7, 'Vérifier la frontale privée')] },
          { id: 'B3.1', texte: 'Sous-groupe « NAT et sortie » : créer une règle NAT entrante et l’associer à l’interface d’une machine.', refs: [f('cours-az-lb-regles-nat-sortant', 2, 'règle NAT entrante'), f('cours-az-lb-regles-nat-sortant', 3, 'Associer la règle NAT')] },
          { id: 'B3.2', texte: 'Sous-groupe « NAT et sortie » : donner une adresse publique de sortie et créer la règle sortante (SNAT).', refs: [f('cours-az-lb-regles-nat-sortant', 4, 'adresse IP publique de sortie'), f('cours-az-lb-regles-nat-sortant', 5, 'frontale pour la sortie'), f('cours-az-lb-regles-nat-sortant', 6, 'règle sortante')] },
          { id: 'B3.3', texte: 'Sous-groupe « NAT et sortie » : désactiver le SNAT par défaut de la règle de répartition, puis vérifier.', refs: [f('cours-az-lb-regles-nat-sortant', 7, 'Désactiver le SNAT'), f('cours-az-lb-regles-nat-sortant', 8, 'Vérifier les règles')] },
          { id: 'B4.1', texte: 'Sous-groupe « Lire l’état » : lire la configuration et la santé d’un équilibreur existant.', refs: [f('cours-az-lb-etat', 1, 'Vue d’ensemble'), f('cours-az-lb-etat', 2, 'frontale'), f('cours-az-lb-etat', 3, 'pool')] },
          { id: 'B4.2', texte: 'Sous-groupe « Lire l’état » : lire les règles et les sondes pour dépanner.', refs: [f('cours-az-lb-etat', 4, 'règles'), f('cours-az-lb-etat', 5, 'sondes')] },
        ],
      },
      // =======================================================================
      {
        lettre: 'C',
        titre: 'Couche 4, global : Load Balancer inter-régions',
        resume: 'Une adresse globale devant des équilibreurs régionaux : le client est dirigé vers la région saine la plus proche. Il faut déjà deux équilibreurs régionaux publics Standard.',
        prerequis: [f('cours-az-lb-creer', 3, 'Créer l’équilibreur', { pourquoi: 'deux équilibreurs régionaux publics Standard sont nécessaires, un par région.' })],
        items: [
          { id: 'C1.1', texte: 'Sous-groupe « Frontale globale » : contrôler les équilibreurs régionaux puis créer l’adresse IP publique globale.', refs: [f('cours-az-lb-inter-regions', 2, 'Contrôler les équilibreurs régionaux'), f('cours-az-lb-inter-regions', 3, 'adresse IP publique globale')] },
          { id: 'C1.2', texte: 'Sous-groupe « Frontale globale » : créer l’équilibreur global, sa règle de répartition et son pool.', refs: [f('cours-az-lb-inter-regions', 4, 'Créer l’équilibreur global'), f('cours-az-lb-inter-regions', 5, 'règle de répartition globale')] },
          { id: 'C2.1', texte: 'Sous-groupe « Membres du pool » : ajouter les équilibreurs régionaux au pool puis vérifier.', refs: [f('cours-az-lb-inter-regions', 6, 'Ajouter les équilibreurs régionaux'), f('cours-az-lb-inter-regions', 7, 'Vérifier l’équilibreur global')] },
        ],
      },
      // =======================================================================
      {
        lettre: 'D',
        titre: 'Couche 7, régional : Application Gateway et WAF',
        resume: 'L’Application Gateway lit les requêtes HTTP (écouteur, règle de routage, paramètres HTTP, pool, sonde) ; le WAF la protège par une politique OWASP, d’abord en Détection puis en Prévention.',
        prerequis: [f('cours-az-vnet-creer', 3, 'Créer le VNet', { pourquoi: 'un réseau virtuel avec de la place pour un sous-réseau dédié est nécessaire.' })],
        items: [
          { id: 'D1.1', texte: 'Sous-groupe « Application Gateway » : créer le sous-réseau dédié, l’adresse IP publique Standard et la passerelle avec son écouteur, son pool et sa règle.', refs: [f('cours-az-appgw-creer', 2, 'sous-réseau dédié'), f('cours-az-appgw-creer', 3, 'adresse IP publique Standard'), f('cours-az-appgw-creer', 4, 'Créer la passerelle')] },
          { id: 'D1.2', texte: 'Sous-groupe « Application Gateway » : créer la sonde d’intégrité et l’associer aux paramètres HTTP.', refs: [f('cours-az-appgw-creer', 5, 'sonde'), f('cours-az-appgw-creer', 6, 'Associer la sonde')] },
          { id: 'D1.3', texte: 'Sous-groupe « Application Gateway » : lire l’intégrité des serveurs et vérifier les composants.', refs: [f('cours-az-appgw-creer', 7, 'Lire l’intégrité'), f('cours-az-appgw-creer', 8, 'Vérifier les composants')] },
          { id: 'D2.1', texte: 'Sous-groupe « WAF » : créer la politique avec le jeu de règles OWASP et régler son mode (Détection ou Prévention).', refs: [f('cours-az-appgw-waf', 2, 'Lire la référence'), f('cours-az-appgw-waf', 3, 'Créer la politique WAF'), f('cours-az-appgw-waf', 4, 'Régler le mode')] },
          { id: 'D2.2', texte: 'Sous-groupe « WAF » : passer la passerelle au niveau WAF v2, associer la politique et vérifier.', refs: [f('cours-az-appgw-waf', 5, 'niveau WAF V2'), f('cours-az-appgw-waf', 6, 'Vérifier la politique')] },
        ],
      },
      // =======================================================================
      {
        lettre: 'E',
        titre: 'Couche 7, global : Azure Front Door',
        resume: 'Front Door met la bordure mondiale de Microsoft devant tes origines : un profil, un point de terminaison, un groupe d’origines avec sa sonde, des origines et une route.',
        prerequis: [],
        items: [
          { id: 'E1.1', texte: 'Sous-groupe « Profil et point d’entrée » : créer le profil Front Door et son point de terminaison.', refs: [f('cours-az-frontdoor-creer', 2, 'Créer le profil'), f('cours-az-frontdoor-creer', 3, 'point de terminaison')] },
          { id: 'E2.1', texte: 'Sous-groupe « Origines et route » : créer le groupe d’origines avec sa sonde et ajouter l’origine.', refs: [f('cours-az-frontdoor-creer', 4, 'groupe d’origines'), f('cours-az-frontdoor-creer', 5, 'Ajouter l’origine')] },
          { id: 'E2.2', texte: 'Sous-groupe « Origines et route » : créer la route puis lire l’adresse du point de terminaison.', refs: [f('cours-az-frontdoor-creer', 6, 'Créer la route'), f('cours-az-frontdoor-creer', 7, 'Lire l’adresse')] },
        ],
      },
      // =======================================================================
      {
        lettre: 'F',
        titre: 'Par le DNS : Traffic Manager',
        resume: 'Traffic Manager choisit la réponse DNS selon une méthode de routage et l’état des points de terminaison ; il ne voit pas le trafic.',
        prerequis: [],
        items: [
          { id: 'F1.1', texte: 'Sous-groupe « Profil » : créer le profil avec sa méthode de routage, son TTL et sa sonde.', refs: [f('cours-az-trafficmanager-creer', 2, 'Créer le profil')] },
          { id: 'F2.1', texte: 'Sous-groupe « Points de terminaison » : ajouter les points de terminaison et adapter leurs réglages à la méthode (poids, emplacement, mappage).', refs: [f('cours-az-trafficmanager-creer', 3, 'Ajouter les deux points'), f('cours-az-trafficmanager-creer', 4, 'Adapter les points')] },
          { id: 'F2.2', texte: 'Sous-groupe « Points de terminaison » : lire l’état de surveillance et tester la résolution DNS.', refs: [f('cours-az-trafficmanager-creer', 5, 'Lire le profil'), f('cours-az-trafficmanager-creer', 6, 'Tester la résolution')] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-lb-etat', pourquoi: 'dépanner une sonde qui retire tous les serveurs de la rotation (même logique pour Application Gateway et Front Door).' },
    ],
    ambiguites: [
      { id: 'LB-1', sujet: 'Load Balancer « global » ou « inter-régions »', texte: 'Microsoft écrit « équilibreur de charge inter-régions » (cross-region) ; le portail le nomme niveau « Mondial » (Global). C’est le même service, de couche 4 : ne le confonds pas avec Front Door ni Traffic Manager, qui sont aussi globaux mais d’un autre type.' },
      { id: 'LB-2', sujet: 'Front Door classique ou Standard/Premium', texte: 'La fiche vise les niveaux Standard et Premium (commandes « az afd »). Le Front Door « classique » est une version plus ancienne, annoncée en retrait ; vérifie sa date sur Microsoft Learn et demande à ton enseignant lequel attend l’énoncé.' },
      { id: 'LB-3', sujet: 'Application Gateway v1 ou v2', texte: 'La fiche ne couvre que la v2 (sous-réseau dédié, adresse publique Standard). La v1 est en fin de vie ; si ton énoncé parle d’une référence « Standard » ou « WAF » sans « v2 », fais-toi confirmer qu’il s’agit bien de la v2.' },
    ],
  },
];

export const COURS_AZURE_LB_PARCOURS = versCli(COURS_AZURE_LB_PARCOURS_BRUT);
