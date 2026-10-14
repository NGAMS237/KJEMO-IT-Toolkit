/**
 * noyau-bash.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le pendant Bash de noyau.mjs : citation des valeurs utilisateur, en-tête de
 * script, et assemblage d'un fichier .sh conforme.
 *
 * Aucune dépendance : ce module n'importe rien, pour la même raison que
 * noyau.mjs — éviter un cycle ESM avec les catalogues d'outils.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE MODULE NE RESSEMBLE PAS À noyau.mjs
 * ---------------------------------------------------------------------------
 * Côté Windows, psB64() encode chaque valeur utilisateur en Base64. Ce n'était
 * pas un excès de prudence : PowerShell traite U+2018, U+2019, U+201C et
 * U+201D comme de VRAIS délimiteurs de chaîne, si bien qu'une apostrophe
 * typographique collée dans un script casse l'analyse syntaxique.
 *
 * Bash ne fait pas cela. À l'intérieur d'une chaîne à apostrophes simples,
 * AUCUN caractère n'est spécial — pas `$`, pas `` ` ``, pas `$(...)`, pas `;`,
 * pas le retour à la ligne — à la seule exception de l'apostrophe simple
 * elle-même, qui termine la chaîne. C'est une propriété du langage, pas une
 * liste de caractères à tenir à jour.
 *
 * shQuote() s'appuie exactement sur cette propriété : il enveloppe la valeur
 * dans des apostrophes simples et remplace chaque apostrophe interne par la
 * séquence de fermeture-échappement-réouverture `'\''`. Il n'existe donc
 * aucune valeur, quelle qu'elle soit, capable de s'échapper de la citation.
 * Un encodage Base64 serait ici une complication sans gain : il rendrait les
 * scripts illisibles alors que l'utilisateur est précisément invité à les
 * relire avant de les lancer.
 *
 * Lisibilité et sûreté vont dans le même sens, pour une fois. On en profite.
 */

/**
 * Cite une valeur utilisateur pour Bash, de façon inconditionnellement sûre.
 *
 * Le résultat est TOUJOURS une chaîne à apostrophes simples, y compris pour
 * une valeur vide : `''`. Cela garantit qu'un paramètre absent reste un
 * argument vide et ne disparaît pas de la ligne de commande, ce qui
 * décalerait les arguments suivants.
 *
 *   shQuote("rapport final")   →  'rapport final'
 *   shQuote("l'été")           →  'l'\''été'
 *   shQuote("; rm -rf /")      →  '; rm -rf /'          (littéral, inoffensif)
 *   shQuote("$(whoami)")       →  '$(whoami)'           (littéral, inoffensif)
 *   shQuote("a\nb")            →  'a<LF>b'              (littéral)
 *
 * @param {*} v  valeur à citer
 * @returns {string} expression Bash littérale équivalente
 */
export function shQuote(v) {
  const s = String(v ?? '');
  // ---------------------------------------------------------------------------
  // L'OCTET NUL EST REFUSÉ, ET CE N'EST PAS UN EXCÈS DE ZÈLE
  //
  // Toutes les autres valeurs sont transportables : les apostrophes simples les
  // rendent littérales, quelles qu'elles soient. L'octet nul est la seule
  // exception RÉELLE, et elle est structurelle, pas prudentielle.
  //
  // Un argument de commande, sous Unix, est une chaîne terminée par un octet
  // nul. Un nul AU MILIEU d'une valeur n'est donc pas « un caractère difficile
  // à citer » : c'est la fin de la chaîne. Bash ne peut pas le transporter, et
  // il ne s'en plaint pas — il TRONQUE silencieusement. Une valeur
  // « rapport\0; rm -rf /tmp » arriverait au script comme « rapport », et
  // l'utilisateur verrait un résultat plausible, produit sur une autre cible
  // que celle qu'il croyait avoir saisie.
  //
  // Une troncature silencieuse qui change la cible d'une commande est bien
  // pire qu'une erreur. On lève donc, plutôt que de citer quelque chose dont
  // on sait que le résultat ne correspondra pas à l'intention.
  //
  // En pratique un formulaire HTML n'en produit pas : ce cas vient d'un appel
  // programmatique, et c'est précisément là qu'une erreur franche est utile.
  // ---------------------------------------------------------------------------
  if (s.includes('\0')) {
    throw new Error(
      'Valeur refusée : elle contient un octet nul (U+0000). Bash ne peut pas '
      + 'le transporter dans un argument — la chaîne serait tronquée AU nul, '
      + 'silencieusement, et le script agirait sur une cible différente de celle '
      + 'qui a été saisie. Retire cet octet de la valeur.');
  }
  return `'${s.split("'").join("'\\''")}'`;
}

/**
 * Vérifie qu'un texte est bien un contenu de script .sh transmissible :
 * pas de BOM, pas de CR, un shebang correct en première ligne.
 *
 * Levée plutôt que valeur de retour : un script mal formé ne doit jamais
 * arriver jusqu'au bouton de téléchargement. Appelée par assemblerSh().
 */
