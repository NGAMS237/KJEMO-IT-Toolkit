/**
 * calcul-ip.mjs — arithmétique IPv4, en BigInt
 * ---------------------------------------------
 * Pourquoi BigInt plutôt que les opérateurs binaires de JavaScript.
 *
 * `&`, `|`, `~` et `<<` convertissent leurs opérandes en entiers 32 bits
 * SIGNÉS. Dès que le premier octet dépasse 127, le résultat devient négatif :
 *
 *   (192 << 24)              →  -1073741824
 *   ~0xFFFFFF00              →  255          (et non 4294967040)
 *
 * On peut s'en sortir en semant des `>>> 0` partout. On peut aussi en oublier
 * un, et produire un masque faux pour 10.0.0.0/8 tout en restant juste pour
 * 192.168.1.0/24 — l'erreur la plus désagréable qui soit, parce qu'elle passe
 * les essais faits à la main.
 *
 * Ici, tout passe par BigInt. Il n'y a pas de signe, pas de débordement, pas
 * de `>>> 0` à ne pas oublier. La conversion vers Number ne se fait qu'au tout
 * dernier moment, pour des valeurs qui tiennent largement dans un double.
 *
 * Ce module ne couvre QUE IPv4. L'IPv6 n'est pas traitée, et ne doit pas être
 * annoncée comme traitée.
 *
 * Aucun import : c'est de l'arithmétique.
 */

const QUATRE_MILLIARDS = 4294967296n; // 2^32
const MAX32 = 4294967295n;            // 2^32 - 1

/** Vrai si la chaîne est une IPv4 en quatre octets décimaux, sans zéro de tête. */
export function estIPv4(v) {
  const s = String(v ?? '').trim();
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    if (n > 255) return false;
    if (p !== String(n)) return false; // « 010 » n'est pas « 10 »
  }
  return true;
}

/** IPv4 pointée → BigInt 0..2^32-1. Lève si l'adresse est invalide. */
export function ipEnBigInt(v) {
  const s = String(v ?? '').trim();
  if (!estIPv4(s)) throw new Error(`Adresse IPv4 invalide : « ${s} »`);
  return s.split('.').reduce((n, o) => (n * 256n) + BigInt(o), 0n);
}

/** BigInt 0..2^32-1 → IPv4 pointée. Lève hors de la plage. */
export function bigIntEnIp(n) {
  const x = BigInt(n);
  if (x < 0n || x > MAX32) throw new Error(`Hors de la plage IPv4 : ${x}`);
  return [24n, 16n, 8n, 0n].map((d) => (x >> d) & 255n).join('.');
}

/** Masque d'un préfixe, en BigInt. /0 → 0, /32 → 2^32-1. */
export function masqueDePrefixe(prefixe) {
  const p = Number(prefixe);
  if (!Number.isInteger(p) || p < 0 || p > 32) {
    throw new Error(`Préfixe IPv4 invalide : « ${prefixe} » (attendu 0 à 32)`);
  }
  if (p === 0) return 0n;
  return (MAX32 << BigInt(32 - p)) & MAX32;
}

/** Préfixe d'un masque pointé contigu, ou null si le masque n'est pas contigu. */
export function prefixeDeMasque(masque) {
  let n;
  try { n = ipEnBigInt(masque); } catch { return null; }
  // Un masque valide est une suite de 1 suivie d'une suite de 0.
  let p = 0;
  let vuZero = false;
  for (let bit = 31n; bit >= 0n; bit--) {
    const b = (n >> bit) & 1n;
    if (b === 1n) {
      if (vuZero) return null; // un 1 après un 0 : masque non contigu
      p++;
    } else {
      vuZero = true;
    }
  }
  return p;
}

/**
 * Tout ce qu'on veut savoir d'un couple adresse / préfixe.
 *
 * Les comptages reviennent en Number parce qu'ils tiennent dans un double
 * (2^32 au maximum), mais le calcul lui-même reste en BigInt.
 *
 * Les cas /31 et /32 sont traités à part, et c'est voulu :
 *   /32 — un seul hôte, pas de réseau ni de diffusion à distinguer ;
 *   /31 — RFC 3021 : les deux adresses sont utilisables sur une liaison
 *         point à point. Les compter comme « 0 utilisable » est faux.
 */
export function calculerSousReseau(adresse, prefixe) {
  const ip = ipEnBigInt(adresse);
  const p = Number(prefixe);
  const masque = masqueDePrefixe(p);
  const wildcard = MAX32 - masque;
  const reseau = ip & masque;
  const diffusion = reseau | wildcard;
  const total = QUATRE_MILLIARDS >> BigInt(p); // 2^(32-p)

  let premiere = null;
  let derniere = null;
  let utilisables = 0n;
  let note = '';

  if (p === 32) {
    premiere = reseau;
    derniere = reseau;
    utilisables = 1n;
    note = 'Hôte unique : /32 désigne une seule adresse, sans réseau ni diffusion distincts.';
  } else if (p === 31) {
    premiere = reseau;
    derniere = diffusion;
    utilisables = 2n;
    note = 'Liaison point à point (RFC 3021) : les deux adresses sont utilisables, il n’y a ni adresse de réseau ni adresse de diffusion.';
  } else {
    premiere = reseau + 1n;
    derniere = diffusion - 1n;
    utilisables = total - 2n;
    note = 'L’adresse de réseau et l’adresse de diffusion ne sont pas attribuables à un hôte.';
  }

  return {
    adresse: bigIntEnIp(ip),
    prefixe: p,
    masque: bigIntEnIp(masque),
    wildcard: bigIntEnIp(wildcard),
    reseau: bigIntEnIp(reseau),
    diffusion: p >= 31 ? null : bigIntEnIp(diffusion),
    premiereUtilisable: bigIntEnIp(premiere),
    derniereUtilisable: bigIntEnIp(derniere),
    totalAdresses: Number(total),
    adressesUtilisables: Number(utilisables),
    estAdresseReseau: p < 31 && ip === reseau,
    estAdresseDiffusion: p < 31 && ip === diffusion,
    classe: classeHistorique(ip),
    portee: porteeAdresse(ip),
    cidr: `${bigIntEnIp(reseau)}/${p}`,
    note,
  };
}

