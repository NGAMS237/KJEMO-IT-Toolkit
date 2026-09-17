// Point 2 (Codex) : import depuis './generators.mjs' — même répertoire dist/
// GitHub Pages publie dist/ à la racine ; './generators.mjs' est donc accessible.
import { tools, normalizeScript, textToCode, EXECUTION_NOTES,
         searchTools, searchCommonErrors } from './generators.mjs';
import { categoriesVisibles, categorieParNom, CATEGORIE_TOUT } from './categories.mjs';
import { MODES, MODE_DEFAUT, CLE_MODE, THEMES, THEME_DEFAUT, CLE_THEME,
         creerPreference } from './preferences.mjs';

const CAT_TOUT = CATEGORIE_TOUT;
// Catalogue filtré : une catégorie déclarée mais SANS outil n'est pas affichée.
const categoriesAffichees = categoriesVisibles(tools);
const categories = [CAT_TOUT, ...categoriesAffichees.map((c) => c.name)];
let selectedCategory = CAT_TOUT;
let currentTool = null;

// ---------------------------------------------------------------------------
// Mode de lecture — Débutant / Technicien
// Les deux modes utilisent EXACTEMENT le même générateur de script : le mode
// change ce qui est expliqué, jamais ce qui est produit. Aucun avertissement,
// aucune confirmation, aucune information de sécurité n'est masquée en mode
// Débutant — ce sont précisément les personnes qui en ont le plus besoin.
// ---------------------------------------------------------------------------
const prefMode = creerPreference({
  cle: CLE_MODE,
  valeurs: MODES.map((m) => m.id),
  defaut: MODE_DEFAUT,
});

function modeCourant() { return prefMode.lire(); }
function estDebutant() { return modeCourant() === 'debutant'; }

/** Niveau de risque traduit en langage courant, pour le mode Débutant. */
const RISQUE_SIMPLE = {
  diagnostic: 'Ce script ne modifie rien. Il observe et affiche, c\u2019est tout.',
  safe: 'Ce script modifie un réglage, et la modification peut être défaite.',
  caution: 'Ce script modifie la configuration de la machine. Lis l\u2019aperçu avant de l\u2019exécuter.',
  destructive: 'Ce script peut supprimer ou couper quelque chose. Ne l\u2019exécute qu\u2019en connaissance de cause, et jamais en production sans essai préalable.',
};

// ---------------------------------------------------------------------------
// Thème — Clair / Sombre / Système
// Le thème ne touche que des jetons de couleur CSS. Il est appliqué sur
// <html> par un attribut data-theme, ce qui le rend effectif avant même que la
// page soit peinte au rechargement. « Système » laisse décider le navigateur.
// ---------------------------------------------------------------------------
const prefTheme = creerPreference({
  cle: CLE_THEME,
  valeurs: THEMES.map((t) => t.id),
  defaut: THEME_DEFAUT,
});

function appliquerTheme() {
  document.documentElement.dataset.theme = prefTheme.lire();
}

function renderThemeSelector() {
  const zone = document.querySelector('#topbarActions');
  if (!zone) return;
  const actuel = prefTheme.lire();
  const html =
    `<div class="theme-switch" id="themeSelector" role="group" aria-label="Thème">`
    + THEMES.map((t) =>
        `<button type="button" class="theme-option${t.id === actuel ? ' is-selected' : ''}"`
        + ` data-theme="${t.id}" aria-pressed="${t.id === actuel ? 'true' : 'false'}"`
        + ` aria-label="Thème ${textToCode(t.label)}" title="Thème ${textToCode(t.label)}">`
        + `<span aria-hidden="true">${textToCode(t.symbole)}</span></button>`).join('')
    + `</div>`;
  zone.insertAdjacentHTML('beforeend', html);

  zone.querySelectorAll('.theme-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.theme === prefTheme.lire()) return;
      prefTheme.definir(btn.dataset.theme);
      appliquerTheme();
      render();
    });
  });
}

function renderModeSelector() {
  const zone = document.querySelector('#topbarActions');
  if (!zone) return;
  const actuel = modeCourant();
  zone.innerHTML =
    `<div class="mode-switch" id="modeSelector" role="group" aria-label="Mode de lecture">`
    + MODES.map((m) =>
        `<button type="button" class="mode-option${m.id === actuel ? ' is-selected' : ''}"`
        + ` data-mode="${m.id}" aria-pressed="${m.id === actuel ? 'true' : 'false'}"`
        + ` title="${textToCode(m.description)}">${textToCode(m.label)}</button>`).join('')
    + `</div>`;

  zone.querySelectorAll('.mode-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === modeCourant()) return;
      prefMode.definir(btn.dataset.mode);
      render();
    });
  });
}

/** Referme le menu latéral, s'il est ouvert (petit écran uniquement). */
function fermerMenu() {
  const p = document.querySelector('.sidebar');
  const b = document.querySelector('#menuButton');
  if (!p || !b) return;
  p.classList.remove('open');
  b.setAttribute('aria-expanded', 'false');
}

