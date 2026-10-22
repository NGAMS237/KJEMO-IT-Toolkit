/**
 * outils-impression-cups.mjs — LOT 9 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Parcours D — LINUX / CUPS, quatre assistants Bash.
 *
 *   imp-cups-inventaire       destinations, état, URI de périphérique, genre
 *                             (USB, réseau, file d'un autre serveur…), travaux.
 *   imp-cups-diagnostic-file  UNE destination : état, acceptation, raisons,
 *                             travaux, URI, joignabilité réseau, journal.
 *   imp-cups-annuler-travail  UN travail identifié, relu avant et après.
 *   imp-cups-reactiver-file   cupsenable OU cupsaccept sur UNE destination.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CES ASSISTANTS NE FONT JAMAIS
 * ---------------------------------------------------------------------------
 * Aucun n'appelle cupsctl, lpadmin ni « cancel -a », ne touche à cupsd.conf, ne
 * vide /var/spool/cups, n'ouvre l'administration de CUPS au réseau et ne change
 * les règles d'accès. Un banc le vérifie sur le texte de chaque script.
 *
 * Différences avec Windows, dites dans les fiches : pas de « spouleur » à
 * redémarrer ici (cupsd est un service systemd que ces assistants ne touchent
 * pas), pas de ports TCP/IP à créer (l'URI du périphérique tient lieu de port),
 * pas de pilote à installer (CUPS 2 est « driverless » pour IPP Everywhere).
 *
 * Comme les assistants Linux précédents : Bash, ASCII dans les fragments
 * écrits ici, valeurs saisies transportées par shQuote, relecture après action.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import { blocConfirmation, blocPorteFinale } from './gardes-bash.mjs';
import { assertValid } from './noyau.mjs';
import { SOUS_RUBRIQUES_IMPRESSION } from './categories.mjs';
import {
  validerDestinationCups, validerIdTravailCups, validerUtilisateurLinuxFacultatif,
  validerChoix, secretsDansImpression,
} from './validateurs-impression.mjs';
import { VALIDATION_IMPRESSION_CUPS, VERSION_IMPRESSION } from './noyau-impression.mjs';

const CAT = 'Imprimantes';
const FAMILLE = 'Linux et CUPS';
const OC = 'https://openprinting.github.io/cups/doc';

/** Gabarit : le texte Bash s'écrit tel quel, « \${x} » donne « ${x} » sans interpolation JS. */
function B(strings) {
  return strings.raw.join('')
    .replaceAll('\\${', '${')
    .replaceAll('\\\\', '\\')
    .replace(/^\n/, '').replace(/\n$/, '').split('\n');
}

const OS_CUPS = [
  'Ubuntu Server et Desktop 22.04 LTS et 24.04 LTS',
  'Debian 12 (bookworm)',
  'Toute distribution utilisant CUPS 2.x (paquets cups et cups-client)',
];
const DISTROS = ['Ubuntu 24.04 LTS (cible de référence)', 'Ubuntu 22.04 LTS', 'Debian 12'];

const SRC_CUPS = {
  lpstat: { label: 'lpstat(1) — CUPS', url: 'https://openprinting.github.io/cups/doc/man-lpstat.html' },
  cancel: { label: 'cancel(1) — CUPS', url: 'https://openprinting.github.io/cups/doc/man-cancel.html' },
  cupsenable: { label: 'cupsenable(8) — CUPS', url: 'https://openprinting.github.io/cups/doc/man-cupsenable.html' },
  cupsaccept: { label: 'cupsaccept(8) — CUPS', url: 'https://openprinting.github.io/cups/doc/man-cupsaccept.html' },
  uri: { label: 'Utilisation des files d’impression — CUPS', url: 'https://openprinting.github.io/cups/doc/options.html' },
};

const CHAMP_FORMAT = {
  id: 'impFormat', label: 'Format du rapport', type: 'select', default: 'Console',
  options: [['Console', 'Console seulement'], ['JSON', 'Console + fichier JSON'], ['CSV', 'Console + fichier CSV']],
  help: 'Le fichier est écrit dans ton dossier personnel (Bureau s’il existe). Il contient des noms de files et d’hôtes : supprime-le quand il ne sert plus.',
};

function champDest(aide, defaut = 'HP_LaserJet_Accueil') {
  return {
    id: 'impDest', label: 'Destination CUPS (nom exact)', type: 'text', default: defaut, placeholder: defaut,
    help: aide || 'Le nom tel que « lpstat -e » ou « lpstat -p » l’affiche. Sans espace, sans joker.',
  };
}

function verifierFormat(v, errors) {
  const r = validerChoix(v.impFormat, ['Console', 'JSON', 'CSV'], 'Le format');
  if (!r.ok) errors.impFormat = r.error;
}

// ---------------------------------------------------------------------------
// Fonctions Bash communes
// ---------------------------------------------------------------------------

/**
 * Constats lisibles en console. Le rapport commun n'affiche que les alertes
 * (ATTENTION, PROBLEME) et garde les valeurs pour les fichiers JSON/CSV : pour
 * un inventaire ou une action, ce serait un rapport muet - on ne verrait ni les
 * destinations, ni l'etat lu AVANT l'action, ni la relecture APRES. Les lignes
 * OK et INFO sont donc affichees ici, valeur comprise (courte, deja masquee),
 * suivie de leur commentaire : c'est lui qui porte la reserve ("cela ne prouve pas
 * qu'une page sortira").
 */
function blocConstatsCups() {
  return B`
# ---------------------------------------------------------------------------
# Constats (OK et INFO) : ce que le script a lu, avec ses valeurs.
# Les alertes sont affichees plus bas, dans le rapport commun.
# ---------------------------------------------------------------------------
printf '\\n--- Constats ---\\n'
while IFS=$'\\t' read -r kjemo_cat kjemo_ctl kjemo_etat kjemo_val kjemo_com _; do
  case "\${kjemo_etat}" in
    OK|INFO)
      printf '[%s] %s / %s : %s\\n' "\${kjemo_etat}" "\${kjemo_cat}" "\${kjemo_ctl}" "$(printf '%s' "\${kjemo_val}" | cut -c1-220)"
      if [ -n "\${kjemo_com}" ]; then printf '      -> %s\\n' "\${kjemo_com}"; fi ;;
  esac
done < "\${KJEMO_RESULTATS}"
`;
}

