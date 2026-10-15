/**
 * outils-linux-h.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Services, journaux, paquets et heure — quatre assistants.
 *
 *   linux-service-manage    démarre, arrête, active ou désactive une unité
 *                           systemd. Verbes AUTORISÉS seulement, et jamais sur
 *                           les unités qui portent la session en cours.
 *   linux-journal-explore   LIT le journal, et répond d'abord à la question
 *                           que personne ne se pose : ce journal survit-il au
 *                           redémarrage ?
 *   linux-package-install   met à jour l'index et installe des paquets, après
 *                           une SIMULATION dont le plan est relu — et refuse
 *                           si l'installation annonce une suppression.
 *   linux-time-sync         fuseau horaire et synchronisation NTP, par
 *                           timedatectl et un fichier drop-in, jamais en
 *                           écrasant le fichier de configuration.
 *
 * ---------------------------------------------------------------------------
 * LE FIL COMMUN : UN CODE DE RETOUR N'EST PAS UN ÉTAT
 * ---------------------------------------------------------------------------
 * Les quatre assistants partagent une discipline, et c'est la même erreur
 * qu'ils refusent de commettre :
 *
 *   `systemctl start x` rend 0        → le service a pu mourir deux secondes
 *                                       plus tard. On relit `is-active`.
 *   `apt-get install x` rend 0        → le paquet peut être « iU », à moitié
 *                                       configuré. On relit `dpkg-query`.
 *   `systemctl restart timesyncd`     → ne dit rien de la synchronisation.
 *     rend 0                            On relit `timedatectl show`.
 *
 * Un code de retour dit que la commande a été ACCEPTÉE. L'état, lui, se relit.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import {
  blocConfirmation, blocPorteFinale, blocEtatService, blocSauvegardeFichier,
} from './gardes-bash.mjs';
import {
  validateChoix, validateNomUnite, validateEntierBorne,
} from './validateurs-linux.mjs';
import { assertValid } from './noyau.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';
const DOC = 'https://documentation.ubuntu.com/server';

const OS_LINUX = [
  'Ubuntu Server 22.04 LTS et 24.04 LTS',
  'Ubuntu Desktop 22.04 et 24.04',
  'Debian 12 (bookworm)',
  'Toute distribution utilisant systemd et APT',
];

const DISTROS = ['Ubuntu 24.04 LTS (cible de référence)', 'Ubuntu 22.04 LTS', 'Debian 12'];

const CHAMP_FORMAT = {
  id: 'format',
  label: 'Format du rapport',
  type: 'select',
  default: 'Console',
  options: [['Console', 'Console seulement'], ['JSON', 'Console + fichier JSON'], ['CSV', 'Console + fichier CSV']],
  help: 'Le fichier est écrit dans ton dossier personnel, jamais ailleurs.',
};

function validerFormat(v, errors) {
  const r = validateChoix(v.format, ['Console', 'JSON', 'CSV'], 'Le format');
  if (!r.ok) errors.format = r.error;
}

const OUI_NON = [['Non', 'Non'], ['Oui', 'Oui']];

// ===========================================================================
// ASSISTANT 1 — AGIR SUR UNE UNITÉ SYSTEMD
// ===========================================================================

/**
 * Les six verbes autorisés, et leur traduction en commande.
 *
 * La liste est CLOSE, et c'est le fond de l'assistant. `systemctl` accepte
 * aussi `mask`, `kill`, `isolate`, `set-property`, `edit`… dont les effets
 * vont du déroutant à l'irréparable :
 *
 *   mask     remplace l'unité par un lien vers /dev/null. Le service devient
 *            indémarrable, y compris par ses dépendances, et `start` échoue
 *            avec un message que personne ne relie au masquage.
 *   kill     envoie un signal brut sans passer par l'arrêt propre de l'unité.
 *   isolate  arrête TOUT ce qui n'appartient pas à la cible demandée. Sur un
 *            serveur distant, c'est la fin de la session.
 *
 * Aucun de ces verbes n'est offert, et aucun champ ne permet d'en écrire un.
 */
const VERBES = {
  'Demarrer': { cmd: 'start', attendu: 'active', ecrit: false },
  'Arreter': { cmd: 'stop', attendu: 'inactive', ecrit: false },
  'Redemarrer': { cmd: 'restart', attendu: 'active', ecrit: false },
  'Recharger': { cmd: 'reload', attendu: 'active', ecrit: false },
  'Activer au demarrage': { cmd: 'enable', attendu: null, ecrit: true },
  'Desactiver au demarrage': { cmd: 'disable', attendu: null, ecrit: true },
};

/**
 * Les unités qu'on ne touche pas par script, et pourquoi chacune.
 *
 * La valeur est la liste des verbes refusés. `*` refuse tout.
 */
const UNITES_PROTEGEES = {
  'systemd-logind.service': '*',
  'dbus.service': '*',
  'dbus.socket': '*',
  'polkit.service': '*',
  'systemd-journald.service': '*',
  'systemd-journald.socket': '*',
  'systemd-udevd.service': '*',
  'systemd-resolved.service': ['stop', 'disable'],
  'systemd-networkd.service': ['stop', 'disable'],
  'NetworkManager.service': ['stop', 'disable'],
  'ssh.service': ['stop', 'disable'],
  'sshd.service': ['stop', 'disable'],
  'ufw.service': ['stop', 'disable'],
  'apparmor.service': ['stop', 'disable'],
  'getty@tty1.service': ['stop', 'disable'],
};

/** Les unités dont l'arrêt ou le redémarrage coupe une session distante. */
const UNITES_SESSION_DISTANTE = ['ssh.service', 'sshd.service', 'ssh.socket',
  'systemd-networkd.service', 'NetworkManager.service', 'networking.service'];

/** Normalise « ssh » en « ssh.service » : systemctl le fait, pas nos tables. */
function avecSuffixe(unite) {
  const s = String(unite ?? '').trim();
  return /\.[a-z]+$/.test(s) ? s : `${s}.service`;
}

