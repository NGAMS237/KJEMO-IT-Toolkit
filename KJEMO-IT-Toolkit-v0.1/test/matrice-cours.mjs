#!/usr/bin/env node
/**
 * matrice-cours.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * Produit la MATRICE DE COUVERTURE du cours (élément du TP → fiche et étape) à
 * partir de dist/cours.mjs : rien n'est saisi à la main, donc rien ne dérive.
 *   node test/matrice-cours.mjs --ecrire     écrit docs/COURS-TP2-01-MATRICE.md
 *   node test/matrice-cours.mjs --verifier   échoue si le fichier n'est pas à jour
 * NE PROUVE PAS : qu'une commande fonctionne sur une machine réelle (NON EXÉCUTÉ).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const K = await imp('cours.mjs'); const { PROCEDURES_COURS } = await imp('procedures-cours.mjs');
const SORTIE = resolve(ROOT, 'docs', 'COURS-TP2-01-MATRICE.md');
const cel = (t) => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function fabriquer() {
  const c = K.COURS[0];
  const L = [];
  L.push(`# Matrice de couverture — ${c.titre}`, '');
  L.push('Produite par `node test/matrice-cours.mjs --ecrire` à partir de `dist/cours.mjs` ; `--verifier` échoue si ce fichier est périmé. Les énoncés sont résumés dans nos propres mots (les documents d’origine ne sont pas republiés). **Les parcours sont NOTRE lecture de l’énoncé : en cas de doute, c’est l’énoncé qui fait foi.** Couvert = une fiche écrite à la main permet d’accomplir la tâche (préparation, action, vérification, résultat attendu) ; ce n’est PAS une exécution : aucune commande n’a été lancée sur Ubuntu, Windows, Samba ou RAID réels. Seul le script d’import CSV a été exécuté, contre un faux samba-tool.', '');
  const tous = c.parcours.flatMap((p) => p.items);
  const couverts = tous.filter((i) => i.couvert !== false);
  L.push(`Éléments : ${tous.length} · couverts par une fiche : ${couverts.length} · non couverts : ${tous.length - couverts.length} (${tous.filter((i) => i.couvert === false).map((i) => i.id).join(', ')}).`, '');
  for (const p of c.parcours) {
    L.push(`## ${p.lettre} — ${p.titre}${p.points ? ` (${p.points} points)` : ''}`, '', p.resume, '');
    if (p.prerequis.length) L.push(`À lire d’abord : ${p.prerequis.map((r) => `\`${r.fiche}\` (étape ${r.etape})`).join(' ; ')}.`, '');
    L.push('| Élément | Demande (résumée) | Fiche · méthode · étape | Effet de l’étape | État de la couverture |', '|---|---|---|---|---|');
    for (const it of p.items) {
      const refs = it.refs.map((r) => {
        const f = T.entreeParId(r.fiche).procedure;
        const m = (r.methode ? f.methodes.find((x) => (x.id ?? x.methode) === r.methode) : null) ?? f.methodes[0];
        const e = m.etapes[r.etape - 1];
        const mid = m.id ?? m.methode;
        return { txt: `\`${r.fiche}\` · ${f.methodes.length > 1 ? `${mid} ` : ''}étape ${r.etape} « ${e.titre} »${e.machine ? ` [${e.machine}]` : ''}`, effet: e.effet };
      });
      const etat = it.couvert === false ? '**NON COUVERT** — ' + it.note : (it.note ? `Couvert — ${it.note}` : 'Couvert');
      L.push(`| ${it.id} | ${cel(it.texte)} | ${cel(refs.map((r) => r.txt).join(' + ') || '—')} | ${cel([...new Set(refs.map((r) => r.effet))].join(', ') || '—')} | ${cel(etat)} |`);
    }
    L.push('');
  }
  L.push('## Fiches de soutien', '', '| Fiche | Pourquoi |', '|---|---|');
  for (const s of c.soutien) L.push(`| \`${s.fiche}\` | ${cel(s.pourquoi)} |`);
  L.push('', '## Ambiguïtés de l’énoncé', '');
  for (const a of c.ambiguites) L.push(`- **${a.sujet}** — ${a.texte}`);
  L.push('', `## Fiches du cours (${PROCEDURES_COURS.length})`, '', '| Fiche | Titre | Étapes | Effet |', '|---|---|---|---|');
  for (const p of PROCEDURES_COURS) L.push(`| \`${p.id}\` | ${cel(p.titre)} | ${p.methodes.map((m) => m.etapes.length).join('/')} | ${p.effet} |`);
  return `${L.join('\n')}\n`;
}

const attendu = fabriquer();
if (process.argv.includes('--ecrire')) { writeFileSync(SORTIE, attendu); console.log(`écrit : ${SORTIE}`); }
else if (process.argv.includes('--verifier')) {
  let actuel = ''; try { actuel = readFileSync(SORTIE, 'utf8'); } catch { /* absent */ }
  if (actuel !== attendu) { console.error('[FAIL] docs/COURS-TP2-01-MATRICE.md est absent ou périmé : node test/matrice-cours.mjs --ecrire'); process.exit(1); }
  console.log('[OK]   docs/COURS-TP2-01-MATRICE.md à jour');
} else process.stdout.write(attendu);
