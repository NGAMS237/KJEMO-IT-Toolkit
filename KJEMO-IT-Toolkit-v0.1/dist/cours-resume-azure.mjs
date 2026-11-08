/**
 * cours-resume-azure.mjs — KJEMO-AZURE-COURS-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * RÉSUMÉS PLIABLES des cours d'infonuagique (introduction, Azure, réseau
 * virtuel, résolution de noms, peering et routage, accès privé, équilibrage
 * de charge) pour se rafraîchir la mémoire plus tard : l'essentiel, les
 * schémas, les commandes à retenir, les pièges et des questions à réponse
 * cachée.
 *
 * Écrits dans nos mots à partir des diapositives fournies par l'étudiant ;
 * elles ne sont pas republiées (voir schemas-azure.mjs pour les schémas
 * originaux). Les commandes sont à lire, pas à exécuter : les fiches du
 * catalogue donnent les mêmes commandes avec des paramètres validés.
 */

// ---------------------------------------------------------------------------
// Cours 01 et 02 : infonuagique et Azure
// ---------------------------------------------------------------------------
export const RESUME_AZ_01 = {
  titre: 'Résumé du cours — Infonuagique et Microsoft Azure',
  intro: 'À relire avant un examen : pourquoi migrer vers le cloud, les modèles de déploiement et de service, puis les notions propres à Azure (régions, zones, groupes de ressources, abonnements, gouvernance).',
  essentiel: [
    'Le cloud donne un accès à la demande à du calcul, du stockage et du réseau, payés selon l’usage : fini les ressources dupliquées pour chaque environnement (production, tests, intégration) et dimensionnées pour le pire cas.',
    'Trois modèles de déploiement : public (le fournisseur héberge pour plusieurs organisations), privé (une organisation chez elle) et hybride (un mélange, chaque application là où elle convient le mieux).',
    'Trois modèles de service : IaaS (tu loues des machines et du réseau et tu gères le système), PaaS (tu déploies une application sans gérer l’infrastructure) et SaaS (tu utilises une application toute faite).',
    'Dans Azure, tout vit dans un groupe de ressources, lui-même dans un abonnement ; les droits et les règles se transmettent de haut en bas.',
    'Les zones de disponibilité protègent d’une panne de centre de données ; les paires régionales protègent d’un sinistre régional.',
  ],
  sections: [
    {
      id: 'modeles', titre: 'Modèles de déploiement et de service', schemas: ['az-modeles-service'],
      points: [
        'Cloud public : pas d’investissement initial (CapEx), accès attribués ou retirés rapidement, tu ne paies que ce que tu utilises.',
        'Cloud privé : matériel à acheter et à entretenir, maîtrise totale des ressources et de la sécurité, flexibilité maximale.',
        'Cloud hybride : l’organisation choisit où chaque application s’exécute, par exemple pour respecter des exigences légales ou de conformité.',
        'Avec IaaS, tu gères le système et au-dessus ; avec PaaS, seulement l’application et les données ; avec SaaS, tes données et tes accès.',
      ],
    },
    {
      id: 'geographie', titre: 'Régions, zones et paires régionales', schemas: ['az-regions-zones'],
      points: [
        'Une région est formée d’un ou plusieurs centres de données proches l’un de l’autre ; on choisit celle qui réduit la latence et respecte la résidence des données.',
        'Une zone de disponibilité est un centre de données physiquement séparé, avec sa propre alimentation, sa climatisation et son réseau, relié aux autres par fibre.',
        'Une paire régionale réunit deux régions d’une même zone géographique, à au moins 500 km l’une de l’autre ; certains services y sont répliqués automatiquement et les mises à jour y sont décalées.',
        'D’après le cours : une machine seule offre 99,9 % de disponibilité avec le stockage Premium, et 99,99 % avec les zones de disponibilité.',
      ],
    },
    {
      id: 'organisation', titre: 'Organiser les ressources', schemas: ['az-hierarchie'],
      points: [
        'Une ressource (machine, réseau virtuel, compte de stockage…) appartient à un seul groupe de ressources ; on peut la déplacer, et un groupe peut contenir des ressources de plusieurs régions.',
        'Azure Resource Manager (ARM) est la couche de gestion qui crée, modifie et supprime les ressources de l’abonnement.',
        'Un abonnement est une limite de facturation et de contrôle d’accès ; les groupes d’administration regroupent des abonnements (jusqu’à six niveaux) et leur transmettent leurs règles.',
        'On gère Azure avec le portail, Azure CLI, Azure PowerShell, Cloud Shell, l’API REST ou des modèles (ARM, Bicep).',
      ],
    },
    {
      id: 'gouvernance', titre: 'Gouvernance : rôles et verrous',
      points: [
        'RBAC (contrôle d’accès en fonction du rôle) : on attribue un rôle à une personne, un groupe ou une application sur une étendue (abonnement, groupe, ressource).',
        'Pour travailler en équipe, on donne le rôle Contributeur sur son abonnement à ses coéquipiers ; chacun voit alors les ressources des autres.',
        'Un verrou (CanNotDelete ou ReadOnly) protège contre la suppression ou la modification accidentelle, même pour un propriétaire.',
        'Le compte étudiant gratuit s’active avec un numéro de téléphone, sans carte de crédit, et donne un crédit pour une durée limitée.',
      ],
    },
  ],
  commandes: [
    { cmd: 'az account show', sert: 'Voir l’abonnement actif de la console.' },
    { cmd: 'az group create --name NOM --location RÉGION', sert: 'Créer un groupe de ressources.' },
    { cmd: 'az lock create --name NOM --lock-type CanNotDelete --resource-group GROUPE', sert: 'Empêcher la suppression d’un groupe.' },
    { cmd: 'az role assignment create --assignee COMPTE --role Contributor --scope /subscriptions/ID', sert: 'Donner le rôle Contributeur à un coéquipier.' },
    { cmd: 'az role assignment list --assignee COMPTE', sert: 'Lire les rôles d’un compte.' },
  ],
  pieges: [
    'Créer des ressources dans le mauvais abonnement : vérifie « az account show » avant d’agir.',
    'Oublier de supprimer le groupe de ressources d’un laboratoire : les ressources continuent d’être facturées.',
    'Donner le rôle Propriétaire à un coéquipier alors que Contributeur suffit.',
    'Croire que supprimer une machine supprime aussi ses disques, adresses IP et interfaces : ce sont des ressources à part.',
  ],
  questions: [
    { q: 'Quelle différence y a-t-il entre IaaS, PaaS et SaaS ?', r: 'En IaaS tu gères le système d’exploitation et tout ce qui est au-dessus ; en PaaS tu ne gères que l’application et les données ; en SaaS tu utilises l’application toute faite.' },
    { q: 'Quelle est la différence entre une zone de disponibilité et une paire régionale ?', r: 'La zone est un centre de données séparé à l’intérieur d’une région (protège d’une panne locale) ; la paire réunit deux régions éloignées d’au moins 500 km (protège d’un sinistre régional).' },
    { q: 'Qu’est-ce qui est hérité dans la hiérarchie des ressources ?', r: 'Les rôles, les verrous et les règles appliqués à un groupe d’administration, un abonnement ou un groupe de ressources descendent sur tout ce qu’ils contiennent.' },
    { q: 'Pourquoi regrouper un laboratoire dans un seul groupe de ressources ?', r: 'Pour pouvoir donner des droits, poser un verrou et surtout tout supprimer d’un coup à la fin, ce qui arrête la facturation.' },
  ],
};

