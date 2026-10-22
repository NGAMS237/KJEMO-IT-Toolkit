/**
 * noyau-azure.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le socle commun des 24 assistants Azure et Microsoft Entra ID : blocs
 * PowerShell partagés, export de rapport sans secret, et la fabrique qui
 * transforme une définition compacte en fiche complète.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CE LOT GÉNÈRE, ET CE QU'IL NE FAIT PAS
 * ---------------------------------------------------------------------------
 * Le Toolkit est un site statique. Il ne se connecte à rien, n'exécute rien et
 * ne stocke aucune session. Il écrit un script que la personne lit, puis lance
 * dans SON terminal, après s'être connectée elle-même.
 *
 * Conséquences, toutes testées :
 *
 *   1. AUCUN SCRIPT NE SE CONNECTE. Ni Connect-AzAccount, ni Connect-MgGraph,
 *      ni Set-AzContext, ni Select-AzSubscription. La connexion est
 *      interactive et se fait avant, hors du Toolkit. Le script LIT le contexte
 *      existant et le COMPARE à ce que la personne a déclaré attendre.
 *
 *   2. UN CONTEXTE DIFFÉRENT EST REFUSÉ, il n'est jamais « corrigé ». Basculer
 *      d'abonnement à la place de l'utilisateur est la façon classique de
 *      modifier la production en croyant travailler sur un laboratoire.
 *
 *   3. UN GUID D'EXEMPLE NON REMPLACÉ EST REFUSÉ À L'EXÉCUTION. Le formulaire
 *      est pré-rempli avec des identifiants volontairement faux : le script se
 *      génère (on peut le lire), mais il ne lit rien tant que la personne n'a
 *      pas mis ses propres identifiants.
 *
 *   4. UNE LECTURE IMPOSSIBLE N'EST JAMAIS « OK ». Accès refusé, licence
 *      absente, API indisponible : le contrôle est classé ATTENTION avec la
 *      mention INACCESSIBLE, et la conclusion du rapport dit que le résultat
 *      est incomplet. Aucune phrase du rapport n'annonce « sain » faute de
 *      données.
 *
 *   5. AUCUN SECRET NI DANS UN CHAMP, NI DANS UN SCRIPT, NI DANS UN RAPPORT.
 *      Les validateurs refusent les formes usuelles de secrets ; les messages
 *      d'erreur sont filtrés avant d'entrer dans le rapport ; les identifiants
 *      de tenant et d'abonnement y sont tronqués.
 *
 *   6. LES ACTIONS SONT RARES ET VERROUILLÉES. Trois assistants seulement
 *      agissent (démarrer, arrêter, restaurer). Chacun exige une cible
 *      précise, le mode « Appliquer » ET une phrase de confirmation exacte. Le
 *      mode par défaut exécute la commande avec -WhatIf, parce que ces trois
 *      cmdlets — et elles seules — le prennent réellement en charge.
 *
 * Ce module n'importe que des modules sans effet de bord.
 */

import { psB64, assertValid } from './noyau.mjs';
import {
  enteteScript,
  fonctionsRapport,
  blocParametres,
} from './rapport-ps.mjs';
import {
  GUID_EXEMPLE_TENANT,
  GUID_EXEMPLE_ABONNEMENT,
  validerGuid,
  validerChoixAzure,
  secretsDans,
} from './validateurs-azure.mjs';

import { SOUS_RUBRIQUES_AZURE } from './categories.mjs';

export const VERSION_AZURE = 'LOT 8 — Azure et Entra ID — 8.0.0';

export const CATEGORIE_AZURE = 'Azure et Entra ID';

/** Les six familles du lot : la liste canonique vit dans categories.mjs. */
export { SOUS_RUBRIQUES_AZURE };

export const FORMATS_AZURE = ['Console', 'JSON', 'CSV'];

/**
 * Compatibilité déclarée. Elle est volontairement précise : « PowerShell 7 »
 * seul ne dirait pas que Windows PowerShell 5.1 est visé aussi, et « Az »
 * seul ne dit pas quel module. Les modules Az exigent Windows PowerShell 5.1
 * avec .NET Framework 4.7.2 ou plus, ou PowerShell 7.x ; Microsoft Graph
 * PowerShell vise PowerShell 7 et Windows PowerShell 5.1.
 */
export const OS_AZURE = [
  'Windows PowerShell 5.1 (.NET Framework 4.7.2 ou plus) — Windows 10, Windows 11, Windows Server 2019 ou plus',
  'PowerShell 7.x — Windows, Linux (Ubuntu 22.04, Debian 12) et macOS',
  'Module Az (Azure) ou module Microsoft Graph PowerShell, installés dans la session',
];

// ---------------------------------------------------------------------------
// Champs communs
// ---------------------------------------------------------------------------

