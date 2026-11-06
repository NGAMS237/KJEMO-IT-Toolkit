// Point 2 (Codex) : import depuis './generators.mjs' — même répertoire dist/
// GitHub Pages publie dist/ à la racine ; './generators.mjs' est donc accessible.
import { tools, normalizeScript, textToCode, EXECUTION_NOTES,
         searchTools, searchCommonErrors } from './generators.mjs';
import { categoriesVisibles, categorieParNom, CATEGORIE_TOUT, CATEGORIES } from './categories.mjs';
import { plateformeDe, sortieDe, estBash, estIOS, estDocumentationSeule, estLectureSeule,
         extensionDe, nomFichierDe, etiquetteSortie, commandesExecution } from './plateforme.mjs';
import { normalizeScriptSh, EXECUTION_NOTES_BASH } from './noyau-bash.mjs';
import { normalizeIos, EXECUTION_NOTES_IOS } from './noyau-cisco.mjs';
import { plateformesDeProcedure } from './taches.mjs';
import { CLE_JOURNAL, MAX_CAPTURES, TABLEAUX, lireJournal, normaliserEntree, entreeVide, publierVersion, prochaineReference,
         filtrerJournal, entreeDepuisFiche, valeursPourJournal, entreeExemple, sauvegardeJournal, lireSauvegarde, jour } from './journal.mjs';
import { pdfJournal, nomFichierPdf, pdfInventaire } from './journal-pdf.mjs';
import { CLE_INVENTAIRE, TABLEAUX_EQUIPEMENT, TYPES_EQUIPEMENT, lireInventaire, normaliserEquipement, equipementVide, labosDe, filtrerInventaire,
         equipementsDepuisFiche } from './inventaire.mjs';
import { FEUILLE, typeNoeud, styleLien, schemaVide, idSchema, aimanter, normaliserTypesPerso, normaliserSchema, typeDepuisEquipement, schemaDepuisFiche, dessinerSchema, versSvg, decrireSchema } from './schema.mjs';
import { editeurSchemaMarkup, feuilleSvg, menuPortsMarkup } from './vue-schema.mjs';
import { apercuConfigMarkup, nouvelleLigne, poolsParVlan, ospfDepuisInterfaces } from './vue-config.mjs';
import { normaliserConfig, proposerConfig, commandesNoeud, texteAvecTitres } from './config-ios.mjs';
import { normaliserConfigAzure, FORMULAIRES, FORMULAIRES_ZONE, estAzure, decouperVnet, contexteAzure, commandesAzure, commandesZone, scriptAzure, texteAzure, nomAzure } from './config-azure.mjs';
import { apercuAzureMarkup } from './vue-azure.mjs';
import { modeleSchema } from './modeles-schema.mjs';
import { remplirDepuisSchema, phraseBilan, SYSTEME_DU_TYPE } from './schema-remplir.mjs';
import { MODELES, MODELE_PERSO, modele, modelesDuType, portsDuNoeud, portsOccupes, cableAutomatique, clePort } from './modeles.mjs';
import { ROUTE_INVENTAIRE, routeEquipement, lireRouteInventaire, inventaireListeMarkup, equipementMarkup, equipementsLaboMarkup } from './vue-inventaire.mjs';
import { ROUTE_JOURNAL, routeEntreeJournal, lireRouteJournal, journalListeMarkup, journalEditeurMarkup } from './vue-journal.mjs';
import { ENTREES_LISTEES, TOUTES_LES_ENTREES, chercher, entreeParId, ficheDeAssistant,
         compteParCategorie, couverture, liensDeAssistant } from './taches.mjs';
import { METHODES_PLATEFORME, ligneResultatMarkup, tachePageMarkup, etapesMarkup, formulaireMarkup, tableMarkup, lignesSaisies,
         resumeScriptMarkup, badgeEffet, esc, enteteAssistantMeta, versionsCourtesMarkup } from './vue-taches.mjs';
import { cheminDe, filDeEntree, lireRoute, routePortee, domaineIdDe, domaineNomDe, dans, noeud } from './classement.mjs';
import { filArianeMarkup, maillonsDePortee, nomDePortee, rubriqueMarkup, groupeEnteteMarkup, groupes,
         bandeauMasqueMarkup } from './vue-navigation.mjs';
import { rendreMethode, evaluerValeurs, validerParametre, texteCopiable, raisonRefus,
         dossierMarkdown } from './procedures.mjs';
import { COURS, COURS_PAR_ID, ROUTE_COURS, ROUTE_LABO, lireRouteTache, lireRouteCours, routeParcours, GABARIT_TP } from './cours.mjs';
import { CLE_LABO, CLE_PROGRESSION, normaliserLabo, saisiesDepuisLabo, normaliserProgression, basculer,
         texteEditeurModele, csvDepuisLignes, lignesDepuisTexte, avancement } from './labo.mjs';
import { ROUTE_MEMO, ROUTE_CATALOGUE, MEMO_GROUPES, MEMO_PAR_ID, FILTRES_MEMO, idsNouveaux, fichesDuCours, filtrerGroupe,
         compteGroupe, groupeDeFiche, lireRouteMemo, routeMemo } from './memo.mjs';
import { portesAccueilMarkup, groupeCarteMarkup, memoPageMarkup, memoGroupePageMarkup, cataloguePageMarkup,
         retourMemoFicheMarkup, retoursMarkup } from './vue-portes.mjs';
import { coursListeMarkup, coursPageMarkup, coursIntrouvableMarkup, laboMarkup, espacesMarkup,
         retourParcoursMarkup } from './vue-cours.mjs';
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
let espace = null;            // null | { type:'cours', coursId, lettre } | { type:'labo' } | { type:'memo', groupeId } | { type:'catalogue' }
// Fiche en fenêtre : la page d'où l'on vient reste derrière (fond = { espace, hash }), on ferme par la croix, Échap ou le fond.
let fond = null;               // null = fiche en pleine page (lien direct) ; sinon { espace: null|{…}, hash }
let pasModale = 0;             // fiches enchaînées dans la fenêtre (0 = une seule : fermer = retour arrière)
let hashPage = '#/';           // dernière page vue hors fiche
let declencheur = null;        // id de la fiche d'où la fenêtre a été ouverte (pour rendre le focus)
let fermetureModale = false;   // vrai pendant la fermeture : on garde la position de défilement
let memoFiltre = 'tous';       // 'tous' | 'nouveau' | 'tp' : puces de l'aide-mémoire
let contexteParcours = null;  // { coursId, lettre } quand la fiche est ouverte depuis un parcours
let etapeAffichee = null;     // dernière étape montrée par un lien (évite de la remontrer à chaque événement)
let etapeCible = null;        // numéro d'étape à montrer à l'ouverture d'une fiche
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
const compatiblePlateforme = (e, plat = platFiltre) => !plat || e.plateformes.includes(plat);
const listeBase = () => (vueAssistants ? TOUTES_LES_ENTREES.filter((e) => e.kind === 'assistant') : ENTREES_LISTEES)
  .filter((e) => compatiblePlateforme(e));
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
  const liste = listeBase();
  const comptesTaches = compteParCategorie(liste);
  nav.innerHTML = categories.filter((c) => c === CAT_TOUT || (comptesTaches.get(c) ?? 0) > 0).map((category) => {
    const meta    = category === CAT_TOUT ? null : categorieParNom(category);
    const icone   = category === CAT_TOUT ? '\u2261' : (meta?.icon ?? '\u25CB');
    // Mêmes décomptes que les cartes de l'accueil : en vue « tâches », ce sont des entrées
    // (procédures, scénarios, commandes, assistants non couverts) ; en vue « assistants », des assistants.
    const count = category === CAT_TOUT ? liste.length : (comptesTaches.get(category) ?? 0);
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
  const liste = listeBase();
  const comptes = compteParCategorie(liste);
  const total = liste.length;

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
        .filter((c) => (comptes.get(c.name) ?? 0) > 0)
        .map((c) => carte(c.name, c.icon, c.description, comptes.get(c.name) ?? 0, selectedCategory === c.name, c.sous))
        .join('');

  // Légende des nombres : dit ce qui est compté, sans compter deux fois une tâche à plusieurs méthodes.
  let legende = document.querySelector('#catalogueLegende');
  if (!legende) { legende = document.createElement('p'); legende.id = 'catalogueLegende'; legende.className = 'catalogue-legende'; grille.insertAdjacentElement('afterend', legende); }
  const cv = couverture();
  legende.textContent = platFiltre
    ? `${total} ${vueAssistants ? "assistants" : "entrées"} compatibles avec ${platFiltre}. Une tâche peut proposer plusieurs méthodes ; la méthode compatible est ouverte en premier.`
    : vueAssistants
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

function lireObjet(cle) {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return {};
    const val = JSON.parse(brut);
    return val && typeof val === 'object' && !Array.isArray(val) ? val : {};
  } catch {
    return {};
  }
}

function stockageDisponible() {
  try { localStorage.setItem('kjemo.test.v1', '1'); localStorage.removeItem('kjemo.test.v1'); return true; } catch { return false; }
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
  const r = lireRouteTache(location.hash);
  if (!r) return null;
  const e = entreeParId(r.id);
  return e && e.procedure ? e : null;
}

/** Étape et parcours d'origine demandés par l'URL d'une fiche (#/tache/<id>/etape/<n>/depuis/<cours>/<lettre>). */
function contexteDepuisHash() {
  const r = lireRouteTache(location.hash);
  const cours = r?.coursId ? COURS_PAR_ID.get(r.coursId) : null;
  const parcoursOk = cours && cours.parcours.some((x) => x.lettre === r.lettre);
  return { etape: r?.etape ?? null, methode: r?.methode ?? null, depuis: parcoursOk ? { coursId: r.coursId, lettre: r.lettre } : null };
}

function ecrireHash(cible) {
  if (location.hash !== cible) {
    history.pushState(null, '', cible);
  }
}

/** Ouvre une fiche : met à jour l'état, l'URL et l'historique local. */
function noterFond(espaceAvant) {
  if (currentTool || currentTache) { if (fond) pasModale += 1; return; }   // déjà dans une fenêtre : le fond reste
  fond = { espace: espaceAvant ?? null, hash: hashPage };
  pasModale = 0;
}

function ouvrirOutil(tool, { pousserHash = true, espaceAvant = espace } = {}) {
  noterFond(espaceAvant);
  currentTool = tool;
  currentTache = null;
  espace = null;
  noterConsultation(tool.id);
  if (pousserHash) ecrireHash(`#/outil/${tool.id}`);
  render();
}

/** Ouvre une fiche tâche. Les valeurs saisies repartent de zéro. */
function ouvrirTache(entree, { pousserHash = true, etape = null, depuis = null, methode = null, espaceAvant = espace } = {}) {
  noterFond(espaceAvant);
  currentTool = null;
  espace = null;
  currentTache = entree;
  contexteParcours = depuis;
  const langages = METHODES_PLATEFORME[platFiltre] ?? [];
  // Un lien de parcours peut imposer la méthode (#/tache/<id>/methode/<m>/etape/<n>) : les étapes sont numérotées PAR méthode.
  const imposee = methode ? entree.procedure.methodes.find((m) => m.id === methode) : null;
  const choisie = imposee ?? entree.procedure.methodes.find((m) => langages.includes(m.id)) ?? entree.procedure.methodes[0];
  methodeTache = choisie.id;
  etapeCible = etape && etape <= (choisie.etapes?.length ?? 0) ? etape : null;
  saisiesTache = {};
  vueLocale = etapeCible ? 'pas' : null;   // un lien d'étape ne montre jamais la vue rapide, qui n'a pas d'étapes numérotées
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
  espace = null;
  if (pousserHash) ecrireHash(routePortee(portee()));
  render();
}

/** Applique l'URL courante à l'état de l'application. */
function espaceDepuisHash() {
  if (location.hash === ROUTE_LABO) return { type: 'labo' };
  const rj = lireRouteJournal(location.hash);
  if (rj) return { type: 'journal', id: rj.id };
  const ri = lireRouteInventaire(location.hash);
  if (ri) return { type: 'inventaire', id: ri.id };
  const pm = lireRouteMemo(location.hash);
  if (pm) return pm.type === 'catalogue' ? { type: 'catalogue' } : { type: 'memo', groupeId: pm.groupeId };
  const c = lireRouteCours(location.hash);
  if (!c) return null;
  return { type: 'cours', coursId: c.coursId, lettre: c.lettre };
}

function appliquerHash() {
  const nouvelEspace = espaceDepuisHash();
  if (nouvelEspace) {
    espace = nouvelEspace; currentTool = null; currentTache = null;
    render();
    return;
  }
  const etaitEspace = espace !== null;
  const espaceAvant = espace;
  espace = null;
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
    const ctx = contexteDepuisHash();
    const memeLien = currentTache?.id === tache.id && etapeCible === null && (ctx.methode === null || ctx.methode === methodeTache) && (ctx.etape === null || ctx.etape === etapeAffichee);
    if (!memeLien || etaitEspace) ouvrirTache(tache, { pousserHash: false, espaceAvant, ...ctx });
  } else if (tool) {
    if (currentTool?.id !== tool.id || etaitEspace) ouvrirOutil(tool, { pousserHash: false, espaceAvant });
  } else if (currentTool || currentTache) {
    revenirAccueil({ pousserHash: false });
  } else if (etaitEspace) {
    render();
  }
}

/**
 * Raccourcis affichés en haut de l'accueil : favoris puis derniers consultés.
 * Masqués pendant une recherche, qui a ses propres résultats.
 */
