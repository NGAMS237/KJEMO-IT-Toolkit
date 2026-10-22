// ===========================================================================
// LOT 9 — Imprimantes : banc d'exécution avec DOUBLES
//
// CE QUE CE BANC EST, ET CE QU'IL N'EST PAS
//
// Il EXÉCUTE les scripts PowerShell générés avec PowerShell 7 sous Linux. Les
// cmdlets du module PrintManagement n'existent pas ici : ils sont remplacés par
// des DOUBLES — des fonctions PowerShell qui enregistrent chaque appel (nom,
// paramètres, présence de -WhatIf) et répondent selon un scénario déclaré.
//
// Ce que cela prouve : la LOGIQUE des scripts — quels appels ils font, dans
// quel ordre, dans quel mode, avec quelle confirmation, et ce qu'ils concluent
// quand une lecture échoue.
// Ce que cela NE prouve PAS : le comportement des vrais cmdlets, de Windows
// PowerShell 5.1, du spouleur ou d'une imprimante réelle. Un double n'est pas
// une imprimante. Ce banc ne remplace pas les trois travaux pratiques (non
// exécutés) de docs/labs-imprimantes/.
//
// Deux fonctions du script sont remplacées pour le banc, et elles seulement :
//   - Test-KjemoAdmin / Get-KjemoCompte : pas de console Windows ici ;
//   - Test-KjemoTcp : pas de vraie imprimante à joindre.
// Le remplacement se fait en INSÉRANT une redéfinition à un marqueur unique du
// script ; une contre-épreuve vérifie que le marqueur existe EXACTEMENT une
// fois, de sorte qu'un script modifié ne passe pas silencieusement.
// ===========================================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const MARQUEUR_INSERTION = '# --- Valeurs declarees dans le formulaire (jamais devinees) ---';

/** Cmdlets qui MODIFIENT l'état (sans -WhatIf) : leur appel est une écriture. */
export const CMDLETS_MODIFIANTS = [
  'Add-Printer', 'Add-PrinterPort', 'Remove-Printer', 'Remove-PrinterPort', 'Remove-PrinterDriver',
  'Remove-PrintJob', 'Restart-Service', 'Start-Service', 'Stop-Service', 'Set-Service',
  'Invoke-CimMethod', 'Set-Printer', 'Set-PrintConfiguration', 'Set-ItemProperty', 'Remove-Item',
  'Clear-Content', 'Rename-Item', 'New-Item',
];

