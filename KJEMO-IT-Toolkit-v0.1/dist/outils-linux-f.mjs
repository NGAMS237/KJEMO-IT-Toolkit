/**
 * outils-linux-f.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Stockage Linux — RAID LOGICIEL (mdadm).
 *
 * ---------------------------------------------------------------------------
 * CE QU'UN DISQUE DE SECOURS EST, ET CE QU'IL N'EST PAS
 * ---------------------------------------------------------------------------
 * Un disque de secours — un « spare » — n'est PAS un troisième membre actif.
 * Il ne contient aucune donnée tant que tout va bien, et il ne participe pas
 * à la redondance. Son rôle est d'attendre : quand un membre actif tombe,
 * le noyau le prend automatiquement, et la reconstruction démarre seule.
 *
 * La différence compte, parce qu'elle change ce qu'on doit en attendre :
 *
 *   - un RAID 1 à deux membres actifs survit à UNE panne de disque ;
 *   - le même avec un spare survit toujours à UNE panne, mais il se répare
 *     sans intervention humaine, et la fenêtre sans redondance est donc
 *     beaucoup plus courte ;
 *   - un spare ne double PAS la capacité, et ne protège pas de deux pannes
 *     simultanées.
 *
 * ---------------------------------------------------------------------------
 * L'EXEMPLE DU COURS, ET CE QU'IL FAUT EN CORRIGER
 * ---------------------------------------------------------------------------
 *     mdadm --create /dev/md1 --level=raid1 --raid-devices=2 /dev/sdb /dev/sdc
 *       --spare-devices=1 /dev/sdd
 *
 * La commande est juste, et c'est elle qui est enseignée. Les notes, elles,
 * contenaient trois défauts qu'on ne reproduit pas :
 *
 *   1. des espaces manquants autour de « --raid-devices=2 », qui font que
 *      mdadm lit un seul argument collé et refuse la commande ;
 *   2. un mélange entre /dev/md0 et /dev/md1 d'une ligne à l'autre : le
 *      premier assemble, le second ne répond pas, et on cherche longtemps ;
 *   3. un « /dev/hdc » là où le reste parle de /dev/sdX. Les noms « hd* » sont
 *      ceux des vieux pilotes IDE ; sur un noyau actuel, ce périphérique
 *      n'existe pas.
 *
 * Et un quatrième, qui est le plus coûteux : formater un MEMBRE au lieu de
 * l'ensemble. `mkfs.ext4 /dev/sdb` sur un membre détruit les métadonnées du
 * RAID ; `mkfs.ext4 /dev/md1` est la bonne cible. Le banc vérifie que mkfs
 * reçoit /dev/mdX et jamais un membre.
 *
 * Aucun module de ce fichier n'importe generators.mjs : même discipline qu'aux
 * lots précédents, pour éviter un cycle ESM.
 */

import { assertValid } from './noyau.mjs';
import {
  shQuote, assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocParametresBash, blocVariablesBash, blocRapportBash, blocPrivilegesBash,
} from './noyau-bash.mjs';
import {
  blocGardienChemin, blocSauvegardeFichier, blocConfirmation, blocPorteFinale,
  blocFstabPersistant,
} from './gardes-bash.mjs';
import { validateCheminAbsolu, validateChoix } from './validateurs-linux.mjs';

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

/** Un nom d'ensemble RAID : /dev/md suivi d'un nombre. */
function validerEnsemble(v) {
  const s = String(v ?? '').trim();
  if (!/^\/dev\/md[0-9]+$/.test(s)) {
    return {
      ok: false,
      error: 'Le nom de l’ensemble doit être de la forme /dev/md0, /dev/md1… Les notes de cours mélangeaient md0 et md1 d’une ligne à l’autre : le premier assemble, le second ne répond pas, et on cherche longtemps. Choisis-en un et garde-le.',
    };
  }
  return { ok: true, value: s };
}

/**
 * Un membre de RAID : un périphérique bloc sous /dev.
 *
 * Les noms « hd* » sont refusés : ce sont ceux des vieux pilotes IDE, et sur
 * un noyau actuel le périphérique n'existe pas. Les notes de cours en
 * contenaient un, au milieu de /dev/sdX — c'est le genre de détail qui fait
 * échouer une commande sans qu'on comprenne pourquoi.
 */
function validerMembre(v, label) {
  const s = String(v ?? '').trim();
  if (s === '') return { ok: false, error: `${label} est obligatoire.` };
  if (/^\/dev\/hd[a-z]/.test(s)) {
    return {
      ok: false,
      error: `${label} : « ${s} » utilise la nomenclature hd* des anciens pilotes IDE. Sur un noyau actuel, ce périphérique n’existe pas. Utilise le nom que lsblk affiche dans la colonne PATH, par exemple /dev/sdb.`,
    };
  }
  if (!/^\/dev\/[A-Za-z0-9_+-]+$/.test(s)) {
    return {
      ok: false,
      error: `${label} doit être un nœud direct sous /dev, par exemple /dev/sdb ou /dev/nvme0n1. Les chemins /dev/mapper/… et /dev/disk/by-id/… ne sont pas acceptés ici.`,
    };
  }
  return { ok: true, value: s };
}

// ===========================================================================
// ASSISTANT 1 — CRÉER UN RAID 1, AVEC OU SANS DISQUE DE SECOURS
// ===========================================================================

