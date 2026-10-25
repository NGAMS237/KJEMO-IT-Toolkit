// Point 2 (Codex) : import depuis './generators.mjs' — même répertoire dist/
// GitHub Pages publie dist/ à la racine ; './generators.mjs' est donc accessible.
import { tools, normalizeScript, textToCode, EXECUTION_NOTES,
         searchTools, searchCommonErrors } from './generators.mjs';
import { categoriesVisibles, categorieParNom, CATEGORIE_TOUT } from './categories.mjs';
import { plateformeDe, sortieDe, estBash, estIOS, estDocumentationSeule, estLectureSeule,
         extensionDe, nomFichierDe, etiquetteSortie, commandesExecution } from './plateforme.mjs';
import { normalizeScriptSh, EXECUTION_NOTES_BASH } from './noyau-bash.mjs';
import { normalizeIos, EXECUTION_NOTES_IOS } from './noyau-cisco.mjs';
import { ENTREES_LISTEES, TOUTES_LES_ENTREES, chercher, entreeParId, ficheDeAssistant,
         compteParCategorie, couverture, liensDeAssistant } from './taches.mjs';
import { ligneResultatMarkup, tachePageMarkup, etapesMarkup, formulaireMarkup, tableMarkup, lignesSaisies,
         resumeScriptMarkup, badgeEffet, esc, enteteAssistantMeta, versionsCourtesMarkup } from './vue-taches.mjs';
import { cheminDe, filDeEntree, lireRoute, routePortee, domaineIdDe, domaineNomDe, dans, noeud } from './classement.mjs';
import { filArianeMarkup, maillonsDePortee, nomDePortee, rubriqueMarkup, groupeEnteteMarkup, groupes,
         bandeauMasqueMarkup } from './vue-navigation.mjs';
import { rendreMethode, evaluerValeurs, validerParametre, texteCopiable, raisonRefus,
         dossierMarkdown } from './procedures.mjs';
import { MODES, MODE_DEFAUT, CLE_MODE, THEMES, THEME_DEFAUT, CLE_THEME,
         creerPreference } from './preferences.mjs';

const CAT_TOUT = CATEGORIE_TOUT;

// RESEAU-CISCO-01 — trois familles de sortie, trois normaliseurs. Un fichier de
// commandes IOS n'est ni un script PowerShell ni un script Bash : ni backtick de
// continuation, ni shebang, ni BOM ; LF, ASCII, aucune tabulation.
function normaliserSortie(tool, texte) {
  if (estIOS(tool)) return normalizeIos(texte);
  return estBash(tool) ? normalizeScriptSh(texte) : normalizeScript(texte);
}
function notesDe(tool) {
  if (estIOS(tool)) return EXECUTION_NOTES_IOS;
  return estBash(tool) ? EXECUTION_NOTES_BASH : EXECUTION_NOTES;
}
// Catalogue filtré : une catégorie déclarée mais SANS outil n'est pas affichée.
const categoriesAffichees = categoriesVisibles(tools);
const categories = [CAT_TOUT, ...categoriesAffichees.map((c) => c.name)];
let selectedCategory = CAT_TOUT;
let currentTool = null;
// UX-COMMANDES-PROCEDURES-01 : fiche tâche ouverte (entrée du catalogue), méthode
// choisie et valeurs saisies. Les valeurs ne vivent que le temps d'une fiche :
// ouvrir une autre fiche repart de zéro (aucun état gardé par erreur).
let currentTache = null;
let methodeTache = null;
let saisiesTache = {};
let vueLocale = null;           // 'rapide' | 'pas' | null : choix LOCAL à la fiche ouverte (le mode global donne le défaut)
let vueAssistants = false;      // #/assistants : les assistants seuls, recherche historique
let vueCatalogue = false;       // « Parcourir tout le catalogue »
let natureFiltre = null;        // null | 'fiche' | 'commande' | 'assistant'
let platFiltre = null;          // Linux | Windows | Cisco | Azure | null
// UX-NAVIGATION-CATALOGUE-01 : niveaux sous le domaine (identifiants de classement.mjs).
let familleSel = null;
let sujetSel = null;

/** Portée courante de la navigation : domaine, famille, sujet. */
function portee() {
  const domaineId = selectedCategory === CAT_TOUT ? null : domaineIdDe(selectedCategory);
  return {
    assistants: vueAssistants,
    domaineId,
    domaineNom: domaineId ? selectedCategory : null,
    familleId: domaineId ? familleSel : null,
    sujetId: domaineId && familleSel ? sujetSel : null,
  };
}
const listeBase = () => (vueAssistants ? TOUTES_LES_ENTREES.filter((e) => e.kind === 'assistant') : ENTREES_LISTEES);
function gardePortee() {
  const p = portee();
  return p.familleId ? (e) => dans(e, { familleId: p.familleId, sujetId: p.sujetId }) : null;
}
/** Va à une rubrique (domaine, famille, sujet) : état, URL et affichage. */
function allerPortee(nomDomaine, familleId = null, sujetId = null) {
  selectedCategory = nomDomaine; familleSel = familleId; sujetSel = sujetId;
  vueCatalogue = nomDomaine === CAT_TOUT;
  currentTool = null; currentTache = null;
  ecrireHash(routePortee(portee()));
  render();
}

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
      vueLocale = null; // un changement de mode global redonne la vue par défaut du mode
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

/** Groupes du domaine ouvert, sous son bouton : mêmes liens que les cartes de rubrique. */
function sousNavigationMarkup(nomDomaine) {
  const domaineId = domaineIdDe(nomDomaine);
  const defs = noeud(domaineId)?.familles ?? [];
  const liste = listeBase();
  const items = defs.map((f) => {
    const n = liste.filter((e) => { const c = cheminDe(e); return c && c.domaineId === domaineId && c.famille.id === f.id; }).length;
    if (!n) return '';
    const actif = familleSel === f.id;
    return `<a class="nav-famille${actif ? ' active' : ''}" href="${esc(routePortee({ assistants: vueAssistants, domaineId, familleId: f.id }))}"`
      + ` data-famille="${esc(f.id)}"${actif ? ' aria-current="true"' : ''}><span class="nav-label">${textToCode(f.nom)}</span><span class="nav-count">${n}</span></a>`;
  }).join('');
  return `<div class="nav-sous" role="group" aria-label="Groupes de ${esc(nomDomaine)}">${items}</div>`;
}

function renderNavigation() {
  const nav = document.querySelector('#navigation');
  const comptesTaches = compteParCategorie(ENTREES_LISTEES);
  nav.innerHTML = categories.map((category) => {
    const meta    = category === CAT_TOUT ? null : categorieParNom(category);
    const icone   = category === CAT_TOUT ? '\u2261' : (meta?.icon ?? '\u25CB');
    // Mêmes décomptes que les cartes de l'accueil : en vue « tâches », ce sont des entrées
    // (procédures, scénarios, commandes, assistants non couverts) ; en vue « assistants », des assistants.
    const count   = vueAssistants
      ? (category === CAT_TOUT ? tools.length : (categoriesAffichees.find((c) => c.name === category)?.count ?? 0))
      : (category === CAT_TOUT ? ENTREES_LISTEES.length : (comptesTaches.get(category) ?? 0));
    const actif   = category === selectedCategory;
    // Les noms canoniques sont longs et le panneau est étroit : le libellé est
    // tronqué visuellement, mais reste lisible au survol et complet pour les
    // lecteurs d'écran.
    return `<button type="button" data-category="${category}" class="${actif ? 'active' : ''}"`
      + ` title="${textToCode(category)}" aria-current="${actif ? 'true' : 'false'}">`
      + `<span class="nav-icon" aria-hidden="true">${textToCode(icone)}</span>`
      + `<span class="nav-label">${textToCode(category)}</span>`
      + `<span class="nav-count">${count}</span></button>`
      + (actif && category !== CAT_TOUT ? sousNavigationMarkup(category) : '');
  }).join('');
  nav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    allerPortee(button.dataset.category); fermerMenu();
  }));
  nav.querySelectorAll('a.nav-famille').forEach((a) => a.addEventListener('click', () => fermerMenu()));
}

/**
 * Grille de catégories de l'accueil : nom, icône sobre, décompte, courte
 * description et état sélectionné visible. Elle double la barre latérale, qui
 * est masquée sur téléphone.
 */
