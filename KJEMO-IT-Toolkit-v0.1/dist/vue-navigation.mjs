/**
 * vue-navigation.mjs — UX-NAVIGATION-CATALOGUE-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Balisage de la navigation par rubriques : fil d'Ariane, cartes de rubrique,
 * titres de groupe, bandeau « un filtre masque des résultats ». Fonctions
 * pures (données → HTML) : testables sans navigateur. Tout le classement vient
 * de classement.mjs ; aucun nom de rubrique n'est écrit ici.
 */
import { esc } from './vue-taches.mjs';
import { ARBRE, noeud, cheminDe, comparer, routePortee, enfants, hoteDe } from './classement.mjs';

/** Fil d'Ariane : le dernier maillon est la page courante (pas un lien). */
export function filArianeMarkup(maillons, { id = 'filAriane' } = {}) {
  const items = maillons.map((m, i) => (i === maillons.length - 1 || !m.route
    ? `<li aria-current="page">${esc(m.nom)}</li>`
    : `<li><a href="${esc(m.route)}">${esc(m.nom)}</a></li>`)).join('');
  return `<nav class="fil-ariane" id="${id}" aria-label="Fil d’Ariane"><ol>${items}</ol></nav>`;
}

/** Maillons d'une portée : Catalogue › Domaine › Famille › Sujet. */
export function maillonsDePortee({ assistants = false, domaineId, domaineNom, familleId = null, sujetId = null }) {
  const m = [{ nom: assistants ? 'Assistants complets' : 'Catalogue', route: routePortee({ assistants }) }];
  if (!domaineId) return m;
  m.push({ nom: domaineNom, route: routePortee({ assistants, domaineId }) });
  const n = noeud(domaineId, familleId, sujetId);
  if (n?.famille) m.push({ nom: n.famille.nom, route: routePortee({ assistants, domaineId, familleId }) });
  if (n?.sujet) m.push({ nom: n.sujet.nom, route: routePortee({ assistants, domaineId, familleId, sujetId }) });
  return m;
}

/** Nom de la rubrique la plus fine d'une portée. */
export function nomDePortee({ domaineId, domaineNom, familleId, sujetId }) {
  const n = noeud(domaineId, familleId, sujetId);
  return n?.sujet?.nom ?? n?.famille?.nom ?? domaineNom;
}

const plur = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * Panneau de rubrique : fil d'Ariane, ligne de périmètre de recherche, cartes
 * des sous-rubriques et, sur une rubrique encore incomplète, ce qui est prévu
 * (écrit comme tel : « pas encore réalisé »).
 */
export function rubriqueMarkup({ liste, assistants = false, domaineId, domaineNom, familleId = null, sujetId = null, requete = '', totalPartout = null }) {
  const n = noeud(domaineId, familleId, sujetId);
  const unite = assistants ? ['assistant', 'assistants'] : ['entrée', 'entrées'];
  let h = filArianeMarkup(maillonsDePortee({ assistants, domaineId, domaineNom, familleId, sujetId }));
  if (requete) {
    h += `<p class="portee-recherche" id="porteeRecherche">Recherche limitée à <strong>${esc(nomDePortee({ domaineId, domaineNom, familleId, sujetId }))}</strong>`
      + `${n.famille || n.sujet ? ` (dans ${esc(domaineNom)})` : ''}. `
      + `<button type="button" class="lien-bouton" id="rechercherPartout">Rechercher dans tout le catalogue${totalPartout != null ? ` (${plur(totalPartout, 'résultat', 'résultats')})` : ''}</button></p>`;
    return h;
  }
  const feuille = n.sujet || (n.famille && !n.famille.sujets?.length);
  if (!feuille) {
    const enf = enfants(liste, domaineId, n.famille ? familleId : null).filter((e) => e.compte > 0);
    h += `<ul class="rubrique-cartes" id="rubriqueCartes" aria-label="${n.famille ? 'Sujets' : 'Groupes'} de ${esc(nomDePortee({ domaineId, domaineNom, familleId, sujetId }))}">`
      + enf.map(({ def, compte }) => {
        const route = routePortee({ assistants, domaineId, familleId: n.famille ? familleId : def.id, sujetId: n.famille ? def.id : null });
        const detail = def.sujets ? def.sujets.map((s) => s.nom).join(' · ') : '';
        return `<li><a class="rubrique-carte" href="${esc(route)}" data-rubrique="${esc(def.id)}">`
          + `<span class="rubrique-nom">${esc(def.nom)}</span>`
          + `<span class="rubrique-compte">${plur(compte, unite[0], unite[1])}</span>`
          + (detail ? `<span class="rubrique-detail">${esc(detail)}</span>` : '')
          + `</a></li>`;
      }).join('')
      + `</ul>`;
  }
  const prevu = n.sujet?.prevu ?? (n.famille && !n.famille.sujets ? n.famille.prevu : null);
  if (prevu) h += `<p class="rubrique-prevu" id="rubriquePrevu"><strong>Couverture à venir.</strong> ${esc(prevu)}</p>`;
  return h;
}

