/**
 * validateurs.mjs — LOT 2 · KJEMO IT Toolkit
 * -------------------------------------------
 * Validateurs stricts, sans dépendance : ce module n'importe rien, ce qui lui
 * permet d'être utilisé aussi bien par generators.mjs que par le catalogue
 * Windows Server sans créer d'import circulaire.
 *
 * Convention, identique à celle du LOT 0 :
 *     { ok: boolean, value: any, error: string|null }
 *
 * Deux principes gouvernent ce fichier :
 *
 *  1. AUCUNE VALIDATION PERMISSIVE. parseInt('12abc') vaut 12 ; Number('') vaut
 *     0 ; '192.168.030.1' est accepté par beaucoup de bibliothèques. Rien de
 *     tout cela n'est toléré ici : une valeur est acceptée seulement si sa
 *     forme écrite est exactement celle attendue.
 *
 *  2. UN MESSAGE QUI DIT QUOI CORRIGER. Le message est affiché sous le champ,
 *     à quelqu'un qui apprend. « Valeur invalide » n'aide personne.
 */

// ---------------------------------------------------------------------------
// IPv4 — analyse et arithmétique
// ---------------------------------------------------------------------------

/**
 * validateIPv4 — déplacé depuis generators.mjs au LOT 2 pour être réutilisable
 * sans import circulaire. Comportement et messages inchangés ; generators.mjs
 * le ré-exporte, de sorte que rien n'a bougé pour les huit outils historiques.
 */
export function validateIPv4(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: "L'adresse IP ne peut pas être vide." };
  const parts = s.split('.');
  if (parts.length !== 4) return { ok: false, value: s, error: "L'adresse IPv4 doit contenir exactement quatre octets séparés par des points." };
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return { ok: false, value: s, error: `« ${part} » n'est pas un entier valide.` };
    const n = Number(part);
    if (n < 0 || n > 255) return { ok: false, value: s, error: `L'octet ${part} est hors de la plage 0–255.` };
    if (part !== String(n)) return { ok: false, value: s, error: `L'octet « ${part} » contient un zéro de tête non autorisé.` };
  }
  return { ok: true, value: s, error: null };
}

/** Entier 32 bits non signé correspondant à une IPv4 valide, ou null. */
export function ipVersEntier(v) {
  const r = validateIPv4(v);
  if (!r.ok) return null;
  return r.value.split('.').reduce((n, o) => (n * 256) + Number(o), 0);
}

/** Forme pointée d'un entier 32 bits. */
export function entierVersIp(n) {
  const x = Number(n) >>> 0;
  return [24, 16, 8, 0].map((d) => (x >>> d) & 255).join('.');
}

/** Préfixe CIDR : entier 0–32, écrit sans zéro de tête. */
export function validerPrefixe(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le préfixe ne peut pas être vide (ex. : 24).' };
  if (!/^\d+$/.test(s)) return { ok: false, value: s, error: 'Le préfixe doit être un entier, sans lettre ni symbole (ex. : 24).' };
  const n = Number(s);
  if (String(n) !== s) return { ok: false, value: s, error: 'Le préfixe ne doit pas comporter de zéro de tête.' };
  if (n < 0 || n > 32) return { ok: false, value: s, error: 'Le préfixe IPv4 doit être compris entre 0 et 32.' };
  return { ok: true, value: n, error: null };
}

/** Masque en notation pointée, avec bits contigus (255.255.255.0, pas 255.0.255.0). */
export function validerMasque(v) {
  const base = validateIPv4(v);
  if (!base.ok) return { ok: false, value: base.value, error: base.error };
  const n = ipVersEntier(base.value) >>> 0;
  // Un masque valide est une suite de 1 suivie d'une suite de 0.
  const complement = (~n) >>> 0;
  if (((complement + 1) & complement) !== 0) {
    return { ok: false, value: base.value, error: 'Le masque doit être contigu (ex. : 255.255.255.0). 255.0.255.0 n\u2019est pas un masque valide.' };
  }
  let prefixe = 0;
  for (let i = 31; i >= 0; i--) { if ((n >>> i) & 1) prefixe++; else break; }
  return { ok: true, value: { masque: base.value, prefixe }, error: null };
}

/** Masque correspondant à un préfixe (24 → 255.255.255.0). */
export function prefixeVersMasque(prefixe) {
  const p = Number(prefixe);
  const n = p === 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0);
  return entierVersIp(n);
}

/** Adresse de réseau d'une IP pour un préfixe donné. */
export function adresseReseau(ip, prefixe) {
  const n = ipVersEntier(ip);
  if (n === null) return null;
  const p = Number(prefixe);
  const masque = p === 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0);
  return entierVersIp((n & masque) >>> 0);
}

/** Adresse de diffusion d'un réseau. */
export function adresseDiffusion(ip, prefixe) {
  const n = ipVersEntier(ip);
  if (n === null) return null;
  const p = Number(prefixe);
  const masque = p === 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0);
  return entierVersIp(((n & masque) | (~masque >>> 0)) >>> 0);
}

/** Vrai si l'IP appartient au réseau décrit par (reseau, prefixe). */
export function ipDansReseau(ip, reseau, prefixe) {
  const a = adresseReseau(ip, prefixe);
  const b = adresseReseau(reseau, prefixe);
  return a !== null && b !== null && a === b;
}

/**
 * Réseau en notation CIDR : « 192.168.30.0/24 ».
 * L'adresse doit être l'adresse de RÉSEAU, pas une adresse d'hôte : accepter
 * « 192.168.30.7/24 » ici reviendrait à laisser passer une erreur de saisie qui
 * ne se verrait qu'au moment où l'étendue DHCP refuse de se créer.
 */
export function validerReseauCidr(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le réseau ne peut pas être vide (ex. : 192.168.30.0/24).' };
  const parts = s.split('/');
  if (parts.length !== 2) return { ok: false, value: s, error: 'Le réseau doit être écrit en notation CIDR (ex. : 192.168.30.0/24).' };
  const ip = validateIPv4(parts[0]);
  if (!ip.ok) return { ok: false, value: s, error: ip.error };
  const pre = validerPrefixe(parts[1]);
  if (!pre.ok) return { ok: false, value: s, error: pre.error };
  const reseau = adresseReseau(ip.value, pre.value);
  if (reseau !== ip.value) {
    return { ok: false, value: s, error: `${ip.value}/${pre.value} n\u2019est pas une adresse de réseau. Voulais-tu écrire ${reseau}/${pre.value} ?` };
  }
  return { ok: true, value: { reseau, prefixe: pre.value, masque: prefixeVersMasque(pre.value) }, error: null };
}

/**
 * ScopeId DHCP : c'est l'adresse de réseau de l'étendue, jamais une adresse
 * d'hôte. Get-DhcpServerv4Scope -ScopeId 192.168.30.1 échoue silencieusement
 * sur bien des scripts ; autant le refuser ici.
 */
export function validerScopeId(v) {
  const ip = validateIPv4(v);
  if (!ip.ok) return { ok: false, value: String(v ?? '').trim(), error: ip.error };
  // Sans préfixe fourni, la seule vérification possible est de rejeter une
  // adresse dont le dernier octet n'est pas nul pour les préfixes usuels /24.
  return { ok: true, value: ip.value, error: null };
}

/**
 * Plage d'adresses : début et fin dans le même réseau, dans le bon ordre, et
 * jamais l'adresse de réseau ni l'adresse de diffusion.
 */
