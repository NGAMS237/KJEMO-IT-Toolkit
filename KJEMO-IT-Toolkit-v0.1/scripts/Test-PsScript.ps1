# Test-PsScript.ps1 — LOT 0 · KJEMO IT Toolkit
# Vérifie la syntaxe PowerShell d'un fichier .ps1 sans l'exécuter.
# Usage : powershell.exe -File .\scripts\Test-PsScript.ps1 -Path <chemin.ps1>
# Exit 0 = OK, exit 1 = erreur de parsing.

param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "Fichier introuvable : $Path"
    exit 1
}

$Tokens      = $null
$ParseErrors = $null

[void][System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path -LiteralPath $Path).ProviderPath,
    [ref]$Tokens,
    [ref]$ParseErrors
)

if ($ParseErrors.Count -gt 0) {
    Write-Host "[ECHEC] $Path" -ForegroundColor Red
    foreach ($Err in $ParseErrors) {
        Write-Host ("  Ligne {0}, col {1} : {2}" -f `
            $Err.Extent.StartLineNumber, `
            $Err.Extent.StartColumnNumber, `
            $Err.Message) -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "[OK]    $Path" -ForegroundColor Green
    exit 0
}
