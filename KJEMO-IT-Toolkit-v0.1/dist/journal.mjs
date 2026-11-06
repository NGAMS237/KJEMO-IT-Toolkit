/**
 * journal.mjs — JOURNAL-LABO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Journal de labo » : la documentation de tes labos et projets (Cisco,
 * système, Azure, autre), au format d'un dossier d'entreprise : référence,
 * version, état, classification, historique des révisions, puis objet,
 * environnement, architecture, adressage, configuration, validation,
 * exploitation, incidents et références.
 *
 * RÈGLES
 *  1. AUCUN secret. Aucun champ ne s'appelle « mot de passe » ; tout texte qui
 *     ressemble à un mot de passe écrit (« secret Cisco123 », « password=… »,
 *     « mot de passe : … ») est REFUSÉ à l'enregistrement, avec la ligne fautive.
 *     Le document dit seulement OÙ le mot de passe est rangé.
 *  2. Rien ne part du navigateur : le stockage, l'export PDF et la sauvegarde
 *     se font sur l'ordinateur.
 *  3. Une ligne « Conforme » n'est pas une preuve : c'est toi qui l'écris.
 *
 * Module PUR : le stockage, le DOM et le téléchargement vivent dans app.js.
 */

export const CLE_JOURNAL = 'kjemo.journal.v1';
export const FORMAT_SAUVEGARDE = 'kjemo-journal-de-labo';
export const MAX_CAPTURES = 6;
export const JOURS_A_REVOIR = 60;

export const CATEGORIES_JOURNAL = [
  { id: 'cisco', code: 'RES', label: 'Réseau Cisco' },
  { id: 'systeme', code: 'SYS', label: 'Système (Linux, Windows)' },
  { id: 'azure', code: 'AZ', label: 'Azure' },
  { id: 'autre', code: 'GEN', label: 'Autre projet' },
];
export const ETATS_JOURNAL = [
  { id: 'brouillon', label: 'Brouillon', symbole: '…' },
  { id: 'service', label: 'En service', symbole: '✔' },
  { id: 'archive', label: 'Archivé', symbole: '■' },
];
export const CLASSIFICATIONS = ['Interne', 'Public', 'Confidentiel'];
export const RESULTATS = [
  { id: 'a-tester', label: 'À tester', symbole: '…' },
  { id: 'conforme', label: 'Conforme', symbole: '✔' },
  { id: 'non-conforme', label: 'Non conforme', symbole: '✖' },
];

/** Colonnes des tableaux du document (identifiants stables : ils sont dans les sauvegardes). */
export const TABLEAUX = {
  adressage: [
    { id: 'equipement', label: 'Équipement' }, { id: 'interface', label: 'Interface' }, { id: 'adresse', label: 'Adresse / préfixe' },
    { id: 'vlan', label: 'VLAN / zone' }, { id: 'passerelle', label: 'Passerelle' }, { id: 'note', label: 'Note' },
  ],
  configuration: [{ id: 'titre', label: 'Titre du bloc' }, { id: 'code', label: 'Commandes' }],
  validation: [{ id: 'test', label: 'Test' }, { id: 'attendu', label: 'Résultat attendu' }, { id: 'resultat', label: 'Résultat' }],
  incidents: [{ id: 'symptome', label: 'Symptôme' }, { id: 'cause', label: 'Cause' }, { id: 'solution', label: 'Solution' }],
};

/** Champs texte simples, dans l'ordre du formulaire. `long` = zone de texte. */
export const CHAMPS_TEXTE = [
  { id: 'objet', label: 'Objet : à quoi sert ce labo ou ce projet ?', long: true, max: 2000 },
  { id: 'environnement', label: 'Environnement (équipements, logiciels, versions)', long: true, max: 2000 },
  { id: 'architecture', label: 'Architecture : description en quelques phrases', long: true, max: 4000 },
  { id: 'acces', label: 'Accès : comment se connecter (sans mot de passe)', long: true, max: 2000 },
  { id: 'rangement', label: 'Où sont rangés les identifiants', long: false, max: 300, aide: 'Ex. : « gestionnaire de mots de passe, entrée SW1 ». Jamais le mot de passe lui-même.' },
  { id: 'sauvegarde', label: 'Sauvegarde de la configuration', long: true, max: 2000 },
  { id: 'retourArriere', label: 'Retour arrière : comment défaire', long: true, max: 2000 },
  { id: 'referencesTexte', label: 'Autres références (documents, liens)', long: true, max: 2000 },
];

