/**
 * validateurs-linux.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les validateurs des champs de formulaire propres au lot Linux.
 *
 * Chacun retourne `{ ok, value, error }`, comme les validateurs Windows, pour
 * que l'interface les traite de la même façon.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CES VALIDATEURS PROTÈGENT, ET CE QU'ILS NE PROTÈGENT PAS
 * ---------------------------------------------------------------------------
 * Ils ne protègent PAS contre l'injection de commandes. C'est important de le
 * dire, parce qu'un validateur qui interdit `;` et `$(` donne le sentiment
 * d'avoir réglé la question, et invite à relâcher la citation ailleurs.
 *
 * L'injection est rendue impossible en amont, par `shQuote()`, qui enveloppe
 * toute valeur dans des apostrophes simples où aucun caractère n'est spécial.
 * Cette garantie est structurelle et ne dépend d'aucune liste noire.
 *
 * Ces validateurs protègent contre autre chose, qui compte autant : des
 * valeurs SYNTAXIQUEMENT citables mais SÉMANTIQUEMENT fausses. Un nom d'unité
 * systemd avec un espace, un chemin relatif là où il faut un chemin absolu, un
 * entier hors bornes. `shQuote` les citerait parfaitement, et le script
 * échouerait ensuite avec un message obscur. Mieux vaut refuser dans le
 * formulaire, où l'on peut expliquer.
 */

/**
 * Chemin absolu.
 *
 * Exigences : commence par `/`, pas de `..`, pas d'octet nul, pas de retour à
 * la ligne.
 *
 * Le refus de `..` mérite sa ligne. Le gardien de chemin, dans le script,
 * canonise avant de comparer, donc `..` ne lui échappe pas. Mais un `..` dans
 * un formulaire est presque toujours soit une erreur de saisie, soit une
 * tentative, et dans les deux cas l'utilisateur gagne à l'apprendre
 * maintenant plutôt qu'à lire « zone protégée détectée » sur un chemin qu'il
 * croyait innocent. Le gardien reste la défense ; ceci est la politesse.
 */
export function validateCheminAbsolu(v, label = 'Le chemin') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (!s.startsWith('/')) {
    return { ok: false, value: s, error: `${label} doit être absolu et commencer par « / » (exemple : /srv/donnees).` };
  }
  if (s.includes('\0')) {
    return { ok: false, value: s, error: `${label} contient un octet nul, ce qui est impossible dans un nom de fichier.` };
  }
  if (/[\n\r]/.test(s)) {
    return { ok: false, value: s, error: `${label} contient un retour à la ligne. Saisis un seul chemin.` };
  }
  if (s.split('/').includes('..')) {
    return { ok: false, value: s, error: `${label} contient « .. ». Saisis le chemin final, sans remontée : le gardien le refuserait après canonisation.` };
  }
  if (s.length > 4096) {
    return { ok: false, value: s, error: `${label} dépasse 4096 caractères, la limite du noyau Linux.` };
  }
  if (s !== '/' && s.endsWith('/')) {
    return { ok: true, value: s.replace(/\/+$/, ''), error: null };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Nom de fichier simple, sans composante de chemin.
 *
 * Interdit `/` — sinon ce n'est plus un nom de fichier mais un chemin, et
 * l'outil l'écrirait ailleurs que là où il l'annonce. Interdit aussi `.` et
 * `..` seuls, qui désignent des dossiers et non des fichiers.
 */
export function validateNomFichier(v, label = 'Le nom de fichier') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.includes('/')) {
    return { ok: false, value: s, error: `${label} ne doit pas contenir « / » : saisis un nom, pas un chemin.` };
  }
  if (s === '.' || s === '..') {
    return { ok: false, value: s, error: `${label} ne peut pas être « ${s} » : ce sont des dossiers, pas des fichiers.` };
  }
  if (s.includes('\0') || /[\n\r]/.test(s)) {
    return { ok: false, value: s, error: `${label} contient un caractère impossible dans un nom de fichier.` };
  }
  if (s.length > 255) {
    return { ok: false, value: s, error: `${label} dépasse 255 caractères, la limite d\u2019un nom de fichier.` };
  }
  if (s.startsWith('-')) {
    return { ok: false, value: s, error: `${label} ne doit pas commencer par « - » : les commandes le prendraient pour une option.` };
  }
  return { ok: true, value: s, error: null };
}

/** Entier strictement borné. */
export function validateEntierBorne(v, min, max, label = 'La valeur') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: null, error: `${label} ne peut pas être vide.` };
  if (!/^\d+$/.test(s)) {
    return { ok: false, value: null, error: `${label} doit être un entier positif (exemple : ${min}). Valeur saisie : « ${s} ».` };
  }
  const n = Number(s);
  if (n < min || n > max) {
    return { ok: false, value: null, error: `${label} doit être comprise entre ${min} et ${max}. Valeur saisie : ${n}.` };
  }
  return { ok: true, value: n, error: null };
}

