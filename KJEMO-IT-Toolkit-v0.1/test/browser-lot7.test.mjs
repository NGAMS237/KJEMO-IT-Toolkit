#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 (25/n) — BANC NAVIGATEUR : NAVIGATION LINUX ET RESPONSIVE RÉEL À 390 px
//
// Chromium RÉEL (Playwright), jamais jsdom : un débordement horizontal, un
// panneau qui recouvre son bouton ou un contrôle masqué n'existent que dans un
// moteur de rendu. Le banc historique (browser-identity) prouve que le script
// copié est le script généré ; celui-ci prouve que l'on PEUT l'atteindre, le
// lire et l'utiliser, au clavier et sur un écran de téléphone.
//
// CE QU'IL MESURE
//   A  les 8 catégories actuelles — « Linux et services réseau » est peuplée,
//      VISIBLE, et ses 11 sous-rubriques correspondent au catalogue ;
//   B  les routes directes des 46 assistants du lot (43 Linux + 3 jonction de
//      domaine) : chargement à froid sur #/outil/<id>, titre, aperçu identique
//      à la référence, `bash -n` accepté sur le texte AFFICHÉ, historique ;
//   C  la recherche (résultats comparés à searchTools), les favoris, l'historique,
//      y compris avec un stockage corrompu ou inaccessible ;
//   D  la navigation au clavier : lien d'évitement, ordre de tabulation, aucun
//      piège, tous les contrôles visibles atteignables ;
//   E  390 px, accueil : aucun débordement, aucun contrôle hors écran, menu
//      latéral dont le panneau ne recouvre jamais son bouton de fermeture ;
//   F  390 px, les 46 fiches : aucun débordement, titres non tronqués, contrôles
//      nommés, atteignables et non masqués, champs utilisables, aperçu du script
//      défilant DANS son cadre, commandes lisibles ;
//   G  390 px, les deux modes de lecture et les trois thèmes.
//
// CE QU'IL NE MESURE PAS — ET LE DIT
//   Les 112 commandes rapides ne sont affichées par AUCUN écran de l'application
//   (aucun import de leurs modules dans app.js) : leur lisibilité à 390 px n'est
//   donc PAS testable, et ce banc ne prétend pas le contraire. Il vérifie en
//   revanche que cela reste vrai : le jour où app.js les importera, la passe H
//   ÉCHOUE jusqu'à ce que ce banc soit étendu. Ce qu'il mesure à leur place, ce
//   sont les blocs de COMMANDES qui existent à l'écran : « Pour cet outil »,
//   l'annulation, les erreurs fréquentes.
//
// Aucun waitForTimeout : on attend des états observables du DOM.
// ---------------------------------------------------------------------------
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';