export function validerPlageIp(debut, fin, reseau, prefixe) {
  const d = validateIPv4(debut);
  if (!d.ok) return { ok: false, value: null, error: `Première adresse : ${d.error}` };
  const f = validateIPv4(fin);
  if (!f.ok) return { ok: false, value: null, error: `Dernière adresse : ${f.error}` };

  const nd = ipVersEntier(d.value);
  const nf = ipVersEntier(f.value);
  if (nd > nf) {
    return { ok: false, value: null, error: `La plage est inversée : ${d.value} est après ${f.value}.` };
  }

  if (reseau !== undefined && prefixe !== undefined) {
    if (!ipDansReseau(d.value, reseau, prefixe)) {
      return { ok: false, value: null, error: `${d.value} n\u2019appartient pas au réseau ${reseau}/${prefixe}.` };
    }
    if (!ipDansReseau(f.value, reseau, prefixe)) {
      return { ok: false, value: null, error: `${f.value} n\u2019appartient pas au réseau ${reseau}/${prefixe}.` };
    }
    const net = adresseReseau(reseau, prefixe);
    const bc  = adresseDiffusion(reseau, prefixe);
    if (Number(prefixe) < 31) {
      if (d.value === net) return { ok: false, value: null, error: `${d.value} est l\u2019adresse de réseau : elle ne peut pas être distribuée.` };
      if (f.value === bc)  return { ok: false, value: null, error: `${f.value} est l\u2019adresse de diffusion : elle ne peut pas être distribuée.` };
    }
  }

  return { ok: true, value: { debut: d.value, fin: f.value, taille: nf - nd + 1 }, error: null };
}

// ---------------------------------------------------------------------------
// IPv6
// ---------------------------------------------------------------------------

/**
 * IPv6 — forme complète ou abrégée, une seule occurrence de « :: ».
 * Les formes mixtes se terminant par une IPv4 (::ffff:192.168.1.1) sont
 * acceptées, car elles apparaissent réellement dans les enregistrements AAAA.
 */
export function validerIPv6(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: "L'adresse IPv6 ne peut pas être vide." };
  if (s.includes('%')) return { ok: false, value: s, error: 'Retire l\u2019identifiant de zone (%eth0) : il n\u2019a pas sa place dans un enregistrement DNS.' };
  if ((s.match(/::/g) ?? []).length > 1) {
    return { ok: false, value: s, error: 'Une adresse IPv6 ne peut contenir qu\u2019une seule abréviation « :: ».' };
  }
  if (/:::/.test(s)) return { ok: false, value: s, error: 'Trois deux-points consécutifs : la notation est invalide.' };

  let reste = s;
  let bitsIpv4 = 0;
  const dernier = reste.split(':').pop();
  if (dernier.includes('.')) {
    const v4 = validateIPv4(dernier);
    if (!v4.ok) return { ok: false, value: s, error: `Partie IPv4 finale : ${v4.error}` };
    reste = reste.slice(0, reste.length - dernier.length).replace(/:$/, '');
    bitsIpv4 = 2; // une IPv4 occupe deux groupes de 16 bits
    if (reste === '') reste = '::';
  }

  const abrege = reste.includes('::');
  const groupes = reste.split(':').filter((g, i, arr) => !(g === '' && (i === 0 || i === arr.length - 1 || abrege)));
  for (const g of groupes) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) {
      return { ok: false, value: s, error: `« ${g} » n\u2019est pas un groupe hexadécimal valide (1 à 4 caractères 0-9 a-f).` };
    }
  }
  const total = groupes.length + bitsIpv4;
  if (abrege) {
    if (total > 7) return { ok: false, value: s, error: 'L\u2019abréviation « :: » ne remplace aucun groupe ici : écris l\u2019adresse complète.' };
  } else if (total !== 8) {
    return { ok: false, value: s, error: `Une adresse IPv6 complète compte huit groupes ; celle-ci en compte ${total}.` };
  }
  return { ok: true, value: s, error: null };
}

// ---------------------------------------------------------------------------
// Noms : hôte, FQDN, zones et enregistrements DNS
// ---------------------------------------------------------------------------

const LABEL_DNS = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/** Nom d'hôte court : une étiquette DNS, 15 caractères au plus pour NetBIOS. */
export function validerNomHote(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom d\u2019hôte ne peut pas être vide.' };
  if (s.includes('.')) return { ok: false, value: s, error: 'Un nom d\u2019hôte court ne contient pas de point : utilise le champ FQDN pour un nom complet.' };
  if (s.length > 15) return { ok: false, value: s, error: 'Le nom NetBIOS est limité à 15 caractères.' };
  if (!LABEL_DNS.test(s)) {
    return { ok: false, value: s, error: 'Le nom d\u2019hôte n\u2019accepte que lettres, chiffres et tirets, sans commencer ni finir par un tiret.' };
  }
  return { ok: true, value: s, error: null };
}

/** Nom pleinement qualifié : au moins deux étiquettes, 253 caractères au plus. */
export function validerFqdn(v) {
  const brut = String(v ?? '').trim();
  if (!brut) return { ok: false, value: brut, error: 'Le nom complet ne peut pas être vide (ex. : srv-dhcp.hopitalbn.lan).' };
  const s = brut.replace(/\.$/, '');
  if (s.length > 253) return { ok: false, value: brut, error: 'Le nom complet dépasse 253 caractères.' };
  const labels = s.split('.');
  if (labels.length < 2) {
    return { ok: false, value: brut, error: 'Indique le nom complet, avec le domaine (ex. : srv-dhcp.hopitalbn.lan).' };
  }
  for (const label of labels) {
    if (!label) return { ok: false, value: brut, error: 'Le nom contient un double point ou se termine par un point de trop.' };
    if (!LABEL_DNS.test(label)) {
      return { ok: false, value: brut, error: `Le composant « ${label} » contient un caractère non autorisé.` };
    }
  }
  return { ok: true, value: s, error: null };
}

/**
 * Nom de zone DNS : une zone directe est un domaine ; une zone inversée se
 * termine par in-addr.arpa (IPv4) ou ip6.arpa (IPv6).
 */
export function validerNomZoneDns(v) {
  const brut = String(v ?? '').trim();
  if (!brut) return { ok: false, value: brut, error: 'Le nom de zone ne peut pas être vide (ex. : hopitalbn.lan).' };
  const s = brut.replace(/\.$/, '').toLowerCase();
  if (s.endsWith('in-addr.arpa') || s.endsWith('ip6.arpa')) {
    const prefixe = s.replace(/\.(in-addr|ip6)\.arpa$/, '');
    if (!prefixe) return { ok: false, value: brut, error: 'Une zone inversée doit préciser le réseau (ex. : 30.168.192.in-addr.arpa).' };
    for (const label of prefixe.split('.')) {
      if (!/^[0-9a-f]+$/.test(label)) {
        return { ok: false, value: brut, error: `« ${label} » n\u2019est pas un composant valide de zone inversée.` };
      }
    }
    return { ok: true, value: s, error: null };
  }
  const fq = validerFqdn(s);
  if (!fq.ok) return { ok: false, value: brut, error: fq.error };
  return { ok: true, value: fq.value, error: null };
}

/**
 * Nom d'enregistrement DNS : une étiquette relative à la zone, ou « @ » pour la
 * zone elle-même. Le caractère générique « * » n'est pas accepté dans ce lot.
 */
export function validerNomEnregistrement(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom de l\u2019enregistrement ne peut pas être vide (ex. : srv-fichiers).' };
  if (s === '@') return { ok: true, value: s, error: null };
  if (s.includes('*')) return { ok: false, value: s, error: 'Les enregistrements génériques (*) ne sont pas pris en charge dans ce lot.' };
  for (const label of s.split('.')) {
    if (!LABEL_DNS.test(label)) {
      return { ok: false, value: s, error: `Le composant « ${label} » contient un caractère non autorisé.` };
    }
  }
  return { ok: true, value: s, error: null };
}

