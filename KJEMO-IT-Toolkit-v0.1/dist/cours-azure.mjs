/**
 * cours-azure.mjs — KJEMO-AZURE-COURS-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Cours d'infonuagique (Azure), rangés dans « Mes cours » :
 *
 *   01-02  Infonuagique, Microsoft Azure, abonnement et collaboration
 *   03     Réseau virtuel (VNet), sous-réseaux, adressage et IP
 *   04     Résolution de noms : Azure DNS public et privé
 *   05     Peering et routage
 *   06-07  Accès privé aux services et équilibrage de charge
 *
 * Chaque cours est un PARCOURS qui renvoie vers des fiches : il ne contient
 * aucune commande. Les assistants et fiches déjà au catalogue (contexte,
 * abonnements, RBAC, réseaux, DNS, interfaces, stockage) sont cités, jamais
 * refaits. Les diapositives sont résumées dans nos mots ; elles ne sont pas
 * republiées.
 */
import { RESUME_AZ_01, RESUME_AZ_03, RESUME_AZ_04, RESUME_AZ_05, RESUME_AZ_0607 } from './cours-resume-azure.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const AVERTISSEMENT = 'Les fiches expliquent comment faire avec Azure CLI dans un abonnement de laboratoire ; elles ne remplacent pas ton énoncé et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Le Toolkit n’exécute rien, et les ressources créées sont facturées tant qu’elles existent : supprime le groupe de ressources du laboratoire à la fin.';
const SOURCE = 'Diapositives du cours d’infonuagique (enseignant : Hinault Romaric Donfack) fournies par l’étudiant, non republiées ici : les parcours, le résumé et les schémas sont écrits dans nos mots. En cas de doute, ton énoncé et ton enseignant font foi.';
const NON_COUVERT_THEORIE = 'Notion à comprendre, sans commande à lancer : le résumé pliable et les schémas la couvrent.';

