/**
 * route-passerelle-bloquante.test.mjs — contre-épreuve d'exécution
 * -----------------------------------------------------------------
 * `route-manager` calcule si la passerelle demandée appartient à un préfixe
 * directement connecté à la carte. La question n'est pas de savoir s'il le
 * CALCULE : c'est de savoir si, le calcul étant négatif, il s'abstient
 * réellement d'appeler `New-NetRoute`.
 *
 * Une recherche de motif dans le texte du script ne répond pas à cette
 * question. Ce test l'exécute donc pour de vrai, sous PowerShell, dans une
 * session où les cmdlets dangereuses sont remplacées par des mouchards :
 *
 *   New-NetRoute   →  inscrit son nom dans un journal. L'aperçu -WhatIf est
 *                     consigné à part : ce n'est pas une écriture.
 *   Export-Csv     →  réussit, ou lève, selon la passe.
 *   Test-Connection →  répond TOUJOURS que la passerelle répond à l'écho.
 *
 * Ce dernier point est délibéré. L'écho ICMP ne doit entrer dans aucune
 * décision : un routeur peut le refuser et router parfaitement. Le banc le
 * rend donc systématiquement positif. Si le script s'y fiait, la passe A
 * poserait la route.
 *
 * Deux choses sont éprouvées, et les deux comptent :
 *
 * 1. L'ARITHMÉTIQUE DE PRÉFIXE, sur des préfixes qui ne tombent pas sur une
 *    frontière d'octet — /1, /4, /9, /17, /23, /25, /30, /31, /32. C'est là
 *    qu'une comparaison octet par octet se trompe, et c'est là qu'un masque
 *    construit par décalage binaire signé déborde. Le /24, lui, réussit même
 *    quand le calcul est faux : il ne prouve rien tout seul.
 *
 * 2. LE BLOCAGE RÉEL :
 *      PASSE A — passerelle hors du sous-réseau  : ZÉRO appel.
 *      PASSE B — passerelle dans le sous-réseau  : EXACTEMENT un appel.
 *      PASSE C — sauvegarde de la table en échec : ZÉRO appel.
 *      PASSE D — carte absente                   : ZÉRO appel.
 *      PASSE E — verrou retiré                   : le test doit le voir.
 *
 * INTERPRÉTEUR
 * ------------
 *   node test/route-passerelle-bloquante.test.mjs --powershell powershell
 *   node test/route-passerelle-bloquante.test.mjs --powershell pwsh
 *
 * Si l'interpréteur demandé est absent, le test ÉCHOUE. Il ne se rabat jamais
 * en silence sur l'autre moteur.
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
  } catch {
    return null;
  }
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
  console.log(`Interpréteur demandé : ${demande} — PowerShell ${versionPs}`);
} else {
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

const majeurPs = Number(String(versionPs).split('.')[0]) || 0;

// ---------------------------------------------------------------------------
// Le script à éprouver, en mode Appliquer
// ---------------------------------------------------------------------------
const outil = tools.find((t) => t.id === 'route-manager');
if (!outil) {
  console.log('\nOutil route-manager absent du catalogue.');
  process.exit(1);
}
const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
valeurs.mode = 'Appliquer';
const script = outil.generate(valeurs);

const PASSERELLE = String(valeurs.rmPasserelle).trim();
const CARTE = String(valeurs.rmCarte).trim();

const travail = mkdtempSync(join(tmpdir(), 'kjemo-route-'));

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
function ecrirePs1(chemin, contenu) {
  writeFileSync(chemin, Buffer.concat([BOM, Buffer.from(contenu, 'utf8')]));
  return chemin;
}

const cheminScript = ecrirePs1(join(travail, 'route-manager.ps1'), script);

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

const MARQUEUR_EXECUTION = /=== route-manager -/;

function diagnostic(nomPasse, resultat) {
  console.log(`\n  ---- Diagnostic ${nomPasse} : ${pwsh} (PowerShell ${versionPs}), code ${resultat.code} ----`);
  if (resultat.erreurLancement) console.log(`  lancement : ${resultat.erreurLancement}`);
  const extrait = (t) => t.split(/\r?\n/).filter((l) => l.trim()).slice(-40).map((l) => `  | ${l}`).join('\n');
  console.log('  sortie d\u2019erreur :');
  console.log(extrait(resultat.stderr) || '  | (vide)');
  console.log('  sortie standard (40 dernières lignes) :');
  console.log(extrait(resultat.stdout) || '  | (vide)');
  console.log('  ---- fin du diagnostic ----\n');
}

/**
 * Le banc d'essai, en ASCII pur. Les fonctions définies ici masquent les
 * cmdlets du même nom. Les doublures portent [CmdletBinding()] et ne
 * déclarent PAS -ErrorAction : c'est un paramètre commun, et le redéclarer
 * ferait échouer la liaison.
 */
