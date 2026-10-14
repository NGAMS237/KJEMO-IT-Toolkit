/**
 * outils-linux-c.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Catalogue Linux, troisième partie : Stockage Linux.
 *
 * Ce fichier commence par l'OBSERVATION, et ce n'est pas un ordre arbitraire.
 * Partitionner, formater, monter de façon persistante, activer des quotas ou
 * créer un RAID sont des actes où le mauvais choix de cible ne se défait pas.
 * Avant tout assistant qui écrit, il faut un assistant qui montre — et qui
 * montre ASSEZ pour que la cible soit choisie en connaissance de cause :
 *
 *   - le disque porte-t-il la racine, /boot, le swap ?
 *   - est-il monté, même ailleurs que là où on l'attend ?
 *   - appartient-il à un groupe de volumes LVM, à un ensemble RAID ?
 *   - porte-t-il déjà une table de partitions, un système de fichiers ?
 *
 * Les six premières questions ont une réponse lisible par un humain. La
 * dernière demande `wipefs -n`, et c'est le seul endroit de ce fichier où une
 * commande normalement destructrice apparaît : `-n` est son mode « ne fais
 * rien », qui se contente de LISTER les signatures trouvées. Le scanner de
 * sûreté le signale quand même, et son exception exige la présence de `-n` —
 * de sorte qu'un futur `wipefs -a` serait refusé.
 *
 * Aucun module de ce fichier n'importe generators.mjs : même discipline qu'aux
 * lots précédents, pour éviter un cycle ESM.
 */

import { assertValid } from './noyau.mjs';
import {
  shQuote, assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocParametresBash, blocVariablesBash, blocRapportBash, blocPrivilegesBash,
} from './noyau-bash.mjs';
import { validateChoix, validateEntierBorne } from './validateurs-linux.mjs';

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
// SOUS-RUBRIQUE 10 — STOCKAGE LINUX
// ===========================================================================

/**
 * Les colonnes demandées à lsblk, explicitement.
 *
 * `lsblk` sans `-o` rend un format par DÉFAUT qui change d'une version à
 * l'autre : des colonnes apparaissent, d'autres se déplacent. Un script qui le
 * lit à l'aveugle fonctionne sur la machine où il a été écrit et se trompe
 * ailleurs — silencieusement, en lisant la mauvaise colonne. On demande donc
 * les colonnes par leur NOM, et `-P` les rend sous forme `CLEF="valeur"`, qui
 * se lit sans compter les espaces.
 */
const COLONNES_LSBLK = 'NAME,KNAME,PATH,SIZE,TYPE,FSTYPE,UUID,PARTUUID,LABEL,'
  + 'MOUNTPOINTS,RO,RM,ROTA,MODEL,PKNAME';

