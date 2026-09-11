# Exécuter PowerShell en administrateur
# Vérification préalable
Get-NetAdapter
Get-NetIPConfiguration -InterfaceAlias 'Adaptateur Wi-Fi'

# Désactiver DHCP et ajouter l'adresse statique
Set-NetIPInterface -InterfaceAlias 'Adaptateur Wi-Fi' -AddressFamily IPv4 -Dhcp Disabled
New-NetIPAddress -InterfaceAlias 'Adaptateur Wi-Fi' -IPAddress '192.168.30.253' -PrefixLength 24 -DefaultGateway '192.168.30.254'

# Définir le DNS
Set-DnsClientServerAddress -InterfaceAlias 'Adaptateur Wi-Fi' -ServerAddresses '192.168.30.254'

# Vérification
Get-NetIPConfiguration -InterfaceAlias 'Adaptateur Wi-Fi'