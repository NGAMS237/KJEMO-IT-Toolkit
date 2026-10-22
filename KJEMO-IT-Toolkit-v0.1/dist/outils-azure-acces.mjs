/**
 * outils-azure-acces.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Familles A et B : connexion, contexte et accès (3 assistants) ; Microsoft
 * Entra ID (4 assistants). Tous en lecture seule.
 *
 * Une distinction traverse ce module et doit rester visible dans chaque fiche :
 *
 *   - les rôles MICROSOFT ENTRA gèrent l'annuaire (utilisateurs, groupes,
 *     applications, authentification) ;
 *   - les rôles AZURE RBAC gèrent les ressources (machines virtuelles, réseaux,
 *     stockage), à un niveau d'abonnement, de groupe de ressources ou de
 *     ressource.
 *
 * Ce sont deux systèmes. Un Administrateur général Entra n'a pas
 * automatiquement accès aux ressources d'un abonnement (il peut s'élever, mais
 * c'est une action distincte, hors de ce lot), et un Propriétaire d'abonnement
 * ne lit pas pour autant tout l'annuaire.
 */

import { psB64 } from './noyau.mjs';
import {
  outilAzure,
  rollbackLecture,
  CHECKS_LECTURE,
  LIGNES_PROP_GRAPH,
} from './noyau-azure.mjs';
import {
  validerGroupeRessources,
  validerUtilisateur,
  validerDebutNom,
  validerBorne,
  validerChoixAzure,
  validerGuid,
} from './validateurs-azure.mjs';

const FAMILLE_A = 'Connexion, contexte et accès';
const FAMILLE_B = 'Microsoft Entra ID';

const doc = (chemin) => `https://learn.microsoft.com/${chemin}`;

function verif(errors, champ, r) {
  if (!r.ok) errors[champ] = r.error;
  return r;
}

const SRC_INSTALL_AZ = { label: 'Installer Azure PowerShell (module Az)', url: doc('powershell/azure/install-azure-powershell') };
const SRC_INSTALL_MG = { label: 'Installer Microsoft Graph PowerShell', url: doc('powershell/microsoftgraph/installation') };
const SRC_ROLES = { label: 'Rôles Entra et rôles Azure RBAC : les différences', url: doc('azure/role-based-access-control/rbac-and-directory-admin-roles') };

// ===========================================================================
// A. CONNEXION, CONTEXTE ET ACCÈS
// ===========================================================================

/** 1. azure-contexte — prérequis et identification de la session. */
export const outilAzureContexte = outilAzure({
  id: 'azure-contexte',
  famille: FAMILLE_A,
  prefixe: 'kjemo-azure-contexte',
  title: 'Prérequis et contexte Azure : suis-je au bon endroit ?',
  summary: 'Vérifie que les modules Azure et Microsoft Graph sont présents, relève la version de PowerShell, et compare la session Azure ouverte au tenant et à l’abonnement que tu déclares. Ne se connecte à rien, ne change jamais de contexte.',
  portee: 'az',
  commandes: {
    obligatoires: ['Get-AzContext'],
    facultatives: ['Get-MgContext'],
  },
  champs: [],
  corps: () => [
    "[void](Add-KjemoResultat -Categorie 'Environnement' -Controle 'PowerShell' -Etat 'INFO' -Valeur ($PSVersionTable.PSVersion.ToString() + ' (' + [string]$PSVersionTable.PSEdition + ')') -Commentaire 'Windows PowerShell 5.1 (Desktop) et PowerShell 7 (Core) sont visees par ce catalogue.')",
    "$modules = @('Az.Accounts', 'Az.Resources', 'Az.Compute', 'Az.Network', 'Az.Storage', 'Az.RecoveryServices', 'Az.Monitor', 'Microsoft.Graph.Authentication', 'Microsoft.Graph.Users', 'Microsoft.Graph.Groups', 'Microsoft.Graph.Identity.DirectoryManagement', 'Microsoft.Graph.Reports')",
    'foreach ($m in $modules) {',
    '  $trouves = @(Get-Module -ListAvailable -Name $m -ErrorAction SilentlyContinue | Sort-Object -Property Version -Descending)',
    '  if ($trouves.Count -gt 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Modules' -Controle $m -Etat 'OK' -Valeur ([string]$trouves[0].Version) -Commentaire 'Installe.')",
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Modules' -Controle $m -Etat 'INFO' -Valeur 'absent' -Commentaire 'A installer seulement si un assistant du Toolkit en a besoin. Ce script n installe rien.')",
    '  }',
    '}',
    '$caches = @()',
    'try { $caches = @(Get-AzContext -ListAvailable -ErrorAction Stop) } catch { $caches = @() }',
    'if ($caches.Count -gt 1) {',
    "  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Contextes en cache' -Etat 'INFO' -Valeur ([string]$caches.Count + ' contextes enregistres') -Commentaire 'Seul le contexte ACTIF est utilise. Un contexte en cache n est jamais choisi a ta place.')",
    '}',
    "$cli = Get-Command -Name 'az' -ErrorAction SilentlyContinue",
    'if ($null -eq $cli) {',
    "  [void](Add-KjemoResultat -Categorie 'Outils' -Controle 'Azure CLI (az)' -Etat 'INFO' -Valeur 'absent' -Commentaire 'Ce lot genere du PowerShell (module Az) : Azure CLI n est pas necessaire.')",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Outils' -Controle 'Azure CLI (az)' -Etat 'INFO' -Valeur 'present' -Commentaire 'Non utilise par ce lot. Sa session est independante de celle du module Az.')",
    '}',
    "if ($null -ne (Get-Command -Name 'Get-MgContext' -ErrorAction SilentlyContinue)) {",
    '  $g = $null',
    '  try { $g = Get-MgContext -ErrorAction Stop } catch { $g = $null }',
    '  if ($null -eq $g) {',
    "    [void](Add-KjemoResultat -Categorie 'Graph' -Controle 'Session Microsoft Graph' -Etat 'INFO' -Valeur 'aucune session' -Commentaire 'Normal si tu n utilises que le module Az. Les assistants Entra ID exigent une session Graph ouverte par toi.')",
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Graph' -Controle 'Tenant Graph' -Etat 'INFO' -Valeur (Format-KjemoId ([string]$g.TenantId)) -Commentaire ('Mode : ' + [string]$g.AuthType + '. Permissions accordees : ' + [string]@($g.Scopes).Count))",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Microsoft Entra ID > Vue d’ensemble : l’identifiant du locataire (tenant) à copier dans le formulaire.',
    'Portail Azure > Abonnements : l’identifiant de l’abonnement et son état (Activé, Désactivé).',
    'Portail Azure > icône de ton profil > Changer de répertoire : confirme dans quel tenant tu travailles avant d’ouvrir un terminal.',
    'Cloud Shell (portail) : un terminal déjà connecté à ton compte, sans rien installer — le contexte y est celui du portail.',
  ],
  keywords: ['azure', 'contexte', 'tenant', 'abonnement', 'subscription', 'module az', 'prerequis', 'connexion', 'get-azcontext', 'microsoft graph', 'bon abonnement', 'laboratoire'],
  prereqs: [],
  commonErrors: [
    {
      message: 'Get-AzContext : la commande est introuvable',
      cause: 'Le module Az.Accounts n’est pas installé dans cette session.',
      fix: 'Installe le module Az dans ton terminal (étape décrite sur la page Microsoft d’installation), rouvre le terminal, puis relance.',
    },
    {
      message: 'Plusieurs contextes en cache',
      cause: 'Azure PowerShell garde plusieurs connexions ; une seule est active.',
      fix: 'Le script n’en choisit aucune : seul le contexte actif est comparé à tes identifiants. Bascule toi-même si ce n’est pas le bon.',
    },
  ],
  verifyAfter: [
    'Le tenant et l’abonnement affichés portent « OK » et correspondent à ce que le portail indique.',
    'Les lignes « Contexte » ne contiennent aucune mention REFUS.',
    'Compare le compte connecté avec celui que tu pensais utiliser : un compte personnel et un compte de laboratoire se confondent vite.',
  ],
  rollback: rollbackLecture('# Le contexte actif, tel que PowerShell le voit\nGet-AzContext | Select-Object Name, Account, Subscription, Tenant, Environment'),
  checks: CHECKS_LECTURE,
  source: doc('powershell/module/az.accounts/get-azcontext'),
  sources: [
    { label: 'Get-AzContext', url: doc('powershell/module/az.accounts/get-azcontext') },
    { label: 'Contextes Azure PowerShell', url: doc('powershell/azure/context-persistence') },
    SRC_INSTALL_AZ,
    SRC_INSTALL_MG,
  ],
  cloud: {
    probleme: 'Avant de lire ou de modifier quoi que ce soit dans Azure, il faut être certain de l’endroit où l’on se trouve : le bon tenant, le bon abonnement, le bon compte. Se tromper d’abonnement est l’erreur la plus coûteuse en administration cloud.',
    exemple: 'Une technicienne gère deux abonnements : « Production » et « Laboratoire ». Elle lance un diagnostic en croyant être dans le laboratoire. Ce script compare sa session à l’abonnement qu’elle a déclaré et refuse de continuer si ce n’est pas le même.',
    lit: ['Les modules installés dans la session', 'La version de PowerShell', 'Le contexte Azure actif (compte, tenant, abonnement)', 'Le contexte Microsoft Graph actif, s’il existe'],
    ecrit: ['Rien dans Azure ni dans Entra ID', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Aucune permission Azure particulière : lire sa propre session ne demande aucun rôle'],
    licences: ['Aucune'],
    limites: [
      'Il ne prouve pas que tu as les droits nécessaires pour la suite : l’assistant « Affectations de rôles » le diagnostique.',
      'Il ne choisit, ne change et ne répare aucun contexte.',
      'La session Azure CLI (az) est indépendante de celle du module Az : ce script ne lit que le module Az.',
    ],
  },
});

