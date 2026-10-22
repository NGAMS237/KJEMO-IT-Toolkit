#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC LINUX A MOUCHARDS
//
// Les assistants Linux qui MODIFIENT quelque chose sont executes pour de vrai,
// dans un bac a sable, avec les commandes modifiantes remplacees par des
// mouchards. On compte les appels, on verifie leur ORDRE, et on mesure les
// fichiers reellement ecrits.
//
// Ce que ce banc remplace : jusqu'ici, les deux assistants modifiants etaient
// eprouves en comptant les fichiers crees dans un dossier jetable. Cela montre
// qu'aucun fichier n'apparait — pas qu'aucune commande modifiante n'a ete
// appelee. Un script qui lancerait `mkfs` sur le mauvais disque n'ecrirait
// aucun fichier dans le dossier surveille.
//
// LES QUATRE PASSES
//
//   A  CONTROLE POSITIF    tout est satisfait : l'ecriture DOIT avoir lieu
//   B  CONFIRMATION        phrase absente : zero ecriture, zero `tar --create`
//   C  RELECTURE EN ECHEC  l'archive est produite mais illisible
//   D  ECRITURE EN ECHEC   `tar --create` echoue
//
// La passe A n'est pas une politesse : sans elle, « zero appel interdit » est
// vrai aussi quand le script n'a pas demarre, quand le mouchard n'a pas ete
// pose, ou quand le PATH n'a pas pris.
//
// NIVEAU DE PREUVE
//
// Execution REELLE, dans ce conteneur Linux, avec doublures. Ce n'est PAS une
// execution sur Ubuntu Server : aucun vrai `systemctl`, aucun vrai `mkfs`,
// aucun vrai disque. Et ce n'est pas une simulation de papier : les scripts
// tournent, leurs codes de sortie sont lus, et les fichiers sont comptes sur
// le disque.
// ---------------------------------------------------------------------------
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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

const outil = (id) => {
  const t = tools.find((x) => x.id === id);
  if (!t) { fail(`outil « ${id} » introuvable dans le catalogue`); process.exit(1); }
  return t;
};

/** Remplit un dossier source avec de quoi archiver. */
function semerSource(dossier, nb = 5) {
  mkdirSync(dossier, { recursive: true });
  for (let i = 1; i <= nb; i += 1) {
    writeFileSync(join(dossier, `fichier-${i}.txt`), `contenu ${i}\n`.repeat(20), 'utf8');
  }
}

// ===========================================================================
// PLAN 0 — AUTO-TEST DES MOUCHARDS
//
// Obligation 2 : un mouchard muet rendrait toutes les passes vertes. Chacun
// est donc invoque DIRECTEMENT et doit apparaitre au journal.
// ===========================================================================
console.log('');
console.log(`Plan 0 — auto-test des ${M.TOUTES_SURVEILLEES.length} mouchards`);