/**
 * Nom d'unité systemd.
 *
 * Les caractères admis viennent de systemd.unit(5) : lettres, chiffres, et
 * `: - _ . \ @`. Le suffixe est optionnel ; quand il est absent, systemd
 * suppose `.service`, et le script le laisse supposer plutôt que de le
 * rajouter — ajouter « .service » à « cockpit.socket » cassererait l'outil.
 */
export function validateNomUnite(v, label = 'Le nom du service') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 255) {
    return { ok: false, value: s, error: `${label} dépasse 255 caractères.` };
  }
  if (!/^[A-Za-z0-9:_.\\@-]+$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} contient un caractère qu\u2019une unité systemd n\u2019admet pas. Autorisés : lettres, chiffres, « : - _ . \\ @ » (voir systemd.unit(5)).`,
    };
  }
  if (s.startsWith('-')) {
    return { ok: false, value: s, error: `${label} ne doit pas commencer par « - » : systemctl le prendrait pour une option.` };
  }
  return { ok: true, value: s, error: null };
}

/** Valeur prise dans une liste fermée. */
export function validateChoix(v, choix, label = 'La valeur') {
  const s = String(v ?? '').trim();
  if (!choix.includes(s)) {
    return { ok: false, value: s, error: `${label} doit être l\u2019une de : ${choix.join(', ')}. Valeur reçue : « ${s} ».` };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Durée acceptée par `journalctl --since`.
 *
 * Liste fermée plutôt que syntaxe libre. `journalctl` accepte une grammaire
 * riche (« yesterday », « 2026-01-01 08:00:00 », « -3h »), et la valider
 * correctement demanderait de réimplémenter son analyseur. Une liste de
 * valeurs sûres couvre les besoins réels du dépannage et ne peut pas produire
 * une plage vide par faute de frappe — le pire des cas, puisqu'il ressemble
 * à « aucune erreur ».
 */
export const DUREES_JOURNAL = [
  '15 min ago', '1 hour ago', '6 hours ago', '1 day ago',
  '2 days ago', '7 days ago', '30 days ago',
];

export function validateDureeJournal(v, label = 'La période') {
  return validateChoix(v, DUREES_JOURNAL, label);
}

/**
 * Nom d'utilisateur Linux.
 *
 * La règle suivie est celle que `useradd` applique par défaut sur Debian et
 * Ubuntu (NAME_REGEX dans adduser.conf) : commence par une lettre minuscule
 * ou un souligné, puis minuscules, chiffres, souligné et tiret, 32 caractères
 * au plus.
 *
 * On refuse les majuscules même si le noyau les tolère : un compte « Pierre »
 * sur un système où tout le reste est en minuscules devient une source de
 * confusion permanente, et certains services le normalisent silencieusement.
 */
export function validateNomUtilisateur(v, label = 'Le nom d\u2019utilisateur') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 32) {
    return { ok: false, value: s, error: `${label} dépasse 32 caractères, la limite de useradd.` };
  }
  if (!/^[a-z_][a-z0-9_-]*$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} doit commencer par une minuscule ou « _ », puis ne contenir que minuscules, chiffres, « _ » et « - ». Valeur saisie : « ${s} ».`,
    };
  }
  // Les comptes systeme classiques : les toucher casse la machine.
  const RESERVES = ['root', 'daemon', 'bin', 'sys', 'sync', 'games', 'man', 'lp', 'mail',
    'news', 'uucp', 'proxy', 'www-data', 'backup', 'list', 'irc', 'nobody',
    'systemd-network', 'systemd-resolve', 'messagebus', 'sshd'];
  if (RESERVES.includes(s)) {
    return {
      ok: false,
      value: s,
      error: `« ${s} » est un compte système. Cet assistant ne le touche pas : le modifier casserait des services qui en dépendent.`,
    };
  }
  return { ok: true, value: s, error: null };
}

