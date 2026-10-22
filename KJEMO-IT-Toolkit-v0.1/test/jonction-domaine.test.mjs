#!/usr/bin/env node
/**
 * jonction-domaine.test.mjs — LOT 7 (24/n) · contre-épreuves d'exécution
 * ---------------------------------------------------------------------------
 * Les trois assistants de jonction de domaine sont EXÉCUTÉS sous PowerShell,
 * dans une session où les applets modifiantes sont remplacées par des
 * doublures qui consignent chaque appel. Le banc COMPTE les appels : la
 * question n'est pas de savoir si le verrou est écrit dans le script, c'est de
 * savoir s'il BLOQUE.
 *
 * C'est le même modèle que test/poste-verrous.test.mjs pour le LOT 6, et pour
 * la même raison : une vérification présente, visible et sans effet passerait
 * une recherche de motif. Elle ne passe pas une exécution.
 *
 * CE QUE CE BANC PROUVE, ET CE QU'IL NE PROUVE PAS
 * -------------------------------------------------------------------------
 * Il prouve que, dans CE moteur et avec ces doublures :
 *   - les deux assistants de LECTURE n'appellent aucune applet modifiante ;
 *   - l'assistant de jonction n'appelle Add-Computer QUE lorsque ses onze
 *     conditions sont réunies, et jamais sans ;
 *   - il ne passe JAMAIS le paramètre de redémarrage, dans aucune passe ;
 *   - aucun secret ne traverse le script : les identifiants viennent de
 *     Get-Credential et la variable qui les porte est vidée après l'appel ;
 *   - aucun des trois ne modifie un serveur DNS, ne renomme le poste, ni ne
 *     retire le poste d'un domaine.
 *
 * Il NE prouve PAS que la jonction fonctionne sur un vrai poste Windows joint
 * à un vrai domaine : aucune machine n'est jointe ici, et les doublures
 * répondent ce qu'on leur dit de répondre. C'est un banc de VERROUS.
 *
 * MOTEUR
 * -------------------------------------------------------------------------
 *   node test/jonction-domaine.test.mjs --powershell powershell
 *   node test/jonction-domaine.test.mjs --powershell pwsh
 *
 * Si l'interpréteur demandé est absent, le banc ÉCHOUE. Il ne se rabat jamais
 * sur l'autre moteur : un résultat obtenu sous PowerShell 7 ne dit rien de
 * Windows PowerShell 5.1, et c'est d'autant plus vrai ici que l'applet
 * Add-Computer n'existe QUE dans 5.1 — dans ce banc, elle est une doublure.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);

let passed = 0;
let failed = 0;
function assert(cond, label, detail = '') {
  if (cond) { passed += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${label}`); }
  else { failed += 1; console.log(`  [FAIL]  ${label}${detail ? '\n          ' + detail : ''}`); }
}
function section(titre) { console.log(`\n--- ${titre} ---`); }

// ---------------------------------------------------------------------------
// Quel interpréteur ?
// ---------------------------------------------------------------------------
function interpreteurDemande(argv) {
  const i = argv.indexOf('--powershell');
  if (i !== -1) {
    const valeur = argv[i + 1];
    if (!valeur || valeur.startsWith('--')) {
      console.error('--powershell attend un exécutable : powershell, pwsh, ou un chemin complet.');
      process.exit(1);
    }
    return valeur;
  }
  const colle = argv.find((a) => a.startsWith('--powershell='));
  return colle ? colle.slice('--powershell='.length) : null;
}
function versionDe(exe) {
  try {
    return execFileSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).trim();
  } catch { return null; }
}

const demande = interpreteurDemande(process.argv.slice(2));
let pwsh = null;
let versionPs = null;
if (demande) {
  versionPs = versionDe(demande);
  if (!versionPs) {
    console.error('');
    console.error(`ÉCHEC — l'interpréteur demandé « ${demande} » est introuvable ou ne répond pas.`);
    console.error('Le banc ne se rabat pas sur un autre moteur : un résultat obtenu ailleurs');
    console.error('ne prouverait rien sur celui-ci.');
    process.exit(1);
  }
  pwsh = demande;
} else {
  for (const candidat of ['pwsh', 'powershell']) {
    const v = versionDe(candidat);
    if (v) { pwsh = candidat; versionPs = v; break; }
  }
  if (!pwsh) {
    console.log('\nJonction de domaine : NON EXÉCUTÉ — aucun interpréteur PowerShell disponible.');
    console.log('Ce banc ne peut pas être déclaré réussi sans exécution réelle.');
    process.exit(2);
  }
}
const majeurPs = Number(String(versionPs).split('.')[0]) || 0;
console.log(`Moteur : ${pwsh} — PowerShell ${versionPs}`);
if (majeurPs !== 5) {
  console.log('Windows PowerShell 5.1 : NON EXÉCUTÉ sur ce moteur. Add-Computer, qui');
  console.log('n’existe que dans 5.1, est ici une DOUBLURE — ce banc éprouve les');
  console.log('verrous, pas la disponibilité de l’applet sur la machine cible.');
}

// ---------------------------------------------------------------------------
// Outillage
// ---------------------------------------------------------------------------
const travail = mkdtempSync(join(tmpdir(), 'kjemo-jonction-'));
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
const psLitteral = (t) => `'${String(t).replace(/'/g, "''")}'`;

function ecrirePs1(chemin, contenu) {
  writeFileSync(chemin, Buffer.concat([BOM, Buffer.from(contenu, 'utf8')]));
  return chemin;
}
function executer(chemin) {
  const r = spawnSync(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', chemin],
    { encoding: 'utf8', timeout: 180000, cwd: travail, stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    code: r.status,
    stdout: String(r.stdout ?? ''),
    stderr: String(r.stderr ?? ''),
  };
}
const appelsDe = (journal) => (existsSync(journal)
  ? readFileSync(journal, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  : []);
const compter = (appels, nom) => appels.filter((a) => a === nom || a.startsWith(`${nom} `)).length;

/**
 * Les lignes du rapport JSON ecrit par le script.
 *
 * LE RAPPORT CONSOLE N'AFFICHE QUE LES LIGNES ATTENTION ET PROBLEME, ET
 * SEULEMENT LEUR COMMENTAIRE. C'est le meme piege que du cote Linux, et il a
 * deja coute six corrections au LOT 7 : chercher une ligne OK dans la sortie
 * console, c'est chercher ce qui n'y est pas. Le banc lit donc le FICHIER.
 */
