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
const { tools, normalizeScript, EXECUTION_NOTES, searchTools, searchCommonErrors, auditerAnnulation } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);

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

  // -------------------------------------------------------------------------
  // 4 ter. LOT 1 — vérifications après exécution et annulation en 3 blocs
  // -------------------------------------------------------------------------
  const verifTexte = await page.$eval('#verifyAfter', (el) => el.textContent).catch(() => null);
  assert(verifTexte !== null, `${tool.id} : bloc « Vérifier que ça a fonctionné » présent`);
  if (verifTexte !== null) {
    assert(tool.verifyAfter.every((v) => verifTexte.includes(v)),
      `${tool.id} : les ${tool.verifyAfter.length} vérifications sont affichées`);
  }

  const rbTexte = await page.$eval('#rollbackBlock', (el) => el.textContent).catch(() => null);
  assert(rbTexte !== null, `${tool.id} : bloc « Revenir en arrière » présent`);
  if (rbTexte !== null) {
    assert(rbTexte.includes(tool.rollback.summary), `${tool.id} : procédure d'annulation affichée`);
    assert(rbTexte.includes('1. Constater'), `${tool.id} : bloc « Constater avant d'agir » affiché`);
    assert(rbTexte.includes('2. Procédure normale'), `${tool.id} : bloc « Procédure normale » affiché`);
    assert(rbTexte.includes(tool.reversible ? 'Réversible' : 'Lecture seule'),
      `${tool.id} : étiquette de réversibilité affichée`);

    // SÉCURITÉ — ce qui est RENDU À L'ÉCRAN ne doit jamais désactiver la confirmation
    assert(!/-Confirm\s*:\s*\$false/.test(rbTexte),
      `${tool.id} : aucun -Confirm:$false visible dans l'annulation affichée`);
    assert(auditerAnnulation(tool).length === 0,
      `${tool.id} : l'audit de sécurité passe sur la fiche rendue`);

    // Le cas exceptionnel, quand il existe, est visuellement séparé
    const aExceptionnel = Boolean(tool.rollback.exceptional);
    const blocExc = await page.$('#rollbackExceptional');
    assert(Boolean(blocExc) === aExceptionnel,
      `${tool.id} : bloc « cas exceptionnel » ${aExceptionnel ? 'présent' : 'absent'} comme attendu`);
    if (aExceptionnel) {
      const texteExc = await page.$eval('#rollbackExceptional', (el) => el.textContent);
      assert(/AVERTISSEMENT CRITIQUE/.test(texteExc),
        `${tool.id} : le cas exceptionnel affiche son avertissement critique`);
    }

    if (tool.rollback.warning) {
      assert(rbTexte.includes(tool.rollback.warning), `${tool.id} : avertissement affiché`);
    }
  }

  const replies = await page.evaluate(() => ({
    v: document.querySelector('#verifyAfter')?.open === false,
    r: document.querySelector('#rollbackBlock')?.open === false,
  }));
  assert(replies.v && replies.r, `${tool.id} : vérifications et annulation repliées par défaut`);

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


// ---------------------------------------------------------------------------
// LOT 1 — Moteur de recherche dans le navigateur
// ---------------------------------------------------------------------------
console.log('\n[recherche] — moteur de recherche et bandeau d\u2019erreur commune');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });

  const nbCartes = () => page.locator('#toolGrid .open-tool').count();
  const saisir = async (q) => {
    await page.fill('#search', q);
    // état observable : le compteur reflète le résultat attendu côté Node
    const attendu = searchTools(q, 'Tout').length;
    await page.waitForFunction(
      (n) => document.querySelectorAll('#toolGrid .open-tool').length === n,
      attendu,
      { timeout: 5000 },
    ).catch(() => {});
    return attendu;
  };

  assert(await nbCartes() === tools.length, `sans recherche : les ${tools.length} outils sont affichés`);

  // Chaque requête doit donner en page exactement ce que searchTools donne en Node
  for (const q of ['reseau', 'RÉSEAU', 'wifi', 'ip fixe', 'disque plein', 'RSAT', 'Install-WindowsFeature', 'mot de passe']) {
    const attendu = await saisir(q);
    const obtenu  = await nbCartes();
    assert(obtenu === attendu, `« ${q} » : ${obtenu} carte(s) en page === ${attendu} attendue(s) par searchTools`);
  }

  // Insensibilité aux accents, vérifiée dans le navigateur
  await saisir('reseau'); const sansAccent = await nbCartes();
  await saisir('réseau'); const avecAccent = await nbCartes();
  assert(sansAccent === avecAccent && sansAccent > 0,
    `accents ignorés : « reseau » (${sansAccent}) === « réseau » (${avecAccent})`);

  // Motif de correspondance affiché sur les cartes
  await saisir('wifi');
  const motifs = await page.locator('#toolGrid .match-reason').count();
  assert(motifs > 0, 'le motif de correspondance est affiché sur les cartes trouvées');

  await page.fill('#search', '');
  await page.waitForFunction(
    (n) => document.querySelectorAll('#toolGrid .open-tool').length === n,
    tools.length, { timeout: 5000 },
  );
  const motifsVides = await page.locator('#toolGrid .match-reason').count();
  assert(motifsVides === 0, 'sans recherche : aucun motif de correspondance affiché');

  // Requête sans résultat
  await page.fill('#search', 'zzzznexistepas');
  await page.waitForFunction(
    () => document.querySelector('#toolGrid .empty') !== null, { timeout: 5000 });
  assert(await nbCartes() === 0, 'requête absurde : aucune carte');
  const vide = await page.$eval('#toolGrid .empty', (el) => el.textContent);
  assert(/message d\u2019erreur/.test(vide),
    'le message vide suggère de coller le message d\u2019erreur');

  // Bandeau d'erreur commune — le cas réellement rencontré
  await page.fill('#search', 'signé numériquement');
  await page.waitForFunction(
    () => document.querySelector('#commonErrorBanner') !== null, { timeout: 5000 });
  const banniere = await page.$eval('#commonErrorBanner', (el) => el.textContent);
  assert(/tous les scripts/.test(banniere),
    'bandeau : indique que l\u2019erreur concerne tous les scripts');
  assert(/Unblock-File/.test(banniere),
    'bandeau : donne la commande Unblock-File');
  assert(!/Set-ExecutionPolicy/.test(banniere),
    'bandeau : ne conseille pas Set-ExecutionPolicy');

  // Pas de bandeau quand la requête ne vise pas une erreur commune
  await page.fill('#search', 'wifi');
  await page.waitForFunction(
    () => (document.querySelector('#commonErrorZone')?.innerHTML ?? '') === '', { timeout: 5000 })
    .catch(() => {});
  const zoneVide = await page.$eval('#commonErrorZone', (el) => el.innerHTML.trim());
  assert(zoneVide === '', '« wifi » : aucun bandeau d\u2019erreur commune');

  await ctx.close();
}


