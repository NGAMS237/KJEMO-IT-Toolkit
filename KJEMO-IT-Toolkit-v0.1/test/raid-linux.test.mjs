#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DU RAID : CHAQUE VERROU, DÉSARMÉ SÉPARÉMENT
//
// Les deux assistants RAID sont EXÉCUTÉS, dans un bac à sable, avec `mdadm`,
// `mkfs.ext4`, `lsblk`, `blkid`, `wipefs`, `findmnt`, `mount` et `udevadm`
// remplacés par des doublures. On compte les appels, on vérifie leur ORDRE,
// on lit les arguments reçus, et on mesure si le fichier fstab — redirigé
// vers le bac — a été touché, octet pour octet.
//
// LES NEUF SCÉNARIOS EXIGÉS
//
//   A  confirmation absente          → 0 mdadm destructif, 0 mkfs
//   B  membre monté                  → 0 création
//   C  membre avec signature         → 0 création
//   D  doublon de disque             → 0 création
//   E  spare identique à un membre   → 0 création
//   F  CONTRÔLE POSITIF (création)   → les appels attendus, dans l'ordre,
//                                      et mkfs reçoit /dev/mdX
//   G  CONTRÔLE POSITIF (membres)    → fail avant remove, remove avant add
//   H  mauvaise relecture            → blocage, sur les deux assistants
//   I  chaque verrou désarmé séparément est détecté
//
// Les scénarios F et G ne sont pas des politesses : sans eux, les sept autres
// seraient verts même si le script ne démarrait pas, même si la doublure
// n'était pas posée, même si le PATH n'avait pas pris. C'est la leçon du
// repquota du commit 14/n, où seule une passe POSITIVE a montré un décalage
// de colonne qui faisait refuser une limite correctement posée.
//
// POURQUOI CE BANC EXIGE ROOT, ET DE FAUX NŒUDS DE PÉRIPHÉRIQUE
//
// Deux contrôles des scripts ne peuvent PAS être doublés par le PATH, parce
// que ce ne sont pas des commandes :
//
//   [ -b "${DISQUE}" ]   chaque disque doit être un périphérique bloc
//   id -u                linux-raid1-create exige root et sort sinon
//
// `[` est une primitive du shell : aucun mouchard ne l'atteint. Le banc crée
// donc cinq faux nœuds avec mknod, et exige root. Les nœuds pointent vers
// major 7 — des loop devices sans fichier attaché : même si une commande
// modifiante échappait aux mouchards, elle écrirait dans un périphérique sans
// support et échouerait avec ENXIO. Ce n'est pas la protection principale —
// les mouchards le sont — c'est la seconde.
//
// Et si ce banc ne peut pas tourner, il ÉCHOUE au lieu de se déclarer ignoré.
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur.
// Aucun vrai `mdadm --create`, aucun vrai mkfs, aucun vrai ensemble RAID,
// aucun /etc/fstab réel touché. Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(ROOT, 'dist/noyau-bash.mjs')).href);
const M = await import(pathToFileURL(resolve(ROOT, 'test/mouchards-linux.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

if (process.getuid() !== 0) {
  console.error('');
  console.error('ECHEC : ce banc doit tourner en root.');
  console.error('');
  console.error('Deux raisons, et aucune n est contournable :');
  console.error('  - linux-raid1-create EXIGE root et sort immediatement sinon :');
  console.error('    sans root, le controle positif ne prouverait rien ;');
  console.error('  - le banc cree cinq faux noeuds de peripherique avec mknod,');
  console.error('    parce que « [ -b ] » est une primitive du shell qu aucun');
  console.error('    mouchard ne peut doubler.');
  console.error('');
  console.error('  sudo -E env "PATH=$PATH" node test/raid-linux.test.mjs');
  console.error('');
  process.exit(1);
}

const outil = (id) => {
  const t = tools.find((x) => x.id === id);
  if (!t) { console.error(`ECHEC : outil « ${id} » absent du catalogue`); process.exit(1); }
  return t;
};
const creer = outil('linux-raid1-create');
const membres = outil('linux-raid-member-manage');

// ---------------------------------------------------------------------------
// LES FAUX PERIPHERIQUES
//
// M1, M2 et SP sont les trois disques de la creation. ENT est le disque
// entrant de la gestion des membres. MD_EXISTANT est l ensemble DEJA assemble
// que la gestion des membres interroge.
//
// MD_NEUF, lui, n est volontairement PAS cree ici : linux-raid1-create refuse
// un ensemble dont le peripherique existe deja. C est la doublure de mdadm qui
// le fabrique au moment du --create, exactement comme le noyau le ferait.
// ---------------------------------------------------------------------------
const M1 = '/dev/kjemo-raid-m1';
const M2 = '/dev/kjemo-raid-m2';
const SP = '/dev/kjemo-raid-sp';
const ENT = '/dev/kjemo-raid-ent';
const MD_NEUF = '/dev/md97';
const MD_EXISTANT = '/dev/md98';

const NOEUDS = [[M1, 230], [M2, 231], [SP, 232], [ENT, 233], [MD_EXISTANT, 234]];
const TOUS_NOEUDS = [...NOEUDS.map(([n]) => n), MD_NEUF];

const nettoyerNoeuds = () => {
  for (const n of TOUS_NOEUDS) {
    try { rmSync(n, { force: true }); } catch { /* jetable */ }
  }
};
/**
 * Retire l ensemble fabrique par la doublure de mdadm.
 *
 * Il DOIT etre absent au debut de chaque passe de creation : l etape 2 refuse
 * un ensemble dont le peripherique existe deja, et une passe qui heriterait du
 * noeud de la precedente serait verte — ou rouge — pour la mauvaise raison.
 */
const retirerMdNeuf = () => {
  try { rmSync(MD_NEUF, { force: true }); } catch { /* jetable */ }
};

nettoyerNoeuds();
for (const [noeud, minor] of NOEUDS) {
  try {
    execFileSync('mknod', [noeud, 'b', '7', String(minor)], { stdio: 'pipe' });
  } catch (e) {
    console.error(`ECHEC : impossible de creer le faux peripherique ${noeud} : ${e.message}`);
    process.exit(1);
  }
}
process.on('exit', nettoyerNoeuds);
console.log(`Faux peripheriques crees : ${NOEUDS.map(([n]) => n).join(', ')} (loop sans support, major 7).`);
if (existsSync(MD_NEUF)) {
  console.error(`ECHEC : ${MD_NEUF} existe deja — l etape « l ensemble est-il libre ? » serait fausse.`);
  process.exit(1);
}

const FSTAB_INITIAL = '# fstab d essai\nUUID=00000000-1111-2222-3333-444444444444 / ext4 defaults 0 1\n';
const UUID_ENS = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/**
 * Cite une chaine pour le shell en PRESERVANT ses retours a la ligne.
 *
 * JSON.stringify ne convient pas : « \n » dans une chaine entre guillemets
 * doubles n'est pas interprete par bash, et `printf '%s\n' "a\nb"` imprime
 * un antislash suivi d'un n. La sortie de `mdadm --detail` devenait alors une
 * ligne unique, et l'awk qui lit « Spare Devices » comptait les chiffres de
 * tout le bloc. La passe F l'a vu ; c'est le genre de detail qui rend un banc
 * rouge — ou vert — pour la mauvaise raison.
 */
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

/** Une sortie `mdadm --detail` plausible, parametrable. */
function detailMdadm({ etat = 'clean', spares = 0, listes = [] } = {}) {
  const lignes = [
    `        Version : 1.2`,
    `     Raid Level : raid1`,
    `          State : ${etat}`,
    ` Active Devices : 2`,
    `Working Devices : ${2 + spares}`,
    ` Failed Devices : 0`,
    `  Spare Devices : ${spares}`,
  ];
  listes.forEach((dev, i) => lignes.push(`       ${i}     8     ${16 + i}      ${i}      active sync   ${dev}`));
  return lignes.join('\n');
}

/**
 * Prépare un bac pour `linux-raid1-create`.
 *
 * Chaque réponse de doublure est une DÉCISION de scénario : c'est en les
 * changeant qu'on fabrique les passes B, C et H.
 */
function bacCreation(nom, {
  spare = '',
  confirmation = MD_NEUF,
  montageDe = null,        // le disque qui répondra « monté »
  signatureDe = null,      // le disque qui portera une signature résiduelle
  fsDejaSurEnsemble = '',  // l'ensemble porte déjà un système de fichiers
  uuidRelu = UUID_ENS,     // vide → la relecture blkid échoue
  typeRelu = 'ext4',
  codeMdadm = 0,
  codeMkfs = 0,
  fstabValide = true,
  cpCasse = false,
} = {}) {
  const bac = M.creerBac(nom);
  const fstab = join(bac.travail, 'fstab');
  const mp = join(bac.travail, 'montage');
  writeFileSync(fstab, FSTAB_INITIAL, 'utf8');

  // lsblk répond selon ses arguments. L'ordre des motifs compte : la ligne
  // « -P -o PATH,TYPE,FSTYPE,MOUNTPOINTS » contient les mots FSTYPE et
  // MOUNTPOINTS, et serait captée par les motifs suivants si elle ne venait
  // pas en premier. Ce détail a l'air mineur ; c'est exactement le genre
  // d'ordre qui rend une passe verte pour une mauvaise raison.
  const ligneP = (dev) => {
    const mpts = dev === montageDe ? '/mnt/ailleurs' : '';
    return `PATH="${dev}" TYPE="disk" FSTYPE="" MOUNTPOINTS="${mpts}"`;
  };
  M.poserMouchard(bac, 'lsblk', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '-P -o PATH'; then",
      ...[M1, M2, SP, ENT].map((d) => `  if printf '%s' "$*" | grep -qF -- '${d}'; then printf '%s\\n' '${ligneP(d)}'; exit 0; fi`),
      "  printf '%s\\n' 'PATH=\"inconnu\" TYPE=\"disk\" FSTYPE=\"\" MOUNTPOINTS=\"\"'",
      '  exit 0',
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- '-dn -o SIZE'; then printf '%s\\n' '8G'; exit 0; fi",
      `if printf '%s' "$*" | grep -qE -- '-dn -o FSTYPE'; then printf '%s\\n' '${fsDejaSurEnsemble}'; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- '-o MOUNTPOINTS'; then printf '%s\\n' ''; exit 0; fi",
    ],
  });
  M.poserMouchard(bac, 'wipefs', {
    code: 0,
    avant: signatureDe
      ? [`if printf '%s' "$*" | grep -qF -- '${signatureDe}'; then printf '%s\\n' 'offset  type\\n0x438  ext4'; exit 0; fi`]
      : [],
  });
  // La doublure de mdadm FABRIQUE le peripherique au --create : c est ce que
  // fait le noyau, et sans cela l etape 5 refuserait a juste titre un
  // ensemble qui n apparait pas.
  M.poserMouchard(bac, 'mdadm', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '--create'; then",
      `  mknod '${MD_NEUF}' b 7 235 2>/dev/null || true`,
      `  exit ${codeMdadm}`,
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- '--detail'; then",
      `  printf '%s\\n' ${sq(detailMdadm({ spares: spare ? 1 : 0, listes: [M1, M2] }))}`,
      '  exit 0',
      'fi',
    ],
  });
  M.poserMouchard(bac, 'mkfs.ext4', { code: codeMkfs });
  M.poserMouchard(bac, 'mkfs.xfs', { code: codeMkfs });
  M.poserMouchard(bac, 'blkid', {
    code: 0,
    selonArgs: [
      { motif: '-s UUID', code: 0, sortie: uuidRelu },
      { motif: '-s TYPE', code: 0, sortie: typeRelu },
    ],
  });
  M.poserMouchard(bac, 'findmnt', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '--verify --tab-file'; then exit ${fstabValide ? 0 : 1}; fi`,
      `if printf '%s' "$*" | grep -qE -- '-o SOURCE'; then printf '%s\\n' '${MD_NEUF}'; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- '--mountpoint'; then exit 0; fi",
    ],
  });
  M.poserMouchard(bac, 'mount', { code: 0 });
  M.poserMouchard(bac, 'udevadm', { code: 0 });
  // `sleep` est double pour que le banc ne paie pas les temporisations du
  // script : elles servent au noyau, pas a la preuve.
  M.poserMouchard(bac, 'sleep', { code: 0 });
  if (cpCasse) M.poserMouchard(bac, 'cp', { code: 1 });

  const valeurs = {
    ensemble: MD_NEUF,
    membre1: M1,
    membre2: M2,
    spare,
    pointMontage: '/srv/raid',
    systemeFichiers: 'ext4',
    confirmation,
    format: 'Console',
  };
  let texte = normalizeScriptSh(creer.generate(valeurs));
  const redirections = [
    ["KJEMO_FSTAB='/etc/fstab'", `KJEMO_FSTAB='${fstab}'`],
    ["KJEMO_MP='/srv/raid'", `KJEMO_MP='${mp}'`],
  ];
  for (const [de, vers] of redirections) {
    const avant = texte;
    texte = texte.replace(de, vers);
    if (texte === avant) fail(`la redirection « ${de} » vers le bac a echoue : le banc toucherait au vrai systeme`);
  }
  return { bac, texte, fstab, mp };
}

/** Prépare un bac pour `linux-raid-member-manage`. */
function bacMembres(nom, {
  sortant = M2,
  entrant = ENT,
  confirmation = MD_EXISTANT,
  etat = 'clean',
  mdstat = 'Personalities : [raid1]\nmd98 : active raid1 kjemo-raid-m1[0] kjemo-raid-m2[1]\n      8388608 blocks super 1.2 [2/2] [UU]\n',
  // Apres un --add, le noyau DEMARRE la reconstruction : le banc le modelise,
  // parce que c'est la fenetre pendant laquelle l'ensemble n'a pas encore
  // retrouve sa redondance, et c'est precisement ce que le script ne doit pas
  // annoncer comme termine.
  mdstatApresAdd = null,
  detailVideApres = null,  // 'fail' | 'remove' | 'add' : la relecture échoue
  sortantMembre = true,
  entrantMonte = false,
  entrantSignature = false,
  codeFail = 0,
  codeRemove = 0,
  codeAdd = 0,
} = {}) {
  const bac = M.creerBac(nom);
  const marqueur = join(bac.racine, 'etape');
  const listes = sortantMembre ? [M1, sortant] : [M1, '/dev/kjemo-raid-autre'];
  const detail = detailMdadm({ etat, listes });

  M.poserMouchard(bac, 'mdadm', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '--fail'; then printf '%s\\n' 'fail' > '${marqueur}'; exit ${codeFail}; fi`,
      `if printf '%s' "$*" | grep -qE -- '--remove'; then printf '%s\\n' 'remove' > '${marqueur}'; exit ${codeRemove}; fi`,
      `if printf '%s' "$*" | grep -qE -- '--add'; then printf '%s\\n' 'add' > '${marqueur}'; exit ${codeAdd}; fi`,
      "if printf '%s' \"$*\" | grep -qE -- '--detail'; then",
      ...(detailVideApres
        ? [`  if [ -f '${marqueur}' ] && grep -qF -- '${detailVideApres}' '${marqueur}'; then exit 0; fi`]
        : []),
      `  printf '%s\\n' ${sq(detail)}`,
      '  exit 0',
      'fi',
    ],
  });
  M.poserMouchard(bac, 'lsblk', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '-dn -o SIZE'; then printf '%s\\n' '8G'; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- '-o MOUNTPOINTS'; then printf '%s\\n' '${entrantMonte ? '/mnt/ailleurs' : ''}'; exit 0; fi`,
    ],
  });
  M.poserMouchard(bac, 'wipefs', {
    code: 0,
    sortie: entrantSignature ? 'offset  type\n0x438  ext4' : '',
  });
  M.poserMouchard(bac, 'sleep', { code: 0 });
  // /proc/mdstat n est pas une commande : le script le lit avec `cat`. La
  // doublure de `cat` repond pour ce chemin-la et DELEGUE pour tous les
  // autres, sinon le script perdrait ses propres fichiers de travail.
  M.poserMouchard(bac, 'cat', {
    code: 0,
    avant: [
      "if [ \"$*\" = '/proc/mdstat' ]; then",
      ...(mdstatApresAdd
        ? [`  if [ -f '${marqueur}' ] && grep -qF -- 'add' '${marqueur}'; then printf '%s' ${sq(mdstatApresAdd)}; exit 0; fi`]
        : []),
      `  printf '%s' ${sq(mdstat)}`,
      '  exit 0',
      'fi',
      'exec /bin/cat "$@"',
    ],
  });

  const valeurs = {
    ensemble: MD_EXISTANT,
    membreSortant: sortant,
    membreEntrant: entrant,
    confirmation,
    format: 'Console',
  };
  return { bac, texte: normalizeScriptSh(membres.generate(valeurs)) };
}

// ===========================================================================
// PLAN 0 — AUCUN CONTOURNEMENT DU PATH
//
// La condition de validite de tout le banc : si un script appelait
// /sbin/mdadm, « zero appel » voudrait dire « hors de ma vue ».
// ===========================================================================
console.log('');
console.log('Plan 0 — aucun chemin absolu ni « command -p » sur une commande surveillée');
for (const [id, t] of [['linux-raid1-create', creer], ['linux-raid-member-manage', membres]]) {
  const texte = normalizeScriptSh(t.generate(Object.fromEntries(
    t.fields.map((f) => [f.id, f.default ?? '']),
  )));
  const suspects = M.cheminsAbsolusSuspects(texte);
  verifier(suspects.length === 0,
    `${id} : aucun contournement du PATH (${suspects.map((s) => `${s.commande} → ${s.trouve}`).join(', ') || 'aucun'})`);
}

// ===========================================================================
console.log('');
console.log('Passe A — la confirmation manque');
{
  const { bac, texte, fstab } = bacCreation('A', { confirmation: '' });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'mdadm', '--create') === 0,
      `A — ZERO mdadm --create sans confirmation (${M.compterAppels(r.journal, 'mdadm', '--create')})`);
    verifier(M.compterAppels(r.journal, 'mkfs.ext4') === 0,
      `A — ZERO mkfs sans confirmation (${M.compterAppels(r.journal, 'mkfs.ext4')})`);
    verifier(readFileSync(fstab, 'utf8') === FSTAB_INITIAL,
      'A : fstab inchangé octet pour octet');
    verifier(!existsSync(MD_NEUF), 'A : aucun ensemble n’a été fabriqué');
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'A : le script le DIT');
    verifier(/confirmation/i.test(r.sortie), 'A : la condition manquante est NOMMÉE');
    verifier(r.journal.length > 0,
      'A : preuve d’exécution — le journal des mouchards n’est pas vide');
  } finally { M.detruireBac(bac); retirerMdNeuf(); }
}

console.log('');
console.log('Passe B — un membre est monté');
{
  const { bac, texte, fstab } = bacCreation('B', { montageDe: M2 });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'mdadm', '--create') === 0,
      'B — ZERO création quand un membre est monté');
    verifier(M.compterAppels(r.journal, 'mkfs.ext4') === 0, 'B — ZERO mkfs');
    verifier(readFileSync(fstab, 'utf8') === FSTAB_INITIAL, 'B : fstab inchangé');
    verifier(/n est pas libre : monte sur/.test(r.sortie),
      'B : le rapport Console dit LEQUEL des sept motifs refuse le disque');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe C — un membre porte une signature résiduelle');
{
  const { bac, texte, fstab } = bacCreation('C', { signatureDe: M1 });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'mdadm', '--create') === 0,
      'C — ZERO création quand un disque porte une signature');
    verifier(M.compterAppels(r.journal, 'wipefs', '-n') >= 1,
      'C : la détection passe bien par « wipefs -n », en lecture');
    verifier(M.compterAppels(r.journal, 'wipefs', '-a|--all') === 0,
      'C : aucun « wipefs -a » — l’assistant n’efface rien');
    verifier(readFileSync(fstab, 'utf8') === FSTAB_INITIAL, 'C : fstab inchangé');
    verifier(/signature/.test(r.sortie), 'C : le script nomme la signature');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe D — les deux membres visent le même disque');
{
  // Le formulaire refuse ce cas : generate() lèverait. On éprouve donc la
  // garde qui vit DANS le script, en retouchant la variable — exactement ce
  // qui arriverait si quelqu'un relisait le script et changeait un nom.
  const { bac, texte, fstab } = bacCreation('D', {});
  try {
    const trafique = texte.replace(`KJEMO_M2='${M2}'`, `KJEMO_M2='${M1}'`);
    verifier(trafique !== texte, 'D : la variable du second membre a bien été retouchée');
    const r = M.executer(bac, trafique);
    verifier(M.compterAppels(r.journal, 'mdadm', '--create') === 0,
      'D — ZERO création sur un doublon de disque');
    verifier(readFileSync(fstab, 'utf8') === FSTAB_INITIAL, 'D : fstab inchangé');
    verifier(/identiques|meme disque/.test(r.sortie), 'D : le script dit pourquoi');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe E — le spare est identique à un membre actif');
{
  const { bac, texte, fstab } = bacCreation('E', { spare: SP });
  try {
    const trafique = texte.replace(`KJEMO_SPARE='${SP}'`, `KJEMO_SPARE='${M1}'`);
    verifier(trafique !== texte, 'E : la variable du secours a bien été retouchée');
    const r = M.executer(bac, trafique);
    verifier(M.compterAppels(r.journal, 'mdadm', '--create') === 0,
      'E — ZERO création quand le secours est aussi un membre');
    verifier(readFileSync(fstab, 'utf8') === FSTAB_INITIAL, 'E : fstab inchangé');
    verifier(/ne remplacerait rien/.test(r.sortie),
      'E : le script explique qu’un tel secours ne remplacerait rien');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe F — CONTRÔLE POSITIF : la création, avec un disque de secours');
{
  const { bac, texte, fstab, mp } = bacCreation('F', { spare: SP });
  try {
    const r = M.executer(bac, texte);
    verifier(r.code === 0, `F : le script sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'mdadm', '--create') === 1,
      `F : mdadm --create appelé exactement une fois (${M.compterAppels(r.journal, 'mdadm', '--create')})`);

    const argsCreate = r.journal.find((e) => e.nom === 'mdadm' && /--create/.test(e.args))?.args ?? '';
    verifier(/--level=raid1\b/.test(argsCreate) && /--raid-devices=2\b/.test(argsCreate),
      `F : les options arrivent SÉPARÉES, espaces compris — la faute du cours est corrigée (${argsCreate})`);
    verifier(/--spare-devices=1\b/.test(argsCreate), `F : le secours est déclaré comme spare (${argsCreate})`);
    verifier(!/--force/.test(argsCreate) && !/--assume-clean/.test(argsCreate),
      'F : ni --force ni --assume-clean');
    verifier(argsCreate.split(/\s+/).filter((a) => a === M1 || a === M2 || a === SP).length === 3,
      `F : les trois disques sont nommés une fois chacun (${argsCreate})`);

    const argsMkfs = r.journal.find((e) => e.nom === 'mkfs.ext4')?.args ?? '';
    verifier(M.compterAppels(r.journal, 'mkfs.ext4') === 1,
      `F : mkfs appelé exactement une fois (${M.compterAppels(r.journal, 'mkfs.ext4')})`);
    verifier(argsMkfs.trim() === MD_NEUF,
      `F — mkfs reçoit L’ENSEMBLE et rien d’autre (${argsMkfs})`);
    verifier(![M1, M2, SP].some((d) => argsMkfs.split(/\s+/).includes(d)),
      `F — mkfs ne reçoit JAMAIS un membre (${argsMkfs})`);

    verifier(M.appeleAvant(r.journal, 'mdadm', 'mkfs.ext4'),
      'F : la création précède le formatage');
    const iCreate = r.journal.findIndex((e) => e.nom === 'mdadm' && /--create/.test(e.args));
    const iDetail = r.journal.findIndex((e, k) => e.nom === 'mdadm' && /--detail/.test(e.args) && k > iCreate);
    const iMkfs = r.journal.findIndex((e) => e.nom === 'mkfs.ext4');
    const iBlkid = r.journal.findIndex((e, k) => e.nom === 'blkid' && k > iMkfs);
    const iMount = r.journal.findIndex((e) => e.nom === 'mount');
    verifier(iDetail !== -1 && iDetail < iMkfs,
      'F : la RELECTURE mdadm --detail s’intercale entre la création et le formatage');
    verifier(iBlkid !== -1 && iMkfs < iBlkid,
      'F : blkid relit le système de fichiers APRÈS mkfs');
    verifier(iMount !== -1 && iBlkid < iMount,
      'F : le montage vient après la relecture — c’est elle qui décide');

    const contenu = readFileSync(fstab, 'utf8');
    verifier(contenu !== FSTAB_INITIAL, 'F : fstab a bien été complété');
    verifier(contenu.includes(`UUID=${UUID_ENS}`),
      'F — c’est l’UUID du système de fichiers qui est écrit, et non /dev/mdX');
    verifier(!contenu.split('\n').some((l) => l.startsWith(MD_NEUF)),
      'F : aucune ligne ne désigne l’ensemble par son numéro');
    const ligne = contenu.split('\n').find((l) => l.includes(`UUID=${UUID_ENS}`))?.split(/\s+/) ?? [];
    verifier(ligne.length === 6, `F : la ligne ajoutée a six champs (${ligne.length} : ${ligne.join('|')})`);
    verifier(ligne[1] === mp, `F : le point de montage est celui demandé (${ligne[1]})`);
    verifier(ligne[3].includes('nofail'),
      `F : « nofail » est présent — un RAID absent ne doit pas bloquer le démarrage (${ligne[3]})`);
    verifier(FSTAB_INITIAL.split('\n').every((l) => contenu.includes(l)),
      'F : les lignes préexistantes de fstab sont toutes conservées');

    const sauvegardes = r.fichiers.ajoutes.filter((f) => /fstab.*\.bak$/.test(f));
    verifier(sauvegardes.length === 1,
      `F : une sauvegarde vérifiée a été laissée (${sauvegardes.length})`);
    verifier(!existsSync(`${fstab}.kjemo-nouveau`),
      'F : le fichier intermédiaire du remplacement atomique n’est pas laissé');
    verifier(/mdadm.conf/.test(r.sortie) && /initramfs/.test(r.sortie),
      'F : le script DIT que mdadm.conf et l’initramfs restent à faire à la main');
    verifier(/Secours declare/.test(r.sortie) === false,
      'F : le nombre de secours relu correspond — aucun avertissement là-dessus');
  } finally { M.detruireBac(bac); retirerMdNeuf(); }
}

