#!/usr/bin/env node
/**
 * shquote.test.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Contre-épreuves de shQuote(), la fonction sur laquelle repose TOUTE la
 * sûreté des valeurs utilisateur dans les scripts Bash du lot.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CE BANC PROUVE, ET COMMENT
 * ---------------------------------------------------------------------------
 * Il ne compare pas des chaînes à des chaînes attendues. Comparer la SORTIE de
 * shQuote à une sortie espérée ne prouverait que ma propre compréhension de la
 * citation — et si je me trompe sur la règle, je me tromperai aussi sur la
 * valeur attendue, et le banc passera.
 *
 * Il fait donc EXÉCUTER le résultat par un vrai bash, et compare ce que bash a
 * RÉELLEMENT reçu avec ce qui a été saisi. Le transport est vérifié de bout en
 * bout :
 *
 *   valeur JS  →  shQuote  →  fichier .sh  →  bash  →  octets récupérés
 *
 * La comparaison se fait sur les OCTETS, pas sur l'affichage. Une valeur qui
 * revient visuellement identique mais avec un \r de plus, un espace en moins ou
 * un retour à la ligne converti serait acceptée par une comparaison visuelle,
 * et c'est exactement le genre de différence qui casse un chemin de fichier.
 *
 * Deux voies sont éprouvées pour chaque valeur, parce qu'elles échouent
 * différemment :
 *   - en ARGUMENT d'une commande (`printf '%s' <valeur>`) ;
 *   - en AFFECTATION de variable (`V=<valeur>`), puis relecture.
 *
 * Usage : node test/shquote.test.mjs
 * Exit 0 = tout OK, exit 1 = au moins un ÉCHEC.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { shQuote, SHEBANG_BASH } = await import(
  pathToFileURL(resolve(ROOT, 'dist', 'noyau-bash.mjs')).href
);

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

const bac = mkdtempSync(join(tmpdir(), 'kjemo-shquote-'));

/**
 * Fait transporter une valeur par bash, en argument puis en affectation, et
 * rend les octets réellement reçus dans chaque cas.
 *
 * Le transport se fait par un FICHIER et non par `bash -c`, pour éprouver
 * exactement le chemin réel : les valeurs du lot finissent dans un fichier .sh
 * téléchargé, pas dans une ligne de commande.
 */
function transporter(valeur) {
  const cite = shQuote(valeur);
  const sortieArg = join(bac, 'arg.bin');
  const sortieVar = join(bac, 'var.bin');
  const script = [
    SHEBANG_BASH,
    'set -Eeuo pipefail',
    "IFS=$'\\n\\t'",
    // Voie 1 : la valeur citée est passée en ARGUMENT.
    `printf '%s' ${cite} > ${shQuote(sortieArg)}`,
    // Voie 2 : la valeur citée est AFFECTÉE, puis relue entre guillemets.
    `V=${cite}`,
    `printf '%s' "\${V}" > ${shQuote(sortieVar)}`,
    // Voie 3 : le nombre d'arguments. Une valeur qui se découpe en deux
    // arguments est une injection, même si son contenu paraît intact.
    `set -- ${cite}`,
    `printf '%s' "$#" > ${shQuote(join(bac, 'argc.bin'))}`,
    '',
  ].join('\n');
  const chemin = join(bac, 'essai.sh');
  writeFileSync(chemin, script);
  execFileSync('bash', [chemin], { encoding: 'buffer' });
  return {
    argument: readFileSync(sortieArg),
    variable: readFileSync(sortieVar),
    nbArguments: Number(readFileSync(join(bac, 'argc.bin'), 'utf8')),
    cite,
  };
}

/** Éprouve une valeur de bout en bout, sur les octets. */
function eprouver(nom, valeur) {
  const attendu = Buffer.from(valeur, 'utf8');
  let r;
  try {
    r = transporter(valeur);
  } catch (e) {
    assert(false, `${nom} — transport par bash`, e.message);
    return;
  }
  assert(r.argument.equals(attendu),
    `${nom} — transporté en ARGUMENT, octet pour octet`,
    `attendu ${attendu.toString('hex')}, reçu ${r.argument.toString('hex')}`);
  assert(r.variable.equals(attendu),
    `${nom} — transporté en AFFECTATION, octet pour octet`,
    `attendu ${attendu.toString('hex')}, reçu ${r.variable.toString('hex')}`);
  assert(r.nbArguments === 1,
    `${nom} — reste UN seul argument (${r.nbArguments})`);
}

// ===========================================================================
section('Les onze cas imposés');
// ===========================================================================

// 1. Apostrophe simple — le SEUL caractère spécial à l'intérieur d'une chaîne
//    à apostrophes simples, et donc le seul que shQuote ait à traiter.
eprouver("apostrophe simple", "l'ete");
eprouver("apostrophes multiples", "l'ete d'O'Brien");
eprouver("apostrophe seule", "'");
eprouver("apostrophes consecutives", "'''");