export function assertShConforme(texte) {
  const t = String(texte ?? '');
  if (t.charCodeAt(0) === 0xFEFF) {
    throw new Error(
      'Script Bash invalide : il commence par un BOM UTF-8. Un BOM placé avant '
      + '« #! » empêche le noyau de reconnaître le shebang, et le script échoue '
      + 'avec « bad interpreter » ou s\u2019exécute avec le mauvais shell.');
  }
  if (t.includes('\r')) {
    throw new Error(
      'Script Bash invalide : il contient un retour chariot (CR). Les fins de '
      + 'ligne CRLF font échouer le shebang (« bad interpreter: no such file or '
      + 'directory ») et collent un \\r invisible à la fin de chaque valeur.');
  }
  if (!t.startsWith(SHEBANG_BASH + '\n')) {
    throw new Error(
      `Script Bash invalide : la première ligne doit être exactement « ${SHEBANG_BASH} ».`);
  }
  // ---------------------------------------------------------------------------
  // LA RÈGLE ASCII N'EST PAS VÉRIFIÉE ICI — ET C'EST UNE CORRECTION
  //
  // Elle l'était, et elle était FAUSSE. Un contrôle « aucun caractère non ASCII
  // dans le script assemblé » rejette aussi les VALEURS saisies par
  // l'utilisateur, qui arrivent dans le script par shQuote. Le défaut s'est
  // manifesté sur un cas parfaitement ordinaire : la description par défaut de
  // bash-script-starter, « Traite les fichiers d'un dossier et écrit un
  // rapport. », avec une apostrophe typographique et un accent. Autrement dit
  // la règle interdisait d'écrire en français correct dans un formulaire
  // français.
  //
  // Les deux choses sont à distinguer, et je les avais confondues :
  //
  //   - les valeurs de l'UTILISATEUR sont de l'UTF-8 quelconque. Elles doivent
  //     passer intactes, accents et apostrophes typographiques compris.
  //     shQuote() le garantit pour n'importe quel octet sauf le nul, et c'est
  //     une propriété du langage, pas une liste de caractères tolérés.
  //
  //   - le texte que J'ÉCRIS — commentaires, noms de variables, messages du
  //     script — reste en ASCII, pour la raison expliquée au-dessus
  //     d'assemblerSh() : ces commentaires sont ce qu'on demande à
  //     l'utilisateur de relire, et un terminal mal réglé les rendrait
  //     illisibles.
  //
  // La discipline ASCII s'applique donc aux FRAGMENTS QUE J'AUTORE, et elle est
  // vérifiée statiquement sur le code source des modules, par
  // test/sh-hygiene.test.mjs. C'est le bon endroit : c'est là que je faisais
  // l'erreur, et une vérification statique la montre avant même qu'un script
  // soit généré.
  //
  // Ce qui reste vérifié ici est ce qui est réellement une condition de
  // validité d'un .sh : pas de BOM, pas de CR, le shebang exact.
  // ---------------------------------------------------------------------------
  return t;
}

/** Le shebang, à la chaîne près. Aucun outil ne le réécrit à la main. */
export const SHEBANG_BASH = '#!/usr/bin/env bash';

/**
 * Version du catalogue Linux, reportée dans chaque script et dans chaque
 * rapport. Les scripts Windows gardent la leur : les deux plateformes
 * versionnent séparément, et la garde d'identité des 856 scripts
 * historiques interdit de les faire bouger ensemble.
 */
export const VERSION_LINUX = 'LOT 7 - Linux et services reseau - 7.0.0';

/**
 * Assemble les lignes d'un script Bash en un fichier conforme :
 * LF uniquement, aucun BOM, exactement un retour à la ligne final, et corps
 * entièrement en ASCII.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI LE TEXTE QUE NOUS ÉCRIVONS EST EN ASCII
 * ---------------------------------------------------------------------------
 * La règle porte sur les fragments AUTORÉS — commentaires, messages, noms de
 * variables — et NON sur les valeurs saisies par l'utilisateur, qui sont de
 * l'UTF-8 quelconque et doivent passer intactes. La confusion entre les deux a
 * été une vraie erreur, corrigée : voir le commentaire dans assertShConforme().
 *
 * Bash n'en a aucun besoin : un commentaire accentué dans un fichier UTF-8
 * sans BOM se lit parfaitement. Ce n'est donc PAS une limite du langage, et il
 * serait malhonnête de le présenter comme telle.
 *
 * C'est un choix de robustesse, pris en connaissance de cause après l'incident
 * du LOT 6 : un tiret cadratin dans un script PowerShell lu en CP1252 devenait
 * un guillemet typographique, donc un vrai délimiteur de chaîne, et les dix-huit
 * scripts échouaient à l'analyse. Côté Bash le même caractère ne casse rien —
 * mais il s'affiche en mojibake dès qu'un terminal, une session SSH ou un
 * `LANG` mal réglé s'en mêle. Or ces commentaires sont précisément ce qu'on
 * demande à l'utilisateur de RELIRE avant de lancer le script.
 *
 * Un commentaire illisible n'est pas une panne, c'est pire : c'est une
 * consigne de sécurité que personne ne lit. L'ASCII coûte deux cédilles et
 * supprime toute la question.
 *
 * L'interface, elle, garde la typographie française complète : les fiches sont
 * de l'HTML, pas du script. La règle ne s'applique qu'au corps des .sh, et le
 * banc `check-sh-hygiene.mjs` la vérifie fichier par fichier.
 *
 * Le retour final n'est pas une coquetterie : POSIX définit une ligne comme
 * se terminant par un saut de ligne, et un fichier dont la dernière ligne n'en
 * a pas fait trébucher `read`, `wc -l` et certains éditeurs.
 *
 * @param {string[]} lignes
 */
