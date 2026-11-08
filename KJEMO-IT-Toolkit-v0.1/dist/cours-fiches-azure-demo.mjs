/**
 * cours-fiches-azure-demo.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le montage de démonstration de l'enseignant (schéma « VNETDemo ») : une
 * application web joint un compte de stockage SANS passer par Internet. Trafic
 * entrant public vers l'application ; trafic sortant par le sous-réseau
 * AppServiceOutboundSubnet (intégration au VNet) ; point de terminaison privé
 * dans StorageSubnet ; compte de stockage dont l'accès public est fermé.
 * UNE fiche, trois méthodes : portail (avec écrans reconstitués), PowerShell
 * (module Az) et Azure CLI. Rien n'est exécuté dans Azure.
 */
import { V_COURS, lec, mod, des, itr, sh, ps, gui } from './cours-outils.mjs';

void V_COURS;
const DOC = (chemin) => `https://learn.microsoft.com/${chemin}`;
const REGIONS = ['canadacentral', 'canadaeast', 'eastus', 'eastus2', 'centralus', 'westus2', 'northeurope', 'westeurope', 'francecentral', 'uksouth'];
const PRIV = 'Compte Azure avec le rôle Contributeur sur l’abonnement ou le groupe de ressources ; connecté par toi-même (portail, `az login` ou `Connect-AzAccount`).';

const params = [
  { id: 'groupe', label: 'groupe de ressources', type: 'nomAzure', exemple: 'rg-demo', aide: 'Le nom du groupe de ressources (lettres, chiffres, tirets).' },
  { id: 'region', label: 'région Azure', type: 'choix', choix: REGIONS, exemple: 'canadacentral', aide: 'Le nom technique de la région (canadacentral = Canada Centre).' },
  { id: 'vnet', label: 'réseau virtuel (VNet)', type: 'nomAzure', exemple: 'VNETDemo', aide: 'Le nom du réseau virtuel du schéma.' },
  { id: 'espace', label: 'espace d’adressage du VNet', type: 'cidr', exemple: '10.10.0.0/16', aide: 'Le bloc du VNet, en privé : 10.10.0.0/16 par exemple.' },
  { id: 'sousReseauApp', label: 'sous-réseau de sortie de l’application', type: 'nomAzure', exemple: 'AppServiceOutboundSubnet', aide: 'Sous-réseau vide, réservé à l’intégration de l’application (délégué à App Service).' },
  { id: 'plageApp', label: 'plage du sous-réseau de sortie', type: 'cidr', exemple: '10.10.1.0/24', aide: 'Au moins /28 ; /24 laisse de la place. Doit tenir dans l’espace du VNet.' },
  { id: 'sousReseauStock', label: 'sous-réseau du point privé', type: 'nomAzure', exemple: 'StorageSubnet', aide: 'Sous-réseau qui accueille le point de terminaison privé (non délégué).' },
  { id: 'plageStock', label: 'plage du sous-réseau du point privé', type: 'cidr', exemple: '10.10.2.0/24', aide: 'Une plage dans l’espace du VNet qui ne chevauche pas l’autre sous-réseau.' },
  { id: 'compte', label: 'compte de stockage', type: 'compteStockage', exemple: 'stdemo01', aide: 'Le nom du compte : 3 à 24 caractères, minuscules et chiffres seulement, unique dans tout Azure.' },
  { id: 'conteneur', label: 'conteneur de blobs', type: 'nomAzure', exemple: 'blob1', aide: 'Le nom du conteneur que l’application lira.' },
  { id: 'plan', label: 'plan App Service', type: 'nomAzure', exemple: 'asp-demo', aide: 'Le plan (les machines) qui héberge l’application.' },
  { id: 'webapp', label: 'application web', type: 'nomAzure', exemple: 'webapp-demo-01', aide: 'Forme l’adresse <nom>.azurewebsites.net ; unique dans tout Azure.' },
  { id: 'image', label: 'image du conteneur (nom:étiquette)', type: 'texte', exemple: 'romaric/tpasr:latest', aide: 'L’image de l’application (Docker Hub par défaut), avec son étiquette.' },
  { id: 'pointPrive', label: 'nom du point de terminaison privé', type: 'nomAzure', exemple: 'pe-stdemo-blob', aide: 'Le nom du point privé du compte de stockage.' },
  { id: 'connexion', label: 'nom de la connexion privée', type: 'nomAzure', exemple: 'conn-stdemo-blob', aide: 'Le nom de la connexion entre le point et le compte.' },
];