console.log('');
console.log('Passe G — CONTRÔLE POSITIF : fail, PUIS remove, PUIS add');
{
  const { bac, texte } = bacMembres('G', {
    mdstatApresAdd: 'md98 : active raid1 kjemo-raid-ent[2] kjemo-raid-m1[0]\n      [==>.......]  recovery = 12.7% (1065024/8388608) finish=3.2min\n',
  });
  try {
    const r = M.executer(bac, texte);
    verifier(r.code === 0, `G : le script sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'mdadm', '--fail') === 1, 'G : un seul --fail');
    verifier(M.compterAppels(r.journal, 'mdadm', '--remove') === 1, 'G : un seul --remove');
    verifier(M.compterAppels(r.journal, 'mdadm', '--add') === 1, 'G : un seul --add');

    const iFail = r.journal.findIndex((e) => /--fail/.test(e.args));
    const iRemove = r.journal.findIndex((e) => /--remove/.test(e.args));
    const iAdd = r.journal.findIndex((e) => /--add/.test(e.args));
    verifier(iFail !== -1 && iRemove !== -1 && iFail < iRemove,
      'G — fail AVANT remove : mdadm refuse de retirer un membre non marqué');
    verifier(iRemove !== -1 && iAdd !== -1 && iRemove < iAdd,
      'G — remove AVANT add');
    const relecturesEntre = r.journal.filter((e, k) => e.nom === 'mdadm' && /--detail/.test(e.args)
      && k > iFail && k < iRemove).length;
    verifier(relecturesEntre >= 1,
      'G — une RELECTURE s’intercale entre fail et remove : « mdadm a rendu 0 » ne dit pas que le rôle a changé');
    verifier(r.journal.filter((e, k) => e.nom === 'mdadm' && /--detail/.test(e.args) && k > iRemove && k < iAdd).length >= 1,
      'G : une relecture s’intercale aussi entre remove et add');
    verifier(r.journal.filter((e, k) => e.nom === 'mdadm' && /--detail/.test(e.args) && k > iAdd).length >= 1,
      'G : une relecture suit l’ajout');

    verifier(M.compterAppels(r.journal, 'mdadm', '--zero-superblock') === 0,
      'G : aucun --zero-superblock');
    verifier(M.compterAppels(r.journal, 'mdadm', '--stop') === 0, 'G : aucun --stop');
    verifier(/La reconstruction tourne/.test(r.sortie)
      && /n a PAS encore retrouve sa redondance/.test(r.sortie),
      'G — le script ne déclare PAS la reconstruction terminée : il dit qu’elle tourne');
    verifier(/watch -n 5 cat \/proc\/mdstat/.test(r.sortie),
      'G : et il donne la commande de suivi, plutôt que de laisser deviner');
    verifier(!/\btermine\b|\bterminee\b/i.test(r.sortie),
      'G : le mot « terminé » n’apparaît nulle part — « mdadm a rendu 0 » ne le prouve pas');
    const argsAdd = r.journal.find((e) => /--add/.test(e.args))?.args ?? '';
    verifier(argsAdd.includes(ENT) && !argsAdd.includes(M1),
      `G : --add reçoit le disque entrant, et pas un membre sain (${argsAdd})`);
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe H — une relecture qui ne répond plus bloque la suite');
{
  // Création : blkid ne rend aucun UUID après mkfs. Le système de fichiers
  // existe peut-être, mais rien ne le prouve : fstab ne doit pas être touché.
  const { bac, texte, fstab } = bacCreation('H1', { uuidRelu: '' });
  try {
    const r = M.executer(bac, texte);
    verifier(r.code !== 0, `H1 : sortie en erreur (code ${r.code})`);
    verifier(readFileSync(fstab, 'utf8') === FSTAB_INITIAL,
      'H1 — relecture blkid muette → fstab inchangé octet pour octet');
    verifier(/PAS ete modifie/.test(r.sortie), 'H1 : le script DIT que fstab n’a pas été modifié');
  } finally { M.detruireBac(bac); retirerMdNeuf(); }

  // Gestion des membres : mdadm --detail ne rend plus rien après le --fail.
  const { bac: b2, texte: t2 } = bacMembres('H2', { detailVideApres: 'fail' });
  try {
    const r = M.executer(b2, t2);
    verifier(r.code !== 0, `H2 : sortie en erreur (code ${r.code})`);
    verifier(M.compterAppels(r.journal, 'mdadm', '--fail') === 1, 'H2 : le --fail a bien eu lieu');
    verifier(M.compterAppels(r.journal, 'mdadm', '--remove') === 0,
      'H2 — relecture illisible après fail → ZERO remove');
    verifier(M.compterAppels(r.journal, 'mdadm', '--add') === 0, 'H2 : ZERO add');
    verifier(/ne rend plus rien/.test(r.sortie),
      'H2 : le script dit, sur stderr, après quelle étape l’ensemble a cessé de répondre');
    verifier(/apres l etape fail/.test(r.sortie),
      'H2 : il NOMME l’étape — c’est la seule information utile à ce moment-là');
  } finally { M.detruireBac(b2); }
}

console.log('');
console.log('Passe I — chaque verrou désarmé séparément');
{
  // I1 — l'ensemble porte déjà un système de fichiers : mkfs n'est pas lancé.
  const { bac, texte, fstab } = bacCreation('I1', { fsDejaSurEnsemble: 'ext4' });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'mkfs.ext4') === 0,
      'I1 — système de fichiers déjà présent sur l’ensemble → ZERO mkfs');
    verifier(readFileSync(fstab, 'utf8') === FSTAB_INITIAL, 'I1 : fstab inchangé');
  } finally { M.detruireBac(bac); retirerMdNeuf(); }

  // I2 — mdadm --create échoue : rien n'est formaté.
  const { bac: b2, texte: t2, fstab: f2 } = bacCreation('I2', { codeMdadm: 1 });
  try {
    const r = M.executer(b2, t2);
    verifier(M.compterAppels(r.journal, 'mkfs.ext4') === 0,
      'I2 — mdadm --create en échec → ZERO mkfs');
    verifier(readFileSync(f2, 'utf8') === FSTAB_INITIAL, 'I2 : fstab inchangé');
    verifier(/n a ete formate|n a ete ecrit/.test(r.sortie), 'I2 : le script le dit');
  } finally { M.detruireBac(b2); retirerMdNeuf(); }

  // I3 — mkfs échoue : fstab n'est pas touché.
  const { bac: b3, texte: t3, fstab: f3 } = bacCreation('I3', { codeMkfs: 1 });
  try {
    const r = M.executer(b3, t3);
    verifier(readFileSync(f3, 'utf8') === FSTAB_INITIAL,
      'I3 — mkfs en échec → fstab inchangé octet pour octet');
    verifier(/ARRET : mkfs a echoue/.test(r.sortie),
      'I3 : la sortie fatale parle sur stderr, et ne compte pas sur le rapport final');
    verifier(/n a PAS ete modifie/.test(r.sortie),
      'I3 : elle dit explicitement que /etc/fstab n’a pas été modifié');
  } finally { M.detruireBac(b3); retirerMdNeuf(); }

  // I4 — findmnt --verify refuse la COPIE de fstab : zéro remplacement.
  const { bac: b4, texte: t4, fstab: f4 } = bacCreation('I4', { fstabValide: false });
  try {
    const r = M.executer(b4, t4);
    verifier(readFileSync(f4, 'utf8') === FSTAB_INITIAL,
      'I4 — validation de la copie en échec → ZERO remplacement');
    verifier(M.compterAppels(r.journal, 'findmnt', '--verify --tab-file') >= 1,
      'I4 : la validation est bien tentée sur une COPIE');
    verifier(M.compterAppels(r.journal, 'mount') === 0, 'I4 : ZERO montage');
    const sauvegardes = r.fichiers.ajoutes.filter((f) => /fstab.*\.bak$/.test(f));
    verifier(sauvegardes.length === 0,
      `I4 : aucune sauvegarde créée — la validation précède la sauvegarde (${sauvegardes.length})`);
  } finally { M.detruireBac(b4); retirerMdNeuf(); }

  // I5 — la sauvegarde échoue : zéro écriture.
  const { bac: b5, texte: t5, fstab: f5 } = bacCreation('I5', { cpCasse: true });
  try {
    const r = M.executer(b5, t5);
    verifier(readFileSync(f5, 'utf8') === FSTAB_INITIAL,
      'I5 — sauvegarde en échec → fstab inchangé octet pour octet');
    verifier(r.code !== 0, `I5 : sortie en erreur (code ${r.code})`);
  } finally { M.detruireBac(b5); retirerMdNeuf(); }

  // I6 — l'ensemble est DÉJÀ dégradé : refus de marquer un second membre
  // défaillant. C'est le verrou le plus important des deux assistants.
  const { bac: b6, texte: t6 } = bacMembres('I6', { etat: 'clean, degraded' });
  try {
    const r = M.executer(b6, t6);
    verifier(M.compterAppels(r.journal, 'mdadm', '--fail') === 0,
      'I6 — ensemble déjà dégradé → ZERO --fail');
    verifier(M.compterAppels(r.journal, 'mdadm', '--remove') === 0, 'I6 : ZERO --remove');
    verifier(M.compterAppels(r.journal, 'mdadm', '--add') === 0, 'I6 : ZERO --add');
    verifier(/zero redondance|plus de redondance|refus de marquer/.test(r.sortie),
      'I6 : le script explique ce qu’un second fail détruirait');
  } finally { M.detruireBac(b6); }

  // I7 — une reconstruction tourne : refus d'agir.
  const { bac: b7, texte: t7 } = bacMembres('I7', {
    mdstat: 'md98 : active raid1 kjemo-raid-m1[0]\n      [=====>...]  recovery = 31.4% (2634048/8388608)\n',
  });
  try {
    const r = M.executer(b7, t7);
    verifier(M.compterAppels(r.journal, 'mdadm', '--fail') === 0,
      'I7 — reconstruction en cours → ZERO --fail');
    verifier(M.compterAppels(r.journal, 'mdadm', '--add') === 0, 'I7 : ZERO --add');
    verifier(/Reconstruction/.test(r.sortie), 'I7 : le script nomme la reconstruction');
  } finally { M.detruireBac(b7); }

  // I8 — le membre sortant n'appartient pas à cet ensemble.
  const { bac: b8, texte: t8 } = bacMembres('I8', { sortantMembre: false });
  try {
    const r = M.executer(b8, t8);
    verifier(M.compterAppels(r.journal, 'mdadm', '--fail') === 0,
      'I8 — membre étranger à l’ensemble → ZERO --fail');
    verifier(/n apparait pas dans mdadm --detail/.test(r.sortie),
      'I8 : le script dit pourquoi, et rappelle le risque de se tromper de disque');
  } finally { M.detruireBac(b8); }

  // I9 — le disque entrant est monté.
  const { bac: b9, texte: t9 } = bacMembres('I9', { entrantMonte: true });
  try {
    const r = M.executer(b9, t9);
    verifier(M.compterAppels(r.journal, 'mdadm', '--add') === 0,
      'I9 — disque entrant monté → ZERO --add');
    verifier(M.compterAppels(r.journal, 'mdadm', '--fail') === 0,
      'I9 : et ZERO --fail — la porte finale est unique, pas étape par étape');
  } finally { M.detruireBac(b9); }

  // I10 — le disque entrant porte une signature.
  const { bac: b10, texte: t10 } = bacMembres('I10', { entrantSignature: true });
  try {
    const r = M.executer(b10, t10);
    verifier(M.compterAppels(r.journal, 'mdadm', '--add') === 0,
      'I10 — disque entrant porteur de signature → ZERO --add');
    verifier(/signature/.test(r.sortie), 'I10 : le script nomme la signature');
  } finally { M.detruireBac(b10); }

  // I11 — confirmation absente sur la gestion des membres.
  const { bac: b11, texte: t11 } = bacMembres('I11', { confirmation: '' });
  try {
    const r = M.executer(b11, t11);
    verifier(M.compterAppels(r.journal, 'mdadm', '--fail') === 0
      && M.compterAppels(r.journal, 'mdadm', '--remove') === 0
      && M.compterAppels(r.journal, 'mdadm', '--add') === 0,
      'I11 — confirmation absente → ZERO mdadm destructif');
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'I11 : le script le DIT');
  } finally { M.detruireBac(b11); }

  // I12 — le --fail échoue : rien n'est retiré.
  const { bac: b12, texte: t12 } = bacMembres('I12', { codeFail: 1 });
  try {
    const r = M.executer(b12, t12);
    verifier(M.compterAppels(r.journal, 'mdadm', '--remove') === 0,
      'I12 — --fail en échec → ZERO --remove');
    verifier(/Aucun retrait effectue/.test(r.sortie), 'I12 : le script le dit sur stderr');
  } finally { M.detruireBac(b12); }

  // I13 — le --remove échoue : pas d'ajout par-dessus un retrait raté.
  const { bac: b13, texte: t13 } = bacMembres('I13', { codeRemove: 1 });
  try {
    const r = M.executer(b13, t13);
    verifier(M.compterAppels(r.journal, 'mdadm', '--add') === 0,
      'I13 — --remove en échec → ZERO --add');
    verifier(/reste marque defaillant/.test(r.sortie),
      'I13 : le script dit dans quel état l’ensemble est resté');
  } finally { M.detruireBac(b13); }
}

// ===========================================================================
console.log('');
console.log(`RAID Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur.');
console.log('Aucun vrai mdadm --create, aucun vrai mkfs, aucun vrai ensemble RAID,');
console.log('aucun /etc/fstab réel touché. Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