export function champTenant() {
  return {
    id: 'azTenant',
    label: 'Tenant attendu (GUID)',
    default: GUID_EXEMPLE_TENANT,
    help: 'L’identifiant du répertoire (tenant) dans lequel tu comptes travailler. Le script le compare à la session ouverte et refuse tout écart. Le GUID d’exemple est refusé à l’exécution : remplace-le.',
  };
}

export function champAbonnement() {
  return {
    id: 'azAbonnement',
    label: 'Abonnement attendu (GUID)',
    default: GUID_EXEMPLE_ABONNEMENT,
    help: 'L’identifiant de l’abonnement visé. Aucun abonnement n’est choisi à ta place : si la session pointe ailleurs, le script s’arrête sans rien lire.',
  };
}

export function champFormatAzure(id = 'azFormat') {
  return {
    id,
    label: 'Format du rapport',
    type: 'select',
    default: 'Console',
    options: FORMATS_AZURE.map((f) => [f, f === 'Console' ? 'Console seulement' : `Console + fichier ${f}`]),
    help: 'Les fichiers sont écrits dans le dossier courant du terminal. Les identifiants de tenant et d’abonnement y sont tronqués ; aucun secret n’y figure.',
  };
}

export function champModeAzure(aide) {
  return {
    id: 'azMode',
    label: 'Mode d’exécution',
    type: 'select',
    default: 'Diagnostic',
    options: [
      ['Diagnostic', 'Diagnostic — prévisualisation (-WhatIf), rien n’est modifié'],
      ['Appliquer', 'Appliquer — exécute l’action, après confirmation'],
    ],
    help: aide || 'Diagnostic n’exécute que la prévisualisation de la commande. Appliquer exige en plus la phrase de confirmation exacte.',
  };
}

export function champConfirmationAzure(phrase) {
  return {
    id: 'azConfirmation',
    label: 'Confirmation (vide = aucune action)',
    default: '',
    help: `Pour agir, recopie exactement : ${phrase}`,
  };
}

// ---------------------------------------------------------------------------
// Blocs PowerShell communs
// ---------------------------------------------------------------------------

/**
 * Fonctions communes. Écrites pour Windows PowerShell 5.1 ET PowerShell 7 :
 * pas de ternaire, pas de « ?? », pas de CIM ni de variable propre à Windows.
 */
