#!/usr/bin/env node
/**
 * browser-navigation.test.mjs — UX-NAVIGATION-CATALOGUE-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Banc Playwright de la navigation par rubriques, SANS RECHERCHE : on retrouve
 * Samba, les permissions Linux, une tâche Windows CMD/PowerShell, une procédure
 * Cisco et un diagnostic d'imprimante uniquement en cliquant (carte de domaine
 * → groupe → sujet → fiche). Vérifie aussi : fil d'Ariane, retour au groupe,
 * recherche dans le périmètre choisi, bandeau « un filtre masque des résultats »
 * (la recherche est conservée), clavier, mobile 390 px, routes directes,
 * favoris et historique conservés, et que « Appliquer » ne titre plus une lecture.
 *
 * CE QUE CE BANC PROUVE : le comportement de l'interface dans un vrai navigateur.
 * CE QU'IL NE PROUVE PAS : l'effet d'une commande sur un équipement réel
 * (NON EXÉCUTÉ : le Toolkit n'exécute rien).
 *
 * Usage : node test/browser-navigation.test.mjs   (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const { tools } = await imp('generators.mjs');
const T = await imp('taches.mjs'); const C = await imp('classement.mjs'); const P = await imp('procedures.mjs');
const { CATEGORIES } = await imp('categories.mjs');
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
async function nouvellePage(opts = {}, hash = '/') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], ...opts });
  const page = await context.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(BASE + hash);
  await page.waitForSelector('#categoryGrid .category-card, #taskView:not([hidden]) h1, #toolView:not([hidden]) h1', { state: 'attached' });
  return { context, page, erreurs };
}
const nomDomaine = (id) => CATEGORIES.find((c) => c.id === id).name;
const hashDe = (page) => page.evaluate(() => location.hash);
const texte = (page, sel) => page.locator(sel).innerText();
const capture = async (page, nom) => { if (CAPTURES) await page.screenshot({ path: resolve(CAPTURES, `${nom}.png`), fullPage: false }); };

/** Retrouve une entrée en CLIQUANT seulement : carte de domaine, cartes de groupe, ligne. */
async function parcours(page, id) {
  const e = T.entreeParId(id);
  const c = C.cheminDe(e);
  await page.click(`#categoryGrid .category-card[data-category="${nomDomaine(c.domaineId)}"]`);
  await page.waitForSelector('#rubriquesZone .fil-ariane');
  const etapes = [c.famille.id, ...(c.sujet ? [c.sujet.id] : [])];
  const profondeur = [];
  for (const r of etapes) {
    await page.click(`#rubriqueCartes a[data-rubrique="${r}"]`);
    await page.waitForFunction((r2) => !document.querySelector(`#rubriqueCartes a[data-rubrique="${r2}"]`) || true, r);
    profondeur.push(await hashDe(page));
  }
  const ligne = page.locator(`#toolGrid .task-row[data-id="${id}"]`);
  const present = (await ligne.count()) === 1;
  if (present) await ligne.locator('.open-tool').click();
  return { present, profondeur, chemin: c };
}