export function assemblerSh(lignes) {
  const corps = lignes
    .flat()
    .filter((l) => l !== null && l !== undefined)
    .join('\n')
    .replace(/\r\n?/g, '\n')      // au cas où un fragment aurait glissé en CRLF
    .replace(/\n+$/, '');
  return assertShConforme(`${corps}\n`);
}

/**
 * Normalise un script Bash avant affichage et avant téléchargement.
 *
 * C'est le pendant de `normalizeScript()` côté PowerShell, et il fait
 * délibérément AUTRE CHOSE. `normalizeScript()` remplace « antislash + saut de
 * ligne » par « backtick + saut de ligne », parce que la continuation de ligne
 * de PowerShell est le backtick. En Bash, la continuation de ligne EST
 * l'antislash : appliquer la même transformation à un script Bash y
 * remplacerait les continuations valides par des backticks, c'est-à-dire par
 * une substitution de commande. Ce serait une injection introduite par
 * l'outil lui-même.
 *
 * D'où deux normaliseurs distincts, et un aiguillage par outil. Ce qui est
 * fait ici : CRLF et CR isolés ramenés à LF, un seul saut de ligne final, et
 * refus d'un BOM.
 */
export function normalizeScriptSh(texte) {
  const t = String(texte ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '');
  return `${t}\n`;
}

/**
 * En-tête commun à tout script Bash du lot.
 *
 * Ce que chaque ligne apporte, parce qu'un en-tête recopié sans être compris
 * est un en-tête qu'on finira par supprimer « pour simplifier » :
 *
 *   set -E  : les ERR traps sont héritées par les fonctions et sous-shells,
 *             sinon un `trap ... ERR` ne couvre pas la moitié du script.
 *   set -e  : le script s'arrête à la première commande en échec.
 *   set -u  : une variable non définie est une erreur, et non la chaîne vide.
 *             C'est la garde qui évite le fameux « rm -rf $DOSSIER/ » devenant
 *             « rm -rf / » parce que la variable était vide.
 *   set -o pipefail : un pipeline échoue si N'IMPORTE QUEL maillon échoue, et
 *             pas seulement le dernier. Sans cela, « cmd-qui-echoue | tee x »
 *             réussit.
 *   IFS      : réduit au saut de ligne et à la tabulation. Avec l'IFS par
 *             défaut, l'espace sépare aussi les mots, et un fichier nommé
 *             « mon rapport.txt » devient deux arguments.
 *   LC_ALL=C : la sortie des commandes système devient déterministe et
 *             analysable. On ne le met QUE là où l'on analyse, jamais autour
 *             de ce que l'utilisateur lit.
 *
 * `set -e` a des limites connues et il faut les dire : il ne déclenche pas sur
 * une commande dans un `if`, dans un `&&`, ni sur la partie gauche d'un `||`.
 * Les scripts du lot ne s'appuient donc jamais sur `set -e` seul pour une
 * décision de sécurité : les gardes testent explicitement.
 *
 * @param {object} o
 * @param {string}  o.titre        une ligne : ce que fait le script
 * @param {string}  o.outil        identifiant de l'outil
 * @param {boolean} o.diagnostic   true si le script n'écrit rien
 * @param {boolean} o.root         true si une action exige les privilèges
 * @param {string}  o.version
 */
export function enteteBash({
  titre, outil, diagnostic = true, root = false, version = VERSION_LINUX,
  // Un outil qui ne produit PAS de rapport ne doit pas declarer les variables
  // du rapport : ShellCheck signale a juste titre une variable assignee et
  // jamais lue, et il a raison — une variable morte est une intention
  // abandonnee que le lecteur suivant croira utile.
  avecRapport = true,
} = {}) {
  return [
    SHEBANG_BASH,
    '#',
    `# ${titre}`,
    `# Outil KJEMO : ${outil} - ${version}`,
    '#',
    diagnostic
      ? '# Ce script LIT et RAPPORTE. Il ne modifie rien.'
      : '# Ce script peut MODIFIER la configuration : lis-le en entier avant de le lancer.',
    root
      ? '# Des privileges root sont necessaires pour la partie modifiante.'
      : '# Aucun privilege particulier n est necessaire : tout est en lecture.',
    '#',
    '# Relis le script avant execution. Rien ici ne telecharge de code, ne',
    '# contacte un serveur tiers, ni ne manipule d identifiants.',
    '#',
    '# Execution :',
    '#   chmod +x ' + outil + '.sh && ./' + outil + '.sh',
    '# ou, sans changer les permissions :',
    '#   bash ' + outil + '.sh',
    '',
    '# -E : les traps ERR sont heritees. -e : arret au premier echec.',
    '# -u : une variable non definie est une erreur, pas une chaine vide.',
    '# -o pipefail : un pipeline echoue si un maillon echoue, pas seulement le dernier.',
    'set -Eeuo pipefail',
    '',
    '# IFS reduit au saut de ligne et a la tabulation : avec l IFS par defaut,',
    '# un nom de fichier contenant un espace serait decoupe en deux arguments.',
    "IFS=$'\\n\\t'",
    '',
    ...(avecRapport ? [
      `KJEMO_OUTIL=${shQuote(outil)}`,
      `KJEMO_VERSION=${shQuote(version)}`,
      'KJEMO_DEBUT="$(date --iso-8601=seconds 2>/dev/null || date)"',
      '',
    ] : []),
    '# Dossier de travail temporaire, cree par mktemp et detruit par la trap.',
    '# mktemp -d choisit un nom imprevisible et refuse d ecraser un existant :',
    '# un chemin fixe dans /tmp serait une faille (lien symbolique pose par un',
    '# autre utilisateur) et une collision entre deux executions.',
    'KJEMO_TMP="$(mktemp -d -t kjemo-' + outil + '-XXXXXXXX)"',
    '',
    '# Le nettoyage s execute a la sortie, quelle qu elle soit : fin normale,',
    '# erreur attrapee par set -e, Ctrl-C ou signal de terminaison. Sans EXIT',
    '# dans la liste, une sortie normale laisserait le dossier derriere elle.',
    '# shellcheck disable=SC2317',
    '# ShellCheck signale ce corps comme inatteignable. Il ne l est pas : la',
    '# fonction est appelee par la trap posee juste apres, et ShellCheck dit',
    '# lui-meme ne pas voir les invocations INDIRECTES. Le cas se manifeste',
    '# surtout quand toutes les branches du script finissent par exit, ce qui est',
    '# precisement le cas d un script bien ecrit.',
    '#',
    '# La directive est posee ICI, sur ce bloc seul, et non en exclusion globale :',
    '# un vrai bout de code mort ailleurs doit continuer d etre signale.',
    'kjemo_menage() {',
    '  local code=$?',
    '  if [ -n "${KJEMO_TMP:-}" ] && [ -d "${KJEMO_TMP}" ]; then',
    '    rm -rf -- "${KJEMO_TMP}"',
    '  fi',
    '  return "${code}"',
    '}',
    'trap kjemo_menage EXIT HUP INT TERM',
    '',
  ];
}

