/**
 * vue-taches.mjs — UX-COMMANDES-PROCEDURES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * LE MARQUAGE DES FICHES TÂCHE ET DES LIGNES DE RÉSULTAT
 *
 * Des fonctions pures qui retournent du HTML : aucun DOM, aucun stockage, aucun
 * presse-papiers. app.js les appelle puis branche les événements. Séparer ainsi
 * le marquage du câblage permet au banc de le tester sous Node, et de vérifier
 * ce que l'écran montre sans lancer de navigateur.
 *
 * RÈGLES DE PRÉSENTATION
 *  - La couleur ne porte jamais seule l'information : chaque ton a un libellé
 *    et un symbole (instruction, résultat attendu, effet, danger).
 *  - L'invite d'un terminal (« Switch# », « $ », « PS> ») est affichée dans un
 *    <span aria-hidden> non sélectionnable ; elle n'est jamais copiée.
 *  - Un repère « ‹…› » signale une valeur manquante et désactive la copie.
 *  - Un « résultat attendu » décrit ce que la commande DOIT afficher d'après la
 *    documentation ; il n'affirme jamais qu'un essai a été fait.
 */

import { etiquetteSortie, extensionDe } from './plateforme.mjs';
import { EFFETS, METHODES, rendreMethode, categorieEtape, raisonRefus, raisonRefusCourte, LIBELLE_CATEGORIE } from './procedures.mjs';