function raccourcisMarkup() {
  if (currentQuery()) return '';
  const parId = (id) => entreeParId(id);
  const favoris = lireFavoris().map(parId).filter(Boolean).filter((e) => compatiblePlateforme(e));
  const recents = lireHistorique().map(parId).filter(Boolean).filter((e) => compatiblePlateforme(e))
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
      .filter((r) => compatiblePlateforme(r.entree, plat) && (!garde || garde(r.entree)));
  }
  const kinds = NATURES.find((n) => n.id === nature)?.kinds ?? null;
  const opts = { categorie, plateforme: plat, kinds, garde };
  if (mode === 'accueil') {
    // « Tâches courantes » : les tâches phares. Les fiches issues d'un cours ou de l'aide-mémoire Windows restent trouvables
    // par la recherche, par les rubriques du catalogue et par « Mes cours et TP ».
    return chercher('', { ...opts, kinds: ['procedure'] }).filter((r) => !['cours', 'memo'].includes(r.entree.procedure?.origine)).map((r) => ({ ...r, motif: null }));
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
  majNavEspaces();
  renderNavigation();
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
  // Accueil « trois portes » : seulement sans recherche, sans rubrique et sans filtre de contenu.
  const accueilPortes = mode === 'accueil';
  document.querySelector('#home')?.classList.toggle('is-portes', accueilPortes);
  const zoneNat = document.querySelector('#natureFilters');
  if (zoneNat) zoneNat.hidden = accueilPortes;
  const zonePortes = document.querySelector('#espacesZone');
  if (zonePortes) zonePortes.innerHTML = accueilPortes ? portesAccueilHtml() : '';
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
      ? retoursMarkup({ libelle: 'Retour au catalogue professionnel', route: ROUTE_CATALOGUE }) + rubriqueMarkup({ liste: listeBase(), assistants: vueAssistants, domaineId: p.domaineId, domaineNom: p.domaineNom,
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
      pied.innerHTML = `<button type="button" class="secondary-button" id="voirCatalogue">Parcourir tout le catalogue (${listeBase().length} entrées${platFiltre ? ` compatibles ${platFiltre}` : ""})</button>`
        + `<button type="button" class="secondary-button" id="voirAssistants">Les ${TOUTES_LES_ENTREES.filter((e) => e.kind === "assistant" && compatiblePlateforme(e)).length} assistants complets${platFiltre ? ` compatibles ${platFiltre}` : ""}</button>`;
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
  const ligne = ({ entree, motif }) => ligneResultatMarkup(entree, { favori: favoris.has(entree.id), motif: query ? motif : null, plateforme: platFiltre });
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
  bouton?.addEventListener('click', () => { if (!fermerModale()) revenirAccueil(); });
}

function renderTool() {
  const tool = currentTool;
  const view = document.querySelector('#toolView');
  const riskLabels = { diagnostic: 'DIAGNOSTIC — aucune modification', safe: 'RÉVERSIBLE — vérifier avant exécution', caution: 'ATTENTION — modifie la configuration', destructive: 'DESTRUCTIF — confirmation indispensable' };
  view.innerHTML = `<div class="tool-header"><button class="back-button" id="backButton">← Tous les outils</button><div><div class="tag">${textToCode((tool.subcategory ? tool.category.toUpperCase() + ' \u00B7 ' + tool.subcategory : tool.category.toUpperCase()) + ' \u00B7 ASSISTANT COMPLET')}</div><h1>${tool.icon} ${tool.title}</h1>${enteteAssistantMeta(entreeParId(tool.id), { favori: estFavori(tool.id) })}<span class="risk ${tool.risk}">${riskLabels[tool.risk]}</span></div></div>${ficheRapideMarkup(tool)}${resumeScriptMarkup(resumeScript(tool))}${ficheNavMarkup(tool)}${modeBlockMarkup(tool)}<div id="tabContent"></div>`;
  enteteNavigationFiche(view, entreeParId(tool.id), tool.title, 'backButton');
  barreModale(view);
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
    prerequisTitres: Object.fromEntries((p.prerequis ?? []).filter((r) => r.fiche).map((r) => [r.fiche, entreeParId(r.fiche)?.titre ?? r.fiche])),
  });
  document.title = `${p.titre} — KJEMO IT Toolkit`;

  enteteNavigationFiche(view, entree, p.titre, 'taskBack');
  const coursOrigine = contexteParcours ? COURS_PAR_ID.get(contexteParcours.coursId) : null;
  if (coursOrigine) view.insertAdjacentHTML('afterbegin', retourParcoursMarkup(coursOrigine.titre, contexteParcours.lettre, coursOrigine.id));
  else { const gm = groupeDeFiche(entree.id); if (gm) view.insertAdjacentHTML('afterbegin', retourMemoFicheMarkup(gm)); }
  barreModale(view);

  const fav = view.querySelector('#taskFav');
  fav.insertAdjacentHTML('afterend', ' <button type="button" class="secondary-button j-documenter" id="taskJournal" title="Crée un labo dans le Journal avec le titre, l’adressage et les commandes de cette fiche">Documenter dans le journal</button>');
  view.querySelector('#taskJournal').addEventListener('click', () => documenterFiche(entree));
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
  const depuisLabo = saisiesDepuisLabo(p, lireObjet(CLE_LABO));
  if (exemples && Object.keys(depuisLabo).length) {
    exemples.insertAdjacentHTML('afterend', ' <button type="button" class="secondary-button" id="laboBtn">Utiliser mon laboratoire</button>');
    view.querySelector('#laboBtn').addEventListener('click', () => {
      Object.assign(saisiesTache, depuisLabo);
      renderTache();
      document.querySelector('#laboBtn')?.focus();
    });
  }
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
  montrerEtapeCible(view);

  // Copie : le texte est CALCULÉ (procedures.mjs), jamais lu dans le DOM — les
  // invites, les numéros, les libellés d'équipement et les repères restent donc
  // hors du presse-papiers. Un secret n'existe pas ici : il se tape sur l'équipement.
  view.querySelector('.tache').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.copy-step, .copy-seg, .copy-phase, .copy-eq, .copy-machine, #copyAll');
    if (btn) return copier(btn, view);
    const dl = ev.target.closest('#dlDossier');
    if (dl) return telechargerDossier(dl, view);
  });
}

/** Montre l'étape demandée par un lien de parcours : défilement, repère visible, focus sans saut. */
function montrerEtapeCible(view) {
  if (!etapeCible) return;
  const n = etapeCible;
  etapeCible = null;
  const li = view.querySelector(`#etape-${n}`);
  if (!li) return;
  etapeAffichee = n;
  li.classList.add('etape-cible');
  li.setAttribute('tabindex', '-1');
  li.scrollIntoView?.({ block: 'start' });
  li.focus?.({ preventScroll: true });
}

/** Résout le texte, la méthode (normalisation) et l'indice d'un bouton de copie. */
function cibleDeCopie(btn, rendu, methode) {
  const methodeDe = (id) => (methode.equipements ?? []).find((q) => q.id === id)?.methode ?? methode.id;
  if (btn.matches('#copyAll')) return { texte: rendu.texteComplet, raison: rendu.raisonComplet, methodeId: methode.id, manquants: rendu.manquants };
  if (btn.matches('.copy-eq')) {
    const q = rendu.parEquipement.find((x) => x.id === btn.dataset.eq);
    return { texte: q.texte, raison: q.raison, methodeId: q.methode, manquants: rendu.manquants };
  }
  if (btn.matches('.copy-machine')) {
    const q = rendu.parMachine.find((x) => x.id === btn.dataset.machine);
    return { texte: q.texte, raison: q.raison, methodeId: methode.id, manquants: rendu.manquants };
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
    if (indice) indice.textContent = btn.matches('#copyAll') ? 'Toutes les commandes sont copiées.' : btn.matches('.copy-eq') ? 'Séquence de cet équipement copiée.' : btn.matches('.copy-machine') ? 'Séquence de ce poste copiée.' : btn.matches('.copy-phase') ? 'Bloc copié.' : btn.matches('.copy-seg') ? 'Segment copié.' : 'Commande copiée.';
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

// ---------------------------------------------------------------------------
// Journal de labo (JOURNAL-LABO-01)
// Les labos vivent dans le stockage du navigateur ; les captures (JPEG) dans
// IndexedDB, car elles sont trop lourdes pour localStorage. Aucun envoi : le PDF
// et la sauvegarde sont fabriqués ici et téléchargés. Sans stockage, l'écran
// fonctionne et dit que rien n'est conservé.
// ---------------------------------------------------------------------------
const imagesMemoire = new Map();   // id → Uint8Array (copie de travail, et seule copie si IndexedDB est refusé)
let imagesOk = typeof indexedDB !== 'undefined';
let baseImages = null;
function ouvrirBaseImages() {
  if (!imagesOk) return Promise.resolve(null);
  if (!baseImages) {
    baseImages = new Promise((ok) => {
      try {
        const req = indexedDB.open('kjemo-journal', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('captures');
        req.onsuccess = () => ok(req.result);
        req.onerror = () => { imagesOk = false; ok(null); };
        req.onblocked = () => { imagesOk = false; ok(null); };
      } catch { imagesOk = false; ok(null); }
    });
  }
  return baseImages;
}
async function operationImages(mode, action) {
  const db = await ouvrirBaseImages();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const tx = db.transaction('captures', mode); const st = tx.objectStore('captures');
      const req = action(st);
      tx.oncomplete = () => ok(req ? req.result : true);
      tx.onerror = () => ok(null); tx.onabort = () => ok(null);
    } catch { ok(null); }
  });
}
async function lireImage(id) {
  if (imagesMemoire.has(id)) return imagesMemoire.get(id);
  const v = await operationImages('readonly', (st) => st.get(id));
  if (v) { const u = v instanceof Uint8Array ? v : new Uint8Array(v); imagesMemoire.set(id, u); return u; }
  return null;
}
async function ecrireImage(id, octets) {
  imagesMemoire.set(id, octets);
  const r = await operationImages('readwrite', (st) => st.put(octets, id));
  if (r === null) imagesOk = false;
}
async function nettoyerImages(gardees) {
  const cles = await operationImages('readonly', (st) => st.getAllKeys());
  if (!Array.isArray(cles)) return;
  const inutiles = cles.filter((k) => !gardees.has(k));
  if (inutiles.length) await operationImages('readwrite', (st) => { inutiles.forEach((k) => st.delete(k)); return null; });
}

let journalMemoire = null;
let inventaireMemoire = null;
function lireEquipements() {
  if (!inventaireMemoire) inventaireMemoire = lireInventaire(lireObjet(CLE_INVENTAIRE)).equipements;
  return inventaireMemoire;
}
function ecrireEquipements(liste) {
  inventaireMemoire = liste;
  return ecrireStockage(CLE_INVENTAIRE, { equipements: liste });
}
/** Les équipements d'un labo, résolus dans l'inventaire (un lien vers un équipement supprimé est ignoré). */
function equipementsDuLabo(e) {
  const inv = lireEquipements();
  return (e.equipements ?? []).map((l) => ({ equipement: inv.find((q) => q.id === l.id), role: l.role })).filter((x) => x.equipement);
}
/** L'auteur du dernier labo modifié : on ne retape pas son nom à chaque document. */
function auteurParDefaut() {
  return [...lireEntreesJournal()].sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe))).find((e) => e.auteur)?.auteur ?? '';
}
function lireEntreesJournal() {
  if (!journalMemoire) journalMemoire = lireJournal(lireObjet(CLE_JOURNAL)).entrees;
  return journalMemoire;
}
function ecrireEntreesJournal(entrees) {
  journalMemoire = entrees;
  return ecrireStockage(CLE_JOURNAL, { entrees });
}

let etatJournal = { categorieId: null, filtre: 'tous', requete: '', note: '', nouvelleCategorie: 'cisco',
  brouillonId: null, brouillon: null, erreurs: {}, noteFiche: '', modifie: false, versionOuverte: false, confirmerSuppression: false };
const urlsImages = new Map();      // id → URL d'objet pour l'aperçu (libérées quand l'image disparaît)
function urlImage(id) {
  if (urlsImages.has(id)) return urlsImages.get(id);
  const o = imagesMemoire.get(id);
  if (!o) return null;
  const u = URL.createObjectURL(new Blob([o], { type: 'image/jpeg' }));
  urlsImages.set(id, u);
  return u;
}

function titresDesFiches(ids) {
  return Object.fromEntries(ids.map((f) => [f, entreeParId(f)?.procedure?.titre ?? entreeParId(f)?.titre ?? f]));
}

/**
 * Donne un fichier fabriqué ici (PDF, sauvegarde) à la personne.
 * Dans l'aperçu claude.ai, la page est isolée : un lien de téléchargement n'y
 * fait rien, on passe donc par la fonction d'enregistrement de l'aperçu, qui
 * demande confirmation. Partout ailleurs (GitHub Pages, serveur local), c'est
 * un téléchargement ordinaire. Renvoie { ok, message }.
 */
async function enregistrerFichier(nom, contenu, type) {
  const blob = new Blob([contenu], { type });
  if (typeof window.claude?.use === 'function') {
    let dl = null;
    try { dl = await window.claude.use('downloads'); } catch { dl = null; }
    if (dl) {
      try {
        await dl.save({ filename: nom, data: blob });
        return { ok: true, message: `enregistré : ${nom}` };
      } catch (err) {
        const code = err?.code ?? 'unavailable';
        if (code === 'declined') return { ok: false, message: 'Enregistrement annulé : rien n’a été enregistré.' };
        if (code === 'rate_limited') return { ok: false, message: 'Une demande d’enregistrement est déjà ouverte : réponds-y, puis réessaie.' };
        return { ok: false, message: 'Cet aperçu ne permet pas d’enregistrer de fichier. Ouvre le Toolkit depuis son adresse habituelle (GitHub Pages ou ton ordinateur).' };
      }
    }
  }
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.appendChild(lien); lien.click(); lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
  return { ok: true, message: `téléchargé : ${nom}` };
}

function renderJournal() {
  if (espace.id) renderJournalFiche(); else renderJournalListe();
}

function renderJournalListe() {
  const view = document.querySelector('#journalView');
  const toutes = lireEntreesJournal();
  const ej = etatJournal;
  const entrees = filtrerJournal(toutes, { categorieId: ej.categorieId, filtre: ej.filtre, requete: ej.requete });
  const compte = (cat) => filtrerJournal(toutes, { categorieId: cat, filtre: ej.filtre, requete: ej.requete }).length;
  view.innerHTML = journalListeMarkup({ entrees, total: toutes.length, compte, categorieId: ej.categorieId, filtre: ej.filtre, requete: ej.requete,
    note: ej.note, stockageOk: stockageDisponible(), imagesOk, nouvelleCategorie: ej.nouvelleCategorie, nbEquipements: lireEquipements().length });
  document.title = 'Journal de labo — KJEMO IT Toolkit';
  view.querySelectorAll('[data-jcat]').forEach((b) => b.addEventListener('click', () => {
    etatJournal.categorieId = b.dataset.jcat || null; etatJournal.note = '';
    renderJournalListe(); document.querySelector(`[data-jcat="${b.dataset.jcat}"]`)?.focus();
  }));
  view.querySelector('#jFiltre').addEventListener('change', (ev) => { etatJournal.filtre = ev.target.value; renderJournalListe(); document.querySelector('#jFiltre')?.focus(); });
  view.querySelector('#jRecherche').addEventListener('input', (ev) => {
    etatJournal.requete = ev.target.value;
    const pos = ev.target.selectionStart;
    renderJournalListe();
    const champ = document.querySelector('#jRecherche'); champ?.focus(); champ?.setSelectionRange?.(pos, pos);
  });
  view.querySelector('#jNouvelleCat').addEventListener('change', (ev) => { etatJournal.nouvelleCategorie = ev.target.value; });
  view.querySelector('#jExemple').addEventListener('click', () => {
    const e = entreeExemple(etatJournal.nouvelleCategorie, { existantes: lireEntreesJournal().map((x) => x.reference), auteur: auteurParDefaut() });
    ouvrirBrouillon(e, { nouveau: true, note: 'Exemple rempli : lis-le, exporte le PDF pour voir le résultat, puis adapte-le ou supprime-le. Il n’est enregistré que si tu cliques sur « Enregistrer ».' });
  });
  view.querySelector('#jNouveauForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const e = entreeVide({ categorieId: etatJournal.nouvelleCategorie, auteur: auteurParDefaut(), existantes: lireEntreesJournal().map((x) => x.reference) });
    ouvrirBrouillon({ ...e, titre: '' }, { nouveau: true });
  });
  view.querySelector('#jSauver').addEventListener('click', async () => {
    const entrees2 = lireEntreesJournal();
    const captures = {};
    for (const e of entrees2) for (const c of e.captures) {
      const o = await lireImage(c.id);
      if (o) { let bin = ''; for (let i = 0; i < o.length; i += 0x8000) bin += String.fromCharCode(...o.subarray(i, i + 0x8000)); captures[c.id] = btoa(bin); }
    }
    const res = await enregistrerFichier(`journal-de-labo_${jour()}.json`, `${sauvegardeJournal(entrees2, captures, new Date(), lireEquipements(), lireTypesPerso())}\n`, 'application/json;charset=utf-8');
    etatJournal.note = res.ok ? `Sauvegarde ${res.message} (${entrees2.length} labo(s), ${Object.keys(captures).length} capture(s), ${lireEquipements().length} équipement(s)).` : res.message;
    renderJournalListe(); document.querySelector('#jSauver')?.focus();
  });
  view.querySelector('#jRestaurer').addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    const r = lireSauvegarde(await f.text(), lireEntreesJournal());
    if (r.erreur) { etatJournal.note = r.erreur; renderJournalListe(); return; }
    for (const [id, b64] of Object.entries(r.captures)) {
      const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      await ecrireImage(id, u);
    }
    const ids = new Set(r.entrees.map((e) => e.id));
    const fusion = [...lireEntreesJournal().filter((e) => !ids.has(e.id)), ...r.entrees];
    const ok = ecrireEntreesJournal(fusion);
    const eqs = lireInventaire({ equipements: r.equipements }).equipements;
    if (eqs.length) { const idsEq = new Set(eqs.map((q) => q.id)); ecrireEquipements([...lireEquipements().filter((q) => !idsEq.has(q.id)), ...eqs]); }
    const tps = normaliserTypesPerso(r.typesPerso);
    if (tps.length) { const idsT = new Set(tps.map((x) => x.id)); ecrireTypesPerso(normaliserTypesPerso([...lireTypesPerso().filter((x) => !idsT.has(x.id)), ...tps])); }
    etatJournal.note = `${r.entrees.length} labo(s)${eqs.length ? ` et ${eqs.length} équipement(s)` : ''} restauré(s)${r.doublons.length ? ` (${r.doublons.length} remplacé(s) : ${r.doublons.join(', ')})` : ''}${r.ecartees ? `, ${r.ecartees} écarté(s) car invalides` : ''}.${ok ? '' : ' Attention : le stockage est indisponible, rien ne sera conservé.'}`;
    renderJournalListe(); document.querySelector('#jNote')?.focus?.();
  });
  // Ménage : les images qu'aucun labo n'utilise plus.
  nettoyerImages(new Set(lireEntreesJournal().flatMap((e) => e.captures.map((c) => c.id)))).catch(() => {});
}