// ---------------------------------------------------------------------------
console.log('1. Parcours sans recherche — cinq cas du cahier des charges');
const CAS = [];
{
  const cible = (f) => T.ENTREES_LISTEES.find(f);
  CAS.push({ nom: 'Samba', id: 'samba-share-create' });
  CAS.push({ nom: 'permissions Linux', id: (cible((e) => { const c = C.cheminDe(e); return c?.domaineId === 'linux' && c.sujet?.id === 'permissions' && e.kind === 'commande'; }) ?? {}).id });
  CAS.push({ nom: 'tâche Windows CMD/PowerShell', id: (cible((e) => e.procedure && e.categorie === nomDomaine('poste-windows') && ['cmd', 'powershell'].every((m) => e.procedure.methodes.some((x) => x.id === m))) ?? {}).id });
  CAS.push({ nom: 'procédure Cisco', id: 'scenario-cisco-ssh-commutateur' });
  CAS.push({ nom: 'diagnostic d’imprimante', id: (cible((e) => e.categorie === nomDomaine('imprimantes') && /diagnostic/i.test(e.titre) && e.procedure) ?? cible((e) => e.categorie === nomDomaine('imprimantes') && /diagnostic/i.test(e.titre)) ?? {}).id });
}
for (const cas of CAS) {
  assert(Boolean(cas.id && T.entreeParId(cas.id)), `${cas.nom} : entrée retrouvée dans le catalogue (${cas.id})`);
  if (!cas.id) continue;
  const { context, page, erreurs } = await nouvellePage();
  const r = await parcours(page, cas.id);
  assert(r.present, `${cas.nom} : la ligne est dans la liste du groupe, sans aucune recherche`);
  assert(r.profondeur.length <= 2 && r.profondeur.every((h) => h.startsWith('#/rubrique/')), `${cas.nom} : trois niveaux au plus avant la fiche`, r.profondeur.join(' '));
  assert((await page.locator('#search').inputValue()) === '', `${cas.nom} : champ de recherche resté vide`);
  const e = T.entreeParId(cas.id);
  if (r.present) {
    const vue = e.procedure ? '#taskView' : '#toolView';
    await page.waitForSelector(`${vue}:not([hidden]) h1`);
    assert((await texte(page, `${vue} h1`)).includes(e.titre.replace(/^\S+\s/, '').slice(0, 12)) || (await texte(page, `${vue} h1`)).length > 0, `${cas.nom} : la fiche s’ouvre`);
    const fil = await page.locator(`${vue} #filFiche li`).allInnerTexts();
    const attendu = [r.chemin.famille.nom, ...(r.chemin.sujet ? [r.chemin.sujet.nom] : [])];
    assert(fil[0] === 'Catalogue' && fil.includes(nomDomaine(r.chemin.domaineId)) && attendu.every((n) => fil.includes(n)), `${cas.nom} : fil d’Ariane = ${fil.join(' › ')}`);
    const retour = await page.locator(`${vue} .back-button`).innerText();
    assert(retour.startsWith('← Retour') && retour.includes((r.chemin.sujet ?? r.chemin.famille).nom), `${cas.nom} : bouton « ${retour} »`);
    await page.locator(`${vue} .back-button`).click();
    await page.waitForSelector('#toolGrid .task-row');
    assert((await hashDe(page)).startsWith('#/rubrique/'), `${cas.nom} : le retour ramène au groupe (${await hashDe(page)})`);
    assert((await page.locator(`#toolGrid .task-row[data-id="${cas.id}"]`).count()) === 1, `${cas.nom} : l’entrée est toujours dans la liste du groupe`);
  }
  assert(erreurs.length === 0, `${cas.nom} : aucune erreur JavaScript`, erreurs.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('2. Samba : sections, couverture à venir, fil d’Ariane cliquable');
{
  const { context, page } = await nouvellePage({}, '/#/rubrique/linux/partages/samba');
  await page.waitForSelector('#toolGrid .task-row');
  const titres = await page.locator('#toolGrid .groupe-titre').allInnerTexts();
  assert(titres.length === 3 && /Prérequis/.test(titres[0]) && /permissions/.test(titres[1]) && /Diagnostic/.test(titres[2]), 'trois sections de lecture Samba', titres.join(' | '));
  const sambaIds = T.TOUTES_LES_ENTREES.filter((e) => { const c = C.cheminDe(e); return c?.sujet?.id === 'samba'; }).filter((e) => T.ENTREES_LISTEES.includes(e)).map((e) => e.id);
  const ids = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.id));
  assert(ids.length === sambaIds.length && sambaIds.every((i) => ids.includes(i)), `les ${sambaIds.length} entrées Samba listées, aucune perdue`);
  assert(/Pas encore réalisé/.test(await texte(page, '#rubriquePrevu')), 'la couverture à venir est écrite comme non réalisée');
  assert(!/SAMBA-ADV-01/.test(await page.locator('#toolGrid').innerText()), 'aucune fausse entrée pour la couverture à venir');
  await capture(page, 'nav-ap-samba-1280');
  await page.click('#filAriane a:has-text("Partages de fichiers")');
  await page.waitForSelector('#rubriqueCartes');
  assert((await hashDe(page)) === '#/rubrique/linux/partages', 'fil d’Ariane : remonte au groupe');
  const cartes = await page.locator('#rubriqueCartes .rubrique-nom').allInnerTexts();
  assert(cartes.includes('Samba / SMB') && cartes.includes('NFS'), 'le groupe Partages propose Samba et NFS', cartes.join(','));
  await page.goBack();
  await page.waitForSelector('#toolGrid .groupe-titre');
  assert((await hashDe(page)) === '#/rubrique/linux/partages/samba', 'bouton Précédent du navigateur : revient à Samba');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('3. Barre latérale : groupes sous le domaine ouvert, classement commun');
{
  const { context, page } = await nouvellePage();
  await page.click('#navigation button[data-category="Linux et services réseau"]');
  await page.waitForSelector('#navigation .nav-sous');
  const liens = await page.$$eval('#navigation a.nav-famille', (a) => a.map((x) => [x.dataset.famille, Number(x.querySelector('.nav-count').textContent)]));
  const attendu = C.ARBRE.linux.map((f) => [f.id, T.ENTREES_LISTEES.filter((e) => { const c = C.cheminDe(e); return c?.domaineId === 'linux' && c.famille.id === f.id; }).length]).filter(([, n]) => n > 0);
  assert(JSON.stringify(liens) === JSON.stringify(attendu), 'menu latéral = mêmes groupes et mêmes comptes que le classement', JSON.stringify(liens));
  const cartes = await page.$$eval('#rubriqueCartes a', (a) => a.map((x) => [x.dataset.rubrique, Number(x.querySelector('.rubrique-compte').textContent.split(' ')[0])]));
  assert(JSON.stringify(cartes) === JSON.stringify(attendu), 'cartes de rubrique = mêmes groupes et mêmes comptes que le menu');
  const total = Number(await page.locator('#navigation button[data-category="Linux et services réseau"] .nav-count').innerText());
  assert(attendu.reduce((s, [, n]) => s + n, 0) === total, 'la somme des groupes = le compte du domaine (aucune entrée perdue)');
  await page.click('#navigation a.nav-famille[data-famille="utilisateurs"]');
  await page.waitForSelector('#rubriqueCartes');
  assert((await hashDe(page)) === '#/rubrique/linux/utilisateurs', 'lien du menu latéral : route du groupe');
  assert((await page.locator('#navigation a.nav-famille[aria-current="true"]').count()) === 1, 'groupe courant signalé dans le menu (aria-current)');
  await capture(page, 'nav-ap-menu-lateral-1280');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('4. Recherche dans le périmètre choisi');
{
  const { context, page } = await nouvellePage({}, '/#/rubrique/linux/partages/samba');
  await page.waitForSelector('#toolGrid .task-row');
  await page.fill('#search', 'permission'); await page.waitForTimeout(120);
  const portee = await texte(page, '#porteeRecherche');
  assert(/Recherche limitée à Samba/.test(portee), 'la portée de la recherche est dite', portee);
  const ids = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.id));
  assert(ids.length > 0 && ids.every((i) => { const c = C.cheminDe(T.entreeParId(i)); return c.sujet?.id === 'samba'; }), 'tous les résultats sont dans Samba', ids.join(','));
  const nSamba = ids.length;
  await page.click('#rechercherPartout');
  await page.waitForTimeout(150);
  assert((await page.locator('#search').inputValue()) === 'permission', 'rechercher partout conserve la requête');
  const ids2 = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.id));
  assert(ids2.length > nSamba && (await page.locator('#porteeRecherche').count()) === 0, `rechercher partout élargit (${nSamba} → ${ids2.length})`);
  assert((await hashDe(page)) === '#/', 'rechercher partout remet la portée à tout le catalogue');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('5. Un filtre qui masque des résultats existants le dit et propose les autres types');
{
  const { context, page } = await nouvellePage({}, '/#/rubrique/linux/partages/samba');
  await page.waitForSelector('#toolGrid .task-row');
  await page.fill('#search', 'samba'); await page.waitForTimeout(120);
  const tousIds = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.id));
  const nature = (id) => page.click(`#natureFilters [data-nature="${id}"]`);
  await nature('commande'); await page.waitForTimeout(120);
  const cmdIds = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.id));
  assert(cmdIds.length < tousIds.length && cmdIds.every((i) => T.entreeParId(i).kind === 'commande'), `filtre Commandes : ${cmdIds.length} sur ${tousIds.length}`);
  const bandeau = await texte(page, '#filtreMasqueNature');
  const masques = tousIds.length - cmdIds.length;
  assert(bandeau.includes('Commandes') && bandeau.includes(`${masques} résultat`) && bandeau.includes('samba'), 'le bandeau nomme le filtre, le nombre masqué et la requête', bandeau);
  assert(/Samba/.test(bandeau), 'le bandeau nomme le périmètre');
  const boutons = await page.locator('#filtreMasqueNature [data-masque-action]').allInnerTexts();
  assert(boutons.some((b) => /Assistants complets/.test(b)) && boutons.some((b) => /Tous les types/.test(b)), 'autres types proposés avec leur nombre', boutons.join(' | '));
  await capture(page, 'nav-ap-filtre-masque-1280');
  await page.click('#filtreMasqueNature [data-masque-valeur="assistant"]'); await page.waitForTimeout(120);
  assert((await page.locator('#search').inputValue()) === 'samba', 'basculer vers un autre type conserve la recherche');
  const asIds = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.id));
  assert(asIds.length > 0 && asIds.every((i) => T.entreeParId(i).kind === 'assistant'), 'résultats = assistants');
  assert((await page.locator('#natureFilters [data-nature="assistant"][aria-pressed="true"]').count()) === 1, 'la puce du filtre suit (aria-pressed)');
  await page.click('#filtreMasqueNature [data-masque-valeur=""]'); await page.waitForTimeout(120);
  const finIds = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.id));
  assert(finIds.length === tousIds.length && (await page.locator('#filtreMasqueNature').count()) === 0, 'Tous les types : retour complet, plus de bandeau');
  // Aucun résultat avec le filtre, mais des résultats existent
  await nature('fiche'); await page.waitForTimeout(120);
  const fiches = (await page.$$('#toolGrid .task-row')).length;
  if (fiches === 0) assert((await page.locator('#toolGrid .empty').innerText()).includes('filtres actuels') && (await page.locator('#filtreMasqueNature').count()) === 1, 'zéro résultat à cause du filtre : message + bandeau, pas un « Aucun outil » trompeur');
  else assert(true, 'filtre fiches : résultats présents');
  await context.close();
}
{
  const { context, page } = await nouvellePage({}, '/#/rubrique/linux');
  await page.waitForSelector('#toolGrid .task-row');
  await page.click('#platFilters [data-plat="Windows"]'); await page.waitForTimeout(120);
  const n = await page.locator('#toolGrid .task-row').count();
  const sans = T.ENTREES_LISTEES.filter((e) => e.categorie === 'Linux et services réseau').length;
  const bandeau = (await page.locator('#filtreMasquePlat').count()) ? await texte(page, '#filtreMasquePlat') : '';
  assert(n < sans ? /Windows/.test(bandeau) && /masque/.test(bandeau) : true, `filtre de plateforme : ${n} sur ${sans}, bandeau « ${bandeau.slice(0, 60)} »`);
  if (n < sans) {
    await page.click('#filtreMasquePlat [data-masque-valeur=""]'); await page.waitForTimeout(120);
    assert((await page.locator('#toolGrid .task-row').count()) === sans, 'Toutes les plateformes : liste complète du domaine');
  }
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('6. Routes directes, historique du navigateur, route inconnue');
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/rubrique/reseau-cisco/vlan');
  await page.waitForSelector('#toolGrid .task-row');
  assert((await texte(page, '#filAriane')).includes('VLAN'), 'route directe : le fil d’Ariane suit');
  assert((await page.locator('#navigation button[aria-current="true"]').count()) === 1, 'menu : domaine courant signalé');
  const e = T.TOUTES_LES_ENTREES.find((x) => { const c = C.cheminDe(x); return c?.domaineId === 'reseau-cisco' && c.famille.id === 'vlan' && x.procedure; });
  await page.locator(`.task-row[data-id="${e.id}"] .open-tool`).click();
  await page.waitForSelector('#taskView:not([hidden]) h1');
  await page.goBack();
  await page.waitForSelector('#toolGrid .task-row');
  assert((await hashDe(page)) === '#/rubrique/reseau-cisco/vlan', 'Précédent depuis une fiche : retour au groupe');
  await context.close();
}
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/rubrique/linux/n-existe-pas');
  await page.waitForSelector('#toolGrid .task-row');
  assert((await page.locator('#toolGrid .task-row').count()) > 0 && (await page.locator('#home:not([hidden])').count()) === 1, 'route inconnue : l’accueil reste utilisable');
  assert(erreurs.length === 0, 'route inconnue : aucune erreur JavaScript', erreurs.join(' | '));
  await context.close();
}
{
  const { context, page, erreurs } = await nouvellePage({}, '/');
  // fiche en lien direct : le retour garde son contrat historique (liste complète), le fil d'Ariane mène au groupe
  const f = T.entreeParId('samba-readiness');
  await page.goto(`${BASE}/#/${f.procedure ? 'tache' : 'outil'}/${f.tool?.id ?? f.id}`);
  await page.reload();
  const vue = (await page.locator('#toolView:not([hidden])').count()) ? '#toolView' : '#taskView';
  await page.waitForSelector(`${vue} #filFiche`);
  await page.click(`${vue} #filFiche a:has-text("Samba / SMB")`);
  await page.waitForSelector('#rubriquesZone .fil-ariane');
  assert((await hashDe(page)) === '#/rubrique/linux/partages/samba', 'lien direct : le fil d’Ariane mène au groupe de la fiche');
  await page.goto(`${BASE}/#/${f.procedure ? 'tache' : 'outil'}/${f.tool?.id ?? f.id}`);
  await page.reload();
  await page.waitForSelector(`${vue} .back-button`);
  assert(/^← (Tous les outils|Retour)/.test(await page.locator(`${vue} .back-button`).innerText()), 'lien direct : bouton de retour inchangé (liste complète)');
  await page.locator(`${vue} .back-button`).click();
  await page.waitForSelector('#toolGrid .task-row');
  assert((await page.locator('#rubriquesZone .fil-ariane').count()) === 0, 'lien direct : le retour ramène à la liste complète, pas à un groupe');
  assert(erreurs.length === 0, 'aucune erreur JavaScript sur les routes', erreurs.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('7. Assistants : mêmes groupes, 43 outils conservés');
{
  const { context, page } = await nouvellePage({}, '/#/assistants');
  await page.waitForSelector('#toolGrid .task-row');
  assert((await texte(page, '#toolCount')) === `${tools.length} outils`, `#/assistants : ${tools.length} outils`);
  await page.click('#categoryGrid .category-card[data-category="Linux et services réseau"]');
  await page.waitForSelector('#rubriqueCartes');
  assert((await hashDe(page)) === '#/assistants/linux', 'assistants : route par domaine');
  await page.click('#rubriqueCartes a[data-rubrique="partages"]');
  await page.click('#rubriqueCartes a[data-rubrique="samba"]');
  await page.waitForSelector('#toolGrid .task-row');
  const kinds = await page.$$eval('#toolGrid .task-row', (r) => r.map((x) => x.dataset.kind));
  assert(kinds.length === 3 && kinds.every((k) => k === 'assistant'), 'assistants / Samba : les trois assistants seuls', kinds.join(','));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('8. Favoris et historique conservés dans les listes groupées');
{
  const { context, page } = await nouvellePage({}, '/#/rubrique/linux/partages/samba');
  await page.waitForSelector('#toolGrid .task-row');
  const id = await page.$eval('#toolGrid .task-row', (r) => r.dataset.id);
  await page.click(`#toolGrid .task-row[data-id="${id}"] .fav-toggle`);
  assert((await page.locator(`#toolGrid .task-row[data-id="${id}"] .fav-toggle[aria-pressed="true"]`).count()) === 1, 'favori posé dans une liste groupée');
  assert((await page.locator('#toolGrid .groupe-titre').count()) === 3, 'les groupes survivent au changement de favori');
  await page.reload();
  await page.waitForSelector('#toolGrid .task-row');
  assert((await page.locator(`#toolGrid .task-row[data-id="${id}"] .fav-toggle[aria-pressed="true"]`).count()) === 1, 'favori conservé après rechargement');
  await page.locator(`#toolGrid .task-row[data-id="${id}"] .open-tool`).click();
  await page.locator('.back-button:visible').click();
  await page.click('#navigation button[data-category="Tout"]');
  await page.waitForSelector('#shortcutsZone .shortcut');
  assert((await page.locator('#favorisSection .shortcut').count()) >= 1, 'favori visible dans les raccourcis de l’accueil');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('9. Clavier');
{
  const { context, page } = await nouvellePage();
  await page.focus('#categoryGrid .category-card[data-category="Linux et services réseau"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#rubriqueCartes');
  await page.focus('#rubriqueCartes a[data-rubrique="partages"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#rubriqueCartes a[data-rubrique="samba"]');
  assert((await hashDe(page)) === '#/rubrique/linux/partages', 'Entrée sur une carte de groupe ouvre le groupe');
  const actif = await page.evaluate(() => document.activeElement?.id);
  assert(actif === 'filAriane', 'le focus est placé sur le fil d’Ariane après navigation', String(actif));
  await page.keyboard.press('Tab');
  const apres = await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('href') ?? ''));
  assert(/^A:#\//.test(apres), 'Tab depuis le fil d’Ariane atteint son premier lien', apres);
  // Tous les éléments de navigation sont atteignables : liens et boutons de la zone
  const focalisables = await page.$$eval('#rubriquesZone a, #rubriquesZone button', (n) => n.every((x) => x.tabIndex >= 0));
  assert(focalisables, 'liens du panneau de rubrique tous focalisables');
  await page.fill('#search', 'samba'); await page.waitForTimeout(100);
  await page.focus('#rechercherPartout');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  assert((await page.locator('#search').inputValue()) === 'samba' && (await hashDe(page)) === '#/', 'bouton « rechercher partout » utilisable au clavier');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('10. Mobile 390 px');
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 844 } }, '/#/rubrique/linux');
  await page.waitForSelector('#rubriqueCartes');
  const deborde = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!(await deborde()), 'domaine à 390 px : pas de débordement horizontal');
  const mini = await page.$$eval('#rubriqueCartes a', (a) => Math.min(...a.map((x) => x.getBoundingClientRect().height)));
  assert(mini >= 44, `cartes de groupe : cible tactile ≥ 44 px (${Math.round(mini)})`);
  await capture(page, 'nav-ap-linux-390');
  await page.click('#rubriqueCartes a[data-rubrique="partages"]');
  await page.click('#rubriqueCartes a[data-rubrique="samba"]');
  await page.waitForSelector('#toolGrid .task-row');
  assert(!(await deborde()), 'Samba à 390 px : pas de débordement horizontal');
  const lienFil = await page.$$eval('#filAriane a', (a) => Math.min(...a.map((x) => x.getBoundingClientRect().height)));
  assert(lienFil >= 24, `fil d’Ariane : cible ≥ 24 px (${Math.round(lienFil)})`);
  await capture(page, 'nav-ap-samba-390');
  await page.fill('#search', 'samba'); await page.waitForTimeout(100);
  await page.click('#natureFilters [data-nature="commande"]'); await page.waitForTimeout(100);
  assert(!(await deborde()), 'bandeau de filtre à 390 px : pas de débordement');
  await capture(page, 'nav-ap-filtre-masque-390');
  await page.fill('#search', '');
  await page.click('#natureFilters [data-nature=""]');
  await page.locator('#toolGrid .task-row .open-tool').first().click();
  await page.waitForSelector('#filFiche');
  assert(!(await deborde()), 'fiche avec fil d’Ariane à 390 px : pas de débordement');
  await capture(page, 'nav-ap-fiche-390');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('11. « Appliquer » ne titre plus une simple lecture');
{
  const lecture = T.TOUTES_LES_ENTREES.find((e) => e.procedure && e.procedure.methodes.some((m) => {
    const rendu = P.rendreMethode(m, e.procedure.parametres ?? [], {});
    return P.phasesDeMethode(rendu).some((ph) => ph.categorie === 'action' && ph.titre === 'Consulter');
  }));
  assert(Boolean(lecture), 'une fiche à phase de lecture existe');
  if (lecture) {
    const { context, page } = await nouvellePage({}, `/#/tache/${lecture.id}`);
    await page.waitForSelector('#taskView:not([hidden]) .phase-title, #taskView:not([hidden]) h1');
    for (const m of lecture.procedure.methodes) {
      if (lecture.procedure.methodes.length > 1) await page.click(`#tab-${m.id}`);
      const rendu = P.rendreMethode(m, lecture.procedure.parametres ?? [], {});
      const attendus = P.phasesDeMethode(rendu).filter((ph) => ph.categorie === 'action').map((ph) => ph.titre);
      const titres = await page.locator('#taskView .phase-title').allInnerTexts();
      const net = titres.map((t) => t.replace(/^\W+/, '').trim());
      for (const a of attendus) assert(net.some((t) => t.startsWith(a)), `${lecture.id}/${m.id} : phase « ${a} » affichée`, net.join(' | '));
    }
    await context.close();
  }
}

