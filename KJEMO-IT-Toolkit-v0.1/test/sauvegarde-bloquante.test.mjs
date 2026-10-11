/**
 * sauvegarde-bloquante.test.mjs — contre-épreuve d'exécution
 * ----------------------------------------------------------
 * ad-home-profile-paths sauvegarde les anciennes valeurs avant d'écrire quoi
 * que ce soit. La question n'est pas de savoir si le script CONTIENT un
 * try/catch : c'est de savoir si, la sauvegarde ayant échoué, il s'abstient
 * réellement d'écrire.
 *
 * Une recherche de motif dans le texte du script ne répond pas à cette
 * question. Ce test l'exécute donc pour de vrai, sous PowerShell, dans une
 * session où les cmdlets dangereuses sont remplacées par des mouchards :
 *
 *   New-Item, Set-Acl, Set-ADUser  →  inscrivent leur nom dans un journal.
 *   Export-Csv                      →  réussit, ou lève, selon la passe.
 *
 * Deux passes, et les deux comptent :
 *
 *   PASSE A — sauvegarde qui ÉCHOUE   : le journal doit rester VIDE.
 *   PASSE B — sauvegarde qui RÉUSSIT  : le journal doit contenir des appels.
 *
 * La passe B est le contrôle positif, et elle n'est pas facultative : sans
 * elle, un journal vide en passe A ne prouverait rien — il pourrait signifier
 * que les mouchards ne se déclenchent jamais, ou que le script s'est arrêté
 * bien avant, pour une tout autre raison.
 *
 * Une troisième passe, C, réintroduit volontairement le défaut corrigé et
 * exige que la passe A le détecte : un test incapable d'échouer ne prouve rien.
 *
 * INTERPRÉTEUR
 * ------------
 * Les scripts de ce projet visent Windows PowerShell 5.1 en premier, et
 * PowerShell 7 ensuite. Les deux moteurs diffèrent — liaison de paramètres,
 * encodage, résolution de commandes — et « ça passe sous l'un » ne dit rien de
 * l'autre. Le moteur se choisit donc explicitement :
 *
 *   node test/sauvegarde-bloquante.test.mjs --powershell powershell
 *   node test/sauvegarde-bloquante.test.mjs --powershell pwsh
 *
 * Si l'interpréteur demandé est absent, le test ÉCHOUE. Il ne se rabat jamais
 * en silence sur l'autre moteur : un résultat obtenu sous PowerShell 7 ne peut
 * pas être présenté comme un résultat PowerShell 5.1.
 *
 * Sans l'option, le test cherche un interpréteur et annonce lequel il a
 * retenu — commodité de développement, jamais une preuve de couverture. La CI
 * passe toujours l'option.
 */

import { execFileSync } from 'node:child_process';
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
// Quel interpréteur ? La question se tranche avant tout le reste.
// ---------------------------------------------------------------------------

/** Lit --powershell <exe>, ou --powershell=<exe>. */
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

/** Interroge l'interpréteur : sa version, ou null s'il n'existe pas. */
function versionDe(exe) {
  try {
    return execFileSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).trim();
  } catch {
    return null;
  }
}

const demande = interpreteurDemande(process.argv.slice(2));
let pwsh = null;
let versionPs = null;

if (demande) {
  // Mode explicite : c'est celui-là, ou rien. Aucun repli.
  versionPs = versionDe(demande);
  if (!versionPs) {
    console.error('');
    console.error(`ÉCHEC — l'interpréteur demandé « ${demande} » est introuvable ou ne répond pas.`);
    console.error('Le test ne se rabat pas sur un autre moteur : un résultat obtenu ailleurs');
    console.error('ne prouverait rien sur celui-ci.');
    process.exit(1);
  }
  console.log(`Interpréteur demandé : ${demande} — PowerShell ${versionPs}`);
} else {
  // Mode commodité : on cherche, et on DIT ce qu'on a trouvé.
  for (const candidat of ['pwsh', 'powershell']) {
    const v = versionDe(candidat);
    if (v) { pwsh = candidat; versionPs = v; break; }
  }
  if (!pwsh) {
    console.log('');
    console.log('Aucun interpréteur PowerShell disponible : contre-épreuve NON EXÉCUTÉE.');
    console.log('Ce test ne peut pas être déclaré réussi sans exécution réelle.');
    process.exit(2);
  }
  console.log(`Aucun --powershell fourni ; interpréteur retenu automatiquement : ${pwsh} — PowerShell ${versionPs}.`);
  console.log('Ce mode sert au développement. Il ne prouve la couverture d\u2019AUCUN autre moteur :');
  console.log('en intégration continue, passe --powershell powershell puis --powershell pwsh.');
}
if (demande) pwsh = demande;

