#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — PORTE SHELLCHECK SUR LE CORPUS .sh
//
// POURQUOI CE FICHIER EXISTE
//
// Jusqu a ce lot, ShellCheck etait lance a la main sur les 80 scripts .sh et
// le resultat etait lu par un humain. Deux choses ont change le jour ou les
// huit jeux de donnees ont enfin porte des valeurs differentes :
//
//   1. ShellCheck s est mis a signaler SC1112 (apostrophe typographique dans
//      une chaine entre apostrophes) et SC2016 (« $ et ` ne s etendent pas
//      entre apostrophes ») sur des lignes qui ne contiennent PAS de code
//      ecrit par nous : elles contiennent une valeur saisie par
//      l utilisateur, transportee par shQuote().
//
//      Ces deux alertes sont, sur ces lignes-la, exactement ce qu on veut.
//      SC2016 dit litteralement que la valeur ne sera pas interpretee : c est
//      la garantie. SC1112 dit qu il y a un U+2019 : sous Bash, entre
//      apostrophes, U+2019 est un caractere ordinaire — ce n est PAS un
//      delimiteur, contrairement a PowerShell, ou le LOT 6 l a paye.
//
//   2. ShellCheck a trouve un VRAI defaut au meme moment : SC2034, deux
//      declarations mortes dans bash-script-starter quand l utilisateur
//      refusait la simulation ou le verrou. Corrige a la cause.
//
// LA TENTATION, ET POURQUOI ELLE EST REFUSEE
//
// Le plus court aurait ete d ajouter --exclude=SC1112,SC2016 et de passer a
// autre chose. C est precisement l exception ajoutee pour faire passer le lot.
// Elle aurait aussi eteint SC1112 sur du code ECRIT PAR NOUS — l alerte qui a
// servi, dans ce meme lot, a rendre un libelle par defaut ASCII.
//
// CE QUE FAIT CETTE PORTE A LA PLACE
//
// Elle lit _valeurs-linux.json, c est-a-dire les valeurs REELLEMENT passees a
// chaque script, ecrites par test/generate-ps1.mjs. Pour chaque alerte :
//
//   - code autre que SC1112 / SC2016  -> echec, sans discussion ;
//   - SC1112 : tolere seulement si la ligne contient une valeur de CE script
//     qui contient elle-meme une apostrophe typographique ;
//   - SC2016 : tolere seulement si la ligne contient une valeur de CE script
//     qui contient elle-meme « $ » ou un accent grave.
//
// Une alerte non attribuable a une valeur saisie est un echec. L exception ne
// porte donc pas sur un code, mais sur une ligne dont on a prouve l origine.
//
// Et une deuxieme passe, sans aucune tolerance, tourne sur les scripts du jeu
// « default » : ceux-la ne contiennent que des valeurs ecrites par nous, donc
// ils doivent etre rigoureusement propres.
//
// NIVEAU DE PREUVE : analyse statique. Ce fichier ne prouve pas qu un script
// fait ce qu il annonce sur un vrai Ubuntu Server. Il prouve qu aucune alerte
// ShellCheck ne reste sans explication verifiee.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, 'generated');

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  ok   ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  ECHEC ${m}`); };

// --- ShellCheck doit exister : sinon la porte serait verte sans rien lire ---
let versionShellcheck = '';
try {
  versionShellcheck = execFileSync('shellcheck', ['--version'], { encoding: 'utf8' })
    .split('\n').find((l) => l.startsWith('version:')) ?? '';
} catch {
  console.error('ECHEC : shellcheck est introuvable. Cette porte ne peut pas etre');
  console.error('        declaree verte sans avoir analyse quoi que ce soit.');
  process.exit(1);
}
console.log(`ShellCheck : ${versionShellcheck.trim()}`);

if (!existsSync(DIR)) {
  console.error('ECHEC : test/generated est absent. Lance « npm run generate » d abord.');
  process.exit(1);
}

const sh = readdirSync(DIR).filter((f) => f.endsWith('.sh')).sort();
if (sh.length === 0) {
  console.error('ECHEC : aucun script .sh a analyser.');
  process.exit(1);
}

const VALEURS = JSON.parse(readFileSync(join(DIR, '_valeurs-linux.json'), 'utf8'));

// SC1003 : faux positif documente sur la sequence '\'' de shQuote. C est la
// SEULE exclusion globale, et elle est justifiee dans LOT-7-DECISIONS.
const EXCLUSIONS_GLOBALES = 'SC1003';

const TYPO = /[‘’“”]/;
const DOLLAR_OU_BACKTICK = /[$`]/;

