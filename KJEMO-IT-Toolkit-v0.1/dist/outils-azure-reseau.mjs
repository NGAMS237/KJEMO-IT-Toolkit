/**
 * outils-azure-reseau.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Famille D : réseau Azure. Quatre assistants, tous en lecture seule.
 *
 * Deux décisions de cette famille :
 *
 * 1. AUCUNE OUVERTURE, JAMAIS. Le lot ne génère aucune règle de groupe de
 *    sécurité réseau (NSG). Il LIT les règles et signale celles qui exposent un
 *    accès administratif (SSH, RDP, WinRM) à Internet. L'idée de « ouvrir le
 *    port 3389 pour tester » est la source d'une bonne partie des intrusions
 *    sur des machines de laboratoire ; la bonne réponse est Azure Bastion, un
 *    VPN ou un accès juste-à-temps, expliqués dans la fiche, jamais un réglage
 *    par défaut.
 *
 * 2. LE DIAGNOSTIC DE CONNECTIVITÉ SORT DU POSTE, PAS D'AZURE. Network Watcher
 *    (tests de connexion, capture de paquets) crée des ressources et écrit :
 *    ce n'est pas de la lecture seule, donc ce n'est pas ici. Le diagnostic
 *    DNS et TCP se fait depuis le poste de la personne, avec des appels .NET,
 *    sans les commandes DnsClient propres à Windows — ce qui le laisse
 *    exécutable sous PowerShell 7 sur Linux.
 */

import { psB64 } from './noyau.mjs';
import {
  outilAzure,
  rollbackLecture,
  CHECKS_LECTURE,
  LIGNES_NOM_DEPUIS_ID,
} from './noyau-azure.mjs';
import {
  validerGroupeRessources,
  validerNomRessource,
  validerNomDns,
  validerBorne,
  validerChoixAzure,
} from './validateurs-azure.mjs';

const FAMILLE = 'Réseau Azure';
const doc = (chemin) => `https://learn.microsoft.com/${chemin}`;
const verif = (errors, champ, r) => { if (!r.ok) errors[champ] = r.error; return r; };

const PREREQS_RESEAU = ['Rôle Lecteur (Reader) sur les groupes de ressources réseau, au minimum.'];

const ERREURS_RESEAU = [
  {
    message: 'Un sous-réseau « sans groupe de sécurité réseau » est signalé',
    cause: 'Le sous-réseau n’a pas de NSG associé ; l’interface réseau peut en porter un.',
    fix: 'Vérifie les deux niveaux (sous-réseau ET interface) avant de conclure à une absence de filtrage. Les sous-réseaux réservés (GatewaySubnet, AzureBastionSubnet, AzureFirewallSubnet…) ont leurs propres règles.',
  },
];

/** Aide PowerShell : plage IPv4 d'un préfixe CIDR, pour détecter les chevauchements. */
const LIGNES_PLAGE_IPV4 = [
  'function Get-KjemoPlageIPv4 {',
  '  param([string]$Cidr)',
  "  $p = $Cidr -split '/'",
  '  if ($p.Count -ne 2) { return $null }',
  '  $ip = $null',
  '  if (-not [System.Net.IPAddress]::TryParse($p[0], [ref]$ip)) { return $null }',
  '  if ($ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { return $null }',
  '  $longueur = 0',
  '  if (-not [int]::TryParse($p[1], [ref]$longueur)) { return $null }',
  '  if ($longueur -lt 0 -or $longueur -gt 32) { return $null }',
  '  $o = $ip.GetAddressBytes()',
  '  [long]$n = ([long]$o[0] * 16777216) + ([long]$o[1] * 65536) + ([long]$o[2] * 256) + [long]$o[3]',
  '  [long]$taille = [Math]::Pow(2, 32 - $longueur)',
  '  [long]$debut = [Math]::Floor($n / $taille) * $taille',
  '  return @($debut, ($debut + $taille - 1))',
  '}',
];

