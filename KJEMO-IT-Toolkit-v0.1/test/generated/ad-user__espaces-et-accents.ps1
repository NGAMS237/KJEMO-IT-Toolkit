Import-Module ActiveDirectory

$UserName = 'Éléonore Lévesque-Trépanier'
$Sam      = 'mtremblay'
$Path     = 'OU=Bureau Élévation,DC=hopitalbn,DC=lan'
$Password = Read-Host 'Mot de passe temporaire' -AsSecureString

if (Get-ADUser -Filter {SamAccountName -eq $Sam} -ErrorAction SilentlyContinue) {
    Write-Warning "L'utilisateur $Sam existe déjà."
}
else {
    New-ADUser -Name $UserName -GivenName 'Éléonore' -Surname 'Lévesque-Trépanier' `
        -SamAccountName $Sam -UserPrincipalName "$Sam@hopitalbn.lan" -Path $Path `
        -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true -WhatIf
}

Get-ADUser -Identity $Sam -Properties Enabled,UserPrincipalName |
    Select-Object Name,SamAccountName,Enabled,UserPrincipalName