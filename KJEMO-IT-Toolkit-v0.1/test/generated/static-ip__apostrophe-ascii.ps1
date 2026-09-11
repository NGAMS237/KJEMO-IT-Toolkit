# Exécuter PowerShell en administrateur
# Vérification préalable
Get-NetAdapter
Get-NetIPConfiguration -InterfaceAlias 'Ethernet D''Adam'

# Désactiver DHCP et ajouter l'adresse statique
Set-NetIPInterface -InterfaceAlias 'Ethernet D''Adam' -AddressFamily IPv4 -Dhcp Disabled
New-NetIPAddress -InterfaceAlias 'Ethernet D''Adam' -IPAddress '192.168.30.253' -PrefixLength 24 -DefaultGateway '192.168.30.254'

# Définir le DNS
Set-DnsClientServerAddress -InterfaceAlias 'Ethernet D''Adam' -ServerAddresses '192.168.30.254'

# Vérification
Get-NetIPConfiguration -InterfaceAlias 'Ethernet D''Adam'