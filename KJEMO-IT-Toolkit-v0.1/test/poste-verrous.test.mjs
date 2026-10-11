/**
 * poste-verrous.test.mjs — contre-épreuves d'exécution du LOT 6
 * ---------------------------------------------------------------
 * Trois assistants du LOT 6 peuvent modifier l'état de la machine :
 *
 *   audio-diagnostic      redémarre deux services audio ;
 *   windows-update-repair arrête des services et renomme des dossiers ;
 *   process-hung          met fin à un processus.
 *
 * Chacun porte un verrou — une liste de conditions qui doivent TOUTES être
 * vraies avant le premier appel modifiant. La question n'est pas de savoir si
 * le verrou est ÉCRIT dans le script : c'est de savoir s'il BLOQUE.
 *
 * C'est exactement le défaut que la revue du LOT 5 avait trouvé deux fois : la
 * vérification était présente, visible, et sans effet. Une recherche de motif
 * l'aurait validée. Ce test exécute donc les scripts pour de vrai, sous
 * PowerShell, dans une session où les cmdlets modifiantes sont remplacées par
 * des mouchards qui consignent chaque appel — et il COMPTE les appels.
 *
 * Chaque assistant a sa contre-épreuve : le verrou désarmé, le test doit voir
 * l'appel interdit. Un test incapable d'échouer ne prouve rien.
 *
 * INTERPRÉTEUR
 * ------------
 *   node test/poste-verrous.test.mjs --powershell powershell
 *   node test/poste-verrous.test.mjs --powershell pwsh
 *
 * Si l'interpréteur demandé est absent, le test ÉCHOUE. Il ne se rabat jamais
 * sur l'autre moteur : un résultat obtenu sous PowerShell 7 ne dit rien de
 * Windows PowerShell 5.1.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { tools } = await import(resolve(ROOT, 'dist/generators.mjs'));

let passed = 0;
let failed = 0;
function assert(cond, label, detail = '') {
  if (cond) { passed += 1; console.log(`  [OK]    ${label}`); }
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
    console.error('Le test ne se rabat pas sur un autre moteur : un résultat obtenu ailleurs');
    console.error('ne prouverait rien sur celui-ci.');
    process.exit(1);
  }
  pwsh = demande;
  console.log(`Interpréteur demandé : ${demande} — PowerShell ${versionPs}`);
} else {
  for (const candidat of ['pwsh', 'powershell']) {
    const v = versionDe(candidat);
    if (v) { pwsh = candidat; versionPs = v; break; }
  }
  if (!pwsh) {
    console.log('\nAucun interpréteur PowerShell disponible : contre-épreuve NON EXÉCUTÉE.');
    console.log('Ce test ne peut pas être déclaré réussi sans exécution réelle.');
    process.exit(2);
  }
  console.log(`Aucun --powershell fourni ; interpréteur retenu automatiquement : ${pwsh} — PowerShell ${versionPs}.`);
  console.log('Ce mode sert au développement. Il ne prouve la couverture d\u2019AUCUN autre moteur :');
  console.log('en intégration continue, passe --powershell powershell puis --powershell pwsh.');
}
const majeurPs = Number(String(versionPs).split('.')[0]) || 0;

// ---------------------------------------------------------------------------
// Outillage commun
// ---------------------------------------------------------------------------
const travail = mkdtempSync(join(tmpdir(), 'kjemo-poste-'));
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
function ecrirePs1(chemin, contenu) {
  writeFileSync(chemin, Buffer.concat([BOM, Buffer.from(contenu, 'utf8')]));
  return chemin;
}
function psLitteral(texte) {
  return `'${String(texte).replace(/'/g, "''")}'`;
}
function executerBanc(chemin) {
  const r = spawnSync(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', chemin],
    { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    code: r.status,
    erreurLancement: r.error ? String(r.error.message) : '',
    stdout: String(r.stdout ?? ''),
    stderr: String(r.stderr ?? ''),
  };
}
function diagnostic(nom, resultat) {
  console.log(`\n  ---- Diagnostic ${nom} : ${pwsh} (PowerShell ${versionPs}), code ${resultat.code} ----`);
  if (resultat.erreurLancement) console.log(`  lancement : ${resultat.erreurLancement}`);
  const extrait = (t) => t.split(/\r?\n/).filter((l) => l.trim()).slice(-40).map((l) => `  | ${l}`).join('\n');
  console.log('  sortie d\u2019erreur :');
  console.log(extrait(resultat.stderr) || '  | (vide)');
  console.log('  sortie standard (40 dernières lignes) :');
  console.log(extrait(resultat.stdout) || '  | (vide)');
  console.log('  ---- fin du diagnostic ----\n');
}
function appelsDe(journal) {
  return existsSync(journal)
    ? readFileSync(journal, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : [];
}
function outilOuEchec(id) {
  const o = tools.find((t) => t.id === id);
  if (!o) { console.log(`\nOutil ${id} absent du catalogue.`); process.exit(1); }
  return o;
}
function valeursDe(outil, surcharges = {}) {
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  return { ...base, ...surcharges };
}

/**
 * Le décor Windows minimal, commun aux trois bancs.
 *
 * Ces bancs tournent sous Linux. Les doublures portent [CmdletBinding()] et ne
 * déclarent PAS -ErrorAction : c'est un paramètre commun, fourni d'office aux
 * fonctions avancées, et le redéclarer ferait échouer la liaison — le script
 * prendrait l'échec pour un résultat.
 *
 * Le banc est en ASCII pur : il porte un BOM comme tout .ps1 du projet, mais
 * un banc sans caractère accentué ne peut pas faire échouer la contre-épreuve
 * pour une raison d'encodage.
 */
function decorWindows({ eleve = true } = {}) {
  return `
$ErrorActionPreference = 'Continue'
$env:SystemRoot = ${psLitteral('/tmp/faux-windows')}
$env:SystemDrive = 'C:'
$env:COMPUTERNAME = 'POSTE-BANC'
$env:USERNAME = 'banc'

function Write-KjemoAppel { param([string]$Nom)
  Add-Content -LiteralPath $global:KjemoJournal -Value $Nom
}

# --- Elevation : le script la lit par .NET, on la force ici -----------------
# Les deux assistants qui arretent un service exigent une console elevee. Le
# banc permet de jouer les deux cas, elevee et non elevee.
$global:KjemoForcerEleve = ${eleve ? '$true' : '$false'}

function Get-CimInstance {
  [CmdletBinding()] param([string]$ClassName, [string]$Namespace, $Filter)
  switch -Wildcard ($ClassName) {
    'Win32_OperatingSystem' {
      return [pscustomobject]@{ Caption = 'Windows 11 Pro (banc)'; Version = '10.0.22631'
        BuildNumber = '22631'; LastBootUpTime = (Get-Date).AddHours(-5)
        TotalVisibleMemorySize = 16777216; FreePhysicalMemory = 8388608
        InstallDate = (Get-Date).AddYears(-2) }
    }
    'Win32_LogicalDisk' {
      return @([pscustomobject]@{ DeviceID = 'C:'; DriveType = 3; VolumeName = 'Systeme'
        Size = 512000000000; FreeSpace = 128000000000 })
    }
    'Win32_Process' { return @() }
    default { return @() }
  }
}
function Get-WinEvent { [CmdletBinding()] param($FilterHashtable) return @() }
function Get-HotFix { [CmdletBinding()] param() return @() }
function Get-MpComputerStatus { [CmdletBinding()] param() return $null }
function Get-NetIPConfiguration { [CmdletBinding()] param() return @() }
function Get-PnpDevice { [CmdletBinding()] param([string]$Class) return @() }
function Get-PhysicalDisk { [CmdletBinding()] param() return @() }
function Get-Command {
  [CmdletBinding()] param([string]$Name)
  return [pscustomobject]@{ Name = $Name; Source = ('/usr/bin/' + $Name) }
}
function Get-AuthenticodeSignature {
  [CmdletBinding()] param([string]$LiteralPath)
  return [pscustomobject]@{ Status = 'Valid' }
}
function Get-Acl { [CmdletBinding()] param($LiteralPath, $Path)
  return [pscustomobject]@{ Owner = 'BANC\\\\admin'; Access = @() }
}
`;
}