/**
 * Collecte des résultats, en Bash.
 *
 * Même forme d'enregistrement que du côté PowerShell — catégorie, contrôle,
 * état, valeur, commentaire — pour qu'un même rapport puisse sortir en
 * console, en JSON et en CSV sans retraitement, et pour que quelqu'un qui a
 * lu un script Windows du dépôt reconnaisse la structure.
 *
 * États : OK, ATTENTION, PROBLEME, INFO, IGNORE.
 *
 * Les enregistrements sont accumulés dans des fichiers du dossier temporaire
 * plutôt que dans des tableaux Bash. Raison : un contrôle exécuté dans un
 * sous-shell — ce qui arrive dès qu'on écrit `truc | while read`— perdrait
 * toute variable modifiée, et le rapport sortirait vide sans qu'aucune erreur
 * ne soit levée. Un fichier survit au sous-shell.
 */
export function fonctionsRapportBash() {
  return [
    '# ---------------------------------------------------------------------------',
    '# Collecte des resultats',
    '#',
    '# Les enregistrements vont dans des FICHIERS du dossier temporaire, pas',
    '# dans des tableaux Bash : un controle execute dans un sous-shell (tout',
    '# "cmd | while read" en cree un) perdrait les variables modifiees, et le',
    '# rapport sortirait vide sans la moindre erreur. Un fichier survit.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_RESULTATS="${KJEMO_TMP}/resultats.tsv"',
    'KJEMO_AVERTISSEMENTS="${KJEMO_TMP}/avertissements.txt"',
    ': > "${KJEMO_RESULTATS}"',
    ': > "${KJEMO_AVERTISSEMENTS}"',
    '',
    '# Reduit une valeur a une seule ligne analysable : les tabulations et les',
    '# retours a la ligne casseraient le format TSV.',
    'kjemo_aplatir() {',
    '  printf \'%s\' "${1:-}" | tr \'\\t\\n\' \'  \' | sed -e \'s/  */ /g\' -e \'s/^ //\' -e \'s/ $//\'',
    '}',
    '',
    'kjemo_resultat() {',
    '  local categorie="${1:-}" controle="${2:-}" etat="${3:-INFO}" valeur="${4:-}" commentaire="${5:-}"',
    '  case "${etat}" in',
    '    OK|ATTENTION|PROBLEME|INFO|IGNORE) : ;;',
    '    *) etat=\'INFO\' ;;',
    '  esac',
    '  printf \'%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n\' \\',
    '    "$(kjemo_aplatir "${categorie}")" \\',
    '    "$(kjemo_aplatir "${controle}")" \\',
    '    "${etat}" \\',
    '    "$(kjemo_aplatir "${valeur}")" \\',
    '    "$(kjemo_aplatir "${commentaire}")" \\',
    '    "$(date --iso-8601=seconds 2>/dev/null || date)" >> "${KJEMO_RESULTATS}"',
    '  if [ "${etat}" = \'ATTENTION\' ] || [ "${etat}" = \'PROBLEME\' ]; then',
    '    printf \'[%s] %s / %s : %s\\n\' "${etat}" "${categorie}" "${controle}" "${commentaire}" \\',
    '      >> "${KJEMO_AVERTISSEMENTS}"',
    '  fi',
    '}',
    '',
    '# Une commande absente doit APPARAITRE dans le rapport, pas interrompre le',
    '# diagnostic : c est une information utile ("nftables n est pas installe")',
    '# et non un echec du script.',
    'kjemo_dispo() {',
    '  command -v "${1:-}" >/dev/null 2>&1',
    '}',
    '',
    '# Execute un controle en lecture et consigne son resultat. Le || true est',
    '# delibere : sous set -e, un controle qui echoue arreterait tout le',
    '# diagnostic alors que son echec est precisement ce qu on veut rapporter.',
    'kjemo_controle() {',
    '  local categorie="${1:-}" controle="${2:-}" commentaire="${3:-}"',
    '  shift 3',
    '  local sortie=\'\' code=0',
    '  sortie="$("$@" 2>&1)" || code=$?',
    '  if [ "${code}" -ne 0 ]; then',
    '    kjemo_resultat "${categorie}" "${controle}" \'ATTENTION\' "${sortie}" \\',
    '      \'Controle non executable sur cette machine.\'',
    '    return 0',
    '  fi',
    '  if [ -z "${sortie}" ]; then',
    '    kjemo_resultat "${categorie}" "${controle}" \'INFO\' \'(aucun resultat)\' "${commentaire}"',
    '    return 0',
    '  fi',
    '  kjemo_resultat "${categorie}" "${controle}" \'OK\' "${sortie}" "${commentaire}"',
    '}',
    '',
  ];
}