// ---------------------------------------------------------------------------
console.log('12. Contraste des éléments de navigation : clair, sombre, système ; repos, survol, sélection (≥ 4,5)');
{
  const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /** Couleur du texte et fond réel (premier ancêtre non transparent) d'un élément. */
  const mesure = (page, sel) => page.$eval(sel, (el) => {
    let bg = null;
    for (let n = el; n && !bg; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const a = c.match(/[\d.]+/g);
      if (a && !(a.length > 3 && Number(a[3]) === 0) && c !== 'transparent') bg = c;
    }
    return { fg: getComputedStyle(el).color, bg: bg ?? 'rgb(255,255,255)' };
  });
  const THEMES = [['clair', 'light'], ['sombre', 'dark'], ['systeme', 'light'], ['systeme', 'dark']];
  for (const [theme, scheme] of THEMES) {
    const tag = `${theme}/${scheme}`;
    const { context, page } = await nouvellePage({ colorScheme: scheme, viewport: { width: 1280, height: 900 } }, '/#/rubrique/linux/partages');
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForSelector('#rubriqueCartes');
    const verifie = async (nom, sel, etat = 'repos') => {
      const m = await mesure(page, sel);
      const r = ratio(m.fg, m.bg);
      assert(r >= 4.5, `${tag} · ${nom} (${etat}) : contraste ${r.toFixed(2)}`, `${m.fg} sur ${m.bg}`);
    };
    // Menu latéral : bouton de domaine (sélectionné), ses compteurs, groupes (repos, survol, sélection)
    await verifie('domaine sélectionné', '#navigation button[aria-current="true"] .nav-label', 'sélectionné');
    await verifie('compteur du domaine', '#navigation button[aria-current="true"] .nav-count', 'sélectionné');
    const autreDomaine = '#navigation button[aria-current="false"]';
    await verifie('domaine', `${autreDomaine} >> nth=0`.replace(' >> nth=0', '') + ' .nav-label', 'repos');
    await page.hover(`${autreDomaine}`);
    await verifie('domaine', `${autreDomaine}:hover .nav-label`, 'survol');
    await verifie('compteur du domaine', `${autreDomaine}:hover .nav-count`, 'survol');
    await page.mouse.move(700, 20);
    await verifie('groupe', '#navigation a.nav-famille:not(.active) .nav-label', 'repos');
    await verifie('compteur de groupe', '#navigation a.nav-famille:not(.active) .nav-count', 'repos');
    await page.hover('#navigation a.nav-famille:not(.active)');
    await verifie('groupe', '#navigation a.nav-famille:not(.active):hover .nav-label', 'survol');
    await verifie('compteur de groupe', '#navigation a.nav-famille:not(.active):hover .nav-count', 'survol');
    await page.mouse.move(700, 20);
    await verifie('groupe sélectionné', '#navigation a.nav-famille.active .nav-label', 'sélectionné');
    await verifie('compteur du groupe sélectionné', '#navigation a.nav-famille.active .nav-count', 'sélectionné');
    // Panneau de rubrique (niveau domaine : des groupes à sujets portent aussi un détail)
    await page.goto(`${BASE}/#/rubrique/linux`);
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForSelector('#rubriqueCartes .rubrique-detail');
    await verifie('fil d’Ariane (lien)', '#filAriane a', 'repos');
    await verifie('fil d’Ariane (page courante)', '#filAriane li[aria-current="page"]', 'repos');
    await verifie('carte de groupe : nom', '#rubriqueCartes .rubrique-nom', 'repos');
    await verifie('carte de groupe : compte', '#rubriqueCartes .rubrique-compte', 'repos');
    await verifie('carte de groupe : détail', '#rubriqueCartes .rubrique-detail', 'repos');
    await page.hover('#rubriqueCartes a:has(.rubrique-detail)');
    await verifie('carte de groupe : nom', '#rubriqueCartes a:has(.rubrique-detail):hover .rubrique-nom', 'survol');
    await verifie('carte de groupe : compte', '#rubriqueCartes a:has(.rubrique-detail):hover .rubrique-compte', 'survol');
    await verifie('carte de groupe : détail', '#rubriqueCartes a:has(.rubrique-detail):hover .rubrique-detail', 'survol');
    await page.mouse.move(700, 20);
    // Sujet : couverture à venir, titres de section, périmètre de recherche, bandeau de filtre
    await page.goto(`${BASE}/#/rubrique/linux/partages/samba`);
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForSelector('#rubriquePrevu');
    await verifie('couverture à venir', '#rubriquePrevu', 'repos');
    await verifie('titre de section', '#toolGrid .groupe-titre', 'repos');
    await verifie('compte de section', '#toolGrid .groupe-compte', 'repos');
    await page.fill('#search', 'samba');
    await page.click('#natureFilters [data-nature="commande"]');
    await page.waitForSelector('#filtreMasqueNature');
    await verifie('bandeau de filtre', '#filtreMasqueNature p', 'repos');
    await verifie('bandeau : bouton', '#filtreMasqueNature [data-masque-action]', 'repos');
    await verifie('périmètre de recherche', '#porteeRecherche', 'repos');
    await verifie('« rechercher partout »', '#rechercherPartout', 'repos');
    // Fiche : fil d'Ariane et retour
    await page.fill('#search', '');
    await page.click('#natureFilters [data-nature=""]');
    await page.locator('#toolGrid .task-row .open-tool').first().click();
    await page.waitForSelector('#filFiche');
    await verifie('fiche : fil d’Ariane (lien)', '#filFiche a', 'repos');
    await verifie('fiche : fil d’Ariane (page courante)', '#filFiche li[aria-current="page"]', 'repos');
    await verifie('fiche : bouton retour', '.tool-view:not([hidden]) .back-button', 'repos');
    await context.close();
  }
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
console.log('Exécution réelle sur équipement : NON EXÉCUTÉE. Génération et affichage vérifiés seulement.');
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
