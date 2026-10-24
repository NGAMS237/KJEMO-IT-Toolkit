/**
 * taches.mjs — UX-COMMANDES-PROCEDURES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * LE CATALOGUE UNIQUE ET LA RECHERCHE
 *
 * Trois sortes d'entrées se retrouvent dans une même liste :
 *
 *   procedure  fiche rédigée : étapes numérotées, plusieurs méthodes possibles
 *              (src: procedures-pilotes.mjs)
 *   commande   commande rapide existante (LOT 7), adaptée en fiche à une étape
 *              (src: commandes-*.mjs) — adaptée, jamais recopiée
 *   assistant  l'assistant complet existant, avec son formulaire et son script
 *              (src: les 211 outils) — n'ouvre PAS de fiche tâche
 *
 * Une fiche procédure qui prolonge un assistant (`assistant: '<id>'`) PLIE cet
 * assistant sous elle : la liste ne montre pas deux fois la même tâche. Les
 * assistants sans fiche restent listés tels quels, accessibles par leur route
 * historique `#/outil/<id>`.
 *
 * Ce module est PUR (aucun DOM) et testable sous Node.
 */

import { tools, searchFields } from './generators.mjs';
import { plateformeDe, estLectureSeule } from './plateforme.mjs';
import { PROCEDURES_PILOTES } from './procedures-pilotes.mjs';
import { PROCEDURES_VAGUE2 } from './procedures-vague2.mjs';
import { PROCEDURES_VAGUE3 } from './procedures-vague3.mjs';
import { SCENARIOS } from './scenarios.mjs';
import { commandesReseau } from './commandes-reseau.mjs';
import { commandesServices } from './commandes-services.mjs';
import { commandesStockage } from './commandes-stockage.mjs';
import { commandesPermissions } from './commandes-permissions.mjs';
import { commandesSsh } from './commandes-ssh.mjs';
import { commandesCockpit } from './commandes-cockpit.mjs';
import { commandesSamba } from './commandes-samba.mjs';
import { commandesSambaAd } from './commandes-samba-ad.mjs';
import { commandesNfs } from './commandes-nfs.mjs';

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export function norm(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'a', 'en', 'pour', 'sur', 'mon', 'ma', 'mes',
  'ce', 'cette', 'et', 'ou', 'comment', 'quel', 'quelle', 'quels', 'quelles', 'est', 'sont', 'au', 'aux',
  'avec', 'sans', 'dans', 'par', 'que', 'qui', 'je', 'tu', 'il', 'on', 'veux', 'voudrais', 'faire', 's', 'n', 't',
  'ca', 'se', 'si', 'the', 'a', 'to', 'of',
]);

/** Groupes de synonymes (mots déjà normalisés). Un mot appartient à un groupe au plus. */
const GROUPES = [
  ['creer', 'creation', 'cree', 'ajouter', 'ajout', 'nouveau', 'nouvelle', 'add', 'create', 'new', 'definir'],
  ['supprimer', 'suppression', 'effacer', 'retirer', 'enlever', 'delete', 'remove', 'rm'],
  ['vider', 'purger', 'purge', 'flush', 'clear', 'reinitialiser', 'vide'],
  ['voir', 'afficher', 'lister', 'liste', 'consulter', 'lire', 'show', 'list', 'view', 'get', 'montrer', 'visualiser'],
  ['etat', 'statut', 'status', 'state'],
  ['redemarrer', 'relancer', 'restart', 'redemarrage', 'relance'],
  ['demarrer', 'lancer', 'start'],
  ['arreter', 'stopper', 'stop'],
  ['bloquer', 'bloque', 'bloquee', 'coincer', 'coince', 'coincee', 'stuck', 'figee', 'figer'],
  ['imprimante', 'imprimer', 'impression', 'printer', 'print', 'spouleur', 'spooler', 'cups'],
  ['sauvegarder', 'sauvegarde', 'enregistrer', 'enregistrement', 'save', 'backup'],
  ['reseau', 'network', 'net'],
  ['adresse', 'address', 'addr'],
  ['passerelle', 'gateway', 'routeur', 'route'],
  ['service', 'daemon', 'systemctl', 'unite', 'unit'],
  ['droit', 'droits', 'permission', 'permissions', 'chmod', 'acl'],
  ['utilisateur', 'user', 'compte', 'account'],
  ['dossier', 'repertoire', 'directory', 'folder'],
  ['journal', 'log', 'logs', 'journalctl'],
  ['espace', 'disque', 'stockage', 'disk', 'df', 'storage'],
  ['changer', 'modifier', 'edit', 'change', 'configurer', 'config', 'configuration'],
  ['affecter', 'assigner', 'attribuer', 'mettre', 'assign'],
];
const GROUPE_DE = new Map();
GROUPES.forEach((g, i) => g.forEach((m) => { if (!GROUPE_DE.has(m)) GROUPE_DE.set(m, i); }));

