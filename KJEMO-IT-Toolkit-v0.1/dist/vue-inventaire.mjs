/**
 * vue-inventaire.mjs — JOURNAL-LABO-03 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Écrans de l'inventaire des équipements : la liste (systèmes, recherche,
 * projets qui utilisent chaque équipement) et la fiche d'un équipement, qui
 * s'adapte à son système (interfaces, table de routage, VLAN, services, règles).
 * Module PUR : HTML échappé seulement ; app.js branche les événements.
 */
import { SYSTEMES, TYPES_EQUIPEMENT, CHAMPS_EQUIPEMENT, TABLEAUX_EQUIPEMENT, systeme, typeEquipement, tableauxVisibles, exempleLigne } from './inventaire.mjs';
import { ROUTE_JOURNAL, routeEntreeJournal } from './vue-journal.mjs';

export const ROUTE_INVENTAIRE = '#/inventaire';
export const routeEquipement = (id) => `${ROUTE_INVENTAIRE}/${encodeURIComponent(id)}`;
export function lireRouteInventaire(hash) {
  if (hash === ROUTE_INVENTAIRE) return { id: null };
  const m = /^#\/inventaire\/([\w-]{2,80})$/.exec(String(hash ?? ''));
  return m ? { id: m[1] } : null;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fil = (maillons) => `<nav class="fil-ariane" aria-label="Fil d’Ariane"><ol>${maillons.map((m, i) => (m.route && i < maillons.length - 1
  ? `<li><a href="${esc(m.route)}">${esc(m.nom)}</a></li>` : `<li aria-current="page">${esc(m.nom)}</li>`)).join('')}</ol></nav>`;
const cle = (k) => k.replace(/\./g, '-');
const err = (erreurs, k) => (erreurs[k] ? `<p class="param-err" id="ierr-${esc(cle(k))}" role="alert">${esc(erreurs[k])}</p>` : '');
const inv = (erreurs, k) => (erreurs[k] ? ` aria-invalid="true" class="is-invalid" aria-describedby="ierr-${esc(cle(k))}"` : '');

/** Liste de l'inventaire. `projets(id)` : labos qui utilisent l'équipement. */
export function inventaireListeMarkup({ equipements = [], total = 0, compte = () => 0, systemeId = null, requete = '', projets = () => [], note = '', nouveauSysteme = 'cisco' } = {}) {
  const onglets = [{ id: null, label: 'Tous' }, ...SYSTEMES]
    .map((s) => `<button type="button" class="j-onglet" data-isys="${esc(s.id ?? '')}" aria-pressed="${systemeId === s.id}">${esc(s.label)} <span class="j-compte">${compte(s.id)}</span></button>`).join('');
  const lignes = equipements.map((e) => {
    const ps = projets(e.id);
    return `<tr><th scope="row"><a href="${esc(routeEquipement(e.id))}">${esc(e.nom)}</a></th><td>${esc(systeme(e.systeme).label)}</td><td>${esc(typeEquipement(e.type).label)}</td>`
      + `<td>${esc([e.modele, e.version].filter(Boolean).join(', '))}</td><td class="i-mono">${esc(e.adresse)}</td><td>${esc(e.role)}</td>`
      + `<td>${ps.length ? ps.map((p) => `<a class="i-projet" href="${esc(routeEntreeJournal(p.id))}">${esc(p.reference)}</a>`).join(' ') : '<span class="i-aucun">aucun</span>'}</td></tr>`;
  }).join('');
  const sys = SYSTEMES.map((s) => `<option value="${esc(s.id)}"${s.id === nouveauSysteme ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
  return fil([{ nom: 'Accueil', route: '#/' }, { nom: 'Journal de labo', route: ROUTE_JOURNAL }, { nom: 'Inventaire' }])
    + `<h1>Inventaire des équipements</h1>`
    + `<p class="intro">Chaque équipement existe une seule fois ici ; tes labos y font référence. S’il change d’adresse, tous les documents qui l’utilisent affichent la nouvelle valeur au prochain export.</p>`
    + `<form class="j-nouveau" id="iNouveauForm" aria-label="Nouvel équipement"><label for="iNouveauSys">Nouvel équipement</label><select id="iNouveauSys">${sys}</select>`
    + `<button type="submit" class="primary-button j-btn">+ Créer</button>`
    + `<button type="button" class="secondary-button j-mini-btn" id="iPdf"${total ? '' : ' disabled'}>Exporter l’inventaire en PDF</button></form>`
    + `<div class="j-onglets" role="group" aria-label="Système">${onglets}</div>`
    + `<div class="j-outils"><label class="sr-only" for="iRecherche">Rechercher dans l’inventaire</label>`
    + `<input id="iRecherche" type="search" autocomplete="off" placeholder="Rechercher un nom, une adresse, une interface…" value="${esc(requete)}"></div>`
    + (equipements.length
      ? `<div class="j-tableau"><table class="i-table"><thead><tr><th scope="col">Nom</th><th scope="col">Système</th><th scope="col">Type</th><th scope="col">Modèle, version</th><th scope="col">Adresse</th><th scope="col">Rôle</th><th scope="col">Projets</th></tr></thead><tbody>${lignes}</tbody></table></div>`
      : `<p class="j-vide">${total ? 'Aucun équipement ne correspond.' : '<b>L’inventaire est vide.</b> Crée un équipement ci-dessus, ou ouvre la fiche du TP VLAN et clique sur « Documenter dans le journal » : le commutateur et le routeur seront ajoutés avec leurs interfaces et leurs routes.'}</p>`)
    + `<p class="params-note" id="iNote" role="status" aria-live="polite">${esc(note)}</p>`;
}

/** Fiche d'un équipement. `labos` : [{ id, reference, titre }] qui l'utilisent ; `retour` : labo d'où l'on vient. */
export function equipementMarkup({ equipement: e, erreurs = {}, note = '', modifie = false, labos = [], confirmerSuppression = false, retour = null } = {}) {
  const ex = (c) => c.exemples?.[e.systeme] ?? c.exemples?.cisco ?? '';
  const champ = (c) => {
    const id = `if-${c.id}`;
    const ctl = c.long
      ? `<textarea id="${id}" data-i="${esc(c.id)}" rows="3" maxlength="${c.max}" placeholder="${esc(`Ex. : ${ex(c)}`)}"${inv(erreurs, c.id)}>${esc(e[c.id])}</textarea>`
      : `<input id="${id}" data-i="${esc(c.id)}" type="text" maxlength="${c.max}" autocomplete="off" spellcheck="false" placeholder="${esc(`Ex. : ${ex(c)}`)}" value="${esc(e[c.id])}"${inv(erreurs, c.id)}>`;
    return `<div class="j-champ${c.long ? ' j-large' : ''}"><label for="${id}">${esc(c.label)}</label>${ctl}${err(erreurs, c.id)}</div>`;
  };
  const types = TYPES_EQUIPEMENT.filter((t) => t.systemes.includes(e.systeme) || t.id === e.type)
    .map((t) => `<option value="${esc(t.id)}"${t.id === e.type ? ' selected' : ''}>${esc(t.label)}</option>`).join('');
  const sys = SYSTEMES.map((s) => `<option value="${esc(s.id)}"${s.id === e.systeme ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
  const tableau = (nom) => {
    const d = TABLEAUX_EQUIPEMENT[nom]; const exl = exempleLigne(nom, e.systeme);
    const corps = e[nom].map((l, i) => `<tr>${d.colonnes.map((c) => {
      const k = `${nom}.${i}.${c.id}`; const idc = `it-${nom}-${i}-${c.id}`;
      return `<td data-label="${esc(c.label)}"><label class="sr-only" for="${idc}">${esc(c.label)}, ligne ${i + 1}</label><input id="${idc}" class="cell" type="text" autocomplete="off" spellcheck="false" data-it="${nom}" data-row="${i}" data-col="${esc(c.id)}" placeholder="${esc(exl[c.id] ? `ex. ${exl[c.id]}` : '')}" value="${esc(l[c.id])}"${inv(erreurs, k)}>${err(erreurs, k)}</td>`;
    }).join('')}<td class="j-retrait"><button type="button" class="secondary-button j-mini" data-idel="${nom}" data-row="${i}" aria-label="Supprimer la ligne ${i + 1} de ${esc(d.label)}">✕</button></td></tr>`).join('');
    const aide = nom === 'routes' ? '<p class="j-aide">Une ligne par route. « Pourquoi » est ce qui t’aidera dans six mois : à quoi sert cette route. Types courants : C (connecté), S (statique), S* (défaut), O (OSPF).</p>'
      : nom === 'regles' ? '<p class="j-aide">Dans l’ordre de priorité. Note la source précise (adresse ou réseau), jamais « Any » sans le dire.</p>' : '';
    return `<section class="j-section" id="is-${nom}" aria-labelledby="ist-${nom}"><h2 id="ist-${nom}">${esc(d.label)}</h2>${aide}`
      + (e[nom].length ? `<div class="j-tableau"><table class="plan"><thead><tr>${d.colonnes.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}<th><span class="sr-only">Supprimer</span></th></tr></thead><tbody>${corps}</tbody></table></div>`
        : `<p class="param-aide">Exemple de ligne : ${esc(d.colonnes.map((c) => exl[c.id]).filter(Boolean).join(' · '))}</p>`)
      + `<button type="button" class="secondary-button j-ajout" data-iadd="${nom}">${esc(d.ajout)}</button></section>`;
  };
  const nbErr = Object.keys(erreurs).length;
  const barre = `<div class="j-barre" role="toolbar" aria-label="Actions de l’équipement">`
    + `<button type="button" class="primary-button j-btn" id="iEnregistrer">Enregistrer</button>`
    + (retour ? `<a class="secondary-button j-lien-btn" id="iRetour" href="${esc(routeEntreeJournal(retour.id))}">← Retour au labo ${esc(retour.reference)}</a>` : `<a class="secondary-button j-lien-btn" href="${ROUTE_INVENTAIRE}">← Inventaire</a>`)
    + `<button type="button" class="secondary-button j-danger" id="iSupprimer">Supprimer</button>`
    + `<span class="params-note${nbErr ? ' is-warn' : ''}" id="iNoteFiche" role="status" aria-live="polite">${esc(nbErr ? `${nbErr} champ(s) à corriger avant d’enregistrer.` : (note || (modifie ? 'Modifications non enregistrées.' : '')))}</span></div>`;
  const suppression = confirmerSuppression
    ? `<div class="j-confirmer" role="alert"><p><b>Supprimer « ${esc(e.nom || 'cet équipement')} » de l’inventaire ?</b> ${labos.length ? `Il sera retiré de ${labos.length} labo(s) : ${esc(labos.map((l) => l.reference).join(', '))}.` : 'Aucun labo ne l’utilise.'}</p>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-danger" id="iSupprimerOui">Oui, supprimer</button><button type="button" class="secondary-button" id="iSupprimerNon">Non, garder</button></div></div>`
    : '';
  return fil([{ nom: 'Accueil', route: '#/' }, { nom: 'Journal de labo', route: ROUTE_JOURNAL }, { nom: 'Inventaire', route: ROUTE_INVENTAIRE }, { nom: e.nom || 'Nouvel équipement' }])
    + `<h1>${esc(e.nom || 'Nouvel équipement')}</h1><p class="j-sous">${esc(systeme(e.systeme).label)} · ${esc(typeEquipement(e.type).label)}${e.modifieLe ? ` · modifié le ${esc(e.modifieLe)}` : ''}</p>`
    + barre + suppression
    + `<form id="iForm" class="j-form" novalidate aria-label="Fiche de l’équipement">`
    + `<section class="j-section" aria-labelledby="ist-socle"><h2 id="ist-socle">Identification</h2><div class="params-grid">`
    + `<div class="j-champ"><label for="if-systeme">Système</label><select id="if-systeme" data-i="systeme">${sys}</select></div>`
    + `<div class="j-champ"><label for="if-type">Type</label><select id="if-type" data-i="type">${types}</select></div>`
    + CHAMPS_EQUIPEMENT.map(champ).join('') + `</div></section>`
    + tableauxVisibles(e).map(tableau).join('')
    + `</form>`
    + `<section class="j-section" aria-labelledby="ist-labos"><h2 id="ist-labos">Utilisé dans</h2>`
    + (labos.length ? `<ul class="j-refs">${labos.map((l) => `<li><a href="${esc(routeEntreeJournal(l.id))}">${esc(l.reference)} · ${esc(l.titre)}</a>${l.role ? ` : ${esc(l.role)}` : ''}</li>`).join('')}</ul>`
      : '<p class="param-aide">Aucun labo pour l’instant. Dans la fiche d’un labo, section « Équipements », coche cet équipement.</p>')
    + `</section>`;
}

/** Section « Équipements » de la fiche d'un labo : cases de l'inventaire et rôle dans ce projet. */
export function equipementsLaboMarkup({ liens = [], inventaire = [], erreurs = {}, systemePrefere = null } = {}) {
  const choisis = new Map(liens.map((l) => [l.id, l]));
  const ordre = [...inventaire].sort((a, b) => (choisis.has(b.id) - choisis.has(a.id)) || ((b.systeme === systemePrefere) - (a.systeme === systemePrefere)) || a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const lignes = ordre.map((e) => {
    const l = choisis.get(e.id); const i = liens.findIndex((x) => x.id === e.id);
    return `<li class="i-choix${l ? ' is-choisi' : ''}"><label class="j-case"><input type="checkbox" data-jeq="${esc(e.id)}"${l ? ' checked' : ''}> <b>${esc(e.nom)}</b> <span class="i-meta">${esc(systeme(e.systeme).label)} · ${esc(typeEquipement(e.type).label)}${e.adresse ? ` · ${esc(e.adresse)}` : ''}</span></label>`
      + (l ? `<label class="sr-only" for="jeq-role-${esc(e.id)}">Rôle de ${esc(e.nom)} dans ce labo</label><input id="jeq-role-${esc(e.id)}" type="text" maxlength="200" data-jeqrole="${esc(e.id)}" placeholder="Rôle ici (ex. : passerelle des VLAN)" value="${esc(l.role)}"${i >= 0 ? inv(erreurs, `equipements.${i}.role`).replace(/ierr-/g, 'jerr-') : ''}>${i >= 0 && erreurs[`equipements.${i}.role`] ? `<p class="param-err" id="jerr-equipements-${i}-role" role="alert">${esc(erreurs[`equipements.${i}.role`])}</p>` : ''}` : '')
      + ` <a class="i-ouvrir" href="${esc(routeEquipement(e.id))}" data-jeqouvrir="${esc(e.id)}">Fiche</a></li>`;
  }).join('');
  return (inventaire.length ? `<ul class="i-choix-liste">${lignes}</ul>` : '<p class="param-aide">L’inventaire est vide : crée le premier équipement.</p>')
    + `<div class="params-actions"><button type="button" class="secondary-button" id="jEqNouveau">+ Nouvel équipement</button><a class="secondary-button j-lien-btn" href="${ROUTE_INVENTAIRE}" id="jEqInventaire">Ouvrir l’inventaire</a></div>`;
}
