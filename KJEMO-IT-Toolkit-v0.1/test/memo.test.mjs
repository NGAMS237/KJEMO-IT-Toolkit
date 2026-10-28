#!/usr/bin/env node
/**
 * memo.test.mjs — KJEMO-UX-ACCUEIL-01 · KJEMO IT Toolkit
 * Aide-mémoire (memo.mjs) et marquage des portes (vue-portes.mjs) : données, filtres,
 * routes, contre-épreuves. Les nombres sont RECALCULÉS. Ne prouve rien sur une machine réelle.
 * Usage : node test/memo.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const M = await imp('memo.mjs'); const V = await imp('vue-portes.mjs'); const T = await imp('taches.mjs');
const { PROCEDURES_COURS } = await imp('procedures-cours.mjs'); const K = await imp('cours.mjs');
let passed = 0; let failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error(`ÉCHEC : ${m}`); } };

const idsCours = PROCEDURES_COURS.map((p) => p.id);
const existe = (id) => Boolean(T.entreeParId(id)?.procedure);

// 1. cohérence : chaque fiche existe, rangée UNE fois, les 50 fiches de cours toutes rangées
const pb = M.incoherencesMemo({ existe, fichesAttendues: idsCours });
ok(pb.length === 0, `incohérences : ${pb.join(' | ')}`);
ok(idsCours.length === 50, `50 fiches de cours attendues, ${idsCours.length} trouvées`);
ok(M.toutesLesFichesMemo().length === new Set(M.toutesLesFichesMemo()).size, 'aucune fiche rangée deux fois');
for (const id of M.toutesLesFichesMemo()) {
  const e = T.entreeParId(id);
  ok((e?.plateformes ?? []).length > 0, `${id} : plateforme absente`);
  ok(Boolean(e?.titre) && Boolean(e?.resume), `${id} : titre ou résumé absent`);
}

// 2. contre-épreuves : le contrôle DOIT échouer
const g0 = M.MEMO_GROUPES[0];
const copie = (f) => M.MEMO_GROUPES.map((g, i) => (i ? g : f(structuredClone(g))));
ok(M.incoherencesMemo({ existe, fichesAttendues: idsCours, groupes: copie((g) => { g.sous[0].fiches.push('cours-inconnu'); return g; }) }).length > 0, 'fiche inconnue non détectée');
ok(M.incoherencesMemo({ existe, fichesAttendues: idsCours, groupes: copie((g) => { g.sous[0].fiches.push(g.sous[0].fiches[0]); return g; }) }).length > 0, 'doublon non détecté');
ok(M.incoherencesMemo({ existe, fichesAttendues: idsCours, groupes: copie((g) => { g.sous[0].fiches.pop(); return g; }) }).length > 0, 'fiche oubliée non détectée');
ok(M.incoherencesMemo({ existe, groupes: copie((g) => { g.couleur = 'rouge'; return g; }) }).length > 0, 'couleur invalide non détectée');
ok(M.incoherencesMemo({ existe, groupes: copie((g) => { g.icone = ''; return g; }) }).length > 0, 'icône absente non détectée');
ok(M.incoherencesMemo({ existe, groupes: copie((g) => { g.sous = []; return g; }) }).length > 0, 'groupe sans sous-groupe non détecté');

// 3. filtres calculés
const plateformesDe = (id) => T.entreeParId(id)?.plateformes ?? [];
const lies = new Set(K.COURS.flatMap((c) => [...M.fichesDuCours(c)]));
const total = M.MEMO_GROUPES.reduce((n, g) => n + M.compteGroupe(g, { plateformesDe, lies }), 0);
ok(total === M.toutesLesFichesMemo().length, 'filtre « tous » : total = nombre de fiches');
const nouv = M.idsNouveaux();
ok(nouv.size > 0 && [...nouv].every((id) => M.toutesLesFichesMemo().includes(id)), '« nouveau » : ids connus');
const cn = M.MEMO_GROUPES.reduce((n, g) => n + M.compteGroupe(g, { filtre: 'nouveau', plateformesDe, lies, nouveaux: nouv }), 0);
ok(cn === nouv.size, `« nouveau » : ${cn} compté, ${nouv.size} attendu`);
const ct = M.MEMO_GROUPES.reduce((n, g) => n + M.compteGroupe(g, { filtre: 'tp', plateformesDe, lies }), 0);
ok(ct > 0 && ct <= total, '« Liés au TP » : entre 1 et le total');
const cw = M.MEMO_GROUPES.reduce((n, g) => n + M.compteGroupe(g, { plat: 'Windows', plateformesDe, lies }), 0);
const cl = M.MEMO_GROUPES.reduce((n, g) => n + M.compteGroupe(g, { plat: 'Linux', plateformesDe, lies }), 0);
ok(cw > 0 && cl > 0 && cl + cw >= total - 0, `plateforme : Linux ${cl}, Windows ${cw}, total ${total}`);
ok(M.compteGroupe(g0, { plat: 'Cisco', plateformesDe, lies }) === 0, 'filtre Cisco : groupe vide (grisé, pas supprimé)');
ok(M.idsNouveaux({}).size === 0, 'aucun ajout : aucun nouveau');
ok(M.idsNouveaux({ a: '2026-01-01', b: '2026-10-27' }).has('a') === false, 'fiche ancienne : pas « nouveau »');

// 4. routes
ok(M.lireRouteMemo('#/memo').type === 'memo' && M.lireRouteMemo('#/memo').groupeId === null, '#/memo');
ok(M.lireRouteMemo('#/memo/fichiers').groupeId === 'fichiers', '#/memo/<groupe>');
ok(M.lireRouteMemo('#/catalogue').type === 'catalogue', '#/catalogue');
ok(M.lireRouteMemo('#/memoire') === null && M.lireRouteMemo('#/tache/x') === null && M.lireRouteMemo('') === null, 'routes étrangères refusées');
ok(M.routeMemo('texte') === '#/memo/texte', 'routeMemo');
for (const g of M.MEMO_GROUPES) ok(M.lireRouteMemo(M.routeMemo(g.id)).groupeId === g.id, `aller-retour de route ${g.id}`);

// 5. marquage : retours, fil, filtre, échappement, couleur jamais seule
const lignes = (g) => g.sous.map((s) => ({ ...s, fiches: s.fiches.map((id) => { const e = T.entreeParId(id); return { id, titre: e.titre, resume: e.resume, effet: e.effet, plateformes: e.plateformes, nbEtapes: 1, nouveau: nouv.has(id), lieTp: lies.has(id) }; }) }));
const fc = { tous: total, nouveau: cn, tp: ct };
const page = V.memoGroupePageMarkup({ g: g0, sous: lignes(g0), filtre: 'tous', filtres: M.FILTRES_MEMO, compteParFiltre: fc, plat: 'Linux' });
ok(page.includes('id="filtreSortie"') && page.includes('Filtre : <b>Linux</b>'), 'pastille de filtre avec sortie');
ok((page.match(/class="retours /g) ?? []).length === 2, 'retour en haut ET en bas');
ok(page.includes('href="#/"') && page.includes('href="#/memo"'), 'liens Accueil et Aide-mémoire');
ok(!V.pastilleFiltreMarkup(null), 'pas de pastille sans filtre');
ok(!V.pastilleFiltreMarkup('<img>').includes('<img>'), 'pastille échappée');
const carte = V.groupeCarteMarkup(g0, 0, {});
ok(carte.includes('is-vide') && carte.includes(g0.icone) && carte.includes(g0.titre), 'groupe à 0 : grisé mais nommé, avec icône');
ok(V.groupeCarteMarkup({ ...g0, couleur: 'javascript:x' }, 1).includes('#475569'), 'couleur invalide neutralisée');
ok(V.portesAccueilMarkup({ tp: null, memoCartes: [], memoTotal: 0, catalogueTotal: 0, hrefCours: '#/cours', hrefLabo: '#/labo' }).includes('Aucun cours'), 'accueil sans cours');
ok(V.retourMemoFicheMarkup(g0).includes('id="retourMemo"'), 'retour de fiche');

console.log(`memo.test.mjs : ${passed} OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