/** Majeur de version, pour les messages. 5 ou 7. */
const majeurPs = Number(String(versionPs).split('.')[0]) || 0;

// ---------------------------------------------------------------------------
// Le script à éprouver, en mode Appliquer
// ---------------------------------------------------------------------------
const outil = tools.find((t) => t.id === 'ad-home-profile-paths');
if (!outil) {
  console.log('\nOutil ad-home-profile-paths absent du catalogue.');
  process.exit(1);
}
const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
valeurs.mode = 'Appliquer';
const script = outil.generate(valeurs);

const travail = mkdtempSync(join(tmpdir(), 'kjemo-sauvegarde-'));

/**
 * Tout fichier .ps1 écrit ici porte le BOM UTF-8, comme ceux que produit
 * test/generate-ps1.mjs. Sans lui, Windows PowerShell 5.1 lit le fichier en
 * CP1252 : un tiret cadratin devient un guillemet fermant, et le script cesse
 * d'être analysable. Le test mesurerait alors l'encodage, pas la sauvegarde.
 */
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
function ecrirePs1(chemin, contenu) {
  writeFileSync(chemin, Buffer.concat([BOM, Buffer.from(contenu, 'utf8')]));
  return chemin;
}

const cheminScript = ecrirePs1(join(travail, 'ad-home-profile-paths.ps1'), script);

/**
 * Le banc d'essai. Les fonctions définies ici masquent les cmdlets du même nom :
 * en PowerShell, une fonction l'emporte sur une applet de commande dans la
 * résolution de nom. Le script dot-sourcé s'exécute donc sans toucher à rien.
 */
function banc({ journal, exportEchoue }) {
  // Le banc est volontairement en ASCII pur. Il porte un BOM UTF-8 comme tout
  // .ps1 de ce projet, mais un banc sans caractere accentue ne peut pas, lui,
  // faire echouer la contre-epreuve pour une raison d'encodage : ce qui est
  // mesure reste la sauvegarde, jamais la facon dont l'hote lit un fichier.
  return `
$ErrorActionPreference = 'Continue'
$global:KjemoJournal = ${JSON.stringify(journal)}
if (Test-Path -LiteralPath $global:KjemoJournal) { Remove-Item -LiteralPath $global:KjemoJournal }

function Write-KjemoAppel { param([string]$Nom)
  Add-Content -LiteralPath $global:KjemoJournal -Value $Nom
}

# --- Mouchards : toute ecriture reelle est interceptee et consignee ---------
function New-Item        { Write-KjemoAppel 'New-Item' ;  return $null }
function Set-Acl         { Write-KjemoAppel 'Set-Acl' ;   return $null }
function Set-ADUser      { Write-KjemoAppel 'Set-ADUser' ; return $null }

# --- Sauvegarde : c'est ici que se joue la contre-epreuve -------------------
function Export-Csv {
  [CmdletBinding()] param(
    [Parameter(ValueFromPipeline=$true)]$InputObject,
    [string]$LiteralPath, [string]$Path,
    [switch]$NoTypeInformation, [string]$Encoding)
  process { }
  end {
    ${exportEchoue
      ? "throw 'ECHEC SIMULE DE LA SAUVEGARDE'"
      : "Write-KjemoAppel 'Export-Csv' ; return $null"}
  }
}

# --- Decor minimal : un domaine, une OU, deux comptes non conformes ---------
# Le script est ecrit pour Windows ; ce banc tourne sous Linux. Join-Path y
# refuse les chemins UNC, et $env:USERPROFILE n'existe pas. On rend donc a ces
# deux elements leur semantique Windows, sans rien changer au script lui-meme :
# sans cela, le test mesurerait une particularite de l'hote, pas le script.
$env:USERPROFILE = 'C:\\Users\\banc'
function Join-Path {
  [CmdletBinding()] param([Parameter(Position=0)]$Path, [Parameter(Position=1)]$ChildPath)
  if (-not $Path) { return [string]$ChildPath }
  # -replace plutot que TrimEnd(char[]) : la conversion d'une liste de chaines
  # d'un caractere vers char[] ne se fait pas de la meme facon en 5.1 et en 7.
  return ((([string]$Path) -replace '[\\/]+$', '') + '\\' + [string]$ChildPath)
}
function Import-Module   { return $null }
function Get-ADDomain    {
  return [pscustomobject]@{ DNSRoot = 'hopitalbn.lan'; DistinguishedName = 'DC=hopitalbn,DC=lan' }
}
function Get-ADOrganizationalUnit {
  return [pscustomobject]@{ DistinguishedName = 'OU=Medecin,DC=hopitalbn,DC=lan' }
}
# Note : ces doublures portent [CmdletBinding()] et ne declarent PAS
# -ErrorAction. C'est un parametre commun, fourni d'office aux fonctions
# avancees ; le redeclarer ferait echouer la liaison, et le script prendrait
# l'echec pour un resultat.
function Get-ADUser {
  [CmdletBinding()] param([string]$SearchBase, $Filter, $Identity, $Properties)
  return @(
    [pscustomobject]@{ SamAccountName='m.tremblay'; DistinguishedName='CN=m.tremblay,OU=Medecin,DC=hopitalbn,DC=lan'
                       HomeDirectory=$null; HomeDrive=$null; ProfilePath=$null },
    [pscustomobject]@{ SamAccountName='a.gagnon';  DistinguishedName='CN=a.gagnon,OU=Medecin,DC=hopitalbn,DC=lan'
                       HomeDirectory='\\\\ancien\\Home\\a.gagnon'; HomeDrive='Z:'; ProfilePath=$null }
  )
}
# La racine du partage repond ; les dossiers personnels, non : le script doit
# donc vouloir les creer. C'est exactement le chemin qui nous interesse.
function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  $cible = $LiteralPath; if (-not $cible) { $cible = $Path }
  if ($cible -eq '\\\\srv-fichiers\\Personnels') { return $true }
  if ($cible -like '*Desktop*' -or $cible -like '*Bureau*') { return $true }
  return $false
}
function Get-SmbShareAccess { [CmdletBinding()] param($Name, $CimSession) return @() }
function Get-Acl {
  [CmdletBinding()] param($LiteralPath, $Path)
  $o = [pscustomobject]@{ Access = @() }
  $o | Add-Member -MemberType ScriptMethod -Name AddAccessRule -Value { param($r) } -Force
  return $o
}
function Get-CimInstance { [CmdletBinding()] param($ClassName, $Namespace) return $null }

. ${JSON.stringify(cheminScript)}
`;
}

