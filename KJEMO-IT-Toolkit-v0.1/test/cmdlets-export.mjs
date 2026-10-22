#!/usr/bin/env node
/**
 * cmdlets-export.mjs — exporte l'inventaire déclaratif vers JSON.
 *
 * Le banc PowerShell qui analyse les scripts générés a besoin de la même
 * liste que le code JavaScript. Plutôt que d'en tenir deux, on exporte celle
 * de dist/cmdlets.mjs : une seule source, et une divergence impossible.
 *
 * Usage : node test/cmdlets-export.mjs [chemin de sortie]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { CMDLETS_EXTERNES, BINAIRES_EXTERNES, CMDLETS_INTERDITES } =
  await import(pathToFileURL(resolve(ROOT, 'dist', 'cmdlets.mjs')).href);
const { tools: catalogueComplet } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);
// Les fichiers .ios.txt (RESEAU-CISCO-01) ne sont pas du PowerShell : hors inventaire.
const tools = catalogueComplet.filter((t) => t.output !== '.ios.txt');

const sortie = resolve(ROOT, process.argv[2] ?? 'test/generated/cmdlets-autorisees.json');
mkdirSync(dirname(sortie), { recursive: true });

// Quelles commandes chaque outil emploie réellement, d'après son script par
// défaut. C'est indicatif : le banc PowerShell fait foi, parce qu'il lit la
// grammaire et non une expression régulière.
const parOutil = {};
const motif = /(?:^|[\s|({=;])([A-Z][A-Za-z]+-[A-Za-z0-9]+)\b/gm;
for (const outil of tools) {
  const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  let script = '';
  try { script = outil.generate(valeurs); } catch { continue; }
  const vues = new Set();
  let m;
  motif.lastIndex = 0;
  while ((m = motif.exec(script)) !== null) {
    if (Object.prototype.hasOwnProperty.call(CMDLETS_EXTERNES, m[1])) vues.add(m[1]);
  }
  parOutil[outil.id] = [...vues].sort();
}

const rapport = {
  genere: new Date().toISOString(),
  cmdlets: CMDLETS_EXTERNES,
  binaires: BINAIRES_EXTERNES,
  interdites: CMDLETS_INTERDITES,
  parOutil,
};

writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n', 'utf-8');
console.log(`Inventaire exporté : ${sortie}`);
console.log(`  ${Object.keys(CMDLETS_EXTERNES).length} applets de commande déclarées`);
console.log(`  ${Object.keys(BINAIRES_EXTERNES).length} binaires Windows déclarés`);
console.log(`  ${Object.keys(CMDLETS_INTERDITES).length} commandes explicitement bannies`);
console.log(`  ${Object.keys(parOutil).length} outils inventoriés`);
