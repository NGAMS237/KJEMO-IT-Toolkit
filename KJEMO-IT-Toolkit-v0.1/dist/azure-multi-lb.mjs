/**
 * azure-multi-lb.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Méthodes « Interface graphique » (portail, avec écrans reconstitués) et
 * « PowerShell » (module Az) des deux fiches d'équilibrage existantes :
 *   cours-az-lb-creer  (Créer un équilibreur de charge public)
 *   cours-az-lb-etat   (Lire la configuration et la santé d'un équilibreur)
 * La méthode Azure CLI de ces fiches n'est pas touchée (cours-fiches-azure.mjs).
 * Rien n'est exécuté dans Azure ; libellés et options douteux : dans `important`.
 */
import { lec, mod, ps, gui } from './cours-outils.mjs';

const PRIV = 'Compte Azure avec le rôle Contributeur sur le groupe de ressources visé ; connecté par toi-même (portail ou `Connect-AzAccount`).';
const PRIV_LECTURE = 'Compte Azure avec le rôle Lecteur sur le groupe de ressources ; connecté par toi-même (portail ou `Connect-AzAccount`).';
const LIBELLES = 'Libellés du portail reconstitués de mémoire : si un nom diffère chez toi, suis le sens de l’étape.';

const c = (label, valeur, marque = false, genre = 'texte') => ({ label, valeur, genre, ...(marque ? { marque: true } : {}) });
const l = (label, valeur) => c(label, valeur, false, 'lecture');
const li = (label, valeur, marque = false) => c(label, valeur, marque, 'liste');

const CTX_PS = lec('Se connecter et vérifier l’abonnement', 'Connecte-toi toi-même (fenêtre de connexion) et confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
  [ps('Connect-AzAccount'), ps('Get-AzContext | Format-List Name, Subscription')], 'Le nom de l’abonnement actif.');

const ONGLETS = ['Informations de base', 'Configuration IP front-end', 'Pools principaux', 'Règles de trafic entrant', 'Règles de trafic sortant', 'Balises', 'Vérifier + créer'];

