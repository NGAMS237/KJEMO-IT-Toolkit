/**
 * outils-linux-d.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Stockage Linux, les assistants qui ECRIVENT.
 *
 * C'est le fichier le plus dangereux du dépôt, et il est écrit comme tel.
 * Partitionner et formater ne se défont pas : il n'existe pas de « ctrl-Z »
 * pour `mkfs`, et la seule annulation réelle est une sauvegarde antérieure des
 * DONNÉES, que cet assistant ne peut pas faire à ta place.
 *
 * ---------------------------------------------------------------------------
 * LA SÉQUENCE, ET POURQUOI ELLE EST DANS CET ORDRE
 * ---------------------------------------------------------------------------
 *   1. prérequis            les outils existent
 *   2. cible                c'est bien un DISQUE, et pas une partition
 *   3. libre                non monté, pas la racine, pas /boot, pas de swap,
 *                           pas membre LVM, pas membre RAID, pas LUKS
 *   4. vierge               aucune signature, aucune table de partitions
 *   5. sauvegarde           `sfdisk --dump`, écrite, RELUE, comparée
 *   6. confirmation         le périphérique exact, retapé
 *   7. PORTE FINALE         les six conditions, celles qui manquent nommées
 *   8. partition            sfdisk, verrou exclusif si disponible
 *   9. RELECTURE            la table est relue AVANT mkfs
 *  10. mkfs                 sur la partition DÉCOUVERTE, jamais devinée
 *  11. RELECTURE            blkid donne le type et l'UUID
 *  12. fstab                copie temporaire → validation → sauvegarde →
 *                           remplacement atomique → relecture → montage
 *
 * L'étape 4 refuse par défaut, et il n'y a volontairement AUCUN champ pour
 * passer outre. Effacer une signature est destructeur : cela reste une
 * opération manuelle, faite en connaissance de cause, sur un disque dont on a
 * vérifié qu'il ne contient rien. Offrir une case « forcer » dans un
 * formulaire, c'est offrir de la cocher sans lire.
 *
 * L'étape 12 n'utilise PAS `mount -a` comme validation. `mount -a` monte tout
 * ce qui est montable et se tait sur ce qu'il ne comprend pas ; il est utile,
 * mais après. La validation est `findmnt --verify --tab-file` sur une COPIE
 * TEMPORAIRE : le fichier réel n'est touché qu'après qu'une copie équivalente
 * a été déclarée valide.
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

/**
 * Un nœud de périphérique, et pas n'importe lequel : un DISQUE ENTIER.
 *
 * Les formes refusées le sont pour une raison précise. `/dev/sdb1` est une
 * PARTITION : y écrire une table de partitions produirait une table dans une
 * partition, que rien ne lirait. `/dev/dm-0` et `/dev/mapper/...` sont des
 * volumes logiques LVM ou des conteneurs chiffrés, qui se gèrent avec leurs
 * propres outils. Le script revérifie de toute façon le TYPE réel avec lsblk :
 * ce contrôle-ci sert à refuser TÔT, avec un message clair, plutôt que tard,
 * avec un message de sfdisk.
 */
function validerDisqueEntier(v) {
  const d = String(v ?? '').trim();
  if (d === '') return { ok: false, error: 'Le périphérique est obligatoire : il n’y a pas de valeur par défaut raisonnable pour un disque à partitionner.' };
  if (!/^\/dev\/[A-Za-z0-9_+-]+$/.test(d)) {
    return { ok: false, error: 'Le périphérique doit être un nœud direct sous /dev, par exemple /dev/sdb ou /dev/nvme0n1. Les chemins /dev/mapper/... et /dev/disk/by-id/... ne sont pas acceptés ici : utilise le nom que lsblk affiche dans la colonne PATH.' };
  }
  if (/^\/dev\/(sd[a-z]+|vd[a-z]+|hd[a-z]+)[0-9]+$/.test(d)
    || /^\/dev\/nvme[0-9]+n[0-9]+p[0-9]+$/.test(d)
    || /^\/dev\/mmcblk[0-9]+p[0-9]+$/.test(d)
    || /^\/dev\/md[0-9]+p[0-9]+$/.test(d)) {
    return { ok: false, error: 'Ceci est une PARTITION, pas un disque. Cet assistant crée une table de partitions sur un disque entier : donne /dev/sdb et non /dev/sdb1.' };
  }
  if (/^\/dev\/(dm-[0-9]+|loop[0-9]+|zram[0-9]+|ram[0-9]+)$/.test(d)) {
    return { ok: false, error: 'Ce périphérique n’est pas un disque physique : dm-* est un volume LVM ou chiffré, loop* un fichier monté, zram*/ram* de la mémoire. Aucun ne se partitionne avec cet assistant.' };
  }
  return { ok: true, value: d };
}

// ===========================================================================
// STOCKAGE LINUX — PARTITIONNEMENT, FORMATAGE, MONTAGE PERSISTANT
// ===========================================================================

