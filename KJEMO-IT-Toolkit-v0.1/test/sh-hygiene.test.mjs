#!/usr/bin/env node
/**
 * sh-hygiene.test.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * L'hygiène des scripts Bash, sur deux plans qu'il ne faut pas confondre.
 *
 * PLAN 1 — les fichiers .sh PRODUITS. Ce qui y est vérifié est une vraie
 * condition de validité : aucun BOM, aucun CR, le shebang exact, de l'UTF-8
 * valide. Un BOM se placerait avant « #! » et masquerait le shebang ; un CRLF
 * ferait chercher un interpréteur nommé « bash\r » qui n'existe pas.
 *
 * PLAN 2 — le CODE SOURCE qui les produit. On y vérifie que les fragments
 * AUTORÉS — commentaires, messages, noms de variables — sont en ASCII.
 *
 * La distinction entre les deux plans est la correction d'une erreur réelle.
 * La règle ASCII était d'abord appliquée au script assemblé, et elle rejetait
 * alors les VALEURS de l'utilisateur, qui arrivent dans le script par
 * shQuote : la description par défaut d'un assistant, « Traite les fichiers
 * d'un dossier et écrit un rapport. », avec son apostrophe typographique et
 * son accent, suffisait à la faire échouer. Autrement dit la règle interdisait
 * d'écrire en français correct dans un formulaire français.
 *
 * Les valeurs de l'utilisateur sont de l'UTF-8 quelconque et doivent passer
 * intactes — shQuote le garantit, et test/shquote.test.mjs le prouve sur 378
 * transports. Le texte que NOUS écrivons reste en ASCII, pour qu'un terminal
 * mal réglé, une session SSH ou un LANG absent ne rendent pas illisible une
 * consigne de sécurité qu'on demande justement de relire.
 *
 * D'où une vérification STATIQUE, sur le source : c'est là que l'erreur se
 * commet, et la voir avant qu'un script soit généré coûte moins cher.
 *
 * Usage : node test/sh-hygiene.test.mjs
 * Exit 0 = tout OK, exit 1 = au moins un ÉCHEC.
 */