function renderNavigation() {
  const nav = document.querySelector('#navigation');
  nav.innerHTML = categories.map((category) => {
    const meta    = category === CAT_TOUT ? null : categorieParNom(category);
    const icone   = category === CAT_TOUT ? '\u2261' : (meta?.icon ?? '\u25CB');
    const count   = category === CAT_TOUT
      ? tools.length
      : (categoriesAffichees.find((c) => c.name === category)?.count ?? 0);
    const actif   = category === selectedCategory;
    // Les noms canoniques sont longs et le panneau est étroit : le libellé est
    // tronqué visuellement, mais reste lisible au survol et complet pour les
    // lecteurs d'écran.
    return `<button type="button" data-category="${category}" class="${actif ? 'active' : ''}"`
      + ` title="${textToCode(category)}" aria-current="${actif ? 'true' : 'false'}">`
      + `<span class="nav-icon" aria-hidden="true">${textToCode(icone)}</span>`
      + `<span class="nav-label">${textToCode(category)}</span>`
      + `<span class="nav-count">${count}</span></button>`;
  }).join('');
  nav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category; revenirAccueil(); fermerMenu();
  }));
}

/**
 * Grille de catégories de l'accueil : nom, icône sobre, décompte, courte
 * description et état sélectionné visible. Elle double la barre latérale, qui
 * est masquée sur téléphone.
 */
function renderCategoryGrid() {
  const grille = document.querySelector('#categoryGrid');
  if (!grille) return;

  const carte = (nom, icone, description, count, actif, sous) =>
    `<button type="button" role="listitem" class="category-card${actif ? ' is-selected' : ''}"`
    + ` data-category="${nom}" aria-pressed="${actif ? 'true' : 'false'}">`
    + `<span class="category-icon" aria-hidden="true">${textToCode(icone)}</span>`
    + `<span class="category-name">${textToCode(nom === CAT_TOUT ? 'Tous les outils' : nom)}</span>`
    + `<span class="category-count">${count} outil${count > 1 ? 's' : ''}</span>`
    + (description ? `<span class="category-desc">${textToCode(description)}</span>` : '')
    + (sous && sous.length
        ? `<span class="category-sub">${textToCode(sous.map((x) => x.name).join(' · '))}</span>`
        : '')
    + `</button>`;

  grille.innerHTML =
    carte(CAT_TOUT, '\u2261', 'Parcourir l\u2019ensemble du catalogue.', tools.length, selectedCategory === CAT_TOUT, null)
    + categoriesAffichees
        .map((c) => carte(c.name, c.icon, c.description, c.count, selectedCategory === c.name, c.sous))
        .join('');

  grille.querySelectorAll('.category-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.category;
      revenirAccueil();
    });
  });
}

// ---------------------------------------------------------------------------
// Stockage local — favoris et historique
// Le stockage peut être indisponible (navigation privée, site bloqué) : toute
// lecture et toute écriture sont protégées, et l'application fonctionne sans.
// ---------------------------------------------------------------------------
const CLE_FAVORIS     = 'kjemo.favoris.v1';
const CLE_HISTORIQUE  = 'kjemo.historique.v1';
const HISTORIQUE_MAX  = 6;

function lireStockage(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return defaut;
    const val = JSON.parse(brut);
    return Array.isArray(val) ? val : defaut;
  } catch {
    return defaut;
  }
}

function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

/** N'accepte que des identifiants d'outils réellement existants. */
function idsValides(liste) {
  const connus = new Set(tools.map((t) => t.id));
  return liste.filter((id) => connus.has(id));
}

function lireFavoris()      { return idsValides(lireStockage(CLE_FAVORIS, [])); }
function estFavori(id)      { return lireFavoris().includes(id); }
function basculerFavori(id) {
  const actuels = lireFavoris();
  const suivants = actuels.includes(id) ? actuels.filter((x) => x !== id) : [...actuels, id];
  ecrireStockage(CLE_FAVORIS, suivants);
  return suivants.includes(id);
}

function lireHistorique() { return idsValides(lireStockage(CLE_HISTORIQUE, [])); }
function noterConsultation(id) {
  const sansDoublon = lireHistorique().filter((x) => x !== id);
  ecrireStockage(CLE_HISTORIQUE, [id, ...sansDoublon].slice(0, HISTORIQUE_MAX));
}

// ---------------------------------------------------------------------------
// Routes directes — #/outil/<id>
// Permet de partager le lien d'une fiche, de recharger sans la perdre et
// d'utiliser le bouton Retour du navigateur.
// ---------------------------------------------------------------------------
function outilDepuisHash() {
  const m = /^#\/outil\/([A-Za-z0-9_-]+)$/.exec(location.hash || '');
  if (!m) return null;
  return tools.find((t) => t.id === m[1]) ?? null;
}

function ecrireHash(tool) {
  const cible = tool ? `#/outil/${tool.id}` : '#/';
  if (location.hash !== cible) {
    history.pushState(null, '', cible);
  }
}

/** Ouvre une fiche : met à jour l'état, l'URL et l'historique local. */
function ouvrirOutil(tool, { pousserHash = true } = {}) {
  currentTool = tool;
  noterConsultation(tool.id);
  if (pousserHash) ecrireHash(tool);
  render();
}

function revenirAccueil({ pousserHash = true } = {}) {
  currentTool = null;
  if (pousserHash) ecrireHash(null);
  render();
}