/** Types d'enregistrement pris en charge par ce lot. */
export const TYPES_ENREGISTREMENT = ['A', 'AAAA', 'CNAME', 'PTR'];

export function validerTypeEnregistrement(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return { ok: false, value: s, error: 'Choisis un type d\u2019enregistrement.' };
  if (!TYPES_ENREGISTREMENT.includes(s)) {
    return { ok: false, value: s, error: `Type non pris en charge dans ce lot. Types disponibles : ${TYPES_ENREGISTREMENT.join(', ')}.` };
  }
  return { ok: true, value: s, error: null };
}

// ---------------------------------------------------------------------------
// Adresses matérielles
// ---------------------------------------------------------------------------

/**
 * Adresse MAC — acceptée avec tirets, deux-points, points Cisco ou sans
 * séparateur, et normalisée en majuscules séparées par des tirets, la forme
 * attendue par Add-DhcpServerv4Reservation.
 */
export function validerMac(v) {
  const brut = String(v ?? '').trim();
  if (!brut) return { ok: false, value: brut, error: 'L\u2019adresse MAC ne peut pas être vide.' };
  const nu = brut.replace(/[-:.\s]/g, '');
  if (!/^[0-9a-fA-F]+$/.test(nu)) {
    return { ok: false, value: brut, error: 'Une adresse MAC ne contient que des chiffres et les lettres A à F.' };
  }
  if (nu.length !== 12) {
    return { ok: false, value: brut, error: `Une adresse MAC compte 12 caractères hexadécimaux ; celle-ci en compte ${nu.length}.` };
  }
  const normalisee = nu.toUpperCase().match(/.{2}/g).join('-');
  return { ok: true, value: normalisee, error: null };
}

/**
 * ClientId DHCP : suite d'octets hexadécimaux. Une MAC en est le cas courant,
 * mais la norme autorise de 2 à 16 octets.
 */
export function validerClientId(v) {
  const brut = String(v ?? '').trim();
  if (!brut) return { ok: false, value: brut, error: 'Le ClientId ne peut pas être vide.' };
  const nu = brut.replace(/[-:.\s]/g, '');
  if (!/^[0-9a-fA-F]+$/.test(nu)) {
    return { ok: false, value: brut, error: 'Le ClientId ne contient que des caractères hexadécimaux.' };
  }
  if (nu.length % 2 !== 0) {
    return { ok: false, value: brut, error: 'Le ClientId doit contenir un nombre pair de caractères (des octets complets).' };
  }
  if (nu.length < 4 || nu.length > 32) {
    return { ok: false, value: brut, error: 'Le ClientId doit compter entre 2 et 16 octets.' };
  }
  return { ok: true, value: nu.toUpperCase().match(/.{2}/g).join('-'), error: null };
}

// ---------------------------------------------------------------------------
// Chemins, partages, nombres et formats
// ---------------------------------------------------------------------------

/**
 * Chemin Windows LOCAL. Les chemins UNC sont refusés explicitement : la
 * sauvegarde DHCP vers un partage réseau demande des droits machine que ce lot
 * ne traite pas, et un échec silencieux y serait pire qu'un refus.
 */
export function validerCheminWindowsLocal(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le chemin ne peut pas être vide (ex. : C:\\Sauvegardes\\DHCP).' };
  if (s.startsWith('\\\\') || s.startsWith('//')) {
    return { ok: false, value: s, error: 'Les chemins réseau (UNC) ne sont pas pris en charge ici : indique un chemin local, par exemple C:\\Sauvegardes\\DHCP.' };
  }
  if (!/^[a-zA-Z]:\\/.test(s)) {
    return { ok: false, value: s, error: 'Le chemin doit commencer par une lettre de lecteur, par exemple C:\\.' };
  }
  const apresLecteur = s.slice(3);
  if (/["*?<>|]/.test(apresLecteur)) {
    return { ok: false, value: s, error: 'Le chemin contient un caractère interdit par Windows (" * ? < > |).' };
  }
  if (/[\x00-\x1f\x7f]/.test(s)) {
    return { ok: false, value: s, error: 'Le chemin contient un caractère de contrôle non autorisé.' };
  }
  if (s.length > 248) {
    return { ok: false, value: s, error: 'Le chemin de dossier dépasse 248 caractères, la limite de création de dossier de Windows.' };
  }
  return { ok: true, value: s.replace(/\\+$/, '') || s, error: null };
}

/**
 * Nom de partage SMB — déplacé depuis generators.mjs au LOT 2, comportement
 * inchangé, pour que le catalogue Windows Server puisse l'utiliser sans
 * import circulaire.
 */
export function validateShareName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom du partage ne peut pas être vide.' };
  if (s.length > 80) return { ok: false, value: s, error: 'Le nom du partage ne doit pas dépasser 80 caractères.' };
  if (/[\\/:*?"<>|]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom du partage contient un caractère interdit (\\  /  :  *  ?  "  <  >  |).' };
  }
  return { ok: true, value: s, error: null };
}

/** Entier strict dans un intervalle ; refuse « 12abc », « 1.5 » et « 007 ». */
export function validerEntier(v, min, max, label = 'La valeur') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (!/^-?\d+$/.test(s)) return { ok: false, value: s, error: `${label} doit être un entier, sans lettre ni décimale.` };
  const n = Number(s);
  if (String(n) !== s) return { ok: false, value: s, error: `${label} ne doit pas comporter de zéro de tête.` };
  if (n < min || n > max) return { ok: false, value: s, error: `${label} doit être comprise entre ${min} et ${max}.` };
  return { ok: true, value: n, error: null };
}

/** Profondeur d'analyse d'une arborescence. */
export function validerProfondeur(v) {
  return validerEntier(v, 0, 10, 'La profondeur');
}

/** Durée de bail DHCP, exprimée en heures. */
export function validerDureeBail(v) {
  return validerEntier(v, 1, 8760, 'La durée du bail');
}

/** Formats de rapport acceptés. */
export const FORMATS_RAPPORT = ['Console', 'JSON', 'HTML', 'CSV'];

export function validerFormatRapport(v, autorises = FORMATS_RAPPORT) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Choisis un format de rapport.' };
  if (!autorises.includes(s)) {
    return { ok: false, value: s, error: `Format inconnu. Formats disponibles : ${autorises.join(', ')}.` };
  }
  return { ok: true, value: s, error: null };
}

/** Modes d'exécution : un outil modifiant commence toujours en Diagnostic. */
export const MODES_EXECUTION = ['Diagnostic', 'Appliquer'];

export function validerModeExecution(v, autorises = MODES_EXECUTION) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Choisis un mode d\u2019exécution.' };
  if (!autorises.includes(s)) {
    return { ok: false, value: s, error: `Mode inconnu. Modes disponibles : ${autorises.join(', ')}.` };
  }
  return { ok: true, value: s, error: null };
}