// Node parcourt les fichiers sur Windows comme sur Linux : find.exe sous
// Windows cherche du texte, et ne sait pas enumerer une arborescence Unix.
function fichiersDuBanc(prefixe, extension, dossier = travail) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return fichiersDuBanc(prefixe, extension, chemin);
    return entree.isFile() && entree.name.startsWith(prefixe)
      && entree.name.endsWith(extension) ? [chemin] : [];
  }).sort();
}
function lignesRapport(nom) {
  const liste = fichiersDuBanc(nom, '.json');
  if (liste.length === 0) return [];
  // Set-Content -Encoding UTF8 ajoute un BOM sous Windows PowerShell 5.1.
  const brut = JSON.parse(readFileSync(liste[liste.length - 1], 'utf8').replace(/^\uFEFF/, ''));
  return brut.Resultats ?? brut.resultats ?? brut.Controles ?? brut.controles ?? [];
}
const champDe = (l, nom) => l[nom] ?? l[nom.toLowerCase()] ?? '';
const ligneRapport = (lignes, controle) => lignes.find((x) => champDe(x, 'Controle') === controle);

function outilOuEchec(id) {
  const o = tools.find((t) => t.id === id);
  if (!o) { console.log(`\nOutil ${id} absent du catalogue.`); process.exit(1); }
  return o;
}
const prerequis = outilOuEchec('windows-domain-join-readiness');
const jonction = outilOuEchec('windows-domain-join');
const diagnostic = outilOuEchec('windows-domain-join-diagnostic');

const valeursDe = (outil, surcharges = {}) => {
  const valeurs = {
    ...Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')])),
    ...surcharges,
  };
  // Sous Windows C: existe deja : toutes les ecritures restent dans le bac.
  // Les chemins volontairement refuses (par exemple C:\\) restent intacts.
  if (process.platform === 'win32' && valeurs.jdJournal === 'C:\\Kjemo\\Journaux') {
    valeurs.jdJournal = join(travail, 'Journaux');
  }
  return valeurs;
};

/**
 * L'élévation se lit par une classe .NET qui n'existe pas sous Linux. Sans
 * cette substitution, le verrou se fermerait pour la mauvaise raison et le
 * banc mesurerait l'absence de .NET Windows au lieu du verrou.
 */
function avecElevation(script, eleve) {
  const avant = [
    '  $identite = [Security.Principal.WindowsIdentity]::GetCurrent()',
    '  $principal = New-Object Security.Principal.WindowsPrincipal($identite)',
    '  $KjemoEleve = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
  ].join('\n');
  if (!script.includes(avant)) {
    console.log('  [FAIL]  le bloc d’élévation attendu est absent du script généré');
    failed += 1;
    return script;
  }
  return script.replace(avant, `  $KjemoEleve = ${eleve ? '$true' : '$false'}`);
}

/**
 * Le gardien de chemin raisonne en chemins WINDOWS ; le banc tourne sous
 * Linux, où « \ » n'est pas un séparateur. Deux appels .NET sont remplacés
 * par leur équivalent indépendant de la plateforme. La LOGIQUE du gardien
 * reste celle du script : c'est elle qui est éprouvée.
 */
function avecCheminsWindows(script) {
  if (process.platform === 'win32') return script;
  let sortie = script;
  const remplacements = [
    [
      '  if (-not [System.IO.Path]::IsPathRooted($Chemin)) {',
      "  if ($Chemin -notmatch '^[A-Za-z]:\\\\' -and $Chemin -notlike '\\\\*') {",
    ],
    [
      '  try { $canon = [System.IO.Path]::GetFullPath($Chemin) } catch { return $null }',
      '  try { $canon = Resolve-KjemoBancCanon $Chemin } catch { return $null }',
    ],
    [
      '  try { $parent = [System.IO.Path]::GetDirectoryName($profil) } catch { return $null }',
      '  try { $parent = Split-KjemoBancParent $profil } catch { return $null }',
    ],
    [
      '    try { $parentCanon = [System.IO.Path]::GetDirectoryName($canon) } catch { }',
      '    try { $parentCanon = Split-KjemoBancParent $canon } catch { }',
    ],
  ];
  for (const [de, vers] of remplacements) {
    if (sortie.includes(de)) sortie = sortie.split(de).join(vers);
  }
  return sortie;
}

