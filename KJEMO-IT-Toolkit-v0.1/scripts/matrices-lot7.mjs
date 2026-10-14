/**
 * matrices-lot7.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Genere les matrices de livraison A PARTIR DU CODE, jamais d'une saisie a la
 * main : une matrice recopiee divergera du catalogue au premier changement, et
 * personne ne s'en apercevra avant la revue suivante.
 *
 * Ce fichier a vecu dans /tmp pendant les six premiers commits du LOT 7, comme
 * la baseline des 856. Meme defaut, meme correction : il entre dans le depot,
 * ou il peut etre relu, critique et rejoue par quelqu'un d'autre que moi.
 *
 *     node scripts/matrices-lot7.mjs <racine-projet> <dossier-sortie> [sha-final]
 *
 * PORTEE DE LA MATRICE DES SCRIPTS
 *
 * Elle couvre les 936 fichiers generes : les 856 .ps1 ET les 80 .sh. La
 * premiere version n'enumerait que les 80 .sh tout en annoncant
 * « totalPs1: 856 » : un lecteur ouvrant « la matrice des scripts » en
 * trouvait 80 sur 936. Le titre promettait ce que le contenu ne tenait pas.
 *
 * La non-regression des 856 est, elle, prouvee separement et automatiquement
 * par test/baseline-856.test.mjs, joue dans les deux workflows. Une matrice
 * decrit ; un banc refuse. Les deux sont necessaires et aucun ne remplace
 * l'autre.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(process.argv[2]);
const OUT = resolve(process.argv[3]);
const SHA_BASE = 'aff0f7a146076f2ee1cf1e621efdde775ea3e9e2';
const SHA_FINAL = process.argv[4] ?? '(non fourni)';

const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const p = await import(pathToFileURL(resolve(ROOT, 'dist/plateforme.mjs')).href);
const { SOUS_RUBRIQUES_LINUX, categoriesVisibles, categoriesEnAttente } =
  await import(pathToFileURL(resolve(ROOT, 'dist/categories.mjs')).href);
const { PREFIXES_SOURCES_LINUX, editeurDe } =
  await import(pathToFileURL(resolve(ROOT, 'dist/sources-linux.mjs')).href);

const CAT = 'Linux et services réseau';
const linux = tools.filter((t) => t.category === CAT);
const genere = new Date().toISOString();
const commun = { genere, shaBase: SHA_BASE, shaFinal: SHA_FINAL };

// --- 1. Matrice des outils -------------------------------------------------
const parSous = {};
for (const sr of SOUS_RUBRIQUES_LINUX) {
  const n = linux.filter((t) => t.subcategory === sr).length;
  parSous[sr] = n;
}
const matriceOutils = {
  ...commun,
  lot: 'LOT 7 — Linux et services réseau',
  avertissement: 'LIVRAISON PARTIELLE : 10 des 46 assistants de la portée révisée. Voir le rapport.',
  catalogue: {
    outilsTotal: tools.length,
    outilsAvantLot7: tools.length - linux.length,
    outilsLinux: linux.length,
    outilsLinuxPrevus: 46,
    noteDePortee: 'Le jalon historique de 32 assistants n’est plus canonique : voir LOT-7-MATRICE-ECART.md, §2 et §3.',
    categoriesVisiblesAvantLot7: 6,
    categoriesVisiblesApres: categoriesVisibles(tools).length,
    categoriesEnAttente: categoriesEnAttente(tools).map((c) => c.name),
    categorieCanonique: CAT,
    sousRubriquesPrevues: SOUS_RUBRIQUES_LINUX,
    sousRubriquesPeuplees: Object.entries(parSous).filter(([, n]) => n > 0).map(([k]) => k),
    parSousRubrique: parSous,
  },
  plateformes: tools.reduce((a, t) => {
    const k = p.plateformeDe(t);
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {}),
  sorties: tools.reduce((a, t) => {
    const k = p.sortieDe(t);
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {}),
  outils: linux.map((t) => ({
    id: t.id,
    sousRubrique: t.subcategory,
    titre: t.title,
    risque: t.risk,
    plateforme: p.plateformeDe(t),
    sortie: p.sortieDe(t),
    lectureSeule: p.estLectureSeule(t),
    privileges: t.privileges,
    service: t.service ?? null,
    requiresAdmin: t.requiresAdmin,
    champs: t.fields.length,
    champsOptionnels: t.fields.filter((f) => f.optionnel === true).map((f) => f.id),
    distros: t.distros,
    paquets: t.packages,
    limites: t.limites,
    nbGui: t.gui.length,
    nbVerifications: t.verifyAfter.length,
    nbControles: t.checks.length,
    nbErreurs: t.commonErrors.length,
    nbMotsCles: t.keywords.length,
    nbSources: t.sources.length,
  })),
};

// --- 2. Matrice des scripts ------------------------------------------------
const DIR = resolve(ROOT, 'test/generated');
const fichiers = existsSync(DIR) ? readdirSync(DIR) : [];
const sh = fichiers.filter((f) => f.endsWith('.sh')).sort();
const ps1 = fichiers.filter((f) => f.endsWith('.ps1')).sort();
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

const empreinte = (f) => createHash('sha256').update(readFileSync(join(DIR, f))).digest('hex');

/**
 * Decrit UN fichier genere, quelle que soit sa plateforme.
 *
 * Le shebang n'est releve que pour les .sh : un .ps1 n'en a pas, et inscrire
 * « shebang: '#Requires -Version 5.1' » dans une colonne shebang serait une
 * fausse donnee presentee dans une matrice de preuve.
 */
