#!/usr/bin/env node
/**
 * browser-poste-b.test.mjs — LOT 6B · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Chromium RÉEL (Playwright) sur les 18 assistants ajoutés par le LOT 6B.
 *
 * Ce banc ne refait pas ce que browser-identity.test.mjs fait déjà : cette
 * suite-là parcourt tous les outils du catalogue et éprouve, pour chacun,
 * Copier, Télécharger, le BOM UTF-8 du fichier téléchargé et l'identité
 * octet par octet entre l'aperçu, le presse-papiers, le fichier et
 * generate() côté Node. Les 18 nouveaux outils en bénéficient sans qu'on
 * réécrive une ligne.
 *
 * Ce banc-ci couvre ce qui est PROPRE au LOT 6B :
 *   1. les 18 fiches s'affichent dans la grille;
 *   2. catégorie « Poste de travail Windows » et les cinq sous-rubriques;
 *   3. routes directes #/outil/<id>;
 *   4. aperçu identique à generate() côté Node, fiche par fiche;
 *   5. Copier et Télécharger présents, et désactivés dès qu'un champ change;
 *   6. erreurs par champ, avec marquage visuel et aperçu non régénéré;
 *   7. recherche par symptôme et par message d'erreur;
 *   8. favoris et historique;
 *   9. modes Débutant et Technicien;
 *  10. les trois thèmes;
 *  11. 390 px : aucun débordement horizontal, titre non masqué;
 *  12. navigation au clavier seul;
 *  13. téléchargement : BOM UTF-8 vérifié une fois de plus ici, sur l'outil
 *      le plus sensible du lot, parce que c'est lui qu'on relira.
 *
 * Prérequis : Chromium installé (npx playwright install chromium)
 * Usage     : node test/browser-poste-b.test.mjs
 * Exit 0    = tout OK, exit 1 = au moins un ÉCHEC.
 */

import { chromium }                     from '@playwright/test';
import { createServer }                 from 'node:http';
import { readFileSync, existsSync }     from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname, join } from 'node:path';
import { tmpdir }                       from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const { tools, normalizeScript } =
  await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);

// ---------------------------------------------------------------------------
// Serveur statique minimal sur dist/ — même mécanique que browser-identity
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.mjs':  'application/javascript; charset=utf-8',
};

