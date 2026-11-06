/**
 * config-azure.mjs — JOURNAL-LABO-10 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Azure dans le schéma d'un labo, pour CONFIGURER et DOCUMENTER :
 *   - ressources (nœuds) : VM, App Service, compte de stockage, point de
 *     terminaison privé, NSG, table de routage, zone DNS, équilibreur de
 *     charge, Application Gateway, Azure Firewall, Bastion, IP publique,
 *     passerelle NAT, passerelle VPN, SQL Database, Key Vault, Event Hubs,
 *     Function App, Front Door, appliance virtuelle (NVA), Log Analytics ;
 *   - zones Azure : groupe de ressources, région, réseau virtuel (VNet,
 *     espace d'adressage, appairages) et sous-réseau (plage, délégation,
 *     points de terminaison de service) : une ressource posée dans un
 *     sous-réseau y est déployée ;
 *   - configuration par ressource en trois niveaux (simple, intermédiaire,
 *     complet), décrite par des formulaires (FORMULAIRES) ;
 *   - commandes Azure CLI générées dans l'ordre de déploiement, avec
 *     vérifications (plages dans le VNet, chevauchements, noms et tailles
 *     imposés par Azure, 5 adresses réservées par sous-réseau) ;
 *   - découpage d'un VNet selon les besoins (VLSM) ;
 *   - tests de validation proposés.
 * AUCUN secret : une clé ou une chaîne de connexion est lue au moment de
 * l'exécution (variable) ou tapée, jamais écrite. Les commandes sont
 * vérifiées dans leur forme, PAS exécutées dans un abonnement. Module PUR.
 * Références : learn.microsoft.com (virtual-network, private-link,
 * app-service, storage, dns, load-balancer).
 */
import { cidr, ipSeule } from './config-ios.mjs';
import { secretDans } from './journal.mjs';

import { AZ, GROUPES_AZURE, TYPES_AZURE, estAzure, typeAzure, GENRES_ZONE, genreZone, REGIONS } from './azure-types.mjs';
export { GROUPES_AZURE, TYPES_AZURE, estAzure, typeAzure, GENRES_ZONE, genreZone, REGIONS };

/** Noms de sous-réseaux imposés par Azure, et leur taille minimale (préfixe le plus grand permis). */
export const SOUS_RESEAUX_SPECIAUX = {
  GatewaySubnet: { min: 29, conseil: 27, pour: 'passerelle VPN ou ExpressRoute' },
  AzureBastionSubnet: { min: 26, conseil: 26, pour: 'Bastion' },
  AzureFirewallSubnet: { min: 26, conseil: 26, pour: 'Azure Firewall' },
  AzureFirewallManagementSubnet: { min: 26, conseil: 26, pour: 'Azure Firewall (gestion)' },
};
export const DELEGATIONS = [['', 'Aucune'], ['Microsoft.Web/serverFarms', 'App Service (intégration VNet)'], ['Microsoft.Sql/managedInstances', 'SQL Managed Instance'],
  ['Microsoft.ContainerInstance/containerGroups', 'Container Instances'], ['Microsoft.Network/dnsResolvers', 'DNS Private Resolver']];
export const POINTS_SERVICE = ['Microsoft.Storage', 'Microsoft.Web', 'Microsoft.Sql', 'Microsoft.KeyVault', 'Microsoft.EventHub', 'Microsoft.ServiceBus', 'Microsoft.AzureCosmosDB', 'Microsoft.ContainerRegistry'];
export const TYPES_SAUT = [['VirtualAppliance', 'Appliance virtuelle (IP)'], ['VirtualNetworkGateway', 'Passerelle de réseau virtuel'], ['VnetLocal', 'Réseau virtuel'], ['Internet', 'Internet'], ['None', 'Aucun (supprimer le trafic)']];
/** Sous-ressources (group-id) d'un point de terminaison privé, et leur zone DNS privée. */
export const SOUS_RESSOURCES = {
  stockage: [['blob', 'privatelink.blob.core.windows.net'], ['queue', 'privatelink.queue.core.windows.net'], ['file', 'privatelink.file.core.windows.net'], ['table', 'privatelink.table.core.windows.net'], ['dfs', 'privatelink.dfs.core.windows.net'], ['web', 'privatelink.web.core.windows.net']],
  'app-service': [['sites', 'privatelink.azurewebsites.net']],
  fonction: [['sites', 'privatelink.azurewebsites.net']],
  'base-sql': [['sqlServer', 'privatelink.database.windows.net']],
  'coffre-cles': [['vault', 'privatelink.vaultcore.azure.net']],
  'event-hub': [['namespace', 'privatelink.servicebus.windows.net']],
};
/** Étiquettes de service courantes (destinations de routes et sources de règles). */
export const ETIQUETTES_SERVICE = ['Internet', 'VirtualNetwork', 'AzureLoadBalancer', 'Storage', 'Sql', 'AzureKeyVault', 'AppService', 'EventHub', 'AzureMonitor', 'AzureCloud', 'ServiceBus', 'AzureActiveDirectory', 'GatewayManager', 'AzureFrontDoor.Backend'];
const REGION_TAG = /^[A-Z][A-Za-z]+(\.[A-Za-z0-9]+)?$/;
export const etiquetteService = (t) => {
  const v = String(t ?? '').trim(); const base = v.split('.')[0];
  return REGION_TAG.test(v) && ETIQUETTES_SERVICE.some((x) => x.split('.')[0] === base);
};

/* ---------------------------------------------------------------------------
 * Formulaires : un champ = { id, label, type, niveau, options, place, aide }
 *   type : texte | choix | case | multi (cases d'une liste dynamique) | liste
 *   options dynamiques : 'sousReseaux' | 'vnets' | 'vms' | 'cibles' | 'sousRessources' | 'nsgs' | 'tables'
 * ------------------------------------------------------------------------ */
const T = (id, label, o = {}) => ({ id, label, type: 'texte', niveau: 'simple', ...o });
const C = (id, label, options, o = {}) => ({ id, label, type: 'choix', options, niveau: 'simple', ...o });
const K = (id, label, o = {}) => ({ id, label, type: 'case', niveau: 'simple', ...o });
const M = (id, label, source, o = {}) => ({ id, label, type: 'multi', source, niveau: 'simple', ...o });
const L = (id, label, colonnes, o = {}) => ({ id, label, type: 'liste', colonnes, niveau: 'simple', ...o });
const ACCES = [['', 'Activé depuis tous les réseaux'], ['selection', 'Activé depuis les réseaux et IP choisis'], ['desactive', 'Désactivé (accès privé seulement)']];
const LIEU = [T('groupe', 'Groupe de ressources', { place: 'hérité de la zone ou du labo', niveau: 'intermediaire' }), C('region', 'Région', [['', 'héritée du VNet ou du labo'], ...REGIONS], { niveau: 'intermediaire' })];

