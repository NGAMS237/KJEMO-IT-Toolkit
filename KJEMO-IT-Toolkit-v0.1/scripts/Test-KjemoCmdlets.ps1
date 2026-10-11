#Requires -Version 5.1
<#
.SYNOPSIS
    Vérifie que les scripts générés n'appellent que des commandes déclarées.

.DESCRIPTION
    Un script qui appelle une applet de commande inexistante n'échoue pas
    quand on l'écrit : il échoue chez la personne, en production, le jour où
    elle en a besoin. Le LOT 4 en portait un exemple — un appel à
    « Get-GPOBackup », qui n'a jamais fait partie du module GroupPolicy.

    Ce banc lit la GRAMMAIRE de chaque script (AST PowerShell, pas une
    expression régulière), relève chaque commande appelée, et échoue si l'une
    d'elles n'est pas déclarée dans dist/cmdlets.mjs.

    Sont exclus de l'analyse, délibérément :
      - les fonctions définies dans le script lui-même ;
      - le contenu des blocs -Filter et -FilterScript, où « SamAccountName »
        est un nom de propriété, pas une commande.

    Avec -VerifierPresence, le banc interroge en plus Get-Command pour chaque
    commande déclarée dont le module est réellement disponible sur la machine.
    Une commande absente parce que son rôle n'est pas installé n'est PAS une
    erreur ; une commande absente alors que son module est chargé en est une.

.PARAMETER Dossier
    Dossier des scripts .ps1 à analyser. Défaut : test/generated.

.PARAMETER Inventaire
    Fichier JSON produit par test/cmdlets-export.mjs.

.PARAMETER VerifierPresence
    Interroge Get-Command pour les modules présents. Utile en CI Windows.

.EXAMPLE
    pwsh -File .\scripts\Test-KjemoCmdlets.ps1
    powershell.exe -File .\scripts\Test-KjemoCmdlets.ps1 -VerifierPresence
#>
[CmdletBinding()]
param(
  [string]$Dossier = 'test/generated',
  [string]$Inventaire = 'test/generated/cmdlets-autorisees.json',
  [switch]$VerifierPresence
)

$ErrorActionPreference = 'Stop'

$moteur = 'PowerShell 7'
if ($PSVersionTable.PSEdition -eq 'Desktop') { $moteur = 'Windows PowerShell' }
Write-Host ''
Write-Host "Moteur : $moteur $($PSVersionTable.PSVersion)"
Write-Host ''

if (-not (Test-Path -LiteralPath $Inventaire)) {
  Write-Host "[FAIL]  Inventaire introuvable : $Inventaire"
  Write-Host "        Lancer d'abord : node test/cmdlets-export.mjs"
  exit 1
}

$json = Get-Content -LiteralPath $Inventaire -Raw | ConvertFrom-Json

$autorisees = @{}
foreach ($p in $json.cmdlets.PSObject.Properties) { $autorisees[$p.Name] = $p.Value }
$binaires = @{}
foreach ($p in $json.binaires.PSObject.Properties) { $binaires[$p.Name] = $p.Value }
$interdites = @{}
foreach ($p in $json.interdites.PSObject.Properties) { $interdites[$p.Name] = $p.Value }

Write-Host "Inventaire : $($autorisees.Count) applets, $($binaires.Count) binaires, $($interdites.Count) bannies."

# ---------------------------------------------------------------------------
# Relevé des commandes d'un script, par la grammaire
# ---------------------------------------------------------------------------
function Get-KjemoCommandesAppelees {
  param([string]$Chemin)

  $erreurs = $null
  $jetons = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($Chemin, [ref]$jetons, [ref]$erreurs)
  if ($erreurs -and $erreurs.Count -gt 0) {
    throw "Analyse impossible : $($erreurs[0].Message)"
  }

  $toutes = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true)

  # Zones à ignorer : les blocs passés à -Filter / -FilterScript.
  $zones = New-Object System.Collections.ArrayList
  foreach ($cmd in $toutes) {
    for ($i = 0; $i -lt $cmd.CommandElements.Count; $i++) {
      $el = $cmd.CommandElements[$i]
      if ($el -is [System.Management.Automation.Language.CommandParameterAst] -and
          $el.ParameterName -match '^(Filter|FilterScript)$') {
        if ($i + 1 -lt $cmd.CommandElements.Count) {
          [void]$zones.Add($cmd.CommandElements[$i + 1].Extent)
        }
      }
    }
  }

  # Fonctions définies dans le script lui-même.
  $locales = @{}
  foreach ($fn in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
    $locales[$fn.Name] = $true
  }

  $vues = New-Object System.Collections.Generic.HashSet[string]
  foreach ($c in $toutes) {
    $nom = $c.GetCommandName()
    if (-not $nom) { continue }
    if ($locales.ContainsKey($nom)) { continue }
    $ignorer = $false
    foreach ($z in $zones) {
      if ($c.Extent.StartOffset -ge $z.StartOffset -and $c.Extent.EndOffset -le $z.EndOffset) { $ignorer = $true }
    }
    if ($ignorer) { continue }
    [void]$vues.Add($nom)
  }
  return $vues
}

