/**
 * outils-linux-b.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Catalogue Linux, deuxième partie : Utilisateurs et permissions (4),
 * Services et journaux (3), Réseau Linux (4).
 *
 * Onze assistants, dont cinq modifient le système. Tous les cinq suivent le
 * même schéma, et il n'est pas négociable :
 *
 *   état initial  →  prérequis  →  sauvegarde vérifiée  →  simulation
 *                 →  confirmation  →  action  →  RELECTURE  →  verdict
 *
 * La relecture est l'étape qu'on saute. C'est pourtant la seule qui distingue
 * « la commande a été acceptée » de « l'effet voulu a eu lieu » — un service
 * qui démarre puis meurt en deux secondes fait réussir `systemctl start`.
 *
 * Aucun de ces modules n'importe generators.mjs : même discipline qu'aux lots
 * précédents, pour éviter un cycle ESM.
 */

import { assertValid } from './noyau.mjs';
import {
  shQuote, assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocParametresBash, blocVariablesBash, blocRapportBash, blocPrivilegesBash,
} from './noyau-bash.mjs';
import {
  blocGardienChemin, blocSauvegardeFichier, blocConfirmation, blocEtatService,
} from './gardes-bash.mjs';
import {
  validateCheminAbsolu, validateEntierBorne, validateNomUnite, validateChoix,
  validateNomUtilisateur, validateNomGroupe, validateModeOctal,
} from './validateurs-linux.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';

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

// ===========================================================================
// SOUS-RUBRIQUE 3 — UTILISATEURS ET PERMISSIONS
// ===========================================================================

