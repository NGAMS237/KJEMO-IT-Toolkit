#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — GENERATEUR DES MATRICES DE LIVRAISON
//
// Lit le PRODUIT (dist/) et le dossier test/generated/, et ecrit :
//   LOT-7-MATRICE-OUTILS.json            les 153 outils, leurs verrous, leurs sources
//   LOT-7-MATRICE-SCRIPTS.json           les 1224 scripts (880 ps1 + 344 sh), octets, SHA-256
//   LOT-7-MATRICE-COMMANDES-RAPIDES.json les commandes rapides
//   LOT-7-MATRICE-RISQUES.json           risque x plateforme x verrous
//   LOT-7-SOURCES.json                   toutes les URL citees, dedoublonnees
//
// Aucune donnee n'est saisie a la main : une matrice ecrite a la main est une
// matrice qui derive. Le script exige generate-ps1.mjs execute avant lui.
// Aucun horodatage dans les fichiers : deux executions donnent les memes octets
// (le patch et le clone neuf doivent reproduire exactement le meme arbre).
//
// Usage : node test/matrices-lot7.mjs [--sortie <dossier>] [--verifier]
//   --verifier : n'ecrit rien, compare avec les fichiers presents, sort 1 si
//                une matrice a derive.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const args = process.argv.slice(2);
const iSortie = args.indexOf('--sortie');
const SORTIE = iSortie >= 0 ? resolve(args[iSortie + 1]) : ROOT;
const VERIFIER = args.includes('--verifier');

const { tools: catalogueComplet } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
// Les matrices LOT 7 sont une photographie du catalogue tel que le LOT 7 l'a
// livré. Les assistants du LOT 8 (Azure et Entra ID) et de RESEAU-CISCO-01
// (Réseau et Cisco, commandes IOS) et du LOT 9 (Imprimantes) ont leurs propres matrices
// (test/matrices-lot8.mjs, test/matrices-cisco.mjs, test/matrices-lot9.mjs) : on les exclut ICI, on ne
// rafraichit PAS la photographie du LOT 7 pour absorber un autre lot.
const tools = catalogueComplet.filter((t) => t.category !== 'Azure et Entra ID' && t.category !== 'Réseau et Cisco' && t.category !== 'Imprimantes');
const { estBash } = await import(pathToFileURL(resolve(ROOT, 'dist/plateforme.mjs')).href);
const { commandesStockage } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-stockage.mjs')).href);
const { commandesPermissions } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-permissions.mjs')).href);
const { commandesServices } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-services.mjs')).href);
const { commandesReseau } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-reseau.mjs')).href);
const { commandesSsh } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-ssh.mjs')).href);
const { commandesCockpit } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-cockpit.mjs')).href);
const { commandesSamba } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-samba.mjs')).href);
const { commandesSambaAd } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-samba-ad.mjs')).href);
const { commandesNfs } = await import(pathToFileURL(resolve(ROOT, 'dist/commandes-nfs.mjs')).href);

const GEN = resolve(ROOT, 'test/generated');
if (!existsSync(GEN)) { console.error('test/generated absent : lancer node test/generate-ps1.mjs d\'abord.'); process.exit(2); }

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const plateforme = (t) => (estBash(t) ? 'Linux' : (t.platform ?? 'Windows'));

// --- Outils -----------------------------------------------------------------
const outils = tools.map((t) => ({
  id: t.id,
  titre: t.title,
  categorie: t.category,
  sousRubrique: t.subcategory ?? null,
  plateforme: plateforme(t),
  sortie: estBash(t) ? '.sh' : '.ps1',
  risque: t.risk,
  lectureSeule: Boolean(t.readOnly),
  privileges: t.privileges ?? null,
  privilegesRequis: t.privilegesRequis ?? null,
  reversible: t.reversible ?? null,
  champs: (t.fields ?? []).map((f) => ({ id: f.id, type: f.type ?? 'text', facultatif: Boolean(f.optional ?? f.facultatif) })),
  sources: (t.sources ?? (t.source ? [{ url: t.source }] : [])).map((s) => s.url),
})).sort((a, b) => a.id.localeCompare(b.id));

