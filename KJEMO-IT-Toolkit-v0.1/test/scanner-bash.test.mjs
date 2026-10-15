#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — SCANNER DE SURETE DES SCRIPTS BASH GENERES
//
// CE QU'IL FAIT
//
// Il cherche trente-et-une familles de commandes dangereuses dans le CODE
// REELLEMENT EXECUTE des scripts generes — commentaires et texte litteral
// retires — et il REFUSE toute occurrence qui n'est pas couverte par une
// exception nommee, datee du commit qui l'a introduite, et JUSTIFIEE PAR
// ECRIT dans ce fichier.
//
// Il refuse aussi l'inverse : une exception qui ne sert plus. Une liste
// d'exceptions qu'on n'elague pas finit par autoriser ce que plus personne
// n'a examine.
//
// ---------------------------------------------------------------------------
// LA REGLE QUE JE ME SUIS DONNEE EN L'ECRIVANT
// ---------------------------------------------------------------------------
// Aucune exception ajoutee pour faire passer le lot. Quand une alerte s'est
// averee fausse, c'est le MOTIF qui a ete corrige, pas la liste qui a ete
// allongee — parce qu'une exception masque toutes les occurrences futures de
// la meme forme dans le meme outil, y compris les vraies.
//
// Deux faux positifs ont ete rencontres en ecrivant ce banc :
//
//   - « cat /etc/passwd > "${TMP}" » signale comme une ecriture dans
//     /etc/passwd. C'est une LECTURE redirigee vers un fichier temporaire :
//     l'inverse exact du danger surveille. MOTIF CORRIGE ;
//   - « last -n 5 -x reboot » signale comme un redemarrage. C'est la lecture
//     de l'historique des redemarrages. Le mot est le meme, l'acte est
//     oppose, et aucun motif raisonnable ne distingue « reboot » argument de
//     « reboot » commande sans comprendre le shell. EXCEPTION, nommee et
//     justifiee.
//
// Et un defaut reel dans l'outil du scanner lui-meme, trouve en l'executant :
// la fonction qui retire le texte litteral se desynchronisait sur
// « "$( ... )" » et sur les antislashs entre apostrophes simples. Elle rendait
// du faux code, et le scanner alertait sur des lignes qui n'existaient pas.
// Corrigee dans scripts/familles-dangereuses.mjs.
//
// ---------------------------------------------------------------------------
// NIVEAU DE PREUVE
// ---------------------------------------------------------------------------
// Analyse statique par motifs. Un motif ne comprend pas le shell : il SIGNALE,
// un humain JUSTIFIE, et la justification est versionnee. Ce banc ne prouve
// pas qu'un script est sur ; il prouve qu'aucune commande dangereuse n'y est
// presente sans que quelqu'un ait ecrit pourquoi.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIR = resolve(__dirname, 'generated');

