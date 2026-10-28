/**
 * vue-cours.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le MARQUAGE de « Mes cours et TP » et de « Mon laboratoire ».
 * Fonctions pures qui retournent du HTML : aucun DOM, aucun stockage. app.js
 * les appelle puis branche les événements (même séparation que vue-taches).
 *
 * RÈGLES DE PRÉSENTATION
 *  - Aucune couleur seule : « Non couvert », « Fait » ont un libellé et un symbole.
 *  - Une case cochée est annoncée comme « je l’ai fait », jamais comme une preuve.
 *  - Un lien d'étape dit la fiche, le numéro, le titre ET l'effet de l'étape.
 *  - Le laboratoire n'a aucun champ de mot de passe, de disque ou d'UUID.
 */
import { esc, inline, badgeEffet } from './vue-taches.mjs';
import { lienEtape, routeParcours, ROUTE_COURS, ROUTE_LABO } from './cours.mjs';
import { CHAMPS_LABO, avancement } from './labo.mjs';

const lettreOuPremiere = (cours, lettre) => cours.parcours.find((p) => p.lettre === lettre) ?? cours.parcours[0];

/** Lien vers une étape de fiche, avec effet. `ctx.fiche(id)` → { titre, etapes:[{titre,effet}] } | null. */
function lienFicheMarkup(ref, ctx, { coursId, lettre }) {
  const fiche = ctx.fiche(ref.fiche);
  if (!fiche) return `<span class="parcours-lien parcours-lien-absent">${esc(ref.fiche)} (fiche introuvable)</span>`;
  const href = lienEtape(ref, { coursId, lettre });
  if (!ref.etape) return `<a class="parcours-lien" href="${esc(href)}">${esc(fiche.titre)}</a>`;
  const e = fiche.etapes[ref.etape - 1];
  return `<a class="parcours-lien" href="${esc(href)}" data-fiche="${esc(ref.fiche)}" data-etape="${ref.etape}">`
    + `<span class="parcours-lien-fiche">${esc(fiche.titre)}</span> `
    + `<span class="parcours-lien-etape">étape ${ref.etape}${e ? ` · ${esc(e.titre)}` : ''}</span></a>`
    + (e?.effet ? ` ${badgeEffet(e.effet)}` : '');
}

/** Accueil des cours : la liste, un bouton par parcours. */
export function coursListeMarkup(coursListe, progression, ctx, plat = null) {
  const cartes = coursListe.map((c) => {
    const boutons = c.parcours.map((p) => {
      const a = avancement(c, p, progression);
      return `<a class="parcours-puce" href="${esc(routeParcours(c.id, p.lettre))}" data-parcours="${esc(p.lettre)}">`
        + `<b>${esc(p.lettre)}</b> ${esc(p.titre)} <span class="parcours-puce-n">${a.faits}/${a.total}</span></a>`;
    }).join('');
    return `<article class="cours-carte"><h2><a href="${esc(routeParcours(c.id))}">${esc(c.titre)}</a></h2>`
      + `<p>${esc(c.resume)}</p><div class="parcours-puces" role="list" aria-label="Parcours de ${esc(c.titre)}">${boutons}</div></article>`;
  }).join('');
  const titre = plat ? `Mes cours ${plat}` : 'Mes cours et TP';
  if (plat && !coursListe.length) {
    return filMarkup([{ nom: 'Accueil', route: '#/' }, { nom: titre }])
      + `<h1>${esc(titre)}</h1>`
      + `<div class="porte-vide-page" role="status"><span class="tag-bientot">Bientôt</span> Aucun cours ${esc(plat)} pour l’instant. Le premier TP ${esc(plat)} apparaîtra ici avec sa progression, comme celui de Serveurs II pour Linux. `
      + `<a href="#/">Retour à l’accueil</a></div>`;
  }
  return filMarkup([{ nom: 'Accueil', route: '#/' }, { nom: titre }])
    + `<h1>${esc(titre)}</h1>`
    + `<p class="intro">Un parcours dit, pour chaque demande de ton travail, <b>quelle fiche et quelle étape</b> la traitent. Il ne contient aucune commande : corriger une fiche corrige tous les parcours.</p>`
    + cartes
    + gabaritMarkup();
}

