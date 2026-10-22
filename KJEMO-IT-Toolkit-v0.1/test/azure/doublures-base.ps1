# doublures-base.ps1 — LOT 8 · KJEMO IT Toolkit
# ---------------------------------------------------------------------------
# DOUBLURES, PAS DE CLOUD. Ce fichier remplace les commandes Az et Microsoft
# Graph par de simples fonctions PowerShell. Il ne se connecte a rien, ne lit
# aucun jeton, n'appelle aucun reseau. Un script de l'application s'execute
# ensuite en "dot-source" apres ce fichier : les fonctions definies ici sont
# prioritaires sur n'importe quel module installe.
#
# Chaque double reproduit les PARAMETRES documentes de la vraie commande (nom,
# type, jeux de parametres) : un parametre inconnu ou une faute de frappe
# declenche donc la meme erreur qu'avec la vraie commande. Ce qui n'est pas
# reproduit : le comportement du service, les erreurs reelles de l'API, la
# pagination. Une doublure prouve que le script appelle les commandes avec les
# bons parametres et lit correctement la forme d'objet documentee ; elle ne
# prouve PAS que le service reel repond ainsi.
#
# Journal : $global:KjemoAppels (commandes appelees et parametres)
#           $global:KjemoMutations (appels a une commande qui modifie quoi que
#           ce soit — doit rester VIDE pour tout assistant en lecture seule).

$global:KjemoAppels = New-Object System.Collections.ArrayList
$global:KjemoMutations = New-Object System.Collections.ArrayList
if ($null -eq $global:KjemoScenario) { $global:KjemoScenario = @{} }

function Register-KjemoAppel {
  param([string]$Nom, $Parametres)
  $morceaux = @()
  foreach ($k in ($Parametres.Keys | Sort-Object)) { $morceaux += ('-' + $k + '=' + [string]$Parametres[$k]) }
  [void]$global:KjemoAppels.Add(($Nom + ' ' + ($morceaux -join ' ')).Trim())
}

# Lance l'erreur configuree pour cette commande, si le scenario le demande.
function Invoke-KjemoScenarioRefus {
  param([string]$Nom)
  $refus = @()
  if ($global:KjemoScenario.ContainsKey('Refus')) { $refus = @($global:KjemoScenario['Refus']) }
  if ($refus -contains $Nom) {
    if ($Nom -like '*-Mg*') { throw 'Insufficient privileges to complete the operation. Status: 403 (Forbidden)' }
    throw ("AuthorizationFailed : The client does not have authorization to perform action on scope (code: AuthorizationFailed) pour " + $Nom)
  }
  $absents = @()
  if ($global:KjemoScenario.ContainsKey('Introuvable')) { $absents = @($global:KjemoScenario['Introuvable']) }
  if ($absents -contains $Nom) { throw ("ResourceNotFound : the resource could not be found (" + $Nom + ")") }
}

function Get-KjemoScenarioValeur {
  param([string]$Cle, $Defaut)
  if ($global:KjemoScenario.ContainsKey($Cle)) { return $global:KjemoScenario[$Cle] }
  return $Defaut
}

# --- Tripwires : toute commande qui modifie, connecte ou change de contexte ---
$script:CommandesInterditesLecture = @(
  'Connect-AzAccount', 'Disconnect-AzAccount', 'Set-AzContext', 'Select-AzSubscription', 'Clear-AzContext',
  'Connect-MgGraph', 'Disconnect-MgGraph', 'Install-Module', 'Update-Module', 'Import-Module',
  'New-AzResourceGroup', 'Remove-AzResourceGroup', 'Remove-AzResource', 'Set-AzResource', 'New-AzRoleAssignment', 'Remove-AzRoleAssignment',
  'Remove-AzVM', 'Update-AzVM', 'Restart-AzVM', 'New-AzVM', 'Remove-AzDisk', 'Remove-AzNetworkInterface', 'Remove-AzPublicIpAddress',
  'Remove-AzNetworkSecurityGroup', 'Set-AzNetworkSecurityGroup', 'Add-AzNetworkSecurityRuleConfig', 'Remove-AzNetworkSecurityRuleConfig',
  'Remove-AzStorageAccount', 'Set-AzStorageAccount', 'New-AzStorageAccount', 'Get-AzStorageAccountKey', 'New-AzStorageAccountSASToken', 'New-AzStorageContainerSASToken', 'New-AzStorageBlobSASToken',
  'Remove-AzRecoveryServicesVault', 'Disable-AzRecoveryServicesBackupProtection', 'Backup-AzRecoveryServicesBackupItem',
  'New-MgUser', 'Update-MgUser', 'Remove-MgUser', 'New-MgGroup', 'Remove-MgGroup', 'New-MgGroupMember', 'New-MgApplication', 'Add-MgApplicationPassword', 'Update-MgUserAuthenticationMethod',
  'New-MgUserAuthenticationPhoneMethod', 'Remove-MgUserAuthenticationMethod',
  'New-AzConsumptionBudget', 'Remove-AzConsumptionBudget', 'Set-AzDiagnosticSetting', 'New-AzMetricAlertRuleV2', 'Remove-AzMetricAlertRuleV2'
)
foreach ($nomInterdit in $script:CommandesInterditesLecture) {
  $corps = [scriptblock]::Create('[void]$global:KjemoMutations.Add("' + $nomInterdit + '"); throw "TRIPWIRE: commande de modification appelee : ' + $nomInterdit + '"')
  Set-Item -Path ('function:global:' + $nomInterdit) -Value $corps
}