// 2. Espaces et accents — le mot-découpage et l'UTF-8.
eprouver("espaces et accents", "Rapport de l'ete 2026 — été à Montréal");
eprouver("espaces en tete et en fin", "   valeur entouree   ");
eprouver("tabulation et espaces melanges", "a \t b  c");

// 3. Guillemets doubles.
eprouver("guillemets doubles", 'il a dit "bonjour"');

// 4. Substitution de commande $() — littérale, donc inoffensive.
eprouver("substitution $()", '$(whoami)');
eprouver("substitution imbriquee", '$(echo $(id -u))');
eprouver("variable $VAR", '$HOME et ${PATH}');

// 5. Backticks — l'ancienne forme de substitution.
eprouver("backticks", '`id`');
eprouver("backticks et dollar", '`whoami` $(hostname)');

// 6. Point-virgule — le séparateur de commandes.
eprouver("point-virgule", '; rm -rf /tmp/essai');
eprouver("enchainements && et ||", 'a && b || c');
eprouver("tube", 'a | b');

// 7. Retour à la ligne.
eprouver("retour a la ligne", 'premiere\nseconde');
eprouver("retour a la ligne suivi d une commande", "valeur\nrm -rf /tmp/essai");

// 8. Tabulation.
eprouver("tabulation", 'colonne1\tcolonne2');

// 9. Valeur commençant par un tiret — le piège de l'option.
eprouver("commence par un tiret", '-rf');
eprouver("commence par deux tirets", '--force');
eprouver("ressemble a une option avec valeur", '--chemin=/etc/passwd');

// 10. Chaîne vide — doit rester UN argument, et non disparaître.
eprouver("chaine vide", '');

// 11. L'octet nul : voir la section dédiée plus bas.

// ===========================================================================
section('Caracteres de controle et cas limites supplementaires');
// ===========================================================================

eprouver("retour chariot seul", 'avant\ravres');
eprouver("antislash", 'C:\\Windows\\System32');
eprouver("antislash avant apostrophe", "a\\'b");
eprouver("joker etoile", '*');
eprouver("joker etoile dans un chemin", '/tmp/*');
eprouver("accolades bash", '{a,b,c}');
eprouver("expansion tilde", '~/Documents');
eprouver("point d exclamation (histoire)", '!!');
eprouver("crochets", '[a-z]');
eprouver("parentheses", '(sous-shell)');
eprouver("hash", 'valeur # pas un commentaire');
eprouver("egal", 'CLE=valeur');
eprouver("deux-points", 'a:b:c');
eprouver("emoji et hors BMP", 'rapport \u{1F512} final');
eprouver("texte long", 'x'.repeat(4000));

// ===========================================================================
section('L octet nul est REFUSE, et non cite');
// ===========================================================================

// La seule valeur que shQuote refuse. Pas par prudence : par impossibilité.
// Un argument Unix est une chaîne terminée par un nul ; un nul au milieu EST
// la fin de la chaîne. Bash tronque sans se plaindre, et le script agirait sur
// une cible différente de celle qui a été saisie.
for (const [nom, valeur] of [
  ['nul seul', '\0'],
  ['nul en tete', '\0rapport'],
  ['nul au milieu', 'rapport\0final'],
  ['nul en fin', 'rapport\0'],
  ['nul suivi d une commande', 'rapport\0; rm -rf /tmp'],
]) {
  let leve = false;
  let message = '';
  try {
    shQuote(valeur);
  } catch (e) {
    leve = true;
    message = e.message;
  }
  assert(leve, `${nom} — shQuote LEVE au lieu de citer`);
  assert(leve && /octet nul/i.test(message),
    `${nom} — le message explique que l octet nul n est pas transportable`,
    message);
  assert(leve && /tronqu/i.test(message),
    `${nom} — le message dit que la troncature serait SILENCIEUSE`,
    message);
}

// Et la démonstration de POURQUOI : ce que bash fait réellement d'un nul.
// On ne le fait pas passer par shQuote — on écrit le nul directement dans le
// script, pour montrer le comportement qu'on refuse de produire.
{
  const chemin = join(bac, 'nul.sh');
  const sortie = join(bac, 'nul.bin');
  // Le nul est inséré par printf, seule façon fiable de l'obtenir dans un
  // script texte. On vérifie ce que la variable en retient.
  writeFileSync(chemin, [
    SHEBANG_BASH,
    'set -Eeuo pipefail',
    `V="$(printf 'avant\\000apres')"`,
    `printf '%s' "\${V}" > ${shQuote(sortie)}`,
    '',
  ].join('\n'));
  execFileSync('bash', [chemin], { encoding: 'buffer' });
  const recu = readFileSync(sortie);
  assert(!recu.includes(0),
    'demonstration — bash ne transporte PAS l octet nul dans une variable',
    `octets recus : ${recu.toString('hex')}`);
  assert(recu.toString('utf8') !== 'avant\0apres',
    'demonstration — la valeur revient DIFFERENTE de celle qui a ete saisie',
    `recu : ${JSON.stringify(recu.toString('utf8'))}`);
  console.log(`          (bash a retenu ${JSON.stringify(recu.toString('utf8'))} `
    + `au lieu de "avant\\0apres" : la troncature est bien silencieuse)`);
}