// ---------------------------------------------------------------------------
// Créer un équilibreur de charge public
// ---------------------------------------------------------------------------
const CREER_GUI = [
  gui('Créer l’équilibreur (Informations de base)', 'modification', `Le choix « Public » donne une frontale avec une adresse publique. La référence Standard est celle à utiliser (Basic est retirée). ${LIBELLES}`,
    ['Cherche **Équilibreurs de charge**, ouvre le service puis clique **+ Créer**.', 'Onglet **Informations de base** : choisis ton **Abonnement** et ton **Groupe de ressources**, saisis le **Nom** `lb-web` et la **Région**.', 'Choisis **Référence SKU** : **Standard**, **Type** : **Public**, **Niveau** : **Régional**.', 'Clique **Suivant : Configuration IP front-end**.'],
    'Les informations de base sont remplies ; le type est « Public ».',
    { ecran: { blade: 'Créer un équilibreur de charge', fil: 'Accueil > Équilibreurs de charge > Créer', onglets: ONGLETS, actif: 0, champs: [li('Groupe de ressources', 'rg-lab'), c('Nom', 'lb-web', true), li('Région', '(Canada) Canada Centre'), li('Référence SKU', 'Standard', true), li('Type', 'Public', true), li('Niveau', 'Régional')], bouton: 'Suivant : Configuration IP front-end' } }),
  gui('Créer l’adresse IP publique frontale', 'modification', 'La frontale est l’adresse que les clients utilisent. Le portail crée l’adresse publique avec elle.',
    ['Onglet **Configuration IP front-end**, clique **+ Ajouter une configuration IP front-end**.', 'Saisis le **Nom** `frontend`, **Type d’adresse IP** : **Adresse IP**, puis **Adresse IP publique** : **Créer**, avec le **Nom** `pip-lb`, **Référence SKU** **Standard**, **Affectation** **Statique**.', 'Clique **Enregistrer**.'],
    'La frontale « frontend » apparaît avec l’adresse publique pip-lb.',
    { ecran: { blade: 'Ajouter une configuration IP front-end', fil: 'Créer un équilibreur de charge > Configuration IP front-end', champs: [c('Nom', 'frontend', true), li('Version IP', 'IPv4'), li('Adresse IP publique', 'Créer : pip-lb', true), li('Référence SKU', 'Standard'), li('Affectation', 'Statique')], bouton: 'Enregistrer' } }),
  gui('Créer le pool de serveurs', 'modification', 'Le pool regroupe les interfaces réseau des machines qui répondent.',
    ['Onglet **Pools principaux**, clique **+ Ajouter un pool principal**.', 'Saisis le **Nom** `pool`, **Configuration du pool principal** : **Carte réseau**.', 'Clique **+ Ajouter**, coche les machines du réseau virtuel, puis **Ajouter** et **Enregistrer**.'],
    'Le pool « pool » existe, avec ses machines si tu les as cochées.',
    { ecran: { blade: 'Ajouter un pool principal', fil: 'Créer un équilibreur de charge > Pools principaux', champs: [c('Nom', 'pool', true), li('Réseau virtuel', 'vnet1'), li('Configuration du pool principal', 'Carte réseau', true), l('Machines', 'vm1, vm2')], bouton: 'Enregistrer' } }),
  gui('Créer la sonde et la règle de répartition', 'modification', 'La sonde vérifie chaque serveur ; la règle relie une adresse et un port frontaux à un pool et à un port de serveur.',
    ['Onglet **Règles de trafic entrant**, clique **+ Ajouter une règle d’équilibrage de charge**.', 'Saisis le **Nom** `regle-web`, **Protocole** : **TCP**, **Port** `80`, **Port principal** `80`, avec la frontale et le pool créés.', 'Sous **Sonde d’intégrité**, clique **Créer nouveau** : **Nom** `sonde-tcp`, **Protocole** **TCP**, **Port** `80`, puis **Enregistrer** deux fois.'],
    'La règle apparaît avec sa sonde TCP.',
    { ecran: { blade: 'Ajouter une règle d’équilibrage de charge', fil: 'Créer un équilibreur de charge > Règles de trafic entrant', champs: [c('Nom', 'regle-web', true), li('Adresse IP front-end', 'frontend'), li('Pool principal', 'pool'), li('Protocole', 'TCP'), c('Port', '80', true), c('Port principal', '80', true), li('Sonde d’intégrité', 'sonde-tcp (TCP 80)', true)], bouton: 'Enregistrer' } }),
  gui('Vérifier et créer', 'modification', 'Le portail contrôle l’ensemble avant de déployer.',
    ['Clique l’onglet **Vérifier + créer** et attends « Validation réussie ».', 'Clique **Créer** et attends la fin du déploiement.'],
    'Le déploiement se termine : « Votre déploiement est terminé ».',
    { ecran: { blade: 'Créer un équilibreur de charge', fil: 'Accueil > Équilibreurs de charge > Créer', onglets: ONGLETS, actif: 6, champs: [l('Validation', 'Validation réussie'), l('Type', 'Public'), l('Frontale', 'pip-lb (IP publique Standard)')], bouton: 'Créer' } }),
  gui('Ajouter un serveur au pool', 'modification', 'Si le pool était vide, ajoute maintenant chaque machine : l’équilibreur répartit alors aussi vers elle. Refais l’ajout pour chaque machine.',
    ['Ouvre l’équilibreur, menu **Paramètres > Pools principaux**, clique le pool.', 'Clique **+ Ajouter**, choisis la machine (son interface réseau), puis **Enregistrer**.'],
    'Les machines du pool sont listées avec leur adresse privée.',
    { ecran: { blade: 'Pool principal : pool', fil: 'lb-web > Paramètres > Pools principaux > pool', champs: [li('Configuration du pool principal', 'Carte réseau'), l('vm1', '10.0.0.4'), l('vm2', '10.0.0.5')], bouton: 'Enregistrer' },
      important: 'L’équilibreur Standard est fermé par défaut : dans le groupe de sécurité réseau des machines, autorise le port 80 (et l’étiquette de service AzureLoadBalancer pour la sonde).' }),
  gui('Vérifier', 'lecture', 'Relis l’équilibreur, ses règles et ses sondes, puis teste l’adresse publique.',
    ['Ouvre l’équilibreur : la **Vue d’ensemble** donne la **Référence SKU** et l’**Adresse IP publique**.', 'Contrôle **Règles d’équilibrage de charge** et **Sondes d’intégrité**.', 'Ouvre l’adresse publique dans un navigateur : la page d’un serveur du pool s’affiche.'],
    'L’équilibreur est Standard, la règle est sur le port 80 et la sonde est TCP.',
    { ecran: { blade: 'lb-web — Vue d’ensemble', fil: 'Accueil > Équilibreurs de charge > lb-web', champs: [l('Référence SKU', 'Standard'), l('Adresse IP publique', '(adresse de pip-lb)'), l('Règles', 'regle-web : 80 vers 80'), l('Sondes', 'sonde-tcp : TCP 80')], bouton: 'Actualiser' } }),
];

