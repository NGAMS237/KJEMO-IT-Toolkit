/**
 * azure-types.mjs — JOURNAL-LABO-10 · KJEMO IT Toolkit
 * Données Azure sans dépendance (types de ressources, groupes de la palette,
 * genres de zones, régions), partagées par schema.mjs et config-azure.mjs.
 */
export const AZ = '#0a6c8f';
/** Groupes Azure de la palette. */
export const GROUPES_AZURE = [
  { id: 'az-reseau', label: 'Azure · Réseau' }, { id: 'az-calcul', label: 'Azure · Calcul et web' },
  { id: 'az-donnees', label: 'Azure · Stockage et données' }, { id: 'az-securite', label: 'Azure · Sécurité et supervision' },
];
/** Ressources Azure (types de nœuds). `code` : sigle dessiné ; `portail` : où la créer. */
export const TYPES_AZURE = [
  { id: 'vm', label: 'Machine virtuelle', groupe: 'az-calcul', code: 'VM', portail: 'Machines virtuelles > + Créer' },
  { id: 'app-service', label: 'App Service (application web)', groupe: 'az-calcul', code: 'WEB', portail: 'App Services > + Créer > Application web' },
  { id: 'fonction', label: 'Function App', groupe: 'az-calcul', code: 'FN', portail: 'Function App > + Créer' },
  { id: 'stockage', label: 'Compte de stockage', groupe: 'az-donnees', code: 'ST', portail: 'Comptes de stockage > + Créer' },
  { id: 'base-sql', label: 'Azure SQL Database', groupe: 'az-donnees', code: 'SQL', portail: 'Bases de données SQL > + Créer' },
  { id: 'event-hub', label: 'Event Hubs', groupe: 'az-donnees', code: 'EH', portail: 'Event Hubs > + Créer' },
  { id: 'point-terminaison-prive', label: 'Point de terminaison privé', groupe: 'az-reseau', code: 'PE', portail: 'Private Link > Points de terminaison privés > + Créer' },
  { id: 'nsg', label: 'Groupe de sécurité réseau (NSG)', groupe: 'az-reseau', code: 'NSG', portail: 'Groupes de sécurité réseau > + Créer' },
  { id: 'table-routage', label: 'Table de routage (UDR)', groupe: 'az-reseau', code: 'UDR', portail: 'Tables de routage > + Créer' },
  { id: 'zone-dns', label: 'Zone DNS (privée ou publique)', groupe: 'az-reseau', code: 'DNS', portail: 'Zones DNS privées > + Créer' },
  { id: 'equilibreur', label: 'Équilibreur de charge', groupe: 'az-reseau', code: 'LB', portail: 'Équilibreurs de charge > + Créer' },
  { id: 'passerelle-app', label: 'Application Gateway', groupe: 'az-reseau', code: 'AGW', portail: 'Passerelles d’application > + Créer' },
  { id: 'ip-publique', label: 'Adresse IP publique', groupe: 'az-reseau', code: 'IP', portail: 'Adresses IP publiques > + Créer' },
  { id: 'passerelle-nat', label: 'Passerelle NAT', groupe: 'az-reseau', code: 'NAT', portail: 'Passerelles NAT > + Créer' },
  { id: 'passerelle-vpn', label: 'Passerelle VPN', groupe: 'az-reseau', code: 'VPN', portail: 'Passerelles de réseau virtuel > + Créer' },
  { id: 'front-door', label: 'Front Door', groupe: 'az-reseau', code: 'AFD', portail: 'Front Door et CDN > + Créer' },
  { id: 'pare-feu-azure', label: 'Azure Firewall', groupe: 'az-securite', code: 'AFW', portail: 'Pare-feu > + Créer' },
  { id: 'bastion', label: 'Bastion', groupe: 'az-securite', code: 'BAS', portail: 'Bastions > + Créer' },
  { id: 'appliance', label: 'Appliance virtuelle (NVA)', groupe: 'az-securite', code: 'NVA', portail: 'Machines virtuelles > + Créer (transfert IP activé)' },
  { id: 'coffre-cles', label: 'Key Vault', groupe: 'az-securite', code: 'KV', portail: 'Coffres de clés > + Créer' },
  { id: 'log-analytics', label: 'Log Analytics', groupe: 'az-securite', code: 'LOG', portail: 'Espaces de travail Log Analytics > + Créer' },
  { id: 'service-cloud', label: 'Autre service Azure', groupe: 'az-calcul', code: '', portail: '' },
].map((t) => ({ ...t, couleur: AZ, systemes: ['azure'] }));
const PARID = new Map(TYPES_AZURE.map((t) => [t.id, t]));
export const estAzure = (type) => PARID.has(type);
export const typeAzure = (type) => PARID.get(type) ?? null;

/** Genres de zones Azure (dessinées autour des ressources). */
export const GENRES_ZONE = [
  { id: 'groupe', label: 'Groupe de ressources', trait: '#5d6a79', fond: '#f6f7f9', tirets: null },
  { id: 'region', label: 'Région', trait: '#7d8a99', fond: '#fafbfc', tirets: [2, 4] },
  { id: 'vnet', label: 'Réseau virtuel (VNet)', trait: '#0a8fa6', fond: '#eef9fb', tirets: [8, 5] },
  { id: 'sous-reseau', label: 'Sous-réseau', trait: '#4b5866', fond: '#ffffff', tirets: null },
];
export const genreZone = (id) => GENRES_ZONE.find((g) => g.id === id) ?? null;

export const REGIONS = [
  ['canadacentral', 'Canada Centre'], ['canadaeast', 'Canada Est'], ['francecentral', 'France Centre'], ['francesouth', 'France Sud'],
  ['eastus', 'Est des États-Unis'], ['westeurope', 'Europe de l’Ouest'], ['northeurope', 'Europe du Nord'],
];