function filMarkup(maillons) {
  return `<nav class="fil-ariane" aria-label="Fil d’Ariane"><ol>`
    + maillons.map((m, i) => (m.route && i < maillons.length - 1
      ? `<li><a href="${esc(m.route)}">${esc(m.nom)}</a></li>`
      : `<li aria-current="page">${esc(m.nom)}</li>`)).join('')
    + `</ol></nav>`;
}

function gabaritMarkup() {
  return `<section class="cours-gabarit"><h2>Un autre travail pratique ?</h2>`
    + `<p>Télécharge le gabarit : il suit le même contrat que ce parcours (lettres, éléments, fiches citées, éléments non couverts, ambiguïtés). Remplace les valeurs, puis fais-le relire par le banc de tests du dépôt.</p>`
    + `<button type="button" class="secondary-button" id="gabaritBtn">Télécharger le gabarit de TP (JSON)</button></section>`;
}

/** Page d'un cours : onglets A–E, un parcours affiché. */
export function coursPageMarkup(cours, lettre, progression, ctx) {
  const p = lettreOuPremiere(cours, lettre);
  const onglets = cours.parcours.map((q) => {
    const a = avancement(cours, q, progression);
    const actif = q.lettre === p.lettre;
    return `<a class="parcours-onglet${actif ? ' is-actif' : ''}" href="${esc(routeParcours(cours.id, q.lettre))}"`
      + `${actif ? ' aria-current="page"' : ''} data-parcours="${esc(q.lettre)}"><b>${esc(q.lettre)}</b> <span>${a.faits}/${a.total}</span></a>`;
  }).join('');
  const a = avancement(cours, p, progression);

  const prerequis = (p.prerequis ?? []).length
    ? `<section class="parcours-prerequis"><h3>À lire d’abord</h3><ul>`
      + p.prerequis.map((r) => `<li>${lienFicheMarkup(r, ctx, { coursId: cours.id, lettre: p.lettre })}${r.pourquoi ? ` — ${esc(r.pourquoi)}` : ''}</li>`).join('')
      + `</ul></section>` : '';

  const items = p.items.map((it) => {
    const id = `item-${it.id.replace(/\./g, '-')}`;
    const fait = Boolean(progression[`${cours.id}:${it.id}`]);
    const couvert = it.couvert !== false;
    const liens = couvert
      ? `<span class="item-liens">${it.refs.map((r) => lienFicheMarkup(r, ctx, { coursId: cours.id, lettre: p.lettre })).join('<span class="item-sep" aria-hidden="true"> + </span>')}</span>`
      : `<span class="badge-non-couvert"><span aria-hidden="true">⚠</span> Non couvert par le catalogue</span>`;
    const assistants = (it.assistants ?? []).map((aid) => {
      const t = ctx.assistant(aid);
      return t ? ` <a class="parcours-lien" href="#/outil/${esc(aid)}">Assistant : ${esc(t)}</a>` : '';
    }).join('');
    return `<li class="parcours-item${couvert ? '' : ' is-non-couvert'}${fait ? ' is-fait' : ''}" data-item="${esc(it.id)}">`
      + `<label class="item-case"><input type="checkbox" id="${id}" data-item="${esc(it.id)}"${fait ? ' checked' : ''}>`
      + `<span class="item-code">${esc(it.id)}</span></label>`
      + `<div class="item-corps"><p class="item-texte">${esc(it.texte)}</p>${liens}${assistants}`
      + (it.note ? `<p class="item-note"><span aria-hidden="true">ℹ</span> <span class="sr-only">Note : </span>${inline(it.note)}</p>` : '')
      + `</div></li>`;
  }).join('');

  const soutien = (cours.soutien ?? []).length
    ? `<details class="cours-pliant"><summary>Pour aller plus loin (${cours.soutien.length} fiches)</summary><ul>`
      + cours.soutien.map((s) => `<li>${lienFicheMarkup({ fiche: s.fiche, etape: null }, ctx, {})} — ${esc(s.pourquoi)}</li>`).join('')
      + `</ul></details>` : '';
  const amb = (cours.ambiguites ?? []).length
    ? `<details class="cours-pliant" id="ambiguites"><summary>Ambiguïtés repérées dans l’énoncé (${cours.ambiguites.length})</summary><dl>`
      + cours.ambiguites.map((x) => `<dt>${esc(x.sujet)}</dt><dd>${inline(x.texte)}</dd>`).join('')
      + `</dl></details>` : '';

  return filMarkup([{ nom: 'Accueil', route: '#/' }, { nom: 'Mes cours et TP', route: ROUTE_COURS }, { nom: cours.titre }])
    + `<h1>${esc(cours.titre)}</h1>`
    + `<p class="notice notice-compact"><b>${esc('Une case cochée n’est pas une preuve.')}</b> ${esc(cours.avertissement)}</p>`
    + `<p class="cours-source">${esc(cours.source)}</p>`
    + `<nav class="parcours-onglets" aria-label="Parcours">${onglets}</nav>`
    + `<section class="parcours" aria-labelledby="parcoursTitre">`
    + `<h2 id="parcoursTitre">${esc(p.lettre)} — ${esc(p.titre)}${p.points ? ` <span class="parcours-points">${p.points} points</span>` : ''}</h2>`
    + `<p>${esc(p.resume)}</p>`
    + `<p class="parcours-avancement" aria-live="polite">${a.faits} sur ${a.total} faits${a.couverts < a.total ? ` · ${a.total - a.couverts} non couvert(s) par le catalogue` : ''}</p>`
    + prerequis
    + `<ol class="parcours-items">${items}</ol>`
    + `</section>${soutien}${amb}`;
}