/** Nom de groupe Linux : même grammaire que le nom d'utilisateur. */
export function validateNomGroupe(v, label = 'Le nom du groupe') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 32) {
    return { ok: false, value: s, error: `${label} dépasse 32 caractères.` };
  }
  if (!/^[a-z_][a-z0-9_-]*$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} doit commencer par une minuscule ou « _ », puis ne contenir que minuscules, chiffres, « _ » et « - ».`,
    };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Mode de permissions en octal, exactement trois ou quatre chiffres.
 *
 * Le quatrième chiffre (setuid, setgid, sticky) est accepté mais setuid et
 * setgid sur un FICHIER sont refusés : un binaire setuid root posé par un
 * script de confort est une élévation de privilèges permanente, et ce n'est
 * pas ce que fait un assistant de permissions. Le sticky bit et le setgid sur
 * un DOSSIER, eux, sont des usages légitimes et courants — un partage de
 * groupe en a besoin.
 */
export function validateModeOctal(v, { surDossier = false, label = 'Le mode' } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (!/^[0-7]{3,4}$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} doit être trois ou quatre chiffres octaux (exemple : 750, ou 2770 pour un dossier de groupe). Valeur saisie : « ${s} ».`,
    };
  }
  if (s.length === 4) {
    const special = Number(s[0]);
    // 4 = setuid, 2 = setgid, 1 = sticky
    if (!surDossier && (special & 4)) {
      return {
        ok: false,
        value: s,
        error: 'Le bit setuid (4xxx) sur un fichier est refusé : il ferait exécuter le programme avec les droits de son propriétaire, ce qui est une élévation de privilèges permanente.',
      };
    }
    if (!surDossier && (special & 2)) {
      return {
        ok: false,
        value: s,
        error: 'Le bit setgid (2xxx) sur un fichier est refusé. Sur un dossier il est légitime : choisis alors le mode dossier.',
      };
    }
  }
  return { ok: true, value: s, error: null };
}

/**
 * Nom de partage Samba.
 *
 * smb.conf(5) tolère beaucoup ; les clients Windows beaucoup moins. Les
 * caractères refusés ici sont ceux que Windows n'accepte pas dans un nom de
 * partage, plus l'espace — légal, mais source de guillemets oubliés dans
 * toutes les commandes qui suivront.
 */
export function validateNomPartage(v, label = 'Le nom du partage') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 80) {
    return { ok: false, value: s, error: `${label} dépasse 80 caractères.` };
  }
  if (/[\\/:*?"<>|[\]+=;,\s]/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} ne doit contenir ni espace ni l\u2019un de ces caractères : \\ / : * ? " < > | [ ] + = ; , — les clients Windows les refusent.`,
    };
  }
  if (s.toLowerCase() === 'global' || s.toLowerCase() === 'homes' || s.toLowerCase() === 'printers') {
    return {
      ok: false,
      value: s,
      error: `« ${s} » est une section réservée de smb.conf. Choisis un autre nom : écrire dedans changerait la configuration globale.`,
    };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Adresse ou réseau autorisé pour un export NFS.
 *
 * `*` est REFUSÉ. Ce n'est pas une préférence : un export NFS vers `*` est
 * accessible à toute machine capable de joindre le port, sans authentification
 * digne de ce nom, et NFSv3 fait confiance à l'UID que le client annonce. Un
 * `*` sur un réseau d'entreprise est une fuite de données, et sur un réseau
 * étudiant une leçon qu'on apprend mal.
 *
 * Accepté : une IPv4 seule, un réseau en notation CIDR, un nom d'hôte.
 */
export function validateClientNfs(v, label = 'Le client autorisé') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s === '*' || s.includes('*') || s.includes('?')) {
    return {
      ok: false,
      value: s,
      error: 'Un export vers « * » ou vers un motif est refusé : il ouvrirait le partage à toute machine joignant le port, et NFSv3 fait confiance à l\u2019UID annoncé par le client. Saisis une adresse ou un réseau CIDR précis (exemple : 192.168.30.0/24).',
    };
  }
  if (/[\s;|&$`'"\\]/.test(s)) {
    return { ok: false, value: s, error: `${label} contient un caractère qui n\u2019a pas sa place dans /etc/exports.` };
  }
  // IPv4, avec ou sans préfixe CIDR
  const cidr = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/);
  if (cidr) {
    const octets = cidr.slice(1, 5).map(Number);
    if (octets.some((o) => o > 255)) {
      return { ok: false, value: s, error: `${label} : chaque octet d\u2019une adresse IPv4 doit être entre 0 et 255.` };
    }
    if (cidr[5] !== undefined) {
      const p = Number(cidr[5]);
      if (p > 32) return { ok: false, value: s, error: `${label} : le préfixe CIDR doit être entre 0 et 32.` };
      if (p === 0) {
        return {
          ok: false,
          value: s,
          error: 'Le préfixe /0 désigne l\u2019Internet entier : c\u2019est « * » écrit autrement, et il est refusé pour la même raison.',
        };
      }
    }
    return { ok: true, value: s, error: null };
  }
  // Nom d'hôte
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(s)) {
    return { ok: true, value: s, error: null };
  }
  return {
    ok: false,
    value: s,
    error: `${label} doit être une adresse IPv4, un réseau CIDR (192.168.30.0/24) ou un nom d\u2019hôte.`,
  };
}

/**
 * Port TCP.
 *
 * Le port 0 est refusé : il existe dans la plage mais signifie « laisse le
 * système choisir », ce qui n'a aucun sens dans un formulaire de diagnostic.
 */
export function validatePortTcp(v, label = 'Le port') {
  const r = validateEntierBorne(v, 1, 65535, label);
  if (!r.ok) return r;
  return { ok: true, value: r.value, error: null };
}
