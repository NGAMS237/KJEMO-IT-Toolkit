const esc = (value) => String(value ?? "").replace(/'/g, "''");
const domainToDn = (domain) => String(domain).trim().split('.').filter(Boolean).map((part) => `DC=${part}`).join(',');

const tools = [
  {
    id: 'static-ip', icon: '◈', category: 'Réseau', title: 'Configurer une IP statique', risk: 'caution',
    summary: 'Configure IPv4, passerelle et DNS sur une carte Windows.',
    fields: [
      { id: 'adapter', label: 'Nom de la carte réseau', default: 'Ethernet', help: 'Vérifie avec Get-NetAdapter.' },
      { id: 'ip', label: 'Adresse IPv4', default: '192.168.30.253' },
      { id: 'prefix', label: 'Préfixe réseau', type: 'number', default: '24', help: '24 correspond au masque 255.255.255.0.' },
      { id: 'gateway', label: 'Passerelle', default: '192.168.30.254' },
      { id: 'dns', label: 'DNS préféré', default: '192.168.30.254' },
    ],
    generate: (v) => `# Exécuter PowerShell en administrateur\n# Vérification préalable\nGet-NetAdapter\nGet-NetIPConfiguration -InterfaceAlias '${esc(v.adapter)}'\n\n# Désactiver DHCP et ajouter l’adresse statique\nSet-NetIPInterface -InterfaceAlias '${esc(v.adapter)}' -AddressFamily IPv4 -Dhcp Disabled\nNew-NetIPAddress -InterfaceAlias '${esc(v.adapter)}' -IPAddress '${esc(v.ip)}' -PrefixLength ${v.prefix} -DefaultGateway '${esc(v.gateway)}'\n\n# Définir le DNS\nSet-DnsClientServerAddress -InterfaceAlias '${esc(v.adapter)}' -ServerAddresses '${esc(v.dns)}'\n\n# Vérification\nGet-NetIPConfiguration -InterfaceAlias '${esc(v.adapter)}'`,
    gui: ['Ouvrir Paramètres > Réseau et Internet > Paramètres réseau avancés.', 'Cliquer sur la carte concernée puis Modifier à côté de l’attribution IP.', 'Choisir Manuel, activer IPv4 et saisir IP, préfixe, passerelle et DNS.', 'Enregistrer puis ouvrir une console et vérifier avec ipconfig /all.'],
    checks: ['La carte visée doit être la bonne : une erreur peut couper l’accès réseau.', 'Si cette adresse existe déjà, supprimer ou modifier l’ancienne configuration avant de lancer New-NetIPAddress.'],
    source: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netipaddress'
  },
  {
    id: 'ad-ou', icon: '⌘', category: 'Active Directory', title: 'Créer une unité d’organisation', risk: 'safe',
    summary: 'Crée une OU protégée contre les suppressions accidentelles.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'ou', label: 'Nom de la nouvelle OU', default: 'Employes' },
      { id: 'parent', label: 'OU parente (facultatif)', default: '', help: 'Exemple : Administration. Laisser vide pour la racine du domaine.' },
      { id: 'whatif', label: 'Mode test', type: 'select', default: 'true', options: [['true', 'Oui — ne rien créer'], ['false', 'Non — créer réellement']] },
    ],
    generate: (v) => { const dn = domainToDn(v.domain); const path = v.parent ? `OU=${esc(v.parent)},${dn}` : dn; const full = `OU=${esc(v.ou)},${path}`; return `Import-Module ActiveDirectory\n\n$OuName = '${esc(v.ou)}'\n$OuPath = '${path}'\n$OuDn = '${full}'\n\nif (Get-ADOrganizationalUnit -Identity $OuDn -ErrorAction SilentlyContinue) {\n    Write-Warning "L’OU existe déjà : $OuDn"\n}\nelse {\n    New-ADOrganizationalUnit -Name $OuName -Path $OuPath -ProtectedFromAccidentalDeletion $true${v.whatif === 'true' ? ' -WhatIf' : ''}\n}\n\nGet-ADOrganizationalUnit -Identity $OuDn`; },
    gui: ['Ouvrir Gestionnaire de serveur > Outils > Utilisateurs et ordinateurs Active Directory.', 'Développer le domaine puis cliquer droit sur le conteneur parent.', 'Choisir Nouveau > Unité d’organisation.', 'Saisir le nom et conserver la protection contre la suppression accidentelle.'],
    checks: ['Le module ActiveDirectory est disponible sur un contrôleur de domaine ou avec RSAT.', 'Créer l’OU parente avant une sous-OU.'],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adorganizationalunit'
  },
  {
    id: 'ad-user', icon: '◉', category: 'Active Directory', title: 'Créer un utilisateur AD', risk: 'caution',
    summary: 'Crée un utilisateur, demande le mot de passe localement et force son changement à la première ouverture.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'ou', label: 'Nom de l’OU', default: 'Employes' },
      { id: 'firstName', label: 'Prénom', default: 'Marie' },
      { id: 'lastName', label: 'Nom', default: 'Tremblay' },
      { id: 'sam', label: 'Identifiant (SamAccountName)', default: 'mtremblay' },
      { id: 'whatif', label: 'Mode test', type: 'select', default: 'true', options: [['true', 'Oui — ne rien créer'], ['false', 'Non — créer réellement']] },
    ],
    generate: (v) => { const dn = `OU=${esc(v.ou)},${domainToDn(v.domain)}`; const name = `${esc(v.firstName)} ${esc(v.lastName)}`; return `Import-Module ActiveDirectory\n\n$UserName = '${name}'\n$Sam = '${esc(v.sam)}'\n$Path = '${dn}'\n$Password = Read-Host 'Mot de passe temporaire' -AsSecureString\n\nif (Get-ADUser -Filter "SamAccountName -eq '$Sam'" -ErrorAction SilentlyContinue) {\n    Write-Warning "L’utilisateur $Sam existe déjà."\n}\nelse {\n    New-ADUser -Name $UserName -GivenName '${esc(v.firstName)}' -Surname '${esc(v.lastName)}' \\\n        -SamAccountName $Sam -UserPrincipalName "$Sam@${esc(v.domain)}" -Path $Path \\\n        -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true${v.whatif === 'true' ? ' -WhatIf' : ''}\n}\n\nGet-ADUser -Identity $Sam -Properties Enabled,UserPrincipalName |\n    Select-Object Name,SamAccountName,Enabled,UserPrincipalName`; },
    gui: ['Ouvrir Utilisateurs et ordinateurs Active Directory.', 'Ouvrir l’OU voulue puis cliquer droit > Nouveau > Utilisateur.', 'Saisir prénom, nom et identifiant.', 'Saisir un mot de passe temporaire et cocher « L’utilisateur doit changer le mot de passe ».'],
    checks: ['Le script ne stocke pas le mot de passe dans le fichier.', 'Vérifier que l’OU existe avant création.'],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-aduser'
  },
  {
    id: 'shared-folder', icon: '▣', category: 'Fichiers & imprimantes', title: 'Créer un dossier partagé', risk: 'caution',
    summary: 'Crée le dossier, le partage SMB et donne un accès à un groupe AD.',
    fields: [
      { id: 'path', label: 'Chemin local', default: 'D:\Partages\Comptabilite' },
      { id: 'share', label: 'Nom du partage', default: 'Comptabilite' },
      { id: 'group', label: 'Groupe AD autorisé', default: 'GG-Comptabilite-RW' },
      { id: 'access', label: 'Niveau de partage', type: 'select', default: 'Change', options: [['Change', 'Modification'], ['Read', 'Lecture'], ['Full', 'Contrôle total']] },
    ],
    generate: (v) => `# Exécuter sur le serveur de fichiers en administrateur\n$Path = '${esc(v.path)}'\n$ShareName = '${esc(v.share)}'\n$Group = '${esc(v.group)}'\n\n# Créer le dossier s’il n’existe pas\nif (-not (Test-Path -LiteralPath $Path)) {\n    New-Item -Path $Path -ItemType Directory\n}\n\n# Créer le partage SMB s’il n’existe pas\nif (-not (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue)) {\n    New-SmbShare -Name $ShareName -Path $Path -FullAccess 'BUILTIN\\Administrators'\n}\n\n# Définir l’accès au partage et NTFS\nGrant-SmbShareAccess -Name $ShareName -AccountName $Group -AccessRight ${v.access} -Force\nicacls $Path /grant "${esc(v.group)}:(OI)(CI)M"\n\n# Vérification\nGet-SmbShare -Name $ShareName\nGet-SmbShareAccess -Name $ShareName`,
    gui: ['Créer d’abord le dossier dans l’Explorateur de fichiers.', 'Cliquer droit > Propriétés > Partage > Partage avancé.', 'Cocher « Partager ce dossier », définir le nom puis régler les autorisations.', 'Dans l’onglet Sécurité, ajouter le groupe AD et ses permissions NTFS.'],
    checks: ['Les permissions du partage et NTFS s’additionnent : l’accès réel est le plus restrictif.', 'Utilise idéalement des groupes, pas des utilisateurs individuels.'],
    source: 'https://learn.microsoft.com/powershell/module/smbshare/new-smbshare'
  },
  {
    id: 'second-dc', icon: '⇄', category: 'Active Directory', title: 'Ajouter un deuxième contrôleur', risk: 'caution',
    summary: 'Prépare la promotion d’un serveur déjà joint au domaine.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'source', label: 'Contrôleur source', default: 'srvh1bn.hopitalbn.lan' },
      { id: 'dns', label: 'DNS actuel du serveur source', default: '192.168.30.254' },
    ],
    generate: (v) => `# Conditions : IP statique, DNS vers le premier contrôleur et serveur déjà joint au domaine\n# Vérifications\nResolve-DnsName '${esc(v.source)}'\nTest-ComputerSecureChannel -Verbose\nTest-NetConnection '${esc(v.source)}' -Port 135\nTest-NetConnection '${esc(v.source)}' -Port 389\n\n# Installer le rôle si nécessaire\nInstall-WindowsFeature AD-Domain-Services -IncludeManagementTools\n\n# Promouvoir le serveur — le mot de passe DSRM sera demandé\nInstall-ADDSDomainController \\\n    -DomainName '${esc(v.domain)}' \\\n    -ReplicationSourceDC '${esc(v.source)}' \\\n    -InstallDns:$true \\\n    -CreateDnsDelegation:$false \\\n    -Credential (Get-Credential)\n\n# Après le redémarrage, vérifier depuis un contrôleur de domaine :\n# Get-ADDomainController -Filter *\n# repadmin /replsummary`,
    gui: ['Ouvrir Gestionnaire de serveur > Ajouter des rôles et fonctionnalités.', 'Ajouter Services AD DS puis terminer l’assistant.', 'Cliquer sur la notification puis « Promouvoir ce serveur en contrôleur de domaine ».', 'Choisir « Ajouter un contrôleur de domaine à un domaine existant », saisir le domaine et les identifiants.'],
    checks: ['Ne pas utiliser un DNS public sur le serveur à promouvoir.', 'Vérifier le canal sécurisé et les ports avant la promotion.', 'Le serveur redémarre automatiquement si l’installation réussit.'],
    source: 'https://learn.microsoft.com/windows-server/identity/ad-ds/deploy/install-active-directory-domain-services--level-100'
  },
  {
    id: 'wifi-repair', icon: '⌁', category: 'Dépannage Windows', title: 'Diagnostiquer et réinitialiser le Wi-Fi', risk: 'caution',
    summary: 'Vérifie la carte et le service WLAN, puis redémarre la carte choisie.',
    fields: [{ id: 'adapter', label: 'Nom de la carte Wi-Fi', default: 'Wi-Fi', help: 'Utilise d’abord le bloc diagnostic pour confirmer le nom.' }],
    generate: (v) => `# DIAGNOSTIC — ne modifie rien\nGet-Service WlanSvc\nGet-NetAdapter -Physical | Format-Table Name,Status,LinkSpeed,InterfaceDescription -Auto\nnetsh wlan show interfaces\nnetsh wlan show networks mode=bssid\n\n# RÉPARATION LÉGÈRE — redémarre le service WLAN et la carte choisie\nStart-Service WlanSvc\nDisable-NetAdapter -Name '${esc(v.adapter)}' -Confirm:$false\nStart-Sleep -Seconds 3\nEnable-NetAdapter -Name '${esc(v.adapter)}' -Confirm:$false\n\n# Rechercher les périphériques réinstallés ou nouvellement détectés\npnputil /scan-devices\n\n# Vérifier de nouveau les réseaux\nnetsh wlan show networks mode=bssid`,
    gui: ['Ouvrir Gestionnaire de périphériques > Cartes réseau.', 'Repérer la carte Wi-Fi puis choisir Désactiver l’appareil et Réactiver l’appareil.', 'Si cela ne résout rien : clic droit > Désinstaller l’appareil, puis Action > Rechercher les modifications sur le matériel.', 'Télécharger le pilote depuis le fabricant seulement si Windows ne réinstalle pas la carte.'],
    checks: ['Le nom de la carte doit être exact avant la désactivation.', 'La désinstallation du pilote est une solution de second niveau : commence toujours par redémarrer la carte.'],
    source: 'https://learn.microsoft.com/windows-hardware/drivers/devtest/pnputil-command-syntax'
  },
  {
    id: 'gpo-password', icon: '⚿', category: 'GPO', title: 'Politique de mots de passe du domaine', risk: 'caution',
    summary: 'Prépare la politique par défaut du domaine avec validation et aperçu.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'length', label: 'Longueur minimale', type: 'number', default: '12' },
      { id: 'lockout', label: 'Tentatives avant verrouillage', type: 'number', default: '5' },
      { id: 'minutes', label: 'Minutes de verrouillage', type: 'number', default: '30' },
    ],
    generate: (v) => `Import-Module ActiveDirectory\n\n# Aperçu de la politique actuelle\nGet-ADDefaultDomainPasswordPolicy -Identity '${esc(v.domain)}'\n\n# Appliquer la nouvelle politique\nSet-ADDefaultDomainPasswordPolicy -Identity '${esc(v.domain)}' \\\n    -ComplexityEnabled $true \\\n    -MinPasswordLength ${v.length} \\\n    -LockoutThreshold ${v.lockout} \\\n    -LockoutDuration (New-TimeSpan -Minutes ${v.minutes}) \\\n    -LockoutObservationWindow (New-TimeSpan -Minutes ${v.minutes})\n\n# Vérifier après application\nGet-ADDefaultDomainPasswordPolicy -Identity '${esc(v.domain)}'`,
    gui: ['Ouvrir Gestion de la stratégie de groupe.', 'Développer la forêt, le domaine, puis clic droit sur Default Domain Policy > Modifier.', 'Aller à Configuration ordinateur > Paramètres Windows > Paramètres de sécurité > Stratégies de compte.', 'Configurer les stratégies de mot de passe et de verrouillage de compte.'],
    checks: ['Cette politique touche les utilisateurs du domaine : teste d’abord les seuils en laboratoire.', 'Une stratégie de mot de passe fine est préférable lorsqu’un groupe spécifique requiert une règle différente.'],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/set-addefaultdomainpasswordpolicy'
  },
];

