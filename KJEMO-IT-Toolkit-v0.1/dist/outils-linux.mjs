/**
 * outils-linux.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Catalogue Linux, première partie : Diagnostic Linux (4 assistants) et
 * Bash et automatisation (5 assistants).
 *
 * Les trois modules `outils-linux*.mjs` se répartissent les 32 assistants du
 * lot par sous-rubrique. Le découpage n'est pas arbitraire : un module de
 * 7 000 lignes ne se relit pas, et `outils-poste-b.mjs` avait déjà atteint
 * 6 500 lignes au LOT 6B — on sentait la limite.
 *
 * Aucun de ces modules n'importe `generators.mjs` : ils prennent leurs
 * fonctions dans `noyau-bash.mjs`, `gardes-bash.mjs` et `validateurs-linux.mjs`,
 * et c'est `generators.mjs` qui les importe. Même discipline qu'au LOT 2, pour
 * la même raison : un cycle ESM marche souvent, échoue parfois, et se
 * diagnostique mal.
 */

import { assertValid } from './noyau.mjs';
import {
  shQuote, assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocParametresBash, blocVariablesBash, blocRapportBash, blocPrivilegesBash,
  VERSION_LINUX,
} from './noyau-bash.mjs';
import { blocGardienChemin, blocSauvegardeFichier, blocConfirmation } from './gardes-bash.mjs';
import {
  validateCheminAbsolu, validateNomFichier, validateEntierBorne, validateNomUnite,
  validateChoix, validateDureeJournal,
} from './validateurs-linux.mjs';

const CAT = 'Linux et services réseau';

/** Préfixe de manpage Ubuntu, pour ne pas le réécrire cinquante fois. */
const M = 'https://manpages.ubuntu.com/manpages/noble/en';

/**
 * Systèmes compatibles, identiques pour tout le lot : ce qui est réellement
 * visé, et pas « Linux ».
 *
 * Dire « Linux » serait une promesse qu'on ne tient pas : les chemins, les
 * noms de paquets et les valeurs par défaut diffèrent entre Debian et Fedora,
 * et un script écrit pour `apt` n'a rien à faire sur une machine `dnf`. Ce
 * lot vise Ubuntu et Debian, le dit, et renvoie au reste quand il le faut.
 */
const OS_LINUX = [
  'Ubuntu Server 22.04 LTS et 24.04 LTS',
  'Ubuntu Desktop 22.04 et 24.04',
  'Debian 12 (bookworm)',
  'Toute distribution utilisant systemd et APT',
];

const DISTROS = ['Ubuntu 24.04 LTS (cible de référence)', 'Ubuntu 22.04 LTS', 'Debian 12'];

