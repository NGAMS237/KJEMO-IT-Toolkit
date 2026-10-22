# doublures-vm-reseau.ps1 — LOT 8 · familles C (machines virtuelles) et D (reseau).
# Voir doublures-base.ps1 : une doublure prouve les appels et les parametres,
# pas le comportement du service reel. Aucune connexion, aucune ressource.
#
# $global:KjemoActions recoit chaque EFFET REEL d'une action (jamais un -WhatIf) :
# demarrage ou arret effectivement execute. Il doit rester vide en previsualisation.

$global:KjemoActions = New-Object System.Collections.ArrayList

function New-KjemoStatutVm {
  param([string]$Etat)
  $code = 'PowerState/running'
  if ($Etat -eq 'VM stopped') { $code = 'PowerState/stopped' }
  if ($Etat -eq 'VM deallocated') { $code = 'PowerState/deallocated' }
  return [pscustomobject]@{
    Statuses = @([pscustomobject]@{ Code = $code; DisplayStatus = $Etat })
    VMAgent = [pscustomobject]@{ VmAgentVersion = '2.7.41491.1071'; Statuses = @([pscustomobject]@{ DisplayStatus = (Get-KjemoScenarioValeur 'AgentEtat' 'Ready') }) }
    Extensions = @([pscustomobject]@{ Name = 'AzureMonitorWindowsAgent'; Statuses = @([pscustomobject]@{ DisplayStatus = 'Provisioning succeeded' }) })
  }
}

function Get-AzVM {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name, [Parameter()][switch]$Status, [Parameter()][string]$Location, [Parameter()][string]$DisplayHint)
  Register-KjemoAppel 'Get-AzVM' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzVM'
  $etat = Get-KjemoScenarioValeur 'VmEtat' 'VM running'
  $mk = {
    param($n, $rg, $taille)
    [pscustomobject]@{
      Name = $n; ResourceGroupName = $rg; Location = 'canadacentral'; ProvisioningState = 'Succeeded'
      Id = ('/subscriptions/aaaaaaaa-1111-2222-3333-444444444444/resourceGroups/' + $rg + '/providers/Microsoft.Compute/virtualMachines/' + $n)
      HardwareProfile = [pscustomobject]@{ VmSize = $taille }
      StorageProfile = [pscustomobject]@{ OsDisk = [pscustomobject]@{ OsType = 'Windows'; Name = ($n + '_OsDisk') }; DataDisks = @([pscustomobject]@{ Name = ($n + '_data') }) }
      NetworkProfile = [pscustomobject]@{ NetworkInterfaces = @([pscustomobject]@{ Id = ('/nic/' + $n) }) }
      DiagnosticsProfile = [pscustomobject]@{ BootDiagnostics = [pscustomobject]@{ Enabled = (Get-KjemoScenarioValeur 'BootDiag' $true) } }
      Identity = $null
      Tags = @{ proprietaire = 'ASR' }
    }
  }
  $nom1 = $(if ($Name) { 'vm-lab-01' } else { [string](Get-KjemoScenarioValeur 'NomVm' 'vm-lab-01') })
  $toutes = @((& $mk $nom1 'rg-lab' 'Standard_B2s'), (& $mk 'vm-lab-02' 'rg-lab' 'Standard_B1s'), (& $mk 'vm-prod-01' 'rg-prod' 'Standard_D2s_v5'))
  if ($ResourceGroupName) { $toutes = @($toutes | Where-Object { $_.ResourceGroupName -eq $ResourceGroupName }) }
  if ($Name) {
    $une = @($toutes | Where-Object { $_.Name -eq $Name })
    if ($une.Count -eq 0) { throw ("ResourceNotFound : The Resource 'Microsoft.Compute/virtualMachines/" + $Name + "' under resource group was not found.") }
    if ($Status) { return (New-KjemoStatutVm $etat) }
    return $une[0]
  }
  if ($Status) {
    $etats = @{ 'vm-lab-01' = $etat; 'vm-lab-02' = 'VM stopped'; 'vm-prod-01' = 'VM deallocated' }
    return @($toutes | ForEach-Object { [pscustomobject]@{ ResourceGroupName = $_.ResourceGroupName; Name = $_.Name; PowerState = $etats[$_.Name] } })
  }
  return $toutes
}