export const FORMULAIRES = {
  vm: [C('image', 'Image', [['Ubuntu2204', 'Ubuntu 22.04 LTS'], ['Debian11', 'Debian 11'], ['Win2022Datacenter', 'Windows Server 2022'], ['Win2019Datacenter', 'Windows Server 2019'], ['MicrosoftWindowsDesktop:windows-11:win11-23h2-pro:latest', 'Windows 11 Pro']]),
    C('taille', 'Taille', [['Standard_B1s', 'Standard_B1s (1 vCPU, 1 Gio)'], ['Standard_B2s', 'Standard_B2s (2 vCPU, 4 Gio)'], ['Standard_D2s_v5', 'Standard_D2s_v5 (2 vCPU, 8 Gio)']]),
    T('utilisateur', 'Administrateur', { place: 'azureuser', aide: 'Linux : clé SSH générée. Windows : le mot de passe est demandé par la commande, jamais écrit ici.' }),
    T('ipPrivee', 'IP privée (vide = dynamique)', { place: '10.1.3.4' }),
    K('ipPublique', 'IP publique (maintenance)', { niveau: 'intermediaire' }),
    C('nsg', 'NSG de la carte réseau', [['', 'Aucun (celui du sous-réseau s’applique)'], ['@nsgs', '']], { niveau: 'intermediaire', dyn: 'nsgs' }), ...LIEU],
  appliance: [T('ipPrivee', 'IP privée', { place: '10.3.2.100' }), C('image', 'Image', [['Ubuntu2204', 'Ubuntu 22.04 LTS']]), C('taille', 'Taille', [['Standard_B2s', 'Standard_B2s']]),
    T('utilisateur', 'Administrateur', { place: 'azureuser' }), K('transfertIp', 'Transfert IP activé (obligatoire pour router)', { defaut: true }), ...LIEU],
  'app-service': [T('plan', 'Plan App Service', { place: 'asp-tardi' }), C('sku', 'Niveau tarifaire', [['B1', 'B1 (De base)'], ['F1', 'F1 (Gratuit)'], ['S1', 'S1 (Standard)'], ['P1v3', 'P1v3 (Premium)']]),
    C('pile', 'Publication', [['conteneur', 'Conteneur Linux'], ['dotnet', '.NET 8 (Linux)'], ['node', 'Node 20 (Linux)'], ['python', 'Python 3.12 (Linux)']]),
    T('image', 'Image et étiquette (conteneur)', { place: 'romaric/tpasr:latest' }), T('registre', 'Registre', { place: 'https://index.docker.io' }), T('port', 'Port du conteneur', { place: '8080' }),
    L('chaines', 'Chaînes de connexion (la valeur est lue au déploiement, jamais écrite)', [T('nom', 'Nom', { place: 'StorageConnectionString' }), C('source', 'Source', [['@stockages', '']], { dyn: 'stockages' }), C('genre', 'Type', [['Custom', 'Custom'], ['SQLAzure', 'SQLAzure']])], { niveau: 'simple' }),
    C('integration', 'Intégration au réseau virtuel (trafic sortant)', [['', 'Non configurée'], ['@sousReseaux', '']], { niveau: 'intermediaire', dyn: 'sousReseaux', aide: 'Sous-réseau délégué à Microsoft.Web/serverFarms, réservé à l’application.' }),
    C('acces', 'Accès réseau public (trafic entrant)', ACCES, { niveau: 'intermediaire' }),
    L('restrictions', 'Restrictions d’accès', [T('nom', 'Règle', { place: 'autoriser-vnet1' }), T('priorite', 'Priorité', { place: '100' }), C('action', 'Action', [['Allow', 'Autoriser'], ['Deny', 'Refuser']]), T('source', 'Source (IP/CIDR ou étiquette)', { place: '203.0.113.0/24' })], { niveau: 'complet' }), ...LIEU],
  fonction: [T('stockage', 'Compte de stockage', { place: 'stfonctions' }), C('runtime', 'Pile', [['node', 'Node'], ['python', 'Python'], ['dotnet-isolated', '.NET isolé']]), ...LIEU],
  stockage: [C('sku', 'Redondance', [['Standard_LRS', 'LRS (locale)'], ['Standard_ZRS', 'ZRS (zones)'], ['Standard_GRS', 'GRS (géo)']]),
    T('conteneurs', 'Conteneurs blob (séparés par des virgules)', { place: 'blob1' }), T('files', 'Files d’attente', { place: 'queue1' }), T('partages', 'Partages de fichiers', { place: '', niveau: 'intermediaire' }),
    C('acces', 'Accès réseau public', ACCES, { niveau: 'intermediaire' }),
    M('reseaux', 'Sous-réseaux autorisés (si « réseaux choisis » ; point de terminaison de service Microsoft.Storage requis)', 'sousReseaux', { niveau: 'intermediaire' }),
    T('ips', 'Adresses IP publiques autorisées', { place: '203.0.113.10', niveau: 'intermediaire' }), ...LIEU],
  'base-sql': [T('serveur', 'Serveur logique', { place: 'sql-tardi' }), T('base', 'Base de données', { place: 'facturation' }), C('sku', 'Niveau', [['Basic', 'Basic'], ['S0', 'Standard S0'], ['GP_S_Gen5_1', 'Serverless']]),
    T('admin', 'Administrateur SQL', { place: 'sqladmin', aide: 'Le mot de passe se tape à la commande, il n’est jamais écrit ici.' }), C('acces', 'Accès réseau public', ACCES, { niveau: 'intermediaire' }), ...LIEU],
  'event-hub': [C('sku', 'Niveau', [['Standard', 'Standard'], ['Basic', 'De base']]), T('hubs', 'Event Hubs (virgules)', { place: 'telemetrie' }), ...LIEU],
  'coffre-cles': [C('acces', 'Accès réseau public', ACCES, { niveau: 'intermediaire' }), ...LIEU],
  'point-terminaison-prive': [C('cible', 'Ressource ciblée', [['', 'celle reliée par une liaison privée'], ['@cibles', '']], { dyn: 'cibles', aide: 'Ou relie le point de terminaison à la ressource par une « liaison privée ».' }),
    C('sousRessource', 'Sous-ressource', [['@sousRessources', '']], { dyn: 'sousRessources' }),
    C('sousReseau', 'Sous-réseau', [['', 'celui où il est posé'], ['@sousReseaux', '']], { dyn: 'sousReseaux' }),
    T('ip', 'IP privée statique (vide = dynamique)', { place: '10.2.3.10', niveau: 'complet' }),
    K('dns', 'Intégrer à une zone DNS privée (privatelink…)', { defaut: true }), ...LIEU],
  nsg: [L('regles', 'Règles de sécurité', [T('priorite', 'Priorité', { place: '100' }), T('nom', 'Nom', { place: 'autoriser-ssh-admin' }), C('direction', 'Sens', [['Inbound', 'Entrant'], ['Outbound', 'Sortant']]),
    C('acces', 'Action', [['Allow', 'Autoriser'], ['Deny', 'Refuser']]), C('protocole', 'Protocole', [['Tcp', 'TCP'], ['Udp', 'UDP'], ['*', 'Tous'], ['Icmp', 'ICMP']]),
    T('source', 'Source', { place: '192.168.99.0/24 ou Internet' }), T('ports', 'Ports de destination', { place: '22' }), T('destination', 'Destination', { place: '*' })]),
  M('sousReseaux', 'Associé aux sous-réseaux', 'sousReseaux'), ...LIEU],
  'table-routage': [L('routes', 'Routes', [T('nom', 'Nom', { place: 'vers-nva' }), T('prefixe', 'Destination (CIDR ou étiquette de service)', { place: '0.0.0.0/0 ou AppService.CanadaCentral' }),
    C('saut', 'Prochain saut', TYPES_SAUT), T('ip', 'IP du saut (appliance)', { place: '10.3.2.100' })]),
  M('sousReseaux', 'Associée aux sous-réseaux', 'sousReseaux'), K('sansBgp', 'Ne pas propager les routes de la passerelle (BGP)', { niveau: 'complet' }), ...LIEU],
  'zone-dns': [T('domaine', 'Nom de domaine de la zone', { place: 'app.intra.canada.solaria.corp' }), K('privee', 'Zone privée (résolution dans les VNet liés)', { defaut: true }),
    L('enregistrements', 'Enregistrements', [T('nom', 'Nom', { place: 'hrapp' }), C('genre', 'Type', [['A', 'A'], ['CNAME', 'CNAME'], ['TXT', 'TXT']]), T('valeur', 'Valeur', { place: '10.1.1.10' })]),
    M('vnets', 'VNet liés', 'vnets'), K('inscription', 'Inscription automatique des VM', { niveau: 'complet' }),
    T('administrateur', 'Administrateur de la zone (compte)', { place: 'admin.dns@cegeplimoilou.ca', niveau: 'intermediaire', aide: 'Reçoit le rôle « Contributeur de zone DNS privée » sur cette zone seulement.' }), ...LIEU],
  equilibreur: [C('genre', 'Type', [['public', 'Public'], ['interne', 'Interne']]), C('sousReseau', 'Sous-réseau (interne)', [['', '—'], ['@sousReseaux', '']], { dyn: 'sousReseaux' }),
    T('ipFrontend', 'IP frontale (interne)', { place: '10.1.1.100' }), M('backend', 'Pool principal (VM)', 'vms'),
    C('protocole', 'Protocole', [['Tcp', 'TCP'], ['Udp', 'UDP']]), T('portFrontend', 'Port frontal', { place: '80' }), T('portBackend', 'Port principal', { place: '80' }), T('sonde', 'Port de la sonde', { place: '80', niveau: 'intermediaire' }), ...LIEU],
  'passerelle-app': [C('sousReseau', 'Sous-réseau dédié', [['@sousReseaux', '']], { dyn: 'sousReseaux' }), T('serveurs', 'Serveurs principaux (IP ou FQDN, virgules)', { place: '10.1.1.4, 10.1.1.5' }),
    T('port', 'Port', { place: '80' }), C('sku', 'Niveau', [['Standard_v2', 'Standard_v2'], ['WAF_v2', 'WAF_v2']], { niveau: 'intermediaire' }), ...LIEU],
  'pare-feu-azure': [C('vnet', 'VNet (sous-réseau AzureFirewallSubnet)', [['@vnets', '']], { dyn: 'vnets' }), C('tier', 'Niveau', [['Standard', 'Standard'], ['Basic', 'De base'], ['Premium', 'Premium']]), T('ipPrivee', 'IP privée (notée après création)', { place: '10.1.0.4' }), ...LIEU],
  bastion: [C('vnet', 'VNet (sous-réseau AzureBastionSubnet)', [['@vnets', '']], { dyn: 'vnets' }), C('sku', 'Niveau', [['Basic', 'De base'], ['Standard', 'Standard']]), ...LIEU],
  'ip-publique': [C('allocation', 'Attribution', [['Static', 'Statique'], ['Dynamic', 'Dynamique']]), T('adresse', 'Adresse (notée après création)', { place: '20.48.x.x' }), ...LIEU],
  'passerelle-nat': [M('sousReseaux', 'Sous-réseaux qui sortent par cette passerelle', 'sousReseaux'), ...LIEU],
  'passerelle-vpn': [C('vnet', 'VNet (sous-réseau GatewaySubnet)', [['@vnets', '']], { dyn: 'vnets' }), C('sku', 'Référence', [['VpnGw1', 'VpnGw1'], ['VpnGw2', 'VpnGw2'], ['Basic', 'De base']]), ...LIEU],
  'front-door': [T('origine', 'Origine (nom d’hôte)', { place: 'webapp1.azurewebsites.net' }), ...LIEU],
  'log-analytics': [T('retention', 'Rétention (jours)', { place: '30' }), ...LIEU],
  'service-cloud': [T('service', 'Service', { place: 'Azure Container Registry' }), ...LIEU],
};
/** Formulaires des zones Azure. */
export const FORMULAIRES_ZONE = {
  vnet: [T('espace', 'Espace d’adressage (CIDR, virgules si plusieurs)', { place: '10.1.0.0/16' }), C('region', 'Région', [['', 'héritée de la zone ou du labo'], ...REGIONS]),
    T('groupe', 'Groupe de ressources', { place: 'hérité', niveau: 'intermediaire' }), M('appairages', 'Appairé avec (dans les deux sens)', 'autresVnets'),
    K('accesVnet', 'Appairage, ce côté : autoriser le VNet appairé à accéder à ce VNet', { defaut: true, niveau: 'intermediaire' }),
    K('transfert', 'Appairage, ce côté : autoriser le VNet appairé à recevoir le trafic transféré (NVA, hub)', { niveau: 'complet' }),
    K('transitPasserelle', 'Appairage, ce côté : la passerelle ou le serveur de routes de ce VNet peut transférer le trafic au VNet appairé', { niveau: 'complet' }),
    K('passerelleDistante', 'Appairage, ce côté : utiliser la passerelle ou le serveur de routes du VNet appairé', { niveau: 'complet' }),
    T('dns', 'Serveurs DNS personnalisés', { place: 'vide = Azure (168.63.129.16)', niveau: 'complet' })],
  'sous-reseau': [T('plage', 'Plage (CIDR)', { place: '10.1.1.0/24' }), T('besoin', 'Adresses nécessaires (pour le découpage)', { place: '40' }),
    C('delegation', 'Délégation', DELEGATIONS, { niveau: 'intermediaire' }), M('pointsService', 'Points de terminaison de service', 'pointsService', { niveau: 'intermediaire' }),
    K('politiquesPe', 'Politiques réseau des points de terminaison privés (NSG, UDR)', { niveau: 'complet' })],
  region: [C('region', 'Région', REGIONS)],
  groupe: [C('region', 'Région du groupe', REGIONS)],
};

/* ---------------------------------------------------------------------------
 * Normalisation
 * ------------------------------------------------------------------------ */
const t = (v, max = 120) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const RANG = { simple: 0, intermediaire: 1, complet: 2 };
export const auNiveauAz = (n, r) => RANG[n ?? 'simple'] >= RANG[r ?? 'simple'];
function normaliserChamps(champs, x) {
  const c = {};
  for (const f of champs) {
    const v = x?.[f.id];
    if (f.type === 'case') c[f.id] = v === undefined ? Boolean(f.defaut) : v === true;
    else if (f.type === 'multi') c[f.id] = (Array.isArray(v) ? v : []).map((y) => t(y, 60)).filter(Boolean).slice(0, 40);
    else if (f.type === 'liste') c[f.id] = (Array.isArray(v) ? v : []).slice(0, 60).map((l) => (l && typeof l === 'object' ? normaliserChamps(f.colonnes, l) : null)).filter((l) => l && Object.values(l).some(Boolean));
    else if (f.type === 'choix' && !f.dyn) { const ok = f.options.some(([id]) => id === v); c[f.id] = ok ? v : f.options[0][0]; }
    else c[f.id] = t(v, f.id === 'espace' ? 200 : 160);
  }
  return c;
}
/** Configuration d'une ressource ou d'une zone Azure (genre = type de nœud ou genre de zone). */
export function normaliserConfigAzure(genre, brut, { zone = false } = {}) {
  const champs = (zone ? FORMULAIRES_ZONE : FORMULAIRES)[genre];
  if (!champs) return null;
  const x = brut && typeof brut === 'object' ? brut : {};
  return { niveau: RANG[x.niveau] !== undefined ? x.niveau : 'simple', ...normaliserChamps(champs, x) };
}
export function secretAzure(c) {
  return c ? secretDans(JSON.stringify(c).replace(/"[a-zA-Z]+":/g, ' ')) : null;
}