/** 2. azure-abonnements-rg — inventaire des abonnements et des groupes de ressources. */
export const outilAzureAbonnementsRg = outilAzure({
  id: 'azure-abonnements-rg',
  famille: FAMILLE_A,
  prefixe: 'kjemo-azure-abonnements-rg',
  title: 'Inventaire des abonnements et des groupes de ressources',
  summary: 'Liste les abonnements visibles dans le tenant (en marquant celui que tu as déclaré) puis les groupes de ressources de cet abonnement, avec le nombre de ressources et la présence d’étiquettes. Lecture seule.',
  portee: 'az',
  commandes: {
    obligatoires: ['Get-AzSubscription', 'Get-AzResourceGroup', 'Get-AzResource'],
    facultatives: [],
  },
  champs: [
    { id: 'azDebut', label: 'Début du nom du groupe de ressources (facultatif)', default: '', help: 'Filtre les groupes dont le nom commence par ce texte. Vide = tous. Aucun joker.' },
    { id: 'azLimite', label: 'Nombre maximal de groupes détaillés', type: 'number', default: '50', min: 1, max: 200, help: 'Chaque groupe détaillé coûte une lecture de plus. Entre 1 et 200.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azDebut', validerDebutNom(v.azDebut, 'Le début du nom'));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 200, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Debut', psB64(String(v.azDebut ?? '').trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 200).value))],
  ],
  corps: () => [
    "Invoke-KjemoLecture 'Abonnements' 'Abonnements visibles dans le tenant' {",
    '  $abos = @(Get-AzSubscription -TenantId $KjemoTenantAttendu -ErrorAction Stop)',
    '  if ($abos.Count -eq 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Abonnements' -Controle 'Liste' -Etat 'ATTENTION' -Valeur 'aucun abonnement visible' -Commentaire 'Aucun abonnement n est visible pour ce compte dans ce tenant. Cela ne veut pas dire qu aucun n existe.')",
    '  }',
    '  foreach ($a in ($abos | Sort-Object -Property Name)) {',
    '    $estCible = [string]::Equals([string]$a.Id, $KjemoAbonnementAttendu, [System.StringComparison]::OrdinalIgnoreCase)',
    "    $etat = 'INFO'",
    "    if ([string]$a.State -ne 'Enabled') { $etat = 'ATTENTION' }",
    "    $marque = ''",
    "    if ($estCible) { $marque = ' [CIBLE DECLAREE]' }",
    "    [void](Add-KjemoResultat -Categorie 'Abonnements' -Controle ([string]$a.Name + $marque) -Etat $etat -Valeur ('Etat : ' + [string]$a.State) -Commentaire ('Identifiant : ' + (Format-KjemoId ([string]$a.Id))))",
    '  }',
    '}',
    '',
    "$groupes = @(Invoke-KjemoLecture 'Groupes de ressources' 'Liste des groupes' { Get-AzResourceGroup -ErrorAction Stop })",
    'if ($script:KjemoLectureOk) {',
    '  if ($KjemoArgDebut) { $groupes = @($groupes | Where-Object { ([string]$_.ResourceGroupName).StartsWith($KjemoArgDebut, [System.StringComparison]::OrdinalIgnoreCase) }) }',
    '  $groupes = @($groupes | Sort-Object -Property ResourceGroupName)',
    "  [void](Add-KjemoResultat -Categorie 'Groupes de ressources' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$groupes.Count + ' groupe(s)'))",
    '  foreach ($rg in @($groupes | Select-Object -First ([int]$KjemoArgLimite))) {',
    '    $res = @(Invoke-KjemoLecture \'Groupes de ressources\' (\'Ressources de \' + [string]$rg.ResourceGroupName) { Get-AzResource -ResourceGroupName $rg.ResourceGroupName -ErrorAction Stop })',
    '    if ($script:KjemoLectureOk) {',
    '      $nbTags = 0',
    '      if ($null -ne $rg.Tags) { $nbTags = @($rg.Tags.Keys).Count }',
    "      $note = 'Region : ' + [string]$rg.Location + '. Etiquettes : ' + [string]$nbTags + '.'",
    "      if ($res.Count -eq 0) { $note = $note + ' Groupe VIDE : verifier avant de le croire inutile.' }",
    "      [void](Add-KjemoResultat -Categorie 'Groupes de ressources' -Controle ([string]$rg.ResourceGroupName) -Etat 'INFO' -Valeur ([string]$res.Count + ' ressource(s)') -Commentaire $note)",
    '    }',
    '  }',
    '  if ($groupes.Count -gt [int]$KjemoArgLimite) {',
    "    [void](Add-KjemoResultat -Categorie 'Groupes de ressources' -Controle 'Limite' -Etat 'INFO' -Valeur ('seuls les ' + [string]$KjemoArgLimite + ' premiers sont detailles') -Commentaire 'Augmente la limite ou filtre par debut de nom pour voir les autres.')",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Abonnements : la liste des abonnements, leur état et leurs coûts du mois.',
    'Portail Azure > Groupes de ressources : la liste, avec abonnement, région et nombre de ressources.',
    'Dans un groupe de ressources > Étiquettes : à qui appartient le groupe et quand le supprimer.',
    'Cloud Shell > Get-AzResourceGroup : la même liste, depuis un terminal déjà connecté.',
  ],
  keywords: ['azure', 'abonnement', 'subscription', 'groupe de ressources', 'resource group', 'inventaire', 'rg', 'get-azresourcegroup', 'get-azsubscription', 'laboratoire', 'etiquettes', 'tags'],
  prereqs: ['Rôle Lecteur sur l’abonnement (ou au moins sur les groupes à inventorier) pour lister les groupes et leurs ressources.'],
  commonErrors: [
    {
      message: 'Aucun abonnement visible',
      cause: 'Le compte n’a aucune affectation de rôle Azure dans ce tenant, ou la session pointe vers un autre tenant.',
      fix: 'Un Administrateur général Entra n’a pas d’accès automatique aux abonnements. Demande un rôle Lecteur sur l’abonnement visé.',
    },
    {
      message: 'Un groupe affiche 0 ressource',
      cause: 'Le groupe est réellement vide, ou ton rôle ne te permet pas de lire ses ressources.',
      fix: 'Le rapport signale « VIDE : vérifier avant de le croire inutile ». Ne supprime rien sur cette seule ligne.',
    },
  ],
  verifyAfter: [
    'L’abonnement marqué [CIBLE DECLAREE] est bien celui que tu voulais.',
    'Le total de groupes correspond à la liste du portail pour le même abonnement.',
    'Aucune ligne n’est classée INACCESSIBLE : sinon l’inventaire est incomplet.',
  ],
  rollback: rollbackLecture('# Les groupes de ressources de la session active\nGet-AzResourceGroup | Select-Object ResourceGroupName, Location'),
  checks: CHECKS_LECTURE,
  source: doc('powershell/module/az.resources/get-azresourcegroup'),
  sources: [
    { label: 'Get-AzSubscription', url: doc('powershell/module/az.accounts/get-azsubscription') },
    { label: 'Get-AzResourceGroup', url: doc('powershell/module/az.resources/get-azresourcegroup') },
    { label: 'Get-AzResource', url: doc('powershell/module/az.resources/get-azresource') },
    { label: 'Organiser les ressources avec les groupes de ressources et les étiquettes', url: doc('azure/azure-resource-manager/management/overview') },
  ],
  cloud: {
    probleme: 'On ne gère pas ce qu’on ne voit pas. Avant tout travail, il faut savoir quels abonnements existent, lequel est visé, et quels groupes de ressources s’y trouvent.',
    exemple: 'Une PME reprend un abonnement hérité d’un ancien prestataire. Elle veut savoir combien de groupes de ressources existent, lesquels sont vides et lesquels n’ont aucune étiquette de propriétaire.',
    lit: ['La liste des abonnements du tenant', 'Les groupes de ressources de l’abonnement déclaré', 'Le nombre de ressources par groupe et la présence d’étiquettes'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur l’abonnement, ou au minimum sur chaque groupe à inventorier'],
    licences: ['Aucune'],
    limites: [
      'Les ressources ne sont comptées que dans la limite de groupes détaillés demandée.',
      'Un groupe « vide » n’est pas un groupe inutile : il peut être réservé, verrouillé ou lu avec des droits insuffisants.',
      'Aucun abonnement n’est sélectionné ni basculé : seul l’abonnement déclaré, déjà actif, est inventorié.',
    ],
  },
});

