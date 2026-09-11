# DIAGNOSTIC — ne modifie rien
Get-Service WlanSvc
Get-NetAdapter -Physical | Format-Table Name,Status,LinkSpeed,InterfaceDescription -Auto
netsh wlan show interfaces
netsh wlan show networks mode=bssid

# RÉPARATION LÉGÈRE — redémarre le service WLAN et la carte choisie
Start-Service WlanSvc
Disable-NetAdapter -Name 'Ethernet $special' -Confirm:$false
Start-Sleep -Seconds 3
Enable-NetAdapter -Name 'Ethernet $special' -Confirm:$false

# Rechercher les périphériques réinstallés ou nouvellement détectés
pnputil /scan-devices

# Vérifier de nouveau les réseaux
netsh wlan show networks mode=bssid