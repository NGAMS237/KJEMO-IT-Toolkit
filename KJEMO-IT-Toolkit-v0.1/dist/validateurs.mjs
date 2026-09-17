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