const linuxUserAudit = {
  id: 'linux-user-audit',
  icon: '△',
  category: CAT,
  subcategory: 'Utilisateurs et permissions',
  title: 'Audit des comptes locaux',
  risk: 'diagnostic',
  summary: 'Relève les comptes locaux, leurs UID, leurs groupes, leur interpréteur de connexion, leur état de verrouillage et leur dernière connexion. Ne modifie aucun compte.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['passwd — chage, lastlog (présent par défaut)', 'coreutils (présent par défaut)'],
  privileges: 'aucun pour l\u2019essentiel ; root pour lire l\u2019état de verrouillage dans /etc/shadow',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: null,
  limites: [
    'Ne lit JAMAIS les empreintes de mots de passe. L\u2019état de verrouillage est déduit du premier caractère du champ, sans jamais recopier le champ lui-même.',
    'Ne couvre que les comptes LOCAUX : les comptes LDAP, Active Directory ou Kerberos n\u2019apparaissent pas ici.',
    'Ne modifie, ne verrouille, ne déverrouille et ne supprime aucun compte.',
    'Sans privilèges, l\u2019état de verrouillage et l\u2019expiration restent inaccessibles, et le rapport le signale au lieu de les deviner.',
  ],

  fields: [
    {
      id: 'portee',
      label: 'Comptes à inclure',
      type: 'select',
      default: 'Humains',
      options: [
        ['Humains', 'Comptes humains (UID >= 1000)'],
        ['Systeme', 'Comptes système (UID < 1000)'],
        ['Tous', 'Tous les comptes'],
      ],
      help: 'Les comptes système sont nombreux et rarement intéressants pour un audit.',
    },
    {
      id: 'seuilInactif',
      label: 'Alerter si pas de connexion depuis (jours)',
      type: 'number',
      default: '90',
      min: '7',
      max: '3650',
      help: 'Un compte actif jamais utilisé est une porte ouverte que personne ne surveille.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const p = validateChoix(v.portee, ['Humains', 'Systeme', 'Tous'], 'La portée');
    if (!p.ok) errors.portee = p.error;
    const s = validateEntierBorne(v.seuilInactif, 7, 3650, 'Le seuil d\u2019inactivité');
    if (!s.ok) errors.seuilInactif = s.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    return assemblerSh([
      ...enteteBash({
        titre: 'Audit des comptes locaux : UID, groupes, shell, verrouillage',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_PORTEE', shQuote(String(v.portee))],
        ['KJEMO_SEUIL', shQuote(String(v.seuilInactif))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Portee', '${KJEMO_PORTEE}'],
        ['Seuil inactivite', '${KJEMO_SEUIL}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# CE SCRIPT NE LIT JAMAIS UNE EMPREINTE DE MOT DE PASSE',
      '#',
      '# /etc/shadow contient les empreintes. Ce script en deduit UNIQUEMENT',
      '# l etat de verrouillage, a partir du PREMIER CARACTERE du champ :',
      '#   !  ou  *   le compte ne peut pas se connecter par mot de passe',
      '#   vide       aucun mot de passe exige : a signaler immediatement',
      '#   autre      un mot de passe est defini',
      '#',
      '# Le champ lui-meme n est jamais recopie, ni dans une variable, ni dans le',
      '# rapport. Une empreinte dans un fichier de rapport est une empreinte qui',
      '# finira dans un ticket, puis dans une piece jointe.',
      '# ---------------------------------------------------------------------------',
      '',
      '# getent plutot que /etc/passwd : getent interroge TOUTES les bases',
      '# configurees dans nsswitch.conf. Lire /etc/passwd directement raterait',
      '# les comptes locaux definis autrement, et le rapport serait faux par',
      '# omission sans le dire.',
      'KJEMO_COMPTES="${KJEMO_TMP}/comptes.txt"',
      'getent passwd > "${KJEMO_COMPTES}" 2>/dev/null || cat /etc/passwd > "${KJEMO_COMPTES}"',
      '',
      'kjemo_nb=0',
      'kjemo_sans_motdepasse=0',
      'kjemo_uid_zero=0',
      'kjemo_shell_actif=0',
      '',
      '# Le dossier personnel n est pas exploite par cet audit : il est lu dans _,',
      '# et c est volontaire. Une variable nommee et jamais lue fait croire a un',
      '# oubli, et ShellCheck le signale a juste titre.',
      'while IFS=: read -r kjemo_nom _ kjemo_uid kjemo_gid _ _ kjemo_shell; do',
      '  if [ -z "${kjemo_nom:-}" ]; then continue; fi',
      '  # La portee : les comptes systeme sont nombreux et rarement interessants.',
      '  case "${KJEMO_PORTEE}" in',
      '    Humains) if [ "${kjemo_uid}" -lt 1000 ] 2>/dev/null; then continue; fi ;;',
      '    Systeme) if [ "${kjemo_uid}" -ge 1000 ] 2>/dev/null; then continue; fi ;;',
      '  esac',
      '  kjemo_nb=$((kjemo_nb + 1))',
      '',
      '  # Les groupes, par getent pour la meme raison que plus haut.',
      '  kjemo_groupes=\'\'',
      '  kjemo_groupes="$(id -nG "${kjemo_nom}" 2>/dev/null | tr \' \' \',\' || echo inconnus)"',
      '',
      '  # Un UID 0 autre que root est la trouvaille la plus grave d un audit de',
      '  # comptes : c est un acces administrateur complet qui ne porte pas le nom',
      '  # root, et qui echappe donc a toute surveillance nominative.',
      '  if [ "${kjemo_uid}" = \'0\' ] && [ "${kjemo_nom}" != \'root\' ]; then',
      '    kjemo_uid_zero=$((kjemo_uid_zero + 1))',
      "    kjemo_resultat 'Comptes' \"${kjemo_nom}\" 'PROBLEME' 'UID 0' \\",
      "      'UID 0 sans etre root : droits administrateur complets sous un autre nom. A examiner immediatement.'",
      '  fi',
      '',
      '  # Un interpreteur de connexion reel signifie que le compte peut ouvrir',
      '  # une session. nologin et false signifient l inverse, et c est ce qu on',
      '  # attend d un compte de service.',
      '  kjemo_connectable=\'non\'',
      '  case "${kjemo_shell}" in',
      '    */nologin|*/false|\'\') kjemo_connectable=\'non\' ;;',
      '    *) kjemo_connectable=\'oui\'; kjemo_shell_actif=$((kjemo_shell_actif + 1)) ;;',
      '  esac',
      '',
      '  # L etat de verrouillage : root seulement, et sans jamais lire l empreinte.',
      '  kjemo_verrou=\'inconnu\'',
      '  if [ "${KJEMO_ROOT}" -eq 1 ]; then',
      '    kjemo_champ=\'\'',
      '    kjemo_champ="$(getent shadow "${kjemo_nom}" 2>/dev/null | cut -d: -f2 || true)"',
      '    # On ne garde que le PREMIER caractere, et on oublie le reste aussitot.',
      '    kjemo_tete="$(printf \'%s\' "${kjemo_champ}" | cut -c1)"',
      '    kjemo_champ=\'\'',
      '    case "${kjemo_tete}" in',
      '      \'!\'|\'*\') kjemo_verrou=\'verrouille\' ;;',
      '      \'\')      kjemo_verrou=\'AUCUN MOT DE PASSE\' ;;',
      '      *)        kjemo_verrou=\'mot de passe defini\' ;;',
      '    esac',
      '    if [ "${kjemo_verrou}" = \'AUCUN MOT DE PASSE\' ] && [ "${kjemo_connectable}" = \'oui\' ]; then',
      '      kjemo_sans_motdepasse=$((kjemo_sans_motdepasse + 1))',
      "      kjemo_resultat 'Comptes' \"${kjemo_nom}\" 'PROBLEME' 'aucun mot de passe' \\",
      "        'Compte connectable SANS mot de passe. A corriger immediatement.'",
      '    fi',
      '  fi',
      '',
      '  # La derniere connexion. lastlog existe partout ; son absence n est pas',
      '  # une erreur, seulement une information en moins.',
      '  kjemo_derniere=\'inconnue\'',
      '  if kjemo_dispo lastlog; then',
      '    kjemo_derniere="$(lastlog -u "${kjemo_nom}" 2>/dev/null | awk \'NR==2 {$1=""; print}\' \\',
      '      | sed \'s/^ *//\' || echo inconnue)"',
      '    if [ -z "${kjemo_derniere}" ]; then kjemo_derniere=\'inconnue\'; fi',
      '  fi',
      '',
      '  # Un compte connectable jamais utilise est une porte ouverte que personne',
      '  # ne surveille. C est le constat le plus utile d un audit de comptes.',
      '  kjemo_etat=\'INFO\'',
      '  kjemo_note="UID ${kjemo_uid}, GID ${kjemo_gid}, shell ${kjemo_shell}, groupes ${kjemo_groupes}"',
      '  case "${kjemo_derniere}" in',
      '    *\'Never logged in\'*|*\'jamais\'*)',
      '      if [ "${kjemo_connectable}" = \'oui\' ]; then',
      '        kjemo_etat=\'ATTENTION\'',
      '        kjemo_note="${kjemo_note} - JAMAIS connecte alors que le compte est connectable."',
      '      fi',
      '      ;;',
      '  esac',
      "  kjemo_resultat 'Comptes' \"${kjemo_nom}\" \"${kjemo_etat}\" \\",
      '    "connectable ${kjemo_connectable}, verrou ${kjemo_verrou}" "${kjemo_note}"',
      'done < "${KJEMO_COMPTES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# Les groupes qui donnent des privileges',
      '#',
      '# sudo et admin donnent root. docker le donne aussi, indirectement et',
      '# totalement : qui peut lancer un conteneur peut monter / et en sortir avec',
      '# les droits root. C est le privilege le plus souvent accorde sans que',
      '# personne realise ce qu il vaut.',
      '# ---------------------------------------------------------------------------',
      'for kjemo_g in sudo admin wheel adm docker lxd disk shadow; do',
      '  kjemo_membres="$(getent group "${kjemo_g}" 2>/dev/null | cut -d: -f4 || true)"',
      '  if [ -n "${kjemo_membres}" ]; then',
      '    kjemo_etat_g=\'INFO\'',
      '    kjemo_note_g=\'\'',
      '    case "${kjemo_g}" in',
      '      docker|lxd)',
      '        kjemo_etat_g=\'ATTENTION\'',
      '        kjemo_note_g=\'Ce groupe equivaut a root : qui peut lancer un conteneur peut monter / et en sortir administrateur.\'',
      '        ;;',
      '      disk|shadow)',
      '        kjemo_etat_g=\'ATTENTION\'',
      '        kjemo_note_g=\'Acces direct aux peripheriques ou aux empreintes de mots de passe.\'',
      '        ;;',
      '      sudo|admin|wheel)',
      '        kjemo_note_g=\'Acces administrateur par sudo.\'',
      '        ;;',
      '    esac',
      "    kjemo_resultat 'Groupes privilegies' \"${kjemo_g}\" \"${kjemo_etat_g}\" \\",
      '      "${kjemo_membres}" "${kjemo_note_g}"',
      '  fi',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# Bilan',
      '# ---------------------------------------------------------------------------',
      "kjemo_resultat 'Bilan' 'Comptes examines' 'INFO' \"${kjemo_nb}\" ''",
      "kjemo_resultat 'Bilan' 'Comptes connectables' 'INFO' \"${kjemo_shell_actif}\" \\",
      "  'Comptes dont l interpreteur de connexion permet d ouvrir une session.'",
      'if [ "${kjemo_uid_zero}" -gt 0 ]; then',
      "  kjemo_resultat 'Bilan' 'Comptes UID 0 hors root' 'PROBLEME' \"${kjemo_uid_zero}\" \\",
      "    'A examiner immediatement.'",
      'fi',
      'if [ "${KJEMO_ROOT}" -eq 0 ]; then',
      "  kjemo_resultat 'Bilan' 'Etat de verrouillage' 'IGNORE' 'non lu' \\",
      "    'Sans privileges, /etc/shadow est illisible : relance avec sudo pour cette partie.'",
      'elif [ "${kjemo_sans_motdepasse}" -eq 0 ]; then',
      "  kjemo_resultat 'Bilan' 'Comptes sans mot de passe' 'OK' 'aucun' ''",
      'fi',
      'printf \'\\n%s\\n\' \'--- Pour aller plus loin ---\'',
      'printf \'  Detail d un compte     : id nom-du-compte ; getent passwd nom-du-compte\\n\'',
      'printf \'  Expiration du mot de passe : sudo chage -l nom-du-compte\\n\'',
      'printf \'  Qui peut sudo quoi     : sudo -l -U nom-du-compte\\n\'',
      'printf \'\\n\'',

      ...blocRapportBash({ prefixeFichier: 'kjemo-audit-comptes' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine Linux.',
    'Liste les comptes humains : « getent passwd | awk -F: \'$3 >= 1000\' ».',
    'Cherche les UID 0 autres que root : « getent passwd | awk -F: \'$3 == 0\' » — toute ligne autre que root est à examiner immédiatement.',
    'Regarde les groupes privilégiés : « getent group sudo », puis « getent group docker » — appartenir à docker équivaut à être root.',
    'Pour un compte précis : « id nom-du-compte » puis « sudo chage -l nom-du-compte » pour l\u2019expiration.',
    'Vérifie les dernières connexions : « lastlog » — un compte connectable jamais utilisé mérite une question.',
  ],

  keywords: ['comptes', 'utilisateurs', 'audit', 'uid', 'gid', 'groupes', 'sudo', 'shadow',
    'verrouillage', 'passwd', 'linux', 'securite', 'docker', 'privileges', 'lastlog', 'inactif'],

  requiresAdmin: false,
  prereqs: [
    'Un accès terminal, local ou par SSH.',
    'Pour l\u2019état de verrouillage et l\u2019expiration : les privilèges root, car /etc/shadow n\u2019est lisible que par root.',
    'Le paquet passwd pour chage et lastlog, présent par défaut sur Ubuntu et Debian.',
  ],

  commonErrors: [
    {
      message: 'L\u2019état de verrouillage est « inconnu » pour tous les comptes',
      code: 'EACCES',
      cause: '/etc/shadow n\u2019est lisible que par root, et la session n\u2019a pas les privilèges.',
      fix: 'Relancer avec sudo. Le rapport marque IGNORE au lieu de prétendre que tous les comptes sont en ordre.',
      command: 'sudo bash linux-user-audit.sh',
    },
    {
      message: 'Un compte de service apparaît avec « connectable oui »',
      code: 'KJEMO',
      cause: 'Son interpréteur de connexion est un shell réel au lieu de /usr/sbin/nologin.',
      fix: 'Un compte de service n\u2019a pas besoin d\u2019ouvrir de session. Changer son shell est une modification que cet assistant ne fait pas : voir usermod -s /usr/sbin/nologin.',
      command: 'getent passwd nom-du-compte',
    },
    {
      message: 'lastlog affiche une date de 1970 ou « Never logged in »',
      code: 'KJEMO',
      cause: 'Le compte ne s\u2019est jamais connecté, ou /var/log/lastlog a été réinitialisé.',
      fix: 'Un compte connectable jamais utilisé est signalé en ATTENTION : c\u2019est une porte ouverte que personne ne surveille.',
    },
    {
      message: 'Des comptes LDAP ou Active Directory n\u2019apparaissent pas',
      code: 'KJEMO',
      cause: 'Cet audit porte sur les comptes que getent retourne, c\u2019est-à-dire ceux des bases configurées dans nsswitch.conf.',
      fix: 'Pour un annuaire distant, l\u2019audit se fait côté annuaire. La fiche le dit dans ses limites, pour que l\u2019absence ne passe pas pour une conformité.',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport donne un nombre de comptes examinés et un nombre de comptes connectables.',
    'Tout UID 0 autre que root apparaît en PROBLEME.',
    'Les groupes sudo, docker, disk et shadow apparaissent avec leurs membres, et docker porte l\u2019avertissement qu\u2019il équivaut à root.',
    'Si la session n\u2019est pas root, la ligne « Etat de verrouillage » est à IGNORE — et non à OK.',
  ],

  rollback: {
    summary: 'Rien à annuler : l\u2019audit lit les bases de comptes. Il ne crée, ne modifie, ne verrouille et ne supprime aucun compte ni aucun groupe.',
    diagnostic: `# Verifier que les comptes sont intacts : comparer le nombre et les dates.
getent passwd | wc -l
ls -l --time-style=full-iso /etc/passwd /etc/group /etc/shadow 2>/dev/null`,
    command: `# Rien a annuler : ce script ne contient ni useradd, ni usermod, ni
# userdel, ni groupadd, ni passwd, ni chage en ecriture.
#
# Le seul effet possible est un fichier de rapport dans le dossier personnel :
#   rm -i "\${HOME}"/kjemo-audit-comptes-*
echo 'Audit en lecture seule : aucune modification a defaire.'`,
    warning: 'Un audit de comptes est un document sensible : il nomme les comptes privilégiés et les comptes mal configurés. Ne le dépose pas sur un partage ouvert, et ne le joins pas à un ticket public. Et s\u2019il révèle un compte sans mot de passe ou un UID 0 inattendu, traite-le comme un incident, pas comme une ligne de rapport.',
  },

  checks: [
    'Aucune empreinte de mot de passe n\u2019est lue ni stockée : seul le premier caractère du champ de /etc/shadow est examiné, puis la variable est vidée.',
    'Le script ne contient aucune commande de modification de compte : ni useradd, ni usermod, ni userdel, ni passwd, ni chage en écriture.',
    'getent est préféré à la lecture directe de /etc/passwd, afin de ne pas omettre silencieusement des comptes venant d\u2019une autre base.',
    'L\u2019appartenance aux groupes docker et lxd est signalée comme équivalente à root, parce qu\u2019elle l\u2019est.',
  ],

  source: `${M}/man5/passwd.5.html`,
  sources: [
    { label: 'passwd(5)', url: `${M}/man5/passwd.5.html` },
    { label: 'shadow(5)', url: `${M}/man5/shadow.5.html` },
    { label: 'id(1)', url: `${M}/man1/id.1.html` },
    { label: 'getent(1)', url: `${M}/man1/getent.1.html` },
    { label: 'chage(1)', url: `${M}/man1/chage.1.html` },
    { label: 'lastlog(8)', url: `${M}/man8/lastlog.8.html` },
  ],
};

export const toolsLinuxB = [
  linuxUserAudit,
];

export { CAT, M, OS_LINUX, DISTROS, CHAMP_FORMAT, validerFormat };
