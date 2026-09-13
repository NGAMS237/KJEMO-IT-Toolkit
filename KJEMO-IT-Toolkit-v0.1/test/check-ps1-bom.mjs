#!/usr/bin/env node
/**
 * check-ps1-bom.mjs — LOT 0 · KJEMO IT Toolkit
 * -----------------------------------------------
 * Garde-fou : tout script .ps1 de scripts/ destiné à être exécuté par
 * Windows PowerShell 5.1 DOIT commencer par le BOM UTF-8 (EF BB BF).
 *
 * Pourquoi : sans BOM, PS 5.1 lit le fichier avec la page de codes ANSI
 * (CP1252 sur les runners GitHub). Les séquences UTF-8 multi-octets sont alors
 * mal décodées, et surtout certains octets de continuation deviennent des
 * caractères que PowerShell traite comme des DÉLIMITEURS DE CHAÎNE :
 *
 *   —  U+2014 tiret cadratin  = E2 80 94  →  octet 94 = U+201D  (guillemet)
 *   →  U+2192 flèche droite   = E2 86 92  →  octet 92 = U+2019  (apostrophe)
 *
 * Un tiret cadratin à l'intérieur d'une chaîne à guillemets doubles termine
 * donc la chaîne prématurément et corrompt l'analyse syntaxique de tout le
 * reste du fichier.
 *
 * Ce contrôle s'exécute AVANT l'exécution PS 5.1 dans validate.yml.
 *
 * Usage : node test/check-ps1-bom.mjs
 * Exit 0 = tous les scripts ont le BOM, exit 1 = au moins un sans BOM.
 */

import { readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname, resolve }                          from 'node:path';
import { fileURLToPath }                             from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const ROOT        = resolve(__dirname, '..');
const SCRIPTS_DIR = resolve(ROOT, 'scripts');

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

function firstThreeBytes(path) {
  const buf = Buffer.alloc(3);
  const fd  = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, 3, 0);
  } finally {
    closeSync(fd);
  }
  return buf;
}

let ok = 0;
let ko = 0;

const files = readdirSync(SCRIPTS_DIR).filter((f) => f.toLowerCase().endsWith('.ps1')).sort();

if (files.length === 0) {
  console.error(`[FAIL] Aucun .ps1 trouvé dans ${SCRIPTS_DIR}`);
  process.exit(1);
}

console.log('Contrôle du BOM UTF-8 (EF BB BF) sur les scripts PowerShell :');

for (const name of files) {
  const path = resolve(SCRIPTS_DIR, name);
  const head = firstThreeBytes(path);
  const hex  = [...head].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  if (head.equals(BOM)) {
    console.log(`  [OK]    ${name} — ${hex}`);
    ok++;
  } else {
    console.error(`  [FAIL]  ${name} — premiers octets ${hex} au lieu de EF BB BF`);
    console.error(`          Windows PowerShell 5.1 lira ce fichier en CP1252 et l'analyse échouera.`);
    ko++;
  }
}

console.log('');
console.log(`BOM UTF-8 : ${ok} OK, ${ko} ÉCHEC(S).`);
process.exit(ko > 0 ? 1 : 0);
