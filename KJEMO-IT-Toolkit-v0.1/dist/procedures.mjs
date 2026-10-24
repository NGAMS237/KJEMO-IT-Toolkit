/**
 * procedures.mjs — UX-COMMANDES-PROCEDURES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * LE MOTEUR DES FICHES « TÂCHE »
 *
 * Une fiche tâche répond à une question courte (« comment créer un VLAN ? »)
 * par des étapes numérotées, une commande par bloc, copiable telle quelle.
 * Ce module est PUR : aucun DOM, aucun stockage, aucune exécution. Il
 *   - déclare le modèle de données d'une procédure,
 *   - valide les paramètres (en réutilisant les validateurs existants),
 *   - rend le texte des commandes à partir des valeurs saisies,
 *   - décide si le bouton Copier est autorisé.
 *
 * ---------------------------------------------------------------------------
 * RÈGLES QUI COMMANDENT LE RESTE
 * ---------------------------------------------------------------------------
 * 1. Le texte COPIÉ n'est jamais lu dans le DOM : il est calculé ici. Ce que
 *    l'écran montre à côté (invite « Switch# », « $ », « PS> », numéros, mode
 *    attendu) n'entre donc jamais dans le presse-papiers.
 * 2. Tant qu'un paramètre requis est vide ou invalide, la commande affichée
 *    contient un repère « ‹libellé› » et la copie est REFUSÉE. Un repère ne
 *    se colle jamais dans une console.
 * 3. Les valeurs d'exemple sont des exemples, étiquetés comme tels. Elles ne
 *    remplissent jamais un champ à l'insu de la personne.
 * 4. Une étape qui modifie quelque chose le dit (effet), à côté de l'action.
 * 5. Rien n'est exécuté, rien n'est envoyé : ce module fabrique du texte.
 *
 * Ce module importe les validateurs existants ; il n'en réécrit aucun.
 */

import {
  validerVlanIos, validerNomVlanIos, validerInterfaceIos, validerListeVlansIos,
} from './validateurs-cisco.mjs';
import {
  validateNomUnite, validateCheminAbsolu, validatePortTcp, validateEntierBorne,
} from './validateurs-linux.mjs';
import { validateIPv4, validerFqdn, validerNomHote } from './validateurs.mjs';

// ---------------------------------------------------------------------------
// Vocabulaire
// ---------------------------------------------------------------------------

/**
 * Effet d'une étape ou d'une fiche. Quatre niveaux, chacun avec un libellé et
 * un symbole : la couleur ne porte JAMAIS seule l'information.
 */
export const EFFETS = {
  lecture:      { id: 'lecture',      label: 'Lecture seule',         symbole: '◉', ton: 'ok' },
  modification: { id: 'modification', label: 'Modification',          symbole: '✎', ton: 'attention' },
  interruption: { id: 'interruption', label: 'Interruption possible', symbole: '⚠', ton: 'attention' },
  destructif:   { id: 'destructif',   label: 'Destructif',            symbole: '✖', ton: 'danger' },
};

/** Méthodes d'une fiche : étiquette affichée, famille de coloration, copiable. */
export const METHODES = {
  linux:      { id: 'linux',      label: 'Linux / Bash',      invite: '$',  copiable: true },
  powershell: { id: 'powershell', label: 'PowerShell',        invite: 'PS>', copiable: true },
  cmd:        { id: 'cmd',        label: 'CMD',               invite: '>',  copiable: true },
  ios:        { id: 'ios',        label: 'Cisco IOS',         invite: null, copiable: true },
  azure:      { id: 'azure',      label: 'Azure CLI / PowerShell', invite: '$', copiable: true },
  gui:        { id: 'gui',        label: 'Interface graphique', invite: null, copiable: false },
  // Scénario multi-équipements : chaque étape porte l'équipement visé, et
  // chaque équipement déclare sa propre méthode (ios, powershell, linux…).
  scenario:   { id: 'scenario',   label: 'Scénario complet',  invite: null, copiable: true },
};

/** Méthodes qu'un équipement de scénario peut employer (une console, jamais l'interface graphique). */
export const METHODES_EQUIPEMENT = ['ios', 'powershell', 'cmd', 'linux', 'azure'];

export const REPERE_OUVRANT = '‹';
export const REPERE_FERMANT = '›';

// ---------------------------------------------------------------------------
// Types de paramètres
// ---------------------------------------------------------------------------

const CONTROLE = /[\u0000-\u001f\u007f]/;
const FAMILLES_ROUTEUR = { fa: 'FastEthernet', fastethernet: 'FastEthernet', gi: 'GigabitEthernet', gigabitethernet: 'GigabitEthernet', te: 'TenGigabitEthernet', tengigabitethernet: 'TenGigabitEthernet' };
// Caractères qui changeraient la nature d'une ligne collée dans un terminal.
const META_SHELL = /[;&|`$<>\\"'(){}!*?\[\]~#%^]/;

const ok = (valeur) => ({ ok: true, valeur: String(valeur) });
const ko = (error) => ({ ok: false, error });

function texteSimple(v, label, { max = 80, motif = null, meta = true } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return ko(`${label} est obligatoire.`);
  if (CONTROLE.test(s)) return ko(`${label} : aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).`);
  if (s.length > max) return ko(`${label} : ${max} caractères au plus.`);
  if (meta && META_SHELL.test(s)) {
    return ko(`${label} : caractères spéciaux refusés (; & | $ % ^ \` < > \\ " ' ( ) { } …) — ils changeraient la commande.`);
  }
  if (motif && !motif.test(s)) return ko(`${label} n'a pas le format attendu.`);
  return ok(s);
}

/**
 * Registre des validateurs de paramètres. Chaque entrée : (valeur, paramètre)
 * → { ok, valeur } | { ok:false, error }. Les types métier délèguent aux
 * validateurs existants du dépôt.
 */