/**
 * Le décor : un poste Windows crédible, et une doublure par applet modifiante.
 *
 * Chaque doublure CONSIGNE son nom et ses arguments. C'est le journal qui
 * décide, et non la lecture du script.
 */
function decor({
  eleve = true,
  dansDomaine = false,
  skuFamille = false,
  nomPoste = 'POSTE-BANC',
  srvPresents = true,
  portsOuverts = true,
  adminLocal = true,
  ecartSecondes = 2,
  identifiantsFournis = true,
  canalSain = true,
  journal,
} = {}) {
  const sku = skuFamille ? 101 : 48;
  return `
$ErrorActionPreference = 'Continue'
$global:KjemoJournal = ${psLitteral(journal)}
if (Test-Path -LiteralPath $global:KjemoJournal) { Remove-Item -LiteralPath $global:KjemoJournal }

function Write-KjemoAppel { param([string]$Nom)
  # Ecriture par .NET, deliberement : passer par Add-Content ferait s'appeler
  # le mouchard lui-meme si Add-Content etait double un jour.
  [System.IO.File]::AppendAllText($global:KjemoJournal, $Nom + [Environment]::NewLine)
}

function Split-KjemoBancParent {
  param([string]$Chemin)
  if ([string]::IsNullOrWhiteSpace($Chemin)) { return $null }
  $i = ([string]$Chemin).LastIndexOf('\\')
  if ($i -le 1) { return $null }
  return ([string]$Chemin).Substring(0, $i)
}
function Resolve-KjemoBancCanon {
  param([string]$Chemin)
  if ([string]::IsNullOrWhiteSpace($Chemin)) { return $Chemin }
  $texte = ([string]$Chemin).Replace('/', '\\')
  $prefixe = ''
  $reste = $texte
  if ($texte.StartsWith('\\\\')) { $prefixe = '\\\\'; $reste = $texte.Substring(2) }
  elseif ($texte -match '^[A-Za-z]:') { $prefixe = $texte.Substring(0, 2) + '\\'; $reste = $texte.Substring(2) }
  $pile = @()
  foreach ($segment in ($reste.Split('\\'))) {
    if ($segment -eq '' -or $segment -eq '.') { continue }
    if ($segment -eq '..') {
      if ($pile.Count -gt 1) { $pile = $pile[0..($pile.Count - 2)] }
      elseif ($pile.Count -eq 1) { $pile = @() }
      continue
    }
    $pile += $segment
  }
  if ($pile.Count -eq 0) { return $prefixe }
  return ($prefixe + ($pile -join '\\'))
}

# UN LECTEUR « C: » QUI EXISTE, POUR QUE LE JOURNAL SOIT VRAIMENT EPROUVE.
#
# Sous Linux, « New-Item -Path 'C:\\Kjemo\\Journaux' » echoue avec « Cannot find
# drive » : PowerShell lit « C: » comme un lecteur, et il n'y en a pas. Sans
# ce lecteur, l'ecriture du journal echouait TOUJOURS, le verrou se fermait
# pour cette raison-la, et les huit passes de refus auraient ete vertes sans
# rien prouver. C'est exactement le faux vert qu'un banc doit eviter.
#
# New-PSDrive fait pointer « C: » vers le bac. Le gardien de chemin du produit,
# lui, continue de raisonner sur le texte du chemin : sa logique est intacte.
${process.platform === 'win32' ? '# Lecteurs Windows natifs : aucun remappage de C:.' : `$null = New-PSDrive -Name C -PSProvider FileSystem -Root ${psLitteral(travail)} -Scope Global -ErrorAction Stop`}

$env:SystemRoot = 'C:\\Windows'
$env:SystemDrive = 'C:'
$env:ProgramFiles = 'C:\\Program Files'
$env:ProgramData = 'C:\\ProgramData'
$env:USERPROFILE = ${psLitteral(process.platform === 'win32' ? join(travail, 'Users', 'banc') : 'C:\\Users\\banc')}
$null = New-Item -ItemType Directory -Path (Join-Path $env:USERPROFILE 'Desktop') -Force -ErrorAction Stop
$env:COMPUTERNAME = ${psLitteral(nomPoste)}
$env:USERNAME = 'banc'

# --- LES DOUBLURES MODIFIANTES. Aucune n'agit ; toutes consignent. ---------
function Add-Computer {
  [CmdletBinding()] param([string]$DomainName, [string]$OUPath, $Credential, [switch]$Restart, [switch]$Force)
  $trace = 'Add-Computer'
  if ($DomainName) { $trace = $trace + ' domaine=' + $DomainName }
  if ($OUPath) { $trace = $trace + ' ou=' + $OUPath }
  if ($Restart) { $trace = $trace + ' AVEC-REDEMARRAGE' }
  if ($Force) { $trace = $trace + ' AVEC-FORCE' }
  if ($Credential) { $trace = $trace + ' avec-identifiants' } else { $trace = $trace + ' SANS-identifiants' }
  Write-KjemoAppel $trace
  return $null
}
function Remove-Computer { [CmdletBinding()] param() Write-KjemoAppel 'Remove-Computer'; return $null }
function Rename-Computer { [CmdletBinding()] param() Write-KjemoAppel 'Rename-Computer'; return $null }
function Set-DnsClientServerAddress { [CmdletBinding()] param() Write-KjemoAppel 'Set-DnsClientServerAddress'; return $null }
function Set-TimeZone { [CmdletBinding()] param() Write-KjemoAppel 'Set-TimeZone'; return $null }
function Reset-ComputerMachinePassword { [CmdletBinding()] param() Write-KjemoAppel 'Reset-ComputerMachinePassword'; return $null }
function Set-NetFirewallProfile { [CmdletBinding()] param() Write-KjemoAppel 'Set-NetFirewallProfile'; return $null }

function Get-Credential {
  [CmdletBinding()] param([string]$Message)
  Write-KjemoAppel 'Get-Credential'
  ${identifiantsFournis
    ? "return (New-Object System.Management.Automation.PSCredential('KJEMO\\\\jonction', (ConvertTo-SecureString 'SECRET-DU-BANC-NE-DOIT-PAS-FUIR' -AsPlainText -Force)))"
    : 'return $null'}
}

# --- LES DOUBLURES DE LECTURE ----------------------------------------------
function Get-Command {
  [CmdletBinding()] param([string]$Name)
  return [pscustomobject]@{ Name = $Name; Source = ('/banc/' + $Name) }
}
function Get-CimInstance {
  [CmdletBinding()] param([string]$ClassName, [string]$Namespace, $Filter)
  switch -Wildcard ($ClassName) {
    'Win32_ComputerSystem' {
      return [pscustomobject]@{ Name = ${psLitteral(nomPoste)}
        PartOfDomain = ${dansDomaine ? '$true' : '$false'}
        Domain = ${dansDomaine ? "'kjemo.local'" : "'WORKGROUP'"}
        Workgroup = 'WORKGROUP' }
    }
    'Win32_OperatingSystem' {
      return [pscustomobject]@{ Caption = 'Windows 11 (banc)'; Version = '10.0.22631'
        BuildNumber = '22631'; OperatingSystemSKU = ${sku} }
    }
    default { return @() }
  }
}
function Get-TimeZone { [CmdletBinding()] param() return [pscustomobject]@{ Id = 'Eastern Standard Time' } }
function Get-DnsClientServerAddress {
  [CmdletBinding()] param($AddressFamily)
  return @([pscustomobject]@{ InterfaceAlias = 'Ethernet'; ServerAddresses = @('192.168.30.10') })
}
function Resolve-DnsName {
  [CmdletBinding()] param([string]$Name, [string]$Type)
  if ($Type -eq 'SRV') {
    ${srvPresents
      ? "return @([pscustomobject]@{ Type = 'SRV'; NameTarget = 'dc01.kjemo.local'; Port = 389 })"
      : 'return @()'}
  }
  return @([pscustomobject]@{ Type = 'A'; IPAddress = '192.168.30.10' })
}
function Test-NetConnection {
  [CmdletBinding()] param([string]$ComputerName, [int]$Port, [string]$InformationLevel)
  return ${portsOuverts ? '$true' : '$false'}
}
function Get-LocalGroupMember {
  [CmdletBinding()] param([string]$SID, [string]$Group)
  ${adminLocal
    ? "return @([pscustomobject]@{ Name = 'POSTE-BANC\\\\admin-local'; ObjectClass = 'User'; PrincipalSource = 'Local' })"
    : 'return @()'}
}
function Get-LocalUser {
  [CmdletBinding()] param([string]$Name)
  return [pscustomobject]@{ Name = $Name; Enabled = $true }
}
function Get-NetIPAddress {
  [CmdletBinding()] param($AddressFamily)
  return @([pscustomobject]@{ InterfaceAlias = 'Ethernet'; IPAddress = '192.168.30.50'; PrefixLength = 24; PrefixOrigin = 'Dhcp' })
}
function Get-NetFirewallProfile {
  [CmdletBinding()] param()
  return @([pscustomobject]@{ Name = 'Domain'; Enabled = $true })
}
function Get-WinEvent { [CmdletBinding()] param($FilterHashtable, [int]$MaxEvents) return @() }
function Test-ComputerSecureChannel { [CmdletBinding()] param() return ${canalSain ? '$true' : '$false'} }
function w32tm {
  Write-KjemoAppel 'w32tm'
  return ('12:00:00, +0' + ${ecartSecondes} + '.0000000s')
}
`;
}