{
  const bac = M.creerBac('autotest');
  try {
    M.poserTousLesMouchards(bac);
    const lignes = M.TOUTES_SURVEILLEES.map((c) => `${c} --essai-mouchard`).join('\n');
    const r = M.executer(bac, `#!/usr/bin/env bash\nset -u\n${lignes}\n`);
    const j = r.journal;
    verifier(j.length === M.TOUTES_SURVEILLEES.length,
      `les ${M.TOUTES_SURVEILLEES.length} mouchards journalisent (${j.length} ligne(s))`);
    const manquants = M.TOUTES_SURVEILLEES.filter((c) => M.compterAppels(j, c) === 0);
    verifier(manquants.length === 0,
      manquants.length === 0
        ? 'aucun mouchard muet'
        : `mouchards MUETS : ${manquants.join(', ')} — tout le banc serait vert pour rien`);
    verifier(j.every((e) => e.args.includes('--essai-mouchard')),
      'chaque mouchard journalise ses arguments');
    verifier(M.ordreAppels(j).join(',') === M.TOUTES_SURVEILLEES.join(','),
      'l\'ordre du journal est l\'ordre reel des appels');

    // Le code de sortie demande doit etre rendu, sinon « echec simule » ne
    // simulerait rien.
    M.poserMouchard(bac, 'mkfs', { code: 3 });
    const r2 = M.executer(bac, '#!/usr/bin/env bash\nmkfs /dev/nexistepas\necho "code=$?"\n');
    verifier(r2.sortie.includes('code=3'), 'un mouchard rend le code de sortie demande');

    // Et le code conditionnel aux arguments, qui sert a la passe C.
    M.poserMouchard(bac, 'tar', { code: 0, selonArgs: [{ motif: '--test-label', code: 2 }] });
    const r3 = M.executer(bac, '#!/usr/bin/env bash\ntar --create x\necho "c=$?"\ntar --test-label x\necho "t=$?"\n');
    verifier(r3.sortie.includes('c=0') && r3.sortie.includes('t=2'),
      'un mouchard peut rendre un code different selon ses arguments');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// PLAN 1 — AUCUN CONTOURNEMENT DU PATH
//
// Condition de validite de tout le reste : si un script appelait
// /sbin/mkfs, le mouchard ne verrait rien et « zero appel » serait un
// mensonge.
// ===========================================================================
console.log('');
console.log('Plan 1 — aucun appel par chemin absolu');

const MODIFIANTS = tools.filter((t) => t.platform === 'Linux' && t.readOnly === false);
verifier(MODIFIANTS.length > 0, `${MODIFIANTS.length} assistant(s) Linux modifiant(s) a eprouver`);

for (const t of tools.filter((x) => x.platform === 'Linux')) {
  const defauts = Object.fromEntries(t.fields.map((f) => [f.id, String(f.default ?? '')]));
  const texte = normalizeScriptSh(t.generate(defauts));
  const suspects = M.cheminsAbsolusSuspects(texte);
  verifier(suspects.length === 0,
    suspects.length === 0
      ? `${t.id} : aucune commande surveillee appelee par chemin absolu`
      : `${t.id} : contournement du PATH — ${suspects.map((s) => `${s.commande} via ${s.trouve}`).join(', ')}`);
}

// ===========================================================================
// PLAN 2 — bash-backup-directory : les quatre passes
// ===========================================================================
console.log('');
console.log('Plan 2 — bash-backup-directory, quatre passes');

const backup = outil('bash-backup-directory');

/** Prepare un bac : source semee, destination vide, script genere. */
function preparerBackup(nom, { confirmation, mouchardTar = null }) {
  const bac = M.creerBac(nom);
  const source = join(bac.travail, 'source');
  const dest = join(bac.travail, 'destination');
  semerSource(source);
  mkdirSync(dest, { recursive: true });

  const valeurs = {
    source,
    destination: dest,
    etiquette: 'essai-mouchard',
    compression: 'aucune',
    confirmation,
  };
  const texte = normalizeScriptSh(backup.generate(valeurs));

  // Seul `tar` est double, et seulement quand la passe le demande : les
  // passes A et B doivent voir le VRAI tar, sinon le controle positif ne
  // prouverait rien.
  if (mouchardTar) M.poserMouchard(bac, 'tar', mouchardTar);

  return { bac, source, dest, texte, valeurs };
}

// --- PASSE A — CONTROLE POSITIF -------------------------------------------
{
  const { bac, dest, texte } = preparerBackup('passeA', {
    confirmation: 'SAUVEGARDER essai-mouchard',
  });
  try {
    const r = M.executer(bac, texte);
    verifier(r.code === 0, `passe A : le script sort 0 (obtenu ${r.code})`);
    verifier(r.fichiers.ajoutes.length >= 3,
      `passe A — CONTROLE POSITIF : ${r.fichiers.ajoutes.length} fichier(s) ecrit(s) `
      + `(${r.fichiers.ajoutes.map((f) => f.split('/').pop()).join(', ')})`);
    verifier(r.fichiers.ajoutes.some((f) => f.includes('destination')),
      'passe A : les fichiers sont ecrits DANS la destination');
    verifier(!r.sortie.includes('AUCUNE ECRITURE'),
      'passe A : le script n\'annonce pas « AUCUNE ECRITURE »');
    // L'archive doit etre relisible : c'est la preuve que le vrai tar a tourne.
    const archive = r.fichiers.ajoutes.find((f) => /\.tar(\.|$)/.test(f));
    verifier(archive !== undefined, 'passe A : une archive .tar a bien ete produite');
  } finally { M.detruireBac(bac); }
}

// --- PASSE B — CONFIRMATION DESARMEE --------------------------------------
{
  const { bac, texte } = preparerBackup('passeB', { confirmation: '' });
  try {
    M.poserMouchard(bac, 'tar', { code: 0 });   // tar double POUR LE COMPTER
    const r = M.executer(bac, texte);
    verifier(r.fichiers.ajoutes.length === 0,
      `passe B — ZERO ECRITURE sans confirmation (obtenu ${r.fichiers.ajoutes.length} : `
      + `${r.fichiers.ajoutes.join(', ')})`);
    verifier(M.compterAppels(r.journal, 'tar', '--create') === 0,
      `passe B : ZERO appel a « tar --create » (obtenu ${M.compterAppels(r.journal, 'tar', '--create')})`);
    verifier(r.sortie.includes('AUCUNE ECRITURE'),
      'passe B : le script NOMME la condition manquante');
    verifier(r.journal.length > 0 || r.sortie.length > 200,
      'passe B : le script a bien tourne — le journal ou la sortie le prouve');
  } finally { M.detruireBac(bac); }
}

// --- PASSE C — LA RELECTURE ECHOUE ----------------------------------------
//
// `tar --create` reussit et pose un fichier ; `tar --test-label` echoue, comme
// si l'archive etait tronquee. Une archive illisible qui RESTE dans le dossier
// de sauvegarde est le pire des resultats : elle figure dans la liste, et
// c'est elle qu'on tentera de restaurer le jour ou on en a besoin.
{
  const { bac, dest, texte } = preparerBackup('passeC', {
    confirmation: 'SAUVEGARDER essai-mouchard',
    mouchardTar: {
      code: 0,
      selonArgs: [
        { motif: '--test-label', code: 2 },
        { motif: '--list', code: 0, sortie: 'faux.txt' },
      ],
    },
  });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'tar', '--test-label') >= 1,
      'passe C : la relecture de l\'archive est bien TENTEE');
    const restants = Object.keys(r.etatApres).filter((f) => f.includes('destination'));
    verifier(restants.length === 0,
      `passe C — ZERO FICHIER laisse dans la destination quand la relecture echoue `
      + `(obtenu ${restants.length} : ${restants.join(', ')})`);
    // Le script sort AVANT d'imprimer son rapport — c'est voulu, il n'y a
    // plus de sauvegarde a rapporter. Le message part donc sur la sortie
    // d'erreur, et c'est lui qu'on exige. Ma premiere version cherchait
    // « PROBLEME », qui n'apparait que dans le rapport final : le test
    // echouait sur un script qui disait pourtant exactement ce qu'il faut.
    verifier(/RELECTURE EN ECHEC/.test(r.sortie),
      'passe C : le script DIT que la relecture a echoue, et ce qu\'il a supprime');
    verifier(/SUPPRIM/i.test(r.sortie),
      'passe C : le script NOMME ce qui a ete supprime');
    verifier(r.code !== 0,
      `passe C : le script sort en erreur (code ${r.code}) — une sauvegarde illisible n'est pas un succes`);
  } finally { M.detruireBac(bac); }
}