// ---------------------------------------------------------------------------
// LOT 1 — Routes directes, favoris et historique
// ---------------------------------------------------------------------------
console.log('\n[routes] — liens directs, favoris et historique local');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  const cible = tools[2];   // ad-user
  const autre = tools[5];   // wifi-repair

  // --- 1. Lien direct : ouvrir #/outil/<id> ouvre la fiche au chargement ---
  await page.goto(`${BASE_URL}/#/outil/${cible.id}`);
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  const titreDirect = await page.$eval('.tool-header h1', (el) => el.textContent);
  assert(titreDirect.includes(cible.title),
    `lien direct #/outil/${cible.id} ouvre « ${cible.title} »`);

  // --- 2. Rechargement : la fiche reste ouverte ---
  await page.reload();
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  const titreApresReload = await page.$eval('.tool-header h1', (el) => el.textContent);
  assert(titreApresReload.includes(cible.title), 'après rechargement, la fiche reste ouverte');

  // --- 3. Identifiant inconnu : retour propre à l'accueil, sans plantage ---
  await page.goto(`${BASE_URL}/#/outil/nexistepas`);
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });
  const accueilVisible = await page.$eval('#home', (el) => el.hidden === false);
  assert(accueilVisible, 'identifiant inconnu dans l\u2019URL : accueil affiché, aucune erreur');

  // --- 4. Ouvrir depuis une carte met l'URL à jour ---
  await page.goto(BASE_URL);
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });
  const idx = tools.indexOf(autre);
  await page.locator('#toolGrid .open-tool').nth(idx).click();
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  const hashApresClic = await page.evaluate(() => location.hash);
  assert(hashApresClic === `#/outil/${autre.id}`,
    `clic sur une carte -> URL ${hashApresClic} === #/outil/${autre.id}`);

  // --- 5. Bouton Retour du navigateur ---
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#home')?.hidden === false, { timeout: 8000 });
  const retourAccueil = await page.$eval('#home', (el) => el.hidden === false);
  assert(retourAccueil, 'bouton Retour du navigateur : revient à l\u2019accueil');

  // --- 6. Bouton Suivant ---
  await page.goForward();
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  const titreSuivant = await page.$eval('.tool-header h1', (el) => el.textContent);
  assert(titreSuivant.includes(autre.title), 'bouton Suivant : rouvre la fiche');

  // --- 7. Bouton « Tous les outils » remet l'URL à #/ ---
  await page.click('#backButton');
  await page.waitForFunction(() => document.querySelector('#home')?.hidden === false, { timeout: 8000 });
  const hashRetour = await page.evaluate(() => location.hash);
  assert(hashRetour === '#/', `bouton « Tous les outils » -> URL ${hashRetour} === #/`);

  // --- 8. Historique : les outils visités apparaissent en raccourci ---
  await page.waitForSelector('#historiqueSection', { timeout: 8000 }).catch(() => {});
  const histTexte = await page.$eval('#historiqueSection', (el) => el.textContent).catch(() => '');
  assert(histTexte.includes(autre.title) && histTexte.includes(cible.title),
    'historique : les deux outils consultés sont proposés en raccourci');

  // --- 9. Favoris : marquer, vérifier la persistance après rechargement ---
  const carteCible = page.locator('#toolGrid .tool-card').nth(tools.indexOf(cible));
  await carteCible.locator('.fav-toggle').click();
  await page.waitForSelector('#favorisSection', { timeout: 8000 });
  const favTexte = await page.$eval('#favorisSection', (el) => el.textContent);
  assert(favTexte.includes(cible.title), `favori ajouté : « ${cible.title} » apparaît dans Favoris`);

  const pressed = await carteCible.locator('.fav-toggle').getAttribute('aria-pressed');
  assert(pressed === 'true', 'le bouton favori porte aria-pressed="true"');

  await page.reload();
  await page.waitForSelector('#favorisSection', { timeout: 8000 });
  const favApresReload = await page.$eval('#favorisSection', (el) => el.textContent);
  assert(favApresReload.includes(cible.title), 'le favori survit au rechargement de la page');

  // --- 10. Un favori n'apparaît pas en double dans l'historique ---
  const histApres = await page.$eval('#historiqueSection', (el) => el.textContent).catch(() => '');
  assert(!histApres.includes(cible.title),
    'un outil en favori n\u2019est pas répété dans « Consultés récemment »');

  // --- 11. Retirer le favori ---
  await page.locator('#toolGrid .tool-card').nth(tools.indexOf(cible)).locator('.fav-toggle').click();
  await page.waitForFunction(() => document.querySelector('#favorisSection') === null, { timeout: 8000 });
  const plusDeFav = await page.$('#favorisSection');
  assert(plusDeFav === null, 'favori retiré : la section Favoris disparaît');

  // --- 12. Les raccourcis sont masqués pendant une recherche ---
  await page.fill('#search', 'wifi');
  await page.waitForFunction(
    () => (document.querySelector('#shortcutsZone')?.innerHTML ?? '') === '', { timeout: 5000 })
    .catch(() => {});
  const zoneRaccourcis = await page.$eval('#shortcutsZone', (el) => el.innerHTML.trim());
  assert(zoneRaccourcis === '', 'pendant une recherche, les raccourcis sont masqués');

  await ctx.close();
}

