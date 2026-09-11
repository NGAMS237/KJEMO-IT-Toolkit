Import-Module ActiveDirectory

$UserName = 'Marie Tremblay'
$Sam      = 'mtremblay'
$Path     = 'OU=Employes,DC=hopitalbn,DC=lan'
$Password = Read-Host 'Mot de passe temporaire' -AsSecureString

if (Get-ADUser -Filter "SamAccountName -eq '$Sam'" -ErrorAction SilentlyContinue) {
    Write-Warning "L'utilisateur $Sam existe déjà."
}
else {
    New-ADUser -Name $UserName -GivenName 'Marie' -Surname 'Tremblay' `
        -SamAccountName $Sam -UserPrincipalName "$Sam@hopitalbn.lan" -Path $Path `
        -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true -WhatIf
}

Get-ADUser -Identity $Sam -Properties Enabled,UserPrincipalName |
    Select-Object Name,SamAccountName,Enabled,UserPrincipalName