// ===========================================================================
// 13. azure-reseau-vnets
// ===========================================================================
export const outilAzureReseauVnets = outilAzure({
  id: 'azure-reseau-vnets',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-reseau-vnets',
  title: 'Réseaux virtuels (VNet) et sous-réseaux : plan d’adressage et diagnostic',
  summary: 'Liste les réseaux virtuels, leurs plages d’adresses, leurs sous-réseaux (avec groupe de sécurité et table de routage), leurs appairages et leurs serveurs DNS. Détecte les plages qui se chevauchent entre réseaux (appairage impossible). Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzVirtualNetwork'], facultatives: [] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources (facultatif)', default: '', help: 'Vide = tout l’abonnement. Nom exact, sans joker.' },
    { id: 'azLimite', label: 'Nombre maximal de réseaux détaillés', type: 'number', default: '50', min: 1, max: 200, help: 'Entre 1 et 200.' },
  ],
  verifier(v, errors) {
    if (String(v.azRg ?? '').trim()) verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 200, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg ?? '').trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 200).value))],
  ],
  corps: () => [
    ...LIGNES_NOM_DEPUIS_ID,
    ...LIGNES_PLAGE_IPV4,
    "$vnets = @(Invoke-KjemoLecture 'Reseaux virtuels' 'Liste' {",
    '  if ($KjemoArgRg) { Get-AzVirtualNetwork -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzVirtualNetwork -ErrorAction Stop }',
    '})',
    'if ($script:KjemoLectureOk) {',
    "  [void](Add-KjemoResultat -Categorie 'Reseaux virtuels' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$vnets.Count + ' reseau(x)'))",
    '  $reserves = @(\'GatewaySubnet\', \'AzureFirewallSubnet\', \'AzureFirewallManagementSubnet\', \'AzureBastionSubnet\', \'RouteServerSubnet\')',
    '  $plages = @()',
    '  foreach ($vn in @($vnets | Sort-Object -Property Name | Select-Object -First ([int]$KjemoArgLimite))) {',
    '    $prefixes = @($vn.AddressSpace.AddressPrefixes)',
    "    $dns = 'DNS fourni par Azure (par defaut)'",
    '    if ($null -ne $vn.DhcpOptions -and @($vn.DhcpOptions.DnsServers).Count -gt 0) { $dns = \'DNS PERSONNALISE : \' + (@($vn.DhcpOptions.DnsServers) -join \', \') }',
    "    [void](Add-KjemoResultat -Categorie 'Reseaux virtuels' -Controle ([string]$vn.Name) -Etat 'INFO' -Valeur ($prefixes -join ', ') -Commentaire ('Region : ' + [string]$vn.Location + '. ' + $dns + '.'))",
    '    foreach ($pf in $prefixes) {',
    '      $r = Get-KjemoPlageIPv4 ([string]$pf)',
    '      if ($null -ne $r) { $plages += [pscustomobject]@{ Reseau = [string]$vn.Name; Prefixe = [string]$pf; Debut = $r[0]; Fin = $r[1] } }',
    '    }',
    '    foreach ($sn in @($vn.Subnets)) {',
    '      if ($null -eq $sn) { continue }',
    '      $nsg = Get-KjemoNomDepuisId $sn.NetworkSecurityGroup',
    '      $rt = Get-KjemoNomDepuisId $sn.RouteTable',
    "      $etat = 'INFO'",
    "      $note = 'Groupe de securite : ' + $(if ($nsg) { $nsg } else { 'aucun' }) + '. Table de routage : ' + $(if ($rt) { $rt } else { 'aucune' }) + '.'",
    "      if (-not $nsg -and ($reserves -notcontains [string]$sn.Name)) { $etat = 'ATTENTION'; $note = $note + ' Aucun NSG sur ce sous-reseau : verifier s un NSG est porte par les interfaces.' }",
    "      [void](Add-KjemoResultat -Categorie 'Sous-reseaux' -Controle ([string]$vn.Name + ' / ' + [string]$sn.Name) -Etat $etat -Valeur (@($sn.AddressPrefix) -join \', \') -Commentaire $note)",
    '    }',
    '    foreach ($pe in @($vn.VirtualNetworkPeerings)) {',
    '      if ($null -eq $pe) { continue }',
    "      $etatPe = 'INFO'",
    "      if ([string]$pe.PeeringState -ne 'Connected') { $etatPe = 'ATTENTION' }",
    "      [void](Add-KjemoResultat -Categorie 'Appairages' -Controle ([string]$vn.Name + ' -> ' + [string]$pe.Name) -Etat $etatPe -Valeur ([string]$pe.PeeringState) -Commentaire 'Un appairage doit etre Connected des DEUX cotes pour que le trafic circule.')",
    '    }',
    '  }',
    '  for ($i = 0; $i -lt $plages.Count; $i++) {',
    '    for ($j = $i + 1; $j -lt $plages.Count; $j++) {',
    '      if ($plages[$i].Reseau -eq $plages[$j].Reseau) { continue }',
    '      if ($plages[$i].Debut -le $plages[$j].Fin -and $plages[$j].Debut -le $plages[$i].Fin) {',
    "        [void](Add-KjemoResultat -Categorie 'Plan d adressage' -Controle ($plages[$i].Reseau + ' / ' + $plages[$j].Reseau) -Etat 'ATTENTION' -Valeur ($plages[$i].Prefixe + ' chevauche ' + $plages[$j].Prefixe) -Commentaire 'Deux reseaux aux plages qui se chevauchent ne peuvent pas etre appaires ni relies par VPN sans conflit. Ce n est qu un constat : rien n est modifie.')",
    '      }',
    '    }',
    '  }',
    '  if ($vnets.Count -gt [int]$KjemoArgLimite) {',
    "    [void](Add-KjemoResultat -Categorie 'Reseaux virtuels' -Controle 'Limite' -Etat 'INFO' -Valeur ('seuls les ' + [string]$KjemoArgLimite + ' premiers sont detailles') -Commentaire 'Le controle de chevauchement ne porte que sur les reseaux detailles.')",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Réseaux virtuels : la liste, avec l’espace d’adressage et le groupe de ressources.',
    'Réseau virtuel > Sous-réseaux : plage, NSG associé, table de routage, points de terminaison de service.',
    'Réseau virtuel > Appairages : l’état (Connecté, Initié, Déconnecté) de chaque appairage.',
    'Réseau virtuel > Serveurs DNS : « Par défaut (fourni par Azure) » ou serveurs personnalisés.',
  ],
  keywords: ['vnet', 'reseau virtuel', 'sous-reseau', 'subnet', 'get-azvirtualnetwork', 'plan d adressage', 'chevauchement', 'peering', 'appairage', 'dns personnalise', 'cidr', 'plage ip azure'],
  prereqs: PREREQS_RESEAU,
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Les plages de deux réseaux se chevauchent',
      cause: 'Deux réseaux virtuels ont été créés avec des plages qui se recouvrent (par exemple deux 10.0.0.0/16).',
      fix: 'Le chevauchement est un constat. Pour appairer ou relier ces réseaux il faudra recréer l’un d’eux avec un autre plan d’adressage : décision à planifier, pas un correctif automatique.',
    },
  ]),
  verifyAfter: [
    'Compare une plage d’adresses et un sous-réseau avec la page du réseau virtuel dans le portail.',
    'Pour un appairage « ATTENTION », ouvre le réseau de l’autre côté : l’état doit être Connecté des deux côtés.',
    'Aucune ligne n’est INACCESSIBLE ; sinon des réseaux manquent au plan d’adressage.',
  ],
  rollback: rollbackLecture('# Un réseau virtuel précis\nGet-AzVirtualNetwork -ResourceGroupName \'rg-lab\' -Name \'vnet-lab\''),
  checks: CHECKS_LECTURE.concat(['Aucune règle, aucun sous-réseau, aucun appairage n’est créé, modifié ou supprimé.']),
  source: doc('powershell/module/az.network/get-azvirtualnetwork'),
  sources: [
    { label: 'Get-AzVirtualNetwork', url: doc('powershell/module/az.network/get-azvirtualnetwork') },
    { label: 'Réseaux virtuels Azure : vue d’ensemble', url: doc('azure/virtual-network/virtual-networks-overview') },
    { label: 'Appairage de réseaux virtuels', url: doc('azure/virtual-network/virtual-network-peering-overview') },
  ],
  cloud: {
    probleme: 'Avant de dépanner une connexion entre deux machines, il faut voir le plan d’adressage : dans quel réseau, quel sous-réseau, quelle plage, quel DNS.',
    exemple: 'Le laboratoire doit relier deux réseaux. Le rapport montre que les deux utilisent 10.0.0.0/16 : l’appairage est impossible tant que l’un des deux n’est pas redessiné.',
    lit: ['Les réseaux virtuels, leurs plages, sous-réseaux, appairages et serveurs DNS'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur les groupes de ressources lus'],
    licences: ['Aucune'],
    limites: [
      'Le contrôle de chevauchement ne couvre que les plages IPv4.',
      'Les itinéraires effectifs et les règles effectives d’une interface ne sont pas calculés (cela passe par Network Watcher, qui n’est pas en lecture seule).',
      'Les réseaux d’un autre abonnement ne sont pas lus.',
    ],
  },
});