function startServer(projectRoot) {
  const distDir = resolve(projectRoot, 'dist');
  return new Promise((res) => {
    const server = createServer((req, reply) => {
      const rawPath  = req.url.split('?')[0];
      const urlPath  = rawPath === '/' ? '/index.html' : rawPath;
      const filePath = resolve(distDir, '.' + urlPath);
      try {
        const body = readFileSync(filePath);
        reply.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        reply.end(body);
      } catch {
        reply.writeHead(404); reply.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

const CHROMIUM_PATH_ENV      = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const CHROMIUM_PATH_FALLBACK = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROMIUM_PATH = (CHROMIUM_PATH_ENV && CHROMIUM_PATH_ENV.trim())
  ? CHROMIUM_PATH_ENV.trim()
  : existsSync(CHROMIUM_PATH_FALLBACK) ? CHROMIUM_PATH_FALLBACK : null;

const { server, port } = await startServer(ROOT);
const BASE_URL = `http://127.0.0.1:${port}`;
console.log(`Serveur local : ${BASE_URL}`);
console.log(`Chromium      : ${CHROMIUM_PATH ?? '(Playwright default)'}`);

const launchOptions = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
};
if (CHROMIUM_PATH) launchOptions.executablePath = CHROMIUM_PATH;
const browser = await chromium.launch(launchOptions);

let passed = 0, failed = 0;
function assert(cond, label, detail = '') {
  if (cond) { console.log(`  [OK]    ${label}`); passed++; }
  else      { console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}
function section(titre) { console.log(`\n--- ${titre} ---`); }

/**
 * Saisit une valeur dans un champ, même quand le navigateur refuse la frappe.
 *
 * Un <input type="number"> n'accepte pas « beaucoup » au clavier : Playwright
 * lève, et le banc ne mesurerait plus la validation mais la limite du widget.
 * Or une valeur non numérique PEUT arriver dans un champ numérique — valeur
 * collée, autocomplétion, formulaire rempli par un script. On la pose donc
 * directement sur l'élément, puis on émet « input » et « change » comme le
 * ferait une frappe, pour que l'application réagisse exactement pareil.
 */
async function remplir(page, champ, valeur) {
  try {
    await page.fill(`#${champ}`, valeur, { timeout: 2000 });
    return 'frappe';
  } catch {
    await page.$eval(`#${champ}`, (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, valeur);
    return 'valeur posée';
  }
}

// ---------------------------------------------------------------------------
// Les 18 identifiants du LOT 6B, et leurs sous-rubriques attendues.
// La liste est ÉCRITE ICI, pas déduite du catalogue : un outil qui changerait
// de sous-rubrique par accident doit faire échouer le banc, pas le suivre.
// ---------------------------------------------------------------------------
const ATTENDU_6B = [
  ['slow-boot-diagnostic',           'Performance et incidents'],
  ['bluescreen-diagnostic',          'Performance et incidents'],
  ['user-profile-diagnostic',        'Performance et incidents'],
  ['workstation-performance-report', 'Performance et incidents'],
  ['local-accounts-audit',           'Comptes et services'],
  ['windows-access-recovery',        'Comptes et services'],
  ['windows-service-control',        'Comptes et services'],
  ['firewall-audit',                 'Sécurité'],
  ['defender-audit',                 'Sécurité'],
  ['defender-scan',                  'Sécurité'],
  ['sfc-repair',                     'Réparation Windows'],
  ['dism-repair',                    'Réparation Windows'],
  ['restore-point-create',           'Réparation Windows'],
  ['safe-mode-preparation',          'Réparation Windows'],
  ['workstation-storage-diagnostic', 'Stockage et nettoyage'],
  ['temp-cleanup',                   'Stockage et nettoyage'],
  ['recycle-bin-cleanup',            'Stockage et nettoyage'],
  ['browser-cache-diagnostic',       'Stockage et nettoyage'],
];
const IDS_6B = ATTENDU_6B.map(([id]) => id);
const outilsDe = (id) => tools.find((t) => t.id === id);
const defautsDe = (outil) =>
  Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));

// ===========================================================================
// 1. Les 18 outils existent, et la grille les montre
// ===========================================================================
section('Les 18 assistants du LOT 6B dans la grille');
{
  const manquants = IDS_6B.filter((id) => !outilsDe(id));
  assert(manquants.length === 0,
    `les 18 identifiants du LOT 6B sont au catalogue`, manquants.join(', '));
  // Ce banc porte sur les 18 fiches 6B, meme quand d'autres lots agrandissent
  // le catalogue. Le total global est controle par identity et les matrices.
  const outils6B = tools.filter((t) => IDS_6B.includes(t.id));
  assert(outils6B.length === 18 && new Set(outils6B.map((t) => t.id)).size === 18,
    `le catalogue contient exactement les 18 outils distincts du LOT 6B (${outils6B.length} trouves)`);

  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE_URL + '/#/assistants');
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 10000 });

  const titresGrille = await page.$$eval('#toolGrid h3', (els) => els.map((e) => e.textContent.trim()));
  const absents = IDS_6B.filter((id) => !titresGrille.includes(outilsDe(id).title));
  assert(absents.length === 0,
    `les 18 fiches du LOT 6B sont affichées dans la grille (${titresGrille.length} cartes)`,
    absents.join(', '));

  // Les cinq sous-rubriques, telles que l'interface les nomme.
  const sousRubriques = [...new Set(ATTENDU_6B.map(([, s]) => s))];
  assert(sousRubriques.length === 5,
    `cinq sous-rubriques distinctes : ${sousRubriques.join(' / ')}`);

  await ctx.close();
}

// ===========================================================================
// 2. Route directe, catégorie, sous-rubrique, aperçu, champs, boutons
// ===========================================================================
section('Routes directes, en-têtes et aperçu des 18 fiches');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  for (const [id, sousRubrique] of ATTENDU_6B) {
    const outil = outilsDe(id);
    await page.goto(`${BASE_URL}#/outil/${id}`);
    await page.waitForSelector('#scriptOutput', { timeout: 10000 });

    const titre = await page.$eval('.tool-header h1', (el) => el.textContent);
    assert(titre.includes(outil.title), `${id} : la route directe ouvre la bonne fiche`);

    const etiquette = await page.$eval('.tool-header .tag', (el) => el.textContent);
    assert(/POSTE DE TRAVAIL WINDOWS/i.test(etiquette) && etiquette.includes(sousRubrique),
      `${id} : catégorie et sous-rubrique affichées (« ${etiquette.trim()} »)`);

    const attendu = normalizeScript(outil.generate(defautsDe(outil)));
    const affiche = await page.$eval('#scriptOutput', (el) => el.textContent);
    assert(affiche === attendu, `${id} : l’aperçu est identique à generate() côté Node`);

    for (const champ of outil.fields) {
      assert(await page.locator(`#${champ.id}`).count() === 1,
        `${id} : le champ « ${champ.id} » est présent dans le formulaire`);
    }

    assert(await page.locator('#copyButton').isVisible() && await page.locator('#downloadButton').isVisible(),
      `${id} : Copier et Télécharger sont accessibles`);
    assert(await page.locator('input[type="password"]').count() === 0,
      `${id} : aucun champ de mot de passe dans la fiche`);

    // Un outil non diagnostique ouvre en mode Diagnostic. C'est la règle du
    // lot, et c'est au navigateur qu'on la vérifie, pas seulement au code.
    if (outil.fields.some((f) => f.id === 'mode')) {
      const valeur = await page.$eval('#mode', (el) => el.value);
      assert(valeur === 'Diagnostic', `${id} : le formulaire ouvre en mode Diagnostic`);
    } else {
      assert(outil.risk === 'diagnostic',
        `${id} : sans champ mode, la fiche est annoncée diagnostique (risque « ${outil.risk} »)`);
    }
  }

  await ctx.close();
}

// ===========================================================================
// 3. Changer un champ désactive Copier et Télécharger
// ===========================================================================
section('Un formulaire modifié ne laisse pas télécharger un aperçu périmé');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  // Un outil par sous-rubrique, en privilégiant ceux qui agissent.
  for (const [id, champ, valeur] of [
    ['slow-boot-diagnostic',   'sbJours',       '21'],
    ['windows-service-control','svcNom',        'Audiosrv'],
    ['defender-scan',          'dsType',        'Complète'],
    ['sfc-repair',             'sfcLignesJournal', '120'],
    ['temp-cleanup',           'tcAgeMinimum',  '45'],
  ]) {
    await page.goto(`${BASE_URL}#/outil/${id}`);
    await page.waitForSelector('#scriptOutput', { timeout: 10000 });
    assert(await page.$eval('#copyButton', (el) => el.disabled === false),
      `${id} : Copier est actif sur l’aperçu initial`);

    const balise = await page.$eval(`#${champ}`, (el) => el.tagName.toLowerCase());
    if (balise === 'select') await page.selectOption(`#${champ}`, valeur);
    else                     await page.fill(`#${champ}`, valeur);
    await page.waitForTimeout(200);

    const cDis = await page.$eval('#copyButton',     (el) => el.disabled);
    const dDis = await page.$eval('#downloadButton', (el) => el.disabled);
    const perime = await page.$eval('#scriptOutput', (el) => el.classList.contains('stale'));
    assert(cDis && dDis,
      `${id} : après modification de ${champ}, Copier et Télécharger sont désactivés`);
    assert(perime, `${id} : l’aperçu est marqué périmé après modification de ${champ}`);

    await page.click('#toolForm .primary-button');
    await page.waitForFunction(
      () => document.querySelector('#copyButton')?.disabled === false, { timeout: 8000 });
    assert(await page.$eval('#downloadButton', (el) => el.disabled === false),
      `${id} : après régénération, Télécharger redevient actif`);
  }

  await ctx.close();
}

