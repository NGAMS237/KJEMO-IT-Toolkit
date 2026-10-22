#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DES PERMISSIONS, DES ACL ET DES COMPTES
//
// Les quatre assistants du commit 16/n sont EXÉCUTÉS, dans un bac à sable, sur
// une VRAIE arborescence jetable, avec les commandes modifiantes remplacées par
// des doublures qui journalisent leur nom, leurs arguments et leur ordre.
//
// DEUX SORTES DE DOUBLURES, ET LA DIFFÉRENCE COMPTE
//
//   chmod, chown  doublés PUIS délégués à la vraie commande. On enregistre
//                 l'appel ET l'effet a lieu : c'est ce qui permet à la
//                 relecture par `stat` de dire la vérité, et donc de prouver
//                 qu'elle n'est pas décorative.
//   setfacl,      doublés sans effet. Ce qu'on mesure alors, c'est l'ABSENCE
//   useradd       d'appel quand un verrou doit tenir — et, pour la passe
//                 positive, les arguments exacts reçus.
//
// LES SCÉNARIOS
//
//   A  confirmation absente              → 0 chmod, 0 chown, 0 setfacl, 0 useradd
//   B  mode 777 et setuid                → refusés par le formulaire
//   C  récursion sur une racine système   → 0 chmod, 0 chown
//   D  binaire setuid dans l'arborescence → 0 chmod
//   E  propriétaire inconnu, puis UID 0   → 0 chown
//   F  relevé de restauration impossible  → 0 chmod, 0 chown
//   G  CONTRÔLE POSITIF (permissions)     → chown AVANT chmod, deux modes
//                                           distincts, relecture conforme
//   H  ACL : masque, support, défaut      → #effective lu, refus argumentés
//   I  CONTRÔLE POSITIF (ACL)             → --modify, accès puis défaut
//   J  comptes : existant, groupe inconnu, groupe privilégié, shell absent
//   K  CONTRÔLE POSITIF (compte)          → les options attendues, et AUCUN
//                                           mot de passe nulle part
//
// POURQUOI CE BANC EXIGE ROOT
//
// Trois des quatre assistants exigent root et sortent sinon : sans root, les
// contrôles positifs ne prouveraient rien. Le banc crée aussi des fichiers
// appartenant à d'autres comptes et un binaire setuid, ce qui demande root.
// Il ÉCHOUE au lieu de s'ignorer.
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur.
// Aucun /etc/passwd réel touché, aucun compte réellement créé, aucune ACL
// réellement posée. Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(ROOT, 'dist/noyau-bash.mjs')).href);
const M = await import(pathToFileURL(resolve(ROOT, 'test/mouchards-linux.mjs')).href);
const CAP = await import(pathToFileURL(resolve(ROOT, 'test/capacites-linux.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

if (process.getuid() !== 0) {
  console.error('');
  console.error('ECHEC : ce banc doit tourner en root.');
  console.error('');
  console.error('  - trois des quatre assistants exigent root et sortent sinon :');
  console.error('    sans root, les controles positifs ne prouveraient rien ;');
  console.error('  - le banc cree des fichiers appartenant a d autres comptes et');
  console.error('    un binaire setuid, ce qu un compte ordinaire ne peut pas faire.');
  console.error('');
  console.error('  sudo -E env "PATH=$PATH" node test/permissions-linux.test.mjs');
  console.error('');
  process.exit(1);
}

const outil = (id) => {
  const t = tools.find((x) => x.id === id);
  if (!t) { console.error(`ECHEC : outil « ${id} » absent du catalogue`); process.exit(1); }
  return t;
};
const audit = outil('linux-permission-audit');
const change = outil('linux-permission-change');
const acl = outil('linux-permission-acl');
const creer = outil('linux-user-create');

// Un compte et un groupe qui existent REELLEMENT sur cette machine : le banc
// s'en sert pour que chown soit un vrai chown, et que la relecture par stat ait
// un sens.
//
// Ils sont DECOUVERTS, et non ecrits en dur. « nobody » serait tentant, mais
// le validateur de l'assistant le refuse — a juste titre : c'est un compte
// systeme. Et un nom choisi au hasard n'existerait pas sur le runner du CI.
// Le banc prend donc le premier compte ordinaire (UID >= 1000, hors plage des
// comptes de service) dont le nom passe le validateur de l'assistant, et il
// ECHOUE s'il n'en trouve aucun plutot que de se declarer ignore.
const { validateNomUtilisateur, validateNomGroupe } =
  await import(pathToFileURL(resolve(ROOT, 'dist/validateurs-linux.mjs')).href);

function premierCompteOrdinaire() {
  const lignes = execFileSync('getent', ['passwd'], { encoding: 'utf8' }).split('\n');
  for (const l of lignes) {
    const [nom, , uid, gid] = l.split(':');
    const u = Number(uid);
    if (!nom || !Number.isFinite(u) || u < 1000 || u >= 30000) continue;
    if (!validateNomUtilisateur(nom).ok) continue;
    let groupe = '';
    try {
      groupe = execFileSync('getent', ['group', String(gid)], { encoding: 'utf8' }).split(':')[0];
    } catch { continue; }
    if (!groupe || !validateNomGroupe(groupe).ok) continue;
    return { compte: nom, groupe };
  }
  return null;
}

const trouve = premierCompteOrdinaire();
if (!trouve) {
  console.error('');
  console.error('ECHEC : aucun compte ordinaire (UID >= 1000) utilisable sur cette machine.');
  console.error('Le controle positif de chown a besoin d un compte REEL : sans lui, il ne');
  console.error('prouverait rien, et un banc qui ne prouve rien ne doit pas etre vert.');
  console.error('');
  process.exit(1);
}
const COMPTE = trouve.compte;
const GROUPE = trouve.groupe;

// ---------------------------------------------------------------------------
// LOT 7 (25/n) — LA CAPACITÉ DE chown EST MESURÉE AVANT TOUT, PAR UNE SONDE
// INDÉPENDANTE DE L'ASSISTANT. Voir test/capacites-linux.mjs.
//
// Dans un conteneur dont l'espace de noms utilisateur ne projette pas ce
// compte, « chown » échoue avec « Invalid argument ». Ce n'est pas une
// régression de l'assistant : c'est une limite du conteneur. Le banc l'annonce
// alors NON EXÉCUTÉ (code 77, jamais 0), avec la raison exacte.
//
// Si la sonde RÉUSSIT, le banc s'exécute, et chaque anomalie est un ÉCHEC : un
// chown qui échouerait ensuite serait une régression, pas une limite.
// ---------------------------------------------------------------------------
{
  const uidCompte = Number(execFileSync('id', ['-u', COMPTE], { encoding: 'utf8' }).trim());
  const sonde = CAP.sonderChown({ compte: COMPTE, groupe: GROUPE, uidAttendu: uidCompte });
  const decision = CAP.decider(sonde);
  if (decision.verdict === 'NON_EXECUTE') {
    console.error('');
    console.error('Permissions Linux : NON EXÉCUTÉ.');
    console.error(`  Raison : ${decision.raison}`);
    console.error('  Ce conteneur interdit reellement chown vers un autre UID : le controle positif');
    console.error('  de linux-permission-change ne peut pas etre joue ici, et ce n est pas un resultat.');
    console.error('  Code de sortie 77 (ni succes, ni echec). Un environnement qui possede la capacite');
    console.error('  doit l EXIGER avec KJEMO_CAPACITES_REQUISES=1 : l absence devient alors un ECHEC.');
    process.exit(CAP.CODE_NON_EXECUTE);
  }
  if (decision.verdict === 'ECHEC') {
    console.error('');
    console.error(`ECHEC : ${decision.raison}`);
    process.exit(1);
  }
  console.log(`Capacite de chown : ${decision.raison}.`);
}
console.log(`Compte d essai decouvert : ${COMPTE}:${GROUPE} (chown agira reellement, sur le bac seulement).`);
// /srv doit exister pour que la passe C refuse pour la BONNE raison — racine
// interdite — et non parce que la cible n'existe pas.
mkdirSync('/srv', { recursive: true });

/**
 * Cite une chaine pour le shell en PRESERVANT ses retours a la ligne.
 *
 * JSON.stringify ne convient pas : « \n » entre guillemets doubles n'est pas
 * interprete par bash, et la sortie simulee de getfacl deviendrait une ligne
 * unique — ce qui ferait passer la detection du masque pour une bonne raison.
 * La meme lecon que le banc du RAID, ou le defaut avait ete vu a la passe F.
 */
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

// Le chown que les doublures DELEGUENT. Par defaut le vrai. KJEMO_BANC_CHOWN
// existe pour la contre-epreuve de test/capacites-linux.test.mjs : elle y met un
// chown qui echoue pour prouver qu un echec APRES une sonde reussie est une
// regression (code 1), et jamais un NON EXECUTE.
const BIN_CHOWN = process.env.KJEMO_BANC_CHOWN || '/bin/chown';

/** Une arborescence jetable : deux dossiers, trois fichiers. */
function arborescence(bac, { avecSetuid = false } = {}) {
  const cible = join(bac.travail, 'equipe');
  mkdirSync(join(cible, 'sous-dossier'), { recursive: true });
  writeFileSync(join(cible, 'document.txt'), 'contenu\n', 'utf8');
  writeFileSync(join(cible, 'sous-dossier', 'note.md'), '# note\n', 'utf8');
  const script = join(cible, 'outil.sh');
  writeFileSync(script, '#!/bin/sh\nexit 0\n', 'utf8');
  execFileSync('chmod', ['0644', script]);
  if (avecSetuid) {
    const suid = join(cible, 'binaire-suid');
    writeFileSync(suid, '#!/bin/sh\nexit 0\n', 'utf8');
    execFileSync('chmod', ['4755', suid]);
  }
  return cible;
}

/**
 * Pose les doublures communes : chmod et chown enregistrent PUIS agissent.
 *
 * `getent` est double de la meme facon, et pour une raison precise : c'est la
 * PREUVE D'EXECUTION de chaque passe. Sans elle, une passe ou tous les verrous
 * tiennent presente un journal VIDE — ce qui ressemble exactement a une passe
 * ou le script n'aurait pas demarre, ou ou les doublures n'auraient pas ete
 * posees. Un banc doit savoir distinguer les deux.
 */
function doubluresReelles(bac) {
  M.poserMouchard(bac, 'chmod', { avant: ['exec /bin/chmod "$@"'] });
  M.poserMouchard(bac, 'chown', { avant: [`exec ${BIN_CHOWN} "$@"`] });
  M.poserMouchard(bac, 'chgrp', { avant: ['exec /bin/chgrp "$@"'] });
  M.poserMouchard(bac, 'getent', { avant: ['exec /usr/bin/getent "$@"'] });
}

// ===========================================================================
// linux-permission-change
// ===========================================================================
function bacChange(nom, {
  proprietaire = COMPTE,
  groupe = GROUPE,
  mode = '2770',
  recursif = 'Non',
  confirmation = null,
  avecSetuid = false,
  statCasse = false,
  cibleTrafiquee = null,
  proprioTrafique = null,
} = {}) {
  const bac = M.creerBac(nom);
  const cible = arborescence(bac, { avecSetuid });
  doubluresReelles(bac);
  M.poserMouchard(bac, 'setfacl', {});
  if (statCasse) M.poserMouchard(bac, 'stat', { code: 1 });

  const valeurs = {
    chemin: '/srv/essai',
    proprietaire,
    groupe,
    mode,
    recursif,
    confirmation: confirmation === null ? '/srv/essai' : confirmation,
    format: 'Console',
  };
  let texte = normalizeScriptSh(change.generate(valeurs));
  const avant = texte;
  texte = texte.replace("KJEMO_CIBLE='/srv/essai'", `KJEMO_CIBLE='${cibleTrafiquee ?? cible}'`);
  if (texte === avant) fail('la redirection de la cible vers le bac a echoue : le banc toucherait au vrai systeme');
  // La confirmation porte sur le chemin du FORMULAIRE : elle reste valable
  // apres redirection, puisque le script compare la saisie a une constante.
  if (proprioTrafique !== null) {
    texte = texte.replace(`KJEMO_PROPRIO='${proprietaire}'`, `KJEMO_PROPRIO='${proprioTrafique}'`);
  }
  return { bac, texte, cible };
}

const envBac = (bac) => ({ HOME: bac.travail });

console.log('');
console.log('Plan 0 — aucun contournement du PATH');
for (const [id, t] of [['linux-permission-audit', audit], ['linux-permission-change', change],
  ['linux-permission-acl', acl], ['linux-user-create', creer]]) {
  const texte = normalizeScriptSh(t.generate(Object.fromEntries(
    t.fields.map((f) => [f.id, f.default ?? '']),
  )));
  const suspects = M.cheminsAbsolusSuspects(texte);
  verifier(suspects.length === 0,
    `${id} : aucun chemin absolu ni « command -p » sur une commande surveillee (${suspects.map((s) => s.trouve).join(', ') || 'aucun'})`);
}

console.log('');
console.log('Passe A — la confirmation manque');
{
  const { bac, texte, cible } = bacChange('A', { confirmation: '' });
  try {
    const avant = execFileSync('stat', ['-c', '%a %U %G', cible], { encoding: 'utf8' }).trim();
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(M.compterAppels(r.journal, 'chmod') === 0,
      `A — ZERO chmod sans confirmation (${M.compterAppels(r.journal, 'chmod')})`);
    verifier(M.compterAppels(r.journal, 'chown') === 0,
      `A — ZERO chown sans confirmation (${M.compterAppels(r.journal, 'chown')})`);
    const apres = execFileSync('stat', ['-c', '%a %U %G', cible], { encoding: 'utf8' }).trim();
    verifier(avant === apres, `A : la cible est inchangee (${avant} -> ${apres})`);
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'A : le script le DIT');
    verifier(/confirmation/i.test(r.sortie), 'A : la condition manquante est NOMMEE');
    verifier(M.compterAppels(r.journal, 'getent') >= 1,
      `A : preuve d execution — les doublures sont en place et le script les a appelees (${r.journal.length} appel(s))`);
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe B — le formulaire refuse 777, 666 et le setuid');
{
  const base = {
    chemin: '/srv/essai', proprietaire: COMPTE, groupe: GROUPE, mode: '2770',
    recursif: 'Non', confirmation: '/srv/essai', format: 'Console',
  };
  // 1777 est dans la liste des REFUS, et c'est une decision : le sticky bit
  // empeche de supprimer le fichier d'autrui, pas d'en ecrire un nouveau. Il
  // rend /tmp vivable ; il ne rend pas 777 acceptable sur un dossier de
  // travail. Le message du refus le dit explicitement.
  for (const [mode, nom] of [['777', '777'], ['0777', '0777'], ['666', '666'],
    ['1777', 'sticky 1777'], ['4755', 'setuid 4755'], ['6770', 'setuid+setgid 6770']]) {
    const err = change.validate({ ...base, mode });
    verifier(Boolean(err.mode), `B : le mode ${nom} est refuse${err.mode ? '' : ' — IL NE L EST PAS'}`);
  }
  // Et le controle positif du formulaire : les modes legitimes passent.
  for (const mode of ['2770', '750', '700', '1770', '770', '640']) {
    const err = change.validate({ ...base, mode });
    verifier(!err.mode, `B : le mode ${mode} est accepte${err.mode ? ' — IL EST REFUSE : ' + err.mode : ''}`);
  }
  // La recursion sur une racine systeme est refusee par le formulaire.
  for (const chemin of ['/', '/etc', '/usr', '/var', '/home', '/srv']) {
    const err = change.validate({ ...base, chemin, recursif: 'Oui', confirmation: chemin });
    verifier(Boolean(err.chemin), `B : la recursion sur ${chemin} est refusee`);
  }
  verifier(!change.validate({ ...base, chemin: '/srv/donnees/equipe', recursif: 'Oui', confirmation: '/srv/donnees/equipe' }).chemin,
    'B : la recursion sur un sous-dossier precis est acceptee');
  verifier(/sticky bit/.test(change.validate({ ...base, mode: '1777' }).mode ?? ''),
    'B : le refus de 1777 EXPLIQUE ce que le sticky bit fait et ne fait pas');
  // Et rien a faire du tout est refuse, plutot que de produire un script creux.
  verifier(Boolean(change.validate({ ...base, proprietaire: '', groupe: '', mode: '' }).mode),
    'B : aucun changement demande -> refuse');
}

console.log('');
console.log('Passe C — recursion sur une racine systeme, revue DANS le script');
{
  const { bac, texte } = bacChange('C', { recursif: 'Oui', cibleTrafiquee: '/srv' });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(M.compterAppels(r.journal, 'chmod') === 0, 'C — ZERO chmod sur /srv en recursif');
    verifier(M.compterAppels(r.journal, 'chown') === 0, 'C — ZERO chown sur /srv en recursif');
    verifier(/racine interdite/.test(r.sortie),
      'C : le script NOMME la racine refusee dans son commentaire, pas seulement dans la valeur');
    verifier(/sudo|machine inutilisable/.test(r.sortie),
      'C : il explique ce que l operation rendrait impossible');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe D — un binaire setuid dans l arborescence');
{
  const { bac, texte } = bacChange('D', { recursif: 'Oui', avecSetuid: true });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(M.compterAppels(r.journal, 'chmod') === 0,
      `D — ZERO chmod quand l arborescence porte un binaire setuid (${M.compterAppels(r.journal, 'chmod')})`);
    verifier(/setuid/.test(r.sortie), 'D : le script nomme le bit en cause');
    verifier(/silencieusement|perdrait/.test(r.sortie),
      'D : il dit POURQUOI — le bit serait perdu sans message');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe E — proprietaire inconnu, puis proprietaire d UID 0');
{
  const { bac, texte } = bacChange('E1', { proprietaire: 'kjemoinexistant' });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(M.compterAppels(r.journal, 'chown') === 0,
      'E1 — ZERO chown vers un compte inconnu');
    verifier(M.compterAppels(r.journal, 'chmod') === 0,
      'E1 : et ZERO chmod — la porte finale est unique, pas etape par etape');
    verifier(/inconnu/.test(r.sortie), 'E1 : le script le dit');
  } finally { M.detruireBac(bac); }

  // « root » est refuse par le formulaire : on eprouve donc la garde qui vit
  // DANS le script, en retouchant la variable.
  const err = change.validate({
    chemin: '/srv/essai', proprietaire: 'root', groupe: GROUPE, mode: '2770',
    recursif: 'Non', confirmation: '/srv/essai', format: 'Console',
  });
  verifier(Boolean(err.proprietaire), 'E2 : le formulaire refuse deja « root » comme proprietaire');

  const { bac: b2, texte: t2 } = bacChange('E2', { proprioTrafique: 'root' });
  try {
    const r = M.executer(b2, t2, { env: envBac(b2) });
    verifier(M.compterAppels(r.journal, 'chown') === 0,
      'E2 — ZERO chown vers un compte d UID 0, meme en retouchant le script');
    verifier(/UID 0/.test(r.sortie), 'E2 : le script nomme l UID 0');
  } finally { M.detruireBac(b2); }
}

console.log('');
console.log('Passe F — le releve de restauration ne peut pas etre ecrit');
{
  const { bac, texte, cible } = bacChange('F', { statCasse: true });
  try {
    const avant = execFileSync('stat', ['-c', '%a %U %G', cible], { encoding: 'utf8' }).trim();
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(M.compterAppels(r.journal, 'chmod') === 0, 'F — ZERO chmod sans releve');
    verifier(M.compterAppels(r.journal, 'chown') === 0, 'F — ZERO chown sans releve');
    const apres = execFileSync('stat', ['-c', '%a %U %G', cible], { encoding: 'utf8' }).trim();
    verifier(avant === apres, 'F : la cible est inchangee');
    verifier(r.code !== 0, `F : sortie en erreur (code ${r.code})`);
    verifier(/Aucune permission n a ete modifiee/.test(r.sortie),
      'F : le script DIT sur stderr qu aucune permission n a change');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe G — CONTROLE POSITIF : chown AVANT chmod, deux modes distincts');
{
  const { bac, texte, cible } = bacChange('G', { recursif: 'Oui' });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `G : le script sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'chown') === 1,
      `G : chown appele une fois (${M.compterAppels(r.journal, 'chown')})`);
    verifier(M.compterAppels(r.journal, 'chmod') === 2,
      `G : chmod appele DEUX fois — dossiers puis fichiers (${M.compterAppels(r.journal, 'chmod')})`);
    verifier(M.appeleAvant(r.journal, 'chown', 'chmod'),
      'G — chown AVANT chmod : chown retire les bits setuid et setgid, et deferait le mode');

    const argsChown = r.journal.find((e) => e.nom === 'chown')?.args ?? '';
    verifier(/--no-dereference/.test(argsChown),
      `G : chown recoit --no-dereference (${argsChown})`);
    verifier(/--recursive/.test(argsChown), 'G : et --recursive, puisque la recursion est demandee');
    verifier(argsChown.includes(`${COMPTE}:${GROUPE}`),
      `G : la cible de chown est « compte:groupe » (${argsChown})`);

    const modes = r.journal.filter((e) => e.nom === 'chmod').map((e) => e.args);
    verifier(modes.some((a) => / 2770 | 2770$/.test(` ${a} `)),
      `G : les DOSSIERS recoivent 2770 (${modes.join(' | ')})`);
    verifier(modes.some((a) => / 660 | 660$/.test(` ${a} `)),
      `G — les FICHIERS recoivent 660 : le mode derive, sans setgid ni bit d execution (${modes.join(' | ')})`);
    verifier(!modes.some((a) => /-R\b|--recursive/.test(a)),
      'G : aucun chmod -R — c est find qui parcourt, avec deux modes distincts');

    // L effet REEL, puisque les doublures deleguent aux vraies commandes.
    const modeDossier = execFileSync('stat', ['-c', '%a', cible], { encoding: 'utf8' }).trim();
    const modeFichier = execFileSync('stat', ['-c', '%a', join(cible, 'document.txt')], { encoding: 'utf8' }).trim();
    const proprio = execFileSync('stat', ['-c', '%U:%G', cible], { encoding: 'utf8' }).trim();
    verifier(modeDossier === '2770', `G : le dossier est reellement en 2770 (${modeDossier})`);
    verifier(modeFichier === '660', `G : le fichier est reellement en 660 (${modeFichier})`);
    verifier(proprio === `${COMPTE}:${GROUPE}`, `G : le proprietaire est reellement change (${proprio})`);
    const sousDossier = execFileSync('stat', ['-c', '%a', join(cible, 'sous-dossier')], { encoding: 'utf8' }).trim();
    verifier(sousDossier === '2770', `G : le sous-dossier aussi (${sousDossier})`);
    const noteMd = execFileSync('stat', ['-c', '%a', join(cible, 'sous-dossier', 'note.md')], { encoding: 'utf8' }).trim();
    verifier(noteMd === '660', `G : et le fichier du sous-dossier (${noteMd})`);

    // « Conformite OK » est un etat OK, et le rapport Console n'imprime que
    // ATTENTION, PROBLEME et IGNORE : son ABSENCE de reproche est la preuve.
    verifier(!/Relecture \/ Mode/.test(r.sortie) && !/Relecture \/ Proprietaire/.test(r.sortie)
      && !/Relecture \/ Groupe/.test(r.sortie),
      `G : la relecture ne signale aucun ecart (${r.sortie.split('\n').filter((l) => /Relecture/.test(l)).join(' | ') || 'aucune ligne Relecture'})`);
    verifier(!/ecart\(s\)/.test(r.sortie), 'G : et aucun ecart annonce sur stderr');
    const releves = r.fichiers.ajoutes.filter((f) => /kjemo-permissions-.*\.restore$/.test(f));
    verifier(releves.length === 1, `G : un releve de restauration a ete laisse (${releves.length})`);
    const contenu = readFileSync(join(bac.travail, releves[0]), 'utf8');
    verifier(contenu.split('\n').filter((l) => l.trim() !== '').length >= 5,
      'G : le releve porte une ligne par entree touchee');
    verifier(contenu.includes('\t'), 'G : les champs du releve sont separes par des tabulations');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// linux-permission-acl
// ===========================================================================
function bacAcl(nom, {
  typeEntree = 'Utilisateur',
  nomEntree = COMPTE,
  droits = 'rwx',
  appliquerDefaut = 'Oui',
  recursif = 'Non',
  confirmation = null,
  aclApres = null,
  options = 'rw,relatime',
  surFichier = false,
  homeCasse = false,
} = {}) {
  const bac = M.creerBac(nom);
  const dossier = arborescence(bac);
  const cible = surFichier ? join(dossier, 'document.txt') : dossier;
  const aclBase = [
    `# file: ${cible.replace(/^\//, '')}`,
    '# owner: root',
    '# group: root',
    'user::rwx',
    'group::r-x',
    'other::---',
  ].join('\n');
  const sortieApres = aclApres ?? [aclBase, `user:${COMPTE}:rwx`, 'mask::rwx'].join('\n');

  const marqueur = join(bac.racine, 'pose');
  M.poserMouchard(bac, 'setfacl', { avant: [`: > '${marqueur}'`] });
  M.poserMouchard(bac, 'getfacl', {
    code: 0,
    avant: [
      `if [ -f '${marqueur}' ]; then printf '%s\\n' ${sq(sortieApres)}; exit 0; fi`,
      `printf '%s\\n' ${sq(aclBase)}`,
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'findmnt', { code: 0, sortie: `/ ext4 ${options}` });
  doubluresReelles(bac);

  const valeurs = {
    chemin: '/srv/essai',
    typeEntree,
    nomEntree,
    droits,
    appliquerDefaut,
    recursif,
    confirmation: confirmation === null ? '/srv/essai' : confirmation,
    format: 'Console',
  };
  let texte = normalizeScriptSh(acl.generate(valeurs));
  const avant = texte;
  texte = texte.replace("KJEMO_CIBLE='/srv/essai'", `KJEMO_CIBLE='${cible}'`);
  if (texte === avant) fail('la redirection de la cible ACL vers le bac a echoue');
  return { bac, texte, cible, homeCasse };
}

console.log('');
console.log('Passe H — ACL : support, beneficiaire, ACL par defaut, releve');
{
  // H1 — systeme de fichiers monte avec noacl.
  const { bac, texte } = bacAcl('H1', { options: 'rw,relatime,noacl' });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(M.compterAppels(r.journal, 'setfacl') === 0,
      'H1 — monte avec noacl -> ZERO setfacl');
    verifier(/option noacl/.test(r.sortie),
      'H1 : le script NOMME l option de montage dans son commentaire, et pas seulement dans la valeur');
  } finally { M.detruireBac(bac); }

  // H2 — beneficiaire inconnu.
  const { bac: b2, texte: t2 } = bacAcl('H2', { nomEntree: 'kjemoinexistant' });
  try {
    const r = M.executer(b2, t2, { env: envBac(b2) });
    verifier(M.compterAppels(r.journal, 'setfacl') === 0,
      'H2 — beneficiaire inconnu -> ZERO setfacl');
    verifier(/inconnu/.test(r.sortie), 'H2 : le script le dit');
  } finally { M.detruireBac(b2); }

  // H3 — ACL par defaut demandee sur un FICHIER.
  const { bac: b3, texte: t3 } = bacAcl('H3', { surFichier: true, appliquerDefaut: 'Oui' });
  try {
    const r = M.executer(b3, t3, { env: envBac(b3) });
    verifier(M.compterAppels(r.journal, 'setfacl') === 0,
      'H3 — ACL par defaut sur un fichier -> ZERO setfacl');
    verifier(/ne se pose que sur un dossier/.test(r.sortie), 'H3 : le script dit pourquoi');
  } finally { M.detruireBac(b3); }

  // H4 — le releve ne peut pas etre ecrit : HOME pointe ailleurs.
  const { bac: b4, texte: t4 } = bacAcl('H4');
  try {
    const r = M.executer(b4, t4, { env: { HOME: '/proc/kjemo-inexistant' } });
    verifier(M.compterAppels(r.journal, 'setfacl') === 0,
      'H4 — releve impossible -> ZERO setfacl');
    verifier(/Aucune ACL n a ete posee/.test(r.sortie),
      'H4 : le script DIT sur stderr qu aucune ACL n a ete posee');
  } finally { M.detruireBac(b4); }

  // H5 — le masque rabote l entree : la relecture le DIT.
  const aclRabotee = [
    '# file: essai',
    'user::rwx',
    `user:${COMPTE}:rwx\t\t\t#effective:r-x`,
    'group::r-x',
    'mask::r-x',
    'other::---',
  ].join('\n');
  const { bac: b5, texte: t5 } = bacAcl('H5', { aclApres: aclRabotee });
  try {
    const r = M.executer(b5, t5, { env: envBac(b5) });
    verifier(M.compterAppels(r.journal, 'setfacl') >= 1, 'H5 : setfacl a bien ete appele');
    verifier(/#effective:/.test(r.sortie), 'H5 : la ligne #effective: apparait dans le rapport');
    verifier(/masque rabote/.test(r.sortie) || /Le masque rabote/.test(r.sortie),
      'H5 — le script SIGNALE que le masque rabote les droits');
    verifier(/Droits demandes rwx, droits effectifs r-x/.test(r.sortie),
      'H5 — il nomme l ecart exact entre les droits demandes et les droits effectifs');
    verifier(/setfacl -m m::rwx/.test(r.sortie),
      'H5 : et il donne la commande qui releve le masque');
  } finally { M.detruireBac(b5); }

  // H6 — confirmation absente.
  const { bac: b6, texte: t6 } = bacAcl('H6', { confirmation: '' });
  try {
    const r = M.executer(b6, t6, { env: envBac(b6) });
    verifier(M.compterAppels(r.journal, 'setfacl') === 0,
      'H6 — confirmation absente -> ZERO setfacl');
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'H6 : le script le DIT');
  } finally { M.detruireBac(b6); }
}

console.log('');
console.log('Passe I — CONTROLE POSITIF : l entree d acces, puis l ACL par defaut');
{
  const { bac, texte } = bacAcl('I');
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `I : le script sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'setfacl') === 2,
      `I : setfacl appele DEUX fois — acces puis defaut (${M.compterAppels(r.journal, 'setfacl')})`);
    const appels = r.journal.filter((e) => e.nom === 'setfacl').map((e) => e.args);
    verifier(appels.every((a) => /--modify/.test(a)),
      `I : les deux appels passent par --modify (${appels.join(' | ')})`);
    verifier(appels.every((a) => a.includes(`u:${COMPTE}:rwx`)),
      'I : l entree transmise est bien « u:<compte>:rwx »');
    verifier(!appels[0].includes('--default') && appels[1].includes('--default'),
      `I — l entree d ACCES est posee avant l ACL par DEFAUT (${appels.join(' | ')})`);
    verifier(!appels.some((a) => /(^| )-b\b|--remove-all|( |^)-x\b|--remove\b/.test(a)),
      'I — ni -b ni -x : cet assistant AJOUTE, il n efface pas');
    verifier(appels.every((a) => / -- /.test(a) || /\s--\s/.test(a)),
      `I : chaque appel separe les options de la cible par « -- » (${appels.join(' | ')})`);

    verifier(M.appeleAvant(r.journal, 'getfacl', 'setfacl'),
      'I : le releve getfacl precede la premiere ecriture');
    const iDernier = r.journal.map((e) => e.nom).lastIndexOf('setfacl');
    verifier(r.journal.slice(iDernier).some((e) => e.nom === 'getfacl'),
      'I : et une relecture getfacl suit la derniere ecriture');
    verifier(!/#effective:/.test(r.sortie) && !/masque rabote/.test(r.sortie),
      'I : la relecture ne signale aucun droit rabote');
    verifier(!/introuvable telle quelle/.test(r.sortie),
      'I — l entree posee est RETROUVEE dans la relecture : getfacl ecrit « user: », setfacl accepte « u: »');
    const releves = r.fichiers.ajoutes.filter((f) => /kjemo-acl-.*\.acl$/.test(f));
    verifier(releves.length === 1, `I : un releve d origine a ete laisse (${releves.length})`);
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// linux-user-create
// ===========================================================================
function bacCompte(nom, {
  nomUtilisateur = 'kjemoessai',
  commentaire = 'Compte d essai',
  groupePrincipal = '',
  groupesSecondaires = '',
  shell = '/bin/bash',
  creerHome = 'Oui',
  confirmation = null,
  dejaPresent = false,
  groupeInconnu = false,
  shellTrafique = null,
} = {}) {
  const bac = M.creerBac(nom);
  const marqueur = join(bac.racine, 'cree');
  const ligne = `${nomUtilisateur}:x:1234:1234:${commentaire}:/home/${nomUtilisateur}:${shell}`;

  M.poserMouchard(bac, 'useradd', { avant: [`: > '${marqueur}'`] });
  // getent repond selon la base interrogee ET selon l etat : le compte est
  // absent avant useradd, present apres. Un mouchard sans memoire ne pourrait
  // pas representer les deux, et la relecture echouerait pour rien.
  M.poserMouchard(bac, 'getent', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '^passwd'; then",
      ...(dejaPresent
        ? [`  printf '%s\\n' '${ligne}'`, '  exit 0']
        : [`  if [ -f '${marqueur}' ]; then printf '%s\\n' '${ligne}'; exit 0; fi`,
          '  exit 2']),
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- '^group'; then",
      ...(groupeInconnu ? ['  exit 2'] : ["  printf '%s\\n' 'legroupe:x:2000:'", '  exit 0']),
      'fi',
      'exit 0',
    ],
  });
  // La doublure de `id` DELEGUE tout ce qui n'est pas le sujet. « id -u » sert
  // au controle de root, en tete du script : une doublure qui y repond
  // « uid=1234(...) » fait sortir le script avant toute action, et les sept
  // passes suivantes paraissent vertes pour cette seule raison. Meme piege que
  // la doublure de `cat` du banc RAID, qui doit deleguer tout sauf
  // /proc/mdstat.
  M.poserMouchard(bac, 'id', {
    code: 0,
    avant: [
      'case "$1" in',
      '  -*) exec /usr/bin/id "$@" ;;',
      'esac',
      `printf '%s\\n' 'uid=1234(${nomUtilisateur}) gid=1234(${nomUtilisateur}) groupes=1234(${nomUtilisateur}),2000(legroupe)'`,
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'passwd', { code: 0, sortie: `${nomUtilisateur} L 01/01/2026 0 99999 7 -1` });
  M.poserMouchard(bac, 'chmod', { avant: ['exec /bin/chmod "$@"'] });
  M.poserMouchard(bac, 'chown', { avant: [`exec ${BIN_CHOWN} "$@"`] });

  const valeurs = {
    nomUtilisateur,
    commentaire,
    groupePrincipal,
    groupesSecondaires,
    shell,
    creerHome,
    confirmation: confirmation === null ? nomUtilisateur : confirmation,
    format: 'Console',
  };
  let texte = normalizeScriptSh(creer.generate(valeurs));
  if (shellTrafique !== null) {
    texte = texte.replace(`KJEMO_SHELL='${shell}'`, `KJEMO_SHELL='${shellTrafique}'`);
  }
  return { bac, texte };
}

console.log('');
console.log('Passe J — comptes : existant, groupe inconnu, groupe privilegie, shell absent');
{
  // J1 — le compte existe deja.
  const { bac, texte } = bacCompte('J1', { dejaPresent: true });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(M.compterAppels(r.journal, 'useradd') === 0,
      'J1 — compte existant -> ZERO useradd');
    verifier(M.compterAppels(r.journal, 'usermod') === 0,
      'J1 : et ZERO usermod — aucune « mise a jour » n est proposee');
    verifier(/existe deja/.test(r.sortie), 'J1 : le script le dit');
  } finally { M.detruireBac(bac); }

  // J2 — un groupe secondaire inconnu.
  const { bac: b2, texte: t2 } = bacCompte('J2', { groupesSecondaires: 'legroupe', groupeInconnu: true });
  try {
    const r = M.executer(b2, t2, { env: envBac(b2) });
    verifier(M.compterAppels(r.journal, 'useradd') === 0,
      'J2 — groupe inconnu -> ZERO useradd');
    verifier(/ne cree pas de groupe|inconnu/.test(r.sortie), 'J2 : le script le dit');
  } finally { M.detruireBac(b2); }

  // J3 — les groupes privilegies sont refuses par le FORMULAIRE.
  const base = {
    nomUtilisateur: 'kjemoessai', commentaire: '', groupePrincipal: '',
    groupesSecondaires: '', shell: '/bin/bash', creerHome: 'Oui',
    confirmation: 'kjemoessai', format: 'Console',
  };
  for (const g of ['sudo', 'adm', 'shadow', 'docker', 'root', 'wheel', 'lxd', 'disk']) {
    verifier(Boolean(creer.validate({ ...base, groupesSecondaires: g }).groupesSecondaires),
      `J3 : le groupe secondaire « ${g} » est refuse`);
    verifier(Boolean(creer.validate({ ...base, groupePrincipal: g }).groupePrincipal),
      `J3 : le groupe principal « ${g} » est refuse`);
  }
  verifier(!creer.validate({ ...base, groupesSecondaires: 'partage,projet' }).groupesSecondaires,
    'J3 : une liste de groupes ordinaires est acceptee');
  verifier(Boolean(creer.validate({ ...base, groupesSecondaires: 'partage,partage' }).groupesSecondaires),
    'J3 : le meme groupe deux fois est refuse');
  verifier(Boolean(creer.validate({ ...base, commentaire: 'Nom:avec:deux-points' }).commentaire),
    'J3 : un commentaire contenant « : » est refuse — c est le separateur de /etc/passwd');
  verifier(Boolean(creer.validate({ ...base, nomUtilisateur: 'root' }).nomUtilisateur),
    'J3 : le nom « root » est refuse');
  verifier(Boolean(creer.validate({ ...base, nomUtilisateur: 'www-data' }).nomUtilisateur),
    'J3 : un compte systeme est refuse');

  // J4 — l interpreteur n existe pas.
  const { bac: b4, texte: t4 } = bacCompte('J4', { shellTrafique: '/bin/kjemo-inexistant' });
  try {
    const r = M.executer(b4, t4, { env: envBac(b4) });
    verifier(M.compterAppels(r.journal, 'useradd') === 0,
      'J4 — interpreteur absent -> ZERO useradd');
    verifier(/absent ou non executable/.test(r.sortie), 'J4 : le script le dit');
  } finally { M.detruireBac(b4); }

  // J5 — confirmation absente.
  const { bac: b5, texte: t5 } = bacCompte('J5', { confirmation: '' });
  try {
    const r = M.executer(b5, t5, { env: envBac(b5) });
    verifier(M.compterAppels(r.journal, 'useradd') === 0,
      'J5 — confirmation absente -> ZERO useradd');
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'J5 : le script le DIT');
  } finally { M.detruireBac(b5); }
}

console.log('');
console.log('Passe K — CONTROLE POSITIF : les options attendues, et AUCUN mot de passe');
{
  const { bac, texte } = bacCompte('K', {
    groupePrincipal: 'legroupe',
    groupesSecondaires: 'legroupe',
    commentaire: 'Nom Complet avec espaces',
  });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `K : le script sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'useradd') === 1,
      `K : useradd appele exactement une fois (${M.compterAppels(r.journal, 'useradd')})`);
    const args = r.journal.find((e) => e.nom === 'useradd')?.args ?? '';
    verifier(/--create-home/.test(args), `K : --create-home est present (${args})`);
    verifier(/--shell \/bin\/bash/.test(args), 'K : --shell recoit l interpreteur demande');
    verifier(/--gid legroupe/.test(args), 'K : --gid recoit le groupe principal');
    verifier(/--groups legroupe/.test(args), 'K : --groups recoit les groupes secondaires');
    verifier(/--comment Nom Complet avec espaces/.test(args),
      `K : le commentaire arrive ENTIER, espaces compris (${args})`);
    verifier(/ -- kjemoessai$/.test(args),
      `K : « -- » precede le nom du compte (${args})`);
    verifier(!/(^| )-p( |$)/.test(args), 'K — AUCUN « -p » : pas de hachage sur la ligne de commande');
    verifier(!/(^| )-u( |$)/.test(args) && !/(^| )-o( |$)/.test(args),
      'K — ni -u ni -o : aucun UID impose, aucun doublon d UID autorise');
    verifier(!/(^| )-r( |$)/.test(args), 'K : ni -r — ce n est pas un compte systeme');

    verifier(M.appeleAvant(r.journal, 'getent', 'useradd'),
      'K : getent a verifie AVANT que useradd agisse');
    const iUseradd = r.journal.findIndex((e) => e.nom === 'useradd');
    verifier(r.journal.slice(iUseradd).some((e) => e.nom === 'getent'),
      'K : et une relecture getent suit la creation');
    verifier(r.journal.slice(iUseradd).some((e) => e.nom === 'id'),
      'K : id relit les appartenances apres la creation');
    verifier(/VERROUILLE/.test(r.sortie), 'K — le script DIT que le compte est verrouille');
    verifier(/sudo passwd kjemoessai/.test(r.sortie),
      'K : et il donne la commande interactive a lancer');

    // La preuve qui compte le plus : le TEXTE du script ne porte aucun mot de
    // passe, aucun hachage, et aucune commande qui en poserait un.
    verifier(!/useradd[^\n]*-p\b/.test(texte), 'K : le texte du script ne contient aucun useradd -p');
    verifier(!/chpasswd/.test(texte), 'K : ni chpasswd');
    verifier(!/--stdin/.test(texte), 'K : ni passwd --stdin');
    const passwdEcriture = texte.split('\n')
      .filter((l) => /\bpasswd\b/.test(l) && !/^\s*#/.test(l))
      .filter((l) => !/passwd -S|getent passwd|etc\/passwd|sudo passwd|paquet passwd|kjemo_dispo passwd/.test(l))
      // Une ligne qui commence par printf IMPRIME le mot « passwd » : elle
      // n'appelle pas la commande. C'est le rappel de l'etape manuelle, et il
      // doit y rester.
      .filter((l) => !/^\s*printf\b/.test(l));
    verifier(passwdEcriture.length === 0,
      `K — aucune ligne de code n appelle passwd en ecriture (${passwdEcriture.join(' | ')})`);
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
// L'assistant d'audit : il ne doit RIEN ecrire, et c'est verifiable.
// ===========================================================================
console.log('');
console.log('Passe L — l audit ne modifie rien');
{
  const bac = M.creerBac('L');
  const cible = arborescence(bac);
  doubluresReelles(bac);
  M.poserMouchard(bac, 'setfacl', {});
  try {
    let texte = normalizeScriptSh(audit.generate({
      chemin: '/srv/essai', recursif: 'Oui', chercherRisques: 'Oui', format: 'Console',
    }));
    texte = texte.replace("KJEMO_CIBLE='/srv/essai'", `KJEMO_CIBLE='${cible}'`);
    const avant = M.etatFichiers(cible);
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `L : l audit sort 0 (obtenu ${r.code})`);
    for (const cmd of ['chmod', 'chown', 'chgrp', 'setfacl']) {
      verifier(M.compterAppels(r.journal, cmd) === 0, `L — ZERO ${cmd}`);
    }
    const apres = M.etatFichiers(cible);
    verifier(JSON.stringify(avant) === JSON.stringify(apres),
      'L : l arborescence est inchangee, fichier par fichier');
    verifier(/Conclusion :/.test(r.sortie), 'L : le rapport est bien alle jusqu a sa conclusion');
    verifier(readdirSync(bac.travail).every((f) => !/\.restore$|\.acl$/.test(f)),
      'L : aucun releve ecrit — un audit n a rien a sauvegarder');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
console.log('');
console.log(`Permissions Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur.');
console.log('chmod et chown agissent réellement, sur une arborescence jetable du bac.');
console.log('Aucun /etc/passwd réel touché, aucun compte créé, aucune ACL réellement posée.');
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