const CREER_PS = [
  CTX_PS,
  mod('Créer l’adresse IP publique frontale', 'Une adresse publique en frontale fait un équilibreur public ; une adresse privée en ferait un équilibreur interne.',
    [ps('New-AzPublicIpAddress -ResourceGroupName {{groupe}} -Name {{ipPublique}} -Location {{region}} -Sku Standard -AllocationMethod Static')],
    'L’adresse avec une valeur IpAddress.'),
  mod('Créer l’équilibreur, sa frontale et son pool', 'Une séquence crée la frontale, le pool (vide pour l’instant) et l’équilibreur. La référence Standard est fermée par défaut : un groupe de sécurité réseau doit autoriser le trafic.',
    [ps('$pip = Get-AzPublicIpAddress -ResourceGroupName {{groupe}} -Name {{ipPublique}}'),
      ps('$fe = New-AzLoadBalancerFrontendIpConfig -Name frontend -PublicIpAddress $pip'),
      ps('$pool = New-AzLoadBalancerBackendAddressPoolConfig -Name pool'),
      ps('New-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}} -Location {{region}} -Sku Standard -FrontendIpConfiguration $fe -BackendAddressPool $pool')],
    'L’équilibreur avec ProvisioningState = Succeeded.'),
  mod('Créer la sonde d’intégrité', 'La sonde TCP réussit si la connexion s’établit sur le port ; un serveur qui échoue ne reçoit plus de nouvelles connexions.',
    [ps('$lb = Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}'),
      ps('$lb | Add-AzLoadBalancerProbeConfig -Name sonde-tcp -Protocol Tcp -Port {{port}} -IntervalInSeconds 5 -ProbeCount 2'),
      ps('$lb | Set-AzLoadBalancer')],
    'La liste des sondes contient sonde-tcp.', { important: 'Le paramètre -ProbeCount de Add-AzLoadBalancerProbeConfig : vérifie sa valeur autorisée avec Get-Help.' }),
  mod('Créer la règle de répartition', 'La règle relie une adresse et un port frontaux à un pool et à un port de serveur, et nomme la sonde.',
    [ps('$lb = Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}'),
      ps('$fe = Get-AzLoadBalancerFrontendIpConfig -LoadBalancer $lb -Name frontend'),
      ps('$pool = Get-AzLoadBalancerBackendAddressPoolConfig -LoadBalancer $lb -Name pool'),
      ps('$sonde = Get-AzLoadBalancerProbeConfig -LoadBalancer $lb -Name sonde-tcp'),
      ps('$lb | Add-AzLoadBalancerRuleConfig -Name regle-web -Protocol Tcp -FrontendPort {{port}} -BackendPort {{port}} -FrontendIpConfiguration $fe -BackendAddressPool $pool -Probe $sonde'),
      ps('$lb | Set-AzLoadBalancer')],
    'La règle regle-web avec sa sonde.'),
  mod('Ajouter un serveur au pool', 'L’interface réseau de la machine rejoint le pool ; l’équilibreur répartit aussi vers elle.',
    [ps('$lb = Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}'),
      ps('$pool = Get-AzLoadBalancerBackendAddressPoolConfig -LoadBalancer $lb -Name pool'),
      ps('$nic = Get-AzNetworkInterface -ResourceGroupName {{groupe}} -Name {{nic}}'),
      ps('$nic.IpConfigurations[0].LoadBalancerBackendAddressPools = $pool'),
      ps('$nic | Set-AzNetworkInterface')],
    'L’interface avec le pool dans sa configuration IP.', { important: 'Cette écriture remplace les pools déjà associés à l’interface ; refais l’étape pour chaque machine du pool.' }),
  lec('Vérifier', 'Relis l’équilibreur, ses règles et ses sondes.',
    [ps('$lb = Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}'),
      ps('$lb | Format-List Name, ProvisioningState, @{n="Sku";e={$_.Sku.Name}}'),
      ps('$lb.LoadBalancingRules | Format-Table Name, Protocol, FrontendPort, BackendPort'),
      ps('$lb.Probes | Format-Table Name, Protocol, Port')],
    'L’équilibreur à l’état Succeeded, la règle sur le port choisi et la sonde TCP.', { verification: true }),
];