/** Ouvre un brouillon (nouveau ou existant) dans la fiche d'un labo. */
function ouvrirBrouillon(entree, { nouveau = false, note = '' } = {}) {
  etatSchema = { selection: null, relierDepuis: null, typeOuvert: false, viderConfirme: false, cablage: null };
  etatJournal = { ...etatJournal, brouillonId: entree.id, brouillon: structuredClone(entree), erreurs: {}, noteFiche: note,
    modifie: nouveau, versionOuverte: false, confirmerSuppression: false, nouveau };
  const cible = routeEntreeJournal(entree.id);
  if (location.hash !== cible) location.hash = cible; else render();
}

async function renderJournalFiche() {
  const view = document.querySelector('#journalView');
  const ej = etatJournal;
  if (ej.brouillonId !== espace.id || !ej.brouillon) {
    const e = lireEntreesJournal().find((x) => x.id === espace.id);
    if (!e) {
      view.innerHTML = `<h1>Labo introuvable</h1><p>Ce labo n’existe pas (ou plus) dans ce navigateur. Il a peut-être été créé dans un autre navigateur : restaure ta sauvegarde depuis la liste.</p><p><a href="${ROUTE_JOURNAL}">Retour au Journal de labo</a></p>`;
      document.title = 'Labo introuvable — KJEMO IT Toolkit';
      return;
    }
    etatJournal = { ...ej, brouillonId: e.id, brouillon: structuredClone(e), erreurs: {}, noteFiche: '', modifie: false, versionOuverte: false, confirmerSuppression: false, nouveau: false };
    etatSchema = { selection: null, relierDepuis: null, typeOuvert: false, viderConfirme: false, cablage: null };
  }
  // Charge les images avant le dessin (sinon l'aperçu clignote).
  for (const c of etatJournal.brouillon.captures) await lireImage(c.id);
  dessinerJournalFiche(view);
}

function dessinerJournalFiche(view = document.querySelector('#journalView')) {
  const ej = etatJournal; const e = ej.brouillon;
  const imagesUrl = Object.fromEntries(e.captures.map((c) => [c.id, urlImage(c.id)]).filter(([, u]) => u));
  const defil = window.scrollY;
  view.innerHTML = journalEditeurMarkup({ entree: e, erreurs: ej.erreurs, note: ej.noteFiche, modifie: ej.modifie, versionOuverte: ej.versionOuverte,
    confirmerSuppression: ej.confirmerSuppression, imagesUrl, titresFiches: titresDesFiches(e.fiches), routeFiche: (id) => `#/tache/${id}`, imagesOk,
    equipementsHtml: equipementsLaboMarkup({ liens: e.equipements, inventaire: lireEquipements(), erreurs: ej.erreurs, systemePrefere: e.categorie }),
    schemaHtml: editeurSchemaMarkup(e.schema, { resoudre: resoudreEquipement, typesPerso: lireTypesPerso(), inventaire: lireEquipements(), etat: etatSchema, erreurs: ej.erreurs, categorie: e.categorie }) });
  window.scrollTo(0, defil);
  document.title = `${e.titre || 'Nouveau labo'} — Journal de labo — KJEMO IT Toolkit`;
  brancherJournalFiche(view);
}

/** Relit le formulaire dans le brouillon (sans valider). */
function lireFormulaireJournal(view) {
  const e = etatJournal.brouillon;
  view.querySelectorAll('[data-j]').forEach((i) => { e[i.dataset.j] = i.value; });
  view.querySelectorAll('[data-jt]').forEach((i) => {
    const t = e[i.dataset.jt]; const r = Number(i.dataset.row);
    if (t?.[r]) t[r][i.dataset.col] = i.value;
  });
  view.querySelectorAll('[data-jcap]').forEach((i) => { const c = e.captures[Number(i.dataset.jcap)]; if (c) c.legende = i.value; });
  // Équipements : les cases cochées, dans l'ordre déjà connu, puis les nouvelles.
  const coches = [...view.querySelectorAll('[data-jeq]')].filter((c) => c.checked).map((c) => c.dataset.jeq);
  if (view.querySelector('[data-jeq]')) {
    const roles = Object.fromEntries([...view.querySelectorAll('[data-jeqrole]')].map((i) => [i.dataset.jeqrole, i.value]));
    const avant = e.equipements.filter((l) => coches.includes(l.id)).map((l) => l.id);
    e.equipements = [...avant, ...coches.filter((id) => !avant.includes(id))].map((id) => ({ id, role: roles[id] ?? e.equipements.find((l) => l.id === id)?.role ?? '' }));
  }
}

/** Valide et enregistre le brouillon. Renvoie l'entrée enregistrée, ou null (erreurs affichées). */
function enregistrerJournal(view, { note = 'Enregistré dans ce navigateur.' } = {}) {
  lireFormulaireJournal(view);
  const { entree, erreurs } = normaliserEntree({ ...etatJournal.brouillon, modifieLe: jour() });
  if (Object.keys(erreurs).length) {
    etatJournal = { ...etatJournal, erreurs, noteFiche: '' };
    dessinerJournalFiche(view);
    const premier = Object.keys(erreurs)[0];
    document.querySelector(`[aria-describedby="jerr-${premier.replace(/\./g, '-')}"]`)?.focus();
    return null;
  }
  const autres = lireEntreesJournal().filter((x) => x.id !== entree.id);
  // Deux labos ne partagent jamais une référence (sauvegarde fusionnée, duplication…).
  if (autres.some((x) => x.reference === entree.reference)) entree.reference = prochaineReference(entree.categorie, entree.creeLe.slice(0, 4), autres.map((x) => x.reference));
  const ok = ecrireEntreesJournal([...autres, entree]);
  etatJournal = { ...etatJournal, brouillon: structuredClone(entree), erreurs: {}, modifie: false, nouveau: false,
    noteFiche: ok ? note : 'Le stockage de ce navigateur est indisponible : ce labo ne sera pas conservé après fermeture.' };
  return entree;
}

async function ajouterCapture(view, fichier) {
  const e = etatJournal.brouillon;
  if (e.captures.length >= MAX_CAPTURES) { etatJournal.noteFiche = `Six captures au maximum par labo : retires-en une avant d’en ajouter.`; dessinerJournalFiche(view); return; }
  if (!/^image\/(png|jpeg)$/.test(fichier.type)) { etatJournal.noteFiche = 'Seules les images PNG et JPEG sont acceptées.'; dessinerJournalFiche(view); return; }
  try {
    lireFormulaireJournal(view);
    const octets = await versJpeg(fichier);
    const id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    await ecrireImage(id, octets);
    e.captures.push({ id, nom: (fichier.name || `capture-${e.captures.length + 1}.png`).slice(0, 120), legende: '' });
    etatJournal.modifie = true;
    etatJournal.noteFiche = `Capture ajoutée (${Math.round(octets.length / 1024)} Ko). Écris sa légende, puis enregistre.`;
    dessinerJournalFiche(view);
    document.querySelector(`#jc-${e.captures.length - 1}`)?.focus();
  } catch {
    etatJournal.noteFiche = 'Cette image n’a pas pu être lue.'; dessinerJournalFiche(view);
  }
}

/** Image → JPEG (fond blanc, 1600 px au plus) : un format que le PDF sait intégrer, et un poids raisonnable. */
async function versJpeg(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)); const h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
    return new Uint8Array(await blob.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}

function brancherJournalFiche(view) {
  brancherSchema(view);
  const ej = () => etatJournal;
  const marquer = () => { if (!etatJournal.modifie) { etatJournal.modifie = true; const n = view.querySelector('#jNote'); if (n && !n.textContent) n.textContent = 'Modifications non enregistrées.'; } };
  view.querySelector('#jForm').addEventListener('input', marquer);
  view.querySelector('#jForm').addEventListener('change', (ev) => {
    marquer();
    if (ev.target.matches('[data-j="etat"],[data-j="categorie"]')) { lireFormulaireJournal(view); dessinerJournalFiche(view); document.querySelector(`#${ev.target.id}`)?.focus(); }
  });
  view.querySelector('#jForm').addEventListener('submit', (ev) => ev.preventDefault());
  view.querySelector('#jForm').addEventListener('click', (ev) => {
    const ajout = ev.target.closest('[data-jadd]'); const retrait = ev.target.closest('[data-jdel]'); const capdel = ev.target.closest('[data-jcapdel]');
    if (!ajout && !retrait && !capdel) return;
    lireFormulaireJournal(view);
    const e = ej().brouillon;
    if (ajout) {
      const nom = ajout.dataset.jadd;
      e[nom].push(Object.fromEntries(TABLEAUX[nom].map((c) => [c.id, c.id === 'resultat' ? 'a-tester' : ''])));
      etatJournal.modifie = true; dessinerJournalFiche(view);
      document.querySelector(`[data-jt="${nom}"][data-row="${e[nom].length - 1}"]`)?.focus();
    } else if (retrait) {
      e[retrait.dataset.jdel].splice(Number(retrait.dataset.row), 1);
      etatJournal.erreurs = {}; etatJournal.modifie = true; dessinerJournalFiche(view);
      document.querySelector(`[data-jadd="${retrait.dataset.jdel}"]`)?.focus();
    } else {
      e.captures.splice(Number(capdel.dataset.jcapdel), 1);
      etatJournal.erreurs = {}; etatJournal.modifie = true; dessinerJournalFiche(view);
      document.querySelector('#jCaptureFichier')?.focus();
    }
  });
  view.querySelectorAll('[data-jeq]').forEach((c) => c.addEventListener('change', () => {
    lireFormulaireJournal(view); etatJournal.modifie = true; dessinerJournalFiche(view);
    const suite = c.checked ? `#jeq-role-${c.dataset.jeq}` : '#jEqAjout';
    (document.querySelector(suite) ?? document.querySelector('#jEqNouveau'))?.focus();
  }));
  view.querySelector('#jEqAjouter')?.addEventListener('click', () => {
    const sel = view.querySelector('#jEqAjout'); const id = sel?.value;
    if (!id) { sel?.focus(); return; }
    lireFormulaireJournal(view);
    if (!etatJournal.brouillon.equipements.some((l) => l.id === id)) etatJournal.brouillon.equipements.push({ id, role: '' });
    etatJournal.modifie = true; dessinerJournalFiche(view);
    document.querySelector(`#jeq-role-${id}`)?.focus();
  });
  // Quitter vers l'inventaire : le labo est enregistré d'abord (sinon on reste, erreurs affichées).
  const partir = (cible) => { if (etatJournal.modifie && !enregistrerJournal(view)) return; location.hash = cible; };
  view.querySelector('#jEqNouveau')?.addEventListener('click', () => {
    if (etatJournal.modifie && !enregistrerJournal(view)) return;
    if (etatJournal.nouveau && !enregistrerJournal(view)) return;
    const lab = etatJournal.brouillon;
    const sys = { cisco: 'cisco', systeme: 'systeme', azure: 'azure' }[lab.categorie] ?? 'autre';
    ouvrirEquipement(equipementVide({ systemeId: sys }), { nouveau: true, retour: { id: lab.id, reference: lab.reference } });
  });
  view.querySelectorAll('[data-jeqouvrir], #jEqInventaire').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (a.dataset.jeqouvrir) etatInventaire.retour = { id: etatJournal.brouillon.id, reference: etatJournal.brouillon.reference };
    partir(a.getAttribute('href'));
  }));
  view.querySelector('#jCaptureFichier')?.addEventListener('change', (ev) => { const f = ev.target.files?.[0]; if (f) ajouterCapture(view, f); });
  view.querySelector('#jEnregistrer').addEventListener('click', () => {
    if (enregistrerJournal(view)) { dessinerJournalFiche(view); document.querySelector('#jEnregistrer')?.focus(); }
  });
  view.querySelector('#jPdf').addEventListener('click', async () => {
    const e = enregistrerJournal(view, { note: '' });
    if (!e) return;
    const captures = {};
    for (const c of e.captures) { const o = await lireImage(c.id); if (o) captures[c.id] = o; }
    let r = null;
    try { r = pdfJournal(e, { captures, titresFiches: titresDesFiches(e.fiches), equipements: equipementsDuLabo(e), inventaire: lireEquipements(), typesPerso: lireTypesPerso() }); } catch { r = null; }
    if (r) {
      const res = await enregistrerFichier(nomFichierPdf(e), r.octets, 'application/pdf');
      etatJournal.noteFiche = res.ok ? `PDF ${res.message} (${r.pages} pages). Range-le avec tes documents.` : res.message;
    } else {
      etatJournal.noteFiche = 'Le PDF n’a pas pu être fabriqué. Enregistre, recharge la page et réessaie.';
    }
    dessinerJournalFiche(view); document.querySelector('#jPdf')?.focus();
  });
  view.querySelector('#jVersion').addEventListener('click', () => {
    lireFormulaireJournal(view);
    etatJournal.versionOuverte = !etatJournal.versionOuverte; dessinerJournalFiche(view);
    document.querySelector(etatJournal.versionOuverte ? '#jVersionResume' : '#jVersion')?.focus();
  });
  view.querySelector('#jVersionAnnuler')?.addEventListener('click', () => { etatJournal.versionOuverte = false; dessinerJournalFiche(view); document.querySelector('#jVersion')?.focus(); });
  view.querySelector('#jVersionForm')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const resume = view.querySelector('#jVersionResume').value; const majeure = view.querySelector('#jVersionMajeure').checked;
    lireFormulaireJournal(view);
    const v = normaliserEntree(etatJournal.brouillon);
    if (Object.keys(v.erreurs).length) { etatJournal = { ...etatJournal, erreurs: v.erreurs, versionOuverte: false }; dessinerJournalFiche(view); return; }
    const r = publierVersion(v.entree, { resume, majeure });
    if (r.erreur) { etatJournal.noteFiche = r.erreur; dessinerJournalFiche(view); document.querySelector('#jVersionResume')?.focus(); return; }
    etatJournal.brouillon = r.entree; etatJournal.versionOuverte = false;
    enregistrerJournal(view, { note: `Version ${r.entree.version} publiée et enregistrée.` });
    dessinerJournalFiche(view); document.querySelector('#jVersion')?.focus();
  });
  view.querySelector('#jDupliquer').addEventListener('click', () => {
    lireFormulaireJournal(view);
    const v = normaliserEntree(etatJournal.brouillon);
    if (Object.keys(v.erreurs).length) { etatJournal = { ...etatJournal, erreurs: v.erreurs }; dessinerJournalFiche(view); return; }
    const copie = entreeVide({ categorieId: v.entree.categorie, existantes: lireEntreesJournal().map((x) => x.reference) });
    const nouvelle = { ...v.entree, id: copie.id, reference: copie.reference, titre: `${v.entree.titre} (copie)`.slice(0, 120), version: '1.0', etat: 'brouillon',
      creeLe: copie.creeLe, modifieLe: copie.modifieLe, revisions: [{ version: '1.0', date: copie.creeLe, resume: `Copie de ${v.entree.reference}` }],
      captures: v.entree.captures.map((c) => ({ ...c })) };
    // Les images sont partagées par référence : on les copie sous de nouveaux identifiants.
    Promise.all(nouvelle.captures.map(async (c) => { const o = await lireImage(c.id); const id = `${c.id}d${Date.now().toString(36)}`.slice(0, 80); if (o) await ecrireImage(id, o); c.id = id; }))
      .then(() => ouvrirBrouillon(nouvelle, { nouveau: true, note: `Copie de ${v.entree.reference} : enregistre-la pour la garder.` }));
  });
  view.querySelector('#jSupprimer').addEventListener('click', () => { lireFormulaireJournal(view); etatJournal.confirmerSuppression = true; dessinerJournalFiche(view); document.querySelector('#jSupprimerNon')?.focus(); });
  view.querySelector('#jSupprimerNon')?.addEventListener('click', () => { etatJournal.confirmerSuppression = false; dessinerJournalFiche(view); document.querySelector('#jSupprimer')?.focus(); });
  view.querySelector('#jSupprimerOui')?.addEventListener('click', () => {
    const id = etatJournal.brouillonId;
    ecrireEntreesJournal(lireEntreesJournal().filter((x) => x.id !== id));
    etatJournal = { ...etatJournal, brouillonId: null, brouillon: null, note: 'Labo supprimé.' };
    location.hash = ROUTE_JOURNAL;
  });
}

