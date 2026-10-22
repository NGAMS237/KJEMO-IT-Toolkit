/**
 * noyau-impression.mjs — LOT 9 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le socle commun des assistants Imprimantes WINDOWS : blocs PowerShell
 * partagés, export de rapport, et la fabrique qui transforme une définition
 * compacte en fiche complète. (Les quatre assistants CUPS sont en Bash et
 * vivent dans outils-impression-cups.mjs, sur le socle noyau-bash.mjs.)
 *
 * ---------------------------------------------------------------------------
 * CE QUE CE LOT GÉNÈRE, ET CE QU'IL NE FAIT PAS
 * ---------------------------------------------------------------------------
 * Le Toolkit est un site statique : il écrit un script que la personne lit,
 * puis lance dans SON terminal. Il n'imprime rien, ne contacte aucune
 * imprimante et ne télécharge aucun pilote.
 *
 * Règles du lot, toutes testées :
 *
 *   1. UN ÉTAT « NORMAL » OU UN PING N'EST PAS UNE PREUVE D'IMPRESSION.
 *      Windows déclare l'état d'une file ; il ne sait pas si une page sort. Le
 *      rapport le dit, et AUCUNE conclusion ne contient « réparé », « fonctionne »
 *      ou « imprime » sur la foi d'un code de retour.
 *
 *   2. UNE CIBLE EST EXACTE. Les noms sont comparés en entier, sans joker
 *      (Get-Printer -Name 'HP*' accepte les jokers : on énumère puis on filtre
 *      par égalité). Zéro correspondance ou plusieurs → refus, jamais « la
 *      première ».
 *
 *   3. LE MODE PAR DÉFAUT NE MODIFIE RIEN. Les assistants qui agissent ont un
 *      champ « Mode » (Diagnostic par défaut). Appliquer exige EN PLUS une
 *      phrase de confirmation exacte, qui nomme la cible, et le script
 *      re-vérifie la phrase lui-même.
 *
 *   4. LECTURE AVANT ACTION, RELECTURE APRÈS. Chaque action lit l'état avant,
 *      agit, puis relit l'état ; c'est la relecture, pas le code de retour, qui
 *      décide du verdict.
 *
 *   5. PAS DE SIMULATION INVENTÉE. -WhatIf n'est utilisé que sur les cmdlets
 *      qui le prennent réellement en charge (Add-PrinterPort, Remove-PrintJob,
 *      Restart-Service). Pour les autres, le mode Diagnostic décrit ce qui
 *      serait fait et ne lance RIEN.
 *
 *   6. AUCUN SUPPRESSION DE MASSE, AUCUN REMPLACEMENT SILENCIEUX. Un port ou une
 *      imprimante qui existe déjà est un refus, pas un écrasement. Aucun
 *      assistant ne supprime d'imprimante, de port, de pilote, ni ne vide le
 *      dossier de spool.
 *
 *   7. AUCUN SECRET, AUCUN TÉLÉCHARGEMENT. Pas de mot de passe dans un champ ni
 *      dans un script ; les pilotes doivent être DÉJÀ installés.
 *
 * Écriture : le PowerShell généré évite la syntaxe propre à PowerShell 7
 * (ternaire, « ?? », « && ») et ne contient que des caractères ASCII dans ses
 * chaînes, comme les lots précédents.
 */

import { psB64, assertValid } from './noyau.mjs';
import { enteteScript, fonctionsRapport, blocParametres } from './rapport-ps.mjs';
import { SOUS_RUBRIQUES_IMPRESSION } from './categories.mjs';
import { secretsDansImpression } from './validateurs-impression.mjs';

export const VERSION_IMPRESSION = 'LOT 9 — Imprimantes — 9.0.0';
export const CATEGORIE_IMPRESSION = 'Imprimantes';
export { SOUS_RUBRIQUES_IMPRESSION };

export const FORMATS_IMPRESSION = ['Console', 'JSON', 'CSV'];

export const OS_IMPRESSION_WIN = [
  'Windows 10, Windows 11, Windows Server 2019 ou plus — module PrintManagement (présent par défaut)',
  'Windows PowerShell 5.1 ou PowerShell 7.x sous Windows',
  'Ne s’exécute PAS sous Linux ni macOS : le module PrintManagement n’y existe pas (utilise les assistants CUPS).',
];

