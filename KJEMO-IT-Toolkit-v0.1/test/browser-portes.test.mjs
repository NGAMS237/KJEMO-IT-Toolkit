#!/usr/bin/env node
/**
 * browser-portes.test.mjs — KJEMO-UX-ACCUEIL-01 · KJEMO IT Toolkit
 * Banc Playwright de l'accueil à trois portes, de l'aide-mémoire et du catalogue pro :
 * portes et couleurs (jamais seules), routes, fil d'Ariane, retours haut et bas, bouton
 * Accueil persistant, Échap, filtre de plateforme unique et sa sortie, puces de l'aide-mémoire,
 * groupes grisés, retour de fiche vers son groupe, clavier, mobile 390 px.
 * NE PROUVE PAS l'effet d'une commande sur une machine réelle (NON EXÉCUTÉ).
 * Usage : node test/browser-portes.test.mjs   (exit 0 = tout OK)   KJEMO_CAPTURES=<dossier> : captures.
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
const capture = async (page, nom) => { if (CAPTURES) await page.screenshot({ path: resolve(CAPTURES, `${nom}.png`), fullPage: false }); };
const hashDe = (page) => page.evaluate(() => location.hash);
const debordement = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);


const COURS_ID = COURS[0].id;

const M = await imp('memo.mjs'); const K = await imp('cours.mjs');
const G = M.MEMO_GROUPES;
const fiche0 = G[0].sous[0].fiches[0];

// 1. Accueil : trois portes, groupes, pas de grille de domaines ni de filtre Contenu
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  assert(await page.locator('#portes .porte').count() === 3, 'accueil : trois portes');
  for (const [cls, nom] of [['porte-tp', 'Mes cours et TP'], ['porte-memo', 'Aide-mémoire du cours'], ['porte-pro', 'Catalogue professionnel']]) {
    const t = await page.locator(`.${cls} h2`).innerText();
    assert(t.includes(nom) && /[✎⌘▣]/.test(t), `porte « ${nom} » : nom ET icône (couleur jamais seule)`);
  }
  assert(await page.locator('.groupe-carte').count() === G.length, `accueil : ${G.length} groupes de l’aide-mémoire`);
  assert(!(await page.locator('#categoriesSection').isVisible()), 'accueil : la grille de domaines n’est plus dupliquée');
  assert(!(await page.locator('#natureFilters').isVisible()), 'accueil : filtre « Contenu » masqué sans recherche');
  assert(await page.locator('#platFilters').isVisible(), 'accueil : le filtre de plateforme reste visible (un seul)');
  assert(await page.locator('#accueilBtn').isVisible(), 'bouton Accueil dans la barre du haut');
  assert(await page.locator('#espacesNav a').count() === 5, 'barre latérale : Accueil, TP, Aide-mémoire, Catalogue pro, Laboratoire');
  assert((await page.locator('.porte-tp .porte-desc').innerText()).includes('sur'), 'porte TP : progression chiffrée');
  assert(await page.locator('a.espace-carte[href="#/labo"]').count() === 1, 'lien « Mon laboratoire » conservé');
  await capture(page, 'portes-01-accueil');
  // Recherche : les portes cèdent la place aux résultats, le filtre Contenu apparaît
  await page.fill('#search', 'samba');
  assert(await page.locator('#portes').count() === 0, 'recherche : portes retirées');
  assert(await page.locator('#natureFilters').isVisible(), 'recherche : filtre « Contenu » disponible');
  assert(await page.locator('#toolGrid .tool-card, #toolGrid a, #toolGrid li, #toolGrid > *').count() > 0, 'recherche : résultats affichés');
  await page.locator('#accueilBtn').click();
  assert(await page.locator('#portes').count() === 1 && (await page.inputValue('#search')) === '', 'Accueil depuis une recherche : tout remis à plat');
  assert(erreurs.length === 0, 'accueil : aucune erreur JS', erreurs.join(' | '));
  await context.close();
}

// 2. Parcours : porte → aide-mémoire → groupe → fiche → retour → accueil
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/');
  await page.click('#porteMemoBtn');
  assert(await hashDe(page) === '#/memo', 'porte Aide-mémoire → #/memo');
  assert(await page.locator('#filPortes').innerText().then((t) => t.includes('Accueil') && t.includes('Aide-mémoire')), 'aide-mémoire : fil d’Ariane');
  assert(await page.locator('#portesView .retours').count() === 2, 'aide-mémoire : retour en haut ET en bas');
  assert(await page.locator('#portesView .groupe-bloc').count() === G.length, 'aide-mémoire : tous les groupes');
  await capture(page, 'portes-02-memo');
  await page.click(`#portesView .groupe-bloc[data-groupe="${G[0].id}"] summary`);
  await page.click(`#portesView .groupe-bloc[data-groupe="${G[0].id}"] .groupe-resume a`);
  assert(await hashDe(page) === `#/memo/${G[0].id}`, 'groupe → #/memo/<groupe>');
  assert((await page.locator('#portesView h1').innerText()).includes(G[0].titre), 'page de groupe : titre');
  await capture(page, 'portes-03-groupe');
  await page.locator(`#portesView .fiche-ligne[data-id="${fiche0}"] h3 a`).click();
  assert((await hashDe(page)).startsWith('#/tache/'), 'fiche ouverte');
  assert(await page.locator('#taskView.fiche-modale').isVisible(), 'fiche : ouverte en fenêtre');
  assert(await page.locator('#portesView h1').isVisible(), 'fenêtre : la page du groupe reste derrière');
  assert(await page.locator('#modaleFermer').isVisible(), 'fenêtre : la croix « Fermer » est visible');
  await page.click('#modaleFermer');
  await page.waitForFunction((h) => location.hash === h, `#/memo/${G[0].id}`);
  assert(await hashDe(page) === `#/memo/${G[0].id}`, 'fermer la fenêtre → même page du groupe');
  assert(await page.locator('#taskView').isHidden(), 'fenêtre fermée');
  await page.keyboard.press('Escape');
  assert(await hashDe(page) === '#/memo', 'Échap : groupe → aide-mémoire');
  await page.keyboard.press('Escape');
  assert(await hashDe(page) === '#/', 'Échap : aide-mémoire → accueil');
  const direct = await nouvellePage({}, `/#/tache/${fiche0}`);
  assert(await direct.page.locator('#retourMemo').isVisible(), 'lien direct : fiche en pleine page avec « Retour à <groupe> »');
  assert(await direct.page.locator('#modaleFermer').count() === 0, 'lien direct : pas de fenêtre (rien derrière)');
  await direct.page.keyboard.press('Escape');
  assert(await hashDe(direct.page) === `#/memo/${G[0].id}`, 'Échap sur une fiche en pleine page → son groupe');
  await direct.context.close();
  await page.evaluate((h) => { location.hash = h; }, `#/memo/${G[0].id}`);
  await page.locator(`#portesView .fiche-ligne[data-id="${fiche0}"] h3 a`).click();
  await page.keyboard.press('Escape');
  await page.waitForFunction((h) => location.hash === h, `#/memo/${G[0].id}`);
  assert(await page.locator('#taskView').isHidden() && await page.locator('#portesView h1').isVisible(), 'Échap ferme la fenêtre et laisse la page');
  await page.locator(`#portesView .fiche-ligne[data-id="${fiche0}"] h3 a`).click();
  await page.mouse.click(300, 400);   // clic sur le fond : ferme la fenêtre
  await page.waitForFunction((h) => location.hash === h, `#/memo/${G[0].id}`);
  assert(await page.locator('#taskView').isHidden(), 'clic sur le fond : la fenêtre se ferme');
  await page.locator('#accueilBtn').click();
  await page.waitForFunction(() => location.hash === '#/');
  assert(await hashDe(page) === '#/', 'bouton Accueil depuis une fiche');
  assert(erreurs.length === 0, 'parcours : aucune erreur JS', erreurs.join(' | '));
  await context.close();
}

// 3. Fiche arrivée depuis un parcours de cours : le retour reste le parcours, pas l'aide-mémoire
{
  const q = COURS[0].parcours[0];
  const ref = q.items.flatMap((i) => i.refs ?? []).find((r) => M.groupeDeFiche(r.fiche) && r.etape);
  const { context, page } = await nouvellePage({}, '/' + K.lienEtape(ref, { coursId: COURS[0].id, lettre: q.lettre }));
  assert(await page.locator('#retourParcours').count() === 1, 'depuis un parcours : « Retour au parcours » présent');
  assert(await page.locator('#retourMemo').count() === 0, 'depuis un parcours : pas de retour à l’aide-mémoire');
  await page.keyboard.press('Escape');
  assert((await hashDe(page)).startsWith(`#/cours/${COURS[0].id}/${q.lettre}`), 'Échap depuis un parcours → ce parcours', await hashDe(page));
  await context.close();
}

// 4. Filtre de plateforme : badge visible, sortie, groupes grisés (pas supprimés)
{
  const { context, page } = await nouvellePage({}, '/#/');
  await page.click('#platFilters [data-plat="Azure"]');
  assert(await page.locator('#home .groupe-carte').count() === 0 && await page.locator('#home .porte-vide').count() >= 1, 'Azure : accueil sans carte vide, avec les portes « Bientôt »');
  await page.goto(`${BASE}/#/memo`);
  assert(await page.locator('#portesView .groupe-masque').count() === G.length && await page.locator('#portesView details.groupe-bloc').count() === 0, 'Azure : page Aide-mémoire, tous les groupes regroupés et nommés dans une ligne, aucun supprimé sans explication');
  await page.goto(`${BASE}/#/`);
  await page.goto(`${BASE}/#/memo`);
  assert(await page.locator('#filtreActif').isVisible(), 'aide-mémoire : badge « Filtre : Azure » visible');
  assert(await page.locator('#groupesMasques').isVisible() && /sans fiche pour ce filtre \(Azure\)/.test(await page.locator('#groupesMasques').innerText()), 'aide-mémoire : la ligne dit pourquoi les groupes sont regroupés');
  await page.click('#filtreSortie');
  assert(await page.locator('#filtreActif').count() === 0 && await page.locator('#portesView details.groupe-bloc').count() === G.length, 'sortie du filtre : tout revient');
  await page.click('#platFilters [data-plat="Windows"]').catch(() => {});
  await context.close();
}
// 4 bis. Filtre Windows : les groupes Windows sont actifs, les autres regroupés dans une ligne, un assistant s'ouvre
{
  const { context, page } = await nouvellePage({}, '/#/');
  await page.click('#platFilters [data-plat="Windows"]');
  await page.goto(`${BASE}/#/memo`);
  const actifs = await page.locator('#portesView details.groupe-bloc').count();
  const masques = await page.locator('#portesView .groupe-masque').count();
  assert(actifs >= 6 && actifs + masques === G.length, `Windows : ${actifs} groupes actifs + ${masques} regroupés = ${G.length}`, `${actifs}/${masques}`);
  assert(await page.locator('#portesView .groupe-bloc.is-vide').count() === 0, 'Windows : plus de blocs gris un par un');
  assert(await page.locator('#portesView details.groupe-bloc[data-groupe="win-ad"]').count() === 1, 'Windows : le groupe Active Directory est là');
  const lienAssistant = page.locator('#portesView details.groupe-bloc[data-groupe="win-ad"] .fiche-ligne[data-id="ad-user"] h3 a');
  assert(await lienAssistant.getAttribute('href') === '#/outil/ad-user', 'assistant : lien vers #/outil/ad-user');
  await page.goto(`${BASE}/#/memo/win-gpo`);
  assert(await page.locator('#portesView .titre-groupe').isVisible() && await page.locator('#portesView .fiche-ligne').count() >= 10, 'page du groupe GPO : fiches affichées');
  await page.goto(`${BASE}/#/outil/ad-user`);
  assert(await page.locator('#toolView h1').isVisible(), 'l’assistant lié depuis l’aide-mémoire s’ouvre');
  await context.close();
}
{
  const { context, page } = await nouvellePage({}, '/#/memo');
  const tous = await page.locator('#portesView .fiche-ligne').count();
  await page.click('[data-memo-filtre="nouveau"]');
  assert(await page.locator('[data-memo-filtre="nouveau"]').getAttribute('aria-pressed') === 'true', 'puce Nouveautés : état annoncé');
  const nv = await page.locator('#portesView .groupe-bloc:not(.is-vide) .fiche-ligne').count();
  assert(nv === M.idsNouveaux().size, `Nouveautés : ${nv} fiches = ${M.idsNouveaux().size} calculées`);
  await page.click('[data-memo-filtre="tp"]');
  const tp = await page.locator('#portesView .fiche-ligne').count();
  assert(tp > 0 && tp <= tous, 'Liés au TP : sous-ensemble non vide');
  await page.click('[data-memo-filtre="tous"]');
  assert(await page.locator('#portesView .fiche-ligne').count() === tous, 'Tous : retour au total');
  await context.close();
}

// 5. Catalogue pro
{
  const { context, page } = await nouvellePage({}, '/#/');
  await page.click('#porteProBtn');
  assert(await hashDe(page) === '#/catalogue', 'porte Catalogue → #/catalogue');
  assert(await page.locator('#portesView .domaine-carte').count() >= 8, 'catalogue : les domaines');
  assert(await page.locator('#portesView .retours').count() === 2, 'catalogue : retour haut et bas');
  await capture(page, 'portes-04-catalogue');
  await page.locator('.domaine-carte[data-domaine="active-directory"]').click();
  assert((await hashDe(page)).startsWith('#/rubrique/active-directory'), 'domaine → rubrique existante');
  assert(await page.locator('.retour-btn', { hasText: 'Retour au catalogue professionnel' }).count() >= 1, 'rubrique : retour au catalogue pro');
  await page.goBack();
  assert(await hashDe(page) === '#/catalogue', 'Précédent du navigateur → catalogue');
  await page.goto(`${BASE}/#/memo/inconnu`);
  assert(await page.locator('#portesView .groupe-bloc').count() === G.length, 'groupe inconnu : retombe sur l’aide-mémoire');
  await context.close();
}

// 6. Clavier et mobile
{
  const { context, page } = await nouvellePage({}, '/#/');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const foc = await page.evaluate(() => document.activeElement?.tagName);
  assert(Boolean(foc), 'clavier : le focus avance');
  await context.close();
}
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 844 } }, '/#/');
  for (const h of ['/#/', '/#/memo', `/#/memo/${G[0].id}`, '/#/catalogue']) {
    await page.goto(BASE + h);
    await page.waitForSelector('h1', { state: 'attached' });
    assert(!(await debordement(page)), `mobile : ${h} sans défilement horizontal`);
  }
  await page.goto(`${BASE}/#/`);
  const cibles = await page.locator('#portes a, .groupe-carte').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  assert(cibles.length > 0 && cibles.every((h) => h >= 44), 'mobile : cibles tactiles ≥ 44 px', cibles.join(','));
  await capture(page, 'portes-05-mobile-accueil');
  await page.goto(`${BASE}/#/memo`);
  await capture(page, 'portes-06-mobile-memo');
  await context.close();
}

await browser.close();
server.close();
console.log(`\nbrowser-portes : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
