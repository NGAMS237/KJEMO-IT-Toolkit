#!/usr/bin/env node
/**
 * browser-azure.test.mjs — LOT 8 · KJEMO IT Toolkit
 * -------------------------------------------------
 * Banc Playwright (Chromium headless) dédié aux 24 fiches Azure / Entra ID.
 *
 * CE QUE CE BANC PROUVE : le comportement de l'interface dans un vrai
 * navigateur — routes #/outil/<id>, catégorie et sous-rubriques, génération,
 * validation, confirmation par phrase, invalidation de l'aperçu, copie,
 * téléchargement (BOM, nom de fichier), formats Console/JSON/CSV, bloc
 * « Dans Azure », affichage mobile.
 * CE QU'IL NE PROUVE PAS : l'exécution du script généré (couverte par
 * test/azure-assistants.test.mjs avec des doublures PowerShell) ni son effet
 * sur un vrai tenant (NON EXÉCUTÉ). Aucun réseau, aucun tenant, aucune ressource.
 *
 * Usage : node test/browser-azure.test.mjs        (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { tools, normalizeScript } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);
const { SOUS_RUBRIQUES_AZURE } = await import(pathToFileURL(resolve(ROOT, 'dist', 'categories.mjs')).href);

const CATEGORIE_AZURE = 'Azure et Entra ID';
const azure = tools.filter((t) => t.category === CATEGORIE_AZURE);

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
const attendu = (t, v) => normalizeScript(t.generate(v));

async function ouvrir(tool, { width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const problemes = [];
  page.on('pageerror', (e) => problemes.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problemes.push('console: ' + m.text()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: BASE })
    .catch(() => {});
  await page.bringToFront();
  await page.goto(`${BASE}/#/outil/${tool.id}`);
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  return { context, page, problemes };
}
const remplir = async (page, id, val) => {
  const el = page.locator(`#${id}`);
  if ((await el.evaluate((e) => e.tagName)) === 'SELECT') await el.selectOption(val);
  else await el.fill(String(val));
};
const lirePre = (page) => page.$eval('#scriptOutput', (e) => e.textContent);
const desactives = async (page) => ({
  copie: await page.locator('#copyButton').isDisabled(),
  telech: await page.locator('#downloadButton').isDisabled(),
});

// ---------------------------------------------------------------------------
// 1. Catalogue, catégorie et sous-rubriques (page d'accueil)
// ---------------------------------------------------------------------------
console.log('\n[accueil] catégorie Azure et sous-rubriques');
assert(azure.length === 24, '24 fiches Azure dans le catalogue', String(azure.length));
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const problemes = [];
  page.on('pageerror', (e) => problemes.push(e.message));
  await page.goto(BASE + '/#/assistants');
  await page.waitForSelector('#toolGrid .open-tool');
  const cartes = await page.locator('#toolGrid .open-tool').count();
  assert(cartes === tools.length, 'la grille affiche tous les outils du catalogue', `${cartes}/${tools.length}`);
  const cats = await page.$eval('#categoryGrid', (e) => e.textContent);
  assert(cats.includes(CATEGORIE_AZURE), 'la catégorie Azure est proposée sur l’accueil');
  const sr = SOUS_RUBRIQUES_AZURE.map((s) => (typeof s === 'string' ? s : s.nom ?? s.name ?? s.titre ?? ''));
  for (const t of azure) assert(t.subcategory && sr.includes(t.subcategory), `${t.id} : sous-rubrique déclarée`, String(t.subcategory));
  // La recherche retrouve une fiche Azure par un mot de son titre
  await page.fill('#search', 'budgets');
  await page.waitForTimeout(300);
  const txt = await page.$eval('#toolGrid', (e) => e.textContent.toLowerCase());
  assert(txt.includes('budget'), 'la recherche « budgets » retrouve la fiche Azure correspondante');
  assert(problemes.length === 0, 'aucune erreur JS sur l’accueil', problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// 2. Par fiche : route, aperçu, copie, téléchargement, bloc cloud
// ---------------------------------------------------------------------------
for (const tool of azure) {
  console.log(`\n[${tool.id}] route · aperçu · copie · téléchargement`);
  const { context, page, problemes } = await ouvrir(tool);
  const ref = attendu(tool, defaults(tool));

  const vue = await page.locator('#toolView').isVisible();
  assert(vue, 'route directe #/outil/<id> : la fiche s’ouvre');
  const pre = await lirePre(page);
  assert(Buffer.from(pre).equals(Buffer.from(ref)), 'aperçu initial = normalizeScript(generate(défauts)) octet par octet');
  assert(await page.locator('#cloudBloc').count() === 1, 'bloc « Dans Azure » présent');
  const cloud = await page.$eval('#cloudBloc', (e) => e.textContent);
  for (const mot of ['Ce qui est lu', 'Ce qui peut être facturé', 'Permissions nécessaires', 'Compatibilité PowerShell', 'validé']) {
    assert(cloud.includes(mot), `bloc cloud : « ${mot} »`);
  }
  assert(/NON EXÉCUTÉ/.test(cloud), 'bloc cloud : déclare explicitement ce qui est NON EXÉCUTÉ');

  // Copie : seuls des CR (CRLF de la plateforme) peuvent différer
  await page.click('#copyButton');
  let presse = null;
  try { presse = await Promise.race([page.evaluate(() => navigator.clipboard.readText()), new Promise((_, rj) => setTimeout(() => rj(new Error('délai dépassé')), 8000))]); } catch (e) { assert(false, 'presse-papiers accessible', e.message); }
  if (presse !== null) assert(Buffer.from(presse.replace(/\r/g, '')).equals(Buffer.from(ref)), 'copie = aperçu (hors CR de plateforme)');

  // Téléchargement : BOM UTF-8 + nom <id>.ps1 + contenu
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadButton')]);
  assert(dl.suggestedFilename() === `${tool.id}.ps1`, 'nom de fichier <id>.ps1', dl.suggestedFilename());
  const chemin = await dl.path();
  const octets = readFileSync(chemin);
  assert(octets[0] === 0xEF && octets[1] === 0xBB && octets[2] === 0xBF, 'téléchargement : BOM UTF-8 (PowerShell 5.1)');
  assert(octets.subarray(3).toString('utf8') === ref, 'téléchargement : contenu = aperçu');
  assert(!/Connect-Az|Connect-MgGraph|Set-AzContext|Select-AzSubscription/.test(octets.toString('utf8').replace(/#.*$/gm, '')),
    'téléchargement : aucune commande de connexion hors commentaires');
  assert(problemes.length === 0, 'aucune erreur JS / console', problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// 3. Formats de rapport (Console / JSON / CSV) pour chaque fiche
// ---------------------------------------------------------------------------
console.log('\n[formats] sélecteur Console / JSON / CSV');
for (const tool of azure) {
  const { context, page } = await ouvrir(tool);
  const options = await page.$$eval('#azFormat option', (o) => o.map((x) => x.value));
  assert(JSON.stringify(options) === JSON.stringify(['Console', 'JSON', 'CSV']), `${tool.id} : trois formats proposés`, options.join(','));
  const vus = new Set();
  for (const fmt of ['JSON', 'CSV', 'Console']) {
    await page.selectOption('#azFormat', fmt);
    assert((await desactives(page)).copie, `${tool.id}/${fmt} : changer le format invalide l’aperçu (copie désactivée)`);
    await page.click('button[type=submit]');
    const pre = await lirePre(page);
    const ref = attendu(tool, { ...defaults(tool), azFormat: fmt });
    assert(pre === ref, `${tool.id}/${fmt} : aperçu régénéré = générateur`);
    const d = await desactives(page);
    assert(!d.copie && !d.telech, `${tool.id}/${fmt} : copie et téléchargement réactivés`);
    vus.add(pre);
  }
  assert(vus.size === 3, `${tool.id} : les trois formats produisent trois scripts distincts`);
  await context.close();
}

// ---------------------------------------------------------------------------
// 4. Validation, entrées hostiles, secrets, invalidation de l’aperçu
// ---------------------------------------------------------------------------
console.log('\n[validation] champs invalides, hostiles, secrets');
async function essaiInvalide(tool, id, valeur, label, motif) {
  const { context, page } = await ouvrir(tool);
  const avant = await lirePre(page);
  await remplir(page, id, valeur);
  assert((await desactives(page)).copie && (await desactives(page)).telech, `${label} : copie/téléchargement désactivés dès la modification`);
  await page.click('button[type=submit]');
  const span = page.locator(`#${id}-error`);
  assert(await span.isVisible(), `${label} : message d’erreur affiché`);
  if (motif) assert(motif.test(await span.textContent()), `${label} : message attendu`, await span.textContent());
  assert((await lirePre(page)) === avant, `${label} : l’aperçu n’est pas régénéré`);
  const d = await desactives(page);
  assert(d.copie && d.telech, `${label} : copie/téléchargement restent désactivés après refus`);
  assert(await page.locator(`#${id}`).evaluate((e) => e.classList.contains('field-invalid')), `${label} : champ marqué invalide`);
  // Correction : revient à une valeur valide, régénération possible
  const t = tool.fields.find((f) => f.id === id);
  await remplir(page, id, String(t.default ?? ''));
  await page.click('button[type=submit]');
  assert(!(await span.isVisible()), `${label} : l’erreur disparaît après correction`);
  assert(!(await desactives(page)).copie, `${label} : copie réactivée après correction`);
  await context.close();
}
const T = (id) => tools.find((t) => t.id === id);
await essaiInvalide(T('azure-contexte'), 'azTenant', 'pas-un-guid', 'tenant non GUID', /GUID/);
await essaiInvalide(T('azure-contexte'), 'azTenant', '11111111-1111-1111-1111-111111111111; Remove-AzVM', 'injection ; dans le tenant');
await essaiInvalide(T('azure-vm-etat'), 'azRg', 'rg-lab"; Remove-AzResourceGroup -Name x; "', 'injection dans le groupe');
await essaiInvalide(T('azure-vm-etat'), 'azVm', 'vm\nStop-AzVM', 'saut de ligne dans la VM');
await essaiInvalide(T('azure-vm-etat'), 'azHeures', '99999', 'durée hors plage');
await essaiInvalide(T('azure-budgets'), 'azLimite', '-5', 'limite négative');
await essaiInvalide(T('azure-rbac'), 'azPrincipal', 'client_secret=abc123XYZ789', 'secret dans le principal', /secret/i);
await essaiInvalide(T('azure-rbac'), 'azPrincipal', 'p@ssw0rd!', 'mot de passe (variante leet) dans le principal', /secret/i);
await essaiInvalide(T('entra-recherche'), 'azDebut', "x' or '1'='1", 'quote dans la recherche Entra');
// Défauts d’exemple refusés pour un identifiant « réel » (GUID nul)
await essaiInvalide(T('azure-contexte'), 'azTenant', '00000000-0000-0000-0000-000000000000', 'GUID nul');

// ---------------------------------------------------------------------------
// 5. Champs conditionnels et confirmations (actions à -WhatIf)
// ---------------------------------------------------------------------------
console.log('\n[confirmations] champs conditionnels et phrases exactes');
for (const [id, verbe, cmd] of [['azure-vm-demarrage', 'DEMARRER', 'Start-AzVM'], ['azure-vm-arret', 'ARRETER', 'Stop-AzVM']]) {
  const tool = T(id);
  const { context, page } = await ouvrir(tool);
  const pre0 = await lirePre(page);
  assert(!/-Force/.test(pre0), `${id} : aucun -Force`);
  assert(/-WhatIf/.test(pre0), `${id} : mode Diagnostic = -WhatIf`);
  await page.selectOption('#azMode', 'Appliquer');
  await page.click('button[type=submit]');
  assert(await page.locator('#azConfirmation-error').isVisible(), `${id} : Appliquer sans phrase est refusé`);
  assert((await lirePre(page)) === pre0, `${id} : aperçu inchangé après refus`);
  for (const mauvaise of [`${verbe.toLowerCase()} vm-lab-01`, `${verbe} autre-vm`, `${verbe} vm-lab-01 `, `${verbe}  vm-lab-01`]) {
    await page.fill('#azConfirmation', mauvaise);
    await page.click('button[type=submit]');
    assert(await page.locator('#azConfirmation-error').isVisible(), `${id} : phrase « ${mauvaise} » refusée`);
  }
  await page.fill('#azConfirmation', `${verbe} vm-lab-01`);
  await page.click('button[type=submit]');
  assert(!(await page.locator('#azConfirmation-error').isVisible()), `${id} : phrase exacte acceptée`);
  const pre1 = await lirePre(page);
  assert(pre1 !== pre0 && pre1.includes(cmd), `${id} : mode Appliquer génère l’action ${cmd}`);
  assert(!/-Force/.test(pre1), `${id} : Appliquer sans -Force (invite native conservée)`);
  assert(pre1 === attendu(tool, { ...defaults(tool), azMode: 'Appliquer', azConfirmation: `${verbe} vm-lab-01` }), `${id} : aperçu = générateur`);
  // Repasser en Diagnostic : une phrase résiduelle fausse est refusée ; la phrase exacte
  // est tolérée mais le script reste en prévisualisation (-WhatIf), sans action réelle.
  await page.selectOption('#azMode', 'Diagnostic');
  await page.fill('#azConfirmation', 'phrase sans rapport');
  await page.click('button[type=submit]');
  assert(await page.locator('#azConfirmation-error').isVisible(), `${id} : Diagnostic + phrase sans rapport refusé`);
  await page.fill('#azConfirmation', `${verbe} vm-lab-01`);
  await page.click('button[type=submit]');
  assert(/-WhatIf/.test(await lirePre(page)) && !/-Force/.test(await lirePre(page)), `${id} : Diagnostic + phrase exacte reste en -WhatIf`);
  await page.fill('#azConfirmation', '');
  await page.click('button[type=submit]');
  assert((await lirePre(page)) === pre0, `${id} : retour en Diagnostic = aperçu initial`);
  await context.close();
}
{
  const tool = T('azure-sauvegarde-restauration');
  const { context, page } = await ouvrir(tool);
  await page.selectOption('#azMode', 'Appliquer');
  await page.click('button[type=submit]');
  const msg = await page.locator('#azConfirmation-error').textContent();
  assert(/RESTAURER vm-lab-01 VERS /.test(msg), 'restauration : la phrase attendue est annoncée', msg);
  // Cible identique au groupe source : refusée
  await page.fill('#azRgCible', await page.inputValue('#azRgVm'));
  await page.click('button[type=submit]');
  assert(await page.locator('#azRgCible-error').isVisible(), 'restauration : cible = groupe source refusée');
  await context.close();
}
{
  // RBAC : groupe de ressources obligatoire seulement pour la portée « GroupeRessources »
  const tool = T('azure-rbac');
  const { context, page } = await ouvrir(tool);
  await page.fill('#azRg', '');
  await page.click('button[type=submit]');
  assert(!(await page.locator('#azRg-error').isVisible()), 'RBAC : groupe facultatif en portée Abonnement');
  await page.selectOption('#azPortee', 'GroupeRessources');
  await page.click('button[type=submit]');
  assert(await page.locator('#azRg-error').isVisible(), 'RBAC : groupe obligatoire en portée GroupeRessources');
  await page.fill('#azRg', 'rg-lab');
  await page.click('button[type=submit]');
  assert(!(await page.locator('#azRg-error').isVisible()), 'RBAC : groupe renseigné accepté');
  assert((await lirePre(page)).includes(Buffer.from('rg-lab').toString('base64')), 'RBAC : le groupe figure dans le script (valeur encodée)');
  await context.close();
}

// ---------------------------------------------------------------------------
// 6. Mobile (390 px) : pas de débordement horizontal, actions accessibles
// ---------------------------------------------------------------------------
console.log('\n[mobile] 390 × 844');
for (const tool of azure) {
  const { context, page } = await ouvrir(tool, { width: 390, height: 844 });
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    cloud: !!document.querySelector('#cloudBloc'),
    btn: document.querySelector('#downloadButton')?.getBoundingClientRect().width ?? 0,
  }));
  assert(m.sw <= m.cw + 1, `${tool.id} : aucun débordement horizontal`, `${m.sw} > ${m.cw}`);
  assert(m.cloud && m.btn > 60, `${tool.id} : bloc cloud et bouton Télécharger présents`);
  await context.close();
}

await browser.close();
server.close();
console.log(`\nBanc navigateur Azure : ${passed} OK, ${failed} ÉCHEC(S).`);
process.exit(failed ? 1 : 0);