// --- LOT 1B : accueil, catégories et recherche mise en avant ---------------
console.log('\n[accueil 1B] — structure d’accueil et navigation par catégories');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#categoryGrid .category-card', { timeout: 8000 });

  const utilisees = [...new Set(tools.map((t) => t.category))];

  const cartes = await page.$$eval('#categoryGrid .category-card', (els) => els.map((e) => ({
    nom: e.dataset.category,
    presse: e.getAttribute('aria-pressed'),
    texte: e.textContent,
    selectionnee: e.classList.contains('is-selected'),
  })));

  assert(cartes.length === utilisees.length + 1,
    `la grille affiche « Tout » + les ${utilisees.length} catégories pourvues (${cartes.length})`);
  assert(utilisees.every((c) => cartes.some((k) => k.nom === c)),
    'chaque catégorie réellement utilisée a sa carte');
  for (const vide of ['Imprimantes', 'Linux']) {
    assert(!cartes.some((k) => k.nom === vide),
      `aucune catégorie vide affichée : « ${vide} » est absente`);
  }
  assert(cartes.every((k) => k.presse === 'true' || k.presse === 'false'),
    'chaque carte de catégorie porte aria-pressed');
  assert(cartes.filter((k) => k.presse === 'true').length === 1,
    'une seule catégorie est marquée comme sélectionnée');
  assert(cartes.find((k) => k.presse === 'true').selectionnee,
    'l’état sélectionné est aussi visible (classe is-selected)');
  assert(cartes.every((k) => /\d+\s+outil/.test(k.texte)),
    'chaque carte annonce son nombre d’outils');

  // Le décompte annoncé doit correspondre au catalogue réel.
  for (const nom of utilisees) {
    const attendu = tools.filter((t) => t.category === nom).length;
    const carte   = cartes.find((k) => k.nom === nom);
    assert(new RegExp(`${attendu} outil`).test(carte.texte),
      `« ${nom} » annonce ${attendu} outil(s)`);
  }

  // Sélection d'une catégorie : la grille d'outils doit être filtrée.
  const cible   = utilisees[0];
  const attendu = tools.filter((t) => t.category === cible).length;
  await page.click(`#categoryGrid .category-card[data-category="${cible}"]`);
  await page.waitForFunction(
    (n) => document.querySelectorAll('#toolGrid .open-tool').length === n,
    attendu, { timeout: 8000 });
  const affiches = await page.locator('#toolGrid .open-tool').count();
  assert(affiches === attendu,
    `« ${cible} » sélectionnée : ${affiches} outil(s) affiché(s) sur ${tools.length}`);
  const presseApres = await page.getAttribute(
    `#categoryGrid .category-card[data-category="${cible}"]`, 'aria-pressed');
  assert(presseApres === 'true', 'la catégorie cliquée passe à aria-pressed="true"');

  // La barre latérale reflète la même sélection (aria-current).
  const navCourant = await page.$eval('#navigation button[aria-current="true"]',
    (el) => el.dataset.category).catch(() => null);
  assert(navCourant === cible,
    'la navigation latérale marque la même catégorie avec aria-current');

  // Retour à « Tout »
  await page.click('#categoryGrid .category-card[data-category="Tout"]');
  await page.waitForFunction(
    (n) => document.querySelectorAll('#toolGrid .open-tool').length === n,
    tools.length, { timeout: 8000 });
  assert(await page.locator('#toolGrid .open-tool').count() === tools.length,
    '« Tous les outils » rétablit le catalogue complet');

  // La recherche est l'action principale : champ dans le hero, étiquette accessible.
  const champDansHero = await page.$eval('#search', (el) => !!el.closest('.hero'));
  assert(champDansHero, 'le champ de recherche est présenté dans le hero');
  const etiquette = await page.$eval('#search', (el) => {
    const lab = el.closest('label') || document.querySelector('label[for="search"]');
    return lab ? lab.textContent.trim() : '';
  });
  assert(etiquette.length > 0, 'le champ de recherche porte une étiquette associée');

  // Bouton d'effacement : masqué à vide, actif dès la saisie.
  assert(await page.locator('#searchClear').isHidden(),
    'le bouton d’effacement est masqué quand la recherche est vide');
  await page.fill('#search', 'wifi');
  await page.waitForSelector('#searchClear:not([hidden])', { timeout: 8000 });
  assert(await page.locator('#searchClear').isVisible(),
    'le bouton d’effacement apparaît dès qu’une recherche est saisie');
  await page.click('#searchClear');
  await page.waitForFunction(
    (n) => document.querySelectorAll('#toolGrid .open-tool').length === n,
    tools.length, { timeout: 8000 });
  assert(await page.inputValue('#search') === '',
    'le bouton d’effacement vide réellement le champ');

  // Échap efface aussi la recherche — aucun contrôle réservé à la souris.
  await page.fill('#search', 'disque');
  await page.waitForSelector('#searchClear:not([hidden])', { timeout: 8000 });
  await page.press('#search', 'Escape');
  await page.waitForFunction(
    (n) => document.querySelectorAll('#toolGrid .open-tool').length === n,
    tools.length, { timeout: 8000 });
  assert(await page.inputValue('#search') === '',
    'la touche Échap efface la recherche');

  // Les cartes de catégorie sont de vrais boutons, atteignables au clavier.
  const focusable = await page.$eval('#categoryGrid .category-card',
    (el) => el.tagName === 'BUTTON' && el.tabIndex >= 0);
  assert(focusable, 'les catégories sont des boutons atteignables au clavier');

  // Aucune erreur JavaScript pendant toute la séquence.
  const erreurs1B = [];
  page.on('pageerror', (e) => erreurs1B.push(e.message));
  await page.click('#categoryGrid .category-card[data-category="Tout"]');
  await page.waitForTimeout(150);
  assert(erreurs1B.length === 0,
    `accueil 1B : aucune erreur JavaScript non rattrapée (${erreurs1B.length})`);

  await ctx.close();
}

