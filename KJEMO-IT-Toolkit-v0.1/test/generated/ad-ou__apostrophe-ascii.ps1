Import-Module ActiveDirectory

$OuName = 'Direction-D''Adam'
$OuPath = 'DC=hopitalbn,DC=lan'
$OuDn   = 'OU=Direction-D''Adam,DC=hopitalbn,DC=lan'

if (Get-ADOrganizationalUnit -Identity $OuDn -ErrorAction SilentlyContinue) {
    Write-Warning "L'OU existe déjà : $OuDn"
}
else {
    New-ADOrganizationalUnit -Name $OuName -Path $OuPath -ProtectedFromAccidentalDeletion $true -WhatIf
}

Get-ADOrganizationalUnit -Identity $OuDn