/** Applique l'URL courante à l'état de l'application. */
function appliquerHash() {
  const tool = outilDepuisHash();
  if (tool) {
    if (currentTool?.id !== tool.id) ouvrirOutil(tool, { pousserHash: false });
  } else if (currentTool) {
    revenirAccueil({ pousserHash: false });
  }
}

/**
 * Raccourcis affichés en haut de l'accueil : favoris puis derniers consultés.
 * Masqués pendant une recherche, qui a ses propres résultats.
 */
function raccourcisMarkup() {
  if (currentQuery()) return '';
  const parId = (id) => tools.find((t) => t.id === id);
  const favoris = lireFavoris().map(parId).filter(Boolean);
  const recents = lireHistorique().map(parId).filter(Boolean)
    .filter((t) => !favoris.some((f) => f.id === t.id));

  const puce = (t, cls) =>
    `<button class="shortcut ${cls}" data-tool="${t.id}" type="button">`
    + `<span class="shortcut-icon">${textToCode(t.icon)}</span>${textToCode(t.title)}</button>`;

  let html = '';
  if (favoris.length) {
    html += `<section class="shortcuts" id="favorisSection"><h2>Favoris</h2>`
      + `<div class="shortcut-row">${favoris.map((t) => puce(t, 'is-fav')).join('')}</div></section>`;
  }
  if (recents.length) {
    html += `<section class="shortcuts" id="historiqueSection"><h2>Consultés récemment</h2>`
      + `<div class="shortcut-row">${recents.map((t) => puce(t, 'is-recent')).join('')}</div></section>`;
  }
  return html;
}

function currentQuery() {
  return document.querySelector('#search').value.trim();
}

/**
 * Résultats de recherche enrichis : chaque entrée porte le motif de
 * correspondance, affiché sur la carte pour que l'utilisateur comprenne
 * POURQUOI cet outil lui est proposé.
 */
function searchResults() {
  return searchTools(currentQuery(), selectedCategory);
}

function filteredTools() {
  return searchResults().map((r) => r.tool);
}

/**
 * Bandeau affiché quand la requête correspond à une erreur commune à tous les
 * scripts. Répondre par l'explication vaut mieux que lister les huit outils.
 */
function commonErrorBanner(query) {
  const hits = searchCommonErrors(query);
  if (hits.length === 0) return '';
  const blocs = hits.map((e) => `<div class="error-entry">`
    + `<p class="err-msg">${textToCode(e.message)}`
    + (e.code ? ` <span class="err-code">${textToCode(e.code)}</span>` : '')
    + `</p>`
    + `<p class="err-cause"><strong>Cause :</strong> ${textToCode(e.cause)}</p>`
    + `<p class="err-fix"><strong>Correction :</strong> ${textToCode(e.fix)}</p>`
    + (e.command ? `<pre class="cmd">${textToCode(e.command)}</pre>` : '')
    + `</div>`).join('');
  return `<div class="common-error-banner" id="commonErrorBanner">`
    + `<p class="banner-title">Cette erreur concerne <strong>tous les scripts</strong>, pas un outil en particulier.</p>`
    + blocs
    + `</div>`;
}

function renderHome() {
  renderCategoryGrid();
  const grid    = document.querySelector('#toolGrid');
  const query   = currentQuery();
  const results = searchResults();

  // Bandeau d'erreur commune, inséré avant la grille
  const zone = document.querySelector('#commonErrorZone');
  if (zone) zone.innerHTML = commonErrorBanner(query);

  const zoneRaccourcis = document.querySelector('#shortcutsZone');
  if (zoneRaccourcis) {
    zoneRaccourcis.innerHTML = raccourcisMarkup();
    zoneRaccourcis.querySelectorAll('.shortcut').forEach((btn) => {
      const t = tools.find((x) => x.id === btn.dataset.tool);
      if (t) btn.addEventListener('click', () => ouvrirOutil(t));
    });
  }

  document.querySelector('#toolCount').textContent =
    `${results.length} outil${results.length > 1 ? 's' : ''}`;

  grid.innerHTML = '';
  if (!results.length) {
    grid.innerHTML = query
      ? `<div class="empty">Aucun outil ne correspond à « ${textToCode(query)} ».<br />`
        + `Essaie un mot plus court, ou colle le message d\u2019erreur que tu vois.</div>`
      : '<div class="empty">Aucun outil dans cette catégorie.</div>';
    return;
  }

  const template = document.querySelector('#toolTemplate');
  results.forEach(({ tool, reason }) => {
    const card = template.content.cloneNode(true);
    card.querySelector('.tool-icon').textContent = tool.icon;
    card.querySelector('.tag').textContent = tool.subcategory
      ? `${tool.category.toUpperCase()} · ${tool.subcategory}`
      : tool.category.toUpperCase();
    card.querySelector('h3').textContent = tool.title;
    card.querySelector('p').textContent = tool.summary;

    // Motif de correspondance — seulement en situation de recherche
    if (reason) {
      const why = document.createElement('p');
      why.className = 'match-reason';
      why.textContent = `Correspond au ${reason}`;
      card.querySelector('h3').after(why);
    }

    card.querySelector('.open-tool').addEventListener('click', () => ouvrirOutil(tool));

    const fav = card.querySelector('.fav-toggle');
    const peindreFav = (actif) => {
      fav.textContent = actif ? '★' : '☆';
      fav.setAttribute('aria-pressed', String(actif));
      fav.title = actif ? 'Retirer des favoris' : 'Ajouter aux favoris';
      fav.classList.toggle('is-fav', actif);
    };
    peindreFav(estFavori(tool.id));
    fav.addEventListener('click', (ev) => {
      ev.stopPropagation();
      peindreFav(basculerFavori(tool.id));
      renderHome();
    });

    grid.append(card);
  });
}