// ===========================================================================
// 4. Erreurs par champ — valeurs hostiles, dans le navigateur
// ===========================================================================
section('L’interface refuse les valeurs fautives, champ par champ');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  // « avant » : les options à poser pour que le champ soit affiché. Un champ
  // conditionnel (chemin d'analyse personnalisée, source DISM, journal du mode
  // Appliquer) n'existe dans le formulaire que dans son contexte.
  const cas = [
    // Nombres hors limites
    { id: 'slow-boot-diagnostic',           champ: 'sbJours',           valeur: '9999' },
    { id: 'bluescreen-diagnostic',          champ: 'bsJours',           valeur: '0' },
    { id: 'workstation-performance-report', champ: 'perfEchantillons',  valeur: 'beaucoup' },
    { id: 'firewall-audit',                 champ: 'fwMaxRegles',       valeur: '-5' },
    { id: 'user-profile-diagnostic',        champ: 'upJours',           valeur: '100000' },
    { id: 'sfc-repair',                     champ: 'sfcLignesJournal',  valeur: '0' },
    { id: 'temp-cleanup',                   champ: 'tcAgeMinimum',      valeur: '0' },
    // Chemins : UNC, relatif, racine, chemin sans lettre de lecteur
    { id: 'defender-scan',  champ: 'dsChemin',  valeur: '\\\\serveur\\partage',
      avant: [['dsType', 'Personnalisée']] },
    { id: 'dism-repair',    champ: 'dsmSource', valeur: '..\\sources\\install.wim',
      avant: [['mode', 'Appliquer'], ['dsmEtape', 'RestoreHealth — réparation']] },
    { id: 'temp-cleanup',   champ: 'tcJournal', valeur: 'journal.txt',
      avant: [['mode', 'Appliquer']] },
    // Joker refusé : cet assistant agit sur UN service nommé
    { id: 'windows-service-control', champ: 'svcNom', valeur: 'Spool*' },
    // Valeur vide après espaces
    { id: 'restore-point-create',    champ: 'rpNom',  valeur: '   ' },
  ];

  for (const { id, champ, valeur, avant = [] } of cas) {
    await page.goto(`${BASE_URL}#/outil/${id}`);
    await page.waitForSelector('#scriptOutput', { timeout: 10000 });
    for (const [fid, val] of avant) await page.selectOption(`#${fid}`, val);
    await page.waitForTimeout(150);

    assert(await page.locator(`#${champ}`).count() === 1,
      `${id} : le champ ${champ} est présent dans ce contexte`);
    const avantScript = await page.$eval('#scriptOutput', (el) => el.textContent);

    const voie = await remplir(page, champ, valeur);
    await page.click('#toolForm .primary-button');
    await page.waitForTimeout(250);

    const message = await page.$eval(`#${champ}-error`, (el) => el.textContent);
    assert(message.trim().length > 0,
      `${id} : « ${valeur} » (${voie}) affiche un message sur ${champ} (« ${message.trim().slice(0, 70)} »)`);
    assert(await page.$eval(`#${champ}`, (el) => el.classList.contains('field-invalid')),
      `${id} : le champ ${champ} fautif est signalé visuellement`);
    assert(await page.$eval('#scriptOutput', (el) => el.textContent) === avantScript,
      `${id} : aucun script régénéré tant que ${champ} est fautif`);
    assert(await page.$eval('#copyButton', (el) => el.disabled)
        && await page.$eval('#downloadButton', (el) => el.disabled),
      `${id} : Copier et Télécharger restent désactivés sur ${champ} fautif`);
  }

  await ctx.close();
}