// ---------------------------------------------------------------------------
// Cours 03 : réseau virtuel
// ---------------------------------------------------------------------------
export const RESUME_AZ_03 = {
  titre: 'Résumé du cours — Déployer et configurer un réseau virtuel',
  intro: 'À relire avant un examen : ce qu’est un réseau virtuel (VNet), comment le créer, le découper en sous-réseaux, planifier ses adresses et comprendre les adresses IP publiques et privées.',
  essentiel: [
    'Un réseau virtuel est ton réseau privé dans Azure : une isolation logique dédiée à ton abonnement, avec l’échelle, la disponibilité et l’isolation du cloud.',
    'À la création, on définit un espace d’adressage et au moins un sous-réseau ; on évite les espaces qui se chevauchent, car ils bloqueront l’appairage et les VPN.',
    'On choisit des plages privées RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) et on note les sous-réseaux en CIDR.',
    'Azure réserve 5 adresses par sous-réseau : le plus petit sous-réseau IPv4 est un /29, qui n’offre que 3 adresses utilisables.',
    'Par défaut, les ressources d’un VNet sortent librement vers Internet ; pour qu’Internet les joigne, il faut une IP publique ou un équilibreur de charge public.',
  ],
  sections: [
    {
      id: 'fonctions', titre: 'Ce que fait un réseau virtuel',
      points: [
        'Communication avec Internet, entre ressources Azure (VNet, points de service, appairage), avec le réseau local (VPN point à site, site à site, ExpressRoute).',
        'Filtrage du trafic par des groupes de sécurité réseau (NSG) et des appliances (pare-feu, passerelles, proxies, NAT).',
        'Routage : Azure route seul entre sous-réseaux, VNet connectés, réseau local et Internet ; on remplace ces routes avec des tables d’itinéraires (UDR) ou BGP.',
        'On crée un VNet par le portail, Azure CLI, Azure PowerShell, Bicep, ARM ou Terraform, à tout moment ou pendant la création d’une machine.',
      ],
    },
    {
      id: 'sous-reseaux', titre: 'Sous-réseaux et adressage', schemas: ['az-vnet-sous-reseaux'],
      points: [
        'Un sous-réseau sert à organiser et isoler les ressources, à gérer finement les adresses et à appliquer des règles de sécurité distinctes.',
        'Chaque sous-réseau a une plage unique en CIDR, qui ne chevauche aucun autre sous-réseau du VNet ; certains services exigent leur propre sous-réseau (passerelle).',
        'Exemples : sous-réseau d’application (serveurs web), sous-réseau de base de données (isolée), sous-réseau de passerelle (lien avec d’autres réseaux).',
        'Réservées : x.x.x.0 (réseau), .1 (passerelle par défaut), .2 et .3 (DNS Azure) et la dernière (diffusion). Plages interdites : 224.0.0.0/4, 255.255.255.255/32, 127.0.0.0/8, 169.254.0.0/16 et 168.63.129.16/32.',
      ],
    },
    {
      id: 'ip', titre: 'Adresses IP publiques et privées',
      points: [
        'Adresse privée : sert dans le VNet et vers le réseau local. Adresse publique : sert à joindre Internet et les services publics.',
        'Une IP publique peut être IPv4, IPv6 ou les deux, de référence Basic ou Standard, dynamique ou statique, et redondante entre zones (Standard).',
        'Elle s’associe à la carte réseau d’une machine, à un équilibreur de charge public, à une passerelle VPN ou à une passerelle applicative.',
        'Une adresse privée est dynamique par défaut (Azure donne la prochaine adresse libre) ou statique (tu la choisis dans la plage du sous-réseau).',
      ],
    },
  ],
  commandes: [
    { cmd: 'az network vnet create --name V --address-prefixes P --subnet-name S --subnet-prefixes P2', sert: 'Créer un VNet avec son premier sous-réseau.' },
    { cmd: 'az network vnet subnet create --vnet-name V --name S --address-prefixes P', sert: 'Ajouter un sous-réseau.' },
    { cmd: 'az network vnet list --output table', sert: 'Lister les VNet pour relire leurs plages.' },
    { cmd: 'az network public-ip create --sku Standard --allocation-method Static', sert: 'Créer une adresse IP publique statique.' },
    { cmd: 'az vm create --vnet-name V --subnet S', sert: 'Créer une machine dans un sous-réseau existant.' },
  ],
  pieges: [
    'Choisir deux plages qui se chevauchent pour deux VNet qu’on voudra relier.',
    'Oublier les 5 adresses réservées en dimensionnant un sous-réseau trop petit.',
    'Laisser des IP publiques détachées : elles restent facturées.',
    'Penser qu’une machine sans IP publique ne sort pas sur Internet : la sortie est permise par défaut.',
  ],
  questions: [
    { q: 'Combien d’adresses utilisables offre un sous-réseau /29 dans Azure ?', r: 'Trois : un /29 compte 8 adresses et Azure en réserve 5 (réseau, passerelle par défaut, deux pour le DNS, diffusion).' },
    { q: 'Pourquoi éviter les espaces d’adressage qui se chevauchent ?', r: 'Parce qu’on ne pourra pas appairer ces réseaux ni les relier par VPN : le routage ne saurait pas de quel côté se trouve une adresse.' },
    { q: 'Quelle est la différence entre une adresse privée dynamique et statique ?', r: 'La dynamique est donnée par Azure (prochaine adresse libre) et peut changer ; la statique est choisie par toi dans le sous-réseau et ne change pas.' },
    { q: 'Que faut-il pour qu’Internet joigne une machine d’un VNet ?', r: 'Une adresse IP publique sur sa carte réseau, ou un équilibreur de charge public devant elle, plus une règle de sécurité qui autorise le trafic.' },
  ],
};