/**
 * Bloc d'une erreur fréquente : message, cause, correction, commande éventuelle.
 */
function errorEntryMarkup(e) {
  return `<div class="error-entry">`
    + `<p class="err-msg">${textToCode(e.message)}`
    + (e.code ? ` <span class="err-code">${textToCode(e.code)}</span>` : '')
    + `</p>`
    + `<p class="err-cause"><strong>Cause :</strong> ${textToCode(e.cause)}</p>`
    + `<p class="err-fix"><strong>Correction :</strong> ${textToCode(e.fix)}</p>`
    + (e.command ? `<pre class="cmd">${textToCode(e.command)}</pre>` : '')
    + `</div>`;
}

/**
 * Systèmes compatibles, prérequis, procédure d'exécution et erreurs fréquentes.
 * La procédure d'exécution est commune à tous les outils (EXECUTION_NOTES) ;
 * les prérequis et les erreurs propres viennent de l'outil lui-même.
 */
/**
 * Vérifications après exécution et procédure d'annulation, en trois blocs
 * distincts : constater, procédure normale, cas exceptionnel.
 * Sujet de sécurité : un technicien qui modifie une configuration doit savoir
 * comment constater que ça a marché, et comment revenir en arrière sans casser
 * davantage.
 */
/** Vérifications après exécution — section 5. Repliée par défaut, comme la
 *  procédure d'annulation : la liste courte de contrôles reste, elle, visible
 *  au-dessus, sans repli. */
function verifyAfterMarkup(tool) {
  const li = (x) => `<li>${textToCode(x)}</li>`;
  return `<details class="details verify-after" id="verifyAfter">`
    + `<summary>Contrôles à effectuer après exécution</summary>`
    + `<ul>${tool.verifyAfter.map(li).join('')}</ul>`
    + `</details>`;
}

function rollbackMarkup(tool) {
  const r  = tool.rollback;
  const li = (x) => `<li>${textToCode(x)}</li>`;

  const etiquette = tool.reversible
    ? `<span class="rev-badge rev-yes">Réversible</span>`
    : `<span class="rev-badge rev-na">Lecture seule</span>`;

  const bloc = (titre, classe, contenu) => contenu
    ? `<h4 class="rb-step ${classe}">${textToCode(titre)}</h4>`
      + `<pre class="cmd">${textToCode(contenu)}</pre>`
    : '';

  return `<details class="details rollback" id="rollbackBlock">`
    + `<summary>Revenir en arrière ${etiquette}</summary>`
    + `<p>${textToCode(r.summary)}</p>`
    + bloc('1. Constater avant d\u2019agir', 'rb-diag', r.diagnostic)
    + bloc('2. Procédure normale', 'rb-normal', r.command)
    + (r.exceptional
        ? `<div class="rb-exceptional" id="rollbackExceptional">`
          + bloc('3. Cas exceptionnel', 'rb-exc', r.exceptional)
          + `</div>`
        : '')
    + (r.warning ? `<p class="rollback-warning">${textToCode(r.warning)}</p>` : '')
    + `</details>`;
}

/**
 * Bloc « compatibilité et prérequis » — section 2 de la fiche.
 * Ce qui conditionne l'exécution reste TOUJOURS visible : systèmes couverts,
 * élévation nécessaire, droits exigés. Rien ici n'est repliable.
 */
function compatMarkup(tool) {
  const li = (x) => `<li>${textToCode(x)}</li>`;
  const admin = tool.requiresAdmin
    ? `<p class="admin-flag admin-required">Console PowerShell <strong>en tant qu’administrateur</strong> obligatoire.</p>`
    : `<p class="admin-flag admin-optional">Aucune élévation <strong>administrateur locale</strong> n’est nécessaire. Les droits listés ci-dessous restent obligatoires.</p>`;

  return `<div class="details prereqs" id="prereqBlock">`
    + `<h3>Systèmes compatibles</h3><ul>${tool.os.map(li).join('')}</ul>`
    + `<h3>Prérequis</h3>${admin}<ul>${tool.prereqs.map(li).join('')}</ul>`
    + `</div>`;
}

/**
 * Procédure d'exécution commune à tous les scripts — longue, donc repliée par
 * défaut. Son avertissement de sécurité, lui, est rendu à l'intérieur : replier
 * n'est pas masquer, le titre reste explicite et la section s'ouvre d'un clic
 * ou d'une touche Entrée.
 */