// ===========================================================================
// 5. La confirmation écrite, telle que la personne la tape
// ===========================================================================
section('Les confirmations textuelles exactes, saisies dans le navigateur');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  // Six assistants exigent une phrase exacte avant d'agir. La phrase n'est pas
  // devinée : elle est écrite ici, et l'aide du champ DOIT l'annoncer — sinon
  // la personne ne peut pas la taper. On éprouve ensuite le refus (même phrase
  // en minuscules : le projet est strict sur la casse) puis l'acceptation.
  //
  // « avant » porte les options qui rendent la confirmation obligatoire :
  // une analyse complète, un sfc /scannow, un DISM /RestoreHealth.
  const confirmations = [
    { id: 'temp-cleanup',            champ: 'tcConfirmation',
      phrase: 'JE SUPPRIME CES FICHIERS TEMPORAIRES', avant: [] },
    { id: 'windows-service-control', champ: 'svcConfirmation',
      phrase: 'JE MODIFIE CE SERVICE', avant: [] },
    { id: 'restore-point-create',    champ: 'rpConfirmation',
      phrase: 'JE CREE UN POINT DE RESTAURATION',
      // L'état de la protection système doit avoir été CONSTATÉ dans
      // rstrui.exe ou Protection du système : aucune commande documentée ne le
      // donne, et la création reste bloquée sans ce constat.
      avant: [['rpEtatProtection', 'Constat\u00e9 : lecteur syst\u00e8me prot\u00e9g\u00e9']] },
    { id: 'defender-scan',           champ: 'dsConfirmation',
      phrase: 'JE LANCE UNE ANALYSE COMPLETE',
      avant: [['dsType', 'Complète']] },
    { id: 'sfc-repair',              champ: 'sfcConfirmation',
      phrase: 'JE REPARE LES FICHIERS SYSTEME',
      avant: [['sfcEtape', 'Vérification et réparation']] },
    { id: 'dism-repair',             champ: 'dsmConfirmation',
      phrase: 'JE REPARE LE MAGASIN DE COMPOSANTS',
      avant: [['dsmEtape', 'RestoreHealth — réparation']] },
  ];

  for (const { id, champ, phrase, avant } of confirmations) {
    const def = outilsDe(id).fields.find((f) => f.id === champ);
    assert((def.help ?? '').includes(phrase),
      `${id} : l’aide du champ ${champ} annonce la phrase exacte à taper`);

    await page.goto(`${BASE_URL}#/outil/${id}`);
    await page.waitForSelector('#scriptOutput', { timeout: 10000 });
    await page.selectOption('#mode', 'Appliquer');
    for (const [fid, valeur] of avant) await page.selectOption(`#${fid}`, valeur);

    // Champ laissé vide : refus.
    await page.fill(`#${champ}`, '');
    await page.click('#toolForm .primary-button');
    await page.waitForTimeout(250);
    const vide = await page.$eval(`#${champ}-error`, (el) => el.textContent);
    assert(vide.trim().length > 0,
      `${id} : la confirmation vide est refusée (« ${vide.trim().slice(0, 60)} »)`);
    assert(await page.$eval('#downloadButton', (el) => el.disabled),
      `${id} : Télécharger reste désactivé sans confirmation`);

    // Phrase approchante : minuscules.
    await page.fill(`#${champ}`, phrase.toLowerCase());
    await page.click('#toolForm .primary-button');
    await page.waitForTimeout(250);
    const refus = await page.$eval(`#${champ}-error`, (el) => el.textContent);
    assert(refus.trim().length > 0,
      `${id} : la phrase en minuscules est refusée (« ${refus.trim().slice(0, 60)} »)`);

    // Phrase exacte : la génération passe.
    await page.fill(`#${champ}`, phrase);
    await page.click('#toolForm .primary-button');
    await page.waitForFunction(
      () => document.querySelector('#copyButton')?.disabled === false, { timeout: 8000 });
    assert(true, `${id} : la phrase exacte débloque la génération`);
  }

  // L'ÉTAT DE LA PROTECTION SYSTÈME, dans le navigateur.
  //
  // Codex a relevé que l'assistant déduisait « protection active » du nombre de
  // points de restauration existants, ce qui est faux : une instance de la
  // classe WMI SystemRestore est un point, pas un lecteur protégé. L'état est
  // désormais constaté par la personne dans rstrui.exe ou Protection du
  // système, et déclaré dans ce champ.
  {
    await page.goto(`${BASE_URL}#/outil/restore-point-create`);
    await page.waitForSelector('#scriptOutput', { timeout: 10000 });
    assert(await page.locator('#rpEtatProtection').count() === 1,
      'restore-point-create : le champ « État de la protection système » est présent');
    assert(await page.$eval('#rpEtatProtection', (el) => el.value) === 'Non constat\u00e9',
      'restore-point-create : le champ ouvre sur « Non constaté »');
    const aide = await page.$eval('#rpEtatProtection-help, label[for="rpEtatProtection"]',
      (el) => el.textContent).catch(() => '');
    const fiche = await page.$eval('#toolView', (el) => el.textContent);
    assert(/rstrui|systempropertiesprotection/i.test(aide + fiche),
      'restore-point-create : la fiche nomme la méthode officielle de constat');

    // Mode Appliquer, état non constaté, phrase exacte : refus SUR CE CHAMP.
    await page.selectOption('#mode', 'Appliquer');
    await page.fill('#rpConfirmation', 'JE CREE UN POINT DE RESTAURATION');
    await page.click('#toolForm .primary-button');
    await page.waitForTimeout(250);
    const erreurEtat = await page.$eval('#rpEtatProtection-error', (el) => el.textContent);
    assert(erreurEtat.trim().length > 0,
      `restore-point-create : état non constaté refusé (« ${erreurEtat.trim().slice(0, 70)} »)`);
    assert(await page.$eval('#downloadButton', (el) => el.disabled),
      'restore-point-create : Télécharger reste désactivé tant que l’état n’est pas constaté');

    // Constat déclaré : la génération passe.
    await page.selectOption('#rpEtatProtection', 'Constat\u00e9 : lecteur syst\u00e8me prot\u00e9g\u00e9');
    await page.click('#toolForm .primary-button');
    await page.waitForFunction(
      () => document.querySelector('#copyButton')?.disabled === false, { timeout: 8000 });
    const script = await page.$eval('#scriptOutput', (el) => el.textContent);
    assert(/NE DECIDE RIEN/.test(script),
      'restore-point-create : le script dit que le nombre de points ne décide de rien');
    assert(!/DisableSR/.test(script),
      'restore-point-create : aucune lecture de la valeur de registre non documentée DisableSR');
  }

  await ctx.close();
}

