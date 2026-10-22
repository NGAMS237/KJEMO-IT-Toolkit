/**
 * validateurs-cisco.mjs — RESEAU-CISCO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Validation des champs des assistants Cisco IOS. Chaque fonction retourne
 * { ok: true, valeur } (valeur NORMALISÉE, celle qui sera écrite dans les
 * commandes) ou { ok: false, error }.
 *
 * POURQUOI CES VALIDEURS SONT STRICTS
 * Les valeurs finissent dans une console où trois caractères ont un sens
 * immédiat, y compris lors d'un simple COLLAGE :
 *   « ? »        affiche l'aide contextuelle et coupe la ligne en cours ;
 *   tabulation   déclenche la complétion ;
 *   saut de ligne dans un champ = une SECONDE commande.
 * Un champ qui accepte un saut de ligne accepte donc une injection de commande
 * IOS. Tous les champs texte refusent les caractères de contrôle, le « ? » et
 * tout caractère non ASCII (une console série les corrompt).
 *
 * Aucun import : même raison que plateforme.mjs, éviter tout cycle. Les
 * fonctions IPv4 sont réécrites ici en quelques lignes plutôt qu'importées de
 * calcul-ip.mjs ; le calculateur `ipv4-subnet-calculator` reste la référence
 * pour comprendre un masque, et noyau-cisco.mjs s'en sert pour les commentaires.
 */

const CONTROLE = /[\u0000-\u001f\u007f]/;
const NON_ASCII = /[^ -~]/;

/** Motifs de secrets. HEURISTIQUE : une détection textuelle n'est pas une garantie. */
const MOTIFS_SECRETS = [
  /(?:pass(?:word|wd)?|p[a@4]ss?w[o0]rd|secret|token|community|psk|key-string|apikey|api[_-]?key)\s*[=:]\s*\S+/i,
  /\b(?:enable\s+(?:secret|password)|username\s+\S+\s+(?:privilege\s+\d+\s+)?(?:secret|password)|snmp-server\s+community|vtp\s+password|key-string|pre-shared-key)\b/i,
  /\$[0-9]\$[A-Za-z0-9./]{4,}/,           // hachages IOS type 5 / 8 / 9
  /\b(?:secret|password)\s+[0-9]\s+\S+/i, // « secret 5 <hash> », « password 7 <hash> »
];

/** Vrai si le texte ressemble à un secret. Heuristique, jamais une garantie. */
export function secretsDans(texte) {
  const t = String(texte ?? '');
  return MOTIFS_SECRETS.filter((re) => re.test(t)).map((re) => re.source.slice(0, 24));
}

/** Contrôle commun d'un champ texte : ASCII imprimable, sans « ? », sans secret. */
export function texteSur(v, label, { max = 200, min = 1, interdits = '' } = {}) {
  const s = String(v ?? '');
  if (CONTROLE.test(s)) return { ok: false, error: `${label} : aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).` };
  if (NON_ASCII.test(s)) return { ok: false, error: `${label} : caractères ASCII seulement (une console Cisco corrompt les accents).` };
  if (s.includes('?')) return { ok: false, error: `${label} : le point d’interrogation est interdit — la console l’interprète comme une demande d’aide, même lors d’un collage.` };
  for (const c of interdits) if (s.includes(c)) return { ok: false, error: `${label} : le caractère « ${c} » est interdit ici.` };
  const t = s.trim();
  if (t.length < min) return { ok: false, error: `${label} est obligatoire.` };
  if (t.length > max) return { ok: false, error: `${label} : ${max} caractères au plus.` };
  if (secretsDans(t).length) return { ok: false, error: `${label} semble contenir un secret : le Toolkit n’en accepte aucun. Tape les mots de passe directement sur la console.` };
  return { ok: true, valeur: t };
}

export function validerChoixCisco(v, autorises, label) {
  const s = String(v ?? '');
  return autorises.includes(s) ? { ok: true, valeur: s } : { ok: false, error: `${label} : une des valeurs ${autorises.join(', ')}.` };
}

/** Nom d'hôte IOS : lettre, puis lettres/chiffres/tirets, 63 caractères, pas de tiret final. */
export function validerHostnameIos(v, label = 'Le nom de l’équipement') {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(s) || s.endsWith('-')) {
    return { ok: false, error: `${label} : lettre en premier, puis lettres, chiffres ou tirets (63 caractères au plus, pas de tiret final).` };
  }
  return { ok: true, valeur: s };
}

