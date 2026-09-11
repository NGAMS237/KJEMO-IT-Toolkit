#!/usr/bin/env node
/**
 * browser-identity.test.mjs — LOT 0 · KJEMO IT Toolkit
 * -------------------------------------------------------
 * Test Playwright RÉEL : ouvre l'application dans Chromium headless.
 *
 * Pour chaque assistant :
 *   1. Navigue vers l'outil via clic sur la carte
 *   2. Lit le <pre id="scriptOutput"> (valeurs par défaut)
 *   3. Clique Copier — lit le presse-papiers (FAIL si inaccessible)
 *   4. Clique Télécharger — intercepte et lit le fichier
 *   5. Compare les trois valeurs octet par octet avec normalizeScript(generate(defaults))
 *   6. Vérifie le nom du fichier téléchargé : <id>.ps1
 *   7. Vérifie l'absence de U+2018/U+2019 dans les chaînes PS à apostrophes simples
 *
 * Pour chaque assistant, remplit également des valeurs non-triviales :
 *   - Apostrophe typographique U+2019 dans les champs texte
 *   - Vérifie que le formulaire regénère sans U+2018/U+2019 dans une chaîne PS
 *
 * FAIL explicite si le clipboard est inaccessible (ne pas masquer l'erreur).
 *
 * Prérequis : Chromium installé (npx playwright install chromium)
 * Usage     : node test/browser-identity.test.mjs
 * Exit 0    = tout OK, exit 1 = au moins un ÉCHEC.
 *
 * LOT 0 — Stabilisation — branche : claude/lot-0-stabilisation
 */

import { chromium }              from '@playwright/test';
import { createServer }          from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath }         from 'node:url';
import { dirname, resolve, extname, join } from 'node:path';
import { tmpdir }                from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Importer les générateurs depuis le module source (pas depuis dist/app.js)
// ---------------------------------------------------------------------------
const { tools, normalizeScript } = await import(resolve(ROOT, 'src', 'generators.mjs'));

// ---------------------------------------------------------------------------
// Serveur HTTP statique minimal pour dist/
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.mjs':  'application/javascript; charset=utf-8',
};

/**
 * Sert dist/ à la racine (/) et src/ sous /src/.
 * L'import dans dist/app.js est :  import { ... } from '../src/generators.mjs'
 * Ce qui, depuis http://localhost/app.js, résout en http://localhost/src/generators.mjs
 */
function startServer(projectRoot) {
  const distDir = resolve(projectRoot, 'dist');
  const srcDir  = resolve(projectRoot, 'src');

  return new Promise((res) => {
    const server = createServer((req, reply) => {
      const rawPath = req.url.split('?')[0];
      const urlPath = rawPath === '/' ? '/index.html' : rawPath;

      let filePath;
      if (urlPath.startsWith('/src/')) {
        filePath = resolve(srcDir, urlPath.slice('/src/'.length));
      } else {
        filePath = resolve(distDir, '.' + urlPath);
      }

      try {
        const body = readFileSync(filePath);
        const ext  = extname(filePath);
        reply.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        reply.end(body);
      } catch {
        reply.writeHead(404);
        reply.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      res({ server, port });
    });
  });
}

// ---------------------------------------------------------------------------
// Résolution du chemin Chromium
// ---------------------------------------------------------------------------
const CHROMIUM_PATH_ENV      = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const CHROMIUM_PATH_FALLBACK = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CHROMIUM_PATH = (CHROMIUM_PATH_ENV && CHROMIUM_PATH_ENV.trim())
  ? CHROMIUM_PATH_ENV.trim()
  : existsSync(CHROMIUM_PATH_FALLBACK)
    ? CHROMIUM_PATH_FALLBACK
    : null;

const { server, port } = await startServer(ROOT);
const BASE_URL = `http://127.0.0.1:${port}`;

console.log(`Serveur local : ${BASE_URL}`);
console.log(`Chromium      : ${CHROMIUM_PATH ?? '(Playwright default)'}`);

const launchOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
  ],
};
if (CHROMIUM_PATH) launchOptions.executablePath = CHROMIUM_PATH;