/** Aides communes : masquage d'URI, découpe hôte/port, test TCP, lecture exacte. */
function fonctionsCups() {
  return B`
# --- Aides communes CUPS (LOT 9) -------------------------------------------------------
# Masque les identifiants d une URI : schema://utilisateur:motdepasse@hote devient
# schema://[MASQUE]@hote. Une URI de peripherique peut en contenir ; le rapport jamais.
kjemo_masquer_uri() {
  printf '%s' "\${1:-}" | sed -E 's#([A-Za-z][A-Za-z0-9+.-]*://)[^/@[:space:]]*:[^/@[:space:]]*@#\\1[MASQUE]@#g'
}

# Rend "hote port" pour une URI reseau (ipp, ipps, http, https, socket, lpd), rien sinon.
kjemo_uri_hote_port() {
  local uri="\${1:-}" schema='' reste='' hote='' port=''
  case "\${uri}" in
    ipp:*|ipps:*|http:*|https:*|socket:*|lpd:*) : ;;
    *) return 1 ;;
  esac
  schema="\${uri%%://*}"
  reste="\${uri#*://}"
  reste="\${reste#*@}"
  reste="\${reste%%/*}"
  case "\${reste}" in
    '['*) return 1 ;;
  esac
  hote="\${reste%%:*}"
  case "\${reste}" in
    *:*) port="\${reste##*:}" ;;
    *)
      case "\${schema}" in
        ipp|ipps) port='631' ;;
        http) port='80' ;;
        https) port='443' ;;
        socket) port='9100' ;;
        lpd) port='515' ;;
      esac
      ;;
  esac
  case "\${hote}" in
    ''|*[!A-Za-z0-9.-]*) return 1 ;;
  esac
  case "\${port}" in
    ''|*[!0-9]*) return 1 ;;
  esac
  printf '%s %s' "\${hote}" "\${port}"
}

# Test TCP : OUVERT, FERME ou INDETERMINE. Les valeurs passent en arguments
# positionnels de bash -c, jamais dans le texte de la commande.
kjemo_tcp() {
  local hote="\${1:-}" port="\${2:-}"
  if ! kjemo_dispo timeout; then
    printf 'INDETERMINE'
    return 0
  fi
  local code=0
  # shellcheck disable=SC2016
  # Les apostrophes sont voulues : $0 et $1 doivent etre developpes par le bash
  # enfant, qui les recoit en arguments positionnels, et NON par ce shell.
  timeout 3 bash -c ': > /dev/tcp/"$0"/"$1"' "\${hote}" "\${port}" > /dev/null 2>&1 || code=$?
  if [ "\${code}" -eq 0 ]; then
    printf 'OUVERT'
  elif [ "\${code}" -eq 124 ]; then
    printf 'DELAI'
  else
    printf 'FERME'
  fi
}

# Resultats DNS puis TCP vers une URI reseau. Chaque etape est un resultat distinct.
kjemo_reseau_uri() {
  local uri="\${1:-}" hp='' hote='' port='' etat='' adr=''
  if ! hp="$(kjemo_uri_hote_port "\${uri}")"; then
    kjemo_resultat 'Reseau' 'Test reseau' 'IGNORE' 'URI non reseau' \\
      'Peripherique local (USB, fichier, pilote virtuel) ou URI sans hote lisible : aucun test reseau applicable.'
    return 0
  fi
  hote="\${hp%% *}"
  port="\${hp##* }"
  case "\${hote}" in
    localhost) kjemo_resultat 'Reseau' 'Hote' 'INFO' "\${hote}" 'Cette machine elle-meme : un autre service CUPS local.' ;;
  esac
  if kjemo_dispo getent; then
    adr="$(getent hosts "\${hote}" 2>/dev/null | awk 'NR==1{print $1}' || true)"
    if [ -n "\${adr}" ]; then
      kjemo_resultat 'Reseau' 'Resolution' 'OK' "\${hote} -> \${adr}" 'Le nom se resout. Verifie que l adresse est bien celle de l imprimante.'
    else
      kjemo_resultat 'Reseau' 'Resolution' 'PROBLEME' "\${hote}" 'Le nom ne se resout pas depuis cette machine.'
      return 0
    fi
  fi
  etat="$(kjemo_tcp "\${hote}" "\${port}")"
  case "\${etat}" in
    OUVERT) kjemo_resultat 'Reseau' "TCP \${port}" 'OK' 'port ouvert' 'Le port accepte la connexion. Cela ne prouve PAS qu une page sortira.' ;;
    FERME) kjemo_resultat 'Reseau' "TCP \${port}" 'PROBLEME' 'connexion refusee ou impossible (ferme)' 'Le port est ferme ou refuse : protocole desactive sur l imprimante, mauvaise adresse ou mauvais port.' ;;
    DELAI) kjemo_resultat 'Reseau' "TCP \${port}" 'PROBLEME' 'delai depasse, aucune reponse' 'Aucune reponse en 3 secondes : imprimante eteinte, mauvaise adresse, pare-feu ou autre reseau.' ;;
    *) kjemo_resultat 'Reseau' "TCP \${port}" 'ATTENTION' 'indetermine' 'La commande timeout est absente : le test TCP n a pas pu etre fait.' ;;
  esac
}

# Les destinations connues de CUPS, une par ligne. Rend un code non nul si CUPS ne repond pas.
kjemo_destinations() {
  lpstat -p 2>/dev/null | awk '/^printer /{print $2}'
}

# Vrai si le nom est EXACTEMENT celui d une destination (egalite, jamais un motif).
# Pas de "| grep -q" : sous pipefail, grep -q qui sort tot fait echouer le tube.
kjemo_dest_existe() {
  local cible="\${1:-}" liste=''
  liste="$(kjemo_destinations || true)"
  case $'\n'"\${liste}"$'\n' in
    *$'\n'"\${cible}"$'\n'*) return 0 ;;
  esac
  return 1
}

# Raisons declarees d une file, SANS le bruit de "lpstat -l -p". Pour une file arretee,
# CUPS ecrit la raison sur la ligne qui suit la premiere ; pour toutes, la ligne
# "Alerts:" porte les printer-state-reasons, ou "none". Les autres lignes
# (Form mounted, Content types, Interface...) sont de la configuration, pas des raisons.
kjemo_raisons() {
  lpstat -l -p "\${1:-}" 2>/dev/null | awk '
    NR == 1 { arretee = ($0 ~ / disabled /); next }
    NR == 2 && arretee { sub(/^[ \t]+/, ""); print "arret : " $0; next }
    /^[ \t]*Alerts:/ { v = $0; sub(/^[ \t]*Alerts:[ \t]*/, "", v); if (v != "" && v != "none") print "alertes : " v }
  '
}

# Classe une URI de peripherique. Heuristique : elle le dit.
kjemo_genre_uri() {
  local uri="\${1:-}"
  case "\${uri}" in
    usb:*|hp:/usb*|hpfax:*) printf 'imprimante USB locale' ;;
    socket://*) printf 'imprimante reseau directe (RAW, port 9100)' ;;
    lpd://*) printf 'imprimante reseau directe (LPD)' ;;
    ipp://localhost*|ipps://localhost*|ipp://127.*|ipps://127.*) printf 'file d un autre CUPS de cette machine' ;;
    ipp://*/printers/*|ipps://*/printers/*) printf 'file partagee par un autre serveur CUPS (heuristique : chemin /printers/)' ;;
    ipp:*|ipps:*|http:*|https:*) printf 'imprimante reseau directe (IPP)' ;;
    dnssd://*) printf 'imprimante decouverte par DNS-SD (driverless)' ;;
    file:*|cups-pdf:*|*pdf*) printf 'imprimante virtuelle (fichier ou PDF)' ;;
    *) printf 'type non reconnu' ;;
  esac
}
`;
}

// ---------------------------------------------------------------------------
// Éléments communs de fiche
// ---------------------------------------------------------------------------

const ERREURS_CUPS = [
  {
    message: 'lpstat: Unable to connect to server / scheduler is not running',
    code: 'KJEMO',
    cause: 'Le service CUPS (cupsd) ne tourne pas, ou ce poste pointe vers un autre serveur CUPS inaccessible (variable CUPS_SERVER).',
    fix: 'Regarde le service sans le toucher avec cet assistant : « systemctl status cups ». Redémarrer le service est une décision séparée, que ces assistants ne prennent pas.',
    command: 'systemctl status cups --no-pager; echo "${CUPS_SERVER:-aucun}"',
  },
  {
    message: 'lpstat: Unknown destination',
    code: 'KJEMO',
    cause: 'Le nom ne correspond à aucune destination (faute de frappe, casse, file d’un autre serveur non découverte).',
    fix: 'Copie le nom exact depuis « lpstat -p » ; les noms proches ne sont pas acceptés.',
    command: 'lpstat -p',
  },
  {
    message: 'cupsenable: Operation not permitted / Forbidden',
    code: 'KJEMO',
    cause: 'Réactiver une file demande root ou l’appartenance au groupe d’administration CUPS (lpadmin).',
    fix: 'Lance le script avec les droits nécessaires (sudo) ; ne change pas les règles d’accès de CUPS pour contourner le refus.',
    command: 'id; sudo -l',
  },
];

const PREREQS_CUPS = [
  'Les commandes CUPS du paquet cups-client (lpstat, cancel, cupsenable, cupsaccept). Le script vérifie leur présence et n’installe rien.',
  'Le nom EXACT de la destination, tel que « lpstat -p » l’affiche. Aucun joker n’est accepté.',
  'Un CUPS joignable (service cupsd local ou serveur indiqué par CUPS_SERVER).',
];