const decrire = (f) => {
  const o = readFileSync(join(DIR, f));
  const t = o.toString('utf8');
  const estSh = f.endsWith('.sh');
  const ligne1 = t.split('\n')[0];
  return {
    fichier: f,
    outil: f.split('__')[0],
    jeu: f.split('__')[1]?.replace(/\.(sh|ps1)$/, ''),
    sortie: estSh ? '.sh' : '.ps1',
    octets: o.length,
    lignes: t.split('\n').length,
    sha256: empreinte(f),
    bom: o.subarray(0, 3).equals(BOM),
    cr: o.includes(0x0D),
    shebang: estSh ? ligne1 : null,
    finitParLf: t.endsWith('\n'),
  };
};

const scriptsSh = sh.map(decrire);
const scriptsPs1 = ps1.map(decrire);
const scriptsTous = [...scriptsPs1, ...scriptsSh].sort((a, b) => a.fichier.localeCompare(b.fichier));
const empreintesSh = new Set(scriptsSh.map((s) => s.sha256));
const baseline712 = JSON.parse(readFileSync(resolve(ROOT, 'test/scripts-baseline-712.json'), 'utf8'));
const attendus = baseline712.sha256 ?? {};
let identiques = 0;
let ecarts = 0;
for (const f of ps1) {
  if (attendus[f] === undefined) continue;
  if (attendus[f] === empreinte(f)) identiques += 1; else ecarts += 1;
}
const matriceScripts = {
  ...commun,
  avertissement: matriceOutils.avertissement,
  totalPs1: ps1.length,
  totalSh: sh.length,
  ps1AvecBom: ps1.filter((f) => readFileSync(join(DIR, f)).subarray(0, 3).equals(BOM)).length,
  shAvecBom: scriptsSh.filter((s) => s.bom).length,
  shAvecCr: scriptsSh.filter((s) => s.cr).length,
  shShebangExact: scriptsSh.filter((s) => s.shebang === '#!/usr/bin/env bash').length,
  shFinissentParLf: scriptsSh.filter((s) => s.finitParLf).length,
  reference712Identiques: identiques,
  reference712Ecarts: ecarts,
  empreintesDistinctesSh: empreintesSh.size,
  collisionsSh: scriptsSh.length - empreintesSh.size,
  portee: 'COMPLETE : les 936 fichiers generes, 856 .ps1 et 80 .sh. '
    + 'La non-regression des 856 est prouvee separement et automatiquement '
    + 'par test/baseline-856.test.mjs, joue dans les deux workflows.',
  total: scriptsTous.length,
  scripts: scriptsTous,
};

