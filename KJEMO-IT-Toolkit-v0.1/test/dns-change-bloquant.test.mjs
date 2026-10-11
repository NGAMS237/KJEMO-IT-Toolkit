/**
 * dns-change-bloquant.test.mjs — contre-épreuve d'exécution
 * ---------------------------------------------------------
 * `dns-client-change` éprouve les serveurs DNS demandés avant de les imposer.
 * La question n'est pas de savoir si le script CONTIENT cette épreuve : c'est
 * de savoir si, l'épreuve ayant échoué, il s'abstient réellement d'appeler
 * `Set-DnsClientServerAddress`.
 *
 * Une recherche de motif dans le texte du script ne répond pas à cette
 * question. Ce test l'exécute donc pour de vrai, sous PowerShell, dans une
 * session où les cmdlets dangereuses sont remplacées par des mouchards :
 *
 *   Set-DnsClientServerAddress  →  inscrit son nom dans un journal.
 *   Clear-DnsClientCache        →  inscrit son nom dans un journal.
 *   Resolve-DnsName             →  répond, ou lève, selon la passe.
 *   Test-NetConnection          →  répond TOUJOURS que le port 53 est ouvert.
 *
 * Ce dernier point est délibéré et central. Un port 53 ouvert ne prouve pas
 * qu'un service DNS répond derrière : un pare-feu peut accepter la connexion
 * TCP sans rien router. Le banc rend donc TCP 53 systématiquement positif.
 * Si la décision du script s'appuyait encore sur lui, la passe A écrirait —
 * et le défaut signalé par la revue réapparaîtrait aussitôt.
 *
 * Cinq passes, et toutes comptent :
 *
 *   PASSE A — un serveur DNS sur deux ne répond pas : ZÉRO appel.
 *   PASSE B — contrôle positif, tous répondent      : EXACTEMENT un appel.
 *   PASSE C — la carte est absente                  : ZÉRO appel.
 *   PASSE D — l'état précédent est introuvable      : ZÉRO appel.
 *   PASSE E — le défaut est réintroduit             : le test doit le voir.
 *
 * La passe B n'est pas facultative : sans elle, un journal vide en passe A ne
 * prouverait rien — il pourrait signifier que les mouchards ne se déclenchent
 * jamais, ou que le script s'est arrêté bien avant, pour une tout autre
 * raison. La passe E est la contre-épreuve du test lui-même : un test
 * incapable d'échouer ne prouve rien.
 *
 * INTERPRÉTEUR
 * ------------
 * Les scripts de ce projet visent Windows PowerShell 5.1 en premier, et
 * PowerShell 7 ensuite. Le moteur se choisit explicitement :
 *
 *   node test/dns-change-bloquant.test.mjs --powershell powershell
 *   node test/dns-change-bloquant.test.mjs --powershell pwsh
 *
 * Si l'interpréteur demandé est absent, le test ÉCHOUE. Il ne se rabat jamais
 * en silence sur l'autre moteur : un résultat obtenu sous PowerShell 7 ne peut
 * pas être présenté comme un résultat PowerShell 5.1.
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
  console.log('Ce mode sert au développement. Il ne prouve la couverture d’AUCUN autre moteur :');
  console.log('en intégration continue, passe --powershell powershell puis --powershell pwsh.');
}
if (demande) pwsh = demande;

const majeurPs = Number(String(versionPs).split('.')[0]) || 0;

// ---------------------------------------------------------------------------
// Le script à éprouver, en mode Appliquer
// ---------------------------------------------------------------------------
const outil = tools.find((t) => t.id === 'dns-client-change');
if (!outil) {
  console.log('\nOutil dns-client-change absent du catalogue.');
  process.exit(1);
}
const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
valeurs.mode = 'Appliquer';
const script = outil.generate(valeurs);

/** Les deux serveurs du jeu par défaut, dans l'ordre où le script les éprouve. */
const SERVEURS = String(valeurs.dchServeurs).split(',').map((s) => s.trim()).filter(Boolean);
if (SERVEURS.length < 2) {
  console.log('\nLe jeu par défaut doit comporter au moins deux serveurs pour cette épreuve.');
  process.exit(1);
}

const travail = mkdtempSync(join(tmpdir(), 'kjemo-dns-change-'));

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
function ecrirePs1(chemin, contenu) {
  writeFileSync(chemin, Buffer.concat([BOM, Buffer.from(contenu, 'utf8')]));
  return chemin;
}

const cheminScript = ecrirePs1(join(travail, 'dns-client-change.ps1'), script);

