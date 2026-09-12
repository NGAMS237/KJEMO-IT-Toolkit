# Test-PS-Roundtrip-v2.ps1 — LOT 0 · KJEMO IT Toolkit
# =============================================================================
# VRAI test aller-retour  JS → .ps1 (BOM) → PowerShell → JSON → JS
#
# Chaîne exacte :
#   1. node test/roundtrip.mjs emit <dir>
#        → importe dist/generators.mjs, appelle psB64() sur chaque valeur,
#          écrit <dir>\roundtrip.ps1 AVEC BOM UTF-8 (EF BB BF)
#          et <dir>\roundtrip-expected.json
#   2. Ce script vérifie que roundtrip.ps1 commence bien par EF BB BF
#   3. L'interpréteur PowerShell courant EXÉCUTE roundtrip.ps1
#        → décode les expressions Base64 produites par Node et écrit
#          <dir>\roundtrip-actual.json (UTF-8 sans BOM)
#   4. node test/roundtrip.mjs verify <dir>
#        → compare octet par octet ; échoue si O’Brien (U+2019) devient O'Brien
#
# AUCUN Base64 n'est calculé dans PowerShell : PS ne fait que décoder ce que
# Node a produit. C'est ce qui rend le test non tautologique.
#
# S'exécute sous PS 5.1 (powershell.exe) et PS 7 (pwsh).
# Exit 0 = tout OK, exit 1 = au moins un ÉCHEC.
#
# Prérequis : Node.js >= 20 dans le PATH.
#
# Usage :
#   powershell.exe -File .\scripts\Test-PS-Roundtrip-v2.ps1
#   pwsh           -File .\scripts\Test-PS-Roundtrip-v2.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$PSMajor = $PSVersionTable.PSVersion.Major
Write-Host "=== Aller-retour Unicode réel — PowerShell $($PSVersionTable.PSVersion) ==="

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$WorkDir = Join-Path $RootDir 'test\generated\roundtrip'

$Ps1Path      = Join-Path $WorkDir 'roundtrip.ps1'
$ActualPath   = Join-Path $WorkDir 'roundtrip-actual.json'

# ---------------------------------------------------------------------------
# 0. Node.js disponible ?
# ---------------------------------------------------------------------------
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Host "[FAIL] Node.js introuvable dans le PATH." -ForegroundColor Red
    exit 1
}
$DistGen = Join-Path $RootDir 'dist\generators.mjs'
if (-not (Test-Path $DistGen)) {
    Write-Host "[FAIL] dist/generators.mjs introuvable : $DistGen" -ForegroundColor Red
    exit 1
}

# Repartir d'un état propre
if (Test-Path $ActualPath) { Remove-Item $ActualPath -Force }

