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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname, join } from 'node:path';
import { tmpdir }                from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Importer les générateurs depuis le module source (pas depuis dist/app.js)
// ---------------------------------------------------------------------------
const { tools, normalizeScript, EXECUTION_NOTES } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);

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
 * Sert uniquement dist/ à la racine (/).
 * dist/app.js importe './generators.mjs' qui est dist/generators.mjs — aucune réécriture /src/ nécessaire.
 */
function startServer(projectRoot) {
  const distDir = resolve(projectRoot, 'dist');

  return new Promise((res) => {
    const server = createServer((req, reply) => {
      const rawPath = req.url.split('?')[0];
      const urlPath = rawPath === '/' ? '/index.html' : rawPath;
      const filePath = resolve(distDir, '.' + urlPath);

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

/**
 * Retourne la position et l'identité du PREMIER caractère divergent entre deux
 * chaînes, ou null si elles sont identiques. Sert à prouver que l'unique écart
 * entre le presse-papiers et la référence est bien CR (U+000D) et rien d'autre.
 */
function firstDivergence(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return {
        index:  i,
        aChar:  a[i],
        bChar:  b[i],
        aCode:  a.codePointAt(i),
        bCode:  b.codePointAt(i),
        context: JSON.stringify(a.slice(Math.max(0, i - 12), i + 12)),
      };
    }
  }
  if (a.length !== b.length) {
    const longer = a.length > b.length ? a : b;
    return {
      index:  n,
      aChar:  a.length > n ? a[n] : '(fin)',
      bChar:  b.length > n ? b[n] : '(fin)',
      aCode:  a.length > n ? a.codePointAt(n) : -1,
      bCode:  b.length > n ? b.codePointAt(n) : -1,
      context: JSON.stringify(longer.slice(Math.max(0, n - 12), n + 12)),
    };
  }
  return null;
}

const hex4 = (c) => (c < 0 ? '(fin)' : 'U+' + c.toString(16).toUpperCase().padStart(4, '0'));

/**
 * Canonicalisation des fins de ligne — appliquée UNIQUEMENT au texte relu
 * depuis le presse-papiers. Retire les CR ; tout autre caractère est conservé,
 * donc une vraie différence de contenu reste détectée.
 */
function stripCR(s) {
  return s.replace(/\r/g, '');
}

// ---------------------------------------------------------------------------
// Champs Unicode par outil — chaque valeur a été vérifiée contre tool.validate()
//
// 6 outils disposent d'un champ texte qui ACCEPTE réellement O’Brien (U+2019).
// 2 outils (second-dc, gpo-password) n'ont que des champs FQDN ou numériques :
// une apostrophe y est refusée par conception (un nom de domaine ne peut pas en
// contenir). Pour ceux-là on teste le chemin de REFUS, marqué rejects: true.
// ---------------------------------------------------------------------------
const UNICODE_INPUTS = {
  'static-ip':     { fieldId: 'adapter',  value: 'Ethernet O’Brien' },
  'ad-ou':         { fieldId: 'ou',       value: 'Employes O’Brien' },
  'ad-user':       { fieldId: 'lastName', value: 'O’Brien' },
  'shared-folder': { fieldId: 'share',    value: 'Comptabilite O’Brien' },
  'wifi-repair':   { fieldId: 'adapter',  value: 'Wi-Fi O’Brien' },
  'disk-scan':     { fieldId: 'path',     value: 'C:\\Donnees O’Brien' },
  // Refus attendu — aucun champ de ces outils n'accepte U+2019 (FQDN / nombres)
  'second-dc':     { fieldId: 'source',   value: 'srv O’Brien.hopitalbn.lan', rejects: true },
  'gpo-password':  { fieldId: 'domain',   value: 'hopital O’Brien.lan',       rejects: true },
};

// ---------------------------------------------------------------------------
// Valeurs invalides par outil — dont les deux champs numériques exigés :
//   static-ip    prefix = 99  (hors plage 1-32)
//   gpo-password length = 0   (hors plage)
// ---------------------------------------------------------------------------
const INVALID_INPUTS = {
  'static-ip':     { fieldId: 'prefix', value: '99', isNumber: true },
  'ad-ou':         { fieldId: 'domain', value: 'nodot' },
  'ad-user':       { fieldId: 'sam',    value: '' },
  'shared-folder': { fieldId: 'path',   value: '\\\\UNC\\Partage' },
  'second-dc':     { fieldId: 'source', value: 'nodot' },
  'gpo-password':  { fieldId: 'length', value: '0', isNumber: true },
};

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
    // -----------------------------------------------------------------------
    // Sous Windows, l'API presse-papiers de Chromium convertit LF en CRLF.
    // Le contenu n'est pas corrompu : seuls des CR sont insérés. On le PROUVE
    // avant de canonicaliser, au lieu de relâcher la comparaison à l'aveugle.
    // -----------------------------------------------------------------------

    // a) La référence Node ne contient aucun CR — elle est en LF pur.
    assert(
      !/\r/.test(expected),
      `Référence Node en LF pur (aucun CR)`,
    );

    // b) Diagnostic du premier caractère divergent AVANT canonicalisation.
    //    S'il y a un écart, il doit s'agir d'un CR inséré par le presse-papiers.
    const div = firstDivergence(clipboardText, expected);
    if (div === null) {
      assert(true, `Copier : identique au caractère près (plateforme sans conversion CRLF)`);
    } else {
      assert(
        div.aCode === 0x0D,
        `Copier : 1re divergence index ${div.index} = ${hex4(div.aCode)} côté presse-papiers `
          + `vs ${hex4(div.bCode)} côté référence — doit être CR (U+000D)`,
        `contexte ${div.context}`,
      );
    }

    // c) Chaque CR du presse-papiers fait partie d'une séquence CRLF.
    //    Un CR isolé signalerait autre chose qu'une conversion de fin de ligne.
    assert(
      !/\r(?!\n)/.test(clipboardText),
      `Copier : aucun CR isolé — uniquement des séquences CRLF`,
    );

    // d) Une fois les CR retirés, l'identité doit être PARFAITE, octet par octet.
    //    Tout caractère autre que CR qui différerait ferait échouer cette assertion.
    const clipboardLF = stripCR(clipboardText);
    assert(
      bytesEqual(clipboardLF, expected),
      `Copier (fins de ligne canonicalisées) === normalizeScript(generate(defaults))`,
      div ? `1re divergence brute : index ${div.index} ${hex4(div.aCode)} vs ${hex4(div.bCode)}` : '',
    );
    assert(
      bytesEqual(clipboardLF, preText),
      `Copier (fins de ligne canonicalisées) === <pre> textContent — identité parfaite`,
    );

    // e) Le nombre de caractères non-CR est identique : aucun ajout ni retrait
    //    de contenu, seulement des CR insérés.
    assert(
      clipboardLF.length === expected.length,
      `Copier : ${clipboardLF.length} caractères hors CR === ${expected.length} attendus`,
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
  let downloadHasBom = false;
  try {
    const rawBytes = readFileSync(downloadPath);
    // Vérifier le BOM UTF-8 (EF BB BF) — requis pour PS 5.1
    downloadHasBom = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
    // Décoder sans le BOM pour la comparaison avec le <pre>
    downloadContent = downloadHasBom
      ? rawBytes.slice(3).toString('utf-8')
      : rawBytes.toString('utf-8');
  } catch (err) {
    assert(false, `Lecture du fichier téléchargé`, err.message);
    downloadContent = null;
  }

  if (downloadContent !== null) {
    assert(downloadHasBom, `Télécharger : BOM UTF-8 (EF BB BF) présent — requis pour PS 5.1`);
    assert(
      bytesEqual(downloadContent, expected),
      `Télécharger (fichier sans BOM) === normalizeScript(generate(defaults))`,
    );
    assert(
      bytesEqual(downloadContent, preText),
      `Télécharger (sans BOM) === <pre> textContent — identité parfaite`,
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
  // 4 bis. LOT 1 — prérequis, procédure d'exécution et erreurs fréquentes
  // -------------------------------------------------------------------------
  const prereqTexte = await page.$eval('#prereqBlock', (el) => el.textContent).catch(() => null);
  assert(prereqTexte !== null, `${tool.id} : bloc Prérequis présent dans la fiche`);

  if (prereqTexte !== null) {
    assert(
      tool.os.every((o) => prereqTexte.includes(o)),
      `${tool.id} : les ${tool.os.length} système(s) compatible(s) sont affichés`,
    );
    assert(
      tool.prereqs.every((r) => prereqTexte.includes(r)),
      `${tool.id} : les ${tool.prereqs.length} prérequis sont affichés`,
    );
    const mentionAdmin = /administrateur/i.test(prereqTexte);
    assert(mentionAdmin, `${tool.id} : le niveau d'élévation requis est indiqué`);
    const classeAdmin = await page.$eval('.admin-flag', (el) => el.className);
    assert(
      classeAdmin.includes(tool.requiresAdmin ? 'admin-required' : 'admin-optional'),
      `${tool.id} : badge d'élévation cohérent avec requiresAdmin=${tool.requiresAdmin}`,
    );
  }

  const execTexte = await page.$eval('#execNotes', (el) => el.textContent).catch(() => null);
  assert(execTexte !== null, `${tool.id} : bloc « Avant d'exécuter » présent`);

  if (execTexte !== null) {
    assert(execTexte.includes('Unblock-File'), `${tool.id} : la commande Unblock-File est affichée`);
    assert(
      execTexte.includes('Get-ExecutionPolicy -List'),
      `${tool.id} : la commande Get-ExecutionPolicy -List est affichée`,
    );
    assert(
      EXECUTION_NOTES.policies.every((po) => execTexte.includes(po.name)),
      `${tool.id} : les 5 stratégies d'exécution sont dans le tableau`,
    );
    // Sécurité : la fiche ne doit jamais proposer de changer la stratégie machine
    assert(
      !execTexte.includes('Set-ExecutionPolicy'),
      `${tool.id} : la fiche ne conseille pas Set-ExecutionPolicy`,
    );
  }

  const errTexte = await page.$eval('#commonErrors', (el) => el.textContent).catch(() => null);
  assert(errTexte !== null, `${tool.id} : bloc « Erreurs fréquentes » présent`);

  if (errTexte !== null) {
    assert(
      tool.commonErrors.every((e) => errTexte.includes(e.message) && errTexte.includes(e.fix)),
      `${tool.id} : les ${tool.commonErrors.length} erreurs propres à l'outil, avec leur correction`,
    );
    assert(
      errTexte.includes('signé numériquement'),
      `${tool.id} : l'erreur de signature numérique est expliquée`,
    );
  }

  // Les deux sections repliables doivent être fermées par défaut, pour ne pas
  // noyer l'aperçu du script.
  const repliees = await page.evaluate(() => ({
    exec: document.querySelector('#execNotes')?.open === false,
    err:  document.querySelector('#commonErrors')?.open === false,
  }));
  assert(repliees.exec && repliees.err, `${tool.id} : les deux sections sont repliées par défaut`);

  // -------------------------------------------------------------------------
  // 5. Champ Unicode RÉEL : saisir O’Brien (U+2019) dans un champ qui l'accepte,
  //    soumettre, et vérifier que la génération réussit de bout en bout.
  //    Aucun waitForTimeout : on attend des états observables du DOM.
  // -------------------------------------------------------------------------
  const uni = UNICODE_INPUTS[tool.id];
  if (uni) {
    // Repartir d'un état propre
    await page.goto(BASE_URL);
    await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });
    await page.locator('#toolGrid .open-tool').nth(toolIndex).click();
    await page.waitForSelector('#scriptOutput', { timeout: 5000 });

    const preBefore = await page.$eval('#scriptOutput', (el) => el.textContent);

    await page.fill(`#${uni.fieldId}`, uni.value);

    // État observable n°1 : la modification marque l'aperçu obsolète
    await page.waitForFunction(
      () => document.querySelector('#copyButton')?.disabled === true
         && document.querySelector('#scriptOutput')?.classList.contains('stale'),
      { timeout: 5000 },
    );
    assert(
      true,
      `${tool.id}/${uni.fieldId} Unicode : aperçu marqué obsolète + boutons désactivés après saisie`,
    );

    await page.click('#toolForm button[type="submit"]');

    if (uni.rejects) {
      // Ce champ (FQDN) refuse légitimement U+2019 : on attend l'erreur visible.
      await page.waitForFunction(
        (fid) => {
          const span = document.querySelector(`#${fid}-error`);
          return span && !span.hidden && span.textContent.trim().length > 0;
        },
        uni.fieldId,
        { timeout: 5000 },
      );
      assert(true, `${tool.id}/${uni.fieldId} Unicode refusé (FQDN) : message d'erreur visible`);

      const inputInvalid = await page.$eval(`#${uni.fieldId}`, (el) => el.classList.contains('field-invalid'));
      assert(inputInvalid, `${tool.id}/${uni.fieldId} Unicode refusé : champ marqué field-invalid`);

      const cDis = await page.$eval('#copyButton',     (el) => el.disabled);
      const dDis = await page.$eval('#downloadButton', (el) => el.disabled);
      assert(cDis && dDis, `${tool.id}/${uni.fieldId} Unicode refusé : Copier et Télécharger restent désactivés`);

      const preUnchanged = await page.$eval('#scriptOutput', (el) => el.textContent);
      assert(
        bytesEqual(preUnchanged, preBefore),
        `${tool.id}/${uni.fieldId} Unicode refusé : aperçu inchangé (ancien résultat non présenté comme valide)`,
      );
    } else {
      // État observable n°2 : la génération a réussi
      await page.waitForFunction(
        () => document.querySelector('#copyFeedback')?.textContent === 'Aperçu actualisé.'
           && document.querySelector('#copyButton')?.disabled === false
           && document.querySelector('#downloadButton')?.disabled === false
           && !document.querySelector('#scriptOutput')?.classList.contains('stale'),
        { timeout: 5000 },
      );
      assert(true, `${tool.id}/${uni.fieldId} Unicode : génération réussie (feedback « Aperçu actualisé. »)`);

      const cEn = await page.$eval('#copyButton',     (el) => el.disabled === false);
      const dEn = await page.$eval('#downloadButton', (el) => el.disabled === false);
      assert(cEn && dEn, `${tool.id}/${uni.fieldId} Unicode : Copier et Télécharger réactivés`);

      const preAfter = await page.$eval('#scriptOutput', (el) => el.textContent);
      assert(
        !bytesEqual(preAfter, preBefore),
        `${tool.id}/${uni.fieldId} Unicode : l'aperçu a changé après génération`,
      );

      // La valeur exacte (U+2019 compris) doit être présente sous forme Base64
      const b64 = Buffer.from(uni.value, 'utf-8').toString('base64');
      assert(
        preAfter.includes(b64),
        `${tool.id}/${uni.fieldId} Unicode : Base64 de "${uni.value}" présent dans le script généré`,
      );

      // Identité complète avec la référence Node
      const unicodeVals = { ...defaultVals, [uni.fieldId]: uni.value };
      const expectedUnicode = normalizeScript(tool.generate(unicodeVals));
      assert(
        bytesEqual(preAfter, expectedUnicode),
        `${tool.id}/${uni.fieldId} Unicode : <pre> === normalizeScript(generate(valeurs Unicode))`,
      );

      // Le script ne doit contenir aucun U+2018/U+2019 littéral (tout est en Base64)
      assert(
        !/[‘’]/.test(preAfter),
        `${tool.id}/${uni.fieldId} Unicode : aucun U+2018/U+2019 littéral dans le script généré`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // 6. Valeur invalide : erreur visible, champ marqué, boutons désactivés,
  //    soumission refusée, ancien résultat non présenté comme valide.
  //    Couvre aussi les champs number (prefix=99, length=0).
  // -------------------------------------------------------------------------
  const invalidSpec = INVALID_INPUTS[tool.id];
  if (invalidSpec) {
    await page.goto(BASE_URL);
    await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });
    await page.locator('#toolGrid .open-tool').nth(toolIndex).click();
    await page.waitForSelector('#scriptOutput', { timeout: 5000 });

    const preBeforeInvalid = await page.$eval('#scriptOutput', (el) => el.textContent);
    const invEl = page.locator(`#${invalidSpec.fieldId}`);

    if (invalidSpec.isNumber) {
      // input[type=number] : fill() refuse le texte, on force la valeur + événements
      await invEl.evaluate((el, val) => {
        el.value = val;
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, invalidSpec.value);
    } else {
      await invEl.fill(invalidSpec.value);
    }

    // État observable : aperçu obsolète, boutons désactivés
    await page.waitForFunction(
      () => document.querySelector('#copyButton')?.disabled === true
         && document.querySelector('#downloadButton')?.disabled === true
         && document.querySelector('#scriptOutput')?.classList.contains('stale'),
      { timeout: 5000 },
    );
    assert(
      true,
      `${tool.id}/${invalidSpec.fieldId}=${JSON.stringify(invalidSpec.value)} : boutons désactivés après modification (stale)`,
    );

    await page.click('#toolForm button[type="submit"]');

    // État observable : message d'erreur affiché sur le champ fautif
    await page.waitForFunction(
      (fid) => {
        const span = document.querySelector(`#${fid}-error`);
        return span && !span.hidden && span.textContent.trim().length > 0;
      },
      invalidSpec.fieldId,
      { timeout: 5000 },
    );
    const errText = await page.$eval(`#${invalidSpec.fieldId}-error`, (el) => el.textContent.trim());
    assert(
      errText.length > 0,
      `${tool.id}/${invalidSpec.fieldId} : message d'erreur visible — « ${errText.slice(0, 60)} »`,
    );

    // Le champ est marqué invalide
    const fieldInvalid = await page.$eval(`#${invalidSpec.fieldId}`, (el) => el.classList.contains('field-invalid'));
    assert(fieldInvalid, `${tool.id}/${invalidSpec.fieldId} : champ marqué field-invalid`);

    // Les DEUX boutons restent désactivés après la soumission invalide
    const copyStill = await page.$eval('#copyButton',     (el) => el.disabled);
    const dlStill   = await page.$eval('#downloadButton', (el) => el.disabled);
    assert(
      copyStill && dlStill,
      `${tool.id}/${invalidSpec.fieldId} : Copier ET Télécharger restent désactivés après soumission invalide`,
    );

    // La soumission est refusée : l'aperçu n'a pas été régénéré
    const preAfterInvalid = await page.$eval('#scriptOutput', (el) => el.textContent);
    assert(
      bytesEqual(preAfterInvalid, preBeforeInvalid),
      `${tool.id}/${invalidSpec.fieldId} : aperçu inchangé — ancien résultat non présenté comme valide`,
    );

    // L'aperçu reste marqué obsolète
    const stillStale = await page.$eval('#scriptOutput', (el) => el.classList.contains('stale'));
    assert(stillStale, `${tool.id}/${invalidSpec.fieldId} : aperçu toujours marqué obsolète (stale)`);
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