export function fonctionsAzure() {
  return String.raw`# --- Aides communes Azure et Entra ID (LOT 8) ---------------------------------------
$script:KjemoLectureOk = $true
$script:KjemoInaccessibles = 0
$script:KjemoContexteRefuse = $false

# Masque ce qui ressemble a un secret avant que le texte n'entre dans un rapport.
function Hide-KjemoSecrets {
  param([string]$Texte)
  if ([string]::IsNullOrEmpty($Texte)) { return '' }
  $t = $Texte
  $t = [regex]::Replace($t, 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*', '[JETON MASQUE]')
  $t = [regex]::Replace($t, '(?i)\b(sig|sv|se|sp|srt|ss)=[^&\s]+', '$1=[MASQUE]')
  $t = [regex]::Replace($t, '(?i)\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}', '$1 [MASQUE]')
  $t = [regex]::Replace($t, '(?i)(AccountKey|SharedAccessSignature|client_secret|password)\s*[=:]\s*\S+', '$1=[MASQUE]')
  return $t
}

# Tronque un identifiant : 8 premiers caracteres, le reste masque.
function Format-KjemoId {
  param([string]$Id)
  if ([string]::IsNullOrEmpty($Id)) { return '(vide)' }
  if ($Id.Length -ge 8) { return ($Id.Substring(0, 8) + '-****') }
  return '****'
}

# Verifie que les commandes necessaires existent REELLEMENT dans cette session.
# Une commande obligatoire absente arrete tout : le script ne devine pas.
function Test-KjemoCommandes {
  param([string[]]$Obligatoires = @(), [string[]]$Facultatives = @())
  $ok = $true
  foreach ($nom in $Obligatoires) {
    $c = Get-Command -Name $nom -ErrorAction SilentlyContinue
    if ($null -eq $c) {
      [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle $nom -Etat 'PROBLEME' -Valeur 'commande absente' -Commentaire 'Le module qui fournit cette commande n est pas charge dans cette session. Installe le module Az (ou Microsoft.Graph) dans TON terminal, puis relance. Ce script n installe rien.')
      $ok = $false
    } else {
      [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle $nom -Etat 'OK' -Valeur 'disponible' -Commentaire ('Type : ' + [string]$c.CommandType))
    }
  }
  foreach ($nom in $Facultatives) {
    $c = Get-Command -Name $nom -ErrorAction SilentlyContinue
    if ($null -eq $c) {
      [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle $nom -Etat 'ATTENTION' -Valeur 'commande absente' -Commentaire 'Commande facultative : le controle qui en depend sera ignore et le rapport sera incomplet.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle $nom -Etat 'OK' -Valeur 'disponible')
    }
  }
  return $ok
}

# Refuse les identifiants d exemple, vides ou nuls.
function Test-KjemoIdentifiantReel {
  param([string]$Libelle, [string]$Valeur)
  $exemples = @('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000')
  if ([string]::IsNullOrWhiteSpace($Valeur)) {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle $Libelle -Etat 'PROBLEME' -Valeur 'vide' -Commentaire 'Aucune valeur par defaut n est choisie a ta place.')
    return $false
  }
  if ($exemples -contains $Valeur.Trim().ToLowerInvariant()) {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle $Libelle -Etat 'PROBLEME' -Valeur 'identifiant d exemple' -Commentaire 'Le GUID d exemple du formulaire n a pas ete remplace. Regenere le script avec TES identifiants.')
    return $false
  }
  return $true
}

# Compare la session Azure ouverte a ce qui est attendu. Ne change JAMAIS de contexte.
function Test-KjemoContexteAzure {
  param([string]$TenantAttendu, [string]$AbonnementAttendu)
  $ok = $true
  if (-not (Test-KjemoIdentifiantReel -Libelle 'Tenant attendu' -Valeur $TenantAttendu)) { $ok = $false }
  if (-not (Test-KjemoIdentifiantReel -Libelle 'Abonnement attendu' -Valeur $AbonnementAttendu)) { $ok = $false }
  if (-not $ok) { return $false }
  $ctx = $null
  try { $ctx = Get-AzContext -ErrorAction Stop } catch { $ctx = $null }
  if ($null -eq $ctx -or $null -eq $ctx.Subscription -or $null -eq $ctx.Tenant) {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Session Azure' -Etat 'PROBLEME' -Valeur 'aucune session' -Commentaire 'Aucune connexion Azure dans cette console. Connecte-toi toi-meme, dans ton terminal, puis relance. Ce script ne se connecte jamais.')
    return $false
  }
  $tenantReel = [string]$ctx.Tenant.Id
  $aboReel = [string]$ctx.Subscription.Id
  $nomAbo = [string]$ctx.Subscription.Name
  $compte = ''
  if ($null -ne $ctx.Account) { $compte = [string]$ctx.Account.Id }
  $envNom = ''
  if ($null -ne $ctx.Environment) { $envNom = [string]$ctx.Environment.Name }
  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Compte connecte' -Etat 'INFO' -Valeur $compte -Commentaire ('Environnement : ' + $envNom))
  $tenantOk = [string]::Equals($tenantReel, $TenantAttendu.Trim(), [System.StringComparison]::OrdinalIgnoreCase)
  $aboOk = [string]::Equals($aboReel, $AbonnementAttendu.Trim(), [System.StringComparison]::OrdinalIgnoreCase)
  if ($tenantOk) {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Tenant' -Etat 'OK' -Valeur (Format-KjemoId $tenantReel) -Commentaire 'Identique au tenant attendu.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Tenant' -Etat 'PROBLEME' -Valeur ('session = ' + (Format-KjemoId $tenantReel) + ' / attendu = ' + (Format-KjemoId $TenantAttendu)) -Commentaire 'REFUS : la session pointe vers un autre tenant. Le script ne change pas de contexte a ta place.')
  }
  if ($aboOk) {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Abonnement' -Etat 'OK' -Valeur ((Format-KjemoId $aboReel) + ' (' + $nomAbo + ')') -Commentaire 'Identique a l abonnement attendu.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Abonnement' -Etat 'PROBLEME' -Valeur ('session = ' + (Format-KjemoId $aboReel) + ' / attendu = ' + (Format-KjemoId $AbonnementAttendu)) -Commentaire 'REFUS : la session pointe vers un autre abonnement. Aucun abonnement n est choisi a ta place : bascule toi-meme dans ton terminal, puis relance.')
  }
  return ($tenantOk -and $aboOk)
}

# Compare la session Microsoft Graph a ce qui est attendu : tenant, mode delegue, droits.
function Test-KjemoContexteGraph {
  param([string]$TenantAttendu, [string[]]$ScopesAcceptes = @())
  if (-not (Test-KjemoIdentifiantReel -Libelle 'Tenant attendu' -Valeur $TenantAttendu)) { return $false }
  $ctx = $null
  try { $ctx = Get-MgContext -ErrorAction Stop } catch { $ctx = $null }
  if ($null -eq $ctx) {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Session Microsoft Graph' -Etat 'PROBLEME' -Valeur 'aucune session' -Commentaire 'Aucune connexion Microsoft Graph dans cette console. Connecte-toi toi-meme, dans ton terminal, avec les permissions listees dans la fiche, puis relance.')
    return $false
  }
  $ok = $true
  $tenantReel = [string]$ctx.TenantId
  if ([string]::Equals($tenantReel, $TenantAttendu.Trim(), [System.StringComparison]::OrdinalIgnoreCase)) {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Tenant' -Etat 'OK' -Valeur (Format-KjemoId $tenantReel) -Commentaire 'Identique au tenant attendu.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Tenant' -Etat 'PROBLEME' -Valeur ('session = ' + (Format-KjemoId $tenantReel) + ' / attendu = ' + (Format-KjemoId $TenantAttendu)) -Commentaire 'REFUS : la session Graph pointe vers un autre tenant.')
    $ok = $false
  }
  $auth = [string]$ctx.AuthType
  if ($auth -eq 'AppOnly') {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Mode d authentification' -Etat 'PROBLEME' -Valeur 'application (AppOnly)' -Commentaire 'REFUS : ce lot lit avec TON identite deleguee. Une session applicative (secret ou certificat) n est pas acceptee ici.')
    $ok = $false
  } else {
    [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Mode d authentification' -Etat 'OK' -Valeur $auth -Commentaire 'Identite deleguee de la personne connectee.')
  }
  $compte = [string]$ctx.Account
  if ($compte) { [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Compte connecte' -Etat 'INFO' -Valeur $compte) }
  if ($ScopesAcceptes.Count -gt 0) {
    $accordes = @($ctx.Scopes)
    $trouve = $false
    foreach ($s in $ScopesAcceptes) { if ($accordes -contains $s) { $trouve = $true } }
    if ($trouve) {
      [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Permissions Graph' -Etat 'OK' -Valeur 'au moins une permission requise est accordee' -Commentaire ('Acceptees : ' + ($ScopesAcceptes -join ', ')))
    } else {
      [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Permissions Graph' -Etat 'PROBLEME' -Valeur 'permission absente' -Commentaire ('REFUS : aucune de ces permissions n est accordee a la session : ' + ($ScopesAcceptes -join ', ') + '. Reconnecte-toi avec la permission en lecture voulue (consentement administrateur parfois requis).'))
      $ok = $false
    }
  }
  return $ok
}

# Execute UNE lecture. Un echec n est jamais un OK : il est classe INACCESSIBLE,
# INTROUVABLE ou ERREUR, toujours en ATTENTION. Chaque lecture doit porter
# -ErrorAction Stop, sinon l erreur serait avalee et lue comme "rien a signaler".
function Invoke-KjemoLecture {
  param(
    [Parameter(Mandatory=$true)][string]$Categorie,
    [Parameter(Mandatory=$true)][string]$Controle,
    [Parameter(Mandatory=$true)][scriptblock]$Action
  )
  $script:KjemoLectureOk = $true
  try {
    & $Action
  } catch {
    $script:KjemoLectureOk = $false
    $msg = Hide-KjemoSecrets ([string]$_.Exception.Message)
    if ($msg.Length -gt 240) { $msg = $msg.Substring(0, 240) + '...' }
    $classe = 'ERREUR'
    if ($msg -match '(?i)AuthorizationFailed|does not have authorization|Authorization_RequestDenied|Insufficient privileges|Forbidden|403|AccessDenied|not authorized|licen[cs]e|Premium') {
      $classe = 'INACCESSIBLE'
      $script:KjemoInaccessibles = $script:KjemoInaccessibles + 1
    } elseif ($msg -match '(?i)ResourceNotFound|ResourceGroupNotFound|NotFound|could not be found|404') {
      $classe = 'INTROUVABLE'
    }
    [void](Add-KjemoResultat -Categorie $Categorie -Controle $Controle -Etat 'ATTENTION' -Valeur $classe -Commentaire ('Lecture non aboutie : ' + $msg + ' Ce controle ne prouve RIEN : ne pas le lire comme un etat normal.'))
  }
}

# Neutralise une cellule CSV qu un tableur lirait comme une formule.
function ConvertTo-KjemoCelluleSure {
  param([string]$Texte)
  if ([string]::IsNullOrEmpty($Texte)) { return '' }
  if ($Texte -match '^[=+\-@\t\r]') { return ("'" + $Texte) }
  return $Texte
}`;
}