// Ctrl+V d'une capture d'écran sur la fiche d'un labo.
document.addEventListener('paste', (ev) => {
  if (espace?.type !== 'journal' || !espace.id || !etatJournal.brouillon) return;
  const item = [...(ev.clipboardData?.items ?? [])].find((i) => i.kind === 'file' && /^image\/(png|jpeg)$/.test(i.type));
  if (!item) return;
  ev.preventDefault();
  const f = item.getAsFile();
  if (f) ajouterCapture(document.querySelector('#journalView'), f);
});

/** « Documenter dans le journal » depuis une fiche : crée le labo prérempli et l'ouvre. */
function documenterFiche(entree) {
  const p = entree.procedure; const m = methodeActive();
  const rendu = renduCourant();
  const valeurs = valeursPourJournal(evaluerValeurs(p.params ?? [], saisiesTache));
  const { entree: e, erreurs } = entreeDepuisFiche(p, { methode: m, rendu, valeurs, plateformes: plateformesDeProcedure(p), auteur: auteurParDefaut(),
    existantes: lireEntreesJournal().map((x) => x.reference) });
  const manquants = rendu.etapes.filter((x) => x.rendu?.bloque).length;
  const note = Object.keys(erreurs).length ? 'Certaines valeurs ont été refusées : vérifie les champs signalés.'
    : `Labo créé depuis la fiche${manquants ? ` (${manquants} étape(s) sans valeurs non reprises : remplis les champs de la fiche pour les avoir)` : ''}. Complète-le, puis enregistre.`;
  // Équipements proposés par la fiche (TP VLAN : commutateur et routeur) : un équipement du même nom est réutilisé, jamais écrasé.
  const proposes = equipementsDepuisFiche(valeurs);
  let crees = 0;
  if (proposes.length) {
    const inv = [...lireEquipements()];
    for (const { equipement, role } of proposes) {
      let q = inv.find((x) => x.nom.toLowerCase() === equipement.nom.toLowerCase() && x.systeme === equipement.systeme);
      if (!q) { q = equipement; inv.push(q); crees += 1; }
      e.equipements.push({ id: q.id, role });
    }
    if (crees) ecrireEquipements(inv);
    const idDe = (type) => { const nom = proposes.find((x) => x.equipement.type === type)?.equipement.nom; return inv.find((x) => x.nom === nom)?.id ?? null; };
    e.schema = schemaDepuisFiche(valeurs, { commutateur: idDe('commutateur'), routeur: idDe('routeur') });
  }
  ouvrirBrouillon(e, { nouveau: true, note: proposes.length ? `${note} ${crees ? `${crees} équipement(s) ajouté(s) à l’inventaire` : 'Équipements déjà présents dans l’inventaire'} : ${proposes.map((x) => x.equipement.nom).join(', ')}.` : note });
  if (Object.keys(erreurs).length) etatJournal.erreurs = erreurs;
}

// ---------------------------------------------------------------------------
// Schéma d'architecture d'un labo (JOURNAL-LABO-05)
// Le schéma vit dans le brouillon du labo ; il est enregistré avec lui.
// Pendant un glisser, seule la feuille SVG est redessinée ; le panneau des
// propriétés l'est au relâchement.
// ---------------------------------------------------------------------------
const CLE_TYPES_SCHEMA = 'kjemo.schema.types.v1';
let typesPersoMemoire = null;
function lireTypesPerso() {
  if (!typesPersoMemoire) { try { typesPersoMemoire = normaliserTypesPerso(JSON.parse(localStorage.getItem(CLE_TYPES_SCHEMA) ?? '[]')); } catch { typesPersoMemoire = []; } }
  return typesPersoMemoire;
}
function ecrireTypesPerso(liste) { typesPersoMemoire = liste; return ecrireStockage(CLE_TYPES_SCHEMA, liste); }
let etatSchema = { selection: null, relierDepuis: null, typeOuvert: false, viderConfirme: false, cablage: null };
const resoudreEquipement = (id) => lireEquipements().find((q) => q.id === id) ?? null;
const schemaCourant = () => etatJournal.brouillon.schema;

function majFeuilleSchema() {
  const f = document.querySelector('#schFeuille');
  if (f) f.innerHTML = feuilleSvg(schemaCourant(), { resoudre: resoudreEquipement, typesPerso: lireTypesPerso(), selection: etatSchema.selection })
    + (etatSchema.cablage?.enAttente ? menuPortsMarkup(schemaCourant(), etatSchema.cablage.enAttente, { resoudre: resoudreEquipement, typesPerso: lireTypesPerso() }) : '');
  if (f) { if (etatSchema.relierDepuis || etatSchema.cablage) f.dataset.relier = '1'; else delete f.dataset.relier; }
}
function majBlocSchema(focus = null) {
  const bloc = document.querySelector('#schBloc');
  if (!bloc) return;
  bloc.innerHTML = editeurSchemaMarkup(schemaCourant(), { resoudre: resoudreEquipement, typesPerso: lireTypesPerso(), inventaire: lireEquipements(), etat: etatSchema, erreurs: etatJournal.erreurs, categorie: etatJournal.brouillon.categorie });
  const v = document.querySelector('#schVider'); if (v && etatSchema.viderConfirme) v.textContent = 'Confirmer : vider le schéma';
  if (focus) document.querySelector(focus)?.focus({ preventScroll: true });
}
function schemaModifie() {
  if (!etatJournal.modifie) { etatJournal.modifie = true; const n = document.querySelector('#jNote'); if (n && !n.textContent) n.textContent = 'Modifications non enregistrées.'; }
}
/** Une place libre sur la feuille (aucun équipement à moins de 80 unités). */
function placeLibre(s) {
  for (let y = 90; y <= 510; y += 105) for (let x = 110; x <= 890; x += 130) {
    if (!s.noeuds.some((n) => Math.hypot(n.x - x, n.y - y) < 80)) return { x, y };
  }
  return { x: 500, y: 300 };
}
function ajouterNoeud(attrs) {
  const s = schemaCourant();
  if (s.noeuds.length >= 80) return null;
  const p = placeLibre(s);
  const n = { id: idSchema('n'), type: 'autre', typePerso: null, nom: '', note: '', equipementId: null, ports: '', ...p, ...attrs };
  if (n.modele === undefined) n.modele = n.type === 'perso' || n.type === 'autre' ? MODELE_PERSO : (MODELES.find((m) => m.type === n.type && m.defaut)?.id ?? MODELE_PERSO);
  s.noeuds.push(n);
  return n;
}
function ajouterEquipementAuSchema(q) {
  // Le modèle noté dans la fiche (« Catalyst 2960-24TT (accès) ») donne les ports, sinon celui du type.
  const type = typeDepuisEquipement(q.type);
  const mod = MODELES.find((m) => m.type === type && q.modele && (m.label === q.modele || q.modele.includes(m.id)))?.id;
  const n = ajouterNoeud({ type, equipementId: q.id, ...(mod ? { modele: mod } : {}) });
  const e = etatJournal.brouillon;
  if (n && !e.equipements.some((l) => l.id === q.id)) e.equipements.push({ id: q.id, role: '' });
  return n;
}
function retirerElement(id) {
  const s = schemaCourant();
  s.noeuds = s.noeuds.filter((x) => x.id !== id);
  s.liens = s.liens.filter((x) => x.id !== id && x.de !== id && x.a !== id);
  s.zones = s.zones.filter((x) => x.id !== id);
  s.textes = s.textes.filter((x) => x.id !== id);
}
const trouverElement = (id) => {
  const s = schemaCourant();
  return s.noeuds.find((x) => x.id === id) ?? s.zones.find((x) => x.id === id) ?? s.textes.find((x) => x.id === id) ?? s.liens.find((x) => x.id === id) ?? null;
};
/**
 * Reporte l'interface (et son adresse) saisie sur un câble dans la fiche de
 * l'équipement de l'inventaire relié au nœud. Renvoie un message, ou ''.
 */
function reporterInterface(noeudId, itf, adresse, description = '') {
  const n = schemaCourant().noeuds.find((x) => x.id === noeudId);
  const q = n?.equipementId ? resoudreEquipement(n.equipementId) : null;
  const nomItf = String(itf ?? '').trim(); const adr = String(adresse ?? '').trim();
  if (!q || !nomItf) return '';
  const copie = structuredClone(q);
  const existante = copie.interfaces.find((i) => clePort(i.nom) === clePort(nomItf));
  if (existante) {
    const avant = JSON.stringify(existante);
    if (adr) existante.adresse = adr;
    if (description && !existante.description) existante.description = description;
    if (JSON.stringify(existante) === avant) return '';
  } else copie.interfaces.push({ nom: nomItf, adresse: adr, vlan: '', etat: '', description });
  const { equipement, erreurs } = normaliserEquipement({ ...copie, modifieLe: jour() });
  if (Object.keys(erreurs).length) return '';
  ecrireEquipements(lireEquipements().map((x) => (x.id === q.id ? equipement : x)));
  return `Interface ${nomItf}${adr ? ` (${adr})` : ''} enregistrée dans la fiche de ${q.nom}.`;
}
/** Adresse connue d'une interface dans la fiche de l'équipement du nœud. */
function adresseConnue(noeudId, itf) {
  const n = schemaCourant().noeuds.find((x) => x.id === noeudId);
  const q = n?.equipementId ? resoudreEquipement(n.equipementId) : null;
  return q?.interfaces.find((i) => clePort(i.nom) === clePort(itf))?.adresse ?? '';
}


// ---------------------------------------------------------------------------
// Configuration d'un équipement du schéma (JOURNAL-LABO-09) : n.config
// ---------------------------------------------------------------------------
const nomNoeudApp = (n) => resoudreEquipement(n.equipementId)?.nom || n.nom || typeNoeud(n.type).label;
/** Pose une valeur dans la configuration du nœud par son chemin « a|b|c » (crée ce qui manque). */
/** Élément Azure (ressource ou zone) : sa configuration se décrit par les formulaires de config-azure. */
const estElementAzure = (el) => Boolean(el && (('type' in el && estAzure(el.type)) || ('l' in el && el.genre)));
const configVideDe = (el) => (estElementAzure(el) ? normaliserConfigAzure(el.genre || el.type, null, { zone: Boolean(el.genre) }) : normaliserConfig(null));
function poserConfig(n, chemin, valeur) {
  if (!n.config) n.config = configVideDe(n);
  if (estElementAzure(n)) {
    const parts = chemin.split('|'); let o = n.config;
    for (const k of parts.slice(0, -1)) { const cle = /^\d+$/.test(k) ? Number(k) : k; if (o[cle] == null) o[cle] = {}; o = o[cle]; }
    o[parts.at(-1)] = valeur; return;
  }
  const parts = chemin.split('|');
  if (parts[0] === 'ports') {
    const nom = parts[1];
    if (!n.config.ports[nom]) n.config.ports[nom] = normaliserConfig({ ports: { [nom]: {} } }).ports[nom];
    n.config.ports[nom][parts[2]] = valeur; return;
  }
  let o = n.config;
  for (const k of parts.slice(0, -1)) { const cle = /^\d+$/.test(k) ? Number(k) : k; if (o[cle] == null) o[cle] = {}; o = o[cle]; }
  o[parts.at(-1)] = valeur;
}
/** Liste de la configuration désignée par « a|b ». */
function listeConfig(n, chemin) {
  if (!n.config) n.config = configVideDe(n);
  return chemin.split('|').reduce((o, k) => o?.[k], n.config);
}
function majApercuConfig(n) {
  const a = document.querySelector('#cfgApercu');
  if (a) a.innerHTML = estElementAzure(n) ? apercuAzureMarkup(schemaCourant(), n) : apercuConfigMarkup(n, n.config, { nom: nomNoeudApp(n) });
}
/** L'adresse d'un port configuré passe sur le câble branché à ce port et dans la fiche de l'équipement. */
function synchroniserAdressePort(n, port, adresse) {
  for (const l of schemaCourant().liens) {
    if (l.de === n.id && clePort(l.etiquetteDe) === clePort(port)) l.adresseDe = adresse;
    if (l.a === n.id && clePort(l.etiquetteA) === clePort(port)) l.adresseA = adresse;
  }
  return reporterInterface(n.id, port, adresse);
}
function texteConfigNoeud(n) {
  if (estElementAzure(n)) return texteAzure(n.genre ? commandesZone(schemaCourant(), n) : commandesAzure(schemaCourant(), n));
  const c = normaliserConfig(n.config);
  return texteAvecTitres(n, commandesNoeud(n, c, { nom: nomNoeudApp(n) }));
}


/** Nouvelle zone Azure : un sous-réseau se pose dans le VNet choisi (sinon le premier), un VNet sous les autres. */
function ajouterZoneAzure(genre) {
  const s = schemaCourant();
  if (s.zones.length >= 60) return null;
  const sel = etatSchema.selection ? s.zones.find((z) => z.id === etatSchema.selection) : null;
  const noms = { vnet: `VNET${s.zones.filter((z) => z.genre === 'vnet').length + 1}`, 'sous-reseau': 'Subnet', groupe: 'rg-labo', region: 'Canada Centre' };
  let x = 40; let y = 110; let l = 460; let h = 250;
  if (genre === 'sous-reseau') {
    const v = sel?.genre === 'vnet' ? sel : s.zones.find((z) => z.genre === 'vnet');
    const enfants = v ? s.zones.filter((z) => z.genre === 'sous-reseau' && z.x >= v.x && z.y >= v.y && z.x + z.l <= v.x + v.l && z.y + z.h <= v.y + v.h).length : 0;
    l = 180; h = 120;
    if (v) { x = v.x + 12 + (enfants % Math.max(1, Math.floor((v.l - 12) / 190))) * 190; y = v.y + 30 + Math.floor(enfants / Math.max(1, Math.floor((v.l - 12) / 190))) * 130; }
    x = Math.min(x, 1000 - l); y = Math.min(y, 600 - h);
  } else if (genre === 'vnet') {
    const n = s.zones.filter((z) => z.genre === 'vnet').length;
    x = 30 + (n % 2) * 480; y = 100 + Math.floor(n / 2) * 250; l = 460; h = 240;
    x = Math.min(x, 1000 - l); y = Math.min(y, 600 - h);
  } else if (genre === 'groupe') { x = 10; y = 20; l = 980; h = 575; }
  else { x = 5; y = 10; l = 990; h = 588; }
  const z = { id: idSchema('z'), nom: noms[genre] ?? 'Zone', genre, couleur: 'bleu', x, y, l, h };
  z.config = configVideDe(z);
  s.zones.push(z);
  return z;
}