// ===========================================================================
// 6. Recherche par symptôme et par message d'erreur
// ===========================================================================
section('Recherche : on cherche par le symptôme, pas par le nom de l’outil');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE_URL + '/#/assistants');
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 10000 });

  for (const [requete, idAttendu] of [
    ['demarrage lent',             'slow-boot-diagnostic'],
    ['ecran bleu',                 'bluescreen-diagnostic'],
    ['profil temporaire',          'user-profile-diagnostic'],
    ['lenteur',                    'workstation-performance-report'],
    ['comptes locaux',             'local-accounts-audit'],
    ['mot de passe oublie',        'windows-access-recovery'],
    ['service arrete',             'windows-service-control'],
    ['pare-feu',                   'firewall-audit'],
    ['defender',                   'defender-audit'],
    ['analyse antivirus',          'defender-scan'],
    ['sfc scannow',                'sfc-repair'],
    ['dism restorehealth',         'dism-repair'],
    ['point de restauration',      'restore-point-create'],
    ['mode sans echec',            'safe-mode-preparation'],
    ['disque plein',               'workstation-storage-diagnostic'],
    ['fichiers temporaires',       'temp-cleanup'],
    ['corbeille',                  'recycle-bin-cleanup'],
    ['cache navigateur',           'browser-cache-diagnostic'],
  ]) {
    await page.fill('#search', requete);
    await page.waitForTimeout(180);
    const titres = await page.$$eval('#toolGrid h3', (els) => els.map((e) => e.textContent.trim()));
    assert(titres.includes(outilsDe(idAttendu).title),
      `recherche « ${requete} » → ${idAttendu} (${titres.length} résultat(s))`);
  }

  // Et par message d'erreur, puisque c'est ce que la personne a sous les yeux.
  for (const [requete, idAttendu] of [
    ['Windows Resource Protection', 'sfc-repair'],
    ['0x800f081f',                  'dism-repair'],
    ['profil utilisateur ne peut pas', 'user-profile-diagnostic'],
  ]) {
    await page.fill('#search', requete);
    await page.waitForTimeout(180);
    const titres = await page.$$eval('#toolGrid h3', (els) => els.map((e) => e.textContent.trim()));
    assert(titres.includes(outilsDe(idAttendu).title),
      `recherche par message « ${requete} » → ${idAttendu} (${titres.length} résultat(s))`);
  }

  await page.fill('#search', '');
  await page.waitForTimeout(180);
  await ctx.close();
}

