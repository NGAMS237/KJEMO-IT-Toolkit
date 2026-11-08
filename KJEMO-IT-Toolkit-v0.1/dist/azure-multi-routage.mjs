/**
 * azure-multi-routage.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * Méthodes « gui » (portail, écrans reconstitués) et « powershell » (module Az)
 * des fiches de routage et d'accès privé au stockage. Rien n'est exécuté dans
 * Azure ; les libellés du portail sont reconstitués (à confirmer à l'écran).
 */
import { lec, mod, des, itr, ps, gui } from './cours-outils.mjs';

const PRIV = 'Compte Azure avec le rôle Contributeur (ou Contributeur de réseau) sur le groupe de ressources ; connecté par toi-même (portail ou Connect-AzAccount).';
const PS_CTX = lec('Se connecter et vérifier l’abonnement', 'Connecte-toi toi-même (fenêtre de connexion) et confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
  [ps('Connect-AzAccount'), ps('Get-AzContext | Format-List Name, Subscription')], 'Le nom de l’abonnement actif.');
const NOTE_LIB = 'Reconstitution du portail : libellé à confirmer à l’écran.';
const ZP = 'privatelink.blob.core.windows.net';

// ===========================================================================
// 1. Gérer une table de routage
// ===========================================================================
const GUI_GERER = [
  gui('Ouvrir la table et lire ses routes', 'lecture', 'Une table peut être associée à plusieurs sous-réseaux ; un sous-réseau n’a qu’une seule table. Les routes s’appellent « Itinéraires » dans le portail (libellé à confirmer).',
    ['Dans la barre de recherche, tape **Tables de routage** et ouvre le service : la liste montre les tables du groupe.', 'Clique la table de ton sous-réseau, puis le menu **Itinéraires** : tu vois chaque route avec son préfixe et son type de tronçon suivant.'],
    'La liste des routes de la table, avec préfixe et tronçon suivant.',
    { ecran: { blade: 'Table de routage — Itinéraires', fil: 'Accueil > Tables de routage > rt-vmsubnet > Itinéraires', champs: [{ label: 'Table de routage', valeur: 'rt-vmsubnet', genre: 'lecture', marque: true }, { label: 'Itinéraire', valeur: 'vers-passerelle', genre: 'lecture' }, { label: 'Préfixe d’adresse', valeur: '0.0.0.0/0', genre: 'lecture' }, { label: 'Tronçon suivant', valeur: 'Passerelle de réseau virtuel', genre: 'lecture' }], note: NOTE_LIB } }),
  gui('Couper la propagation des routes de la passerelle', 'modification', 'Empêche les routes apprises par BGP (réseau local) d’entrer dans la table. Si le sous-réseau doit garder le VPN, ajoute une route personnalisée de type passerelle.',
    ['Ouvre la table, menu **Configuration**.', 'Dans **Propager les routes de la passerelle**, choisis **Non**.', 'Clique **Enregistrer**.'],
    'L’option de propagation des routes de la passerelle est à « Non ».',
    { ecran: { blade: 'Table de routage — Configuration', fil: 'Accueil > Tables de routage > rt-vmsubnet > Configuration', champs: [{ label: 'Propager les routes de la passerelle', valeur: 'Non', genre: 'liste', marque: true }], bouton: 'Enregistrer', note: NOTE_LIB } }),
  gui('Modifier une route', 'modification', 'Change par exemple le type de tronçon suivant. Un préfixe ne peut pas être doublé dans la même table.',
    ['Ouvre la table, menu **Itinéraires**, puis clique la route à modifier.', 'Change le **Type de tronçon suivant** (par exemple **Passerelle de réseau virtuel**).', 'Clique **Enregistrer**.'],
    'La route affiche le nouveau tronçon suivant dans la liste.',
    { ecran: { blade: 'Modifier l’itinéraire', fil: 'Table de routage > Itinéraires > vers-passerelle', champs: [{ label: 'Nom de l’itinéraire', valeur: 'vers-passerelle', genre: 'lecture' }, { label: 'Type de tronçon suivant', valeur: 'Passerelle de réseau virtuel', genre: 'liste', marque: true }], bouton: 'Enregistrer', note: NOTE_LIB } }),
  gui('Retirer une route', 'destructif', 'Le préfixe retombe sur la route système correspondante.',
    ['Ouvre la table, menu **Itinéraires**.', 'Clique la route à retirer, puis **Supprimer** et confirme.'],
    'La route n’est plus dans la liste.',
    { ecran: { blade: 'Modifier l’itinéraire', fil: 'Table de routage > Itinéraires > vers-passerelle', champs: [{ label: 'Nom de l’itinéraire', valeur: 'vers-passerelle', genre: 'lecture' }], bouton: 'Supprimer', note: NOTE_LIB } }),
  gui('Lire les routes effectives d’une machine', 'lecture', 'Le résultat mêle routes système, routes de ta table (source « Utilisateur ») et routes de la passerelle. La machine doit être allumée.',
    ['Ouvre la machine virtuelle, menu **Réseau**, puis clique son interface réseau.', 'Dans le menu de l’interface, **Aide > Itinéraires effectifs**.', 'Repère les lignes de source **Utilisateur** : ce sont celles de ta table.'],
    'Des lignes avec source, état Actif, préfixe et tronçon suivant.',
    { ecran: { blade: 'Itinéraires effectifs', fil: 'Interface réseau > Aide > Itinéraires effectifs', champs: [{ label: 'Interface réseau', valeur: 'vm1VMNic', genre: 'liste', marque: true }, { label: 'Source', valeur: 'Utilisateur', genre: 'lecture' }, { label: 'État', valeur: 'Actif', genre: 'lecture' }, { label: 'Préfixe d’adresse', valeur: '0.0.0.0/0', genre: 'lecture' }], note: NOTE_LIB } }),
  gui('Demander le prochain saut à Network Watcher', 'lecture', 'Répond à « où irait un paquet de cette machine vers cette destination ? ». Network Watcher doit être activé dans la région.',
    ['Cherche **Network Watcher**, menu **Outils de diagnostic réseau > Tronçon suivant**.', 'Choisis l’**Abonnement**, le **Groupe de ressources** et la **Machine virtuelle**.', 'Saisis l’**Adresse IP source** (`10.2.3.4`) et l’**Adresse IP de destination** (`12.12.12.1`), puis clique **Tronçon suivant**.'],
    'Le type de tronçon suivant (et l’adresse du saut, s’il y en a une).',
    { ecran: { blade: 'Network Watcher — Tronçon suivant', fil: 'Network Watcher > Outils de diagnostic réseau > Tronçon suivant', champs: [{ label: 'Machine virtuelle', valeur: 'vm1', genre: 'liste', marque: true }, { label: 'Adresse IP source', valeur: '10.2.3.4', marque: true }, { label: 'Adresse IP de destination', valeur: '12.12.12.1', marque: true }], bouton: 'Tronçon suivant', note: NOTE_LIB } }),
  gui('Dissocier la table du sous-réseau', 'interruption', 'Le trafic du sous-réseau reprend les routes système.',
    ['Ouvre la table, menu **Sous-réseaux**.', 'Coche le sous-réseau, puis clique **Dissocier** et confirme.'],
    'Le sous-réseau n’apparaît plus dans la liste des sous-réseaux de la table.',
    { ecran: { blade: 'Table de routage — Sous-réseaux', fil: 'Accueil > Tables de routage > rt-vmsubnet > Sous-réseaux', champs: [{ label: 'Sous-réseau VMSubnet', valeur: 'coche', genre: 'case', marque: true }, { label: 'Réseau virtuel', valeur: 'vnet1', genre: 'lecture' }], bouton: 'Dissocier', note: NOTE_LIB } }),
  gui('Supprimer la table', 'destructif', 'Impossible tant qu’elle reste associée à un sous-réseau : dissocie-la d’abord, de TOUS les sous-réseaux.',
    ['Ouvre la table, clique **Supprimer** dans la barre du haut.', 'Confirme avec **Oui**.'],
    'La table disparaît de la liste des tables de routage.',
    { ecran: { blade: 'Table de routage', fil: 'Accueil > Tables de routage > rt-vmsubnet', champs: [{ label: 'Table de routage', valeur: 'rt-vmsubnet', genre: 'lecture', marque: true }], bouton: 'Supprimer', note: NOTE_LIB } }),
];