// ---------------------------------------------------------------------------
// Cours 04 : résolution de noms
// ---------------------------------------------------------------------------
export const RESUME_AZ_04 = {
  titre: 'Résumé du cours — Configurer la résolution de noms dans Azure',
  intro: 'À relire avant un examen : ce que fait Azure DNS, la différence entre zone publique et zone privée, la délégation d’un domaine et les enregistrements courants.',
  essentiel: [
    'Azure DNS héberge un domaine sur des serveurs de noms répartis dans le monde et le gère avec tes identifiants Azure ; il n’achète pas de nom de domaine (il faut un bureau d’enregistrement).',
    'Une zone DNS contient les enregistrements d’un domaine ; les plus courants sont A et AAAA (nom vers adresse IPv4 ou IPv6) et CNAME (alias).',
    'Pour rendre une zone publique effective, on délègue le domaine : on inscrit chez le bureau d’enregistrement les serveurs de noms fournis par Azure.',
    'Une zone privée n’est visible que depuis les réseaux virtuels liés ; elle permet de trouver les machines par nom sans exposer ces noms à Internet.',
  ],
  sections: [
    {
      id: 'fonctions', titre: 'Fonctions d’Azure DNS',
      points: [
        'Gestion facile des enregistrements par le portail, la ligne de commande ou l’API REST ; résolution rapide et fiable grâce au réseau mondial de serveurs.',
        'Droits gérés par RBAC : seules les personnes autorisées modifient les zones ; DNSSEC est pris en charge pour vérifier l’authenticité des réponses.',
        'Intégration à d’autres services, comme Traffic Manager pour la répartition géographique.',
      ],
    },
    {
      id: 'publique', titre: 'Zone DNS publique', schemas: ['az-dns-public-prive'],
      points: [
        'On peut créer une zone sans posséder le domaine, mais il faut le posséder pour le configurer vraiment (le déléguer).',
        'Un jeu d’enregistrements regroupe les enregistrements de même nom et de même type (jusqu’à 20) ; il ne peut pas contenir deux enregistrements identiques.',
        'Pour une zone enfant, on inscrit ses serveurs de noms (enregistrements NS) dans le domaine parent.',
      ],
    },
    {
      id: 'privee', titre: 'Zone DNS privée',
      points: [
        'Elle n’est pas visible d’Internet et n’exige aucun bureau d’enregistrement ; tu choisis ton propre nom de domaine (contoso.lab, par exemple).',
        'Elle résout les noms entre les machines d’un VNet et entre VNet liés, avec l’inscription automatique des noms d’hôtes ; elle est disponible dans toutes les régions Azure.',
        'Les requêtes inverses sont limitées au même réseau virtuel.',
      ],
    },
  ],
  commandes: [
    { cmd: 'az network dns zone create --name DOMAINE --resource-group GROUPE', sert: 'Créer une zone publique.' },
    { cmd: 'az network dns record-set a add-record --record-set-name NOM --ipv4-address IP', sert: 'Ajouter un enregistrement A.' },
    { cmd: 'az network private-dns zone create --name DOMAINE --resource-group GROUPE', sert: 'Créer une zone privée.' },
    { cmd: 'az network private-dns link vnet create --registration-enabled true', sert: 'Lier une zone privée à un VNet avec l’inscription automatique.' },
    { cmd: 'nslookup NOM SERVEUR', sert: 'Interroger un serveur de noms précis, par exemple un serveur Azure DNS.' },
  ],
  pieges: [
    'Croire qu’Azure DNS vend des noms de domaine.',
    'Créer la zone publique et oublier de déléguer le domaine chez le bureau d’enregistrement.',
    'Créer une zone privée sans la lier au VNet : les machines ne la voient pas.',
    'Mettre un CNAME sur un nom qui porte déjà d’autres enregistrements.',
  ],
  questions: [
    { q: 'Que doit-on faire après avoir créé une zone DNS publique ?', r: 'Déléguer le domaine : inscrire chez le bureau d’enregistrement les serveurs de noms que donne Azure pour cette zone.' },
    { q: 'Qu’est-ce qu’un jeu d’enregistrements ?', r: 'L’ensemble des enregistrements de même nom et de même type dans une zone ; il peut en contenir jusqu’à 20, tous différents.' },
    { q: 'À quoi sert le lien entre une zone privée et un réseau virtuel ?', r: 'À rendre la zone visible depuis ce réseau ; avec l’inscription automatique, les noms des machines du réseau s’y ajoutent seuls.' },
    { q: 'Quelle est la différence entre un enregistrement A et un CNAME ?', r: 'A associe un nom à une adresse IPv4 ; CNAME fait de ce nom un alias d’un autre nom.' },
  ],
};

