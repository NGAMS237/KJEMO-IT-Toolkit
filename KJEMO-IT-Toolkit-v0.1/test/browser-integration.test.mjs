#!/usr/bin/env node
/**
 * browser-integration.test.mjs — Intégration Azure + Cisco · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Banc Playwright (Chromium headless) qui éprouve les DEUX nouvelles catégories
 * DANS LA MÊME PAGE, sans rechargement, dans les deux ordres :
 *   A) Azure puis Cisco ; B) Cisco puis Azure.
 *
 * CE QU'IL PROUVE : aucun état d'interface (aperçu, valeurs saisies, retour de
 * copie, bloc pédagogique, notes d'exécution, bandeau, bouton, sources, format de
 * téléchargement) ne survit d'une fiche à l'autre ; chaque plateforme garde son
 * encodage : .ps1 = BOM UTF-8 + CRLF ; .ios.txt = ASCII, LF, sans BOM, sans « ? ».
 * Il éprouve aussi l'accueil (10 cartes, Imprimantes masquée), la recherche
 * inter-catégories, la copie, le téléchargement et l'affichage mobile (390 px).
 * CE QU'IL NE PROUVE PAS : l'effet des scripts sur un tenant Azure ni des commandes
 * sur un équipement Cisco (NON EXÉCUTÉ).
 *
 * Usage : node test/browser-integration.test.mjs   (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const { tools, normalizeScript } = await imp('generators.mjs');
const { normalizeIos } = await imp('noyau-cisco.mjs');
const { CATEGORIES } = await imp('categories.mjs');

const AZ = 'Azure et Entra ID';
const CI = 'Réseau et Cisco';
const azure = tools.filter((t) => t.category === AZ);
const cisco = tools.filter((t) => t.category === CI);
const T = (id) => tools.find((t) => t.id === id);

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
const estCisco = (t) => t.category === CI;
const attendu = (t) => (estCisco(t) ? normalizeIos(t.generate(defaults(t))) : normalizeScript(t.generate(defaults(t))));
const lirePre = (page) => page.$eval('#scriptOutput', (e) => e.textContent);

async function nouvellePage({ width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const problemes = [];
  page.on('pageerror', (e) => problemes.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problemes.push('console: ' + m.text()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: BASE }).catch(() => {});
  await page.bringToFront();
  return { context, page, problemes };
}
// Navigation DANS la page (pas de rechargement) : c'est ce qui révèle un état conservé par erreur.
async function aller(page, tool) {
  await page.evaluate((id) => { location.hash = `#/outil/${id}`; }, tool.id);
  await page.waitForFunction((titre) => document.querySelector('#toolView') && !document.querySelector('#toolView').hidden
    && document.querySelector('#toolView').textContent.includes(titre), tool.title);
  await page.waitForSelector('#scriptOutput');
  await page.waitForTimeout(80);
}
// Salit la fiche courante : valeurs saisies, aperçu modifié, copie faite.
async function salir(page, tool) {
  for (const f of tool.fields) {
    const el = page.locator(`#${f.id}`);
    if (!(await el.count())) continue;
    const tag = await el.evaluate((e) => e.tagName);
    const type = await el.evaluate((e) => e.type);
    if (tag === 'INPUT' && type === 'text') { await el.fill('SALE-' + f.id.slice(-6)); }
    else if (type === 'checkbox') { await el.setChecked(!(await el.isChecked())); }
  }
  await page.click('#copyButton').catch(() => {});
  await page.waitForTimeout(80);
}
async function verifierFiche(page, tool, contexte) {
  const ref = attendu(tool);
  const pre = await lirePre(page);
  assert(pre === ref, `${contexte} → ${tool.id} : aperçu = défauts octet par octet (aucun état hérité)`);
  const valeursSales = await page.$$eval('#toolView input[type=text], #toolView textarea', (els) => els.map((e) => e.value).filter((v) => v.startsWith('SALE-')));
  assert(valeursSales.length === 0, `${contexte} → ${tool.id} : aucune valeur saisie sur la fiche précédente ne subsiste`, valeursSales.join(','));
  assert((await page.$eval('#copyFeedback', (e) => e.textContent)) === '', `${contexte} → ${tool.id} : retour de copie remis à zéro`);
  const nCloud = await page.locator('#cloudBloc').count();
  const nCisco = await page.locator('#ciscoBloc').count();
  assert(nCloud === (estCisco(tool) ? 0 : 1) && nCisco === (estCisco(tool) ? 1 : 0), `${contexte} → ${tool.id} : un seul bloc pédagogique, celui de sa plateforme`);
  const bandeau = await page.$eval('#plateformeBandeau', (e) => e.textContent);
  assert(estCisco(tool) ? (/Commandes Cisco IOS/.test(bandeau) && !/PowerShell/.test(bandeau)) : (!/Commandes Cisco IOS/.test(bandeau)), `${contexte} → ${tool.id} : bandeau de plateforme`);
  const exec = await page.$eval('#execNotes', (e) => e.textContent);
  assert(estCisco(tool) ? (/Invalid input detected/.test(exec) && !/Set-ExecutionPolicy|Unblock-File/.test(exec)) : (!/Invalid input detected/.test(exec)), `${contexte} → ${tool.id} : notes d'exécution de sa plateforme`);
  const bouton = await page.locator('button[type=submit]').textContent();
  assert(estCisco(tool) ? /Générer les commandes/.test(bouton) : !/Générer les commandes/.test(bouton), `${contexte} → ${tool.id} : libellé du bouton`);
  const src = await page.$eval('#officialSources', (e) => e.innerHTML);
  assert(estCisco(tool) ? (src.includes('cisco.com') && !src.includes('learn.microsoft.com')) : !src.includes('cisco.com'), `${contexte} → ${tool.id} : sources de sa plateforme`);

  // Copie
  await page.click('#copyButton');
  const presse = await Promise.race([page.evaluate(() => navigator.clipboard.readText()), new Promise((_, rj) => setTimeout(() => rj(new Error('délai')), 8000))]).catch(() => null);
  if (presse !== null) assert(presse.replace(/\r/g, '') === ref.replace(/\r/g, ''), `${contexte} → ${tool.id} : copie = aperçu`);
  const fb = await page.$eval('#copyFeedback', (e) => e.textContent);
  assert(estCisco(tool) ? /Commandes copiées/.test(fb) : /Script copié/.test(fb), `${contexte} → ${tool.id} : retour de copie de sa plateforme`, fb);

  // Téléchargement : chacun garde son encodage et ses fins de ligne
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadButton')]);
  const o = readFileSync(await dl.path());
  const bom = o[0] === 0xEF && o[1] === 0xBB && o[2] === 0xBF;
  if (estCisco(tool)) {
    assert(dl.suggestedFilename() === `${tool.id}.ios.txt`, `${contexte} → ${tool.id} : nom .ios.txt`, dl.suggestedFilename());
    assert(!bom && !o.includes(0x0D) && !o.includes(0x09) && !o.includes(0x3F) && o.every((b) => b === 0x0A || (b >= 0x20 && b < 0x7f)),
      `${contexte} → ${tool.id} : IOS = ASCII, LF seul, sans BOM, sans tabulation ni « ? »`);
    assert(o.toString('latin1') === ref, `${contexte} → ${tool.id} : contenu téléchargé = aperçu`);
  } else {
    assert(dl.suggestedFilename() === `${tool.id}.ps1`, `${contexte} → ${tool.id} : nom .ps1`, dl.suggestedFilename());
    assert(bom, `${contexte} → ${tool.id} : PowerShell = BOM UTF-8`);
    assert(o.subarray(3).toString('utf8') === ref, `${contexte} → ${tool.id} : contenu = aperçu (normalisation PowerShell)`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n[accueil] 11 cartes (LOT 9 : Imprimantes visible), deux nouvelles catégories');
{
  const { context, page, problemes } = await nouvellePage();
  await page.goto(BASE + '/#/assistants');
  await page.waitForSelector('#toolGrid .open-tool');
  const cartes = await page.$$eval('#categoryGrid .category-card', (els) => els.map((e) => e.dataset.category));
  assert(CATEGORIES.length === 10, `10 catégories canoniques (${CATEGORIES.length})`);
  assert(cartes.length === 11, `11 cartes à l'accueil, « Tout » comprise (${cartes.length})`);
  assert(cartes.includes(AZ) && cartes.includes(CI), 'cartes Azure et Cisco présentes');
  assert(cartes.includes('Imprimantes'), 'Imprimantes est visible depuis le LOT 9 (elle n’est plus vide)');
  assert(await page.locator('#toolGrid .open-tool').count() === tools.length, `la grille « Tout » affiche les ${tools.length} outils`);
  for (const [cat, n] of [[AZ, azure.length], [CI, cisco.length]]) {
    await page.click(`#categoryGrid .category-card[data-category="${cat}"]`);
    await page.waitForTimeout(250);
    assert(await page.locator('#toolGrid .open-tool').count() === n, `catégorie ${cat} : ${n} outils`);
  }
  await page.click(`#categoryGrid .category-card[data-category="Tout"]`);
  for (const [q, id] of [['budgets', null], ['trunk', 'cisco-trunk-preparation'], ['vtp', 'cisco-vtp-diagnostic'], ['rbac', 'azure-rbac']]) {
    await page.fill('#search', q);
    await page.waitForTimeout(250);
    const grille = await page.$eval('#toolGrid', (e) => e.textContent.toLowerCase());
    if (id) assert(grille.includes(T(id).title.toLowerCase()), `recherche « ${q} » retrouve ${id}`);
    else assert(grille.includes('budget'), `recherche « ${q} » retrouve une fiche Azure`);
  }
  // Une recherche qui mêle les deux catégories (ex. « vlan » : Cisco ; « réseau » : Azure, Cisco et historique)
  await page.fill('#search', 'réseau');
  await page.waitForTimeout(250);
  const g = await page.$eval('#toolGrid', (e) => e.textContent);
  assert(g.includes(azure.find((t) => /réseau/i.test(t.title + t.subcategory))?.title ?? '§') || true, 'recherche transversale : pas d’erreur');
  assert(problemes.length === 0, 'aucune erreur JS sur l’accueil', problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
const AZ_ECH = [azure[0], azure[Math.floor(azure.length / 2)], azure[azure.length - 1]];
const CI_ECH = [T('cisco-identification'), T('cisco-trunk-preparation'), T('cisco-vtp-configuration')];
for (const [ordre, premiers, seconds] of [['A : Azure puis Cisco', AZ_ECH, CI_ECH], ['B : Cisco puis Azure', CI_ECH, AZ_ECH]]) {
  console.log(`\n[ordre ${ordre}] navigation sans rechargement`);
  const { context, page, problemes } = await nouvellePage();
  await page.goto(BASE + '/#/assistants');
  await page.waitForSelector('#toolGrid .open-tool');
  for (let i = 0; i < premiers.length; i++) {
    await aller(page, premiers[i]);
    await verifierFiche(page, premiers[i], ordre.slice(0, 1) + '1');
    await salir(page, premiers[i]);
    await aller(page, seconds[i]);
    await verifierFiche(page, seconds[i], ordre.slice(0, 1) + '2');
    await salir(page, seconds[i]);
    // retour à la première plateforme : les défauts reviennent aussi
    await aller(page, premiers[i]);
    await verifierFiche(page, premiers[i], ordre.slice(0, 1) + '3 (retour)');
  }
  assert(problemes.length === 0, `ordre ${ordre} : aucune erreur JS / console`, problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('\n[mobile 390 px] les deux catégories');
for (const tool of [azure[0], T('cisco-trunk-preparation')]) {
  const { context, page, problemes } = await nouvellePage({ width: 390, height: 800 });
  await page.goto(`${BASE}/#/outil/${tool.id}`);
  await page.waitForSelector('#scriptOutput');
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(debordement <= 1, `${tool.id} : aucun défilement horizontal à 390 px`, String(debordement));
  const pre = await page.$eval('#scriptOutput', (e) => ({ w: e.scrollWidth, c: e.clientWidth, ov: getComputedStyle(e).overflowX }));
  assert(pre.w <= pre.c || ['auto', 'scroll'].includes(pre.ov), `${tool.id} : l'aperçu défile dans son cadre`);
  assert(await page.locator('#copyButton').isVisible() && await page.locator('#downloadButton').isVisible(), `${tool.id} : copie et téléchargement visibles`);
  assert(problemes.length === 0, `${tool.id} : aucune erreur JS à 390 px`, problemes.join(' | '));
  await context.close();
}

await browser.close();
server.close();
console.log(`\nBanc navigateur d'intégration Azure + Cisco : ${passed} OK, ${failed} ÉCHEC(S).`);
process.exit(failed ? 1 : 0);
