# Exécuter PowerShell en administrateur
# Vérification préalable
Get-NetAdapter
Get-NetIPConfiguration -InterfaceAlias 'Ethernet,1'

# Désactiver DHCP et ajouter l'adresse statique
Set-NetIPInterface -InterfaceAlias 'Ethernet,1' -AddressFamily IPv4 -Dhcp Disabled
New-NetIPAddress -InterfaceAlias 'Ethernet,1' -IPAddress '192.168.30.253' -PrefixLength 24 -DefaultGateway '192.168.30.254'

# Définir le DNS
Set-DnsClientServerAddress -InterfaceAlias 'Ethernet,1' -ServerAddresses '192.168.30.254'

# Vérification
Get-NetIPConfiguration -InterfaceAlias 'Ethernet,1'