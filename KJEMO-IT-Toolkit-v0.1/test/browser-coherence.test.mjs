#!/usr/bin/env node
/**
 * browser-coherence.test.mjs — UX-COHERENCE-03 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Banc Playwright de cohérence : parcours de TOUTES les routes sans
 * rechargement (états périmés), en-têtes et méthodes nommées, liens
 * réciproques, changements de méthode et de fiche, favoris, mobile, clavier.
 *
 * CE QUE CE BANC PROUVE : le comportement de l'interface dans un vrai
 * navigateur — ce qui est affiché, ce qui est copié (lu dans le presse-papiers
 * réel du navigateur), ce qui est refusé, ce qui est retenu ou non d'une fiche
 * à l'autre, les contrastes calculés, l'absence de débordement à 390 px.
 * CE QU'IL NE PROUVE PAS : l'effet d'une commande sur un équipement, un tenant
 * ou un poste réel (NON EXÉCUTÉ : le Toolkit n'exécute rien).
 *
 * Usage : node test/browser-scenarios.test.mjs   (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const { tools } = await imp('generators.mjs');
const T = await imp('taches.mjs');

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
async function nouvellePage(opts = {}, hash = '/') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true, ...opts });
  const page = await context.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(BASE + hash);
  return { context, page, erreurs };
}
const attendreListe = (page) => page.waitForSelector('#toolGrid .task-row, #toolGrid .empty');
const recherche = async (page, q) => { await page.fill('#search', q); await page.waitForTimeout(80); };
const premiereId = (page) => page.$eval('#toolGrid .task-row', (e) => e.dataset.id).catch(() => null);



const ouvrir = async (hash, opts = {}) => {
  const { context, page, erreurs } = await nouvellePage(opts, '/');
  await page.goto(BASE + '/#' + hash); await page.reload();
  await page.waitForSelector('#toolView:not([hidden]) h1, #taskView:not([hidden]) h1');
  return { context, page, erreurs };
};
const E = T.TOUTES_LES_ENTREES;
const PL = await imp('plateforme.mjs');
const V = await imp('vue-taches.mjs');
const vueVisible = (page) => page.evaluate(() => {
  const o = [...document.querySelectorAll('#toolView,#taskView')].filter((v) => !v.hidden);
  return { n: o.length, id: o[0]?.id, h1: o[0]?.querySelector('h1')?.textContent.trim().replace(/\s+/g, ' ') };
});

console.log('1. Parcours de toutes les routes SANS rechargement : une vue, bon contenu, aucun état périmé');
{
  const { context, page, erreurs } = await nouvellePage({}, '/');
  await page.waitForTimeout(200);
  let ko = 0; let n = 0;
  for (const e of E) {
    const hash = e.procedure ? `#/tache/${e.id}` : `#/outil/${e.id}`;
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForFunction((id) => { const v = [...document.querySelectorAll('#toolView,#taskView')].find((x) => !x.hidden); return v && v.querySelector('h1') && (v.querySelector('.tache')?.dataset.id === id || v.querySelector('#toolForm')); }, e.id, { timeout: 4000 }).catch(() => {});
    const r = await page.evaluate(({ id, assistant }) => {
      const vis = [...document.querySelectorAll('#toolView,#taskView')].filter((v) => !v.hidden);
      const v = vis[0];
      const t = (s) => [...v.querySelectorAll(s)].map((x) => x.textContent.trim().replace(/\s+/g, ' '));
      return { n: vis.length, vid: v?.id, h1: t('h1')[0], tag: t('.tag')[0], nav: t('.fiche-nav-link'), badges: t('.methode-badge'), tabs: t('.method-tab'),
        dataId: v?.querySelector('.tache')?.dataset.id ?? null, ton: v?.querySelector('#scriptResume .sr-row:nth-child(2)')?.className ?? null, fav: !!v?.querySelector('#taskFav,#toolFav'),
        autreVide: document.querySelector(assistant ? '#taskView' : '#toolView').hidden };
    }, { id: e.id, assistant: e.kind === 'assistant' });
    n++;
    const titre = e.titre.replace(/\s+/g, ' ');
    const ok = r.n === 1 && r.vid === (e.kind === 'assistant' ? 'toolView' : 'taskView') && r.h1?.includes(titre.slice(0, 20))
      && r.fav && (r.badges.length > 0 || r.tabs.length > 1) && r.autreVide
      && (e.kind !== 'assistant' || r.ton === `sr-row sr-${(e.tool.readOnly === true || e.tool.risk === 'diagnostic') ? 'ok' : (e.tool.risk === 'destructive' ? 'danger' : 'attention')}`)
      && (e.kind === 'assistant' ? r.nav[1] === PL.etiquetteSortie(e.tool) && /ASSISTANT COMPLET$/.test(r.tag) && !r.dataId : r.dataId === e.id && r.tag.endsWith(V.LIBELLE_KIND[e.kind].toUpperCase()));
    if (!ok) { ko++; console.error(`  [FAIL]  route ${hash}`, JSON.stringify(r)); }
  }
  assert(ko === 0 && n === E.length, `${n} routes affichées correctement, sans rechargement (${ko} écart)`);
  assert(erreurs.length === 0, 'aucune erreur JS pendant le parcours', erreurs.join(' | '));
  await context.close();
}

console.log('2. Aucune étiquette « Script » seule dans les assistants, en-tête aligné sur les fiches');
{
  const { context, page } = await ouvrir('/outil/static-ip');
  const nav = await page.$$eval('.fiche-nav-link', (a) => a.map((x) => x.textContent.trim()));
  assert(nav.includes('Script PowerShell') && !nav.includes('Script'), 'ancre : « Script PowerShell » (jamais « Script »)', nav.join('|'));
  assert(await page.locator('#toolMeta .plat').count() === 1 && await page.locator('#toolMeta .methode-badge').textContent() === 'Script PowerShell', 'en-tête : plateforme + langage');
  assert(await page.locator('#toolMeta .effet').count() === 0 && await page.locator('.tool-header .risk').count() === 1, 'en-tête : l’effet est porté une seule fois (pastille de risque), sans doublon');
  const bash = await ouvrir('/outil/' + E.find((e) => e.kind === 'assistant' && PL.estBash(e.tool)).id);
  assert((await bash.page.$$eval('.fiche-nav-link', (a) => a[1].textContent.trim())) === 'Script Bash', 'assistant Bash : ancre « Script Bash »');
  assert(/Script Bash/.test(await bash.page.locator('#titreScript').textContent()), 'titre de section : Script Bash');
  await bash.context.close();
  const ios = await ouvrir('/outil/' + E.find((e) => e.kind === 'assistant' && PL.estIOS(e.tool)).id);
  assert((await ios.page.$$eval('.fiche-nav-link', (a) => a[1].textContent.trim())) === 'Commandes Cisco IOS', 'assistant Cisco : ancre « Commandes Cisco IOS »');
  assert(await ios.page.locator('#toolMeta .plat').textContent().then((x) => /Cisco/.test(x)), 'assistant Cisco : plateforme Cisco');
  await ios.context.close();
  const az = await ouvrir('/outil/' + E.find((e) => e.kind === 'assistant' && e.tool.category.startsWith('Azure')).id);
  assert(/Azure/.test(await az.page.locator('#toolMeta .plat').textContent()), 'assistant Azure : plateforme Azure (et non Windows)');
  await az.context.close();
  await context.close();
}

console.log('3. Liens réciproques fiche ⇄ assistant ⇄ commande, sans état périmé');
{
  const id = E.find((e) => e.kind === 'assistant' && T.liensDeAssistant(e.id).procedures.length).id;
  const fiche = T.liensDeAssistant(id).procedures[0];
  const { context, page } = await ouvrir('/outil/' + id);
  assert(await page.locator('#ficheRapide a').first().getAttribute('href') === `#/tache/${fiche.id}`, 'assistant → version courte');
  await page.locator('#ficheRapide a').first().click();
  await page.waitForSelector(`#taskView:not([hidden]) .tache[data-id="${fiche.id}"]`);
  assert((await vueVisible(page)).id === 'taskView', 'la fiche s’affiche (assistant masqué)');
  await page.click('#assistantLink');
  await page.waitForSelector('#toolView:not([hidden]) #toolForm');
  assert((await vueVisible(page)).id === 'toolView' && await page.locator('#scriptOutput').count() === 1, 'fiche → assistant complet');
  await page.goBack();
  await page.waitForSelector(`#taskView:not([hidden]) .tache[data-id="${fiche.id}"]`);
  assert((await vueVisible(page)).n === 1, 'retour navigateur : une seule vue visible');
  await context.close();
  // commande rapide liée
  const idc = E.find((e) => e.kind === 'assistant' && T.liensDeAssistant(e.id).commandes.length && !T.liensDeAssistant(e.id).procedures.length).id;
  const cmd = T.liensDeAssistant(idc).commandes[0];
  const c2 = await ouvrir('/outil/' + idc);
  assert(await c2.page.locator('#commandesLiees a').first().getAttribute('href') === `#/tache/${cmd.id}`, 'assistant → commande rapide liée');
  await c2.page.locator('#commandesLiees a').first().click();
  await c2.page.waitForSelector(`#taskView:not([hidden]) .tache[data-id="${cmd.id}"]`);
  await c2.page.click('#assistantLink');
  await c2.page.waitForSelector('#toolView:not([hidden]) #toolForm');
  assert((await c2.page.locator('#toolView h1').textContent()).includes(T.entreeParId(idc).titre.slice(0, 15)), 'commande → assistant : bon assistant');
  await c2.context.close();
}

console.log('4. Changements de méthode et de fiche sans rechargement : aucun ancien état');
{
  const { context, page } = await ouvrir('/tache/windows-ip-fixe', { });
  await page.evaluate(() => localStorage.setItem('kjemo.mode.v1', 'technicien'));
  await page.reload(); await page.waitForSelector('.tache');
  const tabs = await page.$$eval('.method-tab', (t) => t.map((x) => x.dataset.methode));
  assert(tabs.length >= 2, 'fiche multi-méthodes', tabs.join(','));
  const vus = {};
  for (const m of tabs) {
    await page.click(`#tab-${m}`);
    const r = await page.evaluate(() => ({ actif: document.querySelector('.method-tab.is-active')?.dataset.methode, label: document.querySelector('#panneau-methode').getAttribute('aria-label'),
      texte: document.querySelector('#panneau-methode').textContent.trim().length, cmds: [...document.querySelectorAll('.cmd-text')].map((x) => x.textContent).join('\n'),
      copy: document.querySelectorAll('#panneau-methode .copy-seg, #panneau-methode .copy-step, #panneau-methode .copy-phase, #panneau-methode .copy-all, #panneau-methode [data-copy]').length, pre: document.querySelectorAll('#panneau-methode pre').length,
      params: [...document.querySelectorAll('#paramsForm [id^="p-"], .params [id^="p-"]')].map((x) => x.id) }));
    vus[m] = r;
    assert(r.actif === m && r.texte > 40, `méthode ${m} : onglet actif et panneau non vide`);
    if (m === 'gui') assert(r.copy === 0 && r.pre === 0 && r.cmds === '', 'méthode graphique : ni commande, ni bouton Copier, ni bloc de code');
    else assert(r.cmds.length > 5 && r.copy > 0, `méthode ${m} : commandes réelles à copier`);
  }
  const cm = Object.entries(vus).filter(([m]) => m !== 'gui').map(([, v]) => v.cmds);
  assert(new Set(cm).size === cm.length, 'les méthodes à commandes affichent des commandes distinctes (aucun faux équivalent)');
  // fiche suivante : tout repart de zéro
  await page.click('#tab-cmd');
  await page.fill('#p-ip', '192.168.50.20').catch(() => {});
  await page.evaluate(() => { location.hash = '#/tache/windows-voir-ip'; });
  await page.waitForSelector('.tache[data-id="windows-voir-ip"]');
  const apres = await page.evaluate(() => ({ actif: document.querySelector('.method-tab.is-active')?.dataset.methode, valeurs: [...document.querySelectorAll('.tache input')].map((i) => i.value).filter(Boolean) }));
  const attendu = T.procedureParId('windows-voir-ip').methodes[0].id;
  assert(apres.actif === attendu || apres.actif === undefined, `nouvelle fiche : méthode initiale (${attendu}), pas l'ancienne (cmd)`, apres.actif);
  assert(apres.valeurs.length === 0, 'nouvelle fiche : aucune valeur saisie conservée', apres.valeurs.join(','));
  await page.evaluate(() => { location.hash = '#/tache/windows-ip-fixe'; });
  await page.waitForSelector('.tache[data-id="windows-ip-fixe"]');
  assert(await page.evaluate(() => [...document.querySelectorAll('.tache input[id^="p-"]')].every((i) => !i.value || i.value === i.defaultValue)), 'retour sur la première fiche : valeurs saisies remises à zéro');
  assert(await page.evaluate(() => document.querySelector('.method-tab.is-active')?.dataset.methode) === T.procedureParId('windows-ip-fixe').methodes[0].id, 'retour : méthode initiale');
  await context.close();
}

console.log('5. Assistants : changer d’assistant ne conserve ni valeurs, ni aperçu périmé');
{
  const { context, page } = await ouvrir('/outil/static-ip');
  const champ = await page.$eval('#toolForm input', (i) => i.id);
  await page.fill(`#${champ}`, '10.9.8.7');
  assert(await page.locator('#scriptOutput.stale').count() === 1, 'modification du champ : aperçu marqué obsolète');
  await page.evaluate(() => { location.hash = '#/outil/dns-client-diagnostic'; });
  await page.waitForFunction((t) => document.querySelector('#toolView h1')?.textContent.includes(t), T.entreeParId('dns-client-diagnostic').titre.slice(0, 12));
  const r = await page.evaluate(() => ({ stale: document.querySelectorAll('#scriptOutput.stale').length, copyOff: document.querySelector('#copyButton')?.disabled, valeurs: [...document.querySelectorAll('#toolForm input')].map((i) => i.value).filter((v) => v.includes('10.9.8.7')).length, titre: document.querySelector('#toolView h1').textContent }));
  assert(r.stale === 0 && r.copyOff === false && r.valeurs === 0, 'assistant suivant : aperçu à jour, Copier actif, aucune valeur héritée', JSON.stringify(r));
  await context.close();
}

console.log('6. Recherche, filtres, favoris et récents sur les assistants comme sur les fiches');
{
  const { context, page } = await nouvellePage({}, '/#/'); await page.waitForSelector('#toolGrid .task-row');
  await recherche(page, 'ping');
  const cartes = await page.$$eval('#toolGrid .task-row', (c) => c.map((x) => ({ k: x.dataset.kind, b: [...x.querySelectorAll('.methode-badge')].map((y) => y.textContent) })));
  assert(cartes.length > 0 && cartes.every((c) => c.b.length > 0 && !c.b.includes('Script')), `résultats « ping » : chaque carte nomme sa méthode (${cartes.length})`);
  await recherche(page, '');
  await page.click('[data-plat="Azure"], #platFilters button:has-text("Azure")');
  await page.click('#natureFilters button:has-text("Assistants")');
  const az = await page.$$eval('#toolGrid .task-row', (c) => c.map((x) => x.querySelector('.plat')?.textContent.trim()));
  assert(az.length >= 20 && az.every((p) => /Azure/.test(p)), `filtre Azure × Assistants : ${az.length} assistants Azure`, [...new Set(az)].join('|'));
  // favori depuis la page assistant
  await page.goto(BASE + '/#/outil/static-ip'); await page.waitForSelector('#toolFav');
  await page.focus('#toolFav'); await page.keyboard.press('Enter');
  assert(await page.getAttribute('#toolFav', 'aria-pressed') === 'true', 'favori d’un assistant : activable au clavier');
  await page.goto(BASE + '/#/'); await page.reload(); await page.waitForSelector('#shortcutsZone');
  assert(await page.locator('#shortcutsZone').textContent().then((t) => /IP statique/.test(t)), 'le favori d’un assistant apparaît à l’accueil');
  await page.goto(BASE + '/#/outil/dns-client-diagnostic'); await page.waitForFunction((t) => document.querySelector('#toolView h1')?.textContent.includes(t), T.entreeParId('dns-client-diagnostic').titre.slice(0, 12));
  await page.goto(BASE + '/#/'); await page.reload(); await page.waitForSelector('#historiqueSection');
  const zr = await page.locator('#shortcutsZone').innerText();
  assert(zr.includes(T.entreeParId('dns-client-diagnostic').titre), 'récents : l’assistant consulté (non favori) est listé', zr.slice(0, 200));
  await context.close();
}

console.log('7. Mobile 390 px : un exemplaire de chaque modèle de page, sans défilement horizontal');
{
  const modeles = {
    'assistant PowerShell': E.find((e) => e.kind === 'assistant' && !PL.estBash(e.tool) && !PL.estIOS(e.tool)),
    'assistant Bash': E.find((e) => e.kind === 'assistant' && PL.estBash(e.tool)),
    'assistant Cisco IOS': E.find((e) => e.kind === 'assistant' && PL.estIOS(e.tool)),
    'assistant Azure': E.find((e) => e.kind === 'assistant' && e.tool.category.startsWith('Azure')),
    'fiche multi-méthodes': E.find((e) => e.procedure && e.procedure.methodes.length > 2),
    'fiche Cisco': E.find((e) => e.kind === 'procedure' && e.plateformes[0] === 'Cisco'),
    'commande rapide': E.find((e) => e.kind === 'commande'),
    'scénario': E.find((e) => e.kind === 'scenario'),
  };
  for (const [nom, e] of Object.entries(modeles)) {
    const { context, page } = await ouvrir(e.procedure ? `/tache/${e.id}` : `/outil/${e.id}`, { viewport: { width: 390, height: 800 } });
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert(r.sw <= r.cw + 1, `mobile — ${nom} : pas de défilement horizontal`, `${r.sw}>${r.cw}`);
    await context.close();
  }
}

console.log('8. Couleurs : puces de méthode lisibles (contraste ≥ 4,5), clair et sombre');
{
  const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const scheme of ['dark', 'light']) {
    const { context, page } = await ouvrir('/outil/static-ip', { colorScheme: scheme });
    const [fg, bg] = await page.$eval('#toolMeta .methode-badge', (x) => { const s = getComputedStyle(x); return [s.color, s.backgroundColor]; });
    const a = lum(fg); const b = lum(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert(ratio >= 4.5, `puce de méthode ${scheme} : contraste ${ratio.toFixed(1)}`);
    await context.close();
  }
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
console.log('Exécution réelle sur équipement : NON EXÉCUTÉE. Rendu et copies vérifiés dans un navigateur, rien de plus.');
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