// ---------------------------------------------------------------------------
// Champs communs
// ---------------------------------------------------------------------------

export function champFormatImpression() {
  return {
    id: 'impFormat',
    label: 'Format du rapport',
    type: 'select',
    default: 'Console',
    options: FORMATS_IMPRESSION.map((f) => [f, f === 'Console' ? 'Console seulement' : `Console + fichier ${f}`]),
    help: 'Le fichier est écrit dans le dossier courant du terminal. Il contient des noms de files, d’hôtes et de comptes : supprime-le quand il ne sert plus.',
  };
}

export function champModeImpression(aide) {
  return {
    id: 'impMode',
    label: 'Mode d’exécution',
    type: 'select',
    default: 'Diagnostic',
    options: [
      ['Diagnostic', 'Diagnostic — lit et décrit ce qui serait fait, ne modifie rien'],
      ['Appliquer', 'Appliquer — exécute l’action, après confirmation exacte'],
    ],
    help: aide || 'Diagnostic ne modifie rien. Appliquer exige en plus la phrase de confirmation exacte.',
  };
}

export function champConfirmationImpression(phraseAide) {
  return {
    id: 'impConfirmation',
    label: 'Confirmation (vide = aucune action)',
    default: '', optionnel: true,
    help: `Pour agir, recopie exactement la phrase affichée sous le formulaire : ${phraseAide}`,
  };
}

// ---------------------------------------------------------------------------
// Blocs PowerShell communs
// ---------------------------------------------------------------------------

/**
 * Fonctions communes. Écrites pour Windows PowerShell 5.1 ET PowerShell 7 :
 * pas de ternaire, pas de « ?? ». Le test réseau n'utilise que .NET (TcpClient,
 * Dns, Ping) : il ne dépend ni de Test-NetConnection ni de Resolve-DnsName.
 */