function renderCategoryGrid() {
  const grille = document.querySelector('#categoryGrid');
  if (!grille) return;
  const comptes = vueAssistants
    ? new Map(categoriesAffichees.map((c) => [c.name, c.count]))
    : compteParCategorie(ENTREES_LISTEES);
  const total = vueAssistants ? tools.length : ENTREES_LISTEES.length;

  // Carte compacte : icône, nom, nombre de tâches. Les descriptions longues ne
  // sont plus affichées (elles restent dans le titre au survol).
  const carte = (nom, icone, description, count, actif, sous) =>
    `<button type="button" role="listitem" class="category-card${actif ? ' is-selected' : ''}"`
    + ` data-category="${nom}" aria-pressed="${actif ? 'true' : 'false'}" title="${textToCode(description ?? '')}">`
    + `<span class="category-icon" aria-hidden="true">${textToCode(icone)}</span>`
    + `<span class="category-name">${textToCode(nom === CAT_TOUT ? 'Tous les outils' : nom)}</span>`
    + `<span class="category-count">${count} <span class="sr-only">${vueAssistants ? (count > 1 ? 'outils' : 'outil') : (count > 1 ? 'tâches' : 'tâche')}</span></span>`
    + (sous && sous.length
        ? `<span class="category-sub sr-only">Sous-rubriques : ${textToCode(sous.map((x) => x.name).join(' · '))}</span>`
        : '')
    + `</button>`;

  grille.innerHTML =
    carte(CAT_TOUT, '\u2261', 'Parcourir l\u2019ensemble du catalogue.', total, selectedCategory === CAT_TOUT && (vueCatalogue || vueAssistants))
    + categoriesAffichees
        .map((c) => carte(c.name, c.icon, c.description, comptes.get(c.name) ?? 0, selectedCategory === c.name, c.sous))
        .join('');

  // Légende des nombres : dit ce qui est compté, sans compter deux fois une tâche à plusieurs méthodes.
  let legende = document.querySelector('#catalogueLegende');
  if (!legende) { legende = document.createElement('p'); legende.id = 'catalogueLegende'; legende.className = 'catalogue-legende'; grille.insertAdjacentElement('afterend', legende); }
  const cv = couverture();
  legende.textContent = vueAssistants
    ? `${tools.length} assistants complets (scripts générés avec formulaire).`
    : `${ENTREES_LISTEES.length} entrées : ${cv.procedures} fiches (dont ${cv.scenarios} scénarios), ${cv.commandesRapides} commandes rapides, ${cv.assistantsListes} assistants complets listés. Les ${cv.assistants} assistants restent tous accessibles. Une tâche à plusieurs méthodes compte une fois.`;

  grille.querySelectorAll('.category-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      allerPortee(btn.dataset.category);
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
  const connus = new Set(TOUTES_LES_ENTREES.map((e) => e.id));
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

/** Fiche tâche demandée par l'URL (#/tache/<id>), si l'identifiant porte une procédure. */
function tacheDepuisHash() {
  const m = /^#\/tache\/([A-Za-z0-9_-]+)$/.exec(location.hash || '');
  if (!m) return null;
  const e = entreeParId(m[1]);
  return e && e.procedure ? e : null;
}

function ecrireHash(cible) {
  if (location.hash !== cible) {
    history.pushState(null, '', cible);
  }
}

/** Ouvre une fiche : met à jour l'état, l'URL et l'historique local. */
function ouvrirOutil(tool, { pousserHash = true } = {}) {
  currentTool = tool;
  currentTache = null;
  noterConsultation(tool.id);
  if (pousserHash) ecrireHash(`#/outil/${tool.id}`);
  render();
}

/** Ouvre une fiche tâche. Les valeurs saisies repartent de zéro. */
function ouvrirTache(entree, { pousserHash = true } = {}) {
  currentTool = null;
  currentTache = entree;
  methodeTache = entree.procedure.methodes[0].id;
  saisiesTache = {};
  vueLocale = null;
  noterConsultation(entree.id);
  if (pousserHash) ecrireHash(`#/tache/${entree.id}`);
  render();
}

/** Ouvre ce qu'une ligne de résultat désigne : fiche tâche ou assistant complet. */
function ouvrirEntree(entree, opts) {
  if (entree.procedure) return ouvrirTache(entree, opts);
  return ouvrirOutil(entree.tool, opts);
}

function revenirAccueil({ pousserHash = true } = {}) {
  currentTool = null;
  currentTache = null;
  if (pousserHash) ecrireHash(routePortee(portee()));
  render();
}

/** Applique l'URL courante à l'état de l'application. */
function appliquerHash() {
  const tache = tacheDepuisHash();
  const tool = outilDepuisHash();
  if (!tache && !tool) {
    const rub = lireRoute(location.hash);
    if (rub) {
      vueAssistants = rub.assistants; vueCatalogue = false;
      selectedCategory = domaineNomDe(rub.domaineId); familleSel = rub.familleId; sujetSel = rub.sujetId;
      currentTool = null; currentTache = null;
      render();
      document.querySelector('#rubriquesZone [aria-current="page"]')?.closest('nav')?.setAttribute('tabindex', '-1');
      document.querySelector('#filAriane')?.focus?.({ preventScroll: true });
      return;
    }
    const vuePrevue = location.hash === '#/assistants';
    const horsPortee = selectedCategory !== CAT_TOUT || familleSel;
    if (vuePrevue !== vueAssistants || ((location.hash === '#/' || location.hash === '' || vuePrevue) && horsPortee)) {
      vueAssistants = vuePrevue;
      selectedCategory = CAT_TOUT; familleSel = null; sujetSel = null; vueCatalogue = false;
      currentTool = null; currentTache = null;
      render();
      return;
    }
  }
  if (tache) {
    if (currentTache?.id !== tache.id) ouvrirTache(tache, { pousserHash: false });
  } else if (tool) {
    if (currentTool?.id !== tool.id) ouvrirOutil(tool, { pousserHash: false });
  } else if (currentTool || currentTache) {
    revenirAccueil({ pousserHash: false });
  }
}

/**
 * Raccourcis affichés en haut de l'accueil : favoris puis derniers consultés.
 * Masqués pendant une recherche, qui a ses propres résultats.
 */
function raccourcisMarkup() {
  if (currentQuery()) return '';
  const parId = (id) => entreeParId(id);
  const favoris = lireFavoris().map(parId).filter(Boolean);
  const recents = lireHistorique().map(parId).filter(Boolean)
    .filter((t) => !favoris.some((f) => f.id === t.id));

  const puce = (t, cls) =>
    `<button class="shortcut ${cls}" data-tool="${t.id}" type="button">`
    + `<span class="shortcut-icon" aria-hidden="true">${textToCode(t.tool?.icon ?? (t.kind === 'commande' ? '›_' : '▸'))}</span>${textToCode(t.titre)}</button>`;

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
const ORDRE_KIND = { procedure: 0, scenario: 0, commande: 1, assistant: 2 };

/**
 * Résultats de l'accueil. Trois situations :
 *  - une requête : recherche pertinente dans tout le catalogue (ou la catégorie) ;
 *  - une catégorie ou « tout le catalogue » : liste complète, procédures d'abord ;
 *  - rien : les tâches courantes (les fiches rédigées), pas 300 lignes.
 */
function modeListe(requete = currentQuery(), categorie = selectedCategory, nature = natureFiltre) {
  if (vueAssistants) return requete ? 'recherche' : 'liste';
  if (requete) return 'recherche';
  if (categorie !== CAT_TOUT || vueCatalogue || nature) return 'liste';
  return 'accueil';
}

/**
 * Résultats de la vue courante. `over` remplace temporairement un réglage
 * (nature, plat, categorie, requete) : c'est ainsi que le bandeau « filtre qui
 * masque des résultats » compte ce que le filtre cache, avec la MÊME logique.
 */
function searchResults(over = {}) {
  const requete = 'requete' in over ? over.requete : currentQuery();
  const nature  = 'nature' in over ? over.nature : natureFiltre;
  const plat    = 'plat' in over ? over.plat : platFiltre;
  const categorie = 'categorie' in over ? over.categorie : selectedCategory;
  const garde   = 'categorie' in over ? null : gardePortee();
  const mode = modeListe(requete, categorie, 'nature' in over ? 'force' : nature);
  if (vueAssistants) {
    return searchTools(requete, categorie)
      .map((r) => ({ entree: entreeParId(r.tool.id), motif: r.reason, score: r.score }))
      .filter((r) => !garde || garde(r.entree));
  }
  const kinds = NATURES.find((n) => n.id === nature)?.kinds ?? null;
  const opts = { categorie, plateforme: plat, kinds, garde };
  if (mode === 'accueil') {
    return chercher('', { ...opts, kinds: ['procedure'] }).map((r) => ({ ...r, motif: null }));
  }
  const res = chercher(requete, opts);
  if (mode === 'liste') {
    res.sort((a, b) => ORDRE_KIND[a.entree.kind] - ORDRE_KIND[b.entree.kind]
      || a.entree.titre.localeCompare(b.entree.titre, 'fr'));
  }
  return res;
}

function filteredTools() {
  return searchResults().map((r) => r.entree);
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

const NATURES = [
  { id: 'fiche', label: 'Procédures et scénarios', kinds: ['procedure', 'scenario'] },
  { id: 'commande', label: 'Commandes', kinds: ['commande'] },
  { id: 'assistant', label: 'Assistants complets', kinds: ['assistant'] },
];
const PLATEFORMES_FILTRE = ['Linux', 'Windows', 'Cisco', 'Azure'];

function renderPlatFilters() {
  const zone = document.querySelector('#platFilters');
  if (!zone) return;
  zone.innerHTML = `<span class="plat-filter-label" id="platFilterLabel">Plateforme</span>`
    + `<div class="chips" role="group" aria-labelledby="platFilterLabel">`
    + [null, ...PLATEFORMES_FILTRE].map((p) =>
      `<button type="button" class="chip${platFiltre === p ? ' is-on' : ''}" data-plat="${p ?? ''}" aria-pressed="${platFiltre === p}">${p ?? 'Toutes'}</button>`).join('')
    + `</div>`;
  zone.querySelectorAll('[data-plat]').forEach((b) => b.addEventListener('click', () => {
    platFiltre = b.dataset.plat || null;
    renderHome();
  }));
  // Nature du contenu : un seul groupe de puces, dans son propre conteneur.
  const zoneNature = document.querySelector('#natureFilters');
  if (zoneNature) {
    zoneNature.innerHTML = vueAssistants ? '' : `<span class="plat-filter-label" id="natureFilterLabel">Contenu</span>`
      + `<div class="chips" role="group" aria-labelledby="natureFilterLabel">`
      + [{ id: null, label: 'Tout' }, ...NATURES].map((n) =>
        `<button type="button" class="chip${natureFiltre === n.id ? ' is-on' : ''}" data-nature="${n.id ?? ''}" aria-pressed="${natureFiltre === n.id}">${n.label}</button>`).join('')
      + `</div>`;
    zoneNature.querySelectorAll('[data-nature]').forEach((b) => b.addEventListener('click', () => {
      natureFiltre = b.dataset.nature || null;
      renderHome();
    }));
  }
}

/** Libellé du périmètre courant, pour les messages : « Linux › Partages de fichiers ». */
function libellePortee() {
  const p = portee();
  if (!p.domaineId) return null;
  return maillonsDePortee(p).slice(1).map((m) => m.nom).join(' › ');
}

/**
 * Filtres qui masquent des résultats EXISTANTS : le bandeau dit lequel, combien,
 * et propose les autres types ou plateformes sans toucher à la recherche.
 */
function bandeauxMasque(results, query) {
  if (vueAssistants) return '';
  const perimetre = libellePortee();
  let html = '';
  if (natureFiltre) {
    const sans = searchResults({ nature: null });
    const masques = sans.length - results.length;
    if (masques > 0) {
      const autres = NATURES.filter((n) => n.id !== natureFiltre)
        .map((n) => ({ action: 'nature', valeur: n.id, libelle: n.label, compte: searchResults({ nature: n.id }).length }))
        .filter((a) => a.compte > 0);
      autres.push({ action: 'nature', valeur: '', libelle: 'Tous les types', compte: sans.length });
      const nom = NATURES.find((n) => n.id === natureFiltre).label;
      html += bandeauMasqueMarkup({ id: 'filtreMasqueNature', filtre: `Le filtre « ${nom} »`, requete: query, perimetre, masques, autres });
    }
  }
  if (platFiltre) {
    const sans = searchResults({ plat: null });
    const masques = sans.length - results.length;
    if (masques > 0) {
      const autres = PLATEFORMES_FILTRE.filter((p) => p !== platFiltre)
        .map((p) => ({ action: 'plat', valeur: p, libelle: p, compte: searchResults({ plat: p }).length }))
        .filter((a) => a.compte > 0);
      autres.push({ action: 'plat', valeur: '', libelle: 'Toutes les plateformes', compte: sans.length });
      html += bandeauMasqueMarkup({ id: 'filtreMasquePlat', filtre: `Le filtre « ${platFiltre} »`, requete: query, perimetre, masques, autres });
    }
  }
  return html;
}

function renderHome() {
  renderCategoryGrid();
  renderPlatFilters();
  const grid    = document.querySelector('#toolGrid');
  const query   = currentQuery();
  const mode    = modeListe();
  const results = searchResults();
  const p       = portee();
  // Pendant une recherche, les résultats passent avant la grille des catégories
  // (qui les repoussait sous la ligne de flottaison). La barre latérale garde
  // le filtre par catégorie, et la grille revient dès que la recherche est vidée.
  document.querySelector('#categoriesSection')?.classList.toggle('is-collapsed', Boolean(query) && selectedCategory === CAT_TOUT);
  document.querySelector('#categoriesSection')?.classList.toggle('is-compact', Boolean(p.domaineId));

  // Bandeau d'erreur commune, inséré avant la grille
  const zone = document.querySelector('#commonErrorZone');
  if (zone) zone.innerHTML = commonErrorBanner(query);

  const zoneRaccourcis = document.querySelector('#shortcutsZone');
  if (zoneRaccourcis) {
    zoneRaccourcis.innerHTML = raccourcisMarkup();
    zoneRaccourcis.querySelectorAll('.shortcut').forEach((btn) => {
      const t = entreeParId(btn.dataset.tool);
      if (t) btn.addEventListener('click', () => ouvrirEntree(t));
    });
  }

  // Panneau de rubrique : fil d'Ariane, périmètre de recherche, cartes des groupes.
  const zoneRub = document.querySelector('#rubriquesZone');
  if (zoneRub) {
    zoneRub.innerHTML = p.domaineId
      ? rubriqueMarkup({ liste: listeBase(), assistants: vueAssistants, domaineId: p.domaineId, domaineNom: p.domaineNom,
          familleId: p.familleId, sujetId: p.sujetId, requete: query,
          totalPartout: query ? searchResults({ categorie: CAT_TOUT }).length : null })
      : '';
    zoneRub.querySelector('#rechercherPartout')?.addEventListener('click', () => {
      selectedCategory = CAT_TOUT; familleSel = null; sujetSel = null; vueCatalogue = false;
      ecrireHash(routePortee(portee()));
      renderHome(); renderNavigation();
      champRecherche.focus();
    });
  }

  const zoneMasque = document.querySelector('#filtreMasqueZone');
  if (zoneMasque) {
    zoneMasque.innerHTML = bandeauxMasque(results, query);
    zoneMasque.querySelectorAll('[data-masque-action]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.masqueValeur || null;
      if (b.dataset.masqueAction === 'nature') natureFiltre = v; else platFiltre = v;
      renderHome();
      document.querySelector('#toolsTitle')?.focus?.();
    }));
  }

  const titre = document.querySelector('#toolsTitle');
  if (titre) {
    titre.textContent = vueAssistants ? 'Les assistants complets' : mode === 'recherche' ? 'Résultats'
      : (mode === 'liste' ? (p.domaineId ? nomDePortee(p) : 'Tout le catalogue') : 'Tâches courantes');
    titre.tabIndex = -1;
  }
  document.querySelector('#toolCount').textContent =
    vueAssistants ? `${results.length} outil${results.length > 1 ? 's' : ''}`
      : `${results.length} ${mode === 'recherche' ? (results.length > 1 ? 'résultats' : 'résultat') : (results.length > 1 ? 'entrées' : 'entrée')}`;

  const pied = document.querySelector('#catalogueFooter');
  if (pied) {
    if (vueAssistants) {
      pied.innerHTML = '<button type="button" class="secondary-button" id="versTaches">Chercher une commande ou une procédure</button>';
    } else if (mode === 'accueil') {
      pied.innerHTML = `<button type="button" class="secondary-button" id="voirCatalogue">Parcourir tout le catalogue (${ENTREES_LISTEES.length} entrées)</button>`
        + `<button type="button" class="secondary-button" id="voirAssistants">Les ${tools.length} assistants complets</button>`;
    } else if (mode === 'liste' && selectedCategory === CAT_TOUT) {
      pied.innerHTML = '<button type="button" class="secondary-button" id="replierCatalogue">Revenir aux tâches courantes</button>';
    } else pied.innerHTML = '';
    pied.querySelector('#voirCatalogue')?.addEventListener('click', () => { vueCatalogue = true; selectedCategory = CAT_TOUT; renderHome(); });
    pied.querySelector('#replierCatalogue')?.addEventListener('click', () => { vueCatalogue = false; renderHome(); });
    pied.querySelector('#voirAssistants')?.addEventListener('click', () => { vueAssistants = true; selectedCategory = CAT_TOUT; familleSel = null; sujetSel = null; ecrireHash('#/assistants'); renderHome(); });
    pied.querySelector('#versTaches')?.addEventListener('click', () => { vueAssistants = false; vueCatalogue = false; selectedCategory = CAT_TOUT; familleSel = null; sujetSel = null; ecrireHash('#/'); renderHome(); });
  }

  grid.innerHTML = '';
  if (!results.length) {
    const filtres = (!vueAssistants && (natureFiltre || platFiltre));
    grid.innerHTML = query
      ? `<div class="empty">Aucun outil ne correspond à « ${textToCode(query)} »${libellePortee() ? ` dans ${textToCode(libellePortee())}` : ''}${filtres ? ' avec les filtres actuels' : ''}.<br />`
        + `Essaie un mot plus court, un nom de commande, ou colle le message d\u2019erreur que tu vois.</div>`
      : (filtres ? '<div class="empty">Aucune entrée ne correspond aux filtres actuels.</div>'
        : '<div class="empty">Aucun outil dans cette catégorie.</div>');
    return;
  }

  const favoris = new Set(lireFavoris());
  const ligne = ({ entree, motif }) => ligneResultatMarkup(entree, { favori: favoris.has(entree.id), motif: query ? motif : null });
  // Catalogue des assistants sans portée : l'ordre historique des outils est conservé (pas de titres de groupe).
  if (mode === 'liste' && !(vueAssistants && !p.domaineId)) {
    // Liste complète d'une portée : titres de groupe (domaine, famille, sujet, section).
    const parId = new Map(results.map((r) => [r.entree.id, r]));
    grid.innerHTML = groupes(results.map((r) => r.entree), { ...p, categories: categoriesAffichees.map((c) => c.name) })
      .map((g) => (g.titre ? groupeEnteteMarkup({ titre: g.titre, route: g.route, compte: g.entrees.length }) : '')
        + g.entrees.map((e) => ligne(parId.get(e.id))).join('')).join('');
  } else {
    grid.innerHTML = results.map(ligne).join('');
  }
}

/** Clics sur les lignes de résultat : une seule écoute, posée une fois. */
function brancherListe() {
  const grid = document.querySelector('#toolGrid');
  grid.addEventListener('click', (ev) => {
    const carte = ev.target.closest('.task-row');
    if (!carte) return;
    const entree = entreeParId(carte.dataset.id);
    if (!entree) return;
    if (ev.target.closest('.fav-toggle')) {
      ev.stopPropagation();
      basculerFavori(entree.id);
      renderHome();
      grid.querySelector(`.task-row[data-id="${CSS.escape(entree.id)}"] .fav-toggle`)?.focus();
      return;
    }
    ouvrirEntree(entree);
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
  const bash = estBash(tool);

  // L'élévation ne se dit pas de la même façon des deux côtés : « console en
  // tant qu'administrateur » ne veut rien dire sous Linux, et « sudo » ne veut
  // rien dire sous Windows. Un texte générique aurait été faux des deux côtés.
  let admin;
  if (estIOS(tool)) {
    admin = `<p class="admin-flag admin-optional">Aucun droit système sur ton ordinateur : ce fichier se colle dans la <strong>console de l’équipement</strong>, en mode privilégié (invite se terminant par #). Le mot de passe enable se tape à la main.</p>`;
  } else if (bash) {
    admin = tool.requiresAdmin
      ? `<p class="admin-flag admin-required">Privilèges <strong>root</strong> nécessaires (<code>sudo</code>).</p>`
      : `<p class="admin-flag admin-optional">Aucun privilège <strong>root</strong> n’est nécessaire : ce script lit seulement. Les droits de lecture listés ci-dessous restent requis.</p>`;
  } else {
    admin = tool.requiresAdmin
      ? `<p class="admin-flag admin-required">Console PowerShell <strong>en tant qu’administrateur</strong> obligatoire.</p>`
      : `<p class="admin-flag admin-optional">Aucune élévation <strong>administrateur locale</strong> n’est nécessaire. Les droits listés ci-dessous restent obligatoires.</p>`;
  }

  // Bandeau de plateforme : la première chose à savoir devant une fiche, c'est
  // sur quelle machine elle s'applique et ce qu'elle produit.
  const lecture = estLectureSeule(tool)
    ? `<span class="badge badge-lecture">Lecture seule</span>`
    : `<span class="badge badge-modif">Modifie le système</span>`;
  const bandeau = `<p class="plateforme-bandeau" id="plateformeBandeau">`
    + `<span class="badge badge-plateforme badge-${plateformeDe(tool).toLowerCase()}">${textToCode(plateformeDe(tool))}</span>`
    + `<span class="badge badge-sortie">${textToCode(etiquetteSortie(tool))}</span>`
    + lecture
    + `</p>`;

  // Les blocs suivants n'existent que si l'outil les déclare : un titre suivi
  // d'une liste vide est une promesse non tenue, et le catalogue Windows ne
  // déclare pas ces champs.
  const bloc = (titre, valeurs) => (Array.isArray(valeurs) && valeurs.length
    ? `<h3>${titre}</h3><ul>${valeurs.map(li).join('')}</ul>` : '');
  const ligne = (titre, valeur) => (valeur
    ? `<h3>${titre}</h3><p>${textToCode(String(valeur))}</p>` : '');

  // Essentiel visible : plateforme, effet, droits et prérequis. Le détail (compatibilité,
  // limites, contexte, ce qui a été validé) est replié mais reste à un clic : rien n'est retiré.
  return `<div class="details prereqs" id="prereqBlock">`
    + bandeau
    + `<h3>Prérequis</h3>${admin}<ul>${tool.prereqs.map(li).join('')}</ul>`
    + `<details class="prereq-more" id="prereqMore"><summary>Compatibilité, limites, contexte et validation</summary>`
    + `<h3>Systèmes compatibles</h3><ul>${tool.os.map(li).join('')}</ul>`
    + bloc('Distributions visées', tool.distros)
    + bloc('Paquets nécessaires', tool.packages)
    + ligne('Privilèges', tool.privileges)
    + ligne('Service concerné', tool.service)
    + bloc('Limites connues', tool.limites)
    + cloudMarkup(tool, { bloc, ligne })
    + ciscoMarkup(tool, { bloc })
    + `</details>`
    + impressionMarkup(tool, { bloc })
    + `</div>`;
}

/**
 * Bloc « Dans Azure » (LOT 8). N'existe que pour les outils qui déclarent
 * `cloud` : problème, exemple, ce qui est lu, écrit et facturé, permissions,
 * licences, limites. Il répond à la question que toute personne se pose avant
 * de lancer un script qui touche un abonnement : « qu'est-ce que ça lit, ça
 * écrit, et ça coûte ? ». Aucune donnée n'est collectée ici : le texte vient
 * de la fiche de l'outil.
 */
function cloudMarkup(tool, { bloc, ligne }) {
  const c = tool.cloud;
  if (!c) return '';
  return `<div class="cloud-bloc" id="cloudBloc">`
    + `<h3>Dans Azure : ce qui se passe</h3>`
    + ligne('Le problème', c.probleme)
    + ligne('Exemple en entreprise', c.exemple)
    + bloc('Ce qui est lu', c.lit)
    + bloc('Ce qui est écrit', c.ecrit)
    + bloc('Ce qui peut être facturé', c.facture)
    + bloc('Permissions nécessaires', c.permissions)
    + bloc('Licences', c.licences)
    + bloc('Limites de cet assistant', c.limites)
    + (typeof c.moteurs === 'string' ? ligne('Compatibilité PowerShell', c.moteurs) : bloc('Compatibilité PowerShell', c.moteurs))
    + (Array.isArray(c.validation) ? bloc('Ce qui a été validé — et ce qui ne l’a pas été', c.validation) : '')
    + `</div>`;
}

/**
 * RESEAU-CISCO-01 — contrat pédagogique d'une fiche Cisco : problème, utilité,
 * exemple, lectures avant modification, effets, résultat attendu, limites et
 * périmètre de validation. Absent des autres plateformes.
 */
function ciscoMarkup(tool, { bloc }) {
  const c = tool.cisco;
  if (!c) return '';
  const p = (titre, v) => (v ? `<h3>${titre}</h3><p>${textToCode(String(v))}</p>` : '');
  return `<div class="cisco-bloc" id="ciscoBloc">`
    + p('Le problème', c.probleme)
    + p('À quoi ça sert', c.utilite)
    + p('Exemple en entreprise', c.exemple)
    + bloc('À lire avant de modifier', c.lecture)
    + bloc('Ce que les commandes changent', c.effets)
    + bloc('Résultat attendu', c.attendu)
    + bloc('Limites de cet assistant', c.limites)
    + p('Ce qui a été validé', c.validation)
    + p('Matériel de référence', c.materiel)
    + `</div>`;
}

/**
 * LOT 9 — Imprimantes. Contrat pédagogique d'une fiche d'impression : problème,
 * exemple, première vérification, ce qui est lu, ce qui est écrit, effets,
 * limites et périmètre de validation. Le texte vient de la fiche ; la page ne
 * collecte rien. Absent des autres catégories.
 */
function impressionMarkup(tool, { bloc }) {
  const c = tool.impression;
  if (!c) return '';
  const p = (titre, v) => (v ? `<h3>${titre}</h3><p>${textToCode(String(v))}</p>` : '');
  return `<div class="impression-bloc" id="impressionBloc">`
    + `<h3>Imprimantes : ce qui se passe</h3>`
    + p('Le problème', c.probleme)
    + p('Première vérification', c.premiere)
    + `<details class="impression-more"><summary>Exemple, ce qui est lu et écrit, effets, limites, validation</summary>`
    + p('Exemple en entreprise', c.exemple)
    + p('Ce qui est lu', c.lit)
    + p('Ce qui est écrit', c.ecrit)
    + p('Effets', c.effets)
    + bloc('Limites de cet assistant', c.limites)
    + (Array.isArray(c.validation) ? bloc('Ce qui a été validé — et ce qui ne l’a pas été', c.validation) : '')
    + `</details></div>`;
}

/**
 * Procédure d'exécution commune à tous les scripts — longue, donc repliée par
 * défaut. Son avertissement de sécurité, lui, est rendu à l'intérieur : replier
 * n'est pas masquer, le titre reste explicite et la section s'ouvre d'un clic
 * ou d'une touche Entrée.
 */
function execNotesMarkup(tool) {
  // Deux blocs, parce que les obstacles n'ont rien en commun. Windows bloque un
  // script non signé venant d'Internet, d'où la table des stratégies
  // d'exécution. Linux ne connaît pas cela : ce qui bloque, c'est le bit
  // d'exécution, un montage noexec, des fins de ligne CRLF, les privilèges.
  // Afficher la table PowerShell sur une fiche Bash serait une fausse piste,
  // et quelqu'un la suivrait.
  const ios = estIOS(tool);
  const bash = estBash(tool) || ios;
  const n = notesDe(tool);

  const steps = n.steps.map((st) =>
    `<li><strong>${textToCode(st.label)}</strong><br />${textToCode(st.detail)}`
    + (st.command ? `<pre class="cmd">${textToCode(st.command)}</pre>` : '')
    + `</li>`).join('');

  // Côté Windows : la table des stratégies. Côté Linux : la table des
  // obstacles, avec le message d'erreur exact de chacun — on arrive ici avec
  // un message sous les yeux, pas avec une question théorique.
  let tableau;
  if (bash) {
    const lignes = n.obstacles.map((ob) =>
      `<tr><td>${textToCode(ob.name)}</td><td><code>${textToCode(ob.message)}</code></td>`
      + `<td>${textToCode(ob.fix)}</td></tr>`).join('');
    tableau = `<h4>${ios ? 'Ce qui fait refuser une commande par IOS' : 'Ce qui empêche un script Bash de démarrer'}</h4>`
      + `<table class="policy-table"><thead><tr><th>Obstacle</th><th>Message</th>`
      + `<th>Solution</th></tr></thead><tbody>${lignes}</tbody></table>`;
  } else {
    const lignes = n.policies.map((po) =>
      `<tr><td><code>${textToCode(po.name)}</code></td><td>${textToCode(po.local)}</td>`
      + `<td>${textToCode(po.internet)}</td></tr>`).join('');
    tableau = `<h4>Stratégies d’exécution PowerShell</h4>`
      + `<table class="policy-table"><thead><tr><th>Stratégie</th><th>Script local</th>`
      + `<th>Script téléchargé</th></tr></thead><tbody>${lignes}</tbody></table>`;
  }

  const sources = n.sources.map((so) =>
    `<a class="source-link" target="_blank" rel="noreferrer" href="${so.url}">${textToCode(so.label)}</a>`).join(' · ');

  // Les commandes d'exécution propres à CET outil, extension et sudo compris.
  const cmds = commandesExecution(tool).map((c) =>
    `<li><strong>${textToCode(c.label)}</strong>`
    + (c.detail ? `<br />${textToCode(c.detail)}` : '')
    + `<pre class="cmd">${textToCode(c.command)}</pre></li>`).join('');

  return `<details class="details exec-notes" id="execNotes">`
    + `<summary>${textToCode(n.title)}</summary>`
    + `<p>${textToCode(n.intro)}</p>`
    + (cmds ? `<h4>Pour cet outil</h4><ol class="exec-steps" id="execCommandes">${cmds}</ol>` : '')
    + `<ol class="exec-steps">${steps}</ol>`
    + tableau
    + `<p class="exec-warning">${textToCode(n.warning)}</p>`
    + `<p class="exec-sources">${sources}</p>`
    + `</details>`;
}

/** Erreurs fréquentes — section 8, repliée par défaut. */
function commonErrorsMarkup(tool) {
  const n = notesDe(tool);
  return `<details class="details common-errors" id="commonErrors">`
    + `<summary>Erreurs fréquentes</summary>`
    + `<h4>Propres à cet outil</h4>${tool.commonErrors.map(errorEntryMarkup).join('')}`
    + `<h4>Communes à tous les scripts</h4>${n.errors.map(errorEntryMarkup).join('')}`
    + `</details>`;
}

/** Méthode graphique — section 7, repliée par défaut, jamais supprimée. */
function guiMarkup(tool) {
  return `<details class="details gui-method" id="guiMethod">`
    + `<summary>Interface graphique, sans script</summary>`
    + `<ol class="steps">${tool.gui.map((step) => `<li>${textToCode(step)}</li>`).join('')}</ol>`
    + `</details>`;
}

/** Sources officielles — section 9. */
function sourcesMarkup(tool) {
  // Les sources communes suivent la plateforme : renvoyer une fiche Bash vers
  // la documentation PowerShell n'aiderait personne.
  const n = notesDe(tool);
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
    // Champ multiligne : une liste d'OU, un bloc de noms, tout ce qui se copie
    // depuis un tableau de conception. La valeur se lit comme celle d'un input.
    if (field.type === 'textarea') {
      const lignes = String(field.default ?? '').split('\n').length;
      return `<div class="field"><label for="${field.id}">${field.label}</label>`
        + `<textarea id="${field.id}" rows="${Math.min(Math.max(lignes, 3), 14)}" spellcheck="false">${textToCode(field.default ?? '')}</textarea>`
        + (field.help ? `<small>${field.help}</small>` : '')
        + `<span id="${field.id}-error" class="field-error" aria-live="polite" hidden></span></div>`;
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
      estIOS(tool) ? 'Génère les commandes, puis relis l\u2019aperçu.' : 'Génère le script, puis relis l\u2019aperçu.',
      estIOS(tool) ? 'Copie ou télécharge le fichier, puis colle les commandes dans la console, étape par étape.' : 'Copie ou télécharge le fichier, puis exécute-le.',
    ];
    // Le mode d'emploi suit la plateforme. En mode Débutant surtout : dire
    // « ouvre PowerShell » à quelqu'un qui tient un script Bash, c'est le
    // laisser devant une console qui refusera le fichier sans expliquer
    // pourquoi. Aucune information de sécurité n'est retirée ni allégée d'un
    // côté ou de l'autre — seul le chemin pratique change.
    const modeEmploi = estIOS(tool)
      ? [
        'Ouvre la console du commutateur (câble console, SSH, ou l’onglet CLI de Packet Tracer) et vérifie que l’invite porte le nom indiqué dans l’en-tête du fichier.',
        'Passe en mode privilégié avec « enable » : le mot de passe se tape à la main, il ne figure jamais dans le fichier.',
        'Colle les étapes UNE PAR UNE : lis le résultat de chaque lecture avant de passer à la suivante.',
        'Les lignes qui commencent par « ! » sont des commentaires, ignorés par IOS. Si ta console les refuse en mode utilisateur, régénère en « Commandes seules ».',
        'Les modifications vivent en mémoire vive tant qu’elles ne sont pas sauvegardées : ce fichier ne sauvegarde rien de lui-même.',
        'Fais les contrôles de la section 5 pour confirmer le résultat.',
        'Si le résultat ne convient pas, la section 6 donne le retour en arrière.',
        'Si tu préfères éviter le fichier, la section 7 donne la méthode pas à pas.',
      ]
      : estBash(tool)
      ? [
        'Ouvre un terminal sur la machine Linux concernée, en suivant les prérequis de la section 2.',
        'Rends le script exécutable avec « chmod +x », puis lance-le. Si le dossier refuse l’exécution, lance « bash nom-du-script.sh » : cela marche aussi.',
        'Le fichier téléchargé est déjà en fins de ligne LF et sans BOM, comme Linux l’attend. Tu n’as rien à convertir.',
        'Ajoute « sudo » seulement si la section 2 le demande. Un outil en lecture seule n’en a pas besoin.',
        'Lis les messages affichés par le script : ils disent ce qui a été lu ou modifié.',
        'Fais les contrôles de la section 5 pour confirmer que le problème est réglé.',
        'Si le résultat ne convient pas, la section 6 explique comment revenir en arrière.',
        'Si tu préfères éviter les scripts, la section 7 donne la méthode manuelle.',
      ]
      : [
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

function ficheNavMarkup(tool) {
  // Le libellé de la section de code dit ce qu'elle contient : « Script
  // PowerShell », « Script Bash », « Commandes Cisco IOS » — jamais « Script ».
  const libelle = (a) => (a.cible === 'sectionScript' ? etiquetteSortie(tool) : a.label);
  return `<nav class="fiche-nav" id="ficheNav" aria-label="Aller à une section de la fiche">`
    + FICHE_ANCRES.map((a) =>
        `<a class="fiche-nav-link" href="#${a.cible}" data-cible="${a.cible}">${textToCode(libelle(a))}</a>`).join('')
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


/** Ce que fait un script complet, en cinq lignes, avant son code. */
function resumeScript(tool) {
  const premiere = String(tool.summary).split(/(?<=[.!?])\s+/)[0];
  const lignes = [['Ce que ça fait', premiere]];
  const ro = estLectureSeule(tool);
  // Le ton suit l'effet réel (même règle que le badge de la fiche) : vert pour une
  // lecture, ambre pour une modification, rouge pour un effet destructif.
  const ton = (ro || tool.risk === 'diagnostic') ? 'ok' : (tool.risk === 'destructive' ? 'danger' : 'attention');
  lignes.push(['Effet', ro ? 'Lecture seule : ne modifie rien.' : (RISQUE_SIMPLE[tool.risk] ?? ''), ton]);
  let produit;
  if (estIOS(tool)) produit = 'Des commandes Cisco IOS à coller dans la console, étape par étape. Le Toolkit ne se connecte à aucun équipement.';
  else if (estDocumentationSeule(tool)) produit = 'Une procédure à suivre à la main (aucun script).';
  else if (estBash(tool)) produit = 'Un script Bash (.sh) à lancer sur la machine Linux concernée.';
  else produit = 'Un script PowerShell (.ps1) à lancer sur le poste concerné.';
  const format = (tool.fields ?? []).find((f) => f.type === 'select' && (f.options ?? []).some((o) => String(o.value ?? o) === 'Console'));
  if (format) produit += ' Affiche un rapport ou l’exporte (Console, JSON, HTML, CSV).';
  lignes.push(['Produit', produit]);
  lignes.push(['Droits', estIOS(tool) ? 'Mode privilégié sur l’équipement.' : (tool.requiresAdmin ? (estBash(tool) ? 'Root (sudo) nécessaire.' : 'Console administrateur nécessaire.') : 'Session standard.')]);
  return lignes;
}

/** Lien vers la version courte de la tâche, quand une fiche existe. */
function ficheRapideMarkup(tool) {
  return versionsCourtesMarkup(liensDeAssistant(tool.id));
}

/**
 * Fil d'Ariane et retour d'une fiche. Le bouton de retour ramène à la liste
 * d'où l'on vient (contrat historique : accueil ou liste des assistants si la
 * fiche a été ouverte par un lien direct) et nomme le groupe quand la liste
 * en est un. Le fil d'Ariane, lui, mène toujours au groupe de la fiche.
 */
function enteteNavigationFiche(vue, entree, titre, boutonId) {
  const fil = filDeEntree(entree, entree.categorie);
  const maillons = [{ nom: 'Catalogue', route: '#/' }];
  if (fil.length) {
    fil.forEach((m) => maillons.push({ nom: m.nom, route: vueAssistants ? m.route.replace('#/rubrique/', '#/assistants/') : m.route }));
  }
  maillons.push({ nom: titre });
  vue.insertAdjacentHTML('afterbegin', filArianeMarkup(maillons, { id: 'filFiche' }));
  const bouton = vue.querySelector(`#${boutonId}`);
  const p = portee();
  if (p.domaineId && bouton) bouton.textContent = `← Retour : ${nomDePortee(p)}`;
  bouton?.addEventListener('click', () => revenirAccueil());
}

function renderTool() {
  const tool = currentTool;
  const view = document.querySelector('#toolView');
  const riskLabels = { diagnostic: 'DIAGNOSTIC — aucune modification', safe: 'RÉVERSIBLE — vérifier avant exécution', caution: 'ATTENTION — modifie la configuration', destructive: 'DESTRUCTIF — confirmation indispensable' };
  view.innerHTML = `<div class="tool-header"><button class="back-button" id="backButton">← Tous les outils</button><div><div class="tag">${textToCode((tool.subcategory ? tool.category.toUpperCase() + ' \u00B7 ' + tool.subcategory : tool.category.toUpperCase()) + ' \u00B7 ASSISTANT COMPLET')}</div><h1>${tool.icon} ${tool.title}</h1>${enteteAssistantMeta(entreeParId(tool.id), { favori: estFavori(tool.id) })}<span class="risk ${tool.risk}">${riskLabels[tool.risk]}</span></div></div>${ficheRapideMarkup(tool)}${resumeScriptMarkup(resumeScript(tool))}${ficheNavMarkup(tool)}${modeBlockMarkup(tool)}<div id="tabContent"></div>`;
  enteteNavigationFiche(view, entreeParId(tool.id), tool.title, 'backButton');
  const favTool = view.querySelector('#toolFav');
  favTool.addEventListener('click', () => {
    const actif = basculerFavori(tool.id);
    favTool.textContent = actif ? '★' : '☆';
    favTool.setAttribute('aria-pressed', String(actif));
    favTool.classList.toggle('is-fav', actif);
    favTool.setAttribute('aria-label', actif ? 'Retirer des favoris' : 'Ajouter aux favoris');
  });
  const content = view.querySelector('#tabContent');
  const defaultValues = Object.fromEntries(tool.fields.map((field) => [field.id, String(field.default ?? '')]));
  // LOT 7 (25/n) — le normaliseur suit la PLATEFORME, aussi pour l'aperçu
  // INITIAL. Il ne le faisait pas : normalizeScript() (continuation PowerShell,
  // « antislash + saut de ligne » devient « backtick + saut de ligne ») était
  // appliqué aux scripts Bash, dont 42 assistants affichaient — et offraient en
  // Copier / Télécharger avant tout clic sur « Générer » — un script où chaque
  // continuation de ligne était devenue une substitution de commande. « bash -n »
  // refusait les 42. Le chemin de soumission, lui, aiguillait correctement, ce
  // qui rendait le défaut invisible : il ne frappait que les valeurs par défaut.
  // Toujours UN SEUL appel à generate() par site (la garde d'identité en compte
  // deux : aperçu initial, soumission).
  const scriptBrut = tool.generate(defaultValues);
  const script = normaliserSortie(tool, scriptBrut);
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
      + `<p class="fiche-lead fiche-lead-note">${estIOS(tool) ? 'Cet assistant prépare des commandes Cisco IOS et les explique. Il ne se connecte à aucun équipement : c\u2019est toi qui les colles dans la console.' : 'Cet assistant prépare le script et l\u2019explique. Il ne l\u2019exécute pas : c\u2019est toi qui le lances, sur ta machine.'}</p>`
    + `</section>`
    + `<section class="fiche-section" data-section="2" id="sectionRisque" aria-labelledby="titreRisque">`
      + titreSection(2, 'Risque, compatibilité et prérequis', 'titreRisque')
      + `<p class="fiche-risk fiche-risk-${tool.risk}" id="ficheRisque">`
      + `<strong>Niveau de risque :</strong> ${textToCode(riskLabels[tool.risk])}</p>`
      + compatMarkup(tool)
      + execNotesMarkup(tool)
    + `</section>`
    + `<div class="tool-content">`
      + `<section class="panel fiche-section" data-section="3" id="sectionFormulaire" aria-labelledby="titreFormulaire">`
        + titreSection(3, 'Tes informations', 'titreFormulaire')
        + `<form id="toolForm" novalidate>${formMarkup(tool)}`
        + `<button class="primary-button" type="submit">${estIOS(tool) ? 'Générer les commandes' : 'Générer le script'}</button></form>`
      + `</section>`
      + `<section class="panel fiche-section" data-section="4" id="sectionScript" aria-labelledby="titreScript">`
        + titreSection(4, `${etiquetteSortie(tool)} généré`, 'titreScript')
        + `<div class="code-wrap is-clamped" id="codeWrap"><pre id="scriptOutput" class="code" tabindex="0" role="region" aria-label="Aperçu du ${textToCode(etiquetteSortie(tool))}">${textToCode(script)}</pre></div>`
        + `<button type="button" class="secondary-button script-toggle" id="scriptToggle" aria-expanded="false" aria-controls="scriptOutput">Afficher le script complet</button>`
        + `<div class="code-actions"><button id="copyButton" class="secondary-button">Copier</button>`
        + `<button id="downloadButton" class="secondary-button">Télécharger ${textToCode(extensionDe(tool) ?? '')}</button></div>`
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
      + titreSection(7, 'Interface graphique', 'titreGraphique')
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

  // Script replié par défaut : les premières lignes suffisent à reconnaître le
  // fichier, le reste s'ouvre d'un clic. Copier et Télécharger restent visibles.
  const bascule = view.querySelector('#scriptToggle');
  const enveloppe = view.querySelector('#codeWrap');
  if (bascule && enveloppe) {
    const lignes = script.split('\n').length;
    if (lignes <= 9) { enveloppe.classList.remove('is-clamped'); bascule.hidden = true; }
    bascule.addEventListener('click', () => {
      const ouvert = enveloppe.classList.toggle('is-clamped') === false;
      bascule.setAttribute('aria-expanded', String(ouvert));
      bascule.textContent = ouvert ? 'Replier le script' : 'Afficher le script complet';
    });
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
      // AIGUILLAGE — et il n'est pas cosmétique. normalizeScript() remplace
      // « antislash + saut de ligne » par « backtick + saut de ligne », parce
      // que la continuation de ligne de PowerShell est le backtick. En Bash la
      // continuation EST l'antislash : appliquer le normaliseur PowerShell à un
      // script Bash y remplacerait des continuations valides par des
      // substitutions de commande. L'outil injecterait lui-même du code.
      // UN SEUL appel à generate(), puis l'aiguillage. Écrire l'appel dans
      // les deux branches du ternaire aurait produit le même résultat mais
      // deux sites d'appel, ce que la garde d'identité compte — à juste titre :
      // un générateur appelé depuis plusieurs endroits finit par être appelé
      // différemment selon l'endroit.
      const brut = tool.generate(values);
      output = normaliserSortie(tool, brut);
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
      // Même garantie qu'au téléchargement : un script Bash collé dans un
      // éditeur ne doit pas emporter de CR.
      await navigator.clipboard.writeText(
        estIOS(tool) ? normalizeIos(preEl.textContent) : estBash(tool) ? normalizeScriptSh(preEl.textContent) : preEl.textContent);
      feedbackEl.textContent = estIOS(tool) ? 'Commandes copiées dans le presse-papiers.' : 'Script copié dans le presse-papiers.';
    } catch {
      feedbackEl.textContent = 'Copie impossible : sélectionne le texte manuellement.';
    }
  });

  dlBtn.addEventListener('click', () => {
    // ------------------------------------------------------------------------
    // DEUX PLATEFORMES, DEUX RÈGLES D'ENCODAGE EXACTEMENT OPPOSÉES
    //
    // .ps1 : BOM UTF-8 (EF BB BF) OBLIGATOIRE. Sans lui, Windows PowerShell
    //        5.1 relit le fichier en CP1252 ; un tiret cadratin y devient un
    //        guillemet typographique, donc un vrai délimiteur de chaîne, et
    //        l'analyse déraille. Le LOT 6 l'a payé pour de bon.
    //
    // .sh  : BOM INTERDIT. Les trois octets du BOM se placeraient AVANT « #! »,
    //        le noyau ne reconnaîtrait plus le shebang, et le script échouerait
    //        sur « bad interpreter » — ou pire, tournerait sous un autre shell.
    //
    // Et pour .sh, LF strictement : un CRLF casse le shebang de la même façon
    // (« /usr/bin/env bash\r » n'existe pas) et colle un \r invisible à la fin
    // de chaque valeur lue. Le texte vient d'un <pre> du DOM, où le navigateur
    // peut avoir normalisé les sauts de ligne : on ne suppose pas, on force.
    // ------------------------------------------------------------------------
    const ext    = extensionDe(tool);
    if (!ext) return;                       // outil documentaire : rien à livrer
    // .ios.txt : ni BOM ni CRLF — la console IOS reçoit des octets ASCII, LF.
    const sansBom = estBash(tool) || estIOS(tool);
    const texte  = estIOS(tool) ? normalizeIos(preEl.textContent)
      : (estBash(tool) ? normalizeScriptSh(preEl.textContent) : preEl.textContent);
    const octets = new TextEncoder().encode(texte);
    const parts  = sansBom ? [octets] : [new Uint8Array([0xEF, 0xBB, 0xBF]), octets];
    const blob   = new Blob(parts, { type: 'text/plain;charset=utf-8' });
    const link   = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomFichierDe(tool);
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

// ---------------------------------------------------------------------------
// Fiche tâche — #/tache/<id>
// Le marquage vient de vue-taches.mjs ; ici, seulement le câblage.
// ---------------------------------------------------------------------------
function methodeActive() {
  const p = currentTache.procedure;
  return p.methodes.find((m) => m.id === methodeTache) ?? p.methodes[0];
}

/** Vue d'une fiche : le choix local, sinon le défaut du mode (Technicien : rapide ; Débutant : pas à pas). */
function vueTache() { return vueLocale ?? (estDebutant() ? 'pas' : 'rapide'); }

function renduCourant() {
  return rendreMethode(methodeActive(), currentTache.procedure.params, saisiesTache);
}

function majEtapes() {
  const p = currentTache.procedure;
  const zone = document.querySelector('#etapesZone');
  if (!zone) return;
  zone.innerHTML = etapesMarkup(p, methodeActive(), saisiesTache, { vue: vueTache() }).html;
  const dl = document.querySelector('#dlDossier');
  if (dl) {
    const pret = renduCourant().manquants.length === 0;
    dl.setAttribute('aria-disabled', pret ? 'false' : 'true');
    if (pret) dl.removeAttribute('aria-disabled');
    const hint = document.querySelector('#dlDossierHint');
    if (hint) hint.textContent = pret ? 'Plan et commandes par équipement, sans invite ni secret.' : 'Renseigne toutes les valeurs pour télécharger le dossier.';
  }
}

function majNoteExemples() {
  const p = currentTache.procedure;
  const note = document.querySelector('#exemplesNote');
  if (!note) return;
  const egal = (prm) => (prm.type === 'table'
    ? JSON.stringify((saisiesTache[prm.id] ?? []).map((r) => prm.colonnes.map((c) => r[c.id] ?? ''))) === JSON.stringify(prm.exemple.map((r) => prm.colonnes.map((c) => r[c.id] ?? '')))
    : (saisiesTache[prm.id] ?? '') === prm.exemple);
  const tous = p.params.length > 0 && p.params.every(egal);
  note.textContent = tous ? 'Valeurs d’exemple fictives : remplace-les par les tiennes avant de copier.' : '';
  note.classList.toggle('is-warn', tous);
}

/** Erreurs affichées sous chaque tableau : cellule invalide, doublon, chevauchement… */
function majErreursTables() {
  const p = currentTache.procedure;
  const ev = evaluerValeurs(p.params, saisiesTache);
  for (const prm of p.params.filter((x) => x.type === 'table')) {
    const liste = document.querySelector(`#te-${prm.id}`);
    if (!liste) continue;
    const t = ev.tables[prm.id];
    const messages = t.erreurs.map((e) => e.message);
    liste.innerHTML = messages.map((m) => `<li>${esc(m)}</li>`).join('');
    document.querySelectorAll(`input.cell[data-table="${prm.id}"]`).forEach((el) => {
      const mauvais = t.erreurs.some((e) => e.ligne === Number(el.dataset.row) && e.col === el.dataset.col);
      el.setAttribute('aria-invalid', mauvais ? 'true' : 'false');
      el.classList.toggle('is-invalid', mauvais);
    });
  }
}

function renderTache() {
  const entree = currentTache;
  const p = entree.procedure;
  const view = document.querySelector('#taskView');
  const assistant = p.assistant ? tools.find((t) => t.id === p.assistant) : null;
  view.innerHTML = tachePageMarkup(entree, {
    methodeId: methodeActive().id,
    vue: vueTache(),
    saisies: saisiesTache,
    favori: estFavori(entree.id),
    assistantTitre: assistant?.title ?? null,
    prete: renduCourant().manquants.length === 0,
  });
  document.title = `${p.titre} — KJEMO IT Toolkit`;

  enteteNavigationFiche(view, entree, p.titre, 'taskBack');

  const fav = view.querySelector('#taskFav');
  fav.addEventListener('click', () => {
    const actif = basculerFavori(entree.id);
    fav.textContent = actif ? '★' : '☆';
    fav.setAttribute('aria-pressed', String(actif));
    fav.classList.toggle('is-fav', actif);
    fav.setAttribute('aria-label', actif ? 'Retirer des favoris' : 'Ajouter aux favoris');
  });

  // Vue rapide / Pas à pas : un choix LOCAL à cette fiche, qui ne touche pas au mode global.
  view.querySelectorAll('.vue-option').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.vue === vueTache()) return;
    vueLocale = b.dataset.vue;
    renderTache();
    document.querySelector(`#vue-${vueLocale}`)?.focus();
  }));

  // Onglets de méthode : flèches gauche/droite, comme tout tablist.
  const onglets = [...view.querySelectorAll('.method-tab')];
  onglets.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      methodeTache = tab.dataset.methode;
      renderTache();
      document.querySelector(`#tab-${methodeTache}`)?.focus();
    });
    tab.addEventListener('keydown', (ev) => {
      const delta = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      ev.preventDefault();
      onglets[(i + delta + onglets.length) % onglets.length].click();
    });
  });

  // Paramètres simples : saisie -> validation affichée -> étapes recalculées.
  view.querySelectorAll('[data-param]').forEach((input) => {
    input.addEventListener('input', () => {
      const prm = p.params.find((x) => x.id === input.dataset.param);
      saisiesTache[prm.id] = input.value;
      const err = view.querySelector(`#p-${prm.id}-err`);
      const r = validerParametre(prm, input.value);
      const message = input.value.trim() && !r.ok ? r.error : '';
      err.textContent = message;
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      input.classList.toggle('is-invalid', Boolean(message));
      input.classList.toggle('is-valid', r.ok && input.value.trim() !== '');
      majNoteExemples();
      majErreursTables();
      majEtapes();
    });
  });

  // Tableaux (plan de VLAN…) : une cellule modifie une ligne ; ajouter / supprimer une ligne.
  const form = view.querySelector('#paramsForm');
  if (form) {
    form.addEventListener('input', (ev) => {
      const cell = ev.target.closest('input.cell');
      if (!cell) return;
      const id = cell.dataset.table; const prm = p.params.find((x) => x.id === id);
      const rows = Array.isArray(saisiesTache[id]) ? saisiesTache[id] : [];
      while (rows.length < Number(cell.dataset.row) + 1) rows.push({});
      rows[Number(cell.dataset.row)][cell.dataset.col] = cell.value;
      saisiesTache[id] = rows;
      majNoteExemples(); majErreursTables(); majEtapes();
    });
    form.addEventListener('click', (ev) => {
      const ajout = ev.target.closest('.row-add'); const retrait = ev.target.closest('.row-del');
      const cible = ajout ?? retrait;
      if (!cible || cible.getAttribute('aria-disabled') === 'true') return;
      const id = cible.dataset.table; const prm = p.params.find((x) => x.id === id);
      const rows = lignesSaisies(prm, saisiesTache);
      if (ajout) rows.push({}); else rows.splice(Number(retrait.dataset.row), 1);
      saisiesTache[id] = rows;
      const zone = form.querySelector(`[data-table-wrap="${id}"]`);
      zone.outerHTML = tableMarkup(prm, saisiesTache);
      majNoteExemples(); majErreursTables(); majEtapes();
      const dernier = ajout ? form.querySelector(`input.cell[data-table="${id}"][data-row="${rows.length - 1}"]`) : form.querySelector(`.row-add[data-table="${id}"]`);
      dernier?.focus();
    });
  }

  const exemples = view.querySelector('#exemplesBtn');
  if (exemples) {
    exemples.addEventListener('click', () => {
      p.params.forEach((prm) => {
        saisiesTache[prm.id] = prm.type === 'table' ? prm.exemple.map((r) => ({ ...r })) : prm.exemple;
      });
      renderTache();
      document.querySelector('#exemplesBtn')?.focus();
    });
  }
  majNoteExemples();
  majErreursTables();

  // Copie : le texte est CALCULÉ (procedures.mjs), jamais lu dans le DOM — les
  // invites, les numéros, les libellés d'équipement et les repères restent donc
  // hors du presse-papiers. Un secret n'existe pas ici : il se tape sur l'équipement.
  view.querySelector('.tache').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.copy-step, .copy-seg, .copy-phase, .copy-eq, #copyAll');
    if (btn) return copier(btn, view);
    const dl = ev.target.closest('#dlDossier');
    if (dl) return telechargerDossier(dl, view);
  });
}