const PS_GERER = [
  PS_CTX,
  lec('Lister les tables et les routes', 'Une table peut être associée à plusieurs sous-réseaux, un sous-réseau n’a qu’une table.',
    [ps('Get-AzRouteTable -ResourceGroupName {{groupe}} | Format-Table Name, Location'),
      ps('(Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}}).Routes | Format-Table Name, AddressPrefix, NextHopType, NextHopIpAddress')],
    'Les tables du groupe, puis les routes de la table avec préfixe et tronçon suivant.'),
  mod('Couper la propagation des routes de la passerelle', 'Empêche les routes apprises par BGP d’entrer dans la table. Rien n’est écrit tant que Set-AzRouteTable n’est pas lancé.',
    [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}}'), ps('$rt.DisableBgpRoutePropagation = $true'), ps('Set-AzRouteTable -RouteTable $rt')],
    'La table avec DisableBgpRoutePropagation = True.', { facultatif: true }),
  mod('Modifier une route', 'On relit le préfixe de la route puis on change son tronçon suivant ; Set-AzRouteTable enregistre.',
    [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}}'),
      ps('$r = Get-AzRouteConfig -Name {{route}} -RouteTable $rt'),
      ps('Set-AzRouteConfig -Name {{route}} -RouteTable $rt -AddressPrefix $r.AddressPrefix -NextHopType VirtualNetworkGateway'),
      ps('Set-AzRouteTable -RouteTable $rt')],
    'La table avec la route au nouveau tronçon suivant.', { facultatif: true }),
  des('Retirer une route', 'Le préfixe retombe sur la route système correspondante.',
    [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}}'), ps('Remove-AzRouteConfig -Name {{route}} -RouteTable $rt'), ps('Set-AzRouteTable -RouteTable $rt')],
    'La route n’est plus dans la liste des routes de la table.', { facultatif: true }),
  lec('Lire les routes effectives d’une machine', 'Le résultat mêle routes système, routes de ta table (source User) et routes de la passerelle. La machine doit être allumée.',
    [ps('Get-AzEffectiveRouteTable -ResourceGroupName {{groupe}} -NetworkInterfaceName {{nic}} | Format-Table Source, State, AddressPrefix, NextHopType, NextHopIpAddress')],
    'Des lignes avec source, état Active, préfixe et tronçon suivant.', { verification: true }),
  lec('Demander le prochain saut à Network Watcher', 'Répond à « où irait un paquet de cette machine vers cette destination ? ». Network Watcher doit être activé dans la région de la machine.',
    [ps('$m = Get-AzVM -ResourceGroupName {{groupe}} -Name {{vm}}'), ps('$nw = Get-AzNetworkWatcher -Location $m.Location'),
      ps('Get-AzNetworkWatcherNextHop -NetworkWatcher $nw -TargetVirtualMachineId $m.Id -SourceIPAddress {{ipSource}} -DestinationIPAddress {{ipDest}}')],
    'Un objet avec NextHopType et, si besoin, NextHopIpAddress.', { facultatif: true, important: 'Si Get-AzNetworkWatcher ne trouve rien, Network Watcher n’est pas activé dans cette région ; vérifie les paramètres avec Get-Help Get-AzNetworkWatcherNextHop.' }),
  itr('Dissocier la table du sous-réseau', 'Le trafic du sous-réseau reprend les routes système. On vide la propriété RouteTable du sous-réseau puis on enregistre le VNet.',
    [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'), ps('$s = Get-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -VirtualNetwork $vn'), ps('$s.RouteTable = $null'), ps('$vn | Set-AzVirtualNetwork')],
    'Le sous-réseau sans table de routage.', { facultatif: true, important: 'Vérifie le résultat avec Get-AzVirtualNetworkSubnetConfig ; sinon dissocie la table dans le portail.' }),
  des('Supprimer la table', 'Impossible tant qu’elle reste associée à un sous-réseau : dissocie-la d’abord, de TOUS les sous-réseaux.',
    [ps('Remove-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}} -Force')], 'La table n’apparaît plus dans Get-AzRouteTable.', { facultatif: true }),
];

