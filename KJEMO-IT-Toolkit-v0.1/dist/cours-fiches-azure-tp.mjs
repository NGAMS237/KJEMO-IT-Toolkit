/**
 * cours-fiches-azure-tp.mjs — AZURE-TP-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiches Azure CLI qui manquaient pour faire les travaux pratiques
 * d'Infonuagique I (TP1 ÉNERGIA, TP2 banque Tardi) : App Service (création,
 * restrictions d'accès, intégration au VNet, point de terminaison privé),
 * compte de stockage du TP, points privés par sous-ressource (blob, queue…),
 * gestion des tables de routage et routes par étiquette de service.
 *
 * Sources lues pour les écrire (liens donnés par l'enseignant) : gestion des
 * tables de routage, exercice App Service, restrictions d'accès App Service,
 * démarrages Private Link (App Service et stockage). Les commandes
 * « restrictions d'accès » et « table de routage » viennent des pages lues ;
 * les commandes `az webapp create`, `az appservice plan` et `az webapp
 * vnet-integration` viennent de nos connaissances de l'outil (pages de
 * référence NON lues : à vérifier avec `--help`). Rien n'est exécuté.
 */
import { V_COURS, lec, mod, des, itr, sh } from './cours-outils.mjs';

const DOC = (chemin) => `https://learn.microsoft.com/${chemin}`;
const CATEGORIE = 'Azure et Entra ID';
const V_AZ_TP = 'Commandes relues contre les pages Microsoft Learn données par l’enseignant quand elles les donnent (restrictions d’accès, tables de routage) et contre notre connaissance de l’outil sinon : vérifie avec « --help » si une option est refusée. NON exécutées dans un abonnement Azure par le Toolkit.';
const PRIV_GROUPE = 'Azure CLI connectée (`az login`, faite par toi) ; rôle Contributeur sur le groupe de ressources visé.';
const REGIONS = ['canadacentral', 'canadaeast', 'eastus', 'eastus2', 'centralus', 'westus2', 'northeurope', 'westeurope', 'francecentral', 'uksouth'];

const GROUPE = { id: 'groupe', label: 'groupe de ressources', type: 'nomAzure', exemple: 'rg-tardi', aide: 'Le nom du groupe de ressources (lettres, chiffres, tirets).' };
const REGION = { id: 'region', label: 'région Azure', type: 'choix', choix: REGIONS, exemple: 'canadacentral', aide: 'Le nom technique de la région (canadacentral = Canada Centre).' };
const VNET = { id: 'vnet', label: 'réseau virtuel (VNet)', type: 'nomAzure', exemple: 'VNET1', aide: 'Le nom du réseau virtuel.' };
const SOUS_RESEAU = { id: 'sousReseau', label: 'sous-réseau', type: 'nomAzure', exemple: 'AppServiceInboundSubnet', aide: 'Le nom du sous-réseau dans le VNet.' };
const COMPTE = { id: 'compte', label: 'compte de stockage', type: 'compteStockage', exemple: 'sttardi01', aide: 'Le nom du compte : 3 à 24 caractères, minuscules et chiffres seulement, unique dans tout Azure.' };
const WEBAPP = { id: 'webapp', label: 'application web (App Service)', type: 'nomAzure', exemple: 'webapp1-tardi', aide: 'Le nom de l’application. Il forme l’adresse <nom>.azurewebsites.net et doit être unique dans tout Azure.' };
const PLAN = { id: 'plan', label: 'plan App Service', type: 'nomAzure', exemple: 'asp-tardi', aide: 'Le plan (les machines) qui héberge l’application.' };

function ficheAz({ id, titre, resume, effet, intentions, motsCles, params = [], privileges = PRIV_GROUPE, prerequis = [], etapes, verification, retour = null, depannage = null, sources }) {
  return {
    id, titre, categorie: CATEGORIE, resume, effet, intentions, motsCles, params,
    ...(prerequis.length ? { prerequis } : {}),
    methodes: [{ id: 'azure', privileges, etapes, verification, retour, ...(depannage ? { depannage } : {}) }],
    assistant: null, sources, validation: V_AZ_TP, origine: 'cours',
  };
}

const CONTEXTE = lec('Vérifier l’abonnement actif', 'Avant de créer quoi que ce soit, confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
  [sh('az account show --output table')], 'Le nom et l’identifiant de l’abonnement, avec IsDefault à True.');