export const COURS_AZURE_PARCOURS = [
  // ===========================================================================
  {
    id: 'azure-01-02-infonuagique-azure',
    plateformes: ['Azure'],
    titre: 'Infonuagique — Introduction, Microsoft Azure et abonnement',
    resume: 'Les notions du cloud (public, privé, hybride, IaaS, PaaS, SaaS), les composants d’Azure (régions, zones, groupes de ressources, abonnements) et la mise en route : activer son abonnement étudiant et partager l’accès avec l’équipe. Avec un résumé pliable et trois schémas.',
    source: SOURCE,
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_AZ_01,
    parcours: [
      {
        lettre: 'A',
        titre: 'Activer son abonnement et collaborer',
        resume: 'Activer le compte étudiant, vérifier dans quel abonnement tu travailles, puis donner à tes coéquipiers le rôle Contributeur sur ton abonnement (et recevoir le leur) pour les travaux pratiques en équipe.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Activer le compte du cégep, puis l’essai Azure for Students (numéro de téléphone, sans carte de crédit).', refs: [], couvert: false, note: 'Activation à faire toi-même sur les sites du cégep et de Microsoft, avec ton identité : le Toolkit ne peut ni ne doit la faire à ta place.' },
          { id: 'A2', texte: 'Vérifier le compte et l’abonnement actifs, et en changer si besoin.', refs: [f('azure-contexte-courant'), f('azure-changer-abonnement')], assistants: ['azure-contexte'] },
          { id: 'A3', texte: 'Donner à un coéquipier le rôle Contributeur sur ton abonnement (Contrôle d’accès IAM, Ajouter une attribution de rôle).', refs: [f('cours-az-role-coequipier', 2, { titre: 'Attribuer' })], assistants: ['azure-rbac'] },
          { id: 'A4', texte: 'Contrôler qui a quels rôles sur l’abonnement.', refs: [f('cours-az-role-coequipier', 3, { titre: 'Vérifier' })], assistants: ['azure-rbac'] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Notions d’infonuagique et d’Azure',
        resume: 'Les modèles de déploiement et de service, la géographie d’Azure et l’organisation des ressources. Surtout de la théorie : seuls le groupe de ressources et le verrou donnent lieu à des commandes.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Comparer cloud public, privé et hybride, puis IaaS, PaaS et SaaS.', refs: [], couvert: false, note: NON_COUVERT_THEORIE },
          { id: 'B2', texte: 'Expliquer régions, paires régionales et zones de disponibilité.', refs: [], couvert: false, note: NON_COUVERT_THEORIE },
          { id: 'B3', texte: 'Organiser les ressources : créer un groupe de ressources et lire les groupes existants.', refs: [f('cours-az-groupe-ressources', 2, { titre: 'Créer le groupe' }), f('azure-lister-groupes-ressources')], assistants: ['azure-abonnements-rg'] },
          { id: 'B4', texte: 'Protéger un groupe contre la suppression accidentelle (verrou).', refs: [f('cours-az-verrou-ressource', 2, { titre: 'Poser le verrou' })] },
          { id: 'B5', texte: 'Connaître les outils de gestion : portail, Azure CLI, PowerShell, Cloud Shell, modèles ARM et Bicep.', refs: [], couvert: false, note: 'Présentation d’outils : les fiches utilisent Azure CLI ; installe-la ou ouvre Cloud Shell dans le portail pour suivre les exemples.' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-groupe-ressources', pourquoi: 'un groupe de ressources par laboratoire : tout se supprime d’un coup à la fin.' },
    ],
    ambiguites: [],
  },
  // ===========================================================================
  {
    id: 'azure-03-reseau-virtuel',
    plateformes: ['Azure'],
    titre: 'Infonuagique — Déployer et configurer un réseau virtuel',
    resume: 'Créer un réseau virtuel et ses sous-réseaux, planifier l’adressage (RFC 1918, adresses réservées), comprendre les adresses IP publiques et privées, puis refaire la démonstration du cours : un VNet, deux machines et un ping entre elles.',
    source: SOURCE,
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_AZ_03,
    parcours: [
      {
        lettre: 'A',
        titre: 'Réseaux virtuels, sous-réseaux et adressage',
        resume: 'Les fonctions d’un réseau virtuel, la création du VNet et de ses sous-réseaux, le plan d’adressage et les adresses IP.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Expliquer les fonctions d’un VNet : Internet, ressources Azure, réseau local, filtrage et routage.', refs: [], couvert: false, note: NON_COUVERT_THEORIE },
          { id: 'A2', texte: 'Créer un réseau virtuel avec son espace d’adressage et un premier sous-réseau.', refs: [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet' })] },
          { id: 'A3', texte: 'Créer d’autres sous-réseaux (application, base de données, passerelle) sans chevauchement.', refs: [f('cours-az-sous-reseau-ajouter', 2, { titre: 'Créer le sous-réseau' })] },
          { id: 'A4', texte: 'Planifier l’adressage : plages RFC 1918, notation CIDR, 5 adresses réservées par sous-réseau.', refs: [f('cours-az-plan-adressage', 4, { titre: 'Lire les sous-réseaux' })], assistants: ['azure-reseau-vnets'] },
          { id: 'A5', texte: 'Créer une adresse IP publique statique et fixer une adresse privée.', refs: [f('cours-az-ip-publique-privee', 2, { titre: 'Créer une adresse IP publique' }), f('cours-az-ip-publique-privee', 4, { titre: 'Fixer l’adresse privée' })], assistants: ['azure-reseau-interfaces-ip'] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Démonstration du cours : vnet1, vm1 et vm2',
        resume: 'La démonstration : créer vnet1 (10.1.0.0/16) avec un sous-réseau default (10.1.0.0/24), y créer deux machines et vérifier que vm1 joint vm2.',
        prerequis: [f('cours-az-groupe-ressources', 2, { titre: 'Créer le groupe', pourquoi: 'un groupe de ressources pour ranger le laboratoire.' })],
        items: [
          { id: 'B1', texte: 'Créer vnet1 avec l’espace 10.1.0.0/16 et le sous-réseau default en 10.1.0.0/24.', refs: [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet' })] },
          { id: 'B2', texte: 'Créer les machines virtuelles vm1 et vm2 dans vnet1.', refs: [f('cours-az-vm-creer-vnet', 2, { titre: 'Créer la machine' })] },
          { id: 'B3', texte: 'Vérifier que vm1 peut envoyer un ping vers vm2.', refs: [f('cours-az-vm-creer-vnet', 4, { titre: 'Tester un ping' })] },
          { id: 'B4', texte: 'Relire les machines et leurs adresses pour confirmer qu’elles sont déployées et en marche.', refs: [f('azure-etat-machines-virtuelles'), f('cours-az-vm-creer-vnet', 3, { titre: 'Lire les adresses' })], assistants: ['azure-vm-inventaire'] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-plan-adressage', pourquoi: 'relire les plages avant d’ajouter un réseau ou de l’appairer.' },
    ],
    ambiguites: [
      { id: 'AZ03-1', sujet: 'Machines Windows ou Linux dans la démonstration', texte: 'La démonstration du cours utilise des machines Windows (accès RDP, pare-feu à désactiver, ping depuis PowerShell). Nos fiches créent des machines Linux sans mot de passe et lancent le ping par l’agent Azure : le résultat attendu est le même, la méthode diffère. Suis la consigne de ton enseignant pour le laboratoire.' },
    ],
  },
  // ===========================================================================
  {
    id: 'azure-04-resolution-noms',
    plateformes: ['Azure'],
    titre: 'Infonuagique — Configurer la résolution de noms dans Azure',
    resume: 'Azure DNS : créer une zone publique et ses enregistrements, comprendre la délégation, puis créer une zone privée liée à un VNet pour que les machines se trouvent par nom.',
    source: SOURCE,
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_AZ_04,
    parcours: [
      {
        lettre: 'A',
        titre: 'Zone DNS publique',
        resume: 'Créer une zone, lire ses serveurs de noms, ajouter des enregistrements A et CNAME, puis vérifier la résolution.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Expliquer ce qu’est Azure DNS, ses fonctions et ses limites (il n’achète pas de domaine).', refs: [], couvert: false, note: NON_COUVERT_THEORIE },
          { id: 'A2', texte: 'Créer une zone DNS publique et lire ses serveurs de noms.', refs: [f('cours-az-dns-zone-publique', 2, { titre: 'Créer la zone' }), f('cours-az-dns-zone-publique', 3, { titre: 'serveurs de noms' })] },
          { id: 'A3', texte: 'Ajouter un enregistrement A (et un CNAME) dans la zone.', refs: [f('cours-az-dns-enregistrement-a', 1, { titre: 'enregistrement A' }), f('cours-az-dns-enregistrement-a', 2, { titre: 'alias' })], assistants: ['azure-reseau-dns'] },
          { id: 'A4', texte: 'Vérifier la résolution en interrogeant un serveur de noms Azure.', refs: [f('cours-az-dns-enregistrement-a', 4, { titre: 'Interroger' })] },
          { id: 'A5', texte: 'Déléguer le domaine en inscrivant les serveurs de noms Azure chez le bureau d’enregistrement.', refs: [], couvert: false, note: 'Se fait sur le site du bureau d’enregistrement qui détient le domaine ; la fiche donne les quatre serveurs de noms à inscrire.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Zone DNS privée',
        resume: 'Créer une zone privée, la lier à un VNet avec l’inscription automatique, ajouter un enregistrement et vérifier.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Créer une zone DNS privée et la lier à un réseau virtuel.', refs: [f('cours-az-dns-zone-privee', 2, { titre: 'Créer la zone privée' }), f('cours-az-dns-zone-privee', 3, { titre: 'Lier la zone' })] },
          { id: 'B2', texte: 'Ajouter un enregistrement manuel et lire ceux que le lien inscrit automatiquement.', refs: [f('cours-az-dns-zone-privee', 4, { titre: 'enregistrement manuel' }), f('cours-az-dns-zone-privee', 5, { titre: 'Vérifier le lien' })] },
          { id: 'B3', texte: 'Retrouver les limites : zone invisible d’Internet, requêtes inverses limitées au même VNet.', refs: [], couvert: false, note: NON_COUVERT_THEORIE },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-dns-enregistrement-a', pourquoi: 'nslookup vers un serveur Azure : fonctionne même avant la délégation.' },
    ],
    ambiguites: [],
  },
  // ===========================================================================
  {
    id: 'azure-05-peering-routage',
    plateformes: ['Azure'],
    titre: 'Infonuagique — Peering et routage',
    resume: 'Relier deux réseaux virtuels par appairage (dans les deux sens), vérifier son état, comprendre l’absence de transit, puis lire les routes système et créer une route personnalisée vers une appliance.',
    source: SOURCE,
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_AZ_05,
    parcours: [
      {
        lettre: 'A',
        titre: 'Appairage de réseaux virtuels',
        resume: 'Contrôler que les plages ne se chevauchent pas, créer l’appairage dans les deux sens, vérifier qu’il est Connected et savoir pourquoi il n’est pas transitif.',
        prerequis: [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet', pourquoi: 'deux VNet sont nécessaires, avec des plages différentes.' })],
        items: [
          { id: 'A1', texte: 'Vérifier que les espaces d’adressage des deux VNet ne se chevauchent pas.', refs: [f('cours-az-peering-creer', 2, { titre: 'Contrôler les deux plages' })], assistants: ['azure-reseau-vnets'] },
          { id: 'A2', texte: 'Créer l’appairage dans les deux sens.', refs: [f('cours-az-peering-creer', 3, { titre: 'premier vers le second' }), f('cours-az-peering-creer', 4, { titre: 'sens inverse' })] },
          { id: 'A3', texte: 'Vérifier l’état de l’appairage (Initiated, Connected, Disconnected).', refs: [f('cours-az-peering-verifier', 2, { titre: 'Lire l’état' }), f('cours-az-peering-creer', 5, { titre: 'Vérifier' })] },
          { id: 'A4', texte: 'Expliquer pourquoi l’appairage n’est pas transitif (A↔B↔C : A ne joint pas C).', refs: [], couvert: false, note: 'Notion à comprendre ; le cours renvoie sa mise en œuvre au cours Infonuagique II. Le schéma du résumé l’illustre.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Routage du trafic',
        resume: 'Lire les routes système d’un sous-réseau, puis créer une table de routage avec une route personnalisée et l’associer à un sous-réseau.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Lire les routes effectives d’une interface : source, préfixe et tronçon suivant.', refs: [f('cours-az-routes-effectives', 2, { titre: 'Lire les routes effectives' })], assistants: ['azure-reseau-interfaces-ip'] },
          { id: 'B2', texte: 'Créer une table de routage et une route personnalisée vers une appliance virtuelle.', refs: [f('cours-az-route-personnalisee', 2, { titre: 'Créer la table' }), f('cours-az-route-personnalisee', 3, { titre: 'Ajouter la route' })] },
          { id: 'B3', texte: 'Associer la table de routage à un sous-réseau et vérifier.', refs: [f('cours-az-route-personnalisee', 5, { titre: 'Associer la table' }), f('cours-az-route-personnalisee', 6, { titre: 'Vérifier' })] },
          { id: 'B4', texte: 'Connaître les types de tronçon : appliance virtuelle, passerelle, aucun, réseau virtuel, Internet.', refs: [], couvert: false, note: NON_COUVERT_THEORIE },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-peering-verifier', pourquoi: 'comprendre un appairage qui reste « Initiated ».' },
    ],
    ambiguites: [],
  },
  // ===========================================================================
  {
    id: 'azure-06-07-acces-prive-equilibrage',
    plateformes: ['Azure'],
    titre: 'Infonuagique — Accès privé aux services et équilibrage de charge',
    resume: 'Isoler un compte de stockage (point de terminaison de service, point de terminaison privé), puis répartir le trafic : choisir un service d’équilibrage, créer un Azure Load Balancer avec sa sonde et sa règle, et lire sa santé.',
    source: SOURCE,
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_AZ_0607,
    parcours: [
      {
        lettre: 'A',
        titre: 'Accès privé aux services Azure',
        resume: 'Fermer l’accès public d’un compte de stockage : par un point de service limité à un sous-réseau, puis par un point privé avec sa zone DNS.',
        prerequis: [f('cours-az-vnet-creer', 3, { titre: 'Créer le VNet', pourquoi: 'un VNet et un sous-réseau sont nécessaires.' })],
        items: [
          { id: 'A1', texte: 'Distinguer un point de terminaison de service d’un point de terminaison privé.', refs: [], couvert: false, note: NON_COUVERT_THEORIE },
          { id: 'A2', texte: 'Activer un point de service pour le stockage et limiter le compte à un sous-réseau.', refs: [f('cours-az-point-service-stockage', 2, { titre: 'Activer le point de service' }), f('cours-az-point-service-stockage', 3, { titre: 'Autoriser le sous-réseau' })], assistants: ['azure-stockage-exposition'] },
          { id: 'A3', texte: 'Fermer l’accès public du compte en gardant l’accès du sous-réseau (pare-feu et réseaux virtuels).', refs: [f('cours-az-point-service-stockage', 5, { titre: 'Fermer l’accès public' })] },
          { id: 'A4', texte: 'Créer un point de terminaison privé pour un compte de stockage, avec sa zone DNS privée.', refs: [f('cours-az-point-prive-stockage', 2, { titre: 'Créer le point de terminaison privé' }), f('cours-az-point-prive-stockage', 3, { titre: 'zone DNS privée' }), f('cours-az-point-prive-stockage', 5, { titre: 'Inscrire le point' })] },
          { id: 'A5', texte: 'Vérifier depuis le VNet que le nom du compte se résout en adresse privée.', refs: [f('cours-az-point-prive-stockage', 7, { titre: 'Contrôler la résolution' })] },
          { id: 'A6', texte: 'App Service : restriction d’adresses IP, intégration au réseau virtuel et point de terminaison privé.', refs: [], couvert: false, note: 'Exercices du cours faits dans le portail Azure avec une application web ; le Toolkit n’a pas de fiche App Service pour l’instant.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Équilibrage de charge',
        resume: 'Choisir le bon service d’équilibrage, créer un Azure Load Balancer public (frontale, pool, sonde, règle), lire sa configuration et dépanner une sonde.',
        prerequis: [f('cours-az-vm-creer-vnet', 2, { titre: 'Créer la machine', pourquoi: 'il faut au moins deux machines à mettre dans le pool.' })],
        items: [
          { id: 'B1', texte: 'Choisir entre Load Balancer, Application Gateway, Traffic Manager et Front Door.', refs: [], couvert: false, note: 'Comparaison théorique : le tableau du résumé pliable donne la couche, la portée et le trafic de chacun ; seul Load Balancer a un exercice.' },
          { id: 'B2', texte: 'Créer un équilibreur de charge public avec son IP frontale et son pool.', refs: [f('cours-az-lb-creer', 2, { titre: 'adresse IP publique frontale' }), f('cours-az-lb-creer', 3, { titre: 'Créer l’équilibreur' })] },
          { id: 'B3', texte: 'Configurer la sonde d’intégrité et la règle de répartition.', refs: [f('cours-az-lb-creer', 4, { titre: 'sonde' }), f('cours-az-lb-creer', 5, { titre: 'règle' })] },
          { id: 'B4', texte: 'Ajouter des machines au pool et vérifier.', refs: [f('cours-az-lb-creer', 6, { titre: 'Ajouter un serveur' }), f('cours-az-lb-creer', 7, { titre: 'Vérifier' })] },
          { id: 'B5', texte: 'Lire la configuration et la santé d’un équilibreur existant.', refs: [f('cours-az-lb-etat', 1, { titre: 'Vue d’ensemble' }), f('cours-az-lb-etat', 5, { titre: 'sondes' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-az-lb-etat', pourquoi: 'dépanner une sonde qui retire tous les serveurs de la rotation.' },
    ],
    ambiguites: [
      { id: 'AZ06-1', sujet: 'Point de service ou point privé ?', texte: 'La diapositive « Qu’est-ce qu’un point de terminaison privé ? » parle de « point de terminaison de service de réseau virtuel (private endpoint) » : ce sont deux fonctions DIFFÉRENTES. Le point de service garde l’adresse publique du service ; le point privé lui donne une adresse privée. Nos fiches les séparent ; demande à ton enseignant lequel attend l’énoncé.' },
    ],
  },
];
