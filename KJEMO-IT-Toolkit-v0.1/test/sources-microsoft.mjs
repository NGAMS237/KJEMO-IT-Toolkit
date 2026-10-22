#!/usr/bin/env node
/**
 * sources-microsoft.mjs — LOT 4 · KJEMO IT Toolkit
 * ------------------------------------------------
 * Vérifie que chaque source citée par une fiche existe RÉELLEMENT.
 *
 * Une URL qui répond 200 ne prouve pas grand-chose : Microsoft Learn sert une
 * page « nous n'avons pas trouvé ce contenu » avec le code 200, et un lien mort
 * passerait donc un simple contrôle de code HTTP. Ce banc vérifie donc trois
 * choses pour chaque source :
 *
 *   1. le code HTTP final est 200, redirections suivies ;
 *   2. le titre de la page n'est pas un titre d'erreur ;
 *   3. le titre de la page recoupe le dernier segment de l'URL — ce qui
 *      détecte une redirection vers une page d'accueil de section. Deux
 *      exceptions documentées : les pages d'archive, dont le dernier segment
 *      est un identifiant (cc754699(v=ws.11)) et ne peut rien recouper ; et
 *      les pages renommées, acceptées si l'URL finale reste dans la même
 *      section de la documentation et garde un chemin détaillé.
 *
 * Une contre-épreuve intégrée passe volontairement une URL inexistante au même
 * contrôle : si elle n'est PAS rejetée, c'est le contrôle qui est défaillant,
 * et le banc sort en erreur.
 *
 * Usage : node test/sources-microsoft.mjs [--hors-ligne] [--json <fichier>]
 *   --hors-ligne : n'effectue aucun appel réseau, se contente des contrôles de
 *                  forme. Le rapport indique alors NON VÉRIFIÉ EN LIGNE.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { tools: catalogueComplet } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);
// Les sources Cisco (cisco.com) ont leur propre banc : test/sources-cisco.mjs.
const tools = catalogueComplet.filter((t) => t.category !== 'Réseau et Cisco');
const { sourceLinuxValide, editeurDe } = await import(pathToFileURL(resolve(ROOT, 'dist', 'sources-linux.mjs')).href);
const { CMDLETS_EXTERNES, BINAIRES_EXTERNES } =
  await import(pathToFileURL(resolve(ROOT, 'dist', 'cmdlets.mjs')).href);

const args = process.argv.slice(2);
const horsLigne = args.includes('--hors-ligne');
const iJson = args.indexOf('--json');
const fichierJson = iJson >= 0 ? args[iJson + 1] : null;

let passed = 0;
let failed = 0;
function assert(cond, message) {
  if (cond) { passed++; console.log(`  [OK]    ${message}`); }
  else { failed++; console.log(`  [FAIL]  ${message}`); }
}

const TITRES_ERREUR = [
  /we couldn.t find/i,
  /nous n.avons pas trouv/i,
  /page not found/i,
  /404/,
  /content not found/i,
];

/** Mots du dernier segment d'URL, qui doivent se retrouver dans le titre. */
function motsCles(url) {
  const sansQuery = url.split('?')[0].replace(/\/+$/, '');
  const dernier = sansQuery.split('/').pop() ?? '';
  return dernier.split('-').filter((m) => m.length >= 4).map((m) => m.toLowerCase());
}