const browser = await chromium.launch(launchOptions);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(cond, label, detail = '') {
  if (cond) { console.log(`  [OK]    ${label}`); passed++; }
  else       { console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

function bytesEqual(a, b) {
  return Buffer.from(a, 'utf-8').equals(Buffer.from(b, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Tests par outil
// ---------------------------------------------------------------------------
for (const tool of tools) {
  console.log(`\n[${tool.id}] — ${tool.title}`);

  // Valeur canonique attendue (référence côté Node.js)
  const defaultVals = Object.fromEntries(tool.fields.map((f) => [f.id, String(f.default ?? '')]));
  const expected    = normalizeScript(tool.generate(defaultVals));

  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();

  // Accorder la permission clipboard via CDP
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.grantPermissions', {
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
    origin: `http://127.0.0.1:${port}`,
  });

  await page.goto(BASE_URL);

  // Attendre que la grille soit rendue
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });

  const toolIndex    = tools.indexOf(tool);
  const openButtons  = page.locator('#toolGrid .open-tool');
  const count        = await openButtons.count();
  if (toolIndex >= count) {
    console.error(`  [SKIP]  Carte introuvable (index ${toolIndex}, total ${count})`);
    failed++;
    await context.close();
    continue;
  }
  await openButtons.nth(toolIndex).click();

  // Attendre l'affichage du script initial
  await page.waitForSelector('#scriptOutput', { timeout: 5000 });

  // -------------------------------------------------------------------------
  // 1. Lire le <pre> initial (valeurs par défaut, généré automatiquement)
  // -------------------------------------------------------------------------
  const preText = await page.$eval('#scriptOutput', (el) => el.textContent);

  assert(
    bytesEqual(preText, expected),
    `<pre> initial === normalizeScript(generate(defaults))`,
    preText.slice(0, 80).replace(/\n/g, '↵') + '…',
  );

  // -------------------------------------------------------------------------
  // 2. Copier — presse-papiers (FAIL si inaccessible)
  // -------------------------------------------------------------------------
  await page.click('#copyButton');
  await page.waitForFunction(
    () => (document.querySelector('#copyFeedback')?.textContent ?? '').length > 0,
    { timeout: 3000 },
  ).catch(() => {});

  let clipboardText;
  try {
    clipboardText = await page.evaluate(async () => navigator.clipboard.readText());
  } catch (err) {
    // FAIL explicite — le clipboard doit être accessible en headless avec les flags
    assert(false, `Copier (clipboard) accessible`, `${err.message}`);
    clipboardText = null;
  }

  if (clipboardText !== null) {
    assert(
      bytesEqual(clipboardText, expected),
      `Copier (clipboard) === normalizeScript(generate(defaults))`,
    );
    assert(
      bytesEqual(clipboardText, preText),
      `Copier === <pre> textContent — identité parfaite`,
    );
  }

  // -------------------------------------------------------------------------
  // 3. Télécharger — intercepter le fichier
  // -------------------------------------------------------------------------
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#downloadButton'),
  ]);

  const downloadPath = join(tmpdir(), `kjemo-dl-${tool.id}-${Date.now()}.ps1`);
  await download.saveAs(downloadPath);

  let downloadContent;
  try {
    downloadContent = readFileSync(downloadPath, 'utf-8');
  } catch (err) {
    assert(false, `Lecture du fichier téléchargé`, err.message);
    downloadContent = null;
  }

  if (downloadContent !== null) {
    assert(
      bytesEqual(downloadContent, expected),
      `Télécharger (fichier) === normalizeScript(generate(defaults))`,
    );
    assert(
      bytesEqual(downloadContent, preText),
      `Télécharger === <pre> textContent — identité parfaite`,
    );
    assert(
      download.suggestedFilename() === `${tool.id}.ps1`,
      `Nom du fichier : "${download.suggestedFilename()}" === "${tool.id}.ps1"`,
    );
  }

  // -------------------------------------------------------------------------
  // 4. Absence de U+2018/U+2019 dans le <pre>
  // -------------------------------------------------------------------------
  const curlySingleInPreText = /[‘’]/.test(preText);
  assert(
    !curlySingleInPreText,
    `Aucun U+2018/U+2019 dans le <pre> généré`,
  );

  // -------------------------------------------------------------------------
  // 5. Remplir un champ avec U+2019, soumettre, vérifier le <pre>
  // -------------------------------------------------------------------------
  const firstTextField = tool.fields.find((f) => !f.type || f.type === 'text');
  if (firstTextField) {
    await page.fill(`#${firstTextField.id}`, `Test O’Brien`);
    await page.click('#toolForm button[type="submit"]');
    // Attendre la mise à jour du <pre>
    await page.waitForTimeout(200);
    const preAfterTypo = await page.$eval('#scriptOutput', (el) => el.textContent);
    const curlySingleAfterFill = /[‘’]/.test(preAfterTypo);
    assert(
      !curlySingleAfterFill,
      `Aucun U+2018/U+2019 dans <pre> après saisie "O'Brien" (U+2019)`,
    );
  }

  await context.close();
}

await browser.close();
server.close();

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------
console.log('');
console.log(`Tests navigateur terminés : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