/** Résout le texte, la méthode (normalisation) et l'indice d'un bouton de copie. */
function cibleDeCopie(btn, rendu, methode) {
  const methodeDe = (id) => (methode.equipements ?? []).find((q) => q.id === id)?.methode ?? methode.id;
  if (btn.matches('#copyAll')) return { texte: rendu.texteComplet, raison: rendu.raisonComplet, methodeId: methode.id, manquants: rendu.manquants };
  if (btn.matches('.copy-eq')) {
    const q = rendu.parEquipement.find((x) => x.id === btn.dataset.eq);
    return { texte: q.texte, raison: q.raison, methodeId: q.methode, manquants: rendu.manquants };
  }
  if (btn.matches('.copy-phase')) {
    const ph = rendu.phases[Number(btn.dataset.phase)];
    const eq = ph.equipement ? methodeDe(ph.equipement) : methode.id;
    return { texte: ph.texte, raison: ph.raison, methodeId: eq, manquants: ph.manquants, espaceFinal: false };
  }
  if (btn.matches('.copy-seg')) {
    // Segment de la Vue rapide : suite d'étapes consécutives, texte CALCULÉ (jamais lu dans le DOM).
    const etapes = btn.dataset.steps.split(',').map((n) => rendu.etapes[Number(n)]);
    const manquants = [...new Set(etapes.flatMap((x) => x.rendu.manquants))];
    const dernier = etapes[etapes.length - 1];
    const eq0 = etapes[0].equipement ? methodeDe(etapes[0].equipement) : methode.id;
    return { texte: manquants.length ? null : etapes.map((x) => x.rendu.texteCopie).join('\n'), raison: 'manquants', methodeId: eq0, manquants, espaceFinal: dernier.rendu.espaceFinal };
  }
  const e = rendu.etapes[Number(btn.dataset.step)];
  const eq = e.equipement ? methodeDe(e.equipement) : methode.id;
  if (btn.dataset.inst !== undefined) {
    const inst = e.rendu.instances[Number(btn.dataset.inst)];
    return { texte: e.rendu.bloque ? null : inst.texteCopie, raison: 'manquants', methodeId: eq, manquants: e.rendu.manquants, espaceFinal: e.rendu.espaceFinal };
  }
  return { texte: e.rendu.texteCopie, raison: 'manquants', methodeId: eq, manquants: e.rendu.manquants, espaceFinal: e.rendu.espaceFinal };
}

