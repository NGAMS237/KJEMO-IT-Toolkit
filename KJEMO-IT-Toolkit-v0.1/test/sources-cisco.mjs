#!/usr/bin/env node
/**
 * sources-cisco.mjs — RESEAU-CISCO-01
 * Contrôle des sources cisco.com citées par les assistants Cisco.
 *
 *  - HORS LIGNE (toujours) : forme des URL, unicité, présence de chaque source
 *    de fiche dans le registre, cohérence avec RESEAU-CISCO-01-SOURCES.json.
 *  - EN LIGNE (--en-ligne) : tente un GET direct. cisco.com refuse souvent les
 *    clients automatiques (403 « Access Denied ») : ce cas est rapporté NON
 *    VÉRIFIÉ EN LIGNE, jamais PASS. Le fichier JSON consigne la vérification
 *    manuelle par lecture web, avec ses URL « non confirmées ».
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { SRC, toutesLesSources } = await import(pathToFileURL(resolve(ROOT, 'dist/sources-cisco.mjs')).href);
const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const enLigne = process.argv.includes('--en-ligne');
let ok = 0; let ko = 0;
const assert = (c, m) => { if (c) { ok++; console.log(`  [OK]    ${m}`); } else { ko++; console.log(`  [FAIL]  ${m}`); } };

const reg = JSON.parse(readFileSync(resolve(ROOT, 'RESEAU-CISCO-01-SOURCES.json'), 'utf8'));
const urls = toutesLesSources().map((s) => s.url);
assert(urls.length === Object.keys(SRC).length && new Set(urls).size === urls.length, `${urls.length} sources, URL distinctes`);
assert(urls.every((u) => /^https:\/\/www\.cisco\.com\/c\/en\/us\/\S+\.html$/.test(u)), 'toutes sur des pages précises de cisco.com');
assert(reg.sources.length === urls.length && reg.sources.every((s) => urls.includes(s.url) && SRC[s.cle]?.url === s.url), 'le fichier de vérification couvre exactement le registre');
const citees = new Set(tools.filter((t) => t.category === 'Réseau et Cisco').flatMap((t) => [t.source, ...t.sources.map((s) => s.url)]));
assert([...citees].every((u) => urls.includes(u)) && urls.every((u) => citees.has(u)), 'chaque source du registre est citée, et chaque source citée est au registre');
const conf = reg.sources.filter((s) => s.statut === 'confirmee').length;
console.log(`\nVérification manuelle consignée : ${conf} confirmée(s), ${reg.sources.length - conf} NON confirmée(s).`);
assert(reg.sources.every((s) => s.statut === 'confirmee' || s.statut === 'non confirmee'), 'statuts valides (jamais « ok » implicite)');

if (enLigne) {
  console.log('\n--- Essai en ligne (peut être refusé par cisco.com) ---');
  let refus = 0;
  for (const u of urls) {
    try {
      const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (KJEMO source check)' } });
      const t = await r.text();
      const titre = (/<title>([^<]*)/i.exec(t) ?? [])[1] ?? '';
      if (r.status === 403 || /access denied/i.test(titre)) { refus++; console.log(`  [NON VÉRIFIÉ EN LIGNE] ${u} (HTTP ${r.status}, « ${titre} »)`); }
      else assert(r.status === 200 && !/not found|404/i.test(titre), `${u} → ${r.status} « ${titre} »`);
    } catch (e) { refus++; console.log(`  [NON VÉRIFIÉ EN LIGNE] ${u} (${e.message})`); }
  }
  console.log(`${refus}/${urls.length} source(s) NON VÉRIFIÉE(S) en ligne par script.`);
} else {
  console.log('Contrôle en ligne par script : NON EXÉCUTÉ (option --en-ligne).');
}
console.log(`\nSources Cisco : ${ok} OK, ${ko} ÉCHEC(S).`);
process.exit(ko ? 1 : 0);