const CHECKS_COMMUNS = [
  'Aucune commande d’administration globale : ni cupsctl, ni lpadmin, ni « cancel -a », ni lprm ; cupsd.conf et /var/spool/cups ne sont jamais touchés.',
  'L’administration de CUPS n’est jamais ouverte au réseau et les règles d’accès ne sont jamais changées.',
  'La destination est comparée par égalité de nom (grep -Fx) : zéro correspondance est un refus, jamais un motif.',
  'Une URI de périphérique est masquée (identifiants remplacés) avant d’entrer dans le rapport.',
  'Aucun secret n’est demandé, lu ni écrit.',
];

function rollbackLecture() {
  return {
    summary: 'Assistant en lecture seule : il ne crée, ne modifie et ne supprime ni destination, ni travail, ni réglage CUPS. Il n’y a rien à annuler.',
    diagnostic: 'lpstat -p -d',
    command: "echo 'Assistant en lecture seule : aucune modification a defaire.'",
    warning: 'Le seul effet local est le fichier de rapport éventuel (JSON ou CSV) dans ton dossier personnel. Supprime-le toi-même quand il ne sert plus.',
  };
}

const LIMITE_ETAT = 'Une file « idle », « enabled » ou « accepting » et un port ouvert ne prouvent pas qu’une page s’imprimera : seul un travail d’impression réel le prouve.';

/**
 * Fabrique Bash. def.action : la fiche peut modifier ; elle a alors un champ de
 * confirmation et une phrase exacte qui NOMME la cible.
 */
function outilCups(def) {
  const action = def.action === true;
  const fields = [...def.champs];
  if (action) {
    fields.push({
      id: 'impConfirmation', label: 'Confirmation (vide = aucune action)', type: 'text', default: '', optionnel: true,
      help: `Pour agir, recopie exactement : ${def.phraseAide}. Sans cette phrase exacte, le script diagnostique et n’agit pas.`,
    });
  }
  fields.push(CHAMP_FORMAT);
  const outil = {
    id: def.id,
    icon: '▩',
    category: CAT,
    subcategory: FAMILLE,
    title: def.title,
    risk: def.risk ?? (action ? 'caution' : 'diagnostic'),
    summary: def.summary,
    platform: 'Linux',
    output: '.sh',
    os: OS_CUPS,
    distros: DISTROS,
    packages: ['cups-client — lpstat, cancel, cupsenable, cupsaccept (paquet cups-client)', 'cups — le service cupsd, si l’impression est locale'],
    privileges: def.privileges,
    privilegesRequis: def.privilegesRequis,
    readOnly: !action,
    service: 'cups.service',
    limites: def.impression.limites,
    fields,
    validate(v) {
      const errors = {};
      def.verifier(v, errors);
      verifierFormat(v, errors);
      if (action) {
        const conf = String(v.impConfirmation ?? '');
        if (secretsDansImpression(conf).length) {
          errors.impConfirmation = 'La confirmation ressemble à un secret : aucun secret n’est accepté.';
        } else if (conf !== '' && !errors.__cible) {
          const attendue = safe(() => def.phrase(v));
          if (attendue && conf !== attendue) errors.impConfirmation = `La confirmation ne correspond pas à la cible. Pour agir, recopie exactement : ${attendue}`;
        }
      }
      delete errors.__cible;
      for (const champ of fields) {
        if (champ.type === 'select' || errors[champ.id]) continue;
        if (secretsDansImpression(v[champ.id]).length) errors[champ.id] = 'Ce champ semble contenir un secret : le Toolkit n’en accepte aucun.';
      }
      return errors;
    },
    generate(v) {
      assertValid(this, v);
      const vars = [['KJEMO_FORMAT', shQuote(String(v.impFormat))], ...def.variables(v)];
      if (action) vars.push(['KJEMO_CONF_SAISIE', shQuote(String(v.impConfirmation ?? ''))]);
      return assemblerSh([
        // L'en-tête commun parle de « lecture » quand root est faux ; pour un
        // assistant qui agit, cette ligne serait fausse : elle est remplacée.
        ...enteteBash({ titre: def.titreScript, outil: def.id, diagnostic: !action, root: false, version: VERSION_IMPRESSION.replace(/\u2014/g, '-') })
          .map((l) => (action && l.startsWith('# Aucun privilege particulier')
            ? '# Les privileges dependent de la file : un travail de quelqu un d autre demande root ou lpadmin.'
            : l)),
        ...fonctionsEchappementBash(),
        ...fonctionsRapportBash(),
        ...blocPrivilegesBash({ exige: false }),
        ...fonctionsCups(),
        ...blocVariablesBash(vars),
        ...def.corps(v),
        ...blocConstatsCups(),
        ...blocRapportBash({ prefixeFichier: def.prefixe }),
      ]);
    },
    gui: def.gui,
    keywords: def.keywords,
    requiresAdmin: false,
    prereqs: PREREQS_CUPS.concat(def.prereqs ?? []),
    commonErrors: ERREURS_CUPS.concat(def.commonErrors ?? []),
    reversible: def.reversible ?? !action,
    verifyAfter: def.verifyAfter,
    rollback: def.rollback,
    checks: CHECKS_COMMUNS.concat(def.checks),
    source: def.source,
    sources: def.sources,
    impression: { validation: VALIDATION_IMPRESSION_CUPS, ...def.impression },
    commandes: { obligatoires: def.commandes, facultatives: [] },
  };
  if (action) outil.confirmation = true;
  if (!SOUS_RUBRIQUES_IMPRESSION.includes(outil.subcategory)) throw new Error(`famille inconnue ${outil.subcategory}`);
  return outil;
}

function safe(fn) { try { return fn(); } catch { return null; } }

/** Prélude commun : CUPS présent et répondant. Pose KJEMO_CUPS_OK. */
function preludeCups(commandes) {
  const tests = commandes.map((c) => `if ! kjemo_dispo ${c}; then KJEMO_MANQUE="\${KJEMO_MANQUE} ${c}"; fi`);
  return B`
KJEMO_MANQUE=''
KJEMO_CUPS_OK=0
`.concat(tests, B`
if [ -n "\${KJEMO_MANQUE}" ]; then
  kjemo_resultat 'Prerequis' 'Commandes CUPS' 'PROBLEME' "absentes :\${KJEMO_MANQUE}" \\
    'Installe le paquet cups-client (apt install cups-client). Ce script n installe rien.'
elif ! lpstat -r > "\${KJEMO_TMP}/scheduler.txt" 2>&1; then
  kjemo_resultat 'Prerequis' 'Service CUPS' 'PROBLEME' 'cupsd ne repond pas' \\
    'lpstat ne joint pas le serveur CUPS (service arrete, ou CUPS_SERVER pointe ailleurs). Ce script ne redemarre pas cupsd.'
else
  KJEMO_CUPS_OK=1
  kjemo_resultat 'Prerequis' 'Service CUPS' 'OK' "$(cat "\${KJEMO_TMP}/scheduler.txt")" 'Le serveur CUPS repond.'
fi
`);
}

// ===========================================================================
// 12. INVENTAIRE CUPS
// ===========================================================================

