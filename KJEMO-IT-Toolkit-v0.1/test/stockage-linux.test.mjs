#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — LE BANC DU STOCKAGE : CE QUE LE SCANNER NE PEUT PAS PROUVER
//
// Le scanner de sûreté garantit qu'aucune commande dangereuse n'existe dans un
// script sans raison écrite. Il ne peut PAS garantir qu'elle est inatteignable
// sans confirmation : pour cela, il faudrait comprendre le flot de contrôle du
// shell, et un motif ne le comprend pas.
//
// Ce banc le prouve autrement : il EXÉCUTE les scripts, avec `sfdisk`, `mkfs`,
// `wipefs`, `blkid`, `lsblk`, `findmnt`, `mount` et les autres remplacés par
// des mouchards, et il COMPTE.
//
// LES PASSES
//
//   A  confirmation absente        0 appel à sfdisk d'écriture, 0 appel à mkfs
//   B  disque monté                0 appel, même avec la confirmation exacte
//   C  signature présente          0 appel, même avec la confirmation exacte
//   D  disque qui n'est pas un     0 appel
//      disque entier
//   E  contrôle positif            les appels attendus ONT lieu, dans l'ordre
//   F  /etc/fstab : validation     0 écriture du fichier réel
//      en échec
//
// La passe E n'est pas une politesse. Sans elle, les cinq autres seraient
// vertes même si le script ne démarrait pas, même si le mouchard n'était pas
// posé, même si le PATH n'avait pas pris.
//
// CE QUE CE BANC NE DIT PAS
//
// Aucun vrai disque n'est touché. `sfdisk` ne partitionne rien ici, `mkfs` ne
// formate rien, et /etc/fstab n'est jamais ouvert : le script travaille sur un
// chemin de fstab redirigé vers le bac à sable. Ce banc prouve l'ORDRE et les
// VERROUS, pas que sfdisk sait partitionner — util-linux s'en charge.
// ---------------------------------------------------------------------------
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
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

const outil = tools.find((t) => t.id === 'linux-disk-partition-mount');
if (!outil) { console.error('ECHEC : linux-disk-partition-mount absent du catalogue'); process.exit(1); }

// ===========================================================================
// POURQUOI CE BANC EXIGE ROOT, ET DE FAUX NOEUDS DE PERIPHERIQUE
//
// Deux tests du script ne peuvent PAS etre doubles par le PATH, parce que ce
// ne sont pas des commandes :
//
//   [ -b "${KJEMO_DEV}" ]    le peripherique doit exister et etre un bloc
//   id -u                    l assistant exige root et sort sinon
//
// Un mouchard ne peut rien y faire : `[` est une primitive du shell. Le banc
// cree donc deux faux noeuds de peripherique avec mknod — un « disque » et sa
// « partition » — et exige d etre lance en root.
//
// Les noeuds pointent vers major 7, minor 250 et 251 : des loop devices sans
// fichier attache. Meme si une commande modifiante echappait aux mouchards,
// elle ecrirait dans un peripherique sans support et echouerait avec ENXIO.
// Ce n est pas la protection principale — les mouchards le sont — c est la
// seconde.
//
// Et si ce banc ne peut pas tourner, il ECHOUE au lieu de se declarer ignore.
// Sa preuve centrale est que sfdisk et mkfs sont inatteignables sans
// confirmation : un lot ou cette preuve ne tourne pas ne doit pas etre vert.
// ===========================================================================
const DEV = '/dev/kjemo-essai';
const PART = `${DEV}1`;

if (process.getuid() !== 0) {
  console.error('');
  console.error('ECHEC : ce banc doit tourner en root.');
  console.error('');
  console.error('Deux raisons, et aucune n est contournable :');
  console.error('  - l assistant eprouve EXIGE root et sort immediatement sinon :');
  console.error('    sans root, le controle positif ne prouverait rien ;');
  console.error('  - le banc cree deux faux noeuds de peripherique avec mknod,');
  console.error('    parce que « [ -b ] » est une primitive du shell qu aucun');
  console.error('    mouchard ne peut doubler.');
  console.error('');
  console.error('  sudo -E env "PATH=$PATH" node test/stockage-linux.test.mjs');
  console.error('');
  process.exit(1);
}

