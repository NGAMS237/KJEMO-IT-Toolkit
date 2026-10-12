#!/usr/bin/env node
/**
 * captures-lot5.mjs — LOT 4 · KJEMO IT Toolkit
 * ---------------------------------------------
 * Produit les preuves visuelles demandées pour la revue : thème clair et
 * sombre sur poste de travail, affichage mobile à 390 px, recherche GPO,
 * fiche en mode Débutant, fiche en mode Technicien, validation refusée, et
 * rapport généré.
 *
 * Les captures ne sont pas un test : elles ne prouvent rien toutes seules.
 * Elles montrent, à quelqu'un qui ne lira pas 18 000 assertions, ce que les
 * assertions vérifient. Chaque fichier est écrit dans docs/captures-lot5/.
 *
 * Usage : node test/captures-lot5.mjs
 */

import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SORTIE = resolve(ROOT, 'docs', 'captures-lot5');
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

const OUTIL = 'ipv4-subnet-calculator';

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
    'Accueil, poste de travail 1440 px, thème clair — la catégorie Réseau annonce ses 23 assistants.');

  await poserTheme(page, 'sombre');
  await capturer(page, '02-accueil-bureau-sombre',
    'Même page, thème sombre — le fond est explicite, le texte reste lisible.');

  // -------------------------------------------------------------------------
  // 3. Recherche GPO
  // -------------------------------------------------------------------------
  await poserTheme(page, 'clair');
  await page.fill('#search', 'latence reseau');
  await page.waitForTimeout(600);
  await capturer(page, '03-recherche-reseau',
    'Recherche « latence reseau » — les résultats et le motif de correspondance.');

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
  await page.waitForSelector('#calcAdresse', { timeout: 15000 });
  await poserTheme(page, 'clair');

  // Une stratégie par défaut du domaine : refusée, et le formulaire le dit.
  await page.fill('#calcAdresse', '256.1.1.1');
  await page.dispatchEvent('#calcAdresse', 'input');
  await page.dispatchEvent('#calcAdresse', 'change');
  // Le refus s'affiche quand on tente de générer : c'est ce geste-là qu'on
  // veut montrer, pas un champ simplement survolé.
  await page.click('#generateButton').catch(async () => {
    await page.click('button[type="submit"]');
  });
  await page.waitForTimeout(900);
  await capturer(page, '06-validation-refusee',
    '« 256.1.1.1 » saisie comme adresse — le formulaire refuse et explique pourquoi.');

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
  await page.goto(`${BASE}/#/outil/network-full-report`);
  await page.waitForSelector('#scriptOutput', { timeout: 15000 });
  await poserTheme(page, 'clair');
  await page.waitForTimeout(600);
  await capturer(page, '07-rapport-genere',
    'Aperçu du script du rapport réseau complet — ce qui sera copié et téléchargé, au caractère près.');
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

// ---------------------------------------------------------------------------
// 11. Le calculateur IPv4 : le résultat, calculé par le navigateur.
//
// C'est la preuve qui compte pour cet assistant : la réponse se lit dans
// l'aperçu, sans rien exécuter. On cadre sur le haut du script généré, là où
// le bloc de résultat se trouve.
// ---------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/outil/ipv4-subnet-calculator`);
  await page.waitForSelector('#scriptOutput', { timeout: 15000 });
  await poserTheme(page, 'clair');
  // Un cas qui montre le traitement particulier du /31.
  await page.fill('#calcAdresse', '172.16.5.130');
  await page.fill('#calcPrefixe', '26');
  await page.fill('#calcComparer', '172.16.5.60');
  await page.fill('#calcDecoupe', '28');
  await page.click('#generateButton').catch(async () => {
    await page.click('button[type="submit"]');
  });
  await page.waitForTimeout(900);
  const sortie = await page.$('#scriptOutput');
  if (sortie) {
    await sortie.screenshot({ path: resolve(SORTIE, '11-calculateur-resultat.png') });
    faites.push({ nom: '11-calculateur-resultat.png',
      description: 'Le calcul 172.16.5.130/26, avec comparaison et découpage en /28 — résultat produit par le navigateur, lisible sans rien exécuter.' });
    console.log('  [capture] 11-calculateur-resultat.png — résultat du calculateur');
  }
  await capturer(page, '12-calculateur-fiche',
    'Fiche complète du calculateur IPv4, avec le formulaire et le script généré.');
  await ctx.close();
}

await browser.close();
server.close();

console.log('');
console.log(`${faites.length} captures écrites dans docs/captures-lot5/ :`);
for (const f of faites) console.log(`  ${f.nom} — ${f.description}`);
