# Test-PS-Roundtrip-v2.ps1 — LOT 0 · KJEMO IT Toolkit
# =============================================================================
# Vrai test aller-retour JS → PS1 → PowerShell
#
# Principe :
#   1. Génère un .ps1 avec BOM via Node.js (psB64 encode toutes les valeurs)
#   2. PowerShell exécute ce .ps1 pour affecter les variables
#   3. PowerShell exporte les valeurs en JSON (UTF-8)
#   4. Comparaison byte-for-byte avec les valeurs d'origine (UTF-8)
#
# Ce script s'exécute sous PS 5.1 (powershell.exe) et PS 7 (pwsh).
# Exit 0 = tout OK, exit 1 = au moins un ÉCHEC.
#
# Prérequis : Node.js installé, npm ci exécuté
#
# Usage :
#   powershell.exe -File .\scripts\Test-PS-Roundtrip-v2.ps1
#   pwsh           -File .\scripts\Test-PS-Roundtrip-v2.ps1
# =============================================================================

$ErrorCount = 0
$PSVersion = $PSVersionTable.PSVersion.Major
Write-Host "PowerShell $PSVersion — Test aller-retour Unicode"

function Assert-Equal {
    param([string]$Expected, [string]$Actual, [string]$Label)
    if ($Expected -ceq $Actual) {
        Write-Host "  [OK]    $Label" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL]  $Label" -ForegroundColor Red
        $expBytes = ([System.Text.Encoding]::UTF8.GetBytes($Expected) | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
        $actBytes = ([System.Text.Encoding]::UTF8.GetBytes($Actual)   | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
        Write-Host "          Attendu  (UTF-8) : $expBytes"
        Write-Host "          Obtenu   (UTF-8) : $actBytes"
        $script:ErrorCount++
    }
}

# ---------------------------------------------------------------------------
# 1. Vérifier que Node.js est disponible
# ---------------------------------------------------------------------------
$NodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodePath) {
    Write-Host "[FAIL] Node.js introuvable — impossible d'exécuter le test aller-retour" -ForegroundColor Red
    exit 1
}

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistGen  = Join-Path $RootDir "dist\generators.mjs"
if (-not (Test-Path $DistGen)) {
    Write-Host "[FAIL] dist/generators.mjs introuvable" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Jeux de valeurs à tester
# ---------------------------------------------------------------------------
$TestCases = @(
    @{ Label = "Apostrophe ASCII U+0027";      Value = "O'Brien" }
    @{ Label = "Apostrophe typo U+2019";       Value = "O" + [char]0x2019 + "Brien" }
    @{ Label = "Apostrophe gauche U+2018";     Value = "O" + [char]0x2018 + "Brien" }
    @{ Label = "Été d'André (accents + apo)";  Value = "L'" + [char]0x00E9 + "t" + [char]0x00E9 + " d'Andr" + [char]0x00E9 }
    @{ Label = "Dollar";                       Value = '$SYSTEM_VARIABLE' }
    @{ Label = "Backtick";                     Value = "test`back`tick" }
    @{ Label = "Guillemet double";             Value = 'Say "hello"' }
    @{ Label = "Chemin UNC simulé (backslash)"; Value = 'C:\Users\O''Brien\Documents' }
    @{ Label = "Retour à la ligne";            Value = "line1`nline2" }
    @{ Label = "OU LDAP virgule";              Value = "Finance, Nord" }
    @{ Label = "OU LDAP plus";                 Value = "Direction + Ops" }
)

# ---------------------------------------------------------------------------
# 3. Pour chaque valeur, générer un .ps1 minimal via Node.js, l'exécuter,
#    récupérer le résultat en JSON, comparer byte-for-byte
# ---------------------------------------------------------------------------
$TmpDir = [System.IO.Path]::GetTempPath()

foreach ($tc in $TestCases) {
    $Label = $tc.Label
    $OrigVal = $tc.Value

    # Encoder la valeur en Base64 UTF-8 (même algorithme que psB64 côté JS)
    $OrigBytes = [System.Text.Encoding]::UTF8.GetBytes($OrigVal)
    $B64 = [Convert]::ToBase64String($OrigBytes)

    # Construire un .ps1 minimal avec BOM
    $ScriptContent = @"
`$TestValue = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$B64'))
`$OutFile = '$($TmpDir.Replace('\','\\'))roundtrip-result.json'
`$json = ConvertTo-Json `$TestValue -Compress
[System.IO.File]::WriteAllText(`$OutFile, `$json, [System.Text.Encoding]::UTF8)
"@
    $ScriptFile = Join-Path $TmpDir "roundtrip-test.ps1"
    $ResultFile = Join-Path $TmpDir "roundtrip-result.json"

    # Écrire le .ps1 avec BOM UTF-8
    $BOM = [byte[]](0xEF, 0xBB, 0xBF)
    $ScriptBytes = [System.Text.Encoding]::UTF8.GetBytes($ScriptContent)
    $WithBOM = $BOM + $ScriptBytes
    [System.IO.File]::WriteAllBytes($ScriptFile, $WithBOM)

    # Supprimer le résultat précédent
    if (Test-Path $ResultFile) { Remove-Item $ResultFile -Force }

    # Exécuter le .ps1 avec le MÊME interpréteur PS que celui qui exécute ce script
    try {
        if ($PSVersion -ge 6) {
            & pwsh -File $ScriptFile 2>&1 | Out-Null
        } else {
            & powershell.exe -File $ScriptFile 2>&1 | Out-Null
        }
    } catch {
        Write-Host "  [FAIL]  $Label — erreur exécution PS : $_" -ForegroundColor Red
        $script:ErrorCount++
        continue
    }

    if (-not (Test-Path $ResultFile)) {
        Write-Host "  [FAIL]  $Label — fichier résultat absent" -ForegroundColor Red
        $script:ErrorCount++
        continue
    }

    # Lire le résultat JSON (UTF-8 sans BOM)
    $JsonContent = [System.IO.File]::ReadAllText($ResultFile, [System.Text.Encoding]::UTF8)
    try {
        $ActualVal = $JsonContent | ConvertFrom-Json
    } catch {
        Write-Host "  [FAIL]  $Label — JSON invalide : $JsonContent" -ForegroundColor Red
        $script:ErrorCount++
        continue
    }

    Assert-Equal -Expected $OrigVal -Actual $ActualVal -Label $Label
}

# ---------------------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------------------
Write-Host ""
if ($ErrorCount -eq 0) {
    Write-Host "Aller-retour Unicode PS$PSVersion : tous les tests OK." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Aller-retour Unicode PS$PSVersion : $ErrorCount ECHEC(S)." -ForegroundColor Red
    exit 1
}