function Start-AzVM {
  [CmdletBinding(SupportsShouldProcess = $true)]
  param([Parameter(Mandatory = $true)][string]$ResourceGroupName, [Parameter(Mandatory = $true)][string]$Name, [Parameter()][switch]$NoWait)
  Register-KjemoAppel 'Start-AzVM' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Start-AzVM'
  if ($PSCmdlet.ShouldProcess($Name, 'Start')) {
    [void]$global:KjemoActions.Add(('Start-AzVM ' + $ResourceGroupName + '/' + $Name))
    $global:KjemoScenario['VmEtat'] = 'VM running'
    return [pscustomobject]@{ Status = 'Succeeded'; IsSuccessStatusCode = $true }
  }
}

function Stop-AzVM {
  [CmdletBinding(SupportsShouldProcess = $true)]
  param([Parameter(Mandatory = $true)][string]$ResourceGroupName, [Parameter(Mandatory = $true)][string]$Name, [Parameter()][switch]$StayProvisioned, [Parameter()][switch]$Force, [Parameter()][switch]$NoWait, [Parameter()][switch]$SkipShutdown)
  Register-KjemoAppel 'Stop-AzVM' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Stop-AzVM'
  if ($PSCmdlet.ShouldProcess($Name, 'Stop')) {
    [void]$global:KjemoActions.Add(('Stop-AzVM ' + $ResourceGroupName + '/' + $Name + $(if ($StayProvisioned) { ' StayProvisioned' } else { ' Deallocate' })))
    if ($StayProvisioned) { $global:KjemoScenario['VmEtat'] = 'VM stopped' } else { $global:KjemoScenario['VmEtat'] = 'VM deallocated' }
    return [pscustomobject]@{ Status = 'Succeeded'; IsSuccessStatusCode = $true }
  }
}

function Get-AzDisk {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$DiskName)
  Register-KjemoAppel 'Get-AzDisk' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzDisk'
  return @(
    [pscustomobject]@{ Name = 'vm-lab-01_OsDisk'; DiskState = 'Attached'; ManagedBy = '/subscriptions/x/resourceGroups/rg-lab/providers/Microsoft.Compute/virtualMachines/vm-lab-01'; DiskSizeGB = 127; Sku = [pscustomobject]@{ Name = 'Premium_LRS' } },
    [pscustomobject]@{ Name = 'ancien-disque-donnees'; DiskState = 'Unattached'; ManagedBy = $null; DiskSizeGB = 512; Sku = [pscustomobject]@{ Name = 'Standard_LRS' } }
  )
}

function Get-AzNetworkInterface {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzNetworkInterface' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzNetworkInterface'
  return @(
    [pscustomobject]@{
      Name = 'nic-vm-lab-01'
      VirtualMachine = [pscustomobject]@{ Id = '/subscriptions/x/resourceGroups/rg-lab/providers/Microsoft.Compute/virtualMachines/vm-lab-01' }
      NetworkSecurityGroup = [pscustomobject]@{ Id = '/subscriptions/x/resourceGroups/rg-lab/providers/Microsoft.Network/networkSecurityGroups/nsg-lab' }
      EnableIPForwarding = $false
      IpConfigurations = @([pscustomobject]@{ PrivateIpAddress = '10.10.1.4'; PrivateIpAllocationMethod = 'Dynamic'; PublicIpAddress = [pscustomobject]@{ Id = '/subscriptions/x/resourceGroups/rg-lab/providers/Microsoft.Network/publicIPAddresses/pip-vm-lab-01' } })
    },
    [pscustomobject]@{
      Name = 'nic-orpheline'
      VirtualMachine = $null
      NetworkSecurityGroup = $null
      EnableIPForwarding = $true
      IpConfigurations = @([pscustomobject]@{ PrivateIpAddress = '10.10.1.9'; PrivateIpAllocationMethod = 'Static'; PublicIpAddress = $null })
    }
  )
}