// ---------------------------------------------------------------------------
// Lire la configuration et la santé
// ---------------------------------------------------------------------------
const ETAT_GUI = [
  gui('Vue d’ensemble', 'lecture', 'L’équilibreur, sa référence (Basic ou Standard) et son état.',
    ['Cherche **Équilibreurs de charge** et ouvre ton équilibreur.', 'Dans **Vue d’ensemble**, lis la **Référence SKU**, la **Région** et l’**Adresse IP**.'],
    'Le nom, la région, la référence et l’adresse de la frontale.',
    { ecran: { blade: 'lb-web — Vue d’ensemble', fil: 'Accueil > Équilibreurs de charge > lb-web', champs: [l('Référence SKU', 'Standard'), l('Région', 'Canada Centre'), l('Adresse IP', '(publique ou privée)')], bouton: 'Actualiser' } }),
  gui('Lire la frontale', 'lecture', 'L’adresse que les clients utilisent : publique ou privée.',
    ['Menu **Paramètres > Configuration IP front-end**.', 'Lis le nom de la frontale et son adresse.'],
    'Le nom de la frontale et son adresse.',
    { ecran: { blade: 'Configuration IP front-end', fil: 'lb-web > Paramètres > Configuration IP front-end', champs: [l('Nom', 'frontend'), l('Adresse IP', '(adresse publique ou privée)'), l('Règles qui l’utilisent', 'regle-web')], bouton: 'Actualiser' } }),
  gui('Lire le pool de serveurs', 'lecture', 'Les interfaces et adresses qui reçoivent le trafic.',
    ['Menu **Paramètres > Pools principaux**, clique le pool.', 'Compare les machines listées à celles que tu attends.'],
    'Le nom du pool et ses membres.',
    { ecran: { blade: 'Pool principal : pool', fil: 'lb-web > Paramètres > Pools principaux > pool', champs: [l('vm1', '10.0.0.4 (en cours d’exécution)'), l('vm2', '10.0.0.5 (en cours d’exécution)')], bouton: 'Actualiser' } }),
  gui('Lire les règles', 'lecture', 'Quel port frontal va vers quel port de serveur, avec quelle sonde.',
    ['Menu **Paramètres > Règles d’équilibrage de charge**.', 'Pour chaque règle, lis le protocole, les ports, le pool et la sonde.'],
    'Une ligne par règle avec le protocole et les ports.',
    { ecran: { blade: 'Règles d’équilibrage de charge', fil: 'lb-web > Paramètres > Règles d’équilibrage de charge', champs: [l('regle-web', 'TCP 80 vers 80'), l('Pool', 'pool'), l('Sonde', 'sonde-tcp')], bouton: 'Actualiser' } }),
  gui('Lire les sondes et la santé', 'lecture', 'Le protocole, le port et, pour HTTP, le chemin testé ; le portail trace aussi l’état de la sonde dans le temps.',
    ['Menu **Paramètres > Sondes d’intégrité** : protocole, port, chemin.', 'Menu **Supervision > Métriques**, choisis la métrique **État de la sonde d’intégrité** : 100 % = tous les serveurs sains, moins = au moins un serveur retiré.'],
    'Une ligne par sonde ; la métrique d’état de la sonde est à 100 % si tout va bien.',
    { ecran: { blade: 'Métriques', fil: 'lb-web > Supervision > Métriques', champs: [li('Métrique', 'État de la sonde d’intégrité', true), li('Agrégation', 'Moyenne'), l('Dernière valeur', '100 %')], note: 'Nom de la métrique reconstitué : à confirmer dans le portail.' } }),
];