function createDiskScanTool() {
  return {
    id: 'disk-scan', icon: '◫', category: 'Stockage', title: 'Analyser et libérer de l’espace disque', risk: 'diagnostic',
    summary: 'Classe les fichiers et dossiers lourds, repère les artefacts recréables et propose une corbeille contrôlée.',
    fields: [
      { id: 'path', label: 'Disque ou dossier à analyser', default: 'C:\\', help: 'Exemples : C:\\, C:\\Users\\Blaise\\Projet ou D:\\.' },
      { id: 'top', label: 'Nombre maximal de lignes dans le rapport', type: 'number', default: '50', min: '5', max: '200', help: 'Le scan parcourt les éléments; ce nombre limite seulement l’affichage et la sélection.' },
      { id: 'minSize', label: 'Taille minimale en Go', type: 'number', default: '0.5', min: '0', max: '100000', step: '0.1', help: '0 inclut aussi les petits éléments; 0,5 cible les éléments d’au moins 500 Mo.' },
      { id: 'report', label: 'Format du rapport', type: 'select', default: 'both', options: [['both', 'CSV + HTML — recommandé'], ['csv', 'CSV seulement'], ['html', 'HTML seulement']] },
      { id: 'action', label: 'Après le rapport', type: 'select', default: 'report', options: [['report', 'Rapport uniquement — recommandé'], ['recycle', 'Permettre une sélection vers la corbeille']] },
    ],
    generate: (v) => {
      const top = Math.min(200, Math.max(5, Number.parseInt(v.top, 10) || 50));
      const minSize = Math.min(100000, Math.max(0, Number.parseFloat(v.minSize) || 0.5));
      const report = ['both', 'csv', 'html'].includes(v.report) ? v.report : 'both';
      const action = v.action === 'recycle' ? 'recycle' : 'report';
      const lines = [
        '# KJEMO IT TOOLKIT — ANALYSE DE DISQUE',
        '# Windows PowerShell 5.1 ou PowerShell 7 sur Windows',
        '# Lecture et rapport par défaut. Aucune suppression automatique.',
        '',
        "$TargetPath = '" + esc(v.path || 'C:\\') + "'",
        '$Top = ' + top,
        '$MinimumSizeGB = ' + minSize,
        "$ReportFormat = '" + report + "'",
        '$AllowRecycleSelection = $' + (action === 'recycle' ? 'true' : 'false'),
        "$Desktop = [Environment]::GetFolderPath('Desktop')",
        "$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'",
        "$ReportBase = Join-Path $Desktop ('KJEMO-Disk-Scan-' + $Stamp)",
        '',
        'function Test-PathWithin {',
        '    param([string]$Path, [string]$Root)',
        "    $PathFull = [IO.Path]::GetFullPath($Path)",
        "    $RootFull = [IO.Path]::GetFullPath($Root)",
        "    if ($PathFull.Length -gt 3) { $PathFull = $PathFull.TrimEnd('\\') }",
        "    if ($RootFull.Length -gt 3) { $RootFull = $RootFull.TrimEnd('\\') }",
        '    return $PathFull.Equals($RootFull, [StringComparison]::OrdinalIgnoreCase) -or',
        "        $PathFull.StartsWith($RootFull + '\\', [StringComparison]::OrdinalIgnoreCase)",
        '}',
        '',
        '$ProtectedRoots = @(',
        '    $env:SystemRoot,',
        '    $env:ProgramData,',
        '    $env:ProgramFiles,',
        "[Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),",
        "    (Join-Path $env:SystemDrive '$Recycle.Bin')",
        ') | Where-Object { $_ -and (Test-Path -LiteralPath $_) }',
        '',
        'function Get-ProtectionReason {',
        '    param([string]$FullPath)',
        "    $Segments = $FullPath.TrimEnd('\\').Split([IO.Path]::DirectorySeparatorChar)",
        "    $Leaf = Split-Path -Leaf $FullPath.TrimEnd('\\')",
        '    $LowerLeaf = $Leaf.ToLowerInvariant()',
        "    if ($Segments -contains '.git') { return '.git protégé' }",
        "    if ($Segments | Where-Object { $_ -like '.env*' }) { return '.env / configuration sensible protégé' }",
        "    if ($LowerLeaf -like '*backup*' -or $LowerLeaf -like '*sauvegarde*') { return 'sauvegarde protégée' }",
        "    $SensitiveExtensions = @('.bak', '.backup', '.db', '.dump', '.ldf', '.mdf', '.ndf', '.sql', '.sqlite', '.sqlite3')",
        "    if ($SensitiveExtensions -contains ([IO.Path]::GetExtension($Leaf).ToLowerInvariant())) { return 'base ou fichier de sauvegarde protégé' }",
        '    foreach ($Root in $ProtectedRoots) {',
        "        if (Test-PathWithin -Path $FullPath -Root $Root) { return 'zone système protégée' }",
        '    }',
        '    return $null',
        '}',
        '',
        'function Get-Classification {',
        '    param([string]$FullPath, [bool]$IsDirectory)',
        "    $Segments = $FullPath.TrimEnd('\\').Split([IO.Path]::DirectorySeparatorChar)",
        "    $Leaf = Split-Path -Leaf $FullPath.TrimEnd('\\')",
        "    $ArtifactNames = @('node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.cache', '__pycache__', 'vendor')",
        '    if ($IsDirectory -and ($ArtifactNames -contains $Leaf.ToLowerInvariant())) {',
        '        return "Artefact recréable de projet — $Leaf"',
        '    }',
        '    if ($Segments | Where-Object { $ArtifactNames -contains $_.ToLowerInvariant() }) {',
        "        return 'Fichier dans un artefact recréable de projet'",
        '    }',
        "    if ($IsDirectory) { return 'Dossier volumineux — à examiner' }",
        "    return 'Fichier volumineux — à examiner'",
        '}',
        '',
        '$TargetItem = Get-Item -LiteralPath $TargetPath -Force -ErrorAction Stop',
        "if (-not $TargetItem.PSIsContainer) { throw 'Le chemin doit être un disque ou un dossier.' }",
        "if ($TargetItem.FullName -match '^[A-Za-z]:\\\\?$' -and $TargetItem.FullName -eq ($env:SystemDrive + '\\')) { Write-Warning 'Un scan de la racine système peut être très long.' }",
        " $TargetResolved = $TargetItem.FullName",
        " if ($TargetResolved.Length -gt 3) { $TargetResolved = $TargetResolved.TrimEnd('\\') }",
        '$MinimumSizeBytes = [int64]($MinimumSizeGB * 1GB)',
        '',
        'Write-Host "Analyse de $TargetResolved en cours..." -ForegroundColor Cyan',
        '$Files = @(Get-ChildItem -LiteralPath $TargetResolved -File -Force -Recurse -ErrorAction SilentlyContinue)',
        '$DirectorySizes = @{}',
        '',
        '# Une seule énumération des fichiers; les tailles des dossiers sont additionnées par parent.',
        'foreach ($File in $Files) {',
        '    $Directory = Split-Path -Parent $File.FullName',
        "    while ($Directory -and (Test-PathWithin -Path $Directory -Root $TargetResolved)) {",
        '        if (-not $Directory.Equals($TargetResolved, [StringComparison]::OrdinalIgnoreCase)) {',
        '            if (-not $DirectorySizes.ContainsKey($Directory)) { $DirectorySizes[$Directory] = [int64]0 }',
        '            $DirectorySizes[$Directory] += [int64]$File.Length',
        '        }',
        '        if ($Directory.Equals($TargetResolved, [StringComparison]::OrdinalIgnoreCase)) { break }',
        '        $Parent = Split-Path -Parent $Directory',
        '        if ($Parent -eq $Directory) { break }',
        '        $Directory = $Parent',
        '    }',
        '}',
        '',
        '$DirectoryResults = foreach ($Entry in $DirectorySizes.GetEnumerator()) {',
        '    $Path = [string]$Entry.Key',
        '    $Bytes = [int64]$Entry.Value',
        '    if ($Bytes -ge $MinimumSizeBytes) {',
        '        $Protection = Get-ProtectionReason -FullPath $Path',
        '        $Classification = Get-Classification -FullPath $Path -IsDirectory $true',
        '        [PSCustomObject]@{',
        "            Type = 'Dossier'; Path = $Path; TailleGB = [math]::Round($Bytes / 1GB, 2); TailleMB = [math]::Round($Bytes / 1MB, 0)",
        '            Classification = $Classification; Protege = [bool]$Protection; MotifProtection = $Protection',
        "            SelectionPossible = [bool](-not $Protection -and $Classification -like 'Artefact recréable*')",
        '        }',
        '    }',
        '}',
        '',
        '$FileResults = foreach ($File in $Files) {',
        '    if ([int64]$File.Length -ge $MinimumSizeBytes) {',
        '        $Protection = Get-ProtectionReason -FullPath $File.FullName',
        '        [PSCustomObject]@{',
        "            Type = 'Fichier'; Path = $File.FullName; TailleGB = [math]::Round($File.Length / 1GB, 2); TailleMB = [math]::Round($File.Length / 1MB, 0)",
        '            Classification = Get-Classification -FullPath $File.FullName -IsDirectory $false; Protege = [bool]$Protection; MotifProtection = $Protection',
        '            SelectionPossible = [bool](-not $Protection)',
        '        }',
        '    }',
        '}',
        '',
        '$Results = @($DirectoryResults) + @($FileResults) | Sort-Object TailleGB -Descending',
        '$ReportResults = @($Results | Select-Object -First $Top)',
        "if ($ReportResults.Count -eq 0) { Write-Warning 'Aucun élément ne correspond à la taille minimale.' }",
        'else { $ReportResults | Format-Table Type,TailleGB,Classification,Protege,Path -AutoSize }',
        '',
        '# Exporter les objets non formatés conserve des colonnes exploitables dans Excel et HTML.',
        "if ($ReportFormat -in @('csv', 'both')) {",
        '    $CsvPath = "$ReportBase.csv"',
        '    $ReportResults | Export-Csv -LiteralPath $CsvPath -UseCulture -NoTypeInformation -Encoding UTF8',
        '    Write-Host "CSV créé : $CsvPath" -ForegroundColor Green',
        '}',
        "if ($ReportFormat -in @('html', 'both')) {",
        '    $HtmlPath = "$ReportBase.html"',
        "    $Css = '<style>body{font-family:Segoe UI,Arial;margin:2rem} table{border-collapse:collapse} th,td{border:1px solid #bbb;padding:.4rem;text-align:left} th{background:#eee}</style>'",
        '    $ReportResults | ConvertTo-Html -Title \'KJEMO — Analyse de disque\' -Head $Css -PreContent "<h1>Analyse de $TargetResolved</h1><p>Généré le $(Get-Date)</p>" | Out-File -LiteralPath $HtmlPath -Encoding UTF8',
        '    Write-Host "HTML créé : $HtmlPath" -ForegroundColor Green',
        '}',
        '',
        'if ($AllowRecycleSelection -and $ReportResults.Count -gt 0) {',
        '    $Candidates = @($ReportResults | Where-Object { $_.SelectionPossible -eq $true })',
        "    $CandidateFolders = @($Candidates | Where-Object { $_.Type -eq 'Dossier' })",
        '    $Candidates = @($Candidates | Where-Object {',
        "        $CurrentCandidate = $_",
        "        $CurrentCandidate.Type -eq 'Dossier' -or -not ($CandidateFolders | Where-Object { Test-PathWithin -Path $CurrentCandidate.Path -Root $_.Path })",
        '    })',
        "    if ($Candidates.Count -eq 0) { Write-Host 'Aucun candidat non protégé n’est proposé pour la corbeille.' -ForegroundColor Yellow }",
        '    else {',
        '        Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction Stop',
        "        Write-Host ''",
        '        Write-Host \'Candidats proposés (les éléments protégés sont exclus) :\' -ForegroundColor Yellow',
        '        for ($Index = 0; $Index -lt $Candidates.Count; $Index++) {',
        '            Write-Host ("[{0}] {1} — {2} Go — {3}" -f ($Index + 1), $Candidates[$Index].Type, $Candidates[$Index].TailleGB, $Candidates[$Index].Path)',
        '        }',
        '        $Confirmation = Read-Host "Pour continuer, tape exactement CONFIRMER; toute autre réponse annule"',
        "        if ($Confirmation -cne 'CONFIRMER') { Write-Host 'Opération annulée : aucun élément déplacé.' -ForegroundColor Cyan }",
        '        else {',
        "            $Selection = Read-Host 'Numéros à envoyer à la corbeille, séparés par des virgules (exemple : 1,3)'",
        "            $Indexes = $Selection -split '[,; ]+' | ForEach-Object { $Parsed = 0; if ([int]::TryParse($_, [ref]$Parsed)) { $Parsed } }",
        '            foreach ($Number in $Indexes) {',
        '                if ($Number -lt 1 -or $Number -gt $Candidates.Count) { Write-Warning "Numéro ignoré : $Number"; continue }',
        '                $Candidate = $Candidates[$Number - 1]',
        '                try {',
        "                    if ($Candidate.Type -eq 'Dossier') {",
        '                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)',
        '                    }',
        '                    else {',
        '                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)',
        '                    }',
        '                    Write-Host "Envoyé à la corbeille : $($Candidate.Path)" -ForegroundColor Green',
        '                }',
        '                catch { Write-Warning "Échec pour $($Candidate.Path) : $($_.Exception.Message)" }',
        '            }',
        '        }',
        '    }',
        '}',
        '',
        "Write-Host ''",
        'Write-Host "Terminé. Les rapports restent sur le Bureau; vérifie-les avant toute autre action." -ForegroundColor Cyan',
      ];
      return lines.join('\n');
    },
    gui: ['Ouvrir Paramètres > Système > Stockage pour un résumé rapide.', 'Pour un dossier précis, ouvrir PowerShell et utiliser le chemin exact; l’Explorateur peut aussi afficher les propriétés du disque.', 'Dans un projet SaaS, examiner en priorité node_modules, .next, dist, build, out, coverage et les caches : ils peuvent souvent être régénérés après vérification.', 'Ne sélectionner pour la corbeille que des éléments non protégés dont l’absence est confirmée; ne jamais toucher à .git, .env, bases ou sauvegardes.'],
    checks: ['Compatible avec Windows PowerShell 5.1 ou PowerShell 7 sur Windows; le scan peut prendre du temps sur un gros disque.', 'Le mode recommandé produit seulement un rapport CSV/HTML et ne supprime rien.', 'Les chemins contenant .git, .env, bases, sauvegardes et zones système sont marqués protégés et exclus de la sélection.', 'La corbeille demande CONFIRMER puis des numéros; les éléments verrouillés ou sans permission sont signalés sans arrêter tout le rapport.'],
    source: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-childitem'
  };
}