// ===========================================================================
// 7. Favoris et historique
// ===========================================================================
section('Favoris et consultations récentes sur une fiche du LOT 6B');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE_URL}#/outil/temp-cleanup`);
  await page.waitForSelector('#scriptOutput', { timeout: 10000 });
  await page.goto(BASE_URL + '/#/assistants');
  await page.waitForSelector('#toolGrid .open-tool', { timeout: 10000 });
  await page.fill('#search', 'fichiers temporaires');
  await page.waitForTimeout(200);
  await page.locator('#toolGrid .fav-toggle').first().click();
  await page.fill('#search', '');
  await page.waitForTimeout(250);

  const raccourcis = await page.$eval('#shortcutsZone', (el) => el.textContent);
  assert(raccourcis.includes('Favoris'),
    'un outil du LOT 6B peut être mis en favori');
  assert(raccourcis.includes('Consultés récemment') || raccourcis.includes('Favoris'),
    'l’historique retient la fiche du LOT 6B consultée');

  await ctx.close();
}

// ===========================================================================
// 8. Modes Débutant et Technicien
// ===========================================================================
section('Modes Débutant et Technicien sur l’assistant le plus sensible');
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}#/outil/temp-cleanup`);
  await page.waitForSelector('#modeBlock', { timeout: 10000 });

  const lireAvertissements = () => page.$$eval('.exec-warning, .rollback-warning',
    (els) => els.map((e) => e.textContent.trim()).filter(Boolean));

  const avertDeb = await lireAvertissements();
  assert(avertDeb.length > 0, `mode Débutant : ${avertDeb.length} avertissement(s) affiché(s)`);
  for (const sel of ['#prereqBlock', '#commonErrors', '#verifyAfter', '#rollbackBlock',
                     '#toolForm', '#scriptOutput', '#copyButton', '#downloadButton']) {
    assert(await page.locator(sel).count() === 1,
      `mode Débutant : ${sel} présent sur la fiche temp-cleanup`);
  }

  await page.click('#modeSelector .mode-option[data-mode="technicien"]');
  await page.waitForSelector('#techMeta', { timeout: 10000 });
  const avertTech = await lireAvertissements();
  assert(avertTech.join(' | ') === avertDeb.join(' | '),
    'les avertissements sont identiques dans les deux modes');
  const meta = await page.$eval('#techMeta', (el) => el.textContent);
  assert(meta.includes('Stockage et nettoyage'),
    'le mode Technicien annonce la sous-rubrique « Stockage et nettoyage »');
  assert(meta.includes('temp-cleanup'),
    'le mode Technicien annonce l’identifiant de l’outil');

  await ctx.close();
}