// ===========================================================================
// 2. Routes du TP2 (passerelle, plage supprimée, appliance, étiquettes)
// ===========================================================================
const GUI_TP2 = [
  gui('Créer la table des sous-réseaux VMSubnet', 'modification', 'Une table et ses routes appartiennent au même abonnement et à la même région que les sous-réseaux qui l’utilisent.',
    ['Cherche **Tables de routage**, clique **+ Créer**.', 'Choisis le **Groupe de ressources**, la **Région**, saisis le **Nom** `rt-vmsubnet`.', 'Laisse **Propager les routes de la passerelle** comme proposé, puis clique **Vérifier + créer** et **Créer**.'],
    'La table apparaît dans la liste des tables de routage.',
    { ecran: { blade: 'Créer une table de routage', fil: 'Accueil > Tables de routage > Créer', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Groupe de ressources', valeur: 'rg-lab', genre: 'liste' }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste', marque: true }, { label: 'Nom', valeur: 'rt-vmsubnet', marque: true }, { label: 'Propager les routes de la passerelle', valeur: 'Oui', genre: 'liste' }], bouton: 'Vérifier + créer', note: NOTE_LIB } }),
  gui('Envoyer tout le trafic sortant vers la passerelle', 'modification', '« En dehors du réseau » se traduit par 0.0.0.0/0 avec le tronçon « Passerelle de réseau virtuel ».',
    ['Ouvre la table, menu **Itinéraires**, clique **+ Ajouter**.', 'Saisis le **Nom de l’itinéraire** `vers-passerelle`, **Type de destination** : **Adresses IP**, **Préfixes d’adresse IP de destination** : `0.0.0.0/0`.', '**Type de tronçon suivant** : **Passerelle de réseau virtuel**, puis **Ajouter**.'],
    'La route 0.0.0.0/0 apparaît avec le tronçon Passerelle de réseau virtuel.',
    { ecran: { blade: 'Ajouter un itinéraire', fil: 'Table de routage > Itinéraires > Ajouter', champs: [{ label: 'Nom de l’itinéraire', valeur: 'vers-passerelle', marque: true }, { label: 'Type de destination', valeur: 'Adresses IP', genre: 'liste' }, { label: 'Préfixes d’adresse IP de destination', valeur: '0.0.0.0/0', marque: true }, { label: 'Type de tronçon suivant', valeur: 'Passerelle de réseau virtuel', genre: 'liste', marque: true }], bouton: 'Ajouter', note: NOTE_LIB } }),
  gui('Supprimer le trafic vers la plage interdite', 'modification', 'Le tronçon « Aucun » abandonne les paquets vers le préfixe, sans message.',
    ['Dans **Itinéraires**, clique **+ Ajouter**.', 'Nom `plage-supprimee`, **Type de destination** : **Adresses IP**, préfixe `12.12.12.0/30`.', '**Type de tronçon suivant** : **Aucun**, puis **Ajouter**.'],
    'La route de la plage apparaît avec le tronçon Aucun.',
    { ecran: { blade: 'Ajouter un itinéraire', fil: 'Table de routage > Itinéraires > Ajouter', champs: [{ label: 'Nom de l’itinéraire', valeur: 'plage-supprimee', marque: true }, { label: 'Préfixes d’adresse IP de destination', valeur: '12.12.12.0/30', marque: true }, { label: 'Type de tronçon suivant', valeur: 'Aucun', genre: 'liste', marque: true }], bouton: 'Ajouter', note: NOTE_LIB } }),
  gui('Associer la table aux deux VMSubnet', 'interruption', 'Le TP parle « des subnets VMSubnet » : il y en a un dans chaque VNet, et la table s’applique à chacun.',
    ['Ouvre la table, menu **Sous-réseaux**, clique **+ Associer**.', 'Choisis le **Réseau virtuel** (VNET1) et le **Sous-réseau** VMSubnet, puis **OK**.', 'Recommence avec le second réseau virtuel (VNET2) et son VMSubnet.'],
    'Les deux VMSubnet apparaissent dans la liste des sous-réseaux de la table.',
    { ecran: { blade: 'Associer un sous-réseau', fil: 'Table de routage > Sous-réseaux > Associer', champs: [{ label: 'Réseau virtuel', valeur: 'VNET1', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'VMSubnet', genre: 'liste', marque: true }], bouton: 'OK', note: NOTE_LIB }, important: 'Cette table envoie le trafic sortant vers une passerelle : sans passerelle de réseau virtuel, il est perdu. Le TP le demande ainsi.' }),
  gui('Créer la table de DataSubnet', 'modification', 'Une seconde table : 0.0.0.0/0 est déjà pris par la première.',
    ['Cherche **Tables de routage**, clique **+ Créer**.', 'Même groupe et même région ; **Nom** `rt-datasubnet`.', 'Clique **Vérifier + créer**, puis **Créer**.'],
    'La seconde table apparaît dans la liste.',
    { ecran: { blade: 'Créer une table de routage', fil: 'Accueil > Tables de routage > Créer', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste' }, { label: 'Nom', valeur: 'rt-datasubnet', marque: true }], bouton: 'Vérifier + créer', note: NOTE_LIB } }),
  gui('Envoyer Internet vers l’appliance', 'modification', 'Le tronçon « Appliance virtuelle » demande l’adresse de l’appliance (fictive dans le TP2).',
    ['Ouvre la table de DataSubnet, **Itinéraires > + Ajouter**.', 'Nom `internet-vers-appliance`, **Type de destination** : **Adresses IP**, préfixe `0.0.0.0/0`.', '**Type de tronçon suivant** : **Appliance virtuelle**, **Adresse du tronçon suivant** : `10.3.2.100`, puis **Ajouter**.'],
    'La route 0.0.0.0/0 pointe vers l’appliance 10.3.2.100.',
    { ecran: { blade: 'Ajouter un itinéraire', fil: 'Table de routage > Itinéraires > Ajouter', champs: [{ label: 'Nom de l’itinéraire', valeur: 'internet-vers-appliance', marque: true }, { label: 'Préfixes d’adresse IP de destination', valeur: '0.0.0.0/0', marque: true }, { label: 'Type de tronçon suivant', valeur: 'Appliance virtuelle', genre: 'liste', marque: true }, { label: 'Adresse du tronçon suivant', valeur: '10.3.2.100', marque: true }], bouton: 'Ajouter', note: NOTE_LIB } }),
  gui('Envoyer App Service et Event Hubs vers l’appliance', 'modification', 'Une étiquette de service remplace une liste d’adresses. Il en faut une par service ET par région : quatre routes. Le libellé exact du type de destination (« Étiquette de service ») est à confirmer à l’écran.',
    ['Dans **Itinéraires**, clique **+ Ajouter**.', 'Nom `appservice-canadacentral`, **Type de destination** : **Étiquette de service**, **Étiquette de service de destination** : `AppService.CanadaCentral`.', '**Type de tronçon suivant** : **Appliance virtuelle**, adresse `10.3.2.100`, puis **Ajouter**.', 'Répète pour `AppService.CanadaEast`, `EventHub.CanadaCentral` et `EventHub.CanadaEast` (noms de route au choix, par exemple `eventhub-canadaeast`).'],
    'Quatre routes dont le préfixe est une étiquette de service.',
    { ecran: { blade: 'Ajouter un itinéraire', fil: 'Table de routage > Itinéraires > Ajouter', champs: [{ label: 'Nom de l’itinéraire', valeur: 'appservice-canadacentral', marque: true }, { label: 'Type de destination', valeur: 'Étiquette de service', genre: 'liste', marque: true }, { label: 'Étiquette de service de destination', valeur: 'AppService.CanadaCentral', genre: 'liste', marque: true }, { label: 'Type de tronçon suivant', valeur: 'Appliance virtuelle', genre: 'liste' }, { label: 'Adresse du tronçon suivant', valeur: '10.3.2.100' }], bouton: 'Ajouter', note: NOTE_LIB } }),
  gui('Associer la table à DataSubnet', 'interruption', 'À partir d’ici, le trafic de DataSubnet vers Internet et vers ces services part vers l’appliance, qui n’existe pas : il est perdu. C’est la demande du TP.',
    ['Ouvre la table de DataSubnet, menu **Sous-réseaux**, **+ Associer**.', 'Choisis le réseau virtuel VNET2 et le sous-réseau DataSubnet, puis **OK**.'],
    'DataSubnet apparaît dans la liste des sous-réseaux de la table.',
    { ecran: { blade: 'Associer un sous-réseau', fil: 'Table de routage > Sous-réseaux > Associer', champs: [{ label: 'Réseau virtuel', valeur: 'VNET2', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'DataSubnet', genre: 'liste', marque: true }], bouton: 'OK', note: NOTE_LIB } }),
  gui('Relire les routes des deux tables', 'lecture', 'Capture ces deux listes pour le rapport : elles prouvent la configuration.',
    ['Ouvre chaque table, menu **Itinéraires**, et fais une capture d’écran de la liste.', 'Compte : 2 routes pour la table VMSubnet, 5 pour celle de DataSubnet.'],
    'Table VMSubnet : 2 routes. Table DataSubnet : 5 routes (Internet et quatre étiquettes).',
    { ecran: { blade: 'Table de routage — Itinéraires', fil: 'Accueil > Tables de routage > rt-datasubnet > Itinéraires', champs: [{ label: 'Itinéraire 1', valeur: 'internet-vers-appliance — 0.0.0.0/0', genre: 'lecture' }, { label: 'Itinéraire 2', valeur: 'appservice-canadacentral', genre: 'lecture' }, { label: 'Itinéraires 3 à 5', valeur: 'AppService.CanadaEast, EventHub.…', genre: 'lecture', marque: true }], note: NOTE_LIB } }),
];

const assoc = (vnetId, ss, tbl) => [
  ps(`$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{${vnetId}}}`),
  ps(`$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{${tbl}}}`),
  ps(`$s = Get-AzVirtualNetworkSubnetConfig -Name ${ss} -VirtualNetwork $vn`),
  ps('$s.RouteTable = $rt'),
  ps('$vn | Set-AzVirtualNetwork'),
];

const PS_TP2 = [
  PS_CTX,
  mod('Créer la table des sous-réseaux VMSubnet', 'Une table et ses routes appartiennent au même abonnement et à la même région que les sous-réseaux qui l’utilisent.',
    [ps('New-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableVm}} -Location {{region}}')], 'Un objet table de routage avec ProvisioningState = Succeeded.'),
  mod('Ajouter les deux routes de la table VMSubnet', '0.0.0.0/0 vers la passerelle, et la plage interdite vers None (paquets abandonnés). Add-AzRouteConfig modifie l’objet en mémoire ; Set-AzRouteTable l’enregistre.',
    [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableVm}}'),
      ps('Add-AzRouteConfig -Name vers-passerelle -RouteTable $rt -AddressPrefix 0.0.0.0/0 -NextHopType VirtualNetworkGateway'),
      ps('Add-AzRouteConfig -Name plage-supprimee -RouteTable $rt -AddressPrefix {{plage}} -NextHopType None'),
      ps('Set-AzRouteTable -RouteTable $rt')],
    'La table avec ses deux routes.'),
  itr('Associer la table aux deux VMSubnet', 'Un VMSubnet par VNet : la table s’applique à chacun. On affecte la table au sous-réseau puis on enregistre le VNet.',
    [...assoc('vnet1', 'VMSubnet', 'tableVm'), ...assoc('vnet2', 'VMSubnet', 'tableVm')],
    'Chaque VMSubnet affiche la table de routage.', { important: 'Cette table envoie le trafic sortant vers une passerelle : sans passerelle de réseau virtuel, il est perdu. Le TP le demande ainsi.' }),
  mod('Créer la table de DataSubnet', 'Une seconde table : 0.0.0.0/0 est déjà pris par la première.',
    [ps('New-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableData}} -Location {{region}}')], 'Un objet table de routage avec ProvisioningState = Succeeded.'),
  mod('Ajouter Internet vers l’appliance', 'Le tronçon VirtualAppliance demande l’adresse de l’appliance (-NextHopIpAddress).',
    [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableData}}'),
      ps('Add-AzRouteConfig -Name internet-vers-appliance -RouteTable $rt -AddressPrefix 0.0.0.0/0 -NextHopType VirtualAppliance -NextHopIpAddress {{saut}}'),
      ps('Set-AzRouteTable -RouteTable $rt')],
    'La table avec la route vers l’appliance.'),
  mod('Ajouter App Service et Event Hubs vers l’appliance', 'Une étiquette de service remplace une liste d’adresses : préfixe = nom de l’étiquette suivi de la région, une route par service et par région (quatre routes).',
    [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableData}}'),
      ps('Add-AzRouteConfig -Name appservice-canadacentral -RouteTable $rt -AddressPrefix AppService.CanadaCentral -NextHopType VirtualAppliance -NextHopIpAddress {{saut}}'),
      ps('Add-AzRouteConfig -Name appservice-canadaeast -RouteTable $rt -AddressPrefix AppService.CanadaEast -NextHopType VirtualAppliance -NextHopIpAddress {{saut}}'),
      ps('Add-AzRouteConfig -Name eventhub-canadacentral -RouteTable $rt -AddressPrefix EventHub.CanadaCentral -NextHopType VirtualAppliance -NextHopIpAddress {{saut}}'),
      ps('Add-AzRouteConfig -Name eventhub-canadaeast -RouteTable $rt -AddressPrefix EventHub.CanadaEast -NextHopType VirtualAppliance -NextHopIpAddress {{saut}}'),
      ps('Set-AzRouteTable -RouteTable $rt')],
    'La table avec cinq routes au total.',
    { important: 'Étiquette de service dans -AddressPrefix : prise en charge par les versions récentes du module Az.Network, à confirmer (Get-Help Add-AzRouteConfig). Si elle est refusée, crée ces quatre routes dans le portail (type de destination « Étiquette de service »).' }),
  itr('Associer la table à DataSubnet', 'À partir d’ici, le trafic de DataSubnet vers Internet et vers ces services part vers l’appliance, qui n’existe pas : il est perdu. C’est la demande du TP.',
    assoc('vnet2', 'DataSubnet', 'tableData'), 'DataSubnet affiche la table de routage.'),
  lec('Relire les routes des deux tables', 'Capture ces deux listes pour le rapport : elles prouvent la configuration.',
    [ps('(Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableVm}}).Routes | Format-Table Name, AddressPrefix, NextHopType, NextHopIpAddress'),
      ps('(Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableData}}).Routes | Format-Table Name, AddressPrefix, NextHopType, NextHopIpAddress')],
    'Table VMSubnet : 2 routes. Table DataSubnet : 5 routes (Internet et quatre étiquettes).', { verification: true }),
];