/** L'en-tête commun d'un banc : journal remis à zéro, doublure d'élévation. */
function entete(journal) {
  return `
$global:KjemoJournal = ${psLitteral(journal)}
if (Test-Path -LiteralPath $global:KjemoJournal) { Remove-Item -LiteralPath $global:KjemoJournal }
`;
}

/**
 * Le script sous test lit l'élévation par [Security.Principal.WindowsIdentity].
 * Cette classe n'existe pas sous Linux : l'appel échoue, $KjemoEleve reste
 * $false, et les verrous se ferment pour la mauvaise raison. On réécrit donc
 * cette seule ligne du script — pas le verrou, pas la condition, juste la
 * lecture de l'élévation — pour pouvoir jouer les deux cas.
 */
function avecElevation(script, eleve) {
  // Les TROIS lignes sont remplacees, pas seulement la derniere : sous Linux,
  // « New-Object Security.Principal.WindowsPrincipal » leve avant meme
  // d'atteindre la ligne qui affecte $KjemoEleve. Le try l'avale, la variable
  // reste a $false, et le verrou se fermerait pour la mauvaise raison — le
  // banc mesurerait alors l'absence de .NET Windows, pas le verrou.
  const avant = [
    '  $identite = [Security.Principal.WindowsIdentity]::GetCurrent()',
    '  $principal = New-Object Security.Principal.WindowsPrincipal($identite)',
    '  $KjemoEleve = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
  ].join('\n');
  if (!script.includes(avant)) {
    throw new Error('le bloc d\u2019élévation attendu est absent du script généré');
  }
  return script.replace(avant, `  $KjemoEleve = ${eleve ? '$true' : '$false'}`);
}

/**
 * Le gardien de chemin du script s'appuie sur deux API .NET dont le
 * comportement DEPEND DE LA PLATEFORME :
 *
 *   [System.IO.Path]::IsPathRooted('C:\\Kjemo')  -> $false sous Linux
 *   [System.IO.Path]::GetFullPath('C:\\Kjemo')   -> un chemin relatif a /tmp
 *
 * Sous Linux, un chemin Windows parfaitement valide est donc refuse, et le
 * verrou se fermerait pour une raison qui n'existe pas sur la machine cible.
 * Le banc mesurerait alors la plateforme, pas le verrou.
 *
 * On remplace donc ces DEUX appels, et eux seuls, par leur equivalent
 * independant de la plateforme. La LOGIQUE du gardien — chemin vide, relatif,
 * racine de volume, UNC, dossier protege — reste exactement celle du script :
 * c'est elle qui est eprouvee, y compris par les refus qu'on lui soumet.
 */
function avecCheminsWindows(script) {
  let sortie = script;
  const rooted = '  if (-not [System.IO.Path]::IsPathRooted($Chemin)) {';
  if (sortie.includes(rooted)) {
    sortie = sortie.replace(rooted, "  if ($Chemin -notmatch '^[A-Za-z]:\\\\' -and $Chemin -notlike '\\\\*') {");
  }
  const full = '  try { $canon = [System.IO.Path]::GetFullPath($Chemin) } catch { }';
  if (sortie.includes(full)) {
    sortie = sortie.replace(full, '  try { $canon = ([string]$Chemin) } catch { }');
  }
  return sortie;
}

// ===========================================================================
// A. audio-diagnostic — zéro Restart-Service quand une condition manque
// ===========================================================================
section('audio-diagnostic — le verrou bloque-t-il Restart-Service ?');

const outilAudio = outilOuEchec('audio-diagnostic');

function bancAudio({ journal, script, servicesPresents = true }) {
  return entete(journal) + decorWindows() + `
# --- Mouchard : la seule cmdlet modifiante de cet assistant -----------------
function Restart-Service {
  [CmdletBinding()] param([string]$Name)
  Write-KjemoAppel 'Restart-Service'
  return $null
}
function Get-Service {
  [CmdletBinding()] param([string]$Name)
  ${servicesPresents
    ? "return [pscustomobject]@{ Name = $Name; DisplayName = ('Service ' + $Name); Status = 'Running'; StartType = 'Automatic' }"
    : 'return $null'}
}

. ${psLitteral(script)}
`;
}