/** 3. azure-rbac — affectations de rôles Azure et diagnostic des accès. */
export const outilAzureRbac = outilAzure({
  id: 'azure-rbac',
  famille: FAMILLE_A,
  prefixe: 'kjemo-azure-rbac',
  title: 'Affectations de rôles Azure (RBAC) et diagnostic des accès',
  summary: 'Lit les affectations de rôles Azure RBAC à l’échelle d’un abonnement ou d’un groupe de ressources, pour tout le monde ou pour un utilisateur précis, signale les rôles à fort pouvoir et distingue l’accès direct de l’accès hérité. Lecture seule.',
  portee: 'az',
  commandes: {
    obligatoires: ['Get-AzRoleAssignment'],
    facultatives: ['Get-AzResourceGroup'],
  },
  champs: [
    {
      id: 'azPortee', label: 'Niveau lu', type: 'select', default: 'Abonnement',
      options: [['Abonnement', 'Abonnement entier'], ['GroupeRessources', 'Un groupe de ressources']],
      help: 'Les affectations s’héritent de haut en bas : abonnement, groupe de ressources, ressource.',
    },
    { id: 'azRg', label: 'Groupe de ressources (si niveau = groupe)', optionnel: true, default: 'rg-lab', help: 'Ignoré si le niveau est « Abonnement ». Nom exact, sans joker.' },
    { id: 'azPrincipal', label: 'Utilisateur ou identifiant d’objet (facultatif)', default: '', help: 'prenom.nom@contoso.com ou GUID d’objet. Vide = toutes les affectations du niveau lu. Avec un utilisateur, les groupes dont il est membre sont développés.' },
    { id: 'azLimite', label: 'Nombre maximal d’affectations détaillées', type: 'number', default: '100', min: 1, max: 500, help: 'Entre 1 et 500.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azPortee', validerChoixAzure(v.azPortee, ['Abonnement', 'GroupeRessources'], 'Le niveau'));
    if (v.azPortee === 'GroupeRessources') verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azPrincipal', validerUtilisateur(v.azPrincipal, 'L’utilisateur', { vide: true }));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 500, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Portee', psB64(v.azPortee)],
    ['Rg', psB64(v.azPortee === 'GroupeRessources' ? String(v.azRg).trim() : '')],
    ['Principal', psB64(String(v.azPrincipal ?? '').trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 500).value))],
  ],
  corps: () => [
    "$scope = '/subscriptions/' + $KjemoAbonnementAttendu",
    "if ($KjemoArgPortee -eq 'GroupeRessources') {",
    "  $scope = $scope + '/resourceGroups/' + $KjemoArgRg",
    "  $rgLu = @(Invoke-KjemoLecture 'Portee' 'Existence du groupe de ressources' { Get-AzResourceGroup -Name $KjemoArgRg -ErrorAction Stop })",
    '  if (-not $script:KjemoLectureOk) { $scope = $null }',
    '}',
    'if ($null -eq $scope) {',
    "  [void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Niveau lu' -Etat 'PROBLEME' -Valeur 'groupe de ressources illisible' -Commentaire 'Le groupe n a pas pu etre lu : aucune affectation n est interrogee.')",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Niveau lu' -Etat 'INFO' -Valeur ($scope -replace '([0-9a-fA-F]{8})(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', '$1-****'))",
    '  $aff = @(Invoke-KjemoLecture \'Affectations RBAC\' \'Lecture des affectations\' {',
    '    if ($KjemoArgPrincipal -match \'@\') { Get-AzRoleAssignment -Scope $scope -SignInName $KjemoArgPrincipal -ExpandPrincipalGroups -ErrorAction Stop }',
    '    elseif ($KjemoArgPrincipal) { Get-AzRoleAssignment -Scope $scope -ObjectId $KjemoArgPrincipal -ErrorAction Stop }',
    '    else { Get-AzRoleAssignment -Scope $scope -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    '    $privilegies = 0',
    "    [void](Add-KjemoResultat -Categorie 'Affectations RBAC' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$aff.Count + ' affectation(s)'))",
    '    foreach ($a in @($aff | Select-Object -First ([int]$KjemoArgLimite))) {',
    '      $sc = [string]$a.Scope',
    "      $niveau = 'defini plus bas que le niveau lu'",
    "      if ([string]::Equals($sc, $scope, [System.StringComparison]::OrdinalIgnoreCase)) { $niveau = 'direct a ce niveau' }",
    "      elseif ($scope.StartsWith($sc + '/', [System.StringComparison]::OrdinalIgnoreCase) -or $sc -eq '/') { $niveau = 'HERITE d un niveau superieur (' + $sc + ')' }",
    "      $etat = 'INFO'",
    '      $role = [string]$a.RoleDefinitionName',
    "      $note = $niveau + '. Type : ' + [string]$a.ObjectType + '.'",
    "      if ($role -eq 'Owner' -or $role -eq 'User Access Administrator') {",
    "        $etat = 'ATTENTION'",
    '        $privilegies = $privilegies + 1',
    "        $note = $note + ' ROLE A FORT POUVOIR : verifier que c est voulu (moindre privilege).'",
    '      }',
    "      [void](Add-KjemoResultat -Categorie 'Affectations RBAC' -Controle ([string]$a.DisplayName) -Etat $etat -Valeur $role -Commentaire $note)",
    '    }',
    '    if ($aff.Count -eq 0) {',
    "      [void](Add-KjemoResultat -Categorie 'Affectations RBAC' -Controle 'Resultat' -Etat 'ATTENTION' -Valeur 'aucune affectation trouvee' -Commentaire 'Cela ne prouve PAS l absence d acces : un acces peut venir d un groupe imbrique, d une affectation eligible (PIM) ou d un niveau non liste ici.')",
    '    }',
    '    if ($privilegies -gt 0) {',
    "      [void](Add-KjemoResultat -Categorie 'Affectations RBAC' -Controle 'Roles a fort pouvoir' -Etat 'ATTENTION' -Valeur ([string]$privilegies + ' affectation(s) Owner ou User Access Administrator') -Commentaire 'A relire une par une. Aucune n est modifiee par ce script.')",
    '    }',
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Abonnements > ton abonnement > Contrôle d’accès (IAM) > Attributions de rôles : la liste, avec le niveau d’héritage.',
    'Contrôle d’accès (IAM) > Vérifier l’accès : choisis un utilisateur, le portail liste ses accès effectifs.',
    'Contrôle d’accès (IAM) > Rôles : la définition exacte de chaque rôle (Lecteur, Contributeur, Propriétaire).',
    'Cloud Shell > Get-AzRoleAssignment -SignInName <utilisateur> : la même vérification depuis un terminal.',
  ],
  keywords: ['rbac', 'role azure', 'role assignment', 'affectation', 'acces azure', 'permissions azure', 'proprietaire', 'owner', 'contributeur', 'lecteur', 'iam', 'get-azroleassignment', 'moindre privilege', 'je ne peux pas voir', 'authorizationfailed'],
  prereqs: ['Pour lister les affectations, le rôle doit inclure la lecture des affectations de rôles (le rôle Lecteur suffit au niveau lu).'],
  commonErrors: [
    {
      message: 'AuthorizationFailed : does not have authorization to perform action Microsoft.Authorization/roleAssignments/read',
      cause: 'Ton compte n’a aucun rôle Azure au niveau lu, ou seulement un rôle qui n’inclut pas la lecture des affectations.',
      fix: 'Demande le rôle Lecteur au niveau lu. Le rapport est alors INCOMPLET et le dit. Ne demande pas Propriétaire pour lire.',
    },
    {
      message: 'Je suis Administrateur général mais je ne vois aucun abonnement',
      cause: 'Les rôles Microsoft Entra et les rôles Azure RBAC sont deux systèmes. Le rôle Entra ne donne pas d’accès aux ressources.',
      fix: 'Il faut une affectation de rôle Azure (RBAC) sur l’abonnement. L’élévation d’accès des Administrateurs généraux existe mais est une action distincte, hors de ce lot.',
    },
  ],
  verifyAfter: [
    'Compare une affectation lue avec le portail (Contrôle d’accès (IAM)) pour le même niveau.',
    'Pour chaque rôle « HERITE », retrouve le niveau supérieur où il est défini : c’est là qu’il faudrait le retirer, pas ici.',
    'Aucune ligne n’est INACCESSIBLE ; sinon la liste est incomplète et ne prouve rien.',
  ],
  rollback: rollbackLecture('# Les affectations lues, vues depuis la session active\nGet-AzRoleAssignment | Select-Object DisplayName, RoleDefinitionName, Scope'),
  checks: CHECKS_LECTURE,
  source: doc('powershell/module/az.resources/get-azroleassignment'),
  sources: [
    { label: 'Get-AzRoleAssignment', url: doc('powershell/module/az.resources/get-azroleassignment') },
    { label: 'Qu’est-ce qu’Azure RBAC ?', url: doc('azure/role-based-access-control/overview') },
    SRC_ROLES,
    { label: 'Rôles intégrés Azure', url: doc('azure/role-based-access-control/built-in-roles') },
  ],
  cloud: {
    probleme: '« Je n’arrive pas à voir cette machine virtuelle » ou « qui peut supprimer ce groupe ? » : ces questions se règlent en lisant les affectations de rôles Azure, au bon niveau.',
    exemple: 'Un stagiaire ne voit pas le groupe de ressources du laboratoire. Le technicien lit ses affectations : aucune ne couvre ce groupe. La correction est une affectation Lecteur au niveau du groupe, pas Propriétaire sur l’abonnement.',
    lit: ['Les affectations de rôles Azure RBAC au niveau choisi', 'Les groupes de l’utilisateur ciblé (développés), s’il y en a un'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) ou tout rôle incluant Microsoft.Authorization/roleAssignments/read au niveau lu'],
    licences: ['Aucune'],
    limites: [
      'Ce sont des rôles Azure RBAC. Les rôles Microsoft Entra (Administrateur général, etc.) se lisent avec l’assistant Entra dédié.',
      'Les affectations PIM « éligibles » (à activer) ne sont pas listées comme actives.',
      'Absence d’affectation ne prouve pas absence d’accès : groupes imbriqués, affectations refusées (deny) ou niveau non lu.',
      'Aucun rôle n’est ajouté, retiré ni élevé.',
    ],
  },
});

