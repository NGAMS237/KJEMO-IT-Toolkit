#!/usr/bin/env node
/**
 * generate-ps1.mjs — LOT 0 · KJEMO IT Toolkit
 * -----------------------------------------------
 * Génère les fichiers .ps1 canoniques pour chaque assistant × jeu de données.
 * Utilisé par la CI et par identity.test.mjs.
 *
 * Usage : node test/generate-ps1.mjs
 * Sortie : test/generated/<id>__<dataset>.ps1   (64 fichiers)
 *          test/generated/report.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve }         from 'node:path';
import { fileURLToPath }            from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const OUT_DIR   = resolve(ROOT, 'test', 'generated');

const { tools, normalizeScript } = await import(resolve(ROOT, 'dist', 'generators.mjs'));

mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Jeux de données communs (par field.id, overrides)
// ---------------------------------------------------------------------------
const DATASETS = [
  { name: 'default', values: {} },
  {
    name: 'apostrophe-ascii',
    values: {
      adapter: "Ethernet D'Adam", share: "Données-D'Adam", path: "C:\\Users\\D'Adam",
      firstName: "D'Arcy", lastName: "O'Brien", ou: "Direction-D'Adam",
      domain: 'hopitalbn.lan', group: "GG-D'Adam-RW",
    },
  },
  {
    name: 'apostrophe-typographique',
    values: {
      adapter: 'Ethernet D\u2019Adam', share: 'Donn\u00e9es-D\u2019Adam',
      path: 'C:\\Users\\D\u2019Adam', firstName: 'D\u2019Arcy', lastName: 'O\u2019Brien',
      ou: 'Direction-D\u2019Adam', domain: 'hopitalbn.lan', group: 'GG-D\u2019Adam-RW',
    },
  },
  {
    name: 'dollar-backtick-guillemets',
    values: {
      adapter: 'Ethernet $special', share: 'Share`Test', path: 'C:\\Users\\Test"Dir',
      firstName: 'Jean-$special', lastName: 'Tremblay`test', ou: 'Test-Special',
      domain: 'hopitalbn.lan', group: 'GG-Test-RW',
    },
  },
  {
    name: 'espaces-et-accents',
    values: {
      adapter: 'Adaptateur Wi-Fi', share: 'Données Éléonore',
      path: 'C:\\Users\\L\u00e9vesque-Tr\u00e9panier', firstName: '\u00c9l\u00e9onore',
      lastName: 'L\u00e9vesque-Tr\u00e9panier', ou: 'Bureau \u00c9l\u00e9vation',
      domain: 'hopitalbn.lan', group: 'GG-Comptabilit\u00e9-RW',
    },
  },
  {
    name: 'virgule-et-point-virgule',
    values: {
      adapter: 'Ethernet,1', share: 'Partage;Test', path: 'C:\\Data,files;here',
      firstName: 'Marie,Anne', lastName: 'Tr;emblay', ou: 'Test,OU',
      domain: 'hopitalbn.lan', group: 'GG-Test,RW',
    },
  },
  {
    name: 'chemin-racine-c',
    values: {
      path: 'C:\\', share: 'RacineC',
      adapter: 'Ethernet', firstName: 'Marie', lastName: 'Tremblay',
      ou: 'Employes', domain: 'hopitalbn.lan', group: 'GG-Test-RW',
    },
  },
  {
    name: 'chemin-avec-apostrophe',
    values: {
      path: "C:\\Users\\O'Brien\\Documents", share: 'OBrien',
      adapter: 'Ethernet', firstName: 'Marie', lastName: "O'Brien",
      ou: 'Employes', domain: 'hopitalbn.lan', group: 'GG-Test-RW',
    },
  },
];

const report = { generated: [], errors: [] };

for (const tool of tools) {
  const defaults = Object.fromEntries(tool.fields.map((f) => [f.id, String(f.default ?? '')]));

  for (const dataset of DATASETS) {
    // Merge defaults + dataset overrides (uniquement les fields que l'outil a)
    const values = {};
    for (const f of tool.fields) {
      values[f.id] = dataset.values[f.id] !== undefined ? dataset.values[f.id] : defaults[f.id];
    }

    let content;
    try {
      content = normalizeScript(tool.generate(values));
    } catch (err) {
      report.errors.push({ tool: tool.id, dataset: dataset.name, error: String(err) });
      console.error(`[ERR] ${tool.id} / ${dataset.name} : ${err}`);
      continue;
    }

    const filename = `${tool.id}__${dataset.name}.ps1`;
    const outPath  = resolve(OUT_DIR, filename);
    writeFileSync(outPath, content, 'utf-8');
    report.generated.push({ tool: tool.id, dataset: dataset.name, file: filename, bytes: content.length });
  }
}

writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');

console.log('');
console.log(`${report.generated.length} fichiers générés, ${report.errors.length} erreur(s) JS.`);
if (report.errors.length > 0) {
  console.error('Erreurs :');
  report.errors.forEach((e) => console.error(`  [${e.tool}/${e.dataset}] ${e.error}`));
  process.exit(1);
}