function execNotesMarkup() {
  const n = EXECUTION_NOTES;

  const steps = n.steps.map((st) =>
    `<li><strong>${textToCode(st.label)}</strong><br />${textToCode(st.detail)}`
    + (st.command ? `<pre class="cmd">${textToCode(st.command)}</pre>` : '')
    + `</li>`).join('');

  const policies = n.policies.map((po) =>
    `<tr><td><code>${textToCode(po.name)}</code></td><td>${textToCode(po.local)}</td><td>${textToCode(po.internet)}</td></tr>`).join('');

  const sources = n.sources.map((so) =>
    `<a class="source-link" target="_blank" rel="noreferrer" href="${so.url}">${textToCode(so.label)}</a>`).join(' · ');

  return `<details class="details exec-notes" id="execNotes">`
    + `<summary>${textToCode(n.title)}</summary>`
    + `<p>${textToCode(n.intro)}</p>`
    + `<ol class="exec-steps">${steps}</ol>`
    + `<h4>Stratégies d’exécution PowerShell</h4>`
    + `<table class="policy-table"><thead><tr><th>Stratégie</th><th>Script local</th><th>Script téléchargé</th></tr></thead><tbody>${policies}</tbody></table>`
    + `<p class="exec-warning">${textToCode(n.warning)}</p>`
    + `<p class="exec-sources">${sources}</p>`
    + `</details>`;
}

/** Erreurs fréquentes — section 8, repliée par défaut. */
function commonErrorsMarkup(tool) {
  const n = EXECUTION_NOTES;
  return `<details class="details common-errors" id="commonErrors">`
    + `<summary>Erreurs fréquentes</summary>`
    + `<h4>Propres à cet outil</h4>${tool.commonErrors.map(errorEntryMarkup).join('')}`
    + `<h4>Communes à tous les scripts</h4>${n.errors.map(errorEntryMarkup).join('')}`
    + `</details>`;
}

/** Méthode graphique — section 7, repliée par défaut, jamais supprimée. */
function guiMarkup(tool) {
  return `<details class="details gui-method" id="guiMethod">`
    + `<summary>Méthode graphique, sans script</summary>`
    + `<ol class="steps">${tool.gui.map((step) => `<li>${textToCode(step)}</li>`).join('')}</ol>`
    + `</details>`;
}

/** Sources officielles — section 9. */
function sourcesMarkup(tool) {
  const n = EXECUTION_NOTES;
  const liens = [`<a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">Documentation de l’outil</a>`]
    .concat(n.sources.map((so) =>
      `<a class="source-link" target="_blank" rel="noreferrer" href="${so.url}">${textToCode(so.label)}</a>`));
  return `<p class="sources-row" id="officialSources">${liens.join(' · ')}</p>`;
}

function formMarkup(tool) {
  return tool.fields.map((field) => {
    if (field.type === 'select') {
      return `<div class="field"><label for="${field.id}">${field.label}</label><select id="${field.id}">${field.options.map(([value, label]) => `<option value="${value}" ${value === field.default ? 'selected' : ''}>${label}</option>`).join('')}</select>${field.help ? `<small>${field.help}</small>` : ''}<span id="${field.id}-error" class="field-error" aria-live="polite" hidden></span></div>`;
    }
    const attributes = [field.min !== undefined ? `min="${field.min}"` : '', field.max !== undefined ? `max="${field.max}"` : '', field.step !== undefined ? `step="${field.step}"` : ''].filter(Boolean).join(' ');
    if (field.type === 'checkbox') {
      return `<div class="field checkbox-field"><label><input id="${field.id}" type="checkbox" ${field.default ? 'checked' : ''} /> ${field.label}</label>${field.help ? `<small>${field.help}</small>` : ''}<span id="${field.id}-error" class="field-error" aria-live="polite" hidden></span></div>`;
    }
    return `<div class="field"><label for="${field.id}">${field.label}</label><input id="${field.id}" type="${field.type || 'text'}" value="${field.default || ''}" ${attributes} />${field.help ? `<small>${field.help}</small>` : ''}<span id="${field.id}-error" class="field-error" aria-live="polite" hidden></span></div>`;
  }).join('');
}

function getValues(tool) {
  return Object.fromEntries(tool.fields.map((field) => {
    const element = document.querySelector(`#${field.id}`);
    return [field.id, field.type === 'checkbox' ? element.checked : element.value];
  }));
}

function displayErrors(errors, tool) {
  tool.fields.forEach((f) => {
    const span = document.querySelector(`#${f.id}-error`);
    if (span) { span.textContent = ''; span.hidden = true; }
    const input = document.querySelector(`#${f.id}`);
    if (input) input.classList.remove('field-invalid');
  });
  const keys = Object.keys(errors);
  keys.forEach((id) => {
    const span = document.querySelector(`#${id}-error`);
    if (span) { span.textContent = errors[id]; span.hidden = false; }
    const input = document.querySelector(`#${id}`);
    if (input) input.classList.add('field-invalid');
  });
  return keys.length === 0;
}

/**
 * Bandeau propre au mode de lecture, affiché entre l'en-tête et les onglets.
 *
 * Mode Débutant : le problème et le risque en langage courant, puis la marche
 * à suivre dans l'ordre. Rien n'y remplace les avertissements de sécurité —
 * ceux-ci restent affichés dans la fiche, dans les deux modes.
 *
 * Mode Technicien : la carte d'identité de l'outil (identifiant, élévation,
 * systèmes couverts, source officielle), qui évite de dérouler la fiche pour
 * savoir à quoi on a affaire.
 */