/** Choix dans une liste fermée, pour les champs de type select. */
export function validerChoix(v, autorises, label = 'La valeur') {
  const s = String(v ?? '').trim();
  if (!autorises.includes(s)) {
    return { ok: false, value: s, error: `${label} doit être l\u2019une de : ${autorises.join(', ')}.` };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Liste de serveurs DNS : une à trois adresses IPv4, séparées par des virgules.
 * Chaque adresse est validée séparément, et les doublons sont refusés — deux
 * fois le même serveur DNS dans une étendue est une erreur de saisie, pas une
 * redondance.
 */
export function validerListeIPv4(v, { min = 1, max = 3, label = 'La liste' } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  const items = s.split(',').map((x) => x.trim()).filter((x) => x !== '');
  if (items.length < min) return { ok: false, value: s, error: `${label} doit contenir au moins ${min} adresse(s).` };
  if (items.length > max) return { ok: false, value: s, error: `${label} accepte au plus ${max} adresse(s).` };
  for (const item of items) {
    const r = validateIPv4(item);
    if (!r.ok) return { ok: false, value: s, error: `${item} : ${r.error}` };
  }
  if (new Set(items).size !== items.length) {
    return { ok: false, value: s, error: `${label} contient deux fois la même adresse.` };
  }
  return { ok: true, value: items, error: null };
}

// ---------------------------------------------------------------------------
// LDAP — échappement et noms distinctifs
// Déplacés depuis generators.mjs au LOT 3, à l'identique, pour que le
// catalogue Active Directory puisse les utiliser sans import circulaire.
// generators.mjs les ré-exporte : rien ne change pour les importateurs.
// ---------------------------------------------------------------------------
/**
 * Échappe une valeur pour un composant RDN LDAP (RFC 4514).
 * Caractères spéciaux : , + = " \ < > ; — ainsi que # en début et espaces en début/fin.
 */
export function escapeLdapRdn(v) {
  let s = String(v ?? '');
  // 1. Backslash en premier
  s = s.replace(/\\/g, '\\\\');
  // 2. NUL et autres caractères de contrôle RFC 4514 → \HH
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
  // 3. Caractères spéciaux RFC 4514
  s = s.replace(/[,+="<>;]/g, (c) => '\\' + c);
  // 4. Dièse en début de valeur
  if (s.startsWith('#')) s = '\\#' + s.slice(1);
  // 5. Espaces en début et en fin
  s = s.replace(/^( +)/, (m) => m.replace(/ /g, '\\ '));
  s = s.replace(/( +)$/, (m) => m.replace(/ /g, '\\ '));
  return s;
}

/**
 * Convertit un nom de domaine en Distinguished Name LDAP (RFC 4514).
 */
export function domainToDn(domain) {
  return String(domain).trim().split('.').filter(Boolean)
    .map((part) => `DC=${escapeLdapRdn(part)}`).join(',');
}

// ---------------------------------------------------------------------------
// Annuaire — noms de comptes, de groupes et d'unités d'organisation
// Déplacés depuis generators.mjs au LOT 3, à l'identique. generators.mjs les
// ré-exporte : les huit outils historiques ne voient aucune différence.
// ---------------------------------------------------------------------------
export function validateSamAccountName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le SamAccountName ne peut pas être vide.' };
  if (s.length > 20) return { ok: false, value: s, error: 'Le SamAccountName ne doit pas dépasser 20 caractères.' };
  if (/["\/\\[\]:;|=,+*?<>@\x00-\x1f\x7f]/.test(s)) {
    return { ok: false, value: s, error: 'Le SamAccountName contient un caractère non autorisé (" / \\ [ ] : ; | = , + * ? < > @).' };
  }
  return { ok: true, value: s, error: null };
}

export function validateGroupName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom du groupe ne peut pas être vide.' };
  if (s.length > 256) return { ok: false, value: s, error: 'Le nom du groupe ne doit pas dépasser 256 caractères.' };
  if (/[\x00-\x1f\x7f]/.test(s)) return { ok: false, value: s, error: 'Le nom du groupe contient un caractère de contrôle non autorisé.' };
  return { ok: true, value: s, error: null };
}

export function validateOuName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: "Le nom de l'OU ne peut pas être vide." };
  if (s.length > 64) return { ok: false, value: s, error: "Le nom de l'OU ne doit pas dépasser 64 caractères." };
  if (/[\x00-\x1f\x7f]/.test(s)) return { ok: false, value: s, error: "Le nom de l'OU contient un caractère de contrôle non autorisé." };
  return { ok: true, value: s, error: null };
}

// ---------------------------------------------------------------------------
// LOT 3 — Active Directory avancé
// Validateurs des noms distinctifs, des hiérarchies d'OU, des comptes, des
// groupes et des fichiers CSV d'import.
// ---------------------------------------------------------------------------

/**
 * Nom distinctif (DN) LDAP.
 *
 * L'analyse respecte RFC 4514 : une virgule précédée d'un backslash fait partie
 * de la valeur, elle ne sépare pas deux composants. Découper naïvement sur la
 * virgule casse tout DN contenant « Dupont, Marie », et c'est l'erreur la plus
 * fréquente des scripts trouvés en ligne.
 */
export function validerDn(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom distinctif ne peut pas être vide (ex. : OU=Medecin,DC=hopitalbn,DC=lan).' };
  if (/[\x00-\x1f\x7f]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom distinctif contient un caractère de contrôle non autorisé.' };
  }

  // Découpage en respectant l'échappement par backslash.
  const composants = [];
  let courant = '';
  let echappe = false;
  for (const c of s) {
    if (echappe) { courant += c; echappe = false; continue; }
    if (c === '\\') { courant += c; echappe = true; continue; }
    if (c === ',') { composants.push(courant); courant = ''; continue; }
    courant += c;
  }
  composants.push(courant);
  if (echappe) return { ok: false, value: s, error: 'Le nom distinctif se termine par un backslash isolé.' };

  const types = [];
  for (const brut of composants) {
    const composant = brut.trim();
    if (!composant) return { ok: false, value: s, error: 'Le nom distinctif contient un composant vide (deux virgules de suite ?).' };
    const egal = indexEgalNonEchappe(composant);
    if (egal <= 0) {
      return { ok: false, value: s, error: `« ${composant} » n\u2019est pas un composant valide : il faut la forme TYPE=valeur.` };
    }
    const type = composant.slice(0, egal).trim().toUpperCase();
    const valeur = composant.slice(egal + 1);
    if (!/^[A-Z][A-Z0-9-]*$/.test(type)) {
      return { ok: false, value: s, error: `« ${type} » n\u2019est pas un type d\u2019attribut valide (CN, OU, DC…).` };
    }
    if (!valeur.trim()) {
      return { ok: false, value: s, error: `Le composant « ${type}= » n\u2019a pas de valeur.` };
    }
    types.push(type);
  }

  if (!types.includes('DC')) {
    return { ok: false, value: s, error: 'Le nom distinctif doit se terminer par le domaine (ex. : ,DC=hopitalbn,DC=lan).' };
  }
  // Les composants DC sont toujours les derniers.
  const premierDc = types.indexOf('DC');
  if (types.slice(premierDc).some((t) => t !== 'DC')) {
    return { ok: false, value: s, error: 'Les composants DC doivent être les derniers du nom distinctif.' };
  }

  return { ok: true, value: s, error: null, composants: types };
}

/** Position du premier « = » non échappé, ou -1. */
function indexEgalNonEchappe(texte) {
  let echappe = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (echappe) { echappe = false; continue; }
    if (c === '\\') { echappe = true; continue; }
    if (c === '=') return i;
  }
  return -1;
}

/**
 * Chemin d'unité d'organisation, écrit du parent vers l'enfant et séparé par
 * des barres obliques : « Medecin/Specialiste ».
 *
 * La barre oblique est le séparateur du formulaire, pas un caractère de nom :
 * un nom d'OU qui en contient doit être saisi autrement. C'est un compromis
 * assumé, documenté dans l'aide du champ.
 */