function jouer(nom, script, options) {
  const journal = join(travail, `${nom}.journal`);
  const chemin = join(travail, `${nom}.ps1`);
  ecrirePs1(chemin, decor({ ...options, journal }) + '\n' + script + '\n');
  const r = executer(chemin);
  return { ...r, appels: appelsDe(journal) };
}

function preparer(outil, valeurs, { eleve = true } = {}) {
  return avecCheminsWindows(avecElevation(outil.generate(valeurs), eleve));
}

// ===========================================================================
section('Passe 0 — le TEXTE des scripts : aucun secret, aucun redémarrage');
// ===========================================================================
{
  const INTERDITS = [
    [/\bRestart-Computer\b/i, 'aucun redémarrage automatique'],
    [/\bStop-Computer\b/i, 'aucun arrêt automatique'],
    [/\bLogoff\b/i, 'aucune fermeture de session'],
    [/ConvertTo-SecureString/i, 'aucun secret fabriqué en clair'],
    [/(^|\s)-AsPlainText\b/i, 'aucun secret en clair'],
    [/(^|\s)-Password\b/i, 'aucun paramètre de mot de passe'],
    [/-Confirm\s*:\s*\$false/i, 'aucune confirmation désarmée'],
    [/Add-Computer[^\n]*-Restart/i, 'Add-Computer n’est jamais appelé avec le paramètre de redémarrage'],
    [/\bRemove-Computer\b\s+-/i, 'Remove-Computer n’est jamais invoqué avec des paramètres'],
    [/\bRename-Computer\b\s+-/i, 'Rename-Computer n’est jamais invoqué'],
    [/\bSet-DnsClientServerAddress\b/i, 'aucun serveur DNS modifié'],
  ];
  for (const outil of [prerequis, jonction, diagnostic]) {
    const modes = outil.fields.some((f) => f.id === 'mode') ? ['Diagnostic', 'Appliquer'] : [null];
    for (const mode of modes) {
      const v = valeursDe(outil);
      if (mode) {
        v.mode = mode;
        if (mode === 'Appliquer') v.jdConfirmation = 'JE JOINS CE POSTE AU DOMAINE';
      }
      const script = outil.generate(v);
      for (const [motif, quoi] of INTERDITS) {
        assert(!motif.test(script), `0 : ${outil.id} (${mode ?? 'sans mode'}) — ${quoi}`);
      }
    }
    // Aucun champ de mot de passe dans le formulaire.
    //
    // Le controle porte sur l'IDENTIFIANT, le LIBELLE, le type et la valeur
    // d'exemple — pas sur l'aide. Les aides de ces trois assistants parlent
    // justement de mots de passe, pour dire qu'il n'y en a pas : juger la
    // prose explicative comme un champ ferait accuser la pedagogie, defaut
    // deja rencontre deux fois au LOT 7 et corrige au meme endroit — dans le
    // controle, pas dans le texte.
    for (const f of outil.fields ?? []) {
      const nu = `${f.id} ${f.label ?? ''} ${f.type ?? ''} ${f.placeholder ?? ''}`.toLowerCase();
      assert(!/mot de passe|password|secret|credential/.test(nu),
        `0 : ${outil.id} — le champ « ${f.id} » n'est pas un champ de mot de passe`);
    }
  }
  // Et la contre-épreuve du jeu de motifs : il doit reconnaître les fautes.
  for (const fautif of ['Add-Computer -DomainName $d -Restart', 'Restart-Computer', '$p = ConvertTo-SecureString $x -AsPlainText']) {
    assert(INTERDITS.some(([m]) => m.test(fautif)),
      `0 — contre-épreuve : le jeu de motifs reconnaît « ${fautif.slice(0, 40)} »`);
  }
}