// ---------------------------------------------------------------------------
// Cours 05 : peering et routage
// ---------------------------------------------------------------------------
export const RESUME_AZ_05 = {
  titre: 'Résumé du cours — Peering et routage',
  intro: 'À relire avant un examen : relier deux réseaux virtuels par appairage, comprendre qu’il n’est pas transitif, puis lire les routes système et créer des routes personnalisées.',
  essentiel: [
    'L’appairage (peering) relie deux VNet, de la même région ou de régions différentes, pour que leurs ressources se joignent par leurs adresses privées, sans VPN ni passerelle Internet.',
    'Les deux VNet doivent avoir des espaces d’adressage qui ne se chevauchent pas ; au départ leurs machines ne se voient pas, et elles se voient une fois l’appairage établi.',
    'Le peering n’est PAS transitif : si A est appairé à B et B à C, A ne joint pas C ; chaque connexion se configure séparément.',
    'Azure crée seul une table de routes par sous-réseau ; on peut la remplacer en partie par des routes personnalisées (UDR) associées à des sous-réseaux.',
  ],
  sections: [
    {
      id: 'peering', titre: 'Appairage de réseaux virtuels', schemas: ['az-peering'],
      points: [
        'Deux types : régional (même région) et global (régions différentes).',
        'Un appairage est un objet par VNet : il faut le créer dans les deux sens ; avec un seul, l’état reste Initiated, avec les deux il passe à Connected.',
        'Le routage entre les VNet appairés est automatique ; le cours renvoie la suite de la transitivité à Infonuagique II.',
        'Avantages : faible latence, haut débit, architecture souple sans VPN.',
      ],
    },
    {
      id: 'routes', titre: 'Routes système', schemas: ['az-routes-systeme'],
      points: [
        'Chaque route a un préfixe d’adresse et un type de tronçon suivant ; Azure utilise la route dont le préfixe contient l’adresse de destination.',
        'Routes par défaut : la plage du VNet vers « Réseau virtuel », 0.0.0.0/0 vers « Internet », et 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 et 100.64.0.0/10 vers « Aucun » (le trafic est supprimé, sauf si ces plages sont utilisées dans le VNet).',
        'Les fonctions activées ajoutent leurs routes : peering (une route par plage du VNet distant), passerelle de réseau virtuel (routes BGP) et point de service (VirtualNetworkServiceEndpoint).',
        'On ne peut ni créer ni supprimer de route système, seulement en remplacer certaines.',
      ],
    },
    {
      id: 'udr', titre: 'Routes personnalisées (UDR)',
      points: [
        'On crée une table de routage, on y met des routes statiques et on l’associe à un ou plusieurs sous-réseaux ; un sous-réseau n’a qu’une seule table.',
        'Tronçons possibles : appliance virtuelle (adresse privée d’une machine ou d’un équilibreur interne), passerelle de réseau virtuel, aucun, réseau virtuel, Internet.',
        'Usages typiques : forcer le trafic entre deux sous-réseaux à passer par un pare-feu, ou empêcher un VNet d’atteindre Internet.',
        'En cas de conflit, la route personnalisée remplace la route système ; mieux vaut ajouter des routes que modifier les routes par défaut.',
      ],
    },
  ],
  commandes: [
    { cmd: 'az network vnet peering create --vnet-name V1 --remote-vnet V2 --allow-vnet-access', sert: 'Créer un sens de l’appairage ; à refaire dans l’autre sens.' },
    { cmd: 'az network vnet peering list --vnet-name V --output table', sert: 'Lire l’état des appairages d’un VNet.' },
    { cmd: 'az network nic show-effective-route-table --name NIC', sert: 'Lire les routes effectives d’une interface (machine allumée).' },
    { cmd: 'az network route-table route create --next-hop-type VirtualAppliance --next-hop-ip-address IP', sert: 'Ajouter une route vers une appliance.' },
    { cmd: 'az network vnet subnet update --route-table TABLE', sert: 'Associer une table de routage à un sous-réseau.' },
  ],
  pieges: [
    'Créer un seul sens de l’appairage et s’étonner de l’état Initiated.',
    'Compter sur le transit : A ne joint pas C par B.',
    'Associer une route vers une appliance qui ne transmet pas les paquets (transfert IP absent).',
    'Modifier les routes par défaut au lieu d’ajouter une route plus précise.',
  ],
  questions: [
    { q: 'Pourquoi A ne joint-il pas C si A↔B et B↔C sont appairés ?', r: 'Parce que le peering n’est pas transitif : le trafic ne traverse pas B ; il faut un appairage direct entre A et C.' },
    { q: 'Que signifie un appairage à l’état Initiated ?', r: 'Un seul sens a été créé ; il faut créer l’appairage dans l’autre VNet pour passer à Connected.' },
    { q: 'Que veut dire le tronçon « Aucun » pour 10.0.0.0/8 ?', r: 'Le trafic vers cette plage est supprimé, sauf si elle est utilisée dans le VNet (alors la route de la plage du VNet est plus précise).' },
    { q: 'Que se passe-t-il si une route personnalisée a le même préfixe qu’une route système ?', r: 'La route personnalisée remplace la route système.' },
  ],
};

