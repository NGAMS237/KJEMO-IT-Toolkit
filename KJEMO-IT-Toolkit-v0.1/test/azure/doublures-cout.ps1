# doublures-cout.ps1 — LOT 8 · famille F (surveillance et couts). Doublures, pas de cloud.
# Les formes d'objets suivent la documentation ; non confrontees a un vrai tenant.
# Scenarios : SansAlerte, BudgetDepasse, SansBudget.

function Get-AzMetricAlertRuleV2 {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzMetricAlertRuleV2' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzMetricAlertRuleV2'
  if ([bool](Get-KjemoScenarioValeur 'SansAlerte' $false)) { return @() }
  return @(
    [pscustomobject]@{ Name = 'alerte-cpu'; Enabled = $true; Severity = 2; Actions = @([pscustomobject]@{ ActionGroupId = '/x/ag-lab' }) },
    [pscustomobject]@{ Name = 'alerte-disque'; Enabled = $false; Severity = 3; Actions = @() }
  )
}
function Get-AzActivityLogAlert {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzActivityLogAlert' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzActivityLogAlert'
  if ([bool](Get-KjemoScenarioValeur 'SansAlerte' $false)) { return @() }
  return @([pscustomobject]@{ Name = 'alerte-suppression'; Enabled = $true })
}
function Get-AzActionGroup {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzActionGroup' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzActionGroup'
  return @([pscustomobject]@{ Name = 'ag-lab'; EmailReceiver = @([pscustomobject]@{ Name = 'admin' }) })
}
function Get-AzSubscriptionDiagnosticSetting {
  [CmdletBinding()]
  param([Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzSubscriptionDiagnosticSetting' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzSubscriptionDiagnosticSetting'
  if ([bool](Get-KjemoScenarioValeur 'SansAlerte' $false)) { return @() }
  return @([pscustomobject]@{ Name = 'export-journal'; WorkspaceId = '/x/law-lab'; StorageAccountId = $null; EventHubAuthorizationRuleId = $null })
}
function Get-AzConsumptionBudget {
  [CmdletBinding()]
  param([Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzConsumptionBudget' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzConsumptionBudget'
  if ([bool](Get-KjemoScenarioValeur 'SansBudget' $false)) { return @() }
  $dep = $(if ([bool](Get-KjemoScenarioValeur 'BudgetDepasse' $false)) { 25 } else { 5 })
  return @([pscustomobject]@{ Name = 'budget-labo'; Amount = 20; TimeGrain = 'Monthly'; CurrentSpend = [pscustomobject]@{ Amount = $dep; Unit = 'USD' }; Notification = @{ 'Actual_GreaterThan_80_Percent' = 'x' } })
}
function Get-AzSnapshot {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$SnapshotName)
  Register-KjemoAppel 'Get-AzSnapshot' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzSnapshot'
  return @(
    [pscustomobject]@{ Name = 'snap-ancien'; DiskSizeGB = 128; TimeCreated = (Get-Date).AddDays(-200) },
    [pscustomobject]@{ Name = 'snap-recent'; DiskSizeGB = 128; TimeCreated = (Get-Date).AddDays(-3) }
  )
}
