#!/usr/bin/env node
/**
 * annulations.test.mjs — KJEMO-ANNULER-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Étapes « Annuler » copiables (dist/annulations.mjs) :
 *  - chaque entrée de la table est appliquée, la fiche respecte le contrat ;
 *  - une étape d'annulation est facultative (hors de la copie de toute la fiche), signalée, en dernier ;
 *  - elle n'utilise que des paramètres déclarés, aucun repère ‹ › ni <…> littéral ;
 *  - un repère en majuscules (ANCIEN_GROUPE…) est toujours nommé dans l'explication ;
 *  - sur une fiche à machines, toute étape d'annulation désigne sa machine ;
 *  - les tableaux d'étapes PARTAGÉS ne sont pas modifiés ; l'opération est idempotente ;
 *  - contre-épreuves : une annulation non facultative ou sans effet est refusée par le contrat.
 * NE PROUVE PAS : que les commandes d'annulation fonctionnent sur de vrais postes (NON EXÉCUTÉES).
 * Usage : node test/annulations.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const A = await imp('annulations.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const proc = (id) => T.entreeParId(id).procedure;
const meth = (id, m) => proc(id).methodes.find((x) => x.id === m);

console.log('1. Table appliquée');
const cles = Object.keys(A.ANNULATIONS);
assert(cles.length >= 90, `au moins 90 méthodes couvertes (${cles.length})`);
for (const k of cles) {
  const [id, m] = k.split('|');
  const methode = T.entreeParId(id)?.procedure && meth(id, m);
  assert(Boolean(methode), `${k} existe`);
  if (!methode) continue;
  const etapes = methode.etapes;
  const an = etapes.filter((e) => e.annulation);
  assert(an.length === A.ANNULATIONS[k].steps.length, `${k} : toutes les étapes sont appliquées`);
  const premiere = etapes.findIndex((e) => e.annulation);
  assert(etapes.slice(premiere).every((e) => e.annulation), `${k} : les annulations viennent en dernier`);
  const paramsIds = new Set();
  for (const q of proc(id).params ?? []) {
    paramsIds.add(q.id);
    if (q.type === 'prefixe') paramsIds.add(`${q.id}Masque`);
    for (const c of q.colonnes ?? []) { paramsIds.add(c.id); paramsIds.add(`suivant_${c.id}`); }
    for (const a of q.agregats ?? []) paramsIds.add(a.id);
    if (q.type === 'table') paramsIds.add('masque');
  }
  for (const e0 of etapes) if (e0.repeter?.alias) paramsIds.add(e0.repeter.alias);
  const machines = etapes.some((e) => e.machine);
  for (const e of an) {
    assert(e.facultatif === true, `${k} « ${e.titre} » facultative`);
    assert(['modification', 'destructif', 'interruption'].includes(e.effet), `${k} « ${e.titre} » effet`);
    assert(e.titre.startsWith('Annuler — '), `${k} titre « Annuler — … »`);
    if (machines) assert(Boolean(e.machine), `${k} « ${e.titre} » désigne sa machine`);
    for (const l of e.lignes) {
      for (const p of P.parametresUtilises(l.cmd)) assert(paramsIds.has(p), `${k} : {{${p}}} déclaré`);
      assert(!l.cmd.includes('‹') && !/<[A-Za-zÀ-ÿ_][^>]*>/.test(l.cmd.replace(/\{\{[^}]*\}\}/g, '')), `${k} : pas de repère <…> littéral`);
      for (const r of A.REPERES) if (new RegExp(`\\b${r}\\b`).test(l.cmd)) assert(e.explication.includes(r), `${k} : ${r} nommé dans l'explication`);
    }
  }
}

console.log('2. Contrat et copie de toute la fiche');
for (const e of T.TOUTES_LES_ENTREES.filter((x) => x.procedure)) {
  const pb = P.incoherencesProcedure(e.procedure);
  assert(pb.length === 0, `${e.id} respecte le contrat`, pb.join(' | '));
}
{
  const p = proc('cours-rt-statique');
  const m = meth('cours-rt-statique', 'ios');
  const rendu = P.rendreMethode(m, p.params, Object.fromEntries(p.params.map((q) => [q.id, q.exemple])));
  const texte = rendu.texteComplet ?? '';
  assert(!/no ip route/.test(texte), 'la copie de toute la fiche ne contient PAS l’annulation');
  const etA = rendu.etapes.filter((e) => e.annulation);
  assert(etA.length === 1 && etA[0].rendu?.texteCopie?.includes('no ip route'), 'l’étape d’annulation reste copiable seule');
}

console.log('3. Retour texte et idempotence');
assert(/étapes « Annuler »/.test(meth('cours-rt-statique', 'ios').retour), 'le retour renvoie aux étapes Annuler');
{
  const p = proc('cours-rip-configurer'); const avant = p.methodes.length; const n1 = meth('cours-rip-configurer', 'ios').etapes.length;
  assert(A.completerAnnulations(p) === 0, 'deuxième passage : rien ajouté');
  assert(meth('cours-rip-configurer', 'ios').etapes.length === n1 && p.methodes.length === avant, 'idempotent');
}

console.log('4. Tableaux partagés non modifiés');
{
  const ec = ['cours-ec-pagp', 'cours-ec-lacp', 'cours-ec-statique'].map((id) => meth(id, 'ios').etapes.filter((e) => e.annulation));
  assert(ec.every((a) => a.length === 1), 'une annulation par canal');
  assert(ec[0][0] !== ec[1][0], 'chaque fiche a sa propre copie de l’étape');
  const fiche = { id: 'x-essai', kind: 'procedure', methodes: [{ id: 'ios', etapes: [{ titre: 'abcd' }], retour: 'r' }] };
  A.ANNULATIONS['x-essai|ios'] = { steps: [{ titre: 'Annuler — t', annulation: true }] };
  const orig = fiche.methodes[0].etapes;
  A.completerAnnulations(fiche);
  assert(orig.length === 1 && fiche.methodes[0].etapes.length === 2 && fiche.methodes[0].etapes !== orig, 'le tableau d’origine reste intact');
  delete A.ANNULATIONS['x-essai|ios'];
}

console.log('5. Contre-épreuves du contrat');
{
  const base = structuredClone(proc('cours-rt-statique'));
  const mm = base.methodes.find((m) => m.id === 'ios');
  const e = mm.etapes.find((x) => x.annulation);
  e.facultatif = false;
  assert(P.incoherencesProcedure(base).some((x) => /annulation/.test(x)), 'annulation non facultative refusée');
  e.facultatif = true; e.effet = 'lecture';
  assert(P.incoherencesProcedure(base).some((x) => /annulation/.test(x)), 'annulation en lecture seule refusée');
}

console.log(`\n${passed} OK, ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