/** Bloc d'export portable : aucune dépendance à Windows, aucun secret. */
export function blocExportAzure({ prefixeFichier }) {
  return String.raw`
# ---------------------------------------------------------------------------
# Rapport — formats : Console, JSON, CSV. Aucun secret, identifiants tronques.
# ---------------------------------------------------------------------------
$KjemoFin = Get-Date
$KjemoConclusion = ''
if ($script:KjemoContexteRefuse) {
  $KjemoConclusion = 'REFUS : prerequis ou contexte non valides. AUCUNE lecture n a ete effectuee et AUCUNE conclusion ne peut etre tiree.'
} elseif ($script:KjemoInaccessibles -gt 0) {
  $KjemoConclusion = 'RESULTAT INCOMPLET : ' + [string]$script:KjemoInaccessibles + ' lecture(s) inaccessible(s) (droits, licence ou API). Ne conclus pas que tout va bien : ce qui n a pas pu etre lu n a pas ete verifie.'
} elseif ($KjemoAvertissements.Count -gt 0) {
  $KjemoConclusion = [string]$KjemoAvertissements.Count + ' point(s) a examiner - voir la section Avertissements.'
} else {
  $KjemoConclusion = 'Les lectures effectuees n ont signale aucun point. Cela ne couvre que ce qui a ete lu.'
}

$KjemoRapport = [pscustomobject]@{
  Outil          = $KjemoOutil
  Version        = $KjemoVersion
  Machine        = [Environment]::MachineName
  Plateforme     = [string][Environment]::OSVersion.Platform
  PowerShell     = $PSVersionTable.PSVersion.ToString()
  Debut          = $KjemoDebut.ToString('s')
  Fin            = $KjemoFin.ToString('s')
  Parametres     = $KjemoParametres
  Controles      = @($KjemoResultats)
  Avertissements = @($KjemoAvertissements)
  Conclusion     = $KjemoConclusion
}

Write-Host ''
Write-Host "=== $KjemoOutil ==="
Write-Host (($KjemoResultats | Format-Table Categorie,Controle,Etat,Valeur,Commentaire -AutoSize | Out-String -Width 220).TrimEnd())
if ($KjemoAvertissements.Count -gt 0) {
  Write-Host ''
  Write-Host '--- Avertissements ---'
  $KjemoAvertissements | ForEach-Object { Write-Host $_ }
}
Write-Host ''
Write-Host "Conclusion : $KjemoConclusion"

if ($KjemoFormat -ne 'Console') {
  $KjemoDossier = (Get-Location).Path
  $KjemoBase = Join-Path $KjemoDossier ('${prefixeFichier}-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  if ($KjemoFormat -eq 'JSON') {
    $KjemoRapport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath ($KjemoBase + '.json') -Encoding UTF8
    Write-Host "Rapport JSON : $($KjemoBase).json"
  }
  elseif ($KjemoFormat -eq 'CSV') {
    $KjemoSurs = @($KjemoResultats | ForEach-Object {
      [pscustomobject]@{
        Categorie   = ConvertTo-KjemoCelluleSure ([string]$_.Categorie)
        Controle    = ConvertTo-KjemoCelluleSure ([string]$_.Controle)
        Etat        = [string]$_.Etat
        Valeur      = ConvertTo-KjemoCelluleSure ([string]$_.Valeur)
        Commentaire = ConvertTo-KjemoCelluleSure ([string]$_.Commentaire)
        Horodatage  = [string]$_.Horodatage
      }
    })
    $KjemoSurs | Export-Csv -LiteralPath ($KjemoBase + '.csv') -NoTypeInformation -Encoding UTF8
    Write-Host "Rapport CSV : $($KjemoBase).csv"
  }
}`;
}

