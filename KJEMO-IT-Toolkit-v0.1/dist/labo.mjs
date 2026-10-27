/**
 * labo.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Mon laboratoire » : la fiche de ton propre environnement (nom du domaine,
 * adresses, comptes de test…) et ta progression, gardées dans CE navigateur.
 *
 * RÈGLES
 *  1. AUCUN secret. Il n'existe aucun champ « mot de passe » ; un champ dont le
 *     nom ressemble à un secret est refusé par le banc ; une valeur est
 *     toujours validée par le validateur du type de champ.
 *  2. AUCUN disque. /dev/sdb, /dev/md127, un gid ou un UUID se relisent sur la
 *     machine à chaque fois : les enregistrer reviendrait à les présumer.
 *  3. Rien ne remplit une fiche à ton insu : « utiliser mon laboratoire » est
 *     un geste explicite, et il ne touche que les champs qu'il connaît.
 *  4. Une case cochée n'est PAS une preuve : le Toolkit n'exécute rien.
 *  5. Le CSV est fabriqué ici, avec des valeurs FICTIVES, puis téléchargé : il
 *     ne quitte jamais le navigateur et ne contient aucun mot de passe.
 *
 * Module PUR : le stockage, le DOM et le téléchargement vivent dans app.js.
 */
import { validerParametre } from './procedures.mjs';

export const CLE_LABO = 'kjemo.labo.v1';
export const CLE_PROGRESSION = 'kjemo.progression.v1';

/**
 * Champs du laboratoire. `vers` : identifiants de paramètres de fiches que ce
 * champ peut remplir (sur demande). `exemple` n'est qu'un exemple affiché.
 */
export const CHAMPS_LABO = [
  { id: 'domaine', label: 'Nom du domaine', type: 'fqdn', exemple: 'serveur2.lan', vers: ['domaine', 'zone'], aide: 'Le nom DNS du domaine Active Directory.' },
  { id: 'serveurDc', label: 'Nom complet du contrôleur de domaine', type: 'fqdn', exemple: 'serverdc.serveur2.lan', vers: ['serveur'], aide: 'Nom d’hôte suivi du domaine.' },
  { id: 'ipDc', label: 'Adresse IPv4 du contrôleur (et de son DNS)', type: 'ipv4', exemple: '172.27.1.210', vers: ['dns'], aide: 'Une adresse FIXE.' },
  { id: 'nomClient', label: 'Nom complet du client Ubuntu', type: 'fqdn', exemple: 'ubuntuclient.serveur2.lan', vers: ['nom'], aide: 'Nom d’hôte suivi du domaine.' },
  { id: 'ipClient', label: 'Adresse IPv4 du client Ubuntu', type: 'ipv4', exemple: '172.27.1.230', vers: ['ip'], aide: 'Une adresse FIXE, hors de la plage DHCP.' },
  { id: 'interface', label: 'Interface réseau du client', type: 'identifiant', exemple: 'ens33', vers: ['interface'], aide: 'Lue avec « ip -br link ».' },
  { id: 'compteAdmin', label: 'Compte qui joint le poste au domaine', type: 'identifiant', exemple: 'administrator', vers: ['admin'], aide: 'Un identifiant, jamais son mot de passe.' },
  { id: 'compteTest', label: 'Compte de domaine pour les essais', type: 'identifiant', exemple: 'user1', vers: ['compteTest'], aide: 'Un identifiant existant dans le domaine.' },
  { id: 'compteEcriture', label: 'Compte autorisé à écrire (partage)', type: 'identifiant', exemple: 'user1tp2', vers: ['ecriture'], aide: 'Un identifiant.' },
  { id: 'compteLecture', label: 'Compte en lecture seule (partage)', type: 'identifiant', exemple: 'user2tp2', vers: ['lecture'], aide: 'Un identifiant différent du précédent.' },
  { id: 'groupe', label: 'Groupe d’un département', type: 'identifiant', exemple: 'Direction', vers: ['groupe'], aide: 'Le nom du groupe Samba.' },
  { id: 'groupeEcriture', label: 'Groupe autorisé à écrire', type: 'identifiant', exemple: 'Direction_Ecriture', vers: ['groupeEcriture'], aide: 'Un second groupe, différent du précédent.' },
  { id: 'partage', label: 'Nom du partage', type: 'identifiant', exemple: 'partage_tp2', vers: ['partage'], aide: 'Le nom que les clients voient.' },
  { id: 'pointMontage', label: 'Dossier de montage', type: 'chemin', exemple: '/DATA_TP2', vers: ['pointMontage'], aide: 'Un chemin absolu sans espace.' },
  { id: 'etiquette', label: 'Étiquette du système de fichiers', type: 'etiquetteExt4', exemple: 'data_tp2', vers: ['etiquette'], aide: '16 caractères au plus.' },
];