async function copier(btn, view) {
  const p = currentTache.procedure;
  const methode = methodeActive();
  const rendu = renduCourant();
  const cible = cibleDeCopie(btn, rendu, methode);
  const indice = view.querySelector(`#${CSS.escape(btn.getAttribute('aria-describedby') ?? '')}`);
  if (cible.texte === null || cible.texte === undefined) {
    if (cible.raison === 'manquants') {
      const libelles = Object.fromEntries(p.params.flatMap((x) => [[x.id, x.label], ...(x.colonnes ?? []).map((c) => [c.id, c.label])]));
      if (indice) indice.textContent = `À renseigner pour copier : ${cible.manquants.map((id) => libelles[id] ?? id).join(', ')}.`;
      const premier = cible.manquants[0];
      (view.querySelector(`#p-${premier}`) ?? view.querySelector(`input.cell[data-table="${premier}"]`) ?? view.querySelector('input.cell'))?.focus();
    } else if (indice) indice.textContent = raisonRefus(cible.raison);
    return;
  }
  try {
    await navigator.clipboard.writeText(texteCopiable(cible.texte, cible.methodeId, { espaceFinal: Boolean(cible.espaceFinal) }));
    if (indice) indice.textContent = btn.matches('#copyAll') ? 'Toutes les commandes sont copiées.' : btn.matches('.copy-eq') ? 'Séquence de cet équipement copiée.' : btn.matches('.copy-phase') ? 'Bloc copié.' : btn.matches('.copy-seg') ? 'Segment copié.' : 'Commande copiée.';
    btn.classList.add('is-copied');
    setTimeout(() => btn.classList.remove('is-copied'), 1600);
  } catch {
    if (indice) indice.textContent = 'Copie impossible : sélectionne le texte du bloc à la main.';
  }
}