/** Boutons du panneau Azure (ressource ou zone). */
async function actionConfigAzure(b, n, montrer) {
  const zone = Boolean(n.genre); const genre = n.genre || n.type;
  if (b.id === 'cfgBascule') { etatSchema.cfgOuvert = etatSchema.cfgOuvert === false; majBlocSchema('#cfgBascule'); return; }
  if (b.dataset.cfgadd) {
    const liste = listeConfig(n, b.dataset.cfgadd);
    const def = (zone ? FORMULAIRES_ZONE : FORMULAIRES)[genre]?.find((f) => f.id === b.dataset.cfgadd);
    if (!Array.isArray(liste) || !def) return;
    if (liste.length >= 60) { montrer('Limite atteinte pour cette liste.', `[data-cfgadd="${b.dataset.cfgadd}"]`); return; }
    liste.push(Object.fromEntries(def.colonnes.map((c) => [c.id, c.type === 'choix' && !c.dyn ? c.options[0][0] : ''])));
    schemaModifie();
    majBlocSchema(`#cfg-${`${b.dataset.cfgadd}|${liste.length - 1}|${def.colonnes[0].id}`.replace(/[^\w-]/g, '_')}`); return;
  }
  if (b.dataset.cfgdel) {
    const parts = b.dataset.cfgdel.split('|'); const i = Number(parts.pop()); const liste = listeConfig(n, parts.join('|'));
    if (Array.isArray(liste)) { liste.splice(i, 1); schemaModifie(); }
    majBlocSchema(`[data-cfgadd="${parts.join('|')}"]`); return;
  }
  const a = b.dataset.cfgaction; const sel = `[data-cfgaction="${a}"]`;
  if (a === 'copier') { let ok = false; try { await navigator.clipboard.writeText(texteConfigNoeud(n)); ok = true; } catch { ok = false; } montrer(ok ? 'Commandes copiées.' : 'La copie est bloquée ici : sélectionne le texte des commandes et copie-le (Ctrl+C).', sel); return; }
  if (a === 'telecharger') {
    const res = await enregistrerFichier(`${etatJournal.brouillon.reference}_${nomAzure(n.nom, genre)}.sh`, `#!/usr/bin/env bash\n${texteConfigNoeud(n)}\n`, 'text/x-shellscript');
    montrer(res.ok ? `Commandes ${res.message}.` : res.message, sel); return;
  }
  if (a === 'effacer') {
    if (!etatSchema.cfgEffacer) { etatSchema.cfgEffacer = true; majBlocSchema(sel); const x = document.querySelector(sel); if (x) x.textContent = 'Confirmer : effacer la configuration'; return; }
    etatSchema.cfgEffacer = false; n.config = configVideDe(n); schemaModifie(); montrer('Configuration remise à zéro.', '[data-cfgaction="copier"]'); return;
  }
  if (a === 'decouper' && n.genre === 'vnet') {
    const s = schemaCourant(); const ctx = contexteAzure(s);
    const v = ctx.vnets.find((x) => x.id === n.id); const sns = ctx.sousReseaux.filter((x) => x.vnet?.id === n.id);
    const r = decouperVnet(v?.c.espace, sns.map((x) => ({ id: x.id, nom: x.nom, besoin: x.c.besoin })));
    for (const [id, plage] of Object.entries(r.plages)) { const z = s.zones.find((x) => x.id === id); if (z) { z.config = z.config ?? configVideDe(z); z.config.plage = plage; } }
    if (Object.keys(r.plages).length) schemaModifie();
    montrer(r.erreur ?? `${Object.keys(r.plages).length} plage(s) attribuée(s)${r.reste ? ` ; ${r.reste} adresse(s) libres pour la croissance` : ''}. Vérifie et justifie tes choix.`, sel);
  }
}

/** Boutons du panneau « Configuration ». */
async function actionConfig(b, view) {
  const montrer = (note, focus) => { etatSchema.cfgNote = note; majBlocSchema(focus); etatSchema.cfgNote = ''; };
  if (b.dataset.cfgaction === 'scriptComplet') {
    const r = scriptAzure(schemaCourant());
    const res = await enregistrerFichier(`${etatJournal.brouillon.reference}_azure.sh`, `#!/usr/bin/env bash\n# ${etatJournal.brouillon.titre || etatJournal.brouillon.reference} : déploiement Azure (vérifié dans sa forme, pas exécuté)\nset -e\n${texteAzure(r)}\n`, 'text/x-shellscript');
    montrer(res.ok ? `Script complet ${res.message}${r.avertissements.length ? ` (${r.avertissements.length} avertissement(s) à régler avant de l’exécuter)` : ''}.` : res.message, '[data-cfgaction="scriptComplet"]');
    return;
  }
  const n = etatSchema.selection ? trouverElement(etatSchema.selection) : null;
  if (!n || 'de' in n || 'texte' in n) return;
  if (estElementAzure(n)) { await actionConfigAzure(b, n, montrer); return; }
  if (b.id === 'cfgBascule') { etatSchema.cfgOuvert = etatSchema.cfgOuvert === false; majBlocSchema('#cfgBascule'); return; }
  if (b.dataset.cfgadd) {
    const liste = listeConfig(n, b.dataset.cfgadd); const ligne = nouvelleLigne(b.dataset.cfgadd, normaliserConfig(n.config));
    if (!Array.isArray(liste) || !ligne) return;
    if (liste.length >= 64) { montrer('Limite atteinte pour cette liste.', `[data-cfgadd="${b.dataset.cfgadd}"]`); return; }
    liste.push(ligne); schemaModifie();
    const i = liste.length - 1; const premier = Object.keys(ligne)[0];
    majBlocSchema(`#cfg-${`${b.dataset.cfgadd}|${i}|${premier}`.replace(/[^\w-]/g, '_')}`); return;
  }
  if (b.dataset.cfgdel) {
    const parts = b.dataset.cfgdel.split('|'); const i = Number(parts.pop());
    const liste = listeConfig(n, parts.join('|'));
    if (Array.isArray(liste)) { liste.splice(i, 1); schemaModifie(); }
    majBlocSchema(`[data-cfgadd="${parts.join('|')}"]`); return;
  }
  const a = b.dataset.cfgaction; const sel = `[data-cfgaction="${a}"]`;
  if (a === 'proposer') {
    const niveau = normaliserConfig(n.config).niveau;
    const r = proposerConfig(schemaCourant(), n.id, n.config, { niveau });
    n.config = r.config; schemaModifie();
    // Les adresses proposées sur les ports passent aussi sur les câbles et dans la fiche.
    for (const [p, cp] of Object.entries(n.config.ports)) if (cp.adresse) synchroniserAdressePort(n, p, cp.adresse);
    montrer(r.ajouts.length ? `Proposé : ${r.ajouts.join(' · ')}. Vérifie et complète.` : 'Rien de nouveau à proposer : câble les équipements, nomme les zones « VLAN 10 · NOM · 192.168.10.0/24 », ou monte le niveau.', sel);
    return;
  }
  if (a === 'copier') {
    let ok = false; try { await navigator.clipboard.writeText(texteConfigNoeud(n)); ok = true; } catch { ok = false; }
    montrer(ok ? 'Commandes copiées.' : 'La copie est bloquée ici : sélectionne le texte des commandes et copie-le (Ctrl+C).', sel); return;
  }
  if (a === 'telecharger') {
    const nom = nomNoeudApp(n).replace(/[^\w.-]+/g, '_');
    const res = await enregistrerFichier(`${etatJournal.brouillon.reference}_${nom}_config.txt`, `${texteConfigNoeud(n)}\n`, 'text/plain');
    montrer(res.ok ? `Configuration ${res.message}.` : res.message, sel); return;
  }
  if (a === 'effacer') {
    if (!etatSchema.cfgEffacer) { etatSchema.cfgEffacer = true; majBlocSchema(sel); const x = document.querySelector(sel); if (x) x.textContent = 'Confirmer : effacer la configuration'; return; }
    etatSchema.cfgEffacer = false; n.config = null; schemaModifie(); montrer('Configuration effacée.', '[data-cfgaction="proposer"]'); return;
  }
  if (a === 'tousPorts') { etatSchema.cfgTousPorts = !etatSchema.cfgTousPorts; majBlocSchema(sel); return; }
  if (a === 'dhcpParVlan') {
    n.config = normaliserConfig(n.config); const k = poolsParVlan(n.config); if (k) schemaModifie();
    montrer(k ? `${k} pool(s) DHCP ajouté(s).` : 'Aucune sous-interface ou SVI adressée sans pool.', sel); return;
  }
  if (a === 'ospfReseaux') {
    n.config = normaliserConfig(n.config); const k = ospfDepuisInterfaces(n.config); if (k) schemaModifie();
    montrer(k ? `${k} réseau(x) annoncé(s) en OSPF.` : 'Aucun nouveau réseau adressé à annoncer.', sel);
  }
}

/** Coordonnées de feuille d'un événement pointeur. */
function pointFeuille(ev, svg) {
  const r = svg.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * FEUILLE.largeur, y: ((ev.clientY - r.top) / r.height) * FEUILLE.hauteur };
}

/** Port choisi dans le menu : premier bout du câble, ou création du câble au deuxième. */
function choisirPort(port, { sansPort = false } = {}) {
  const s = schemaCourant(); const c = etatSchema.cablage; const nom = String(port ?? '').trim().slice(0, 30);
  if (!c?.enAttente || (!nom && !sansPort)) return;
  const n = s.noeuds.find((x) => x.id === c.enAttente);
  const note = document.querySelector('#jNote');
  if (nom && portsOccupes(n, s.liens).has(clePort(nom))) { if (note) note.textContent = `Le port ${nom} est déjà câblé : choisis-en un autre.`; return; }
  if (!c.depuis) { etatSchema = { ...etatSchema, cablage: { ...c, depuis: { noeud: n.id, port: nom }, enAttente: null }, selection: n.id }; majBlocSchema('#schFeuille'); return; }
  const a = s.noeuds.find((x) => x.id === c.depuis.noeud);
  const style = c.style === 'auto' ? cableAutomatique(a.type, c.depuis.port, n.type, nom) : c.style;
  const l = { id: idSchema('l'), de: a.id, a: n.id, style, etiquette: style === 'trunk' ? '802.1Q' : '', etiquetteDe: c.depuis.port, etiquetteA: nom,
    adresseDe: adresseConnue(a.id, c.depuis.port), adresseA: adresseConnue(n.id, nom) };
  s.liens.push(l);
  // Chaque port câblé entre dans la fiche de son équipement, avec sa destination en description.
  const nomDe = (x) => resoudreEquipement(x.equipementId)?.nom || x.nom || typeNoeud(x.type).label;
  const m1 = reporterInterface(a.id, l.etiquetteDe, '', `Vers ${nomDe(n)} ${l.etiquetteA}`);
  const m2 = reporterInterface(n.id, l.etiquetteA, '', `Vers ${nomDe(a)} ${l.etiquetteDe}`);
  etatSchema = { ...etatSchema, cablage: { ...c, depuis: null, enAttente: null }, selection: l.id };
  schemaModifie(); majBlocSchema('#schAdrDe');
  if (note) note.textContent = `${styleLien(style).label} : ${nomDe(a)} ${l.etiquetteDe} ↔ ${nomDe(n)} ${l.etiquetteA}.${m1 || m2 ? ' Ports ajoutés aux fiches de l’inventaire.' : ''} Saisis les adresses si besoin.`;
}

