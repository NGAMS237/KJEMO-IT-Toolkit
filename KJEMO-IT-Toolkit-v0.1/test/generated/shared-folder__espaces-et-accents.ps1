# Exécuter sur le serveur de fichiers en administrateur
$Path      = 'C:\Users\Lévesque-Trépanier'
$ShareName = 'Données Éléonore'
$Group     = 'GG-Comptabilité-RW'

# Créer le dossier s'il n'existe pas
if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -Path $Path -ItemType Directory
}

# Créer le partage SMB s'il n'existe pas
if (-not (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue)) {
    New-SmbShare -Name $ShareName -Path $Path -FullAccess 'BUILTIN\Administrators'
}

# Définir l'accès au partage et NTFS
Grant-SmbShareAccess -Name $ShareName -AccountName $Group -AccessRight Change -Force
icacls $Path /grant "$($Group):(OI)(CI)M"

# Vérification
Get-SmbShare -Name $ShareName
Get-SmbShareAccess -Name $ShareName