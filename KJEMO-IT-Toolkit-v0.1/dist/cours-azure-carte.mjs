/**
 * cours-azure-carte.mjs — AZURE-TP-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Carte » de la documentation Microsoft « Réseau virtuel Azure » (le PDF de
 * 1 139 pages donné par l'enseignant) : ses articles regroupés en treize
 * groupes (A à M) et en sous-groupes, avec pour chaque article la page du PDF
 * et la fiche du Toolkit qui s'y entraîne, ou la mention « lecture » quand
 * il n'y a rien à lancer.
 *
 * Elle sert à se repérer et à s'entraîner plus tard : on part d'un groupe, on
 * lit l'article à la page indiquée, puis on rejoue la fiche. Seuls les TITRES
 * des articles sont cités (table des matières du PDF) ; leur contenu n'est pas
 * republié. Les pages sont celles du PDF fourni et peuvent changer si
 * Microsoft le met à jour.
 */
import { versCli } from './cours-azure-cli.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const LIRE = 'Article de lecture ou de référence, sans commande à lancer dans le Toolkit : ouvre le PDF à la page indiquée pour le lire ou t’en servir de référence.';
const SOURCE = 'Table des matières du PDF « azure virtual-network | Microsoft Learn » (1 139 pages) fourni par l’étudiant ; seuls les titres des articles et leurs numéros de page sont cités, le contenu n’est pas republié.';
const AVERTISSEMENT = 'Cette carte te dit où lire et quelle fiche rejouer ; elle n’explique pas les articles et ne prouve rien. Les fiches sont écrites pour Azure CLI et n’ont pas été exécutées dans un abonnement. Les numéros de page sont ceux du PDF fourni.';

/** Un article : [titre, page, fiches (ou null), note facultative]. */
const a = (titre, page, refs = null, note = null) => ({ titre, page, refs, note });