function jouerAudio(nom, { mode, confirmation, eleve, servicesPresents = true, abimer = false }) {
  const valeurs = valeursDe(outilAudio, { mode, audConfirmation: confirmation });
  let script;
  try { script = outilAudio.generate(valeurs); } catch (e) { return { refus: e.message }; }
  script = avecElevation(script, eleve);
  if (abimer) {
    const verrou = "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {";
    if (!script.includes(verrou)) return { refus: 'verrou introuvable' };
    script = script.replace(verrou, 'if ($false) {');
  }
  const journal = join(travail, `audio-${nom}.txt`);
  const cheminScript = ecrirePs1(join(travail, `audio-${nom}.ps1`), script);
  const banc = ecrirePs1(join(travail, `banc-audio-${nom}.ps1`),
    bancAudio({ journal, script: cheminScript, servicesPresents }));
  const resultat = executerBanc(banc);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

const MARQUEUR_AUDIO = /=== audio-diagnostic -/;
const PHRASE_AUDIO = 'JE REDEMARRE LE SERVICE AUDIO';

{
  // A1 — contrôle positif : toutes les conditions réunies, un appel attendu
  // par service, soit exactement deux.
  const b = jouerAudio('positif', { mode: 'Appliquer', confirmation: PHRASE_AUDIO, eleve: true });
  const avant = failed;
  assert(!b.refus, `contrôle positif : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(MARQUEUR_AUDIO.test(b.resultat.stdout), 'contrôle positif : le script s’est exécuté jusqu’au rapport');
    const n = b.appels.filter((a) => a === 'Restart-Service').length;
    assert(n === 2, `contrôle positif : Restart-Service appelé pour les DEUX services (${n})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('audio positif', b.resultat);
  }
}
{
  // A2 — console non élevée : zéro appel.
  const b = jouerAudio('nonEleve', { mode: 'Appliquer', confirmation: PHRASE_AUDIO, eleve: false });
  const avant = failed;
  assert(MARQUEUR_AUDIO.test(b.resultat.stdout), 'console non élevée : le script s’est exécuté jusqu’au rapport');
  assert(b.appels.length === 0, `console non élevée : ZÉRO appel modifiant (${b.appels.length})`,
    b.appels.join(', ') || '(vide)');
  assert(/BLOQU/i.test(b.sortie), 'console non élevée : le script annonce le blocage');
  assert(/non elevee/i.test(b.sortie), 'console non élevée : le script nomme la condition manquante');
  if (failed > avant) diagnostic('audio non élevé', b.resultat);
}
{
  // A3 — confirmation absente : le formulaire refuse AVANT même de générer.
  const valeurs = valeursDe(outilAudio, { mode: 'Appliquer', audConfirmation: '' });
  const errs = outilAudio.validate(valeurs);
  assert(Boolean(errs.audConfirmation),
    'confirmation absente : la validation du formulaire refuse, aucun script n’est même produit');
}
{
  // A4 — services introuvables : zéro appel.
  const b = jouerAudio('sansServices', { mode: 'Appliquer', confirmation: PHRASE_AUDIO, eleve: true, servicesPresents: false });
  const avant = failed;
  assert(MARQUEUR_AUDIO.test(b.resultat.stdout), 'services absents : le script s’est exécuté jusqu’au rapport');
  assert(b.appels.length === 0, `services absents : ZÉRO appel modifiant (${b.appels.length})`,
    b.appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('audio sans services', b.resultat);
}
{
  // A5 — mode Diagnostic : zéro appel, quoi qu'il arrive.
  const b = jouerAudio('diag', { mode: 'Diagnostic', confirmation: '', eleve: true });
  assert(b.appels.length === 0, `mode Diagnostic : ZÉRO appel modifiant (${b.appels.length})`,
    b.appels.join(', ') || '(vide)');
}
{
  // A6 — CONTRE-ÉPREUVE : le verrou désarmé, l'appel interdit doit être vu.
  const b = jouerAudio('abime', { mode: 'Appliquer', confirmation: PHRASE_AUDIO, eleve: false, abimer: true });
  const avant = failed;
  assert(!b.refus, `contre-épreuve : le verrou a pu être désarmé${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    const n = b.appels.filter((a) => a === 'Restart-Service').length;
    assert(n > 0,
      `contre-épreuve — sans le verrou, Restart-Service s’exécute malgré la console non élevée (${n})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('audio contre-épreuve', b.resultat);
  }
}

// ===========================================================================
// B. windows-update-repair — zéro Rename-Item quand une condition manque
// ===========================================================================
section('windows-update-repair — le verrou bloque-t-il Rename-Item ?');

const outilWur = outilOuEchec('windows-update-repair');
const PHRASE_WUR = 'JE REINITIALISE L AFFICHAGE DE L HISTORIQUE';

/**
 * La doublure des services est un ÉTAT, pas une constante.
 *
 * C'est tout l'objet du correctif : le script ne croit plus Stop-Service sur
 * parole, il relit chaque service. Une doublure qui répondrait toujours
 * « Running » ferait échouer le contrôle positif, et une doublure qui
 * répondrait toujours « Stopped » rendrait la relecture invisible. Il faut
 * donc un état qui change — et des passes où, exprès, il ne change pas.
 *
 * `etatsInitiaux` fixe l'état de départ service par service. C'est lui qui
 * décide de ce que le script doit redémarrer à la fin : un service arrêté
 * avant l'intervention doit rester arrêté après.
 */
function bancWur({
  journal, script,
  etatsInitiaux = { wuauserv: 'Running', bits: 'Running', cryptsvc: 'Running', msiserver: 'Running' },
  arretEchoue = false,
  arretSansEffet = false,
  arretLaisse = null,
  journalEchoue = false,
  dossiersPresents = true,
  renommageEchoueSur = null,
  sauvegardeSubsiste = false,
}) {
  const etats = Object.entries(etatsInitiaux)
    .map(([n, s]) => `  ${n} = '${s}'`).join('\n');
  return entete(journal) + decorWindows() + `
# --- L'etat des services, qui VARIE au fil de la passe ---------------------
$script:EtatServices = @{
${etats}
}

# --- Mouchards : les cmdlets modifiantes de cet assistant ------------------
function Rename-Item {
  [CmdletBinding()] param([string]$LiteralPath, [string]$NewName)
  Write-KjemoAppel ('Rename-Item ' + $LiteralPath + ' -> ' + $NewName)
  ${renommageEchoueSur
    ? `if (($LiteralPath + ' ' + $NewName) -like '*${renommageEchoueSur}*') { throw 'ECHEC SIMULE DU RENOMMAGE' }`
    : ''}
  return $null
}
function Stop-Service {
  [CmdletBinding()] param([string]$Name)
  Write-KjemoAppel ('Stop-Service ' + $Name)
  ${arretEchoue ? "throw 'ECHEC SIMULE DE L ARRET DU SERVICE'" : ''}
  ${arretSansEffet
    ? '# La commande rend la main sans erreur, mais le service tourne encore.'
    : arretLaisse
      ? `# La commande reussit, mais laisse le service dans un etat intermediaire.
  $script:EtatServices[$Name] = '${arretLaisse}'`
      : "$script:EtatServices[$Name] = 'Stopped'"}
  return $null
}
function Start-Service {
  [CmdletBinding()] param([string]$Name)
  Write-KjemoAppel ('Start-Service ' + $Name)
  $script:EtatServices[$Name] = 'Running'
  return $null
}
function New-Item {
  [CmdletBinding()] param([string]$ItemType, [string]$Path)
  Write-KjemoAppel 'New-Item'
  ${journalEchoue ? "throw 'ECHEC SIMULE DE CREATION DU DOSSIER DE JOURNAL'" : 'return $null'}
}
function Set-Content {
  [CmdletBinding()] param([string]$LiteralPath, $Value, [string]$Encoding)
  ${journalEchoue ? "throw 'ECHEC SIMULE D ECRITURE DU JOURNAL'" : "Write-KjemoAppel 'Set-Content' ; return $null"}
}
function Get-Service {
  [CmdletBinding()] param([string]$Name)
  if (-not $script:EtatServices.ContainsKey($Name)) { return $null }
  return [pscustomobject]@{
    Name = $Name
    DisplayName = ('Service ' + $Name)
    Status = $script:EtatServices[$Name]
    StartType = 'Automatic'
  }
}
function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  # Le dossier de journal n'existe pas encore : le script doit le creer.
  # Les dossiers de Windows, eux, sont presents ou non selon la passe.
  if ($cible -notlike '*faux-windows*') { return $false }
  ${sauvegardeSubsiste
    // Le nom d'origine est revenu, MAIS la sauvegarde horodatee existe
    // encore : deux dossiers au lieu d'un. Ce n'est pas l'etat de depart.
    ? "if ($cible -like '*.kjemo-*') { return $true }"
    : "if ($cible -like '*.kjemo-*') { return $false }"}
  ${dossiersPresents ? 'return $true' : 'return $false'}
}
function Get-ChildItem {
  [CmdletBinding()] param([string]$LiteralPath, [string]$Path, [string]$Filter, [switch]$Recurse, [switch]$File, [switch]$Directory)
  return @()
}
function Join-Path {
  [CmdletBinding()] param([Parameter(Position=0)]$Path, [Parameter(Position=1)]$ChildPath)
  if (-not $Path) { return [string]$ChildPath }
  return ((([string]$Path) -replace '[\\\\/]+$', '') + '\\\\' + [string]$ChildPath)
}

. ${psLitteral(script)}

# --- L'etat FINAL des services, releve apres la passe ----------------------
foreach ($n in ($script:EtatServices.Keys | Sort-Object)) {
  Write-KjemoAppel ('FINAL ' + $n + '=' + $script:EtatServices[$n])
}
`;
}

function jouerWur(nom, opts) {
  const { mode, confirmation, eleve, cible, abimer = false, ...reste } = opts;
  const valeurs = valeursDe(outilWur, {
    mode, wurConfirmation: confirmation, ...(cible ? { wurCible: cible } : {}),
  });
  let script;
  try { script = outilWur.generate(valeurs); } catch (e) { return { refus: e.message }; }
  script = avecCheminsWindows(avecElevation(script, eleve));
  if (abimer) {
    const verrou = "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {";
    if (!script.includes(verrou)) return { refus: 'verrou introuvable' };
    script = script.replace(verrou, 'if ($false) {');
  }
  const journal = join(travail, `wur-${nom}.txt`);
  const cheminScript = ecrirePs1(join(travail, `wur-${nom}.ps1`), script);
  const banc = ecrirePs1(join(travail, `banc-wur-${nom}.ps1`),
    bancWur({ journal, script: cheminScript, ...reste }));
  const resultat = executerBanc(banc);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

const MARQUEUR_WUR = /=== windows-update-repair -/;
// Les mouchards consignent desormais leurs arguments : on compte par prefixe.
const comptePrefixe = (appels, prefixe) => appels.filter((a) => a.startsWith(prefixe)).length;
const renommages = (appels) => comptePrefixe(appels, 'Rename-Item');
const etatFinal = (appels, service) => {
  const l = appels.find((a) => a.startsWith(`FINAL ${service}=`));
  return l ? l.split('=')[1] : '(non releve)';
};

{
  // B1 — contrôle positif.
  const b = jouerWur('positif', { mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true });
  const avant = failed;
  assert(!b.refus, `contrôle positif : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(MARQUEUR_WUR.test(b.resultat.stdout), 'contrôle positif : le script s’est exécuté jusqu’au rapport');
    assert(renommages(b.appels) === 1,
      `contrôle positif : Rename-Item appelé une fois, pour SoftwareDistribution (${renommages(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(b.appels.includes('Set-Content'),
      'contrôle positif : le journal est écrit AVANT l’action', b.appels.join(', '));
    assert(b.appels.indexOf('Set-Content') < b.appels.findIndex((a) => a.startsWith('Rename-Item')),
      'contrôle positif : le journal précède bien le renommage dans l’ordre des appels',
      b.appels.join(' → '));
    if (failed > avant) diagnostic('wur positif', b.resultat);
  }
}
{
  // B2 — console non élevée : zéro renommage.
  const b = jouerWur('nonEleve', { mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: false });
  const avant = failed;
  assert(MARQUEUR_WUR.test(b.resultat.stdout), 'console non élevée : exécution jusqu’au rapport');
  assert(renommages(b.appels) === 0, `console non élevée : ZÉRO Rename-Item (${renommages(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(comptePrefixe(b.appels, 'Stop-Service') === 0, 'console non élevée : aucun service n’est même arrêté');
  assert(/BLOQU/i.test(b.sortie), 'console non élevée : le script annonce le blocage');
  if (failed > avant) diagnostic('wur non élevé', b.resultat);
}
{
  // B3 — LE CAS QUI COMPTE : le journal n'a pas pu être écrit.
  // La mission exige une sauvegarde ou un journal AVANT modification. Si le
  // journal échoue, l'opération n'est pas traçable : elle ne doit pas avoir
  // lieu.
  const b = jouerWur('sansJournal', { mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true, journalEchoue: true });
  const avant = failed;
  assert(MARQUEUR_WUR.test(b.resultat.stdout), 'journal en échec : exécution jusqu’au rapport');
  assert(renommages(b.appels) === 0, `journal en échec : ZÉRO Rename-Item (${renommages(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(comptePrefixe(b.appels, 'Stop-Service') === 0, 'journal en échec : aucun service n’est arrêté non plus');
  assert(/journal/i.test(b.sortie), 'journal en échec : le script nomme le journal comme condition manquante');
  if (failed > avant) diagnostic('wur sans journal', b.resultat);
}
{
  // B4 — SECOND VERROU : Stop-Service a échoué franchement.
  const b = jouerWur('arretEchoue', { mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true, arretEchoue: true });
  const avant = failed;
  assert(MARQUEUR_WUR.test(b.resultat.stdout), 'arrêt en échec : exécution jusqu’au rapport');
  assert(comptePrefixe(b.appels, 'Stop-Service') > 0, 'arrêt en échec : l’arrêt a bien été TENTÉ');
  assert(renommages(b.appels) === 0,
    `arrêt en échec : ZÉRO Rename-Item — le second verrou a tenu (${renommages(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/BLOQU/i.test(b.sortie), 'arrêt en échec : le script annonce le blocage du renommage');
  if (failed > avant) diagnostic('wur arrêt échoué', b.resultat);
}
{
  // B4 bis — LE CAS QUE CODEX A RELEVÉ : Stop-Service rend la main SANS
  // erreur, et le service tourne encore. L'ancienne version renommait. La
  // nouvelle relit chaque service, et c'est cette relecture qui décide.
  const b = jouerWur('arretSansEffet', {
    mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true, arretSansEffet: true,
  });
  const avant = failed;
  assert(MARQUEUR_WUR.test(b.resultat.stdout), 'arrêt sans effet : exécution jusqu’au rapport');
  assert(comptePrefixe(b.appels, 'Stop-Service') === 4,
    `arrêt sans effet : les quatre arrêts ont été demandés et ACCEPTÉS (${comptePrefixe(b.appels, 'Stop-Service')})`);
  assert(renommages(b.appels) === 0,
    `arrêt sans effet : ZÉRO Rename-Item — la relecture, et non Stop-Service, autorise le renommage (${renommages(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/Arret reel de/i.test(b.sortie), 'arrêt sans effet : le rapport porte la ligne de relecture');
  assert(/BLOQU/i.test(b.sortie), 'arrêt sans effet : le script annonce le blocage du renommage');
  if (failed > avant) diagnostic('wur arrêt sans effet', b.resultat);
}
{
  // B4 ter — L'ÉTAT DE DÉPART EST RESTITUÉ : un service actif avant doit
  // tourner après.
  const b = jouerWur('etatActif', { mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true });
  const avant = failed;
  for (const n of ['wuauserv', 'bits', 'cryptsvc', 'msiserver']) {
    assert(etatFinal(b.appels, n) === 'Running',
      `service actif au départ : ${n} tourne de nouveau à la fin (${etatFinal(b.appels, n)})`);
  }
  if (failed > avant) diagnostic('wur état actif', b.resultat);
}
{
  // B4 quater — ET SURTOUT L'INVERSE : un service ARRÊTÉ avant l'intervention
  // doit rester arrêté. Le redémarrer « pour faire propre » changerait la
  // configuration de la machine sans que personne l'ait demandé.
  const b = jouerWur('etatArrete', {
    mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true,
    etatsInitiaux: { wuauserv: 'Running', bits: 'Stopped', cryptsvc: 'Running', msiserver: 'Stopped' },
  });
  const avant = failed;
  assert(etatFinal(b.appels, 'bits') === 'Stopped',
    `service arrêté au départ : bits est TOUJOURS arrêté à la fin (${etatFinal(b.appels, 'bits')})`);
  assert(etatFinal(b.appels, 'msiserver') === 'Stopped',
    `service arrêté au départ : msiserver est TOUJOURS arrêté à la fin (${etatFinal(b.appels, 'msiserver')})`);
  assert(etatFinal(b.appels, 'wuauserv') === 'Running',
    `service actif au départ : wuauserv tourne de nouveau (${etatFinal(b.appels, 'wuauserv')})`);
  assert(comptePrefixe(b.appels, 'Stop-Service bits') === 0,
    'service déjà arrêté : aucun Stop-Service inutile ne lui est envoyé');
  assert(comptePrefixe(b.appels, 'Start-Service bits') === 0,
    'service déjà arrêté : il n’est pas redémarré « pour faire propre »');
  assert(renommages(b.appels) === 1,
    `services partiellement arrêtés au départ : le renommage a bien lieu (${renommages(b.appels)})`);
  if (failed > avant) diagnostic('wur état arrêté', b.resultat);
}
{
  // B4 quinquies — RENOMMAGE TRANSACTIONNEL. Cible « Les deux » :
  // SoftwareDistribution passe, catroot2 échoue. Aucun état partiel ne doit
  // subsister, et le script ne doit surtout pas annoncer une réussite.
  const b = jouerWur('transactionnel', {
    mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true,
    cible: 'Les deux', renommageEchoueSur: 'catroot2',
  });
  const avant = failed;
  assert(MARQUEUR_WUR.test(b.resultat.stdout), 'transaction : exécution jusqu’au rapport');
  const renommagesFaits = b.appels.filter((a) => a.startsWith('Rename-Item'));
  assert(renommagesFaits.length === 3,
    `transaction : 2 tentatives puis 1 retour en arrière = 3 appels Rename-Item (${renommagesFaits.length})`,
    renommagesFaits.join(' | '));
  assert(/SoftwareDistribution\.kjemo/.test(renommagesFaits[0] || ''),
    'transaction : le premier renommage vise bien SoftwareDistribution', renommagesFaits[0] || '(aucun)');
  assert(/catroot2/.test(renommagesFaits[1] || ''),
    'transaction : le second vise catroot2 et échoue', renommagesFaits[1] || '(aucun)');
  assert(/-> SoftwareDistribution$/.test(renommagesFaits[2] || ''),
    'transaction : SoftwareDistribution est REMIS à son nom d’origine',
    renommagesFaits[2] || '(aucun retour en arrière)');
  assert(/ECHEC EN COURS DE ROUTE : retour en arriere/.test(b.sortie),
    'transaction : le script annonce à l’écran le retour en arrière');
  assert(!/--- Et maintenant ---/.test(b.sortie),
    'transaction : le bloc de réussite « Et maintenant » n’est PAS affiché');
  assert(!/Ouvrir Parametres > Windows Update/.test(b.sortie),
    'transaction : aucune réussite n’est annoncée après un état partiel');
  if (failed > avant) diagnostic('wur transaction', b.resultat);
}
{
  // B5 — mode Diagnostic : zéro appel modifiant.
  const b = jouerWur('diag', { mode: 'Diagnostic', confirmation: '', eleve: true });
  assert(renommages(b.appels) === 0, `mode Diagnostic : ZÉRO Rename-Item (${renommages(b.appels)})`);
  assert(comptePrefixe(b.appels, 'Stop-Service') === 0, 'mode Diagnostic : aucun service arrêté');
}
{
  // B6 — CONTRE-ÉPREUVE du verrou principal.
  const b = jouerWur('abime', { mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: false, abimer: true });
  const avant = failed;
  assert(!b.refus, `contre-épreuve : le verrou a pu être désarmé${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(renommages(b.appels) > 0,
      `contre-épreuve — sans le verrou, Rename-Item s’exécute malgré la console non élevée (${renommages(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('wur contre-épreuve', b.resultat);
  }
}
{
  // B7 — CONTRE-ÉPREUVE du second verrou, celui de la RELECTURE. On le désarme
  // seul, le verrou principal restant en place, et l'on montre que le
  // renommage a alors lieu alors que les services tournent encore.
  const valeurs = valeursDe(outilWur, { mode: 'Appliquer', wurConfirmation: PHRASE_WUR });
  let script = avecCheminsWindows(avecElevation(outilWur.generate(valeurs), true));
  const second = '  if (-not $tousArretes) {';
  const avant = failed;
  assert(script.includes(second), 'le script porte bien le second verrou, sur la relecture des services');
  script = script.replace(second, '  if ($false) {');
  const journal = join(travail, 'wur-abime2.txt');
  const cheminScript = ecrirePs1(join(travail, 'wur-abime2.ps1'), script);
  const banc = ecrirePs1(join(travail, 'banc-wur-abime2.ps1'),
    bancWur({ journal, script: cheminScript, arretSansEffet: true }));
  const resultat = executerBanc(banc);
  const appels = appelsDe(journal);
  assert(renommages(appels) > 0,
    `contre-épreuve — sans le second verrou, le renommage a lieu alors que les services tournent encore (${renommages(appels)})`,
    appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('wur contre-épreuve second verrou', resultat);
}

{
  // B8 — LES ÉTATS QUI NE SONT NI Running NI Stopped.
  //
  // Codex a relevé que tester « différent de Running » laisse passer cinq
  // états : Paused, StopPending, StartPending, ContinuePending,
  // PausePending. Un service Paused garde ses fichiers ouverts ; un service
  // StopPending est encore en train de les fermer. Dans les deux cas,
  // renommer le dossier casse Windows Update plus profondément.
  //
  // D'abord les états INITIAUX : le script doit bloquer avant d'agir, et ne
  // JAMAIS tenter de convertir un service en transition.
  for (const statut of ['Paused', 'StopPending', 'StartPending', 'ContinuePending', 'PausePending']) {
    const b = jouerWur(`initial-${statut}`, {
      mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true,
      etatsInitiaux: { wuauserv: statut, bits: 'Running', cryptsvc: 'Running', msiserver: 'Running' },
    });
    const avant = failed;
    assert(MARQUEUR_WUR.test(b.resultat.stdout), `état initial ${statut} : exécution jusqu’au rapport`);
    assert(comptePrefixe(b.appels, 'Stop-Service') === 0,
      `état initial ${statut} : ZÉRO Stop-Service — le script ne tente pas de convertir l’état (${comptePrefixe(b.appels, 'Stop-Service')})`,
      b.appels.join(', ') || '(vide)');
    assert(renommages(b.appels) === 0,
      `état initial ${statut} : ZÉRO Rename-Item (${renommages(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(/etat initial non stable/i.test(b.sortie),
      `état initial ${statut} : le script nomme la cause — état initial non stable`);
    assert(/BLOQU/i.test(b.sortie), `état initial ${statut} : le script annonce le blocage`);
    if (failed > avant) diagnostic(`wur initial ${statut}`, b.resultat);
  }
}
{
  // B9 — Les mêmes états, mais APRÈS la demande d'arrêt. Départ propre, donc
  // le script agit ; puis Stop-Service laisse le service dans un état
  // intermédiaire. C'est la relecture stricte qui doit bloquer le renommage.
  for (const statut of ['StopPending', 'Paused', 'PausePending', 'ContinuePending', 'StartPending']) {
    const b = jouerWur(`apres-${statut}`, {
      mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true,
      arretLaisse: statut,
    });
    const avant = failed;
    assert(MARQUEUR_WUR.test(b.resultat.stdout), `relecture ${statut} : exécution jusqu’au rapport`);
    assert(comptePrefixe(b.appels, 'Stop-Service') === 4,
      `relecture ${statut} : les quatre arrêts ont bien été demandés et ACCEPTÉS (${comptePrefixe(b.appels, 'Stop-Service')})`);
    assert(renommages(b.appels) === 0,
      `relecture ${statut} : ZÉRO Rename-Item — « pas Running » ne vaut pas « Stopped » (${renommages(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(new RegExp(statut).test(b.sortie),
      `relecture ${statut} : le rapport nomme le statut réellement lu`);
    assert(/BLOQU/i.test(b.sortie), `relecture ${statut} : le script annonce le blocage du renommage`);
    if (failed > avant) diagnostic(`wur relecture ${statut}`, b.resultat);
  }
}
{
  // B10 — Le contrôle positif de la règle stricte : QUATRE Stopped, et
  // seulement là, le renommage est autorisé. Sans lui, une règle qui
  // bloquerait tout ferait passer les cinq tests précédents.
  const b = jouerWur('quatreStopped', { mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true });
  const avant = failed;
  assert(renommages(b.appels) === 1,
    `quatre services Stopped : le renommage est autorisé (${renommages(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  for (const n of ['wuauserv', 'bits', 'cryptsvc', 'msiserver']) {
    assert(etatFinal(b.appels, n) === 'Running',
      `quatre services Stopped : ${n} est bien revenu à son état de départ (${etatFinal(b.appels, n)})`);
  }
  if (failed > avant) diagnostic('wur quatre Stopped', b.resultat);
}
{
  // B11 — CONTRE-ÉPREUVE de la règle stricte. On remet la condition fautive
  // relevée par Codex — `-eq 'Running'` au lieu de `-ne 'Stopped'` — et
  // l'appel interdit doit réapparaître sur un service laissé Paused.
  const valeurs = valeursDe(outilWur, { mode: 'Appliquer', wurConfirmation: PHRASE_WUR });
  let script = avecCheminsWindows(avecElevation(outilWur.generate(valeurs), true));
  const avant = failed;
  const stricte = "    if ($statutRelu -ne 'Stopped') {";
  assert(script.includes(stricte), 'le script porte bien la règle stricte sur Stopped');
  script = script.replace(stricte, "    if ($statutRelu -eq 'Running') {");
  const journal = join(travail, 'wur-abime-stopped.txt');
  const cheminScript = ecrirePs1(join(travail, 'wur-abime-stopped.ps1'), script);
  const banc = ecrirePs1(join(travail, 'banc-wur-abime-stopped.ps1'),
    bancWur({ journal, script: cheminScript, arretLaisse: 'Paused' }));
  const resultat = executerBanc(banc);
  const appels = appelsDe(journal);
  assert(renommages(appels) > 0,
    `contre-épreuve — avec la condition fautive « -eq Running », le renommage a lieu sur un service Paused (${renommages(appels)})`,
    appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('wur contre-épreuve Stopped', resultat);
}
{
  // B12 — LE RETOUR TRANSACTIONNEL À MOITIÉ FAIT. Le nom d'origine est bien
  // présent, mais la sauvegarde horodatée existe ENCORE : deux dossiers au
  // lieu d'un. Ce n'est pas l'état de départ, et le script doit le dire.
  const b = jouerWur('retourPartiel', {
    mode: 'Appliquer', confirmation: PHRASE_WUR, eleve: true,
    cible: 'Les deux', renommageEchoueSur: 'catroot2', sauvegardeSubsiste: true,
  });
  const avant = failed;
  assert(MARQUEUR_WUR.test(b.resultat.stdout), 'retour partiel : exécution jusqu’au rapport');
  assert(/etat intermediaire/i.test(b.sortie),
    'retour partiel : le script produit PROBLEME et parle d’un état intermédiaire, pas d’un retour réussi');
  assert(/sauvegarde horodatee existe ENCORE|deux dossiers au lieu d/i.test(b.sortie),
    'retour partiel : le script dit précisément pourquoi — deux dossiers au lieu d’un');
  assert(!/--- Et maintenant ---/.test(b.sortie),
    'retour partiel : aucune réussite n’est annoncée');
  if (failed > avant) diagnostic('wur retour partiel', b.resultat);
}

// ===========================================================================
// C. process-hung — zéro Stop-Process quand une condition manque
// ===========================================================================
section('process-hung — le verrou bloque-t-il Stop-Process ?');

const outilProc = outilOuEchec('process-hung');
const PHRASE_PROC = 'JE PERDS LES DONNEES NON ENREGISTREES';
const PID_BANC = '4242';

/**
 * La doublure de Get-Process doit pouvoir MENTIR DEUX FOIS DIFFÉREMMENT.
 *
 * Le script lit le processus une première fois pour l'afficher, puis le relit
 * juste avant d'agir pour vérifier que le PID n'a pas été recyclé. Une
 * doublure qui répondrait toujours la même chose ne pourrait pas éprouver
 * cette relecture : il faut une doublure qui change de réponse entre le
 * premier et le second appel.
 *
 * `nomProcessus` nomme le processus rendu — c'est par lui qu'on place une
 * cible protégée comme lsass. `recycle` fait changer l'identité au second
 * appel : même PID, autre processus, exactement ce que fait Windows quand il
 * réattribue un PID libéré.
 */
function bancProc({
  journal, script,
  cibleExiste = true,
  nomProcessus = 'appbanc',
  recycle = false,
  departAvantNull = false,
  departReluNull = false,
  departsDifferents = false,
}) {
  return entete(journal) + decorWindows() + `
$script:LecturesCible = 0
# Une heure de demarrage FIXE : recalculee a chaque appel, elle differerait
# de quelques microsecondes et ferait echouer la comparaison d'identite pour
# une raison qui n'a rien a voir avec le verrou.
$script:DepartCible = (Get-Date).AddHours(-2)
$script:DepartAutre = (Get-Date).AddMinutes(-1)
function Stop-Process {
  [CmdletBinding()] param([int]$Id)
  Write-KjemoAppel ('Stop-Process ' + $Id)
  return $null
}
function Get-Process {
  [CmdletBinding()] param([string]$Name, [int]$Id)
  if ($PSBoundParameters.ContainsKey('Id')) {
    $script:LecturesCible = $script:LecturesCible + 1
    ${cibleExiste
      ? `${recycle ? `if ($script:LecturesCible -ge 2) {
      return [pscustomobject]@{ Id = $Id; ProcessName = 'autreappli'; WorkingSet64 = 1048576; Path = 'C:\\\\Autre\\\\autre.exe'; Responding = $true; MainWindowHandle = 2; CPU = 0.1; StartTime = $script:DepartAutre }
    }` : ''}
    ${departAvantNull || departReluNull || departsDifferents ? `$depart = $script:DepartCible
    ${departAvantNull ? 'if ($script:LecturesCible -eq 1) { $depart = $null }' : ''}
    ${departReluNull ? 'if ($script:LecturesCible -ge 2) { $depart = $null }' : ''}
    ${departsDifferents ? 'if ($script:LecturesCible -ge 2) { $depart = $script:DepartAutre }' : ''}` : '$depart = $script:DepartCible'}
    return [pscustomobject]@{ Id = $Id; ProcessName = '${nomProcessus}'; WorkingSet64 = 52428800; Path = 'C:\\\\Program Files\\\\AppBanc\\\\app.exe'; Responding = $false; MainWindowHandle = 1; CPU = 12.5; StartTime = $depart }`
      : 'return $null'}
  }
  return @([pscustomobject]@{ Id = 1234; ProcessName = 'autre'; WorkingSet64 = 10485760
    Responding = $true; MainWindowHandle = 1; CPU = 1.0; StartTime = (Get-Date).AddHours(-1) })
}
function Start-Sleep { [CmdletBinding()] param([int]$Seconds) return $null }

. ${psLitteral(script)}
`;
}

function jouerProc(nom, {
  mode, pid, confirmation, cibleExiste = true,
  nomProcessus = 'appbanc', recycle = false, cibleEstMoi = false, abimer = null,
  departAvantNull = false, departReluNull = false, departsDifferents = false,
}) {
  const valeurs = valeursDe(outilProc, { mode, prcPid: pid, prcConfirmation: confirmation });
  let script;
  try { script = outilProc.generate(valeurs); } catch (e) { return { refus: e.message }; }
  script = avecElevation(script, true);
  if (cibleEstMoi) {
    // On ne peut pas reaffecter $PID : c'est une variable automatique en
    // lecture seule. On reproduit donc la situation par l'autre bout, la
    // seule qui compte : la personne a recopie dans le formulaire le PID de
    // la console elle-meme. Le verrou, lui, n'est pas touche.
    const ligne = `$Cible = ${pid}`;
    if (!script.includes(ligne)) return { refus: 'ligne $Cible introuvable' };
    script = script.replace(ligne, '$Cible = $PID');
  }
  if (abimer) {
    if (!script.includes(abimer)) return { refus: `verrou introuvable : ${abimer}` };
    script = script.replace(abimer, 'if ($false) {');
  }
  const journal = join(travail, `proc-${nom}.txt`);
  const cheminScript = ecrirePs1(join(travail, `proc-${nom}.ps1`), script);
  const banc = ecrirePs1(join(travail, `banc-proc-${nom}.ps1`),
    bancProc({ journal, script: cheminScript, cibleExiste, nomProcessus, recycle,
      departAvantNull, departReluNull, departsDifferents }));
  const resultat = executerBanc(banc);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

const VERROU_PROC = "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {";
const VERROU_IDENTITE = '  if (-not $identiteStable) {';
const MARQUEUR_PROC = /=== process-hung -/;
const arrets = (appels) => appels.filter((a) => a.startsWith('Stop-Process')).length;

{
  // C1 — contrôle positif : exactement UN arrêt, jamais plus.
  const b = jouerProc('positif', { mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC });
  const avant = failed;
  assert(!b.refus, `contrôle positif : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(MARQUEUR_PROC.test(b.resultat.stdout), 'contrôle positif : exécution jusqu’au rapport');
    assert(arrets(b.appels) === 1, `contrôle positif : Stop-Process appelé EXACTEMENT une fois (${arrets(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(b.appels.includes(`Stop-Process ${PID_BANC}`),
      'contrôle positif : l’arrêt vise bien le PID demandé, et lui seul', b.appels.join(', '));
    if (failed > avant) diagnostic('proc positif', b.resultat);
  }
}
{
  // C2 — le PID ne correspond à aucun processus : zéro appel.
  const b = jouerProc('cibleAbsente', { mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, cibleExiste: false });
  const avant = failed;
  assert(MARQUEUR_PROC.test(b.resultat.stdout), 'cible absente : exécution jusqu’au rapport');
  assert(arrets(b.appels) === 0, `cible absente : ZÉRO Stop-Process (${arrets(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/BLOQU/i.test(b.sortie), 'cible absente : le script annonce le blocage');
  if (failed > avant) diagnostic('proc cible absente', b.resultat);
}
{
  // C2 bis — AUTO-PROTECTION : le PID demandé est celui de la console qui
  // exécute le script. S'arrêter soi-même fermerait la fenêtre et emporterait
  // le diagnostic. Avec confirmation écrite ET console élevée : toujours zéro.
  const b = jouerProc('autoProtection', {
    mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, cibleEstMoi: true,
  });
  const avant = failed;
  assert(MARQUEUR_PROC.test(b.resultat.stdout), 'auto-protection : exécution jusqu’au rapport');
  assert(arrets(b.appels) === 0,
    `auto-protection : ZÉRO Stop-Process alors que la cible est CETTE console (${arrets(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/CETTE console|cette console/.test(b.sortie),
    'auto-protection : le script nomme la raison du refus');
  assert(/BLOQU/i.test(b.sortie), 'auto-protection : le script annonce le blocage');
  if (failed > avant) diagnostic('proc auto-protection', b.resultat);
}
{
  // C2 ter — PROCESSUS PROTÉGÉS. Le PID de lsass est tout à fait ordinaire :
  // la règle « PID supérieur à 4 = non système » ne le protège pas. C'est la
  // liste de refus par nom, insensible à la casse, qui doit tenir.
  for (const [nom, etiquette] of [
    ['lsass', 'lsass'],
    ['LSASS', 'LSASS — la casse ne doit rien changer'],
    ['csrss', 'csrss'],
    ['winlogon', 'winlogon'],
    ['Registry', 'Registry'],
  ]) {
    const b = jouerProc(`protege-${nom}`, {
      mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, nomProcessus: nom,
    });
    const avant = failed;
    assert(arrets(b.appels) === 0,
      `processus protégé « ${etiquette} » : ZÉRO Stop-Process, confirmation et élévation comprises (${arrets(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(/protege|BLOQU/i.test(b.sortie),
      `processus protégé « ${etiquette} » : le script dit pourquoi il refuse`);
    if (failed > avant) diagnostic(`proc protégé ${nom}`, b.resultat);
  }
  // Et le contrôle qui donne du sens aux précédents : un nom VOISIN mais
  // différent n'est pas refusé. Sans quoi la liste pourrait tout bloquer et
  // les tests passeraient quand même.
  const b = jouerProc('protege-voisin', {
    mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, nomProcessus: 'lsass-journal',
  });
  assert(arrets(b.appels) === 1,
    `nom voisin « lsass-journal » : la liste ne bloque QUE les noms exacts (${arrets(b.appels)})`,
    b.appels.join(', ') || '(vide)');
}
{
  // C2 quater — COURSE AU RECYCLAGE DU PID. Entre la lecture du tableau et
  // l'action, le processus se termine et Windows réattribue son PID. La
  // doublure change d'identité au second appel ; le script doit s'en
  // apercevoir et ne rien arrêter.
  const b = jouerProc('recyclage', {
    mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, recycle: true,
  });
  const avant = failed;
  assert(MARQUEUR_PROC.test(b.resultat.stdout), 'PID recyclé : exécution jusqu’au rapport');
  assert(arrets(b.appels) === 0,
    `PID recyclé : ZÉRO Stop-Process — arrêter un PID recyclé revient à tuer un processus au hasard (${arrets(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/ne designe plus le meme processus/i.test(b.sortie),
    'PID recyclé : le script annonce que le PID a changé de propriétaire');
  if (failed > avant) diagnostic('proc recyclage', b.resultat);
}
{
  // C3 — mode Diagnostic : zéro appel.
  const b = jouerProc('diag', { mode: 'Diagnostic', pid: PID_BANC, confirmation: '' });
  assert(arrets(b.appels) === 0, `mode Diagnostic : ZÉRO Stop-Process (${arrets(b.appels)})`,
    b.appels.join(', ') || '(vide)');
}
{
  // C4 — les refus du formulaire, avant toute génération.
  const base = valeursDe(outilProc, { mode: 'Appliquer', prcConfirmation: PHRASE_PROC });
  assert(Boolean(outilProc.validate({ ...base, prcPid: '' }).prcPid),
    'PID absent : la validation refuse avant même de générer');
  assert(Boolean(outilProc.validate({ ...base, prcPid: '4' }).prcPid),
    'PID 4 : refusé — c’est le processus Système');
  assert(Boolean(outilProc.validate({ ...base, prcPid: 'chrome' }).prcPid),
    'nom au lieu d’un PID : refusé');
  assert(Boolean(outilProc.validate({ ...valeursDe(outilProc, { mode: 'Appliquer', prcPid: PID_BANC }), prcConfirmation: '' }).prcConfirmation),
    'confirmation absente : refusée');
}
{
  // C5 — CONTRE-ÉPREUVE du verrou principal : désarmé, cible inexistante,
  // l'appel interdit doit être vu.
  // La cible est un processus protege : le verrou principal est la seule
  // chose qui l'arrete. Desarme, l'appel interdit doit etre vu.
  const b = jouerProc('abime', {
    mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, nomProcessus: 'lsass', abimer: VERROU_PROC,
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve : le verrou a pu être désarmé${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(arrets(b.appels) > 0,
      `contre-épreuve — sans le verrou principal, Stop-Process s’exécute sur un processus protégé (${arrets(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('proc contre-épreuve', b.resultat);
  }
}
{
  // C6 — CONTRE-ÉPREUVE du verrou d'auto-protection, désarmé seul. Sans lui,
  // le script arrête bel et bien sa propre console.
  const valeurs = valeursDe(outilProc, {
    mode: 'Appliquer', prcPid: PID_BANC, prcConfirmation: PHRASE_PROC,
  });
  let script = avecElevation(outilProc.generate(valeurs), true);
  const avant = failed;
  script = script.replace(`$Cible = ${PID_BANC}`, '$Cible = $PID');
  const ligne = '$cibleNEstPasMoi = ($Cible -ne $PID)';
  assert(script.includes(ligne), 'le script porte bien le verrou d’auto-protection');
  script = script.replace(ligne, '$cibleNEstPasMoi = $true');
  const journal = join(travail, 'proc-abime-moi.txt');
  const cheminScript = ecrirePs1(join(travail, 'proc-abime-moi.ps1'), script);
  const banc = ecrirePs1(join(travail, 'banc-proc-abime-moi.ps1'),
    bancProc({ journal, script: cheminScript }));
  const resultat = executerBanc(banc);
  const appels = appelsDe(journal);
  assert(arrets(appels) > 0,
    `contre-épreuve — sans l’auto-protection, le script arrête SA PROPRE console (${arrets(appels)})`,
    appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('proc contre-épreuve auto-protection', resultat);
}
{
  // C7 — CONTRE-ÉPREUVE de la liste de refus, désarmée seule.
  const valeurs = valeursDe(outilProc, {
    mode: 'Appliquer', prcPid: PID_BANC, prcConfirmation: PHRASE_PROC,
  });
  let script = avecElevation(outilProc.generate(valeurs), true);
  const avant = failed;
  const ligne = '    if ($nomCible -ieq $protege) { $cibleNonProtegee = $false }';
  assert(script.includes(ligne), 'le script porte bien la liste de refus, comparée sans la casse');
  script = script.replace(ligne, '    if ($false) { $cibleNonProtegee = $false }');
  const journal = join(travail, 'proc-abime-protege.txt');
  const cheminScript = ecrirePs1(join(travail, 'proc-abime-protege.ps1'), script);
  const banc = ecrirePs1(join(travail, 'banc-proc-abime-protege.ps1'),
    bancProc({ journal, script: cheminScript, nomProcessus: 'lsass' }));
  const resultat = executerBanc(banc);
  const appels = appelsDe(journal);
  assert(arrets(appels) > 0,
    `contre-épreuve — sans la liste de refus, le script arrête lsass (${arrets(appels)})`,
    appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('proc contre-épreuve liste', resultat);
}
{
  // C8 — CONTRE-ÉPREUVE de la relecture d'identité, désarmée seule.
  const valeurs = valeursDe(outilProc, {
    mode: 'Appliquer', prcPid: PID_BANC, prcConfirmation: PHRASE_PROC,
  });
  let script = avecElevation(outilProc.generate(valeurs), true);
  const avant = failed;
  assert(script.includes(VERROU_IDENTITE), 'le script porte bien le verrou de relecture d’identité');
  script = script.replace(VERROU_IDENTITE, '  if ($false) {');
  const journal = join(travail, 'proc-abime-identite.txt');
  const cheminScript = ecrirePs1(join(travail, 'proc-abime-identite.ps1'), script);
  const banc = ecrirePs1(join(travail, 'banc-proc-abime-identite.ps1'),
    bancProc({ journal, script: cheminScript, recycle: true }));
  const resultat = executerBanc(banc);
  const appels = appelsDe(journal);
  assert(arrets(appels) > 0,
    `contre-épreuve — sans la relecture, le script arrête un PID recyclé (${arrets(appels)})`,
    appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('proc contre-épreuve identité', resultat);
}

{
  // C9 — L'HEURE DE DÉMARRAGE EST OBLIGATOIRE, pas facultative.
  //
  // L'ancien code partait de `$memeDepart = $true` et ne le remettait en
  // cause que si les deux heures étaient lisibles. Une heure illisible
  // laissait donc passer la comparaison sur le seul nom — et deux processus
  // peuvent parfaitement porter le même nom. Trois passes :
  //
  //   1. l'heure de la PREMIÈRE lecture est illisible ;
  //   2. l'heure de la SECONDE lecture est illisible ;
  //   3. les deux sont lisibles mais DIFFÉRENTES.
  //
  // Dans les trois cas : zéro arrêt.
  for (const [cas, opts, etiquette] of [
    ['departAvantNull', { departAvantNull: true }, 'StartTime initial inaccessible'],
    ['departReluNull', { departReluNull: true }, 'StartTime relu inaccessible'],
    ['departsDifferents', { departsDifferents: true }, 'même nom, heures de démarrage différentes'],
  ]) {
    const b = jouerProc(cas, {
      mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, ...opts,
    });
    const avant = failed;
    assert(MARQUEUR_PROC.test(b.resultat.stdout), `${etiquette} : exécution jusqu’au rapport`);
    assert(arrets(b.appels) === 0,
      `${etiquette} : ZÉRO Stop-Process — jamais d’arrêt sur une identité partiellement vérifiée (${arrets(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(/BLOQU/i.test(b.sortie), `${etiquette} : le script annonce le blocage`);
    if (failed > avant) diagnostic(`proc ${cas}`, b.resultat);
  }
  // Les deux premiers cas doivent nommer la cause exacte : l'identité n'a pas
  // pu être confirmée, ce qui n'est pas la même chose qu'un PID recyclé.
  for (const cas of ['departAvantNull', 'departReluNull']) {
    const b = jouerProc(`${cas}-msg`, {
      mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC,
      [cas === 'departAvantNull' ? 'departAvantNull' : 'departReluNull']: true,
    });
    assert(/impossible a confirmer/i.test(b.sortie),
      `${cas} : le script dit que l’identité est impossible à confirmer, et non qu’elle a changé`);
  }
  // Et le contrôle positif qui donne du sens aux trois précédents : même PID,
  // même nom, MÊME heure → un seul arrêt. Sans lui, un verrou qui bloquerait
  // tout ferait passer les tests ci-dessus.
  const bon = jouerProc('departIdentique', {
    mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC,
  });
  assert(arrets(bon.appels) === 1,
    `même PID, même nom, même heure de démarrage : UN seul Stop-Process (${arrets(bon.appels)})`,
    bon.appels.join(', ') || '(vide)');
}
{
  // C10 — CONTRE-ÉPREUVE : on remet le défaut relevé par Codex,
  // `$memeDepart = $true`, et l'arrêt interdit doit réapparaître sur une
  // identité qui n'a pas pu être vérifiée.
  const valeurs = valeursDe(outilProc, {
    mode: 'Appliquer', prcPid: PID_BANC, prcConfirmation: PHRASE_PROC,
  });
  let script = avecElevation(outilProc.generate(valeurs), true);
  const avant = failed;
  const ligne = '    $memeDepart = $false';
  assert(script.includes(ligne), 'le script part bien d’un $memeDepart FAUX');
  script = script.replace(ligne, '    $memeDepart = $true');
  script = script.replace(
    '    if ($departLisible) { $memeDepart = ($departRelu -eq $departAvant) }',
    '    if ($false) { $memeDepart = ($departRelu -eq $departAvant) }');
  const journal = join(travail, 'proc-abime-depart.txt');
  const cheminScript = ecrirePs1(join(travail, 'proc-abime-depart.ps1'), script);
  const banc = ecrirePs1(join(travail, 'banc-proc-abime-depart.ps1'),
    bancProc({ journal, script: cheminScript, departReluNull: true }));
  const resultat = executerBanc(banc);
  const appels = appelsDe(journal);
  assert(arrets(appels) > 0,
    `contre-épreuve — avec $memeDepart par défaut à VRAI, le script arrête un processus dont l’heure de démarrage est illisible (${arrets(appels)})`,
    appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('proc contre-épreuve départ', resultat);
}
{
  // C11 — svchost. Un processus svchost héberge un ou plusieurs services
  // Windows : l'arrêter les coupe tous d'un coup. Un assistant généraliste
  // n'a pas à le proposer.
  for (const nom of ['svchost', 'SVCHOST', 'SvcHost']) {
    const b = jouerProc(`svchost-${nom}`, {
      mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, nomProcessus: nom,
    });
    assert(arrets(b.appels) === 0,
      `« ${nom} » : ZÉRO Stop-Process — la comparaison ignore la casse (${arrets(b.appels)})`,
      b.appels.join(', ') || '(vide)');
  }
  // Et la correspondance reste EXACTE : un nom qui contient « svchost » sans
  // être svchost n'est pas bloqué.
  const voisin = jouerProc('svchost-voisin', {
    mode: 'Appliquer', pid: PID_BANC, confirmation: PHRASE_PROC, nomProcessus: 'svchost-journal',
  });
  assert(arrets(voisin.appels) === 1,
    `« svchost-journal » : non bloqué — la liste ne fait pas de correspondance partielle (${arrets(voisin.appels)})`,
    voisin.appels.join(', ') || '(vide)');
}

// ===========================================================================
// D. Le contrat de l'option --powershell
// ===========================================================================
section('Contrat de l’option --powershell');
{
  const moiMeme = fileURLToPath(import.meta.url);
  let code = 0;
  let sortie = '';
  try {
    sortie = execFileSync(process.execPath, [moiMeme, '--powershell', 'kjemo-interpreteur-qui-nexiste-pas'],
      { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    code = e.status ?? 1;
    sortie = String(e.stdout ?? '') + String(e.stderr ?? '');
  }
  assert(code !== 0, `un interpréteur demandé mais absent fait échouer le test (code ${code})`);
  assert(/introuvable ou ne répond pas/.test(sortie), 'le message nomme la cause');
  assert(/ne se rabat pas sur un autre moteur/.test(sortie), 'le test annonce qu’il ne se rabat sur aucun autre moteur');
  assert(!/audio-diagnostic —/.test(sortie), 'aucune passe n’est exécutée quand l’interpréteur manque');
}

rmSync(travail, { recursive: true, force: true });

console.log('');
console.log(`Contre-épreuves des verrous du LOT 6 — ${pwsh} (PowerShell ${versionPs}) : ${passed} OK, ${failed} ÉCHEC(S).`);
if (majeurPs === 5) console.log('Moteur éprouvé : Windows PowerShell 5.1, cible de référence du projet.');
else if (majeurPs >= 7) console.log('Moteur éprouvé : PowerShell 7. La cible 5.1 demande une exécution distincte.');
if (failed > 0) process.exit(1);
