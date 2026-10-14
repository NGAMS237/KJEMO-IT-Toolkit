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
  privilegesRequis: 'aucun',
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
  privilegesRequis: 'root-partiel',
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
  privilegesRequis: 'aucun',
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
  privilegesRequis: 'aucun',
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


// ===========================================================================
// SOUS-RUBRIQUE 2 — BASH ET AUTOMATISATION
// ===========================================================================

const bashScriptStarter = {
  id: 'bash-script-starter',
  icon: '△',
  category: CAT,
  subcategory: 'Bash et automatisation',
  title: 'Squelette de script Bash robuste',
  risk: 'diagnostic',
  summary: 'Produit un squelette de script Bash prêt à remplir : options en ligne de commande, aide, validation des entrées, journalisation, codes de sortie documentés et nettoyage garanti.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['bash 4.4 ou plus récent (présent par défaut)'],
  privileges: 'aucun',
  privilegesRequis: 'aucun',
  readOnly: true,
  service: null,
  limites: [
    'Produit un SQUELETTE : la logique métier reste à écrire, dans la fonction prévue pour elle.',
    'Le squelette ne fait rien d’utile tel quel — c’est voulu : un modèle qui agit déjà est un modèle qu’on lance par erreur.',
    'Suppose bash, pas sh ni dash : les tableaux et les substitutions utilisés ne sont pas POSIX.',
    'N’installe aucune dépendance et n’écrit rien hors du dossier que tu lui désignes.',
  ],

  fields: [
    { id: 'nomScript', label: 'Nom du script à produire', default: 'mon-traitement',
      help: 'Sans l’extension .sh. Lettres, chiffres et tirets.' },
    { id: 'description', label: 'Ce que fera le script, en une phrase',
      default: 'Traite les fichiers d\'un dossier et ecrit un rapport.',
      help: 'Repris dans l’aide et dans l’en-tête.' },
    { id: 'avecJournal', label: 'Journalisation dans un fichier', type: 'select', default: 'Oui',
      options: [['Oui', 'Oui — avec rotation simple'], ['Non', 'Non — console seulement']],
      help: 'Le journal va dans le dossier de travail, jamais dans /var/log.' },
    { id: 'avecSimulation', label: 'Option de simulation (--simuler)', type: 'select', default: 'Oui',
      options: [['Oui', 'Oui — recommandé'], ['Non', 'Non']],
      help: 'Permet de voir ce que ferait le script sans qu’il le fasse.' },
    { id: 'avecVerrou', label: 'Verrou d’exécution unique', type: 'select', default: 'Oui',
      options: [['Oui', 'Oui — empêche deux exécutions simultanées'], ['Non', 'Non']],
      help: 'Indispensable si le script sera lancé par cron.' },
  ],

  validate(v) {
    const errors = {};
    const n = validateNomFichier(v.nomScript, 'Le nom du script');
    if (!n.ok) errors.nomScript = n.error;
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(String(v.nomScript).trim())) {
      errors.nomScript = 'Le nom doit commencer par une lettre ou un chiffre, puis ne contenir que lettres, chiffres, tirets et soulignés.';
    }
    const d = String(v.description ?? '').trim();
    if (d.length < 10) errors.description = 'La description doit faire au moins dix caractères : elle sert d’aide à l’utilisateur.';
    if (d.length > 300) errors.description = 'La description dépasse 300 caractères.';
    for (const [champ, label] of [['avecJournal', 'La journalisation'], ['avecSimulation', 'La simulation'], ['avecVerrou', 'Le verrou']]) {
      const r = validateChoix(v[champ], ['Oui', 'Non'], label);
      if (!r.ok) errors[champ] = r.error;
    }
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const nom = String(v.nomScript).trim();
    const avecJournal = String(v.avecJournal) === 'Oui';
    const avecSimulation = String(v.avecSimulation) === 'Oui';
    const avecVerrou = String(v.avecVerrou) === 'Oui';
    return assemblerSh([
      ...enteteBash({
        titre: 'Squelette de script Bash robuste - a remplir',
        outil: this.id,
        diagnostic: true,
        root: false,
        // Ce modele n emet pas de rapport : il ne doit donc pas declarer les
        // variables du rapport, qui resteraient mortes dans chaque script
        // produit a partir de lui.
        avecRapport: false,
      }),
      '# ===========================================================================',
      '# CE FICHIER EST UN MODELE. Il ne fait rien d utile en l etat, et c est',
      '# VOULU : un modele qui agit deja est un modele qu on lance par erreur en',
      '# croyant l essayer. La logique va dans traiter(), tout en bas.',
      '#',
      `# Script a produire : ${nom}.sh`,
      '# ===========================================================================',
      '',
      `KJEMO_NOM=${shQuote(nom)}`,
      `KJEMO_DESCRIPTION=${shQuote(String(v.description).trim())}`,
      'KJEMO_VERSION_SCRIPT=\'1.0.0\'',
      '',
      '# Codes de sortie, documentes une fois pour toutes. Un script qui sort',
      '# toujours 1 ne permet pas a l appelant de distinguer une erreur d usage',
      '# d une panne reelle, et cron ne saura jamais s il faut alerter.',
      'readonly KJEMO_OK=0',
      'readonly KJEMO_ERREUR_USAGE=2',
      'readonly KJEMO_ERREUR_ENTREE=3',
      'readonly KJEMO_ERREUR_TRAITEMENT=4',
      // Le code 5 n existe QUE si le verrou existe. Declare sans verrou, il
      // annoncerait dans l aide un etat que le script ne peut pas atteindre.
      // ShellCheck l a vu (SC2034) le jour ou les jeux de donnees ont enfin
      // porte avecVerrou: Non.
      ...(avecVerrou ? ['readonly KJEMO_DEJA_EN_COURS=5'] : []),
      '',
      '# Valeurs par defaut des options.',
      'KJEMO_SOURCE=\'\'',
      // Meme raison : sans l option --simuler, personne ne lit KJEMO_SIMULER.
      ...(avecSimulation ? ['KJEMO_SIMULER=0'] : []),
      'KJEMO_VERBEUX=0',
      ...(avecJournal ? ['KJEMO_JOURNAL=\'\''] : []),
      '',
      '# ---------------------------------------------------------------------------',
      '# AIDE',
      '#',
      '# Elle va sur la sortie STANDARD quand on la demande, et sur la sortie',
      '# d ERREUR quand l usage est fautif. La distinction compte : " script',
      '# --aide | less " doit marcher, et un message d erreur ne doit pas se',
      '# retrouver dans un fichier de resultats.',
      '# ---------------------------------------------------------------------------',
      'aide() {',
      '  cat <<AIDE',
      '${KJEMO_NOM} ${KJEMO_VERSION_SCRIPT}',
      '${KJEMO_DESCRIPTION}',
      '',
      'Usage :',
      '  ${KJEMO_NOM}.sh --source <dossier> [options]',
      '',
      'Options :',
      '  -s, --source <dossier>   Dossier a traiter (obligatoire)',
      ...(avecSimulation ? ['  -n, --simuler            Montre ce qui serait fait, sans rien faire'] : []),
      ...(avecJournal ? ['  -j, --journal <fichier>  Journalise aussi dans ce fichier'] : []),
      '  -v, --verbeux            Detaille chaque etape',
      '  -h, --aide               Affiche cette aide',
      '      --version            Affiche la version',
      '',
      'Codes de sortie :',
      '  0  succes',
      '  2  erreur d usage (option inconnue, argument manquant)',
      '  3  erreur d entree (dossier absent ou illisible)',
      '  4  erreur de traitement',
      ...(avecVerrou ? ['  5  une autre execution est deja en cours'] : []),
      'AIDE',
      '}',
      '',
      '# ---------------------------------------------------------------------------',
      '# JOURNALISATION',
      '#',
      '# Un seul point de sortie pour tous les messages, horodate. Les messages',
      '# d erreur vont sur la sortie d ERREUR : sans cela, " script > resultats.txt "',
      '# melange les erreurs aux resultats, et on ne s en apercoit qu au moment ou',
      '# on exploite le fichier.',
      '# ---------------------------------------------------------------------------',
      'journaliser() {',
      '  local niveau="${1:-INFO}"',
      '  shift',
      '  local ligne',
      '  ligne="$(date \'+%Y-%m-%d %H:%M:%S\') [${niveau}] $*"',
      '  case "${niveau}" in',
      '    ERREUR) printf \'%s\\n\' "${ligne}" >&2 ;;',
      '    DEBUG)  if [ "${KJEMO_VERBEUX}" -eq 1 ]; then printf \'%s\\n\' "${ligne}"; fi ;;',
      '    *)      printf \'%s\\n\' "${ligne}" ;;',
      '  esac',
      ...(avecJournal ? [
        '  if [ -n "${KJEMO_JOURNAL}" ]; then',
        '    printf \'%s\\n\' "${ligne}" >> "${KJEMO_JOURNAL}"',
        '  fi',
      ] : []),
      '}',
      '',
      'mourir() {',
      '  local code="${1:-1}"',
      '  shift',
      '  journaliser ERREUR "$*"',
      '  exit "${code}"',
      '}',
      '',
      '# ---------------------------------------------------------------------------',
      '# ANALYSE DES OPTIONS',
      '#',
      '# Une boucle while/case et non getopts : getopts ne gere pas les options',
      '# longues (--source), et les options longues sont ce qui rend un script',
      '# relisable six mois plus tard. Le cout est quelques lignes de plus.',
      '#',
      '# Chaque option a valeur verifie que sa valeur EXISTE : sans cela,',
      '# " --source " en fin de ligne consomme l option suivante comme valeur, ou',
      '# echoue sur une variable non definie a cause de set -u.',
      '# ---------------------------------------------------------------------------',
      'while [ $# -gt 0 ]; do',
      '  case "${1}" in',
      '    -s|--source)',
      '      if [ $# -lt 2 ]; then',
      '        aide >&2',
      '        mourir "${KJEMO_ERREUR_USAGE}" "--source attend un dossier."',
      '      fi',
      '      KJEMO_SOURCE="${2}"',
      '      shift 2',
      '      ;;',
      ...(avecSimulation ? [
        '    -n|--simuler)',
        '      KJEMO_SIMULER=1',
        '      shift',
        '      ;;',
      ] : []),
      ...(avecJournal ? [
        '    -j|--journal)',
        '      if [ $# -lt 2 ]; then',
        '        aide >&2',
        '        mourir "${KJEMO_ERREUR_USAGE}" "--journal attend un fichier."',
        '      fi',
        '      KJEMO_JOURNAL="${2}"',
        '      shift 2',
        '      ;;',
      ] : []),
      '    -v|--verbeux) KJEMO_VERBEUX=1; shift ;;',
      '    -h|--aide)    aide; exit "${KJEMO_OK}" ;;',
      '    --version)    printf \'%s %s\\n\' "${KJEMO_NOM}" "${KJEMO_VERSION_SCRIPT}"; exit "${KJEMO_OK}" ;;',
      '    --)           shift; break ;;',
      '    -*)',
      '      aide >&2',
      '      mourir "${KJEMO_ERREUR_USAGE}" "Option inconnue : ${1}"',
      '      ;;',
      '    *)            break ;;',
      '  esac',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# VALIDATION DES ENTREES - AVANT toute action',
      '#',
      '# On valide tout d abord, on agit ensuite. Valider au fur et a mesure',
      '# produit des traitements a moitie faits, et un traitement a moitie fait',
      '# est plus difficile a reprendre qu un traitement pas commence.',
      '# ---------------------------------------------------------------------------',
      'if [ -z "${KJEMO_SOURCE}" ]; then',
      '  aide >&2',
      '  mourir "${KJEMO_ERREUR_USAGE}" "--source est obligatoire."',
      'fi',
      'if [ ! -e "${KJEMO_SOURCE}" ]; then',
      '  mourir "${KJEMO_ERREUR_ENTREE}" "Le dossier ${KJEMO_SOURCE} n existe pas."',
      'fi',
      'if [ ! -d "${KJEMO_SOURCE}" ]; then',
      '  mourir "${KJEMO_ERREUR_ENTREE}" "${KJEMO_SOURCE} existe mais n est pas un dossier."',
      'fi',
      'if [ ! -r "${KJEMO_SOURCE}" ]; then',
      '  mourir "${KJEMO_ERREUR_ENTREE}" "${KJEMO_SOURCE} n est pas lisible par cette session."',
      'fi',
      ...(avecJournal ? [
        '# Le journal doit etre ecrivable AVANT qu on en ait besoin : decouvrir',
        '# qu il ne l est pas au moment d ecrire une erreur, c est perdre l erreur.',
        'if [ -n "${KJEMO_JOURNAL}" ]; then',
        '  if ! touch -- "${KJEMO_JOURNAL}" 2>/dev/null; then',
        '    KJEMO_JOURNAL=\'\'',
        '    journaliser ERREUR "Journal non ecrivable : poursuite en console seulement."',
        '  fi',
        'fi',
      ] : []),
      '',
      ...(avecVerrou ? [
        '# ---------------------------------------------------------------------------',
        '# VERROU D EXECUTION UNIQUE',
        '#',
        '# Indispensable des que le script passe par cron : deux executions qui se',
        '# chevauchent sur les memes fichiers produisent un resultat dont personne',
        '# ne peut dire ce qu il vaut.',
        '#',
        '# flock et non un fichier temoin : un fichier temoin survit a un plantage',
        '# et bloque definitivement le script, ce qu on decouvre trois semaines plus',
        '# tard. Le verrou de flock est libere par le noyau quand le processus meurt,',
        '# quelle qu en soit la cause.',
        '# ---------------------------------------------------------------------------',
        'KJEMO_VERROU="${KJEMO_TMP}/../${KJEMO_NOM}.verrou"',
        'if kjemo_dispo flock; then',
        '  exec 9>"${KJEMO_VERROU}" || mourir "${KJEMO_ERREUR_TRAITEMENT}" "Verrou inaccessible."',
        '  if ! flock -n 9; then',
        '    mourir "${KJEMO_DEJA_EN_COURS}" "Une autre execution est deja en cours."',
        '  fi',
        '  journaliser DEBUG "Verrou obtenu."',
        'else',
        '  journaliser INFO "flock absent : execution sans verrou. Deux lancements simultanes ne seraient pas empeches."',
        'fi',
        '',
      ] : []),
      '# ---------------------------------------------------------------------------',
      '# LA LOGIQUE - C EST ICI QUE TU ECRIS',
      '#',
      '# traiter() recoit UN chemin et s occupe d UN element. La boucle qui',
      '# l appelle est fournie, et elle est ecrite pour ne pas casser sur les noms',
      '# de fichiers difficiles : voir le commentaire de la boucle.',
      '# ---------------------------------------------------------------------------',
      'traiter() {',
      '  local cible="${1}"',
      '',
      '  # ===== A REMPLIR =====',
      '  # Exemple de ce qu on ecrit ici, et de la forme a respecter :',
      '  #',
      '  #   local taille',
      '  #   taille="$(stat -c %s -- "${cible}")" || return 1',
      '  #   journaliser INFO "${cible} : ${taille} octets"',
      '  #',
      '  # Trois regles pour que le reste du squelette tienne ses promesses :',
      '  #   1. CITER "${cible}" partout, sans exception ;',
      '  #   2. rendre 0 en cas de succes, non nul en cas d echec ;',
      ...(avecSimulation ? [
        '  #   3. ne rien modifier si KJEMO_SIMULER vaut 1 - voir ci-dessous.',
      ] : ['  #   3. ne jamais supposer que le chemin existe encore.']),
      ...(avecSimulation ? [
        '',
        '  if [ "${KJEMO_SIMULER}" -eq 1 ]; then',
        '    journaliser INFO "SIMULATION : ${cible} serait traite, rien n est modifie."',
        '    return 0',
        '  fi',
      ] : []),
      '',
      '  journaliser DEBUG "Traitement de ${cible}"',
      '  return 0',
      '}',
      '',
      '# ---------------------------------------------------------------------------',
      '# LA BOUCLE',
      '#',
      '# find -print0 et read -d \'\' : le seul couple qui survive a TOUS les noms de',
      '# fichiers. Un nom peut contenir un espace, un retour a la ligne, une',
      '# apostrophe, un caractere accentue - tout sauf l octet nul, qui est',
      '# justement le seul separateur sur lequel on puisse compter.',
      '#',
      '# " for f in $(ls) " ou " for f in * " cassent sur le premier espace, et',
      '# " find | while read " casse sur le premier retour a la ligne. Les deux',
      '# formes se rencontrent partout, et c est pour cela qu on les evite ici.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_TRAITES=0',
      'KJEMO_ECHECS=0',
      '',
      'while IFS= read -r -d \'\' kjemo_cible; do',
      '  if traiter "${kjemo_cible}"; then',
      '    KJEMO_TRAITES=$((KJEMO_TRAITES + 1))',
      '  else',
      '    KJEMO_ECHECS=$((KJEMO_ECHECS + 1))',
      '    journaliser ERREUR "Echec sur ${kjemo_cible}"',
      '  fi',
      'done < <(find "${KJEMO_SOURCE}" -maxdepth 1 -type f -print0)',
      '',
      '# ---------------------------------------------------------------------------',
      '# BILAN ET CODE DE SORTIE',
      '#',
      '# Le code de sortie reflete le RESULTAT, et non le fait que le script soit',
      '# arrive au bout. Un script qui sort 0 apres dix echecs est un script qui',
      '# mentira a cron, et personne ne sera alerte.',
      '# ---------------------------------------------------------------------------',
      'journaliser INFO "Termine : ${KJEMO_TRAITES} traite(s), ${KJEMO_ECHECS} echec(s)."',
      ...(avecSimulation ? [
        'if [ "${KJEMO_SIMULER}" -eq 1 ]; then',
        '  journaliser INFO "C etait une SIMULATION : rien n a ete modifie."',
        'fi',
      ] : []),
      'if [ "${KJEMO_ECHECS}" -gt 0 ]; then',
      '  exit "${KJEMO_ERREUR_TRAITEMENT}"',
      'fi',
      'exit "${KJEMO_OK}"',
    ]);
  },

  gui: [
    'Ouvre un éditeur de texte sur la machine Linux.',
    'Commence tout script par « #!/usr/bin/env bash », puis « set -Eeuo pipefail » : c’est ce qui transforme une erreur silencieuse en arrêt visible.',
    'Ajoute « IFS=$\'\\n\\t\' » pour que les noms de fichiers contenant un espace ne soient pas découpés en deux arguments.',
    'Crée tout fichier temporaire avec « mktemp » et détruis-le par « trap ... EXIT HUP INT TERM », jamais avec un chemin fixe dans /tmp.',
    'Pour parcourir des fichiers, utilise « find ... -print0 » et « while IFS= read -r -d \'\' », seul couple qui survive à un nom contenant un retour à la ligne.',
    'Cite toutes tes variables entre guillemets doubles, sans exception : « "${f}" » et jamais « $f ».',
  ],

  keywords: ['bash', 'script', 'squelette', 'modele', 'gabarit', 'automatisation', 'options',
    'getopts', 'aide', 'journal', 'verrou', 'flock', 'cron', 'robuste', 'linux', 'starter'],

  requiresAdmin: false,
  prereqs: [
    'bash 4.4 ou plus récent : les constructions utilisées ne sont pas POSIX et ne marchent pas sous sh ou dash.',
    'Un éditeur de texte sur la machine Linux.',
    'Facultatif : le paquet util-linux pour flock, utilisé par le verrou d’exécution unique.',
  ],

  commonErrors: [
    {
      message: 'unbound variable',
      code: 'KJEMO',
      cause: 'set -u est actif, et une variable est lue avant d’être définie. C’est le comportement voulu : la variable vide aurait produit un résultat faux en silence.',
      fix: 'Donner une valeur par défaut à la déclaration, ou utiliser la forme « ${VAR:-} » là où le vide est légitime.',
    },
    {
      message: 'Le script s’arrête sans message au milieu du traitement',
      code: 'KJEMO',
      cause: 'set -e : une commande a échoué et le script s’est arrêté. C’est voulu, mais le message a pu partir sur la sortie d’erreur sans être vu.',
      fix: 'Relancer avec --verbeux. Pour une commande dont l’échec est normal, écrire explicitement « commande || true » afin que l’intention soit visible.',
    },
    {
      message: 'Une autre execution est deja en cours',
      code: 'KJEMO 5',
      cause: 'Le verrou flock est tenu par un autre processus. Normal si cron relance avant la fin du passage précédent.',
      fix: 'Vérifier si l’exécution précédente est toujours vivante. Si elle est bloquée, la terminer ; le verrou sera libéré par le noyau.',
      command: 'pgrep -af mon-traitement.sh',
    },
    {
      message: 'Les fichiers dont le nom contient un espace sont ignorés ou traités en deux fois',
      code: 'KJEMO',
      cause: 'La boucle a été réécrite en « for f in $(ls) » ou en « for f in * ».',
      fix: 'Conserver la forme fournie : « find ... -print0 » avec « while IFS= read -r -d \'\' ». C’est la seule qui survive à tous les noms de fichiers.',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Lancer le script avec --aide : l’aide s’affiche et le code de sortie est 0.',
    'Lancer sans --source : l’aide part sur la sortie d’erreur et le code de sortie est 2.',
    'Lancer avec --source sur un dossier inexistant : le code de sortie est 3.',
    'Lancer avec --simuler sur un dossier réel : les lignes « SIMULATION » apparaissent et aucun fichier n’est modifié.',
    'Vérifier la syntaxe sans exécuter : « bash -n mon-traitement.sh » ne dit rien, et « shellcheck mon-traitement.sh » non plus.',
  ],

  rollback: {
    summary: 'Rien à annuler : cet assistant produit un fichier de modèle. Le modèle lui-même ne fait rien tant que tu n’as pas rempli la fonction traiter().',
    diagnostic: `# Verifier que le modele ne fait rien : la fonction traiter() ne doit
# contenir que des commentaires et un return.
sed -n '/^traiter()/,/^}/p' mon-traitement.sh`,
    command: `# Rien a annuler : le modele est inerte.
# Pour le supprimer, apres l avoir relu :
#   rm -i mon-traitement.sh
# Et avant de remplir traiter(), controle toujours la syntaxe :
#   bash -n mon-traitement.sh
#   shellcheck mon-traitement.sh
echo 'Modele inerte : aucune modification a defaire.'`,
    warning: 'Dès que tu remplis traiter(), le script peut agir. Garde l’option --simuler et utilise-la en premier, sur un dossier de copie. Et ne retire pas « set -Eeuo pipefail » parce qu’un message gêne : ce message est précisément ce qui t’évitera un traitement à moitié fait.',
  },

  checks: [
    'Le modèle ne contient aucune commande destructrice : ni rm, ni mv, ni chmod, ni dd. La fonction traiter() est vide.',
    'Toute variable est citée entre guillemets doubles dans le code fourni, et la boucle utilise find -print0 avec read -d \'\'.',
    'Les fichiers temporaires passent par mktemp et sont détruits par une trap qui couvre EXIT, HUP, INT et TERM.',
    'Les codes de sortie sont déclarés en lecture seule et documentés dans l’aide : 0, 2, 3, 4 et 5 ont chacun un sens distinct.',
  ],

  source: 'https://www.gnu.org/software/bash/manual/bash.html',
  sources: [
    { label: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/bash.html' },
    { label: 'mktemp(1)', url: `${M}/man1/mktemp.1.html` },
    { label: 'find(1)', url: `${M}/man1/find.1.html` },
    { label: 'Shell Command Language — POSIX', url: 'https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html' },
  ],
};

const bashFileBatch = {
  id: 'bash-file-batch',
  icon: '△',
  category: CAT,
  subcategory: 'Bash et automatisation',
  title: 'Traitement par lot d\u2019un ensemble de fichiers',
  risk: 'diagnostic',
  summary: 'Parcourt les fichiers d\u2019un dossier et produit un inventaire, sans jamais casser sur un nom contenant un espace, un accent, une apostrophe ou un retour à la ligne.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['findutils — find (présent par défaut)', 'coreutils — stat, sha256sum (présent par défaut)'],
  privileges: 'aucun',
  privilegesRequis: 'aucun',
  readOnly: true,
  service: null,
  limites: [
    'LIT seulement : produit un inventaire, ne renomme, ne déplace et ne supprime rien.',
    'Les empreintes SHA-256 sont facultatives et coûtent une lecture complète de chaque fichier : évite-les sur plusieurs gigaoctets.',
    'Ne suit pas les liens symboliques, pour ne pas sortir du dossier demandé sans le dire.',
    'Pour un nettoyage ou un déplacement réel, ce n\u2019est pas le bon outil : il n\u2019en fait délibérément pas.',
  ],

  fields: [
    { id: 'source', label: 'Dossier à parcourir', default: '/srv/donnees',
      help: 'Chemin absolu. Les zones système sont refusées par le gardien de chemin.' },
    { id: 'motif', label: 'Filtrer les noms (facultatif)', default: '', optionnel: true,
      help: 'Motif de nom de fichier, par exemple *.csv. Laisse vide pour tous les fichiers : c\u2019est le cas le plus courant.' },
    { id: 'profondeur', label: 'Profondeur maximale', type: 'number', default: '1', min: '1', max: '10',
      help: '1 = le dossier seulement, sans ses sous-dossiers.' },
    { id: 'avecEmpreinte', label: 'Calculer les empreintes SHA-256', type: 'select', default: 'Non',
      options: [['Non', 'Non — rapide'], ['Oui', 'Oui — lit chaque fichier en entier']],
      help: 'Utile pour détecter des doublons, coûteux sur de gros volumes.' },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const c = validateCheminAbsolu(v.source, 'Le dossier à parcourir');
    if (!c.ok) errors.source = c.error;
    const m = String(v.motif ?? '');
    if (m && /[\n\r\0]/.test(m)) errors.motif = 'Le motif ne peut pas contenir de retour à la ligne.';
    if (m.length > 100) errors.motif = 'Le motif dépasse 100 caractères.';
    if (m.includes('/')) errors.motif = 'Le motif porte sur un NOM de fichier : il ne peut pas contenir « / ».';
    const p = validateEntierBorne(v.profondeur, 1, 10, 'La profondeur');
    if (!p.ok) errors.profondeur = p.error;
    const e = validateChoix(v.avecEmpreinte, ['Oui', 'Non'], 'Le choix des empreintes');
    if (!e.ok) errors.avecEmpreinte = e.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const motif = String(v.motif ?? '').trim();
    return assemblerSh([
      ...enteteBash({
        titre: 'Inventaire par lot des fichiers d un dossier',
        outil: this.id, diagnostic: true, root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocGardienChemin({ lectureSeule: true }),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_SOURCE', shQuote(String(v.source).trim())],
        ['KJEMO_MOTIF', shQuote(motif)],
        ['KJEMO_PROFONDEUR', shQuote(String(v.profondeur))],
        ['KJEMO_EMPREINTE', shQuote(String(v.avecEmpreinte))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Dossier', '${KJEMO_SOURCE}'],
        ['Motif', '${KJEMO_MOTIF:-tous les fichiers}'],
        ['Profondeur', '${KJEMO_PROFONDEUR}'],
        ['Empreintes', '${KJEMO_EMPREINTE}'],
      ]),
      '# Le gardien se prononce AVANT toute lecture.',
      'kjemo_exiger_chemin_sur "${KJEMO_SOURCE}" \'Dossier a parcourir\'',
      '# On travaille desormais sur le chemin CANONIQUE rendu par le gardien, et',
      '# non sur la saisie brute : les barres obliques en trop et les segments "."',
      '# sont deja retires, ce qui evite que deux comparaisons de chemins censees',
      '# etre identiques divergent.',
      'KJEMO_SOURCE="${KJEMO_CHEMIN_CANON}"',
      'if [ ! -d "${KJEMO_SOURCE}" ]; then',
      '  printf \'ARRET : %s n est pas un dossier.\\n\' "${KJEMO_SOURCE}" >&2',
      '  exit 1',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE PARCOURS',
      '#',
      '# find -print0 et read -r -d \'\' : le seul couple qui survive a TOUS les noms',
      '# de fichiers. Un nom peut contenir un espace, un retour a la ligne, une',
      '# apostrophe, un accent - tout sauf l octet nul, qui est justement le seul',
      '# separateur fiable.',
      '#',
      '# Ce qui casse, et qu on evite ici :',
      '#   for f in $(ls)      casse au premier espace',
      '#   for f in *          casse si le dossier est vide (le motif reste litteral)',
      '#   find | while read   casse au premier retour a la ligne dans un nom',
      '#',
      '# -H et l absence de -L : on ne SUIT pas les liens symboliques. Les suivre',
      '# ferait sortir du dossier demande sans le dire, et un lien vers / rendrait',
      '# l inventaire infini.',
      '# ---------------------------------------------------------------------------',
      'kjemo_args=("${KJEMO_SOURCE}" -maxdepth "${KJEMO_PROFONDEUR}" -type f)',
      'if [ -n "${KJEMO_MOTIF}" ]; then',
      '  kjemo_args+=(-name "${KJEMO_MOTIF}")',
      'fi',
      '',
      'KJEMO_INVENTAIRE="${KJEMO_TMP}/inventaire.tsv"',
      ': > "${KJEMO_INVENTAIRE}"',
      'kjemo_nb=0',
      'kjemo_octets=0',
      'kjemo_illisibles=0',
      '',
      'while IFS= read -r -d \'\' kjemo_f; do',
      '  kjemo_nb=$((kjemo_nb + 1))',
      '  if [ ! -r "${kjemo_f}" ]; then',
      '    kjemo_illisibles=$((kjemo_illisibles + 1))',
      "    kjemo_resultat 'Fichiers' 'Illisible' 'ATTENTION' \"${kjemo_f}\" \\",
      "      'Fichier non lisible par cette session : exclu des mesures.'",
      '    continue',
      '  fi',
      '  kjemo_taille=0',
      '  kjemo_taille="$(stat -c %s -- "${kjemo_f}" 2>/dev/null || echo 0)"',
      '  kjemo_octets=$((kjemo_octets + kjemo_taille))',
      '  kjemo_date=\'\'',
      '  kjemo_date="$(stat -c %y -- "${kjemo_f}" 2>/dev/null || echo inconnue)"',
      '  kjemo_sha=\'-\'',
      "  if [ \"${KJEMO_EMPREINTE}\" = 'Oui' ]; then",
      '    kjemo_sha="$(sha256sum -- "${kjemo_f}" 2>/dev/null | cut -d\' \' -f1 || echo erreur)"',
      '  fi',
      '  # Le nom va dans un champ TSV : les tabulations et retours a la ligne y',
      '  # sont aplatis, sinon le format se decale. Le nom BRUT reste utilisable',
      '  # par le script ; c est seulement sa representation qui est normalisee.',
      '  printf \'%s\\t%s\\t%s\\t%s\\n\' \\',
      '    "$(kjemo_aplatir "${kjemo_f}")" "${kjemo_taille}" \\',
      '    "$(kjemo_aplatir "${kjemo_date}")" "${kjemo_sha}" >> "${KJEMO_INVENTAIRE}"',
      'done < <(find "${kjemo_args[@]}" -print0)',
      '',
      "kjemo_resultat 'Inventaire' 'Fichiers trouves' 'INFO' \"${kjemo_nb}\" ''",
      "kjemo_resultat 'Inventaire' 'Volume total' 'INFO' \"$((kjemo_octets / 1024)) Kio\" ''",
      'if [ "${kjemo_illisibles}" -gt 0 ]; then',
      "  kjemo_resultat 'Inventaire' 'Fichiers illisibles' 'ATTENTION' \"${kjemo_illisibles}\" \\",
      "    'Ces fichiers sont comptes mais leur taille n entre pas dans le volume.'",
      'fi',
      'if [ "${kjemo_nb}" -eq 0 ]; then',
      '  # Un inventaire vide se commente : sans cela il ressemble a un dossier',
      '  # vide, alors que le motif peut simplement ne rien avoir trouve.',
      '  if [ -n "${KJEMO_MOTIF}" ]; then',
      "    kjemo_resultat 'Inventaire' 'Resultat vide' 'ATTENTION' '0 fichier' \\",
      '      "Aucun fichier ne correspond au motif ${KJEMO_MOTIF}. Le dossier n est pas forcement vide : essaie sans motif."',
      '  else',
      "    kjemo_resultat 'Inventaire' 'Resultat vide' 'INFO' '0 fichier' \\",
      "      'Le dossier ne contient aucun fichier a cette profondeur.'",
      '  fi',
      'fi',
      '',
      '# Les dix plus gros, utiles immediatement.',
      'if [ "${kjemo_nb}" -gt 0 ]; then',
      '  printf \'%s\\n\' \'--- Les dix plus gros fichiers ---\'',
      '  sort -t"$(printf \'\\t\')" -k2 -nr "${KJEMO_INVENTAIRE}" | head -10 \\',
      '    | while IFS=$\'\\t\' read -r n t _ _; do',
      '        printf \'  %10s Kio  %s\\n\' "$((t / 1024))" "${n}"',
      '      done',
      '  printf \'\\n\'',
      'fi',
      ...blocRapportBash({ prefixeFichier: 'kjemo-inventaire-fichiers' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine Linux.',
    'Pour compter les fichiers : « find /srv/donnees -maxdepth 1 -type f | wc -l ».',
    'Pour les tailles sans casser sur les espaces : « find /srv/donnees -maxdepth 1 -type f -printf \'%s\\t%p\\n\' | sort -nr | head ».',
    'N\u2019utilise jamais « for f in $(ls) » : la boucle casse au premier nom contenant un espace.',
    'Pour un parcours sûr en script, « find ... -print0 » avec « while IFS= read -r -d \'\' » est la seule forme fiable.',
  ],

  keywords: ['bash', 'lot', 'batch', 'fichiers', 'find', 'parcours', 'inventaire', 'espaces',
    'accents', 'apostrophe', 'print0', 'sha256', 'doublons', 'linux', 'automatisation'],

  requiresAdmin: false,
  prereqs: [
    'Un accès terminal et le droit de LIRE le dossier visé.',
    'findutils et coreutils, présents par défaut sur Ubuntu et Debian.',
    'Un dossier hors des zones système : le gardien de chemin refuse /etc, /boot, /root et les dossiers techniques comme .git ou .ssh.',
  ],

  commonErrors: [
    { message: 'ARRET : Dossier a parcourir refuse.', code: 'KJEMO',
      cause: 'Le gardien de chemin a reconnu une zone protégée — une racine système, ou un segment comme .git, .ssh ou .env n\u2019importe où dans le chemin.',
      fix: 'Lire la ligne « Zone protegee detectee » : elle nomme exactement ce qui a déclenché le refus. Choisir un chemin hors de cette zone.' },
    { message: 'find: ‘/srv/donnees’: Permission denied', code: 'EACCES',
      cause: 'Le dossier n\u2019est pas traversable par cette session.',
      fix: 'Vérifier les permissions avec « ls -ld /srv/donnees ». Un dossier a besoin du bit x pour être traversé, pas seulement du bit r.',
      command: 'ls -ld /srv/donnees' },
    { message: 'Aucun fichier ne correspond au motif', code: 'KJEMO',
      cause: 'Le motif porte sur le NOM du fichier, pas sur son chemin, et il est sensible à la casse.',
      fix: 'Essayer sans motif pour confirmer que le dossier n\u2019est pas vide. Le rapport distingue déjà « dossier vide » de « motif sans correspondance ».' },
    { message: 'Le calcul des empreintes prend un temps interminable', code: 'KJEMO',
      cause: 'SHA-256 lit chaque fichier en entier : sur plusieurs gigaoctets, c\u2019est le disque qui limite.',
      fix: 'Relancer avec les empreintes désactivées, ou réduire la profondeur et poser un motif.' },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport donne un nombre de fichiers et un volume total.',
    'La liste des dix plus gros fichiers s\u2019affiche, avec les noms intacts — espaces et accents compris.',
    'Un résultat vide est accompagné d\u2019un commentaire distinguant « dossier vide » de « motif sans correspondance ».',
    'Aucun fichier du dossier n\u2019a changé de date de modification : le script ne fait que lire.',
  ],

  rollback: {
    summary: 'Rien à annuler : l\u2019outil lit et inventorie. Il ne renomme, ne déplace, ne supprime et ne modifie aucun fichier.',
    diagnostic: `# Verifier que rien n a change : les dates de modification doivent etre
# ANTERIEURES a l execution de l inventaire.
find /srv/donnees -maxdepth 1 -type f -printf '%TY-%Tm-%Td %TH:%TM  %p\\n' | sort | tail -10`,
    command: `# Rien a annuler : aucune ecriture dans le dossier parcouru.
# Le seul fichier produit est le rapport, dans le dossier personnel :
#   rm -i "\${HOME}"/kjemo-inventaire-fichiers-*
echo 'Inventaire en lecture seule : aucune modification a defaire.'`,
    warning: 'Un inventaire peut contenir des noms de fichiers révélateurs — noms de clients, de dossiers médicaux, de projets confidentiels. Ne le colle pas dans un ticket public sans l\u2019avoir relu. Et si tu transformes ce script en outil de nettoyage, souviens-toi que « find -delete » n\u2019a pas de corbeille.',
  },

  checks: [
    'Le script ne contient aucune commande de modification : ni rm, ni mv, ni chmod, ni find -delete, ni find -exec.',
    'Le parcours utilise find -print0 avec read -r -d \'\', seule forme qui préserve un nom contenant un retour à la ligne.',
    'Les liens symboliques ne sont pas suivis : l\u2019inventaire ne peut pas sortir du dossier demandé ni boucler.',
    'Le gardien de chemin se prononce AVANT la première lecture, et son refus nomme la zone protégée détectée.',
  ],

  source: `${M}/man1/find.1.html`,
  sources: [
    { label: 'find(1)', url: `${M}/man1/find.1.html` },
    { label: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/bash.html' },
    { label: 'stat(1)', url: `${M}/man1/stat.1.html` },
    { label: 'sha256sum(1)', url: `${M}/man1/sha256sum.1.html` },
  ],
};

const bashBackupDirectory = {
  id: 'bash-backup-directory',
  icon: '△',
  category: CAT,
  subcategory: 'Bash et automatisation',
  title: 'Sauvegarde locale datée d\u2019un dossier',
  risk: 'caution',
  summary: 'Crée une archive datée d\u2019un dossier, avec manifeste, empreintes SHA-256 et vérification de l\u2019archive produite. Ne supprime jamais une sauvegarde antérieure.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['tar (présent par défaut)', 'coreutils — sha256sum, df (présent par défaut)', 'gzip ou zstd selon la compression choisie'],
  privileges: 'aucun si la source et la destination sont lisibles et inscriptibles par la session',
  privilegesRequis: 'aucun',
  readOnly: false,
  service: null,
  limites: [
    'Sauvegarde LOCALE : une copie sur le même disque ne protège pas d\u2019une panne de ce disque. C\u2019est une protection contre l\u2019erreur humaine, pas contre la perte de matériel.',
    'Ne supprime JAMAIS une sauvegarde antérieure, même ancienne : la rotation est une décision qui n\u2019appartient pas à un assistant.',
    'Ne sauvegarde pas une base de données en cours d\u2019écriture de façon cohérente : il faut un dump, pas une copie de fichiers.',
    'Les droits et propriétaires sont conservés dans l\u2019archive, mais leur restauration exige root si les fichiers n\u2019appartiennent pas à la session.',
  ],

  fields: [
    { id: 'source', label: 'Dossier à sauvegarder', default: '/srv/donnees',
      help: 'Chemin absolu. Les zones système sont refusées.' },
    { id: 'destination', label: 'Dossier de destination', default: '/srv/sauvegardes',
      help: 'Doit être différent de la source, et hors de la source.' },
    { id: 'etiquette', label: 'Étiquette de la sauvegarde', default: 'donnees',
      help: 'Reprise dans le nom du fichier, avec la date.' },
    { id: 'compression', label: 'Compression', type: 'select', default: 'gzip',
      options: [['aucune', 'Aucune — rapide, gros fichier'], ['gzip', 'gzip — compromis habituel'], ['zstd', 'zstd — plus rapide et plus efficace, si disponible']],
      help: 'zstd demande le paquet zstd.' },
    { id: 'confirmation', label: 'Phrase de confirmation', default: '', optionnel: true,
      help: 'Laisse vide pour obtenir un script qui VERIFIE tout et n\u2019ecrit rien : c\u2019est ainsi qu\u2019on relit avant d\u2019agir. Pour autoriser l\u2019archivage, recopie exactement : SAUVEGARDER donnees' },
  ],

  validate(v) {
    const errors = {};
    const s = validateCheminAbsolu(v.source, 'Le dossier à sauvegarder');
    if (!s.ok) errors.source = s.error;
    const d = validateCheminAbsolu(v.destination, 'Le dossier de destination');
    if (!d.ok) errors.destination = d.error;
    // La destination ne doit pas etre DANS la source : l'archive se mettrait a
    // s'archiver elle-meme, et tar grossirait jusqu'a remplir le disque.
    if (s.ok && d.ok) {
      const src = s.value.replace(/\/+$/, '');
      const dst = d.value.replace(/\/+$/, '');
      if (dst === src) errors.destination = 'La destination ne peut pas être la source elle-même.';
      else if (dst.startsWith(`${src}/`)) {
        errors.destination = 'La destination est DANS la source : l\u2019archive s\u2019archiverait elle-même et grossirait jusqu\u2019à remplir le disque. Choisis un dossier hors de la source.';
      }
    }
    const e = validateNomFichier(v.etiquette, 'L\u2019étiquette');
    if (!e.ok) errors.etiquette = e.error;
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(String(v.etiquette).trim())) {
      errors.etiquette = 'L\u2019étiquette ne doit contenir que lettres, chiffres, tirets et soulignés.';
    }
    const c = validateChoix(v.compression, ['aucune', 'gzip', 'zstd'], 'La compression');
    if (!c.ok) errors.compression = c.error;
    // La confirmation n'est PAS exigee ici, volontairement : il faut pouvoir
    // obtenir et RELIRE le script avant de confirmer quoi que ce soit. Le
    // verrou vit dans le script genere (blocConfirmation + blocPorteFinale) :
    // sans la phrase exacte, le script diagnostique et n'ecrit rien.
    // C'est la convention de temp-cleanup au LOT 6, et elle est meilleure que
    // de bloquer la generation.
    const conf = String(v.confirmation ?? '');
    if (conf && conf !== `SAUVEGARDER ${String(v.etiquette ?? '').trim()}`) {
      errors.confirmation = `La phrase ne correspond pas. Recopie exactement : SAUVEGARDER ${String(v.etiquette ?? '').trim()} — ou laisse vide pour obtenir un script qui diagnostique sans ecrire.`;
    }
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const etiquette = String(v.etiquette).trim();
    const comp = String(v.compression);
    const ext = comp === 'gzip' ? '.tar.gz' : (comp === 'zstd' ? '.tar.zst' : '.tar');
    return assemblerSh([
      ...enteteBash({
        titre: 'Sauvegarde locale datee d un dossier, avec manifeste et verification',
        outil: this.id, diagnostic: false, root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocGardienChemin({ lectureSeule: false }),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_SOURCE', shQuote(String(v.source).trim().replace(/\/+$/, ''))],
        ['KJEMO_DEST', shQuote(String(v.destination).trim().replace(/\/+$/, ''))],
        ['KJEMO_ETIQUETTE', shQuote(etiquette)],
        ['KJEMO_COMPRESSION', shQuote(comp)],
        ['KJEMO_CONFIRMATION', shQuote(String(v.confirmation))],
        ['KJEMO_FORMAT', shQuote('Console')],
      ]),
      ...blocParametresBash([
        ['Source', '${KJEMO_SOURCE}'],
        ['Destination', '${KJEMO_DEST}'],
        ['Etiquette', '${KJEMO_ETIQUETTE}'],
        ['Compression', '${KJEMO_COMPRESSION}'],
      ]),
      ...blocConfirmation({
        phraseAttendue: `SAUVEGARDER ${etiquette}`,
        variableSaisie: 'KJEMO_CONFIRMATION',
        action: `archiver ${String(v.source).trim()} vers ${String(v.destination).trim()}`,
      }),
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - TOUT VERIFIER AVANT D ECRIRE',
      '#',
      '# L ordre compte. Une archive interrompue a mi-chemin par un disque plein',
      '# est un fichier qui a l air d une sauvegarde et n en est pas une : il',
      '# apparaitra dans la liste, et c est celui qu on essaiera de restaurer le',
      '# jour ou on en aura besoin.',
      '# ---------------------------------------------------------------------------',
      'kjemo_exiger_chemin_sur "${KJEMO_SOURCE}" \'Dossier a sauvegarder\'',
      '# Chemin canonique : indispensable ICI, parce que la comparaison',
      '# "destination dans la source" plus bas serait faussee par une barre',
      '# oblique en trop ou un segment "." dans l un des deux chemins.',
      'KJEMO_SOURCE="${KJEMO_CHEMIN_CANON}"',
      'kjemo_exiger_chemin_sur "${KJEMO_DEST}" \'Dossier de destination\'',
      'KJEMO_DEST="${KJEMO_CHEMIN_CANON}"',
      '',
      'if [ ! -d "${KJEMO_SOURCE}" ]; then',
      '  printf \'ARRET : la source %s n est pas un dossier. Rien n a ete ecrit.\\n\' "${KJEMO_SOURCE}" >&2',
      '  exit 1',
      'fi',
      '# La destination DANS la source ferait s archiver l archive elle-meme. Le',
      '# formulaire le refuse deja ; le script le reverifie, parce qu un script',
      '# genere peut etre relance avec un chemin modifie a la main.',
      'case "${KJEMO_DEST}/" in',
      '  "${KJEMO_SOURCE}"/*)',
      '    printf \'ARRET : la destination est DANS la source. L archive s archiverait\\n\' >&2',
      '    printf \'elle-meme et remplirait le disque. Rien n a ete ecrit.\\n\' >&2',
      '    exit 1',
      '    ;;',
      'esac',
      'if [ "${KJEMO_DEST}" = "${KJEMO_SOURCE}" ]; then',
      '  printf \'ARRET : destination identique a la source. Rien n a ete ecrit.\\n\' >&2',
      '  exit 1',
      'fi',
      '',
      'if [ ! -d "${KJEMO_DEST}" ]; then',
      '  printf \'ARRET : la destination %s n existe pas.\\n\' "${KJEMO_DEST}" >&2',
      '  printf \'Cree-la volontairement avant de sauvegarder : " mkdir -p %s "\\n\' "${KJEMO_DEST}" >&2',
      '  printf \'Ce script ne cree pas de dossier de destination, pour ne pas ecrire\\n\' >&2',
      '  printf \'une sauvegarde a un endroit qui serait une faute de frappe.\\n\' >&2',
      '  exit 1',
      'fi',
      'if [ ! -w "${KJEMO_DEST}" ]; then',
      '  printf \'ARRET : %s n est pas inscriptible par cette session.\\n\' "${KJEMO_DEST}" >&2',
      '  exit 1',
      'fi',
      '',
      '# La place disponible, comparee a la taille de la source. Sans compression',
      '# on exige la taille entiere plus 10 %% ; avec compression on exige quand',
      '# meme la moitie, parce qu une compression ne garantit rien sur des donnees',
      '# deja compressees - des photos ou des videos ne se compressent pas.',
      'kjemo_taille_src=0',
      'kjemo_taille_src="$(du -sk -- "${KJEMO_SOURCE}" 2>/dev/null | cut -f1 || echo 0)"',
      'kjemo_dispo_kio=0',
      'kjemo_dispo_kio="$(df -Pk -- "${KJEMO_DEST}" | awk \'NR==2 {print $4}\' || echo 0)"',
      "if [ \"${KJEMO_COMPRESSION}\" = 'aucune' ]; then",
      '  kjemo_requis=$(( kjemo_taille_src + kjemo_taille_src / 10 ))',
      'else',
      '  kjemo_requis=$(( kjemo_taille_src / 2 ))',
      'fi',
      "kjemo_resultat 'Place' 'Source' 'INFO' \"$((kjemo_taille_src / 1024)) Mio\" ''",
      "kjemo_resultat 'Place' 'Disponible' 'INFO' \"$((kjemo_dispo_kio / 1024)) Mio\" ''",
      'if [ "${kjemo_dispo_kio}" -lt "${kjemo_requis}" ]; then',
      '  printf \'ARRET : place insuffisante sur la destination.\\n\' >&2',
      '  printf \'  Requis estime : %s Mio\\n\' "$((kjemo_requis / 1024))" >&2',
      '  printf \'  Disponible    : %s Mio\\n\' "$((kjemo_dispo_kio / 1024))" >&2',
      '  printf \'Rien n a ete ecrit. Une archive interrompue par un disque plein\\n\' >&2',
      '  printf \'ressemble a une sauvegarde sans en etre une.\\n\' >&2',
      '  exit 1',
      'fi',
      '',
      '# L outil de compression demande doit EXISTER avant qu on commence.',
      "if [ \"${KJEMO_COMPRESSION}\" = 'zstd' ] && ! kjemo_dispo zstd; then",
      '  printf \'ARRET : zstd a ete demande mais n est pas installe.\\n\' >&2',
      '  printf \'Installe-le (" sudo apt install zstd ") ou choisis gzip.\\n\' >&2',
      '  exit 1',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE MANIFESTE, AVANT L ARCHIVE',
      '#',
      '# Le manifeste liste ce qui DEVAIT entrer dans l archive, avec les',
      '# empreintes. Il est construit avant, pour pouvoir comparer apres : une',
      '# archive dont le contenu ne correspond pas au manifeste est detectable,',
      '# alors qu une archive sans manifeste ne se verifie que contre elle-meme,',
      '# ce qui ne prouve rien.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_HORODATAGE="$(date +%Y%m%d-%H%M%S)"',
      `KJEMO_BASE="\${KJEMO_DEST}/\${KJEMO_ETIQUETTE}-\${KJEMO_HORODATAGE}"`,
      `KJEMO_ARCHIVE="\${KJEMO_BASE}${ext}"`,
      '# Le manifeste est d abord construit dans le dossier TEMPORAIRE, et non',
      '# dans la destination. Il a une valeur de diagnostic meme sans',
      '# confirmation : il dit combien de fichiers seraient archives : mais',
      '# l ecrire dans la destination serait une ECRITURE, et un script non',
      '# confirme doit en produire ZERO. Il est copie a cote de l archive',
      '# seulement si l archivage a lieu.',
      'KJEMO_MANIFESTE_TMP="${KJEMO_TMP}/manifeste.tsv"',
      'KJEMO_MANIFESTE="${KJEMO_BASE}.manifeste.tsv"',
      'KJEMO_EMPREINTES="${KJEMO_BASE}.sha256"',
      '',
      '# Aucun ecrasement, jamais. Si le nom existe deja, on s arrete : ecraser une',
      '# sauvegarde est le contraire de sauvegarder.',
      'for kjemo_x in "${KJEMO_ARCHIVE}" "${KJEMO_MANIFESTE}" "${KJEMO_EMPREINTES}"; do',
      '  if [ -e "${kjemo_x}" ]; then',
      '    printf \'ARRET : %s existe deja. Rien n a ete ecrit ni ecrase.\\n\' "${kjemo_x}" >&2',
      '    exit 1',
      '  fi',
      'done',
      '',
      'kjemo_nb_src=0',
      '{',
      '  printf \'%s\\t%s\\t%s\\n\' \'chemin\' \'octets\' \'sha256\'',
      '  while IFS= read -r -d \'\' kjemo_f; do',
      '    kjemo_t="$(stat -c %s -- "${kjemo_f}" 2>/dev/null || echo 0)"',
      '    kjemo_h="$(sha256sum -- "${kjemo_f}" 2>/dev/null | cut -d\' \' -f1 || echo illisible)"',
      '    printf \'%s\\t%s\\t%s\\n\' "$(kjemo_aplatir "${kjemo_f}")" "${kjemo_t}" "${kjemo_h}"',
      '  done < <(find "${KJEMO_SOURCE}" -type f -print0)',
      '} > "${KJEMO_MANIFESTE_TMP}"',
      'kjemo_nb_src="$(( $(wc -l < "${KJEMO_MANIFESTE_TMP}") - 1 ))"',
      "kjemo_resultat 'Manifeste' 'Fichiers recenses' 'INFO' \"${kjemo_nb_src}\" \\",
      "  'Construit dans le dossier temporaire. Il ne rejoindra la destination que si l archivage a lieu.'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - L ARCHIVE',
      '#',
      '# -C pour entrer dans le dossier parent et archiver des chemins RELATIFS :',
      '# une archive de chemins absolus se restaure par-dessus l original, ce qui',
      '# est exactement ce qu on ne veut pas le jour d une restauration.',
      '#',
      '# --numeric-owner conserve les UID/GID en chiffres : sur une autre machine,',
      '# les noms d utilisateurs ne correspondent pas, et tar inventerait des',
      '# proprietaires.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PARENT="$(dirname -- "${KJEMO_SOURCE}")"',
      'KJEMO_FEUILLE="$(basename -- "${KJEMO_SOURCE}")"',
      'kjemo_tar=(tar --create --numeric-owner --preserve-permissions',
      '  --file "${KJEMO_ARCHIVE}" -C "${KJEMO_PARENT}" "${KJEMO_FEUILLE}")',
      "case \"${KJEMO_COMPRESSION}\" in",
      '  gzip) kjemo_tar=(tar --create --gzip --numeric-owner --preserve-permissions',
      '    --file "${KJEMO_ARCHIVE}" -C "${KJEMO_PARENT}" "${KJEMO_FEUILLE}") ;;',
      '  zstd) kjemo_tar=(tar --create --zstd --numeric-owner --preserve-permissions',
      '    --file "${KJEMO_ARCHIVE}" -C "${KJEMO_PARENT}" "${KJEMO_FEUILLE}") ;;',
      'esac',
      '',
      '# La porte finale : la place, les chemins et la confirmation ont ete',
      '# verifies plus haut, chacun posant son indicateur. Rien n est ecrit si',
      '# l un manque, et celui qui manque est NOMME.',
      '# Les autres conditions : chemins acceptes, place suffisante, outil de',
      '# compression present : ont deja fait sortir le script plus haut en cas',
      '# d echec : arriver ici signifie qu elles sont remplies. Seule la',
      '# confirmation reste a verifier, et c est la derniere porte.',
      'if [ "${KJEMO_CONFIRMATION_OK}" -ne 1 ]; then KJEMO_AGIR=0; else KJEMO_AGIR=1; fi',
      'if [ "${KJEMO_AGIR}" -ne 1 ]; then',
      '  printf \'\\n%s\\n\' \'AUCUNE ECRITURE : la phrase de confirmation est absente ou inexacte.\'',
      '  printf \'%s\\n\' \'Tout a ete verifie : chemins, place disque, outil de compression.\'',
      '  printf \'%s\\n\' \'Relis le script, puis regenere-le avec la phrase exacte pour archiver.\'',
      '  printf \'%s\\n\' \'Ne retire aucune verification pour faire passer le script.\'',
      '  printf \'\\n\'',
      'else',
      '',
      '# Le manifeste rejoint la destination MAINTENANT, et pas avant : la',
      '# confirmation est acquise, l archivage va avoir lieu.',
      'cp -p -- "${KJEMO_MANIFESTE_TMP}" "${KJEMO_MANIFESTE}"',
      'printf \'Archivage en cours...\\n\'',
      'kjemo_code_tar=0',
      '"${kjemo_tar[@]}" 2>"${KJEMO_TMP}/tar.err" || kjemo_code_tar=$?',
      'if [ "${kjemo_code_tar}" -ne 0 ]; then',
      "  kjemo_resultat 'Archive' 'Creation' 'PROBLEME' \"code ${kjemo_code_tar}\" \\",
      "    'tar a echoue. L archive partielle est SUPPRIMEE pour ne pas passer pour une sauvegarde valide.'",
      // printf refuse un format qui commence par « -- » : il le prend pour une
      // suite d options. Sous set -e, l echec de ce printf faisait sortir le
      // script AVANT le nettoyage juste en dessous — l archive partielle et le
      // manifeste restaient donc en place, et le message qui l annonce ne
      // s affichait jamais. Le lot avait deja corrige ce piege une fois, sur
      // « printf '--- fin ---' » ; il a survecu ici parce qu aucun test
      // n executait la branche d echec de tar. Le banc a mouchards l a trouve
      // a sa premiere passe D.
      '  printf \'%s\\n\' \'--- sortie de tar ---\' >&2',
      '  cat "${KJEMO_TMP}/tar.err" >&2',
      '  # Une archive partielle est plus dangereuse qu une archive absente : elle',
      '  # figure dans la liste et c est celle qu on essaiera de restaurer.',
      '  rm -f -- "${KJEMO_ARCHIVE}"',
      '  rm -f -- "${KJEMO_MANIFESTE}"',
      '  printf \'Archive partielle ET manifeste supprimes : un echec d archivage ne doit\\n\' >&2',
      '  printf \'laisser aucun fichier qui ressemble a une sauvegarde valide.\\n\' >&2',
      '  exit 1',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - VERIFIER L ARCHIVE PRODUITE',
      '#',
      '# C est l etape qu on saute toujours, et c est celle qui distingue une',
      '# sauvegarde d un fichier. On relit l archive, on compte ce qu elle',
      '# contient, et on compare au manifeste.',
      '# ---------------------------------------------------------------------------',
      '# tar --test-label relit l en-tete de l archive : c est le controle le moins',
      '# cher qui distingue un fichier tronque d une archive lisible. Son code',
      '# etait capture et JETE dans une version precedente : une verification dont',
      '# on ignore le resultat n est pas une verification.',
      'kjemo_code_t=0',
      'tar --test-label --file "${KJEMO_ARCHIVE}" >/dev/null 2>&1 || kjemo_code_t=$?',
      'if [ "${kjemo_code_t}" -ne 0 ]; then',
      "  kjemo_resultat 'Archive' 'Lisibilite de l en-tete' 'PROBLEME' \"code ${kjemo_code_t}\" \\",
      "    'tar ne relit pas l en-tete de l archive : elle est tronquee ou corrompue.'",
      'else',
      "  kjemo_resultat 'Archive' 'Lisibilite de l en-tete' 'OK' 'relue par tar' ''",
      'fi',
      'kjemo_nb_arch=0',
      'kjemo_nb_arch="$(tar --list --file "${KJEMO_ARCHIVE}" 2>/dev/null | grep -c -v \'/$\' || true)"',
      'kjemo_contenu_ok=1',
      'if [ "${kjemo_nb_arch}" -eq "${kjemo_nb_src}" ]; then',
      "  kjemo_resultat 'Archive' 'Verification du contenu' 'OK' \\",
      '    "${kjemo_nb_arch} fichier(s)" \\',
      "    'Le nombre de fichiers dans l archive correspond au manifeste.'",
      'else',
      '  kjemo_contenu_ok=0',
      "  kjemo_resultat 'Archive' 'Verification du contenu' 'PROBLEME' \\",
      '    "archive ${kjemo_nb_arch}, manifeste ${kjemo_nb_src}" \\',
      "    'ECART : l archive ne contient pas ce que le manifeste annonce. Ne compte pas sur cette sauvegarde.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LA PORTE DE RELECTURE',
      '#',
      '# Si l en-tete ne se relit pas, ou si le contenu ne correspond pas au',
      '# manifeste, la sauvegarde est inutilisable. Elle ne doit alors RIEN',
      '# laisser derriere elle : une archive illisible qui reste dans le dossier',
      '# figure dans la liste des sauvegardes, et c est celle-la qu on tentera de',
      '# restaurer le jour ou on en a besoin. Le meme raisonnement valait deja',
      '# pour une archive partielle ; il ne valait pas encore ici, et le banc a',
      '# mouchards l a mesure : deux fichiers restaient en place.',
      '#',
      '# La sortie d erreur de tar a deja ete affichee : rien n est perdu pour',
      '# comprendre, et rien ne reste pour tromper.',
      '# ---------------------------------------------------------------------------',
      'if [ "${kjemo_code_t}" -ne 0 ] || [ "${kjemo_contenu_ok}" -ne 1 ]; then',
      '  rm -f -- "${KJEMO_ARCHIVE}"',
      '  rm -f -- "${KJEMO_MANIFESTE}"',
      '  rm -f -- "${KJEMO_EMPREINTES}"',
      "  printf '%s\\n' 'RELECTURE EN ECHEC : archive, manifeste et empreintes SUPPRIMES.' >&2",
      "  printf '%s\\n' 'Une archive qui ne se relit pas ne doit pas rester dans le dossier de' >&2",
      "  printf '%s\\n' 'sauvegarde : elle y passerait pour valide. Rien n a ete conserve.' >&2",
      '  exit 1',
      'fi',
      '',
      '# L empreinte de l archive elle-meme, pour detecter une corruption plus tard.',
      'sha256sum -- "${KJEMO_ARCHIVE}" > "${KJEMO_EMPREINTES}"',
      'kjemo_sha_archive="$(cut -d\' \' -f1 < "${KJEMO_EMPREINTES}")"',
      'kjemo_taille_arch="$(stat -c %s -- "${KJEMO_ARCHIVE}" 2>/dev/null || echo 0)"',
      "kjemo_resultat 'Archive' 'Fichier produit' 'OK' \"${KJEMO_ARCHIVE}\" \\",
      '  "$((kjemo_taille_arch / 1024)) Kio, SHA-256 ${kjemo_sha_archive}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LES SAUVEGARDES EXISTANTES SONT COMPTEES, JAMAIS SUPPRIMEES',
      '#',
      '# Aucune rotation automatique. Supprimer une sauvegarde ancienne est une',
      '# decision qui depend de la politique de conservation, de la reglementation',
      '# et de ce que contiennent les donnees - rien qu un assistant puisse savoir.',
      '# ---------------------------------------------------------------------------',
      'kjemo_anciennes=0',
      'kjemo_anciennes="$(find "${KJEMO_DEST}" -maxdepth 1 -type f -name "${KJEMO_ETIQUETTE}-*" \\',
      '  -name \'*.tar*\' 2>/dev/null | wc -l | tr -d \' \' || echo 0)"',
      "kjemo_resultat 'Conservation' 'Archives presentes' 'INFO' \"${kjemo_anciennes}\" \\",
      "  'AUCUNE suppression automatique. La rotation est une decision de politique de conservation, pas une tache d assistant.'",
      'printf \'\\n%s\\n\' \'--- Archives presentes pour cette etiquette ---\'',
      'find "${KJEMO_DEST}" -maxdepth 1 -type f -name "${KJEMO_ETIQUETTE}-*" -name \'*.tar*\' \\',
      '  -printf \'  %TY-%Tm-%Td %TH:%TM  %10s octets  %p\\n\' 2>/dev/null | sort || true',
      'printf \'\\n\'',
      'printf \'%s\\n\' \'--- Pour restaurer, a copier tel quel ---\'',
      'printf \'  Verifier l empreinte : sha256sum -c %s\\n\' "${KJEMO_EMPREINTES}"',
      'printf \'  Lister le contenu    : tar --list --file %s\\n\' "${KJEMO_ARCHIVE}"',
      'printf \'  Restaurer A COTE     : mkdir -p /tmp/restauration && tar --extract --file %s -C /tmp/restauration\\n\' "${KJEMO_ARCHIVE}"',
      'printf \'  (restaure TOUJOURS a cote d abord, jamais par-dessus l original)\\n\'',
      'printf \'\\n\'',
      'fi',
      ...blocRapportBash({ prefixeFichier: 'kjemo-sauvegarde' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine Linux.',
    'Vérifie la place disponible : « df -h /srv/sauvegardes » doit montrer plus que la taille de la source, donnée par « du -sh /srv/donnees ».',
    'Crée l\u2019archive : « tar --create --gzip --file /srv/sauvegardes/donnees-$(date +%Y%m%d).tar.gz -C /srv donnees ». Le « -C » archive des chemins relatifs, ce qui évite de restaurer par-dessus l\u2019original.',
    'Vérifie TOUJOURS l\u2019archive produite : « tar --list --file archive.tar.gz | wc -l » doit correspondre au nombre de fichiers de la source.',
    'Note l\u2019empreinte : « sha256sum archive.tar.gz > archive.sha256 », pour détecter une corruption plus tard.',
    'Pour restaurer, extrais d\u2019abord à côté dans un dossier temporaire, jamais directement par-dessus les fichiers en place.',
  ],

  keywords: ['sauvegarde', 'backup', 'archive', 'tar', 'dossier', 'manifeste', 'empreinte',
    'sha256', 'restauration', 'bash', 'linux', 'datee', 'compression', 'gzip', 'zstd', 'rotation'],

  // Était `true`, et c'était faux. Sauvegarder un dossier qu'on peut lire,
  // vers un dossier où l'on peut écrire, ne demande pas root. Le `true`
  // satisfaisait une règle de banc qui confondait le risque et l'élévation :
  // voir l'en-tête de PRIVILEGES_REQUIS dans dist/plateforme.mjs.
  //
  // Ce qui n'a PAS changé : `risk: 'caution'` et le verrou de confirmation du
  // script. Le risque ne baisse pas parce que l'élévation disparaît — ce sont
  // deux questions différentes. Et le script généré, lui, disait déjà la
  // vérité : il appelle blocPrivilegesBash({ exige: false }).
  requiresAdmin: false,
  prereqs: [
    'Le droit de LIRE la totalité du dossier source : un fichier illisible apparaît dans le manifeste comme « illisible » et manquera dans l\u2019archive.',
    'Le droit d\u2019ÉCRIRE dans le dossier de destination, qui doit exister : le script ne le crée pas, pour ne pas écrire une sauvegarde à l\u2019endroit d\u2019une faute de frappe.',
    'De la place : la totalité de la source plus 10 % sans compression, au moins la moitié avec compression.',
    'tar et coreutils, présents par défaut. Le paquet zstd seulement si tu choisis cette compression.',
  ],

  commonErrors: [
    { message: 'ARRET : la destination est DANS la source.', code: 'KJEMO',
      cause: 'L\u2019archive serait écrite à l\u2019intérieur du dossier qu\u2019elle archive : tar s\u2019archiverait lui-même et grossirait jusqu\u2019à remplir le disque.',
      fix: 'Choisir une destination hors de la source. C\u2019est vérifié deux fois, dans le formulaire et dans le script.' },
    { message: 'ARRET : place insuffisante sur la destination.', code: 'ENOSPC',
      cause: 'La comparaison entre la taille de la source et la place libre a échoué avant d\u2019écrire.',
      fix: 'Libérer de la place, ou choisir une destination sur un autre système de fichiers. Rien n\u2019a été écrit : une archive interrompue ressemblerait à une sauvegarde valide.',
      command: 'df -h /srv/sauvegardes' },
    { message: 'tar: /srv/donnees/x: Cannot open: Permission denied', code: 'EACCES',
      cause: 'Un fichier de la source n\u2019est pas lisible par la session. tar continue mais le fichier manque dans l\u2019archive.',
      fix: 'Relancer avec sudo, ou accepter l\u2019écart — qui sera détecté par la comparaison avec le manifeste et signalé en PROBLEME.' },
    { message: 'ECART : l archive ne contient pas ce que le manifeste annonce', code: 'KJEMO',
      cause: 'Le nombre de fichiers dans l\u2019archive diffère du manifeste : des fichiers illisibles, ou modifiés pendant l\u2019archivage.',
      fix: 'Ne pas compter sur cette sauvegarde. Relire la sortie de tar, corriger les permissions, et relancer sur un dossier qui n\u2019est pas en cours d\u2019écriture.' },
  ],

  reversible: true,
  verifyAfter: [
    'Les trois fichiers existent dans la destination : l\u2019archive, le manifeste .manifeste.tsv et l\u2019empreinte .sha256.',
    'La ligne « Verification du contenu » est à OK : le nombre de fichiers dans l\u2019archive correspond au manifeste.',
    'L\u2019empreinte se vérifie : « sha256sum -c » sur le fichier .sha256 répond « Réussi ».',
    'Les sauvegardes antérieures sont toujours là : la liste des archives présentes les montre toutes, et aucune n\u2019a été supprimée.',
    'Une extraction d\u2019essai dans /tmp restitue des chemins RELATIFS, et non des chemins absolus qui écraseraient l\u2019original.',
  ],

  rollback: {
    summary: 'L\u2019annulation consiste à supprimer l\u2019archive qui vient d\u2019être créée. Aucun fichier de la source n\u2019a été modifié, et aucune sauvegarde antérieure n\u2019a été touchée.',
    diagnostic: `# Ce qui a ete cree, et rien d autre :
ls -l /srv/sauvegardes/ | tail -10
# Verifier que la source est intacte — les dates doivent etre inchangees :
find /srv/donnees -maxdepth 1 -printf '%TY-%Tm-%Td %TH:%TM  %p\\n' | sort | tail -5`,
    command: `# Pour annuler, supprimer les trois fichiers produits. Le -i demande
# confirmation : c est volontaire, on supprime une sauvegarde.
#   rm -i /srv/sauvegardes/donnees-AAAAMMJJ-HHMMSS.tar.gz
#   rm -i /srv/sauvegardes/donnees-AAAAMMJJ-HHMMSS.manifeste.tsv
#   rm -i /srv/sauvegardes/donnees-AAAAMMJJ-HHMMSS.sha256
#
# La source n a pas ete modifiee : il n y a rien a y restaurer.
echo 'Pour annuler : supprimer les trois fichiers produits, listes ci-dessus.'`,
    warning: 'Une sauvegarde locale sur le même disque ne protège pas d\u2019une panne de ce disque : elle protège de l\u2019erreur humaine. Pour une vraie protection, copie l\u2019archive ailleurs. Et ne mets jamais en place de rotation automatique sans avoir décidé combien de temps tu dois conserver les données — ce script ne supprime rien, délibérément.',
  },

  checks: [
    'Aucune suppression de sauvegarde antérieure : le script compte les archives présentes et n\u2019exécute aucun rm dessus.',
    'Aucun écrasement : si l\u2019un des trois fichiers de sortie existe déjà, le script s\u2019arrête avant d\u2019écrire.',
    'La place disponible est comparée à la taille de la source AVANT d\u2019écrire, et une archive partielle due à un échec de tar est supprimée pour ne pas passer pour valide.',
    'L\u2019archive produite est RELUE et comparée au manifeste : le verdict ne repose pas sur le code de retour de tar.',
    'Les chemins archivés sont relatifs grâce à -C : une restauration ne peut pas écraser l\u2019original sans qu\u2019on l\u2019ait demandé.',
  ],

  source: `${M}/man1/tar.1.html`,
  sources: [
    { label: 'tar(1)', url: `${M}/man1/tar.1.html` },
    { label: 'sha256sum(1)', url: `${M}/man1/sha256sum.1.html` },
    { label: 'df(1)', url: `${M}/man1/df.1.html` },
    { label: 'du(1)', url: `${M}/man1/du.1.html` },
  ],
};

const bashCsvReport = {
  id: 'bash-csv-report',
  icon: '△',
  category: CAT,
  subcategory: 'Bash et automatisation',
  title: 'Rapport CSV système, correctement échappé',
  risk: 'diagnostic',
  summary: 'Produit un rapport CSV de l\u2019état du système, avec un échappement correct des virgules, guillemets et retours à la ligne — ce qui est précisément ce que la plupart des scripts CSV faits à la main ratent.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['coreutils et procps (présents par défaut)'],
  privileges: 'aucun',
  privilegesRequis: 'aucun',
  readOnly: false,
  service: null,
  limites: [
    'Écrit UN fichier CSV dans le dossier que tu désignes. N\u2019écrit rien d\u2019autre, et ne modifie aucun réglage.',
    'Le CSV suit la convention RFC 4180 : séparateur virgule, guillemets doubles, guillemet interne doublé. Un tableur configuré en point-virgule demandera de choisir le séparateur à l\u2019import.',
    'Les mesures sont celles de l\u2019instant : ce n\u2019est pas un outil de supervision, et deux exécutions donneront des chiffres différents.',
    'Sans privilèges, les processus des autres utilisateurs sont visibles mais certains détails manquent.',
  ],

  fields: [
    { id: 'destination', label: 'Dossier où écrire le CSV', default: '/srv/rapports',
      help: 'Chemin absolu, hors zones système. Le dossier doit exister.' },
    { id: 'etiquette', label: 'Étiquette du fichier', default: 'etat-systeme',
      help: 'Le nom final porte l\u2019étiquette, le nom d\u2019hôte et l\u2019horodatage.' },
    { id: 'sections', label: 'Contenu du rapport', type: 'select', default: 'Complet',
      options: [['Systemes', 'Systèmes de fichiers seulement'], ['Services', 'Services en échec seulement'], ['Complet', 'Complet — systèmes, services, mémoire, processus']],
      help: 'Chaque section ajoute des lignes au même fichier.' },
    { id: 'nbProcessus', label: 'Nombre de processus les plus gourmands', type: 'number',
      default: '10', min: '0', max: '50',
      help: '0 pour ne pas inclure les processus.' },
  ],

  validate(v) {
    const errors = {};
    const d = validateCheminAbsolu(v.destination, 'Le dossier de destination');
    if (!d.ok) errors.destination = d.error;
    const e = validateNomFichier(v.etiquette, 'L\u2019étiquette');
    if (!e.ok) errors.etiquette = e.error;
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(String(v.etiquette).trim())) {
      errors.etiquette = 'L\u2019étiquette ne doit contenir que lettres, chiffres, tirets et soulignés.';
    }
    const s = validateChoix(v.sections, ['Systemes', 'Services', 'Complet'], 'Le contenu');
    if (!s.ok) errors.sections = s.error;
    const n = validateEntierBorne(v.nbProcessus, 0, 50, 'Le nombre de processus');
    if (!n.ok) errors.nbProcessus = n.error;
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    return assemblerSh([
      ...enteteBash({
        titre: 'Rapport CSV de l etat du systeme, echappement RFC 4180',
        outil: this.id, diagnostic: true, root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocGardienChemin({ lectureSeule: false }),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_DEST', shQuote(String(v.destination).trim().replace(/\/+$/, ''))],
        ['KJEMO_ETIQUETTE', shQuote(String(v.etiquette).trim())],
        ['KJEMO_SECTIONS', shQuote(String(v.sections))],
        ['KJEMO_NB_PROC', shQuote(String(v.nbProcessus))],
        ['KJEMO_FORMAT', shQuote('Console')],
      ]),
      ...blocParametresBash([
        ['Destination', '${KJEMO_DEST}'],
        ['Etiquette', '${KJEMO_ETIQUETTE}'],
        ['Contenu', '${KJEMO_SECTIONS}'],
        ['Processus', '${KJEMO_NB_PROC}'],
      ]),
      'kjemo_exiger_chemin_sur "${KJEMO_DEST}" \'Dossier de destination\'',
      'KJEMO_DEST="${KJEMO_CHEMIN_CANON}"',
      'if [ ! -d "${KJEMO_DEST}" ]; then',
      '  printf \'ARRET : %s n existe pas. Cree-le volontairement :\\n\' "${KJEMO_DEST}" >&2',
      '  printf \'  mkdir -p %s\\n\' "${KJEMO_DEST}" >&2',
      '  exit 1',
      'fi',
      'if [ ! -w "${KJEMO_DEST}" ]; then',
      '  printf \'ARRET : %s n est pas inscriptible par cette session.\\n\' "${KJEMO_DEST}" >&2',
      '  exit 1',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# L ECHAPPEMENT CSV, ET POURQUOI IL FAUT S EN OCCUPER',
      '#',
      '# Un rapport CSV fait a la main avec " printf \'%s,%s\\n\' " casse des qu une',
      '# valeur contient une virgule : le nom de service " apache2, nginx " devient',
      '# deux colonnes, et TOUTES les colonnes suivantes se decalent. Le fichier',
      '# s ouvre quand meme dans le tableur, sans erreur, avec des valeurs dans les',
      '# mauvaises colonnes. C est le pire genre de defaut : silencieux et credible.',
      '#',
      '# La regle RFC 4180, appliquee par kjemo_csv_champ :',
      '#   - tout champ est entoure de guillemets doubles ;',
      '#   - chaque guillemet interne est DOUBLE ;',
      '#   - une virgule ou un retour a la ligne dans un champ est alors inoffensif.',
      '#',
      '# Le BOM : volontairement ABSENT. Excel sous Windows en veut un pour',
      '# reconnaitre l UTF-8, mais il casse la lecture par awk, python et la',
      '# plupart des outils Unix. Le choix est fait pour Unix, et la fiche explique',
      '# comment en ajouter un si le fichier part vers Excel.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_HORODATAGE="$(date +%Y%m%d-%H%M%S)"',
      'KJEMO_HOTE="$(hostname 2>/dev/null || echo machine)"',
      'KJEMO_CSV="${KJEMO_DEST}/${KJEMO_ETIQUETTE}-${KJEMO_HOTE}-${KJEMO_HORODATAGE}.csv"',
      'if [ -e "${KJEMO_CSV}" ]; then',
      '  printf \'ARRET : %s existe deja. Rien n a ete ecrit.\\n\' "${KJEMO_CSV}" >&2',
      '  exit 1',
      'fi',
      '',
      '# Une ligne CSV : chaque champ passe par kjemo_csv_champ, sans exception.',
      'kjemo_ligne_csv() {',
      '  local sortie=\'\' premier=1 champ=\'\'',
      '  for champ in "$@"; do',
      '    if [ "${premier}" -eq 0 ]; then sortie="${sortie},"; fi',
      '    premier=0',
      '    sortie="${sortie}$(kjemo_csv_champ "${champ}")"',
      '  done',
      '  printf \'%s\\n\' "${sortie}"',
      '}',
      '',
      'kjemo_nb_lignes=0',
      '{',
      '  kjemo_ligne_csv \'categorie\' \'element\' \'mesure\' \'valeur\' \'unite\' \'commentaire\' \'horodatage\'',
      '',
      '  # --- Systemes de fichiers ---',
      "  if [ \"${KJEMO_SECTIONS}\" = 'Systemes' ] || [ \"${KJEMO_SECTIONS}\" = 'Complet' ]; then",
      '    # Le troisieme champ (espace utilise) n est pas exploite ici : on',
      '    # rapporte le pourcentage et le total. Il est donc lu dans _, et c est',
      '    # volontaire : une variable nommee et jamais lue fait croire a un oubli.',
      '    while IFS=\' \' read -r kjemo_fs kjemo_total _ kjemo_pct kjemo_pt; do',
      '      if [ -z "${kjemo_pt:-}" ] || [ "${kjemo_fs}" = \'Filesystem\' ]; then continue; fi',
      '      kjemo_ligne_csv \'systeme-de-fichiers\' "${kjemo_pt}" \'remplissage\' \\',
      '        "${kjemo_pct%\\%}" \'pourcent\' "${kjemo_fs}" "$(date --iso-8601=seconds 2>/dev/null || date)"',
      '      kjemo_ligne_csv \'systeme-de-fichiers\' "${kjemo_pt}" \'total\' \\',
      '        "${kjemo_total}" \'kio\' "${kjemo_fs}" "$(date --iso-8601=seconds 2>/dev/null || date)"',
      '    done < <(df -Pk -x tmpfs -x devtmpfs -x squashfs -x overlay | awk \'NR>1 {print $1, $2, $3, $5, $6}\')',
      '  fi',
      '',
      '  # --- Services en echec ---',
      "  if [ \"${KJEMO_SECTIONS}\" = 'Services' ] || [ \"${KJEMO_SECTIONS}\" = 'Complet' ]; then",
      '    if kjemo_dispo systemctl; then',
      '      # La DESCRIPTION d une unite contient tres souvent une virgule : c est',
      '      # exactement le champ qui casse un CSV fait a la main.',
      '      while IFS=$\'\\x1f\' read -r kjemo_u kjemo_desc; do',
      '        if [ -z "${kjemo_u:-}" ]; then continue; fi',
      '        kjemo_ligne_csv \'service\' "${kjemo_u}" \'etat\' \'failed\' \'etat\' \\',
      '          "${kjemo_desc:-}" "$(date --iso-8601=seconds 2>/dev/null || date)"',
      '      done < <(systemctl list-units --state=failed --no-legend --plain 2>/dev/null \\',
      '        | awk \'{u=$1; $1=""; $2=""; $3=""; $4=""; sub(/^ +/,""); printf "%s\\x1f%s\\n", u, $0}\' || true)',
      '    fi',
      '  fi',
      '',
      '  # --- Memoire ---',
      "  if [ \"${KJEMO_SECTIONS}\" = 'Complet' ]; then",
      '    if kjemo_dispo free; then',
      '      while IFS=\' \' read -r kjemo_quoi kjemo_tot kjemo_use; do',
      '        if [ -z "${kjemo_use:-}" ]; then continue; fi',
      '        kjemo_ligne_csv \'memoire\' "${kjemo_quoi}" \'utilisee\' "${kjemo_use}" \'mio\' \\',
      '          "total ${kjemo_tot} Mio" "$(date --iso-8601=seconds 2>/dev/null || date)"',
      '      done < <(free -m | awk \'/^Mem:|^Swap:/ {gsub(":","",$1); print $1, $2, $3}\')',
      '    fi',
      '    kjemo_ligne_csv \'charge\' \'moyenne-1min\' \'charge\' \\',
      '      "$(cut -d\' \' -f1 /proc/loadavg 2>/dev/null || echo 0)" \'charge\' \\',
      '      "$(nproc 2>/dev/null || echo 1) coeur(s)" "$(date --iso-8601=seconds 2>/dev/null || date)"',
      '  fi',
      '',
      '  # --- Processus ---',
      '  if [ "${KJEMO_NB_PROC}" -gt 0 ]; then',
      '    # La LIGNE DE COMMANDE d un processus contient des virgules, des',
      '    # guillemets et parfois des retours a la ligne. Sans echappement, ce',
      '    # champ seul suffit a rendre le CSV illisible.',
      '    while IFS=$\'\\x1f\' read -r kjemo_pid kjemo_cpu kjemo_mem kjemo_cmd; do',
      '      if [ -z "${kjemo_cmd:-}" ]; then continue; fi',
      '      kjemo_ligne_csv \'processus\' "${kjemo_pid}" \'cpu\' "${kjemo_cpu}" \'pourcent\' \\',
      '        "${kjemo_cmd}" "$(date --iso-8601=seconds 2>/dev/null || date)"',
      '      kjemo_ligne_csv \'processus\' "${kjemo_pid}" \'memoire\' "${kjemo_mem}" \'pourcent\' \\',
      '        "${kjemo_cmd}" "$(date --iso-8601=seconds 2>/dev/null || date)"',
      '    done < <(ps -eo pid=,pcpu=,pmem=,args= --sort=-pcpu 2>/dev/null \\',
      '      | head -n "${KJEMO_NB_PROC}" \\',
      '      | awk \'{p=$1; c=$2; m=$3; $1=""; $2=""; $3=""; sub(/^ +/,""); printf "%s\\x1f%s\\x1f%s\\x1f%s\\n", p, c, m, $0}\' || true)',
      '  fi',
      '} > "${KJEMO_CSV}"',
      '',
      'kjemo_nb_lignes="$(( $(wc -l < "${KJEMO_CSV}") - 1 ))"',
      "kjemo_resultat 'Rapport' 'Fichier CSV' 'OK' \"${KJEMO_CSV}\" \\",
      '  "${kjemo_nb_lignes} ligne(s) de donnees, en-tete comprise non comptee."',
      '',
      '# ---------------------------------------------------------------------------',
      '# AUTO-CONTROLE DU CSV PRODUIT',
      '#',
      '# Un rapport CSV qui s ecrit sans erreur peut etre decale : c est le defaut',
      '# habituel du CSV fait a la main. On compte donc les champs de chaque ligne',
      '# et on exige qu ils soient tous identiques a l en-tete. Un decalage devient',
      '# visible ICI, et non trois semaines plus tard dans un tableur.',
      '#',
      '# Le comptage respecte les guillemets : une virgule DANS un champ cite ne',
      '# compte pas comme un separateur. C est tout l interet de l echappement.',
      '# ---------------------------------------------------------------------------',
      'kjemo_colonnes_attendues=7',
      'kjemo_mauvaises=0',
      'kjemo_ligne_no=0',
      'while IFS= read -r kjemo_l; do',
      '  kjemo_ligne_no=$((kjemo_ligne_no + 1))',
      '  # Compte les virgules situees HORS guillemets.',
      '  kjemo_n="$(printf \'%s\' "${kjemo_l}" | awk \'{',
      '    dans=0; n=1;',
      '    for (i=1; i<=length($0); i++) {',
      '      c=substr($0,i,1);',
      '      if (c=="\\"") dans=!dans;',
      '      else if (c=="," && !dans) n++;',
      '    }',
      '    print n;',
      '  }\')"',
      '  if [ "${kjemo_n}" -ne "${kjemo_colonnes_attendues}" ]; then',
      '    kjemo_mauvaises=$((kjemo_mauvaises + 1))',
      "    kjemo_resultat 'CSV' \"Ligne ${kjemo_ligne_no}\" 'PROBLEME' \"${kjemo_n} colonnes\" \\",
      '      "Attendu ${kjemo_colonnes_attendues} colonnes : cette ligne est decalee."',
      '  fi',
      'done < "${KJEMO_CSV}"',
      'if [ "${kjemo_mauvaises}" -eq 0 ]; then',
      "  kjemo_resultat 'CSV' 'Structure' 'OK' \"${kjemo_colonnes_attendues} colonnes partout\" \\",
      "    'Toutes les lignes ont le meme nombre de colonnes, virgules internes comprises.'",
      'else',
      "  kjemo_resultat 'CSV' 'Structure' 'PROBLEME' \"${kjemo_mauvaises} ligne(s) decalee(s)\" \\",
      "    'Le fichier est decale : ne l exploite pas tel quel.'",
      'fi',
      '',
      'printf \'\\n%s\\n\' \'--- Les cinq premieres lignes, pour controle visuel ---\'',
      'head -5 "${KJEMO_CSV}"',
      'printf \'\\n%s\\n\' \'--- Pour exploiter le fichier ---\'',
      'printf \'  Ouvrir dans un tableur : separateur VIRGULE, encodage UTF-8, guillemet double\\n\'',
      'printf \'  Pour Excel sous Windows, qui veut un BOM UTF-8 :\\n\'',
      'printf \'    printf \\x27\\\\xEF\\\\xBB\\\\xBF\\x27 | cat - %s > %s.excel.csv\\n\' "${KJEMO_CSV}" "${KJEMO_CSV%.csv}"',
      'printf \'  (le BOM est volontairement absent du fichier principal : il casse awk et python)\\n\'',
      'printf \'\\n\'',
      ...blocRapportBash({ prefixeFichier: 'kjemo-csv' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine Linux.',
    'Pour un état rapide sans fichier : « df -h », « free -h », « systemctl --failed », « ps -eo pid,pcpu,pmem,args --sort=-pcpu | head ».',
    'Si tu construis un CSV à la main, entoure CHAQUE champ de guillemets doubles et double les guillemets internes : une virgule dans une description de service décale sinon toutes les colonnes suivantes.',
    'Vérifie toujours la structure du fichier produit : « awk -F\'","\' \'{print NF}\' rapport.csv | sort -u » doit donner une seule valeur.',
    'À l\u2019import dans un tableur, choisis explicitement le séparateur virgule et l\u2019encodage UTF-8 ; ne laisse pas la détection automatique décider.',
  ],

  keywords: ['csv', 'rapport', 'export', 'tableur', 'excel', 'echappement', 'rfc4180',
    'virgule', 'guillemet', 'bash', 'linux', 'etat', 'systeme', 'processus', 'inventaire'],

  requiresAdmin: false,
  prereqs: [
    'Un dossier de destination qui existe et dans lequel la session peut écrire.',
    'coreutils et procps, présents par défaut sur Ubuntu et Debian.',
    'Un chemin hors des zones système : le gardien refuse /etc, /boot, /root et les dossiers techniques.',
  ],

  commonErrors: [
    { message: 'Le CSV s\u2019ouvre dans le tableur avec tout dans la première colonne', code: 'KJEMO',
      cause: 'Le tableur est configuré pour attendre le point-virgule comme séparateur — courant en configuration française.',
      fix: 'À l\u2019import, choisir explicitement la virgule comme séparateur, ou passer par « Données » puis « À partir d\u2019un fichier texte » plutôt que par un double-clic.' },
    { message: 'Les accents sont illisibles dans Excel', code: 'KJEMO',
      cause: 'Excel sous Windows suppose l\u2019encodage local tant qu\u2019il n\u2019y a pas de BOM UTF-8.',
      fix: 'Le fichier est volontairement sans BOM, parce qu\u2019un BOM casse awk et python. La dernière ligne de sortie donne la commande exacte pour produire une copie avec BOM destinée à Excel.' },
    { message: 'PROBLEME : cette ligne est decalee', code: 'KJEMO',
      cause: 'Une ligne n\u2019a pas le bon nombre de colonnes. L\u2019auto-contrôle l\u2019a détecté avant exploitation.',
      fix: 'Ne pas exploiter le fichier. Relancer en réduisant le contenu pour isoler la section fautive, et signaler le cas.' },
    { message: 'ARRET : le dossier de destination n existe pas', code: 'ENOENT',
      cause: 'Le script ne crée pas le dossier, pour ne pas écrire un rapport à l\u2019endroit d\u2019une faute de frappe.',
      fix: 'Créer le dossier volontairement, puis relancer.',
      command: 'mkdir -p /srv/rapports' },
  ],

  reversible: true,
  verifyAfter: [
    'Le fichier CSV existe dans le dossier désigné, avec l\u2019étiquette, le nom d\u2019hôte et l\u2019horodatage dans son nom.',
    'La ligne « CSV / Structure » est à OK : toutes les lignes ont le même nombre de colonnes, virgules internes comprises.',
    'Les cinq premières lignes affichées montrent chaque champ entouré de guillemets doubles.',
    'Aucun fichier existant n\u2019a été écrasé : le script s\u2019arrête si le nom est déjà pris.',
  ],

  rollback: {
    summary: 'L\u2019annulation consiste à supprimer le fichier CSV produit. Aucun réglage du système n\u2019a été modifié : l\u2019outil lit et écrit un seul fichier.',
    diagnostic: `# Le fichier produit, et rien d autre :
ls -lt /srv/rapports/ | head -5
# Verifier qu aucun reglage n a change : aucune unite ne doit avoir ete touchee.
systemctl list-units --state=failed --no-legend | head`,
    command: `# Pour annuler, supprimer le fichier produit :
#   rm -i /srv/rapports/etat-systeme-*.csv
# Aucun reglage du systeme n a ete modifie : il n y a rien d autre a defaire.
echo 'Pour annuler : supprimer le fichier CSV produit.'`,
    warning: 'Un rapport CSV de processus contient les lignes de commande complètes, qui peuvent inclure des noms de bases, des chemins internes et parfois des paramètres sensibles passés en argument. Relis le fichier avant de le joindre à un ticket ou de le déposer sur un partage.',
  },

  checks: [
    'Chaque champ du CSV passe par la fonction d\u2019échappement : aucun printf n\u2019écrit une valeur brute entre deux virgules.',
    'Le fichier produit est RELU et la structure vérifiée colonne par colonne, en respectant les guillemets — un décalage est détecté avant exploitation.',
    'Aucun écrasement : le script s\u2019arrête si le nom de fichier existe déjà.',
    'Le script ne modifie aucun réglage : il ne contient ni systemctl start, ni apt, ni kill, ni écriture hors du fichier CSV.',
  ],

  source: `${M}/man1/df.1.html`,
  sources: [
    { label: 'df(1)', url: `${M}/man1/df.1.html` },
    { label: 'free(1)', url: `${M}/man1/free.1.html` },
    { label: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/bash.html' },
    { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
  ],
};

const cronReadiness = {
  id: 'cron-readiness',
  icon: '△',
  category: CAT,
  subcategory: 'Bash et automatisation',
  title: 'Préparation et diagnostic d\u2019une tâche cron',
  risk: 'diagnostic',
  summary: 'Vérifie qu\u2019un script est prêt à tourner sous cron, explique les pièges de l\u2019environnement réduit, et AFFICHE la ligne de crontab à installer — sans jamais l\u2019installer.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['cron (à installer sur une image minimale : apt install cron)'],
  privileges: 'aucun pour le diagnostic ; l\u2019installation de la tâche se fait ensuite à la main',
  privilegesRequis: 'aucun',
  readOnly: true,
  service: 'cron.service',
  limites: [
    'N\u2019INSTALLE PAS la tâche. Il affiche la ligne à installer et explique les risques : installer silencieusement une tâche planifiée est exactement ce qu\u2019un assistant ne doit pas faire.',
    'Ne modifie aucune crontab, ni celle de l\u2019utilisateur, ni celles de /etc/cron.d.',
    'Ne peut pas prédire si le script réussira sous cron : il vérifie les causes d\u2019échec les plus fréquentes, pas toutes.',
    'Les minuteries systemd (systemd.timer) sont souvent préférables à cron sur une machine moderne, mais elles sortent du cadre de cet assistant.',
  ],

  fields: [
    { id: 'script', label: 'Chemin absolu du script à planifier', default: '/srv/scripts/mon-traitement.sh',
      help: 'Le script doit exister. Cron n\u2019utilise pas ton PATH : le chemin doit être absolu.' },
    { id: 'frequence', label: 'Fréquence', type: 'select', default: 'Quotidien',
      options: [
        ['Horaire', 'Chaque heure'],
        ['Quotidien', 'Chaque jour'],
        ['Hebdomadaire', 'Chaque semaine'],
        ['Mensuel', 'Chaque mois'],
      ],
      help: 'La minute exacte est décalée volontairement : voir l\u2019explication dans le rapport.' },
    { id: 'heure', label: 'Heure d\u2019exécution (0-23)', type: 'number', default: '3', min: '0', max: '23',
      help: 'Ignorée pour la fréquence horaire.' },
    { id: 'journal', label: 'Fichier de journal de la tâche', default: '/srv/scripts/journaux/cron.log',
      help: 'Cron envoie sinon la sortie par courriel local, que personne ne lit.' },
    // Un rapport de préparation se garde : on y revient quand la tâche ne part
    // pas, trois semaines plus tard. Le sélecteur de format est donc là pour la
    // même raison que sur les autres diagnostics.
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const s = validateCheminAbsolu(v.script, 'Le chemin du script');
    if (!s.ok) errors.script = s.error;
    else if (!/\.sh$/.test(String(v.script).trim())) {
      errors.script = 'Le chemin doit désigner un script .sh.';
    }
    const f = validateChoix(v.frequence, ['Horaire', 'Quotidien', 'Hebdomadaire', 'Mensuel'], 'La fréquence');
    if (!f.ok) errors.frequence = f.error;
    const h = validateEntierBorne(v.heure, 0, 23, 'L\u2019heure');
    if (!h.ok) errors.heure = h.error;
    const j = validateCheminAbsolu(v.journal, 'Le fichier de journal');
    if (!j.ok) errors.journal = j.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const script = String(v.script).trim();
    const freq = String(v.frequence);
    const heure = Number(v.heure);
    // La minute est decalee a partir du nom du script, comme le fait le depot
    // pour ses taches planifiees : une tache a la minute 0 part en meme temps
    // que toutes les autres taches de la planete, et le serveur rame.
    const minute = (script.replace(/[^a-zA-Z]/g, '').length % 50) + 7;
    const cron = freq === 'Horaire' ? `${minute} * * * *`
      : freq === 'Quotidien' ? `${minute} ${heure} * * *`
        : freq === 'Hebdomadaire' ? `${minute} ${heure} * * 1`
          : `${minute} ${heure} 1 * *`;
    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostic de preparation d une tache cron - N INSTALLE RIEN',
        outil: this.id, diagnostic: true, root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocGardienChemin({ lectureSeule: true }),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_SCRIPT', shQuote(script)],
        ['KJEMO_FREQUENCE', shQuote(freq)],
        ['KJEMO_JOURNAL', shQuote(String(v.journal).trim())],
        ['KJEMO_LIGNE_CRON', shQuote(cron)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Script', '${KJEMO_SCRIPT}'],
        ['Frequence', '${KJEMO_FREQUENCE}'],
        ['Journal', '${KJEMO_JOURNAL}'],
      ]),
      '# ---------------------------------------------------------------------------',
      '# CE SCRIPT N INSTALLE RIEN',
      '#',
      '# Il ne contient aucun appel a crontab, et n ecrit dans aucun fichier de',
      '# /etc/cron.d ni dans /var/spool/cron. Une tache planifiee installee',
      '# silencieusement est une commande qui s executera a 3 h du matin sans que',
      '# personne se souvienne de l avoir mise la - et c est comme cela qu on',
      '# decouvre, des mois plus tard, un script qui remplit un disque.',
      '#',
      '# La ligne est AFFICHEE, avec les risques. L installation reste un geste',
      '# volontaire, fait par une personne qui a lu la ligne.',
      '# ---------------------------------------------------------------------------',
      '',
      '# --- 1. Le script existe-t-il et est-il executable ? ---',
      '# Le gardien se prononce d abord : un chemin dans .ssh ou .git n a pas a',
      '# etre lu, meme pour un diagnostic.',
      'kjemo_exiger_chemin_sur "${KJEMO_SCRIPT}" \'Script a planifier\'',
      'KJEMO_SCRIPT="${KJEMO_CHEMIN_CANON}"',
      'if [ ! -e "${KJEMO_SCRIPT}" ]; then',
      "  kjemo_resultat 'Script' 'Existence' 'PROBLEME' \"${KJEMO_SCRIPT}\" \\",
      "    'Le fichier n existe pas. Cron echouerait silencieusement a chaque passage.'",
      'else',
      "  kjemo_resultat 'Script' 'Existence' 'OK' \"${KJEMO_SCRIPT}\" ''",
      '  if [ -x "${KJEMO_SCRIPT}" ]; then',
      "    kjemo_resultat 'Script' 'Bit d execution' 'OK' 'present' ''",
      '  else',
      "    kjemo_resultat 'Script' 'Bit d execution' 'ATTENTION' 'absent' \\",
      "      'Sans bit x, la ligne cron doit appeler bash explicitement. La ligne proposee plus bas le fait deja.'",
      '  fi',
      '  # Le shebang : cron execute avec /bin/sh par defaut. Un script bash sans',
      '  # shebang lance par sh echoue sur la premiere construction non POSIX.',
      '  kjemo_tete="$(head -c 2 -- "${KJEMO_SCRIPT}" 2>/dev/null || echo \'\')"',
      '  if [ "${kjemo_tete}" = \'#!\' ]; then',
      '    kjemo_shebang="$(head -1 -- "${KJEMO_SCRIPT}" 2>/dev/null || echo \'\')"',
      "    kjemo_resultat 'Script' 'Shebang' 'OK' \"${kjemo_shebang}\" ''",
      '  else',
      "    kjemo_resultat 'Script' 'Shebang' 'PROBLEME' 'absent' \\",
      "      'Sans shebang, cron utilise /bin/sh : toute construction propre a bash echouerait.'",
      '  fi',
      '  # Un BOM devant le shebang : le noyau ne reconnait plus #! du tout.',
      '  kjemo_trois="$(head -c 3 -- "${KJEMO_SCRIPT}" 2>/dev/null | od -An -tx1 | tr -d \' \\n\' || echo \'\')"',
      '  if [ "${kjemo_trois}" = \'efbbbf\' ]; then',
      "    kjemo_resultat 'Script' 'BOM UTF-8' 'PROBLEME' 'present' \\",
      "      'Un BOM avant #! masque le shebang : bad interpreter. Retire-le.'",
      '  fi',
      '  # Des fins de ligne CRLF : meme consequence.',
      '  if head -1 -- "${KJEMO_SCRIPT}" 2>/dev/null | grep -q $\'\\r\'; then',
      "    kjemo_resultat 'Script' 'Fins de ligne' 'PROBLEME' 'CRLF' \\",
      "      'Fins de ligne Windows : le shebang devient introuvable. Convertis en LF.'",
      '  fi',
      '  if kjemo_dispo bash; then',
      '    if bash -n -- "${KJEMO_SCRIPT}" 2>"${KJEMO_TMP}/syn.err"; then',
      "      kjemo_resultat 'Script' 'Syntaxe' 'OK' 'bash -n passe' ''",
      '    else',
      "      kjemo_resultat 'Script' 'Syntaxe' 'PROBLEME' \\",
      '        "$(head -3 "${KJEMO_TMP}/syn.err" 2>/dev/null || true)" \\',
      "        'Le script ne passe pas bash -n : il echouerait a chaque passage de cron.'",
      '    fi',
      '  fi',
      'fi',
      '',
      '# --- 2. Le service cron tourne-t-il ? ---',
      'if kjemo_dispo systemctl; then',
      '  kjemo_etat_cron="$(systemctl is-active cron.service 2>/dev/null || true)"',
      '  if [ -z "${kjemo_etat_cron}" ] || [ "${kjemo_etat_cron}" = \'inactive\' ] \\',
      '      || [ "${kjemo_etat_cron}" = \'unknown\' ]; then',
      '    kjemo_etat_cron="$(systemctl is-active crond.service 2>/dev/null || true)"',
      '  fi',
      '  if [ "${kjemo_etat_cron}" = \'active\' ]; then',
      "    kjemo_resultat 'Service' 'cron' 'OK' 'active' ''",
      '  else',
      "    kjemo_resultat 'Service' 'cron' 'PROBLEME' \"${kjemo_etat_cron:-absent}\" \\",
      "      'Le service cron ne tourne pas : aucune tache planifiee ne partira. Sur une image minimale, le paquet cron n est pas installe.'",
      '  fi',
      'fi',
      '',
      '# --- 3. Le dossier du journal est-il pret ? ---',
      '# Cron redirige la sortie vers un courriel local que personne ne lit. Un',
      '# fichier de journal est la premiere chose a mettre en place, et son dossier',
      '# doit exister AVANT : cron ne le creera pas, et la tache echouera en',
      '# silence a chaque passage.',
      'KJEMO_DOSSIER_JOURNAL="$(dirname -- "${KJEMO_JOURNAL}")"',
      'if [ -d "${KJEMO_DOSSIER_JOURNAL}" ]; then',
      '  if [ -w "${KJEMO_DOSSIER_JOURNAL}" ]; then',
      "    kjemo_resultat 'Journal' 'Dossier' 'OK' \"${KJEMO_DOSSIER_JOURNAL}\" 'existe et inscriptible'",
      '  else',
      "    kjemo_resultat 'Journal' 'Dossier' 'PROBLEME' \"${KJEMO_DOSSIER_JOURNAL}\" \\",
      "      'Existe mais non inscriptible : la redirection echouerait a chaque passage.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Journal' 'Dossier' 'ATTENTION' \"${KJEMO_DOSSIER_JOURNAL}\" \\",
      "    'N existe pas. Cree-le AVANT d installer la tache : cron ne le creera pas.'",
      'fi',
      '',
      '# --- 4. L environnement reduit de cron, le piege numero un ---',
      '#',
      '# Cron ne lit ni .bashrc, ni .profile, ni /etc/environment. Le PATH vaut',
      '# typiquement /usr/bin:/bin, et rien d autre. Un script qui marche dans ton',
      '# terminal et echoue sous cron, c est presque toujours cela.',
      "kjemo_resultat 'Environnement' 'PATH sous cron' 'INFO' '/usr/bin:/bin' \\",
      "  'Cron ne lit NI .bashrc NI .profile NI /etc/environment. Appelle tes commandes par leur chemin absolu, ou pose un PATH en tete de crontab.'",
      '# Les commandes du script qui ne sont pas dans le PATH minimal de cron.',
      'if [ -f "${KJEMO_SCRIPT}" ] && [ -r "${KJEMO_SCRIPT}" ]; then',
      '  kjemo_hors_path=0',
      '  for kjemo_cmd in $(grep -oE \'^[[:space:]]*[a-z][a-z0-9_-]+\' -- "${KJEMO_SCRIPT}" 2>/dev/null \\',
      '      | tr -d \' \\t\' | sort -u | head -40); do',
      '    kjemo_ou="$(command -v "${kjemo_cmd}" 2>/dev/null || true)"',
      '    if [ -n "${kjemo_ou}" ]; then',
      '      case "${kjemo_ou}" in',
      '        /usr/bin/*|/bin/*) : ;;',
      '        *)',
      '          kjemo_hors_path=$((kjemo_hors_path + 1))',
      "          kjemo_resultat 'Environnement' \"Commande ${kjemo_cmd}\" 'ATTENTION' \"${kjemo_ou}\" \\",
      "            'Hors du PATH minimal de cron (/usr/bin:/bin). Appelle-la par son chemin absolu dans le script.'",
      '          ;;',
      '      esac',
      '    fi',
      '  done',
      '  if [ "${kjemo_hors_path}" -eq 0 ]; then',
      "    kjemo_resultat 'Environnement' 'Commandes du script' 'OK' 'toutes dans /usr/bin ou /bin' ''",
      '  fi',
      'fi',
      '',
      '# --- 5. Les crontabs EXISTANTES, en lecture seule ---',
      '# Pour voir si la tache est deja installee, ou si une tache voisine part a',
      '# la meme minute.',
      'if kjemo_dispo crontab; then',
      '  kjemo_crontab="${KJEMO_TMP}/crontab.txt"',
      '  if crontab -l > "${kjemo_crontab}" 2>/dev/null; then',
      '    kjemo_nb_taches="$(grep -cE \'^[^#[:space:]]\' "${kjemo_crontab}" || true)"',
      "    kjemo_resultat 'Crontab' 'Taches de cet utilisateur' 'INFO' \"${kjemo_nb_taches}\" ''",
      '    if grep -qF -- "${KJEMO_SCRIPT}" "${kjemo_crontab}"; then',
      "      kjemo_resultat 'Crontab' 'Deja planifie' 'ATTENTION' 'oui' \\",
      "        'Ce script figure DEJA dans la crontab. Installer la ligne une seconde fois le ferait tourner deux fois.'",
      '      printf \'\\n%s\\n\' \'--- Lignes existantes mentionnant ce script ---\'',
      '      grep -nF -- "${KJEMO_SCRIPT}" "${kjemo_crontab}" || true',
      "      printf '\\n'",
      '    else',
      "      kjemo_resultat 'Crontab' 'Deja planifie' 'OK' 'non' ''",
      '    fi',
      '  else',
      "    kjemo_resultat 'Crontab' 'Taches de cet utilisateur' 'INFO' 'aucune' \\",
      "      'Aucune crontab pour cet utilisateur, ou lecture impossible.'",
      '  fi',
      'fi',
      '',
      '# --- 6. La ligne a installer, affichee et expliquee ---',
      'printf \'\\n%s\\n\' \'=== LIGNE DE CRONTAB PROPOSEE - A INSTALLER A LA MAIN ===\'',
      'printf \'\\n\'',
      'printf \'  %s cd %s && /bin/bash %s >> %s 2>&1\\n\' \\',
      '  "${KJEMO_LIGNE_CRON}" \\',
      '  "$(dirname -- "${KJEMO_SCRIPT}")" \\',
      '  "${KJEMO_SCRIPT}" \\',
      '  "${KJEMO_JOURNAL}"',
      'printf \'\\n%s\\n\' \'--- Ce que chaque morceau fait, et pourquoi ---\'',
      'printf \'  %s\\n\' "${KJEMO_LIGNE_CRON}"',
      'printf \'      La minute n est PAS 0, volontairement : a la minute 0 toutes les\\n\'',
      'printf \'      taches de la machine - et de beaucoup d autres - partent ensemble.\\n\'',
      'printf \'  cd <dossier du script>\\n\'',
      'printf \'      Cron demarre dans le dossier personnel, pas dans celui du script.\\n\'',
      "printf '      Tout chemin relatif du script serait resolu ailleurs que prevu.\\n'",
      'printf \'  /bin/bash <script>\\n\'',
      'printf \'      Chemin ABSOLU de bash, et bash explicitement : cron utilise /bin/sh\\n\'',
      'printf \'      par defaut, qui ne connait pas les constructions propres a bash.\\n\'',
      'printf \'  >> <journal> 2>&1\\n\'',
      'printf \'      Sortie ET erreurs dans le journal. Sans cela, cron envoie tout par\\n\'',
      'printf \'      courriel local, que personne ne lit jamais.\\n\'',
      'printf \'\\n%s\\n\' \'--- Pour l installer, quand tu auras lu la ligne ---\'',
      'printf \'  crontab -e          puis coller la ligne, enregistrer, quitter\\n\'',
      'printf \'  crontab -l          pour verifier qu elle est bien la\\n\'',
      'printf \'\\n%s\\n\' \'--- Avant de planifier, trois questions a te poser ---\'',
      'printf \'  1. Que se passe-t-il si DEUX executions se chevauchent ? Si la reponse\\n\'',
      'printf \'     n est pas " rien ", il faut un verrou (flock).\\n\'',
      'printf \'  2. Le journal va-t-il grossir sans fin ? Prevois une rotation.\\n\'',
      'printf \'  3. Qui sera prevenu si la tache echoue tous les jours pendant un mois ?\\n\'',
      'printf \'     Un code de sortie non nul ne previent personne tout seul.\\n\'',
      'printf \'\\n%s\\n\' \'--- Une alternative, souvent meilleure ---\'',
      'printf \'  Sur une machine systemd, une minuterie (systemd.timer) offre les\\n\'',
      'printf \'  journaux dans journalctl, les dependances, les relances et un etat\\n\'',
      'printf \'  interrogeable. Cron reste plus simple et parfaitement valable.\\n\'',
      'printf \'\\n\'',
      "kjemo_resultat 'Installation' 'Tache installee par ce script' 'INFO' 'NON' \\",
      "  'Ce script n installe RIEN. La ligne est affichee ; l installation reste un geste volontaire.'",
      ...blocRapportBash({ prefixeFichier: 'kjemo-cron' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine Linux.',
    'Vérifie que cron tourne : « systemctl is-active cron » doit répondre « active ». Sur une image minimale, installe d\u2019abord le paquet cron.',
    'Contrôle ton script avant de le planifier : « bash -n /srv/scripts/mon-traitement.sh » puis « shellcheck » dessus.',
    'Édite ta crontab avec « crontab -e » — jamais en écrivant directement dans /var/spool/cron, qui n\u2019est pas un format à éditer à la main.',
    'Termine toujours la ligne par « >> /chemin/journal.log 2>&1 » : sans redirection, cron envoie la sortie par courriel local que personne ne lit.',
    'Appelle bash par son chemin absolu : cron exécute avec /bin/sh et un PATH réduit à /usr/bin:/bin.',
    'Vérifie ensuite avec « crontab -l », et relis le journal après le premier passage prévu.',
  ],

  keywords: ['cron', 'crontab', 'planification', 'tache', 'automatisation', 'planifier',
    'periodique', 'bash', 'linux', 'path', 'environnement', 'journal', 'flock', 'timer', 'systemd'],

  requiresAdmin: false,
  prereqs: [
    'Le paquet cron installé : absent de certaines images serveur minimales et de la plupart des conteneurs.',
    'Un script existant, dont le chemin est absolu et qui passe « bash -n ».',
    'Un dossier de journal qui existe et dans lequel la session peut écrire — cron ne le créera pas.',
  ],

  commonErrors: [
    { message: 'La tâche ne part jamais, et il n\u2019y a aucune trace', code: 'KJEMO',
      cause: 'Trois causes, toutes vérifiées par ce diagnostic : le service cron ne tourne pas, le dossier du journal n\u2019existe pas, ou le script n\u2019est pas exécutable.',
      fix: 'Lire les lignes « Service / cron », « Journal / Dossier » et « Script / Bit d execution » du rapport.',
      command: 'systemctl status cron' },
    { message: 'command not found, alors que la commande marche dans mon terminal', code: 'ENOENT',
      cause: 'Le piège numéro un de cron : il ne lit ni .bashrc, ni .profile, ni /etc/environment. Le PATH vaut /usr/bin:/bin.',
      fix: 'Appeler la commande par son chemin absolu, ou poser « PATH=... » en tête de crontab. Le rapport liste les commandes du script qui sortent de ce PATH minimal.',
      command: 'command -v ma-commande' },
    { message: 'Syntax error: "(" unexpected', code: 'KJEMO',
      cause: 'Cron a exécuté le script avec /bin/sh, qui ne connaît pas les tableaux ni les substitutions de processus de bash.',
      fix: 'Appeler « /bin/bash script.sh » dans la ligne de crontab, et vérifier que le script porte bien son shebang.' },
    { message: 'Le script tourne deux fois en parallèle et produit n\u2019importe quoi', code: 'KJEMO',
      cause: 'Cron relance avant la fin du passage précédent. Aucun verrou n\u2019empêche le chevauchement.',
      fix: 'Ajouter un verrou flock. L\u2019assistant bash-script-starter en produit un prêt à l\u2019emploi.',
      command: 'flock -n /tmp/ma-tache.verrou /bin/bash /srv/scripts/mon-traitement.sh' },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport se termine par la ligne « Tache installee par ce script : NON » — c\u2019est la garantie que rien n\u2019a été planifié.',
    'La ligne de crontab proposée est affichée, avec l\u2019explication de chacun de ses morceaux.',
    'Si le script figure déjà dans la crontab, une ligne ATTENTION le signale et les lignes existantes sont montrées.',
    'Après avoir installé la ligne à la main, « crontab -l » la montre, et le journal contient une trace après le premier passage prévu.',
  ],

  rollback: {
    summary: 'Rien à annuler : cet assistant ne modifie aucune crontab. Il lit la crontab existante et affiche une ligne à installer.',
    diagnostic: `# La crontab n a pas change : comparer avec ce que tu attends.
crontab -l
# Et les crontabs systeme, qu aucun assistant du lot ne touche :
ls -l /etc/cron.d/ 2>/dev/null
ls -l /etc/cron.daily/ 2>/dev/null`,
    command: `# Rien a annuler : ce script ne contient aucun appel a « crontab » en
# ECRITURE, et n ecrit dans aucun fichier de /etc/cron.d.
#
# Si TU as installe la ligne et veux la retirer :
#   crontab -e      puis supprimer la ligne, enregistrer, quitter
# Pour sauvegarder la crontab avant de l editer, ce qui est une bonne habitude :
#   crontab -l > "\${HOME}/crontab-sauvegarde-$(date +%Y%m%d).txt"
echo 'Diagnostic en lecture seule : aucune tache planifiee, rien a defaire.'`,
    warning: 'Une tâche planifiée est une commande qui s\u2019exécutera sans personne devant l\u2019écran. Avant d\u2019installer la ligne, réponds aux trois questions affichées par le rapport : le chevauchement, la croissance du journal, et qui sera prévenu en cas d\u2019échec répété. Un script qui échoue tous les jours pendant un mois sans alerter personne est le résultat habituel d\u2019une planification faite trop vite.',
  },

  checks: [
    'Le script ne contient aucun appel à crontab en écriture : pas de « crontab fichier », pas de « crontab - », aucune écriture dans /etc/cron.d ni /var/spool/cron.',
    'La crontab existante est lue avec « crontab -l » seulement, et le script signale si la tâche y figure déjà.',
    'La minute proposée n\u2019est jamais 0 : elle est dérivée du nom du script, pour éviter que toutes les tâches partent en même temps.',
    'La ligne proposée contient le chemin absolu de bash et la redirection « >> journal 2>&1 », les deux omissions qui font échouer une tâche en silence.',
  ],

  source: `${M}/man5/crontab.5.html`,
  sources: [
    { label: 'crontab(5)', url: `${M}/man5/crontab.5.html` },
    { label: 'crontab(1)', url: `${M}/man1/crontab.1.html` },
    { label: 'cron(8)', url: `${M}/man8/cron.8.html` },
    { label: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/bash.html' },
  ],
};


export const toolsLinux = [
  linuxHealthReport,
  linuxSystemInventory,
  linuxBootDiagnostic,
  linuxLogDiagnostic,
  bashScriptStarter,
  bashFileBatch,
  bashBackupDirectory,
  bashCsvReport,
  cronReadiness,
];

export { CAT, M, OS_LINUX, DISTROS, SOURCES_SOCLE, CHAMP_FORMAT, validerFormat, VERSION_LINUX };
