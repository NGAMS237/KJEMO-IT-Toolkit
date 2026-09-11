Import-Module ActiveDirectory

# Aperçu de la politique actuelle
Get-ADDefaultDomainPasswordPolicy -Identity 'hopitalbn.lan'

# Appliquer la nouvelle politique
Set-ADDefaultDomainPasswordPolicy -Identity 'hopitalbn.lan' `
    -ComplexityEnabled $true `
    -MinPasswordLength 12 `
    -LockoutThreshold 5 `
    -LockoutDuration (New-TimeSpan -Minutes 30) `
    -LockoutObservationWindow (New-TimeSpan -Minutes 30)

# Vérifier après application
Get-ADDefaultDomainPasswordPolicy -Identity 'hopitalbn.lan'