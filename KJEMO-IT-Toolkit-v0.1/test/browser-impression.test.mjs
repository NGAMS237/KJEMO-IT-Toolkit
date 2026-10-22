#!/usr/bin/env node
/**
 * browser-impression.test.mjs — LOT 9 Imprimantes · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Banc Playwright (Chromium headless) pour les 15 fiches Imprimantes.
 *
 * CE QUE CE BANC PROUVE : le comportement de l'interface dans un vrai
 * navigateur — catégorie et sous-rubriques, recherche, routes #/outil/<id>,
 * aperçu = generate(), validation (cibles hostiles, phrase de confirmation),
 * invalidation de l'aperçu, copie, téléchargement (.ps1 AVEC BOM, .sh SANS BOM
 * et en LF), bloc pédagogique Imprimantes, affichage mobile.
 * CE QU'IL NE PROUVE PAS : l'effet d'un script sur une imprimante, un spouleur
 * ou un CUPS réels (NON EXÉCUTÉ). Le site n'exécute rien.
 *
 * Usage : node test/browser-impression.test.mjs   (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const { tools } = await imp('generators.mjs');
const { SOUS_RUBRIQUES_IMPRESSION } = await imp('categories.mjs');
const { normalizeScriptSh } = await imp('noyau-bash.mjs');

const CAT = 'Imprimantes';
const outils = tools.filter((t) => t.category === CAT);
const T = (id) => outils.find((t) => t.id === id);
const estSh = (t) => t.id.startsWith('imp-cups-');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const server = await new Promise((res) => {
  const s = createServer((req, rep) => {
    const p = req.url.split('?')[0];
    try {
      const f = resolve(ROOT, 'dist', '.' + (p === '/' ? '/index.html' : p));
      rep.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
      rep.end(readFileSync(f));
    } catch { rep.writeHead(404); rep.end('Not found'); }
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const BASE = `http://127.0.0.1:${server.address().port}`;
const CH_ENV = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const CH_FALLBACK = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CH = CH_ENV && CH_ENV.trim() ? CH_ENV.trim() : existsSync(CH_FALLBACK) ? CH_FALLBACK : null;
console.log(`Serveur local : ${BASE}\nChromium      : ${CH ?? '(Playwright default)'}`);
const browser = await chromium.launch({ headless: true, ...(CH ? { executablePath: CH } : {}),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });

let passed = 0; let failed = 0;
function assert(cond, label, detail = '') {
  if (cond) { passed++; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${label}`); }
  else { failed++; console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`); }
}
const defaults = (t) => Object.fromEntries(t.fields.map((f) => [f.id, f.type === 'checkbox' ? !!f.default : String(f.default ?? '')]));
const attendu = (t, v) => (estSh(t) ? normalizeScriptSh(t.generate(v)) : t.generate(v));

async function ouvrir(tool, { width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const problemes = [];
  page.on('pageerror', (e) => problemes.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problemes.push('console: ' + m.text()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: BASE }).catch(() => {});
  await page.bringToFront();
  await page.goto(`${BASE}/#/outil/${tool.id}`);
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  return { context, page, problemes };
}
const remplir = async (page, id, val) => {
  const el = page.locator(`#${id}`);
  const tag = await el.evaluate((e) => e.tagName);
  if (tag === 'SELECT') await el.selectOption(val); else await el.fill(String(val));
};
const lirePre = (page) => page.$eval('#scriptOutput', (e) => e.textContent);
const desactives = async (page) => ({ copie: await page.locator('#copyButton').isDisabled(), telech: await page.locator('#downloadButton').isDisabled() });

// ---------------------------------------------------------------------------
console.log('\n[accueil] catégorie, sous-rubriques, recherche');
assert(outils.length === 15, '15 fiches Imprimantes dans le catalogue', String(outils.length));
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const problemes = [];
  page.on('pageerror', (e) => problemes.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('#toolGrid .open-tool');
  assert(await page.locator('#toolGrid .open-tool').count() === tools.length, 'la grille affiche tous les outils du catalogue');
  const cartes = await page.$$eval('#categoryGrid .category-card', (els) => els.map((e) => e.dataset.category));
  assert(cartes.includes(CAT), 'la carte « Imprimantes » est proposée');
  assert(cartes.length === 11, `11 cartes de catégorie, « Tout » comprise (${cartes.length})`);
  await page.click(`#categoryGrid .category-card[data-category="${CAT}"]`);
  await page.waitForTimeout(300);
  assert(await page.locator('#toolGrid .open-tool').count() === 15, 'la catégorie affiche ses 15 outils');
  const txt = await page.$eval('#home', (e) => e.textContent);
  for (const s of SOUS_RUBRIQUES_IMPRESSION) assert(txt.includes(s), `sous-rubrique visible : ${s}`);
  for (const [q, id] of [['spouleur', 'imp-win-spouleur'], ['cups', 'imp-cups-inventaire'], ['file d’impression', 'imp-win-diagnostic-file'], ['page de test', 'imp-win-page-test'], ['lpstat', 'imp-cups-diagnostic-file'], ['imprimante par défaut', 'imp-win-defaut']]) {
    await page.click('#searchClear').catch(() => {});
    await page.click('#categoryGrid .category-card[data-category="Tout"]');
    await page.fill('#search', q);
    await page.waitForTimeout(250);
    const grille = await page.$eval('#toolGrid', (e) => e.textContent);
    assert(grille.includes(T(id).title), `la recherche « ${q} » retrouve ${id}`);
  }
  assert(problemes.length === 0, 'aucune erreur JS sur l’accueil', problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
for (const tool of outils) {
  console.log(`\n[${tool.id}] route · aperçu · bloc · copie · téléchargement`);
  const { context, page, problemes } = await ouvrir(tool);
  const sh = estSh(tool);
  const ref = attendu(tool, defaults(tool));
  assert(await page.locator('#toolView').isVisible(), 'route directe #/outil/<id> : la fiche s’ouvre');
  const pre = await lirePre(page);
  assert(pre.replace(/\r/g, '') === ref.replace(/\r/g, ''), 'aperçu initial = generate(défauts) (hors CR de plateforme)');
  const bandeau = await page.$eval('#plateformeBandeau', (e) => e.textContent);
  assert(sh ? /Bash/.test(bandeau) : /PowerShell/.test(bandeau), `bandeau : ${sh ? 'Script Bash' : 'Script PowerShell'}`);
  assert(await page.locator('#impressionBloc').count() === 1, 'bloc pédagogique Imprimantes présent');
  const bloc = await page.$eval('#impressionBloc', (e) => e.textContent);
  for (const mot of ['Le problème', 'Exemple en entreprise', 'Première vérification', 'Ce qui est lu', 'Limites de cet assistant']) {
    assert(bloc.includes(mot), `bloc Imprimantes : « ${mot} »`);
  }
  if (tool.fields.some((f) => f.id === 'impConfirmation')) {
    // Fiche qui MODIFIE : ce qui est écrit, les effets et l'absence de simulation native doivent être visibles.
    assert(bloc.includes('Ce qui est écrit') && bloc.includes('Effets'), 'fiche d’action : « Ce qui est écrit » et « Effets » visibles');
    assert(tool.impression.limites.every((l) => bloc.includes(l.slice(0, 40))), 'fiche d’action : toutes les limites de la fiche sont affichées');
  } else {
    assert(/ne prouve|ne prouvent|pas qu|n’est pas/i.test(bloc), 'fiche de lecture : la limite « ne prouve pas qu’une page sortira » est visible');
  }
  const sources = await page.$eval('#officialSources', (e) => e.innerHTML);
  assert(sh ? /openprinting\.github\.io/.test(sources) : /learn\.microsoft\.com/.test(sources), 'sources : officielles (OpenPrinting pour CUPS, Microsoft pour Windows)');

  // Le formulaire génère à la demande : on génère, puis on copie.
  await page.click('button[type=submit]');
  await page.click('#copyButton');
  let presse = null;
  try { presse = await Promise.race([page.evaluate(() => navigator.clipboard.readText()), new Promise((_, rj) => setTimeout(() => rj(new Error('délai dépassé')), 8000))]); } catch (e) { assert(false, 'presse-papiers accessible', e.message); }
  if (presse !== null) assert(presse.replace(/\r/g, '') === ref.replace(/\r/g, ''), 'copie = aperçu (hors CR de plateforme)');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadButton')]);
  assert(dl.suggestedFilename() === (sh ? `${tool.id}.sh` : `${tool.id}.ps1`), 'nom de fichier <id>.ps1 / <id>.sh', dl.suggestedFilename());
  const octets = readFileSync(await dl.path());
  const bom = octets[0] === 0xEF && octets[1] === 0xBB && octets[2] === 0xBF;
  if (sh) {
    assert(!bom, 'téléchargement .sh : AUCUN BOM (il casserait le shebang)');
    assert(!octets.includes(0x0D), 'téléchargement .sh : LF seul (aucun CR)');
    assert(octets.toString('utf8').startsWith('#!/usr/bin/env bash'), 'téléchargement .sh : commence par le shebang');
  } else {
    assert(bom, 'téléchargement .ps1 : BOM UTF-8 présent (PowerShell 5.1)');
  }
  assert(problemes.length === 0, 'aucune erreur JS / console', problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('\n[validation] cibles hostiles, phrase de confirmation, invalidation de l’aperçu');
async function essaiInvalide(tool, id, valeur, label, motif, avant = {}) {
  const { context, page } = await ouvrir(tool);
  for (const [k, v] of Object.entries(avant)) await remplir(page, k, v);
  await page.click('button[type=submit]');
  const base = await lirePre(page);
  await remplir(page, id, valeur);
  const d0 = await desactives(page);
  assert(d0.copie && d0.telech, `${label} : copie/téléchargement désactivés dès la modification`);
  await page.click('button[type=submit]');
  const span = page.locator(`#${id}-error`);
  assert(await span.isVisible(), `${label} : message d’erreur affiché`);
  if (motif) assert(motif.test(await span.textContent()), `${label} : message attendu`, await span.textContent());
  assert((await lirePre(page)) === base, `${label} : l’aperçu n’est pas régénéré`);
  const d = await desactives(page);
  assert(d.copie && d.telech, `${label} : copie/téléchargement restent désactivés après refus`);
  const t = tool.fields.find((f) => f.id === id);
  await remplir(page, id, String(avant[id] ?? t.default ?? ''));
  await page.click('button[type=submit]');
  assert(!(await span.isVisible()), `${label} : l’erreur disparaît après correction`);
  assert(!(await desactives(page)).copie, `${label} : copie réactivée après correction`);
  await context.close();
}
await essaiInvalide(T('imp-win-diagnostic-file'), 'impNom', 'HP*', 'joker dans le nom d’imprimante');
await essaiInvalide(T('imp-win-diagnostic-file'), 'impNom', 'Accueil"; Remove-Printer -Name *', 'injection par guillemet');
await essaiInvalide(T('imp-win-reseau'), 'impHote', '192.168.30.50; calc', 'injection ; dans l’hôte');
await essaiInvalide(T('imp-win-reseau'), 'impHote', 'a b', 'espace dans l’hôte');
await essaiInvalide(T('imp-win-partage-unc'), 'impUnc', 'srv-print\\Compta', 'UNC sans double barre');
await essaiInvalide(T('imp-cups-inventaire'), 'impDest', 'HP LaserJet; cancel -a', 'injection dans la destination CUPS');
await essaiInvalide(T('imp-cups-diagnostic-file'), 'impDest', '$(id)', 'substitution de commande dans la destination');
await essaiInvalide(T('imp-cups-annuler-travail'), 'impJob', '0', 'numéro de travail 0');

// Phrase de confirmation : sans la phrase exacte, pas de script d'action.
{
  const t = T('imp-win-defaut');
  const { context, page } = await ouvrir(t);
  await remplir(page, 'impMode', 'Appliquer');
  await page.click('button[type=submit]');
  const span = page.locator('#impConfirmation-error');
  assert(await span.isVisible(), 'imp-win-defaut : mode Appliquer sans phrase → message d’erreur');
  const msg = await span.textContent();
  const m = /« (.+?) »/.exec(msg);
  assert(m !== null, 'imp-win-defaut : le message donne la phrase exacte à recopier', msg);
  assert((await desactives(page)).telech, 'imp-win-defaut : téléchargement désactivé sans phrase');
  await remplir(page, 'impConfirmation', 'oui');
  await page.click('button[type=submit]');
  assert(await span.isVisible() && (await desactives(page)).telech, 'imp-win-defaut : « oui » ne suffit pas');
  if (m) {
    await remplir(page, 'impConfirmation', m[1]);
    await page.click('button[type=submit]');
    assert(!(await span.isVisible()) && !(await desactives(page)).telech, 'imp-win-defaut : phrase exacte → script généré, téléchargement actif');
  }
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('\n[mobile] 390 × 844');
for (const id of ['imp-win-inventaire', 'imp-cups-reactiver-file']) {
  const { context, page, problemes } = await ouvrir(T(id), { width: 390, height: 844 });
  const defile = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!defile, `${id} : aucun défilement horizontal de la page`);
  assert(await page.locator('#impressionBloc').isVisible(), `${id} : le bloc Imprimantes est visible`);
  assert(await page.locator('button[type=submit]').isVisible(), `${id} : le bouton de génération est visible`);
  assert(problemes.length === 0, `${id} : aucune erreur JS`, problemes.join(' | '));
  await context.close();
}

await browser.close();
server.close();
console.log(`\nBanc navigateur Imprimantes : ${passed} OK, ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