// --- LOT 1B : modes Débutant et Technicien ---------------------------------
console.log('\n[modes 1B] — Débutant / Technicien, persistance et sécurité');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  const outil = tools.find((t) => t.risk === 'caution') ?? tools[0];

  await page.goto(`${BASE_URL}#/outil/${outil.id}`);
  await page.waitForSelector('#modeSelector .mode-option', { timeout: 8000 });

  const options = await page.$$eval('#modeSelector .mode-option',
    (els) => els.map((e) => ({ mode: e.dataset.mode, presse: e.getAttribute('aria-pressed') })));
  assert(options.length === 2 && options.map((o) => o.mode).join(',') === 'debutant,technicien',
    'le sélecteur propose Débutant et Technicien');
  assert(options.filter((o) => o.presse === 'true').length === 1,
    'un seul mode est marqué aria-pressed="true"');
  assert(options.find((o) => o.mode === 'debutant').presse === 'true',
    'au premier chargement, le mode Débutant est actif');

  // --- Mode Débutant -------------------------------------------------------
  assert(await page.locator('#modeBlock.mode-debutant').isVisible(),
    'mode Débutant : le bloc « En clair » est affiché');
  const nbEtapes = await page.locator('#beginnerSteps li').count();
  assert(nbEtapes > 0 && nbEtapes <= 3,
    `mode Débutant : trois étapes au plus dans « En clair » (${nbEtapes})`);
  assert((await page.locator('.plain-risk').innerText()).trim().length > 0,
    'mode Débutant : le niveau de risque est formulé en langage courant');

  // SÉCURITÉ : rien d'essentiel ne doit disparaître en mode Débutant.
  const essentiels = ['#prereqBlock', '#execNotes', '#commonErrors',
                      '#verifyAfter', '#rollbackBlock', '#toolForm',
                      '#scriptOutput', '#copyButton', '#downloadButton'];
  for (const sel of essentiels) {
    assert(await page.locator(sel).count() === 1,
      `mode Débutant : ${sel} reste présent dans la fiche`);
  }
  assert(await page.locator('.tool-header .risk').isVisible()
      && await page.locator('#ficheRisque').isVisible(),
    'mode Débutant : le niveau de risque reste visible, en-tête et fiche');
  assert(await page.locator('.admin-flag').isVisible(),
    'mode Débutant : l’exigence d’élévation reste visible');
  const avertDeb = await page.$$eval('.exec-warning, .rollback-warning',
    (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  assert(avertDeb.length > 0,
    `mode Débutant : les avertissements de sécurité sont présents (${avertDeb.length})`);

  const scriptDebutant = await page.$eval('#scriptOutput', (el) => el.textContent);

  // --- Bascule vers Technicien --------------------------------------------
  await page.click('#modeSelector .mode-option[data-mode="technicien"]');
  await page.waitForSelector('#modeBlock.mode-technicien', { timeout: 8000 });
  assert(await page.getAttribute('#modeSelector .mode-option[data-mode="technicien"]', 'aria-pressed') === 'true',
    'la bascule met à jour aria-pressed');
  assert(await page.getAttribute('#modeSelector .mode-option[data-mode="debutant"]', 'aria-pressed') === 'false',
    'l’ancien mode repasse à aria-pressed="false"');
  assert(await page.locator('#techMeta').isVisible(),
    'mode Technicien : la fiche technique est affichée');
  assert(await page.locator('#beginnerSteps').count() === 0,
    'mode Technicien : la marche à suivre pas-à-pas laisse place au détail technique');

  const avertTech = await page.$$eval('.exec-warning, .rollback-warning',
    (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  assert(avertTech.join(' | ') === avertDeb.join(' | '),
    'les avertissements de sécurité sont strictement les mêmes dans les deux modes');

  // MÊME GÉNÉRATEUR : le script produit ne dépend pas du mode.
  const scriptTechnicien = await page.$eval('#scriptOutput', (el) => el.textContent);
  assert(scriptTechnicien === scriptDebutant,
    'le script généré est identique dans les deux modes (même générateur)');
  assert(scriptTechnicien === normalizeScript(outil.generate(
    Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')])))),
    'le script affiché correspond exactement à generate() côté Node');

  // --- Persistance ---------------------------------------------------------
  await page.reload();
  await page.waitForSelector('#modeSelector .mode-option', { timeout: 8000 });
  assert(await page.getAttribute('#modeSelector .mode-option[data-mode="technicien"]', 'aria-pressed') === 'true',
    'le mode choisi survit au rechargement de la page');
  await page.goto(BASE_URL);
  await page.waitForSelector('#modeSelector .mode-option', { timeout: 8000 });
  assert(await page.getAttribute('#modeSelector .mode-option[data-mode="technicien"]', 'aria-pressed') === 'true',
    'le mode choisi vaut aussi pour l’accueil');

  // Une valeur corrompue dans le stockage ne doit pas casser l'interface.
  await page.evaluate(() => localStorage.setItem('kjemo.mode.v1', 'expert'));
  await page.reload();
  await page.waitForSelector('#modeSelector .mode-option', { timeout: 8000 });
  assert(await page.getAttribute('#modeSelector .mode-option[data-mode="debutant"]', 'aria-pressed') === 'true',
    'une valeur de mode inconnue retombe proprement sur le défaut');

  await ctx.close();
}

// --- LOT 1B : le mode fonctionne même sans stockage ------------------------
console.log('\n[modes 1B] — repli quand localStorage est bloqué');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const jette = () => { throw new Error('stockage bloqué'); };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { return { getItem: jette, setItem: jette, removeItem: jette }; },
    });
  });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  await page.goto(BASE_URL);
  await page.waitForSelector('#modeSelector .mode-option', { timeout: 8000 });
  assert(await page.getAttribute('#modeSelector .mode-option[data-mode="debutant"]', 'aria-pressed') === 'true',
    'stockage bloqué : le mode par défaut s’applique quand même');

  await page.click('#modeSelector .mode-option[data-mode="technicien"]');
  await page.waitForFunction(
    () => document.querySelector('#modeSelector .mode-option[data-mode="technicien"]')
            ?.getAttribute('aria-pressed') === 'true', { timeout: 8000 });
  assert(await page.getAttribute('#modeSelector .mode-option[data-mode="technicien"]', 'aria-pressed') === 'true',
    'stockage bloqué : le changement de mode reste possible pour la session');

  await page.locator('#toolGrid .open-tool').first().click();
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  assert(await page.locator('#modeBlock').count() === 1,
    'stockage bloqué : la fiche s’affiche normalement dans le mode choisi');
  assert(erreurs.length === 0,
    `stockage bloqué : aucune erreur JavaScript non rattrapée (${erreurs.length})`);

  await ctx.close();
}