// ===========================================================================
// B. MICROSOFT ENTRA ID
// ===========================================================================

const PREREQS_GRAPH = ['Une session Microsoft Graph ouverte par toi, en identité DÉLÉGUÉE (ton compte), avec uniquement les permissions de lecture listées dans la section Permissions. Une session applicative (secret ou certificat) est refusée par le script.'];

const ERREURS_GRAPH = [
  {
    message: 'Insufficient privileges to complete the operation (403)',
    cause: 'La permission Graph n’a pas été accordée à la session, ou ton compte n’a pas de rôle Microsoft Entra qui l’autorise.',
    fix: 'Reconnecte-toi avec la permission de lecture voulue (un consentement administrateur peut être demandé), ou demande le rôle Entra en lecture le plus étroit. Le rapport est INCOMPLET tant que c’est inaccessible.',
  },
  {
    message: 'Tu es Propriétaire de l’abonnement mais Entra refuse la lecture',
    cause: 'Rôles Azure RBAC et rôles Microsoft Entra sont deux systèmes distincts.',
    fix: 'Pour lire l’annuaire il faut un rôle Entra (par exemple Lecteur d’annuaire ou Lecteur général), pas un rôle Azure.',
  },
];

/** 4. entra-recherche — utilisateurs et groupes. */
export const outilEntraRecherche = outilAzure({
  id: 'entra-recherche',
  famille: FAMILLE_B,
  prefixe: 'kjemo-entra-recherche',
  title: 'Rechercher des utilisateurs ou des groupes Microsoft Entra',
  summary: 'Liste des utilisateurs (compte actif, type, création) ou des groupes (sécurité, Microsoft 365, dynamique) dont le nom commence par un texte donné. Ne lit ni adresse courriel secondaire, ni téléphone, ni mot de passe. Lecture seule.',
  portee: 'graph',
  scopes: (v) => (v && v.azObjet === 'Groupe' ? ['Group.Read.All', 'Directory.Read.All'] : ['User.Read.All', 'Directory.Read.All']),
  commandes: {
    obligatoires: ['Get-MgContext', 'Get-MgUser', 'Get-MgGroup'],
    facultatives: [],
  },
  champs: [
    {
      id: 'azObjet', label: 'Objet recherché', type: 'select', default: 'Utilisateur',
      options: [['Utilisateur', 'Utilisateurs'], ['Groupe', 'Groupes']],
      help: 'Les utilisateurs demandent User.Read.All, les groupes Group.Read.All (ou Directory.Read.All).',
    },
    { id: 'azDebut', label: 'Début du nom d’affichage (facultatif)', default: 'Lab', help: 'Les objets dont le nom commence par ce texte. Vide = les premiers de la liste. Aucun joker, aucune apostrophe.' },
    { id: 'azLimite', label: 'Nombre maximal de résultats', type: 'number', default: '25', min: 1, max: 100, help: 'Entre 1 et 100.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azObjet', validerChoixAzure(v.azObjet, ['Utilisateur', 'Groupe'], 'L’objet'));
    verif(errors, 'azDebut', validerDebutNom(v.azDebut, 'Le début du nom'));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 100, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Objet', psB64(v.azObjet)],
    ['Debut', psB64(String(v.azDebut ?? '').trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 100).value))],
  ],
  corps: () => [
    '$filtre = $null',
    "if ($KjemoArgDebut) { $filtre = \"startswith(displayName,'\" + $KjemoArgDebut + \"')\" }",
    "if ($KjemoArgObjet -eq 'Utilisateur') {",
    "  $liste = @(Invoke-KjemoLecture 'Utilisateurs' 'Recherche' {",
    "    $prop = 'id,displayName,userPrincipalName,accountEnabled,userType,createdDateTime'",
    '    if ($filtre) { Get-MgUser -Filter $filtre -Top ([int]$KjemoArgLimite) -Property $prop -ErrorAction Stop }',
    '    else { Get-MgUser -Top ([int]$KjemoArgLimite) -Property $prop -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    "    [void](Add-KjemoResultat -Categorie 'Utilisateurs' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$liste.Count + ' utilisateur(s)'))",
    '    foreach ($u in $liste) {',
    "      $note = 'Type : ' + [string]$u.UserType + '. Identifiant : ' + (Format-KjemoId ([string]$u.Id)) + '.'",
    "      if ($u.AccountEnabled -eq $false) { $note = $note + ' COMPTE DESACTIVE.' }",
    "      [void](Add-KjemoResultat -Categorie 'Utilisateurs' -Controle ([string]$u.DisplayName) -Etat 'INFO' -Valeur ([string]$u.UserPrincipalName) -Commentaire $note)",
    '    }',
    '    if ($liste.Count -eq 0) {',
    "      [void](Add-KjemoResultat -Categorie 'Utilisateurs' -Controle 'Resultat' -Etat 'INFO' -Valeur 'aucun resultat' -Commentaire 'Aucun utilisateur ne commence par ce texte, ou ton role ne permet pas de les voir.')",
    '    }',
    '  }',
    '} else {',
    "  $liste = @(Invoke-KjemoLecture 'Groupes' 'Recherche' {",
    "    $prop = 'id,displayName,securityEnabled,mailEnabled,groupTypes'",
    '    if ($filtre) { Get-MgGroup -Filter $filtre -Top ([int]$KjemoArgLimite) -Property $prop -ErrorAction Stop }',
    '    else { Get-MgGroup -Top ([int]$KjemoArgLimite) -Property $prop -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    "    [void](Add-KjemoResultat -Categorie 'Groupes' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$liste.Count + ' groupe(s)'))",
    '    foreach ($g in $liste) {',
    "      $nature = 'securite'",
    "      if (@($g.GroupTypes) -contains 'Unified') { $nature = 'Microsoft 365' }",
    "      if (@($g.GroupTypes) -contains 'DynamicMembership') { $nature = $nature + ' + appartenance DYNAMIQUE (regle, pas de membres ajoutes a la main)' }",
    "      [void](Add-KjemoResultat -Categorie 'Groupes' -Controle ([string]$g.DisplayName) -Etat 'INFO' -Valeur $nature -Commentaire ('Identifiant : ' + [string]$g.Id))",
    '    }',
    '    if ($liste.Count -eq 0) {',
    "      [void](Add-KjemoResultat -Categorie 'Groupes' -Controle 'Resultat' -Etat 'INFO' -Valeur 'aucun resultat' -Commentaire 'Aucun groupe ne commence par ce texte, ou ton role ne permet pas de les voir.')",
    '    }',
    '  }',
    '}',
  ],
  gui: [
    'Centre d’administration Microsoft Entra > Identité > Utilisateurs > Tous les utilisateurs : recherche par nom ou par nom d’utilisateur principal.',
    'Centre d’administration Microsoft Entra > Identité > Groupes > Tous les groupes : type (Sécurité ou Microsoft 365), type d’appartenance (Attribué ou Dynamique).',
    'Dans un groupe > Propriétés : l’identifiant d’objet à copier dans l’assistant « Appartenances ».',
    'Un utilisateur > Vue d’ensemble : le nom d’utilisateur principal et l’état du compte.',
  ],
  keywords: ['entra', 'azure ad', 'utilisateur', 'groupe', 'user', 'group', 'get-mguser', 'get-mggroup', 'annuaire', 'compte desactive', 'invite', 'guest', 'microsoft graph', 'recherche utilisateur'],
  prereqs: PREREQS_GRAPH,
  commonErrors: ERREURS_GRAPH,
  verifyAfter: [
    'Compare un utilisateur ou un groupe du rapport avec le centre d’administration Entra : même nom, même type.',
    'Si tu cherchais un compte précis et qu’il manque, vérifie d’abord qu’aucune ligne n’est INACCESSIBLE.',
    'Un groupe « dynamique » ne se corrige pas en ajoutant un membre : c’est sa règle qu’il faut lire.',
  ],
  rollback: rollbackLecture('# Un utilisateur précis, par son nom d’utilisateur principal\nGet-MgUser -UserId \'prenom.nom@contoso.com\' | Select-Object DisplayName, UserPrincipalName, AccountEnabled'),
  checks: CHECKS_LECTURE.concat(['Les adresses courriel, numéros de téléphone, dates de naissance et méthodes d’authentification ne sont pas demandés : seules les propriétés listées sont lues.']),
  source: doc('powershell/module/microsoft.graph.users/get-mguser'),
  sources: [
    { label: 'Get-MgUser', url: doc('powershell/module/microsoft.graph.users/get-mguser') },
    { label: 'Get-MgGroup', url: doc('powershell/module/microsoft.graph.groups/get-mggroup') },
    { label: 'Se connecter avec Microsoft Graph PowerShell', url: doc('powershell/microsoftgraph/authentication-commands') },
    SRC_ROLES,
  ],
  cloud: {
    probleme: 'Retrouver un compte ou un groupe dans l’annuaire de l’organisation : est-il actif ? invité ? dynamique ? Les réponses conditionnent presque toute intervention d’accès.',
    exemple: 'Un employé dit « je ne peux plus me connecter ». Le technicien cherche son compte : il est désactivé. Rien à réparer dans le mot de passe ; c’est un processus de départ qui l’a désactivé.',
    lit: ['Nom d’affichage, nom d’utilisateur principal, état du compte, type et date de création des utilisateurs', 'Nom, nature et type d’appartenance des groupes'],
    ecrit: ['Rien dans Microsoft Entra ID', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Graph délégué : User.Read.All (utilisateurs) ou Group.Read.All (groupes), ou Directory.Read.All', 'Rôle Microsoft Entra en lecture, par exemple Lecteur d’annuaire ou Lecteur général'],
    licences: ['Aucune licence particulière pour cette lecture'],
    limites: [
      'La recherche porte sur le début du nom d’affichage, pas sur le courriel ni sur le titre.',
      'Les résultats sont plafonnés : un annuaire plus grand que la limite n’est pas listé en entier.',
      'Les rôles et permissions de l’utilisateur ne sont pas lus ici : voir les assistants Appartenances et Rôles.',
    ],
  },
});