const linuxStorageDiagnostic = {
  id: 'linux-storage-diagnostic',
  icon: '△',
  category: CAT,
  subcategory: 'Stockage Linux',
  title: 'Inventaire du stockage avant toute intervention',
  risk: 'diagnostic',
  summary: 'Inventorie disques, partitions, systèmes de fichiers, UUID, montages, LVM, RAID logiciel et signatures résiduelles. Nomme les périphériques qu’il serait dangereux de toucher : racine, /boot, swap, membre de RAID, volume LVM. N’écrit rien, ne monte rien, n’efface rien.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'util-linux — lsblk, blkid, findmnt, fdisk, wipefs (présent par défaut)',
    'coreutils — df (présent par défaut)',
    'mdadm (seulement si la machine utilise du RAID logiciel)',
    'lvm2 (seulement si la machine utilise LVM)',
  ],
  privileges: 'aucun pour l’essentiel ; root pour les signatures, la table de partitions et le détail RAID',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: null,
  limites: [
    'Ne partitionne pas, ne formate pas, ne monte pas, n’efface aucune signature. C’est un inventaire, et son seul rôle est de permettre de CHOISIR une cible.',
    'Ne voit pas l’intérieur des volumes chiffrés fermés : un LUKS non ouvert apparaît comme crypto_LUKS, et son contenu reste inconnu.',
    'Un disque branché par USB apparaît comme les autres. La colonne RM indique l’amovibilité, mais une baie externe en SATA n’est pas marquée amovible pour autant.',
    'Sur un hyperviseur, « le disque » est un fichier ou un volume côté hôte : ce que voit cet inventaire est ce que la machine virtuelle en perçoit, pas la réalité physique.',
    'Ne décide rien à ta place. Il nomme les dangers ; le choix de la cible reste humain.',
  ],

  fields: [
    {
      id: 'cible',
      label: 'Périphérique à examiner',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: '/dev/sdb',
      help: 'Laisse vide pour inventorier TOUT le stockage de la machine — c’est le cas normal avant une intervention. Renseigne un périphérique pour n’examiner que celui-là, par exemple avant de le partitionner.',
    },
    {
      id: 'inclureSignatures',
      label: 'Chercher les signatures résiduelles',
      type: 'select',
      default: 'Oui',
      options: [['Oui', 'Oui — recommandé avant de partitionner'], ['Non', 'Non']],
      help: 'Utilise « wipefs -n », le mode qui LISTE sans rien effacer. Un disque qui paraît vide peut porter une ancienne signature de système de fichiers ou de RAID, et elle reviendra hanter la suite.',
    },
    {
      id: 'inclureRaid',
      label: 'Détailler le RAID logiciel',
      type: 'select',
      default: 'Oui',
      options: [['Oui', 'Oui'], ['Non', 'Non']],
      help: 'Lit /proc/mdstat puis « mdadm --detail » pour chaque ensemble trouvé. Sans RAID sur la machine, la section le dit et passe.',
    },
    {
      id: 'tailleMiniGio',
      label: 'Seuil d’espace libre jugé bas (Gio)',
      type: 'number',
      default: '2',
      min: '0',
      max: '1024',
      help: 'Un système de fichiers dont il reste moins que cela est signalé. Mettre 0 désactive le seuil.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const cible = String(v.cible ?? '').trim();
    if (cible !== '') {
      // Volontairement plus strict que « chemin absolu » : ce champ ne doit
      // accepter qu'un noeud de périphérique. Un chemin de dossier passé ici
      // par méprise ferait échouer les commandes une par une, avec des
      // messages obscurs, au lieu d'être refusé tout de suite et clairement.
      if (!/^\/dev\/[A-Za-z0-9/_+-]+$/.test(cible)) {
        errors.cible = 'Le périphérique doit être un nœud sous /dev, par exemple /dev/sdb ou /dev/nvme0n1. Laisse vide pour inventorier toute la machine.';
      } else if (/\.\./.test(cible)) {
        errors.cible = 'Le chemin ne doit pas contenir « .. ».';
      }
    }
    const s = validateChoix(v.inclureSignatures, ['Oui', 'Non'], 'Le choix des signatures');
    if (!s.ok) errors.inclureSignatures = s.error;
    const r = validateChoix(v.inclureRaid, ['Oui', 'Non'], 'Le choix du détail RAID');
    if (!r.ok) errors.inclureRaid = r.error;
    const t = validateEntierBorne(v.tailleMiniGio, 0, 1024, 'Le seuil d’espace libre');
    if (!t.ok) errors.tailleMiniGio = t.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    return assemblerSh([
      ...enteteBash({
        titre: 'Inventaire du stockage : disques, partitions, montages, LVM, RAID',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_CIBLE', shQuote(String(v.cible ?? '').trim())],
        ['KJEMO_SIGNATURES', shQuote(String(v.inclureSignatures))],
        ['KJEMO_RAID', shQuote(String(v.inclureRaid))],
        ['KJEMO_SEUIL_GIO', shQuote(String(v.tailleMiniGio))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
        ['KJEMO_COLONNES', shQuote(COLONNES_LSBLK)],
      ]),
      ...blocParametresBash([
        ['Cible', '${KJEMO_CIBLE:-toute la machine}'],
        ['Signatures residuelles', '${KJEMO_SIGNATURES}'],
        ['Detail RAID', '${KJEMO_RAID}'],
        ['Seuil espace libre', '${KJEMO_SEUIL_GIO} Gio'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# 0. CE QUI EST ROOT, ET CE QUI NE L EST PAS',
      '#',
      '# lsblk, findmnt et df lisent sans privilege. blkid, fdisk -l, wipefs -n et',
      '# mdadm --detail ont besoin de root pour ouvrir les peripheriques bruts.',
      '# Sans sudo, ce script fonctionne et le dit : les sections concernees sont',
      '# marquees IGNORE au lieu de paraitre vides. Une section vide se lit comme',
      '# "rien a signaler", ce qui est le contraire de "je n ai pas pu regarder".',
      '# ---------------------------------------------------------------------------',
      'KJEMO_ROOT=0',
      'if [ "$(id -u)" -eq 0 ]; then KJEMO_ROOT=1; fi',
      'if [ "${KJEMO_ROOT}" -ne 1 ]; then',
      "  kjemo_resultat 'Droits' 'Execution sans root' 'ATTENTION' 'id != 0' \\",
      "    'Les signatures, la table de partitions et le detail RAID demandent root : relance avec sudo pour un inventaire complet.'",
      'else',
      "  kjemo_resultat 'Droits' 'Execution avec root' 'OK' 'id = 0' \\",
      "    'Inventaire complet possible.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 1. L INVENTAIRE, EN COLONNES DEMANDEES EXPLICITEMENT',
      '#',
      '# Jamais le format par defaut de lsblk : il change d une version a l autre.',
      '# -P rend des paires CLEF="valeur", qui se lisent sans compter les espaces.',
      '# ---------------------------------------------------------------------------',
      'if ! kjemo_dispo lsblk; then',
      "  kjemo_resultat 'Inventaire' 'lsblk' 'PROBLEME' 'absent' \\",
      "    'util-linux est absent : cet inventaire ne peut pas etre fait. Installe-le avec apt install util-linux.'",
      'else',
      '  kjemo_lsblk="${KJEMO_TMP}/lsblk.txt"',
      '  if [ -n "${KJEMO_CIBLE}" ]; then',
      '    lsblk -P -o "${KJEMO_COLONNES}" -- "${KJEMO_CIBLE}" > "${kjemo_lsblk}" 2>/dev/null || : > "${kjemo_lsblk}"',
      '  else',
      '    lsblk -P -o "${KJEMO_COLONNES}" > "${kjemo_lsblk}" 2>/dev/null || : > "${kjemo_lsblk}"',
      '  fi',
      '  if [ ! -s "${kjemo_lsblk}" ]; then',
      "    kjemo_resultat 'Inventaire' 'Lecture de lsblk' 'PROBLEME' \"${KJEMO_CIBLE:-tous}\" \\",
      "      'lsblk ne rend rien. Si une cible a ete donnee, verifie qu elle existe : ls -l le dira.'",
      '  else',
      '',
      '# La sortie -P se lit ligne par ligne. eval est volontairement ECARTE ici :',
      '# il reinterpreterait la ligne comme du code, ce qui annulerait toute',
      '# protection. On extrait chaque champ avec sed, ce qui est plus long a',
      '# ecrire et strictement plus sur.',
      '    kjemo_champ() {',
      '      printf \'%s\\n\' "$2" | sed -n "s/.*$1=\\"\\([^\\"]*\\)\\".*/\\\\1/p"',
      '    }',
      '    while IFS= read -r kjemo_l; do',
      '      if [ -z "${kjemo_l}" ]; then continue; fi',
      '      kjemo_nom="$(kjemo_champ NAME "${kjemo_l}")"',
      '      kjemo_type="$(kjemo_champ TYPE "${kjemo_l}")"',
      '      kjemo_taille="$(kjemo_champ SIZE "${kjemo_l}")"',
      '      kjemo_fs="$(kjemo_champ FSTYPE "${kjemo_l}")"',
      '      kjemo_uuid="$(kjemo_champ UUID "${kjemo_l}")"',
      '      kjemo_mp="$(kjemo_champ MOUNTPOINTS "${kjemo_l}")"',
      '      kjemo_ro="$(kjemo_champ RO "${kjemo_l}")"',
      '      kjemo_modele="$(kjemo_champ MODEL "${kjemo_l}")"',
      '',
      '# ---------------------------------------------------------------------------',
      '# LES CINQ DANGERS, NOMMES UN PAR UN',
      '#',
      '# C est la raison d etre de cet inventaire. Un disque peut etre dangereux a',
      '# toucher pour cinq raisons differentes, et chacune se lit a un endroit',
      '# different : le point de montage pour la racine et /boot, le TYPE pour le',
      '# swap et le RAID, le FSTYPE pour LVM. Les confondre ferait rater un cas.',
      '# ---------------------------------------------------------------------------',
      '      kjemo_danger=\'\'',
      '      case "${kjemo_mp}" in',
      "        *'/boot/efi'*) kjemo_danger='partition EFI' ;;",
      "        *'/boot'*)     kjemo_danger='partition de demarrage' ;;",
      '      esac',
      '      case "${kjemo_mp}" in',
      "        '/'|*'\"/\"'*|'/ ') kjemo_danger='SYSTEME DE FICHIERS RACINE' ;;",
      '      esac',
      '      if [ "${kjemo_mp}" = \'/\' ]; then kjemo_danger=\'SYSTEME DE FICHIERS RACINE\'; fi',
      '      if [ "${kjemo_type}" = \'raid1\' ] || [ "${kjemo_type}" = \'raid0\' ] \\',
      '        || [ "${kjemo_type}" = \'raid5\' ] || [ "${kjemo_type}" = \'raid6\' ] \\',
      '        || [ "${kjemo_type}" = \'raid10\' ]; then',
      '        kjemo_danger=\'ensemble RAID assemble\'',
      '      fi',
      '      if [ "${kjemo_fs}" = \'linux_raid_member\' ]; then kjemo_danger=\'MEMBRE d un ensemble RAID\'; fi',
      '      if [ "${kjemo_fs}" = \'LVM2_member\' ]; then kjemo_danger=\'volume physique LVM\'; fi',
      '      if [ "${kjemo_fs}" = \'swap\' ] || [ "${kjemo_type}" = \'swap\' ]; then kjemo_danger=\'SWAP actif ou declare\'; fi',
      '      if [ "${kjemo_fs}" = \'crypto_LUKS\' ]; then kjemo_danger=\'volume chiffre LUKS\'; fi',
      '      if [ -z "${kjemo_danger}" ] && [ -n "${kjemo_mp}" ]; then kjemo_danger=\'MONTE\'; fi',
      '',
      '      kjemo_detail="type ${kjemo_type}, taille ${kjemo_taille}"',
      '      if [ -n "${kjemo_fs}" ]; then kjemo_detail="${kjemo_detail}, fs ${kjemo_fs}"; fi',
      '      if [ -n "${kjemo_uuid}" ]; then kjemo_detail="${kjemo_detail}, UUID ${kjemo_uuid}"; fi',
      '      if [ -n "${kjemo_mp}" ]; then kjemo_detail="${kjemo_detail}, monte sur ${kjemo_mp}"; fi',
      '      if [ "${kjemo_ro}" = \'1\' ]; then kjemo_detail="${kjemo_detail}, LECTURE SEULE"; fi',
      '      if [ -n "${kjemo_modele}" ]; then kjemo_detail="${kjemo_detail}, ${kjemo_modele}"; fi',
      '',
      '      if [ -n "${kjemo_danger}" ]; then',
      "        kjemo_resultat 'Peripheriques' \"${kjemo_nom}\" 'ATTENTION' \"${kjemo_detail}\" \\",
      '          "NE PAS TOUCHER sans savoir : ${kjemo_danger}."',
      '      else',
      "        kjemo_resultat 'Peripheriques' \"${kjemo_nom}\" 'INFO' \"${kjemo_detail}\" \\",
      "          'Aucun role critique detecte. Cela ne veut pas dire que le peripherique est vide : voir la section des signatures.'",
      '      fi',
      '    done < "${kjemo_lsblk}"',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 2. CE QUI EST REELLEMENT MONTE',
      '#',
      '# findmnt lit /proc/self/mountinfo, c est-a-dire l ETAT. /etc/fstab, lui,',
      '# dit l INTENTION : les deux peuvent differer, et c est precisement quand',
      '# ils different qu on se trompe. Un disque monte a la main n est pas dans',
      '# fstab ; une ligne de fstab en echec n est pas montee.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo findmnt; then',
      "  kjemo_controle 'Montages' 'Etat reel des montages' \\",
      "    'findmnt lit l etat ; /etc/fstab dit l intention. Quand les deux different, c est la que les surprises arrivent.' \\",
      '    findmnt --real --output TARGET,SOURCE,FSTYPE,OPTIONS',
      '  # findmnt --verify relit /etc/fstab et dit si le prochain demarrage',
      '  # tiendra. C est le controle qu on voudrait avoir fait AVANT de',
      '  # redemarrer, et apres.',
      '  kjemo_code_v=0',
      '  kjemo_verif="$(findmnt --verify 2>&1)" || kjemo_code_v=$?',
      '  if [ "${kjemo_code_v}" -eq 0 ]; then',
      "    kjemo_resultat 'Montages' 'Coherence de /etc/fstab' 'OK' 'findmnt --verify' \\",
      "      'Aucune anomalie annoncee : le prochain demarrage ne devrait pas bloquer sur fstab.'",
      '  else',
      "    kjemo_resultat 'Montages' 'Coherence de /etc/fstab' 'PROBLEME' \"code ${kjemo_code_v}\" \\",
      '      "findmnt --verify signale un probleme. Corrige-le AVANT de redemarrer : ${kjemo_verif}"',
      '  fi',
      'else',
      "  kjemo_resultat 'Montages' 'findmnt' 'IGNORE' 'absent' 'util-linux incomplet sur cette machine.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 3. ESPACE LIBRE, AVEC LE TYPE DE SYSTEME DE FICHIERS',
      '#',
      '# -T ajoute la colonne du type, qui permet de distinguer d un coup d oeil',
      '# un tmpfs, qui vit en memoire et disparait au redemarrage, d un vrai',
      '# disque. Sans elle, on s inquiete pour un tmpfs plein, ou on ignore un',
      '# disque qui ne l est pas.',
      '# ---------------------------------------------------------------------------',
      'kjemo_df="${KJEMO_TMP}/df.txt"',
      'df -hT --output=source,fstype,size,used,avail,pcent,target 2>/dev/null > "${kjemo_df}" \\',
      '  || df -hT > "${kjemo_df}" 2>/dev/null || : > "${kjemo_df}"',
      'if [ -s "${kjemo_df}" ]; then',
      "  kjemo_resultat 'Espace' 'Systemes de fichiers' 'INFO' \"$(cat \"${kjemo_df}\")\" \\",
      "    'La colonne du type distingue un tmpfs, qui vit en memoire, d un vrai disque.'",
      'fi',
      '# Le seuil, en Kio pour comparer en entiers : df -k rend des Kio partout,',
      '# et comparer des "1,8G" en texte ne marche pas.',
      'if [ "${KJEMO_SEUIL_GIO}" -gt 0 ]; then',
      '  kjemo_seuil_k=$(( KJEMO_SEUIL_GIO * 1024 * 1024 ))',
      '  while IFS=\' \' read -r kjemo_src kjemo_dispo_k kjemo_cible_mp; do',
      '    if [ -z "${kjemo_dispo_k:-}" ]; then continue; fi',
      '    case "${kjemo_dispo_k}" in *[!0-9]*) continue ;; esac',
      '    if [ "${kjemo_dispo_k}" -lt "${kjemo_seuil_k}" ]; then',
      "      kjemo_resultat 'Espace' \"${kjemo_cible_mp}\" 'ATTENTION' \\",
      '        "$(( kjemo_dispo_k / 1024 )) Mio libres" \\',
      '        "Moins de ${KJEMO_SEUIL_GIO} Gio libres sur ${kjemo_src}."',
      '    fi',
      "  done <<< \"$(df -k --output=source,avail,target 2>/dev/null | tail -n +2 | awk '{print $1\" \"$2\" \"$3}' || true)\"",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 4. SIGNATURES ET TABLE DE PARTITIONS',
      '#',
      '# wipefs -n est le mode "ne fais rien" : il LISTE les signatures et',
      '# n efface rien. C est la seule facon de repondre a "ce disque est-il',
      '# vraiment vide ?". Un disque sans partition peut porter une ancienne',
      '# signature de systeme de fichiers ou de RAID, et elle reviendra hanter',
      '# la suite : mkfs reussira, puis le noyau redecouvrira l ancien ensemble.',
      '#',
      '# fdisk -l LISTE et SORT. C est le seul mode de fdisk qui ne propose jamais',
      '# d ecrire : sans -l, fdisk ouvre une session interactive sur le disque.',
      '# ---------------------------------------------------------------------------',
      "if [ \"${KJEMO_SIGNATURES}\" = 'Oui' ]; then",
      '  if [ "${KJEMO_ROOT}" -ne 1 ]; then',
      "    kjemo_resultat 'Signatures' 'Lecture des signatures' 'IGNORE' 'root requis' \\",
      "      'wipefs -n et fdisk -l ouvrent les peripheriques bruts : relance avec sudo pour cette section.'",
      '  elif ! kjemo_dispo wipefs; then',
      "    kjemo_resultat 'Signatures' 'wipefs' 'IGNORE' 'absent' 'util-linux incomplet.'",
      '  else',
      '    kjemo_disques=\'\'',
      '    if [ -n "${KJEMO_CIBLE}" ]; then',
      '      kjemo_disques="${KJEMO_CIBLE}"',
      '    else',
      '      kjemo_disques="$(lsblk -dn -o PATH,TYPE 2>/dev/null | awk \'$2 == "disk" { print $1 }\' || true)"',
      '    fi',
      '    if [ -z "${kjemo_disques}" ]; then',
      "      kjemo_resultat 'Signatures' 'Disques a examiner' 'IGNORE' 'aucun' ''",
      '    else',
      '      while IFS= read -r kjemo_d; do',
      '        if [ -z "${kjemo_d}" ]; then continue; fi',
      '        kjemo_sig="$(wipefs -n -- "${kjemo_d}" 2>/dev/null || true)"',
      '        if [ -n "${kjemo_sig}" ]; then',
      "          kjemo_resultat 'Signatures' \"${kjemo_d}\" 'ATTENTION' \"${kjemo_sig}\" \\",
      "            'Des signatures existent. Un mkfs par-dessus reussira, puis le noyau pourra redecouvrir l ancien ensemble : c est la source classique du RAID fantome.'",
      '        else',
      "          kjemo_resultat 'Signatures' \"${kjemo_d}\" 'OK' 'aucune signature' \\",
      "            'Aucune signature residuelle trouvee par wipefs -n.'",
      '        fi',
      '      done <<< "${kjemo_disques}"',
      '      kjemo_controle \'Partitions\' \'Tables de partitions\' \\',
      "        'fdisk -l LISTE et SORT : c est le seul mode de fdisk qui ne propose jamais d ecrire.' \\",
      '        fdisk -l',
      '    fi',
      '  fi',
      'else',
      "  kjemo_resultat 'Signatures' 'Recherche de signatures' 'IGNORE' 'desactivee' \\",
      "    'Section desactivee a la generation. Avant de partitionner un disque, reactive-la.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 5. IDENTITE DES SYSTEMES DE FICHIERS',
      '#',
      '# C est l UUID, et non /dev/sdX, qui doit aller dans /etc/fstab : les',
      '# lettres de peripherique dependent de l ordre de detection, qui change',
      '# quand on ajoute un disque. Un fstab en /dev/sdb1 monte un jour le',
      '# mauvais disque, et le jour ou cela arrive, la machine demarre en mode de',
      '# secours.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo blkid; then',
      "  kjemo_controle 'Identite' 'UUID des systemes de fichiers' \\",
      "    'C est cet UUID, et non /dev/sdX, qui doit aller dans /etc/fstab.' \\",
      '    blkid',
      'else',
      "  kjemo_resultat 'Identite' 'blkid' 'IGNORE' 'root requis ou absent' \\",
      "    'Les UUID restent lisibles sans root par lsblk -f, deja fait plus haut.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 6. RAID LOGICIEL',
      '#',
      '# /proc/mdstat est la source la moins chere et la plus fiable : elle existe',
      '# meme sans mdadm installe. Les crochets disent tout : [UU] signifie deux',
      '# membres sains, [U_] un membre manquant : l ensemble tourne encore mais ne',
      '# protege plus, et personne ne le remarque tant que le second disque tient.',
      '# ---------------------------------------------------------------------------',
      "if [ \"${KJEMO_RAID}\" = 'Oui' ]; then",
      '  if [ ! -r /proc/mdstat ]; then',
      "    kjemo_resultat 'RAID' '/proc/mdstat' 'IGNORE' 'illisible' \\",
      "      'Le noyau n expose pas /proc/mdstat : aucun RAID logiciel sur cette machine.'",
      '  else',
      '    kjemo_md="$(cat /proc/mdstat)"',
      '    kjemo_ensembles="$(awk \'/^md[0-9]+ *:/ { sub(/ *:.*/, \"\", $1); print $1 }\' /proc/mdstat || true)"',
      '    if [ -z "${kjemo_ensembles}" ]; then',
      "      kjemo_resultat 'RAID' 'Ensembles assembles' 'OK' 'aucun' \\",
      "        'Aucun ensemble RAID logiciel actif. La machine peut tout de meme porter des MEMBRES non assembles : voir la section des signatures.'",
      '    else',
      "      kjemo_resultat 'RAID' 'Etat brut' 'INFO' \"${kjemo_md}\" \\",
      "        '[UU] = deux membres sains. [U_] = un membre manquant : l ensemble tourne encore mais ne protege plus.'",
      '      while IFS= read -r kjemo_e; do',
      '        if [ -z "${kjemo_e}" ]; then continue; fi',
      '        case "${kjemo_md}" in',
      '          *"${kjemo_e} :"*|*"${kjemo_e}:"*)',
      '            if printf \'%s\' "${kjemo_md}" | grep -q \'_\'; then',
      "              kjemo_resultat 'RAID' \"/dev/${kjemo_e}\" 'PROBLEME' 'membre manquant' \\",
      "                'Un membre manque ou est en echec. Remplace-le AVANT de toucher au second : un ensemble degrade n a plus de redondance.'",
      '            else',
      "              kjemo_resultat 'RAID' \"/dev/${kjemo_e}\" 'OK' 'tous membres presents' ''",
      '            fi',
      '            ;;',
      '        esac',
      '        if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo mdadm; then',
      "          kjemo_controle 'RAID' \"Detail de /dev/${kjemo_e}\" \\",
      "            'Les roles : membres actifs, disque de secours, membre en echec.' \\",
      '            mdadm --detail "/dev/${kjemo_e}"',
      '        else',
      "          kjemo_resultat 'RAID' \"Detail de /dev/${kjemo_e}\" 'IGNORE' 'root requis ou mdadm absent' \\",
      "            'mdadm --detail ouvre le peripherique : relance avec sudo.'",
      '        fi',
      '      done <<< "${kjemo_ensembles}"',
      '    fi',
      '  fi',
      'else',
      "  kjemo_resultat 'RAID' 'Detail RAID' 'IGNORE' 'desactive' 'Section desactivee a la generation.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# 7. LVM, S IL Y EN A',
      '#',
      '# Un volume physique LVM ne doit jamais etre partitionne ni formate a la',
      '# main : le groupe de volumes qui le contient ne s en remettrait pas, et',
      '# les volumes logiques qui vivent dessus disparaitraient avec lui.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo pvs; then',
      '  if [ "${KJEMO_ROOT}" -eq 1 ]; then',
      "    kjemo_controle 'LVM' 'Volumes physiques' \\",
      "      'Un volume physique LVM ne se partitionne pas a la main : le groupe de volumes ne s en remettrait pas.' \\",
      '      pvs --noheadings',
      '  else',
      "    kjemo_resultat 'LVM' 'Volumes physiques' 'IGNORE' 'root requis' \\",
      "      'pvs demande root. La colonne FSTYPE de l inventaire marque deja les volumes physiques LVM2_member.'",
      '  fi',
      'else',
      "  kjemo_resultat 'LVM' 'Outils LVM' 'OK' 'absents' \\",
      "    'lvm2 n est pas installe : cette machine n utilise pas LVM.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-stockage-linux' }),
    ]);
  },

  gui: [
    'Ouvre un terminal sur la machine, de préférence avec sudo pour un inventaire complet.',
    'Tape « lsblk -f » : tu vois les disques, leurs partitions, le système de fichiers et l’UUID de chacune.',
    'Tape « findmnt » pour ce qui est RÉELLEMENT monté, puis « findmnt --verify » pour savoir si /etc/fstab tiendra au prochain démarrage.',
    'Tape « df -hT » pour l’espace libre, avec le type de système de fichiers.',
    'Tape « sudo wipefs -n /dev/sdX » sur le disque visé : le « -n » liste les signatures SANS rien effacer.',
    'Tape « sudo fdisk -l » pour les tables de partitions. Le « -l » liste et sort : sans lui, fdisk ouvre une session interactive.',
    'Tape « cat /proc/mdstat » : [UU] signifie deux membres sains, [U_] un membre manquant.',
    'Tape « sudo mdadm --detail /dev/md0 » pour les rôles : membres actifs, disque de secours, membre en échec.',
  ],

  keywords: ['stockage', 'disque', 'partition', 'lsblk', 'blkid', 'findmnt', 'df', 'fdisk',
    'wipefs', 'signature', 'uuid', 'montage', 'fstab', 'raid', 'mdadm', 'mdstat', 'lvm',
    'swap', 'inventaire', 'linux', 'ubuntu', 'diagnostic', 'avant de partitionner'],

  requiresAdmin: false,
  prereqs: [
    'util-linux, présent par défaut sur Ubuntu et Debian : il fournit lsblk, blkid, findmnt, fdisk et wipefs.',
    'Un accès terminal, local ou par SSH.',
    'Pour l’inventaire complet — signatures, table de partitions, détail RAID — sudo est nécessaire. Sans lui, le script tourne et marque ces sections IGNORE au lieu de les laisser paraître vides.',
  ],

  commonErrors: [
    {
      message: 'lsblk: /dev/sdz: not a block device',
      code: 'KJEMO',
      cause: 'Le périphérique indiqué n’existe pas sur cette machine, ou son nom a changé depuis le dernier démarrage.',
      fix: 'Relancer sans cible pour inventorier toute la machine, lire la liste, puis viser le bon périphérique. Les lettres /dev/sdX dépendent de l’ordre de détection : elles changent quand on ajoute un disque.',
      command: 'lsblk -o NAME,PATH,SIZE,TYPE,MODEL',
    },
    {
      message: 'wipefs: /dev/sdb: probing initialization failed: Permission denied',
      code: 'EACCES',
      cause: 'wipefs ouvre le périphérique brut, ce qui demande root — même en mode « -n », qui ne fait rien.',
      fix: 'Relancer le script avec sudo. Sans sudo, la section des signatures est marquée IGNORE, et elle ne doit pas être lue comme « aucune signature ».',
      command: 'sudo ./linux-storage-diagnostic.sh',
    },
    {
      message: 'Le disque paraît vide dans lsblk, j’ai fait mkfs, et au redémarrage un ensemble RAID est réapparu',
      code: 'KJEMO',
      cause: 'Le disque portait une signature « linux_raid_member » résiduelle. mkfs écrit son propre en-tête mais ne retire pas les autres signatures, et le noyau redécouvre l’ancien ensemble au démarrage.',
      fix: 'C’est exactement ce que la section des signatures existe pour éviter : « wipefs -n » l’aurait montrée avant. Pour nettoyer, il faut retirer la signature explicitement — opération destructrice, à faire en connaissance de cause, sur un disque dont on a vérifié qu’il ne contient rien d’utile.',
      command: 'sudo wipefs -n /dev/sdb',
    },
    {
      message: 'findmnt --verify signale « unreachable source » sur une ligne de /etc/fstab',
      code: 'KJEMO',
      cause: 'Une entrée de fstab désigne un périphérique ou un UUID absent : disque retiré, UUID changé après un reformatage, ou faute de frappe.',
      fix: 'Corriger la ligne AVANT de redémarrer. Une entrée injoignable sans l’option « nofail » peut faire démarrer la machine en mode de secours.',
      command: 'findmnt --verify',
    },
    {
      message: 'Je ne vois pas mon disque USB dans l’inventaire',
      code: 'KJEMO',
      cause: 'Le disque n’est pas détecté par le noyau, ou la cible donnée au script filtrait l’inventaire sur un autre périphérique.',
      fix: 'Relancer sans cible, puis lire le journal du noyau pour voir si le disque a été détecté à la connexion.',
      command: 'journalctl -k -n 30',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Chaque périphérique apparaît avec son type, sa taille, son système de fichiers, son UUID et son point de montage éventuel.',
    'Tout périphérique portant la racine, /boot, l’EFI, du swap, un membre de RAID, un volume LVM ou un volume chiffré est marqué ATTENTION avec la raison nommée.',
    'La cohérence de /etc/fstab est contrôlée par findmnt --verify, et un problème y apparaît en PROBLEME.',
    'Si sudo n’a pas été utilisé, les sections signatures, table de partitions et détail RAID sont marquées IGNORE — jamais vides sans explication.',
    'L’état du RAID logiciel distingue « tous membres présents » d’un « membre manquant ».',
  ],

  rollback: {
    summary: 'Rien à annuler : ce script lit. Il ne partitionne pas, ne formate pas, ne monte pas, ne démonte pas, n’efface aucune signature et ne touche pas à /etc/fstab.',
    diagnostic: `# Verifier qu aucune table de partitions n a change :
sudo sfdisk --dump /dev/sdX
# Verifier que les montages sont ceux attendus :
findmnt --real
# Verifier que /etc/fstab n a pas ete modifie :
ls -l --time-style=full-iso /etc/fstab`,
    command: `# Rien a annuler : aucune commande modifiante n est executee par ce
# script. wipefs est appele avec -n, son mode "ne fais rien", et fdisk
# avec -l, le seul mode qui liste puis sort.
#
# Si tu as partitionne ou formate APRES avoir lu ce rapport et que tu
# veux revenir en arriere, sache que mkfs ne se defait pas : seule une
# sauvegarde anterieure permet de recuperer les donnees.
echo 'Inventaire en lecture seule : aucune modification a defaire.'`,
    warning: 'Ne lis jamais une section marquée IGNORE comme « rien à signaler ». IGNORE veut dire « je n’ai pas pu regarder », le plus souvent par manque de sudo. Sur la section des signatures, la différence est exactement celle qui sépare un disque vraiment vide d’un disque qui porte encore un ancien ensemble RAID.',
  },

  checks: [
    'lsblk est appelé avec des colonnes demandées explicitement par -o, jamais dans son format par défaut, qui change d’une version à l’autre.',
    'wipefs est appelé avec -n, son mode « ne fais rien ». Le scanner de sûreté exige la présence du -n dans son exception.',
    'fdisk est appelé avec -l, le seul mode qui liste et sort sans proposer d’écrire.',
    'La sortie -P de lsblk est lue avec sed, et non avec eval : eval réinterpréterait la ligne comme du code.',
    'Les cinq rôles dangereux — racine, démarrage, swap, membre de RAID, volume LVM — sont détectés chacun à l’endroit où ils se lisent, et nommés séparément.',
    'Aucune section ne reste vide sans explication : l’absence de droits ou d’outil est marquée IGNORE.',
    'Le dossier temporaire est détruit par la trap de sortie, y compris en cas d’interruption.',
  ],

  source: `${M}/man8/lsblk.8.html`,
  sources: [
    { label: 'lsblk(8)', url: `${M}/man8/lsblk.8.html` },
    { label: 'blkid(8)', url: `${M}/man8/blkid.8.html` },
    { label: 'findmnt(8)', url: `${M}/man8/findmnt.8.html` },
    { label: 'wipefs(8)', url: `${M}/man8/wipefs.8.html` },
    { label: 'fdisk(8)', url: `${M}/man8/fdisk.8.html` },
    { label: 'df(1)', url: `${M}/man1/df.1.html` },
    { label: 'md(4)', url: `${M}/man4/md.4.html` },
    { label: 'mdadm(8)', url: `${M}/man8/mdadm.8.html` },
  ],
};

export const toolsLinuxC = [
  linuxStorageDiagnostic,
];