// --- LOT 1B : affichage progressif de la fiche et accessibilité ------------
console.log('\n[fiche 1B] — ordre de lecture, repli progressif et accessibilité');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  const outil = tools.find((t) => t.risk === 'destructive') ?? tools[0];

  await page.goto(`${BASE_URL}#/outil/${outil.id}`);
  await page.waitForSelector('#sectionScript', { timeout: 8000 });

  // 1. L'ordre des neuf sections est celui du document, pas celui du CSS.
  const ordre = await page.$$eval('.fiche > .fiche-section, .fiche > .tool-content > .fiche-section',
    (els) => els.map((e) => e.dataset.section));
  assert(ordre.join(',') === '1,2,3,4,5,6,7,8,9',
    `les neuf sections se suivent dans l’ordre imposé (${ordre.join(',')})`);

  const attendus = {
    1: 'sectionProbleme', 2: 'sectionRisque', 3: 'sectionFormulaire',
    4: 'sectionScript', 5: 'sectionVerification', 6: 'sectionAnnulation',
    7: 'sectionGraphique', 8: 'sectionErreurs', 9: 'sectionSources',
  };
  for (const [n, id] of Object.entries(attendus)) {
    assert(await page.locator(`#${id}[data-section="${n}"]`).count() === 1,
      `section ${n} présente : #${id}`);
  }

  // 2. Jamais repliés : formulaire, aperçu, Générer, Copier, Télécharger.
  for (const sel of ['#toolForm', '#scriptOutput', '#copyButton', '#downloadButton',
                     '#toolForm .primary-button']) {
    assert(await page.locator(sel).isVisible(),
      `${sel} est visible sans aucune manipulation`);
    const replie = await page.$eval(sel, (el) => !!el.closest('details:not([open])'));
    assert(!replie, `${sel} n’est enfermé dans aucune section repliée`);
  }

  // 3. Le détail secondaire est replié, mais présent et annoncé.
  const replies = ['#execNotes', '#verifyAfter', '#rollbackBlock', '#guiMethod', '#commonErrors'];
  for (const sel of replies) {
    assert(await page.locator(sel).count() === 1, `${sel} est présent dans la fiche`);
    assert(await page.$eval(sel, (el) => el.tagName === 'DETAILS' && !el.open),
      `${sel} est replié par défaut`);
    const resume = await page.$eval(`${sel} > summary`, (el) => el.textContent.trim());
    assert(resume.length > 0, `${sel} porte un intitulé explicite : « ${resume} »`);
  }
  assert(replies.length === 5,
    'aucune section longue n’est ouverte d’office');

  // 4. Un repli s'ouvre au clavier seul — aucun contrôle réservé à la souris.
  await page.focus('#guiMethod > summary');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#guiMethod')?.open === true,
    { timeout: 8000 });
  assert(await page.$eval('#guiMethod', (el) => el.open),
    'une section repliée s’ouvre à la touche Entrée');
  assert(await page.locator('#guiMethod .steps li').count() === outil.gui.length,
    `la méthode graphique conserve ses ${outil.gui.length} étapes`);

  // 5. Ce qui touche à la sécurité n'est jamais dans un repli fermé au départ.
  assert(await page.locator('#ficheRisque').isVisible(),
    'le niveau de risque est affiché sans repli');
  assert(await page.locator('#prereqBlock').isVisible(),
    'les prérequis sont affichés sans repli');
  assert(await page.locator('.tool-header .risk').isVisible(),
    'le badge de risque de l’en-tête reste visible');

  // 6. Étiquettes de formulaire réellement associées à leur champ.
  const champsSansEtiquette = await page.$$eval('#toolForm input, #toolForm select',
    (els) => els.filter((el) => {
      const parLabel = document.querySelector(`label[for="${el.id}"]`);
      const englobant = el.closest('label');
      return !parLabel && !englobant && !el.getAttribute('aria-label');
    }).map((el) => el.id));
  assert(champsSansEtiquette.length === 0,
    `chaque champ du formulaire porte une étiquette associée (${champsSansEtiquette.join(', ') || 'aucun manquant'})`);

  // 7. Chaque section porte un titre relié par aria-labelledby.
  const sansTitre = await page.$$eval('.fiche-section', (els) => els.filter((e) => {
    const id = e.getAttribute('aria-labelledby');
    return !id || !document.getElementById(id);
  }).length);
  assert(sansTitre === 0, 'chaque section est reliée à son titre par aria-labelledby');

  // 8. Ordre de tabulation : le formulaire vient avant les actions du script.
  const rangs = await page.evaluate(() => {
    const focusables = [...document.querySelectorAll(
      '#toolView a[href], #toolView button, #toolView input, #toolView select, #toolView summary, #toolView [tabindex]')]
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    const rang = (sel) => focusables.indexOf(document.querySelector(sel));
    return { form: rang('#toolForm input, #toolForm select'), copie: rang('#copyButton') };
  });
  assert(rangs.form >= 0 && rangs.copie > rangs.form,
    `l’ordre de tabulation suit l’ordre de lecture (formulaire ${rangs.form} avant Copier ${rangs.copie})`);

  // 9. L'aperçu du script est atteignable au clavier et défile à l'intérieur.
  assert(await page.$eval('#scriptOutput', (el) => el.tabIndex >= 0),
    'l’aperçu du script est atteignable au clavier');
  assert(await page.$eval('#scriptOutput', (el) => getComputedStyle(el).overflow !== 'visible'),
    'l’aperçu du script défile à l’intérieur de son cadre');

  // 10. Le focus clavier reste visible.
  await page.focus('#copyButton');
  const contour = await page.$eval('#copyButton', (el) => {
    const st = getComputedStyle(el);
    return { style: st.outlineStyle, width: parseFloat(st.outlineWidth) || 0 };
  });
  assert(contour.style !== 'none' && contour.width > 0,
    `le focus clavier est visible (contour ${contour.style} ${contour.width}px)`);

  // 11. La fiche reste fonctionnelle : générer produit bien le script attendu.
  const attendu = normalizeScript(outil.generate(
    Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]))));
  assert(await page.$eval('#scriptOutput', (el) => el.textContent) === attendu,
    'l’aperçu affiché correspond exactement à generate()');

  await ctx.close();
}

// --- LOT 1B : thèmes Clair / Sombre / Système ------------------------------
console.log('\n[thème 1B] — Clair / Sombre / Système, persistance et repli');
{
  const ctx  = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#themeSelector .theme-option', { timeout: 8000 });

  const opts = await page.$$eval('#themeSelector .theme-option',
    (els) => els.map((e) => ({ id: e.dataset.theme, presse: e.getAttribute('aria-pressed'),
                               nom: e.getAttribute('aria-label') })));
  assert(opts.map((o) => o.id).join(',') === 'clair,sombre,systeme',
    'le sélecteur propose Clair, Sombre et Système');
  assert(opts.every((o) => o.nom && o.nom.trim().length > 0),
    'chaque bouton de thème porte un nom accessible (aria-label)');
  assert(opts.filter((o) => o.presse === 'true').length === 1,
    'un seul thème est marqué aria-pressed="true"');
  assert(opts.find((o) => o.id === 'systeme').presse === 'true',
    'au premier chargement, le thème suit le système');

  const fond = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const texte = () => page.evaluate(() => getComputedStyle(document.body).color);

  const fondSysteme = await fond();

  await page.click('#themeSelector .theme-option[data-theme="clair"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'clair',
    { timeout: 8000 });
  const fondClair = await fond();
  const texteClair = await texte();
  assert(await page.getAttribute('#themeSelector .theme-option[data-theme="clair"]', 'aria-pressed') === 'true',
    'le thème choisi passe à aria-pressed="true"');

  await page.click('#themeSelector .theme-option[data-theme="sombre"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'sombre',
    { timeout: 8000 });
  const fondSombre = await fond();
  const texteSombre = await texte();

  assert(fondClair !== fondSombre,
    `Clair et Sombre produisent bien deux fonds distincts (${fondClair} / ${fondSombre})`);
  assert(fondSombre === fondSysteme,
    'sous un système en mode sombre, « Système » donne le même fond que « Sombre »');

  // Lisibilité : le contraste texte/fond doit rester franc dans les deux thèmes.
  const luminance = (rgb) => {
    const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const cClair  = contraste(texteClair, fondClair);
  const cSombre = contraste(texteSombre, fondSombre);
  assert(cClair >= 4.5, `thème Clair : contraste texte/fond ${cClair.toFixed(1)}:1 (seuil 4.5)`);
  assert(cSombre >= 4.5, `thème Sombre : contraste texte/fond ${cSombre.toFixed(1)}:1 (seuil 4.5)`);

  // Persistance, y compris avant la première peinture.
  await page.reload();
  await page.waitForSelector('#themeSelector', { timeout: 8000 });
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === 'sombre',
    'le thème choisi survit au rechargement');
  assert(await page.getAttribute('#themeSelector .theme-option[data-theme="sombre"]', 'aria-pressed') === 'true',
    'le sélecteur reflète le thème restauré');

  // Valeur corrompue : retour propre au défaut.
  await page.evaluate(() => localStorage.setItem('kjemo.theme.v1', 'neon'));
  await page.reload();
  await page.waitForSelector('#themeSelector', { timeout: 8000 });
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === 'systeme',
    'un thème inconnu retombe proprement sur « Système »');

  // Le thème ne touche pas le script produit.
  await page.locator('#toolGrid .open-tool').first().click();
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  const scriptSombre = await page.$eval('#scriptOutput', (el) => el.textContent);
  await page.click('#themeSelector .theme-option[data-theme="clair"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'clair',
    { timeout: 8000 });
  assert(await page.$eval('#scriptOutput', (el) => el.textContent) === scriptSombre,
    'changer de thème ne modifie pas le script généré');

  await ctx.close();
}

