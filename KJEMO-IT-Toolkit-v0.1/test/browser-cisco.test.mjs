#!/usr/bin/env node
/**
 * browser-cisco.test.mjs — RESEAU-CISCO-01 · KJEMO IT Toolkit
 * -----------------------------------------------------------
 * Banc Playwright (Chromium headless) dédié aux 19 fiches Cisco IOS.
 *
 * CE QUE CE BANC PROUVE : le comportement de l'interface dans un vrai
 * navigateur — routes #/outil/<id>, catégorie et sous-rubriques, recherche,
 * génération, validation, confirmation par phrase, invalidation de l'aperçu,
 * copie, téléchargement (.ios.txt SANS BOM, LF, ASCII), notes d'exécution IOS
 * (et non PowerShell/Bash), bloc pédagogique Cisco, affichage mobile.
 * CE QU'IL NE PROUVE PAS : l'effet des commandes sur un équipement ou dans
 * Packet Tracer (NON EXÉCUTÉ). Aucune connexion, aucun matériel.
 *
 * Usage : node test/browser-cisco.test.mjs        (exit 0 = tout OK)
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const { tools } = await imp('generators.mjs');
const { normalizeIos, EXECUTION_NOTES_IOS } = await imp('noyau-cisco.mjs');
const { SOUS_RUBRIQUES_CISCO } = await imp('categories.mjs');
const { ECHANTILLONS_NON_CAPTURES: ECH } = await imp('analyse-cisco.mjs');
const { CLE_MODE } = await imp('preferences.mjs');

const CAT = 'Réseau et Cisco';
const cisco = tools.filter((t) => t.category === CAT);
const T = (id) => cisco.find((t) => t.id === id);
// Valeurs nécessaires pour rendre une configuration VALIDE (les défauts ne suffisent pas toujours).
const SPEC = {
  'cisco-identification': { ciscoNouveauNom: 'SW-LAB-02' },
  'cisco-table-mac': { ciscoEffacement: 'interface' },
  'cisco-vtp-configuration': { ciscoVtpRevisionLue: true },
};

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
const attendu = (t, v) => normalizeIos(t.generate(v));

async function ouvrir(tool, { width = 1280, height = 900, mode = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  context.setDefaultTimeout(10000);
  if (mode) await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* sans stockage */ } }, [CLE_MODE, mode]);
  const page = await context.newPage();
  const problemes = [];
  page.on('pageerror', (e) => problemes.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problemes.push('console: ' + m.text()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: BASE }).catch(() => {});
  await page.bringToFront();
  await page.goto(`${BASE}/#/outil/${tool.id}`);
  await page.waitForSelector('#scriptOutput', { timeout: 8000 });
  return { context, page, problemes };
}
const remplir = async (page, id, val) => {
  const el = page.locator(`#${id}`);
  const tag = await el.evaluate((e) => e.tagName);
  const type = await el.evaluate((e) => e.type);
  if (tag === 'SELECT') await el.selectOption(val);
  else if (type === 'checkbox') await el.setChecked(Boolean(val));
  else await el.fill(String(val));
};
const lirePre = (page) => page.$eval('#scriptOutput', (e) => e.textContent);
const desactives = async (page) => ({ copie: await page.locator('#copyButton').isDisabled(), telech: await page.locator('#downloadButton').isDisabled() });
const lignesActives = (s) => s.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('!'));

