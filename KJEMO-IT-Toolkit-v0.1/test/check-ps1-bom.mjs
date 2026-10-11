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
 * Il couvre DEUX dossiers :
 *   - scripts/        : les scripts versionnés du dépôt;
 *   - test/generated/ : les .ps1 produits par test/generate-ps1.mjs, quand ce
 *                       dossier existe. C'est le gros du volume — plus de huit
 *                       cents fichiers — et c'est exactement ce que Windows
 *                       PowerShell 5.1 va analyser dans la CI. Ne contrôler
 *                       que scripts/ laissait ce volume hors de la garde.
 *
 * Usage : node test/check-ps1-bom.mjs
 * Exit 0 = tous les scripts ont le BOM, exit 1 = au moins un sans BOM.
 */

import { readdirSync, openSync, readSync, closeSync,
         mkdtempSync, writeFileSync, rmSync }        from 'node:fs';
import { dirname, resolve, join }                    from 'node:path';
import { fileURLToPath }                             from 'node:url';
import { tmpdir }                                    from 'node:os';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const ROOT        = resolve(__dirname, '..');
const SCRIPTS_DIR   = resolve(ROOT, 'scripts');
const GENERATED_DIR = resolve(ROOT, 'test', 'generated');

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

function listerPs1(dossier) {
  try {
    return readdirSync(dossier).filter((f) => f.toLowerCase().endsWith('.ps1')).sort();
  } catch {
    return null;   // dossier absent
  }
}

const dossiers = [
  { chemin: SCRIPTS_DIR,   nom: 'scripts/',        obligatoire: true,  detailler: true },
  // test/generated/ n'existe qu'après « npm run generate ». Son absence n'est
  // pas un défaut ; un script sans BOM dedans en est un.
  { chemin: GENERATED_DIR, nom: 'test/generated/', obligatoire: false, detailler: false },
];

console.log('Contrôle du BOM UTF-8 (EF BB BF) sur les scripts PowerShell :');

for (const d of dossiers) {
  const files = listerPs1(d.chemin);
  if (files === null) {
    if (d.obligatoire) {
      console.error(`  [FAIL]  ${d.nom} — dossier introuvable`);
      ko++;
    } else {
      console.log(`  [INFO]  ${d.nom} — absent : lancer « npm run generate » pour l'inclure au contrôle`);
    }
    continue;
  }
  if (files.length === 0) {
    if (d.obligatoire) {
      console.error(`  [FAIL]  ${d.nom} — aucun .ps1 trouvé`);
      ko++;
    } else {
      console.log(`  [INFO]  ${d.nom} — aucun .ps1`);
    }
    continue;
  }

  let okDossier = 0;
  for (const name of files) {
    const path = resolve(d.chemin, name);
    const head = firstThreeBytes(path);
    const hex  = [...head].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    if (head.equals(BOM)) {
      if (d.detailler) console.log(`  [OK]    ${d.nom}${name} — ${hex}`);
      okDossier++;
      ok++;
    } else {
      console.error(`  [FAIL]  ${d.nom}${name} — premiers octets ${hex} au lieu de EF BB BF`);
      console.error(`          Windows PowerShell 5.1 lira ce fichier en CP1252 et l'analyse échouera.`);
      ko++;
    }
  }
  if (!d.detailler) {
    console.log(`  [OK]    ${d.nom} — ${okDossier}/${files.length} fichier(s) avec BOM`);
  }
}

// ---------------------------------------------------------------------------
// CONTRE-ÉPREUVE
//
// Un contrôle qui ne trouve jamais rien ressemble à un contrôle qui passe. On
// écrit donc un .ps1 SANS BOM dans un dossier temporaire et on vérifie que la
// comparaison le rejette. Si elle l'accepte, c'est le contrôle qui est en
// panne, et ce banc doit échouer même quand tout le dépôt est sain.
// ---------------------------------------------------------------------------
{
  const bac = mkdtempSync(join(tmpdir(), 'kjemo-bom-'));
  try {
    const sansBom = join(bac, 'sans-bom.ps1');
    writeFileSync(sansBom, "Write-Host 'un tiret cadratin : —'", 'utf-8');
    const avecBom = join(bac, 'avec-bom.ps1');
    writeFileSync(avecBom, '\uFEFF' + "Write-Host 'un tiret cadratin : —'", 'utf-8');

    const teteSans = firstThreeBytes(sansBom);
    const teteAvec = firstThreeBytes(avecBom);

    if (!teteSans.equals(BOM)) {
      console.log('  [OK]    contre-épreuve — un .ps1 sans BOM EST rejeté');
      ok++;
    } else {
      console.error('  [FAIL]  contre-épreuve — un .ps1 sans BOM passe le contrôle');
      ko++;
    }
    if (teteAvec.equals(BOM)) {
      console.log('  [OK]    contre-épreuve — un .ps1 avec BOM est bien accepté');
      ok++;
    } else {
      console.error('  [FAIL]  contre-épreuve — un .ps1 avec BOM est rejeté à tort');
      ko++;
    }
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

console.log('');
console.log(`BOM UTF-8 : ${ok} OK, ${ko} ÉCHEC(S).`);
process.exit(ko > 0 ? 1 : 0);