// Système en mode clair : « Système » doit réellement suivre.
{
  const ctx  = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#themeSelector', { timeout: 8000 });
  const fondAuto = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#themeSelector .theme-option[data-theme="clair"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'clair',
    { timeout: 8000 });
  const fondClair = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(fondAuto === fondClair,
    'sous un système en mode clair, « Système » donne le thème clair');
  await ctx.close();
}

// Thème et stockage bloqué.
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const jette = () => { throw new Error('stockage bloqué'); };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { return { getItem: jette, setItem: jette, removeItem: jette }; },
    });
  });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(BASE_URL);
  await page.waitForSelector('#themeSelector', { timeout: 8000 });
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === 'systeme',
    'stockage bloqué : le thème par défaut s’applique quand même');
  await page.click('#themeSelector .theme-option[data-theme="clair"]');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'clair',
    { timeout: 8000 });
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === 'clair',
    'stockage bloqué : le changement de thème reste possible pour la session');
  assert(erreurs.length === 0,
    `stockage bloqué : aucune erreur JavaScript non rattrapée (${erreurs.length})`);
  await ctx.close();
}

// --- LOT 1B : affichage responsive ----------------------------------------
console.log('\n[responsive 1B] — 1440x900, 768x1024, 390x844');
for (const vue of [{ nom: 'bureau 1440x900', width: 1440, height: 900 },
                   { nom: 'tablette 768x1024', width: 768, height: 1024 },
                   { nom: 'téléphone 390x844', width: 390, height: 844 }]) {
  const ctx  = await browser.newContext({ viewport: { width: vue.width, height: vue.height } });
  const page = await ctx.newPage();
  const outil = tools[0];

  // Accueil
  await page.goto(BASE_URL);
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });
  const debord = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(debord <= 1,
    `${vue.nom} — accueil : aucun débordement horizontal (${debord}px)`);
  assert(await page.locator('#search').isVisible(),
    `${vue.nom} — la recherche reste visible`);

  // Le menu doit rester atteignable : barre latérale sur grand écran,
  // bouton de menu sur petit écran.
  const nav = await page.locator('#navigation button').first().isVisible().catch(() => false);
  const menu = await page.locator('#menuButton').isVisible().catch(() => false);
  assert(nav || menu,
    `${vue.nom} — la navigation est atteignable (latérale ${nav}, bouton ${menu})`);
  if (!nav && menu) {
    await page.click('#menuButton');
    await page.waitForTimeout(120);
    assert(await page.locator('#navigation button').first().isVisible(),
      `${vue.nom} — le bouton de menu ouvre réellement la navigation`);
    await page.click('#menuButton');
  }

  // Fiche
  await page.goto(`${BASE_URL}#/outil/${outil.id}`);
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  const debordFiche = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(debordFiche <= 1,
    `${vue.nom} — fiche : aucun débordement horizontal (${debordFiche}px)`);

  // Le script long ne doit pas élargir la page : il défile dans son cadre.
  const apercu = await page.$eval('#scriptOutput', (el) => ({
    debordeSaBoite: el.scrollWidth > el.clientWidth + 1,
    defile: getComputedStyle(el).overflow !== 'visible',
    largeurOk: el.getBoundingClientRect().width <= document.documentElement.clientWidth + 1,
  }));
  assert(apercu.defile && apercu.largeurOk,
    `${vue.nom} — l’aperçu du script reste dans l’écran et défile à l’intérieur`);

  // Copier et Télécharger : visibles, cliquables, assez grands au doigt.
  for (const sel of ['#copyButton', '#downloadButton', '#toolForm .primary-button']) {
    const boite = await page.$eval(sel, (el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, dansEcran: r.left >= -1 && r.right <= document.documentElement.clientWidth + 1 };
    });
    assert(boite.dansEcran, `${vue.nom} — ${sel} est entièrement dans l’écran`);
    assert(boite.h >= 36 && boite.w >= 60,
      `${vue.nom} — ${sel} reste assez grand (${Math.round(boite.w)}x${Math.round(boite.h)})`);
  }

  // Les cartes de catégorie et le sélecteur de mode restent utilisables.
  await page.goto(BASE_URL);
  await page.waitForSelector('#categoryGrid .category-card', { timeout: 8000 });
  const petits = await page.$$eval('#categoryGrid .category-card, .mode-option, .theme-option',
    (els) => els.filter((e) => e.getBoundingClientRect().height < 32).length);
  assert(petits === 0,
    `${vue.nom} — aucun bouton de navigation n’est trop petit (${petits})`);

  await ctx.close();
}

