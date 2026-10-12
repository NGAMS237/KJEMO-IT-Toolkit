/**
 * poste-verrous.test.mjs — contre-épreuves d'exécution du LOT 6
 * ---------------------------------------------------------------
 * Huit assistants du LOT 6 peuvent modifier l'état de la machine :
 *
 *   audio-diagnostic         redémarre deux services audio ;
 *   windows-update-repair    arrête des services et renomme des dossiers ;
 *   process-hung             met fin à un processus ;
 *   windows-service-control  démarre, arrête ou redémarre un service (LOT 6B) ;
 *   defender-scan            lance une analyse antivirus (LOT 6B) ;
 *   sfc-repair               remplace des fichiers système (LOT 6B) ;
 *   dism-repair              répare le magasin de composants (LOT 6B) ;
 *   restore-point-create     crée un point de restauration (LOT 6B) ;
 *   temp-cleanup             supprime des fichiers temporaires (LOT 6B).
 *
 * Et trois autres sont éprouvés ici bien qu'ils ne modifient rien, parce que
 * ce qu'il faut prouver est justement qu'ils ne modifient RIEN :
 *
 *   safe-mode-preparation      ne touche jamais au BCD (LOT 6B) ;
 *   recycle-bin-cleanup        ne vide jamais la corbeille (LOT 6B) ;
 *   browser-cache-diagnostic   ne purge jamais un cache (LOT 6B).
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
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { tools } = await import(
  pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href
);
// Le gardien de chemin est eprouve ISOLE, hors de tout assistant : c'est le
// seul moyen de verifier les deux sens, refus ET acceptation.
const { blocGardienChemin } = await import(
  pathToFileURL(resolve(ROOT, 'dist', 'outils-poste.mjs')).href
);

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

# --- Canonisation d'un chemin WINDOWS, sous Linux ---------------------------
#
# Le gardien de chemin du produit appelle [System.IO.Path]::GetFullPath, qui
# sous Windows reduit « C:\Kjemo\..\..\.. » a « C:\ » — et le gardien refuse
# alors une racine de volume. Sous Linux, la meme methode ne reconnait pas
# « \\ » comme separateur : rien n'est reduit, et le banc concluait a tort que
# le gardien laissait passer.
#
# Cette fonction reproduit la semantique Windows. C'est une adaptation du
# BANC : le script livre, lui, continue d'appeler GetFullPath. La verification
# sous la vraie implementation Windows reste du ressort de la CI windows-latest.
# Le parent d'un chemin WINDOWS, sous Linux : GetDirectoryName du produit
# decoupe sur « / » et rendrait n'importe quoi sur « C:\\Users\\banc ».
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
  $prefixeUnc = $texte.StartsWith('\\\\')
  $prefixe = ''
  $reste = $texte
  if ($prefixeUnc) {
    $prefixe = '\\\\'
    $reste = $texte.Substring(2)
  } elseif ($texte -match '^[A-Za-z]:') {
    $prefixe = $texte.Substring(0, 2) + '\\'
    $reste = $texte.Substring(2)
  }
  $pile = @()
  foreach ($segment in ($reste.Split('\\'))) {
    if ($segment -eq '' -or $segment -eq '.') { continue }
    if ($segment -eq '..') {
      # PIEGE POWERSHELL : avec un seul element, « $pile[0..($pile.Count - 2)] »
      # devient « $pile[0..-1] », soit l'intervalle 0 puis -1 — donc le premier
      # element ET le dernier. La pile se DUPLIQUAIT au lieu de se vider, et
      # « C:\\Kjemo\\..\\..\\.. » se canonisait en « C:\\Kjemo\\Kjemo ».
      if ($pile.Count -gt 1) { $pile = $pile[0..($pile.Count - 2)] }
      elseif ($pile.Count -eq 1) { $pile = @() }
      continue
    }
    $pile += $segment
  }
  if ($pile.Count -eq 0) { return $prefixe }
  return ($prefixe + ($pile -join '\\'))
}

# LES VARIABLES WINDOWS, avec des valeurs WINDOWS.
#
# SystemRoot valait « /tmp/faux-windows » : un chemin Linux. Le gardien
# compare desormais les chemins aux RACINES REELLES lues dans ces variables,
# et une racine Linux ne protege rien de ce que le banc eprouve. Les six
# variables portent donc les valeurs d'un poste Windows ordinaire.
$env:SystemRoot = 'C:\\Windows'
$env:SystemDrive = 'C:'
$env:ProgramFiles = 'C:\\Program Files'
[System.Environment]::SetEnvironmentVariable('ProgramFiles(x86)', 'C:\\Program Files (x86)')
$env:ProgramData = 'C:\\ProgramData'
$env:USERPROFILE = 'C:\\Users\\banc'
$env:COMPUTERNAME = 'POSTE-BANC'
$env:USERNAME = 'banc'

function Write-KjemoAppel { param([string]$Nom)
  # Ecriture par .NET, DELIBEREMENT : si ce mouchard passait par Add-Content,
  # toute doublure de Add-Content l'appellerait, et il s'appellerait lui-meme.
  # PowerShell sort alors en « call depth overflow », et le banc mesure sa
  # propre recursion au lieu du verrou. C'est arrive.
  [System.IO.File]::AppendAllText($global:KjemoJournal, $Nom + [Environment]::NewLine)
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
  // Le gardien du produit raisonne en chemins WINDOWS. Le banc tourne sous
  // Linux, ou « \\ » n'est pas un separateur : IsPathRooted, GetFullPath et
  // GetDirectoryName y repondent autre chose. Sans adaptation, le banc mesure
  // la plateforme au lieu du gardien — c'est arrive, et c'est consigne.
  //
  // Trois substitutions, chacune sur UNE ligne du produit. Le script livre, lui,
  // continue d'appeler les methodes .NET : la verification sous leur vraie
  // implementation reste du ressort de la CI windows-latest.
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
      "  try { $parent = [System.IO.Path]::GetDirectoryName($profil) } catch { return $null }",
      "  try { $parent = Split-KjemoBancParent $profil } catch { return $null }",
    ],
    [
      "    try { $parentCanon = [System.IO.Path]::GetDirectoryName($canon) } catch { }",
      "    try { $parentCanon = Split-KjemoBancParent $canon } catch { }",
    ],
    // Forme heritee, encore presente dans les scripts du LOT 5 et 6A qui
    // n'utilisent pas ConvertTo-KjemoCheminCanonique.
    [
      '  try { $canon = [System.IO.Path]::GetFullPath($Chemin) } catch { }',
      '  try { $canon = Resolve-KjemoBancCanon $Chemin } catch { }',
    ],
  ];
  for (const [de, vers] of remplacements) {
    if (sortie.includes(de)) sortie = sortie.split(de).join(vers);
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
$global:KjemoBancEtatServices = @{
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
  $global:KjemoBancEtatServices[$Name] = '${arretLaisse}'`
      : "$global:KjemoBancEtatServices[$Name] = 'Stopped'"}
  return $null
}
function Start-Service {
  [CmdletBinding()] param([string]$Name)
  Write-KjemoAppel ('Start-Service ' + $Name)
  $global:KjemoBancEtatServices[$Name] = 'Running'
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
  if (-not $global:KjemoBancEtatServices.ContainsKey($Name)) { return $null }
  return [pscustomobject]@{
    Name = $Name
    DisplayName = ('Service ' + $Name)
    Status = $global:KjemoBancEtatServices[$Name]
    StartType = 'Automatic'
  }
}
function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  # Le dossier de journal n'existe pas encore : le script doit le creer.
  # Les dossiers de Windows, eux, sont presents ou non selon la passe.
  if ($cible -notlike '*Windows*') { return $false }
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
foreach ($n in ($global:KjemoBancEtatServices.Keys | Sort-Object)) {
  Write-KjemoAppel ('FINAL ' + $n + '=' + $global:KjemoBancEtatServices[$n])
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
$global:KjemoBancLecturesCible = 0
# Une heure de demarrage FIXE : recalculee a chaque appel, elle differerait
# de quelques microsecondes et ferait echouer la comparaison d'identite pour
# une raison qui n'a rien a voir avec le verrou.
$global:KjemoBancDepartCible = (Get-Date).AddHours(-2)
$global:KjemoBancDepartAutre = (Get-Date).AddMinutes(-1)
function Stop-Process {
  [CmdletBinding()] param([int]$Id)
  Write-KjemoAppel ('Stop-Process ' + $Id)
  return $null
}
function Get-Process {
  [CmdletBinding()] param([string]$Name, [int]$Id)
  if ($PSBoundParameters.ContainsKey('Id')) {
    $global:KjemoBancLecturesCible = $global:KjemoBancLecturesCible + 1
    ${cibleExiste
      ? `${recycle ? `if ($global:KjemoBancLecturesCible -ge 2) {
      return [pscustomobject]@{ Id = $Id; ProcessName = 'autreappli'; WorkingSet64 = 1048576; Path = 'C:\\\\Autre\\\\autre.exe'; Responding = $true; MainWindowHandle = 2; CPU = 0.1; StartTime = $global:KjemoBancDepartAutre }
    }` : ''}
    ${departAvantNull || departReluNull || departsDifferents ? `$depart = $global:KjemoBancDepartCible
    ${departAvantNull ? 'if ($global:KjemoBancLecturesCible -eq 1) { $depart = $null }' : ''}
    ${departReluNull ? 'if ($global:KjemoBancLecturesCible -ge 2) { $depart = $null }' : ''}
    ${departsDifferents ? 'if ($global:KjemoBancLecturesCible -ge 2) { $depart = $global:KjemoBancDepartAutre }' : ''}` : '$depart = $global:KjemoBancDepartCible'}
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
// E. windows-service-control — LOT 6B — zéro action quand une condition manque
// ===========================================================================
section('windows-service-control — le verrou bloque-t-il Start/Stop/Restart-Service ?');

const outilSvc = outilOuEchec('windows-service-control');
const PHRASE_SVC = 'JE MODIFIE CE SERVICE';

/**
 * Le banc du contrôle de service.
 *
 * Comme pour windows-update-repair, l'état du service est un ÉTAT qui change :
 * une doublure qui répondrait toujours la même chose ne pourrait pas éprouver
 * la relecture d'avant-action ni celle d'après-action.
 *
 * `etatInitial`   : ce que la première lecture rend.
 * `etatApresLecture2` : ce que la DEUXIÈME lecture rend — c'est ainsi qu'on
 *                  reproduit un service modifié entre le diagnostic et
 *                  l'action, sans rien modifier pour de vrai.
 * `nomApresLecture2` : idem pour le nom, cas du service renommé.
 * `serviceAbsent` : Get-Service ne rend rien.
 * `disparaitApres`: présent à la première lecture, absent à la seconde.
 * `actionSansEffet` : la commande réussit mais l'état ne change pas.
 */
function bancSvc({
  journal, script,
  etatInitial = 'Running',
  etatApresLecture2 = null,
  nomApresLecture2 = null,
  serviceAbsent = false,
  disparaitApres = false,
  actionSansEffet = false,
  journalEchoue = false,
}) {
  return entete(journal) + decorWindows() + `
$global:KjemoBancLecturesService = 0
$global:KjemoBancEtatService = '${etatInitial}'
$global:KjemoBancNomAffiche = 'Service de banc'

function Get-Service {
  [CmdletBinding()] param([string]$Name)
  ${serviceAbsent ? 'return $null' : ''}
  $global:KjemoBancLecturesService = $global:KjemoBancLecturesService + 1
  ${disparaitApres ? 'if ($global:KjemoBancLecturesService -ge 2) { return $null }' : ''}
  ${etatApresLecture2 ? `if ($global:KjemoBancLecturesService -ge 2) { $global:KjemoBancEtatService = '${etatApresLecture2}' }` : ''}
  $nom = $Name
  ${nomApresLecture2 ? `if ($global:KjemoBancLecturesService -ge 2) { $nom = '${nomApresLecture2}' }` : ''}
  return [pscustomobject]@{
    Name = $nom
    DisplayName = $global:KjemoBancNomAffiche
    Status = $global:KjemoBancEtatService
    StartType = 'Automatic'
    DependentServices = @()
    ServicesDependedOn = @()
  }
}
function Start-Service {
  [CmdletBinding()] param([string]$Name)
  Write-KjemoAppel ('Start-Service ' + $Name)
  ${actionSansEffet ? '# La commande reussit, mais l etat ne change pas.' : "$global:KjemoBancEtatService = 'Running'"}
  return $null
}
function Stop-Service {
  [CmdletBinding()] param([string]$Name)
  Write-KjemoAppel ('Stop-Service ' + $Name)
  ${actionSansEffet ? '# La commande reussit, mais l etat ne change pas.' : "$global:KjemoBancEtatService = 'Stopped'"}
  return $null
}
function Restart-Service {
  [CmdletBinding()] param([string]$Name)
  Write-KjemoAppel ('Restart-Service ' + $Name)
  ${actionSansEffet ? '# La commande reussit, mais l etat ne change pas.' : "$global:KjemoBancEtatService = 'Running'"}
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
function Add-Content {
  [CmdletBinding()] param([string]$LiteralPath, $Value, [string]$Encoding)
  Write-KjemoAppel 'Add-Content'
  return $null
}

function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  if ($cible -like '*Journaux*' -or $cible -like '*Kjemo*') { return $false }
  return $true
}
function Get-WinEvent { [CmdletBinding()] param($FilterHashtable) return @() }
function Join-Path {
  [CmdletBinding()] param([Parameter(Position=0)]$Path, [Parameter(Position=1)]$ChildPath)
  if (-not $Path) { return [string]$ChildPath }
  return ((([string]$Path) -replace '[\\\\/]+$', '') + '\\\\' + [string]$ChildPath)
}
function Start-Sleep { [CmdletBinding()] param([int]$Seconds) return $null }

. ${psLitteral(script)}

Write-KjemoAppel ('FINAL etat=' + $global:KjemoBancEtatService)
`;
}