/* ---------------------------------------------------------------------------
 * Lecture du schéma : où est chaque chose
 * ------------------------------------------------------------------------ */
const dedans = (n, z) => n.x >= z.x && n.x <= z.x + z.l && n.y >= z.y && n.y <= z.y + z.h;
const zoneDansZone = (a, b) => a.id !== b.id && a.x >= b.x && a.y >= b.y && a.x + a.l <= b.x + b.l && a.y + a.h <= b.y + b.h;
const plusPetite = (zs) => zs.sort((a, b) => a.l * a.h - b.l * b.h)[0] ?? null;
const cfgZ = (z) => normaliserConfigAzure(z.genre, z.config, { zone: true }) ?? {};
/** Nom Azure d'un élément (sans espace ni accent). */
export const nomAzure = (s, defaut = 'ressource') => (String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || defaut).slice(0, 80);

/**
 * Contexte Azure d'un schéma : VNet, sous-réseaux, et pour chaque nœud son
 * sous-réseau, son VNet, son groupe et sa région effectifs.
 */
export function contexteAzure(schema) {
  const defauts = { groupe: t(schema.azure?.groupe, 90) || 'rg-labo', region: REGIONS.some(([r]) => r === schema.azure?.region) ? schema.azure.region : 'canadacentral' };
  const zones = schema.zones ?? [];
  const vnetsZ = zones.filter((z) => z.genre === 'vnet');
  const contenant = (obj, genres) => plusPetite(zones.filter((z) => genres.includes(z.genre) && (('l' in obj) ? zoneDansZone(obj, z) : dedans(obj, z))));
  const regionDe = (obj, propre) => {
    if (propre) return propre;
    const z = zones.filter((x) => (x.genre === 'region' || x.genre === 'groupe') && cfgZ(x).region && (('l' in obj) ? zoneDansZone(obj, x) : dedans(obj, x)));
    return plusPetite(z) ? cfgZ(plusPetite(z)).region : defauts.region;
  };
  const groupeDe = (obj, propre) => { if (propre) return nomAzure(propre); const z = contenant(obj, ['groupe']); return z ? nomAzure(z.nom, defauts.groupe) : defauts.groupe; };
  const vnets = vnetsZ.map((z) => { const c = cfgZ(z); return { id: z.id, zone: z, nom: nomAzure(z.nom, 'vnet'), c, region: regionDe(z, c.region), groupe: groupeDe(z, c.groupe) }; });
  const sousReseaux = zones.filter((z) => z.genre === 'sous-reseau').map((z) => {
    const v = plusPetite(vnetsZ.filter((x) => zoneDansZone(z, x)));
    return { id: z.id, zone: z, nom: nomAzure(z.nom, 'snet'), c: cfgZ(z), vnet: v ? vnets.find((x) => x.id === v.id) : null };
  });
  const noeud = (n) => {
    const snZ = plusPetite(zones.filter((z) => z.genre === 'sous-reseau' && dedans(n, z)));
    const sn = snZ ? sousReseaux.find((x) => x.id === snZ.id) : null;
    const vZ = sn?.vnet?.zone ?? plusPetite(vnetsZ.filter((z) => dedans(n, z)));
    const vnet = vZ ? vnets.find((x) => x.id === vZ.id) : null;
    const c = n.config ?? {};
    return { sousReseau: sn, vnet, region: c.region || vnet?.region || regionDe(n, ''), groupe: c.groupe || vnet?.groupe || groupeDe(n, '') };
  };
  return { defauts, vnets, sousReseaux, noeud };
}

/** Options dynamiques d'un champ. */
export function optionsDynamiques(schema, source, n = null) {
  const ctx = contexteAzure(schema);
  const nomN = (x) => nomAzure(x.nom, x.type);
  switch (source) {
    case 'sousReseaux': return ctx.sousReseaux.map((s) => [s.id, `${s.vnet?.nom ?? '?'} / ${s.nom}${s.c.plage ? ` (${s.c.plage})` : ''}`]);
    case 'vnets': return ctx.vnets.map((v) => [v.id, `${v.nom}${v.c.espace ? ` (${v.c.espace})` : ''}`]);
    case 'autresVnets': return ctx.vnets.filter((v) => v.id !== n?.id).map((v) => [v.id, v.nom]);
    case 'vms': return schema.noeuds.filter((x) => x.type === 'vm').map((x) => [x.id, nomN(x)]);
    case 'nsgs': return schema.noeuds.filter((x) => x.type === 'nsg').map((x) => [x.id, nomN(x)]);
    case 'stockages': return schema.noeuds.filter((x) => x.type === 'stockage').map((x) => [x.id, nomN(x)]);
    case 'cibles': return schema.noeuds.filter((x) => SOUS_RESSOURCES[x.type]).map((x) => [x.id, `${nomN(x)} (${typeAzure(x.type).label})`]);
    case 'sousRessources': {
      const cible = cibleDuPe(schema, n);
      return (SOUS_RESSOURCES[cible?.type] ?? Object.values(SOUS_RESSOURCES).flat().filter((v, i, a) => a.findIndex((w) => w[0] === v[0]) === i)).map(([g, z]) => [g, `${g} (${z})`]);
    }
    case 'pointsService': return POINTS_SERVICE.map((p) => [p, p]);
    default: return [];
  }
}
/** La ressource visée par un point de terminaison privé : son champ « cible », sinon le nœud relié par une liaison privée. */
export function cibleDuPe(schema, n) {
  if (!n) return null;
  const c = n.config ?? {};
  const parId = (id) => schema.noeuds.find((x) => x.id === id) ?? null;
  if (c.cible && SOUS_RESSOURCES[parId(c.cible)?.type]) return parId(c.cible);
  // Une liaison privée d'abord ; sinon un autre lien vers une ressource qui accepte la sous-ressource choisie.
  const voisins = schema.liens.filter((l) => l.de === n.id || l.a === n.id)
    .map((l) => ({ l, autre: parId(l.de === n.id ? l.a : l.de) })).filter((x) => x.autre && SOUS_RESSOURCES[x.autre.type]);
  const prive = voisins.find((x) => x.l.style === 'liaison-privee');
  if (prive) return prive.autre;
  return (voisins.find((x) => !c.sousRessource || SOUS_RESSOURCES[x.autre.type].some(([g]) => g === c.sousRessource)) ?? voisins[0])?.autre ?? null;
}

/* ---------------------------------------------------------------------------
 * Adresses : chevauchements, adresses utilisables, découpage
 * ------------------------------------------------------------------------ */
const plageDe = (v) => { const a = cidr(v); return a ? { debut: a.entierReseau, fin: a.entierReseau + 2 ** (32 - a.prefixe) - 1, a } : null; };
export const chevauche = (x, y) => { const a = plageDe(x); const b = plageDe(y); return Boolean(a && b && a.debut <= b.fin && b.debut <= a.fin); };
export const contient = (grand, petit) => { const a = plageDe(grand); const b = plageDe(petit); return Boolean(a && b && a.debut <= b.debut && b.fin <= a.fin); };
/** Adresses utilisables dans un sous-réseau Azure (5 réservées : réseau, passerelle, 2 DNS, diffusion). */
export const utilisablesAzure = (plage) => { const a = cidr(plage); return a ? Math.max(0, 2 ** (32 - a.prefixe) - 5) : 0; };
const versIp = (v) => [24, 16, 8, 0].map((s) => (v >>> s) & 255).join('.');
/** Plus petit préfixe Azure qui donne `besoin` adresses utilisables (/29 au minimum). */
export const prefixePour = (besoin) => { let p = 29; while (p > 8 && 2 ** (32 - p) - 5 < Number(besoin)) p -= 1; return p; };
/**
 * Découpe l'espace d'un VNet selon les besoins (VLSM : les plus grands d'abord,
 * alignés, sans chevauchement). Les sous-réseaux spéciaux reçoivent au moins
 * leur taille conseillée. Renvoie { plages: { id: cidr }, reste, erreur }.
 */
export function decouperVnet(espace, sousReseaux) {
  const e = cidr(String(espace ?? '').split(',')[0]);
  if (!e) return { plages: {}, erreur: 'Indique d’abord l’espace d’adressage du VNet (ex. 10.1.0.0/16).' };
  const demandes = sousReseaux.map((s) => {
    const special = SOUS_RESEAUX_SPECIAUX[s.nom];
    // Sans besoin indiqué : un /24 (habituel dans Azure, place pour grandir) ; un sous-réseau imposé reçoit sa taille conseillée.
    let p = Number(s.besoin) ? prefixePour(Number(s.besoin)) : (special ? special.conseil : 24);
    if (special) p = Math.min(p, special.conseil);
    return { id: s.id, nom: s.nom, p };
  }).sort((a, b) => a.p - b.p);
  let curseur = e.entierReseau; const fin = e.entierReseau + 2 ** (32 - e.prefixe);
  const plages = {};
  for (const d of demandes) {
    const taille = 2 ** (32 - d.p);
    curseur = Math.ceil(curseur / taille) * taille;
    if (curseur + taille > fin) return { plages, erreur: `L’espace ${e.reseau}/${e.prefixe} est trop petit : ${d.nom} (/${d.p}) ne rentre pas.` };
    plages[d.id] = `${versIp(curseur)}/${d.p}`; curseur += taille;
  }
  return { plages, reste: fin - curseur, erreur: null };
}
/** Taille de VNet conseillée pour des besoins (somme arrondie à la puissance de 2). */
export function espaceConseille(besoins) {
  const total = besoins.reduce((s, b) => s + 2 ** (32 - prefixePour(Number(b) || 1)), 0);
  let p = 32; while (2 ** (32 - p) < total) p -= 1;
  return p;
}

/* ---------------------------------------------------------------------------
 * Vérifications
 * ------------------------------------------------------------------------ */
const NOM_STOCKAGE = /^[a-z0-9]{3,24}$/;
/* ---------------------------------------------------------------------------
 * Appairages : paires, options par sens, vérifications
 * ------------------------------------------------------------------------ */