/** Les deux adresses tombent-elles dans le même sous-réseau, pour ce préfixe ? */
export function memeSousReseau(a, b, prefixe) {
  const masque = masqueDePrefixe(prefixe);
  const na = ipEnBigInt(a) & masque;
  const nb = ipEnBigInt(b) & masque;
  return {
    identique: na === nb,
    reseauA: bigIntEnIp(na),
    reseauB: bigIntEnIp(nb),
    prefixe: Number(prefixe),
  };
}

/**
 * Découpe un réseau en sous-réseaux d'un préfixe plus long.
 *
 * Le nombre de sous-réseaux double à chaque bit emprunté : passer d'un /16 à
 * un /24 en produit 256, d'un /8 à un /24 plus de soixante mille. On borne
 * donc la liste rendue, et on dit combien il y en a en tout.
 */
export function decouperSousReseaux(adresse, prefixeInitial, prefixeCible, maximum = 64) {
  const p0 = Number(prefixeInitial);
  const p1 = Number(prefixeCible);
  if (!Number.isInteger(p1) || p1 < 0 || p1 > 32) {
    throw new Error(`Préfixe cible invalide : « ${prefixeCible} »`);
  }
  if (p1 < p0) {
    throw new Error(`Le préfixe cible /${p1} est plus court que /${p0} : ce serait un regroupement, pas un découpage.`);
  }
  const base = ipEnBigInt(adresse) & masqueDePrefixe(p0);
  const pas = QUATRE_MILLIARDS >> BigInt(p1);
  const nombre = 1n << BigInt(p1 - p0);
  const limite = BigInt(Math.max(1, Math.min(maximum, 1024)));
  const rendus = nombre < limite ? nombre : limite;

  const liste = [];
  for (let i = 0n; i < rendus; i++) {
    const debut = base + (i * pas);
    liste.push(calculerSousReseau(bigIntEnIp(debut), p1));
  }
  return {
    depuis: `${bigIntEnIp(base)}/${p0}`,
    vers: `/${p1}`,
    nombreTotal: Number(nombre),
    nombreRendu: liste.length,
    tronque: nombre > rendus,
    sousReseaux: liste,
  };
}

/** Classe historique (A/B/C/D/E). Indicative : le routage est sans classe depuis 1993. */
export function classeHistorique(ipBigInt) {
  const premier = Number((BigInt(ipBigInt) >> 24n) & 255n);
  if (premier < 128) return 'A (historique)';
  if (premier < 192) return 'B (historique)';
  if (premier < 224) return 'C (historique)';
  if (premier < 240) return 'D — multidiffusion';
  return 'E — réservée';
}

/** Plages privées, bouclage, lien-local, documentation : ce qui n'est pas routable sur Internet. */
const PLAGES_SPECIALES = [
  ['10.0.0.0', 8, 'privée (RFC 1918)'],
  ['172.16.0.0', 12, 'privée (RFC 1918)'],
  ['192.168.0.0', 16, 'privée (RFC 1918)'],
  ['127.0.0.0', 8, 'bouclage'],
  ['169.254.0.0', 16, 'lien-local / APIPA'],
  ['100.64.0.0', 10, 'partagée entre opérateurs (RFC 6598)'],
  ['192.0.2.0', 24, 'documentation (TEST-NET-1)'],
  ['198.51.100.0', 24, 'documentation (TEST-NET-2)'],
  ['203.0.113.0', 24, 'documentation (TEST-NET-3)'],
  ['224.0.0.0', 4, 'multidiffusion'],
  ['240.0.0.0', 4, 'réservée'],
  ['0.0.0.0', 8, 'ce réseau'],
];

/** « privée », « bouclage », « publique »… pour une adresse donnée. */
export function porteeAdresse(ipBigInt) {
  const n = BigInt(ipBigInt);
  for (const [base, pre, nom] of PLAGES_SPECIALES) {
    const m = masqueDePrefixe(pre);
    if ((n & m) === (ipEnBigInt(base) & m)) return nom;
  }
  return 'publique';
}

/** Vrai si l'adresse appartient à une plage privée RFC 1918. */
export function estPrivee(adresse) {
  const n = ipEnBigInt(adresse);
  for (const [base, pre] of [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16]]) {
    const m = masqueDePrefixe(pre);
    if ((n & m) === (ipEnBigInt(base) & m)) return true;
  }
  return false;
}

/** Vrai si le réseau entier (adresse + préfixe) tient dans une plage privée. */
export function reseauPrive(adresse, prefixe) {
  const p = Number(prefixe);
  const reseau = ipEnBigInt(adresse) & masqueDePrefixe(p);
  const diffusion = reseau | (MAX32 - masqueDePrefixe(p));
  return estPrivee(bigIntEnIp(reseau)) && estPrivee(bigIntEnIp(diffusion));
}