const linuxDiskPartitionMount = {
  id: 'linux-disk-partition-mount',
  icon: '▲',
  category: CAT,
  subcategory: 'Stockage Linux',
  title: 'Partitionner, formater et monter un disque de données',
  risk: 'destructive',
  summary: 'Crée une table GPT et une partition unique sur un disque VIERGE, y écrit un système de fichiers, puis ajoute un montage persistant par UUID dans /etc/fstab — après avoir validé une copie temporaire du fichier. Refuse tout disque monté, système, swap, membre LVM ou RAID, et tout disque portant déjà une signature ou une table.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'util-linux — sfdisk, lsblk, blkid, wipefs, findmnt, blockdev (présent par défaut)',
    'e2fsprogs — mkfs.ext4 (présent par défaut)',
    'xfsprogs — mkfs.xfs (seulement si XFS est choisi : apt install xfsprogs)',
  ],
  privileges: 'root — sfdisk, mkfs et l’écriture de /etc/fstab ouvrent le périphérique brut et un fichier système',
  privilegesRequis: 'root',
  readOnly: false,
  service: null,
  limites: [
    'NE RÉCUPÈRE RIEN. mkfs ne se défait pas : il n’existe pas d’annulation pour un formatage, et la seule protection réelle est une sauvegarde des données faite AVANT.',
    'Une seule partition occupant tout le disque. Un découpage en plusieurs partitions, du LVM ou du chiffrement se font avec leurs propres outils et demandent des décisions que cet assistant ne prend pas à ta place.',
    'Refuse un disque portant une signature ou une table, et n’offre AUCUN moyen de passer outre : effacer une signature est destructeur et reste une opération manuelle.',
    'Ne redimensionne, ne déplace et ne supprime aucune partition existante.',
    'Ne monte rien tant que /etc/fstab n’a pas été validé sur une copie temporaire : si la validation échoue, le fichier réel n’est pas touché.',
    'Ne redémarre pas la machine, et ne le propose pas. « mount -a » valide sans redémarrer, et le redémarrage reste une décision humaine.',
  ],

  fields: [
    {
      id: 'peripherique',
      label: 'Disque à partitionner',
      type: 'text',
      default: '/dev/sdb',
      placeholder: '/dev/sdb',
      help: 'Le disque ENTIER, tel que lsblk l’affiche dans la colonne PATH. Lance d’abord l’inventaire du stockage : il nomme les disques qu’il serait dangereux de toucher.',
    },
    {
      id: 'pointMontage',
      label: 'Point de montage',
      type: 'text',
      default: '/srv/donnees',
      placeholder: '/srv/donnees',
      help: 'Le dossier où le système de fichiers sera monté. Il sera créé s’il n’existe pas. S’il existe et contient des fichiers, ceux-ci deviendront invisibles pendant le montage — ils ne sont pas effacés, mais on les croit perdus.',
    },
    {
      id: 'systemeFichiers',
      label: 'Système de fichiers',
      type: 'select',
      default: 'ext4',
      options: [['ext4', 'ext4 — le défaut d’Ubuntu, le mieux connu'], ['xfs', 'xfs — bon sur gros fichiers, ne se réduit pas']],
      help: 'ext4 se réduit et s’agrandit ; xfs s’agrandit seulement. Pour un disque de données ordinaire, ext4 est le choix sûr.',
    },
    {
      id: 'etiquette',
      label: 'Étiquette du système de fichiers',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: 'donnees',
      help: 'Facultatif. Une étiquette rend le disque reconnaissable dans lsblk. Laisse vide pour ne pas en mettre : ext4 accepte 16 caractères, xfs 12.',
    },
    {
      id: 'optionsMontage',
      label: 'Options de montage',
      type: 'select',
      default: 'defaults,nofail',
      options: [
        ['defaults,nofail', 'defaults,nofail — recommandé : un disque absent ne bloque pas le démarrage'],
        ['defaults', 'defaults — strict : un disque absent fait démarrer en mode de secours'],
        ['defaults,noatime,nofail', 'defaults,noatime,nofail — évite d’écrire la date de dernier accès'],
      ],
      help: 'nofail est fortement recommandé pour un disque de données : sans lui, un disque débranché empêche la machine de démarrer normalement.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le périphérique exact',
      type: 'text',
      default: '',
      optionnel: true,
      placeholder: '/dev/sdb',
      help: 'Laisse vide pour obtenir un script qui DIAGNOSTIQUE sans rien écrire : il vérifiera tout et s’arrêtera avant d’agir. Pour autoriser l’écriture, retape ici exactement le même périphérique qu’au-dessus.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const d = validerDisqueEntier(v.peripherique);
    if (!d.ok) errors.peripherique = d.error;

    const mp = validateCheminAbsolu(v.pointMontage, 'Le point de montage');
    if (!mp.ok) errors.pointMontage = mp.error;
    else {
      const p = String(v.pointMontage).trim().replace(/\/+$/, '');
      const INTERDITS = ['', '/', '/boot', '/boot/efi', '/etc', '/bin', '/sbin', '/lib', '/lib64',
        '/usr', '/var', '/dev', '/proc', '/sys', '/run', '/root', '/home'];
      if (INTERDITS.includes(p)) {
        errors.pointMontage = `« ${p || '/'} » ne peut pas être un point de montage pour un disque de données : monter par-dessus un dossier système rend invisible ce qu’il contient, et la machine peut ne plus démarrer. Choisis un dossier dédié, par exemple /srv/donnees ou /mnt/donnees.`;
      }
    }

    const fs = validateChoix(v.systemeFichiers, ['ext4', 'xfs'], 'Le système de fichiers');
    if (!fs.ok) errors.systemeFichiers = fs.error;

    const et = String(v.etiquette ?? '').trim();
    if (et !== '') {
      if (!/^[A-Za-z0-9_-]+$/.test(et)) {
        errors.etiquette = 'L’étiquette ne doit contenir que lettres, chiffres, tirets et soulignés.';
      } else {
        const max = String(v.systemeFichiers) === 'xfs' ? 12 : 16;
        if (et.length > max) {
          errors.etiquette = `L’étiquette dépasse ${max} caractères, la limite de ${v.systemeFichiers}. mkfs la refuserait ou la tronquerait.`;
        }
      }
    }

    const om = validateChoix(v.optionsMontage,
      ['defaults,nofail', 'defaults', 'defaults,noatime,nofail'], 'Les options de montage');
    if (!om.ok) errors.optionsMontage = om.error;

    // La confirmation n'est PAS exigée : il faut pouvoir obtenir et RELIRE le
    // script sans avoir rien confirmé. Mais si elle est fournie, elle doit
    // être exacte — une confirmation approximative serait pire que pas de
    // confirmation du tout.
    const conf = String(v.confirmation ?? '').trim();
    if (conf !== '' && conf !== String(v.peripherique ?? '').trim()) {
      errors.confirmation = `La confirmation ne correspond pas au périphérique. Retape exactement : ${String(v.peripherique ?? '').trim()} — ou laisse vide pour obtenir un script qui diagnostique sans écrire.`;
    }

    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const dev = String(v.peripherique).trim();
    const fs = String(v.systemeFichiers);
    const etiquette = String(v.etiquette ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Partitionner, formater et monter un disque de donnees',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'sfdisk et mkfs ouvrent le peripherique brut, et /etc/fstab appartient a root',
      }),
      ...blocGardienChemin({ lectureSeule: false }),
      ...blocSauvegardeFichier(),
      ...blocVariablesBash([
        ['KJEMO_DEV', shQuote(dev)],
        ['KJEMO_MP', shQuote(String(v.pointMontage).trim().replace(/\/+$/, ''))],
        ['KJEMO_FS', shQuote(fs)],
        ['KJEMO_ETIQUETTE', shQuote(etiquette)],
        ['KJEMO_OPTIONS', shQuote(String(v.optionsMontage))],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
        ['KJEMO_FSTAB', shQuote('/etc/fstab')],
      ]),
      ...blocParametresBash([
        ['Disque', '${KJEMO_DEV}'],
        ['Point de montage', '${KJEMO_MP}'],
        ['Systeme de fichiers', '${KJEMO_FS}'],
        ['Etiquette', '${KJEMO_ETIQUETTE:-aucune}'],
        ['Options de montage', '${KJEMO_OPTIONS}'],
        ['Format', '${KJEMO_FORMAT}'],
      ]),

      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LES OUTILS',
      '#',
      '# Verifier leur presence maintenant evite de s arreter au milieu, entre le',
      '# partitionnement et le formatage, dans l etat le plus inconfortable : un',
      '# disque partitionne et vide, et un operateur qui ne sait pas ou il en est.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      `for kjemo_o in sfdisk lsblk blkid wipefs findmnt mkfs.${fs}; do`,
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' \\",
      '      "Installe-le avant de continuer. Pour mkfs.xfs : apt install xfsprogs."',
      '  fi',
      'done',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LA CIBLE EST-ELLE UN DISQUE ?',
      '#',
      '# Le formulaire a deja refuse /dev/sdb1 et /dev/dm-0 sur leur NOM. Ici on',
      '# verifie le TYPE REEL, parce qu un nom ne prouve rien : on relit lsblk.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_CIBLE_OK=0',
      'if [ ! -b "${KJEMO_DEV}" ]; then',
      "  kjemo_resultat 'Cible' \"${KJEMO_DEV}\" 'PROBLEME' 'pas un peripherique bloc' \\",
      "    'Ce chemin n existe pas ou n est pas un disque. Lance l inventaire du stockage pour voir les peripheriques reels.'",
      'else',
      '  kjemo_type_dev="$(lsblk -dn -o TYPE -- "${KJEMO_DEV}" 2>/dev/null | tr -d \' \' || true)"',
      "  if [ \"${kjemo_type_dev}\" = 'disk' ]; then",
      '    KJEMO_CIBLE_OK=1',
      '    kjemo_taille_dev="$(lsblk -dn -o SIZE -- "${KJEMO_DEV}" 2>/dev/null | tr -d \' \' || true)"',
      "    kjemo_resultat 'Cible' \"${KJEMO_DEV}\" 'OK' \"disque, ${kjemo_taille_dev}\" \\",
      "      'Le type reel est bien « disk ».'",
      '  else',
      "    kjemo_resultat 'Cible' \"${KJEMO_DEV}\" 'PROBLEME' \"type ${kjemo_type_dev:-inconnu}\" \\",
      "      'Ce n est pas un disque entier. Cet assistant cree une table de partitions : donne le disque, pas une de ses partitions.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE DISQUE EST-IL LIBRE ?',
      '#',
      '# Six raisons de refuser, et chacune se lit a un endroit different. Les',
      '# confondre ferait rater un cas, et le cas rate est celui qui coute.',
      '#',
      '# On examine le disque ET ses enfants : un disque dont une partition porte',
      '# la racine n est pas « libre » parce que le disque lui-meme n est pas',
      '# monte.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_LIBRE_OK=1',
      'if [ "${KJEMO_CIBLE_OK}" -eq 1 ]; then',
      '  kjemo_arbre="${KJEMO_TMP}/arbre.txt"',
      '  lsblk -P -o PATH,TYPE,FSTYPE,MOUNTPOINTS -- "${KJEMO_DEV}" > "${kjemo_arbre}" 2>/dev/null || : > "${kjemo_arbre}"',
      '  kjemo_val() {',
      '    printf \'%s\\n\' "$2" | sed -n "s/.*$1=\\"\\([^\\"]*\\)\\".*/\\\\1/p"',
      '  }',
      '  while IFS= read -r kjemo_l; do',
      '    if [ -z "${kjemo_l}" ]; then continue; fi',
      '    kjemo_p="$(kjemo_val PATH "${kjemo_l}")"',
      '    kjemo_f="$(kjemo_val FSTYPE "${kjemo_l}")"',
      '    kjemo_m="$(kjemo_val MOUNTPOINTS "${kjemo_l}")"',
      '    if [ -n "${kjemo_m}" ]; then',
      '      KJEMO_LIBRE_OK=0',
      "      kjemo_resultat 'Disque libre' \"${kjemo_p}\" 'PROBLEME' \"monte sur ${kjemo_m}\" \\",
      "        'Un peripherique monte ne se partitionne pas. Demonte-le d abord, et assure-toi de savoir ce qu il contient.'",
      '    fi',
      "    case \"${kjemo_m}\" in",
      "      '/'|'/boot'|'/boot/efi'|'/usr'|'/var'|'/etc')",
      '        KJEMO_LIBRE_OK=0',
      "        kjemo_resultat 'Disque libre' \"${kjemo_p}\" 'PROBLEME' \"SYSTEME : ${kjemo_m}\" \\",
      "          'Ce disque porte le systeme. Le partitionner rendrait la machine non amorcable.'",
      '        ;;',
      '    esac',
      '    case "${kjemo_f}" in',
      '      swap)',
      '        KJEMO_LIBRE_OK=0',
      "        kjemo_resultat 'Disque libre' \"${kjemo_p}\" 'PROBLEME' 'swap' \\",
      "          'Ce disque porte une zone d echange. Desactive-la avec swapoff et retire-la de /etc/fstab avant d y toucher.'",
      '        ;;',
      '      LVM2_member)',
      '        KJEMO_LIBRE_OK=0',
      "        kjemo_resultat 'Disque libre' \"${kjemo_p}\" 'PROBLEME' 'volume physique LVM' \\",
      "          'Ce disque appartient a un groupe de volumes LVM. Le partitionner detruirait les volumes logiques qui vivent dessus.'",
      '        ;;',
      '      linux_raid_member)',
      '        KJEMO_LIBRE_OK=0',
      "        kjemo_resultat 'Disque libre' \"${kjemo_p}\" 'PROBLEME' 'membre d un RAID' \\",
      "          'Ce disque est membre d un ensemble RAID. Retire-le proprement de l ensemble avant d y toucher.'",
      '        ;;',
      '      crypto_LUKS)',
      '        KJEMO_LIBRE_OK=0',
      "        kjemo_resultat 'Disque libre' \"${kjemo_p}\" 'PROBLEME' 'volume chiffre LUKS' \\",
      "          'Ce disque est chiffre. Son contenu est invisible tant qu il n est pas ouvert, et le partitionner le detruirait sans que rien ne s y oppose.'",
      '        ;;',
      '    esac',
      '  done < "${kjemo_arbre}"',
      '  # Une partition du disque peut etre declaree dans /etc/fstab sans etre',
      '  # montee en ce moment : le fichier dit l intention, et cette intention',
      '  # reviendra au prochain demarrage.',
      '  if grep -q -- "${KJEMO_DEV}" "${KJEMO_FSTAB}" 2>/dev/null; then',
      '    KJEMO_LIBRE_OK=0',
      "    kjemo_resultat 'Disque libre' '/etc/fstab' 'PROBLEME' 'le disque y est nomme' \\",
      "      'Une entree de /etc/fstab designe ce disque. Elle reviendra au prochain demarrage : retire-la d abord.'",
      '  fi',
      '  if [ "${KJEMO_LIBRE_OK}" -eq 1 ]; then',
      "    kjemo_resultat 'Disque libre' \"${KJEMO_DEV}\" 'OK' 'ni monte ni reserve' \\",
      "      'Aucun montage, aucun role systeme, aucun swap, aucun LVM, aucun RAID, aucun chiffrement.'",
      '  fi',
      'else',
      '  KJEMO_LIBRE_OK=0',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LE DISQUE EST-IL VIERGE ?',
      '#',
      '# wipefs -n LISTE les signatures sans rien effacer : c est son mode « ne',
      '# fais rien ». Un disque sans partition peut porter une ancienne signature',
      '# de systeme de fichiers ou de RAID, et elle reviendra hanter la suite —',
      '# mkfs reussira, puis le noyau redecouvrira l ancien ensemble au demarrage.',
      '#',
      '# Le refus est le DEFAUT, et il n y a volontairement aucun moyen de passer',
      '# outre depuis le formulaire. Effacer une signature est destructeur : cela',
      '# reste une operation manuelle, faite en connaissance de cause.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_VIERGE_OK=0',
      'if [ "${KJEMO_CIBLE_OK}" -eq 1 ]; then',
      '  kjemo_sig="$(wipefs -n -- "${KJEMO_DEV}" 2>/dev/null || true)"',
      '  kjemo_pt="$(blkid -p -o value -s PTTYPE -- "${KJEMO_DEV}" 2>/dev/null || true)"',
      '  kjemo_enfants="$(lsblk -n -o TYPE -- "${KJEMO_DEV}" 2>/dev/null | grep -c part || true)"',
      '  if [ -n "${kjemo_sig}" ]; then',
      "    kjemo_resultat 'Disque vierge' 'Signatures' 'PROBLEME' 'presentes' \\",
      '      "Des signatures existent sur ${KJEMO_DEV}. Ce script REFUSE d ecrire par-dessus. Pour les retirer, il faut le faire a la main, sur un disque dont tu as verifie le contenu : wipefs -a est destructeur et ne figure pas dans ce script."',
      '  elif [ -n "${kjemo_pt}" ]; then',
      "    kjemo_resultat 'Disque vierge' 'Table de partitions' 'PROBLEME' \"${kjemo_pt}\" \\",
      "      'Le disque porte deja une table de partitions. Ce script ne l ecrase pas.'",
      '  elif [ "${kjemo_enfants}" -gt 0 ]; then',
      "    kjemo_resultat 'Disque vierge' 'Partitions' 'PROBLEME' \"${kjemo_enfants} partition(s)\" \\",
      "      'Le disque porte des partitions. Ce script ne les supprime pas.'",
      '  else',
      '    KJEMO_VIERGE_OK=1',
      "    kjemo_resultat 'Disque vierge' \"${KJEMO_DEV}\" 'OK' 'aucune signature, aucune table' \\",
      "      'wipefs -n ne trouve rien, blkid ne voit aucune table, lsblk aucune partition.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LA SAUVEGARDE DE LA TABLE, ECRITE PUIS RELUE',
      '#',
      '# sfdisk --dump rend la table sous une forme que sfdisk sait relire : c est',
      '# la seule sauvegarde qui permette de remettre la table en place telle',
      '# quelle. Sur un disque vierge, il n y a rien a sauvegarder, et le dire est',
      '# plus honnete que de produire un fichier vide qui ressemble a une',
      '# sauvegarde.',
      '#',
      '# Le nom porte le peripherique et l horodatage : une sauvegarde qu on ne',
      '# sait pas rattacher a un disque ne sert a rien le jour ou l on en a',
      '# plusieurs.',
      '#',
      '# Et elle est RELUE : ecrire un fichier et supposer qu il est correct est',
      '# ce que fait tout le monde, et c est la raison pour laquelle on decouvre',
      '# les sauvegardes illisibles au moment de les utiliser.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SAUVEGARDE_OK=0',
      'KJEMO_DUMP=\'\'',
      'if [ "${KJEMO_CIBLE_OK}" -eq 1 ]; then',
      '  kjemo_nom_dev="$(printf \'%s\' "${KJEMO_DEV}" | tr \'/\' \'-\' | sed \'s/^-//\')"',
      '  KJEMO_DUMP="/root/kjemo-table-${kjemo_nom_dev}-$(date +%Y%m%d-%H%M%S).sfdisk"',
      '  kjemo_table="$(sfdisk --dump "${KJEMO_DEV}" 2>/dev/null || true)"',
      '  if [ -z "${kjemo_table}" ]; then',
      '    KJEMO_SAUVEGARDE_OK=1',
      "    kjemo_resultat 'Sauvegarde' 'Table de partitions' 'OK' 'aucune table a sauvegarder' \\",
      "      'Le disque est vierge : il n y a pas de table a sauvegarder. Un fichier vide ressemblerait a une sauvegarde sans en etre une.'",
      '  else',
      '    if printf \'%s\\n\' "${kjemo_table}" > "${KJEMO_DUMP}" 2>/dev/null; then',
      '      kjemo_relu="$(cat "${KJEMO_DUMP}" 2>/dev/null || true)"',
      '      if [ "${kjemo_relu}" = "${kjemo_table}" ]; then',
      '        KJEMO_SAUVEGARDE_OK=1',
      '        chmod 600 "${KJEMO_DUMP}" 2>/dev/null || true',
      "        kjemo_resultat 'Sauvegarde' 'Table de partitions' 'OK' \"${KJEMO_DUMP}\" \\",
      "          'Ecrite puis RELUE et comparee. Pour restaurer : sfdisk <disque> < ce fichier.'",
      '      else',
      "        kjemo_resultat 'Sauvegarde' 'Table de partitions' 'PROBLEME' 'relecture differente' \\",
      "          'Le fichier relu ne correspond pas a ce qui a ete lu du disque. Une sauvegarde non verifiee n est pas une sauvegarde.'",
      '      fi',
      '    else',
      "      kjemo_resultat 'Sauvegarde' 'Table de partitions' 'PROBLEME' 'ecriture impossible' \\",
      '        "Impossible d ecrire ${KJEMO_DUMP}. Verifie l espace disque et les droits."',
      '    fi',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - LE VERROU EXCLUSIF DE SFDISK',
      '#',
      '# --lock demande a sfdisk de prendre un verrou exclusif sur le',
      '# peripherique (flock), ce qui empeche udev et les autres outils de le',
      '# relire au milieu de l ecriture. Sans lui, une relecture concurrente peut',
      '# faire echouer l operation a moitie faite.',
      '#',
      '# Il n existe pas partout : util-linux l a ajoute en 2.37. On le DETECTE',
      '# plutot que de le supposer, et on dit lequel des deux cas s applique.',
      '#',
      '# --force et --wipe sont volontairement ABSENTS de ce script. --force fait',
      '# passer sfdisk outre ses propres verifications, et --wipe efface des',
      '# signatures : les deux annulent precisement ce que l etape 4 protege.',
      '# ---------------------------------------------------------------------------',
      'kjemo_lock=()',
      'if sfdisk --help 2>/dev/null | grep -q -- \'--lock\'; then',
      '  kjemo_lock=(--lock)',
      "  kjemo_resultat 'Verrou' 'sfdisk --lock' 'OK' 'disponible' \\",
      "    'Le peripherique sera verrouille pendant l ecriture : udev ne pourra pas le relire au milieu.'",
      'else',
      "  kjemo_resultat 'Verrou' 'sfdisk --lock' 'ATTENTION' 'indisponible' \\",
      "    'Cette version de sfdisk est anterieure a util-linux 2.37. L ecriture aura lieu sans verrou exclusif : evite de brancher ou debrancher des disques pendant l operation.'",
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: dev,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `partitionner et formater ${dev}, ce qui est IRREVERSIBLE`,
      }),

      ...blocPorteFinale({
        conditions: [
          ['KJEMO_OUTILS_OK', 'Un outil necessaire manque : voir la section Prerequis.'],
          ['KJEMO_CIBLE_OK', 'La cible n est pas un disque entier existant.'],
          ['KJEMO_LIBRE_OK', 'Le disque est monte, porte le systeme, du swap, du LVM, du RAID, du chiffrement, ou figure dans /etc/fstab.'],
          ['KJEMO_VIERGE_OK', 'Le disque porte une signature, une table de partitions ou des partitions. Ce script ne les efface pas.'],
          ['KJEMO_SAUVEGARDE_OK', 'La sauvegarde de la table n a pas pu etre ecrite puis relue.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le peripherique vise.'],
        ],
        action: 'le partitionnement et le formatage',
      }),

      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 8 - LA TABLE ET LA PARTITION',
      '#',
      '# Une table GPT et une seule partition qui prend tout le disque. La ligne',
      '# « ,,L » se lit : debut par defaut, taille par defaut (tout le reste),',
      '# type L (systeme de fichiers Linux).',
      '# ---------------------------------------------------------------------------',
      '  printf \'%s\\n\' \'Ecriture de la table de partitions...\'',
      '  kjemo_code_sf=0',
      '  printf \'%s\\n\' \',,L\' | sfdisk "${kjemo_lock[@]}" --label gpt "${KJEMO_DEV}" \\',
      '    > "${KJEMO_TMP}/sfdisk.out" 2>&1 || kjemo_code_sf=$?',
      '  if [ "${kjemo_code_sf}" -ne 0 ]; then',
      "    kjemo_resultat 'Partition' 'Ecriture de la table' 'PROBLEME' \"code ${kjemo_code_sf}\" \\",
      "      'sfdisk a echoue. Aucun systeme de fichiers n a ete ecrit.'",
      '    printf \'%s\\n\' \'--- sortie de sfdisk ---\' >&2',
      '    cat "${KJEMO_TMP}/sfdisk.out" >&2',
      '    printf \'%s\\n\' "La table precedente, si elle existait, est dans ${KJEMO_DUMP}" >&2',
      '    exit 1',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 9 - RELECTURE DE LA TABLE, AVANT mkfs',
      '#',
      '# C est l etape qu on saute, et celle qui evite de formater le mauvais',
      '# noeud. Le noyau doit avoir RELU la table avant que la partition existe',
      '# comme peripherique. On la relit, puis on DECOUVRE le chemin de la',
      '# partition en demandant a lsblk — on ne le devine pas en collant un « 1 »',
      '# au nom du disque, parce que c est « sdb1 » pour un SATA et « nvme0n1p1 »',
      '# pour un NVMe, et qu une regle de nommage devinee est une regle fausse un',
      '# jour sur deux.',
      '# ---------------------------------------------------------------------------',
      '  if kjemo_dispo udevadm; then udevadm settle 2>/dev/null || true; fi',
      '  if kjemo_dispo partprobe; then partprobe "${KJEMO_DEV}" 2>/dev/null || true; fi',
      '  if kjemo_dispo blockdev; then blockdev --rereadpt "${KJEMO_DEV}" 2>/dev/null || true; fi',
      '  sleep 1',
      '  kjemo_table_apres="$(sfdisk --dump "${KJEMO_DEV}" 2>/dev/null || true)"',
      '  if [ -z "${kjemo_table_apres}" ]; then',
      "    kjemo_resultat 'Partition' 'Relecture de la table' 'PROBLEME' 'illisible' \\",
      "      'La table vient d etre ecrite mais ne se relit pas. Rien n est formate : arret ici.'",
      // Le rapport est imprime a la FIN du script. Sortir ici sans ecrire sur
      // la sortie d erreur laisserait l operateur devant un script qui s arrete
      // sans un mot, apres avoir ecrit une table de partitions — l etat le plus
      // inconfortable possible. Le banc du stockage l a mesure : la passe E
      // s arretait en silence.
      "    printf '%s\\n' 'ARRET : la table vient d etre ecrite mais ne se relit pas.' >&2",
      "    printf '%s\\n' 'Aucun systeme de fichiers n a ete ecrit. Verifie avec : lsblk' >&2",
      '    printf \'%s\\n\' "La table precedente, si elle existait, est dans ${KJEMO_DUMP}" >&2',
      '    exit 1',
      '  fi',
      '  KJEMO_PART=\'\'',
      '  kjemo_parts="$(lsblk -P -o PATH,TYPE -- "${KJEMO_DEV}" 2>/dev/null \\',
      '    | sed -n \'/TYPE="part"/p\' || true)"',
      '  kjemo_nb_parts="$(printf \'%s\\n\' "${kjemo_parts}" | grep -c \'PATH=\' || true)"',
      '  if [ "${kjemo_nb_parts}" -ne 1 ]; then',
      "    kjemo_resultat 'Partition' 'Partitions apres ecriture' 'PROBLEME' \"${kjemo_nb_parts}\" \\",
      "      'Une seule partition etait attendue. Rien n est formate : arret ici.'",
      "    printf '%s\\n' 'ARRET : le nombre de partitions apres ecriture n est pas 1.' >&2",
      '    printf \'%s\\n\' "Trouve : ${kjemo_nb_parts}. Aucun systeme de fichiers n a ete ecrit." >&2',
      '    exit 1',
      '  fi',
      '  KJEMO_PART="$(kjemo_val PATH "${kjemo_parts}")"',
      '  if [ -z "${KJEMO_PART}" ] || [ ! -b "${KJEMO_PART}" ]; then',
      "    kjemo_resultat 'Partition' 'Chemin de la partition' 'PROBLEME' \"${KJEMO_PART:-vide}\" \\",
      "      'La partition annoncee par lsblk n est pas un peripherique bloc. Rien n est formate.'",
      "    printf '%s\\n' 'ARRET : la partition annoncee par lsblk n est pas un peripherique bloc.' >&2",
      '    printf \'%s\\n\' "Annonce : ${KJEMO_PART:-vide}. Aucun systeme de fichiers n a ete ecrit." >&2',
      '    exit 1',
      '  fi',
      '  kjemo_fs_part="$(lsblk -dn -o FSTYPE -- "${KJEMO_PART}" 2>/dev/null | tr -d \' \' || true)"',
      '  if [ -n "${kjemo_fs_part}" ]; then',
      "    kjemo_resultat 'Partition' 'Partition deja formatee' 'PROBLEME' \"${kjemo_fs_part}\" \\",
      "      'La partition porte deja un systeme de fichiers. mkfs n est PAS lance : ce script n ecrase pas un systeme de fichiers existant.'",
      "    printf '%s\\n' 'ARRET : la partition porte deja un systeme de fichiers.' >&2",
      '    printf \'%s\\n\' "Type trouve : ${kjemo_fs_part}. mkfs n a PAS ete lance." >&2',
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Partition' 'Creee et relue' 'OK' \"${KJEMO_PART}\" \\",
      "    'La table a ete relue par le noyau, et la partition decouverte par lsblk, non devinee.'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 10 - LE SYSTEME DE FICHIERS, SUR LA PARTITION DECOUVERTE',
      '#',
      '# Sur ${KJEMO_PART}, et jamais sur ${KJEMO_DEV} : formater le disque entier',
      '# effacerait la table qu on vient d ecrire, et donnerait un disque qui',
      '# fonctionne jusqu au jour ou un autre outil cherche sa table.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_mkfs=(mkfs.' + fs + ')',
      '  if [ -n "${KJEMO_ETIQUETTE}" ]; then kjemo_mkfs+=(-L "${KJEMO_ETIQUETTE}"); fi',
      '  kjemo_mkfs+=("${KJEMO_PART}")',
      '  printf \'%s\\n\' \'Ecriture du systeme de fichiers...\'',
      '  kjemo_code_mk=0',
      '  "${kjemo_mkfs[@]}" > "${KJEMO_TMP}/mkfs.out" 2>&1 || kjemo_code_mk=$?',
      '  if [ "${kjemo_code_mk}" -ne 0 ]; then',
      "    kjemo_resultat 'Formatage' \"${KJEMO_PART}\" 'PROBLEME' \"code ${kjemo_code_mk}\" \\",
      "      'mkfs a echoue. /etc/fstab n a PAS ete touche.'",
      '    printf \'%s\\n\' \'--- sortie de mkfs ---\' >&2',
      '    cat "${KJEMO_TMP}/mkfs.out" >&2',
      '    exit 1',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 11 - RELECTURE : LE TYPE ET L UUID',
      '#',
      '# C est l UUID, et non /dev/sdX1, qui ira dans /etc/fstab : les lettres de',
      '# peripherique dependent de l ordre de detection, qui change des qu on',
      '# ajoute un disque. Un fstab en /dev/sdb1 monte un jour le mauvais disque.',
      '# ---------------------------------------------------------------------------',
      '  if kjemo_dispo udevadm; then udevadm settle 2>/dev/null || true; fi',
      '  KJEMO_UUID="$(blkid -o value -s UUID -- "${KJEMO_PART}" 2>/dev/null || true)"',
      '  kjemo_type_fs="$(blkid -o value -s TYPE -- "${KJEMO_PART}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_UUID}" ] || [ "${kjemo_type_fs}" != "${KJEMO_FS}" ]; then',
      "    kjemo_resultat 'Formatage' 'Relecture' 'PROBLEME' \"UUID ${KJEMO_UUID:-absent}, type ${kjemo_type_fs:-inconnu}\" \\",
      '      "Le systeme de fichiers ne se relit pas comme attendu (${KJEMO_FS}). /etc/fstab n a PAS ete touche."',
      "    printf '%s\\n' 'ARRET : le systeme de fichiers ne se relit pas comme attendu.' >&2",
      '    printf \'%s\\n\' "Attendu ${KJEMO_FS}, relu ${kjemo_type_fs:-rien}, UUID ${KJEMO_UUID:-absent}." >&2',
      "    printf '%s\\n' '/etc/fstab n a PAS ete touche.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Formatage' \"${KJEMO_PART}\" 'OK' \"${kjemo_type_fs}, UUID ${KJEMO_UUID}\" \\",
      "    'Relu par blkid : le type et l UUID sont ceux attendus.'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 12 - /etc/fstab : LES HUIT ETAPES, DANS CET ORDRE',
      '#',
      '#   1. copie temporaire du fichier reel',
      '#   2. l entree est ajoutee DANS LA COPIE',
      '#   3. findmnt --verify --tab-file valide la COPIE',
      '#   4. si la validation echoue : ZERO ecriture de /etc/fstab',
      '#   5. sauvegarde verifiee de /etc/fstab',
      '#   6. remplacement ATOMIQUE',
      '#   7. relecture et comparaison',
      '#   8. montage, puis confirmation par findmnt',
      '#',
      '# « mount -a » n est PAS la validation : il monte ce qui est montable et se',
      '# tait sur ce qu il ne comprend pas. Il est propose a la fin, en plus.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_exiger_chemin_sur "${KJEMO_MP}"',
      '  # Le gardien a canonise le chemin : on travaille desormais sur la forme',
      '  # canonique, et non sur ce qui a ete saisi. C est tout l interet de la',
      '  # canonisation — « /srv/../srv/donnees » et « /srv/donnees » doivent',
      '  # produire la MEME ligne de fstab, sinon le fichier contient deux',
      '  # entrees pour un seul dossier.',
      '  KJEMO_MP="${KJEMO_CHEMIN_CANON}"',
      '  if [ ! -d "${KJEMO_MP}" ]; then',
      '    mkdir -p -- "${KJEMO_MP}"',
      "    kjemo_resultat 'Montage' 'Point de montage' 'OK' \"${KJEMO_MP} cree\" ''",
      '  else',
      '    # find et non ls : un nom de fichier peut contenir un saut de ligne,',
      '    # et la sortie de ls devient alors illisible. -quit arrete des le',
      '    # premier trouve : on veut savoir SI le dossier est vide, pas quoi il',
      '    # contient.',
      '    kjemo_contenu="$(find "${KJEMO_MP}" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null || true)"',
      '    if [ -n "${kjemo_contenu}" ]; then',
      "      kjemo_resultat 'Montage' 'Point de montage' 'ATTENTION' 'non vide' \\",
      "        'Le dossier contient deja des fichiers : ils deviendront INVISIBLES pendant le montage. Ils ne sont pas effaces, mais on les croit perdus.'",
      '    fi',
      '  fi',
      '',
      '  # 1 et 2 : la copie, puis l entree AJOUTEE DANS LA COPIE.',
      '  kjemo_copie="${KJEMO_TMP}/fstab.essai"',
      '  cp -p -- "${KJEMO_FSTAB}" "${kjemo_copie}"',
      '  {',
      '    printf \'%s\\n\' \'\'',
      '    printf \'%s\\n\' "# Ajoute par KJEMO IT Toolkit le $(date +%Y-%m-%d) : ${KJEMO_PART}"',
      '    printf \'UUID=%s %s %s %s 0 2\\n\' \\',
      '      "${KJEMO_UUID}" "${KJEMO_MP}" "${KJEMO_FS}" "${KJEMO_OPTIONS}"',
      '  } >> "${kjemo_copie}"',
      '',
      '  # 3 et 4 : la validation porte sur la COPIE. Si elle echoue, le fichier',
      '  # reel n a pas ete ouvert en ecriture une seule fois.',
      '  kjemo_code_vf=0',
      '  kjemo_sortie_vf="$(findmnt --verify --tab-file "${kjemo_copie}" 2>&1)" || kjemo_code_vf=$?',
      '  if [ "${kjemo_code_vf}" -ne 0 ]; then',
      "    kjemo_resultat 'fstab' 'Validation de la copie' 'PROBLEME' \"code ${kjemo_code_vf}\" \\",
      '      "findmnt --verify refuse la copie. /etc/fstab n a PAS ete modifie."',
      // Le rapport n est imprime qu a la fin : sortir ici sans le dire sur la
      // sortie d erreur laisserait l operateur deviner si /etc/fstab a ete
      // touche. C est la question la plus urgente a ce moment-la, et la
      // reponse doit etre lisible sans chercher.
      "    printf '%s\\n' 'ARRET : findmnt --verify refuse la copie de /etc/fstab.' >&2",
      "    printf '%s\\n' '/etc/fstab n a PAS ete modifie : rien n a ete ecrit dans le fichier reel.' >&2",
      '    printf \'%s\\n\' \'--- sortie de findmnt --verify ---\' >&2',
      '    printf \'%s\\n\' "${kjemo_sortie_vf}" >&2',
      '    printf \'%s\\n\' "Le systeme de fichiers existe sur ${KJEMO_PART} et porte l UUID ${KJEMO_UUID}," >&2',
      '    printf \'%s\\n\' \'mais il n est pas monte automatiquement. Rien a annuler sur /etc/fstab.\' >&2',
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'fstab' 'Validation de la copie' 'OK' 'findmnt --verify' \\",
      "    'La copie est valide. C est seulement maintenant que le fichier reel va etre touche.'",
      '',
      '  # 5 : la sauvegarde verifiee du fichier reel.',
      '  kjemo_sauvegarder "${KJEMO_FSTAB}"',
      '',
      '  # 6 : remplacement ATOMIQUE. Le fichier intermediaire est dans /etc,',
      '  # c est-a-dire sur le MEME systeme de fichiers : mv y est atomique, et',
      '  # aucun instant n existe ou /etc/fstab serait tronque. Un « > fstab »',
      '  # direct, lui, vide le fichier avant de le remplir.',
      '  kjemo_nouveau="${KJEMO_FSTAB}.kjemo-nouveau"',
      '  cp -p -- "${kjemo_copie}" "${kjemo_nouveau}"',
      '  mv -f -- "${kjemo_nouveau}" "${KJEMO_FSTAB}"',
      '',
      '  # 7 : relecture et comparaison. « mv a rendu 0 » ne dit pas que le',
      '  # contenu est celui qu on voulait.',
      '  if ! cmp -s -- "${KJEMO_FSTAB}" "${kjemo_copie}"; then',
      "    kjemo_resultat 'fstab' 'Relecture apres ecriture' 'PROBLEME' 'contenu different' \\",
      '      "Le fichier relu ne correspond pas a la copie validee. Restaure la sauvegarde : cp -p ${KJEMO_SAUVEGARDE} ${KJEMO_FSTAB}"',
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'fstab' 'Relecture apres ecriture' 'OK' 'identique a la copie validee' \\",
      '    "Sauvegarde conservee : ${KJEMO_SAUVEGARDE}"',
      '',
      '  # 8 : le montage, puis la CONFIRMATION par findmnt. « mount a rendu 0 »',
      '  # ne dit pas que le systeme de fichiers est en place : on relit.',
      '  kjemo_code_mt=0',
      '  mount "${KJEMO_MP}" > "${KJEMO_TMP}/mount.out" 2>&1 || kjemo_code_mt=$?',
      '  if [ "${kjemo_code_mt}" -ne 0 ]; then',
      "    kjemo_resultat 'Montage' \"${KJEMO_MP}\" 'PROBLEME' \"code ${kjemo_code_mt}\" \\",
      '      "mount a echoue. /etc/fstab a ete modifie et sauvegarde dans ${KJEMO_SAUVEGARDE}."',
      '    cat "${KJEMO_TMP}/mount.out" >&2',
      '    exit 1',
      '  fi',
      '  if findmnt --mountpoint "${KJEMO_MP}" > /dev/null 2>&1; then',
      '    kjemo_src_monte="$(findmnt -n -o SOURCE --mountpoint "${KJEMO_MP}" 2>/dev/null || true)"',
      "    kjemo_resultat 'Montage' \"${KJEMO_MP}\" 'OK' \"${kjemo_src_monte}\" \\",
      "      'Confirme par findmnt, et non par le code de retour de mount.'",
      '  else',
      "    kjemo_resultat 'Montage' \"${KJEMO_MP}\" 'PROBLEME' 'absent de findmnt' \\",
      "      'mount a rendu 0 mais findmnt ne voit pas le montage.'",
      '    exit 1',
      '  fi',
      '  # Et une derniere relecture du fichier REEL, celui qui servira au',
      '  # prochain demarrage.',
      '  kjemo_code_vr=0',
      '  findmnt --verify > "${KJEMO_TMP}/verify.out" 2>&1 || kjemo_code_vr=$?',
      '  if [ "${kjemo_code_vr}" -eq 0 ]; then',
      "    kjemo_resultat 'fstab' 'Validation du fichier reel' 'OK' 'findmnt --verify' \\",
      "      'Le prochain demarrage ne devrait pas bloquer sur fstab.'",
      '  else',
      "    kjemo_resultat 'fstab' 'Validation du fichier reel' 'PROBLEME' \"code ${kjemo_code_vr}\" \\",
      '      "findmnt --verify signale un probleme sur le fichier reel. Restaure la sauvegarde avant de redemarrer : cp -p ${KJEMO_SAUVEGARDE} ${KJEMO_FSTAB}"',
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-disque-linux' }),
    ]);
  },

  gui: [
    'Lance d’abord l’inventaire du stockage : il nomme les disques qu’il serait dangereux de toucher.',
    'Vérifie que le disque visé n’est pas monté : « findmnt --source /dev/sdb ».',
    'Vérifie qu’il est vierge : « sudo wipefs -n /dev/sdb » ne doit rien afficher.',
    'Sauvegarde la table si elle existe : « sudo sfdisk --dump /dev/sdb > /root/table.sfdisk ».',
    'Crée la table et la partition : « printf \'%s\\n\' \',,L\' | sudo sfdisk --lock --label gpt /dev/sdb ».',
    'Fais relire la table au noyau : « sudo partprobe /dev/sdb », puis vérifie avec « lsblk /dev/sdb ».',
    'Formate la PARTITION, pas le disque : « sudo mkfs.ext4 -L donnees /dev/sdb1 ».',
    'Relève l’UUID : « sudo blkid -o value -s UUID /dev/sdb1 ».',
    'Copie /etc/fstab, ajoute la ligne UUID dans la COPIE, et valide la copie : « findmnt --verify --tab-file /tmp/fstab.essai ».',
    'Seulement si la copie est valide : sauvegarde /etc/fstab, remplace-le, puis « sudo mount /srv/donnees » et « findmnt /srv/donnees ».',
  ],

  keywords: ['partition', 'partitionner', 'formater', 'mkfs', 'sfdisk', 'gpt', 'fstab',
    'montage', 'monter', 'uuid', 'ext4', 'xfs', 'disque', 'stockage', 'persistant',
    'findmnt', 'blkid', 'wipefs', 'linux', 'ubuntu', 'nouveau disque'],

  requiresAdmin: true,
  prereqs: [
    'Un disque de données VIERGE, sans signature ni table de partitions. Le script refuse tout le reste, et n’offre aucun moyen de passer outre.',
    'Les données de ce disque sauvegardées ailleurs, si tu n’es pas certain qu’il est vide. mkfs ne se défait pas.',
    'util-linux et e2fsprogs, présents par défaut. Pour XFS : apt install xfsprogs.',
    'sudo, ou une session root : sfdisk et mkfs ouvrent le périphérique brut.',
    'L’inventaire du stockage lu AVANT : c’est lui qui dit si le disque porte la racine, du swap, du LVM ou un membre de RAID.',
  ],

  commonErrors: [
    {
      message: 'Le script s’arrête sur « Des signatures existent »',
      code: 'KJEMO',
      cause: 'Le disque porte une signature résiduelle de système de fichiers ou de RAID. Il a déjà servi.',
      fix: 'Vérifier d’abord ce qu’il contient — c’est peut-être un disque utile. S’il est bien à réutiliser, retirer les signatures est une opération destructrice à faire à la main, en connaissance de cause. Ce script ne la fait pas, et c’est délibéré.',
      command: 'sudo wipefs -n /dev/sdb',
    },
    {
      message: 'sfdisk: /dev/sdb: device is in use',
      code: 'EBUSY',
      cause: 'Une partition du disque est montée, ou le disque appartient à un ensemble RAID ou à un groupe LVM actif.',
      fix: 'Démonter, désactiver l’ensemble ou le groupe de volumes, puis relancer. Le script contrôle déjà ces cas : ce message signifie qu’un composant s’est activé entre-temps.',
      command: 'findmnt --source /dev/sdb; cat /proc/mdstat',
    },
    {
      message: 'findmnt --verify refuse la copie de /etc/fstab',
      code: 'KJEMO',
      cause: 'La ligne ajoutée est syntaxiquement ou sémantiquement invalide : point de montage inexistant, options inconnues, UUID introuvable.',
      fix: 'C’est exactement ce que la validation sur copie existe pour attraper. /etc/fstab n’a pas été touché : le système de fichiers existe, il n’est simplement pas monté automatiquement. Corriger le point de montage ou les options, puis relancer.',
      command: 'findmnt --verify --tab-file /tmp/fstab.essai',
    },
    {
      message: 'La machine a démarré en mode de secours après l’ajout d’une ligne à /etc/fstab',
      code: 'KJEMO',
      cause: 'Une entrée sans l’option « nofail » désigne un disque absent au démarrage : systemd attend, puis bascule en mode de secours.',
      fix: 'Au prompt de secours, monter la racine en écriture, retirer ou corriger la ligne, puis redémarrer. C’est la raison pour laquelle « defaults,nofail » est la valeur recommandée de cet assistant.',
      command: 'mount -o remount,rw / ; nano /etc/fstab',
    },
    {
      message: 'mkfs.xfs: command not found',
      code: 'ENOENT',
      cause: 'xfsprogs n’est pas installé : Ubuntu ne l’installe pas par défaut.',
      fix: 'Installer le paquet, ou choisir ext4. Le script contrôle la présence de mkfs.<fs> dans ses prérequis et s’arrête avant d’écrire quoi que ce soit.',
      command: 'sudo apt install xfsprogs',
    },
    {
      message: 'Le disque est bien partitionné mais lsblk ne montre pas la partition',
      code: 'KJEMO',
      cause: 'Le noyau n’a pas relu la table : c’est fréquent quand un outil tient le périphérique ouvert.',
      fix: 'C’est l’étape 9 du script, et elle est bloquante : sans relecture réussie, mkfs n’est pas lancé. En manuel, forcer la relecture puis vérifier.',
      command: 'sudo partprobe /dev/sdb && lsblk /dev/sdb',
    },
  ],

  reversible: false,
  verifyAfter: [
    'La partition apparaît dans « lsblk -f » avec le système de fichiers et l’UUID attendus.',
    '« findmnt /srv/donnees » montre le montage, et sa source est la partition créée.',
    '« findmnt --verify » sur le fichier réel ne signale rien : le prochain démarrage ne bloquera pas.',
    '/etc/fstab contient une ligne UUID= — jamais /dev/sdX1 — et la sauvegarde horodatée du fichier précédent existe à côté.',
    'La sauvegarde de la table de partitions, si une table existait, est dans /root sous un nom qui porte le périphérique et la date.',
  ],

  rollback: {
    summary: 'Le formatage NE S’ANNULE PAS. Ce qui s’annule : la ligne ajoutée à /etc/fstab, et le montage. Les données qui étaient sur le disque avant mkfs sont perdues, et seule une sauvegarde antérieure permet de les retrouver.',
    diagnostic: `# L entree ajoutee dans /etc/fstab :
grep -n 'KJEMO IT Toolkit' /etc/fstab
# Les sauvegardes de fstab laissees par cet assistant :
ls -l /etc/fstab.kjemo-*.bak
# La sauvegarde de la table de partitions, si elle existait :
ls -l /root/kjemo-table-*.sfdisk
# Ce qui est monte en ce moment :
findmnt --mountpoint /srv/donnees`,
    command: `# 1. Demonter :
sudo umount /srv/donnees

# 2. Restaurer /etc/fstab depuis la sauvegarde horodatee la plus recente :
sudo cp -p /etc/fstab.kjemo-AAAAMMJJ-HHMMSS.bak /etc/fstab
sudo findmnt --verify

# 3. Si une table de partitions existait AVANT et qu il faut la remettre :
#    sudo sfdisk /dev/sdb < /root/kjemo-table-dev-sdb-AAAAMMJJ-HHMMSS.sfdisk
#    Cela remet la TABLE, pas les DONNEES : un systeme de fichiers formate
#    ne revient pas.
#
# 4. Le systeme de fichiers ecrit par mkfs ne s annule pas. Si le disque
#    contenait quelque chose, seule une sauvegarde anterieure le rend.
echo 'Montage defait et fstab restaure. Le formatage, lui, est definitif.'`,
    warning: 'mkfs est irréversible. Aucune option, aucun outil et aucune manipulation ne redonne un système de fichiers formaté. La seule protection réelle est la vérification de la cible AVANT — c’est pourquoi ce script refuse tout disque monté, système, swap, LVM, RAID, chiffré, ou portant la moindre signature, et pourquoi il demande de retaper le périphérique exact.',
  },

  checks: [
    'Le disque est refusé s’il est monté, s’il porte la racine, /boot, /usr, /var, /etc, du swap, du LVM, un membre de RAID ou du chiffrement, ou s’il est nommé dans /etc/fstab.',
    'Le disque est refusé s’il porte une signature (wipefs -n), une table (blkid PTTYPE) ou des partitions. Aucun champ ne permet de passer outre.',
    'La sauvegarde de la table est écrite, RELUE et comparée ; un écart arrête le script avant toute écriture.',
    'Le verrou exclusif de sfdisk est détecté et utilisé quand il existe ; son absence est annoncée.',
    'Ni --force ni --wipe n’apparaissent dans le script : les deux annuleraient les vérifications de l’étape 4.',
    'La confirmation exige de retaper le périphérique exact ; sans elle, le script diagnostique et n’écrit rien.',
    'La table est RELUE avant mkfs, et le chemin de la partition est DÉCOUVERT par lsblk, jamais deviné en collant un « 1 » au nom du disque.',
    'mkfs ne s’exécute que sur la partition découverte, et seulement si elle n’a aucun système de fichiers.',
    '/etc/fstab est validé par findmnt --verify sur une COPIE TEMPORAIRE avant toute écriture ; un échec laisse le fichier réel intact.',
    'Le remplacement de /etc/fstab est atomique (fichier intermédiaire sur le même système de fichiers, puis mv), puis relu et comparé.',
    'Le montage est confirmé par findmnt, et non par le code de retour de mount.',
    '« mount -a » n’est jamais la seule validation.',
  ],

  source: `${M}/man8/sfdisk.8.html`,
  sources: [
    { label: 'sfdisk(8)', url: `${M}/man8/sfdisk.8.html` },
    { label: 'mkfs.ext4 — mke2fs(8)', url: `${M}/man8/mke2fs.8.html` },
    { label: 'mkfs.xfs(8)', url: `${M}/man8/mkfs.xfs.8.html` },
    { label: 'fstab(5)', url: `${M}/man5/fstab.5.html` },
    { label: 'findmnt(8)', url: `${M}/man8/findmnt.8.html` },
    { label: 'blkid(8)', url: `${M}/man8/blkid.8.html` },
    { label: 'mount(8)', url: `${M}/man8/mount.8.html` },
    { label: 'wipefs(8)', url: `${M}/man8/wipefs.8.html` },
  ],
};

export const toolsLinuxD = [
  linuxDiskPartitionMount,
];