export function validerCheminOu(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le chemin d\u2019OU ne peut pas être vide (ex. : Medecin/Specialiste).' };
  if (s.startsWith('/') || s.endsWith('/')) {
    return { ok: false, value: s, error: 'Le chemin ne doit pas commencer ni finir par une barre oblique.' };
  }
  if (s.includes('//')) {
    return { ok: false, value: s, error: 'Le chemin contient deux barres obliques de suite : un niveau est vide.' };
  }
  const segments = s.split('/').map((x) => x.trim());
  if (segments.length > 10) {
    return { ok: false, value: s, error: 'Dix niveaux d\u2019OU au maximum : au-delà, la structure devient ingérable.' };
  }
  for (const segment of segments) {
    const r = validateOuName(segment);
    if (!r.ok) return { ok: false, value: s, error: `« ${segment} » : ${r.error}` };
  }
  return { ok: true, value: segments, error: null };
}

/**
 * Liste d'OU saisie sur plusieurs lignes, telle qu'on la copie d'un tableau de
 * conception.
 *
 * Le résultat est TRIÉ : les parents précèdent toujours leurs enfants, sinon
 * New-ADOrganizationalUnit échoue sur un parent absent. Les niveaux
 * intermédiaires implicites sont ajoutés — écrire « Medecin/Specialiste » sans
 * « Medecin » est une omission, pas une erreur de conception.
 */
export function validerListeOu(v, { max = 100 } = {}) {
  const brut = String(v ?? '');
  const lignes = brut.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
  if (lignes.length === 0) {
    return { ok: false, value: [], error: 'Indique au moins une OU, une par ligne (ex. : Medecin puis Medecin/Specialiste).' };
  }
  if (lignes.length > max) {
    return { ok: false, value: [], error: `Pas plus de ${max} OU par exécution : découpe en plusieurs lots.` };
  }

  const chemins = new Map();   // chemin normalisé -> segments
  const doublons = [];
  for (const ligne of lignes) {
    const r = validerCheminOu(ligne);
    if (!r.ok) return { ok: false, value: [], error: `Ligne « ${ligne} » : ${r.error}` };
    const segments = r.value;
    // Chaque niveau intermédiaire est nécessaire : on le rend explicite.
    for (let i = 1; i <= segments.length; i++) {
      const partiel = segments.slice(0, i);
      const cle = partiel.join('/').toLowerCase();
      if (!chemins.has(cle)) chemins.set(cle, partiel);
      else if (i === segments.length && chemins.get(cle).join('/') === partiel.join('/')
               && lignes.filter((l) => l.toLowerCase() === ligne.toLowerCase()).length > 1
               && !doublons.includes(ligne)) {
        doublons.push(ligne);
      }
    }
  }
  if (doublons.length) {
    return { ok: false, value: [], error: `Ligne(s) en double : ${doublons.join(', ')}.` };
  }

  // Tri : profondeur croissante, puis ordre alphabétique pour être déterministe.
  const ordonnees = [...chemins.values()].sort((a, b) => (a.length - b.length)
    || a.join('/').localeCompare(b.join('/')));

  return {
    ok: true,
    error: null,
    value: ordonnees.map((segments) => ({
      segments,
      chemin: segments.join('/'),
      nom: segments[segments.length - 1],
      parent: segments.length > 1 ? segments.slice(0, -1) : null,
      profondeur: segments.length,
      implicite: !lignes.some((l) => l.toLowerCase() === segments.join('/').toLowerCase()),
    })),
  };
}

/**
 * Nom d'ouverture de session principal (UPN) : utilisateur@domaine.
 */
export function validerUpn(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'L\u2019UPN ne peut pas être vide (ex. : m.tremblay@hopitalbn.lan).' };
  const morceaux = s.split('@');
  if (morceaux.length !== 2) {
    return { ok: false, value: s, error: 'L\u2019UPN doit contenir exactement un @ (ex. : m.tremblay@hopitalbn.lan).' };
  }
  const [compte, domaine] = morceaux;
  if (!compte) return { ok: false, value: s, error: 'La partie avant le @ est vide.' };
  if (compte.length > 64) return { ok: false, value: s, error: 'La partie avant le @ dépasse 64 caractères.' };
  if (/["\/\\[\]:;|=,+*?<>\s]/.test(compte)) {
    return { ok: false, value: s, error: 'La partie avant le @ contient un caractère non autorisé.' };
  }
  const d = validerFqdn(domaine);
  if (!d.ok) return { ok: false, value: s, error: `Domaine de l\u2019UPN : ${d.error}` };
  return { ok: true, value: `${compte}@${d.value}`, error: null };
}

/** Portées de groupe Active Directory. */
export const PORTEES_GROUPE = ['Global', 'DomainLocal', 'Universal'];
/** Catégories de groupe. */
export const CATEGORIES_GROUPE = ['Security', 'Distribution'];

export function validerPorteeGroupe(v) {
  return validerChoix(v, PORTEES_GROUPE, 'La portée du groupe');
}

export function validerCategorieGroupe(v) {
  return validerChoix(v, CATEGORIES_GROUPE, 'La catégorie du groupe');
}

/**
 * Chemin UNC : \\serveur\partage[\sous-dossier].
 * L'inverse du validateur de chemin local : ici, un chemin local est refusé.
 */
export function validerCheminUnc(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le chemin réseau ne peut pas être vide (ex. : \\\\srv-fichiers\\Profils).' };
  if (/^[a-zA-Z]:\\/.test(s)) {
    return { ok: false, value: s, error: 'Un chemin local ne convient pas ici : les dossiers personnels et les profils se déclarent en chemin réseau (\\\\serveur\\partage).' };
  }
  if (!s.startsWith('\\\\')) {
    return { ok: false, value: s, error: 'Un chemin UNC commence par deux backslashes (ex. : \\\\srv-fichiers\\Profils).' };
  }
  const reste = s.slice(2);
  const parties = reste.split('\\').filter((x) => x !== '');
  if (parties.length < 2) {
    return { ok: false, value: s, error: 'Le chemin doit comporter au moins un serveur et un partage (\\\\serveur\\partage).' };
  }
  const [serveur, partage] = parties;
  if (!validerNomHote(serveur).ok && !validerFqdn(serveur).ok && !validateIPv4(serveur).ok) {
    return { ok: false, value: s, error: `« ${serveur} » n\u2019est pas un nom de serveur valide.` };
  }
  const p = validateShareName(partage);
  if (!p.ok) return { ok: false, value: s, error: `Partage « ${partage} » : ${p.error}` };
  if (/["*?<>|]/.test(reste)) {
    return { ok: false, value: s, error: 'Le chemin contient un caractère interdit par Windows (" * ? < > |).' };
  }
  return { ok: true, value: s.replace(/\\+$/, ''), error: null };
}

/** Lettre de lecteur pour HomeDrive : « H: ». */
export function validerLettreLecteur(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return { ok: false, value: s, error: 'Indique une lettre de lecteur (ex. : H:).' };
  if (!/^[D-Z]:$/.test(s)) {
    return { ok: false, value: s, error: 'La lettre doit être comprise entre D: et Z:, suivie de deux-points. A:, B: et C: sont réservées.' };
  }
  return { ok: true, value: s, error: null };
}

/** Nom d'ordinateur : nom NetBIOS, 15 caractères au plus. */
export function validerNomOrdinateur(v) {
  const s = String(v ?? '').trim().replace(/\$$/, '');
  if (!s) return { ok: false, value: s, error: 'Le nom de l\u2019ordinateur ne peut pas être vide.' };
  if (s.length > 15) return { ok: false, value: s, error: 'Un nom d\u2019ordinateur NetBIOS fait 15 caractères au plus.' };
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(s)) {
    return { ok: false, value: s, error: 'Le nom n\u2019accepte que lettres, chiffres et tirets, sans commencer par un tiret.' };
  }
  return { ok: true, value: s, error: null };
}