/** 5. entra-appartenances — groupes d'un utilisateur, ou membres d'un groupe. */
export const outilEntraAppartenances = outilAzure({
  id: 'entra-appartenances',
  famille: FAMILLE_B,
  prefixe: 'kjemo-entra-appartenances',
  title: 'Appartenances Entra : groupes d’un utilisateur ou membres d’un groupe',
  summary: 'Pour un utilisateur : les groupes et rôles d’annuaire dont il est membre direct. Pour un groupe : ses membres directs. Les groupes imbriqués ne sont pas développés. Lecture seule.',
  portee: 'graph',
  scopes: (v) => (v && v.azSens === 'Groupe'
    ? ['GroupMember.Read.All', 'Group.Read.All', 'Directory.Read.All']
    : ['User.Read.All', 'Directory.Read.All']),
  commandes: {
    obligatoires: ['Get-MgContext', 'Get-MgUserMemberOf', 'Get-MgGroupMember'],
    facultatives: [],
  },
  champs: [
    {
      id: 'azSens', label: 'Sens de la lecture', type: 'select', default: 'Utilisateur',
      options: [['Utilisateur', 'Les groupes d’un utilisateur'], ['Groupe', 'Les membres d’un groupe']],
      help: 'Utilisateur : donne un nom d’utilisateur principal ou un identifiant d’objet. Groupe : donne l’identifiant d’objet du groupe (GUID).',
    },
    { id: 'azCible', label: 'Utilisateur (UPN ou GUID) ou groupe (GUID)', default: 'prenom.nom@contoso.com', help: 'Un seul objet, jamais un joker. L’identifiant d’un groupe se copie depuis les Propriétés du groupe.' },
    { id: 'azLimite', label: 'Nombre maximal de lignes', type: 'number', default: '50', min: 1, max: 200, help: 'Entre 1 et 200.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azSens', validerChoixAzure(v.azSens, ['Utilisateur', 'Groupe'], 'Le sens'));
    if (v.azSens === 'Groupe') verif(errors, 'azCible', validerGuid(v.azCible, 'Le groupe'));
    else verif(errors, 'azCible', validerUtilisateur(v.azCible, 'L’utilisateur'));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 200, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Sens', psB64(v.azSens)],
    ['Cible', psB64(String(v.azCible).trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 200).value))],
  ],
  corps: () => [
    ...LIGNES_PROP_GRAPH,
    "if ($KjemoArgSens -eq 'Utilisateur') {",
    "  $liste = @(Invoke-KjemoLecture 'Appartenances' 'Groupes et roles de l utilisateur' { Get-MgUserMemberOf -UserId $KjemoArgCible -Top ([int]$KjemoArgLimite) -ErrorAction Stop })",
    '  if ($script:KjemoLectureOk) {',
    "    [void](Add-KjemoResultat -Categorie 'Appartenances' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$liste.Count + ' appartenance(s) directe(s)') -Commentaire 'Les groupes IMBRIQUES ne sont pas developpes : un acces peut venir d un groupe parent.')",
    '    foreach ($o in $liste) {',
    "      $type = (Get-KjemoPropGraph $o '@odata.type')",
    "      $nom = (Get-KjemoPropGraph $o 'displayName')",
    "      $genre = 'objet'",
    "      if ($type -like '*group') { $genre = 'groupe' }",
    "      elseif ($type -like '*directoryRole') { $genre = 'ROLE D ANNUAIRE Entra' }",
    "      $etat = 'INFO'",
    "      if ($genre -like 'ROLE*') { $etat = 'ATTENTION' }",
    "      [void](Add-KjemoResultat -Categorie 'Appartenances' -Controle $nom -Etat $etat -Valeur $genre -Commentaire ('Identifiant : ' + (Format-KjemoId ([string]$o.Id))))",
    '    }',
    '    if ($liste.Count -eq 0) {',
    "      [void](Add-KjemoResultat -Categorie 'Appartenances' -Controle 'Resultat' -Etat 'INFO' -Valeur 'aucune appartenance directe' -Commentaire 'Un acces peut quand meme exister par une affectation directe d un role Azure.')",
    '    }',
    '  }',
    '} else {',
    "  $liste = @(Invoke-KjemoLecture 'Appartenances' 'Membres du groupe' { Get-MgGroupMember -GroupId $KjemoArgCible -Top ([int]$KjemoArgLimite) -ErrorAction Stop })",
    '  if ($script:KjemoLectureOk) {',
    "    [void](Add-KjemoResultat -Categorie 'Appartenances' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$liste.Count + ' membre(s) direct(s)') -Commentaire 'Les sous-groupes ne sont pas developpes. La limite peut tronquer la liste.')",
    '    foreach ($o in $liste) {',
    "      $nom = (Get-KjemoPropGraph $o 'displayName')",
    "      $upn = (Get-KjemoPropGraph $o 'userPrincipalName')",
    "      $type = (Get-KjemoPropGraph $o '@odata.type')",
    "      [void](Add-KjemoResultat -Categorie 'Appartenances' -Controle $nom -Etat 'INFO' -Valeur $upn -Commentaire ('Type : ' + $type + '. Identifiant : ' + (Format-KjemoId ([string]$o.Id))))",
    '    }',
    '  }',
    '}',
  ],
  gui: [
    'Centre d’administration Microsoft Entra > Identité > Utilisateurs > ton utilisateur > Groupes : les groupes dont il est membre.',
    'Centre d’administration Microsoft Entra > Identité > Groupes > ton groupe > Membres : la liste des membres directs.',
    'Dans un groupe > Propriétaires : qui peut changer les membres.',
    'Utilisateur > Rôles et administrateurs attribués : les rôles Entra effectivement actifs ou éligibles.',
  ],
  keywords: ['appartenance', 'membre', 'membres du groupe', 'groupes de l utilisateur', 'memberof', 'get-mgusermemberof', 'get-mggroupmember', 'entra', 'azure ad', 'imbrique', 'pourquoi a t il acces'],
  prereqs: PREREQS_GRAPH,
  commonErrors: ERREURS_GRAPH.concat([
    {
      message: 'La liste est plus courte que dans le portail',
      cause: 'Le script lit les appartenances DIRECTES et plafonne la liste.',
      fix: 'Augmente la limite (200 au plus) ou compare avec le portail. Un groupe imbriqué n’est pas développé ici.',
    },
  ]),
  verifyAfter: [
    'Compare le nombre d’appartenances avec l’onglet Groupes (ou Membres) du centre d’administration Entra.',
    'Toute ligne « ROLE D ANNUAIRE Entra » est classée ATTENTION : relis-la, ce n’est pas un groupe ordinaire.',
    'Si le résultat est vide, ne conclus pas à l’absence d’accès : voir la limite sur les groupes imbriqués.',
  ],
  rollback: rollbackLecture('# Les groupes directs d’un utilisateur\nGet-MgUserMemberOf -UserId \'prenom.nom@contoso.com\' -Top 20'),
  checks: CHECKS_LECTURE,
  source: doc('powershell/module/microsoft.graph.users/get-mgusermemberof'),
  sources: [
    { label: 'Get-MgUserMemberOf', url: doc('powershell/module/microsoft.graph.users/get-mgusermemberof') },
    { label: 'Get-MgGroupMember', url: doc('powershell/module/microsoft.graph.groups/get-mggroupmember') },
    { label: 'Types de groupes et appartenance dans Microsoft Entra ID', url: doc('entra/fundamentals/concept-learn-about-groups') },
  ],
  cloud: {
    probleme: '« Pourquoi cette personne a-t-elle accès à ça ? » La réponse passe souvent par un groupe. Cet assistant lit les appartenances directes, dans un sens ou dans l’autre.',
    exemple: 'Un contractant doit perdre l’accès au laboratoire. Le technicien liste ses groupes : un seul groupe « Lab-Admins » le rattache au laboratoire. Retirer ce membre se fait dans le portail, avec les droits adéquats.',
    lit: ['Les groupes et rôles d’annuaire directs d’un utilisateur, ou les membres directs d’un groupe'],
    ecrit: ['Rien dans Microsoft Entra ID', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Graph délégué : User.Read.All (utilisateur) ou GroupMember.Read.All / Group.Read.All (groupe), ou Directory.Read.All', 'Rôle Microsoft Entra en lecture, par exemple Lecteur d’annuaire'],
    licences: ['Aucune licence particulière pour cette lecture'],
    limites: [
      'Appartenances directes seulement : les groupes imbriqués ne sont pas développés.',
      'Les affectations de rôles Azure RBAC faites directement à l’utilisateur n’apparaissent pas ici (voir l’assistant RBAC).',
      'Aucun membre n’est ajouté, retiré ni déplacé.',
    ],
  },
});