function banc({
  journal,
  adresseCarte = '192.168.30.10',
  prefixeCarte = 24,
  carteAbsente = false,
  sauvegardeEchoue = false,
  epreuvePrefixes = false,
  scriptSousTest = cheminScript,
}) {
  return `
$ErrorActionPreference = 'Continue'
$global:KjemoJournal = ${psLitteral(journal)}
if (Test-Path -LiteralPath $global:KjemoJournal) { Remove-Item -LiteralPath $global:KjemoJournal }

function Write-KjemoAppel { param([string]$Nom)
  Add-Content -LiteralPath $global:KjemoJournal -Value $Nom
}

# --- Mouchard principal ----------------------------------------------------
# L'apercu -WhatIf n'ecrit rien : il est consigne sous un autre nom, pour que
# le comptage des ECRITURES reelles ne le confonde pas avec une pose.
function New-NetRoute {
  [CmdletBinding()] param(
    [string]$DestinationPrefix, [string]$NextHop, $InterfaceIndex,
    $RouteMetric, [string]$PolicyStore, [switch]$WhatIf)
  if ($WhatIf) { Write-KjemoAppel 'New-NetRoute(-WhatIf)' ; return $null }
  Write-KjemoAppel 'New-NetRoute'
  return $null
}
function Remove-NetRoute {
  [CmdletBinding()] param([string]$DestinationPrefix, [string]$NextHop, $InterfaceIndex,
    [string]$PolicyStore, [switch]$Confirm)
  Write-KjemoAppel 'Remove-NetRoute'
  return $null
}

# --- La carte --------------------------------------------------------------
function Get-NetAdapter {
  [CmdletBinding()] param([string]$Name)
  ${carteAbsente
    ? 'return $null'
    : "return [pscustomobject]@{ Name = $Name; Status = 'Up'; ifIndex = 12 }"}
}
function Get-NetIPAddress {
  [CmdletBinding()] param([string]$AddressFamily)
  return @([pscustomobject]@{
    InterfaceAlias = ${psLitteral(CARTE)}
    IPAddress      = ${psLitteral(adresseCarte)}
    PrefixLength   = ${Number(prefixeCarte)}
  })
}

# --- Le leurre : l'echo repond TOUJOURS ------------------------------------
function Test-Connection {
  [CmdletBinding()] param([string]$ComputerName, [int]$Count)
  return @([pscustomobject]@{ Address = $ComputerName; Status = 'Success' })
}

# --- La table de routage ---------------------------------------------------
function Get-NetRoute {
  [CmdletBinding()] param([string]$DestinationPrefix)
  return @()
}

# --- La sauvegarde : c'est ici que se joue la passe C -----------------------
function Export-Csv {
  [CmdletBinding()] param(
    [Parameter(ValueFromPipeline=$true)]$InputObject,
    [string]$LiteralPath, [string]$Path,
    [switch]$NoTypeInformation, [string]$Encoding)
  process { }
  end {
    ${sauvegardeEchoue
      ? "throw 'ECHEC SIMULE DE LA SAUVEGARDE'"
      : "Write-KjemoAppel 'Export-Csv' ; return $null"}
  }
}
function Test-Path {
  [CmdletBinding()] param([Parameter(Position=0)][string]$LiteralPath, [string]$Path)
  ${sauvegardeEchoue ? 'return $false' : 'return $true'}
}

# --- Decor Windows minimal -------------------------------------------------
$env:TEMP = 'C:\\Windows\\Temp'
function Join-Path {
  [CmdletBinding()] param([Parameter(Position=0)]$Path, [Parameter(Position=1)]$ChildPath)
  if (-not $Path) { return [string]$ChildPath }
  return ((([string]$Path) -replace '[\\\\/]+$', '') + '\\' + [string]$ChildPath)
}
function Get-NetIPConfiguration { [CmdletBinding()] param() return @() }
function Get-CimInstance { [CmdletBinding()] param($ClassName, $Namespace) return $null }

. ${psLitteral(scriptSousTest)}
${epreuvePrefixes ? EPREUVE_PREFIXES : ''}
`;
}

