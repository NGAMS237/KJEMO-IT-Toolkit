#!/usr/bin/env node
/**
 * classement.test.mjs — UX-NAVIGATION-CATALOGUE-01 · KJEMO IT Toolkit
 * Contrôles statiques du classement commun (dist/classement.mjs) sur TOUT le
 * catalogue : aucune entrée sans rubrique, aucune rubrique vide, trois niveaux
 * au plus, routes aller-retour, regroupement sans perte, Samba complet,
 * couverture « à venir » écrite comme telle, titres de phase « Consulter ».
 * Les nombres sont RECALCULÉS. Contre-épreuves : on dégrade l'arbre et le
 * contrôle DOIT échouer (un banc qui ne peut pas échouer ne prouve rien).
 * NE PROUVE PAS : l'effet d'une commande sur un équipement réel (NON EXÉCUTÉ).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const C = await imp('classement.mjs'); const N = await imp('vue-navigation.mjs');
const P = await imp('procedures.mjs'); const { CATEGORIES } = await imp('categories.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const E = T.TOUTES_LES_ENTREES;
const idDomaines = new Map(CATEGORIES.map((c) => [c.name, c.id]));

/** Toutes les anomalies de classement ; vide si le classement est sain. */
function anomalies() {
  const a = [];
  const compte = new Map();
  for (const e of E) {
    const c = C.cheminDe(e);
    if (!c) { a.push(`sans-rubrique:${e.id}`); continue; }
    const k = [c.domaineId, c.famille.id, c.sujet?.id].filter(Boolean).join('/');
    compte.set(k, (compte.get(k) ?? 0) + 1);
    if (c.domaineId !== idDomaines.get(e.categorie)) a.push(`mauvais-domaine:${e.id}`);
  }
  for (const [d, familles] of Object.entries(C.ARBRE)) {
    const ids = new Set();
    for (const f of familles) {
      if (ids.has(f.id)) a.push(`famille-en-double:${d}/${f.id}`);
      ids.add(f.id);
      if (f.sujets) {
        if (f.sujets.length < 2) a.push(`un-seul-sujet:${d}/${f.id}`);
        for (const s of f.sujets) {
          if (s.sujets) a.push(`quatrieme-niveau:${d}/${f.id}/${s.id}`);
          if (!compte.get(`${d}/${f.id}/${s.id}`)) a.push(`sujet-vide:${d}/${f.id}/${s.id}`);
        }
      } else if (!compte.get(`${d}/${f.id}`)) a.push(`famille-vide:${d}/${f.id}`);
    }
  }
  const total = [...compte.values()].reduce((x, y) => x + y, 0);
  if (total !== E.filter((e) => C.cheminDe(e)).length) a.push('comptes-incoherents');
  return a;
}

console.log('1. Classement complet et sain');
const an = anomalies();
assert(an.length === 0, 'aucune entrée sans rubrique, aucune rubrique vide, trois niveaux au plus', an.slice(0, 5).join(' | '));
assert(E.every((e) => C.cheminDe(e)), `${E.length} entrées classées sur ${E.length}`);
const domainesVisibles = new Set(T.ENTREES_LISTEES.map((e) => e.categorie));
for (const nom of domainesVisibles) assert(C.ARBRE[idDomaines.get(nom)]?.length > 0, `${nom} : au moins un groupe`);
assert(Object.keys(C.ARBRE).every((d) => [...idDomaines.values()].includes(d)), 'chaque domaine de l’arbre est une catégorie réelle');

console.log('2. Une entrée suit son hôte');
for (const e of E.filter((x) => x.kind !== 'assistant')) {
  const h = C.hoteDe(e);
  const hote = h && T.entreeParId(h);
  assert(Boolean(hote) || e.id === 'cisco-voir-routes', `${e.id} : hôte connu (${h ?? 'direct'})`);
  if (hote) {
    const a = C.cheminDe(e); const b = C.cheminDe(hote);
    assert(a.famille.id === b.famille.id && a.sujet?.id === b.sujet?.id, `${e.id} : même rubrique que ${h}`);
  }
}

