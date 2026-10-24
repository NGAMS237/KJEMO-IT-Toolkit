#!/usr/bin/env node
/**
 * coherence.test.mjs — UX-COHERENCE-03 · KJEMO IT Toolkit
 * Contrôles statiques de cohérence transversale sur TOUT le catalogue :
 * types de contenu, méthodes nommées (jamais « Script » générique), plateformes,
 * liens réciproques fiche ⇄ assistant, méthodes graphiques sans commande à
 * copier, aucune méthode vide. Les nombres sont RECALCULÉS, pas figés.
 * NE PROUVE PAS : l'effet d'une commande sur un équipement réel (NON EXÉCUTÉ).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const V = await imp('vue-taches.mjs'); const P = await imp('procedures.mjs');
const PL = await imp('plateforme.mjs'); const { tools } = await imp('generators.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const E = T.TOUTES_LES_ENTREES;
const assistants = E.filter((e) => e.kind === 'assistant');
const fiches = E.filter((e) => e.procedure);
console.log('1. Types de contenu et décompte');
const c = T.couverture();
assert(assistants.length === tools.length && c.assistants === tools.length, 'un assistant par outil', `${assistants.length}/${tools.length}`);
assert(E.length === new Set(E.map((e) => e.id)).size, 'identifiants uniques sur tout le catalogue');
assert(E.filter((e) => e.kind === 'commande').length === c.commandesRapides, 'commandes rapides = couverture()');
assert(c.assistantsSeuls.length + c.assistantsAvecFiche === c.assistants, 'couverture : avec fiche + seuls = tous');
assert(['procedure', 'scenario', 'commande', 'assistant'].every((k) => V.LIBELLE_KIND[k]), 'un libellé de type par nature');

console.log('2. Méthode nommée, jamais « Script » générique');
for (const e of E) {
  const l = V.libellesMethodes(e);
  assert(l.length > 0, `${e.id} : au moins une méthode nommée`);
  assert(l.every((x) => x.trim() !== 'Script' && x.trim() !== ''), `${e.id} : libellé non générique`, l.join('|'));
}
for (const a of assistants) {
  const attendu = PL.etiquetteSortie(a.tool);
  assert(V.libellesMethodes(a)[0] === attendu, `${a.id} : badge = ${attendu}`);
  assert(/PowerShell|Bash|Cisco IOS|Procédure/.test(attendu), `${a.id} : langage identifié`);
  const html = V.enteteAssistantMeta(a, { favori: false });
  assert(html.includes(attendu) && html.includes('id="toolFav"') && html.includes('class="plat"'), `${a.id} : en-tête = plateforme + langage + favori`);
}

console.log('3. Plateformes');
for (const a of assistants) {
  const p = PL.plateformeDe(a.tool);
  const attendu = p === 'Multi' ? 'Azure' : p;
  assert(a.plateformes.length === 1 && a.plateformes[0] === attendu, `${a.id} : plateforme ${attendu}`, a.plateformes.join(','));
}
assert(assistants.filter((a) => a.tool.category.startsWith('Azure')).every((a) => a.plateformes[0] === 'Azure'), 'assistants Azure classés Azure');
assert(T.chercher('', { plateforme: 'Azure', kinds: ['assistant'] }).length > 0, 'filtre Azure trouve des assistants');
for (const f of fiches) {
  assert(f.plateformes.length > 0, `${f.id} : plateforme(s) déduite(s) des méthodes`);
}

console.log('4. Fiches : méthodes non vides, graphique sans commande');
for (const f of fiches) {
  const p = f.procedure;
  assert(p.methodes.length > 0, `${f.id} : au moins une méthode`);
  assert(new Set(p.methodes.map((m) => m.id)).size === p.methodes.length, `${f.id} : méthodes sans doublon`);
  for (const m of p.methodes) {
    assert((m.etapes ?? []).length > 0 || (m.equipements ?? []).length > 0, `${f.id}/${m.id} : méthode non vide`);
    if (m.id === 'gui') {
      for (const e of m.etapes) {
        assert((e.actions ?? []).length > 0 && !(e.lignes ?? []).length, `${f.id}/gui : « ${e.titre} » = actions de navigation, aucune commande`);
      }
      assert(P.METHODES.gui.copiable === false, 'GUI non copiable');
    }
  }
  assert(P.incoherencesProcedure(p).length === 0, `${f.id} : contrat de procédure respecté`, P.incoherencesProcedure(p).join(' | '));
}
for (const a of assistants) {
  assert(Array.isArray(a.tool.gui) && a.tool.gui.length > 0 && a.tool.gui.every((s) => typeof s === 'string' && s.trim()), `${a.id} : méthode graphique décrite`);
}

console.log('5. Liens réciproques fiche ⇄ assistant');
for (const f of fiches.concat(E.filter((e) => e.kind === 'commande'))) {
  if (!f.assistant) continue;
  const cible = tools.find((t) => t.id === f.assistant);
  assert(!!cible, `${f.id} : assistant ${f.assistant} existe`);
  const l = T.liensDeAssistant(f.assistant);
  assert(l.procedures.some((x) => x.id === f.id) || l.commandes.some((x) => x.id === f.id), `${f.id} : l'assistant renvoie vers la version courte`);
}
for (const a of assistants) {
  const l = T.liensDeAssistant(a.id);
  const h = V.versionsCourtesMarkup(l);
  const attendu = l.procedures.length + l.commandes.length;
  assert((attendu === 0) === (h === ''), `${a.id} : bloc de versions courtes présent ssi une version existe`);
  for (const x of [...l.procedures, ...l.commandes]) assert(h.includes(`#/tache/${x.id}`), `${a.id} → ${x.id} : lien présent`);
}
const avecLien = assistants.filter((a) => { const l = T.liensDeAssistant(a.id); return l.procedures.length + l.commandes.length > 0; }).length;
assert(avecLien === c.assistantsAvecFiche, 'assistants avec lien réciproque = couverture()', `${avecLien}/${c.assistantsAvecFiche}`);

console.log('6. Cartes de résultat');
for (const e of E) {
  const h = V.ligneResultatMarkup(e);
  assert(h.includes('data-methode-badge'), `${e.id} : la carte nomme la méthode`);
  assert(h.includes(`kind-${e.kind}`), `${e.id} : la carte nomme le type`);
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
console.log('Exécution réelle sur équipement : NON EXÉCUTÉE. Génération et affichage vérifiés seulement.');
process.exit(failed ? 1 : 0);