const MAX_LIGNES = 60;
const MAX_CODE = 20000;
const MAX_CELLULE = 1000;

/* ---------------------------------------------------------------------------
 * Garde « aucun secret »
 * ------------------------------------------------------------------------ */
const MOTIFS_SECRET = [
  // IOS : « secret Cisco123 », « password 7 0822… », « enable secret 5 $1$… ». « … secret » seul en fin de ligne est permis.
  // Les mots courants d'une phrase (« le secret est tapé… », « password recovery ») ne sont pas des mots de passe.
  { re: /\b(?:secret|password)\s+(?:[0-9]\s+)?(?![$(]|\*{3}|(?:est|et|de|du|des|le|la|les|se|sur|dans|pour|par|qui|que|ne|n['’]\S*|tap\S*|demand\S*|saisi\S*|is|for|of|to|the|and|policy|recovery|encryption|reset|tap)(?:\s|[.,;:!?)»]|$))\S+/i, quoi: 'un mot de passe après « secret » ou « password »' },
  { re: /\b(?:key-string|pre-shared-key|key\s+[0-9])\s+(?!\*{3})\S+/i, quoi: 'une clé après « key-string » ou « pre-shared-key »' },
  { re: /\bmots?\s+de\s+passe\s*[:=]\s*(?!\*{3})\S+/i, quoi: 'un mot de passe après « mot de passe : »' },
  { re: /\b(?:pwd|passwd|mdp|pass|passphrase)\s*[:=]\s*(?!\*{3})\S+/i, quoi: 'un mot de passe après « pass= » ou « mdp: »' },
  { re: /--(?:admin-)?password(?:=|\s+)(?!\*{3})\S+/i, quoi: 'un mot de passe après « --password »' },
  { re: /-(?:Account)?Password\s+(?!\*{3})["']?[^\s"'$(]\S*/i, quoi: 'un mot de passe après « -Password »' },
  { re: /ConvertTo-SecureString\s+["'][^"']+["']/i, quoi: 'un mot de passe dans ConvertTo-SecureString' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, quoi: 'une clé privée' },
];

/**
 * Cherche un secret écrit dans un texte. Renvoie { ligne, quoi } ou null.
 * Remplacer la valeur par *** rend la ligne acceptable.
 */
export function secretDans(texte) {
  const lignes = String(texte ?? '').split('\n');
  for (let i = 0; i < lignes.length; i++) {
    for (const m of MOTIFS_SECRET) if (m.re.test(lignes[i])) return { ligne: i + 1, quoi: m.quoi };
  }
  return null;
}

function messageSecret(s) {
  return `Ce texte semble contenir ${s.quoi} (ligne ${s.ligne}). Remplace la valeur par *** : un mot de passe ne s’écrit jamais dans la documentation.`;
}

/* ---------------------------------------------------------------------------
 * Références, dates, versions
 * ------------------------------------------------------------------------ */
export const categorie = (id) => CATEGORIES_JOURNAL.find((c) => c.id === id) ?? CATEGORIES_JOURNAL[3];
export const etat = (id) => ETATS_JOURNAL.find((e) => e.id === id) ?? ETATS_JOURNAL[0];
export const resultat = (id) => RESULTATS.find((r) => r.id === id) ?? RESULTATS[0];

/** Date locale « AAAA-MM-JJ ». */
export function jour(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const estJour = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''));

/** Prochaine référence libre : LAB-RES-2026-001, LAB-RES-2026-002… par catégorie et par année. */
export function prochaineReference(categorieId, annee, existantes = []) {
  const code = categorie(categorieId).code;
  const prefixe = `LAB-${code}-${annee}-`;
  const pris = existantes.filter((r) => String(r).startsWith(prefixe)).map((r) => Number(String(r).slice(prefixe.length))).filter(Number.isFinite);
  const n = (pris.length ? Math.max(...pris) : 0) + 1;
  return `${prefixe}${String(n).padStart(3, '0')}`;
}

/** Version suivante : 1.2 → 1.3 (mineure) ou 2.0 (majeure). */
export function versionSuivante(v, majeure = false) {
  const m = /^(\d+)\.(\d+)$/.exec(String(v ?? ''));
  const [a, b] = m ? [Number(m[1]), Number(m[2])] : [1, 0];
  return majeure ? `${a + 1}.0` : `${a}.${b + 1}`;
}

/** Un identifiant interne court (non devinable n'est pas nécessaire : rien n'est partagé). */
export function nouvelId(maintenant = Date.now(), alea = Math.random) {
  return `j${maintenant.toString(36)}${Math.floor(alea() * 1e6).toString(36)}`;
}

/* ---------------------------------------------------------------------------
 * Entrée vide et normalisation
 * ------------------------------------------------------------------------ */
export function entreeVide({ categorieId = 'cisco', auteur = '', date = new Date(), existantes = [], id = nouvelId() } = {}) {
  const j = jour(date);
  return {
    id, reference: prochaineReference(categorieId, j.slice(0, 4), existantes), titre: '', categorie: categorie(categorieId).id,
    etat: 'brouillon', version: '1.0', auteur: String(auteur ?? '').slice(0, 120), classification: 'Interne',
    creeLe: j, modifieLe: j,
    objet: '', environnement: '', architecture: '', acces: '', rangement: '', sauvegarde: '', retourArriere: '', referencesTexte: '',
    adressage: [], configuration: [], validation: [], incidents: [],
    fiches: [], captures: [],
    revisions: [{ version: '1.0', date: j, resume: 'Création du document' }],
  };
}

const texte = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').slice(0, max);
const ligneVide = (l, cols) => cols.every((c) => !String(l[c.id] ?? '').trim());

/**
 * Valide une entrée brute (formulaire ou sauvegarde). Renvoie { entree, erreurs }.
 * `erreurs` : clé → message (« titre », « objet », « adressage.2.note »…).
 * Une entrée avec des erreurs NE DOIT PAS être enregistrée.
 */
export function normaliserEntree(brut = {}) {
  const erreurs = {};
  const b = brut && typeof brut === 'object' ? brut : {};
  const base = entreeVide({ id: String(b.id ?? '') || nouvelId(), categorieId: b.categorie, date: estJour(b.creeLe) ? new Date(`${b.creeLe}T12:00:00`) : new Date() });
  const e = { ...base };
  e.reference = /^LAB-[A-Z]{2,3}-\d{4}-\d{3,4}$/.test(String(b.reference ?? '')) ? b.reference : base.reference;
  e.titre = texte(b.titre, 120).trim();
  if (!e.titre) erreurs.titre = 'Donne un titre au document (ex. « TP VLAN, SSH et routage inter-VLAN »).';
  e.categorie = categorie(b.categorie).id;
  e.etat = etat(b.etat).id;
  e.version = /^\d{1,3}\.\d{1,3}$/.test(String(b.version ?? '')) ? b.version : '1.0';
  e.auteur = texte(b.auteur, 120).trim();
  e.classification = CLASSIFICATIONS.includes(b.classification) ? b.classification : 'Interne';
  e.creeLe = estJour(b.creeLe) ? b.creeLe : base.creeLe;
  e.modifieLe = estJour(b.modifieLe) ? b.modifieLe : e.creeLe;

  const verifierSecret = (cle, v) => { const s = secretDans(v); if (s) erreurs[cle] = messageSecret(s); };
  verifierSecret('titre', e.titre);
  verifierSecret('auteur', e.auteur);
  for (const c of CHAMPS_TEXTE) {
    e[c.id] = texte(b[c.id], c.max);
    verifierSecret(c.id, e[c.id]);
  }

  for (const [nom, cols] of Object.entries(TABLEAUX)) {
    const src = Array.isArray(b[nom]) ? b[nom] : [];
    const lignes = [];
    for (const l of src.slice(0, MAX_LIGNES)) {
      if (!l || typeof l !== 'object') continue;
      const propre = {};
      for (const c of cols) propre[c.id] = texte(l[c.id], c.id === 'code' ? MAX_CODE : MAX_CELLULE);
      if (nom === 'validation') propre.resultat = resultat(l.resultat).id;
      if (ligneVide(propre, cols.filter((c) => c.id !== 'resultat'))) continue;
      const i = lignes.length;
      for (const c of cols) { const s = secretDans(propre[c.id]); if (s) erreurs[`${nom}.${i}.${c.id}`] = messageSecret(s); }
      lignes.push(propre);
    }
    e[nom] = lignes;
  }

  e.fiches = [...new Set((Array.isArray(b.fiches) ? b.fiches : []).map(String).filter((x) => /^[\w-]{2,120}$/.test(x)))].slice(0, 20);
  e.captures = (Array.isArray(b.captures) ? b.captures : []).filter((c) => c && /^[\w-]{4,80}$/.test(String(c.id ?? ''))).slice(0, MAX_CAPTURES)
    .map((c) => ({ id: String(c.id), nom: texte(c.nom, 120).trim() || 'capture.jpg', legende: texte(c.legende, 300).trim() }));
  e.captures.forEach((c, i) => { const s = secretDans(c.legende); if (s) erreurs[`captures.${i}.legende`] = messageSecret(s); });

  const revs = (Array.isArray(b.revisions) ? b.revisions : [])
    .filter((r) => r && /^\d{1,3}\.\d{1,3}$/.test(String(r.version ?? '')) && estJour(r.date))
    .map((r) => ({ version: r.version, date: r.date, resume: texte(r.resume, 300).trim() || 'Mise à jour' })).slice(-100);
  e.revisions = revs.length ? revs : [{ version: e.version, date: e.creeLe, resume: 'Création du document' }];
  return { entree: e, erreurs };
}

/**
 * Publie une nouvelle version : incrémente le numéro et ajoute une ligne à
 * l'historique. Le résumé est obligatoire (c'est ce qu'on lira dans six mois).
 */
export function publierVersion(entree, { resume, majeure = false, date = new Date() } = {}) {
  const r = String(resume ?? '').trim();
  if (!r) return { entree, erreur: 'Écris en une phrase ce qui a changé dans cette version.' };
  const s = secretDans(r);
  if (s) return { entree, erreur: messageSecret(s) };
  const version = versionSuivante(entree.version, majeure);
  const j = jour(date);
  return { entree: { ...entree, version, modifieLe: j, revisions: [...entree.revisions, { version, date: j, resume: r.slice(0, 300) }] }, erreur: null };
}

/** Le labo n'a pas été revu depuis longtemps (hors archives). */
export function aRevoir(entree, aujourdhui = new Date(), jours = JOURS_A_REVOIR) {
  if (entree.etat === 'archive' || !estJour(entree.modifieLe)) return false;
  const ecart = (new Date(`${jour(aujourdhui)}T12:00:00`) - new Date(`${entree.modifieLe}T12:00:00`)) / 86400000;
  return ecart > jours;
}

/** Recherche simple (sans accents) dans le titre, la référence, l'objet, les adresses et les équipements. */
export function correspond(entree, requete) {
  const n = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = n(requete).trim();
  if (!q) return true;
  const foin = n([entree.titre, entree.reference, entree.objet, entree.environnement, entree.architecture,
    ...entree.adressage.flatMap((l) => Object.values(l)), ...entree.incidents.flatMap((l) => Object.values(l))].join(' '));
  return q.split(/\s+/).every((m) => foin.includes(m));
}

/** Liste filtrée et triée (plus récent d'abord). */
export function filtrerJournal(entrees, { categorieId = null, filtre = 'tous', requete = '', aujourdhui = new Date() } = {}) {
  return entrees
    .filter((e) => !categorieId || e.categorie === categorieId)
    .filter((e) => filtre === 'tous' ? e.etat !== 'archive' : filtre === 'a-revoir' ? aRevoir(e, aujourdhui) : e.etat === filtre)
    .filter((e) => correspond(e, requete))
    .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)) || String(b.reference).localeCompare(String(a.reference)));
}

/* ---------------------------------------------------------------------------
 * Création depuis une fiche du Toolkit
 * ------------------------------------------------------------------------ */
const PLATEFORME_VERS_CATEGORIE = { Cisco: 'cisco', Azure: 'azure', Linux: 'systeme', Windows: 'systeme' };
const COMMENTAIRE = { ios: '!', cmd: 'REM', powershell: '#', linux: '#', azure: '#' };

/** Valeurs utiles d'une évaluation (evaluerValeurs) : paramètres valides et lignes des tableaux valides. */
export function valeursPourJournal(evaluation) {
  const v = { ...(evaluation?.valides ?? {}) };
  for (const [id, t] of Object.entries(evaluation?.tables ?? {})) if (t?.ok && Array.isArray(t.lignes)) v[id] = t.lignes;
  return v;
}

/**
 * Prépare une entrée à partir d'une fiche et de ses valeurs saisies :
 * titre, catégorie, objet, adressage (tableau de VLAN et adresse de gestion
 * si la fiche en a), configuration (les commandes rendues, phase par phase,
 * hors étapes facultatives, d'annulation ou incomplètes), validation (la
 * vérification finale de la fiche, « À tester »).
 * `rendu` : résultat de rendreMethode ; `valeurs` : valeursPourJournal(evaluerValeurs(...)).
 */
export function entreeDepuisFiche(procedure, { methode, rendu, valeurs = {}, plateformes = [], auteur = '', date = new Date(), existantes = [] } = {}) {
  const cat = PLATEFORME_VERS_CATEGORIE[plateformes[0]] ?? 'autre';
  const e = entreeVide({ categorieId: cat, auteur, date, existantes });
  e.titre = String(procedure?.titre ?? '').slice(0, 120);
  e.objet = String(procedure?.resume ?? '').slice(0, 2000);
  e.fiches = procedure?.id ? [procedure.id] : [];

  // Adressage
  const v = valeurs;
  const pf = (p) => (p ? `/${p}` : '');
  if (v.gestionSwitch || v.vlanGestion) {
    e.adressage.push({ equipement: v.hoteSw ?? '', interface: v.vlanGestion ? `Vlan${v.vlanGestion}` : '', adresse: `${v.gestionSwitch ?? ''}${pf(v.gestionPrefixe)}`,
      vlan: v.vlanGestion ? `${v.vlanGestion} (gestion)` : '', passerelle: v.gestionPasserelle ?? '', note: 'Adresse de gestion' });
    if (v.gestionPoste) e.adressage.push({ equipement: 'Poste de gestion', interface: v.portGestion ?? '', adresse: `${v.gestionPoste}${pf(v.gestionPrefixe)}`, vlan: v.vlanGestion ?? '', passerelle: v.gestionPasserelle ?? '', note: '' });
  }
  for (const prm of procedure?.params ?? []) {
    if (prm.type !== 'table' || !Array.isArray(v[prm.id])) continue;
    for (const l of v[prm.id]) {
      if (!l || typeof l !== 'object') continue;
      const reseau = l.reseau ? `${l.reseau}${pf(l.prefixe)}` : '';
      e.adressage.push({ equipement: l.nom ? `VLAN ${l.vlan ?? ''} ${l.nom}`.trim() : '', interface: l.ports ?? '', adresse: reseau,
        vlan: l.vlan ?? '', passerelle: l.passerelle ?? '', note: l.poste ? `Poste de test ${l.poste}` : '' });
    }
  }

  // Configuration : une entrée par phase, commandes réellement rendues.
  const etapes = methode?.etapes ?? [];
  const prefixe = COMMENTAIRE[methode?.id] ?? '#';
  const parPhase = new Map();
  (rendu?.etapes ?? []).forEach((r, i) => {
    const src = etapes[i];
    if (!src || src.annulation || src.facultatif || r.rendu?.bloque) return;
    const lignes = (r.rendu?.lignes ?? []).map((l) => l.copie).filter(Boolean);
    if (!lignes.length) return;
    const phase = src.phase || 'Configuration';
    if (!parPhase.has(phase)) parPhase.set(phase, []);
    parPhase.get(phase).push(`${prefixe} ${i + 1}. ${src.titre}`, ...lignes, '');
  });
  for (const [phase, lignes] of parPhase) e.configuration.push({ titre: phase, code: lignes.join('\n').trim() });

  for (const t of methode?.verification ?? []) if (typeof t === 'string' && t.trim()) e.validation.push({ test: t.trim(), attendu: '', resultat: 'a-tester' });
  const ordre = /\(([^)]{3,200})\)/.exec(String(methode?.retour ?? ''))?.[1];
  if (procedure?.titre && (etapes.some((x) => x.annulation) || methode?.retour)) {
    e.retourArriere = `Étapes « Annuler » de la fiche « ${procedure.titre} » du KJEMO IT Toolkit, dans l’ordre inverse${ordre ? ` (${ordre})` : ''}.`;
  }
  // La normalisation refuse tout secret : une fiche ne doit jamais en produire, on le vérifie quand même.
  return normaliserEntree(e);
}

/* ---------------------------------------------------------------------------
 * Sauvegarde et restauration (fichier JSON)
 * ------------------------------------------------------------------------ */
/** Lit la valeur stockée : { entrees: [...] }. Les entrées invalides sont écartées, jamais réparées en silence. */
export function lireJournal(brut) {
  const liste = Array.isArray(brut?.entrees) ? brut.entrees : [];
  const entrees = []; let ecartees = 0;
  for (const x of liste) {
    const { entree, erreurs } = normaliserEntree(x);
    if (Object.keys(erreurs).length) { ecartees++; continue; }
    entrees.push(entree);
  }
  return { entrees, ecartees };
}

/** Fichier de sauvegarde : les entrées et les captures (JPEG en base64). */
export function sauvegardeJournal(entrees, captures = {}, date = new Date()) {
  return JSON.stringify({ format: FORMAT_SAUVEGARDE, version: 1, date: jour(date), entrees, captures }, null, 1);
}

/**
 * Lit un fichier de sauvegarde. Renvoie { entrees, captures, ecartees, erreur }.
 * Les références déjà présentes sont signalées dans `doublons` (l'appelant choisit).
 */
export function lireSauvegarde(texteFichier, existantes = []) {
  let d;
  try { d = JSON.parse(texteFichier); } catch { return { erreur: 'Ce fichier n’est pas un JSON lisible.' }; }
  if (d?.format !== FORMAT_SAUVEGARDE) return { erreur: 'Ce fichier n’est pas une sauvegarde du Journal de labo.' };
  const { entrees, ecartees } = lireJournal(d);
  const captures = {};
  const utiles = new Set(entrees.flatMap((e) => e.captures.map((c) => c.id)));
  for (const [id, b64] of Object.entries(d.captures ?? {})) {
    if (utiles.has(id) && typeof b64 === 'string' && /^[A-Za-z0-9+/=]+$/.test(b64) && b64.length < 8_000_000) captures[id] = b64;
  }
  const refs = new Set(existantes.map((e) => e.id));
  return { entrees, captures, ecartees, doublons: entrees.filter((e) => refs.has(e.id)).map((e) => e.reference), erreur: null };
}
