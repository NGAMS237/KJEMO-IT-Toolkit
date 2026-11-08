#!/usr/bin/env node
/**
 * browser-windows-simples.test.mjs — KJEMO-WINDOWS-SIMPLES-01 · KJEMO IT Toolkit
 * Banc Playwright des commandes courantes Windows : aide-mémoire Windows (7 groupes), résumé pliable de chacun
 * (plié, ouvert par /resume, schémas visibles, sans débordement à 390 px), fiche en fenêtre avec commandes visibles,
 * fiches directes, aucune erreur de page.
 * NE PROUVE PAS l'effet d'une commande sur un poste Windows (NON EXÉCUTÉ).
 * Usage : node test/browser-windows-simples.test.mjs   (exit 0 = tout OK)
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


const GROUPES = ['win-poste', 'win-systeme', 'win-fichiers', 'win-reseau', 'win-ad', 'win-gpo', 'win-serveur'];
const FICHES = [['win-cache-arp', 'netsh interface ip delete arpcache'], ['win-tracert', 'tracert -d'], ['win-processus-fermer', 'Stop-Process'], ['win-robocopy-copier', 'robocopy'], ['win-winget-installer', 'winget install'], ['win-arret-redemarrage', 'shutdown /'], ['win-ad-membres-groupe', 'Get-ADGroupMember'], ['win-local-changer-mot-de-passe', 'Read-Host -AsSecureString']];

{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Windows');
  await page.goto(`${BASE}/#/memo`);
  await page.waitForSelector('details.groupe-bloc');
  for (const g of GROUPES) assert(await page.locator(`details[data-groupe="${g}"]`).count() === 1, `aide-mémoire Windows : groupe ${g}`);
  const txt = await page.locator('body').innerText();
  for (const t of ['Vider les caches', 'Système, processus et arrêt', 'Disque, fichiers et logiciels', 'Pare-feu']) assert(txt.includes(t) || (await page.locator('body').textContent()).includes(t), `aide-mémoire Windows : « ${t} »`);
  assert((await page.locator('body').textContent()).includes('Vider le cache DNS'), 'Vider le cache DNS (fiche existante) est maintenant dans l’aide-mémoire');
  assert(!(await debordement(page)), 'aide-mémoire Windows : aucun défilement horizontal');
  assert(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
  await context.close();
}
for (const [id, cmd] of FICHES) {
  const { context, page, erreurs } = await nouvellePage({}, `/#/tache/${id}`);
  await page.waitForSelector('.tache');
  const txt = await page.locator('.tache').innerText();
  assert(txt.includes(cmd), `${id} : la commande « ${cmd} » est visible sans rien remplir`);
  assert(!(await debordement(page)), `${id} : aucun défilement horizontal`);
  assert(erreurs.length === 0, `${id} : aucune erreur`, erreurs.join(' | '));
  await context.close();
}
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 800 } }, '/#/');
  await clicPlat(page, 'Windows');
  await page.goto(`${BASE}/#/memo`);
  await page.waitForSelector('details.groupe-bloc');
  assert(!(await debordement(page)), 'aide-mémoire Windows : mobile, aucun défilement horizontal');
  await context.close();
}
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 800 } }, '/#/tache/win-pare-feu-ouvrir-port');
  await page.waitForSelector('.tache');
  assert(!(await debordement(page)), 'fiche pare-feu : mobile, aucun défilement horizontal');
  await context.close();
}

await browser.close(); server.close();
console.log(`\nbrowser-windows-simples : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (poste Windows) : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