// Azure + Cisco intégrés — 8 catégories au LOT 7 (« Tout » comprise) + « Azure et Entra ID » (LOT 8)
// + « Réseau et Cisco » (RESEAU-CISCO-01) = 10. Le compte est explicite : un compte déduit du
// catalogue ne détecterait pas une catégorie ajoutée ou perdue par erreur.
const NB_CATEGORIES = 11; // LOT 9 : « Imprimantes » est pourvue et visible (10 catégories + « Tout »)
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { tools, normalizeScript, searchTools, searchCommonErrors } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);
const { estBash } = await import(pathToFileURL(resolve(ROOT, 'dist', 'plateforme.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(ROOT, 'dist', 'noyau-bash.mjs')).href);
const { categoriesVisibles, sousRubriques, SOUS_RUBRIQUES_LINUX } = await import(pathToFileURL(resolve(ROOT, 'dist', 'categories.mjs')).href);

// ---------------------------------------------------------------------------
// Comptabilité des vérifications
// ---------------------------------------------------------------------------
let ok = 0;
const echecs = [];
const verifier = (cond, label, detail = '') => {
  if (cond) { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${label}`); }
  else { echecs.push(label); console.error(`  [ECHEC] ${label}${detail ? ` — ${detail}` : ''}`); }
};
let passeCourante = '(avant toute passe)';
const section = (t) => { passeCourante = t; console.log(''); console.log(t); };
// KJEMO_PASSES=B,F : ne jouer que ces passes (contre-épreuves ciblées). Vide = toutes.
const PASSES = process.env.KJEMO_PASSES ? new Set(process.env.KJEMO_PASSES.split(',').map((x) => x.trim())) : null;
const jouer = (p) => !PASSES || PASSES.has(p);

// ---------------------------------------------------------------------------
// Serveur statique minimal pour dist/
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
// KJEMO_DIST_DIR : sert une COPIE MUTILÉE de dist/ au navigateur, pendant que les
// oracles (catalogue, générateurs, recherche) restent lus dans le dist/ intact.
// Utilisé par test/browser-lot7-contre-epreuves.test.mjs pour prouver que ce banc
// ÉCHOUE quand l'application est cassée. Sans cette variable : dist/ réel.
const distDir = process.env.KJEMO_DIST_DIR ? resolve(process.env.KJEMO_DIST_DIR) : resolve(ROOT, 'dist');
const server = createServer((req, rep) => {
  const brut = req.url.split('?')[0];
  const chemin = resolve(distDir, '.' + (brut === '/' ? '/index.html' : brut));
  try {
    const corps = readFileSync(chemin);
    rep.writeHead(200, { 'Content-Type': MIME[extname(chemin)] || 'application/octet-stream' });
    rep.end(corps);
  } catch { rep.writeHead(404); rep.end('Not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------------------------------------------------------------------------
// Chromium : variable d'environnement, puis chemin connu, puis défaut Playwright
// ---------------------------------------------------------------------------
const CHEMINS = [process.env.PLAYWRIGHT_CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
  .filter((c) => c && c.trim());
const CHROMIUM = CHEMINS.find((c) => existsSync(c)) ?? null;
const options = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
if (CHROMIUM) options.executablePath = CHROMIUM;
console.log(`Serveur local : ${BASE}`);
console.log(`Chromium      : ${CHROMIUM ?? '(Playwright par défaut)'}`);
const browser = await chromium.launch(options);

// Erreurs de page : aucune n'est tolérée, sur toute la durée du banc.
const erreursPage = [];
async function nouvellePage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erreursPage.push(`pageerror : ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') erreursPage.push(`console.error : ${m.text()}`); });
  return page;
}

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

// ---------------------------------------------------------------------------
// Les 46 assistants du lot — MESURÉS sur le catalogue, jamais recopiés
// ---------------------------------------------------------------------------
// Le lot 7 = les outils Linux de la catégorie « Linux et services réseau » : les 4 assistants CUPS du LOT 9 (catégorie Imprimantes) n'en font pas partie.
const linux = tools.filter((t) => t.platform === 'Linux' && t.category === 'Linux et services réseau');
const jonction = tools.filter((t) => t.subcategory === 'Jonction de domaine');
const lot7 = [...linux, ...jonction];
// KJEMO_OUTILS=a,b : restreint les passes B et F à ces assistants (contre-épreuves
// ciblées). Le décompte de 46 (B0) reste mesuré sur le lot COMPLET.
const FILTRE = process.env.KJEMO_OUTILS ? new Set(process.env.KJEMO_OUTILS.split(',').map((x) => x.trim())) : null;
const cibles = FILTRE ? lot7.filter((t) => FILTRE.has(t.id)) : lot7;
const attendu = (t) => {
  const d = Object.fromEntries(t.fields.map((f) => [f.id, String(f.default ?? '')]));
  return estBash(t) ? normalizeScriptSh(t.generate(d)) : normalizeScript(t.generate(d));
};

// ---------------------------------------------------------------------------
// Sondes exécutées DANS la page
// ---------------------------------------------------------------------------

/** Mesures de mise en page de la vue courante. */
const sonderMiseEnPage = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const r = { scrollWidth: document.documentElement.scrollWidth, vw, debordent: [], sansNom: [], petites: [], tronques: [] };
  const clippe = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  const nomDe = (el) => (el.getAttribute('aria-label') || el.textContent
    || el.getAttribute('title') || el.getAttribute('placeholder')
    || (el.labels && el.labels[0] && el.labels[0].textContent) || '').trim();
  const decrire = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`;

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.sr-only, .skip')) continue;       // hors écran PAR CONCEPTION (lien d'évitement, texte pour lecteur d'écran)
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    if ((b.right > vw + 1 || b.left < -1) && !clippe(el)) r.debordent.push(`${decrire(el)} droite=${Math.round(b.right)}`);
  }
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.sr-only, .skip')) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    if (!nomDe(el)) r.sansNom.push(decrire(el));
    // WCAG 2.5.8 : cible d'au moins 24 x 24 px, sauf lien EN LIGNE dans une phrase.
    const enLigne = el.tagName === 'A' && el.closest('p, li');
    const champ = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';
    const boite = champ && el.closest('label') ? el.closest('label').getBoundingClientRect() : b;
    if (!enLigne && (boite.width < 24 || boite.height < 24)) r.petites.push(`${decrire(el)} ${Math.round(boite.width)}x${Math.round(boite.height)}`);
  }
  // Texte COUPÉ : un cadre qui cache son débordement sans permettre de défiler.
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || el.closest('.sr-only, .skip') || el.tagName === 'INPUT') continue;
    if (/hidden|clip/.test(cs.overflowX) && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1
        && cs.textOverflow !== 'ellipsis') {
      r.tronques.push(`${decrire(el)} ${el.scrollWidth}>${el.clientWidth}`);
    }
  }
  return r;
});

/**
 * Un contrôle est ATTEIGNABLE s'il est affichable, amené à l'écran, et si le
 * point central de sa boîte désigne bien LUI (ou un de ses descendants) — pas
 * un panneau, un bandeau ou un autre élément qui le recouvrirait.
 */
const atteignable = (page, selecteur) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return { ok: false, raison: 'introuvable' };
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return { ok: false, raison: 'masqué' };
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const b = el.getBoundingClientRect();
  if (b.width === 0 || b.height === 0) return { ok: false, raison: 'taille nulle' };
  if (b.left < -1 || b.right > window.innerWidth + 1) return { ok: false, raison: `hors écran (${Math.round(b.left)}..${Math.round(b.right)})` };
  const x = Math.min(Math.max(b.left + b.width / 2, 0), window.innerWidth - 1);
  const y = Math.min(Math.max(b.top + b.height / 2, 0), window.innerHeight - 1);
  const haut = document.elementFromPoint(x, y);
  if (!haut) return { ok: false, raison: 'aucun élément au point central' };
  return el.contains(haut) ? { ok: true } : { ok: false, raison: `recouvert par ${haut.tagName.toLowerCase()}#${haut.id}.${String(haut.className).split(' ')[0]}` };
}, selecteur);

/** Fichier jetable : `bash -n` sur le texte AFFICHÉ, pas sur la référence. */
const dossierTmp = mkdtempSync(join(tmpdir(), 'kjemo-browser-lot7-'));
function bashAccepte(texte, nom) {
  const f = join(dossierTmp, `${nom}.sh`);
  writeFileSync(f, texte, 'utf8');
  const r = spawnSync('bash', ['-n', f], { encoding: 'utf8' });
  return { ok: r.status === 0, message: (r.stderr || '').split('\n')[0] };
}

const lireJson = (page, cle) => page.evaluate((k) => {
  try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return 'ILLISIBLE'; }
}, cle);

const attendreAccueil = (page) => page.waitForSelector('#toolGrid .tool-card, #toolGrid .empty', { timeout: 8000 });
const titresGrille = (page) => page.$$eval('#toolGrid .tool-card h3', (els) => els.map((e) => e.textContent));

try {
  // =========================================================================
  section('Passe A — les 8 catégories : « Linux et services réseau » est peuplée et VISIBLE');
  // =========================================================================
  if (jouer('A')) {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await nouvellePage(ctx);
    await page.goto(BASE);
    await page.waitForSelector('#categoryGrid .category-card');

    const visibles = categoriesVisibles(tools);
    const cartes = await page.$$eval('#categoryGrid .category-card', (els) => els.map((e) => ({
      nom: e.dataset.category, texte: e.textContent, presse: e.getAttribute('aria-pressed'),
    })));
    verifier(cartes.length === NB_CATEGORIES, `A1 : ${NB_CATEGORIES} cartes de catégorie, « Tout » comprise (mesuré ${cartes.length})`);
    verifier(cartes.length === visibles.length + 1,
      `A2 : cartes = catégories pourvues du catalogue + « Tout » (${visibles.length} + 1)`);
    verifier(cartes[0].nom === 'Tout', 'A3 : la première carte est « Tout »');
    verifier(visibles.every((c) => cartes.some((k) => k.nom === c.name)),
      'A4 : chaque catégorie pourvue du catalogue est affichée — aucune n\'est masquée pour faire passer un ancien décompte');
    const carteLinux = cartes.find((k) => k.nom === 'Linux et services réseau');
    verifier(Boolean(carteLinux), 'A5 : « Linux et services réseau » est affichée');
    verifier(Boolean(carteLinux) && /43\s+outils/.test(carteLinux.texte),
      `A6 : sa carte annonce 43 outils (« ${(carteLinux?.texte ?? '').slice(0, 60)}… »)`);
    verifier(cartes.some((k) => k.nom === 'Imprimantes'), 'A7 : « Imprimantes », pourvue depuis le LOT 9, est affichée');
    verifier(!cartes.some((k) => k.nom === 'Linux'), 'A8 : l\'ancien nom « Linux » n\'existe plus à l\'écran');

    const sous = sousRubriques(tools, 'Linux et services réseau');
    verifier(sous.length === 11, `A9 : 11 sous-rubriques Linux au catalogue (mesuré ${sous.length})`);
    verifier(sous.reduce((n, s) => n + s.count, 0) === 43, 'A10 : les 11 sous-rubriques totalisent les 43 assistants Linux');
    const texteSous = await page.$eval('#categoryGrid .category-card[data-category="Linux et services réseau"] .category-sub', (e) => e.textContent);
    verifier(sous.every((s) => texteSous.includes(s.name)),
      `A11 : la carte nomme les 11 sous-rubriques (${sous.map((s) => s.name).join(' · ')})`);
    verifier(SOUS_RUBRIQUES_LINUX.length === 11, 'A12 : la table des sous-rubriques déclare 11 entrées');

    // La barre latérale doit dire la même chose que la grille.
    const navigation = await page.$$eval('#navigation button', (els) => els.map((e) => ({
      nom: e.dataset.category, compte: e.querySelector('.nav-count')?.textContent,
    })));
    verifier(navigation.length === NB_CATEGORIES, `A13 : la barre latérale propose ${NB_CATEGORIES} entrées (mesuré ${navigation.length})`);
    const navLinux = navigation.find((n) => n.nom === 'Linux et services réseau');
    verifier(navLinux?.compte === '43', `A14 : l'entrée latérale Linux annonce 43 (${navLinux?.compte})`);
    verifier(navigation.find((n) => n.nom === 'Tout')?.compte === String(tools.length),
      `A15 : « Tout » annonce ${tools.length} outils (catalogue réel)`);

    // Cliquer la carte Linux affiche exactement les 43 assistants Linux.
    await page.click('#categoryGrid .category-card[data-category="Linux et services réseau"]');
    await page.waitForFunction(() => document.querySelectorAll('#toolGrid .tool-card').length === 43, null, { timeout: 8000 });
    const titres = await titresGrille(page);
    const attendus = tools.filter((t) => t.category === 'Linux et services réseau').map((t) => t.title);
    verifier(titres.length === 43 && attendus.every((t) => titres.includes(t)),
      `A16 : la catégorie Linux affiche les 43 assistants du catalogue (${titres.length})`);
    verifier(await page.$eval('#toolCount', (e) => e.textContent) === '43 outils', 'A17 : le compteur annonce « 43 outils »');
    verifier(!titres.some((t) => /Jonction|domaine Windows/i.test(t) && tools.find((x) => x.title === t)?.category !== 'Linux et services réseau'),
      'A18 : aucun assistant de jonction Windows dans la liste Linux');

    // La jonction de domaine reste sous « Poste de travail Windows ».
    await page.click('#navigation button[data-category="Poste de travail Windows"]');
    await page.waitForFunction(() => document.querySelectorAll('#toolGrid .tool-card').length === 33, null, { timeout: 8000 });
    const titresPoste = await titresGrille(page);
    verifier(jonction.length === 3 && jonction.every((t) => titresPoste.includes(t.title)),
      'A19 : les 3 assistants de jonction de domaine sont sous « Poste de travail Windows », jamais sous Linux');
    await ctx.close();
  }

  // =========================================================================
  section('Passe B — routes directes : les 46 assistants, chargement à froid');
  // =========================================================================
  verifier(lot7.length === 46, `B0 : 46 assistants au lot — 43 Linux + 3 jonction (mesuré ${linux.length} + ${jonction.length} = ${lot7.length})`);
  if (jouer('B')) {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    for (const t of cibles) {
      const page = await nouvellePage(ctx);
      await page.goto(`${BASE}/#/outil/${t.id}`);
      await page.waitForSelector('#scriptOutput', { timeout: 8000 });
      const etat = await page.evaluate(() => ({
        hash: location.hash,
        h1: document.querySelector('#toolView h1')?.textContent ?? '',
        vueVisible: !document.querySelector('#toolView').hidden,
        accueilCache: document.querySelector('#home').hidden,
        h1Visibles: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
        pre: document.querySelector('#scriptOutput').textContent,
      }));
      verifier(etat.hash === `#/outil/${t.id}`, `B1 : ${t.id} — l'URL reste #/outil/${t.id}`);
      verifier(etat.vueVisible && etat.accueilCache, `B2 : ${t.id} — la fiche est affichée, l'accueil masqué`);
      verifier(etat.h1.includes(t.title), `B3 : ${t.id} — le titre de la fiche est « ${t.title.slice(0, 40)}… »`);
      verifier(etat.h1Visibles === 1, `B4 : ${t.id} — un seul h1 visible (${etat.h1Visibles})`);
      verifier(etat.pre === attendu(t),
        `B5 : ${t.id} — l'aperçu INITIAL est le script de référence de sa plateforme`);
      if (estBash(t)) {
        const r = bashAccepte(etat.pre, t.id);
        verifier(r.ok, `B6 : ${t.id} — « bash -n » accepte le texte AFFICHÉ à l'ouverture`, r.message);
        verifier(!/ `$/m.test(etat.pre),
          `B7 : ${t.id} — aucune ligne ne finit par un backtick de continuation PowerShell`);
      }
      const hist = await lireJson(page, 'kjemo.historique.v1');
      verifier(Array.isArray(hist) && hist[0] === t.id, `B8 : ${t.id} — l'ouverture directe entre en tête de l'historique`);
      await page.close();
    }
    // Route inconnue : retour à l'accueil, sans erreur.
    const page = await nouvellePage(ctx);
    await page.goto(`${BASE}/#/outil/n-existe-pas`);
    await attendreAccueil(page);
    verifier(await page.$eval('#home', (e) => !e.hidden) && await page.$eval('#toolView', (e) => e.hidden),
      'B9 : une route inconnue affiche l\'accueil, sans fiche');
    await page.goto(`${BASE}/#/outil/..%2F..%2Fetc%2Fpasswd`);
    await attendreAccueil(page);
    verifier(await page.$eval('#toolView', (e) => e.hidden), 'B10 : une route à traversée de chemin n\'ouvre aucune fiche');
    await ctx.close();
  }

  // =========================================================================
  section('Passe C — recherche, favoris, historique');
  // =========================================================================
  if (jouer('C')) {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await nouvellePage(ctx);
    await page.goto(BASE);
    await attendreAccueil(page);

    // --- C1 : recherche -------------------------------------------------
    const requetes = [
      ['samba', 'samba-share-create'], ['nfs', 'nfs-export-create'], ['cockpit', 'cockpit-install-readiness'],
      ['ssh', 'ssh-hardening-audit'], ['netplan', 'netplan-readiness'], ['raid', 'linux-raid1-create'],
      ['quota', 'linux-quota-enable'], ['acl', 'linux-permission-acl'], ['chmod', 'linux-permission-change'],
      ['jonction', 'windows-domain-join'], ['fstab', 'linux-disk-partition-mount'],
    ];
    for (const [q, idAttendu] of requetes) {
      await page.fill('#search', q);
      const oracle = searchTools(q, 'Tout');
      await page.waitForFunction((n) => document.querySelector('#toolCount').textContent.startsWith(`${n} outil`), oracle.length, { timeout: 5000 });
      const titres = await titresGrille(page);
      verifier(oracle.length > 0, `C1 : « ${q} » trouve au moins un outil (${oracle.length})`);
      verifier(JSON.stringify(titres) === JSON.stringify(oracle.map((r) => r.tool.title)),
        `C2 : « ${q} » — les cartes affichées sont exactement celles de searchTools, dans le même ordre`);
      verifier(oracle.some((r) => r.tool.id === idAttendu), `C3 : « ${q} » propose ${idAttendu}`);
    }
    // Une requête sans réponse l'annonce.
    await page.fill('#search', 'zzzzqqqqxx');
    await page.waitForSelector('#toolGrid .empty');
    verifier(/Aucun outil ne correspond/.test(await page.$eval('#toolGrid .empty', (e) => e.textContent)),
      'C4 : une requête sans résultat le dit clairement');
    verifier(await page.$eval('#toolCount', (e) => e.textContent) === '0 outil', 'C5 : le compteur annonce « 0 outil »');
    // Effacer : le bouton n'existe que s'il y a du texte ; Échap vide sans quitter le champ.
    verifier(await page.$eval('#searchClear', (e) => !e.hidden), 'C6 : le bouton d\'effacement apparaît avec du texte');
    await page.focus('#search');
    await page.keyboard.press('Escape');
    verifier(await page.inputValue('#search') === '', 'C7 : Échap vide la recherche');
    verifier(await page.evaluate(() => document.activeElement?.id) === 'search', 'C8 : le focus reste dans le champ de recherche');
    verifier(await page.$eval('#searchClear', (e) => e.hidden), 'C9 : le bouton d\'effacement disparaît quand le champ est vide');
    await page.waitForFunction((n) => document.querySelectorAll('#toolGrid .tool-card').length === n, tools.length, { timeout: 5000 });
    // Recherche combinée à une catégorie.
    await page.click('#navigation button[data-category="Linux et services réseau"]');
    await page.fill('#search', 'samba');
    const oracleCat = searchTools('samba', 'Linux et services réseau');
    await page.waitForFunction((n) => document.querySelector('#toolCount').textContent.startsWith(`${n} outil`), oracleCat.length, { timeout: 5000 });
    verifier(oracleCat.length >= 3 && oracleCat.every((r) => r.tool.category === 'Linux et services réseau'),
      `C10 : « samba » dans la catégorie Linux ne rend que des outils Linux (${oracleCat.length})`);
    verifier(JSON.stringify(await titresGrille(page)) === JSON.stringify(oracleCat.map((r) => r.tool.title)),
      'C11 : la recherche combinée affiche exactement le résultat de searchTools');
    await page.click('#searchClear');
    // Erreur commune : le bandeau n'apparaît que si searchCommonErrors répond.
    for (const q of ['bad interpreter', 'n’est pas signé numériquement', 'zzzzqqqqxx']) {
      await page.fill('#search', q);
      const hits = searchCommonErrors(q);
      await page.waitForFunction((attenduBandeau) => Boolean(document.querySelector('#commonErrorBanner')) === attenduBandeau,
        hits.length > 0, { timeout: 5000 });
      verifier(true, `C12 : « ${q} » — bandeau d'erreur commune ${hits.length > 0 ? 'présent' : 'absent'}, comme searchCommonErrors`);
    }
    await page.click('#searchClear');
    await page.click('#navigation button[data-category="Tout"]');

    // --- C2 : favoris ---------------------------------------------------
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await attendreAccueil(page);
    const titresTous = await titresGrille(page);
    const bascule = async (i) => { await page.locator('#toolGrid .fav-toggle').nth(i).click(); };
    verifier(await page.locator('#favorisSection').count() === 0, 'C13 : sans favori, aucune section « Favoris »');
    await bascule(0);
    verifier(await page.locator('#toolGrid .fav-toggle').nth(0).getAttribute('aria-pressed') === 'true',
      'C14 : le bouton étoile passe à aria-pressed=true');
    await bascule(2);
    const favs = await lireJson(page, 'kjemo.favoris.v1');
    verifier(Array.isArray(favs) && favs.length === 2, `C15 : deux favoris enregistrés (${JSON.stringify(favs)})`);
    verifier(await page.locator('#favorisSection .shortcut').count() === 2, 'C16 : la section « Favoris » affiche deux raccourcis');
    await page.reload();
    await attendreAccueil(page);
    verifier(await page.locator('#favorisSection .shortcut').count() === 2, 'C17 : les favoris survivent au rechargement');
    // Ouvrir depuis un raccourci.
    const idFav = favs[0];
    await page.locator(`#favorisSection .shortcut[data-tool="${idFav}"]`).click();
    await page.waitForSelector('#scriptOutput');
    verifier((await page.evaluate(() => location.hash)) === `#/outil/${idFav}`, 'C18 : un raccourci de favori ouvre la bonne fiche');
    await page.click('#backButton');
    await attendreAccueil(page);
    await page.locator('#toolGrid .fav-toggle').nth(0).click();
    const favs2 = await lireJson(page, 'kjemo.favoris.v1');
    verifier(Array.isArray(favs2) && favs2.length === 1, 'C19 : retirer un favori le retire de la liste et de l\'écran');

    // --- C3 : historique ------------------------------------------------
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await attendreAccueil(page);
    const ordre = tools.slice(0, 8).map((t) => t.id);
    for (const id of ordre) {
      await page.goto(`${BASE}/#/outil/${id}`);
      await page.waitForSelector('#scriptOutput');
      await page.click('#backButton');
      await attendreAccueil(page);
    }
    const hist = await lireJson(page, 'kjemo.historique.v1');
    verifier(Array.isArray(hist) && hist.length === 6, `C20 : l'historique est plafonné à 6 entrées (${hist?.length})`);
    verifier(JSON.stringify(hist) === JSON.stringify(ordre.slice(2).reverse()),
      'C21 : l\'historique garde les 6 DERNIERS, le plus récent en tête');
    const recents = await page.$$eval('#historiqueSection .shortcut', (els) => els.map((e) => e.dataset.tool));
    verifier(JSON.stringify(recents) === JSON.stringify(hist), 'C22 : « Consultés récemment » affiche l\'historique, dans l\'ordre');
    // Un favori n'est pas répété dans les récents.
    await page.locator('#toolGrid .fav-toggle').nth(0).click();
    const premierFav = (await lireJson(page, 'kjemo.favoris.v1'))[0];
    const recents2 = await page.$$eval('#historiqueSection .shortcut', (els) => els.map((e) => e.dataset.tool));
    verifier(!recents2.includes(premierFav), 'C23 : un outil en favori n\'est pas répété dans « Consultés récemment »');

    // --- C4 : stockage corrompu ou inaccessible ---------------------------
    await page.evaluate(() => {
      localStorage.setItem('kjemo.favoris.v1', '{pas du json');
      localStorage.setItem('kjemo.historique.v1', JSON.stringify(['outil-fantome', 42, null, tools0()]));
      function tools0() { return 'autre-fantome'; }
    });
    await page.reload();
    await attendreAccueil(page);
    verifier(await page.locator('#toolGrid .tool-card').count() === tools.length,
      'C24 : un stockage corrompu ne casse pas l\'accueil');
    verifier(await page.locator('#favorisSection, #historiqueSection').count() === 0,
      'C25 : des identifiants inconnus ne produisent aucun raccourci fantôme');
    await ctx.close();

    const ctxBloque = await browser.newContext({ viewport: DESKTOP });
    await ctxBloque.addInitScript(() => {
      const refus = () => { throw new DOMException('stockage bloqué', 'SecurityError'); };
      Storage.prototype.getItem = refus; Storage.prototype.setItem = refus; Storage.prototype.removeItem = refus;
    });
    const pb = await nouvellePage(ctxBloque);
    await pb.goto(`${BASE}/#/outil/nfs-export-create`);
    await pb.waitForSelector('#scriptOutput', { timeout: 8000 });
    verifier(true, 'C26 : avec un stockage INACCESSIBLE, la fiche s\'ouvre quand même');
    await pb.click('#backButton');
    await attendreAccueil(pb);
    await pb.locator('#toolGrid .fav-toggle').nth(0).click();
    verifier(await pb.locator('#toolGrid .tool-card').count() === tools.length,
      'C27 : avec un stockage inaccessible, basculer un favori ne casse pas la page');
    await ctxBloque.close();
  }

  // =========================================================================
  section('Passe D — navigation au clavier');
  // =========================================================================
  if (jouer('D')) {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await nouvellePage(ctx);
    await page.goto(BASE);
    await attendreAccueil(page);
    const actif = () => page.evaluate(() => {
      const a = document.activeElement;
      return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : ''}` : 'aucun';
    });

    // Premier Tab : le lien d'évitement, visible quand il a le focus.
    await page.keyboard.press('Tab');
    verifier((await actif()).startsWith('a.skip'), `D1 : le premier Tab atteint le lien d'évitement (${await actif()})`);
    const skip = await page.$eval('.skip', (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    verifier(skip.x >= 0 && skip.y >= 0 && skip.w > 0 && skip.h > 0, `D2 : le lien d'évitement devient VISIBLE au focus (${Math.round(skip.x)},${Math.round(skip.y)})`);
    await page.keyboard.press('Enter');
    verifier(await page.evaluate(() => location.hash) === '#main', 'D3 : activer le lien d\'évitement vise #main');
    verifier(await page.$eval('#toolGrid', (e) => e.children.length) > 0, 'D4 : l\'accueil reste affiché après le lien d\'évitement');

    // Parcours complet : tous les contrôles visibles sont atteints, sans piège.
    // Rechargement : après un lien d'évitement, le point de départ de la
    // tabulation séquentielle est DÉPLACÉ sur la cible (#main) — Tab ne repasse
    // plus par le lien ni par le menu. Pour mesurer le parcours complet, on
    // repart d'un document neuf.
    await page.goto(BASE);
    await page.reload();
    await attendreAccueil(page);
    const attendus = await page.evaluate(() => [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex="0"]')]
      .filter((e) => !e.disabled && e.tabIndex >= 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'
        && (e.offsetWidth > 0 || e.offsetHeight > 0) && !e.closest('[hidden]'))
      .length);
    const vus = new Set();
    let precedent = '';
    let piege = false;
    for (let i = 0; i < attendus + 40; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return 'BODY';
        const chemin = []; for (let e = a; e && e !== document.body; e = e.parentElement) chemin.push(`${e.tagName}${[...e.parentElement?.children ?? []].indexOf(e)}`);
        return chemin.join('/');
      });
      if (id === 'BODY') break;                    // le focus a quitté la page : le cycle est bouclé
      if (id === precedent) { piege = true; break; }
      precedent = id; vus.add(id);
    }
    verifier(!piege, 'D5 : aucun piège au clavier — chaque Tab déplace le focus');
    verifier(vus.size >= attendus - 1 && vus.size <= attendus + 1,
      `D6 : Tab atteint tous les contrôles visibles de l'accueil (${vus.size} atteints / ${attendus} attendus)`);

    // Chaîne carte → fiche → retour, entièrement au clavier.
    await page.focus('#search');
    await page.keyboard.type('nfs');
    await page.waitForFunction(() => document.querySelectorAll('#toolGrid .tool-card').length >= 1, null, { timeout: 5000 });
    // Ordre du DOM : recherche, effacer, bandeaux, 8 cartes de catégorie, puis la grille.
    let guard = 0;
    while (!(await page.evaluate(() => document.activeElement?.classList.contains('open-tool'))) && guard++ < 30) {
      await page.keyboard.press('Tab');
    }
    verifier(guard < 30, `D7a : la grille est atteinte au clavier après la recherche (${guard} Tab)`);
    verifier(await page.evaluate(() => document.activeElement?.classList.contains('open-tool')),
      'D7 : Tab atteint le bouton « Ouvrir l\'assistant » de la première carte');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#scriptOutput');
    verifier((await page.evaluate(() => location.hash)).startsWith('#/outil/'), 'D8 : Entrée sur « Ouvrir » ouvre la fiche (URL mise à jour)');
    // La fiche : la navigation interne est faite de VRAIS liens, activables au clavier.
    await page.focus('.fiche-nav-link[data-cible="sectionScript"]');
    await page.keyboard.press('Enter');
    const apresAncre = await page.evaluate(() => ({ hash: location.hash, actif: document.activeElement?.closest('section')?.id }));
    verifier(apresAncre.hash.startsWith('#/outil/'), 'D9 : une ancre de fiche activée au clavier ne détruit pas l\'URL de la route');
    verifier(apresAncre.actif === 'sectionScript', `D10 : le focus suit le regard — il est dans la section Script (${apresAncre.actif})`);
    // <details> : Entrée et Espace ouvrent et ferment.
    await page.focus('#execNotes > summary');
    await page.keyboard.press('Enter');
    verifier(await page.$eval('#execNotes', (e) => e.open), 'D11 : Entrée ouvre « Avant d\'exécuter » ');
    await page.keyboard.press('Space');
    verifier(await page.$eval('#execNotes', (e) => !e.open), 'D12 : Espace le referme');
    // Bouton Retour au clavier, puis boutons du navigateur.
    await page.focus('#backButton');
    await page.keyboard.press('Enter');
    await attendreAccueil(page);
    verifier(await page.evaluate(() => location.hash) === '#/' && await page.$eval('#toolView', (e) => e.hidden),
      'D13 : le bouton « Tous les outils » ramène à l\'accueil, au clavier');
    await page.goBack();
    await page.waitForSelector('#scriptOutput');
    verifier(await page.$eval('#toolView', (e) => !e.hidden), 'D14 : « Précédent » du navigateur rouvre la fiche');
    await page.goForward();
    await attendreAccueil(page);
    verifier(await page.$eval('#home', (e) => !e.hidden), 'D15 : « Suivant » du navigateur revient à l\'accueil');
    // Étoile de favori au clavier : Entrée ET Espace.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await attendreAccueil(page);
    await page.focus('#toolGrid .fav-toggle');
    await page.keyboard.press('Enter');
    verifier(await page.locator('#toolGrid .fav-toggle').first().getAttribute('aria-pressed') === 'true', 'D16 : Entrée active l\'étoile de favori');
    await page.focus('#toolGrid .fav-toggle');
    await page.keyboard.press('Space');
    verifier(await page.locator('#toolGrid .fav-toggle').first().getAttribute('aria-pressed') === 'false', 'D17 : Espace la désactive');
    // Une cible de focus visible : le contour n'est pas supprimé.
    await page.focus('#toolGrid .open-tool');
    const contour = await page.$eval('#toolGrid .open-tool', (e) => { const s = getComputedStyle(e); return { style: s.outlineStyle, largeur: parseFloat(s.outlineWidth), ombre: s.boxShadow }; });
    verifier((contour.style !== 'none' && contour.largeur > 0) || contour.ombre !== 'none', `D18 : le bouton « Ouvrir » a un indicateur de focus visible (${contour.style} ${contour.largeur}px)`);
    await ctx.close();
  }

  // =========================================================================
  section('Passe E — 390 px, accueil et menu latéral');
  // =========================================================================
  if (jouer('E')) {
    const ctx = await browser.newContext({ viewport: MOBILE });
    const page = await nouvellePage(ctx);
    await page.goto(BASE);
    await attendreAccueil(page);
    const m = await sonderMiseEnPage(page);
    verifier(m.scrollWidth <= m.vw, `E1 : accueil — aucun défilement horizontal (${m.scrollWidth} <= ${m.vw})`);
    verifier(m.debordent.length === 0, `E2 : accueil — aucun élément ne dépasse l'écran`, m.debordent.slice(0, 3).join(' ; '));
    verifier(m.sansNom.length === 0, 'E3 : accueil — tout contrôle a un nom accessible', m.sansNom.join(' ; '));
    verifier(m.petites.length === 0, 'E4 : accueil — aucune cible tactile sous 24 x 24 px (hors liens en ligne)', m.petites.join(' ; '));
    verifier(m.tronques.length === 0, 'E5 : accueil — aucun texte coupé sans possibilité de défiler', m.tronques.join(' ; '));
    for (const sel of ['#menuButton', '#modeSelector .mode-option:nth-child(1)', '#modeSelector .mode-option:nth-child(2)',
      '#themeSelector .theme-option:nth-child(1)', '#themeSelector .theme-option:nth-child(2)', '#themeSelector .theme-option:nth-child(3)', '#search']) {
      const a = await atteignable(page, sel);
      verifier(a.ok, `E6 : accueil — ${sel} est atteignable et non recouvert`, a.raison);
    }
    // Les huit catégories sont toutes atteignables, y compris Linux.
    const nbCartes = await page.locator('#categoryGrid .category-card').count();
    verifier(nbCartes === NB_CATEGORIES, `E7 : les ${NB_CATEGORIES} cartes de catégorie existent à 390 px (${nbCartes})`);
    for (let i = 0; i < nbCartes; i++) {
      const nom = await page.locator('#categoryGrid .category-card').nth(i).getAttribute('data-category');
      const a = await atteignable(page, `#categoryGrid .category-card[data-category="${nom}"]`);
      verifier(a.ok, `E8 : carte « ${nom} » atteignable et non recouverte`, a.raison);
    }
    // Panneau latéral fermé : il ne couvre rien.
    const ferme = await page.evaluate(() => {
      const p = document.querySelector('.sidebar').getBoundingClientRect();
      return { droite: p.right, ouvert: document.querySelector('.sidebar').classList.contains('open'), expanded: document.querySelector('#menuButton').getAttribute('aria-expanded') };
    });
    verifier(!ferme.ouvert && ferme.expanded === 'false' && ferme.droite <= 1,
      `E9 : menu fermé — hors de l'écran (bord droit ${Math.round(ferme.droite)}), aria-expanded=false`);

    // OUVERT : le bouton de fermeture doit rester atteignable.
    await page.click('#menuButton');
    verifier(await page.getAttribute('#menuButton', 'aria-expanded') === 'true', 'E10 : le menu s\'ouvre, aria-expanded=true');
    const aMenu = await atteignable(page, '#menuButton');
    verifier(aMenu.ok, 'E11 — AUCUN PANNEAU NE RECOUVRE SON BOUTON DE FERMETURE : #menuButton reste le premier élément à son point central', aMenu.raison);
    const panneau = await page.evaluate(() => {
      const p = document.querySelector('.sidebar').getBoundingClientRect();
      return { gauche: p.left, droite: p.right, largeur: p.width, vw: innerWidth };
    });
    verifier(panneau.gauche >= -1 && panneau.droite <= panneau.vw + 1, `E12 : le panneau ouvert tient dans l'écran (${Math.round(panneau.gauche)}..${Math.round(panneau.droite)})`);
    const entrees = await page.locator('#navigation button').count();
    verifier(entrees === NB_CATEGORIES, `E13 : le panneau ouvert propose les ${NB_CATEGORIES} catégories (${entrees})`);
    const aLinux = await atteignable(page, '#navigation button[data-category="Linux et services réseau"]');
    verifier(aLinux.ok, 'E14 : « Linux et services réseau » est atteignable dans le panneau', aLinux.raison);
    // Échap ferme et rend le focus au bouton.
    await page.keyboard.press('Escape');
    verifier(await page.getAttribute('#menuButton', 'aria-expanded') === 'false', 'E15 : Échap ferme le menu');
    verifier(await page.evaluate(() => document.activeElement?.id) === 'menuButton', 'E16 : le focus revient sur le bouton du menu');
    // Le bouton ferme aussi ce qu'il a ouvert.
    await page.click('#menuButton');
    await page.click('#menuButton');
    verifier(await page.getAttribute('#menuButton', 'aria-expanded') === 'false', 'E17 : le même bouton referme le menu');
    // Choisir une catégorie referme le menu et filtre.
    await page.click('#menuButton');
    await page.click('#navigation button[data-category="Linux et services réseau"]');
    await page.waitForFunction(() => document.querySelectorAll('#toolGrid .tool-card').length === 43, null, { timeout: 8000 });
    verifier(await page.getAttribute('#menuButton', 'aria-expanded') === 'false', 'E18 : choisir une catégorie referme le menu');
    verifier(await page.$eval('.sidebar', (e) => !e.classList.contains('open')), 'E19 : la classe « open » est retirée');
    // Liste Linux à 390 px.
    const m2 = await sonderMiseEnPage(page);
    verifier(m2.scrollWidth <= m2.vw && m2.debordent.length === 0, 'E20 : la liste des 43 outils Linux ne déborde pas à 390 px', m2.debordent.slice(0, 3).join(' ; '));
    // La recherche reste utilisable.
    await page.fill('#search', 'samba');
    const n = searchTools('samba', 'Linux et services réseau').length;
    await page.waitForFunction((k) => document.querySelectorAll('#toolGrid .tool-card').length === k, n, { timeout: 5000 });
    const m3 = await sonderMiseEnPage(page);
    verifier(m3.scrollWidth <= m3.vw && m3.debordent.length === 0, 'E21 : les résultats de recherche ne débordent pas à 390 px');
    await ctx.close();
  }

  // =========================================================================
  section('Passe F — 390 px, les 46 fiches');
  // =========================================================================
  if (jouer('F')) {
    const ctx = await browser.newContext({ viewport: MOBILE });
    for (const t of cibles) {
      const page = await nouvellePage(ctx);
      await page.goto(`${BASE}/#/outil/${t.id}`);
      await page.waitForSelector('#scriptOutput');
      const id = t.id;

      // F1 — aucun débordement, aucun texte coupé, tout est nommé.
      const m = await sonderMiseEnPage(page);
      verifier(m.scrollWidth <= m.vw, `F1 : ${id} — aucun défilement horizontal (${m.scrollWidth} <= ${m.vw})`);
      verifier(m.debordent.length === 0, `F2 : ${id} — aucun élément ne dépasse l'écran`, m.debordent.slice(0, 3).join(' ; '));
      verifier(m.sansNom.length === 0, `F3 : ${id} — tout contrôle a un nom accessible`, m.sansNom.join(' ; '));
      verifier(m.petites.length === 0, `F4 : ${id} — aucune cible tactile sous 24 x 24 px (hors liens en ligne)`, m.petites.join(' ; '));
      verifier(m.tronques.length === 0, `F5 : ${id} — aucun texte coupé sans possibilité de défiler`, m.tronques.join(' ; '));

      // F2 — le titre n'est pas tronqué et le bouton de retour est utilisable.
      const titre = await page.$eval('#toolView h1', (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, droite: e.getBoundingClientRect().right, vw: innerWidth, texte: e.textContent }));
      verifier(titre.sw <= titre.cw + 1 && titre.droite <= titre.vw + 1, `F6 : ${id} — le titre tient dans l'écran sans être coupé`);
      verifier(titre.texte.includes(t.title), `F7 : ${id} — le titre affiché est celui du catalogue`);
      const dos = await atteignable(page, '#backButton');
      verifier(dos.ok, `F8 : ${id} — « Tous les outils » est atteignable et non recouvert`, dos.raison);

      // F3 — rien n'est masqué : chaque contrôle du haut de fiche est atteignable.
      for (const sel of ['#toolForm button[type=submit]', '#copyButton', '#downloadButton', '#scriptOutput',
        '#ficheNav .fiche-nav-link:nth-child(1)', '#ficheNav .fiche-nav-link:nth-child(5)']) {
        const a = await atteignable(page, sel);
        verifier(a.ok, `F9 : ${id} — ${sel} est atteignable`, a.raison);
      }
      // Les « onglets » de la fiche (liens d'ancre) défilent dans leur rangée : aucun n'est inaccessible.
      const rangee = await page.$eval('#ficheNav', (e) => ({ ox: getComputedStyle(e).overflowX, sw: e.scrollWidth, cw: e.clientWidth }));
      verifier(rangee.sw <= rangee.cw + 1 || /auto|scroll/.test(rangee.ox),
        `F10 : ${id} — si les ancres dépassent la rangée, elle défile (overflow-x: ${rangee.ox}, ${rangee.sw}/${rangee.cw})`);
      const nbAncres = await page.locator('#ficheNav .fiche-nav-link').count();
      let ancresOk = nbAncres === 5;
      for (let i = 1; i <= nbAncres && ancresOk; i++) ancresOk = (await atteignable(page, `#ficheNav .fiche-nav-link:nth-child(${i})`)).ok;
      verifier(ancresOk, `F11 : ${id} — les ${nbAncres} ancres de la fiche sont toutes atteignables`);

      // F4 — champs : atteignables, nommés, et le formulaire fonctionne à 390 px.
      const champs = await page.$$eval('#toolForm input:not([type=hidden]), #toolForm select, #toolForm textarea', (els) => els.map((e) => e.id));
      verifier(champs.length === t.fields.length, `F12 : ${id} — les ${t.fields.length} champs du catalogue sont tous à l'écran (${champs.length})`);
      let champsOk = true; let raisonChamp = '';
      for (const cid of champs) {
        const a = await atteignable(page, `#${CSS_ESC(cid)}`);
        if (!a.ok) { champsOk = false; raisonChamp = `${cid}: ${a.raison}`; break; }
      }
      verifier(champsOk, `F13 : ${id} — chaque champ est atteignable et non recouvert`, raisonChamp);
      const labels = await page.$$eval('#toolForm label', (els) => els.length);
      verifier(labels >= champs.length, `F14 : ${id} — chaque champ a une étiquette (${labels} étiquettes / ${champs.length} champs)`);
      // Soumettre sans rien changer régénère EXACTEMENT l'aperçu initial : les
      // deux chemins de génération (ouverture, soumission) doivent s'accorder.
      const avantTexte = await page.$eval('#scriptOutput', (e) => e.textContent);
      await page.click('#toolForm button[type=submit]');
      await page.waitForFunction(() => document.querySelector('#copyFeedback').textContent.length > 0, null, { timeout: 5000 });
      const apresTexte = await page.$eval('#scriptOutput', (e) => e.textContent);
      verifier(apresTexte === avantTexte,
        `F15 : ${id} — « Générer » sans modification redonne exactement l'aperçu initial (les deux chemins s'accordent)`);
      verifier(await page.$eval('#copyButton', (e) => !e.disabled) && await page.$eval('#downloadButton', (e) => !e.disabled),
        `F16 : ${id} — Copier et Télécharger sont actifs après génération`);
      // Modifier un champ texte marque l'aperçu obsolète et verrouille Copier.
      const premierTexte = await page.$('#toolForm input[type=text], #toolForm input:not([type])');
      if (premierTexte) {
        const valeurAvant = await premierTexte.inputValue();
        await premierTexte.fill(`${valeurAvant}x`);
        verifier(await page.$eval('#copyButton', (e) => e.disabled) && await page.$eval('#scriptOutput', (e) => e.classList.contains('stale')),
          `F17 : ${id} — modifier un champ marque l'aperçu OBSOLÈTE et désactive Copier`);
        await premierTexte.fill(valeurAvant);
      }

      // F5 — aperçu : lisible, défile DANS son cadre, jamais dans la page.
      const pre = await page.$eval('#scriptOutput', (e) => {
        const s = getComputedStyle(e); const b = e.getBoundingClientRect();
        return { fs: parseFloat(s.fontSize), ox: s.overflowX, sw: e.scrollWidth, cw: e.clientWidth, droite: b.right, gauche: b.left, vw: innerWidth, tab: e.tabIndex, ws: s.whiteSpace };
      });
      verifier(pre.fs >= 12, `F18 : ${id} — l'aperçu est lisible (${pre.fs}px >= 12px)`);
      verifier(pre.droite <= pre.vw + 1 && pre.gauche >= -1, `F19 : ${id} — le cadre de l'aperçu tient dans l'écran`);
      verifier(pre.sw <= pre.cw + 1 || /auto|scroll/.test(pre.ox) || /wrap/.test(pre.ws),
        `F20 : ${id} — un aperçu plus large que l'écran défile dans son cadre (${pre.ox}, ${pre.sw}/${pre.cw})`);
      verifier(pre.tab === 0, `F21 : ${id} — l'aperçu est focalisable : on peut le faire défiler au clavier`);
      if (pre.sw > pre.cw + 1 && /auto|scroll/.test(pre.ox)) {
        const decale = await page.$eval('#scriptOutput', (e) => { e.scrollLeft = 40; return e.scrollLeft; });
        verifier(decale > 0, `F22 : ${id} — l'aperçu défile réellement horizontalement (${decale}px)`);
        verifier(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `F23 : ${id} — ce défilement ne déplace pas la page`);
      }

      // F6 — commandes lisibles : « Pour cet outil », annulation, erreurs fréquentes.
      for (const detail of ['#execNotes', '#verifyAfter', '#rollbackBlock', '#guiMethod', '#commonErrors']) {
        await page.evaluate((sel) => { document.querySelector(sel).open = true; }, detail);
      }
      const cmds = await page.$$eval('#toolView pre.cmd', (els) => els.map((e) => {
        const s = getComputedStyle(e); const b = e.getBoundingClientRect();
        return { fs: parseFloat(s.fontSize), ox: s.overflowX, ws: s.whiteSpace, sw: e.scrollWidth, cw: e.clientWidth, droite: b.right, vw: innerWidth, vide: e.textContent.trim() === '' };
      }));
      verifier(cmds.length > 0, `F24 : ${id} — des blocs de commandes existent à l'écran (${cmds.length})`);
      verifier(cmds.every((c) => c.fs >= 12 && !c.vide), `F25 : ${id} — chaque bloc de commandes est non vide et lisible (>= 12px)`);
      verifier(cmds.every((c) => c.droite <= c.vw + 1), `F26 : ${id} — aucun bloc de commandes ne dépasse l'écran`);
      verifier(cmds.every((c) => c.sw <= c.cw + 1 || /auto|scroll/.test(c.ox) || /wrap/.test(c.ws)),
        `F27 : ${id} — un bloc de commandes trop large défile dans son cadre, ou passe à la ligne`);
      const m4 = await sonderMiseEnPage(page);
      verifier(m4.scrollWidth <= m4.vw && m4.debordent.length === 0 && m4.tronques.length === 0,
        `F28 : ${id} — avec TOUTES les sections dépliées, aucun débordement ni texte coupé`, [...m4.debordent, ...m4.tronques].slice(0, 3).join(' ; '));
      // Les tables (obstacles, stratégies) doivent défiler dans leur cadre.
      const tables = await page.$$eval('#toolView table', (els) => els.map((e) => {
        const b = e.getBoundingClientRect();
        let p = e.parentElement; let cadre = null;
        while (p && p !== document.body) { if (/auto|scroll/.test(getComputedStyle(p).overflowX)) { cadre = p; break; } p = p.parentElement; }
        return { droite: b.right, vw: innerWidth, cadre: Boolean(cadre) };
      }));
      verifier(tables.every((x) => x.droite <= x.vw + 1 || x.cadre), `F29 : ${id} — les tables tiennent dans l'écran ou défilent dans un cadre`);
      await page.close();
    }
    await ctx.close();
  }

  // =========================================================================
  section('Passe G — 390 px, les deux modes de lecture et les trois thèmes');
  // =========================================================================
  if (jouer('G')) {
    const echantillon = ['nfs-export-create', 'samba-ad-dc-readiness', 'linux-disk-partition-mount', 'windows-domain-join', 'ssh-hardening-audit'];
    for (const mode of ['debutant', 'technicien']) {
      for (const theme of ['clair', 'sombre', 'systeme']) {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: theme === 'sombre' ? 'dark' : 'light' });
        await ctx.addInitScript(([m, th]) => {
          try { localStorage.setItem('kjemo.mode.v1', m); localStorage.setItem('kjemo.theme.v1', th); } catch { /* sans stockage */ }
        }, [mode, theme]);
        const page = await nouvellePage(ctx);
        for (const id of echantillon) {
          await page.goto(`${BASE}/#/outil/${id}`);
          await page.waitForSelector('#scriptOutput');
          await page.reload();
          await page.waitForSelector('#scriptOutput');
          const etat = await page.evaluate(() => ({ mode: document.body.dataset.mode, theme: document.documentElement.dataset.theme }));
          verifier(etat.mode === mode && etat.theme === theme, `G1 : ${id} — mode ${mode}, thème ${theme} appliqués (${etat.mode}/${etat.theme})`);
          const m = await sonderMiseEnPage(page);
          verifier(m.scrollWidth <= m.vw && m.debordent.length === 0,
            `G2 : ${id} — mode ${mode}, thème ${theme} : aucun débordement à 390 px`, m.debordent.slice(0, 3).join(' ; '));
          verifier(m.sansNom.length === 0 && m.petites.length === 0 && m.tronques.length === 0,
            `G3 : ${id} — mode ${mode}, thème ${theme} : contrôles nommés, cibles >= 24px, aucun texte coupé`,
            [...m.sansNom, ...m.petites, ...m.tronques].slice(0, 3).join(' ; '));
          for (const sel of ['#toolForm button[type=submit]', '#copyButton', '#downloadButton']) {
            const a = await atteignable(page, sel);
            verifier(a.ok, `G4 : ${id} — mode ${mode}, thème ${theme} : ${sel} atteignable`, a.raison);
          }
          // Contraste du corps : un fond explicite, jamais transparent.
          const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
          verifier(!/rgba\(0, 0, 0, 0\)|transparent/.test(fond), `G5 : ${id} — thème ${theme} : le corps porte un fond explicite (${fond})`);
        }
        await ctx.close();
      }
    }
  }

  // =========================================================================
  section('Passe H — les commandes rapides ne sont affichées par aucun écran (et le banc le garde)');
  // =========================================================================
  if (jouer('H')) {
    const app = readFileSync(resolve(ROOT, 'dist/app.js'), 'utf8');
    const gen = readFileSync(resolve(ROOT, 'dist/generators.mjs'), 'utf8');
    const importeRapides = (src) => /from\s+['"]\.\/commandes-[a-z-]+\.mjs['"]/.test(src) || /import\(\s*['"]\.\/commandes-/.test(src);
    verifier(!importeRapides(app) && !importeRapides(gen),
      'H1 : app.js et generators.mjs n\'importent aucun module de commandes rapides — leur lisibilité à 390 px n\'est donc PAS testable. '
      + 'Si cette vérification échoue, une interface les affiche : étendre ce banc (390 px, lisibilité, copie sans commentaire) AVANT de la livrer.');
    // Contre-épreuve : le détecteur voit bien un import, s'il y en a un.
    verifier(importeRapides("import { COMMANDES } from './commandes-nfs.mjs';"), 'H2 — contre-épreuve : le détecteur reconnaît un import statique');
    verifier(importeRapides("const m = await import('./commandes-stockage.mjs');"), 'H3 — contre-épreuve : le détecteur reconnaît un import dynamique');
    verifier(!importeRapides("import { tools } from './generators.mjs';"), 'H4 : le détecteur n\'accuse pas un import ordinaire');
  }

  // =========================================================================
  section('Passe I — aucune erreur de page, sur toute la durée du banc');
  // =========================================================================
  verifier(erreursPage.length === 0, `I1 : aucune erreur JavaScript ni console.error (${erreursPage.length})`, erreursPage.slice(0, 3).join(' ; '));
} catch (e) {
  // Une passe interrompue (sélecteur absent, délai dépassé) est un ÉCHEC étiqueté,
  // jamais une sortie silencieuse : la vérification qui n'a pas pu avoir lieu n'est pas verte.
  verifier(false, `Z0 : le banc s'est interrompu pendant « ${passeCourante} »`, String(e && e.message ? e.message : e).split('\n')[0]);
} finally {
  await browser.close();
  server.close();
  rmSync(dossierTmp, { recursive: true, force: true });
}

/** Échappe un identifiant pour un sélecteur CSS. */
function CSS_ESC(id) { return String(id).replace(/([^a-zA-Z0-9_-])/g, '\\$1'); }

console.log('');
console.log(`Navigateur LOT 7 : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Chromium réel, 390 px et 1280 px. Les commandes rapides ne sont affichées par aucun écran : non testables à l\'écran.');
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