// ---------------------------------------------------------------------------
// Bloc « cloud » : ce que la fiche dit en plus du contrat commun
// ---------------------------------------------------------------------------

const CHAMPS_CLOUD = ['probleme', 'exemple', 'lit', 'ecrit', 'facture', 'permissions', 'licences', 'limites'];

/**
 * Ce que la fiche annonce du moteur et de la validation. Le texte est tenu à
 * l'écart des définitions pour qu'il soit le même partout — et pour qu'on ne
 * puisse pas écrire « testé » sur un assistant qui ne l'est pas.
 */
export const MOTEURS_AZURE = 'Compatibilité visée : Windows PowerShell 5.1 et PowerShell 7.x. Les scripts évitent la syntaxe propre à PowerShell 7 (ternaire, « ?? », « && »). Le moteur exact de chaque essai est consigné dans le rapport de lot.';

export const VALIDATION_AZURE = [
  'Syntaxe : le script est analysé par l’analyseur PowerShell 7 (exécuté). Windows PowerShell 5.1 : NON EXÉCUTÉ dans cette livraison — la vérification est prévue dans la CI Windows.',
  'Exécution avec doublures : des fonctions factices reproduisent les paramètres documentés des commandes Az et Graph (aucune connexion, aucun tenant réel, aucune ressource créée).',
  'Essai réel sur Azure : NON EXÉCUTÉ. Aucun test de ce lot n’a touché un vrai tenant ni un vrai abonnement.',
];

/** Erreurs communes à tous les assistants du lot. */
export const ERREURS_AZURE = [
  {
    message: 'REFUS : la session pointe vers un autre tenant ou un autre abonnement',
    cause: 'La session ouverte dans le terminal n’est pas celle que tu as déclarée dans le formulaire.',
    fix: 'Le script ne change jamais de contexte. Vérifie dans ton terminal quelle session est active, bascule toi-même si c’est voulu, ou corrige l’identifiant du formulaire, puis relance.',
    command: 'Get-AzContext',
  },
  {
    message: 'Le GUID d’exemple n’a pas été remplacé',
    cause: 'Le formulaire est pré-rempli avec des identifiants volontairement faux (11111111-… et 22222222-…).',
    fix: 'Remplace-les par ton tenant et ton abonnement réels, puis régénère le script. Il refuse de lire tant que c’est fait.',
  },
  {
    message: 'INACCESSIBLE (AuthorizationFailed, 403, Insufficient privileges)',
    cause: 'Ton compte n’a pas le rôle ou la permission nécessaire, ou la fonction demande une licence que le tenant n’a pas.',
    fix: 'Le rapport est alors INCOMPLET et le dit. Demande le rôle en lecture le plus étroit qui convient (voir la section Permissions de la fiche), jamais Propriétaire ni Administrateur général « pour essayer ».',
  },
];

