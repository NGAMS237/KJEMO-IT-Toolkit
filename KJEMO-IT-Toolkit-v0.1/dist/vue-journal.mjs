/**
 * vue-journal.mjs — JOURNAL-LABO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Écrans du Journal de labo : la liste (filtres, recherche, sauvegarde) et la
 * fiche d'un labo (saisie guidée, captures, versions, export PDF). Module PUR :
 * ne fabrique que du HTML échappé ; app.js branche les événements.
 */
import { CATEGORIES_JOURNAL, ETATS_JOURNAL, CLASSIFICATIONS, RESULTATS, TABLEAUX, CHAMPS_TEXTE, MAX_CAPTURES, EXEMPLES_CHAMPS, EXEMPLES_TABLEAUX,
  categorie, etat, aRevoir } from './journal.mjs';
import { dateLongue } from './journal-pdf.mjs';

export const ROUTE_JOURNAL = '#/journal';
export const routeEntreeJournal = (id) => `${ROUTE_JOURNAL}/${encodeURIComponent(id)}`;
/** « #/journal » → { id: null } ; « #/journal/<id> » → { id } ; sinon null. */
export function lireRouteJournal(hash) {
  if (hash === ROUTE_JOURNAL) return { id: null };
  const m = /^#\/journal\/([\w-]{2,80})$/.exec(String(hash ?? ''));
  return m ? { id: m[1] } : null;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fil = (maillons) => `<nav class="fil-ariane" aria-label="Fil d’Ariane"><ol>${maillons.map((m, i) => (m.route && i < maillons.length - 1
  ? `<li><a href="${esc(m.route)}">${esc(m.nom)}</a></li>` : `<li aria-current="page">${esc(m.nom)}</li>`)).join('')}</ol></nav>`;

export const FILTRES_JOURNAL = [
  { id: 'tous', label: 'Actifs' }, { id: 'service', label: 'En service' }, { id: 'brouillon', label: 'Brouillons' },
  { id: 'a-revoir', label: 'À revoir' }, { id: 'archive', label: 'Archivés' },
];

const pastilleEtat = (id) => { const e = etat(id); return `<span class="j-etat j-etat-${esc(e.id)}"><span aria-hidden="true">${esc(e.symbole)}</span> ${esc(e.label)}</span>`; };

/** Liste des labos. `compte(cat)` : nombre d'entrées (hors filtre d'état) par catégorie ; null = toutes. */
export function journalListeMarkup({ entrees = [], total = 0, compte = () => 0, categorieId = null, filtre = 'tous', requete = '', aujourdhui = new Date(),
  note = '', stockageOk = true, imagesOk = true, nouvelleCategorie = 'cisco', nbEquipements = 0 } = {}) {
  const onglets = [{ id: null, label: 'Tous' }, ...CATEGORIES_JOURNAL.map((c) => ({ id: c.id, label: c.label }))]
    .map((c) => `<button type="button" class="j-onglet" data-jcat="${esc(c.id ?? '')}" aria-pressed="${categorieId === c.id}">${esc(c.label)} <span class="j-compte">${compte(c.id)}</span></button>`).join('');
  const filtres = FILTRES_JOURNAL.map((f) => `<option value="${esc(f.id)}"${f.id === filtre ? ' selected' : ''}>${esc(f.label)}</option>`).join('');
  const lignes = entrees.map((e) => {
    const revoir = aRevoir(e, aujourdhui);
    return `<li class="j-ligne"><a class="j-ligne-lien" href="${esc(routeEntreeJournal(e.id))}">`
      + `<span class="j-ligne-titre">${esc(e.titre)}</span>`
      + `<span class="j-ligne-meta">${esc(e.reference)} · ${esc(categorie(e.categorie).label)} · v${esc(e.version)} · modifié le ${esc(e.modifieLe)}</span>`
      + `${revoir ? '<span class="j-revoir"><span aria-hidden="true">⚠</span> Pas revu depuis plus de deux mois</span>' : ''}</a>`
      + `${pastilleEtat(e.etat)}</li>`;
  }).join('');
  const vide = total === 0
    ? `<div class="j-vide"><p><b>Ton journal est vide.</b> Crée un premier labo ci-dessus, ou ouvre une fiche (par exemple le TP VLAN) et clique sur « Documenter dans le journal » : le titre, l’adressage et les commandes seront repris.</p></div>`
    : `<p class="j-vide">Aucun labo ne correspond à ces filtres.</p>`;
  const cats = CATEGORIES_JOURNAL.map((c) => `<option value="${esc(c.id)}"${c.id === nouvelleCategorie ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
  return fil([{ nom: 'Accueil', route: '#/' }, { nom: 'Journal de labo' }])
    + `<h1>Journal de labo</h1>`
    + `<p class="intro">La documentation de tes labos et projets, au format d’un dossier d’entreprise : référence, version, historique, adressage, configuration, validation, exploitation et incidents. Chaque labo s’exporte en PDF A4 que tu gardes sur ton ordinateur.</p>`
    + `<p class="notice notice-compact"><b>Aucun mot de passe.</b> Un texte qui en contient un est refusé à l’enregistrement : note seulement où il est rangé. Le journal reste dans ce navigateur (rien n’est envoyé) : garde une copie avec « Sauvegarder le journal ».`
    + `${stockageOk ? '' : ' <b>Le stockage de ce navigateur est indisponible : rien ne sera conservé après fermeture.</b>'}`
    + `${imagesOk ? '' : ' <b>Les captures ne peuvent pas être conservées dans ce navigateur : elles seront perdues à la fermeture.</b>'}</p>`
    + `<form class="j-nouveau" id="jNouveauForm" aria-label="Nouveau labo"><label for="jNouvelleCat">Nouveau labo</label>`
    + `<select id="jNouvelleCat">${cats}</select><button type="submit" class="primary-button j-btn">+ Créer</button>`
    + `<button type="button" class="secondary-button j-mini-btn" id="jExemple">Voir un exemple rempli</button>`
    + `<a class="secondary-button j-lien-btn" id="jInventaire" href="#/inventaire">Inventaire des équipements${nbEquipements ? ` (${nbEquipements})` : ''}</a></form>`
    + `<div class="j-onglets" role="group" aria-label="Catégorie">${onglets}</div>`
    + `<div class="j-outils"><label class="sr-only" for="jRecherche">Rechercher dans le journal</label>`
    + `<input id="jRecherche" type="search" autocomplete="off" placeholder="Rechercher un titre, une référence, une adresse…" value="${esc(requete)}">`
    + `<label for="jFiltre" class="sr-only">État</label><select id="jFiltre">${filtres}</select></div>`
    + (entrees.length ? `<ul class="j-liste" aria-label="Labos">${lignes}</ul>` : vide)
    + `<section class="j-sauvegarde" aria-labelledby="jSauvTitre"><h2 id="jSauvTitre">Sauvegarde</h2>`
    + `<p>Un fichier JSON avec tous tes labos et leurs captures. Range-le avec tes PDF ; il se restaure ici, ou dans un autre navigateur.</p>`
    + `<div class="params-actions"><button type="button" class="secondary-button" id="jSauver"${total ? '' : ' disabled'}>Sauvegarder le journal (fichier)</button>`
    + `<label class="secondary-button j-fichier" for="jRestaurer">Restaurer une sauvegarde</label><input id="jRestaurer" type="file" accept="application/json,.json" class="sr-only">`
    + `<span class="params-note" id="jNote" role="status" aria-live="polite">${esc(note)}</span></div></section>`;
}

const err = (erreurs, cle) => (erreurs[cle] ? `<p class="param-err" id="jerr-${esc(cle.replace(/\./g, '-'))}" role="alert">${esc(erreurs[cle])}</p>` : '');
const inv = (erreurs, cle) => (erreurs[cle] ? ` aria-invalid="true" class="is-invalid" aria-describedby="jerr-${esc(cle.replace(/\./g, '-'))}"` : '');

const exempleChamp = (e, id) => EXEMPLES_CHAMPS[e.categorie]?.[id] ?? EXEMPLES_CHAMPS.cisco[id] ?? '';
const ph = (t) => (t ? ` placeholder="${esc(`Ex. : ${t}`)}"` : '');

function champTexte(c, e, erreurs) {
  const id = `jf-${c.id}`; const p = ph(exempleChamp(e, c.id));
  const aide = c.aide ? `<p class="param-aide">${esc(c.aide)}</p>` : '';
  const ctl = c.long
    ? `<textarea id="${id}" data-j="${esc(c.id)}" rows="3" maxlength="${c.max}"${p}${inv(erreurs, c.id)}>${esc(e[c.id])}</textarea>`
    : `<input id="${id}" data-j="${esc(c.id)}" type="text" maxlength="${c.max}" autocomplete="off"${p} value="${esc(e[c.id])}"${inv(erreurs, c.id)}>`;
  return `<div class="j-champ${c.long ? ' j-large' : ''}"><label for="${id}">${esc(c.label)}</label>${ctl}${aide}${err(erreurs, c.id)}</div>`;
}
const champ = (id) => CHAMPS_TEXTE.find((c) => c.id === id);

function tableauEditable(nom, e, erreurs, { titreAjout, aide = '' }) {
  // Libellés adaptés au système du labo (Azure : sous-réseaux et VNet plutôt qu'interfaces et VLAN).
  const LIBELLES = { azure: { adressage: { equipement: 'Ressource ou VNet', interface: 'Sous-réseau / carte', vlan: 'VNet / région', passerelle: 'Passerelle (Azure : .1)' } } };
  const cols = TABLEAUX[nom].map((c) => ({ ...c, label: LIBELLES[e.categorie]?.[nom]?.[c.id] ?? c.label }));
  const lignes = e[nom];
  const exl = EXEMPLES_TABLEAUX[e.categorie]?.[nom] ?? EXEMPLES_TABLEAUX.cisco[nom] ?? {};
  const phc = (col) => (exl[col] ? ` placeholder="${esc(`ex. ${exl[col]}`)}"` : '');
  const corps = lignes.map((l, i) => `<tr>${cols.map((c) => {
    const cle = `${nom}.${i}.${c.id}`; const idc = `jt-${nom}-${i}-${c.id}`;
    if (c.id === 'resultat') {
      return `<td data-label="${esc(c.label)}"><label class="sr-only" for="${idc}">${esc(c.label)}, ligne ${i + 1}</label><select id="${idc}" data-jt="${nom}" data-row="${i}" data-col="resultat">`
        + RESULTATS.map((r) => `<option value="${esc(r.id)}"${r.id === l.resultat ? ' selected' : ''}>${esc(r.symbole)} ${esc(r.label)}</option>`).join('') + `</select></td>`;
    }
    const zone = c.id === 'code' || ['solution', 'cause', 'symptome', 'test', 'attendu'].includes(c.id);
    const ctl = zone
      ? `<textarea id="${idc}" class="cell${c.id === 'code' ? ' j-code' : ''}" data-jt="${nom}" data-row="${i}" data-col="${esc(c.id)}" rows="${c.id === 'code' ? 8 : 2}" spellcheck="${c.id === 'code' ? 'false' : 'true'}"${phc(c.id)}${inv(erreurs, cle)}>${esc(l[c.id])}</textarea>`
      : `<input id="${idc}" class="cell" type="text" autocomplete="off" spellcheck="false" data-jt="${nom}" data-row="${i}" data-col="${esc(c.id)}"${phc(c.id)} value="${esc(l[c.id])}"${inv(erreurs, cle)}>`;
    return `<td data-label="${esc(c.label)}"><label class="sr-only" for="${idc}">${esc(c.label)}, ligne ${i + 1}</label>${ctl}${err(erreurs, cle)}</td>`;
  }).join('')}<td class="j-retrait"><button type="button" class="secondary-button j-mini" data-jdel="${nom}" data-row="${i}" aria-label="Supprimer la ligne ${i + 1}">✕</button></td></tr>`).join('');
  const exemple = cols.filter((c) => c.id !== 'resultat' && exl[c.id]).map((c) => `${c.label} : ${exl[c.id].split('\n')[0]}`).join(' · ');
  return `${aide ? `<p class="param-aide">${esc(aide)}</p>` : ''}`
    + (!lignes.length && exemple ? `<p class="param-aide j-exemple"><b>Exemple de ligne</b> · ${esc(exemple)}</p>` : '')
    + (lignes.length ? `<div class="j-tableau"><table class="plan j-table-${nom}"><thead><tr>${cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}<th><span class="sr-only">Supprimer</span></th></tr></thead><tbody>${corps}</tbody></table></div>` : '')
    + `<button type="button" class="secondary-button j-ajout" data-jadd="${nom}">${esc(titreAjout)}</button>`;
}

function section(id, titre, contenu, aide = '') {
  return `<section class="j-section" id="js-${id}" aria-labelledby="jst-${id}"><h2 id="jst-${id}">${esc(titre)}</h2>${aide ? `<p class="j-aide">${esc(aide)}</p>` : ''}${contenu}</section>`;
}

/** Fiche d'un labo : saisie, captures, versions, export. */
export function journalEditeurMarkup({ entree: e, erreurs = {}, note = '', modifie = false, versionOuverte = false, confirmerSuppression = false,
  imagesUrl = {}, titresFiches = {}, routeFiche = (id) => `#/tache/${id}`, imagesOk = true, equipementsHtml = '', schemaHtml = '' } = {}) {
  const nbErr = Object.keys(erreurs).length;
  const opt = (liste, val) => liste.map((x) => `<option value="${esc(x.id ?? x)}"${(x.id ?? x) === val ? ' selected' : ''}>${esc(x.label ?? x)}</option>`).join('');
  const ident = `<div class="params-grid">`
    + `<div class="j-champ j-large"><label for="jf-titre">Titre du document</label><input id="jf-titre" data-j="titre" type="text" maxlength="120" autocomplete="off"${ph(exempleChamp(e, 'titre'))} value="${esc(e.titre)}"${inv(erreurs, 'titre')}>${err(erreurs, 'titre')}</div>`
    + `<div class="j-champ"><label for="jf-categorie">Catégorie</label><select id="jf-categorie" data-j="categorie">${opt(CATEGORIES_JOURNAL, e.categorie)}</select></div>`
    + `<div class="j-champ"><label for="jf-etat">État</label><select id="jf-etat" data-j="etat">${ETATS_JOURNAL.map((x) => `<option value="${esc(x.id)}"${x.id === e.etat ? ' selected' : ''}>${esc(x.symbole)} ${esc(x.label)}</option>`).join('')}</select></div>`
    + `<div class="j-champ"><label for="jf-auteur">Rédigé par</label><input id="jf-auteur" data-j="auteur" type="text" maxlength="120" autocomplete="off" placeholder="Ex. : B. Nganbou" value="${esc(e.auteur)}"${inv(erreurs, 'auteur')}>${err(erreurs, 'auteur')}</div>`
    + `<div class="j-champ"><label for="jf-classification">Classification</label><select id="jf-classification" data-j="classification">${opt(CLASSIFICATIONS, e.classification)}</select></div>`
    + `</div><dl class="j-controle"><div><dt>Référence</dt><dd>${esc(e.reference)}</dd></div><div><dt>Version</dt><dd>${esc(e.version)}</dd></div>`
    + `<div><dt>Créé le</dt><dd>${esc(dateLongue(e.creeLe))}</dd></div><div><dt>Modifié le</dt><dd>${esc(dateLongue(e.modifieLe))}</dd></div></dl>`;

  const captures = e.captures.map((c, i) => `<li class="j-capture">`
    + (imagesUrl[c.id] ? `<img src="${esc(imagesUrl[c.id])}" alt="${esc(c.legende || c.nom)}">` : `<span class="j-capture-absente">Image indisponible dans ce navigateur</span>`)
    + `<div class="j-capture-texte"><span class="j-capture-nom">Figure ${i + 1} · ${esc(c.nom)}</span>`
    + `<label class="sr-only" for="jc-${i}">Légende de la figure ${i + 1}</label><input id="jc-${i}" type="text" maxlength="300" data-jcap="${i}" placeholder="Légende : ce que prouve cette capture" value="${esc(c.legende)}"${inv(erreurs, `captures.${i}.legende`)}>${err(erreurs, `captures.${i}.legende`)}`
    + `<button type="button" class="secondary-button j-mini" data-jcapdel="${i}">Retirer</button></div></li>`).join('');
  const plein = e.captures.length >= MAX_CAPTURES;

  const refs = e.fiches.length
    ? `<ul class="j-refs">${e.fiches.map((f) => `<li><a href="${esc(routeFiche(f))}">${esc(titresFiches[f] ?? f)}</a></li>`).join('')}</ul>`
    : '<p class="param-aide">Aucune fiche liée. Depuis une fiche, « Documenter dans le journal » crée un labo déjà relié.</p>';

  const revisions = `<table class="j-revisions"><thead><tr><th scope="col">Version</th><th scope="col">Date</th><th scope="col">Modification</th></tr></thead><tbody>`
    + e.revisions.slice().reverse().map((r) => `<tr><td>${esc(r.version)}</td><td>${esc(r.date)}</td><td>${esc(r.resume)}</td></tr>`).join('') + `</tbody></table>`;
  const panneauVersion = versionOuverte
    ? `<form class="j-version" id="jVersionForm" aria-label="Nouvelle version"><label for="jVersionResume">Ce qui change dans cette version</label>`
      + `<input id="jVersionResume" type="text" maxlength="300" autocomplete="off" placeholder="Ex. : ajout du VLAN 20 TECHNIQUE">`
      + `<label class="j-case"><input type="checkbox" id="jVersionMajeure"> Changement majeur (version ${esc(String(Number(e.version.split('.')[0]) + 1))}.0)</label>`
      + `<div class="params-actions"><button type="submit" class="primary-button j-btn">Publier la version</button><button type="button" class="secondary-button" id="jVersionAnnuler">Annuler</button></div></form>`
    : '';
  const suppression = confirmerSuppression
    ? `<div class="j-confirmer" role="alert"><p><b>Supprimer « ${esc(e.titre || e.reference)} » ?</b> Le labo et ses captures seront effacés de ce navigateur. Exporte le PDF ou sauvegarde le journal avant si tu veux en garder une trace.</p>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-danger" id="jSupprimerOui">Oui, supprimer</button><button type="button" class="secondary-button" id="jSupprimerNon">Non, garder</button></div></div>`
    : '';

  const barre = `<div class="j-barre" role="toolbar" aria-label="Actions du document">`
    + `<button type="button" class="primary-button j-btn" id="jEnregistrer">Enregistrer</button>`
    + `<button type="button" class="secondary-button" id="jPdf">Exporter en PDF</button>`
    + `<button type="button" class="secondary-button" id="jVersion" aria-expanded="${versionOuverte}">Nouvelle version</button>`
    + `<button type="button" class="secondary-button" id="jDupliquer">Dupliquer</button>`
    + `<button type="button" class="secondary-button j-danger" id="jSupprimer">Supprimer</button>`
    + `<span class="params-note${nbErr ? ' is-warn' : ''}" id="jNote" role="status" aria-live="polite">${esc(nbErr ? `${nbErr} champ(s) à corriger avant d’enregistrer ou d’exporter.` : (note || (modifie ? 'Modifications non enregistrées.' : '')))}</span></div>`;

  return fil([{ nom: 'Accueil', route: '#/' }, { nom: 'Journal de labo', route: ROUTE_JOURNAL }, { nom: e.titre || e.reference }])
    + `<h1>${esc(e.titre || 'Nouveau labo')}</h1><p class="j-sous">${esc(e.reference)} · v${esc(e.version)} · ${pastilleEtat(e.etat)}</p>`
    + barre + panneauVersion + suppression
    + `<form id="jForm" class="j-form" novalidate aria-label="Document du labo">`
    + section('identification', 'Identification', ident)
    + section('objet', '1. Objet et environnement', champTexte(champ('objet'), e, erreurs) + champTexte(champ('environnement'), e, erreurs))
    + section('architecture', '2. Architecture', champTexte(champ('architecture'), e, erreurs)
      + `<h3 class="sch-titre">Schéma</h3><div id="schBloc" class="sch-bloc">${schemaHtml}</div>`,
      'Décris le montage en quelques phrases, puis compose le schéma : pose les équipements, relie-les, regroupe-les en zones. Il sera dessiné dans le PDF.')
    + section('equipements', `3. Équipements (${e.equipements.length})`, equipementsHtml, 'Coche les équipements de l’inventaire utilisés dans ce labo et écris leur rôle ici. Leurs interfaces, VLAN et tables de routage seront en annexe du PDF.')
    + section('adressage', '4. Plan d’adressage', tableauEditable('adressage', e, erreurs, { titreAjout: '+ Ajouter une ligne' }))
    + section('configuration', '5. Configuration', tableauEditable('configuration', e, erreurs, { titreAjout: '+ Ajouter un bloc de commandes' }), 'Colle les commandes appliquées, un bloc par équipement ou par phase. Une ligne « secret » se termine avant le mot de passe.')
    + section('validation', '6. Validation', tableauEditable('validation', e, erreurs, { titreAjout: '+ Ajouter un test' }), '« Conforme » se coche après avoir lancé le test toi-même.')
    + section('exploitation', '7. Exploitation', `<div class="params-grid">${['acces', 'rangement', 'sauvegarde', 'retourArriere'].map((id) => champTexte(champ(id), e, erreurs)).join('')}</div>`)
    + section('incidents', '8. Incidents et solutions', tableauEditable('incidents', e, erreurs, { titreAjout: '+ Ajouter un incident' }), 'Le message d’erreur exact, sa cause, ce qui l’a réglé : c’est ce qui te fera gagner le plus de temps.')
    + section('references', '9. Références', refs + champTexte(champ('referencesTexte'), e, erreurs))
    + section('captures', `10. Captures (${e.captures.length} / ${MAX_CAPTURES})`,
      (e.captures.length ? `<ul class="j-captures">${captures}</ul>` : '')
      + `<div class="params-actions"><label class="secondary-button j-fichier${plein ? ' is-disabled' : ''}" for="jCaptureFichier"${plein ? ' aria-disabled="true"' : ''}>+ Ajouter une capture (PNG ou JPEG)</label>`
      + `<input id="jCaptureFichier" type="file" accept="image/png,image/jpeg" class="sr-only"${plein ? ' disabled' : ''}>`
      + `<span class="param-aide">Ou colle une capture d’écran avec Ctrl+V sur cette page.${imagesOk ? '' : ' <b>Ce navigateur ne peut pas conserver les images : elles seront perdues à la fermeture.</b>'}</span></div>`,
      'Les captures qui prouvent que ça marche (jusqu’à 16) : topologie, show vlan brief, ping, session SSH, pages du portail… Vérifie qu’aucune ne montre un mot de passe.')
    + `</form>`
    + section('historique', 'Historique des révisions', revisions, '« Nouvelle version » ajoute une ligne ici et sur la page de garde du PDF.');
}