// --- PASSE D — L'ECRITURE ECHOUE ------------------------------------------
{
  const { bac, texte } = preparerBackup('passeD', {
    confirmation: 'SAUVEGARDER essai-mouchard',
    mouchardTar: { code: 2 },
  });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'tar', '--create') === 1,
      `passe D : « tar --create » appele exactement une fois `
      + `(obtenu ${M.compterAppels(r.journal, 'tar', '--create')})`);
    const restants = Object.keys(r.etatApres).filter((f) => f.includes('destination'));
    verifier(restants.length === 0,
      `passe D — ZERO FICHIER laisse quand l'archivage echoue (obtenu ${restants.length} : `
      + `${restants.join(', ')})`);
    verifier(/partielle|supprim/i.test(r.sortie),
      'passe D : le script DIT qu\'il a retire l\'archive partielle');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// PLAN 3 — ORDRE DES APPELS
//
// Un compte exact ne dit rien de l'ordre. Verifier l'archive AVANT de
// l'ecrire serait un compte juste et une sequence absurde.
// ===========================================================================
console.log('');
console.log('Plan 3 — ordre des appels');

{
  const { bac, texte } = preparerBackup('ordre', {
    confirmation: 'SAUVEGARDER essai-mouchard',
    mouchardTar: { code: 0, selonArgs: [{ motif: '--list', code: 0, sortie: 'f.txt' }] },
  });
  try {
    const r = M.executer(bac, texte);
    const creations = r.journal.filter((e) => e.nom === 'tar' && /--create/.test(e.args));
    const relectures = r.journal.filter((e) => e.nom === 'tar' && /--test-label/.test(e.args));
    verifier(creations.length === 1 && relectures.length === 1,
      `ordre : une creation et une relecture (${creations.length}/${relectures.length})`);
    verifier(creations.length === 1 && relectures.length === 1
      && creations[0].ordre < relectures[0].ordre,
      'ordre : l\'archive est CREEE avant d\'etre relue');
    verifier(M.compterAppels(r.journal, 'tar', '--create') === 1,
      'ordre : aucune creation en double');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// PLAN 4 — bash-csv-report : zero ecriture sans confirmation
// ===========================================================================
console.log('');
console.log('Plan 4 — bash-csv-report');

{
  const csv = outil('bash-csv-report');
  const champs = csv.fields.map((f) => f.id);
  const bac = M.creerBac('csv');
  try {
    const dest = join(bac.travail, 'rapports');
    mkdirSync(dest, { recursive: true });
    const valeurs = Object.fromEntries(csv.fields.map((f) => [f.id, String(f.default ?? '')]));
    if (champs.includes('destination')) valeurs.destination = dest;
    const texte = normalizeScriptSh(csv.generate(valeurs));
    M.poserTousLesMouchards(bac, { tar: 'reel' });
    const r = M.executer(bac, texte);
    verifier(r.journal.length > 0 || r.sortie.length > 100,
      'bash-csv-report : le script a bien tourne');
    const interdits = ['mkfs', 'sfdisk', 'mdadm', 'useradd', 'mount', 'setquota'];
    for (const c of interdits) {
      verifier(M.compterAppels(r.journal, c) === 0,
        `bash-csv-report : ZERO appel a « ${c} »`);
    }
    // `systemctl` n'est PAS interdit : cet assistant lit l'etat des services.
    // Ce sont ses VERBES MODIFIANTS qui le sont. Ma premiere version interdisait
    // la commande entiere et echouait sur un appel parfaitement legitime —
    // un test faux rend le code suspect a tort, ce qui use la confiance aussi
    // sûrement qu'un test absent.
    const lectures = M.compterAppels(r.journal, 'systemctl');
    const modifiants = M.compterAppels(r.journal, 'systemctl',
      '\\b(start|stop|restart|reload|enable|disable|mask|unmask|set-property)\\b');
    verifier(modifiants === 0,
      `bash-csv-report : ZERO verbe modifiant de systemctl (${lectures} appel(s) en lecture)`);
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// PLAN 5 — CONTRE-EPREUVE DU BANC LUI-MEME
//
// Un banc qui n'a jamais echoue ne prouve rien. On lui soumet un script
// fautif : il appelle `mkfs` sans aucune confirmation. Le banc DOIT le voir.
// ===========================================================================
console.log('');
console.log('Plan 5 — contre-epreuve du banc');

{
  const bac = M.creerBac('contre');
  try {
    M.poserTousLesMouchards(bac);
    const fautif = '#!/usr/bin/env bash\n'
      + 'set -Eeuo pipefail\n'
      + 'mkfs.ext4 /dev/nexistepas\n'
      + 'systemctl restart smbd\n'
      + 'setquota -u bob 1 2 0 0 /srv\n';
    const r = M.executer(bac, fautif);
    verifier(M.compterAppels(r.journal, 'mkfs.ext4') === 1,
      'contre-epreuve : un appel interdit a `mkfs.ext4` est VU');
    verifier(M.compterAppels(r.journal, 'systemctl') === 1,
      'contre-epreuve : un appel interdit a `systemctl` est VU');
    verifier(M.appeleAvant(r.journal, 'mkfs.ext4', 'systemctl'),
      'contre-epreuve : l\'ordre des deux appels est restitue');
    verifier(!M.appeleAvant(r.journal, 'systemctl', 'mkfs.ext4'),
      'contre-epreuve : l\'ordre inverse est bien FAUX');
    // Et un ordre portant sur une commande ABSENTE doit etre faux, pas vrai
    // par defaut : c'est le faux positif classique de ce genre de test.
    verifier(!M.appeleAvant(r.journal, 'mkfs.ext4', 'mdadm'),
      'contre-epreuve : un ordre sur une commande absente est FAUX, pas vrai par defaut');

    // Le contournement par chemin absolu doit etre detecte.
    const contournant = '#!/usr/bin/env bash\n/sbin/mkfs.ext4 /dev/x\n';
    const vus = M.cheminsAbsolusSuspects(contournant);
    // Deux entrees et non une : `mkfs` et `mkfs.ext4` sont tous deux
    // surveilles, et `/sbin/mkfs.ext4` correspond aux deux. Le detecteur
    // signale donc large, ce qui est le bon sens pour un contournement.
    verifier(vus.length >= 1 && vus.some((v) => v.commande === 'mkfs.ext4'),
      `contre-epreuve : un appel par /sbin/ est detecte comme contournement (${vus.length} signalement(s))`);
    verifier(M.cheminsAbsolusSuspects('#!/usr/bin/env bash\ncommand -p mkfs /dev/x\n').length >= 1,
      'contre-epreuve : `command -p` est detecte comme contournement');
    verifier(M.cheminsAbsolusSuspects('#!/usr/bin/env bash\nmkfs.ext4 /dev/x\n').length === 0,
      'contre-epreuve : un appel normal n\'est PAS pris pour un contournement');

    // Un journal vide ne doit jamais etre confondu avec « aucun appel
    // interdit » : c'est le signe d'un PATH qui n'a pas pris.
    const bac2 = M.creerBac('vide');
    try {
      const r2 = M.executer(bac2, '#!/usr/bin/env bash\nexit 0\n');
      verifier(r2.journal.length === 0,
        'contre-epreuve : un script qui ne fait rien produit un journal VIDE — ce banc exige donc une preuve d\'execution dans chaque passe');
    } finally { M.detruireBac(bac2); }
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// PLAN 6 — CE QUI N'EST PAS ENCORE SURVEILLE, ET LE DIT
// ===========================================================================
console.log('');
console.log('Plan 6 — portee declaree');

verifier(M.APPLETS_WINDOWS_A_SURVEILLER.length > 0,
  `${M.APPLETS_WINDOWS_A_SURVEILLER.length} applet(s) PowerShell declaree(s) pour la jonction de domaine `
  + '— AUCUN mouchard PowerShell n\'est pose ici : leur banc est celui des mouchards Windows, au commit 24/n');

const jamaisAppelees = M.TOUTES_SURVEILLEES.filter((c) => c !== 'tar');
console.log(`         ${jamaisAppelees.length} commande(s) surveillee(s) d'avance : aucun assistant`);
console.log('         ne les appelle encore. Les mouchards existent et sont auto-testes ;');
console.log('         les assistants qui les utiliseront arrivent aux commits 12/n a 24/n.');

// ===========================================================================
console.log('');
console.log(`Mouchards Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Execution REELLE dans ce conteneur, avec doublures. Aucun vrai systemctl,');
console.log('aucun vrai mkfs, aucun vrai disque. Ubuntu Server reel : NON EXECUTE.');
process.exit(echecs.length === 0 ? 0 : 1);