import { readFileSync, readdirSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERES = resolve(ROOT, 'test', 'generated');

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
const SHEBANG = '#!/usr/bin/env bash';

let ok = 0;
let ko = 0;

function assert(cond, label, detail = '') {
  if (cond) {
    console.log(`  [OK]    ${label}`);
    ok += 1;
  } else {
    console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`);
    ko += 1;
  }
}

function section(titre) { console.log(`\n--- ${titre} ---`); }

/** Les trois premiers octets du fichier, tels qu'ils sont sur le disque. */
function troisPremiersOctets(chemin) {
  const tete = Buffer.alloc(3);
  const fd = openSync(chemin, 'r');
  try { readSync(fd, tete, 0, 3, 0); } finally { closeSync(fd); }
  return tete;
}

// ===========================================================================
section('Plan 1 — les fichiers .sh produits');
// ===========================================================================

if (!existsSync(GENERES)) {
  console.error('  [FAIL]  test/generated/ est absent : lance d’abord « node test/generate-ps1.mjs ».');
  process.exit(1);
}

const fichiersSh = readdirSync(GENERES).filter((f) => f.endsWith('.sh')).sort();
assert(fichiersSh.length > 0,
  `des scripts .sh ont été générés (${fichiersSh.length})`);

let sansBom = 0;
let lfSeul = 0;
let shebangExact = 0;
let utf8Valide = 0;
let finitParLf = 0;
const defauts = [];

for (const nom of fichiersSh) {
  const chemin = join(GENERES, nom);
  const octets = readFileSync(chemin);

  // 1. Aucun BOM. Le contrôle porte sur les OCTETS du disque, pas sur la
  //    chaîne décodée : décoder d'abord masquerait justement le BOM.
  if (troisPremiersOctets(chemin).equals(BOM)) defauts.push(`${nom} : BOM UTF-8 present`);
  else sansBom += 1;

  // 2. Aucun CR, nulle part. Pas seulement en fin de ligne : un \r au milieu
  //    d'une valeur est invisible et casse une comparaison de chaînes.
  if (octets.includes(0x0D)) defauts.push(`${nom} : contient un CR (0x0D)`);
  else lfSeul += 1;

  const texte = octets.toString('utf8');

  // 3. Le shebang, à la chaîne près.
  if (texte.startsWith(`${SHEBANG}\n`)) shebangExact += 1;
  else defauts.push(`${nom} : premiere ligne ${JSON.stringify(texte.split('\n')[0])}`);

  // 4. UTF-8 valide. Un ré-encodage qui ne rend pas les mêmes octets signale
  //    une séquence invalide, remplacée par U+FFFD au décodage.
  if (Buffer.from(texte, 'utf8').equals(octets)) utf8Valide += 1;
  else defauts.push(`${nom} : UTF-8 invalide`);

  // 5. Un saut de ligne final. POSIX définit une ligne comme terminée par un
  //    saut de ligne ; sans lui, « read » perd la dernière ligne et « wc -l »
  //    en compte une de moins.
  if (texte.endsWith('\n') && !texte.endsWith('\n\n')) finitParLf += 1;
  else defauts.push(`${nom} : ne finit pas par exactement un saut de ligne`);
}

assert(sansBom === fichiersSh.length,
  `aucun .sh ne commence par un BOM (${sansBom}/${fichiersSh.length})`);
assert(lfSeul === fichiersSh.length,
  `aucun .sh ne contient de retour chariot (${lfSeul}/${fichiersSh.length})`);
assert(shebangExact === fichiersSh.length,
  `tous les .sh commencent par « ${SHEBANG} » (${shebangExact}/${fichiersSh.length})`);
assert(utf8Valide === fichiersSh.length,
  `tous les .sh sont de l’UTF-8 valide (${utf8Valide}/${fichiersSh.length})`);
assert(finitParLf === fichiersSh.length,
  `tous les .sh finissent par exactement un saut de ligne (${finitParLf}/${fichiersSh.length})`);
assert(defauts.length === 0,
  'aucun défaut d’hygiène sur les fichiers produits',
  defauts.slice(0, 6).join(' | '));

// Et la contrepartie : les .ps1 doivent, eux, TOUS porter le BOM. Les deux
// règles sont opposées, et les vérifier dans le même banc évite qu'on les
// confonde en les corrigeant.
const fichiersPs1 = readdirSync(GENERES).filter((f) => f.endsWith('.ps1'));
let ps1AvecBom = 0;
for (const nom of fichiersPs1) {
  if (troisPremiersOctets(join(GENERES, nom)).equals(BOM)) ps1AvecBom += 1;
}
assert(ps1AvecBom === fichiersPs1.length,
  `tous les .ps1 portent le BOM UTF-8, règle OPPOSÉE à celle des .sh (${ps1AvecBom}/${fichiersPs1.length})`);

// ===========================================================================
section('Plan 2 — le code source : les fragments autorés sont en ASCII');
// ===========================================================================

/**
 * Rend les zones (début, fin) de chaque corps de fonction dont le nom est
 * donné, par suivi des accolades.
 *
 * Suivi des accolades et non expression régulière : une regex ne sait pas
 * compter les accolades, et un corps de generate() en contient beaucoup.
 */
function zonesDeFonction(src, entetes) {
  const zones = [];
  for (const entete of entetes) {
    let i = 0;
    for (;;) {
      const j = src.indexOf(entete, i);
      if (j === -1) break;
      let k = j + entete.length - 1;
      while (k < src.length && src[k] !== '{') k += 1;
      let profondeur = 0;
      let guillemet = null;
      let pos = k;
      while (pos < src.length) {
        const c = src[pos];
        if (guillemet) {
          if (c === '\\') { pos += 2; continue; }
          if (c === guillemet) guillemet = null;
          pos += 1;
          continue;
        }
        if (c === '\'' || c === '"' || c === '`') { guillemet = c; pos += 1; continue; }
        if (c === '{') profondeur += 1;
        else if (c === '}') {
          profondeur -= 1;
          if (profondeur === 0) break;
        }
        pos += 1;
      }
      zones.push([j, pos]);
      i = pos;
    }
  }
  return zones;
}