// ===========================================================================
section('Passe A — les deux assistants de LECTURE n’appellent rien de modifiant');
// ===========================================================================
{
  for (const [nom, outil, valeurs] of [
    ['A1-prerequis', prerequis, valeursDe(prerequis, { jrDomaine: 'kjemo.local', jrControleur: 'dc01.kjemo.local' })],
    ['A2-diagnostic', diagnostic, valeursDe(diagnostic, { jgDomaine: 'kjemo.local', jgControleur: 'dc01.kjemo.local' })],
  ]) {
    const r = jouer(nom, preparer(outil, valeurs, { eleve: true }), { dansDomaine: nom === 'A2-diagnostic' });
    assert(r.code === 0, `${nom} : le script sort 0 (obtenu ${r.code})`, r.stderr.slice(0, 300));
    for (const interdit of ['Add-Computer', 'Remove-Computer', 'Rename-Computer',
      'Set-DnsClientServerAddress', 'Set-TimeZone', 'Reset-ComputerMachinePassword',
      'Set-NetFirewallProfile', 'Get-Credential']) {
      assert(compter(r.appels, interdit) === 0,
        `${nom} — ZERO ${interdit} (${r.appels.filter((a) => a.startsWith(interdit)).join(' | ') || 'aucun'})`);
    }
    assert(r.appels.length > 0,
      `${nom} : le journal n’est pas vide — les doublures sont bien en place (${r.appels.length} appel(s))`);
  }
}

// ===========================================================================
section('Passe B — le mode Diagnostic de l’assistant de jonction ne joint rien');
// ===========================================================================
{
  const v = valeursDe(jonction, { mode: 'Diagnostic', jdDomaine: 'kjemo.local', jdJournal: 'C:\\Kjemo\\Journaux' });
  const r = jouer('B-diagnostic', preparer(jonction, v, { eleve: true }), {});
  assert(r.code === 0, `B : le script sort 0 (obtenu ${r.code})`, r.stderr.slice(0, 300));
  assert(compter(r.appels, 'Add-Computer') === 0, 'B — ZERO Add-Computer en mode Diagnostic');
  assert(compter(r.appels, 'Get-Credential') === 0,
    'B — ZERO Get-Credential : on ne demande pas un mot de passe pour simuler');
  assert(/Simulation/.test(r.stdout), 'B : la simulation est annoncée');
}

