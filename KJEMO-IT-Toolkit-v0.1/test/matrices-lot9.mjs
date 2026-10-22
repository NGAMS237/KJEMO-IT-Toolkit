#!/usr/bin/env node
/**
 * matrices-lot9.mjs — LOT 9 Imprimantes
 * Photographie du catalogue Imprimantes : outils, scripts générés (par mode et
 * variante), commandes appelées, risques. Écrit ou vérifie
 *   LOT-9-MATRICE-OUTILS.json / LOT-9-MATRICE-SCRIPTS.json / LOT-9-MATRICE-COMMANDES.json
 *   docs/CATALOGUE-15-ASSISTANTS-IMPRIMANTES.md
 * Les matrices des lots précédents ne sont ni lues ni réécrites ici.
 * Usage : node test/matrices-lot9.mjs [--verifier]
 * Ce sont des matrices de GÉNÉRATION : aucun script n'a été exécuté sur une vraie imprimante.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFIER = process.argv.includes('--verifier');
const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const imp = tools.filter((t) => t.category === 'Imprimantes');
const def = (t) => Object.fromEntries(t.fields.map((f) => [f.id, String(f.default ?? '')]));
const phrase = (t, v) => {
  const e = t.validate({ ...v, impMode: 'Appliquer', impConfirmation: 'x' }).impConfirmation ?? '';
  return (/« (.+?) »/.exec(e) ?? /recopie exactement : (.+)$/.exec(e) ?? [])[1] ?? '';
};
const sha = (s) => createHash('sha256').update(s).digest('hex');

const outils = []; const scripts = []; const commandes = new Map();
for (const t of imp) {
  const agit = t.fields.some((f) => f.id === 'impConfirmation');
  const variantes = t.id === 'imp-cups-reactiver-file' ? [['impAction', 'Reactiver'], ['impAction', 'Accepter']] : [[null, null]];
  outils.push({ id: t.id, sousRubrique: t.subcategory, os: t.os.length, risque: t.risk, modifie: agit, reversible: t.reversible,
    champs: t.fields.map((f) => f.id), sources: t.sources.length, admin: Boolean(t.requiresAdmin) });
  for (const [k, val] of variantes) for (const mode of agit ? ['Diagnostic', 'Appliquer'] : ['Diagnostic']) {
    const v = { ...def(t), ...(k ? { [k]: val } : {}) };
    if (t.fields.some((f) => f.id === 'impMode')) { v.impMode = mode; v.impConfirmation = mode === 'Appliquer' ? phrase(t, v) : ''; }
    else if (agit) v.impConfirmation = mode === 'Appliquer' ? phrase(t, v) : '';
    const s = t.generate(v);
    scripts.push({ id: t.id, variante: val ?? '-', mode, octets: Buffer.byteLength(s), sha256: sha(s) });
    for (const m of s.matchAll(/\b(Get|Add|Remove|Restart|Invoke|Set)-[A-Za-z]+\b|(?:^|[\s;(])(lpstat|cancel|cupsenable|cupsaccept|cupsdisable|cupsreject|lpadmin|cupsctl|lprm|lpmove)(?=\s)/gm)) {
      const n = (m[0] ?? '').trim().replace(/^[;(]/, '');
      if (/^(Get|Add|Remove|Restart|Invoke|Set)-(Kjemo|Content)/i.test(n) || /^(Add|Invoke)-Kjemo/.test(n)) continue;
      commandes.set(n, (commandes.get(n) ?? 0) + 1);
    }
  }
}
const lignesCommandes = [...commandes].sort((a, b) => a[0].localeCompare(b[0])).map(([commande, occurrences]) => ({ commande, occurrences }));
const sortie = {
  'LOT-9-MATRICE-OUTILS.json': outils,
  'LOT-9-MATRICE-SCRIPTS.json': scripts,
  'LOT-9-MATRICE-COMMANDES.json': lignesCommandes,
};
const doc = `# Catalogue — 15 assistants Imprimantes (LOT 9)

Généré par \`node test/matrices-lot9.mjs\`. Ce sont des assistants de **génération** : le site n'exécute rien.
Aucun script n'a été exécuté sur une vraie imprimante, un vrai spouleur Windows ou un vrai CUPS (**NON EXÉCUTÉ**) :
les bancs utilisent des doublures. Windows PowerShell 5.1 : **NON EXÉCUTÉ**.

| Identifiant | Sous-rubrique | Modifie | Risque |
|---|---|---|---|
${outils.map((o) => `| ${o.id} | ${o.sousRubrique} | ${o.modifie ? 'oui (mode + phrase exacte)' : 'non (lecture)'} | ${o.risque} |`).join('\n')}

${scripts.length} scripts de référence (outil × variante × mode), ${lignesCommandes.length} commandes distinctes appelées.
`;
let ecarts = 0;
for (const [f, d] of [...Object.entries(sortie), ['docs/CATALOGUE-15-ASSISTANTS-IMPRIMANTES.md', doc]]) {
  const txt = typeof d === 'string' ? d : `${JSON.stringify(d, null, 2)}\n`;
  const chemin = resolve(ROOT, f);
  if (VERIFIER) {
    let cur = ''; try { cur = readFileSync(chemin, 'utf8'); } catch { /* absent */ }
    console.log(`  [${cur === txt ? 'OK' : 'FAIL'}]    ${f}`); if (cur !== txt) ecarts++;
  } else { writeFileSync(chemin, txt); console.log(`écrit : ${f}`); }
}
console.log(`outils=${imp.length} scripts=${scripts.length} commandes=${lignesCommandes.length}`);
process.exit(ecarts ? 1 : 0);