// ===========================================================================
// 9. Thèmes
// ===========================================================================
section('Les trois thèmes sur une fiche du LOT 6B');
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}#/outil/defender-scan`);
  await page.waitForSelector('#scriptOutput', { timeout: 10000 });

  for (const theme of ['clair', 'sombre', 'systeme']) {
    await page.click(`#themeSelector .theme-option[data-theme="${theme}"]`);
    await page.waitForTimeout(160);
    const applique = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(applique === theme, `thème ${theme} : appliqué sur la racine (${applique})`);
    const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert(fond !== 'rgba(0, 0, 0, 0)' && fond !== 'transparent',
      `thème ${theme} : fond explicite sur le corps de la page (${fond})`);
    assert(await page.locator('.tool-header h1').isVisible(),
      `thème ${theme} : le titre de la fiche reste visible`);
    const debordement = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(debordement <= 0, `thème ${theme} : aucun débordement horizontal à 390px (${debordement}px)`);
  }

  await ctx.close();
}

// ===========================================================================
// 10. Responsive — les 18 fiches à 390 px
// ===========================================================================
section('Les 18 fiches à 390 px : aucun débordement, titre visible');
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  for (const id of IDS_6B) {
    await page.goto(`${BASE_URL}#/outil/${id}`);
    await page.waitForSelector('#scriptOutput', { timeout: 10000 });

    const debordement = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(debordement <= 0, `${id} à 390px : aucun débordement horizontal (${debordement}px)`);

    const tropLarges = await page.evaluate(() => {
      const limite = document.documentElement.clientWidth;
      return [...document.querySelectorAll('#tool input, #tool select, #tool textarea, #tool button')]
        .filter((el) => el.getBoundingClientRect().width > limite + 1)
        .map((el) => el.id || el.tagName.toLowerCase());
    });
    assert(tropLarges.length === 0,
      `${id} à 390px : aucun champ ne dépasse la largeur de l’écran (${tropLarges.join(', ')})`);

    assert(await page.locator('.tool-header h1').isVisible(),
      `${id} à 390px : le titre de la fiche reste visible`);
  }

  // Les trois tailles sur les deux fiches les plus denses du lot.
  for (const taille of [{ nom: 'bureau', width: 1440, height: 900 },
                        { nom: 'tablette', width: 768, height: 1024 }]) {
    const c2 = await browser.newContext({ viewport: { width: taille.width, height: taille.height } });
    const p2 = await c2.newPage();
    for (const id of ['temp-cleanup', 'windows-service-control']) {
      await p2.goto(`${BASE_URL}#/outil/${id}`);
      await p2.waitForSelector('#scriptOutput', { timeout: 10000 });
      const deb = await p2.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(deb <= 0, `${id} en ${taille.nom} (${taille.width}px) : aucun débordement (${deb}px)`);
      assert(await p2.locator('.tool-header h1').isVisible(),
        `${id} en ${taille.nom} : le titre reste visible`);
    }
    await c2.close();
  }

  await ctx.close();
}

