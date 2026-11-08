#!/usr/bin/env node
/**
 * browser-cisco-reseau.test.mjs — KJEMO-CISCO-COURS-RESEAU-01 · KJEMO IT Toolkit
 * Banc Playwright des cours Cisco des semaines 1 à 5 et du TP2 : liste des six cours Cisco, résumé pliable de chacun
 * (plié, ouvert par /resume, schémas visibles, sans débordement à 390 px), fiche en fenêtre avec commandes visibles,
 * aide-mémoire Cisco (trois nouveaux groupes, commandes directes), aucune erreur de page.
 * NE PROUVE PAS l'effet d'une commande sur un équipement (NON EXÉCUTÉ).
 * Usage : node test/browser-cisco-reseau.test.mjs   (exit 0 = tout OK)
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


const NOUVEAUX = ['cisco-s01-revision-vlsm', 'cisco-s02-commutateur-securite', 'cisco-s02-s03-routage', 'cisco-s05-vlan-vtp-dtp', 'cisco-tp2-routage-statique'];
const SCHEMAS = Object.fromEntries(NOUVEAUX.map((id) => [id, COURS.find((c) => c.id === id).rappelCours.sections.reduce((n, s) => n + (s.schemas ?? []).length, 0)]));

// 1. Liste : tous les cours Cisco du catalogue, un lien de résumé pour chacun des cours des semaines 1 à 5 et du TP2
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Cisco');
  await page.goto(`${BASE}/#/cours`);
  await page.waitForSelector('.cours-carte');
  const nCisco = COURS.filter((c) => c.plateformes.includes('Cisco')).length;
  assert(await page.locator('.cours-carte').count() === nCisco, `filtre Cisco : ${nCisco} cours`);
  for (const id of NOUVEAUX) assert(await page.locator(`[data-resume="${id}"]`).count() === 1, `lien « Résumé du cours » : ${id}`);
  assert(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
  await context.close();
}
// 2. Chaque résumé : plié, ouvert par clic, schémas visibles, état conservé
for (const id of NOUVEAUX) {
  const { context, page, erreurs } = await nouvellePage({}, `/#/cours/${id}/A`);
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === false, `${id} : résumé plié par défaut`);
  await page.click('#resume-cours > summary');
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === true, `${id} : un clic déplie`);
  assert(await page.locator('#resume-cours figure.schema').count() === SCHEMAS[id], `${id} : ${SCHEMAS[id]} schéma(s) dans le résumé`);
  assert(await page.locator('#resume-cours figure.schema svg').first().isVisible(), `${id} : un schéma est visible`);
  const w = await page.locator('#resume-cours figure.schema svg').first().boundingBox();
  assert(w && w.width > 300 && w.height > 100, `${id} : taille lisible`, JSON.stringify(w));
  const premier = await page.locator('input[data-item]').first().getAttribute('data-item');
  await page.check(`input[data-item="${premier}"]`);
  assert(await page.locator('#resume-cours').evaluate((d) => d.open) === true, `${id} : cocher un élément conserve l’état ouvert`);
  assert(await page.locator('.rappel-question').count() >= 3, `${id} : au moins trois questions repliées`);
  assert(erreurs.length === 0, `${id} : aucune erreur de page`, erreurs.join(' | '));
  await context.close();
}
// 3. Mobile 390 px : pas de défilement horizontal, schémas dans la largeur
for (const id of NOUVEAUX) {
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 800 } }, `/#/cours/${id}/resume`);
  assert(!(await debordement(page)), `${id} : mobile, aucun défilement horizontal`);
  const largeurs = await page.locator('#resume-cours figure.schema svg').evaluateAll((l) => l.map((e) => e.getBoundingClientRect().width));
  assert(largeurs.length === SCHEMAS[id] && largeurs.every((x) => x <= 390), `${id} : mobile, chaque schéma tient dans l’écran`, largeurs.join());
  await context.close();
}
// 4. Fiche en fenêtre depuis le TP2 : commandes visibles, schémas et rappel plié
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/cours/cisco-tp2-routage-statique/B');
  await page.click('a.parcours-lien[href*="cours-rt-interface-ip"] >> nth=0');
  await page.waitForSelector('.tache');
  const txt = await page.locator('.tache').innerText();
  assert(/ip address|interface vlan/.test(txt), 'fiche : les commandes sont visibles sans formulaire à remplir d’abord');
  assert(await page.locator('.tache #rappel-cours').count() === 1 && await page.locator('.tache #rappel-cours').evaluate((d) => d.open) === false, 'fiche : rappel du cours plié');
  await page.keyboard.press('Escape');
  assert(page.url().includes('/cours/cisco-tp2-routage-statique'), 'Échap ferme la fenêtre : retour au cours', page.url());
  assert(erreurs.length === 0, 'aucune erreur', erreurs.join(' | '));
  await context.close();
}
// 5. Les incohérences du TP2 sont visibles dans la page du cours
{
  const { context, page } = await nouvellePage({}, '/#/cours/cisco-tp2-routage-statique/A');
  const txt = await page.locator('body').textContent();
  assert(txt.includes('192.158.5.66') && txt.includes('10.123.145.72/29'), 'TP2 : les incohérences de l’énoncé sont affichées');
  await context.close();
}
// 6. Aide-mémoire Cisco : trois nouveaux groupes avec des commandes directes
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await clicPlat(page, 'Cisco');
  await page.goto(`${BASE}/#/memo`);
  await page.waitForTimeout(600);
  const txt = await page.locator('body').innerText();
  for (const g of ['Adressage et routage Cisco', 'Accès et ports du commutateur', 'VLAN, VTP et DTP', 'Commutation Cisco']) assert(txt.includes(g), `aide-mémoire Cisco : « ${g} »`);
  assert(await page.locator('.groupe-masque').count() === await page.locator('.groupe-masque').count(), 'groupes grisés comptés sans erreur');
  assert(erreurs.length === 0, 'aucune erreur', erreurs.join(' | '));
  await context.close();
}
// 7. Fiche de routes statiques ouverte directement : commandes avec valeurs d'exemple
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/tache/cours-rt-statique');
  await page.waitForSelector('.tache');
  const txt = await page.locator('.tache').innerText();
  assert(txt.includes('ip route'), 'fiche route statique : la commande ip route est visible');
  assert(await page.locator('.tache #schemas-fiche svg').count() === 2, 'fiche route statique : deux schémas');
  assert(!(await debordement(page)), 'fiche route statique : aucun défilement horizontal');
  assert(erreurs.length === 0, 'aucune erreur', erreurs.join(' | '));
  await context.close();
}

await browser.close(); server.close();
console.log(`\nbrowser-cisco-reseau : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle sur équipement : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