export const impCupsInventaire = outilCups({
  id: 'imp-cups-inventaire',
  title: 'Inventaire des destinations CUPS',
  titreScript: 'Inventaire des destinations CUPS (lecture seule)',
  summary: 'Liste, sans rien modifier, les destinations CUPS : état, acceptation des travaux, URI du périphérique (identifiants masqués), genre (USB, réseau direct, file d’un autre serveur) et nombre de travaux. Dit aussi si le service cupsd répond.',
  champs: [{
    id: 'impDest', label: 'Destination à examiner (vide = toutes)', type: 'text', default: '', optionnel: true,
    placeholder: 'HP_LaserJet_Accueil',
    help: 'Laisse vide pour lister toutes les destinations. Sinon, le nom exact : les autres sont ignorées. Aucun joker.',
  }],
  privileges: 'aucun — lpstat se lit avec un compte standard',
  privilegesRequis: 'aucun',
  verifier(v, errors) {
    if (String(v.impDest ?? '').trim() === '') return;
    const r = validerDestinationCups(v.impDest);
    if (!r.ok) errors.impDest = r.error;
  },
  variables(v) {
    const brut = String(v.impDest ?? '').trim();
    return [['KJEMO_FILTRE', shQuote(brut === '' ? '' : validerDestinationCups(brut).value)]];
  },
  commandes: ['lpstat'],
  prefixe: 'kjemo-cups-inventaire',
  corps() {
    return [
      ...preludeCups(['lpstat']),
      ...B`
if [ "\${KJEMO_CUPS_OK}" -eq 1 ]; then
  KJEMO_DEFAUT="$(lpstat -d 2>/dev/null || true)"
  kjemo_resultat 'Systeme' 'Destination par defaut' 'INFO' "\${KJEMO_DEFAUT:-aucune}" 'Celle de ce compte (lpoptions) ou du systeme.'
  if kjemo_dispo systemctl; then
    KJEMO_SVC="$(systemctl is-active cups 2>/dev/null || true)"
    kjemo_resultat 'Systeme' 'Service cups (systemd)' 'INFO' "\${KJEMO_SVC:-inconnu}" 'Lu seulement : ce script ne demarre ni n arrete cupsd.'
  fi
  KJEMO_NB=0
  while IFS= read -r kjemo_dest; do
    [ -n "\${kjemo_dest}" ] || continue
    if [ -n "\${KJEMO_FILTRE}" ] && [ "\${kjemo_dest}" != "\${KJEMO_FILTRE}" ]; then continue; fi
    KJEMO_NB=$((KJEMO_NB + 1))
    KJEMO_ETAT="$(lpstat -p "\${kjemo_dest}" 2>/dev/null | head -n 1 || true)"
    KJEMO_ACC="$(lpstat -a "\${kjemo_dest}" 2>/dev/null | head -n 1 || true)"
    KJEMO_URI_BRUTE="$(lpstat -v "\${kjemo_dest}" 2>/dev/null | head -n 1 | sed -e 's/^device for [^:]*: //' || true)"
    KJEMO_URI="$(kjemo_masquer_uri "\${KJEMO_URI_BRUTE}")"
    KJEMO_GENRE="$(kjemo_genre_uri "\${KJEMO_URI_BRUTE}")"
    KJEMO_NBJ="$(lpstat -o "\${kjemo_dest}" 2>/dev/null | wc -l | tr -d ' ' || true)"
    KJEMO_OK_ETAT='OK'
    KJEMO_COM='Etat DECLARE par CUPS : il ne prouve pas qu une page sortira.'
    case "\${KJEMO_ETAT}" in
      *disabled*) KJEMO_OK_ETAT='ATTENTION'; KJEMO_COM='File desactivee (disabled) : les travaux s accumulent. Voir le diagnostic de cette file.' ;;
    esac
    case "\${KJEMO_ACC}" in
      *"not accepting"*) KJEMO_OK_ETAT='ATTENTION'; KJEMO_COM='La file n accepte plus de travaux (not accepting requests).' ;;
    esac
    kjemo_resultat 'Destination' "\${kjemo_dest}" "\${KJEMO_OK_ETAT}" "\${KJEMO_GENRE} | URI : \${KJEMO_URI:-inconnue} | travaux : \${KJEMO_NBJ:-0} | \${KJEMO_ETAT}" "\${KJEMO_COM}"
  done <<EOF_DESTS
$(kjemo_destinations)
EOF_DESTS
  if [ -n "\${KJEMO_FILTRE}" ] && [ "\${KJEMO_NB}" -eq 0 ]; then
    kjemo_resultat 'Cible' 'Destination demandee' 'ATTENTION' "\${KJEMO_FILTRE}" 'Aucune destination ne porte exactement ce nom (comparaison exacte, sans joker).'
  fi
  kjemo_resultat 'Synthese' 'Nombre de destinations' 'INFO' "\${KJEMO_NB}" 'Le genre est deduit du schema de l URI : c est une heuristique.'
  kjemo_resultat 'Limite' 'Ce que ce rapport prouve' 'INFO' 'etat declare' 'Ce rapport dit ce que CUPS DECLARE. Une file idle ne prouve pas qu une page s imprimera.'
fi
`,
    ];
  },
  impression: {
    probleme: 'Tu arrives sur un poste Linux et tu ne sais pas quelles imprimantes CUPS connaît, ni si elles sont locales, réseau ou issues d’un autre serveur.',
    exemple: 'Trois destinations : « HP_LaserJet_Accueil » en IPP vers 192.168.30.50, « Compta » vers le CUPS de SRV-PRINT, et un PDF virtuel. Une file est « disabled ».',
    premiere: 'Regarde d’abord si cupsd répond, puis le genre de la file en cause : une file d’un autre serveur se dépanne côté serveur.',
    lit: 'lpstat -r, -d, -p, -a, -v, -o et l’état du service cups. Que des lectures.',
    ecrit: 'Rien sur le système. Éventuellement un fichier de rapport dans ton dossier personnel.',
    effets: 'Aucun effet sur CUPS, les files ou les travaux.',
    limites: [
      LIMITE_ETAT,
      'Le genre d’une destination est déduit du schéma de l’URI (heuristique). Une URI atypique peut être mal classée.',
      'Sous Linux il n’y a pas de « spouleur » à redémarrer ici : cupsd est un service systemd que ces assistants ne touchent pas.',
    ],
  },
  gui: [
    'Vérifie que CUPS répond : « lpstat -r ».',
    'Liste les destinations et leur état : « lpstat -p -d ».',
    'Regarde où chacune imprime : « lpstat -v ».',
    'Regarde si elles acceptent des travaux : « lpstat -a ».',
    'Compte les travaux : « lpstat -o ».',
  ],
  keywords: ['cups', 'lpstat', 'imprimante', 'inventaire', 'destination', 'linux', 'ubuntu', 'ipp', 'uri'],
  rollback: rollbackLecture(),
  checks: ['Le genre de chaque destination (USB, réseau direct, file d’un autre CUPS, virtuelle) est affiché, avec l’état DÉCLARÉ.'],
  verifyAfter: [
    'Le rapport liste autant de destinations que « lpstat -p ».',
    'Les URI affichées ne contiennent aucun identifiant (masqués).',
    'La conclusion rappelle qu’un état « idle » ne prouve pas qu’une page s’imprimera.',
  ],
  source: SRC_CUPS.lpstat.url,
  sources: [SRC_CUPS.lpstat, SRC_CUPS.uri],
});

// ===========================================================================
// 13. DIAGNOSTIC D'UNE DESTINATION
// ===========================================================================

