# doublures-stockage.ps1 — LOT 8 · famille E (stockage, sauvegarde, restauration).
# Doublures, pas de cloud : voir doublures-base.ps1. Les formes d'objets suivent
# la documentation Microsoft ; elles n'ont PAS ete confrontees a un vrai tenant.
# Scenarios : StockageOuvert, StockageSansPropriete, SansCoffre, SauvegardeAncienne, SansPointRecup.

function Get-AzStorageAccount {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzStorageAccount' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzStorageAccount'
  $ouvert = [bool](Get-KjemoScenarioValeur 'StockageOuvert' $false)
  $mk = {
    param($n, $rg, $pub, $https, $tls, $defaut)
    $o = [ordered]@{
      StorageAccountName = $n; ResourceGroupName = $rg; Location = $(if ($n -eq 'stlabest01') { 'canadaeast' } else { 'canadacentral' }); Kind = 'StorageV2'
      Sku = [pscustomobject]@{ Name = 'Standard_LRS' }
      EnableHttpsTrafficOnly = $https; MinimumTlsVersion = $tls
      NetworkRuleSet = [pscustomobject]@{ DefaultAction = $defaut; IpRules = @(); VirtualNetworkRules = @() }
      AllowSharedKeyAccess = $true
      Id = ('/subscriptions/aaaaaaaa-1111-2222-3333-444444444444/resourceGroups/' + $rg + '/providers/Microsoft.Storage/storageAccounts/' + $n)
    }
    if (-not [bool](Get-KjemoScenarioValeur 'StockageSansPropriete' $false)) { $o['AllowBlobPublicAccess'] = $pub }
    [pscustomobject]$o
  }
  $tous = @((& $mk 'stlabdemo001' 'rg-lab' $ouvert $true 'TLS1_2' $(if ($ouvert) { 'Allow' } else { 'Deny' })), (& $mk 'stlabtransit01' 'rg-lab-restore' $false $true 'TLS1_2' 'Deny'), (& $mk 'stprodfichiers' 'rg-prod' $false $true 'TLS1_0' 'Allow'), (& $mk 'stlabest01' 'rg-lab-restore' $false $true 'TLS1_2' 'Deny'))
  if ($ResourceGroupName) { $tous = @($tous | Where-Object { $_.ResourceGroupName -eq $ResourceGroupName }) }
  if ($Name) {
    $un = @($tous | Where-Object { $_.StorageAccountName -eq $Name })
    if ($un.Count -eq 0) { throw ("ResourceNotFound : The Resource 'Microsoft.Storage/storageAccounts/" + $Name + "' was not found.") }
    return $un[0]
  }
  return $tous
}

function Get-AzRmStorageContainer {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$ResourceGroupName, [Parameter(Mandatory = $true)][string]$StorageAccountName)
  Register-KjemoAppel 'Get-AzRmStorageContainer' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzRmStorageContainer'
  $niv = $(if ([bool](Get-KjemoScenarioValeur 'StockageOuvert' $false)) { 'Blob' } else { 'None' })
  return @([pscustomobject]@{ Name = 'documents'; PublicAccess = $niv }, [pscustomobject]@{ Name = 'archives'; PublicAccess = 'None' })
}

function Get-AzStorageBlobServiceProperty {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$ResourceGroupName, [Parameter(Mandatory = $true)][string]$StorageAccountName)
  Register-KjemoAppel 'Get-AzStorageBlobServiceProperty' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzStorageBlobServiceProperty'
  return [pscustomobject]@{
    DeleteRetentionPolicy = [pscustomobject]@{ Enabled = $true; Days = 7 }
    ContainerDeleteRetentionPolicy = [pscustomobject]@{ Enabled = $false; Days = 0 }
    IsVersioningEnabled = $false
  }
}