export function fonctionsImpression() {
  return String.raw`# --- Aides communes Imprimantes (LOT 9) -----------------------------------------------
$script:KjemoInaccessibles = 0
$script:KjemoRefus = $false
$script:KjemoAgi = $false
$script:KjemoEcart = $false

# Masque ce qui ressemble a un secret avant que le texte n entre dans un rapport.
function Hide-KjemoSecrets {
  param([string]$Texte)
  if ([string]::IsNullOrEmpty($Texte)) { return '' }
  $t = $Texte
  $t = [regex]::Replace($t, '(?i)([a-z][a-z0-9+.-]*://)[^\s/@]*:[^\s/@]*@', '$1[MASQUE]@')
  $t = [regex]::Replace($t, '(?i)\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}', '$1 [MASQUE]')
  $t = [regex]::Replace($t, '(?i)(password|passwd|pwd|secret|token)\s*[=:]\s*\S+', '$1=[MASQUE]')
  return $t
}

# Verifie que les commandes necessaires existent REELLEMENT dans cette session.
# Une commande obligatoire absente arrete tout : c est aussi la garde "Windows
# seulement" - le module PrintManagement n existe pas ailleurs.
function Test-KjemoCommandes {
  param([string[]]$Obligatoires = @(), [string[]]$Facultatives = @())
  $ok = $true
  foreach ($nom in $Obligatoires) {
    $c = Get-Command -Name $nom -ErrorAction SilentlyContinue
    if ($null -eq $c) {
      [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle $nom -Etat 'PROBLEME' -Valeur 'commande absente' -Commentaire 'Ce script vise Windows avec le module PrintManagement (Get-Printer et ses voisines). Sous Linux ou macOS, utilise les assistants CUPS. Ce script n installe rien.')
      $ok = $false
    } else {
      [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle $nom -Etat 'OK' -Valeur 'disponible')
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

# Execute UNE lecture. Un echec n est jamais un OK : il est classe INACCESSIBLE,
# INTROUVABLE ou ERREUR, toujours en ATTENTION. Chaque lecture doit porter
# -ErrorAction Stop, sinon l erreur serait avalee et lue comme "rien a signaler".
# Rend $true si la lecture a abouti.
function Invoke-KjemoLecture {
  param(
    [Parameter(Mandatory=$true)][string]$Categorie,
    [Parameter(Mandatory=$true)][string]$Controle,
    [Parameter(Mandatory=$true)][scriptblock]$Action
  )
  try {
    $null = & $Action
    return $true
  } catch {
    $msg = Hide-KjemoSecrets ([string]$_.Exception.Message)
    if ($msg.Length -gt 240) { $msg = $msg.Substring(0, 240) + '...' }
    $classe = 'ERREUR'
    if ($msg -match '(?i)access is denied|acces refuse|UnauthorizedAccess|PermissionDenied|0x80070005|not authorized|insufficient|privilege') {
      $classe = 'INACCESSIBLE'
      $script:KjemoInaccessibles = $script:KjemoInaccessibles + 1
    } elseif ($msg -match '(?i)not found|introuvable|no matching|ObjectNotFound|0x80070709|0x80070426|cannot find') {
      $classe = 'INTROUVABLE'
    } elseif ($msg -match '(?i)RPC server|service.*(not|n est pas).*(running|demarre)|0x800706BA|0x80070422') {
      $classe = 'SERVICE'
      $script:KjemoInaccessibles = $script:KjemoInaccessibles + 1
    }
    [void](Add-KjemoResultat -Categorie $Categorie -Controle $Controle -Etat 'ATTENTION' -Valeur $classe -Commentaire ('Lecture non aboutie : ' + $msg + ' Ce controle ne prouve RIEN : ne pas le lire comme un etat normal.'))
    return $false
  }
}

# Elevation : vrai seulement si la console tourne en administrateur.
function Test-KjemoAdmin {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return $false }
}

function Get-KjemoCompte {
  try { return [string][Security.Principal.WindowsIdentity]::GetCurrent().Name } catch { return '(inconnu)' }
}

# Contexte d execution, a lire AVANT toute action : qui, eleve ou non.
function Add-KjemoContexte {
  $compte = Get-KjemoCompte
  $admin = Test-KjemoAdmin
  $txtAdmin = 'non'
  if ($admin) { $txtAdmin = 'oui' }
  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Compte' -Etat 'INFO' -Valeur $compte -Commentaire 'Les connexions et l imprimante par defaut sont PROPRES au compte qui lance le script.')
  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Console elevee' -Etat 'INFO' -Valeur $txtAdmin)
  return $admin
}

# Compare la phrase saisie a la phrase attendue : sensible a la casse, exacte.
function Test-KjemoPhrase {
  param([string]$Saisie, [string]$Attendue)
  if ([string]::IsNullOrEmpty($Attendue)) { return $false }
  return [string]::Equals($Saisie, $Attendue, [System.StringComparison]::Ordinal)
}

# Resout une imprimante par son nom ENTIER, sans joker : on enumere, puis on
# filtre par egalite. Get-Printer -Name accepte les jokers ; on ne s en sert pas.
# Etat rendu : TROUVEE, ABSENTE, AMBIGUE ou ILLISIBLE.
function Get-KjemoImprimanteExacte {
  param([string]$Nom)
  $tous = $null
  try { $tous = @(Get-Printer -ErrorAction Stop) } catch {
    return [pscustomobject]@{ Etat = 'ILLISIBLE'; Objet = $null; Nombre = 0; Message = (Hide-KjemoSecrets ([string]$_.Exception.Message)) }
  }
  $m = @($tous | Where-Object { [string]$_.Name -ieq $Nom })
  if ($m.Count -eq 1) { return [pscustomobject]@{ Etat = 'TROUVEE'; Objet = $m[0]; Nombre = 1; Message = '' } }
  if ($m.Count -eq 0) { return [pscustomobject]@{ Etat = 'ABSENTE'; Objet = $null; Nombre = 0; Message = '' } }
  return [pscustomobject]@{ Etat = 'AMBIGUE'; Objet = $null; Nombre = $m.Count; Message = '' }
}

# Ajoute le resultat "cible" et rend $true si la cible est UNIQUE et lue.
function Add-KjemoCibleImprimante {
  param($Resolution, [string]$Nom)
  if ($Resolution.Etat -eq 'TROUVEE') {
    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Imprimante' -Etat 'OK' -Valeur ([string]$Resolution.Objet.Name) -Commentaire 'Une seule imprimante porte exactement ce nom.')
    return $true
  }
  if ($Resolution.Etat -eq 'AMBIGUE') {
    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Imprimante' -Etat 'PROBLEME' -Valeur ([string]$Resolution.Nombre + ' correspondances') -Commentaire 'REFUS : plusieurs imprimantes portent ce nom. Aucune n est choisie a ta place.')
    return $false
  }
  if ($Resolution.Etat -eq 'ILLISIBLE') {
    $script:KjemoInaccessibles = $script:KjemoInaccessibles + 1
    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Imprimante' -Etat 'ATTENTION' -Valeur 'INACCESSIBLE' -Commentaire ('La liste des imprimantes n a pas pu etre lue : ' + $Resolution.Message + ' Rien ne peut etre conclu.'))
    return $false
  }
  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Imprimante' -Etat 'PROBLEME' -Valeur $Nom -Commentaire 'REFUS : aucune imprimante ne porte exactement ce nom. Copie-le depuis Get-Printer : les noms proches ne sont pas acceptes.')
  return $false
}

# --- Reseau, uniquement par .NET : TCP, DNS, ICMP -------------------------------------------
# Rend OUVERT, REFUSE, DELAI ou ERREUR.
function Test-KjemoTcp {
  param([string]$Hote, [int]$Port, [int]$DelaiMs = 3000)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $attente = $client.BeginConnect($Hote, $Port, $null, $null)
    $fini = $attente.AsyncWaitHandle.WaitOne($DelaiMs, $false)
    if (-not $fini) { return 'DELAI' }
    try { $client.EndConnect($attente) } catch { return 'REFUSE' }
    if ($client.Connected) { return 'OUVERT' }
    return 'REFUSE'
  } catch { return 'ERREUR' } finally { $client.Close() }
}

# DNS, ICMP, puis TCP sur le port du protocole choisi. Chaque etape est un
# resultat distinct : un ping qui passe et un port ferme, ce n est pas la meme panne.
function Test-KjemoReseau {
  param([string]$Hote, [int]$Port, [string]$Protocole)
  $ip = $null
  $estIp = [System.Net.IPAddress]::TryParse($Hote, [ref]$ip)
  $cible = $Hote
  if ($estIp) {
    [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Adresse' -Etat 'INFO' -Valeur $Hote -Commentaire 'Adresse IP donnee : aucune resolution DNS necessaire.')
  } else {
    try {
      $adr = @([System.Net.Dns]::GetHostAddresses($Hote) | ForEach-Object { [string]$_ })
      if ($adr.Count -eq 0) { throw 'aucune adresse' }
      $cible = $adr[0]
      [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Resolution DNS' -Etat 'OK' -Valeur ($adr -join ', ') -Commentaire 'Le nom se resout. Verifie que l adresse est bien celle de l imprimante.')
    } catch {
      [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Resolution DNS' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire 'Le nom ne se resout pas depuis cette machine. Les tests suivants sont ignores.')
      return 'DNS'
    }
  }
  try {
    $rep = (New-Object System.Net.NetworkInformation.Ping).Send($cible, 2000)
    if ($rep.Status -eq 'Success') {
      [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Ping (ICMP)' -Etat 'INFO' -Valeur 'reponse' -Commentaire 'Une reponse ICMP prouve que l hote est joignable, PAS que l impression marche.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Ping (ICMP)' -Etat 'INFO' -Valeur ([string]$rep.Status) -Commentaire 'Beaucoup de reseaux et d imprimantes filtrent l ICMP : l absence de reponse ne prouve pas que l hote est eteint. Le test TCP ci-dessous est plus parlant.')
    }
  } catch {
    [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Ping (ICMP)' -Etat 'INFO' -Valeur 'non realisable' -Commentaire 'Le ping n a pas pu etre emis depuis cette session.')
  }
  $etat = Test-KjemoTcp -Hote $cible -Port $Port
  $nomProto = $Protocole + ' / TCP ' + [string]$Port
  if ($etat -eq 'OUVERT') {
    [void](Add-KjemoResultat -Categorie 'Reseau' -Controle $nomProto -Etat 'OK' -Valeur 'port ouvert' -Commentaire 'Le port accepte la connexion. Cela ne prouve PAS qu une page sortira : seul un travail d impression reel le prouve.')
  } elseif ($etat -eq 'REFUSE') {
    [void](Add-KjemoResultat -Categorie 'Reseau' -Controle $nomProto -Etat 'PROBLEME' -Valeur 'connexion refusee' -Commentaire 'L hote repond mais rien n ecoute sur ce port : mauvais protocole ou port desactive sur l imprimante.')
  } elseif ($etat -eq 'DELAI') {
    [void](Add-KjemoResultat -Categorie 'Reseau' -Controle $nomProto -Etat 'PROBLEME' -Valeur 'delai depasse' -Commentaire 'Aucune reponse : imprimante eteinte, mauvaise adresse, pare-feu ou autre reseau.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Reseau' -Controle $nomProto -Etat 'ATTENTION' -Valeur 'erreur' -Commentaire 'Le test n a pas pu etre realise depuis cette session.')
  }
  return $etat
}

# Neutralise une cellule CSV qu un tableur lirait comme une formule.
function ConvertTo-KjemoCelluleSure {
  param([string]$Texte)
  if ([string]::IsNullOrEmpty($Texte)) { return '' }
  if ($Texte -match '^[=+\-@\t\r]') { return ("'" + $Texte) }
  return $Texte
}`;
}