const systemdServiceControl = {
  id: 'systemd-service-control',
  icon: '◈',
  category: CAT,
  subcategory: 'Services et journaux',
  title: 'Démarrer, arrêter ou activer une unité systemd',
  risk: 'caution',
  summary: 'Agit sur une unité systemd avec six verbes autorisés seulement — start, stop, restart, reload, enable, disable — et relit l’état par is-active et is-enabled plutôt que de se fier au code de retour. Refuse les unités qui portent la session en cours, refuse d’arrêter SSH ou le réseau depuis une session SSH, et n’offre ni mask, ni kill, ni isolate.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['systemd — systemctl, journalctl (présent par défaut)'],
  privileges: 'root — démarrer, arrêter ou activer une unité système est réservé à root',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'Six verbes, et la liste est close : start, stop, restart, reload, enable, disable. Ni « mask » — qui rend un service indémarrable par un lien vers /dev/null, avec un message que personne ne relie au masquage — ni « kill », ni « isolate », qui arrête tout ce qui n’appartient pas à la cible.',
    'Ne modifie aucun fichier d’unité. « systemctl edit » et l’écriture dans /etc/systemd/system ne sont pas offerts : un fichier d’unité fautif empêche le démarrage, et se corrige alors sans systemd.',
    'N’arrête ni ne désactive SSH, le réseau, logind, dbus, polkit, journald, udevd, AppArmor, UFW ni la console tty1. Chacun coupe soit la session en cours, soit le moyen de la rétablir.',
    '« Désactiver au démarrage » ne coupe PAS le service en cours : enable et disable décident du prochain démarrage, start et stop de maintenant. L’assistant ne combine jamais les deux dans la même action, parce que « disable --now » fait les deux et n’en annonce qu’une.',
    'Ne crée pas d’unité, ne recharge pas la configuration de systemd lui-même (daemon-reload n’est émis qu’après une modification de fichier d’unité, que cet assistant ne fait pas).',
  ],

  fields: [
    {
      id: 'unite',
      label: 'Unité systemd',
      type: 'text',
      default: 'nginx.service',
      placeholder: 'nginx.service',
      help: 'Le nom complet, suffixe compris. Sans suffixe, « .service » est ajouté. « systemctl list-units --type=service » les liste.',
    },
    {
      id: 'action',
      label: 'Action',
      type: 'select',
      default: 'Redemarrer',
      options: Object.keys(VERBES).map((k) => [k, k]),
      help: 'Activer et désactiver décident du prochain démarrage. Démarrer et arrêter décident de maintenant. Ce ne sont pas les mêmes questions.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation — retape le nom de l’unité',
      type: 'text',
      default: '',
      placeholder: 'nginx.service',
      optionnel: true,
      help: 'Sans cette phrase exacte, le script généré diagnostique et n’agit pas.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const u = validateNomUnite(v.unite, 'Le nom de l’unité');
    if (!u.ok) errors.unite = u.error;
    const a = validateChoix(v.action, Object.keys(VERBES), 'L’action');
    if (!a.ok) errors.action = a.error;

    if (u.ok && a.ok) {
      const unite = avecSuffixe(v.unite);
      const verbe = VERBES[String(v.action)].cmd;
      const protege = UNITES_PROTEGEES[unite];
      if (protege === '*') {
        errors.unite = `« ${unite} » est une unité dont dépend le fonctionnement de la session elle-même : logind, dbus, polkit, journald et udevd ne se pilotent pas par script. Y toucher coupe la session en cours, et souvent le moyen de la rétablir. systemd les gère lui-même.`;
      } else if (Array.isArray(protege) && protege.includes(verbe)) {
        errors.action = `« ${verbe} » est refusé sur « ${unite} ». Ce service porte soit l’accès à la machine (SSH, réseau), soit sa protection (UFW, AppArmor), soit la seule console locale : l’arrêter ou le désactiver par script laisse une machine qu’on ne peut plus joindre ni réparer. Les autres verbes restent disponibles.`;
      }
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const unite = avecSuffixe(v.unite);
    const action = String(v.action);
    const { cmd, attendu } = VERBES[action];

    return assemblerSh([
      ...enteteBash({
        titre: 'Agir sur une unite systemd, et relire son etat',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'piloter une unite systeme est reserve a root',
      }),
      ...blocEtatService(),
      ...blocVariablesBash([
        ['KJEMO_UNITE', shQuote(unite)],
        ['KJEMO_ACTION', shQuote(action)],
        ['KJEMO_VERBE', shQuote(cmd)],
        ['KJEMO_ATTENDU', shQuote(attendu ?? '')],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? ''))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      `KJEMO_UNITES_DISTANTES=(${UNITES_SESSION_DISTANTE.map((u) => shQuote(u)).join(' ')})`,
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Unite' \"${KJEMO_UNITE}\"",
      "  printf '%s\\t%s\\n' 'Action' \"${KJEMO_ACTION}\"",
      "  printf '%s\\t%s\\n' 'Verbe systemctl' \"${KJEMO_VERBE}\"",
      "  printf '%s\\t%s\\n' 'Etat attendu apres action' \"${KJEMO_ATTENDU:-sans changement d etat}\"",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - L UNITE EXISTE-T-ELLE ?',
      '#',
      '# « systemctl start inexistant.service » echoue avec un message clair.',
      '# Mais « systemctl enable » sur un nom mal orthographie peut creer un',
      '# lien vers une unite absente, et le probleme ne se voit qu au prochain',
      '# demarrage. On verifie donc que systemd CONNAIT l unite.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_UNITE_OK=0',
      'if ! kjemo_dispo systemctl; then',
      "  kjemo_resultat 'Prerequis' 'systemctl' 'PROBLEME' 'absent' \\",
      "    'Cette machine n utilise pas systemd. Les commandes de cet assistant ne s y appliquent pas.'",
      'elif systemctl cat -- "${KJEMO_UNITE}" > /dev/null 2>&1; then',
      '  KJEMO_UNITE_OK=1',
      '  KJEMO_CHARGE="$(systemctl show -p LoadState --value -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      '  KJEMO_DESCRIPTION="$(systemctl show -p Description --value -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Unite' \"${KJEMO_UNITE}\" 'OK' \"${KJEMO_CHARGE:-inconnu} - ${KJEMO_DESCRIPTION}\" \\",
      "    'Unite connue de systemd. La description vient de son propre fichier.'",
      'else',
      "  kjemo_resultat 'Unite' \"${KJEMO_UNITE}\" 'PROBLEME' 'inconnue de systemd' \\",
      "    'Aucune unite de ce nom. Verifie l orthographe et le suffixe : systemctl list-units --type=service --all | grep -i <motif>. Un enable sur un nom fautif peut passer et ne se voir qu au prochain demarrage.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - L ETAT AVANT',
      '#',
      '# Deux questions distinctes, et on les confond tout le temps :',
      '#   is-active   le service tourne-t-il MAINTENANT ?',
      '#   is-enabled  demarrera-t-il au PROCHAIN demarrage ?',
      '#',
      '# Un service « active » et « disabled » tourne et ne reviendra pas. Un',
      '# service « inactive » et « enabled » ne tourne pas et reviendra. Les deux',
      '# situations sont normales, et les deux surprennent.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_AVANT_ACTIF=\'inconnu\'',
      'KJEMO_AVANT_ACTIVE=\'inconnu\'',
      'if [ "${KJEMO_UNITE_OK}" -eq 1 ]; then',
      '  KJEMO_ETAT="$(kjemo_etat_unite "${KJEMO_UNITE}")"',
      '  KJEMO_AVANT_ACTIF="${KJEMO_ETAT%%|*}"',
      '  KJEMO_AVANT_ACTIVE="${KJEMO_ETAT##*|}"',
      "  kjemo_resultat 'Etat avant' 'is-active' 'INFO' \"${KJEMO_AVANT_ACTIF}\" \\",
      "    'Le service tourne-t-il maintenant.'",
      "  kjemo_resultat 'Etat avant' 'is-enabled' 'INFO' \"${KJEMO_AVANT_ACTIVE}\" \\",
      "    'Demarrera-t-il au prochain demarrage. « static » signifie qu il n a pas de reglage : il est demarre par une dependance, et enable n y change rien.'",
      '  # Le cas « deja dans l etat demande » : le dire, plutot que d agir pour',
      '  # rien et d annoncer un changement qui n a pas eu lieu.',
      '  if [ -n "${KJEMO_ATTENDU}" ] && [ "${KJEMO_AVANT_ACTIF}" = "${KJEMO_ATTENDU}" ] \\',
      '    && [ "${KJEMO_VERBE}" != \'restart\' ] && [ "${KJEMO_VERBE}" != \'reload\' ]; then',
      "    kjemo_resultat 'Etat avant' 'Deja dans l etat demande' 'ATTENTION' \"${KJEMO_AVANT_ACTIF}\" \\",
      "      'L unite est deja dans l etat voulu. L action sera executee quand meme — systemd la traite sans erreur — mais le changement annonce sera nul.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LA SESSION EN COURS EST-ELLE DISTANTE ?',
      '#',
      '# Arreter SSH depuis une session SSH coupe la session, et personne ne',
      '# peut la rouvrir. Le formulaire refuse deja stop et disable sur ces',
      '# unites ; le script reverifie, parce qu un script se relit et se',
      '# retouche — et parce que « restart » reste autorise et merite un',
      '# avertissement, pas un refus : il garde les sessions etablies, mais une',
      '# configuration fautive fera echouer le redemarrage et il n y aura plus',
      '# de nouvelle connexion possible.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SESSION_OK=1',
      'KJEMO_DISTANTE=0',
      'if [ -n "${SSH_CONNECTION:-}" ] || [ -n "${SSH_TTY:-}" ]; then',
      '  KJEMO_DISTANTE=1',
      "  kjemo_resultat 'Session' 'Type' 'ATTENTION' 'SSH' \\",
      "    'Cette session passe par SSH. Toute action sur SSH ou sur le reseau peut la couper, et la couper veut dire ne plus pouvoir reparer.'",
      'else',
      "  kjemo_resultat 'Session' 'Type' 'INFO' 'locale ou inconnue' \\",
      "    'Aucune variable SSH_CONNECTION : la session semble locale. Ce controle n est pas une preuve — une session dans un multiplexeur peut avoir perdu cette variable.'",
      'fi',
      'for kjemo_u in "${KJEMO_UNITES_DISTANTES[@]}"; do',
      '  if [ "${KJEMO_UNITE}" = "${kjemo_u}" ]; then',
      '    case "${KJEMO_VERBE}" in',
      '      stop|disable)',
      '        KJEMO_SESSION_OK=0',
      "        kjemo_resultat 'Session' 'Action refusee' 'PROBLEME' \"${KJEMO_VERBE} sur ${KJEMO_UNITE}\" \\",
      "          'Cette unite porte l acces a la machine. L arreter ou la desactiver par script laisse une machine injoignable, et aucune commande ne la ramene a distance. Si c est vraiment voulu, fais-le depuis la console locale, en sachant que tu ne pourras plus revenir par le reseau.'",
      '        ;;',
      '      restart|reload)',
      '        if [ "${KJEMO_DISTANTE}" -eq 1 ]; then',
      "          kjemo_resultat 'Session' 'Risque accepte' 'ATTENTION' \"${KJEMO_VERBE} sur ${KJEMO_UNITE}\" \\",
      "            'Les sessions SSH deja etablies survivent a un redemarrage du service. En revanche, si la configuration est fautive, le service ne redemarrera pas et AUCUNE nouvelle connexion ne sera possible. Garde cette session ouverte, et ouvre-en une seconde pour verifier avant de fermer celle-ci.'",
      '        fi',
      '        ;;',
      '    esac',
      '  fi',
      'done',
      '',
      ...blocConfirmation({
        phraseAttendue: unite,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `${cmd} sur ${unite}`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_UNITE_OK', 'L unite est inconnue de systemd.'],
          ['KJEMO_SESSION_OK', 'L action couperait l acces a la machine.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom de l unite.'],
        ],
        action: `l action ${cmd}`,
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - L ACTION, PUIS LA RELECTURE QUI DECIDE',
      '#',
      '# Le verbe est une variable figee par le generateur, prise dans une liste',
      '# CLOSE de six. Il n est jamais construit a partir d une saisie : un',
      '# champ libre ici permettrait « mask », « isolate » ou « kill », qui ne',
      '# sont pas des variantes mais des actes d une autre nature.',
      '# ---------------------------------------------------------------------------',
      '  case "${KJEMO_VERBE}" in',
      '    start|stop|restart|reload|enable|disable) : ;;',
      '    *)',
      "      printf '%s\\n' 'ARRET : verbe non autorise. Ce script a ete modifie a la main.' >&2",
      '      exit 1',
      '      ;;',
      '  esac',
      '',
      '  printf \'%s\\n\' "Action : systemctl ${KJEMO_VERBE} ${KJEMO_UNITE}"',
      '  kjemo_code=0',
      '  systemctl "${KJEMO_VERBE}" -- "${KJEMO_UNITE}" > "${KJEMO_TMP}/systemctl.out" 2>&1 || kjemo_code=$?',
      '  if [ "${kjemo_code}" -ne 0 ]; then',
      "    kjemo_resultat 'Action' \"${KJEMO_VERBE}\" 'PROBLEME' \"code ${kjemo_code}\" \\",
      '      "systemctl a refuse l action. Etat avant : ${KJEMO_AVANT_ACTIF} / ${KJEMO_AVANT_ACTIVE}."',
      '    printf \'%s\\n\' "ARRET : systemctl ${KJEMO_VERBE} a echoue." >&2',
      '    cat "${KJEMO_TMP}/systemctl.out" >&2',
      "    printf '%s\\n' '--- dernieres lignes du journal de l unite ---' >&2",
      '    journalctl -u "${KJEMO_UNITE}" -n 20 --no-pager >&2 2>/dev/null || true',
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Action' \"${KJEMO_VERBE}\" 'OK' 'commande acceptee' \\",
      "    'Acceptee ne veut pas dire effective : la relecture ci-dessous decide.'",
      '',
      '  # start, stop, restart et reload ont un etat attendu : on le relit.',
      '  if [ -n "${KJEMO_ATTENDU}" ]; then',
      '    if ! kjemo_relire_unite "${KJEMO_UNITE}" "${KJEMO_ATTENDU}" \'apres action\'; then',
      '      printf \'%s\\n\' "ARRET : l etat relu n est pas ${KJEMO_ATTENDU}. L action n a pas eu l effet annonce." >&2',
      '      exit 1',
      '    fi',
      '  fi',
      '',
      '  # enable et disable ne changent pas is-active : c est is-enabled qu il',
      '  # faut relire, et le dire evite de croire qu un enable a demarre le',
      '  # service — il ne le fait pas.',
      '  if [ "${KJEMO_VERBE}" = \'enable\' ] || [ "${KJEMO_VERBE}" = \'disable\' ]; then',
      '    sleep 1',
      '    KJEMO_APRES_ACTIVE="$(systemctl is-enabled -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      '    KJEMO_ATTENDU_ACTIVE=\'enabled\'',
      '    if [ "${KJEMO_VERBE}" = \'disable\' ]; then KJEMO_ATTENDU_ACTIVE=\'disabled\'; fi',
      '    if [ "${KJEMO_APRES_ACTIVE}" = "${KJEMO_ATTENDU_ACTIVE}" ]; then',
      "      kjemo_resultat 'Relecture' 'is-enabled' 'OK' \"${KJEMO_APRES_ACTIVE}\" \\",
      '        "Confirme par relecture. L etat courant du service n a PAS change : il est toujours ${KJEMO_AVANT_ACTIF}."',
      '    else',
      "      kjemo_resultat 'Relecture' 'is-enabled' 'PROBLEME' \"${KJEMO_APRES_ACTIVE:-inconnu}\" \\",
      '        "Etat attendu ${KJEMO_ATTENDU_ACTIVE}, etat relu ${KJEMO_APRES_ACTIVE:-inconnu}. Une unite « static » ou « masked » ne se laisse pas activer ainsi."',
      '      printf \'%s\\n\' "ARRET : is-enabled relu vaut ${KJEMO_APRES_ACTIVE:-inconnu}, et non ${KJEMO_ATTENDU_ACTIVE}." >&2',
      '      exit 1',
      '    fi',
      '  fi',
      '',
      '  # Ce que l action ne fait PAS : le dire explicitement.',
      '  case "${KJEMO_VERBE}" in',
      '    enable)',
      "      kjemo_resultat 'Portee' 'Ce qui n a pas change' 'ATTENTION' 'le service n a pas ete demarre' \\",
      "        'enable prepare le PROCHAIN demarrage. Pour le demarrer maintenant, c est une seconde action, deliberee.'",
      '      ;;',
      '    disable)',
      "      kjemo_resultat 'Portee' 'Ce qui n a pas change' 'ATTENTION' 'le service tourne toujours' \\",
      "        'disable ne coupe pas le service en cours. Pour l arreter maintenant, c est une seconde action, deliberee. « disable --now » ferait les deux et n en annoncerait qu une : cet assistant ne l offre pas.'",
      '      ;;',
      '  esac',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-service' }),
    ]);
  },

  gui: [
    'Regarde l’état avant, les deux questions séparément : « systemctl is-active nginx » et « systemctl is-enabled nginx ».',
    'Vérifie que systemd connaît l’unité : « systemctl cat nginx.service » affiche son fichier.',
    'Agis : « sudo systemctl restart nginx.service ».',
    'Ne te fie PAS au code de retour : relis l’état. « systemctl is-active nginx » après deux secondes.',
    'Si l’état n’est pas celui attendu, le journal de l’unité dit pourquoi : « journalctl -u nginx -n 30 --no-pager ».',
    'enable et disable décident du prochain démarrage, start et stop de maintenant : ce sont deux décisions, et « disable --now » les confond.',
    'N’utilise jamais « mask » pour « désactiver » : il rend le service indémarrable même par ses dépendances, et le message d’erreur ne parle pas du masquage.',
  ],

  keywords: ['systemctl', 'systemd', 'service', 'unite', 'unit', 'demarrer', 'arreter',
    'redemarrer', 'enable', 'disable', 'start', 'stop', 'restart', 'is-active',
    'is-enabled', 'mask', 'journalctl', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Le nom exact de l’unité, suffixe compris.',
    'sudo, ou une session root.',
    'Pour une action sur SSH ou le réseau : une seconde voie d’accès à la machine, console locale comprise.',
  ],

  commonErrors: [
    {
      message: 'Failed to start x.service: Unit x.service not found.',
      code: 'KJEMO',
      cause: 'Nom ou suffixe erroné. Beaucoup d’unités ne sont pas des .service : il y a aussi .socket, .timer, .target, .mount.',
      fix: 'Chercher le nom réel. L’assistant vérifie avec « systemctl cat » avant d’agir.',
      command: 'systemctl list-units --all | grep -i nginx',
    },
    {
      message: 'systemctl start rend 0 et le service ne tourne pas',
      code: 'KJEMO',
      cause: 'Le service a démarré puis s’est arrêté — configuration fautive, port déjà pris, fichier manquant. Le code de retour dit que la commande a été acceptée, pas que le service tourne.',
      fix: 'Relire is-active, puis le journal de l’unité. C’est ce que fait l’assistant.',
      command: 'systemctl is-active nginx; journalctl -u nginx -n 30 --no-pager',
    },
    {
      message: 'J’ai fait « enable » et le service ne tourne toujours pas',
      code: 'KJEMO',
      cause: 'enable prépare le prochain démarrage. Il ne démarre rien maintenant.',
      fix: 'Deux actions distinctes, et c’est voulu.',
      command: 'sudo systemctl start nginx',
    },
    {
      message: 'Unit x.service is masked.',
      code: 'KJEMO',
      cause: 'L’unité a été masquée : un lien vers /dev/null remplace son fichier. Elle est indémarrable, y compris par ses dépendances.',
      fix: 'Démasquer, en sachant pourquoi elle l’avait été. Cet assistant n’offre pas « mask », précisément parce que ce message ne parle pas du masquage.',
      command: 'systemctl status x.service; sudo systemctl unmask x.service',
    },
    {
      message: 'is-enabled répond « static »',
      code: 'KJEMO',
      cause: 'L’unité n’a pas de section [Install] : elle n’est pas destinée à être activée, elle est démarrée par une dépendance.',
      fix: 'Il n’y a rien à activer. Chercher quelle unité la tire : « systemctl list-dependencies --reverse x.service ».',
      command: 'systemctl list-dependencies --reverse x.service',
    },
  ],

  reversible: true,
  verifyAfter: [
    '« systemctl is-active <unité> » rend l’état attendu : active après start ou restart, inactive après stop.',
    '« systemctl is-enabled <unité> » rend enabled après enable, disabled après disable — et l’état courant n’a pas bougé.',
    'Le rapport contient une ligne « Relecture » : elle vient de systemctl, pas du code de retour de l’action.',
    'En cas d’échec, les vingt dernières lignes du journal de l’unité sont affichées sur l’erreur standard.',
    'Après une action sur SSH : une SECONDE session ouverte avant de fermer la première.',
  ],

  rollback: {
    summary: 'Chaque verbe a son inverse exact, et l’état d’origine est dans le rapport : is-active et is-enabled ont été relevés avant l’action.',
    diagnostic: `# L etat actuel, les deux questions separement :
systemctl is-active nginx.service
systemctl is-enabled nginx.service
systemctl status nginx.service --no-pager
# Ce que le journal dit de la derniere action :
journalctl -u nginx.service -n 30 --no-pager`,
    command: `# Reprends l etat releve AVANT l action, dans le rapport.
# start  <-> stop     enable <-> disable     restart n a pas d inverse :
#                                            c est l etat d avant qu on remet.

# Si le service tournait et ne tourne plus :
sudo systemctl start nginx.service

# S il ne tournait pas et tourne maintenant :
sudo systemctl stop nginx.service

# S il demarrait au boot et ne demarre plus :
sudo systemctl enable nginx.service

# S il ne demarrait pas au boot et demarre maintenant :
sudo systemctl disable nginx.service

# Et on relit, toujours :
systemctl is-active nginx.service; systemctl is-enabled nginx.service`,
    warning: 'Un « restart » ne s’annule pas : ce qui a été interrompu l’a été. Pour un service qui tient un état — une base de données, une file d’attente — un redémarrage peut perdre les opérations en cours, et c’est le service qui décide, pas systemd.',
  },

  checks: [
    'Six verbes autorisés, dans une liste close : start, stop, restart, reload, enable, disable. Le verbe est figé par le générateur et revérifié dans le script, qui sort en erreur si quelqu’un y a écrit autre chose.',
    'Ni mask, ni kill, ni isolate, ni edit : aucun champ ne permet de les écrire.',
    'Les unités dont dépend la session — logind, dbus, polkit, journald, udevd — sont refusées pour tous les verbes.',
    'stop et disable sont refusés sur SSH, le réseau, UFW, AppArmor et la console tty1, par le formulaire ET par le script.',
    'Une session SSH est détectée, et un restart de SSH ou du réseau y est signalé comme ATTENTION avec la conduite à tenir : garder la session, en ouvrir une seconde.',
    'L’unité doit être connue de systemd, vérifié par « systemctl cat » : un enable sur un nom fautif ne se verrait qu’au prochain démarrage.',
    'is-active et is-enabled sont relevés AVANT, séparément, et le rapport explique la différence.',
    'Le cas « déjà dans l’état demandé » est signalé plutôt que présenté comme un changement.',
    'L’état est RELU après l’action, après une pause, et un écart arrête le script en affichant le journal de l’unité.',
    'Après enable ou disable, le script dit ce qui n’a PAS changé : le service n’a été ni démarré ni arrêté.',
  ],

  source: `${M}/man1/systemctl.1.html`,
  sources: [
    { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
    { label: 'systemd.unit(5) — sections [Install] et « static »', url: `${M}/man5/systemd.unit.5.html` },
    { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
    { label: 'systemd-analyze(1)', url: `${M}/man1/systemd-analyze.1.html` },
  ],
};

// ===========================================================================
// ASSISTANT 2 — DIAGNOSTIQUER UN SERVICE ET SON JOURNAL
//
// Il LIT, et il ne fait que lire : c'est le pendant exact de l'assistant de
// contrôle, et les séparer est une décision. « Redémarrer pour voir » est le
// réflexe qui efface la preuve : un service qui vient de redémarrer a un
// journal propre, un état « active », et on ne sait plus ce qui n'allait pas.
//
// L'autre raison de les séparer : un diagnostic ne demande pas de
// confirmation, ne touche à rien, et peut donc se lancer sans réfléchir. Un
// assistant qui agirait « au passage » pendant un diagnostic trahirait cette
// promesse.
// ===========================================================================

const PERIODES = {
  '15 minutes': '-15 min',
  '1 heure': '-1 hour',
  '24 heures': '-1 day',
  '7 jours': '-7 days',
  'Depuis ce demarrage': 'BOOT',
};

const PRIORITES = {
  'Tout': '',
  'Avertissements et pires': 'warning',
  'Erreurs et pires': 'err',
  'Critiques seulement': 'crit',
};

const systemdServiceDiagnostic = {
  id: 'systemd-service-diagnostic',
  icon: '◈',
  category: CAT,
  subcategory: 'Services et journaux',
  title: 'Diagnostiquer un service systemd et lire son journal',
  risk: 'diagnostic',
  summary: 'Lit l’état d’une unité systemd — is-active, is-enabled, son fichier, ses dernières lignes de journal — et répond d’abord à la question qu’on ne pense pas à poser : ce journal survit-il au redémarrage ? Sur une installation où Storage n’est pas persistant, les journaux d’avant le dernier démarrage n’existent plus, et c’est toujours ceux-là qu’on cherche. N’écrit rien, ne redémarre rien : redémarrer pour voir efface la preuve.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['systemd — journalctl (présent par défaut)'],
  privileges: 'aucun pour son propre journal ; root ou le groupe systemd-journal pour le journal du système',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: null,
  limites: [
    'NE REDEMARRE RIEN, et n’offre aucun champ pour le faire. « Redemarrer pour voir » efface la preuve : un service qui vient de redemarrer a un journal propre et un etat « active », et on ne sait plus ce qui n’allait pas. Agir est le metier de l’assistant de controle, qui demande une confirmation.',
    'LIT seulement. Ni « journalctl --vacuum-size », ni « --vacuum-time », ni « --rotate » : ils SUPPRIMENT des journaux, et une suppression de journal est exactement ce qu’on regrette au milieu d’une enquête. Les commandes sont dans la fiche, à lancer à la main.',
    'Ne modifie pas /etc/systemd/journald.conf. Rendre le journal persistant est une décision qui consomme du disque : l’assistant dit comment, et ne le fait pas.',
    'Ne lit pas les journaux des autres machines ni les journaux exportés. « journalctl --directory » et « --file » ne sont pas offerts.',
    'Les lignes sont bornées : un journal complet se compte en centaines de milliers de lignes, et une sortie illisible n’aide personne.',
  ],

  fields: [
    {
      id: 'unite',
      label: 'Unité (vide = tout le système)',
      type: 'text',
      default: 'ssh.service',
      placeholder: 'ssh.service',
      optionnel: true,
      help: 'Laisse vide pour lire le journal du système entier. Avec un nom, seules les lignes de cette unité sont lues.',
    },
    {
      id: 'periode',
      label: 'Période',
      type: 'select',
      default: 'Depuis ce demarrage',
      options: Object.keys(PERIODES).map((k) => [k, k]),
      help: '« Depuis ce démarrage » utilise -b, qui ne dépend pas de l’horloge : c’est le plus fiable quand on soupçonne un problème d’heure.',
    },
    {
      id: 'priorite',
      label: 'Priorité minimale',
      type: 'select',
      default: 'Erreurs et pires',
      options: Object.keys(PRIORITES).map((k) => [k, k]),
      help: 'Les priorités sont hiérarchiques : « err » inclut crit, alert et emerg. Commencer par les erreurs évite de lire mille lignes d’information.',
    },
    {
      id: 'lignes',
      label: 'Nombre de lignes au plus',
      type: 'text',
      default: '200',
      placeholder: '200',
      help: 'Entre 10 et 5000. Les dernières lignes sont les plus récentes, et ce sont presque toujours celles qui comptent.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const u = String(v.unite ?? '').trim();
    if (u !== '') {
      const r = validateNomUnite(u, 'Le nom de l’unité');
      if (!r.ok) errors.unite = r.error;
    }
    const p = validateChoix(v.periode, Object.keys(PERIODES), 'La période');
    if (!p.ok) errors.periode = p.error;
    const pr = validateChoix(v.priorite, Object.keys(PRIORITES), 'La priorité');
    if (!pr.ok) errors.priorite = pr.error;
    const l = validateEntierBorne(v.lignes, 10, 5000, 'Le nombre de lignes');
    if (!l.ok) errors.lignes = l.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const unite = String(v.unite ?? '').trim();
    const periode = PERIODES[String(v.periode)];
    const priorite = PRIORITES[String(v.priorite)];

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer une unite systemd et lire son journal',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'le journal du systeme demande root ou le groupe systemd-journal ; le journal de la session se lit sans privilege',
      }),
      ...blocVariablesBash([
        ['KJEMO_UNITE', shQuote(unite)],
        ['KJEMO_PERIODE', shQuote(periode)],
        ['KJEMO_PRIORITE', shQuote(priorite)],
        ['KJEMO_LIGNES', shQuote(String(v.lignes).trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Unite' \"${KJEMO_UNITE:-tout le systeme}\"",
      "  printf '%s\\t%s\\n' 'Periode' \"${KJEMO_PERIODE}\"",
      "  printf '%s\\t%s\\n' 'Priorite minimale' \"${KJEMO_PRIORITE:-toutes}\"",
      "  printf '%s\\t%s\\n' 'Lignes au plus' \"${KJEMO_LIGNES}\"",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LA QUESTION QU ON NE POSE PAS : CE JOURNAL EST-IL PERSISTANT ?',
      '#',
      '# Si Storage n est pas persistant, le journal vit en memoire : au',
      '# redemarrage, TOUT ce qui precede disparait. Et c est toujours ce qui',
      '# precede qu on cherche, puisqu on enquete apres un incident.',
      '#',
      '# La presence du dossier /var/log/journal est le signe decisif : avec',
      '# Storage=auto — la valeur par defaut — journald n ecrit sur disque que',
      '# si ce dossier existe.',
      '# ---------------------------------------------------------------------------',
      'if ! kjemo_dispo journalctl; then',
      "  kjemo_resultat 'Prerequis' 'journalctl' 'PROBLEME' 'absent' \\",
      "    'Cette machine n utilise pas systemd-journald. Les journaux sont ailleurs : /var/log/syslog, /var/log/messages.'",
      'else',
      '  if [ -d /var/log/journal ]; then',
      "    kjemo_resultat 'Persistance' '/var/log/journal' 'OK' 'present' \\",
      "      'Le journal est ecrit sur disque : les lignes d avant le dernier demarrage existent encore.'",
      '  else',
      "    kjemo_resultat 'Persistance' '/var/log/journal' 'ATTENTION' 'absent' \\",
      "      'Le journal vit en MEMOIRE : tout ce qui precede le dernier demarrage est perdu, et le restera. Pour le rendre persistant : creer /var/log/journal, ou poser Storage=persistent dans /etc/systemd/journald.conf, puis redemarrer journald. Cela consomme du disque, et c est une decision — cet assistant ne la prend pas.'",
      '  fi',
      '  KJEMO_TAILLE="$(journalctl --disk-usage --no-pager 2>/dev/null || true)"',
      "  kjemo_resultat 'Persistance' 'Place occupee' 'INFO' \"${KJEMO_TAILLE:-inconnue}\" \\",
      "    'Taille actuelle des journaux. SystemMaxUse dans journald.conf en fixe le plafond ; par defaut, 10 pour cent du systeme de fichiers.'",
      '  # Les demarrages connus : s il n y en a qu un, la persistance est',
      '  # confirmee absente, et cette fois par une MESURE et non par un indice.',
      '  KJEMO_NB_BOOTS="$(journalctl --list-boots --no-pager 2>/dev/null | wc -l | tr -d \' \' || true)"',
      '  if [ -n "${KJEMO_NB_BOOTS}" ] && [ "${KJEMO_NB_BOOTS}" -le 1 ] 2>/dev/null; then',
      "    kjemo_resultat 'Persistance' 'Demarrages connus' 'ATTENTION' \"${KJEMO_NB_BOOTS}\" \\",
      "      'Un seul demarrage dans le journal : la confirmation que rien ne survit au redemarrage. Si la machine a demarre plus d une fois, c est la preuve que le journal n est pas persistant.'",
      '  else',
      "    kjemo_resultat 'Persistance' 'Demarrages connus' 'OK' \"${KJEMO_NB_BOOTS:-inconnu}\" \\",
      "      'Le journal couvre plusieurs demarrages : « journalctl -b -1 » lit celui d avant, ce qui est souvent la seule facon de voir pourquoi la machine a redemarre.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 bis - L ETAT DE L UNITE, QUAND UNE UNITE EST NOMMEE',
      '#',
      '# Trois questions distinctes, et on les confond tout le temps :',
      '#   is-active   le service tourne-t-il MAINTENANT ?',
      '#   is-enabled  demarrera-t-il au PROCHAIN demarrage ?',
      '#   systemctl cat  qu est-ce qui est REELLEMENT configure, drop-ins',
      '#                  compris — le fichier du paquet n est pas toujours le',
      '#                  dernier mot.',
      '#',
      '# Un service « active » et « disabled » tourne et ne reviendra pas. Un',
      '# service « inactive » et « enabled » ne tourne pas et reviendra. Les deux',
      '# situations sont normales, et les deux surprennent.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo systemctl; then',
      '  if [ -n "${KJEMO_UNITE}" ]; then',
      '    if systemctl cat -- "${KJEMO_UNITE}" > "${KJEMO_TMP}/unite.conf" 2>/dev/null; then',
      '      KJEMO_ACTIF="$(systemctl is-active -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      '      KJEMO_ACTIVE="$(systemctl is-enabled -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      '      KJEMO_SOUS="$(systemctl show -p SubState --value -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      '      KJEMO_DESC="$(systemctl show -p Description --value -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      "      kjemo_resultat 'Unite' \"${KJEMO_UNITE}\" 'INFO' \"${KJEMO_DESC}\" \\",
      "        'Description tiree du fichier de l unite.'",
      '      if [ "${KJEMO_ACTIF}" = \'active\' ]; then',
      "        kjemo_resultat 'Unite' 'is-active' 'OK' \"${KJEMO_ACTIF} (${KJEMO_SOUS})\" \\",
      "          'Le service tourne maintenant. Le sous-etat precise : running pour un service en cours, exited pour un oneshot termine normalement.'",
      '      elif [ "${KJEMO_ACTIF}" = \'failed\' ]; then',
      "        kjemo_resultat 'Unite' 'is-active' 'PROBLEME' \"${KJEMO_ACTIF} (${KJEMO_SOUS})\" \\",
      "          'Le service a echoue. Les lignes de journal ci-dessous disent pourquoi, et c est la seule facon de le savoir : le mot « failed » ne dit pas la cause.'",
      '      else',
      "        kjemo_resultat 'Unite' 'is-active' 'ATTENTION' \"${KJEMO_ACTIF:-inconnu} (${KJEMO_SOUS:-inconnu})\" \\",
      "          'Le service ne tourne pas. « inactive » peut etre normal — un oneshot, un service declenche par un socket ou un timer.'",
      '      fi',
      '      case "${KJEMO_ACTIVE}" in',
      '        enabled)',
      "          kjemo_resultat 'Unite' 'is-enabled' 'OK' \"${KJEMO_ACTIVE}\" \\",
      "            'Il demarrera au prochain demarrage.'",
      '          ;;',
      '        static)',
      "          kjemo_resultat 'Unite' 'is-enabled' 'INFO' 'static' \\",
      "            'Cette unite n a pas de section [Install] : elle ne s active pas, elle est demarree par une dependance. « systemctl enable » n y changerait rien, et son echec surprend.'",
      '          ;;',
      '        masked)',
      "          kjemo_resultat 'Unite' 'is-enabled' 'PROBLEME' 'masked' \\",
      "            'L unite est MASQUEE : son fichier est remplace par un lien vers /dev/null. Elle est indemarrable, y compris par ses dependances, et le message d erreur de « start » ne parle pas du masquage. C est souvent la cause qu on cherche le plus longtemps.'",
      '          ;;',
      '        *)',
      "          kjemo_resultat 'Unite' 'is-enabled' 'ATTENTION' \"${KJEMO_ACTIVE:-inconnu}\" \\",
      "            'Il ne demarrera pas tout seul au prochain demarrage.'",
      '          ;;',
      '      esac',
      '      # Les drop-ins : la raison la plus frequente d un comportement qui ne',
      '      # correspond pas au fichier du paquet.',
      '      KJEMO_DROPINS="$(systemctl show -p DropInPaths --value -- "${KJEMO_UNITE}" 2>/dev/null || true)"',
      '      if [ -n "${KJEMO_DROPINS}" ]; then',
      "        kjemo_resultat 'Unite' 'Drop-ins actifs' 'ATTENTION' \"${KJEMO_DROPINS}\" \\",
      "          'Ces fichiers sont lus APRES le fichier du paquet et peuvent en changer n importe quelle directive. Lire seulement le fichier du paquet, c est lire une configuration qui n est pas celle en vigueur : systemctl cat les montre tous, dans l ordre.'",
      '      fi',
      '      KJEMO_CONF="$(head -60 -- \"${KJEMO_TMP}/unite.conf\" 2>/dev/null || true)"',
      "      kjemo_resultat 'Unite' 'Configuration effective' 'INFO' \"${KJEMO_CONF}\" \\",
      "        'Sortie de systemctl cat : le fichier de l unite ET ses drop-ins, dans l ordre de lecture. Soixante premieres lignes.'",
      '    else',
      "      kjemo_resultat 'Unite' \"${KJEMO_UNITE}\" 'PROBLEME' 'inconnue de systemd' \\",
      "        'Aucune unite de ce nom. Beaucoup d unites ne sont pas des .service : il y a aussi .socket, .timer, .target et .mount. Cherche : systemctl list-units --all | grep -i <motif>.'",
      '    fi',
      '  else',
      '    KJEMO_NB_UNITES="$(systemctl list-units --type=service --no-legend --no-pager 2>/dev/null | wc -l | tr -d \' \' || true)"',
      "    kjemo_resultat 'Unites' 'Services charges' 'INFO' \"${KJEMO_NB_UNITES:-inconnu}\" \\",
      "      'Aucune unite nommee : le journal est lu pour tout le systeme. Pour cibler, relance en nommant une unite.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LA LECTURE',
      '#',
      '# Les arguments sont construits dans un TABLEAU, option par option. Une',
      '# chaine assemblee a la main casse des qu un nom d unite contient une',
      '# espace, et --no-pager est systematique : sans lui, journalctl ouvre un',
      '# pager, qui attend une touche — et un script lance sans terminal reste',
      '# bloque la, sans rien dire.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo journalctl; then',
      '  kjemo_args=(journalctl --no-pager -n "${KJEMO_LIGNES}")',
      '  if [ "${KJEMO_PERIODE}" = \'BOOT\' ]; then',
      '    kjemo_args+=(-b)',
      '  else',
      '    kjemo_args+=(--since "${KJEMO_PERIODE}")',
      '  fi',
      '  if [ -n "${KJEMO_UNITE}" ]; then',
      '    kjemo_args+=(-u "${KJEMO_UNITE}")',
      '  fi',
      '  if [ -n "${KJEMO_PRIORITE}" ]; then',
      '    kjemo_args+=(-p "${KJEMO_PRIORITE}")',
      '  fi',
      '',
      '  kjemo_code=0',
      '  "${kjemo_args[@]}" > "${KJEMO_TMP}/journal.txt" 2>"${KJEMO_TMP}/journal.err" || kjemo_code=$?',
      '  if [ "${kjemo_code}" -ne 0 ]; then',
      "    kjemo_resultat 'Journal' 'Lecture' 'PROBLEME' \"code ${kjemo_code}\" \\",
      "      'journalctl a refuse la lecture. Sans privileges, seul le journal de la session est accessible : relance avec sudo, ou ajoute le compte au groupe systemd-journal.'",
      '    cat "${KJEMO_TMP}/journal.err" >&2',
      '  else',
      '    KJEMO_NB="$(wc -l < "${KJEMO_TMP}/journal.txt" | tr -d \' \' || true)"',
      '    if [ "${KJEMO_NB}" -eq 0 ] 2>/dev/null; then',
      "      kjemo_resultat 'Journal' 'Lignes trouvees' 'OK' '0' \\",
      "      'Aucune ligne pour ces criteres. Ce n est pas forcement une bonne nouvelle : verifie l unite et la periode avant de conclure que tout va bien. Une unite mal orthographiee rend toujours zero ligne, sans erreur.'",
      '    else',
      "      kjemo_resultat 'Journal' 'Lignes trouvees' 'INFO' \"${KJEMO_NB}\" \\",
      "        'Les plus recentes sont a la fin.'",
      '      KJEMO_EXTRAIT="$(tail -40 "${KJEMO_TMP}/journal.txt" 2>/dev/null || true)"',
      "      kjemo_resultat 'Journal' 'Quarante dernieres lignes' 'INFO' \"${KJEMO_EXTRAIT}\" \\",
      "        'Extrait. Le rapport JSON ou CSV contient le compte complet, pas le journal entier : un journal n a pas sa place dans un rapport.'",
      '    fi',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - QUI PARLE LE PLUS ?',
      '#',
      '# Un service qui remplit le journal est souvent le service qui va mal, et',
      '# c est aussi celui qui fait tourner les journaux plus vite — donc celui',
      '# qui efface les traces des autres.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_args_bruit=(journalctl --no-pager -o json -n 2000)',
      '  if [ "${KJEMO_PERIODE}" = \'BOOT\' ]; then',
      '    kjemo_args_bruit+=(-b)',
      '  else',
      '    kjemo_args_bruit+=(--since "${KJEMO_PERIODE}")',
      '  fi',
      '  if [ -n "${KJEMO_PRIORITE}" ]; then',
      '    kjemo_args_bruit+=(-p "${KJEMO_PRIORITE}")',
      '  fi',
      '  # sed, et non un analyseur JSON : le champ cherche est une chaine simple,',
      '  # et exiger jq rendrait l assistant inutilisable sur une installation nue.',
      '  KJEMO_BRUIT="$("${kjemo_args_bruit[@]}" 2>/dev/null \\',
      '    | sed -n \'s/.*"_SYSTEMD_UNIT"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p\' \\',
      '    | sort | uniq -c | sort -rn | head -10 || true)"',
      '  if [ -n "${KJEMO_BRUIT}" ]; then',
      "    kjemo_resultat 'Journal' 'Unites les plus bavardes' 'INFO' \"${KJEMO_BRUIT}\" \\",
      "      'Nombre de lignes par unite, sur les deux mille dernieres entrees des criteres demandes. Celle qui parle le plus n est pas forcement celle qui va mal, mais c est par elle qu on commence.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LES UNITES EN ECHEC, QUI NE SONT PAS DANS LE JOURNAL',
      '#',
      '# Un service en echec depuis deux semaines n a plus rien ecrit depuis deux',
      '# semaines : il est invisible dans « les dernieres lignes ». systemctl,',
      '# lui, le sait.',
      '# ---------------------------------------------------------------------------',
      '  if kjemo_dispo systemctl; then',
      '    KJEMO_ECHECS="$(systemctl list-units --state=failed --no-legend --no-pager 2>/dev/null || true)"',
      '    if [ -n "${KJEMO_ECHECS}" ]; then',
      "      kjemo_resultat 'Services' 'Unites en echec' 'PROBLEME' \"${KJEMO_ECHECS}\" \\",
      "        'Ces unites sont en echec MAINTENANT. Une unite tombee il y a longtemps n ecrit plus rien, et n apparait donc pas dans les dernieres lignes du journal : c est pour cela qu on la cherche ici et non la-bas.'",
      '    else',
      "      kjemo_resultat 'Services' 'Unites en echec' 'OK' 'aucune' ''",
      '    fi',
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-journal' }),
    ]);
  },

  gui: [
    'L’état, en trois questions distinctes : « systemctl is-active ssh », « systemctl is-enabled ssh », « systemctl cat ssh.service ».',
    'systemctl cat montre le fichier du paquet ET ses drop-ins : c’est la configuration réellement en vigueur, et elle diffère souvent de celle qu’on croit lire.',
    'Si is-enabled répond « masked », l’unité est indémarrable et le message d’erreur de start n’en parlera pas.',
    'Vérifie la persistance du journal : « ls -d /var/log/journal ». S’il n’existe pas, tout ce qui précède le dernier démarrage est perdu.',
    'La place occupée : « journalctl --disk-usage ».',
    'Les démarrages connus : « journalctl --list-boots ». Un seul veut dire « rien ne survit au redémarrage ».',
    'Les erreurs depuis ce démarrage : « journalctl -b -p err --no-pager -n 200 ».',
    'Pour une unité : « journalctl -u ssh.service -n 100 --no-pager ».',
    'Toujours « --no-pager » dans un script : sans lui, journalctl attend une touche, et un script lancé sans terminal reste bloqué sans rien dire.',
    'Les unités en échec ne sont pas dans les dernières lignes du journal : « systemctl list-units --state=failed ».',
    'Pour suivre en direct : « journalctl -u ssh.service -f ».',
  ],

  keywords: ['systemctl', 'systemd', 'service', 'unite', 'status', 'is-active', 'is-enabled',
    'cat', 'drop-in', 'masked', 'static', 'failed', 'diagnostic',
    'journalctl', 'journal', 'log', 'logs', 'journald', 'persistant',
    'storage', 'priorite', 'erreur', 'failed', 'boot', 'disk-usage', 'vacuum',
    'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'sudo, ou l’appartenance au groupe systemd-journal, pour lire le journal du système.',
    'Le nom de l’unité, suffixe compris, si la recherche est ciblée — « systemctl list-units --all | grep -i <motif> » le donne.',
    'Rien d’autre : aucun paquet à installer, et aucune écriture, donc aucune sauvegarde à prévoir.',
  ],

  commonErrors: [
    {
      message: 'journalctl ne montre rien avant le dernier démarrage',
      code: 'KJEMO',
      cause: 'Le journal n’est pas persistant : /var/log/journal n’existe pas, et avec Storage=auto journald n’écrit alors qu’en mémoire.',
      fix: 'Créer le dossier, puis redémarrer journald. Cela consomme du disque, et c’est une décision.',
      command: 'sudo mkdir -p /var/log/journal && sudo systemctl restart systemd-journald',
    },
    {
      message: 'Hint: You are currently not seeing messages from other users and the system.',
      code: 'KJEMO',
      cause: 'La session n’a pas le droit de lire le journal du système : seul son propre journal est visible.',
      fix: 'Relancer avec sudo, ou ajouter le compte au groupe systemd-journal — effectif à la prochaine session.',
      command: 'sudo usermod -aG systemd-journal blaise',
    },
    {
      message: 'journalctl -u monservice ne rend rien, et le service tourne',
      code: 'KJEMO',
      cause: 'Nom d’unité mal orthographié, ou service qui écrit ailleurs que dans le journal. Une unité inconnue rend zéro ligne SANS erreur.',
      fix: 'Vérifier le nom exact, puis chercher sans filtre d’unité.',
      command: 'systemctl list-units --type=service | grep -i monservice',
    },
    {
      message: 'Le script reste bloqué sur journalctl',
      code: 'KJEMO',
      cause: 'Le pager attend une touche. journalctl l’ouvre dès que la sortie est un terminal.',
      fix: 'Toujours --no-pager dans un script. L’assistant le passe systématiquement.',
      command: 'journalctl -u ssh --no-pager -n 50',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport commence par l’état de persistance du journal : présence de /var/log/journal, place occupée, nombre de démarrages connus.',
    'Le nombre de lignes trouvées est affiché, y compris quand il vaut zéro — et le rapport dit alors que zéro ligne n’est pas forcément une bonne nouvelle.',
    'La liste des unités en échec est présente, indépendamment du journal.',
    'Aucun fichier de journal n’a été supprimé ni tourné : le script n’appelle ni --vacuum-size, ni --vacuum-time, ni --rotate.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant ne fait que lire. Les commandes qui suppriment des journaux sont données ci-dessous, à lancer à la main et en connaissance de cause.',
    diagnostic: `# La place occupee et les plafonds en vigueur :
journalctl --disk-usage
grep -E '^[^#]*(SystemMaxUse|Storage)' /etc/systemd/journald.conf`,
    command: `# L assistant ne supprime rien. Si la place manque vraiment :

# 1. Voir d abord ce qu on s apprete a perdre :
journalctl --list-boots

# 2. Ne garder que les deux derniers jours — IRREVERSIBLE :
#    sudo journalctl --vacuum-time=2d

# 3. Ou plafonner la taille — IRREVERSIBLE :
#    sudo journalctl --vacuum-size=200M

# 4. Mieux, parce que durable : fixer le plafond dans la configuration,
#    et laisser journald faire la place lui-meme.
#    SystemMaxUse=200M dans /etc/systemd/journald.conf
#    puis : sudo systemctl restart systemd-journald

echo 'Aucune suppression effectuee par cet assistant.'`,
    warning: 'Un journal supprimé ne revient pas, et c’est au milieu d’une enquête qu’on s’en aperçoit. Plafonner la taille dans journald.conf vaut mieux que vider à la main : la décision est prise une fois, et elle s’applique avant que le disque soit plein.',
  },

  checks: [
    'Aucune action : ni start, ni stop, ni restart, ni enable, ni disable. Aucun champ ne permet d’agir, et « redémarrer pour voir » effacerait la preuve.',
    'Aucune commande destructrice : ni --vacuum-size, ni --vacuum-time, ni --rotate, ni modification de journald.conf.',
    'is-active, is-enabled et systemctl cat sont lus séparément, et le rapport explique ce que chacun répond.',
    'Les drop-ins actifs sont listés et signalés : lire le fichier du paquet seul, c’est lire une configuration qui n’est pas celle en vigueur.',
    'Les états « static » et « masked » sont expliqués plutôt que présentés comme des anomalies ou des erreurs.',
    'La persistance est vérifiée AVANT la lecture, par deux voies : la présence de /var/log/journal, et le nombre de démarrages connus.',
    '--no-pager est passé systématiquement : sans lui, un script sans terminal reste bloqué sur le pager.',
    'Les arguments sont construits dans un tableau, option par option.',
    'Zéro ligne trouvée est signalé comme tel, avec l’avertissement qu’une unité mal orthographiée rend zéro ligne sans erreur.',
    'Les unités en échec sont listées par systemctl, indépendamment du journal : une unité tombée depuis longtemps n’écrit plus rien.',
    'L’extrait affiché est borné à quarante lignes, et le rapport ne contient pas le journal entier.',
    'Le nombre de lignes demandé est borné entre 10 et 5000 par le formulaire.',
  ],

  source: `${M}/man1/journalctl.1.html`,
  sources: [
    { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
    { label: 'journald.conf(5) — Storage et SystemMaxUse', url: `${M}/man5/journald.conf.5.html` },
    { label: 'systemctl(1) — is-active, is-enabled, cat, list-units', url: `${M}/man1/systemctl.1.html` },
    { label: 'systemd.unit(5) — drop-ins, [Install], « static »', url: `${M}/man5/systemd.unit.5.html` },
  ],
};
// ===========================================================================
// ASSISTANT 3 — DIAGNOSTIQUER L'ÉTAT DES PAQUETS
//
// IL NE POSE RIEN, ET C'EST LA DÉCISION CENTRALE
//
// Un assistant qui installe ressemble à un confort ; c'en est un, et il coûte
// cher. `apt-get install` ne fait pas qu'installer : pour satisfaire une
// dépendance, il peut en RETIRER d'autres — il le dit, dans un paragraphe
// suivi d'un « Do you want to continue? [Y/n] » auquel on répond oui sans
// lire. Avec `-y`, il n'y a même plus de question.
//
// Cet assistant fait donc l'inverse : il SIMULE (`apt-get -s install`), relit
// le plan, et dit ce qui se passerait — y compris les suppressions. La
// commande qui applique reste à taper, par un humain qui a lu le plan.
//
// Il ajoute ce qu'on ne pense pas à regarder : `dpkg -V`, qui compare les
// fichiers installés aux empreintes du paquet. C'est la seule commande du lot
// qui réponde à « ce binaire a-t-il été modifié depuis l'installation ? ».
// ===========================================================================

/** Grammaire d'un nom de paquet Debian, telle que dpkg la définit. */
const NOM_PAQUET = /^[a-z0-9][a-z0-9+.-]*$/;

function listeMots(v) {
  return String(v ?? '').trim().split(/[\s,]+/).filter((x) => x !== '');
}

const linuxPackageDiagnostic = {
  id: 'linux-package-diagnostic',
  icon: '◈',
  category: CAT,
  subcategory: 'Services et journaux',
  title: 'Diagnostiquer l’état des paquets et simuler une installation',
  risk: 'diagnostic',
  summary: 'Lit l’état du système de paquets — fraîcheur de l’index, verrou tenu par un autre apt, paquets à moitié configurés, configurations résiduelles, mises à jour disponibles, paquets gelés, redémarrage requis — et vérifie l’intégrité des fichiers installés avec dpkg -V. Sur demande, SIMULE l’installation de paquets nommés et relit le plan, y compris les suppressions qu’il annoncerait. N’installe rien, ne retire rien.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['apt — apt-get, apt-cache, apt-mark (présent par défaut)', 'dpkg — dpkg-query, dpkg (présent par défaut)'],
  privileges: 'aucun pour la plupart des lectures ; root pour « dpkg -V » complet et pour rafraîchir l’index',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: null,
  limites: [
    'N’INSTALLE RIEN et ne retire rien. Pas d’install, pas de remove, pas de purge, pas d’autoremove, pas d’upgrade, pas de dist-upgrade. La simulation dit ce qui se passerait ; la commande qui applique reste à taper par quelqu’un qui a lu le plan.',
    'Ne rafraîchit pas l’index. « apt-get update » écrit dans /var/lib/apt/lists : c’est anodin, mais ce n’est pas une lecture, et un diagnostic qui écrit n’est plus un diagnostic. L’assistant mesure l’âge de l’index et donne la commande.',
    'N’ajoute aucun dépôt et n’importe aucune clé : ajouter un dépôt, c’est accorder à un tiers le droit d’installer du code en root sur la machine.',
    'dpkg -V ne couvre que les fichiers dont le paquet fournit une empreinte, et pas les fichiers de configuration modifiés légitimement. Une différence signalée demande un examen, elle ne prouve pas une compromission.',
    'La simulation reflète l’index LOCAL. Si l’index est vieux, le plan simulé peut différer du plan réel — l’assistant mesure donc cet âge et le dit avant le plan.',
  ],

  fields: [
    {
      id: 'paquets',
      label: 'Paquets à examiner (vide = aucun, diagnostic global seulement)',
      type: 'text',
      default: 'quota acl',
      placeholder: 'quota acl mdadm',
      optionnel: true,
      help: 'Séparés par des espaces ou des virgules, vingt au plus. Pour chacun : version candidate, état réel dans dpkg, et simulation de son installation. Aucun joker.',
    },
    {
      id: 'verifierIntegrite',
      label: 'Vérifier l’intégrité des fichiers installés',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Oui lance « dpkg -V », qui compare les fichiers installés aux empreintes des paquets. C’est long sur un système complet — quelques minutes — et c’est la seule façon de voir qu’un binaire a changé.',
    },
    {
      id: 'simulerInstallation',
      label: 'Simuler l’installation des paquets nommés',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Oui lance « apt-get -s install », qui ne touche à rien et annonce le plan exact — y compris les suppressions qu’une installation entraînerait.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const paquets = listeMots(v.paquets);
    if (paquets.length > 20) {
      errors.paquets = `Vingt paquets au plus, ${paquets.length} demandés. Au-delà, le plan simulé devient illisible — et un plan qu’on ne lit pas ne protège de rien.`;
    } else {
      for (const p of paquets) {
        if (/[*?[\]]/.test(p)) {
          errors.paquets = `« ${p} » contient un joker. APT les accepte et choisit large : nomme chaque paquet.`;
          break;
        }
        if (p.startsWith('-')) {
          errors.paquets = `« ${p} » commence par un tiret : apt-get le prendrait pour une option.`;
          break;
        }
        if (!NOM_PAQUET.test(p)) {
          errors.paquets = `« ${p} » n’est pas un nom de paquet valide. La grammaire de dpkg : minuscules, chiffres, « + », « - » et « . », en commençant par une minuscule ou un chiffre.`;
          break;
        }
      }
      if (!errors.paquets && new Set(paquets).size !== paquets.length) {
        errors.paquets = 'Le même paquet apparaît deux fois.';
      }
    }
    for (const champ of ['verifierIntegrite', 'simulerInstallation']) {
      const r = validateChoix(v[champ], ['Oui', 'Non'], 'La réponse');
      if (!r.ok) errors[champ] = r.error;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const paquets = listeMots(v.paquets);

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer l etat des paquets, et simuler sans appliquer',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'les lectures suffisent ; root n est utile que pour un dpkg -V complet',
      }),
      ...blocVariablesBash([
        ['KJEMO_INTEGRITE', shQuote(String(v.verifierIntegrite))],
        ['KJEMO_SIMULE', shQuote(String(v.simulerInstallation))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      `KJEMO_PAQUETS=(${paquets.map((p) => shQuote(p)).join(' ')})`,
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      '  printf \'%s\\t%s\\n\' \'Paquets examines\' "${KJEMO_PAQUETS[*]:-aucun}"',
      "  printf '%s\\t%s\\n' 'Verification d integrite' \"${KJEMO_INTEGRITE}\"",
      "  printf '%s\\t%s\\n' 'Simulation d installation' \"${KJEMO_SIMULE}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - ce script ne fait que lire'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LES OUTILS',
      '#',
      '# apt-get et non apt : « apt » est l interface humaine, sa sortie change',
      '# entre versions, et elle previent elle-meme qu elle n est pas faite pour',
      '# les scripts. apt-get a une sortie stable, et c est tout ce qu on lui',
      '# demande.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      'for kjemo_o in apt-get apt-cache dpkg-query dpkg; do',
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' \\",
      "      'Cette machine n utilise pas APT. Le diagnostic ne s y applique pas.'",
      '  fi',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - UN AUTRE APT TOURNE-T-IL ?',
      '#',
      '# C est le cas le plus frequent et le plus mal comprise : sur une Ubuntu',
      '# fraiche, unattended-upgrades tourne au demarrage et tient le verrou de',
      '# dpkg plusieurs minutes. Toute commande apt echoue alors avec « Could',
      '# not get lock », et le reflexe — supprimer le fichier de verrou — casse',
      '# la base dpkg au milieu d une transaction.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_CONCURRENT=\'\'',
      'for kjemo_p in apt-get apt unattended-upgr dpkg aptitude; do',
      '  if pgrep -x -- "${kjemo_p}" > /dev/null 2>&1; then',
      '    KJEMO_CONCURRENT="${KJEMO_CONCURRENT} ${kjemo_p}"',
      '  fi',
      'done',
      'if [ -n "${KJEMO_CONCURRENT}" ]; then',
      "  kjemo_resultat 'Verrou' 'Processus concurrent' 'ATTENTION' \"${KJEMO_CONCURRENT# }\" \\",
      "    'Un gestionnaire de paquets tourne. Attends qu il finisse avant toute installation. Ne supprime JAMAIS /var/lib/dpkg/lock pour passer outre : cela interrompt une transaction dpkg, et la reparation est longue.'",
      'else',
      "  kjemo_resultat 'Verrou' 'Processus concurrent' 'OK' 'aucun' ''",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - L INDEX, ET SON AGE',
      '#',
      '# Sans index, apt-get repond « Unable to locate package » — message qui',
      '# fait chercher du cote du nom du paquet alors que le probleme est',
      '# l index. Et un index vieux fait proposer des versions qui n existent',
      '# plus sur les miroirs : l installation echoue alors sur un 404.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_INDEX_OK=0',
      'KJEMO_NB_LISTES="$(find /var/lib/apt/lists -maxdepth 1 -type f -name \'*Packages*\' 2>/dev/null | wc -l | tr -d \' \' || true)"',
      'if [ "${KJEMO_NB_LISTES:-0}" -gt 0 ] 2>/dev/null; then',
      '  KJEMO_INDEX_OK=1',
      '  KJEMO_VIEUX="$(find /var/lib/apt/lists -maxdepth 1 -name \'*Packages*\' -mtime +7 2>/dev/null | wc -l | tr -d \' \' || true)"',
      '  KJEMO_DATE_INDEX="$(date -r /var/lib/apt/lists 2>/dev/null || true)"',
      '  if [ "${KJEMO_VIEUX:-0}" -gt 0 ] 2>/dev/null; then',
      "    kjemo_resultat 'Index' 'Fraicheur' 'ATTENTION' \"plus de 7 jours (${KJEMO_DATE_INDEX})\" \\",
      "      'L index a plus d une semaine : les versions proposees peuvent ne plus exister sur les miroirs, et une installation echouerait sur un 404. Rafraichis-le avant d installer : sudo apt-get update. Cet assistant ne le fait pas — il ne fait que lire.'",
      '  else',
      "    kjemo_resultat 'Index' 'Fraicheur' 'OK' \"moins de 7 jours (${KJEMO_DATE_INDEX})\" ''",
      '  fi',
      '  KJEMO_NB_DEPOTS="$(apt-cache policy 2>/dev/null | grep -c \'^ [0-9]\' || true)"',
      "  kjemo_resultat 'Index' 'Depots configures' 'INFO' \"${KJEMO_NB_DEPOTS:-inconnu}\" \\",
      "    'Nombre de lignes de depot connues d APT. Un paquet absent vient souvent d un composant desactive — universe, par exemple — et non d un nom fautif.'",
      'else',
      "  kjemo_resultat 'Index' 'Listes de paquets' 'PROBLEME' 'aucune' \\",
      "    'Aucun index APT sur cette machine. Toute recherche de paquet echouera avec « Unable to locate package », et on cherchera la cause du mauvais cote. Lance : sudo apt-get update.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LES PAQUETS DANS UN ETAT ANORMAL',
      '#',
      '# dpkg tient l etat, pas apt. Deux etats comptent et ne se voient pas :',
      '#   iU, iF  installe mais NON configure : une installation interrompue.',
      '#           Le paquet est la, et il ne fonctionne pas.',
      '#   rc      retire mais sa configuration reste. Inoffensif, sauf quand',
      '#           cette configuration residuelle fait echouer une',
      '#           reinstallation des mois plus tard.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_OUTILS_OK}" -eq 1 ]; then',
      '  KJEMO_ETATS="$(dpkg-query -W -f=\'${db:Status-Abbrev} ${binary:Package}\\n\' 2>/dev/null || true)"',
      '  KJEMO_NB_INSTALLES="$(printf \'%s\\n\' "${KJEMO_ETATS}" | grep -c \'^ii \' || true)"',
      "  kjemo_resultat 'Paquets' 'Installes et configures' 'INFO' \"${KJEMO_NB_INSTALLES:-0}\" \\",
      "    'Etat « ii » : installe et configure, c est-a-dire normal.'",
      '  KJEMO_CASSES="$(printf \'%s\\n\' "${KJEMO_ETATS}" | grep -E \'^i[^i] \' | head -20 || true)"',
      '  if [ -n "${KJEMO_CASSES}" ]; then',
      "    kjemo_resultat 'Paquets' 'Installes mais NON configures' 'PROBLEME' \"${KJEMO_CASSES}\" \\",
      "      'Ces paquets sont presents et ne fonctionnent pas : une installation a ete interrompue. Repare avec : sudo dpkg --configure -a puis sudo apt-get -f install. Tant qu ils sont dans cet etat, toute nouvelle installation echouera aussi.'",
      '  else',
      "    kjemo_resultat 'Paquets' 'Installes mais NON configures' 'OK' 'aucun' ''",
      '  fi',
      '  KJEMO_RESIDUS="$(printf \'%s\\n\' "${KJEMO_ETATS}" | grep -c \'^rc \' || true)"',
      '  if [ "${KJEMO_RESIDUS:-0}" -gt 0 ] 2>/dev/null; then',
      "    kjemo_resultat 'Paquets' 'Configurations residuelles' 'INFO' \"${KJEMO_RESIDUS}\" \\",
      "      'Etat « rc » : le paquet est retire, sa configuration reste dans /etc. Inoffensif en soi — et c est precisement ce qui fait qu une reinstallation reprend des reglages oublies depuis des mois. La commande de l etape 4 les liste : son resultat se filtre sur les lignes commencant par rc.'",
      '  fi',
      '  # Les paquets GELES : la cause la plus discrete d une mise a jour qui',
      '  # ne se fait pas. apt ne previent pas, il obeit.',
      '  if kjemo_dispo apt-mark; then',
      '    KJEMO_GELES="$(apt-mark showhold 2>/dev/null | head -20 || true)"',
      '    if [ -n "${KJEMO_GELES}" ]; then',
      "      kjemo_resultat 'Paquets' 'Geles (hold)' 'ATTENTION' \"${KJEMO_GELES}\" \\",
      "        'Ces paquets sont volontairement geles : apt ne les mettra pas a jour, et ne le dira pas. C est la cause la plus discrete d un correctif de securite qui ne s applique pas. Pour degeler : sudo apt-mark unhold <paquet>.'",
      '    else',
      "      kjemo_resultat 'Paquets' 'Geles (hold)' 'OK' 'aucun' ''",
      '    fi',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LES MISES A JOUR DISPONIBLES',
      '#',
      '# Lecture seule : « apt list --upgradable » ne met rien a jour. La sortie',
      '# d apt n est pas stable entre versions, mais ici on ne fait que la',
      '# compter et l afficher — on n en extrait aucune decision.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_INDEX_OK}" -eq 1 ] && kjemo_dispo apt; then',
      '  KJEMO_MAJ="$(apt list --upgradable 2>/dev/null | grep -v \'^Listing\' | head -40 || true)"',
      '  KJEMO_NB_MAJ="$(printf \'%s\\n\' "${KJEMO_MAJ}" | grep -c \'/\' || true)"',
      '  if [ "${KJEMO_NB_MAJ:-0}" -gt 0 ] 2>/dev/null; then',
      "    kjemo_resultat 'Mises a jour' 'Disponibles' 'ATTENTION' \"${KJEMO_NB_MAJ} paquet(s)\" \\",
      '      "Mises a jour en attente. Appliquer est une operation de maintenance planifiee : elle peut redemarrer des services. Liste : ${KJEMO_MAJ}"',
      '  else',
      "    kjemo_resultat 'Mises a jour' 'Disponibles' 'OK' 'aucune' \\",
      "      'Rien a mettre a jour selon l index LOCAL. Si l index est vieux, cette reponse l est aussi.'",
      '  fi',
      'fi',
      '',
      '# Un redemarrage en attente, et la raison : deux fichiers qu Ubuntu ecrit',
      '# et que personne ne regarde.',
      'if [ -f /var/run/reboot-required ]; then',
      '  KJEMO_RAISON="$(sort -u /var/run/reboot-required.pkgs 2>/dev/null | tr \'\\n\' \' \' || true)"',
      "  kjemo_resultat 'Suite' 'Redemarrage requis' 'ATTENTION' \"${KJEMO_RAISON:-paquets non listes}\" \\",
      "    'Un composant mis a jour n est pas encore actif : un noyau, ou une bibliotheque chargee par des services en cours. Tant que la machine n a pas redemarre, la version qui tourne n est pas celle qui est installee.'",
      'else',
      "  kjemo_resultat 'Suite' 'Redemarrage requis' 'OK' 'non' ''",
      'fi',
      '',
      '# Les fichiers de configuration laisses de cote par une installation',
      '# non interactive : la nouveaute du paquet est a cote, et ne s applique',
      '# pas.',
      'KJEMO_DIST="$(find /etc -maxdepth 4 \\( -name \'*.dpkg-dist\' -o -name \'*.dpkg-new\' \\) 2>/dev/null | head -10 || true)"',
      'if [ -n "${KJEMO_DIST}" ]; then',
      "  kjemo_resultat 'Suite' 'Fichiers de configuration en attente' 'ATTENTION' \"${KJEMO_DIST}\" \\",
      "    'Un paquet apportait une nouvelle version de ces fichiers ; la version locale a ete gardee, et la nouvelle est posee a cote. Compare-les avant de conclure que la configuration est a jour.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - LES PAQUETS NOMMES : CANDIDAT, ETAT, ET PLAN SIMULE',
      '# ---------------------------------------------------------------------------',
      'if [ "${#KJEMO_PAQUETS[@]}" -gt 0 ] && [ "${KJEMO_OUTILS_OK}" -eq 1 ]; then',
      '  for kjemo_p in "${KJEMO_PAQUETS[@]}"; do',
      '    kjemo_cand="$(apt-cache policy -- "${kjemo_p}" 2>/dev/null \\',
      '      | sed -n \'s/^[[:space:]]*Candidat*e*:[[:space:]]*//p\' | head -1 || true)"',
      '    kjemo_etat="$(dpkg-query -W -f=\'${db:Status-Status}\' -- "${kjemo_p}" 2>/dev/null || true)"',
      '    kjemo_ver="$(dpkg-query -W -f=\'${Version}\' -- "${kjemo_p}" 2>/dev/null || true)"',
      '    if [ -z "${kjemo_cand}" ] || [ "${kjemo_cand}" = \'(none)\' ] || [ "${kjemo_cand}" = \'(aucun)\' ]; then',
      "      kjemo_resultat 'Paquet' \"${kjemo_p}\" 'PROBLEME' 'aucun candidat' \\",
      "        'Ce paquet n existe pas dans les depots configures. Verifie le nom — apt-cache search <motif> aide — et verifie que le composant universe est active.'",
      '    elif [ "${kjemo_etat}" = \'installed\' ]; then',
      "      kjemo_resultat 'Paquet' \"${kjemo_p}\" 'OK' \"installe ${kjemo_ver}, candidat ${kjemo_cand}\" \\",
      "        'Deja present. Si le candidat est plus recent, une mise a jour est disponible pour ce paquet.'",
      '    else',
      "      kjemo_resultat 'Paquet' \"${kjemo_p}\" 'ATTENTION' \"absent, candidat ${kjemo_cand}\" \\",
      "        'Disponible et non installe. La simulation ci-dessous dit ce que son installation entrainerait.'",
      '    fi',
      '  done',
      '',
      '  if [ "${KJEMO_SIMULE}" = \'Oui\' ] && [ "${KJEMO_INDEX_OK}" -eq 1 ]; then',
      '# ---------------------------------------------------------------------------',
      '# LA SIMULATION : « -s » NE TOUCHE A RIEN',
      '#',
      '# C est l etape qui remplace l installation. apt-get -s install annonce',
      '# EXACTEMENT ce qui se passerait : les paquets installes, ceux mis a jour,',
      '# et surtout ceux RETIRES.',
      '#',
      '# Une suppression dans un plan d installation est presque toujours une',
      '# surprise, et parfois la perte d un service en production. L assistant la',
      '# signale comme un PROBLEME — il n a rien a refuser, puisqu il n applique',
      '# rien, mais il refuse de la laisser passer inapercue.',
      '#',
      '# La detection porte sur les deux langues de la sortie d apt : la machine',
      '# peut etre en francais, et « REMOVED » devient « RETIRES ». On cherche',
      '# aussi les lignes « Remv », format stable de -s et non traduites.',
      '# ---------------------------------------------------------------------------',
      "    printf '%s\\n' 'Simulation (aucune ecriture)...'",
      '    kjemo_code=0',
      '    apt-get -s install -- "${KJEMO_PAQUETS[@]}" > "${KJEMO_TMP}/plan.txt" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -ne 0 ]; then',
      "      kjemo_resultat 'Plan' 'Simulation' 'PROBLEME' \"code ${kjemo_code}\" \\",
      '        "APT ne sait pas satisfaire la demande. Rien n a ete installe — une simulation n installe jamais. Sortie : $(tail -15 "${KJEMO_TMP}/plan.txt" | tr \'\\n\' \' \')"',
      '    else',
      '      KJEMO_RETRAITS="$(grep -E \'^Remv |REMOVED|RETIR\' "${KJEMO_TMP}/plan.txt" 2>/dev/null || true)"',
      '      if [ -n "${KJEMO_RETRAITS}" ]; then',
      "        kjemo_resultat 'Plan' 'Suppressions annoncees' 'PROBLEME' \"${KJEMO_RETRAITS}\" \\",
      "          'Installer ces paquets RETIRERAIT ceux-ci. N applique pas ce plan sans savoir a quoi sert chaque paquet retire : un conflit de dependances peut proposer de retirer un serveur en service. C est la ligne qu on ne lit pas, parce qu elle est suivie d une question a laquelle on repond oui.'",
      '      else',
      "        kjemo_resultat 'Plan' 'Suppressions annoncees' 'OK' 'aucune' \\",
      "          'Aucune ligne Remv ni REMOVED : l installation n enleverait rien.'",
      '      fi',
      '      KJEMO_NOUVEAUX="$(grep -cE \'^Inst \' "${KJEMO_TMP}/plan.txt" 2>/dev/null || true)"',
      '      KJEMO_DETAIL="$(grep -E \'^(Inst|Conf|Remv) \' "${KJEMO_TMP}/plan.txt" 2>/dev/null | head -30 || true)"',
      "      kjemo_resultat 'Plan' 'Paquets a installer ou mettre a jour' 'INFO' \"${KJEMO_NOUVEAUX:-0}\" \\",
      "        'Les dependances sont comprises dans ce nombre : demander deux paquets peut en installer vingt, et c est normal.'",
      "      kjemo_resultat 'Plan' 'Detail' 'INFO' \"${KJEMO_DETAIL}\" \\",
      "        'Inst = installe, Conf = configure, Remv = retire. Trente premieres lignes. La commande qui applique ce plan est dans la fiche : elle se tape a la main, apres lecture.'",
      '    fi',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - L INTEGRITE DES FICHIERS INSTALLES',
      '#',
      '# dpkg -V compare les fichiers installes aux empreintes enregistrees a',
      '# l installation. C est la seule commande de ce lot qui reponde a « ce',
      '# binaire a-t-il change depuis l installation ? ».',
      '#',
      '# Ce qu elle ne dit PAS, et qu il faut savoir : un fichier de',
      '# configuration modifie legitimement apparait aussi. Une difference',
      '# demande un examen ; elle ne prouve rien a elle seule.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_INTEGRITE}" = \'Oui\' ] && kjemo_dispo dpkg; then',
      "  printf '%s\\n' 'Verification d integrite (quelques minutes)...'",
      '  KJEMO_DIFFS="$(dpkg -V 2>/dev/null | head -40 || true)"',
      '  if [ -n "${KJEMO_DIFFS}" ]; then',
      '    KJEMO_NB_DIFFS="$(printf \'%s\\n\' "${KJEMO_DIFFS}" | grep -c . || true)"',
      "    kjemo_resultat 'Integrite' 'Fichiers differents de leur paquet' 'ATTENTION' \"${KJEMO_DIFFS}\" \\",
      '      "${KJEMO_NB_DIFFS} ligne(s). La colonne de gauche dit ce qui differe : 5 pour la somme de controle, ? pour un controle impossible. Les fichiers de configuration modifies a la main apparaissent ici legitimement. Un BINAIRE qui differe, en revanche, merite une enquete immediate."',
      '  else',
      "    kjemo_resultat 'Integrite' 'Fichiers differents de leur paquet' 'OK' 'aucun' \\",
      "      'Tous les fichiers verifiables correspondent aux empreintes de leur paquet. dpkg -V ne couvre que les fichiers dont le paquet fournit une empreinte : ce n est pas un controle d integrite complet du systeme.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Integrite' 'Verification' 'IGNORE' 'non demandee' \\",
      "    'dpkg -V prend quelques minutes sur un systeme complet. C est la seule facon de voir qu un fichier installe a change.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-paquets-diagnostic' }),
    ]);
  },

  gui: [
    'L’âge de l’index d’abord : « ls -ld /var/lib/apt/lists ». Un index vieux fait proposer des versions qui n’existent plus, et l’installation échoue sur un 404.',
    'Un autre apt tourne-t-il ? « pgrep -a apt-get; pgrep -a unattended-upgr ». Si oui, attends — ne supprime jamais le fichier de verrou.',
    'Les paquets cassés, qu’on ne voit pas autrement : « dpkg-query -W -f=\'${db:Status-Abbrev} ${binary:Package}\\n\' | grep -v \'^ii\' ».',
    'Un état « iU » veut dire installé mais non configuré : « sudo dpkg --configure -a » puis « sudo apt-get -f install ».',
    'Les paquets gelés, cause discrète d’un correctif qui ne s’applique pas : « apt-mark showhold ».',
    'Les mises à jour en attente : « apt list --upgradable ».',
    'AVANT d’installer, simule et lis le plan : « sudo apt-get -s install quota acl ». Les lignes « Remv » sont celles qui comptent.',
    'Puis, seulement si le plan te convient : « sudo apt-get install quota acl ».',
    'L’intégrité des fichiers installés : « sudo dpkg -V ». Un binaire qui diffère mérite une enquête ; un fichier de configuration modifié à la main, non.',
    'Un redémarrage en attente : « ls /var/run/reboot-required » et « cat /var/run/reboot-required.pkgs ».',
  ],

  keywords: ['apt', 'apt-get', 'apt-cache', 'dpkg', 'paquet', 'paquets', 'package',
    'diagnostic', 'simulation', 'candidat', 'upgradable', 'hold', 'gele',
    'verrou', 'lock', 'integrite', 'dpkg -V', 'reboot-required', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Les noms exacts des paquets à examiner, si la question porte sur des paquets précis.',
    'sudo pour un « dpkg -V » complet : sans privilèges, certains fichiers ne sont pas lisibles et apparaissent comme non vérifiables.',
    'Un index APT présent pour que la simulation ait un sens.',
  ],

  commonErrors: [
    {
      message: 'E: Could not get lock /var/lib/dpkg/lock-frontend',
      code: 'KJEMO',
      cause: 'Un autre gestionnaire de paquets tourne — très souvent unattended-upgrades, juste après le démarrage.',
      fix: 'Attendre. Ne jamais supprimer le fichier de verrou : cela interrompt une transaction dpkg.',
      command: 'pgrep -a apt-get; pgrep -a unattended-upgr',
    },
    {
      message: 'E: Unable to locate package quota',
      code: 'KJEMO',
      cause: 'Index absent ou trop ancien, ou composant universe désactivé. Le message parle du paquet, le problème est ailleurs.',
      fix: 'Rafraîchir l’index, puis relire le candidat.',
      command: 'sudo apt-get update && apt-cache policy quota',
    },
    {
      message: 'Une installation échoue en annonçant « dpkg was interrupted »',
      code: 'KJEMO',
      cause: 'Un paquet est resté dans l’état « iU » : installé mais non configuré. Tant qu’il y est, aucune autre installation ne passe.',
      fix: 'Reprendre la configuration, puis laisser apt réparer les dépendances.',
      command: 'sudo dpkg --configure -a && sudo apt-get -f install',
    },
    {
      message: 'Un correctif de sécurité ne s’installe pas, sans erreur',
      code: 'KJEMO',
      cause: 'Le paquet est gelé (hold). apt ne le met pas à jour et ne le dit pas.',
      fix: 'Lister les paquets gelés, puis dégeler celui qui doit l’être.',
      command: 'apt-mark showhold',
    },
    {
      message: 'dpkg -V signale des fichiers dans /etc',
      code: 'KJEMO',
      cause: 'Ce sont des fichiers de configuration modifiés — légitimement, la plupart du temps.',
      fix: 'Regarder lesquels. Un binaire qui diffère est une autre affaire et mérite une enquête immédiate.',
      command: 'sudo dpkg -V | grep -v \'/etc/\'',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport donne l’âge de l’index, et dit si une installation serait fiable avec cet index.',
    'Aucun paquet dans un état autre que « ii » ne reste signalé sans sa commande de réparation.',
    'Les paquets gelés sont listés : c’est la cause discrète d’une mise à jour qui ne se fait pas.',
    'Si une simulation a été demandée : le plan est affiché, et les lignes « Remv » sont signalées comme PROBLEME.',
    'Aucune écriture : le script n’appelle ni « apt-get update », ni install, ni remove. « apt-get -s install » ne touche à rien.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant ne fait que lire. Les commandes qui appliquent sont ci-dessous, à taper après lecture du plan.',
    diagnostic: `# Le plan, encore une fois, avant d appliquer quoi que ce soit :
sudo apt-get -s install quota acl
# L historique de ce qui a deja ete fait sur cette machine :
grep -E 'Start-Date|Commandline' /var/log/apt/history.log | tail -20`,
    command: `# L assistant n installe rien. Si le plan simule te convient :
#   sudo apt-get update
#   sudo apt-get install quota acl

# Reparer un paquet reste « installe mais non configure » :
#   sudo dpkg --configure -a
#   sudo apt-get -f install

# Degeler un paquet volontairement gele :
#   sudo apt-mark unhold <paquet>

# Et pour defaire une installation, SIMULE d abord : la sortie dit ce qui
# partirait AVEC le paquet vise.
#   sudo apt-get -s remove quota

echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Retirer un paquet peut en retirer d’autres par dépendance, et « purge » efface aussi ses fichiers de configuration dans /etc. Et un « autoremove » lancé sans lire sa liste a déjà retiré le noyau en cours d’exécution sur des machines réelles : ce n’est pas une étape de routine.',
  },

  checks: [
    'Aucune écriture : ni install, ni remove, ni purge, ni autoremove, ni upgrade, ni même « apt-get update ». Un diagnostic qui écrit n’est plus un diagnostic.',
    '« apt-get -s install » est la seule commande apt modifiante employée, et le « -s » la rend sans effet : c’est une simulation.',
    'Les noms de paquets sont validés par la grammaire dpkg, les jokers refusés, vingt paquets au plus.',
    'Un apt concurrent est détecté et signalé, avec l’interdiction explicite de supprimer le fichier de verrou.',
    'L’âge de l’index est mesuré et son effet expliqué : un index vieux rend la simulation elle-même douteuse.',
    'Les états dpkg anormaux — iU, iF, rc — sont comptés et expliqués séparément, avec leur commande de réparation.',
    'Les paquets gelés sont listés : apt les ignore silencieusement.',
    'Toute suppression annoncée dans un plan simulé est signalée comme PROBLEME.',
    'dpkg -V est facultatif, et ses limites sont dites : il ne couvre que les fichiers dont le paquet fournit une empreinte, et un fichier de configuration modifié apparaît légitimement.',
    'Un redémarrage requis est signalé avec les paquets qui le demandent, sans jamais redémarrer.',
  ],

  source: `${M}/man8/apt-get.8.html`,
  sources: [
    { label: 'apt-get(8) — option -s, simulation', url: `${M}/man8/apt-get.8.html` },
    { label: 'apt(8) — pourquoi apt-get dans un script', url: `${M}/man8/apt.8.html` },
    { label: 'dpkg(1) — états des paquets et option -V', url: `${M}/man1/dpkg.1.html` },
    { label: 'apt.conf(5)', url: `${M}/man5/apt.conf.5.html` },
    { label: 'Ubuntu Server — Install and manage packages', url: `${DOC}/how-to/software/package-management/` },
  ],
};

// ===========================================================================
// ASSISTANT 4 — DIAGNOSTIQUER L'HEURE ET LA SYNCHRONISATION
//
// POURQUOI L'HEURE EST UN SUJET DE SÉCURITÉ, ET PAS DE CONFORT
//
// Kerberos refuse un ticket dont l'horodatage dévie de plus de cinq minutes.
// C'est ce qui fait échouer une jonction de domaine Samba AD avec « Clock skew
// too great », message qui ne parle pas d'heure pour qui ne le sait pas. Les
// journaux de deux machines désynchronisées ne se corrèlent plus. Et un
// certificat TLS devient « pas encore valide » si l'horloge recule.
//
// Cet assistant LIT, et il ne pose jamais l'heure. `timedatectl set-time`
// échoue quand NTP est actif, et quand il réussit il fait SAUTER l'horloge —
// exactement ce que Kerberos et les journaux ne supportent pas. La bonne
// correction est de régler la SOURCE, et la source règle l'heure : les
// commandes sont dans la fiche, à taper à la main.
//
// `hwclock` est en OBSERVATION seulement : il lit l'horloge matérielle. Y
// écrire sur une machine qui démarre aussi sous Windows décale l'heure de
// l'autre système, et ce réglage se décide en connaissant les deux.
// ===========================================================================

const linuxTimeSyncDiagnostic = {
  id: 'linux-time-sync-diagnostic',
  icon: '◈',
  category: CAT,
  subcategory: 'Services et journaux',
  title: 'Diagnostiquer l’heure et la synchronisation NTP',
  risk: 'diagnostic',
  summary: 'Lit le fuseau horaire, l’état NTP demandé et l’état réellement synchronisé — deux choses différentes que timedatectl distingue et qu’on confond — puis le serveur effectivement interrogé, l’écart mesuré, l’horloge matérielle en observation, et les conflits entre chrony et systemd-timesyncd. Ne pose jamais l’heure : une horloge qui saute casse Kerberos et rend les journaux incomparables.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'systemd — timedatectl, systemd-timesyncd (présent par défaut)',
    'util-linux — hwclock, en lecture seule (présent par défaut)',
    'chrony — chronyc, si chrony est le client de la machine (facultatif)',
  ],
  privileges: 'aucun pour timedatectl et chronyc ; root pour lire l’horloge matérielle avec hwclock',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'systemd-timesyncd.service',
  limites: [
    'NE POSE JAMAIS L’HEURE, et n’offre aucun champ pour le faire. « timedatectl set-time » échoue quand NTP est actif, et quand il réussit il fait SAUTER l’horloge : Kerberos refuse alors les tickets, les journaux de deux machines ne se corrèlent plus, et un certificat peut devenir « pas encore valide ».',
    'Ne règle ni le fuseau, ni NTP, ni les serveurs. Les commandes sont dans la fiche, avec leur ordre et leur vérification : régler l’heure d’un serveur est une décision, pas un bouton.',
    'hwclock est en OBSERVATION seulement. Écrire dans l’horloge matérielle sur une machine qui démarre aussi sous Windows décale l’heure de l’autre système.',
    'Ne modifie ni /etc/systemd/timesyncd.conf, ni /etc/chrony/chrony.conf, ni aucun drop-in.',
    'Ne teste pas la joignabilité du port 123/udp par un envoi de paquet : il lit ce que le client NTP de la machine rapporte lui-même, ce qui est plus fiable et ne dépend pas d’un outil supplémentaire.',
  ],

  fields: [
    {
      id: 'lireHorlogeMaterielle',
      label: 'Lire aussi l’horloge matérielle',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Oui lance « hwclock --show », en LECTURE. Demande root. L’écart entre l’horloge système et l’horloge matérielle explique une heure fausse juste après un démarrage.',
    },
    {
      id: 'lignesJournal',
      label: 'Lignes de journal du service de temps',
      type: 'text',
      default: '20',
      placeholder: '20',
      help: 'Entre 0 et 200. Le journal du client NTP dit quel serveur a été contacté, et ce qu’il a répondu.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const h = validateChoix(v.lireHorlogeMaterielle, ['Oui', 'Non'], 'La lecture de l’horloge matérielle');
    if (!h.ok) errors.lireHorlogeMaterielle = h.error;
    const l = validateEntierBorne(v.lignesJournal, 0, 200, 'Le nombre de lignes de journal');
    if (!l.ok) errors.lignesJournal = l.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer l heure et la synchronisation NTP',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'timedatectl se lit sans privilege ; root n est utile que pour hwclock',
      }),
      ...blocVariablesBash([
        ['KJEMO_HWCLOCK', shQuote(String(v.lireHorlogeMaterielle))],
        ['KJEMO_LIGNES', shQuote(String(v.lignesJournal).trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Horloge materielle' \"${KJEMO_HWCLOCK} (lecture seule)\"",
      "  printf '%s\\t%s\\n' 'Lignes de journal' \"${KJEMO_LIGNES}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - l heure n est jamais posee par ce script'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - L HEURE TELLE QUE LA MACHINE LA VOIT',
      '#',
      '# « date » donne l heure locale, et c est ce qu on regarde d abord. Mais',
      '# l heure UTC et l heure locale ne se trompent pas ensemble : un fuseau',
      '# faux decale l affichage sans toucher a l instant, et une horloge fausse',
      '# decale les deux. Les afficher cote a cote distingue les deux pannes.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_LOCALE="$(date 2>/dev/null || true)"',
      'KJEMO_UTC="$(date -u 2>/dev/null || true)"',
      "kjemo_resultat 'Heure' 'Locale' 'INFO' \"${KJEMO_LOCALE}\" \\",
      "  'L heure affichee par la machine, dans son fuseau.'",
      "kjemo_resultat 'Heure' 'UTC' 'INFO' \"${KJEMO_UTC}\" \\",
      "  'Le meme instant en UTC. Si l heure UTC est juste et l heure locale fausse, c est le FUSEAU qui est en cause, pas l horloge.'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - NTP DEMANDE N EST PAS NTP SYNCHRONISE',
      '#',
      '# C est la confusion centrale du sujet, et timedatectl la distingue :',
      '#   NTP=yes             la synchronisation est DEMANDEE.',
      '#   NTPSynchronized=yes une correction a REELLEMENT eu lieu.',
      '#',
      '# Un serveur peut avoir NTP=yes depuis six mois et NTPSynchronized=no',
      '# parce que le port 123/udp est bloque en sortie. Tout semble configure,',
      '# et l heure derive.',
      '#',
      '# « timedatectl show » rend des lignes Clef=valeur, stables et faites pour',
      '# etre lues par un programme ; la sortie sans argument est faite pour un',
      '# humain et change de forme.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SYNC_OK=0',
      'if ! kjemo_dispo timedatectl; then',
      "  kjemo_resultat 'Prerequis' 'timedatectl' 'PROBLEME' 'absent' \\",
      "    'Cette machine n utilise pas systemd. L heure se diagnostique alors avec date, hwclock et la configuration du client NTP de la distribution.'",
      'else',
      '  KJEMO_FUSEAU="$(timedatectl show -p Timezone --value 2>/dev/null || true)"',
      '  KJEMO_NTP="$(timedatectl show -p NTP --value 2>/dev/null || true)"',
      '  KJEMO_SYNC="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)"',
      '  KJEMO_RTC="$(timedatectl show -p LocalRTC --value 2>/dev/null || true)"',
      '  KJEMO_SERVICE="$(timedatectl show -p CanNTP --value 2>/dev/null || true)"',
      "  kjemo_resultat 'Fuseau' 'Timezone' 'INFO' \"${KJEMO_FUSEAU:-inconnu}\" \\",
      "    'Le nom IANA porte la regle d heure d ete, ce qui le distingue d une abreviation comme EST : une machine reglee sur « EST » reste une heure en retard tout l ete.'",
      '  if [ "${KJEMO_NTP}" = \'yes\' ]; then',
      "    kjemo_resultat 'NTP' 'Demande' 'OK' 'yes' \\",
      "      'La synchronisation est demandee. Cela ne dit pas qu elle a lieu.'",
      '  else',
      "    kjemo_resultat 'NTP' 'Demande' 'ATTENTION' \"${KJEMO_NTP:-no}\" \\",
      "      'La synchronisation reseau n est pas demandee : l horloge derive librement. Sur un serveur, c est presque toujours une erreur. Pour l activer : sudo timedatectl set-ntp true.'",
      '  fi',
      '  if [ "${KJEMO_SYNC}" = \'yes\' ]; then',
      '    KJEMO_SYNC_OK=1',
      "    kjemo_resultat 'NTP' 'Synchronise' 'OK' 'yes' \\",
      "      'Une correction a reellement eu lieu : c est la seule ligne qui le dise.'",
      '  else',
      "    kjemo_resultat 'NTP' 'Synchronise' 'PROBLEME' \"${KJEMO_SYNC:-no}\" \\",
      "      'Aucune correction reseau n a abouti. Si NTP=yes et que cela persiste, la cause est presque toujours le port 123/udp bloque en sortie, ou un serveur injoignable. C est l etat qui fait echouer une jonction de domaine avec « Clock skew too great », sans jamais parler d heure.'",
      '  fi',
      "  kjemo_resultat 'Horloge materielle' 'LocalRTC' 'INFO' \"${KJEMO_RTC:-inconnu}\" \\",
      "    'LocalRTC=no signifie que l horloge materielle est en UTC, le reglage attendu sur un serveur. « yes » se rencontre sur une machine qui demarre aussi sous Windows.'",
      '  if [ "${KJEMO_SERVICE}" = \'no\' ]; then',
      "    kjemo_resultat 'NTP' 'Service de temps' 'ATTENTION' 'aucun service pilotable' \\",
      "      'systemd ne voit aucun service de temps qu il puisse piloter : systemd-timesyncd est peut-etre absent ou masque, et c est alors un autre client — chrony, souvent — qui tient l heure.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - QUEL CLIENT TIENT L HEURE, ET SONT-ILS DEUX ?',
      '#',
      '# chrony et systemd-timesyncd corrigent tous deux l horloge. Les laisser',
      '# tourner ensemble donne une heure qui oscille, et des journaux ou le',
      '# temps recule. Sur Ubuntu Server, chrony est souvent installe',
      '# volontairement : c est alors LUI le client, et timesyncd doit rester a',
      '# l arret.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo systemctl; then',
      '  KJEMO_TSD="$(systemctl is-active systemd-timesyncd.service 2>/dev/null || true)"',
      '  KJEMO_CHR="$(systemctl is-active chrony.service 2>/dev/null || true)"',
      '  KJEMO_CHRD="$(systemctl is-active chronyd.service 2>/dev/null || true)"',
      '  KJEMO_ACTIFS=0',
      '  if [ "${KJEMO_TSD}" = \'active\' ]; then KJEMO_ACTIFS=$((KJEMO_ACTIFS + 1)); fi',
      '  if [ "${KJEMO_CHR}" = \'active\' ] || [ "${KJEMO_CHRD}" = \'active\' ]; then KJEMO_ACTIFS=$((KJEMO_ACTIFS + 1)); fi',
      "  kjemo_resultat 'Client NTP' 'systemd-timesyncd' 'INFO' \"${KJEMO_TSD:-inconnu}\" ''",
      "  kjemo_resultat 'Client NTP' 'chrony' 'INFO' \"${KJEMO_CHR:-absent} / ${KJEMO_CHRD:-absent}\" \\",
      "    'Le nom de l unite varie : chrony.service sur Ubuntu, chronyd.service ailleurs.'",
      '  if [ "${KJEMO_ACTIFS}" -ge 2 ]; then',
      "    kjemo_resultat 'Client NTP' 'Conflit' 'PROBLEME' 'deux clients actifs' \\",
      "      'Deux programmes corrigent la meme horloge sans se parler : l heure oscille, et le temps peut reculer dans les journaux. N en garde qu un. Si chrony est installe volontairement, desactive systemd-timesyncd : sudo systemctl disable --now systemd-timesyncd.'",
      '  elif [ "${KJEMO_ACTIFS}" -eq 0 ]; then',
      "    kjemo_resultat 'Client NTP' 'Aucun' 'ATTENTION' 'aucun client actif' \\",
      "      'Aucun client NTP ne tourne : l horloge derive librement, de quelques secondes par jour sur une machine physique, bien plus sur une machine virtuelle.'",
      '  else',
      "    kjemo_resultat 'Client NTP' 'Conflit' 'OK' 'un seul client actif' ''",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - QUEL SERVEUR, ET QUEL ECART ?',
      '#',
      '# C est la question que « NTP=yes » ne resout pas : quel serveur est',
      '# REELLEMENT interroge, et de combien l horloge etait-elle fausse ? C est',
      '# aussi la seule facon de verifier qu un serveur impose par le reseau est',
      '# bien celui qui sert.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo timedatectl; then',
      '  KJEMO_TSS="$(timedatectl timesync-status 2>/dev/null | head -20 || true)"',
      '  if [ -n "${KJEMO_TSS}" ]; then',
      "    kjemo_resultat 'Source' 'timesync-status' 'INFO' \"${KJEMO_TSS}\" \\",
      "      'Serveur interroge, ecart mesure (Offset), intervalle d interrogation (Poll interval) et strate. Un Offset de quelques millisecondes est normal ; une seconde ou plus merite attention.'",
      '  else',
      "    kjemo_resultat 'Source' 'timesync-status' 'IGNORE' 'indisponible' \\",
      "      'Cette commande ne repond que si systemd-timesyncd est le client en service. Avec chrony, c est chronyc qui renseigne.'",
      '  fi',
      'fi',
      'if kjemo_dispo chronyc; then',
      '  KJEMO_TRACKING="$(chronyc tracking 2>/dev/null | head -15 || true)"',
      '  if [ -n "${KJEMO_TRACKING}" ]; then',
      "    kjemo_resultat 'Source' 'chronyc tracking' 'INFO' \"${KJEMO_TRACKING}\" \\",
      "      'Reference ID nomme le serveur retenu, System time donne l ecart courant, et Leap status doit valoir « Normal ». « Not synchronised » y est dit franchement.'",
      '  fi',
      '  KJEMO_SOURCES="$(chronyc sources 2>/dev/null | head -15 || true)"',
      '  if [ -n "${KJEMO_SOURCES}" ]; then',
      "    kjemo_resultat 'Source' 'chronyc sources' 'INFO' \"${KJEMO_SOURCES}\" \\",
      "      'Une ligne par serveur. Le caractere en tete dit son role : « * » le serveur retenu, « + » un candidat acceptable, « ? » un serveur injoignable.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - L HORLOGE MATERIELLE, EN LECTURE SEULE',
      '#',
      '# hwclock --show LIT la pile de la carte mere. L ecart entre les deux',
      '# horloges explique une heure fausse juste apres un demarrage : c est',
      '# l horloge materielle qui donne l heure au demarrage, avant que le',
      '# reseau soit la.',
      '#',
      '# Aucune ecriture : « hwclock --systohc » sur une machine qui demarre',
      '# aussi sous Windows decale l heure de l autre systeme.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_HWCLOCK}" = \'Oui\' ]; then',
      '  if ! kjemo_dispo hwclock; then',
      "    kjemo_resultat 'Horloge materielle' 'hwclock' 'IGNORE' 'absent' \\",
      "      'hwclock vient du paquet util-linux. Sur une machine virtuelle, l horloge materielle est souvent simulee par l hyperviseur et la question a moins de sens.'",
      '  elif [ "$(id -u)" -ne 0 ]; then',
      "    kjemo_resultat 'Horloge materielle' 'hwclock' 'IGNORE' 'root requis' \\",
      "      'La lecture de l horloge materielle demande root. Relance avec sudo pour cette partie du diagnostic.'",
      '  else',
      '    KJEMO_HW="$(hwclock --show 2>/dev/null || true)"',
      '    if [ -n "${KJEMO_HW}" ]; then',
      "      kjemo_resultat 'Horloge materielle' 'hwclock --show' 'INFO' \"${KJEMO_HW}\" \\",
      "      'Lecture seule. Compare avec l heure systeme : un ecart important explique une heure fausse au demarrage, avant que le reseau soit disponible.'",
      '    else',
      "      kjemo_resultat 'Horloge materielle' 'hwclock --show' 'ATTENTION' 'illisible' \\",
      "        'hwclock n a rien rendu. Sur certaines machines virtuelles, l horloge materielle n est pas accessible depuis le systeme invite.'",
      '    fi',
      '  fi',
      'else',
      "  kjemo_resultat 'Horloge materielle' 'Lecture' 'IGNORE' 'non demandee' ''",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - LE JOURNAL DU CLIENT DE TEMPS',
      '#',
      '# Il dit ce que les etats ne disent pas : quel serveur a ete contacte,',
      '# ce qu il a repondu, et depuis quand cela echoue.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_LIGNES}" -gt 0 ] 2>/dev/null && kjemo_dispo journalctl; then',
      '  KJEMO_JOURNAL="$(journalctl -u systemd-timesyncd -u chrony -u chronyd \\',
      '    -n "${KJEMO_LIGNES}" --no-pager 2>/dev/null || true)"',
      '  if [ -n "${KJEMO_JOURNAL}" ]; then',
      "    kjemo_resultat 'Journal' 'Clients de temps' 'INFO' \"${KJEMO_JOURNAL}\" \\",
      "      'Lignes des deux clients possibles. « Initial synchronization to time server » est la ligne qu on cherche ; son absence, avec NTP=yes, pointe un blocage reseau.'",
      '  else',
      "    kjemo_resultat 'Journal' 'Clients de temps' 'ATTENTION' 'aucune ligne' \\",
      "      'Aucune ligne pour ces unites. Sans privileges, seul le journal de la session est lisible : relance avec sudo. Et verifie que le journal est persistant — sinon il ne couvre que depuis le dernier demarrage.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - CE QUE CE DIAGNOSTIC NE FAIT PAS, ET POURQUOI',
      '# ---------------------------------------------------------------------------',
      "printf '%s\\n' 'Aucune ecriture : l heure n a pas ete touchee par ce script.'",
      "kjemo_resultat 'Portee' 'Aucune ecriture' 'INFO' 'l heure n a pas ete touchee' \\",
      "  'Ce script ne pose ni l heure, ni le fuseau, ni NTP. « timedatectl set-time » echoue quand NTP est actif, et quand il reussit il fait SAUTER l horloge : Kerberos refuse alors les tickets, et les journaux de deux machines ne se corrèlent plus. La bonne correction est de regler la SOURCE — les commandes sont dans la fiche, avec leur ordre et leur verification.'",
      'if [ "${KJEMO_SYNC_OK}" -eq 0 ]; then',
      "  kjemo_resultat 'Portee' 'A faire ensuite' 'ATTENTION' 'synchronisation a retablir' \\",
      "    'Dans l ordre : regler le fuseau (timedatectl set-timezone), activer NTP (timedatectl set-ntp true), puis RELIRE NTPSynchronized apres une minute. Si cela reste « no », ouvre 123/udp en sortie. Ne pose jamais l heure a la main pour « rattraper » : c est le saut d horloge qui casse Kerberos.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-heure-diagnostic' }),
    ]);
  },

  gui: [
    'Lis l’état en format stable : « timedatectl show ».',
    'Les deux lignes qu’on confond : NTP (la synchronisation est DEMANDÉE) et NTPSynchronized (elle a EU LIEU).',
    'Un serveur peut avoir NTP=yes depuis six mois et NTPSynchronized=no parce que 123/udp est bloqué en sortie. Tout semble configuré, et l’heure dérive.',
    'Quel serveur sert vraiment, et quel écart : « timedatectl timesync-status », ou « chronyc tracking » si chrony est le client.',
    'Vérifie qu’un SEUL client NTP tourne : « systemctl is-active systemd-timesyncd chrony ». Deux clients font osciller l’heure.',
    'L’horloge matérielle, en lecture : « sudo hwclock --show ». C’est elle qui donne l’heure au démarrage, avant le réseau.',
    'Le journal dit ce que les états ne disent pas : « journalctl -u systemd-timesyncd -n 30 --no-pager ».',
    'Pour corriger — à taper à la main : « sudo timedatectl set-timezone America/Toronto » puis « sudo timedatectl set-ntp true », et relire NTPSynchronized après une minute.',
    'Pour imposer des serveurs, écris un DROP-IN — jamais timesyncd.conf : « /etc/systemd/timesyncd.conf.d/90-local.conf » avec « [Time] » puis « NTP=0.ca.pool.ntp.org », puis « sudo systemctl restart systemd-timesyncd ».',
    'Ne pose JAMAIS l’heure avec « set-time » : elle saute, et Kerberos refuse alors les tickets avec « Clock skew too great ».',
  ],

  keywords: ['timedatectl', 'ntp', 'heure', 'fuseau', 'timezone', 'timesyncd', 'chrony',
    'chronyc', 'hwclock', 'synchronisation', 'kerberos', 'clock skew', 'rtc',
    'utc', 'derive', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'sudo pour lire l’horloge matérielle et le journal du système — le reste se lit sans privilège.',
    'Rien d’autre : le diagnostic n’exige aucun paquet supplémentaire, et n’écrit rien.',
    'Pour interpréter le résultat : savoir si cette machine doit rejoindre un domaine. La tolérance de Kerberos est de cinq minutes, et c’est ce seuil qui rend l’écart important ou anodin.',
  ],

  commonErrors: [
    {
      message: 'Clock skew too great',
      code: 'KRB5KRB_AP_ERR_SKEW',
      cause: 'L’horloge dévie de plus de cinq minutes de celle du contrôleur de domaine. Kerberos refuse les tickets, et la jonction de domaine échoue sans parler d’heure.',
      fix: 'Synchroniser les deux machines sur la même source AVANT toute opération de domaine, et vérifier NTPSynchronized — pas seulement NTP.',
      command: 'timedatectl show -p NTPSynchronized --value',
    },
    {
      message: 'NTP=yes et NTPSynchronized=no depuis des heures',
      code: 'KJEMO',
      cause: 'La synchronisation est demandée mais aucun échange n’aboutit : port 123/udp bloqué en sortie, ou serveur injoignable.',
      fix: 'Regarder quel serveur est interrogé et ce que le journal en dit.',
      command: 'timedatectl timesync-status; journalctl -u systemd-timesyncd -n 20 --no-pager',
    },
    {
      message: 'Failed to set time: Automatic time synchronization is enabled',
      code: 'KJEMO',
      cause: 'On a tenté de poser l’heure à la main alors que NTP est actif. C’est un refus volontaire de systemd.',
      fix: 'Ne pas poser l’heure : régler la source. Cet assistant n’offre pas set-time, pour cette raison.',
      command: 'timedatectl show -p NTP --value',
    },
    {
      message: 'L’heure oscille de quelques secondes dans les deux sens',
      code: 'KJEMO',
      cause: 'Deux clients NTP tournent — chrony et systemd-timesyncd — et corrigent la même horloge sans se concerter.',
      fix: 'N’en garder qu’un seul actif.',
      command: 'systemctl is-active systemd-timesyncd chrony',
    },
    {
      message: 'L’heure est fausse juste après un démarrage, puis se corrige',
      code: 'KJEMO',
      cause: 'L’horloge matérielle est fausse ou interprétée dans le mauvais référentiel. C’est elle qui donne l’heure au démarrage, avant que le réseau soit disponible.',
      fix: 'Lire les deux horloges et LocalRTC. Écrire dans l’horloge matérielle se décide en sachant si la machine démarre aussi sous Windows.',
      command: 'sudo hwclock --show; timedatectl show -p LocalRTC --value',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport distingue NTP (demandé) de NTPSynchronized (effectif) : ce sont deux lignes, et deux questions.',
    'Le serveur réellement interrogé est nommé, avec l’écart mesuré.',
    'Le nombre de clients NTP actifs est compté : deux est signalé comme PROBLEME, zéro comme ATTENTION.',
    'Si la synchronisation manque, le rapport donne l’ordre des commandes à taper et la cause probable d’un échec persistant.',
    'Aucune écriture : le script n’appelle ni set-time, ni set-timezone, ni set-ntp, ni hwclock en écriture.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant ne fait que lire. Les commandes de correction sont ci-dessous, dans l’ordre, avec leur vérification — elles se tapent à la main.',
    diagnostic: `# L etat complet, en format stable :
timedatectl show
timedatectl timesync-status
# Les clients en presence :
systemctl is-active systemd-timesyncd chrony chronyd
# Les serveurs imposes, s il y en a :
ls -l /etc/systemd/timesyncd.conf.d/ 2>/dev/null`,
    command: `# Cet assistant ne change rien. Pour corriger, dans cet ordre :

# 1. Le fuseau. Cherche d abord le nom exact — EST et CET ne sont pas des
#    fuseaux et ne portent pas l heure d ete :
#    timedatectl list-timezones | grep -i toronto
#    sudo timedatectl set-timezone America/Toronto

# 2. La synchronisation :
#    sudo timedatectl set-ntp true

# 3. Pour imposer des serveurs, un DROP-IN — jamais timesyncd.conf, qui
#    appartient au paquet et peut etre remplace par une mise a jour :
#    sudo mkdir -p /etc/systemd/timesyncd.conf.d
#    printf '[Time]\\nNTP=0.ca.pool.ntp.org\\n' | sudo tee /etc/systemd/timesyncd.conf.d/90-local.conf
#    sudo systemctl restart systemd-timesyncd
#    Annulation : supprimer ce seul fichier, puis redemarrer le service.

# 4. RELIRE apres une minute, et ne pas conclure avant :
timedatectl show -p NTPSynchronized --value
timedatectl timesync-status

# Et ce qu il ne faut PAS faire : « timedatectl set-time ». L horloge
# sauterait, Kerberos refuserait les tickets, et les journaux deviendraient
# incomparables entre machines.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Une horloge qu’on pose à la main saute, et un saut d’horloge laisse des traces durables : des journaux où le temps recule, des certificats momentanément refusés, des tickets Kerberos invalides. La correction par NTP, elle, se fait par petites touches continues — c’est tout l’intérêt.',
  },

  checks: [
    'Aucune écriture : ni set-time, ni set-timezone, ni set-ntp, ni hwclock --systohc, ni modification de timesyncd.conf ou de chrony.conf.',
    'hwclock est appelé avec --show seulement, et seulement si root : sans privilège, la partie est IGNORÉE plutôt que présentée comme un échec.',
    'NTP et NTPSynchronized sont lus séparément, et le rapport explique que l’un est une demande et l’autre un fait.',
    'Le nombre de clients NTP actifs est compté : deux clients sont signalés comme PROBLEME, avec la commande qui en désactive un.',
    'Le serveur réellement utilisé est relu, par timesync-status et par chronyc selon le client en place.',
    'L’heure locale et l’heure UTC sont affichées côte à côte : cela distingue un fuseau faux d’une horloge fausse.',
    '« timedatectl show » est préféré à la sortie sans argument, dont la forme change entre versions.',
    'Les commandes de correction sont dans la fiche, avec leur ordre et leur relecture — jamais exécutées par le script.',
  ],

  source: `${M}/man1/timedatectl.1.html`,
  sources: [
    { label: 'timedatectl(1)', url: `${M}/man1/timedatectl.1.html` },
    { label: 'systemd-timesyncd.service(8)', url: `${M}/man8/systemd-timesyncd.service.8.html` },
    { label: 'timesyncd.conf(5) — drop-in et clef NTP', url: `${M}/man5/timesyncd.conf.5.html` },
    { label: 'chronyc(1) — tracking et sources', url: `${M}/man1/chronyc.1.html` },
    { label: 'chrony.conf(5)', url: `${M}/man5/chrony.conf.5.html` },
    { label: 'Ubuntu Server — servir le temps avec Chrony', url: `${DOC}/how-to/networking/serve-ntp-with-chrony/` },
  ],
};

export const toolsLinuxH = [
  systemdServiceDiagnostic,
  systemdServiceControl,
  linuxPackageDiagnostic,
  linuxTimeSyncDiagnostic,
];