// Les deux SEULS codes tolerables, et seulement sur une ligne attribuee.
// SC1110 n en fait volontairement PAS partie : ShellCheck distingue
// l apostrophe typographique DANS une chaine entre apostrophes (SC1112, une
// donnee transportee) de celle qui sert de delimiteur hors chaine (SC1110, du
// code casse). Confondre les deux rendrait la porte aveugle au second cas.
const TOLERABLES = { SC1112: TYPO, SC2016: DOLLAR_OU_BACKTICK };

/**
 * Decide du sort d une alerte. C est CETTE fonction que le plan 3 met a
 * l epreuve, pas une reecriture approchante de sa logique.
 */
function verdict(code, ligne, valeurs) {
  const motif = TOLERABLES[code];
  if (!motif) return { tolere: false, raison: `${code} n est pas un code tolerable` };
  const cause = valeurs
    .map(String)
    .find((v) => v !== '' && motif.test(v) && ligne.includes(v));
  if (!cause) return { tolere: false, raison: 'aucune valeur saisie ne porte le caractere signale' };
  return { tolere: true, cause };
}

/**
 * Lance ShellCheck en JSON sur un lot de fichiers. --format=json1 donne un
 * objet { comments: [...] } avec fichier, ligne, code et message : on lit des
 * champs, pas du texte a l oeil.
 */