console.log('3. Routes aller-retour');
for (const [d, familles] of Object.entries(C.ARBRE)) {
  const r = C.lireRoute(C.routeRubrique(d));
  assert(r && r.domaineId === d && !r.assistants, `${d} : route du domaine`);
  for (const f of familles) {
    const rf = C.lireRoute(C.routeRubrique(d, f.id));
    assert(rf && rf.familleId === f.id, `${d}/${f.id} : route de la famille`);
    for (const s of f.sujets ?? []) {
      const rs = C.lireRoute(C.routeRubrique(d, f.id, s.id));
      assert(rs && rs.sujetId === s.id, `${d}/${f.id}/${s.id} : route du sujet`);
      assert(C.lireRoute(C.routePortee({ assistants: true, domaineId: d, familleId: f.id, sujetId: s.id }))?.assistants === true, `${d}/${f.id}/${s.id} : route des assistants`);
    }
  }
}
for (const mauvais of ['#/rubrique/', '#/rubrique/inconnu', '#/rubrique/linux/inconnu', '#/rubrique/linux/partages/inconnu', '#/rubrique/linux/a/b/c', '#/rubrique/../linux', '#/rubrique/linux/partages/samba/x']) {
  assert(C.lireRoute(mauvais) === null, `route refusée : ${mauvais}`);
}

console.log('4. Linux / Samba');
const samba = E.filter((e) => { const c = C.cheminDe(e); return c?.domaineId === 'linux' && c.sujet?.id === 'samba'; });
const idsSamba = new Set(samba.map((e) => e.id));
for (const h of ['samba-readiness', 'samba-share-create', 'samba-diagnostic']) assert(idsSamba.has(h), `assistant ${h} classé dans Samba`);
assert(samba.some((e) => e.kind === 'commande') && samba.some((e) => e.kind === 'assistant'), 'Samba réunit commandes et assistants');
assert(samba.every((e) => C.cheminDe(e).section), 'chaque entrée Samba a une section de lecture');
// Rien n'est inventé pour combler la couverture à venir : la rubrique la déclare, elle ne la simule pas.
const sambaDef = C.noeud('linux', 'partages', 'samba').sujet;
assert(/SAMBA-ADV-01/.test(sambaDef.prevu) && /Pas encore réalisé/.test(sambaDef.prevu), 'ce qui n’est pas réalisé est écrit comme tel');
assert(C.cheminDe(T.entreeParId('linux-ports-ecoute')).famille.id === 'reseau', 'écoute de ports Linux : groupe Réseau');
assert(Boolean(C.cheminDe(T.entreeParId('windows-ports-ecoute'))), 'écoute de ports Windows classée');

console.log('5. Regroupement d’une liste : sans perte, sans doublon');
const noms = CATEGORIES.map((c) => c.name);
const parPortee = [
  { domaineId: null }, ...Object.keys(C.ARBRE).map((d) => ({ domaineId: d })),
  { domaineId: 'linux', familleId: 'partages' }, { domaineId: 'linux', familleId: 'partages', sujetId: 'samba' },
];
for (const p of parPortee) {
  const nomDom = p.domaineId ? [...idDomaines].find(([, i]) => i === p.domaineId)[0] : null;
  const liste = E.filter((e) => (!p.domaineId || e.categorie === nomDom) && C.dans(e, p));
  const gs = N.groupes(liste, { ...p, categories: noms });
  const vus = gs.flatMap((g) => g.entrees.map((e) => e.id));
  assert(vus.length === liste.length && new Set(vus).size === liste.length, `groupes ${[p.domaineId, p.familleId, p.sujetId].filter(Boolean).join('/') || 'catalogue'} : ${liste.length} entrées conservées`);
}
const lg = N.groupes(samba, { domaineId: 'linux', familleId: 'partages', sujetId: 'samba', categories: noms });
assert(lg.map((g) => g.titre).join('|') === 'Prérequis et configuration|Créer un partage et régler ses permissions|Diagnostic et connexion d’un client', 'sections Samba dans l’ordre de lecture', lg.map((g) => g.titre).join('|'));
for (const g of lg) {
  const rangs = g.entrees.map((e) => ({ procedure: 0, scenario: 0, commande: 1, assistant: 2 })[e.kind]);
  assert(rangs.every((r, i) => i === 0 || r >= rangs[i - 1] || C.hoteDe(g.entrees[i]) !== C.hoteDe(g.entrees[i - 1])), `section « ${g.titre} » : fiche, commandes, assistant d’une même tâche se suivent`);
}