/** Bloc d'export : console, JSON, CSV ; conclusion sans « réparé » ni « fonctionne ». */
export function blocExportImpression({ prefixeFichier, action = false, conclusionAgi = null }) {
  const agi = conclusionAgi
    ?? 'Action executee. L etat relu apres action est conforme a l attendu. Cela ne prouve PAS qu une page s imprimera : fais un essai d impression reel.';
  const brancheDiagnostic = action
    ? `} elseif ($KjemoMode -cne 'Appliquer') {
  $KjemoConclusion = 'MODE DIAGNOSTIC - aucune modification n a ete effectuee.'
  if ($KjemoAvertissements.Count -gt 0) { $KjemoConclusion = $KjemoConclusion + ' ' + [string]$KjemoAvertissements.Count + ' point(s) a examiner avant de passer en mode Appliquer.' }
`
    : '';
  return String.raw`
# ---------------------------------------------------------------------------
# Rapport - formats : Console, JSON, CSV. Aucun secret.
# ---------------------------------------------------------------------------
$KjemoFin = Get-Date
$KjemoConclusion = ''
if ($script:KjemoRefus) {
  $KjemoConclusion = 'REFUS : prerequis, cible ou garde non valides. Aucune modification n a ete effectuee et aucune conclusion ne peut etre tiree.'
} elseif ($script:KjemoEcart) {
  $KjemoConclusion = 'ECART : l etat relu ne confirme pas l effet attendu. Ne considere PAS l action comme reussie ; relis les avertissements.'
} elseif ($script:KjemoAgi) {
  $KjemoConclusion = '${agi}'
${brancheDiagnostic}} elseif ($script:KjemoInaccessibles -gt 0) {
  $KjemoConclusion = 'RESULTAT INCOMPLET : ' + [string]$script:KjemoInaccessibles + ' lecture(s) inaccessible(s) (droits, service ou acces distant). Ce qui n a pas pu etre lu n a pas ete verifie.'
} elseif ($KjemoAvertissements.Count -gt 0) {
  $KjemoConclusion = [string]$KjemoAvertissements.Count + ' point(s) a examiner - voir la section Avertissements.'
} else {
  $KjemoConclusion = 'Les lectures effectuees n ont signale aucun point. Cela ne couvre que ce qui a ete lu : un etat Normal ou un ping reussi ne prouvent pas qu une page s imprimera.'
}

$KjemoRapport = [pscustomobject]@{
  Outil          = $KjemoOutil
  Version        = $KjemoVersion
  Machine        = [Environment]::MachineName
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
// Bloc pédagogique « impression » : ce que la fiche dit en plus du contrat commun
// ---------------------------------------------------------------------------

export const CHAMPS_IMPRESSION_BLOC = ['probleme', 'exemple', 'premiere', 'lit', 'ecrit', 'effets', 'limites'];

export const VALIDATION_IMPRESSION_WIN = [
  'Syntaxe : le script est analysé par l’analyseur PowerShell 7 (exécuté). Windows PowerShell 5.1 : NON EXÉCUTÉ dans cette livraison — la vérification est prévue dans la CI Windows.',
  'Exécution avec doublures : des fonctions factices reproduisent les cmdlets PrintManagement (Get-Printer, Add-PrinterPort, Remove-PrintJob…) et enregistrent chaque appel. Aucune imprimante, aucun spouleur, aucun poste réel n’est touché.',
  'Essai sur une vraie imprimante ou un vrai spouleur : NON EXÉCUTÉ. Les doublures ne remplacent pas un essai matériel.',
];

export const VALIDATION_IMPRESSION_CUPS = [
  'Syntaxe : le script est analysé par « bash -n » et par ShellCheck (exécutés).',
  'Exécution avec doublures : des exécutables factices (lpstat, cancel, cupsenable, cupsaccept, systemctl) enregistrent chaque appel. Aucun CUPS réel, aucune file réelle n’est touché.',
  'Essai sur un vrai CUPS ou une vraie imprimante : NON EXÉCUTÉ.',
];

export const ERREURS_IMPRESSION_WIN = [
  {
    message: 'Commande absente : Get-Printer n’est pas reconnue',
    cause: 'Le script est lancé hors de Windows, ou le module PrintManagement est absent (Windows Server Core sans la fonctionnalité, ou console non Windows).',
    fix: 'Lance le script dans une console PowerShell sous Windows 10/11 ou Windows Server. Sous Linux, utilise les assistants CUPS. Le script n’installe rien.',
    command: 'Get-Module -ListAvailable PrintManagement',
  },
  {
    message: 'REFUS : aucune imprimante ne porte exactement ce nom',
    cause: 'Le nom saisi diffère du nom réel (casse ignorée, mais pas les fautes, les espaces ni les suffixes « (Copie 1) »).',
    fix: 'Copie le nom exact depuis la liste des imprimantes, puis régénère le script.',
    command: 'Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus',
  },
  {
    message: 'INACCESSIBLE (Access is denied, 0x80070005)',
    cause: 'La console n’est pas élevée, ou le compte n’a pas le droit de gérer cette file ou ce serveur.',
    fix: 'Le rapport est alors INCOMPLET et le dit. Relance en administrateur si l’action le demande, ou demande le droit « Gérer les imprimantes » sur la file.',
  },
];

export const PREREQS_IMPRESSION_WIN = [
  'Une console PowerShell sous Windows (le module PrintManagement doit être présent). Les assistants de configuration et de déblocage demandent en plus une console élevée ; les assistants de lecture n’en ont pas besoin.',
  'Le nom EXACT de l’imprimante, tel que « Get-Printer » l’affiche. Aucun joker n’est accepté.',
  'Pour une imprimante réseau : l’adresse, le protocole réellement utilisé, et un pilote DÉJÀ installé. Aucun assistant ne télécharge ni n’installe de pilote.',
];

/** Annulation d'un assistant en lecture seule. */
export function rollbackLectureImpression() {
  return {
    summary: 'Assistant en lecture seule : il ne crée, ne modifie et ne supprime ni imprimante, ni port, ni pilote, ni travail. Il n’y a rien à annuler.',
    diagnostic: 'Get-Printer | Select-Object Name, PrinterStatus, PortName',
    command: "Write-Host 'Assistant en lecture seule : aucune modification a defaire.'",
    warning: 'Le seul effet local est le fichier de rapport éventuel (JSON ou CSV) écrit dans le dossier courant. Il contient des noms de files, d’hôtes et de comptes : supprime-le toi-même quand il ne sert plus.',
  };
}

export const CHECKS_LECTURE_IMPRESSION = [
  'Aucune commande modifiante n’est appelée : ni Add-, ni Set-, ni Remove-, ni Restart-, ni Invoke-CimMethod. Seules des lectures le sont.',
  'La cible est comparée par égalité de nom, sans joker : zéro ou plusieurs correspondances sont un refus, jamais « la première ».',
  'Une lecture refusée, introuvable ou en erreur est classée ATTENTION et jamais OK ; le rapport devient INCOMPLET au lieu de conclure.',
  'Un état « Normal » ou une réponse au ping ne sont jamais présentés comme la preuve qu’une page s’imprimera.',
  'Aucun secret n’est demandé, lu ni écrit ; les messages d’erreur sont filtrés avant d’entrer dans le rapport.',
];

// ---------------------------------------------------------------------------
// La fabrique
// ---------------------------------------------------------------------------

function exigerChamps(def, liste) {
  for (const c of liste) {
    if (def[c] === undefined || def[c] === null) {
      throw new Error(`outilImpression(${def.id ?? '?'}) : champ « ${c} » manquant.`);
    }
  }
}

/**
 * Transforme une définition compacte en fiche complète conforme au contrat
 * commun du catalogue, plus un bloc `impression` propre à ce lot.
 *
 * def.action : true pour les assistants qui peuvent MODIFIER quelque chose.
 * def.phrase(v) : la phrase de confirmation exacte (obligatoire si action).
 * def.corps(v) : lignes PowerShell du corps (exécutées si les prérequis sont là).
 */
export function outilImpression(def) {
  exigerChamps(def, ['id', 'famille', 'title', 'summary', 'corps', 'gui', 'keywords', 'commandes',
    'impression', 'rollback', 'checks', 'verifyAfter', 'source', 'sources', 'prefixe', 'champs']);
  if (!SOUS_RUBRIQUES_IMPRESSION.includes(def.famille)) {
    throw new Error(`outilImpression(${def.id}) : famille inconnue « ${def.famille} ».`);
  }
  for (const c of CHAMPS_IMPRESSION_BLOC) {
    if (def.impression[c] === undefined) throw new Error(`outilImpression(${def.id}) : impression.${c} manquant.`);
  }
  const action = def.action === true;
  if (action && typeof def.phrase !== 'function') throw new Error(`outilImpression(${def.id}) : phrase() manquante pour une action.`);
  const admin = def.admin === true;
  const risque = def.risk ?? (action ? 'caution' : 'diagnostic');

  const champsFin = action
    ? [champModeImpression(def.aideMode), champConfirmationImpression(def.phraseAide ?? 'la phrase affichée par l’assistant'), champFormatImpression()]
    : [champFormatImpression()];
  const fields = [...def.champs, ...champsFin];

  const outil = {
    id: def.id,
    icon: '▩',
    category: CATEGORIE_IMPRESSION,
    subcategory: def.famille,
    title: def.title,
    risk: risque,
    summary: def.summary,
    fields,
    validate(v) {
      const errors = {};
      if (def.verifier) def.verifier(v, errors);
      const f = FORMATS_IMPRESSION.includes(String(v.impFormat ?? '')) ? null : `Le format doit être l’un de : ${FORMATS_IMPRESSION.join(', ')}.`;
      if (f) errors.impFormat = f;
      if (action) {
        if (!['Diagnostic', 'Appliquer'].includes(String(v.impMode ?? ''))) {
          errors.impMode = 'Le mode doit être « Diagnostic » ou « Appliquer ».';
        }
        const conf = String(v.impConfirmation ?? '');
        if (secretsDansImpression(conf).length) {
          errors.impConfirmation = 'La confirmation ressemble à un secret : aucun secret n’est accepté.';
        } else if (v.impMode === 'Appliquer') {
          const attendue = errors.__cible ? null : safe(() => def.phrase(v));
          if (attendue && conf !== attendue) {
            errors.impConfirmation = `Mode Appliquer : recopie exactement la phrase « ${attendue} » (majuscules comprises).`;
          }
        } else if (conf !== '') {
          const attendue = safe(() => def.phrase(v));
          if (attendue && conf !== attendue) {
            errors.impConfirmation = 'La confirmation ne correspond pas à la cible : laisse le champ vide pour un simple diagnostic.';
          }
        }
      }
      delete errors.__cible;
      // Filet commun : aucun champ libre n'accepte un secret, même ignoré par le mode.
      for (const champ of fields) {
        if (champ.type === 'select' || champ.type === 'number' || errors[champ.id]) continue;
        if (secretsDansImpression(v[champ.id]).length) errors[champ.id] = 'Ce champ semble contenir un secret (jeton, mot de passe) : le Toolkit n’en accepte aucun.';
      }
      return errors;
    },
    generate(v) {
      assertValid(this, v);
      const variables = [
        '# --- Valeurs declarees dans le formulaire (jamais devinees) ---',
        `$KjemoFormat = ${psB64(v.impFormat)}`,
      ];
      if (action) {
        variables.push(`$KjemoMode = ${psB64(v.impMode)}`);
        variables.push(`$KjemoConfirmation = ${psB64(String(v.impConfirmation ?? ''))}`);
        variables.push(`$KjemoPhrase = ${psB64(def.phrase(v))}`);
      }
      const pc = def.parametres ? def.parametres(v) : [];
      for (const [nom, expr] of pc) variables.push(`$KjemoArg${nom} = ${expr}`);

      const parametres = [];
      for (const [nom] of pc) parametres.push([nom, `$KjemoArg${nom}`]);
      if (action) parametres.push(['Mode', '$KjemoMode']);
      parametres.push(['Format', '$KjemoFormat']);

      const oblig = def.commandes.obligatoires.map((c) => `'${c}'`).join(', ');
      const facul = (def.commandes.facultatives ?? []).map((c) => `'${c}'`).join(', ');

      const prelude = [
        '$KjemoAdmin = Add-KjemoContexte',
      ];
      if (action) {
        prelude.push(
          '$KjemoConfirmeOk = Test-KjemoPhrase -Saisie $KjemoConfirmation -Attendue $KjemoPhrase',
          "$KjemoAgirDemande = (($KjemoMode -ceq 'Appliquer') -and $KjemoConfirmeOk)",
          "if ($KjemoMode -ceq 'Appliquer') {",
          '  if ($KjemoConfirmeOk) {',
          "    [void](Add-KjemoResultat -Categorie 'Confirmation' -Controle 'Phrase exacte' -Etat 'OK' -Valeur 'fournie' -Commentaire 'Action autorisee par la phrase exacte.')",
          '  } else {',
          "    [void](Add-KjemoResultat -Categorie 'Confirmation' -Controle 'Phrase exacte' -Etat 'PROBLEME' -Valeur 'absente ou inexacte' -Commentaire 'Mode Appliquer sans la phrase exacte : aucune action. Le script se limite au diagnostic.')",
          '  }',
          '} else {',
          "  [void](Add-KjemoResultat -Categorie 'Confirmation' -Controle 'Mode' -Etat 'INFO' -Valeur 'Diagnostic' -Commentaire 'MODE DIAGNOSTIC : le script lit et decrit ce qui serait fait. Rien n est modifie.')",
          '}',
        );
      }

      const corps = [
        '# --- Garde : prerequis. Le corps ne tourne que si les commandes necessaires existent ---',
        `$KjemoPret = Test-KjemoCommandes -Obligatoires @(${oblig}) -Facultatives @(${facul})`,
        'if (-not $KjemoPret) {',
        '  $script:KjemoRefus = $true',
        "  Write-Host ''",
        "  Write-Host 'REFUS : prerequis non valides. Aucune lecture, aucune action.'",
        '} else {',
        prelude.map((l) => `  ${l}`).join('\n'),
        '',
        def.corps(v).map((l) => (l === '' ? '' : `  ${l}`)).join('\n'),
        '}',
      ].join('\n');

      return [
        enteteScript({ titre: def.title.replace(/[‘’]/g, "'"), outil: def.id, diagnostic: !action, admin, version: VERSION_IMPRESSION }),
        '',
        fonctionsRapport(),
        '',
        fonctionsImpression(),
        '',
        variables.join('\n'),
        blocParametres(parametres),
        '',
        corps,
        blocExportImpression({ prefixeFichier: def.prefixe, action, conclusionAgi: def.conclusionAgi ?? null }),
      ].join('\n');
    },
    gui: def.gui,
    keywords: def.keywords,
    requiresAdmin: admin,
    os: OS_IMPRESSION_WIN,
    prereqs: PREREQS_IMPRESSION_WIN.concat(def.prereqs ?? []),
    commonErrors: ERREURS_IMPRESSION_WIN.concat(def.commonErrors ?? []),
    reversible: def.reversible ?? !action,
    verifyAfter: def.verifyAfter,
    rollback: def.rollback,
    checks: def.checks,
    source: def.source,
    sources: def.sources,
    platform: 'Windows',
    output: '.ps1',
    readOnly: !action,
    impression: { validation: VALIDATION_IMPRESSION_WIN, ...def.impression },
    commandes: {
      obligatoires: def.commandes.obligatoires,
      facultatives: def.commandes.facultatives ?? [],
    },
  };
  if (action) outil.confirmation = true;
  return outil;
}

function safe(fn) {
  try { return fn(); } catch { return null; }
}