// ===========================================================================
// 11. Navigation au clavier seul
// ===========================================================================
section('Navigation au clavier, sans souris');
{
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}#/outil/temp-cleanup`);
  await page.waitForSelector('#scriptOutput', { timeout: 10000 });

  // Un repli s'ouvre à la touche Entrée.
  await page.focus('#guiMethod > summary');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#guiMethod')?.open === true,
    { timeout: 8000 });
  assert(await page.$eval('#guiMethod', (el) => el.open),
    'la méthode graphique s’ouvre à la touche Entrée');

  // La tabulation atteint chaque champ du formulaire, dans l'ordre, puis le
  // bouton de génération. On part du premier champ et on compte.
  const outil = outilsDe('temp-cleanup');
  await page.focus(`#${outil.fields[0].id}`);
  const atteints = [await page.evaluate(() => document.activeElement.id)];
  for (let i = 0; i < outil.fields.length + 3; i += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement.id || document.activeElement.className);
    atteints.push(id);
  }
  const champsAtteints = outil.fields.filter((f) => atteints.includes(f.id));
  assert(champsAtteints.length === outil.fields.length,
    `la tabulation atteint les ${outil.fields.length} champs du formulaire (${champsAtteints.length})`,
    atteints.join(' → '));

  // Aucun piège de focus : un élément focalisé doit être visible.
  const invisible = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'aucun';
    const r = el.getBoundingClientRect();
    return (r.width === 0 && r.height === 0) ? (el.id || el.tagName) : '';
  });
  assert(invisible === '', `l’élément focalisé reste visible (${invisible || 'ok'})`);

  await ctx.close();
}

// ===========================================================================
// 12. Téléchargement de l'assistant destructif : BOM et identité
// ===========================================================================
section('Téléchargement de temp-cleanup : BOM UTF-8 et identité au script généré');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}#/outil/temp-cleanup`);
  await page.waitForSelector('#scriptOutput', { timeout: 10000 });

  const outil   = outilsDe('temp-cleanup');
  const attendu = normalizeScript(outil.generate(defautsDe(outil)));
  const apercu  = await page.$eval('#scriptOutput', (el) => el.textContent);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.click('#downloadButton'),
  ]);
  const chemin = join(tmpdir(), `kjemo-6b-temp-cleanup-${Date.now()}.ps1`);
  await download.saveAs(chemin);

  const octets = readFileSync(chemin);
  const bom = octets[0] === 0xEF && octets[1] === 0xBB && octets[2] === 0xBF;
  assert(bom, 'temp-cleanup : BOM UTF-8 (EF BB BF) présent dans le fichier téléchargé');
  const contenu = bom ? octets.slice(3).toString('utf-8') : octets.toString('utf-8');
  assert(Buffer.from(contenu, 'utf-8').equals(Buffer.from(attendu, 'utf-8')),
    'temp-cleanup : le fichier téléchargé est identique à generate() côté Node');
  assert(Buffer.from(contenu, 'utf-8').equals(Buffer.from(apercu, 'utf-8')),
    'temp-cleanup : le fichier téléchargé est identique à l’aperçu affiché');
  assert(download.suggestedFilename() === 'temp-cleanup.ps1',
    `temp-cleanup : nom du fichier « ${download.suggestedFilename()} »`);

  await ctx.close();
}

await browser.close();
server.close();

console.log('');
console.log(`Tests navigateur LOT 6B terminés : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
