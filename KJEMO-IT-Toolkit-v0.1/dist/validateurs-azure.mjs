/**
 * validateurs-azure.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Validation des champs des assistants Azure et Microsoft Entra ID.
 *
 * Principe, hérité des lots précédents : on REFUSE, on n'échappe pas. Un nom de
 * ressource Azure suit un alphabet précis ; tout caractère hors de cet alphabet
 * (guillemet, point-virgule, antislash, saut de ligne, joker) est une erreur de
 * saisie ou une tentative d'injection, et dans les deux cas le script n'est pas
 * généré. En plus, chaque valeur est transportée dans le script par psB64, donc
 * même une valeur qui passerait ici ne peut pas sortir de sa chaîne.
 *
 * Deux règles propres au cloud :
 *
 *   1. AUCUN SECRET dans un champ. Une clé de compte, un jeton SAS, un secret
 *      d'application ou un jeton d'accès collé « pour essayer » finirait dans un
 *      script, un presse-papiers, un rapport. Le validateur reconnaît les
 *      formes usuelles et refuse. Ce n'est pas une garantie (un secret peut
 *      ressembler à n'importe quoi) mais c'est la dernière ligne de défense : la
 *      première est qu'AUCUN champ ne demande de secret.
 *
 *   2. AUCUN JOKER dans un nom de cible. Get-AzVM -Name 'vm*' retourne
 *      plusieurs machines ; une action sur « la » VM deviendrait une action sur
 *      toutes. Les caractères * et ? sont refusés dans les noms.
 *
 * Ce module n'importe rien (comme noyau.mjs) pour éviter tout cycle.
 */

/** Identifiants d'exemple : volontairement faux, jamais acceptés à l'exécution. */
export const GUID_EXEMPLE_TENANT = '11111111-1111-1111-1111-111111111111';
export const GUID_EXEMPLE_ABONNEMENT = '22222222-2222-2222-2222-222222222222';
export const GUID_NUL = '00000000-0000-0000-0000-000000000000';

const RE_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_CONTROLE = /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;

/**
 * Formes de secrets reconnues. La liste est volontairement courte et lisible :
 * chaque entrée correspond à une fuite réelle fréquente en administration Azure.
 */
export const MOTIFS_SECRETS = [
  { nom: 'clé de compte de stockage', re: /AccountKey\s*=|DefaultEndpointsProtocol\s*=|[A-Za-z0-9+/]{86}==/ },
  { nom: 'jeton SAS', re: /(^|[?&;])(sig|sv|se|sp|srt|ss)=/i },
  { nom: 'URL signée', re: /SharedAccessSignature|\bsig=[A-Za-z0-9%+/=]{10,}/i },
  { nom: 'jeton d’accès (JWT)', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { nom: 'en-tête d’autorisation', re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/i },
  { nom: 'secret d’application', re: /client[_ -]?secret|\bsecret\s*[:=]|app[_ -]?secret/i },
  { nom: 'mot de passe', re: /\b(password|passwd|pwd|mot de passe|motdepasse)\b\s*[:=]?|p[a@4]ss?w[o0]rd/i },
  { nom: 'clé privée', re: /BEGIN [A-Z ]*PRIVATE KEY/ },
];

/** Noms des secrets reconnus dans `v`, ou [] si rien ne ressemble à un secret. */
export function secretsDans(v) {
  const s = String(v ?? '');
  return MOTIFS_SECRETS.filter((m) => m.re.test(s)).map((m) => m.nom);
}

function refuse(value, error) { return { ok: false, value, error }; }
function accepte(value) { return { ok: true, value, error: null }; }

/** Contrôles communs à tout texte saisi : vide, contrôle, secret. */
function base(v, label, { vide = false } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return vide ? accepte('') : refuse(s, `${label} est obligatoire : aucun contexte par défaut n’est choisi à ta place.`);
  if (RE_CONTROLE.test(String(v))) return refuse(s, `${label} contient un caractère de contrôle ou un retour à la ligne.`);
  const sec = secretsDans(s);
  if (sec.length) return refuse(s, `${label} ressemble à un secret (${sec[0]}) : aucun secret n’est accepté dans ce formulaire.`);
  return null;
}

/** GUID (identifiant de tenant, d’abonnement, d’objet). Le GUID nul est refusé. */
export function validerGuid(v, label = 'L’identifiant') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (!RE_GUID.test(s)) return refuse(s, `${label} doit être un GUID (8-4-4-4-12 caractères hexadécimaux).`);
  if (s === GUID_NUL) return refuse(s, `${label} ne peut pas être le GUID nul : c’est un marqueur vide, pas une cible.`);
  return accepte(s.toLowerCase());
}

/** Nom de groupe de ressources : lettres, chiffres, _ ( ) - . ; 1 à 90 ; pas de point final. */
export function validerGroupeRessources(v, label = 'Le groupe de ressources') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (s.length > 90) return refuse(s, `${label} fait au plus 90 caractères.`);
  if (!/^[\p{L}\p{N}_().-]+$/u.test(s)) return refuse(s, `${label} n’accepte que lettres, chiffres, _ - . ( ) — ni joker, ni guillemet, ni espace.`);
  if (s.endsWith('.')) return refuse(s, `${label} ne peut pas se terminer par un point.`);
  return accepte(s);
}

/** Nom de machine virtuelle : 1 à 64, alphanumérique, - _ . ; pas de joker. */
export function validerNomVm(v, label = 'La machine virtuelle') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(s)) return refuse(s, `${label} : 1 à 64 caractères, lettres, chiffres, - _ . ; elle commence par une lettre ou un chiffre. Aucun joker.`);
  if (s.endsWith('.') || s.endsWith('-')) return refuse(s, `${label} ne peut pas finir par « . » ou « - ».`);
  return accepte(s);
}

