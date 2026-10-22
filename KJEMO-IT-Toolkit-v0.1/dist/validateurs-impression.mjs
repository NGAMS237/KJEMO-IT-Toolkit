/**
 * validateurs-impression.mjs — LOT 9 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Validation des champs des assistants Imprimantes (Windows et CUPS).
 *
 * Principe, hérité des lots précédents : on REFUSE, on n'échappe pas. Un nom
 * d'imprimante, un hôte, un chemin UNC ou un identifiant de travail suit un
 * alphabet précis ; tout caractère hors de cet alphabet (guillemet,
 * point-virgule, antislash hors UNC, saut de ligne, joker, substitution de
 * commande) est une erreur de saisie ou une tentative d'injection, et dans les
 * deux cas le script n'est pas généré. En plus, chaque valeur est transportée
 * dans le script par psB64 (PowerShell) ou shQuote (Bash) : même une valeur qui
 * passerait ici ne peut pas sortir de sa chaîne.
 *
 * Trois règles propres à l'impression :
 *
 *   1. AUCUN JOKER dans un nom de cible. Remove-PrintJob sur « * » ou un
 *      Get-Printer -Name 'HP*' qui retourne trois files transformeraient une
 *      action ciblée en action de masse. Les caractères * et ? sont refusés.
 *
 *   2. AUCUN SECRET dans un champ. Une URI d'imprimante peut contenir
 *      « utilisateur:motdepasse@hôte » ; un mot de passe collé « pour essayer »
 *      finirait dans un script, un presse-papiers, un rapport. Le validateur
 *      reconnaît ces formes et refuse. Ce n'est PAS une garantie (un secret peut
 *      ressembler à n'importe quoi) : c'est la dernière ligne de défense — la
 *      première est qu'AUCUN champ ne demande de secret.
 *
 *   3. LE MÊME NOM, DEUX FOIS, N'EST PAS UNE CIBLE. Les noms d'imprimante
 *      Windows tolèrent les espaces et la casse ; la comparaison que fait le
 *      script ignore la casse, et les validateurs refusent les noms qui ne
 *      diffèrent que par des espaces de tête ou de queue (ils sont rognés).
 *
 * Ce module n'importe que validateurs.mjs (IPv4, FQDN, entiers).
 */

import { validateIPv4, validerFqdn, validerEntier, validerChoix } from './validateurs.mjs';

const RE_CONTROLE = /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;

function refuse(value, error) { return { ok: false, value, error }; }
function accepte(value) { return { ok: true, value, error: null }; }

/** Formes de secrets reconnues dans un champ d'impression. */
export const MOTIFS_SECRETS_IMPRESSION = [
  { nom: 'identifiants dans une URI', re: /[a-z][a-z0-9+.-]*:\/\/[^\s/@]*:[^\s/@]*@/i },
  { nom: 'mot de passe', re: /\b(password|passwd|pwd|mot de passe|motdepasse)\b\s*[:=]?|p[a@4]ss?w[o0]rd/i },
  { nom: 'jeton ou secret', re: /\b(secret|token|jeton)\s*[:=]|\bBearer\s+\S{8,}|\beyJ[A-Za-z0-9_-]{10,}\./i },
  { nom: 'clé privée', re: /BEGIN [A-Z ]*PRIVATE KEY/ },
];

export function secretsDansImpression(v) {
  const s = String(v ?? '');
  return MOTIFS_SECRETS_IMPRESSION.filter((m) => m.re.test(s)).map((m) => m.nom);
}

/** Contrôles communs à tout texte saisi : contrôle, secret. Retourne null si rien à dire. */
function base(v, label, { vide = false } = {}) {
  const brut = String(v ?? '');
  const s = brut.trim();
  if (!s) return vide ? accepte('') : refuse(s, `${label} est obligatoire.`);
  if (RE_CONTROLE.test(brut)) return refuse(s, `${label} contient un caractère de contrôle ou un retour à la ligne : un seul nom, sur une seule ligne.`);
  const sec = secretsDansImpression(s);
  if (sec.length) return refuse(s, `${label} ressemble à un secret (${sec[0]}) : aucun secret n’est accepté dans ce formulaire.`);
  return null;
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/**
 * Nom d'une imprimante Windows. Windows accepte presque tout sauf « \ », « , »
 * et « ; » ; on est plus strict, parce qu'un nom qui contient des guillemets,
 * un « $ », une esperluette ou un backtick n'a aucune raison d'exister ici et
 * est le véhicule classique d'une injection.
 */
export function validerNomImprimante(v, label = 'Le nom de l’imprimante') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (s.length > 220) return refuse(s, `${label} dépasse 220 caractères, la limite de Windows.`);
  if (/[*?]/.test(s)) return refuse(s, `${label} contient un joker (* ou ?) : cet assistant agit sur UNE imprimante nommée, jamais sur un motif.`);
  if (/[\\/]/.test(s)) return refuse(s, `${label} ne contient ni barre oblique ni antislash. Pour une file partagée, utilise le champ « chemin UNC » de l’assistant dédié.`);
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()#+-]*$/u.test(s)) {
    return refuse(s, `${label} n’accepte que lettres, chiffres, espaces et . _ - ( ) # + — et doit commencer par une lettre ou un chiffre. Les guillemets, « $ », « & », « ; », « , », « \` » sont refusés.`);
  }
  return accepte(s);
}