/**
 * Paramètres du diagnostic, repris dans le rapport.
 *
 * Seules des valeurs NON SENSIBLES y entrent : noms d'hôte, chemins, options.
 * Aucun mot de passe, aucun jeton, aucune clé — ni ici, ni ailleurs : les
 * formulaires du lot n'ont pas de champ de mot de passe, par construction.
 *
 * Comme du côté Windows, ce bloc ne crée QUE l'objet de rapport. Il n'assigne
 * aucune variable utilisable par le script : c'est blocVariablesBash() qui
 * s'en charge, à partir des mêmes paires. Confondre les deux avait coûté un
 * correctif complet au LOT 6B, où des scripts citaient des variables que
 * personne n'avait définies.
 *
 * @param {Array<[string, string]>} paires  [cléRapport, expressionBash]
 */
export function blocParametresBash(paires) {
  const lignes = [
    '# Parametres du diagnostic, repris dans le rapport.',
    '# Aucune donnee sensible : ni mot de passe, ni jeton, ni cle privee.',
    '#',
    '# Les ecritures sont groupees dans un seul bloc { } redirige une fois,',
    '# plutot qu une redirection par ligne : le fichier est ouvert et ferme une',
    '# seule fois au lieu de N, et le bloc se lit comme ce qu il est : un',
    '# enregistrement, pas une suite de commandes independantes.',
    'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
    '{',
    ...paires.map(([cle, expr]) => `  printf '%s\\t%s\\n' ${shQuote(cle)} "${expr}"`),
    '} > "${KJEMO_PARAMETRES}"',
    '',
  ];
  return lignes;
}

/**
 * Les variables réellement utilisables par le script, dérivées des mêmes
 * paires que blocParametresBash().
 *
 * @param {Array<[string, string]>} paires  [nomVariable, expressionBash]
 */
export function blocVariablesBash(paires) {
  const lignes = ['# Valeurs saisies, citees une fois pour toutes.'];
  for (const [nom, expr] of paires) {
    lignes.push(`${nom}=${expr}`);
  }
  lignes.push('');
  return lignes;
}

/**
 * Rapport final : console toujours, plus JSON ou CSV si demandé.
 *
 * Le fichier va dans le dossier personnel de l'utilisateur, jamais dans /tmp
 * (effacé au redémarrage) ni sur un partage réseau (qui peut être absent, et
 * dont on ne connaît pas les droits).
 */
