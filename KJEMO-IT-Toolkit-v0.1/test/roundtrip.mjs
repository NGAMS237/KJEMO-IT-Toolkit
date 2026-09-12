#!/usr/bin/env node
/**
 * roundtrip.mjs — LOT 0 · KJEMO IT Toolkit
 * -----------------------------------------------
 * Aller-retour RÉEL  JS → .ps1 (avec BOM) → PowerShell → JSON → JS.
 *
 * Ce module est le SEUL endroit où le Base64 est calculé : il importe psB64()
 * depuis dist/generators.mjs (le module canonique). PowerShell ne recalcule
 * jamais le Base64 — il se contente d'exécuter les expressions produites ici.
 *
 * Deux modes :
 *   node test/roundtrip.mjs emit   <dir>   → écrit <dir>/roundtrip.ps1 (BOM EF BB BF)
 *                                                  <dir>/roundtrip-expected.json
 *   node test/roundtrip.mjs verify <dir>   → compare <dir>/roundtrip-actual.json
 *                                            avec les valeurs d'origine, octet par octet
 *
 * Exit 0 = tout OK, exit 1 = au moins un ÉCHEC.
 */

import { writeFileSync, readFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname, resolve }  from 'node:path';
import { fileURLToPath }     from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// psB64 vient du module canonique — aucune réimplémentation ici.
const { psB64 } = await import(resolve(ROOT, 'dist', 'generators.mjs'));

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

// ---------------------------------------------------------------------------
// Jeu de valeurs — exactement celles exigées par la revue
// ---------------------------------------------------------------------------
export const CASES = [
  { key: 'case01', label: "O'Brien (apostrophe ASCII U+0027)", value: "O'Brien" },
  { key: 'case02', label: 'O’Brien (apostrophe typographique U+2019)', value: 'O’Brien' },
  { key: 'case03', label: 'O‘Brien (apostrophe gauche U+2018)', value: 'O‘Brien' },
  { key: 'case04', label: "L'été d'André (accents + apostrophes ASCII)", value: "L'été d'André" },
  { key: 'case05', label: 'Apostrophe ASCII seule', value: "'" },
  { key: 'case06', label: 'Guillemets droits', value: 'Say "hello" now' },
  { key: 'case07', label: 'Dollar (variable PS)', value: '$SYSTEM_VARIABLE $env:PATH' },
  { key: 'case08', label: 'Backtick (échappement PS)', value: 'test`back`tick' },
  { key: 'case09', label: 'Retour à la ligne LF', value: 'ligne1\nligne2' },
  { key: 'case10', label: 'Chemin UNC', value: '\\\\SRV-BN01\\Partages$\\Comptabilité' },
  { key: 'case11', label: 'RDN LDAP avec virgule', value: 'OU=Finance\\, Nord' },
  { key: 'case12', label: 'RDN LDAP avec plus', value: 'Direction + Ops' },
  { key: 'case13', label: 'Combiné : égal, dièse, point-virgule', value: '#Test=1;2' },
  { key: 'case14', label: 'Apostrophes ASCII + typographiques mélangées', value: "O'Brien & O’Brien & O‘Brien" },
];

const mode = process.argv[2];
const dir  = process.argv[3];

if (!mode || !dir) {
  console.error('Usage : node test/roundtrip.mjs <emit|verify> <dir>');
  process.exit(2);
}

mkdirSync(dir, { recursive: true });

const PS1_PATH      = resolve(dir, 'roundtrip.ps1');
const EXPECTED_PATH = resolve(dir, 'roundtrip-expected.json');
const ACTUAL_PATH   = resolve(dir, 'roundtrip-actual.json');