/** Chaîne -> littéral PowerShell entre apostrophes. Seule forme sûre. */
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

/**
 * Le script sous test termine TOUJOURS par l'en-tête de son rapport. S'il est
 * absent de la sortie, le script n'a pas tourné jusqu'au bout — et un journal
 * vide ne prouve alors plus rien.
 */
const MARQUEUR_EXECUTION = /=== dns-client-change -/;

function diagnostic(nomPasse, resultat) {
  console.log(`\n  ---- Diagnostic ${nomPasse} : ${pwsh} (PowerShell ${versionPs}), code ${resultat.code} ----`);
  if (resultat.erreurLancement) console.log(`  lancement : ${resultat.erreurLancement}`);
  const extrait = (t) => t.split(/\r?\n/).filter((l) => l.trim()).slice(-40).map((l) => `  | ${l}`).join('\n');
  console.log('  sortie d’erreur :');
  console.log(extrait(resultat.stderr) || '  | (vide)');
  console.log('  sortie standard (40 dernières lignes) :');
  console.log(extrait(resultat.stdout) || '  | (vide)');
  console.log('  ---- fin du diagnostic ----\n');
}

/**
 * Le banc d'essai. Les fonctions définies ici masquent les cmdlets du même
 * nom : en PowerShell, une fonction l'emporte sur une applet de commande dans
 * la résolution de nom. Le script dot-sourcé s'exécute donc sans toucher à
 * rien.
 *
 * Le banc est volontairement en ASCII pur. Il porte un BOM UTF-8 comme tout
 * .ps1 de ce projet, mais un banc sans caractère accentué ne peut pas, lui,
 * faire échouer la contre-épreuve pour une raison d'encodage.
 *
 * Note : ces doublures portent [CmdletBinding()] et ne déclarent PAS
 * -ErrorAction. C'est un paramètre commun, fourni d'office aux fonctions
 * avancées ; le redéclarer ferait échouer la liaison, et le script prendrait
 * l'échec pour un résultat.
 */
function banc({
  journal,
  serveursQuiEchouent = [],
  carteAbsente = false,
  etatIndisponible = false,
  scriptSousTest = cheminScript,
}) {
  const listeEchecs = serveursQuiEchouent.length
    ? '@(' + serveursQuiEchouent.map(psLitteral).join(', ') + ')'
    : '@()';
  return `
$ErrorActionPreference = 'Continue'
$global:KjemoJournal = ${psLitteral(journal)}
if (Test-Path -LiteralPath $global:KjemoJournal) { Remove-Item -LiteralPath $global:KjemoJournal }
$global:KjemoServeursEnEchec = ${listeEchecs}

function Write-KjemoAppel { param([string]$Nom)
  Add-Content -LiteralPath $global:KjemoJournal -Value $Nom
}

# --- Mouchards : toute ecriture reelle est interceptee et consignee ---------
function Set-DnsClientServerAddress {
  [CmdletBinding()] param([string]$InterfaceAlias, $ServerAddresses, [switch]$ResetServerAddresses)
  Write-KjemoAppel 'Set-DnsClientServerAddress'
  return $null
}
function Clear-DnsClientCache {
  [CmdletBinding()] param([switch]$Confirm)
  Write-KjemoAppel 'Clear-DnsClientCache'
  return $null
}

# --- La carte --------------------------------------------------------------
function Get-NetAdapter {
  [CmdletBinding()] param([string]$Name)
  ${carteAbsente
    ? 'return $null'
    : "return [pscustomobject]@{ Name = $Name; Status = 'Up'; ifIndex = 12 }"}
}

# --- L'etat precedent ------------------------------------------------------
function Get-DnsClientServerAddress {
  [CmdletBinding()] param([string]$InterfaceAlias, [string]$AddressFamily)
  ${etatIndisponible
    ? 'return $null'
    : "return [pscustomobject]@{ InterfaceAlias = $InterfaceAlias; ServerAddresses = @('10.0.0.1','10.0.0.2') }"}
}
function Get-NetIPInterface {
  [CmdletBinding()] param([string]$InterfaceAlias, [string]$AddressFamily)
  ${etatIndisponible
    ? 'return $null'
    : "return [pscustomobject]@{ InterfaceAlias = $InterfaceAlias; Dhcp = 'Disabled' }"}
}

# --- L'epreuve DNS : c'est ici que se joue la contre-epreuve ----------------
# Le serveur inscrit dans $global:KjemoServeursEnEchec ne repond pas : la
# doublure leve une erreur de delai depasse, comme le ferait Resolve-DnsName
# face a un serveur arrete ou filtre.
function Resolve-DnsName {
  [CmdletBinding()] param(
    [Parameter(Position=0)][string]$Name,
    [string]$Server,
    [string]$Type,
    [switch]$DnsOnly,
    [switch]$NoHostsFile)
  if ($global:KjemoServeursEnEchec -contains $Server) {
    throw ('DNS request to server ' + $Server + ' timed out')
  }
  return @([pscustomobject]@{ Name = $Name; Type = 'A'; IPAddress = '203.0.113.7' })
}

# --- Le leurre : TCP 53 repond TOUJOURS ------------------------------------
# Si la decision du script s'appuyait encore sur ce signal, la passe A
# ecrirait. C'est precisement ce que la revue reprochait.
function Test-NetConnection {
  [CmdletBinding()] param([string]$ComputerName, [int]$Port)
  return [pscustomobject]@{ ComputerName = $ComputerName; RemotePort = $Port; TcpTestSucceeded = $true }
}

# --- Decor minimal, pour que le script aille jusqu'au bout sous Linux ------
function Get-NetIPConfiguration { [CmdletBinding()] param() return @() }
function Get-CimInstance { [CmdletBinding()] param($ClassName, $Namespace) return $null }

. ${psLitteral(scriptSousTest)}
`;
}