// Ajoute la fiche V0.2 sans réécrire le reste du catalogue.
tools.push(createDiskScanTool());

const categories = ['Tout', ...new Set(tools.map((tool) => tool.category))];
let selectedCategory = 'Tout';
let currentTool = null;
let currentTab = 'assistant';

function renderNavigation() {
  const nav = document.querySelector('#navigation');
  nav.innerHTML = categories.map((category) => {
    const count = category === 'Tout' ? tools.length : tools.filter((tool) => tool.category === category).length;
    return `<button data-category="${category}" class="${category === selectedCategory ? 'active' : ''}">${category}<span class="nav-count">${count}</span></button>`;
  }).join('');
  nav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category; currentTool = null; render(); document.querySelector('.sidebar').classList.remove('open');
  }));
}

function filteredTools() {
  const query = document.querySelector('#search').value.trim().toLocaleLowerCase('fr');
  return tools.filter((tool) => (selectedCategory === 'Tout' || tool.category === selectedCategory) && `${tool.title} ${tool.summary} ${tool.category}`.toLocaleLowerCase('fr').includes(query));
}

function renderHome() {
  const grid = document.querySelector('#toolGrid');
  const list = filteredTools();
  document.querySelector('#toolCount').textContent = `${list.length} outil${list.length > 1 ? 's' : ''}`;
  grid.innerHTML = '';
  if (!list.length) { grid.innerHTML = '<div class="empty">Aucun outil ne correspond à cette recherche.</div>'; return; }
  const template = document.querySelector('#toolTemplate');
  list.forEach((tool) => {
    const card = template.content.cloneNode(true);
    card.querySelector('.tool-icon').textContent = tool.icon;
    card.querySelector('.tag').textContent = tool.category.toUpperCase();
    card.querySelector('h3').textContent = tool.title;
    card.querySelector('p').textContent = tool.summary;
    card.querySelector('.open-tool').addEventListener('click', () => { currentTool = tool; currentTab = 'assistant'; render(); });
    grid.append(card);
  });
}

