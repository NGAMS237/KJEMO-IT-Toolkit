#!/usr/bin/env node
/**
 * browser-choix.test.mjs — KJEMO-CLAVIER-01 · KJEMO IT Toolkit
 * Banc Playwright des listes déroulantes (paramètres « choix ») : une liste avec libellés lisibles, valeur technique
 * copiée, bouton d'exemples, aucune erreur de page. NE PROUVE PAS l'effet des commandes sur un poste.
 * Usage : node test/browser-choix.test.mjs   (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage(); const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.goto(BASE + '/#/tache/linux-clavier-changer');
await page.waitForSelector('#p-disposition', { state: 'attached' });
assert(await page.$eval('#p-disposition', (e) => e.tagName) === 'SELECT', 'disposition : liste déroulante');
const textes = await page.$$eval('#p-disposition option', (o) => o.map((x) => x.textContent));
assert(textes.some((t) => t.includes('AZERTY')) && textes.some((t) => t.includes('QWERTY')) && textes.some((t) => t.includes('QWERTZ')), 'libellés QWERTY, AZERTY et QWERTZ');
await page.selectOption('#p-disposition', 'fr');
const cmd = await page.evaluate(() => document.body.innerText);
assert(cmd.includes('localectl set-keymap fr'), 'la valeur technique « fr » est dans la commande');
assert(!(await page.$eval('#p-disposition-err', (e) => e.textContent)), 'aucune erreur affichée');
await page.selectOption('#p-disposition', '');
assert(!(await page.evaluate(() => document.body.innerText)).includes('localectl set-keymap fr'), 'valeur vidée : commande plus rendue');
const bouton = await page.$('#exemplesBtn');
if (bouton) { await bouton.click(); assert(await page.$eval('#p-disposition', (e) => e.value) === 'ca', 'bouton d’exemples : « ca » choisi'); }
await page.goto(BASE + '/#/tache/win-clavier-fixer');
await page.waitForSelector('#p-langue', { state: 'attached' });
assert(await page.$eval('#p-langue', (e) => e.tagName) === 'SELECT' && (await page.$$eval('#p-langue option', (o) => o.map((x) => x.textContent))).includes('Français (Canada)'), 'Windows : liste de langues lisibles');
await page.setViewportSize({ width: 390, height: 800 });
assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'pas de débordement à 390 px');
await page.goto(BASE + '/#/tache/cours-ubuntu-jonction-ad');
await page.waitForSelector('#p-interface', { state: 'attached' });
const note = await page.$eval('#p-interface-trouver', (e) => e.textContent);
assert(note.includes('Client Ubuntu') && note.includes('ip -br link'), 'sous « interface » : poste (Client Ubuntu) et commande (ip -br link)');
const noteDns = await page.$eval('#p-dns-trouver', (e) => e.textContent);
assert(noteDns.includes('Serveur') && noteDns.includes('ip -br address'), 'sous « adresse du contrôleur » : poste Serveur et sa commande');
assert((await page.$$('.param-trouver')).length === 11, 'chaque paramètre de la fiche a sa note « à lire sur »');
assert((await page.$eval('#p-interface-trouver', (e) => getComputedStyle(e).fontSize)) === '11.5px', 'note en petits caractères');
const chips = await page.$$eval('.machine-chip', (e) => e.map((x) => x.textContent));
assert(chips.some((t) => t.includes('Serveur')) && chips.some((t) => t.includes('Client Ubuntu')), 'étapes étiquetées « Sur : Serveur » et « Sur : Client Ubuntu »');
await page.click('#exemplesBtn').catch(() => {});
assert((await page.$eval('#p-domaine', (e) => e.value)) === 'serveur2.lan', 'bouton d’exemples : valeurs remplies');
await page.setViewportSize({ width: 390, height: 800 });
assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'jonction : pas de débordement à 390 px');
await page.goto(BASE + '/#/tache/win-ad-infos-utilisateur');
await page.waitForSelector('#p-compte', { state: 'attached' });
const noteCompte = await page.$eval('#p-compte-trouver', (e) => e.textContent);
assert(noteCompte.includes('Ce poste Windows') && noteCompte.includes('Get-ADUser'), 'win-ad-infos-utilisateur : « À lire sur : Ce poste Windows  Get-ADUser… »');
await page.goto(BASE + '/#/tache/cours-samba-partage-groupe');
await page.waitForSelector('#p-groupe', { state: 'attached' });
const noteGroupe = await page.$eval('#p-groupe-trouver', (e) => e.textContent);
assert(noteGroupe.includes('Serveur') && noteGroupe.includes('samba-tool group list'), 'fiche Samba : le groupe se lit sur le serveur');
await page.goto(BASE + '/#/tache/win-ad-creer-groupe');
await page.waitForSelector('#p-groupe', { state: 'attached' });
assert((await page.$('#p-groupe-trouver')) === null, 'groupe à CRÉER : aucune note « à lire sur »');
await page.goto(BASE + '/#/tache/cours-az-vnet-creer');
await page.waitForSelector('#p-vnet', { state: 'attached' });
assert((await page.$('#p-vnet-trouver')) === null && (await page.$('#p-groupe-trouver')) !== null, 'Azure : le VNet à créer sans note, le groupe existant avec note');
await page.goto(BASE + '/#/tache/cours-ubuntu-jonction-ad-graphique');
await page.waitForSelector('.tache');
const onglets = await page.$$eval('[role="tab"], .method-tab, .methode-onglet', (e) => e.map((x) => x.textContent.trim()));
assert(onglets.length >= 2, 'jonction graphique : deux onglets de méthode (graphique et terminal)', onglets.join(' | '));
const titres = await page.$$eval('.step-title', (e) => e.map((x) => x.textContent));
assert(titres.some((x) => /Cockpit/.test(x)), 'jonction graphique : une étape Cockpit');
assert(await page.locator('.flag-annul').count() >= 1, 'jonction graphique : étape(s) Annulation signalée(s)');
await page.goto(BASE + '/#/tache/cours-ubuntu-jonction-ad');
await page.waitForSelector('.tache');
assert((await page.textContent('body')).includes('127.0.1.1'), 'jonction par commandes : la ligne /etc/hosts accompagne le changement de nom');
await page.goto(BASE + '/#/tache/samba-ad-installer');
await page.waitForSelector('#p-domaine', { state: 'attached' });
assert((await page.$$('.param-trouver')).length >= 6, 'installation du domaine : notes « à lire sur » sous les cases');
assert(await page.locator('.flag-annul').count() >= 5, 'installation du domaine : étapes « Annuler » signalées');
assert((await page.textContent('body')).includes('systemd-resolved'), 'installation du domaine : étape systemd-resolved présente');
await page.setViewportSize({ width: 390, height: 800 });
assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'installation du domaine : pas de débordement à 390 px');
assert(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
await browser.close(); server.close();
console.log(`\nbrowser-choix : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
