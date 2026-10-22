#!/usr/bin/env node
/**
 * matrices-cisco.mjs — RESEAU-CISCO-01
 * Photographie du catalogue Cisco : outils, fichiers générés (par mode et
 * présentation), commandes IOS distinctes. Écrit ou vérifie
 *   RESEAU-CISCO-01-MATRICE-OUTILS.json / -FICHIERS.json / -COMMANDES.json
 *   docs/CATALOGUE-19-ASSISTANTS-CISCO.md
 * Usage : node test/matrices-cisco.mjs [--verifier]
 * Ce sont des matrices de GÉNÉRATION : aucune commande n'a été exécutée.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFIER = process.argv.includes('--verifier');
const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const cisco = tools.filter((t) => t.category === 'Réseau et Cisco');
const SPEC = { 'cisco-identification': { ciscoNouveauNom: 'SW-LAB-02' }, 'cisco-table-mac': { ciscoEffacement: 'interface' }, 'cisco-vtp-configuration': { ciscoVtpRevisionLue: true } };
const def = (t) => Object.fromEntries(t.fields.map((f) => [f.id, f.type === 'checkbox' ? Boolean(f.default) : String(f.default ?? '')]));
const phrase = (t, v) => /« (.+?) »/.exec(t.validate({ ...v, ciscoMode: 'Configuration', ciscoConfirmation: '' }).ciscoConfirmation ?? '')?.[1] ?? '';

const outils = []; const fichiers = []; const commandes = new Map();
for (const t of cisco) {
  const mod = t.fields.some((f) => f.id === 'ciscoMode');
  outils.push({ id: t.id, sousRubrique: t.subcategory, risque: t.risk, modifie: mod, reversible: t.reversible, champs: t.fields.map((f) => f.id), sources: t.sources.length });
  for (const mode of mod ? ['Lecture', 'Configuration'] : ['Lecture']) for (const pres of ['Commente', 'Commandes seules']) {
    const v = { ...def(t), ...(SPEC[t.id] ?? {}), ciscoPresentation: pres };
    if (mod) { v.ciscoMode = mode; v.ciscoConfirmation = mode === 'Configuration' ? phrase(t, v) : ''; }
    const s = t.generate(v);
    fichiers.push({ id: t.id, mode, presentation: pres, octets: Buffer.byteLength(s), sha256: createHash('sha256').update(s).digest('hex') });
    for (const l of s.split('\n')) if (l && !l.startsWith('!')) {
      const k = l.trim().replace(/\d+(\.\d+){3}/g, '<ip>').split(/\s+/).slice(0, 3).join(' ');
      commandes.set(k, (commandes.get(k) ?? 0) + 1);
    }
  }
}
const lignesCommandes = [...commandes].sort((a, b) => a[0].localeCompare(b[0])).map(([forme, n]) => ({ forme, occurrences: n }));
const sortie = {
  'RESEAU-CISCO-01-MATRICE-OUTILS.json': outils,
  'RESEAU-CISCO-01-MATRICE-FICHIERS.json': fichiers,
  'RESEAU-CISCO-01-MATRICE-COMMANDES.json': lignesCommandes,
};
const doc = `# Catalogue — 19 assistants Cisco IOS (RESEAU-CISCO-01)

Généré par \`node test/matrices-cisco.mjs\`. Ce sont des assistants de **génération** : ils ne se connectent à rien,
n'exécutent rien. Packet Tracer et commutateur réel : **NON EXÉCUTÉ**. Matériel de référence documentaire : Cisco C1000-24T-4G-L (non testé).

| Identifiant | Sous-rubrique | Modifie | Risque |
|---|---|---|---|
${outils.map((o) => `| ${o.id} | ${o.sousRubrique} | ${o.modifie ? 'oui (mode + phrase)' : 'non (lecture)'} | ${o.risque} |`).join('\n')}

${fichiers.length} fichiers de référence (mode × présentation), ${lignesCommandes.length} formes de commande distinctes.
`;
let ecarts = 0;
for (const [f, d] of [...Object.entries(sortie), ['docs/CATALOGUE-19-ASSISTANTS-CISCO.md', doc]]) {
  const txt = typeof d === 'string' ? d : `${JSON.stringify(d, null, 2)}\n`;
  const chemin = resolve(ROOT, f);
  if (VERIFIER) {
    let cur = ''; try { cur = readFileSync(chemin, 'utf8'); } catch { /* absent */ }
    console.log(`  [${cur === txt ? 'OK' : 'FAIL'}]    ${f}`); if (cur !== txt) ecarts++;
  } else { writeFileSync(chemin, txt); console.log(`écrit : ${f}`); }
}
console.log(`outils=${cisco.length} fichiers=${fichiers.length} formes de commande=${lignesCommandes.length}`);
process.exit(ecarts ? 1 : 0);
