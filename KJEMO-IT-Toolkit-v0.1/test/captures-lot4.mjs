#!/usr/bin/env node
/**
 * captures-lot4.mjs — LOT 4 · KJEMO IT Toolkit
 * ---------------------------------------------
 * Produit les preuves visuelles demandées pour la revue : thème clair et
 * sombre sur poste de travail, affichage mobile à 390 px, recherche GPO,
 * fiche en mode Débutant, fiche en mode Technicien, validation refusée, et
 * rapport généré.
 *
 * Les captures ne sont pas un test : elles ne prouvent rien toutes seules.
 * Elles montrent, à quelqu'un qui ne lira pas 18 000 assertions, ce que les
 * assertions vérifient. Chaque fichier est écrit dans docs/captures-lot4/.
 *
 * Usage : node test/captures-lot4.mjs
 */

import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SORTIE = resolve(ROOT, 'docs', 'captures-lot4');
mkdirSync(SORTIE, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startServer(projectRoot) {
  const distDir = resolve(projectRoot, 'dist');
  return new Promise((res) => {
    const server = createServer((req, reply) => {
      const brut = req.url.split('?')[0];
      const chemin = brut === '/' ? '/index.html' : brut;
      try {
        const body = readFileSync(resolve(distDir, '.' + chemin));
        reply.writeHead(200, { 'Content-Type': MIME[extname(chemin)] || 'application/octet-stream' });
        reply.end(body);
      } catch { reply.writeHead(404); reply.end('Not found'); }
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

const CHROMIUM_PATH_ENV = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const CHROMIUM_PATH_FALLBACK = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROMIUM_PATH = (CHROMIUM_PATH_ENV && CHROMIUM_PATH_ENV.trim())
  ? CHROMIUM_PATH_ENV.trim()
  : existsSync(CHROMIUM_PATH_FALLBACK) ? CHROMIUM_PATH_FALLBACK : null;

const { server, port } = await startServer(ROOT);
const BASE = `http://127.0.0.1:${port}`;

const launchOptions = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};
if (CHROMIUM_PATH) launchOptions.executablePath = CHROMIUM_PATH;
const browser = await chromium.launch(launchOptions);

const faites = [];
async function capturer(page, nom, description) {
  const fichier = resolve(SORTIE, `${nom}.png`);
  await page.screenshot({ path: fichier, fullPage: true });
  faites.push({ nom: `${nom}.png`, description });
  console.log(`  [capture] ${nom}.png — ${description}`);
}

async function poserTheme(page, theme) {
  await page.waitForSelector('#themeSelector .theme-option', { timeout: 15000 });
  await page.click(`#themeSelector .theme-option[data-theme="${theme}"]`);
  await page.waitForFunction(
    (t) => document.documentElement.dataset.theme === t, theme, { timeout: 15000 });
}

const OUTIL = 'gpo-backup-restore-compare';

// ---------------------------------------------------------------------------
// 1 et 2. Accueil poste de travail, thème clair puis sombre
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('#search', { timeout: 15000 });

  await poserTheme(page, 'clair');
  await capturer(page, '01-accueil-bureau-clair',
    'Accueil, poste de travail 1440 px, thème clair — la catégorie GPO annonce ses 19 assistants.');

  await poserTheme(page, 'sombre');
  await capturer(page, '02-accueil-bureau-sombre',
    'Même page, thème sombre — le fond est explicite, le texte reste lisible.');

  // -------------------------------------------------------------------------
  // 3. Recherche GPO
  // -------------------------------------------------------------------------
  await poserTheme(page, 'clair');
  await page.fill('#search', 'sauvegarde gpo');
  await page.waitForTimeout(600);
  await capturer(page, '03-recherche-gpo',
    'Recherche « sauvegarde gpo » — les résultats et le motif de correspondance.');

  await ctx.close();
}

// ---------------------------------------------------------------------------
// 4 et 5. Fiche en mode Débutant, puis en mode Technicien
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/outil/${OUTIL}`);
  await page.waitForSelector('#modeSelector .mode-option', { timeout: 15000 });
  await poserTheme(page, 'clair');

  await page.click('#modeSelector .mode-option[data-mode="debutant"]');
  await page.waitForSelector('#modeBlock.mode-debutant', { timeout: 15000 });
  await capturer(page, '04-fiche-debutant',
    `Fiche « ${OUTIL} » en mode Débutant — la marche à suivre pas à pas.`);

  await page.click('#modeSelector .mode-option[data-mode="technicien"]');
  await page.waitForSelector('#modeBlock.mode-technicien', { timeout: 15000 });
  await capturer(page, '05-fiche-technicien',
    `Même fiche en mode Technicien — l'identifiant, la sous-rubrique et le détail technique.`);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// 6. Validation refusée
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/outil/${OUTIL}`);
  await page.waitForSelector('#brNomGpo', { timeout: 15000 });
  await poserTheme(page, 'clair');

  // Une stratégie par défaut du domaine : refusée, et le formulaire le dit.
  await page.fill('#brNomGpo', 'Default Domain Policy');
  await page.dispatchEvent('#brNomGpo', 'input');
  await page.dispatchEvent('#brNomGpo', 'change');
  // Le refus s'affiche quand on tente de générer : c'est ce geste-là qu'on
  // veut montrer, pas un champ simplement survolé.
  await page.click('#generateButton').catch(async () => {
    await page.click('button[type="submit"]');
  });
  await page.waitForTimeout(900);
  await capturer(page, '06-validation-refusee',
    '« Default Domain Policy » saisie comme cible — le formulaire refuse et explique pourquoi.');

  // Gros plan sur le formulaire : à pleine page, le message de refus est
  // illisible. Une preuve qu'on ne peut pas lire ne prouve rien.
  const formulaire = await page.$('form') ?? await page.$('#toolForm');
  if (formulaire) {
    await formulaire.screenshot({ path: resolve(SORTIE, '06b-validation-refusee-gros-plan.png') });
    faites.push({ nom: '06b-validation-refusee-gros-plan.png',
      description: 'Gros plan du formulaire — le message de refus, lisible.' });
    console.log('  [capture] 06b-validation-refusee-gros-plan.png — gros plan du formulaire');
  }

  await ctx.close();
}

// ---------------------------------------------------------------------------
// 7. Rapport généré (aperçu du script)
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/outil/gpo-inventory-report`);
  await page.waitForSelector('#scriptOutput', { timeout: 15000 });
  await poserTheme(page, 'clair');
  await page.waitForTimeout(600);
  await capturer(page, '07-rapport-genere',
    'Aperçu du script de l’inventaire GPO — ce qui sera copié et téléchargé, au caractère près.');
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 8 et 9. Mobile 390 px : accueil et fiche
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('#search', { timeout: 15000 });
  await poserTheme(page, 'clair');
  const deborde = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  [mesure] débordement horizontal à 390 px, accueil : ${deborde}px`);
  await capturer(page, '08-mobile-390-accueil',
    `Accueil à 390 px — débordement horizontal mesuré : ${deborde}px.`);

  await page.goto(`${BASE}/#/outil/${OUTIL}`);
  await page.waitForSelector('#scriptOutput', { timeout: 15000 });
  const deborde2 = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  [mesure] débordement horizontal à 390 px, fiche : ${deborde2}px`);
  await capturer(page, '09-mobile-390-fiche',
    `Fiche « ${OUTIL} » à 390 px — débordement horizontal mesuré : ${deborde2}px.`);

  await page.goto(BASE);
  await page.waitForSelector('#search', { timeout: 15000 });
  await poserTheme(page, 'sombre');
  await capturer(page, '10-mobile-390-sombre',
    'Accueil à 390 px, thème sombre.');
  await ctx.close();
}

await browser.close();
server.close();

console.log('');
console.log(`${faites.length} captures écrites dans docs/captures-lot4/ :`);
for (const f of faites) console.log(`  ${f.nom} — ${f.description}`);