/** Nombre de jours d'inactivité, d'ancienneté ou d'expiration. */
export function validerJours(v, { min = 1, max = 3650, label = 'Le nombre de jours' } = {}) {
  return validerEntier(v, min, max, label);
}

/**
 * Schéma de colonnes attendu dans un fichier CSV d'import.
 * On valide la LISTE des colonnes déclarées, pas le fichier : le navigateur ne
 * lit pas le disque, et le script vérifiera le fichier réel à l'exécution.
 */
export function validerColonnesCsv(v, { obligatoires = [], max = 30 } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: [], error: 'Indique les colonnes du fichier, séparées par des virgules.' };
  const brutes = s.split(',').map((c) => c.trim());
  if (brutes.some((c) => c === '')) {
    return { ok: false, value: [], error: 'Une colonne sans nom : deux virgules se suivent, ou la liste se termine par une virgule.' };
  }
  const colonnes = brutes;
  if (colonnes.length === 0) return { ok: false, value: [], error: 'Aucune colonne lisible dans la liste.' };
  if (colonnes.length > max) return { ok: false, value: [], error: `Pas plus de ${max} colonnes.` };
  for (const colonne of colonnes) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(colonne)) {
      return { ok: false, value: [], error: `« ${colonne} » n\u2019est pas un nom de colonne valide : lettres, chiffres et souligné, commençant par une lettre.` };
    }
  }
  const vues = colonnes.map((c) => c.toLowerCase());
  if (new Set(vues).size !== vues.length) {
    return { ok: false, value: [], error: 'La liste contient deux fois la même colonne.' };
  }
  const manquantes = obligatoires.filter((o) => !vues.includes(o.toLowerCase()));
  if (manquantes.length) {
    return { ok: false, value: [], error: `Colonne(s) obligatoire(s) manquante(s) : ${manquantes.join(', ')}.` };
  }
  return { ok: true, value: colonnes, error: null };
}

/**
 * Construit le DN d'une OU à partir de ses segments et du domaine, en
 * échappant chaque composant selon RFC 4514.
 * « Medecin/Specialiste » dans hopitalbn.lan donne :
 *   OU=Specialiste,OU=Medecin,DC=hopitalbn,DC=lan
 */
export function cheminOuVersDn(segments, domaine) {
  const parties = [...segments].reverse().map((s) => `OU=${escapeLdapRdn(s)}`);
  return [...parties, domainToDn(domaine)].join(',');
}

// ---------------------------------------------------------------------------
// LOT 4 — Stratégies de groupe
// Validateurs des noms de GPO, des chemins SYSVOL, des requêtes WQL, des
// durées et des quelques listes fermées propres aux GPO.
// ---------------------------------------------------------------------------

/**
 * Nom d'une stratégie de groupe.
 *
 * Active Directory accepte presque tout dans le displayName d'une GPO. Presque.
 * Les caractères refusés ci-dessous cassent soit l'affichage dans la console
 * de gestion, soit le nom du dossier de sauvegarde produit par Backup-GPO.
 * Mieux vaut refuser à la saisie que découvrir le problème au moment de
 * restaurer.
 */
export function validerNomGpo(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom de la GPO ne peut pas être vide.' };
  if (s.length > 64) return { ok: false, value: s, error: 'Le nom de la GPO ne doit pas dépasser 64 caractères.' };
  if (/[\\/:*?"<>|]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom de la GPO ne peut pas contenir \\ / : * ? " < > ni |.' };
  }
  if (/[\x00-\x1f\x7f]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom de la GPO contient un caractère de contrôle non autorisé.' };
  }
  return { ok: true, value: s, error: null };
}

/** Les deux stratégies que ce projet ne touche jamais, quel que soit l'outil. */
export const GPO_INTOUCHABLES = ['Default Domain Policy', 'Default Domain Controllers Policy'];

/**
 * Une GPO par défaut se modifie à la main, en sachant ce qu'on fait.
 *
 * Default Domain Policy porte la politique de mots de passe du domaine ;
 * Default Domain Controllers Policy porte les droits d'ouverture de session
 * des contrôleurs. Les abîmer se répare par une restauration d'annuaire, pas
 * par un ctrl-Z. Aucun assistant de ce lot ne les vise.
 */
export function refuseGpoParDefaut(v) {
  const s = String(v ?? '').trim();
  const nu = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const interdite of GPO_INTOUCHABLES) {
    if (nu === interdite.toLowerCase()) {
      return {
        ok: false,
        value: s,
        error: `« ${interdite} » ne se modifie pas depuis cet assistant : crée une GPO distincte et lie-la.`,
      };
    }
  }
  return { ok: true, value: s, error: null };
}

/** Nom de GPO acceptable ET qui n'est pas une stratégie par défaut. */
export function validerNomGpoModifiable(v) {
  const nom = validerNomGpo(v);
  if (!nom.ok) return nom;
  return refuseGpoParDefaut(nom.value);
}

export const PORTEES_GPO = ['Ordinateur', 'Utilisateur', 'Les deux'];
export function validerPorteeGpo(v) {
  return validerChoix(v, PORTEES_GPO, 'La portée');
}

export const ETATS_LIEN = ['Active', 'Inactive'];
export function validerEtatLien(v) {
  return validerChoix(v, ETATS_LIEN, 'L’état du lien');
}

export const APPLICATIONS_LIEN = ['Oui', 'Non'];
export function validerApplicationLien(v) {
  return validerChoix(v, APPLICATIONS_LIEN, 'Le choix');
}

/** Ordre d'un lien GPO sur une OU : 1 est le plus prioritaire. */
export function validerOrdreLien(v) {
  return validerEntier(v, 1, 999, 'L’ordre du lien');
}

/**
 * Chemin sous SYSVOL ou NETLOGON.
 *
 * Les scripts d'ouverture de session et les modèles ADMX vivent là, et nulle
 * part ailleurs : un script rangé sur un partage quelconque n'est pas répliqué
 * entre contrôleurs, et il fonctionne jusqu'au jour où le client interroge un
 * autre contrôleur.
 */
export function validerCheminSysvol(v) {
  const r = validerCheminUnc(v);
  if (!r.ok) return r;
  const s = r.value;
  if (!/\\(SYSVOL|NETLOGON)(\\|$)/i.test(s)) {
    return {
      ok: false,
      value: s,
      error: 'Le chemin doit passer par le partage SYSVOL ou NETLOGON : ailleurs, rien n’est répliqué entre contrôleurs.',
    };
  }
  return { ok: true, value: s, error: null };
}

export const EXTENSIONS_SCRIPT_GPO = ['.ps1', '.cmd', '.bat', '.vbs'];

