#!/usr/bin/env node
/**
 * browser-taches.test.mjs — UX-COMMANDES-PROCEDURES-01 · KJEMO IT Toolkit
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
 * Usage : node test/browser-taches.test.mjs   (exit 0 = tout OK)
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
const presse = (page) => page.evaluate(() => navigator.clipboard.readText());
const attendreListe = (page) => page.waitForSelector('#toolGrid .task-row, #toolGrid .empty');
const recherche = async (page, q) => { await page.fill('#search', q); await page.waitForTimeout(80); };
const premiereId = (page) => page.$eval('#toolGrid .task-row', (e) => e.dataset.id).catch(() => null);

// ---------------------------------------------------------------------------
console.log('1. Accueil compact');
{
  const { context, page, erreurs } = await nouvellePage();
  await attendreListe(page);
  const h1 = await page.$eval('.hero h1', (e) => e.textContent);
  assert(!/windows/i.test(h1) && /commandes/i.test(h1), `titre neutre vis-à-vis de la plateforme (« ${h1} »)`);
  assert((await page.$eval('label[for="search"]', (e) => e.textContent)).includes('Quelle commande ou procédure cherches-tu ?'), 'question de recherche visible');
  const lignes = await page.locator('#toolGrid .task-row').count();
  assert(lignes > 0 && lignes <= 40, `l’accueil n’affiche pas le catalogue (${lignes} lignes, pas 211)`);
  assert(await page.locator('#categoryGrid .category-card').count() === 11, '11 cartes de catégorie, « Tous les outils » comprise');
  assert(await page.locator('#categoryGrid .category-desc').count() === 0, 'plus de description longue dans les cartes de catégorie');
  const hauteur = await page.$eval('#categoryGrid .category-card[data-category="Linux et services réseau"]', (e) => e.getBoundingClientRect().height);
  assert(hauteur < 70, `carte de catégorie compacte (${Math.round(hauteur)} px)`);
  assert(await page.locator('#platFilters .chip').count() === 5, 'filtres de plateforme : Toutes, Linux, Windows, Cisco, Azure');
  assert(await page.locator('#voirCatalogue').count() === 1 && await page.locator('#voirAssistants').count() === 1, 'accès au catalogue complet et aux assistants conservé');
  const ligne = await page.$eval('#toolGrid .task-row', (e) => ({ h: e.getBoundingClientRect().height, desc: getComputedStyle(e.querySelector('.task-desc')).webkitLineClamp }));
  assert(ligne.h < 140 && ligne.desc === '1', `ligne de résultat compacte (${Math.round(ligne.h)} px, description sur 1 ligne)`);
  assert(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('2. Recherche dans le navigateur');
{
  const { context, page } = await nouvellePage();
  await attendreListe(page);
  for (const [q, id] of [['créer vlan', 'cisco-creer-vlan'], ['vider dns', 'vider-cache-dns'], ['voir ip linux', 'linux-voir-ip-reseau'],
    ['état service', 'linux-etat-service'], ['imprimante bloquée', 'imprimante-file-bloquee'], ['ping', 'tester-ping'], ['abonnement azure', 'azure-contexte-courant']]) {
    await recherche(page, q);
    assert(await premiereId(page) === id, `« ${q} » → ${id} en tête`, `tête : ${await premiereId(page)}`);
  }
  await recherche(page, 'xyzzy plugh');
  assert(await page.locator('#toolGrid .empty').count() === 1 && await page.locator('#toolGrid .task-row').count() === 0, 'requête sans rapport : message vide, aucun résultat forcé');
  await recherche(page, 'vlan');
  const types = await page.$$eval('#toolGrid .task-row', (els) => els.slice(0, 3).map((e) => e.dataset.kind));
  assert(types[0] === 'procedure', '« vlan » : une fiche courte en premier');
  await page.click('#platFilters .chip[data-plat="Linux"]');
  const plats = await page.$$eval('#toolGrid .task-row', (els) => els.map((e) => e.textContent));
  assert(plats.length === 0 || plats.every((t) => /Linux/.test(t)), 'filtre Linux : uniquement des résultats Linux');
  await page.click('#platFilters .chip[data-plat=""]');
  await recherche(page, 'ÉTAT   Service');
  assert(await page.locator('#toolGrid .task-row').count() > 0, 'accents, casse et espaces multiples tolérés');
  await recherche(page, '');
  await page.click('#categoryGrid .category-card[data-category="Linux et services réseau"]');
  const kinds = new Set(await page.$$eval('#toolGrid .task-row', (els) => els.map((e) => e.dataset.kind)));
  assert(kinds.has('commande') && kinds.has('assistant') && kinds.has('procedure'), 'catégorie Linux : fiches, commandes rapides et assistants ensemble');
  await page.click('#categoryGrid .category-card[data-category="Tout"]');
  assert(await page.locator('#toolGrid .task-row').count() === T.ENTREES_LISTEES.length, `« Tous les outils » liste tout le catalogue (${T.ENTREES_LISTEES.length})`);
  await page.click('#replierCatalogue');
  await page.click('#voirAssistants');
  assert(await page.locator('#toolGrid .open-tool').count() === tools.length && (await page.evaluate(() => location.hash)) === '#/assistants', `les ${tools.length} assistants restent listés, route #/assistants`);
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('3. Fiche tâche : paramètres, copie, blocage');
{
  const { context, page, erreurs } = await nouvellePage();
  await attendreListe(page);
  await recherche(page, 'créer vlan');
  await page.click('#toolGrid .task-row .open-tool');
  await page.waitForSelector('.tache');
  assert(await page.evaluate(() => location.hash) === '#/tache/cisco-creer-vlan', 'route #/tache/cisco-creer-vlan');
  assert((await page.$eval('.tache h1', (e) => e.textContent)) === 'Créer un VLAN', 'titre court orienté tâche');
  const nbBoutons = await page.locator('.copy-step').count();
  assert(nbBoutons === 6, `un bouton Copier par bloc (${nbBoutons})`);
  assert(await page.locator('.copy-step[aria-disabled="true"]').count() === 3, 'sans valeur : les 3 blocs qui en dépendent sont bloqués (3 restent copiables)');
  assert(await page.locator('.step-num').count() === 6 && (await page.$$eval('.step-title', (e) => e.map((x) => x.textContent))).every((t) => /^Étape \d+ :/.test(t)), 'étapes numérotées, titre lisible');
  assert(await page.locator('.step-attendu').count() === 6, 'résultat attendu présent à chaque étape (mode Débutant)');
  assert(await page.locator('.step-important').count() === 2 && await page.locator('.assistant-link').count() === 1, 'effet important affiché ; lien vers l’assistant complet');

  await page.evaluate(() => navigator.clipboard.writeText('SENTINELLE'));
  // Playwright tient aria-disabled pour « inactif » : on force le clic, comme le ferait une personne.
  await page.click('.copy-step[data-step="0"]', { force: true });
  assert(await presse(page) === 'SENTINELLE', 'copie bloquée tant qu’il manque le numéro : le presse-papiers n’est pas touché');
  assert((await page.$eval('#h-0', (e) => e.textContent)).includes('numéro du VLAN'), 'motif du blocage affiché');
  assert(await page.evaluate(() => document.activeElement?.id) === 'p-vlan', 'le focus passe au champ manquant');

  await page.fill('#p-vlan', '10;reload');
  assert((await page.$eval('#p-vlan-err', (e) => e.textContent)).length > 0 && await page.getAttribute('#p-vlan', 'aria-invalid') === 'true', 'valeur hostile : message d’erreur et aria-invalid');
  await page.click('.copy-step[data-step="0"]', { force: true });
  assert(await presse(page) === 'SENTINELLE', 'valeur invalide : rien n’est copié');
  assert(!(await page.$eval('#etapesZone', (e) => e.textContent)).includes('reload'), 'la valeur hostile n’apparaît dans aucune commande');
  await page.fill('#p-vlan', '1');
  assert((await page.$eval('#p-vlan-err', (e) => e.textContent)).includes('VLAN 1'), 'VLAN 1 refusé avec explication');

  await page.fill('#p-vlan', '10');
  await page.fill('#p-nom', 'ADMIN');
  await page.click('.copy-step[data-step="2"]');
  assert(await presse(page) === 'vlan 10\nname ADMIN', 'étape 3 copiée : « vlan 10 », « name ADMIN » — sans invite', JSON.stringify(await presse(page)));
  await page.click('.copy-step[data-step="0"]');
  assert(await presse(page) === 'show vlan id 10\nshow vtp status', 'étape 1 reflète le numéro saisi');
  const affiche = await page.$eval('#etape-3 .cmd-pre', (e) => e.innerText);
  assert(/Switch\(config\)#\s*vlan 10/.test(affiche) && !(await presse(page)).includes('Switch'), 'l’invite est affichée à l’écran mais jamais copiée');
  await page.click('#copyAll');
  const tout = await presse(page);
  assert(tout.includes('vlan 10') && !tout.includes('copy running-config'), 'copier toutes les commandes : sans l’enregistrement facultatif');
  await page.click('.copy-step[data-step="5"]');
  assert(await presse(page) === 'copy running-config startup-config', 'l’enregistrement durable ne se copie que seul, étape à part');
  assert(!(await presse(page)).includes('\r'), 'fins de ligne LF dans le texte copié');

  // Exemples : étiquetés comme fictifs, jamais pré-remplis.
  await page.fill('#p-vlan', ''); await page.fill('#p-nom', '');
  assert(await page.inputValue('#p-vlan') === '' && (await page.getAttribute('#p-vlan', 'placeholder')).startsWith('Exemple'), 'champ vide au départ, exemple en suggestion seulement');
  await page.click('#exemplesBtn');
  assert(await page.inputValue('#p-vlan') === '10' && (await page.$eval('#exemplesNote', (e) => e.textContent)).includes('fictives'), 'valeurs d’exemple : avertissement « fictives » affiché');
  await page.fill('#p-nom', 'COMPTA');
  assert((await page.$eval('#exemplesNote', (e) => e.textContent)) === '', 'l’avertissement disparaît dès que tu modifies une valeur');

  // Aucun état gardé d'une fiche à l'autre.
  await page.fill('#p-vlan', '77');
  await page.evaluate(() => { location.hash = '#/tache/cisco-affecter-port-vlan'; });
  await page.waitForSelector('#p-interface');
  assert(await page.inputValue('#p-vlan') === '', 'autre fiche : champ VLAN vide (rien retenu de la fiche précédente)');
  await page.evaluate(() => { location.hash = '#/tache/cisco-creer-vlan'; });
  await page.waitForSelector('#p-nom');
  assert(await page.inputValue('#p-vlan') === '' && await page.inputValue('#p-nom') === '', 'retour à la première fiche : valeurs remises à zéro');

  // Interface : validation de la forme.
  await page.evaluate(() => { location.hash = '#/tache/cisco-affecter-port-vlan'; });
  await page.waitForSelector('#p-interface');
  await page.fill('#p-interface', 'Fa0/99');
  assert((await page.$eval('#p-interface-err', (e) => e.textContent)).length > 0, 'interface hors plage refusée');
  await page.fill('#p-interface', 'Fa0/7'); await page.fill('#p-vlan', '10');
  await page.click('.copy-step[data-step="2"]');
  assert(await presse(page) === 'configure terminal\ninterface FastEthernet0/7\nswitchport mode access\nswitchport access vlan 10\nend', 'affectation du port : séquence complète sans invite ni sauvegarde');
  assert(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('4. Méthodes, interface graphique, clavier');
{
  const { context, page } = await nouvellePage({}, '/#/tache/windows-voir-ip');
  await page.waitForSelector('.tache');
  const onglets = await page.$$eval('[role="tab"]', (e) => e.map((x) => ({ t: x.textContent, s: x.getAttribute('aria-selected') })));
  assert(onglets.length === 3 && onglets[0].s === 'true', 'trois méthodes réelles : PowerShell, CMD, interface graphique');
  assert(await page.locator('#paramsForm').count() === 0, 'fiche sans paramètre : aucun formulaire superflu');
  await page.focus('#tab-powershell');
  await page.keyboard.press('ArrowRight');
  assert(await page.getAttribute('#tab-cmd', 'aria-selected') === 'true', 'flèche droite : méthode suivante');
  await page.keyboard.press('ArrowRight');
  assert(await page.getAttribute('#tab-gui', 'aria-selected') === 'true' && await page.locator('.copy-step').count() === 0, 'méthode graphique : aucun bouton Copier');
  const clics = await page.$$eval('.gui-actions li', (e) => e.map((x) => x.textContent));
  assert(clics.length >= 3 && clics.some((c) => /Paramètres/.test(c)), 'méthode graphique : chemin de clics en ordre');
  assert(await page.evaluate(() => document.activeElement?.id) === 'tab-gui', 'le focus reste sur l’onglet après changement');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { cls: e.className, w: parseFloat(s.outlineWidth), st: s.outlineStyle }; });
  assert(focus.st !== 'none' && focus.w >= 2, 'focus clavier visible (contour ≥ 2 px)', JSON.stringify(focus));
  assert(await page.locator('.copy-step').count() >= 1, 'retour à une méthode en ligne de commande : boutons Copier de retour');
  await context.close();

  const dns = await nouvellePage({}, '/#/tache/vider-cache-dns');
  await dns.page.waitForSelector('.tache');
  const m = await dns.page.$$eval('[role="tab"]', (e) => e.map((x) => x.textContent));
  assert(m.length === 3 && m.includes('Linux / Bash') && m.includes('CMD') && m.includes('PowerShell'), 'vider le cache DNS : Windows (2) et Linux');
  await dns.page.click('#tab-linux');
  await dns.page.click('.copy-step[data-step="0"]');
  assert(await presse(dns.page) === 'sudo resolvectl flush-caches', 'méthode Linux : commande exacte copiée');
  assert((await dns.page.$eval('.privileges', (e) => e.textContent)).includes('sudo'), 'droits requis affichés pour la méthode choisie');
  await dns.context.close();
}

// ---------------------------------------------------------------------------
console.log('5. Routes, favoris, historique');
{
  const { context, page } = await nouvellePage({}, '/#/tache/inconnue');
  await attendreListe(page);
  assert(await page.locator('#home:not([hidden])').count() === 1, 'identifiant de fiche inconnu : retour à l’accueil, sans erreur');
  await page.goto(BASE + '/#/tache/cisco-creer-vlan');
  await page.reload();
  await page.waitForSelector('.tache');
  assert((await page.$eval('.tache h1', (e) => e.textContent)) === 'Créer un VLAN', 'rechargement sur une route directe');
  await page.click('#taskFav');
  assert(await page.getAttribute('#taskFav', 'aria-pressed') === 'true', 'favori ajouté depuis la fiche');
  await page.click('#taskBack');
  await page.waitForSelector('#favorisSection');
  assert((await page.$eval('#favorisSection', (e) => e.textContent)).includes('Créer un VLAN'), 'la fiche favorite apparaît sur l’accueil');
  await page.goto(BASE + '/#/tache/vider-cache-dns');
  await page.waitForSelector('.tache');
  await page.click('#taskBack');
  await page.waitForSelector('#historiqueSection');
  assert((await page.$eval('#historiqueSection', (e) => e.textContent)).includes('Vider le cache DNS'), 'la fiche consultée apparaît dans l’historique');
  await page.goBack();
  await page.waitForSelector('.tache');
  assert((await page.$eval('.tache h1', (e) => e.textContent)) === 'Vider le cache DNS', 'bouton Précédent du navigateur : revient à la fiche');
  await page.click('.assistant-link a');
  await page.waitForSelector('#scriptOutput');
  assert(await page.evaluate(() => location.hash) === '#/outil/dns-cache-reset', 'lien « Assistant complet » : route #/outil/<id> inchangée');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('6. Assistant complet : résumé, script replié, copie, téléchargements');
{
  const { context, page } = await nouvellePage({}, '/#/outil/imp-win-inventaire');
  await page.waitForSelector('#scriptOutput');
  const resume = await page.$eval('#scriptResume', (e) => e.textContent);
  assert(/Lecture seule/.test(resume) && /Produit/.test(resume) && /Droits/.test(resume) && /Effet/.test(resume), 'résumé court : effet, produit, droits');
  assert(await page.locator('#codeWrap.is-clamped').count() === 1 && await page.getAttribute('#scriptToggle', 'aria-expanded') === 'false', 'script replié par défaut');
  const avant = await page.$eval('#scriptOutput', (e) => ({ h: e.getBoundingClientRect().height, t: e.textContent.length }));
  assert(avant.h < 220 && avant.t > 2000, `seules les premières lignes sont visibles (${Math.round(avant.h)} px pour ${avant.t} caractères)`);
  assert(await page.isVisible('#copyButton') && await page.isVisible('#downloadButton'), 'Copier et Télécharger restent visibles quand le script est replié');
  await page.click('#scriptToggle');
  const apres = await page.$eval('#scriptOutput', (e) => ({ h: e.getBoundingClientRect().height, t: e.textContent.length }));
  assert(apres.h > avant.h * 3 && apres.t === avant.t && (await page.textContent('#scriptToggle')).includes('Replier'), 'Afficher le script complet : le script s’ouvre, contenu identique');
  await page.click('#copyButton');
  assert((await presse(page)).length >= avant.t - 2, 'Copier copie le script entier même replié');
  assert(await page.locator('#ficheRapide').count() === 1, 'assistant avec fiche courte : lien « Version courte » présent');
  await context.close();
  const sans = await nouvellePage({}, '/#/outil/imp-win-spouleur');
  await sans.page.waitForSelector('#scriptOutput');
  assert(await sans.page.locator('#ficheRapide').count() === 0, 'assistant sans fiche courte : pas de lien superflu');
  await sans.context.close();

  const c = await nouvellePage({}, '/#/outil/cisco-vlan-creation');
  await c.page.waitForSelector('#ficheRapide');
  assert((await c.page.$eval('#ficheRapide a', (e) => e.getAttribute('href'))) === '#/tache/cisco-creer-vlan', 'assistant → lien vers la version courte');
  await c.page.click('#ficheRapide a');
  await c.page.waitForSelector('.tache');
  assert((await c.page.$eval('.tache h1', (e) => e.textContent)) === 'Créer un VLAN', 'le lien ouvre la fiche courte');
  await c.context.close();

  // Téléchargements : encodages inchangés.
  const cas = [['powershell', 'imp-win-inventaire', '.ps1'], ['bash', 'imp-cups-inventaire', '.sh'], ['ios', 'cisco-vlan-creation', '.ios.txt']];
  for (const [nom, id, ext] of cas) {
    const { context: cx, page: pg } = await nouvellePage({}, `/#/outil/${id}`);
    await pg.waitForSelector('#scriptOutput');
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#downloadButton')]);
    const chemin = await dl.path();
    const octets = readFileSync(chemin);
    const bom = octets[0] === 0xEF && octets[1] === 0xBB && octets[2] === 0xBF;
    if (nom === 'powershell') assert(bom && dl.suggestedFilename().endsWith(ext), `téléchargement ${ext} : BOM UTF-8 présent`);
    else assert(!bom && !octets.includes(0x0D) && dl.suggestedFilename().endsWith(ext), `téléchargement ${ext} : sans BOM, fins de ligne LF`);
    if (nom === 'ios') assert(octets.every((b) => b < 128), 'téléchargement .ios.txt : ASCII pur');
    await cx.close();
  }
}

// ---------------------------------------------------------------------------
console.log('7. Mobile 390 px');
{
  for (const hash of ['/', '/#/tache/cisco-creer-vlan', '/#/tache/imprimante-file-bloquee', '/#/outil/imp-win-inventaire', '/#/assistants']) {
    const { context, page } = await nouvellePage({ viewport: { width: 390, height: 844 } }, hash);
    await page.waitForSelector('#toolGrid .task-row, .tache, #scriptOutput');
    if (hash.includes('tache')) { await page.fill('[data-param]', 'x1'); }
    const deb = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert(deb.sw <= deb.cw + 1, `aucun débordement horizontal à 390 px : ${hash} (${deb.sw}/${deb.cw})`);
    if (hash.includes('tache')) {
      const h = await page.$eval('.copy-step', (e) => e.getBoundingClientRect().height);
      assert(h >= 40, `bouton Copier tactile (${Math.round(h)} px)`);
      const taille = await page.$eval('.cmd-pre', (e) => parseFloat(getComputedStyle(e).fontSize));
      assert(taille >= 13, `commande lisible sur téléphone (${taille}px)`);
    }
    await context.close();
  }
}

// ---------------------------------------------------------------------------
console.log('8. Thèmes clair et sombre : contrastes calculés');
{
  const contraste = `(() => {
    const lum = (rgb) => { const [r,g,b] = rgb.map((v) => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; };
    const parse = (s) => (s.match(/[\\d.]+/g) || []).slice(0,4).map(Number);
    const fond = (el) => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > 0.95) { if (c.length >= 3 && (c.length < 4 || c[3] > 0.95)) return c.slice(0,3); } e = e.parentElement; } return [255,255,255]; };
    const ratio = (el) => { const f = lum(fond(el)); const t = lum(parse(getComputedStyle(el).color).slice(0,3)); const [a,b] = f>t?[f,t]:[t,f]; return (a+0.05)/(b+0.05); };
    return (sels) => Object.fromEntries(sels.map((s) => [s, Math.round(ratio(document.querySelector(s))*100)/100]));
  })()`;
  for (const theme of ['sombre', 'clair']) {
    const { context, page } = await nouvellePage({}, '/#/tache/cisco-creer-vlan');
    await page.evaluate((t) => localStorage.setItem('kjemo.theme.v1', t), theme);
    await page.reload();
    await page.waitForSelector('.tache');
    await page.fill('#p-vlan', '10'); await page.fill('#p-nom', 'ADMIN');
    const sels = ['.step-attendu', '.step-important', '.step-expl', '.cmd-text', '.privileges', '.effet-lecture', '.effet-modification', '.copy-step', '.step-title', '.tache-resume'];
    const r = await page.evaluate(`(${contraste})(${JSON.stringify(sels)})`);
    for (const [s, v] of Object.entries(r)) assert(v >= 4.5, `thème ${theme} : contraste ${s} = ${v} (≥ 4,5)`);
    assert(await page.evaluate(() => document.documentElement.dataset.theme) === theme, `thème ${theme} appliqué`);
    const lisible = await page.$eval('.step-attendu .step-attendu-label', (e) => e.textContent.trim().length > 0);
    assert(lisible, `thème ${theme} : le vert « résultat attendu » porte un libellé (la couleur ne porte pas seule le sens)`);
    await context.close();
  }
}

// ---------------------------------------------------------------------------
console.log('9. Mode Technicien : explications repliées, rien de masqué en sécurité');
{
  const { context, page } = await nouvellePage({}, '/#/tache/cisco-creer-vlan');
  await page.evaluate(() => localStorage.setItem('kjemo.mode.v1', 'technicien'));
  await page.reload();
  await page.waitForSelector('.tache');
  // V2 : le mode Technicien ouvre la « Vue rapide » (résultat attendu non affiché) ;
  // le résultat attendu reste atteignable en un clic via « Pas à pas ». Même objectif qu'en V1.
  assert(await page.getAttribute('#vue-rapide', 'aria-pressed') === 'true' && await page.locator('.step-attendu').count() === 0, 'Technicien : Vue rapide par défaut, résultat attendu hors de la procédure rapide');
  assert(await page.locator('.step-important').count() === 2 && await page.isVisible('.step-important'), 'Technicien : l’effet important reste visible');
  await page.click('#vue-pas');
  assert(await page.locator('.step-attendu').count() === 6 && await page.isVisible('.step-attendu'), 'le résultat attendu s’affiche d’un clic (Pas à pas)');
  await context.close();
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
