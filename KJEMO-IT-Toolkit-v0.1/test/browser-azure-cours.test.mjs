#!/usr/bin/env node
/**
 * browser-azure-cours.test.mjs — KJEMO-AZURE-COURS-01 · KJEMO IT Toolkit
 * Banc Playwright des cours Azure : liste des cinq cours Azure, résumé pliable de chacun
 * (plié, ouvert par /resume, schémas visibles, sans débordement à 390 px), fiche en fenêtre avec commandes visibles,
 * aide-mémoire Azure (quatre groupes), aucune erreur de page.
 * NE PROUVE PAS l'effet d'une commande sur un abonnement Azure (NON EXÉCUTÉ).
 * Usage : node test/browser-azure-cours.test.mjs   (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const { COURS } = await imp('cours.mjs');
const CAPTURES = process.env.KJEMO_CAPTURES ? resolve(process.env.KJEMO_CAPTURES) : null;
if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });

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
const browser = await chromium.launch({ headless: true, ...(CH ? { executablePath: CH } : {}),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });

let passed = 0; let failed = 0;
function assert(cond, label, detail = '') {
  if (cond) { passed++; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${label}`); }
  else { failed++; console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`); }
}
async function nouvellePage(opts = {}, hash = '/', { stockageBloque = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...opts });
  if (stockageBloque) {
    await context.addInitScript(() => {
      const refus = () => { throw new DOMException('refusé', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { get: refus });
    });
  }
  const page = await context.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(BASE + hash);
  await page.waitForSelector('h1', { state: 'attached' });
  return { context, page, erreurs };
}

const debordement = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const clicPlat = async (page, p) => { await page.click(`#platFilters [data-plat="${p}"]`); };


const NOUVEAUX = ['azure-01-02-infonuagique-azure', 'azure-03-reseau-virtuel', 'azure-04-resolution-noms', 'azure-05-peering-routage', 'azure-06-07-acces-prive-equilibrage'];
const SCHEMAS = Object.fromEntries(NOUVEAUX.map((id) => [id, COURS.find((c) => c.id === id).rappelCours.sections.reduce((n, s) => n + (s.schemas ?? []).length, 0)]));

{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Azure');
  await page.goto(`${BASE}/#/cours`);
  await page.waitForSelector('.cours-carte');
  assert(await page.locator('.cours-carte').count() === 10, 'filtre Azure : dix cours');
  for (const id of NOUVEAUX) assert(await page.locator(`[data-resume="${id}"]`).count() === 1, `lien « Résumé du cours » : ${id}`);
  assert(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
  await context.close();
}
for (const id of NOUVEAUX) {
  const { context, page, erreurs } = await nouvellePage({}, `/#/cours/${id}/A`);
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === false, `${id} : résumé plié par défaut`);
  await page.click('#resume-cours > summary');
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === true, `${id} : un clic déplie`);
  assert(await page.locator('#resume-cours figure.schema').count() === SCHEMAS[id], `${id} : ${SCHEMAS[id]} schéma(s) dans le résumé`);
  assert(await page.locator('#resume-cours figure.schema svg').first().isVisible(), `${id} : un schéma est visible`);
  const w = await page.locator('#resume-cours figure.schema svg').first().boundingBox();
  assert(w && w.width > 300 && w.height > 100, `${id} : taille lisible`, JSON.stringify(w));
  assert(await page.locator('.rappel-question').count() >= 3, `${id} : au moins trois questions repliées`);
  assert(erreurs.length === 0, `${id} : aucune erreur de page`, erreurs.join(' | '));
  await context.close();
}
for (const id of NOUVEAUX) {
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 800 } }, `/#/cours/${id}/resume`);
  assert(!(await debordement(page)), `${id} : mobile, aucun défilement horizontal`);
  const largeurs = await page.locator('#resume-cours figure.schema svg').evaluateAll((l) => l.map((e) => e.getBoundingClientRect().width));
  assert(largeurs.length === SCHEMAS[id] && largeurs.every((x) => x <= 390), `${id} : mobile, chaque schéma tient dans l’écran`, largeurs.join());
  await context.close();
}
// Fiche directe : commandes az visibles, schémas, aucun débordement
for (const [id, cmd, nbSchemas] of [['cours-az-peering-creer', 'az network vnet peering create', null], ['cours-az-lb-creer', 'az network lb create', null], ['cours-az-vnet-creer', 'az network vnet create', null]]) {
  const { context, page, erreurs } = await nouvellePage({}, `/#/tache/${id}/methode/azure`);
  await page.waitForSelector('.tache');
  const txt = await page.locator('.tache').innerText();
  assert(txt.includes(cmd), `${id} : la commande « ${cmd} » est visible`);
  assert(await page.locator('.tache #schemas-fiche svg').count() >= 1, `${id} : au moins un schéma`);
  assert(!(await debordement(page)), `${id} : aucun défilement horizontal`);
  assert(erreurs.length === 0, `${id} : aucune erreur`, erreurs.join(' | '));
  await context.close();
}
// Ambiguïtés visibles dans la page du cours
{
  const { context, page } = await nouvellePage({}, '/#/cours/azure-06-07-acces-prive-equilibrage/A');
  const txt = await page.locator('body').textContent();
  assert(txt.includes('AZ06-1') || /point de terminaison/i.test(txt), 'cours 06/07 : l’ambiguïté sur la diapositive est affichée');
  await context.close();
}
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Azure');
  await page.goto(`${BASE}/#/memo`);
  await page.waitForTimeout(600);
  const txt = await page.locator('body').innerText();
  for (const g of ['Azure']) assert(txt.includes(g), 'aide-mémoire Azure affiché');
  for (const id of ['az-base', 'az-reseau', 'az-routage-prive', 'az-equilibrage']) assert(await page.locator(`details[data-groupe="${id}"]`).count() === 1, `aide-mémoire Azure : groupe ${id}`);
  assert(erreurs.length === 0, 'aucune erreur', erreurs.join(' | '));
  await context.close();
}

await browser.close(); server.close();
console.log(`\nbrowser-azure-cours : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (abonnement Azure) : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