// ---------------------------------------------------------------------------
// MODE emit — Node produit le .ps1 avec BOM
// ---------------------------------------------------------------------------
if (mode === 'emit') {
  const lines = [
    '# roundtrip.ps1 — GÉNÉRÉ PAR node test/roundtrip.mjs emit — NE PAS ÉDITER',
    '# Les expressions Base64 ci-dessous proviennent de psB64() dans dist/generators.mjs.',
    '# PowerShell ne calcule aucun Base64 : il décode seulement ce que Node a produit.',
    '',
    '$ErrorActionPreference = \'Stop\'',
    '$Result = [ordered]@{}',
  ];

  for (const c of CASES) {
    // psB64() du module canonique — c'est LUI qui est testé
    lines.push(`$Result['${c.key}'] = ${psB64(c.value)}`);
  }

  lines.push(
    '',
    '$OutPath = $args[0]',
    'if (-not $OutPath) { throw "Chemin de sortie manquant (argument 1)" }',
    '$Json = ConvertTo-Json -InputObject $Result -Depth 3 -Compress',
    '$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)',
    '[System.IO.File]::WriteAllText($OutPath, $Json, $Utf8NoBom)',
    'Write-Host "roundtrip.ps1 : $($Result.Count) valeurs écrites dans $OutPath"',
    '',
  );

  const body = Buffer.from(lines.join('\r\n'), 'utf-8');
  writeFileSync(PS1_PATH, Buffer.concat([BOM, body]));

  // Vérifier les 3 premiers octets sur le fichier réellement écrit
  const head = Buffer.alloc(3);
  const fd = openSync(PS1_PATH, 'r');
  readSync(fd, head, 0, 3, 0);
  closeSync(fd);
  if (!head.equals(BOM)) {
    console.error(`[FAIL] BOM absent de ${PS1_PATH} — premiers octets : ${head.toString('hex')}`);
    process.exit(1);
  }

  const expected = Object.fromEntries(CASES.map((c) => [c.key, c.value]));
  writeFileSync(EXPECTED_PATH, JSON.stringify(expected, null, 2), 'utf-8');

  console.log(`[OK]   ${PS1_PATH} écrit — BOM EF BB BF vérifié, ${CASES.length} cas`);
  console.log(`[OK]   ${EXPECTED_PATH} écrit`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// MODE verify — comparaison octet par octet des valeurs revenues de PowerShell
// ---------------------------------------------------------------------------
if (mode === 'verify') {
  let actual;
  try {
    actual = JSON.parse(readFileSync(ACTUAL_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[FAIL] Lecture de ${ACTUAL_PATH} impossible : ${err.message}`);
    process.exit(1);
  }

  let ok = 0;
  let ko = 0;

  for (const c of CASES) {
    const got = actual[c.key];
    if (got === undefined) {
      console.error(`  [FAIL] ${c.key} — ${c.label} : clé absente du JSON PowerShell`);
      ko++;
      continue;
    }
    const expBuf = Buffer.from(c.value, 'utf-8');
    const gotBuf = Buffer.from(String(got), 'utf-8');
    if (expBuf.equals(gotBuf)) {
      console.log(`  [OK]   ${c.key} — ${c.label}`);
      ok++;
    } else {
      console.error(`  [FAIL] ${c.key} — ${c.label}`);
      console.error(`         attendu (UTF-8) : ${expBuf.toString('hex')}`);
      console.error(`         obtenu  (UTF-8) : ${gotBuf.toString('hex')}`);
      console.error(`         attendu (texte) : ${JSON.stringify(c.value)}`);
      console.error(`         obtenu  (texte) : ${JSON.stringify(String(got))}`);
      ko++;
    }
  }

  // Garde-fou explicite exigé par la revue :
  // le test DOIT échouer si O’Brien (U+2019) devient O'Brien (U+0027).
  const typo  = actual['case02'];
  const ascii = actual['case01'];
  if (typo !== undefined && String(typo) === "O'Brien") {
    console.error("  [FAIL] case02 : O’Brien (U+2019) a été transformé en O'Brien (U+0027)");
    ko++;
  } else if (typo !== undefined) {
    console.log('  [OK]   case02 : U+2019 n’a PAS été converti en U+0027');
    ok++;
  }
  if (typo !== undefined && ascii !== undefined && String(typo) === String(ascii)) {
    console.error('  [FAIL] case01 et case02 sont identiques — les deux apostrophes ont été confondues');
    ko++;
  } else if (typo !== undefined && ascii !== undefined) {
    console.log('  [OK]   case01 ≠ case02 — les deux apostrophes restent distinctes');
    ok++;
  }

  console.log('');
  console.log(`Aller-retour JS → PS1 → PowerShell → JSON : ${ok} OK, ${ko} ÉCHEC(S).`);
  process.exit(ko > 0 ? 1 : 0);
}

console.error(`Mode inconnu : ${mode}`);
process.exit(2);