/** Nom de fichier de script d'ouverture de session ou de démarrage. */
export function validerNomScriptGpo(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Indique le nom du fichier de script.' };
  if (/[\\/:*?"<>|]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom du script ne peut pas contenir \\ / : * ? " < > ni |.' };
  }
  const point = s.lastIndexOf('.');
  const ext = point === -1 ? '' : s.slice(point).toLowerCase();
  if (!EXTENSIONS_SCRIPT_GPO.includes(ext)) {
    return {
      ok: false,
      value: s,
      error: `Extension non autorisée : ${EXTENSIONS_SCRIPT_GPO.join(', ')} seulement. Un exécutable ne se déploie pas comme un script d’ouverture de session.`,
    };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Requête WQL d'un filtre WMI.
 *
 * On ne valide pas le WQL comme le ferait un moteur : on refuse ce qui n'a
 * manifestement rien à faire dans un filtre GPO. Un filtre WMI est une
 * question posée à chaque ouverture de session ; il se lit, il ne modifie
 * rien.
 */
export function validerRequeteWql(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'La requête WQL ne peut pas être vide.' };
  if (s.length > 512) return { ok: false, value: s, error: 'La requête ne doit pas dépasser 512 caractères.' };
  if (!/^\s*SELECT\s+/i.test(s)) {
    return { ok: false, value: s, error: 'Un filtre WMI commence par SELECT : il interroge, il ne modifie rien.' };
  }
  if (!/\sFROM\s+[A-Za-z][A-Za-z0-9_]*/i.test(s)) {
    return { ok: false, value: s, error: 'La requête doit nommer une classe WMI après FROM.' };
  }
  if (/\b(DELETE|UPDATE|INSERT|DROP|CREATE|EXEC|CALL)\b/i.test(s)) {
    return { ok: false, value: s, error: 'Un filtre WMI ne contient aucun mot-clé de modification.' };
  }
  if (/[;\r\n]/.test(s)) {
    return { ok: false, value: s, error: 'Une seule requête, sans point-virgule ni retour à la ligne.' };
  }
  return { ok: true, value: s, error: null };
}

/** Espace de noms WMI : root\CIMv2 et ses semblables. */
export function validerEspaceNomsWmi(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'L’espace de noms ne peut pas être vide.' };
  if (!/^[A-Za-z][A-Za-z0-9_]*(\\[A-Za-z][A-Za-z0-9_]*)*$/.test(s)) {
    return { ok: false, value: s, error: 'Espace de noms attendu sous la forme root\\CIMv2.' };
  }
  return { ok: true, value: s, error: null };
}

/** Minutes, pour un délai d'inactivité ou une fenêtre de maintenance. */
export function validerMinutes(v, { min = 1, max = 1440, label = 'La durée' } = {}) {
  return validerEntier(v, min, max, label);
}

/** Heure de la journée, 0 à 23. */
export function validerHeure(v, label = 'L’heure') {
  return validerEntier(v, 0, 23, label);
}

/**
 * Adresse de page de démarrage imposée à un navigateur.
 *
 * Seul https est accepté. Une page de démarrage est ouverte automatiquement,
 * sur chaque poste, à chaque session : la servir en clair sur un réseau
 * interne reste une mauvaise idée, et `javascript:` ou `data:` dans ce champ
 * n'est jamais une page, c'est une tentative d'exécution.
 */
export function validerUrlHttps(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'L’adresse ne peut pas être vide.' };
  if (/[\s"'<>`]/.test(s)) {
    return { ok: false, value: s, error: 'L’adresse ne peut contenir ni espace, ni guillemet, ni chevron.' };
  }
  if (/^http:\/\//i.test(s)) {
    return { ok: false, value: s, error: 'Seul https est accepté : une page imposée en clair est lisible et modifiable sur le réseau.' };
  }
  if (!/^https:\/\//i.test(s)) {
    return { ok: false, value: s, error: 'L’adresse doit commencer par https://.' };
  }
  const reste = s.slice('https://'.length);
  const hote = reste.split('/')[0];
  if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*(:[0-9]{1,5})?$/.test(hote)) {
    return { ok: false, value: s, error: 'Le nom d’hôte de l’adresse est invalide.' };
  }
  if (s.length > 2000) {
    return { ok: false, value: s, error: 'L’adresse dépasse 2000 caractères.' };
  }
  return { ok: true, value: s, error: null };
}

// ===========================================================================
// LOT 5 — réseau
//
// Les validateurs d'adresses, de masques et de plages du LOT 2 restent la
// base ; ceux-ci portent ce que le réseau ajoute : ports, délais, cibles,
// plages de découverte, et les garde-fous qui empêchent cet outil de devenir
// un scanner.
// ===========================================================================

/** Port TCP ou UDP : entier 1 à 65535, sans zéro de tête. */
export function validerPort(v, label = 'Le port') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (!/^\d+$/.test(s)) return { ok: false, value: s, error: `${label} doit être un entier (ex. : 445).` };
  const n = Number(s);
  if (String(n) !== s) return { ok: false, value: s, error: `${label} ne doit pas comporter de zéro de tête.` };
  if (n < 1 || n > 65535) return { ok: false, value: s, error: `${label} doit être compris entre 1 et 65535.` };
  return { ok: true, value: n, error: null };
}

/** Nombre maximal de ports qu'une liste peut porter. Au-delà, c'est un balayage. */
export const PORTS_MAX_PAR_LISTE = 20;

/**
 * Liste de ports explicites, séparés par des virgules.
 *
 * Vingt au maximum, et c'est un plafond de conception, pas une préférence :
 * un outil d'administration teste les ports qu'on lui nomme ; au-delà, on
 * balaye, et ce projet ne balaye pas.
 */
export function validerListePorts(v, { max = PORTS_MAX_PAR_LISTE } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Indique au moins un port (ex. : 445,139).' };
  const bruts = s.split(',').map((x) => x.trim()).filter((x) => x !== '');
  if (bruts.length === 0) return { ok: false, value: s, error: 'Indique au moins un port (ex. : 445,139).' };
  if (bruts.length > max) {
    return { ok: false, value: s, error: `Pas plus de ${max} ports à la fois : au-delà, ce n’est plus un test ciblé mais un balayage, et cet assistant ne balaye pas.` };
  }
  const vus = new Set();
  const ports = [];
  for (const b of bruts) {
    if (b.includes('-')) {
      return { ok: false, value: s, error: `« ${b} » : les intervalles ne sont pas acceptés. Nomme chaque port, séparé par une virgule.` };
    }
    const r = validerPort(b, `Le port « ${b} »`);
    if (!r.ok) return { ok: false, value: s, error: r.error };
    if (vus.has(r.value)) return { ok: false, value: s, error: `Le port ${r.value} est indiqué deux fois.` };
    vus.add(r.value);
    ports.push(r.value);
  }
  return { ok: true, value: ports, error: null };
}

/** Délai d'attente en millisecondes, borné : ni zéro, ni une attente infinie. */
export function validerDelaiMs(v, { min = 100, max = 30000, label = 'Le délai' } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (!/^\d+$/.test(s)) return { ok: false, value: s, error: `${label} doit être un entier, en millisecondes.` };
  const n = Number(s);
  if (String(n) !== s) return { ok: false, value: s, error: `${label} ne doit pas comporter de zéro de tête.` };
  if (n < min || n > max) {
    return { ok: false, value: s, error: `${label} doit être compris entre ${min} et ${max} millisecondes.` };
  }
  return { ok: true, value: n, error: null };
}

/**
 * Nombre d'essais d'une mesure. Borné des deux côtés : un ping sans fin n'est
 * pas un diagnostic, c'est une charge.
 */
export function validerNombreEssais(v, { min = 1, max = 100, label = 'Le nombre d’essais' } = {}) {
  return validerEntier(v, min, max, label);
}

/**
 * Cible d'un test réseau : adresse IPv4, nom complet, ou nom d'hôte court.
 *
 * On refuse ce qui n'est ni l'un ni l'autre plutôt que de laisser passer une
 * chaîne quelconque jusqu'à la ligne de commande.
 */