function modeBlockMarkup(tool) {
  if (estDebutant()) {
    // Trois étapes, pas six : sur un téléphone, une liste de six lignes repousse
    // le formulaire hors de l'écran. Le détail reste accessible d'un clic.
    const etapes = [
      'Remplis le formulaire avec tes informations.',
      'Génère le script, puis relis l\u2019aperçu.',
      'Copie ou télécharge le fichier, puis exécute-le.',
    ];
    const modeEmploi = [
      'Ouvre PowerShell en suivant les prérequis de la section 2. Certains outils exigent une console administrateur.',
      'Colle le script, ou lance le fichier .ps1 téléchargé. Le fichier porte déjà le BOM UTF-8 attendu par PowerShell 5.1.',
      'Lis les messages affichés par le script : ils disent ce qui a été modifié.',
      'Fais les contrôles de la section 5 pour confirmer que le problème est réglé.',
      'Si le résultat ne convient pas, la section 6 explique comment revenir en arrière.',
      'Si tu préfères éviter les scripts, la section 7 donne la méthode à la souris.',
    ];
    return `<section class="mode-block mode-debutant" id="modeBlock" aria-labelledby="modeBlockTitle">`
      + `<h2 id="modeBlockTitle" class="mode-block-title">En clair</h2>`
      + `<p class="plain-summary" id="plainSummary">${textToCode(tool.summary)}</p>`
      + `<p class="plain-risk risk-${tool.risk}" id="plainRisk">${textToCode(RISQUE_SIMPLE[tool.risk] ?? '')}</p>`
      + `<ol class="beginner-steps" id="beginnerSteps">`
      + etapes.map((e) => `<li>${textToCode(e)}</li>`).join('')
      + `</ol>`
      + `<button type="button" class="primary-button start-button" id="startButton">Commencer</button>`
      + `<details class="details mode-emploi" id="modeEmploi">`
      + `<summary>Voir le mode d\u2019emploi complet</summary>`
      + `<ol class="exec-steps">${modeEmploi.map((e) => `<li>${textToCode(e)}</li>`).join('')}</ol>`
      + `<p class="mode-note">Les avertissements de sécurité, les prérequis et la `
      + `procédure d\u2019annulation restent affichés plus bas : ils ne sont jamais `
      + `masqués, quel que soit le mode.</p>`
      + `</details>`
      + `</section>`;
  }

  return `<section class="mode-block mode-technicien" id="modeBlock" aria-labelledby="modeBlockTitle">`
    + `<h2 id="modeBlockTitle" class="mode-block-title">Fiche technique</h2>`
    + `<dl class="tech-meta" id="techMeta">`
    + `<div><dt>Identifiant</dt><dd><code>${textToCode(tool.id)}</code></dd></div>`
    + `<div><dt>Catégorie</dt><dd>${textToCode(tool.category)}</dd></div>`
    + `<div><dt>Sous-rubrique</dt><dd>${textToCode(tool.subcategory ?? '\u2014')}</dd></div>`
    + `<div><dt>Élévation</dt><dd>${tool.requiresAdmin ? 'Administrateur requis' : 'Session standard'}</dd></div>`
    + `<div><dt>Systèmes</dt><dd>${textToCode(tool.os.join(' · '))}</dd></div>`
    + `<div><dt>Réversible</dt><dd>${tool.reversible ? 'Oui' : 'Lecture seule'}</dd></div>`
    + `</dl>`
    + `<p class="mode-note">Source officielle : `
    + `<a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation de référence</a>.</p>`
    + `</section>`;
}

/**
 * Navigation compacte de la fiche : cinq ancres internes vers les sections qui
 * servent réellement. Ce sont de vrais liens — donc atteignables au clavier et
 * annoncés comme tels — mais leur activation est interceptée : écrire dans
 * location.hash casserait le routage par #/outil/<id>. Le défilement est donc
 * fait à la main, et le focus est déplacé sur le titre visé pour que la
 * navigation clavier suive le regard.
 */
const FICHE_ANCRES = [
  { cible: 'sectionFormulaire',  label: 'Formulaire' },
  { cible: 'sectionScript',      label: 'Script' },
  { cible: 'sectionVerification', label: 'Vérifier' },
  { cible: 'sectionAnnulation',  label: 'Annuler' },
  { cible: 'sectionGraphique',   label: 'Interface graphique' },
];

function ficheNavMarkup() {
  return `<nav class="fiche-nav" id="ficheNav" aria-label="Aller à une section de la fiche">`
    + FICHE_ANCRES.map((a) =>
        `<a class="fiche-nav-link" href="#${a.cible}" data-cible="${a.cible}">${textToCode(a.label)}</a>`).join('')
    + `</nav>`;
}

/** Amène une section à l'écran et y place le focus, sans toucher à l'URL. */
function allerASection(id, { focusChamp = false } = {}) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: 'auto', block: 'start' });

  const champ = focusChamp
    ? section.querySelector('input, select, textarea, button')
    : null;
  const cible = champ ?? section.querySelector('.fiche-section-title') ?? section;
  if (!cible.hasAttribute('tabindex') && cible.tagName !== 'INPUT'
      && cible.tagName !== 'SELECT' && cible.tagName !== 'BUTTON') {
    cible.setAttribute('tabindex', '-1');
  }
  cible.focus({ preventScroll: true });
}


