#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 8 — GENERATEUR DES MATRICES DE LIVRAISON (Azure et Microsoft Entra ID)
//
// Lit le PRODUIT (dist/) et test/generated/, et ecrit :
//   LOT-8-MATRICE-OUTILS.json    les 24 assistants Azure : risque, champs,
//                                commandes declarees, portee, scopes Graph,
//                                actions -WhatIf, sources
//   LOT-8-MATRICE-SCRIPTS.json   les scripts Azure generes (octets, SHA-256, BOM)
//   LOT-8-MATRICE-COMMANDES.json commandes Az / Microsoft.Graph effectivement
//                                presentes dans les scripts, rapprochees des
//                                listes CMDLETS_EXTERNES / CMDLETS_INTERDITES
//   docs/CATALOGUE-24-ASSISTANTS-AZURE.md
//
// Les matrices du LOT 7 gardent leur perimetre (153 outils / 1224 scripts) :
// ce banc ne touche PAS a LOT-7-*. Rien n'est saisi a la main, aucun horodatage :
// deux executions donnent les memes octets.
//
// Usage : node test/matrices-lot8.mjs [--sortie <dossier>] [--verifier]
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const iSortie = args.indexOf('--sortie');
const SORTIE = iSortie >= 0 ? resolve(args[iSortie + 1]) : ROOT;
const VERIFIER = args.includes('--verifier');

const imp = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { tools: catalogue } = await imp('dist/generators.mjs');
const { CMDLETS_EXTERNES, CMDLETS_INTERDITES } = await imp('dist/cmdlets.mjs');
const { VERSION_AZURE } = await imp('dist/noyau-azure.mjs');

const GEN = resolve(ROOT, 'test/generated');
if (!existsSync(GEN)) { console.error('test/generated absent : lancer node test/generate-ps1.mjs d\'abord.'); process.exit(2); }
const sha = (b) => createHash('sha256').update(b).digest('hex');

const azure = catalogue.filter((t) => t.category === 'Azure et Entra ID');
const ids = new Set(azure.map((t) => t.id));
const WHATIF = new Set(['Start-AzVM', 'Stop-AzVM', 'Restore-AzRecoveryServicesBackupItem']);

const RE_CMDLET = /\b([A-Z][a-z]+-(?:Az|Mg)[A-Za-z]+)\b/g;
const defauts = (t) => Object.fromEntries(t.fields.map((f) => [f.id, f.type === 'checkbox' ? Boolean(f.default) : String(f.default ?? '')]));
const cmdletsDe = (texte) => [...new Set([...texte.matchAll(RE_CMDLET)].map((m) => m[1]))].sort();

const fichiers = readdirSync(GEN).filter((f) => /\.ps1$/.test(f) && ids.has(f.split('__')[0])).sort();
const scripts = fichiers.map((f) => {
  const buf = readFileSync(join(GEN, f));
  const [outil, jeu] = f.replace(/\.ps1$/, '').split('__');
  return { fichier: f, outil, jeuDeDonnees: jeu, octets: buf.length, sha256: sha(buf),
    bom: buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf };
});

const outils = azure.map((t) => {
  const texte = t.generate(defauts(t));
  const utilisees = cmdletsDe(texte);
  return {
    id: t.id, titre: t.title, sousRubrique: t.subcategory, risque: t.risk,
    lectureSeule: Boolean(t.readOnly), plateforme: t.platform, sortie: t.output,
    champs: t.fields.map((f) => ({ id: f.id, type: f.type ?? 'text', facultatif: Boolean(f.optional ?? f.facultatif ?? f.optionnel) })),
    portee: t.portee ?? null, scopesGraph: t.scopesGraph ?? null,
    commandesObligatoires: (t.commandes?.obligatoires ?? []).slice().sort(),
    commandesFacultatives: (t.commandes?.facultatives ?? []).slice().sort(),
    cmdletsDansLeScript: utilisees,
    actionsWhatIf: utilisees.filter((c) => WHATIF.has(c)),
    sources: (t.sources ?? [{ url: t.source }]).map((s) => s.url),
    moteursAnnonces: t.cloud?.moteurs ?? null,
  };
}).sort((a, b) => a.id.localeCompare(b.id));

