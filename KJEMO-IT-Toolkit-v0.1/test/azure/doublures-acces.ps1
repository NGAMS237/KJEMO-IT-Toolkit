# doublures-acces.ps1 — LOT 8 · familles A et B (contexte, RBAC, Entra ID).
# Voir doublures-base.ps1 pour ce qu'une doublure prouve, et ne prouve pas.
# Les formes d'objets reproduisent la documentation Microsoft ; elles n'ont PAS
# ete confrontees a un vrai tenant.

function Get-AzContext {
  [CmdletBinding()]
  param([Parameter()][switch]$ListAvailable, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzContext' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzContext'
  if (Get-KjemoScenarioValeur 'SansSessionAz' $false) { return $null }
  $ctx = [pscustomobject]@{
    Name = 'Lab (22222222-aaaa-bbbb-cccc-000000000001)'
    Account = [pscustomobject]@{ Id = 'etudiant@lab.example.com'; Type = 'User' }
    Environment = [pscustomobject]@{ Name = 'AzureCloud' }
    Subscription = [pscustomobject]@{ Id = (Get-KjemoScenarioValeur 'AbonnementAz' 'aaaaaaaa-1111-2222-3333-444444444444'); Name = 'Abonnement Laboratoire'; State = 'Enabled' }
    Tenant = [pscustomobject]@{ Id = (Get-KjemoScenarioValeur 'TenantAz' 'bbbbbbbb-1111-2222-3333-444444444444') }
  }
  if ($ListAvailable) { return @($ctx, $ctx) }
  return $ctx
}

function Get-AzSubscription {
  [CmdletBinding()]
  param([Parameter()][string]$TenantId, [Parameter()][string]$SubscriptionId, [Parameter()][string]$SubscriptionName)
  Register-KjemoAppel 'Get-AzSubscription' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzSubscription'
  return @(
    [pscustomobject]@{ Name = 'Abonnement Laboratoire'; Id = (Get-KjemoScenarioValeur 'AbonnementAz' 'aaaaaaaa-1111-2222-3333-444444444444'); State = 'Enabled'; TenantId = $TenantId },
    [pscustomobject]@{ Name = 'Ancien abonnement'; Id = 'cccccccc-1111-2222-3333-444444444444'; State = 'Disabled'; TenantId = $TenantId }
  )
}

function Get-AzResourceGroup {
  [CmdletBinding()]
  param([Parameter()][string]$Name, [Parameter()][string]$Location, [Parameter()][hashtable]$Tag)
  Register-KjemoAppel 'Get-AzResourceGroup' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzResourceGroup'
  $tous = @(
    [pscustomobject]@{ ResourceGroupName = 'rg-lab'; Location = 'canadacentral'; Tags = @{ proprietaire = 'ASR' } },
    [pscustomobject]@{ ResourceGroupName = 'rg-lab-restore'; Location = 'canadacentral'; Tags = $null },
    [pscustomobject]@{ ResourceGroupName = 'rg-vide'; Location = 'canadaeast'; Tags = $null },
    [pscustomobject]@{ ResourceGroupName = 'rg-prod'; Location = 'canadacentral'; Tags = @{ env = 'prod' } }
  )
  if ($Name) {
    $un = @($tous | Where-Object { $_.ResourceGroupName -eq $Name })
    if ($un.Count -eq 0) { throw ("ResourceGroupNotFound : Provided resource group does not exist: " + $Name) }
    return $un[0]
  }
  return $tous
}

function Get-AzResource {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name, [Parameter()][string]$ResourceType, [Parameter()][string]$ResourceId, [Parameter()][hashtable]$Tag)
  Register-KjemoAppel 'Get-AzResource' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzResource'
  if ($ResourceGroupName -eq 'rg-vide') { return @() }
  return @(
    [pscustomobject]@{ Name = 'vm-lab-01'; ResourceType = 'Microsoft.Compute/virtualMachines'; ResourceGroupName = $ResourceGroupName; Location = 'canadacentral' },
    [pscustomobject]@{ Name = 'vnet-lab'; ResourceType = 'Microsoft.Network/virtualNetworks'; ResourceGroupName = $ResourceGroupName; Location = 'canadacentral' }
  )
}