# ---------------------------------------------------------------------------
# Analyse
# ---------------------------------------------------------------------------
$fichiers = @(Get-ChildItem -LiteralPath $Dossier -Filter *.ps1 -File | Sort-Object Name)
if ($fichiers.Count -eq 0) {
  Write-Host "[FAIL]  Aucun script dans $Dossier. Lancer d'abord : node test/generate-ps1.mjs"
  exit 1
}

$echecs = New-Object System.Collections.ArrayList
$toutesVues = New-Object System.Collections.Generic.HashSet[string]

foreach ($f in $fichiers) {
  $vues = Get-KjemoCommandesAppelees -Chemin $f.FullName
  foreach ($nom in $vues) {
    [void]$toutesVues.Add($nom)
    if ($interdites.ContainsKey($nom)) {
      [void]$echecs.Add("$($f.Name) : « $nom » est bannie — $($interdites[$nom])")
      continue
    }
    if (-not $autorisees.ContainsKey($nom) -and -not $binaires.ContainsKey($nom)) {
      [void]$echecs.Add("$($f.Name) : « $nom » n'est declaree nulle part dans dist/cmdlets.mjs.")
    }
  }
}

Write-Host "Scripts analyses : $($fichiers.Count)"
Write-Host "Commandes distinctes appelees : $($toutesVues.Count)"

# ---------------------------------------------------------------------------
# Contre-épreuve : un script fautif DOIT être détecté.
#
# Sans elle, un banc qui ne trouve jamais rien passerait pour un banc qui
# valide.
# ---------------------------------------------------------------------------
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("kjemo-cmdlets-" + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $tempDir)
$fautif = Join-Path $tempDir 'fautif.ps1'
@'
#Requires -Version 5.1
$copies = Get-GPOBackup -Path 'C:\Sauvegardes'
$inconnue = Get-KjemoCommandeQuiNExistePas -Argument 1
Write-Host $copies.Count $inconnue
'@ | Set-Content -LiteralPath $fautif -Encoding UTF8

$vuesFautif = Get-KjemoCommandesAppelees -Chemin $fautif
$detectBannie = $false
$detectInconnue = $false
foreach ($nom in $vuesFautif) {
  if ($interdites.ContainsKey($nom)) { $detectBannie = $true }
  if (-not $autorisees.ContainsKey($nom) -and -not $binaires.ContainsKey($nom) -and -not $interdites.ContainsKey($nom)) {
    $detectInconnue = $true
  }
}
Remove-Item -LiteralPath $fautif -Force
Remove-Item -LiteralPath $tempDir -Force

if ($detectBannie) {
  Write-Host "  [OK]    contre-epreuve : une commande bannie (Get-GPOBackup) est detectee"
} else {
  Write-Host "  [FAIL]  contre-epreuve : une commande bannie n'a PAS ete detectee"
  [void]$echecs.Add('contre-epreuve : le controle ne detecte pas une commande bannie')
}
if ($detectInconnue) {
  Write-Host "  [OK]    contre-epreuve : une commande inconnue est detectee"
} else {
  Write-Host "  [FAIL]  contre-epreuve : une commande inconnue n'a PAS ete detectee"
  [void]$echecs.Add('contre-epreuve : le controle ne detecte pas une commande inconnue')
}

# ---------------------------------------------------------------------------
# Présence réelle, quand le module est là
# ---------------------------------------------------------------------------
if ($VerifierPresence) {
  Write-Host ''
  Write-Host '--- Presence reelle des commandes declarees (Get-Command) ---'
  $modulesPresents = @{}
  foreach ($m in (Get-Module -ListAvailable | Select-Object -ExpandProperty Name -Unique)) {
    $modulesPresents[$m] = $true
  }
  $verifiees = 0
  $absentes = 0
  $sautees = 0
  foreach ($nom in ($autorisees.Keys | Sort-Object)) {
    $decl = $autorisees[$nom]
    if (-not $modulesPresents.ContainsKey($decl.module)) { $sautees++; continue }
    $trouvee = Get-Command -Name $nom -ErrorAction SilentlyContinue
    if ($trouvee) {
      $verifiees++
    } else {
      $absentes++
      [void]$echecs.Add("$nom : declaree dans le module $($decl.module), present sur cette machine, mais Get-Command ne la trouve pas.")
      Write-Host "  [FAIL]  $nom — module $($decl.module) present, commande introuvable"
    }
  }
  Write-Host "  Verifiees : $verifiees · Absentes : $absentes · Modules non installes (ignores) : $sautees"
  if ($verifiees -eq 0) {
    Write-Host '  [INFO]  Aucun module declare n''est installe sur cet agent : la verification de presence n''a rien prouve.'
  }
} else {
  Write-Host ''
  Write-Host 'Presence reelle NON VERIFIEE (relancer avec -VerifierPresence sur une machine Windows).'
}

# ---------------------------------------------------------------------------
Write-Host ''
if ($echecs.Count -eq 0) {
  Write-Host "Controle des commandes : OK, 0 echec."
  exit 0
}
Write-Host "Controle des commandes : $($echecs.Count) echec(s)."
foreach ($e in $echecs) { Write-Host "  $e" }
exit 1
