/**
 * vue-portes.mjs — KJEMO-UX-ACCUEIL-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Marquage HTML (pur, testable sous Node) de l'accueil à TROIS PORTES et de ses
 * pages :  Mon TP  ·  Aide-mémoire du cours  ·  Catalogue professionnel.
 *
 * Règles d'interface :
 *  - une couleur par porte (violet, vert, orange) et par groupe de l'aide-mémoire,
 *    MAIS la couleur ne porte jamais seule l'information : icône + nom toujours ;
 *  - les textes restent sombres sur fond clair (contraste), la couleur va aux
 *    liserés, aux boutons et aux titres de grande taille ;
 *  - chaque page a un fil d'Ariane cliquable, un bouton « Accueil » et un
 *    bouton de retour en haut ET en bas ;
 *  - le filtre de plateforme actif est toujours visible avec sa sortie (✕) ;
 *  - aucune commande ici : ce ne sont que des liens vers des fiches.
 */
import { esc, badgeEffet } from './vue-taches.mjs';
import { ROUTE_MEMO, ROUTE_CATALOGUE, routeMemo } from './memo.mjs';

const ROUTE_ACCUEIL = '#/';
const couleurSure = (c) => (/^#[0-9a-f]{6}$/i.test(c ?? '') ? c : '#475569');

/** Fil d'Ariane : le dernier maillon n'est pas un lien. Accueil est toujours le premier. */
export function filPortesMarkup(maillons) {
  const tous = [{ nom: '⌂ Accueil', route: ROUTE_ACCUEIL }, ...maillons];
  const items = tous.map((m, i) => (i === tous.length - 1 || !m.route
    ? `<li aria-current="page">${esc(m.nom)}</li>`
    : `<li><a href="${esc(m.route)}">${esc(m.nom)}</a></li>`)).join('');
  return `<nav class="fil-ariane fil-portes" id="filPortes" aria-label="Fil d’Ariane"><ol>${items}</ol></nav>`;
}

/** Boutons de retour (haut et bas de page). `precedent` = { libelle, route } ou null. */
export function retoursMarkup(precedent, classe = 'retour-haut') {
  const p = precedent ? `<a class="retour-btn retour-precedent" href="${esc(precedent.route)}">← ${esc(precedent.libelle)}</a>` : '';
  return `<div class="retours ${esc(classe)}">${p}<a class="retour-btn retour-accueil" href="${ROUTE_ACCUEIL}">⌂ Accueil</a></div>`;
}

/** Pastille « Filtre : Linux ✕ » : le filtre actif est toujours visible et toujours quittable. */
export function pastilleFiltreMarkup(plat) {
  if (!plat) return '';
  return `<p class="filtre-actif" id="filtreActif" role="status"><span class="filtre-actif-texte">Filtre : <b>${esc(plat)}</b></span> `
    + `<button type="button" class="filtre-actif-sortie" id="filtreSortie" aria-label="Retirer le filtre ${esc(plat)} et afficher toutes les plateformes">✕ Toutes les plateformes</button></p>`;
}

/** Une carte de groupe de l'aide-mémoire (accueil et page Aide-mémoire). */
export function groupeCarteMarkup(g, compte, { nouveaux = 0 } = {}) {
  const grise = compte === 0;
  return `<a class="groupe-carte${grise ? ' is-vide' : ''}" style="--gc:${couleurSure(g.couleur)}" data-groupe="${esc(g.id)}" href="${esc(routeMemo(g.id))}"`
    + `${grise ? ' aria-disabled="true"' : ''}>`
    + `<span class="groupe-nom"><span class="groupe-icone" aria-hidden="true">${esc(g.icone)}</span>${esc(g.titre)}`
    + `${nouveaux ? ` <span class="badge-nouveau">+${nouveaux} nouveau</span>` : ''}</span>`
    + `<span class="groupe-cmds">${esc(g.commandes)}</span>`
    + `<span class="groupe-compte" aria-label="${compte} fiche${compte > 1 ? 's' : ''}">${compte}</span></a>`;
}

/**
 * L'accueil : trois portes puis les groupes de l'aide-mémoire.
 * tp : { titre, faits, total, href } ou null s'il n'y a aucun cours.
 */
export function portesAccueilMarkup({ tp, memoCartes, memoTotal, catalogueTotal, hrefCours, hrefLabo }) {
  const pct = tp && tp.total ? Math.round((tp.faits / tp.total) * 100) : 0;
  const porteTp = `<section class="porte porte-tp espace-carte" aria-labelledby="porteTpTitre">`
    + `<h2 id="porteTpTitre"><span aria-hidden="true">✎</span> Mes cours et TP</h2>`
    + (tp ? `<p><b>${esc(tp.titre)}</b></p><div class="porte-barre" role="img" aria-label="${tp.faits} éléments faits sur ${tp.total}"><i style="width:${pct}%"></i></div>`
      + `<p class="porte-desc">${tp.faits} élément${tp.faits > 1 ? 's' : ''} fait${tp.faits > 1 ? 's' : ''} sur ${tp.total}</p>`
      : `<p class="porte-desc">Aucun cours pour l’instant.</p>`)
    + `<p class="porte-actions"><a class="porte-btn" id="porteTpBtn" href="${esc(tp?.href ?? hrefCours)}">${tp ? 'Continuer' : 'Ouvrir'}</a>`
    + `<a class="porte-btn porte-btn-clair" href="${esc(hrefCours)}">Tous les cours</a></p></section>`;
  const porteMemo = `<section class="porte porte-memo" aria-labelledby="porteMemoTitre">`
    + `<h2 id="porteMemoTitre"><span aria-hidden="true">⌘</span> Aide-mémoire du cours</h2>`
    + `<p class="porte-desc">Les commandes de base, rangées par ce que tu veux faire. ${memoTotal} fiches.</p>`
    + `<p class="porte-actions"><a class="porte-btn" id="porteMemoBtn" href="${ROUTE_MEMO}">Ouvrir l’aide-mémoire</a></p></section>`;
  const porteCat = `<section class="porte porte-pro" aria-labelledby="porteProTitre">`
    + `<h2 id="porteProTitre"><span aria-hidden="true">▣</span> Catalogue professionnel</h2>`
    + `<p class="porte-desc">Windows, Active Directory, GPO, réseau, Cisco, Azure : ${catalogueTotal} procédures, commandes et assistants.</p>`
    + `<p class="porte-actions"><a class="porte-btn" id="porteProBtn" href="${ROUTE_CATALOGUE}">Parcourir par domaine</a></p></section>`;
  return `<div class="portes" id="portes">${porteTp}${porteMemo}${porteCat}</div>`
    + `<p class="portes-legende" aria-label="Légende des couleurs"><span class="lg lg-tp">Violet : mon TP</span><span class="lg lg-memo">Vert : aide-mémoire</span><span class="lg lg-pro">Orange : catalogue professionnel</span>`
    + ` <a class="lien-labo espace-carte" href="${esc(hrefLabo)}">⚙ Mon laboratoire</a></p>`
    + `<section class="memo-accueil" aria-labelledby="memoAccueilTitre"><h2 class="section-title" id="memoAccueilTitre">Aide-mémoire — par ce que je veux faire</h2>`
    + `<div class="groupes-grille" role="list">${memoCartes.map((c) => `<div role="listitem">${c}</div>`).join('')}</div></section>`;
}

/** Ligne de fiche (aide-mémoire) : titre, effet, plateforme, étapes, badges. */
export function ficheLigneMarkup(l, couleur) {
  return `<article class="fiche-ligne" style="--gc:${couleurSure(couleur)}" data-id="${esc(l.id)}">`
    + `<div class="fiche-ligne-main"><h3><a href="#/tache/${esc(l.id)}">${esc(l.titre)}</a></h3>`
    + `<p class="fiche-ligne-desc">${esc(l.resume)}</p>`
    + `<div class="task-badges">${badgeEffet(l.effet)}`
    + `${(l.plateformes ?? []).map((p) => `<span class="plat">${esc(p)}</span>`).join('')}`
    + `<span class="kind">${l.nbEtapes} étape${l.nbEtapes > 1 ? 's' : ''}</span>`
    + `${l.nouveau ? '<span class="badge-nouveau">nouveau</span>' : ''}${l.lieTp ? '<span class="badge-tp">TP</span>' : ''}</div></div>`
    + `<a class="fiche-ouvrir" href="#/tache/${esc(l.id)}" aria-label="Ouvrir : ${esc(l.titre)}">Ouvrir <span aria-hidden="true">→</span></a></article>`;
}

function chipsFiltreMarkup(filtres, actif, compteParFiltre) {
  return `<div class="chips memo-filtres" role="group" aria-label="Filtrer l’aide-mémoire">`
    + filtres.map((f) => `<button type="button" class="chip${actif === f.id ? ' is-on' : ''}" data-memo-filtre="${esc(f.id)}" aria-pressed="${actif === f.id}">${esc(f.libelle)} <span class="chip-n">${compteParFiltre[f.id] ?? 0}</span></button>`).join('')
    + `</div>`;
}

/**
 * Page « Aide-mémoire » (sans groupe) : tous les groupes, repliables, avec leurs sous-groupes.
 * groupes : [{ g, compte, nouveaux, sous:[{id,titre,fiches:[ligne]}] }] ; les groupes à 0 fiche
 * après filtre sont GRISÉS (jamais retirés sans explication).
 */
export function memoPageMarkup({ groupes, filtre, filtres, compteParFiltre, plat, total }) {
  const blocs = groupes.map(({ g, compte, nouveaux, sous }) => {
    if (compte === 0) return `<div class="groupe-bloc is-vide" style="--gc:${couleurSure(g.couleur)}" data-groupe="${esc(g.id)}"><p><span aria-hidden="true">${esc(g.icone)}</span> ${esc(g.titre)} <span class="groupe-compte">0</span> <span class="vide-raison">aucune fiche avec ces filtres</span></p></div>`;
    return `<details class="groupe-bloc" style="--gc:${couleurSure(g.couleur)}" data-groupe="${esc(g.id)}">`
      + `<summary><span class="groupe-nom"><span aria-hidden="true">${esc(g.icone)}</span> ${esc(g.titre)}${nouveaux ? ` <span class="badge-nouveau">+${nouveaux} nouveau</span>` : ''}</span><span class="groupe-compte">${compte}</span></summary>`
      + `<p class="groupe-resume">${esc(g.resume)} <a href="${esc(routeMemo(g.id))}">Ouvrir le groupe →</a></p>`
      + sous.map((s) => `<h3 class="sous-titre">${esc(s.titre)} <span class="sous-n">${s.fiches.length}</span></h3>${s.fiches.map((l) => ficheLigneMarkup(l, g.couleur)).join('')}`).join('')
      + `</details>`;
  }).join('');
  return filPortesMarkup([{ nom: 'Aide-mémoire' }])
    + `<div class="portes-page portes-memo">`
    + retoursMarkup(null)
    + `<h1 class="titre-memo"><span aria-hidden="true">⌘</span> Aide-mémoire du cours</h1>`
    + `<p class="intro">Classé par ce que tu veux faire. ${total} fiches ; les groupes grandissent avec les cours : compteurs et badges « nouveau » se calculent tout seuls. Pour une commande précise, utilise la recherche de l’<a href="#/">accueil</a>.</p>`
    + pastilleFiltreMarkup(plat)
    + chipsFiltreMarkup(filtres, filtre, compteParFiltre)
    + `<div class="groupes-liste">${blocs}</div>`
    + `<div class="retours retour-bas"><a class="retour-btn retour-accueil" href="${ROUTE_ACCUEIL}">⌂ Accueil</a><a class="retour-btn retour-cours" href="#/cours">Mes cours et TP →</a></div>`
    + `</div>`;
}

/** Page d'un groupe : les sous-groupes, puis les fiches. */
export function memoGroupePageMarkup({ g, sous, filtre, filtres, compteParFiltre, plat }) {
  const nb = sous.reduce((n, s) => n + s.fiches.length, 0);
  return filPortesMarkup([{ nom: 'Aide-mémoire', route: ROUTE_MEMO }, { nom: g.titre }])
    + `<div class="portes-page portes-memo" style="--gc:${couleurSure(g.couleur)}">`
    + retoursMarkup({ libelle: 'Retour à l’aide-mémoire', route: ROUTE_MEMO })
    + `<h1 class="titre-groupe"><span aria-hidden="true">${esc(g.icone)}</span> ${esc(g.titre)}</h1>`
    + `<p class="intro">${esc(g.resume)} ${nb} fiche${nb > 1 ? 's' : ''} affichée${nb > 1 ? 's' : ''}.</p>`
    + pastilleFiltreMarkup(plat)
    + chipsFiltreMarkup(filtres, filtre, compteParFiltre)
    + (sous.length ? `<p class="sous-tags" aria-label="Sous-groupes">${sous.map((s) => `<a class="tag-lien" href="#sg-${esc(s.id)}">${esc(s.titre)} · ${s.fiches.length}</a>`).join('')}</p>` : '')
    + (sous.length ? sous.map((s) => `<h2 class="sous-titre" id="sg-${esc(s.id)}">${esc(s.titre)} <span class="sous-n">${s.fiches.length}</span></h2>${s.fiches.map((l) => ficheLigneMarkup(l, g.couleur)).join('')}`).join('')
      : `<div class="empty">Aucune fiche de ce groupe avec les filtres actuels. <a href="${esc(routeMemo(g.id))}" id="memoSansFiltre">Réafficher tout le groupe</a></div>`)
    + retoursMarkup({ libelle: 'Retour à l’aide-mémoire', route: ROUTE_MEMO }, 'retour-bas')
    + `</div>`;
}

/** Page « Catalogue professionnel » : trois blocs de domaines. */
export function cataloguePageMarkup({ blocs, plat, total }) {
  const carte = (d) => `<a class="domaine-carte" data-domaine="${esc(d.id)}" href="${esc(d.route)}"><span class="domaine-nom"><span aria-hidden="true">${esc(d.icone)}</span> ${esc(d.nom)}</span>`
    + `<span class="domaine-sous">${esc(d.sous)}</span><span class="groupe-compte" aria-label="${d.compte} entrées">${d.compte}</span></a>`;
  return filPortesMarkup([{ nom: 'Catalogue professionnel' }])
    + `<div class="portes-page portes-pro">`
    + retoursMarkup(null)
    + `<h1 class="titre-pro"><span aria-hidden="true">▣</span> Catalogue professionnel</h1>`
    + `<p class="intro">Procédures, commandes et assistants pour l’administration réelle : ${total} entrées. Choisis un domaine ; la plateforme se règle ici ou sur l’accueil.</p>`
    + pastilleFiltreMarkup(plat)
    + blocs.map((b) => `<h2 class="bloc-titre">${esc(b.titre)}</h2><div class="domaines-grille" role="list">${b.domaines.map((d) => `<div role="listitem">${carte(d)}</div>`).join('')}</div>`).join('')
    + `<p class="portes-note"><a href="#/assistants">Voir les assistants complets seuls</a> · <a href="#/">Parcourir tout le catalogue depuis l’accueil</a></p>`
    + `<div class="retours retour-bas"><a class="retour-btn retour-accueil" href="${ROUTE_ACCUEIL}">⌂ Accueil</a></div>`
    + `</div>`;
}

/** Ligne de retour d'une fiche qui appartient à l'aide-mémoire. */
export function retourMemoFicheMarkup(g) {
  return `<p class="retour-parcours retour-memo" style="--gc:${couleurSure(g.couleur)}"><a href="${esc(routeMemo(g.id))}" id="retourMemo">← Retour à ${esc(g.icone)} ${esc(g.titre)} (aide-mémoire)</a> `
    + `<a href="${ROUTE_ACCUEIL}" class="retour-accueil-lien">⌂ Accueil</a></p>`;
}