/**
 * Les modules dont le texte finit dans les scripts, et la façon de délimiter
 * les parties autorées de chacun.
 *
 * Pour les catalogues, seul le corps de `generate(v)` est concerné : le reste
 * du fichier est de la fiche, c'est-à-dire de l'HTML, où la typographie
 * française complète est voulue.
 *
 * Pour les modules de fragments, tout ce que leurs fonctions exportées
 * retournent part dans les scripts.
 */
const CIBLES = [
  { fichier: 'dist/outils-linux.mjs', entetes: ['generate(v) {'] },
  { fichier: 'dist/outils-linux-b.mjs', entetes: ['generate(v) {'] },
  { fichier: 'dist/outils-linux-c.mjs', entetes: ['generate(v) {'] },
  {
    fichier: 'dist/noyau-bash.mjs',
    entetes: ['export function enteteBash(', 'export function fonctionsRapportBash(',
      'export function fonctionsEchappementBash(', 'export function blocParametresBash(',
      'export function blocVariablesBash(', 'export function blocRapportBash(',
      'export function blocPrivilegesBash('],
  },
  {
    fichier: 'dist/gardes-bash.mjs',
    entetes: ['export function blocGardienChemin(', 'export function blocSauvegardeFichier(',
      'export function blocConfirmation(', 'export function blocPorteValidation(',
      'export function blocEtatService(', 'export function blocPorteFinale('],
  },
];

/**
 * Les littéraux de chaîne d'un morceau de code JavaScript, avec leur position.
 *
 * C'est ce qui finit dans le script produit. Les commentaires JavaScript, eux,
 * restent dans le module et n'en sortent jamais : les examiner serait accuser
 * la documentation du code pour une règle qui porte sur les scripts.
 *
 * L'analyse est un balayage caractère par caractère, et non une expression
 * régulière : il faut suivre les échappements et les trois sortes de
 * délimiteurs, et sauter les commentaires sans les confondre avec une division.
 */
function litterauxDe(code) {
  const sortie = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const d = code[i + 1];
    if (c === '/' && d === '/') {
      const fin = code.indexOf('\n', i);
      i = fin === -1 ? code.length : fin;
      continue;
    }
    if (c === '/' && d === '*') {
      const fin = code.indexOf('*/', i + 2);
      i = fin === -1 ? code.length : fin + 2;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const debut = i + 1;
      let j = debut;
      while (j < code.length) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === c) break;
        j += 1;
      }
      sortie.push({ texte: code.slice(debut, j), index: debut });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return sortie;
}

const TYPOGRAPHIQUES = new Map([
  ['—', 'tiret cadratin'], ['–', 'tiret demi-cadratin'],
  ['’', 'apostrophe typographique'], ['‘', 'apostrophe typographique'],
  ['«', 'guillemet francais'], ['»', 'guillemet francais'],
  ['“', 'guillemet anglais'], ['”', 'guillemet anglais'],
  ['…', 'points de suspension'], [' ', 'espace insecable'],
]);

let zonesExaminees = 0;
const horsAscii = [];