/** Lit le journal d'une passe. */
function appelsDe(journal) {
  return existsSync(journal)
    ? readFileSync(journal, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : [];
}

/** Monte, exécute et dépouille une passe. */
function jouer(nom, options) {
  const journal = join(travail, `journal-${nom}.txt`);
  const chemin = join(travail, `banc-${nom}.ps1`);
  ecrirePs1(chemin, banc({ ...options, journal }));
  const resultat = executerBanc(chemin);
  return { resultat, appels: appelsDe(journal), sortie: resultat.stdout + resultat.stderr };
}

/** Combien de fois la cmdlet d'écriture a-t-elle été appelée ? */
function compterEcritures(appels) {
  return appels.filter((a) => a === 'Set-DnsClientServerAddress').length;
}

// ---------------------------------------------------------------------------
// PASSE A — un serveur DNS sur deux ne répond pas : rien ne doit être écrit
// ---------------------------------------------------------------------------
section('dns-client-change — PASSE A : un serveur DNS ne répond pas');

const A = jouer('a', { serveursQuiEchouent: [SERVEURS[1]] });
const echecsAvantA = failed;

assert(MARQUEUR_EXECUTION.test(A.resultat.stdout),
  'serveur en échec : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterEcritures(A.appels) === 0,
  `serveur en échec : Set-DnsClientServerAddress n’est JAMAIS appelé (${compterEcritures(A.appels)})`,
  `journal : ${A.appels.join(', ') || '(vide)'}`);
assert(A.appels.length === 0,
  `serveur en échec : aucune commande de modification, quelle qu’elle soit (${A.appels.length})`,
  A.appels.join(', ') || '(vide)');
assert(/BLOQU/i.test(A.sortie),
  'serveur en échec : le script annonce le blocage à l’écran plutôt que de se taire');
assert(A.sortie.includes(SERVEURS[1]),
  'serveur en échec : le script nomme le serveur qui a bloqué la modification',
  `serveur attendu dans la sortie : ${SERVEURS[1]}`);
assert(!/^Set-DnsClientServerAddress$/m.test(A.appels.join('\n')) && !A.appels.includes('Clear-DnsClientCache'),
  'serveur en échec : le cache DNS n’est pas vidé non plus');
if (failed > echecsAvantA) diagnostic('passe A', A.resultat);

// ---------------------------------------------------------------------------
// PASSE B — contrôle positif : tous répondent, l'écriture a bien lieu
// ---------------------------------------------------------------------------
section('dns-client-change — PASSE B : contrôle positif, tous les serveurs répondent');

const B = jouer('b', { serveursQuiEchouent: [] });
const echecsAvantB = failed;

assert(MARQUEUR_EXECUTION.test(B.resultat.stdout),
  'contrôle positif : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterEcritures(B.appels) === 1,
  `contrôle positif : Set-DnsClientServerAddress est appelé EXACTEMENT une fois (${compterEcritures(B.appels)})`,
  `journal : ${B.appels.join(', ') || '(vide)'}`);
assert(B.appels.includes('Clear-DnsClientCache'),
  'contrôle positif : le cache DNS est vidé après l’écriture',
  `journal : ${B.appels.join(', ') || '(vide)'}`);
assert(B.appels.length > A.appels.length,
  `les deux passes diffèrent : ${A.appels.length} appel(s) avec un serveur en échec, ${B.appels.length} sans`);
if (failed > echecsAvantB) diagnostic('passe B', B.resultat);

// ---------------------------------------------------------------------------
// PASSE C — la carte est absente : rien ne doit être écrit
// ---------------------------------------------------------------------------
section('dns-client-change — PASSE C : la carte est introuvable');

const C = jouer('c', { carteAbsente: true });
const echecsAvantC = failed;

assert(MARQUEUR_EXECUTION.test(C.resultat.stdout),
  'carte absente : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterEcritures(C.appels) === 0,
  `carte absente : Set-DnsClientServerAddress n’est JAMAIS appelé (${compterEcritures(C.appels)})`,
  `journal : ${C.appels.join(', ') || '(vide)'}`);
assert(C.appels.length === 0,
  `carte absente : aucune commande de modification (${C.appels.length})`,
  C.appels.join(', ') || '(vide)');
assert(/carte introuvable/i.test(C.sortie),
  'carte absente : le script dit que c’est la carte qui manque');
if (failed > echecsAvantC) diagnostic('passe C', C.resultat);

// ---------------------------------------------------------------------------
// PASSE D — l'état précédent est introuvable : rien ne doit être écrit
// ---------------------------------------------------------------------------
section('dns-client-change — PASSE D : l’état précédent n’est pas relevable');

const D = jouer('d', { etatIndisponible: true });
const echecsAvantD = failed;

assert(MARQUEUR_EXECUTION.test(D.resultat.stdout),
  'état précédent introuvable : le script sous test s’est réellement exécuté jusqu’au rapport');
assert(compterEcritures(D.appels) === 0,
  `état précédent introuvable : Set-DnsClientServerAddress n’est JAMAIS appelé (${compterEcritures(D.appels)})`,
  `journal : ${D.appels.join(', ') || '(vide)'}`);
assert(D.appels.length === 0,
  `état précédent introuvable : aucune commande de modification (${D.appels.length})`,
  D.appels.join(', ') || '(vide)');
assert(/etat precedent non releve|annulation/i.test(D.sortie),
  'état précédent introuvable : le script dit ce qui manque');
if (failed > echecsAvantD) diagnostic('passe D', D.resultat);

// ---------------------------------------------------------------------------
// PASSE E — le test se vérifie lui-même
//
// Un test qui ne peut pas échouer ne teste rien. On réintroduit donc
// volontairement le défaut signalé par la revue — le verrou préalable
// désarmé, de sorte que le mode Appliquer écrive sans condition — et on exige
// que la passe A, rejouée sur ce script abîmé, DÉTECTE l'appel interdit. Si
// elle ne le détecte pas, c'est le test qui est faux.
// ---------------------------------------------------------------------------
section('dns-client-change — PASSE E : le test détecte-t-il le défaut réintroduit ?');

const VERROU = "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {";
assert(script.includes(VERROU),
  'le script porte bien le verrou attendu sur le bloc Appliquer');

const scriptAbime = script.replace(VERROU, 'if ($false) {');
assert(scriptAbime !== script, 'le défaut a pu être réintroduit dans une copie du script');

const cheminAbime = ecrirePs1(join(travail, 'dns-client-change-abime.ps1'), scriptAbime);

const E = jouer('e', { serveursQuiEchouent: [SERVEURS[1]], scriptSousTest: cheminAbime });
const echecsAvantE = failed;

assert(MARQUEUR_EXECUTION.test(E.resultat.stdout),
  'défaut réintroduit : le script abîmé s’est réellement exécuté jusqu’au rapport');
assert(compterEcritures(E.appels) === 1,
  `sans le verrou, Set-DnsClientServerAddress s’exécute malgré le serveur en échec (${compterEcritures(E.appels)})`,
  E.appels.join(', ') || '(vide)');
assert(E.appels.length > A.appels.length,
  `le verrou est bien ce qui fait la différence : ${A.appels.length} appel(s) avec, ${E.appels.length} sans`);
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
console.log(`Contre-épreuve du changement DNS bloquant — ${pwsh} (PowerShell ${versionPs}) : ${passed} OK, ${failed} ÉCHEC(S).`);
if (majeurPs === 5) console.log('Moteur éprouvé : Windows PowerShell 5.1, cible de référence du projet.');
else if (majeurPs >= 7) console.log('Moteur éprouvé : PowerShell 7. La cible 5.1 demande une exécution distincte.');
if (failed > 0) process.exit(1);