for (const [noeud, minor] of [[DEV, 250], [PART, 251]]) {
  if (existsSync(noeud)) rmSync(noeud, { force: true });
  try {
    execFileSync('mknod', [noeud, 'b', '7', String(minor)], { stdio: 'pipe' });
  } catch (e) {
    console.error(`ECHEC : impossible de creer le faux peripherique ${noeud} : ${e.message}`);
    process.exit(1);
  }
}
process.on('exit', () => {
  for (const noeud of [DEV, PART]) {
    try { rmSync(noeud, { force: true }); } catch { /* le bac est jetable */ }
  }
});
console.log(`Faux peripheriques crees : ${DEV} et ${PART} (loop sans support, major 7).`);

/**
 * Prépare un bac : mouchards posés, réponses canoniques choisies pour décrire
 * un disque vierge, non monté, de type « disk ».
 *
 * Chaque réponse est une DÉCISION de scénario : c'est en les changeant qu'on
 * fabrique les passes B, C et D.
 */
function preparerBac(nom, {
  type = 'disk',
  montage = '',
  fstypeDisque = '',
  signatures = '',
  table = '',
  confirmation = DEV,
  fstabValide = true,
} = {}) {
  const bac = M.creerBac(nom);
  const fstab = join(bac.travail, 'fstab');
  writeFileSync(fstab, '# faux fstab du bac a sable\n', 'utf8');

  // lsblk sert à trois questions différentes, et répond selon ses arguments.
  M.poserMouchard(bac, 'lsblk', {
    code: 0,
    selonArgs: [
      { motif: '-dn -o TYPE', code: 0, sortie: type },
      { motif: '-dn -o SIZE', code: 0, sortie: '20G' },
      { motif: '-dn -o FSTYPE', code: 0, sortie: '' },
      { motif: '-n -o TYPE', code: 0, sortie: type },
      {
        motif: '-P -o PATH,TYPE,FSTYPE,MOUNTPOINTS',
        code: 0,
        sortie: `PATH="${DEV}" TYPE="${type}" FSTYPE="${fstypeDisque}" MOUNTPOINTS="${montage}"`,
      },
      {
        motif: '-P -o PATH,TYPE',
        code: 0,
        sortie: `PATH="${DEV}" TYPE="disk"\nPATH="${PART}" TYPE="part"`,
      },
    ],
  });
  M.poserMouchard(bac, 'wipefs', { code: 0, sortie: signatures });
  M.poserMouchard(bac, 'blkid', {
    code: 0,
    selonArgs: [
      { motif: 'PTTYPE', code: 0, sortie: table },
      { motif: 's UUID', code: 0, sortie: '11111111-2222-3333-4444-555555555555' },
      { motif: 's TYPE', code: 0, sortie: 'ext4' },
    ],
  });
  M.poserMouchard(bac, 'findmnt', {
    code: 0,
    selonArgs: [
      { motif: '--verify --tab-file', code: fstabValide ? 0 : 1, sortie: fstabValide ? 'ok' : 'erreur simulee' },
      { motif: '--verify', code: 0, sortie: 'ok' },
      { motif: '--mountpoint', code: 0, sortie: PART },
      { motif: '-n -o SOURCE', code: 0, sortie: PART },
    ],
  });
  // Le mouchard sfdisk a une MEMOIRE, et c'est indispensable : sur un disque
  // vierge, « sfdisk --dump » ne rend rien ; après « sfdisk --label gpt », il
  // rend une table. Un mouchard sans mémoire ne peut pas représenter les deux,
  // et l'étape 9 du script — la relecture bloquante avant mkfs — s'arrêtait
  // donc sur un dump vide, avec raison. Le marqueur modélise la séquence
  // réelle, et il rend l'assertion « relu après écrit » signifiante : si le
  // script sautait l'écriture, le dump resterait vide et le script s'arrêterait.
  const marqueur = join(bac.racine, 'table-ecrite');
  if (table !== '') writeFileSync(marqueur, '', 'utf8');
  M.poserMouchard(bac, 'sfdisk', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '--label gpt'; then : > '${marqueur}'; fi`,
      `if printf '%s' "$*" | grep -qE -- '--dump'; then`,
      `  if [ -e '${marqueur}' ]; then printf '%s\\n' 'label: gpt'; fi`,
      '  exit 0',
      'fi',
    ],
    selonArgs: [
      { motif: '--help', code: 0, sortie: '  --lock' },
    ],
  });
  M.poserMouchard(bac, 'mkfs.ext4', { code: 0 });
  M.poserMouchard(bac, 'mkfs.xfs', { code: 0 });
  M.poserMouchard(bac, 'mount', { code: 0 });
  M.poserMouchard(bac, 'partprobe', { code: 0 });
  M.poserMouchard(bac, 'blockdev', { code: 0 });
  M.poserMouchard(bac, 'udevadm', { code: 0 });

  const valeurs = {
    peripherique: DEV,
    pointMontage: join(bac.travail, 'donnees'),
    systemeFichiers: 'ext4',
    etiquette: 'essai',
    optionsMontage: 'defaults,nofail',
    confirmation,
    format: 'Console',
  };
  // Le script est généré normalement, PUIS son chemin de /etc/fstab est
  // redirigé vers le bac. C'est la seule retouche, elle porte sur UNE ligne
  // d'affectation, et elle est indispensable : un test qui écrirait dans le
  // vrai /etc/fstab de la machine de CI serait inacceptable.
  let texte = normalizeScriptSh(outil.generate(valeurs));
  const avant = texte;
  texte = texte.replace("KJEMO_FSTAB='/etc/fstab'", `KJEMO_FSTAB='${fstab}'`);
  if (texte === avant) fail('la redirection de /etc/fstab vers le bac a echoue : le banc ecrirait dans le vrai fichier');

  return { bac, texte, fstab, valeurs };
}

const ecritures = (r) => M.compterAppels(r.journal, 'sfdisk', '--label gpt')
  + M.compterAppels(r.journal, 'mkfs.ext4');

// ===========================================================================
console.log('');
console.log('Passe A — confirmation absente');
{
  const { bac, texte, fstab } = preparerBac('A', { confirmation: '' });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'sfdisk', '--label gpt') === 0,
      'A : ZERO « sfdisk --label gpt »');
    verifier(M.compterAppels(r.journal, 'mkfs.ext4') === 0, 'A : ZERO mkfs');
    verifier(M.compterAppels(r.journal, 'mount') === 0, 'A : ZERO mount');
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'A : le script NOMME ce qui manque');
    verifier(/confirmation/i.test(r.sortie), 'A : la condition nommée est bien la confirmation');
    verifier(readFileSync(fstab, 'utf8') === '# faux fstab du bac a sable\n',
      'A : /etc/fstab (redirigé) est INCHANGÉ, octet pour octet');
    verifier(r.journal.length > 0, 'A : le script a bien tourné — le journal le prouve');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe B — disque monté, confirmation exacte');
{
  const { bac, texte, fstab } = preparerBac('B', { montage: '/mnt/ailleurs' });
  try {
    const r = M.executer(bac, texte);
    verifier(ecritures(r) === 0, `B : ZERO écriture malgré la confirmation (${ecritures(r)})`);
    verifier(/monte sur/.test(r.sortie) || /Disque libre/.test(r.sortie),
      'B : le script dit que le disque est monté');
    verifier(readFileSync(fstab, 'utf8') === '# faux fstab du bac a sable\n',
      'B : fstab inchangé');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe C — signature présente, confirmation exacte');
{
  const { bac, texte } = preparerBac('C', { signatures: 'offset 0x438 ext4' });
  try {
    const r = M.executer(bac, texte);
    verifier(ecritures(r) === 0, `C : ZERO écriture malgré la confirmation (${ecritures(r)})`);
    verifier(/signatures/i.test(r.sortie), 'C : le script dit qu’une signature existe');
    verifier(M.compterAppels(r.journal, 'wipefs', '-n') >= 1,
      'C : wipefs a bien été appelé en mode « -n »');
    verifier(M.compterAppels(r.journal, 'wipefs', '-a') === 0,
      'C : wipefs n’est JAMAIS appelé avec -a');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe D — la cible n’est pas un disque entier');
{
  const { bac, texte } = preparerBac('D', { type: 'part' });
  try {
    const r = M.executer(bac, texte);
    verifier(ecritures(r) === 0, `D : ZERO écriture sur une partition (${ecritures(r)})`);
    verifier(/pas un disque entier|type part/i.test(r.sortie),
      'D : le script dit que la cible n’est pas un disque');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe E — CONTRÔLE POSITIF : tout est satisfait');
{
  const { bac, texte, fstab } = preparerBac('E');
  try {
    const r = M.executer(bac, texte);
    const sf = M.compterAppels(r.journal, 'sfdisk', '--label gpt');
    const mk = M.compterAppels(r.journal, 'mkfs.ext4');
    verifier(sf === 1, `E : « sfdisk --label gpt » appelé exactement une fois (${sf})`);
    verifier(mk === 1, `E : mkfs appelé exactement une fois (${mk})`);
    verifier(M.compterAppels(r.journal, 'mount') === 1, 'E : mount appelé une fois');

    // L'ORDRE, qu'un compte exact ne dit pas.
    const iSf = r.journal.findIndex((e) => e.nom === 'sfdisk' && /--label gpt/.test(e.args));
    const iRelecture = r.journal.findIndex((e, k) => e.nom === 'sfdisk' && /--dump/.test(e.args) && k > iSf);
    const iMk = r.journal.findIndex((e) => e.nom === 'mkfs.ext4');
    const iMount = r.journal.findIndex((e) => e.nom === 'mount');
    const iVerify = r.journal.findIndex((e) => e.nom === 'findmnt' && /--verify --tab-file/.test(e.args));
    verifier(iSf !== -1 && iRelecture !== -1 && iSf < iRelecture,
      'E : la table est RELUE après avoir été écrite');
    verifier(iRelecture !== -1 && iMk !== -1 && iRelecture < iMk,
      'E : la relecture a lieu AVANT mkfs — c’est ce qui évite de formater le mauvais nœud');
    verifier(iVerify !== -1 && iMk !== -1 && iMk < iVerify,
      'E : fstab est validé après mkfs (l’UUID n’existe pas avant)');
    verifier(iVerify !== -1 && iMount !== -1 && iVerify < iMount,
      'E : la validation de fstab précède le montage');

    // mkfs ne doit JAMAIS recevoir le disque entier.
    const argsMk = r.journal.filter((e) => e.nom === 'mkfs.ext4').map((e) => e.args);
    verifier(argsMk.every((a) => a.includes(PART)),
      `E : mkfs reçoit la PARTITION (${argsMk.join(' | ')})`);
    verifier(argsMk.every((a) => !new RegExp(`${DEV}(?!1)`).test(a)),
      'E : mkfs ne reçoit JAMAIS le disque entier');

    // Ni --force ni --wipe, dans aucun appel réel.
    const argsSf = r.journal.filter((e) => e.nom === 'sfdisk').map((e) => e.args).join(' ');
    verifier(!/--force/.test(argsSf), 'E : sfdisk n’est jamais appelé avec --force');
    verifier(!/--wipe/.test(argsSf), 'E : sfdisk n’est jamais appelé avec --wipe');
    verifier(/--lock/.test(argsSf), 'E : le verrou exclusif est utilisé quand il est disponible');

    // Et fstab a bien été écrit, par UUID.
    const contenu = readFileSync(fstab, 'utf8');
    verifier(/UUID=11111111-2222-3333-4444-555555555555/.test(contenu),
      'E : la ligne ajoutée à fstab désigne l’UUID');
    verifier(!new RegExp(`^[^#]*${DEV}`, 'm').test(contenu),
      'E : la ligne n’utilise PAS /dev/… — les lettres de périphérique changent d’ordre');
    verifier(existsSync(`${fstab}.kjemo-nouveau`) === false,
      'E : le fichier intermédiaire du remplacement atomique n’est pas laissé derrière');
    const sauvegardes = r.fichiers.ajoutes.filter((f) => /fstab.*\.bak$/.test(f));
    verifier(sauvegardes.length === 1,
      `E : une sauvegarde horodatée de fstab a été laissée (${sauvegardes.length})`);

  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe F — la validation de fstab échoue');
{
  const { bac, texte, fstab } = preparerBac('F', { fstabValide: false });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'findmnt', '--verify --tab-file') >= 1,
      'F : la validation sur COPIE est bien tentée');
    verifier(readFileSync(fstab, 'utf8') === '# faux fstab du bac a sable\n',
      'F — ZERO ÉCRITURE de fstab quand la validation échoue');
    verifier(M.compterAppels(r.journal, 'mount') === 0,
      'F : rien n’est monté quand la validation échoue');
    verifier(r.code !== 0, `F : le script sort en erreur (code ${r.code})`);
    verifier(/PAS ete modifie|PAS ete touche|n a PAS/.test(r.sortie),
      'F : le script DIT que /etc/fstab n’a pas été touché');
    const sauvegardes = r.fichiers.ajoutes.filter((f) => /fstab.*\.bak$/.test(f));
    verifier(sauvegardes.length === 0,
      `F : aucune sauvegarde créée — la validation précède la sauvegarde (${sauvegardes.length})`);
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
console.log('');
console.log(`Stockage Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Exécution RÉELLE avec doublures. Aucun vrai disque partitionné, aucun vrai');
console.log('formatage, aucun /etc/fstab réel touché. Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
