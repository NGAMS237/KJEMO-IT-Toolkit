/**
 * outils-linux-g.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Comptes, permissions et ACL — quatre assistants.
 *
 *   linux-permission-audit    LIT. Ne change rien, et c'est son intérêt :
 *                             « permission denied » se résout neuf fois sur
 *                             dix en regardant les dossiers PARENTS, pas le
 *                             fichier visé.
 *   linux-permission-change   chmod et chown, avec un fichier de restauration
 *                             écrit et relu AVANT d'agir.
 *   linux-permission-acl      setfacl, et la seule chose que le cours ne dit
 *                             jamais : le masque peut rendre les droits
 *                             EFFECTIFS inférieurs à ceux demandés.
 *   linux-user-create         crée un compte, et rien d'autre. Pas de mot de
 *                             passe, pas de sudoers, pas de suppression.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI QUATRE, ET NON UN
 * ---------------------------------------------------------------------------
 * Un seul assistant « gérer les droits » aurait une fiche dont le risque
 * serait faux dans la moitié des usages : lire les permissions d'un dossier
 * ne porte aucun risque, un `chmod -R` sur /var en porte un définitif. Les
 * séparer, c'est pouvoir dire la vérité sur chacun.
 *
 * `linux-permission-acl` reste distinct de `linux-permission-change` : ce ne
 * sont pas deux degrés de la même chose. Les permissions POSIX répondent à
 * « quels droits pour le propriétaire, le groupe, les autres » ; une ACL
 * répond à « quels droits pour CETTE personne-là, en plus ». Les fondre
 * donnerait un formulaire où la moitié des champs serait grisée.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CES ASSISTANTS REFUSENT, ET POURQUOI
 * ---------------------------------------------------------------------------
 *   chmod 777             refusé par défaut, et pas « déconseillé ». 777 sur
 *                         un dossier partagé veut dire « n'importe quel compte
 *                         de la machine peut remplacer n'importe quel
 *                         fichier » — y compris un service compromis. Le
 *                         besoin réel est presque toujours 2770 avec un
 *                         groupe, et c'est ce que l'assistant propose.
 *   chmod/chown -R sur    /, /etc, /usr, /var, /boot, /bin, /sbin, /lib,
 *   une racine système    /root, /home pris globalement : un seul de ces
 *                         commandes rend la machine inutilisable, et sudo
 *                         lui-même cesse de fonctionner — donc on ne peut
 *                         même plus réparer.
 *   proprietaire root     refusé : donner un fichier à root n'est jamais ce
 *                         qu'on voulait faire, et c'est souvent le symptôme
 *                         d'une commande lancée sur le mauvais chemin.
 *   UID 0                 aucun champ ne permet de le choisir : un second
 *                         compte d'UID 0 est un compte root qui ne s'appelle
 *                         pas root.
 *   suppression de compte aucun assistant ne la fait. `userdel -r` efface le
 *                         dossier personnel, et c'est irréversible.
 *   /etc/sudoers          aucun assistant ne l'écrit. Une faute de syntaxe
 *                         dans ce fichier retire sudo à tout le monde ; il se
 *                         modifie avec `visudo`, qui valide avant d'écrire.
 *   setuid / setgid       sur un FICHIER : refusés par le validateur. Sur un
 *                         DOSSIER, le setgid est légitime et nécessaire à un
 *                         partage de groupe.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import {
  blocGardienChemin, blocConfirmation, blocPorteFinale,
} from './gardes-bash.mjs';
import { assertValid } from './noyau.mjs';
import {
  validateCheminAbsolu, validateChoix, validateModeOctal,
  validateNomUtilisateur, validateNomGroupe,
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

const OUI_NON = [['Non', 'Non'], ['Oui', 'Oui']];

/**
 * Les chemins sur lesquels une opération RÉCURSIVE est refusée.
 *
 * Ce n'est pas la même liste que celle du gardien de chemin, et la différence
 * est le sujet : le gardien refuse d'ÉCRIRE dans /etc ; cette liste refuse de
 * parcourir /home en entier, qui n'est pas une racine système mais où un
 * `chmod -R 755` écraserait les droits de tous les comptes d'un coup.
 */
const RECURSIF_REFUSE = [
  '/', '/etc', '/usr', '/var', '/boot', '/bin', '/sbin', '/lib', '/lib64',
  '/opt', '/srv', '/root', '/home', '/dev', '/proc', '/sys', '/run', '/tmp',
];

function validerCibleRecursive(chemin, recursif, errors, champ) {
  if (recursif !== 'Oui') return;
  const c = String(chemin ?? '').trim().replace(/\/+$/, '') || '/';
  if (RECURSIF_REFUSE.includes(c)) {
    errors[champ] = `Une opération récursive sur « ${c} » est refusée. Ce n’est pas une précaution de forme : un seul chmod ou chown récursif sur une racine système rend la machine inutilisable, et sudo cesse de fonctionner — on ne peut donc même plus réparer. Vise un sous-dossier précis, par exemple ${c === '/home' ? '/home/blaise/partage' : '/srv/donnees/equipe'}.`;
  }
}

/** Les groupes qui donnent des privilèges : on n'y ajoute personne par script. */
const GROUPES_PRIVILEGIES = ['root', 'sudo', 'admin', 'adm', 'shadow', 'wheel',
  'docker', 'lxd', 'disk', 'kvm', 'libvirt'];

// ===========================================================================
// ASSISTANT 1 — LIRE LES PERMISSIONS, Y COMPRIS CELLES DES PARENTS
// ===========================================================================