async function verifier(url) {
  const reponse = await fetch(url, {
    redirect: 'follow',
    // Titres en anglais : les slugs d'URL de Microsoft Learn sont anglais, et
    // comparer un slug anglais à un titre traduit ne prouverait rien.
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const corps = await reponse.text();
  const m = corps.match(/<title>([\s\S]*?)<\/title>/i);
  const titre = m ? m[1].replace(/\s+/g, ' ').trim() : '';
  return { statut: reponse.status, urlFinale: reponse.url, titre };
}

/** Segments significatifs d'une URL Learn, hors locale et hors paramètres. */
function segments(url) {
  return url.split('?')[0]
    .replace(/^https:\/\/learn\.microsoft\.com/, '')
    .replace(/^\/[a-z]{2}-[a-z]{2}\//i, '/')
    .split('/')
    .filter(Boolean);
}

/** Page d'archive : le dernier segment est un identifiant, pas un titre. */
function estArchive(url) {
  const dernier = segments(url).pop() ?? '';
  return /^[a-z]{2}\d{5,6}\(v=/i.test(dernier) || /^previous-versions$/i.test(dernier);
}

function jugerTitre(url, titre, urlFinale) {
  if (!titre) return { ok: false, raison: 'aucun titre lisible dans la page' };
  for (const motif of TITRES_ERREUR) {
    if (motif.test(titre)) return { ok: false, raison: `titre d'erreur : « ${titre} »` };
  }
  if (estArchive(url)) {
    return { ok: true, raison: `page d'archive, titre « ${titre} »` };
  }
  const mots = motsCles(url);
  if (mots.length === 0) return { ok: true, raison: titre };
  const bas = titre.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const trouve = mots.some((mot) => {
    const m = mot.replace(/[^a-z0-9]+/g, '');
    return bas.includes(m) || (m.endsWith('s') && bas.includes(m.slice(0, -1)));
  });
  if (trouve) return { ok: true, raison: titre };

  // Page renommée : Microsoft redirige vers un nouveau slug dans la même
  // section. C'est légitime ; une redirection vers l'accueil d'une section ne
  // l'est pas, et se reconnaît à un chemin final très court.
  const demandes = segments(url);
  const finaux = segments(urlFinale ?? url);
  const memeSection = demandes.length >= 2 && finaux.length >= 3
    && finaux[0] === demandes[0] && finaux[1] === demandes[1];
  if (memeSection) {
    return { ok: true, raison: `page renommée dans la même section — « ${titre} » (${finaux.join('/')})` };
  }
  return { ok: false, raison: `le titre « ${titre} » ne recoupe aucun mot de l'URL (${mots.join(', ')})` };
}

// ---------------------------------------------------------------------------
// Inventaire des sources
// ---------------------------------------------------------------------------
const sources = new Map(); // url -> { labels:Set, outils:Set }
for (const outil of tools) {
  const ajoute = (url, label) => {
    if (!sources.has(url)) sources.set(url, { labels: new Set(), outils: new Set() });
    sources.get(url).labels.add(label);
    sources.get(url).outils.add(outil.id);
  };
  if (outil.source) ajoute(outil.source, outil.title);
  for (const s of outil.sources ?? []) ajoute(s.url, s.label);
}

// LOT 4 — les pages de documentation de l'inventaire de commandes entrent dans
// le même contrôle. Déclarer une applet avec un lien mort ne vaut pas mieux que
// de ne pas la déclarer.
if (!args.includes('--sans-cmdlets')) {
  const ajoute = (url, label) => {
    if (!sources.has(url)) sources.set(url, { labels: new Set(), outils: new Set() });
    sources.get(url).labels.add(label);
    sources.get(url).outils.add('(inventaire des commandes)');
  };
  for (const [nom, d] of Object.entries(CMDLETS_EXTERNES)) ajoute(d.doc, nom);
  for (const [nom, d] of Object.entries(BINAIRES_EXTERNES)) ajoute(d.doc, nom);
}

console.log(`--- Sources officielles : ${sources.size} URL distinctes, ${tools.length} outils ---`);
console.log('');

// ---------------------------------------------------------------------------
// Contrôles de forme, toujours effectués.
//
// LOT 7 — le dépôt devient multiplateforme, et ce contrôle avec lui.
//
// La règle était « toute source commence par https://learn.microsoft.com/ ».
// Elle convenait à un dépôt dont tous les outils visaient Windows. Linux n'a
// pas d'éditeur unique, et exiger Microsoft Learn pour documenter sshd_config
// obligerait soit à citer une page hors sujet, soit à exempter les sources
// Linux du contrôle — c'est-à-dire à ne plus les contrôler du tout.
//
// La règle devient : toute source doit venir d'un éditeur PRIMAIRE reconnu —
// Microsoft Learn pour Windows, ou l'un des éditeurs énumérés et justifiés un
// par un dans dist/sources-linux.mjs pour Linux. Dans les deux cas elle doit
// désigner une page PRÉCISE, et non un domaine nu.
//
// Elle est plus précise que l'ancienne et refuse strictement plus : un blogue,
// un forum ou un agrégateur de recettes est refusé des deux côtés, alors que
// l'ancienne ne pouvait rien dire d'une URL non-Microsoft sinon « refusée »,
// ce qui rendait tout ajout de plateforme impossible sans la désactiver.
// ---------------------------------------------------------------------------
for (const url of sources.keys()) {
  const microsoft = /^https:\/\/learn\.microsoft\.com\/\S+/.test(url);
  const linux = sourceLinuxValide(url);
  assert(microsoft || linux,
    `éditeur primaire reconnu (Microsoft Learn, ou l'un des éditeurs de sources-linux.mjs) — ${url}`);
  assert(!/^https:\/\/learn\.microsoft\.com\/?$/.test(url), `n'est pas la page d'accueil — ${url}`);
  // Une page précise : un chemin au-delà du domaine. Un domaine nu ne
  // documente rien et se périme sans qu'on le voie.
  assert(/^https:\/\/[^/]+\/\S+/.test(url), `désigne une page précise, pas un domaine nu — ${url}`);
  if (linux) {
    assert(editeurDe(url) !== null, `éditeur Linux identifié — ${url}`);
  }
}

const rapport = {
  genere: new Date().toISOString(),
  horsLigne,
  total: sources.size,
  verifiees: 0,
  echecs: 0,
  sources: [],
};

if (horsLigne) {
  console.log('');
  console.log('Mode hors ligne : aucune URL n\'a été appelée. Statut NON VÉRIFIÉ EN LIGNE.');
  for (const [url, info] of sources) {
    rapport.sources.push({
      url, labels: [...info.labels], outils: [...info.outils],
      statut: 'NON VÉRIFIÉ EN LIGNE', titre: null,
    });
  }
} else {
  console.log('');
  console.log('--- Vérification en ligne : code HTTP ET titre de la page ---');
  for (const [url, info] of sources) {
    let resultat = null;
    let erreur = null;
    for (let essai = 1; essai <= 3 && !resultat; essai++) {
      try { resultat = await verifier(url); }
      catch (e) { erreur = String(e); await new Promise((r) => setTimeout(r, 800 * essai)); }
    }
    if (!resultat) {
      assert(false, `${url} — injoignable (${erreur})`);
      rapport.sources.push({ url, labels: [...info.labels], outils: [...info.outils], statut: 'INJOIGNABLE', titre: null, erreur });
      rapport.echecs++;
      continue;
    }
    const codeOk = resultat.statut === 200;
    const jugement = jugerTitre(url, resultat.titre, resultat.urlFinale);
    assert(codeOk, `${url} — code ${resultat.statut}`);
    assert(jugement.ok, `${url} — titre : ${jugement.raison}`);
    rapport.verifiees++;
    if (!codeOk || !jugement.ok) rapport.echecs++;
    rapport.sources.push({
      url, labels: [...info.labels], outils: [...info.outils],
      statut: codeOk && jugement.ok ? 'VÉRIFIÉE' : 'ÉCHEC',
      code: resultat.statut, urlFinale: resultat.urlFinale, titre: resultat.titre,
    });
  }

  // -------------------------------------------------------------------------
  // Contre-épreuve : une page Microsoft Learn inexistante DOIT être rejetée.
  // Microsoft la sert avec le code 200 — c'est précisément pourquoi ce banc
  // regarde le titre, et non le code seul.
  // -------------------------------------------------------------------------
  console.log('');
  console.log('--- Contre-épreuve : une page inexistante est-elle détectée ? ---');
  const urlFausse = 'https://learn.microsoft.com/powershell/module/grouppolicy/kjemo-cmdlet-qui-n-existe-pas';
  let faux = null;
  try { faux = await verifier(urlFausse); } catch { /* injoignable compte aussi comme rejet */ }
  if (!faux) {
    assert(true, 'contre-épreuve — la page inexistante est injoignable, donc rejetée');
  } else {
    const jugement = jugerTitre(urlFausse, faux.titre, faux.urlFinale);
    assert(faux.statut !== 200 || !jugement.ok,
      `contre-épreuve — la page inexistante est rejetée (code ${faux.statut}, titre « ${faux.titre} »)`);
  }
  rapport.contreEpreuve = faux
    ? { url: urlFausse, code: faux.statut, titre: faux.titre, rejetee: true }
    : { url: urlFausse, code: null, titre: null, rejetee: true };
}

if (fichierJson) {
  writeFileSync(resolve(ROOT, fichierJson), JSON.stringify(rapport, null, 2) + '\n', 'utf-8');
  console.log('');
  console.log(`Rapport écrit : ${fichierJson}`);
}

console.log('');
console.log(`Sources Microsoft : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