export function blocRapportBash({ prefixeFichier, formatVar = 'KJEMO_FORMAT' }) {
  return [
    '',
    '# ---------------------------------------------------------------------------',
    '# Rapport',
    '# Le rapport ne contient aucun mot de passe, jeton ni cle privee.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_FIN="$(date --iso-8601=seconds 2>/dev/null || date)"',
    'KJEMO_NB_AVERT=0',
    'if [ -s "${KJEMO_AVERTISSEMENTS}" ]; then',
    '  KJEMO_NB_AVERT="$(wc -l < "${KJEMO_AVERTISSEMENTS}" | tr -d \' \')"',
    'fi',
    'KJEMO_CONCLUSION=\'Aucun probleme detecte par les controles executes.\'',
    'if [ "${KJEMO_NB_AVERT}" -gt 0 ]; then',
    '  KJEMO_CONCLUSION="${KJEMO_NB_AVERT} point(s) a examiner : voir la section Avertissements."',
    'fi',
    '',
    'printf \'\\n=== %s - %s ===\\n\' "${KJEMO_OUTIL}" "$(hostname 2>/dev/null || echo machine)"',
    '# Seuls les etats qui demandent une action sont affiches : un rapport ou',
    '# tout defile noie le seul point qui compte. La VALEUR brute n est pas',
    '# imprimee en console (elle peut faire des pages) : elle reste dans le',
    '# rapport JSON ou CSV. Le champ est donc lu dans _, et c est voulu.',
    'while IFS=$\'\\t\' read -r cat ctl etat _ com _; do',
    '  case "${etat}" in',
    '    ATTENTION|PROBLEME|IGNORE) printf \'[%s] %s / %s : %s\\n\' "${etat}" "${cat}" "${ctl}" "${com}" ;;',
    '  esac',
    'done < "${KJEMO_RESULTATS}"',
    '',
    'if [ "${KJEMO_NB_AVERT}" -gt 0 ]; then',
    '  printf \'\\n--- Avertissements ---\\n\'',
    '  cat "${KJEMO_AVERTISSEMENTS}"',
    'fi',
    'printf \'\\nConclusion : %s\\n\' "${KJEMO_CONCLUSION}"',
    '',
    `if [ "\${${formatVar}:-Console}" != 'Console' ]; then`,
    '  KJEMO_DEST="${HOME}"',
    '  if [ -d "${HOME}/Bureau" ]; then KJEMO_DEST="${HOME}/Bureau"',
    '  elif [ -d "${HOME}/Desktop" ]; then KJEMO_DEST="${HOME}/Desktop"',
    '  fi',
    `  KJEMO_BASE="\${KJEMO_DEST}/${prefixeFichier}-$(hostname 2>/dev/null || echo machine)-$(date +%Y%m%d-%H%M%S)"`,
    '',
    `  if [ "\${${formatVar}}" = 'CSV' ]; then`,
    '    # Le CSV est produit par un filtre qui cite correctement : voir',
    '    # kjemo_csv_champ, qui double les guillemets internes.',
    '    {',
    '      printf \'Categorie,Controle,Etat,Valeur,Commentaire,Horodatage\\n\'',
    '      while IFS=$\'\\t\' read -r c1 c2 c3 c4 c5 c6; do',
    '        printf \'%s,%s,%s,%s,%s,%s\\n\' \\',
    '          "$(kjemo_csv_champ "${c1}")" "$(kjemo_csv_champ "${c2}")" \\',
    '          "$(kjemo_csv_champ "${c3}")" "$(kjemo_csv_champ "${c4}")" \\',
    '          "$(kjemo_csv_champ "${c5}")" "$(kjemo_csv_champ "${c6}")"',
    '      done < "${KJEMO_RESULTATS}"',
    '    } > "${KJEMO_BASE}.csv"',
    '    printf \'Rapport CSV : %s.csv\\n\' "${KJEMO_BASE}"',
    `  elif [ "\${${formatVar}}" = 'JSON' ]; then`,
    '    {',
    '      printf \'{\\n\'',
    '      printf \'  "outil": %s,\\n\'   "$(kjemo_json_chaine "${KJEMO_OUTIL}")"',
    '      printf \'  "version": %s,\\n\' "$(kjemo_json_chaine "${KJEMO_VERSION}")"',
    '      printf \'  "machine": %s,\\n\' "$(kjemo_json_chaine "$(hostname 2>/dev/null || echo machine)")"',
    '      printf \'  "debut": %s,\\n\'   "$(kjemo_json_chaine "${KJEMO_DEBUT}")"',
    '      printf \'  "fin": %s,\\n\'     "$(kjemo_json_chaine "${KJEMO_FIN}")"',
    '      printf \'  "controles": [\\n\'',
    '      kjemo_premier=1',
    '      while IFS=$\'\\t\' read -r c1 c2 c3 c4 c5 c6; do',
    '        if [ "${kjemo_premier}" -eq 0 ]; then printf \',\\n\'; fi',
    '        kjemo_premier=0',
    '        printf \'    {"categorie": %s, "controle": %s, "etat": %s, "valeur": %s, "commentaire": %s, "horodatage": %s}\' \\',
    '          "$(kjemo_json_chaine "${c1}")" "$(kjemo_json_chaine "${c2}")" \\',
    '          "$(kjemo_json_chaine "${c3}")" "$(kjemo_json_chaine "${c4}")" \\',
    '          "$(kjemo_json_chaine "${c5}")" "$(kjemo_json_chaine "${c6}")"',
    '      done < "${KJEMO_RESULTATS}"',
    '      printf \'\\n  ],\\n\'',
    '      printf \'  "conclusion": %s\\n\' "$(kjemo_json_chaine "${KJEMO_CONCLUSION}")"',
    '      printf \'}\\n\'',
    '    } > "${KJEMO_BASE}.json"',
    '    printf \'Rapport JSON : %s.json\\n\' "${KJEMO_BASE}"',
    '  fi',
    'fi',
  ];
}

/**
 * Deux filtres d'échappement, placés avant toute écriture de rapport.
 *
 * Le CSV et le JSON faits « à la main » sont une source classique de fichiers
 * cassés : un nom de service contenant une virgule décale toutes les colonnes,
 * un chemin Windows contenant un antislash casse le JSON. Ces deux fonctions
 * existent pour que ça n'arrive pas, et la contre-épreuve du banc leur donne
 * exprès des valeurs piégées.
 */
export function fonctionsEchappementBash() {
  return [
    '# Un champ CSV est entoure de guillemets doubles, et chaque guillemet',
    '# interne est double. Sans cela, une virgule dans une valeur decale toutes',
    '# les colonnes suivantes.',
    'kjemo_csv_champ() {',
    '  printf \'"%s"\' "$(printf \'%s\' "${1:-}" | sed \'s/"/""/g\')"',
    '}',
    '',
    '# Une chaine JSON : antislash d abord (sinon on echapperait les antislash',
    '# qu on vient d ajouter), puis guillemet, puis tabulation et retour chariot.',
    'kjemo_json_chaine() {',
    '  printf \'"%s"\' "$(printf \'%s\' "${1:-}" \\',
    '    | sed -e \'s/\\\\/\\\\\\\\/g\' -e \'s/"/\\\\"/g\' -e \'s/\\t/\\\\t/g\' -e \'s/\\r/\\\\r/g\')"',
    '}',
    '',
  ];
}