// ===========================================================================
section('Contre-epreuve du banc : une citation NAIVE doit echouer');
// ===========================================================================

// Un banc qui ne peut pas échouer ne prouve rien. On remplace shQuote par trois
// citations fausses, chacune d'un type qu'on rencontre dans du vrai code, et on
// exige que le banc les prenne.

/** Citation naïve n°1 : guillemets doubles. Laisse $ et ` actifs. */
const citationGuillemets = (v) => `"${String(v)}"`;
/** Citation naïve n°2 : apostrophes sans traiter l'apostrophe interne. */
const citationApostropheNaive = (v) => `'${String(v)}'`;
/** Citation naïve n°3 : aucune citation. */
const citationAucune = (v) => String(v);

function transporterAvec(citer, valeur) {
  const sortie = join(bac, 'cp.bin');
  const chemin = join(bac, 'cp.sh');
  writeFileSync(chemin, [
    SHEBANG_BASH,
    'set -Eeuo pipefail',
    `printf '%s' ${citer(valeur)} > ${shQuote(sortie)}`,
    '',
  ].join('\n'));
  try {
    execFileSync('bash', [chemin], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return null;               // le script a échoué : la citation est cassée
  }
  return readFileSync(sortie);
}

for (const [nom, citer, valeur] of [
  ['guillemets doubles face a $(...)', citationGuillemets, '$(id -u)'],
  ['guillemets doubles face a un backtick', citationGuillemets, '`id -u`'],
  ['guillemets doubles face a $HOME', citationGuillemets, '$HOME'],
  ['apostrophes naives face a une apostrophe', citationApostropheNaive, "l'ete"],
  ['aucune citation face a un point-virgule', citationAucune, '; echo INJECTE'],
  ['aucune citation face a un espace', citationAucune, 'deux mots'],
]) {
  const attendu = Buffer.from(valeur, 'utf8');
  const recu = transporterAvec(citer, valeur);
  const transporteFidelement = recu !== null && recu.equals(attendu);
  assert(!transporteFidelement,
    `contre-epreuve — ${nom} : la citation naive NE transporte PAS la valeur`,
    recu === null ? '(le script a echoue)' : `recu : ${JSON.stringify(recu.toString('utf8'))}`);
  // Et la même valeur, par shQuote, doit passer.
  const parShQuote = transporterAvec(shQuote, valeur);
  assert(parShQuote !== null && parShQuote.equals(attendu),
    `contre-epreuve — la MEME valeur passe par shQuote`,
    parShQuote === null ? '(echec)' : parShQuote.toString('hex'));
}

// ===========================================================================
section('Propriete structurelle : la valeur ne s echappe jamais de la citation');
// ===========================================================================

// La garantie de shQuote n'est pas une liste noire : c'est une propriété du
// langage. À l'intérieur d'une chaîne à apostrophes simples, aucun caractère
// n'est spécial sauf l'apostrophe, qui est traitée. On le vérifie par une
// épreuve systématique : chaque octet imprimable, seul, puis entouré.
{
  let echecs = 0;
  for (let code = 1; code < 127; code += 1) {
    const ch = String.fromCharCode(code);
    for (const valeur of [ch, `a${ch}b`, `${ch}${ch}`]) {
      const attendu = Buffer.from(valeur, 'utf8');
      let recu;
      try {
        recu = transporter(valeur);
      } catch {
        echecs += 1;
        console.error(`  [FAIL]  octet ${code} (${JSON.stringify(ch)}) : transport en echec`);
        continue;
      }
      if (!recu.argument.equals(attendu) || !recu.variable.equals(attendu)
          || recu.nbArguments !== 1) {
        echecs += 1;
        console.error(`  [FAIL]  octet ${code} (${JSON.stringify(ch)}) : `
          + `arg=${recu.argument.toString('hex')} var=${recu.variable.toString('hex')} `
          + `argc=${recu.nbArguments}, attendu ${attendu.toString('hex')}`);
      }
    }
  }
  assert(echecs === 0,
    'les 126 octets imprimables et de controle (hors nul) transportent tous fidelement, '
    + 'seuls, entoures et doubles — 378 transports',
    `${echecs} echec(s)`);
}

// Et la forme produite est bien toujours une chaîne à apostrophes simples :
// c'est ce qui rend la propriété ci-dessus structurelle et non accidentelle.
for (const valeur of ['', 'simple', "l'ete", '$(id)', '-rf', 'a\nb']) {
  const cite = shQuote(valeur);
  assert(cite.startsWith("'") && cite.endsWith("'"),
    `forme — ${JSON.stringify(valeur)} est cite entre apostrophes simples`,
    cite);
}
assert(shQuote('') === "''",
  'forme — la chaine vide devient \'\', donc un argument vide et non un argument absent');

rmSync(bac, { recursive: true, force: true });

console.log('');
console.log(`shQuote : ${ok} OK, ${ko} ÉCHEC(S).`);
console.log('Moteur : bash réel, comparaison sur les octets, aller-retour complet.');
if (ko > 0) process.exit(1);