export const TYPES_PARAM = {
  vlan:    (v, p) => adapter(validerVlanIos(v, { label: p.label })),
  nomVlan: (v) => adapter(validerNomVlanIos(v)),
  listeVlans: (v, p) => adapter(validerListeVlansIos(v, { label: p.label })),
  // 2960 numérote en deux nombres (Fa0/7), Catalyst 1000 / 9200 en trois (Gi1/0/7).
  interfaceIos: (v, p) => {
    const a = validerInterfaceIos(v, '2960', p.label);
    const b = a.ok ? a : validerInterfaceIos(v, 'pile', p.label);
    return adapter(b.ok ? b : a);
  },
  // Argument libre d'une commande rapide : espaces, « ~ », « / » admis ; tout ce
  // qui changerait la nature de la ligne (; & | $ ` < > \\ quotes parenthèses…) refusé.
  arg: (v, p) => {
    const s = String(v ?? '').trim();
    if (!s) return ko(`${p.label} est obligatoire.`);
    if (CONTROLE.test(s)) return ko(`${p.label} : aucun saut de ligne ni caractère de contrôle.`);
    if (s.length > 120) return ko(`${p.label} : 120 caractères au plus.`);
    if (s.startsWith('-')) return ko(`${p.label} ne doit pas commencer par « - » (la commande le prendrait pour une option).`);
    if (/[;&|`$<>\\"'(){}!*?\[\]#]/.test(s)) return ko(`${p.label} : caractères spéciaux refusés (; & | $ \` < > \\ " ' ( ) { } …).`);
    return ok(s);
  },
  // Interface d'un ROUTEUR : les numéros partent de 0 (Gi0/0, Gi0/0/0), contrairement
  // à un port de commutateur (numérotés à partir de 1).
  interfaceRouteur: (v, p) => {
    const t = String(v ?? '').trim();
    const m = /^([A-Za-z]+)(\d{1,2})\/(\d{1,2})(?:\/(\d{1,2}))?$/.exec(t);
    const fam = m && FAMILLES_ROUTEUR[m[1].toLowerCase()];
    if (!m || !fam) return ko(`${p.label} : une seule interface physique, au format Gi0/0, Gi0/0/0 ou Fa0/0 (ni sous-interface, ni plage).`);
    const nums = [m[2], m[3], m[4]].filter((x) => x !== undefined);
    if (nums.some((n) => n.length > 1 && n.startsWith('0'))) return ko(`${p.label} : pas de zéro de tête dans les numéros.`);
    return ok(`${fam}${nums.join('/')}`);
  },
  // Une liste de ports d'accès d'un commutateur : séparés par des virgules, sans doublon.
  listeInterfaces: (v, p) => {
    const s = String(v ?? '').trim();
    if (CONTROLE.test(s)) return ko(`${p.label} : aucun saut de ligne ni caractère de contrôle.`);
    const morceaux = s.split(/[,\s]+/).filter(Boolean);
    if (!morceaux.length) return ko(`${p.label} : au moins un port.`);
    if (morceaux.length > 8) return ko(`${p.label} : 8 ports au plus par VLAN dans cette fiche.`);
    const sortie = [];
    for (const m of morceaux) {
      const a = validerInterfaceIos(m, '2960', p.label);
      const b = a.ok ? a : validerInterfaceIos(m, 'pile', p.label);
      if (!b.ok) return ko(`${p.label} : « ${m} » — ${(a.error ?? '').replace(/^[^:]*:\s*/, '')}`);
      const norm = b.valeur ?? b.value;
      if (sortie.includes(norm)) return ko(`${p.label} : le port ${norm} figure deux fois.`);
      sortie.push(norm);
    }
    return ok(sortie.join(','));
  },
  prefixe: (v, p) => {
    const s = String(v ?? '').trim().replace(/^\//, '');
    if (!/^\d{1,2}$/.test(s) || Number(s) < 8 || Number(s) > 30) return ko(`${p.label} : un nombre de 8 à 30 (par exemple 24).`);
    return ok(String(Number(s)));
  },
  identifiant: (v, p) => texteSimple(v, p.label, { max: 80, motif: /^[A-Za-z0-9_.@-]+$/ }),
  ipv4:    (v, p) => adapter(validateIPv4(v)),
  hote:    (v) => adapter(validerNomHote(v)),
  fqdn:    (v) => adapter(validerFqdn(v)),
  unite:   (v, p) => adapter(validateNomUnite(v, p.label)),
  chemin:  (v, p) => {
    const r = adapter(validateCheminAbsolu(v, p.label));
    if (r.ok && (META_SHELL.test(r.valeur) || /\s/.test(r.valeur))) {
      return ko(`${p.label} : espaces et caractères spéciaux refusés dans une commande à copier (utilise un chemin simple).`);
    }
    return r;
  },
  port:    (v, p) => adapter(validatePortTcp(v, p.label)),
  entier:  (v, p) => adapter(validateEntierBorne(v, p.min ?? 1, p.max ?? 65535, p.label)),
  texte:   (v, p) => texteSimple(v, p.label, { max: p.max ?? 80 }),
  // Nom libre (file d'impression, nom de service Windows…) : on accepte les
  // espaces et la ponctuation courante, jamais les métacaractères.
  nom:     (v, p) => texteSimple(v, p.label, { max: p.max ?? 80, meta: true }),
  choix:   (v, p) => {
    const s = String(v ?? '').trim();
    if (!s) return ko(`${p.label} est obligatoire.`);
    return (p.choix ?? []).includes(s) ? ok(s) : ko(`${p.label} : valeur parmi ${(p.choix ?? []).join(', ')}.`);
  },
};

function adapter(r) {
  if (r && r.ok) return ok(r.valeur ?? r.value);
  return ko(r?.error ?? 'Valeur invalide.');
}

/** Valide UN paramètre. Vide → { ok:false, vide:true }. */
export function validerParametre(param, brut) {
  const s = String(brut ?? '').trim();
  if (s === '') {
    return param.optionnel
      ? { ok: true, valeur: param.defaut ?? '', vide: true }
      : { ok: false, vide: true, error: `${param.label} : à renseigner.` };
  }
  const f = TYPES_PARAM[param.type ?? 'texte'];
  if (!f) return ko(`Type de paramètre inconnu : ${param.type}`);
  return f(s, param);
}

// ---------------------------------------------------------------------------
// Rendu des commandes
// ---------------------------------------------------------------------------

/** Les identifiants {{x}} présents dans un texte. */
export function parametresUtilises(texte) {
  return [...new Set([...String(texte ?? '').matchAll(/\{\{([A-Za-z][\w]*)\}\}/g)].map((m) => m[1]))];
}

// ---------------------------------------------------------------------------
// Tableaux de paramètres (plan de VLAN, par exemple)
// ---------------------------------------------------------------------------

function ipv4Entier(a) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(a));
  if (!m) return null;
  const n = m.slice(1).map(Number);
  if (n.some((x) => x > 255)) return null;
  return ((n[0] * 16777216) + (n[1] * 65536) + (n[2] * 256) + n[3]) >>> 0;
}
function entierIpv4(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }
export function masqueDepuisPrefixe(pf) { return pf === 0 ? 0 : ((0xFFFFFFFF << (32 - pf)) >>> 0); }
export function masquePointe(pf) { return entierIpv4(masqueDepuisPrefixe(Number(pf))); }

/** Vérifications croisées d'un plan de VLAN : tout ce qu'un champ seul ne voit pas. */
export function coherencePlanVlan(lignes, valides = {}, param = {}) {
  const erreurs = [];
  const vus = { vlan: new Map(), nom: new Map(), port: new Map() };
  const sous = [];
  lignes.forEach((l, i) => {
    const n = i + 1;
    if (vus.vlan.has(l.vlan)) erreurs.push({ ligne: i, col: 'vlan', message: `Ligne ${n} : le VLAN ${l.vlan} figure déjà à la ligne ${vus.vlan.get(l.vlan) + 1}.` });
    else vus.vlan.set(l.vlan, i);
    const nom = String(l.nom ?? '').toLowerCase();
    if (nom) {
      if (vus.nom.has(nom)) erreurs.push({ ligne: i, col: 'nom', message: `Ligne ${n} : le nom « ${l.nom} » est déjà celui de la ligne ${vus.nom.get(nom) + 1}.` });
      else vus.nom.set(nom, i);
    }
    const pf = Number(l.prefixe);
    const res = ipv4Entier(l.reseau); const gw = ipv4Entier(l.passerelle); const poste = ipv4Entier(l.poste);
    if (res !== null && Number.isInteger(pf)) {
      const masque = masqueDepuisPrefixe(pf);
      const reseau = (res & masque) >>> 0;
      const diffusion = (reseau | (~masque >>> 0)) >>> 0;
      if (reseau !== res) erreurs.push({ ligne: i, col: 'reseau', message: `Ligne ${n} : ${l.reseau}/${pf} n’est pas une adresse de réseau ; pour ce préfixe, c’est ${entierIpv4(reseau)}.` });
      sous.push({ i, reseau, diffusion });
      const dedans = (a) => a !== null && a > reseau && a < diffusion;
      if (gw !== null && !dedans(gw)) erreurs.push({ ligne: i, col: 'passerelle', message: `Ligne ${n} : la passerelle ${l.passerelle} doit être une adresse utilisable de ${entierIpv4(reseau)}/${pf} (ni l’adresse réseau ni la diffusion).` });
      if (poste !== null && !dedans(poste)) erreurs.push({ ligne: i, col: 'poste', message: `Ligne ${n} : l’adresse du poste ${l.poste} doit être une adresse utilisable de ${entierIpv4(reseau)}/${pf}.` });
      if (gw !== null && poste !== null && gw === poste) erreurs.push({ ligne: i, col: 'poste', message: `Ligne ${n} : le poste et la passerelle ont la même adresse.` });
    }
    for (const p of String(l.ports ?? '').split(',').filter(Boolean)) {
      if (vus.port.has(p)) erreurs.push({ ligne: i, col: 'ports', message: `Ligne ${n} : le port ${p} est déjà affecté à la ligne ${vus.port.get(p) + 1}.` });
      else vus.port.set(p, i);
      for (const id of param.exclure ?? []) {
        if (valides[id] && valides[id] === p) erreurs.push({ ligne: i, col: 'ports', message: `Ligne ${n} : le port ${p} est aussi la liaison de ce plan (${id === 'trunkSw' ? 'trunk côté commutateur' : id}) : un port ne peut pas être à la fois d’accès et de liaison.` });
      }
    }
  });
  for (let a = 0; a < sous.length; a++) {
    for (let b = a + 1; b < sous.length; b++) {
      if (sous[a].reseau <= sous[b].diffusion && sous[b].reseau <= sous[a].diffusion) {
        erreurs.push({ ligne: sous[b].i, col: 'reseau', message: `Lignes ${sous[a].i + 1} et ${sous[b].i + 1} : les deux réseaux se chevauchent. Chaque VLAN a son propre réseau.` });
      }
    }
  }
  return erreurs;
}

export const COHERENCES = { planVlan: coherencePlanVlan };

/**
 * Valide un tableau : cellule par cellule (validateurs de colonne), puis la
 * cohérence croisée. { ok, lignes:[{col:valeur}], erreurs:[{ligne,col,message}],
 * vide:boolean, messages:[…] }.
 */
export function validerTable(param, brut, valides = {}) {
  const lignesBrutes = Array.isArray(brut) ? brut : [];
  const erreurs = []; const lignes = []; let vide = false;
  const min = param.min ?? 1; const max = param.max ?? 8;
  if (lignesBrutes.length < min) { vide = true; }
  if (lignesBrutes.length > max) erreurs.push({ ligne: max, col: null, message: `${max} lignes au plus.` });
  lignesBrutes.slice(0, max).forEach((ligne, i) => {
    const valeurs = {};
    for (const c of param.colonnes) {
      const r = validerParametre({ ...c, label: c.label }, ligne?.[c.id]);
      if (r.ok && !r.vide) valeurs[c.id] = r.valeur;
      else if (r.vide) { vide = true; }
      else erreurs.push({ ligne: i, col: c.id, message: `Ligne ${i + 1} — ${r.error}` });
    }
    lignes.push(valeurs);
  });
  let croisees = [];
  if (!vide && !erreurs.length && lignesBrutes.length >= min) {
    croisees = (COHERENCES[param.coherence]?.(lignes, valides, param) ?? []);
  }
  const toutes = [...erreurs, ...croisees];
  return {
    ok: !vide && toutes.length === 0 && lignesBrutes.length >= min,
    lignes, erreurs: toutes, vide, messages: toutes.map((e) => e.message),
  };
}

// ---------------------------------------------------------------------------
// Évaluation et rendu
// ---------------------------------------------------------------------------

/**
 * Évalue toutes les valeurs d'une procédure : { valides:{id:valeur},
 * erreurs:{id:message}, vides:[ids], tables:{id:résultat} }.
 */
export function evaluerValeurs(params, saisies = {}) {
  const valides = {}; const erreurs = {}; const vides = []; const tables = {};
  for (const p of params ?? []) {
    if (p.type === 'table') continue;
    const r = validerParametre(p, saisies[p.id]);
    if (r.ok && !r.vide) valides[p.id] = r.valeur;
    else if (r.ok && r.vide) valides[p.id] = r.valeur;
    else if (r.vide) vides.push(p.id);
    else erreurs[p.id] = r.error;
    // Un préfixe valide fournit aussi son masque pointé : {{<id>Masque}}.
    if (p.type === 'prefixe' && r.ok && !r.vide) valides[`${p.id}Masque`] = masquePointe(Number(r.valeur));
  }
  for (const p of params ?? []) {
    if (p.type !== 'table') continue;
    tables[p.id] = validerTable(p, saisies[p.id], valides);
    // Agrégats : une colonne réduite à une liste (« 10,20,30 ») pour une ligne de trunk, par exemple.
    for (const a of p.agregats ?? []) {
      if (tables[p.id].ok) valides[a.id] = [...new Set(tables[p.id].lignes.map((l) => l[a.colonne]))].sort((x, y) => Number(x) - Number(y)).join(',');
    }
    if (!tables[p.id].ok) {
      if (tables[p.id].vide && !tables[p.id].erreurs.length) vides.push(p.id);
      else erreurs[p.id] = tables[p.id].messages[0] ?? `${p.label} : valeurs à corriger.`;
    }
  }
  return { valides, erreurs, vides, tables };
}

/** Libellés de tous les repères : paramètres ET colonnes de tableaux. */
function libellesDe(params) {
  const m = {};
  for (const p of params ?? []) {
    m[p.id] = p;
    for (const c of p.colonnes ?? []) if (!m[c.id]) m[c.id] = c;
  }
  return m;
}

/**
 * Rend UNE ligne de commande. `copie` = le texte réellement copiable ;
 * `affichage` = ce que l'écran montre (avec repères pour les manquants).
 * `manquants` liste les paramètres vides ou invalides utilisés par la ligne.
 */
export function rendreLigne(modele, params, evaluation) {
  const manquants = [];
  const parId = libellesDe(params);
  const remplacer = (_, id, pourAffichage) => {
    if (Object.hasOwn(evaluation.valides, id) && !(id in evaluation.erreurs)) return evaluation.valides[id];
    if (!manquants.includes(id)) manquants.push(id);
    return pourAffichage ? `${REPERE_OUVRANT}${parId[id]?.label ?? id}${REPERE_FERMANT}` : '';
  };
  const copie = String(modele).replace(/\{\{([A-Za-z]\w*)\}\}/g, (m, id) => remplacer(m, id, false));
  const affichage = String(modele).replace(/\{\{([A-Za-z]\w*)\}\}/g, (m, id) => remplacer(m, id, true));
  return { copie, affichage, manquants };
}

/** Portée d'une ligne d'un tableau : colonnes, masque dérivé, et élément de sous-liste. */
function portees(etape, evaluation) {
  const rep = etape.repeter;
  const t = evaluation.tables?.[rep.table];
  if (!t || !t.ok) return null;
  const sortie = [];
  t.lignes.forEach((ligne, i) => {
    const base = { ...ligne };
    if (ligne.prefixe) base.masque = masquePointe(ligne.prefixe);
    // La ligne suivante (en boucle) : « suivant_poste » pour tester un VLAN vers un autre.
    const suivante = t.lignes[(i + 1) % t.lignes.length];
    for (const [k, v] of Object.entries(suivante)) base[`suivant_${k}`] = v;
    if (rep.liste) {
      const elements = String(ligne[rep.liste] ?? '').split(',').filter(Boolean);
      for (const el of elements) sortie.push({ ligne: i, valeurs: { ...base, [rep.alias ?? 'element']: el } });
    } else sortie.push({ ligne: i, valeurs: base });
  });
  return sortie;
}

/**
 * Rend une étape : chaque ligne `{ invite?, cmd, secret? }`. Retourne
 * { lignes:[{invite,affichage,copie,secret,groupe}], texteCopie|null,
 *   manquants, bloque, interactif }.
 *
 * Une ligne `secret` s'arrête AVANT le secret : la copie se termine par une
 * espace, et la personne tape le secret sur l'équipement (jamais dans le
 * navigateur, le presse-papiers ni un fichier).
 */
export function rendreEtape(etape, params, evaluation) {
  const manquants = [];
  const ajouter = (r) => { for (const m of r.manquants) if (!manquants.includes(m)) manquants.push(m); };
  let lignes = []; const instances = [];
  if (etape.repeter) {
    const portee = portees(etape, evaluation);
    if (portee === null) {
      // Tableau invalide ou incomplet : on montre le modèle avec ses repères, copie refusée.
      if (!manquants.includes(etape.repeter.table)) manquants.push(etape.repeter.table);
      lignes = (etape.lignes ?? []).map((l) => {
        const r = rendreLigne(l.cmd, params, { valides: evaluation.valides, erreurs: evaluation.erreurs });
        return { invite: l.invite ?? null, affichage: r.affichage, copie: r.copie, secret: Boolean(l.secret), groupe: null };
      });
    } else if (etape.repeter.separe) {
      // Une instance par machine : chaque ligne du tableau vise une machine DIFFÉRENTE.
      for (const { ligne, valeurs } of portee) {
        const scope = { valides: { ...evaluation.valides, ...valeurs }, erreurs: evaluation.erreurs };
        const groupe = etape.repeter.groupe ? rendreLigne(etape.repeter.groupe, params, scope).copie : `Ligne ${ligne + 1}`;
        const ls = (etape.lignes ?? []).map((l) => {
          const r = rendreLigne(l.cmd, params, scope); ajouter(r);
          return { invite: l.invite ?? null, affichage: r.affichage, copie: r.copie, secret: Boolean(l.secret), groupe: null };
        });
        instances.push({ ligne, groupe, lignes: ls, texteCopie: ls.map((l) => l.copie).join('\n') });
      }
      lignes = instances.flatMap((x) => x.lignes);
    } else {
      let precedent = -1;
      for (const { ligne, valeurs } of portee) {
        const scope = { valides: { ...evaluation.valides, ...valeurs }, erreurs: evaluation.erreurs };
        const groupe = etape.repeter.groupe ? rendreLigne(etape.repeter.groupe, params, scope).copie : null;
        (etape.lignes ?? []).forEach((l, k) => {
          const r = rendreLigne(l.cmd, params, scope); ajouter(r);
          lignes.push({ invite: l.invite ?? null, affichage: r.affichage, copie: r.copie, secret: Boolean(l.secret),
            groupe: k === 0 && ligne !== precedent ? groupe : null });
        });
        precedent = ligne;
      }
    }
  } else {
    lignes = (etape.lignes ?? []).map((l) => {
      const r = rendreLigne(l.cmd, params, evaluation); ajouter(r);
      return { invite: l.invite ?? null, affichage: r.affichage, copie: r.copie, secret: Boolean(l.secret), groupe: null };
    });
  }
  const bloque = manquants.length > 0;
  const interactif = Boolean(etape.interactions?.length) || lignes.some((l) => l.secret);
  const espaceFinal = lignes.length > 0 && lignes[lignes.length - 1].secret;
  const multi = instances.length > 0;
  return {
    lignes, manquants, bloque, interactif, espaceFinal, multi, instances,
    // Plusieurs machines : jamais un seul texte (ce ne serait pas exécutable dans un seul terminal).
    texteCopie: bloque || multi ? null : lignes.map((l, i) => (l.secret && i === lignes.length - 1 ? `${l.copie.replace(/\s+$/, '')} ` : l.copie)).join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Phases — la structure commune des deux vues
// ---------------------------------------------------------------------------

/** Catégorie d'une étape : action, verification, persistance (facultative) ou dernier recours. */
export function categorieEtape(e) {
  if (e.dernierRecours) return 'dernier';
  if (e.persistance) return 'persistance';
  if (e.verification) return 'verification';
  return 'action';
}

const LIBELLE_CATEGORIE = {
  action: 'Procédure', verification: 'Vérifier', persistance: 'Enregistrer (séparé)', dernier: 'Dernier recours',
};
export { LIBELLE_CATEGORIE };

/**
 * Regroupe les étapes consécutives en phases (une carte par grande phase).
 * Deux étapes consécutives restent dans la même phase si elles ont la même
 * catégorie, la même étiquette de phase et le même équipement.
 */
export function phasesDeMethode(rendu) {
  const phases = [];
  rendu.etapes.forEach((e, index) => {
    const categorie = categorieEtape(e);
    const titre = e.phase ?? null;
    const eq = e.equipement ?? null;
    const derniere = phases[phases.length - 1];
    if (derniere && derniere.categorie === categorie && derniere.titre === titre && derniere.equipement === eq) {
      derniere.indices.push(index);
    } else phases.push({ categorie, titre, equipement: eq, indices: [index] });
  });
  const aff = { action: 'Appliquer', verification: 'Vérifier', persistance: 'Enregistrer', dernier: 'Dernier recours' };
  return phases.map((ph, n) => {
    const etapes = ph.indices.map((i) => rendu.etapes[i]);
    const commandes = etapes.filter((e) => e.rendu);
    const manquants = [...new Set(commandes.flatMap((e) => e.rendu.manquants))];
    const interactif = commandes.some((e) => e.rendu.interactif);
    const multi = commandes.some((e) => e.rendu.multi);
    const copiables = commandes.filter((e) => e.rendu.texteCopie !== null);
    const bloque = commandes.some((e) => e.rendu.bloque);
    let texte = null; let raison = null;
    if (!commandes.length) raison = 'aucune-commande';
    else if (multi) raison = 'plusieurs-machines';
    else if (interactif) raison = 'interactif';
    else if (bloque) raison = 'manquants';
    else texte = commandes.map((e) => e.rendu.texteCopie).join('\n');
    return {
      numero: n, categorie: ph.categorie, titre: ph.titre ?? aff[ph.categorie], equipement: ph.equipement,
      indices: ph.indices, manquants, interactif, texte, raison, nbCommandes: copiables.length,
    };
  });
}

/** Une phrase d'explication quand une copie groupée est refusée. */
export function raisonRefus(raison) {
  return ({
    interactif: 'Ce bloc contient une commande qui s’interrompt (réponse à donner ou secret à saisir sur l’équipement) : copie étape par étape.',
    entrecoupee: 'Des étapes d’un autre équipement s’intercalent (un test depuis le poste, par exemple) : copie bloc par bloc, dans l’ordre.',
    manquants: 'Renseigne d’abord toutes les valeurs.',
    'aucune-commande': 'Aucune commande à copier ici.',
    'plusieurs-machines': 'Ce bloc vise plusieurs machines (une par ligne du tableau) : chacune a sa propre copie.',
    'plusieurs-equipements': 'Ces commandes visent plusieurs équipements : elles ne se collent pas dans un seul terminal.',
  })[raison] ?? '';
}

/** Raisons de refus en une ligne (Vue rapide) : le texte complet reste celui de raisonRefus. */
export function raisonRefusCourte(raison) {
  return ({
    interactif: 'Réponses à donner en cours de route : copie par segment.',
    entrecoupee: 'Étapes d’un autre équipement intercalées : copie par bloc.',
    manquants: 'Renseigne d’abord toutes les valeurs.',
    'aucune-commande': 'Aucune commande à copier ici.',
    'plusieurs-machines': 'Une copie par machine (une par ligne du tableau).',
    'plusieurs-equipements': 'Plusieurs équipements : pas de copie unique.',
  })[raison] ?? '';
}

/** Rend une méthode entière. */
export function rendreMethode(methode, params, saisies) {
  const evaluation = evaluerValeurs(params, saisies);
  const equipements = methode.equipements ?? null;
  const etapes = (methode.etapes ?? []).map((e) => ({ ...e, rendu: e.lignes ? rendreEtape(e, params, evaluation) : null }));
  // La séquence complète n'inclut JAMAIS une étape facultative (par exemple
  // l'enregistrement durable d'une configuration) ni un dernier recours : on
  // n'ajoute pas en silence un changement durable ou une interruption.
  const copiables = etapes.filter((e) => e.rendu && !e.facultatif && !e.dernierRecours);
  const manquantsTous = [...new Set(copiables.flatMap((e) => e.rendu.manquants))];
  const base = { evaluation, etapes, manquants: manquantsTous };
  const phases = phasesDeMethode(base);

  // Procédure à un seul équipement : copie de toute la séquence si elle est sûre.
  const interactifGlobal = copiables.some((e) => e.rendu.interactif);
  let texteComplet = null; let raisonComplet = null;
  if (equipements) raisonComplet = 'plusieurs-equipements';
  else if (!copiables.length) raisonComplet = 'aucune-commande';
  else if (copiables.some((e) => e.rendu.multi)) raisonComplet = 'plusieurs-machines';
  else if (interactifGlobal) raisonComplet = 'interactif';
  else if (copiables.some((e) => e.rendu.bloque)) raisonComplet = 'manquants';
  else texteComplet = copiables.map((e) => e.rendu.texteCopie).join('\n');

  // Procédure multi-équipements : une séquence par équipement, jamais mélangée.
  const parEquipement = (equipements ?? []).map((eq) => {
    const idx = etapes.map((e, i) => (e.equipement === eq.id ? i : -1)).filter((i) => i >= 0);
    const miens = idx.map((i) => etapes[i]).filter((e) => e.rendu && !e.facultatif && !e.dernierRecours);
    let texte = null; let raison = null;
    if (!miens.length) raison = 'aucune-commande';
    else if (miens.some((e) => e.rendu.multi)) raison = 'plusieurs-machines';
    else if (miens.some((e) => e.rendu.interactif)) raison = 'interactif';
    else if (miens.some((e) => e.rendu.bloque)) raison = 'manquants';
    else {
      const premier = etapes.indexOf(miens[0]); const dernier = etapes.indexOf(miens[miens.length - 1]);
      const intercale = etapes.slice(premier, dernier + 1).some((e) => e.equipement !== eq.id && (e.rendu || e.actions));
      if (intercale) raison = 'entrecoupee';
      else texte = miens.map((e) => e.rendu.texteCopie).join('\n');
    }
    return { ...eq, texte, raison, nbEtapes: idx.length };
  });

  return { evaluation, etapes, phases, manquants: manquantsTous, texteComplet, raisonComplet, parEquipement };
}

// ---------------------------------------------------------------------------
// Références : réutiliser une étape élémentaire dans un scénario
// ---------------------------------------------------------------------------

/**
 * Reprend une étape d'une procédure élémentaire, avec un contexte explicite :
 *  - `lier`  renomme les paramètres de l'étape (vlan → vlan) ;
 *  - `lignes` ne garde que certaines lignes (indices) ;
 *  - `fixe`  remplace un paramètre par une constante ({ service: 'ssh' }) ;
 *  - `hote`  renomme l'invite « Switch » (Router…) : l'invite n'est jamais copiée ;
 *  - `titre` : garde-fou — l'étape visée doit porter ce titre, sinon le banc échoue ;
 *  - tout autre champ surcharge l'étape (phase, equipement, repeter, effet…).
 * La commande reste celle de l'étape d'origine : la corriger corrige aussi les scénarios.
 */
export function reprendre(catalogue, ref, surcharges = {}) {
  const proc = catalogue.find((p) => p.id === ref.procedure);
  if (!proc) throw new Error(`reprendre : procédure inconnue « ${ref.procedure} »`);
  const methode = proc.methodes.find((m) => m.id === ref.methode);
  if (!methode) throw new Error(`reprendre : méthode « ${ref.methode} » absente de ${ref.procedure}`);
  const source = methode.etapes[ref.etape];
  if (!source) throw new Error(`reprendre : étape ${ref.etape} absente de ${ref.procedure}/${ref.methode}`);
  if (ref.titre && source.titre !== ref.titre) {
    throw new Error(`reprendre : l'étape ${ref.etape} de ${ref.procedure} s'appelle « ${source.titre} », pas « ${ref.titre} »`);
  }
  const lier = ref.lier ?? {};
  const fixe = ref.fixe ?? {};
  const renommer = (cmd) => cmd.replace(/\{\{([A-Za-z]\w*)\}\}/g, (m, id) => (Object.hasOwn(fixe, id) ? String(fixe[id]) : `{{${lier[id] ?? id}}}`));
  const invite = (v) => (v && ref.hote ? v.replace(/^Switch/, ref.hote) : v);
  let lignes = source.lignes;
  if (lignes && ref.lignes) lignes = ref.lignes.map((i) => lignes[i]);
  if (lignes) lignes = lignes.map((l) => ({ ...l, ...(l.invite ? { invite: invite(l.invite) } : {}), cmd: renommer(l.cmd) }));
  const { lignes: _l, ...reste } = source;
  return { ...reste, ...(lignes ? { lignes } : {}), reprise: `${ref.procedure}/${ref.methode}#${ref.etape}`, ...surcharges };
}

// ---------------------------------------------------------------------------
// Contrat d'une procédure — vérifié par le banc, jamais au chargement
// ---------------------------------------------------------------------------

const INVITE_COLLEE = /^\s*(?:[A-Za-z0-9_.-]+(?:\([a-z-]+\))?[#>]\s|PS [A-Z]:\\[^>]*>\s?|PS>\s|\$\s|#\s)/;
const SECRETISH = /mot de passe|password|passwd|secret|passphrase|jeton|token|cl[ée] priv/i;

/**
 * Retourne la liste des manquements d'une procédure (vide = conforme). Le banc
 * veut tous les défauts d'un coup, d'où une liste et non une exception.
 */
export function incoherencesProcedure(p) {
  const pb = [];
  const txt = (v) => (typeof v === 'string' ? v.trim() : '');
  const scenario = p.kind === 'scenario';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(txt(p.id))) pb.push('id absent ou mal formé');
  if (txt(p.titre).length < 8) pb.push('titre trop court');
  if (txt(p.titre).length > 70) pb.push('titre trop long (70 caractères au plus) : un titre de tâche est court');
  if (txt(p.resume).length < 20) pb.push('résumé absent');
  if (txt(p.resume).length > 400) pb.push('résumé trop long (3 phrases au plus)');
  if (!EFFETS[p.effet]) pb.push(`effet inconnu : ${p.effet}`);
  if (!Array.isArray(p.intentions) || p.intentions.length < 2) pb.push('intentions de recherche : au moins 2');
  if (!Array.isArray(p.sources) || !p.sources.length) pb.push('aucune source');
  for (const s of p.sources ?? []) if (!/^https:\/\//.test(s.url ?? '')) pb.push(`source non HTTPS : ${s.label}`);
  if (!Array.isArray(p.methodes) || !p.methodes.length) pb.push('aucune méthode');
  if (p.kind && !['procedure', 'scenario'].includes(p.kind)) pb.push(`nature inconnue : ${p.kind}`);
  if (scenario) {
    if (!Array.isArray(p.hypotheses) || !p.hypotheses.length) pb.push('scénario : hypothèses absentes');
    if (txt(p.topologie).length < 20) pb.push('scénario : topologie absente');
  }

  const ids = new Set(); const colonnes = new Set();
  for (const prm of p.params ?? []) {
    if (ids.has(prm.id)) pb.push(`paramètre en double : ${prm.id}`);
    ids.add(prm.id);
    if (SECRETISH.test(`${prm.id} ${prm.label}`)) pb.push(`paramètre ${prm.id} : un secret ne se saisit jamais dans le navigateur`);
    if (prm.type === 'table') {
      if (!Array.isArray(prm.colonnes) || prm.colonnes.length < 2) pb.push(`tableau ${prm.id} : colonnes absentes`);
      for (const c of prm.colonnes ?? []) {
        colonnes.add(c.id);
        if (!TYPES_PARAM[c.type ?? 'texte']) pb.push(`tableau ${prm.id} : colonne ${c.id} de type inconnu`);
        if (SECRETISH.test(`${c.id} ${c.label}`)) pb.push(`tableau ${prm.id} : colonne ${c.id} ressemble à un secret`);
      }
      if (prm.coherence && !COHERENCES[prm.coherence]) pb.push(`tableau ${prm.id} : cohérence inconnue ${prm.coherence}`);
      if (!Array.isArray(prm.exemple) || prm.exemple.length < (prm.min ?? 1)) pb.push(`tableau ${prm.id} : exemple absent ou trop court`);
      else {
        const saisies = Object.fromEntries((p.params ?? []).filter((q) => q.type !== 'table').map((q) => [q.id, q.exemple]));
        const ev = evaluerValeurs(p.params, { ...saisies, [prm.id]: prm.exemple });
        if (!ev.tables[prm.id].ok) pb.push(`tableau ${prm.id} : son exemple est refusé par sa propre cohérence (${ev.tables[prm.id].messages[0] ?? 'incomplet'})`);
      }
      continue;
    }
    if (txt(prm.label).length < 3) pb.push(`paramètre ${prm.id} : libellé absent`);
    if (prm.methodes) {
      for (const mid of prm.methodes) if (!(p.methodes ?? []).some((m) => m.id === mid)) pb.push(`paramètre ${prm.id} : réservé à la méthode « ${mid} » qui n'existe pas dans la fiche`);
    }
    if (!TYPES_PARAM[prm.type ?? 'texte']) { pb.push(`paramètre ${prm.id} : type inconnu`); continue; }
    if (txt(prm.exemple) === '') pb.push(`paramètre ${prm.id} : exemple absent`);
    else {
      const r = validerParametre(prm, prm.exemple);
      if (!r.ok) pb.push(`paramètre ${prm.id} : son exemple « ${prm.exemple} » est refusé par son propre validateur (${r.error})`);
    }
  }

  const methodesVues = new Set();
  for (const m of p.methodes ?? []) {
    if (!METHODES[m.id]) { pb.push(`méthode inconnue : ${m.id}`); continue; }
    if (methodesVues.has(m.id)) pb.push(`méthode en double : ${m.id}`);
    methodesVues.add(m.id);
    if (!Array.isArray(m.etapes) || !m.etapes.length) { pb.push(`méthode ${m.id} : aucune étape (un onglet vide est interdit)`); continue; }
    const eqIds = new Set((m.equipements ?? []).map((q) => q.id));
    if (m.id === 'scenario') {
      if (!m.equipements?.length) pb.push('méthode scenario : équipements absents');
      for (const q of m.equipements ?? []) {
        if (!METHODES_EQUIPEMENT.includes(q.methode)) pb.push(`équipement ${q.id} : méthode « ${q.methode} » invalide`);
        if (txt(q.label).length < 4) pb.push(`équipement ${q.id} : libellé absent`);
      }
    } else if (m.equipements) pb.push(`méthode ${m.id} : « equipements » est réservé à la méthode scenario`);
    m.etapes.forEach((e, i) => {
      const nom = `${m.id} étape ${i + 1}`;
      const methodeLignes = m.id === 'scenario' ? (m.equipements ?? []).find((q) => q.id === e.equipement)?.methode : m.id;
      if (txt(e.titre).length < 4) pb.push(`${nom} : titre absent`);
      if (txt(e.explication).length < 10) pb.push(`${nom} : explication absente`);
      if (e.effet && !EFFETS[e.effet]) pb.push(`${nom} : effet inconnu ${e.effet}`);
      if (m.id === 'scenario' && !eqIds.has(e.equipement)) pb.push(`${nom} : équipement « ${e.equipement} » non déclaré`);
      if (m.id !== 'scenario' && e.equipement) pb.push(`${nom} : « equipement » n'a de sens que dans un scénario`);
      if (m.id === 'gui') {
        if (e.lignes) pb.push(`${nom} : une étape graphique n'a pas de ligne de commande`);
        return;
      }
      if (!Array.isArray(e.lignes) || !e.lignes.length) { pb.push(`${nom} : aucune commande`); return; }
      e.lignes.forEach((l, k) => {
        if (INVITE_COLLEE.test(l.cmd)) pb.push(`${nom} : « ${l.cmd} » commence par une invite — elle se met dans « invite », pas dans la commande`);
        if (/^\s*$/.test(l.cmd)) pb.push(`${nom} : ligne vide`);
        if (/[^\x00-\x7f]/.test(l.cmd) && methodeLignes === 'ios') pb.push(`${nom} : IOS exige de l'ASCII (« ${l.cmd} »)`);
        const autorises = new Set(ids);
        if (e.repeter) { for (const c of colonnes) { autorises.add(c); autorises.add(`suivant_${c}`); } autorises.add('masque'); if (e.repeter.alias) autorises.add(e.repeter.alias); }
        for (const q of p.params ?? []) {
          if (q.type === 'prefixe') autorises.add(`${q.id}Masque`);
          for (const a of q.agregats ?? []) autorises.add(a.id);
        }
        for (const id of parametresUtilises(l.cmd)) if (!autorises.has(id)) pb.push(`${nom} : paramètre {{${id}}} non déclaré`);
        for (const id of parametresUtilises(l.cmd)) {
          const q = (p.params ?? []).find((x) => x.id === id);
          if (q?.methodes && !q.methodes.includes(m.id)) pb.push(`${nom} : paramètre {{${id}}} réservé aux méthodes ${q.methodes.join(', ')}`);
        }
        // Un repère littéral « <PID> » dans une commande se copierait tel quel (et « < » est une redirection en CMD / PowerShell).
        if (/<[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_ -]*>/.test(l.cmd.replace(/\{\{[^}]*\}\}/g, ''))) pb.push(`${nom} : « ${l.cmd} » contient un repère littéral <…> : utilise un paramètre {{…}}`);
        if (methodeLignes === 'cmd') {
          if (/^\s*[A-Z][a-z]+-[A-Z][A-Za-z]+\b/.test(l.cmd) || /\$[_A-Za-z(]/.test(l.cmd) || /`/.test(l.cmd)) pb.push(`${nom} : « ${l.cmd} » est du PowerShell, pas du CMD`);
          if (/(^|\s)(sudo|systemctl|apt|grep)\b/.test(l.cmd)) pb.push(`${nom} : « ${l.cmd} » est une commande Linux, pas du CMD`);
        }
        if (methodeLignes === 'powershell' && /(^|\s)(findstr|netsh|ipconfig \/)/.test(l.cmd) && false) pb.push('');
        if (l.cmd.includes(REPERE_OUVRANT)) pb.push(`${nom} : repère ${REPERE_OUVRANT} dans une commande`);
        if (l.secret) {
          if (k !== e.lignes.length - 1) pb.push(`${nom} : une ligne à secret doit être la DERNIÈRE de l'étape (la suite ne s'exécuterait pas dans le bon ordre)`);
          if (!/\b(?:secret|password)\s*$/i.test(l.cmd)) pb.push(`${nom} : une ligne à secret se termine par le mot qui précède le secret`);
          if (!e.interactions?.some((x) => x.secret)) pb.push(`${nom} : une ligne à secret exige une interaction « secret » qui dit quoi saisir et où`);
        }
      });
      for (const x of e.interactions ?? []) {
        if (txt(x.attend).length < 6 || txt(x.reponds).length < 3) pb.push(`${nom} : interaction incomplète (attend / reponds)`);
        if (x.secret && /[:=]\s*\S{4,}$/.test(x.reponds)) pb.push(`${nom} : une réponse secrète ne s'écrit pas dans la fiche`);
      }
      if (e.repeter) {
        const t = (p.params ?? []).find((q) => q.id === e.repeter.table && q.type === 'table');
        if (!t) pb.push(`${nom} : tableau « ${e.repeter.table} » non déclaré`);
        else if (e.repeter.liste && !t.colonnes.some((c) => c.id === e.repeter.liste)) pb.push(`${nom} : colonne « ${e.repeter.liste} » absente du tableau`);
      }
    });
    if (!m.verification || !m.verification.length) pb.push(`méthode ${m.id} : vérification finale absente`);
    if (m.id === 'scenario') {
      for (const q of m.equipements ?? []) {
        if (!m.etapes.some((e) => e.equipement === q.id)) pb.push(`équipement ${q.id} : aucune étape`);
      }
    }
  }
  for (const prm of p.params ?? []) {
    const utilise = (p.methodes ?? []).some((m) => (m.etapes ?? []).some((e) => (e.lignes ?? []).some((l) => parametresUtilises(l.cmd).includes(prm.id))
      || (prm.type === 'table' && e.repeter?.table === prm.id)
      || (e.repeter && (e.lignes ?? []).some((l) => parametresUtilises(l.cmd).includes(prm.id)))));
    if (!utilise) pb.push(`paramètre ${prm.id} déclaré mais jamais utilisé`);
  }
  return pb;
}

/**
 * Texte à envoyer au presse-papiers, selon la méthode (fins de ligne forcées LF).
 * `espaceFinal` conserve l'unique espace qui précède un secret à saisir.
 */
export function texteCopiable(texte, methodeId, { espaceFinal = false } = {}) {
  if (texte == null) return null;
  let t = String(texte).replace(/\r\n?/g, '\n');
  const garde = espaceFinal && / $/.test(t);
  t = t.replace(/[ \t]+$/gm, '');
  if (garde) t += ' ';
  if (methodeId === 'ios') t = t.replace(/\t/g, '  ');
  return t;
}

/**
 * Dossier de procédure (Markdown, UTF-8, LF, sans BOM) : le plan et les
 * commandes PAR ÉQUIPEMENT, sans invite ni secret. Même source que les vues.
 */
export function dossierMarkdown(procedure, rendu, methode) {
  const L = [];
  L.push(`# ${procedure.titre}`, '', procedure.resume, '');
  if (procedure.hypotheses?.length) { L.push('## Hypothèses', '', ...procedure.hypotheses.map((h) => `- ${h}`), ''); }
  if (procedure.topologie) L.push('## Topologie', '', procedure.topologie, '');
  const label = (id) => (methode.equipements ?? []).find((q) => q.id === id)?.label ?? null;
  let courant = Symbol('aucun');
  for (const ph of rendu.phases) {
    if (ph.equipement !== courant) { courant = ph.equipement; }
    L.push(`## ${ph.equipement ? `${label(ph.equipement)} — ` : ''}${ph.titre}`, '');
    for (const i of ph.indices) {
      const e = rendu.etapes[i];
      L.push(`### ${e.titre}`, '', e.explication, '');
      if (e.rendu) {
        L.push('```', ...e.rendu.lignes.map((l) => (l.secret ? `${l.affichage} <secret à saisir sur l'équipement>` : l.affichage)), '```', '');
        for (const x of e.interactions ?? []) L.push(`- À l'invite « ${x.attend} » : ${x.reponds}`);
        if (e.interactions?.length) L.push('');
      }
      if (e.important) L.push(`> Important : ${e.important}`, '');
      if (e.attendu) L.push(`Résultat attendu (d'après la documentation, non testé) : ${e.attendu}`, '');
    }
  }
  L.push('## Validation', '', procedure.validation ?? 'Non précisée.', '');
  return `${L.join('\n').replace(/\r/g, '')}`;
}