/**
 * Garde de privilèges.
 *
 * Deux cas, et la différence compte :
 *
 *   - `exige = false` (outil en lecture seule) : le script ne réclame RIEN. Il
 *     signale seulement ce qu'il ne pourra pas lire sans privilèges, et
 *     continue. Réclamer root pour lire est la meilleure façon d'habituer
 *     quelqu'un à taper sudo sans réfléchir.
 *   - `exige = true` (outil modifiant) : le script s'arrête si l'UID effectif
 *     n'est pas 0, AVANT toute écriture.
 *
 * `id -u` plutôt que `$EUID` : `$EUID` n'existe pas dans un sh POSIX, et un
 * script qu'on finit par lancer avec `sh script.sh` doit échouer clairement.
 */
export function blocPrivilegesBash({ exige = false, pourquoi = '' } = {}) {
  if (!exige) {
    return [
      '# Cet outil LIT. Il ne reclame pas root : certaines informations seront',
      '# simplement marquees inaccessibles si la session n a pas les droits.',
      'KJEMO_ROOT=0',
      'if [ "$(id -u)" = \'0\' ]; then KJEMO_ROOT=1; fi',
      'if [ "${KJEMO_ROOT}" -eq 0 ]; then',
      '  kjemo_resultat \'Privileges\' \'Session\' \'INFO\' \'utilisateur standard\' \\',
      '    \'Lecture seule : les elements reserves a root seront marques inaccessibles.\'',
      'fi',
      '',
    ];
  }
  return [
    '# Cet outil MODIFIE. Sans privileges, il s arrete ICI, avant toute ecriture.',
    `# Raison : ${pourquoi || 'l action demande des droits administrateur.'}`,
    'if [ "$(id -u)" != \'0\' ]; then',
    '  printf \'ARRET : cette action demande les privileges root.\\n\' >&2',
    `  printf 'Raison : %s\\n' ${shQuote(pourquoi || 'ecriture dans une zone protegee du systeme.')} >&2`,
    '  printf \'Relance avec : sudo ./%s.sh\\n\' "${KJEMO_OUTIL}" >&2',
    '  printf \'\\n\' >&2',
    '  printf \'Ne desactive jamais sudo ni une protection du systeme pour faire\\n\' >&2',
    '  printf \'passer un script. Si tu n as pas ces droits, demande-les.\\n\' >&2',
    '  exit 1',
    'fi',
    // Pas de « KJEMO_ROOT=1 » ici. La branche exige:true vient de SORTIR si
    // l on n est pas root : arriver apres ce « fi » est la preuve, et un
    // drapeau qui redit une garantie deja acquise n est lu par personne.
    // ShellCheck l a signale (SC2034) le jour ou le premier assistant a
    // reellement demande root — linux-disk-partition-mount, au commit 13/n.
    // Un assistant qui aurait besoin de brancher sur l identite le lira
    // lui-meme avec id -u, comme le font les assistants en lecture seule.
    '',
  ];
}

/**
 * EXECUTION_NOTES_BASH — bloc commun à toutes les fiches Linux.
 *
 * Le pendant d'EXECUTION_NOTES, et il ne lui ressemble pas, parce que les
 * obstacles ne sont pas les mêmes. Windows bloque un script non signé venant
 * d'Internet : toute la section PowerShell parle de stratégie d'exécution et
 * d'Unblock-File. Linux ne connaît rien de tout cela. Ce qui bloque sous
 * Linux, c'est le bit d'exécution, le montage `noexec`, les fins de ligne
 * CRLF et les privilèges.
 *
 * Afficher la table des stratégies PowerShell sur une fiche Bash ne serait pas
 * seulement inutile : ce serait une fausse piste, et quelqu'un la suivrait.
 *
 * Sources officielles :
 *   GNU Bash Reference Manual   https://www.gnu.org/software/bash/manual/bash.html
 *   chmod(1)                    https://manpages.ubuntu.com/manpages/noble/en/man1/chmod.1.html
 *   sudo(8)                     https://manpages.ubuntu.com/manpages/noble/en/man8/sudo.8.html
 *   mount(8) — noexec           https://manpages.ubuntu.com/manpages/noble/en/man8/mount.8.html
 */