/** Mots qui désignent une plateforme : ils orientent le classement, sans être exigés dans le texte. */
const PLATEFORME_DES_MOTS = {
  linux: 'Linux', ubuntu: 'Linux', debian: 'Linux', bash: 'Linux', systemd: 'Linux', sudo: 'Linux',
  windows: 'Windows', powershell: 'Windows', cmd: 'Windows', win: 'Windows',
  cisco: 'Cisco', ios: 'Cisco', switch: 'Cisco', commutateur: 'Cisco',
  azure: 'Azure', entra: 'Azure',
};

function racine(m) {
  if (m.length > 4 && /(es|s|x)$/.test(m)) return m.replace(/(es|s|x)$/, '');
  if (m.length > 5 && /(er|ee|e)$/.test(m)) return m.replace(/(er|ee|e)$/, '');
  return m;
}

/** Jetons de requête : { brut, racine, groupe, plateforme }. */
export function jetonsDe(requete) {
  return norm(requete).split(' ').filter((m) => m && !MOTS_VIDES.has(m)).map((m) => ({
    brut: m,
    racine: racine(m),
    groupe: GROUPE_DE.has(m) ? GROUPE_DE.get(m) : null,
    plateforme: PLATEFORME_DES_MOTS[m] ?? null,
  }));
}

/** Qualité de correspondance d'un jeton contre un mot indexé : 0 à 1. */
function qualite(jeton, mot, groupeMot) {
  if (mot === jeton.brut) return 1;
  if (jeton.groupe !== null && groupeMot === jeton.groupe) return 0.8;
  if (jeton.brut.length >= 3 && mot.startsWith(jeton.brut)) return 0.75;
  if (jeton.racine.length >= 3 && racine(mot) === jeton.racine) return 0.7;
  if (jeton.brut.length >= 4 && mot.includes(jeton.brut)) return 0.4;
  return 0;
}

// ---------------------------------------------------------------------------
// Entrées du catalogue
// ---------------------------------------------------------------------------

const PLAT_DE_METHODE = { linux: 'Linux', powershell: 'Windows', cmd: 'Windows', ios: 'Cisco', azure: 'Azure', gui: null, scenario: null };

/** Plateformes d'une procédure, d'après ses méthodes (sans doublon, sans « graphique »). */
export function plateformesDeProcedure(p) {
  const vues = [];
  for (const m of p.methodes) {
    // Un scénario tient ses plateformes de ses équipements (ios → Cisco, powershell → Windows…).
    const ids = m.id === 'scenario' ? (m.equipements ?? []).map((q) => q.methode) : [m.id];
    for (const id of ids) {
      const pl = PLAT_DE_METHODE[id];
      if (pl && !vues.includes(pl)) vues.push(pl);
    }
  }
  return vues.length ? vues : ['Windows'];
}

function motsDeCommande(lignes) {
  // Les noms de commandes : premier mot de chaque ligne (hors sudo), sans paramètres.
  const out = new Set();
  for (const l of lignes) {
    const mots = String(l).replace(/\{\{[^}]*\}\}/g, ' ').trim().split(/\s+/);
    const premier = mots[0] === 'sudo' ? mots[1] : mots[0];
    if (premier) out.add(premier);
    if (mots.length > 1 && /^[a-z][a-z-]+$/.test(mots[1] ?? '')) out.add(`${premier} ${mots[1]}`);
  }
  return [...out];
}