function formMarkup(tool) {
  return tool.fields.map((field) => {
    if (field.type === 'select') {
      return `<div class="field"><label for="${field.id}">${field.label}</label><select id="${field.id}">${field.options.map(([value, label]) => `<option value="${value}" ${value === field.default ? 'selected' : ''}>${label}</option>`).join('')}</select>${field.help ? `<small>${field.help}</small>` : ''}</div>`;
    }
    const attributes = [field.min !== undefined ? `min="${field.min}"` : '', field.max !== undefined ? `max="${field.max}"` : '', field.step !== undefined ? `step="${field.step}"` : ''].filter(Boolean).join(' ');
    if (field.type === 'checkbox') {
      return `<div class="field checkbox-field"><label><input id="${field.id}" type="checkbox" ${field.default ? 'checked' : ''} /> ${field.label}</label>${field.help ? `<small>${field.help}</small>` : ''}</div>`;
    }
    return `<div class="field"><label for="${field.id}">${field.label}</label><input id="${field.id}" type="${field.type || 'text'}" value="${field.default || ''}" ${attributes} />${field.help ? `<small>${field.help}</small>` : ''}</div>`;
  }).join('');
}

function getValues(tool) {
  return Object.fromEntries(tool.fields.map((field) => {
    const element = document.querySelector(`#${field.id}`);
    return [field.id, field.type === 'checkbox' ? element.checked : element.value];
  }));
}

