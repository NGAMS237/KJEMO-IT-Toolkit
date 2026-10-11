/**
 * cmdlets.mjs — inventaire déclaratif des commandes externes
 * ----------------------------------------------------------
 * Chaque commande qu'un script généré appelle est déclarée ici, avec son
 * module, le système qui la fournit et sa page de documentation Microsoft.
 *
 * Pourquoi un tel fichier existe : un script qui appelle une applet de
 * commande inexistante échoue à l'exécution, chez la personne, en production —
 * pas au moment où on l'écrit. Le LOT 4 en portait un exemple : un appel à
 * « Get-GPOBackup », qui n'a jamais fait partie du module GroupPolicy. Un
 * try/catch autour d'une commande qui n'existe pas n'est pas une précaution,
 * c'est un camouflage.
 *
 * Le banc scripts/Test-KjemoCmdlets.ps1 analyse les scripts générés, relève
 * chaque commande appelée, et échoue si l'une d'elles ne figure pas ici. En CI
 * Windows, il vérifie en plus avec Get-Command celles dont le module est
 * réellement présent sur l'agent.
 *
 * Ce module n'importe rien et n'est importé par aucun générateur : c'est une
 * table, pas du code.
 */

export const CMDLETS_EXTERNES = {
  // --- Microsoft.PowerShell.Core — PowerShell
  'ForEach-Object': { module: 'Microsoft.PowerShell.Core', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.core/foreach-object' },
  'Get-Command': { module: 'Microsoft.PowerShell.Core', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.core/get-command' },
  'Import-Module': { module: 'Microsoft.PowerShell.Core', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.core/import-module' },
  'Out-Null': { module: 'Microsoft.PowerShell.Core', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.core/out-null' },
  'Where-Object': { module: 'Microsoft.PowerShell.Core', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.core/where-object' },
  // --- Microsoft.PowerShell.Utility — PowerShell
  'Add-Type': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/add-type' },
  'Compare-Object': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/compare-object' },
  'ConvertFrom-Json': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/convertfrom-json' },
  'ConvertTo-Html': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/convertto-html' },
  'ConvertTo-Json': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/convertto-json' },
  'Export-Csv': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/export-csv' },
  'Format-List': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/format-list' },
  'Format-Table': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/format-table' },
  'Get-Date': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/get-date' },
  'Get-Random': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/get-random' },
  'Group-Object': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/group-object' },
  'Import-Csv': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/import-csv' },
  'Invoke-WebRequest': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/invoke-webrequest' },
  'Measure-Command': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/measure-command' },
  'Measure-Object': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/measure-object' },
  'New-Object': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/new-object' },
  'New-TimeSpan': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/new-timespan' },
  'Out-File': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/out-file' },
  'Out-String': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/out-string' },
  'Read-Host': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/read-host' },
  'Select-Object': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/select-object' },
  'Select-String': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/select-string' },
  'Sort-Object': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/sort-object' },
  'Start-Sleep': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/start-sleep' },
  'Write-Host': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/write-host' },
  'Write-Output': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/write-output' },
  'Write-Verbose': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/write-verbose' },
  'Write-Warning': { module: 'Microsoft.PowerShell.Utility', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/write-warning' },
  // --- Microsoft.PowerShell.Management — PowerShell
  'Convert-Path': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/convert-path' },
  'Get-ChildItem': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem' },
  'Get-Content': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-content' },
  'Get-Item': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-item' },
  'Get-ItemProperty': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-itemproperty' },
  'Get-PSDrive': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-psdrive' },
  'Get-Service': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-service' },
  'Join-Path': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/join-path' },
  'New-Item': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/new-item' },
  'Resolve-Path': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/resolve-path' },
  'Get-HotFix': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-hotfix' },
  'Get-Process': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-process' },
  'Rename-Item': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/rename-item' },
  'Stop-Process': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/stop-process' },
  'Stop-Service': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/stop-service' },
  'Get-AuthenticodeSignature': { module: 'Microsoft.PowerShell.Security', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-authenticodesignature' },
  'Add-Content': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/add-content' },
  // Remove-Item est declaree ICI, et un seul assistant du catalogue l'appelle :
  // temp-cleanup. Son appel est unitaire — un LiteralPath, pas de -Recurse, pas
  // de -Force, pas de joker — et il est garde par une liste blanche, un seuil
  // d'age, un manifeste, une confirmation ecrite et une reverification du
  // chemin canonique juste avant chaque suppression. La declarer n'autorise
  // rien : l'inventaire dit quelles commandes EXISTENT, les verrous disent ce
  // qui est permis, et test/poste-verrous.test.mjs les eprouve a l'execution.
  'Remove-Item': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/remove-item' },
  'Get-BitLockerVolume': { module: 'BitLocker', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/bitlocker/get-bitlockervolume' },
  'Get-LocalGroup': { module: 'Microsoft.PowerShell.LocalAccounts', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/get-localgroup' },
  'Get-LocalGroupMember': { module: 'Microsoft.PowerShell.LocalAccounts', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/get-localgroupmember' },
  'Get-LocalUser': { module: 'Microsoft.PowerShell.LocalAccounts', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/get-localuser' },
  'Get-MpThreat': { module: 'Defender', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/defender/get-mpthreat' },
  'Get-MpThreatDetection': { module: 'Defender', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/defender/get-mpthreatdetection' },
  'Get-NetFirewallAddressFilter': { module: 'NetSecurity', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewalladdressfilter' },
  'Get-NetFirewallApplicationFilter': { module: 'NetSecurity', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewallapplicationfilter' },
  'Start-MpScan': { module: 'Defender', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/defender/start-mpscan' },
  'Checkpoint-Computer': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7 (editions client ; absent des editions Serveur)', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/checkpoint-computer' },
  'Get-PhysicalDisk': { module: 'Storage', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/storage/get-physicaldisk' },
  'Get-ScheduledTask': { module: 'ScheduledTasks', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/scheduledtasks/get-scheduledtask' },
  'Restart-Service': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/restart-service' },
  'Set-Content': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/set-content' },
  'Split-Path': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/split-path' },
  'Start-Service': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/start-service' },
  'Test-ComputerSecureChannel': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/test-computersecurechannel' },
  'Test-Connection': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/test-connection' },
  'Test-Path': { module: 'Microsoft.PowerShell.Management', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/test-path' },
  // --- Microsoft.PowerShell.Security — PowerShell
  'Get-Acl': { module: 'Microsoft.PowerShell.Security', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl' },
  'Get-Credential': { module: 'Microsoft.PowerShell.Security', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-credential' },
  'Set-Acl': { module: 'Microsoft.PowerShell.Security', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/set-acl' },
  // --- Microsoft.PowerShell.Diagnostics — PowerShell
  'Get-WinEvent': { module: 'Microsoft.PowerShell.Diagnostics', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent' },
  // --- CimCmdlets — PowerShell
  'Get-CimClass': { module: 'CimCmdlets', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/cimcmdlets/get-cimclass' },
  'Get-CimInstance': { module: 'CimCmdlets', fourniPar: 'PowerShell', os: 'Windows PowerShell 5.1 et PowerShell 7', doc: 'https://learn.microsoft.com/powershell/module/cimcmdlets/get-ciminstance' },
  // --- ActiveDirectory — RSAT — Outils AD DS
  'Add-ADGroupMember': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/add-adgroupmember' },
  'Clear-ADAccountExpiration': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/clear-adaccountexpiration' },
  'Disable-ADAccount': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/disable-adaccount' },
  'Enable-ADAccount': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/enable-adaccount' },
  'Get-ADComputer': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adcomputer' },
  'Get-ADDefaultDomainPasswordPolicy': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-addefaultdomainpasswordpolicy' },
  'Get-ADDomain': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-addomain' },
  'Get-ADDomainController': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-addomaincontroller' },
  'Get-ADForest': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adforest' },
  'Get-ADGroup': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adgroup' },
  'Get-ADGroupMember': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adgroupmember' },
  'Get-ADObject': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adobject' },
  'Get-ADOptionalFeature': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adoptionalfeature' },
  'Get-ADOrganizationalUnit': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adorganizationalunit' },
  'Get-ADReplicationPartnerMetadata': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adreplicationpartnermetadata' },
  'Get-ADReplicationSite': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adreplicationsite' },
  'Get-ADReplicationSubnet': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adreplicationsubnet' },
  'Get-ADRootDSE': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adrootdse' },
  'Get-ADUser': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/get-aduser' },
  'Move-ADObject': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/move-adobject' },
  'New-ADGroup': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adgroup' },
  'New-ADOrganizationalUnit': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adorganizationalunit' },
  'New-ADUser': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/new-aduser' },
  'Set-ADAccountPassword': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/set-adaccountpassword' },
  'Set-ADDefaultDomainPasswordPolicy': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/set-addefaultdomainpasswordpolicy' },
  'Set-ADUser': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/set-aduser' },
  'Unlock-ADAccount': { module: 'ActiveDirectory', fourniPar: 'RSAT — Outils AD DS', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/activedirectory/unlock-adaccount' },
  // --- ADDSDeployment — Rôle AD DS
  'Install-ADDSDomainController': { module: 'ADDSDeployment', fourniPar: 'Rôle AD DS', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/addsdeployment/install-addsdomaincontroller' },
  // --- GroupPolicy — RSAT — Gestion des stratégies de groupe
  'Backup-GPO': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/backup-gpo' },
  'Get-GPInheritance': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpinheritance' },
  'Get-GPO': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpo' },
  'Get-GPOReport': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gporeport' },
  'Get-GPPermission': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gppermission' },
  'Get-GPRegistryValue': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpregistryvalue' },
  'Get-GPResultantSetOfPolicy': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpresultantsetofpolicy' },
  'New-GPLink': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/new-gplink' },
  'New-GPO': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/new-gpo' },
  'Restore-GPO': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/restore-gpo' },
  'Set-GPPermission': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gppermission' },
  'Set-GPRegistryValue': { module: 'GroupPolicy', fourniPar: 'RSAT — Gestion des stratégies de groupe', os: 'Windows Server 2016 et plus récent, ou poste avec RSAT', doc: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gpregistryvalue' },
  // --- DhcpServer — Rôle DHCP Server, ou RSAT
  'Add-DhcpServerInDC': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverindc' },
  'Add-DhcpServerv4ExclusionRange': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4exclusionrange' },
  'Add-DhcpServerv4Reservation': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4reservation' },
  'Add-DhcpServerv4Scope': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4scope' },
  'Backup-DhcpServer': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/backup-dhcpserver' },
  'Get-DhcpServerAuditLog': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverauditlog' },
  'Get-DhcpServerInDC': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverindc' },
  'Get-DhcpServerVersion': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverversion' },
  'Get-DhcpServerv4ExclusionRange': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4exclusionrange' },
  'Get-DhcpServerv4FreeIPAddress': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4freeipaddress' },
  'Get-DhcpServerv4Lease': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4lease' },
  'Get-DhcpServerv4OptionValue': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4optionvalue' },
  'Get-DhcpServerv4Reservation': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4reservation' },
  'Get-DhcpServerv4Scope': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4scope' },
  'Get-DhcpServerv4ScopeStatistics': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4scopestatistics' },
  'Set-DhcpServerv4OptionValue': { module: 'DhcpServer', fourniPar: 'Rôle DHCP Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dhcpserver/set-dhcpserverv4optionvalue' },
  // --- DnsServer — Rôle DNS Server, ou RSAT
  'Add-DnsServerPrimaryZone': { module: 'DnsServer', fourniPar: 'Rôle DNS Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverprimaryzone' },
  'Add-DnsServerResourceRecordA': { module: 'DnsServer', fourniPar: 'Rôle DNS Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverresourcerecorda' },
  'Get-DnsServerCache': { module: 'DnsServer', fourniPar: 'Rôle DNS Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsservercache' },
  'Get-DnsServerForwarder': { module: 'DnsServer', fourniPar: 'Rôle DNS Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverforwarder' },
  'Get-DnsServerRecursion': { module: 'DnsServer', fourniPar: 'Rôle DNS Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverrecursion' },
  'Get-DnsServerResourceRecord': { module: 'DnsServer', fourniPar: 'Rôle DNS Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverresourcerecord' },
  'Get-DnsServerZone': { module: 'DnsServer', fourniPar: 'Rôle DNS Server, ou RSAT', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverzone' },
  // --- DnsClient — Windows
  'Clear-DnsClientCache': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/clear-dnsclientcache' },
  'Get-DnsClient': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclient' },
  'Get-DnsClientCache': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientcache' },
  'Get-DnsClientGlobalSetting': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientglobalsetting' },
  'Get-DnsClientNrptPolicy': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientnrptpolicy' },
  'Get-DnsClientServerAddress': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientserveraddress' },
  'Register-DnsClient': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/register-dnsclient' },
  'Resolve-DnsName': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/resolve-dnsname' },
  'Set-DnsClientServerAddress': { module: 'DnsClient', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/dnsclient/set-dnsclientserveraddress' },
  // --- NetTCPIP — Windows
  'Get-NetIPAddress': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipaddress' },
  'Get-NetIPConfiguration': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipconfiguration' },
  'Get-NetIPInterface': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipinterface' },
  'Get-NetIPv4Protocol': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipv4protocol' },
  'Get-NetIPv6Protocol': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipv6protocol' },
  'Get-NetNeighbor': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netneighbor' },
  'Get-NetRoute': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
  'Get-NetTCPConnection': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-nettcpconnection' },
  'Get-NetTCPSetting': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-nettcpsetting' },
  'Get-NetUDPEndpoint': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netudpendpoint' },
  'New-NetIPAddress': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netipaddress' },
  'New-NetRoute': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netroute' },
  'Remove-NetNeighbor': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/remove-netneighbor' },
  'Remove-NetRoute': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/remove-netroute' },
  'Set-NetIPInterface': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/set-netipinterface' },
  'Test-NetConnection': { module: 'NetTCPIP', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
  // --- NetAdapter — Windows
  'Disable-NetAdapter': { module: 'NetAdapter', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netadapter/disable-netadapter' },
  'Enable-NetAdapter': { module: 'NetAdapter', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netadapter/enable-netadapter' },
  'Get-NetAdapter': { module: 'NetAdapter', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netadapter/get-netadapter' },
  'Get-NetAdapterAdvancedProperty': { module: 'NetAdapter', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netadapter/get-netadapteradvancedproperty' },
  'Get-NetAdapterStatistics': { module: 'NetAdapter', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netadapter/get-netadapterstatistics' },
  // --- NetConnection — Windows
  'Get-NetConnectionProfile': { module: 'NetConnection', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netconnection/get-netconnectionprofile' },
  // --- NetSecurity — Windows
  'Get-NetFirewallPortFilter': { module: 'NetSecurity', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewallportfilter' },
  'Get-NetFirewallProfile': { module: 'NetSecurity', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewallprofile' },
  'Get-NetFirewallRule': { module: 'NetSecurity', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewallrule' },
  // --- SmbShare — Windows
  'Get-SmbClientConfiguration': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbclientconfiguration' },
  'Get-SmbClientNetworkInterface': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbclientnetworkinterface' },
  'Get-SmbConnection': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbconnection' },
  'Get-SmbMapping': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbmapping' },
  'Get-SmbOpenFile': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbopenfile' },
  'Get-SmbSession': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbsession' },
  'Get-SmbShare': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshare' },
  'Get-SmbShareAccess': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshareaccess' },
  'Grant-SmbShareAccess': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/grant-smbshareaccess' },
  'New-SmbShare': { module: 'SmbShare', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/smbshare/new-smbshare' },
  // --- Storage — Windows
  'Get-Volume': { module: 'Storage', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/storage/get-volume' },
  // --- ServerManager — Windows Server
  'Get-WindowsFeature': { module: 'ServerManager', fourniPar: 'Windows Server', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/servermanager/get-windowsfeature' },
  'Install-WindowsFeature': { module: 'ServerManager', fourniPar: 'Windows Server', os: 'Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/servermanager/install-windowsfeature' },
  // --- Defender — Windows
  'Get-MpComputerStatus': { module: 'Defender', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/defender/get-mpcomputerstatus' },
  'Get-MpPreference': { module: 'Defender', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/defender/get-mppreference' },
  // --- PnpDevice — Windows
  'Get-PnpDevice': { module: 'PnpDevice', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/pnpdevice/get-pnpdevice' },
  // --- PrintManagement — Windows
  'Get-Printer': { module: 'PrintManagement', fourniPar: 'Windows', os: 'Windows 10/11 et Windows Server 2016 et plus récent', doc: 'https://learn.microsoft.com/powershell/module/printmanagement/get-printer' },
  // --- VpnClient — Windows
  'Get-VpnConnection': { module: 'VpnClient', fourniPar: 'Windows', os: 'Windows 10/11', doc: 'https://learn.microsoft.com/powershell/module/vpnclient/get-vpnconnection' },
  'Get-VpnConnectionTrigger': { module: 'VpnClient', fourniPar: 'Windows', os: 'Windows 10/11', doc: 'https://learn.microsoft.com/powershell/module/vpnclient/get-vpnconnectiontrigger' },
};

/**
 * Binaires Windows appelés directement. Ce ne sont pas des applets de
 * commande : ils ne répondent pas à Get-Command de la même façon et leur
 * documentation vit ailleurs.
 */
export const BINAIRES_EXTERNES = {
  'arp': { fourniPar: 'Windows (arp.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/arp' },
  'dcdiag': { fourniPar: 'Outils AD DS (dcdiag.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/dcdiag' },
  'dcdiag.exe': { fourniPar: 'Outils AD DS (dcdiag.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/dcdiag' },
  'gpresult.exe': { fourniPar: 'Windows (gpresult.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult' },
  'gpupdate.exe': { fourniPar: 'Windows (gpupdate.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/gpupdate' },
  'net': { fourniPar: 'Windows (net.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/troubleshoot/windows-server/networking/net-commands-on-operating-systems' },
  'dsregcmd.exe': { fourniPar: 'Windows (dsregcmd.exe)', os: 'Windows 10, Windows 11', doc: 'https://learn.microsoft.com/entra/identity/devices/troubleshoot-device-dsregcmd' },
  'bcdedit.exe': { fourniPar: 'Windows (bcdedit.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-hardware/manufacture/desktop/bcdedit-command-line-options' },
  'dism.exe': { fourniPar: 'Windows (dism.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-hardware/manufacture/desktop/dism-image-management-command-line-options-s14' },
  'reagentc.exe': { fourniPar: 'Windows (reagentc.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-hardware/manufacture/desktop/reagentc-command-line-options' },
  'icacls': { fourniPar: 'Windows (icacls.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/icacls' },
  'ipconfig': { fourniPar: 'Windows (ipconfig.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/ipconfig' },
  'klist.exe': { fourniPar: 'Windows (klist.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/klist' },
  'nbtstat': { fourniPar: 'Windows (nbtstat.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/nbtstat' },
  'netsh': { fourniPar: 'Windows (netsh.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/networking/technologies/netsh/netsh' },
  'netstat': { fourniPar: 'Windows (netstat.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/netstat' },
  'nslookup': { fourniPar: 'Windows (nslookup.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/nslookup' },
  'pathping': { fourniPar: 'Windows (pathping.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/pathping' },
  'ping': { fourniPar: 'Windows (ping.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/ping' },
  'pnputil': { fourniPar: 'Windows (pnputil.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-hardware/drivers/devtest/pnputil' },
  'repadmin.exe': { fourniPar: 'Outils AD DS (repadmin.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc770963(v=ws.11)' },
  'route': { fourniPar: 'Windows (route.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/route_ws2008' },
  'tracert': { fourniPar: 'Windows (tracert.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/administration/windows-commands/tracert' },
  'w32tm.exe': { fourniPar: 'Windows (w32tm.exe)', os: 'Windows', doc: 'https://learn.microsoft.com/windows-server/networking/windows-time-service/windows-time-service-tools-and-settings' },
};

/**
 * Commandes explicitement BANNIES, avec la raison. Une commande bannie n'est
 * pas simplement absente de la table : elle est nommée, pour que le message
 * d'échec explique pourquoi plutôt que de dire « inconnue ».
 */
export const CMDLETS_INTERDITES = {
  'Get-GPOBackup': 'N’existe pas. Le module GroupPolicy ne fournit aucune applet de commande pour lister les sauvegardes : l’inventaire se fait en lisant manifest.xml et les dossiers {BackupId} écrits par Backup-GPO.',
  'Remove-GPO': 'Suppression d’une stratégie de groupe : hors du périmètre de ce catalogue.',
  'Remove-GPLink': 'Suppression d’un lien de stratégie : documentée dans les procédures d’annulation, jamais générée.',
  'Set-ExecutionPolicy': 'Abaisse la sécurité de la machine entière. Les scripts se débloquent avec Unblock-File.',
  'Invoke-Expression': 'Exécution dynamique de texte : interdite partout dans ce projet.',
  'Invoke-RestMethod': 'Appel réseau sortant non maîtrisé depuis un script généré.',
  'Restart-Computer': 'Redémarrage automatique : jamais déclenché par un assistant.',
  'Stop-Computer': 'Arrêt automatique : jamais déclenché par un assistant.',
};

/** Vrai si le nom est une commande déclarée et autorisée. */
export function commandeAutorisee(nom) {
  if (!nom) return false;
  if (Object.prototype.hasOwnProperty.call(CMDLETS_INTERDITES, nom)) return false;
  return Object.prototype.hasOwnProperty.call(CMDLETS_EXTERNES, nom)
      || Object.prototype.hasOwnProperty.call(BINAIRES_EXTERNES, nom);
}

/** Raison du refus, ou null si la commande est autorisée. */
export function raisonRefus(nom) {
  if (Object.prototype.hasOwnProperty.call(CMDLETS_INTERDITES, nom)) {
    return CMDLETS_INTERDITES[nom];
  }
  if (commandeAutorisee(nom)) return null;
  return 'Commande non déclarée dans dist/cmdlets.mjs. Si elle existe vraiment, l’ajouter avec son module, son système et sa page Microsoft ; sinon, la retirer du générateur.';
}