// ===========================================================================
section('Passe C — le verrou bloque : élévation, confirmation, prérequis');
// ===========================================================================
{
  const base = { mode: 'Appliquer', jdDomaine: 'kjemo.local', jdJournal: 'C:\\Kjemo\\Journaux', jdConfirmation: 'JE JOINS CE POSTE AU DOMAINE' };

  // C1 — console non élevée.
  {
    const r = jouer('C1-non-eleve', preparer(jonction, valeursDe(jonction, base), { eleve: false }), {});
    assert(compter(r.appels, 'Add-Computer') === 0, 'C1 — ZERO Add-Computer sans console élevée');
    assert(/console non elevee/.test(r.stdout), 'C1 : la condition manquante est NOMMEE');
    assert(compter(r.appels, 'Get-Credential') === 0,
      'C1 — aucun identifiant demandé : on ne réclame pas un secret pour ensuite refuser');
  }

  // C2 — confirmation désarmée DANS LE SCRIPT.
  //
  // Le formulaire refuse de générer sans la phrase exacte : pour éprouver le
  // verrou du SCRIPT, on réécrit la seule ligne qui porte la confirmation.
  // C'est la même technique que le banc du LOT 6, et elle vérifie le verrou là
  // où il compte — dans le fichier qu'on exécute.
  {
    let script = preparer(jonction, valeursDe(jonction, base), { eleve: true });
    const avant = script.match(/^\$Confirmation = .*$/m);
    assert(Boolean(avant), 'C2 : la ligne de confirmation est repérable dans le script généré');
    if (avant) {
      script = script.replace(avant[0], "$Confirmation = 'je joins ce poste au domaine'");
      const r = jouer('C2-confirmation', script, {});
      assert(compter(r.appels, 'Add-Computer') === 0,
        'C2 — ZERO Add-Computer : la comparaison est sensible à la casse');
      assert(/confirmation ecrite absente ou inexacte/.test(r.stdout),
        'C2 : la condition manquante est NOMMEE');
    }
  }

  // C3 — les enregistrements SRV ne se résolvent pas.
  {
    const r = jouer('C3-srv', preparer(jonction, valeursDe(jonction, base), { eleve: true }), { srvPresents: false });
    assert(compter(r.appels, 'Add-Computer') === 0, 'C3 — ZERO Add-Computer sans enregistrements SRV');
    assert(/enregistrements SRV du domaine non resolus/.test(r.stdout), 'C3 : la condition manquante est NOMMEE');
  }

  // C4 — aucun administrateur local actif.
  {
    const r = jouer('C4-admin', preparer(jonction, valeursDe(jonction, base), { eleve: true }), { adminLocal: false });
    assert(compter(r.appels, 'Add-Computer') === 0,
      'C4 — ZERO Add-Computer sans administrateur LOCAL actif');
    assert(/aucun administrateur LOCAL actif/.test(r.stdout), 'C4 : la condition manquante est NOMMEE');
  }

  // C5 — écart d'horloge supérieur à cinq minutes.
  {
    const r = jouer('C5-horloge', preparer(jonction, valeursDe(jonction, base), { eleve: true }), { ecartSecondes: 900 });
    assert(compter(r.appels, 'Add-Computer') === 0,
      'C5 — ZERO Add-Computer quand l’écart d’horloge dépasse 5 minutes');
    assert(/horloge/.test(r.stdout), 'C5 : l’horloge est nommée parmi les conditions manquantes');
  }

  // C6 — le poste est DÉJÀ dans un domaine.
  {
    const r = jouer('C6-deja', preparer(jonction, valeursDe(jonction, base), { eleve: true }), { dansDomaine: true });
    assert(compter(r.appels, 'Add-Computer') === 0,
      'C6 — ZERO Add-Computer : un poste déjà joint n’est pas déplacé par cet assistant');
    assert(/deja joint a un domaine/.test(r.stdout), 'C6 : la condition manquante est NOMMEE');
  }

  // C7 — édition Famille.
  {
    const r = jouer('C7-famille', preparer(jonction, valeursDe(jonction, base), { eleve: true }), { skuFamille: true });
    assert(compter(r.appels, 'Add-Computer') === 0,
      'C7 — ZERO Add-Computer sur une édition Famille');
    assert(/edition de Windows incompatible/.test(r.stdout), 'C7 : la condition manquante est NOMMEE');
  }

  // C8 — ports du contrôleur fermés.
  {
    const r = jouer('C8-ports', preparer(jonction, valeursDe(jonction, base), { eleve: true }), { portsOuverts: false });
    assert(compter(r.appels, 'Add-Computer') === 0, 'C8 — ZERO Add-Computer quand les ports ne répondent pas');
    assert(/ports du controleur non joignables/.test(r.stdout), 'C8 : la condition manquante est NOMMEE');
  }

  // C9 — chemin de journal refusé par le gardien : aucune jonction, et aucun
  // dossier créé. Le champ est validé par le formulaire, donc on éprouve ici
  // un chemin que le formulaire accepte et que le GARDIEN refuse : une racine
  // de volume.
  {
    const v = valeursDe(jonction, { ...base, jdJournal: 'C:\\' });
    let script = null;
    try { script = preparer(jonction, v, { eleve: true }); } catch { script = null; }
    if (script === null) {
      assert(true, 'C9 : le formulaire refuse déjà une racine de volume comme dossier de journal');
    } else {
      const r = jouer('C9-journal', script, {});
      assert(compter(r.appels, 'Add-Computer') === 0,
        'C9 — ZERO Add-Computer quand le gardien refuse le dossier du journal');
      assert(/journal non ecrit|refuse par le gardien/.test(r.stdout), 'C9 : la cause est NOMMEE');
    }
  }
}