function Get-AzPublicIpAddress {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzPublicIpAddress' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzPublicIpAddress'
  return @(
    [pscustomobject]@{ Name = 'pip-vm-lab-01'; Id = '/subscriptions/x/resourceGroups/rg-lab/providers/Microsoft.Network/publicIPAddresses/pip-vm-lab-01'; IpAddress = '203.0.113.10'; PublicIpAllocationMethod = 'Static'; Sku = [pscustomobject]@{ Name = 'Standard' }; Location = 'canadacentral'; IpConfiguration = [pscustomobject]@{ Id = 'x' } },
    [pscustomobject]@{ Name = 'pip-orpheline'; Id = '/subscriptions/x/resourceGroups/rg-lab/providers/Microsoft.Network/publicIPAddresses/pip-orpheline'; IpAddress = '203.0.113.99'; PublicIpAllocationMethod = 'Static'; Sku = [pscustomobject]@{ Name = 'Standard' }; Location = 'canadacentral'; IpConfiguration = $null }
  )
}

function Get-AzVirtualNetwork {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name, [Parameter()][string]$ExpandResource)
  Register-KjemoAppel 'Get-AzVirtualNetwork' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzVirtualNetwork'
  $chevauche = Get-KjemoScenarioValeur 'VnetChevauchement' $true
  $plage2 = '10.10.128.0/17'
  if (-not $chevauche) { $plage2 = '10.20.0.0/16' }
  return @(
    [pscustomobject]@{
      Name = 'vnet-lab'; Location = 'canadacentral'
      AddressSpace = [pscustomobject]@{ AddressPrefixes = @('10.10.0.0/16') }
      DhcpOptions = [pscustomobject]@{ DnsServers = @() }
      Subnets = @(
        [pscustomobject]@{ Name = 'snet-app'; AddressPrefix = @('10.10.1.0/24'); NetworkSecurityGroup = [pscustomobject]@{ Id = '/x/networkSecurityGroups/nsg-lab' }; RouteTable = $null },
        [pscustomobject]@{ Name = 'snet-sans-nsg'; AddressPrefix = @('10.10.2.0/24'); NetworkSecurityGroup = $null; RouteTable = $null },
        [pscustomobject]@{ Name = 'GatewaySubnet'; AddressPrefix = @('10.10.255.0/27'); NetworkSecurityGroup = $null; RouteTable = $null }
      )
      VirtualNetworkPeerings = @([pscustomobject]@{ Name = 'vers-vnet-hub'; PeeringState = 'Initiated' })
    },
    [pscustomobject]@{
      Name = 'vnet-hub'; Location = 'canadacentral'
      AddressSpace = [pscustomobject]@{ AddressPrefixes = @($plage2, 'fd00:db8::/48') }
      DhcpOptions = [pscustomobject]@{ DnsServers = @('10.20.0.4') }
      Subnets = @()
      VirtualNetworkPeerings = @()
    }
  )
}