const toutes = new Set(outils.flatMap((o) => o.cmdletsDansLeScript));
const commandes = [...toutes].sort().map((c) => ({
  commande: c,
  declaree: Object.prototype.hasOwnProperty.call(CMDLETS_EXTERNES, c),
  interdite: Object.prototype.hasOwnProperty.call(CMDLETS_INTERDITES, c),
  module: CMDLETS_EXTERNES[c]?.module ?? null,
  doc: CMDLETS_EXTERNES[c]?.doc ?? null,
  utiliseePar: outils.filter((o) => o.cmdletsDansLeScript.includes(c)).map((o) => o.id),
  supporteWhatIf: WHATIF.has(c),
}));

const compte = (l, f) => l.reduce((m, x) => { m[f(x)] = (m[f(x)] ?? 0) + 1; return m; }, {});
const ecrire = {
  'LOT-8-MATRICE-OUTILS.json': { lot: VERSION_AZURE, total: outils.length,
    parSousRubrique: compte(outils, (o) => o.sousRubrique), parRisque: compte(outils, (o) => o.risque),
    lectureSeule: outils.filter((o) => o.lectureSeule).length, outils },
  'LOT-8-MATRICE-SCRIPTS.json': { lot: VERSION_AZURE, total: scripts.length, tousAvecBom: scripts.every((s) => s.bom), scripts },
  'LOT-8-MATRICE-COMMANDES.json': { lot: VERSION_AZURE, total: commandes.length,
    toutesDeclarees: commandes.every((c) => c.declaree), aucuneInterdite: commandes.every((c) => !c.interdite), commandes },
};

const ORDRE = [...new Set(outils.map((o) => o.sousRubrique))];
let md = `# Catalogue des ${outils.length} assistants Azure et Microsoft Entra ID (LOT 8)

Genere par \`node test/matrices-lot8.mjs\` : ne pas editer a la main (le mode
\`--verifier\` echoue si ce fichier derive).

Tous produisent un script PowerShell (\`.ps1\`, Windows PowerShell 5.1 et
PowerShell 7). Ils **ne se connectent jamais** : la personne ouvre sa session
(\`Connect-AzAccount\`, \`Connect-MgGraph\`) elle-meme. Trois seulement agissent
(demarrer, arreter, restaurer) et seulement apres une phrase de confirmation
exacte ; les autres sont en lecture seule. Aucun essai reel sur un tenant :
NON EXECUTE.
`;
for (const nom of ORDRE) {
  const l = outils.filter((o) => o.sousRubrique === nom);
  md += `\n## ${nom} (${l.length})\n\n| Identifiant | Titre | Risque | Lecture seule | Action \`-WhatIf\` |\n|---|---|---|---|---|\n`
    + l.map((o) => `| \`${o.id}\` | ${o.titre} | ${o.risque} | ${o.lectureSeule ? 'oui' : 'non'} | ${o.actionsWhatIf.join(', ') || '—'} |`).join('\n') + '\n';
}
const ecrireMd = { 'docs/CATALOGUE-24-ASSISTANTS-AZURE.md': md };

let derive = 0;
const verif = (nom, texte) => {
  const chemin = join(SORTIE, nom);
  if (VERIFIER) {
    const actuel = existsSync(chemin) ? readFileSync(chemin, 'utf8') : null;
    if (actuel !== texte) { derive += 1; console.error(`[ECHEC] ${nom} a derive (ou est absent)`); } else console.log(`[OK]    ${nom}`);
  } else { writeFileSync(chemin, texte, 'utf8'); console.log(`ecrit ${nom}`); }
};
for (const [nom, contenu] of Object.entries(ecrire)) verif(nom, `${JSON.stringify(contenu, null, 2)}\n`);
for (const [nom, texte] of Object.entries(ecrireMd)) verif(nom, texte);
if (!ecrire['LOT-8-MATRICE-COMMANDES.json'].toutesDeclarees) { derive += 1; console.error('[ECHEC] une commande Az/Mg utilisee n\'est pas declaree dans CMDLETS_EXTERNES'); }
if (!ecrire['LOT-8-MATRICE-COMMANDES.json'].aucuneInterdite) { derive += 1; console.error('[ECHEC] une commande interdite figure dans un script'); }
console.log(`outils=${outils.length} scripts=${scripts.length} commandes=${commandes.length}`);
process.exit(derive === 0 ? 0 : 1);