/** Titre de groupe dans une liste (domaine, famille, sujet ou section). */
export function groupeEnteteMarkup({ titre, route = null, compte, niveau = 3 }) {
  const t = route ? `<a href="${esc(route)}">${esc(titre)}</a>` : esc(titre);
  return `<div class="groupe-entete" role="listitem"><h${niveau} class="groupe-titre">${t} <span class="groupe-compte">${compte}</span></h${niveau}></div>`;
}

/**
 * Regroupe une liste d'entrées selon la portée : par domaine pour tout le
 * catalogue, par famille pour un domaine, par sujet pour une famille à sujets,
 * par section pour un sujet qui en déclare, sinon par tâche (sans titre).
 * Retourne [{ cle, titre, route, entrees }] dans l'ordre de lecture.
 */
export function groupes(entrees, { assistants = false, categories, domaineId = null, familleId = null, sujetId = null }) {
  const rang = new Map();
  const defs = (domaineId ? ARBRE[domaineId] ?? [] : []);
  defs.forEach((f, i) => {
    rang.set(`f:${f.id}`, i * 100);
    (f.sujets ?? []).forEach((s, j) => rang.set(`s:${f.id}/${s.id}`, i * 100 + j + 1));
  });
  const n = domaineId ? noeud(domaineId, familleId, sujetId) : null;
  const feuille = n && (n.sujet || (n.famille && !n.famille.sujets?.length));
  const ordreHotes = (n?.sujet ?? n?.famille)?.sections?.flatMap((s) => s.hotes) ?? (n?.sujet ?? n?.famille)?.hotes ?? [];

  const cle = (e) => {
    const c = cheminDe(e);
    if (!domaineId) return { cle: `d:${e.categorie}`, titre: e.categorie, route: routePortee({ assistants, domaineId: c?.domaineId }), ordre: categories.indexOf(e.categorie) };
    if (!c) return { cle: 'z', titre: 'Autres', route: null, ordre: 9999 };
    if (feuille) {
      const sec = c.section;
      return sec ? { cle: `sec:${sec.id}`, titre: sec.titre, route: null, ordre: (n.sujet?.sections ?? []).findIndex((x) => x.id === sec.id) }
        : { cle: 'tout', titre: null, route: null, ordre: 0 };
    }
    if (n.famille) { // famille à sujets : un groupe par sujet
      return { cle: `s:${c.sujet?.id}`, titre: c.sujet?.nom ?? c.famille.nom, route: routePortee({ assistants, domaineId, familleId: c.famille.id, sujetId: c.sujet?.id }), ordre: rang.get(`s:${c.famille.id}/${c.sujet?.id}`) ?? 0 };
    }
    return { cle: `f:${c.famille.id}`, titre: c.famille.nom, route: routePortee({ assistants, domaineId, familleId: c.famille.id }), ordre: rang.get(`f:${c.famille.id}`) ?? 0 };
  };

  const m = new Map();
  for (const e of entrees) {
    const k = cle(e);
    if (!m.has(k.cle)) m.set(k.cle, { ...k, entrees: [] });
    m.get(k.cle).entrees.push(e);
  }
  const res = [...m.values()].sort((a, b) => a.ordre - b.ordre);
  for (const g of res) g.entrees.sort((a, b) => comparer(a, b, ordreHotes));
  return res;
}

/**
 * Bandeau « un filtre masque des résultats » : dit lequel, combien, et propose
 * de consulter les autres types ou plateformes. La recherche est conservée :
 * les boutons ne changent que le filtre.
 * `autres` : [{ action, valeur, libelle, compte }] ; `total` : résultats sans le filtre.
 */
export function bandeauMasqueMarkup({ id = 'filtreMasque', filtre, requete, perimetre, masques, autres }) {
  const sur = requete ? ` pour « ${esc(requete)} »` : '';
  const dans = perimetre ? ` dans ${esc(perimetre)}` : '';
  return `<div class="filtre-masque" id="${esc(id)}" role="status">`
    + `<p><strong>${esc(filtre)}</strong> masque ${plur(masques, 'résultat existant', 'résultats existants')}${sur}${dans}. `
    + `Consulter aussi :</p>`
    + `<div class="filtre-masque-actions">${autres.map((a) => `<button type="button" class="chip" data-masque-action="${esc(a.action)}" data-masque-valeur="${esc(a.valeur ?? '')}">${esc(a.libelle)} (${a.compte})</button>`).join('')}</div>`
    + `</div>`;
}

export { hoteDe };
