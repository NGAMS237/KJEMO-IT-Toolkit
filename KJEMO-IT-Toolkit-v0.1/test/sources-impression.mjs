#!/usr/bin/env node
/**
 * sources-impression.mjs — LOT 9 : les sources citées par les fiches Imprimantes
 * sont exactement celles du registre LOT-9-SOURCES.json, sur des domaines officiels
 * (learn.microsoft.com, openprinting.github.io). HORS LIGNE : la vérification de
 * l'existence des pages a été faite par lecture web et consignée dans le JSON.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
let ok = 0; let ko = 0;
const assert = (c, m) => { if (c) { ok++; console.log(`  [OK]    ${m}`); } else { ko++; console.log(`  [FAIL]  ${m}`); } };
const reg = JSON.parse(readFileSync(resolve(ROOT, 'LOT-9-SOURCES.json'), 'utf8'));
const citees = new Set(tools.filter((t) => t.category === 'Imprimantes').flatMap((t) => [t.source, ...t.sources.map((s) => s.url)]));
const urls = reg.sources.map((s) => s.url);
assert(new Set(urls).size === urls.length, `${urls.length} sources, URL distinctes`);
assert([...citees].every((u) => urls.includes(u)) && urls.every((u) => citees.has(u)), 'chaque source du registre est citée, et chaque source citée est au registre');
assert(urls.every((u) => /^https:\/\/(learn\.microsoft\.com\/en-us\/(powershell|windows)\/|openprinting\.github\.io\/cups\/doc\/)\S+$/.test(u)), 'toutes sur learn.microsoft.com ou openprinting.github.io');
assert(reg.sources.every((s) => ['confirmee', 'non confirmee'].includes(s.statut) && s.titre), 'statuts valides, jamais « ok » implicite');
assert(tools.filter((t) => t.category === 'Imprimantes').every((t) => t.sources.length >= 1 && t.sources.every((s) => s.label && s.url)), 'chaque fiche a au moins une source {label, url}');
console.log(`Vérification en ligne consignée : ${reg.sources.filter((s) => s.statut === 'confirmee').length}/${urls.length} confirmées.`);
console.log(`\nSources Imprimantes : ${ok} OK, ${ko} ÉCHEC(S).`);
process.exit(ko ? 1 : 0);