function textToCode(text) { return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char])); }
function normalizeScript(text) { return text.replace(/\\\n/g, String.fromCharCode(96) + '\n'); }

function renderTool() {
  const tool = currentTool;
  const view = document.querySelector('#toolView');
  const riskLabels = { diagnostic: 'DIAGNOSTIC — aucune modification', safe: 'RÉVERSIBLE — vérifier avant exécution', caution: 'ATTENTION — modifie la configuration', destructive: 'DESTRUCTIF — confirmation indispensable' };
  view.innerHTML = `<div class="tool-header"><button class="back-button" id="backButton">← Tous les outils</button><div><div class="tag">${tool.category.toUpperCase()}</div><h1>${tool.icon} ${tool.title}</h1><p>${tool.summary}</p><span class="risk ${tool.risk}">${riskLabels[tool.risk]}</span></div></div><div class="tabs"><button class="tab ${currentTab === 'assistant' ? 'active' : ''}" data-tab="assistant">Assistant</button><button class="tab ${currentTab === 'script' ? 'active' : ''}" data-tab="script">Script</button><button class="tab ${currentTab === 'gui' ? 'active' : ''}" data-tab="gui">Interface graphique</button></div><div id="tabContent"></div>`;
  view.querySelector('#backButton').addEventListener('click', () => { currentTool = null; render(); });
  view.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { currentTab = tab.dataset.tab; renderTool(); }));
  const content = view.querySelector('#tabContent');
  if (currentTab === 'gui') {
    content.innerHTML = `<div class="panel"><h2>Étapes avec l’interface Windows</h2><ol class="steps">${tool.gui.map((step) => `<li>${step}</li>`).join('')}</ol><div class="details"><h3>Avant de commencer</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div></div>`;
    return;
  }
  const script = normalizeScript(tool.generate(Object.fromEntries(tool.fields.map((field) => [field.id, field.default || '']))));
  content.innerHTML = `<div class="tool-content"><section class="panel"><h2>${currentTab === 'assistant' ? 'Tes informations' : 'Paramètres du script'}</h2><form id="toolForm">${formMarkup(tool)}<button class="primary-button" type="submit">${currentTab === 'assistant' ? 'Générer le script' : 'Actualiser l’aperçu'}</button></form><div class="details"><h3>Vérifications</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div></section><section class="panel"><h2>Aperçu PowerShell</h2><div class="code-wrap"><pre id="scriptOutput" class="code">${textToCode(script)}</pre></div><div class="code-actions"><button id="copyButton" class="secondary-button">Copier</button><button id="downloadButton" class="secondary-button">Télécharger .ps1</button></div><span id="copyFeedback" class="copy-feedback" aria-live="polite"></span></section></div>`;
  content.querySelector('#toolForm').addEventListener('submit', (event) => { event.preventDefault(); const output = normalizeScript(tool.generate(getValues(tool))); content.querySelector('#scriptOutput').textContent = output; content.querySelector('#copyFeedback').textContent = 'Aperçu actualisé.'; });
  content.querySelector('#copyButton').addEventListener('click', async () => { try { await navigator.clipboard.writeText(content.querySelector('#scriptOutput').textContent); content.querySelector('#copyFeedback').textContent = 'Script copié dans le presse-papiers.'; } catch { content.querySelector('#copyFeedback').textContent = 'Copie impossible : sélectionne le texte manuellement.'; } });
  content.querySelector('#downloadButton').addEventListener('click', () => { const blob = new Blob([content.querySelector('#scriptOutput').textContent], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${tool.id}.ps1`; link.click(); URL.revokeObjectURL(link.href); });
}

function render() {
  renderNavigation();
  document.querySelector('#home').hidden = Boolean(currentTool);
  document.querySelector('#toolView').hidden = !currentTool;
  if (currentTool) renderTool(); else renderHome();
}

document.querySelector('#search').addEventListener('input', () => { if (!currentTool) renderHome(); });
document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
render();