const linuxPermissionAudit = {
  id: 'linux-permission-audit',
  icon: '◆',
  category: CAT,
  subcategory: 'Utilisateurs et permissions',
  title: 'Auditer les permissions d’un chemin et de ses parents',
  risk: 'diagnostic',
  summary: 'Lit le propriétaire, le groupe, le mode et les ACL d’un chemin, PUIS ceux de chacun de ses dossiers parents — c’est là que se cache la plupart des « permission denied ». Recense au besoin les fichiers inscriptibles par tous, les binaires setuid et setgid, et les ACL posées dans l’arborescence. N’écrit rien.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'coreutils — ls, stat, id (présent par défaut)',
    'util-linux — namei (présent par défaut)',
    'acl — getfacl (apt install acl)',
    'findutils — find (présent par défaut)',
  ],
  privileges: 'aucun pour lire ce que la session peut déjà lire ; root pour parcourir un dossier dont la session n’a pas le droit de traversée',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: null,
  limites: [
    'LIT seulement. Aucun chmod, aucun chown, aucun setfacl : pas même une option pour le faire.',
    'Ne juge pas à la place de l’administrateur. « 777 » est signalé, pas corrigé : un mode trop large peut être exactement ce qu’une application attend, et c’est une décision humaine.',
    'Ne lit pas les attributs étendus de sécurité d’AppArmor ni de SELinux. Un refus d’accès inexpliqué malgré des permissions correctes vient souvent de là, et l’assistant le dit sans prétendre l’analyser.',
    'Le recensement récursif peut être long sur une grande arborescence : il est facultatif, et borné au chemin demandé.',
  ],

  fields: [
    {
      id: 'chemin',
      label: 'Chemin à auditer',
      type: 'text',
      default: '/srv/donnees',
      placeholder: '/srv/donnees',
      help: 'Un fichier ou un dossier, en chemin absolu. Les dossiers parents seront examinés eux aussi.',
    },
    {
      id: 'recursif',
      label: 'Parcourir l’arborescence',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Oui : compte les entrées par propriétaire et par mode sous ce chemin. Sur une grande arborescence, cela prend du temps.',
    },
    {
      id: 'chercherRisques',
      label: 'Recenser les points sensibles',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Cherche les fichiers inscriptibles par tous, les binaires setuid et setgid, et les entrées porteuses d’ACL. Lecture seule.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const c = validateCheminAbsolu(v.chemin, 'Le chemin à auditer');
    if (!c.ok) errors.chemin = c.error;
    for (const champ of ['recursif', 'chercherRisques']) {
      const r = validateChoix(v[champ], ['Oui', 'Non'], 'La réponse');
      if (!r.ok) errors[champ] = r.error;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const chemin = String(v.chemin).trim().replace(/(.)\/+$/, '$1');
    return assemblerSh([
      ...enteteBash({
        titre: 'Auditer les permissions d un chemin et de ses parents',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'la lecture suffit ; root n est utile que pour traverser un dossier interdit a la session',
      }),
      ...blocGardienChemin({ lectureSeule: true }),
      ...blocVariablesBash([
        ['KJEMO_CIBLE', shQuote(chemin)],
        ['KJEMO_RECURSIF', shQuote(String(v.recursif))],
        ['KJEMO_RISQUES', shQuote(String(v.chercherRisques))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Chemin' \"${KJEMO_CIBLE}\"",
      "  printf '%s\\t%s\\n' 'Parcours recursif' \"${KJEMO_RECURSIF}\"",
      "  printf '%s\\t%s\\n' 'Recensement des points sensibles' \"${KJEMO_RISQUES}\"",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - QUI SUIS-JE ?',
      '#',
      '# Les permissions ne veulent rien dire sans savoir QUI lit. Le meme',
      '# dossier est accessible a root et refuse a tout le monde.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_MOI="$(id -un 2>/dev/null || printf \'%s\' inconnu)"',
      'KJEMO_MES_GROUPES="$(id -Gn 2>/dev/null || printf \'%s\' inconnu)"',
      "kjemo_resultat 'Session' 'Identite' 'INFO' \"${KJEMO_MOI} (${KJEMO_MES_GROUPES})\" \\",
      "  'Les droits affiches ensuite se lisent par rapport a ce compte et a ces groupes.'",
      '# umask est une primitive du shell, pas une commande : il se lit ici, dans',
      '# le shell qui executerait les creations de fichiers.',
      'KJEMO_UMASK="$(umask 2>/dev/null || printf \'%s\' inconnu)"',
      "kjemo_resultat 'Session' 'umask' 'INFO' \"${KJEMO_UMASK}\" \\",
      "  'Le umask RETIRE des droits aux fichiers crees ensuite. 0022 donne 644 aux fichiers et 755 aux dossiers ; 0002 donne 664 et 775, ce qu un partage de groupe demande souvent.'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE CHEMIN EXISTE-T-IL, ET QU EST-CE QUE C EST ?',
      '# ---------------------------------------------------------------------------',
      'kjemo_exiger_chemin_sur "${KJEMO_CIBLE}"',
      'KJEMO_CIBLE="${KJEMO_CHEMIN_CANON}"',
      'KJEMO_EXISTE=0',
      'if [ -e "${KJEMO_CIBLE}" ]; then',
      '  KJEMO_EXISTE=1',
      '  KJEMO_TYPE=\'autre\'',
      "  if [ -d \"${KJEMO_CIBLE}\" ]; then KJEMO_TYPE='dossier'",
      "  elif [ -f \"${KJEMO_CIBLE}\" ]; then KJEMO_TYPE='fichier'",
      "  elif [ -L \"${KJEMO_CIBLE}\" ]; then KJEMO_TYPE='lien symbolique'",
      '  fi',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'OK' \"${KJEMO_TYPE}\" ''",
      'else',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'PROBLEME' 'inexistant' \\",
      "    'Rien a cet emplacement. Verifie l orthographe : un chemin absent et un chemin interdit donnent le meme message dans beaucoup d outils.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE DETAIL DE LA CIBLE',
      '#',
      '# stat avec un format EXPLICITE, et non « ls -l » : la sortie de ls est',
      '# faite pour etre lue par un humain, et son format change avec la locale,',
      '# la largeur du terminal et les options par defaut de la distribution.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_EXISTE}" -eq 1 ]; then',
      '  KJEMO_STAT="$(stat -c \'mode=%A (%a)  proprietaire=%U(%u)  groupe=%G(%g)  taille=%s  type=%F\' -- "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Cible' 'Detail' 'INFO' \"${KJEMO_STAT}\" \\",
      "    'Les trois triplets du mode sont, dans l ordre : proprietaire, groupe, autres. Sur un DOSSIER, x ne veut pas dire executer mais TRAVERSER : sans x, on ne peut pas entrer, meme avec r.'",
      '',
      '  # Les bits speciaux, nommes. Le 4e chiffre du mode octal se lit mal a',
      '  # l oeil, et chacun des trois a un effet tres different.',
      '  KJEMO_SPECIAUX="$(stat -c \'%a\' -- "${KJEMO_CIBLE}" 2>/dev/null || printf \'%s\' 0)"',
      '  case "${KJEMO_SPECIAUX}" in',
      '    4???|6???|7???)',
      "      kjemo_resultat 'Cible' 'setuid' 'ATTENTION' \"${KJEMO_SPECIAUX}\" \\",
      "        'Le bit setuid est pose : le programme s executera avec les droits de son PROPRIETAIRE, pas de celui qui le lance. Sur un binaire appartenant a root, c est une elevation de privileges permanente.'",
      '      ;;',
      '  esac',
      '  case "${KJEMO_SPECIAUX}" in',
      '    2???|3???|6???|7???)',
      '      if [ -d "${KJEMO_CIBLE}" ]; then',
      "        kjemo_resultat 'Cible' 'setgid' 'INFO' \"${KJEMO_SPECIAUX}\" \\",
      "          'Le bit setgid est pose sur un dossier : tout fichier cree dedans heritera du GROUPE du dossier, et non du groupe principal de celui qui le cree. C est exactement ce qu un partage de groupe demande.'",
      '      else',
      "        kjemo_resultat 'Cible' 'setgid' 'ATTENTION' \"${KJEMO_SPECIAUX}\" \\",
      "          'Le bit setgid est pose sur un fichier : le programme s executera avec le GROUPE du fichier. Rarement voulu.'",
      '      fi',
      '      ;;',
      '  esac',
      '  case "${KJEMO_SPECIAUX}" in',
      '    1???|3???|5???|7???)',
      "      kjemo_resultat 'Cible' 'sticky' 'INFO' \"${KJEMO_SPECIAUX}\" \\",
      "        'Le sticky bit est pose : dans ce dossier, seul le proprietaire d un fichier peut le supprimer, meme si les autres ont le droit d ecrire. C est ce qui protege /tmp.'",
      '      ;;',
      '  esac',
      '',
      '  # 777 et 666 : signales, pas corriges.',
      '  case "${KJEMO_SPECIAUX}" in',
      '    *777|*776|*766|*666)',
      "      kjemo_resultat 'Cible' 'Mode tres large' 'ATTENTION' \"${KJEMO_SPECIAUX}\" \\",
      "        'N importe quel compte de la machine peut ecrire ici, y compris un service compromis. Le besoin reel est presque toujours un groupe dedie et le mode 2770. Cet assistant le signale et ne corrige rien.'",
      '      ;;',
      '  esac',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LES PARENTS, UN PAR UN',
      '#',
      '# C est l etape qui resout la plupart des « permission denied ». Pour',
      '# ouvrir /srv/donnees/equipe/rapport.txt, il faut le droit de TRAVERSER',
      '# /srv, puis /srv/donnees, puis /srv/donnees/equipe. Un seul x manquant',
      '# sur un parent suffit a tout bloquer, et le message d erreur nomme le',
      '# FICHIER, jamais le dossier fautif.',
      '#',
      '# namei -l fait exactement cela, et il suit aussi les liens symboliques.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo namei; then',
      '  KJEMO_PARENTS="$(namei -l -- "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      '  if [ -n "${KJEMO_PARENTS}" ]; then',
      "    kjemo_resultat 'Parents' 'Chaine complete' 'INFO' \"${KJEMO_PARENTS}\" \\",
      "      'Une ligne par segment du chemin. Cherche un dossier (d) sans x dans le triplet qui te concerne : c est lui qui bloque, et non le fichier vise.'",
      '  else',
      "    kjemo_resultat 'Parents' 'Chaine complete' 'PROBLEME' 'illisible' \\",
      "      'namei n a rien rendu. Le chemin est peut-etre interdit des le premier segment.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Parents' 'namei' 'IGNORE' 'absent' \\",
      // Pas d apostrophe a l interieur de ce message : une chaine Bash entre
      // apostrophes ne connait AUCUN echappement, pas meme le backslash. Un
      // backslash-apostrophe y FERME la chaine au lieu de l echapper, et la
      // suite du script devient du code. C est la propriete qui rend shQuote()
      // sur, lue a l envers — et elle vaut aussi pour les textes ecrits a la
      // main. Defaut vu par bash -n des la premiere generation.
      "    'namei vient du paquet util-linux, normalement present. Sans lui, interroge chaque dossier du chemin un par un avec stat -c et le format %A %U %G %n.'",
      'fi',
      '',
      '# Et la question pratique : la session peut-elle vraiment entrer ?',
      'if [ "${KJEMO_EXISTE}" -eq 1 ] && [ -d "${KJEMO_CIBLE}" ]; then',
      '  if [ -x "${KJEMO_CIBLE}" ] && [ -r "${KJEMO_CIBLE}" ]; then',
      "    kjemo_resultat 'Acces' 'Lecture et traversee' 'OK' 'possible' \\",
      "      'Teste reellement, par le shell, avec les droits de cette session.'",
      '  else',
      "    kjemo_resultat 'Acces' 'Lecture et traversee' 'ATTENTION' 'refusee' \\",
      "      \"Le compte ${KJEMO_MOI} ne peut pas lire ou traverser ce dossier. Regarde la chaine des parents ci-dessus avant de changer le mode de la cible : le probleme est souvent plus haut.\"",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LES ACL, ET LE MASQUE',
      '#',
      '# Un « + » a la fin du mode (« drwxrwx---+ ») signale une ACL. Sans',
      '# getfacl, on ne voit PAS les droits reels : ls affiche le masque a la',
      '# place des droits du groupe, et on croit lire une permission de groupe',
      '# alors qu on lit un plafond.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_EXISTE}" -eq 1 ]; then',
      '  if kjemo_dispo getfacl; then',
      '    KJEMO_ACL="$(getfacl -p -- "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      '    if printf \'%s\' "${KJEMO_ACL}" | grep -qE \'^(user|group):[^:]+:\'; then',
      "      kjemo_resultat 'ACL' \"${KJEMO_CIBLE}\" 'INFO' \"${KJEMO_ACL}\" \\",
      "        'Des entrees nominatives existent. Les lignes « #effective: » donnent les droits REELLEMENT accordes apres application du masque : quand elles apparaissent, le masque rabote l entree, et c est le piege classique des ACL.'",
      '      if printf \'%s\' "${KJEMO_ACL}" | grep -q \'#effective:\'; then',
      "        kjemo_resultat 'ACL' 'Masque actif' 'ATTENTION' 'droits rabotes' \\",
      "          'Au moins une entree accorde moins que ce qu elle declare, a cause du masque. Relis les lignes « #effective: » : c est la cause la plus frequente d un acces refuse malgre une ACL qui semble correcte.'",
      '      fi',
      '      if printf \'%s\' "${KJEMO_ACL}" | grep -q \'^default:\'; then',
      "        kjemo_resultat 'ACL' 'ACL par defaut' 'INFO' 'presente' \\",
      "          'Ce dossier porte une ACL par defaut : elle sera HERITEE par tout ce qui sera cree dedans. Elle ne change rien aux fichiers deja presents.'",
      '      fi',
      '    else',
      "      kjemo_resultat 'ACL' \"${KJEMO_CIBLE}\" 'OK' 'aucune entree nominative' \\",
      "        'Les droits se lisent entierement dans le mode POSIX.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'ACL' 'getfacl' 'IGNORE' 'absent' \\",
      "      'Installe le paquet : apt install acl. Sans lui, un « + » en fin de mode reste inexplique.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - LE PARCOURS, SI DEMANDE',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ -d "${KJEMO_CIBLE}" ]; then',
      '  KJEMO_NB="$(find "${KJEMO_CIBLE}" -mindepth 1 2>/dev/null | wc -l | tr -d \' \' || true)"',
      "  kjemo_resultat 'Arborescence' 'Entrees' 'INFO' \"${KJEMO_NB:-0}\" \\",
      "    'Nombre d entrees sous ce chemin. Une operation recursive les toucherait toutes.'",
      '  KJEMO_PROPRIOS="$(find "${KJEMO_CIBLE}" -mindepth 1 -printf \'%u\\n\' 2>/dev/null | sort | uniq -c | sort -rn | head -10 || true)"',
      "  kjemo_resultat 'Arborescence' 'Proprietaires' 'INFO' \"${KJEMO_PROPRIOS}\" \\",
      "    'Les dix proprietaires les plus frequents. Plusieurs proprietaires sous un meme dossier est normal ; un chown recursif les ecraserait tous.'",
      '  KJEMO_MODES="$(find "${KJEMO_CIBLE}" -mindepth 1 -printf \'%m\\n\' 2>/dev/null | sort | uniq -c | sort -rn | head -10 || true)"',
      "  kjemo_resultat 'Arborescence' 'Modes' 'INFO' \"${KJEMO_MODES}\" \\",
      "    'Les dix modes les plus frequents. Un chmod recursif uniformiserait tout, y compris les scripts executables et les bits speciaux.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - LES POINTS SENSIBLES',
      '#',
      '# Trois recherches, trois raisons differentes. Aucune n est corrigee ici.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_RISQUES}" = \'Oui\' ] && [ -d "${KJEMO_CIBLE}" ]; then',
      '  # -perm -0002 : le bit d ecriture pour « autres » est pose. Le « - »',
      '  # devant le mode signifie « au moins ces bits », et non « exactement ».',
      '  KJEMO_W="$(find "${KJEMO_CIBLE}" -xdev -type f -perm -0002 2>/dev/null | head -20 || true)"',
      '  if [ -n "${KJEMO_W}" ]; then',
      "    kjemo_resultat 'Points sensibles' 'Inscriptibles par tous' 'ATTENTION' \"${KJEMO_W}\" \\",
      "      'Ces fichiers peuvent etre remplaces par n importe quel compte de la machine. Vingt premiers resultats seulement.'",
      '  else',
      "    kjemo_resultat 'Points sensibles' 'Inscriptibles par tous' 'OK' 'aucun' ''",
      '  fi',
      '  KJEMO_SUID="$(find "${KJEMO_CIBLE}" -xdev -type f -perm -4000 2>/dev/null | head -20 || true)"',
      '  if [ -n "${KJEMO_SUID}" ]; then',
      "    kjemo_resultat 'Points sensibles' 'Binaires setuid' 'ATTENTION' \"${KJEMO_SUID}\" \\",
      "      'Ces programmes s executent avec les droits de leur proprietaire. Un seul suffit a donner root s il est mal ecrit. Un chmod recursif les PERDRAIT silencieusement, ce qui casserait les commandes qui en dependent.'",
      '  else',
      "    kjemo_resultat 'Points sensibles' 'Binaires setuid' 'OK' 'aucun' ''",
      '  fi',
      '  KJEMO_SGID="$(find "${KJEMO_CIBLE}" -xdev -type f -perm -2000 2>/dev/null | head -20 || true)"',
      "  kjemo_resultat 'Points sensibles' 'Fichiers setgid' 'INFO' \"${KJEMO_SGID:-aucun}\" \\",
      "    'Sur un fichier, le setgid fait executer avec le groupe du fichier. Sur un dossier il est legitime, et n est pas compte ici.'",
      '  # Les entrees porteuses d une ACL : le « + » que ls affiche.',
      '  if kjemo_dispo getfacl; then',
      '    KJEMO_AVEC_ACL="$(find "${KJEMO_CIBLE}" -xdev -mindepth 1 2>/dev/null | head -2000 \\',
      '      | while IFS= read -r kjemo_f; do',
      '          if getfacl -p --skip-base -- "${kjemo_f}" 2>/dev/null | grep -q .; then printf \'%s\\n\' "${kjemo_f}"; fi',
      '        done | head -20 || true)"',
      "    kjemo_resultat 'Points sensibles' 'Entrees porteuses d ACL' 'INFO' \"${KJEMO_AVEC_ACL:-aucune}\" \\",
      "      'getfacl --skip-base ne rend rien quand les droits se resument au mode POSIX : ce qui apparait ici porte donc une vraie ACL. Deux mille entrees examinees au plus.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 8 - CE QUE CET AUDIT NE VOIT PAS',
      '#',
      '# Le dire est utile : un refus d acces malgre des permissions correctes',
      '# envoie chercher longtemps du cote des permissions.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo aa-status; then',
      "  kjemo_resultat 'Hors perimetre' 'AppArmor' 'INFO' 'present sur cette machine' \\",
      "    'AppArmor peut refuser un acces independamment des permissions et des ACL. Si tout semble correct et que l acces echoue quand meme : sudo aa-status, puis les journaux (journalctl -k | grep -i apparmor).'",
      'fi',
      "kjemo_resultat 'Hors perimetre' 'Montage' 'INFO' 'a verifier si besoin' \\",
      "  'Un systeme de fichiers monte en lecture seule, ou avec noexec, refuse des acces que les permissions autorisent. findmnt -o TARGET,OPTIONS le montre.'",

      ...blocRapportBash({ prefixeFichier: 'kjemo-permissions-audit' }),
    ]);
  },

  gui: [
    'Regarde la cible : « stat -c \'%A %a %U %G %n\' /srv/donnees ».',
    'Puis les parents, c’est le plus utile : « namei -l /srv/donnees/equipe/rapport.txt ». Un dossier sans x bloque tout ce qui est en dessous.',
    'Sur un dossier, x ne veut pas dire exécuter mais TRAVERSER : sans x, on n’entre pas, même avec r.',
    'Si le mode finit par un « + », il y a une ACL : « getfacl /srv/donnees ».',
    'Lis les lignes « #effective: » : elles donnent les droits RÉELS après application du masque.',
    'Les fichiers inscriptibles par tous : « find /srv/donnees -type f -perm -0002 ».',
    'Les binaires setuid : « find /srv/donnees -type f -perm -4000 ».',
    'Le umask de la session décide des droits des fichiers à venir : « umask ».',
  ],

  keywords: ['permission', 'permissions', 'droits', 'chmod', 'chown', 'acl', 'getfacl',
    'namei', 'stat', 'umask', 'setuid', 'setgid', 'sticky', 'masque', 'denied',
    'refuse', 'audit', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Le chemin à examiner.',
    'Le paquet acl pour voir les ACL : « sudo apt install acl ».',
    'sudo seulement si la session ne peut pas traverser les dossiers du chemin.',
  ],

  commonErrors: [
    {
      message: 'Permission denied alors que le fichier est en 644 et m’appartient',
      code: 'EACCES',
      cause: 'Un dossier PARENT n’accorde pas le droit de traversée (x). Le message nomme le fichier, jamais le dossier fautif.',
      fix: 'Lire la chaîne des parents : c’est l’étape 4 de cet assistant.',
      command: 'namei -l /srv/donnees/equipe/rapport.txt',
    },
    {
      message: 'Le mode se termine par un « + » et je ne comprends pas les droits',
      code: 'KJEMO',
      cause: 'Une ACL est posée. « ls -l » affiche alors le MASQUE à la place des droits du groupe : on lit un plafond en croyant lire une permission.',
      fix: 'Lire l’ACL réelle, et surtout les lignes « #effective: ».',
      command: 'getfacl /srv/donnees',
    },
    {
      message: 'getfacl : commande introuvable',
      code: 'ENOENT',
      cause: 'Le paquet acl n’est pas installé.',
      fix: 'sudo apt install acl',
      command: 'sudo apt install acl',
    },
    {
      message: 'Tout semble correct et l’accès échoue quand même',
      code: 'KJEMO',
      cause: 'AppArmor, une option de montage (ro, noexec, nosuid) ou un montage réseau peuvent refuser un accès indépendamment des permissions.',
      fix: 'Vérifier le montage, puis les journaux du noyau. Cet assistant le signale sans prétendre l’analyser.',
      command: 'findmnt -o TARGET,FSTYPE,OPTIONS',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport nomme le compte et les groupes sous lesquels la lecture a eu lieu : les droits n’ont de sens que relativement à eux.',
    'La chaîne des parents est présente, un segment par ligne.',
    'Si une ACL existe, les lignes « #effective: » apparaissent telles quelles dans le rapport.',
    'Aucun fichier n’a été modifié : le script n’appelle ni chmod, ni chown, ni setfacl.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant ne fait que lire. Le seul fichier éventuellement écrit est le rapport JSON ou CSV, dans le dossier personnel.',
    diagnostic: '# Le rapport, s il a ete demande :\nls -l "${HOME}"/kjemo-permissions-audit-*',
    command: '# Supprimer le rapport si tu n en as plus besoin :\n# rm "${HOME}"/kjemo-permissions-audit-AAAAMMJJ-HHMMSS.json\necho \'Aucune modification a annuler.\'',
    warning: null,
  },

  checks: [
    'Le gardien de chemin est en mode lecture seule : les racines système ne sont pas refusées, parce qu’on ne protège pas /etc en refusant de le LIRE, mais les segments sensibles (.ssh, .env, .git…) restent refusés.',
    'Le compte et les groupes de la session sont affichés avant tout jugement sur les droits.',
    'stat est appelé avec un format explicite, jamais « ls -l » dont la sortie dépend de la locale et du terminal.',
    'La chaîne des dossiers parents est lue par namei -l, et son absence est signalée au lieu d’être contournée.',
    'Les trois bits spéciaux sont nommés séparément, avec leur effet réel, et le setgid sur un dossier est présenté comme légitime.',
    'Les lignes « #effective: » d’une ACL sont signalées comme ATTENTION : c’est la cause la plus fréquente d’un accès refusé malgré une ACL correcte.',
    'Aucune correction n’est proposée ni appliquée : l’assistant signale, il ne décide pas.',
    'Les recherches récursives sont bornées (-xdev, head) pour ne pas traverser d’autres systèmes de fichiers ni produire une sortie illisible.',
  ],

  source: `${M}/man1/stat.1.html`,
  sources: [
    { label: 'stat(1)', url: `${M}/man1/stat.1.html` },
    { label: 'namei(1)', url: `${M}/man1/namei.1.html` },
    { label: 'ls(1)', url: `${M}/man1/ls.1.html` },
    { label: 'getfacl(1)', url: `${M}/man1/getfacl.1.html` },
    { label: 'acl(5) — listes de contrôle d’accès', url: `${M}/man5/acl.5.html` },
    { label: 'find(1)', url: `${M}/man1/find.1.html` },
    { label: 'id(1)', url: `${M}/man1/id.1.html` },
  ],
};

// ===========================================================================
// ASSISTANT 2 — CHANGER PROPRIÉTAIRE, GROUPE ET MODE
//
// LE PIÈGE DU « chmod -R 2770 », ET POURQUOI CET ASSISTANT NE LE FAIT PAS
//
// Le mode d'un dossier et celui d'un fichier ne se décrivent pas avec le même
// chiffre. 2770 sur un dossier est juste : setgid, rwx au propriétaire et au
// groupe, rien aux autres. Le même 2770 appliqué récursivement pose le setgid
// ET le bit d'exécution sur CHAQUE fichier — y compris les documents, qui
// deviennent exécutables, et les fichiers setgid, qui s'exécutent alors avec
// le groupe du fichier.
//
// L'assistant sépare donc les deux : en mode récursif, les dossiers reçoivent
// le mode demandé, et les fichiers le même mode privé de ses bits spéciaux et
// de ses bits d'exécution. C'est ce que fait un administrateur qui connaît le
// piège, et c'est précisément ce que `chmod -R` ne sait pas faire.
// ===========================================================================

/** Le mode des FICHIERS, dérivé du mode demandé pour les dossiers. */
function modeFichierDepuisDossier(mode) {
  const trois = String(mode).slice(-3);
  // Bit 1 = exécution : retiré. Les bits spéciaux, eux, ne sont pas repris du
  // tout, puisqu'on ne garde que les trois derniers chiffres.
  return trois.split('').map((d) => String(Number(d) & 6)).join('');
}

const linuxPermissionChange = {
  id: 'linux-permission-change',
  icon: '◆',
  category: CAT,
  subcategory: 'Utilisateurs et permissions',
  title: 'Changer le propriétaire, le groupe et le mode d’un chemin',
  risk: 'caution',
  summary: 'Applique un propriétaire, un groupe et un mode à un chemin, après avoir écrit et relu un fichier de restauration qui permet de tout remettre. Refuse 777, refuse toute opération récursive sur une racine système ou sur /home pris globalement, refuse de donner un fichier à root, et refuse une récursion sur une arborescence contenant des binaires setuid — un chmod les perdrait silencieusement.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'coreutils — chmod, chown, stat (présent par défaut)',
    'findutils — find (présent par défaut)',
    'acl — getfacl, pour sauvegarder les ACL existantes (apt install acl)',
  ],
  privileges: 'root — changer le propriétaire d’un fichier est réservé à root, et changer le mode d’un fichier qui ne vous appartient pas aussi',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'Ne pose pas d’ACL. Les permissions POSIX répondent à « quels droits pour le propriétaire, le groupe, les autres » ; pour accorder des droits à UNE personne en plus, c’est l’assistant d’ACL.',
    'Ne touche pas aux liens symboliques : un lien est refusé comme cible, parce que chmod agit sur la cible du lien et chown sur le lien ou sa cible selon l’option — deux comportements différents pour la même commande apparente.',
    'N’offre aucun moyen de poser le bit setuid sur un fichier. Le validateur le refuse : un binaire setuid root posé par un script de confort est une élévation de privilèges permanente.',
    'Ne restaure pas automatiquement. Le fichier de restauration est écrit, vérifié et son chemin est affiché ; le remettre en place est une commande à lancer à la main, en connaissance de cause.',
    'Ne traverse pas les points de montage : find est appelé avec -xdev.',
  ],

  fields: [
    {
      id: 'chemin',
      label: 'Chemin à modifier',
      type: 'text',
      default: '/srv/donnees/equipe',
      placeholder: '/srv/donnees/equipe',
      help: 'Un fichier ou un dossier, en chemin absolu. Audite-le d’abord : c’est souvent un parent qu’il faut corriger, pas la cible.',
    },
    {
      id: 'proprietaire',
      label: 'Nouveau propriétaire',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Laisse vide pour ne pas changer le propriétaire. « root » est refusé : donner un fichier à root n’est presque jamais ce qu’on voulait faire.',
    },
    {
      id: 'groupe',
      label: 'Nouveau groupe',
      type: 'text',
      default: 'partage',
      placeholder: 'partage',
      optionnel: true,
      help: 'Laisse vide pour ne pas changer le groupe. Le groupe doit déjà exister : cet assistant ne le crée pas.',
    },
    {
      id: 'mode',
      label: 'Mode (octal)',
      type: 'text',
      default: '2770',
      placeholder: '2770',
      optionnel: true,
      help: 'Laisse vide pour ne pas changer le mode. 2770 sur un dossier de groupe : setgid, tout au propriétaire et au groupe, rien aux autres. 777 est refusé.',
    },
    {
      id: 'recursif',
      label: 'Appliquer à toute l’arborescence',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Oui : les dossiers reçoivent le mode demandé, et les fichiers le même mode sans ses bits spéciaux ni ses bits d’exécution. Refusé sur une racine système et sur /home pris globalement.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation — retape le chemin exact',
      type: 'text',
      default: '',
      placeholder: '/srv/donnees/equipe',
      optionnel: true,
      help: 'Sans cette phrase exacte, le script généré diagnostique et n’écrit rien. C’est voulu : on doit pouvoir relire le script avant de confirmer.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const c = validateCheminAbsolu(v.chemin, 'Le chemin à modifier');
    if (!c.ok) errors.chemin = c.error;

    const proprio = String(v.proprietaire ?? '').trim();
    const groupe = String(v.groupe ?? '').trim();
    const mode = String(v.mode ?? '').trim();

    if (proprio === '' && groupe === '' && mode === '') {
      errors.mode = 'Rien à faire : indique au moins un propriétaire, un groupe ou un mode. Un script qui ne change rien n’a pas besoin d’exister, et laisser croire qu’il agit serait pire.';
    }
    if (proprio !== '') {
      const r = validateNomUtilisateur(proprio, 'Le nouveau propriétaire');
      if (!r.ok) errors.proprietaire = r.error;
    }
    if (groupe !== '') {
      const r = validateNomGroupe(groupe, 'Le nouveau groupe');
      if (!r.ok) errors.groupe = r.error;
    }
    if (mode !== '') {
      // surDossier: true laisse passer le setgid et le sticky, qui sont
      // legitimes sur un dossier. Le setuid reste refuse par le validateur
      // lui-meme, et le controle ci-dessous ajoute le cas 777.
      const r = validateModeOctal(mode, { surDossier: true, label: 'Le mode' });
      if (!r.ok) {
        errors.mode = r.error;
      } else if (/[0-7]?777$/.test(mode) || /[0-7]?666$/.test(mode)) {
        errors.mode = `Le mode « ${mode} » est refusé : il donne le droit d’écrire à n’importe quel compte de la machine, y compris à un service compromis. Ce n’est pas « large », c’est sans propriétaire. Le besoin réel est presque toujours un groupe dédié et le mode 2770 sur le dossier — l’appartenance au groupe remplace alors la permission « autres ».${/^1/.test(mode) ? ' Le sticky bit (1xxx) ne rattrape pas 777 : il empêche de SUPPRIMER le fichier d’autrui, pas de le créer ni d’en écrire un nouveau. C’est ce qui rend /tmp vivable, et ce n’est pas une protection pour un dossier de travail.' : ''}`;
      // Le test porte sur le QUATRIEME chiffre, donc seulement sur un mode a
      // quatre chiffres. Ecrit sans cette condition, il refusait « 750 » et
      // « 770 » — des modes a trois chiffres dont le premier chiffre decrit le
      // proprietaire, pas les bits speciaux. Defaut trouve par la generation
      // des huit jeux de donnees, qui en contenaient trois.
      } else if (mode.length === 4 && /^[467]/.test(mode)) {
        errors.mode = 'Le bit setuid (4xxx, 6xxx, 7xxx) est refusé : le programme s’exécuterait avec les droits de son propriétaire, ce qui est une élévation de privilèges permanente. Le setgid seul (2xxx) et le sticky seul (1xxx) sont acceptés sur un dossier.';
      }
    }
    const r = validateChoix(v.recursif, ['Oui', 'Non'], 'La récursion');
    if (!r.ok) errors.recursif = r.error;
    validerCibleRecursive(v.chemin, v.recursif, errors, 'chemin');
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const chemin = String(v.chemin).trim().replace(/(.)\/+$/, '$1');
    const proprio = String(v.proprietaire ?? '').trim();
    const groupe = String(v.groupe ?? '').trim();
    const mode = String(v.mode ?? '').trim();
    const recursif = String(v.recursif) === 'Oui';
    const modeFichier = mode === '' ? '' : modeFichierDepuisDossier(mode);

    return assemblerSh([
      ...enteteBash({
        titre: 'Changer proprietaire, groupe et mode d un chemin',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'changer le proprietaire d un fichier est reserve a root, et changer le mode d un fichier qui ne vous appartient pas aussi',
      }),
      ...blocGardienChemin({ lectureSeule: false }),
      ...blocVariablesBash([
        ['KJEMO_CIBLE', shQuote(chemin)],
        ['KJEMO_PROPRIO', shQuote(proprio)],
        ['KJEMO_GROUPE', shQuote(groupe)],
        ['KJEMO_MODE', shQuote(mode)],
        ['KJEMO_MODE_FICHIER', shQuote(modeFichier)],
        ['KJEMO_RECURSIF', shQuote(recursif ? 'Oui' : 'Non')],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? ''))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Chemin' \"${KJEMO_CIBLE}\"",
      "  printf '%s\\t%s\\n' 'Nouveau proprietaire' \"${KJEMO_PROPRIO:-inchange}\"",
      "  printf '%s\\t%s\\n' 'Nouveau groupe' \"${KJEMO_GROUPE:-inchange}\"",
      "  printf '%s\\t%s\\n' 'Mode des dossiers' \"${KJEMO_MODE:-inchange}\"",
      "  printf '%s\\t%s\\n' 'Mode des fichiers (recursif)' \"${KJEMO_MODE_FICHIER:-inchange}\"",
      "  printf '%s\\t%s\\n' 'Recursif' \"${KJEMO_RECURSIF}\"",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LA CIBLE',
      '#',
      '# Un lien symbolique est REFUSE comme cible, et ce n est pas une',
      '# pudeur : chmod agit sur la cible du lien, chown sur le lien ou sur sa',
      '# cible selon qu on passe -h ou non. Deux commandes qui se ressemblent,',
      '# deux comportements, et aucune facon de deviner lequel etait voulu.',
      '# ---------------------------------------------------------------------------',
      'kjemo_exiger_chemin_sur "${KJEMO_CIBLE}"',
      'KJEMO_CIBLE="${KJEMO_CHEMIN_CANON}"',
      'KJEMO_CIBLE_OK=0',
      'KJEMO_EST_DOSSIER=0',
      'if [ -L "${KJEMO_CIBLE}" ]; then',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'PROBLEME' 'lien symbolique' \\",
      "    'Cet assistant refuse un lien symbolique : chmod agirait sur la cible du lien, chown sur le lien ou sur sa cible selon l option. Vise directement le fichier ou le dossier reel.'",
      'elif [ -d "${KJEMO_CIBLE}" ]; then',
      '  KJEMO_CIBLE_OK=1',
      '  KJEMO_EST_DOSSIER=1',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'OK' 'dossier' ''",
      'elif [ -f "${KJEMO_CIBLE}" ]; then',
      '  KJEMO_CIBLE_OK=1',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'OK' 'fichier' ''",
      '  if [ "${KJEMO_RECURSIF}" = \'Oui\' ]; then',
      "    kjemo_resultat 'Cible' 'Recursion' 'INFO' 'sans effet' \\",
      "      'La cible est un fichier : la recursion ne change rien.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'PROBLEME' 'inexistant ou type non gere' \\",
      "    'Seuls un fichier ordinaire et un dossier sont acceptes.'",
      'fi',
      '',
      '# L etat AVANT, releve pour pouvoir le comparer apres.',
      'KJEMO_AVANT=\'\'',
      'if [ "${KJEMO_CIBLE_OK}" -eq 1 ]; then',
      '  KJEMO_AVANT="$(stat -c \'%a %U %G\' -- "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Cible' 'Etat avant' 'INFO' \"${KJEMO_AVANT}\" \\",
      "    'Mode octal, proprietaire, groupe, dans cet ordre.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LA RECURSION, REVERIFIEE ICI',
      '#',
      '# Le formulaire refuse deja une recursion sur une racine systeme. Le',
      '# script le reverifie, parce qu un script se relit, se retouche et se',
      '# relance : un chmod -R sur /usr rend sudo inutilisable, donc on ne peut',
      '# meme plus reparer.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_RECURSIF_OK=1',
      `KJEMO_RACINES_INTERDITES=(${RECURSIF_REFUSE.map((r) => shQuote(r)).join(' ')})`,
      'if [ "${KJEMO_RECURSIF}" = \'Oui\' ]; then',
      '  for kjemo_r in "${KJEMO_RACINES_INTERDITES[@]}"; do',
      '    if [ "${KJEMO_CIBLE}" = "${kjemo_r}" ]; then',
      '      KJEMO_RECURSIF_OK=0',
      "      kjemo_resultat 'Recursion' \"${KJEMO_CIBLE}\" 'PROBLEME' 'racine interdite' \\",
      '        "Operation recursive refusee sur la racine interdite ${KJEMO_CIBLE} : elle rendrait la machine inutilisable, sudo compris, donc impossible a reparer. Vise un sous-dossier precis."',
      '    fi',
      '  done',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LES BINAIRES SETUID DANS L ARBORESCENCE',
      '#',
      '# Un chmod recursif ECRASE les bits speciaux : les binaires setuid et',
      '# setgid les perdent, et les commandes qui en dependent cessent de',
      '# fonctionner — sans message, et parfois des jours plus tard. On refuse',
      '# plutot que de prevenir : prevenir, ici, c est laisser faire.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SPECIAUX_OK=1',
      'if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ] \\',
      '  && [ -n "${KJEMO_MODE}" ]; then',
      '  KJEMO_TROUVES="$(find "${KJEMO_CIBLE}" -xdev -type f \\( -perm -4000 -o -perm -2000 \\) 2>/dev/null | head -20 || true)"',
      '  if [ -n "${KJEMO_TROUVES}" ]; then',
      '    KJEMO_SPECIAUX_OK=0',
      "    kjemo_resultat 'Arborescence' 'Binaires setuid ou setgid' 'PROBLEME' \"${KJEMO_TROUVES}\" \\",
      "      'Un chmod recursif leur retirerait leur bit special, silencieusement. Traite ces fichiers separement, ou renonce a la recursion sur ce chemin.'",
      '  else',
      "    kjemo_resultat 'Arborescence' 'Binaires setuid ou setgid' 'OK' 'aucun' ''",
      '  fi',
      '  KJEMO_NB="$(find "${KJEMO_CIBLE}" -xdev -mindepth 1 2>/dev/null | wc -l | tr -d \' \' || true)"',
      "  kjemo_resultat 'Arborescence' 'Entrees concernees' 'ATTENTION' \"${KJEMO_NB:-0}\" \\",
      "    'Toutes ces entrees seront touchees. Les dossiers recevront le mode demande, les fichiers le mode derive sans bits speciaux ni bits d execution.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LE PROPRIETAIRE ET LE GROUPE EXISTENT-ILS ?',
      '#',
      '# chown accepte un UID numerique inconnu du systeme : le fichier',
      '# appartient alors a un compte qui n existe pas, ce qui se voit mal et se',
      '# repare tard. On exige un nom, et on verifie qu il est connu.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PROPRIO_OK=1',
      'if [ -n "${KJEMO_PROPRIO}" ]; then',
      '  KJEMO_PROPRIO_OK=0',
      '  KJEMO_LIGNE_P="$(getent passwd "${KJEMO_PROPRIO}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_LIGNE_P}" ]; then',
      "    kjemo_resultat 'Proprietaire' \"${KJEMO_PROPRIO}\" 'PROBLEME' 'inconnu' \\",
      "      'Ce compte n existe pas sur cette machine. Cet assistant ne le cree pas : un fichier appartenant a un UID inconnu se repere mal et se repare tard.'",
      '  else',
      '    KJEMO_UID_P="$(printf \'%s\' "${KJEMO_LIGNE_P}" | cut -d: -f3)"',
      '    if [ "${KJEMO_UID_P}" = \'0\' ]; then',
      "      kjemo_resultat 'Proprietaire' \"${KJEMO_PROPRIO}\" 'PROBLEME' 'UID 0' \\",
      "      'Ce compte a l UID 0, donc les pleins pouvoirs. Donner un fichier a root n est presque jamais ce qu on voulait faire, et c est souvent le signe d une commande lancee sur le mauvais chemin.'",
      '    else',
      '      KJEMO_PROPRIO_OK=1',
      "      kjemo_resultat 'Proprietaire' \"${KJEMO_PROPRIO}\" 'OK' \"UID ${KJEMO_UID_P}\" ''",
      '    fi',
      '  fi',
      'fi',
      'KJEMO_GROUPE_OK=1',
      'if [ -n "${KJEMO_GROUPE}" ]; then',
      '  KJEMO_GROUPE_OK=0',
      '  KJEMO_LIGNE_G="$(getent group "${KJEMO_GROUPE}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_LIGNE_G}" ]; then',
      "    kjemo_resultat 'Groupe' \"${KJEMO_GROUPE}\" 'PROBLEME' 'inconnu' \\",
      "      'Ce groupe n existe pas. Cree-le d abord : sudo groupadd partage, puis ajoute-y les comptes concernes.'",
      '  else',
      '    KJEMO_GROUPE_OK=1',
      '    KJEMO_GID="$(printf \'%s\' "${KJEMO_LIGNE_G}" | cut -d: -f3)"',
      '    KJEMO_MEMBRES="$(printf \'%s\' "${KJEMO_LIGNE_G}" | cut -d: -f4)"',
      "    kjemo_resultat 'Groupe' \"${KJEMO_GROUPE}\" 'OK' \"GID ${KJEMO_GID}, membres : ${KJEMO_MEMBRES:-aucun membre secondaire}\" \\",
      "      'Les membres listes ici sont les membres SECONDAIRES. Un compte dont c est le groupe PRINCIPAL n y apparait pas, et a pourtant les droits du groupe.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LE FICHIER DE RESTAURATION, ECRIT PUIS RELU',
      '#',
      '# C est ce qui rend l operation reversible, et c est donc la premiere',
      '# chose a faire. Il contient, pour chaque entree touchee : le mode, le',
      '# proprietaire, le groupe et le chemin. Les ACL eventuelles sont',
      '# sauvegardees a cote, au format que setfacl --restore sait relire.',
      '#',
      '# Si cette etape echoue, rien n est modifie. Une operation irreversible',
      '# par accident est pire que la meme operation refusee.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SAUVE_OK=0',
      'KJEMO_HORO="$(date +%Y%m%d-%H%M%S 2>/dev/null || printf \'%s\' inconnu)"',
      'KJEMO_SAUVE="${HOME}/kjemo-permissions-${KJEMO_HORO}.restore"',
      'KJEMO_SAUVE_ACL="${HOME}/kjemo-permissions-${KJEMO_HORO}.acl"',
      'if [ "${KJEMO_CIBLE_OK}" -eq 1 ]; then',
      '  kjemo_code=0',
      '  if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      '    find "${KJEMO_CIBLE}" -xdev -printf \'%m\\t%u\\t%g\\t%p\\n\' > "${KJEMO_SAUVE}" 2>/dev/null || kjemo_code=$?',
      '  else',
      '    stat -c \'%a\\t%U\\t%G\\t%n\' -- "${KJEMO_CIBLE}" > "${KJEMO_SAUVE}" 2>/dev/null || kjemo_code=$?',
      '  fi',
      '  if [ "${kjemo_code}" -ne 0 ]; then',
      "    kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE}\" 'PROBLEME' \"code ${kjemo_code}\" \\",
      "      'Le releve des permissions actuelles a echoue. AUCUNE modification n a eu lieu.'",
      "    printf '%s\\n' 'ARRET : impossible de relever les permissions actuelles.' >&2",
      "    printf '%s\\n' 'Aucune permission n a ete modifiee.' >&2",
      '    exit 1',
      '  fi',
      '  # La RELECTURE : un fichier cree n est pas un fichier ecrit. Un disque',
      '  # plein rend un fichier vide sans que la redirection echoue.',
      '  if [ ! -s "${KJEMO_SAUVE}" ]; then',
      "    kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE}\" 'PROBLEME' 'vide' \\",
      "      'Le fichier de restauration est vide : il ne restaurerait rien. AUCUNE modification n a eu lieu.'",
      "    printf '%s\\n' 'ARRET : le fichier de restauration est vide.' >&2",
      "    printf '%s\\n' 'Aucune permission n a ete modifiee.' >&2",
      '    exit 1',
      '  fi',
      '  KJEMO_NB_SAUVE="$(wc -l < "${KJEMO_SAUVE}" | tr -d \' \' || true)"',
      '  if ! grep -qF -- "${KJEMO_CIBLE}" "${KJEMO_SAUVE}"; then',
      "    kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE}\" 'PROBLEME' 'la cible n y figure pas' \\",
      "      'Le fichier existe mais ne mentionne pas la cible : il ne la restaurerait pas. AUCUNE modification n a eu lieu.'",
      "    printf '%s\\n' 'ARRET : la relecture du fichier de restauration ne retrouve pas la cible.' >&2",
      "    printf '%s\\n' 'Aucune permission n a ete modifiee.' >&2",
      '    exit 1',
      '  fi',
      '  KJEMO_SAUVE_OK=1',
      "  kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE}\" 'OK' \"${KJEMO_NB_SAUVE} ligne(s), relu\" \\",
      "    'Mode, proprietaire, groupe et chemin de chaque entree touchee. C est ce fichier qui permet de revenir en arriere.'",
      '  if kjemo_dispo getfacl; then',
      '    if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      '      getfacl -R -p -- "${KJEMO_CIBLE}" > "${KJEMO_SAUVE_ACL}" 2>/dev/null || true',
      '    else',
      '      getfacl -p -- "${KJEMO_CIBLE}" > "${KJEMO_SAUVE_ACL}" 2>/dev/null || true',
      '    fi',
      '    if [ -s "${KJEMO_SAUVE_ACL}" ]; then',
      "      kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE_ACL}\" 'OK' 'ACL relevees' \\",
      "        'Au format attendu par setfacl --restore. Un chmod modifie le MASQUE d une ACL : sans ce releve, les droits effectifs changeraient sans trace.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'Sauvegarde' 'ACL' 'ATTENTION' 'getfacl absent' \\",
      "      'Les ACL eventuelles ne sont pas relevees. Installe le paquet acl avant d agir sur une arborescence qui en porte : apt install acl.'",
      '  fi',
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: chemin,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `changer les permissions de ${chemin}${recursif ? ' et de toute son arborescence' : ''}`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_CIBLE_OK', 'La cible n est pas un fichier ou un dossier exploitable.'],
          ['KJEMO_RECURSIF_OK', 'Une operation recursive sur cette racine est refusee.'],
          ['KJEMO_SPECIAUX_OK', 'L arborescence contient des binaires setuid ou setgid : un chmod recursif les perdrait.'],
          ['KJEMO_PROPRIO_OK', 'Le proprietaire demande est inconnu, ou a l UID 0.'],
          ['KJEMO_GROUPE_OK', 'Le groupe demande est inconnu.'],
          ['KJEMO_SAUVE_OK', 'Le fichier de restauration n a pas pu etre ecrit et relu.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le chemin.'],
        ],
        action: 'le changement de permissions',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - chown AVANT chmod',
      '#',
      '# L ordre compte : sur Linux, changer le proprietaire d un fichier RETIRE',
      '# ses bits setuid et setgid. Si on posait le mode d abord, chown le',
      '# deferait juste apres, et le script annoncerait un mode qui n est plus',
      '# celui du fichier.',
      '# ---------------------------------------------------------------------------',
      '  if [ -n "${KJEMO_PROPRIO}" ] || [ -n "${KJEMO_GROUPE}" ]; then',
      '    kjemo_cible_chown="${KJEMO_PROPRIO}"',
      '    if [ -n "${KJEMO_GROUPE}" ]; then',
      '      kjemo_cible_chown="${KJEMO_PROPRIO}:${KJEMO_GROUPE}"',
      '    fi',
      '    kjemo_cmd_chown=(chown --no-dereference -- "${kjemo_cible_chown}" "${KJEMO_CIBLE}")',
      '    if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      '      kjemo_cmd_chown=(chown --no-dereference --recursive -- "${kjemo_cible_chown}" "${KJEMO_CIBLE}")',
      '    fi',
      '    kjemo_code=0',
      '    "${kjemo_cmd_chown[@]}" > "${KJEMO_TMP}/chown.out" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -ne 0 ]; then',
      "      kjemo_resultat 'Application' 'chown' 'PROBLEME' \"code ${kjemo_code}\" \\",
      "        \"chown a echoue. Le mode n a PAS ete change. Restauration : ${KJEMO_SAUVE}\"",
      "      printf '%s\\n' 'ARRET : chown a echoue. Le mode n a pas ete touche.' >&2",
      '      printf \'%s\\n\' "Fichier de restauration : ${KJEMO_SAUVE}" >&2',
      '      cat "${KJEMO_TMP}/chown.out" >&2',
      '      exit 1',
      '    fi',
      "    kjemo_resultat 'Application' 'chown' 'OK' \"${kjemo_cible_chown}\" \\",
      "      'L option --no-dereference evite de suivre un lien symbolique rencontre en chemin.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - chmod, ET DEUX MODES PLUTOT QU UN',
      '#',
      '# En recursif, « chmod -R 2770 » poserait le setgid et le bit',
      '# d execution sur CHAQUE fichier : les documents deviendraient',
      '# executables. Les dossiers et les fichiers sont donc traites',
      '# separement, par find, avec deux modes distincts.',
      '# ---------------------------------------------------------------------------',
      '  if [ -n "${KJEMO_MODE}" ]; then',
      '    kjemo_code=0',
      '    if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      '      find "${KJEMO_CIBLE}" -xdev -type d -exec chmod -- "${KJEMO_MODE}" {} + \\',
      '        > "${KJEMO_TMP}/chmod-d.out" 2>&1 || kjemo_code=$?',
      '      if [ "${kjemo_code}" -eq 0 ]; then',
      '        find "${KJEMO_CIBLE}" -xdev -type f -exec chmod -- "${KJEMO_MODE_FICHIER}" {} + \\',
      '          > "${KJEMO_TMP}/chmod-f.out" 2>&1 || kjemo_code=$?',
      '      fi',
      '    else',
      '      chmod -- "${KJEMO_MODE}" "${KJEMO_CIBLE}" > "${KJEMO_TMP}/chmod.out" 2>&1 || kjemo_code=$?',
      '    fi',
      '    if [ "${kjemo_code}" -ne 0 ]; then',
      "      kjemo_resultat 'Application' 'chmod' 'PROBLEME' \"code ${kjemo_code}\" \\",
      "        \"chmod a echoue, peut-etre partiellement. Restauration : ${KJEMO_SAUVE}\"",
      "      printf '%s\\n' 'ARRET : chmod a echoue. L arborescence peut etre dans un etat mixte.' >&2",
      '      printf \'%s\\n\' "Fichier de restauration : ${KJEMO_SAUVE}" >&2',
      '      exit 1',
      '    fi',
      '    if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      "      kjemo_resultat 'Application' 'chmod' 'OK' \"dossiers ${KJEMO_MODE}, fichiers ${KJEMO_MODE_FICHIER}\" \\",
      "        'Deux modes distincts, et non un chmod -R unique : sur un fichier, le bit d execution et les bits speciaux n ont pas le meme sens que sur un dossier.'",
      '    else',
      "      kjemo_resultat 'Application' 'chmod' 'OK' \"${KJEMO_MODE}\" ''",
      '    fi',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 8 - LA RELECTURE DECIDE',
      '#',
      '# « chmod a rendu 0 » ne dit pas que le mode est celui demande : un',
      '# systeme de fichiers monte en lecture seule, ou sans support des bits',
      '# speciaux, peut accepter la commande et ne rien changer.',
      '# ---------------------------------------------------------------------------',
      '  KJEMO_APRES="$(stat -c \'%a %U %G\' -- "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Relecture' \"${KJEMO_CIBLE}\" 'INFO' \"${KJEMO_APRES}\" \\",
      '    "Avant : ${KJEMO_AVANT}"',
      '  KJEMO_RELU_MODE="$(printf \'%s\' "${KJEMO_APRES}" | awk \'{print $1}\' || true)"',
      '  KJEMO_RELU_U="$(printf \'%s\' "${KJEMO_APRES}" | awk \'{print $2}\' || true)"',
      '  KJEMO_RELU_G="$(printf \'%s\' "${KJEMO_APRES}" | awk \'{print $3}\' || true)"',
      '  KJEMO_ECARTS=0',
      '  if [ -n "${KJEMO_MODE}" ] && [ "${KJEMO_RELU_MODE}" != "${KJEMO_MODE#0}" ] \\',
      '    && [ "${KJEMO_RELU_MODE}" != "${KJEMO_MODE}" ]; then',
      '    KJEMO_ECARTS=$((KJEMO_ECARTS + 1))',
      "    kjemo_resultat 'Relecture' 'Mode' 'PROBLEME' \"demande ${KJEMO_MODE}, relu ${KJEMO_RELU_MODE}\" \\",
      "      'Le mode relu ne correspond pas a celui demande. Ne conclus pas que l operation a reussi : verifie les options de montage et le systeme de fichiers.'",
      '  fi',
      '  if [ -n "${KJEMO_PROPRIO}" ] && [ "${KJEMO_RELU_U}" != "${KJEMO_PROPRIO}" ]; then',
      '    KJEMO_ECARTS=$((KJEMO_ECARTS + 1))',
      "    kjemo_resultat 'Relecture' 'Proprietaire' 'PROBLEME' \"demande ${KJEMO_PROPRIO}, relu ${KJEMO_RELU_U}\" ''",
      '  fi',
      '  if [ -n "${KJEMO_GROUPE}" ] && [ "${KJEMO_RELU_G}" != "${KJEMO_GROUPE}" ]; then',
      '    KJEMO_ECARTS=$((KJEMO_ECARTS + 1))',
      "    kjemo_resultat 'Relecture' 'Groupe' 'PROBLEME' \"demande ${KJEMO_GROUPE}, relu ${KJEMO_RELU_G}\" ''",
      '  fi',
      '  if [ "${KJEMO_ECARTS}" -eq 0 ]; then',
      "    kjemo_resultat 'Relecture' 'Conformite' 'OK' 'conforme a la demande' \\",
      "      'Releve par stat apres l operation, et non deduit du code de retour.'",
      '  else',
      '    printf \'%s\\n\' "ATTENTION : la relecture montre ${KJEMO_ECARTS} ecart(s). Restauration : ${KJEMO_SAUVE}" >&2',
      '  fi',
      '',
      '# Et l ACL, si le chmod en a deplace le masque : le dire, parce que les',
      '# droits effectifs ont pu changer sans que le mode POSIX le montre.',
      '  if kjemo_dispo getfacl && [ -s "${KJEMO_SAUVE_ACL}" ]; then',
      '    if getfacl -p -- "${KJEMO_CIBLE}" 2>/dev/null | grep -q \'#effective:\'; then',
      "      kjemo_resultat 'Relecture' 'ACL et masque' 'ATTENTION' 'droits effectifs rabotes' \\",
      "        \"Le chmod a modifie le masque de l ACL : au moins une entree accorde maintenant MOINS que ce qu elle declare. Releve d origine : ${KJEMO_SAUVE_ACL}. Pour relever le masque : setfacl -m m::rwx sur la cible.\"",
      '    fi',
      '  fi',
      "  kjemo_resultat 'Annulation' 'Fichier de restauration' 'INFO' \"${KJEMO_SAUVE}\" \\",
      "    'Garde ce fichier : c est lui qui permet de revenir a l etat precedent. La commande de restauration est dans la fiche de l assistant.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-permissions-change' }),
    ]);
  },

  gui: [
    'Audite d’abord : « namei -l /srv/donnees/equipe » et « getfacl /srv/donnees/equipe ».',
    'Relève l’état actuel pour pouvoir y revenir : « find /srv/donnees/equipe -printf \'%m\\t%u\\t%g\\t%p\\n\' > ~/avant.restore ».',
    'Crée le groupe s’il n’existe pas : « sudo groupadd partage », puis « sudo usermod -aG partage blaise ».',
    'Change le propriétaire et le groupe : « sudo chown blaise:partage /srv/donnees/equipe ».',
    'Puis le mode, dans cet ordre : chown retire les bits setuid et setgid, donc chmod vient après.',
    'Sur un dossier de groupe : « sudo chmod 2770 /srv/donnees/equipe ». Le 2 est le setgid : les fichiers créés dedans hériteront du groupe.',
    'En récursif, ne fais PAS « chmod -R 2770 » : les fichiers deviendraient exécutables et setgid. Traite-les séparément — « find … -type d -exec chmod 2770 {} + » puis « find … -type f -exec chmod 660 {} + ».',
    'Vérifie par relecture : « stat -c \'%a %U %G\' /srv/donnees/equipe ».',
    'Si le mode finit par « + », relis l’ACL : un chmod déplace le masque, et les droits effectifs changent.',
  ],

  keywords: ['chmod', 'chown', 'chgrp', 'permission', 'permissions', 'droits', 'mode',
    'octal', 'setgid', 'setuid', 'sticky', '2770', 'groupe', 'proprietaire',
    'recursif', 'restauration', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Le chemin exact, audité au préalable.',
    'Le compte et le groupe visés, qui doivent DÉJÀ exister.',
    'sudo, ou une session root.',
    'Le paquet acl si l’arborescence porte des ACL : « sudo apt install acl ».',
    'De la place dans le dossier personnel pour le fichier de restauration.',
  ],

  commonErrors: [
    {
      message: 'chown: utilisateur non valide: « blaise:partage »',
      code: 'KJEMO',
      cause: 'Le compte ou le groupe n’existe pas, ou le nom est mal orthographié. chown lit tout l’argument comme un nom d’utilisateur quand il ne trouve pas le « : » attendu.',
      fix: 'Vérifier les deux séparément. L’assistant le fait avant d’agir, et refuse plutôt que d’essayer.',
      command: 'getent passwd blaise; getent group partage',
    },
    {
      message: 'Après un chmod -R, tous mes documents sont exécutables',
      code: 'KJEMO',
      cause: 'Un mode de dossier appliqué récursivement : le bit x des dossiers, qui sert à les traverser, devient le bit d’exécution des fichiers.',
      fix: 'Traiter dossiers et fichiers séparément. C’est ce que fait l’assistant en mode récursif, avec deux modes distincts.',
      command: 'find /srv/donnees -type f -exec chmod 660 {} +',
    },
    {
      message: 'sudo: /usr/bin/sudo doit appartenir à l’UID 0 et avoir le bit setuid',
      code: 'KJEMO',
      cause: 'Un chmod ou un chown récursif a touché /usr. sudo ne fonctionne plus, et on ne peut donc plus réparer avec sudo.',
      fix: 'C’est exactement ce que l’assistant refuse. La réparation demande un démarrage en mode de secours ou un accès root direct.',
      command: 'ls -l /usr/bin/sudo',
    },
    {
      message: 'Le dossier est en 2770 mais les nouveaux fichiers n’ont pas le bon groupe',
      code: 'KJEMO',
      cause: 'Le setgid n’agit que sur ce qui est créé APRÈS. Les fichiers déjà présents gardent leur groupe.',
      fix: 'Changer le groupe de l’existant une fois, en récursif, puis laisser le setgid faire le reste.',
      command: 'stat -c \'%a %U %G %n\' /srv/donnees/equipe',
    },
    {
      message: 'J’ai changé le mode et l’accès est toujours refusé',
      code: 'EACCES',
      cause: 'Un dossier parent n’accorde pas la traversée, ou une ACL dont le masque rabote les droits.',
      fix: 'Auditer le chemin complet, parents compris.',
      command: 'namei -l /srv/donnees/equipe/rapport.txt',
    },
  ],

  reversible: true,
  verifyAfter: [
    '« stat -c \'%a %U %G\' <chemin> » rend exactement le mode, le propriétaire et le groupe demandés.',
    'Le rapport contient une ligne « Relecture / Conformité » en OK : elle vient de stat, pas du code de retour de chmod.',
    'Le fichier de restauration existe dans le dossier personnel, porte un horodatage, et contient une ligne par entrée touchée.',
    'En mode récursif : « find <chemin> -type f -perm -111 » ne doit plus rendre de documents exécutables par accident.',
    'Si une ACL existait : « getfacl <chemin> » et comparaison avec le relevé .acl — un chmod déplace le masque.',
  ],

  rollback: {
    summary: 'Réversible, à condition d’utiliser le fichier de restauration écrit avant l’opération. Il contient le mode, le propriétaire et le groupe de chaque entrée touchée ; les ACL sont dans le fichier .acl voisin, au format de setfacl --restore.',
    diagnostic: `# Les fichiers de restauration disponibles :
ls -lt "\${HOME}"/kjemo-permissions-*.restore
# Ce qu ils contiennent :
head -5 "\${HOME}"/kjemo-permissions-AAAAMMJJ-HHMMSS.restore
# L etat actuel, pour comparer :
stat -c '%a %U %G %n' /srv/donnees/equipe`,
    command: `# 1. Remettre modes, proprietaires et groupes depuis le releve.
#    Le separateur est une tabulation, et IFS est fixe a la tabulation
#    SEULEMENT : un nom de fichier contenant une espace resterait entier.
while IFS="$(printf '\\t')" read -r mode u g chemin; do
  sudo chmod -- "\${mode}" "\${chemin}"
  sudo chown --no-dereference -- "\${u}:\${g}" "\${chemin}"
done < "\${HOME}/kjemo-permissions-AAAAMMJJ-HHMMSS.restore"

# 2. Remettre les ACL, si le fichier .acl existe :
sudo setfacl --restore="\${HOME}/kjemo-permissions-AAAAMMJJ-HHMMSS.acl"

# 3. Verifier :
stat -c '%a %U %G %n' /srv/donnees/equipe
getfacl /srv/donnees/equipe`,
    warning: 'La restauration ne recrée pas ce qui a été rendu inaccessible entre-temps : si un service a cessé d’écrire parce qu’il avait perdu ses droits, les données manquantes manquent. Et si l’opération a touché une arborescence système malgré les refus, la restauration suppose que le shell et sudo fonctionnent encore.',
  },

  checks: [
    'Le mode 777 et le mode 666 sont refusés par le formulaire, avec l’alternative : un groupe dédié et 2770.',
    'Le bit setuid est refusé sur un fichier comme sur un dossier ; le setgid et le sticky sont acceptés.',
    'Une opération récursive sur /, /etc, /usr, /var, /boot, /bin, /sbin, /lib, /root, /home, /srv, /tmp est refusée par le formulaire ET revérifiée dans le script.',
    'Un lien symbolique est refusé comme cible : chmod et chown n’y ont pas le même comportement.',
    'Un propriétaire inconnu est refusé, et un propriétaire d’UID 0 aussi.',
    'Un groupe inconnu est refusé : l’assistant ne crée pas de groupe.',
    'La présence de binaires setuid ou setgid dans l’arborescence fait REFUSER la récursion : un chmod les perdrait silencieusement.',
    'Le fichier de restauration est écrit, puis RELU : non vide, et contenant la cible. Zéro modification si l’une des deux vérifications échoue.',
    'Les ACL existantes sont relevées au format setfacl --restore avant toute modification.',
    'chown est appelé AVANT chmod, parce que chown retire les bits setuid et setgid.',
    'En récursif, les dossiers et les fichiers reçoivent deux modes distincts, par find : aucun chmod -R n’est émis.',
    'L’état final est relu par stat et comparé à la demande ; un écart est signalé comme PROBLEME, pas masqué.',
    'Un déplacement du masque d’ACL provoqué par le chmod est signalé, avec la commande pour le relever.',
  ],

  source: `${M}/man1/chmod.1.html`,
  sources: [
    { label: 'chmod(1)', url: `${M}/man1/chmod.1.html` },
    { label: 'chown(1)', url: `${M}/man1/chown.1.html` },
    { label: 'chgrp(1)', url: `${M}/man1/chgrp.1.html` },
    { label: 'stat(1)', url: `${M}/man1/stat.1.html` },
    { label: 'find(1)', url: `${M}/man1/find.1.html` },
    { label: 'setfacl(1) — option --restore', url: `${M}/man1/setfacl.1.html` },
    { label: 'getent(1)', url: `${M}/man1/getent.1.html` },
  ],
};

// ===========================================================================
// ASSISTANT 3 — UNE ACL, ET LE MASQUE QUE PERSONNE N'EXPLIQUE
//
// Ce que le cours dit : « setfacl -m u:blaise:rwx /srv/donnees ».
// Ce qu'il ne dit pas, et qui fait échouer la moitié des essais : ajouter une
// entrée nominative recalcule le MASQUE de l'ACL, et le masque est un
// PLAFOND. Une entrée « rwx » derrière un masque « r-x » accorde « r-x ».
// getfacl l'indique par une ligne « #effective: », qu'on ne lit jamais parce
// qu'on ne sait pas qu'elle existe.
//
// L'assistant la lit pour vous, et le dit.
// ===========================================================================

const DROITS_ACL = [
  ['rwx', 'rwx — lire, écrire, et traverser si c’est un dossier'],
  ['rw-', 'rw- — lire et écrire, sans traverser'],
  ['r-x', 'r-x — lire et traverser, sans écrire'],
  ['r--', 'r-- — lire seulement'],
];

const linuxPermissionAcl = {
  id: 'linux-permission-acl',
  icon: '◆',
  category: CAT,
  subcategory: 'Utilisateurs et permissions',
  title: 'Accorder des droits à un compte ou un groupe par ACL',
  risk: 'caution',
  summary: 'Ajoute une entrée d’ACL nominative sur un chemin, avec relevé getfacl vérifié avant modification et relecture après — y compris les lignes « #effective: », qui révèlent le masque rabotant les droits réellement accordés. Pose au besoin une ACL par défaut, sur un dossier seulement. N’efface aucune entrée existante.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'acl — setfacl, getfacl (apt install acl)',
    'coreutils — stat (présent par défaut)',
    'util-linux — findmnt (présent par défaut)',
  ],
  privileges: 'root — poser une ACL sur un fichier qui ne vous appartient pas est réservé à root ; le propriétaire peut le faire sur ses propres fichiers',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'AJOUTE ou MODIFIE une entrée. N’en efface aucune : ni « setfacl -x », ni « setfacl -b ». Retirer une ACL est une opération à faire à la main, après avoir lu ce qu’elle contenait.',
    'Ne touche pas au mode POSIX. Un chmod et une ACL interagissent par le masque, et les mélanger dans le même formulaire rendrait l’effet imprévisible : c’est l’assistant de permissions qui change le mode.',
    'L’ACL par défaut ne s’applique qu’à ce qui sera créé APRÈS, et seulement dans un dossier. Elle ne change rien aux fichiers déjà présents, et l’assistant le dit plutôt que de laisser le croire.',
    'Ne crée ni compte ni groupe : le bénéficiaire doit déjà exister.',
    'Un système de fichiers monté avec « noacl », ou qui ne gère pas les ACL, fait échouer setfacl. L’assistant lit les options de montage et refuse avant d’essayer.',
  ],

  fields: [
    {
      id: 'chemin',
      label: 'Chemin visé',
      type: 'text',
      default: '/srv/donnees/equipe',
      placeholder: '/srv/donnees/equipe',
      help: 'Un fichier ou un dossier, en chemin absolu.',
    },
    {
      id: 'typeEntree',
      label: 'Bénéficiaire',
      type: 'select',
      default: 'Utilisateur',
      options: [['Utilisateur', 'Un compte'], ['Groupe', 'Un groupe']],
      help: 'Une ACL accorde des droits à CE compte ou à CE groupe, en plus des permissions POSIX.',
    },
    {
      id: 'nomEntree',
      label: 'Nom du compte ou du groupe',
      type: 'text',
      default: 'blaise',
      placeholder: 'blaise',
      help: 'Il doit déjà exister. « root » est refusé : il a déjà tous les droits, et l’entrée n’aurait aucun effet.',
    },
    {
      id: 'droits',
      label: 'Droits accordés',
      type: 'select',
      default: 'rwx',
      options: DROITS_ACL,
      help: 'Sur un dossier, le x sert à TRAVERSER. Sans lui, le bénéficiaire ne peut pas entrer, même avec r.',
    },
    {
      id: 'appliquerDefaut',
      label: 'Poser aussi une ACL par défaut',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Dossier seulement. L’ACL par défaut est HÉRITÉE par ce qui sera créé dedans ensuite — c’est ce qui fait tenir un partage dans le temps.',
    },
    {
      id: 'recursif',
      label: 'Appliquer à toute l’arborescence',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Oui : l’entrée est posée sur chaque fichier et dossier existant sous ce chemin. Refusé sur une racine système.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation — retape le chemin exact',
      type: 'text',
      default: '',
      placeholder: '/srv/donnees/equipe',
      optionnel: true,
      help: 'Sans cette phrase exacte, le script généré diagnostique et n’écrit rien.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const c = validateCheminAbsolu(v.chemin, 'Le chemin visé');
    if (!c.ok) errors.chemin = c.error;
    const t = validateChoix(v.typeEntree, ['Utilisateur', 'Groupe'], 'Le bénéficiaire');
    if (!t.ok) errors.typeEntree = t.error;
    const nom = String(v.nomEntree ?? '').trim();
    if (String(v.typeEntree) === 'Groupe') {
      const r = validateNomGroupe(nom, 'Le nom du groupe');
      if (!r.ok) errors.nomEntree = r.error;
    } else {
      const r = validateNomUtilisateur(nom, 'Le nom du compte');
      if (!r.ok) errors.nomEntree = r.error;
    }
    if (nom === 'root') {
      errors.nomEntree = 'root a déjà tous les droits : l’entrée n’aurait aucun effet, et laisserait croire qu’une permission a été accordée.';
    }
    const d = validateChoix(v.droits, DROITS_ACL.map(([k]) => k), 'Les droits');
    if (!d.ok) errors.droits = d.error;
    for (const champ of ['appliquerDefaut', 'recursif']) {
      const r = validateChoix(v[champ], ['Oui', 'Non'], 'La réponse');
      if (!r.ok) errors[champ] = r.error;
    }
    validerCibleRecursive(v.chemin, v.recursif, errors, 'chemin');
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const chemin = String(v.chemin).trim().replace(/(.)\/+$/, '$1');
    const lettre = String(v.typeEntree) === 'Groupe' ? 'g' : 'u';
    const nom = String(v.nomEntree).trim();
    const droits = String(v.droits);
    const entree = `${lettre}:${nom}:${droits}`;
    // setfacl ACCEPTE la forme courte « u:nom:rwx » ; getfacl, lui, ECRIT
    // toujours la forme longue « user:nom:rwx ». Chercher l'entree posee avec
    // la chaine donnee a setfacl ne la trouve donc JAMAIS dans la relecture :
    // le script aurait annonce « introuvable telle quelle » apres chaque pose
    // reussie. Defaut trouve par le banc des permissions, passe H5.
    const entreeLue = `${lettre === 'g' ? 'group' : 'user'}:${nom}:${droits}`;

    return assemblerSh([
      ...enteteBash({
        titre: 'Accorder des droits par ACL, et relire le masque',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'poser une ACL sur un fichier dont on n est pas proprietaire est reserve a root',
      }),
      ...blocGardienChemin({ lectureSeule: false }),
      ...blocVariablesBash([
        ['KJEMO_CIBLE', shQuote(chemin)],
        ['KJEMO_ENTREE', shQuote(entree)],
        ['KJEMO_ENTREE_LUE', shQuote(entreeLue)],
        ['KJEMO_TYPE_E', shQuote(String(v.typeEntree))],
        ['KJEMO_NOM_E', shQuote(nom)],
        ['KJEMO_DROITS', shQuote(droits)],
        ['KJEMO_DEFAUT', shQuote(String(v.appliquerDefaut))],
        ['KJEMO_RECURSIF', shQuote(String(v.recursif))],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? ''))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Chemin' \"${KJEMO_CIBLE}\"",
      "  printf '%s\\t%s\\n' 'Entree ACL' \"${KJEMO_ENTREE}\"",
      "  printf '%s\\t%s\\n' 'Beneficiaire' \"${KJEMO_TYPE_E} ${KJEMO_NOM_E}\"",
      "  printf '%s\\t%s\\n' 'ACL par defaut' \"${KJEMO_DEFAUT}\"",
      "  printf '%s\\t%s\\n' 'Recursif' \"${KJEMO_RECURSIF}\"",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LES OUTILS, ET LE SUPPORT DES ACL',
      '#',
      '# Un setfacl qui echoue sur un systeme de fichiers monte « noacl » rend',
      '# un message obscur. On lit les options de montage AVANT.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      'for kjemo_o in setfacl getfacl; do',
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' 'apt install acl'",
      '  fi',
      'done',
      '',
      'kjemo_exiger_chemin_sur "${KJEMO_CIBLE}"',
      'KJEMO_CIBLE="${KJEMO_CHEMIN_CANON}"',
      'KJEMO_CIBLE_OK=0',
      'KJEMO_EST_DOSSIER=0',
      'if [ -L "${KJEMO_CIBLE}" ]; then',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'PROBLEME' 'lien symbolique' \\",
      "    'setfacl ne suit pas les liens symboliques de la meme facon selon les versions. Vise le fichier ou le dossier reel.'",
      'elif [ -d "${KJEMO_CIBLE}" ]; then',
      '  KJEMO_CIBLE_OK=1',
      '  KJEMO_EST_DOSSIER=1',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'OK' 'dossier' ''",
      'elif [ -f "${KJEMO_CIBLE}" ]; then',
      '  KJEMO_CIBLE_OK=1',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'OK' 'fichier' ''",
      'else',
      "  kjemo_resultat 'Cible' \"${KJEMO_CIBLE}\" 'PROBLEME' 'inexistant' ''",
      'fi',
      '',
      'KJEMO_ACL_SUPPORT_OK=1',
      'if kjemo_dispo findmnt; then',
      '  KJEMO_MONTAGE="$(findmnt -n -o TARGET,FSTYPE,OPTIONS --target "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Systeme de fichiers' 'Montage' 'INFO' \"${KJEMO_MONTAGE}\" \\",
      "    'Point de montage, type et options du systeme de fichiers qui porte la cible.'",
      '  case "${KJEMO_MONTAGE}" in',
      '    *noacl*)',
      '      KJEMO_ACL_SUPPORT_OK=0',
      "      kjemo_resultat 'Systeme de fichiers' 'Support ACL' 'PROBLEME' 'monte avec noacl' \\",
      "        'Ce systeme de fichiers est monte avec l option noacl, qui REFUSE les ACL : setfacl echouerait. Il faut le remonter sans cette option, ce qui se decide a part — c est une ligne de /etc/fstab.'",
      '      ;;',
      '  esac',
      'fi',
      '# Une LECTURE suffit a savoir si getfacl repond sur cette cible : si la',
      '# lecture des ACL echoue, l ecriture echouera aussi.',
      'if [ "${KJEMO_CIBLE_OK}" -eq 1 ] && kjemo_dispo getfacl; then',
      '  if ! getfacl -p -- "${KJEMO_CIBLE}" > "${KJEMO_TMP}/acl-avant.txt" 2>"${KJEMO_TMP}/acl-err.txt"; then',
      '    KJEMO_ACL_SUPPORT_OK=0',
      "    kjemo_resultat 'Systeme de fichiers' 'Support ACL' 'PROBLEME' 'getfacl echoue' \\",
      "      'La lecture des ACL echoue sur cette cible. L ecriture echouerait aussi.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE BENEFICIAIRE EXISTE-T-IL ?',
      '#',
      '# setfacl accepte un UID numerique inconnu : l entree est posee et',
      '# n accorde rien a personne. On exige donc un nom connu.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_BENEF_OK=0',
      'if [ "${KJEMO_TYPE_E}" = \'Groupe\' ]; then',
      '  if getent group "${KJEMO_NOM_E}" > /dev/null 2>&1; then',
      '    KJEMO_BENEF_OK=1',
      "    kjemo_resultat 'Beneficiaire' \"groupe ${KJEMO_NOM_E}\" 'OK' 'connu' ''",
      '  else',
      "    kjemo_resultat 'Beneficiaire' \"groupe ${KJEMO_NOM_E}\" 'PROBLEME' 'inconnu' \\",
      "      'Cree le groupe d abord : sudo groupadd. Une entree d ACL sur un groupe inexistant n accorde rien et ne se voit pas.'",
      '  fi',
      'else',
      '  if getent passwd "${KJEMO_NOM_E}" > /dev/null 2>&1; then',
      '    KJEMO_BENEF_OK=1',
      "    kjemo_resultat 'Beneficiaire' \"compte ${KJEMO_NOM_E}\" 'OK' 'connu' ''",
      '  else',
      "    kjemo_resultat 'Beneficiaire' \"compte ${KJEMO_NOM_E}\" 'PROBLEME' 'inconnu' \\",
      "      'Ce compte n existe pas sur cette machine.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - L ACL PAR DEFAUT N A DE SENS QUE SUR UN DOSSIER',
      '#',
      '# Sur un fichier, setfacl -d echoue. Et surtout : une ACL par defaut ne',
      '# change RIEN a ce qui existe deja. Beaucoup la posent en croyant',
      '# corriger les fichiers presents, puis concluent que les ACL ne',
      '# fonctionnent pas.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_DEFAUT_OK=1',
      'KJEMO_DEFAUT_EFFECTIF=\'Non\'',
      'if [ "${KJEMO_DEFAUT}" = \'Oui\' ]; then',
      '  if [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      '    KJEMO_DEFAUT_EFFECTIF=\'Oui\'',
      "    kjemo_resultat 'ACL par defaut' 'Cible' 'OK' 'dossier' \\",
      "      'L ACL par defaut sera HERITEE par ce qui sera cree dedans ENSUITE. Elle ne modifie pas les fichiers deja presents : pour ceux-la, c est la recursion qui agit.'",
      '  else',
      '    KJEMO_DEFAUT_OK=0',
      "    kjemo_resultat 'ACL par defaut' 'Cible' 'PROBLEME' 'pas un dossier' \\",
      "      'Une ACL par defaut ne se pose que sur un dossier : elle decrit ce qu heriteront les entrees creees dedans.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LA RECURSION, REVERIFIEE DANS LE SCRIPT',
      '# ---------------------------------------------------------------------------',
      'KJEMO_RECURSIF_OK=1',
      `KJEMO_RACINES_INTERDITES=(${RECURSIF_REFUSE.map((r) => shQuote(r)).join(' ')})`,
      'if [ "${KJEMO_RECURSIF}" = \'Oui\' ]; then',
      '  for kjemo_r in "${KJEMO_RACINES_INTERDITES[@]}"; do',
      '    if [ "${KJEMO_CIBLE}" = "${kjemo_r}" ]; then',
      '      KJEMO_RECURSIF_OK=0',
      "      kjemo_resultat 'Recursion' \"${KJEMO_CIBLE}\" 'PROBLEME' 'racine interdite' \\",
      "        'Poser une ACL sur toute une racine systeme est refuse : l effet est impossible a relire, et impossible a defaire proprement.'",
      '    fi',
      '  done',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - L ETAT AVANT, RELEVE ET RELU',
      '#',
      '# getfacl --restore sait relire ce format : c est l annulation de',
      '# l operation, et elle est ecrite avant d agir.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SAUVE_OK=0',
      'KJEMO_HORO="$(date +%Y%m%d-%H%M%S 2>/dev/null || printf \'%s\' inconnu)"',
      'KJEMO_SAUVE="${HOME}/kjemo-acl-${KJEMO_HORO}.acl"',
      'if [ "${KJEMO_CIBLE_OK}" -eq 1 ] && [ "${KJEMO_OUTILS_OK}" -eq 1 ]; then',
      '  kjemo_code=0',
      '  if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      '    getfacl -R -p -- "${KJEMO_CIBLE}" > "${KJEMO_SAUVE}" 2>/dev/null || kjemo_code=$?',
      '  else',
      '    getfacl -p -- "${KJEMO_CIBLE}" > "${KJEMO_SAUVE}" 2>/dev/null || kjemo_code=$?',
      '  fi',
      '  if [ "${kjemo_code}" -ne 0 ] || [ ! -s "${KJEMO_SAUVE}" ]; then',
      "    kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE}\" 'PROBLEME' 'absente ou vide' \\",
      "      'Le releve des ACL actuelles a echoue. AUCUNE ACL n a ete posee.'",
      "    printf '%s\\n' 'ARRET : impossible de relever les ACL actuelles.' >&2",
      "    printf '%s\\n' 'Aucune ACL n a ete posee.' >&2",
      '    exit 1',
      '  fi',
      '  # Relecture : le fichier doit nommer la cible, sinon il ne la',
      '  # restaurerait pas. getfacl -p conserve le chemin tel quel.',
      '  if ! grep -qF -- "${KJEMO_CIBLE#/}" "${KJEMO_SAUVE}"; then',
      "    kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE}\" 'PROBLEME' 'la cible n y figure pas' \\",
      "      'Le releve existe mais ne mentionne pas la cible. AUCUNE ACL n a ete posee.'",
      "    printf '%s\\n' 'ARRET : la relecture du releve d ACL ne retrouve pas la cible.' >&2",
      '    exit 1',
      '  fi',
      '  KJEMO_SAUVE_OK=1',
      "  kjemo_resultat 'Sauvegarde' \"${KJEMO_SAUVE}\" 'OK' 'relu' \\",
      "    'Annulation : setfacl --restore sur ce fichier. Il contient aussi le mode POSIX, que setfacl --restore remet.'",
      '  KJEMO_ACL_AVANT="$(head -40 -- "${KJEMO_SAUVE}" 2>/dev/null || true)"',
      "  kjemo_resultat 'ACL' 'Etat avant' 'INFO' \"${KJEMO_ACL_AVANT}\" \\",
      "    'Quarante premieres lignes du releve.'",
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: chemin,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `poser l entree d ACL ${entree} sur ${chemin}`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_OUTILS_OK', 'setfacl ou getfacl manque : apt install acl.'],
          ['KJEMO_CIBLE_OK', 'La cible n est pas un fichier ou un dossier exploitable.'],
          ['KJEMO_ACL_SUPPORT_OK', 'Le systeme de fichiers ne gere pas les ACL, ou les refuse.'],
          ['KJEMO_BENEF_OK', 'Le compte ou le groupe beneficiaire est inconnu.'],
          ['KJEMO_DEFAUT_OK', 'Une ACL par defaut a ete demandee sur autre chose qu un dossier.'],
          ['KJEMO_RECURSIF_OK', 'Une ACL recursive sur cette racine est refusee.'],
          ['KJEMO_SAUVE_OK', 'Le releve des ACL actuelles n a pas pu etre ecrit et relu.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le chemin.'],
        ],
        action: 'la pose de l entree d ACL',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - LA POSE',
      '#',
      '# Les arguments passent par un TABLEAU : -m, puis l entree, puis la',
      '# cible. Aucune chaine assemblee, donc aucune option qui se colle a son',
      '# argument. Et surtout : ni -b, ni -x. Cet assistant AJOUTE.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_cmd=(setfacl)',
      '  if [ "${KJEMO_RECURSIF}" = \'Oui\' ] && [ "${KJEMO_EST_DOSSIER}" -eq 1 ]; then',
      '    kjemo_cmd+=(--recursive)',
      '  fi',
      '  kjemo_cmd+=(--modify "${KJEMO_ENTREE}" -- "${KJEMO_CIBLE}")',
      '  kjemo_code=0',
      '  "${kjemo_cmd[@]}" > "${KJEMO_TMP}/setfacl.out" 2>&1 || kjemo_code=$?',
      '  if [ "${kjemo_code}" -ne 0 ]; then',
      "    kjemo_resultat 'Application' 'setfacl' 'PROBLEME' \"code ${kjemo_code}\" \\",
      "      \"setfacl a echoue. Aucune ACL par defaut n a ete posee. Releve d origine : ${KJEMO_SAUVE}\"",
      "    printf '%s\\n' 'ARRET : setfacl a echoue.' >&2",
      '    printf \'%s\\n\' "Releve d origine : ${KJEMO_SAUVE}" >&2',
      '    cat "${KJEMO_TMP}/setfacl.out" >&2',
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Application' 'setfacl' 'OK' \"${KJEMO_ENTREE}\" \\",
      "    'Entree ajoutee. Les entrees existantes n ont pas ete touchees : --modify ajoute ou remplace UNE entree, il n efface pas les autres.'",
      '',
      '  if [ "${KJEMO_DEFAUT_EFFECTIF}" = \'Oui\' ]; then',
      '    kjemo_cmd_d=(setfacl)',
      '    if [ "${KJEMO_RECURSIF}" = \'Oui\' ]; then',
      '      kjemo_cmd_d+=(--recursive)',
      '    fi',
      '    kjemo_cmd_d+=(--default --modify "${KJEMO_ENTREE}" -- "${KJEMO_CIBLE}")',
      '    kjemo_code=0',
      '    "${kjemo_cmd_d[@]}" > "${KJEMO_TMP}/setfacl-d.out" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -ne 0 ]; then',
      "      kjemo_resultat 'Application' 'setfacl --default' 'PROBLEME' \"code ${kjemo_code}\" \\",
      "        \"L entree d acces est posee, l ACL par defaut non. Releve d origine : ${KJEMO_SAUVE}\"",
      "      printf '%s\\n' 'ARRET : la pose de l ACL par defaut a echoue. L entree d acces, elle, est posee.' >&2",
      '      cat "${KJEMO_TMP}/setfacl-d.out" >&2',
      '      exit 1',
      '    fi',
      "    kjemo_resultat 'Application' 'setfacl --default' 'OK' \"${KJEMO_ENTREE}\" \\",
      "      'Heritee par ce qui sera cree dans ce dossier ensuite. Les fichiers deja presents ne changent pas.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - LA RELECTURE, ET LE MASQUE',
      '#',
      '# C est l etape que le cours ne mentionne pas, et c est celle qui dit la',
      '# verite. Ajouter une entree nominative RECALCULE le masque, et le masque',
      '# est un PLAFOND : une entree « rwx » derriere un masque « r-x » accorde',
      '# « r-x ». getfacl l annonce par une ligne « #effective: ».',
      '# ---------------------------------------------------------------------------',
      '  KJEMO_APRES="$(getfacl -p -- "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_APRES}" ]; then',
      "    kjemo_resultat 'Relecture' \"${KJEMO_CIBLE}\" 'PROBLEME' 'illisible' \\",
      "      'getfacl ne rend plus rien apres la pose. Ne conclus pas que l entree est en place.'",
      "    printf '%s\\n' 'ARRET : la relecture des ACL ne rend rien.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Relecture' 'ACL apres' 'INFO' \"${KJEMO_APRES}\" \\",
      "    'Etat complet apres l operation, lu sur le systeme de fichiers.'",
      '  if printf \'%s\' "${KJEMO_APRES}" | grep -qF -- "${KJEMO_ENTREE_LUE}"; then',
      "    kjemo_resultat 'Relecture' 'Entree presente' 'OK' \"${KJEMO_ENTREE_LUE}\" \\",
      "      'Retrouvee telle quelle dans la sortie de getfacl.'",
      '  else',
      "    kjemo_resultat 'Relecture' 'Entree presente' 'PROBLEME' 'introuvable telle quelle' \\",
      "      'setfacl a rendu 0, mais l entree n apparait pas sous la forme demandee. Le masque l a peut-etre rabotee : lis les lignes ci-dessous.'",
      '  fi',
      '  KJEMO_EFFECTIFS="$(printf \'%s\\n\' "${KJEMO_APRES}" | grep \'#effective:\' || true)"',
      '  if [ -n "${KJEMO_EFFECTIFS}" ]; then',
      "    kjemo_resultat 'Relecture' 'Masque' 'ATTENTION' \"${KJEMO_EFFECTIFS}\" \\",
      "      'Le masque rabote au moins une entree : les droits REELS sont ceux qui suivent #effective:, pas ceux de l entree. Pour relever le plafond : setfacl -m m::rwx sur la cible. C est la cause la plus frequente d une ACL qui semble correcte et ne fonctionne pas.'",
      '    # Les droits DEMANDES sont une donnee du formulaire : on les confronte',
      '    # a ce que la ligne #effective: de NOTRE entree annonce, plutot que de',
      '    # laisser lire deux chaines et faire la soustraction de tete.',
      '    kjemo_eff_notre="$(printf \'%s\\n\' "${KJEMO_APRES}" \\',
      '      | grep -F -- "${KJEMO_ENTREE_LUE}" \\',
      '      | sed -n \'s/.*#effective:[[:space:]]*\\([rwx-]*\\).*/\\1/p\' | head -1 || true)"',
      '    if [ -n "${kjemo_eff_notre}" ] && [ "${kjemo_eff_notre}" != "${KJEMO_DROITS}" ]; then',
      "      kjemo_resultat 'Relecture' 'Droits effectifs de cette entree' 'PROBLEME' \\",
      '        "demandes ${KJEMO_DROITS}, effectifs ${kjemo_eff_notre}" \\',
      '        "Droits demandes ${KJEMO_DROITS}, droits effectifs ${kjemo_eff_notre} : c est bien CETTE entree que le masque rabote. Tant que le masque n est pas releve, le beneficiaire n a PAS les droits demandes, meme si getfacl affiche la bonne ligne."',
      '    fi',
      '  else',
      "    kjemo_resultat 'Relecture' 'Masque' 'OK' 'aucun droit rabote' \\",
      "      'Aucune ligne #effective: : chaque entree accorde exactement ce qu elle declare.'",
      '  fi',
      '  # Le « + » que ls affiche : utile pour reconnaitre une ACL plus tard.',
      '  KJEMO_MODE_APRES="$(stat -c \'%A\' -- "${KJEMO_CIBLE}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Relecture' 'Mode affiche' 'INFO' \"${KJEMO_MODE_APRES}\" \\",
      "    'Le « + » final signale une ACL. Attention : ls affiche alors le MASQUE a la place des droits du groupe — on lit un plafond en croyant lire une permission.'",
      "  kjemo_resultat 'Annulation' 'Releve d origine' 'INFO' \"${KJEMO_SAUVE}\" \\",
      "    'Annulation : sudo setfacl --restore sur ce fichier. Garde-le.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-acl' }),
    ]);
  },

  gui: [
    'Installe le paquet si besoin : « sudo apt install acl ».',
    'Relève l’état avant, c’est l’annulation : « sudo getfacl -R -p /srv/donnees/equipe > ~/avant.acl ».',
    'Vérifie que le bénéficiaire existe : « getent passwd blaise » ou « getent group equipe ».',
    'Pose l’entrée : « sudo setfacl -m u:blaise:rwx /srv/donnees/equipe ».',
    'Pour que ce qui sera créé dedans en hérite, ajoute l’ACL par défaut : « sudo setfacl -d -m u:blaise:rwx /srv/donnees/equipe ».',
    'L’ACL par défaut ne change RIEN aux fichiers déjà présents : pour eux, ajoute « -R » à la première commande.',
    'Relis, et lis surtout les lignes « #effective: » : « getfacl /srv/donnees/equipe ».',
    'Si une ligne « #effective: » apparaît, le masque rabote les droits. Pour relever le plafond : « sudo setfacl -m m::rwx /srv/donnees/equipe ».',
    'Pour annuler : « sudo setfacl --restore=~/avant.acl ».',
  ],

  keywords: ['acl', 'setfacl', 'getfacl', 'masque', 'mask', 'effective', 'droits',
    'permission', 'defaut', 'default', 'heritage', 'partage', 'groupe',
    'nominatif', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Le paquet acl : « sudo apt install acl ».',
    'Un système de fichiers qui gère les ACL et qui n’est pas monté avec « noacl » — c’est le cas par défaut d’ext4 et de xfs sur Ubuntu.',
    'Le compte ou le groupe bénéficiaire, qui doit déjà exister.',
    'sudo, ou être propriétaire de la cible.',
  ],

  commonErrors: [
    {
      message: 'J’ai posé u:blaise:rwx et blaise ne peut toujours pas écrire',
      code: 'KJEMO',
      cause: 'Le masque de l’ACL rabote l’entrée. getfacl l’indique par une ligne « #effective:rw- » ou « #effective:r-x » juste après l’entrée.',
      fix: 'Lire les lignes « #effective: », puis relever le masque. L’assistant le fait et le signale comme ATTENTION.',
      command: 'sudo setfacl -m m::rwx /srv/donnees/equipe',
    },
    {
      message: 'setfacl: Option -d: Invalid argument near character 1',
      code: 'KJEMO',
      cause: 'Une ACL par défaut a été demandée sur un fichier. Elle ne se pose que sur un dossier.',
      fix: 'Viser le dossier. L’assistant refuse ce cas avant d’essayer.',
      command: 'stat -c \'%F\' /srv/donnees/equipe',
    },
    {
      message: 'J’ai posé une ACL par défaut et les fichiers existants n’ont pas changé',
      code: 'KJEMO',
      cause: 'C’est son fonctionnement : une ACL par défaut décrit ce qu’hériteront les entrées créées APRÈS.',
      fix: 'Pour les fichiers déjà là, appliquer l’entrée d’accès en récursif.',
      command: 'sudo setfacl -R -m u:blaise:rwx /srv/donnees/equipe',
    },
    {
      message: 'setfacl: /srv/donnees: Operation not supported',
      code: 'ENOTSUP',
      cause: 'Le système de fichiers ne gère pas les ACL, ou il est monté avec l’option noacl.',
      fix: 'Lire les options de montage. L’assistant les lit et refuse avant d’essayer.',
      command: 'findmnt -o TARGET,FSTYPE,OPTIONS --target /srv/donnees',
    },
    {
      message: 'Un chmod a fait disparaître mes droits d’ACL',
      code: 'KJEMO',
      cause: 'Le chmod a modifié le masque : les entrées sont toujours là, mais rabotées.',
      fix: 'Relire l’ACL, relever le masque, ou restaurer le relevé.',
      command: 'getfacl /srv/donnees/equipe',
    },
  ],

  reversible: true,
  verifyAfter: [
    '« getfacl <chemin> » montre l’entrée nominative telle qu’elle a été demandée.',
    'Aucune ligne « #effective: » n’apparaît — ou, si elle apparaît, le rapport la signale en ATTENTION et donne la commande pour relever le masque.',
    'Si une ACL par défaut a été posée : les lignes « default: » sont présentes, et un fichier créé ensuite dans le dossier en hérite — à vérifier avec « touch <dossier>/essai && getfacl <dossier>/essai ».',
    '« stat -c \'%A\' <chemin> » termine par un « + ».',
    'Le relevé d’origine existe dans le dossier personnel : c’est lui qui permet « setfacl --restore ».',
  ],

  rollback: {
    summary: 'Réversible par le relevé écrit avant l’opération : setfacl --restore remet les ACL ET le mode POSIX de chaque entrée qu’il contient.',
    diagnostic: `# Les releves disponibles :
ls -lt "\${HOME}"/kjemo-acl-*.acl
# L etat actuel :
getfacl -p /srv/donnees/equipe`,
    command: `# 1. Restaurer l etat complet depuis le releve :
sudo setfacl --restore="\${HOME}/kjemo-acl-AAAAMMJJ-HHMMSS.acl"

# 2. Ou retirer seulement l entree posee :
sudo setfacl -x u:blaise /srv/donnees/equipe
#    Et l entree par defaut correspondante :
sudo setfacl -d -x u:blaise /srv/donnees/equipe

# 3. Verifier :
getfacl -p /srv/donnees/equipe`,
    warning: 'Ne pas utiliser « setfacl -b » pour annuler : cette option retire TOUTES les ACL étendues du chemin, y compris celles qui existaient avant et qui n’ont rien à voir avec cette opération. Le relevé, lui, remet exactement l’état précédent.',
  },

  checks: [
    'setfacl et getfacl sont vérifiés présents avant toute action.',
    'Les options de montage sont lues : un système de fichiers monté « noacl » fait refuser l’opération au lieu de la tenter.',
    'getfacl est appelé en LECTURE d’abord : si la lecture des ACL échoue, l’écriture échouerait aussi.',
    'Le compte ou le groupe bénéficiaire doit exister : setfacl accepterait un identifiant numérique inconnu, qui n’accorde rien à personne.',
    '« root » est refusé comme bénéficiaire : l’entrée n’aurait aucun effet.',
    'Une ACL par défaut sur autre chose qu’un dossier est refusée.',
    'Une ACL récursive sur une racine système est refusée par le formulaire ET revérifiée dans le script.',
    'Le relevé getfacl est écrit, puis RELU : non vide et contenant la cible. Zéro écriture si l’une des deux vérifications échoue.',
    'Ni « setfacl -b » ni « setfacl -x » n’apparaissent : l’assistant ajoute, il n’efface pas.',
    'Les arguments passent par un tableau : --modify, l’entrée, puis « -- » et la cible.',
    'L’ACL est relue après la pose, et l’entrée est cherchée telle quelle dans la sortie.',
    'Les lignes « #effective: » sont signalées comme ATTENTION, avec la commande qui relève le masque : c’est la cause la plus fréquente d’une ACL correcte qui ne fonctionne pas.',
  ],

  source: `${M}/man1/setfacl.1.html`,
  sources: [
    { label: 'setfacl(1)', url: `${M}/man1/setfacl.1.html` },
    { label: 'getfacl(1)', url: `${M}/man1/getfacl.1.html` },
    { label: 'acl(5) — masque et ACL par défaut', url: `${M}/man5/acl.5.html` },
    { label: 'mount(8) — options acl et noacl', url: `${M}/man8/mount.8.html` },
    { label: 'ext4(5) — options du système de fichiers (page partagée ext2/3/4)', url: `${M}/man5/ext4.5.html` },
    { label: 'stat(1)', url: `${M}/man1/stat.1.html` },
  ],
};

// ===========================================================================
// ASSISTANT 4 — CRÉER UN COMPTE, ET RIEN D'AUTRE
//
// Ce que cet assistant ne fait pas, et ne fera pas :
//   - il ne pose AUCUN mot de passe. Un mot de passe dans un formulaire finit
//     dans un script, un script finit dans un dossier de téléchargements, et
//     un dossier de téléchargements finit partagé. Le compte est créé sans mot
//     de passe, donc verrouillé, et `passwd <compte>` se tape à la main.
//   - il ne supprime aucun compte. `userdel -r` efface le dossier personnel.
//   - il ne touche pas à /etc/sudoers. Une faute de syntaxe y retire sudo à
//     tout le monde ; `visudo` existe parce qu'il valide avant d'écrire.
//   - il n'ajoute personne à un groupe privilégié. Donner sudo est une
//     décision, pas un champ de formulaire.
//   - il n'offre pas de choisir l'UID. Un second compte d'UID 0 est un compte
//     root qui ne s'appelle pas root.
// ===========================================================================

const linuxUserCreate = {
  id: 'linux-user-create',
  icon: '◆',
  category: CAT,
  subcategory: 'Utilisateurs et permissions',
  title: 'Créer un compte local, verrouillé à la création',
  risk: 'caution',
  summary: 'Crée un compte local avec son dossier personnel, son groupe principal et ses groupes secondaires, puis relit le résultat avec getent et id. Aucun mot de passe n’est demandé ni écrit : le compte est créé verrouillé, et « passwd » se lance à la main. Refuse un compte existant, un compte système, et tout ajout à un groupe privilégié.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'passwd — useradd, usermod (présent par défaut)',
    'coreutils — id, stat (présent par défaut)',
    'libc-bin — getent (présent par défaut)',
  ],
  privileges: 'root — useradd écrit dans /etc/passwd, /etc/shadow et /etc/group',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'NE POSE AUCUN MOT DE PASSE, et n’offre pas de champ pour en saisir un. Le compte est créé sans mot de passe, donc verrouillé : personne ne peut s’y connecter avant qu’un administrateur lance « passwd <compte> » à la main, en interactif.',
    'Ne supprime ni ne modifie aucun compte existant. Un compte déjà présent fait refuser l’opération, au lieu d’être « mis à jour » — ce qui écraserait un shell, un groupe ou un dossier personnel choisis par quelqu’un d’autre.',
    'N’écrit pas /etc/sudoers et n’ajoute personne aux groupes sudo, admin, adm, shadow, wheel, docker, lxd, disk, kvm ou libvirt : chacun donne, directement ou indirectement, les pleins pouvoirs sur la machine.',
    'Ne permet pas de choisir l’UID. Un UID imposé sert à des cas précis (reprise de sauvegarde, partage NFS) qui méritent une commande écrite à la main.',
    'Ne crée aucun groupe. Les groupes demandés doivent déjà exister : « sudo groupadd equipe ».',
    'Ne configure ni clé SSH, ni quota, ni ACL sur le dossier personnel. Ce sont d’autres assistants, et les mélanger rendrait l’annulation impossible à décrire.',
  ],

  fields: [
    {
      id: 'nomUtilisateur',
      label: 'Nom du compte',
      type: 'text',
      default: 'etudiant',
      placeholder: 'etudiant',
      help: 'Minuscules, chiffres, « _ » et « - », 32 caractères au plus. Les comptes système (root, daemon, www-data…) sont refusés.',
    },
    {
      id: 'commentaire',
      label: 'Nom complet (champ commentaire)',
      type: 'text',
      default: '',
      placeholder: 'Prenom Nom',
      optionnel: true,
      help: 'Facultatif. Va dans le 5e champ de /etc/passwd, celui que « finger » et les interfaces graphiques affichent. Pas de « : », il séparerait les champs du fichier.',
    },
    {
      id: 'groupePrincipal',
      label: 'Groupe principal',
      type: 'text',
      default: '',
      placeholder: 'etudiants',
      optionnel: true,
      help: 'Laisse vide pour le comportement par défaut d’Ubuntu : un groupe personnel du même nom que le compte. S’il est renseigné, il doit déjà exister.',
    },
    {
      id: 'groupesSecondaires',
      label: 'Groupes secondaires',
      type: 'text',
      default: 'partage',
      placeholder: 'partage,projet',
      optionnel: true,
      help: 'Séparés par des virgules. Ils doivent déjà exister. Les groupes qui donnent des privilèges (sudo, adm, docker…) sont refusés.',
    },
    {
      id: 'shell',
      label: 'Interpréteur de connexion',
      type: 'select',
      default: '/bin/bash',
      options: [
        ['/bin/bash', '/bin/bash — compte interactif'],
        ['/usr/sbin/nologin', '/usr/sbin/nologin — compte de service, aucune connexion'],
      ],
      help: 'nologin pour un compte qui ne doit jamais ouvrir de session : il refuse la connexion avec un message clair, au lieu d’échouer bizarrement.',
    },
    {
      id: 'creerHome',
      label: 'Créer le dossier personnel',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Oui pour un compte humain. Non pour un compte de service qui n’a rien à stocker — mais attention : sans dossier personnel, une connexion démarre dans « / ».',
    },
    {
      id: 'confirmation',
      label: 'Confirmation — retape le nom du compte',
      type: 'text',
      default: '',
      placeholder: 'etudiant',
      optionnel: true,
      help: 'Sans cette phrase exacte, le script généré diagnostique et ne crée rien.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const r = validateNomUtilisateur(v.nomUtilisateur, 'Le nom du compte');
    if (!r.ok) errors.nomUtilisateur = r.error;

    const commentaire = String(v.commentaire ?? '');
    if (/[:\n\r]/.test(commentaire)) {
      errors.commentaire = 'Le commentaire ne peut contenir ni « : » ni retour à la ligne : ce sont les séparateurs de /etc/passwd, et un champ qui en contient casse la lecture du fichier pour tout le monde.';
    }
    const gp = String(v.groupePrincipal ?? '').trim();
    if (gp !== '') {
      const g = validateNomGroupe(gp, 'Le groupe principal');
      if (!g.ok) errors.groupePrincipal = g.error;
      else if (GROUPES_PRIVILEGIES.includes(gp)) {
        errors.groupePrincipal = `« ${gp} » donne des privilèges sur la machine. En faire le groupe PRINCIPAL d’un compte, c’est les lui donner en permanence : cet assistant le refuse, et cette décision se prend à la main.`;
      }
    }
    const secs = String(v.groupesSecondaires ?? '').trim();
    if (secs !== '') {
      const liste = secs.split(',').map((x) => x.trim()).filter((x) => x !== '');
      if (liste.length === 0) {
        errors.groupesSecondaires = 'Liste vide après nettoyage : retire les virgules isolées.';
      }
      for (const nom of liste) {
        const g = validateNomGroupe(nom, `Le groupe « ${nom} »`);
        if (!g.ok) { errors.groupesSecondaires = g.error; break; }
        if (GROUPES_PRIVILEGIES.includes(nom)) {
          errors.groupesSecondaires = `« ${nom} » donne, directement ou indirectement, les pleins pouvoirs sur la machine. Cet assistant n’y ajoute personne : accorder sudo est une décision, pas un champ de formulaire. La commande existe et s’écrit à la main, en sachant ce qu’elle fait : sudo usermod -aG ${nom} <compte>.`;
          break;
        }
      }
      if (new Set(liste).size !== liste.length) {
        errors.groupesSecondaires = 'Le même groupe apparaît deux fois.';
      }
    }
    const s = validateChoix(v.shell, ['/bin/bash', '/usr/sbin/nologin'], 'L’interpréteur');
    if (!s.ok) errors.shell = s.error;
    const h = validateChoix(v.creerHome, ['Oui', 'Non'], 'La création du dossier personnel');
    if (!h.ok) errors.creerHome = h.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const nom = String(v.nomUtilisateur).trim();
    const commentaire = String(v.commentaire ?? '').trim();
    const gp = String(v.groupePrincipal ?? '').trim();
    const secs = String(v.groupesSecondaires ?? '').trim()
      .split(',').map((x) => x.trim()).filter((x) => x !== '');
    const shell = String(v.shell);
    const home = String(v.creerHome) === 'Oui';

    return assemblerSh([
      ...enteteBash({
        titre: 'Creer un compte local, verrouille a la creation',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'useradd ecrit dans /etc/passwd, /etc/shadow et /etc/group',
      }),
      ...blocVariablesBash([
        ['KJEMO_NOM', shQuote(nom)],
        ['KJEMO_COMMENTAIRE', shQuote(commentaire)],
        ['KJEMO_GP', shQuote(gp)],
        ['KJEMO_SECS', shQuote(secs.join(','))],
        ['KJEMO_SHELL', shQuote(shell)],
        ['KJEMO_HOME', shQuote(home ? 'Oui' : 'Non')],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? ''))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Compte' \"${KJEMO_NOM}\"",
      "  printf '%s\\t%s\\n' 'Nom complet' \"${KJEMO_COMMENTAIRE:-non renseigne}\"",
      "  printf '%s\\t%s\\n' 'Groupe principal' \"${KJEMO_GP:-groupe personnel par defaut}\"",
      "  printf '%s\\t%s\\n' 'Groupes secondaires' \"${KJEMO_SECS:-aucun}\"",
      "  printf '%s\\t%s\\n' 'Interpreteur' \"${KJEMO_SHELL}\"",
      "  printf '%s\\t%s\\n' 'Dossier personnel' \"${KJEMO_HOME}\"",
      "  printf '%s\\t%s\\n' 'Mot de passe' 'AUCUN - a poser a la main avec passwd'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# CE QUE CE SCRIPT NE CONTIENT PAS',
      '#',
      '# Aucun mot de passe, aucun hachage, aucune cle. Le compte sera cree sans',
      '# mot de passe, donc VERROUILLE : le champ de /etc/shadow contient « ! »,',
      '# et aucune connexion par mot de passe n est possible.',
      '#',
      '# C est voulu, et ce n est pas un oubli : un mot de passe saisi dans un',
      '# formulaire se retrouve dans le script genere, le script dans le dossier',
      '# de telechargements, et le dossier de telechargements, un jour, dans une',
      '# archive partagee. La commande qui pose un mot de passe est interactive,',
      '# et elle le reste.',
      '# ---------------------------------------------------------------------------',
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' 'AUCUN MOT DE PASSE DANS CE SCRIPT'",
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' '  Le compte sera cree VERROUILLE. Pour le rendre utilisable :'",
      'printf \'%s\\n\' "    sudo passwd ${KJEMO_NOM}"',
      "printf '%s\\n' '  Cette commande est interactive, et c est une bonne chose.'",
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' ''",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LES OUTILS',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      'for kjemo_o in useradd getent id; do',
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' \\",
      "      'useradd vient du paquet passwd, present par defaut sur Ubuntu.'",
      '  fi',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE COMPTE N EXISTE-T-IL PAS DEJA ?',
      '#',
      '# useradd refuse un compte existant, et c est bien. Mais le reflexe',
      '# suivant est de remplacer useradd par usermod « pour mettre a jour », et',
      '# usermod ECRASE le shell, le groupe principal et le dossier personnel',
      '# choisis par quelqu un d autre. Cet assistant refuse, et ne propose pas',
      '# de mise a jour.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_LIBRE_OK=0',
      'KJEMO_EXISTANT="$(getent passwd "${KJEMO_NOM}" 2>/dev/null || true)"',
      'if [ -n "${KJEMO_EXISTANT}" ]; then',
      "  kjemo_resultat 'Compte' \"${KJEMO_NOM}\" 'PROBLEME' 'existe deja' \\",
      "    \"Ligne actuelle : ${KJEMO_EXISTANT}. Cet assistant ne modifie aucun compte existant : usermod ecraserait le shell, le groupe principal ou le dossier personnel choisis par quelqu un d autre. Choisis un autre nom, ou agis a la main en sachant ce que tu remplaces.\"",
      'else',
      '  KJEMO_LIBRE_OK=1',
      "  kjemo_resultat 'Compte' \"${KJEMO_NOM}\" 'OK' 'libre' \\",
      "    'Aucun compte de ce nom dans la base locale ni dans les bases consultees par getent.'",
      '  # Un GROUPE du meme nom peut exister sans le compte : useradd le',
      '  # signalerait tard, et le message est obscur.',
      '  if getent group "${KJEMO_NOM}" > /dev/null 2>&1; then',
      "    kjemo_resultat 'Compte' 'Groupe homonyme' 'ATTENTION' 'present' \\",
      "      'Un groupe porte deja ce nom. useradd ne pourra pas creer le groupe personnel habituel : precise un groupe principal existant, ou choisis un autre nom de compte.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LES GROUPES DEMANDES EXISTENT-ILS, ET SONT-ILS ANODINS ?',
      '#',
      '# useradd -G accepte une liste ; si UN seul groupe manque, il echoue sans',
      '# rien creer. On verifie donc chaque nom avant, et on refuse les groupes',
      '# qui donnent des privileges.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_GROUPES_OK=1',
      `KJEMO_GROUPES_PRIVILEGIES=(${GROUPES_PRIVILEGIES.map((g) => shQuote(g)).join(' ')})`,
      'kjemo_examiner_groupe() {',
      '  local g="${1:-}" role="${2:-}"',
      '  if [ -z "${g}" ]; then return 0; fi',
      '  local priv=\'\'',
      '  for kjemo_p in "${KJEMO_GROUPES_PRIVILEGIES[@]}"; do',
      '    if [ "${g}" = "${kjemo_p}" ]; then priv="${kjemo_p}"; fi',
      '  done',
      '  if [ -n "${priv}" ]; then',
      '    KJEMO_GROUPES_OK=0',
      "    kjemo_resultat 'Groupes' \"${role} ${g}\" 'PROBLEME' 'groupe privilegie' \\",
      "      'Ce groupe donne, directement ou indirectement, les pleins pouvoirs sur la machine. Accorder sudo est une decision qui se prend a la main : sudo usermod -aG, apres avoir verifie qui le demande et pourquoi.'",
      '    return 0',
      '  fi',
      '  if getent group "${g}" > /dev/null 2>&1; then',
      '    local gid=\'\'',
      '    gid="$(getent group "${g}" | cut -d: -f3)"',
      "    kjemo_resultat 'Groupes' \"${role} ${g}\" 'OK' \"GID ${gid}\" ''",
      '  else',
      '    KJEMO_GROUPES_OK=0',
      "    kjemo_resultat 'Groupes' \"${role} ${g}\" 'PROBLEME' 'inconnu' \\",
      "      'Ce groupe n existe pas. Cet assistant ne cree pas de groupe : sudo groupadd, puis relance.'",
      '  fi',
      '}',
      'kjemo_examiner_groupe "${KJEMO_GP}" \'principal\'',
      'if [ -n "${KJEMO_SECS}" ]; then',
      '  # IFS est fixe a la virgule pour CETTE lecture seulement, dans un',
      '  # sous-shell implicite de la boucle : la valeur globale n est pas',
      '  # touchee, et la suite du script garde son IFS strict.',
      '  while IFS=, read -r -a kjemo_liste; do',
      '    for kjemo_g in "${kjemo_liste[@]}"; do',
      '      kjemo_examiner_groupe "${kjemo_g}" \'secondaire\'',
      '    done',
      '  done <<< "${KJEMO_SECS}"',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - L INTERPRETEUR EXISTE-T-IL ?',
      '#',
      '# useradd accepte un shell inexistant sans broncher : le compte est cree',
      '# et aucune connexion ne fonctionne, avec un message qui ne nomme pas la',
      '# cause.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SHELL_OK=0',
      'if [ -x "${KJEMO_SHELL}" ]; then',
      '  KJEMO_SHELL_OK=1',
      "  kjemo_resultat 'Interpreteur' \"${KJEMO_SHELL}\" 'OK' 'present et executable' ''",
      '  if [ -r /etc/shells ] && ! grep -qxF -- "${KJEMO_SHELL}" /etc/shells; then',
      "    kjemo_resultat 'Interpreteur' '/etc/shells' 'INFO' 'non liste' \\",
      "      'Cet interpreteur n est pas dans /etc/shells. C est normal pour nologin, et c est meme ce qui empeche certains services (FTP, su) d accepter le compte.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Interpreteur' \"${KJEMO_SHELL}\" 'PROBLEME' 'absent ou non executable' \\",
      "    'useradd accepterait ce chemin sans verifier : le compte serait cree et aucune connexion ne fonctionnerait.'",
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: nom,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `creer le compte local ${nom}, sans mot de passe`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_OUTILS_OK', 'useradd, getent ou id manque.'],
          ['KJEMO_LIBRE_OK', 'Un compte de ce nom existe deja, et cet assistant ne modifie aucun compte existant.'],
          ['KJEMO_GROUPES_OK', 'Un groupe demande est inconnu, ou donne des privileges.'],
          ['KJEMO_SHELL_OK', 'L interpreteur de connexion est absent ou non executable.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom du compte.'],
        ],
        action: 'la creation du compte',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LA CREATION',
      '#',
      '# Les arguments passent par un TABLEAU, construit option par option :',
      '# aucune chaine assemblee, donc aucun espace manquant ni guillemet',
      '# oublie autour d un nom complet qui contient une espace.',
      '#',
      '# Ce qui n y est PAS : -p (un mot de passe hache sur la ligne de',
      '# commande, visible dans ps et dans l historique), -u (un UID impose),',
      '# -o (autoriser un UID en doublon), et -r (compte systeme).',
      '# ---------------------------------------------------------------------------',
      '  kjemo_cmd=(useradd)',
      '  if [ "${KJEMO_HOME}" = \'Oui\' ]; then',
      '    kjemo_cmd+=(--create-home)',
      '  else',
      '    kjemo_cmd+=(--no-create-home)',
      '  fi',
      '  kjemo_cmd+=(--shell "${KJEMO_SHELL}")',
      '  if [ -n "${KJEMO_GP}" ]; then',
      '    kjemo_cmd+=(--gid "${KJEMO_GP}")',
      '  fi',
      '  if [ -n "${KJEMO_SECS}" ]; then',
      '    kjemo_cmd+=(--groups "${KJEMO_SECS}")',
      '  fi',
      '  if [ -n "${KJEMO_COMMENTAIRE}" ]; then',
      '    kjemo_cmd+=(--comment "${KJEMO_COMMENTAIRE}")',
      '  fi',
      '  kjemo_cmd+=(-- "${KJEMO_NOM}")',
      '',
      "  printf '%s\\n' 'Creation du compte...'",
      '  kjemo_code=0',
      '  "${kjemo_cmd[@]}" > "${KJEMO_TMP}/useradd.out" 2>&1 || kjemo_code=$?',
      '  if [ "${kjemo_code}" -ne 0 ]; then',
      "    kjemo_resultat 'Creation' \"${KJEMO_NOM}\" 'PROBLEME' \"code ${kjemo_code}\" \\",
      "      'useradd a echoue. Rien n a ete cree, ou le compte est partiellement cree : la relecture ci-dessous le dit.'",
      "    printf '%s\\n' 'ARRET : useradd a echoue.' >&2",
      '    cat "${KJEMO_TMP}/useradd.out" >&2',
      '    # useradd est atomique sur /etc/passwd, mais le dossier personnel',
      '    # peut avoir ete cree avant l echec : on le DIT au lieu de supposer.',
      '    printf \'%s\\n\' "Verifie : getent passwd ${KJEMO_NOM} et ls -ld /home/${KJEMO_NOM}" >&2',
      '    exit 1',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - LA RELECTURE DECIDE',
      '# ---------------------------------------------------------------------------',
      '  KJEMO_LIGNE="$(getent passwd "${KJEMO_NOM}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_LIGNE}" ]; then',
      "    kjemo_resultat 'Relecture' \"${KJEMO_NOM}\" 'PROBLEME' 'absent de getent' \\",
      "      'useradd a rendu 0 mais le compte ne se relit pas. Ne conclus pas qu il existe.'",
      "    printf '%s\\n' 'ARRET : useradd a rendu 0 et le compte ne se relit pas.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Relecture' 'etc/passwd' 'OK' \"${KJEMO_LIGNE}\" \\",
      "    'Les sept champs : nom, mot de passe (toujours x, le vrai est dans /etc/shadow), UID, GID, commentaire, dossier personnel, interpreteur.'",
      '  KJEMO_ID="$(id "${KJEMO_NOM}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Relecture' 'Appartenances' 'OK' \"${KJEMO_ID}\" \\",
      "    'uid, gid du groupe principal, puis TOUS les groupes. Un groupe principal n apparait pas dans la liste des membres du groupe, et pourtant il compte : c est ici qu on le verifie.'",
      '  KJEMO_UID_N="$(printf \'%s\' "${KJEMO_LIGNE}" | cut -d: -f3)"',
      '  if [ "${KJEMO_UID_N}" = \'0\' ]; then',
      "    kjemo_resultat 'Relecture' 'UID' 'PROBLEME' '0' \\",
      "      'Ce compte a l UID 0 : c est un compte root qui ne s appelle pas root. Cet assistant n a aucun champ pour le demander ; si cela arrive, la machine a une configuration de useradd a examiner (/etc/login.defs).'",
      '  else',
      "    kjemo_resultat 'Relecture' 'UID' 'OK' \"${KJEMO_UID_N}\" ''",
      '  fi',
      '  KJEMO_DOSSIER="$(printf \'%s\' "${KJEMO_LIGNE}" | cut -d: -f6)"',
      '  if [ "${KJEMO_HOME}" = \'Oui\' ]; then',
      '    if [ -d "${KJEMO_DOSSIER}" ]; then',
      '      KJEMO_MODE_H="$(stat -c \'%a %U %G\' -- "${KJEMO_DOSSIER}" 2>/dev/null || true)"',
      "      kjemo_resultat 'Relecture' 'Dossier personnel' 'OK' \"${KJEMO_DOSSIER} (${KJEMO_MODE_H})\" \\",
      "        'Le mode vient de HOME_MODE ou de UMASK dans /etc/login.defs. En 755, les autres comptes peuvent LIRE ce dossier : si ce n est pas voulu, c est a l assistant de permissions de le corriger, pas a celui-ci.'",
      '      case "${KJEMO_MODE_H}" in',
      '        75*|77*)',
      "          kjemo_resultat 'Relecture' 'Dossier lisible par tous' 'ATTENTION' \"${KJEMO_MODE_H}\" \\",
      "            'Tout compte de la machine peut lire ce dossier personnel. Sur un serveur partage, 750 ou 700 est souvent plus juste.'",
      '          ;;',
      '      esac',
      '    else',
      "      kjemo_resultat 'Relecture' 'Dossier personnel' 'PROBLEME' \"${KJEMO_DOSSIER} absent\" \\",
      "        'La creation du dossier a ete demandee et il n existe pas. Une connexion demarrerait dans un dossier inexistant.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'Relecture' 'Dossier personnel' 'INFO' 'non cree, comme demande' \\",
      "      'Sans dossier personnel, une session s ouvre dans / et beaucoup de programmes echouent a ecrire leur configuration.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - LE COMPTE EST VERROUILLE, ET C EST VOULU',
      '#',
      '# passwd -S lit l etat du mot de passe sans jamais le montrer : « L »',
      '# pour verrouille, « P » pour un mot de passe utilisable, « NP » pour',
      '# aucun mot de passe. On le relit pour le DIRE, pas pour le changer.',
      '# ---------------------------------------------------------------------------',
      '  if kjemo_dispo passwd; then',
      '    KJEMO_ETAT_MDP="$(passwd -S "${KJEMO_NOM}" 2>/dev/null || true)"',
      "    kjemo_resultat 'Mot de passe' 'Etat' 'ATTENTION' \"${KJEMO_ETAT_MDP}\" \\",
      "      'Le deuxieme champ dit L (verrouille), NP (aucun mot de passe) ou P (utilisable). Tant qu il n est pas P, aucune connexion par mot de passe n est possible — et c est l etat voulu a la sortie de cet assistant.'",
      '  fi',
      '  printf \'\\n%s\\n\' "Compte ${KJEMO_NOM} cree, et VERROUILLE."',
      '  printf \'%s\\n\' "Pour le rendre utilisable : sudo passwd ${KJEMO_NOM}"',
      "  printf '%s\\n' 'Cet assistant ne le fait pas, et ne stocke aucun mot de passe.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-compte-creation' }),
    ]);
  },

  gui: [
    'Vérifie que le nom est libre : « getent passwd etudiant » ne doit rien afficher.',
    'Crée les groupes d’abord s’il en manque : « sudo groupadd partage ».',
    'Crée le compte : « sudo useradd --create-home --shell /bin/bash --groups partage etudiant ».',
    'Ne mets JAMAIS de mot de passe sur la ligne de commande : « -p » attend un hachage, il reste dans l’historique et dans « ps ».',
    'Pose le mot de passe en interactif : « sudo passwd etudiant ».',
    'Relis le résultat : « getent passwd etudiant » puis « id etudiant ».',
    'Vérifie l’état du mot de passe sans le voir : « sudo passwd -S etudiant ». Le deuxième champ doit être P pour que la connexion soit possible.',
    'Vérifie le dossier personnel : « ls -ld /home/etudiant ». En 755, tous les comptes peuvent le lire.',
    'Pour donner sudo — et seulement si c’est vraiment voulu : « sudo usermod -aG sudo etudiant ». Le « -a » est obligatoire, sinon les autres groupes sont REMPLACÉS.',
  ],

  keywords: ['useradd', 'adduser', 'compte', 'utilisateur', 'user', 'groupe',
    'groupadd', 'usermod', 'passwd', 'shadow', 'home', 'nologin', 'shell',
    'getent', 'id', 'verrouille', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Le nom du compte à créer, et la certitude qu’il n’existe pas déjà.',
    'Les groupes voulus, qui doivent DÉJÀ exister : « sudo groupadd equipe ».',
    'sudo, ou une session root.',
    'Un accès interactif pour poser le mot de passe ensuite : « sudo passwd <compte> ».',
  ],

  commonErrors: [
    {
      message: 'useradd: le groupe « partage » n’existe pas',
      code: 'KJEMO',
      cause: 'Un des groupes de la liste -G est inconnu. useradd échoue alors sans rien créer, même si les autres groupes existent.',
      fix: 'Créer le groupe, ou le retirer de la liste. L’assistant vérifie chaque nom avant d’agir.',
      command: 'sudo groupadd partage',
    },
    {
      message: 'useradd: l’utilisateur « etudiant » existe déjà',
      code: 'KJEMO',
      cause: 'Le compte est déjà là.',
      fix: 'Ne pas « corriger » avec usermod : il écraserait le shell, le groupe principal ou le dossier personnel existants. Choisir un autre nom, ou agir à la main en sachant ce qu’on remplace.',
      command: 'getent passwd etudiant',
    },
    {
      message: 'Le compte est créé mais la connexion est refusée sans message clair',
      code: 'KJEMO',
      cause: 'Aucun mot de passe n’a encore été posé : le compte est verrouillé. C’est l’état voulu à la sortie de l’assistant.',
      fix: 'Poser le mot de passe en interactif.',
      command: 'sudo passwd etudiant',
    },
    {
      message: 'J’ai fait « usermod -G sudo etudiant » et il a perdu ses autres groupes',
      code: 'KJEMO',
      cause: '« -G » REMPLACE la liste des groupes secondaires. Sans « -a », tout le reste disparaît.',
      fix: 'Toujours « usermod -aG ». Et vérifier ensuite avec id.',
      command: 'id etudiant',
    },
    {
      message: 'Le dossier personnel n’a pas été créé',
      code: 'KJEMO',
      cause: 'useradd ne crée pas le dossier personnel par défaut sur Debian et Ubuntu quand CREATE_HOME n’est pas activé dans /etc/login.defs : il faut « -m ».',
      fix: 'L’assistant passe toujours --create-home ou --no-create-home explicitement, et relit le résultat.',
      command: 'ls -ld /home/etudiant',
    },
  ],

  reversible: true,
  verifyAfter: [
    '« getent passwd <compte> » rend une ligne à sept champs, avec le bon dossier personnel et le bon interpréteur.',
    '« id <compte> » montre le groupe principal et tous les groupes secondaires demandés — et aucun autre.',
    '« sudo passwd -S <compte> » montre L ou NP tant que le mot de passe n’a pas été posé : c’est l’état attendu à la sortie du script.',
    '« ls -ld /home/<compte> » montre un dossier appartenant au compte. Si le mode est 755, tous les comptes de la machine peuvent le lire.',
    'Le script n’a écrit aucun mot de passe : « grep -i passwd <script>.sh » ne montre que des commandes de LECTURE (passwd -S) et le rappel de la commande interactive.',
  ],

  rollback: {
    summary: 'Réversible, mais la suppression d’un compte n’est pas une opération anodine : le dossier personnel contient peut-être le seul exemplaire d’un travail. L’assistant ne supprime rien ; la commande est donnée, avec les deux variantes et ce qui les distingue.',
    diagnostic: `# Le compte existe-t-il, et que possede-t-il :
getent passwd etudiant
id etudiant
sudo find / -xdev -user etudiant -print 2>/dev/null | head -20`,
    command: `# 1. Verifier AVANT de supprimer ce que le compte possede ailleurs que
#    dans son dossier personnel : ces fichiers se retrouveraient sans
#    proprietaire (un UID orphelin), ce qui se repere mal plus tard.
sudo find / -xdev -user etudiant -print 2>/dev/null | head -50

# 2. Supprimer le compte en GARDANT son dossier personnel :
sudo userdel etudiant

# 3. Ou supprimer le compte ET son dossier personnel. IRREVERSIBLE :
#    sudo userdel --remove etudiant

# 4. Retirer le groupe personnel s il est reste et qu il est vide :
#    getent group etudiant
#    sudo groupdel etudiant

# 5. Verifier :
getent passwd etudiant || echo 'Compte supprime.'`,
    warning: '« userdel --remove » efface le dossier personnel sans confirmation et sans corbeille. Et un compte supprimé laisse derrière lui les fichiers qu’il possédait ailleurs : ils apparaissent alors avec un UID numérique sans nom, et si un nouveau compte reçoit cet UID, il hérite silencieusement de ces fichiers.',
  },

  checks: [
    'Aucun champ de mot de passe dans le formulaire, et aucun mot de passe ni hachage dans le script généré : ni « useradd -p », ni « chpasswd », ni « passwd » en écriture.',
    'Le compte est créé verrouillé, et le script le DIT, avant et après, avec la commande interactive à lancer.',
    'Un compte existant fait refuser l’opération : aucune « mise à jour » par usermod n’est proposée.',
    'Un groupe homonyme du compte est signalé : useradd ne pourrait pas créer le groupe personnel habituel.',
    'Chaque groupe demandé est vérifié séparément : useradd -G échoue en bloc si un seul manque.',
    'Les groupes privilégiés (sudo, adm, shadow, wheel, docker, lxd, disk, kvm, libvirt, root) sont refusés, en principal comme en secondaire.',
    'Aucun champ ne permet de choisir l’UID, et ni -u ni -o n’apparaissent dans le script.',
    'Le commentaire est refusé s’il contient « : » ou un retour à la ligne : ce sont les séparateurs de /etc/passwd.',
    'L’interpréteur est vérifié présent et exécutable : useradd l’accepterait sans contrôle.',
    'Les arguments de useradd passent par un tableau, avec « -- » avant le nom du compte.',
    'Le résultat est relu par getent et par id, et un UID 0 relu serait signalé comme PROBLEME.',
    'Le mode du dossier personnel est relu et commenté : 755 laisse tous les comptes le lire.',
    'Aucune suppression de compte, aucune écriture dans /etc/sudoers : les deux sont décrites dans la fiche, à faire à la main.',
  ],

  source: `${M}/man8/useradd.8.html`,
  sources: [
    { label: 'useradd(8)', url: `${M}/man8/useradd.8.html` },
    { label: 'usermod(8)', url: `${M}/man8/usermod.8.html` },
    { label: 'groupadd(8)', url: `${M}/man8/groupadd.8.html` },
    { label: 'adduser(8) — la variante Debian de haut niveau', url: `${M}/man8/adduser.8.html` },
    { label: 'login.defs(5) — CREATE_HOME, HOME_MODE, UMASK', url: `${M}/man5/login.defs.5.html` },
    { label: 'passwd(5) — les sept champs de /etc/passwd', url: `${M}/man5/passwd.5.html` },
    { label: 'getent(1)', url: `${M}/man1/getent.1.html` },
    { label: 'sudoers(5) — pourquoi ce fichier ne s’écrit pas par script', url: `${M}/man5/sudoers.5.html` },
  ],
};

export const toolsLinuxG = [
  linuxPermissionAudit,
  linuxPermissionChange,
  linuxPermissionAcl,
  linuxUserCreate,
];