/** Nom de domaine pour « ip domain-name » (pas un FQDN strict : lab.local passe). */
export function validerDomaineIos(v, label = 'Le nom de domaine') {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]{0,60}[A-Za-z0-9])?$/.test(s) || /\.\./.test(s) || !/[A-Za-z]/.test(s)) {
    return { ok: false, error: `${label} : lettres, chiffres, points et tirets (ex. lab.local), sans espace.` };
  }
  return { ok: true, valeur: s };
}

/** Nom d'utilisateur local : jamais un mot de passe, jamais un nom vide. */
export function validerUtilisateurIos(v) {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(s)) {
    return { ok: false, error: 'Le nom d’utilisateur : lettre en premier, puis lettres, chiffres, tiret ou souligné (32 caractères au plus).' };
  }
  if (secretsDans(s).length) return { ok: false, error: 'Le nom d’utilisateur semble contenir un secret.' };
  return { ok: true, valeur: s };
}

const FAMILLES = { fa: 'FastEthernet', fas: 'FastEthernet', fastethernet: 'FastEthernet',
  gi: 'GigabitEthernet', gig: 'GigabitEthernet', gigabitethernet: 'GigabitEthernet',
  te: 'TenGigabitEthernet', tengigabitethernet: 'TenGigabitEthernet' };

export const MATERIELS_CISCO = ['2960', 'pile'];

/**
 * UNE interface, nommée explicitement. Refuse : plage, liste, joker, texte
 * supplémentaire. La numérotation dépend du matériel, et le mélange est
 * l'erreur classique :
 *   '2960'  → 2 nombres  (Fa0/7, Gi0/1)   : commutateur autonome, Packet Tracer
 *   'pile'  → 3 nombres  (Gi1/0/7)        : Catalyst 1000 / 9200 / 3650...
 * Retourne le nom LONG canonique (FastEthernet0/7) : sans ambiguïté à l'écran.
 */
export function validerInterfaceIos(v, materiel, label = 'L’interface') {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  const m = /^([A-Za-z]+)(\d{1,2})\/(\d{1,2})(?:\/(\d{1,2}))?$/.exec(s);
  if (!m || !FAMILLES[m[1].toLowerCase()]) {
    return { ok: false, error: `${label} : une seule interface, au format Fa0/7, Gi0/1 ou Gi1/0/7 (ni plage, ni liste, ni « range »).` };
  }
  const parties = m[4] === undefined ? 2 : 3;
  const nums = [m[2], m[3], m[4]].filter((x) => x !== undefined);
  if (nums.some((n) => n.length > 1 && n.startsWith('0'))) {
    return { ok: false, error: `${label} : pas de zéro de tête dans les numéros.` };
  }
  if (materiel === '2960' && parties !== 2) {
    return { ok: false, error: `${label} : ce matériel (commutateur autonome, ex. 2960 ou Packet Tracer) numérote en deux nombres — Fa0/7 ou Gi0/1 — et non Gi1/0/7.` };
  }
  if (materiel === 'pile' && parties !== 3) {
    return { ok: false, error: `${label} : ce matériel (Catalyst 1000 / 9200…) numérote en trois nombres — Gi1/0/7 — et non Fa0/7.` };
  }
  if (Number(m[parties === 2 ? 3 : 4]) < 1 || Number(m[parties === 2 ? 3 : 4]) > 52) {
    return { ok: false, error: `${label} : numéro de port hors de la plage 1 à 52.` };
  }
  return { ok: true, valeur: `${FAMILLES[m[1].toLowerCase()]}${nums.join('/')}` };
}

/** Un identifiant de VLAN. `lecture` autorise 1 et 1002-1005 (on peut les LIRE, pas les créer). */
export function validerVlanIos(v, { lecture = false, label = 'Le VLAN' } = {}) {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  if (!/^[1-9]\d{0,3}$/.test(s)) return { ok: false, error: `${label} : un nombre de 1 à 4094, sans zéro de tête.` };
  const n = Number(s);
  if (n > 4094) return { ok: false, error: `${label} : un nombre de 1 à 4094.` };
  if (!lecture && n === 1) return { ok: false, error: `${label} : le VLAN 1 existe par défaut et ne se crée ni ne se renomme ici.` };
  if (!lecture && n >= 1002 && n <= 1005) return { ok: false, error: `${label} : 1002 à 1005 sont réservés (FDDI / Token Ring) et ne s’utilisent pas.` };
  return { ok: true, valeur: n };
}

/**
 * Liste de VLAN « 10,20,30-35 ». Refuse « all », « none », « except » : on ne
 * remplace JAMAIS silencieusement une liste de VLAN autorisés par un mot-clé
 * qui en change la nature. Retourne la liste normalisée (triée, sans doublon).
 */