function jouerSvc(nom, {
  mode, service, actionDemandee, confirmation, eleve = true, journalChemin,
  abimer = null, ...reste
}) {
  const valeurs = valeursDe(outilSvc, {
    mode,
    svcNom: service === undefined ? 'ServiceBanc' : service,
    svcAction: actionDemandee ?? 'Redémarrer',
    svcConfirmation: confirmation ?? '',
    ...(journalChemin !== undefined ? { svcJournal: journalChemin } : {}),
  });
  let script;
  try { script = outilSvc.generate(valeurs); } catch (e) { return { refus: e.message }; }
  script = avecCheminsWindows(avecElevation(script, eleve));
  if (abimer) {
    for (const sub of Array.isArray(abimer) ? abimer : [abimer]) {
      if (!script.includes(sub.de)) return { refus: `motif introuvable : ${sub.de}` };
      script = script.replace(sub.de, sub.vers);
    }
  }
  const journal = join(travail, `svc-${nom}.txt`);
  const cheminScript = ecrirePs1(join(travail, `svc-${nom}.ps1`), script);
  const banc = ecrirePs1(join(travail, `banc-svc-${nom}.ps1`),
    bancSvc({ journal, script: cheminScript, ...reste }));
  const resultat = executerBanc(banc);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

const MARQUEUR_SVC = /=== windows-service-control -/;
const actionsSvc = (appels) => appels.filter((a) =>
  a.startsWith('Start-Service') || a.startsWith('Stop-Service') || a.startsWith('Restart-Service')).length;
const etatFinalSvc = (appels) => {
  const l = appels.find((a) => a.startsWith('FINAL etat='));
  return l ? l.split('=')[1] : '(non releve)';
};

{
  // E1 — contrôle positif : exactement UNE action, et la bonne.
  const b = jouerSvc('positif', {
    mode: 'Appliquer', actionDemandee: 'Arrêter', confirmation: PHRASE_SVC,
  });
  const avant = failed;
  assert(!b.refus, `contrôle positif : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(MARQUEUR_SVC.test(b.resultat.stdout), 'contrôle positif : exécution jusqu’au rapport');
    assert(actionsSvc(b.appels) === 1,
      `contrôle positif : EXACTEMENT une action sur le service (${actionsSvc(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(b.appels.some((a) => a.startsWith('Stop-Service ServiceBanc')),
      'contrôle positif : l’action vise bien le service nommé, et lui seul', b.appels.join(', '));
    assert(b.appels.includes('Set-Content'),
      'contrôle positif : le journal est écrit AVANT l’action', b.appels.join(', '));
    assert(b.appels.indexOf('Set-Content') < b.appels.findIndex((a) => a.startsWith('Stop-Service')),
      'contrôle positif : le journal précède bien l’action dans l’ordre des appels', b.appels.join(' → '));
    assert(etatFinalSvc(b.appels) === 'Stopped',
      `contrôle positif : l’état final est bien Stopped (${etatFinalSvc(b.appels)})`);
    if (failed > avant) diagnostic('svc positif', b.resultat);
  }
}
{
  // E2 — mode Diagnostic : zéro action, quelle que soit la confirmation.
  const b = jouerSvc('diag', { mode: 'Diagnostic', confirmation: PHRASE_SVC });
  assert(actionsSvc(b.appels) === 0,
    `mode Diagnostic : ZÉRO action sur le service (${actionsSvc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/Simulation/i.test(b.sortie), 'mode Diagnostic : le script annonce une simulation');
}
{
  // E3 — console non élevée : zéro action.
  const b = jouerSvc('nonEleve', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, eleve: false,
  });
  const avant = failed;
  assert(MARQUEUR_SVC.test(b.resultat.stdout), 'console non élevée : exécution jusqu’au rapport');
  assert(actionsSvc(b.appels) === 0,
    `console non élevée : ZÉRO action (${actionsSvc(b.appels)})`, b.appels.join(', ') || '(vide)');
  assert(/BLOQU/i.test(b.sortie), 'console non élevée : le script annonce le blocage');
  if (failed > avant) diagnostic('svc non élevé', b.resultat);
}
{
  // E4 — SERVICE CRITIQUE. C'est le cas qui compte le plus : la validation du
  // formulaire doit refuser AVANT la génération, et aucun script ne doit même
  // exister. On éprouve les deux bouts : la validation, puis — pour les noms
  // qui passeraient la validation — l'exécution.
  for (const critique of ['RpcSs', 'rpcss', 'RPCSS', 'gpsvc', 'ProfSvc', 'EventLog', 'LSM']) {
    const valeurs = valeursDe(outilSvc, {
      mode: 'Appliquer', svcNom: critique, svcConfirmation: PHRASE_SVC,
    });
    const errs = outilSvc.validate(valeurs);
    assert(Boolean(errs.svcNom),
      `service critique « ${critique} » : refusé par la validation, avant même la génération`);
  }
  // Et le contrôle qui donne du sens aux précédents : un nom VOISIN n'est pas
  // refusé. Sans lui, une liste qui bloquerait tout ferait passer ces tests.
  const voisin = valeursDe(outilSvc, {
    mode: 'Appliquer', svcNom: 'RpcSs-journal', svcConfirmation: PHRASE_SVC,
  });
  assert(!outilSvc.validate(voisin).svcNom,
    'nom voisin « RpcSs-journal » : accepté — la liste ne fait pas de correspondance partielle');
  // Au cas où le verrou de validation sauterait, le script lui-même doit encore
  // refuser. On force donc un nom critique dans le script généré.
  const bAttaque = jouerSvc('critiqueForce', {
    mode: 'Appliquer', service: 'ServiceBanc', confirmation: PHRASE_SVC,
    abimer: { de: '$cibleNom = $Service', vers: "$cibleNom = 'RpcSs'" },
  });
  const avantC = failed;
  assert(!bAttaque.refus, `service critique forcé dans le script : la substitution a eu lieu${bAttaque.refus ? ' — ' + bAttaque.refus : ''}`);
  if (!bAttaque.refus) {
    assert(actionsSvc(bAttaque.appels) === 0,
      `service critique forcé APRÈS la validation : ZÉRO action — le script a sa propre liste de refus (${actionsSvc(bAttaque.appels)})`,
      bAttaque.appels.join(', ') || '(vide)');
    assert(/protege|BLOQU/i.test(bAttaque.sortie),
      'service critique forcé : le script dit pourquoi il refuse');
    if (failed > avantC) diagnostic('svc critique forcé', bAttaque.resultat);
  }
}
{
  // E5 — SERVICE DISPARU entre le diagnostic et l'action.
  const b = jouerSvc('disparu', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, disparaitApres: true,
  });
  const avant = failed;
  assert(MARQUEUR_SVC.test(b.resultat.stdout), 'service disparu : exécution jusqu’au rapport');
  assert(actionsSvc(b.appels) === 0,
    `service disparu entre les deux lectures : ZÉRO action (${actionsSvc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/disparu|BLOQU/i.test(b.sortie), 'service disparu : le script annonce le blocage');
  if (failed > avant) diagnostic('svc disparu', b.resultat);
}
{
  // E6 — SERVICE CHANGÉ : l'état n'est plus celui du diagnostic.
  const b = jouerSvc('etatChange', {
    mode: 'Appliquer', actionDemandee: 'Arrêter', confirmation: PHRASE_SVC,
    etatInitial: 'Running', etatApresLecture2: 'Stopped',
  });
  const avant = failed;
  assert(actionsSvc(b.appels) === 0,
    `état changé entre les deux lectures : ZÉRO action (${actionsSvc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/a change depuis le diagnostic|BLOQU/i.test(b.sortie),
    'état changé : le script dit que le service a changé depuis le diagnostic');
  if (failed > avant) diagnostic('svc état changé', b.resultat);
}
{
  // E7 — SERVICE RENOMMÉ entre les deux lectures.
  const b = jouerSvc('renomme', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, nomApresLecture2: 'AutreService',
  });
  const avant = failed;
  assert(actionsSvc(b.appels) === 0,
    `service renommé entre les deux lectures : ZÉRO action (${actionsSvc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('svc renommé', b.resultat);
}
{
  // E8 — ÉTAT INITIAL NON STABLE. Les cinq états de transition ou de
  // suspension doivent bloquer, et le script ne doit RIEN tenter.
  for (const statut of ['Paused', 'StopPending', 'StartPending', 'ContinuePending', 'PausePending']) {
    const b = jouerSvc(`instable-${statut}`, {
      mode: 'Appliquer', confirmation: PHRASE_SVC, etatInitial: statut,
    });
    const avant = failed;
    assert(actionsSvc(b.appels) === 0,
      `état initial ${statut} : ZÉRO action — le script ne tente pas de convertir (${actionsSvc(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(/non stable|BLOQU/i.test(b.sortie),
      `état initial ${statut} : le script nomme la cause`);
    if (failed > avant) diagnostic(`svc instable ${statut}`, b.resultat);
  }
}
{
  // E9 — ACTION ANNONCÉE MAIS ÉTAT FINAL INCORRECT : pas de réussite.
  // La commande réussit, le service ne bouge pas. C'est la relecture d'après
  // action qui doit décider — et refuser d'annoncer une réussite.
  const b = jouerSvc('sansEffet', {
    mode: 'Appliquer', actionDemandee: 'Arrêter', confirmation: PHRASE_SVC,
    actionSansEffet: true,
  });
  const avant = failed;
  assert(actionsSvc(b.appels) === 1,
    `action sans effet : la commande a bien été lancée (${actionsSvc(b.appels)})`);
  assert(/NON conforme/i.test(b.sortie),
    'action sans effet : le script déclare le résultat NON conforme');
  assert(!/Resultat.*conforme a l.attendu/i.test(b.sortie),
    'action sans effet : AUCUNE réussite n’est annoncée');
  assert(/Retour a l.etat de depart/i.test(b.sortie),
    'action sans effet : le retour à l’état de départ est proposé');
  assert(etatFinalSvc(b.appels) === 'Running',
    `action sans effet : l’état est resté Running, et le script ne prétend pas le contraire (${etatFinalSvc(b.appels)})`);
  if (failed > avant) diagnostic('svc sans effet', b.resultat);
}
{
  // E9 bis — le retour à l'état de départ est PROPOSÉ, pas exécuté. Après un
  // échec, enchaîner une seconde action sans comprendre la première aggrave la
  // situation plus souvent qu'elle ne la répare.
  const b = jouerSvc('retourNonExecute', {
    mode: 'Appliquer', actionDemandee: 'Arrêter', confirmation: PHRASE_SVC,
    actionSansEffet: true,
  });
  assert(actionsSvc(b.appels) === 1,
    `retour non exécuté : une seule action au total, le retour n’a PAS été lancé (${actionsSvc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
}
{
  // E10 — JOURNAL EN ÉCHEC : zéro action. Pas de modification non traçable.
  const b = jouerSvc('sansJournal', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, journalEchoue: true,
  });
  const avant = failed;
  assert(actionsSvc(b.appels) === 0,
    `journal en échec : ZÉRO action (${actionsSvc(b.appels)})`, b.appels.join(', ') || '(vide)');
  assert(/journal/i.test(b.sortie), 'journal en échec : le script nomme le journal comme condition manquante');
  if (failed > avant) diagnostic('svc sans journal', b.resultat);
}
{
  // E11 — confirmation absente ou approximative : refusée par la validation.
  // Ce qui doit etre refuse : vide, casse differente, a-peu-pres.
  for (const mauvaise of ['', 'je modifie ce service', 'Je Modifie Ce Service', 'oui',
    'JE MODIFIE LE SERVICE', 'JE MODIFIE CE SERVICES']) {
    const valeurs = valeursDe(outilSvc, {
      mode: 'Appliquer', svcNom: 'ServiceBanc', svcConfirmation: mauvaise,
    });
    assert(Boolean(outilSvc.validate(valeurs).svcConfirmation),
      `confirmation « ${mauvaise || '(vide)'} » : refusée`);
  }
  // Et ce qui est TOLERE, deliberement : les espaces autour. C'est la
  // convention du projet, appliquee de la meme facon au LOT 6A, et elle ne
  // reduit pas la protection — un copier-coller ajoute souvent une espace
  // finale, alors que la casse, elle, reste strictement comparee. Si cette
  // ligne echoue un jour, c'est que la convention a change sans etre alignee
  // partout.
  for (const toleree of [PHRASE_SVC, `${PHRASE_SVC} `, ` ${PHRASE_SVC}`, `\t${PHRASE_SVC}\n`]) {
    const valeurs = valeursDe(outilSvc, {
      mode: 'Appliquer', svcNom: 'ServiceBanc', svcConfirmation: toleree,
    });
    assert(!outilSvc.validate(valeurs).svcConfirmation,
      `confirmation « ${JSON.stringify(toleree)} » : acceptée — les espaces autour sont tolérés, la casse non`);
  }
}
{
  // E12 — jokers et listes : refusés par la validation.
  for (const mauvais of ['*', 'Spool*', 'Spooler,Audiosrv', 'Spooler;Audiosrv', 'C:\\Spooler', '?pooler']) {
    const valeurs = valeursDe(outilSvc, {
      mode: 'Appliquer', svcNom: mauvais, svcConfirmation: PHRASE_SVC,
    });
    assert(Boolean(outilSvc.validate(valeurs).svcNom),
      `nom « ${mauvais} » : refusé — ni joker, ni liste, ni chemin`);
  }
}
{
  // E13 — CONTRE-ÉPREUVE du verrou principal. Désarmé, l'appel interdit doit
  // réapparaître alors que la console n'est pas élevée.
  const b = jouerSvc('abimeVerrou', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, eleve: false,
    abimer: { de: "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {", vers: 'if ($false) {' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve : le verrou a pu être désarmé${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(actionsSvc(b.appels) > 0,
      `contre-épreuve — sans le verrou, l’action s’exécute malgré la console non élevée (${actionsSvc(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('svc contre-épreuve verrou', b.resultat);
  }
}
{
  // E14 — CONTRE-ÉPREUVE de la relecture d'identité, désarmée seule.
  const b = jouerSvc('abimeIdentite', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, disparaitApres: true,
    abimer: { de: '  if (-not $identiteStable) {', vers: '  if ($false) {' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve identité : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(actionsSvc(b.appels) > 0,
      `contre-épreuve — sans la relecture, le script agit sur un service disparu (${actionsSvc(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('svc contre-épreuve identité', b.resultat);
  }
}
{
  // E15 — CONTRE-ÉPREUVE de la liste de refus du SCRIPT, désarmée seule.
  const b = jouerSvc('abimeListe', {
    mode: 'Appliquer', confirmation: PHRASE_SVC,
    abimer: { de: '    if ([string]$svc.Name -ieq $protege) { $cibleNonProtegee = $false }', vers: '    if ($false) { $cibleNonProtegee = $false }' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve liste : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    // Le verrou de la liste est désarmé ; l'action a donc lieu sur le service du
    // banc. Ce qu'on prouve ici, c'est que c'est bien CETTE ligne qui portait
    // le refus — sinon le test E4 pourrait passer pour une autre raison.
    assert(actionsSvc(b.appels) > 0,
      `contre-épreuve — c’est bien la comparaison -ieq qui portait le refus (${actionsSvc(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('svc contre-épreuve liste', b.resultat);
  }
}
{
  // E16 — CONTRE-ÉPREUVE de la règle d'état stable, désarmée seule.
  const b = jouerSvc('abimeStable', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, etatInitial: 'Paused',
    abimer: { de: '  $etatInitialStable = ($etatsStables -contains $etatInitial)', vers: '  $etatInitialStable = $true' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve état stable : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(actionsSvc(b.appels) > 0,
      `contre-épreuve — sans la règle d’état stable, le script agit sur un service Paused (${actionsSvc(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('svc contre-épreuve état stable', b.resultat);
  }
}

// ===========================================================================

// ===========================================================================
// F. defender-scan — LOT 6B — zéro Start-MpScan quand une condition manque
// ===========================================================================
section('defender-scan — le verrou bloque-t-il Start-MpScan ?');

const outilScan = outilOuEchec('defender-scan');
const PHRASE_SCAN = 'JE LANCE UNE ANALYSE COMPLETE';

/**
 * Le banc de l'analyse Defender.
 *
 * `defenderAbsent`  : Get-MpComputerStatus n'existe pas du tout — c'est le cas
 *                     d'une édition sans Defender.
 * `etatIllisible`   : la cmdlet existe mais ne rend rien.
 * `antivirusInactif`: Defender présent, lisible, mais désactivé.
 * `cheminExiste`    : ce que Test-Path répond pour le dossier visé.
 * `scanEchoue`      : Start-MpScan lève une erreur.
 */
function bancScan({
  journal, script,
  defenderAbsent = false,
  etatIllisible = false,
  antivirusInactif = false,
  cheminExiste = true,
  scanEchoue = false,
}) {
  return entete(journal) + decorWindows() + `
function Start-MpScan {
  [CmdletBinding()] param([string]$ScanType, [string]$ScanPath)
  Write-KjemoAppel ('Start-MpScan ' + $ScanType + ' ' + $ScanPath)
  ${scanEchoue ? "throw 'ECHEC SIMULE DE START-MPSCAN'" : 'return $null'}
}
${defenderAbsent ? '' : `function Get-MpComputerStatus {
  [CmdletBinding()] param()
  ${etatIllisible ? 'return $null' : `return [pscustomobject]@{
    AntivirusEnabled = $${antivirusInactif ? 'false' : 'true'}
    AMServiceEnabled = $${antivirusInactif ? 'false' : 'true'}
    AMRunningMode = 'Normal'
    AntivirusSignatureAge = 1
    QuickScanStartTime = (Get-Date).AddHours(-1)
    FullScanStartTime = (Get-Date).AddDays(-10)
  }`}
}`}
function Get-MpThreatDetection { [CmdletBinding()] param() return @() }
function Get-MpThreat { [CmdletBinding()] param($ThreatID) return $null }
function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  ${cheminExiste ? 'return $true' : 'return $false'}
}
function Get-Command {
  [CmdletBinding()] param([string]$Name)
  ${defenderAbsent ? "if ($Name -eq 'Get-MpComputerStatus') { return $null }" : ''}
  return [pscustomobject]@{ Name = $Name }
}
function Start-Sleep { [CmdletBinding()] param([int]$Seconds) return $null }

. ${psLitteral(script)}
`;
}

function jouerScan(nom, { mode, type, chemin, confirmation, eleve = true, abimer = null, ...reste }) {
  const valeurs = valeursDe(outilScan, {
    mode,
    dsType: type ?? 'Rapide',
    ...(chemin !== undefined ? { dsChemin: chemin } : {}),
    dsConfirmation: confirmation ?? '',
  });
  let script;
  try { script = outilScan.generate(valeurs); } catch (e) { return { refus: e.message }; }
  script = avecCheminsWindows(avecElevation(script, eleve));
  if (abimer) {
    if (!script.includes(abimer.de)) return { refus: `motif introuvable : ${abimer.de}` };
    script = script.replace(abimer.de, abimer.vers);
  }
  const journal = join(travail, `scan-${nom}.txt`);
  const cheminScript = ecrirePs1(join(travail, `scan-${nom}.ps1`), script);
  const banc = ecrirePs1(join(travail, `banc-scan-${nom}.ps1`),
    bancScan({ journal, script: cheminScript, ...reste }));
  const resultat = executerBanc(banc);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

const MARQUEUR_SCAN = /=== defender-scan -/;
const scans = (appels) => appels.filter((a) => a.startsWith('Start-MpScan')).length;

{
  // F1 — contrôle positif : une analyse rapide passe, et une seule.
  const b = jouerScan('positif', { mode: 'Appliquer', type: 'Rapide' });
  const avant = failed;
  assert(!b.refus, `contrôle positif : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(MARQUEUR_SCAN.test(b.resultat.stdout), 'contrôle positif : exécution jusqu’au rapport');
    assert(scans(b.appels) === 1, `contrôle positif : EXACTEMENT un Start-MpScan (${scans(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(b.appels.some((a) => a.includes('QuickScan')),
      'contrôle positif : c’est bien une analyse rapide qui est lancée', b.appels.join(', '));
    if (failed > avant) diagnostic('scan positif', b.resultat);
  }
}
{
  // F2 — DEFENDER INDISPONIBLE : zéro analyse. Deux formes, parce qu'elles ne
  // se diagnostiquent pas de la même façon.
  const bAbsent = jouerScan('defenderAbsent', { mode: 'Appliquer', type: 'Rapide', defenderAbsent: true });
  const avantA = failed;
  assert(scans(bAbsent.appels) === 0,
    `module Defender absent : ZÉRO Start-MpScan (${scans(bAbsent.appels)})`,
    bAbsent.appels.join(', ') || '(vide)');
  assert(/absent|BLOQU/i.test(bAbsent.sortie), 'module Defender absent : le script annonce le blocage');
  if (failed > avantA) diagnostic('scan Defender absent', bAbsent.resultat);

  const bIllisible = jouerScan('etatIllisible', { mode: 'Appliquer', type: 'Rapide', etatIllisible: true });
  const avantI = failed;
  assert(scans(bIllisible.appels) === 0,
    `état Defender non lisible : ZÉRO Start-MpScan (${scans(bIllisible.appels)})`,
    bIllisible.appels.join(', ') || '(vide)');
  if (failed > avantI) diagnostic('scan état illisible', bIllisible.resultat);

  const bInactif = jouerScan('antivirusInactif', { mode: 'Appliquer', type: 'Rapide', antivirusInactif: true });
  const avantN = failed;
  assert(scans(bInactif.appels) === 0,
    `antivirus désactivé : ZÉRO Start-MpScan (${scans(bInactif.appels)})`,
    bInactif.appels.join(', ') || '(vide)');
  if (failed > avantN) diagnostic('scan antivirus inactif', bInactif.resultat);
}
{
  // F3 — CHEMIN INVALIDE pour une analyse personnalisée. La validation du
  // formulaire doit refuser avant la génération.
  for (const mauvais of ['', '   ', 'Temp\\relatif', '\\\\serveur\\partage', 'C:\\', 'C:', 'D:\\']) {
    const valeurs = valeursDe(outilScan, {
      mode: 'Appliquer', dsType: 'Personnalisée', dsChemin: mauvais,
    });
    assert(Boolean(outilScan.validate(valeurs).dsChemin),
      `chemin « ${mauvais || '(vide)'} » : refusé par la validation`);
  }
  // Et un chemin local, absolu, non racine : accepté.
  const bon = valeursDe(outilScan, {
    mode: 'Appliquer', dsType: 'Personnalisée', dsChemin: 'C:\\Users\\Public\\Downloads',
  });
  assert(!outilScan.validate(bon).dsChemin,
    'chemin « C:\\Users\\Public\\Downloads » : accepté — local, absolu, hors racine');
}
{
  // F4 — DOSSIER INEXISTANT : le refus doit venir de l'EXÉCUTION, parce qu'un
  // dossier peut avoir disparu depuis la génération du script.
  const b = jouerScan('cheminAbsent', {
    mode: 'Appliquer', type: 'Personnalisée', chemin: 'C:\\Kjemo\\Quarantaine', cheminExiste: false,
  });
  const avant = failed;
  assert(MARQUEUR_SCAN.test(b.resultat.stdout), 'dossier inexistant : exécution jusqu’au rapport');
  assert(scans(b.appels) === 0,
    `dossier inexistant à l’exécution : ZÉRO Start-MpScan (${scans(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/inexistant|BLOQU/i.test(b.sortie), 'dossier inexistant : le script nomme la cause');
  if (failed > avant) diagnostic('scan chemin absent', b.resultat);
}
{
  // F5 — ANALYSE COMPLÈTE SANS CONFIRMATION : refusée par la validation, puis
  // par le script si on force la génération.
  const sansConfirmation = valeursDe(outilScan, {
    mode: 'Appliquer', dsType: 'Complète', dsConfirmation: '',
  });
  assert(Boolean(outilScan.validate(sansConfirmation).dsConfirmation),
    'analyse complète sans confirmation : refusée par la validation');
  for (const approx of ['je lance une analyse complete', 'JE LANCE UNE ANALYSE', 'oui']) {
    const v = valeursDe(outilScan, { mode: 'Appliquer', dsType: 'Complète', dsConfirmation: approx });
    assert(Boolean(outilScan.validate(v).dsConfirmation),
      `analyse complète, confirmation « ${approx} » : refusée`);
  }
  // Avec la bonne phrase, elle passe — et c'est bien une analyse complète.
  const b = jouerScan('completeOk', {
    mode: 'Appliquer', type: 'Complète', confirmation: PHRASE_SCAN,
  });
  const avant = failed;
  assert(scans(b.appels) === 1,
    `analyse complète confirmée : un Start-MpScan (${scans(b.appels)})`, b.appels.join(', ') || '(vide)');
  assert(b.appels.some((a) => a.includes('FullScan')),
    'analyse complète : c’est bien FullScan qui est lancé', b.appels.join(', '));
  if (failed > avant) diagnostic('scan complète', b.resultat);
  // Et la confirmation n'est PAS exigée pour une analyse rapide : exiger la
  // même cérémonie partout banaliserait la confirmation.
  const rapide = valeursDe(outilScan, { mode: 'Appliquer', dsType: 'Rapide', dsConfirmation: '' });
  assert(!outilScan.validate(rapide).dsConfirmation,
    'analyse rapide : aucune confirmation exigée — la cérémonie reste proportionnée');
}
{
  // F6 — mode Diagnostic : zéro analyse, quelle que soit la confirmation.
  const b = jouerScan('diag', { mode: 'Diagnostic', type: 'Complète', confirmation: PHRASE_SCAN });
  assert(scans(b.appels) === 0, `mode Diagnostic : ZÉRO Start-MpScan (${scans(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/Simulation/i.test(b.sortie), 'mode Diagnostic : le script annonce une simulation');
}
{
  // F7 — Start-MpScan échoue : aucune réussite annoncée.
  const b = jouerScan('scanEchoue', { mode: 'Appliquer', type: 'Rapide', scanEchoue: true });
  const avant = failed;
  assert(scans(b.appels) === 1, `échec de Start-MpScan : la commande a bien été tentée (${scans(b.appels)})`);
  assert(/ECHEC SIMULE|PROBLEME/i.test(b.sortie) || /Start-MpScan a leve une erreur/i.test(b.sortie),
    'échec de Start-MpScan : l’erreur est rapportée');
  assert(!/commande acceptee/i.test(b.sortie),
    'échec de Start-MpScan : aucune réussite n’est annoncée');
  if (failed > avant) diagnostic('scan échec', b.resultat);
}
{
  // F8 — CONTRE-ÉPREUVE du verrou. Désarmé, l'analyse part alors que Defender
  // est absent.
  const b = jouerScan('abimeVerrou', {
    mode: 'Appliquer', type: 'Rapide', defenderAbsent: true,
    abimer: { de: "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {", vers: 'if ($false) {' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve : le verrou a pu être désarmé${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(scans(b.appels) > 0,
      `contre-épreuve — sans le verrou, l’analyse part alors que Defender est absent (${scans(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('scan contre-épreuve verrou', b.resultat);
  }
}
{
  // F9 — CONTRE-ÉPREUVE du contrôle d'existence du chemin, désarmé seul.
  const b = jouerScan('abimeChemin', {
    mode: 'Appliquer', type: 'Personnalisée', chemin: 'C:\\Kjemo\\Quarantaine', cheminExiste: false,
    abimer: { de: '    if (-not $existe) {', vers: '    if ($false) {' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve chemin : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(scans(b.appels) > 0,
      `contre-épreuve — sans le contrôle d’existence, l’analyse part sur un dossier absent (${scans(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('scan contre-épreuve chemin', b.resultat);
  }
}
{
  // F10 — aucune exclusion touchée, jamais. On le prouve en montrant que les
  // cmdlets qui modifient les préférences n'apparaissent dans AUCUN script de
  // cet assistant, mode Appliquer compris.
  for (const type of ['Rapide', 'Complète', 'Personnalisée']) {
    const valeurs = valeursDe(outilScan, {
      mode: 'Appliquer', dsType: type,
      dsConfirmation: type === 'Complète' ? PHRASE_SCAN : '',
      dsChemin: 'C:\\Users\\Public\\Downloads',
    });
    let script = null;
    try { script = outilScan.generate(valeurs); } catch (e) { /* refus = pas de script */ }
    assert(Boolean(script), `analyse ${type} : le script se génère`);
    if (script) {
      for (const interdit of ['Set-MpPreference', 'Add-MpPreference', 'Remove-MpPreference',
        'Set-MpComputerStatus', 'Remove-MpThreat']) {
        assert(!new RegExp(`\\b${interdit}\\b`).test(script),
          `analyse ${type} : aucun ${interdit} — les exclusions et la quarantaine restent intouchées`);
      }
    }
  }
}

// ===========================================================================

// ===========================================================================
// G. Réparation Windows — LOT 6B — SFC, DISM, point de restauration, mode sans échec
// ===========================================================================
section('Réparation Windows — les verrous de SFC, DISM, du point de restauration et du mode sans échec');

const outilSfcB = outilOuEchec('sfc-repair');
const outilDismB = outilOuEchec('dism-repair');
const outilPointB = outilOuEchec('restore-point-create');
const outilSmeB = outilOuEchec('safe-mode-preparation');

/**
 * Banc commun aux assistants de réparation.
 *
 * Les binaires sfc.exe et dism.exe sont remplacés par des fonctions PowerShell
 * portant leur nom. C'est possible parce que les scripts les appellent par
 * `& $chemin` ou `& dism.exe`, et PowerShell résout d'abord les fonctions.
 * `sortieSimulee` permet de faire dire au faux binaire ce qu'on veut, et donc
 * d'éprouver la lecture du verdict.
 */
function bancReparation({
  journal, script,
  placeGo = 50,
  sortieSfc = 'Windows Resource Protection did not find any integrity violations.',
  sortieDism = 'No component store corruption detected. The operation completed successfully.',
  binairesPresents = true,
  cheminsExistent = true,
  pointsAvant = 2,
  pointCree = true,
  checkpointEchoue = false,
  protectionAbsente = false,
}) {
  return entete(journal) + decorWindows() + `
$global:KjemoBancSequenceMax = ${pointsAvant}
$global:KjemoBancPointsExistants = @()
for ($i = 1; $i -le ${pointsAvant}; $i++) {
  $global:KjemoBancPointsExistants += [pscustomobject]@{
    SequenceNumber = $i
    Description = ('Point existant ' + $i)
    CreationTime = (Get-Date).AddDays(-$i)
  }
}

function sfc.exe {
  Write-KjemoAppel ('sfc ' + ($args -join ' '))
  $global:LASTEXITCODE = 0
  return ${psLitteral(sortieSfc)}
}
function dism.exe {
  Write-KjemoAppel ('dism ' + ($args -join ' '))
  $global:LASTEXITCODE = 0
  return ${psLitteral(sortieDism)}
}
function bcdedit.exe {
  Write-KjemoAppel ('bcdedit ' + ($args -join ' '))
  return @('identifier              {current}', 'description             Windows 11', 'recoveryenabled         Yes')
}
function reagentc.exe {
  Write-KjemoAppel ('reagentc ' + ($args -join ' '))
  return @('Windows RE status:        Enabled')
}
function Checkpoint-Computer {
  [CmdletBinding()] param([string]$Description, [string]$RestorePointType)
  Write-KjemoAppel ('Checkpoint-Computer ' + $Description + ' ' + $RestorePointType)
  ${checkpointEchoue ? "throw 'ECHEC SIMULE DE CHECKPOINT-COMPUTER'" : ''}
  ${pointCree ? `$global:KjemoBancSequenceMax = $global:KjemoBancSequenceMax + 1
  $global:KjemoBancPointsExistants += [pscustomobject]@{
    SequenceNumber = $global:KjemoBancSequenceMax
    Description = $Description
    CreationTime = (Get-Date)
  }` : '# La commande rend la main sans erreur, mais aucun point n est cree.'}
  return $null
}
function Get-CimInstance {
  [CmdletBinding()] param([string]$ClassName, [string]$Namespace, [string]$Filter)
  if ($ClassName -eq 'Win32_LogicalDisk') {
    return [pscustomobject]@{ DeviceID = 'C:'; Size = 500GB; FreeSpace = ${placeGo}GB; DriveType = 3 }
  }
  if ($ClassName -eq 'Win32_OperatingSystem') {
    return [pscustomobject]@{
      Caption = 'Microsoft Windows 11 Pro'; Version = '10.0.22631'; BuildNumber = '22631'
      TotalVisibleMemorySize = 16777216; FreePhysicalMemory = 8388608
      LastBootUpTime = (Get-Date).AddHours(-5)
    }
  }
  if ($ClassName -eq 'SystemRestore') {
    ${protectionAbsente ? 'return @()' : 'return $global:KjemoBancPointsExistants'}
  }
  return $null
}
function Get-ItemProperty {
  [CmdletBinding()] param([string]$LiteralPath, [string]$Name)
  return [pscustomobject]@{ DisableSR = 0 }
}
function Get-Service {
  [CmdletBinding()] param([string]$Name)
  return [pscustomobject]@{ Name = $Name; Status = 'Running'; StartType = 'Manual' }
}
function Get-BitLockerVolume {
  [CmdletBinding()] param()
  return @([pscustomobject]@{ MountPoint = 'C:'; ProtectionStatus = 'Off'; VolumeStatus = 'FullyDecrypted' })
}
function Get-LocalUser {
  [CmdletBinding()] param()
  return @([pscustomobject]@{ Name = 'banc'; Enabled = $true; PrincipalSource = 'Local' })
}
function Get-Content {
  [CmdletBinding()] param([string]$LiteralPath, [int]$Tail)
  return @('2026-10-06 SR Cannot repair member file [l:24]', '2026-10-06 SR Repaired file')
}
function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  ${binairesPresents ? '' : "if ($cible -like '*sfc.exe' -or $cible -like '*dism.exe') { return $false }"}
  ${cheminsExistent ? 'return $true' : "if ($cible -like '*Sources*') { return $false }\n  return $true"}
}
function Get-Command {
  [CmdletBinding()] param([string]$Name)
  ${protectionAbsente ? "if ($Name -eq 'Checkpoint-Computer') { return $null }" : ''}
  return [pscustomobject]@{ Name = $Name }
}
function Start-Sleep { [CmdletBinding()] param([int]$Seconds) return $null }
function Join-Path {
  [CmdletBinding()] param([Parameter(Position=0)]$Path, [Parameter(Position=1)]$ChildPath)
  if (-not $Path) { return [string]$ChildPath }
  return ((([string]$Path) -replace '[\\\\/]+$', '') + '\\\\' + [string]$ChildPath)
}

. ${psLitteral(script)}
`;
}

/**
 * Rend sfc.exe et dism.exe interceptables par une doublure.
 *
 * Les scripts les invoquent par « & $cheminSfc », un chemin ABSOLU — ce qui est
 * la bonne pratique : appeler un binaire systeme par son nom seul le rendrait
 * vulnerable a un detournement de PATH. Mais PowerShell resout alors un
 * fichier, et une fonction du meme nom n'est jamais atteinte : la doublure
 * restait inerte, et l'appel echouait en silence.
 *
 * Le banc reecrit donc les deux affectations de chemin pour qu'elles portent le
 * nom simple. C'est une adaptation du BANC : le script livre, lui, continue
 * d'appeler un chemin absolu.
 */
function avecBinairesDoublables(script) {
  // Remplacement litteral, pas par expression reguliere : le chemin genere
  // contient une barre oblique inverse simple, et l'echapper deux fois de trop
  // faisait que le motif ne correspondait jamais — le banc mesurait alors
  // l'absence d'appel au lieu du verrou.
  return script
    .split("$cheminSfc = Join-Path $env:SystemRoot 'System32\\sfc.exe'").join("$cheminSfc = 'sfc.exe'")
    .split("$cheminDism = Join-Path $env:SystemRoot 'System32\\dism.exe'").join("$cheminDism = 'dism.exe'");
}

function jouerRep(nom, outil, surcharges, opts = {}) {
  const valeurs = valeursDe(outil, surcharges);
  let script;
  try { script = outil.generate(valeurs); } catch (e) { return { refus: e.message }; }
  script = avecBinairesDoublables(avecCheminsWindows(avecElevation(script, opts.eleve !== false)));
  if (opts.abimer) {
    for (const sub of Array.isArray(opts.abimer) ? opts.abimer : [opts.abimer]) {
      if (!script.includes(sub.de)) return { refus: `motif introuvable : ${sub.de}` };
      script = script.replace(sub.de, sub.vers);
    }
  }
  const journal = join(travail, `rep-${nom}.txt`);
  const cheminScript = ecrirePs1(join(travail, `rep-${nom}.ps1`), script);
  const banc = ecrirePs1(join(travail, `banc-rep-${nom}.ps1`),
    bancReparation({ journal, script: cheminScript, ...opts.banc }));
  const resultat = executerBanc(banc);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

const appelsSfc = (a) => a.filter((x) => x.startsWith('sfc ')).length;
const appelsDism = (a) => a.filter((x) => x.startsWith('dism ')).length;
const appelsPoint = (a) => a.filter((x) => x.startsWith('Checkpoint-Computer')).length;
const appelsBcdEcriture = (a) => a.filter((x) => x.startsWith('bcdedit ')
  && /\/set|\/deletevalue|\/create|\/delete|\/import/.test(x)).length;

{
  // G1 — SFC : l'étape « Diagnostic des prérequis » ne lance AUCUNE commande,
  // même en mode Appliquer avec la confirmation.
  const b = jouerRep('sfcDiagnostic', outilSfcB, {
    mode: 'Appliquer', sfcEtape: 'Diagnostic des prérequis',
    sfcConfirmation: 'JE REPARE LES FICHIERS SYSTEME',
  });
  const avant = failed;
  assert(!b.refus, `SFC diagnostic : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(appelsSfc(b.appels) === 0,
      `SFC, étape diagnostic : ZÉRO commande sfc (${appelsSfc(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('sfc diagnostic', b.resultat);
  }
}
{
  // G2 — SFC en mode Diagnostic : zéro commande, même pour l'étape réparation.
  const b = jouerRep('sfcModeDiag', outilSfcB, {
    mode: 'Diagnostic', sfcEtape: 'Vérification et réparation',
  });
  assert(appelsSfc(b.appels) === 0,
    `SFC en mode Diagnostic : ZÉRO commande sfc (${appelsSfc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/Simulation/i.test(b.sortie), 'SFC en mode Diagnostic : le script annonce une simulation');
}
{
  // G3 — SFC : contrôle positif, /verifyonly part, et c'est bien /verifyonly.
  const b = jouerRep('sfcVerify', outilSfcB, {
    mode: 'Appliquer', sfcEtape: 'Vérification sans correction',
  });
  const avant = failed;
  assert(appelsSfc(b.appels) === 1, `SFC /verifyonly : une commande (${appelsSfc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(b.appels.some((a) => a.includes('/verifyonly')),
    'SFC : c’est bien /verifyonly qui est lancé, pas /scannow', b.appels.join(', '));
  assert(!b.appels.some((a) => a.includes('/scannow')),
    'SFC /verifyonly : aucun /scannow n’est enchaîné');
  if (failed > avant) diagnostic('sfc verifyonly', b.resultat);
}
{
  // G4 — SFC : /scannow sans confirmation est refusé par la validation.
  for (const mauvaise of ['', 'je repare les fichiers systeme', 'oui']) {
    const v = valeursDe(outilSfcB, {
      mode: 'Appliquer', sfcEtape: 'Vérification et réparation', sfcConfirmation: mauvaise,
    });
    assert(Boolean(outilSfcB.validate(v).sfcConfirmation),
      `SFC /scannow, confirmation « ${mauvaise || '(vide)'} » : refusée`);
  }
  // Et /verifyonly n'en exige pas : la cérémonie reste proportionnée.
  const verif = valeursDe(outilSfcB, {
    mode: 'Appliquer', sfcEtape: 'Vérification sans correction', sfcConfirmation: '',
  });
  assert(!outilSfcB.validate(verif).sfcConfirmation,
    'SFC /verifyonly : aucune confirmation exigée — il ne corrige rien');
}
{
  // G5 — SFC : DISM n'est JAMAIS enchaîné après SFC, dans aucune étape.
  for (const etape of ['Diagnostic des prérequis', 'Vérification sans correction', 'Vérification et réparation']) {
    const b = jouerRep(`sfcSansDism-${etape.slice(0, 12)}`, outilSfcB, {
      mode: 'Appliquer', sfcEtape: etape,
      sfcConfirmation: 'JE REPARE LES FICHIERS SYSTEME',
    });
    if (b.refus) continue;
    const dismModifiants = b.appels.filter((a) => a.startsWith('dism ') && /RestoreHealth|ScanHealth/.test(a));
    assert(dismModifiants.length === 0,
      `SFC, étape « ${etape} » : aucun DISM /ScanHealth ni /RestoreHealth enchaîné (${dismModifiants.length})`,
      b.appels.join(', ') || '(vide)');
  }
}
{
  // G6 — SFC : espace disque insuffisant, zéro commande.
  const b = jouerRep('sfcSansPlace', outilSfcB, {
    mode: 'Appliquer', sfcEtape: 'Vérification et réparation',
    sfcConfirmation: 'JE REPARE LES FICHIERS SYSTEME',
  }, { banc: { placeGo: 1 } });
  const avant = failed;
  assert(appelsSfc(b.appels) === 0,
    `SFC avec 1 Go libre : ZÉRO commande sfc (${appelsSfc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/BLOQU/i.test(b.sortie), 'SFC sans place : le script annonce le blocage');
  if (failed > avant) diagnostic('sfc sans place', b.resultat);
}
{
  // G7 — SFC : le verdict ne vient PAS du code de sortie. Le faux binaire rend
  // 0 ET un texte disant que des fichiers n'ont pas pu être réparés : le
  // rapport doit dire PROBLEME.
  const b = jouerRep('sfcVerdictFaux', outilSfcB, {
    mode: 'Appliquer', sfcEtape: 'Vérification et réparation',
    sfcConfirmation: 'JE REPARE LES FICHIERS SYSTEME',
  }, { banc: { sortieSfc: 'Windows Resource Protection found corrupt files but was unable to fix some of them.' } });
  const avant = failed;
  assert(appelsSfc(b.appels) === 1, 'SFC verdict : la commande a bien été lancée');
  assert(/N.ONT PAS pu etre repares|unable/i.test(b.sortie),
    'SFC : le verdict est lu dans le TEXTE, pas dans le code de sortie 0');
  if (failed > avant) diagnostic('sfc verdict', b.resultat);
}
{
  // G8 — DISM : les trois étapes sont bien distinctes, et /RestoreHealth exige
  // une confirmation.
  const bCheck = jouerRep('dismCheck', outilDismB, {
    mode: 'Appliquer', dsmEtape: 'CheckHealth — lecture d’un indicateur',
  });
  const avantC = failed;
  assert(appelsDism(bCheck.appels) === 1, `DISM /CheckHealth : une commande (${appelsDism(bCheck.appels)})`);
  assert(bCheck.appels.some((a) => a.includes('/CheckHealth')), 'DISM : c’est bien /CheckHealth');
  assert(!bCheck.appels.some((a) => a.includes('/RestoreHealth')),
    'DISM /CheckHealth : aucun /RestoreHealth n’est enchaîné');
  if (failed > avantC) diagnostic('dism checkhealth', bCheck.resultat);

  for (const mauvaise of ['', 'je repare le magasin de composants', 'oui']) {
    const v = valeursDe(outilDismB, {
      mode: 'Appliquer', dsmEtape: 'RestoreHealth — réparation', dsmConfirmation: mauvaise,
    });
    assert(Boolean(outilDismB.validate(v).dsmConfirmation),
      `DISM /RestoreHealth, confirmation « ${mauvaise || '(vide)'} » : refusée`);
  }
}
{
  // G9 — DISM : SFC n'est jamais enchaîné après DISM.
  const b = jouerRep('dismSansSfc', outilDismB, {
    mode: 'Appliquer', dsmEtape: 'RestoreHealth — réparation',
    dsmConfirmation: 'JE REPARE LE MAGASIN DE COMPOSANTS',
  });
  const avant = failed;
  assert(appelsSfc(b.appels) === 0,
    `DISM /RestoreHealth : aucune commande sfc enchaînée (${appelsSfc(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('dism sans sfc', b.resultat);
}
{
  // G10 — DISM : sources refusées par la validation. C'est le point le plus
  // sensible — une source incompatible produit un magasin incohérent.
  for (const mauvaise of ['Sources\\install.wim', '\\\\serveur\\sources\\install.wim', 'C:\\', 'D:\\']) {
    const v = valeursDe(outilDismB, {
      mode: 'Appliquer', dsmEtape: 'RestoreHealth — réparation',
      dsmSource: mauvaise, dsmConfirmation: 'JE REPARE LE MAGASIN DE COMPOSANTS',
    });
    assert(Boolean(outilDismB.validate(v).dsmSource),
      `DISM, source « ${mauvaise} » : refusée`);
  }
  // Et une source faite d'espaces vaut « aucune source » : elle est trimee, et
  // DISM se rabat sur Windows Update. C'est le comportement voulu, pas un trou.
  const espaces = valeursDe(outilDismB, {
    mode: 'Appliquer', dsmEtape: 'RestoreHealth — réparation',
    dsmSource: '   ', dsmConfirmation: 'JE REPARE LE MAGASIN DE COMPOSANTS',
  });
  assert(!outilDismB.validate(espaces).dsmSource,
    'DISM, source faite d’espaces : acceptée comme « aucune source » — DISM se rabat sur Windows Update');
  const bonne = valeursDe(outilDismB, {
    mode: 'Appliquer', dsmEtape: 'RestoreHealth — réparation',
    dsmSource: 'C:\\Sources\\install.wim', dsmConfirmation: 'JE REPARE LE MAGASIN DE COMPOSANTS',
  });
  assert(!outilDismB.validate(bonne).dsmSource,
    'DISM, source « C:\\Sources\\install.wim » : acceptée — locale, absolue, hors racine');
  // /LimitAccess sans source : incohérent, refusé.
  const limite = valeursDe(outilDismB, {
    mode: 'Appliquer', dsmEtape: 'RestoreHealth — réparation',
    dsmSource: '', dsmLimiterWU: 'Oui', dsmConfirmation: 'JE REPARE LE MAGASIN DE COMPOSANTS',
  });
  assert(Boolean(outilDismB.validate(limite).dsmLimiterWU),
    'DISM, /LimitAccess sans source locale : refusé — DISM n’aurait plus aucune source');
}
{
  // G11 — DISM : une source qui n'existe plus à l'exécution bloque.
  const b = jouerRep('dismSourceAbsente', outilDismB, {
    mode: 'Appliquer', dsmEtape: 'RestoreHealth — réparation',
    dsmSource: 'C:\\Sources\\install.wim',
    dsmConfirmation: 'JE REPARE LE MAGASIN DE COMPOSANTS',
  }, { banc: { cheminsExistent: false } });
  const avant = failed;
  assert(appelsDism(b.appels) === 0,
    `DISM, source absente à l’exécution : ZÉRO commande dism (${appelsDism(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/introuvable|BLOQU/i.test(b.sortie), 'DISM source absente : le script nomme la cause');
  if (failed > avant) diagnostic('dism source absente', b.resultat);
}
{
  // G12 — COMPOSANT ABSENT (edition Serveur) : zéro création.
  //
  // Checkpoint-Computer n'existe pas : c'est une question DIFFÉRENTE de l'état
  // de la protection, et elle, elle est lisible par programme.
  const b = jouerRep('pointSansComposant', outilPointB, {
    mode: 'Appliquer', rpConfirmation: 'JE CREE UN POINT DE RESTAURATION',
    rpEtatProtection: 'Constaté : lecteur système protégé',
  }, { banc: { protectionAbsente: true } });
  const avant = failed;
  assert(appelsPoint(b.appels) === 0,
    `composant absent : ZÉRO Checkpoint-Computer (${appelsPoint(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/BLOQU/i.test(b.sortie), 'composant absent : le script annonce le blocage');
  if (failed > avant) diagnostic('point sans composant', b.resultat);
}
{
  // G12 bis — LE DÉFAUT RELEVÉ PAR CODEX, ET SA CORRECTION.
  //
  // L'assistant déduisait « protection active » de la PRÉSENCE d'instances de
  // la classe WMI SystemRestore. La documentation de cette classe est pourtant
  // explicite : chaque instance est un POINT DE RESTAURATION, pas un lecteur
  // protégé. La déduction se trompait dans les deux sens.
  //
  // Ce bloc éprouve la correction sur la grille complète : trois nombres de
  // points existants (aucun, un, cinq) croisés avec les deux états constatés.
  // Le verrou doit dépendre UNIQUEMENT de l'état constaté, et JAMAIS du nombre
  // de points.
  for (const pointsAvant of [0, 1, 5]) {
    for (const [etat, etiquette, creationAttendue] of [
      ['Constaté : lecteur système protégé', 'constaté protégé', 1],
      ['Non constat\u00e9', 'non constaté', 0],
    ]) {
      const b = jouerRep(`pointGrille-${pointsAvant}-${creationAttendue}`, outilPointB, {
        mode: 'Appliquer', rpConfirmation: 'JE CREE UN POINT DE RESTAURATION',
        rpEtatProtection: etat,
      }, { banc: { pointsAvant } });
      const avant = failed;
      if (b.refus) {
        // En mode Appliquer, l'état non constaté est refusé dès la validation
        // du formulaire : c'est un premier verrou, et il compte.
        assert(creationAttendue === 0,
          `${etiquette}, ${pointsAvant} point(s) : refus à la génération — ${b.refus}`);
        continue;
      }
      assert(appelsPoint(b.appels) === creationAttendue,
        `${etiquette}, ${pointsAvant} point(s) existant(s) : ${creationAttendue} Checkpoint-Computer attendu(s), ${appelsPoint(b.appels)} observé(s)`,
        b.appels.join(', ') || '(vide)');
      if (creationAttendue === 1) {
        // PROTECTION ACTIVÉE MAIS AUCUN POINT EXISTANT : l'assistant ne doit
        // PAS conclure « protection inactive ».
        assert(!/protection systeme inactive/i.test(b.sortie),
          `${etiquette}, ${pointsAvant} point(s) : le script ne conclut jamais « protection inactive »`);
        assert(!/NON CONSTATE/i.test(b.sortie),
          `${etiquette}, ${pointsAvant} point(s) : l’état constaté est pris en compte`);
      } else {
        // ANCIENS POINTS PRÉSENTS MAIS ÉTAT NON CONSTATÉ : l'assistant ne doit
        // PAS conclure que le lecteur système est protégé.
        assert(/NON CONSTATE/i.test(b.sortie),
          `${etiquette}, ${pointsAvant} point(s) : le script dit « NON CONSTATE » et non « inactive »`);
        assert(/systempropertiesprotection|rstrui/i.test(b.sortie),
          `${etiquette}, ${pointsAvant} point(s) : la méthode officielle de constat est donnée`);
      }
      if (failed > avant) diagnostic(`point grille ${pointsAvant} ${etiquette}`, b.resultat);
    }
  }
}
{
  // G12 ter — LE NOMBRE DE POINTS EST ANNONCÉ COMME NE DÉCIDANT DE RIEN.
  //
  // Un rapport qui affiche « 5 points existants » à côté d'un blocage doit dire
  // pourquoi ce nombre ne change rien, sinon il invite à la mauvaise conclusion.
  const b = jouerRep('pointNombreNeutre', outilPointB, {
    mode: 'Diagnostic', rpEtatProtection: 'Non constat\u00e9',
  }, { banc: { pointsAvant: 5 } });
  const avant = failed;
  assert(!b.refus, `nombre de points neutre : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    // A l'ECRAN, dans le bloc de blocage : la personne qui lit la console doit
    // voir que les cinq points affiches ne changent rien.
    assert(/NE DECIDE RIEN/i.test(b.sortie),
      'la console dit explicitement que le nombre de points ne décide de rien');
    assert(/POINT, pas un lecteur protege/i.test(b.sortie),
      'la console rappelle qu’une instance SystemRestore est un point, pas un lecteur protégé');
    // Et dans le RAPPORT exportable, qui est la trace relue plus tard.
    const script = outilPointB.generate(valeursDe(outilPointB,
      { mode: 'Diagnostic', rpEtatProtection: 'Non constat\u00e9' }));
    assert(/NE DECIDE RIEN/.test(script),
      'le rapport exportable porte la même mise en garde');
    assert(/est un POINT, pas un lecteur protege/.test(script),
      'le rapport exportable nomme la confusion que la version précédente faisait');
  }
  if (failed > avant) diagnostic('point nombre neutre', b.resultat);
}
{
  // G12 quater — AUCUNE CLÉ DE REGISTRE NON DOCUMENTÉE.
  //
  // La version précédente lisait HKLM\...\SystemRestore pour y chercher
  // DisableSR. Cette valeur n'a aucune page de documentation Microsoft : s'en
  // servir aurait été contourner la limite au lieu de la dire.
  for (const etat of ['Constaté : lecteur système protégé', 'Non constat\u00e9']) {
    const v = valeursDe(outilPointB, { mode: 'Diagnostic', rpEtatProtection: etat });
    const script = outilPointB.generate(v);
    assert(!/DisableSR/i.test(script),
      `aucune lecture de DisableSR dans le script (${etat})`);
    assert(!/CurrentVersion\\SystemRestore/i.test(script),
      `aucune lecture de la branche de registre SystemRestore (${etat})`);
    assert(/rstrui\.exe|systempropertiesprotection/i.test(script),
      `la méthode officielle de constat est citée dans le script (${etat})`);
  }
}
{
  // G13 — POINT DE RESTAURATION : contrôle positif, un point créé et VÉRIFIÉ.
  const b = jouerRep('pointPositif', outilPointB, {
    mode: 'Appliquer', rpConfirmation: 'JE CREE UN POINT DE RESTAURATION',
    rpEtatProtection: 'Constaté : lecteur système protégé',
  });
  const avant = failed;
  assert(appelsPoint(b.appels) === 1,
    `contrôle positif : un Checkpoint-Computer (${appelsPoint(b.appels)})`, b.appels.join(', ') || '(vide)');
  assert(/Point VERIFIE par relecture/i.test(b.sortie),
    'contrôle positif : la création est vérifiée par relecture de la liste, et le script le dit à l’écran');
  if (failed > avant) diagnostic('point positif', b.resultat);
}
{
  // G14 — LE CAS QUI COMPTE : la commande réussit mais AUCUN point n'est créé.
  // C'est le comportement réel de Windows quand un point existe déjà dans les
  // 24 heures. Aucune réussite ne doit être annoncée.
  const b = jouerRep('pointNonCree', outilPointB, {
    mode: 'Appliquer', rpConfirmation: 'JE CREE UN POINT DE RESTAURATION',
    rpEtatProtection: 'Constaté : lecteur système protégé',
  }, { banc: { pointCree: false } });
  const avant = failed;
  assert(appelsPoint(b.appels) === 1,
    `point non créé : la commande a bien été lancée (${appelsPoint(b.appels)})`);
  assert(/Aucun point cree/i.test(b.sortie),
    'point non créé : le script le dit explicitement à l’écran');
  assert(!/Point reellement cree.*OK/i.test(b.sortie),
    'point non créé : AUCUNE réussite n’est annoncée');
  assert(/24 heures|24h/i.test(b.sortie),
    'point non créé : la cause la plus fréquente est nommée — un point par 24 heures');
  if (failed > avant) diagnostic('point non créé', b.resultat);
}
{
  // G14 bis — CONTRE-ÉPREUVE : on REMET la déduction fautive dans une copie.
  //
  // Un journal vide ne prouve rien. On réintroduit donc la règle que Codex a
  // relevée — « protection active si au moins un point existe » — et on vérifie
  // que le banc la prend en flagrant délit, dans les DEUX sens.
  // La regle fautive est remise LA OU ELLE ETAIT : dans l'expression du verrou.
  // L'y remettre a l'endroit de la nouvelle affectation ne prouverait rien,
  // puisque $pointsExistants n'est lu que plus bas — le banc mesurerait un
  // ordre de lignes au lieu de la regle.
  const deductionFautive = {
    de: '$conditionsAppliquer = $KjemoEleve -and $protectionDisponible -and $etatProtectionEtabli -and',
    vers: '$conditionsAppliquer = $KjemoEleve -and $protectionDisponible -and ($pointsExistants.Count -gt 0) -and',
  };

  // Sens 1 — protection constatée protégée, mais AUCUN point existant.
  // Avec la déduction fautive, la création est bloquée À TORT.
  const sens1 = jouerRep('pointDeductionBloqueAtort', outilPointB, {
    mode: 'Appliquer', rpConfirmation: 'JE CREE UN POINT DE RESTAURATION',
    rpEtatProtection: 'Constaté : lecteur système protégé',
  }, { banc: { pointsAvant: 0 }, abimer: [deductionFautive] });
  const avant1 = failed;
  assert(!sens1.refus, `contre-épreuve sens 1 : la substitution a eu lieu${sens1.refus ? ' — ' + sens1.refus : ''}`);
  if (!sens1.refus) {
    assert(appelsPoint(sens1.appels) === 0,
      `contre-épreuve — avec la déduction fautive et zéro point, la création est bloquée À TORT (${appelsPoint(sens1.appels)})`,
      sens1.appels.join(', ') || '(vide)');
    if (failed > avant1) diagnostic('point déduction sens 1', sens1.resultat);
  }

  // Sens 2 — état NON constaté, mais cinq points anciens présents. Avec la
  // déduction fautive, la création PART alors que rien n'a été constaté.
  // Le formulaire refusant un état non constaté en mode Appliquer, on falsifie
  // ici la variable du script, exactement comme pour temp-cleanup : c'est le
  // verrou DU SCRIPT qu'on éprouve, pas celui du formulaire.
  const sens2 = jouerRep('pointDeductionPasseAtort', outilPointB, {
    mode: 'Appliquer', rpConfirmation: 'JE CREE UN POINT DE RESTAURATION',
    rpEtatProtection: 'Constaté : lecteur système protégé',
  }, {
    banc: { pointsAvant: 5 },
    abimer: [
      { de: "$EtatProtectionConstate = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('Q29uc3RhdGU='))",
        vers: "$EtatProtectionConstate = 'NonConstate'" },
      deductionFautive,
    ],
  });
  const avant2 = failed;
  assert(!sens2.refus, `contre-épreuve sens 2 : la substitution a eu lieu${sens2.refus ? ' — ' + sens2.refus : ''}`);
  if (!sens2.refus) {
    assert(appelsPoint(sens2.appels) === 1,
      `contre-épreuve — avec la déduction fautive et cinq points anciens, la création PART sans constat (${appelsPoint(sens2.appels)})`,
      sens2.appels.join(', ') || '(vide)');
    if (failed > avant2) diagnostic('point déduction sens 2', sens2.resultat);
  }

  // Et le contrôle positif de la correction : MÊME configuration que le sens 2,
  // sans la déduction fautive. Le verrou du script doit bloquer.
  const corrige = jouerRep('pointCorrigeBloque', outilPointB, {
    mode: 'Appliquer', rpConfirmation: 'JE CREE UN POINT DE RESTAURATION',
    rpEtatProtection: 'Constaté : lecteur système protégé',
  }, {
    banc: { pointsAvant: 5 },
    abimer: [
      { de: "$EtatProtectionConstate = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('Q29uc3RhdGU='))",
        vers: "$EtatProtectionConstate = 'NonConstate'" },
    ],
  });
  const avant3 = failed;
  assert(!corrige.refus, `correction : la substitution a eu lieu${corrige.refus ? ' — ' + corrige.refus : ''}`);
  if (!corrige.refus) {
    assert(appelsPoint(corrige.appels) === 0,
      `correction — cinq points anciens et aucun constat : ZÉRO création (${appelsPoint(corrige.appels)})`,
      corrige.appels.join(', ') || '(vide)');
    assert(/NON CONSTATE/i.test(corrige.sortie),
      'correction — le script dit « NON CONSTATE », pas « protection inactive »');
    if (failed > avant3) diagnostic('point corrigé bloqué', corrige.resultat);
  }
}
{
  // G15 — POINT DE RESTAURATION : aucune commande de restauration n'est
  // produite, dans aucun mode. C'est la garantie centrale de cet assistant.
  for (const mode of ['Diagnostic', 'Appliquer']) {
    const v = valeursDe(outilPointB, {
      mode, rpConfirmation: mode === 'Appliquer' ? 'JE CREE UN POINT DE RESTAURATION' : '',
      rpEtatProtection: 'Constat\u00e9 : lecteur syst\u00e8me prot\u00e9g\u00e9',
    });
    let script = null;
    try { script = outilPointB.generate(v); } catch (e) { /* refus */ }
    assert(Boolean(script), `point de restauration, mode ${mode} : le script se génère`);
    if (script) {
      // AUCUN APPEL, et non aucune mention.
      //
      // Le script CITE desormais la page officielle de Enable-ComputerRestore :
      // c'est elle qui etablit qu'aucune commande ne donne l'etat de la
      // protection, et retirer la citation pour faire passer un test serait
      // retirer la preuve. Ce qui est interdit, c'est l'APPEL.
      const code = codeNu(script);
      for (const interdit of ['Restore-Computer', 'Enable-ComputerRestore',
        'Disable-ComputerRestore', 'Remove-ComputerRestorePoint']) {
        const appels = code.filter((l) => new RegExp(`(^|[\\s;|&({])${interdit}\\b`).test(l));
        assert(appels.length === 0,
          `point de restauration, mode ${mode} : aucun APPEL a ${interdit} — ni restauration, ni activation, ni suppression`,
          appels.join(' | '));
      }
      // rstrui.exe ne doit jamais etre LANCE. Il est nomme, en procedure
      // graphique, et c'est tout.
      const lancementsRstrui = code.filter((l) => /(^|[\s;|&({])(&\s*)?rstrui(\.exe)?\b/i.test(l));
      assert(lancementsRstrui.length === 0,
        `point de restauration, mode ${mode} : rstrui.exe n’est jamais lancé`,
        lancementsRstrui.join(' | '));
      // Et la citation de la page officielle, elle, DOIT etre la.
      assert(/enable-computerrestore/i.test(script),
        `point de restauration, mode ${mode} : la page qui fonde la limite est citée`);
    }
  }
}
{
  // G15 bis — CONTRE-ÉPREUVE du contrôle « aucun APPEL ».
  //
  // Une règle qui ne cherche plus que les appels doit encore voir un appel. On
  // en introduit un dans une copie, et on vérifie que le contrôle le trouve ;
  // puis on vérifie qu'une simple MENTION, elle, ne déclenche rien.
  const scriptSain = outilPointB.generate(valeursDe(outilPointB, { mode: 'Diagnostic' }));
  const chercher = (texte, nom) => codeNu(texte)
    .filter((l) => new RegExp(`(^|[\\s;|&({])${nom}\\b`).test(l)).length;

  assert(chercher(scriptSain, 'Enable-ComputerRestore') === 0,
    'contre-épreuve — le script d’origine ne contient aucun appel à Enable-ComputerRestore');
  assert(chercher(scriptSain + "\nEnable-ComputerRestore -Drive 'C:\\'\n", 'Enable-ComputerRestore') === 1,
    'contre-épreuve — un appel à Enable-ComputerRestore EST détecté');
  assert(chercher(scriptSain + "\nWrite-Host 'ne jamais lancer Enable-ComputerRestore'\n", 'Enable-ComputerRestore') === 0,
    'contre-épreuve — une simple mention dans une chaîne ne déclenche rien');
  assert(chercher(scriptSain + '\n# Enable-ComputerRestore est hors de portee de cet assistant\n', 'Enable-ComputerRestore') === 0,
    'contre-épreuve — une mention en commentaire ne déclenche rien');
}
{
  // G16 — MODE SANS ÉCHEC : aucune écriture dans le BCD, jamais, dans aucun
  // jeu de paramètres. C'est le point que la feuille de route nomme
  // explicitement.
  for (const variante of ['Minimal', 'Réseau', 'Invite de commandes']) {
    for (const apercu of ['Oui, en aperçu documentaire avec son annulation', 'Non, procédure graphique seulement']) {
      const b = jouerRep(`sme-${variante.slice(0, 7)}-${apercu.slice(0, 3)}`, outilSmeB, {
        smeVariante: variante, smeApercuBcd: apercu,
      });
      if (b.refus) { assert(false, `mode sans échec ${variante} : ${b.refus}`); continue; }
      assert(appelsBcdEcriture(b.appels) === 0,
        `mode sans échec, ${variante} / aperçu ${apercu.slice(0, 3)} : ZÉRO écriture bcdedit (${appelsBcdEcriture(b.appels)})`,
        b.appels.join(', ') || '(vide)');
    }
  }
  // Et le script n'a AUCUN mode Appliquer : le champ mode n'existe pas.
  assert(!outilSmeB.fields.some((f) => f.id === 'mode'),
    'mode sans échec : aucun champ « mode » — il n’existe pas de mode Appliquer');
  assert(outilSmeB.risk === 'diagnostic',
    `mode sans échec : risque déclaré diagnostic (${outilSmeB.risk})`);
}
{
  // G17 — MODE SANS ÉCHEC : quand l'aperçu bcdedit est demandé, la commande
  // d'annulation est TOUJOURS présente à côté. Un aperçu sans son inverse est
  // un piège, et la feuille de route l'exige nommément.
  for (const variante of ['Minimal', 'Réseau', 'Invite de commandes']) {
    const v = valeursDe(outilSmeB, {
      smeVariante: variante, smeApercuBcd: 'Oui, en aperçu documentaire avec son annulation',
    });
    const script = outilSmeB.generate(v);
    assert(/safeboot/.test(script),
      `aperçu ${variante} : la commande d’entrée est présente`);
    // L'IDENTIFIANT. Codex a relevé que l'aperçu visait {default} : sur un poste
    // à plusieurs entrées de démarrage, {default} n'est pas forcément le Windows
    // actuellement démarré, et la commande peut rendre PERSISTANT le mode sans
    // échec d'un autre système. {current} désigne celui qui tourne.
    // Et les accolades sont des caractères spéciaux pour PowerShell : sans
    // guillemets, la ligne collée dans une console PowerShell ne fait pas ce
    // qu'elle dit. L'identifiant est donc entre guillemets doubles.
    assert(/bcdedit \/set "\{current\}" safeboot/.test(script),
      `aperçu ${variante} : l’entrée vise "{current}", entre guillemets`);
    assert(/bcdedit \/deletevalue "\{current\}" safeboot/.test(script),
      `aperçu ${variante} : la commande d’ANNULATION est présente à côté, sur "{current}"`);
    assert(!/\{default\}/.test(script),
      `aperçu ${variante} : aucune occurrence de {default} ne subsiste`);
    if (variante === 'Invite de commandes') {
      assert(/safebootalternateshell/.test(script),
        'aperçu invite de commandes : l’option supplémentaire est montrée');
      assert(/bcdedit \/set "\{current\}" safebootalternateshell yes/.test(script),
        'aperçu invite de commandes : l’option supplémentaire vise aussi "{current}"');
      assert(/bcdedit \/deletevalue "\{current\}" safebootalternateshell/.test(script),
        'aperçu invite de commandes : son annulation aussi');
    }
    // Et l'aperçu reste du TEXTE : la commande n'est jamais invoquée.
    const lignesExecutantes = script.split('\n').filter((l) =>
      /bcdedit/.test(l) && !/^\s*#/.test(l) && !/^\s*Write-Host/.test(l) && !/Add-KjemoResultat/.test(l));
    const ecritures = lignesExecutantes.filter((l) => /\/set|\/deletevalue/.test(l));
    assert(ecritures.length === 0,
      `aperçu ${variante} : aucune ligne exécutable ne modifie le BCD (${ecritures.length})`,
      ecritures.join(' | '));
  }
  // Sans l'aperçu, aucune commande bcdedit d'écriture n'apparaît du tout.
  const sansApercu = outilSmeB.generate(valeursDe(outilSmeB, {
    smeApercuBcd: 'Non, procédure graphique seulement',
  }));
  // La commande reste citee dans les COMMENTAIRES explicatifs du script — c'est
  // voulu : ils expliquent pourquoi elle est ecartee. Ce qui doit disparaitre,
  // c'est le bloc d'apercu affiche a l'ecran.
  const afficheeSansApercu = sansApercu.split('\n').filter((l) =>
    /^\s*Write-Host/.test(l) && /\/set "\{current\}" safeboot/.test(l));
  assert(afficheeSansApercu.length === 0,
    `aperçu refusé : aucune ligne n’affiche la commande d’entrée (${afficheeSansApercu.length})`,
    afficheeSansApercu.join(' | '));
  assert(/bcdedit/.test(sansApercu),
    'aperçu refusé : la commande reste citée dans les commentaires, qui expliquent pourquoi elle est écartée');
}

// ===========================================================================

// ===========================================================================
// H. temp-cleanup — LOT 6B — l'assistant le plus sensible du lot
// ===========================================================================
section('temp-cleanup — le verrou bloque-t-il Remove-Item ?');

const outilTc = outilOuEchec('temp-cleanup');
const PHRASE_TC = 'JE SUPPRIME CES FICHIERS TEMPORAIRES';

/**
 * Le banc du nettoyage.
 *
 * Il construit un faux système de fichiers en mémoire : une table de chemins
 * avec leur taille, leur date et leurs attributs. Get-ChildItem, Get-Item et
 * Test-Path y répondent, et Remove-Item est un mouchard.
 *
 * `reparsePoints` marque des chemins comme points de réanalyse — c'est ainsi
 * qu'on éprouve le refus de traverser un lien sans en créer un.
 * `changerAuSecondRegard` fait muter un fichier entre le manifeste et la
 * suppression : c'est la course entre vérification et action, reproduite
 * exactement.
 */
function bancTc({
  journal, script,
  fichiers = null,
  reparsePoints = [],
  changerAuSecondRegard = null,
  echecSur = null,
  echecsSur = [],
  journalEchoue = false,
  survivants = [],
  reapparus = [],
}) {
  const base = fichiers ?? [
    { chemin: 'C:\\FauxTemp\\vieux1.tmp', octets: 1048576, jours: 60 },
    { chemin: 'C:\\FauxTemp\\vieux2.tmp', octets: 2097152, jours: 90 },
    { chemin: 'C:\\FauxTemp\\recent.tmp', octets: 524288, jours: 1 },
  ];
  const lignes = base.map((f) =>
    `  @{ Chemin = ${psLitteral(f.chemin)}; Octets = ${f.octets}; Jours = ${f.jours} }`).join('\n');
  return entete(journal) + decorWindows() + `
# --- Un faux systeme de fichiers, en memoire --------------------------------
#
# L'etat du banc est en portee GLOBALE et prefixe « KjemoBanc ». Ce n'est pas
# de la coquetterie : le script teste est point-source (« . script.ps1 »), donc
# il PARTAGE la portee du banc, et les variables PowerShell sont insensibles a
# la casse. Un banc qui stockait ses fichiers dans $script:Fichiers etait donc
# ecrase par le « $fichiers = @() » du script teste, quelques lignes avant
# l'enumeration. Le banc mesurait alors un dossier vide et concluait a tort que
# le verrou bloquait. Le prefixe rend la collision impossible.
$global:KjemoBancFichiers = @(
${lignes}
)
$global:KjemoBancReparse = @(${reparsePoints.map((r) => psLitteral(r)).join(', ') || "''"})
$global:KjemoBancRegards = @{}
$global:KjemoBancSurvivants = @(${survivants.map((r) => psLitteral(r)).join(', ') || "''"})

# Les fichiers qui REAPPARAISSENT : absents a la relecture immediate qui suit
# leur suppression, presents a la verification finale. C'est le cas d'une
# application qui recree son fichier temporaire aussitot.
$global:KjemoBancReapparus = @(${reapparus.map((r) => psLitteral(r)).join(', ') || "''"})
$global:KjemoBancTestsApres = @{}

# Les chemins dont Remove-Item a REUSSI. Sans ce registre, la doublure de
# Test-Path retombait sur son « return $true » final et declarait presents TOUS
# les fichiers supprimes : le banc fabriquait 130 suppressions sans effet. Un
# fichier supprime doit etre absent, c'est le cas ordinaire.
$global:KjemoBancSupprimes = @{}

# Split-Path, sur des chemins Windows, SOUS LINUX.
#
# Le banc tourne sous Linux : le Split-Path de PowerShell y decoupe sur « / »,
# pas sur « \\ ». Les chemins du faux systeme de fichiers etant des chemins
# Windows, aucun parent ne correspondait et le manifeste restait vide — le banc
# mesurait la difference de plateforme au lieu du verrou.
function Split-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$Path, [switch]$Parent, [switch]$Leaf)
  $i = $Path.LastIndexOf('\\')
  if ($i -lt 0) {
    if ($Parent) { return '' }
    return $Path
  }
  if ($Parent) { return $Path.Substring(0, $i) }
  return $Path.Substring($i + 1)
}

function Script:EstReparse([string]$Chemin) {
  foreach ($r in $global:KjemoBancReparse) {
    if ($r -ne '' -and $Chemin -eq $r) { return $true }
  }
  return $false
}
function Script:FauxItem([string]$Chemin) {
  foreach ($f in $global:KjemoBancFichiers) {
    if ([string]$f.Chemin -eq $Chemin) {
      $n = 0
      if ($global:KjemoBancRegards.ContainsKey($Chemin)) { $n = [int]$global:KjemoBancRegards[$Chemin] }
      $n = $n + 1
      $global:KjemoBancRegards[$Chemin] = $n
      $octets = [long]$f.Octets
      $jours = [int]$f.Jours
      $attr = [System.IO.FileAttributes]::Normal
      ${changerAuSecondRegard ? `if ($Chemin -eq ${psLitteral(changerAuSecondRegard.chemin)} -and $n -ge 2) {
        ${changerAuSecondRegard.quoi === 'taille' ? '$octets = $octets + 4096' : ''}
        ${changerAuSecondRegard.quoi === 'age' ? '$jours = 0' : ''}
        ${changerAuSecondRegard.quoi === 'reparse' ? '$attr = [System.IO.FileAttributes]::ReparsePoint' : ''}
        ${changerAuSecondRegard.quoi === 'dossier' ? '$attr = [System.IO.FileAttributes]::Directory' : ''}
      }` : ''}
      $parent = [pscustomobject]@{
        FullName = (Split-Path -Parent $Chemin)
        Attributes = [System.IO.FileAttributes]::Directory
        Parent = $null
      }
      return [pscustomobject]@{
        FullName = $Chemin
        Length = $octets
        LastWriteTime = (Get-Date).AddDays(-$jours)
        Attributes = $attr
        Directory = $parent
        Parent = $null
        Name = (Split-Path -Leaf $Chemin)
      }
    }
  }
  return $null
}
function Get-Item {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  if (Script:EstReparse $cible) {
    return [pscustomobject]@{
      FullName = $cible
      Attributes = [System.IO.FileAttributes]::ReparsePoint
      Parent = $null
      Directory = $null
      Name = (Split-Path -Leaf $cible)
    }
  }
  $f = Script:FauxItem $cible
  if ($f) { return $f }
  # Un dossier : attributs de repertoire, sans parent pour arreter la remontee.
  return [pscustomobject]@{
    FullName = $cible
    Attributes = [System.IO.FileAttributes]::Directory
    Parent = $null
    Directory = $null
    Name = (Split-Path -Leaf $cible)
  }
}
function Get-ChildItem {
  [CmdletBinding()] param([string]$LiteralPath, [string]$Path, [switch]$File, [switch]$Directory, [switch]$Recurse, [string]$Filter)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  if ($Directory) {
    $sous = @()
    foreach ($r in $global:KjemoBancReparse) {
      if ($r -ne '' -and (Split-Path -Parent $r) -eq $cible) {
        $sous += [pscustomobject]@{
          FullName = $r
          Name = (Split-Path -Leaf $r)
          Attributes = [System.IO.FileAttributes]::ReparsePoint
        }
      }
    }
    return $sous
  }
  $sortie = @()
  foreach ($f in $global:KjemoBancFichiers) {
    if ((Split-Path -Parent ([string]$f.Chemin)) -eq $cible) {
      $sortie += (Script:FauxItem ([string]$f.Chemin))
    }
  }
  return $sortie
}
function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  foreach ($s in $global:KjemoBancSurvivants) { if ($s -ne '' -and $cible -eq $s) { return $true } }
  foreach ($f in $global:KjemoBancFichiers) { if ([string]$f.Chemin -eq $cible) { return $true } }
  # Un chemin dont Remove-Item a reussi est ABSENT — sauf s'il figure parmi
  # les « reapparus » : la PREMIERE relecture le dit alors absent et les
  # suivantes le disent present, ce qui modelise une application qui recree son
  # fichier temporaire entre la suppression et la verification finale.
  if ($global:KjemoBancSupprimes.ContainsKey($cible)) {
    foreach ($r in $global:KjemoBancReapparus) {
      if ($r -ne '' -and $cible -eq $r) {
        $n = 0
        if ($global:KjemoBancTestsApres.ContainsKey($cible)) { $n = [int]$global:KjemoBancTestsApres[$cible] }
        $n = $n + 1
        $global:KjemoBancTestsApres[$cible] = $n
        if ($n -ge 2) { return $true }
        return $false
      }
    }
    return $false
  }
  if ($cible -like '*Journaux*' -or $cible -like '*Kjemo*') { return $false }
  return $true
}
function Remove-Item {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  Write-KjemoAppel ('Remove-Item ' + $cible)
  ${echecSur ? `if ($cible -eq ${psLitteral(echecSur)}) { throw 'ECHEC SIMULE : fichier verrouille' }` : ''}
  ${echecsSur.length ? `if (@(${echecsSur.map((x) => psLitteral(x)).join(', ')}) -contains $cible) { throw 'ECHEC SIMULE : fichier verrouille' }` : ''}
  $global:KjemoBancFichiers = @($global:KjemoBancFichiers | Where-Object { [string]$_.Chemin -ne $cible })
  $global:KjemoBancSupprimes[$cible] = $true
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
function Add-Content {
  [CmdletBinding()] param([string]$LiteralPath, $Value, [string]$Encoding)
  Write-KjemoAppel 'Add-Content'
  return $null
}
function Join-Path {
  [CmdletBinding()] param([Parameter(Position=0)]$Path, [Parameter(Position=1)]$ChildPath)
  if (-not $Path) { return [string]$ChildPath }
  return ((([string]$Path) -replace '[\\\\/]+$', '') + '\\\\' + [string]$ChildPath)
}
function Start-Sleep { [CmdletBinding()] param([int]$Seconds) return $null }

# La liste blanche du script pointe vers $env:TEMP : on la fait pointer vers
# notre faux dossier, pour que les gardiens travaillent sur des chemins qu'on
# controle.
$env:TEMP = 'C:\\FauxTemp'
$env:LOCALAPPDATA = 'C:\\FauxLocal'

. ${psLitteral(script)}
`;
}

function jouerTc(nom, { mode, emplacements, age, tailleMax, confirmation, journalChemin, eleve = true, abimer = null, ...reste }) {
  const valeurs = valeursDe(outilTc, {
    mode,
    ...(emplacements ? { tcEmplacements: emplacements } : {}),
    ...(age !== undefined ? { tcAgeMinimum: String(age) } : {}),
    ...(tailleMax !== undefined ? { tcTailleMaxMo: String(tailleMax) } : {}),
    tcConfirmation: confirmation ?? '',
    ...(journalChemin !== undefined ? { tcJournal: journalChemin } : {}),
  });
  let script;
  try { script = outilTc.generate(valeurs); } catch (e) { return { refus: e.message }; }
  script = avecCheminsWindows(avecElevation(script, eleve));
  if (abimer) {
    // Une contre-épreuve peut avoir besoin de DEUX substitutions : désarmer le
    // verrou, et placer le script dans l'état que ce verrou est censé bloquer.
    for (const sub of Array.isArray(abimer) ? abimer : [abimer]) {
      if (!script.includes(sub.de)) return { refus: `motif introuvable : ${sub.de}` };
      script = script.replace(sub.de, sub.vers);
    }
  }
  const journal = join(travail, `tc-${nom}.txt`);
  const cheminScript = ecrirePs1(join(travail, `tc-${nom}.ps1`), script);
  const banc = ecrirePs1(join(travail, `banc-tc-${nom}.ps1`),
    bancTc({ journal, script: cheminScript, ...reste }));
  const resultat = executerBanc(banc);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

const MARQUEUR_TC = /=== temp-cleanup -/;

/**
 * Le CODE NU d'un script : commentaires retires, contenu des chaines vide.
 *
 * Un script doit pouvoir ECRIRE « Remove-Item a leve une erreur » dans un
 * libelle de journal, ou expliquer en commentaire pourquoi il n'emploie pas
 * -Recurse, sans qu'on y voie un appel. Ce qu'on compte ici, c'est ce que
 * PowerShell executerait.
 */
function codeNu(script) {
  const lignes = [];
  for (const ligne of script.split('\n')) {
    let sortie = '';
    let i = 0;
    let quote = null;
    while (i < ligne.length) {
      const c = ligne[i];
      if (quote) {
        if (c === quote && ligne[i + 1] === quote) { i += 2; continue; }
        if (c === quote) { sortie += c; quote = null; i += 1; continue; }
        i += 1;
        continue;
      }
      if (c === "'" || c === '"') { quote = c; sortie += c; i += 1; continue; }
      if (c === '#') break;                 // commentaire : le reste de la ligne tombe
      sortie += c;
      i += 1;
    }
    lignes.push(sortie);
  }
  return lignes;
}

/** Les lignes de code qui APPELLENT reellement Remove-Item. */
function appelsRemoveItem(script) {
  return codeNu(script).filter((l) => /(^|[\s;|&({])Remove-Item\b/.test(l));
}
const suppressions = (appels) => appels.filter((a) => a.startsWith('Remove-Item')).length;
const supprime = (appels, chemin) => appels.includes(`Remove-Item ${chemin}`);

{
  // H1 — contrôle positif : les deux fichiers anciens sont supprimés, le récent
  // est CONSERVÉ. Sans ce contrôle, un verrou qui bloquerait tout passerait.
  const b = jouerTc('positif', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
  });
  const avant = failed;
  assert(!b.refus, `contrôle positif : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(MARQUEUR_TC.test(b.resultat.stdout), 'contrôle positif : exécution jusqu’au rapport');
    assert(suppressions(b.appels) === 2,
      `contrôle positif : EXACTEMENT deux suppressions, les deux fichiers anciens (${suppressions(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    assert(supprime(b.appels, 'C:\\FauxTemp\\vieux1.tmp') && supprime(b.appels, 'C:\\FauxTemp\\vieux2.tmp'),
      'contrôle positif : ce sont bien les deux fichiers anciens', b.appels.join(', '));
    assert(!supprime(b.appels, 'C:\\FauxTemp\\recent.tmp'),
      'contrôle positif : le fichier RÉCENT est conservé', b.appels.join(', '));
    assert(b.appels.includes('Set-Content'),
      'contrôle positif : le journal est écrit AVANT les suppressions', b.appels.join(', '));
    assert(b.appels.indexOf('Set-Content') < b.appels.findIndex((a) => a.startsWith('Remove-Item')),
      'contrôle positif : le journal précède la première suppression', b.appels.join(' → '));
    if (failed > avant) diagnostic('tc positif', b.resultat);
  }
}
{
  // H2 — mode Diagnostic : ZÉRO suppression, même avec la confirmation. Le
  // mode aperçu est obligatoire, et c'est ici qu'on le prouve.
  const b = jouerTc('apercu', { mode: 'Diagnostic', confirmation: PHRASE_TC, age: 30 });
  const avant = failed;
  assert(suppressions(b.appels) === 0,
    `mode aperçu : ZÉRO suppression (${suppressions(b.appels)})`, b.appels.join(', ') || '(vide)');
  assert(/APERCU/i.test(b.sortie), 'mode aperçu : le script annonce un aperçu');
  assert(/Fichiers envisages/i.test(b.sortie) || /envisage/i.test(b.sortie),
    'mode aperçu : le manifeste est présenté');
  if (failed > avant) diagnostic('tc aperçu', b.resultat);
}
{
  // H3 — confirmation absente ou approximative : refusée par la validation.
  for (const mauvaise of ['', 'je supprime ces fichiers temporaires', 'oui', 'JE SUPPRIME CES FICHIERS']) {
    const v = valeursDe(outilTc, { mode: 'Appliquer', tcConfirmation: mauvaise });
    assert(Boolean(outilTc.validate(v).tcConfirmation),
      `confirmation « ${mauvaise || '(vide)'} » : refusée`);
  }
}
{
  // H4 — AUCUN CHEMIN LIBRE. C'est la règle centrale de l'assistant : il faut
  // prouver qu'aucun champ ne permet de désigner un chemin à nettoyer.
  const champsChemin = outilTc.fields.filter((f) =>
    /chemin|dossier|répertoire|emplacement/i.test(f.label) && f.id !== 'tcJournal');
  for (const champ of champsChemin) {
    assert(champ.type === 'select',
      `le champ « ${champ.id} » est une LISTE FERMÉE, pas une saisie libre (${champ.type})`);
  }
  // Et les seules valeurs acceptées sont les trois choix prévus.
  for (const tentative of ['C:\\', 'C:\\Users\\jdupont', '\\\\serveur\\partage', 'C:\\Windows', '.']) {
    const v = valeursDe(outilTc, { mode: 'Appliquer', tcEmplacements: tentative, tcConfirmation: PHRASE_TC });
    assert(Boolean(outilTc.validate(v).tcEmplacements),
      `« ${tentative} » comme emplacement : refusé — aucun chemin libre n’est accepté`);
  }
}
{
  // H5 — le dossier du JOURNAL, lui, est un chemin : il doit passer le gardien.
  for (const mauvais of ['', '   ', 'Journaux\\relatif', '\\\\serveur\\journaux', 'C:\\']) {
    const v = valeursDe(outilTc, { mode: 'Appliquer', tcJournal: mauvais, tcConfirmation: PHRASE_TC });
    assert(Boolean(outilTc.validate(v).tcJournal),
      `journal « ${mauvais.trim() || '(vide)'} » : refusé`);
  }
}
{
  // H6 — JOURNAL EN ÉCHEC : zéro suppression. Pas de suppression non traçable.
  const b = jouerTc('sansJournal', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, journalEchoue: true,
  });
  const avant = failed;
  assert(suppressions(b.appels) === 0,
    `journal en échec : ZÉRO suppression (${suppressions(b.appels)})`, b.appels.join(', ') || '(vide)');
  assert(/journal|BLOQU/i.test(b.sortie), 'journal en échec : le script nomme la cause');
  if (failed > avant) diagnostic('tc sans journal', b.resultat);
}
{
  // H7 — BORNE DE TAILLE : le script refuse, et ne tronque PAS la liste pour
  // passer dessous. C'est la différence entre refuser et bricoler.
  const b = jouerTc('borneDepassee', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 1,
  });
  const avant = failed;
  assert(suppressions(b.appels) === 0,
    `borne de taille dépassée : ZÉRO suppression (${suppressions(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/borne|BLOQU/i.test(b.sortie), 'borne dépassée : le script nomme la cause');
  if (failed > avant) diagnostic('tc borne', b.resultat);
}
{
  // H8 — FICHIER RÉCENT CONSERVÉ, même seul. Avec un seuil très haut, aucun
  // fichier n'est assez ancien : rien ne doit être supprimé.
  const b = jouerTc('tousRecents', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 365,
  });
  const avant = failed;
  assert(suppressions(b.appels) === 0,
    `aucun fichier assez ancien : ZÉRO suppression (${suppressions(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  if (failed > avant) diagnostic('tc tous récents', b.resultat);
}
{
  // H9 — POINT DE RÉANALYSE : un sous-dossier qui est une jonction n'est pas
  // traversé, et son contenu n'est pas supprimé.
  const b = jouerTc('reparseSousDossier', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    reparsePoints: ['C:\\FauxTemp\\lien'],
    fichiers: [
      { chemin: 'C:\\FauxTemp\\vieux1.tmp', octets: 1048576, jours: 60 },
      { chemin: 'C:\\FauxTemp\\lien\\cible.tmp', octets: 1048576, jours: 60 },
    ],
  });
  const avant = failed;
  assert(MARQUEUR_TC.test(b.resultat.stdout), 'point de réanalyse : exécution jusqu’au rapport');
  assert(!supprime(b.appels, 'C:\\FauxTemp\\lien\\cible.tmp'),
    'point de réanalyse : le contenu DERRIÈRE le lien n’est PAS supprimé', b.appels.join(', '));
  assert(/reanalyse/i.test(b.sortie),
    'point de réanalyse : le script signale qu’il ne traverse pas le lien');
  if (failed > avant) diagnostic('tc réanalyse sous-dossier', b.resultat);
}
{
  // H10 — POINT DE RÉANALYSE SUR LA RACINE : l'emplacement entier est écarté.
  const b = jouerTc('reparseRacine', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    reparsePoints: ['C:\\FauxTemp'],
  });
  const avant = failed;
  assert(suppressions(b.appels) === 0,
    `racine de l’emplacement = point de réanalyse : ZÉRO suppression (${suppressions(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(/reanalyse/i.test(b.sortie), 'réanalyse sur la racine : le script le dit');
  if (failed > avant) diagnostic('tc réanalyse racine', b.resultat);
}
{
  // H11 — LA COURSE ENTRE VÉRIFICATION ET SUPPRESSION. Quatre mutations
  // possibles entre le manifeste et l'action. Dans chaque cas, le fichier muté
  // doit être IGNORÉ, et l'autre supprimé normalement.
  for (const [quoi, etiquette] of [
    ['taille', 'le fichier a été remplacé (taille différente)'],
    ['age', 'le fichier est devenu plus récent que le seuil'],
    ['reparse', 'le fichier est devenu un point de réanalyse'],
    ['dossier', 'le fichier est devenu un dossier'],
  ]) {
    const b = jouerTc(`course-${quoi}`, {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
      changerAuSecondRegard: { chemin: 'C:\\FauxTemp\\vieux1.tmp', quoi },
    });
    const avant = failed;
    assert(!supprime(b.appels, 'C:\\FauxTemp\\vieux1.tmp'),
      `course : ${etiquette} → le fichier muté n’est PAS supprimé`, b.appels.join(', ') || '(vide)');
    assert(supprime(b.appels, 'C:\\FauxTemp\\vieux2.tmp'),
      `course : ${etiquette} → l’autre fichier est traité normalement`, b.appels.join(', '));
    assert(/Ignores|IGNORE/i.test(b.sortie),
      `course : ${etiquette} → l’écart est signalé`);
    if (failed > avant) diagnostic(`tc course ${quoi}`, b.resultat);
  }
}
{
  // H12 — FICHIER VERROUILLÉ : l'erreur est isolée, journalisée, et le
  // traitement CONTINUE. Un nettoyage qui s'arrête au premier fichier ouvert
  // ne sert à rien.
  const b = jouerTc('verrouille', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    echecSur: 'C:\\FauxTemp\\vieux1.tmp',
  });
  const avant = failed;
  assert(suppressions(b.appels) === 2,
    `fichier verrouillé : les deux suppressions ont été TENTÉES (${suppressions(b.appels)})`,
    b.appels.join(', ') || '(vide)');
  assert(supprime(b.appels, 'C:\\FauxTemp\\vieux2.tmp'),
    'fichier verrouillé : le traitement a continué sur le suivant', b.appels.join(', '));
  assert(/Echecs|ECHEC/i.test(b.sortie), 'fichier verrouillé : l’échec est rapporté');
  assert(b.appels.includes('Add-Content'), 'fichier verrouillé : le résultat est journalisé');
  if (failed > avant) diagnostic('tc verrouillé', b.resultat);
}
{
  // H13 — RELECTURE : si des fichiers censés être supprimés sont encore là,
  // aucune réussite n'est annoncée.
  const b = jouerTc('survivants', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    survivants: ['C:\\FauxTemp\\vieux1.tmp', 'C:\\FauxTemp\\vieux2.tmp'],
  });
  const avant = failed;
  assert(/NON conforme/i.test(b.sortie),
    'relecture : le verdict est NON conforme quand des fichiers survivent');
  assert(!/conforme a la relecture/i.test(b.sortie),
    'relecture : AUCUNE réussite n’est annoncée');
  if (failed > avant) diagnostic('tc survivants', b.resultat);
}
{
  // H13 bis — LE DÉFAUT RELEVÉ PAR CODEX, ET SES CINQ SCÉNARIOS.
  //
  // L'ancienne relecture comparait le nombre de survivants parmi les CENT
  // PREMIERS éléments du manifeste à la somme $ignores + $echecs. Trois
  // faiblesses, chacune suffisante pour produire un rapport mensonger :
  //   - un survivant légitime compensait arithmétiquement un survivant
  //     illégitime ailleurs ;
  //   - un survivant au-delà du centième élément n'était jamais relu ;
  //   - un fichier dont Remove-Item avait rendu la main sans erreur comptait
  //     comme supprimé, et son espace comme libéré, sans aucune vérification.
  //
  // Quatre collections distinctes remplacent les compteurs mêlés, chaque
  // suppression est relue immédiatement, et la vérification finale porte sur
  // TOUS les chemins annoncés supprimés.

  // Un faux dossier de 130 fichiers, tous assez anciens : le manifeste dépasse
  // la centaine, ce qui est la condition des scénarios 2 et 3.
  const beaucoup = [];
  for (let i = 1; i <= 130; i += 1) {
    beaucoup.push({
      chemin: `C:\\FauxTemp\\f${String(i).padStart(3, '0')}.tmp`,
      octets: 1024 * i, jours: 60,
    });
  }
  const cheminN = (i) => `C:\\FauxTemp\\f${String(i).padStart(3, '0')}.tmp`;
  // DEUX nombres distincts, et c'est tout l'objet de la correction : celui que
  // la relecture immediate a constate, et celui qui est ANNONCE a la fin.
  const nbImmediat = (sortie) => {
    const m = sortie.match(/Confirmes immediatement : (\d+)/);
    return m ? Number(m[1]) : -1;
  };
  const nbFinal = (sortie) => {
    const m = sortie.match(/Supprimes \(absence confirmee a la fin\) : (\d+)/);
    return m ? Number(m[1]) : -1;
  };
  const moFinal = (sortie) => {
    const m = sortie.match(/\(([\d.,]+) Mo reellement liberes\)/);
    return m ? Number(String(m[1]).replace(',', '.')) : -1;
  };

  // --- Scénario 1 : Remove-Item rend la main sans erreur, le fichier reste ---
  {
    const b = jouerTc('relecture-fantome', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
      survivants: ['C:\\FauxTemp\\vieux1.tmp'],
    });
    const avant = failed;
    assert(!b.refus, `scénario 1 : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(/NON conforme/i.test(b.sortie),
        'scénario 1 — suppression sans effet : verdict NON conforme');
      assert(/suppression\(s\) sans effet/i.test(b.sortie),
        'scénario 1 — le motif exact est nommé : suppression sans effet');
      assert(nbFinal(b.sortie) === 1,
        `scénario 1 — un seul fichier annoncé supprimé à la fin, le fantôme est exclu (${nbFinal(b.sortie)})`,
        b.sortie.split('\n').filter((l) => /Supprimes|Confirmes/.test(l)).join(' | '));
      assert(nbImmediat(b.sortie) === 1,
        `scénario 1 — et la relecture immédiate en avait déjà confirmé un seul (${nbImmediat(b.sortie)})`);
      if (failed > avant) diagnostic('tc relecture fantôme', b.resultat);
    }
  }

  // --- Scénario 2 : un survivant dans les 100 premiers, et PLUSIEURS échecs
  // après le centième. L'ancienne arithmétique concluait « conforme ».
  {
    const b = jouerTc('relecture-compensation', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 4096,
      fichiers: beaucoup,
      survivants: [cheminN(7)],
      echecsSur: [cheminN(115), cheminN(120), cheminN(128)],
    });
    const avant = failed;
    assert(!b.refus, `scénario 2 : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(/NON conforme/i.test(b.sortie),
        'scénario 2 — un survivant et trois échecs ailleurs : verdict NON conforme, pas de compensation arithmétique');
      assert(/Echecs : 3/.test(b.sortie),
        'scénario 2 — les trois échecs sont comptés séparément',
        b.sortie.split('\n').filter((l) => /Echecs/.test(l)).join(' | '));
      assert(/Sans effet : 1/.test(b.sortie),
        'scénario 2 — la suppression sans effet est comptée séparément',
        b.sortie.split('\n').filter((l) => /Sans effet/.test(l)).join(' | '));
      if (failed > avant) diagnostic('tc relecture compensation', b.resultat);
    }
  }

  // --- Scénario 3 : le survivant est APRÈS le centième élément ---
  {
    const b = jouerTc('relecture-apres100', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 4096,
      fichiers: beaucoup,
      survivants: [cheminN(127)],
    });
    const avant = failed;
    assert(!b.refus, `scénario 3 : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(/NON conforme/i.test(b.sortie),
        'scénario 3 — un survivant au-delà du centième élément : verdict NON conforme');
      assert(nbFinal(b.sortie) === 129,
        `scénario 3 — 129 supprimés annoncés sur 130, le survivant du 127e exclu (${nbFinal(b.sortie)})`);
      if (failed > avant) diagnostic('tc relecture après 100', b.resultat);
    }
  }

  // --- Scénario 4 : un fichier supprimé est RECRÉÉ avant la vérification
  // finale. Absent à la relecture immédiate, présent à la fin.
  {
    const b = jouerTc('relecture-reapparu', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
      reapparus: ['C:\\FauxTemp\\vieux2.tmp'],
    });
    const avant = failed;
    assert(!b.refus, `scénario 4 : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(/NON conforme/i.test(b.sortie),
        'scénario 4 — fichier recréé avant la vérification finale : verdict NON conforme');
      assert(/Reapparus : 1/.test(b.sortie),
        'scénario 4 — le fichier recréé est compté comme réapparu',
        b.sortie.split('\n').filter((l) => /Reapparus/.test(l)).join(' | '));
      // Les deux nombres DIVERGENT, et c'est exactement ce qu'on veut voir :
      // la relecture immédiate en avait confirmé deux, la vérification finale
      // n'en annonce qu'un. Le réapparu est retiré du total ET de l'espace.
      assert(nbImmediat(b.sortie) === 2,
        `scénario 4 — deux confirmés immédiatement (${nbImmediat(b.sortie)})`);
      assert(nbFinal(b.sortie) === 1,
        `scénario 4 — un seul annoncé supprimé à la fin : le réapparu est retiré (${nbFinal(b.sortie)})`);
      const moApres = moFinal(b.sortie);
      const moAvant = (() => {
        const m = b.sortie.match(/Relecture faite juste apres chaque Remove-Item : ([\d.,]+) Mo/);
        return m ? Number(String(m[1]).replace(',', '.')) : -1;
      })();
      assert(moApres >= 0,
        `scénario 4 — les Mo réellement libérés sont annoncés (${moApres})`);
      assert(moAvant === -1 || moApres < moAvant || moApres === 0,
        `scénario 4 — l’espace du réapparu est retiré du total annoncé (${moApres} Mo annoncés)`);
      if (failed > avant) diagnostic('tc relecture réapparu', b.resultat);
    }
  }

  // --- Scénario 5 : mélange — des réussites, un ignoré, des échecs ---
  {
    const b = jouerTc('relecture-melange', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 4096,
      fichiers: beaucoup,
      changerAuSecondRegard: { chemin: cheminN(3), quoi: 'taille' },
      echecsSur: [cheminN(10), cheminN(110)],
      survivants: [cheminN(50)],
      reapparus: [cheminN(125)],
    });
    const avant = failed;
    assert(!b.refus, `scénario 5 : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(/NON conforme/i.test(b.sortie),
        'scénario 5 — mélange : verdict NON conforme');
      assert(/Ignores : 1/.test(b.sortie), 'scénario 5 — un ignoré, compté comme tel',
        b.sortie.split('\n').filter((l) => /Ignores/.test(l)).join(' | '));
      assert(/Echecs : 2/.test(b.sortie), 'scénario 5 — deux échecs, comptés comme tels');
      assert(/Sans effet : 1/.test(b.sortie), 'scénario 5 — une suppression sans effet');
      assert(/Reapparus : 1/.test(b.sortie), 'scénario 5 — un réapparu');
      // LE COMPTE EXACT, et c'est le point que la revue finale a relevé.
      // 130 au manifeste, moins 1 ignoré = 129 tentés ; moins 2 échecs = 127
      // rendus sans erreur ; moins 1 sans effet = 126 confirmés immédiatement ;
      // moins 1 réapparu = 125 réellement supprimés. L'ancien comptage
      // annonçait 126, en gardant le réapparu dans le total.
      assert(nbImmediat(b.sortie) === 126,
        `scénario 5 — 126 confirmés immédiatement (${nbImmediat(b.sortie)})`);
      assert(nbFinal(b.sortie) === 125,
        `scénario 5 — 125 réellement supprimés, le réapparu retiré du total (${nbFinal(b.sortie)})`);
      assert(moFinal(b.sortie) >= 0 && moFinal(b.sortie) < 999999,
        `scénario 5 — les Mo annoncés sont ceux du total final (${moFinal(b.sortie)} Mo)`);
      if (failed > avant) diagnostic('tc relecture mélange', b.resultat);
    }
  }

  // --- Contrôle positif : rien d'anormal, et le verdict est conforme ---
  {
    const b = jouerTc('relecture-saine', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 4096,
      fichiers: beaucoup,
    });
    const avant = failed;
    assert(!b.refus, `contrôle positif : le script se génère${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(!/NON conforme/i.test(b.sortie),
        'contrôle positif — 130 suppressions propres : aucun verdict NON conforme');
      assert(nbImmediat(b.sortie) === 130,
        `contrôle positif — 130 confirmés immédiatement (${nbImmediat(b.sortie)})`);
      assert(nbFinal(b.sortie) === 130,
        `contrôle positif — 130 réellement supprimés, les deux nombres coïncident (${nbFinal(b.sortie)})`);
      assert(suppressions(b.appels) === 130,
        `contrôle positif — 130 appels Remove-Item, un par fichier (${suppressions(b.appels)})`);
      if (failed > avant) diagnostic('tc relecture saine', b.resultat);
    }
  }
}
{
  // H13 ter — TROIS CONTRE-ÉPREUVES de la nouvelle relecture.
  //
  // Un verdict « conforme » obtenu sur un banc sain ne prouve pas que la
  // relecture sert à quelque chose. On désarme donc chaque garde tour à tour,
  // et le banc doit alors voir le mensonge.
  const beaucoup = [];
  for (let i = 1; i <= 130; i += 1) {
    beaucoup.push({
      chemin: `C:\\FauxTemp\\f${String(i).padStart(3, '0')}.tmp`,
      octets: 1024 * i, jours: 60,
    });
  }
  const cheminN = (i) => `C:\\FauxTemp\\f${String(i).padStart(3, '0')}.tmp`;

  // (a) La relecture IMMÉDIATE désarmée. Le fantôme entre alors dans les
  // supprimés — mais la vérification FINALE, elle, le rattrape. C'est la
  // défense en profondeur, et on la montre.
  {
    const b = jouerTc('abimeRelectureImmediate', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
      survivants: ['C:\\FauxTemp\\vieux1.tmp'],
      abimer: [{
        de: '      try { $encoreLaApres = Test-Path -LiteralPath $cheminF } catch { $encoreLaApres = $true }',
        vers: '      $encoreLaApres = $false',
      }],
    });
    const avant = failed;
    assert(!b.refus, `contre-épreuve (a) : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(/NON conforme/i.test(b.sortie),
        'contre-épreuve (a) — sans la relecture immédiate, la vérification finale rattrape le fantôme');
      assert(/Reapparus : 1/.test(b.sortie),
        'contre-épreuve (a) — il est alors compté comme présent à la vérification finale',
        b.sortie.split('\n').filter((l) => /Reapparus/.test(l)).join(' | '));
      if (failed > avant) diagnostic('tc contre-épreuve relecture immédiate', b.resultat);
    }
  }

  // (b) La vérification FINALE ramenée à un échantillon de cent, comme avant.
  // Avec un survivant au-delà du centième, le rapport redevient mensonger.
  {
    const b = jouerTc('abimeEchantillon100', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 4096,
      fichiers: beaucoup,
      survivants: [cheminN(127)],
      abimer: [
        {
          de: '      try { $encoreLaApres = Test-Path -LiteralPath $cheminF } catch { $encoreLaApres = $true }',
          vers: '      $encoreLaApres = $false',
        },
        {
          de: '  foreach ($paire in $confirmesImmediat) {',
          vers: '  foreach ($paire in @($confirmesImmediat | Select-Object -First 100)) {',
        },
      ],
    });
    const avant = failed;
    assert(!b.refus, `contre-épreuve (b) : les substitutions ont eu lieu${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(!/NON conforme/i.test(b.sortie),
        'contre-épreuve (b) — avec un échantillon de cent, le survivant du 127e passe inaperçu : le rapport MENT');
      if (failed > avant) diagnostic('tc contre-épreuve échantillon 100', b.resultat);
    }
    // Et la version SAINE, même configuration, dit NON conforme. C'est la
    // comparaison des deux qui prouve que la correction sert.
    const saine = jouerTc('echantillon100-saine', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 4096,
      fichiers: beaucoup,
      survivants: [cheminN(127)],
    });
    assert(/NON conforme/i.test(saine.sortie),
      'contre-épreuve (b) — la version corrigée, elle, voit le survivant du 127e');
  }

  // (c) Le verdict ramené à la comparaison arithmétique d'avant. Un fantôme et
  // trois échecs : la somme compense, et le rapport annonce « conforme ».
  {
    const b = jouerTc('abimeVerdictArithmetique', {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, tailleMax: 4096,
      fichiers: beaucoup,
      survivants: [cheminN(7)],
      echecsSur: [cheminN(115), cheminN(120), cheminN(128)],
      abimer: [{
        de: '  if ($nbFantomes -gt 0 -or $nbReapparus -gt 0) {',
        vers: '  if (($nbFantomes + $nbReapparus) -gt ($nbIgnores + $nbEchecs)) {',
      }],
    });
    const avant = failed;
    assert(!b.refus, `contre-épreuve (c) : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(!/NON conforme/i.test(b.sortie),
        'contre-épreuve (c) — avec l’arithmétique d’avant, un fantôme compensé par trois échecs passe pour conforme');
      if (failed > avant) diagnostic('tc contre-épreuve verdict arithmétique', b.resultat);
    }
  }
}
{
  // H13 quater — CONTRE-ÉPREUVE (d) : on REMET l'ancien comptage final.
  //
  // La revue finale a relevé qu'un fichier réapparu restait dans le nombre
  // annoncé supprimé et dans les octets annoncés libérés. On réintroduit donc
  // exactement ce comptage — le total final reprend les confirmations
  // IMMÉDIATES au lieu des absences constatées à la fin — et le banc doit voir
  // le rapport mensonger.
  const ancienComptage = [
    { de: '  $nbFinal     = $absentsFinal.Count', vers: '  $nbFinal     = $confirmesImmediat.Count' },
    { de: '  $moFinal     = [Math]::Round($octetsFinal / 1MB, 1)', vers: '  $moFinal     = [Math]::Round($octetsImmediat / 1MB, 1)' },
  ];
  const lireFinal = (sortie) => {
    const m = sortie.match(/Supprimes \(absence confirmee a la fin\) : (\d+)/);
    return m ? Number(m[1]) : -1;
  };

  // La version SAINE, un fichier réapparu : elle annonce 1.
  const saine = jouerTc('comptageSain', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    reapparus: ['C:\\FauxTemp\\vieux2.tmp'],
  });
  const avantS = failed;
  assert(!saine.refus, `contre-épreuve (d) saine : le script se génère${saine.refus ? ' — ' + saine.refus : ''}`);
  if (!saine.refus) {
    assert(lireFinal(saine.sortie) === 1,
      `contre-épreuve (d) — la version corrigée annonce 1 supprimé, le réapparu retiré (${lireFinal(saine.sortie)})`);
    assert(/NON conforme/i.test(saine.sortie),
      'contre-épreuve (d) — et son verdict reste NON conforme');
    if (failed > avantS) diagnostic('tc comptage sain', saine.resultat);
  }

  // La version SABOTÉE, même configuration : elle annonce 2. C'est le mensonge.
  const fautive = jouerTc('comptageAncien', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    reapparus: ['C:\\FauxTemp\\vieux2.tmp'],
    abimer: ancienComptage,
  });
  const avantF = failed;
  assert(!fautive.refus, `contre-épreuve (d) : les substitutions ont eu lieu${fautive.refus ? ' — ' + fautive.refus : ''}`);
  if (!fautive.refus) {
    assert(lireFinal(fautive.sortie) === 2,
      `contre-épreuve (d) — avec l’ancien comptage, le réapparu reste dans le total : 2 annoncés au lieu de 1 (${lireFinal(fautive.sortie)})`,
      fautive.sortie.split('\n').filter((l) => /Supprimes|Confirmes|Reapparus/.test(l)).join(' | '));
    // Le rapport se contredit alors lui-même : il annonce deux supprimés ET
    // un réapparu, sur deux fichiers traités.
    assert(/Reapparus : 1/.test(fautive.sortie),
      'contre-épreuve (d) — il signale pourtant le réapparu : le rapport se contredit');
    if (failed > avantF) diagnostic('tc comptage ancien', fautive.resultat);
  }
}
{
  // H14 — AUCUNE SUPPRESSION RÉCURSIVE, aucun joker, dans aucun script de cet
  // assistant, mode Appliquer compris.
  for (const empl of ['Temporaires de la session seulement', 'Session et cache Internet',
    'Tous les emplacements de la liste blanche']) {
    const v = valeursDe(outilTc, {
      mode: 'Appliquer', tcEmplacements: empl, tcConfirmation: PHRASE_TC,
    });
    const script = outilTc.generate(v);
    // UN APPEL, pas une mention.
    //
    // La premiere version de cette regle retenait toute ligne contenant
    // « Remove-Item » hors commentaire en debut de ligne. Elle a commence a
    // echouer des que le script a nomme la commande dans un commentaire EN FIN
    // de ligne et dans un libelle de journal : quatre « appels » pour un seul
    // appel reel. La regle confondait nommer et appeler.
    //
    // Elle n'est pas relachee : elle est rendue precise ET plus large. On
    // cherche l'appel dans le CODE NU — commentaires retires, contenu des
    // chaines vide — et on verifie en PLUS, sur le script BRUT, qu'aucune
    // forme dangereuse n'apparait nulle part, pas meme en texte.
    const lignesRemove = appelsRemoveItem(script);
    for (const l of lignesRemove) {
      assert(!/-Recurse/i.test(l), `${empl} : aucun Remove-Item -Recurse`, l.trim());
      assert(!/[*?]/.test(l), `${empl} : aucun joker dans un Remove-Item`, l.trim());
      assert(!/-Force/i.test(l), `${empl} : aucun Remove-Item -Force`, l.trim());
      assert(/-LiteralPath/.test(l), `${empl} : Remove-Item utilise -LiteralPath`, l.trim());
    }
    assert(lignesRemove.length === 1,
      `${empl} : un SEUL appel Remove-Item dans le code (${lignesRemove.length})`,
      lignesRemove.map((x) => x.trim()).join(' | '));
    // Controle supplementaire, sur le script BRUT : la combinaison interdite ne
    // doit apparaitre nulle part, meme dans un commentaire.
    assert(!/Remove-Item[^\n]*-Recurse/i.test(script),
      `${empl} : « Remove-Item -Recurse » n’apparaît nulle part, même en commentaire`);
    assert(!/Remove-Item[^\n]*-Force/i.test(script),
      `${empl} : « Remove-Item -Force » n’apparaît nulle part, même en commentaire`);
    // Et aucune fermeture d'application ni arrêt de service.
    for (const interdit of ['Stop-Process', 'Stop-Service', 'Restart-Service', 'Stop-Computer']) {
      assert(!new RegExp(`\\b${interdit}\\b`).test(script),
        `${empl} : aucun ${interdit} — ni fermeture d’application, ni arrêt de service`);
    }
  }
}
{
  // H15 — CONTRE-ÉPREUVE du verrou principal, en DEUX passes.
  //
  // La phrase de confirmation est validée DEUX fois : par le formulaire, qui
  // refuse de générer le script, et par le script lui-même, qui recompare la
  // phrase avant d'agir. On ne peut donc pas éprouver le second verrou en
  // soumettant un formulaire vide : la génération échoue avant. On génère donc
  // un script PARFAITEMENT valide, puis on falsifie dans le script la variable
  // $ConfirmationOk — ce qui reproduit exactement une confirmation absente —
  // et on observe le verrou.
  const falsifierConfirmation = {
    de: "$ConfirmationOk = ($Confirmation -ceq 'JE SUPPRIME CES FICHIERS TEMPORAIRES')",
    vers: '$ConfirmationOk = $false',
  };
  const desarmerVerrou = {
    de: '$conditionsAppliquer = $ConfirmationOk -and $journalOk',
    vers: '$conditionsAppliquer = $true -and $journalOk',
  };

  // Passe 1 — verrou ARMÉ, confirmation falsifiée : aucune suppression.
  const arme = jouerTc('verrouArme', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    abimer: [falsifierConfirmation],
  });
  const avantArme = failed;
  assert(!arme.refus, `verrou armé : le script se génère${arme.refus ? ' — ' + arme.refus : ''}`);
  if (!arme.refus) {
    assert(suppressions(arme.appels) === 0,
      `verrou armé — confirmation falsifiée, aucune suppression (${suppressions(arme.appels)})`,
      arme.appels.join(', ') || '(vide)');
    assert(/confirmation ecrite absente/.test(arme.sortie),
      'verrou armé — le script nomme la confirmation manquante');
    if (failed > avantArme) diagnostic('tc verrou armé', arme.resultat);
  }

  // Passe 2 — MÊME script, verrou désarmé : la suppression a lieu. C'est la
  // preuve que c'est bien $conditionsAppliquer qui bloquait, et non l'absence
  // de fichiers à supprimer ou un refus plus en amont.
  const b = jouerTc('abimeVerrou', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    abimer: [falsifierConfirmation, desarmerVerrou],
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve : le verrou a pu être désarmé${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(suppressions(b.appels) > 0,
      `contre-épreuve — sans le verrou, la suppression a lieu sans confirmation (${suppressions(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('tc contre-épreuve verrou', b.resultat);
  }
}
{
  // H16 — CONTRE-ÉPREUVE de la revérification d'avant-suppression, désarmée
  // seule. Sans elle, le fichier muté est supprimé quand même.
  const b = jouerTc('abimeCourse', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    changerAuSecondRegard: { chemin: 'C:\\FauxTemp\\vieux1.tmp', quoi: 'taille' },
    abimer: { de: '    if (-not [bool]$verdict[0]) {', vers: '    if ($false) {' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve course : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(supprime(b.appels, 'C:\\FauxTemp\\vieux1.tmp'),
      'contre-épreuve — sans la revérification, le fichier remplacé est supprimé quand même',
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('tc contre-épreuve course', b.resultat);
  }
}
{
  // H17 — CONTRE-ÉPREUVE du refus de traverser un point de réanalyse.
  const b = jouerTc('abimeReparse', {
    mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
    reparsePoints: ['C:\\FauxTemp'],
    abimer: { de: '  if (-not $sansLien) { continue }', vers: '  if ($false) { continue }' },
  });
  const avant = failed;
  assert(!b.refus, `contre-épreuve réanalyse : la substitution a eu lieu${b.refus ? ' — ' + b.refus : ''}`);
  if (!b.refus) {
    assert(suppressions(b.appels) > 0,
      `contre-épreuve — sans le refus, le script nettoie derrière un point de réanalyse (${suppressions(b.appels)})`,
      b.appels.join(', ') || '(vide)');
    if (failed > avant) diagnostic('tc contre-épreuve réanalyse', b.resultat);
  }
}

// ===========================================================================
// I. recycle-bin-cleanup et browser-cache-diagnostic — l'absence de bouton
// ===========================================================================
section('Corbeille et caches de navigateurs — aucune action, et c’est le point');

{
  const outilRb = outilOuEchec('recycle-bin-cleanup');
  const outilBc = outilOuEchec('browser-cache-diagnostic');

  // Ces deux assistants n'ont PAS de mode Appliquer, et c'est une décision
  // documentée. Ce qu'il faut prouver, c'est qu'aucun script généré ne contient
  // le moindre appel modifiant — dans aucune combinaison de paramètres.
  for (const [outil, interdits] of [
    [outilRb, ['Clear-RecycleBin', 'Remove-Item', 'Stop-Process', 'Stop-Service']],
    [outilBc, ['Remove-Item', 'Clear-RecycleBin', 'Stop-Process', 'Stop-Service']],
  ]) {
    assert(!outil.fields.some((f) => f.id === 'mode'),
      `${outil.id} : aucun champ « mode » — il n’existe pas de mode Appliquer`);
    assert(outil.risk === 'diagnostic',
      `${outil.id} : risque déclaré diagnostic (${outil.risk})`);
    // Toutes les combinaisons des champs à liste fermée.
    const listes = outil.fields.filter((f) => f.type === 'select' && Array.isArray(f.options));
    const combinaisons = listes.reduce((acc, f) =>
      acc.flatMap((c) => f.options.map(([val]) => ({ ...c, [f.id]: val }))), [{}]);
    for (const combi of combinaisons) {
      const v = valeursDe(outil, combi);
      let script = null;
      try { script = outil.generate(v); } catch (e) { /* refus */ }
      assert(Boolean(script), `${outil.id} : le script se génère pour ${JSON.stringify(combi).slice(0, 60)}`);
      if (!script) continue;
      const code = script.split('\n')
        .filter((l) => !/^\s*#/.test(l))
        .filter((l) => !/^\s*Write-Host\b/.test(l))
        .join('\n');
      for (const interdit of interdits) {
        assert(!new RegExp(`\\b${interdit}\\b`).test(code),
          `${outil.id} : aucun ${interdit} dans le code, combinaison ${JSON.stringify(combi).slice(0, 48)}`);
      }
    }
    assert(combinaisons.length >= 4,
      `${outil.id} : ${combinaisons.length} combinaison(s) de paramètres éprouvées`);
  }

  // Et le cache de navigateur ne lit AUCUNE donnée personnelle : les noms de
  // fichiers sensibles ne doivent apparaître nulle part dans le code.
  const vBc = valeursDe(outilBc, {});
  const scriptBc = outilBc.generate(vBc);
  const codeBc = scriptBc.split('\n').filter((l) => !/^\s*#/.test(l))
    .filter((l) => !/^\s*Write-Host\b/.test(l)).join('\n');
  // Le script NOMME ces fichiers, exprès, pour dire qu'il ne les lit pas — c'est
  // une qualité du rapport. Ce qu'il faut vérifier, c'est qu'aucune cmdlet de
  // lecture ou de copie ne les prenne pour cible.
  const lignesAcces = codeBc.split('\n').filter((l) =>
    /Get-Content|Get-Item|Copy-Item|Move-Item|Out-File|Import-Csv|ConvertFrom-Json|\[System\.IO\.File\]/.test(l));
  for (const sensible of ['Login Data', 'Cookies', 'Web Data', 'key4.db', 'logins.json',
    'places.sqlite', 'History', 'Bookmarks']) {
    const viseur = lignesAcces.filter((l) => l.includes(sensible));
    assert(viseur.length === 0,
      `browser-cache-diagnostic : aucune lecture ne vise « ${sensible} » (${viseur.length})`,
      viseur.join(' | '));
  }
  // Et le script les nomme bien dans son rapport : c'est ainsi qu'un technicien
  // sait ce qui se trouvait a cote et n'a pas ete touche.
  assert(/Mots de passe enregistres/.test(scriptBc) && /Cookies et sessions/.test(scriptBc),
    'browser-cache-diagnostic : le rapport nomme ce qu’il n’a PAS lu');
  // Les sous-dossiers de cache, eux, sont nommés : c'est ce qu'on mesure.
  assert(/Code Cache|GPUCache|cache2/.test(scriptBc),
    'browser-cache-diagnostic : les sous-dossiers de CACHE sont nommés explicitement');
}

// ===========================================================================

// ===========================================================================
// J. Le gardien du journal — un refus qui ne laisse AUCUN effet de bord
// ===========================================================================
//
// LE DÉFAUT RELEVÉ PAR CODEX.
//
// Les deux assistants qui écrivent un journal appelaient blocJournalAvant()
// AVANT de tenir compte du gardien de chemin : New-Item créait le dossier,
// Set-Content écrivait le fichier, et le refus du gardien n'était appliqué
// qu'APRÈS, en remettant $journalOk à $false. L'action principale était bien
// bloquée — mais un dossier et un fichier avaient été créés à un chemin que le
// gardien venait de refuser. Un refus qui laisse un effet de bord n'est pas un
// refus.
//
// Le gardien ENTOURE désormais le bloc d'écriture. Ce banc l'éprouve sur les
// six formes de chemin que la revue nomme, pour les deux assistants, et exige
// à chaque fois quatre zéros : zéro New-Item, zéro Set-Content, zéro
// Add-Content, zéro action modifiante.
// ===========================================================================
section('Gardien du journal — zéro écriture quand le chemin est refusé');

const ecrituresJournal = (appels) => appels.filter((a) =>
  a === 'New-Item' || a === 'Set-Content' || a === 'Add-Content').length;

const CHEMINS_JOURNAL_REFUSES = [
  { nom: 'racine',       chemin: 'C:\\',                               motif: /[Rr]acine de volume/ },
  { nom: 'unc',          chemin: '\\\\serveur\\partage\\journaux',     motif: /UNC/ },
  { nom: 'relatif',      chemin: 'journaux',                           motif: /relatif/i },
  { nom: 'git',          chemin: 'C:\\Projets\\.git',                  motif: /[Zz]one protegee/ },
  { nom: 'protege',      chemin: 'C:\\Windows',                        motif: /[Zz]one protegee/ },
  { nom: 'canonique',    chemin: 'C:\\Kjemo\\..\\..\\..',              motif: /[Rr]acine de volume/ },
  // LES SIX CAS QUE LA REVUE FINALE A RELEVES : le gardien ne comparait que
  // le DERNIER segment, donc un sous-dossier suffisait a le contourner.
  { nom: 'gitSous',      chemin: 'C:\\Projet\\.git\\journaux',          motif: /[Zz]one protegee/ },
  { nom: 'envSous',      chemin: 'C:\\Projet\\.env\\logs',              motif: /[Zz]one protegee/ },
  { nom: 'sshSous',      chemin: 'C:\\Projet\\.ssh\\rapports',          motif: /[Zz]one protegee/ },
  { nom: 'gitCasse',     chemin: 'C:\\Projet\\.GIT\\journaux',          motif: /[Zz]one protegee/ },
  { nom: 'systemRoot',   chemin: 'C:\\Windows\\Temp\\Kjemo',            motif: /SystemRoot/ },
  { nom: 'programFiles', chemin: 'C:\\Program Files\\Kjemo',           motif: /ProgramFiles/ },
  { nom: 'programData',  chemin: 'C:\\ProgramData\\Kjemo',             motif: /ProgramData/ },
  { nom: 'boot',         chemin: 'C:\\Boot\\Kjemo',                    motif: /Boot/ },
  { nom: 'recovery',     chemin: 'C:\\Recovery\\Kjemo',                motif: /Recovery/ },
  { nom: 'svi',          chemin: 'C:\\Projet\\System Volume Information\\x', motif: /[Zz]one protegee/ },
  { nom: 'profils',      chemin: 'C:\\Users',                          motif: /profils utilisateur/ },
  { nom: 'profilComplet',chemin: 'C:\\Users\\banc',                    motif: /profil utilisateur complet/ },
  // Canonisation qui ABOUTIT dans une zone protegee, par « .. ».
  { nom: 'canonProtege', chemin: 'C:\\Kjemo\\..\\Windows\\Temp\\Journaux', motif: /SystemRoot/ },
];

// Les chemins qui doivent rester ACCEPTES : un gardien qui refuse tout ne
// protege rien non plus, il rend l'outil inutilisable.
const CHEMINS_JOURNAL_ACCEPTES = [
  { nom: 'positif',        chemin: 'C:\\Kjemo\\Journaux' },
  { nom: 'autreDisque',    chemin: 'D:\\Windows\\Kjemo' },
  { nom: 'prefixeCommun',  chemin: 'C:\\WindowsAutre\\Kjemo' },
  { nom: 'sousProfil',     chemin: 'C:\\Users\\banc\\Journaux' },
];

{
  // J1 — windows-service-control. Deux voies de refus, et on dit laquelle.
  //
  // Certains de ces chemins sont refusés par la VALIDATION du formulaire : le
  // script n'est alors même pas produit, et il n'y a rien à écrire. Pour
  // éprouver le GARDIEN DU SCRIPT sur ces formes-là, on génère un script avec
  // un chemin valide puis on falsifie la variable $Journal — exactement ce que
  // ferait un chemin qui aurait franchi le formulaire.
  for (const cas of CHEMINS_JOURNAL_REFUSES) {
    const parFormulaire = jouerSvc(`journal-form-${cas.nom}`, {
      mode: 'Appliquer', confirmation: PHRASE_SVC, journalChemin: cas.chemin,
    });
    const refuseParFormulaire = Boolean(parFormulaire.refus);
    if (refuseParFormulaire) {
      assert(true, `svc / ${cas.nom} : refusé par la validation du formulaire, aucun script produit`);
    } else {
      const avant = failed;
      assert(ecrituresJournal(parFormulaire.appels) === 0,
        `svc / ${cas.nom} : ZÉRO New-Item, Set-Content et Add-Content (${ecrituresJournal(parFormulaire.appels)})`,
        parFormulaire.appels.join(', ') || '(vide)');
      assert(actionsSvc(parFormulaire.appels) === 0,
        `svc / ${cas.nom} : ZÉRO action modifiante (${actionsSvc(parFormulaire.appels)})`,
        parFormulaire.appels.join(', ') || '(vide)');
      assert(cas.motif.test(parFormulaire.sortie) || /gardien|journal/i.test(parFormulaire.sortie),
        `svc / ${cas.nom} : le script nomme la cause du refus`);
      if (failed > avant) diagnostic(`svc journal ${cas.nom}`, parFormulaire.resultat);
    }

    // Et le gardien du SCRIPT, éprouvé directement, pour les six formes.
    const falsifie = jouerSvc(`journal-garde-${cas.nom}`, {
      mode: 'Appliquer', confirmation: PHRASE_SVC,
      abimer: [{
        de: "$Journal = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('QzpcS2plbW9cSm91cm5hdXg='))",
        vers: `$Journal = ${psLitteral(cas.chemin)}`,
      }],
    });
    const avant2 = failed;
    assert(!falsifie.refus, `svc / ${cas.nom} : la falsification de $Journal a eu lieu${falsifie.refus ? ' — ' + falsifie.refus : ''}`);
    if (!falsifie.refus) {
      assert(ecrituresJournal(falsifie.appels) === 0,
        `svc / ${cas.nom} (gardien du script) : ZÉRO écriture de journal (${ecrituresJournal(falsifie.appels)})`,
        falsifie.appels.join(', ') || '(vide)');
      assert(actionsSvc(falsifie.appels) === 0,
        `svc / ${cas.nom} (gardien du script) : ZÉRO action modifiante (${actionsSvc(falsifie.appels)})`,
        falsifie.appels.join(', ') || '(vide)');
      if (failed > avant2) diagnostic(`svc gardien ${cas.nom}`, falsifie.resultat);
    }
  }

  // Et le contrôle positif : un chemin accepté écrit bien son journal, sinon
  // les six zéros ci-dessus ne prouveraient rien.
  const sain = jouerSvc('journal-sain', {
    mode: 'Appliquer', confirmation: PHRASE_SVC, journalChemin: 'C:\\Kjemo\\Journaux',
  });
  const avant3 = failed;
  assert(!sain.refus, `svc / chemin sain : le script se génère${sain.refus ? ' — ' + sain.refus : ''}`);
  if (!sain.refus) {
    assert(ecrituresJournal(sain.appels) > 0,
      `svc / chemin sain : le journal est bien écrit (${ecrituresJournal(sain.appels)} écriture(s))`,
      sain.appels.join(', ') || '(vide)');
    assert(actionsSvc(sain.appels) === 1,
      `svc / chemin sain : l’action a bien lieu (${actionsSvc(sain.appels)})`);
    if (failed > avant3) diagnostic('svc journal sain', sain.resultat);
  }
}
{
  // J2 — temp-cleanup, les mêmes six formes.
  for (const cas of CHEMINS_JOURNAL_REFUSES) {
    const parFormulaire = jouerTc(`journal-form-${cas.nom}`, {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30, journalChemin: cas.chemin,
    });
    if (parFormulaire.refus) {
      assert(true, `tc / ${cas.nom} : refusé par la validation du formulaire, aucun script produit`);
    } else {
      const avant = failed;
      assert(ecrituresJournal(parFormulaire.appels) === 0,
        `tc / ${cas.nom} : ZÉRO New-Item, Set-Content et Add-Content (${ecrituresJournal(parFormulaire.appels)})`,
        parFormulaire.appels.join(', ') || '(vide)');
      assert(suppressions(parFormulaire.appels) === 0,
        `tc / ${cas.nom} : ZÉRO suppression (${suppressions(parFormulaire.appels)})`,
        parFormulaire.appels.join(', ') || '(vide)');
      if (failed > avant) diagnostic(`tc journal ${cas.nom}`, parFormulaire.resultat);
    }

    const falsifie = jouerTc(`journal-garde-${cas.nom}`, {
      mode: 'Appliquer', confirmation: PHRASE_TC, age: 30,
      abimer: [{
        de: "$Journal = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('QzpcS2plbW9cSm91cm5hdXg='))",
        vers: `$Journal = ${psLitteral(cas.chemin)}`,
      }],
    });
    const avant2 = failed;
    assert(!falsifie.refus, `tc / ${cas.nom} : la falsification de $Journal a eu lieu${falsifie.refus ? ' — ' + falsifie.refus : ''}`);
    if (!falsifie.refus) {
      assert(ecrituresJournal(falsifie.appels) === 0,
        `tc / ${cas.nom} (gardien du script) : ZÉRO écriture de journal (${ecrituresJournal(falsifie.appels)})`,
        falsifie.appels.join(', ') || '(vide)');
      assert(suppressions(falsifie.appels) === 0,
        `tc / ${cas.nom} (gardien du script) : ZÉRO suppression (${suppressions(falsifie.appels)})`,
        falsifie.appels.join(', ') || '(vide)');
      if (failed > avant2) diagnostic(`tc gardien ${cas.nom}`, falsifie.resultat);
    }
  }
}
{
  // J3 — CONTRE-ÉPREUVE : on REMET l'ancien ordre.
  //
  // Le gardien ne conditionne plus le bloc d'écriture : il redevient un test
  // appliqué après coup. Le banc DOIT alors voir l'écriture interdite — sinon
  // les quatre zéros ci-dessus ne mesureraient rien.
  const ancienOrdre = { de: 'if (-not $journalCheminSur) {', vers: 'if ($false) {' };

  for (const [etiquette, jouer, compterActions] of [
    ['windows-service-control', jouerSvc, actionsSvc],
    ['temp-cleanup', jouerTc, suppressions],
  ]) {
    const commun = etiquette === 'temp-cleanup'
      ? { mode: 'Appliquer', confirmation: PHRASE_TC, age: 30 }
      : { mode: 'Appliquer', confirmation: PHRASE_SVC };
    const b = jouer(`journal-ancienOrdre`, {
      ...commun,
      abimer: [
        {
          de: "$Journal = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('QzpcS2plbW9cSm91cm5hdXg='))",
          vers: "$Journal = 'C:\\Windows'",
        },
        ancienOrdre,
      ],
    });
    const avant = failed;
    assert(!b.refus, `contre-épreuve ${etiquette} : les substitutions ont eu lieu${b.refus ? ' — ' + b.refus : ''}`);
    if (!b.refus) {
      assert(ecrituresJournal(b.appels) > 0,
        `contre-épreuve ${etiquette} — avec l’ancien ordre, le journal EST écrit à un chemin refusé (${ecrituresJournal(b.appels)})`,
        b.appels.join(', ') || '(vide)');
      if (failed > avant) diagnostic(`contre-épreuve ancien ordre ${etiquette}`, b.resultat);
    }
  }
}

// ===========================================================================
// K. Le gardien de chemin — TOUS les segments, et les vraies racines systeme
// ===========================================================================
//
// LE DÉFAUT RELEVÉ PAR LA REVUE FINALE.
//
// Test-KjemoCheminSur ne comparait que le dernier segment du chemin canonique :
//
//     $nom = $feuilles[$feuilles.Count - 1]
//     if ($nom -eq $protege) { ... }
//
// Il refusait donc « C:\Projet\.git » et acceptait « C:\Projet\.git\journaux ».
// Un gardien qu'on contourne en ajoutant un sous-dossier ne garde rien.
//
// Et il comparait des NOMS : tout dossier appelé « Windows », sur n'importe
// quel disque, était refusé, alors que le vrai SystemRoot pouvait s'appeler
// autrement. Deux erreurs opposées dans la même ligne.
//
// Ce banc éprouve la correction à l'EXÉCUTION, sur les six assistants qui
// incorporent le gardien, avec des valeurs d'environnement Windows réelles
// (SystemRoot = C:\Windows, ProgramFiles, ProgramData, USERPROFILE…).
// ===========================================================================
section('Gardien de chemin — tous les segments, et les racines systeme reelles');

{
  // K1 — LE GARDIEN LUI-MÊME, isolé, sur 26 chemins.
  //
  // On extrait le bloc du produit et on l'exécute seul : c'est le seul moyen
  // d'éprouver les deux sens — refus ET acceptation — sans dépendre de ce que
  // chaque assistant fait ensuite du chemin.
  const gardien = avecCheminsWindows(blocGardienChemin());
  const cas = [
    ...CHEMINS_JOURNAL_REFUSES.map((c) => ({ ...c, attendu: false })),
    ...CHEMINS_JOURNAL_ACCEPTES.map((c) => ({ ...c, attendu: true, motif: null })),
  ];
  const lignes = cas.map((c) =>
    `  ,@(${psLitteral(c.chemin)}, ${c.attendu ? '$true' : '$false'}, ${psLitteral(c.nom)})`).join('\n');

  const script = entete(join(travail, 'gardien.txt')) + decorWindows() + `
$global:KjemoLignes = @()
function Add-KjemoResultat {
  [CmdletBinding()] param($Categorie, $Controle, $Etat, $Valeur, $Commentaire)
  $global:KjemoLignes += ([string]$Etat + ' | ' + [string]$Commentaire)
  return $null
}
${gardien}

$cas = @(
${lignes}
)
foreach ($c in $cas) {
  $global:KjemoLignes = @()
  $r = Test-KjemoCheminSur -Chemin ([string]$c[0]) -Role 'essai'
  $motif = ($global:KjemoLignes | Where-Object { $_ -like 'PROBLEME*' } | Select-Object -First 1)
  Write-KjemoAppel ('GARDIEN ' + [string]$c[2] + ' ' + (& { if ($r) { 'ACCEPTE' } else { 'REFUSE' } }) + ' :: ' + [string]$motif)
}
`;
  const banc = ecrirePs1(join(travail, 'banc-gardien.ps1'), script);
  const resultat = executerBanc(banc);
  const appels = appelsDe(join(travail, 'gardien.txt'));
  const avant = failed;

  for (const c of cas) {
    const ligne = appels.find((a) => a.startsWith(`GARDIEN ${c.nom} `));
    assert(Boolean(ligne), `gardien / ${c.nom} : le cas a bien été joué`);
    if (!ligne) continue;
    const accepte = ligne.includes(' ACCEPTE ');
    assert(accepte === c.attendu,
      `gardien / ${c.nom} (${c.chemin}) : ${c.attendu ? 'ACCEPTÉ' : 'REFUSÉ'} comme attendu`,
      ligne);
    // Le message doit NOMMER la zone protégée détectée.
    if (!c.attendu && c.motif) {
      assert(c.motif.test(ligne),
        `gardien / ${c.nom} : le message nomme la zone détectée (${c.motif})`, ligne);
    }
  }
  if (failed > avant) diagnostic('gardien de chemin', resultat);
}
{
  // K2 — LES SIX ASSISTANTS qui incorporent le gardien l'incorporent VRAIMENT,
  // et chacun le NOMME pour son propre usage.
  for (const id of ['windows-update-repair', 'application-wont-start', 'windows-service-control',
    'defender-scan', 'dism-repair', 'temp-cleanup']) {
    const outil = outilOuEchec(id);
    const v = valeursDe(outil, {});
    const script = outil.generate(v);
    assert(/function Test-KjemoCheminSur \{/.test(script),
      `${id} : incorpore le gardien de chemin`);
    assert(/\$global:KjemoSegmentsProteges/.test(script),
      `${id} : porte la liste des segments sensibles`);
    assert(/function Get-KjemoRacinesProtegees \{/.test(script),
      `${id} : lit les racines systeme dans les variables Windows`);
    // Et la logique fautive a disparu : plus de comparaison du seul dernier
    // segment.
    assert(!/\$nom = \$feuilles\[\$feuilles\.Count - 1\]/.test(script),
      `${id} : la comparaison du seul dernier segment a disparu`);
    assert(!/'Windows', 'Program Files'/.test(script),
      `${id} : la liste de NOMS de dossiers systeme a disparu`);
  }
}
{
  // K3 — LECTURE SEULE : une décision, et sa preuve.
  //
  // Trois des six assistants ne font que LIRE le chemin : l'exécutable à
  // diagnostiquer, le dossier à analyser, la source DISM. Or un exécutable vit
  // dans « Program Files », une analyse antivirus porte souvent sur
  // « ProgramData », et une source DISM est un dossier de Windows. Refuser ces
  // chemins ne protégerait rien — aucun des trois n'y écrit — et rendrait les
  // trois assistants inutilisables pour leur cas le plus courant.
  //
  // Ils passent donc -LectureSeule, qui lève UNIQUEMENT la règle des racines
  // systeme. Ce bloc le prouve dans les deux sens : la levée existe, et elle
  // ne lève rien d'autre.
  const lectureSeule = [
    ['application-wont-start', 'appChemin'],
    ['defender-scan', 'dsChemin'],
    ['dism-repair', 'dsmSource'],
  ];
  for (const [id, champ] of lectureSeule) {
    const outil = outilOuEchec(id);
    const script = outil.generate(valeursDe(outil, {}));
    const appel = script.split('\n').find((l) =>
      /Test-KjemoCheminSur/.test(l) && !/^\s*#/.test(l) && !/function /.test(l));
    assert(Boolean(appel) && /-LectureSeule/.test(appel),
      `${id} : le chemin ${champ} passe -LectureSeule, parce qu’il est LU et jamais écrit`, appel || '(aucun appel)');
    // Et il n'écrit effectivement rien à ce chemin : aucune cmdlet d'écriture
    // n'est appliquée à la variable du chemin.
    for (const interdit of ['Remove-Item', 'Set-Content', 'Add-Content', 'New-Item']) {
      const ecritures = codeNu(script).filter((l) =>
        new RegExp(`${interdit}[^\\n]*\\$Chemin\\b`).test(l)
        || new RegExp(`${interdit}[^\\n]*\\$Source\\b`).test(l));
      assert(ecritures.length === 0,
        `${id} : aucun ${interdit} sur le chemin inspecté`, ecritures.join(' | '));
    }
  }
  // Et les trois assistants qui ÉCRIVENT ne passent jamais ce commutateur.
  for (const [id, variable] of [['windows-update-repair', '$DossierJournal'],
    ['windows-service-control', '$Journal'], ['temp-cleanup', '$Journal']]) {
    const outil = outilOuEchec(id);
    const script = outil.generate(valeursDe(outil, {}));
    const appels = script.split('\n').filter((l) =>
      l.includes('Test-KjemoCheminSur') && l.includes(variable));
    assert(appels.length > 0, `${id} : le chemin d’écriture passe par le gardien`);
    for (const a of appels) {
      assert(!/-LectureSeule/.test(a),
        `${id} : le chemin d’ÉCRITURE ne passe PAS -LectureSeule`, a.trim());
    }
  }
  // La levée « emplacement interne » ne sert qu'aux deux entrées systeme de la
  // liste blanche de temp-cleanup, et à rien d'autre dans tout le catalogue.
  // Un APPEL, pas une mention : le commutateur est documente dans le
  // commentaire du gardien PARTAGE, donc son nom apparait dans les six
  // scripts. Ce qui doit etre unique, c'est l'invocation.
  const porteursInterne = [];
  for (const outil of tools) {
    const script = outil.generate(valeursDe(outil, {}));
    const invocations = codeNu(script).filter((l) =>
      /Test-KjemoCheminSur[^\n]*-RacineSystemeAutorisee/.test(l));
    if (invocations.length > 0) porteursInterne.push(outil.id);
  }
  assert(porteursInterne.length === 1 && porteursInterne[0] === 'temp-cleanup',
    `-RacineSystemeAutorisee n’est INVOQUÉ que par temp-cleanup (${porteursInterne.join(', ') || 'aucun'})`);
  // Et une seule fois : pour les entrées systeme de la liste blanche.
  const tc = outilOuEchec('temp-cleanup');
  const invocTc = codeNu(tc.generate(valeursDe(tc, {})))
    .filter((l) => /Test-KjemoCheminSur[^\n]*-RacineSystemeAutorisee/.test(l));
  assert(invocTc.length === 1,
    `temp-cleanup : une seule invocation avec -RacineSystemeAutorisee (${invocTc.length})`,
    invocTc.join(' | '));
}
{
  // K4 — CONTRE-ÉPREUVE : on REMET la comparaison du seul dernier segment.
  //
  // Le banc doit alors voir « C:\Projet\.git\journaux » accepté — c'est-à-dire
  // le défaut exact que la revue a relevé. Sans cette contre-épreuve, les
  // assertions ci-dessus pourraient passer sur un gardien qui ne mesure rien.
  const gardienFautif = avecCheminsWindows(blocGardienChemin())
    .split("  $segments = @($canon.Split('\\') | Where-Object { $_ -ne '' })")
    .join("  $segments = @(@($canon.Split('\\') | Where-Object { $_ -ne '' })[-1])")
    .split('  foreach ($r in (Get-KjemoRacinesProtegees)) {')
    .join('  foreach ($r in @()) {');

  const script = entete(join(travail, 'gardien-fautif.txt')) + decorWindows() + `
$global:KjemoLignes = @()
function Add-KjemoResultat {
  [CmdletBinding()] param($Categorie, $Controle, $Etat, $Valeur, $Commentaire)
  $global:KjemoLignes += ([string]$Etat + ' | ' + [string]$Commentaire)
  return $null
}
${gardienFautif}
foreach ($c in @(${psLitteral('C:\\Projet\\.git\\journaux')}, ${psLitteral('C:\\Windows\\Temp\\Kjemo')}, ${psLitteral('C:\\Projet\\.git')})) {
  $r = Test-KjemoCheminSur -Chemin $c -Role 'essai'
  Write-KjemoAppel ('FAUTIF ' + $c + ' ' + (& { if ($r) { 'ACCEPTE' } else { 'REFUSE' } }))
}
`;
  const banc = ecrirePs1(join(travail, 'banc-gardien-fautif.ps1'), script);
  const resultat = executerBanc(banc);
  const appels = appelsDe(join(travail, 'gardien-fautif.txt'));
  const avant = failed;

  const lu = (chemin) => appels.find((a) => a.startsWith(`FAUTIF ${chemin} `)) || '';
  assert(lu('C:\\Projet\\.git\\journaux').includes('ACCEPTE'),
    'contre-épreuve — avec l’ancienne logique, « C:\\Projet\\.git\\journaux » EST accepté à tort',
    lu('C:\\Projet\\.git\\journaux') || '(non joué)');
  assert(lu('C:\\Windows\\Temp\\Kjemo').includes('ACCEPTE'),
    'contre-épreuve — avec l’ancienne logique, « C:\\Windows\\Temp\\Kjemo » EST accepté à tort',
    lu('C:\\Windows\\Temp\\Kjemo') || '(non joué)');
  assert(lu('C:\\Projet\\.git').includes('REFUSE'),
    'contre-épreuve — l’ancienne logique refusait bien le dernier segment, et c’est tout ce qu’elle faisait',
    lu('C:\\Projet\\.git') || '(non joué)');
  if (failed > avant) diagnostic('gardien fautif', resultat);
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

if (!process.env.KJEMO_GARDER_BANCS) { rmSync(travail, { recursive: true, force: true }); } else { console.log(`\nBancs conserves dans ${travail}`); }

console.log('');
console.log(`Contre-épreuves des verrous du LOT 6 — ${pwsh} (PowerShell ${versionPs}) : ${passed} OK, ${failed} ÉCHEC(S).`);
if (majeurPs === 5) console.log('Moteur éprouvé : Windows PowerShell 5.1, cible de référence du projet.');
else if (majeurPs >= 7) console.log('Moteur éprouvé : PowerShell 7. La cible 5.1 demande une exécution distincte.');
if (failed > 0) process.exit(1);
