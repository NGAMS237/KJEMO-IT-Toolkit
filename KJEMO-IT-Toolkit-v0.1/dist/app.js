// Point 2 (Codex) : import depuis './generators.mjs' — même répertoire dist/
// GitHub Pages publie dist/ à la racine ; './generators.mjs' est donc accessible.
import { tools, normalizeScript, textToCode, EXECUTION_NOTES,
         searchTools, searchCommonErrors } from './generators.mjs';

const categories = ['Tout', ...new Set(tools.map((tool) => tool.category))];
let selectedCategory = 'Tout';
let currentTool = null;
let currentTab = 'assistant';

function renderNavigation() {
  const nav = document.querySelector('#navigation');
  nav.innerHTML = categories.map((category) => {
    const count = category === 'Tout' ? tools.length : tools.filter((tool) => tool.category === category).length;
    return `<button data-category="${category}" class="${category === selectedCategory ? 'active' : ''}">${category}<span class="nav-count">${count}</span></button>`;
  }).join('');
  nav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category; revenirAccueil(); document.querySelector('.sidebar').classList.remove('open');
  }));
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
  currentTab  = 'assistant';
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
    card.querySelector('.tag').textContent = tool.category.toUpperCase();
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
function prereqMarkup(tool) {
  const n  = EXECUTION_NOTES;
  const li = (x) => `<li>${textToCode(x)}</li>`;

  const admin = tool.requiresAdmin
    ? `<p class="admin-flag admin-required">Console PowerShell <strong>en tant qu\u2019administrateur</strong> obligatoire.</p>`
    : `<p class="admin-flag admin-optional">Aucune élévation <strong>administrateur locale</strong> n\u2019est nécessaire. Les droits listés ci-dessous restent obligatoires.</p>`;

  const steps = n.steps.map((st) =>
    `<li><strong>${textToCode(st.label)}</strong><br />${textToCode(st.detail)}`
    + (st.command ? `<pre class="cmd">${textToCode(st.command)}</pre>` : '')
    + `</li>`).join('');

  const policies = n.policies.map((po) =>
    `<tr><td><code>${textToCode(po.name)}</code></td><td>${textToCode(po.local)}</td><td>${textToCode(po.internet)}</td></tr>`).join('');

  const sources = n.sources.map((so) =>
    `<a class="source-link" target="_blank" rel="noreferrer" href="${so.url}">${textToCode(so.label)}</a>`).join(' · ');

  return `<div class="details prereqs" id="prereqBlock">`
    + `<h3>Systèmes compatibles</h3><ul>${tool.os.map(li).join('')}</ul>`
    + `<h3>Prérequis</h3>${admin}<ul>${tool.prereqs.map(li).join('')}</ul>`
    + `</div>`
    + `<details class="details exec-notes" id="execNotes">`
    + `<summary>${textToCode(n.title)}</summary>`
    + `<p>${textToCode(n.intro)}</p>`
    + `<ol class="exec-steps">${steps}</ol>`
    + `<h4>Stratégies d\u2019exécution PowerShell</h4>`
    + `<table class="policy-table"><thead><tr><th>Stratégie</th><th>Script local</th><th>Script téléchargé</th></tr></thead><tbody>${policies}</tbody></table>`
    + `<p class="exec-warning">${textToCode(n.warning)}</p>`
    + `<p class="exec-sources">${sources}</p>`
    + `</details>`
    + `<details class="details common-errors" id="commonErrors">`
    + `<summary>Erreurs fréquentes</summary>`
    + `<h4>Propres à cet outil</h4>${tool.commonErrors.map(errorEntryMarkup).join('')}`
    + `<h4>Communes à tous les scripts</h4>${n.errors.map(errorEntryMarkup).join('')}`
    + `</details>`;
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

function renderTool() {
  const tool = currentTool;
  const view = document.querySelector('#toolView');
  const riskLabels = { diagnostic: 'DIAGNOSTIC — aucune modification', safe: 'RÉVERSIBLE — vérifier avant exécution', caution: 'ATTENTION — modifie la configuration', destructive: 'DESTRUCTIF — confirmation indispensable' };
  view.innerHTML = `<div class="tool-header"><button class="back-button" id="backButton">← Tous les outils</button><div><div class="tag">${tool.category.toUpperCase()}</div><h1>${tool.icon} ${tool.title}</h1><p>${tool.summary}</p><span class="risk ${tool.risk}">${riskLabels[tool.risk]}</span></div></div><div class="tabs"><button class="tab ${currentTab === 'assistant' ? 'active' : ''}" data-tab="assistant">Assistant</button><button class="tab ${currentTab === 'script' ? 'active' : ''}" data-tab="script">Script</button><button class="tab ${currentTab === 'gui' ? 'active' : ''}" data-tab="gui">Interface graphique</button></div><div id="tabContent"></div>`;
  view.querySelector('#backButton').addEventListener('click', () => revenirAccueil());
  view.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { currentTab = tab.dataset.tab; renderTool(); }));
  const content = view.querySelector('#tabContent');
  if (currentTab === 'gui') {
    content.innerHTML = `<div class="panel"><h2>Étapes avec l'interface Windows</h2><ol class="steps">${tool.gui.map((step) => `<li>${step}</li>`).join('')}</ol><div class="details"><h3>Avant de commencer</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div></div>`;
    return;
  }
  const defaultValues = Object.fromEntries(tool.fields.map((field) => [field.id, String(field.default ?? '')]));
  const script = normalizeScript(tool.generate(defaultValues));
  content.innerHTML = `<div class="tool-content"><section class="panel"><h2>${currentTab === 'assistant' ? 'Tes informations' : 'Paramètres du script'}</h2><form id="toolForm" novalidate>${formMarkup(tool)}<button class="primary-button" type="submit">${currentTab === 'assistant' ? 'Générer le script' : 'Actualiser l\'aperçu'}</button></form><div class="details"><h3>Vérifications</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div>${prereqMarkup(tool)}</section><section class="panel"><h2>Aperçu PowerShell</h2><div class="code-wrap"><pre id="scriptOutput" class="code">${textToCode(script)}</pre></div><div class="code-actions"><button id="copyButton" class="secondary-button">Copier</button><button id="downloadButton" class="secondary-button">Télécharger .ps1</button></div><span id="copyFeedback" class="copy-feedback" aria-live="polite"></span></section></div>`;

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
  document.querySelector('#home').hidden = Boolean(currentTool);
  document.querySelector('#toolView').hidden = !currentTool;
  if (currentTool) renderTool(); else renderHome();
}

document.querySelector('#search').addEventListener('input', () => { if (!currentTool) renderHome(); });
document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));

// Bouton Retour / Suivant du navigateur, et lien partagé collé dans la barre d'adresse
window.addEventListener('popstate', appliquerHash);
window.addEventListener('hashchange', appliquerHash);

// Ouvrir directement la fiche demandée par l'URL au chargement
const outilInitial = outilDepuisHash();
if (outilInitial) {
  currentTool = outilInitial;
  currentTab  = 'assistant';
  noterConsultation(outilInitial.id);
}
render();