const linuxRaid1Create = {
  id: 'linux-raid1-create',
  icon: '▲',
  category: CAT,
  subcategory: 'Stockage Linux',
  title: 'Créer un RAID 1 avec disque de secours facultatif',
  risk: 'destructive',
  summary: 'Crée un ensemble RAID 1 à deux membres actifs distincts, avec un disque de secours facultatif, puis formate /dev/mdX — jamais un membre — et ajoute un montage persistant par UUID après validation d’une copie de /etc/fstab. Refuse tout disque monté, système, swap, LVM, LUKS, déjà membre d’un RAID, ou portant une signature.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'mdadm (apt install mdadm)',
    'util-linux — lsblk, blkid, wipefs, findmnt (présent par défaut)',
    'e2fsprogs — mkfs.ext4 (présent par défaut)',
  ],
  privileges: 'root — mdadm et mkfs ouvrent les périphériques bruts, et /etc/fstab appartient à root',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'RAID 1 seulement : deux membres actifs, en miroir. Les niveaux 0, 5, 6 et 10 ont des contraintes et des modes de panne différents, et cet assistant ne les traite pas.',
    'NE RÉCUPÈRE RIEN. Créer un ensemble écrit des métadonnées sur chaque membre : ce qui s’y trouvait devient inaccessible, et mkfs ne se défait pas.',
    'Un RAID 1 n’est PAS une sauvegarde. Il protège de la panne d’un disque, pas d’une suppression, d’un chiffrement malveillant ni d’une erreur humaine — les deux membres reçoivent la même écriture, y compris la mauvaise.',
    'Ne simule aucune panne. Casser volontairement un ensemble sain pour observer la bascule est une procédure de laboratoire, documentée à part, et elle n’a pas sa place dans la même interface que « créer ».',
    'N’écrit pas /etc/mdadm/mdadm.conf. Sans cette ligne, l’ensemble est généralement réassemblé automatiquement au démarrage, mais son nom peut changer : l’assistant le dit et laisse cette étape à la main, parce qu’elle demande une régénération d’initramfs.',
  ],

  fields: [
    {
      id: 'ensemble',
      label: 'Nom de l’ensemble RAID',
      type: 'text',
      default: '/dev/md1',
      placeholder: '/dev/md1',
      help: 'Un nom libre, de la forme /dev/mdX. Vérifie avec « cat /proc/mdstat » qu’il n’est pas déjà pris.',
    },
    {
      id: 'membre1',
      label: 'Membre actif 1',
      type: 'text',
      default: '/dev/sdb',
      placeholder: '/dev/sdb',
      help: 'Premier disque du miroir. Il sera ÉCRASÉ.',
    },
    {
      id: 'membre2',
      label: 'Membre actif 2',
      type: 'text',
      default: '/dev/sdc',
      placeholder: '/dev/sdc',
      help: 'Deuxième disque du miroir, distinct du premier. Il sera ÉCRASÉ.',
    },
    {
      id: 'spare',
      label: 'Disque de secours (spare)',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: '/dev/sdd',
      help: 'Facultatif. Un disque qui ATTEND : il ne contient rien tant que tout va bien, et prend automatiquement la place d’un membre défaillant. Laisse vide pour un miroir à deux disques sans secours.',
    },
    {
      id: 'pointMontage',
      label: 'Point de montage',
      type: 'text',
      default: '/srv/raid',
      placeholder: '/srv/raid',
      help: 'Où l’ensemble sera monté. Le dossier sera créé s’il n’existe pas.',
    },
    {
      id: 'systemeFichiers',
      label: 'Système de fichiers',
      type: 'select',
      default: 'ext4',
      options: [['ext4', 'ext4 — le défaut d’Ubuntu'], ['xfs', 'xfs — bon sur gros fichiers']],
      help: 'Écrit sur /dev/mdX, jamais sur un membre.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le nom de l’ensemble',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: '/dev/md1',
      help: 'Laisse vide pour obtenir un script qui DIAGNOSTIQUE sans rien écrire. Pour autoriser la création, retape ici exactement le nom de l’ensemble. Le récapitulatif affiché avant action nomme chaque disque et son rôle.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const e = validerEnsemble(v.ensemble);
    if (!e.ok) errors.ensemble = e.error;

    const m1 = validerMembre(v.membre1, 'Le membre actif 1');
    if (!m1.ok) errors.membre1 = m1.error;
    const m2 = validerMembre(v.membre2, 'Le membre actif 2');
    if (!m2.ok) errors.membre2 = m2.error;

    const a = String(v.membre1 ?? '').trim();
    const b = String(v.membre2 ?? '').trim();
    if (a !== '' && a === b) {
      errors.membre2 = 'Les deux membres actifs doivent être des disques DIFFÉRENTS. Un miroir sur un seul disque ne protège de rien : si ce disque tombe, les deux moitiés du miroir tombent avec lui.';
    }

    const sp = String(v.spare ?? '').trim();
    if (sp !== '') {
      const rs = validerMembre(sp, 'Le disque de secours');
      if (!rs.ok) errors.spare = rs.error;
      else if (sp === a || sp === b) {
        errors.spare = `Le disque de secours ne peut pas être l’un des membres actifs. « ${sp} » est déjà un membre : un spare qui est aussi un membre actif ne remplacerait rien le jour de la panne, puisqu’il tomberait en même temps.`;
      }
    }

    const mp = validateCheminAbsolu(v.pointMontage, 'Le point de montage');
    if (!mp.ok) errors.pointMontage = mp.error;
    else {
      const p = String(v.pointMontage).trim().replace(/\/+$/, '');
      const INTERDITS = ['', '/', '/boot', '/boot/efi', '/etc', '/bin', '/sbin', '/lib',
        '/lib64', '/usr', '/var', '/dev', '/proc', '/sys', '/run', '/root', '/home'];
      if (INTERDITS.includes(p)) {
        errors.pointMontage = `« ${p || '/'} » ne peut pas être un point de montage pour un ensemble RAID de données. Choisis un dossier dédié, par exemple /srv/raid.`;
      }
    }

    const fs = validateChoix(v.systemeFichiers, ['ext4', 'xfs'], 'Le système de fichiers');
    if (!fs.ok) errors.systemeFichiers = fs.error;

    const conf = String(v.confirmation ?? '').trim();
    if (conf !== '' && conf !== String(v.ensemble ?? '').trim()) {
      errors.confirmation = `La confirmation ne correspond pas au nom de l’ensemble. Retape exactement : ${String(v.ensemble ?? '').trim()} — ou laisse vide pour obtenir un script qui diagnostique sans écrire.`;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const ens = String(v.ensemble).trim();
    const m1 = String(v.membre1).trim();
    const m2 = String(v.membre2).trim();
    const spare = String(v.spare ?? '').trim();
    const fs = String(v.systemeFichiers);
    const nbSpare = spare === '' ? 0 : 1;

    return assemblerSh([
      ...enteteBash({
        titre: 'Creer un RAID 1, avec disque de secours facultatif',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'mdadm et mkfs ouvrent les peripheriques bruts, et /etc/fstab appartient a root',
      }),
      ...blocGardienChemin({ lectureSeule: false }),
      ...blocSauvegardeFichier(),
      ...blocFstabPersistant({ quoi: 'l ensemble RAID' }),
      ...blocVariablesBash([
        ['KJEMO_ENS', shQuote(ens)],
        ['KJEMO_M1', shQuote(m1)],
        ['KJEMO_M2', shQuote(m2)],
        ['KJEMO_SPARE', shQuote(spare)],
        ['KJEMO_NB_SPARE', shQuote(String(nbSpare))],
        ['KJEMO_MP', shQuote(String(v.pointMontage).trim().replace(/\/+$/, ''))],
        ['KJEMO_FS', shQuote(fs)],
        ['KJEMO_OPTIONS', shQuote('defaults,nofail')],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
        ['KJEMO_FSTAB', shQuote('/etc/fstab')],
      ]),
      ...blocParametresBash([
        ['Ensemble', '${KJEMO_ENS}'],
        ['Niveau', 'raid1 (miroir)'],
        ['Membre actif 1', '${KJEMO_M1}'],
        ['Membre actif 2', '${KJEMO_M2}'],
        ['Disque de secours', '${KJEMO_SPARE:-aucun}'],
        ['Point de montage', '${KJEMO_MP}'],
        ['Systeme de fichiers', '${KJEMO_FS}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# LE RECAPITULATIF DES ROLES, AFFICHE SEPAREMENT',
      '#',
      '# Trois disques, trois roles, et le role change tout : un membre actif',
      '# recoit les donnees tout de suite, un spare attend sans rien contenir.',
      '# Les afficher dans une seule ligne « /dev/sdb /dev/sdc /dev/sdd » laisse',
      '# croire a trois disques equivalents, ce qui est faux — et c est exactement',
      '# la confusion que la ligne de commande de mdadm entretient.',
      '# ---------------------------------------------------------------------------',
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' 'ROLES DES DISQUES, A RELIRE AVANT TOUT'",
      "printf '%s\\n' '--------------------------------------------------------------'",
      'printf \'  %-22s %s\\n\' \'MEMBRE ACTIF 1\' "${KJEMO_M1}"',
      'printf \'  %-22s %s\\n\' \'MEMBRE ACTIF 2\' "${KJEMO_M2}"',
      'if [ -n "${KJEMO_SPARE}" ]; then',
      '  printf \'  %-22s %s\\n\' \'SECOURS (spare)\' "${KJEMO_SPARE}"',
      "  printf '%s\\n' '  Le secours ATTEND : il ne contient rien tant que tout va bien,'",
      "  printf '%s\\n' '  et prend automatiquement la place d un membre defaillant.'",
      'else',
      '  printf \'  %-22s %s\\n\' \'SECOURS (spare)\' \'aucun\'',
      "  printf '%s\\n' '  Sans secours, une panne laisse l ensemble degrade jusqu a'",
      "  printf '%s\\n' '  l intervention humaine : plus aucune redondance pendant ce temps.'",
      'fi',
      "printf '%s\\n' '  TOUS ces disques seront ECRASES. Un RAID 1 n est pas une'",
      "printf '%s\\n' '  sauvegarde : les deux membres recoivent la meme ecriture, y'",
      "printf '%s\\n' '  compris la mauvaise.'",
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' ''",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LES OUTILS',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      `for kjemo_o in mdadm lsblk blkid wipefs findmnt mkfs.${fs}; do`,
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' \\",
      "      'Installe-le : apt install mdadm, ou xfsprogs pour mkfs.xfs.'",
      '  fi',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - L ENSEMBLE EST-IL LIBRE ?',
      '#',
      '# Creer /dev/md1 alors qu un /dev/md1 existe deja echoue, ou pire, agit sur',
      '# un ensemble en service. /proc/mdstat est la source la moins chere.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_ENS_OK=0',
      'kjemo_nom_md="$(printf \'%s\' "${KJEMO_ENS}" | sed \'s#^/dev/##\')"',
      'if [ -e "${KJEMO_ENS}" ]; then',
      "  kjemo_resultat 'Ensemble' \"${KJEMO_ENS}\" 'PROBLEME' 'existe deja' \\",
      "    'Ce peripherique existe. Choisis un autre nom, ou arrete l ensemble existant a la main apres avoir verifie ce qu il contient.'",
      'elif [ -r /proc/mdstat ] && grep -q "^${kjemo_nom_md} *:" /proc/mdstat; then',
      "  kjemo_resultat 'Ensemble' \"${KJEMO_ENS}\" 'PROBLEME' 'present dans /proc/mdstat' \\",
      "    'Un ensemble de ce nom est assemble. Choisis un autre nom.'",
      'else',
      '  KJEMO_ENS_OK=1',
      "  kjemo_resultat 'Ensemble' \"${KJEMO_ENS}\" 'OK' 'libre' \\",
      "    'Aucun peripherique ni ensemble de ce nom.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - CHAQUE DISQUE, UN PAR UN',
      '#',
      '# Sept raisons de refuser un disque, et chacune se lit a un endroit',
      '# different. Elles sont verifiees pour CHAQUE disque, membre ou secours :',
      '# un spare mal choisi est aussi dangereux qu un membre mal choisi, puisque',
      '# le noyau l ecrira le jour de la panne.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_DISQUES_OK=1',
      'kjemo_val() {',
      '  printf \'%s\\n\' "$2" | sed -n "s/.*$1=\\"\\([^\\"]*\\)\\".*/\\\\1/p"',
      '}',
      'kjemo_examiner_disque() {',
      '  local dev="${1:-}" role="${2:-}"',
      '  if [ ! -b "${dev}" ]; then',
      '    KJEMO_DISQUES_OK=0',
      "    kjemo_resultat 'Disques' \"${role} ${dev}\" 'PROBLEME' 'pas un peripherique bloc' \\",
      "      'Ce chemin n existe pas ou n est pas un disque. Lance l inventaire du stockage pour voir les peripheriques reels.'",
      '    return 0',
      '  fi',
      '  local arbre=\'\'',
      '  arbre="$(lsblk -P -o PATH,TYPE,FSTYPE,MOUNTPOINTS -- "${dev}" 2>/dev/null || true)"',
      '  if [ -z "${arbre}" ]; then',
      '    KJEMO_DISQUES_OK=0',
      "    kjemo_resultat 'Disques' \"${role} ${dev}\" 'PROBLEME' 'illisible par lsblk' ''",
      '    return 0',
      '  fi',
      '  local probleme=\'\'',
      '  while IFS= read -r ligne; do',
      '    if [ -z "${ligne}" ]; then continue; fi',
      '    local f=\'\' m=\'\'',
      '    f="$(kjemo_val FSTYPE "${ligne}")"',
      '    m="$(kjemo_val MOUNTPOINTS "${ligne}")"',
      '    if [ -n "${m}" ]; then probleme="monte sur ${m}"; fi',
      '    case "${m}" in',
      "      '/'|'/boot'|'/boot/efi'|'/usr'|'/var'|'/etc') probleme=\"SYSTEME : ${m}\" ;;",
      '    esac',
      '    case "${f}" in',
      '      swap) probleme=\'swap actif ou declare\' ;;',
      '      LVM2_member) probleme=\'volume physique LVM\' ;;',
      '      linux_raid_member) probleme=\'DEJA membre d un ensemble RAID\' ;;',
      '      crypto_LUKS) probleme=\'volume chiffre LUKS\' ;;',
      '    esac',
      '  done <<< "${arbre}"',
      '  if [ -z "${probleme}" ]; then',
      '    local sig=\'\'',
      '    sig="$(wipefs -n -- "${dev}" 2>/dev/null || true)"',
      '    if [ -n "${sig}" ]; then probleme=\'signature residuelle presente\'; fi',
      '  fi',
      '  if [ -n "${probleme}" ]; then',
      '    KJEMO_DISQUES_OK=0',
      "    kjemo_resultat 'Disques' \"${role} ${dev}\" 'PROBLEME' \"${probleme}\" \\",
      // La RAISON du refus est reprise dans le commentaire, et pas seulement
      // dans la valeur : en mode Console — le mode par defaut — le rapport
      // n imprime que categorie, controle et commentaire. Un operateur qui
      // lisait « ce disque n est pas libre » sans savoir LEQUEL des sept
      // motifs s applique devait ouvrir le rapport JSON pour l apprendre.
      // Defaut trouve par le banc RAID, passe B.
      "      \"Ce disque n est pas libre : ${probleme}. Cet assistant REFUSE d ecrire par-dessus, et n offre aucun moyen de passer outre : effacer une signature ou demonter un systeme en service sont des actes a faire a la main, en connaissance de cause.\"",
      '  else',
      '    local taille=\'\'',
      '    taille="$(lsblk -dn -o SIZE -- "${dev}" 2>/dev/null | tr -d \' \' || true)"',
      "    kjemo_resultat 'Disques' \"${role} ${dev}\" 'OK' \"${taille}, libre\" \\",
      "      'Ni monte, ni systeme, ni swap, ni LVM, ni RAID, ni chiffre, aucune signature.'",
      '  fi',
      '}',
      'kjemo_examiner_disque "${KJEMO_M1}" \'MEMBRE ACTIF 1\'',
      'kjemo_examiner_disque "${KJEMO_M2}" \'MEMBRE ACTIF 2\'',
      'if [ -n "${KJEMO_SPARE}" ]; then',
      '  kjemo_examiner_disque "${KJEMO_SPARE}" \'SECOURS\'',
      'fi',
      '',
      '# Les doublons, revérifiés ici : le formulaire les refuse deja, mais un',
      '# script peut etre relu, modifie a la main, puis execute.',
      'KJEMO_DISTINCTS_OK=1',
      'if [ "${KJEMO_M1}" = "${KJEMO_M2}" ]; then',
      '  KJEMO_DISTINCTS_OK=0',
      "  kjemo_resultat 'Disques' 'Membres distincts' 'PROBLEME' 'identiques' \\",
      "    'Un miroir sur un seul disque ne protege de rien : si ce disque tombe, les deux moities tombent avec lui.'",
      'fi',
      'if [ -n "${KJEMO_SPARE}" ] \\',
      '  && { [ "${KJEMO_SPARE}" = "${KJEMO_M1}" ] || [ "${KJEMO_SPARE}" = "${KJEMO_M2}" ]; }; then',
      '  KJEMO_DISTINCTS_OK=0',
      "  kjemo_resultat 'Disques' 'Secours distinct' 'PROBLEME' 'identique a un membre' \\",
      "    'Un secours qui est aussi un membre actif ne remplacerait rien le jour de la panne : il tomberait en meme temps.'",
      'fi',
      'if [ "${KJEMO_DISTINCTS_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Disques' 'Roles distincts' 'OK' 'aucun doublon' ''",
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: ens,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `creer ${ens} en raid1 sur ${m1} et ${m2}${spare ? ` avec ${spare} en secours` : ''}, ce qui ECRASE ces disques`,
      }),

      ...blocPorteFinale({
        conditions: [
          ['KJEMO_OUTILS_OK', 'Un outil necessaire manque : apt install mdadm.'],
          ['KJEMO_ENS_OK', 'Le nom de l ensemble est deja pris.'],
          ['KJEMO_DISQUES_OK', 'Au moins un disque n est pas libre : monte, systeme, swap, LVM, RAID, chiffre, ou portant une signature.'],
          ['KJEMO_DISTINCTS_OK', 'Deux roles visent le meme disque.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom de l ensemble.'],
        ],
        action: 'la creation de l ensemble RAID',
      }),

      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LA CREATION',
      '#',
      '# Les arguments sont passes un par un, dans un tableau : pas de chaine',
      '# assemblee a la main, ou un espace manquant autour de « --raid-devices=2 »',
      '# ferait lire a mdadm un seul argument colle. Les notes de cours en',
      '# contenaient un, et la commande echouait sans que la cause soit visible.',
      '#',
      '# --force est volontairement ABSENT : il fait passer mdadm outre ses',
      '# propres verifications, c est-a-dire exactement ce que l etape 3 protege.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_cmd=(mdadm --create "${KJEMO_ENS}" --level=raid1 --raid-devices=2',
      '    "${KJEMO_M1}" "${KJEMO_M2}")',
      '  if [ -n "${KJEMO_SPARE}" ]; then',
      '    kjemo_cmd=(mdadm --create "${KJEMO_ENS}" --level=raid1 --raid-devices=2',
      '      --spare-devices=1 "${KJEMO_M1}" "${KJEMO_M2}" "${KJEMO_SPARE}")',
      '  fi',
      '  printf \'%s\\n\' \'Creation de l ensemble...\'',
      '  kjemo_code_md=0',
      '  printf \'%s\\n\' \'yes\' | "${kjemo_cmd[@]}" > "${KJEMO_TMP}/mdadm.out" 2>&1 || kjemo_code_md=$?',
      '  if [ "${kjemo_code_md}" -ne 0 ]; then',
      "    kjemo_resultat 'RAID' 'Creation' 'PROBLEME' \"code ${kjemo_code_md}\" \\",
      "      'mdadm a echoue. Aucun systeme de fichiers n a ete ecrit.'",
      "    printf '%s\\n' 'ARRET : mdadm --create a echoue. Rien n a ete formate.' >&2",
      '    cat "${KJEMO_TMP}/mdadm.out" >&2',
      '    exit 1',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - RELECTURE : /proc/mdstat ET mdadm --detail',
      '#',
      '# « mdadm a rendu 0 » ne dit pas que l ensemble est assemble avec les bons',
      '# membres. On relit les deux sources : /proc/mdstat pour l etat, et',
      '# mdadm --detail pour les ROLES. Et on verifie que le peripherique existe',
      '# AVANT de formater quoi que ce soit.',
      '# ---------------------------------------------------------------------------',
      '  if kjemo_dispo udevadm; then udevadm settle 2>/dev/null || true; fi',
      '  sleep 2',
      '  if [ ! -b "${KJEMO_ENS}" ]; then',
      "    kjemo_resultat 'RAID' 'Relecture' 'PROBLEME' 'peripherique absent' \\",
      "      'mdadm a rendu 0 mais l ensemble n apparait pas. Rien n est formate.'",
      "    printf '%s\\n' 'ARRET : l ensemble n apparait pas comme peripherique bloc.' >&2",
      '    exit 1',
      '  fi',
      '  kjemo_mdstat="$(cat /proc/mdstat 2>/dev/null || true)"',
      "  kjemo_resultat 'RAID' '/proc/mdstat' 'INFO' \"${kjemo_mdstat}\" \\",
      "    '[UU] = deux membres sains. [U_] = un membre manquant. Un « (S) » marque le disque de secours.'",
      '  kjemo_detail="$(mdadm --detail "${KJEMO_ENS}" 2>/dev/null || true)"',
      '  if [ -z "${kjemo_detail}" ]; then',
      "    kjemo_resultat 'RAID' 'mdadm --detail' 'PROBLEME' 'illisible' \\",
      "      'L ensemble ne se relit pas. Rien n est formate.'",
      "    printf '%s\\n' 'ARRET : mdadm --detail ne rend rien. Rien n est formate.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'RAID' 'Roles apres creation' 'INFO' \"${kjemo_detail}\" \\",
      "    'Les lignes du bas donnent le role de chaque disque : active sync, spare, ou faulty.'",
      '  # Le nombre de secours demande est une donnee du formulaire : on la',
      '  # CONFRONTE a ce que mdadm declare, au lieu de supposer que l option',
      '  # --spare-devices a ete prise en compte. Un spare silencieusement absent',
      '  # est le genre de panne qu on ne decouvre que le jour du remplacement,',
      '  # c est-a-dire trop tard.',
      '  kjemo_spare_vu="$(printf \'%s\\n\' "${kjemo_detail}" \\',
      "    | awk -F: '/Spare Devices/ { gsub(/[^0-9]/, \"\", $2); print $2; exit }' || true)\"",
      '  if [ -z "${kjemo_spare_vu}" ]; then',
      "    kjemo_resultat 'RAID' 'Secours declare' 'ATTENTION' \"attendu ${KJEMO_NB_SPARE}, lu : rien\" \\",
      "      'mdadm --detail ne donne pas de ligne Spare Devices. Verifie les roles a la main avant de compter sur le secours.'",
      '  elif [ "${kjemo_spare_vu}" != "${KJEMO_NB_SPARE}" ]; then',
      "    kjemo_resultat 'RAID' 'Secours declare' 'ATTENTION' \"attendu ${KJEMO_NB_SPARE}, lu ${kjemo_spare_vu}\" \\",
      "      'Le nombre de disques de secours lu ne correspond pas a la demande. L ensemble existe, mais ne compte pas sur un secours qui n est pas la.'",
      '  else',
      "    kjemo_resultat 'RAID' 'Secours declare' 'OK' \"${kjemo_spare_vu}\" \\",
      "      'Le nombre de disques de secours lu correspond a la demande.'",
      '  fi',
      '  # La synchronisation initiale d un miroir est NORMALE et peut durer',
      '  # longtemps. L ensemble est utilisable pendant ce temps, mais la',
      '  # redondance n est pas encore complete : le dire evite qu on debranche un',
      '  # disque en croyant le miroir pret.',
      '  case "${kjemo_mdstat}" in',
      '    *resync*|*recovery*)',
      "      kjemo_resultat 'RAID' 'Synchronisation' 'ATTENTION' 'en cours' \\",
      "        'La synchronisation initiale tourne. L ensemble est utilisable, mais la redondance n est pas encore complete : ne retire aucun disque avant la fin. Suivi : watch -n 5 cat /proc/mdstat'",
      '      ;;',
      '    *)',
      "      kjemo_resultat 'RAID' 'Synchronisation' 'INFO' 'non signalee' \\",
      "        'Verifie avec cat /proc/mdstat : sur de petits disques, la synchronisation peut etre deja terminee.'",
      '      ;;',
      '  esac',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - mkfs SUR L ENSEMBLE, JAMAIS SUR UN MEMBRE',
      '#',
      '# C est l erreur la plus couteuse du sujet. « mkfs.ext4 /dev/sdb » sur un',
      '# membre detruit les metadonnees du RAID : l ensemble se degrade, et le',
      '# systeme de fichiers cree est invisible une fois l ensemble reassemble.',
      '# La bonne cible est /dev/mdX, et le script le verifie avant d agir.',
      '# ---------------------------------------------------------------------------',
      '  case "${KJEMO_ENS}" in',
      '    /dev/md[0-9]*) : ;;',
      '    *)',
      "      printf '%s\\n' 'ARRET : la cible de mkfs n est pas un /dev/mdX.' >&2",
      '      exit 1',
      '      ;;',
      '  esac',
      '  if [ "${KJEMO_ENS}" = "${KJEMO_M1}" ] || [ "${KJEMO_ENS}" = "${KJEMO_M2}" ] \\',
      '    || { [ -n "${KJEMO_SPARE}" ] && [ "${KJEMO_ENS}" = "${KJEMO_SPARE}" ]; }; then',
      "    printf '%s\\n' 'ARRET : la cible de mkfs est un MEMBRE, pas l ensemble.' >&2",
      '    exit 1',
      '  fi',
      '  kjemo_fs_ens="$(lsblk -dn -o FSTYPE -- "${KJEMO_ENS}" 2>/dev/null | tr -d \' \' || true)"',
      '  if [ -n "${kjemo_fs_ens}" ]; then',
      "    kjemo_resultat 'Formatage' \"${KJEMO_ENS}\" 'PROBLEME' \"${kjemo_fs_ens} deja present\" \\",
      "      'L ensemble porte deja un systeme de fichiers. mkfs n est PAS lance.'",
      "    printf '%s\\n' 'ARRET : l ensemble porte deja un systeme de fichiers.' >&2",
      '    exit 1',
      '  fi',
      `  kjemo_mkfs=(mkfs.${fs} "\${KJEMO_ENS}")`,
      '  printf \'%s\\n\' \'Ecriture du systeme de fichiers sur l ensemble...\'',
      '  kjemo_code_mk=0',
      '  "${kjemo_mkfs[@]}" > "${KJEMO_TMP}/mkfs.out" 2>&1 || kjemo_code_mk=$?',
      '  if [ "${kjemo_code_mk}" -ne 0 ]; then',
      "    kjemo_resultat 'Formatage' \"${KJEMO_ENS}\" 'PROBLEME' \"code ${kjemo_code_mk}\" \\",
      "      'mkfs a echoue. /etc/fstab n a PAS ete touche.'",
      // Sortie fatale : le message doit passer par stderr MAINTENANT.
      // kjemo_resultat n imprime qu a la fin du script, et ce script n y
      // arrive pas — c est le defaut des « cinq sorties muettes » du commit
      // 13/n, qui revient des qu une sortie fatale est ajoutee sans sa ligne
      // stderr. Trouve par le banc RAID, passe I3.
      "    printf '%s\\n' 'ARRET : mkfs a echoue. L ensemble RAID existe mais n est pas formate.' >&2",
      "    printf '%s\\n' '/etc/fstab n a PAS ete modifie.' >&2",
      '    cat "${KJEMO_TMP}/mkfs.out" >&2',
      '    exit 1',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - L UUID, PUIS LE MONTAGE PERSISTANT',
      '#',
      '# C est l UUID du systeme de fichiers, et non /dev/mdX, qui va dans',
      '# /etc/fstab : le NUMERO d un ensemble RAID peut changer au reassemblage,',
      '# surtout si /etc/mdadm/mdadm.conf ne le fixe pas.',
      '# ---------------------------------------------------------------------------',
      '  if kjemo_dispo udevadm; then udevadm settle 2>/dev/null || true; fi',
      '  KJEMO_UUID="$(blkid -o value -s UUID -- "${KJEMO_ENS}" 2>/dev/null || true)"',
      '  kjemo_type_fs="$(blkid -o value -s TYPE -- "${KJEMO_ENS}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_UUID}" ] || [ "${kjemo_type_fs}" != "${KJEMO_FS}" ]; then',
      "    kjemo_resultat 'Formatage' 'Relecture' 'PROBLEME' \\",
      '      "UUID ${KJEMO_UUID:-absent}, type ${kjemo_type_fs:-inconnu}" \\',
      '      "Le systeme de fichiers ne se relit pas comme attendu (${KJEMO_FS}). /etc/fstab n a PAS ete touche."',
      "    printf '%s\\n' 'ARRET : le systeme de fichiers ne se relit pas comme attendu.' >&2",
      "    printf '%s\\n' '/etc/fstab n a PAS ete modifie.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Formatage' \"${KJEMO_ENS}\" 'OK' \"${kjemo_type_fs}, UUID ${KJEMO_UUID}\" \\",
      "    'Relu par blkid. C est cet UUID qui va dans /etc/fstab, et non le numero de l ensemble.'",
      '',
      '  kjemo_exiger_chemin_sur "${KJEMO_MP}"',
      '  KJEMO_MP="${KJEMO_CHEMIN_CANON}"',
      '  if [ ! -d "${KJEMO_MP}" ]; then',
      '    mkdir -p -- "${KJEMO_MP}"',
      "    kjemo_resultat 'Montage' 'Point de montage' 'OK' \"${KJEMO_MP} cree\" ''",
      '  fi',
      '  if ! kjemo_fstab_persistant; then',
      "    printf '%s\\n' \"Le systeme de fichiers existe sur ${KJEMO_ENS} et porte l UUID ${KJEMO_UUID},\" >&2",
      "    printf '%s\\n' 'mais il n est pas monte automatiquement.' >&2",
      '    exit 1',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 8 - CE QUI RESTE A FAIRE A LA MAIN, ET POURQUOI',
      '#',
      '# /etc/mdadm/mdadm.conf fixe le NOM de l ensemble au reassemblage. L ecrire',
      '# demande de regenerer l initramfs, et un initramfs rate empeche la machine',
      '# de demarrer. Cet assistant ne le fait pas, et le dit.',
      '# ---------------------------------------------------------------------------',
      "  kjemo_resultat 'A faire a la main' 'mdadm.conf' 'ATTENTION' 'non ecrit' \\",
      "    'Pour fixer le nom de l ensemble au demarrage : mdadm --detail --scan >> /etc/mdadm/mdadm.conf puis update-initramfs -u. Cet assistant ne le fait PAS : un initramfs rate empeche la machine de demarrer, et cette etape merite d etre faite en connaissance de cause.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-raid-creation' }),
    ]);
  },

  gui: [
    'Lance l’inventaire du stockage : il nomme les disques qu’il serait dangereux de toucher.',
    'Vérifie que le nom est libre : « cat /proc/mdstat » ne doit pas montrer md1.',
    'Vérifie que chaque disque est libre : « sudo wipefs -n /dev/sdb » ne doit rien afficher, et « lsblk -f /dev/sdb » aucun point de montage.',
    'Crée l’ensemble : « sudo mdadm --create /dev/md1 --level=raid1 --raid-devices=2 /dev/sdb /dev/sdc ». Avec un secours, ajoute « --spare-devices=1 /dev/sdd ».',
    'Attention aux espaces autour de « --raid-devices=2 » : collés, mdadm lit un seul argument et refuse la commande.',
    'Relis l’état : « cat /proc/mdstat » puis « sudo mdadm --detail /dev/md1 ». Les rôles sont en bas : active sync, spare, faulty.',
    'Formate l’ENSEMBLE, jamais un membre : « sudo mkfs.ext4 /dev/md1 ». « mkfs.ext4 /dev/sdb » détruirait les métadonnées du RAID.',
    'Relève l’UUID : « sudo blkid -o value -s UUID /dev/md1 ».',
    'Ajoute la ligne UUID dans une COPIE de /etc/fstab, valide-la avec « findmnt --verify --tab-file », et seulement ensuite remplace le fichier réel.',
    'Pour fixer le nom au démarrage : « sudo mdadm --detail --scan >> /etc/mdadm/mdadm.conf » puis « sudo update-initramfs -u ».',
  ],

  keywords: ['raid', 'raid1', 'miroir', 'mdadm', 'spare', 'secours', 'mdstat', 'redondance',
    'disque', 'panne', 'reconstruction', 'resync', 'uuid', 'fstab', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Deux disques libres DISTINCTS, et un troisième si tu veux un disque de secours. Tous seront écrasés.',
    'Les données de ces disques sauvegardées ailleurs, si tu n’es pas certain qu’ils sont vides.',
    'mdadm : « sudo apt install mdadm ».',
    'sudo, ou une session root.',
    'L’inventaire du stockage lu AVANT : c’est lui qui dit si un disque porte la racine, du swap, du LVM ou un membre de RAID.',
  ],

  commonErrors: [
    {
      message: 'mdadm: /dev/sdb appears to be part of a raid array',
      code: 'KJEMO',
      cause: 'Le disque porte une signature « linux_raid_member » résiduelle : il a déjà servi dans un ensemble.',
      fix: 'C’est ce que l’étape 3 refuse. Vérifier d’abord ce que contenait cet ensemble ; retirer la signature est destructeur et reste une opération manuelle.',
      command: 'sudo mdadm --examine /dev/sdb',
    },
    {
      message: 'mdadm: unrecognised option \'--raid-devices=2/dev/sdb\'',
      code: 'KJEMO',
      cause: 'Un espace manque autour des arguments : mdadm lit un seul mot collé. Les notes de cours contenaient cette faute.',
      fix: 'Séparer chaque argument par une espace. Le script généré passe les arguments un par un dans un tableau, ce qui rend cette faute impossible.',
      command: 'sudo mdadm --create /dev/md1 --level=raid1 --raid-devices=2 /dev/sdb /dev/sdc',
    },
    {
      message: 'J’ai créé /dev/md0 puis interrogé /dev/md1, et il ne répond pas',
      code: 'KJEMO',
      cause: 'Deux noms différents dans la même procédure. Les notes de cours mélangeaient md0 et md1.',
      fix: 'Choisir un nom et le garder. « cat /proc/mdstat » liste les ensembles réellement assemblés.',
      command: 'cat /proc/mdstat',
    },
    {
      message: 'Le système de fichiers a disparu après un redémarrage',
      code: 'KJEMO',
      cause: 'mkfs a été lancé sur un MEMBRE (/dev/sdb) au lieu de l’ensemble (/dev/md1). Au réassemblage, le RAID réécrit ses métadonnées et le système de fichiers devient invisible.',
      fix: 'Formater /dev/mdX, jamais un membre. Le script le vérifie avant d’agir, de trois façons : la forme du nom, la comparaison avec les membres, et la relecture par blkid.',
      command: 'lsblk -f /dev/md1',
    },
    {
      message: '/dev/hdc : aucun fichier de ce type',
      code: 'ENOENT',
      cause: 'La nomenclature « hd* » est celle des anciens pilotes IDE. Sur un noyau actuel, ce périphérique n’existe pas.',
      fix: 'Utiliser le nom affiché par lsblk dans la colonne PATH. Le formulaire refuse « /dev/hd* » avec cette explication.',
      command: 'lsblk -o NAME,PATH,SIZE,TYPE,MODEL',
    },
    {
      message: 'L’ensemble est créé mais /proc/mdstat affiche « resync » pendant des heures',
      code: 'KJEMO',
      cause: 'C’est la synchronisation initiale du miroir. Elle est normale, et proportionnelle à la taille des disques.',
      fix: 'L’ensemble est utilisable pendant ce temps, mais la redondance n’est pas complète : ne retirer aucun disque avant la fin.',
      command: 'watch -n 5 cat /proc/mdstat',
    },
  ],

  reversible: false,
  verifyAfter: [
    '« cat /proc/mdstat » montre l’ensemble avec [UU] une fois la synchronisation terminée, et un « (S) » si un secours a été déclaré.',
    '« sudo mdadm --detail /dev/md1 » donne le rôle de chaque disque : active sync pour les deux membres, spare pour le secours.',
    '« lsblk -f /dev/md1 » montre le système de fichiers et l’UUID sur l’ENSEMBLE, et aucun système de fichiers sur les membres.',
    '« findmnt /srv/raid » montre le montage, et sa source est l’ensemble.',
    '/etc/fstab contient une ligne UUID= — jamais /dev/mdX — et la sauvegarde horodatée du fichier précédent existe à côté.',
  ],

  rollback: {
    summary: 'Le formatage NE S’ANNULE PAS, et les métadonnées écrites sur les membres rendent leur contenu antérieur inaccessible. Ce qui s’annule : le montage, la ligne de /etc/fstab, et l’ensemble lui-même — qui peut être arrêté et ses signatures retirées, à la main.',
    diagnostic: `# L etat de l ensemble :
cat /proc/mdstat
sudo mdadm --detail /dev/md1
# La ligne ajoutee dans /etc/fstab :
grep -n 'KJEMO IT Toolkit' /etc/fstab
ls -l /etc/fstab.kjemo-*.bak
# Ce qui est monte :
findmnt --mountpoint /srv/raid`,
    command: `# 1. Demonter :
sudo umount /srv/raid

# 2. Restaurer /etc/fstab depuis la sauvegarde horodatee :
sudo cp -p /etc/fstab.kjemo-AAAAMMJJ-HHMMSS.bak /etc/fstab
sudo findmnt --verify

# 3. Arreter l ensemble :
sudo mdadm --stop /dev/md1

# 4. Retirer les metadonnees RAID des disques, SI tu veux les reutiliser
#    autrement. C est DESTRUCTEUR et volontairement laisse a la main :
#    sudo mdadm --zero-superblock /dev/sdb
#    sudo mdadm --zero-superblock /dev/sdc
#
# 5. Le systeme de fichiers ecrit par mkfs ne s annule pas, et ce que les
#    disques contenaient AVANT la creation de l ensemble non plus : les
#    metadonnees RAID ont ete ecrites par-dessus. Seule une sauvegarde
#    anterieure le rend.
echo 'Montage defait et fstab restaure. Le formatage, lui, est definitif.'`,
    warning: 'Un RAID 1 n’est pas une sauvegarde. Il protège de la panne d’un disque, pas d’une suppression, d’un chiffrement malveillant ni d’une erreur humaine : les deux membres reçoivent la même écriture, y compris la mauvaise. Et pendant la synchronisation initiale, la redondance n’est pas encore complète — retirer un disque à ce moment-là détruit l’ensemble.',
  },

  checks: [
    'Le nom de l’ensemble doit être de la forme /dev/mdX, et il doit être libre : ni fichier existant, ni ensemble dans /proc/mdstat.',
    'Chaque disque — membre ET secours — est examiné séparément : périphérique bloc, non monté, pas la racine ni /boot ni /usr ni /var ni /etc, pas de swap, pas de LVM, pas déjà membre d’un RAID, pas LUKS, aucune signature résiduelle.',
    'Les deux membres actifs doivent être distincts, et le secours distinct des deux. Vérifié dans le formulaire ET dans le script.',
    'Les rôles sont affichés SÉPARÉMENT avant action, avec ce qu’un secours est et n’est pas.',
    '--force n’apparaît pas : il ferait passer mdadm outre ses propres vérifications.',
    'Les arguments de mdadm sont passés un par un dans un tableau : un espace manquant est impossible.',
    'L’ensemble est relu après création — /proc/mdstat ET mdadm --detail — et le périphérique doit exister avant tout formatage.',
    'mkfs ne reçoit que /dev/mdX : la forme du nom est vérifiée, la cible est comparée aux trois disques, et le résultat est relu par blkid.',
    'La synchronisation en cours est signalée comme ATTENTION : la redondance n’est pas encore complète.',
    '/etc/fstab passe par les huit étapes du bloc partagé : copie, validation, sauvegarde, remplacement atomique, relecture, montage confirmé par findmnt.',
    'Aucune simulation de panne : casser un ensemble sain est une procédure de laboratoire, documentée à part.',
    '/etc/mdadm/mdadm.conf n’est pas écrit, et l’assistant dit pourquoi : la régénération d’initramfs qu’elle implique mérite une décision humaine.',
  ],

  source: `${M}/man8/mdadm.8.html`,
  sources: [
    { label: 'mdadm(8)', url: `${M}/man8/mdadm.8.html` },
    { label: 'md(4)', url: `${M}/man4/md.4.html` },
    { label: 'mkfs.ext4 — mke2fs(8)', url: `${M}/man8/mke2fs.8.html` },
    { label: 'blkid(8)', url: `${M}/man8/blkid.8.html` },
    { label: 'fstab(5)', url: `${M}/man5/fstab.5.html` },
    { label: 'findmnt(8)', url: `${M}/man8/findmnt.8.html` },
  ],
};

// ===========================================================================
// ASSISTANT 2 — REMPLACER, RETIRER OU AJOUTER UN MEMBRE
// ===========================================================================

const linuxRaidMemberManage = {
  id: 'linux-raid-member-manage',
  icon: '▲',
  category: CAT,
  subcategory: 'Stockage Linux',
  title: 'Remplacer, retirer ou ajouter un membre de RAID',
  risk: 'caution',
  summary: 'Marque un membre défaillant, le retire, puis ajoute son remplaçant — dans cet ordre, avec relecture de /proc/mdstat et mdadm --detail après chaque commande. Refuse de marquer défaillant un membre quand l’ensemble est DÉJÀ dégradé : il n’y aurait plus de redondance, et l’ensemble serait perdu.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: ['mdadm (apt install mdadm)', 'util-linux — lsblk, wipefs (présent par défaut)'],
  privileges: 'root — mdadm --manage ouvre le périphérique RAID',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'Ne simule aucune panne. Marquer défaillant un membre SAIN pour observer la bascule est une procédure de laboratoire, documentée à part : cet assistant refuse de le faire sur un ensemble dont la redondance est déjà entamée, et ne le propose jamais comme un exercice.',
    'Ne reconstruit pas lui-même : la reconstruction est faite par le noyau, et elle prend le temps qu’elle prend. L’assistant la constate, il ne l’accélère pas.',
    'N’efface aucune signature. Un disque qui a déjà servi dans un autre ensemble est refusé à l’ajout plutôt que nettoyé automatiquement.',
    'Ne traite qu’un membre à la fois. Remplacer deux disques d’un miroir demande d’attendre la fin de la première reconstruction, et l’assistant le dit.',
    'N’écrit pas /etc/mdadm/mdadm.conf.',
  ],

  fields: [
    {
      id: 'ensemble',
      label: 'Ensemble RAID',
      type: 'text',
      default: '/dev/md1',
      placeholder: '/dev/md1',
      help: 'L’ensemble à modifier, tel que /proc/mdstat le nomme.',
    },
    {
      id: 'membreSortant',
      label: 'Membre à retirer',
      type: 'text',
      default: '/dev/sdc',
      optionnel: true,
      placeholder: '/dev/sdc',
      help: 'Le disque défaillant ou à remplacer. Laisse vide pour AJOUTER seulement, sans rien retirer — c’est ce qu’il faut pour compléter un ensemble déjà dégradé. L’opération est déduite de ce que tu remplis : les deux champs → remplacement ; celui-ci seul → retrait ; l’autre seul → ajout.'
    },
    {
      id: 'membreEntrant',
      label: 'Disque à ajouter',
      type: 'text',
      default: '/dev/sdd',
      optionnel: true,
      placeholder: '/dev/sdd',
      help: 'Le remplaçant. Il doit être libre : aucune signature, aucun montage. Laisse vide pour RETIRER seulement, sans rien ajouter — l’ensemble reste alors dégradé, et le rapport le dit.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le nom de l’ensemble',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: '/dev/md1',
      help: 'Laisse vide pour obtenir un script qui DIAGNOSTIQUE sans rien modifier.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const e = validerEnsemble(v.ensemble);
    if (!e.ok) errors.ensemble = e.error;

    // ---------------------------------------------------------------------
    // L'OPÉRATION EST DÉDUITE, ET NON CHOISIE DANS UNE LISTE
    //
    // Une liste « Remplacer / Retirer / Ajouter » à côté de deux champs de
    // disque permet de les contredire : choisir « Ajouter » en ayant rempli
    // le membre sortant, ou « Remplacer » en laissant un champ vide. Il
    // faudrait alors refuser la combinaison, et expliquer laquelle des trois
    // saisies est fautive — alors qu'aucune ne l'est séparément.
    //
    // Les deux champs suffisent, et ils ne peuvent pas se contredire :
    //
    //   les deux remplis   → remplacement : fail, remove, puis add
    //   sortant seul       → retrait, l'ensemble reste dégradé
    //   entrant seul       → ajout, pour compléter un ensemble dégradé
    //   les deux vides     → rien à faire, et c'est refusé
    //
    // Le script généré affiche l'opération déduite, pour qu'elle soit relue.
    // ---------------------------------------------------------------------
    const sortant = String(v.membreSortant ?? '').trim();
    const entrant = String(v.membreEntrant ?? '').trim();

    if (sortant === '' && entrant === '') {
      errors.membreSortant = 'Renseigne au moins un disque : celui à retirer, celui à ajouter, ou les deux pour un remplacement. Les deux champs vides ne décrivent aucune opération.';
      errors.membreEntrant = 'Renseigne au moins un disque : celui à retirer, celui à ajouter, ou les deux pour un remplacement.';
    }
    if (sortant !== '') {
      const r = validerMembre(sortant, 'Le membre à retirer');
      if (!r.ok) errors.membreSortant = r.error;
    }
    if (entrant !== '') {
      const r = validerMembre(entrant, 'Le disque à ajouter');
      if (!r.ok) errors.membreEntrant = r.error;
    }
    if (sortant !== '' && sortant === entrant) {
      errors.membreEntrant = 'Le disque à ajouter est le même que celui à retirer. Pour réintégrer le même disque après un incident, retire-le d’abord, vérifie son état avec « smartctl -a », puis ajoute-le dans une seconde passe : un disque qui a vraiment lâché ne doit pas revenir sans examen.';
    }
    if (sortant !== '' && sortant === String(v.ensemble ?? '').trim()) {
      errors.membreSortant = 'Le membre à retirer ne peut pas être l’ensemble lui-même.';
    }

    const conf = String(v.confirmation ?? '').trim();
    if (conf !== '' && conf !== String(v.ensemble ?? '').trim()) {
      errors.confirmation = `La confirmation ne correspond pas au nom de l’ensemble. Retape exactement : ${String(v.ensemble ?? '').trim()}`;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const ens = String(v.ensemble).trim();
    const sortant = String(v.membreSortant ?? '').trim();
    const entrant = String(v.membreEntrant ?? '').trim();
    const operation = sortant !== '' && entrant !== '' ? 'Remplacer'
      : sortant !== '' ? 'Retirer' : 'Ajouter';

    return assemblerSh([
      ...enteteBash({
        titre: 'Remplacer, retirer ou ajouter un membre de RAID',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'mdadm --manage ouvre le peripherique RAID',
      }),
      ...blocVariablesBash([
        ['KJEMO_ENS', shQuote(ens)],
        ['KJEMO_OP', shQuote(operation)],
        ['KJEMO_SORTANT', shQuote(sortant)],
        ['KJEMO_ENTRANT', shQuote(entrant)],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      ...blocParametresBash([
        ['Ensemble', '${KJEMO_ENS}'],
        ['Operation deduite', '${KJEMO_OP}'],
        ['Membre sortant', '${KJEMO_SORTANT:-aucun}'],
        ['Disque entrant', '${KJEMO_ENTRANT:-aucun}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - L ETAT DE L ENSEMBLE, AVANT TOUT',
      '#',
      '# La question qui decide de tout : l ensemble est-il DEJA degrade ?',
      '#',
      '# Dans un miroir a deux membres, marquer defaillant un membre alors que',
      '# l autre manque deja laisse ZERO redondance : l ensemble devient',
      '# inutilisable, et les donnees avec lui. C est l erreur qu on fait en',
      '# voulant « nettoyer » un ensemble degrade, et elle est definitive.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_ENS_OK=0',
      'KJEMO_DEGRADE=0',
      'KJEMO_RECONSTRUIT=0',
      'if ! kjemo_dispo mdadm; then',
      "  kjemo_resultat 'Prerequis' 'mdadm' 'PROBLEME' 'absent' 'apt install mdadm'",
      'elif [ ! -b "${KJEMO_ENS}" ]; then',
      "  kjemo_resultat 'Ensemble' \"${KJEMO_ENS}\" 'PROBLEME' 'introuvable' \\",
      "    'Aucun peripherique de ce nom. cat /proc/mdstat liste les ensembles assembles.'",
      'else',
      '  kjemo_detail="$(mdadm --detail "${KJEMO_ENS}" 2>/dev/null || true)"',
      '  kjemo_mdstat="$(cat /proc/mdstat 2>/dev/null || true)"',
      '  if [ -z "${kjemo_detail}" ]; then',
      "    kjemo_resultat 'Ensemble' \"${KJEMO_ENS}\" 'PROBLEME' 'illisible' \\",
      "      'mdadm --detail ne rend rien.'",
      '  else',
      '    KJEMO_ENS_OK=1',
      "    kjemo_resultat 'Ensemble' \"${KJEMO_ENS}\" 'INFO' \"${kjemo_detail}\" \\",
      "      'Les lignes du bas donnent le role de chaque disque : active sync, spare, faulty, removed.'",
      "    kjemo_resultat 'Ensemble' '/proc/mdstat' 'INFO' \"${kjemo_mdstat}\" \\",
      "      '[UU] = deux membres sains. [U_] = un membre manquant.'",
      '    case "${kjemo_detail}" in',
      '      *degraded*|*Degraded*)',
      '        KJEMO_DEGRADE=1',
      "        kjemo_resultat 'Ensemble' 'Etat' 'ATTENTION' 'DEGRADE' \\",
      "          'Un membre manque deja : il n y a plus de redondance. Ajouter un disque est possible ; en marquer un defaillant ferait perdre l ensemble.'",
      '        ;;',
      '      *)',
      "        kjemo_resultat 'Ensemble' 'Etat' 'OK' 'non degrade' ''",
      '        ;;',
      '    esac',
      '    case "${kjemo_mdstat}" in',
      '      *recovery*|*resync*)',
      '        KJEMO_RECONSTRUIT=1',
      "        kjemo_resultat 'Ensemble' 'Reconstruction' 'ATTENTION' 'EN COURS' \\",
      "          'Une reconstruction tourne. Toucher aux membres maintenant l interrompt, et la redondance n est pas encore revenue. Attends la fin : watch -n 5 cat /proc/mdstat'",
      '        ;;',
      '    esac',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE MEMBRE SORTANT APPARTIENT-IL A CET ENSEMBLE ?',
      '#',
      '# mdadm refuse de retirer un disque qui n est pas membre, mais le message',
      '# est obscur. Et surtout : se tromper de disque ici, c est marquer',
      '# defaillant un membre SAIN d un autre ensemble.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SORTANT_OK=1',
      "if [ \"${KJEMO_OP}\" != 'Ajouter' ]; then",
      '  KJEMO_SORTANT_OK=0',
      '  if [ -z "${KJEMO_SORTANT}" ]; then',
      "    kjemo_resultat 'Membre sortant' 'Non renseigne' 'PROBLEME' 'vide' \\",
      "      'Cette operation demande un membre a retirer.'",
      '  elif [ "${KJEMO_ENS_OK}" -ne 1 ]; then',
      "    kjemo_resultat 'Membre sortant' \"${KJEMO_SORTANT}\" 'IGNORE' 'ensemble illisible' ''",
      '  else',
      '    case "${kjemo_detail}" in',
      '      *"${KJEMO_SORTANT}"*)',
      '        KJEMO_SORTANT_OK=1',
      "        kjemo_resultat 'Membre sortant' \"${KJEMO_SORTANT}\" 'OK' 'membre de cet ensemble' \\",
      "          'Confirme par mdadm --detail.'",
      '        ;;',
      '      *)',
      "        kjemo_resultat 'Membre sortant' \"${KJEMO_SORTANT}\" 'PROBLEME' 'pas membre' \\",
      "          'Ce disque n apparait pas dans mdadm --detail de cet ensemble. Se tromper ici, c est marquer defaillant le membre sain d un autre ensemble.'",
      '        ;;',
      '    esac',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE DISQUE ENTRANT EST-IL LIBRE ?',
      '# ---------------------------------------------------------------------------',
      'KJEMO_ENTRANT_OK=1',
      "if [ \"${KJEMO_OP}\" != 'Retirer' ]; then",
      '  KJEMO_ENTRANT_OK=0',
      '  if [ -z "${KJEMO_ENTRANT}" ]; then',
      "    kjemo_resultat 'Disque entrant' 'Non renseigne' 'PROBLEME' 'vide' \\",
      "      'Cette operation demande un disque a ajouter.'",
      '  elif [ ! -b "${KJEMO_ENTRANT}" ]; then',
      "    kjemo_resultat 'Disque entrant' \"${KJEMO_ENTRANT}\" 'PROBLEME' 'pas un peripherique bloc' ''",
      '  else',
      '    kjemo_mp_e="$(lsblk -n -o MOUNTPOINTS -- "${KJEMO_ENTRANT}" 2>/dev/null | tr -d \' \' || true)"',
      '    kjemo_sig_e="$(wipefs -n -- "${KJEMO_ENTRANT}" 2>/dev/null || true)"',
      '    if [ -n "${kjemo_mp_e}" ]; then',
      "      kjemo_resultat 'Disque entrant' \"${KJEMO_ENTRANT}\" 'PROBLEME' 'monte' \\",
      "        'Un disque monte ne s ajoute pas a un ensemble : son contenu serait ecrase.'",
      '    elif [ -n "${kjemo_sig_e}" ]; then',
      "      kjemo_resultat 'Disque entrant' \"${KJEMO_ENTRANT}\" 'PROBLEME' 'signature residuelle' \\",
      "        'Ce disque porte une signature. Cet assistant n efface rien : verifie ce qu il contient, puis nettoie-le a la main si tu es sur.'",
      '    else',
      '      KJEMO_ENTRANT_OK=1',
      '      kjemo_taille_e="$(lsblk -dn -o SIZE -- "${KJEMO_ENTRANT}" 2>/dev/null | tr -d \' \' || true)"',
      "      kjemo_resultat 'Disque entrant' \"${KJEMO_ENTRANT}\" 'OK' \"${kjemo_taille_e}, libre\" \\",
      "        'Ni monte, ni porteur de signature. Un disque plus PETIT que les membres serait refuse par mdadm.'",
      '    fi',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LA REGLE QUI PROTEGE L ENSEMBLE',
      '#',
      '# Marquer defaillant un membre d un ensemble DEJA degrade est refuse. Ce',
      '# n est pas une precaution excessive : dans un miroir a deux membres, c est',
      '# la perte de l ensemble, immediate et definitive.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SUR_OK=1',
      "if [ \"${KJEMO_OP}\" != 'Ajouter' ] && [ \"${KJEMO_DEGRADE}\" -eq 1 ]; then",
      '  KJEMO_SUR_OK=0',
      "  kjemo_resultat 'Securite' 'Ensemble degrade' 'PROBLEME' 'refus de marquer defaillant' \\",
      "    'L ensemble a DEJA un membre manquant. En marquer un autre defaillant laisserait zero redondance et perdrait les donnees. Ajoute d abord un disque pour retrouver la redondance : operation « Ajouter seulement ».'",
      'fi',
      'if [ "${KJEMO_RECONSTRUIT}" -eq 1 ]; then',
      '  KJEMO_SUR_OK=0',
      "  kjemo_resultat 'Securite' 'Reconstruction en cours' 'PROBLEME' 'refus d agir' \\",
      "    'Une reconstruction tourne. Toucher aux membres maintenant l interrompt, et la redondance n est pas encore revenue. Attends la fin.'",
      'fi',
      'if [ "${KJEMO_SUR_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Securite' 'Etat compatible' 'OK' 'operation possible' ''",
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: ens,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `agir sur ${ens} : ${operation.toLowerCase()}`,
      }),

      ...blocPorteFinale({
        conditions: [
          ['KJEMO_ENS_OK', 'L ensemble est introuvable ou illisible.'],
          ['KJEMO_SORTANT_OK', 'Le membre a retirer est absent, ou n appartient pas a cet ensemble.'],
          ['KJEMO_ENTRANT_OK', 'Le disque a ajouter est absent, monte, ou porte une signature.'],
          ['KJEMO_SUR_OK', 'L etat de l ensemble ne permet pas cette operation sans risquer de le perdre.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom de l ensemble.'],
        ],
        action: 'la modification des membres',
      }),

      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# L ORDRE : fail, PUIS remove, PUIS add',
      '#',
      '# Il n est pas negociable, et ce n est pas une convention : mdadm REFUSE de',
      '# retirer un membre qui n est pas marque defaillant. Et une relecture a lieu',
      '# APRES CHAQUE commande, parce que « mdadm a rendu 0 » ne dit pas que le',
      '# role du disque a change.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_relire() {',
      '    local etape="${1:-}"',
      '    sleep 1',
      '    local d=\'\' s=\'\'',
      '    d="$(mdadm --detail "${KJEMO_ENS}" 2>/dev/null || true)"',
      '    s="$(cat /proc/mdstat 2>/dev/null || true)"',
      '    if [ -z "${d}" ]; then',
      "      kjemo_resultat 'Relecture' \"${etape}\" 'PROBLEME' 'ensemble illisible' \\",
      "        'mdadm --detail ne rend plus rien apres cette etape.'",
      // L appelant fait « exit 1 » sur ce retour : sans ligne stderr ici, le
      // script mourrait muet, et l operateur ne saurait pas APRES QUELLE
      // etape l ensemble a cesse de repondre — la seule information qui
      // compte a ce moment-la. Meme defaut que les cinq sorties muettes du
      // commit 13/n. Trouve par le banc RAID, passe H2.
      '      printf \'%s\\n\' "ARRET : apres l etape ${etape}, mdadm --detail ne rend plus rien." >&2',
      "      printf '%s\\n' 'Aucune commande suivante n est lancee. Verifie l ensemble a la main : cat /proc/mdstat' >&2",
      '      return 1',
      '    fi',
      "    kjemo_resultat 'Relecture' \"${etape}\" 'INFO' \"${s}\" \\",
      '      "Etat apres ${etape}."',
      '    return 0',
      '  }',
      '',
      "  if [ \"${KJEMO_OP}\" != 'Ajouter' ]; then",
      '    printf \'%s\\n\' \'Marquage du membre comme defaillant...\'',
      '    kjemo_code=0',
      '    mdadm --manage "${KJEMO_ENS}" --fail "${KJEMO_SORTANT}" \\',
      '      > "${KJEMO_TMP}/fail.out" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -ne 0 ]; then',
      "      kjemo_resultat 'fail' \"${KJEMO_SORTANT}\" 'PROBLEME' \"code ${kjemo_code}\" \\",
      "        'Le marquage a echoue. Rien n a ete retire.'",
      "      printf '%s\\n' 'ARRET : mdadm --fail a echoue. Aucun retrait effectue.' >&2",
      '      cat "${KJEMO_TMP}/fail.out" >&2',
      '      exit 1',
      '    fi',
      "    kjemo_resultat 'fail' \"${KJEMO_SORTANT}\" 'OK' 'marque defaillant' ''",
      "    if ! kjemo_relire 'fail'; then exit 1; fi",
      '',
      '    printf \'%s\\n\' \'Retrait du membre...\'',
      '    kjemo_code=0',
      '    mdadm --manage "${KJEMO_ENS}" --remove "${KJEMO_SORTANT}" \\',
      '      > "${KJEMO_TMP}/remove.out" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -ne 0 ]; then',
      "      kjemo_resultat 'remove' \"${KJEMO_SORTANT}\" 'PROBLEME' \"code ${kjemo_code}\" \\",
      "        'Le retrait a echoue. Le membre reste marque defaillant : l ensemble est degrade, et il faut le reparer.'",
      "      printf '%s\\n' 'ARRET : mdadm --remove a echoue. Le membre reste marque defaillant.' >&2",
      '      cat "${KJEMO_TMP}/remove.out" >&2',
      '      exit 1',
      '    fi',
      "    kjemo_resultat 'remove' \"${KJEMO_SORTANT}\" 'OK' 'retire' \\",
      "      'Le disque ne fait plus partie de l ensemble. Ses metadonnees RAID y sont encore : wipefs -n le montrera.'",
      "    if ! kjemo_relire 'remove'; then exit 1; fi",
      '  fi',
      '',
      "  if [ \"${KJEMO_OP}\" != 'Retirer' ]; then",
      '    printf \'%s\\n\' \'Ajout du disque...\'',
      '    kjemo_code=0',
      '    mdadm --manage "${KJEMO_ENS}" --add "${KJEMO_ENTRANT}" \\',
      '      > "${KJEMO_TMP}/add.out" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -ne 0 ]; then',
      "      kjemo_resultat 'add' \"${KJEMO_ENTRANT}\" 'PROBLEME' \"code ${kjemo_code}\" \\",
      "        'L ajout a echoue. L ensemble est degrade s il manque un membre.'",
      "      printf '%s\\n' 'ARRET : mdadm --add a echoue.' >&2",
      '      cat "${KJEMO_TMP}/add.out" >&2',
      '      exit 1',
      '    fi',
      "    kjemo_resultat 'add' \"${KJEMO_ENTRANT}\" 'OK' 'ajoute' \\",
      "      'Le noyau demarre la reconstruction seul.'",
      "    if ! kjemo_relire 'add'; then exit 1; fi",
      '',
      '# ---------------------------------------------------------------------------',
      '# LA RECONSTRUCTION N EST PAS TERMINEE PARCE QUE LA COMMANDE EST REVENUE',
      '#',
      '# mdadm --add rend 0 des que le disque est accepte. La reconstruction, elle,',
      '# tourne dans le noyau pendant des minutes ou des heures. Annoncer',
      '# « termine » ici serait faux, et c est pendant cette fenetre que',
      '# l ensemble n a pas encore retrouve sa redondance.',
      '# ---------------------------------------------------------------------------',
      '    kjemo_etat="$(cat /proc/mdstat 2>/dev/null || true)"',
      '    case "${kjemo_etat}" in',
      '      *recovery*|*resync*)',
      "        kjemo_resultat 'Reconstruction' 'Etat' 'ATTENTION' 'EN COURS' \\",
      "          'La reconstruction tourne. L ensemble n a PAS encore retrouve sa redondance : ne retire aucun disque avant la fin. Suivi : watch -n 5 cat /proc/mdstat'",
      '        ;;',
      '      *)',
      "        kjemo_resultat 'Reconstruction' 'Etat' 'INFO' 'non signalee' \\",
      "          'Aucune reconstruction annoncee par /proc/mdstat. Verifie les roles avec mdadm --detail : sur un spare, l ajout peut etre immediat.'",
      '        ;;',
      '    esac',
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-raid-membre' }),
    ]);
  },

  gui: [
    'Regarde l’état d’abord : « cat /proc/mdstat » puis « sudo mdadm --detail /dev/md1 ».',
    'Si l’ensemble est DÉJÀ dégradé, n’en marque aucun autre défaillant : ajoute d’abord un disque pour retrouver la redondance.',
    'Si une reconstruction tourne, attends la fin : « watch -n 5 cat /proc/mdstat ».',
    'Marque le membre défaillant : « sudo mdadm --manage /dev/md1 --fail /dev/sdc ».',
    'Retire-le : « sudo mdadm --manage /dev/md1 --remove /dev/sdc ». mdadm refuse de retirer un membre non marqué défaillant — l’ordre n’est pas une convention.',
    'Vérifie entre chaque étape : « sudo mdadm --detail /dev/md1 ».',
    'Ajoute le remplaçant : « sudo mdadm --manage /dev/md1 --add /dev/sdd ».',
    'La reconstruction démarre seule. « mdadm --add » rend 0 dès que le disque est accepté : ce n’est PAS la fin de la reconstruction.',
    'Suis-la : « watch -n 5 cat /proc/mdstat ». Tant qu’elle tourne, la redondance n’est pas revenue.',
  ],

  keywords: ['raid', 'mdadm', 'fail', 'remove', 'add', 'membre', 'remplacer', 'degrade',
    'reconstruction', 'recovery', 'spare', 'secours', 'panne', 'disque', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Un ensemble RAID assemblé et lisible par « mdadm --detail ».',
    'Pour un remplacement : un disque de remplacement libre, au moins aussi grand que les membres actuels.',
    'Aucune reconstruction en cours. L’assistant refuse d’agir pendant une reconstruction.',
    'sudo, ou une session root.',
  ],

  commonErrors: [
    {
      message: 'mdadm: hot remove failed for /dev/sdc: Device or resource busy',
      code: 'EBUSY',
      cause: 'Le membre n’est pas marqué défaillant : mdadm refuse de retirer un disque actif.',
      fix: 'Marquer défaillant d’abord. C’est l’ordre fail → remove → add, et c’est mdadm qui l’impose.',
      command: 'sudo mdadm --manage /dev/md1 --fail /dev/sdc',
    },
    {
      message: 'J’ai marqué défaillant un membre d’un ensemble déjà dégradé, et tout a disparu',
      code: 'KJEMO',
      cause: 'Dans un miroir à deux membres dégradé, il ne reste qu’un membre valide. En marquer un second défaillant laisse zéro redondance : l’ensemble devient inutilisable.',
      fix: 'C’est exactement ce que cet assistant refuse. La réparation d’un ensemble dégradé commence par AJOUTER un disque, pas par en retirer un.',
      command: 'cat /proc/mdstat',
    },
    {
      message: 'mdadm: /dev/sdd not large enough to join array',
      code: 'KJEMO',
      cause: 'Le disque de remplacement est plus petit que les membres actuels, même de quelques secteurs.',
      fix: 'Utiliser un disque au moins aussi grand. Entre deux modèles de « 1 To », la taille réelle diffère souvent de quelques Mio.',
      command: 'lsblk -o NAME,PATH,SIZE',
    },
    {
      message: 'mdadm --add a rendu 0, j’ai cru que c’était fini, et l’ensemble est tombé au redémarrage',
      code: 'KJEMO',
      cause: 'La commande rend 0 dès que le disque est accepté. La reconstruction tourne ensuite dans le noyau, et pendant ce temps la redondance n’est pas revenue.',
      fix: 'Attendre la fin avant toute autre opération. L’assistant signale la reconstruction en ATTENTION, et ne l’annonce jamais terminée sur la base du code de retour.',
      command: 'watch -n 5 cat /proc/mdstat',
    },
    {
      message: 'Le disque retiré est encore reconnu comme membre quand je le rebranche',
      code: 'KJEMO',
      cause: 'Ses métadonnées RAID sont toujours écrites dessus : « remove » le sort de l’ensemble, il ne nettoie pas le disque.',
      fix: 'Les voir avec « wipefs -n ». Les retirer est destructeur et reste une opération manuelle, à faire après avoir vérifié ce que ce disque contient.',
      command: 'sudo wipefs -n /dev/sdc',
    },
  ],

  reversible: true,
  verifyAfter: [
    '« cat /proc/mdstat » montre l’ensemble, et la ligne de reconstruction si elle tourne.',
    '« sudo mdadm --detail /dev/md1 » montre le nouveau disque en « spare rebuilding » puis « active sync » à la fin.',
    'Le nombre de membres actifs est revenu à celui attendu une fois la reconstruction terminée.',
    'Le rapport contient l’état de l’ensemble APRÈS chaque commande, et non seulement à la fin.',
  ],

  rollback: {
    summary: 'Réversible dans la plupart des cas : un disque retiré par erreur peut être rajouté, et il sera reconstruit. Ce qui ne s’annule pas : le temps de reconstruction, et la fenêtre sans redondance qu’il ouvre.',
    diagnostic: `# L etat actuel :
cat /proc/mdstat
sudo mdadm --detail /dev/md1
# Ce que le disque retire porte encore :
sudo mdadm --examine /dev/sdc
sudo wipefs -n /dev/sdc`,
    command: `# Rajouter un disque retire par erreur :
sudo mdadm --manage /dev/md1 --add /dev/sdc

# Suivre la reconstruction, qui redemarre de zero :
watch -n 5 cat /proc/mdstat

# ATTENTION : si le disque a ete retire parce qu il lachait, le rajouter
# sans examen remet le probleme dans l ensemble. Verifie d abord :
sudo smartctl -a /dev/sdc

# Si l ensemble a ete PERDU (deux membres defaillants sur un miroir),
# aucune commande ne le reconstruit : il faut le reassembler de force, ce
# qui est une operation de derniere chance, ou restaurer une sauvegarde.
echo 'Un disque rajoute est reconstruit. Le temps, lui, ne se rattrape pas.'`,
    warning: 'Pendant une reconstruction, l’ensemble n’a pas retrouvé sa redondance : une seconde panne à ce moment-là le perd. C’est la raison pour laquelle cet assistant refuse d’agir tant qu’une reconstruction tourne, et pourquoi il ne déclare jamais la reconstruction terminée sur la base du code de retour de mdadm.',
  },

  checks: [
    'L’état de l’ensemble est lu AVANT toute action, par /proc/mdstat ET mdadm --detail.',
    'Marquer défaillant un membre d’un ensemble DÉJÀ dégradé est refusé : ce serait la perte de l’ensemble.',
    'Agir pendant une reconstruction est refusé : la redondance n’est pas revenue.',
    'Le membre à retirer doit apparaître dans mdadm --detail de CET ensemble.',
    'Le disque à ajouter doit être libre : non monté, sans signature résiduelle.',
    'L’ordre fail → remove → add est imposé par la structure du script, et il est vérifié par le banc.',
    'Une relecture a lieu APRÈS CHAQUE commande mdadm, et un ensemble devenu illisible arrête le script.',
    'La reconstruction n’est jamais annoncée terminée sur la base du code de retour : /proc/mdstat est relu.',
    'Aucune signature n’est effacée : un disque qui a déjà servi est refusé, pas nettoyé.',
    '--force n’apparaît pas.',
  ],

  source: `${M}/man8/mdadm.8.html`,
  sources: [
    { label: 'mdadm(8)', url: `${M}/man8/mdadm.8.html` },
    { label: 'md(4)', url: `${M}/man4/md.4.html` },
    { label: 'lsblk(8)', url: `${M}/man8/lsblk.8.html` },
    { label: 'wipefs(8)', url: `${M}/man8/wipefs.8.html` },
  ],
};

export const toolsLinuxF = [
  linuxRaid1Create,
  linuxRaidMemberManage,
];