/**
 * Le script définit Test-KjemoMemePrefixe. Dot-sourcé, il la laisse dans la
 * portée du banc : on peut donc l'interroger directement, cas par cas, au
 * lieu de deviner son comportement depuis la sortie du rapport.
 */
const CAS_PREFIXES = [
  // adresse de la carte, préfixe, passerelle, attendu, pourquoi
  ['10.0.0.5', 9, '10.127.255.254', true, '/9 — dernière adresse de la moitié basse'],
  ['10.0.0.5', 9, '10.128.0.1', false, '/9 — l’octet 10 est identique, le neuvième bit non'],
  ['172.16.5.5', 17, '172.16.127.254', true, '/17 — moitié basse du troisième octet'],
  ['172.16.5.5', 17, '172.16.128.1', false, '/17 — bascule au bit 17'],
  ['192.168.10.5', 23, '192.168.11.254', true, '/23 — deux /24 contigus'],
  ['192.168.10.5', 23, '192.168.12.1', false, '/23 — le /24 suivant est dehors'],
  ['192.168.1.130', 25, '192.168.1.129', true, '/25 — moitié haute'],
  ['192.168.1.130', 25, '192.168.1.126', false, '/25 — moitié basse, pourtant même /24'],
  ['10.1.1.5', 30, '10.1.1.6', true, '/30 — liaison point à point classique'],
  ['10.1.1.5', 30, '10.1.1.8', false, '/30 — le /30 suivant'],
  ['10.1.1.4', 31, '10.1.1.5', true, '/31 — RFC 3021, deux adresses'],
  ['10.1.1.4', 31, '10.1.1.6', false, '/31 — la paire suivante'],
  ['203.0.113.5', 32, '203.0.113.5', true, '/32 — une seule adresse'],
  ['203.0.113.5', 32, '203.0.113.6', false, '/32 — toute autre adresse est dehors'],
  // Le piège du bit de signe : avec des opérateurs 32 bits signés, un premier
  // octet au-dessus de 127 rend le masque négatif et la comparaison fausse.
  ['200.0.0.1', 1, '250.1.1.1', true, '/1 — premier bit à 1 des deux côtés'],
  ['200.0.0.1', 1, '10.0.0.1', false, '/1 — premier bit différent'],
  ['240.0.0.1', 4, '250.1.1.1', true, '/4 — même quartet de tête, au-delà de 127'],
  ['240.0.0.1', 4, '239.255.255.255', false, '/4 — quartet de tête différent'],
  // Contrôle négatif : le /24 réussit même quand le calcul est faux.
  ['192.168.30.10', 24, '192.168.30.254', true, '/24 — cas facile, ne prouve rien seul'],
  ['192.168.30.10', 24, '10.20.30.1', false, '/24 — autre réseau'],
];

const EPREUVE_PREFIXES = `
Write-Host '--- KJEMO EPREUVE PREFIXES ---'
${CAS_PREFIXES.map(([adr, pref, pas], i) =>
  `$r${i} = Test-KjemoMemePrefixe -Adresse ${psLitteral(adr)} -Autre ${psLitteral(pas)} -Prefixe ${pref}
Write-Host ('CAS ${i} = ' + [string][bool]$r${i})`).join('\n')}
Write-Host '--- KJEMO FIN PREFIXES ---'
`;