// --- LOT 1B : menu sur petit écran, état annoncé et fermeture au clavier ---
console.log('\n[menu 1B] — panneau latéral sur téléphone');
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#menuButton', { timeout: 8000 });

  assert(await page.getAttribute('#menuButton', 'aria-expanded') === 'false',
    'le bouton de menu annonce son état fermé (aria-expanded)');
  await page.click('#menuButton');
  await page.waitForFunction(
    () => document.querySelector('#menuButton')?.getAttribute('aria-expanded') === 'true',
    { timeout: 8000 });
  assert(await page.locator('#navigation button').first().isVisible(),
    'le panneau s’ouvre et la navigation devient visible');

  // Le bouton doit rester cliquable par-dessus le panneau, sinon il n'y a plus
  // aucun moyen de le refermer au doigt.
  await page.click('#menuButton', { timeout: 5000 });
  await page.waitForFunction(
    () => document.querySelector('#menuButton')?.getAttribute('aria-expanded') === 'false',
    { timeout: 8000 });
  assert(await page.getAttribute('#menuButton', 'aria-expanded') === 'false',
    'le même bouton referme le panneau');

  // Échap referme aussi : pas de piège au clavier.
  await page.click('#menuButton');
  await page.waitForFunction(
    () => document.querySelector('#menuButton')?.getAttribute('aria-expanded') === 'true',
    { timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.querySelector('#menuButton')?.getAttribute('aria-expanded') === 'false',
    { timeout: 8000 });
  assert(await page.getAttribute('#menuButton', 'aria-expanded') === 'false',
    'la touche Échap referme le panneau latéral');
  assert(await page.evaluate(() => document.activeElement?.id) === 'menuButton',
    'le focus revient sur le bouton de menu après fermeture');

  // Choisir une catégorie referme le panneau et filtre la grille.
  await page.click('#menuButton');
  await page.waitForFunction(
    () => document.querySelector('#menuButton')?.getAttribute('aria-expanded') === 'true',
    { timeout: 8000 });
  const cible = [...new Set(tools.map((t) => t.category))][0];
  await page.click(`#navigation button[data-category="${cible}"]`);
  await page.waitForFunction(
    () => document.querySelector('#menuButton')?.getAttribute('aria-expanded') === 'false',
    { timeout: 8000 });
  const attendu = tools.filter((t) => t.category === cible).length;
  assert(await page.locator('#toolGrid .open-tool').count() === attendu,
    `le choix d’une catégorie referme le panneau et filtre la grille (${attendu})`);

  await ctx.close();
}

// --- LOT 1B v2 : catégories canoniques à l'écran ---------------------------
console.log('\n[catégories v2] — catalogue canonique affiché');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#categoryGrid .category-card', { timeout: 8000 });

  const cartes = await page.$$eval('#categoryGrid .category-card',
    (els) => els.map((e) => ({ nom: e.dataset.category, texte: e.textContent })));
  const noms = cartes.map((c) => c.nom);

  for (const attendue of ['Windows poste de travail', 'Analyse et nettoyage des disques',
                          'Windows Server', 'Active Directory', 'GPO', 'Réseau']) {
    assert(noms.includes(attendue), `catégorie canonique affichée : « ${attendue} »`);
  }
  for (const interdite of ['Dépannage Windows', 'Fichiers & imprimantes', 'Stockage']) {
    assert(!noms.includes(interdite),
      `catégorie abandonnée absente de l’écran : « ${interdite} »`);
  }
  for (const vide of ['Imprimantes', 'Linux']) {
    assert(!noms.includes(vide), `catégorie vide masquée : « ${vide} »`);
  }
  assert(noms.length === 7,
    `« Tout » + six catégories pourvues (${noms.length})`);

  // Windows Server existe à l'écran parce que shared-folder l'habite.
  await page.click('#categoryGrid .category-card[data-category="Windows Server"]');
  await page.waitForFunction(
    () => document.querySelectorAll('#toolGrid .open-tool').length === 1, { timeout: 8000 });
  const titre = await page.$eval('#toolGrid h3', (el) => el.textContent);
  const sharedFolder = tools.find((t) => t.id === 'shared-folder');
  assert(titre === sharedFolder.title,
    `Windows Server contient bien « ${sharedFolder.title} »`);

  // Les sous-rubriques sont annoncées sur la carte de catégorie et sur l'outil.
  await page.click('#categoryGrid .category-card[data-category="Tout"]');
  await page.waitForFunction(
    (n) => document.querySelectorAll('#toolGrid .open-tool').length === n,
    tools.length, { timeout: 8000 });
  const carteAD = cartes.find((c) => c.nom === 'Active Directory');
  for (const sous of ['Unités organisationnelles', 'Utilisateurs', 'Contrôleurs de domaine']) {
    assert(carteAD.texte.includes(sous),
      `la carte Active Directory annonce « ${sous} »`);
  }
  const etiquettes = await page.$$eval('#toolGrid .tag', (els) => els.map((e) => e.textContent));
  for (const t of tools) {
    assert(etiquettes.some((e) => e.includes(t.subcategory)),
      `la carte de ${t.id} affiche sa sous-rubrique « ${t.subcategory} »`);
  }

  await ctx.close();
}

