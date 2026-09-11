# KJEMO IT TOOLKIT — ANALYSE DE DISQUE
# Windows PowerShell 5.1 ou PowerShell 7 sur Windows
# Lecture et rapport par défaut. Aucune suppression automatique.

$TargetPath = 'C:\'
$Top = 50
$MinimumSizeGB = 0.5
$ReportFormat = 'both'
$AllowRecycleSelection = $false
$Desktop = [Environment]::GetFolderPath('Desktop')
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ReportBase = Join-Path $Desktop ('KJEMO-Disk-Scan-' + $Stamp)

function Test-PathWithin {
    param([string]$Path, [string]$Root)
    $PathFull = [IO.Path]::GetFullPath($Path)
    $RootFull = [IO.Path]::GetFullPath($Root)
    $PathNorm = if ($PathFull -match '^[A-Za-z]:\\$') { $PathFull } else { $PathFull.TrimEnd('\') }
    $RootNorm = if ($RootFull -match '^[A-Za-z]:\\$') { $RootFull } else { $RootFull.TrimEnd('\') }
    $RootSep = if ($RootNorm.EndsWith('\')) { $RootNorm } else { $RootNorm + '\' }
    return $PathNorm.Equals($RootNorm, [StringComparison]::OrdinalIgnoreCase) -or
        $PathNorm.StartsWith($RootSep, [StringComparison]::OrdinalIgnoreCase)
}

$ProtectedRoots = @(
    $env:SystemRoot,
    $env:ProgramData,
    $env:ProgramFiles,
    [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),
    (Join-Path $env:SystemDrive '$Recycle.Bin')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

function Get-ProtectionReason {
    param([string]$FullPath)
    $Segments = $FullPath.TrimEnd('\').Split([IO.Path]::DirectorySeparatorChar)
    $Leaf = Split-Path -Leaf $FullPath.TrimEnd('\')
    $LowerLeaf = $Leaf.ToLowerInvariant()
    if ($Segments -contains '.git') { return '.git protégé' }
    if ($Segments | Where-Object { $_ -like '.env*' }) { return '.env / configuration sensible protégé' }
    if ($LowerLeaf -like '*backup*' -or $LowerLeaf -like '*sauvegarde*') { return 'sauvegarde protégée' }
    $SensitiveExtensions = @('.bak', '.backup', '.db', '.dump', '.ldf', '.mdf', '.ndf', '.sql', '.sqlite', '.sqlite3')
    if ($SensitiveExtensions -contains ([IO.Path]::GetExtension($Leaf).ToLowerInvariant())) { return 'base ou fichier de sauvegarde protégé' }
    foreach ($Root in $ProtectedRoots) {
        if (Test-PathWithin -Path $FullPath -Root $Root) { return 'zone système protégée' }
    }
    return $null
}

function Get-Classification {
    param([string]$FullPath, [bool]$IsDirectory)
    $Segments = $FullPath.TrimEnd('\').Split([IO.Path]::DirectorySeparatorChar)
    $Leaf = Split-Path -Leaf $FullPath.TrimEnd('\')
    $ArtifactNames = @('node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.cache', '__pycache__', 'vendor')
    if ($IsDirectory -and ($ArtifactNames -contains $Leaf.ToLowerInvariant())) {
        return "Artefact recréable de projet — $Leaf"
    }
    if ($Segments | Where-Object { $ArtifactNames -contains $_.ToLowerInvariant() }) {
        return 'Fichier dans un artefact recréable de projet'
    }
    if ($IsDirectory) { return 'Dossier volumineux — à examiner' }
    return 'Fichier volumineux — à examiner'
}

$TargetItem = Get-Item -LiteralPath $TargetPath -Force -ErrorAction Stop
if (-not $TargetItem.PSIsContainer) { throw 'Le chemin doit être un disque ou un dossier.' }
if ($TargetItem.FullName -match '^[A-Za-z]:\\?$' -and $TargetItem.FullName -eq ($env:SystemDrive + '\')) { Write-Warning 'Un scan de la racine système peut être très long.' }
$TargetResolved = $TargetItem.FullName
if ($TargetResolved.Length -gt 3) { $TargetResolved = $TargetResolved.TrimEnd('\') }
$MinimumSizeBytes = [int64]($MinimumSizeGB * 1GB)

Write-Host "Analyse de $TargetResolved en cours..." -ForegroundColor Cyan
$Files = @(Get-ChildItem -LiteralPath $TargetResolved -File -Force -Recurse -ErrorAction SilentlyContinue)
$DirectorySizes = @{}

# Une seule énumération des fichiers; les tailles des dossiers sont additionnées par parent.
foreach ($File in $Files) {
    $Directory = Split-Path -Parent $File.FullName
    while ($Directory -and (Test-PathWithin -Path $Directory -Root $TargetResolved)) {
        if (-not $Directory.Equals($TargetResolved, [StringComparison]::OrdinalIgnoreCase)) {
            if (-not $DirectorySizes.ContainsKey($Directory)) { $DirectorySizes[$Directory] = [int64]0 }
            $DirectorySizes[$Directory] += [int64]$File.Length
        }
        if ($Directory.Equals($TargetResolved, [StringComparison]::OrdinalIgnoreCase)) { break }
        $Parent = Split-Path -Parent $Directory
        if ($Parent -eq $Directory) { break }
        $Directory = $Parent
    }
}

$DirectoryResults = foreach ($Entry in $DirectorySizes.GetEnumerator()) {
    $Path = [string]$Entry.Key
    $Bytes = [int64]$Entry.Value
    if ($Bytes -ge $MinimumSizeBytes) {
        $Protection = Get-ProtectionReason -FullPath $Path
        $Classification = Get-Classification -FullPath $Path -IsDirectory $true
        [PSCustomObject]@{
            Type = 'Dossier'; Path = $Path; TailleGB = [math]::Round($Bytes / 1GB, 2); TailleMB = [math]::Round($Bytes / 1MB, 0)
            Classification = $Classification; Protege = [bool]$Protection; MotifProtection = $Protection
            SelectionPossible = [bool](-not $Protection -and $Classification -like 'Artefact recréable*')
        }
    }
}

$FileResults = foreach ($File in $Files) {
    if ([int64]$File.Length -ge $MinimumSizeBytes) {
        $Protection = Get-ProtectionReason -FullPath $File.FullName
        [PSCustomObject]@{
            Type = 'Fichier'; Path = $File.FullName; TailleGB = [math]::Round($File.Length / 1GB, 2); TailleMB = [math]::Round($File.Length / 1MB, 0)
            Classification = Get-Classification -FullPath $File.FullName -IsDirectory $false; Protege = [bool]$Protection; MotifProtection = $Protection
            SelectionPossible = [bool](-not $Protection)
        }
    }
}

$Results = @($DirectoryResults) + @($FileResults) | Sort-Object TailleGB -Descending
$ReportResults = @($Results | Select-Object -First $Top)
if ($ReportResults.Count -eq 0) { Write-Warning 'Aucun élément ne correspond à la taille minimale.' }
else { $ReportResults | Format-Table Type,TailleGB,Classification,Protege,Path -AutoSize }

# Exporter les objets non formatés conserve des colonnes exploitables dans Excel et HTML.
if ($ReportFormat -in @('csv', 'both')) {
    $CsvPath = "$ReportBase.csv"
    $ReportResults | Export-Csv -LiteralPath $CsvPath -UseCulture -NoTypeInformation -Encoding UTF8
    Write-Host "CSV créé : $CsvPath" -ForegroundColor Green
}
if ($ReportFormat -in @('html', 'both')) {
    $HtmlPath = "$ReportBase.html"
    $Css = '<style>body{font-family:Segoe UI,Arial;margin:2rem} table{border-collapse:collapse} th,td{border:1px solid #bbb;padding:.4rem;text-align:left} th{background:#eee}</style>'
    $ReportResults | ConvertTo-Html -Title 'KJEMO — Analyse de disque' -Head $Css -PreContent "<h1>Analyse de $TargetResolved</h1><p>Généré le $(Get-Date)</p>" | Out-File -LiteralPath $HtmlPath -Encoding UTF8
    Write-Host "HTML créé : $HtmlPath" -ForegroundColor Green
}

if ($AllowRecycleSelection -and $ReportResults.Count -gt 0) {
    $Candidates = @($ReportResults | Where-Object { $_.SelectionPossible -eq $true })
    $CandidateFolders = @($Candidates | Where-Object { $_.Type -eq 'Dossier' })
    $Candidates = @($Candidates | Where-Object {
        $CurrentCandidate = $_
        $CurrentCandidate.Type -eq 'Dossier' -or -not ($CandidateFolders | Where-Object { Test-PathWithin -Path $CurrentCandidate.Path -Root $_.Path })
    })
    if ($Candidates.Count -eq 0) { Write-Host 'Aucun candidat non protégé n''est proposé pour la corbeille.' -ForegroundColor Yellow }
    else {
        Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction Stop
        Write-Host ''
        Write-Host 'Candidats proposés (les éléments protégés sont exclus) :' -ForegroundColor Yellow
        for ($Index = 0; $Index -lt $Candidates.Count; $Index++) {
            Write-Host ("[{0}] {1} — {2} Go — {3}" -f ($Index + 1), $Candidates[$Index].Type, $Candidates[$Index].TailleGB, $Candidates[$Index].Path)
        }
        $Confirmation = Read-Host "Pour continuer, tape exactement CONFIRMER; toute autre réponse annule"
        if ($Confirmation -cne 'CONFIRMER') { Write-Host 'Opération annulée : aucun élément déplacé.' -ForegroundColor Cyan }
        else {
            $Selection = Read-Host 'Numéros à envoyer à la corbeille, séparés par des virgules (exemple : 1,3)'
            $Indexes = $Selection -split '[,; ]+' | ForEach-Object { $Parsed = 0; if ([int]::TryParse($_, [ref]$Parsed)) { $Parsed } }
            foreach ($Number in $Indexes) {
                if ($Number -lt 1 -or $Number -gt $Candidates.Count) { Write-Warning "Numéro ignoré : $Number"; continue }
                $Candidate = $Candidates[$Number - 1]
                try {
                    if ($Candidate.Type -eq 'Dossier') {
                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
                    }
                    else {
                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
                    }
                    Write-Host "Envoyé à la corbeille : $($Candidate.Path)" -ForegroundColor Green
                }
                catch { Write-Warning "Échec pour $($Candidate.Path) : $($_.Exception.Message)" }
            }
        }
    }
}

Write-Host ''
Write-Host "Terminé. Les rapports restent sur le Bureau; vérifie-les avant toute autre action." -ForegroundColor Cyan