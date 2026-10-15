/**
 * outils-linux-e.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Stockage Linux — LES QUOTAS DISQUE.
 *
 * Deux assistants, et c'est deliberé : ils n'ont PAS le meme niveau de risque,
 * et les fondre donnerait une fiche dont le risque serait faux dans la moitie
 * des usages.
 *
 *   linux-quota-enable  touche /etc/fstab et demande un remontage. Si la
 *                       ligne est fautive, le prochain demarrage peut basculer
 *                       en mode de secours. Risque : attention.
 *   linux-quota-limits  pose une limite a un utilisateur ou un groupe. Aucun
 *                       fichier de configuration n'est touche, et la valeur
 *                       precedente se remet. Risque : attention aussi, mais
 *                       d'un ordre tout autre — rien ne casse le demarrage.
 *
 * ---------------------------------------------------------------------------
 * LES NOTES DE COURS, ET CE QU'IL FAUT EN CORRIGER
 * ---------------------------------------------------------------------------
 * Les notes contenaient :
 *
 *     df /testMontage
 *     findmnt /testMontage
 *     quotacheck -c /testMontage
 *     quotaon /testMontage
 *     edquota -u blaise
 *     edquota -g groupe
 *
 * La sequence est juste, et l'ordre aussi. Trois choses manquent ou trompent,
 * et elles sont corrigees ici sans etre cachees :
 *
 *   1. « quotacheck -c » seul ne suffit pas. `-c` cree les fichiers de
 *      comptabilite, mais sans `-u` ni `-g` il ne sait pas LESQUELS creer.
 *      La forme utile est `quotacheck -cug <montage>`, et elle demande que le
 *      systeme de fichiers soit monte avec `usrquota` et/ou `grpquota` —
 *      c'est-a-dire que /etc/fstab ait deja ete modifie et le montage rafraichi.
 *      Sauter cette etape fait echouer quotacheck avec un message obscur.
 *
 *   2. « udquota » n'existe pas. Ce n'est pas une variante ni un alias : la
 *      commande s'appelle `edquota`, et elle ouvre un EDITEUR.
 *
 *   3. `edquota` est interactif. Dans un script automatise, elle attendrait
 *      une saisie que personne ne fera, et le script resterait bloque — ou,
 *      pire, `EDITOR` serait detourne pour ecrire a sa place, ce qui est un
 *      procede qu'on ne met pas dans un script pedagogique. L'equivalent non
 *      interactif est `setquota`, qui prend les quatre limites en arguments.
 *
 *      Les deux sont donc presentes, et clairement separees : `setquota` dans
 *      le script, `edquota` dans la fiche, comme methode a la main. Dire
 *      « ceci est votre edquota » a propos d'un `setquota` serait faux ; le
 *      montrer a cote est pedagogique.
 *
 * ---------------------------------------------------------------------------
 * LES UNITES, QUI FONT LA MOITIE DES ERREURS DE QUOTA
 * ---------------------------------------------------------------------------
 * `setquota` compte en BLOCS de 1 Kio, pas en megaoctets. Une limite saisie
 * « 500 » en croyant parler de mega donne 500 Kio, soit mille fois moins que
 * prevu — et l'utilisateur est bloque le jour meme. Le formulaire demande donc
 * une unite EXPLICITE, la conversion est faite dans le generateur, et le
 * script AFFICHE les deux valeurs : celle saisie et celle transmise.
 *
 * Aucun module de ce fichier n'importe generators.mjs : meme discipline qu'aux
 * lots precedents, pour eviter un cycle ESM.
 */

import { assertValid } from './noyau.mjs';
import {
  shQuote, assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocParametresBash, blocVariablesBash, blocRapportBash, blocPrivilegesBash,
} from './noyau-bash.mjs';
import {
  blocGardienChemin, blocSauvegardeFichier, blocConfirmation, blocPorteFinale,
} from './gardes-bash.mjs';
import {
  validateCheminAbsolu, validateChoix, validateEntierBorne,
  validateNomUtilisateur, validateNomGroupe,
} from './validateurs-linux.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';
const DOC_UBUNTU = 'https://documentation.ubuntu.com/server/how-to/filesystems-and-storage';

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

/**
 * Les points de montage qu'on refuse d'equiper de quotas depuis cet assistant.
 *
 * La racine n'est pas interdite par principe — des quotas sur / existent — mais
 * elle l'est ICI : un fstab fautif sur la ligne de la racine ne se repare pas
 * depuis un systeme qui ne demarre plus, et cet assistant ne peut pas garantir
 * un acces de secours. Les autres sont des systemes de fichiers virtuels ou
 * systeme, ou la question ne se pose pas.
 */
const MONTAGES_REFUSES = ['/', '/boot', '/boot/efi', '/etc', '/usr', '/var', '/bin', '/sbin',
  '/lib', '/lib64', '/dev', '/proc', '/sys', '/run', '/tmp'];

function validerMontageQuota(v, label = 'Le point de montage') {
  const base = validateCheminAbsolu(v, label);
  if (!base.ok) return base;
  const p = String(v).trim().replace(/\/+$/, '') || '/';
  if (MONTAGES_REFUSES.includes(p)) {
    return {
      ok: false,
      value: p,
      error: `« ${p} » est refusé par cet assistant. Un /etc/fstab fautif sur une ligne système ne se répare pas depuis une machine qui ne démarre plus, et cet assistant ne peut pas garantir qu’un accès de secours existe. Équipe un système de fichiers DÉDIÉ aux données, par exemple /srv/donnees.`,
    };
  }
  return { ok: true, value: p };
}

/** Conversion explicite vers les blocs de 1 Kio que `setquota` attend. */
const FACTEUR_UNITE = { Kio: 1, Mio: 1024, Gio: 1024 * 1024 };

// ===========================================================================
// ASSISTANT 1 — ACTIVER LES QUOTAS SUR UN SYSTÈME DE FICHIERS
// ===========================================================================