/** Préambule : les doubles. Aucune dépendance à Windows. */
export const PREAMBULE_DOUBLES = String.raw`
$global:KjemoScenario = @{}
if ($env:KJEMO_SCENARIO) { $global:KjemoScenario = ConvertFrom-Json -InputObject $env:KJEMO_SCENARIO -AsHashtable }
function Get-S { param($Cle, $Defaut) if ($global:KjemoScenario.ContainsKey($Cle)) { return $global:KjemoScenario[$Cle] } return $Defaut }
$global:DblImprimantes = [System.Collections.ArrayList]@()
foreach ($p in @(Get-S 'printers' @())) { [void]$global:DblImprimantes.Add([pscustomobject]$p) }
$global:DblTravaux = [System.Collections.ArrayList]@()
foreach ($j in @(Get-S 'jobs' @())) { [void]$global:DblTravaux.Add([pscustomobject]$j) }
$global:DblPorts = [System.Collections.ArrayList]@()
foreach ($p in @(Get-S 'ports' @())) { [void]$global:DblPorts.Add([pscustomobject]$p) }
$global:DblPilotes = [System.Collections.ArrayList]@()
foreach ($p in @(Get-S 'drivers' @())) { [void]$global:DblPilotes.Add([pscustomobject]$p) }
$global:DblSpooler = [pscustomobject](Get-S 'service' @{ Name = 'Spooler'; Status = 'Running'; StartType = 'Automatic'; DependentServices = @() })
$global:DblDefaut = [string](Get-S 'defaultPrinter' '')

function Write-Appel {
  param([string]$Nom, [System.Collections.IDictionary]$Params, [bool]$Simulation)
  $a = @{}
  foreach ($k in $Params.Keys) { $a[$k] = [string]$Params[$k] }
  $ligne = ConvertTo-Json -Compress -InputObject @{ cmd = $Nom; args = $a; whatif = $Simulation }
  # -WhatIf:$false : $WhatIfPreference se propage aux commandes appelees, et un
  # Add-Content sous -WhatIf n ecrirait rien - le banc serait aveugle aux simulations.
  Add-Content -LiteralPath $env:KJEMO_LOG -Value $ligne -WhatIf:$false
}
function Test-Erreur {
  param([string]$Nom)
  $e = Get-S 'errors' @{}
  if ($e.ContainsKey($Nom)) { throw [System.Exception]::new([string]$e[$Nom]) }
}
function Get-Printer {
  [CmdletBinding()] param([string]$Name, [string]$ComputerName)
  Write-Appel 'Get-Printer' $PSBoundParameters $false
  Test-Erreur 'Get-Printer'
  if ($ComputerName) { Test-Erreur 'Get-Printer-distant'; return @(Get-S 'remotePrinters' @() | ForEach-Object { [pscustomobject]$_ }) }
  return @($global:DblImprimantes)
}
function Get-PrintJob {
  [CmdletBinding()] param([string]$PrinterName, [string]$ComputerName)
  Write-Appel 'Get-PrintJob' $PSBoundParameters $false
  Test-Erreur 'Get-PrintJob'
  return @($global:DblTravaux | Where-Object { [string]$_.PrinterName -ieq $PrinterName })
}
function Get-PrinterPort { [CmdletBinding()] param() Write-Appel 'Get-PrinterPort' $PSBoundParameters $false; Test-Erreur 'Get-PrinterPort'; return @($global:DblPorts) }
function Get-PrinterDriver { [CmdletBinding()] param() Write-Appel 'Get-PrinterDriver' $PSBoundParameters $false; Test-Erreur 'Get-PrinterDriver'; return @($global:DblPilotes) }
function Get-Service {
  [CmdletBinding()] param([string]$Name)
  Write-Appel 'Get-Service' $PSBoundParameters $false
  Test-Erreur 'Get-Service'
  return $global:DblSpooler
}
function Get-WinEvent { [CmdletBinding()] param($FilterHashtable, $MaxEvents) Write-Appel 'Get-WinEvent' @{} $false; Test-Erreur 'Get-WinEvent'; return @(Get-S 'events' @() | ForEach-Object { [pscustomobject]$_ }) }
function Get-ChildItem { [CmdletBinding()] param($LiteralPath, [switch]$File) Write-Appel 'Get-ChildItem' $PSBoundParameters $false; Test-Erreur 'Get-ChildItem'; return @(Get-S 'spoolFiles' @() | ForEach-Object { [pscustomobject]$_ }) }
function Get-ItemProperty {
  [CmdletBinding()] param($Path, $Name)
  Write-Appel 'Get-ItemProperty' $PSBoundParameters $false
  Test-Erreur 'Get-ItemProperty'
  $o = [pscustomobject]@{}
  $o | Add-Member -NotePropertyName ([string]$Name) -NotePropertyValue (Get-S 'registry' 'C:\Windows\System32\spool\PRINTERS') -Force
  return $o
}
function Get-CimInstance {
  [CmdletBinding()] param($ClassName)
  Write-Appel 'Get-CimInstance' $PSBoundParameters $false
  Test-Erreur 'Get-CimInstance'
  return @($global:DblImprimantes | ForEach-Object {
    [pscustomobject]@{ Name = $_.Name; Default = ([string]$_.Name -ieq $global:DblDefaut); PrinterStatus = 3; WorkOffline = $false; Local = $true; Network = $false }
  })
}
function Invoke-CimMethod {
  [CmdletBinding()] param($InputObject, [string]$MethodName)
  Write-Appel 'Invoke-CimMethod' @{ MethodName = $MethodName; Cible = [string]$InputObject.Name } $false
  Test-Erreur 'Invoke-CimMethod'
  if ($MethodName -eq 'SetDefaultPrinter' -and -not (Get-S 'noEffect' @{}).ContainsKey('SetDefaultPrinter')) { $global:DblDefaut = [string]$InputObject.Name }
  if ($MethodName -eq 'PrintTestPage' -and -not (Get-S 'noEffect' @{}).ContainsKey('PrintTestPage')) {
    [void]$global:DblTravaux.Add([pscustomobject]@{ ID = 900; PrinterName = [string]$InputObject.Name; JobStatus = 'Spooling'; UserName = 'labo'; DocumentName = 'Page de test'; TotalPages = 1 })
  }
  $rv = 0
  if ((Get-S 'cimReturn' @{}).ContainsKey($MethodName)) { $rv = [int](Get-S 'cimReturn' @{})[$MethodName] }
  return [pscustomobject]@{ ReturnValue = $rv }
}
function Remove-PrintJob {
  [CmdletBinding(SupportsShouldProcess = $true)] param([string]$PrinterName, [int]$ID)
  Write-Appel 'Remove-PrintJob' $PSBoundParameters ([bool]$WhatIfPreference)
  if ($WhatIfPreference) { return }
  Test-Erreur 'Remove-PrintJob'
  if (-not (Get-S 'noEffect' @{}).ContainsKey('Remove-PrintJob')) {
    $reste = @($global:DblTravaux | Where-Object { -not ([string]$_.PrinterName -ieq $PrinterName -and [int]$_.ID -eq $ID) })
    $global:DblTravaux.Clear(); foreach ($r in $reste) { [void]$global:DblTravaux.Add($r) }
  }
}
function Add-PrinterPort {
  [CmdletBinding(SupportsShouldProcess = $true)] param([string]$Name, [string]$PrinterHostAddress, [int]$PortNumber)
  Write-Appel 'Add-PrinterPort' $PSBoundParameters ([bool]$WhatIfPreference)
  if ($WhatIfPreference) { return }
  Test-Erreur 'Add-PrinterPort'
  if (-not (Get-S 'noEffect' @{}).ContainsKey('Add-PrinterPort')) {
    [void]$global:DblPorts.Add([pscustomobject]@{ Name = $Name; PrinterHostAddress = $PrinterHostAddress; PortNumber = $PortNumber })
  }
}
function Add-Printer {
  [CmdletBinding(SupportsShouldProcess = $true)] param([string]$Name, [string]$DriverName, [string]$PortName, [string]$ConnectionName)
  Write-Appel 'Add-Printer' $PSBoundParameters ([bool]$WhatIfPreference)
  if ($WhatIfPreference) { return }
  Test-Erreur 'Add-Printer'
  if (-not (Get-S 'noEffect' @{}).ContainsKey('Add-Printer')) {
    $n = $Name
    if ($ConnectionName) { $n = $ConnectionName }
    [void]$global:DblImprimantes.Add([pscustomobject]@{ Name = $n; DriverName = $DriverName; PortName = $PortName; Type = 'Local'; PrinterStatus = 'Normal' })
  }
}
function Restart-Service {
  [CmdletBinding(SupportsShouldProcess = $true)] param([string]$Name, [switch]$Force)
  Write-Appel 'Restart-Service' $PSBoundParameters ([bool]$WhatIfPreference)
  if ($WhatIfPreference) { return }
  Test-Erreur 'Restart-Service'
  if (-not (Get-S 'noEffect' @{}).ContainsKey('Restart-Service')) { $global:DblSpooler.Status = 'Running' } else { $global:DblSpooler.Status = 'Stopped' }
}
# Les appels qui NE DOIVENT JAMAIS arriver : les doubles les enregistrent comme
# tels pour que le banc les voie, au lieu de les laisser échouer en silence.
foreach ($interdit in @('Remove-Printer', 'Remove-PrinterPort', 'Remove-PrinterDriver', 'Set-Printer', 'Set-PrintConfiguration', 'Start-Service', 'Stop-Service', 'Set-Service', 'Remove-Item', 'Clear-Content', 'Set-ItemProperty', 'Rename-Item', 'New-Item')) {
  $corps = [scriptblock]::Create('param() Write-Appel ''' + $interdit + ''' @{} $false')
  Set-Item -Path ('function:global:' + $interdit) -Value $corps
}
function Start-Sleep { [CmdletBinding()] param($Seconds, $Milliseconds) }
`;