// --- 3. Matrice des risques ------------------------------------------------
const DANGERS = [
  ['rm -rf', /\brm\s+-[a-z]*r[a-z]*f\b|\brm\s+-[a-z]*f[a-z]*r\b/],
  ['rm', /\brm\s/],
  ['rmdir', /\brmdir\b/],
  ['dd vers un peripherique', /\bdd\b[^\n]*of=\/dev\//],
  ['mkfs', /\bmkfs(\.|\s)/],
  ['wipefs', /\bwipefs\b/],
  ['fdisk / parted / sfdisk en ecriture', /\b(fdisk|parted|sfdisk)\b/],
  ['chmod -R', /\bchmod\s+(-[a-zA-Z]*\s+)*-R\b|\bchmod\s+-R\b/],
  ['chown -R', /\bchown\s+(-[a-zA-Z]*\s+)*-R\b|\bchown\s+-R\b/],
  ['setfacl -R', /\bsetfacl\b[^\n]*-R\b/],
  ['sed -i', /\bsed\s+(-[a-zA-Z]*\s+)*-i\b|\bsed\s+-i\b/],
  ['redirection vers /etc', />\s*\/etc\//],
  ['tee vers /etc', /\btee\b[^\n]*\/etc\//],
  ['iptables -F', /\biptables\b[^\n]*-F\b/],
  ['nft flush ruleset', /\bnft\b[^\n]*flush\s+ruleset/],
  ['ufw reset ou disable', /\bufw\s+(reset|disable)\b/],
  ['userdel / groupdel', /\b(userdel|groupdel)\b/],
  ['suppression de cle SSH', /\brm\b[^\n]*(authorized_keys|id_rsa|id_ed25519)/],
  ['ecriture dans passwd/shadow/sudoers', /(>|tee)[^\n]*\/etc\/(passwd|shadow|sudoers)/],
  ['systemctl disable --now', /\bsystemctl\b[^\n]*disable\s+--now/],
  ['telechargement puis execution', /\b(curl|wget)\b[^\n]*\|\s*(ba)?sh\b/],
  ['eval', /\beval\b/],
  ['mot de passe en clair', /(--password|PASSWORD=|passwd\s+--stdin)/i],
  ['cle privee', /(BEGIN [A-Z ]*PRIVATE KEY|id_rsa\b(?!\.pub)|id_ed25519\b(?!\.pub))/],
  ['joker non borne', /\brm\b[^\n]*\s\*(\s|$)/],
  ['variable non protegee dans une commande destructrice', /\brm\b[^\n]*\$\{?[A-Za-z_][A-Za-z0-9_]*\}?(?![\w"])/],
  ['reboot ou shutdown', /\b(reboot|shutdown|poweroff|halt)\b/],
  ['Set-ExecutionPolicy', /Set-ExecutionPolicy/],
];

/** Retire les commentaires et le contenu des chaines : le code REELLEMENT execute. */
function codeNu(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '#' && (i === 0 || /[\s;|&(]/.test(src[i - 1]))) {
      const fin = src.indexOf('\n', i);
      i = fin === -1 ? src.length : fin;
      continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) break;
        j += 1;
      }
      out += ' ';
      i = j + 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const parOutil = {};
for (const s of scriptsSh) {
  const src = readFileSync(join(DIR, s.fichier), 'utf8');
  const nu = codeNu(src);
  const trouves = DANGERS.filter(([, re]) => re.test(nu)).map(([nom]) => nom);
  const dansTexteSeulement = DANGERS
    .filter(([, re]) => re.test(src) && !re.test(nu))
    .map(([nom]) => nom);
  if (!parOutil[s.outil]) parOutil[s.outil] = { dansLeCode: new Set(), citeDansUnTexte: new Set() };
  trouves.forEach((t) => parOutil[s.outil].dansLeCode.add(t));
  dansTexteSeulement.forEach((t) => parOutil[s.outil].citeDansUnTexte.add(t));
}
const matriceRisques = {
  ...commun,
  avertissement: matriceOutils.avertissement,
  methode: 'Chaque motif est cherche dans le CODE NU du script genere, commentaires '
    + 'et contenu des chaines retires. Un motif present seulement dans un texte pedagogique '
    + 'est consigne separement : un script peut DIRE ce qu il ne fait pas, et doit pouvoir le dire.',
  famillesSurveillees: DANGERS.length,
  familles: DANGERS.map(([nom]) => nom),
  outils: linux.map((t) => ({
    id: t.id,
    risque: t.risk,
    lectureSeule: p.estLectureSeule(t),
    requiresAdmin: t.requiresAdmin,
    motifsDansLeCode: [...(parOutil[t.id]?.dansLeCode ?? [])].sort(),
    motifsCitesDansUnTexte: [...(parOutil[t.id]?.citeDansUnTexte ?? [])].sort(),
  })),
};

// --- 4. Matrice des sources ------------------------------------------------
const urls = new Map();
for (const t of linux) {
  const ajoute = (u, label) => {
    if (!urls.has(u)) urls.set(u, { labels: new Set(), outils: new Set() });
    urls.get(u).labels.add(label);
    urls.get(u).outils.add(t.id);
  };
  if (t.source) ajoute(t.source, 'source principale');
  for (const s of t.sources ?? []) ajoute(s.url, s.label);
}
const matriceSources = {
  ...commun,
  avertissement: matriceOutils.avertissement,
  critere: 'Source PRIMAIRE : publiee par ceux qui ecrivent le logiciel ou maintiennent la '
    + 'distribution. Un blogue, un forum ou un agregateur de recettes n est jamais normatif, '
    + 'meme quand il a raison.',
  editeursReconnus: PREFIXES_SOURCES_LINUX,
  total: urls.size,
  verifieesEnLigne: 'Voir LOT-7-SOURCES-VERIFIEES.json : les 30 URL citees ont ete '
    + 'controlees EN LIGNE (code 200, corps non vide, titre reel non evocateur '
    + 'd une absence de contenu), 30/30 conformes. Le fichier de reponse est '
    + 'TRONQUE avant chaque requete : sans cette troncature, une URL morte '
    + 'heritait du titre de la page precedente et passait avec un titre '
    + 'plausible. Huit URL ont echoue a la premiere passe par reinitialisation '
    + 'de connexion du proxy de la session, et non par un code HTTP ; elles '
    + 'ont ete reessayees et le champ « reessayee » le dit pour chacune.',
  parEditeur: [...urls.keys()].reduce((a, u) => {
    const e = editeurDe(u) ?? '(non reconnu)';
    a[e] = (a[e] ?? 0) + 1;
    return a;
  }, {}),
  sources: [...urls.entries()].map(([url, d]) => ({
    url,
    editeur: editeurDe(url),
    labels: [...d.labels],
    outils: [...d.outils],
  })).sort((a, b) => a.url.localeCompare(b.url)),
};

writeFileSync(join(OUT, 'LOT-7-MATRICE-OUTILS.json'), `${JSON.stringify(matriceOutils, null, 2)}\n`);
writeFileSync(join(OUT, 'LOT-7-MATRICE-SCRIPTS.json'), `${JSON.stringify(matriceScripts, null, 2)}\n`);
writeFileSync(join(OUT, 'LOT-7-MATRICE-RISQUES.json'), `${JSON.stringify(matriceRisques, null, 2)}\n`);
writeFileSync(join(OUT, 'LOT-7-SOURCES.json'), `${JSON.stringify(matriceSources, null, 2)}\n`);

console.log(`Outils Linux : ${linux.length} / 32 prevus`);
console.log(`Catalogue    : ${tools.length} outils, ${categoriesVisibles(tools).length} categories visibles`);
console.log(`Scripts      : ${ps1.length} .ps1 (${matriceScripts.ps1AvecBom} avec BOM), ${sh.length} .sh (${matriceScripts.shAvecBom} avec BOM, ${matriceScripts.shAvecCr} avec CR)`);
console.log(`Reference712 : ${identiques} identiques, ${ecarts} ecart(s)`);
console.log(`Empreintes   : ${empreintesSh.size}/${scriptsSh.length} distinctes, ${matriceScripts.collisionsSh} collision(s)`);
console.log(`Sources      : ${urls.size} URL distinctes`);
console.log(`Risques      : ${DANGERS.length} familles surveillees`);