const SECRETISH = /mot de passe|password|passwd|secret|passphrase|jeton|token|cl[ée]|uuid|gid|disque|device|sd[a-z]|md\d|nvme/i;

/** Anomalies de la définition des champs (le banc l'appelle ; vide = sain). */
export function incoherencesChamps(champs = CHAMPS_LABO) {
  const pb = []; const vus = new Set();
  for (const c of champs) {
    if (vus.has(c.id)) pb.push(`champ en double : ${c.id}`);
    vus.add(c.id);
    if (SECRETISH.test(`${c.id} ${c.label}`)) pb.push(`champ ${c.id} : ressemble à un secret ou à un périphérique (jamais enregistrés)`);
    const r = validerParametre({ id: c.id, label: c.label, type: c.type }, c.exemple);
    if (!r.ok) pb.push(`champ ${c.id} : son exemple est refusé par son propre validateur (${r.error})`);
    if (!c.vers?.length) pb.push(`champ ${c.id} : ne remplit aucun paramètre`);
  }
  return pb;
}

/**
 * Nettoie ce qui vient du stockage (ou d'un formulaire) : ne garde que les
 * champs connus, valides, sans secret. { valeurs, erreurs }.
 */
export function normaliserLabo(brut) {
  const valeurs = {}; const erreurs = {};
  const src = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  for (const c of CHAMPS_LABO) {
    const v = String(src[c.id] ?? '').trim();
    if (v === '') continue;
    const r = validerParametre({ id: c.id, label: c.label, type: c.type }, v);
    if (r.ok && !r.vide) valeurs[c.id] = r.valeur; else erreurs[c.id] = r.error;
  }
  // Deux comptes (ou deux groupes) identiques n'ont pas de sens ici.
  if (valeurs.compteEcriture && valeurs.compteEcriture === valeurs.compteLecture) erreurs.compteLecture = 'Le compte en lecture doit être différent du compte en écriture.';
  if (valeurs.groupe && valeurs.groupe === valeurs.groupeEcriture) erreurs.groupeEcriture = 'Le groupe d’écriture doit être différent du groupe du département.';
  for (const id of Object.keys(erreurs)) delete valeurs[id];
  return { valeurs, erreurs };
}

/**
 * Saisies d'une fiche remplies depuis le laboratoire — uniquement pour les
 * paramètres que la fiche déclare ET que le laboratoire connaît.
 */
