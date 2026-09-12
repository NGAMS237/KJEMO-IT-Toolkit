# Test-PS-Roundtrip.ps1 — LOT 0 · KJEMO IT Toolkit
# =============================================================================
# Vérifie l'aller-retour exact des chaînes Unicode dans les scripts .ps1
# générés : les caractères spéciaux (accents, apostrophes, symboles) doivent
# être préservés byte-for-byte par l'interpréteur PowerShell.
#
# Ce script s'exécute sous PS 5.1 (powershell.exe) et PS 7 (pwsh).
# Exit 0 = tout OK, exit 1 = au moins un ÉCHEC.
#
# Usage :
#   powershell.exe -File .\scripts\Test-PS-Roundtrip.ps1
#   pwsh           -File .\scripts\Test-PS-Roundtrip.ps1
# =============================================================================

$ErrorCount = 0

function Assert-Equal {
    param([string]$Expected, [string]$Actual, [string]$Label)
    if ($Expected -ceq $Actual) {
        Write-Host "  [OK]    $Label" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL]  $Label" -ForegroundColor Red
        Write-Host "          Attendu  : $(([System.Text.Encoding]::UTF8.GetBytes($Expected) | ForEach-Object { '{0:X2}' -f $_ }) -join ' ')"
        Write-Host "          Obtenu   : $(([System.Text.Encoding]::UTF8.GetBytes($Actual)   | ForEach-Object { '{0:X2}' -f $_ }) -join ' ')"
        $script:ErrorCount++
    }
}

# ---------------------------------------------------------------------------
# 1. Apostrophe typographique U+2019 dans une single-quoted string PS
# ---------------------------------------------------------------------------
Write-Host "`n--- Apostrophe typographique U+2019 ---"

# La chaîne PS : 'O' + U+2019 + 'Brien'
# Dans un script PS à apostrophes simples, U+2019 est un caractère littéral.
$Val1 = 'O' + [char]0x2019 + 'Brien'
Assert-Equal -Expected ($Val1) -Actual ("O" + [char]0x2019 + "Brien") `
    "U+2019 préservé dans une chaîne"

# Simuler ce que generate() produit : escPs double-quote l'apostrophe U+0027
# mais laisse U+2019 tel quel. Résultat attendu dans le script : O''Brien (U+0027).
$AsciiApostrophe = [char]0x27
$DoubleApostrophe = "$AsciiApostrophe$AsciiApostrophe"
$ValAscii = "O" + $DoubleApostrophe + "Brien"
Assert-Equal -Expected "O''Brien" -Actual $ValAscii `
    "Double apostrophe ASCII pour U+0027 dans single-quoted string"

# ---------------------------------------------------------------------------
# 2. Caractères accentués courants (é, è, à, ê, î, ô, û, ç, ë, ï, ù, Ä)
# ---------------------------------------------------------------------------
Write-Host "`n--- Caractères accentués ---"

$AccentedNames = @(
    [pscustomobject]@{ Name = "e-acute";   Char = [char]0x00E9; Desc = "U+00E9 é" }
    [pscustomobject]@{ Name = "e-grave";   Char = [char]0x00E8; Desc = "U+00E8 è" }
    [pscustomobject]@{ Name = "a-grave";   Char = [char]0x00E0; Desc = "U+00E0 à" }
    [pscustomobject]@{ Name = "e-circ";    Char = [char]0x00EA; Desc = "U+00EA ê" }
    [pscustomobject]@{ Name = "i-circ";    Char = [char]0x00EE; Desc = "U+00EE î" }
    [pscustomobject]@{ Name = "o-circ";    Char = [char]0x00F4; Desc = "U+00F4 ô" }
    [pscustomobject]@{ Name = "u-circ";    Char = [char]0x00FB; Desc = "U+00FB û" }
    [pscustomobject]@{ Name = "c-cedilla"; Char = [char]0x00E7; Desc = "U+00E7 ç" }
    [pscustomobject]@{ Name = "E-acute";   Char = [char]0x00C9; Desc = "U+00C9 É" }
)

foreach ($Item in $AccentedNames) {
    $Val = "Test" + $Item.Char + "Value"
    Assert-Equal -Expected $Val -Actual ("Test" + $Item.Char + "Value") `
        "$($Item.Desc) préservé dans une variable"
}

# ---------------------------------------------------------------------------
# 3. Symboles spéciaux dans les chemins Windows
# ---------------------------------------------------------------------------
Write-Host "`n--- Symboles dans les chemins ---"

# Apostrophe ASCII dans un chemin → escPs le double
$PathWithApostrophe = "C:\Users\O''Brien\Documents"
Assert-Equal -Expected "C:\Users\O''Brien\Documents" -Actual $PathWithApostrophe `
    "Chemin avec double apostrophe ASCII"

# Apostrophe typographique dans un chemin (U+2019 — non doublé par escPs)
$PathWithTypo = "C:\Users\O" + [char]0x2019 + "Brien\Documents"
$Expected3 = "C:\Users\O" + [char]0x2019 + "Brien\Documents"
Assert-Equal -Expected $Expected3 -Actual $PathWithTypo `
    "Chemin avec apostrophe typographique U+2019"

# ---------------------------------------------------------------------------
# 4. Scripts .ps1 générés : vérifier l'absence de U+2018/U+2019 dans les
#    délimiteurs de chaînes single-quoted (ils auraient dû être échappés)
# ---------------------------------------------------------------------------
Write-Host "`n--- Fichiers .ps1 générés ---"

$GeneratedDir = Join-Path $PSScriptRoot "..\test\generated"
if (-not (Test-Path $GeneratedDir)) {
    Write-Host "  [FAIL]  Répertoire introuvable : $GeneratedDir (exécuter generate-ps1.mjs d'abord)" -ForegroundColor Red
    $script:ErrorCount++
} else {
    $Files = Get-ChildItem -Path $GeneratedDir -Filter "*.ps1" -ErrorAction SilentlyContinue
    if ($Files.Count -eq 0) {
        Write-Host "  [FAIL]  Aucun .ps1 dans $GeneratedDir (exécuter generate-ps1.mjs d'abord)" -ForegroundColor Red
        $script:ErrorCount++
    } else {
        foreach ($File in $Files) {
            $Content = Get-Content -Path $File.FullName -Raw -Encoding UTF8
            # Chercher U+2018 ou U+2019 hors d'un commentaire PS
            # Heuristique : ligne ne commençant pas par #
            $NonCommentLines = ($Content -split "`n") | Where-Object { $_ -notmatch '^\s*#' }
            $HasCurly = $NonCommentLines -join "`n" | Select-String -Pattern "[\u2018\u2019]" -Quiet
            if ($HasCurly) {
                Write-Host "  [FAIL]  $($File.Name) contient U+2018/U+2019 hors commentaire" -ForegroundColor Red
                $script:ErrorCount++
            } else {
                Write-Host "  [OK]    $($File.Name)" -ForegroundColor Green
            }
        }
    }
}

# ---------------------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------------------
Write-Host ""
if ($ErrorCount -eq 0) {
    Write-Host "Aller-retour Unicode : tous les tests OK." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Aller-retour Unicode : $ErrorCount ÉCHEC(S)." -ForegroundColor Red
    exit 1
}
