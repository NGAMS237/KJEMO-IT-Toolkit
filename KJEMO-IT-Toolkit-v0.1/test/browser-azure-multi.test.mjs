#!/usr/bin/env node
/**
 * browser-azure-multi.test.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * Banc Playwright des fiches Azure à trois méthodes : l'onglet portail est ouvert
 * en premier (débutant), les écrans reconstitués s'affichent (accessibles, sans
 * débordement à 390 px), PowerShell et CLI offrent leurs boutons de copie, le
 * montage VNETDemo et les équilibreurs s'ouvrent, aucune erreur de page.
 * NE PROUVE PAS l'effet d'une commande sur un abonnement Azure (NON EXÉCUTÉ).
 * Usage : node test/browser-azure-multi.test.mjs   (exit 0 = tout OK)
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



const FICHES = ['cours-az-tp-demo-webapp-stockage-prive', 'cours-az-vnet-creer', 'cours-az-appgw-creer', 'cours-az-frontdoor-creer'];
for (const id of FICHES) {
  const { context, page, erreurs } = await nouvellePage({}, `/#/tache/${id}`);
  await page.waitForSelector('.tache');
  const actif = await page.locator('.method-tab.is-active').getAttribute('data-methode');
  assert(actif === 'gui', `${id} : l’onglet du portail est ouvert en premier`, actif);
  const onglets = await page.locator('.method-tab').evaluateAll((l) => l.map((x) => x.dataset.methode).join());
  assert(onglets === 'gui,powershell,azure', `${id} : trois onglets dans l’ordre débutant`, onglets);
  await page.waitForSelector('#panneau-methode .ecran-svg', { state: 'attached' });
  const n = await page.locator('#panneau-methode figure.ecran').count();
  assert(n >= 3, `${id} : les écrans reconstitués sont affichés (${n})`);
  assert(await page.locator('#panneau-methode figure.ecran svg[role="img"] title').count() === n, `${id} : chaque écran a un titre accessible`);
  const lg = await page.locator('#panneau-methode figcaption').first().innerText();
  assert(/pas une capture/.test(lg), `${id} : la légende dit « pas une capture »`);
  await page.click('#tab-powershell');
  await page.waitForSelector('#panneau-methode .cmd-pre.cmd-powershell');
  assert(await page.locator('#panneau-methode .copy-step').count() >= 2, `${id} : PowerShell a ses boutons de copie`);
  assert(await page.locator('#panneau-methode figure.ecran').count() === 0, `${id} : PowerShell n’affiche pas d’écran du portail`);
  await page.click('#tab-azure');
  await page.waitForSelector('#panneau-methode .cmd-pre');
  assert(/\baz\b/.test(await page.locator('#panneau-methode .cmd-pre').first().innerText()), `${id} : la CLI affiche des commandes az`);
  assert(erreurs.length === 0, `${id} : aucune erreur de page`, erreurs.join(' | '));
  await context.close();
}

// Étroit : pas de débordement avec un écran
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 800 } }, '/#/tache/cours-az-tp-demo-webapp-stockage-prive');
  await page.waitForSelector('#panneau-methode .ecran-svg', { state: 'attached' });
  assert(!(await debordement(page)), 'montage VNETDemo : pas de débordement horizontal à 390 px');
  await context.close();
}

// Le filtre Azure garde le portail en premier
{
  const { context, page } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Azure');
  await page.goto(`${BASE}/#/tache/cours-az-lb-creer`);
  await page.waitForSelector('.tache');
  assert(await page.locator('.method-tab.is-active').getAttribute('data-methode') === 'gui', 'filtre Azure : le portail reste l’onglet de départ');
  await context.close();
}

// Les cours liés ouvrent une étape de la CLI (numérotation par méthode)
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/cours/azure-tp-demo-webapp-stockage');
  await page.waitForSelector('a[href*="/tache/cours-az-tp-demo-webapp-stockage-prive"]', { state: 'attached' });
  const liens = await page.locator('a[href*="/tache/cours-az-tp-demo-webapp-stockage-prive"]').evaluateAll((l) => l.map((x) => x.getAttribute('href')));
  assert(liens.length >= 3 && liens.every((h) => /methode\/azure/.test(h)), `cours Démo : ${liens.length} liens vers la fiche, tous sur la méthode CLI`, liens[0]);
  assert(erreurs.length === 0, 'cours Démo : aucune erreur de page', erreurs.join(' | '));
  await context.close();
}

await browser.close(); server.close();
console.log(`browser-azure-multi : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (abonnement Azure) : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
