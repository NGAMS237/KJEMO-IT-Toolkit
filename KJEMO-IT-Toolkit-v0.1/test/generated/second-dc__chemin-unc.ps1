# Conditions : IP statique, DNS vers le premier contrôleur et serveur déjà joint au domaine
# Vérifications
Resolve-DnsName 'srvh1bn.hopitalbn.lan'
Test-ComputerSecureChannel -Verbose
Test-NetConnection 'srvh1bn.hopitalbn.lan' -Port 135
Test-NetConnection 'srvh1bn.hopitalbn.lan' -Port 389

# Installer le rôle si nécessaire
Install-WindowsFeature AD-Domain-Services -IncludeManagementTools

# Promouvoir le serveur — le mot de passe DSRM sera demandé
Install-ADDSDomainController `
    -DomainName 'hopitalbn.lan' `
    -ReplicationSourceDC 'srvh1bn.hopitalbn.lan' `
    -InstallDns:$true `
    -CreateDnsDelegation:$false `
    -Credential (Get-Credential)

# Après le redémarrage, vérifier depuis un contrôleur de domaine :
# Get-ADDomainController -Filter *
# repadmin /replsummary