function appelsDe(journal) {
  return existsSync(journal)
    ? readFileSync(journal, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : [];
}

function jouer(nom, options) {
  const journal = join(travail, `journal-${nom}.txt`);
  const chemin = join(travail, `banc-${nom}.ps1`);
  ecrirePs1(chemin, banc({ ...options, journal }));
  const resultat = executerBanc(chemin);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

/** Les poses RÉELLES. L'aperçu -WhatIf n'en est pas une. */
function compterPoses(appels) {
  return appels.filter((a) => a === 'New-NetRoute').length;
}

// ---------------------------------------------------------------------------
// ÉPREUVE 1 — l'arithmétique de préfixe, exécutée, cas par cas
// ---------------------------------------------------------------------------
section('route-manager — arithmétique de préfixe (exécutée sous PowerShell)');

const P = jouer('prefixes', { epreuvePrefixes: true });
const echecsAvantP = failed;

assert(MARQUEUR_EXECUTION.test(P.resultat.stdout),
  'préfixes : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(/--- KJEMO EPREUVE PREFIXES ---/.test(P.resultat.stdout),
  'préfixes : la fonction Test-KjemoMemePrefixe est bien exposée par le script dot-sourcé');

const lus = new Map();
for (const ligne of P.resultat.stdout.split(/\r?\n/)) {
  const m = /^CAS (\d+) = (True|False)$/.exec(ligne.trim());
  if (m) lus.set(Number(m[1]), m[2] === 'True');
}
assert(lus.size === CAS_PREFIXES.length,
  `préfixes : les ${CAS_PREFIXES.length} cas ont tous été évalués (${lus.size})`);

let casJustes = 0;
CAS_PREFIXES.forEach(([adr, pref, pas, attendu, pourquoi], i) => {
  const obtenu = lus.get(i);
  const ok = obtenu === attendu;
  if (ok) casJustes += 1;
  assert(ok,
    `${pourquoi} : ${adr}/${pref} contient ${pas} ? ${attendu}`,
    ok ? '' : `obtenu : ${obtenu}`);
});
if (failed > echecsAvantP) diagnostic('préfixes', P.resultat);

// ---------------------------------------------------------------------------
// PASSE A — passerelle hors du sous-réseau : rien ne doit être posé
// ---------------------------------------------------------------------------
section('route-manager — PASSE A : la passerelle est hors du sous-réseau');

const A = jouer('a', { adresseCarte: '192.168.40.10', prefixeCarte: 24 });
const echecsAvantA = failed;

assert(MARQUEUR_EXECUTION.test(A.resultat.stdout),
  'passerelle dehors : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterPoses(A.appels) === 0,
  `passerelle dehors : New-NetRoute n’est JAMAIS appelé pour poser (${compterPoses(A.appels)})`,
  `journal : ${A.appels.join(', ') || '(vide)'}`);
assert(/BLOQU/i.test(A.sortie),
  'passerelle dehors : le script annonce le blocage à l’écran');
assert(A.sortie.includes(PASSERELLE),
  'passerelle dehors : le script nomme la passerelle en cause');
assert(/Correction attendue/i.test(A.sortie),
  'passerelle dehors : le script explique la correction attendue');
assert(A.sortie.includes('192.168.40.10/24'),
  'passerelle dehors : le script montre le préfixe réellement porté par la carte');
if (failed > echecsAvantA) diagnostic('passe A', A.resultat);

// ---------------------------------------------------------------------------
// PASSE B — contrôle positif : passerelle dans le sous-réseau
// ---------------------------------------------------------------------------
section('route-manager — PASSE B : contrôle positif, la passerelle est dans le sous-réseau');

const B = jouer('b', { adresseCarte: '192.168.30.10', prefixeCarte: 24 });
const echecsAvantB = failed;

assert(MARQUEUR_EXECUTION.test(B.resultat.stdout),
  'contrôle positif : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterPoses(B.appels) === 1,
  `contrôle positif : New-NetRoute pose la route EXACTEMENT une fois (${compterPoses(B.appels)})`,
  `journal : ${B.appels.join(', ') || '(vide)'}`);
assert(B.appels.includes('New-NetRoute(-WhatIf)'),
  'contrôle positif : l’aperçu -WhatIf a bien eu lieu, et il est compté à part');
assert(B.appels.includes('Export-Csv'),
  'contrôle positif : la table a bien été sauvegardée avant la pose');
assert(compterPoses(B.appels) > compterPoses(A.appels),
  `les deux passes diffèrent : ${compterPoses(A.appels)} pose(s) hors sous-réseau, ${compterPoses(B.appels)} dedans`);
if (failed > echecsAvantB) diagnostic('passe B', B.resultat);

// ---------------------------------------------------------------------------
// PASSE C — la sauvegarde échoue : rien ne doit être posé
// ---------------------------------------------------------------------------
section('route-manager — PASSE C : la sauvegarde de la table échoue');

const C = jouer('c', { sauvegardeEchoue: true });
const echecsAvantC = failed;

assert(MARQUEUR_EXECUTION.test(C.resultat.stdout),
  'sauvegarde en échec : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterPoses(C.appels) === 0,
  `sauvegarde en échec : New-NetRoute n’est JAMAIS appelé pour poser (${compterPoses(C.appels)})`,
  `journal : ${C.appels.join(', ') || '(vide)'}`);
assert(/sauvegarde de la table en echec/i.test(C.sortie),
  'sauvegarde en échec : le script dit que c’est la sauvegarde qui manque');
if (failed > echecsAvantC) diagnostic('passe C', C.resultat);

// ---------------------------------------------------------------------------
// PASSE D — la carte est absente : rien ne doit être posé
// ---------------------------------------------------------------------------
section('route-manager — PASSE D : la carte est introuvable');

const D = jouer('d', { carteAbsente: true });
const echecsAvantD = failed;

assert(MARQUEUR_EXECUTION.test(D.resultat.stdout),
  'carte absente : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterPoses(D.appels) === 0,
  `carte absente : New-NetRoute n’est JAMAIS appelé (${compterPoses(D.appels)})`,
  `journal : ${D.appels.join(', ') || '(vide)'}`);
assert(!D.appels.includes('New-NetRoute(-WhatIf)'),
  'carte absente : même l’aperçu -WhatIf n’est pas tenté, faute d’index d’interface');
assert(/carte introuvable/i.test(D.sortie),
  'carte absente : le script dit que c’est la carte qui manque');
if (failed > echecsAvantD) diagnostic('passe D', D.resultat);

// ---------------------------------------------------------------------------
// PASSE E — le test se vérifie lui-même
//
// On retire le verrou — le mode Appliquer écrit alors sans condition — et on
// exige que la passe A, rejouée sur ce script abîmé, DÉTECTE la pose
// interdite. Si elle ne la détecte pas, c'est le test qui est faux.
// ---------------------------------------------------------------------------
section('route-manager — PASSE E : le test détecte-t-il le verrou retiré ?');

const VERROU = "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {";
assert(script.includes(VERROU),
  'le script porte bien le verrou attendu sur le bloc Appliquer');

const scriptAbime = script.replace(VERROU, 'if ($false) {');
assert(scriptAbime !== script, 'le verrou a pu être retiré dans une copie du script');

const cheminAbime = ecrirePs1(join(travail, 'route-manager-abime.ps1'), scriptAbime);

const E = jouer('e', { adresseCarte: '192.168.40.10', prefixeCarte: 24, scriptSousTest: cheminAbime });
const echecsAvantE = failed;

assert(MARQUEUR_EXECUTION.test(E.resultat.stdout),
  'verrou retiré : le script abîmé s’est réellement exécuté jusqu’au rapport');
assert(compterPoses(E.appels) === 1,
  `sans le verrou, New-NetRoute pose la route malgré la passerelle hors sous-réseau (${compterPoses(E.appels)})`,
  E.appels.join(', ') || '(vide)');
assert(compterPoses(E.appels) > compterPoses(A.appels),
  `le verrou est bien ce qui fait la différence : ${compterPoses(A.appels)} pose(s) avec, ${compterPoses(E.appels)} sans`);
if (failed > echecsAvantE) diagnostic('passe E', E.resultat);

// ---------------------------------------------------------------------------
// PASSE F — le contrat de l'option --powershell
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
console.log(`Contre-épreuve de la passerelle bloquante — ${pwsh} (PowerShell ${versionPs}) : ${passed} OK, ${failed} ÉCHEC(S).`);
console.log(`Arithmétique de préfixe : ${casJustes}/${CAS_PREFIXES.length} cas justes, dont /1, /4, /9, /17, /23, /25, /30, /31 et /32.`);
if (majeurPs === 5) console.log('Moteur éprouvé : Windows PowerShell 5.1, cible de référence du projet.');
else if (majeurPs >= 7) console.log('Moteur éprouvé : PowerShell 7. La cible 5.1 demande une exécution distincte.');
if (failed > 0) process.exit(1);