console.log('6. Balisage');
const h = N.rubriqueMarkup({ liste: T.ENTREES_LISTEES, domaineId: 'linux', domaineNom: 'Linux et services réseau' });
assert(/<nav class="fil-ariane"/.test(h) && /aria-label="Fil d’Ariane"/.test(h), 'fil d’Ariane étiqueté');
assert((h.match(/class="rubrique-carte"/g) ?? []).length === (C.ARBRE.linux.length), 'une carte par groupe du domaine');
assert(!/rubrique-compte">0 /.test(h), 'aucun groupe affiché à zéro');
const hs = N.rubriqueMarkup({ liste: T.ENTREES_LISTEES, domaineId: 'linux', domaineNom: 'Linux et services réseau', familleId: 'partages', sujetId: 'samba' });
assert(/id="rubriquePrevu"/.test(hs) && /Couverture à venir/.test(hs), 'la rubrique Samba annonce la couverture à venir');
assert(!/rubrique-carte/.test(hs), 'un sujet n’affiche pas de cartes (c’est la liste)');
const hr = N.rubriqueMarkup({ liste: T.ENTREES_LISTEES, domaineId: 'linux', domaineNom: 'Linux', requete: '<img src=x onerror=1>', totalPartout: 3 });
assert(/id="rechercherPartout"/.test(hr) && !/<img/.test(hr), 'recherche limitée : sortie « partout » proposée');
const b = N.bandeauMasqueMarkup({ filtre: 'Le filtre « Commandes »', requete: '<script>x</script>', perimetre: 'Linux', masques: 2, autres: [{ action: 'nature', valeur: 'fiche', libelle: 'Procédures', compte: 2 }] });
assert(!/<script>/.test(b) && /2 résultats existants/.test(b) && /data-masque-action="nature"/.test(b), 'bandeau de filtre : échappé, compté, actionnable');

console.log('7. Recherche dans un périmètre');
const garde = (e) => C.dans(e, { familleId: 'partages', sujetId: 'samba' });
const dansSamba = T.chercher('samba', { categorie: 'Linux et services réseau', garde });
assert(dansSamba.length > 0 && dansSamba.every((r) => garde(r.entree)), 'recherche limitée à Samba : que du Samba');
const partout = T.chercher('samba', { categorie: 'Linux et services réseau' });
assert(partout.length >= dansSamba.length, 'recherche sans périmètre : au moins autant');
const ssNature = T.chercher('', { categorie: 'Linux et services réseau', garde, kinds: ['commande'] });
const tous = T.chercher('', { categorie: 'Linux et services réseau', garde });
assert(tous.length > ssNature.length && ssNature.every((r) => r.entree.kind === 'commande'), 'filtre de type : le décompte des masqués est calculable');

console.log('8. Titres de phase');
let phasesLecture = 0; let faux = [];
for (const e of E.filter((x) => x.procedure)) {
  for (const m of e.procedure.methodes) {
    const rendu = P.rendreMethode(m, e.procedure.parametres ?? [], {});
    for (const ph of P.phasesDeMethode(rendu)) {
      if (ph.categorie !== 'action' || ph.titre !== 'Consulter' && ph.titre !== 'Appliquer') continue;
      const effets = ph.indices.map((i) => rendu.etapes[i].effet).filter(Boolean);
      const lectureSeule = effets.length > 0 && effets.every((x) => x === 'lecture');
      if (ph.titre === 'Consulter') phasesLecture++;
      if (lectureSeule && ph.titre !== 'Consulter') faux.push(`${e.id}/${m.id}`);
      if (!lectureSeule && ph.titre === 'Consulter') faux.push(`${e.id}/${m.id} (modifie)`);
    }
  }
}
assert(faux.length === 0, '« Appliquer » seulement quand une étape modifie ; « Consulter » seulement pour une lecture', faux.slice(0, 5).join(' | '));
assert(phasesLecture > 0, `des phases de lecture seule sont nommées « Consulter » (${phasesLecture})`);

console.log('9. Contre-épreuves : le contrôle DOIT échouer sur un arbre dégradé');
{
  const sauve = C.ARBRE.linux;
  C.ARBRE.linux = sauve.filter((f) => f.id !== 'partages');
  assert(anomalies().some((x) => x.startsWith('sans-rubrique')), 'retirer un groupe : des entrées deviennent orphelines (détecté)');
  C.ARBRE.linux = [...sauve, { id: 'vide', nom: 'Groupe vide', hotes: ['inexistant'] }];
  assert(anomalies().some((x) => x === 'famille-vide:linux/vide'), 'ajouter un groupe vide : détecté');
  C.ARBRE.linux = [...sauve, sauve[0]];
  assert(anomalies().some((x) => x.startsWith('famille-en-double')), 'doublon de groupe : détecté');
  C.ARBRE.linux = sauve;
  const f = C.ARBRE.linux.find((x) => x.id === 'partages');
  const s = f.sujets; f.sujets = [s[0]];
  assert(anomalies().some((x) => x.startsWith('un-seul-sujet')), 'groupe à un seul sujet : détecté');
  f.sujets = s;
  assert(anomalies().length === 0, 'arbre restauré : sain de nouveau');
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
console.log('Exécution réelle sur équipement : NON EXÉCUTÉE. Génération, classement et affichage vérifiés seulement.');
process.exit(failed ? 1 : 0);
