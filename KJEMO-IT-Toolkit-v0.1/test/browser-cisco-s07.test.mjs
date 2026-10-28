#!/usr/bin/env node
/**
 * browser-cisco-s07.test.mjs — KJEMO-CISCO-S07-01 · KJEMO IT Toolkit
 * Banc Playwright du cours Cisco S07 : résumé pliable (plié par défaut, ouvert par /resume, état conservé quand on
 * coche un élément, clavier), schémas SVG visibles et sans débordement (desktop et mobile 390 px), fiche en fenêtre
 * avec schémas et rappel plié, filtre Cisco de l'aide-mémoire, aucune erreur de page.
 * NE PROUVE PAS l'effet d'une commande sur un équipement (NON EXÉCUTÉ).
 * Usage : node test/browser-cisco-s07.test.mjs   (exit 0 = tout OK)
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


const ID = 'cisco-s07-etherchannel';
// 1. Résumé plié par défaut, déplié par /resume
{
  const { context, page, erreurs } = await nouvellePage({}, `/#/cours/${ID}/A`);
  assert(await page.locator('#resume-cours').count() === 1, 'le résumé existe');
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === false, 'plié par défaut');
  assert(!(await page.locator('#resume-cours figure.schema').first().isVisible()), 'plié : les schémas ne sont pas visibles');
  await page.click('#resume-cours > summary');
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === true, 'un clic sur le titre déplie');
  assert(await page.locator('#resume-cours figure.schema').count() === 8, '8 schémas dans le résumé');
  assert(await page.locator('#resume-cours figure.schema svg').first().isVisible(), 'les schémas deviennent visibles');
  const w = await page.locator('#resume-cours figure.schema svg').first().boundingBox();
  assert(w && w.width > 300 && w.height > 100, 'un schéma a une taille lisible', JSON.stringify(w));
  // cocher un élément redessine la page : le résumé reste ouvert
  await page.check('input[data-item="A1"]');
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === true, 'cocher un élément conserve l’état ouvert');
  await page.click('#resume-cours > summary');
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === false, 'un second clic replie');
  // question : réponse cachée jusqu'au clic, au clavier
  await page.click('#resume-cours > summary');
  const q = page.locator('.rappel-question').first();
  assert(!(await q.locator('.rappel-reponse').isVisible()), 'réponse de la question cachée');
  await q.locator('summary').focus(); await page.keyboard.press('Enter');
  assert(await q.locator('.rappel-reponse').isVisible(), 'Entrée ouvre la réponse');
  assert(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
  await context.close();
}
{
  const { context, page } = await nouvellePage({}, `/#/cours/${ID}/resume`);
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === true, '/resume : déplié d’emblée');
  await context.close();
}
// 2. Liste des cours Cisco
{
  const { context, page } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Cisco');
  assert(await page.locator('#porteTpBtn').isVisible() && await page.locator('#porteTpTitre').innerText().then((t) => t.includes('Mes cours Cisco')), 'Cisco : la porte « Mes cours Cisco » a son cours (plus de carte « Bientôt »)');
  assert(await page.locator('#home .groupe-carte').count() === 4, 'Cisco : quatre cartes d’aide-mémoire (Adressage et routage, Accès et ports, VLAN VTP DTP, Commutation Cisco)');
  await page.goto(`${BASE}/#/cours`);
  await page.waitForSelector('.cours-carte');
  assert(await page.locator('.cours-carte').count() === 6, 'filtre Cisco : six cours (semaines 1, 2, 2-3, 5, 7 et TP2)');
  await page.click(`[data-resume="${ID}"]`);
  await page.waitForSelector('#resume-cours');
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === true, 'le lien « Résumé du cours » ouvre le résumé');
  await context.close();
}
// 3. Fiche en fenêtre : schémas et rappel plié
{
  const { context, page, erreurs } = await nouvellePage({}, `/#/cours/${ID}/A`);
  await page.click('.parcours-item a.parcours-lien >> nth=0');
  await page.waitForSelector('.tache');
  assert(await page.locator('.tache #schemas-fiche').evaluate((d) => d.open) === true, 'fiche : schémas dépliés');
  assert(await page.locator('.tache #schemas-fiche svg').first().isVisible(), 'fiche : un schéma visible');
  assert(await page.locator('.tache #rappel-cours').count() === 1 && await page.locator('.tache #rappel-cours').evaluate((d) => d.open) === false, 'fiche : rappel du cours plié');
  await page.keyboard.press('Escape');
  assert(page.url().includes(`/cours/${ID}`), 'Échap ferme la fenêtre : retour au cours', page.url());
  assert(erreurs.length === 0, 'aucune erreur', erreurs.join(' | '));
  await context.close();
}
// 4. Aide-mémoire filtré Cisco
{
  const { context, page } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Cisco');
  await page.goto(`${BASE}/#/memo`);
  await page.waitForTimeout(600);
  const txt = await page.locator('body').innerText();
  assert(/Commutation Cisco/.test(txt), 'aide-mémoire Cisco : le groupe « Commutation Cisco » apparaît');
  await context.close();
}
// 5. Mobile 390 px : pas de défilement horizontal, schémas dans la largeur
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 800 } }, `/#/cours/${ID}/resume`);
  assert(!(await debordement(page)), 'mobile : aucun défilement horizontal du résumé ouvert');
  const largeurs = await page.locator('#resume-cours figure.schema svg').evaluateAll((l) => l.map((e) => e.getBoundingClientRect().width));
  assert(largeurs.length === 8 && largeurs.every((x) => x <= 390), 'mobile : chaque schéma tient dans l’écran', largeurs.join());
  await context.close();
}

await browser.close(); server.close();
console.log(`\nbrowser-cisco-s07 : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle sur équipement : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