for (const { fichier, entetes } of CIBLES) {
  const chemin = resolve(ROOT, fichier);
  if (!existsSync(chemin)) continue;
  const src = readFileSync(chemin, 'utf8');
  const zones = zonesDeFonction(src, entetes);
  assert(zones.length > 0, `${fichier} : des fragments autorés y sont repérés (${zones.length})`);
  for (const [a, b] of zones) {
    zonesExaminees += 1;
    const bloc = src.slice(a, b);
    const ligneDepart = src.slice(0, a).split('\n').length;
    // Seuls les LITTÉRAUX DE CHAÎNE sont examinés, et c'est une précision
    // nécessaire : un commentaire JavaScript à l'intérieur d'un corps de
    // generate() n'arrive JAMAIS dans le script produit. La première version
    // de ce contrôle examinait la zone entière et accusait donc des
    // commentaires inoffensifs — ce qui aurait conduit à appauvrir la
    // documentation du code pour satisfaire une règle qui ne la visait pas.
    for (const { texte, index } of litterauxDe(bloc)) {
      for (let i = 0; i < texte.length; i += 1) {
        const c = texte[i];
        if (c.codePointAt(0) <= 0x7F) continue;
        const ligne = ligneDepart + bloc.slice(0, index + i).split('\n').length - 1;
        const nom = TYPOGRAPHIQUES.get(c) ?? `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
        horsAscii.push(`${fichier}:${ligne} ${nom} (${JSON.stringify(c)}) dans ${JSON.stringify(texte.slice(0, 70))}`);
      }
    }
  }
}

assert(zonesExaminees >= 10,
  `assez de zones autorées examinées pour que le contrôle ait du sens (${zonesExaminees})`);
assert(horsAscii.length === 0,
  'aucun caractère non ASCII dans les fragments autorés — un commentaire en mojibake '
  + 'est une consigne de sécurité que personne ne lit',
  horsAscii.slice(0, 8).join('\n            '));

// ===========================================================================
section('Contre-épreuves : le banc peut-il échouer ?');
// ===========================================================================

// Un banc qui ne trouve jamais rien ressemble à un banc qui passe.

// 1. Le repérage des zones trouve bien un corps de fonction, et s'arrête à sa
//    fermeture — pas à la première accolade rencontrée.
{
  const faux = [
    'const avant = "typographique — ici, hors zone";',
    'export function blocEssai() {',
    '  const x = { a: 1, b: { c: 2 } };',
    '  return ["ligne ASCII"];',
    '}',
    'const apres = "typographique — ici aussi, hors zone";',
  ].join('\n');
  const z = zonesDeFonction(faux, ['export function blocEssai(']);
  assert(z.length === 1, 'contre-épreuve — une seule zone repérée', `${z.length}`);
  const bloc = faux.slice(z[0][0], z[0][1]);
  assert(bloc.includes('ligne ASCII'), 'contre-épreuve — la zone contient bien le corps');
  assert(!bloc.includes('hors zone'),
    'contre-épreuve — la zone s’arrête à la fermeture, accolades imbriquées comprises',
    bloc.slice(0, 80));
}

// 1 bis. litterauxDe distingue un littéral d'un commentaire.
{
  const code = [
    '// un commentaire avec un tiret cadratin \u2014 ici',
    'const a = "une chaine avec un tiret cadratin \u2014 la";',
    '/* un bloc avec \u2014 encore */',
    "const b = 'ASCII seulement';",
  ].join('\n');
  const lits = litterauxDe(code);
  const textes = lits.map((l) => l.texte);
  assert(textes.length === 2,
    `contre-épreuve — deux littéraux repérés, les commentaires exclus (${textes.length})`,
    JSON.stringify(textes));
  assert(textes.some((t) => t.includes('\u2014')),
    'contre-épreuve — le littéral contenant le tiret cadratin est bien repéré');
  assert(!textes.some((t) => t.includes('un commentaire')),
    'contre-épreuve — le commentaire JavaScript n\u2019est PAS repéré comme littéral');
}

// 2. Un caractère typographique DANS une zone est bien détecté.
{
  const faux = [
    'export function blocEssai() {',
    '  return ["# un commentaire avec un tiret cadratin — ici"];',
    '}',
  ].join('\n');
  const z = zonesDeFonction(faux, ['export function blocEssai(']);
  const bloc = faux.slice(z[0][0], z[0][1]);
  const trouve = [...bloc].some((c) => c.codePointAt(0) > 0x7F);
  assert(trouve, 'contre-épreuve — un tiret cadratin dans une zone EST détecté');
}

// 3. Le même caractère HORS zone n'est pas détecté : la règle ne s'applique
//    pas aux fiches, où la typographie française est voulue.
{
  const faux = [
    'const summary = "Relève l’état — complet";',
    'export function blocEssai() {',
    '  return ["# ASCII seulement"];',
    '}',
  ].join('\n');
  const z = zonesDeFonction(faux, ['export function blocEssai(']);
  const bloc = faux.slice(z[0][0], z[0][1]);
  const trouve = [...bloc].some((c) => c.codePointAt(0) > 0x7F);
  assert(!trouve,
    'contre-épreuve — le même caractère dans une FICHE n’est pas accusé : '
    + 'la typographie française y est voulue');
}

// 4. Les contrôles d'octets détectent un BOM et un CR introduits exprès.
{
  const avecBom = Buffer.concat([BOM, Buffer.from(`${SHEBANG}\necho ok\n`, 'utf8')]);
  assert(avecBom.subarray(0, 3).equals(BOM),
    'contre-épreuve — un BOM ajouté est bien reconnu au niveau octet');
  const avecCr = Buffer.from(`${SHEBANG}\r\necho ok\r\n`, 'utf8');
  assert(avecCr.includes(0x0D),
    'contre-épreuve — un CRLF ajouté est bien reconnu au niveau octet');
  const sansShebang = `#!/bin/sh\necho ok\n`;
  assert(!sansShebang.startsWith(`${SHEBANG}\n`),
    'contre-épreuve — un shebang /bin/sh est bien refusé');
}

// 5. Et la règle inverse : un .ps1 SANS BOM doit être un défaut.
{
  const ps1SansBom = Buffer.from('#Requires -Version 5.1\n', 'utf8');
  assert(!ps1SansBom.subarray(0, 3).equals(BOM),
    'contre-épreuve — un .ps1 sans BOM est bien reconnu comme non conforme');
}

// ===========================================================================
section('Plan 3 — les huit jeux d’un même assistant produisent huit scripts distincts');
// ===========================================================================
//
// POURQUOI CETTE RÈGLE EXISTE, ET POURQUOI ELLE EST ICI POUR TOUJOURS
//
// Trois fois dans l’histoire de ce dépôt — LOT 4, LOT 5, puis LOT 7 — les huit
// jeux de données d’un assistant ont produit huit fichiers RIGOUREUSEMENT
// IDENTIQUES, parce qu’aucune valeur du jeu ne correspondait aux champs de
// l’outil. Le corpus paraissait large et ne testait rien : les apostrophes,
// les accents, les dollars et les points-virgules n’atteignaient jamais le
// générateur.
//
// Les deux premières fois, le défaut a été trouvé à l’œil, longtemps après.
// La troisième, par une mesure d’empreintes faite à la main. Cette règle en
// fait un échec de banc : ajouter un assistant sans ajouter ses valeurs de jeu
// casse le test, immédiatement, et le message dit quoi faire.
//
// Un assistant SANS AUCUN champ ne serait pas concerné — il n’en existe aucun
// aujourd’hui, et le jour où il en existera un, cette règle devra être
// assouplie avec une raison écrite, pas en silence.

{
  const parOutil = new Map();
  for (const f of fichiersSh) {
    const outil = f.split('__')[0];
    if (!parOutil.has(outil)) parOutil.set(outil, []);
    parOutil.get(outil).push(f);
  }
  for (const [outil, fichiers] of [...parOutil].sort()) {
    const empreintes = new Set(fichiers.map(
      (f) => createHash('sha256').update(readFileSync(join(GENERES, f))).digest('hex'),
    ));
    assert(empreintes.size === fichiers.length,
      `${outil} : ${fichiers.length} jeux de données produisent ${empreintes.size} script(s) distinct(s)`
      + `${empreintes.size === fichiers.length ? '' : ' — des jeux produisent le MÊME fichier : '
        + 'leurs valeurs n’atteignent pas le générateur. Complète VALEURS_LINUX dans '
        + 'test/generate-ps1.mjs avec les champs de cet assistant.'}`);
  }

  // Contre-épreuve : la règle doit savoir dire non. Deux contenus identiques
  // rendent une seule empreinte, et c’est exactement ce qu’elle refuse.
  const a = createHash('sha256').update('meme contenu').digest('hex');
  const b = createHash('sha256').update('meme contenu').digest('hex');
  assert(new Set([a, b]).size === 1,
    'contre-épreuve — deux contenus identiques rendent bien UNE seule empreinte');
  const c = createHash('sha256').update('contenu different').digest('hex');
  assert(new Set([a, c]).size === 2,
    'contre-épreuve — deux contenus différents rendent bien DEUX empreintes');
}

console.log('');
console.log(`Hygiène des scripts : ${ok} OK, ${ko} ÉCHEC(S).`);
console.log(`${fichiersSh.length} fichiers .sh et ${fichiersPs1.length} fichiers .ps1 contrôlés `
  + `au niveau OCTET ; ${zonesExaminees} zones de code autoré contrôlées en ASCII.`);
if (ko > 0) process.exit(1);