function brancherSchema(view) {
  const bloc = view.querySelector('#schBloc');
  if (!bloc) return;
  let glisse = null;   // { id, mode: 'deplacer'|'taille', dx, dy, bouge }
  bloc.addEventListener('pointerdown', (ev) => {
    const svg = ev.target.closest('svg.schema-svg'); if (!svg) return;
    const cible = ev.target.closest('[data-el]'); const p = pointFeuille(ev, svg); const s = schemaCourant();
    if (!cible) {   // fond : désélection (le mode câble reste actif)
      if (etatSchema.selection || etatSchema.relierDepuis) { etatSchema = { ...etatSchema, selection: null, relierDepuis: null }; majBlocSchema(); }
      return;
    }
    const id = cible.dataset.el;
    // Mode câble (palette « Câbles ») : premier équipement, puis deuxième.
    if (etatSchema.cablage) {
      ev.preventDefault();
      if (!s.noeuds.some((n) => n.id === id)) return;
      const c = etatSchema.cablage;
      if (c.depuis?.noeud === id) { etatSchema = { ...etatSchema, cablage: { ...c, depuis: null, enAttente: null }, selection: null }; majBlocSchema(); return; }
      // Le menu des ports de cet équipement s'ouvre sur la feuille.
      etatSchema = { ...etatSchema, cablage: { ...c, enAttente: id }, selection: c.depuis ? c.depuis.noeud : id };
      // Ressource sans port (Azure, nuage) : pas de menu, le lien se pose directement.
      const nd = s.noeuds.find((x) => x.id === id);
      if (!portsDuNoeud(nd, { equipement: resoudreEquipement(nd.equipementId), liens: s.liens }).length) { choisirPort('', { sansPort: true }); return; }
      majBlocSchema('#schPortChoix');
      return;
    }
    // Mode « Relier » : le deuxième équipement crée le lien.
    if (etatSchema.relierDepuis && s.noeuds.some((n) => n.id === id)) {
      if (id !== etatSchema.relierDepuis && !s.liens.some((l) => (l.de === etatSchema.relierDepuis && l.a === id) || (l.a === etatSchema.relierDepuis && l.de === id))) {
        const l = { id: idSchema('l'), de: etatSchema.relierDepuis, a: id, style: 'droit', etiquette: '', etiquetteDe: '', etiquetteA: '', adresseDe: '', adresseA: '' };
        s.liens.push(l); etatSchema = { ...etatSchema, selection: l.id, relierDepuis: null }; schemaModifie(); majBlocSchema('#schItfDe');
      } else { etatSchema = { ...etatSchema, relierDepuis: null }; majBlocSchema(); }
      ev.preventDefault(); return;
    }
    const el = trouverElement(id); if (!el) return;
    etatSchema = { ...etatSchema, selection: id, viderConfirme: false };
    if ('de' in el) { majBlocSchema(); return; }   // un lien se choisit, il ne se déplace pas
    const zoneTaille = 'l' in el && p.x > el.x + el.l - 18 && p.y > el.y + el.h - 18;
    glisse = { id, mode: zoneTaille ? 'taille' : 'deplacer', dx: p.x - el.x, dy: p.y - el.y, bouge: false };
    svg.setPointerCapture?.(ev.pointerId);
    majFeuilleSchema(); ev.preventDefault();
  });
  bloc.addEventListener('pointermove', (ev) => {
    if (!glisse) return;
    const svg = bloc.querySelector('svg.schema-svg'); if (!svg) return;
    const p = pointFeuille(ev, svg); const el = trouverElement(glisse.id); if (!el) return;
    if (glisse.mode === 'taille') { el.l = Math.max(60, Math.min(FEUILLE.largeur - el.x, aimanter(p.x - el.x))); el.h = Math.max(40, Math.min(FEUILLE.hauteur - el.y, aimanter(p.y - el.y))); }
    else {
      const borneX = 'l' in el ? [0, FEUILLE.largeur - el.l] : [40, FEUILLE.largeur - 40]; const borneY = 'l' in el ? [0, FEUILLE.hauteur - el.h] : ['texte' in el ? 14 : 30, FEUILLE.hauteur - ('texte' in el ? 4 : 60)];
      el.x = Math.max(borneX[0], Math.min(borneX[1], aimanter(p.x - glisse.dx))); el.y = Math.max(borneY[0], Math.min(borneY[1], aimanter(p.y - glisse.dy)));
    }
    glisse.bouge = true; majFeuilleSchema();
  });
  const fin = () => { if (!glisse) return; const bouge = glisse.bouge; glisse = null; if (bouge) schemaModifie(); majBlocSchema(); };
  bloc.addEventListener('pointerup', fin); bloc.addEventListener('pointercancel', fin);
  bloc.addEventListener('keydown', (ev) => {
    if (ev.target.closest?.('.sch-menu-ports')) {
      if (ev.key === 'Escape') { ev.preventDefault(); etatSchema = { ...etatSchema, cablage: { ...etatSchema.cablage, enAttente: null } }; majBlocSchema('#schFeuille'); }
      else if (ev.key === 'Enter') { ev.preventDefault(); choisirPort(ev.target.id === 'schPortLibre' ? ev.target.value : ev.target.value); }
      return;
    }
    if (ev.target.id !== 'schFeuille') return;
    const el = etatSchema.selection ? trouverElement(etatSchema.selection) : null;
    if (ev.key === 'Escape') { ev.preventDefault(); etatSchema = { ...etatSchema, selection: null, relierDepuis: null, cablage: null }; majBlocSchema('#schFeuille'); return; }
    if (!el) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); retirerElement(el.id); etatSchema.selection = null; schemaModifie(); majBlocSchema('#schFeuille'); return; }
    const pas = ev.shiftKey ? 50 : 10; const d = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[ev.key];
    if (!d || 'de' in el) return;
    ev.preventDefault();
    const lw = 'l' in el ? el.l : 0; const lh = 'h' in el ? el.h : 0;
    el.x = Math.max(0, Math.min(FEUILLE.largeur - (lw || 40), el.x + d[0])); el.y = Math.max(14, Math.min(FEUILLE.hauteur - (lh || 60), el.y + d[1]));
    schemaModifie(); majFeuilleSchema();
  });
  bloc.addEventListener('input', (ev) => {
    if (ev.target.id === 'azGroupe') { const s = schemaCourant(); s.azure = { ...(s.azure ?? {}), groupe: ev.target.value }; schemaModifie(); return; }
    const el = etatSchema.selection ? trouverElement(etatSchema.selection) : null; if (!el) return;
    if (ev.target.dataset?.cfg && ev.target.type === 'text') {
      poserConfig(el, ev.target.dataset.cfg, ev.target.value); schemaModifie(); majApercuConfig(el);
      if (estElementAzure(el) && 'l' in el) majFeuilleSchema();
      return;
    }
    if (ev.target.id === 'schPorts') { el.ports = ev.target.value; schemaModifie(); return; }
    const champ = { schNom: 'nom', schNote: 'note', schEtiquette: 'etiquette', schItfDe: 'etiquetteDe', schItfA: 'etiquetteA', schAdrDe: 'adresseDe', schAdrA: 'adresseA', schZoneNom: 'nom', schTexte: 'texte' }[ev.target.id];
    if (!champ) return;
    el[champ] = ev.target.value; schemaModifie(); majFeuilleSchema();
  });
  bloc.addEventListener('change', (ev) => {
    const id = ev.target.id; const el = etatSchema.selection ? trouverElement(etatSchema.selection) : null;
    if (id === 'azRegion' || id === 'azGroupe') { const s = schemaCourant(); s.azure = { ...(s.azure ?? {}), [id === 'azRegion' ? 'region' : 'groupe']: ev.target.value }; schemaModifie(); return; }
    if (id === 'schElement') { etatSchema = { ...etatSchema, selection: ev.target.value || null, relierDepuis: null, cfgEffacer: false }; majBlocSchema('#schElement'); return; }
    if (!el) return;
    if (ev.target.dataset?.cfgmulti) {
      const ch = ev.target.dataset.cfgmulti; const actuel = listeConfig(el, ch);
      const liste = Array.isArray(actuel) ? actuel : [];
      const v = ev.target.value; const nouvelle = ev.target.checked ? [...new Set([...liste, v])] : liste.filter((x) => x !== v);
      poserConfig(el, ch, nouvelle); schemaModifie(); majFeuilleSchema(); majApercuConfig(el); return;
    }
    const chemin = ev.target.dataset?.cfg;
    if (chemin) {
      const t = ev.target;
      const v = t.type === 'checkbox' ? t.checked : t.value;
      poserConfig(el, chemin, v); schemaModifie();
      if (/^ports\|[^|]+\|adresse$/.test(chemin)) {
        const msg = synchroniserAdressePort(el, chemin.split('|')[1], String(v).trim()); majFeuilleSchema();
        const note = document.querySelector('#jNote'); if (msg && note) note.textContent = msg;
      }
      if (t.type === 'text') { majApercuConfig(el); return; }
      // Les choix (niveau, mode d'un port, protocole…) changent les champs montrés.
      majBlocSchema(t.type === 'radio' ? 'input[name="cfgNiveau"]:checked' : `#${t.id}`);
      return;
    }
    // Interface ou adresse d'un côté de câble : complète l'adresse connue, puis reporte dans l'inventaire.
    const cote = { schItfDe: 'De', schAdrDe: 'De', schItfA: 'A', schAdrA: 'A' }[id];
    if (cote && 'de' in el) {
      const noeud = cote === 'De' ? el.de : el.a;
      if (id.startsWith('schItf') && !el[`adresse${cote}`]) {
        const connue = adresseConnue(noeud, el[`etiquette${cote}`]);
        if (connue) { el[`adresse${cote}`] = connue; const champAdr = document.querySelector(`#schAdr${cote}`); if (champAdr) champAdr.value = connue; majFeuilleSchema(); }
      }
      const nd = schemaCourant().noeuds.find((x) => x.id === noeud);
      const cleCfg = nd?.config ? Object.keys(nd.config.ports ?? {}).find((k) => clePort(k) === clePort(el[`etiquette${cote}`])) : null;
      if (cleCfg && id.startsWith('schAdr')) nd.config.ports[cleCfg].adresse = el[`adresse${cote}`];
      const msg = reporterInterface(noeud, el[`etiquette${cote}`], el[`adresse${cote}`]);
      const note = document.querySelector('#jNote'); if (msg && note) note.textContent = msg;
      return;
    }
    if (id === 'schModele') {
      const mod = ev.target.value;
      if (mod === MODELE_PERSO && !el.ports) el.ports = modele(el.modele)?.ports ?? '';
      el.modele = mod;
    } else if (id === 'schPorts') { el.ports = ev.target.value; }
    else if (id === 'schType') {
      const v = ev.target.value;
      if (v.startsWith('perso:')) { el.type = 'perso'; el.typePerso = v.slice(6); el.modele = MODELE_PERSO; }
      else { el.type = v; el.typePerso = null; el.modele = MODELES.find((m) => m.type === v && m.defaut)?.id ?? MODELE_PERSO; }
    }
    else if (id === 'schStyle') el.style = ev.target.value;
    else if (id === 'schZoneCouleur') el.couleur = ev.target.value;
    else if (id === 'schZoneGenre') { el.genre = ev.target.value || undefined; el.config = el.genre ? configVideDe(el) : undefined; if (!el.genre) { delete el.genre; delete el.config; } }
    else if (id === 'schZoneL') el.l = Math.max(60, Math.min(FEUILLE.largeur - el.x, aimanter(Number(ev.target.value) || 60)));
    else if (id === 'schZoneH') el.h = Math.max(40, Math.min(FEUILLE.hauteur - el.y, aimanter(Number(ev.target.value) || 40)));
    else return;
    schemaModifie(); majBlocSchema(`#${id}`);
  });
  bloc.addEventListener('click', async (ev) => {
    // Menu des ports : un clic sur un port libre le choisit.
    const liste = ev.target.closest?.('#schPortChoix');
    if (liste) { if (liste.value) choisirPort(liste.value); return; }
    const b = ev.target.closest('button, a[data-jeqouvrir]'); if (!b) return;
    if (b.id === 'cfgBascule' || b.dataset.cfgadd || b.dataset.cfgdel || b.dataset.cfgaction) { await actionConfig(b, view); return; }
    if (b.id === 'schPortOk') { choisirPort(document.querySelector('#schPortLibre')?.value || document.querySelector('#schPortChoix')?.value); return; }
    if (b.id === 'schPortAnnuler') { etatSchema = { ...etatSchema, cablage: { ...etatSchema.cablage, enAttente: null } }; majBlocSchema('#schFeuille'); return; }
    if (b.dataset.sfiltre) { etatSchema = { ...etatSchema, filtreSysteme: b.dataset.sfiltre }; majBlocSchema(`[data-sfiltre="${b.dataset.sfiltre}"]`); return; }
    const s = schemaCourant(); const e = etatJournal.brouillon;
    if (b.matches('a[data-jeqouvrir]')) {   // vers la fiche de l'équipement : le labo est enregistré d'abord
      ev.preventDefault();
      if (etatJournal.modifie && !enregistrerJournal(view)) return;
      etatInventaire.retour = { id: e.id, reference: e.reference };
      location.hash = b.getAttribute('href'); return;
    }
    if (b.dataset.scable) {
      const st = b.dataset.scable;
      etatSchema = { ...etatSchema, cablage: etatSchema.cablage?.style === st ? null : { style: st, depuis: null, enAttente: null }, relierDepuis: null, selection: null };
      majBlocSchema(`[data-scable="${st}"]`);
      document.querySelector('#schFeuille')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (b.dataset.sadd) {
      const v = b.dataset.sadd; let nouvel = null;
      if (v === 'zone') { nouvel = { id: idSchema('z'), nom: 'Nouvelle zone', couleur: 'bleu', x: 40, y: 360, l: 300, h: 200 }; s.zones.push(nouvel); }
      else if (v.startsWith('zone:')) nouvel = ajouterZoneAzure(v.slice(5));
      else if (v === 'texte') { nouvel = { id: idSchema('t'), texte: 'Texte', x: 30, y: 34 }; s.textes.push(nouvel); }
      else if (v.startsWith('perso:')) nouvel = ajouterNoeud({ type: 'perso', typePerso: v.slice(6) });
      else nouvel = ajouterNoeud({ type: v });
      if (nouvel) { etatSchema = { ...etatSchema, selection: nouvel.id, relierDepuis: null }; schemaModifie(); majBlocSchema(v.startsWith('zone') ? '#schZoneNom' : v === 'texte' ? '#schTexte' : '#schNom'); }
      return;
    }
    switch (b.id) {
      case 'schTypeOuvrir': etatSchema.typeOuvert = !etatSchema.typeOuvert; majBlocSchema(etatSchema.typeOuvert ? '#schTypeNom' : '#schTypeOuvrir'); break;
      case 'schTypeAjouter': {
        const nom = document.querySelector('#schTypeNom')?.value ?? ''; const code = document.querySelector('#schTypeCode')?.value ?? '';
        const liste = normaliserTypesPerso([...lireTypesPerso(), { id: `t${Date.now().toString(36)}`, nom, code }]);
        if (liste.length === lireTypesPerso().length) { const c = document.querySelector('#schTypeNom'); c?.setAttribute('aria-invalid', 'true'); c?.focus(); break; }
        ecrireTypesPerso(liste); etatSchema.typeOuvert = false; majBlocSchema(`[data-sadd="perso:${liste.at(-1).id}"]`); break;
      }
      case 'schEqAjouter': { const q = resoudreEquipement(document.querySelector('#schEq')?.value); if (q) { const n = ajouterEquipementAuSchema(q); if (n) { etatSchema.selection = n.id; schemaModifie(); dessinerJournalFiche(view); document.querySelector('#schNote')?.focus({ preventScroll: true }); } } break; }
      case 'schLabo': {
        let k = 0; for (const l of e.equipements) { const q = resoudreEquipement(l.id); if (q && !s.noeuds.some((n) => n.equipementId === q.id) && ajouterEquipementAuSchema(q)) k++; }
        if (k) schemaModifie(); majBlocSchema('#schLabo');
        const n = document.querySelector('#jNote'); if (n) n.textContent = k ? `${k} équipement(s) placé(s) sur le schéma.` : 'Tous les équipements du labo sont déjà sur le schéma.';
        break;
      }
      case 'schRemplir': {
        lireFormulaireJournal(view);
        const r = remplirDepuisSchema(etatJournal.brouillon, { inventaire: lireEquipements(), typesPerso: lireTypesPerso() });
        // L'inventaire est enregistré tout de suite (les fiches existent) ; le labo, lui, attend « Enregistrer ».
        ecrireEquipements(r.inventaire);
        etatJournal = { ...etatJournal, brouillon: r.entree, noteFiche: phraseBilan(r.bilan), modifie: true };
        dessinerJournalFiche(view);
        document.querySelector('#schRemplir')?.focus({ preventScroll: true });
        break;
      }
      case 'schModeleCharger': {
        const m = modeleSchema(document.querySelector('#schModeleLabo')?.value);
        if (!m) break;
        const vide = !s.noeuds.length && !s.zones.length && !s.textes.length;
        if (!vide && !etatSchema.modeleConfirme) { etatSchema.modeleConfirme = true; majBlocSchema('#schModeleCharger'); const x = document.querySelector('#schModeleCharger'); if (x) x.textContent = 'Confirmer : remplacer le schéma'; break; }
        const { schema: nouveau } = normaliserSchema(m.construire());
        lireFormulaireJournal(view);
        e.schema = nouveau; if (!e.titre.trim()) e.titre = m.titre ?? ''; if (!e.objet.trim()) e.objet = m.objet ?? '';
        etatSchema = { ...etatSchema, selection: null, modeleConfirme: false, cablage: null, relierDepuis: null }; schemaModifie(); dessinerJournalFiche(view);
        document.querySelector('#schFeuille')?.focus({ preventScroll: true });
        const n = document.querySelector('#jNote'); if (n) n.textContent = `Modèle chargé : ${m.label}. Complète les plages, appairages et réglages demandés par l’énoncé.`;
        break;
      }
      case 'schCablageFin': etatSchema = { ...etatSchema, cablage: null }; majBlocSchema('#schFeuille'); break;
      case 'schVersInventaire': {
        const n = trouverElement(etatSchema.selection); if (!n || !('type' in n) || n.equipementId) break;
        const persos = new Map(lireTypesPerso().map((t) => [t.id, t]));
        const nom = n.nom || (n.type === 'perso' ? persos.get(n.typePerso)?.nom : null) || 'Équipement';
        const typeEq = TYPES_EQUIPEMENT.some((t) => t.id === n.type) ? n.type : 'autre';
        const { equipement, erreurs } = normaliserEquipement({ ...equipementVide({ systemeId: SYSTEME_DU_TYPE[n.type] ?? 'autre', typeId: typeEq }), nom, adresse: n.note });
        if (Object.keys(erreurs).length) break;
        ecrireEquipements([...lireEquipements(), equipement]);
        n.equipementId = equipement.id;
        if (!e.equipements.some((l) => l.id === equipement.id)) e.equipements.push({ id: equipement.id, role: '' });
        // Les interfaces déjà saisies sur ses câbles passent dans sa fiche.
        for (const l of s.liens) { if (l.de === n.id) reporterInterface(n.id, l.etiquetteDe, l.adresseDe); if (l.a === n.id) reporterInterface(n.id, l.etiquetteA, l.adresseA); }
        schemaModifie(); dessinerJournalFiche(view);
        const note = document.querySelector('#jNote'); if (note) note.textContent = `${nom} ajouté à l’inventaire et au labo.`;
        break;
      }
      case 'schRelier':
        etatSchema.relierDepuis = etatSchema.relierDepuis ? null : etatSchema.selection; majBlocSchema('#schFeuille');
        document.querySelector('#schFeuille')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        break;
      case 'schInverser': { const l = trouverElement(etatSchema.selection); if (l && 'de' in l) { [l.de, l.a] = [l.a, l.de]; [l.etiquetteDe, l.etiquetteA] = [l.etiquetteA, l.etiquetteDe]; schemaModifie(); majBlocSchema('#schInverser'); } break; }
      case 'schSupprimer': if (etatSchema.selection) { retirerElement(etatSchema.selection); etatSchema.selection = null; schemaModifie(); majBlocSchema('#schFeuille'); } break;
      case 'schVider':
        if (!etatSchema.viderConfirme) { etatSchema.viderConfirme = true; majBlocSchema('#schVider'); break; }
        e.schema = schemaVide(); etatSchema = { ...etatSchema, selection: null, relierDepuis: null, viderConfirme: false }; schemaModifie(); majBlocSchema('#schFeuille'); break;
      case 'schSvg': {
        const ops = dessinerSchema(s, { resoudre: resoudreEquipement, typesPerso: lireTypesPerso() });
        const svg = versSvg(ops, { titre: `${e.titre || e.reference} : schéma d’architecture`, description: decrireSchema(s, { resoudre: resoudreEquipement, typesPerso: lireTypesPerso() }) });
        const res = await enregistrerFichier(`${e.reference}_schema.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`, 'image/svg+xml');
        const n = document.querySelector('#jNote'); if (n) n.textContent = res.ok ? `Schéma ${res.message}.` : res.message;
        break;
      }
      default: break;
    }
  });
}

// ---------------------------------------------------------------------------
// Inventaire des équipements (JOURNAL-LABO-03)
// ---------------------------------------------------------------------------
let etatInventaire = { systemeId: null, requete: '', note: '', nouveauSysteme: 'cisco',
  brouillonId: null, brouillon: null, erreurs: {}, noteFiche: '', modifie: false, confirmerSuppression: false, nouveau: false, retour: null };

function renderInventaire() { if (espace.id) renderEquipement(); else renderInventaireListe(); }