# ---------------------------------------------------------------------------
# 1. Node génère le .ps1 avec BOM (c'est Node qui appelle psB64())
# ---------------------------------------------------------------------------
Write-Host "`n--- 1. Génération du .ps1 par Node (psB64 depuis dist/generators.mjs) ---"
Push-Location $RootDir
try {
    & node 'test/roundtrip.mjs' 'emit' $WorkDir
    $EmitExit = $LASTEXITCODE
} finally {
    Pop-Location
}
if ($EmitExit -ne 0) {
    Write-Host "[FAIL] node test/roundtrip.mjs emit a échoué (code $EmitExit)." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $Ps1Path)) {
    Write-Host "[FAIL] $Ps1Path absent après la génération." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Vérifier le BOM UTF-8 (EF BB BF) sur le fichier produit par Node
# ---------------------------------------------------------------------------
Write-Host "`n--- 2. Vérification du BOM UTF-8 ---"
$FirstBytes = [System.IO.File]::ReadAllBytes($Ps1Path)[0..2]
$HexBytes = ($FirstBytes | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
if ($FirstBytes[0] -eq 0xEF -and $FirstBytes[1] -eq 0xBB -and $FirstBytes[2] -eq 0xBF) {
    Write-Host "  [OK]   BOM présent : $HexBytes" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] BOM absent — premiers octets : $HexBytes" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 3. PowerShell EXÉCUTE le .ps1 produit par Node
# ---------------------------------------------------------------------------
Write-Host "`n--- 3. Exécution du .ps1 par PowerShell $PSMajor ---"
if ($PSMajor -ge 6) {
    & pwsh -NoProfile -ExecutionPolicy Bypass -File $Ps1Path $ActualPath
} else {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Ps1Path $ActualPath
}
$RunExit = $LASTEXITCODE
if ($RunExit -ne 0) {
    Write-Host "[FAIL] L'exécution de roundtrip.ps1 a échoué (code $RunExit)." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $ActualPath)) {
    Write-Host "[FAIL] $ActualPath absent après l'exécution." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 4. Contrôle lisible côté PowerShell : O’Brien (U+2019) doit rester U+2019
#    (lecture du JSON écrit par PS, comparaison avec les valeurs attendues
#     fournies par Node — aucun Base64 recalculé ici)
# ---------------------------------------------------------------------------
Write-Host "`n--- 4. Contrôle O’Brien côté PowerShell ---"
$ExpectedJson = [System.IO.File]::ReadAllText((Join-Path $WorkDir 'roundtrip-expected.json'), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$ActualJson   = [System.IO.File]::ReadAllText($ActualPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$PsErrors = 0

function Compare-Case {
    param([string]$Key, [string]$Label)
    $exp = [string]$ExpectedJson.$Key
    $act = [string]$ActualJson.$Key
    if ($exp -ceq $act) {
        Write-Host "  [OK]   $Key — $Label" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $Key — $Label" -ForegroundColor Red
        $expHex = ([System.Text.Encoding]::UTF8.GetBytes($exp) | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
        $actHex = ([System.Text.Encoding]::UTF8.GetBytes($act) | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
        Write-Host "         attendu : $expHex"
        Write-Host "         obtenu  : $actHex"
        $script:PsErrors++
    }
}

# NOTE IMPORTANTE (constat réel, PowerShell 7.4.6) :
# PowerShell traite U+2018 et U+2019 comme des DÉLIMITEURS de chaîne, au même
# titre que U+0027. Écrire 'O<U+2019>Brien' dans un script PS termine la chaîne
# de façon prématurée et provoque une erreur d'analyse.
# C'est exactement la raison pour laquelle psB64() est indispensable : les valeurs
# utilisateur ne sont JAMAIS insérées littéralement dans une chaîne PS.
# Les libellés ci-dessous restent donc en ASCII pur.
Compare-Case -Key 'case01' -Label "O[U+0027]Brien - apostrophe ASCII"
Compare-Case -Key 'case02' -Label "O[U+2019]Brien - apostrophe typographique droite"
Compare-Case -Key 'case03' -Label "O[U+2018]Brien - apostrophe typographique gauche"
Compare-Case -Key 'case04' -Label "L'ete d'Andre - accents + apostrophes ASCII"

# Garde-fou : U+2019 ne doit JAMAIS devenir U+0027
$Typo = [string]$ActualJson.case02
$AsciiExpected = "O" + [char]0x27 + "Brien"
if ($Typo -ceq $AsciiExpected) {
    Write-Host "  [FAIL] O’Brien (U+2019) a été transformé en O'Brien (U+0027)" -ForegroundColor Red
    $PsErrors++
} else {
    Write-Host "  [OK]   U+2019 n'a PAS été converti en U+0027" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 5. Vérification autoritaire octet par octet par Node
# ---------------------------------------------------------------------------
Write-Host "`n--- 5. Vérification octet par octet (Node) ---"
Push-Location $RootDir
try {
    & node 'test/roundtrip.mjs' 'verify' $WorkDir
    $VerifyExit = $LASTEXITCODE
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------------------
Write-Host ''
if ($PsErrors -eq 0 -and $VerifyExit -eq 0) {
    Write-Host "Aller-retour Unicode PS$PSMajor : TOUS LES TESTS OK." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Aller-retour Unicode PS$PSMajor : ECHEC (PS=$PsErrors, Node=$VerifyExit)." -ForegroundColor Red
    exit 1
}