// ---------------------------------------------------------------------------
// Cours 06 et 07 : accès privé et équilibrage de charge
// ---------------------------------------------------------------------------
export const RESUME_AZ_0607 = {
  titre: 'Résumé du cours — Accès privé aux services et équilibrage de charge',
  intro: 'À relire avant un examen : fermer l’accès public d’un service Azure (points de terminaison de service et privés, pare-feu du stockage), puis répartir le trafic avec les équilibreurs de charge, surtout Azure Load Balancer.',
  essentiel: [
    'Par défaut, les services Azure (stockage, SQL…) ont une adresse publique : quiconque peut tenter d’y accéder ; on les isole avec des points de terminaison.',
    'Un point de terminaison de service limite l’accès à des sous-réseaux et garde le trafic sur le réseau de Microsoft, mais le service garde son adresse publique.',
    'Un point de terminaison privé (Private Link) donne au service une adresse privée de ton VNet : le nom du service se résout vers cette adresse, et l’accès public peut être fermé.',
    'Un équilibreur de charge répartit le trafic entre plusieurs serveurs et redirige vers les serveurs sains dès qu’un nœud tombe en panne.',
    'Azure Load Balancer travaille au niveau 4 (TCP et UDP) avec quatre composants : IP frontale, règles, pool de serveurs et sondes d’intégrité.',
  ],
  sections: [
    {
      id: 'prive', titre: 'Points de terminaison de service et privés', schemas: ['az-service-prive'],
      points: [
        'Point de service : activé sur un sous-réseau (jusqu’à 15 minutes), il ajoute à sa table les routes vers le service et permet de n’autoriser que ce sous-réseau sur le compte.',
        'Point privé : une adresse privée du VNet est attribuée puis associée à un service précis (compte de stockage, base SQL) ; les requêtes DNS pointent alors vers cette adresse.',
        'Avantage en cas d’incident dans ton réseau : seule la ressource reliée est accessible ; le trafic reste dans le réseau privé.',
        'App Service : restriction d’adresses IP, intégration au réseau virtuel (l’application joint des ressources privées) et point de terminaison privé (plus d’accès par adresse publique).',
        'Stockage : pare-feu et réseaux virtuels (liste de réseaux et d’adresses autorisés) ou point de terminaison privé.',
      ],
    },
    {
      id: 'choix', titre: 'Choisir un équilibreur de charge', schemas: ['az-lb-choix'],
      points: [
        'Deux familles : global (redirige l’utilisateur vers le centre de données le plus proche) et régional (distribue au sein des réseaux virtuels d’une région).',
        'Load Balancer : couche 4, TCP et UDP, très faible latence. Application Gateway : couche 7, HTTP(S), routage par URL, pare-feu d’applications web.',
        'Traffic Manager : répartition par le DNS, entre régions. Front Door : couche 7 globale, accélération, déchargement SSL, routage par chemin, basculement rapide.',
      ],
    },
    {
      id: 'lb', titre: 'Azure Load Balancer', schemas: ['az-lb-composants'],
      points: [
        'IP frontale : l’adresse que les clients utilisent ; publique donne un équilibreur public, privée un équilibreur interne.',
        'Règle : relie une IP et un port frontaux à un ensemble d’adresses et de ports de serveurs. Pool : les machines (ou instances d’un groupe identique) qui répondent.',
        'Sonde : TCP (la connexion s’établit) ou HTTP/HTTPS (sondée toutes les 15 secondes par défaut ; sain si la réponse est un code 200 avant l’expiration du délai, 31 secondes par défaut).',
        'Un serveur dont la sonde échoue ne reçoit plus de nouvelles connexions jusqu’à ce qu’il redevienne sain ; ajouter des serveurs au pool reconfigure l’équilibreur seul.',
        'Usages : haute disponibilité d’applications web, trafic interne entre couches (web et base de données), mise à l’échelle.',
      ],
    },
  ],
  commandes: [
    { cmd: 'az network vnet subnet update --service-endpoints Microsoft.Storage', sert: 'Activer le point de service du stockage sur un sous-réseau.' },
    { cmd: 'az storage account network-rule add --vnet-name V --subnet S', sert: 'Autoriser un sous-réseau sur un compte de stockage.' },
    { cmd: 'az network private-endpoint create --group-id blob', sert: 'Créer un point de terminaison privé pour le stockage d’objets.' },
    { cmd: 'az network lb create --sku Standard --public-ip-address IP', sert: 'Créer un équilibreur de charge public.' },
    { cmd: 'az network lb probe create --protocol Tcp --port 80', sert: 'Créer une sonde d’intégrité TCP.' },
    { cmd: 'az network lb rule create --frontend-port 80 --backend-port 80', sert: 'Créer la règle de répartition.' },
  ],
  pieges: [
    'Confondre point de terminaison de service et point de terminaison privé : le premier garde l’adresse publique du service.',
    'Fermer l’accès public d’un compte sans avoir autorisé le sous-réseau ni sa propre adresse.',
    'Créer un point privé sans zone DNS privée liée au VNet : le nom se résout encore en adresse publique.',
    'Oublier la règle du groupe de sécurité réseau : un équilibreur Standard est fermé par défaut.',
  ],
  questions: [
    { q: 'Quelle différence y a-t-il entre un point de service et un point privé ?', r: 'Le point de service limite l’accès à un sous-réseau mais le service garde son adresse publique ; le point privé lui donne une adresse privée dans ton VNet, ce qui permet de fermer l’accès public.' },
    { q: 'Pourquoi une zone DNS privée accompagne-t-elle un point privé ?', r: 'Pour que le nom public du service se résolve en adresse privée du point de terminaison depuis le VNet.' },
    { q: 'Quels sont les quatre composants d’Azure Load Balancer ?', r: 'La configuration IP frontale, les règles d’équilibrage, le pool de serveurs et les sondes d’intégrité.' },
    { q: 'Que fait une sonde HTTP qui reçoit un code autre que 200 ?', r: 'Elle échoue : le serveur est retiré de la rotation et ne reçoit plus de nouvelles connexions jusqu’à ce qu’il redevienne sain.' },
    { q: 'Quel service choisir pour répartir des connexions TCP au sein d’une région ?', r: 'Azure Load Balancer (couche 4, TCP et UDP, régional) ; Application Gateway est réservé au HTTP(S).' },
  ],
};