const GROUPES = [
  { lettre: 'A', titre: 'Comprendre le réseau virtuel (vue d’ensemble)', resume: 'Les notions de base à connaître avant de manipuler quoi que ce soit : ce qu’est un réseau virtuel, sa foire aux questions, les coûts, la mise en réseau accélérée, le filtrage (groupes de sécurité), les points de terminaison de service et les étiquettes de service, puis les bonnes pratiques d’architecture.',
    articles: [
      a('Qu’est-ce que Réseau virtuel Azure ?', 5, [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet' })]),
      a('FAQ du réseau virtuel', 10), a('Optimisation des coûts', 41), a('Mise en réseau accélérée', 49),
      a('Groupes de sécurité d’application', 56), a('Groupes de sécurité réseau (vue d’ensemble)', 59),
      a('Points de terminaison de service', 68, [f('cours-az-point-service-stockage', 2, { titre: 'Activer le point de service' })]),
      a('Terminaison de service standard', 79),
      a('Balises de service (étiquettes de service)', 86, [f('cours-az-routes-etiquettes-service', 8, { titre: 'App Service et Event Hubs' })]),
      a('Bonnes pratiques d’architecture pour Réseau virtuel Azure', 107), a('Qu’est-ce que les fondations réseau ?', 125), a('Appliance de routage de réseau virtuel', 132),
    ] },
  { lettre: 'B', titre: 'Démarrer : sous-réseaux, création, planification et routage', resume: 'Les premières manipulations : ajouter ou changer un sous-réseau, créer un réseau virtuel, le superviser, planifier l’adressage, comprendre le routage du trafic et créer une appliance de routage.',
    articles: [
      a('Ajouter, changer ou supprimer un sous-réseau', 139, [f('cours-az-sous-reseau-ajouter', 2, { titre: 'Créer le sous-réseau' })]),
      a('Créez un réseau virtuel', 145, [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet' })]),
      a('Monitoring', 155), a('Planifier des réseaux virtuels', 164, [f('cours-az-plan-adressage', 4, { titre: 'Lire les sous-réseaux' })]),
      a('Routage du trafic', 171, [f('cours-az-route-personnalisee', 3, { titre: 'Ajouter la route' }), f('cours-az-routes-effectives', 2, { titre: 'Lire les routes effectives' })]),
      a('Créer une appliance de routage', 192),
    ] },
  { lettre: 'C', titre: 'Sécurité du réseau virtuel', resume: 'Sécuriser le réseau : réseau virtuel sécurisé, stratégies réseau Kubernetes, conformité et base de référence, protection DDoS, chiffrement, groupes de sécurité réseau (filtrage et gestion), stratégies de point de terminaison de service pour le stockage et TAP de réseau virtuel.',
    articles: [
      a('Réseau virtuel sécurisé', 198), a('Stratégies réseau Kubernetes', 209), a('Contrôles de conformité de la politique Azure', 222), a('Base de référence de sécurité', 267),
      a('Protection DDoS : vue d’ensemble', 273), a('Protection DDoS : créer et configurer', 278), a('Protection DDoS : partenariat', 283),
      a('Chiffrement : vue d’ensemble', 288), a('Chiffrement : créer un réseau virtuel chiffré', 293), a('Chiffrement : FAQ', 300),
      a('Comment les groupes de sécurité filtrent le trafic', 303), a('Gérer des groupes de sécurité réseau', 307),
      a('Stratégies de point de terminaison de service pour le stockage', 330, [f('cours-az-point-service-stockage', 3, { titre: 'Autoriser le sous-réseau' })]),
      a('TAP de réseau virtuel (vue d’ensemble, portail, CLI)', 338),
    ] },
  { lettre: 'D', titre: 'Architecture et concepts', resume: 'Les concepts qui expliquent le comportement d’Azure : isolation réseau des services, interopérabilité, listes de contrôle IP, délégation et extension de sous-réseau, préfixes de passerelle annoncés, appairage (peering) et l’adresse spéciale 168.63.129.16.',
    articles: [
      a('L’isolation réseau des services Azure', 353, [f('cours-az-point-prive-stockage', 2, { titre: 'Créer le point de terminaison privé' })]),
      a('Concepts et bonnes pratiques', 364), a('Interopérabilité dans Azure', 367),
      a('Liste de contrôle d’accès basée sur IP (ACL)', 373, [f('cours-az-app-service-restriction-ip', 3, { titre: 'Autoriser une adresse IP' })]),
      a('Délégation de sous-réseau', 377, [f('cours-az-app-service-integration-vnet', 2, { titre: 'Déléguer' })]),
      a('Extension de sous-réseau', 380), a('Préfixes de passerelle annoncés', 383),
      a('Peering de réseau virtuel', 386, [f('cours-az-peering-creer', 3, { titre: 'premier vers le second' })]),
      a('Quelle est l’adresse IP 168.63.129.16 ?', 397),
    ] },
  { lettre: 'E', titre: 'Planifier et concevoir', resume: 'Concevoir avant de déployer : réseau hybride sécurisé, résolution des noms, appliances virtuelles réseau, débit des machines virtuelles, DNS dynamique, noms d’hôte et choix liés aux machines virtuelles.',
    articles: [
      a('Implémenter un réseau hybride sécurisé', 401), a('Résolution des noms pour les ressources', 411, [f('cours-az-dns-zone-privee', 2, { titre: 'Créer la zone privée' })]),
      a('Appliances virtuelles réseau (NVA)', 425, [f('cours-az-route-personnalisee', 4, { titre: 'transfert IP' })]),
      a('Optimiser le débit réseau des machines virtuelles', 433), a('Utiliser un DNS dynamique pour inscrire les noms d’hôte', 440),
      a('Réseaux virtuels et machines virtuelles dans Azure', 443, [f('cours-az-vm-creer-vnet', 2, { titre: 'Créer la machine' })]),
    ] },
  { lettre: 'F', titre: 'Déployer : tutoriels pas à pas', resume: 'Les tutoriels de déploiement : préfixes de passerelle, ExpressRoute, connexion de réseaux virtuels, stratégies de point de service, filtrage du trafic, restriction de l’accès aux services PaaS et routage du trafic.',
    articles: [
      a('Configurer les préfixes de passerelle publiés', 457), a('Connecter un réseau virtuel à des circuits ExpressRoute', 461), a('Connecter un réseau local à Azure avec ExpressRoute', 476),
      a('Connecter des réseaux virtuels', 483, [f('cours-az-peering-creer', 3, { titre: 'premier vers le second' }), f('cours-az-peering-creer', 4, { titre: 'sens inverse' })]),
      a('Créer et associer des stratégies de point de terminaison de service', 496),
      a('Filtrer le trafic réseau (groupes de sécurité)', 512),
      a('Restreindre l’accès réseau aux ressources PaaS', 527, [f('cours-az-point-service-stockage', 5, { titre: 'Fermer l’accès public' })]),
      a('Router le trafic réseau (tutoriel)', 547, [f('cours-az-route-personnalisee', 2, { titre: 'Créer la table' }), f('cours-az-route-personnalisee', 5, { titre: 'Associer la table' })]),
    ] },
  { lettre: 'G', titre: 'Gérer : performances, conteneurs et préfixes', resume: 'Régler et étendre le réseau : mise en réseau accélérée (création, gestion, Linux, DPDK), délégation de sous-réseau, réseau de conteneurs et plusieurs préfixes pour un sous-réseau.',
    articles: [
      a('Machine virtuelle avec mise en réseau accélérée', 566), a('Gérer les performances réseau accélérées', 576), a('Accélération pour les machines optimisées pour le réseau', 581), a('Machines virtuelles Linux et FreeBSD (accélérée)', 585), a('DPDK', 596),
      a('Ajouter ou supprimer une délégation de sous-réseau', 604, [f('cours-az-app-service-integration-vnet', 2, { titre: 'Déléguer' })]),
      a('Mise en réseau de conteneurs (vue d’ensemble, déploiement, hôte autonome)', 609),
      a('Créer plusieurs préfixes pour un sous-réseau', 629),
    ] },
  { lettre: 'H', titre: 'Gérer : Private Link et appairage', resume: 'Intégrer des services à Private Link (points de terminaison privés), créer des appairages entre abonnements ou locataires, gérer un appairage, désactiver la propagation de ses routes, mettre à jour l’espace d’adressage d’un réseau appairé et appairer des sous-réseaux.',
    articles: [
      a('Intégrer des services à Private Link', 635, [f('cours-az-point-prive-stockage-sous-ressource', 2, { titre: 'Créer le point' }), f('cours-az-app-service-point-prive', 3, { titre: 'Créer le point' })]),
      a('Créer un appairage : abonnements et locataires différents', 640), a('Créer un appairage : abonnements différents avec des principaux de service', 655),
      a('Gérer un appairage de réseaux virtuels', 670, [f('cours-az-peering-verifier', 2, { titre: 'Lire l’état' })]),
      a('Désactiver la propagation de la route de peering', 684), a('Mettre à jour l’espace d’adressage d’un réseau virtuel appairé', '684 à 687'),
      a('Configurer l’appairage de sous-réseaux', 687),
    ] },
  { lettre: 'I', titre: 'Gérer : routage', resume: 'Les tables de routage : créer, lire, modifier, associer, dissocier et supprimer, plus l’automatisation avec Ansible.',
    articles: [
      a('Gérer les tables de routage', '687 à 696', [f('cours-az-table-routage-gerer', 2, { titre: 'Lister les tables' }), f('cours-az-table-routage-gerer', 8, { titre: 'Dissocier' }), f('cours-az-routes-etiquettes-service', 3, { titre: 'passerelle' })]),
      a('Ansible (tables de routage)', 696),
    ] },
  { lettre: 'J', titre: 'Connectivité hybride (VPN)', resume: 'Relier Azure à d’autres réseaux par passerelle VPN : de réseau virtuel à réseau virtuel, entre modèles de déploiement différents, et de site à site.',
    articles: [
      a('Configurer une connexion de passerelle VPN de réseau virtuel à réseau virtuel', 703),
      a('Connecter des réseaux virtuels de modèles de déploiement différents', 720),
      a('Créer une connexion VPN de site à site', 732),
    ] },
  { lettre: 'K', titre: 'Machines virtuelles et interfaces réseau', resume: 'Tout ce qui touche l’interface réseau d’une machine : plusieurs cartes, MTU, carte MANA, gestion d’une carte, migration d’une IP publique vers une passerelle NAT, bande passante et optimisation TCP/IP.',
    articles: [
      a('Ajouter ou supprimer des interfaces réseau', '732 à 754'), a('Configurer la MTU des machines virtuelles', 754),
      a('Machine virtuelle Linux avec plusieurs cartes', 768), a('Machine virtuelle Windows avec plusieurs cartes', 776),
      a('Gérer une interface réseau', 786, [f('cours-az-ip-publique-privee', 4, { titre: 'Fixer l’adresse privée' })]),
      a('Adaptateur de mise en réseau Microsoft Azure (MANA)', 804),
      a('Migrer une adresse IP publique de machine virtuelle vers une passerelle NAT', 826),
      a('Bande passante du réseau', 830), a('Optimisation des performances de TCP/IP', 835),
    ] },
  { lettre: 'L', titre: 'Fiabilité, déplacement et support', resume: 'Déployer un serveur DHCP, déplacer des ressources réseau vers une autre région (groupes de sécurité, interfaces, réseaux virtuels), la fiabilité du service et la résolution des problèmes.',
    articles: [
      a('Déployer un serveur DHCP sur une machine virtuelle Azure', 850),
      a('Passer d’une région à l’autre : groupes de sécurité réseau', 861), a('Passer d’une région à l’autre : réseaux virtuels', 867),
      a('Passer d’une région à l’autre : interfaces réseau', 879),
      a('Fiabilité du réseau virtuel Azure', 927), a('Support et résolution des problèmes', 934),
    ] },
  { lettre: 'M', titre: 'Référence (CLI, PowerShell, API, Policy)', resume: 'Les pages de référence en fin de PDF : données de supervision, Azure CLI, Azure PowerShell, .NET, Node.js, REST, modèles Resource Manager, exemples de code et définitions Azure Policy intégrées.',
    articles: [
      a('Référence des données de supervision', 937), a('Azure CLI (référence)', 957), a('Azure PowerShell (référence)', 958), a('.NET (référence)', 1003),
      a('Node.js (référence)', 1004), a('REST (référence)', 1007), a('Modèle Resource Manager (référence)', 1008), a('Définitions intégrées Azure Policy', 1126),
    ] },
];

const COURS_AZURE_CARTE_BRUT = [{
  id: 'azure-08-carte-documentation',
  plateformes: ['Azure'],
  titre: 'Carte de la documentation « Réseau virtuel Azure » (PDF du cours)',
  resume: 'Les articles du PDF de 1 139 pages, rangés en treize groupes (A à M) avec leur page et la fiche du Toolkit qui s’y entraîne : pour savoir où lire et quoi rejouer avant un examen ou un TP.',
  source: SOURCE,
  avertissement: AVERTISSEMENT,
  parcours: GROUPES.map((g) => ({
    lettre: g.lettre,
    titre: g.titre,
    resume: g.resume,
    prerequis: [],
    items: g.articles.map((x, i) => {
      const id = `${g.lettre}${i + 1}`;
      const texte = typeof x.page === 'number' ? `${x.titre} (page ${x.page} du PDF).` : `${x.titre} (entre les pages ${x.page} du PDF : la table des matières n’indique pas la page exacte).`;
      return x.refs
        ? { id, texte, refs: x.refs, ...(x.note ? { note: x.note } : {}) }
        : { id, texte, refs: [], couvert: false, note: x.note ?? LIRE };
    }),
  })),
  soutien: [
    { fiche: 'cours-az-plan-adressage', pourquoi: 'point de départ de presque tous les groupes : savoir lire les réseaux et sous-réseaux existants.' },
  ],
  ambiguites: [
    { id: 'CARTE-1', sujet: 'Numéros de page du PDF', texte: 'Les pages viennent de la table des matières du PDF fourni (trois entrées ne portent pas de numéro dans la table des matières : la gestion des tables de routage, la mise à jour de l’espace d’adressage d’un réseau appairé et l’ajout ou la suppression d’interfaces réseau ; elles sont donc données par un intervalle de pages). Ouvre la page indiquée et lis quelques pages autour si l’article ne commence pas là.' },
  ],
}];

export const COURS_AZURE_CARTE = versCli(COURS_AZURE_CARTE_BRUT);
