#!/usr/bin/env node
/**
 * browser-journal.test.mjs — JOURNAL-LABO-01 · KJEMO IT Toolkit
 * Banc Playwright du Journal de labo : entrée de menu, création, refus d'un mot
 * de passe écrit, enregistrement et relecture après rechargement, capture
 * (fichier) gardée dans IndexedDB, export PDF téléchargé, nouvelle version,
 * duplication, suppression confirmée dans la page, sauvegarde puis restauration
 * dans un navigateur vierge, création depuis la fiche du TP VLAN, exemples
 * d'aide au remplissage et labo d'exemple, inventaire des équipements (SW1 et R1
 * créés depuis le TP, route ajoutée, annexe du PDF, suppression), éditeur de
 * schéma (schéma du TP, glisser, palette, relier, clavier, type personnel,
 * relecture, PDF et SVG), affichage à
 * 390 px sans débordement, stockage bloqué, aucune erreur de page.
 * NE PROUVE PAS l'affichage du PDF dans un lecteur précis (voir journal.test.mjs).
 * Usage : node test/browser-journal.test.mjs   (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURES = process.env.KJEMO_CAPTURES ? resolve(process.env.KJEMO_CAPTURES) : null;
if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });
const TMP = mkdtempSync(join(tmpdir(), 'kjemo-bj-'));
const JPEG = join(TMP, 'topologie.jpg');
writeFileSync(JPEG, Buffer.from('/9j/4AAQSkZJRgABAQEAAgACAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAYABEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3V3uVlYIgK54JB9KRZbvjMS+/Bq3RTuIKKKKQxC6g4LAH60m9T0YfnRRQA6iiigD/2Q==', 'base64'));

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

const lireDl = async (dl) => { const f = join(TMP, dl.suggestedFilename()); await dl.saveAs(f); return readFileSync(f); };
const sansDebordement = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// 1. Journal vide, menu
{
  const { context, page, erreurs } = await nouvellePage({}, '/#/journal');
  assert(await page.locator('#journalView h1').innerText() === 'Journal de labo', 'page « Journal de labo »');
  assert(await page.locator('#espacesNav a[data-espace="journal"]').getAttribute('aria-current') === 'page', 'entrée de menu active');
  assert(await page.locator('.j-vide').count() === 1 && await page.locator('#jSauver').isDisabled(), 'journal vide : message d’accueil, sauvegarde désactivée');
  assert(erreurs.length === 0, 'aucune erreur de page (liste vide)', erreurs.join(' | '));
  await context.close();
}

// 2-10. Parcours complet dans un même navigateur
const { context: ctx, page, erreurs } = await nouvellePage({}, '/#/journal');
let idLabo;
{
  await page.selectOption('#jNouvelleCat', 'systeme');
  await page.click('#jNouveauForm button[type="submit"]');
  await page.waitForSelector('#jForm');
  idLabo = (await page.evaluate(() => location.hash)).split('/').pop();
  assert(/^#\/journal\/j[\w]+$/.test(await page.evaluate(() => location.hash)), 'nouveau labo : route #/journal/<id>');
  assert(/^LAB-SYS-\d{4}-001$/.test((await page.locator('.j-controle dd').first().innerText()).trim()), 'référence LAB-SYS-AAAA-001');
  await page.click('#jEnregistrer');
  assert(await page.locator('#jf-titre').getAttribute('aria-invalid') === 'true' && await page.evaluate(() => document.activeElement?.id) === 'jf-titre', 'sans titre : refus, focus sur le titre');
  await page.fill('#jf-titre', 'Jonction Ubuntu à Samba AD');
  await page.fill('#jf-auteur', 'B. Nganbou');
  await page.click('[data-jadd="adressage"]');
  await page.fill('[data-jt="adressage"][data-row="0"][data-col="equipement"]', 'SRV-DC01');
  await page.fill('[data-jt="adressage"][data-row="0"][data-col="adresse"]', '172.27.1.210/24');
  await page.click('[data-jadd="configuration"]');
  await page.fill('[data-jt="configuration"][data-row="0"][data-col="titre"]', 'Serveur');
  await page.fill('[data-jt="configuration"][data-row="0"][data-col="code"]', 'sudo samba-tool domain info 127.0.0.1\nmot de passe : Abc123');
  await page.click('#jEnregistrer');
  const errCode = page.locator('#jerr-configuration-0-code');
  assert(await errCode.count() === 1 && /ligne 2/.test(await errCode.innerText()), 'mot de passe écrit : refusé, avec la ligne');
  assert(await page.locator('#jNote').innerText().then((t) => /corriger/.test(t)), 'la barre dit qu’il faut corriger');
  await page.fill('[data-jt="configuration"][data-row="0"][data-col="code"]', 'sudo samba-tool domain info 127.0.0.1\nmot de passe : ***');
  await page.click('#jEnregistrer');
  assert(/Enregistré/.test(await page.locator('#jNote').innerText()), 'valeur masquée par *** : enregistré');
  // Capture
  await page.setInputFiles('#jCaptureFichier', JPEG);
  await page.waitForSelector('.j-capture img');
  await page.fill('#jc-0', 'Topologie du labo');
  await page.click('#jEnregistrer');
  assert(await page.locator('.j-capture').count() === 1, 'capture ajoutée et légendée');
  // Rechargement : le labo et l'image sont relus
  await page.reload(); await page.waitForSelector('#jForm');
  assert(await page.inputValue('#jf-titre') === 'Jonction Ubuntu à Samba AD' && await page.inputValue('[data-jt="adressage"][data-row="0"][data-col="adresse"]') === '172.27.1.210/24', 'après rechargement : champs relus');
  await page.waitForSelector('.j-capture img');
  assert(await page.waitForFunction(() => { const i = document.querySelector('.j-capture img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).then(() => true, () => false), 'après rechargement : la capture est relue (IndexedDB)');
  // PDF
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#jPdf')]);
  const pdf = await lireDl(dl);
  assert(/^LAB-SYS-\d{4}-001_v1\.0\.pdf$/.test(dl.suggestedFilename()), 'PDF nommé référence_version', dl.suggestedFilename());
  assert(pdf.subarray(0, 8).toString('latin1') === '%PDF-1.4' && pdf.toString('latin1').includes('/DCTDecode') && pdf.toString('latin1').trimEnd().endsWith('%%EOF'), 'PDF valide avec la capture');
  assert(/PDF téléchargé/.test(await page.locator('#jNote').innerText()), 'la barre confirme le téléchargement');
  // Nouvelle version
  await page.click('#jVersion');
  await page.click('#jVersionForm button[type="submit"]');
  assert(/Écris en une phrase/.test(await page.locator('#jNote').innerText()), 'nouvelle version : résumé obligatoire');
  if (await page.locator('#jVersionForm').count() === 0) await page.click('#jVersion');
  await page.fill('#jVersionResume', 'Ajout du client Ubuntu');
  await page.click('#jVersionForm button[type="submit"]');
  assert(/1\.1/.test(await page.locator('.j-sous').innerText()) && await page.locator('.j-revisions tbody tr').count() === 2, 'version 1.1 publiée, historique à deux lignes');
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'journal-fiche.png'), fullPage: true });
  // Dupliquer puis supprimer la copie
  await page.click('#jDupliquer');
  await page.waitForFunction((id) => !location.hash.endsWith(id), idLabo);
  assert(/\(copie\)/.test(await page.inputValue('#jf-titre')), 'duplication : copie ouverte');
  await page.click('#jEnregistrer');
  await page.click('#jSupprimer');
  assert(await page.locator('.j-confirmer').count() === 1 && await page.evaluate(() => document.activeElement?.id) === 'jSupprimerNon', 'suppression : confirmation dans la page, focus sur « Non »');
  await page.click('#jSupprimerOui');
  await page.waitForSelector('.j-liste');
  assert(await page.locator('.j-ligne').count() === 1, 'copie supprimée, l’original reste');
  // Filtres et recherche
  await page.fill('#jRecherche', 'samba');
  assert(await page.locator('.j-ligne').count() === 1, 'recherche : trouvé');
  await page.fill('#jRecherche', 'introuvable');
  assert(await page.locator('.j-ligne').count() === 0, 'recherche : rien');
  await page.fill('#jRecherche', '');
  await page.click('[data-jcat="cisco"]');
  assert(await page.locator('.j-ligne').count() === 0 && await page.locator('[data-jcat="cisco"]').getAttribute('aria-pressed') === 'true', 'onglet Cisco : vide');
  await page.click('[data-jcat=""]');
}

// Sauvegarde puis restauration dans un navigateur vierge
let fichierSauvegarde;
{
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#jSauver')]);
  const txt = (await lireDl(dl)).toString('utf8');
  fichierSauvegarde = join(TMP, dl.suggestedFilename());
  const d = JSON.parse(txt);
  assert(d.format === 'kjemo-journal-de-labo' && d.entrees.length === 1 && Object.keys(d.captures).length === 1, 'sauvegarde : un labo et sa capture');
  assert(!/Abc123/.test(txt), 'la sauvegarde ne contient aucun mot de passe');
}
// Depuis une fiche
{
  await page.goto(`${BASE}/#/tache/cours-tp-vlan-ssh-intervlan`);
  await page.waitForSelector('#taskJournal');
  await page.click('#exemplesBtn');
  await page.click('#taskJournal');
  await page.waitForSelector('#jForm');
  assert(await page.locator('[data-jt="adressage"][data-col="adresse"]').count() === 3, 'depuis la fiche TP : trois lignes d’adressage');
  const code = await page.locator('[data-jt="configuration"][data-col="code"]').evaluateAll((l) => l.map((x) => x.value).join('\n'));
  assert(code.includes('switchport trunk allowed vlan 99,10') && !code.includes('{{'), 'depuis la fiche TP : commandes avec les valeurs');
  assert(await page.inputValue('#jf-auteur') === 'B. Nganbou', 'l’auteur du dernier labo est repris');
  await page.click('#jEnregistrer');
  assert(/Enregistré/.test(await page.locator('#jNote').innerText()), 'labo créé depuis la fiche : enregistré');
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'journal-depuis-fiche.png') });
  await page.goto(`${BASE}/#/journal`); await page.waitForSelector('.j-liste');
  assert(await page.locator('.j-ligne').count() === 2, 'la liste montre les deux labos');
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'journal-liste.png') });
}
assert(erreurs.length === 0, 'aucune erreur de page (parcours complet)', erreurs.join(' | '));
await ctx.close();

{
  const { context, page: p2, erreurs: e2 } = await nouvellePage({}, '/#/journal');
  await p2.setInputFiles('#jRestaurer', fichierSauvegarde);
  await p2.waitForSelector('.j-ligne');
  assert(/1 labo\(s\) restauré/.test(await p2.locator('#jNote').innerText()), 'restauration : un labo');
  await p2.click('.j-ligne-lien');
  await p2.waitForSelector('.j-capture img');
  assert(await p2.waitForFunction(() => { const i = document.querySelector('.j-capture img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).then(() => true, () => false), 'restauration : la capture revient');
  await p2.setInputFiles('#jCaptureFichier', { name: 'faux.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('pas une image') });
  await p2.waitForFunction(() => /pas pu être lue/.test(document.querySelector('#jNote')?.textContent ?? ''));
  assert(true, 'contre-épreuve : une fausse image est refusée');
  await p2.goto(`${BASE}/#/journal`);
  const faux = join(TMP, 'faux.json'); writeFileSync(faux, JSON.stringify({ format: 'autre' }));
  await p2.setInputFiles('#jRestaurer', faux);
  await p2.waitForFunction(() => /pas une sauvegarde/.test(document.querySelector('#jNote')?.textContent ?? ''));
  assert(await p2.locator('.j-ligne').count() === 1, 'contre-épreuve : un fichier étranger ne change rien');
  assert(e2.length === 0, 'aucune erreur de page (restauration)', e2.join(' | '));
  await context.close();
}


// Exemples et inventaire
{
  const { context, page: p5, erreurs: e5 } = await nouvellePage({ acceptDownloads: true }, '/#/journal');
  await p5.selectOption('#jNouvelleCat', 'systeme');
  await p5.click('#jExemple'); await p5.waitForSelector('#jForm');
  assert(/^EXEMPLE — /.test(await p5.inputValue('#jf-titre')) && (await p5.inputValue('#jf-objet')).length > 20, 'labo d’exemple : titre et objet remplis');
  assert(/Il n’est enregistré que si/.test(await p5.locator('#jNote').innerText()), 'labo d’exemple : non enregistré tant qu’on ne le décide pas');
  await p5.goto(`${BASE}/#/journal`); await p5.waitForSelector('#journalView h1');
  assert(await p5.locator('.j-ligne').count() === 0, 'l’exemple non enregistré n’apparaît pas dans la liste');
  await p5.click('#jNouveauForm button[type="submit"]'); await p5.waitForSelector('#jForm');
  assert(/^Ex\. : /.test(await p5.getAttribute('#jf-objet', 'placeholder')) && await p5.locator('.j-exemple').count() >= 3, 'champs vides : exemples affichés');
  // Depuis le TP : SW1 et R1 dans l'inventaire
  await p5.goto(`${BASE}/#/tache/cours-tp-vlan-ssh-intervlan`); await p5.waitForSelector('#taskJournal');
  await p5.click('#exemplesBtn'); await p5.click('#taskJournal'); await p5.waitForSelector('#jForm');
  assert(await p5.locator('[data-jeq]:checked').count() === 2 && /SW1, R1/.test(await p5.locator('#jNote').innerText()), 'TP VLAN : SW1 et R1 créés et cochés');
  await p5.click('#jEnregistrer');
  const lab = await p5.evaluate(() => location.hash);
  // Ouvrir R1, ajouter une route statique
  await p5.locator('.i-choix', { hasText: 'R1' }).locator('[data-jeqouvrir]').click();
  await p5.waitForSelector('#iForm');
  assert(await p5.locator('#journalView h1').innerText() === 'R1' && await p5.locator('#iRetour').count() === 1, 'fiche de R1, avec le retour au labo');
  assert(await p5.locator('[data-it="routes"]').count() >= 2 * 5, 'R1 : routes connectées préremplies');
  await p5.click('[data-iadd="routes"]');
  const n = await p5.locator('[data-it="routes"][data-col="type"]').count() - 1;
  await p5.fill(`[data-it="routes"][data-row="${n}"][data-col="type"]`, 'S*');
  await p5.fill(`[data-it="routes"][data-row="${n}"][data-col="destination"]`, '0.0.0.0/0');
  await p5.fill(`[data-it="routes"][data-row="${n}"][data-col="via"]`, '203.0.113.1');
  await p5.fill(`[data-it="routes"][data-row="${n}"][data-col="pourquoi"]`, 'Sortie Internet');
  await p5.fill('#if-notes', 'enable secret Cisco123');
  await p5.click('#iEnregistrer');
  assert(await p5.locator('#ierr-notes').count() === 1, 'inventaire : mot de passe écrit refusé');
  await p5.fill('#if-notes', 'Mot de passe dans le gestionnaire, entrée R1');
  await p5.click('#iEnregistrer');
  assert(/Enregistré dans l’inventaire/.test(await p5.locator('#iNoteFiche').innerText()), 'R1 enregistré avec sa nouvelle route');
  await p5.click('#iRetour'); await p5.waitForSelector('#jForm');
  assert(await p5.evaluate(() => location.hash) === lab, 'retour au labo');
  const [dl] = await Promise.all([p5.waitForEvent('download'), p5.click('#jPdf')]);
  const pdf = (await lireDl(dl)).toString('latin1');
  assert(pdf.includes('Annexe A') && pdf.includes('Sortie Internet'), 'PDF du labo : annexe des équipements avec la nouvelle route');
  // Inventaire
  await p5.goto(`${BASE}/#/inventaire`); await p5.waitForSelector('.i-table');
  assert(await p5.locator('.i-table tbody tr').count() === 2 && await p5.locator('#espacesNav a[data-espace="journal"]').getAttribute('aria-current') === 'page', 'inventaire : deux équipements, menu Journal actif');
  await p5.fill('#iRecherche', 'introuvable');
  assert(await p5.locator('.i-table tbody tr').count() === 0, 'recherche dans l’inventaire : rien');
  await p5.fill('#iRecherche', 'gigabitethernet0/0.10');
  assert(await p5.locator('.i-table tbody tr').count() === 1, 'recherche par interface : R1');
  await p5.fill('#iRecherche', '');
  const [dli] = await Promise.all([p5.waitForEvent('download'), p5.click('#iPdf')]);
  assert((await lireDl(dli)).subarray(0, 8).toString('latin1') === '%PDF-1.4' && /^inventaire-equipements_\d{4}-\d{2}-\d{2}\.pdf$/.test(dli.suggestedFilename()), 'inventaire exporté en PDF');
  if (CAPTURES) await p5.screenshot({ path: join(CAPTURES, 'inventaire.png') });
  // Supprimer SW1 : retiré du labo
  await p5.locator('.i-table a', { hasText: 'SW1' }).click(); await p5.waitForSelector('#iForm');
  await p5.click('#iSupprimer');
  assert(/Il sera retiré de 1 labo/.test(await p5.locator('.j-confirmer').innerText()), 'suppression : les labos concernés sont annoncés');
  await p5.click('#iSupprimerOui'); await p5.waitForSelector('.i-table');
  await p5.goto(BASE + '/' + lab); await p5.waitForSelector('#jForm');
  assert(await p5.locator('[data-jeq]:checked').count() === 1, 'SW1 supprimé : retiré du labo, R1 reste');
  // Nouvel équipement depuis le labo : ajouté au labo
  await p5.click('#jEqNouveau'); await p5.waitForSelector('#iForm');
  await p5.fill('#if-nom', 'PC-ADMIN'); await p5.selectOption('#if-systeme', 'systeme');
  await p5.click('#iEnregistrer');
  assert(/Ajouté au labo/.test(await p5.locator('#iNoteFiche').innerText()), 'équipement créé depuis le labo : ajouté au labo');
  await p5.click('#iRetour'); await p5.waitForSelector('#jForm');
  assert(await p5.locator('[data-jeq]:checked').count() === 2, 'le labo compte R1 et PC-ADMIN');
  if (CAPTURES) await p5.screenshot({ path: join(CAPTURES, 'journal-equipements.png') });
  assert(e5.length === 0, 'aucune erreur de page (exemples et inventaire)', e5.join(' | '));
  await context.close();
}


// Aperçu claude.ai simulé : le téléchargement passe par la fonction d'enregistrement de l'aperçu
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    window.__saves = []; window.__refuser = false;
    window.claude = { use: async (nom) => (nom !== 'downloads' ? null : {
      save: async ({ filename, data }) => {
        if (window.__refuser) { const e = new Error('non'); e.code = 'declined'; throw e; }
        const octets = new Uint8Array(await data.arrayBuffer());
        window.__saves.push({ filename, taille: octets.length, debut: String.fromCharCode(...octets.subarray(0, 8)) });
        return { status: 'saved' };
      },
    }) };
  });
  const p6 = await context.newPage(); const e6 = []; p6.on('pageerror', (e) => e6.push(e.message));
  await p6.goto(`${BASE}/#/journal`); await p6.waitForSelector('#jExemple');
  await p6.click('#jExemple'); await p6.waitForSelector('#jForm');
  let telechargements = 0; p6.on('download', () => { telechargements += 1; });
  await p6.click('#jPdf');
  await p6.waitForFunction(() => window.__saves.length === 1);
  const sv = await p6.evaluate(() => window.__saves[0]);
  assert(/\.pdf$/.test(sv.filename) && sv.debut === '%PDF-1.4' && sv.taille > 2000, 'aperçu : le PDF passe par l’enregistrement de l’aperçu', JSON.stringify(sv));
  assert(/PDF enregistré/.test(await p6.locator('#jNote').innerText()) && telechargements === 0, 'aperçu : message « enregistré », aucun lien de téléchargement utilisé');
  await p6.evaluate(() => { window.__refuser = true; });
  await p6.click('#jPdf');
  await p6.waitForFunction(() => /annulé/.test(document.querySelector('#jNote')?.textContent ?? ''));
  assert(true, 'aperçu : un enregistrement refusé est annoncé');
  assert(e6.length === 0, 'aucune erreur de page (aperçu simulé)', e6.join(' | '));
  await context.close();
}


// Éditeur de schéma
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p7 = await context.newPage(); const e7 = []; p7.on('pageerror', (e) => e7.push(e.message));
  await p7.goto(`${BASE}/#/tache/cours-tp-vlan-ssh-intervlan`); await p7.waitForSelector('#taskJournal');
  await p7.click('#exemplesBtn'); await p7.click('#taskJournal'); await p7.waitForSelector('#schFeuille');
  assert(await p7.locator('#schFeuille .sch-cible').count() === 4 && await p7.locator('#schFeuille').innerText().then((t) => t.includes('VLAN 99')), 'TP VLAN : schéma prérempli (R1, SW1, deux postes, zones VLAN)');
  await p7.locator('#schFeuille').scrollIntoViewIfNeeded();
  const coord = async (x, y) => { await p7.locator('#schFeuille').scrollIntoViewIfNeeded(); const b = await p7.locator('#schFeuille svg').boundingBox(); return [b.x + (x * b.width) / 1000, b.y + (y * b.height) / 600]; };
  const glisser = async (x1, y1, x2, y2) => { const [a, b] = await coord(x1, y1); const [c, d] = await coord(x2, y2); await p7.mouse.move(a, b); await p7.mouse.down(); await p7.mouse.move(c, d, { steps: 6 }); await p7.mouse.up(); };
  const position = (nom) => p7.evaluate((n) => { const t = [...document.querySelectorAll('#schFeuille text')].find((x) => x.textContent === n); return t ? [Number(t.getAttribute('x')), Number(t.getAttribute('y'))] : null; }, nom);
  await glisser(500, 40, 300, 100);
  assert(JSON.stringify(await position('R1')) === JSON.stringify([300, 140]), 'glisser : R1 déplacé et aimanté à la grille', JSON.stringify(await position('R1')));
  assert((await p7.locator('#schElement option:checked').innerText()).includes('R1'), 'l’équipement glissé est choisi');
  // Palette par groupes et filtre par système
  assert(await p7.locator('.sch-famille-titre', { hasText: 'Terminaux' }).count() === 1 && await p7.locator('[data-sadd="telephone-ip"]').count() === 1, 'palette par groupes, avec le téléphone IP');
  await p7.click('[data-sfiltre="azure"]');
  assert(await p7.locator('[data-sadd="telephone-ip"]').count() === 0 && await p7.locator('[data-sadd="passerelle-vpn"]').count() === 1, 'filtre Azure : seulement les équipements Azure');
  await p7.click('[data-sfiltre="tous"]');
  await p7.click('[data-sadd="telephone-ip"]');
  assert(await p7.locator('#schModele').inputValue() === '7960', 'téléphone IP posé avec son modèle (ports Switch et PC)');
  await p7.click('#schSupprimer');
  // Palette : un serveur, renommé
  await p7.click('[data-sadd="serveur"]');
  await p7.fill('#schNom', 'SRV-WEB'); await p7.fill('#schNote', '192.168.10.20');
  assert(await position('SRV-WEB') !== null, 'palette : serveur ajouté et renommé');
  // Câbler le serveur à SW1 depuis la palette « Câbles » : menu des ports
  await p7.click('[data-scable="croise"]');
  assert(await p7.locator('[data-scable="croise"]').getAttribute('aria-pressed') === 'true' && /premier/.test(await p7.locator('.sch-bandeau').innerText()), 'palette Câbles : mode câble croisé, consigne affichée');
  const clicNoeud = async (nom) => { const pos = await position(nom); const [a, b] = await coord(pos[0], pos[1] - 40); await p7.mouse.click(a, b); };
  await clicNoeud('SW1');
  assert(await p7.locator('.sch-menu-ports').count() === 1 && await p7.locator('#schPortChoix option').count() >= 26, 'clic sur SW1 : menu de ses ports (2960 : 24 Fa, 2 Gi, Vlan1, console)');
  assert(await p7.locator('#schPortChoix option[value="Fa0/24"]').isDisabled() && /pris/.test(await p7.locator('#schPortChoix option[value="Fa0/24"]').innerText()), 'port déjà câblé grisé avec sa destination');
  await p7.selectOption('#schPortChoix', 'Fa0/5'); await p7.locator('#schPortChoix').press('Enter');
  assert(/deuxième/.test(await p7.locator('.sch-bandeau').innerText()) && /Fa0\/5/.test(await p7.locator('.sch-bandeau').innerText()), 'premier port choisi au clavier : consigne du deuxième');
  await clicNoeud('SRV-WEB');
  await p7.locator('#schPortChoix option[value="ens18"]').click();
  assert(await p7.inputValue('#schItfDe') === 'Fa0/5' && await p7.inputValue('#schItfA') === 'ens18' && await p7.locator('#schStyle').inputValue() === 'croise', 'câble créé avec les deux ports, sans rien taper');
  await p7.fill('#schAdrA', '192.168.10.20/24');
  assert(await p7.locator('#schFeuille').innerText().then((t) => t.includes('Fa0/5') && t.includes('ens18') && t.includes('192.168.10.20/24')), 'interfaces et adresse affichées sur le câble');
  await p7.click('#schCablageFin');
  assert(await p7.locator('.sch-bandeau').count() === 0, 'mode câble terminé');
  // Câble automatique et EtherChannel : deux commutateurs, deux câbles entre eux
  await p7.click('[data-sadd="commutateur"]'); await p7.fill('#schNom', 'SW2');
  await p7.click('[data-scable="auto"]');
  await clicNoeud('SW1');
  assert(await p7.locator('#schPortChoix option[value="Gi0/1"]').isDisabled(), 'Gi0/1 de SW1 grisé : déjà câblé en GigabitEthernet0/1 (même port)');
  await p7.locator('#schPortAnnuler').click();
  for (const [p1, p2] of [['Fa0/20', 'Fa0/1'], ['Fa0/21', 'Fa0/2']]) {
    await clicNoeud('SW1'); await p7.locator(`#schPortChoix option[value="${p1}"]`).click();
    await clicNoeud('SW2'); await p7.locator(`#schPortChoix option[value="${p2}"]`).click();
  }
  assert(await p7.locator('#schStyle').inputValue() === 'croise', 'câble automatique : croisé entre deux commutateurs');
  const liensSw = await p7.evaluate(() => [...document.querySelectorAll('#schFeuille line[data-el]')].length);
  assert(liensSw >= 5, 'deux câbles parallèles SW1–SW2 (EtherChannel possible)');
  await p7.click('#schCablageFin');
  // Adresse sur le trunk côté R1 : reportée dans la fiche de R1
  await p7.selectOption('#schElement', { label: await p7.locator('#schElement option', { hasText: 'Trunk' }).first().innerText() });
  await p7.fill('#schAdrDe', '192.168.99.1/24'); await p7.locator('#schAdrDe').dispatchEvent('change');
  assert(/enregistrée dans la fiche de R1/.test(await p7.locator('#jNote').innerText()), 'adresse du trunk reportée dans la fiche de R1');
  assert(await p7.locator('.sch-legende').innerText().then((t) => t.includes('Trunk 802.1Q') && t.includes('Câble croisé')), 'légende des câbles utilisés');
  // Le serveur hors inventaire peut y être ajouté, avec ses interfaces
  await p7.selectOption('#schElement', { label: 'Équipement · SRV-WEB' });
  await p7.click('#schVersInventaire');
  assert(/SRV-WEB ajouté à l’inventaire/.test(await p7.locator('#jNote').innerText()), 'équipement du schéma ajouté à l’inventaire');
  const fiches = await p7.evaluate(() => JSON.parse(localStorage.getItem('kjemo.inventaire.v1')).equipements);
  const srv = fiches.find((q) => q.nom === 'SRV-WEB'); const r1 = fiches.find((q) => q.nom === 'R1');
  assert(srv?.interfaces.some((i) => i.nom === 'ens18' && i.adresse === '192.168.10.20/24') && srv.systeme === 'systeme', 'SRV-WEB : son interface et son adresse sont dans sa fiche');
  assert(r1?.interfaces.some((i) => i.nom === 'GigabitEthernet0/0' && i.adresse === '192.168.99.1/24'), 'R1 : l’interface du trunk a son adresse dans la fiche');
  // Clavier : choisir le serveur, flèche, puis Suppr sur un texte ajouté
  await p7.click('[data-sadd="texte"]'); await p7.fill('#schTexte', 'Labo B-204');
  await p7.locator('#schFeuille').focus(); await p7.keyboard.press('ArrowRight');
  const avant = await position('Labo B-204');
  assert(avant && avant[0] === 40, 'flèche : le texte avance de 10', JSON.stringify(avant));
  await p7.keyboard.press('Delete');
  assert(await position('Labo B-204') === null, 'Suppr : le texte est retiré');
  // Type personnel
  await p7.click('#schTypeOuvrir'); await p7.fill('#schTypeNom', 'Caméra IP'); await p7.fill('#schTypeCode', 'cam'); await p7.click('#schTypeAjouter');
  await p7.click('[data-sadd^="perso:"]');
  assert(await p7.locator('#schFeuille').innerText().then((t) => t.includes('CAM') && t.includes('Caméra IP')), 'type personnel créé et posé (code CAM)');
  // Mot de passe refusé
  await p7.click('[data-sadd="poste"]'); await p7.fill('#schNom', 'mot de passe : abc');
  await p7.click('#jEnregistrer');
  assert(/corriger/.test(await p7.locator('#jNote').innerText()), 'schéma avec mot de passe : enregistrement refusé');
  await p7.fill('#schNom', 'PC-ADMIN'); await p7.click('#jEnregistrer');
  assert(/Enregistré/.test(await p7.locator('#jNote').innerText()), 'schéma enregistré');
  await p7.reload(); await p7.waitForSelector('#schFeuille');
  assert(JSON.stringify(await position('R1')) === JSON.stringify([300, 140]) && await position('SRV-WEB') !== null && await position('PC-ADMIN') !== null, 'après rechargement : le schéma est relu');
  const [dl] = await Promise.all([p7.waitForEvent('download'), p7.click('#jPdf')]);
  const pdf = (await lireDl(dl)).toString('latin1');
  assert(pdf.includes('SRV-WEB') && pdf.includes('Fa0/5') && pdf.includes('192.168.10.20/24') && pdf.includes('CAM') && pdf.includes('ble crois'), 'PDF : le schéma est dessiné avec câbles, adresses et légende');
  const [dls] = await Promise.all([p7.waitForEvent('download'), p7.click('#schSvg')]);
  const svg = (await lireDl(dls)).toString('utf8');
  assert(/_schema\.svg$/.test(dls.suggestedFilename()) && svg.includes('<svg') && svg.includes('SRV-WEB') && !svg.includes('data-el'), 'export SVG du schéma (sans attributs d’édition)');
  // Remplir le document et l'inventaire depuis le schéma
  const lignesAvant = await p7.locator('[data-jt="adressage"][data-col="equipement"]').count();
  await p7.click('#schRemplir');
  assert(/Depuis le schéma/.test(await p7.locator('#jNote').innerText()), 'remplir depuis le schéma : bilan affiché');
  const eqs = await p7.locator('[data-jt="adressage"][data-col="equipement"]').evaluateAll((l) => l.map((x) => x.value));
  assert(eqs.length > lignesAvant && eqs.includes('PC-ADMIN') === false && eqs.includes('PC VENTES'), 'plan d’adressage complété depuis les câbles', eqs.join(','));
  assert(await p7.locator('[data-jeq]:checked').count() >= 5, 'équipements du schéma cochés dans la section Équipements');
  const inv7 = await p7.evaluate(() => JSON.parse(localStorage.getItem('kjemo.inventaire.v1')).equipements.map((q) => q.nom));
  assert(inv7.includes('PC VENTES') && inv7.includes('Poste de gestion'), 'inventaire : postes dessinés ajoutés', inv7.join(','));
  await p7.click('#jEnregistrer');
  await p7.click('#schVider'); assert(/Confirmer/.test(await p7.locator('#schVider').innerText()), 'vider : confirmation demandée');
  await p7.click('#schVider'); assert(await p7.locator('#schFeuille .sch-cible').count() === 0, 'schéma vidé');
  if (CAPTURES) await p7.screenshot({ path: join(CAPTURES, 'journal-schema.png') });
  assert(e7.length === 0, 'aucune erreur de page (schéma)', e7.join(' | '));
  await context.close();
}

// Téléphone : aucune barre de défilement horizontale
{
  const { context, page: p3, erreurs: e3 } = await nouvellePage({ viewport: { width: 390, height: 844 } }, '/#/journal');
  await p3.selectOption('#jNouvelleCat', 'cisco'); await p3.click('#jNouveauForm button[type="submit"]'); await p3.waitForSelector('#jForm');
  await p3.click('[data-jadd="adressage"]'); await p3.click('[data-jadd="configuration"]'); await p3.click('[data-jadd="validation"]');
  assert(await sansDebordement(p3), '390 px : fiche sans débordement horizontal');
  await p3.goto(`${BASE}/#/journal`); await p3.waitForSelector('#journalView h1');
  assert(await sansDebordement(p3), '390 px : liste sans débordement horizontal');
  await p3.goto(`${BASE}/#/inventaire`); await p3.waitForSelector('#journalView h1');
  await p3.click('#iNouveauForm button[type="submit"]'); await p3.waitForSelector('#iForm');
  await p3.click('[data-iadd="routes"]'); await p3.click('[data-iadd="vlans"]');
  assert(await sansDebordement(p3), '390 px : fiche d’équipement sans débordement horizontal (avant le schéma)');
  await p3.goto(`${BASE}/#/journal`); await p3.waitForSelector('#jExemple'); await p3.click('#jNouveauForm button[type="submit"]'); await p3.waitForSelector('#schFeuille');
  await p3.click('[data-sadd="routeur"]'); await p3.click('[data-sadd="zone"]');
  assert(await sansDebordement(p3), '390 px : éditeur de schéma sans débordement horizontal');
  assert(e3.length === 0, 'aucune erreur de page (téléphone)', e3.join(' | '));
  await context.close();
}

// Stockage bloqué : l'écran fonctionne et le dit
{
  const { context, page: p4, erreurs: e4 } = await nouvellePage({}, '/#/journal', { stockageBloque: true });
  assert(/stockage de ce navigateur est indisponible/.test(await p4.locator('#journalView .notice').innerText()), 'stockage bloqué : annoncé');
  assert(e4.length === 0, 'aucune erreur de page (stockage bloqué)', e4.join(' | '));
  await context.close();
}

await browser.close();
server.close();
console.log(`browser-journal : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