/** 6. entra-roles — rôles d'annuaire actifs et permissions nécessaires. */
export const outilEntraRoles = outilAzure({
  id: 'entra-roles',
  famille: FAMILLE_B,
  prefixe: 'kjemo-entra-roles',
  title: 'Rôles Microsoft Entra actifs et permissions nécessaires',
  summary: 'Liste les rôles d’annuaire Entra activés dans le tenant avec leurs membres, signale le nombre d’Administrateurs généraux, et rappelle quelle permission Graph et quel rôle sont nécessaires pour chaque lecture. Distingue explicitement les rôles Entra des rôles Azure RBAC. Lecture seule.',
  portee: 'graph',
  scopes: ['RoleManagement.Read.Directory', 'Directory.Read.All'],
  commandes: {
    obligatoires: ['Get-MgContext', 'Get-MgDirectoryRole', 'Get-MgDirectoryRoleMember'],
    facultatives: [],
  },
  champs: [
    { id: 'azDebut', label: 'Début du nom du rôle (facultatif)', default: '', help: 'Ex. Global pour « Global Administrator ». Vide = tous les rôles activés. Aucun joker.' },
    { id: 'azLimite', label: 'Nombre maximal de membres listés par rôle', type: 'number', default: '25', min: 1, max: 100, help: 'Entre 1 et 100.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azDebut', validerDebutNom(v.azDebut, 'Le début du nom'));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 100, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Debut', psB64(String(v.azDebut ?? '').trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 100).value))],
  ],
  corps: () => [
    ...LIGNES_PROP_GRAPH,
    "[void](Add-KjemoResultat -Categorie 'Rappel' -Controle 'Deux systemes de roles' -Etat 'INFO' -Valeur 'Entra (annuaire) et Azure RBAC (ressources)' -Commentaire 'Un role Entra ne donne pas d acces aux ressources Azure, et un role Azure ne donne pas de droit sur l annuaire. Cet assistant lit les roles ENTRA.')",
    "[void](Add-KjemoResultat -Categorie 'Rappel' -Controle 'Roles actives seulement' -Etat 'INFO' -Valeur 'les roles eligibles (PIM) ne sont pas listes' -Commentaire 'Un role disponible a l activation mais non active n apparait pas ici. Son absence ne prouve pas qu il n existe pas.')",
    "[void](Add-KjemoResultat -Categorie 'Rappel' -Controle 'Lire les utilisateurs et groupes' -Etat 'INFO' -Valeur 'User.Read.All / Group.Read.All + role Lecteur d annuaire' -Commentaire 'Lecture seule de l annuaire.')",
    "[void](Add-KjemoResultat -Categorie 'Rappel' -Controle 'Lire l enregistrement MFA' -Etat 'INFO' -Valeur 'AuditLog.Read.All + licence Entra ID P1 ou P2 + role de lecture des rapports' -Commentaire 'Voir l assistant MFA : donnees avec un delai possible, jamais une preuve d application.')",
    "$roles = @(Invoke-KjemoLecture 'Roles Entra' 'Roles actives dans le tenant' { Get-MgDirectoryRole -All -ErrorAction Stop })",
    'if ($script:KjemoLectureOk) {',
    '  if ($KjemoArgDebut) { $roles = @($roles | Where-Object { ([string]$_.DisplayName).StartsWith($KjemoArgDebut, [System.StringComparison]::OrdinalIgnoreCase) }) }',
    "  [void](Add-KjemoResultat -Categorie 'Roles Entra' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$roles.Count + ' role(s) active(s)'))",
    '  foreach ($r in @($roles | Sort-Object -Property DisplayName)) {',
    "    $membres = @(Invoke-KjemoLecture 'Roles Entra' ('Membres de ' + [string]$r.DisplayName) { Get-MgDirectoryRoleMember -DirectoryRoleId $r.Id -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk) {',
    '      $noms = @()',
    "      foreach ($m in @($membres | Select-Object -First ([int]$KjemoArgLimite))) { $noms += (Get-KjemoPropGraph $m 'userPrincipalName') }",
    "      $etat = 'INFO'",
    "      $note = 'Membres : ' + ($noms -join ', ')",
    "      if ([string]$r.DisplayName -eq 'Global Administrator' -and $membres.Count -ge 5) {",
    "        $etat = 'ATTENTION'",
    "        $note = $note + ' | Microsoft recommande de limiter le nombre d Administrateurs generaux (moins de cinq).'",
    '      }',
    "      if ([string]$r.DisplayName -eq 'Global Administrator' -and $membres.Count -lt 2) {",
    "        $etat = 'ATTENTION'",
    "        $note = $note + ' | Un seul Administrateur general : aucun compte de secours visible dans cette liste.'",
    '      }',
    "      [void](Add-KjemoResultat -Categorie 'Roles Entra' -Controle ([string]$r.DisplayName) -Etat $etat -Valeur ([string]$membres.Count + ' membre(s)') -Commentaire $note)",
    '    }',
    '  }',
    '}',
  ],
  gui: [
    'Centre d’administration Microsoft Entra > Identité > Rôles et administrateurs : tous les rôles, avec le nombre d’attributions.',
    'Dans un rôle > Attributions : les membres actifs et, avec Privileged Identity Management, les éligibles.',
    'Utilisateur > Rôles et administrateurs attribués : les rôles d’un compte précis.',
    'Portail Azure > Contrôle d’accès (IAM) : c’est l’autre système (Azure RBAC), pour les ressources.',
  ],
  keywords: ['role entra', 'administrateur general', 'global administrator', 'directory role', 'get-mgdirectoryrole', 'droits entra', 'permissions graph', 'pim', 'role d annuaire', 'lecteur d annuaire', 'azure ad roles', 'compte de secours'],
  prereqs: PREREQS_GRAPH,
  commonErrors: ERREURS_GRAPH.concat([
    {
      message: 'Un rôle attendu n’apparaît pas',
      cause: 'Get-MgDirectoryRole ne liste que les rôles ACTIVÉS dans le tenant ; un rôle jamais attribué n’y figure pas.',
      fix: 'Consulte la liste complète des rôles dans le centre d’administration. Les rôles éligibles PIM se lisent dans Privileged Identity Management.',
    },
  ]),
  verifyAfter: [
    'Compare le nombre de membres de « Global Administrator » avec le centre d’administration Entra.',
    'Aucune ligne n’est INACCESSIBLE ; sinon la liste des rôles ou de leurs membres est incomplète.',
    'Pour chaque rôle sensible, vérifie que chaque membre est connu et justifié.',
  ],
  rollback: rollbackLecture('# Les rôles d’annuaire activés\nGet-MgDirectoryRole | Select-Object DisplayName'),
  checks: CHECKS_LECTURE,
  source: doc('powershell/module/microsoft.graph.identity.directorymanagement/get-mgdirectoryrole'),
  sources: [
    { label: 'Get-MgDirectoryRole', url: doc('powershell/module/microsoft.graph.identity.directorymanagement/get-mgdirectoryrole') },
    { label: 'Get-MgDirectoryRoleMember', url: doc('powershell/module/microsoft.graph.identity.directorymanagement/get-mgdirectoryrolemember') },
    { label: 'Rôles intégrés Microsoft Entra', url: doc('entra/identity/role-based-access-control/permissions-reference') },
    SRC_ROLES,
  ],
  cloud: {
    probleme: 'Savoir qui peut tout faire dans l’annuaire, et quelle permission est nécessaire pour lire ce que l’on veut lire. Le « pourquoi ça me refuse l’accès » vient presque toujours d’un rôle ou d’une permission manquante.',
    exemple: 'Lors d’une revue de sécurité, l’équipe veut vérifier que le laboratoire n’a pas dix Administrateurs généraux. Le script liste les membres et signale le seuil recommandé par Microsoft.',
    lit: ['Les rôles d’annuaire Entra activés et leurs membres'],
    ecrit: ['Rien dans Microsoft Entra ID', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Graph délégué : RoleManagement.Read.Directory ou Directory.Read.All', 'Rôle Microsoft Entra en lecture, par exemple Lecteur général ou Lecteur d’annuaire'],
    licences: ['Aucune licence pour lister les rôles activés ; Privileged Identity Management (rôles éligibles) demande Entra ID P2, et n’est pas lu ici'],
    limites: [
      'Rôles Entra seulement, jamais Azure RBAC.',
      'Seuls les rôles ACTIVÉS sont listés ; les attributions éligibles (PIM) ne le sont pas.',
      'Aucun rôle n’est attribué, retiré ni élevé.',
    ],
  },
});

/** 7. entra-mfa — enregistrement MFA, avec ses limites. */
export const outilEntraMfa = outilAzure({
  id: 'entra-mfa',
  famille: FAMILLE_B,
  prefixe: 'kjemo-entra-mfa',
  title: 'Enregistrement de l’authentification multifacteur (MFA) : ce qui est lisible',
  summary: 'Lit le rapport d’enregistrement des méthodes d’authentification (MFA enregistré, capable, méthodes) pour un utilisateur ou les premiers du tenant. N’annonce JAMAIS une posture MFA « saine » : enregistré ne veut pas dire exigé, et une donnée inaccessible est dite inaccessible. Ne modifie ni ne désactive rien.',
  portee: 'graph',
  scopes: ['AuditLog.Read.All'],
  commandes: {
    obligatoires: ['Get-MgContext', 'Get-MgReportAuthenticationMethodUserRegistrationDetail'],
    facultatives: [],
  },
  champs: [
    { id: 'azUtilisateur', label: 'Utilisateur (UPN, facultatif)', default: '', help: 'Un nom d’utilisateur principal. Vide = les premiers utilisateurs du rapport, dans la limite ci-dessous.' },
    { id: 'azLimite', label: 'Nombre maximal d’utilisateurs', type: 'number', default: '25', min: 1, max: 100, help: 'Entre 1 et 100.' },
  ],
  verifier(v, errors) {
    const u = validerUtilisateur(v.azUtilisateur, 'L’utilisateur', { vide: true });
    verif(errors, 'azUtilisateur', u);
    if (u.ok && /^[0-9a-f]{8}-/i.test(u.value)) errors.azUtilisateur = 'Donne un nom d’utilisateur principal (prenom.nom@contoso.com) : ce rapport se filtre par UPN.';
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 100, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Utilisateur', psB64(String(v.azUtilisateur ?? '').trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 100).value))],
  ],
  corps: () => [
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Enregistre n est pas exige' -Etat 'INFO' -Valeur 'ce rapport dit ce qui est ENREGISTRE' -Commentaire 'Que le MFA soit EXIGE depend de l acces conditionnel ou des parametres de securite par defaut. Ce script ne les lit pas et n en deduit rien.')",
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Donnees possiblement en retard' -Etat 'INFO' -Valeur 'delai de mise a jour possible (de l ordre de 36 h)' -Commentaire 'Une inscription toute recente peut ne pas apparaitre encore.')",
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Licence' -Etat 'INFO' -Valeur 'Microsoft Entra ID P1 ou P2 requis pour ce rapport' -Commentaire 'Sans licence, la lecture est refusee : le resultat est alors INACCESSIBLE, jamais un MFA sain.')",
    '$details = @(Invoke-KjemoLecture \'MFA\' \'Rapport d enregistrement\' {',
    "  if ($KjemoArgUtilisateur) { Get-MgReportAuthenticationMethodUserRegistrationDetail -Filter (\"userPrincipalName eq '\" + $KjemoArgUtilisateur + \"'\") -ErrorAction Stop }",
    '  else { Get-MgReportAuthenticationMethodUserRegistrationDetail -Top ([int]$KjemoArgLimite) -ErrorAction Stop }',
    '})',
    'if ($script:KjemoLectureOk) {',
    '  $sansMfa = 0',
    "  [void](Add-KjemoResultat -Categorie 'MFA' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$details.Count + ' utilisateur(s) dans le rapport'))",
    '  foreach ($d in @($details | Select-Object -First ([int]$KjemoArgLimite))) {',
    '    $enreg = ($d.IsMfaRegistered -eq $true)',
    "    $etat = 'INFO'",
    "    $valeur = 'MFA enregistre'",
    "    $note = 'Methodes : ' + (@($d.MethodsRegistered) -join ', ') + '. Capable : ' + [string]$d.IsMfaCapable + '. Enregistre ne prouve pas que le MFA est exige.'",
    '    if (-not $enreg) {',
    "      $etat = 'ATTENTION'",
    "      $valeur = 'AUCUN MFA enregistre'",
    '      $sansMfa = $sansMfa + 1',
    "      if ($d.IsAdmin -eq $true) { $note = $note + ' COMPTE ADMINISTRATEUR sans MFA enregistre : a traiter en priorite par ceux qui en ont la responsabilite.' }",
    '    }',
    "    [void](Add-KjemoResultat -Categorie 'MFA' -Controle ([string]$d.UserPrincipalName) -Etat $etat -Valeur $valeur -Commentaire $note)",
    '  }',
    '  if ($details.Count -eq 0) {',
    "    [void](Add-KjemoResultat -Categorie 'MFA' -Controle 'Resultat' -Etat 'ATTENTION' -Valeur 'aucune ligne' -Commentaire 'Aucune ligne ne correspond. Ce n est pas un MFA sain : l utilisateur est absent du rapport, ou le rapport est en retard, ou tes droits ne le montrent pas.')",
    '  }',
    '  if ($sansMfa -gt 0) {',
    "    [void](Add-KjemoResultat -Categorie 'MFA' -Controle 'Synthese' -Etat 'ATTENTION' -Valeur ([string]$sansMfa + ' utilisateur(s) sans MFA enregistre') -Commentaire 'Constat seulement. Ce script ne modifie, n active et ne desactive aucun parametre MFA.')",
    '  }',
    '}',
  ],
  gui: [
    'Centre d’administration Microsoft Entra > Protection > Authentication methods > User registration details : le même rapport, avec filtres.',
    'Centre d’administration Microsoft Entra > Identité > Utilisateurs > ton utilisateur > Méthodes d’authentification : les méthodes de cet utilisateur.',
    'Centre d’administration Microsoft Entra > Protection > Accès conditionnel : c’est là que le MFA est EXIGÉ ou non.',
    'Centre d’administration Microsoft Entra > Identité > Vue d’ensemble > Propriétés > Gérer les paramètres de sécurité par défaut : l’autre mécanisme d’exigence.',
  ],
  keywords: ['mfa', 'multifacteur', 'authentification multifacteur', 'authentication methods', 'deux facteurs', '2fa', 'enregistrement mfa', 'get-mgreportauthenticationmethoduserregistrationdetail', 'securite entra', 'comptes sans mfa', 'administrateur sans mfa'],
  prereqs: PREREQS_GRAPH.concat(['Une licence Microsoft Entra ID P1 ou P2 dans le tenant, et un rôle qui autorise la lecture des rapports d’authentification. Sans cela, la lecture est refusée et le rapport l’écrit.']),
  commonErrors: ERREURS_GRAPH.concat([
    {
      message: 'Aucune ligne pour un utilisateur que je sais enregistré',
      cause: 'Le rapport peut avoir un retard de mise à jour, l’utilisateur peut être hors périmètre de tes droits, ou le nom d’utilisateur est faux.',
      fix: 'Attends la mise à jour, vérifie l’UPN, puis compare avec l’onglet Méthodes d’authentification de l’utilisateur dans le centre d’administration.',
    },
  ]),
  verifyAfter: [
    'Pour un utilisateur, ouvre l’onglet Méthodes d’authentification dans Entra et compare avec la ligne du rapport.',
    'Ne tire AUCUNE conclusion de sécurité d’un rapport qui contient une ligne INACCESSIBLE.',
    'Pour savoir si le MFA est EXIGÉ, lis les stratégies d’accès conditionnel et les paramètres de sécurité par défaut : ce script ne le fait pas.',
  ],
  rollback: rollbackLecture('# Le rapport, pour un utilisateur précis\nGet-MgReportAuthenticationMethodUserRegistrationDetail -Filter "userPrincipalName eq \'prenom.nom@contoso.com\'"'),
  checks: CHECKS_LECTURE.concat([
    'Aucune désactivation, modification ni contournement du MFA : ce lot ne propose aucune commande qui touche aux paramètres d’authentification.',
    'Aucun secret d’application n’est créé ni demandé.',
    'Aucune posture MFA « saine » n’est annoncée : le rapport dit ce qui est enregistré, ce qui est inaccessible, et rien de plus.',
  ]),
  source: doc('powershell/module/microsoft.graph.reports/get-mgreportauthenticationmethoduserregistrationdetail'),
  sources: [
    { label: 'Get-MgReportAuthenticationMethodUserRegistrationDetail', url: doc('powershell/module/microsoft.graph.reports/get-mgreportauthenticationmethoduserregistrationdetail') },
    { label: 'Fonctionnement de l’authentification multifacteur Microsoft Entra', url: doc('entra/identity/authentication/concept-mfa-howitworks') },
    { label: 'Rapport d’activité d’inscription aux méthodes d’authentification', url: doc('entra/identity/authentication/howto-authentication-methods-activity') },
    { label: 'Paramètres de sécurité par défaut', url: doc('entra/fundamentals/security-defaults') },
  ],
  cloud: {
    probleme: '« Est-ce que nos comptes ont le MFA ? » est une question de sécurité fondamentale, et la mauvaise réponse est la plus dangereuse : annoncer « tout est bon » alors que la donnée n’est pas lisible.',
    exemple: 'Une direction demande si les comptes administrateurs sont protégés. Le technicien lance l’assistant : deux administrateurs n’ont aucune méthode enregistrée et une partie du rapport est inaccessible. Le rapport dit les deux choses, et refuse de conclure.',
    lit: ['L’état d’enregistrement des méthodes d’authentification (enregistré, capable, méthodes) pour un utilisateur ou les premiers du rapport'],
    ecrit: ['Rien dans Microsoft Entra ID', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Graph délégué : AuditLog.Read.All', 'Rôle Microsoft Entra autorisant les rapports d’authentification (par exemple Lecteur de rapports, Lecteur de sécurité ou Lecteur général)'],
    licences: ['Microsoft Entra ID P1 ou P2 requis pour ce rapport ; sans licence, la lecture est refusée'],
    limites: [
      'Enregistré ne signifie pas exigé : seuls l’accès conditionnel et les paramètres de sécurité par défaut décident de l’exigence, et ce script ne les lit pas.',
      'Les données peuvent avoir un retard de l’ordre de 36 heures.',
      'Aucune commande de désactivation du MFA n’est générée, ni aucune création de secret applicatif.',
      'Une donnée inaccessible est classée INACCESSIBLE et rend le rapport INCOMPLET : jamais « sain ».',
    ],
  },
});

export const toolsAzureAcces = [
  outilAzureContexte,
  outilAzureAbonnementsRg,
  outilAzureRbac,
  outilEntraRecherche,
  outilEntraAppartenances,
  outilEntraRoles,
  outilEntraMfa,
];