/** Paires de VNet appairés, une fois chacune (déclarées d'un côté ou des deux). */
export function pairesAppairees(ctx) {
  const paires = [];
  for (const v of ctx.vnets) for (const id of v.c.appairages) {
    const w = ctx.vnets.find((x) => x.id === id); if (!w || w.id === v.id) continue;
    if (paires.some(([a, b]) => (a.id === v.id && b.id === w.id) || (a.id === w.id && b.id === v.id))) continue;
    paires.push([v, w]);
  }
  return paires;
}
const sontAppaires = (ctx, a, b) => pairesAppairees(ctx).some(([x, y]) => (x.id === a.id && y.id === b.id) || (x.id === b.id && y.id === a.id));
const passerelleVpnDans = (schema, v) => schema.noeuds.some((n) => n.type === 'passerelle-vpn' && ((normaliserConfigAzure(n.type, n.config)?.vnet) === v.id || (!normaliserConfigAzure(n.type, n.config)?.vnet && contexteAzure(schema).noeud(n).vnet?.id === v.id)));
const aSousReseauPasserelle = (ctx, v) => ctx.sousReseaux.some((s) => s.vnet?.id === v.id && s.nom === 'GatewaySubnet');
/** Avertissements propres aux appairages (jamais bloquants). */
function verifierAppairages(schema, ctx) {
  const m = []; const paires = pairesAppairees(ctx);
  for (const [a, b] of paires) {
    for (const [v, w] of [[a, b], [b, a]]) {
      if (!v.c.passerelleDistante) continue;
      if (!w.c.transitPasserelle) m.push(`Appairage ${v.nom} → ${w.nom} : « utiliser la passerelle distante » demande que ${w.nom} autorise le transit par sa passerelle (option du côté ${w.nom}).`);
      if (!passerelleVpnDans(schema, w) && !aSousReseauPasserelle(ctx, w)) m.push(`Appairage ${v.nom} → ${w.nom} : ${w.nom} n’a ni passerelle VPN ni GatewaySubnet, il n’y a rien à utiliser.`);
      if (passerelleVpnDans(schema, v)) m.push(`Appairage ${v.nom} → ${w.nom} : ${v.nom} a déjà sa propre passerelle, il ne peut pas utiliser celle de ${w.nom}.`);
    }
    if (a.c.passerelleDistante && b.c.passerelleDistante) m.push(`Appairage ${a.nom} ↔ ${b.nom} : « utiliser la passerelle distante » ne s’active que d’un seul côté.`);
    if (!a.c.accesVnet || !b.c.accesVnet) m.push(`Appairage ${a.nom} ↔ ${b.nom} : l’accès au VNet appairé est coupé d’un côté (${[a, b].filter((x) => !x.c.accesVnet).map((x) => x.nom).join(', ')}) : le trafic ne passe pas dans ce sens.`);
    if (a.region !== b.region) {
      const basique = schema.noeuds.some((n) => n.type === 'equilibreur' && [a.id, b.id].includes(contexteAzure(schema).noeud(n).vnet?.id) && /basic|base/i.test(String(normaliserConfigAzure(n.type, n.config)?.sku ?? '')));
      m.push(`Appairage global ${a.nom} (${a.region}) ↔ ${b.nom} (${b.region}) : la frontale d’un équilibreur de charge De base n’est pas joignable à travers un appairage global${basique ? ' (un équilibreur De base est présent)' : ' ; utilise le niveau Standard'}.`);
    }
    if ((a.c.dns || '') !== (b.c.dns || '')) m.push(`Appairage ${a.nom} ↔ ${b.nom} : les serveurs DNS diffèrent (${a.c.dns || 'Azure'} / ${b.c.dns || 'Azure'}) : les noms ne se résoudront pas de la même façon des deux côtés.`);
  }
  // Non-transitivité : A–B et B–C appairés, A–C non.
  for (const b of ctx.vnets) {
    const voisins = ctx.vnets.filter((x) => x.id !== b.id && sontAppaires(ctx, x, b));
    for (let i = 0; i < voisins.length; i++) for (let j = i + 1; j < voisins.length; j++) {
      const [a, c] = [voisins[i], voisins[j]];
      if (sontAppaires(ctx, a, c)) continue;
      const nva = schema.noeuds.some((n) => ['appliance', 'pare-feu-azure'].includes(n.type) && contexteAzure(schema).noeud(n).vnet?.id === b.id);
      if (!nva) m.push(`${a.nom} et ${c.nom} sont appairés chacun à ${b.nom}, mais l’appairage n’est pas transitif : ils ne se joignent pas. Ajoute un appairage direct, ou une appliance (NVA) dans ${b.nom} avec transfert de trafic et une route (UDR) dans chaque réseau.`);
      else for (const x of [a, c]) if (!x.c.transfert || !b.c.transfert) { m.push(`${a.nom} ↔ ${c.nom} par l’appliance de ${b.nom} : active « recevoir le trafic transféré » sur ${x.nom} et ${b.nom}, sinon le trafic de l’appliance est refusé.`); break; }
    }
  }
  return [...new Set(m)];
}

/** Avertissements sur tout le schéma Azure (jamais bloquants). */
export function verifierAzure(schema) {
  const ctx = contexteAzure(schema); const m = [];
  for (const v of ctx.vnets) {
    const espaces = v.c.espace.split(',').map((x) => x.trim()).filter(Boolean);
    if (!espaces.length) m.push(`VNet ${v.nom} : indique son espace d’adressage.`);
    for (const e of espaces) {
      const a = cidr(e);
      if (!a) m.push(`VNet ${v.nom} : « ${e} » n’est pas un CIDR (ex. 10.1.0.0/16).`);
      else if (a.ip !== a.reseau) m.push(`VNet ${v.nom} : ${e} n’est pas une adresse de réseau (devrait être ${a.reseau}/${a.prefixe}).`);
    }
    for (const id of v.c.appairages) {
      const w = ctx.vnets.find((x) => x.id === id);
      if (w && espaces.some((e) => w.c.espace.split(',').some((f) => chevauche(e, f.trim())))) m.push(`Appairage ${v.nom} ↔ ${w.nom} impossible : leurs espaces d’adressage se chevauchent.`);
    }
  }
  m.push(...verifierAppairages(schema, ctx));
  for (let i = 0; i < ctx.vnets.length; i++) for (let j = i + 1; j < ctx.vnets.length; j++) {
    const [a, b] = [ctx.vnets[i], ctx.vnets[j]];
    if (a.c.appairages.includes(b.id) || b.c.appairages.includes(a.id)) continue;
    if (a.c.espace.split(',').some((e) => b.c.espace.split(',').some((f) => chevauche(e.trim(), f.trim())))) m.push(`VNet ${a.nom} et ${b.nom} se chevauchent : ils ne pourront jamais être reliés (appairage, VPN). Choisis des espaces distincts.`);
  }
  for (const s of ctx.sousReseaux) {
    const nom = `${s.vnet?.nom ?? '?'}/${s.nom}`;
    if (!s.vnet) m.push(`Sous-réseau ${s.nom} : pose-le à l’intérieur d’un VNet.`);
    const a = cidr(s.c.plage);
    if (!s.c.plage) { m.push(`Sous-réseau ${nom} : indique sa plage (ou « Découper selon les besoins » sur le VNet).`); continue; }
    if (!a) { m.push(`Sous-réseau ${nom} : « ${s.c.plage} » n’est pas un CIDR.`); continue; }
    if (a.ip !== a.reseau) m.push(`Sous-réseau ${nom} : devrait être ${a.reseau}/${a.prefixe}.`);
    if (a.prefixe > 29) m.push(`Sous-réseau ${nom} : Azure demande au moins un /29.`);
    if (s.vnet && !s.vnet.c.espace.split(',').some((e) => contient(e.trim(), s.c.plage))) m.push(`Sous-réseau ${nom} : ${s.c.plage} est hors de l’espace du VNet (${s.vnet.c.espace || 'non défini'}).`);
    if (Number(s.c.besoin) && utilisablesAzure(s.c.plage) < Number(s.c.besoin)) m.push(`Sous-réseau ${nom} : ${utilisablesAzure(s.c.plage)} adresses utilisables pour ${s.c.besoin} demandées (Azure en réserve 5).`);
    const sp = SOUS_RESEAUX_SPECIAUX[s.nom];
    if (sp && a.prefixe > sp.min) m.push(`${s.nom} (${sp.pour}) : au moins un /${sp.min}${sp.conseil !== sp.min ? `, /${sp.conseil} conseillé` : ''}.`);
    else if (sp && a.prefixe > sp.conseil) m.push(`${s.nom} (${sp.pour}) : /${sp.conseil} conseillé (un /${a.prefixe} limite les options).`);
    if (s.c.delegation === 'Microsoft.Web/serverFarms' && a.prefixe > 28) m.push(`Sous-réseau ${nom} : l’intégration VNet d’App Service demande au moins un /28 (/26 conseillé).`);
    for (const t2 of ctx.sousReseaux) if (t2.id > s.id && t2.vnet?.id === s.vnet?.id && chevauche(s.c.plage, t2.c.plage)) m.push(`Sous-réseaux ${s.nom} et ${t2.nom} se chevauchent.`);
  }
  for (const n of schema.noeuds) {
    if (!estAzure(n.type)) continue;
    const c = normaliserConfigAzure(n.type, n.config) ?? {}; const o = ctx.noeud(n); const nom = nomAzure(n.nom, n.type);
    const dansSn = (ip) => o.sousReseau?.c.plage && ipSeule(ip) && !contient(o.sousReseau.c.plage, `${ip.trim()}/32`);
    if (n.type === 'stockage' && !NOM_STOCKAGE.test(nomAzure(n.nom, ''))) m.push(`Compte de stockage « ${n.nom || 'sans nom'} » : 3 à 24 lettres minuscules et chiffres, unique dans Azure.`);
    if (n.type === 'stockage' && c.acces === 'selection') for (const id of c.reseaux) {
      const s = ctx.sousReseaux.find((x) => x.id === id);
      if (s && !s.c.pointsService.includes('Microsoft.Storage')) m.push(`${nom} : le sous-réseau ${s.nom} doit avoir le point de terminaison de service Microsoft.Storage.`);
    }
    if (['vm', 'appliance', 'point-terminaison-prive', 'bastion', 'passerelle-app'].includes(n.type) && !o.sousReseau && !(n.type === 'point-terminaison-prive' && c.sousReseau)) m.push(`${nom} : pose-le dans un sous-réseau (zone « Sous-réseau »).`);
    if ((n.type === 'vm' || n.type === 'appliance') && c.ipPrivee && dansSn(c.ipPrivee)) m.push(`${nom} : l’IP ${c.ipPrivee} n’est pas dans ${o.sousReseau.c.plage}.`);
    if (n.type === 'point-terminaison-prive') {
      if (!cibleDuPe(schema, n)) m.push(`${nom} : choisis la ressource ciblée (ou relie-le par une liaison privée).`);
      const sn = c.sousReseau ? ctx.sousReseaux.find((x) => x.id === c.sousReseau) : o.sousReseau;
      if (sn?.c.delegation) m.push(`${nom} : un point de terminaison privé ne va pas dans un sous-réseau délégué (${sn.nom}).`);
    }
    if (n.type === 'app-service' && c.integration) {
      const sn = ctx.sousReseaux.find((x) => x.id === c.integration);
      if (sn && sn.c.delegation !== 'Microsoft.Web/serverFarms') m.push(`${nom} : le sous-réseau d’intégration ${sn.nom} doit être délégué à Microsoft.Web/serverFarms.`);
      if (c.sku === 'F1') m.push(`${nom} : l’intégration VNet demande au moins le niveau B1.`);
    }
    if (n.type === 'table-routage') for (const r of c.routes) {
      if (!cidr(r.prefixe) && !etiquetteService(r.prefixe)) m.push(`${nom} : la destination « ${r.prefixe} » n’est ni un CIDR ni une étiquette de service connue.`);
      if (r.saut === 'VirtualAppliance' && !ipSeule(r.ip)) m.push(`${nom} : la route ${r.nom || r.prefixe} vers une appliance demande son IP.`);
      if (r.saut !== 'VirtualAppliance' && r.ip) m.push(`${nom} : l’IP du saut n’est permise que vers une appliance virtuelle (route ${r.nom || r.prefixe}).`);
    }
    if (n.type === 'nsg') {
      const prio = c.regles.map((r) => `${r.direction}|${r.priorite}`);
      if (new Set(prio).size !== prio.length) m.push(`${nom} : deux règles ont la même priorité dans le même sens.`);
      for (const r of c.regles) if (!(Number(r.priorite) >= 100 && Number(r.priorite) <= 4096)) m.push(`${nom} : priorité ${r.priorite || '(vide)'} hors de 100 à 4096.`);
    }
    if (n.type === 'zone-dns') {
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(c.domaine)) m.push(`${nom} : indique le nom de domaine de la zone (ex. app.intra.canada.solaria.corp).`);
      if (c.privee && !c.vnets.length) m.push(`${nom} : une zone privée doit être liée à au moins un VNet pour être résolue.`);
      for (const r of c.enregistrements) if (r.genre === 'A' && !ipSeule(r.valeur)) m.push(`${nom} : l’enregistrement A ${r.nom} demande une adresse IP.`);
    }
    for (const [cle, sp] of [['passerelle-vpn', 'GatewaySubnet'], ['bastion', 'AzureBastionSubnet'], ['pare-feu-azure', 'AzureFirewallSubnet']]) {
      if (n.type !== cle) continue;
      const v = ctx.vnets.find((x) => x.id === c.vnet) ?? o.vnet;
      if (!v) m.push(`${nom} : choisis son VNet.`);
      else if (!ctx.sousReseaux.some((s) => s.vnet?.id === v.id && s.nom === sp)) m.push(`${nom} : le VNet ${v.nom} doit avoir un sous-réseau nommé exactement « ${sp} ».`);
    }
  }
  return m;
}

