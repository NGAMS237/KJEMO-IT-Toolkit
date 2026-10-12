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
    summary: 'Rien à annuler : ce script lit le système et ne modifie aucun réglage. Au plus, il écrit un fichier de rapport dans ton dossier personnel, si tu l\u2019as demandé.',
    diagnostic: `# Verifier que rien n a change : aucune unite n a ete touchee par ce script.
systemctl list-units --state=failed --no-legend
# Et la liste des fichiers de rapport eventuellement ecrits :
ls -l "\${HOME}"/kjemo-sante-linux-* 2>/dev/null || echo 'aucun rapport ecrit'`,
    command: `# Rien a annuler : aucune ecriture systeme n a eu lieu.
# Le seul effet possible est un fichier de rapport dans le dossier personnel.
# Pour le supprimer, apres l avoir relu :
#   rm -i "\${HOME}"/kjemo-sante-linux-*.json
#   rm -i "\${HOME}"/kjemo-sante-linux-*.csv
# Le -i demande confirmation fichier par fichier : c est volontaire.
echo 'Diagnostic en lecture seule : aucune modification a defaire.'`,
    warning: 'Ne corrige pas une unité en échec en la masquant avec « systemctl mask » : elle disparaîtra du rapport sans que le problème soit réglé, et le prochain diagnostic sera faussement vert. Et ne libère pas de l\u2019espace disque en supprimant des fichiers de /var/log sans savoir lesquels : la persistance du journal y vit, et c\u2019est elle qui permettra le prochain diagnostic.',
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

