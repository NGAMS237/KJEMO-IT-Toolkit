#!/usr/bin/env node
/**
 * verifier-sources.mjs — LOT 2 · KJEMO IT Toolkit
 * -----------------------------------------------
 * Interroge réellement chaque URL de source déclarée par les outils et vérifie
 * qu'elle répond, et qu'elle ne renvoie pas la page « contenu introuvable » de
 * Microsoft Learn — celle-ci répond 200, ce qui rend le seul code HTTP
 * insuffisant.
 *
 * Ce contrôle a besoin du réseau : il n'est PAS exécuté par la suite de tests
 * habituelle, qui doit rester hors-ligne et déterministe. Il se lance à la main
 * avant une livraison :
 *
 *     node scripts/verifier-sources.mjs
 *     node scripts/verifier-sources.mjs --json > sources.json
 *
 * Sortie : exit 0 si toutes les sources répondent, exit 1 sinon.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);

const jsonSeul = process.argv.includes('--json');

// Inventaire : une URL peut servir plusieurs outils.
const inventaire = new Map();
for (const outil of tools) {
  const sources = Array.isArray(outil.sources) && outil.sources.length
    ? outil.sources
    : [{ label: 'source principale', url: outil.source }];
  for (const src of [...sources, { label: 'source principale', url: outil.source }]) {
    if (!src || !src.url) continue;
    if (!inventaire.has(src.url)) inventaire.set(src.url, { label: src.label, outils: new Set() });
    inventaire.get(src.url).outils.add(outil.id);
  }
}

const resultats = [];
let echecs = 0;

for (const [url, info] of inventaire) {
  let statut = 0;
  let titre = '';
  let erreur = null;
  try {
    const reponse = await fetch(url, { redirect: 'follow' });
    statut = reponse.status;
    const html = await reponse.text();
    const m = /<title>([^<]*)<\/title>/i.exec(html);
    titre = m ? m[1].trim() : '';
  } catch (e) {
    erreur = e.message;
  }

  // Microsoft Learn répond 200 sur sa page « contenu introuvable » : le titre
  // est le seul indice fiable.
  const introuvable = /content not found|404/i.test(titre);
  const ok = statut === 200 && !introuvable && !erreur;
  if (!ok) echecs++;

  resultats.push({
    url,
    label: info.label,
    outils: [...info.outils].sort(),
    statut,
    titre,
    erreur,
    ok,
  });

  if (!jsonSeul) {
    const marque = ok ? '[OK]  ' : '[ÉCHEC]';
    console.log(`${marque} ${statut} ${url}`);
    if (titre) console.log(`         ${titre}`);
    if (erreur) console.log(`         erreur : ${erreur}`);
  }
}

if (jsonSeul) {
  console.log(JSON.stringify({
    verifieLe: new Date().toISOString(),
    total: resultats.length,
    echecs,
    sources: resultats.sort((a, b) => a.url.localeCompare(b.url)),
  }, null, 2));
} else {
  console.log('');
  console.log(`${resultats.length} source(s) vérifiée(s), ${echecs} échec(s).`);
}

process.exit(echecs > 0 ? 1 : 0);