// --- LOT 1B v2 : fiche compacte, bouton Commencer et navigation d'ancres ---
console.log('\n[fiche v2] — densité mobile, Commencer et navigation compacte');
for (const vue of [{ nom: 'bureau 1440x900', width: 1440, height: 900 },
                   { nom: 'téléphone 390x844', width: 390, height: 844 }]) {
  const ctx  = await browser.newContext({ viewport: { width: vue.width, height: vue.height } });
  const page = await ctx.newPage();
  const outil = tools.find((t) => t.id === 'static-ip');
  await page.goto(`${BASE_URL}#/outil/${outil.id}`);
  await page.waitForSelector('#sectionFormulaire', { timeout: 8000 });

  // 1. « En clair » : explication courte, avertissement, trois étapes au plus.
  const nbEtapes = await page.locator('#beginnerSteps li').count();
  assert(nbEtapes > 0 && nbEtapes <= 3,
    `${vue.nom} — « En clair » ne montre que ${nbEtapes} étape(s), trois au plus`);
  assert(await page.locator('#plainSummary').isVisible(),
    `${vue.nom} — l’explication courte est affichée`);
  assert((await page.locator('#plainRisk').innerText()).trim().length > 0,
    `${vue.nom} — l’avertissement de risque est affiché sans repli`);

  // 2. Le mode d'emploi complet existe, replié.
  assert(await page.$eval('#modeEmploi', (el) => el.tagName === 'DETAILS' && !el.open),
    `${vue.nom} — le mode d’emploi complet est replié par défaut`);
  const resume = await page.$eval('#modeEmploi > summary', (el) => el.textContent.trim());
  assert(resume === 'Voir le mode d’emploi complet',
    `${vue.nom} — intitulé exact du repli : « ${resume} »`);
  await page.focus('#modeEmploi > summary');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#modeEmploi')?.open === true,
    { timeout: 8000 });
  assert(await page.$eval('#modeEmploi ol li', (el) => el.textContent.length > 0),
    `${vue.nom} — le mode d’emploi complet s’ouvre au clavier et contient les détails`);

  // 3. « Commencer » mène au formulaire et y place le curseur.
  assert(await page.locator('#startButton').isVisible(),
    `${vue.nom} — le bouton « Commencer » est visible`);
  await page.click('#startButton');
  await page.waitForTimeout(250);
  const apresCommencer = await page.evaluate(() => {
    const actif = document.activeElement;
    const form = document.querySelector('#sectionFormulaire');
    return {
      dansFormulaire: !!actif && form.contains(actif),
      champ: actif ? actif.tagName : null,
      formVisible: form.getBoundingClientRect().top < window.innerHeight
                && form.getBoundingClientRect().bottom > 0,
    };
  });
  assert(apresCommencer.dansFormulaire,
    `${vue.nom} — « Commencer » place le focus dans le formulaire (${apresCommencer.champ})`);
  assert(apresCommencer.formVisible,
    `${vue.nom} — « Commencer » amène le formulaire à l’écran`);

  // 4. Navigation compacte : cinq ancres internes, vrais liens.
  const liens = await page.$$eval('#ficheNav .fiche-nav-link',
    (els) => els.map((e) => ({ texte: e.textContent.trim(), href: e.getAttribute('href'),
                               balise: e.tagName })));
  assert(liens.map((l) => l.texte).join(',') === 'Formulaire,Script,Vérifier,Annuler,Interface graphique',
    `${vue.nom} — les cinq entrées attendues, dans l’ordre`);
  assert(liens.every((l) => l.balise === 'A' && l.href.startsWith('#section')),
    `${vue.nom} — ce sont des ancres internes, donc atteignables au clavier`);

  const cibles = { Formulaire: 'sectionFormulaire', Script: 'sectionScript',
                   'Vérifier': 'sectionVerification', Annuler: 'sectionAnnulation',
                   'Interface graphique': 'sectionGraphique' };
  for (const [libelle, id] of Object.entries(cibles)) {
    await page.click(`#ficheNav .fiche-nav-link[data-cible="${id}"]`);
    await page.waitForTimeout(220);
    const etat = await page.evaluate((cible) => {
      const sec = document.getElementById(cible);
      const titre = sec.querySelector('.fiche-section-title');
      const r = titre.getBoundingClientRect();
      const actif = document.activeElement;
      return {
        titreVisible: r.top >= 0 && r.bottom <= window.innerHeight,
        titreNonMasque: document.elementFromPoint(
          Math.min(r.left + 5, window.innerWidth - 1), r.top + r.height / 2) === titre
          || titre.contains(document.elementFromPoint(
            Math.min(r.left + 5, window.innerWidth - 1), r.top + r.height / 2)),
        focusDansSection: !!actif && sec.contains(actif),
        route: location.hash,
      };
    }, id);
    assert(etat.titreVisible,
      `${vue.nom} — « ${libelle} » amène le titre de la section à l’écran`);
    assert(etat.titreNonMasque,
      `${vue.nom} — « ${libelle} » : le titre ciblé n’est masqué par rien`);
    assert(etat.focusDansSection,
      `${vue.nom} — « ${libelle} » déplace aussi le focus clavier`);
    assert(etat.route === `#/outil/${outil.id}`,
      `${vue.nom} — « ${libelle} » ne casse pas la route directe (${etat.route})`);
  }

  // 5. La navigation s'active aussi entièrement au clavier.
  await page.focus('#ficheNav .fiche-nav-link[data-cible="sectionScript"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(220);
  assert(await page.evaluate(() =>
    document.querySelector('#sectionScript').contains(document.activeElement)),
    `${vue.nom} — la navigation compacte s’active à la touche Entrée`);

  // 6. Aucun débordement horizontal, et les avertissements restent visibles.
  const debord = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(debord <= 1, `${vue.nom} — aucun débordement horizontal (${debord}px)`);
  assert(await page.locator('#ficheRisque').isVisible()
      && await page.locator('#prereqBlock').isVisible(),
    `${vue.nom} — risque et prérequis restent affichés`);

  await ctx.close();
}

// --- LOT 1B v2 : les avertissements restent identiques dans les deux modes --
console.log('\n[sécurité v2] — avertissements en mode compact');
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const outil = tools.find((t) => t.risk === 'destructive') ?? tools[0];
  await page.goto(`${BASE_URL}#/outil/${outil.id}`);
  await page.waitForSelector('#modeBlock', { timeout: 8000 });

  const lireAvertissements = () => page.$$eval('.exec-warning, .rollback-warning',
    (els) => els.map((e) => e.textContent.trim()).filter(Boolean));

  const deb = await lireAvertissements();
  assert(deb.length > 0, `mode Débutant compact : ${deb.length} avertissement(s) présent(s)`);
  for (const sel of ['#prereqBlock', '#execNotes', '#commonErrors', '#verifyAfter',
                     '#rollbackBlock', '#toolForm', '#scriptOutput', '#copyButton',
                     '#downloadButton']) {
    assert(await page.locator(sel).count() === 1,
      `mode Débutant compact : ${sel} toujours présent`);
  }

  await page.click('#modeSelector .mode-option[data-mode="technicien"]');
  await page.waitForSelector('#techMeta', { timeout: 8000 });
  const tech = await lireAvertissements();
  assert(tech.join(' | ') === deb.join(' | '),
    'les avertissements sont strictement identiques dans les deux modes, à 390 px');
  assert(await page.locator('#ficheNav').isVisible(),
    'la navigation compacte est disponible dans les deux modes');
  const sousRub = await page.$eval('#techMeta', (el) => el.textContent);
  assert(sousRub.includes(outil.subcategory),
    `la fiche technique annonce la sous-rubrique « ${outil.subcategory} »`);

  await ctx.close();
}

// --- Stockage indisponible : l'application doit continuer de fonctionner ---
console.log('\n[stockage] — dégradation propre quand localStorage est bloqué');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  // Faire échouer localStorage AVANT le chargement de l'application
  await page.addInitScript(() => {
    const jette = () => { throw new Error('stockage bloqué'); };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { return { getItem: jette, setItem: jette, removeItem: jette }; },
    });
  });
  await page.goto(BASE_URL);
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 8000 });
  const cartes = await page.locator('#toolGrid .open-tool').count();
  assert(cartes === tools.length,
    `localStorage bloqué : les ${tools.length} outils s\u2019affichent quand même`);

  await page.locator('#toolGrid .open-tool').first().click();
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  const preOk = await page.$eval('#scriptOutput', (el) => el.textContent.length > 0);
  assert(preOk, 'localStorage bloqué : une fiche s\u2019ouvre et génère normalement');

  const erreursConsole = [];
  page.on('pageerror', (e) => erreursConsole.push(e.message));
  await page.click('#backButton');
  await page.waitForFunction(() => document.querySelector('#home')?.hidden === false, { timeout: 8000 });
  assert(erreursConsole.length === 0,
    `localStorage bloqué : aucune erreur JavaScript non rattrapée (${erreursConsole.length})`);

  await ctx.close();
}

await browser.close();
server.close();

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------
console.log('');
console.log(`Tests navigateur terminés : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