/** Nom de ressource réseau (VNet, NSG, NIC, IP publique) : 1 à 80, alphanumérique, - _ . */
export function validerNomRessource(v, label = 'La ressource') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(s)) return refuse(s, `${label} : 1 à 80 caractères, lettres, chiffres, - _ . ; elle commence par une lettre ou un chiffre. Aucun joker.`);
  if (/[._-]$/.test(s)) return refuse(s, `${label} ne peut pas se terminer par « . », « _ » ou « - ».`);
  return accepte(s);
}

/** Nom de compte de stockage : 3 à 24 minuscules et chiffres. */
export function validerNomStockage(v, label = 'Le compte de stockage') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (!/^[a-z0-9]{3,24}$/.test(s)) return refuse(s, `${label} : 3 à 24 caractères, minuscules et chiffres seulement.`);
  return accepte(s);
}

/** Nom de coffre Recovery Services : 2 à 50, lettres/chiffres/-, commence par une lettre. */
export function validerNomCoffre(v, label = 'Le coffre') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (!/^[A-Za-z][A-Za-z0-9-]{1,49}$/.test(s)) return refuse(s, `${label} : 2 à 50 caractères, lettres, chiffres et tirets ; il commence par une lettre.`);
  if (s.endsWith('-')) return refuse(s, `${label} ne peut pas finir par un tiret.`);
  return accepte(s);
}

/** Nom de domaine ou d’hôte à résoudre. */
export function validerNomDns(v, label = 'Le nom DNS') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim().toLowerCase();
  if (s.length > 253) return refuse(s, `${label} fait au plus 253 caractères.`);
  const etiquettes = s.split('.');
  if (etiquettes.length < 2) return refuse(s, `${label} doit être complet (ex. monapp.contoso.com).`);
  for (const e of etiquettes) {
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(e)) return refuse(s, `${label} : chaque étiquette fait 1 à 63 caractères (lettres, chiffres, tirets), sans tiret au début ni à la fin.`);
  }
  return accepte(s);
}

/** Nom d’utilisateur principal (UPN) ou GUID d’objet Entra. */
export function validerUtilisateur(v, label = 'L’utilisateur', { vide = false } = {}) {
  const b = base(v, label, { vide });
  if (b) return b;
  const s = String(v).trim();
  if (!s) return accepte('');
  if (RE_GUID.test(s)) return s === GUID_NUL ? refuse(s, `${label} ne peut pas être le GUID nul.`) : accepte(s.toLowerCase());
  if (!/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(s)) return refuse(s, `${label} : un nom d’utilisateur principal (prenom.nom@contoso.com) ou un GUID d’objet.`);
  if (s.length > 113) return refuse(s, `${label} : 113 caractères au plus.`);
  return accepte(s);
}

/** Début de nom (Graph startsWith) : lettres, chiffres, espace, . - _ ' sans guillemet ni joker. */
export function validerDebutNom(v, label = 'Le début du nom', { vide = true } = {}) {
  const b = base(v, label, { vide });
  if (b) return b;
  const s = String(v).trim();
  if (!s) return accepte('');
  if (s.length > 64) return refuse(s, `${label} : 64 caractères au plus.`);
  if (!/^[\p{L}\p{N} ._-]+$/u.test(s)) return refuse(s, `${label} n’accepte que lettres, chiffres, espace et . _ - (ni apostrophe, ni guillemet, ni joker, ni opérateur).`);
  return accepte(s);
}

/** Entier borné. */
export function validerBorne(v, min, max, label = 'La valeur') {
  const s = String(v ?? '').trim();
  if (!s) return refuse(s, `${label} ne peut pas être vide.`);
  if (!/^\d+$/.test(s)) return refuse(s, `${label} doit être un entier positif, sans lettre ni décimale.`);
  const n = Number(s);
  if (String(n) !== s) return refuse(s, `${label} ne doit pas comporter de zéro de tête.`);
  if (n < min || n > max) return refuse(s, `${label} doit être comprise entre ${min} et ${max}.`);
  return accepte(n);
}

/** Choix dans une liste fermée. */
export function validerChoixAzure(v, autorises, label = 'Le choix') {
  const s = String(v ?? '').trim();
  if (!autorises.includes(s)) return refuse(s, `${label} : une des valeurs ${autorises.join(', ')}.`);
  return accepte(s);
}

/** Étiquette de laboratoire (nom=valeur d’étiquette) : lettres, chiffres, - _ . */
export function validerEtiquette(v, label = 'L’étiquette') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(s)) return refuse(s, `${label} : 1 à 64 caractères, lettres, chiffres, - _ .`);
  return accepte(s);
}

/** Phrase de confirmation : doit être EXACTEMENT celle attendue (casse comprise). */
export function validerConfirmation(v, attendue, label = 'La confirmation') {
  const s = String(v ?? '');
  if (s !== attendue) return refuse(s, `${label} : recopie exactement la phrase « ${attendue} » (majuscules comprises) pour passer en mode Appliquer.`);
  return accepte(s);
}

/** Libellés usuels de lieu Azure (région) : minuscules et chiffres, ex. canadacentral. */
export function validerRegion(v, label = 'La région') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (!/^[a-z][a-z0-9]{2,40}$/.test(s)) return refuse(s, `${label} : le nom court Azure, en minuscules (ex. canadacentral).`);
  return accepte(s);
}