export const impCupsDiagnosticFile = outilCups({
  id: 'imp-cups-diagnostic-file',
  title: 'Diagnostic d’une file CUPS',
  titreScript: 'Diagnostic d une destination CUPS (lecture seule)',
  summary: 'Examine UNE destination CUPS nommée sans rien modifier : état, acceptation des travaux, raisons déclarées, travaux en attente, URI du périphérique (identifiants masqués), joignabilité réseau (DNS puis TCP sur le port de l’URI) et journal récent de CUPS. Ne redémarre rien et ne purge rien.',
  champs: [champDest()],
  privileges: 'aucun pour lpstat ; root ou le groupe adm pour le journal de cups',
  privilegesRequis: 'root-partiel',
  verifier(v, errors) {
    const r = validerDestinationCups(v.impDest);
    if (!r.ok) errors.impDest = r.error;
  },
  variables(v) { return [['KJEMO_DEST', shQuote(validerDestinationCups(v.impDest).value)]]; },
  commandes: ['lpstat'],
  prefixe: 'kjemo-cups-diagnostic',
  corps() {
    return [
      ...preludeCups(['lpstat']),
      ...B`
if [ "\${KJEMO_CUPS_OK}" -eq 1 ]; then
  if kjemo_dest_existe "\${KJEMO_DEST}"; then
    kjemo_resultat 'Cible' 'Destination' 'OK' "\${KJEMO_DEST}" 'Une destination porte exactement ce nom.'
    KJEMO_ETAT="$(lpstat -p "\${KJEMO_DEST}" 2>/dev/null | head -n 1 || true)"
    KJEMO_ETAT_OK='OK'
    case "\${KJEMO_ETAT}" in
      *disabled*) KJEMO_ETAT_OK='PROBLEME' ;;
    esac
    kjemo_resultat 'Piste 1 - file desactivee' 'Etat declare' "\${KJEMO_ETAT_OK}" "\${KJEMO_ETAT}" 'Une file disabled ne sort plus rien et accumule les travaux. Etat DECLARE par CUPS.'
    KJEMO_RAISONS="$(kjemo_raisons "\${KJEMO_DEST}" || true)"
    if [ -n "\${KJEMO_RAISONS}" ]; then
      kjemo_resultat 'Piste 1 - file desactivee' 'Raisons declarees' 'INFO' "$(kjemo_masquer_uri "\${KJEMO_RAISONS}")" 'Raisons et alertes que CUPS associe a la file (printer-state-reasons).'
    fi
    KJEMO_ACC="$(lpstat -a "\${KJEMO_DEST}" 2>/dev/null | head -n 1 || true)"
    case "\${KJEMO_ACC}" in
      *"not accepting"*) kjemo_resultat 'Piste 2 - file ne recevant plus' 'Acceptation' 'PROBLEME' "\${KJEMO_ACC}" 'La file refuse de nouveaux travaux (cupsaccept).' ;;
      *) kjemo_resultat 'Piste 2 - file ne recevant plus' 'Acceptation' 'OK' "\${KJEMO_ACC}" 'La file accepte des travaux.' ;;
    esac
    KJEMO_JOBS="$(lpstat -o "\${KJEMO_DEST}" 2>/dev/null || true)"
    KJEMO_NBJ=0
    if [ -n "\${KJEMO_JOBS}" ]; then KJEMO_NBJ="$(printf '%s\\n' "\${KJEMO_JOBS}" | wc -l | tr -d ' ')"; fi
    kjemo_resultat 'Piste 3 - travail bloque' 'Travaux en file' 'INFO' "\${KJEMO_NBJ}" 'Le nom du document n est pas affiche. Aucun travail n est annule par ce script.'
    KJEMO_I=0
    while IFS= read -r kjemo_ligne; do
      [ -n "\${kjemo_ligne}" ] || continue
      KJEMO_I=$((KJEMO_I + 1))
      if [ "\${KJEMO_I}" -le 20 ]; then
        kjemo_resultat 'Piste 3 - travail bloque' "Travail \${KJEMO_I}" 'INFO' "\${kjemo_ligne}" 'Identifiant, proprietaire, taille et date. Un travail ancien peut etre bloque.'
      fi
    done <<EOF_JOBS
\${KJEMO_JOBS}
EOF_JOBS
    KJEMO_URI_BRUTE="$(lpstat -v "\${KJEMO_DEST}" 2>/dev/null | head -n 1 | sed -e 's/^device for [^:]*: //' || true)"
    kjemo_resultat 'Piste 4 - peripherique' 'URI' 'INFO' "$(kjemo_masquer_uri "\${KJEMO_URI_BRUTE}")" "$(kjemo_genre_uri "\${KJEMO_URI_BRUTE}")"
    kjemo_reseau_uri "\${KJEMO_URI_BRUTE}"
    if kjemo_dispo journalctl; then
      KJEMO_JRN="$(journalctl -u cups -n 15 --no-pager 2>/dev/null | tail -n 15 || true)"
      if [ -n "\${KJEMO_JRN}" ]; then
        kjemo_resultat 'Journal' 'Journal du service cups (15 lignes)' 'INFO' "$(kjemo_masquer_uri "\${KJEMO_JRN}")" 'Lecture seule. Peut etre vide ou refuse sans les droits adm.'
      else
        kjemo_resultat 'Journal' 'Journal du service cups' 'ATTENTION' 'INACCESSIBLE ou vide' 'Journal illisible sans privileges, ou vide. Ce controle ne prouve RIEN.'
      fi
    fi
  else
    kjemo_resultat 'Cible' 'Destination' 'PROBLEME' "\${KJEMO_DEST}" 'REFUS : aucune destination ne porte exactement ce nom. Copie-le depuis lpstat -p : les noms proches ne sont pas acceptes.'
  fi
  kjemo_resultat 'Limite' 'Ce que ce rapport prouve' 'INFO' 'etat declare' 'Une file idle, un port ouvert ou un ping ne prouvent pas qu une page s imprimera. Seul un travail reel le prouve.'
fi
`,
    ];
  },
  impression: {
    probleme: 'Une file CUPS ne sort rien : est-elle désactivée, bloquée, injoignable ou mal configurée ?',
    exemple: '« HP_LaserJet_Accueil » est « disabled » avec la raison « offline-report », et son URI ipp://192.168.30.50 ne répond plus sur le port 631 : la piste est réseau ou imprimante éteinte.',
    premiere: 'Lis les pistes dans l’ordre : file désactivée, file qui n’accepte plus, travail bloqué, périphérique. Une seule suffit souvent à expliquer.',
    lit: 'lpstat -p, -l, -a, -o, -v, un test DNS (getent) et TCP (bash /dev/tcp) vers l’hôte de l’URI, et journalctl -u cups. Que des lectures.',
    ecrit: 'Rien sur le système. Éventuellement un fichier de rapport dans ton dossier personnel.',
    effets: 'Aucune modification de la file, des travaux ou de CUPS. Le test TCP ouvre puis ferme une connexion vers le port de l’imprimante, sans donnée d’impression.',
    limites: [
      LIMITE_ETAT,
      'Seules les URI réseau (ipp, ipps, http, https, socket, lpd) donnent lieu à un test : USB, fichier et dnssd n’en ont pas.',
      'Le journal de cups peut être refusé sans droits (adm) ou vide : le rapport le signale et ne conclut pas.',
      'Les URI IPv6 littérales ne sont pas testées.',
    ],
  },
  gui: [
    'Vérifie la file : « lpstat -p <destination> -l ».',
    'Vérifie qu’elle accepte : « lpstat -a <destination> ».',
    'Liste ses travaux : « lpstat -o <destination> ».',
    'Regarde où elle imprime : « lpstat -v <destination> ».',
    'Teste le port : « nc -zv <hôte> 631 » (ou 9100 pour socket://).',
    'Lis le journal : « journalctl -u cups -n 30 --no-pager ».',
  ],
  keywords: ['cups', 'lpstat', 'diagnostic', 'file', 'disabled', 'offline', 'travail bloque', 'ipp', 'linux', 'ubuntu'],
  rollback: rollbackLecture(),
  checks: ['Les quatre pistes (file désactivée, file qui n’accepte plus, travail bloqué, périphérique) sont séparées dans le rapport.', 'Les travaux sont listés, jamais annulés.'],
  verifyAfter: [
    'Le rapport nomme la destination exacte, ou refuse si le nom est inconnu.',
    'Chaque travail est listé ; aucun n’a été annulé.',
    'Les lectures impossibles sont des ATTENTION (INACCESSIBLE), pas des OK.',
  ],
  source: SRC_CUPS.lpstat.url,
  sources: [SRC_CUPS.lpstat, SRC_CUPS.uri],
});

// ===========================================================================
// 14. ANNULER UN TRAVAIL CUPS
// ===========================================================================

