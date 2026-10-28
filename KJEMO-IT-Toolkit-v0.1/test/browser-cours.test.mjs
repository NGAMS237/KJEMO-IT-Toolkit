#!/usr/bin/env node
/**
 * browser-cours.test.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Banc Playwright de « Mes cours et TP » et de « Mon laboratoire » :
 *  - OBJECTIF UX : atteindre une étape précise d'une fiche depuis le parcours
 *    en 3 gestes au plus (accueil → Mes cours et TP → parcours → lien d'étape) ;
 *  - l'étape visée est montrée (vue « Pas à pas », repère, retour au parcours) ;
 *  - progression et laboratoire : stockage local protégé, AUCUN secret, et
 *    l'application fonctionne si le stockage est refusé ;
 *  - contre-épreuves : cours inconnu, étape inexistante, valeur invalide,
 *    ligne de CSV avec un 3e champ (mot de passe), mot de passe saisi ;
 *  - mobile 390 px sans défilement horizontal ; routes historiques intactes.
 *
 * CE QUE CE BANC PROUVE : le comportement de l'interface dans un vrai navigateur.
 * CE QU'IL NE PROUVE PAS : l'effet d'une commande sur une machine réelle
 * (NON EXÉCUTÉ : le Toolkit n'exécute rien).
 *
 * Usage : node test/browser-cours.test.mjs   (exit 0 = tout OK)
 * KJEMO_CAPTURES=<dossier> enregistre des captures (bureau et mobile).
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

// ---------------------------------------------------------------------------
// 1. Objectif UX : 3 gestes de l'accueil à l'étape d'une fiche
// ---------------------------------------------------------------------------
{
  const { context, page, erreurs } = await nouvellePage();
  let gestes = 0;
  assert(await page.locator('#categoryGrid .category-card').count() >= 11, 'accueil : les cartes de catégories historiques sont toujours là');
  await page.locator('#espacesZone a[href="#/cours"]').click(); gestes++;
  await page.waitForSelector('#coursView:not([hidden]) h1');
  assert((await page.locator('#coursView h1').innerText()) === 'Mes cours et TP', 'geste 1 : la liste des cours s’affiche');
  await capture(page, 'bureau-01-liste-cours');
  await page.locator('#coursView .parcours-puce[data-parcours="B"]').click(); gestes++;
  await page.waitForSelector('#coursView .parcours-items');
  assert((await hashDe(page)) === `#/cours/${COURS_ID}/B`, 'geste 2 : le parcours B a sa propre URL', await hashDe(page));
  await capture(page, 'bureau-02-parcours-b');
  const lien = page.locator('li[data-item="B6"] a.parcours-lien[data-etape]').first();
  const titreLien = await lien.innerText();
  await lien.click(); gestes++;
  await page.waitForSelector('#taskView:not([hidden]) li.etape-cible');
  assert(gestes <= 3, `objectif UX : étape atteinte en ${gestes} geste(s) (3 au plus)`);
  const cible = page.locator('li.etape-cible');
  assert((await cible.getAttribute('id')) === 'etape-5', 'l’étape visée (B6 → étape 5) est repérée', await cible.getAttribute('id'));
  assert(await cible.isVisible(), 'l’étape visée est visible');
  await page.waitForTimeout(900);   // défilement doux éventuel
  assert(await cible.evaluate((el) => { const r = el.getBoundingClientRect(); return r.bottom > 100 && r.top < window.innerHeight / 2; }), 'l’étape visée est dans la fenêtre (défilement fait)');
  assert(await page.locator('.step-num').first().isVisible(), 'la vue « Pas à pas » est active (étapes numérotées)');
  assert(/étape 5/.test(titreLien), 'le lien annonce le numéro d’étape', titreLien);
  assert(await page.locator('#retourParcours').count() === 1, 'lien « Retour au parcours » présent');
  await capture(page, 'bureau-03-etape-ciblee');
  await page.locator('#retourParcours').click();
  await page.waitForSelector('#coursView:not([hidden]) .parcours-items');
  assert((await hashDe(page)) === `#/cours/${COURS_ID}/B`, 'le retour ramène au même parcours');
  assert(await page.locator('#taskView').isHidden(), 'la fiche est refermée au retour');
  assert(erreurs.length === 0, 'aucune erreur JavaScript sur tout le trajet', erreurs.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// 2. Éléments Windows / hyperviseur : couverts, avec lien vers la BONNE méthode
//    (A5, B1, D7 étaient « non couverts » ; ils ne le sont plus et doivent le prouver)
// ---------------------------------------------------------------------------
{
  const attendus = [
    ['A', 'A5', /\/tache\/cours-windows-connexion-domaine\/methode\/gui\/etape\/3\//],
    ['B', 'B1', /\/tache\/cours-hyperviseur-ajouter-disque\/methode\/gui\/etape\/1\//],
    ['D', 'D7', /\/tache\/cours-windows-acces-partage\/methode\/gui\/etape\/1\//],
  ];
  const { context, page } = await nouvellePage({}, '/');
  for (const [lettre, id, motif] of attendus) {
    await page.goto(`${BASE}/#/cours/${COURS_ID}/${lettre}`);
    await page.waitForSelector('#coursView:not([hidden]) .parcours-items');
    const li = page.locator(`li[data-item="${id}"]`);
    assert(!/Non couvert/.test(await li.innerText()), `${id} : n’est plus déclaré « non couvert »`);
    const hrefs = await li.locator('a[data-etape]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    assert(hrefs.some((h) => motif.test(h)), `${id} : un lien mène à l’étape de la bonne méthode`, hrefs.join(' | '));
  }
  // Le lien est suivi pour de bon : la méthode GUI s’ouvre (pas la première méthode par défaut) et l’étape est repérée.
  await page.goto(`${BASE}/#/cours/${COURS_ID}/B`);
  await page.waitForSelector('#coursView:not([hidden]) .parcours-items');
  await page.locator('li[data-item="B1"] a[data-etape]').first().click();
  await page.waitForSelector('#taskView:not([hidden]) li.etape-cible');
  assert(/\/methode\/gui\/etape\/1\//.test(await hashDe(page)), 'B1 : l’adresse porte la méthode GUI et l’étape', await hashDe(page));
  assert(await page.locator('li.etape-cible').isVisible(), 'B1 : l’étape visée est visible dans la méthode GUI');
  await context.close();
}

// ---------------------------------------------------------------------------
// 2 bis. Plusieurs postes : puces de machine, copie SÉPARÉE par poste, prérequis
//        exposés à l'arrivée directe (D5/D6, transferts smbclient)
// ---------------------------------------------------------------------------
{
  const { context, page } = await nouvellePage({ permissions: ['clipboard-read', 'clipboard-write'] }, '/#/tache/cours-smbclient-transferts');
  await page.waitForSelector('#taskView:not([hidden])');
  assert(await page.locator('#copyAll').count() === 0, 'plusieurs postes : aucun bouton « Copier toutes les commandes » en un seul bloc');
  assert(await page.locator('.machine-bar .copy-machine').count() === 2, 'plusieurs postes : un bouton de copie par poste (serveur, client Ubuntu)');
  assert(await page.locator('.machine-chip').count() >= 2, 'chaque étape annonce sur quel poste elle se joue (puce « Sur : … »)');
  const puces = await page.locator('.machine-chip').allInnerTexts();
  assert(puces.every((t) => /Sur :/.test(t)), 'la puce est écrite (pas seulement colorée)', puces.join(' | '));
  assert(await page.locator('aside.prerequis a.prerequis-lien').count() >= 2, 'arrivée directe : les prérequis sont montrés avec un lien vers la fiche qui les fait');
  const lienPrereq = await page.locator('aside.prerequis a.prerequis-lien').first().getAttribute('href');
  assert(/^#\/tache\/cours-[a-z0-9-]+$/.test(lienPrereq ?? ''), 'le lien de prérequis mène à une fiche existante', lienPrereq);
  // copie bloquée tant que les paramètres ne sont pas renseignés, puis séparée par poste
  assert(await page.locator('.copy-machine[aria-disabled="true"]').count() === 2, 'copie par poste bloquée tant que les paramètres manquent');
  await page.click('#exemplesBtn');
  assert(await page.locator('.copy-machine[data-machine="serveur"][aria-disabled="true"]').count() === 0, 'copie du serveur débloquée une fois les paramètres renseignés');
  // Le client demande le mot de passe au terminal (smbclient) : sa copie d'un seul bloc reste REFUSÉE, et le dit.
  assert(await page.locator('.copy-machine[data-machine="client-ubuntu"][aria-disabled="true"]').count() === 1, 'copie du client Ubuntu refusée : smbclient demande un mot de passe saisi au terminal');
  const refus = await page.locator('#hm-client-ubuntu').innerText();
  assert(/étape|réponds|interactiv|mot de passe|une par une|une à une/i.test(refus), 'le refus est expliqué à l’écran', refus);
  await page.locator('.copy-machine[data-machine="serveur"]').click();
  const serveur = await page.evaluate(() => navigator.clipboard.readText());
  assert(/sudo tee/.test(serveur) && !/smbclient/.test(serveur), 'copie du serveur : ses commandes seulement, aucun smbclient');
  // clavier : tout est atteignable à la tabulation
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), 'clavier : le focus se déplace');
  await capture(page, 'bureau-04-plusieurs-postes');
  await context.close();
}
{
  // mobile 390 px : pas de défilement horizontal sur une fiche à plusieurs postes ni sur le parcours
  for (const hash of ['/#/tache/cours-smbclient-transferts', `/#/cours/${COURS_ID}/D`, '/#/tache/cours-hyperviseur-ajouter-disque/methode/gui']) {
    const { context, page } = await nouvellePage({ viewport: { width: 390, height: 844 } }, hash);
    await page.waitForTimeout(300);
    const largeur = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert(largeur.sw <= largeur.cw + 1, `390 px sans défilement horizontal : ${hash}`, JSON.stringify(largeur));
    await context.close();
  }
}
{
  // Fiches Windows : puces de poste, méthodes CMD / PowerShell / GUI distinctes, jamais mêlées dans une copie
  const { context, page } = await nouvellePage({ permissions: ['clipboard-read', 'clipboard-write'] }, '/#/tache/cours-windows-acces-partage/methode/cmd');
  await page.waitForSelector('#taskView:not([hidden])');
  const cmd = await page.locator('.cmd-block, pre').allInnerTexts();
  assert(cmd.length > 0 && cmd.every((t) => !/Get-ChildItem|New-Item|Set-/.test(t)), 'méthode CMD : aucune commande PowerShell');
  await page.goto(`${BASE}/#/tache/cours-windows-acces-partage/methode/powershell`);
  await page.waitForTimeout(200);
  const ps = await page.locator('.cmd-block, pre').allInnerTexts();
  assert(ps.length > 0 && ps.every((t) => !/^\s*(dir|mkdir)\b/m.test(t) || /Get-ChildItem|New-Item/.test(t)), 'méthode PowerShell : cmdlets, pas de commandes CMD seules');
  await page.goto(`${BASE}/#/tache/cours-windows-acces-partage/methode/gui`);
  await page.waitForTimeout(200);
  assert(await page.locator('.copy-step').count() === 0, 'méthode GUI : rien à copier (étapes à la souris)');
  await context.close();
}

// ---------------------------------------------------------------------------
// 3. Progression : conservée, sans secret, et le stockage refusé ne casse rien
// ---------------------------------------------------------------------------
{
  const { context, page } = await nouvellePage({}, `/#/cours/${COURS_ID}/A`);
  await page.waitForSelector('#coursView .parcours-items');
  await page.locator('#item-A1').check();
  assert(await page.locator('li[data-item="A1"].is-fait').count() === 1, 'case cochée : élément marqué « fait »');
  assert(/1 sur 5 faits/.test(await page.locator('.parcours-avancement').innerText()), 'avancement mis à jour');
  const stock = await page.evaluate(() => ({ p: localStorage.getItem('kjemo.progression.v1'), tout: Object.keys(localStorage) }));
  assert(stock.p === JSON.stringify({ [`${COURS_ID}:A1`]: true }), 'la progression ne garde que des identifiants d’éléments', stock.p);
  await page.reload();
  await page.waitForSelector('#coursView .parcours-items');
  assert(await page.locator('#item-A1').isChecked(), 'la progression survit au rechargement');
  await page.evaluate(() => localStorage.setItem('kjemo.progression.v1', JSON.stringify({ 'faux:Z9': true, [`${location.hash}`]: true, x: 'passwordSecret1' })));
  await page.reload();
  await page.waitForSelector('#coursView .parcours-items');
  assert(await page.locator('li.is-fait').count() === 0, 'contre-épreuve : des clés inconnues du stockage sont ignorées');
  await context.close();
}
{
  const { context, page, erreurs } = await nouvellePage({}, `/#/cours/${COURS_ID}/A`, { stockageBloque: true });
  await page.waitForSelector('#coursView .parcours-items');
  await page.locator('#item-A1').check();
  assert(erreurs.length === 0, 'stockage refusé : aucune exception non rattrapée', erreurs.join(' | '));
  assert(await page.locator('#coursView .parcours-items').isVisible(), 'stockage refusé : le parcours reste utilisable');
  await page.goto(`${BASE}/#/labo`);
  await page.waitForSelector('#laboView:not([hidden]) h1');
  assert(/indisponible/.test(await page.locator('#laboView .notice').innerText()), 'stockage refusé : le laboratoire le dit');
  await context.close();
}

// ---------------------------------------------------------------------------
// 4. Laboratoire : valeurs validées, aucun secret, utilisation explicite
// ---------------------------------------------------------------------------
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/labo');
  await page.waitForSelector('#laboView:not([hidden]) h1');
  assert(await page.locator('#laboView input[type="password"]').count() === 0, 'aucun champ mot de passe');
  const etiquettes = (await page.locator('#laboView label').allInnerTexts()).join(' | ');
  assert(!/mot de passe|password|disque|uuid|gid/i.test(etiquettes), 'aucun libellé de secret, de disque, d’UUID ou de gid', etiquettes);
  await capture(page, 'bureau-04-laboratoire');

  // Contre-épreuve : adresse invalide refusée avec sa raison, et NON enregistrée
  await page.fill('#labo-ipDc', '999.1.1.1');
  await page.fill('#labo-domaine', 'serveur2.lan');
  await page.click('#laboSave');
  assert((await page.locator('#labo-ipDc-aide ~ .champ-err').innerText()).length > 0, 'adresse invalide : une raison est affichée');
  const apres = await page.evaluate(() => JSON.parse(localStorage.getItem('kjemo.labo.v1') || '{}'));
  assert(apres.ipDc === undefined && apres.domaine === 'serveur2.lan', 'seul le valide est enregistré', JSON.stringify(apres));

  // Contre-épreuve : compte en lecture identique au compte en écriture
  await page.fill('#labo-ipDc', '172.27.1.210');
  await page.fill('#labo-compteEcriture', 'user1tp2');
  await page.fill('#labo-compteLecture', 'user1tp2');
  await page.click('#laboSave');
  assert(/différent/.test(await page.locator('#laboView').innerText()), 'compte lecture = compte écriture : refusé');

  // Une valeur qui ressemble à un mot de passe n'est qu'un identifiant : jamais un champ « secret »
  await page.fill('#labo-compteLecture', 'user2tp2');
  await page.click('#laboSave');
  const garde = await page.evaluate(() => localStorage.getItem('kjemo.labo.v1'));
  assert(!/pass|secret|mdp|\/dev\//i.test(garde), 'le stockage ne contient ni secret ni périphérique', garde);

  // « Utiliser mon laboratoire » : explicite, et seulement pour les paramètres connus
  await page.goto(`${BASE}/#/tache/cours-samba-partage-utilisateurs`);
  await page.waitForSelector('#taskView:not([hidden]) #exemplesBtn');
  const avant = await page.locator('[data-param="ecriture"]').inputValue();
  assert(avant === '', 'la fiche n’est jamais préremplie à l’insu de l’étudiant');
  await page.click('#laboBtn');
  assert((await page.locator('[data-param="ecriture"]').inputValue()) === 'user1tp2', '« Utiliser mon laboratoire » remplit le compte en écriture');
  assert((await page.locator('[data-param="lecture"]').inputValue()) === 'user2tp2', '… et le compte en lecture');
  await capture(page, 'bureau-05-fiche-labo');

  // Effacer
  await page.goto(`${BASE}/#/labo`);
  await page.waitForSelector('#laboView:not([hidden]) h1');
  await page.click('#laboClear');
  assert((await page.evaluate(() => localStorage.getItem('kjemo.labo.v1'))) === null, '« Effacer mon laboratoire » vide le stockage');
  assert(erreurs.length === 0, 'aucune erreur JavaScript', erreurs.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// 5. CSV : valeurs fictives, aucun mot de passe, validation, téléchargement
// ---------------------------------------------------------------------------
{
  const { context, page } = await nouvellePage({}, '/#/labo');
  await page.waitForSelector('#csvTexte');
  const modele = await page.locator('#csvTexte').inputValue();
  assert(/^login;departement\n/.test(modele) && !/pass|mdp|secret|FICTIF/i.test(modele), 'modèle CSV : éditeur login;departement, aucune colonne de mot de passe');
  await page.click('#csvVerifier');
  assert(/CSV valide/.test(await page.locator('#csvRetour').innerText()), 'le modèle est valide');

  // Contre-épreuve : 3e champ (mot de passe) refusé
  await page.fill('#csvTexte', 'login;departement\nalice;Ventes;MotDePasse123\n');
  await page.click('#csvVerifier');
  { const retour = await page.locator('#csvRetour').innerText(); assert(/Ligne 2/.test(retour) && !retour.includes('MotDePasse123'), 'ligne à 3 champs (mot de passe) : refusée, localisée, contenu non recopié'); }
  assert(await page.locator('#csvTelecharger').getAttribute('aria-disabled') === 'true', 'le téléchargement est désactivé tant que le CSV est invalide');

  // Contre-épreuve : doublon
  await page.fill('#csvTexte', 'alice;Ventes\nalice;Finance\n');
  await page.click('#csvVerifier');
  assert(/déjà/.test(await page.locator('#csvRetour').innerText()), 'login en double : refusé');

  // Téléchargement valide
  await page.fill('#csvTexte', 'alice;Ventes\nbruno;Finance\n');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csvTelecharger', { force: true })]);
  const contenu = readFileSync(await dl.path(), 'utf8');
  assert(dl.suggestedFilename() === 'comptes_tp2_MODELE.csv' && contenu === 'login;motdepasse;departement\nalice;FICTIF-0001;Ventes\nbruno;FICTIF-0002;Finance\n', 'CSV téléchargé : LF, en-tête du TP2, mots de passe FICTIFS', JSON.stringify(contenu));
  await context.close();
}

// ---------------------------------------------------------------------------
// 6. Gabarit de TP et contre-épreuves de routes
// ---------------------------------------------------------------------------
{
  const { context, page, erreurs } = await nouvellePage({}, "/#/cours");
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#gabaritBtn')]);
  const g = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  assert(g.id === 'cours-tp-exemple' && g.parcours[0].items.some((i) => i.couvert === false), 'gabarit de TP : JSON valide avec un élément « non couvert »');

  await page.goto(`${BASE}/#/cours/n-existe-pas`);
  await page.waitForSelector('#coursView:not([hidden]) h1');
  assert(/introuvable/i.test(await page.locator('#coursView h1').innerText()), 'cours inconnu : message clair');

  await page.goto(`${BASE}/#/tache/cours-samba-groupes/etape/99/depuis/${COURS_ID}/A`);
  await page.waitForSelector('#taskView:not([hidden]) h1');
  assert(await page.locator('li.etape-cible').count() === 0, 'étape inexistante : aucun repère, aucune erreur');
  await page.goto(`${BASE}/#/tache/cours-samba-groupes/etape/1/depuis/inconnu/Z`);
  await page.waitForSelector('#taskView:not([hidden]) h1');
  assert(await page.locator('#retourParcours').count() === 0, 'parcours d’origine inconnu : pas de faux lien de retour');

  // Routes historiques toujours valides
  for (const h of ['#/tache/cours-samba-groupes', '#/assistants', '#/']) {
    await page.goto(`${BASE}/${h}`);
    await page.waitForTimeout(250);
    assert(h.startsWith('#/tache') ? await page.locator('#taskView').isVisible() : await page.locator('#coursView').isHidden(), `route historique ${h} : ${h.startsWith('#/tache') ? 'la fiche s’ouvre (en fenêtre au-dessus de la page courante)' : 'pas d’espace de cours affiché'}`);
  }
  assert(erreurs.length === 0, 'aucune erreur JavaScript', erreurs.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// 7. Mobile 390 px
// ---------------------------------------------------------------------------
{
  const { context, page } = await nouvellePage({ viewport: { width: 390, height: 844 } }, `/#/cours/${COURS_ID}/D`);
  await page.waitForSelector('#coursView .parcours-items');
  assert(!(await debordement(page)), 'mobile : parcours D sans défilement horizontal');
  await capture(page, 'mobile-01-parcours-d');
  await page.goto(`${BASE}/#/labo`);
  await page.waitForSelector('#laboView:not([hidden]) h1');
  assert(!(await debordement(page)), 'mobile : laboratoire sans défilement horizontal');
  await capture(page, 'mobile-02-laboratoire');
  await page.goto(`${BASE}/#/tache/cours-partition-formater-monter/etape/5/depuis/${COURS_ID}/B`);
  await page.waitForSelector('li.etape-cible');
  assert(!(await debordement(page)), 'mobile : fiche ouverte à une étape sans défilement horizontal');
  await capture(page, 'mobile-03-etape');
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('#espacesZone a');
  const cibles = await page.locator('#espacesZone a').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  assert(cibles.every((h) => h >= 44), 'mobile : cibles tactiles de l’accueil d’au moins 44 px', cibles.join(','));
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, 'mobile-04-accueil');
  await context.close();
}

await browser.close();
server.close();
console.log(`\nbrowser-cours : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
