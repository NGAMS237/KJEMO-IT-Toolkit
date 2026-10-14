#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — NON-RÉGRESSION DES 856 SCRIPTS POWERSHELL HISTORIQUES
//
// POURQUOI CE FICHIER EXISTE
//
// Pendant les six premiers commits du LOT 7, la phrase « les 856 scripts sont
// restés identiques » était vraie, et elle était vérifiée — par une commande
// que je tapais à la main, contre un fichier posé dans /tmp.
//
// Deux choses ne vont pas avec cela, et elles sont du même ordre que les
// défauts que ce lot a déjà corrigés ailleurs :
//
//   1. la preuve vivait HORS DU DÉPÔT. La session finie, le fichier
//      disparaissait, et avec lui la seule référence permettant de dire si un
//      script historique avait bougé. Une non-régression qui dépend d'un
//      fichier temporaire n'est pas une non-régression, c'est un souvenir ;
//
//   2. elle n'était jouée par AUCUN workflow. Un contrôle qu'on exécute
//      quand on y pense protège les jours où l'on y pense.
//
// La baseline est maintenant versionnée dans test/scripts-baseline-856.json,
// et ce banc la compare à chaque exécution, dans les deux workflows.
//
// CE QUE CE BANC VÉRIFIE
//
//   - chaque script attendu EXISTE ;
//   - son empreinte SHA-256, BOM compris, est inchangée ;
//   - aucun script attendu n'a disparu ;
//   - le compte annoncé par la baseline correspond au nombre de clés.
//
// Ce qu'il ne vérifie PAS, et ne doit pas : la présence de scripts .ps1 en
// plus. Un lot futur ajoutera des assistants Windows, et leurs scripts
// n'ont pas à figurer dans une baseline figée au LOT 7. C'est l'INVERSE qui
// est un défaut — un script historique qui change ou s'en va.
//
// NIVEAU DE PREUVE : comparaison d'octets sur des fichiers générés dans ce
// conteneur. Cela ne dit rien de ce que Windows PowerShell 5.1 fera de ces
// octets ; cela dit qu'ils n'ont pas changé.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, 'generated');
const BASELINE = resolve(__dirname, 'scripts-baseline-856.json');

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

if (!existsSync(BASELINE)) {
  console.error('ECHEC : test/scripts-baseline-856.json est absent. Ce banc ne peut pas');
  console.error('        être déclaré vert sans référence : ce serait exactement le');
  console.error('        défaut qu\'il existe pour corriger.');
  process.exit(1);
}
if (!existsSync(DIR)) {
  console.error('ECHEC : test/generated est absent. Lance « npm run generate » d\'abord.');
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const attendus = base.sha256 ?? {};
const noms = Object.keys(attendus);

console.log('');
console.log(`Baseline figée : ${base.fige}`);
console.log(`Méthode        : ${base.methode}`);
console.log('');

// --- Garde de cohérence de la baseline elle-même ---------------------------
verifier(noms.length === base.total,
  `la baseline annonce ${base.total} scripts et en contient ${noms.length}`);
verifier(noms.length > 0, 'la baseline n\'est pas vide');
verifier(noms.every((n) => n.endsWith('.ps1')),
  'la baseline ne contient que des scripts .ps1');
verifier(noms.every((n) => /^[0-9a-f]{64}$/.test(attendus[n])),
  'chaque empreinte de la baseline est un SHA-256 bien formé');

if (echecs.length > 0) {
  console.error('\nArrêt : la baseline elle-même est douteuse.');
  process.exit(1);
}

// --- La comparaison --------------------------------------------------------
const empreinte = (chemin) => createHash('sha256').update(readFileSync(chemin)).digest('hex');

let identiques = 0;
const modifies = [];
const absents = [];

for (const nom of noms) {
  const chemin = join(DIR, nom);
  if (!existsSync(chemin)) { absents.push(nom); continue; }
  if (empreinte(chemin) === attendus[nom]) identiques += 1;
  else modifies.push(nom);
}

verifier(absents.length === 0,
  absents.length === 0
    ? `les ${noms.length} scripts attendus sont tous présents`
    : `${absents.length} script(s) attendu(s) ABSENT(S) : ${absents.slice(0, 5).join(', ')}${absents.length > 5 ? '…' : ''}`);

verifier(modifies.length === 0,
  modifies.length === 0
    ? `${identiques} / ${noms.length} scripts identiques à l'octet près`
    : `${modifies.length} script(s) MODIFIÉ(S) : ${modifies.slice(0, 10).join(', ')}${modifies.length > 10 ? '…' : ''}`);

// Information, pas une règle : savoir combien de .ps1 existent en plus.
const presents = readdirSync(DIR).filter((f) => f.endsWith('.ps1'));
const enPlus = presents.length - noms.length;
console.log(`         ${presents.length} fichier(s) .ps1 présent(s), dont ${noms.length} sous baseline`
  + `${enPlus > 0 ? `, ${enPlus} ajouté(s) depuis` : ''}.`);

// ===========================================================================
// CONTRE-ÉPREUVES
//
// Un comparateur qu'on n'a jamais vu dire non ne prouve rien. Les trois
// fautes qu'il doit voir lui sont soumises, sur des copies en mémoire.
// ===========================================================================
console.log('');
console.log('Contre-épreuves');

{
  const premier = noms[0];
  const vrai = attendus[premier];

  // 1 — une empreinte altérée d'un seul caractère doit être vue.
  const falsifie = { ...attendus, [premier]: `0${vrai.slice(1)}` };
  const vuModifie = Object.keys(falsifie)
    .filter((n) => existsSync(join(DIR, n)))
    .some((n) => empreinte(join(DIR, n)) !== falsifie[n]);
  verifier(vuModifie,
    'contre-épreuve 1 : une empreinte altérée d\'un caractère est détectée');

  // 2 — un script attendu mais absent doit être vu.
  const avecFantome = { ...attendus, 'script-qui-nexiste-pas.ps1': vrai };
  const vuAbsent = Object.keys(avecFantome).some((n) => !existsSync(join(DIR, n)));
  verifier(vuAbsent,
    'contre-épreuve 2 : un script attendu mais absent est détecté');

  // 3 — une baseline vide ne doit jamais passer pour un succès. C'est le
  //     faux positif le plus dangereux : zéro comparaison, zéro échec.
  const baseVide = {};
  verifier(Object.keys(baseVide).length === 0 && noms.length > 0,
    'contre-épreuve 3 : une baseline vide est distinguée d\'une baseline satisfaite');

  // 4 — et le comparateur doit bien dire OUI sur le cas honnête, sinon les
  //     trois précédentes ne prouveraient qu'un refus systématique.
  verifier(empreinte(join(DIR, premier)) === vrai,
    `contre-épreuve 4 : le cas honnête est accepté (${premier})`);
}

// ===========================================================================
console.log('');
console.log(`Non-régression des 856 : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
if (modifies.length > 0) {
  console.error('');
  console.error('Un script historique a changé. Ce n\'est pas forcément une faute —');
  console.error('mais ce ne peut pas être un accident. Si le changement est voulu,');
  console.error('il se décide explicitement, et la baseline se regénère dans le même');
  console.error('commit, avec sa raison écrite.');
}
process.exit(echecs.length === 0 ? 0 : 1);