const { FAMILLES, codeNu, lignesDeclenchantes } =
  await import(pathToFileURL(resolve(ROOT, 'scripts/familles-dangereuses.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

// ===========================================================================
// LA LISTE DES EXCEPTIONS
//
// Quatre champs obligatoires, et le quatrieme est le plus important.
// `outils` : 'tous' ou la liste explicite. `ligne` : le motif EXACT tolere,
// pas la famille entiere — tolerer « rm » dans un outil tolererait aussi
// `rm -rf /`.
// ===========================================================================
const EXCEPTIONS = [
  // Note sur la forme de ces motifs : apres codeNu(), un argument entre
  // guillemets a disparu. Une ligne qui se reduit a « rm -rf -- » avait donc
  // un argument CITE. Si quelqu'un ecrivait `rm -rf -- $CIBLE` sans
  // guillemets, la variable resterait visible, la ligne ne correspondrait plus
  // a l'exception, et le scanner refuserait. C'est une propriete utile, et
  // elle n'est pas un hasard : elle est conservee deliberement.
  {
    famille: 'rm -rf',
    outils: 'tous',
    ligne: /^rm -rf --\s*$/,
    pourquoi:
      'Nettoyage du dossier temporaire du script, pose par une trappe EXIT. '
      + 'Le chemin vient de `mktemp -d -t kjemo-<outil>-XXXXXXXX`, jamais d\'une '
      + 'valeur saisie, et la suppression est gardee par '
      + '`[ -n "${KJEMO_TMP:-}" ] && [ -d "${KJEMO_TMP}" ]`. Le terminateur `--` '
      + 'est present : un chemin commencant par un tiret ne sera pas pris pour '
      + 'une option. Sans ce nettoyage, chaque execution laisserait un dossier '
      + 'derriere elle.',
  },
  {
    famille: 'rm',
    outils: 'tous',
    ligne: /^rm -rf --\s*$/,
    pourquoi: 'Meme ligne que ci-dessus : la famille « rm » est plus large que '
      + '« rm -rf » et attrape la meme occurrence. Les deux sont declarees '
      + 'plutot que d\'affaiblir l\'une des deux familles.',
  },
  {
    famille: 'rm',
    outils: ['bash-backup-directory'],
    ligne: /^rm -f --\s*$/,
    pourquoi:
      'Suppression de l\'archive et du manifeste APRES un echec de `tar`. '
      + 'Une archive partielle est plus dangereuse qu\'une archive absente : '
      + 'elle figure dans la liste des sauvegardes et c\'est elle qu\'on tentera '
      + 'de restaurer le jour ou on en a besoin. Les deux chemins sont '
      + 'construits par le script dans son propre dossier de destination, apres '
      + 'passage du gardien de chemin.',
  },
  {
    famille: 'wipefs',
    outils: ['linux-storage-diagnostic'],
    ligne: /\bwipefs -n\b|kjemo_dispo wipefs/,
    pourquoi:
      'Deux occurrences, toutes deux en LECTURE. La premiere est un test de '
      + 'presence (`kjemo_dispo wipefs`) qui n execute pas la commande. La '
      + 'seconde est `wipefs -n`, son mode « ne fais rien » : il LISTE les '
      + 'signatures et n efface rien. C est la seule facon de repondre a « ce '
      + 'disque est-il vraiment vide ? », et la question compte : un disque sans '
      + 'partition peut porter une signature linux_raid_member residuelle, mkfs '
      + 'reussira par-dessus, et le noyau redecouvrira l ancien ensemble au '
      + 'demarrage. L exception EXIGE le « -n » : un futur `wipefs -a` ne '
      + 'correspondrait pas a ce motif et serait refuse.',
  },
  {
    famille: 'fdisk / parted / sfdisk en ecriture',
    outils: ['linux-storage-diagnostic'],
    ligne: /^fdisk -l$/,
    pourquoi:
      '`fdisk -l` LISTE puis SORT. C est le seul mode de fdisk qui ne propose '
      + 'jamais d ecrire : sans -l, fdisk ouvre une session interactive sur le '
      + 'peripherique nomme. Le motif de la famille ne distingue pas les modes, '
      + 'et c est voulu — c est a l exception de le faire, par ecrit. Celle-ci '
      + 'est ancree aux deux bouts (^...$) : elle ne tolere QUE la ligne nue '
      + '`fdisk -l`, sans cible et sans autre option. Un `fdisk /dev/sdb` serait '
      + 'refuse.',
  },
  // -------------------------------------------------------------------------
  // linux-disk-partition-mount — le seul assistant du depot qui partitionne et
  // formate. Ses commandes dangereuses sont sa raison d etre : les interdire
  // reviendrait a interdire l assistant. Ce que le scanner peut garantir, lui,
  // c est qu aucune AUTRE forme ne se glisse a cote — chaque exception ci-
  // dessous est ancree sur la forme exacte attendue.
  //
  // Ce que le scanner ne peut PAS garantir, et qui est donc prouve ailleurs :
  // que ces commandes sont derriere la porte finale. C est le role de
  // test/stockage-linux.test.mjs, qui EXECUTE le script avec des mouchards et
  // mesure zero appel a sfdisk et a mkfs quand la confirmation manque.
  // -------------------------------------------------------------------------
  {
    famille: 'mkfs',
    outils: ['linux-disk-partition-mount'],
    ligne: /^for kjemo_o in sfdisk lsblk blkid wipefs findmnt mkfs\.(ext4|xfs); do$/,
    pourquoi:
      'Controle de PRESENCE des outils, dans une boucle de prerequis : le nom '
      + 'de la commande y est une donnee, pas une invocation. Verifier les '
      + 'outils maintenant evite de s arreter au milieu, entre le '
      + 'partitionnement et le formatage, dans l etat le plus inconfortable : '
      + 'un disque partitionne et vide, et un operateur qui ne sait pas ou il '
      + 'en est. L exception est ancree sur la ligne entiere.',
  },
  {
    famille: 'mkfs',
    outils: ['linux-disk-partition-mount'],
    ligne: /^kjemo_mkfs=\(mkfs\.(ext4|xfs)\)$/,
    pourquoi:
      'Construction du TABLEAU de commande, derriere la porte finale et apres '
      + 'la relecture de la table. L invocation elle-meme est '
      + '"${kjemo_mkfs[@]}", qui ne nomme aucune commande et n est donc pas '
      + 'signalee — c est le prix du tableau, choisi pour eviter le decoupage '
      + 'de mots sur une variable d options. mkfs ne porte JAMAIS le disque : '
      + 'il recoit "${KJEMO_PART}", decouvert par lsblk apres relecture, et '
      + 'seulement si cette partition n a aucun systeme de fichiers.',
  },
  {
    famille: 'wipefs',
    outils: ['linux-disk-partition-mount'],
    ligne: /^for kjemo_o in sfdisk .*wipefs.*; do$|^kjemo_sig= +\$\(wipefs -n --/,
    pourquoi:
      'Deux occurrences, toutes deux en lecture. La premiere est le controle de '
      + 'presence. La seconde est "wipefs -n", son mode « ne fais rien » : il '
      + 'LISTE les signatures, et c est precisement ce qui fait REFUSER le '
      + 'disque a l etape 4. L exception exige le "-n" : un "wipefs -a" ne '
      + 'correspondrait pas et serait refuse. Cet assistant n efface aucune '
      + 'signature, et n offre aucun champ pour le faire.',
  },
  {
    famille: 'fdisk / parted / sfdisk en ecriture',
    outils: ['linux-disk-partition-mount'],
    ligne: /^for kjemo_o in sfdisk .*; do$|^kjemo_table(_apres)?= +\$\(sfdisk --dump|^if sfdisk --help |^printf +\| sfdisk +--label gpt/,
    pourquoi:
      'Quatre formes, et une seule ecrit. « sfdisk --dump » LIT la table : '
      + 'c est la sauvegarde de l etape 5 et la relecture de l etape 9. '
      + '« sfdisk --help | grep -- --lock » detecte le verrou exclusif sans '
      + 'toucher au disque. Le controle de presence ne fait que nommer la '
      + 'commande. La seule ecriture est « sfdisk --label gpt », derriere la '
      + 'porte finale a six conditions, et elle ne porte NI --force NI --wipe : '
      + 'les deux annuleraient le refus des signatures. L exception est ancree '
      + 'sur ces quatre formes exactes ; toute autre invocation de sfdisk, '
      + 'fdisk ou parted serait refusee.',
  },
  {
    famille: 'quotaoff',
    outils: ['linux-quota-enable'],
    ligne: /^for kjemo_o in quotacheck quotaon quotaoff repquota setquota findmnt; do$/,
    pourquoi:
      'Controle de PRESENCE des commandes du paquet quota, dans une boucle de '
      + 'prerequis : le nom y est une donnee, pas une invocation. Verifier les '
      + 'outils AVANT de modifier /etc/fstab evite de s arreter entre la '
      + 'modification du fichier et l initialisation de la comptabilite. '
      + 'L assistant n appelle JAMAIS quotaoff : la desactivation est decrite '
      + 'dans sa procedure d annulation, a lancer a la main. L exception est '
      + 'ancree sur la ligne entiere ; un vrai « quotaoff <montage> » ne '
      + 'correspondrait pas et serait refuse.',
  },
  {
    famille: 'reboot ou shutdown',
    outils: ['linux-health-report'],
    ligne: /\blast\b.*\breboot\b/,
    pourquoi:
      'LECTURE de l\'historique des redemarrages par `last -n 5 -x reboot`. Le '
      + 'mot est celui de la famille, l\'acte est l\'oppose : rien n\'est '
      + 'redemarre. Aucun motif raisonnable ne distingue « reboot » argument de '
      + '« reboot » commande sans comprendre le shell, et elargir le motif pour '
      + 'y arriver le rendrait faux ailleurs. Exception etroite : elle ne '
      + 'tolere que les lignes ou `last` et `reboot` apparaissent ensemble.',
  },
  // -------------------------------------------------------------------------
  // linux-raid1-create — le second assistant du depot qui formate, et le seul
  // qui cree un ensemble RAID. Comme pour le partitionnement, interdire ses
  // commandes reviendrait a interdire l assistant ; ce que le scanner garantit,
  // c est qu AUCUNE autre forme ne se glisse a cote.
  //
  // Ce que le scanner ne peut pas garantir, et qui est prouve dans
  // test/raid-linux.test.mjs : que ces commandes sont derriere la porte finale,
  // que mkfs recoit /dev/mdX et jamais un membre, et qu une confirmation
  // absente donne zero appel destructif.
  // -------------------------------------------------------------------------
  {
    famille: 'mkfs',
    outils: ['linux-raid1-create'],
    ligne: /^for kjemo_o in mdadm lsblk blkid wipefs findmnt mkfs\.(ext4|xfs); do\s*$/,
    pourquoi:
      'Controle de PRESENCE des outils, dans la boucle de prerequis : le nom de '
      + 'la commande y est une donnee, pas une invocation. Verifier mkfs AVANT '
      + 'de creer l ensemble evite l etat le plus inconfortable du sujet : un '
      + 'miroir assemble, synchronise, et pas formatable parce que le paquet '
      + 'manque. L exception est ancree sur la ligne entiere, et ne tolere que '
      + 'les deux variantes de systeme de fichiers offertes par le formulaire.',
  },
  {
    famille: 'wipefs',
    outils: ['linux-raid1-create'],
    ligne: /^for kjemo_o in mdadm lsblk blkid wipefs findmnt mkfs\.(ext4|xfs); do\s*$|^sig= +\$\(wipefs -n -- +2>\/dev\/null \|\| true\)\s*$/,
    pourquoi:
      'Deux occurrences, toutes deux en LECTURE. La premiere est le controle de '
      + 'presence. La seconde est « wipefs -n », son mode « ne fais rien » : il '
      + 'LISTE les signatures du disque examine, et c est precisement ce qui '
      + 'fait REFUSER un membre porteur de donnees. Le cas compte ici plus '
      + 'qu ailleurs : un disque qui porte une signature linux_raid_member '
      + 'residuelle ferait redecouvrir un ancien ensemble au demarrage, '
      + 'par-dessus le neuf. L exception EXIGE le « -n » : un futur « wipefs -a » '
      + 'ne correspondrait pas et serait refuse. Cet assistant n efface aucune '
      + 'signature et n offre aucun champ pour le faire.',
  },
  {
    famille: 'mkfs',
    outils: ['linux-raid1-create'],
    ligne: /^kjemo_mkfs=\(mkfs\.(ext4|xfs)\s*\)\s*$/,
    pourquoi:
      'Construction du TABLEAU de commande, derriere la porte finale a cinq '
      + 'conditions et apres la relecture de /proc/mdstat et de mdadm --detail. '
      + 'L invocation elle-meme est "${kjemo_mkfs[@]}", qui ne nomme aucune '
      + 'commande et n est donc pas signalee. La cible est "${KJEMO_ENS}", '
      + 'verifiee trois fois : forme /dev/mdN, differente des trois disques '
      + 'fournis, et relue par blkid. C est l erreur la plus couteuse du sujet — '
      + 'formater un MEMBRE au lieu de l ensemble — et elle est gardee ici.',
  },
  {
    famille: 'mdadm destructif',
    outils: ['linux-raid1-create'],
    ligne: /^kjemo_cmd=\(mdadm --create\s+--level=raid1 --raid-devices=2\s*$/,
    pourquoi:
      'Les deux seules formes de « mdadm --create » du depot, et la raison '
      + 'd etre de l assistant. Elles sont construites en TABLEAU, derriere la '
      + 'porte finale, apres examen individuel de chaque disque (bloc, non '
      + 'monte, hors systeme, sans signature residuelle) et apres une '
      + 'confirmation qui recapitule les roles. Ni « --force » ni '
      + '« --assume-clean » n apparaissent : le premier passerait outre les '
      + 'refus, le second mentirait sur la synchronisation. Le motif est ancre '
      + 'sur « --level=raid1 --raid-devices=2 » : aucun autre niveau, aucun '
      + 'autre nombre de membres ne correspondrait.',
  },
  {
    famille: 'mdadm destructif',
    outils: ['linux-raid-member-manage'],
    ligne: /^mdadm --manage\s+--(fail|remove)\s*\\?\s*$/,
    pourquoi:
      'Les deux verbes du remplacement de membre, dans l ordre impose : '
      + '« --fail » puis « --remove », avec une RELECTURE de /proc/mdstat et de '
      + 'mdadm --detail apres chacun. L assistant refuse « --fail » si '
      + 'l ensemble est DEJA degrade ou si une reconstruction tourne — marquer '
      + 'un second membre defaillant sur un miroir a un seul membre sain detruit '
      + 'les donnees, et c est le piege du sujet. « --zero-superblock » et '
      + '« --stop » n apparaissent nulle part. Le motif est ancre sur ces deux '
      + 'verbes seuls ; « --add », qui ne detruit rien, n est meme pas signale '
      + 'par la famille.',
  },
  // -------------------------------------------------------------------------
  // linux-permission-change — le seul assistant du depot qui change des droits
  // en masse. Ses commandes recursives sont sa raison d etre quand on les
  // demande explicitement ; ce que le scanner garantit, c est qu aucune autre
  // forme ne se glisse a cote, et que la cible n est jamais une racine.
  //
  // Ce que le scanner ne peut pas garantir, et qui est prouve dans
  // test/permissions-linux.test.mjs : que ces commandes sont derriere la porte
  // finale, que le fichier de restauration a ete ecrit ET relu avant, et
  // qu une recursion sur une racine systeme donne zero appel.
  // -------------------------------------------------------------------------
  {
    famille: 'chown -R',
    outils: ['linux-permission-change'],
    ligne: /^kjemo_cmd_chown=\(chown --no-dereference --recursive -- *\)$/,
    pourquoi:
      'Construction du TABLEAU de commande, dans la branche ou la recursion a '
      + 'ete demandee explicitement. L invocation est "${kjemo_cmd_chown[@]}", '
      + 'qui ne nomme aucune commande. La cible est verifiee deux fois contre '
      + 'la liste des racines interdites — par le formulaire et par le script — '
      + 'et l option --no-dereference est presente : un lien symbolique '
      + 'rencontre en chemin ne fait pas sortir de l arborescence visee. '
      + 'L exception est ancree sur la ligne entiere : un chown recursif sans '
      + '--no-dereference ne correspondrait pas et serait refuse.',
  },
  {
    famille: 'chmod, chown ou setfacl par find -exec',
    outils: ['linux-permission-change'],
    ligne: /^find +-xdev -type [df] -exec chmod -- +\{\} \+ *\\?$/,
    pourquoi:
      'Les deux seules formes de chmod recursif du depot, et la raison pour '
      + 'laquelle elles ne sont PAS un chmod -R : un mode de dossier applique '
      + 'recursivement poserait le bit d execution et les bits speciaux sur '
      + 'chaque FICHIER, ce qui rend les documents executables. Les dossiers et '
      + 'les fichiers sont donc traites separement, avec deux modes distincts '
      + 'calcules par le generateur. find recoit -xdev, donc ne traverse aucun '
      + 'autre systeme de fichiers, et chmod recoit « -- » avant le mode. '
      + 'L exception est ancree sur ces deux formes exactes ; tout autre '
      + 'find -exec portant chmod, chown, chgrp ou setfacl serait refuse.',
  },
  {
    famille: 'wipefs',
    outils: ['linux-raid-member-manage'],
    ligne: /^kjemo_sig_e= +\$\(wipefs -n -- +2>\/dev\/null \|\| true\)\s*$/,
    pourquoi:
      'Une occurrence, en LECTURE : « wipefs -n » liste les signatures du '
      + 'disque ENTRANT avant de le proposer a l ensemble. Ajouter un disque qui '
      + 'porte encore un systeme de fichiers ou une signature '
      + 'linux_raid_member, c est accepter de l ecraser sans l avoir dit ; '
      + 'l assistant prefere le signaler et laisser decider. L exception exige '
      + 'le « -n » : aucune forme effacante ne correspondrait a ce motif.',
  },
];

// ===========================================================================
// PLAN 1 — le scanner tourne sur le corpus
// ===========================================================================
if (!existsSync(DIR)) {
  console.error('ECHEC : test/generated est absent. Lance « npm run generate » d\'abord.');
  process.exit(1);
}
const sh = readdirSync(DIR).filter((f) => f.endsWith('.sh')).sort();
if (sh.length === 0) {
  console.error('ECHEC : aucun script .sh a scanner. Un scanner sans corpus serait vert pour rien.');
  process.exit(1);
}

console.log('');
console.log(`Plan 1 — ${FAMILLES.length} familles sur ${sh.length} scripts`);

const utilisee = new Map(EXCEPTIONS.map((e, i) => [i, 0]));
const occurrences = new Map();
let total = 0;

for (const fichier of sh) {
  const outil = fichier.split('__')[0];
  const code = codeNu(readFileSync(join(DIR, fichier), 'utf8'));

  for (const fam of FAMILLES) {
    for (const { no, texte } of lignesDeclenchantes(code, fam)) {
      total += 1;
      occurrences.set(fam.nom, (occurrences.get(fam.nom) ?? 0) + 1);

      const i = EXCEPTIONS.findIndex((e) => e.famille === fam.nom
        && (e.outils === 'tous' || e.outils.includes(outil))
        && e.ligne.test(texte));

      if (i === -1) {
        fail(`${fichier}:${no} — famille « ${fam.nom} » SANS exception :\n`
          + `        ${texte}\n`
          + `        ${fam.pourquoi}\n`
          + '        Corrige a la cause, ou ajoute une exception JUSTIFIEE dans ce fichier.');
      } else {
        utilisee.set(i, utilisee.get(i) + 1);
      }
    }
  }
}

pass(`${total} occurrence(s) signalee(s), toutes couvertes`);
for (const [nom, n] of [...occurrences].sort()) console.log(`         ${nom} : ${n}`);
const muettes = FAMILLES.length - occurrences.size;
console.log(`         ${muettes} famille(s) sur ${FAMILLES.length} n'ont rien declenche.`);

// ===========================================================================
// PLAN 2 — aucune exception morte
// ===========================================================================
console.log('');
console.log('Plan 2 — aucune exception morte');

EXCEPTIONS.forEach((e, i) => {
  verifier(utilisee.get(i) > 0,
    utilisee.get(i) > 0
      ? `exception « ${e.famille} » utilisee ${utilisee.get(i)} fois`
      : `exception « ${e.famille} » / ${JSON.stringify(e.outils)} ne sert plus — a retirer. `
        + 'Une exception qu\'on n\'elague pas finit par autoriser ce que plus personne n\'examine.');
  verifier(String(e.pourquoi ?? '').length >= 80,
    `exception « ${e.famille} » : justification ecrite et substantielle`);
  verifier(e.outils === 'tous' || Array.isArray(e.outils),
    `exception « ${e.famille} » : portee declaree`);
  verifier(FAMILLES.some((f) => f.nom === e.famille),
    `exception « ${e.famille} » : la famille existe encore`);
});

// ===========================================================================
// PLAN 3 — CONTRE-EPREUVE PAR FAMILLE
//
// Chacune des trente-et-une familles recoit un script fautif construit pour
// elle, et doit le voir. Sans cela, une famille dont le motif serait devenu
// faux — une faute de frappe, une parenthese mal placee — resterait silencieuse
// et le scanner paraitrait vert pour la meilleure des mauvaises raisons.
// ===========================================================================
console.log('');
console.log(`Plan 3 — contre-epreuve par famille (${FAMILLES.length})`);

const FAUTIFS = {
  'rm -rf': 'rm -rf /srv/donnees',
  rm: 'rm /srv/donnees/fichier',
  rmdir: 'rmdir /srv/vide',
  'dd vers un peripherique': 'dd if=/dev/zero of=/dev/sdb bs=1M',
  mkfs: 'mkfs.ext4 /dev/sdb1',
  wipefs: 'wipefs -a /dev/sdb',
  'fdisk / parted / sfdisk en ecriture': 'parted /dev/sdb mklabel gpt',
  'mdadm destructif': 'mdadm --zero-superblock /dev/sdb',
  'ecriture dans /etc/fstab': 'echo UUID=x / ext4 defaults 0 1 >> /etc/fstab',
  quotaoff: 'quotaoff -a',
  'chmod -R': 'chmod -R 777 /srv',
  'chown -R': 'chown -R nobody /srv',
  'setfacl -R': 'setfacl -R -m u:bob:rwx /srv',
  'chmod, chown ou setfacl par find -exec': 'find /srv -type f -exec chmod 777 {} +',
  'sed -i': 'sed -i s/a/b/ /etc/hosts',
  'redirection vers /etc': 'echo x > /etc/motd',
  'tee vers /etc': 'echo x | tee /etc/motd',
  'iptables -F': 'iptables -F',
  'nft flush ruleset': 'nft flush ruleset',
  'ufw reset ou disable': 'ufw disable',
  'userdel / groupdel': 'userdel bob',
  'suppression de cle SSH': 'rm /home/bob/.ssh/authorized_keys',
  'ecriture dans passwd/shadow/sudoers': 'echo bob >> /etc/sudoers',
  'systemctl disable --now': 'systemctl disable --now ssh',
  'telechargement puis execution': 'curl https://exemple.test/x | sh',
  eval: 'eval $COMMANDE',
  'mot de passe en clair': 'smbpasswd --password secret',
  'cle privee': 'cat /home/bob/.ssh/id_rsa',
  'joker non borne': 'rm /srv/donnees/*',
  'variable non protegee dans une commande destructrice': 'rm -rf $CIBLE/',
  'reboot ou shutdown': 'shutdown -r now',
  'Set-ExecutionPolicy': 'Set-ExecutionPolicy Bypass',
};

for (const fam of FAMILLES) {
  const fautif = FAUTIFS[fam.nom];
  if (fautif === undefined) {
    fail(`famille « ${fam.nom} » : AUCUN cas fautif de contre-epreuve — elle n'est pas eprouvee`);
    continue;
  }
  fam.motif.lastIndex = 0;
  verifier(fam.motif.test(fautif),
    `contre-epreuve « ${fam.nom} » : « ${fautif} » est bien detecte`);

  // Et le cas fautif doit traverser codeNu sans etre efface : un cas
  // construit a l'interieur d'une chaine ne prouverait rien.
  verifier(lignesDeclenchantes(codeNu(fautif), fam).length === 1,
    `contre-epreuve « ${fam.nom} » : detecte aussi apres passage par codeNu`);
}

verifier(Object.keys(FAUTIFS).length === FAMILLES.length,
  `autant de cas fautifs (${Object.keys(FAUTIFS).length}) que de familles (${FAMILLES.length})`);

// ===========================================================================
// PLAN 4 — codeNu : ce qu'il efface, et ce qu'il ne doit SURTOUT pas effacer
// ===========================================================================
console.log('');
console.log('Plan 4 — le retrait du texte litteral');

const casCodeNu = [
  ['commentaire efface', '# rm -rf /\n', false],
  ['texte entre apostrophes efface', "printf '%s\\n' 'ne lance jamais rm -rf /'", false],
  ['texte entre guillemets efface', 'printf "%s" "ne lance jamais rm -rf /"', false],
  ['substitution DANS des guillemets conservee', 'X="$(rm -rf /srv)"', true],
  ['code nu conserve', 'rm -rf /srv/donnees', true],
  ['antislash entre apostrophes ne desynchronise pas',
   "sed -e 's/\\\\/\\\\\\\\/g' -e 's/\"/x/g'\nprintf ok\n", false],
];

const famRmRf = FAMILLES.find((f) => f.nom === 'rm -rf');
for (const [nom, src, attendu] of casCodeNu) {
  const vu = lignesDeclenchantes(codeNu(src), famRmRf).length > 0;
  verifier(vu === attendu,
    `codeNu — ${nom} : ${attendu ? 'conserve' : 'efface'}${vu === attendu ? '' : ' — OBTENU L\'INVERSE'}`);
}

// Le cas qui a reellement casse l'outil : une substitution de commande dans
// des guillemets, suivie plus loin d'une apostrophe dans une autre chaine.
// L'ancienne version se desynchronisait et rendait du faux code.
const piege = 'X="$(getent passwd)"\n'
  + 'printf \'%s\' "$(echo a | sed -e \'s/\\\\/\\\\\\\\/g\' -e \'s/"/\\\\"/g\')"\n'
  + 'echo fin\n';
const famPasswd = FAMILLES.find((f) => f.nom === 'ecriture dans passwd/shadow/sudoers');
verifier(lignesDeclenchantes(codeNu(piege), famPasswd).length === 0,
  'codeNu — « "$( ... )" » suivi d\'une apostrophe ne produit pas de fausse alerte');

// ===========================================================================
console.log('');
console.log(`Scanner Bash : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log(`${FAMILLES.length} familles, ${EXCEPTIONS.length} exception(s) justifiee(s), `
  + `${total} occurrence(s) couverte(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