// ===========================================================================
// 3. Point de service du stockage
// ===========================================================================
const GUI_SERVICE = [
  gui('Activer le point de service sur le sous-réseau', 'modification', 'Azure ajoute à la table du sous-réseau les routes vers le service de stockage. L’opération peut prendre jusqu’à 15 minutes.',
    ['Ouvre le réseau virtuel, menu **Sous-réseaux**, puis clique ton sous-réseau.', 'Dans **Points de terminaison de service**, **Services**, choisis **Microsoft.Storage**.', 'Clique **Enregistrer**.'],
    'Le sous-réseau affiche le service Microsoft.Storage (état Réussi après quelques minutes).',
    { ecran: { blade: 'Modifier le sous-réseau', fil: 'Réseau virtuel > Sous-réseaux > default', champs: [{ label: 'Nom', valeur: 'default', genre: 'lecture' }, { label: 'Services', valeur: 'Microsoft.Storage', genre: 'liste', marque: true }], bouton: 'Enregistrer', note: NOTE_LIB } }),
  gui('Autoriser le sous-réseau sur le compte', 'modification', 'Le compte accepte maintenant les connexions qui viennent de ce sous-réseau.',
    ['Ouvre le compte de stockage, **Sécurité + mise en réseau > Mise en réseau**, onglet **Pare-feu et réseaux virtuels**.', 'Sous **Accès au réseau public**, choisis **Activé à partir de réseaux virtuels et d’adresses IP sélectionnés**.', 'Dans **Réseaux virtuels**, clique **+ Ajouter un réseau virtuel existant**, choisis le réseau et le sous-réseau, puis **Ajouter**.', 'Clique **Enregistrer**.'],
    'Le sous-réseau est listé sous Réseaux virtuels, état Activé.',
    { ecran: { blade: 'Mise en réseau — Pare-feu et réseaux virtuels', fil: 'Compte de stockage > Mise en réseau', onglets: ['Pare-feu et réseaux virtuels', 'Connexions de point de terminaison privé'], actif: 0, champs: [{ label: 'Accès au réseau public', valeur: 'Activé à partir de réseaux virtuels et d’adresses IP sélectionnés', genre: 'liste', marque: true }, { label: 'Réseau virtuel / Sous-réseau', valeur: 'vnet1 / default', genre: 'liste', marque: true }], bouton: 'Enregistrer', note: NOTE_LIB } }),
  gui('Autoriser ton adresse publique (garde-fou)', 'modification', 'Sans cette règle, la fermeture de l’accès public te coupe aussi du compte depuis ton poste.',
    ['Dans le même écran, section **Pare-feu**, **Plage d’adresses**.', 'Saisis l’adresse publique de ton poste (par exemple `203.0.113.25`, adresse fictive).', 'Clique **Enregistrer**.'],
    'Ton adresse apparaît dans la liste du pare-feu.',
    { ecran: { blade: 'Mise en réseau — Pare-feu et réseaux virtuels', fil: 'Compte de stockage > Mise en réseau', champs: [{ label: 'Plage d’adresses (pare-feu)', valeur: '203.0.113.25', marque: true }], bouton: 'Enregistrer', note: NOTE_LIB }, important: 'Remplace l’adresse d’exemple par la tienne ; n’y mets jamais une adresse que tu ne connais pas.' }),
  gui('Fermer l’accès public', 'interruption', 'À partir de maintenant, seuls les sous-réseaux et adresses autorisés atteignent le compte. Avec le portail, le choix « réseaux sélectionnés » de l’étape précédente refuse déjà tout le reste : contrôle-le ici.',
    ['Reste sur **Pare-feu et réseaux virtuels** du compte.', 'Vérifie que **Accès au réseau public** est **Activé à partir de réseaux virtuels et d’adresses IP sélectionnés** (et non **Activé à partir de tous les réseaux**).', 'Clique **Enregistrer** si tu as changé quelque chose.'],
    'L’accès par défaut est refusé : seuls le sous-réseau et ton adresse passent.',
    { ecran: { blade: 'Mise en réseau — Pare-feu et réseaux virtuels', fil: 'Compte de stockage > Mise en réseau', champs: [{ label: 'Accès au réseau public', valeur: 'Activé à partir de réseaux virtuels et d’adresses IP sélectionnés', genre: 'liste', marque: true }], bouton: 'Enregistrer', note: NOTE_LIB }, important: 'Les applications qui utilisent le compte depuis un autre réseau seront refusées. Prévois leurs règles avant de fermer.' }),
  gui('Vérifier', 'lecture', 'Relis les règles réseau du compte.',
    ['Rouvre **Mise en réseau > Pare-feu et réseaux virtuels** du compte.', 'Contrôle : accès par défaut refusé, le sous-réseau dans **Réseaux virtuels**, ton adresse dans **Pare-feu**.'],
    'Accès par défaut refusé, sous-réseau et adresse listés.',
    { ecran: { blade: 'Mise en réseau — Pare-feu et réseaux virtuels', fil: 'Compte de stockage > Mise en réseau', champs: [{ label: 'Accès au réseau public', valeur: 'Activé à partir de réseaux virtuels et d’adresses IP sélectionnés', genre: 'lecture' }, { label: 'Réseau virtuel / Sous-réseau', valeur: 'vnet1 / default', genre: 'lecture', marque: true }, { label: 'Plage d’adresses', valeur: '203.0.113.25', genre: 'lecture' }], note: NOTE_LIB } }),
];