const linuxSystemInventory = {
  id: 'linux-system-inventory',
  icon: '△',
  category: CAT,
  subcategory: 'Diagnostic Linux',
  title: 'Inventaire matériel et logiciel',
  risk: 'diagnostic',
  summary: 'Relève le matériel et le logiciel installés : processeur, mémoire, disques, partitions, interfaces réseau, cartes PCI et USB, virtualisation et paquets principaux.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'util-linux — lsblk, lscpu, findmnt (présent par défaut)',
    'pciutils — lspci (à installer : apt install pciutils)',
    'usbutils — lsusb (à installer : apt install usbutils)',
    'dmidecode — informations de la carte mère (à installer, et root pour lire)',
  ],
  privileges: 'aucun pour l’essentiel ; root seulement pour dmidecode',
  readOnly: true,
  service: null,
  limites: [
    'dmidecode exige root : sans privilèges, le numéro de série et le modèle de carte mère restent inaccessibles, et le rapport le dit.',
    'Dans une machine virtuelle, les informations matérielles décrivent le matériel ÉMULÉ, pas l’hôte. Le rapport signale la virtualisation pour qu’on ne s’y trompe pas.',
    'La liste des paquets est limitée aux paquets explicitement installés, pas aux dépendances : une liste complète ferait des milliers de lignes illisibles.',
    'Ne relève ni l’état de santé des disques (voir linux-storage-diagnostic) ni les performances (voir linux-health-report).',
  ],

  fields: [
    {
      id: 'inclurePaquets',
      label: 'Inclure la liste des paquets',
      type: 'select',
      default: 'Principaux',
      options: [['Aucun', 'Non'], ['Principaux', 'Paquets explicitement installés'], ['Tous', 'Tous les paquets installés']],
      help: '« Tous » peut produire plusieurs milliers de lignes.',
    },
    {
      id: 'inclureMateriel',
      label: 'Inclure PCI et USB',
      type: 'select',
      default: 'Oui',
      options: [['Oui', 'Oui'], ['Non', 'Non']],
      help: 'Demande les paquets pciutils et usbutils.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const p = validateChoix(v.inclurePaquets, ['Aucun', 'Principaux', 'Tous'], 'Le choix des paquets');
    if (!p.ok) errors.inclurePaquets = p.error;
    const m = validateChoix(v.inclureMateriel, ['Oui', 'Non'], 'Le choix PCI/USB');
    if (!m.ok) errors.inclureMateriel = m.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    return assemblerSh([
      ...enteteBash({
        titre: 'Inventaire materiel et logiciel de la machine',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_PAQUETS', shQuote(String(v.inclurePaquets))],
        ['KJEMO_MATERIEL', shQuote(String(v.inclureMateriel))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Paquets', '${KJEMO_PAQUETS}'],
        ['PCI et USB', '${KJEMO_MATERIEL}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# 1. Virtualisation EN PREMIER',
      '#',
      '# Ce n est pas un detail de fin de rapport. Dans une machine virtuelle,',
      '# tout ce qui suit decrit le materiel EMULE : le modele de processeur est',
      '# celui que l hyperviseur expose, le disque est un fichier, la carte reseau',
      '# est logicielle. Lire cet inventaire sans savoir qu on est dans une VM',
      '# conduit a des conclusions fausses, et c est pourquoi l information vient',
      '# avant le reste et non apres.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo systemd-detect-virt; then',
      '  kjemo_virt="$(systemd-detect-virt 2>/dev/null || echo none)"',
      '  if [ "${kjemo_virt}" = \'none\' ]; then',
      "    kjemo_resultat 'Virtualisation' 'Type' 'INFO' 'machine physique' \\",
      "      'Le materiel decrit ci-dessous est reel.'",
      '  else',
      "    kjemo_resultat 'Virtualisation' 'Type' 'INFO' \"${kjemo_virt}\" \\",
      "      'ATTENTION a la lecture : le materiel decrit ci-dessous est EMULE par l hyperviseur, pas physique.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 2. Processeur et memoire',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo lscpu; then',
      "  kjemo_controle 'Processeur' 'Description' '' lscpu",
      'else',
      "  kjemo_controle 'Processeur' 'Description (repli /proc)' '' cat /proc/cpuinfo",
      'fi',
      'if kjemo_dispo free; then',
      "  kjemo_controle 'Memoire' 'Capacite installee' '' free -h --total",
      'fi',
      '# Les barrettes reellement presentes : utile pour savoir s il reste un slot',
      '# libre avant de commander de la memoire. Exige root, et le dit.',
      'if kjemo_dispo dmidecode; then',
      '  if [ "${KJEMO_ROOT}" -eq 1 ]; then',
      "    kjemo_controle 'Memoire' 'Barrettes installees' '' dmidecode -t memory",
      "    kjemo_controle 'Carte mere' 'Modele et serie' '' dmidecode -t system -t baseboard",
      '  else',
      "    kjemo_resultat 'Carte mere' 'Modele et serie' 'IGNORE' '' \\",
      "      'dmidecode exige root : relance avec sudo pour le modele et le numero de serie.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Carte mere' 'Modele et serie' 'IGNORE' '' \\",
      "    'dmidecode absent : apt install dmidecode (puis relancer avec sudo).'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 3. Disques, partitions et montages',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo lsblk; then',
      "  kjemo_controle 'Stockage' 'Peripheriques et partitions' \\",
      "    'Taille, type, point de montage et systeme de fichiers de chaque partition.' \\",
      '    lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,UUID',
      'fi',
      'if kjemo_dispo findmnt; then',
      "  kjemo_controle 'Stockage' 'Montages reels' \\",
      "    'findmnt montre l arborescence des montages telle que le noyau la voit.' \\",
      '    findmnt --real',
      'fi',
      "kjemo_controle 'Stockage' 'Espace disponible' '' df -h -x tmpfs -x devtmpfs -x squashfs",
      '',
      '# ---------------------------------------------------------------------------',
      '# 4. Reseau',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo ip; then',
      "  kjemo_controle 'Reseau' 'Interfaces' '' ip -brief link show",
      "  kjemo_controle 'Reseau' 'Adresses' '' ip -brief address show",
      'fi',
      '# L adresse MAC et le pilote de chaque carte : c est ce qu on cherche quand',
      '# une interface ne remonte pas apres une mise a jour du noyau.',
      'for kjemo_if in /sys/class/net/*; do',
      '  if [ ! -e "${kjemo_if}" ]; then continue; fi',
      '  kjemo_nom="$(basename "${kjemo_if}")"',
      '  if [ "${kjemo_nom}" = \'lo\' ]; then continue; fi',
      '  kjemo_mac=\'inconnue\'',
      '  if [ -r "${kjemo_if}/address" ]; then kjemo_mac="$(cat "${kjemo_if}/address")"; fi',
      '  kjemo_pilote=\'inconnu\'',
      '  if [ -L "${kjemo_if}/device/driver" ]; then',
      '    kjemo_pilote="$(basename "$(readlink -f "${kjemo_if}/device/driver")")"',
      '  fi',
      "  kjemo_resultat 'Reseau' \"Carte ${kjemo_nom}\" 'INFO' \"MAC ${kjemo_mac}\" \\",
      '    "Pilote : ${kjemo_pilote}"',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# 5. PCI et USB',
      '# ---------------------------------------------------------------------------',
      "if [ \"${KJEMO_MATERIEL}\" = 'Oui' ]; then",
      '  if kjemo_dispo lspci; then',
      "    kjemo_controle 'Materiel' 'Peripheriques PCI' '' lspci",
      '  else',
      "    kjemo_resultat 'Materiel' 'Peripheriques PCI' 'IGNORE' '' \\",
      "      'lspci absent : apt install pciutils.'",
      '  fi',
      '  if kjemo_dispo lsusb; then',
      "    kjemo_controle 'Materiel' 'Peripheriques USB' '' lsusb",
      '  else',
      "    kjemo_resultat 'Materiel' 'Peripheriques USB' 'IGNORE' '' \\",
      "      'lsusb absent : apt install usbutils.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 6. Paquets',
      '# ---------------------------------------------------------------------------',
      "if [ \"${KJEMO_PAQUETS}\" != 'Aucun' ]; then",
      '  if kjemo_dispo dpkg-query; then',
      "    if [ \"${KJEMO_PAQUETS}\" = 'Tous' ]; then",
      '      # shellcheck disable=SC2016',
      '      kjemo_nb="$(dpkg-query -f \'${binary:Package}\\n\' -W 2>/dev/null | wc -l | tr -d \' \' || true)"',
      "      kjemo_resultat 'Paquets' 'Nombre installe' 'INFO' \"${kjemo_nb:-0}\" \\",
      "        'Liste complete dans le rapport JSON ou CSV.'",
      '      # shellcheck disable=SC2016',
      '      # Les apostrophes simples sont VOULUES : ${binary:Package} et',
      '      # ${Version} sont des champs de format de dpkg-query, pas des',
      '      # variables du shell. Les mettre entre guillemets doubles les ferait',
      '      # developper par bash en chaines vides, et dpkg-query recevrait un',
      '      # format vide. ShellCheck ne peut pas le savoir, donc on le lui dit',
      '      # ici plutot que de desactiver SC2016 pour tout le depot.',
      "      kjemo_controle 'Paquets' 'Liste complete' '' \\",
      "        dpkg-query -f '${binary:Package} ${Version}\\n' -W",
      '    else',
      '      # Explicitement installe : ce que quelqu un a demande, par',
      '      # opposition aux dependances tirees automatiquement. C est la seule',
      '      # liste qui dit quelque chose sur l intention d un administrateur.',
      '      if kjemo_dispo apt-mark; then',
      "        kjemo_controle 'Paquets' 'Explicitement installes' \\",
      "          'Les paquets demandes, hors dependances automatiques.' \\",
      '          apt-mark showmanual',
      '      else',
      '        # shellcheck disable=SC2016',
      '        # Meme raison : champ de format dpkg, pas variable shell.',
      "        kjemo_controle 'Paquets' 'Installes' '' \\",
      "          dpkg-query -f '${binary:Package}\\n' -W",
      '      fi',
      '    fi',
      '  else',
      "    kjemo_resultat 'Paquets' 'Inventaire' 'IGNORE' '' \\",
      "      'dpkg-query absent : cette machine n utilise pas APT.'",
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-inventaire-linux' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine à inventorier.',
    'Tape « systemd-detect-virt » : si la réponse n’est pas « none », tout le matériel qui suit est émulé.',
    'Tape « lscpu » pour le processeur et « free -h » pour la mémoire.',
    'Tape « lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT » pour les disques et partitions.',
    'Tape « ip -brief link » pour les interfaces réseau.',
    'Tape « sudo dmidecode -t system » pour le modèle et le numéro de série — root est obligatoire ici.',
    'Tape « apt-mark showmanual » pour les paquets que quelqu’un a réellement demandés.',
  ],

  keywords: ['inventaire', 'materiel', 'linux', 'processeur', 'memoire', 'disque', 'partition',
    'pci', 'usb', 'paquets', 'lscpu', 'lsblk', 'dmidecode', 'virtualisation', 'cmdb', 'parc'],

  requiresAdmin: false,
  prereqs: [
    'Un accès terminal, local ou par SSH.',
    'util-linux, présent par défaut, pour lscpu, lsblk et findmnt.',
    'Facultatif : pciutils, usbutils et dmidecode pour l’inventaire matériel complet.',
    'Les privilèges root seulement si tu veux le modèle de carte mère et le numéro de série.',
  ],

  commonErrors: [
    {
      message: 'dmidecode: /sys/firmware/dmi/tables/smbios_entry_point: Permission denied',
      code: 'EACCES',
      cause: 'dmidecode lit des tables firmware réservées à root.',
      fix: 'Relancer avec sudo. Sans privilèges, le rapport marque le contrôle IGNORE au lieu de prétendre que l’information n’existe pas.',
      command: 'sudo bash linux-system-inventory.sh',
    },
    {
      message: 'lspci: command not found',
      code: 'ENOENT',
      cause: 'Le paquet pciutils n’est pas installé — fréquent sur une image serveur minimale.',
      fix: 'Installer pciutils, ou laisser le contrôle à IGNORE : le script continue sans s’arrêter.',
      command: 'sudo apt install pciutils usbutils',
    },
    {
      message: 'Le processeur affiché ne correspond pas au matériel commandé',
      code: 'KJEMO',
      cause: 'La machine est virtuelle : l’hyperviseur expose un modèle de processeur générique ou masqué.',
      fix: 'Lire la ligne « Virtualisation / Type » en tête de rapport. L’inventaire d’un invité ne décrit jamais l’hôte.',
    },
    {
      message: 'La liste « Tous » des paquets rend le rapport illisible',
      code: 'KJEMO',
      cause: 'Une Ubuntu Server installe facilement plus de 600 paquets, dépendances comprises.',
      fix: 'Choisir « Principaux » : apt-mark showmanual ne montre que ce qu’un administrateur a demandé.',
    },
  ],

  reversible: true,
  verifyAfter: [
    'La première ligne de résultat concerne la virtualisation : elle dit si le matériel décrit est réel ou émulé.',
    'Chaque outil absent apparaît en IGNORE avec le paquet à installer, et non comme une absence d’information.',
    'Chaque carte réseau non-loopback apparaît avec son adresse MAC et son pilote.',
    'Si le format JSON ou CSV a été choisi, le fichier existe et son chemin est affiché en dernière ligne.',
  ],

  rollback: {
    summary: 'Rien à annuler : ce script relève le matériel et les paquets installés. Il n\u2019installe rien, ne configure rien, et au plus écrit un fichier de rapport dans ton dossier personnel.',
    diagnostic: `# Verifier qu aucun paquet n a ete installe par ce script :
# la date du dernier changement de dpkg doit etre ANTERIEURE a l execution.
ls -l --time-style=full-iso /var/lib/dpkg/status | awk '{print $6, $7}'
tail -5 /var/log/dpkg.log 2>/dev/null || echo 'journal dpkg illisible sans privileges'`,
    command: `# Rien a annuler : ce script n installe aucun paquet.
# Si TU as installe pciutils, usbutils ou dmidecode pour completer
# l inventaire, ce sont des installations volontaires, a retirer ainsi :
#   sudo apt remove pciutils usbutils dmidecode
# Et pour supprimer un rapport, apres l avoir relu :
#   rm -i "\${HOME}"/kjemo-inventaire-linux-*
echo 'Inventaire en lecture seule : aucune modification a defaire.'`,
    warning: 'Un inventaire contient le modèle de la machine et son numéro de série : ne le publie pas tel quel dans un ticket public ou un dépôt partagé. Et souviens-toi que dans une machine virtuelle, le matériel décrit est celui que l\u2019hyperviseur expose, pas le matériel réel de l\u2019hôte.',
  },

  checks: [
    'Aucune commande d’installation n’est exécutée : les paquets manquants sont signalés, jamais installés automatiquement.',
    'Le script ne lit aucun fichier de /etc contenant des secrets : ni shadow, ni clé SSH, ni jeton.',
    'dmidecode n’est appelé que si les privilèges sont présents, et son absence est signalée au lieu de faire échouer le script.',
    'Le dossier temporaire est détruit par la trap de sortie, y compris en cas d’interruption.',
  ],

  source: `${M}/man8/lsblk.8.html`,
  sources: [
    { label: 'lsblk(8)', url: `${M}/man8/lsblk.8.html` },
    { label: 'lscpu(1)', url: `${M}/man1/lscpu.1.html` },
    { label: 'dmidecode(8)', url: `${M}/man8/dmidecode.8.html` },
    { label: 'findmnt(8)', url: `${M}/man8/findmnt.8.html` },
    { label: 'systemd-detect-virt(1)', url: `${M}/man1/systemd-detect-virt.1.html` },
    { label: 'dpkg-query(1)', url: `${M}/man1/dpkg-query.1.html` },
  ],
};

const linuxBootDiagnostic = {
  id: 'linux-boot-diagnostic',
  icon: '△',
  category: CAT,
  subcategory: 'Diagnostic Linux',
  title: 'Diagnostic d’un démarrage lent',
  risk: 'diagnostic',
  summary: 'Analyse la durée du démarrage avec systemd-analyze, classe les unités les plus lentes, relit le journal du dernier démarrage et liste les unités en échec.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['systemd (présent par défaut)'],
  privileges: 'aucun',
  readOnly: true,
  service: null,
  limites: [
    'Mesure le démarrage de systemd, pas celui du micrologiciel ni de GRUB : le temps passé avant le noyau n’est pas visible ici.',
    'Ne désactive aucune unité. Désactiver un service pour gagner deux secondes au démarrage se paie souvent ailleurs.',
    'Les unités « lentes » listées peuvent être lentes à juste titre : un service qui attend le réseau attend légitimement.',
    'Sans persistance du journal, seul le démarrage en cours est lisible.',
  ],

  fields: [
    {
      id: 'nbUnites',
      label: 'Nombre d’unités lentes à lister',
      type: 'number',
      default: '15',
      min: '5',
      max: '50',
      help: 'systemd-analyze blame, tronqué à ce nombre.',
    },
    {
      id: 'inclureChaine',
      label: 'Inclure la chaîne critique',
      type: 'select',
      default: 'Oui',
      options: [['Oui', 'Oui'], ['Non', 'Non']],
      help: 'La chaîne critique montre ce qui retarde réellement la cible atteinte.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const n = validateEntierBorne(v.nbUnites, 5, 50, 'Le nombre d’unités');
    if (!n.ok) errors.nbUnites = n.error;
    const c = validateChoix(v.inclureChaine, ['Oui', 'Non'], 'Le choix de la chaîne critique');
    if (!c.ok) errors.inclureChaine = c.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostic du demarrage : duree, unites lentes, unites en echec',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_NB', shQuote(String(v.nbUnites))],
        ['KJEMO_CHAINE', shQuote(String(v.inclureChaine))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Unites listees', '${KJEMO_NB}'],
        ['Chaine critique', '${KJEMO_CHAINE}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      'if ! kjemo_dispo systemd-analyze; then',
      "  kjemo_resultat 'Demarrage' 'systemd-analyze' 'PROBLEME' 'absent' \\",
      "    'Cette machine n utilise pas systemd : ce diagnostic ne s applique pas.'",
      '  KJEMO_FORMAT=\'Console\'',
      'else',
      '',
      '# ---------------------------------------------------------------------------',
      '# 1. Duree totale, decomposee',
      '#',
      '# systemd-analyze time separe le temps du NOYAU et celui de l espace',
      '# utilisateur. La distinction compte : un noyau lent pointe vers le',
      '# materiel, les pilotes ou le micrologiciel ; un userspace lent pointe vers',
      '# les services, et c est la seule moitie sur laquelle ce diagnostic peut',
      '# dire quelque chose.',
      '# ---------------------------------------------------------------------------',
      "  kjemo_controle 'Demarrage' 'Duree totale' \\",
      "    'Le temps noyau pointe vers le materiel ; le temps userspace vers les services.' \\",
      '    systemd-analyze time',
      '',
      '# ---------------------------------------------------------------------------',
      '# 2. Les unites les plus lentes',
      '#',
      '# blame trie par duree d initialisation. Attention a la lecture : une',
      '# unite lente n est pas forcement coupable. Un service qui attend le reseau',
      '# attend legitimement, et le desactiver ne ferait que deplacer l attente.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_blame="${KJEMO_TMP}/blame.txt"',
      '  if systemd-analyze blame --no-pager > "${kjemo_blame}" 2>/dev/null; then',
      '    kjemo_tete="$(head -n "${KJEMO_NB}" "${kjemo_blame}")"',
      "    kjemo_resultat 'Demarrage' \"Les ${KJEMO_NB} unites les plus lentes\" 'INFO' \\",
      '      "${kjemo_tete}" \\',
      "      'Une unite lente peut etre lente a juste titre : ne desactive rien sans comprendre ce qu elle fait.'",
      '  else',
      "    kjemo_resultat 'Demarrage' 'Unites lentes' 'IGNORE' '' \\",
      "      'systemd-analyze blame indisponible sur ce systeme.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 3. La chaine critique',
      '#',
      '# C est l information la plus utile, et la moins connue. blame liste ce',
      '# qui est long ; critical-chain liste ce qui RETARDE la suite. Un',
      '# service long mais parallele ne retarde personne ; un service court mais',
      '# place sur le chemin critique retarde tout.',
      '# ---------------------------------------------------------------------------',
      "  if [ \"${KJEMO_CHAINE}\" = 'Oui' ]; then",
      "    kjemo_controle 'Demarrage' 'Chaine critique' \\",
      "      'Ce qui RETARDE la suite, par opposition a ce qui est simplement long.' \\",
      '      systemd-analyze critical-chain --no-pager',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 4. Unites en echec et unites bloquees',
      '# ---------------------------------------------------------------------------',
      "  kjemo_echecs=\"$(systemctl list-units --state=failed --no-legend --plain 2>/dev/null | awk '{print $1}' || true)\"",
      '  if [ -n "${kjemo_echecs}" ]; then',
      '    while IFS= read -r kjemo_u; do',
      '      if [ -z "${kjemo_u}" ]; then continue; fi',
      "      kjemo_resultat 'Unites' \"${kjemo_u}\" 'PROBLEME' 'failed' \\",
      '        "Unite en echec au demarrage. Detail : systemctl status ${kjemo_u}"',
      '    done <<< "${kjemo_echecs}"',
      '  else',
      "    kjemo_resultat 'Unites' 'Unites en echec' 'OK' 'aucune' ''",
      '  fi',
      '  # Une unite activating longtemps apres le demarrage est bloquee : elle',
      '  # attend quelque chose qui ne viendra pas, et elle retient souvent une',
      '  # cible entiere derriere elle.',
      "  kjemo_bloquees=\"$(systemctl list-units --state=activating --no-legend --plain 2>/dev/null | awk '{print $1}' || true)\"",
      '  if [ -n "${kjemo_bloquees}" ]; then',
      '    while IFS= read -r kjemo_b; do',
      '      if [ -z "${kjemo_b}" ]; then continue; fi',
      "      kjemo_resultat 'Unites' \"${kjemo_b}\" 'ATTENTION' 'activating' \\",
      "        'Encore en cours d activation : elle attend quelque chose, et retient peut-etre une cible entiere.'",
      '    done <<< "${kjemo_bloquees}"',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 5. Le journal du dernier demarrage',
      '# ---------------------------------------------------------------------------',
      '  if kjemo_dispo journalctl; then',
      '    kjemo_jb="${KJEMO_TMP}/journal-boot.txt"',
      '    if journalctl -b --priority=0..3 --no-pager > "${kjemo_jb}" 2>/dev/null; then',
      "      kjemo_nb_jb=\"$(wc -l < \"${kjemo_jb}\" | tr -d ' ')\"",
      '      if [ "${kjemo_nb_jb}" -gt 0 ]; then',
      "        kjemo_resultat 'Journal' 'Erreurs du dernier demarrage' 'ATTENTION' \\",
      '          "$(head -n 25 "${kjemo_jb}")" \\',
      '          "${kjemo_nb_jb} ligne(s) de priorite 0 a 3. Detail : journalctl -b -p 3"',
      '      else',
      "        kjemo_resultat 'Journal' 'Erreurs du dernier demarrage' 'OK' 'aucune' ''",
      '      fi',
      '    else',
      "      kjemo_resultat 'Journal' 'Lecture du journal' 'IGNORE' '' \\",
      "        'Journal illisible pour cette session : relance avec sudo.'",
      '    fi',
      '    # La persistance : sans elle, aucun diagnostic post-mortem n est',
      '    # possible, et c est la premiere chose a corriger sur un serveur.',
      '    if [ -d /var/log/journal ]; then',
      "      kjemo_resultat 'Journal' 'Persistance' 'OK' '/var/log/journal present' \\",
      "        'Les journaux survivent au redemarrage : un diagnostic post-mortem est possible.'",
      '    else',
      "      kjemo_resultat 'Journal' 'Persistance' 'ATTENTION' 'absente' \\",
      "      'Le journal repart a zero a chaque demarrage. Apres un plantage, il ne restera rien a lire.'",
      '    fi',
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-demarrage-linux' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine qui démarre lentement.',
    'Tape « systemd-analyze time » : note la part du noyau et celle de l’espace utilisateur.',
    'Tape « systemd-analyze blame | head -20 » pour les unités les plus longues.',
    'Tape « systemd-analyze critical-chain » : c’est ce qui RETARDE la suite, et non simplement ce qui est long.',
    'Tape « systemctl --failed » pour les unités en échec.',
    'Tape « journalctl -b -p 3 » pour les erreurs du démarrage en cours.',
  ],

  keywords: ['demarrage', 'lent', 'boot', 'systemd', 'analyze', 'blame', 'chaine critique',
    'linux', 'journal', 'unite', 'echec', 'lenteur', 'diagnostic', 'temps', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Une machine utilisant systemd : Ubuntu, Debian 12, et la plupart des distributions actuelles.',
    'Un accès terminal, local ou par SSH.',
    'Aucun privilège root ; sans sudo, certaines lignes de journal restent invisibles et le rapport le signale.',
  ],

  commonErrors: [
    {
      message: 'Bootup is not yet finished. Please try again later.',
      code: 'KJEMO',
      cause: 'systemd-analyze refuse de mesurer un démarrage encore en cours. Une unité « activating » bloque la cible.',
      fix: 'Attendre, puis relancer. Si le message persiste, la section « Unites bloquees » de ce rapport nomme l’unité qui retient le démarrage.',
      command: 'systemctl list-units --state=activating',
    },
    {
      message: 'Failed to get boot times: Operation not supported',
      code: 'ENOTSUP',
      cause: 'La machine est dans un conteneur : il n’y a pas de démarrage de noyau à mesurer.',
      fix: 'Ce diagnostic ne s’applique pas à un conteneur. Mesurer le démarrage de l’hôte à la place.',
    },
    {
      message: 'Specifying boot ID or boot offset has no effect, no persistent journal was found',
      code: 'KJEMO',
      cause: 'La persistance du journal est désactivée : /var/log/journal n’existe pas.',
      fix: 'Créer le dossier et redémarrer journald. Le rapport signale déjà cette absence, car elle rend tout diagnostic post-mortem impossible.',
      command: 'sudo mkdir -p /var/log/journal && sudo systemctl restart systemd-journald',
    },
    {
      message: 'Une unité apparaît lente, je l’ai désactivée, et maintenant un service ne démarre plus',
      code: 'KJEMO',
      cause: 'Une unité lente n’est pas une unité inutile. Celle-ci était une dépendance.',
      fix: 'Réactiver l’unité. Ce diagnostic ne désactive jamais rien, précisément pour cette raison : lire « blame » comme une liste de choses à supprimer est l’erreur la plus coûteuse du sujet.',
      command: 'sudo systemctl enable --now nom-de-l-unite',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport donne une durée totale séparant le temps noyau du temps espace utilisateur.',
    'La liste des unités lentes est présente, tronquée au nombre demandé, avec l’avertissement qu’une unité lente n’est pas forcément coupable.',
    'Toute unité en échec apparaît en PROBLEME avec la commande « systemctl status » à lancer.',
    'L’état de la persistance du journal est indiqué : OK si /var/log/journal existe, ATTENTION sinon.',
  ],

  rollback: {
    summary: 'Rien à annuler : ce script mesure le démarrage et lit les journaux. Aucune unité n\u2019est activée, désactivée, masquée, démarrée ni arrêtée.',
    diagnostic: `# Verifier qu aucune unite n a change d etat d activation :
systemctl list-unit-files --state=disabled --no-legend | head -20
systemctl list-unit-files --state=masked --no-legend | head -20
# Une unite MASQUEE que tu n as pas masquee toi-meme est a examiner.`,
    command: `# Rien a annuler : aucune commande modifiant une unite n est executee
# par ce script. Ni enable, ni disable, ni mask, ni start, ni stop.
#
# Si tu as desactive une unite apres avoir lu ce rapport et que quelque
# chose ne demarre plus, remets-la en service :
#   sudo systemctl enable --now nom-de-l-unite
# Et si tu l avais masquee :
#   sudo systemctl unmask nom-de-l-unite
echo 'Diagnostic en lecture seule : aucune modification a defaire.'`,
    warning: 'Ne lis jamais « systemd-analyze blame » comme une liste de services à supprimer. Une unité lente est souvent lente à juste titre — un service qui attend le réseau attend légitimement — et la désactiver déplace l\u2019attente au lieu de la supprimer. C\u2019est l\u2019erreur la plus coûteuse de ce sujet, et la raison pour laquelle cet assistant ne désactive rien.',
  },

  checks: [
    'Le script ne contient ni « systemctl disable », ni « systemctl mask », ni aucune commande modifiant une unité.',
    'Les unités lentes sont présentées avec un avertissement explicite contre la désactivation hâtive.',
    'L’absence de systemd est traitée comme un PROBLEME explicite, et non comme un script qui échoue.',
    'Le dossier temporaire est détruit par la trap de sortie, y compris en cas d’interruption.',
  ],

  source: `${M}/man1/systemd-analyze.1.html`,
  sources: [
    { label: 'systemd-analyze(1)', url: `${M}/man1/systemd-analyze.1.html` },
    { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
    { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
    { label: 'systemd.unit(5)', url: `${M}/man5/systemd.unit.5.html` },
  ],
};

const linuxLogDiagnostic = {
  id: 'linux-log-diagnostic',
  icon: '△',
  category: CAT,
  subcategory: 'Diagnostic Linux',
  title: 'Recherche guidée dans les journaux',
  risk: 'diagnostic',
  summary: 'Interroge journalctl de façon ciblée : par service, par priorité, par période ou par démarrage, et explique comment resserrer la recherche quand le résultat est trop large.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['systemd (présent par défaut)'],
  privileges: 'aucun, mais le journal système complet demande l\u2019appartenance au groupe adm ou systemd-journal',
  readOnly: true,
  service: 'systemd-journald.service',
  limites: [
    'Ne lit que le journal de systemd. Les fichiers de /var/log écrits directement par une application — un journal applicatif, un log Apache en fichier — ne sont pas couverts.',
    'Sans persistance du journal, aucun démarrage antérieur n\u2019est lisible : l\u2019option « démarrage précédent » échouera et le rapport le dira.',
    'Ne supprime ni ne fait tourner aucun journal : « journalctl --vacuum » n\u2019apparaît nulle part dans ce script.',
    'Un utilisateur sans privilèges ne voit que ses propres journaux : le rapport le signale plutôt que de conclure à l\u2019absence d\u2019erreurs.',
  ],

  fields: [
    {
      id: 'unite',
      label: 'Service à examiner',
      default: '',
      // Déclaré optionnel, et c'est un choix de conception : interroger TOUT le
      // système est le cas le plus fréquent quand on cherche d'où vient une
      // panne, donc le vide doit être la valeur par défaut et non une erreur.
      optionnel: true,
      help: 'Nom d\u2019unité systemd, par exemple ssh.service. Laisse vide pour interroger tout le système : c\u2019est le cas le plus courant quand on ne sait pas encore d\u2019où vient la panne.',
    },
    {
      id: 'priorite',
      label: 'Priorité minimale',
      type: 'select',
      default: 'err',
      options: [
        ['emerg', 'emerg — système inutilisable'],
        ['alert', 'alert — action immédiate'],
        ['crit', 'crit — critique'],
        ['err', 'err — erreurs (recommandé)'],
        ['warning', 'warning — avertissements et pire'],
        ['notice', 'notice — tout ce qui est notable'],
        ['info', 'info — très verbeux'],
      ],
      help: 'journalctl inclut toujours les priorités PLUS graves que celle choisie.',
    },
    {
      id: 'periode',
      label: 'Période',
      type: 'select',
      default: '1 day ago',
      options: [
        ['15 min ago', 'Les 15 dernières minutes'],
        ['1 hour ago', 'La dernière heure'],
        ['6 hours ago', 'Les 6 dernières heures'],
        ['1 day ago', 'Les 24 dernières heures'],
        ['2 days ago', 'Les 2 derniers jours'],
        ['7 days ago', 'La dernière semaine'],
        ['30 days ago', 'Le dernier mois'],
      ],
      help: 'Ignorée si tu choisis un démarrage précis ci-dessous.',
    },
    {
      id: 'demarrage',
      label: 'Limiter à un démarrage',
      type: 'select',
      default: 'Periode',
      options: [
        ['Periode', 'Non — utiliser la période ci-dessus'],
        ['Actuel', 'Le démarrage en cours'],
        ['Precedent', 'Le démarrage précédent (demande la persistance)'],
      ],
      help: 'Pour un plantage, le démarrage précédent est souvent le bon choix.',
    },
    {
      id: 'motif',
      label: 'Filtrer sur un texte',
      default: '',
      help: 'Facultatif. Recherche littérale, sans expression régulière.',
    },
    {
      id: 'lignes',
      label: 'Nombre de lignes à afficher',
      type: 'number',
      default: '80',
      min: '10',
      max: '2000',
      help: 'Les plus récentes.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    // L'unite est facultative, mais si elle est fournie elle doit etre valide :
    // un nom d'unite fantaisiste donne un resultat VIDE, qui ressemble a
    // « aucune erreur » et c'est la pire reponse possible a un diagnostic.
    const u = String(v.unite ?? '').trim();
    if (u) {
      const r = validateNomUnite(u, 'Le service');
      if (!r.ok) errors.unite = r.error;
    }
    const p = validateChoix(v.priorite,
      ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info'], 'La priorité');
    if (!p.ok) errors.priorite = p.error;
    const per = validateDureeJournal(v.periode, 'La période');
    if (!per.ok) errors.periode = per.error;
    const d = validateChoix(v.demarrage, ['Periode', 'Actuel', 'Precedent'], 'Le choix du démarrage');
    if (!d.ok) errors.demarrage = d.error;
    const m = String(v.motif ?? '');
    if (/[\n\r]/.test(m)) errors.motif = 'Le filtre ne peut pas contenir de retour à la ligne.';
    if (m.length > 200) errors.motif = 'Le filtre dépasse 200 caractères.';
    const l = validateEntierBorne(v.lignes, 10, 2000, 'Le nombre de lignes');
    if (!l.ok) errors.lignes = l.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const unite = String(v.unite ?? '').trim();
    const motif = String(v.motif ?? '');
    return assemblerSh([
      ...enteteBash({
        titre: 'Recherche guidee dans les journaux systemd',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_UNITE', shQuote(unite)],
        ['KJEMO_PRIORITE', shQuote(String(v.priorite))],
        ['KJEMO_PERIODE', shQuote(String(v.periode))],
        ['KJEMO_DEMARRAGE', shQuote(String(v.demarrage))],
        ['KJEMO_MOTIF', shQuote(motif)],
        ['KJEMO_LIGNES', shQuote(String(v.lignes))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Service', '${KJEMO_UNITE:-tout le systeme}'],
        ['Priorite', '${KJEMO_PRIORITE}'],
        ['Periode', '${KJEMO_PERIODE}'],
        ['Demarrage', '${KJEMO_DEMARRAGE}'],
        ['Filtre texte', '${KJEMO_MOTIF:-aucun}'],
        ['Lignes', '${KJEMO_LIGNES}'],
      ]),

      'if ! kjemo_dispo journalctl; then',
      "  kjemo_resultat 'Journal' 'journalctl' 'PROBLEME' 'absent' \\",
      "    'Cette machine n utilise pas systemd-journald : regarde directement dans /var/log.'",
      'else',
      '',
      '# ---------------------------------------------------------------------------',
      '# 1. Verifier d abord ce que cette session a le droit de LIRE',
      '#',
      '# C est le controle le plus important du script, et il vient en premier.',
      '# Un utilisateur hors des groupes adm et systemd-journal ne voit que SES',
      '# propres journaux. Sa recherche renvoie alors zero ligne, ce qui ressemble',
      '# exactement a une absence d erreur, et conduit a chercher ailleurs',
      '# pendant une heure. Mieux vaut le dire tout de suite.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_acces=\'complet\'',
      '  if ! journalctl -n 1 --no-pager >/dev/null 2>&1; then',
      '    kjemo_acces=\'refuse\'',
      "    kjemo_resultat 'Acces' 'Lecture du journal' 'PROBLEME' 'refusee' \\",
      "      'Cette session ne peut pas lire le journal systeme. Un resultat VIDE ne voudra donc pas dire quil ny a aucune erreur. Relance avec sudo.'",
      '  elif [ "${KJEMO_ROOT}" -eq 0 ] && ! id -nG | tr \' \' \'\\n\' | grep -qx -e adm -e systemd-journal; then',
      '    kjemo_acces=\'partiel\'',
      "    kjemo_resultat 'Acces' 'Lecture du journal' 'ATTENTION' 'partielle' \\",
      "      'Session hors des groupes adm et systemd-journal : tu ne vois que tes propres journaux. Un resultat vide ne prouve rien. Relance avec sudo.'",
      '  else',
      "    kjemo_resultat 'Acces' 'Lecture du journal' 'OK' 'complet' ''",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 2. Si un service a ete nomme, verifier qu il EXISTE',
      '#',
      '# Meme raison : journalctl -u sshd.service sur Ubuntu, ou l unite',
      '# s appelle ssh.service, renvoie zero ligne sans la moindre erreur. Le',
      '# resultat vide est alors un piege, et la faute de frappe est invisible.',
      '# ---------------------------------------------------------------------------',
      '  if [ -n "${KJEMO_UNITE}" ]; then',
      '    if systemctl list-unit-files --no-legend --plain 2>/dev/null \\',
      '        | awk \'{print $1}\' | grep -qx -- "${KJEMO_UNITE}"; then',
      "      kjemo_resultat 'Service' \"${KJEMO_UNITE}\" 'OK' 'unite connue' ''",
      '    elif systemctl list-unit-files --no-legend --plain 2>/dev/null \\',
      '        | awk \'{print $1}\' | grep -qx -- "${KJEMO_UNITE}.service"; then',
      "      kjemo_resultat 'Service' \"${KJEMO_UNITE}\" 'OK' 'unite connue (.service implicite)' ''",
      '    else',
      "      kjemo_resultat 'Service' \"${KJEMO_UNITE}\" 'ATTENTION' 'inconnue' \\",
      "        'Aucune unite de ce nom. Un resultat vide viendra du NOM, pas de l absence d erreurs. Verifie avec : systemctl list-unit-files | grep -i un-morceau-du-nom'",
      '    fi',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 3. La requete',
      '#',
      '# Les options sont accumulees dans un TABLEAU, pas dans une chaine. Une',
      '# chaine d options devrait etre re-decoupee par le shell pour redevenir des',
      '# arguments, et ce decoupage casse des qu une valeur contient un espace :',
      '# 1 day ago en contient deux. Le tableau conserve chaque argument tel',
      '# quel, et c est aussi ce qui rend le filtre texte inoffensif.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_args=(--no-pager --priority="${KJEMO_PRIORITE}" --lines="${KJEMO_LIGNES}")',
      '  if [ -n "${KJEMO_UNITE}" ]; then',
      '    kjemo_args+=(--unit="${KJEMO_UNITE}")',
      '  fi',
      "  case \"${KJEMO_DEMARRAGE}\" in",
      "    Actuel)     kjemo_args+=(--boot=0) ;;",
      "    Precedent)  kjemo_args+=(--boot=-1) ;;",
      '    *)          kjemo_args+=(--since="${KJEMO_PERIODE}") ;;',
      '  esac',
      '',
      '  kjemo_sortie="${KJEMO_TMP}/journal.txt"',
      '  kjemo_code=0',
      '  journalctl "${kjemo_args[@]}" > "${kjemo_sortie}" 2>"${KJEMO_TMP}/journal.err" || kjemo_code=$?',
      '',
      '  if [ "${kjemo_code}" -ne 0 ]; then',
      '    kjemo_msg="$(head -n 5 "${KJEMO_TMP}/journal.err" 2>/dev/null || true)"',
      "    kjemo_resultat 'Journal' 'Requete' 'PROBLEME' \"${kjemo_msg}\" \\",
      "      'La requete a echoue. Si tu as choisi le demarrage precedent, la persistance du journal est probablement absente (/var/log/journal).'",
      '  else',
      '    # Le filtre texte s applique APRES, avec grep -F : une recherche',
      '    # LITTERALE. Sans -F, un motif contenant . * [ ] serait interprete comme',
      '    # une expression reguliere, et "192.168.1.1" chercherait autre chose que',
      '    # ce que l utilisateur a tape.',
      '    if [ -n "${KJEMO_MOTIF}" ]; then',
      '      kjemo_filtre="${KJEMO_TMP}/filtre.txt"',
      '      grep -F -- "${KJEMO_MOTIF}" "${kjemo_sortie}" > "${kjemo_filtre}" 2>/dev/null || true',
      '      mv -- "${kjemo_filtre}" "${kjemo_sortie}"',
      '    fi',
      "    kjemo_nb=\"$(wc -l < \"${kjemo_sortie}\" | tr -d ' ')\"",
      '    if [ "${kjemo_nb}" -eq 0 ]; then',
      '      # Un resultat vide se commente, il ne se presente pas tout seul.',
      '      if [ "${kjemo_acces}" = \'complet\' ]; then',
      "        kjemo_resultat 'Journal' 'Resultat' 'OK' '0 ligne' \\",
      "          'Aucune entree correspondante, et l acces au journal est complet : le resultat est fiable. Elargis la priorite ou la periode pour voir plus large.'",
      '      else',
      "        kjemo_resultat 'Journal' 'Resultat' 'ATTENTION' '0 ligne' \\",
      "          'Aucune entree, MAIS l acces au journal est limite : ce zero ne prouve rien. Relance avec sudo avant de conclure.'",
      '      fi',
      '    else',
      "      kjemo_resultat 'Journal' 'Resultat' 'INFO' \"${kjemo_nb} ligne(s)\" ''",
      '      printf \'\\n--- %s ligne(s) correspondante(s) ---\\n\' "${kjemo_nb}"',
      '      cat "${kjemo_sortie}"',
      "      printf '%s\\n' '--- fin ---'",
      '    fi',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 4. De quoi resserrer ou elargir, sans relancer l assistant',
      '# ---------------------------------------------------------------------------',
      '  printf \'\\n--- Pour aller plus loin, a copier tel quel ---\\n\'',
      '  if [ -n "${KJEMO_UNITE}" ]; then',
      '    printf \'  Suivre en direct      : journalctl -u %s -f\\n\' "${KJEMO_UNITE}"',
      '    printf \'  Tout, sans priorite   : journalctl -u %s -S "%s"\\n\' "${KJEMO_UNITE}" "${KJEMO_PERIODE}"',
      '  else',
      '    printf \'  Suivre en direct      : journalctl -f\\n\'',
      '  fi',
      '  printf \'  Demarrage precedent   : journalctl -b -1 -p err\\n\'',
      '  printf \'  Liste des demarrages  : journalctl --list-boots\\n\'',
      '  printf \'  Taille du journal     : journalctl --disk-usage\\n\'',
      '  printf \'\\n\'',
      '  if [ ! -d /var/log/journal ]; then',
      "    kjemo_resultat 'Journal' 'Persistance' 'ATTENTION' 'absente' \\",
      "      'Sans /var/log/journal, le journal repart a zero a chaque demarrage, et une recherche sur le demarrage precedent ne trouvera jamais rien.'",
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-journal-linux' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine concernée.',
    'Tape « journalctl -p err -S "1 day ago" » pour les erreurs des dernières 24 heures.',
    'Pour un service précis, ajoute « -u ssh.service ». Vérifie d\u2019abord le nom exact avec « systemctl list-unit-files | grep ssh » : un nom inexact donne zéro ligne sans erreur.',
    'Pour un plantage, tape « journalctl -b -1 -p err » : le démarrage précédent, celui qui a mal fini.',
    'Tape « journalctl --list-boots » pour voir quels démarrages sont encore disponibles.',
    'Si tu ne vois rien et que tu n\u2019es pas root, ajoute sudo : sans appartenance au groupe adm, tu ne vois que tes propres journaux.',
  ],

  keywords: ['journal', 'journalctl', 'log', 'logs', 'erreur', 'priorite', 'service', 'systemd',
    'linux', 'recherche', 'diagnostic', 'boot', 'persistance', 'adm', 'ubuntu', 'debian'],

  requiresAdmin: false,
  prereqs: [
    'Une machine utilisant systemd-journald : Ubuntu, Debian 12 et la plupart des distributions actuelles.',
    'Pour lire le journal système complet : appartenir au groupe adm ou systemd-journal, ou utiliser sudo.',
    'Pour interroger un démarrage antérieur : la persistance du journal, c\u2019est-à-dire le dossier /var/log/journal.',
  ],

  commonErrors: [
    {
      message: 'La recherche ne renvoie rien, alors que le service est visiblement en panne',
      code: 'KJEMO',
      cause: 'Deux causes, et le script teste les deux : un accès limité au journal, ou un nom d\u2019unité inexact. « sshd.service » n\u2019existe pas sur Ubuntu, où l\u2019unité s\u2019appelle « ssh.service ».',
      fix: 'Lire les lignes « Acces / Lecture du journal » et « Service / <nom> » en tête de rapport. Un résultat vide avec un accès limité ou une unité inconnue ne prouve rien.',
      command: 'systemctl list-unit-files | grep -i ssh',
    },
    {
      message: 'Failed to look up boot -1: Cannot assign requested address',
      code: 'KJEMO',
      cause: 'Aucun démarrage antérieur n\u2019est enregistré : la persistance du journal est désactivée.',
      fix: 'Créer /var/log/journal et redémarrer journald. Jusque-là, seul le démarrage en cours est lisible.',
      command: 'sudo mkdir -p /var/log/journal && sudo systemctl restart systemd-journald',
    },
    {
      message: 'Hint: You are currently not seeing messages from other users and the system.',
      code: 'KJEMO',
      cause: 'journalctl le dit lui-même : la session ne voit que ses propres journaux.',
      fix: 'Relancer avec sudo, ou ajouter l\u2019utilisateur au groupe adm. Le script signale déjà cette situation en ATTENTION.',
      command: 'sudo usermod -aG adm "$USER"',
    },
    {
      message: 'Le filtre texte ne trouve pas une adresse IP que je vois pourtant dans le journal',
      code: 'KJEMO',
      cause: 'Ce serait le cas avec une recherche par expression régulière, où le point signifie « n\u2019importe quel caractère ».',
      fix: 'Le script utilise grep -F, donc une recherche littérale : ce qui est tapé est ce qui est cherché. Si le texte reste introuvable, c\u2019est la période ou la priorité qu\u2019il faut élargir.',
    },
  ],

  reversible: true,
  verifyAfter: [
    'La première ligne de résultat indique le niveau d\u2019accès au journal : complet, partiel ou refusé.',
    'Si un service a été nommé, une ligne dit si l\u2019unité est connue — un nom inconnu est signalé en ATTENTION.',
    'Un résultat vide est accompagné d\u2019un commentaire disant s\u2019il est fiable ou non, jamais présenté seul.',
    'La liste des commandes « pour aller plus loin » est affichée, prête à copier.',
  ],

  rollback: {
    summary: 'Rien à annuler : ce script interroge les journaux. Il n\u2019en supprime aucun, n\u2019en fait tourner aucun, et ne modifie aucun réglage de journald.',
    diagnostic: `# Verifier que le journal n a pas ete purge : la taille et le plus ancien
# demarrage encore disponible doivent etre inchanges.
journalctl --disk-usage
journalctl --list-boots | head -5`,
    command: `# Rien a annuler : ce script ne contient aucune commande de purge.
# Ni --vacuum-size, ni --vacuum-time, ni --rotate.
#
# Si tu cherches a recuperer de la place, la limite se regle proprement
# dans /etc/systemd/journald.conf (SystemMaxUse), et non par une purge
# manuelle qui reviendra au prochain remplissage :
#   sudo nano /etc/systemd/journald.conf
#   sudo systemctl restart systemd-journald
echo 'Lecture seule : aucune modification a defaire.'`,
    warning: 'Un journal purgé ne se récupère pas. Avant tout « journalctl --vacuum », souviens-toi qu\u2019un journal est ce qui permettra d\u2019expliquer le prochain incident : c\u2019est la pièce qu\u2019on regrette toujours d\u2019avoir supprimée. Et n\u2019extrais pas de journal dans un ticket sans l\u2019avoir relu : les journaux contiennent des noms d\u2019utilisateur, des adresses et parfois des chemins révélateurs.',
  },

  checks: [
    'Le script ne contient aucune commande de purge ou de rotation de journal : ni --vacuum-size, ni --vacuum-time, ni --rotate.',
    'Le filtre texte est appliqué avec grep -F, donc littéralement : aucun motif saisi ne peut être interprété comme une expression régulière.',
    'Les options de journalctl sont passées dans un tableau, ce qui préserve les valeurs contenant des espaces et empêche tout re-découpage par le shell.',
    'Un résultat vide n\u2019est jamais présenté comme « aucune erreur » quand l\u2019accès au journal est limité ou le nom d\u2019unité inconnu.',
  ],

  source: `${M}/man1/journalctl.1.html`,
  sources: [
    { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
    { label: 'systemd-journald.service(8)', url: `${M}/man8/systemd-journald.service.8.html` },
    { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
    { label: 'systemd.unit(5)', url: `${M}/man5/systemd.unit.5.html` },
  ],
};


export const toolsLinux = [
  linuxHealthReport,
  linuxSystemInventory,
  linuxBootDiagnostic,
  linuxLogDiagnostic,
];

export { CAT, M, OS_LINUX, DISTROS, SOURCES_SOCLE, CHAMP_FORMAT, validerFormat, VERSION_LINUX };