// ---------------------------------------------------------------------------
// PASSE A — la sauvegarde échoue : rien ne doit être écrit
// ---------------------------------------------------------------------------
section('ad-home-profile-paths — PASSE A : la sauvegarde échoue');

const journalA = join(travail, 'journal-a.txt');
const bancA = join(travail, 'banc-a.ps1');
ecrirePs1(bancA, banc({ journal: journalA, exportEchoue: true }));

let sortieA = '';
try {
  sortieA = execFileSync(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bancA],
    { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  sortieA = String(e.stdout ?? '') + String(e.stderr ?? '');
}

const appelsA = existsSync(journalA)
  ? readFileSync(journalA, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  : [];

assert(!appelsA.includes('New-Item'),
  'sauvegarde en échec : New-Item n’est jamais appelé',
  `journal : ${appelsA.join(', ') || '(vide)'}`);
assert(!appelsA.includes('Set-Acl'),
  'sauvegarde en échec : Set-Acl n’est jamais appelé',
  `journal : ${appelsA.join(', ') || '(vide)'}`);
assert(!appelsA.includes('Set-ADUser'),
  'sauvegarde en échec : Set-ADUser n’est jamais appelé',
  `journal : ${appelsA.join(', ') || '(vide)'}`);
assert(appelsA.length === 0,
  `sauvegarde en échec : aucune commande de modification, quelle qu’elle soit (${appelsA.length})`,
  appelsA.join(', '));
assert(/bloqu/i.test(sortieA) || /sauvegarde/i.test(sortieA),
  'sauvegarde en échec : le script le dit à l’écran plutôt que de se taire');

// ---------------------------------------------------------------------------
// PASSE B — contrôle positif : la sauvegarde réussit, les mouchards parlent
// ---------------------------------------------------------------------------
section('ad-home-profile-paths — PASSE B : contrôle positif, la sauvegarde réussit');

const journalB = join(travail, 'journal-b.txt');
const bancB = join(travail, 'banc-b.ps1');
ecrirePs1(bancB, banc({ journal: journalB, exportEchoue: false }));

let sortieB = '';
try {
  sortieB = execFileSync(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bancB],
    { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  sortieB = String(e.stdout ?? '') + String(e.stderr ?? '');
}

const appelsB = existsSync(journalB)
  ? readFileSync(journalB, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  : [];

assert(appelsB.includes('Export-Csv'),
  'contrôle positif : la sauvegarde a bien été tentée');
assert(appelsB.includes('Set-ADUser'),
  'contrôle positif : Set-ADUser EST appelé quand la sauvegarde réussit',
  `journal : ${appelsB.join(', ') || '(vide)'}`);
assert(appelsB.includes('New-Item'),
  'contrôle positif : New-Item EST appelé quand la sauvegarde réussit',
  `journal : ${appelsB.join(', ') || '(vide)'}`);

// La comparaison des deux passes est la conclusion du test : le SEUL
// changement entre elles est le sort de Export-Csv.
assert(appelsB.length > appelsA.length,
  `les deux passes diffèrent : ${appelsA.length} appel(s) sans sauvegarde, ${appelsB.length} avec`);

// ---------------------------------------------------------------------------
// PASSE C — le test se vérifie lui-même
//
// Un test qui ne peut pas échouer ne teste rien. On réintroduit donc
// volontairement le défaut corrigé — la garde $sauvegardeOk retirée du bloc
// Appliquer — et on exige que la passe A, rejouée sur ce script abîmé,
// DÉTECTE le problème. Si elle ne le détecte pas, c'est le test qui est faux.
// ---------------------------------------------------------------------------
section('ad-home-profile-paths — PASSE C : le test détecte-t-il le défaut réintroduit ?');

const GARDE = "if ($Mode -eq 'Appliquer' -and $moduleOk -and $sauvegardeOk) {";
assert(script.includes(GARDE),
  'le script porte bien la garde attendue sur le bloc Appliquer');

const scriptAbime = script.replace(GARDE, "if ($Mode -eq 'Appliquer' -and $moduleOk) {");
assert(scriptAbime !== script, 'le défaut a pu être réintroduit dans une copie du script');

const cheminAbime = join(travail, 'ad-home-profile-paths-abime.ps1');
ecrirePs1(cheminAbime, scriptAbime);

const journalC = join(travail, 'journal-c.txt');
const bancC = join(travail, 'banc-c.ps1');
ecrirePs1(bancC,
  banc({ journal: journalC, exportEchoue: true }).replace(
    JSON.stringify(cheminScript), JSON.stringify(cheminAbime)));

try {
  execFileSync(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bancC],
    { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch { /* la sauvegarde lève : c'est prévu */ }

const appelsC = existsSync(journalC)
  ? readFileSync(journalC, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  : [];

assert(appelsC.length > 0,
  `sans la garde, la sauvegarde en échec ne retient plus rien : ${appelsC.length} appel(s) de modification`,
  appelsC.join(', ') || '(vide)');
assert(appelsC.includes('Set-ADUser'),
  'sans la garde, Set-ADUser s’exécute malgré l’échec de la sauvegarde — c’est bien ce défaut que la garde corrige');

// ---------------------------------------------------------------------------
// PASSE D — le contrat de l'option --powershell
//
// La CI impose le moteur à chaque appel. Encore faut-il que l'option soit
// tenue : si le test acceptait silencieusement un autre interpréteur, la
// ligne « PowerShell 5.1 : 13 OK » du journal de CI serait un mensonge.
// On relance donc ce même fichier, dans un processus séparé, avec un
// interpréteur qui n'existe pas.
// ---------------------------------------------------------------------------
section('Contrat de l’option --powershell');

{
  const moiMeme = fileURLToPath(import.meta.url);
  const inexistant = 'kjemo-interpreteur-qui-nexiste-pas';
  let code = 0;
  let sortie = '';
  try {
    sortie = execFileSync(process.execPath, [moiMeme, '--powershell', inexistant],
      { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    code = e.status ?? 1;
    sortie = String(e.stdout ?? '') + String(e.stderr ?? '');
  }

  assert(code !== 0,
    `un interpréteur demandé mais absent fait échouer le test (code ${code})`);
  assert(/introuvable ou ne répond pas/.test(sortie),
    'le message nomme la cause : l’interpréteur demandé est introuvable');
  assert(/ne se rabat pas sur un autre moteur/.test(sortie),
    'le test annonce explicitement qu’il ne se rabat sur aucun autre moteur');
  assert(!/PASSE A/.test(sortie),
    'aucune passe n’est exécutée quand l’interpréteur demandé manque');
  assert(!/\d+ OK, \d+ ÉCHEC/.test(sortie),
    'aucun résultat n’est annoncé quand l’interpréteur demandé manque');
}

rmSync(travail, { recursive: true, force: true });

console.log('');
console.log(`Contre-épreuve de sauvegarde bloquante — ${pwsh} (PowerShell ${versionPs}) : ${passed} OK, ${failed} ÉCHEC(S).`);
if (majeurPs === 5) console.log('Moteur éprouvé : Windows PowerShell 5.1, cible de référence du projet.');
else if (majeurPs >= 7) console.log('Moteur éprouvé : PowerShell 7. La cible 5.1 demande une exécution distincte.');
if (failed > 0) process.exit(1);