/** Cours inconnu. */
export function coursIntrouvableMarkup() {
  return filMarkup([{ nom: 'Accueil', route: '#/' }, { nom: 'Mes cours et TP', route: ROUTE_COURS }, { nom: 'Introuvable' }])
    + `<h1>Cours introuvable</h1><p>Ce lien ne correspond à aucun cours. <a href="${ROUTE_COURS}">Retour à la liste</a>.</p>`;
}

/** « Mon laboratoire » : valeurs, erreurs, éditeur de CSV. */
export function laboMarkup({ valeurs = {}, erreurs = {}, csvTexte = '', csvErreurs = [], csvPret = false, enregistre = false, stockageOk = true } = {}) {
  const champs = CHAMPS_LABO.map((c) => {
    const err = erreurs[c.id];
    return `<div class="champ"><label for="labo-${esc(c.id)}">${esc(c.label)}</label>`
      + `<input id="labo-${esc(c.id)}" name="${esc(c.id)}" data-labo="${esc(c.id)}" type="text" autocomplete="off" spellcheck="false"`
      + ` placeholder="${esc(`Ex. : ${c.exemple}`)}" value="${esc(valeurs[c.id] ?? '')}" aria-describedby="labo-${esc(c.id)}-aide"${err ? ' aria-invalid="true" class="is-invalid"' : ''}>`
      + `<small id="labo-${esc(c.id)}-aide" class="champ-aide">${esc(c.aide)}</small>`
      + `<span class="champ-err" role="alert">${err ? esc(err) : ''}</span></div>`;
  }).join('');
  const nbErr = Object.keys(erreurs).length;
  return filMarkup([{ nom: 'Accueil', route: '#/' }, { nom: 'Mon laboratoire' }])
    + `<h1>Mon laboratoire</h1>`
    + `<p class="intro">Note ici les noms et adresses de TON environnement : les fiches pourront les reprendre quand tu cliques sur « Utiliser mon laboratoire ». Rien n’est rempli sans que tu le demandes.</p>`
    + `<p class="notice notice-compact"><b>Aucun mot de passe, aucun disque.</b> Ces champs restent dans ce navigateur (jamais envoyés). Un mot de passe se tape seulement dans le terminal. Les noms de disques (<code>/dev/sdb</code>, <code>md127</code>…) se relisent sur la machine à chaque fois, avec <code>lsblk</code>.${stockageOk ? '' : ' <b>Le stockage de ce navigateur est indisponible : tes valeurs ne seront pas gardées.</b>'}</p>`
    + `<form id="laboForm" class="params" novalidate aria-label="Mon laboratoire"><div class="params-grid">${champs}</div>`
    + `<div class="params-actions"><button type="submit" class="secondary-button" id="laboSave">Enregistrer</button>`
    + `<button type="button" class="secondary-button" id="laboClear">Effacer mon laboratoire</button>`
    + `<span class="params-note" id="laboNote" role="status" aria-live="polite">${nbErr ? `${nbErr} valeur(s) refusée(s) : corrige-les puis enregistre.` : (enregistre ? 'Enregistré dans ce navigateur.' : '')}</span></div></form>`
    + `<section class="labo-csv"><h2>Modèle du fichier CSV des comptes</h2>`
    + `<p>Une ligne par compte : <code>login;departement</code> (séparateur « ; », sans guillemets). Le fichier téléchargé a le format du TP2, <code>login;motdepasse;departement</code>, avec des logins fictifs et des mots de passe <b>fictifs</b> (<code>FICTIF-0001</code>…). <b>Ne tape jamais un vrai mot de passe ici</b> : le vrai CSV se prépare avec nano sur ta VM, et reste là. Le script de la fiche refuse les mots de passe fictifs à l’application.</p>`
    + `<label for="csvTexte" class="sr-only">Lignes du fichier CSV</label>`
    + `<textarea id="csvTexte" rows="8" spellcheck="false" autocomplete="off">${esc(csvTexte)}</textarea>`
    + `<div class="params-actions"><button type="button" class="secondary-button" id="csvVerifier">Vérifier</button>`
    + `<button type="button" class="secondary-button" id="csvTelecharger"${csvPret ? '' : ' aria-disabled="true"'}>Télécharger le CSV</button></div>`
    + `<div id="csvRetour" role="status" aria-live="polite">${csvErreurs.length
      ? `<ul class="csv-erreurs">${csvErreurs.map((e) => `<li>${e.ligne ? `Ligne ${e.ligne} : ` : ''}${esc(e.message)}</li>`).join('')}</ul>`
      : (csvPret ? '<p>CSV valide.</p>' : '')}</div></section>`
    + `<p class="labo-retour"><a href="${ROUTE_COURS}">Aller à Mes cours et TP</a></p>`;
}

/** Bandeau des deux espaces, sur l'accueil. */
export function espacesMarkup() {
  return `<div class="espaces" role="list">`
    + `<a class="espace-carte" role="listitem" href="${ROUTE_COURS}"><span class="espace-icone" aria-hidden="true">✎</span><span class="espace-nom">Mes cours et TP</span><span class="espace-desc">Un parcours, une fiche, une étape</span></a>`
    + `<a class="espace-carte" role="listitem" href="${ROUTE_LABO}"><span class="espace-icone" aria-hidden="true">⚙</span><span class="espace-nom">Mon laboratoire</span><span class="espace-desc">Tes noms et adresses, sans mot de passe</span></a>`
    + `</div>`;
}

/** Lien « Retour au parcours » d'une fiche ouverte depuis un parcours. */
export function retourParcoursMarkup(coursTitre, lettre, coursId) {
  return `<p class="retour-parcours"><a href="${esc(routeParcours(coursId, lettre))}" id="retourParcours">← Retour au parcours ${esc(lettre)} (${esc(coursTitre)})</a></p>`;
}