/** Nom d'un port d'imprimante (« IP_192.168.30.50 », « TCPPort:9100 »…). */
export function validerNomPort(v, label = 'Le nom du port') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (s.length > 64) return refuse(s, `${label} dépasse 64 caractères.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(s)) {
    return refuse(s, `${label} n’accepte que lettres, chiffres et . _ : - (sans espace), et commence par une lettre ou un chiffre.`);
  }
  return accepte(s);
}

/** Nom d'un pilote DÉJÀ INSTALLÉ (« Microsoft IPP Class Driver »…). */
export function validerNomPilote(v, label = 'Le nom du pilote') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (s.length > 200) return refuse(s, `${label} dépasse 200 caractères.`);
  if (/[*?]/.test(s)) return refuse(s, `${label} contient un joker : donne le nom exact tel que « Get-PrinterDriver » l’affiche.`);
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()#+,/-]*$/u.test(s)) {
    return refuse(s, `${label} n’accepte que lettres, chiffres, espaces et . _ - ( ) # + , / — tel que « Get-PrinterDriver » l’affiche. Les guillemets, « $ », « & », « ; » et « \` » sont refusés.`);
  }
  return accepte(s);
}

/**
 * Hôte d'imprimante : IPv4 ou nom DNS. Les adresses qui ne peuvent pas être
 * celles d'une imprimante (0.0.0.0, boucle locale, multicast, diffusion) sont
 * refusées : elles trahissent une faute de frappe, et un port TCP/IP créé vers
 * 127.0.0.1 « fonctionnerait » vers la mauvaise machine.
 */
export function validerHoteImprimante(v, label = 'L’adresse de l’imprimante') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (/^[0-9.]+$/.test(s)) {
    const ip = validateIPv4(s);
    if (!ip.ok) return refuse(s, `${label} : ${ip.error}`);
    const o = s.split('.').map(Number);
    if (o[0] === 0) return refuse(s, `${label} : l’adresse 0.x.x.x n’est pas celle d’une imprimante.`);
    if (o[0] === 127) return refuse(s, `${label} : 127.x.x.x est la boucle locale — c’est cette machine, pas l’imprimante.`);
    if (o[0] >= 224) return refuse(s, `${label} : les adresses 224.x.x.x et au-delà (multicast, diffusion, réservées) ne sont pas celles d’une imprimante.`);
    if (o[0] === 169 && o[1] === 254) return refuse(s, `${label} : 169.254.x.x est une adresse auto-attribuée (APIPA) : l’imprimante n’a probablement pas reçu d’adresse.`);
    return accepte(s);
  }
  if (!s.includes('.')) {
    if (s.length > 63 || !/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/.test(s)) {
      return refuse(s, `${label} : un nom court n’accepte que lettres, chiffres et tirets (63 caractères au plus), sans commencer ni finir par un tiret.`);
    }
    return accepte(s);
  }
  const f = validerFqdn(s);
  if (!f.ok) return refuse(s, `${label} : ${f.error}`);
  return accepte(f.value);
}

/** Chemin UNC d'une file partagée : \\serveur\partage — rien après. */
export function validerUncImprimante(v, label = 'Le chemin UNC') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  const m = /^\\\\([^\\/]+)\\([^\\/]+)$/.exec(s);
  if (!m) return refuse(s, `${label} doit avoir la forme \\\\serveur\\partage — deux antislash, le serveur, un antislash, le nom du partage, et rien d’autre (pas de sous-dossier, pas d’antislash final).`);
  const [, serveur, partage] = m;
  const h = validerHoteImprimante(serveur, 'Le serveur du chemin UNC');
  if (!h.ok) return refuse(s, h.error);
  if (partage.length > 80) return refuse(s, 'Le nom du partage dépasse 80 caractères.');
  if (/[*?]/.test(partage)) return refuse(s, 'Le nom du partage contient un joker : donne le nom exact.');
  if (partage.endsWith('$')) return refuse(s, 'Les partages masqués (nom terminé par « $ ») ne sont pas des files d’impression à connecter par cet assistant.');
  if (/[ .]$/.test(partage)) return refuse(s, 'Le nom du partage ne finit ni par un espace ni par un point.');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()#+-]*$/u.test(partage)) {
    return refuse(s, 'Le nom du partage n’accepte que lettres, chiffres, espaces et . _ - ( ) # + — et commence par une lettre ou un chiffre.');
  }
  return accepte(`\\\\${h.value}\\${partage}`);
}