const PS_SERVICE = [
  PS_CTX,
  mod('Activer le point de service sur le sous-réseau', 'Azure ajoute à la table du sous-réseau les routes vers le service de stockage. Jusqu’à 15 minutes. On lit le sous-réseau, on réécrit sa configuration avec le service, puis on enregistre le VNet.',
    [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
      ps('$s = Get-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -VirtualNetwork $vn'),
      ps('Set-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -VirtualNetwork $vn -AddressPrefix $s.AddressPrefix -ServiceEndpoint Microsoft.Storage'),
      ps('$vn | Set-AzVirtualNetwork')],
    'Le sous-réseau avec ServiceEndpoints contenant Microsoft.Storage.',
    { important: 'Set-AzVirtualNetworkSubnetConfig peut effacer les propriétés non répétées (groupe de sécurité, table de routage, délégation). Si ton sous-réseau en a, relis-le ensuite avec Get-AzVirtualNetworkSubnetConfig (Get-Help Set-AzVirtualNetworkSubnetConfig) ou active le point dans le portail.' }),
  mod('Autoriser le sous-réseau sur le compte', 'Le compte accepte maintenant les connexions qui viennent de ce sous-réseau.',
    [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
      ps('$s = Get-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -VirtualNetwork $vn'),
      ps('Add-AzStorageAccountNetworkRule -ResourceGroupName {{groupe}} -Name {{compte}} -VirtualNetworkResourceId $s.Id')],
    'La règle de réseau virtuel listée (état Succeeded).'),
  mod('Autoriser ton adresse publique (garde-fou)', 'Sans cette règle, la fermeture de l’accès public te coupe aussi du compte depuis ton poste.',
    [ps('Add-AzStorageAccountNetworkRule -ResourceGroupName {{groupe}} -Name {{compte}} -IPAddressOrRange {{monIp}}')], 'Ta règle d’adresse listée.', { facultatif: true }),
  itr('Fermer l’accès public', 'À partir de maintenant, seuls les sous-réseaux et adresses autorisés atteignent le compte.',
    [ps('Update-AzStorageAccountNetworkRuleSet -ResourceGroupName {{groupe}} -Name {{compte}} -DefaultAction Deny')], 'DefaultAction = Deny.',
    { important: 'Les applications qui utilisent le compte depuis un autre réseau seront refusées. Prévois leurs règles avant de fermer.' }),
  lec('Vérifier', 'Relis les règles réseau du compte.',
    [ps('Get-AzStorageAccountNetworkRuleSet -ResourceGroupName {{groupe}} -Name {{compte}} | Format-List DefaultAction, VirtualNetworkRules, IpRules')],
    'DefaultAction à Deny, VirtualNetworkRules avec ton sous-réseau, IpRules avec ton adresse.', { verification: true }),
];

