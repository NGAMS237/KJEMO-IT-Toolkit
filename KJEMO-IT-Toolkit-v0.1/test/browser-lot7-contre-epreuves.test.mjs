#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 (25/n) — CONTRE-ÉPREUVES DU BANC NAVIGATEUR : IL DOIT ÉCHOUER QUAND ON CASSE L'APPLICATION
//
// Un banc navigateur qui n'a jamais échoué n'a jamais prouvé qu'il pouvait. Les
// 2 000 vérifications de test/browser-lot7.test.mjs passent sur l'application
// saine ; elles ne valent que si chacune peut devenir rouge.
//
// MÉTHODE
//   Pour chaque panne : une COPIE de dist/ est mutilée (une seule modification
//   textuelle, dont on exige qu'elle s'applique EXACTEMENT UNE FOIS — une
//   mutation qui ne trouve pas sa cible serait un faux positif de sécurité), puis
//   servie au vrai navigateur par KJEMO_DIST_DIR. Les oracles (catalogue,
//   générateurs, recherche) restent lus dans le dist/ INTACT : le banc ne se
//   juge pas avec l'application qu'il juge.
//
//   On exige alors DEUX choses : un code de sortie 1, ET un [ECHEC] dont
//   l'étiquette est celle de la vérification qui doit voir cette panne. Un banc
//   qui échouerait pour une AUTRE raison (serveur éteint, Chromium absent)
//   n'aurait rien prouvé.
//
//   Un CONTRÔLE POSITIF ouvre la série : sur dist/ intact, mêmes passes, même
//   restriction d'outils, code 0. Sans lui, « il échoue » ne distingue pas un
//   banc sensible d'un banc cassé.
//
// Tout est séquentiel : chaque banc enfant a son propre Chromium et son propre
// serveur, et aucun ne partage de sortie générée.
// ---------------------------------------------------------------------------
import { cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BANC = resolve(ROOT, 'test/browser-lot7.test.mjs');

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

const OUTILS = 'nfs-export-create,samba-ad-dc-readiness,windows-domain-join';
const PASSES_COMMUNES = 'A,B,C,D,E,F';

/**
 * Une panne : le fichier de dist/ touché, le texte remplacé par un autre, les
 * passes à jouer, et les étiquettes de vérification qui doivent passer au rouge.
 */
const PANNES = [
  { id: 'M01', nom: 'aperçu initial Bash normalisé comme du PowerShell (le défaut trouvé par ce commit)',
    fichier: 'app.js', de: 'const script = estBash(tool) ? normalizeScriptSh(scriptBrut) : normalizeScript(scriptBrut);',
    vers: 'const script = normalizeScript(scriptBrut);', passes: 'B,F', attendues: ['B5', 'B6', 'B7', 'F15'] },
  { id: 'M02', nom: 'le formulaire force une largeur de 620 px',
    fichier: 'styles.css', ajout: '@media(max-width:820px){#toolForm{min-width:620px}}', passes: 'F', attendues: ['F1', 'F2'] },
  { id: 'M03', nom: 'le panneau latéral passe AU-DESSUS du bouton de menu',
    fichier: 'styles.css', ajout: '@media(max-width:820px){.sidebar{z-index:9}}', passes: 'E', attendues: ['E11'] },
  { id: 'M04', nom: 'le bouton Copier est masqué',
    fichier: 'styles.css', ajout: '#copyButton{visibility:hidden}', passes: 'F', attendues: ['F9'] },
  { id: 'M05', nom: 'le lien d\'évitement est supprimé',
    fichier: 'index.html', de: '<a class="skip" href="#main">Aller au contenu</a>', vers: '', passes: 'D', attendues: ['D1'] },
  { id: 'M06', nom: 'les favoris ne sont plus écrits',
    fichier: 'app.js', de: 'localStorage.setItem(cle, JSON.stringify(valeur));', vers: 'void 0;', passes: 'C', attendues: ['C15', 'C16'] },
  { id: 'M07', nom: 'l\'aperçu du script passe à 8 px',
    fichier: 'styles.css', ajout: 'pre.code{font-size:8px}', passes: 'F', attendues: ['F18'] },
  { id: 'M08', nom: 'modifier un champ ne marque plus l\'aperçu obsolète',
    fichier: 'app.js', de: 'function markDirty() {', vers: 'function markDirty() { return;', passes: 'F', attendues: ['F17'] },
  { id: 'M09', nom: '« Linux et services réseau » est masquée de la grille',
    fichier: 'categories.mjs', de: '.filter((c) => c.count > 0);',
    vers: ".filter((c) => c.count > 0 && c.name !== 'Linux et services réseau');", passes: 'A', attendues: ['A1', 'A5'] },
  { id: 'M10', nom: 'le format des routes directes est cassé',
    fichier: 'app.js', de: "/^#\\/outil\\/([A-Za-z0-9_-]+)$/", vers: "/^#\\/tool\\/([A-Za-z0-9_-]+)$/", passes: 'B', attendues: ['Z0'] },
  { id: 'M11', nom: 'Échap ne ferme plus le menu latéral',
    fichier: 'app.js', de: "if (ev.key === 'Escape' && panneau.classList.contains('open')) {", vers: 'if (false) {', passes: 'E', attendues: ['E15'] },
  { id: 'M12', nom: 'l\'historique n\'est plus plafonné',
    fichier: 'app.js', de: 'const HISTORIQUE_MAX  = 6;', vers: 'const HISTORIQUE_MAX  = 60;', passes: 'C', attendues: ['C20'] },
  { id: 'M13', nom: 'la recherche rend ses résultats à l\'envers',
    fichier: 'app.js', de: 'return searchTools(currentQuery(), selectedCategory);', vers: 'return searchTools(currentQuery(), selectedCategory).reverse();', passes: 'C', attendues: ['C2'] },
  { id: 'M14', nom: 'une ancre de fiche écrase l\'URL de la route',
    fichier: 'app.js', de: "lien.addEventListener('click', (ev) => {\n      ev.preventDefault();", vers: "lien.addEventListener('click', (ev) => {\n      location.hash = lien.dataset.cible;", passes: 'D', attendues: ['D9'] },
  { id: 'M15', nom: 'le titre de la fiche est coupé sans défilement',
    fichier: 'styles.css', ajout: '@media(max-width:820px){.tool-header h1{overflow:hidden;white-space:nowrap;max-width:240px}}', passes: 'F', attendues: ['F5', 'F6'] },
  { id: 'M16', nom: 'un champ du formulaire est recouvert par un bandeau',
    fichier: 'styles.css', ajout: '@media(max-width:820px){#toolForm{position:relative}#toolForm::after{content:"";position:absolute;inset:0;background:transparent;z-index:3}}', passes: 'F', attendues: ['F13'] },
];

const dossier = mkdtempSync(join(tmpdir(), 'kjemo-contre-epreuves-'));

/** Lance le banc navigateur en processus enfant, avec son vrai code de sortie. */
function lancer({ distDir = null, passes, outils = OUTILS }) {
  const env = { ...process.env, KJEMO_PASSES: passes, KJEMO_OUTILS: outils };
  if (distDir) env.KJEMO_DIST_DIR = distDir; else delete env.KJEMO_DIST_DIR;
  const r = spawnSync(process.execPath, [BANC], { cwd: ROOT, encoding: 'utf8', env, timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const etiquettes = [...sortie.matchAll(/\[ECHEC\] ([A-Z]\d+[a-z]?) [:—]/g)].map((m) => m[1]);
  return { code: r.status, sortie, etiquettes };
}

try {
  // =========================================================================
  console.log('');
  console.log('Contrôle positif — dist/ intact, mêmes passes, mêmes outils : le banc doit être vert');
  // =========================================================================
  const temoin = lancer({ passes: PASSES_COMMUNES });
  verifier(temoin.code === 0, `P1 : sur l'application saine, le banc sort 0 (obtenu ${temoin.code})`);
  const total = /Navigateur LOT 7 : (\d+) OK, (\d+) ÉCHEC/.exec(temoin.sortie);
  verifier(Boolean(total) && Number(total[1]) > 200 && Number(total[2]) === 0,
    `P2 : le banc a réellement joué ses vérifications (${total ? total[1] : 'aucun total'} OK)`);

  // =========================================================================
  console.log('');
  console.log('Contre-épreuves — chaque panne doit être VUE, par la bonne vérification');
  // =========================================================================
  for (const p of PANNES) {
    const copie = join(dossier, p.id);
    cpSync(resolve(ROOT, 'dist'), copie, { recursive: true });
    const cible = join(copie, p.fichier);
    const avant = readFileSync(cible, 'utf8');
    let apres;
    if (p.ajout !== undefined) {
      apres = `${avant}\n${p.ajout}\n`;
    } else {
      const n = avant.split(p.de).length - 1;
      if (n !== 1) {
        fail(`${p.id} : la mutation « ${p.nom} » trouve sa cible ${n} fois dans ${p.fichier} (exactement 1 exigée) — mutation inapplicable`);
        continue;
      }
      apres = avant.replace(p.de, () => p.vers);
    }
    verifier(apres !== avant, `${p.id} — la mutation a bien MODIFIÉ ${p.fichier}`);
    writeFileSync(cible, apres, 'utf8');

    const r = lancer({ distDir: copie, passes: p.passes });
    verifier(r.code === 1, `${p.id} — ${p.nom} : le banc ÉCHOUE, code 1 (obtenu ${r.code})`);
    for (const e of p.attendues) {
      verifier(r.etiquettes.includes(e),
        `${p.id} — la vérification ${e} a vu la panne (étiquettes en échec : ${[...new Set(r.etiquettes)].slice(0, 8).join(', ') || 'aucune'})`);
    }
    rmSync(copie, { recursive: true, force: true });
  }
} finally {
  rmSync(dossier, { recursive: true, force: true });
}

console.log('');
console.log(`Contre-épreuves du banc navigateur : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log(`${PANNES.length} pannes injectées dans une copie de dist/, chacune vue par la bonne vérification.`);
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