export function saisiesDepuisLabo(procedure, labo) {
  const { valeurs } = normaliserLabo(labo);
  const sortie = {};
  const ids = new Set((procedure.params ?? []).filter((p) => p.type !== 'table').map((p) => p.id));
  for (const c of CHAMPS_LABO) {
    if (valeurs[c.id] === undefined) continue;
    for (const cible of c.vers) if (ids.has(cible)) sortie[cible] = valeurs[c.id];
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Modèle de CSV (valeurs fictives, aucun mot de passe)
// ---------------------------------------------------------------------------

export const EN_TETE_CSV = 'login,departement';
export const LIGNES_CSV_MODELE = [
  { login: 'alice_chef', departement: 'Ventes_Marketing' },
  { login: 'bruno_emp', departement: 'Ventes_Marketing' },
  { login: 'chloe_chef', departement: 'Finances' },
  { login: 'david_ti', departement: 'Technologies_Information' },
];

const LOGIN = /^[a-z0-9_]{1,20}$/;
const DEPARTEMENT = /^[A-Za-z0-9_]{1,40}$/;

/** Anomalies d'une ligne (même règle que le script de la fiche). */
export function erreursLigneCsv(ligne) {
  const e = [];
  if (!LOGIN.test(String(ligne?.login ?? ''))) e.push('login : 1 à 20 caractères parmi minuscules, chiffres et « _ »');
  if (!DEPARTEMENT.test(String(ligne?.departement ?? ''))) e.push('département : 1 à 40 caractères parmi lettres, chiffres et « _ »');
  return e;
}

/** Texte du CSV (LF, sans BOM, une ligne par compte) ; null si une ligne est invalide. */
export function csvDepuisLignes(lignes) {
  if (!Array.isArray(lignes) || !lignes.length || lignes.length > 50) return null;
  const vus = new Set();
  for (const l of lignes) {
    if (erreursLigneCsv(l).length || vus.has(l.login)) return null;
    vus.add(l.login);
  }
  return `${[EN_TETE_CSV, ...lignes.map((l) => `${l.login},${l.departement}`)].join('\n')}\n`;
}

/** Lit un texte « login,departement » par ligne ; { lignes, erreurs:[{ligne,message}] }. */
export function lignesDepuisTexte(texte) {
  const lignes = []; const erreurs = []; const vus = new Set();
  String(texte ?? '').replace(/\r/g, '').split('\n').forEach((brut, i) => {
    const s = brut.trim();
    if (!s || s === EN_TETE_CSV) return;
    const morceaux = s.split(',');
    if (morceaux.length !== 2) { erreurs.push({ ligne: i + 1, message: 'Deux champs séparés par une virgule : login,departement (pas de mot de passe).' }); return; }
    const l = { login: morceaux[0].trim(), departement: morceaux[1].trim() };
    const pb = erreursLigneCsv(l);
    if (pb.length) { erreurs.push({ ligne: i + 1, message: pb.join(' ; ') }); return; }
    if (vus.has(l.login)) { erreurs.push({ ligne: i + 1, message: `le login ${l.login} figure déjà plus haut` }); return; }
    vus.add(l.login); lignes.push(l);
  });
  if (lignes.length > 50) erreurs.push({ ligne: 0, message: '50 lignes au plus.' });
  return { lignes, erreurs };
}

// ---------------------------------------------------------------------------
// Progression (cases cochées) — jamais une preuve
// ---------------------------------------------------------------------------

/** Garde seulement les identifiants d'éléments connus. */
export function normaliserProgression(brut, cours) {
  const connus = new Set(cours.flatMap((c) => c.parcours.flatMap((p) => p.items.map((i) => `${c.id}:${i.id}`))));
  const src = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const sortie = {};
  for (const [k, v] of Object.entries(src)) if (connus.has(k) && v === true) sortie[k] = true;
  return sortie;
}

export function basculer(progression, coursId, itemId) {
  const k = `${coursId}:${itemId}`;
  const suite = { ...progression };
  if (suite[k]) delete suite[k]; else suite[k] = true;
  return suite;
}

/** { faits, total, couverts } d'un parcours : « couverts » exclut les éléments non couverts par le catalogue. */
export function avancement(cours, parcours, progression) {
  const items = parcours.items;
  const faits = items.filter((i) => progression[`${cours.id}:${i.id}`]).length;
  return { faits, total: items.length, couverts: items.filter((i) => i.couvert !== false).length };
}