function Get-AzNetworkSecurityGroup {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name, [Parameter()][string]$ExpandResource)
  Register-KjemoAppel 'Get-AzNetworkSecurityGroup' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzNetworkSecurityGroup'
  $regle = {
    param($n, $dir, $acc, $prio, $src, $ports)
    [pscustomobject]@{ Name = $n; Direction = $dir; Access = $acc; Priority = $prio; Protocol = 'Tcp'; SourceAddressPrefix = @($src); DestinationPortRange = @($ports) }
  }
  $rdp = @((& $regle 'Allow-RDP-Internet' 'Inbound' 'Allow' 100 'Internet' '3389'), (& $regle 'Allow-HTTPS' 'Inbound' 'Allow' 200 '*' '443'), (& $regle 'Allow-SQL-Large' 'Inbound' 'Allow' 300 '0.0.0.0/0' '1433'), (& $regle 'Allow-RDP-Bureau' 'Inbound' 'Allow' 110 '198.51.100.7' '3389'))
  if (Get-KjemoScenarioValeur 'NsgSain' $false) { $rdp = @((& $regle 'Allow-HTTPS' 'Inbound' 'Allow' 200 '*' '443')) }
  return @(
    [pscustomobject]@{ Name = 'nsg-lab'; SecurityRules = $rdp; Subnets = @([pscustomobject]@{ Id = 'x' }); NetworkInterfaces = @() },
    [pscustomobject]@{ Name = 'nsg-oublie'; SecurityRules = @(); Subnets = @(); NetworkInterfaces = @() }
  )
}

function Get-AzPrivateDnsZone {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzPrivateDnsZone' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzPrivateDnsZone'
  return @([pscustomobject]@{ Name = 'privee.lab.example.com'; NumberOfRecordSets = 3; NumberOfVirtualNetworkLinks = 1 }, [pscustomobject]@{ Name = 'sans-lien.example.com'; NumberOfRecordSets = 1; NumberOfVirtualNetworkLinks = 0 })
}

function Get-AzPrivateDnsVirtualNetworkLink {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$ResourceGroupName, [Parameter(Mandatory = $true)][string]$ZoneName)
  Register-KjemoAppel 'Get-AzPrivateDnsVirtualNetworkLink' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzPrivateDnsVirtualNetworkLink'
  if ($ZoneName -eq 'sans-lien.example.com') { return @() }
  return @([pscustomobject]@{ Name = 'lien-vnet-lab'; VirtualNetworkId = '/x/virtualNetworks/vnet-lab'; RegistrationEnabled = $false; VirtualNetworkLinkState = 'Completed' })
}

function Get-AzDnsZone {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceGroupName, [Parameter()][string]$Name)
  Register-KjemoAppel 'Get-AzDnsZone' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzDnsZone'
  return @([pscustomobject]@{ Name = 'lab.example.com'; NumberOfRecordSets = 5; NameServers = @('ns1-01.azure-dns.com.', 'ns2-01.azure-dns.net.') })
}

function Get-AzActivityLog {
  [CmdletBinding()]
  param([Parameter()][string]$ResourceId, [Parameter()][string]$ResourceGroupName, [Parameter()][datetime]$StartTime, [Parameter()][datetime]$EndTime, [Parameter()][int]$MaxRecord, [Parameter()][string]$Caller, [Parameter()][string]$Status, [Parameter()][string]$ResourceProvider)
  Register-KjemoAppel 'Get-AzActivityLog' $PSBoundParameters
  Invoke-KjemoScenarioRefus 'Get-AzActivityLog'
  $loc = { param($v, $l) [pscustomobject]@{ Value = $v; LocalizedValue = $l } }
  return @(
    [pscustomobject]@{ EventTimestamp = (Get-Date).AddHours(-2); OperationName = (& $loc 'Microsoft.Compute/virtualMachines/start/action' 'Start Virtual Machine'); Status = (& $loc 'Succeeded' 'Succeeded'); Caller = 'etudiant@lab.example.com'; ResourceId = $ResourceId },
    [pscustomobject]@{ EventTimestamp = (Get-Date).AddHours(-3); OperationName = (& $loc 'Microsoft.Compute/virtualMachines/write' 'Create or Update Virtual Machine'); Status = (& $loc 'Failed' 'Failed'); Caller = 'admin@lab.example.com'; ResourceId = $ResourceId }
  )
}