/** Sources communes à toutes les fiches Linux : le socle de trois liens. */
const SOURCES_SOCLE = [
  { label: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/bash.html' },
  { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
  { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
];

/**
 * Le champ « format du rapport », présent sur tous les outils de diagnostic.
 * Console par défaut : écrire un fichier sans qu'on l'ait demandé est une
 * surprise, et une surprise dans le dossier personnel de quelqu'un d'autre
 * est une impolitesse.
 */
const CHAMP_FORMAT = {
  id: 'format',
  label: 'Format du rapport',
  type: 'select',
  default: 'Console',
  options: [['Console', 'Console seulement'], ['JSON', 'Console + fichier JSON'], ['CSV', 'Console + fichier CSV']],
  help: 'Le fichier est écrit dans ton dossier personnel, jamais ailleurs.',
};

/** Validation du champ format, partagée. */
function validerFormat(v, errors) {
  const r = validateChoix(v.format, ['Console', 'JSON', 'CSV'], 'Le format');
  if (!r.ok) errors.format = r.error;
}

// ===========================================================================
// SOUS-RUBRIQUE 1 — DIAGNOSTIC LINUX
// ===========================================================================

const linuxHealthReport = {
  id: 'linux-health-report',
  icon: '△',
  category: CAT,
  subcategory: 'Diagnostic Linux',
  title: 'Rapport général de santé Linux',
  risk: 'diagnostic',
  summary: 'Dresse l’état complet d’une machine Linux : distribution, noyau, charge, mémoire, stockage, réseau, services en échec et erreurs récentes.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['systemd (présent par défaut)', 'procps — pour free et uptime', 'coreutils — pour df'],
  privileges: 'aucun',
  readOnly: true,
  service: null,
  limites: [
    'Ne corrige rien : c’est un constat, pas une réparation.',
    'Les journaux antérieurs au dernier démarrage ne sont lisibles que si la persistance du journal est activée (/var/log/journal).',
    'Sans privilèges, certaines unités et certains journaux restent invisibles : le rapport le signale au lieu de les omettre.',
  ],

  fields: [
    {
      id: 'joursJournal',
      label: 'Profondeur du journal, en jours',
      type: 'number',
      default: '2',
      min: '1',
      max: '30',
      help: 'Les erreurs du journal sont relues sur cette période.',
    },
    {
      id: 'seuilDisque',
      label: 'Seuil d’alerte de remplissage disque, en %',
      type: 'number',
      default: '85',
      min: '50',
      max: '99',
      help: 'Un système de fichiers au-delà de ce taux est signalé.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const j = validateEntierBorne(v.joursJournal, 1, 30, 'La profondeur du journal');
    if (!j.ok) errors.joursJournal = j.error;
    const s = validateEntierBorne(v.seuilDisque, 50, 99, 'Le seuil de remplissage');
    if (!s.ok) errors.seuilDisque = s.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    return assemblerSh([
      ...enteteBash({
        titre: 'Rapport general de sante de la machine Linux',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_JOURS', shQuote(String(v.joursJournal))],
        ['KJEMO_SEUIL', shQuote(String(v.seuilDisque))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Jours de journal', '${KJEMO_JOURS}'],
        ['Seuil disque', '${KJEMO_SEUIL}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# 1. Identite du systeme',
      '# ---------------------------------------------------------------------------',
      "if [ -r /etc/os-release ]; then",
      '  # /etc/os-release est la source documentee du nom de la distribution.',
      '  # On ne le "source" PAS : ce serait executer un fichier pour en lire deux',
      "  # valeurs. On l analyse.",
      "  kjemo_distro=\"$(sed -n 's/^PRETTY_NAME=\"\\{0,1\\}\\(.*\\)\"\\{0,1\\}$/\\1/p' /etc/os-release | head -1)\"",
      "  kjemo_resultat 'Systeme' 'Distribution' 'INFO' \"${kjemo_distro:-inconnue}\" ''",
      'else',
      "  kjemo_resultat 'Systeme' 'Distribution' 'ATTENTION' '' \\",
      "    '/etc/os-release est illisible : distribution non identifiee.'",
      'fi',
      "kjemo_controle 'Systeme' 'Noyau' 'Version du noyau en cours.' uname -r",
      "kjemo_controle 'Systeme' 'Architecture' '' uname -m",
      "if kjemo_dispo hostnamectl; then",
      "  kjemo_controle 'Systeme' 'Identite' '' hostnamectl",
      'fi',
      "if kjemo_dispo systemd-detect-virt; then",
      '  # Savoir si on est dans une machine virtuelle change le diagnostic :',
      "  # une charge d E/S anormale sur un invite peut venir de l hote.",
      "  kjemo_virt=\"$(systemd-detect-virt 2>/dev/null || echo aucune)\"",
      "  kjemo_resultat 'Systeme' 'Virtualisation' 'INFO' \"${kjemo_virt}\" ''",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 2. Demarrage et duree de fonctionnement',
      '# ---------------------------------------------------------------------------',
      "kjemo_controle 'Demarrage' 'Duree de fonctionnement' '' uptime -p",
      "if kjemo_dispo systemd-analyze; then",
      "  kjemo_controle 'Demarrage' 'Duree du dernier demarrage' \\",
      "    'systemd-analyze donne le temps passe dans le noyau puis dans userspace.' \\",
      '    systemd-analyze time',
      'fi',
      "if kjemo_dispo last; then",
      "  kjemo_controle 'Demarrage' 'Derniers demarrages' '' last -n 5 -x reboot",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 3. Charge et memoire',
      '#',
      '# La charge se lit RELATIVEMENT au nombre de coeurs : une charge de 4 est',
      '# normale sur 8 coeurs et critique sur 1. Rapporter la charge brute sans le',
      '# nombre de coeurs ne veut rien dire, et pousse a des conclusions fausses.',
      '# ---------------------------------------------------------------------------',
      "kjemo_coeurs=\"$(nproc 2>/dev/null || echo 1)\"",
      "kjemo_resultat 'Charge' 'Coeurs disponibles' 'INFO' \"${kjemo_coeurs}\" ''",
      'if [ -r /proc/loadavg ]; then',
      "  kjemo_charge1=\"$(cut -d' ' -f1 /proc/loadavg)\"",
      "  kjemo_resultat 'Charge' 'Charge moyenne 1 min' 'INFO' \"${kjemo_charge1}\" \\",
      '    "A comparer aux ${kjemo_coeurs} coeur(s) : une charge egale au nombre de coeurs sature la machine."',
      '  # Comparaison en entiers : la charge est multipliee par 100 pour eviter',
      "  # l arithmetique flottante, que le shell ne sait pas faire.",
      "  kjemo_charge_cent=\"$(printf '%s' \"${kjemo_charge1}\" | tr -d '.' | sed 's/^0*//')\"",
      '  kjemo_charge_cent="${kjemo_charge_cent:-0}"',
      '  kjemo_limite=$(( kjemo_coeurs * 100 ))',
      '  if [ "${kjemo_charge_cent}" -gt "${kjemo_limite}" ]; then',
      "    kjemo_resultat 'Charge' 'Saturation' 'ATTENTION' \"${kjemo_charge1}\" \\",
      '      "Charge superieure au nombre de coeurs (${kjemo_coeurs}) : la machine attend."',
      '  fi',
      'fi',
      "if kjemo_dispo free; then",
      "  kjemo_controle 'Memoire' 'Memoire et swap' '' free -h",
      '  # Un swap qui travaille beaucoup alors que la RAM semble libre est le',
      "  # symptome d une pression passee : l information est utile telle quelle.",
      "  kjemo_swap_utilise=\"$(free -m | awk '/^Swap:/ {print $3}')\"",
      '  if [ -n "${kjemo_swap_utilise:-}" ] && [ "${kjemo_swap_utilise}" -gt 0 ] 2>/dev/null; then',
      "    kjemo_resultat 'Memoire' 'Swap utilise' 'INFO' \"${kjemo_swap_utilise} Mo\" \\",
      "      'Du swap occupe ne signale pas forcement un probleme actuel.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 4. Stockage',
      '# ---------------------------------------------------------------------------',
      '# Seuls les systemes de fichiers REELS sont examines : tmpfs, devtmpfs et',
      '# squashfs sont souvent a 100 % par construction, et les signaler ferait du',
      '# bruit qui masque le vrai disque plein.',
      "kjemo_controle 'Stockage' 'Espace par systeme de fichiers' '' \\",
      '  df -h -x tmpfs -x devtmpfs -x squashfs -x overlay',
      '# IFS=\' \' est LOCAL a ce read, et il est indispensable : l en-tete du',
      '# script fixe IFS au saut de ligne et a la tabulation, pour qu un nom de',
      '# fichier contenant un espace ne soit pas decoupe. Mais du coup read -r a b',
      '# ne decoupe plus sur l espace : la ligne entiere tombe dans $a, la',
      '# comparaison ne compare rien, et le controle passe A VIDE sans erreur.',
      '# Ce defaut a ete trouve en EXECUTANT le script, pas en le relisant.',
      "while IFS=' ' read -r kjemo_pct kjemo_pt; do",
      '  kjemo_pct="${kjemo_pct%\\%}"',
      '  if [ -z "${kjemo_pct}" ] || [ "${kjemo_pct}" = \'Use\' ]; then continue; fi',
      '  if [ "${kjemo_pct}" -ge "${KJEMO_SEUIL}" ] 2>/dev/null; then',
      "    kjemo_resultat 'Stockage' \"Remplissage ${kjemo_pt}\" 'ATTENTION' \"${kjemo_pct}%\" \\",
      '      "Au-dela du seuil de ${KJEMO_SEUIL}% : liberer de la place avant saturation."',
      '  fi',
      "done < <(df -P -x tmpfs -x devtmpfs -x squashfs -x overlay | awk 'NR>1 {print $5, $6}')",
      '# Les inodes : un disque peut etre plein SANS etre plein. Des millions de',
      '# petits fichiers epuisent les inodes alors que df -h montre de la place,',
      "# et l erreur \"No space left on device\" devient incomprehensible.",
      "while IFS=' ' read -r kjemo_ipct kjemo_ipt; do",
      '  kjemo_ipct="${kjemo_ipct%\\%}"',
      '  if [ -z "${kjemo_ipct}" ] || [ "${kjemo_ipct}" = \'IUse\' ]; then continue; fi',
      '  if [ "${kjemo_ipct}" -ge "${KJEMO_SEUIL}" ] 2>/dev/null; then',
      "    kjemo_resultat 'Stockage' \"Inodes ${kjemo_ipt}\" 'ATTENTION' \"${kjemo_ipct}%\" \\",
      "      'Inodes presque epuises : le disque se remplira sans que df -h le montre.'",
      '  fi',
      "done < <(df -P -i -x tmpfs -x devtmpfs -x squashfs -x overlay | awk 'NR>1 {print $5, $6}')",
      '',
      '# ---------------------------------------------------------------------------',
      '# 5. Reseau',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo ip; then',
      "  kjemo_controle 'Reseau' 'Adresses' '' ip -brief address show",
      "  kjemo_controle 'Reseau' 'Routes' 'La route par defaut doit exister pour sortir du reseau local.' \\",
      '    ip route show',
      '  if ! ip route show default | grep -q .; then',
      "    kjemo_resultat 'Reseau' 'Route par defaut' 'PROBLEME' 'absente' \\",
      "      'Sans route par defaut, la machine ne joint rien hors de son reseau local.'",
      '  fi',
      'fi',
      'if kjemo_dispo ss; then',
      "  kjemo_controle 'Reseau' 'Ports en ecoute' '' ss -lntup",
      'fi',
      'if kjemo_dispo resolvectl; then',
      "  kjemo_controle 'Reseau' 'Resolution DNS' '' resolvectl status",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 6. Services en echec',
      '#',
      "# C est le controle le plus rentable du rapport : une unite en echec est",
      '# une panne deja presente que personne ne regarde.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo systemctl; then',
      '  # || true : sous set -e, une affectation depuis $(...) dont la commande',
      '  # echoue fait SORTIR le script. systemctl sort non nul quand il n a rien',
      '  # a lister, et le rapport se terminait donc avant sa conclusion.',
      "  kjemo_echecs=\"$(systemctl list-units --state=failed --no-legend --plain 2>/dev/null | awk '{print $1}' || true)\"",
      '  if [ -n "${kjemo_echecs}" ]; then',
      '    while IFS= read -r kjemo_u; do',
      '      if [ -z "${kjemo_u}" ]; then continue; fi',
      "      kjemo_resultat 'Services' \"${kjemo_u}\" 'PROBLEME' 'failed' \\",
      '        "Unite en echec. Detail : systemctl status ${kjemo_u}"',
      '    done <<< "${kjemo_echecs}"',
      '  else',
      "    kjemo_resultat 'Services' 'Unites en echec' 'OK' 'aucune' ''",
      '  fi',
      "  kjemo_controle 'Services' 'Etat global' '' systemctl is-system-running",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 7. Erreurs recentes du journal',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo journalctl; then',
      '  kjemo_err="${KJEMO_TMP}/journal-err.txt"',
      '  if journalctl --priority=0..3 --since "${KJEMO_JOURS} days ago" --no-pager \\',
      '      > "${kjemo_err}" 2>/dev/null; then',
      '    kjemo_nb_err="$(wc -l < "${kjemo_err}" | tr -d \' \')"',
      '    if [ "${kjemo_nb_err}" -gt 0 ]; then',
      "      kjemo_resultat 'Journal' 'Erreurs et pire' 'ATTENTION' \"${kjemo_nb_err} ligne(s)\" \\",
      '        "Priorites 0 a 3 sur ${KJEMO_JOURS} jour(s). Detail : journalctl -p 3 -S \'${KJEMO_JOURS} days ago\'"',
      '    else',
      "      kjemo_resultat 'Journal' 'Erreurs et pire' 'OK' 'aucune' \\",
      '        "Aucune erreur de priorite 0 a 3 sur ${KJEMO_JOURS} jour(s)."',
      '    fi',
      '  else',
      "    kjemo_resultat 'Journal' 'Lecture du journal' 'IGNORE' '' \\",
      "      'Journal illisible pour cette session : relancer avec sudo pour le voir.'",
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-sante-linux' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine à diagnostiquer.',
    'Tape « hostnamectl » pour voir la distribution, le noyau et le type de virtualisation.',
    'Tape « systemctl --failed » : toute unité listée est une panne déjà présente.',
    'Tape « df -h » pour l’espace disque, puis « df -i » pour les inodes — un disque peut être plein sans être plein.',
    'Tape « journalctl -p 3 -b » pour les erreurs depuis le dernier démarrage.',
    'Tape « ip -brief address » et « ip route » pour l’adressage et la route par défaut.',
  ],

  keywords: ['linux', 'rapport', 'sante', 'diagnostic', 'etat', 'systeme', 'ubuntu', 'debian',
    'charge', 'memoire', 'disque', 'journal', 'services', 'bilan', 'audit', 'inventaire'],

  requiresAdmin: false,
  prereqs: [
    'Un accès terminal à la machine, local ou par SSH.',
    'Aucun privilège root : les éléments inaccessibles sont signalés, pas omis.',
    'Les paquets systemd, procps et coreutils, présents par défaut sur Ubuntu et Debian.',
  ],

  commonErrors: [
    {
      message: 'journalctl: Failed to open files: Permission denied',
      code: 'EACCES',
      cause: 'La session n’appartient ni au groupe systemd-journal ni à adm, et le journal système lui est fermé.',
      fix: 'Relancer avec sudo, ou ajouter l’utilisateur au groupe adm. Le rapport marque le contrôle IGNORE plutôt que de prétendre qu’il n’y a pas d’erreur.',
      command: 'sudo bash linux-health-report.sh',
    },
    {
      message: 'df: /run/user/1000/doc: Permission denied',
      code: 'EACCES',
      cause: 'Un point de montage FUSE appartenant à une autre session. Sans effet sur le diagnostic.',
      fix: 'Ignorer : le script écarte déjà tmpfs, devtmpfs, squashfs et overlay du contrôle de remplissage.',
    },
    {
      message: 'Aucune erreur de priorite 0 a 3, alors que la machine a visiblement planté',
      code: 'KJEMO',
      cause: 'La persistance du journal n’est pas activée : /var/log/journal n’existe pas, et le journal repart à zéro à chaque démarrage.',
      fix: 'Créer /var/log/journal puis redémarrer systemd-journald. Sans cela, aucun diagnostic post-mortem n’est possible.',
      command: 'sudo mkdir -p /var/log/journal && sudo systemctl restart systemd-journald',
    },
    {
      message: 'uptime -p : invalid option',
      code: 'EINVAL',
      cause: 'Une version très ancienne de procps, ou un busybox à la place.',
      fix: 'Utiliser « uptime » sans option, ou lire /proc/uptime directement.',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport se termine par une ligne « Conclusion : ».',
    'Chaque unité en échec apparaît avec l’état PROBLEME et la commande « systemctl status » à lancer.',
    'Si un système de fichiers dépasse le seuil, une ligne ATTENTION le nomme avec son pourcentage.',
    'Si le format JSON ou CSV a été choisi, le fichier existe dans le dossier personnel et la dernière ligne affiche son chemin.',
  ],

  rollback: {
    summary: 'Rien à annuler : ce script ne modifie aucun réglage.',
    steps: [
      'Le script lit le système et écrit, au plus, un fichier de rapport dans ton dossier personnel.',
      'Pour revenir à l’état initial, supprime ce fichier de rapport. Rien d’autre n’a changé.',
      'Aucun service n’a été démarré, arrêté ni reconfiguré.',
    ],
  },

  checks: [
    'Le script ne contient aucune commande de modification : ni systemctl start, ni apt, ni rm sur un chemin du système.',
    'Le dossier temporaire est créé par mktemp et détruit par la trap de sortie, y compris en cas d’interruption.',
    'Aucun mot de passe, jeton ni clé n’est lu ni écrit : le rapport ne contient que des états et des mesures.',
    'Les contrôles dont l’outil est absent sont marqués IGNORE ou ATTENTION, jamais silencieusement sautés.',
  ],

  source: `${M}/man1/systemctl.1.html`,
  sources: [
    { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
    { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
    { label: 'systemd-analyze(1)', url: `${M}/man1/systemd-analyze.1.html` },
    { label: 'df(1)', url: `${M}/man1/df.1.html` },
    { label: 'free(1)', url: `${M}/man1/free.1.html` },
  ],
};

export const toolsLinux = [
  linuxHealthReport,
];

export { CAT, M, OS_LINUX, DISTROS, SOURCES_SOCLE, CHAMP_FORMAT, validerFormat, VERSION_LINUX };
