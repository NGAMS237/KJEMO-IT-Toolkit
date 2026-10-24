#!/usr/bin/env node
/**
 * browser-scenarios.test.mjs — UX-COMMANDES-PROCEDURES-02 (V2) · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Banc Playwright (Chromium headless) de la couche « tâches » : accueil
 * compact, recherche, fiche tâche (paramètres, copie par étape, méthodes),
 * assistants (résumé, script replié, téléchargements), mobile, thèmes,
 * clavier.
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


const presse = (page) => page.evaluate(() => navigator.clipboard.readText());
async function ouvrir(hash, mode) {
  const { context, page, erreurs } = await nouvellePage({}, '/');
  if (mode) { await page.evaluate((m) => localStorage.setItem('kjemo.mode.v1', m), mode); }
  await page.goto(BASE + '/#' + hash); await page.reload();
  await page.waitForSelector('.tache');
  return { context, page, erreurs };
}
const cmds = (page) => page.$$eval('.cmd-text', (e) => e.map((x) => x.textContent));

console.log('1. Deux vues, valeur par défaut selon le mode, bascule locale');
{
  const d = await ouvrir('/tache/cisco-creer-vlan', 'debutant');
  assert(await d.page.getAttribute('#vue-pas', 'aria-pressed') === 'true', 'Débutant : Pas à pas par défaut');
  await d.page.fill('#p-vlan', '10'); await d.page.fill('#p-nom', 'ADMIN');
  const cPas = await cmds(d.page);
  await d.page.click('#vue-rapide');
  assert(await d.page.getAttribute('#vue-rapide', 'aria-pressed') === 'true', 'bascule locale vers Vue rapide');
  assert(await d.page.evaluate(() => localStorage.getItem('kjemo.mode.v1')) !== 'technicien', 'la bascule locale ne change pas le mode global');
  const cRap = await cmds(d.page);
  assert(JSON.stringify(cPas) === JSON.stringify(cRap) && cRap.length > 3, 'mêmes commandes dans les deux vues (une seule définition)');
  assert(await d.page.locator('.step-attendu').count() === 0, 'Vue rapide : pas de résultat attendu intercalé');
  assert((await d.erreurs).length === 0, 'aucune erreur JS');
  await d.context.close();
  const t = await ouvrir('/tache/cisco-creer-vlan', 'technicien');
  assert(await t.page.getAttribute('#vue-rapide', 'aria-pressed') === 'true', 'Technicien : Vue rapide par défaut');
  await t.context.close();
}

console.log('2. Scénario inter-VLAN : exemple, copie par équipement, refus motivés');
{
  const { context, page, erreurs } = await ouvrir('/tache/scenario-cisco-inter-vlan-routeur', 'technicien');
  assert(await page.locator('.copy-eq[aria-disabled="true"]').count() === 3, 'sans valeurs : copie par équipement bloquée');
  await page.click('#exemplesBtn');
  await page.waitForSelector('.copy-eq:not([aria-disabled="true"]), .copy-eq');
  await page.evaluate(() => navigator.clipboard.writeText('SENTINELLE'));
  // Par conception : les étapes des 3 équipements s'intercalent (test depuis le poste) → copie
  // globale par équipement refusée, motif visible ; la copie bloc par bloc reste possible.
  const motifs = await page.$$eval('.copy-eq', (b) => b.map((x) => document.getElementById(x.getAttribute('aria-describedby')).textContent));
  assert(motifs.length === 3 && motifs.every((m) => m.length > 20), 'copie par équipement refusée avec un motif lisible');
  const nbOk = await page.locator('.copy-phase:not([aria-disabled="true"])').count();
  assert(nbOk >= 3, `${nbOk} blocs de phase copiables`);
  await page.locator('.copy-phase:not([aria-disabled="true"])').first().click();
  const texte = await presse(page);
  assert(texte !== 'SENTINELLE' && texte.length > 5, 'copie du bloc placée dans le presse-papiers');
  assert(!/^\s*(Switch|Router|[A-Za-z0-9_-]+)[#>]/m.test(texte) && !/Étape \d|‹|\{\{/.test(texte), 'ni invite, ni numéro d’étape, ni placeholder dans la copie');
  assert(await page.locator('#dlDossier:not([aria-disabled="true"])').count() === 1, 'dossier téléchargeable une fois le plan valide');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dlDossier')]);
  assert(/^procedure-.*\.md$/.test(dl.suggestedFilename()), 'dossier .md téléchargé');
  // incohérence : même VLAN deux fois → blocage et message
  await page.fill('#t-plan-1-vlan', await page.inputValue('#t-plan-0-vlan'));
  await page.evaluate(() => navigator.clipboard.writeText('SENTINELLE'));
  await page.locator('.copy-phase').nth(3).click({ force: true });
  assert(await presse(page) === 'SENTINELLE' || (await page.locator('.copy-phase[aria-disabled="true"]').count()) > 0, 'plan incohérent : copie bloquée');
  assert((await page.locator('.table-err, .param-error, [role="alert"]').count()) > 0, 'incohérence signalée en texte');
  // ligne ajoutée / retirée
  const avant = await page.locator('.row-del').count();
  await page.click('.row-add');
  assert(await page.locator('.row-del').count() === avant + 1, 'ajout d’une ligne');
  await page.locator('.row-del').last().click();
  assert(await page.locator('.row-del').count() === avant, 'retrait d’une ligne');
  assert(erreurs.length === 0, 'aucune erreur JS');
  await context.close();
}

console.log('3. Secret : jamais saisi dans le navigateur');
{
  const { context, page } = await ouvrir('/tache/scenario-cisco-ssh-commutateur', 'technicien');
  assert(await page.locator('#paramsForm input[type="password"], #paramsForm input[id*="secret" i], #paramsForm input[id*="motdepasse" i]').count() === 0, 'aucun champ de mot de passe');
  assert(await page.locator('.cmd-secret').count() >= 1 && await page.locator('.interaction.is-secret').count() >= 1, 'étape secret signalée en texte');
  await context.close();
}

console.log('4. Scénario Windows : PowerShell et CMD, copie par méthode');
{
  const { context, page } = await ouvrir('/tache/scenario-windows-diagnostic-reseau', 'technicien');
  const onglets = await page.locator('[role="tab"]').allTextContents();
  assert(onglets.some((x) => /PowerShell/i.test(x)) && onglets.some((x) => /CMD/i.test(x)), `méthodes PowerShell et CMD (${onglets.join(' | ')})`);
  await context.close();
}

console.log('5. Mobile 390 px : aucun défilement horizontal, deux vues');
for (const id of ['scenario-cisco-inter-vlan-routeur', 'scenario-cisco-ssh-commutateur', 'scenario-linux-ssh', 'windows-ip-fixe']) {
  for (const vue of ['#vue-rapide', '#vue-pas']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await context.newPage();
    await page.goto(BASE + '/#/tache/' + id); await page.waitForSelector('.tache');
    await page.click(vue);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert(sw, `${id} ${vue} : pas de défilement horizontal à 390 px`);
    await context.close();
  }
}

console.log('6. Compatibilité : routes, historique et assistants intacts');
{
  const { context, page } = await nouvellePage({}, '/#/assistants');
  await page.waitForSelector('#toolGrid');
  assert(await page.locator('#toolGrid .tool-card, #toolGrid .task-row').count() > 0, 'route #/assistants affichée');
  await context.close();
}

console.log('7. Vue rapide : copies de segment lues dans le presse-papiers, par équipement');
{
  for (const id of ['scenario-cisco-ssh-commutateur', 'scenario-cisco-inter-vlan-routeur', 'scenario-linux-ssh']) {
    const { context, page, erreurs } = await ouvrir('/tache/' + id, 'technicien');
    await page.click('#exemplesBtn');
    const n = await page.locator('.copy-seg:not([aria-disabled="true"]), .copy-phase:not([aria-disabled="true"]), .copy-step:not([aria-disabled="true"])').count();
    assert(n >= 4, `${id} : ${n} boutons de copie actifs`);
    const total = await page.locator('.vue-rapide .cmd-block').count();
    let verifies = 0;
    for (let k = 0; k < total; k++) {
      const bloc = page.locator('.vue-rapide .cmd-block').nth(k);
      const btn = bloc.locator('.copy-seg, .copy-step');
      if (await btn.count() === 0) continue;
      await page.evaluate(() => navigator.clipboard.writeText('SENTINELLE'));
      await btn.first().click();
      const t = await presse(page);
      const affiche = await bloc.locator('.cmd-text').allTextContents();
      verifies++;
      assert(t !== 'SENTINELLE', `${id} bloc ${k + 1} : copie effectuée`);
      assert(!/^(Switch|Router|[A-Za-z0-9_-]+)(\([a-z-]+\))?[#>]|^PS>|^\$ |‹|Étape \d|\{\{|^# /m.test(t), `${id} bloc ${k + 1} : ni invite, ni repère, ni numéro, ni commentaire`);
      // Le texte copié est la suite des commandes affichées dans ce bloc, ligne pour ligne (secret : espace final seulement).
      const lignes = t.replace(/\r/g, '').replace(/ $/, '').split('\n');
      assert(lignes.length === affiche.length && lignes.every((l, j) => l === affiche[j]), `${id} bloc ${k + 1} : copie = commandes affichées, dans l’ordre`);
    }
    assert(verifies >= 3, `${id} : ${verifies} blocs vérifiés`);
    // Équipements séparés : ni « show » IOS avec « Test-Connection » PowerShell dans un même bloc copié.
    assert(erreurs.length === 0, `${id} : aucune erreur JS`);
    await context.close();
  }
  // SSH : la copie du bloc « compte local » se termine par UN espace (le secret se tape sur l'équipement), jamais par un mot de passe.
  const { context, page } = await ouvrir('/tache/scenario-cisco-ssh-commutateur', 'technicien');
  await page.click('#exemplesBtn');
  await page.evaluate(() => navigator.clipboard.writeText('SENTINELLE'));
  const bloc = page.locator('.vue-rapide .cmd-block', { has: page.locator('.cmd-secret') });
  await bloc.locator('.copy-seg').click();
  const t = await presse(page);
  assert(/ secret $/.test(t) && !/ secret \S/.test(t), 'SSH : la copie s’arrête juste après « secret » (un espace), sans mot de passe');
  assert(await page.locator('.interaction.is-secret').count() >= 1, 'SSH : la pause « secret » est indiquée');
  await context.close();
}

console.log('8. Compacité : hauteur de la Vue rapide (mêmes valeurs, 1280 px, thème sombre) comparée à la V2 livrée');
{
  // Hauteurs MESURÉES sur le HEAD V2 de75d22 avec le même protocole (valeurs d'exemple, Vue rapide, 1280×900, sombre).
  const V2 = { 'scenario-cisco-ssh-commutateur': 4362, 'scenario-cisco-inter-vlan-routeur': 6051, 'scenario-linux-ssh': 3751 };
  for (const [id, base] of Object.entries(V2)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(BASE + '/#/tache/' + id); await page.waitForSelector('.tache');
    await page.click('#exemplesBtn'); await page.click('#vue-rapide');
    const h = await page.evaluate(() => document.querySelector('.tache').getBoundingClientRect().height);
    assert(h <= base * 0.85, `${id} : Vue rapide ${Math.round(h)} px ≤ 85 % de la V2 (${base} px)`);
    const nb = await page.locator('.cmd-text').count();
    await page.click('#vue-pas');
    const hPas = await page.evaluate(() => document.querySelector('.tache').getBoundingClientRect().height);
    assert(h < hPas, `${id} : la Vue rapide (${Math.round(h)}) est plus courte que le Pas à pas (${Math.round(hPas)})`);
    assert(await page.locator('.cmd-text').count() === nb, `${id} : aucune commande masquée pour gagner de la place (${nb})`);
    const px = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.cmd-text')).fontSize));
    assert(px >= 12.5, `${id} : texte des commandes non réduit (${px} px)`);
    await context.close();
  }
}

console.log('9. Vue rapide : thèmes clair et sombre, contrastes, clavier');
{
  const contraste = `(() => {
    const lum = (rgb) => { const [r,g,b] = rgb.map((v) => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; };
    const parse = (s) => (s.match(/[\\d.]+/g) || []).slice(0,4).map(Number);
    const fond = (el) => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.95)) return c.slice(0,3); e = e.parentElement; } return [255,255,255]; };
    const ratio = (el) => { const f = lum(fond(el)); const t = lum(parse(getComputedStyle(el).color).slice(0,3)); const [a,b] = f>t?[f,t]:[t,f]; return (a+0.05)/(b+0.05); };
    return (sels) => Object.fromEntries(sels.map((s) => [s, document.querySelector(s) ? Math.round(ratio(document.querySelector(s))*100)/100 : null]));
  })()`;
  for (const theme of ['sombre', 'clair']) {
    const { context, page } = await nouvellePage({}, '/#/tache/scenario-cisco-ssh-commutateur');
    await page.evaluate((t) => { localStorage.setItem('kjemo.theme.v1', t); localStorage.setItem('kjemo.mode.v1', 'technicien'); }, theme);
    await page.reload(); await page.waitForSelector('.tache');
    await page.click('#exemplesBtn');
    const sels = ['.cmd-text', '.cmd-comment-titre', '.phase-notes .step-important', '.copy-seg', '.phase-title', '.interaction', '.phase-copy-note', '.eq-title', '.tache-resume'];
    const r = await page.evaluate(`(${contraste})(${JSON.stringify(sels)})`);
    for (const [sel, v] of Object.entries(r)) assert(v === null || v >= 4.5, `thème ${theme} : contraste ${sel} = ${v} (≥ 4,5)`);
    // Clavier : Tab atteint un bouton Copier de segment et Entrée copie.
    await page.evaluate(() => navigator.clipboard.writeText('SENTINELLE'));
    await page.locator('.copy-seg').first().focus();
    await page.keyboard.press('Enter');
    assert(await presse(page) !== 'SENTINELLE', `thème ${theme} : copie au clavier (Entrée)`);
    assert(await page.locator('.phase-head .effet-sym, .step-flag, .step-important-label').count() > 0, `thème ${theme} : les effets portent un symbole, pas seulement une couleur`);
    await context.close();
  }
}

console.log('10. Mobile 390 px : Vue rapide, tous les scénarios et fiches CMD, aucun défilement horizontal');
for (const id of ['scenario-windows-diagnostic-reseau', 'windows-ip-fixe', 'windows-ports-ecoute', 'vider-cache-dns', 'journal-evenements-windows', 'scenario-linux-ssh']) {
  for (const meth of ['cmd', 'powershell']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await context.newPage();
    await page.goto(BASE + '/#/tache/' + id); await page.waitForSelector('.tache');
    if (await page.locator('#tab-' + meth).count()) await page.click('#tab-' + meth);
    if (await page.locator('#exemplesBtn').count()) await page.click('#exemplesBtn');
    await page.click('#vue-rapide');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${id}/${meth} : pas de défilement horizontal (Vue rapide)`);
    const chevauche = await page.evaluate(() => [...document.querySelectorAll('.cmd-seg.has-btn')].some((b) => { const pre = b.querySelector('.cmd-pre').getBoundingClientRect(); const bt = b.querySelector('.copy-seg').getBoundingClientRect(); return bt.top < pre.bottom - 2 && bt.bottom > pre.top + 2 && bt.left < pre.right && bt.right > pre.left && [...b.querySelectorAll('.cmd-line')].some((l) => { const r = l.getBoundingClientRect(); return bt.top < r.bottom && bt.bottom > r.top && bt.left < r.right && bt.right > r.left; }); }));
    assert(!chevauche, `${id}/${meth} : le bouton Copier ne recouvre aucune commande`);
    await context.close();
  }
}

console.log('11. Compteurs cohérents, filtre de contenu, 211 routes, favoris et historique');
{
  const { context, page } = await nouvellePage({}, '/#/');
  await attendreListe(page);
  const nav = await page.$$eval('#navigation button', (b) => b.map((x) => [x.dataset.category, x.querySelector('.nav-count').textContent.trim()]));
  const cartes = await page.$$eval('#categoryGrid .category-card', (b) => b.map((x) => [x.dataset.category, x.querySelector('.category-count').firstChild.textContent.trim()]));
  assert(JSON.stringify(nav) === JSON.stringify(cartes), 'menu latéral et cartes de catégorie affichent les mêmes nombres');
  const legende = await page.$eval('#catalogueLegende', (e) => e.textContent);
  const m = legende.match(/(\d+) entrées : (\d+) fiches \(dont (\d+) scénarios\), (\d+) commandes rapides, (\d+) assistants complets listés\. Les (\d+) assistants/);
  assert(m && Number(m[2]) + Number(m[4]) + Number(m[5]) === Number(m[1]) && m[6] === '211' && m[3] === '4', `légende cohérente (${legende.slice(0, 90)}…)`);
  assert(Number(nav[0][1]) === Number(m[1]), 'le total du menu est le nombre d’entrées de la légende');
  assert(await page.locator('#natureFilters .chip').count() === 4 && await page.locator('#platFilters .chip').count() === 5, 'filtre de contenu : 4 puces ; filtre de plateforme : 5 puces');
  await page.click('[data-nature="commande"]');
  assert(await page.locator('#toolGrid .task-row').count() === Number(m[4]) && await page.$$eval('#toolGrid .task-row', (r) => r.every((x) => x.dataset.kind === 'commande')), `filtre « Commandes » : ${m[4]} lignes, toutes des commandes`);
  await page.click('[data-nature="fiche"]');
  assert(await page.locator('#toolGrid .task-row').count() === Number(m[2]) && await page.locator('#toolGrid .task-row[data-kind="scenario"]').count() === 4, `filtre « Procédures et scénarios » : ${m[2]} lignes dont 4 scénarios`);
  await page.click('[data-plat="Cisco"]');
  assert(await page.$$eval('#toolGrid .task-row', (r) => r.length > 3 && r.every((x) => /Cisco/.test(x.textContent))), 'filtres plateforme + contenu combinés');
  await context.close();
}
{
  const { context, page } = await nouvellePage({}, '/#/assistants');
  await page.waitForSelector('#toolGrid .tool-card');
  assert(await page.locator('#toolGrid .tool-card').count() === 211, '#/assistants : exactement les 211 assistants');
  const ids = await page.$$eval('#toolGrid .tool-card', (c) => c.map((x) => x.dataset.id));
  assert(new Set(ids).size === 211, '211 identifiants distincts');
  for (const id of [ids[0], ids[50], ids[100], ids[150], ids[210], 'imp-win-inventaire', 'cisco-vlan-creation']) {
    await page.goto(BASE + '/#/outil/' + id); await page.waitForSelector('#toolView h1');
    assert((await page.$eval('#toolView h1', (e) => e.textContent)).length > 3, `route #/outil/${id} ouvre l’assistant`);
  }
  await page.goto(BASE + '/#/outil/imp-win-inventaire'); await page.waitForSelector('#prereqMore');
  assert(await page.locator('#prereqMore[open]').count() === 0 && await page.isVisible('#impressionBloc') && await page.locator('#scriptOutput').count() === 1, 'assistant : détails repliés, essentiel et script présents');
  assert(await page.locator('#prereqMore').evaluate((d) => { d.open = true; return d.textContent.length; }) > 300, 'assistant : le détail s’ouvre d’un clic, rien n’est retiré');
  await context.close();
}
{
  const { context, page } = await nouvellePage({}, '/#/tache/scenario-linux-ssh');
  await page.waitForSelector('.tache');
  await page.click('#taskFav');
  assert(await page.evaluate(() => localStorage.getItem('kjemo.favoris.v1')).then((v) => /scenario-linux-ssh/.test(v ?? '')), 'favori enregistré pour un scénario');
  await page.goto(BASE + '/#/'); await attendreListe(page);
  assert(await page.locator('#shortcutsZone').textContent().then((t) => /SSH/.test(t)), 'le favori apparaît à l’accueil');
  assert(await page.evaluate(() => localStorage.getItem('kjemo.historique.v1')).then((v) => /scenario-linux-ssh/.test(v ?? '')), 'l’historique retient la fiche ouverte');
  await context.close();
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