function renderTool() {
  const tool = currentTool;
  const view = document.querySelector('#toolView');
  const riskLabels = { diagnostic: 'DIAGNOSTIC — aucune modification', safe: 'RÉVERSIBLE — vérifier avant exécution', caution: 'ATTENTION — modifie la configuration', destructive: 'DESTRUCTIF — confirmation indispensable' };
  view.innerHTML = `<div class="tool-header"><button class="back-button" id="backButton">← Tous les outils</button><div><div class="tag">${textToCode(tool.subcategory ? tool.category.toUpperCase() + ' \u00B7 ' + tool.subcategory : tool.category.toUpperCase())}</div><h1>${tool.icon} ${tool.title}</h1><span class="risk ${tool.risk}">${riskLabels[tool.risk]}</span></div></div>${ficheNavMarkup()}${modeBlockMarkup(tool)}<div id="tabContent"></div>`;
  view.querySelector('#backButton').addEventListener('click', () => revenirAccueil());
  const content = view.querySelector('#tabContent');
  const defaultValues = Object.fromEntries(tool.fields.map((field) => [field.id, String(field.default ?? '')]));
  const script = normalizeScript(tool.generate(defaultValues));
  const titreSection = (n, texte, id) =>
    `<h2 class="fiche-section-title" id="${id}">`
    + `<span class="fiche-step" aria-hidden="true">${n}</span>${textToCode(texte)}</h2>`;

  // Ordre de lecture imposé : problème, risque, formulaire, script, vérification,
  // annulation, méthode graphique, erreurs fréquentes, sources.
  // Le formulaire, l'aperçu et les boutons Générer / Copier / Télécharger ne sont
  // JAMAIS repliés : ce sont les commandes de l'outil, pas du détail.
  content.innerHTML = `<div class="fiche">`
    + `<section class="fiche-section" data-section="1" id="sectionProbleme" aria-labelledby="titreProbleme">`
      + titreSection(1, 'Problème et objectif', 'titreProbleme')
      + `<p class="fiche-lead">${textToCode(tool.summary)}</p>`
      + `<p class="fiche-lead fiche-lead-note">Cet assistant prépare le script et l\u2019explique. `
      + `Il ne l\u2019exécute pas : c\u2019est toi qui le lances, sur ta machine.</p>`
    + `</section>`
    + `<section class="fiche-section" data-section="2" id="sectionRisque" aria-labelledby="titreRisque">`
      + titreSection(2, 'Risque, compatibilité et prérequis', 'titreRisque')
      + `<p class="fiche-risk fiche-risk-${tool.risk}" id="ficheRisque">`
      + `<strong>Niveau de risque :</strong> ${textToCode(riskLabels[tool.risk])}</p>`
      + compatMarkup(tool)
      + execNotesMarkup()
    + `</section>`
    + `<div class="tool-content">`
      + `<section class="panel fiche-section" data-section="3" id="sectionFormulaire" aria-labelledby="titreFormulaire">`
        + titreSection(3, 'Tes informations', 'titreFormulaire')
        + `<form id="toolForm" novalidate>${formMarkup(tool)}`
        + `<button class="primary-button" type="submit">Générer le script</button></form>`
      + `</section>`
      + `<section class="panel fiche-section" data-section="4" id="sectionScript" aria-labelledby="titreScript">`
        + titreSection(4, 'Script généré', 'titreScript')
        + `<div class="code-wrap"><pre id="scriptOutput" class="code" tabindex="0" role="region" aria-label="Aperçu du script PowerShell">${textToCode(script)}</pre></div>`
        + `<div class="code-actions"><button id="copyButton" class="secondary-button">Copier</button>`
        + `<button id="downloadButton" class="secondary-button">Télécharger .ps1</button></div>`
        + `<span id="copyFeedback" class="copy-feedback" aria-live="polite"></span>`
      + `</section>`
    + `</div>`
    + `<section class="fiche-section" data-section="5" id="sectionVerification" aria-labelledby="titreVerification">`
      + titreSection(5, 'Vérifier que ça a fonctionné', 'titreVerification')
      + `<div class="details"><ul>${tool.checks.map((c) => `<li>${textToCode(c)}</li>`).join('')}</ul></div>`
      + verifyAfterMarkup(tool)
    + `</section>`
    + `<section class="fiche-section" data-section="6" id="sectionAnnulation" aria-labelledby="titreAnnulation">`
      + titreSection(6, 'Revenir en arrière', 'titreAnnulation')
      + rollbackMarkup(tool)
    + `</section>`
    + `<section class="fiche-section" data-section="7" id="sectionGraphique" aria-labelledby="titreGraphique">`
      + titreSection(7, 'Méthode graphique', 'titreGraphique')
      + guiMarkup(tool)
    + `</section>`
    + `<section class="fiche-section" data-section="8" id="sectionErreurs" aria-labelledby="titreErreurs">`
      + titreSection(8, 'Erreurs fréquentes', 'titreErreurs')
      + commonErrorsMarkup(tool)
    + `</section>`
    + `<section class="fiche-section" data-section="9" id="sectionSources" aria-labelledby="titreSources">`
      + titreSection(9, 'Sources officielles', 'titreSources')
      + sourcesMarkup(tool)
    + `</section>`
    + `</div>`;

  // Navigation compacte : vrais liens, défilement maîtrisé, URL intacte.
  view.querySelectorAll('.fiche-nav-link').forEach((lien) => {
    lien.addEventListener('click', (ev) => {
      ev.preventDefault();
      allerASection(lien.dataset.cible);
    });
  });

  // « Commencer » mène au formulaire et y place le curseur : sur téléphone,
  // c'est la différence entre comprendre quoi faire et devoir chercher où.
  const boutonCommencer = view.querySelector('#startButton');
  if (boutonCommencer) {
    boutonCommencer.addEventListener('click', () =>
      allerASection('sectionFormulaire', { focusChamp: true }));
  }

  // Point 5 (Codex) : marquer l'aperçu comme obsolète dès qu'un champ est modifié.
  // Copier et Télécharger sont désactivés jusqu'à la prochaine génération valide.
  const copyBtn     = content.querySelector('#copyButton');
  const dlBtn       = content.querySelector('#downloadButton');
  const preEl       = content.querySelector('#scriptOutput');
  const feedbackEl  = content.querySelector('#copyFeedback');

  function markDirty() {
    copyBtn.disabled  = true;
    dlBtn.disabled    = true;
    feedbackEl.textContent = 'Aperçu obsolète — cliquez sur « Générer » pour actualiser.';
    preEl.classList.add('stale');
  }

  tool.fields.forEach((field) => {
    const el = content.querySelector(`#${field.id}`);
    if (!el) return;
    const evtType = (el.tagName === 'SELECT' || field.type === 'checkbox') ? 'change' : 'input';
    el.addEventListener(evtType, markDirty);
  });

  content.querySelector('#toolForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = getValues(tool);
    const errors = tool.validate ? tool.validate(values) : {};
    const valid = displayErrors(errors, tool);
    if (!valid) {
      const firstId = Object.keys(errors)[0];
      const firstEl = document.querySelector(`#${firstId}`);
      if (firstEl) firstEl.focus();
      return;
    }
    let output;
    try {
      output = normalizeScript(tool.generate(values));
    } catch (err) {
      feedbackEl.textContent = `Erreur de génération : ${err.message}`;
      return;
    }
    preEl.textContent = output;
    preEl.classList.remove('stale');
    copyBtn.disabled  = false;
    dlBtn.disabled    = false;
    feedbackEl.textContent = 'Aperçu actualisé.';
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preEl.textContent);
      feedbackEl.textContent = 'Script copié dans le presse-papiers.';
    } catch {
      feedbackEl.textContent = 'Copie impossible : sélectionne le texte manuellement.';
    }
  });

  dlBtn.addEventListener('click', () => {
    // BOM UTF-8 (EF BB BF) requis pour PowerShell 5.1
    const bom  = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const text = new TextEncoder().encode(preEl.textContent);
    const blob = new Blob([bom, text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tool.id}.ps1`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

function render() {
  renderNavigation();
  renderModeSelector();
  renderThemeSelector();
  document.body.dataset.mode = modeCourant();
  document.querySelector('#home').hidden = Boolean(currentTool);
  document.querySelector('#toolView').hidden = !currentTool;
  if (currentTool) renderTool(); else renderHome();
}

const champRecherche = document.querySelector('#search');
const boutonEffacer  = document.querySelector('#searchClear');

function majEffacer() {
  if (boutonEffacer) boutonEffacer.hidden = champRecherche.value.length === 0;
}

champRecherche.addEventListener('input', () => {
  majEffacer();
  if (!currentTool) renderHome();
});

if (boutonEffacer) {
  boutonEffacer.addEventListener('click', () => {
    champRecherche.value = '';
    majEffacer();
    champRecherche.focus();
    if (!currentTool) renderHome();
  });
}

// Échap vide la recherche sans quitter le champ
champRecherche.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && champRecherche.value) {
    ev.preventDefault();
    champRecherche.value = '';
    majEffacer();
    if (!currentTool) renderHome();
  }
});
majEffacer();
// Menu latéral sur petit écran : l'état d'ouverture est annoncé (aria-expanded),
// le bouton reste au-dessus du panneau pour pouvoir le refermer, et la touche
// Échap le ferme — aucun piège au clavier.
const boutonMenu = document.querySelector('#menuButton');
const panneau    = document.querySelector('.sidebar');

function majMenu(ouvert) {
  panneau.classList.toggle('open', ouvert);
  boutonMenu.setAttribute('aria-expanded', String(ouvert));
}

majMenu(false);
boutonMenu.addEventListener('click', () => majMenu(!panneau.classList.contains('open')));
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && panneau.classList.contains('open')) {
    majMenu(false);
    boutonMenu.focus();
  }
});

// Bouton Retour / Suivant du navigateur, et lien partagé collé dans la barre d'adresse
window.addEventListener('popstate', appliquerHash);
window.addEventListener('hashchange', appliquerHash);

// Ouvrir directement la fiche demandée par l'URL au chargement
const outilInitial = outilDepuisHash();
if (outilInitial) {
  currentTool = outilInitial;
  noterConsultation(outilInitial.id);
}
appliquerTheme();
render();