function Get-AzRecoveryServicesVault {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzRecoveryServicesVault' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzRecoveryServicesVault'
  if ([bool](Get-KjemoScenarioValeur 'SansCoffre' $false)) { return @() }
  $tous = @([pscustomobject]@{ Name = 'rsv-lab'; ResourceGroupName = 'rg-lab'; Location = 'canadacentral'; ID = '/subscriptions/aaaaaaaa-1111-2222-3333-444444444444/resourceGroups/rg-lab/providers/Microsoft.RecoveryServices/vaults/rsv-lab' })
  if ($ResourceGroupName) { $tous = @($tous | Where-Object { $_.ResourceGroupName -eq $ResourceGroupName }) }
  if ($Name) {
    $un = @($tous | Where-Object { $_.Name -eq $Name })
    if ($un.Count -eq 0) { throw ("ResourceNotFound : the vault '" + $Name + "' was not found") }
    return $un[0]
  }
  return $tous
}

function Get-AzRecoveryServicesBackupContainer {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$ContainerType, [Parameter()][string]$Status, [Parameter()][string]$FriendlyName, [Parameter(Mandatory = $true)][string]$VaultId)
  Register-KjemoAppel 'Get-AzRecoveryServicesBackupContainer' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzRecoveryServicesBackupContainer'
  if ($FriendlyName -ne 'vm-lab-01') { return @() }
  return @([pscustomobject]@{ FriendlyName = 'vm-lab-01'; ResourceGroupName = 'rg-lab'; ContainerType = 'AzureVM' })
}

function Get-AzRecoveryServicesBackupItem {
  [CmdletBinding()]
  param([Parameter()][string]$BackupManagementType, [Parameter()][string]$WorkloadType, [Parameter()]$Container, [Parameter(Mandatory = $true)][string]$VaultId)
  Register-KjemoAppel 'Get-AzRecoveryServicesBackupItem' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzRecoveryServicesBackupItem'
  $date = (Get-Date).AddHours(-10)
  if ([bool](Get-KjemoScenarioValeur 'SauvegardeAncienne' $false)) { $date = (Get-Date).AddDays(-20) }
  return @([pscustomobject]@{
    Name = 'iaasvmcontainerv2;rg-lab;vm-lab-01'; VirtualMachineId = '/subscriptions/aaaaaaaa-1111-2222-3333-444444444444/resourceGroups/rg-lab/providers/Microsoft.Compute/virtualMachines/vm-lab-01'
    LastBackupStatus = 'Completed'; LastBackupTime = $date; ProtectionState = 'IRPending'; ProtectionPolicyName = 'DefaultPolicy'
  })
}

function Get-AzRecoveryServicesBackupRecoveryPoint {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)]$Item, [Parameter()][datetime]$StartDate, [Parameter()][datetime]$EndDate, [Parameter(Mandatory = $true)][string]$VaultId)
  Register-KjemoAppel 'Get-AzRecoveryServicesBackupRecoveryPoint' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzRecoveryServicesBackupRecoveryPoint'
  if ([bool](Get-KjemoScenarioValeur 'SansPointRecup' $false)) { return @() }
  return @([pscustomobject]@{ RecoveryPointTime = (Get-Date).AddHours(-10); RecoveryPointType = 'AppConsistent'; Id = 'rp-1' }, [pscustomobject]@{ RecoveryPointTime = (Get-Date).AddDays(-2); RecoveryPointType = 'CrashConsistent'; Id = 'rp-0' })
}

function Restore-AzRecoveryServicesBackupItem {
  [CmdletBinding(SupportsShouldProcess = $true)]
  param([Parameter(Mandatory = $true)][string]$VaultId, [Parameter(Mandatory = $true)][string]$VaultLocation, [Parameter(Mandatory = $true)]$RecoveryPoint,
        [Parameter(Mandatory = $true)][string]$StorageAccountName, [Parameter(Mandatory = $true)][string]$StorageAccountResourceGroupName, [Parameter()][string]$TargetResourceGroupName)
  Register-KjemoAppel 'Restore-AzRecoveryServicesBackupItem' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Restore-AzRecoveryServicesBackupItem'
  if ($PSCmdlet.ShouldProcess($StorageAccountName, 'Restore')) {
    [void]$global:KjemoActions.Add(('Restore-AzRecoveryServicesBackupItem vers ' + $TargetResourceGroupName))
    return [pscustomobject]@{ JobId = 'job-0001'; Status = 'InProgress'; Operation = 'Restore' }
  }
}