/** Échappement HTML complet (guillemets inclus : le texte peut aller dans un attribut). */
export function esc(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

/** `**gras**` et `` `code` `` dans un texte rédigé à la main — après échappement. */
export function inline(texte) {
  return esc(texte)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

const ICONE_PLATEFORME = { Linux: '△', Windows: '▣', Cisco: '⇄', Azure: '☁', Multi: '◇' };
export function iconePlateforme(p) { return ICONE_PLATEFORME[p] ?? '○'; }

/** Pastille d'effet : symbole + libellé (la couleur vient du CSS, jamais seule). */
export function badgeEffet(effet) {
  const e = EFFETS[effet];
  if (!e) return '';
  return `<span class="effet effet-${e.id}" data-effet="${e.id}"><span class="effet-sym" aria-hidden="true">${e.symbole}</span> ${esc(e.label)}</span>`;
}

/**
 * Méthode(s) réellement proposées par une entrée — jamais le mot générique
 * « Script » : un assistant dit son langage (Script PowerShell, Script Bash,
 * Commandes Cisco IOS), une fiche liste ses méthodes, un scénario ses
 * équipements.
 */
export function libellesMethodes(entree) {
  if (entree.tool) return [etiquetteSortie(entree.tool)];
  const p = entree.procedure;
  const ids = [];
  for (const m of p.methodes) {
    const sous = m.id === 'scenario' ? (m.equipements ?? []).map((q) => q.methode) : [m.id];
    for (const id of sous) if (METHODES[id] && !ids.includes(id)) ids.push(id);
  }
  return ids.map((id) => METHODES[id].label);
}

export function methodeBadgesMarkup(entree) {
  return libellesMethodes(entree)
    .map((l) => `<span class="methode-badge" data-methode-badge>${esc(l)}</span>`).join('');
}

export const LIBELLE_KIND = { procedure: 'Procédure', scenario: 'Scénario', commande: 'Commande', assistant: 'Assistant complet' };
const LIBELLE_BOUTON = { procedure: 'Ouvrir la fiche', scenario: 'Ouvrir le scénario', commande: 'Voir la commande', assistant: 'Ouvrir l’assistant' };

/**
 * Une ligne de résultat compacte : titre, plateforme, type, une ligne de
 * description. Conserve .tool-card / h3 / .tag / .fav-toggle / .open-tool, que
 * la navigation clavier, les favoris et les tests historiques utilisent.
 */
export function ligneResultatMarkup(entree, { favori = false, motif = null } = {}) {
  const tag = entree.tool?.subcategory
    ? `${entree.categorie.toUpperCase()} · ${entree.tool.subcategory}`
    : entree.categorie.toUpperCase();
  const plat = entree.plateformes.map((p) => `<span class="plat" title="${esc(p)}"><span aria-hidden="true">${iconePlateforme(p)}</span> ${esc(p)}</span>`).join('');
  return `<article class="tool-card task-row kind-${entree.kind}" data-id="${esc(entree.id)}" data-kind="${entree.kind}" role="listitem">`
    + `<div class="task-main">`
    + `<span class="tag">${esc(tag)}</span>`
    + `<h3>${esc(entree.titre)}</h3>`
    + `<p class="task-desc">${esc(entree.resume)}</p>`
    + (motif ? `<p class="match-reason">Correspond au ${esc(motif)}</p>` : '')
    + `<div class="task-badges"><span class="kind kind-${entree.kind}">${LIBELLE_KIND[entree.kind]}</span>${plat}${methodeBadgesMarkup(entree)}${badgeEffet(entree.effet)}</div>`
    + `</div>`
    + `<div class="task-actions">`
    + `<button class="fav-toggle${favori ? ' is-fav' : ''}" type="button" aria-pressed="${favori}" title="${favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-label="${favori ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${esc(entree.titre)}">${favori ? '★' : '☆'}</button>`
    + `<button class="open-tool" type="button" aria-label="${LIBELLE_BOUTON[entree.kind]} : ${esc(entree.titre)}">${LIBELLE_BOUTON[entree.kind]} <span aria-hidden="true">→</span></button>`
    + `</div>`
    + `</article>`;
}

// ---------------------------------------------------------------------------
// Fiche tâche — UNE définition, DEUX vues
//
// La Vue rapide et le Pas à pas sont rendus par les mêmes fonctions, depuis le
// même résultat de rendreMethode : blocs de commandes, interactions, effets.
// Elles ne diffèrent que par ce qu'elles affichent AUTOUR des commandes.
// ---------------------------------------------------------------------------

export const VUES = [
  { id: 'rapide', label: 'Vue rapide', aide: 'Toute la procédure d’un coup d’œil' },
  { id: 'pas', label: 'Pas à pas', aide: 'Chaque étape expliquée' },
];

const ORDRE_EFFET = ['lecture', 'modification', 'interruption', 'destructif'];
const ICONE_EQUIPEMENT = { ios: '⇄', powershell: '▣', cmd: '▣', linux: '△', azure: '☁' };
const ICONE_CATEGORIE = { action: '▶', verification: '✔', persistance: '💾', dernier: '⚠' };

function lignesMarkup(lignes, methodeId) {
  const corps = lignes.map((l) => {
    const groupe = l.groupe ? `<span class="cmd-group" aria-hidden="true">${esc(l.groupe)}</span>` : '';
    const invite = l.invite ? `<span class="cmd-prompt" aria-hidden="true">${esc(l.invite)}</span>` : '';
    // Repères « ‹…› » mis en évidence : une valeur à renseigner, pas du texte à copier.
    const texte = esc(l.affichage).replace(/‹([^›]*)›/g, '<mark class="ph" title="À renseigner">‹$1›</mark>');
    const secret = l.secret ? '<span class="cmd-secret" aria-hidden="true">⌨ secret à saisir toi-même</span>' : '';
    return `${groupe}<span class="cmd-line">${invite}<span class="cmd-text">${texte}</span>${secret}</span>`;
  }).join('');
  return `<pre class="cmd-pre cmd-${methodeId}" tabindex="0" aria-label="Commande à copier"><code>${corps}</code></pre>`;
}

function interactionsMarkup(interactions) {
  if (!interactions?.length) return '';
  return `<ul class="interactions" aria-label="Interruptions : réponses à donner">${interactions.map((x) => `<li class="interaction${x.secret ? ' is-secret' : ''}"><span class="interaction-label"><span aria-hidden="true">⌨</span> ${x.secret ? 'À saisir sur l’équipement' : 'À l’invite'}</span> <span class="interaction-attend">« ${esc(x.attend)} »</span> <span class="interaction-reponse">→ ${inline(x.reponds)}</span></li>`).join('')}</ul>`;
}

/** Une étiquette de copie : bouton + indice. L'indice dit pourquoi la copie est refusée. */
function boutonCopie({ classe, data, libelle, bloque, indice, idIndice, court = false }) {
  return `<button type="button" class="${classe}${court ? ' is-compact' : ''}" ${data} ${bloque ? 'aria-disabled="true"' : ''}`
    + ` aria-describedby="${idIndice}"><span aria-hidden="true">⧉</span> ${libelle}</button>`
    + `<span class="copy-hint" id="${idIndice}" aria-live="polite">${esc(indice)}</span>`;
}

/**
 * Le bloc d'une étape : commande(s), interactions, mise en garde. Identique
 * dans les deux vues.
 */
function blocEtapeMarkup(etape, i, ctx, { compact }) {
  const rendu = etape.rendu;
  const methodeId = etape.equipement ? ctx.methodeDe(etape.equipement) : ctx.methodeId;
  if (!rendu) {
    return etape.actions ? `<ol class="gui-actions">${etape.actions.map((a) => `<li>${inline(a)}</li>`).join('')}</ol>` : '';
  }
  let corps = '';
  if (rendu.instances.length) {
    corps += rendu.instances.map((inst, k) => `<div class="cmd-block is-instance" data-step="${i}" data-inst="${k}">`
      + `<p class="instance-titre">${esc(inst.groupe)}</p>`
      + lignesMarkup(inst.lignes, methodeId)
      + `<div class="cmd-bar">${boutonCopie({ classe: 'copy-step', data: `data-step="${i}" data-inst="${k}"`, libelle: 'Copier', bloque: rendu.bloque, indice: rendu.bloque ? `À renseigner : ${rendu.manquants.map(ctx.libelle).join(', ')}.` : '', idIndice: `h-${i}-${k}`, court: compact })}</div></div>`).join('');
  } else {
    const manque = rendu.manquants.map(ctx.libelle);
    corps += `<div class="cmd-block" data-step="${i}">${lignesMarkup(rendu.lignes, methodeId)}`
      + `<div class="cmd-bar">${boutonCopie({ classe: 'copy-step', data: `data-step="${i}"`, libelle: 'Copier', bloque: rendu.bloque, indice: rendu.bloque ? `À renseigner pour copier : ${manque.join(', ')}.` : (rendu.interactif ? 'Copie la commande, puis réponds sur l’équipement (voir ci-dessous).' : ''), idIndice: `h-${i}`, court: compact })}</div></div>`;
  }
  corps += interactionsMarkup(etape.interactions);
  if (etape.important) {
    const danger = etape.effet === 'destructif';
    corps += `<p class="step-important ${danger ? 'is-danger' : ''}" role="note"><span class="step-important-label"><span aria-hidden="true">${danger ? '✖' : '⚠'}</span> ${danger ? 'À savoir avant de lancer' : 'Important'}</span> ${inline(etape.important)}</p>`;
  }
  return corps;
}

function etiquettesEtape(etape) {
  return [
    etape.verification ? '<span class="step-flag flag-verif"><span aria-hidden="true">✔</span> Vérification</span>' : '',
    etape.facultatif ? '<span class="step-flag flag-fac">Facultatif</span>' : '',
    etape.dernierRecours ? '<span class="step-flag flag-dernier"><span aria-hidden="true">⚠</span> Dernier recours</span>' : '',
  ].join('');
}

function attenduMarkup(etape) {
  return etape.attendu
    ? `<p class="step-attendu"><span class="step-attendu-label"><span aria-hidden="true">✔</span> Résultat attendu</span> ${inline(etape.attendu)}</p>`
    : '';
}

/** En-tête d'une phase : titre, équipement, effet le plus fort, copie du bloc. */
function enteteIPhase(ph, rendu, ctx, { rapide = false } = {}) {
  const effet = ph.indices.map((i) => rendu.etapes[i].effet ?? 'lecture')
    .reduce((a, b) => (ORDRE_EFFET.indexOf(b) > ORDRE_EFFET.indexOf(a) ? b : a), 'lecture');
  const eq = ph.equipement ? ctx.equipement(ph.equipement) : null;
  const nbCmd = ph.indices.filter((i) => rendu.etapes[i].rendu).length;
  // Vue rapide : un bloc dont la copie unique serait trompeuse n'affiche pas de bouton désactivé,
  // seulement la raison en quelques mots ; chaque segment garde son propre bouton.
  const refusSansBouton = rapide && ph.texte === null && ph.raison && ph.raison !== 'manquants';
  const noteRefus = refusSansBouton ? `<span class="phase-copy-note">${esc(({ interactif: '⏸ copie par segment', entrecoupee: 'copie par bloc', 'plusieurs-machines': 'une copie par machine', 'plusieurs-equipements': 'pas de copie unique' })[ph.raison] ?? raisonRefusCourte(ph.raison))}</span>` : '';
  const copie = refusSansBouton ? '' : nbCmd >= 2 || ph.equipement
    ? boutonCopie({ classe: 'copy-phase', data: `data-phase="${ph.numero}"`, libelle: 'Copier ce bloc', bloque: ph.texte === null,
      indice: ph.texte === null ? (rapide ? raisonRefusCourte(ph.raison) : raisonRefus(ph.raison)) : '', idIndice: `hp-${ph.numero}`, court: true })
    : '';
  // Vue rapide : l'icône et le titre disent déjà « vérifier » ; seule la sauvegarde garde une pastille.
  const chipCat = (ph.categorie === 'action' || (rapide && ph.categorie !== 'persistance')) ? '' : `<span class="phase-cat cat-${ph.categorie}">${esc(LIBELLE_CATEGORIE[ph.categorie])}</span>`;
  return `<header class="phase-head">`
    + `<h3 class="phase-title"><span class="phase-icone" aria-hidden="true">${ICONE_CATEGORIE[ph.categorie]}</span> ${esc(ph.titre)}`
    + `<span class="sr-only"> — ${esc(LIBELLE_CATEGORIE[ph.categorie])}</span></h3>`
    + (eq ? `<span class="eq-chip eq-${esc(eq.methode)}"><span aria-hidden="true">${ICONE_EQUIPEMENT[eq.methode] ?? '○'}</span> ${esc(eq.label)}</span>` : '')
    + chipCat
    + (rapide && effet === 'lecture' ? '' : badgeEffet(effet))
    + noteRefus
    + (copie ? `<span class="phase-copy">${copie}</span>` : '')
    + `</header>`;
}

function etapeRapide(etape, i, ctx) {
  const verif = etape.verification === true;
  const cls = ['qstep', `step-${etape.effet ?? 'lecture'}`, verif ? 'step-verif' : '', etape.facultatif ? 'step-facultative' : '', etape.dernierRecours ? 'step-dernier' : ''].filter(Boolean).join(' ');
  return `<li class="${cls}" data-step="${i}" data-effet="${esc(etape.effet ?? 'lecture')}">`
    + `<p class="qstep-head"><span class="qstep-titre">${esc(etape.titre)}</span>`
    + (etape.mode ? ` <span class="qstep-mode">${esc(etape.mode)}</span>` : '')
    + etiquettesEtape(etape) + `</p>`
    + blocEtapeMarkup(etape, i, ctx, { compact: true })
    + `</li>`;
}

function etapePas(etape, i, numero, ctx) {
  const verif = etape.verification === true;
  const cls = ['step', `step-${etape.effet ?? 'lecture'}`, verif ? 'step-verif' : '', etape.facultatif ? 'step-facultative' : '', etape.dernierRecours ? 'step-dernier' : ''].filter(Boolean).join(' ');
  return `<li class="${cls}" id="etape-${numero}" data-step="${i}" data-effet="${esc(etape.effet ?? 'lecture')}">`
    + `<div class="step-head"><span class="step-num" aria-hidden="true">${numero}</span>`
    + `<h4 class="step-title"><span class="sr-only">Étape ${numero} : </span>${esc(etape.titre)}</h4>`
    + `${etiquettesEtape(etape)}${etape.effet ? badgeEffet(etape.effet) : ''}</div>`
    + `<div class="step-body"><p class="step-expl">${inline(etape.explication)}</p>`
    + (etape.mode ? `<p class="step-mode"><span class="step-mode-label">Mode attendu</span> ${esc(etape.mode)}</p>` : '')
    + blocEtapeMarkup(etape, i, ctx, { compact: false })
    + attenduMarkup(etape)
    + `</div></li>`;
}

function contexte(procedure, methode) {
  const parId = {};
  for (const p of procedure.params ?? []) {
    parId[p.id] = p.label;
    for (const c of p.colonnes ?? []) if (!parId[c.id]) parId[c.id] = c.label;
  }
  return {
    methodeId: methode.id,
    equipement: (id) => (methode.equipements ?? []).find((q) => q.id === id) ?? null,
    methodeDe: (id) => (methode.equipements ?? []).find((q) => q.id === id)?.methode ?? methode.id,
    libelle: (id) => parId[id] ?? id,
  };
}

/** Barre d'équipements (scénario) ou de séquence (procédure à un seul équipement). */
function barreCopieMarkup(procedure, methode, rendu, ctx, { rapide = false } = {}) {
  if (methode.equipements) {
    const cartes = rendu.parEquipement.map((q) => {
      const eq = ctx.equipement(q.id);
      return `<div class="eq-card eq-${esc(eq.methode)}" data-eq="${esc(q.id)}">`
        + `<h3 class="eq-title"><span aria-hidden="true">${ICONE_EQUIPEMENT[eq.methode] ?? '○'}</span> ${esc(eq.label)}</h3>`
        + (eq.privileges ? `<p class="eq-priv">${esc(eq.privileges)}</p>` : '')
        + boutonCopie({ classe: 'secondary-button copy-eq', data: `data-eq="${esc(q.id)}"`, libelle: 'Copier la séquence de cet équipement', bloque: q.texte === null,
          indice: q.texte === null ? (rapide ? raisonRefusCourte(q.raison) : raisonRefus(q.raison)) : 'Étapes facultatives exclues.', idIndice: `he-${esc(q.id)}`, court: true })
        + `</div>`;
    }).join('');
    return `<div class="eq-bar" role="group" aria-label="Équipements">${cartes}</div>`;
  }
  const copiables = rendu.etapes.filter((e) => e.rendu && !e.facultatif && !e.dernierRecours);
  if (methode.id === 'gui' || methode.copieSequence === false || copiables.length < 2) return '';
  const pret = rendu.texteComplet !== null;
  const indice = pret ? 'Les étapes facultatives et le dernier recours ne sont pas inclus.' : (rapide ? raisonRefusCourte(rendu.raisonComplet) : raisonRefus(rendu.raisonComplet));
  return `<div class="sequence-bar">${boutonCopie({ classe: 'secondary-button copy-all', data: 'id="copyAll"', libelle: 'Copier toutes les commandes', bloque: !pret, indice, idIndice: 'copyAllHint' })}</div>`;
}

/** Le code d'un ensemble de lignes (sans le <pre> qui l'entoure). */
function lignesCode(lignes) {
  return lignes.map((l) => {
    const groupe = l.groupe ? `<span class="cmd-group" aria-hidden="true">${esc(l.groupe)}</span>` : '';
    const invite = l.invite ? `<span class="cmd-prompt" aria-hidden="true">${esc(l.invite)}</span>` : '';
    const texte = esc(l.affichage).replace(/‹([^›]*)›/g, '<mark class="ph" title="À renseigner">‹$1›</mark>');
    const secret = l.secret ? '<span class="cmd-secret" aria-hidden="true">⌨ secret à saisir toi-même</span>' : '';
    return `${groupe}<span class="cmd-line">${invite}<span class="cmd-text">${texte}</span>${secret}</span>`;
  }).join('');
}

/**
 * Découpe une phase en SEGMENTS : une suite d'étapes consécutives copiables d'un
 * seul geste. Un segment s'arrête APRÈS une étape interactive (la commande qui
 * s'interrompt est la dernière du segment : ce qui suit attend la réponse) ; une
 * étape facultative, un dernier recours ou une étape multi-machines reste seule.
 * L'ordre des commandes n'est JAMAIS modifié.
 */
function segmentsDePhase(ph, rendu) {
  const segments = [];
  let courant = null;
  const fermer = () => { if (courant) segments.push(courant); courant = null; };
  for (const i of ph.indices) {
    const e = rendu.etapes[i];
    if (!e.rendu) { fermer(); segments.push({ type: 'gui', indices: [i] }); continue; }
    if (e.rendu.instances.length) { fermer(); segments.push({ type: 'instances', indices: [i] }); continue; }
    const cle = `${Boolean(e.facultatif)}|${Boolean(e.dernierRecours)}`;
    if (courant && courant.cle !== cle) fermer();
    if (!courant) courant = { type: 'bloc', cle, indices: [] };
    courant.indices.push(i);
    if (e.rendu.interactif) fermer();
  }
  fermer();
  return segments;
}

function segmentMarkup(seg, rendu, ctx, { boutonSegment, numeros }) {
  const etapes = seg.indices.map((i) => rendu.etapes[i]);
  const premier = etapes[0];
  if (seg.type === 'gui') return blocEtapeMarkup(premier, seg.indices[0], ctx, { compact: true });
  if (seg.type === 'instances') {
    return `<p class="seg-titre">${numeros.get(seg.indices[0])}. ${esc(premier.titre)}${etiquettesEtape(premier)}</p>` + blocEtapeMarkup(premier, seg.indices[0], ctx, { compact: true });
  }
  const methodeId = premier.equipement ? ctx.methodeDe(premier.equipement) : ctx.methodeId;
  // Le numéro est celui du Pas à pas : les renvois « étape 3 » des textes restent exacts.
  const signale = true;
  const corps = etapes.map((e) => {
    const titre = signale
      ? `<span class="cmd-comment"><span class="cmd-comment-titre"># ${numeros.get(rendu.etapes.indexOf(e))}. ${esc(e.titre)}</span>${e.facultatif ? ' <span class="step-flag flag-fac">Facultatif</span>' : ''}${e.dernierRecours ? ' <span class="step-flag flag-dernier"><span aria-hidden="true">⚠</span> Dernier recours</span>' : ''}</span>`
      : '';
    return titre + lignesCode(e.rendu.lignes);
  }).join('');
  const manquants = [...new Set(etapes.flatMap((e) => e.rendu.manquants))];
  const bloque = manquants.length > 0;
  const dernier = etapes[etapes.length - 1];
  const interactif = etapes.some((e) => e.rendu.interactif);
  const idIndice = `hs-${seg.indices[0]}`;
  const bouton = boutonSegment
    ? boutonCopie({ classe: 'copy-seg', data: `data-steps="${seg.indices.join(',')}"`, libelle: 'Copier', bloque,
      indice: bloque ? `À renseigner : ${manquants.map(ctx.libelle).join(', ')}.` : '', idIndice, court: true })
    : '';
  const important = etapes.filter((e) => e.important);
  const notes = important.length
    ? `<ul class="phase-notes">${important.map((e) => {
      const danger = e.effet === 'destructif';
      return `<li class="step-important ${danger ? 'is-danger' : ''}" role="note"><span class="step-important-label"><span aria-hidden="true">${danger ? '✖' : '⚠'}</span> ${danger ? 'À savoir' : 'Important'}</span> <strong>${numeros.get(rendu.etapes.indexOf(e))}. ${esc(e.titre)}.</strong> ${inline(e.important)}</li>`;
    }).join('')}</ul>`
    : '';
  const pauses = etapes.map((e) => interactionsMarkup(e.interactions)).join('');
  // Les mises en garde passent AVANT les commandes : on les lit avant d'agir.
  return notes
    + `<div class="cmd-block cmd-seg${bouton ? ' has-btn' : ''}" data-steps="${seg.indices.join(',')}"><pre class="cmd-pre cmd-${methodeId}" tabindex="0" aria-label="Commandes à copier"><code>${corps}</code></pre>`
    + (bouton ? `<div class="cmd-bar">${bouton}</div>` : '') + `</div>`
    + pauses;
}

/**
 * Vue rapide : une carte par phase d'exécution (équipement ET phase, ordre réel),
 * des blocs continus de commandes, les précautions de la phase avant les
 * commandes, les pauses (réponse, secret) signalées en une ligne.
 */
function vueRapideMarkup(procedure, methode, rendu, ctx) {
  const numeros = new Map();
  let n = 0;
  for (const ph of rendu.phases) for (const i of ph.indices) numeros.set(i, ++n);
  const cartes = rendu.phases.map((ph) => {
    const segments = segmentsDePhase(ph, rendu);
    const nbBlocs = segments.filter((x) => x.type === 'bloc').length;
    const aBouton = ph.texte === null || nbBlocs > 1 || !(ph.indices.filter((i) => rendu.etapes[i].rendu).length >= 2 || ph.equipement);
    return `<section class="phase phase-${ph.categorie}" data-phase="${ph.numero}" aria-label="${esc(ph.titre)}">`
      + enteteIPhase(ph, rendu, ctx, { rapide: true })
      + segments.map((sg) => segmentMarkup(sg, rendu, ctx, { boutonSegment: aBouton, numeros })).join('')
      + `</section>`;
  }).join('');
  return `<div class="vue vue-rapide" data-vue="rapide">${cartes}</div>`;
}

/** Pas à pas : mêmes phases, étapes numérotées et expliquées. */
function vuePasMarkup(procedure, methode, rendu, ctx) {
  let n = 0;
  const cartes = rendu.phases.map((ph) => `<section class="phase phase-${ph.categorie}" data-phase="${ph.numero}" aria-label="${esc(ph.titre)}">`
    + enteteIPhase(ph, rendu, ctx)
    + `<ol class="steps" start="${n + 1}">${ph.indices.map((i) => etapePas(rendu.etapes[i], i, ++n, ctx)).join('')}</ol>`
    + `</section>`).join('');
  return `<div class="vue vue-pas" data-vue="pas">${cartes}</div>`;
}

// ---------------------------------------------------------------------------
// Paramètres : champs simples et tableaux
// ---------------------------------------------------------------------------

function champMarkup(p, saisies) {
  const id = `p-${p.id}`;
  return `<div class="param">`
    + `<label for="${id}">${esc(p.label.charAt(0).toUpperCase() + p.label.slice(1))}</label>`
    + `<input id="${id}" name="${esc(p.id)}" data-param="${esc(p.id)}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" `
    + `placeholder="Exemple : ${esc(p.exemple)}" value="${esc(saisies[p.id] ?? '')}" aria-describedby="${id}-aide ${id}-err">`
    + `<p class="param-aide" id="${id}-aide">${esc(p.aide ?? '')}</p>`
    + `<p class="param-err" id="${id}-err" role="alert"></p>`
    + `</div>`;
}

/** Les lignes d'un tableau telles qu'elles sont saisies (au moins `min` lignes vides). */
export function lignesSaisies(p, saisies) {
  const rows = Array.isArray(saisies[p.id]) ? saisies[p.id] : [];
  const min = p.min ?? 1;
  const sortie = rows.map((r) => ({ ...r }));
  while (sortie.length < min) sortie.push({});
  return sortie;
}

export function tableMarkup(p, saisies) {
  const rows = lignesSaisies(p, saisies);
  const max = p.max ?? 8; const min = p.min ?? 1;
  const entete = p.colonnes.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('');
  const corps = rows.map((r, i) => `<tr data-row="${i}">${p.colonnes.map((c) => {
    const id = `t-${p.id}-${i}-${c.id}`;
    return `<td data-label="${esc(c.label)}"><input id="${id}" class="cell" data-table="${esc(p.id)}" data-row="${i}" data-col="${esc(c.id)}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" `
      + `placeholder="${esc(c.exemple)}" value="${esc(r[c.id] ?? '')}" aria-label="${esc(c.label)}, ligne ${i + 1}"></td>`;
  }).join('')}<td class="row-actions"><button type="button" class="row-del" data-table="${esc(p.id)}" data-row="${i}" ${rows.length <= min ? 'aria-disabled="true"' : ''} aria-label="Supprimer la ligne ${i + 1}">✕</button></td></tr>`).join('');
  return `<div class="param param-table" data-table-wrap="${esc(p.id)}">`
    + `<p class="param-table-title" id="tt-${esc(p.id)}">${esc(p.label.charAt(0).toUpperCase() + p.label.slice(1))}</p>`
    + `<div class="table-scroll"><table class="plan" aria-labelledby="tt-${esc(p.id)}"><thead><tr>${entete}<th scope="col"><span class="sr-only">Supprimer</span></th></tr></thead><tbody>${corps}</tbody></table></div>`
    + `<div class="table-actions"><button type="button" class="secondary-button row-add" data-table="${esc(p.id)}" ${rows.length >= max ? 'aria-disabled="true"' : ''}>Ajouter une ligne</button>`
    + `<span class="params-note">${min} à ${max} lignes.</span></div>`
    + `<ul class="table-err" id="te-${esc(p.id)}" role="alert" aria-live="polite"></ul>`
    + `</div>`;
}

/** Formulaire de paramètres : peu de champs, exemple visible, jamais pré-rempli. */
export function formulaireMarkup(procedure, saisies = {}, methodeId = null) {
  // Un paramètre peut être réservé à certaines méthodes (`methodes: ['cmd']`) : on n'affiche pas un champ inutile.
  const params = (procedure.params ?? []).filter((x) => !x.methodes || !methodeId || x.methodes.includes(methodeId));
  if (!params.length) return '';
  const champs = params.map((p) => (p.type === 'table' ? tableMarkup(p, saisies) : champMarkup(p, saisies))).join('');
  return `<form class="params" id="paramsForm" novalidate aria-label="Tes valeurs">`
    + `<h2 class="params-title">Tes valeurs</h2>`
    + `<div class="params-grid">${champs}</div>`
    + `<div class="params-actions"><button type="button" class="secondary-button" id="exemplesBtn">Remplir avec des valeurs d’exemple</button>`
    + `<span class="params-note" id="exemplesNote" aria-live="polite"></span></div>`
    + `</form>`;
}

/** Les étapes d'une méthode, dans la vue choisie. */
export function etapesMarkup(procedure, methode, saisies, { vue = 'pas' } = {}) {
  const rendu = rendreMethode(methode, procedure.params ?? [], saisies);
  const ctx = contexte(procedure, methode);
  const barre = barreCopieMarkup(procedure, methode, rendu, ctx, { rapide: vue === 'rapide' });
  const liste = vue === 'rapide' ? vueRapideMarkup(procedure, methode, rendu, ctx) : vuePasMarkup(procedure, methode, rendu, ctx);
  return { html: `${barre}${liste}`, rendu };
}

function repliable(titre, contenu, { id, ouvert = false } = {}) {
  return `<details class="fold"${id ? ` id="${id}"` : ''}${ouvert ? ' open' : ''}><summary>${esc(titre)}</summary><div class="fold-body">${contenu}</div></details>`;
}

function hypothesesMarkup(p, { replie = false } = {}) {
  if (!p.hypotheses?.length) return '';
  if (replie) {
    return `<details class="hypotheses hypotheses-fold" aria-label="Hypothèses et topologie"><summary>Hypothèses et topologie du scénario (${p.hypotheses.length})</summary>`
      + `<ul>${p.hypotheses.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>`
      + (p.topologie ? `<p class="topologie"><span class="topologie-label">Topologie</span> ${esc(p.topologie)}</p>` : '')
      + `</details>`;
  }
  return `<section class="hypotheses" aria-label="Hypothèses et topologie">`
    + `<h2 class="hypotheses-title">Hypothèses du scénario</h2>`
    + `<ul>${p.hypotheses.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>`
    + (p.topologie ? `<p class="topologie"><span class="topologie-label">Topologie</span> ${esc(p.topologie)}</p>` : '')
    + `</section>`;
}

function selecteurVueMarkup(vue) {
  return `<div class="vue-switch" role="group" aria-label="Affichage de la procédure">${VUES.map((v) => `<button type="button" class="vue-option${v.id === vue ? ' is-selected' : ''}" id="vue-${v.id}" data-vue="${v.id}" aria-pressed="${v.id === vue}" title="${esc(v.aide)}">${esc(v.label)}</button>`).join('')}</div>`;
}

/** Page complète d'une fiche tâche (avant branchement des événements). */
export function tachePageMarkup(entree, { methodeId, vue = 'pas', saisies = {}, favori = false, assistantTitre = null, prete = false } = {}) {
  const p = entree.procedure;
  const methode = p.methodes.find((m) => m.id === methodeId) ?? p.methodes[0];
  const { html: etapes, rendu } = etapesMarkup(p, methode, saisies, { vue });
  const plateformes = entree.plateformes.map((x) => `<span class="plat"><span aria-hidden="true">${iconePlateforme(x)}</span> ${esc(x)}</span>`).join('');
  const scenario = p.kind === 'scenario';

  const onglets = p.methodes.length > 1
    ? `<div class="methods" role="tablist" aria-label="Méthode">${p.methodes.map((m) => {
      const actif = m.id === methode.id;
      return `<button type="button" role="tab" id="tab-${m.id}" class="method-tab${actif ? ' is-active' : ''}" aria-selected="${actif}" aria-controls="panneau-methode" tabindex="${actif ? 0 : -1}" data-methode="${m.id}">${esc(METHODES[m.id].label)}</button>`;
    }).join('')}</div>`
    : '';

  const options = methode.etapes.flatMap((e) => e.options ?? []);
  const comprendre = options.length
    ? repliable('Comprendre les commandes', `<dl class="opts">${options.map((o) => `<dt><code>${esc(o.option)}</code></dt><dd>${esc(o.explication)}</dd>`).join('')}</dl>`)
    : '';
  const depannage = methode.depannage?.length
    ? repliable('Dépanner', `<dl class="depannage">${methode.depannage.map((d) => `<dt>${inline(d.symptome)}</dt><dd><strong>Cause probable :</strong> ${inline(d.cause)}<br><strong>À faire :</strong> ${inline(d.action)}</dd>`).join('')}</dl>`)
    : '';
  const retour = methode.retour
    ? repliable('Retour en arrière', `<p>${inline(methode.retour)}</p>`)
    : '';
  const sources = repliable('Sources et limites de validation',
    `<ul class="sources">${p.sources.map((s) => `<li><a class="source-link" target="_blank" rel="noreferrer" href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')}</ul>`
    + `<p class="validation-note"><strong>Validation :</strong> ${esc(p.validation ?? 'Non précisée.')}</p>`
    + `<p class="validation-note">Les « résultats attendus » décrivent ce que la documentation annonce ; aucune de ces commandes n’a été exécutée par le Toolkit.</p>`);
  const assistant = p.assistant
    ? `<div class="assistant-link"><a class="primary-button as-link" id="assistantLink" href="#/outil/${esc(p.assistant)}">Assistant complet<span class="sr-only"> : ${esc(assistantTitre ?? p.assistant)}</span> <span aria-hidden="true">→</span></a>`
      + `<span class="assistant-link-note">Formulaire avec validations, script complet à copier ou télécharger${assistantTitre ? ` — ${esc(assistantTitre)}` : ''}.</span></div>`
    : '';
  const dossier = scenario
    ? `<div class="dossier-bar"><button type="button" class="secondary-button" id="dlDossier" ${prete ? '' : 'aria-disabled="true"'}>Télécharger le dossier (.md)</button>`
      + `<span class="copy-hint" id="dlDossierHint" aria-live="polite">${prete ? 'Plan et commandes par équipement, sans invite ni secret.' : 'Renseigne toutes les valeurs pour télécharger le dossier.'}</span></div>`
    : '';

  return `<div class="tache" data-id="${esc(p.id)}" data-vue="${vue}" data-nature="${esc(entree.kind)}">`
    + `<div class="tool-header"><button class="back-button" id="taskBack" type="button">← Retour</button>`
    + `<div class="tache-titre"><div class="tag">${esc(p.categorie.toUpperCase())} · ${esc(LIBELLE_KIND[entree.kind].toUpperCase())}</div>`
    + `<h1>${esc(p.titre)}</h1>`
    + `<div class="tache-meta">${plateformes}${p.methodes.length === 1 || scenario ? methodeBadgesMarkup(entree) : ''}${badgeEffet(p.effet)}<button class="fav-toggle${favori ? ' is-fav' : ''}" id="taskFav" type="button" aria-pressed="${favori}" aria-label="${favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${favori ? '★' : '☆'}</button></div>`
    + `</div></div>`
    + `<p class="tache-resume">${esc(p.resume)}</p>`
    + hypothesesMarkup(p, { replie: vue === 'rapide' })
    + `<div class="tache-controls">${selecteurVueMarkup(vue)}${onglets}</div>`
    + `<div id="panneau-methode" class="method-panel" role="${p.methodes.length > 1 ? 'tabpanel' : 'region'}" aria-label="${esc(METHODES[methode.id].label)}"${p.methodes.length > 1 ? ` aria-labelledby="tab-${methode.id}"` : ''}>`
    + (methode.privileges ? `<p class="privileges"><span class="privileges-label">Droits</span> ${inline(methode.privileges)}</p>` : '')
    + (methode.id === 'gui' ? '' : formulaireMarkup(p, saisies, methode.id))
    + `<div id="etapesZone">${etapes}</div>`
    + dossier
    + `</div>`
    + `<div class="folds">${comprendre}${depannage}${retour}${sources}</div>`
    + assistant
    + `</div>`;
}

/**
 * Résumé d'un script complet (assistant) : ce qu'il lit, modifie, produit, les
 * droits, l'effet essentiel. Dérivé des champs déjà présents sur l'outil.
 */
export function resumeScriptMarkup(lignes) {
  return `<dl class="script-resume" id="scriptResume">${lignes.map(([k, v, ton]) => `<div class="sr-row${ton ? ` sr-${ton}` : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}


/**
 * En-tête d'un assistant complet, construit avec les mêmes éléments que celui
 * d'une fiche : type, plateforme, langage de sortie, favori. L'effet n'est pas
 * répété ici : la pastille de risque de l'assistant le porte déjà.
 */
export function enteteAssistantMeta(entree, { favori = false } = {}) {
  const plateformes = entree.plateformes.map((x) => `<span class="plat"><span aria-hidden="true">${iconePlateforme(x)}</span> ${esc(x)}</span>`).join('');
  return `<div class="tache-meta" id="toolMeta">${plateformes}${methodeBadgesMarkup(entree)}`
    + `<button class="fav-toggle${favori ? ' is-fav' : ''}" id="toolFav" type="button" aria-pressed="${favori}" aria-label="${favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${favori ? '★' : '☆'}</button></div>`;
}

/** Lien réciproque : l'assistant renvoie vers ses versions courtes (fiche, commandes rapides). */
export function versionsCourtesMarkup({ procedures = [], commandes = [] }) {
  if (!procedures.length && !commandes.length) return '';
  const lien = (e) => `<a href="#/tache/${esc(e.id)}">${esc(e.titre)}</a>`;
  let h = '';
  if (procedures.length) {
    h += `<p class="fiche-rapide" id="ficheRapide">Version courte : ${procedures.map(lien).join(' · ')} — les commandes à copier, en vue rapide ou pas à pas, sans le formulaire ni le script complet.</p>`;
  }
  if (commandes.length) {
    h += `<p class="fiche-rapide" id="commandesLiees">${commandes.length > 1 ? 'Commandes rapides liées' : 'Commande rapide liée'} : ${commandes.map(lien).join(' · ')}.</p>`;
  }
  return h;
}