/** Prérequis communs, en tête de chaque fiche. */
export const PREREQS_AZURE = [
  'Une session déjà ouverte DANS TON TERMINAL, par toi-même (connexion interactive). Le Toolkit et le script ne se connectent jamais, ne demandent aucun mot de passe et ne gardent aucun jeton.',
  'Les identifiants du tenant et de l’abonnement visés, copiés depuis le portail Azure (Microsoft Entra ID > Vue d’ensemble ; Abonnements). Les GUID d’exemple du formulaire sont refusés à l’exécution.',
  'Un compte avec un rôle en lecture suffisant. Les rôles Microsoft Entra (gèrent l’annuaire) et les rôles Azure RBAC (gèrent les ressources) sont deux systèmes distincts : un Administrateur général n’a pas automatiquement accès aux ressources d’un abonnement.',
  'Windows PowerShell 5.1 (.NET Framework 4.7.2 ou plus) ou PowerShell 7.x. Les modules sont installés par toi, dans ta session ; le script vérifie leur présence et n’installe rien.',
];

/** Contrôles communs à tout assistant en lecture seule. */
export const CHECKS_LECTURE = [
  'Aucune commande de connexion ni de changement de contexte : le script lit la session ouverte et la compare à ce qui est déclaré.',
  'Aucune création, modification ni suppression dans Azure ou Microsoft Entra ID : seules des commandes de lecture sont appelées.',
  'Aucun secret demandé, lu ni écrit : pas de mot de passe, de clé de compte, de jeton SAS ni de secret d’application.',
  'Une lecture refusée, introuvable ou en erreur est classée ATTENTION et jamais OK ; le rapport devient INCOMPLET au lieu de conclure.',
  'Un tenant, un abonnement ou une cible différents de ceux déclarés sont refusés, et le corps du script ne s’exécute pas.',
];

/** Annulation d'un assistant en lecture seule. */
export function rollbackLecture(diagnostic) {
  return {
    summary: 'Assistant en lecture seule : il ne crée, ne modifie et ne supprime rien dans Azure ni dans Microsoft Entra ID. Il n’y a rien à annuler côté cloud.',
    diagnostic,
    command: "Write-Host 'Assistant en lecture seule : aucune modification a defaire.'",
    warning: 'Le seul effet local est le fichier de rapport éventuel (JSON ou CSV) écrit dans le dossier courant. Il ne contient aucun secret, mais il contient des noms de ressources ou de comptes : supprime-le toi-même quand il ne sert plus.',
  };
}

/** Lignes PowerShell d'une aide Graph : lire une propriété d'un objet d'annuaire. */
export const LIGNES_PROP_GRAPH = [
  'function Get-KjemoPropGraph {',
  '  param($Objet, [string]$Nom)',
  '  $val = $null',
  '  if ($null -ne $Objet.AdditionalProperties -and $Objet.AdditionalProperties.ContainsKey($Nom)) { $val = $Objet.AdditionalProperties[$Nom] }',
  '  if ($null -eq $val) { $p = $Objet.PSObject.Properties[$Nom]; if ($null -ne $p) { $val = $p.Value } }',
  '  return [string]$val',
  '}',
];

/** Aides PowerShell sur les objets Az : état d'alimentation, texte localisé. */
export const LIGNES_AIDES_AZ = [
  'function Get-KjemoPowerState {',
  '  param($Statut)',
  "  $etat = ''",
  '  if ($null -ne $Statut.PowerState) { $etat = [string]$Statut.PowerState }',
  '  if (-not $etat -and $null -ne $Statut.Statuses) {',
  "    $c = @($Statut.Statuses | Where-Object { [string]$_.Code -like 'PowerState/*' })",
  "    if ($c.Count -gt 0) { $etat = 'VM ' + ([string]$c[0].Code).Substring(11) }",
  '  }',
  '  return $etat',
  '}',
  'function Get-KjemoTexteLocalise {',
  '  param($Valeur)',
  "  if ($null -eq $Valeur) { return '' }",
  '  if ($null -ne $Valeur.LocalizedValue -and [string]$Valeur.LocalizedValue) { return [string]$Valeur.LocalizedValue }',
  '  if ($null -ne $Valeur.Value -and [string]$Valeur.Value) { return [string]$Valeur.Value }',
  '  return [string]$Valeur',
  '}',
];