// ===========================================================================
// 14. azure-reseau-interfaces-ip
// ===========================================================================
export const outilAzureReseauInterfaces = outilAzure({
  id: 'azure-reseau-interfaces-ip',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-reseau-interfaces',
  title: 'Interfaces réseau et adresses IP (privées et publiques)',
  summary: 'Dans un groupe de ressources : interfaces réseau, adresses privées et leur mode d’allocation, adresses IP publiques (adresse, SKU, allocation), et celles qui ne sont rattachées à rien. Signale les interfaces exposées par une adresse publique. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzNetworkInterface', 'Get-AzPublicIpAddress'], facultatives: [] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources', default: 'rg-lab', help: 'Nom exact, sans joker.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azRg', validerGroupeRessources(v.azRg));
  },
  parametres: (v) => [['Rg', psB64(String(v.azRg).trim())]],
  corps: () => [
    ...LIGNES_NOM_DEPUIS_ID,
    "$nics = @(Invoke-KjemoLecture 'Interfaces reseau' 'Interfaces du groupe' { Get-AzNetworkInterface -ResourceGroupName $KjemoArgRg -ErrorAction Stop })",
    '$lectureNic = $script:KjemoLectureOk',
    "$pips = @(Invoke-KjemoLecture 'Adresses IP publiques' 'Adresses du groupe' { Get-AzPublicIpAddress -ResourceGroupName $KjemoArgRg -ErrorAction Stop })",
    '$lecturePip = $script:KjemoLectureOk',
    '$parId = @{}',
    'if ($lecturePip) { foreach ($p in $pips) { $parId[([string]$p.Id).ToLowerInvariant()] = $p } }',
    'if ($lectureNic) {',
    "  [void](Add-KjemoResultat -Categorie 'Interfaces reseau' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$nics.Count + ' interface(s)'))",
    '  foreach ($n in @($nics | Sort-Object -Property Name)) {',
    '    $vmNom = Get-KjemoNomDepuisId $n.VirtualMachine',
    '    foreach ($c in @($n.IpConfigurations)) {',
    '      if ($null -eq $c) { continue }',
    "      $etat = 'INFO'",
    "      $note = 'Machine : ' + $(if ($vmNom) { $vmNom } else { 'aucune' }) + '. Allocation privee : ' + [string]$c.PrivateIpAllocationMethod + '.'",
    "      $pubTexte = 'aucune adresse publique'",
    '      $pubId = \'\'',
    '      if ($null -ne $c.PublicIpAddress) { $pubId = [string]$c.PublicIpAddress.Id }',
    '      if ($pubId) {',
    '        $pubNom = Get-KjemoNomDepuisId $pubId',
    "        $pubTexte = 'adresse publique ' + $pubNom",
    '        if ($lecturePip -and $parId.ContainsKey($pubId.ToLowerInvariant())) { $pubTexte = $pubTexte + \' (\' + [string]$parId[$pubId.ToLowerInvariant()].IpAddress + \')\' }',
    "        $etat = 'ATTENTION'",
    "        $note = $note + ' EXPOSEE : cette interface porte une adresse publique. Le trafic reel depend des regles du NSG (voir l assistant NSG).'",
    '      }',
    "      [void](Add-KjemoResultat -Categorie 'Interfaces reseau' -Controle ([string]$n.Name) -Etat $etat -Valeur ([string]$c.PrivateIpAddress + ' ; ' + $pubTexte) -Commentaire $note)",
    '    }',
    '  }',
    '}',
    'if ($lecturePip) {',
    "  [void](Add-KjemoResultat -Categorie 'Adresses IP publiques' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$pips.Count + ' adresse(s)'))",
    '  foreach ($p in @($pips | Sort-Object -Property Name)) {',
    "    $etat = 'INFO'",
    "    $note = 'SKU : ' + [string]$p.Sku.Name + '. Allocation : ' + [string]$p.PublicIpAllocationMethod + '. Region : ' + [string]$p.Location + '.'",
    "    $valeur = [string]$p.IpAddress",
    "    if (-not $valeur) { $valeur = 'adresse non attribuee' }",
    '    if ($null -eq $p.IpConfiguration) {',
    "      $etat = 'ATTENTION'",
    "      $note = $note + ' NON RATTACHEE a une interface ou a un equipement. Une adresse publique allouee peut etre facturee meme inutilisee : verifier la grille tarifaire avant toute decision. Rien n est supprime ici.'",
    '    }',
    "    [void](Add-KjemoResultat -Categorie 'Adresses IP publiques' -Controle ([string]$p.Name) -Etat $etat -Valeur $valeur -Commentaire $note)",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Interfaces réseau : adresses IP privées et publiques, machine rattachée, groupe de sécurité.',
    'Portail Azure > Adresses IP publiques : adresse, SKU (Basic ou Standard), allocation, ressource associée.',
    'Une machine > Mise en réseau : les règles de port entrantes et sortantes effectives pour chaque interface.',
    'Gestion des coûts > Analyse des coûts, type de ressource « Adresse IP publique » : ce que les adresses coûtent.',
  ],
  keywords: ['interface reseau', 'nic', 'adresse ip', 'ip publique', 'public ip', 'get-azpublicipaddress', 'get-aznetworkinterface', 'ip privee', 'ip statique', 'ip dynamique', 'adresse exposee', 'ip non rattachee'],
  prereqs: PREREQS_RESEAU,
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Une adresse IP publique apparaît sans adresse',
      cause: 'Une IP dynamique n’a pas d’adresse tant que la ressource associée n’est pas démarrée.',
      fix: 'Ce n’est pas une erreur. Démarre la machine ou lis l’allocation « Static » si une adresse stable est requise.',
    },
  ]),
  verifyAfter: [
    'Compare une interface et son adresse avec la page de la machine dans le portail.',
    'Pour une interface « EXPOSEE », ouvre ses règles effectives : l’adresse publique ne prouve pas à elle seule que le port est ouvert.',
    'Aucune ligne n’est INACCESSIBLE ; sinon la liste est incomplète.',
  ],
  rollback: rollbackLecture('# Les adresses IP publiques du groupe\nGet-AzPublicIpAddress -ResourceGroupName \'rg-lab\' | Select-Object Name, IpAddress, PublicIpAllocationMethod'),
  checks: CHECKS_LECTURE.concat(['Aucune adresse n’est créée, associée, libérée ni supprimée.']),
  source: doc('powershell/module/az.network/get-azpublicipaddress'),
  sources: [
    { label: 'Get-AzNetworkInterface', url: doc('powershell/module/az.network/get-aznetworkinterface') },
    { label: 'Get-AzPublicIpAddress', url: doc('powershell/module/az.network/get-azpublicipaddress') },
    { label: 'Adresses IP publiques Azure', url: doc('azure/virtual-network/ip-services/public-ip-addresses') },
  ],
  cloud: {
    probleme: 'Quelles machines sont joignables depuis Internet ? Quelles adresses publiques traînent sans servir ? La réponse commence par la liste des interfaces et des adresses.',
    exemple: 'Un laboratoire contient une machine avec une adresse publique et trois adresses publiques orphelines. Le rapport les distingue, sans toucher à rien.',
    lit: ['Les interfaces réseau et leurs configurations IP', 'Les adresses IP publiques du groupe'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur le groupe de ressources'],
    licences: ['Aucune'],
    limites: [
      'Une adresse publique sur une interface n’est qu’un indice d’exposition : seuls les NSG, pare-feu et règles du système décident de ce qui passe.',
      'La facturation des adresses non rattachées dépend du SKU et de la région : le rapport invite à vérifier, il ne chiffre rien.',
      'Les interfaces d’un autre groupe de ressources ne sont pas lues.',
    ],
  },
});