// ===========================================================================
section('Passe D — CONTRÔLE POSITIF : toutes les conditions réunies');
// ===========================================================================
{
  const v = valeursDe(jonction, {
    mode: 'Appliquer', jdDomaine: 'kjemo.local', jdControleur: 'dc01.kjemo.local',
    jdUniteOrg: 'OU=Postes,DC=kjemo,DC=local', jdJournal: 'C:\\Kjemo\\Journaux',
    jdConfirmation: 'JE JOINS CE POSTE AU DOMAINE',
  });
  const r = jouer('D-positif', preparer(jonction, v, { eleve: true }), {});
  assert(r.code === 0, `D : le script sort 0 (obtenu ${r.code})`, r.stderr.slice(0, 400));
  assert(compter(r.appels, 'Add-Computer') === 1,
    `D — CONTROLE POSITIF : Add-Computer est appelé UNE fois (${compter(r.appels, 'Add-Computer')})`);
  const ligne = r.appels.find((a) => a.startsWith('Add-Computer')) ?? '';
  assert(/domaine=kjemo\.local/.test(ligne), `D : le domaine passé est celui du formulaire (${ligne})`);
  assert(/ou=OU=Postes,DC=kjemo,DC=local/.test(ligne), `D : l’unité d’organisation est transmise (${ligne})`);
  assert(/avec-identifiants/.test(ligne), `D : des identifiants sont passés (${ligne})`);
  assert(!/AVEC-REDEMARRAGE/.test(ligne), 'D — AUCUN redémarrage automatique : le paramètre n’est pas passé');
  assert(!/AVEC-FORCE/.test(ligne), 'D — AUCUN contournement de confirmation');
  assert(compter(r.appels, 'Get-Credential') === 1,
    `D : les identifiants sont demandés à l’écran, une fois (${compter(r.appels, 'Get-Credential')})`);
  // L'ordre : on demande le secret APRES avoir passé le verrou, pas avant.
  const iCred = r.appels.findIndex((a) => a.startsWith('Get-Credential'));
  const iAdd = r.appels.findIndex((a) => a.startsWith('Add-Computer'));
  assert(iCred > -1 && iAdd > iCred, 'D : le secret est demandé juste avant la jonction, et après le verrou');
  // Et la prudence du verdict.
  assert(/ACCEPTEE/.test(r.stdout), 'D : la demande est annoncée ACCEPTEE');
  assert(!/jonction reussie|REUSSIE/i.test(r.stdout),
    'D — AUCUNE REUSSITE ANNONCEE : la vérification se fait après le redémarrage');
  assert(/LA JONCTION N'EST PAS ENCORE EFFECTIVE|PAS ENCORE EFFECTIVE/.test(r.stdout),
    'D : le script dit que la jonction n’est pas encore effective');
  assert(/Test-ComputerSecureChannel/.test(r.stdout),
    'D : la relecture d’après redémarrage est donnée, avec la commande qui l’éprouve');
  for (const interdit of ['Remove-Computer', 'Rename-Computer', 'Set-DnsClientServerAddress', 'Set-TimeZone']) {
    assert(compter(r.appels, interdit) === 0, `D — ZERO ${interdit}, même dans le contrôle positif`);
  }
  // Le journal du produit existe, et ne contient aucun secret.
  const liste = fichiersDuBanc('kjemo-jonction-', '.txt');
  assert(liste.length >= 1, `D : le journal du produit a été écrit (${liste.length})`);
  const journaux = liste.map((f) => readFileSync(f, 'utf8'));
  assert(journaux.some((t) => /Demande         : ACCEPTEE/.test(t)),
    'D : un journal consigne l’état ACCEPTEE de la demande');
  assert(journaux.some((t) => /A FAIRE A LA MAIN/.test(t)),
    'D : le journal dit que le redémarrage reste à faire');
  // LA MESURE DU SECRET. La doublure de Get-Credential rend un mot de passe
  // reconnaissable entre mille : s'il apparaissait quelque part, on le
  // verrait. Chercher le mot « banc » aurait accuse le nom de la session.
  const SECRET = 'SECRET-DU-BANC-NE-DOIT-PAS-FUIR';
  assert(journaux.every((t) => !t.includes(SECRET)), 'D : aucun secret dans le journal');
  assert(!r.stdout.includes(SECRET), 'D : aucun secret dans la sortie console');
  const rapportD = lignesRapport('kjemo-jonction-domaine');
  assert(rapportD.length === 0 || !JSON.stringify(rapportD).includes(SECRET),
    'D : aucun secret dans le rapport');
}

// ===========================================================================
section('Passe E — identifiants refusés : rien n’est tenté');
// ===========================================================================
{
  const v = valeursDe(jonction, {
    mode: 'Appliquer', jdDomaine: 'kjemo.local', jdJournal: 'C:\\Kjemo\\Journaux',
    jdConfirmation: 'JE JOINS CE POSTE AU DOMAINE',
  });
  const r = jouer('E-sans-identifiants', preparer(jonction, v, { eleve: true }), { identifiantsFournis: false });
  assert(compter(r.appels, 'Get-Credential') === 1, 'E : l’invite a bien été présentée');
  assert(compter(r.appels, 'Add-Computer') === 0,
    'E — ZERO Add-Computer quand l’invite d’identifiants est annulée');
  assert(/ABANDONNEE/.test(r.stdout), 'E : l’abandon est annoncé, et non confondu avec un échec de jonction');
}