/** Redéfinitions insérées au marqueur : seules fonctions « de contexte » remplacées. */
export const REDEFINITIONS_CONTEXTE = String.raw`
function Test-KjemoAdmin { return [bool](Get-S 'admin' $true) }
function Get-KjemoCompte { return [string](Get-S 'user' 'KJEMO\labo') }
function Test-KjemoTcp {
  param([string]$Hote, [int]$Port, [int]$DelaiMs = 3000)
  Write-Appel 'Test-KjemoTcp' @{ Hote = $Hote; Port = $Port } $false
  return [string](Get-S 'tcp' 'OUVERT')
}
`;

/** Compose le script exécuté : préambule + script généré (marqueur remplacé). */
export function composerScript(scriptGenere, { sansRedefinitions = false } = {}) {
  const occurrences = scriptGenere.split(MARQUEUR_INSERTION).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Marqueur d'insertion trouvé ${occurrences} fois (1 attendue) : le banc refuse d'exécuter un script dont la structure a changé.`);
  }
  const corps = scriptGenere
    .replace(/^#Requires[^\n]*\n/, '')
    .replace(MARQUEUR_INSERTION, (sansRedefinitions ? '' : REDEFINITIONS_CONTEXTE) + '\n' + MARQUEUR_INSERTION);
  return `${PREAMBULE_DOUBLES}\n${corps}`;
}

/** Exécute un script généré avec pwsh et les doubles ; rend sortie, appels, conclusion. */
export function executer(scriptGenere, scenario = {}, options = {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'kjemo-imp-'));
  try {
    const fichier = join(dossier, 'script.ps1');
    const journal = join(dossier, 'appels.jsonl');
    writeFileSync(journal, '');
    writeFileSync(fichier, composerScript(scriptGenere, options), 'utf8');
    const r = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', fichier], {
      cwd: dossier,
      env: { ...process.env, KJEMO_SCENARIO: JSON.stringify(scenario), KJEMO_LOG: journal },
      encoding: 'utf8',
      timeout: options.delaiMs ?? 60000,
    });
    const appels = existsSync(journal)
      ? readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
    const sortie = r.stdout ?? '';
    const m = sortie.match(/^Conclusion : (.*)$/m);
    return {
      statut: r.status, sortie, erreur: r.stderr ?? '', appels,
      conclusion: m ? m[1] : null,
      modifiants: appels.filter((a) => CMDLETS_MODIFIANTS.includes(a.cmd) && !a.whatif),
      simulations: appels.filter((a) => CMDLETS_MODIFIANTS.includes(a.cmd) && a.whatif),
    };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** Mots que la conclusion d'un assistant d'impression ne doit jamais employer. */
export const MOTS_INTERDITS_CONCLUSION = [/\br[ée]par[ée]/i, /\bimprimante fonctionne\b/i, /\bimprime correctement\b/i, /\bproblème résolu\b/i, /\bprobleme resolu\b/i];

// ---------------------------------------------------------------------------
// Analyse par l'ARBRE SYNTAXIQUE de PowerShell
//
// Chercher « Remove-Printer » dans le texte d'un script se trompe dans les deux
// sens : une phrase d'explication le contient (faux positif), et un appel
// construit autrement passe (faux négatif). L'arbre syntaxique, lui, dit ce qui
// est APPELÉ : le nom de chaque commande et chaque paramètre passé. Les chaînes
// littérales et les commentaires n'y sont jamais des appels.
// ---------------------------------------------------------------------------
const SCRIPT_AST = `param([string]$F)
$tok = $null; $err = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($F, [ref]$tok, [ref]$err)
foreach ($c in $ast.FindAll({ param($a) $a -is [System.Management.Automation.Language.CommandAst] }, $true)) {
  $n = $c.GetCommandName()
  if (-not $n) { Write-Output ('DYN|' + $c.Extent.Text); continue }
  Write-Output ('C|' + $n)
  foreach ($e in $c.CommandElements) {
    if ($e -is [System.Management.Automation.Language.CommandParameterAst]) {
      $arg = ''
      if ($e.Argument) { $arg = $e.Argument.Extent.Text }
      Write-Output ('P|' + $n + '|' + $e.ParameterName + '|' + $arg)
    }
  }
}
Write-Output ('ERR|' + $err.Count)`;

/** Commandes appelées et paramètres passés, lus dans l'arbre syntaxique du script. */
export function analyserPs(scriptTexte) {
  const dossier = mkdtempSync(join(tmpdir(), 'kjemo-ast-'));
  try {
    const f = join(dossier, 's.ps1');
    const a = join(dossier, 'ast.ps1');
    writeFileSync(f, scriptTexte, 'utf8');
    writeFileSync(a, SCRIPT_AST, 'utf8');
    const r = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', a, f], { encoding: 'utf8', timeout: 60000 });
    const commandes = []; const parametres = []; const dynamiques = []; let erreurs = -1;
    for (const l of (r.stdout ?? '').split('\n').map((x) => x.replace(/\r$/, '')).filter(Boolean)) {
      const [t, ...reste] = l.split('|');
      if (t === 'C') commandes.push(reste.join('|'));
      else if (t === 'P') parametres.push({ cmd: reste[0], param: reste[1], arg: reste.slice(2).join('|') });
      else if (t === 'DYN') dynamiques.push(reste.join('|'));
      else if (t === 'ERR') erreurs = Number(reste[0]);
    }
    return { commandes, parametres, dynamiques, erreurs, uniques: [...new Set(commandes)] };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** Commandes dont l'appel est interdit à tout assistant Imprimantes (nom exact, casse ignorée). */
export const COMMANDES_PS_INTERDITES = [
  'Remove-Printer', 'Remove-PrinterPort', 'Remove-PrinterDriver', 'Set-Printer', 'Set-PrintConfiguration', 'Add-PrinterDriver',
  'pnputil', 'pnputil.exe', 'printui', 'printui.dll', 'rundll32', 'Invoke-WebRequest', 'Invoke-RestMethod', 'Start-BitsTransfer', 'curl', 'wget',
  'Invoke-Expression', 'iex', 'Stop-Service', 'Start-Service', 'Set-Service', 'Remove-Item', 'Clear-Content', 'del', 'rd', 'rmdir', 'erase',
  'net', 'net.exe', 'sc', 'sc.exe', 'cmdkey', 'New-PSDrive', 'ConvertTo-SecureString', 'Get-Credential', 'Set-ExecutionPolicy',
  'Restart-Computer', 'Stop-Computer', 'shutdown', 'Start-Process', 'Set-ItemProperty', 'New-ItemProperty', 'Remove-ItemProperty',
  'New-Item', 'Rename-Item', 'Move-Item', 'Copy-Item', 'Out-File', 'Add-Content', 'Register-ScheduledTask', 'Enable-PSRemoting', 'Invoke-Command',
];

/** Violations trouvées dans l'analyse d'un script (liste vide = rien à signaler). */
export function violationsPs(analyse) {
  const v = [];
  const interdites = COMMANDES_PS_INTERDITES.map((x) => x.toLowerCase());
  for (const c of analyse.uniques) if (interdites.includes(c.toLowerCase())) v.push(`commande interdite : ${c}`);
  for (const p of analyse.parametres) {
    if (/^force$/i.test(p.param)) v.push(`paramètre -Force sur ${p.cmd}`);
    if (/^confirm$/i.test(p.param) && /\$false/i.test(p.arg)) v.push(`-Confirm:$false sur ${p.cmd}`);
    if (/^name$/i.test(p.param) && /^get-printer$/i.test(p.cmd)) v.push('Get-Printer -Name (accepte les jokers)');
    if (/^whatif$/i.test(p.param) && !['add-printerport', 'remove-printjob', 'restart-service'].includes(p.cmd.toLowerCase())) v.push(`-WhatIf inventé sur ${p.cmd}`);
  }
  for (const d of analyse.dynamiques) if (!/^&\s*\$Action$/.test(d.trim())) v.push(`appel dynamique : ${d.slice(0, 60)}`);
  if (analyse.erreurs !== 0) v.push(`erreurs de syntaxe : ${analyse.erreurs}`);
  return v;
}