const linuxQuotaEnable = {
  id: 'linux-quota-enable',
  icon: '▲',
  category: CAT,
  subcategory: 'Stockage Linux',
  title: 'Activer les quotas disque sur un système de fichiers',
  risk: 'caution',
  summary: 'Ajoute usrquota et/ou grpquota à la ligne /etc/fstab d’un système de fichiers dédié, après validation d’une copie temporaire, puis initialise la comptabilité avec quotacheck et l’active avec quotaon. Refuse la racine et tout point de montage système.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'quota — quotacheck, quotaon, quotaoff, repquota, setquota, edquota (apt install quota)',
    'util-linux — findmnt (présent par défaut)',
    'coreutils — df (présent par défaut)',
  ],
  privileges: 'root — /etc/fstab, quotacheck et quotaon demandent les droits administrateur',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'Refuse la racine et tout point de montage système : un /etc/fstab fautif sur une ligne système ne se répare pas depuis une machine qui ne démarre plus.',
    'N’équipe qu’un système de fichiers DÉJÀ monté et déclaré dans /etc/fstab : cet assistant ne crée ni partition ni montage.',
    'ext4 et xfs ne gèrent pas les quotas de la même façon. Sur xfs, les options se passent au montage et quotacheck n’est pas utilisé : cet assistant traite ext2/ext3/ext4 et REFUSE xfs plutôt que de produire une procédure fausse.',
    'Ne crée aucune limite. Activer la comptabilité et poser une limite sont deux actes distincts : les limites se posent avec l’assistant « Poser une limite de quota ».',
    'Ne redémarre pas la machine. Le remontage suffit, et le redémarrage reste une décision humaine.',
  ],

  fields: [
    {
      id: 'pointMontage',
      label: 'Point de montage à équiper',
      type: 'text',
      default: '/srv/donnees',
      placeholder: '/srv/donnees',
      help: 'Un système de fichiers dédié aux données, déjà monté et déjà présent dans /etc/fstab. La racine et les points de montage système sont refusés.',
    },
    {
      id: 'portee',
      label: 'Quotas à activer',
      type: 'select',
      default: 'Les deux',
      options: [
        ['Utilisateurs', 'Utilisateurs seulement (usrquota)'],
        ['Groupes', 'Groupes seulement (grpquota)'],
        ['Les deux', 'Utilisateurs et groupes (usrquota,grpquota)'],
      ],
      help: 'usrquota compte par utilisateur, grpquota par groupe. Les deux peuvent coexister, et c’est le cas le plus courant.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le point de montage exact',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: '/srv/donnees',
      help: 'Laisse vide pour obtenir un script qui DIAGNOSTIQUE sans rien écrire. Pour autoriser la modification de /etc/fstab, retape ici exactement le même point de montage.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const mp = validerMontageQuota(v.pointMontage);
    if (!mp.ok) errors.pointMontage = mp.error;

    const p = validateChoix(v.portee, ['Utilisateurs', 'Groupes', 'Les deux'], 'La portée');
    if (!p.ok) errors.portee = p.error;

    const conf = String(v.confirmation ?? '').trim();
    const cible = String(v.pointMontage ?? '').trim().replace(/\/+$/, '');
    if (conf !== '' && conf.replace(/\/+$/, '') !== cible) {
      errors.confirmation = `La confirmation ne correspond pas au point de montage. Retape exactement : ${cible} — ou laisse vide pour obtenir un script qui diagnostique sans écrire.`;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const mp = String(v.pointMontage).trim().replace(/\/+$/, '');
    const portee = String(v.portee);
    const options = portee === 'Utilisateurs' ? 'usrquota'
      : portee === 'Groupes' ? 'grpquota' : 'usrquota,grpquota';
    const drapeauxCheck = portee === 'Utilisateurs' ? '-cum'
      : portee === 'Groupes' ? '-cgm' : '-cugm';

    return assemblerSh([
      ...enteteBash({
        titre: 'Activer les quotas disque sur un systeme de fichiers dedie',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: '/etc/fstab appartient a root, et quotacheck ouvre le systeme de fichiers',
      }),
      ...blocGardienChemin({ lectureSeule: false }),
      ...blocSauvegardeFichier(),
      ...blocVariablesBash([
        ['KJEMO_MP', shQuote(mp)],
        ['KJEMO_PORTEE', shQuote(portee)],
        ['KJEMO_OPTIONS', shQuote(options)],
        ['KJEMO_CHECK_FLAGS', shQuote(drapeauxCheck)],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
        ['KJEMO_FSTAB', shQuote('/etc/fstab')],
      ]),
      ...blocParametresBash([
        ['Point de montage', '${KJEMO_MP}'],
        ['Portee', '${KJEMO_PORTEE}'],
        ['Options fstab ajoutees', '${KJEMO_OPTIONS}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LE PAQUET ET LES COMMANDES',
      '#',
      '# Sur Ubuntu et Debian, le paquet s appelle « quota ». Il fournit',
      '# quotacheck, quotaon, quotaoff, repquota, setquota et edquota. Verifier',
      '# maintenant evite de modifier /etc/fstab puis de decouvrir que la',
      '# comptabilite ne peut pas etre initialisee.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      'for kjemo_o in quotacheck quotaon quotaoff repquota setquota findmnt; do',
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' \\",
      "      'Installe le paquet quota : apt install quota'",
      '  fi',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE MONTAGE EXISTE-T-IL VRAIMENT ?',
      '#',
      '# findmnt lit l ETAT, df confirme qu il repond. /etc/fstab, lui, dit',
      '# l INTENTION : les trois peuvent differer, et c est precisement quand ils',
      '# different qu on se trompe. On exige les trois : monte maintenant, lisible,',
      '# et declare dans fstab — sans ligne dans fstab, il n y a rien a modifier.',
      '# ---------------------------------------------------------------------------',
      '# Le gardien de chemin passe AVANT tout le reste : il canonise le chemin',
      '# et refuse les racines protegees. Le formulaire a deja refuse la racine et',
      '# les points de montage systeme, mais un script peut etre relu, modifie a',
      '# la main, puis execute : la garde doit vivre la ou l action a lieu.',
      '#',
      '# On travaille ensuite sur la forme CANONIQUE : sans cela,',
      '# « /srv/../srv/donnees » et « /srv/donnees » designeraient le meme montage',
      '# sous deux noms, et la ligne de fstab ne serait pas reconnue.',
      'kjemo_exiger_chemin_sur "${KJEMO_MP}"',
      'KJEMO_MP="${KJEMO_CHEMIN_CANON}"',
      '',
      'KJEMO_MONTAGE_OK=0',
      'KJEMO_SOURCE_FS=\'\'',
      'KJEMO_TYPE_FS=\'\'',
      'if ! findmnt --mountpoint "${KJEMO_MP}" > /dev/null 2>&1; then',
      "  kjemo_resultat 'Montage' \"${KJEMO_MP}\" 'PROBLEME' 'non monte' \\",
      "    'Rien n est monte sur ce point. Monte le systeme de fichiers d abord : les quotas s activent sur un montage existant.'",
      'else',
      '  KJEMO_SOURCE_FS="$(findmnt -n -o SOURCE --mountpoint "${KJEMO_MP}" 2>/dev/null || true)"',
      '  KJEMO_TYPE_FS="$(findmnt -n -o FSTYPE --mountpoint "${KJEMO_MP}" 2>/dev/null || true)"',
      '  kjemo_opts_fs="$(findmnt -n -o OPTIONS --mountpoint "${KJEMO_MP}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Montage' \"${KJEMO_MP}\" 'OK' \"${KJEMO_SOURCE_FS}, ${KJEMO_TYPE_FS}\" \\",
      '    "Options actuelles : ${kjemo_opts_fs}"',
      '  if df -h -- "${KJEMO_MP}" > /dev/null 2>&1; then',
      '    kjemo_libre="$(df -h --output=avail -- "${KJEMO_MP}" 2>/dev/null | tail -n 1 | tr -d \' \' || true)"',
      "    kjemo_resultat 'Montage' 'Espace disponible' 'INFO' \"${kjemo_libre}\" \\",
      "      'Les fichiers de comptabilite des quotas sont petits, mais ils s ecrivent sur ce systeme de fichiers.'",
      '  fi',
      '  if grep -qE "[[:space:]]${KJEMO_MP}[[:space:]]" "${KJEMO_FSTAB}"; then',
      '    KJEMO_MONTAGE_OK=1',
      "    kjemo_resultat 'Montage' 'Ligne dans /etc/fstab' 'OK' 'trouvee' \\",
      "      'C est cette ligne qui recevra les options de quota.'",
      '  else',
      "    kjemo_resultat 'Montage' 'Ligne dans /etc/fstab' 'PROBLEME' 'absente' \\",
      "      'Ce montage n est pas declare dans /etc/fstab : il a ete monte a la main. Ajoute-le d abord de facon persistante, sinon les quotas disparaitront au redemarrage.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE SYSTEME DE FICHIERS SAIT-IL FAIRE DES QUOTAS ?',
      '#',
      '# ext2, ext3 et ext4 utilisent quotacheck et les fichiers aquota.*. xfs',
      '# fonctionne AUTREMENT : ses quotas s activent par des options de montage',
      '# et quotacheck ne s y applique pas. Produire la procedure ext4 pour un xfs',
      '# donnerait une suite de commandes qui echouent une a une.',
      '#',
      '# Cet assistant REFUSE donc xfs, et le dit, plutot que de pretendre.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_FS_OK=0',
      'case "${KJEMO_TYPE_FS}" in',
      '  ext2|ext3|ext4)',
      '    KJEMO_FS_OK=1',
      "    kjemo_resultat 'Systeme de fichiers' \"${KJEMO_TYPE_FS}\" 'OK' 'quotas pris en charge' \\",
      "      'quotacheck et les fichiers aquota.user/aquota.group s appliquent.'",
      '    ;;',
      '  xfs)',
      "    kjemo_resultat 'Systeme de fichiers' 'xfs' 'PROBLEME' 'non traite ici' \\",
      "      'xfs gere ses quotas par options de montage, sans quotacheck. Cet assistant ne traite pas xfs : il refuse plutot que de produire une procedure fausse.'",
      '    ;;',
      '  \'\')',
      "    kjemo_resultat 'Systeme de fichiers' 'inconnu' 'PROBLEME' 'non determine' \\",
      "      'Le type n a pas pu etre lu : le montage est probablement absent.'",
      '    ;;',
      '  *)',
      "    kjemo_resultat 'Systeme de fichiers' \"${KJEMO_TYPE_FS}\" 'PROBLEME' 'non traite' \\",
      "      'Seuls ext2, ext3 et ext4 sont traites par cet assistant.'",
      '    ;;',
      'esac',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LES OPTIONS SONT-ELLES DEJA LA ?',
      '#',
      '# Ajouter « usrquota » a une ligne qui le porte deja donnerait',
      '# « usrquota,usrquota » : accepte par mount, mais sale, et le prochain',
      '# lecteur se demandera ce qui s est passe. Si tout est deja en place, on',
      '# le DIT et on ne touche pas au fichier.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_DEJA=0',
      'kjemo_ligne="$(grep -E "[[:space:]]${KJEMO_MP}[[:space:]]" "${KJEMO_FSTAB}" 2>/dev/null | head -n 1 || true)"',
      'if [ -n "${kjemo_ligne}" ]; then',
      '  kjemo_manque=0',
      '  case "${KJEMO_PORTEE}" in',
      "    'Utilisateurs'|'Les deux')",
      '      case "${kjemo_ligne}" in *usrquota*) : ;; *) kjemo_manque=1 ;; esac ;;',
      '  esac',
      '  case "${KJEMO_PORTEE}" in',
      "    'Groupes'|'Les deux')",
      '      case "${kjemo_ligne}" in *grpquota*) : ;; *) kjemo_manque=1 ;; esac ;;',
      '  esac',
      '  if [ "${kjemo_manque}" -eq 0 ]; then',
      '    KJEMO_DEJA=1',
      "    kjemo_resultat 'fstab' 'Options de quota' 'OK' 'deja presentes' \\",
      "      'La ligne porte deja les options demandees. /etc/fstab ne sera pas modifie ; la suite verifiera seulement l etat de la comptabilite.'",
      '  else',
      "    kjemo_resultat 'fstab' 'Options de quota' 'INFO' 'a ajouter' \\",
      '      "Ligne actuelle : ${kjemo_ligne}"',
      '  fi',
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: mp,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `modifier /etc/fstab pour ${mp} puis activer les quotas`,
      }),

      ...blocPorteFinale({
        conditions: [
          ['KJEMO_OUTILS_OK', 'Le paquet quota est absent : apt install quota.'],
          ['KJEMO_MONTAGE_OK', 'Le point de montage n est pas monte, ou n est pas declare dans /etc/fstab.'],
          ['KJEMO_FS_OK', 'Le systeme de fichiers n est pas un ext2/ext3/ext4.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le point de montage.'],
        ],
        action: 'l activation des quotas',
      }),

      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - /etc/fstab : COPIE, MODIFICATION DE LA COPIE, VALIDATION',
      '#',
      '# Le fichier reel n est touche qu apres qu une copie equivalente a ete',
      '# declaree valide par findmnt --verify. Et la sauvegarde vient APRES la',
      '# validation : inutile de sauvegarder un fichier qu on ne modifiera pas.',
      '# ---------------------------------------------------------------------------',
      '  if [ "${KJEMO_DEJA}" -eq 1 ]; then',
      "    kjemo_resultat 'fstab' 'Modification' 'IGNORE' 'rien a changer' \\",
      "      'Les options etaient deja presentes.'",
      '  else',
      '    kjemo_copie="${KJEMO_TMP}/fstab.essai"',
      '# Sous set -e, un cp en echec ferait sortir le script SANS un mot : la',
      '# personne verrait un script qui s arrete apres avoir annonce qu il va',
      '# modifier /etc/fstab, sans savoir si le fichier a ete touche. C est la',
      '# question la plus urgente a ce moment-la. Le banc des quotas l a mesure.',
      '    if ! cp -p -- "${KJEMO_FSTAB}" "${kjemo_copie}"; then',
      "      printf '%s\\n' 'ARRET : la copie de travail de /etc/fstab n a pas pu etre creee.' >&2",
      "      printf '%s\\n' '/etc/fstab n a PAS ete modifie : aucune ecriture n a eu lieu.' >&2",
      '      exit 1',
      '    fi',
      '',
      '# La quatrieme colonne de fstab porte les options. On ne touche QUE la',
      '# ligne du point de montage vise, et on ne touche que sa colonne 4 :',
      '# reecrire la ligne entiere risquerait de perdre un UUID ou un numero de',
      '# passe fsck.',
      '    kjemo_awk_ok=0',
      '    if awk -v mp="${KJEMO_MP}" -v opts="${KJEMO_OPTIONS}" \\',
      '      \'BEGIN { OFS="\\t" }',
      '       $0 ~ /^[[:space:]]*#/ { print; next }',
      '       NF >= 4 && $2 == mp {',
      '         n = split(opts, ajout, ",");',
      '         for (i = 1; i <= n; i++) {',
      '           if (index("," $4 ",", "," ajout[i] ",") == 0) { $4 = $4 "," ajout[i] }',
      '         }',
      '         print; next',
      '       }',
      '       { print }\' "${KJEMO_FSTAB}" > "${kjemo_copie}.nouveau" 2>/dev/null; then',
      '      kjemo_awk_ok=1',
      '    fi',
      '    if [ "${kjemo_awk_ok}" -ne 1 ] || [ ! -s "${kjemo_copie}.nouveau" ]; then',
      "      kjemo_resultat 'fstab' 'Construction de la copie' 'PROBLEME' 'echec' \\",
      "        'La copie modifiee n a pas pu etre construite. /etc/fstab n a PAS ete touche.'",
      "      printf '%s\\n' 'ARRET : la copie modifiee de /etc/fstab n a pas pu etre construite.' >&2",
      "      printf '%s\\n' '/etc/fstab n a PAS ete modifie.' >&2",
      '      exit 1',
      '    fi',
      '    mv -f -- "${kjemo_copie}.nouveau" "${kjemo_copie}"',
      '',
      '    # La modification doit avoir REELLEMENT eu lieu dans la copie.',
      '    if ! grep -E "[[:space:]]${KJEMO_MP}[[:space:]]" "${kjemo_copie}" | grep -q quota; then',
      "      kjemo_resultat 'fstab' 'Verification de la copie' 'PROBLEME' 'options absentes' \\",
      "        'Les options de quota ne figurent pas dans la copie : la ligne visee n a pas ete reconnue. /etc/fstab n a PAS ete touche.'",
      "      printf '%s\\n' 'ARRET : les options de quota ne figurent pas dans la copie modifiee.' >&2",
      "      printf '%s\\n' '/etc/fstab n a PAS ete modifie.' >&2",
      '      exit 1',
      '    fi',
      '',
      '    kjemo_code_vf=0',
      '    kjemo_sortie_vf="$(findmnt --verify --tab-file "${kjemo_copie}" 2>&1)" || kjemo_code_vf=$?',
      '    if [ "${kjemo_code_vf}" -ne 0 ]; then',
      "      kjemo_resultat 'fstab' 'Validation de la copie' 'PROBLEME' \"code ${kjemo_code_vf}\" \\",
      "        'findmnt --verify refuse la copie. /etc/fstab n a PAS ete modifie.'",
      "      printf '%s\\n' 'ARRET : findmnt --verify refuse la copie de /etc/fstab.' >&2",
      "      printf '%s\\n' '/etc/fstab n a PAS ete modifie : rien n a ete ecrit dans le fichier reel.' >&2",
      "      printf '%s\\n' '--- sortie de findmnt --verify ---' >&2",
      '      printf \'%s\\n\' "${kjemo_sortie_vf}" >&2',
      '      exit 1',
      '    fi',
      "    kjemo_resultat 'fstab' 'Validation de la copie' 'OK' 'findmnt --verify' \\",
      "      'C est seulement maintenant que le fichier reel va etre touche.'",
      '',
      '    kjemo_sauvegarder "${KJEMO_FSTAB}"',
      '',
      '    # Remplacement atomique : fichier intermediaire dans /etc, donc sur le',
      '    # MEME systeme de fichiers, puis mv. Aucun instant n existe ou',
      '    # /etc/fstab serait tronque.',
      '    kjemo_nouveau="${KJEMO_FSTAB}.kjemo-nouveau"',
      '    if ! cp -p -- "${kjemo_copie}" "${kjemo_nouveau}"; then',
      "      printf '%s\\n' 'ARRET : le fichier intermediaire n a pas pu etre ecrit dans /etc.' >&2",
      "      printf '%s\\n' '/etc/fstab n a PAS ete modifie. La sauvegarde reste disponible.' >&2",
      '      exit 1',
      '    fi',
      '    mv -f -- "${kjemo_nouveau}" "${KJEMO_FSTAB}"',
      '',
      '    if ! cmp -s -- "${KJEMO_FSTAB}" "${kjemo_copie}"; then',
      "      kjemo_resultat 'fstab' 'Relecture apres ecriture' 'PROBLEME' 'contenu different' \\",
      '        "Le fichier relu ne correspond pas a la copie validee. Restaure : cp -p ${KJEMO_SAUVEGARDE} ${KJEMO_FSTAB}"',
      "      printf '%s\\n' 'ARRET : /etc/fstab relu ne correspond pas a la copie validee.' >&2",
      '      exit 1',
      '    fi',
      "    kjemo_resultat 'fstab' 'Relecture apres ecriture' 'OK' 'identique a la copie validee' \\",
      '      "Sauvegarde conservee : ${KJEMO_SAUVEGARDE}"',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - RAFRAICHIR LE MONTAGE',
      '#',
      '# Les options de quota ne prennent effet qu au montage. « mount -o remount »',
      '# suffit et evite un redemarrage. Si le remontage echoue, on s arrete AVANT',
      '# quotacheck : initialiser une comptabilite sur un montage qui n a pas les',
      '# options donnerait une erreur obscure, et le fichier fstab est deja',
      '# sauvegarde pour revenir en arriere.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_code_rm=0',
      '  mount -o remount "${KJEMO_MP}" > "${KJEMO_TMP}/remount.out" 2>&1 || kjemo_code_rm=$?',
      '  if [ "${kjemo_code_rm}" -ne 0 ]; then',
      "    kjemo_resultat 'Remontage' \"${KJEMO_MP}\" 'PROBLEME' \"code ${kjemo_code_rm}\" \\",
      '      "Le remontage a echoue. Pour revenir en arriere : cp -p ${KJEMO_SAUVEGARDE:-<sauvegarde>} ${KJEMO_FSTAB} puis mount -o remount ${KJEMO_MP}"',
      "    printf '%s\\n' 'ARRET : le remontage a echoue. quotacheck n a PAS ete lance.' >&2",
      '    cat "${KJEMO_TMP}/remount.out" >&2',
      '    exit 1',
      '  fi',
      '  kjemo_opts_apres="$(findmnt -n -o OPTIONS --mountpoint "${KJEMO_MP}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Remontage' \"${KJEMO_MP}\" 'OK' 'remonte' \\",
      '    "Options apres remontage : ${kjemo_opts_apres}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - quotacheck : LA COMPTABILITE',
      '#',
      '# Les notes de cours ecrivaient « quotacheck -c ». Seul, -c cree les',
      '# fichiers mais ne dit pas LESQUELS : il faut -u, -g, ou les deux. Et -m',
      '# evite que quotacheck exige de remonter en lecture seule, ce qui est',
      '# impossible sur un systeme de fichiers en service.',
      '#',
      '# Si quotacheck echoue, quotaon N EST PAS lance : activer une comptabilite',
      '# dont les fichiers sont absents ou corrompus donne des chiffres faux, et',
      '# des chiffres faux sont pires que pas de chiffres.',
      '# ---------------------------------------------------------------------------',
      '  printf \'%s\\n\' \'Initialisation de la comptabilite des quotas...\'',
      '  kjemo_code_qc=0',
      '  quotacheck "${KJEMO_CHECK_FLAGS}" "${KJEMO_MP}" > "${KJEMO_TMP}/quotacheck.out" 2>&1 \\',
      '    || kjemo_code_qc=$?',
      '  if [ "${kjemo_code_qc}" -ne 0 ]; then',
      "    kjemo_resultat 'quotacheck' \"${KJEMO_MP}\" 'PROBLEME' \"code ${kjemo_code_qc}\" \\",
      "      'quotacheck a echoue. quotaon n est PAS lance : une comptabilite absente ou corrompue donnerait des chiffres faux.'",
      "    printf '%s\\n' 'ARRET : quotacheck a echoue. quotaon n a PAS ete lance.' >&2",
      '    cat "${KJEMO_TMP}/quotacheck.out" >&2',
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'quotacheck' \"${KJEMO_MP}\" 'OK' \"${KJEMO_CHECK_FLAGS}\" \\",
      "    'Les fichiers de comptabilite sont en place.'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 8 - quotaon, PUIS RELECTURE',
      '#',
      '# « quotaon a rendu 0 » ne dit pas que la comptabilite tourne. On relit avec',
      '# repquota, et c est la relecture qui decide.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_code_qo=0',
      '  quotaon -v "${KJEMO_MP}" > "${KJEMO_TMP}/quotaon.out" 2>&1 || kjemo_code_qo=$?',
      '  if [ "${kjemo_code_qo}" -ne 0 ]; then',
      "    kjemo_resultat 'quotaon' \"${KJEMO_MP}\" 'PROBLEME' \"code ${kjemo_code_qo}\" \\",
      '      "L activation a echoue. Pour revenir en arriere : quotaoff ${KJEMO_MP} puis restaurer ${KJEMO_SAUVEGARDE:-la sauvegarde de fstab}"',
      '    cat "${KJEMO_TMP}/quotaon.out" >&2',
      '    exit 1',
      '  fi',
      '  if repquota -a > "${KJEMO_TMP}/repquota.out" 2>&1 \\',
      '    || repquota "${KJEMO_MP}" > "${KJEMO_TMP}/repquota.out" 2>&1; then',
      "    kjemo_resultat 'quotaon' \"${KJEMO_MP}\" 'OK' 'comptabilite active' \\",
      "      'Confirme par repquota, et non par le code de retour de quotaon.'",
      '    kjemo_resultat \'Etat\' \'repquota\' \'INFO\' "$(head -n 12 "${KJEMO_TMP}/repquota.out")" \\',
      "      'Aucune limite n est encore posee : tous les chiffres sont a zero. Les limites se posent avec l assistant « Poser une limite de quota ».'",
      '  else',
      "    kjemo_resultat 'quotaon' \"${KJEMO_MP}\" 'PROBLEME' 'repquota muet' \\",
      "      'quotaon a rendu 0 mais repquota ne lit rien : la comptabilite n est pas reellement active.'",
      '    exit 1',
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-quota-activation' }),
    ]);
  },

  gui: [
    'Vérifie le montage : « findmnt /srv/donnees » puis « df -hT /srv/donnees ».',
    'Installe le paquet si nécessaire : « sudo apt install quota ».',
    'Sauvegarde /etc/fstab : « sudo cp -p /etc/fstab /etc/fstab.bak ».',
    'Ajoute usrquota,grpquota à la QUATRIÈME colonne de la ligne du montage, dans une COPIE du fichier.',
    'Valide la copie : « findmnt --verify --tab-file /tmp/fstab.essai ». Ne touche au fichier réel qu’après.',
    'Remonte : « sudo mount -o remount /srv/donnees », puis vérifie les options avec « findmnt -o OPTIONS /srv/donnees ».',
    'Initialise la comptabilité : « sudo quotacheck -cugm /srv/donnees ». Le « -cug » est indispensable — « -c » seul ne dit pas quels fichiers créer.',
    'Active : « sudo quotaon -v /srv/donnees », puis confirme avec « sudo repquota -a ».',
    'Pour désactiver : « sudo quotaoff /srv/donnees », puis retirer les options de /etc/fstab et remonter.',
  ],

  keywords: ['quota', 'quotas', 'disque', 'usrquota', 'grpquota', 'quotacheck', 'quotaon',
    'quotaoff', 'repquota', 'fstab', 'montage', 'ext4', 'limite', 'espace', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Un système de fichiers DÉDIÉ aux données, déjà monté et déjà déclaré dans /etc/fstab. La racine et les points de montage système sont refusés.',
    'Un système de fichiers ext2, ext3 ou ext4. xfs est refusé : il gère ses quotas autrement, et produire la procédure ext4 pour un xfs donnerait une suite de commandes qui échouent.',
    'Le paquet quota : « sudo apt install quota ».',
    'sudo, ou une session root : /etc/fstab appartient à root.',
  ],

  commonErrors: [
    {
      message: 'quotacheck: Cannot find filesystem to check or filesystem not mounted with quota option',
      code: 'KJEMO',
      cause: 'Le système de fichiers est monté SANS usrquota ni grpquota : /etc/fstab a été modifié mais le montage n’a pas été rafraîchi.',
      fix: 'Remonter avant quotacheck. C’est l’étape 6 du script, et elle est bloquante : sans remontage réussi, quotacheck n’est pas lancé.',
      command: 'sudo mount -o remount /srv/donnees && findmnt -o OPTIONS /srv/donnees',
    },
    {
      message: 'udquota : commande introuvable',
      code: 'ENOENT',
      cause: 'La commande n’existe pas. Les notes de cours contenaient cette faute de frappe.',
      fix: 'La commande s’appelle « edquota », et elle ouvre un éditeur. Pour une limite non interactive, c’est « setquota ».',
      command: 'sudo edquota -u blaise',
    },
    {
      message: 'quotacheck -c ne crée rien, ou crée seulement une partie des fichiers',
      code: 'KJEMO',
      cause: '« -c » seul ne dit pas QUELS fichiers créer : il faut « -u » pour les utilisateurs, « -g » pour les groupes.',
      fix: 'Utiliser « quotacheck -cugm ». Le « -m » évite d’exiger un remontage en lecture seule, impossible sur un système de fichiers en service.',
      command: 'sudo quotacheck -cugm /srv/donnees',
    },
    {
      message: 'La machine démarre en mode de secours après modification de /etc/fstab',
      code: 'KJEMO',
      cause: 'Une option mal écrite dans la quatrième colonne rend la ligne invalide.',
      fix: 'C’est exactement ce que la validation sur copie existe pour empêcher. Au prompt de secours : remonter la racine en écriture, restaurer la sauvegarde horodatée, redémarrer.',
      command: 'mount -o remount,rw / ; cp -p /etc/fstab.kjemo-AAAAMMJJ-HHMMSS.bak /etc/fstab',
    },
    {
      message: 'repquota ne montre aucun utilisateur',
      code: 'KJEMO',
      cause: 'La comptabilité est active mais aucune limite n’est posée, et aucun fichier n’appartient encore aux utilisateurs sur ce système de fichiers.',
      fix: 'C’est normal juste après l’activation. Les limites se posent avec l’assistant « Poser une limite de quota ».',
      command: 'sudo repquota -as',
    },
  ],

  reversible: true,
  verifyAfter: [
    '« findmnt -o OPTIONS /srv/donnees » montre usrquota et/ou grpquota.',
    '« sudo repquota -a » répond sans erreur et liste le système de fichiers.',
    'Les fichiers aquota.user et/ou aquota.group existent à la racine du montage.',
    'Une sauvegarde horodatée de /etc/fstab existe à côté du fichier.',
    '« findmnt --verify » sur le fichier réel ne signale rien.',
  ],

  rollback: {
    summary: 'Réversible. Désactiver la comptabilité, retirer les options de /etc/fstab depuis la sauvegarde horodatée, remonter. Aucune donnée utilisateur n’est touchée par cet assistant.',
    diagnostic: `# Les options actuellement en vigueur :
findmnt -o TARGET,SOURCE,FSTYPE,OPTIONS /srv/donnees
# La ligne de fstab :
grep -n '/srv/donnees' /etc/fstab
# Les sauvegardes laissees par cet assistant :
ls -l /etc/fstab.kjemo-*.bak
# L etat de la comptabilite :
sudo repquota -a`,
    command: `# 1. Desactiver la comptabilite :
sudo quotaoff -v /srv/donnees

# 2. Restaurer /etc/fstab depuis la sauvegarde horodatee :
sudo cp -p /etc/fstab.kjemo-AAAAMMJJ-HHMMSS.bak /etc/fstab
sudo findmnt --verify

# 3. Remonter sans les options de quota :
sudo mount -o remount /srv/donnees
findmnt -o OPTIONS /srv/donnees

# 4. Les fichiers de comptabilite peuvent rester : ils sont inertes une fois
#    les quotas desactives. Pour les retirer, ils sont a la racine du
#    montage, nommes aquota.user et aquota.group.
echo 'Quotas desactives et fstab restaure.'`,
    warning: 'Retirer les options de /etc/fstab sans lancer « quotaoff » d’abord laisse le noyau avec une comptabilité active sur un montage qui ne la déclare plus. Rien ne casse, mais l’état devient incompréhensible au prochain diagnostic. L’ordre compte : quotaoff, puis fstab, puis remontage.',
  },

  checks: [
    'Le point de montage est refusé s’il est la racine ou un chemin système.',
    'Le montage doit être présent dans findmnt ET déclaré dans /etc/fstab : l’état et l’intention sont vérifiés séparément.',
    'xfs est refusé explicitement, plutôt que de produire une procédure ext4 inopérante.',
    'Les options déjà présentes ne sont pas ajoutées deux fois.',
    'Seule la quatrième colonne de la ligne visée est modifiée : l’UUID et le numéro de passe fsck sont préservés.',
    '/etc/fstab est validé par findmnt --verify sur une COPIE avant toute écriture ; un échec laisse le fichier réel intact.',
    'La sauvegarde vient APRÈS la validation : on ne sauvegarde pas un fichier qu’on ne modifiera pas.',
    'Le remplacement est atomique, puis relu et comparé.',
    'Un remontage en échec arrête le script AVANT quotacheck.',
    'Un quotacheck en échec arrête le script AVANT quotaon.',
    'L’activation est confirmée par repquota, et non par le code de retour de quotaon.',
  ],

  source: `${M}/man8/quotacheck.8.html`,
  sources: [
    { label: 'quotacheck(8)', url: `${M}/man8/quotacheck.8.html` },
    { label: 'quotaon(8)', url: `${M}/man8/quotaon.8.html` },
    { label: 'repquota(8)', url: `${M}/man8/repquota.8.html` },
    { label: 'fstab(5)', url: `${M}/man5/fstab.5.html` },
    { label: 'findmnt(8)', url: `${M}/man8/findmnt.8.html` },
    { label: 'mount(8)', url: `${M}/man8/mount.8.html` },
  ],
};

// ===========================================================================
// ASSISTANT 2 — POSER UNE LIMITE DE QUOTA
// ===========================================================================

const linuxQuotaLimits = {
  id: 'linux-quota-limits',
  icon: '△',
  category: CAT,
  subcategory: 'Stockage Linux',
  title: 'Poser une limite de quota à un utilisateur ou un groupe',
  risk: 'caution',
  summary: 'Pose les limites souple et dure d’espace et d’inodes pour un utilisateur ou un groupe existant, avec setquota — non interactif — après vérification que la cible existe et que la comptabilité est active. Convertit explicitement les unités en blocs de 1 Kio et relit le résultat avec repquota.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'quota — setquota, repquota, quota, edquota (apt install quota)',
    'libc-bin — getent (présent par défaut)',
  ],
  privileges: 'root — setquota écrit dans les fichiers de comptabilité du système de fichiers',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'Ne modifie aucun fichier de configuration : les limites vivent dans les fichiers de comptabilité du système de fichiers. Rien ne peut casser le démarrage.',
    'Exige que les quotas soient DÉJÀ activés sur le point de montage. Les activer est le rôle de l’assistant « Activer les quotas disque ».',
    'Ne crée ni utilisateur ni groupe, et refuse une cible qui n’existe pas.',
    'La période de grâce est GLOBALE au système de fichiers, pas par utilisateur : cet assistant la lit et l’affiche, mais ne la change pas — la changer pour une personne la changerait pour tout le monde.',
    'N’efface aucun fichier pour faire rentrer un utilisateur sous sa limite.',
  ],

  fields: [
    {
      id: 'pointMontage',
      label: 'Point de montage',
      type: 'text',
      default: '/srv/donnees',
      placeholder: '/srv/donnees',
      help: 'Le système de fichiers où les quotas sont déjà activés.',
    },
    {
      id: 'typeCible',
      label: 'Type de cible',
      type: 'select',
      default: 'Utilisateur',
      options: [['Utilisateur', 'Un utilisateur (-u)'], ['Groupe', 'Un groupe (-g)']],
      help: 'Les deux comptabilités sont indépendantes : un fichier compte pour son propriétaire ET pour son groupe.',
    },
    {
      id: 'nomCible',
      label: 'Nom de l’utilisateur ou du groupe',
      type: 'text',
      default: 'blaise',
      placeholder: 'blaise',
      help: 'Doit exister. Le script le vérifie avec getent et refuse d’agir sinon.',
    },
    {
      id: 'unite',
      label: 'Unité des limites d’espace',
      type: 'select',
      default: 'Mio',
      options: [['Kio', 'Kio — blocs de 1 Kio, l’unité native de setquota'], ['Mio', 'Mio'], ['Gio', 'Gio']],
      help: 'setquota compte en blocs de 1 Kio. Une limite de « 500 » saisie en croyant parler de Mio donnerait 500 Kio, mille fois moins que prévu. Le script affiche les deux valeurs.',
    },
    {
      id: 'espaceSoft',
      label: 'Limite souple d’espace',
      type: 'number',
      default: '900',
      min: '0',
      max: '1048576',
      help: 'Dépassable temporairement, pendant la période de grâce. 0 signifie « aucune limite ».',
    },
    {
      id: 'espaceHard',
      label: 'Limite dure d’espace',
      type: 'number',
      default: '1000',
      min: '0',
      max: '1048576',
      help: 'Infranchissable : l’écriture est refusée. Doit être supérieure ou égale à la limite souple.',
    },
    {
      id: 'inodesSoft',
      label: 'Limite souple de fichiers (inodes)',
      type: 'number',
      default: '0',
      min: '0',
      max: '10000000',
      help: 'Nombre de fichiers. 0 signifie « aucune limite ». Utile contre les milliers de petits fichiers, qui épuisent les inodes bien avant l’espace.',
    },
    {
      id: 'inodesHard',
      label: 'Limite dure de fichiers (inodes)',
      type: 'number',
      default: '0',
      min: '0',
      max: '10000000',
      help: '0 signifie « aucune limite ». Doit être supérieure ou égale à la limite souple.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le nom de la cible',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: 'blaise',
      help: 'Laisse vide pour obtenir un script qui DIAGNOSTIQUE sans rien écrire. Pour autoriser la pose de la limite, retape ici exactement le même nom.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const mp = validateCheminAbsolu(v.pointMontage, 'Le point de montage');
    if (!mp.ok) errors.pointMontage = mp.error;

    const t = validateChoix(v.typeCible, ['Utilisateur', 'Groupe'], 'Le type de cible');
    if (!t.ok) errors.typeCible = t.error;

    const nom = String(v.nomCible ?? '').trim();
    const rn = String(v.typeCible) === 'Groupe'
      ? validateNomGroupe(nom, 'Le nom du groupe')
      : validateNomUtilisateur(nom, 'Le nom d’utilisateur');
    if (!rn.ok) errors.nomCible = rn.error;
    else if (nom === 'root') {
      errors.nomCible = 'root est refusé comme cible : un quota sur root peut empêcher le système d’écrire ses propres fichiers, et le problème est alors très difficile à diagnostiquer.';
    }

    const u = validateChoix(v.unite, ['Kio', 'Mio', 'Gio'], 'L’unité');
    if (!u.ok) errors.unite = u.error;

    const bornes = [
      ['espaceSoft', 0, 1048576, 'La limite souple d’espace'],
      ['espaceHard', 0, 1048576, 'La limite dure d’espace'],
      ['inodesSoft', 0, 10000000, 'La limite souple de fichiers'],
      ['inodesHard', 0, 10000000, 'La limite dure de fichiers'],
    ];
    for (const [champ, min, max, label] of bornes) {
      const r = validateEntierBorne(v[champ], min, max, label);
      if (!r.ok) errors[champ] = r.error;
    }

    // soft <= hard, sauf si hard vaut 0 : 0 signifie « aucune limite », donc
    // une limite souple avec une limite dure illimitée est cohérente.
    const es = Number(v.espaceSoft);
    const eh = Number(v.espaceHard);
    if (Number.isInteger(es) && Number.isInteger(eh) && eh !== 0 && es > eh) {
      errors.espaceSoft = `La limite souple (${es}) dépasse la limite dure (${eh}). La souple se dépasse temporairement, la dure jamais : une souple plus haute que la dure ne serait jamais atteinte, et la configuration n’aurait aucun sens. Mets 0 à la limite dure pour la laisser illimitée.`;
    }
    const is = Number(v.inodesSoft);
    const ih = Number(v.inodesHard);
    if (Number.isInteger(is) && Number.isInteger(ih) && ih !== 0 && is > ih) {
      errors.inodesSoft = `La limite souple de fichiers (${is}) dépasse la limite dure (${ih}). Mets 0 à la limite dure pour la laisser illimitée.`;
    }

    const conf = String(v.confirmation ?? '').trim();
    if (conf !== '' && conf !== nom) {
      errors.confirmation = `La confirmation ne correspond pas à la cible. Retape exactement : ${nom} — ou laisse vide pour obtenir un script qui diagnostique sans écrire.`;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const mp = String(v.pointMontage).trim().replace(/\/+$/, '');
    const nom = String(v.nomCible).trim();
    const estGroupe = String(v.typeCible) === 'Groupe';
    const facteur = FACTEUR_UNITE[String(v.unite)] ?? 1;
    // La conversion est faite ICI, une fois, et les deux valeurs sont
    // transmises au script pour qu'il les affiche toutes les deux.
    const blocsSoft = Number(v.espaceSoft) * facteur;
    const blocsHard = Number(v.espaceHard) * facteur;

    return assemblerSh([
      ...enteteBash({
        titre: 'Poser une limite de quota a un utilisateur ou un groupe',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'setquota ecrit dans les fichiers de comptabilite du systeme de fichiers',
      }),
      ...blocVariablesBash([
        ['KJEMO_MP', shQuote(mp)],
        ['KJEMO_TYPE', shQuote(estGroupe ? 'Groupe' : 'Utilisateur')],
        ['KJEMO_DRAPEAU', shQuote(estGroupe ? '-g' : '-u')],
        ['KJEMO_NOM', shQuote(nom)],
        ['KJEMO_UNITE', shQuote(String(v.unite))],
        ['KJEMO_ESPACE_SOFT_SAISI', shQuote(String(v.espaceSoft))],
        ['KJEMO_ESPACE_HARD_SAISI', shQuote(String(v.espaceHard))],
        ['KJEMO_BLOCS_SOFT', shQuote(String(blocsSoft))],
        ['KJEMO_BLOCS_HARD', shQuote(String(blocsHard))],
        ['KJEMO_INODES_SOFT', shQuote(String(v.inodesSoft))],
        ['KJEMO_INODES_HARD', shQuote(String(v.inodesHard))],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Point de montage', '${KJEMO_MP}'],
        ['Cible', '${KJEMO_TYPE} ${KJEMO_NOM}'],
        ['Espace souple saisi', '${KJEMO_ESPACE_SOFT_SAISI} ${KJEMO_UNITE}'],
        ['Espace dur saisi', '${KJEMO_ESPACE_HARD_SAISI} ${KJEMO_UNITE}'],
        ['Espace souple transmis', '${KJEMO_BLOCS_SOFT} blocs de 1 Kio'],
        ['Espace dur transmis', '${KJEMO_BLOCS_HARD} blocs de 1 Kio'],
        ['Inodes souple / dur', '${KJEMO_INODES_SOFT} / ${KJEMO_INODES_HARD}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# LES UNITES, QUI FONT LA MOITIE DES ERREURS DE QUOTA',
      '#',
      '# setquota compte en BLOCS DE 1 Kio, pas en megaoctets. Une limite saisie',
      '# « 500 » en croyant parler de mega donne 500 Kio : mille fois moins que',
      '# prevu, et l utilisateur est bloque le jour meme. La conversion a ete',
      '# faite a la generation, et les DEUX valeurs sont affichees ci-dessus pour',
      '# que la relecture du script la verifie.',
      '# ---------------------------------------------------------------------------',
      "kjemo_resultat 'Unites' 'Conversion' 'INFO' \\",
      '  "${KJEMO_ESPACE_SOFT_SAISI} ${KJEMO_UNITE} = ${KJEMO_BLOCS_SOFT} blocs ; ${KJEMO_ESPACE_HARD_SAISI} ${KJEMO_UNITE} = ${KJEMO_BLOCS_HARD} blocs" \\',
      "  'setquota compte en blocs de 1 Kio. Un zero signifie « aucune limite ».'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LES OUTILS',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      'for kjemo_o in setquota repquota quota getent findmnt; do',
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' \\",
      "      'Installe le paquet quota : apt install quota'",
      '  fi',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LA CIBLE EXISTE-T-ELLE ?',
      '#',
      '# setquota accepte un UID numerique inconnu sans se plaindre : la limite',
      '# est alors posee pour un identifiant qui n appartient a personne, et elle',
      '# ne protege rien. getent repond a la vraie question.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_CIBLE_OK=0',
      "if [ \"${KJEMO_TYPE}\" = 'Groupe' ]; then",
      '  if getent group -- "${KJEMO_NOM}" > /dev/null 2>&1; then',
      '    KJEMO_CIBLE_OK=1',
      '    kjemo_gid="$(getent group -- "${KJEMO_NOM}" | cut -d: -f3 || true)"',
      "    kjemo_resultat 'Cible' \"groupe ${KJEMO_NOM}\" 'OK' \"GID ${kjemo_gid}\" ''",
      '  else',
      "    kjemo_resultat 'Cible' \"groupe ${KJEMO_NOM}\" 'PROBLEME' 'inexistant' \\",
      "      'Ce groupe n existe pas. Aucune limite n est posee : une limite sur un GID inconnu ne protege rien.'",
      '  fi',
      'else',
      '  if getent passwd -- "${KJEMO_NOM}" > /dev/null 2>&1; then',
      '    KJEMO_CIBLE_OK=1',
      '    kjemo_uid="$(getent passwd -- "${KJEMO_NOM}" | cut -d: -f3 || true)"',
      "    kjemo_resultat 'Cible' \"utilisateur ${KJEMO_NOM}\" 'OK' \"UID ${kjemo_uid}\" ''",
      '  else',
      "    kjemo_resultat 'Cible' \"utilisateur ${KJEMO_NOM}\" 'PROBLEME' 'inexistant' \\",
      "      'Cet utilisateur n existe pas. Aucune limite n est posee : une limite sur un UID inconnu ne protege rien.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LA COMPTABILITE EST-ELLE ACTIVE ?',
      '#',
      '# Poser une limite sur un systeme de fichiers sans comptabilite active',
      '# « reussit » et ne protege rien : les chiffres ne sont pas comptes. On',
      '# exige donc que repquota reponde.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_QUOTA_OK=0',
      'if ! findmnt --mountpoint "${KJEMO_MP}" > /dev/null 2>&1; then',
      "  kjemo_resultat 'Quotas' \"${KJEMO_MP}\" 'PROBLEME' 'non monte' \\",
      "    'Rien n est monte sur ce point.'",
      'else',
      '  kjemo_opts="$(findmnt -n -o OPTIONS --mountpoint "${KJEMO_MP}" 2>/dev/null || true)"',
      '  kjemo_attendue=\'usrquota\'',
      "  if [ \"${KJEMO_TYPE}\" = 'Groupe' ]; then kjemo_attendue='grpquota'; fi",
      '  case "${kjemo_opts}" in',
      '    *"${kjemo_attendue}"*)',
      '      if repquota "${KJEMO_MP}" > "${KJEMO_TMP}/avant.txt" 2>&1; then',
      '        KJEMO_QUOTA_OK=1',
      "        kjemo_resultat 'Quotas' \"${KJEMO_MP}\" 'OK' \"${kjemo_attendue} actif\" \\",
      "          'repquota repond : la comptabilite tourne.'",
      '      else',
      "        kjemo_resultat 'Quotas' \"${KJEMO_MP}\" 'PROBLEME' 'repquota muet' \\",
      "          'L option est presente mais la comptabilite ne repond pas. Lance quotacheck puis quotaon, ou utilise l assistant d activation.'",
      '      fi',
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Quotas' \"${KJEMO_MP}\" 'PROBLEME' \"${kjemo_attendue} absent\" \\",
      '        "Options actuelles : ${kjemo_opts}. Active les quotas d abord : assistant « Activer les quotas disque »."',
      '      ;;',
      '  esac',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - SOUPLE <= DURE, VERIFIE AUSSI DANS LE SCRIPT',
      '#',
      '# Le formulaire l a deja refuse. On le revérifie ici parce qu un script',
      '# peut etre relu, modifie a la main, puis execute : la garde doit vivre la',
      '# ou l action a lieu, et pas seulement dans l interface qui l a produit.',
      '#',
      '# Un zero signifie « aucune limite » : une souple a 900 avec une dure a 0',
      '# est coherente, et ce cas ne doit pas etre refuse par erreur.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_LIMITES_OK=1',
      'if [ "${KJEMO_BLOCS_HARD}" -ne 0 ] && [ "${KJEMO_BLOCS_SOFT}" -gt "${KJEMO_BLOCS_HARD}" ]; then',
      '  KJEMO_LIMITES_OK=0',
      "  kjemo_resultat 'Limites' 'Espace' 'PROBLEME' 'souple > dure' \\",
      "    'La limite souple depasse la limite dure : elle ne serait jamais atteinte. Aucune limite n est posee.'",
      'fi',
      'if [ "${KJEMO_INODES_HARD}" -ne 0 ] && [ "${KJEMO_INODES_SOFT}" -gt "${KJEMO_INODES_HARD}" ]; then',
      '  KJEMO_LIMITES_OK=0',
      "  kjemo_resultat 'Limites' 'Fichiers' 'PROBLEME' 'souple > dure' \\",
      "    'La limite souple de fichiers depasse la limite dure. Aucune limite n est posee.'",
      'fi',
      'if [ "${KJEMO_LIMITES_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Limites' 'Coherence' 'OK' 'souple <= dure' \\",
      "    'Un zero signifie « aucune limite ».'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LA PERIODE DE GRACE, QU ON LIT SANS LA CHANGER',
      '#',
      '# Elle est GLOBALE au systeme de fichiers : la changer pour une personne la',
      '# changerait pour tout le monde. Cet assistant l affiche et n y touche pas.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo repquota; then',
      '  kjemo_grace="$(repquota -s "${KJEMO_MP}" 2>/dev/null | grep -i -m 1 grace || true)"',
      '  if [ -n "${kjemo_grace}" ]; then',
      "    kjemo_resultat 'Grace' 'Periode de grace' 'INFO' \"${kjemo_grace}\" \\",
      "      'Duree pendant laquelle la limite souple peut etre depassee. GLOBALE au systeme de fichiers : cet assistant ne la modifie pas.'",
      '  fi',
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: nom,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `poser les limites de quota sur ${estGroupe ? 'le groupe' : 'l utilisateur'} ${nom}`,
      }),

      ...blocPorteFinale({
        conditions: [
          ['KJEMO_OUTILS_OK', 'Le paquet quota est absent : apt install quota.'],
          ['KJEMO_CIBLE_OK', 'L utilisateur ou le groupe vise n existe pas.'],
          ['KJEMO_QUOTA_OK', 'La comptabilite des quotas n est pas active sur ce point de montage.'],
          ['KJEMO_LIMITES_OK', 'Une limite souple depasse sa limite dure.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom de la cible.'],
        ],
        action: 'la pose des limites',
      }),

      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# setquota, ET NON edquota',
      '#',
      '# edquota ouvre un EDITEUR. Dans un script, elle attendrait une saisie que',
      '# personne ne fera, et le script resterait bloque. setquota prend les quatre',
      '# limites en arguments, dans cet ordre :',
      '#',
      '#   setquota -u <nom> <bloc-souple> <bloc-dur> <inode-souple> <inode-dur> <montage>',
      '#',
      '# La forme a la main, avec edquota, est dans la fiche de cet assistant.',
      '# Dire « ceci est votre edquota » a propos d un setquota serait faux.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_avant="$(quota "${KJEMO_DRAPEAU}" -s -- "${KJEMO_NOM}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Etat avant' \"${KJEMO_NOM}\" 'INFO' \"${kjemo_avant:-aucune limite}\" \\",
      "    'Etat avant modification, pour pouvoir y revenir.'",
      '',
      '  printf \'%s\\n\' \'Pose des limites...\'',
      '  kjemo_code_sq=0',
      '  setquota "${KJEMO_DRAPEAU}" -- "${KJEMO_NOM}" \\',
      '    "${KJEMO_BLOCS_SOFT}" "${KJEMO_BLOCS_HARD}" \\',
      '    "${KJEMO_INODES_SOFT}" "${KJEMO_INODES_HARD}" \\',
      '    "${KJEMO_MP}" > "${KJEMO_TMP}/setquota.out" 2>&1 || kjemo_code_sq=$?',
      '  if [ "${kjemo_code_sq}" -ne 0 ]; then',
      "    kjemo_resultat 'setquota' \"${KJEMO_NOM}\" 'PROBLEME' \"code ${kjemo_code_sq}\" \\",
      "      'setquota a echoue. Aucune limite n a ete posee.'",
      "    printf '%s\\n' 'ARRET : setquota a echoue. Aucune limite posee.' >&2",
      '    cat "${KJEMO_TMP}/setquota.out" >&2',
      '    exit 1',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# RELECTURE : LA SEULE PREUVE',
      '#',
      '# « setquota a rendu 0 » ne dit pas que la limite est en place avec les bonnes',
      '# valeurs. On relit avec repquota et on COMPARE aux blocs transmis.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_apres="$(repquota -v "${KJEMO_MP}" 2>/dev/null | grep -E "^${KJEMO_NOM}[[:space:]]" || true)"',
      '  if [ -z "${kjemo_apres}" ]; then',
      "    kjemo_resultat 'Relecture' \"${KJEMO_NOM}\" 'PROBLEME' 'absent de repquota' \\",
      "      'setquota a rendu 0 mais repquota ne montre pas la cible. La limite n est pas en place.'",
      "    printf '%s\\n' 'ARRET : repquota ne confirme pas la limite posee.' >&2",
      '    exit 1',
      '  fi',
      '# Les colonnes de repquota, comptees sur la vraie sortie :',
      '#   $1 nom   $2 etat (--, +-, ...)   $3 blocs UTILISES   $4 souple   $5 dure',
      '# La premiere version lisait $3 et $4, soit « utilise » et « souple ». La',
      '# comparaison echouait donc TOUJOURS, et le script refusait de conclure sur',
      '# une limite correctement posee. Trouve par le controle positif du banc des',
      '# quotas : c est exactement le genre de defaut qu un banc sans controle',
      '# positif ne voit jamais, puisque tous ses refus paraissent justes.',
      '  kjemo_relu_soft="$(printf \'%s\' "${kjemo_apres}" | awk \'{print $4}\' || true)"',
      '  kjemo_relu_hard="$(printf \'%s\' "${kjemo_apres}" | awk \'{print $5}\' || true)"',
      '  if [ "${kjemo_relu_soft}" = "${KJEMO_BLOCS_SOFT}" ] \\',
      '    && [ "${kjemo_relu_hard}" = "${KJEMO_BLOCS_HARD}" ]; then',
      "    kjemo_resultat 'Relecture' \"${KJEMO_NOM}\" 'OK' \\",
      '      "souple ${kjemo_relu_soft}, dure ${kjemo_relu_hard} blocs" \\',
      "      'Les valeurs relues correspondent exactement a celles transmises.'",
      '  else',
      "    kjemo_resultat 'Relecture' \"${KJEMO_NOM}\" 'PROBLEME' \\",
      '      "relu ${kjemo_relu_soft}/${kjemo_relu_hard}, attendu ${KJEMO_BLOCS_SOFT}/${KJEMO_BLOCS_HARD}" \\',
      "      'Les valeurs relues ne correspondent pas. Ne compte pas sur cette limite.'",
      "    printf '%s\\n' 'ARRET : les limites relues ne correspondent pas aux valeurs transmises.' >&2",
      '    exit 1',
      '  fi',
      '  kjemo_resultat \'Etat apres\' \'repquota\' \'INFO\' "${kjemo_apres}" \\',
      "    'Pour revenir en arriere, repose les valeurs lues dans « Etat avant ».'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-quota-limite' }),
    ]);
  },

  gui: [
    'Vérifie que les quotas sont actifs : « findmnt -o OPTIONS /srv/donnees » doit montrer usrquota ou grpquota.',
    'Vérifie que la cible existe : « getent passwd blaise » ou « getent group groupe ».',
    'Note l’état actuel, pour pouvoir y revenir : « sudo quota -u -s blaise ».',
    'Pose la limite, en BLOCS DE 1 Kio : « sudo setquota -u blaise 921600 1024000 0 0 /srv/donnees » — ici 900 Mio et 1000 Mio.',
    'Relis le résultat : « sudo repquota -s /srv/donnees ». C’est la relecture qui prouve, pas le code de retour.',
    'À la main, en interactif, l’équivalent est « sudo edquota -u blaise » : un éditeur s’ouvre avec un tableau. C’est la forme enseignée au cours ; elle n’est pas scriptable, et c’est pourquoi le script utilise setquota.',
    'Pour un groupe, remplace « -u » par « -g » : « sudo edquota -g groupe ».',
    'Pour retirer toute limite : « sudo setquota -u blaise 0 0 0 0 /srv/donnees ».',
  ],

  keywords: ['quota', 'limite', 'setquota', 'edquota', 'repquota', 'soft', 'hard', 'souple',
    'dure', 'grace', 'inode', 'utilisateur', 'groupe', 'espace', 'disque', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Les quotas DÉJÀ activés sur le point de montage : voir l’assistant « Activer les quotas disque ».',
    'Un utilisateur ou un groupe existant. Le script refuse une cible inexistante.',
    'Le paquet quota : « sudo apt install quota ».',
    'sudo, ou une session root.',
  ],

  commonErrors: [
    {
      message: 'setquota: Mountpoint (or device) /srv/donnees not found or has no quota enabled',
      code: 'KJEMO',
      cause: 'La comptabilité n’est pas active sur ce système de fichiers.',
      fix: 'Activer les quotas d’abord. Le script contrôle ce point et s’arrête avant d’agir.',
      command: 'findmnt -o OPTIONS /srv/donnees && sudo repquota -a',
    },
    {
      message: 'La limite posée est mille fois plus petite que prévu',
      code: 'KJEMO',
      cause: 'setquota compte en blocs de 1 Kio. Une valeur « 500 » saisie en pensant à des mégaoctets donne 500 Kio.',
      fix: 'C’est la raison du champ « unité » de cet assistant : la conversion est faite à la génération, et le script affiche la valeur saisie ET la valeur transmise.',
      command: 'sudo repquota -s /srv/donnees',
    },
    {
      message: 'edquota ouvre un éditeur et le script ne répond plus',
      code: 'KJEMO',
      cause: 'edquota est interactive : dans un script, elle attend une saisie que personne ne fera.',
      fix: 'Utiliser setquota, qui prend les limites en arguments. edquota reste la bonne commande à la main, et la fiche la montre.',
      command: 'sudo setquota -u blaise 921600 1024000 0 0 /srv/donnees',
    },
    {
      message: 'L’utilisateur dépasse sa limite souple depuis des jours sans être bloqué',
      code: 'KJEMO',
      cause: 'La limite souple est dépassable pendant la période de grâce, qui est globale au système de fichiers et peut être longue.',
      fix: 'Lire la période de grâce. La changer affecte TOUT LE MONDE sur ce système de fichiers : cet assistant l’affiche et n’y touche pas, délibérément.',
      command: 'sudo repquota -s /srv/donnees',
    },
    {
      message: 'La limite ne s’applique pas aux fichiers déjà présents',
      code: 'KJEMO',
      cause: 'Un quota compte l’usage actuel : si l’utilisateur dépasse déjà la limite dure, il ne peut plus écrire, mais rien n’est supprimé.',
      fix: 'Aucune suppression automatique n’existe, et cet assistant n’en fait pas. Il faut libérer de l’espace à la main, ou relever la limite.',
      command: 'sudo quota -u -s blaise',
    },
  ],

  reversible: true,
  verifyAfter: [
    '« sudo repquota -s /srv/donnees » montre la cible avec les limites souple et dure attendues.',
    'Les valeurs relues correspondent exactement aux blocs transmis — le script le vérifie et s’arrête sinon.',
    '« sudo quota -u -s blaise » montre la limite du point de vue de l’utilisateur.',
    'Le rapport contient l’état AVANT modification, pour pouvoir y revenir.',
  ],

  rollback: {
    summary: 'Réversible immédiatement : il suffit de reposer les valeurs précédentes, que le rapport a enregistrées avant modification. Aucun fichier de configuration n’est touché, aucune donnée n’est supprimée.',
    diagnostic: `# Les limites actuelles :
sudo repquota -s /srv/donnees
# Du point de vue de l utilisateur :
sudo quota -u -s blaise
# Et pour un groupe :
sudo quota -g -s groupe`,
    command: `# Reposer les valeurs lues dans la section « Etat avant » du rapport.
# Les quatre nombres sont, dans l ordre :
#   bloc-souple  bloc-dur  inode-souple  inode-dur
sudo setquota -u blaise <ancien-soft> <ancien-hard> <ancien-isoft> <ancien-ihard> /srv/donnees

# Pour retirer TOUTE limite a cet utilisateur :
sudo setquota -u blaise 0 0 0 0 /srv/donnees

# Verifier :
sudo repquota -s /srv/donnees`,
    warning: 'Un quota ne supprime jamais de fichier. Si un utilisateur dépasse déjà sa limite dure au moment où elle est posée, il ne peut plus écrire — mais rien n’est effacé. Ne pose pas une limite inférieure à l’usage actuel en espérant un nettoyage : il n’aura pas lieu, et la personne se retrouvera bloquée sans comprendre.',
  },

  checks: [
    'La cible est vérifiée avec getent : une limite sur un UID ou GID inconnu ne protégerait rien.',
    'root est refusé comme cible : un quota sur root peut empêcher le système d’écrire ses propres fichiers.',
    'La comptabilité doit répondre à repquota avant toute pose de limite.',
    'La cohérence souple ≤ dure est vérifiée dans le formulaire ET dans le script, parce qu’un script peut être relu, modifié à la main, puis exécuté.',
    'Un zéro est traité comme « aucune limite », et non comme une limite de zéro.',
    'La conversion d’unité est faite à la génération, et le script affiche la valeur saisie ET la valeur transmise.',
    'setquota est utilisé, non edquota : edquota ouvre un éditeur et bloquerait un script. La forme interactive est documentée dans la fiche.',
    'Le résultat est relu avec repquota et COMPARÉ aux blocs transmis ; un écart arrête le script.',
    'La période de grâce est lue et affichée, jamais modifiée : elle est globale au système de fichiers.',
  ],

  source: `${M}/man8/setquota.8.html`,
  sources: [
    { label: 'setquota(8)', url: `${M}/man8/setquota.8.html` },
    { label: 'edquota(8)', url: `${M}/man8/edquota.8.html` },
    { label: 'repquota(8)', url: `${M}/man8/repquota.8.html` },
    { label: 'quota(1)', url: `${M}/man1/quota.1.html` },
    { label: 'getent(1)', url: `${M}/man1/getent.1.html` },
  ],
};

export const toolsLinuxE = [
  linuxQuotaEnable,
  linuxQuotaLimits,
];