// ===========================================================================
section('Passe F — l’assistant de diagnostic éprouve le canal sans le réparer');
// ===========================================================================
{
  // F1 — canal rompu : il est NOMMÉ, et rien n'est réparé.
  //
  // Les assertions portent sur le COMMENTAIRE, parce que c'est la seule chose
  // que le rapport Console affiche d'une ligne PROBLEME. Chercher la valeur
  // dans la sortie reviendrait a chercher ce qui n'y est pas.
  {
    const v = valeursDe(diagnostic, { jgDomaine: 'kjemo.local', jgControleur: 'dc01.kjemo.local', jgFormat: 'JSON' });
    const r = jouer('F1-canal-rompu', preparer(diagnostic, v, { eleve: true }),
      { dansDomaine: true, canalSain: false });
    assert(r.code === 0, `F1 : le script sort 0 (obtenu ${r.code})`, r.stderr.slice(0, 300));
    assert(compter(r.appels, 'Reset-ComputerMachinePassword') === 0,
      'F1 — ZERO réparation du mot de passe de compte machine');
    assert(compter(r.appels, 'Remove-Computer') === 0, 'F1 — ZERO retrait de domaine');
    assert(/Le canal securise est ROMPU/.test(r.stdout), 'F1 : le canal rompu est NOMMÉ');
    assert(/relation d'approbation/.test(r.stdout),
      'F1 : le rapport donne le message que la personne voit à l’écran');
    assert(/ne la fait pas a ta place/.test(r.stdout),
      'F1 : le rapport dit que la réparation ne figure pas ici, et pourquoi');
    const lignes = lignesRapport('kjemo-jonction-diagnostic');
    const verdict = ligneRapport(lignes, 'Nature de la panne');
    assert(verdict !== undefined && champDe(verdict, 'Valeur') === 'canal securise rompu',
      `F1 : le verdict nomme le canal rompu (${verdict ? champDe(verdict, 'Valeur') : 'ABSENT'})`);
  }
  // F2 — poste hors domaine : le canal est IGNORE, pas déclaré sain.
  {
    const v = valeursDe(diagnostic, { jgDomaine: 'kjemo.local', jgFormat: 'JSON' });
    const r = jouer('F2-hors-domaine', preparer(diagnostic, v, { eleve: true }), { dansDomaine: false });
    const lignes = lignesRapport('kjemo-jonction-diagnostic');
    const canal = ligneRapport(lignes, 'Test-ComputerSecureChannel');
    assert(canal !== undefined && champDe(canal, 'Etat') === 'IGNORE',
      `F2 : hors domaine, le canal sécurisé est IGNORE et non sain (${canal ? champDe(canal, 'Etat') : 'ABSENTE'})`);
    const verdict = ligneRapport(lignes, 'Nature de la panne');
    assert(verdict !== undefined && champDe(verdict, 'Valeur') === 'le poste n est pas joint',
      `F2 : le verdict distingue la panne de JONCTION (${verdict ? champDe(verdict, 'Valeur') : 'ABSENT'})`);
    assert(compter(r.appels, 'Add-Computer') === 0, 'F2 — ZERO Add-Computer');
  }
  // F3 — poste joint et canal sain : le verdict le dit, et renvoie ailleurs.
  {
    const v = valeursDe(diagnostic, { jgDomaine: 'kjemo.local', jgFormat: 'JSON' });
    const r = jouer('F3-sain', preparer(diagnostic, v, { eleve: true }), { dansDomaine: true, canalSain: true });
    const lignes = lignesRapport('kjemo-jonction-diagnostic');
    const verdict = ligneRapport(lignes, 'Nature de la panne');
    assert(verdict !== undefined && champDe(verdict, 'Etat') === 'OK',
      `F3 : le verdict conclut que la jonction est saine (${verdict ? champDe(verdict, 'Etat') : 'ABSENT'})`);
    assert(verdict !== undefined && /chercher du cote du compte/.test(champDe(verdict, 'Commentaire')),
      'F3 : le verdict renvoie ailleurs plutôt que de laisser chercher la jonction');
    assert(compter(r.appels, 'Add-Computer') === 0, 'F3 — ZERO Add-Computer dans un assistant de diagnostic');
    assert(compter(r.appels, 'Reset-ComputerMachinePassword') === 0, 'F3 — ZERO réparation');
  }
}

// ===========================================================================
section('Passe G — contre-épreuve du banc : il doit VOIR un appel interdit');
// ===========================================================================
{
  // Un banc incapable d'échouer ne prouve rien. On fabrique un script qui
  // appelle Add-Computer, et le journal doit le voir.
  const journal = join(travail, 'G.journal');
  const chemin = join(travail, 'G.ps1');
  ecrirePs1(chemin, `${decor({ journal })}\nAdd-Computer -DomainName 'piege.local' -Restart\n`);
  executer(chemin);
  const appels = appelsDe(journal);
  assert(compter(appels, 'Add-Computer') === 1,
    'G — CONTRE-EPREUVE : un appel réel à Add-Computer est bien consigné');
  assert(appels.some((a) => /AVEC-REDEMARRAGE/.test(a)),
    'G — CONTRE-EPREUVE : le paramètre de redémarrage serait repéré s’il était passé');
}

if (!process.env.KJEMO_GARDER_BANCS) { rmSync(travail, { recursive: true, force: true }); }
else { console.log(`\nBancs conservés dans ${travail}`); }

console.log('');
console.log(`Jonction de domaine — ${pwsh} (PowerShell ${versionPs}) : ${passed} OK, ${failed} ÉCHEC(S).`);
if (majeurPs === 5) {
  console.log('Moteur éprouvé : Windows PowerShell 5.1, cible de référence du projet.');
} else {
  console.log('Moteur éprouvé : PowerShell ' + majeurPs + '. Windows PowerShell 5.1 : NON EXÉCUTÉ.');
  console.log('Aucun poste n’a été joint à un domaine : Add-Computer est une doublure.');
}
process.exit(failed > 0 ? 1 : 0);