/** Dossier de procédure : Markdown UTF-8, LF, sans BOM — plan et commandes par équipement, sans secret. */
function telechargerDossier(btn, view) {
  const p = currentTache.procedure;
  const rendu = renduCourant();
  const hint = view.querySelector('#dlDossierHint');
  if (rendu.manquants.length) {
    if (hint) hint.textContent = 'Renseigne toutes les valeurs pour télécharger le dossier.';
    return;
  }
  const texte = dossierMarkdown(p, rendu, methodeActive()).replace(/\r\n?/g, '\n');
  const blob = new Blob([texte], { type: 'text/markdown;charset=utf-8' });
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = `procedure-${p.id}.md`;
  document.body.appendChild(lien); lien.click(); lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  if (hint) hint.textContent = 'Dossier téléchargé.';
}

function render() {
  renderNavigation();
  renderModeSelector();
  renderThemeSelector();
  document.body.dataset.mode = modeCourant();
  document.querySelector('#home').hidden = Boolean(currentTool || currentTache);
  document.querySelector('#toolView').hidden = !currentTool;
  document.querySelector('#taskView').hidden = !currentTache;
  if (currentTool) renderTool(); else if (currentTache) renderTache(); else renderHome();
  if (currentTool || currentTache) window.scrollTo?.({ top: 0 });
}

