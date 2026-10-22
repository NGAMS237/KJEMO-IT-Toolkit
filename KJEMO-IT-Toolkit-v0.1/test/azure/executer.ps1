# executer.ps1 — LOT 8 · exécute UN script généré contre les DOUBLURES.
# Aucune connexion, aucun tenant réel, aucune ressource. Sortie : une ligne JSON
# entre deux marqueurs, lue par test/azure-assistants.test.mjs.
#   pwsh -NoProfile -File test/azure/executer.ps1 -Script X.ps1 -Scenario '{"Refus":["Get-AzVM"]}' -Dossier /tmp/x
param(
  [Parameter(Mandatory = $true)][string]$Script,
  [string]$Scenario = '{}',
  [string]$Dossier = ''
)
$ErrorActionPreference = 'Continue'
$Script = (Resolve-Path -LiteralPath $Script).Path
$base = $PSScriptRoot
. (Join-Path $base 'doublures-base.ps1')
. (Join-Path $base 'doublures-acces.ps1')
. (Join-Path $base 'doublures-vm-reseau.ps1')
. (Join-Path $base 'doublures-stockage.ps1')
. (Join-Path $base 'doublures-cout.ps1')
$global:KjemoScenario = @{}
# Compatible Windows PowerShell 5.1 ET PowerShell 7 (pas de -AsHashtable, absent de 5.1).
$brut = $Scenario | ConvertFrom-Json
foreach ($p in $brut.PSObject.Properties) {
  $val = $p.Value
  if ($val -is [System.Array]) { $val = @($val) }
  $global:KjemoScenario[$p.Name] = $val
}
if ($Dossier) { New-Item -ItemType Directory -Force -Path $Dossier | Out-Null; Set-Location $Dossier }
$global:LASTEXITCODE = 0
$sortie = ''
$erreurs = @()
try {
  $sortie = (& $Script *>&1 | Out-String)
} catch {
  $erreurs += [string]$_.Exception.Message
}
$fichiers = @()
if ($Dossier) { $fichiers = @(Get-ChildItem -LiteralPath $Dossier -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) }
$resume = [ordered]@{
  sortie = $sortie
  appels = @($global:KjemoAppels)
  mutations = @($global:KjemoMutations)
  actions = @($global:KjemoActions)
  erreurs = $erreurs
  codeSortie = $global:LASTEXITCODE
  fichiers = $fichiers
}
[Console]::Out.WriteLine('@@KJEMO-JSON@@' + ($resume | ConvertTo-Json -Depth 5 -Compress) + '@@FIN@@')