// ===========================================================================
// 4. Point privé du stockage (blob) et par sous-ressource
// ===========================================================================
const guiPoint = (sous) => {
  const choix = sous
    ? 'Dans **Sous-ressource cible**, choisis la sous-ressource voulue (**blob**, **queue**, **file** ou **table**) : c’est le choix du paramètre de la fiche.'
    : 'Dans **Sous-ressource cible**, choisis **blob** (le service des blobs ; **file** désignerait Azure Files).';
  const valSr = sous ? 'queue' : 'blob';
  const zoneTxt = sous ? 'la zone privatelink de la sous-ressource (par exemple privatelink.queue.core.windows.net)' : 'la zone privatelink.blob.core.windows.net';
  return [
    gui('Créer le point de terminaison privé', 'modification', sous
      ? 'Un point privé ne couvre qu’UNE sous-ressource du compte : il en faut un par service utilisé. Le point reçoit une adresse privée libre du sous-réseau.'
      : 'Azure prend une adresse privée libre dans le sous-réseau et la relie au service « blob » du compte.',
      ['Ouvre le compte de stockage, **Sécurité + mise en réseau > Mise en réseau**, onglet **Connexions de point de terminaison privé**, **+ Point de terminaison privé**.', 'Onglet **Informations de base** : choisis le **Groupe de ressources**, saisis le **Nom** du point et de son interface réseau, puis la **Région** du VNet.', 'Onglet **Ressource** : **Type de ressource** **Microsoft.Storage/storageAccounts**, ton compte.', choix, 'Onglet **Réseau virtuel** : choisis le **Réseau virtuel** et le **Sous-réseau** (non délégué).'],
      'L’assistant arrive à l’onglet DNS avec le réseau choisi.',
      { ecran: { blade: 'Créer un point de terminaison privé', fil: 'Compte de stockage > Mise en réseau > Point de terminaison privé', onglets: ['Informations de base', 'Ressource', 'Réseau virtuel', 'DNS', 'Balises', 'Vérifier + créer'], actif: 1, champs: [{ label: 'Type de ressource', valeur: 'Microsoft.Storage/storageAccounts', genre: 'lecture' }, { label: 'Ressource', valeur: sous ? 'sttardi01' : 'stlab01', genre: 'liste', marque: true }, { label: 'Sous-ressource cible', valeur: valSr, genre: 'liste', marque: true }], bouton: 'Suivant : Réseau virtuel', note: sous ? 'Exemple avec queue : choisis la sous-ressource que ta fiche demande. ' + NOTE_LIB : NOTE_LIB } }),
    gui('Intégrer le point à la zone DNS privée', 'modification', `Le nom public du compte doit se résoudre en adresse PRIVÉE depuis le VNet : l’assistant crée ${zoneTxt}, la lie au VNet et inscrit le point.`,
      ['Onglet **DNS** : **Intégrer à une zone DNS privée** : **Oui**.', 'Laisse la **Zone DNS privée** proposée ; si tu en as déjà une pour ce service, choisis-la.', 'Clique **Vérifier + créer**, puis **Créer**.'],
      'Le point est déployé ; la zone DNS privée et son lien au VNet existent.',
      { ecran: { blade: 'Créer un point de terminaison privé', fil: 'Compte de stockage > Mise en réseau > Point de terminaison privé', onglets: ['Informations de base', 'Ressource', 'Réseau virtuel', 'DNS', 'Balises', 'Vérifier + créer'], actif: 3, champs: [{ label: 'Intégrer à une zone DNS privée', valeur: 'Oui', genre: 'liste', marque: true }, { label: 'Zone DNS privée', valeur: sous ? 'privatelink.queue.core.windows.net' : ZP, genre: 'liste' }], bouton: 'Vérifier + créer', note: NOTE_LIB } }),
    gui('Contrôler l’état du point de terminaison', 'lecture', 'La connexion doit être approuvée et l’état réussi.',
      ['Ouvre **Point de terminaison privé** dans la barre de recherche, puis clique ton point.', 'Lis **État de la connexion** et **État d’approvisionnement**, puis **Interface réseau** pour voir l’adresse privée.'],
      'État de la connexion « Approuvé », approvisionnement « Réussi », adresse privée du sous-réseau.',
      { ecran: { blade: 'Point de terminaison privé — Vue d’ensemble', fil: 'Accueil > Points de terminaison privés > ton point', champs: [{ label: 'État de la connexion', valeur: 'Approuvé', genre: 'lecture', marque: true }, { label: 'État d’approvisionnement', valeur: 'Réussi', genre: 'lecture' }], note: NOTE_LIB } }),
    gui('Contrôler la résolution depuis le VNet', 'lecture', 'À faire DANS une machine du VNet : le nom du compte doit se résoudre en adresse privée. Depuis ton poste, le même nom donne toujours l’adresse publique : c’est normal.',
      ['Connecte-toi à une machine du VNet (Bastion ou bureau à distance).', sous ? 'Dans un terminal, tape `nslookup` suivi du nom du compte et de `.queue.core.windows.net` (ou de la sous-ressource choisie).' : 'Dans un terminal, tape `nslookup` suivi du nom du compte et de `.blob.core.windows.net`.', 'Contrôle que l’adresse est privée (10.x.x.x).'],
      'Un alias vers le nom privatelink et une adresse privée du sous-réseau.',
      { ecran: { blade: 'Terminal de la machine du VNet', fil: 'Machine virtuelle > session ouverte', champs: [{ label: 'Commande', valeur: sous ? 'nslookup sttardi01.queue.core.windows.net' : 'nslookup stlab01.blob.core.windows.net', marque: true }, { label: 'Réponse attendue', valeur: '10.x.x.x (privée)', genre: 'lecture' }], note: NOTE_LIB } }),
  ];
};