const champRecherche = document.querySelector('#search');
const boutonEffacer  = document.querySelector('#searchClear');

function majEffacer() {
  if (boutonEffacer) boutonEffacer.hidden = champRecherche.value.length === 0;
}

champRecherche.addEventListener('input', () => {
  majEffacer();
  if (!currentTool && !currentTache) renderHome();
});

if (boutonEffacer) {
  boutonEffacer.addEventListener('click', () => {
    champRecherche.value = '';
    majEffacer();
    champRecherche.focus();
    if (!currentTool && !currentTache) renderHome();
  });
}

// Échap vide la recherche sans quitter le champ
champRecherche.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && champRecherche.value) {
    ev.preventDefault();
    champRecherche.value = '';
    majEffacer();
    if (!currentTool && !currentTache) renderHome();
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
const tacheInitiale = tacheDepuisHash();
const outilInitial = outilDepuisHash();
if (tacheInitiale) {
  currentTache = tacheInitiale;
  methodeTache = tacheInitiale.procedure.methodes[0].id;
  noterConsultation(tacheInitiale.id);
} else if (outilInitial) {
  currentTool = outilInitial;
  noterConsultation(outilInitial.id);
}
vueAssistants = location.hash === '#/assistants';
{
  const rub = lireRoute(location.hash);
  if (rub && !tacheInitiale && !outilInitial) {
    vueAssistants = rub.assistants;
    selectedCategory = domaineNomDe(rub.domaineId); familleSel = rub.familleId; sujetSel = rub.sujetId;
  }
}
brancherListe();
appliquerTheme();
render();