export const impCupsAnnulerTravail = outilCups({
  id: 'imp-cups-annuler-travail',
  title: 'Annuler UN travail d’impression CUPS',
  titreScript: 'Annuler UN travail CUPS identifie, puis relire la file',
  summary: 'Annule un seul travail CUPS, désigné par sa destination et son numéro, après l’avoir lu (propriétaire vérifié si tu le fournis). N’utilise jamais « cancel -a », ne purge pas /var/spool/cups, et relit la file pour vérifier la disparition du travail.',
  action: true,
  champs: [
    champDest(),
    { id: 'impJob', label: 'Numéro du travail', type: 'number', default: '1', min: 1, max: 2147483647, help: 'Le nombre après le tiret de « destination-NN » dans « lpstat -o ».' },
    { id: 'impProprio', label: 'Propriétaire attendu (facultatif)', type: 'text', default: '', optionnel: true, help: 'Si tu le donnes, le script refuse quand le propriétaire du travail est différent : garde contre une erreur de numéro.' },
  ],
  privileges: 'aucun pour annuler ses propres travaux ; root ou le groupe lpadmin pour ceux des autres',
  privilegesRequis: 'root-partiel',
  verifier(v, errors) {
    const d = validerDestinationCups(v.impDest);
    if (!d.ok) { errors.impDest = d.error; errors.__cible = true; }
    const j = validerIdTravailCups(v.impJob);
    if (!j.ok) { errors.impJob = j.error; errors.__cible = true; }
    const p = validerUtilisateurLinuxFacultatif(v.impProprio);
    if (!p.ok) { errors.impProprio = p.error; errors.__cible = true; }
  },
  phrase(v) {
    return `ANNULER LE TRAVAIL ${validerDestinationCups(v.impDest).value}-${validerIdTravailCups(v.impJob).value}`;
  },
  phraseAide: 'ANNULER LE TRAVAIL <destination>-<numéro>',
  variables(v) {
    return [
      ['KJEMO_DEST', shQuote(validerDestinationCups(v.impDest).value)],
      ['KJEMO_JOB', shQuote(String(validerIdTravailCups(v.impJob).value))],
      ['KJEMO_PROPRIO', shQuote(validerUtilisateurLinuxFacultatif(v.impProprio).value)],
    ];
  },
  commandes: ['lpstat', 'cancel'],
  prefixe: 'kjemo-cups-annule',
  corps(v) {
    const phrase = outilPhrase(v);
    return [
      ...preludeCups(['lpstat', 'cancel']),
      ...B`
KJEMO_CIBLE_OK=0
KJEMO_JOB_ID="\${KJEMO_DEST}-\${KJEMO_JOB}"
KJEMO_PROPRIO_OK=1
if [ "\${KJEMO_CUPS_OK}" -eq 1 ]; then
  if kjemo_dest_existe "\${KJEMO_DEST}"; then
    kjemo_resultat 'Cible' 'Destination' 'OK' "\${KJEMO_DEST}" 'Une destination porte exactement ce nom.'
    # Lecture AVANT : le travail existe-t-il ? Egalite sur le premier champ, jamais un motif.
    KJEMO_LIGNE="$(lpstat -o "\${KJEMO_DEST}" 2>/dev/null | awk -v id="\${KJEMO_JOB_ID}" '$1 == id {print; exit}' || true)"
    if [ -n "\${KJEMO_LIGNE}" ]; then
      KJEMO_CIBLE_OK=1
      KJEMO_OWNER="$(printf '%s' "\${KJEMO_LIGNE}" | awk '{print $2}')"
      kjemo_resultat 'Travail' "\${KJEMO_JOB_ID}" 'INFO' "\${KJEMO_LIGNE}" 'Le nom du document n est pas affiche : il peut etre confidentiel.'
      if [ -n "\${KJEMO_PROPRIO}" ]; then
        if [ "\${KJEMO_OWNER}" = "\${KJEMO_PROPRIO}" ]; then
          kjemo_resultat 'Travail' 'Proprietaire' 'OK' "\${KJEMO_OWNER}" 'Identique au proprietaire attendu.'
        else
          KJEMO_PROPRIO_OK=0
          kjemo_resultat 'Travail' 'Proprietaire' 'PROBLEME' "\${KJEMO_OWNER} (attendu : \${KJEMO_PROPRIO})" 'REFUS : ce travail appartient a quelqu un d autre que prevu. Verifie le numero.'
        fi
      elif [ "\${KJEMO_OWNER}" != "$(id -un)" ]; then
        kjemo_resultat 'Travail' 'Proprietaire' 'ATTENTION' "\${KJEMO_OWNER}" 'Ce travail appartient a un AUTRE utilisateur. Annuler le travail d un autre demande root ou le groupe lpadmin.'
      fi
    else
      kjemo_resultat 'Travail' "\${KJEMO_JOB_ID}" 'PROBLEME' 'introuvable' 'REFUS : aucun travail de cet identifiant dans cette file. Il est peut-etre deja imprime, annule ou deplace. Relis lpstat -o.'
    fi
  else
    kjemo_resultat 'Cible' 'Destination' 'PROBLEME' "\${KJEMO_DEST}" 'REFUS : aucune destination ne porte exactement ce nom.'
  fi
fi
`,
      ...blocConfirmation({ phraseAttendue: phrase, variableSaisie: 'KJEMO_CONF_SAISIE', action: 'annuler ce travail' }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_CUPS_OK', 'CUPS ne repond pas ou ses commandes sont absentes.'],
          ['KJEMO_CIBLE_OK', 'La destination ou le travail est introuvable.'],
          ['KJEMO_PROPRIO_OK', 'Le proprietaire du travail ne correspond pas a celui attendu.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement la phrase attendue.'],
        ],
        action: 'l annulation',
      }),
      ...B`
if [ "\${KJEMO_AGIR}" -eq 1 ]; then
  KJEMO_CODE=0
  cancel "\${KJEMO_JOB_ID}" > "\${KJEMO_TMP}/cancel.out" 2>&1 || KJEMO_CODE=$?
  if [ "\${KJEMO_CODE}" -ne 0 ]; then
    kjemo_resultat 'Action' 'cancel' 'PROBLEME' "code \${KJEMO_CODE}" "$(head -c 200 "\${KJEMO_TMP}/cancel.out" | tr '\\n' ' ')"
  else
    kjemo_resultat 'Action' 'cancel' 'INFO' 'commande acceptee' 'Acceptee ne veut pas dire effective : la relecture decide.'
  fi
  # Relecture : on attend jusqu a 5 secondes que le travail disparaisse de la file.
  KJEMO_DISPARU=0
  KJEMO_ESSAI=0
  while [ "\${KJEMO_ESSAI}" -lt 5 ] && [ "\${KJEMO_DISPARU}" -eq 0 ]; do
    sleep 1
    KJEMO_RESTE="$(lpstat -o "\${KJEMO_DEST}" 2>/dev/null | awk -v id="\${KJEMO_JOB_ID}" '$1 == id {print; exit}' || true)"
    if [ -z "\${KJEMO_RESTE}" ]; then KJEMO_DISPARU=1; fi
    KJEMO_ESSAI=$((KJEMO_ESSAI + 1))
  done
  if [ "\${KJEMO_DISPARU}" -eq 1 ]; then
    kjemo_resultat 'Relecture' "\${KJEMO_JOB_ID}" 'OK' 'absent de la file' 'Le travail n apparait plus dans lpstat -o. Les autres travaux n ont pas ete touches.'
  else
    kjemo_resultat 'Relecture' "\${KJEMO_JOB_ID}" 'PROBLEME' 'toujours present' 'Le travail est encore dans la file. Ne le considere PAS comme annule.'
    printf '%s\\n' 'ECART : le travail est toujours present apres cancel.' >&2
  fi
fi
`,
    ];
  },
  impression: {
    probleme: 'Un travail coincé bloque la file CUPS, et les suivants attendent derrière lui.',
    exemple: 'Le travail HP_LaserJet_Accueil-42 est présent depuis une heure. Tu l’annules, lui seul, et tu relis la file pour vérifier qu’il a disparu et que les autres sont intacts.',
    premiere: 'Repère le numéro avec le diagnostic de file ou « lpstat -o », puis lance le script SANS phrase : il montre le travail et ne fait rien.',
    lit: 'lpstat -r, -p, -o de la destination ciblée. Le nom du document n’est pas affiché.',
    ecrit: 'Seulement avec la phrase exacte : « cancel <destination>-<numéro> » sur CE travail. Rien d’autre.',
    effets: 'Un seul travail disparaît de la file. Les autres travaux, la destination, cupsd et le dossier de spool ne sont pas touchés. L’annulation est définitive.',
    limites: [
      'Un seul travail à la fois : jamais « cancel -a », jamais de purge de /var/spool/cups.',
      'Un travail déjà en cours d’impression peut laisser l’imprimante au milieu d’une page.',
      'Annuler le travail d’un autre utilisateur demande root ou le groupe lpadmin ; sans ce droit cancel refuse et le script le dit.',
      'Pas de simulation native : cancel n’a pas d’option de prévisualisation. Sans la phrase, le script décrit et n’exécute rien.',
    ],
  },
  gui: [
    'Liste les travaux de la file : « lpstat -o <destination> ».',
    'Repère le numéro, le propriétaire et la taille.',
    'Annule CE travail : « cancel <destination>-<numéro> ».',
    'Relis : « lpstat -o <destination> ».',
    'N’utilise jamais « cancel -a » : il annule TOUS les travaux de la destination.',
  ],
  keywords: ['cups', 'cancel', 'annuler', 'travail', 'job', 'lpstat', 'bloque', 'file d attente', 'linux'],
  reversible: false,
  rollback: {
    summary: 'Un travail annulé ne se récupère pas : il faut renvoyer le document depuis l’application.',
    diagnostic: 'lpstat -o HP_LaserJet_Accueil',
    command: "echo 'Un travail annule ne se restaure pas : renvoie le document depuis l application.'",
    warning: 'Aucune commande ne restaure un travail supprimé. Vérifie le numéro avant de fournir la phrase de confirmation.',
  },
  checks: [
    'Sans la phrase exacte « ANNULER LE TRAVAIL <destination>-<numéro> », le script lit et n’annule rien ; la phrase est revérifiée dans le script.',
    'Le travail est LU avant (égalité sur son identifiant) : introuvable ou propriétaire différent de celui attendu, refus.',
    'cancel reçoit l’identifiant COMPLET d’un seul travail, jamais -a ni un motif.',
    'La file est RELUE après l’action : le travail doit avoir disparu, sinon ECART.',
  ],
  verifyAfter: [
    '« lpstat -o <destination> » ne liste plus le travail annulé.',
    'Les autres travaux de la file sont toujours là.',
    'Le rapport contient une ligne « Relecture » issue de lpstat, pas du code de retour de cancel.',
  ],
  source: SRC_CUPS.cancel.url,
  sources: [SRC_CUPS.cancel, SRC_CUPS.lpstat],
});