const ZONE = 'privatelink.blob.core.windows.net';

// ---------------------------------------------------------------------------
// Interface graphique (portail) — chaque étape porte un écran reconstitué
// ---------------------------------------------------------------------------
const GUI_ETAPES = [
  gui('Créer le groupe de ressources', 'modification', 'Le groupe de ressources contient tout le montage : le supprimer à la fin supprime tout.',
    ['Dans la barre de recherche du portail, tape **Groupes de ressources**, ouvre le service puis clique **+ Créer**.', 'Choisis ton **Abonnement**, saisis le **Nom du groupe de ressources** et la **Région**.', 'Clique **Vérifier + créer**, puis **Créer**.'],
    'Le groupe apparaît dans la liste des groupes de ressources.',
    { ecran: { blade: 'Créer un groupe de ressources', fil: 'Accueil > Groupes de ressources > Créer', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Abonnement', valeur: 'ton abonnement', genre: 'liste' }, { label: 'Groupe de ressources', valeur: 'rg-demo', marque: true }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste', marque: true }], bouton: 'Vérifier + créer' } }),
  gui('Créer le réseau virtuel et ses deux sous-réseaux', 'modification', 'Un seul VNet (VNETDemo) avec deux sous-réseaux : un pour la sortie de l’application, un pour le point privé. Le portail crée un sous-réseau « default » : tu peux le renommer ou le retirer.',
    ['Cherche **Réseaux virtuels**, clique **+ Créer**.', 'Onglet **Informations de base** : groupe de ressources, **Nom** du VNet, **Région**.', 'Onglet **Adresses IP** : saisis l’**espace d’adressage IPv4**, puis **+ Ajouter un sous-réseau** deux fois : un pour la sortie de l’application, un pour le point privé, chacun avec son **Nom** et sa **plage**.', 'Clique **Vérifier + créer**, puis **Créer**.'],
    'Le VNet est déployé avec deux sous-réseaux.',
    { ecran: { blade: 'Créer un réseau virtuel', fil: 'Accueil > Réseaux virtuels > Créer', onglets: ['Informations de base', 'Sécurité', 'Adresses IP', 'Balises', 'Vérifier + créer'], actif: 2, champs: [{ label: 'Espace d’adressage IPv4', valeur: '10.10.0.0/16', marque: true }, { label: 'Sous-réseau 1 — nom', valeur: 'AppServiceOutboundSubnet', marque: true }, { label: 'Sous-réseau 1 — plage', valeur: '10.10.1.0/24', marque: true }, { label: 'Sous-réseau 2 — nom', valeur: 'StorageSubnet', marque: true }, { label: 'Sous-réseau 2 — plage', valeur: '10.10.2.0/24', marque: true }], bouton: 'Vérifier + créer' } }),
  gui('Déléguer le sous-réseau de sortie à App Service', 'modification', 'La délégation réserve le sous-réseau à App Service. Elle se fait sur le sous-réseau de sortie seulement : pas sur celui du point privé.',
    ['Ouvre le VNet, menu **Sous-réseaux**, clique le sous-réseau de sortie.', 'Dans **Déléguer le sous-réseau à un service**, choisis **Microsoft.Web/serverFarms**.', 'Clique **Enregistrer**.'],
    'Le sous-réseau affiche la délégation Microsoft.Web/serverFarms.',
    { ecran: { blade: 'Modifier le sous-réseau', fil: 'Réseau virtuel > Sous-réseaux > AppServiceOutboundSubnet', champs: [{ label: 'Nom', valeur: 'AppServiceOutboundSubnet', genre: 'lecture' }, { label: 'Déléguer le sous-réseau à un service', valeur: 'Microsoft.Web/serverFarms', genre: 'liste', marque: true }], bouton: 'Enregistrer' } }),
  gui('Créer le compte de stockage et le conteneur', 'modification', 'Le compte garde l’accès public ouvert pour l’instant : on dépose le contenu avant de fermer. L’accès anonyme aux blobs reste interdit.',
    ['Cherche **Comptes de stockage**, clique **+ Créer**.', 'Onglet **Informations de base** : groupe de ressources, **Nom du compte de stockage**, **Région**, **Redondance** : **Stockage localement redondant (LRS)**.', 'Onglet **Avancé** : décoche **Autoriser l’accès anonyme aux blobs**.', 'Clique **Vérifier + créer**, puis **Créer**.', 'Ouvre le compte, **Conteneurs**, **+ Conteneur** : saisis le **Nom** (niveau d’accès anonyme : **Privé**) et dépose un fichier avec **Charger**.'],
    'Le compte, le conteneur et un fichier déposé existent.',
    { ecran: { blade: 'Créer un compte de stockage', fil: 'Accueil > Comptes de stockage > Créer', onglets: ['Informations de base', 'Avancé', 'Mise en réseau', 'Protection des données', 'Chiffrement', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Groupe de ressources', valeur: 'rg-demo', genre: 'liste' }, { label: 'Nom du compte de stockage', valeur: 'stdemo01', marque: true }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste' }, { label: 'Redondance', valeur: 'Stockage localement redondant (LRS)', genre: 'liste', marque: true }], bouton: 'Vérifier + créer' } }),
  gui('Créer le plan et l’application web', 'modification', 'Le plan De base (B1) est le minimum qui permet l’intégration au VNet. L’application tourne dans un conteneur Linux.',
    ['Cherche **App Services**, clique **+ Créer**, **Application web**.', 'Onglet **Informations de base** : groupe de ressources, **Nom** de l’application, **Publier** : **Conteneur**, **Système d’exploitation** : **Linux**, **Région**.', 'Sous **Plan tarifaire**, crée un plan et choisis **De base B1**.', 'Onglet **Conteneur** : **Source de l’image** : **Autres registres de conteneurs**, saisis l’image et l’étiquette.', 'Clique **Vérifier + créer**, puis **Créer**.'],
    'L’application est déployée et son adresse <nom>.azurewebsites.net répond.',
    { ecran: { blade: 'Créer une application web', fil: 'Accueil > App Services > Créer > Application web', onglets: ['Informations de base', 'Base de données', 'Conteneur', 'Mise en réseau', 'Supervision', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Nom', valeur: 'webapp-demo-01', marque: true }, { label: 'Publier', valeur: 'Conteneur', genre: 'liste', marque: true }, { label: 'Système d’exploitation', valeur: 'Linux', genre: 'liste' }, { label: 'Région', valeur: 'Canada Centre', genre: 'liste' }, { label: 'Plan tarifaire', valeur: 'De base B1', genre: 'liste', marque: true }], bouton: 'Suivant : Base de données' } }),
  gui('Intégrer l’application au sous-réseau de sortie', 'modification', 'À partir de là, le trafic sortant de l’application part du sous-réseau choisi : c’est la flèche « Trafic sortant » du schéma.',
    ['Ouvre l’application, menu **Paramètres > Mise en réseau**.', 'Dans **Configuration du trafic sortant**, clique **Intégration au réseau virtuel**.', 'Clique **Ajouter une intégration de réseau virtuel**, choisis l’**Abonnement**, le **Réseau virtuel** et le **Sous-réseau** de sortie.', 'Clique **Connexion**.'],
    'L’intégration apparaît avec le VNet et le sous-réseau, état « Connecté ».',
    { ecran: { blade: 'Ajouter une intégration de réseau virtuel', fil: 'App Service > Mise en réseau > Intégration au réseau virtuel', champs: [{ label: 'Abonnement', valeur: 'ton abonnement', genre: 'liste' }, { label: 'Réseau virtuel', valeur: 'VNETDemo', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'AppServiceOutboundSubnet', genre: 'liste', marque: true }], bouton: 'Connexion' } }),
  gui('Faire passer tout le trafic sortant par le VNet', 'modification', 'Sans cette case, seules les adresses privées passent par le VNet et la résolution du nom du stockage peut rester publique. À vérifier avec ton enseignant si le sujet ne le demande pas.',
    ['Reste dans **Mise en réseau > Intégration au réseau virtuel**.', 'Coche **Acheminer tout le trafic** (Route All), puis **Enregistrer** si le bouton apparaît.'],
    'L’option « Acheminer tout le trafic » est cochée.',
    { ecran: { blade: 'Intégration au réseau virtuel', fil: 'App Service > Mise en réseau', champs: [{ label: 'Réseau virtuel', valeur: 'VNETDemo', genre: 'lecture' }, { label: 'Sous-réseau', valeur: 'AppServiceOutboundSubnet', genre: 'lecture' }, { label: 'Acheminer tout le trafic', valeur: 'coche', genre: 'case', marque: true }], bouton: 'Enregistrer' } }),
  gui('Créer le point de terminaison privé du stockage', 'modification', 'Le point privé donne au compte une adresse DANS StorageSubnet. La sous-ressource « blob » correspond au service des blobs ; il en faut un autre par service utilisé (file, fichier, table).',
    ['Ouvre le compte de stockage, **Sécurité + mise en réseau > Mise en réseau**, onglet **Connexions de point de terminaison privé**, **+ Point de terminaison privé**.', 'Onglet **Informations de base** : **Nom**, **Région** (celle du VNet).', 'Onglet **Ressource** : **Sous-ressource cible** : **blob**.', 'Onglet **Réseau virtuel** : le **VNet** et le sous-réseau du point privé (**StorageSubnet**).', 'Onglet **DNS** : **Intégrer à une zone DNS privée** : **Oui** (zone privatelink.blob.core.windows.net).', 'Clique **Vérifier + créer**, puis **Créer**.'],
    'Le point privé est approuvé, avec une adresse privée du sous-réseau.',
    { ecran: { blade: 'Créer un point de terminaison privé', fil: 'Compte de stockage > Mise en réseau > Point de terminaison privé', onglets: ['Informations de base', 'Ressource', 'Réseau virtuel', 'DNS', 'Balises', 'Vérifier + créer'], actif: 2, champs: [{ label: 'Réseau virtuel', valeur: 'VNETDemo', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'StorageSubnet', genre: 'liste', marque: true }, { label: 'Allocation d’adresse IP privée', valeur: 'Dynamique', genre: 'liste' }], bouton: 'Suivant : DNS', note: 'Onglet Ressource : sous-ressource cible = blob. Onglet DNS : intégrer à une zone DNS privée = Oui.' } }),
  gui('Fermer l’accès public du compte de stockage', 'interruption', 'À faire en dernier : ensuite seul le point privé joint le compte. Ton poste n’y a plus accès.',
    ['Dans le compte, **Sécurité + mise en réseau > Mise en réseau**, onglet **Pare-feu et réseaux virtuels**.', '**Accès au réseau public** : **Désactivé**.', 'Clique **Enregistrer**.'],
    'L’accès au réseau public est « Désactivé ».',
    { ecran: { blade: 'Mise en réseau — Pare-feu et réseaux virtuels', fil: 'Compte de stockage > Mise en réseau', onglets: ['Pare-feu et réseaux virtuels', 'Connexions de point de terminaison privé', 'Accès réseau'], actif: 0, champs: [{ label: 'Accès au réseau public', valeur: 'Désactivé', genre: 'liste', marque: true }], bouton: 'Enregistrer' }, important: 'Le fichier doit déjà être déposé : sans accès public, ton poste n’atteint plus le contenu.' }),
  gui('Vérifier depuis l’application', 'lecture', 'Le nom du compte doit se résoudre en adresse privée DEPUIS l’application, et Internet doit être refusé.',
    ['Ouvre l’application, **Outils de développement > SSH** (ou **Console**), puis tape `nslookup <compte>.blob.core.windows.net`.', 'Contrôle que l’adresse commence par celle du sous-réseau du point privé (10.10.2.x).', 'Depuis ton poste, ouvre l’adresse du fichier du conteneur : l’accès doit être refusé.'],
    'Adresse privée depuis l’application ; accès refusé depuis Internet.',
    { ecran: { blade: 'SSH — application web', fil: 'App Service > Outils de développement > SSH', champs: [{ label: 'Commande', valeur: 'nslookup stdemo01.blob.core.windows.net', marque: true }, { label: 'Réponse attendue', valeur: '10.10.2.x (privée)', genre: 'lecture' }], note: 'Depuis Internet : refus (403) attendu.' } }),
];

// ---------------------------------------------------------------------------
// PowerShell (module Az)
// ---------------------------------------------------------------------------
const PS_ETAPES = [
  lec('Se connecter et vérifier l’abonnement', 'Connecte-toi toi-même (fenêtre de connexion) et confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
    [ps('Connect-AzAccount'), ps('Get-AzContext | Format-List Name, Subscription')], 'Le nom de l’abonnement actif.'),
  mod('Créer le groupe de ressources', 'Contient tout le montage.', [ps('New-AzResourceGroup -Name {{groupe}} -Location {{region}}')], 'Un objet avec ProvisioningState = Succeeded.'),
  mod('Créer le réseau virtuel et ses deux sous-réseaux', 'La délégation à Microsoft.Web/serverFarms se déclare sur le sous-réseau de sortie seulement.',
    [ps('$deleg = New-AzDelegation -Name "dlg-app" -ServiceName "Microsoft.Web/serverFarms"'),
      ps('$sA = New-AzVirtualNetworkSubnetConfig -Name {{sousReseauApp}} -AddressPrefix {{plageApp}} -Delegation $deleg'),
      ps('$sS = New-AzVirtualNetworkSubnetConfig -Name {{sousReseauStock}} -AddressPrefix {{plageStock}}'),
      ps('New-AzVirtualNetwork -Name {{vnet}} -ResourceGroupName {{groupe}} -Location {{region}} -AddressPrefix {{espace}} -Subnet $sA, $sS')],
    'Le VNet avec ses deux sous-réseaux.'),
  mod('Créer le compte de stockage et le conteneur', 'Accès anonyme interdit ; l’accès public reste ouvert le temps de déposer le contenu.',
    [ps('New-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}} -Location {{region}} -SkuName Standard_LRS -Kind StorageV2 -AllowBlobPublicAccess $false'),
      ps('New-AzRmStorageContainer -ResourceGroupName {{groupe}} -StorageAccountName {{compte}} -Name {{conteneur}}')],
    'Le compte et le conteneur, ProvisioningState = Succeeded.'),
  mod('Créer le plan et l’application web', 'Plan Linux De base (B1) ; l’application exécute l’image de conteneur (Docker Hub). Vérifie les noms de paramètres avec Get-Help New-AzWebApp si ta version du module diffère.',
    [ps('New-AzAppServicePlan -ResourceGroupName {{groupe}} -Name {{plan}} -Location {{region}} -Tier Basic -WorkerSize Small -Linux'),
      ps('New-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}} -Location {{region}} -AppServicePlan {{plan}} -ContainerImageName {{image}}')],
    'L’application avec State = Running.', { important: 'La syntaxe exacte du conteneur dépend de la version du module Az.Websites : si la commande refuse -ContainerImageName, crée l’application dans le portail ou avec la méthode CLI.' }),
  mod('Intégrer l’application au sous-réseau de sortie', 'On écrit l’identifiant du sous-réseau dans la propriété virtualNetworkSubnetId de l’application ; elle sort ensuite par ce sous-réseau.',
    [ps('$sub = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}} | Select-Object -ExpandProperty Subnets | Where-Object Name -eq "{{sousReseauApp}}"'),
      ps('$res = Get-AzResource -ResourceGroupName {{groupe}} -ResourceType Microsoft.Web/sites -Name {{webapp}}'),
      ps('$res.Properties.virtualNetworkSubnetId = $sub.Id'),
      ps('$res | Set-AzResource -Force')],
    'La ressource mise à jour, virtualNetworkSubnetId rempli.'),
  mod('Faire passer tout le trafic sortant par le VNet', 'Équivalent de la case « Acheminer tout le trafic » ; sans elle, la résolution du nom du stockage peut rester publique.',
    [ps('$res = Get-AzResource -ResourceGroupName {{groupe}} -ResourceType Microsoft.Web/sites -Name {{webapp}}'),
      ps('$res.Properties.vnetRouteAllEnabled = $true'),
      ps('$res | Set-AzResource -Force')],
    'vnetRouteAllEnabled à True.', { important: 'Nom de propriété à confirmer dans le portail (Mise en réseau > Acheminer tout le trafic) : coche-la à la main si la commande la refuse.' }),
  mod('Créer le point de terminaison privé (sous-ressource blob)', 'Le point privé prend une adresse dans StorageSubnet ; le groupe « blob » désigne le service des blobs.',
    [ps('$cpt = Get-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}}'),
      ps('$sub = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}} | Select-Object -ExpandProperty Subnets | Where-Object Name -eq "{{sousReseauStock}}"'),
      ps('$lien = New-AzPrivateLinkServiceConnection -Name {{connexion}} -PrivateLinkServiceId $cpt.Id -GroupId blob'),
      ps('New-AzPrivateEndpoint -ResourceGroupName {{groupe}} -Name {{pointPrive}} -Location {{region}} -Subnet $sub -PrivateLinkServiceConnection $lien')],
    'Le point privé avec une connexion « Approved ».'),
  mod('Créer la zone DNS privée, la lier au VNet et inscrire le point', `Le nom du compte doit se résoudre en adresse privée dans le VNet : zone ${ZONE}, lien au VNet, groupe de zones du point.`,
    [ps(`$zone = New-AzPrivateDnsZone -ResourceGroupName {{groupe}} -Name ${ZONE}`),
      ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
      ps(`New-AzPrivateDnsVirtualNetworkLink -ResourceGroupName {{groupe}} -ZoneName ${ZONE} -Name lien-{{vnet}} -VirtualNetworkId $vn.Id`),
      ps('$cfg = New-AzPrivateDnsZoneConfig -Name blob -PrivateDnsZoneId $zone.ResourceId'),
      ps('New-AzPrivateDnsZoneGroup -ResourceGroupName {{groupe}} -PrivateEndpointName {{pointPrive}} -Name groupe-dns -PrivateDnsZoneConfig $cfg')],
    'La zone, le lien (VirtualNetworkLinkState = Completed) et le groupe de zones.'),
  itr('Fermer l’accès public du compte de stockage', 'En dernier : ensuite seul le point privé joint le compte, et ton poste n’y a plus accès.',
    [ps('Set-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}} -PublicNetworkAccess Disabled')], 'PublicNetworkAccess = Disabled.',
    { important: 'Dépose le fichier dans le conteneur AVANT cette commande (portail, ou Set-AzStorageBlobContent avec -Context).' }),
  lec('Contrôler le point privé et l’accès', 'Lis l’état de la connexion privée ; le nom du compte se résout en adresse privée seulement depuis le VNet (portail : SSH de l’application).',
    [ps('(Get-AzPrivateEndpoint -ResourceGroupName {{groupe}} -Name {{pointPrive}}).PrivateLinkServiceConnections | Format-List Name, @{n="Etat";e={$_.PrivateLinkServiceConnectionState.Status}}'),
      ps('Get-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}} | Format-List PublicNetworkAccess, AllowBlobPublicAccess')],
    'Connexion « Approved », PublicNetworkAccess « Disabled ».', { verification: true }),
];

// ---------------------------------------------------------------------------
// Azure CLI
// ---------------------------------------------------------------------------
const CLI_ETAPES = [
  lec('Vérifier l’abonnement actif', 'Confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.', [sh('az account show --output table')], 'Le nom et l’identifiant de l’abonnement, avec IsDefault à True.'),
  mod('Créer le groupe de ressources', 'Contient tout le montage.', [sh('az group create --name {{groupe}} --location {{region}}')], 'Un bloc JSON où « provisioningState » vaut « Succeeded ».'),
  mod('Créer le réseau virtuel et le sous-réseau de sortie', 'La délégation à App Service se déclare sur le sous-réseau de sortie.',
    [sh('az network vnet create --resource-group {{groupe}} --name {{vnet}} --location {{region}} --address-prefixes {{espace}} --subnet-name {{sousReseauApp}} --subnet-prefixes {{plageApp}}'),
      sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet}} --name {{sousReseauApp}} --delegations Microsoft.Web/serverFarms')],
    'Le VNet, puis le sous-réseau avec la délégation Microsoft.Web/serverFarms.'),
  mod('Créer le sous-réseau du point privé', 'Sous-réseau NON délégué : il accueille le point de terminaison privé.',
    [sh('az network vnet subnet create --resource-group {{groupe}} --vnet-name {{vnet}} --name {{sousReseauStock}} --address-prefixes {{plageStock}}')], 'Un bloc JSON avec la plage du sous-réseau.'),
  mod('Créer le compte de stockage et le conteneur', 'Accès anonyme interdit ; l’accès public reste ouvert le temps de déposer le contenu.',
    [sh('az storage account create --resource-group {{groupe}} --name {{compte}} --location {{region}} --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false'),
      sh('az storage container-rm create --resource-group {{groupe}} --storage-account {{compte}} --name {{conteneur}}')],
    'Le compte puis le conteneur, « provisioningState » à « Succeeded ».'),
  mod('Créer le plan et l’application web', 'Plan Linux De base (B1) ; l’application exécute l’image de conteneur.',
    [sh('az appservice plan create --resource-group {{groupe}} --name {{plan}} --location {{region}} --is-linux --sku B1'),
      sh('az webapp create --resource-group {{groupe}} --plan {{plan}} --name {{webapp}} --deployment-container-image-name {{image}}')],
    'Le plan puis l’application, avec « state » à « Running ».', { important: 'Options de ces deux commandes écrites de mémoire : vérifie avec « --help » si l’une est refusée.' }),
  mod('Intégrer l’application au sous-réseau de sortie', 'Le trafic sortant de l’application part maintenant du sous-réseau choisi.',
    [sh('az webapp vnet-integration add --resource-group {{groupe}} --name {{webapp}} --vnet {{vnet}} --subnet {{sousReseauApp}}')], 'Un bloc JSON avec le sous-réseau intégré.'),
  mod('Faire passer tout le trafic sortant par le VNet', 'Équivalent de la case « Acheminer tout le trafic » du portail.',
    [sh('az webapp config set --resource-group {{groupe}} --name {{webapp}} --vnet-route-all-enabled true')], 'Un bloc JSON où « vnetRouteAllEnabled » vaut « true ».', { important: 'Option à confirmer avec « az webapp config set --help ».' }),
  mod('Créer le point de terminaison privé (sous-ressource blob)', 'L’identifiant du compte est lu au moment de la commande.',
    [sh('az network private-endpoint create --resource-group {{groupe}} --name {{pointPrive}} --vnet-name {{vnet}} --subnet {{sousReseauStock}} --private-connection-resource-id $(az storage account show --resource-group {{groupe}} --name {{compte}} --query id --output tsv) --group-id blob --connection-name {{connexion}}')],
    'Un bloc JSON où « provisioningState » vaut « Succeeded ».'),
  mod('Créer la zone DNS privée, la lier au VNet et inscrire le point', `Le nom du compte doit se résoudre en adresse privée : zone ${ZONE}.`,
    [sh(`az network private-dns zone create --resource-group {{groupe}} --name ${ZONE}`),
      sh(`az network private-dns link vnet create --resource-group {{groupe}} --zone-name ${ZONE} --name lien-{{vnet}} --virtual-network {{vnet}} --registration-enabled false`),
      sh(`az network private-endpoint dns-zone-group create --resource-group {{groupe}} --endpoint-name {{pointPrive}} --name groupe-dns --private-dns-zone ${ZONE} --zone-name blob`)],
    'La zone, le lien (« virtualNetworkLinkState » à « Completed ») puis le groupe de zones.'),
  mod('Déposer un fichier dans le conteneur', 'À faire AVANT de fermer l’accès public (rôle « Contributeur des données Blob du stockage » requis).',
    [sh('az storage blob upload --account-name {{compte}} --container-name {{conteneur}} --file ./exemple.txt --auth-mode login')], 'Un bloc JSON avec « etag ».', { facultatif: true }),
  itr('Fermer l’accès public du compte de stockage', 'En dernier : ensuite seul le point privé joint le compte.',
    [sh('az storage account update --resource-group {{groupe}} --name {{compte}} --public-network-access Disabled')], 'Un bloc JSON où « publicNetworkAccess » vaut « Disabled ».', { important: 'Ton poste n’atteint plus le compte : teste depuis l’application (SSH).' }),
  lec('Contrôler la résolution depuis l’application', 'Ouvre une session SSH dans l’application, puis résous le nom du compte : adresse privée attendue.',
    [sh('az webapp ssh --resource-group {{groupe}} --name {{webapp}}'), sh('nslookup {{compte}}.blob.core.windows.net')], 'Un alias vers privatelink.blob.core.windows.net et une adresse du sous-réseau du point privé.', { verification: true }),
];

const VERIF = ['Depuis l’application, le nom du compte se résout en adresse privée du sous-réseau du point privé.', 'Depuis Internet, l’accès au compte de stockage est refusé.', 'Le trafic entrant vers l’application reste public (flèche « Trafic entrant » du schéma).'];
const RETOUR = 'Le plus simple : supprime le groupe de ressources (tout le montage disparaît). Pour garder le montage : rouvre l’accès public du compte, retire l’intégration de l’application, puis supprime le point privé, le lien et la zone DNS privée.';

export const COURS_AZURE_DEMO = [{
  id: 'cours-az-tp-demo-webapp-stockage-prive',
  titre: 'TP démo : une application web joint un stockage par point privé',
  categorie: 'Azure et Entra ID',
  resume: 'Le montage « VNETDemo » du schéma de l’enseignant : trafic entrant public vers l’application, trafic sortant par le sous-réseau d’intégration, point de terminaison privé dans StorageSubnet, compte de stockage dont l’accès public est fermé. Trois méthodes : portail, PowerShell, Azure CLI.',
  effet: 'interruption',
  intentions: ['app service stockage point privé', 'vnetdemo webapp storage private endpoint', 'tp démo azure webapp stockage', 'trafic sortant app service vers stockage privé', 'AppServiceOutboundSubnet StorageSubnet'],
  motsCles: ['azure', 'app service', 'point privé', 'private endpoint', 'stockage', 'vnet', 'intégration', 'tp', 'démo', 'vnetdemo'],
  params,
  methodes: [
    { id: 'gui', privileges: PRIV, etapes: GUI_ETAPES, verification: VERIF, retour: RETOUR },
    { id: 'powershell', privileges: PRIV, etapes: PS_ETAPES, verification: VERIF, retour: `${RETOUR} En PowerShell : Remove-AzResourceGroup -Name <groupe> -Force.` },
    { id: 'azure', privileges: PRIV, etapes: CLI_ETAPES, verification: VERIF, retour: `${RETOUR} En CLI : az group delete --name <groupe> --yes.`,
      depannage: [
        { symptome: 'Le nom du compte se résout encore en adresse publique depuis l’application', cause: 'La zone DNS privée n’est pas liée au VNet, le groupe de zones manque, ou « Acheminer tout le trafic » n’est pas activé.', action: 'Relis le lien de la zone, le groupe de zones du point privé et la case « Acheminer tout le trafic ».' },
        { symptome: 'L’intégration est refusée', cause: 'Plan gratuit, sous-réseau trop petit, déjà utilisé ou non délégué.', action: 'Passe au moins à B1 et utilise un sous-réseau vide d’au moins /28 délégué à Microsoft.Web/serverFarms.' },
        { symptome: 'Le point privé ne se crée pas dans le sous-réseau de sortie', cause: 'Ce sous-réseau est délégué à App Service.', action: 'Crée le point privé dans l’autre sous-réseau (StorageSubnet), non délégué.' },
      ] },
  ],
  assistant: null,
  figures: ['az-tp-demo', 'az-service-prive', 'az-dns-public-prive'],
  sources: [
    { label: 'Intégration au réseau virtuel d’App Service', url: DOC('azure/app-service/overview-vnet-integration') },
    { label: 'Tutoriel : connecter à un compte de stockage par point de terminaison privé', url: DOC('azure/private-link/tutorial-private-endpoint-storage-portal') },
    { label: 'Démarrage rapide : créer un point de terminaison privé (portail)', url: DOC('azure/private-link/create-private-endpoint-portal') },
  ],
  validation: 'Étapes recoupées avec les pages Microsoft Learn de l’enseignant (point privé de stockage, point privé, restrictions) et notre connaissance des outils pour le portail, PowerShell (module Az) et la CLI : NON exécutées dans un abonnement Azure ; les écrans sont des reconstitutions schématiques, pas des captures. Vérifie les options avec « --help », Get-Help ou le portail.',
  origine: 'cours',
}];
void des;