function analyser(fichiers, exclusions) {
  const args = ['--severity=style', '--format=json1', `--exclude=${exclusions}`, ...fichiers];
  let brut;
  try {
    brut = execFileSync('shellcheck', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    // ShellCheck sort 1 des qu il a quelque chose a dire : la sortie utile est
    // sur stdout quand meme.
    brut = e.stdout ?? '';
    if (!brut) throw e;
  }
  return JSON.parse(brut).comments ?? [];
}

// ===========================================================================
// PLAN 1 — le corpus complet, avec attribution prouvee ligne par ligne
// ===========================================================================
console.log('');
console.log(`Plan 1 — ${sh.length} scripts .sh, attribution de chaque alerte`);

const alertes = analyser(sh.map((f) => join(DIR, f)), EXCLUSIONS_GLOBALES);
let tolerees = 0;
const parCode = new Map();

for (const a of alertes) {
  const fichier = a.file.split('/').pop();
  const code = `SC${a.code}`;
  parCode.set(code, (parCode.get(code) ?? 0) + 1);

  const ligne = readFileSync(join(DIR, fichier), 'utf8').split('\n')[a.line - 1] ?? '';
  const valeurs = Object.values(VALEURS[fichier] ?? {});

  const d = verdict(code, ligne, valeurs);
  if (d.tolere) {
    tolerees += 1;
    pass(`${fichier}:${a.line} ${code} attribue a la valeur saisie ${JSON.stringify(d.cause)}`);
  } else {
    fail(`${fichier}:${a.line} ${code} refuse (${d.raison}) :\n`
      + `        ${ligne.trim()}\n`
      + `        ${a.message}\n`
      + '        Cette alerte porte donc sur du code ecrit par nous. Corrige a la cause.');
  }
}

pass(`${alertes.length} alerte(s) ShellCheck, ${tolerees} attribuee(s) a une valeur saisie`);
for (const [code, n] of [...parCode].sort()) console.log(`         ${code} : ${n}`);

// ===========================================================================
// PLAN 2 — le jeu « default », sans aucune tolerance
//
// Ces scripts ne portent que des valeurs ecrites par nous. Si SC1112 ou SC2016
// y apparait, c est notre code qui est en cause, et aucune attribution ne peut
// le sauver.
// ===========================================================================
console.log('');
const defauts = sh.filter((f) => f.endsWith('__default.sh'));
console.log(`Plan 2 — ${defauts.length} scripts du jeu « default », tolerance zero`);

const alertesDefault = analyser(defauts.map((f) => join(DIR, f)), EXCLUSIONS_GLOBALES);
if (alertesDefault.length === 0) {
  pass('aucune alerte ShellCheck sur les valeurs ecrites par nous');
} else {
  for (const a of alertesDefault) {
    fail(`${a.file.split('/').pop()}:${a.line} SC${a.code} sur une valeur ECRITE PAR NOUS — ${a.message}`);
  }
}

// ===========================================================================
// PLAN 3 — contre-preuves : la porte doit refuser ce qu elle doit refuser
//
// Une porte qu on n a jamais vue dire non n est pas une porte.
// ===========================================================================
console.log('');
console.log('Plan 3 — contre-preuves');

const bac = mkdtempSync(join(tmpdir(), 'kjemo-sc-'));
try {
  // Contre-preuve 1 : une apostrophe typographique utilisee comme DELIMITEUR,
  // c est-a-dire du code casse. Mesure faite : ShellCheck ne rend pas SC1112
  // dans ce cas, il rend SC1110 — un code que la porte ne tolere jamais. Cette
  // contre-preuve fixe la distinction : si une version future de ShellCheck
  // rendait SC1112 ici, la porte deviendrait aveugle et ce test le dirait.
  const f1 = join(bac, 'faux-code-typo.sh');
  writeFileSync(f1, '#!/usr/bin/env bash\nset -Eeuo pipefail\nmsg=’texte’\nprintf \'%s\\n\' "${msg}"\n', 'utf8');
  const codes1 = analyser([f1], EXCLUSIONS_GLOBALES).map((a) => `SC${a.code}`);
  if (codes1.includes('SC1110') && !codes1.includes('SC1112')) {
    pass(`contre-preuve 1 : apostrophe typographique delimitante -> ${codes1.join(', ')} (SC1110, jamais tolere)`);
  } else {
    fail(`contre-preuve 1 : attendu SC1110 sans SC1112, obtenu ${codes1.join(', ') || 'aucun code'}`);
  }

  // Et le verdict doit refuser SC1110 MEME si une valeur saisie figure sur la
  // ligne : le code n est pas dans la liste des tolerables.
  const d1 = verdict('SC1110', 'msg=’texte’', ['’texte’']);
  if (!d1.tolere) pass(`contre-preuve 1 bis : verdict refuse SC1110 (${d1.raison})`);
  else fail('contre-preuve 1 bis : SC1110 a ete TOLERE — la porte laisserait passer du code casse');

  // Contre-preuve 1 ter : SC1112 sur une ligne sans aucune valeur attribuable.
  const d1t = verdict('SC1112', "msg='’texte’'", []);
  if (!d1t.tolere) pass(`contre-preuve 1 ter : verdict refuse SC1112 non attribue (${d1t.raison})`);
  else fail('contre-preuve 1 ter : SC1112 tolere sans aucune valeur saisie');

  // Contre-preuve 2 : l attribution ne doit pas se contenter d une
  // coincidence. Une valeur saisie qui ne contient PAS le caractere signale ne
  // doit jamais justifier l alerte.
  const bonne = '/srv/d’adam';
  const d2 = verdict('SC1112', `KJEMO_X='${bonne}'`, ['/srv/dadam', bonne]);
  if (d2.tolere && d2.cause === bonne) {
    pass('contre-preuve 2 : seule la valeur portant reellement le caractere est retenue');
  } else {
    fail(`contre-preuve 2 : attribution a ${JSON.stringify(d2.cause)} — le filtre est trop laxiste`);
  }

  // Contre-preuve 3 : une valeur presente sur la ligne mais sans caractere
  // signale ne sert pas d alibi.
  const d3 = verdict('SC2016', "KJEMO_ETIQ='dollar-backtick'", ['dollar-backtick']);
  if (!d3.tolere) pass(`contre-preuve 3 : une etiquette sans $ ni accent grave ne sert pas d alibi (${d3.raison})`);
  else fail('contre-preuve 3 : une valeur sans $ ni accent grave a ete acceptee comme cause');

  // Contre-preuve 4 : un code autre que SC1112/SC2016 n est jamais tolere,
  // meme sur une ligne qui contient une valeur saisie.
  const f4 = join(bac, 'faux-sc2034.sh');
  writeFileSync(f4, '#!/usr/bin/env bash\nset -Eeuo pipefail\nINUTILE=\'/srv/d’adam\'\nprintf \'%s\\n\' \'fin\'\n', 'utf8');
  const codes4 = analyser([f4], EXCLUSIONS_GLOBALES).map((a) => `SC${a.code}`);
  const autres = codes4.filter((c) => !(c in TOLERABLES));
  const refuses = autres.every((c) => verdict(c, "INUTILE='/srv/d’adam'", ['/srv/d’adam']).tolere === false);
  if (autres.length > 0 && refuses) {
    pass(`contre-preuve 4 : ${autres.join(', ')} detecte(s) et refuse(s) malgre une valeur saisie sur la ligne`);
  } else {
    fail(`contre-preuve 4 : codes ${codes4.join(', ') || 'aucun'} — le cas « autre code » n est pas couvert`);
  }

  // Contre-preuve 5 : le corpus DOIT contenir des alertes tolerees. Une porte
  // qui ne voit jamais le cas qu elle sait traiter ne prouve rien non plus.
  if (tolerees > 0) pass(`contre-preuve 5 : ${tolerees} alerte(s) effectivement attribuee(s) — la branche « tolere » est exercee`);
  else fail('contre-preuve 5 : aucune alerte toleree — les jeux de donnees ne portent plus de valeur signalable');
} finally {
  rmSync(bac, { recursive: true, force: true });
}

// ===========================================================================
console.log('');
console.log(`${ok} OK, ${echecs.length} ÉCHEC`);
process.exit(echecs.length === 0 ? 0 : 1);