const psPoint = (sous) => {
  const g = sous ? '{{sousRessource}}' : 'blob';
  const zn = sous ? 'privatelink.{{sousRessource}}.core.windows.net' : ZP;
  const dns = sous ? '{{compte}}.{{sousRessource}}.core.windows.net' : '{{compte}}.blob.core.windows.net';
  return [
    PS_CTX,
    mod('Créer le point de terminaison privé', sous ? 'Le groupe (« GroupId ») est la sous-ressource visée : blob, queue, file ou table.' : 'Azure prend une adresse privée libre dans le sous-réseau ; le groupe « blob » désigne le stockage d’objets.',
      [ps('$cpt = Get-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}}'),
        ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
        ps('$sub = Get-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -VirtualNetwork $vn'),
        ps(`$lien = New-AzPrivateLinkServiceConnection -Name {{connexion}} -PrivateLinkServiceId $cpt.Id -GroupId ${g}`),
        ps('New-AzPrivateEndpoint -ResourceGroupName {{groupe}} -Name {{pointPrive}} -Location $vn.Location -Subnet $sub -PrivateLinkServiceConnection $lien')],
      'Le point privé avec une connexion « Approved » et ProvisioningState = Succeeded.'),
    mod('Créer la zone DNS privée', 'Le nom public du compte doit se résoudre en adresse PRIVÉE depuis le VNet : c’est le rôle de cette zone au nom imposé par Azure.',
      [ps(`New-AzPrivateDnsZone -ResourceGroupName {{groupe}} -Name ${zn}`)], 'La zone, avec son nom.'),
    mod('Lier la zone au VNet', 'Sans lien, les machines du VNet continuent de résoudre l’adresse publique.',
      [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
        ps(`New-AzPrivateDnsVirtualNetworkLink -ResourceGroupName {{groupe}} -ZoneName ${zn} -Name ${sous ? 'lien-{{sousRessource}}-{{vnet}}' : 'lien-privatelink'} -VirtualNetworkId $vn.Id`)],
      'Le lien avec VirtualNetworkLinkState = Completed.'),
    mod('Inscrire le point dans la zone', 'Un groupe de zones DNS crée et tient à jour l’enregistrement du compte dans la zone privée.',
      [ps(`$zone = Get-AzPrivateDnsZone -ResourceGroupName {{groupe}} -Name ${zn}`),
        ps(`$cfg = New-AzPrivateDnsZoneConfig -Name ${g} -PrivateDnsZoneId $zone.ResourceId`),
        ps('New-AzPrivateDnsZoneGroup -ResourceGroupName {{groupe}} -PrivateEndpointName {{pointPrive}} -Name groupe-dns -PrivateDnsZoneConfig $cfg')],
      'Le groupe de zones avec la zone configurée.'),
    lec('Contrôler l’état du point de terminaison', 'La connexion doit être approuvée et l’état réussi.',
      [ps('$pe = Get-AzPrivateEndpoint -ResourceGroupName {{groupe}} -Name {{pointPrive}}'),
        ps('$pe.ProvisioningState'),
        ps('$pe.PrivateLinkServiceConnections | Format-List Name, @{n="Etat";e={$_.PrivateLinkServiceConnectionState.Status}}')],
      'Succeeded, puis une connexion à l’état « Approved ».'),
    lec('Contrôler la résolution depuis le VNet', 'À lancer DANS une machine du VNet : le nom du compte doit se résoudre en adresse privée du sous-réseau.',
      [ps(`Resolve-DnsName ${dns}`)], 'Un alias (CNAME) vers le nom privatelink et une adresse privée du sous-réseau (10.x.x.x).',
      { verification: true, important: 'Depuis ton poste, hors du VNet, le même nom donne toujours l’adresse publique : c’est normal.' }),
  ];
};