function Get-AzRoleAssignment {
  [CmdletBinding()]
  param([Parameter()][string]$Scope, [Parameter()][string]$SignInName, [Parameter()][string]$ObjectId, [Parameter()][string]$RoleDefinitionName, [Parameter()][string]$ResourceGroupName, [Parameter()][switch]$ExpandPrincipalGroups)
  Register-KjemoAppel 'Get-AzRoleAssignment' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzRoleAssignment'
  if (Get-KjemoScenarioValeur 'RbacVide' $false) { return @() }
  $sub = '/subscriptions/' + (Get-KjemoScenarioValeur 'AbonnementAz' 'aaaaaaaa-1111-2222-3333-444444444444')
  return @(
    [pscustomobject]@{ DisplayName = 'Etudiant ASR'; ObjectType = 'User'; RoleDefinitionName = 'Reader'; Scope = $sub; SignInName = 'etudiant@lab.example.com'; ObjectId = 'dddddddd-1111-2222-3333-444444444444' },
    [pscustomobject]@{ DisplayName = 'Admin Lab'; ObjectType = 'User'; RoleDefinitionName = 'Owner'; Scope = $sub; SignInName = 'admin@lab.example.com'; ObjectId = 'eeeeeeee-1111-2222-3333-444444444444' },
    [pscustomobject]@{ DisplayName = 'Groupe Lab'; ObjectType = 'Group'; RoleDefinitionName = 'Contributor'; Scope = ($sub + '/resourceGroups/rg-lab'); ObjectId = 'ffffffff-1111-2222-3333-444444444444' }
  )
}

function Get-MgContext {
  [CmdletBinding()]
  param()
  Register-KjemoAppel 'Get-MgContext' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgContext'
  if (Get-KjemoScenarioValeur 'SansSessionGraph' $false) { return $null }
  return [pscustomobject]@{
    TenantId = (Get-KjemoScenarioValeur 'TenantGraph' 'bbbbbbbb-1111-2222-3333-444444444444')
    AuthType = (Get-KjemoScenarioValeur 'AuthGraph' 'Delegated')
    Account = 'etudiant@lab.example.com'
    Scopes = @(Get-KjemoScenarioValeur 'ScopesGraph' @('User.Read.All', 'Group.Read.All', 'RoleManagement.Read.Directory', 'AuditLog.Read.All'))
  }
}

function Get-MgUser {
  [CmdletBinding()]
  param([Parameter()][string]$UserId, [Parameter()][string]$Filter, [Parameter()][int]$Top, [Parameter()][string[]]$Property, [Parameter()][switch]$All)
  Register-KjemoAppel 'Get-MgUser' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgUser'
  return @(
    [pscustomobject]@{ Id = '11111111-aaaa-bbbb-cccc-000000000001'; DisplayName = 'Lab Etudiant'; UserPrincipalName = 'etudiant@lab.example.com'; AccountEnabled = $true; UserType = 'Member'; CreatedDateTime = (Get-Date) },
    [pscustomobject]@{ Id = '11111111-aaaa-bbbb-cccc-000000000002'; DisplayName = '=cmd|calc'; UserPrincipalName = 'ancien@lab.example.com'; AccountEnabled = $false; UserType = 'Guest'; CreatedDateTime = (Get-Date) }
  )
}