function renderInventaireListe() {
  const view = document.querySelector('#journalView');
  const tous = lireEquipements(); const ei = etatInventaire; const entrees = lireEntreesJournal();
  const projets = (id) => labosDe(id, entrees);
  view.innerHTML = inventaireListeMarkup({ equipements: filtrerInventaire(tous, { systemeId: ei.systemeId, requete: ei.requete }), total: tous.length,
    compte: (sys) => filtrerInventaire(tous, { systemeId: sys, requete: ei.requete }).length, systemeId: ei.systemeId, requete: ei.requete, projets, note: ei.note, nouveauSysteme: ei.nouveauSysteme });
  document.title = 'Inventaire des équipements — KJEMO IT Toolkit';
  etatInventaire.retour = null;
  view.querySelectorAll('[data-isys]').forEach((b) => b.addEventListener('click', () => { etatInventaire.systemeId = b.dataset.isys || null; renderInventaireListe(); document.querySelector(`[data-isys="${b.dataset.isys}"]`)?.focus(); }));
  view.querySelector('#iRecherche').addEventListener('input', (ev) => {
    etatInventaire.requete = ev.target.value; const pos = ev.target.selectionStart;
    renderInventaireListe(); const c = document.querySelector('#iRecherche'); c?.focus(); c?.setSelectionRange?.(pos, pos);
  });
  view.querySelector('#iNouveauSys').addEventListener('change', (ev) => { etatInventaire.nouveauSysteme = ev.target.value; });
  view.querySelector('#iNouveauForm').addEventListener('submit', (ev) => { ev.preventDefault(); ouvrirEquipement(equipementVide({ systemeId: etatInventaire.nouveauSysteme }), { nouveau: true }); });
  view.querySelector('#iPdf').addEventListener('click', async () => {
    let r = null;
    try { r = pdfInventaire(filtrerInventaire(lireEquipements(), {}), { projets: (id) => projets(id).map((p) => p.reference), auteur: auteurParDefaut() }); } catch { r = null; }
    if (r) {
      const res = await enregistrerFichier(`inventaire-equipements_${jour()}.pdf`, r.octets, 'application/pdf');
      etatInventaire.note = res.ok ? `PDF ${res.message} (${r.pages} pages).` : res.message;
    } else etatInventaire.note = 'Le PDF n’a pas pu être fabriqué.';
    renderInventaireListe(); document.querySelector('#iPdf')?.focus();
  });
}

function ouvrirEquipement(eq, { nouveau = false, retour = null, note = '' } = {}) {
  etatInventaire = { ...etatInventaire, brouillonId: eq.id, brouillon: structuredClone(eq), erreurs: {}, noteFiche: note, modifie: nouveau, confirmerSuppression: false, nouveau, retour };
  const cible = routeEquipement(eq.id);
  if (location.hash !== cible) location.hash = cible; else render();
}

function renderEquipement() {
  const view = document.querySelector('#journalView'); const ei = etatInventaire;
  if (ei.brouillonId !== espace.id || !ei.brouillon) {
    const q = lireEquipements().find((x) => x.id === espace.id);
    if (!q) {
      view.innerHTML = `<h1>Équipement introuvable</h1><p>Cet équipement n’existe pas (ou plus) dans ce navigateur.</p><p><a href="${ROUTE_INVENTAIRE}">Retour à l’inventaire</a></p>`;
      document.title = 'Équipement introuvable — KJEMO IT Toolkit'; return;
    }
    etatInventaire = { ...ei, brouillonId: q.id, brouillon: structuredClone(q), erreurs: {}, noteFiche: '', modifie: false, confirmerSuppression: false, nouveau: false };
  }
  dessinerEquipement(view);
}

function dessinerEquipement(view = document.querySelector('#journalView')) {
  const ei = etatInventaire; const q = ei.brouillon;
  const labos = labosDe(q.id, lireEntreesJournal()).map((l) => ({ id: l.id, reference: l.reference, titre: l.titre, role: l.equipements.find((x) => x.id === q.id)?.role ?? '' }));
  const defil = window.scrollY;
  view.innerHTML = equipementMarkup({ equipement: q, erreurs: ei.erreurs, note: ei.noteFiche, modifie: ei.modifie, labos, confirmerSuppression: ei.confirmerSuppression, retour: ei.retour });
  window.scrollTo(0, defil);
  document.title = `${q.nom || 'Nouvel équipement'} — Inventaire — KJEMO IT Toolkit`;
  brancherEquipement(view);
}

function lireFormulaireEquipement(view) {
  const q = etatInventaire.brouillon;
  view.querySelectorAll('[data-i]').forEach((i) => { q[i.dataset.i] = i.value; });
  view.querySelectorAll('[data-it]').forEach((i) => { const t = q[i.dataset.it]; const r = Number(i.dataset.row); if (t?.[r]) t[r][i.dataset.col] = i.value; });
  // Un type qui n'existe pas pour ce système reprend le premier type du système.
  const t = TYPES_EQUIPEMENT.find((x) => x.id === q.type);
  if (!t || !t.systemes.includes(q.systeme)) q.type = TYPES_EQUIPEMENT.find((x) => x.systemes.includes(q.systeme)).id;
}

function enregistrerEquipement(view) {
  lireFormulaireEquipement(view);
  const { equipement, erreurs } = normaliserEquipement({ ...etatInventaire.brouillon, modifieLe: jour() });
  if (Object.keys(erreurs).length) {
    etatInventaire = { ...etatInventaire, erreurs, noteFiche: '' }; dessinerEquipement(view);
    document.querySelector(`[aria-describedby="ierr-${Object.keys(erreurs)[0].replace(/\./g, '-')}"]`)?.focus();
    return null;
  }
  const autres = lireEquipements().filter((x) => x.id !== equipement.id);
  const ok = ecrireEquipements([...autres, equipement]);
  let note = ok ? 'Enregistré dans l’inventaire.' : 'Le stockage de ce navigateur est indisponible : cet équipement ne sera pas conservé.';
  if (autres.some((x) => x.nom.toLowerCase() === equipement.nom.toLowerCase())) note += ` Attention : un autre équipement s’appelle déjà « ${equipement.nom} ».`;
  // Créé depuis un labo : on l'y ajoute.
  const r = etatInventaire.retour;
  if (etatInventaire.nouveau && r) {
    const entrees = lireEntreesJournal();
    const lab = entrees.find((x) => x.id === r.id);
    if (lab && !lab.equipements.some((x) => x.id === equipement.id)) {
      const maj = { ...lab, equipements: [...lab.equipements, { id: equipement.id, role: '' }] };
      ecrireEntreesJournal(entrees.map((x) => (x.id === lab.id ? maj : x)));
      if (etatJournal.brouillonId === lab.id) etatJournal.brouillon = structuredClone(maj);
      note += ` Ajouté au labo ${lab.reference}.`;
    }
  }
  etatInventaire = { ...etatInventaire, brouillon: structuredClone(equipement), erreurs: {}, modifie: false, nouveau: false, noteFiche: note };
  return equipement;
}

function brancherEquipement(view) {
  const form = view.querySelector('#iForm');
  form.addEventListener('input', () => { if (!etatInventaire.modifie) { etatInventaire.modifie = true; const n = view.querySelector('#iNoteFiche'); if (n && !n.textContent) n.textContent = 'Modifications non enregistrées.'; } });
  form.addEventListener('submit', (ev) => ev.preventDefault());
  form.addEventListener('change', (ev) => {
    if (!ev.target.matches('[data-i="systeme"],[data-i="type"]')) return;
    lireFormulaireEquipement(view); etatInventaire.modifie = true; dessinerEquipement(view); document.querySelector(`#${ev.target.id}`)?.focus();
  });
  form.addEventListener('click', (ev) => {
    const ajout = ev.target.closest('[data-iadd]'); const retrait = ev.target.closest('[data-idel]');
    if (!ajout && !retrait) return;
    lireFormulaireEquipement(view);
    const q = etatInventaire.brouillon;
    if (ajout) {
      const nom = ajout.dataset.iadd;
      q[nom].push(Object.fromEntries(TABLEAUX_EQUIPEMENT[nom].colonnes.map((c) => [c.id, ''])));
      etatInventaire.modifie = true; dessinerEquipement(view);
      document.querySelector(`[data-it="${nom}"][data-row="${q[nom].length - 1}"]`)?.focus();
    } else {
      q[retrait.dataset.idel].splice(Number(retrait.dataset.row), 1);
      etatInventaire.erreurs = {}; etatInventaire.modifie = true; dessinerEquipement(view);
      document.querySelector(`[data-iadd="${retrait.dataset.idel}"]`)?.focus();
    }
  });
  view.querySelector('#iEnregistrer').addEventListener('click', () => { if (enregistrerEquipement(view)) { dessinerEquipement(view); document.querySelector('#iEnregistrer')?.focus(); } });
  view.querySelector('#iRetour')?.addEventListener('click', (ev) => {
    if (!etatInventaire.modifie) return;
    if (!enregistrerEquipement(view)) ev.preventDefault();
  });
  view.querySelector('#iSupprimer').addEventListener('click', () => { lireFormulaireEquipement(view); etatInventaire.confirmerSuppression = true; dessinerEquipement(view); document.querySelector('#iSupprimerNon')?.focus(); });
  view.querySelector('#iSupprimerNon')?.addEventListener('click', () => { etatInventaire.confirmerSuppression = false; dessinerEquipement(view); document.querySelector('#iSupprimer')?.focus(); });
  view.querySelector('#iSupprimerOui')?.addEventListener('click', () => {
    const id = etatInventaire.brouillonId; const retour = etatInventaire.retour;
    ecrireEquipements(lireEquipements().filter((x) => x.id !== id));
    const entrees = lireEntreesJournal();
    const nomSupprime = lireEquipements().find((x) => x.id === id)?.nom ?? etatInventaire.brouillon?.nom ?? '';
    const detacher = (sch) => ({ ...sch, noeuds: sch.noeuds.map((n) => (n.equipementId === id ? { ...n, equipementId: null, nom: n.nom || nomSupprime } : n)) });
    const touche = (x) => x.equipements.some((l) => l.id === id) || x.schema.noeuds.some((n) => n.equipementId === id);
    if (entrees.some(touche)) ecrireEntreesJournal(entrees.map((x) => (touche(x) ? { ...x, equipements: x.equipements.filter((l) => l.id !== id), schema: detacher(x.schema) } : x)));
    if (etatJournal.brouillon) { etatJournal.brouillon.equipements = etatJournal.brouillon.equipements.filter((l) => l.id !== id); etatJournal.brouillon.schema = detacher(etatJournal.brouillon.schema); }
    etatInventaire = { ...etatInventaire, brouillonId: null, brouillon: null, note: 'Équipement supprimé.', retour: null };
    location.hash = retour ? routeEntreeJournal(retour.id) : ROUTE_INVENTAIRE;
  });
}

// ---------------------------------------------------------------------------
// Mes cours et TP · Mon laboratoire
// Aucun secret : le laboratoire n'a pas de champ de mot de passe ni de disque, la
// progression ne garde que des identifiants d'éléments, et une case cochée n'est
// jamais une preuve. Tout passe par un stockage protégé ; sans lui, l'écran
// fonctionne et dit que rien n'est conservé.
// ---------------------------------------------------------------------------
function contexteCours() {
  return {
    fiche: (id) => {
      const e = entreeParId(id);
      if (!e?.procedure) return null;
      return { titre: e.procedure.titre, etapes: e.procedure.methodes[0].etapes };
    },
    assistant: (id) => tools.find((t) => t.id === id)?.title ?? null,
  };
}

// Copie en mémoire : si le stockage est refusé, la case reste cochée pour la session (et l'écran le dit).
let progressionMemoire = null;
function lireProgression() {
  if (!progressionMemoire) progressionMemoire = normaliserProgression(lireObjet(CLE_PROGRESSION), COURS);
  return progressionMemoire;
}

function telechargerTexte(nom, texte, type) {
  enregistrerFichier(nom, texte, type).catch(() => {});
}

function renderCours() {
  const view = document.querySelector('#coursView');
  const ctx = contexteCours();
  const progression = lireProgression();
  if (!espace.coursId) {
    view.innerHTML = coursListeMarkup(platFiltre ? COURS.filter((c) => (c.plateformes ?? []).includes(platFiltre)) : COURS, progression, ctx, platFiltre);
    document.title = platFiltre ? `Mes cours ${platFiltre} — KJEMO IT Toolkit` : 'Mes cours et TP — KJEMO IT Toolkit';
  } else {
    const cours = COURS_PAR_ID.get(espace.coursId);
    if (!cours) { view.innerHTML = coursIntrouvableMarkup(); document.title = 'Cours introuvable — KJEMO IT Toolkit'; return; }
    // Le résumé pliable garde son état (ouvert/fermé) quand on coche un élément et que la page se redessine.
    const dejaVu = view.querySelector('#resume-cours');
    const resumeOuvert = espace.lettre === 'resume' || Boolean(dejaVu?.open);
    view.innerHTML = coursPageMarkup(cours, espace.lettre === 'resume' ? null : espace.lettre, progression, ctx, { resumeOuvert });
    if (espace.lettre === 'resume') view.querySelector('#resume-cours')?.scrollIntoView?.({ block: 'start' });
    document.title = `${cours.titre} — KJEMO IT Toolkit`;
    view.querySelectorAll('input[type="checkbox"][data-item]').forEach((c) => c.addEventListener('change', () => {
      const suite = basculer(lireProgression(), cours.id, c.dataset.item);
      progressionMemoire = suite;
      const ok = ecrireStockage(CLE_PROGRESSION, suite);
      if (!ok) c.title = 'Le stockage du navigateur est indisponible : cette case ne sera pas conservée.';
      renderCours();
      document.querySelector(`#item-${c.dataset.item.replace(/\./g, '-')}`)?.focus();
    }));
  }
  view.querySelector('#gabaritBtn')?.addEventListener('click', () => {
    telechargerTexte('gabarit-tp.json', `${JSON.stringify(GABARIT_TP, null, 2)}\n`, 'application/json;charset=utf-8');
  });
}

let etatLabo = { erreurs: {}, enregistre: false, csvTexte: null, csvErreurs: [], csvPret: false };

function csvParDefaut() { return texteEditeurModele(); }

function renderLabo() {
  const view = document.querySelector('#laboView');
  if (etatLabo.csvTexte === null) etatLabo.csvTexte = csvParDefaut();
  const { valeurs } = normaliserLabo(lireObjet(CLE_LABO));
  view.innerHTML = laboMarkup({ valeurs, erreurs: etatLabo.erreurs, csvTexte: etatLabo.csvTexte, csvErreurs: etatLabo.csvErreurs,
    csvPret: etatLabo.csvPret, enregistre: etatLabo.enregistre, stockageOk: stockageDisponible() });
  document.title = 'Mon laboratoire — KJEMO IT Toolkit';
  view.querySelector('#laboForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const brut = {};
    view.querySelectorAll('[data-labo]').forEach((i) => { brut[i.dataset.labo] = i.value; });
    const { valeurs: v, erreurs } = normaliserLabo(brut);
    // On enregistre ce qui est valide ; ce qui est refusé reste affiché avec sa raison.
    const ok = ecrireStockage(CLE_LABO, v);
    etatLabo = { ...etatLabo, erreurs, enregistre: ok && Object.keys(erreurs).length === 0 };
    renderLabo();
    document.querySelector('#laboNote')?.focus?.();
  });
  view.querySelector('#laboClear').addEventListener('click', () => {
    try { localStorage.removeItem(CLE_LABO); } catch { /* stockage indisponible : rien à effacer */ }
    etatLabo = { ...etatLabo, erreurs: {}, enregistre: false };
    renderLabo();
    document.querySelector('#laboClear')?.focus();
  });
  const verifier = () => {
    const texte = view.querySelector('#csvTexte').value;
    const r = lignesDepuisTexte(texte);
    const vide = r.lignes.length === 0 && r.erreurs.length === 0;
    etatLabo = { ...etatLabo, csvTexte: texte,
      csvErreurs: vide ? [{ ligne: 0, message: 'Aucune ligne de compte.' }] : r.erreurs,
      csvPret: !vide && r.erreurs.length === 0 && csvDepuisLignes(r.lignes) !== null };
    return r;
  };
  view.querySelector('#csvVerifier').addEventListener('click', () => {
    verifier(); renderLabo(); document.querySelector('#csvVerifier')?.focus();
  });
  view.querySelector('#csvTelecharger').addEventListener('click', () => {
    const r = verifier();
    if (!etatLabo.csvPret) { renderLabo(); document.querySelector('#csvTelecharger')?.focus(); return; }
    telechargerTexte('comptes_tp2_MODELE.csv', csvDepuisLignes(r.lignes), 'text/csv;charset=utf-8');
    renderLabo(); document.querySelector('#csvTelecharger')?.focus();
  });
}

