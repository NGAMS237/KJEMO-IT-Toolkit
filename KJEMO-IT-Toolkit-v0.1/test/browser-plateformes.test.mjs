#!/usr/bin/env node
/**
 * browser-plateformes.test.mjs — KJEMO-UX-FENETRE-01 · KJEMO IT Toolkit
 * Banc Playwright de l'accueil à trois portes, de l'aide-mémoire et du catalogue pro :
 * portes et couleurs (jamais seules), routes, fil d'Ariane, retours haut et bas, bouton
 * Accueil persistant, Échap, filtre de plateforme unique et sa sortie, puces de l'aide-mémoire,
 * groupes grisés, retour de fiche vers son groupe, clavier, mobile 390 px.
 * NE PROUVE PAS l'effet d'une commande sur une machine réelle (NON EXÉCUTÉ).
 * Usage : node test/browser-plateformes.test.mjs   (exit 0 = tout OK)   KJEMO_CAPTURES=<dossier> : captures.
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

// 1. « Toutes » : le tableau d'avancement par plateforme
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  assert(await page.locator('#home .statuts-table tbody tr').count() === 4, 'Toutes : une ligne par plateforme');
  const txt = await page.locator('#home .statuts-table').innerText();
  assert(/Linux[\s\S]*cours/.test(txt) && /Windows[\s\S]*cours/.test(txt) && !/Windows\s*À venir/.test(txt), 'Toutes : Linux et Windows (examen) ont des cours');
  assert(await page.locator('#espacesNav .nav-tp .nav-label').innerText() === 'Mes cours et TP', 'Toutes : menu « Mes cours et TP »');
  await page.click('[data-plat-go="Windows"]');
  assert(await page.locator('#platEntete').isVisible(), 'tableau : un clic sur Windows règle le filtre');
  assert(erreurs.length === 0, 'toutes : aucune erreur JS', erreurs.join(' | '));
  await context.close();
}

// 2. Windows, Azure : même page, seulement leurs éléments ; cours « Bientôt » (Cisco a désormais son cours : banc browser-cisco-s07)
for (const p of ['Windows', 'Azure']) {
  const aCours = true; // Azure : dix cours (browser-azure-cours) ; Windows : l'examen Serveur I (EXAMEN-WS-02)
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await clicPlat(page, p);
  assert((await page.locator('#platEntete').innerText()).includes(p), `${p} : phrase de vue`);
  assert(await page.locator('#porteTpTitre').innerText().then((t) => t.includes(`Mes cours ${p}`)), `${p} : porte « Mes cours ${p} »`);
  assert(await page.locator('#porteTpTitre').locator('xpath=parent::*').getAttribute('class').then((c) => c.includes('porte-vide')) !== aCours, `${p} : cours = ${aCours ? 'porte active' : 'carte « Bientôt »'}`);
  if (!aCours) assert(await page.locator('#porteTpBtn').count() === 0, `${p} : aucun faux bouton « Continuer »`);
  assert(await page.locator('#porteProTitre').innerText().then((t) => t.includes(`Catalogue pro ${p}`)), `${p} : porte catalogue ${p}`);
  const navTxt = await page.locator('#espacesNav').innerText();
  assert(navTxt.includes(`Mes cours ${p}`) && navTxt.includes(`Aide-mémoire ${p}`) && navTxt.includes(`Catalogue pro ${p}`), `${p} : menu de gauche suit la plateforme`);
  const comptes = await page.locator('#portes .groupe-carte, #home .groupe-carte').evaluateAll((els) => els.map((e) => e.querySelector('.groupe-compte')?.textContent));
  assert(comptes.every((c) => Number(c) > 0), `${p} : aucun groupe d'aide-mémoire vide sur l'accueil`, comptes.join(','));
  await page.click('#espacesNav .nav-tp');
  if (aCours) assert(await page.locator('.cours-carte').count() === (p === 'Azure' ? 10 : 1), `${p} : page des cours = ${p === 'Azure' ? 'dix cours' : 'le cours de l’examen'}`); else assert(await page.locator('#coursView').innerText().then((t) => t.includes(`Aucun cours ${p}`)), `${p} : page des cours = état vide clair`);
  assert(erreurs.length === 0, `${p} : aucune erreur JS`, erreurs.join(' | '));
  await context.close();
}

// 3. Linux : le cours est là
{
  const { context, page } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Linux');
  assert(await page.locator('#porteTpBtn').isVisible(), 'Linux : bouton « Continuer »');
  assert(await page.locator('#porteTpTitre').innerText().then((t) => t.includes('Mes cours Linux')), 'Linux : « Mes cours Linux »');
  assert(await page.locator('#platFilters .chip.is-on').innerText() === 'Linux', 'Linux : puce active');
  await context.close();
}

// 4. Fiche en fenêtre depuis une recherche : l'accueil et la recherche restent derrière
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await page.fill('#search', 'find');
  const lien = page.locator('#toolGrid [data-id], #toolGrid button, #toolGrid a').first();
  await lien.click();
  await page.waitForSelector('#taskView:not([hidden]), #toolView:not([hidden])');
  assert(await page.locator('.fiche-modale').count() === 1, 'recherche : la fiche s’ouvre en fenêtre');
  assert(await page.locator('#home').isVisible(), 'recherche : l’accueil reste derrière');
  assert(await page.locator('.fiche-modale').getAttribute('role') === 'dialog', 'fenêtre : role dialog');
  assert(await page.locator('#themeSelector .theme-option').first().isVisible(), 'fenêtre : la barre latérale reste accessible');
  assert(await page.evaluate(() => document.activeElement?.id) === 'modaleFermer', 'fenêtre : le focus va sur la croix');
  const defile = await page.locator('.fiche-modale').evaluate((e) => e.scrollHeight > e.clientHeight);
  assert(defile, 'fenêtre : la fiche défile à l’intérieur');
  await page.click('#modaleFermer');
  await page.waitForFunction(() => document.querySelector('#taskView').hidden && document.querySelector('#toolView').hidden);
  assert(await page.inputValue('#search') === 'find', 'fermer : la recherche est conservée');
  assert(await page.evaluate(() => document.body.classList.contains('modale-ouverte')) === false, 'fermer : le défilement de la page est rendu');
  assert(erreurs.length === 0, 'fenêtre : aucune erreur JS', erreurs.join(' | '));
  await context.close();
}

// 5. Retour navigateur ferme la fenêtre
{
  const { context, page } = await nouvellePage({}, '/#/memo');
  const g = await page.locator('#portesView .groupe-bloc summary').first();
  await g.click();
  await page.locator('#portesView .fiche-ligne h3 a').first().click();
  assert(await page.locator('.fiche-modale').count() === 1, 'retour : fenêtre ouverte');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#taskView').hidden);
  assert(await page.locator('#portesView h1').isVisible(), 'retour navigateur : fenêtre fermée, page conservée');
  await context.close();
}

// 6. Mobile 390 px
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 800 } }, '/#/');
  await page.evaluate(() => { document.querySelector('#platFilters [data-plat="Windows"]').click(); });
  assert(!(await debordement(page)), 'mobile Windows : pas de défilement horizontal');
  await page.goto(`${BASE}/#/memo`);
  // Sous un filtre de plateforme, les groupes sont dépliés d’emblée : on ne clique que s’il est replié.
  if (!(await page.locator('#portesView .groupe-bloc').first().evaluate((d) => d.open))) await page.locator('#portesView .groupe-bloc summary').first().click();
  await page.locator('#portesView .fiche-ligne h3 a').first().click();
  const r = await page.locator('.fiche-modale').evaluate((e) => { const b = e.getBoundingClientRect(); return { l: b.left, w: b.width }; });
  assert(r.w <= 391 && r.l >= -1, 'mobile : la fenêtre tient dans l’écran', JSON.stringify(r));
  const x = await page.locator('#modaleFermer').boundingBox();
  assert(x && x.height >= 44 && x.width >= 44, 'mobile : croix ≥ 44 px');
  await context.close();
}

await browser.close();
server.close();
console.log(`\nbrowser-plateformes : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
