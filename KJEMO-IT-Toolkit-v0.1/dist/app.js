import { tools, normalizeScript, textToCode } from '../src/generators.mjs';

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
    selectedCategory = button.dataset.category; currentTool = null; render(); document.querySelector('.sidebar').classList.remove('open');
  }));
}

function filteredTools() {
  const query = document.querySelector('#search').value.trim().toLocaleLowerCase('fr');
  return tools.filter((tool) => (selectedCategory === 'Tout' || tool.category === selectedCategory) && `${tool.title} ${tool.summary} ${tool.category}`.toLocaleLowerCase('fr').includes(query));
}

function renderHome() {
  const grid = document.querySelector('#toolGrid');
  const list = filteredTools();
  document.querySelector('#toolCount').textContent = `${list.length} outil${list.length > 1 ? 's' : ''}`;
  grid.innerHTML = '';
  if (!list.length) { grid.innerHTML = '<div class="empty">Aucun outil ne correspond à cette recherche.</div>'; return; }
  const template = document.querySelector('#toolTemplate');
  list.forEach((tool) => {
    const card = template.content.cloneNode(true);
    card.querySelector('.tool-icon').textContent = tool.icon;
    card.querySelector('.tag').textContent = tool.category.toUpperCase();
    card.querySelector('h3').textContent = tool.title;
    card.querySelector('p').textContent = tool.summary;
    card.querySelector('.open-tool').addEventListener('click', () => { currentTool = tool; currentTab = 'assistant'; render(); });
    grid.append(card);
  });
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
  view.querySelector('#backButton').addEventListener('click', () => { currentTool = null; render(); });
  view.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { currentTab = tab.dataset.tab; renderTool(); }));
  const content = view.querySelector('#tabContent');
  if (currentTab === 'gui') {
    content.innerHTML = `<div class="panel"><h2>Étapes avec l'interface Windows</h2><ol class="steps">${tool.gui.map((step) => `<li>${step}</li>`).join('')}</ol><div class="details"><h3>Avant de commencer</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div></div>`;
    return;
  }
  const defaultValues = Object.fromEntries(tool.fields.map((field) => [field.id, String(field.default ?? '')]));
  const script = normalizeScript(tool.generate(defaultValues));
  content.innerHTML = `<div class="tool-content"><section class="panel"><h2>${currentTab === 'assistant' ? 'Tes informations' : 'Paramètres du script'}</h2><form id="toolForm" novalidate>${formMarkup(tool)}<button class="primary-button" type="submit">${currentTab === 'assistant' ? 'Générer le script' : 'Actualiser l\'aperçu'}</button></form><div class="details"><h3>Vérifications</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div></section><section class="panel"><h2>Aperçu PowerShell</h2><div class="code-wrap"><pre id="scriptOutput" class="code">${textToCode(script)}</pre></div><div class="code-actions"><button id="copyButton" class="secondary-button">Copier</button><button id="downloadButton" class="secondary-button">Télécharger .ps1</button></div><span id="copyFeedback" class="copy-feedback" aria-live="polite"></span></section></div>`;
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
    const output = normalizeScript(tool.generate(values));
    content.querySelector('#scriptOutput').textContent = output;
    content.querySelector('#copyFeedback').textContent = 'Aperçu actualisé.';
  });
  content.querySelector('#copyButton').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(content.querySelector('#scriptOutput').textContent);
      content.querySelector('#copyFeedback').textContent = 'Script copié dans le presse-papiers.';
    } catch {
      content.querySelector('#copyFeedback').textContent = 'Copie impossible : sélectionne le texte manuellement.';
    }
  });
  content.querySelector('#downloadButton').addEventListener('click', () => {
    const blob = new Blob([content.querySelector('#scriptOutput').textContent], { type: 'text/plain;charset=utf-8' });
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
render();