/** Lit le dernier segment d'un identifiant de ressource Azure. */
export const LIGNES_NOM_DEPUIS_ID = [
  'function Get-KjemoNomDepuisId {',
  '  param($Id)',
  "  if ($null -eq $Id) { return '' }",
  '  $texte = [string]$Id',
  "  if ($null -ne $Id.Id) { $texte = [string]$Id.Id }",
  "  if (-not $texte) { return '' }",
  "  return ($texte.TrimEnd('/') -split '/')[-1]",
  '}',
];

// ---------------------------------------------------------------------------
// La fabrique
// ---------------------------------------------------------------------------

function scopesDe(def, v) {
  if (typeof def.scopes === 'function') return def.scopes(v);
  return def.scopes ?? [];
}

function exigerChamps(def, liste) {
  for (const c of liste) {
    if (def[c] === undefined || def[c] === null) {
      throw new Error(`outilAzure(${def.id ?? '?'}) : champ « ${c} » manquant.`);
    }
  }
}

/**
 * Transforme une définition compacte en fiche complète, conforme au contrat
 * commun du catalogue, plus un bloc `cloud` propre à ce lot.
 *
 * def.portee : 'az' (tenant + abonnement, session Az) ou 'graph' (tenant,
 * session Microsoft Graph, permissions any-of).
 * def.action : true pour les trois assistants qui agissent.
 */
