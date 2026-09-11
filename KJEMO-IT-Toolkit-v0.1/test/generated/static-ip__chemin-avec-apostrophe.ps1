# Exécuter PowerShell en administrateur
# Vérification préalable
Get-NetAdapter
Get-NetIPConfiguration -InterfaceAlias 'Ethernet'

# Désactiver DHCP et ajouter l'adresse statique
Set-NetIPInterface -InterfaceAlias 'Ethernet' -AddressFamily IPv4 -Dhcp Disabled
New-NetIPAddress -InterfaceAlias 'Ethernet' -IPAddress '192.168.30.253' -PrefixLength 24 -DefaultGateway '192.168.30.254'

# Définir le DNS
Set-DnsClientServerAddress -InterfaceAlias 'Ethernet' -ServerAddresses '192.168.30.254'

# Vérification
Get-NetIPConfiguration -InterfaceAlias 'Ethernet'