const ETAT_PS = [
  CTX_PS,
  lec('Vue d’ensemble', 'L’équilibreur, sa référence (Basic ou Standard) et son état.',
    [ps('Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}} | Format-List Name, Location, ProvisioningState, @{n="Sku";e={$_.Sku.Name}}')],
    'Le nom, la région, l’état de provisionnement et la référence.'),
  lec('Lire la frontale', 'L’adresse que les clients utilisent : publique ou privée.',
    [ps('(Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}).FrontendIpConfigurations | Format-Table Name, PrivateIpAddress, PrivateIpAllocationMethod')],
    'Le nom de la frontale ; l’adresse privée est vide pour une frontale publique.', { important: 'Pour une frontale publique, l’adresse se lit sur la ressource IP publique : Get-AzPublicIpAddress | Format-Table Name, IpAddress.' }),
  lec('Lire le pool de serveurs', 'Les interfaces et adresses qui reçoivent le trafic.',
    [ps('(Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}).BackendAddressPools | Format-Table Name'),
      ps('(Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}).BackendAddressPools.BackendIpConfigurations | Format-Table Id')],
    'Le nom du pool et l’identifiant des configurations IP qui en sont membres.'),
  lec('Lire les règles', 'Quel port frontal va vers quel port de serveur.',
    [ps('(Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}).LoadBalancingRules | Format-Table Name, Protocol, FrontendPort, BackendPort')],
    'Une ligne par règle avec le protocole et les ports.'),
  lec('Lire les sondes', 'Le protocole, le port et, pour HTTP, le chemin testé.',
    [ps('(Get-AzLoadBalancer -ResourceGroupName {{groupe}} -Name {{lb}}).Probes | Format-Table Name, Protocol, Port, RequestPath, IntervalInSeconds')],
    'Une ligne par sonde.', { verification: true }),
];

export const MULTI_LB = {
  'cours-az-lb-creer': {
    gui: { privileges: PRIV, etapes: CREER_GUI, verification: ['Une requête sur l’adresse publique de l’équilibreur atteint un serveur du pool, et la panne d’un serveur ne coupe pas le service.'], retour: 'Pour défaire : retire les machines du pool, puis supprime l’équilibreur et son adresse IP publique (ou supprime le groupe de ressources si tout le laboratoire doit disparaître).' },
    powershell: { privileges: PRIV, etapes: CREER_PS, verification: ['Une requête sur l’adresse publique de l’équilibreur atteint un serveur du pool, et la panne d’un serveur ne coupe pas le service.'], retour: 'Pour défaire : retire les interfaces du pool, puis Remove-AzLoadBalancer (-ResourceGroupName et -Name), puis Remove-AzPublicIpAddress.',
      depannage: [{ symptome: 'La connexion à l’adresse publique reste sans réponse', cause: 'L’équilibreur Standard est fermé par défaut : aucun groupe de sécurité réseau n’autorise le port, ou le service n’écoute pas sur les serveurs.', action: 'Ajoute une règle entrante qui autorise le port sur le NSG des serveurs et vérifie que le service écoute.' }] },
  },
  'cours-az-lb-etat': {
    gui: { privileges: PRIV_LECTURE, etapes: ETAT_GUI, verification: ['Le port de la règle correspond au port du service, et la sonde interroge un port qui écoute.'], retour: null },
    powershell: { privileges: PRIV_LECTURE, etapes: ETAT_PS, verification: ['Le port de la règle correspond au port du service, et la sonde interroge un port qui écoute.'], retour: null,
      depannage: [{ symptome: 'Tous les serveurs sont retirés de la rotation', cause: 'La sonde échoue : le service n’écoute pas sur le port sondé, un pare-feu ou un NSG bloque la sonde, ou (sonde HTTP) la réponse n’est pas un code 200.', action: 'Teste le port depuis une autre machine du VNet, autorise l’étiquette de service AzureLoadBalancer sur le NSG, et vérifie le code de réponse de la page sondée.' }] },
  },
};