export function validerListeVlansIos(v, { max = 64, label = 'La liste de VLAN' } = {}) {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: `${label} : aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).` };
  const s = String(v ?? '').replace(/ +/g, '');
  if (!s) return { ok: false, error: `${label} est obligatoire.` };
  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(s)) {
    return { ok: false, error: `${label} : des numéros, des plages et des virgules (ex. 10,20,30-35) — ni « all », ni « none », ni « except ».` };
  }
  const ids = new Set();
  for (const bloc of s.split(',')) {
    const [a, b] = bloc.split('-').map(Number);
    const fin = b === undefined ? a : b;
    if (b !== undefined && b < a) return { ok: false, error: `${label} : la plage ${bloc} est à l’envers.` };
    for (let i = a; i <= fin; i += 1) {
      const r = validerVlanIos(i, { lecture: false, label });
      if (!r.ok) return { ok: false, error: i === 1 ? `${label} : le VLAN 1 ne s’ajoute pas ici.` : r.error };
      ids.add(i);
      if (ids.size > max) return { ok: false, error: `${label} : ${max} VLAN au plus par opération.` };
    }
  }
  const tri = [...ids].sort((x, y) => x - y);
  // Compacte en plages : 10,11,12,20 → 10-12,20
  const blocs = [];
  for (let i = 0; i < tri.length;) {
    let j = i;
    while (j + 1 < tri.length && tri[j + 1] === tri[j] + 1) j += 1;
    blocs.push(j > i + 1 ? `${tri[i]}-${tri[j]}` : tri.slice(i, j + 1).join(','));
    i = j + 1;
  }
  return { ok: true, valeur: blocs.join(','), ids: tri };
}

/** Nom de VLAN : lettre en premier, 32 caractères au plus. */
export function validerNomVlanIos(v) {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(s)) {
    return { ok: false, error: 'Le nom du VLAN : lettre en premier, puis lettres, chiffres, tiret ou souligné (32 caractères au plus).' };
  }
  return { ok: true, valeur: s };
}

/** Domaine VTP : sensible à la casse, 32 caractères au plus. */
export function validerDomaineVtp(v) {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(s)) return { ok: false, error: 'Le domaine VTP : lettres, chiffres, tiret ou souligné (32 caractères au plus). Il est sensible à la casse.' };
  if (secretsDans(s).length) return { ok: false, error: 'Le domaine VTP semble contenir un secret.' };
  return { ok: true, valeur: s };
}

/** Adresse MAC → format Cisco xxxx.xxxx.xxxx, en minuscules. Refuse nulle, diffusion, multicast. */
export function validerMacIos(v, label = 'L’adresse MAC') {
  if (CONTROLE.test(String(v ?? ''))) return { ok: false, error: 'Aucun saut de ligne ni caractère de contrôle (ce serait une seconde commande).' };
  const s = String(v ?? '').trim();
  if (!/^(?:[0-9A-Fa-f]{2}([:-]))(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}$|^(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}$|^[0-9A-Fa-f]{12}$/.test(s)) {
    return { ok: false, error: `${label} : 12 chiffres hexadécimaux (aaaa.bbbb.cccc, aa:bb:cc:dd:ee:ff ou aa-bb-cc-dd-ee-ff).` };
  }
  const h = s.replace(/[:.-]/g, '').toLowerCase();
  if (/^0+$/.test(h)) return { ok: false, error: `${label} : l’adresse nulle n’est pas une adresse de machine.` };
  if (h === 'ffffffffffff') return { ok: false, error: `${label} : l’adresse de diffusion n’est pas une adresse de machine.` };
  if ((parseInt(h.slice(0, 2), 16) & 1) === 1) return { ok: false, error: `${label} : une adresse de multidiffusion (bit 1 du premier octet) ne se sécurise pas.` };
  return { ok: true, valeur: `${h.slice(0, 4)}.${h.slice(4, 8)}.${h.slice(8, 12)}` };
}

function ipv4EnEntier(s) {
  if (CONTROLE.test(String(s ?? ''))) return null;
  const p = String(s).trim().split('.');
  if (p.length !== 4 || p.some((x) => !/^(0|[1-9]\d{0,2})$/.test(x) || Number(x) > 255)) return null;
  return p.reduce((n, x) => (n * 256) + Number(x), 0);
}
const entierEnIpv4 = (n) => [24, 16, 8, 0].map((d) => Math.floor(n / 2 ** d) % 256).join('.');