/* ---------------------------------------------------------------------------
 * Commandes Azure CLI
 * ------------------------------------------------------------------------ */
const q = (v) => (/^[\w.\-/:@]+$/.test(String(v)) ? String(v) : `"${String(v).replace(/"/g, '\\"')}"`);
const listeV = (v) => String(v ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const idDe = (n, ctx) => {
  const o = ctx.noeud(n); const nom = nomAzure(n.nom, n.type); const c = normaliserConfigAzure(n.type, n.config) ?? {};
  return {
    stockage: `$(az storage account show -g ${o.groupe} -n ${nom} --query id -o tsv)`,
    'app-service': `$(az webapp show -g ${o.groupe} -n ${nom} --query id -o tsv)`,
    fonction: `$(az functionapp show -g ${o.groupe} -n ${nom} --query id -o tsv)`,
    'base-sql': `$(az sql server show -g ${o.groupe} -n ${nomAzure(c.serveur || nom)} --query id -o tsv)`,
    'coffre-cles': `$(az keyvault show -g ${o.groupe} -n ${nom} --query id -o tsv)`,
    'event-hub': `$(az eventhubs namespace show -g ${o.groupe} -n ${nom} --query id -o tsv)`,
  }[n.type] ?? '';
};

/** Commandes d'une zone Azure (VNet, sous-réseau, groupe). */
export function commandesZone(schema, z, { appairages = true } = {}) {
  const ctx = contexteAzure(schema); const L2 = [];
  if (z.genre === 'groupe') {
    const c = cfgZ(z); L2.push(`az group create -n ${nomAzure(z.nom, 'rg-labo')} -l ${c.region || ctx.defauts.region}`);
    return { blocs: [{ titre: `Groupe de ressources ${nomAzure(z.nom)}`, lignes: L2 }], avertissements: [] };
  }
  if (z.genre === 'vnet') {
    const v = ctx.vnets.find((x) => x.id === z.id);
    const esp = listeV(v.c.espace);
    L2.push(`# Portail : Réseaux virtuels > + Créer`, `az network vnet create -g ${v.groupe} -n ${v.nom} -l ${v.region} --address-prefixes ${esp.join(' ') || '<espace>'}${v.c.dns ? ` --dns-servers ${listeV(v.c.dns).join(' ')}` : ''}`);
    for (const s of ctx.sousReseaux.filter((x) => x.vnet?.id === v.id)) L2.push(...commandesSousReseau(s, v));
    if (appairages) L2.push(...lignesAppairages(ctx, v));
    return { blocs: [{ titre: `Réseau virtuel ${v.nom}`, lignes: L2 }], avertissements: verifierAzure({ ...schema, noeuds: [] }).filter((x) => x.includes(v.nom)) };
  }
  if (z.genre === 'sous-reseau') {
    const s = ctx.sousReseaux.find((x) => x.id === z.id);
    return { blocs: [{ titre: `Sous-réseau ${s.nom}`, lignes: commandesSousReseau(s, s.vnet) }], avertissements: verifierAzure({ ...schema, noeuds: [] }).filter((x) => x.includes(s.nom)) };
  }
  return { blocs: [], avertissements: [] };
}
/** Options d'un côté de l'appairage : les réglages du VNet qui porte cette moitié. */
const optionsCote = (c) => `${c.accesVnet ? ' --allow-vnet-access' : ''}${c.transfert ? ' --allow-forwarded-traffic' : ''}${c.transitPasserelle ? ' --allow-gateway-transit' : ''}${c.passerelleDistante ? ' --use-remote-gateways' : ''}`;
/** Appairages déclarés sur un VNet : une moitié par sens, avec les options de chaque côté, écrites une fois par paire. */
function lignesAppairages(ctx, v) {
  const L2 = [];
  for (const id of v.c.appairages) {
    const w = ctx.vnets.find((x) => x.id === id); if (!w) continue;
    if (w.c.appairages.includes(v.id) && w.id < v.id) continue;   // déclaré des deux côtés : écrit une fois
    const distant = w.groupe === v.groupe ? w.nom : `$(az network vnet show -g ${w.groupe} -n ${w.nom} --query id -o tsv)`;
    const retour = w.groupe === v.groupe ? v.nom : `$(az network vnet show -g ${v.groupe} -n ${v.nom} --query id -o tsv)`;
    L2.push(`az network vnet peering create -g ${v.groupe} -n ${v.nom}-vers-${w.nom} --vnet-name ${v.nom} --remote-vnet ${distant}${optionsCote(v.c)}`);
    L2.push(`az network vnet peering create -g ${w.groupe} -n ${w.nom}-vers-${v.nom} --vnet-name ${w.nom} --remote-vnet ${retour}${optionsCote(w.c)}`);
    L2.push(`# État : « Initiated » après la première moitié, « Connected » quand les deux existent.`);
  }
  return L2;
}
/** Texte d'exploitation des appairages (droits, coût, retour arrière) ; vide s'il n'y en a pas. */
export function notesAppairages(schema) {
  const ctx = contexteAzure(schema); const paires = pairesAppairees(ctx);
  if (!paires.length) return { acces: '', retourArriere: '' };
  const noms = paires.map(([a, b]) => `${a.nom} ↔ ${b.nom}`).join(', ');
  const globaux = paires.filter(([a, b]) => a.region !== b.region).map(([a, b]) => `${a.nom} ↔ ${b.nom}`);
  return {
    acces: `Appairages (${noms}) : le rôle Network Contributor (ou un rôle personnalisé avec Microsoft.Network/virtualNetworks/virtualNetworkPeerings/write, read et delete) est nécessaire sur chaque VNet ; pour supprimer la moitié distante, le droit est aussi nécessaire sur l’autre VNet. Le trafic entrant et sortant d’un appairage est facturé${globaux.length ? ` (plus cher entre régions : ${globaux.join(', ')})` : ''}. Les noms Azure par défaut ne se résolvent pas d’un VNet appairé à l’autre : zone DNS privée liée aux deux VNet ou DNS personnalisé.`,
    retourArriere: `Appairages : supprimer les deux moitiés (az network vnet peering delete -g <groupe> --vnet-name <vnet> -n <nom>, pour chaque sens). Un VNet appairé ne peut pas être déplacé ni supprimé tant que l’appairage existe : supprimer l’appairage, déplacer, puis le recréer. Les clients VPN point à site doivent re-télécharger leur profil après un changement d’appairage.`,
  };
}

/** Commandes de droits pour les appairages (rôle Network Contributor, une fois par VNet concerné). */
export function droitsAppairages(ctx) {
  const vus = new Set(); const L2 = [];
  for (const [a, b] of pairesAppairees(ctx)) for (const v of [a, b]) {
    if (vus.has(v.id)) continue; vus.add(v.id);
    L2.push(`az role assignment create --assignee <compte ou groupe> --role "Network Contributor" --scope $(az network vnet show -g ${v.groupe} -n ${v.nom} --query id -o tsv)`);
  }
  return L2;
}
function commandesSousReseau(s, v) {
  const c = s.c;
  return [`az network vnet subnet create -g ${v?.groupe ?? 'rg-labo'} --vnet-name ${v?.nom ?? '<vnet>'} -n ${s.nom} --address-prefixes ${c.plage || '<plage>'}`
    + `${c.delegation ? ` --delegations ${c.delegation}` : ''}${c.pointsService.length ? ` --service-endpoints ${c.pointsService.join(' ')}` : ''}${c.politiquesPe ? ' --private-endpoint-network-policies Enabled' : ''}`];
}

/** Commandes d'une ressource (nœud). Renvoie { blocs, avertissements }. */
export function commandesAzure(schema, n) {
  const ctx = contexteAzure(schema); const c = normaliserConfigAzure(n.type, n.config);
  if (!c) return { blocs: [], avertissements: [] };
  const o = ctx.noeud(n); const g = o.groupe; const l = o.region; const nom = nomAzure(n.nom, n.type);
  const sn = (id) => ctx.sousReseaux.find((x) => x.id === id) ?? null;
  const B = []; const bloc = (titre, lignes) => { if (lignes.length) B.push({ titre, lignes }); };
  const portail = typeAzure(n.type)?.portail; const P = portail ? [`# Portail : ${portail}`] : [];
  const assoc = (champ, option) => c.sousReseaux.map((id) => sn(id)).filter(Boolean).map((s) => `az network vnet subnet update -g ${s.vnet?.groupe ?? g} --vnet-name ${s.vnet?.nom ?? '<vnet>'} -n ${s.nom} --${option} ${nom}`);
  switch (n.type) {
    case 'vm': case 'appliance': {
      const windows = /^Win|windows/i.test(c.image);
      bloc(`Machine virtuelle ${nom}`, [...P, `az vm create -g ${g} -n ${nom} -l ${l} --image ${c.image} --size ${c.taille} --vnet-name ${o.vnet?.nom ?? '<vnet>'} --subnet ${o.sousReseau?.nom ?? '<sous-reseau>'}`
        + ` --admin-username ${nomAzure(c.utilisateur || 'azureuser')}${windows ? '' : ' --generate-ssh-keys'}${c.ipPrivee ? ` --private-ip-address ${c.ipPrivee}` : ''}`
        + `${c.ipPublique ? ' --public-ip-sku Standard' : ' --public-ip-address ""'}${n.type === 'vm' ? (c.nsg ? ` --nsg ${nomAzure(schema.noeuds.find((x) => x.id === c.nsg)?.nom, 'nsg')}` : ' --nsg ""') : ' --nsg ""'}`,
      ...(windows ? ['# Windows : la commande demande le mot de passe de l’administrateur ; ne l’écris jamais dans ce document.'] : []),
      ...(n.type === 'appliance' && c.transfertIp ? [`az network nic update -g ${g} -n ${nom}VMNic --ip-forwarding true`, '# Dans la VM : activer le routage (Linux : sysctl -w net.ipv4.ip_forward=1).'] : [])]);
      break;
    }
    case 'app-service': {
      const plan = nomAzure(c.plan || `asp-${nom}`);
      const pile = { conteneur: '', dotnet: ' --runtime "DOTNETCORE:8.0"', node: ' --runtime "NODE:20-lts"', python: ' --runtime "PYTHON:3.12"' }[c.pile];
      const image = c.pile === 'conteneur' ? ` --container-image-name ${(c.registre || 'https://index.docker.io').replace(/^https?:\/\//, '').replace(/\/$/, '')}/${c.image || 'image:latest'}` : pile;
      const L2 = [...P, `az appservice plan create -g ${g} -n ${plan} -l ${l} --sku ${c.sku} --is-linux`, `az webapp create -g ${g} -p ${plan} -n ${nom}${image}`];
      if (c.pile === 'conteneur' && c.port) L2.push(`az webapp config appsettings set -g ${g} -n ${nom} --settings WEBSITES_PORT=${c.port}`);
      for (const ch of c.chaines) {
        const st = schema.noeuds.find((x) => x.id === ch.source);
        if (!ch.nom) continue;
        if (st) L2.push(`# La chaîne est lue dans Azure au moment de la commande : elle n’est jamais écrite ici.`, `CHAINE=$(az storage account show-connection-string -g ${ctx.noeud(st).groupe} -n ${nomAzure(st.nom, 'stockage')} --query connectionString -o tsv)`);
        L2.push(`az webapp config connection-string set -g ${g} -n ${nom} --connection-string-type ${ch.genre || 'Custom'} --settings ${ch.nom}="${st ? '$CHAINE' : '<à copier depuis le portail>'}"`);
      }
      if (c.integration && sn(c.integration)) { const s = sn(c.integration); L2.push(`az webapp vnet-integration add -g ${g} -n ${nom} --vnet ${s.vnet?.nom ?? '<vnet>'} --subnet ${s.nom}`); }
      if (c.acces === 'desactive') L2.push(`az webapp update -g ${g} -n ${nom} --set publicNetworkAccess=Disabled`);
      for (const r of c.restrictions) {
        const src = etiquetteService(r.source) ? `--service-tag ${r.source}` : `--ip-address ${r.source || '0.0.0.0/0'}`;
        L2.push(`az webapp config access-restriction add -g ${g} -n ${nom} --rule-name ${nomAzure(r.nom, 'regle')} --action ${r.action || 'Allow'} ${src} --priority ${r.priorite || 100}`);
      }
      if (c.acces === 'selection' && !c.restrictions.length) L2.push(`# Accès choisi : ajoute des restrictions d’accès (niveau complet) ; sans règle, tout reste ouvert.`);
      bloc(`App Service ${nom}`, L2);
      break;
    }
    case 'fonction':
      bloc(`Function App ${nom}`, [...P, `az functionapp create -g ${g} -n ${nom} --storage-account ${nomAzure(c.stockage || 'stfonctions')} --consumption-plan-location ${l} --runtime ${c.runtime} --functions-version 4`]);
      break;
    case 'stockage': {
      const L2 = [...P, `az storage account create -g ${g} -n ${nom} -l ${l} --sku ${c.sku} --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false`];
      L2.push(...listeV(c.conteneurs).map((x) => `az storage container-rm create -g ${g} --storage-account ${nom} -n ${nomAzure(x).toLowerCase()}`));
      L2.push(...listeV(c.partages).map((x) => `az storage share-rm create -g ${g} --storage-account ${nom} -n ${nomAzure(x).toLowerCase()}`));
      if (listeV(c.files).length) L2.push('# File d’attente (plan de données) : ton compte doit avoir le rôle « Contributeur aux données en file d’attente du stockage ».');
      L2.push(...listeV(c.files).map((x) => `az storage queue create --account-name ${nom} -n ${nomAzure(x).toLowerCase()} --auth-mode login`));
      if (listeV(c.conteneurs).length) L2.push(`# Déposer un fichier : az storage blob upload --account-name ${nom} -c ${nomAzure(listeV(c.conteneurs)[0]).toLowerCase()} -f <fichier> --auth-mode login`);
      // L'accès public se ferme APRÈS la création du contenu (sinon les commandes du plan de données sont refusées).
      if (c.acces === 'desactive') L2.push(`az storage account update -g ${g} -n ${nom} --public-network-access Disabled`);
      if (c.acces === 'selection') {
        L2.push(`az storage account update -g ${g} -n ${nom} --default-action Deny`);
        for (const id of c.reseaux) { const s = sn(id); if (s) L2.push(`az storage account network-rule add -g ${g} --account-name ${nom} --vnet-name ${s.vnet?.nom ?? '<vnet>'} --subnet ${s.nom}`); }
        for (const ip of listeV(c.ips)) L2.push(`az storage account network-rule add -g ${g} --account-name ${nom} --ip-address ${ip}`);
      }
      bloc(`Compte de stockage ${nom}`, L2);
      break;
    }
    case 'base-sql': {
      const srv = nomAzure(c.serveur || `sql-${nom}`).toLowerCase();
      bloc(`Azure SQL ${srv}/${nomAzure(c.base || nom)}`, [...P, '# Ajoute le mot de passe en tapant la commande ; il n’est jamais écrit dans ce document.',
        `az sql server create -g ${g} -n ${srv} -l ${l} --admin-user ${nomAzure(c.admin || 'sqladmin')} --admin-password`,
        `az sql db create -g ${g} -s ${srv} -n ${nomAzure(c.base || nom)} --service-objective ${c.sku}`,
        ...(c.acces === 'desactive' ? [`az sql server update -g ${g} -n ${srv} --enable-public-network false`] : [])]);
      break;
    }
    case 'event-hub':
      bloc(`Event Hubs ${nom}`, [...P, `az eventhubs namespace create -g ${g} -n ${nom} -l ${l} --sku ${c.sku}`, ...listeV(c.hubs).map((h) => `az eventhubs eventhub create -g ${g} --namespace-name ${nom} -n ${nomAzure(h)}`)]);
      break;
    case 'coffre-cles':
      bloc(`Key Vault ${nom}`, [...P, `az keyvault create -g ${g} -n ${nom} -l ${l}${c.acces === 'desactive' ? ' --public-network-access Disabled' : ''}`]);
      break;
    case 'point-terminaison-prive': {
      const cible = cibleDuPe(schema, n);
      const s = c.sousReseau ? sn(c.sousReseau) : o.sousReseau;
      const sr = SOUS_RESSOURCES[cible?.type] ?? [];
      const choix = sr.find(([gid]) => gid === c.sousRessource) ?? sr[0];
      const gid = choix?.[0] ?? (c.sousRessource || '<sous-ressource>'); const zone = choix?.[1] ?? '';
      const L2 = [...P, `az network private-endpoint create -g ${g} -n ${nom} -l ${l} --vnet-name ${s?.vnet?.nom ?? '<vnet>'} --subnet ${s?.nom ?? '<sous-reseau>'}`
        + ` --private-connection-resource-id ${cible ? idDe(cible, ctx) : '<id de la ressource>'} --group-id ${gid} --connection-name ${nom}-connexion`
        + `${c.ip ? ` --ip-config name=ipconfig1 group-id=${gid} member-name=${gid} private-ip-address=${c.ip}` : ''}`];
      if (c.dns && zone) {
        // La zone privatelink est liée au VNet du point de terminaison et aux VNet appairés (ou intégrés) qui doivent résoudre le nom.
        const vnets = new Set([s?.vnet?.id].filter(Boolean));
        for (const v of ctx.vnets) if (s?.vnet && (v.c.appairages.includes(s.vnet.id) || s.vnet.c.appairages.includes(v.id))) vnets.add(v.id);
        L2.push(`az network private-dns zone create -g ${g} -n ${zone}`);
        for (const id of vnets) { const v = ctx.vnets.find((x) => x.id === id); L2.push(`az network private-dns link vnet create -g ${g} -z ${zone} -n lien-${v.nom} -v ${v.groupe === g ? v.nom : `$(az network vnet show -g ${v.groupe} -n ${v.nom} --query id -o tsv)`} -e false`); }
        L2.push(`az network private-endpoint dns-zone-group create -g ${g} --endpoint-name ${nom} -n defaut --private-dns-zone ${zone} --zone-name ${gid}`);
      }
      bloc(`Point de terminaison privé ${nom}${cible ? ` → ${nomAzure(cible.nom, cible.type)} (${gid})` : ''}`, L2);
      break;
    }
    case 'nsg': {
      const L2 = [...P, `az network nsg create -g ${g} -n ${nom} -l ${l}`];
      for (const r of c.regles) L2.push(`az network nsg rule create -g ${g} --nsg-name ${nom} -n ${nomAzure(r.nom, 'regle')} --priority ${r.priorite || 100} --direction ${r.direction} --access ${r.acces} --protocol ${r.protocole}`
        + ` --source-address-prefixes ${q(r.source || '*')} --source-port-ranges "*" --destination-address-prefixes ${q(r.destination || '*')} --destination-port-ranges ${q(r.ports || '*')}`);
      L2.push(...assoc('sousReseaux', 'network-security-group'));
      bloc(`NSG ${nom}`, L2);
      break;
    }
    case 'table-routage': {
      const L2 = [...P, `az network route-table create -g ${g} -n ${nom} -l ${l}${c.sansBgp ? ' --disable-bgp-route-propagation true' : ''}`];
      for (const r of c.routes) L2.push(`az network route-table route create -g ${g} --route-table-name ${nom} -n ${nomAzure(r.nom || r.prefixe, 'route')} --address-prefix ${r.prefixe || '<destination>'} --next-hop-type ${r.saut}${r.saut === 'VirtualAppliance' ? ` --next-hop-ip-address ${r.ip || '<ip>'}` : ''}`);
      L2.push(...assoc('sousReseaux', 'route-table'));
      bloc(`Table de routage ${nom}`, L2);
      break;
    }
    case 'zone-dns': {
      const d = c.domaine || '<domaine>'; const pv = c.privee ? 'private-dns' : 'dns';
      const L2 = [...P.map((x) => (c.privee ? x : '# Portail : Zones DNS > + Créer')), `az network ${pv} zone create -g ${g} -n ${d}`];
      if (c.privee) for (const id of c.vnets) { const v = ctx.vnets.find((x) => x.id === id); if (v) L2.push(`az network private-dns link vnet create -g ${g} -z ${d} -n lien-${v.nom} -v ${v.groupe === g ? v.nom : `$(az network vnet show -g ${v.groupe} -n ${v.nom} --query id -o tsv)`} -e ${c.inscription ? 'true' : 'false'}`); }
      for (const r of c.enregistrements) {
        if (r.genre === 'A') L2.push(`az network ${pv} record-set a add-record -g ${g} -z ${d} -n ${r.nom || '@'} -a ${r.valeur}`);
        else if (r.genre === 'CNAME') L2.push(`az network ${pv} record-set cname set-record -g ${g} -z ${d} -n ${r.nom} -c ${r.valeur}`);
        else L2.push(`az network ${pv} record-set txt add-record -g ${g} -z ${d} -n ${r.nom || '@'} -v ${q(r.valeur)}`);
      }
      if (c.administrateur) L2.push(`az role assignment create --assignee ${q(c.administrateur)} --role "${c.privee ? 'Private DNS Zone Contributor' : 'DNS Zone Contributor'}" --scope $(az network ${pv} zone show -g ${g} -n ${d} --query id -o tsv)`);
      bloc(`Zone DNS ${c.privee ? 'privée' : 'publique'} ${d}`, L2);
      break;
    }
    case 'equilibreur': {
      const interne = c.genre === 'interne'; const s = sn(c.sousReseau) ?? o.sousReseau;
      const L2 = [...P];
      if (!interne) L2.push(`az network public-ip create -g ${g} -n ${nom}-ip -l ${l} --sku Standard --allocation-method Static`);
      L2.push(`az network lb create -g ${g} -n ${nom} -l ${l} --sku Standard --frontend-ip-name avant --backend-pool-name pool${interne ? ` --vnet-name ${s?.vnet?.nom ?? '<vnet>'} --subnet ${s?.nom ?? '<sous-reseau>'}${c.ipFrontend ? ` --private-ip-address ${c.ipFrontend}` : ''}` : ` --public-ip-address ${nom}-ip`}`);
      L2.push(`az network lb probe create -g ${g} --lb-name ${nom} -n sonde --protocol Tcp --port ${c.sonde || c.portBackend || 80}`);
      L2.push(`az network lb rule create -g ${g} --lb-name ${nom} -n regle --protocol ${c.protocole} --frontend-port ${c.portFrontend || 80} --backend-port ${c.portBackend || 80} --frontend-ip-name avant --backend-pool-name pool --probe-name sonde`);
      for (const id of c.backend) { const vm = schema.noeuds.find((x) => x.id === id); if (vm) { const v = nomAzure(vm.nom, 'vm'); L2.push(`az network nic ip-config address-pool add -g ${ctx.noeud(vm).groupe} --nic-name ${v}VMNic --ip-config-name ipconfig${v} --lb-name ${nom} --address-pool pool`); } }
      bloc(`Équilibreur de charge ${nom}`, L2);
      break;
    }
    case 'passerelle-app': {
      const s = sn(c.sousReseau) ?? o.sousReseau;
      bloc(`Application Gateway ${nom}`, [...P, `az network public-ip create -g ${g} -n ${nom}-ip -l ${l} --sku Standard --allocation-method Static`,
        `az network application-gateway create -g ${g} -n ${nom} -l ${l} --sku ${c.sku} --capacity 2 --vnet-name ${s?.vnet?.nom ?? '<vnet>'} --subnet ${s?.nom ?? '<sous-reseau>'} --public-ip-address ${nom}-ip --servers ${listeV(c.serveurs).join(' ') || '<serveurs>'} --frontend-port ${c.port || 80} --http-settings-port ${c.port || 80} --http-settings-protocol Http --priority 100`]);
      break;
    }
    case 'pare-feu-azure': {
      const v = ctx.vnets.find((x) => x.id === c.vnet) ?? o.vnet;
      bloc(`Azure Firewall ${nom}`, [...P, 'az extension add -n azure-firewall', `az network public-ip create -g ${g} -n ${nom}-ip -l ${l} --sku Standard --allocation-method Static`,
        `az network firewall create -g ${g} -n ${nom} -l ${l} --sku AZFW_VNet --tier ${c.tier}`,
        `az network firewall ip-config create -g ${g} -f ${nom} -n ${nom}-config --public-ip-address ${nom}-ip --vnet-name ${v?.nom ?? '<vnet>'}`,
        `az network firewall show -g ${g} -n ${nom} --query "ipConfigurations[0].privateIPAddress" -o tsv`]);
      break;
    }
    case 'bastion': {
      const v = ctx.vnets.find((x) => x.id === c.vnet) ?? o.vnet;
      bloc(`Bastion ${nom}`, [...P, `az network public-ip create -g ${g} -n ${nom}-ip -l ${l} --sku Standard --allocation-method Static`, `az network bastion create -g ${g} -n ${nom} -l ${l} --public-ip-address ${nom}-ip --vnet-name ${v?.nom ?? '<vnet>'} --sku ${c.sku}`]);
      break;
    }
    case 'ip-publique':
      bloc(`IP publique ${nom}`, [...P, `az network public-ip create -g ${g} -n ${nom} -l ${l} --sku Standard --allocation-method ${c.allocation} --version IPv4`]);
      break;
    case 'passerelle-nat':
      bloc(`Passerelle NAT ${nom}`, [...P, `az network public-ip create -g ${g} -n ${nom}-ip -l ${l} --sku Standard --allocation-method Static`, `az network nat gateway create -g ${g} -n ${nom} -l ${l} --public-ip-addresses ${nom}-ip --idle-timeout 4`, ...assoc('sousReseaux', 'nat-gateway')]);
      break;
    case 'passerelle-vpn': {
      const v = ctx.vnets.find((x) => x.id === c.vnet) ?? o.vnet;
      bloc(`Passerelle VPN ${nom}`, [...P, `az network public-ip create -g ${g} -n ${nom}-ip -l ${l} --sku Standard --allocation-method Static`,
        `az network vnet-gateway create -g ${g} -n ${nom} -l ${l} --vnet ${v?.nom ?? '<vnet>'} --public-ip-addresses ${nom}-ip --gateway-type Vpn --vpn-type RouteBased --sku ${c.sku} --no-wait`, '# La création prend de 30 à 45 minutes.']);
      break;
    }
    case 'front-door':
      bloc(`Front Door ${nom}`, [...P, `az afd profile create -g ${g} --profile-name ${nom} --sku Standard_AzureFrontDoor`, `az afd endpoint create -g ${g} --profile-name ${nom} --endpoint-name ${nom}-ep --enabled-state Enabled`,
        ...(c.origine ? [`az afd origin-group create -g ${g} --profile-name ${nom} --origin-group-name origines --probe-request-type GET --probe-protocol Https --probe-interval-in-seconds 60 --probe-path / --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50`,
          `az afd origin create -g ${g} --profile-name ${nom} --origin-group-name origines --origin-name origine1 --host-name ${c.origine} --origin-host-header ${c.origine} --priority 1 --weight 1000 --enabled-state Enabled --https-port 443`] : [])]);
      break;
    case 'log-analytics':
      bloc(`Log Analytics ${nom}`, [...P, `az monitor log-analytics workspace create -g ${g} -n ${nom} -l ${l} --retention-time ${c.retention || 30}`]);
      break;
    default:
      bloc(`${typeAzure(n.type)?.label ?? 'Service'} ${nom}`, [`# ${c.service || 'Service Azure'} : à créer dans le portail (groupe ${g}, région ${l}).`]);
  }
  const av = verifierAzure(schema).filter((x) => x.includes(nom));
  return { blocs: B, avertissements: av };
}

/** Texte d'un résultat de commandes (titres en commentaires). */
export const texteAzure = (r) => r.blocs.map((b) => [`# --- ${b.titre} ---`, ...b.lignes].join('\n')).join('\n');

/** Ordre de déploiement : groupes, VNet (sous-réseaux, appairages), puis les ressources dans un ordre qui marche. */
const ORDRE = ['nsg', 'table-routage', 'ip-publique', 'passerelle-nat', 'stockage', 'base-sql', 'coffre-cles', 'event-hub', 'log-analytics', 'vm', 'appliance', 'app-service', 'fonction',
  'point-terminaison-prive', 'zone-dns', 'equilibreur', 'passerelle-app', 'bastion', 'pare-feu-azure', 'passerelle-vpn', 'front-door', 'service-cloud'];
/** Script complet du schéma. */
export function scriptAzure(schema) {
  const ctx = contexteAzure(schema);
  const groupes = new Map();
  for (const v of ctx.vnets) groupes.set(v.groupe, v.region);
  for (const n of schema.noeuds) if (estAzure(n.type)) { const o = ctx.noeud(n); if (!groupes.has(o.groupe)) groupes.set(o.groupe, o.region); }
  const blocs = [];
  if (groupes.size) blocs.push({ titre: 'Groupes de ressources', lignes: ['az login', ...[...groupes].map(([g, r]) => `az group create -n ${g} -l ${r}`)] });
  for (const v of ctx.vnets) blocs.push(...commandesZone(schema, v.zone, { appairages: false }).blocs);
  const app = ctx.vnets.flatMap((v) => lignesAppairages(ctx, v));
  const apresNoeuds = ctx.vnets.some((v) => v.c.passerelleDistante);   // la passerelle doit exister avant « use-remote-gateways »
  const blocApp = { titre: apresNoeuds ? 'Appairages (après la passerelle VPN)' : 'Appairages (après la création des deux VNet)', lignes: apresNoeuds ? [...schema.noeuds.filter((n) => n.type === 'passerelle-vpn').map((n) => `az network vnet-gateway wait -g ${ctx.noeud(n).groupe} -n ${nomAzure(n.nom, n.type)} --created`), ...app] : app };
  if (app.length && !apresNoeuds) blocs.push(blocApp);
  const noeuds = schema.noeuds.filter((n) => estAzure(n.type)).sort((a, b) => ORDRE.indexOf(a.type) - ORDRE.indexOf(b.type));
  // Une zone DNS privée et ses liens ne se créent qu'une fois, même si plusieurs points de terminaison l'utilisent.
  const dejaFait = new Set();
  for (const n of noeuds) for (const b of commandesAzure(schema, n).blocs) {
    const lignes = b.lignes.filter((x) => { if (!/^az network private-dns (zone create|link vnet create)/.test(x)) return true; if (dejaFait.has(x)) return false; dejaFait.add(x); return true; });
    blocs.push({ ...b, lignes });
  }
  if (app.length && apresNoeuds) blocs.push(blocApp);
  const droits = droitsAppairages(ctx);
  if (droits.length) blocs.push({ titre: 'Droits pour créer et supprimer les appairages (rôle Network Contributor)', lignes: ['# À donner sur chaque VNet appairé ; pour supprimer une moitié distante, le droit est aussi nécessaire sur l’autre VNet.', ...droits] });
  return { blocs, avertissements: verifierAzure(schema) };
}

/* ---------------------------------------------------------------------------
 * Ce que le schéma Azure apporte au document
 * ------------------------------------------------------------------------ */
/** Lignes du plan d'adressage : une par sous-réseau, puis les IP connues des ressources. */
export function adressageAzure(schema) {
  const ctx = contexteAzure(schema); const lignes = [];
  for (const s of ctx.sousReseaux) {
    if (!s.c.plage) continue;
    const u = utilisablesAzure(s.c.plage); const a = cidr(s.c.plage);
    lignes.push({ equipement: s.vnet?.nom ?? '', interface: s.nom, adresse: s.c.plage, vlan: s.vnet ? REGIONS.find(([r]) => r === s.vnet.region)?.[1] ?? s.vnet.region : '',
      passerelle: a ? `${a.reseau.split('.').slice(0, 3).join('.')}.${Number(a.reseau.split('.')[3]) + 1} (Azure)` : '',
      note: `${u} adresse(s) utilisable(s)${s.c.besoin ? ` pour ${s.c.besoin} demandée(s)` : ''}${s.c.delegation ? ` · délégué à ${s.c.delegation}` : ''}` });
  }
  for (const n of schema.noeuds) {
    if (!estAzure(n.type)) continue;
    const c = normaliserConfigAzure(n.type, n.config) ?? {}; const o = ctx.noeud(n);
    const ip = c.ipPrivee || c.ip || c.ipFrontend || (ipSeule(n.note) ? n.note.trim() : '');
    if (!ip) continue;
    const s = n.type === 'point-terminaison-prive' && c.sousReseau ? ctx.sousReseaux.find((x) => x.id === c.sousReseau) : o.sousReseau;
    lignes.push({ equipement: nomAzure(n.nom, n.type), interface: n.type === 'point-terminaison-prive' ? (c.sousRessource || 'pe') : 'nic0', adresse: ip, vlan: s ? `${s.vnet?.nom ?? ''}/${s.nom}` : '', passerelle: '', note: typeAzure(n.type)?.label ?? '' });
  }
  return lignes;
}
/** Tables de la fiche d'inventaire d'une ressource : routes, règles, enregistrements DNS. */
export function tablesAzure(schema, n) {
  const c = normaliserConfigAzure(n.type, n.config) ?? {};
  if (n.type === 'table-routage') return { routes: c.routes.map((r) => ({ type: 'UDR', destination: r.prefixe, via: r.saut === 'VirtualAppliance' ? r.ip : r.saut, interface: '', pourquoi: r.nom })) };
  if (n.type === 'nsg') return { regles: c.regles.map((r) => ({ priorite: r.priorite, nom: `${r.nom} (${r.direction === 'Inbound' ? 'entrant' : 'sortant'})`, port: `${r.protocole}/${r.ports || '*'}`, source: r.source, action: r.acces === 'Allow' ? 'Autoriser' : 'Refuser' })) };
  if (n.type === 'zone-dns') return { dns: c.enregistrements.map((r) => ({ nom: r.nom, type: r.genre, valeur: r.valeur })) };
  if (n.type === 'app-service') return { regles: c.restrictions.map((r) => ({ priorite: r.priorite, nom: r.nom, port: '443', source: r.source, action: r.action === 'Allow' ? 'Autoriser' : 'Refuser' })) };
  return {};
}
/** Modèle à noter dans la fiche (taille, niveau, SKU). */
export function modeleAzure(n) {
  const c = normaliserConfigAzure(n.type, n.config) ?? {};
  return c.taille || (c.sku ? `${typeAzure(n.type)?.label} ${c.sku}` : '') || typeAzure(n.type)?.label || '';
}

/** Tests de validation proposés pour une ressource ou un VNet. */
export function testsAzure(schema, el) {
  const ctx = contexteAzure(schema); const T2 = []; const A = (test, attendu) => T2.push({ test, attendu, resultat: 'a-tester' });
  if (el.genre === 'vnet') {
    const v = ctx.vnets.find((x) => x.id === el.id); if (!v) return T2;
    A(`az network vnet subnet list -g ${v.groupe} --vnet-name ${v.nom} -o table`, `Sous-réseaux ${ctx.sousReseaux.filter((s) => s.vnet?.id === v.id).map((s) => `${s.nom} ${s.c.plage}`).join(', ') || 'attendus'}`);
    if (v.c.appairages.length || ctx.vnets.some((w) => w.c.appairages.includes(v.id))) {
      A(`az network vnet peering list -g ${v.groupe} --vnet-name ${v.nom} --query "[].{nom:name,etat:peeringState,sync:peeringSyncLevel,distant:remoteVirtualNetwork.id}" -o table`, 'PeeringState « Connected » (« Initiated » = l’autre moitié manque), sync FullyInSync');
      const dist = ctx.vnets.find((w) => v.c.appairages.includes(w.id) || w.c.appairages.includes(v.id));
      if (dist) A(`az network nic show-effective-route-table -g ${v.groupe} -n <nic d’une VM de ${v.nom}> -o table`, `Une route « VNetPeering » vers ${dist.c.espace || 'l’espace de ' + dist.nom}`);
    }
    return T2;
  }
  if (!estAzure(el.type)) return T2;
  const c = normaliserConfigAzure(el.type, el.config) ?? {}; const o = ctx.noeud(el); const nom = nomAzure(el.nom, el.type);
  switch (el.type) {
    case 'point-terminaison-prive': {
      const cible = cibleDuPe(schema, el); const sr = SOUS_RESSOURCES[cible?.type]?.find(([gid]) => gid === c.sousRessource) ?? SOUS_RESSOURCES[cible?.type]?.[0];
      if (cible && sr) {
        const hote = sr[1].replace('privatelink.', `${nomAzure(cible.nom, cible.type).toLowerCase()}.`);
        A(`nslookup ${hote} (depuis une VM du VNet)`, `Alias ${sr[1].replace('privatelink.', `${nomAzure(cible.nom, cible.type).toLowerCase()}.privatelink.`)} et une adresse privée${c.ip ? ` ${c.ip}` : ''}`);
        A(`Accès à ${hote} depuis Internet`, 'Refusé (accès réseau public désactivé)');
      }
      A(`az network private-endpoint show -g ${o.groupe} -n ${nom} --query "privateLinkServiceConnections[0].privateLinkServiceConnectionState.status"`, 'Approved');
      break;
    }
    case 'stockage': A(`az storage account show -g ${o.groupe} -n ${nom} --query "{public:publicNetworkAccess, regle:networkRuleSet.defaultAction}"`, c.acces === 'desactive' ? 'public : Disabled' : c.acces === 'selection' ? 'regle : Deny (réseaux choisis)' : 'public : Enabled'); break;
    case 'app-service':
      A(`curl -I https://${nom.toLowerCase()}.azurewebsites.net`, c.acces === 'desactive' ? '403 Forbidden depuis Internet' : '200 OK');
      if (c.integration) A(`az webapp vnet-integration list -g ${o.groupe} -n ${nom} -o table`, 'Intégrée au sous-réseau choisi');
      if (c.chaines.length) A('Pages « Messages » et « Lister Blobs » de l’application', 'Le message s’ajoute à la file, les blobs sont listés');
      break;
    case 'vm': case 'appliance': A(`az vm show -d -g ${o.groupe} -n ${nom} --query "{prive:privateIps, public:publicIps}"`, `IP privée ${c.ipPrivee || 'dans ' + (o.sousReseau?.c.plage || 'son sous-réseau')}${c.ipPublique ? ', une IP publique' : ', aucune IP publique'}`); break;
    case 'table-routage': if (c.sousReseaux.length) A(`az network nic show-effective-route-table -g ${o.groupe} -n <carte réseau d’une VM du sous-réseau> -o table`, `Routes « User » : ${c.routes.map((r) => `${r.prefixe} → ${r.saut === 'VirtualAppliance' ? r.ip : r.saut}`).join(', ')}`); break;
    case 'nsg': A(`az network nic list-effective-nsg -g ${o.groupe} -n <carte réseau d’une VM> -o table`, `Règles ${c.regles.map((r) => r.nom).join(', ') || 'attendues'}`); break;
    case 'zone-dns': for (const r of c.enregistrements.slice(0, 6)) A(`nslookup ${r.nom === '@' ? '' : `${r.nom}.`}${c.domaine}${c.privee ? ' (depuis une VM d’un VNet lié)' : ''}`, r.valeur); break;
    case 'equilibreur': A(`curl http://<IP frontale>:${c.portFrontend || 80} (plusieurs fois)`, 'Réponses des VM du pool, à tour de rôle'); A(`az network lb show -g ${o.groupe} -n ${nom} --query "backendAddressPools[0].backendIPConfigurations[].id" -o tsv`, `${c.backend.length} membre(s) du pool`); break;
    case 'bastion': A('Portail : VM > Se connecter > Bastion', 'Session ouverte sans IP publique sur la VM'); break;
    case 'passerelle-vpn': A(`az network vnet-gateway show -g ${o.groupe} -n ${nom} --query provisioningState`, 'Succeeded'); break;
    default: break;
  }
  return T2;
}