/** Les entrées colorées de la barre latérale : l'état courant est annoncé (aria-current). */
function majNavEspaces() {
  const suffixe = platFiltre ? ` ${platFiltre}` : '';
  const libelles = { cours: platFiltre ? `Mes cours${suffixe}` : 'Mes cours et TP', memo: `Aide-mémoire${suffixe}`, catalogue: `Catalogue pro${suffixe}` };
  document.querySelectorAll('#espacesNav a').forEach((a) => {
    const l = libelles[a.dataset.espace]; const cible = a.querySelector('.nav-label');
    if (l && cible && cible.textContent !== l) cible.textContent = l;
  });
  const surAccueil = !espace && !currentTool && !currentTache && modeListe() === 'accueil';
  document.querySelectorAll('#espacesNav a').forEach((a) => {
    const e = a.dataset.espace;
    const actif = e === 'accueil' ? surAccueil : (espace?.type === e || (e === 'journal' && espace?.type === 'inventaire'));
    if (actif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    a.classList.toggle('active', actif);
  });
}

// ---------------------------------------------------------------------------
// Accueil à trois portes, aide-mémoire, catalogue professionnel (KJEMO-UX-ACCUEIL-01)
// ---------------------------------------------------------------------------
let liesCache = null;
const fichesLiees = () => (liesCache ??= new Set(COURS.flatMap((c) => [...fichesDuCours(c)])));
const platsDe = (id) => entreeParId(id)?.plateformes ?? [];
const optsMemo = (filtre = memoFiltre) => ({ filtre, plat: platFiltre, plateformesDe: platsDe, lies: fichesLiees(), nouveaux: idsNouveaux() });

function ligneMemo(id) {
  const e = entreeParId(id);
  if (!e) return null;
  return { id, titre: e.titre, resume: e.resume ?? '', effet: e.effet, plateformes: e.plateformes ?? [],
    assistant: !e.procedure && e.kind === 'assistant', route: e.procedure ? null : (e.route ?? null),
    nbEtapes: e.procedure?.methodes?.[0]?.etapes?.length ?? 0, nouveau: idsNouveaux().has(id), lieTp: fichesLiees().has(id) };
}
const sousAvecLignes = (sous) => sous.map((x) => ({ ...x, fiches: x.fiches.map(ligneMemo).filter(Boolean) })).filter((x) => x.fiches.length);
const compteMemoTotal = (filtre = 'tous') => MEMO_GROUPES.reduce((n, g) => n + compteGroupe(g, optsMemo(filtre)), 0);
const compteParFiltreMemo = () => Object.fromEntries(FILTRES_MEMO.map((f) => [f.id, compteMemoTotal(f.id)]));

function portesAccueilHtml() {
  const cours = COURS.find((c) => !platFiltre || (c.plateformes ?? []).includes(platFiltre)) ?? null;
  let tp = null;
  if (cours) {
    const prog = lireProgression();
    let faits = 0; let total = 0; let reprise = null;
    for (const q of cours.parcours) {
      const a = avancement(cours, q, prog);
      faits += a.faits; total += a.total;
      if (!reprise && a.faits < a.total) reprise = q.lettre;
    }
    tp = { titre: cours.titre, faits, total, href: routeParcours(cours.id, reprise) };
  }
  const memoCartes = MEMO_GROUPES.filter((g) => !platFiltre || compteGroupe(g, optsMemo('tous')) > 0)
    .map((g) => groupeCarteMarkup(g, compteGroupe(g, optsMemo('tous')), { nouveaux: compteGroupe(g, optsMemo('nouveau')) }));
  const catalogueTotal = ENTREES_LISTEES.filter((e) => compatiblePlateforme(e)).length;
  const statuts = platFiltre ? null : PLATEFORMES_FILTRE.map((p) => ({
    plat: p,
    cours: COURS.filter((c) => (c.plateformes ?? []).includes(p)).length,
    memo: MEMO_GROUPES.reduce((n, g) => n + compteGroupe(g, { ...optsMemo('tous'), plat: p }), 0),
    catalogue: ENTREES_LISTEES.filter((e) => compatiblePlateforme(e, p)).length,
  }));
  return portesAccueilMarkup({ tp, memoCartes, memoTotal: compteMemoTotal('tous'), catalogueTotal, hrefCours: ROUTE_COURS, hrefLabo: ROUTE_LABO, plat: platFiltre, statuts });
}

const BLOCS_CATALOGUE = [
  { titre: 'Windows : postes et serveurs', ids: ['poste-windows', 'analyse-disques', 'windows-server', 'imprimantes'] },
  { titre: 'Annuaire et stratégies', ids: ['active-directory', 'gpo'] },
  { titre: 'Réseau, Linux et cloud', ids: ['reseau', 'reseau-cisco', 'linux', 'azure-entra'] },
];

function donneesCatalogue() {
  const liste = ENTREES_LISTEES.filter((e) => compatiblePlateforme(e));
  const comptes = compteParCategorie(liste);
  const blocs = BLOCS_CATALOGUE.map((b) => ({
    titre: b.titre,
    domaines: b.ids.map((id) => CATEGORIES.find((c) => c.id === id)).filter(Boolean)
      .map((c) => ({ id: c.id, nom: c.name, icone: c.icon, sous: c.description, compte: comptes.get(c.name) ?? 0, route: routePortee({ domaineId: c.id }) })),
  })).filter((b) => b.domaines.length);
  return { blocs, plat: platFiltre, total: liste.length };
}

function renderPortes() {
  majNavEspaces();
  const view = document.querySelector('#portesView');
  if (espace.type === 'catalogue') {
    view.innerHTML = cataloguePageMarkup(donneesCatalogue());
    document.title = 'Catalogue professionnel — KJEMO IT Toolkit';
  } else {
    const g = espace.groupeId ? MEMO_PAR_ID.get(espace.groupeId) : null;
    const filtres = FILTRES_MEMO;
    const compteParFiltre = compteParFiltreMemo();
    if (g) {
      view.innerHTML = memoGroupePageMarkup({ g, sous: sousAvecLignes(filtrerGroupe(g, optsMemo())), filtre: memoFiltre, filtres, compteParFiltre, plat: platFiltre });
      document.title = `${g.titre} — Aide-mémoire — KJEMO IT Toolkit`;
    } else {
      const groupes = MEMO_GROUPES.map((x) => ({ g: x, compte: compteGroupe(x, optsMemo()),
        nouveaux: compteGroupe(x, optsMemo('nouveau')), sous: sousAvecLignes(filtrerGroupe(x, optsMemo())) }));
      view.innerHTML = memoPageMarkup({ groupes, filtre: memoFiltre, filtres, compteParFiltre, plat: platFiltre, total: compteParFiltre.tous });
      document.title = 'Aide-mémoire — KJEMO IT Toolkit';
    }
  }
  view.querySelectorAll('[data-memo-filtre]').forEach((b) => b.addEventListener('click', () => {
    memoFiltre = b.dataset.memoFiltre;
    renderPortes();
    view.querySelector(`[data-memo-filtre="${memoFiltre}"]`)?.focus();
  }));
  view.querySelectorAll('[data-memo-plat]').forEach((b) => b.addEventListener('click', () => {
    platFiltre = b.dataset.memoPlat || null;
    renderPortes();
    view.querySelector(`[data-memo-plat="${platFiltre ?? ''}"]`)?.focus();
  }));
  view.querySelector('#memoToutDeplier')?.addEventListener('click', () => view.querySelectorAll('details.groupe-bloc').forEach((d) => { d.open = true; }));
  view.querySelector('#memoToutReplier')?.addEventListener('click', () => view.querySelectorAll('details.groupe-bloc').forEach((d) => { d.open = false; }));
  view.querySelector('#filtreSortie')?.addEventListener('click', () => {
    platFiltre = null; renderPortes();
    view.querySelector('h1')?.setAttribute('tabindex', '-1'); view.querySelector('h1')?.focus();
  });
  view.querySelector('#memoSansFiltre')?.addEventListener('click', (ev) => {
    ev.preventDefault(); memoFiltre = 'tous'; platFiltre = null; renderPortes();
  });
}

/** Où mène Échap : toujours un seul pas en arrière, jamais hors de l'application. */
function routeParent() {
  if (espace?.type === 'memo') return espace.groupeId && MEMO_PAR_ID.has(espace.groupeId) ? ROUTE_MEMO : '#/';
  if (espace?.type === 'catalogue' || espace?.type === 'labo') return '#/';
  if (espace?.type === 'journal') return espace.id ? ROUTE_JOURNAL : '#/';
  if (espace?.type === 'inventaire') return espace.id ? ROUTE_INVENTAIRE : ROUTE_JOURNAL;
  if (espace?.type === 'cours') return espace.coursId ? ROUTE_COURS : '#/';
  if (currentTache) {
    if (contexteParcours) return routeParcours(contexteParcours.coursId, contexteParcours.lettre);
    const g = groupeDeFiche(currentTache.id);
    return g ? routeMemo(g.id) : null;
  }
  return null;
}

const enFiche = () => Boolean(currentTool || currentTache);
const modaleActive = () => Boolean(fond && enFiche());

/** Barre de la fenêtre : la croix est toujours en haut, même quand on a défilé. */
function barreModale(view) {
  if (!modaleActive()) return;
  view.insertAdjacentHTML('afterbegin', `<div class="modale-barre"><button type="button" class="modale-x" id="modaleFermer" aria-label="Fermer la fiche et revenir à la page">✕ Fermer</button>`
    + `<span class="modale-aide">Échap ferme la fiche : tu restes sur la même page.</span></div>`);
  view.querySelector('#modaleFermer')?.addEventListener('click', () => fermerModale());
}

/** Ferme la fenêtre : retour à la page d'origine, à la même place. */
function fermerModale() {
  if (!modaleActive()) return false;
  fermetureModale = true;
  declencheur = (currentTache ?? entreeParId(currentTool?.id))?.id ?? null;
  const cible = fond.hash || '#/';
  location.hash = cible;   // comme « Retour » : « Précédent » du navigateur rouvre la fiche
  return true;
}

function render() {
  renderNavigation();
  renderModeSelector();
  renderThemeSelector();
  document.body.dataset.mode = modeCourant();
  const fiche = enFiche();
  const modale = modaleActive();
  const vu = modale ? fond.espace : espace;           // la page visible (derrière la fenêtre, ou à la place)
  if (!fiche) { hashPage = location.hash || '#/'; fond = null; pasModale = 0; }
  document.querySelector('#home').hidden = Boolean(vu) || (fiche && !modale);
  document.querySelector('#toolView').hidden = !currentTool;
  document.querySelector('#taskView').hidden = !currentTache;
  const estPortes = vu?.type === 'memo' || vu?.type === 'catalogue';
  document.querySelector('#portesView').hidden = !estPortes;
  document.querySelector('#coursView').hidden = vu?.type !== 'cours';
  document.querySelector('#laboView').hidden = vu?.type !== 'labo';
  document.querySelector('#journalView').hidden = vu?.type !== 'journal' && vu?.type !== 'inventaire';
  for (const id of ['#toolView', '#taskView']) {
    const el = document.querySelector(id);
    const ici = modale && !el.hidden;
    el.classList.toggle('fiche-modale', ici);
    if (ici) { el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Fiche'); }
    else { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
  }
  const voile = document.querySelector('#modaleVoile');
  if (voile) voile.hidden = !modale;
  document.body.classList.toggle('modale-ouverte', modale);
  if (!currentTache) etapeAffichee = null;
  const versEtape = Boolean(etapeCible);   // montrerEtapeCible consomme etapeCible : on retient s'il faut défiler jusqu'à l'étape
  const restaurer = fermetureModale && !fiche;
  if (!fiche) fermetureModale = false;
  if (modale) { if (currentTool) renderTool(); else renderTache(); }   // la page de fond reste telle quelle
  else if (espace?.type === 'cours') renderCours();
  else if (espace?.type === 'labo') renderLabo();
  else if (espace?.type === 'journal') renderJournal();
  else if (espace?.type === 'inventaire') renderInventaire();
  else if (estPortes) renderPortes();
  else if (currentTool) renderTool(); else if (currentTache) renderTache(); else renderHome();
  if (modale) {
    const vue = document.querySelector(currentTool ? '#toolView' : '#taskView');
    if (!versEtape) vue.scrollTop = 0;
    if (!vue.dataset.focusFait || vue.dataset.focusFait !== (currentTache ?? currentTool).id) {
      vue.dataset.focusFait = (currentTache ?? currentTool).id;
      document.querySelector('#modaleFermer')?.focus({ preventScroll: true });
    }
  } else {
    document.querySelector('#taskView').dataset.focusFait = '';
    document.querySelector('#toolView').dataset.focusFait = '';
    if ((fiche || espace) && !versEtape && !restaurer) window.scrollTo?.({ top: 0 });
    if (restaurer && declencheur) {
      document.querySelector(`[href="#/tache/${declencheur}"], [href="#/outil/${declencheur}"], [data-tool="${declencheur}"]`)?.focus?.({ preventScroll: true });
      declencheur = null;
    }
  }
  majNavEspaces();
}

const champRecherche = document.querySelector('#search');
const boutonEffacer  = document.querySelector('#searchClear');

function majEffacer() {
  if (boutonEffacer) boutonEffacer.hidden = champRecherche.value.length === 0;
}

champRecherche.addEventListener('input', () => {
  majEffacer();
  if (!currentTool && !currentTache && !espace) renderHome();
});

if (boutonEffacer) {
  boutonEffacer.addEventListener('click', () => {
    champRecherche.value = '';
    majEffacer();
    champRecherche.focus();
    if (!currentTool && !currentTache && !espace) renderHome();
  });
}

// Échap vide la recherche sans quitter le champ
champRecherche.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && champRecherche.value) {
    ev.preventDefault();
    champRecherche.value = '';
    majEffacer();
    if (!currentTool && !currentTache && !espace) renderHome();
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
    ev.preventDefault();
    majMenu(false);
    boutonMenu.focus();
  }
});

// Échap = un pas en arrière (fiche → groupe ou parcours → page d'origine → accueil).
// Jamais dans un champ de saisie, ni quand Échap vient de fermer le menu.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape' || ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target?.tagName ?? '')) return;
  if (modaleActive()) { ev.preventDefault(); fermerModale(); return; }
  const cible = routeParent();
  if (cible) { ev.preventDefault(); location.hash = cible; }
});

// Fenêtre : un clic sur le fond la ferme (la barre latérale reste utilisable : thème, mode, navigation).
document.querySelector('#modaleVoile')?.addEventListener('click', () => fermerModale());
// Les liens « Retour à… » d'une fiche ouverte en fenêtre ferment simplement la fenêtre : la page d'origine est déjà derrière.
document.addEventListener('click', (ev) => {
  if (!modaleActive()) return;
  if (ev.target.closest?.('#retourMemo, #retourParcours')) { ev.preventDefault(); fermerModale(); }
});

// Tableau « Où en est chaque plateforme » : un clic règle le filtre sur cette plateforme.
document.addEventListener('click', (ev) => {
  const b = ev.target.closest?.('[data-plat-go]');
  if (!b) return;
  platFiltre = b.dataset.platGo; renderHome();
  document.querySelector('#platEntete, #portes')?.scrollIntoView?.({ block: 'start' });
});

// « Accueil » : depuis l'accueil lui-même (recherche, rubrique), le bouton remet tout à plat.
document.querySelectorAll('a[href="#/"][data-espace="accueil"], #accueilBtn').forEach((a) => a.addEventListener('click', (ev) => {
  fermerMenu?.();
  if (location.hash !== '#/' && location.hash !== '') return;   // navigation normale : hashchange fait le travail
  ev.preventDefault();
  vueAssistants = false; vueCatalogue = false; natureFiltre = null; selectedCategory = CAT_TOUT; familleSel = null; sujetSel = null;
  currentTool = null; currentTache = null; espace = null;
  champRecherche.value = ''; majEffacer();
  render();
}));

// Bouton Retour / Suivant du navigateur, et lien partagé collé dans la barre d'adresse
window.addEventListener('popstate', appliquerHash);
window.addEventListener('hashchange', appliquerHash);

// Ouvrir directement la fiche demandée par l'URL au chargement
const espaceInitial = espaceDepuisHash();
const tacheInitiale = espaceInitial ? null : tacheDepuisHash();
const outilInitial = espaceInitial ? null : outilDepuisHash();
if (espaceInitial) {
  espace = espaceInitial;
} else if (tacheInitiale) {
  const ctxInitial = contexteDepuisHash();
  currentTache = tacheInitiale;
  const methodeInitiale = tacheInitiale.procedure.methodes.find((m) => m.id === ctxInitial.methode) ?? tacheInitiale.procedure.methodes[0];
  methodeTache = methodeInitiale.id;
  contexteParcours = ctxInitial.depuis;
  etapeCible = ctxInitial.etape && ctxInitial.etape <= methodeInitiale.etapes.length ? ctxInitial.etape : null;
  vueLocale = etapeCible ? 'pas' : null;
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