/** Identifiant d'un travail d'impression : entier strict, sans zéro de tête. */
export function validerIdTravail(v, label = 'L’identifiant du travail') {
  const b = base(v, label);
  if (b) return b;
  return validerEntier(String(v).trim(), 1, 2147483647, label);
}

/** Port TCP : entier 1–65535. */
export function validerPortTcpImpression(v, label = 'Le port TCP') {
  const b = base(v, label);
  if (b) return b;
  return validerEntier(String(v).trim(), 1, 65535, label);
}

/** Compte attendu, tel que Windows l'écrit : « utilisateur » ou « DOMAINE\utilisateur ». */
export function validerCompteWindows(v, label = 'Le compte') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (s.length > 104) return refuse(s, `${label} dépasse 104 caractères.`);
  if (/[*?]/.test(s)) return refuse(s, `${label} contient un joker : donne le nom exact du compte.`);
  const m = /^(?:([A-Za-z0-9][A-Za-z0-9._-]{0,14})\\)?([A-Za-z0-9][A-Za-z0-9._ -]{0,63}\$?)$/.exec(s);
  if (!m) return refuse(s, `${label} s’écrit « utilisateur » ou « DOMAINE\\utilisateur » (lettres, chiffres, . _ - et espaces internes).`);
  return accepte(s);
}

/** Protocole d'une imprimante réseau et le port qui va avec par défaut. */
export const PROTOCOLES_IMPRESSION = {
  RAW: { port: 9100, nom: 'RAW / JetDirect (port 9100)', note: 'Flux brut TCP : le protocole le plus répandu pour un port TCP/IP Windows.' },
  LPR: { port: 515, nom: 'LPR / LPD (port 515)', note: 'Protocole d’impression en ligne : demande en plus un nom de file côté imprimante.' },
  IPP: { port: 631, nom: 'IPP (port 631)', note: 'Internet Printing Protocol : sans chiffrement par défaut.' },
  IPPS: { port: 443, nom: 'IPPS — IPP chiffré (port 443 le plus souvent ; 631 sur certains modèles)', note: 'Le port exact dépend du constructeur : indique-le dans le champ « port » si l’imprimante utilise autre chose.' },
  SMB: { port: 445, nom: 'Partage SMB (port 445) — file partagée par un serveur', note: 'On teste le serveur d’impression, pas l’imprimante : la file est un partage Windows.' },
};

export function validerProtocoleImpression(v) {
  return validerChoix(v, Object.keys(PROTOCOLES_IMPRESSION), 'Le protocole');
}

// ---------------------------------------------------------------------------
// CUPS
// ---------------------------------------------------------------------------

/**
 * Nom d'une destination CUPS. CUPS accepte tout caractère imprimable sauf
 * l'espace, la tabulation, « / » et « # » ; on n'accepte que l'alphabet que
 * l'on rencontre réellement, et surtout rien qui commence par « - » (une
 * option) ni rien qui ressemble à un identifiant de travail.
 */
export function validerDestinationCups(v, label = 'La destination CUPS') {
  const b = base(v, label);
  if (b) return b;
  const s = String(v).trim();
  if (s.length > 127) return refuse(s, `${label} dépasse 127 caractères, la limite de CUPS.`);
  if (/[*?]/.test(s)) return refuse(s, `${label} contient un joker : donne le nom exact tel que « lpstat -e » l’affiche.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s)) {
    return refuse(s, `${label} n’accepte que lettres, chiffres et . _ - (sans espace), et commence par une lettre ou un chiffre — jamais par « - », qui serait lue comme une option.`);
  }
  return accepte(s);
}

/** Identifiant d'un travail CUPS (le nombre après le tiret de « destination-NN »). */
export function validerIdTravailCups(v, label = 'Le numéro du travail') {
  return validerIdTravail(v, label);
}

/** Utilisateur Linux facultatif : minuscules, chiffres, _ et -. Vide accepté. */
export function validerUtilisateurLinuxFacultatif(v, label = 'Le propriétaire attendu') {
  const brut = String(v ?? '');
  const s = brut.trim();
  if (!s) return accepte('');
  if (RE_CONTROLE.test(brut)) return refuse(s, `${label} contient un caractère de contrôle.`);
  if (s.length > 32) return refuse(s, `${label} dépasse 32 caractères.`);
  if (!/^[a-z_][a-z0-9_-]*$/.test(s)) return refuse(s, `${label} s’écrit en minuscules, chiffres, « _ » et « - », sans espace.`);
  return accepte(s);
}

export { validerChoix, validerEntier };