const VER_POINT = ['Depuis une machine du VNet, le nom du compte se résout en adresse privée ; depuis Internet, l’accès est refusé une fois l’accès public fermé.'];
const VER_SOUS = ['Pour chaque sous-ressource utilisée (blob et queue dans le TP2), le nom du service se résout en adresse privée depuis le VNet.'];

export const MULTI_ROUTAGE = {
  'cours-az-table-routage-gerer': {
    gui: { privileges: PRIV, etapes: GUI_GERER, verification: ['Les routes effectives de la machine montrent les routes attendues (source Utilisateur, état Actif), et le prochain saut correspond à la route voulue.'], retour: 'Pour défaire une modification de route : remets l’ancien tronçon suivant dans **Itinéraires**. Une table ou une route supprimée se recrée avec la fiche de création.' },
    powershell: { privileges: PRIV, etapes: PS_GERER, verification: ['Les routes effectives de la machine montrent les routes attendues (source User, état Active), et le prochain saut correspond à la route voulue.'], retour: 'Pour défaire une modification de route : remets l’ancien tronçon avec Set-AzRouteConfig puis Set-AzRouteTable. Une table ou une route supprimée se recrée avec la fiche de création.',
      depannage: [
        { symptome: 'La suppression de la table est refusée', cause: 'La table est encore associée à au moins un sous-réseau.', action: 'Dissocie-la de chaque sous-réseau (étape de dissociation), puis supprime-la.' },
        { symptome: 'La dissociation ne change rien', cause: 'Le VNet n’a pas été enregistré après la modification du sous-réseau.', action: 'Relance « $vn | Set-AzVirtualNetwork » ou dissocie la table dans le portail.' },
      ] },
  },
  'cours-az-routes-etiquettes-service': {
    gui: { privileges: PRIV, etapes: GUI_TP2, verification: ['La table des VMSubnet a 2 routes (0.0.0.0/0 vers la passerelle, plage vers Aucun), celle de DataSubnet en a 5 vers l’appliance 10.3.2.100, et chaque table est associée à ses sous-réseaux.'], retour: 'Pour défaire : dissocie chaque sous-réseau (menu **Sous-réseaux** de la table, **Dissocier**), puis supprime les routes et les tables avec la fiche de gestion des tables de routage.' },
    powershell: { privileges: PRIV, etapes: PS_TP2, verification: ['La table des VMSubnet a 2 routes (0.0.0.0/0 vers la passerelle, plage vers None), celle de DataSubnet en a 5 vers l’appliance 10.3.2.100, et chaque table est associée à ses sous-réseaux.'], retour: 'Pour défaire : dissocie chaque sous-réseau (« $s.RouteTable = $null » puis Set-AzVirtualNetwork, ou le portail), puis supprime les routes et les tables avec la fiche de gestion des tables de routage.',
      depannage: [
        { symptome: 'Le nom d’étiquette est refusé comme préfixe', cause: 'Le nom ou la région de l’étiquette est mal écrit, ou la version du module Az.Network ne la prend pas en charge.', action: 'Vérifie l’écriture exacte (AppService.CanadaCentral), mets à jour le module, ou crée la route dans le portail (type de destination « Étiquette de service »).' },
      ] },
  },
  'cours-az-point-service-stockage': {
    gui: { privileges: PRIV, etapes: GUI_SERVICE, verification: ['Le compte refuse l’accès depuis un réseau non autorisé et l’accepte depuis le sous-réseau.'], retour: 'Pour rouvrir : **Accès au réseau public** à **Activé à partir de tous les réseaux** ; pour retirer le sous-réseau : retire-le de la liste **Réseaux virtuels** du compte.' },
    powershell: { privileges: PRIV, etapes: PS_SERVICE, verification: ['Le compte refuse l’accès depuis un réseau non autorisé et l’accepte depuis le sous-réseau.'], retour: 'Pour rouvrir : Update-AzStorageAccountNetworkRuleSet avec -DefaultAction Allow ; pour retirer le sous-réseau : Remove-AzStorageAccountNetworkRule.' },
  },
  'cours-az-point-prive-stockage': {
    gui: { privileges: PRIV, etapes: guiPoint(false), verification: VER_POINT, retour: 'Pour défaire : supprime le point de terminaison privé (liste **Points de terminaison privés**), puis le lien de la zone DNS privée (menu **Liens de réseau virtuel**) et la zone elle-même.' },
    powershell: { privileges: PRIV, etapes: psPoint(false), verification: VER_POINT, retour: 'Pour défaire : Remove-AzPrivateEndpoint, puis Remove-AzPrivateDnsVirtualNetworkLink et Remove-AzPrivateDnsZone.',
      depannage: [{ symptome: 'Le nom du compte se résout encore en adresse publique', cause: 'La zone privée n’est pas liée au VNet de la machine, ou le groupe de zones DNS n’existe pas.', action: 'Relis le lien (Get-AzPrivateDnsVirtualNetworkLink) et le groupe de zones du point de terminaison.' }] },
  },
  'cours-az-point-prive-stockage-sous-ressource': {
    gui: { privileges: PRIV, etapes: guiPoint(true), verification: VER_SOUS, retour: 'Pour défaire : supprime le point de terminaison privé puis, s’il n’est plus utilisé, le lien et la zone DNS privée.' },
    powershell: { privileges: PRIV, etapes: psPoint(true), verification: VER_SOUS, retour: 'Pour défaire : Remove-AzPrivateEndpoint puis, s’il n’est plus utilisé, le lien et la zone DNS privée.',
      depannage: [{ symptome: 'La file répond mais le conteneur non (ou l’inverse)', cause: 'Il manque le point de terminaison privé d’une des deux sous-ressources.', action: 'Refais la fiche avec l’autre sous-ressource : il faut un point par service utilisé.' }] },
  },
};