function entreeProcedure(p) {
  const lignes = p.methodes.flatMap((m) => (m.etapes ?? []).flatMap((e) => (e.lignes ?? []).map((l) => l.cmd)));
  return {
    id: p.id,
    kind: p.kind === 'scenario' ? 'scenario' : 'procedure',
    titre: p.titre,
    categorie: p.categorie,
    plateformes: plateformesDeProcedure(p),
    effet: p.effet,
    resume: p.resume,
    intentions: p.intentions,
    motsCles: p.motsCles ?? [],
    commandes: motsDeCommande(lignes),
    doc: '',
    route: `#/tache/${p.id}`,
    assistant: p.assistant ?? null,
    procedure: p,
  };
}

// --- Commandes rapides → fiche à une étape ---------------------------------

const GROUPES_CR = [commandesReseau, commandesServices, commandesStockage, commandesPermissions,
  commandesSsh, commandesCockpit, commandesSamba, commandesSambaAd, commandesNfs];

export const COMMANDES_RAPIDES = GROUPES_CR.flat();

const TYPE_DE_JETON = {
  UNITE: 'unite', PORT: 'port', NUMERO: 'entier',
};

/** « Voir l’état du LIEN de chaque interface : allumée… » → « Voir l’état du lien de chaque interface ». */
export function titreDepuisBesoin(besoin) {
  let t = String(besoin).split(/\s*:\s+/)[0].replace(/[.]+$/, '').trim();
  // Un titre est court : on coupe d'abord à la première virgule ou au premier
  // tiret cadratin, puis, à défaut, au dernier mot qui tient.
  if (t.length > 68) {
    const clause = t.split(/\s+[—–]\s+|,\s+/)[0];
    if (clause.length >= 20 && clause.length <= 68) t = clause;
  }
  if (t.length > 68) {
    const coupe = t.slice(0, 66);
    t = `${coupe.slice(0, coupe.lastIndexOf(' ') > 30 ? coupe.lastIndexOf(' ') : 66)}…`;
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const EFFET_DE_RISQUE = { lecture: 'lecture', reversible: 'modification', attention: 'modification', destructif: 'destructif' };

/** Adapte une commande rapide (LOT 7) au modèle de procédure. */
/** Rôle et exemple de chaque jeton, tels que déclarés ailleurs dans la bibliothèque. */
const JETONS_CONNUS = (() => {
  const m = new Map();
  for (const c of COMMANDES_RAPIDES) for (const p of c.parametres ?? []) if (!m.has(p.jeton)) m.set(p.jeton, p);
  return m;
})();

export function procedureDepuisCommandeRapide(c) {
  // Une commande de vérification peut employer un jeton que la commande
  // principale n'utilise pas : on le déclare d'après la bibliothèque existante.
  const declares = new Set((c.parametres ?? []).map((p) => p.jeton));
  const supplementaires = [...new Set(String(c.verification ?? '').match(/<[A-Z][A-Z0-9_]*>/g) ?? [])]
    .filter((j) => !declares.has(j)).map((j) => JETONS_CONNUS.get(j)).filter(Boolean);
  const params = [...(c.parametres ?? []), ...supplementaires].map((p) => {
    const nom = p.jeton.slice(1, -1);
    return {
      id: nom.toLowerCase(),
      label: nom.toLowerCase().replace(/_/g, ' '),
      type: TYPE_DE_JETON[nom] ?? 'arg',
      exemple: p.exemple,
      aide: p.role,
      ...(nom === 'NUMERO' ? { min: 1, max: 9999 } : {}),
    };
  });
  // Un repère en toutes lettres (« <un des fichiers trouvés> ») se copierait tel quel : on en fait un vrai paramètre.
  const LIBRES = { 'un des fichiers trouvés': { id: 'fichier', exemple: '/etc/passwd', aide: 'Un des chemins affichés par la commande précédente.' }, 'un des groupes listés': { id: 'groupe', exemple: 'sudo', aide: 'Un des noms de groupe affichés par la commande précédente.' } };
  for (const [texte, d] of Object.entries(LIBRES)) {
    if (String(c.verification ?? '').includes(`<${texte}>`) && !params.some((x) => x.id === d.id)) {
      params.push({ id: d.id, label: texte, type: 'arg', exemple: d.exemple, aide: d.aide });
    }
  }
  const modele = (s) => {
    let t = String(s).replace(/<([A-Z][A-Z0-9_]*)>/g, (_, n) => `{{${n.toLowerCase()}}}`);
    for (const [texte, d] of Object.entries(LIBRES)) t = t.replace(`<${texte}>`, `{{${d.id}}}`);
    return t;
  };
  const etapes = [{
    titre: 'Lancer la commande',
    effet: EFFET_DE_RISQUE[c.risque],
    explication: c.besoin,
    lignes: [{ invite: '$', cmd: modele(c.commande) }],
    attendu: c.resultat,
    options: c.options ?? [],
    ...(c.risque !== 'lecture' ? { important: c.retourArriere ? `Retour en arrière : ${c.retourArriere}` : (c.pourquoiPasDeRetour ?? undefined) } : {}),
  }];
  if (c.verification) {
    etapes.push({
      titre: 'Vérifier',
      effet: 'lecture',
      verification: true,
      explication: 'Confirme le résultat avec une seconde commande, en lecture seule.',
      lignes: [{ invite: '$', cmd: modele(c.verification) }],
      attendu: 'Cohérent avec le résultat attendu de l’étape 1.',
    });
  }
  const assistant = c.assistant ? tools.find((t) => t.id === c.assistant) : null;
  return {
    id: c.id,
    titre: titreDepuisBesoin(c.besoin),
    categorie: assistant?.category ?? 'Linux et services réseau',
    resume: c.besoin,
    effet: EFFET_DE_RISQUE[c.risque],
    intentions: [titreDepuisBesoin(c.besoin), c.besoin],
    motsCles: [c.notion, ...(c.parametres ?? []).map((p) => p.jeton.slice(1, -1).toLowerCase())],
    params,
    methodes: [{
      id: 'linux',
      privileges: /^\s*sudo\b/.test(c.commande) ? 'Administrateur : la commande utilise sudo.' : 'Utilisateur ordinaire, sauf mention contraire.',
      etapes,
      verification: [c.verification ? `Relis le résultat de : ${c.verification}` : c.resultat],
      retour: c.retourArriere ?? c.pourquoiPasDeRetour ?? null,
    }],
    assistant: c.assistant ?? null,
    sources: [{ label: 'Documentation de la commande', url: c.source }],
    validation: 'Commande rapide du LOT 7 : relue contre la page de manuel ; non exécutée sur une machine réelle.',
    origine: 'commande-rapide',
  };
}

function entreeCommande(c) {
  const p = procedureDepuisCommandeRapide(c);
  return {
    id: c.id,
    kind: 'commande',
    titre: p.titre,
    categorie: p.categorie,
    plateformes: ['Linux'],
    effet: p.effet,
    resume: c.besoin,
    intentions: [],
    motsCles: p.motsCles,
    commandes: motsDeCommande([c.commande]),
    doc: '',
    route: `#/tache/${c.id}`,
    assistant: c.assistant ?? null,
    procedure: p,
  };
}

// --- Assistants complets ---------------------------------------------------

function effetDeOutil(t) {
  if (estLectureSeule(t) || t.risk === 'diagnostic') return 'lecture';
  if (t.risk === 'destructive') return 'destructif';
  return 'modification';
}

function entreeAssistant(t) {
  const docs = searchFields(t).filter((f) => f.reason !== 'titre' && f.reason !== 'mot-clé').map((f) => f.text).join(' ');
  return {
    id: t.id,
    kind: 'assistant',
    titre: t.title,
    categorie: t.category,
    plateformes: [plateformeDe(t) === 'Multi' ? 'Windows' : plateformeDe(t)],
    effet: effetDeOutil(t),
    resume: t.summary,
    intentions: [],
    motsCles: t.keywords ?? [],
    commandes: [],
    doc: docs,
    route: `#/outil/${t.id}`,
    assistant: t.id,
    tool: t,
  };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/** Toutes les fiches rédigées à la main, pilotes puis seconde vague. */
export const PROCEDURES_REDIGEES = [...PROCEDURES_PILOTES, ...PROCEDURES_VAGUE2, ...PROCEDURES_VAGUE3, ...SCENARIOS];
const procedures = PROCEDURES_REDIGEES.map(entreeProcedure);
const commandes = COMMANDES_RAPIDES.map(entreeCommande);
const assistants = tools.map(entreeAssistant);

/** Assistants couverts par une fiche procédure : ils sont repliés sous elle. */
const ASSISTANTS_REPLIES = new Set(procedures.map((p) => p.assistant).filter(Boolean));

/** Toutes les entrées, sans rien replier : pour les contrôles de couverture. */
export const TOUTES_LES_ENTREES = [...procedures, ...commandes, ...assistants];

/** Entrées listées en recherche : un assistant couvert par une fiche n'est pas listé deux fois. */
export const ENTREES_LISTEES = [...procedures, ...commandes, ...assistants.filter((a) => !ASSISTANTS_REPLIES.has(a.id))];

const PAR_ID = new Map(TOUTES_LES_ENTREES.map((e) => [e.id, e]));
export function entreeParId(id) { return PAR_ID.get(id) ?? null; }
export function procedureParId(id) {
  const e = PAR_ID.get(id);
  return e && e.procedure ? e.procedure : null;
}
/** La fiche qui prolonge cet assistant, s'il y en a une. */
export function ficheDeAssistant(assistantId) {
  return procedures.find((p) => p.assistant === assistantId) ?? null;
}

/** Statistiques de couverture : pour le rapport et pour le banc. */
export function couverture() {
  const couverts = new Set();
  for (const e of [...procedures, ...commandes]) if (e.assistant) couverts.add(e.assistant);
  return {
    assistants: assistants.length,
    procedures: procedures.length,
    scenarios: procedures.filter((e) => e.kind === 'scenario').length,
    assistantsListes: ENTREES_LISTEES.filter((e) => e.kind === 'assistant').length,
    commandesRapides: commandes.length,
    assistantsAvecFiche: [...couverts].filter((id) => tools.some((t) => t.id === id)).length,
    assistantsSeuls: assistants.filter((a) => !couverts.has(a.id)).map((a) => a.id),
  };
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

const POIDS = { titre: 60, intention: 90, commande: 55, motCle: 40, categorie: 12, resume: 14, doc: 5 };
const RANG_KIND = { procedure: 3, scenario: 3, commande: 2, assistant: 0 };

function indexer(e) {
  if (e._index) return e._index;
  const champs = [
    { nom: 'titre', poids: POIDS.titre, texte: e.titre },
    { nom: 'motCle', poids: POIDS.motCle, texte: e.motsCles.join(' ') },
    { nom: 'commande', poids: POIDS.commande, texte: e.commandes.join(' ') },
    { nom: 'categorie', poids: POIDS.categorie, texte: e.categorie },
    { nom: 'resume', poids: POIDS.resume, texte: e.resume },
    { nom: 'doc', poids: POIDS.doc, texte: e.doc },
  ].map((c) => ({ ...c, mots: norm(c.texte).split(' ').filter(Boolean) }));
  const intentions = e.intentions.map((t) => ({ texte: norm(t), mots: norm(t).split(' ').filter((m) => !MOTS_VIDES.has(m)) }));
  const nTitre = norm(e.titre);
  e._index = { champs, intentions, nTitre };
  return e._index;
}

const MOTIFS = { titre: 'titre', intention: 'intention', commande: 'commande', motCle: 'mot-clé', categorie: 'catégorie', resume: 'description', doc: 'documentation' };

/**
 * Score d'une entrée pour une requête, ou null si elle ne correspond pas.
 * Les mots de plateforme (linux, windows, cisco…) ne sont pas exigés dans le
 * texte : ils favorisent leur plateforme et défavorisent les autres.
 */
function noter(e, jetons, requeteNorm) {
  const idx = indexer(e);
  const contenu = jetons.filter((j) => !j.plateforme);
  const plateformes = jetons.filter((j) => j.plateforme).map((j) => j.plateforme);
  let total = 0; let meilleur = null; let manquants = 0;

  for (const j of contenu) {
    let best = 0; let bestNom = null;
    for (const c of idx.champs) {
      for (const m of c.mots) {
        const q = qualite(j, m, GROUPE_DE.has(m) ? GROUPE_DE.get(m) : null);
        if (q * c.poids > best) { best = q * c.poids; bestNom = c.nom; }
      }
    }
    for (const it of idx.intentions) {
      for (const m of it.mots) {
        const q = qualite(j, m, GROUPE_DE.has(m) ? GROUPE_DE.get(m) : null);
        if (q * POIDS.intention > best) { best = q * POIDS.intention; bestNom = 'intention'; }
      }
    }
    if (best === 0) { manquants += 1; continue; }
    total += best;
    if (!meilleur || best > meilleur.best) meilleur = { best, nom: bestNom };
  }

  // ET logique : tout mot de contenu doit correspondre — sauf dans une phrase
  // longue (4 mots et plus), où un seul mot absent est toléré.
  const toleres = contenu.length >= 4 ? 1 : 0;
  if (manquants > toleres) return null;
  if (contenu.length && manquants === contenu.length) return null;

  // Phrase d'intention entièrement couverte : c'est LA tâche demandée.
  let bonus = 0;
  if (contenu.length) {
    for (const it of idx.intentions) {
      if (it.texte === requeteNorm) { bonus = Math.max(bonus, 400); continue; }
      const couvre = contenu.every((j) => it.mots.some((m) => qualite(j, m, GROUPE_DE.has(m) ? GROUPE_DE.get(m) : null) >= 0.7));
      if (couvre) bonus = Math.max(bonus, 120 + (it.mots.length <= contenu.length + 1 ? 40 : 0));
    }
    if (idx.nTitre === requeteNorm) bonus = Math.max(bonus, 400);
    const titreCouvre = contenu.every((j) => idx.champs[0].mots.some((m) => qualite(j, m, GROUPE_DE.has(m) ? GROUPE_DE.get(m) : null) >= 0.7));
    if (titreCouvre) bonus = Math.max(bonus, 100);
  }

  let score = total + bonus;
  if (plateformes.length) {
    const correspond = e.plateformes.some((p) => plateformes.includes(p));
    score = correspond ? score * 1.5 + 30 : score * 0.35;
  }
  score += RANG_KIND[e.kind] * 6;
  // Un assistant atteint seulement par sa documentation longue passe après le reste.
  if (meilleur && meilleur.nom === 'doc') score *= 0.5;
  return { entree: e, score, motif: MOTIFS[meilleur?.nom ?? 'resume'] ?? 'description', exacte: bonus >= 400 };
}

/**
 * Recherche. Options : categorie (nom exact ou « Tout »), plateforme, kinds,
 * limite. Une requête vide retourne les entrées filtrées, sans tri de
 * pertinence. Une requête dont seuls des mots de plateforme sont présents
 * retourne toute la plateforme.
 */
export function chercher(requete, { categorie = 'Tout', plateforme = null, kinds = null, liste = ENTREES_LISTEES } = {}) {
  const base = liste.filter((e) => (categorie === 'Tout' || e.categorie === categorie)
    && (!plateforme || e.plateformes.includes(plateforme))
    && (!kinds || kinds.includes(e.kind)));
  const jetons = jetonsDe(requete);
  if (!jetons.length) return base.map((entree) => ({ entree, score: 0, motif: null, exacte: false }));
  const requeteNorm = norm(requete);
  const seulementPlateforme = jetons.every((j) => j.plateforme);
  if (seulementPlateforme) {
    const voulues = jetons.map((j) => j.plateforme);
    return base.filter((e) => e.plateformes.some((p) => voulues.includes(p)))
      .sort((a, b) => RANG_KIND[b.kind] - RANG_KIND[a.kind] || a.titre.localeCompare(b.titre, 'fr'))
      .map((entree) => ({ entree, score: 1, motif: 'plateforme', exacte: false }));
  }
  const res = [];
  for (const e of base) {
    const r = noter(e, jetons, requeteNorm);
    if (r) res.push(r);
  }
  res.sort((a, b) => b.score - a.score || RANG_KIND[b.entree.kind] - RANG_KIND[a.entree.kind]
    || a.entree.titre.localeCompare(b.entree.titre, 'fr'));
  // Coupe la longue traîne : quand de vraies correspondances existent, une
  // entrée atteinte seulement par un mot de sa documentation (score très
  // inférieur au meilleur) n'est pas une réponse, c'est du bruit.
  if (res.length && res[0].score >= 100) {
    const seuil = res[0].score * 0.12;
    return res.filter((r) => r.score >= seuil);
  }
  return res;
}

/** Catégories avec leur nombre d'entrées listées, pour la grille compacte. */
export function compteParCategorie(liste = ENTREES_LISTEES) {
  const m = new Map();
  for (const e of liste) m.set(e.categorie, (m.get(e.categorie) ?? 0) + 1);
  return m;
}