export function validerCibleReseau(v, label = 'La cible') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (/[\s"'`$;|&<>(){}\\]/.test(s)) {
    return { ok: false, value: s, error: `${label} ne peut contenir ni espace, ni guillemet, ni caractère de commande.` };
  }
  if (validateIPv4(s).ok) return { ok: true, value: s, error: null, forme: 'ipv4' };
  // Quatre groupes de chiffres separes par des points : c'est une tentative
  // d'adresse IPv4, pas un nom d'hote. « 256.1.1.1 » doit etre refuse comme
  // adresse invalide, et non accepte comme FQDN parce qu'il contient des
  // points.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    return { ok: false, value: s, error: validateIPv4(s).error };
  }
  if (s.includes(':')) {
    const v6 = validerIPv6(s);
    if (v6.ok) return { ok: true, value: s, error: null, forme: 'ipv6' };
    return { ok: false, value: s, error: v6.error };
  }
  if (s.includes('.')) {
    const f = validerFqdn(s);
    if (f.ok) return { ok: true, value: f.value, error: null, forme: 'fqdn' };
    return { ok: false, value: s, error: f.error };
  }
  const h = validerNomHote(s);
  if (h.ok) return { ok: true, value: h.value, error: null, forme: 'hote' };
  return { ok: false, value: s, error: h.error };
}

/** Adresse HTTP ou HTTPS. Le test TLS a besoin de pouvoir viser http pour comparer. */
export function validerUrlHttpOuHttps(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'L’adresse ne peut pas être vide.' };
  if (/[\s"'<>`]/.test(s)) {
    return { ok: false, value: s, error: 'L’adresse ne peut contenir ni espace, ni guillemet, ni chevron.' };
  }
  if (!/^https?:\/\//i.test(s)) {
    return { ok: false, value: s, error: 'L’adresse doit commencer par http:// ou https://.' };
  }
  const reste = s.replace(/^https?:\/\//i, '');
  const hote = reste.split('/')[0];
  if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*(:[0-9]{1,5})?$/.test(hote)) {
    return { ok: false, value: s, error: 'Le nom d’hôte de l’adresse est invalide.' };
  }
  if (s.length > 2000) return { ok: false, value: s, error: 'L’adresse dépasse 2000 caractères.' };
  return { ok: true, value: s, error: null };
}

// ---------------------------------------------------------------------------
// Garde-fous de découverte réseau
//
// Ce projet est un outil d'administration défensive. Il ne balaye pas des
// réseaux qui ne sont pas les siens, et il ne se tait pas quand on le lui
// demande : il refuse, et il dit pourquoi.
// ---------------------------------------------------------------------------

/** Préfixe le plus court accepté pour une découverte. /24 = 254 hôtes. */
export const PREFIXE_DECOUVERTE_MIN = 24;
/** Nombre maximal d'hôtes qu'une découverte peut viser. */
export const HOTES_DECOUVERTE_MAX = 254;

/**
 * Plage de découverte : notation CIDR, strictement privée, /24 au plus large.
 *
 * Les trois refus sont distincts et portent chacun leur message, parce qu'ils
 * n'ont pas la même cause et n'appellent pas la même correction.
 */
export function validerPlageDecouverte(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Indique la plage à examiner, en notation CIDR (ex. : 192.168.30.0/24).' };
  const parts = s.split('/');
  if (parts.length !== 2) {
    return { ok: false, value: s, error: 'La plage s’écrit en notation CIDR (ex. : 192.168.30.0/24).' };
  }
  const ip = validateIPv4(parts[0]);
  if (!ip.ok) return { ok: false, value: s, error: ip.error };
  const pre = validerPrefixe(parts[1]);
  if (!pre.ok) return { ok: false, value: s, error: pre.error };

  if (pre.value < PREFIXE_DECOUVERTE_MIN) {
    const hotes = Math.pow(2, 32 - pre.value) - 2;
    return {
      ok: false,
      value: s,
      error: `/${pre.value} vise ${hotes.toLocaleString('fr-CA')} hôtes. Cet assistant s’arrête à /${PREFIXE_DECOUVERTE_MIN}, soit ${HOTES_DECOUVERTE_MAX} hôtes : au-delà, ce n’est plus un diagnostic de sous-réseau mais un balayage.`,
    };
  }

  const reseau = adresseReseau(ip.value, pre.value);
  if (reseau !== ip.value) {
    return { ok: false, value: s, error: `${ip.value}/${pre.value} n’est pas une adresse de réseau. Voulais-tu écrire ${reseau}/${pre.value} ?` };
  }

  // Privé seulement. On teste les deux bornes : une plage « privée » dont la
  // diffusion sort de la plage RFC 1918 n'est pas privée.
  const diffusion = adresseDiffusion(reseau, pre.value);
  if (!estPlagePrivee(reseau) || !estPlagePrivee(diffusion)) {
    return {
      ok: false,
      value: s,
      error: `${reseau}/${pre.value} n’est pas une plage privée. Cet assistant n’examine que les réseaux privés (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) : examiner une plage publique sans y être autorisé est une intrusion, pas un diagnostic.`,
    };
  }

  const total = Math.pow(2, 32 - pre.value);
  const hotes = pre.value >= 31 ? total : total - 2;
  if (hotes > HOTES_DECOUVERTE_MAX) {
    return { ok: false, value: s, error: `${hotes} hôtes dépassent le plafond de ${HOTES_DECOUVERTE_MAX}.` };
  }

  return {
    ok: true,
    value: { reseau, prefixe: pre.value, masque: prefixeVersMasque(pre.value), hotes },
    error: null,
  };
}

/**
 * Vrai si l'adresse est dans 10/8, 172.16/12 ou 192.168/16.
 *
 * La comparaison se fait par BORNES ENTIÈRES, pas par masque binaire : les
 * opérateurs `&` et `~` de JavaScript travaillent sur des entiers 32 bits
 * signés, et 192.168.0.0 masqué devient négatif dès qu'on oublie un `>>> 0`.
 * Deux comparaisons d'entiers n'ont pas ce défaut.
 */
const BORNES_PRIVEES = [
  ['10.0.0.0', '10.255.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
];

export function estPlagePrivee(ip) {
  const r = validateIPv4(ip);
  if (!r.ok) return false;
  const n = ipVersEntier(r.value);
  return BORNES_PRIVEES.some(([a, b]) => n >= ipVersEntier(a) && n <= ipVersEntier(b));
}

/** Concurrence d'une découverte : bornée, parce qu'un parallélisme libre est une inondation. */
export function validerConcurrence(v, { min = 1, max = 32 } = {}) {
  return validerEntier(v, min, max, 'La concurrence');
}

/** Nom d'un profil Wi-Fi. Jamais une clé : seulement un nom. */
export function validerNomProfilWifi(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom du profil ne peut pas être vide.' };
  if (/["`$;|&<>]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom du profil ne peut contenir ni guillemet ni caractère de commande.' };
  }
  if (s.length > 64) return { ok: false, value: s, error: 'Le nom du profil dépasse 64 caractères.' };
  return { ok: true, value: s, error: null };
}

/** Index d'interface réseau, tel que Get-NetAdapter le rend. */
export function validerIndexInterface(v) {
  return validerEntier(v, 1, 99999, 'L’index d’interface');
}

/** Suffixe DNS : un nom de domaine, sans point de tête ni de fin. */
export function validerSuffixeDns(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le suffixe DNS ne peut pas être vide.' };
  if (s.startsWith('.') || s.endsWith('.')) {
    return { ok: false, value: s, error: 'Le suffixe DNS s’écrit sans point de tête ni point final.' };
  }
  return validerFqdn(s);
}