export const COURS_AZURE_TP = [
  // ===========================================================================
  // App Service
  // ===========================================================================
  ficheAz({
    id: 'cours-az-app-service-creer',
    titre: 'Créer une application App Service (conteneur Linux)',
    resume: 'Crée un plan App Service Linux et une application qui exécute une image de conteneur, règle son port, lui donne la chaîne de connexion d’un compte de stockage sans jamais l’écrire, puis rappelle comment revenir au plan gratuit pour limiter les coûts.',
    effet: 'modification',
    intentions: ['créer app service azure', 'az webapp create conteneur', 'az appservice plan create', 'application web azure conteneur linux', 'webapp azure plan b1', 'chaîne de connexion app service stockage'],
    motsCles: ['azure', 'app service', 'webapp', 'conteneur', 'plan b1', 'docker', 'websites_port', 'connection string', 'az webapp'],
    params: [
      GROUPE, REGION, PLAN, WEBAPP,
      { id: 'sku', label: 'niveau du plan', type: 'choix', choix: ['B1', 'S1', 'P1v3', 'F1'], exemple: 'B1', aide: 'B1 (De base) permet l’intégration au VNet et les points privés ; F1 est gratuit mais limité. Le TP demande B1.' },
      { id: 'image', label: 'image du conteneur (nom:étiquette)', type: 'texte', exemple: 'romaric/tpasr:latest', aide: 'Le nom de l’image dans le registre (Docker Hub par défaut), suivi de son étiquette.' },
      { id: 'port', label: 'port de l’application dans le conteneur', type: 'port', exemple: '8080', aide: 'Le port sur lequel l’application écoute dans le conteneur (8080 dans le TP2).' },
      COMPTE,
    ],
    prerequis: [{ texte: 'Le groupe de ressources et le compte de stockage doivent exister (pour la chaîne de connexion).', fiche: 'cours-az-groupe-ressources' }],
    etapes: [
      CONTEXTE,
      mod('Créer le plan App Service Linux', 'Le plan fixe le système (Linux) et le niveau tarifaire. Le niveau B1 est facturé tant que le plan existe.',
        [sh('az appservice plan create --resource-group {{groupe}} --name {{plan}} --location {{region}} --is-linux --sku {{sku}}')], 'Un bloc JSON où « provisioningState » vaut « Succeeded » et « sku.name » le niveau choisi.'),
      mod('Créer l’application à partir de l’image', 'Équivalent de l’onglet « Conteneur » du portail : source « Autres registres de conteneurs », image et étiquette.',
        [sh('az webapp create --resource-group {{groupe}} --plan {{plan}} --name {{webapp}} --deployment-container-image-name {{image}}')], 'Un bloc JSON avec « defaultHostName » (<nom>.azurewebsites.net) et « state » à « Running ».',
        { important: 'Si Azure CLI refuse « --deployment-container-image-name », lance « az webapp create --help » : les anciennes versions disent « --container-image-name ».' }),
      mod('Indiquer le port du conteneur', 'App Service ne devine pas le port : le réglage WEBSITES_PORT le lui donne. Sans lui, l’application peut démarrer mais rester inaccessible.',
        [sh('az webapp config appsettings set --resource-group {{groupe}} --name {{webapp}} --settings WEBSITES_PORT={{port}}')], 'La liste des réglages, avec WEBSITES_PORT à la valeur donnée.'),
      mod('Donner la chaîne de connexion du stockage', 'La chaîne est lue par Azure au moment de la commande et copiée dans l’application : elle n’apparaît ni à l’écran ni dans cette fiche. Le type « Custom » correspond à l’onglet « Chaînes de connexion » du portail.',
        [sh('az webapp config connection-string set --resource-group {{groupe}} --name {{webapp}} --connection-string-type Custom --settings StorageConnectionString="$(az storage account show-connection-string --resource-group {{groupe}} --name {{compte}} --query connectionString --output tsv)"')],
        'La liste des chaînes avec le nom StorageConnectionString (la valeur est masquée ou longue : ne la copie pas dans ton rapport).', { important: 'Ne colle jamais la chaîne de connexion dans un rapport ou une capture : elle donne accès au compte.' }),
      lec('Lire l’adresse et l’état', 'Ouvre ensuite l’adresse dans un navigateur : sur le TP2, les liens Messages et Lister Blobs doivent répondre.',
        [sh('az webapp show --resource-group {{groupe}} --name {{webapp}} --query "{adresse:defaultHostName, etat:state, plan:appServicePlanId}" --output json')], 'L’adresse <nom>.azurewebsites.net et l’état « Running ».', { verification: true }),
      mod('Revenir au plan gratuit entre deux séances', 'Un plan B1 est facturé même si l’application est arrêtée. Le niveau F1 ne l’est pas, mais il retire l’intégration au VNet et les points privés : ne le fais qu’à la fin du travail.',
        [sh('az appservice plan update --resource-group {{groupe}} --name {{plan}} --sku F1')], 'Un bloc JSON où « sku.name » vaut « F1 ».', { facultatif: true }),
      mod('Variante : application en code (exercice du module)', 'L’exercice du module Learn déploie du code .NET 8 sur Linux, plan F1, région USA Centre : crée le plan avec « --sku F1 », puis l’application avec une pile d’exécution au lieu d’une image.',
        [sh('az webapp create --resource-group {{groupe}} --plan {{plan}} --name {{webapp}} --runtime "DOTNETCORE:8.0"')], 'Une application « Running » dont la page d’accueil est la page d’espace réservé d’App Service.', { facultatif: true }),
    ],
    verification: ['L’application est « Running », son adresse répond, et les pages qui utilisent le stockage (Messages, Lister Blobs dans le TP2) affichent leur contenu.'],
    retour: 'Pour défaire : « az webapp delete » (resource-group et name), puis « az appservice plan delete » ; ou supprime tout le groupe de ressources du laboratoire.',
    depannage: [
      { symptome: 'L’adresse affiche une erreur 503 ou « Application Error »', cause: 'Le port du conteneur n’est pas celui que l’application écoute, ou l’image n’a pas pu être tirée.', action: 'Vérifie WEBSITES_PORT, puis le journal de démarrage : « az webapp log tail » avec resource-group et name.' },
      { symptome: 'Messages ou Lister Blobs échouent', cause: 'La chaîne de connexion est absente ou le compte de stockage refuse l’accès (accès public fermé sans point privé).', action: 'Relis le nom StorageConnectionString puis suis la fiche du point de terminaison privé et de l’intégration au VNet.' },
    ],
    sources: [{ label: 'Exercice : créer une application web dans le portail Azure', url: DOC('training/modules/host-a-web-app-with-azure-app-service/3-exercise-create-a-web-app-in-the-azure-portal') }, { label: 'az webapp create', url: DOC('cli/azure/webapp') }],
  }),
  ficheAz({
    id: 'cours-az-app-service-restriction-ip',
    titre: 'Restreindre l’accès à une application App Service (IP, sous-réseau)',
    resume: 'Ajoute, relit et retire des règles d’accès sur une application App Service : par adresse IP, par sous-réseau (point de service Microsoft.Web) ou par étiquette de service, pour le site principal ou le site de déploiement (SCM). Dès qu’une règle existe, tout le reste est refusé (HTTP 403).',
    effet: 'interruption',
    intentions: ['restriction accès app service', 'az webapp config access-restriction add', 'bloquer ip app service azure', 'autoriser seulement mon ip app service', 'access restriction webapp front door étiquette de service'],
    motsCles: ['azure', 'app service', 'restriction d’accès', 'access-restriction', 'ip', 'étiquette de service', 'scm', 'kudu', '403'],
    params: [
      GROUPE, WEBAPP,
      { id: 'regle', label: 'nom de la règle', type: 'nomAzure', exemple: 'developpeurs', aide: 'Un nom qui dit qui est autorisé.' },
      { id: 'priorite', label: 'priorité', type: 'entier', min: 1, max: 2147483646, exemple: '200', aide: 'Un entier : la règle au chiffre le plus bas est évaluée en premier.' },
      { id: 'ip', label: 'adresse ou réseau autorisé', type: 'texte', exemple: '130.220.0.0/27', aide: 'Une adresse avec son préfixe : 130.220.0.0/27, ou 1.2.3.4/32 pour une seule adresse. Jusqu’à 8, séparées par des virgules.' },
      VNET,
      { id: 'sousReseau', label: 'sous-réseau autorisé', type: 'nomAzure', exemple: 'app-gateway', aide: 'Le sous-réseau dont le trafic est accepté.' },
    ],
    prerequis: [{ texte: 'L’application doit exister.', fiche: 'cours-az-app-service-creer' }],
    etapes: [
      CONTEXTE,
      lec('Lire les règles actuelles', 'Sans règle et sans action par défaut « Deny », l’application est accessible de partout.',
        [sh('az webapp config access-restriction show --resource-group {{groupe}} --name {{webapp}}')], 'Un bloc JSON avec les règles du site principal et du site SCM.'),
      itr('Autoriser une adresse IP', 'Dès la première règle, un refus implicite « Tout refuser » s’applique à la fin : toute adresse non autorisée reçoit une erreur 403. Vérifie que ton adresse figure dans la règle avant de continuer.',
        [sh('az webapp config access-restriction add --resource-group {{groupe}} --name {{webapp}} --rule-name {{regle}} --action Allow --ip-address {{ip}} --priority {{priorite}}')], 'La liste des règles avec la nouvelle règle Allow et sa priorité.',
        { important: 'Ajoute d’abord TA propre adresse, sinon tu te coupes de l’application (et de son portail de gestion si le SCM suit les mêmes règles).' }),
      mod('Autoriser un sous-réseau', 'Le point de terminaison de service Microsoft.Web est activé automatiquement sur le sous-réseau. Il faut qu’il soit activé côté réseau ET côté service.',
        [sh('az webapp config access-restriction add --resource-group {{groupe}} --name {{webapp}} --rule-name {{regle}}-snet --action Allow --vnet-name {{vnet}} --subnet {{sousReseau}} --priority 300')], 'La liste des règles avec une règle de type sous-réseau.', { facultatif: true }),
      mod('Autoriser Azure Front Door (étiquette de service)', 'Une étiquette de service autorise toute une famille d’adresses Microsoft. Pour Front Door, ajoute aussi un filtre sur l’en-tête x-azure-fdid avec l’identifiant de TON profil, sinon tout client Front Door passe.',
        [sh('az webapp config access-restriction add --resource-group {{groupe}} --name {{webapp}} --rule-name frontdoor --priority 400 --service-tag AzureFrontDoor.Backend')], 'La liste des règles avec l’étiquette AzureFrontDoor.Backend.', { facultatif: true }),
      mod('Protéger aussi le site de déploiement (SCM)', 'Le site SCM (Kudu) a ses propres règles. Cette option lui applique celles du site principal.',
        [sh('az webapp config access-restriction set --resource-group {{groupe}} --name {{webapp}} --use-same-restrictions-for-scm-site true')], 'La configuration où le SCM utilise les règles du site principal.', { facultatif: true }),
      lec('Relire et tester', 'Depuis une adresse autorisée l’application répond ; depuis une adresse non autorisée, elle répond 403.',
        [sh('az webapp config access-restriction show --resource-group {{groupe}} --name {{webapp}}')], 'Les règles dans l’ordre des priorités. Un client refusé reçoit HTTP 403.', { verification: true }),
      des('Retirer une règle', 'Retire la règle par son nom. S’il ne reste aucune règle, l’application redevient accessible de partout.',
        [sh('az webapp config access-restriction remove --resource-group {{groupe}} --name {{webapp}} --rule-name {{regle}}')], 'La liste des règles sans celle retirée.', { facultatif: true }),
    ],
    verification: ['Une adresse autorisée obtient la page de l’application ; une adresse non autorisée obtient HTTP 403 ; la commande « show » liste les règles dans l’ordre de leur priorité.'],
    retour: 'Pour défaire : retire chaque règle avec « az webapp config access-restriction remove » et son nom ; sans règle, l’application est de nouveau ouverte à tous (sauf si l’action par défaut est « Deny »).',
    depannage: [
      { symptome: 'Tout le monde reçoit 403, moi compris', cause: 'La règle d’autorisation ne contient pas ton adresse publique, ou ton trafic sort par une autre adresse.', action: 'Ajoute ton adresse publique avec une priorité plus basse, ou retire la règle depuis le portail.' },
      { symptome: 'La règle de sous-réseau est refusée', cause: 'Le point de terminaison de service Microsoft.Web manque sur le sous-réseau, ou l’application est dans un environnement App Service dédié.', action: 'Active le point de terminaison sur le sous-réseau, ou utilise une règle par adresse IP.' },
    ],
    sources: [{ label: 'Restrictions d’accès App Service', url: DOC('azure/app-service/app-service-ip-restrictions') }, { label: 'az webapp config access-restriction', url: DOC('cli/azure/webapp/config/access-restriction') }],
  }),
  ficheAz({
    id: 'cours-az-app-service-integration-vnet',
    titre: 'Intégrer App Service à un réseau virtuel (trafic sortant)',
    resume: 'Fait sortir le trafic de l’application par un sous-réseau de ton VNet pour qu’elle joigne des ressources privées (stockage derrière un point privé, base de données). Le sous-réseau doit être délégué à Microsoft.Web/serverFarms ; le plan doit être au moins B1.',
    effet: 'modification',
    intentions: ['intégration vnet app service', 'az webapp vnet-integration add', 'sous-réseau délégué serverfarms', 'trafic sortant app service vnet', 'regional vnet integration'],
    motsCles: ['azure', 'app service', 'intégration vnet', 'vnet-integration', 'délégation', 'serverfarms', 'sortant', 'outbound'],
    params: [GROUPE, WEBAPP, VNET, { id: 'sousReseau', label: 'sous-réseau de sortie', type: 'nomAzure', exemple: 'AppServiceOutboundSubnet', aide: 'Un sous-réseau vide, d’au moins /28 (/26 conseillé), réservé à cette intégration.' }],
    prerequis: [{ texte: 'L’application (plan B1 ou plus) et le sous-réseau doivent exister.', fiche: 'cours-az-app-service-creer' }],
    etapes: [
      CONTEXTE,
      mod('Déléguer le sous-réseau à App Service', 'La délégation réserve le sous-réseau à App Service : on n’y met plus d’autre ressource, ni de point de terminaison privé.',
        [sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet}} --name {{sousReseau}} --delegations Microsoft.Web/serverFarms')], 'Un bloc JSON où « delegations » contient Microsoft.Web/serverFarms.'),
      mod('Intégrer l’application au sous-réseau', 'À partir de cette commande, le trafic sortant de l’application part de ce sous-réseau, avec ses routes et ses règles.',
        [sh('az webapp vnet-integration add --resource-group {{groupe}} --name {{webapp}} --vnet {{vnet}} --subnet {{sousReseau}}')], 'Un bloc JSON avec le sous-réseau intégré.'),
      lec('Lire l’intégration', 'Relis le sous-réseau branché à l’application.',
        [sh('az webapp vnet-integration list --resource-group {{groupe}} --name {{webapp}} --output table')], 'Une ligne avec le VNet et le sous-réseau.', { verification: true }),
      des('Retirer l’intégration', 'Retire le branchement ; l’application sort de nouveau par ses adresses publiques.',
        [sh('az webapp vnet-integration remove --resource-group {{groupe}} --name {{webapp}}')], 'La liste vide.', { facultatif: true }),
    ],
    verification: ['La liste d’intégration montre le VNet et le sous-réseau délégué, et l’application joint la ressource privée visée (Messages et Lister Blobs dans le TP2).'],
    retour: 'Pour défaire : « az webapp vnet-integration remove », puis retire la délégation du sous-réseau si tu veux le réutiliser.',
    depannage: [
      { symptome: 'L’intégration est refusée', cause: 'Le plan est gratuit, ou le sous-réseau est trop petit, déjà utilisé ou non délégué.', action: 'Passe au moins à B1, utilise un sous-réseau vide d’au moins /28 et délègue-le à Microsoft.Web/serverFarms.' },
    ],
    sources: [{ label: 'Intégration au réseau virtuel d’App Service', url: DOC('azure/app-service/overview-vnet-integration') }, { label: 'az webapp vnet-integration', url: DOC('cli/azure/webapp/vnet-integration') }],
  }),
  ficheAz({
    id: 'cours-az-app-service-point-prive',
    titre: 'Isoler App Service avec un point de terminaison privé (entrant)',
    resume: 'Donne à l’application une adresse privée dans ton VNet (point de terminaison privé, sous-ressource « sites »), crée la zone DNS privée privatelink.azurewebsites.net, puis ferme l’accès public. L’application n’est plus joignable que depuis le réseau.',
    effet: 'interruption',
    intentions: ['point de terminaison privé app service', 'private endpoint webapp azure', 'privatelink.azurewebsites.net', 'isoler app service réseau virtuel', 'application accessible seulement depuis le vnet'],
    motsCles: ['azure', 'app service', 'private endpoint', 'point de terminaison privé', 'sites', 'privatelink', 'entrant', 'inbound'],
    params: [
      GROUPE, WEBAPP, VNET, SOUS_RESEAU,
      { id: 'pointPrive', label: 'nom du point de terminaison privé', type: 'nomAzure', exemple: 'pe-webapp1', aide: 'Le nom du point de terminaison privé.' },
      { id: 'connexion', label: 'nom de la connexion privée', type: 'nomAzure', exemple: 'conn-webapp1', aide: 'Le nom de la connexion entre le point et l’application.' },
    ],
    prerequis: [{ texte: 'L’application (plan De base, Standard ou supérieur) et un sous-réseau NON délégué doivent exister. Un point privé ne va pas dans le sous-réseau d’intégration.', fiche: 'cours-az-app-service-creer' }],
    etapes: [
      CONTEXTE,
      mod('Autoriser les règles réseau sur le sous-réseau', 'Pour que les groupes de sécurité réseau et les tables de routage s’appliquent aux points privés du sous-réseau (case « Groupes de sécurité réseau » et « Tables de routage » du portail).',
        [sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet}} --name {{sousReseau}} --private-endpoint-network-policies Enabled')], 'Un bloc JSON où « privateEndpointNetworkPolicies » vaut « Enabled ».', { facultatif: true }),
      mod('Créer le point de terminaison privé', 'Le groupe « sites » désigne l’application web elle-même. L’identifiant de l’application est lu au moment de la commande.',
        [sh('az network private-endpoint create --resource-group {{groupe}} --name {{pointPrive}} --vnet-name {{vnet}} --subnet {{sousReseau}} --private-connection-resource-id $(az webapp show --resource-group {{groupe}} --name {{webapp}} --query id --output tsv) --group-id sites --connection-name {{connexion}}')],
        'Un bloc JSON où « provisioningState » vaut « Succeeded ».'),
      mod('Créer la zone DNS privée et la lier au VNet', 'Le nom <app>.azurewebsites.net doit se résoudre en adresse privée depuis le VNet : c’est le rôle de la zone privatelink.azurewebsites.net.',
        [sh('az network private-dns zone create --resource-group {{groupe}} --name privatelink.azurewebsites.net'), sh('az network private-dns link vnet create --resource-group {{groupe}} --zone-name privatelink.azurewebsites.net --name lien-{{vnet}} --virtual-network {{vnet}} --registration-enabled false')],
        'Deux blocs JSON : la zone, puis le lien avec « virtualNetworkLinkState » à « Completed ».'),
      mod('Inscrire le point dans la zone', 'Le groupe de zones DNS crée et tient à jour l’enregistrement de l’application dans la zone privée.',
        [sh('az network private-endpoint dns-zone-group create --resource-group {{groupe}} --endpoint-name {{pointPrive}} --name groupe-dns --private-dns-zone privatelink.azurewebsites.net --zone-name sites')], 'Un bloc JSON avec la zone configurée.'),
      itr('Fermer l’accès public', 'Après cette commande, l’application ne répond plus depuis Internet : seul le VNet (et les réseaux qui y sont reliés) la joint. Fais-la en dernier.',
        [sh('az webapp update --resource-group {{groupe}} --name {{webapp}} --set publicNetworkAccess=Disabled')], 'Un bloc JSON où « publicNetworkAccess » vaut « Disabled ».', { important: 'Pour tester, il faut une machine DANS le VNet (ou reliée à lui) : depuis ton poste, l’application répond 403.' }),
      lec('Contrôler la résolution depuis le VNet', 'À lancer DANS une machine du VNet : le nom de l’application doit se résoudre en adresse privée.',
        [sh('nslookup {{webapp}}.azurewebsites.net')], 'Un alias vers <app>.privatelink.azurewebsites.net et une adresse privée du sous-réseau.', { verification: true }),
    ],
    verification: ['Depuis le VNet, le nom de l’application se résout en adresse privée et la page s’affiche ; depuis Internet, l’accès est refusé.'],
    retour: 'Pour défaire : rouvre l’accès (« --set publicNetworkAccess=Enabled »), puis supprime le point avec « az network private-endpoint delete », le lien et la zone DNS privée.',
    depannage: [
      { symptome: 'Le nom se résout encore en adresse publique', cause: 'La zone privée n’est pas liée au VNet de la machine, ou le groupe de zones DNS manque.', action: 'Relis le lien (« az network private-dns link vnet list ») et le groupe de zones du point.' },
      { symptome: 'Le point privé ne peut pas être créé dans ce sous-réseau', cause: 'Le sous-réseau est délégué (intégration VNet).', action: 'Utilise un autre sous-réseau, sans délégation.' },
    ],
    sources: [{ label: 'Démarrage rapide : créer un point de terminaison privé dans le portail', url: DOC('azure/private-link/create-private-endpoint-portal') }, { label: 'Utiliser des points de terminaison privés pour App Service', url: DOC('azure/app-service/networking/private-endpoint') }],
  }),
  // ===========================================================================
  // Stockage du TP
  // ===========================================================================
  ficheAz({
    id: 'cours-az-stockage-file-conteneur',
    titre: 'Compte de stockage avec file et conteneur, puis accès public fermé',
    resume: 'Crée un compte de stockage, une file d’attente (queue1) et un conteneur de blobs privé (blob1), y dépose un fichier, puis ferme l’accès public. L’ordre compte : le contenu se crée AVANT de fermer l’accès, sinon tu n’y as plus accès depuis ton poste.',
    effet: 'modification',
    intentions: ['créer compte de stockage file conteneur', 'az storage account create queue blob', 'queue1 blob1 azure', 'az storage queue-rm create', 'fermer accès public compte de stockage'],
    motsCles: ['azure', 'stockage', 'storage account', 'queue', 'file d’attente', 'blob', 'conteneur', 'accès public'],
    params: [
      GROUPE, REGION, COMPTE,
      { id: 'file', label: 'nom de la file d’attente', type: 'nomAzure', exemple: 'queue1', aide: 'Le nom de la file (minuscules, chiffres et tirets conseillés).' },
      { id: 'conteneur', label: 'nom du conteneur de blobs', type: 'nomAzure', exemple: 'blob1', aide: 'Le nom du conteneur.' },
      { id: 'fichier', label: 'fichier à déposer (chemin sur ton poste)', type: 'chemin', exemple: '/tmp/exemple.txt', aide: 'Un petit fichier de ton choix, déposé dans le conteneur.' },
    ],
    etapes: [
      CONTEXTE,
      mod('Créer le compte de stockage', 'Redondance locale (LRS) et accès anonyme aux blobs interdit. Le nom doit être unique dans tout Azure.',
        [sh('az storage account create --resource-group {{groupe}} --name {{compte}} --location {{region}} --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false')], 'Un bloc JSON où « provisioningState » vaut « Succeeded ».'),
      mod('Créer la file d’attente', 'Création par le plan de gestion d’Azure : elle ne demande pas de rôle de données sur la file.',
        [sh('az storage queue-rm create --resource-group {{groupe}} --storage-account {{compte}} --name {{file}}')], 'Un bloc JSON avec le nom de la file.'),
      mod('Créer le conteneur de blobs', 'Même principe : création par le plan de gestion, accès privé.',
        [sh('az storage container-rm create --resource-group {{groupe}} --storage-account {{compte}} --name {{conteneur}}')], 'Un bloc JSON avec le nom du conteneur.'),
      mod('Déposer un fichier dans le conteneur', 'Cette commande utilise ton compte Azure (rôle « Contributeur des données Blob du stockage » sur le compte) et doit passer AVANT la fermeture de l’accès public.',
        [sh('az storage blob upload --account-name {{compte}} --container-name {{conteneur}} --file {{fichier}} --auth-mode login')], 'Un bloc JSON avec « etag » : le fichier est déposé.'),
      itr('Fermer l’accès public', 'À faire en dernier : ensuite le contenu n’est joignable que par un point de terminaison privé (voir la fiche des points privés par sous-ressource).',
        [sh('az storage account update --resource-group {{groupe}} --name {{compte}} --public-network-access Disabled')], 'Un bloc JSON où « publicNetworkAccess » vaut « Disabled ».', { important: 'Après cette commande, ton poste n’atteint plus le compte : teste depuis une machine du VNet.' }),
      lec('Relire le compte', 'Contrôle l’état d’accès et le nom des services.',
        [sh('az storage account show --resource-group {{groupe}} --name {{compte}} --query "{acces:publicNetworkAccess, anonyme:allowBlobPublicAccess, sku:sku.name}" --output json')], 'L’accès public « Disabled » et l’accès anonyme « false ».', { verification: true }),
    ],
    verification: ['Le compte existe, la file et le conteneur sont créés, un fichier est déposé, et l’accès public est désactivé.'],
    retour: 'Pour défaire : « az storage account delete » avec resource-group et name supprime le compte et tout son contenu ; vérifie d’abord que rien d’utile n’y reste.',
    depannage: [
      { symptome: 'Le dépôt du fichier est refusé (AuthorizationPermissionMismatch)', cause: 'Ton compte n’a pas de rôle de données sur le compte de stockage (Contributeur ne suffit pas).', action: 'Demande le rôle « Contributeur des données Blob du stockage » sur le compte, ou dépose le fichier depuis le portail.' },
    ],
    sources: [{ label: 'az storage account', url: DOC('cli/azure/storage/account') }, { label: 'Tutoriel : se connecter à un compte de stockage avec un point de terminaison privé', url: DOC('azure/private-link/tutorial-private-endpoint-storage-portal') }],
  }),
  ficheAz({
    id: 'cours-az-point-prive-stockage-sous-ressource',
    titre: 'Point privé par sous-ressource du stockage (blob, queue…)',
    resume: 'Un point de terminaison privé ne couvre qu’UNE sous-ressource du compte. Cette fiche en crée un pour la sous-ressource choisie (blob, queue, file ou table) avec sa zone DNS privée privatelink.<sous-ressource>.core.windows.net ; refais-la pour chaque service utilisé par l’application.',
    effet: 'modification',
    intentions: ['point privé queue stockage', 'private endpoint queue azure', 'privatelink.queue.core.windows.net', 'un point de terminaison privé par sous-ressource', 'group-id queue blob table file'],
    motsCles: ['azure', 'private endpoint', 'point de terminaison privé', 'stockage', 'queue', 'blob', 'file', 'table', 'sous-ressource', 'group-id'],
    params: [
      GROUPE, VNET, SOUS_RESEAU, COMPTE,
      { id: 'sousRessource', label: 'sous-ressource du stockage', type: 'choix', choix: ['blob', 'queue', 'file', 'table'], exemple: 'queue', aide: 'blob = conteneurs, queue = files d’attente, file = partages Azure Files, table = tables.' },
      { id: 'pointPrive', label: 'nom du point de terminaison privé', type: 'nomAzure', exemple: 'pe-sttardi-queue', aide: 'Un nom qui dit le compte et la sous-ressource.' },
      { id: 'connexion', label: 'nom de la connexion privée', type: 'nomAzure', exemple: 'conn-sttardi-queue', aide: 'Le nom de la connexion entre le point et le compte.' },
    ],
    prerequis: [{ texte: 'Le compte de stockage, le VNet et un sous-réseau (non délégué) doivent exister.', fiche: 'cours-az-stockage-file-conteneur' }],
    etapes: [
      CONTEXTE,
      mod('Créer le point de terminaison privé', 'Le groupe (« group-id ») est la sous-ressource visée. L’identifiant du compte est lu au moment de la commande.',
        [sh('az network private-endpoint create --resource-group {{groupe}} --name {{pointPrive}} --vnet-name {{vnet}} --subnet {{sousReseau}} --private-connection-resource-id $(az storage account show --resource-group {{groupe}} --name {{compte}} --query id --output tsv) --group-id {{sousRessource}} --connection-name {{connexion}}')],
        'Un bloc JSON où « provisioningState » vaut « Succeeded ».'),
      mod('Créer la zone DNS privée de la sous-ressource', 'Une zone par sous-ressource : privatelink.blob…, privatelink.queue…. Si elle existe déjà, la commande la laisse telle quelle.',
        [sh('az network private-dns zone create --resource-group {{groupe}} --name privatelink.{{sousRessource}}.core.windows.net')], 'Un bloc JSON avec le nom de la zone.'),
      mod('Lier la zone au VNet', 'Sans lien, les machines du VNet résolvent l’adresse publique.',
        [sh('az network private-dns link vnet create --resource-group {{groupe}} --zone-name privatelink.{{sousRessource}}.core.windows.net --name lien-{{sousRessource}}-{{vnet}} --virtual-network {{vnet}} --registration-enabled false')], 'Un bloc JSON où « virtualNetworkLinkState » vaut « Completed ».'),
      mod('Inscrire le point dans la zone', 'Le groupe de zones DNS crée l’enregistrement du compte dans la zone.',
        [sh('az network private-endpoint dns-zone-group create --resource-group {{groupe}} --endpoint-name {{pointPrive}} --name groupe-dns --private-dns-zone privatelink.{{sousRessource}}.core.windows.net --zone-name {{sousRessource}}')], 'Un bloc JSON avec la zone configurée.'),
      lec('Contrôler la résolution depuis le VNet', 'À lancer DANS une machine du VNet : le nom du service doit donner une adresse privée.',
        [sh('nslookup {{compte}}.{{sousRessource}}.core.windows.net')], 'Un alias vers privatelink.<sous-ressource>.core.windows.net et une adresse privée du sous-réseau (10.x.x.x).', { verification: true }),
    ],
    verification: ['Pour chaque sous-ressource utilisée (blob et queue dans le TP2), le nom du service se résout en adresse privée depuis le VNet.'],
    retour: 'Pour défaire : « az network private-endpoint delete » (resource-group et name) puis, s’il n’est plus utilisé, le lien et la zone DNS privée.',
    depannage: [
      { symptome: 'La file répond mais le conteneur non (ou l’inverse)', cause: 'Il manque le point de terminaison privé d’une des deux sous-ressources.', action: 'Refais la fiche avec l’autre sous-ressource : il faut un point par service utilisé.' },
    ],
    sources: [{ label: 'Tutoriel : point de terminaison privé et compte de stockage', url: DOC('azure/private-link/tutorial-private-endpoint-storage-portal') }, { label: 'Zones DNS privées recommandées pour Private Link', url: DOC('azure/private-link/private-endpoint-dns') }],
  }),
  // ===========================================================================
  // Tables de routage
  // ===========================================================================
  ficheAz({
    id: 'cours-az-table-routage-gerer',
    titre: 'Gérer une table de routage : lire, modifier, dissocier, supprimer',
    resume: 'Tout ce qui suit la création : lister les tables et les routes, couper la propagation des routes de la passerelle, modifier ou retirer une route, dissocier la table d’un sous-réseau, la supprimer, puis demander à Azure quel est le prochain saut réel entre deux adresses.',
    effet: 'interruption',
    intentions: ['gérer table de routage azure', 'az network route-table list', 'modifier route udr azure', 'dissocier table de routage sous-réseau', 'supprimer table de routage azure', 'propagation des routes de passerelle désactiver', 'prochain saut azure network watcher'],
    motsCles: ['azure', 'table de routage', 'route table', 'udr', 'bgp', 'next hop', 'tronçon suivant', 'dissocier', 'show-next-hop'],
    params: [
      GROUPE, VNET, { id: 'sousReseau', label: 'sous-réseau associé', type: 'nomAzure', exemple: 'VMSubnet', aide: 'Le sous-réseau qui porte la table.' },
      { id: 'tableRoutage', label: 'table de routage', type: 'nomAzure', exemple: 'rt-vmsubnet', aide: 'Le nom de la table.' },
      { id: 'route', label: 'route', type: 'nomAzure', exemple: 'vers-passerelle', aide: 'Le nom de la route à lire, modifier ou retirer.' },
      { id: 'nic', label: 'interface réseau d’une machine du sous-réseau', type: 'nomAzure', exemple: 'vm1VMNic', aide: 'Elle sert à lire les routes effectives.' },
      { id: 'vm', label: 'machine virtuelle', type: 'nomAzure', exemple: 'vm1', aide: 'La machine d’où partirait le paquet.' },
      { id: 'ipSource', label: 'adresse source', type: 'ipv4', exemple: '10.2.3.4', aide: 'L’adresse privée de la machine.' },
      { id: 'ipDest', label: 'adresse de destination', type: 'ipv4', exemple: '12.12.12.1', aide: 'L’adresse à atteindre.' },
    ],
    prerequis: [{ texte: 'La table de routage et, pour les routes effectives, une machine en marche dans le sous-réseau.', fiche: 'cours-az-route-personnalisee' }],
    etapes: [
      CONTEXTE,
      lec('Lister les tables et les routes', 'Une table peut être associée à plusieurs sous-réseaux, un sous-réseau n’a qu’une table.',
        [sh('az network route-table list --resource-group {{groupe}} --output table'), sh('az network route-table route list --resource-group {{groupe}} --route-table-name {{tableRoutage}} --output table')], 'Les tables du groupe, puis les routes de la table avec préfixe et tronçon suivant.'),
      mod('Couper la propagation des routes de la passerelle', 'Empêche les routes apprises par BGP (réseau local) d’entrer dans la table. Si le sous-réseau doit garder le VPN, ajoute alors une route personnalisée de type VirtualNetworkGateway.',
        [sh('az network route-table update --resource-group {{groupe}} --name {{tableRoutage}} --disable-bgp-route-propagation true')], 'Un bloc JSON où « disableBgpRoutePropagation » vaut « true ».', { facultatif: true }),
      mod('Modifier une route', 'Change par exemple l’adresse de l’appliance. Un préfixe ne peut pas être doublé dans la même table.',
        [sh('az network route-table route update --resource-group {{groupe}} --route-table-name {{tableRoutage}} --name {{route}} --next-hop-type VirtualNetworkGateway')], 'Un bloc JSON avec le nouveau tronçon suivant.', { facultatif: true }),
      des('Retirer une route', 'Le préfixe retombe sur la route système correspondante.',
        [sh('az network route-table route delete --resource-group {{groupe}} --route-table-name {{tableRoutage}} --name {{route}}')], 'Aucune sortie en cas de succès ; la route n’est plus dans la liste.', { facultatif: true }),
      lec('Lire les routes effectives d’une machine', 'Le résultat mêle routes système, routes de ta table (source User) et routes de la passerelle. La machine doit être allumée.',
        [sh('az network nic show-effective-route-table --resource-group {{groupe}} --name {{nic}} --output table')], 'Des lignes avec source, état Active, préfixe et tronçon suivant.', { verification: true }),
      lec('Demander le prochain saut à Network Watcher', 'Répond à « où irait un paquet de cette machine vers cette destination ? ». Network Watcher doit être activé dans la région.',
        [sh('az network watcher show-next-hop --resource-group {{groupe}} --vm {{vm}} --source-ip {{ipSource}} --dest-ip {{ipDest}}')], 'Un bloc JSON avec « nextHopType » et, si besoin, l’adresse du saut.', { facultatif: true }),
      itr('Dissocier la table du sous-réseau', 'Le trafic du sous-réseau reprend les routes système. La valeur « null » détache la table.',
        [sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet}} --name {{sousReseau}} --route-table null')], 'Un bloc JSON où « routeTable » est absent ou nul.', { facultatif: true }),
      des('Supprimer la table', 'Impossible tant qu’elle reste associée à un sous-réseau : dissocie-la d’abord, de TOUS les sous-réseaux.',
        [sh('az network route-table delete --resource-group {{groupe}} --name {{tableRoutage}}')], 'Aucune sortie en cas de succès.', { facultatif: true }),
    ],
    verification: ['Les routes effectives de la machine montrent les routes attendues (source User, état Active), et le prochain saut correspond à la route voulue.'],
    retour: 'Pour défaire une modification de route : remets l’ancien tronçon avec « az network route-table route update ». Une table ou une route supprimée se recrée avec la fiche de création.',
    depannage: [
      { symptome: 'La suppression de la table est refusée', cause: 'La table est encore associée à au moins un sous-réseau.', action: 'Dissocie-la de chaque sous-réseau (étape de dissociation), puis supprime-la.' },
      { symptome: 'La commande de dissociation refuse « null »', cause: 'Version d’Azure CLI ou forme attendue différente.', action: 'Dissocie la table dans le portail (Sous-réseaux, Table de routage, Aucune), ou lance « az network vnet subnet update --help ».' },
    ],
    sources: [{ label: 'Créer, modifier ou supprimer une table de routage', url: DOC('azure/virtual-network/manage-route-table') }, { label: 'Routage du trafic du réseau virtuel', url: DOC('azure/virtual-network/virtual-networks-udr-overview') }],
  }),
  ficheAz({
    id: 'cours-az-routes-etiquettes-service',
    titre: 'Routes du TP2 : passerelle, plage supprimée, appliance, étiquettes',
    resume: 'Met en place les quatre cas du TP2 : tout le trafic sortant du sous-réseau VMSubnet vers la passerelle, une plage supprimée (None), et pour DataSubnet tout Internet plus les services App Service et Event Hubs de deux régions vers une appliance virtuelle fictive. Deux tables, car un préfixe ne peut pas être doublé dans une table.',
    effet: 'interruption',
    intentions: ['route étiquette de service azure', 'udr appservice eventhub canadacentral', 'router vers appliance virtuelle fictive', 'supprimer trafic vers une plage azure route none', 'tp2 routage datasubnet vmsubnet', 'route 0.0.0.0/0 virtualnetworkgateway'],
    motsCles: ['azure', 'udr', 'étiquette de service', 'service tag', 'appliance virtuelle', 'virtualnetworkgateway', 'none', 'datasubnet', 'vmsubnet', 'eventhub', 'appservice'],
    params: [
      GROUPE, REGION,
      { id: 'tableVm', label: 'table de VMSubnet', type: 'nomAzure', exemple: 'rt-vmsubnet', aide: 'Le nom de la table associée aux sous-réseaux VMSubnet.' },
      { id: 'tableData', label: 'table de DataSubnet', type: 'nomAzure', exemple: 'rt-datasubnet', aide: 'Le nom de la table associée à DataSubnet.' },
      { id: 'plage', label: 'plage dont le trafic est supprimé', type: 'cidr', exemple: '12.12.12.0/30', aide: 'La plage de l’énoncé (12.12.12.0/30).' },
      { id: 'saut', label: 'adresse de l’appliance fictive', type: 'ipv4', exemple: '10.3.2.100', aide: 'L’adresse privée de l’appliance (elle n’existe pas dans le TP2).' },
      { id: 'vnet1', label: 'premier VNet (avec VMSubnet)', type: 'nomAzure', exemple: 'VNET1', aide: 'Le VNet qui porte un VMSubnet.' },
      { id: 'vnet2', label: 'second VNet (avec VMSubnet et DataSubnet)', type: 'nomAzure', exemple: 'VNET2', aide: 'Le VNet qui porte l’autre VMSubnet et DataSubnet.' },
    ],
    prerequis: [{ texte: 'Les deux VNet et leurs sous-réseaux VMSubnet et DataSubnet doivent exister.', fiche: 'cours-az-vnet-creer' }],
    etapes: [
      CONTEXTE,
      mod('Créer la table des sous-réseaux VMSubnet', 'Une table et ses routes appartiennent au même abonnement et à la même région que les sous-réseaux qui l’utilisent.',
        [sh('az network route-table create --resource-group {{groupe}} --name {{tableVm}} --location {{region}}')], 'Un bloc JSON où « provisioningState » vaut « Succeeded ».'),
      mod('Envoyer tout le trafic sortant vers la passerelle', '« En dehors du réseau » se traduit par 0.0.0.0/0 avec le tronçon VirtualNetworkGateway.',
        [sh('az network route-table route create --resource-group {{groupe}} --route-table-name {{tableVm}} --name vers-passerelle --address-prefix 0.0.0.0/0 --next-hop-type VirtualNetworkGateway')], 'Un bloc JSON avec le préfixe 0.0.0.0/0 et le tronçon VirtualNetworkGateway.'),
      mod('Supprimer le trafic vers la plage interdite', 'Le tronçon None abandonne les paquets vers le préfixe, sans message.',
        [sh('az network route-table route create --resource-group {{groupe}} --route-table-name {{tableVm}} --name plage-supprimee --address-prefix {{plage}} --next-hop-type None')], 'Un bloc JSON avec le tronçon None.'),
      itr('Associer la table aux deux VMSubnet', 'Le TP parle « des subnets VMSubnet » : il y en a un dans chaque VNet, et la table s’applique à chacun.',
        [sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet1}} --name VMSubnet --route-table {{tableVm}}'), sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet2}} --name VMSubnet --route-table {{tableVm}}')],
        'Deux blocs JSON où « routeTable » donne la table.', { important: 'Cette table envoie le trafic sortant vers une passerelle : sans passerelle de réseau virtuel, il est perdu. Le TP le demande ainsi.' }),
      mod('Créer la table de DataSubnet', 'Une seconde table : 0.0.0.0/0 est déjà pris par la première.',
        [sh('az network route-table create --resource-group {{groupe}} --name {{tableData}} --location {{region}}')], 'Un bloc JSON où « provisioningState » vaut « Succeeded ».'),
      mod('Envoyer Internet vers l’appliance', 'Le tronçon VirtualAppliance demande l’adresse de l’appliance.',
        [sh('az network route-table route create --resource-group {{groupe}} --route-table-name {{tableData}} --name internet-vers-appliance --address-prefix 0.0.0.0/0 --next-hop-type VirtualAppliance --next-hop-ip-address {{saut}}')], 'Un bloc JSON avec le saut VirtualAppliance et l’adresse.'),
      mod('Envoyer App Service et Event Hubs vers l’appliance', 'Une étiquette de service remplace une liste d’adresses : le préfixe est le nom de l’étiquette suivi de la région. Il en faut une par région (Canada Centre et Canada Est). Une table accepte au plus 25 routes par étiquette.',
        [
          sh('az network route-table route create --resource-group {{groupe}} --route-table-name {{tableData}} --name appservice-canadacentral --address-prefix AppService.CanadaCentral --next-hop-type VirtualAppliance --next-hop-ip-address {{saut}}'),
          sh('az network route-table route create --resource-group {{groupe}} --route-table-name {{tableData}} --name appservice-canadaeast --address-prefix AppService.CanadaEast --next-hop-type VirtualAppliance --next-hop-ip-address {{saut}}'),
          sh('az network route-table route create --resource-group {{groupe}} --route-table-name {{tableData}} --name eventhub-canadacentral --address-prefix EventHub.CanadaCentral --next-hop-type VirtualAppliance --next-hop-ip-address {{saut}}'),
          sh('az network route-table route create --resource-group {{groupe}} --route-table-name {{tableData}} --name eventhub-canadaeast --address-prefix EventHub.CanadaEast --next-hop-type VirtualAppliance --next-hop-ip-address {{saut}}'),
        ], 'Quatre blocs JSON, chacun avec son étiquette comme préfixe.'),
      itr('Associer la table à DataSubnet', 'À partir d’ici, le trafic de DataSubnet vers Internet et vers ces services part vers l’appliance, qui n’existe pas : il est perdu. C’est la demande du TP.',
        [sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet2}} --name DataSubnet --route-table {{tableData}}')], 'Un bloc JSON où « routeTable » donne la table.'),
      lec('Relire les routes des deux tables', 'Capture ces deux listes pour le rapport : elles prouvent la configuration.',
        [sh('az network route-table route list --resource-group {{groupe}} --route-table-name {{tableVm}} --output table'), sh('az network route-table route list --resource-group {{groupe}} --route-table-name {{tableData}} --output table')], 'Table VMSubnet : 2 routes. Table DataSubnet : 5 routes (Internet et quatre étiquettes).', { verification: true }),
    ],
    verification: ['La table des VMSubnet a 2 routes (0.0.0.0/0 vers la passerelle, plage vers None), celle de DataSubnet en a 5 vers l’appliance 10.3.2.100, et chaque table est associée à ses sous-réseaux.'],
    retour: 'Pour défaire : dissocie chaque sous-réseau (« --route-table null » ou le portail), puis supprime les routes et les tables avec la fiche de gestion des tables de routage.',
    depannage: [
      { symptome: 'Le nom d’étiquette est refusé comme préfixe', cause: 'Le nom ou la région de l’étiquette est mal écrit, ou la version d’Azure CLI est ancienne.', action: 'Vérifie l’écriture exacte (AppService.CanadaCentral) dans la liste des étiquettes de service, ou crée la route dans le portail (type de destination « Étiquette de service »).' },
    ],
    sources: [{ label: 'Créer, modifier ou supprimer une table de routage', url: DOC('azure/virtual-network/manage-route-table') }, { label: 'Routage du trafic du réseau virtuel (étiquettes de service)', url: DOC('azure/virtual-network/virtual-networks-udr-overview') }],
  }),
];