// ===========================================================================
// 15. azure-reseau-nsg
// ===========================================================================
export const outilAzureReseauNsg = outilAzure({
  id: 'azure-reseau-nsg',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-reseau-nsg',
  title: 'Groupes de sécurité réseau (NSG) : règles et accès administratifs exposés',
  summary: 'Lit les NSG d’un groupe de ressources, liste leurs règles personnalisées et signale celles qui autorisent depuis Internet un accès administratif (SSH, RDP, WinRM) ou tout le trafic entrant. N’ajoute, ne modifie ni ne supprime aucune règle.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzNetworkSecurityGroup'], facultatives: [] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources', default: 'rg-lab', help: 'Nom exact, sans joker.' },
    { id: 'azNsg', label: 'Groupe de sécurité réseau (facultatif)', default: '', help: 'Vide = tous les NSG du groupe. Nom exact, sans joker.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    if (String(v.azNsg ?? '').trim()) verif(errors, 'azNsg', validerNomRessource(v.azNsg, 'Le NSG'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg).trim())],
    ['Nsg', psB64(String(v.azNsg ?? '').trim())],
  ],
  corps: () => [
    ...LIGNES_NOM_DEPUIS_ID,
    'function Test-KjemoPortDansPlages {',
    '  param($Plages, [int]$Port)',
    '  foreach ($r in @($Plages)) {',
    '    $t = ([string]$r).Trim()',
    "    if ($t -eq '*') { return $true }",
    "    if ($t -match '^(\\d+)-(\\d+)$') { if ($Port -ge [int]$Matches[1] -and $Port -le [int]$Matches[2]) { return $true } }",
    "    elseif ($t -match '^\\d+$') { if ([int]$t -eq $Port) { return $true } }",
    '  }',
    '  return $false',
    '}',
    'function Test-KjemoSourceLarge {',
    '  param($Sources)',
    '  foreach ($s in @($Sources)) {',
    '    $t = ([string]$s).Trim().ToLowerInvariant()',
    "    if ($t -eq '*' -or $t -eq 'internet' -or $t -eq 'any' -or $t -eq '0.0.0.0/0' -or $t -eq '0.0.0.0' -or $t -eq '::/0') { return $true }",
    '  }',
    '  return $false',
    '}',
    "$nsgs = @(Invoke-KjemoLecture 'NSG' 'Groupes de securite reseau' {",
    '  if ($KjemoArgNsg) { Get-AzNetworkSecurityGroup -ResourceGroupName $KjemoArgRg -Name $KjemoArgNsg -ErrorAction Stop } else { Get-AzNetworkSecurityGroup -ResourceGroupName $KjemoArgRg -ErrorAction Stop }',
    '})',
    'if ($script:KjemoLectureOk) {',
    "  [void](Add-KjemoResultat -Categorie 'NSG' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$nsgs.Count + ' groupe(s) de securite'))",
    '  $adminPorts = @(22, 3389, 5985, 5986)',
    '  $sensibles = @(23, 135, 445, 1433, 3306, 5432)',
    '  $expo = 0',
    '  foreach ($g in @($nsgs | Sort-Object -Property Name)) {',
    '    $nbSn = @($g.Subnets).Count',
    '    $nbNic = @($g.NetworkInterfaces).Count',
    "    $assoc = 'associe a ' + [string]$nbSn + ' sous-reseau(x) et ' + [string]$nbNic + ' interface(s)'",
    "    if ($nbSn -eq 0 -and $nbNic -eq 0) { $assoc = 'NON ASSOCIE a un sous-reseau ni a une interface (il ne filtre rien)' }",
    "    [void](Add-KjemoResultat -Categorie 'NSG' -Controle ([string]$g.Name) -Etat 'INFO' -Valeur $assoc -Commentaire ([string]@($g.SecurityRules).Count + ' regle(s) personnalisee(s).'))",
    '    foreach ($r in @($g.SecurityRules | Sort-Object -Property Direction, Priority)) {',
    '      if ($null -eq $r) { continue }',
    "      $src = (@($r.SourceAddressPrefix) -join ', ')",
    "      $dst = (@($r.DestinationPortRange) -join ', ')",
    "      $etat = 'INFO'",
    "      $note = [string]$r.Direction + ' / ' + [string]$r.Access + ' / priorite ' + [string]$r.Priority + ' / ' + [string]$r.Protocol + ' / source : ' + $src + ' / ports : ' + $dst + '.'",
    "      if ([string]$r.Direction -eq 'Inbound' -and [string]$r.Access -eq 'Allow' -and (Test-KjemoSourceLarge $r.SourceAddressPrefix)) {",
    '        $adminOuvert = $false',
    '        foreach ($port in $adminPorts) { if (Test-KjemoPortDansPlages $r.DestinationPortRange $port) { $adminOuvert = $true } }',
    '        $tout = (@($r.DestinationPortRange) -contains \'*\')',
    '        if ($adminOuvert -or $tout) {',
    "          $etat = 'PROBLEME'",
    '          $expo = $expo + 1',
    "          if ($tout) { $note = $note + ' TOUT LE TRAFIC ENTRANT est autorise depuis une source large.' } else { $note = $note + ' ACCES ADMINISTRATIF (SSH, RDP ou WinRM) ouvert depuis Internet ou une source large. Preferer Azure Bastion, un VPN ou un acces juste-a-temps.' }",
    '        } else {',
    '          foreach ($port in $sensibles) { if (Test-KjemoPortDansPlages $r.DestinationPortRange $port) { $etat = \'ATTENTION\'; $note = $note + \' Port sensible (\' + [string]$port + \') ouvert depuis une source large.\' } }',
    '        }',
    '      }',
    "      [void](Add-KjemoResultat -Categorie 'Regles NSG' -Controle ([string]$g.Name + ' / ' + [string]$r.Name) -Etat $etat -Valeur ([string]$r.Access) -Commentaire $note)",
    '    }',
    '  }',
    '  if ($expo -gt 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Regles NSG' -Controle 'Synthese' -Etat 'PROBLEME' -Valeur ([string]$expo + ' regle(s) exposant un acces large') -Commentaire 'Constat seulement : aucune regle n est modifiee ni supprimee par ce script.')",
    '  }',
    "  [void](Add-KjemoResultat -Categorie 'Limites' -Controle 'Ordre de priorite' -Etat 'INFO' -Valeur 'non evalue' -Commentaire 'Une regle Deny de priorite plus forte (nombre plus petit) peut neutraliser une regle Allow signalee. Les regles par defaut ne sont pas analysees.')",
    '}',
  ],
  gui: [
    'Portail Azure > Groupes de sécurité réseau > ton NSG > Règles de sécurité de trafic entrant : la liste par priorité.',
    'Ton NSG > Sous-réseaux et Interfaces réseau : ce que le NSG filtre réellement.',
    'Une machine > Mise en réseau > Règles de port : les règles effectives qui s’appliquent à CETTE machine.',
    'Pour administrer sans exposer RDP ou SSH : Azure Bastion, un VPN, ou l’accès juste-à-temps de Microsoft Defender pour le cloud.',
  ],
  keywords: ['nsg', 'groupe de securite reseau', 'regles nsg', 'get-aznetworksecuritygroup', 'port 3389', 'port 22', 'rdp ouvert', 'ssh ouvert', 'acces internet', 'pare-feu azure', 'securite reseau azure', 'bastion', 'regle entrante', 'machine exposee'],
  prereqs: PREREQS_RESEAU,
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Une règle est signalée mais la machine reste injoignable',
      cause: 'Une règle de priorité plus forte (numéro plus petit) refuse peut-être le trafic, ou le pare-feu du système bloque le port.',
      fix: 'Lis les règles effectives de l’interface dans le portail (Mise en réseau). Le script ne calcule pas l’ordre de priorité.',
    },
  ]),
  verifyAfter: [
    'Pour chaque règle signalée PROBLEME, ouvre-la dans le portail et confirme la source, le port et la priorité.',
    'Confirme quelle machine est réellement joignable par cette règle (sous-réseaux et interfaces associés).',
    'Aucune ligne n’est INACCESSIBLE ; sinon l’analyse d’exposition est incomplète.',
  ],
  rollback: rollbackLecture('# Les règles d’un NSG\n(Get-AzNetworkSecurityGroup -ResourceGroupName \'rg-lab\' -Name \'nsg-lab\').SecurityRules | Select-Object Name, Direction, Access, Priority, DestinationPortRange'),
  checks: CHECKS_LECTURE.concat([
    'Aucune règle de pare-feu ni de NSG n’est ajoutée, modifiée ou supprimée.',
    'Aucune ouverture d’accès administratif n’est proposée comme réglage par défaut ; les alternatives sûres sont citées dans la fiche.',
  ]),
  source: doc('powershell/module/az.network/get-aznetworksecuritygroup'),
  sources: [
    { label: 'Get-AzNetworkSecurityGroup', url: doc('powershell/module/az.network/get-aznetworksecuritygroup') },
    { label: 'Vue d’ensemble des groupes de sécurité réseau', url: doc('azure/virtual-network/network-security-groups-overview') },
    { label: 'Qu’est-ce qu’Azure Bastion ?', url: doc('azure/bastion/bastion-overview') },
  ],
  cloud: {
    probleme: 'Le port d’administration (RDP, SSH) ouvert à tout Internet est l’une des erreurs les plus exploitées. Il faut savoir si une règle le permet, sans toucher à la règle.',
    exemple: 'Un laboratoire a un NSG avec « Allow-RDP » depuis « * » vers 3389. Le rapport le signale comme PROBLEME. La correction (retirer la règle, passer par Bastion) est une décision humaine, hors du script.',
    lit: ['Les NSG du groupe, leurs règles personnalisées et leurs associations'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur le groupe de ressources'],
    licences: ['Aucune'],
    limites: [
      'Aucune règle n’est créée : ce lot n’ouvre jamais un accès administratif, même « temporairement ».',
      'L’ordre de priorité n’est pas évalué : une règle Deny plus prioritaire peut neutraliser une règle Allow signalée.',
      'Les règles par défaut, les pare-feu du système d’exploitation et Azure Firewall ne sont pas analysés.',
    ],
  },
});

