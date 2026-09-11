Import-Module ActiveDirectory

$UserName = 'Jean-$special Tremblay`test'
$Sam      = 'mtremblay'
$Path     = 'OU=Test-Special,DC=hopitalbn,DC=lan'
$Password = Read-Host 'Mot de passe temporaire' -AsSecureString

if (Get-ADUser -Filter "SamAccountName -eq '$Sam'" -ErrorAction SilentlyContinue) {
    Write-Warning "L'utilisateur $Sam existe déjà."
}
else {
    New-ADUser -Name $UserName -GivenName 'Jean-$special' -Surname 'Tremblay`test' `
        -SamAccountName $Sam -UserPrincipalName "$Sam@hopitalbn.lan" -Path $Path `
        -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true -WhatIf
}

Get-ADUser -Identity $Sam -Properties Enabled,UserPrincipalName |
    Select-Object Name,SamAccountName,Enabled,UserPrincipalName