const lot7 = outils.filter((o) => o.plateforme === 'Linux');

// --- Scripts ----------------------------------------------------------------
const idsAzure = new Set(catalogueComplet.filter((t) => t.category === 'Azure et Entra ID' || t.category === 'Imprimantes').map((t) => t.id));
const fichiers = readdirSync(GEN)
  .filter((f) => /\.(ps1|sh)$/.test(f))
  .filter((f) => !idsAzure.has(f.split('__')[0])) // scripts des LOTS 8 et 9 : matrices de ces lots
  .sort();
const scripts = fichiers.map((f) => {
  const buf = readFileSync(join(GEN, f));
  const ext = f.endsWith('.sh') ? 'sh' : 'ps1';
  const [outil, jeu] = f.replace(/\.(ps1|sh)$/, '').split('__');
  return {
    fichier: f, outil, jeuDeDonnees: jeu, extension: ext, octets: buf.length, sha256: sha(buf),
    bom: ext === 'ps1' ? buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf : false,
  };
});

// --- Commandes rapides --------------------------------------------------------
const toutes = [...commandesStockage, ...commandesPermissions, ...commandesServices, ...commandesReseau,
  ...commandesSsh, ...commandesCockpit, ...commandesSamba, ...commandesSambaAd, ...commandesNfs];
const commandes = toutes.map((c) => ({
  id: c.id, notion: c.notion, risque: c.risque, assistant: c.assistant ?? null,
  nombreOptions: (c.options ?? []).length, nombreParametres: (c.parametres ?? []).length,
  retourArriere: Boolean(c.retourArriere), source: c.source ?? null,
  sha256Commande: sha(c.commande),
})).sort((a, b) => a.id.localeCompare(b.id));

// --- Risques ------------------------------------------------------------------
const compte = (liste, cle) => liste.reduce((m, x) => { m[cle(x)] = (m[cle(x)] ?? 0) + 1; return m; }, {});
const risques = {
  outilsParRisque: compte(outils, (o) => o.risque),
  outilsParPlateformeEtRisque: compte(outils, (o) => `${o.plateforme} / ${o.risque}`),
  lot7ParRisque: compte(lot7, (o) => o.risque),
  lot7Modifiants: lot7.filter((o) => o.risque === 'caution' || o.risque === 'destructive').map((o) => ({ id: o.id, risque: o.risque })),
  lot7Diagnostics: lot7.filter((o) => o.risque === 'diagnostic' || o.lectureSeule).map((o) => o.id),
  commandesParRisque: compte(commandes, (c) => c.risque),
};