/** Masque décimal pointé contigu → préfixe, sinon null. */
export function prefixeDeMasqueIos(masque) {
  const n = ipv4EnEntier(masque);
  if (n === null) return null;
  const bin = n.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bin)) return null;
  const p = bin.indexOf('0') === -1 ? 32 : bin.indexOf('0');
  return p >= 8 && p <= 30 ? p : null;
}

/** IPv4 d'hôte + masque. Refuse adresse de réseau, de diffusion, bouclage, multicast, 0.x. */
export function validerIpMasqueIos(ip, masque, label = 'L’adresse de gestion') {
  const n = ipv4EnEntier(ip);
  if (n === null) return { ok: false, error: `${label} : une IPv4 en quatre nombres, sans zéro de tête.` };
  const p = prefixeDeMasqueIos(masque);
  if (p === null) return { ok: false, error: 'Le masque : décimal pointé contigu entre /8 et /30 (ex. 255.255.255.0).' };
  const premier = Math.floor(n / 2 ** 24);
  if (premier === 0 || premier === 127 || premier >= 224) return { ok: false, error: `${label} : adresse réservée (0.x, 127.x, multidiffusion ou supérieure).` };
  const taille = 2 ** (32 - p);
  const reseau = n - (n % taille);
  const diffusion = reseau + taille - 1;
  if (n === reseau) return { ok: false, error: `${label} : c’est l’adresse du réseau ${entierEnIpv4(reseau)}/${p}, pas une adresse d’hôte.` };
  if (n === diffusion) return { ok: false, error: `${label} : c’est l’adresse de diffusion du réseau ${entierEnIpv4(reseau)}/${p}.` };
  return { ok: true, valeur: { ip: entierEnIpv4(n), masque: String(masque).trim(), prefixe: p, reseau: entierEnIpv4(reseau), diffusion: entierEnIpv4(diffusion), n, reseauN: reseau, diffusionN: diffusion } };
}

/** Passerelle : IPv4 d'hôte du MÊME sous-réseau, différente de l'adresse de l'équipement. */
export function validerPasserelleIos(gw, hote) {
  const n = ipv4EnEntier(gw);
  if (n === null) return { ok: false, error: 'La passerelle : une IPv4 en quatre nombres.' };
  if (n === hote.n) return { ok: false, error: 'La passerelle ne peut pas être l’adresse de l’équipement lui-même.' };
  if (n < hote.reseauN || n > hote.diffusionN) return { ok: false, error: `La passerelle doit être dans le même sous-réseau (${hote.reseau}/${hote.prefixe}).` };
  if (n === hote.reseauN || n === hote.diffusionN) return { ok: false, error: 'La passerelle ne peut pas être l’adresse du réseau ni de diffusion.' };
  return { ok: true, valeur: entierEnIpv4(n) };
}

/** IPv4 de destination d'un ping (hôte quelconque, pas de multidiffusion). */
export function validerCibleIpv4(v, label = 'La cible') {
  const n = ipv4EnEntier(v);
  if (n === null) return { ok: false, error: `${label} : une IPv4 en quatre nombres.` };
  const premier = Math.floor(n / 2 ** 24);
  if (premier === 0 || premier >= 224) return { ok: false, error: `${label} : adresse réservée ou de multidiffusion.` };
  return { ok: true, valeur: entierEnIpv4(n) };
}

/**
 * Sortie collée par l'utilisateur (zone de texte). Les sauts de ligne sont
 * permis ; ces textes ne sont JAMAIS recopiés dans les commandes, seulement
 * analysés. On refuse ce qui ressemble à une configuration ou à un secret.
 */
export function validerSortieCollee(v, label = 'La sortie collée', { max = 30000 } = {}) {
  const s = String(v ?? '');
  if (s.trim() === '') return { ok: true, valeur: '' };
  if (s.length > max) return { ok: false, error: `${label} : ${max} caractères au plus.` };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)) return { ok: false, error: `${label} : caractères de contrôle interdits.` };
  if (secretsDans(s).length) {
    return { ok: false, error: `${label} semble contenir un secret ou un extrait de configuration : colle seulement la sortie de « show vlan brief », « show interfaces trunk » ou « show vtp status ».` };
  }
  if (/^\s*(?:enable|username|line (?:con|vty)|snmp-server|crypto key|banner)\b/im.test(s)) {
    return { ok: false, error: `${label} ressemble à un extrait de configuration (running-config) : ce n’est pas une sortie « show » acceptée.` };
  }
  return { ok: true, valeur: s.replace(/\r\n?/g, '\n') };
}