function outilPhrase(v) {
  return `ANNULER LE TRAVAIL ${validerDestinationCups(v.impDest).value}-${validerIdTravailCups(v.impJob).value}`;
}

// ===========================================================================
// 15. RÉACTIVER / RÉACCEPTER UNE FILE
// ===========================================================================

const ACTIONS_CUPS = {
  Reactiver: { cmd: 'cupsenable', phrase: 'REACTIVER', quoi: 'réactive la file (elle ré-imprime ses travaux)' },
  Accepter: { cmd: 'cupsaccept', phrase: 'ACCEPTER LES TRAVAUX DE', quoi: 'ré-accepte les nouveaux travaux' },
};

export const impCupsReactiverFile = outilCups({
  id: 'imp-cups-reactiver-file',
  title: 'Réactiver une file CUPS (cupsenable ou cupsaccept)',
  titreScript: 'Reactiver UNE destination CUPS (cupsenable ou cupsaccept), puis relire son etat',
  summary: 'Réactive UNE destination désactivée (cupsenable) ou la remet en état d’accepter des travaux (cupsaccept), après lecture de son état et de la raison de l’arrêt. Refuse si elle est déjà dans l’état voulu. Ne touche ni à cupsd, ni à cupsd.conf, ni aux règles d’accès, ni à l’administration réseau.',
  action: true,
  champs: [
    champDest(),
    {
      id: 'impAction', label: 'Action', type: 'select', default: 'Reactiver',
      options: [['Reactiver', 'Réactiver la file (cupsenable)'], ['Accepter', 'Accepter de nouveau les travaux (cupsaccept)']],
      help: 'Deux états distincts : une file peut être désactivée (elle n’imprime plus) ou n’accepter plus de travaux (elle ne reçoit plus).',
    },
  ],
  privileges: 'root ou le groupe lpadmin pour modifier l’état d’une file ; aucun pour la lecture',
  privilegesRequis: 'root-partiel',
  verifier(v, errors) {
    const d = validerDestinationCups(v.impDest);
    if (!d.ok) { errors.impDest = d.error; errors.__cible = true; }
    const a = validerChoix(v.impAction, Object.keys(ACTIONS_CUPS), 'L’action');
    if (!a.ok) { errors.impAction = a.error; errors.__cible = true; }
  },
  phrase(v) {
    const a = ACTIONS_CUPS[String(v.impAction)];
    return `${a.phrase} ${validerDestinationCups(v.impDest).value}`;
  },
  phraseAide: 'REACTIVER <destination>  ou  ACCEPTER LES TRAVAUX DE <destination>',
  variables(v) {
    const a = ACTIONS_CUPS[String(v.impAction)];
    return [
      ['KJEMO_DEST', shQuote(validerDestinationCups(v.impDest).value)],
      ['KJEMO_VERBE', shQuote(a.cmd)],
    ];
  },
  commandes: ['lpstat', 'cupsenable', 'cupsaccept'],
  prefixe: 'kjemo-cups-reactivation',
  corps(v) {
    const a = ACTIONS_CUPS[String(v.impAction)];
    const phrase = `${a.phrase} ${validerDestinationCups(v.impDest).value}`;
    return [
      ...preludeCups(['lpstat', 'cupsenable', 'cupsaccept']),
      ...B`
KJEMO_CIBLE_OK=0
KJEMO_BESOIN_OK=0
if [ "\${KJEMO_CUPS_OK}" -eq 1 ]; then
  if kjemo_dest_existe "\${KJEMO_DEST}"; then
    KJEMO_CIBLE_OK=1
    kjemo_resultat 'Cible' 'Destination' 'OK' "\${KJEMO_DEST}" 'Une destination porte exactement ce nom.'
    KJEMO_ETAT_AVANT="$(lpstat -p "\${KJEMO_DEST}" 2>/dev/null | head -n 1 || true)"
    KJEMO_ACC_AVANT="$(lpstat -a "\${KJEMO_DEST}" 2>/dev/null | head -n 1 || true)"
    kjemo_resultat 'Avant' 'Etat de la file' 'INFO' "\${KJEMO_ETAT_AVANT}" 'Valeur de depart, a reprendre pour revenir en arriere.'
    kjemo_resultat 'Avant' 'Acceptation' 'INFO' "\${KJEMO_ACC_AVANT}" 'Valeur de depart.'
    KJEMO_RAISON="$(kjemo_raisons "\${KJEMO_DEST}" || true)"
    if [ -n "\${KJEMO_RAISON}" ]; then
      kjemo_resultat 'Avant' 'Raison declaree' 'ATTENTION' "$(kjemo_masquer_uri "\${KJEMO_RAISON}")" "Raison declaree par CUPS : $(kjemo_masquer_uri "\${KJEMO_RAISON}"). Reactiver ne CORRIGE PAS la cause : si elle persiste, la file se desactivera de nouveau."
    fi
    if [ "\${KJEMO_VERBE}" = 'cupsenable' ]; then
      case "\${KJEMO_ETAT_AVANT}" in
        *disabled*) KJEMO_BESOIN_OK=1 ;;
        *) kjemo_resultat 'Cible' 'Etat requis' 'PROBLEME' 'deja activee' 'REFUS : la file n est pas desactivee, il n y a rien a reactiver.' ;;
      esac
    else
      case "\${KJEMO_ACC_AVANT}" in
        *"not accepting"*) KJEMO_BESOIN_OK=1 ;;
        *) kjemo_resultat 'Cible' 'Etat requis' 'PROBLEME' 'accepte deja' 'REFUS : la file accepte deja les travaux, il n y a rien a changer.' ;;
      esac
    fi
    KJEMO_URI_BRUTE="$(lpstat -v "\${KJEMO_DEST}" 2>/dev/null | head -n 1 | sed -e 's/^device for [^:]*: //' || true)"
    kjemo_reseau_uri "\${KJEMO_URI_BRUTE}"
  else
    kjemo_resultat 'Cible' 'Destination' 'PROBLEME' "\${KJEMO_DEST}" 'REFUS : aucune destination ne porte exactement ce nom.'
  fi
fi
`,
      ...blocConfirmation({ phraseAttendue: phrase, variableSaisie: 'KJEMO_CONF_SAISIE', action: `${a.cmd} sur la destination` }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_CUPS_OK', 'CUPS ne repond pas ou ses commandes sont absentes.'],
          ['KJEMO_CIBLE_OK', 'La destination est introuvable.'],
          ['KJEMO_BESOIN_OK', 'La file est deja dans l etat voulu.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement la phrase attendue.'],
        ],
        action: 'la reactivation',
      }),
      ...B`
if [ "\${KJEMO_AGIR}" -eq 1 ]; then
  case "\${KJEMO_VERBE}" in
    cupsenable|cupsaccept) : ;;
    *)
      printf '%s\\n' 'ARRET : verbe non autorise. Ce script a ete modifie a la main.' >&2
      exit 1
      ;;
  esac
  KJEMO_CODE=0
  "\${KJEMO_VERBE}" "\${KJEMO_DEST}" > "\${KJEMO_TMP}/verbe.out" 2>&1 || KJEMO_CODE=$?
  if [ "\${KJEMO_CODE}" -ne 0 ]; then
    kjemo_resultat 'Action' "\${KJEMO_VERBE}" 'PROBLEME' "code \${KJEMO_CODE}" "$(head -c 200 "\${KJEMO_TMP}/verbe.out" | tr '\\n' ' ') Il faut root ou le groupe lpadmin."
  else
    kjemo_resultat 'Action' "\${KJEMO_VERBE}" 'INFO' 'commande acceptee' 'Acceptee ne veut pas dire effective : la relecture decide.'
  fi
  sleep 2
  KJEMO_ETAT_APRES="$(lpstat -p "\${KJEMO_DEST}" 2>/dev/null | head -n 1 || true)"
  KJEMO_ACC_APRES="$(lpstat -a "\${KJEMO_DEST}" 2>/dev/null | head -n 1 || true)"
  KJEMO_RELU_OK=0
  if [ "\${KJEMO_VERBE}" = 'cupsenable' ]; then
    case "\${KJEMO_ETAT_APRES}" in
      *disabled*) : ;;
      *) KJEMO_RELU_OK=1 ;;
    esac
  else
    case "\${KJEMO_ACC_APRES}" in
      *"not accepting"*) : ;;
      *) KJEMO_RELU_OK=1 ;;
    esac
  fi
  if [ "\${KJEMO_RELU_OK}" -eq 1 ]; then
    kjemo_resultat 'Relecture' 'Etat de la file' 'OK' "\${KJEMO_ETAT_APRES} | \${KJEMO_ACC_APRES}" 'L etat relu correspond a la demande. Cela ne prouve pas qu une page sortira, ni que la cause de l arret est corrigee.'
  else
    kjemo_resultat 'Relecture' 'Etat de la file' 'PROBLEME' "\${KJEMO_ETAT_APRES} | \${KJEMO_ACC_APRES}" 'L etat relu ne correspond pas a la demande. Ne considere PAS la file comme reactivee.'
    printf '%s\\n' 'ECART : lpstat ne montre pas l etat attendu apres action.' >&2
  fi
fi
`,
    ];
  },
  impression: {
    probleme: 'Une file CUPS est « disabled » ou n’accepte plus de travaux, et les utilisateurs ne peuvent plus imprimer.',
    exemple: '« HP_LaserJet_Accueil » est disabled depuis que l’imprimante a été éteinte. Une fois l’imprimante rallumée et joignable, tu réactives la file et tu relis son état.',
    premiere: 'Lance le diagnostic de file d’abord : réactiver une file dont la cause persiste ne sert à rien, elle se désactivera de nouveau.',
    lit: 'lpstat -p, -a, -l, -v de la destination et un test DNS/TCP vers l’URI.',
    ecrit: 'Seulement avec la phrase exacte : « cupsenable <destination> » OU « cupsaccept <destination> ». Rien d’autre.',
    effets: 'Une file désactivée se remet à imprimer ses travaux en attente — qui peuvent sortir d’un coup. Une file qui n’acceptait plus recommence à recevoir des travaux.',
    limites: [
      'Ne corrige pas la cause de l’arrêt (imprimante éteinte, URI fausse, filtre en échec).',
      'Ne redémarre pas cupsd, ne modifie pas cupsd.conf, ne change pas les règles d’accès et n’ouvre pas l’administration de CUPS au réseau.',
      'Réactiver une file avec des travaux anciens les libère : ils peuvent s’imprimer d’un coup, sur du papier consommé pour rien.',
      'Pas de simulation native : sans la phrase, le script décrit et n’exécute rien.',
    ],
  },
  gui: [
    'Lis l’état et la raison : « lpstat -p <destination> -l ».',
    'Corrige la cause d’abord (imprimante allumée, réseau, URI).',
    'Réactive : « cupsenable <destination> » (ou « cupsaccept <destination> » si elle n’accepte plus).',
    'Relis : « lpstat -p <destination> » et « lpstat -a <destination> ».',
    'Fais une impression réelle pour vérifier.',
  ],
  keywords: ['cups', 'cupsenable', 'cupsaccept', 'reactiver', 'disabled', 'file desactivee', 'not accepting', 'linux', 'ubuntu'],
  reversible: true,
  rollback: {
    summary: 'L’inverse exact : cupsdisable désactive la file, cupsreject la fait refuser de nouveaux travaux. L’état d’origine est dans le rapport (lignes « Avant »).',
    diagnostic: 'lpstat -p HP_LaserJet_Accueil -l; lpstat -a HP_LaserJet_Accueil',
    command: '# A lancer toi-meme, avec les droits voulus, pour revenir a l etat releve avant :\nsudo cupsdisable HP_LaserJet_Accueil\nsudo cupsreject HP_LaserJet_Accueil',
    warning: 'Désactiver une file qui tourne bloque l’impression de tout le monde : ne le fais que si l’état d’origine l’était vraiment.',
  },
  checks: [
    'Sans la phrase exacte « REACTIVER <destination> » ou « ACCEPTER LES TRAVAUX DE <destination> », le script lit et n’agit pas ; la phrase est revérifiée dans le script.',
    'Deux verbes seulement, figés par le générateur et revérifiés dans le script : cupsenable, cupsaccept.',
    'La file doit être réellement désactivée (ou ne plus accepter) : sinon refus, rien à faire.',
    'La raison déclarée par CUPS est affichée avant l’action, avec la mention que réactiver ne corrige pas la cause.',
    'L’état est RELU après l’action (lpstat) ; un écart arrête sur ECART.',
  ],
  verifyAfter: [
    '« lpstat -p <destination> » ne dit plus « disabled » (ou « lpstat -a » ne dit plus « not accepting »).',
    'Le rapport contient une ligne « Relecture » issue de lpstat, pas du code de retour.',
    'Seul un travail d’impression réel prouve que la file imprime.',
  ],
  source: SRC_CUPS.cupsenable.url,
  sources: [SRC_CUPS.cupsenable, SRC_CUPS.cupsaccept, SRC_CUPS.lpstat],
});

export const toolsImpressionCups = [
  impCupsInventaire, impCupsDiagnosticFile, impCupsAnnulerTravail, impCupsReactiverFile,
];