export const EXECUTION_NOTES_BASH = {
  title: 'Avant d’exécuter le script',
  intro:
    'Le fichier téléchargé est un script texte. Sous Linux, rien ne le « débloque » : '
    + 'il suffit qu’il soit lisible et lancé par bash. Les seuls obstacles habituels '
    + 'sont le bit d’exécution, un dossier monté en noexec, des fins de ligne Windows, '
    + 'et les privilèges.',

  steps: [
    {
      label: 'Relire le script',
      detail:
        'L’aperçu affiché ici est exactement le contenu du fichier téléchargé. '
        + 'Ouvre-le avec « less » ou un éditeur avant de le lancer. '
        + 'N’exécute jamais un script que tu n’as pas lu — surtout avec sudo.',
      command: 'less nom-du-script.sh',
    },
    {
      label: 'Vérifier que le fichier est intact',
      detail:
        'La première ligne doit être exactement « #!/usr/bin/env bash », et le fichier '
        + 'ne doit contenir ni BOM ni retour chariot. Cette commande montre les trois '
        + 'premiers octets : « 23 21 2f » est correct. Si tu vois « ef bb bf », le '
        + 'fichier a un BOM et le shebang ne sera pas reconnu.',
      command: 'head -c 3 nom-du-script.sh | od -An -tx1',
    },
    {
      label: 'Contrôler la syntaxe sans rien exécuter',
      detail:
        'bash -n analyse le script et sort sans en exécuter une seule ligne. '
        + 'C’est gratuit, et cela attrape un fichier tronqué par un téléchargement '
        + 'incomplet.',
      command: 'bash -n nom-du-script.sh',
    },
    {
      label: 'Rendre exécutable, puis lancer',
      detail:
        'La forme habituelle. Si le dossier est monté en noexec — c’est le cas de /tmp '
        + 'sur beaucoup de serveurs — le bit d’exécution ne suffira pas, et la commande '
        + 'suivante reste la solution.',
      command: 'chmod +x nom-du-script.sh\n./nom-du-script.sh',
    },
    {
      label: 'Lancer sans changer les permissions',
      detail:
        'Ici c’est bash qui est exécuté, et le script n’est qu’un fichier qu’il lit. '
        + 'Fonctionne même en noexec, et même sans bit d’exécution.',
      command: 'bash nom-du-script.sh',
    },
    {
      label: 'Ajouter sudo seulement si la fiche le demande',
      detail:
        'Les outils marqués « Lecture seule » n’en ont pas besoin, et il ne faut pas '
        + 'prendre l’habitude d’en mettre partout. Les outils qui modifient le système '
        + 's’arrêtent d’eux-mêmes, avant toute écriture, si les privilèges manquent.',
      command: 'sudo bash nom-du-script.sh',
    },
  ],

  /**
   * Les obstacles, et le message exact qu'ils produisent. Un tableau de
   * symptômes vaut mieux qu'un paragraphe : on arrive ici avec un message
   * d'erreur sous les yeux, pas avec une question théorique.
   */
  obstacles: [
    {
      name: 'Bit d’exécution absent',
      message: 'bash: ./script.sh: Permission denied',
      fix: 'chmod +x script.sh — ou lancer « bash script.sh ».',
    },
    {
      name: 'Dossier monté en noexec',
      message: 'bash: ./script.sh: Permission denied (alors que chmod +x a réussi)',
      fix: 'Lancer « bash script.sh », ou déplacer le fichier hors de /tmp.',
    },
    {
      name: 'Fins de ligne CRLF',
      message: 'bad interpreter: /usr/bin/env bash^M: no such file or directory',
      fix: 'Convertir avec « sed -i \'s/\\r$//\' script.sh ». Les téléchargements de '
        + 'ce site sont déjà en LF : ce cas vient d’un passage par un éditeur Windows.',
    },
    {
      name: 'BOM UTF-8 en tête de fichier',
      message: 'bad interpreter: no such file or directory, ou exécution sous un autre shell',
      fix: 'Le BOM précède « #! » et masque le shebang. Les téléchargements de ce site '
        + 'n’en ont jamais : ce cas vient d’un enregistrement par un éditeur Windows.',
    },
    {
      name: 'Privilèges insuffisants',
      message: 'ARRET : cette action demande les privileges root.',
      fix: 'Relancer avec sudo. Le script s’est arrêté AVANT d’écrire quoi que ce soit.',
    },
    {
      name: 'sh au lieu de bash',
      message: 'Syntax error: "(" unexpected, ou « Bad substitution »',
      fix: 'Ces scripts utilisent des constructions propres à bash. Lancer avec bash, '
        + 'pas avec sh ni dash.',
    },
  ],

  warning:
    'N’exécute jamais un script avec sudo sans l’avoir lu. sudo donne les pleins '
    + 'pouvoirs sur la machine, et aucune confirmation ne rattrape une commande '
    + 'destructrice déjà lancée. Et ne désactive jamais une protection du système — '
    + 'SELinux, AppArmor, le pare-feu — pour faire passer un script : si un script '
    + 'a besoin de cela, c’est le script qu’il faut corriger.',

  errors: [
    {
      message: 'bash: ./script.sh: Permission denied',
      code: 'EACCES',
      cause: 'Le bit d’exécution n’est pas posé, ou le dossier est monté en noexec.',
      fix: 'chmod +x sur le fichier, ou lancer « bash script.sh » qui ne demande aucun '
        + 'bit d’exécution.',
      command: 'bash script.sh',
    },
    {
      message: 'bad interpreter: /usr/bin/env bash^M: no such file or directory',
      code: 'ENOENT',
      cause: 'Le fichier a des fins de ligne CRLF. Le « ^M » fait partie du nom '
        + 'd’interpréteur recherché, qui n’existe pas.',
      fix: 'Convertir en LF. Les fichiers téléchargés depuis ce site sont en LF ; '
        + 'un passage par un éditeur Windows a pu les modifier.',
      command: "sed -i 's/\\r$//' script.sh",
    },
    {
      message: 'ARRET : cette action demande les privileges root.',
      code: 'KJEMO',
      cause: 'Un outil modifiant a été lancé sans privilèges. C’est sa garde qui '
        + 'parle, et elle s’est déclenchée avant toute écriture.',
      fix: 'Relancer avec sudo, après avoir relu le script.',
      command: 'sudo bash script.sh',
    },
    {
      message: 'command not found',
      code: 'ENOENT',
      cause: 'Un paquet nécessaire n’est pas installé. La fiche liste les paquets '
        + 'dans « Paquets nécessaires ».',
      fix: 'Installer le paquet indiqué par la fiche. Les scripts de diagnostic '
        + 'signalent l’outil manquant dans le rapport au lieu de s’arrêter.',
    },
  ],

  sources: [
    { label: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/bash.html' },
    { label: 'chmod(1)', url: 'https://manpages.ubuntu.com/manpages/noble/en/man1/chmod.1.html' },
    { label: 'sudo(8)', url: 'https://manpages.ubuntu.com/manpages/noble/en/man8/sudo.8.html' },
  ],
};