export function outilAzure(def) {
  exigerChamps(def, ['id', 'famille', 'title', 'summary', 'portee', 'corps', 'gui', 'keywords',
    'commandes', 'cloud', 'rollback', 'checks', 'verifyAfter', 'source', 'sources', 'prefixe']);
  if (!SOUS_RUBRIQUES_AZURE.includes(def.famille)) {
    throw new Error(`outilAzure(${def.id}) : famille inconnue « ${def.famille} ».`);
  }
  if (!['az', 'graph'].includes(def.portee)) {
    throw new Error(`outilAzure(${def.id}) : portée inconnue « ${def.portee} ».`);
  }
  for (const c of CHAMPS_CLOUD) {
    if (def.cloud[c] === undefined) throw new Error(`outilAzure(${def.id}) : cloud.${c} manquant.`);
  }
  const action = def.action === true;
  const risque = def.risk ?? (action ? 'caution' : 'diagnostic');
  const graph = def.portee === 'graph';

  const champsContexte = graph ? [champTenant()] : [champTenant(), champAbonnement()];
  const champsFin = action
    ? [champModeAzure(def.aideMode), champConfirmationAzure(def.phraseAide ?? 'la phrase affichée par l’assistant')]
    : [champFormatAzure()];
  if (action) champsFin.push(champFormatAzure());
  const fields = [...champsContexte, ...(def.champs ?? []), ...champsFin];

  const outil = {
    id: def.id,
    icon: '☁',
    category: CATEGORIE_AZURE,
    subcategory: def.famille,
    title: def.title,
    risk: risque,
    summary: def.summary,
    fields,
    validate(v) {
      const errors = {};
      const t = validerGuid(v.azTenant, 'Le tenant');
      if (!t.ok) errors.azTenant = t.error;
      if (!graph) {
        const a = validerGuid(v.azAbonnement, 'L’abonnement');
        if (!a.ok) errors.azAbonnement = a.error;
      }
      const f = validerChoixAzure(v.azFormat, FORMATS_AZURE, 'Le format');
      if (!f.ok) errors.azFormat = f.error;
      if (action) {
        const m = validerChoixAzure(v.azMode, ['Diagnostic', 'Appliquer'], 'Le mode');
        if (!m.ok) errors.azMode = m.error;
        const conf = String(v.azConfirmation ?? '');
        if (secretsDans(conf).length) {
          errors.azConfirmation = 'La confirmation ressemble à un secret : aucun secret n’est accepté.';
        } else if (v.azMode === 'Appliquer') {
          const attendue = def.phrase ? def.phrase(v) : null;
          if (attendue && conf !== attendue) {
            errors.azConfirmation = `Mode Appliquer : recopie exactement la phrase « ${attendue} » (majuscules comprises).`;
          }
        } else if (conf !== '' && def.phrase && conf !== def.phrase(v)) {
          errors.azConfirmation = 'La confirmation ne correspond pas à la cible : laisse le champ vide pour une prévisualisation.';
        }
      }
      if (def.verifier) def.verifier(v, errors);
      // Filet commun : AUCUN champ libre n'accepte un secret, même s'il est ignoré
      // par le mode choisi (ex. un groupe de ressources saisi mais non utilisé).
      for (const f of fields) {
        if (f.type === 'select' || f.type === 'number' || errors[f.id]) continue;
        if (secretsDans(v[f.id]).length) errors[f.id] = 'Ce champ semble contenir un secret (jeton, clé, mot de passe) : le Toolkit n’en accepte aucun.';
      }
      return errors;
    },
    generate(v) {
      assertValid(this, v);
      const lignesVariables = [
        '# --- Valeurs declarees dans le formulaire (jamais devinees) ---',
        `$KjemoTenantAttendu = ${psB64(String(v.azTenant).trim())}`,
      ];
      if (!graph) lignesVariables.push(`$KjemoAbonnementAttendu = ${psB64(String(v.azAbonnement).trim())}`);
      lignesVariables.push(`$KjemoFormat = ${psB64(v.azFormat)}`);
      if (action) {
        lignesVariables.push(`$KjemoMode = ${psB64(v.azMode)}`);
        lignesVariables.push(`$KjemoConfirmation = ${psB64(String(v.azConfirmation ?? ''))}`);
      }
      const pc = def.parametres ? def.parametres(v) : [];
      for (const [nom, expr] of pc) lignesVariables.push(`$KjemoArg${nom} = ${expr}`);

      const parametres = [['Tenant', '(Format-KjemoId $KjemoTenantAttendu)']];
      if (!graph) parametres.push(['Abonnement', '(Format-KjemoId $KjemoAbonnementAttendu)']);
      for (const [nom] of pc) parametres.push([nom, `$KjemoArg${nom}`]);
      if (action) parametres.push(['Mode', '$KjemoMode']);

      // Le contexte se lit avec Get-AzContext (Az) ou Get-MgContext (Graph) :
      // la commande est donc toujours exigée, même si la définition l'oublie.
      const cmdContexte = graph ? 'Get-MgContext' : 'Get-AzContext';
      const obligatoires = def.commandes.obligatoires.includes(cmdContexte)
        ? def.commandes.obligatoires
        : [cmdContexte, ...def.commandes.obligatoires];
      const oblig = obligatoires.map((c) => `'${c}'`).join(', ');
      const facul = (def.commandes.facultatives ?? []).map((c) => `'${c}'`).join(', ');
      const contexte = graph
        ? `Test-KjemoContexteGraph -TenantAttendu $KjemoTenantAttendu -ScopesAcceptes @(${scopesDe(def, v).map((s) => `'${s}'`).join(', ')})`
        : 'Test-KjemoContexteAzure -TenantAttendu $KjemoTenantAttendu -AbonnementAttendu $KjemoAbonnementAttendu';

      const corps = [
        '# --- Garde : prerequis, puis contexte. Le corps ne tourne que si les deux sont valides ---',
        '$KjemoPret = $false',
        `if (Test-KjemoCommandes -Obligatoires @(${oblig}) -Facultatives @(${facul})) {`,
        `  if (${contexte}) { $KjemoPret = $true }`,
        '}',
        'if (-not $KjemoPret) {',
        '  $script:KjemoContexteRefuse = $true',
        "  Write-Host ''",
        "  Write-Host 'REFUS : prerequis ou contexte non valides. Aucune lecture, aucune action.'",
        '} else {',
        def.corps(v).map((l) => (l === '' ? '' : `  ${l}`)).join('\n'),
        '}',
      ].join('\n');

      return [
        enteteScript({ titre: def.title.replace(/[\u2018\u2019]/g, "'"), outil: def.id, diagnostic: !action, admin: false, version: VERSION_AZURE }),
        '',
        fonctionsRapport(),
        '',
        fonctionsAzure(),
        '',
        lignesVariables.join('\n'),
        blocParametres(parametres),
        '',
        corps,
        blocExportAzure({ prefixeFichier: def.prefixe }),
      ].join('\n');
    },
    gui: def.gui,
    keywords: def.keywords,
    requiresAdmin: false,
    os: OS_AZURE,
    prereqs: PREREQS_AZURE.concat(def.prereqs ?? []),
    commonErrors: ERREURS_AZURE.concat(def.commonErrors ?? []),
    reversible: def.reversible ?? !action,
    verifyAfter: def.verifyAfter,
    rollback: def.rollback,
    checks: def.checks,
    source: def.source,
    sources: def.sources,
    // LOT 7 : plateforme et sortie, déclarées — le défaut Windows serait faux ici.
    platform: 'Multi',
    output: '.ps1',
    readOnly: !action,
    // LOT 8 : ce que la fiche dit en plus.
    cloud: { moteurs: MOTEURS_AZURE, validation: VALIDATION_AZURE, ...def.cloud },
    commandes: {
      obligatoires: def.commandes.obligatoires.includes(graph ? 'Get-MgContext' : 'Get-AzContext')
        ? def.commandes.obligatoires
        : [graph ? 'Get-MgContext' : 'Get-AzContext', ...def.commandes.obligatoires],
      facultatives: def.commandes.facultatives ?? [],
    },
    portee: def.portee,
    scopesGraph: typeof def.scopes === 'function' ? def.scopes({}) : (def.scopes ?? []),
  };
  if (action) {
    outil.confirmation = true;
  }
  return outil;
}

export { GUID_EXEMPLE_TENANT, GUID_EXEMPLE_ABONNEMENT };