function Get-MgGroup {
  [CmdletBinding()]
  param([Parameter()][string]$GroupId, [Parameter()][string]$Filter, [Parameter()][int]$Top, [Parameter()][string[]]$Property, [Parameter()][switch]$All)
  Register-KjemoAppel 'Get-MgGroup' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgGroup'
  return @(
    [pscustomobject]@{ Id = '22222222-aaaa-bbbb-cccc-000000000001'; DisplayName = 'Lab-Admins'; SecurityEnabled = $true; MailEnabled = $false; GroupTypes = @() },
    [pscustomobject]@{ Id = '22222222-aaaa-bbbb-cccc-000000000002'; DisplayName = 'Lab-Dynamique'; SecurityEnabled = $true; MailEnabled = $false; GroupTypes = @('DynamicMembership') }
  )
}

function New-KjemoObjetAnnuaire {
  param([string]$Type, [string]$Id, [hashtable]$Extra)
  $o = [pscustomobject]@{ Id = $Id; AdditionalProperties = @{} }
  $o.AdditionalProperties['@odata.type'] = $Type
  foreach ($k in $Extra.Keys) { $o.AdditionalProperties[$k] = $Extra[$k] }
  return $o
}

function Get-MgUserMemberOf {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$UserId, [Parameter()][int]$Top, [Parameter()][switch]$All)
  Register-KjemoAppel 'Get-MgUserMemberOf' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgUserMemberOf'
  return @(
    (New-KjemoObjetAnnuaire '#microsoft.graph.group' '22222222-aaaa-bbbb-cccc-000000000001' @{ displayName = 'Lab-Admins' }),
    (New-KjemoObjetAnnuaire '#microsoft.graph.directoryRole' '33333333-aaaa-bbbb-cccc-000000000001' @{ displayName = 'Global Reader' })
  )
}

function Get-MgGroupMember {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$GroupId, [Parameter()][int]$Top, [Parameter()][switch]$All)
  Register-KjemoAppel 'Get-MgGroupMember' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgGroupMember'
  return @(
    (New-KjemoObjetAnnuaire '#microsoft.graph.user' '11111111-aaaa-bbbb-cccc-000000000001' @{ displayName = 'Lab Etudiant'; userPrincipalName = 'etudiant@lab.example.com' })
  )
}

function Get-MgDirectoryRole {
  [CmdletBinding()]
  param([Parameter()][switch]$All, [Parameter()][string]$Filter)
  Register-KjemoAppel 'Get-MgDirectoryRole' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgDirectoryRole'
  return @(
    [pscustomobject]@{ Id = '33333333-aaaa-bbbb-cccc-000000000001'; DisplayName = 'Global Administrator' },
    [pscustomobject]@{ Id = '33333333-aaaa-bbbb-cccc-000000000002'; DisplayName = 'Global Reader' }
  )
}

function Get-MgDirectoryRoleMember {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$DirectoryRoleId, [Parameter()][switch]$All, [Parameter()][int]$Top)
  Register-KjemoAppel 'Get-MgDirectoryRoleMember' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgDirectoryRoleMember'
  return @(
    (New-KjemoObjetAnnuaire '#microsoft.graph.user' '11111111-aaaa-bbbb-cccc-000000000009' @{ displayName = 'Admin Lab'; userPrincipalName = 'admin@lab.example.com' })
  )
}

function Get-MgReportAuthenticationMethodUserRegistrationDetail {
  [CmdletBinding()]
  param([Parameter()][string]$Filter, [Parameter()][int]$Top, [Parameter()][switch]$All)
  Register-KjemoAppel 'Get-MgReportAuthenticationMethodUserRegistrationDetail' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-MgReportAuthenticationMethodUserRegistrationDetail'
  return @(
    [pscustomobject]@{ UserPrincipalName = 'etudiant@lab.example.com'; IsMfaRegistered = $true; IsMfaCapable = $true; IsAdmin = $false; MethodsRegistered = @('microsoftAuthenticatorPush') },
    [pscustomobject]@{ UserPrincipalName = 'admin@lab.example.com'; IsMfaRegistered = $false; IsMfaCapable = $false; IsAdmin = $true; MethodsRegistered = @() }
  )
}