// ---------------------------------------------------------------------------
console.log('\n[accueil] catégorie, sous-rubriques, recherche');
assert(cisco.length === 19, '19 fiches Cisco dans le catalogue', String(cisco.length));
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const problemes = [];
  page.on('pageerror', (e) => problemes.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('#toolGrid .open-tool');
  assert(await page.locator('#toolGrid .open-tool').count() === tools.length, 'la grille affiche tous les outils du catalogue');
  const cartes = await page.$$eval('#categoryGrid .category-card', (els) => els.map((e) => e.dataset.category));
  assert(cartes.includes(CAT), 'la carte « Réseau et Cisco » est proposée');
  assert(cartes.length === 11, `11 cartes de catégorie (Azure et Imprimantes intégrés), « Tout » comprise (${cartes.length})`);
  await page.click(`#categoryGrid .category-card[data-category="${CAT}"]`);
  await page.waitForTimeout(300);
  assert(await page.locator('#toolGrid .open-tool').count() === 19, 'la catégorie affiche ses 19 outils');
  const txt = await page.$eval('#home', (e) => e.textContent);
  for (const s of SOUS_RUBRIQUES_CISCO) assert(txt.includes(s), `sous-rubrique visible : ${s}`);
  for (const [q, id] of [['trunk', 'cisco-trunk-preparation'], ['vtp', 'cisco-vtp-diagnostic'], ['port-security', 'cisco-port-security-config'], ['dtp', 'cisco-dtp-simulation'], ['sticky', 'cisco-port-security-config'], ['vlan natif', 'cisco-trunk-preparation']]) {
    await page.click('#searchClear').catch(() => {});
    await page.click(`#categoryGrid .category-card[data-category="Tout"]`);
    await page.fill('#search', q);
    await page.waitForTimeout(250);
    const grille = await page.$eval('#toolGrid', (e) => e.textContent);
    assert(grille.includes(T(id).title), `la recherche « ${q} » retrouve ${id}`);
  }
  assert(problemes.length === 0, 'aucune erreur JS sur l’accueil', problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
for (const tool of cisco) {
  console.log(`\n[${tool.id}] route · aperçu · IOS · copie · téléchargement`);
  const { context, page, problemes } = await ouvrir(tool);
  const ref = attendu(tool, defaults(tool));
  assert(await page.locator('#toolView').isVisible(), 'route directe #/outil/<id> : la fiche s’ouvre');
  assert((await lirePre(page)) === ref, 'aperçu initial = normalizeIos(generate(défauts)) octet par octet');
  assert(!/[^\x00-\x7f]/.test(ref) && !ref.includes('?') && !ref.includes('\t') && !ref.includes('\r'), 'aperçu : ASCII, sans « ? », sans tabulation, sans CR');

  const bandeau = await page.$eval('#plateformeBandeau', (e) => e.textContent);
  assert(/Cisco/.test(bandeau) && /Commandes Cisco IOS/.test(bandeau), 'bandeau : plateforme Cisco, sortie « Commandes Cisco IOS »');
  assert(await page.locator('.badge-cisco').count() === 1, 'badge de plateforme Cisco');
  const prereq = await page.$eval('#prereqBlock', (e) => e.textContent);
  assert(tool.prereqs.every((p) => prereq.includes(p)) && tool.os.every((o) => prereq.includes(o)), 'prérequis et systèmes affichés');
  assert(/console de l’équipement/.test(prereq) && !/PowerShell/.test(prereq.replace(/Aucun droit système[^.]*\./, '')) || !/en tant qu’administrateur/.test(prereq), 'aucune demande d’élévation PowerShell');
  assert(await page.locator('.admin-flag.admin-optional').count() === 1, 'badge d’élévation : optionnelle (requiresAdmin=false)');

  assert(await page.locator('#ciscoBloc').count() === 1, 'bloc pédagogique Cisco présent');
  const bloc = await page.$eval('#ciscoBloc', (e) => e.textContent);
  for (const mot of ['Le problème', 'À quoi ça sert', 'Exemple en entreprise', 'À lire avant de modifier', 'Ce que les commandes changent', 'Résultat attendu', 'Limites de cet assistant', 'Ce qui a été validé', 'Matériel de référence', 'C1000-24T-4G-L', 'NON']) {
    assert(bloc.includes(mot), `bloc Cisco : « ${mot} »`);
  }
  assert(tool.cisco.exemple && bloc.includes(tool.cisco.exemple.slice(0, 30)), 'bloc Cisco : l’exemple de la fiche est affiché');

  const exec = await page.$eval('#execNotes', (e) => e.textContent);
  assert(exec.includes('commandes Cisco IOS') && exec.includes('Invalid input detected'), 'notes d’exécution : IOS (aucune stratégie PowerShell)');
  assert(!/Unblock-File|Get-ExecutionPolicy|Set-ExecutionPolicy|chmod \+x|bash -n/.test(exec), 'notes d’exécution : ni PowerShell ni Bash');
  assert(EXECUTION_NOTES_IOS.obstacles.every((o) => exec.includes(o.name)), 'notes d’exécution : tous les obstacles IOS listés');
  const errs = await page.$eval('#commonErrors', (e) => e.textContent);
  assert(tool.commonErrors.every((e) => errs.includes(e.message)) && !errs.includes('signé numériquement'), 'erreurs fréquentes : celles de l’outil, pas celles de PowerShell');
  const soumettre = await page.locator('button[type=submit]').textContent();
  assert(/Générer les commandes/.test(soumettre), 'bouton : « Générer les commandes »');
  const sources = await page.$eval('#officialSources', (e) => e.innerHTML);
  assert(sources.includes('cisco.com') && !sources.includes('learn.microsoft.com'), 'sources : cisco.com, pas Microsoft');

  // Copie (aucune conversion CRLF pour IOS : le texte doit être identique)
  await page.click('#copyButton');
  let presse = null;
  try { presse = await Promise.race([page.evaluate(() => navigator.clipboard.readText()), new Promise((_, rj) => setTimeout(() => rj(new Error('délai dépassé')), 8000))]); } catch (e) { assert(false, 'presse-papiers accessible', e.message); }
  if (presse !== null) assert(presse.replace(/\r/g, '') === ref, 'copie = aperçu (hors CR de plateforme)');
  assert(/Commandes copiées/.test(await page.$eval('#copyFeedback', (e) => e.textContent)), 'retour de copie : « Commandes copiées »');

  // Téléchargement : .ios.txt, SANS BOM, LF, ASCII
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadButton')]);
  assert(dl.suggestedFilename() === `${tool.id}.ios.txt`, 'nom de fichier <id>.ios.txt', dl.suggestedFilename());
  const octets = readFileSync(await dl.path());
  assert(!(octets[0] === 0xEF && octets[1] === 0xBB && octets[2] === 0xBF), 'téléchargement : AUCUN BOM (la console reçoit de l’ASCII)');
  assert(!octets.includes(0x0D) && !octets.includes(0x09) && !octets.includes(0x3F) && octets.every((b) => b === 0x0A || (b >= 0x20 && b < 0x7f)), 'téléchargement : LF seul, ASCII imprimable, ni tabulation ni « ? »');
  assert(octets.toString('latin1') === ref, 'téléchargement : contenu = aperçu');
  assert(problemes.length === 0, 'aucune erreur JS / console', problemes.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('\n[modes] Débutant / Technicien');
for (const mode of ['debutant', 'technicien']) {
  const { context, page } = await ouvrir(T('cisco-trunk-preparation'), { mode });
  const txt = await page.$eval('#modeBlock', (e) => e.textContent);
  const detail = await page.$eval('body', (b) => b.dataset.mode);
  assert(txt.length > 50, `mode ${mode} (${detail}) : bandeau de mode présent`);
  if (detail === 'debutant') {
    assert(/console du commutateur/.test(txt) && !/PowerShell|chmod|sudo|BOM/.test(txt), 'mode Débutant : mode d’emploi IOS, sans PowerShell/Bash');
    assert(/Génère les commandes/.test(txt) && /colle les commandes dans la console/.test(txt), 'mode Débutant : étapes adaptées aux commandes');
  } else {
    assert(/cisco-trunk-preparation/.test(txt) && /Session standard/.test(txt), 'mode Technicien : fiche technique, session standard');
  }
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('\n[validation] champs invalides, hostiles, secrets, invalidation de l’aperçu');
async function essaiInvalide(tool, id, valeur, label, motif, avant = {}) {
  const { context, page } = await ouvrir(tool);
  for (const [k, v] of Object.entries(avant)) await remplir(page, k, v);
  await page.click('button[type=submit]');
  const base = await lirePre(page);
  await remplir(page, id, valeur);
  const d0 = await desactives(page);
  assert(d0.copie && d0.telech, `${label} : copie/téléchargement désactivés dès la modification`);
  await page.click('button[type=submit]');
  const span = page.locator(`#${id}-error`);
  assert(await span.isVisible(), `${label} : message d’erreur affiché`);
  if (motif) assert(motif.test(await span.textContent()), `${label} : message attendu`, await span.textContent());
  assert((await lirePre(page)) === base, `${label} : l’aperçu n’est pas régénéré`);
  const d = await desactives(page);
  assert(d.copie && d.telech, `${label} : copie/téléchargement restent désactivés après refus`);
  assert(await page.locator(`#${id}`).evaluate((e) => e.classList.contains('field-invalid')), `${label} : champ marqué invalide`);
  const t = tool.fields.find((f) => f.id === id);
  await remplir(page, id, String(avant[id] ?? t.default ?? ''));
  await page.click('button[type=submit]');
  assert(!(await span.isVisible()), `${label} : l’erreur disparaît après correction`);
  assert(!(await desactives(page)).copie, `${label} : copie réactivée après correction`);
  await context.close();
}
await essaiInvalide(T('cisco-modes-ios'), 'ciscoCible', 'SW?01', 'point d’interrogation dans le nom', /lettre|interrogation|aide/i);
await essaiInvalide(T('cisco-modes-ios'), 'ciscoCible', 'SW-é', 'accent dans le nom', /ASCII|lettre/i);
await essaiInvalide(T('cisco-modes-ios'), 'ciscoCible', 'SW-01;reload', 'injection ; dans le nom');
await essaiInvalide(T('cisco-interface-etat'), 'ciscoInterface', 'Fa0/1-24', 'plage d’interfaces');
await essaiInvalide(T('cisco-interface-etat'), 'ciscoInterface', 'Gi1/0/7', 'Gi1/0/7 en numérotation Fa0/x');
await essaiInvalide(T('cisco-interface-etat'), 'ciscoDescription', 'lien vers AS1 ? serveur', 'point d’interrogation dans la description', /interrogation|aide/i, { ciscoActionInterface: 'description' });
await essaiInvalide(T('cisco-vlan-creation'), 'ciscoVlan', '1', 'VLAN 1', /VLAN 1/);
await essaiInvalide(T('cisco-vlan-creation'), 'ciscoVlan', '1003', 'VLAN réservé 1003');
await essaiInvalide(T('cisco-vlan-creation'), 'ciscoVlan', '4095', 'VLAN hors plage');
await essaiInvalide(T('cisco-vlan-creation'), 'ciscoVlanNom', 'RH x', 'nom de VLAN avec espace');
await essaiInvalide(T('cisco-trunk-preparation'), 'ciscoVlans', 'all', 'liste « all » sur un trunk', /all/);
await essaiInvalide(T('cisco-trunk-preparation'), 'ciscoVlans', 'none', 'liste « none »');
await essaiInvalide(T('cisco-trunk-preparation'), 'ciscoVlans', 'except 10', 'liste « except »');
await essaiInvalide(T('cisco-trunk-preparation'), 'ciscoNatif', '1002', 'VLAN natif réservé');
await essaiInvalide(T('cisco-vtp-configuration'), 'ciscoVtpDomaine', 'enable secret 5 abc', 'secret dans le domaine VTP');
// VTP version 3 : le sélecteur ne propose que 1 et 2 ; le refus de « 3 » est éprouvé au niveau validate() (test/cisco-assistants.test.mjs).
{
  const { context, page } = await ouvrir(T('cisco-vtp-configuration'));
  const options = await page.$$eval('#ciscoVtpVersion option', (o) => o.map((x) => x.value));
  assert(options.join() === '1,2', `VTP : seules les versions 1 et 2 sont proposées (${options.join()})`);
  await context.close();
}
await essaiInvalide(T('cisco-console-ssh'), 'ciscoUtilisateur', 'admin password cisco123', 'mot de passe dans le nom d’utilisateur', /lettre|secret|mot de passe/i);
await essaiInvalide(T('cisco-gestion-ip'), 'ciscoIp', '192.168.99.0', 'adresse de réseau comme adresse d’hôte');
await essaiInvalide(T('cisco-gestion-ip'), 'ciscoPasserelle', '10.0.0.1', 'passerelle hors sous-réseau');
await essaiInvalide(T('cisco-port-security-config'), 'ciscoMacFixe', 'ffff.ffff.ffff', 'adresse MAC de diffusion');
await essaiInvalide(T('cisco-parcours-diagnostic'), 'ciscoSortieTrunk', 'enable secret 5 $1$abcd$xyz', 'secret collé dans une sortie', /secret|configuration/i);
await essaiInvalide(T('cisco-parcours-diagnostic'), 'ciscoSortieVlan', 'username admin privilege 15 secret 5 x\nline vty 0 4', 'extrait de configuration collé', /configuration|secret/i);

// ---------------------------------------------------------------------------
console.log('\n[confirmations] phrases exactes, aucune modification sans elles');
for (const id of cisco.filter((t) => t.fields.some((f) => f.id === 'ciscoMode')).map((t) => t.id)) {
  const tool = T(id);
  const { context, page } = await ouvrir(tool);
  const sp = SPEC[id] ?? {};
  for (const [k, v] of Object.entries(sp)) await remplir(page, k, v);
  await page.click('button[type=submit]');
  const pre0 = await lirePre(page);
  assert(lignesActives(pre0).every((l) => /^(show|ping|enable|terminal length 0)\b/.test(l)), `${id} : mode Lecture → uniquement des lectures actives`);
  await page.selectOption('#ciscoMode', 'Configuration');
  await page.click('button[type=submit]');
  assert(await page.locator('#ciscoConfirmation-error').isVisible(), `${id} : Configuration sans phrase refusée`);
  assert((await lirePre(page)) === pre0, `${id} : aperçu inchangé après refus`);
  const msg = await page.locator('#ciscoConfirmation-error').textContent();
  const phrase = /« (.+?) »/.exec(msg)?.[1];
  assert(Boolean(phrase), `${id} : la phrase attendue est annoncée`, msg);
  for (const mauvaise of [phrase.toLowerCase(), `${phrase} `, `${phrase}x`, 'CONFIGURER']) {
    await page.fill('#ciscoConfirmation', mauvaise);
    await page.click('button[type=submit]');
    assert(await page.locator('#ciscoConfirmation-error').isVisible(), `${id} : phrase « ${mauvaise} » refusée`);
  }
  await page.fill('#ciscoConfirmation', phrase);
  await page.click('button[type=submit]');
  assert(!(await page.locator('#ciscoConfirmation-error').isVisible()), `${id} : phrase exacte acceptée`);
  const pre1 = await lirePre(page);
  assert(pre1 !== pre0 && pre1 === attendu(tool, { ...defaults(tool), ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, String(v)])), ciscoMode: 'Configuration', ciscoConfirmation: phrase }), `${id} : aperçu de configuration = générateur`);
  assert(lignesActives(pre1).some((l) => /^(configure terminal|copy running-config startup-config|clear )/.test(l)), `${id} : le mode Configuration produit des commandes actives`);
  if (id !== 'cisco-config-sauvegarde') assert(!lignesActives(pre1).some((l) => /^(copy running-config startup-config|write( memory)?)$/.test(l)), `${id} : jamais de sauvegarde persistante cachée`);
  // Présentation « Commandes seules »
  await page.selectOption('#ciscoPresentation', 'Commandes seules');
  await page.click('button[type=submit]');
  assert(!/^!/m.test(await lirePre(page)), `${id} : « Commandes seules » sans ligne de commentaire`);
  // Retour en Lecture avec phrase résiduelle : tolérée seulement si elle correspond à la cible
  await page.selectOption('#ciscoMode', 'Lecture');
  await page.fill('#ciscoConfirmation', 'phrase sans rapport');
  await page.click('button[type=submit]');
  assert(await page.locator('#ciscoConfirmation-error').isVisible(), `${id} : Lecture + phrase sans rapport refusée`);
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('\n[scénarios] DTP, trunk, analyse de sorties collées');
{
  const { context, page } = await ouvrir(T('cisco-dtp-simulation'));
  await page.selectOption('#ciscoDtpLocal', 'auto');
  await page.selectOption('#ciscoDtpDistant', 'auto');
  await page.click('button[type=submit]');
  assert(/ACCESS/.test(await lirePre(page)), 'DTP auto/auto : ACCESS annoncé');
  await page.selectOption('#ciscoDtpDistant', 'desirable');
  await page.click('button[type=submit]');
  assert(/Resultat attendu : TRUNK/.test(await lirePre(page)), 'DTP auto/desirable : TRUNK annoncé');
  await page.selectOption('#ciscoDtpLocal', 'trunk-nonegotiate');
  await page.selectOption('#ciscoDtpDistant', 'auto');
  await page.click('button[type=submit]');
  assert(/INCOHERENT/.test(await lirePre(page)), 'DTP trunk-nonegotiate/auto : INCOHERENT annoncé');
  assert(/rien n a ete lu sur un equipement/.test(await lirePre(page)), 'DTP : la simulation se déclare comme telle');
  await context.close();
}
{
  const { context, page } = await ouvrir(T('cisco-trunk-preparation'));
  await page.selectOption('#ciscoMode', 'Configuration');
  await page.fill('#ciscoConfirmation', 'CONFIGURER FastEthernet0/9');
  await page.fill('#ciscoVlans', '10,20,30');
  await page.click('button[type=submit]');
  let pre = await lirePre(page);
  assert(/^ switchport trunk allowed vlan add 10,20,30$/m.test(pre), 'trunk : « allowed vlan add » généré');
  await page.selectOption('#ciscoTrunkAction', 'retirer');
  await page.click('button[type=submit]');
  pre = await lirePre(page);
  assert(/^ switchport trunk allowed vlan remove 10,20,30$/m.test(pre) && !lignesActives(pre).some((l) => /allowed vlan (?!add |remove )/.test(l)), 'trunk : « remove » généré, jamais de remplacement');
  await page.selectOption('#ciscoMateriel', 'pile');
  await page.click('button[type=submit]');
  assert(await page.locator('#ciscoInterface-error').isVisible(), 'trunk : Fa0/9 refusé en numérotation Gi1/0/x');
  await page.fill('#ciscoInterface', 'Gi1/0/9');
  await page.fill('#ciscoConfirmation', 'CONFIGURER GigabitEthernet1/0/9');
  await page.click('button[type=submit]');
  assert(/^interface GigabitEthernet1\/0\/9$/m.test(await lirePre(page)), 'trunk : Gi1/0/9 accepté, nom long canonique');
  await context.close();
}
{
  const { context, page } = await ouvrir(T('cisco-parcours-diagnostic'));
  await page.selectOption('#ciscoScenario', 'vlan-non-transporte');
  await page.fill('#ciscoVlan', '20');
  await page.fill('#ciscoSortieTrunk', ECH.trunk);
  await page.fill('#ciscoSortieVlan', ECH.vlanBrief);
  await page.click('button[type=submit]');
  const pre = await lirePre(page);
  assert(/ANALYSE DES SORTIES COLLEES/.test(pre) && /VLAN 20 n'est PAS dans les VLAN autorises/.test(pre), 'parcours : analyse du trunk collé affichée');
  assert(/ne vaut pas diagnostic execute/.test(pre), 'parcours : la limite « pas un diagnostic exécuté » est affichée');
  assert(!pre.includes('Compta') || /nom Compta/.test(pre), 'parcours : la sortie collée n’est pas recopiée telle quelle');
  await page.fill('#ciscoSortieTrunk', 'du texte quelconque');
  await page.click('button[type=submit]');
  assert(/NON RECONNU/.test(await lirePre(page)), 'parcours : sortie non reconnue → NON RECONNU, aucun verdict');
  await context.close();
}

// ---------------------------------------------------------------------------
console.log('\n[mobile] 390 × 844');
for (const tool of cisco) {
  const { context, page } = await ouvrir(tool, { width: 390, height: 844 });
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    bloc: !!document.querySelector('#ciscoBloc'),
    btn: document.querySelector('#downloadButton')?.getBoundingClientRect().width ?? 0,
  }));
  assert(m.sw <= m.cw + 1, `${tool.id} : aucun débordement horizontal`, `${m.sw} > ${m.cw}`);
  assert(m.bloc && m.btn > 60, `${tool.id} : bloc Cisco et bouton Télécharger présents`);
  await context.close();
}

await browser.close();
server.close();
console.log('\nSimulateur Packet Tracer : NON EXÉCUTÉ. Commutateur réel : NON EXÉCUTÉ.');
console.log(`Banc navigateur Cisco : ${passed} OK, ${failed} ÉCHEC(S).`);
process.exit(failed ? 1 : 0);