// --- Sources ------------------------------------------------------------------
const parUrl = new Map();
for (const o of outils) for (const u of o.sources) { if (!parUrl.has(u)) parUrl.set(u, new Set()); parUrl.get(u).add(o.id); }
for (const c of commandes) if (c.source) { if (!parUrl.has(c.source)) parUrl.set(c.source, new Set()); parUrl.get(c.source).add(`commande:${c.id}`); }
const sources = [...parUrl.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  .map(([url, par]) => ({ url, hote: new URL(url).host, citePar: [...par].sort() }));

const ecrire = {
  'LOT-7-MATRICE-OUTILS.json': {
    lot: 'LOT 7 — Linux, Bash, Samba, NFS',
    catalogue: { outilsTotal: outils.length, outilsLinux: lot7.length, outilsWindows: outils.length - lot7.length },
    outils,
  },
  'LOT-7-MATRICE-SCRIPTS.json': {
    lot: 'LOT 7 — Linux, Bash, Samba, NFS',
    total: scripts.length,
    ps1: scripts.filter((s) => s.extension === 'ps1').length,
    sh: scripts.filter((s) => s.extension === 'sh').length,
    tousLesPs1AvecBom: scripts.filter((s) => s.extension === 'ps1').every((s) => s.bom),
    scripts,
  },
  'LOT-7-MATRICE-COMMANDES-RAPIDES.json': { lot: 'LOT 7', total: commandes.length, commandes },
  'LOT-7-MATRICE-RISQUES.json': { lot: 'LOT 7', ...risques },
  'LOT-7-SOURCES.json': { lot: 'LOT 7', total: sources.length, hotes: compte(sources, (s) => s.hote), sources },
};

const ecrireMd = {};
// --- Catalogue Markdown des 46 assistants du lot -----------------------------
const JONCTION = outils.filter((o) => o.sousRubrique === 'Jonction de domaine');
const ORDRE = ['Diagnostic Linux', 'Bash et automatisation', 'Utilisateurs et permissions', 'Services et journaux',
  'Réseau Linux', 'SSH et accès distant', 'Cockpit', 'Samba', 'Samba AD', 'NFS', 'Stockage Linux'];
const parSous = (liste, nom) => liste.filter((o) => o.sousRubrique === nom);
const ligne = (o) => `| \`${o.id}\` | ${o.titre} | ${o.risque} | ${o.sortie} | ${o.privilegesRequis ?? '—'} | ${o.sources.length} |`;
let md = `# Catalogue des 46 assistants du LOT 7

Genere par \`node test/matrices-lot7.mjs\` : ne pas editer a la main (le banc
\`--verifier\` echoue si ce fichier derive).

43 assistants Linux (Bash, \`.sh\`) et 3 assistants de jonction de domaine
(PowerShell, \`.ps1\`, classes dans « Poste de travail Windows »).

Niveaux de risque des fiches : \`diagnostic\` (lecture seule), \`safe\`,
\`caution\` (modifie la machine apres confirmation exacte), \`destructive\`
(peut detruire des donnees). Ubuntu Server reel : NON EXECUTE.
`;
for (const nom of ORDRE) {
  const l = parSous(lot7, nom);
  md += `\n## ${nom} (${l.length})\n\n| Identifiant | Titre | Risque | Sortie | Privileges | Sources |\n|---|---|---|---|---|---|\n${l.map(ligne).join('\n')}\n`;
}
md += `\n## Jonction de domaine — Poste de travail Windows (${JONCTION.length})\n\n| Identifiant | Titre | Risque | Sortie | Privileges | Sources |\n|---|---|---|---|---|---|\n${JONCTION.map(ligne).join('\n')}\n`;
ecrireMd['docs/CATALOGUE-46-ASSISTANTS.md'] = md;

let derive = 0;
for (const [nom, contenu] of Object.entries(ecrire)) {
  const texte = `${JSON.stringify(contenu, null, 2)}\n`;
  const chemin = join(SORTIE, nom);
  if (VERIFIER) {
    const actuel = existsSync(chemin) ? readFileSync(chemin, 'utf8') : null;
    if (actuel !== texte) { derive += 1; console.error(`[ECHEC] ${nom} a derive (ou est absent)`); } else console.log(`[OK]    ${nom}`);
  } else {
    writeFileSync(chemin, texte, 'utf8');
    console.log(`ecrit ${nom}`);
  }
}
for (const [nom, texte] of Object.entries(ecrireMd)) {
  const chemin = join(SORTIE, nom);
  if (VERIFIER) {
    const actuel = existsSync(chemin) ? readFileSync(chemin, 'utf8') : null;
    if (actuel !== texte) { derive += 1; console.error(`[ECHEC] ${nom} a derive (ou est absent)`); } else console.log(`[OK]    ${nom}`);
  } else { writeFileSync(chemin, texte, 'utf8'); console.log(`ecrit ${nom}`); }
}
console.log(`outils=${outils.length} (Linux ${lot7.length}) scripts=${scripts.length} commandes=${commandes.length} sources=${sources.length}`);
process.exit(derive === 0 ? 0 : 1);