// ===========================================================================
// 16. azure-reseau-dns
// ===========================================================================
export const outilAzureReseauDns = outilAzure({
  id: 'azure-reseau-dns',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-reseau-dns',
  title: 'DNS Azure et diagnostic de connectivité depuis le poste',
  summary: 'Liste les zones DNS (privées avec leurs liens de réseau, publiques) d’un groupe de ressources, et, si tu le demandes, résout un nom depuis TON poste et teste une connexion TCP. Le test sort du poste de l’utilisateur : il ne prouve rien sur ce que voit une machine dans Azure.',
  portee: 'az',
  commandes: {
    obligatoires: [],
    facultatives: ['Get-AzPrivateDnsZone', 'Get-AzPrivateDnsVirtualNetworkLink', 'Get-AzDnsZone'],
  },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources des zones DNS (facultatif)', default: '', help: 'Vide = ne lit aucune zone Azure. Nom exact, sans joker.' },
    { id: 'azHote', label: 'Nom à résoudre depuis ce poste (facultatif)', default: '', help: 'Un nom complet (monapp.contoso.com). Aucune adresse IP, aucun joker. Vide = pas de résolution.' },
    {
      id: 'azTcp', label: 'Tester aussi une connexion TCP', type: 'select', default: 'Non',
      options: [['Non', 'Non — résolution seulement'], ['Oui', 'Oui — une tentative de connexion depuis ce poste']],
      help: 'La tentative part de TON poste vers le nom résolu : elle est visible dans les journaux de la cible. Ne teste que ce que tu as le droit de tester.',
    },
    {
      id: 'azPort', label: 'Port TCP testé', type: 'select', default: '443',
      options: [['443', '443 — HTTPS'], ['80', '80 — HTTP'], ['22', '22 — SSH'], ['3389', '3389 — Bureau à distance']],
      help: 'Utilisé seulement si le test TCP est activé.',
    },
  ],
  verifier(v, errors) {
    if (String(v.azRg ?? '').trim()) verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    if (String(v.azHote ?? '').trim()) verif(errors, 'azHote', validerNomDns(v.azHote, 'Le nom à résoudre'));
    verif(errors, 'azTcp', validerChoixAzure(v.azTcp, ['Non', 'Oui'], 'Le test TCP'));
    verif(errors, 'azPort', validerChoixAzure(v.azPort, ['443', '80', '22', '3389'], 'Le port'));
    if (v.azTcp === 'Oui' && !String(v.azHote ?? '').trim()) errors.azTcp = 'Le test TCP a besoin d’un nom à résoudre.';
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg ?? '').trim())],
    ['Hote', psB64(String(v.azHote ?? '').trim().toLowerCase())],
    ['Tcp', psB64(v.azTcp)],
    ['Port', psB64(v.azPort)],
  ],
  corps: () => [
    'if ($KjemoArgRg) {',
    "  if ($null -ne (Get-Command -Name 'Get-AzPrivateDnsZone' -ErrorAction SilentlyContinue)) {",
    "    $zp = @(Invoke-KjemoLecture 'DNS prive' 'Zones privees' { Get-AzPrivateDnsZone -ResourceGroupName $KjemoArgRg -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk) {',
    "      [void](Add-KjemoResultat -Categorie 'DNS prive' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$zp.Count + ' zone(s) privee(s)'))",
    '      foreach ($z in $zp) {',
    "        [void](Add-KjemoResultat -Categorie 'DNS prive' -Controle ([string]$z.Name) -Etat 'INFO' -Valeur ([string]$z.NumberOfRecordSets + ' ensemble(s) d enregistrements') -Commentaire ([string]$z.NumberOfVirtualNetworkLinks + ' lien(s) vers un reseau virtuel.'))",
    "        if ($null -ne (Get-Command -Name 'Get-AzPrivateDnsVirtualNetworkLink' -ErrorAction SilentlyContinue)) {",
    "          $liens = @(Invoke-KjemoLecture 'DNS prive' ('Liens de ' + [string]$z.Name) { Get-AzPrivateDnsVirtualNetworkLink -ResourceGroupName $KjemoArgRg -ZoneName $z.Name -ErrorAction Stop })",
    '          if ($script:KjemoLectureOk) {',
    '            foreach ($l in $liens) {',
    "              $etatL = 'INFO'",
    "              $noteL = 'Reseau : ' + [string]$l.VirtualNetworkId + '. Enregistrement automatique : ' + [string]$l.RegistrationEnabled + '.'",
    "              if ([string]$l.VirtualNetworkLinkState -ne 'Completed') { $etatL = 'ATTENTION'; $noteL = $noteL + ' Le lien n est pas a l etat Completed.' }",
    "              [void](Add-KjemoResultat -Categorie 'DNS prive' -Controle ([string]$z.Name + ' / ' + [string]$l.Name) -Etat $etatL -Valeur ([string]$l.VirtualNetworkLinkState) -Commentaire $noteL)",
    '            }',
    '            if (@($liens).Count -eq 0) {',
    "              [void](Add-KjemoResultat -Categorie 'DNS prive' -Controle ([string]$z.Name) -Etat 'ATTENTION' -Valeur 'aucun lien' -Commentaire 'Une zone privee sans lien de reseau virtuel n est resolue par aucune machine.')",
    '            }',
    '          }',
    '        }',
    '      }',
    '    }',
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'DNS prive' -Controle 'Module Az.PrivateDns' -Etat 'ATTENTION' -Valeur 'absent' -Commentaire 'Les zones privees ne sont pas lues : le rapport est incomplet.')",
    '  }',
    "  if ($null -ne (Get-Command -Name 'Get-AzDnsZone' -ErrorAction SilentlyContinue)) {",
    "    $zu = @(Invoke-KjemoLecture 'DNS public' 'Zones publiques' { Get-AzDnsZone -ResourceGroupName $KjemoArgRg -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk) {',
    "      [void](Add-KjemoResultat -Categorie 'DNS public' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$zu.Count + ' zone(s) publique(s)'))",
    '      foreach ($z in $zu) {',
    "        [void](Add-KjemoResultat -Categorie 'DNS public' -Controle ([string]$z.Name) -Etat 'INFO' -Valeur ([string]$z.NumberOfRecordSets + ' ensemble(s) d enregistrements') -Commentaire ('Serveurs de noms : ' + (@($z.NameServers) -join \', \') + '. Ils ne servent que si le registraire les a delegues.'))",
    '      }',
    '    }',
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'DNS public' -Controle 'Module Az.Dns' -Etat 'ATTENTION' -Valeur 'absent' -Commentaire 'Les zones publiques ne sont pas lues : le rapport est incomplet.')",
    '  }',
    '}',
    '',
    'if ($KjemoArgHote) {',
    "  [void](Add-KjemoResultat -Categorie 'Resolution locale' -Controle 'Portee du test' -Etat 'INFO' -Valeur 'depuis CE poste' -Commentaire 'Une zone privee n est resolue que par les machines reliees a son reseau virtuel : ton poste peut ne pas la voir alors qu une machine Azure la voit, et inversement.')",
    '  $adresses = @()',
    '  try { $adresses = @([System.Net.Dns]::GetHostAddresses($KjemoArgHote)) } catch { $adresses = @() }',
    '  if ($adresses.Count -eq 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Resolution locale' -Controle $KjemoArgHote -Etat 'ATTENTION' -Valeur 'non resolu depuis ce poste' -Commentaire 'Faute de frappe, enregistrement absent, zone privee non visible depuis ce poste, ou DNS local en panne. Ne conclus pas que le nom n existe pas.')",
    '  } else {',
    '    $v4 = $null',
    '    foreach ($a in $adresses) {',
    '      $t = [string]$a.IPAddressToString',
    "      $nature = 'publique'",
    "      if ($t -match '^(10\\.|192\\.168\\.|169\\.254\\.|127\\.)' -or $t -match '^172\\.(1[6-9]|2[0-9]|3[01])\\.') { $nature = 'privee' }",
    "      [void](Add-KjemoResultat -Categorie 'Resolution locale' -Controle $KjemoArgHote -Etat 'INFO' -Valeur $t -Commentaire ('Adresse ' + $nature + '.'))",
    "      if ($null -eq $v4 -and $a.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) { $v4 = $a }",
    '    }',
    "    if ($KjemoArgTcp -eq 'Oui') {",
    '      if ($null -eq $v4) {',
    "        [void](Add-KjemoResultat -Categorie 'Connexion TCP' -Controle $KjemoArgHote -Etat 'ATTENTION' -Valeur 'aucune adresse IPv4' -Commentaire 'Le test TCP de ce script vise une adresse IPv4.')",
    '      } else {',
    '        $client = New-Object System.Net.Sockets.TcpClient',
    '        try {',
    '          $ar = $client.BeginConnect($v4, [int]$KjemoArgPort, $null, $null)',
    '          $fini = $ar.AsyncWaitHandle.WaitOne(3000, $false)',
    '          if ($fini -and $client.Connected) {',
    '            $client.EndConnect($ar)',
    "            [void](Add-KjemoResultat -Categorie 'Connexion TCP' -Controle ($KjemoArgHote + ':' + $KjemoArgPort) -Etat 'OK' -Valeur 'connexion etablie' -Commentaire 'Le port repond depuis ce poste. Cela ne prouve rien sur le service lui-meme.')",
    '          } else {',
    "            [void](Add-KjemoResultat -Categorie 'Connexion TCP' -Controle ($KjemoArgHote + ':' + $KjemoArgPort) -Etat 'ATTENTION' -Valeur 'delai depasse (3 s)' -Commentaire 'Pas de reponse : NSG, pare-feu du systeme, pare-feu du poste, service arrete ou machine eteinte. Impossible de les distinguer d ici.')",
    '          }',
    '        } catch {',
    "          [void](Add-KjemoResultat -Categorie 'Connexion TCP' -Controle ($KjemoArgHote + ':' + $KjemoArgPort) -Etat 'ATTENTION' -Valeur 'connexion refusee ou impossible' -Commentaire 'Port ferme, service arrete ou chemin bloque. Impossible de les distinguer d ici.')",
    '        } finally {',
    '          $client.Close()',
    '        }',
    '      }',
    '    }',
    '  }',
    '}',
    'if (-not $KjemoArgRg -and -not $KjemoArgHote) {',
    "  [void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Rien a lire' -Etat 'ATTENTION' -Valeur 'ni groupe de ressources ni nom a resoudre' -Commentaire 'Renseigne au moins un des deux champs pour que cet assistant ait quelque chose a faire.')",
    '}',
  ],
  gui: [
    'Portail Azure > Zones DNS privées > ta zone > Liens de réseau virtuel : quels réseaux résolvent cette zone.',
    'Portail Azure > Zones DNS > ta zone : les enregistrements et les serveurs de noms à déléguer chez le registraire.',
    'Une machine > Mise en réseau > Interface réseau > Serveurs DNS : le DNS effectif de CETTE machine.',
    'Depuis la machine elle-même : nslookup <nom> (Windows) ou resolvectl query <nom> (Linux) — le seul test qui reflète ce que la machine voit.',
  ],
  keywords: ['dns', 'zone dns', 'dns prive', 'private dns', 'resolution de nom', 'nslookup', 'connectivite', 'test tcp', 'port ferme', 'lien de reseau virtuel', 'get-azprivatednszone', 'get-azdnszone', 'injoignable', 'diagnostic reseau azure'],
  prereqs: PREREQS_RESEAU.concat(['Les modules Az.PrivateDns et Az.Dns pour lire les zones ; sans eux, le rapport le dit et reste incomplet. La résolution et le test TCP n’en ont pas besoin.']),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le nom ne se résout pas depuis mon poste mais fonctionne dans Azure',
      cause: 'Une zone DNS privée n’est visible que des réseaux virtuels qui lui sont liés.',
      fix: 'Compare avec la résolution faite DEPUIS la machine Azure. Le test de ce script reflète ton poste, pas Azure.',
    },
    {
      message: 'Délai dépassé sur un port que je crois ouvert',
      cause: 'NSG, pare-feu du système, pare-feu du poste, service arrêté ou machine éteinte : un délai ne les distingue pas.',
      fix: 'Vérifie dans l’ordre : machine démarrée, service à l’écoute, pare-feu du système, NSG (assistant NSG). Ne contourne pas un filtrage pour « tester ».',
    },
  ]),
  verifyAfter: [
    'Compare une zone et son nombre d’enregistrements avec la page de la zone dans le portail.',
    'Refais la résolution DEPUIS une machine du réseau concerné avant de conclure à un problème DNS.',
    'Aucune ligne n’est INACCESSIBLE ; sinon des zones manquent au rapport.',
  ],
  rollback: rollbackLecture('# Résoudre un nom depuis ce poste\n[System.Net.Dns]::GetHostAddresses(\'monapp.contoso.com\')'),
  checks: CHECKS_LECTURE.concat([
    'Aucun enregistrement DNS, aucune zone, aucun lien n’est créé, modifié ou supprimé.',
    'Le test TCP est désactivé par défaut et ne vise que le nom que tu as fourni, sur un port d’une liste fermée.',
    'Network Watcher n’est pas utilisé : il crée des ressources et n’est pas en lecture seule.',
  ]),
  source: doc('powershell/module/az.privatedns/get-azprivatednszone'),
  sources: [
    { label: 'Get-AzPrivateDnsZone', url: doc('powershell/module/az.privatedns/get-azprivatednszone') },
    { label: 'Get-AzPrivateDnsVirtualNetworkLink', url: doc('powershell/module/az.privatedns/get-azprivatednsvirtualnetworklink') },
    { label: 'Get-AzDnsZone', url: doc('powershell/module/az.dns/get-azdnszone') },
    { label: 'Résolution de noms pour les ressources des réseaux virtuels Azure', url: doc('azure/virtual-network/virtual-networks-name-resolution-for-vms-and-role-instances') },
  ],
  cloud: {
    probleme: '« Je n’arrive pas à joindre cette machine par son nom. » Avant de soupçonner Azure, on vérifie que le nom se résout, par où, et que le port répond depuis le poste.',
    exemple: 'Une application interne utilise une zone privée. Depuis le poste de la technicienne, le nom ne se résout pas, mais depuis une machine du réseau il se résout. Le rapport montre que la zone est liée au bon réseau : le poste n’y est simplement pas.',
    lit: ['Les zones DNS privées et publiques d’un groupe de ressources, et les liens de réseau', 'La résolution d’un nom et, si demandé, une tentative de connexion TCP, depuis le poste de l’utilisateur'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur le groupe de ressources des zones DNS'],
    licences: ['Aucune'],
    limites: [
      'La résolution et le test TCP partent de ce poste, pas d’Azure : leur résultat peut différer de ce que voit une machine virtuelle.',
      'Un délai dépassé ne dit pas pourquoi : NSG, pare-feu, service ou machine éteinte restent indiscernables.',
      'Aucun test de connexion Network Watcher, aucune capture de paquets : ils créent des ressources.',
    ],
  },
});

export const toolsAzureReseau = [
  outilAzureReseauVnets,
  outilAzureReseauInterfaces,
  outilAzureReseauNsg,
  outilAzureReseauDns,
];
