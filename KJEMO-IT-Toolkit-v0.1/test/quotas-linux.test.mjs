#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DES QUOTAS : LES VERROUS, UN PAR UN
//
// Les deux assistants de quota sont EXÉCUTÉS, dans un bac à sable, avec
// `quotacheck`, `quotaon`, `setquota`, `repquota`, `getent`, `findmnt`,
// `mount` et `df` remplacés par des doublures. On compte les appels, on
// vérifie leur ordre, et on mesure si /etc/fstab — redirigé vers le bac — a
// été touché, octet pour octet.
//
// LES SEPT SCÉNARIOS EXIGÉS
//
//   A  échec de sauvegarde           → zéro écriture
//   B  fstab invalide                → zéro remplacement
//   C  quotacheck échoue             → zéro quotaon
//   D  utilisateur absent            → zéro setquota
//   E  souple > dure                 → zéro écriture
//   F  CONTRÔLE POSITIF              → les appels attendus, dans l'ordre
//   G  chaque verrou désarmé séparément est détecté
//
// Le scénario F n'est pas une politesse : sans lui, les six autres seraient
// verts même si le script ne démarrait pas, même si la doublure n'était pas
// posée, même si le PATH n'avait pas pris.
//
// POURQUOI CE BANC TOURNE EN ROOT
//
// Les deux assistants exigent root et sortent sinon : sans root, le contrôle
// positif ne prouverait rien. Le banc échoue donc au lieu de s'ignorer.
//
// NIVEAU DE PREUVE : exécution réelle avec doublures, dans ce conteneur.
// Aucun vrai `quotaon`, aucun vrai système de fichiers équipé, aucun
// /etc/fstab réel touché. Ubuntu Server réel : NON EXÉCUTÉ.
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

if (process.getuid() !== 0) {
  console.error('');
  console.error('ECHEC : ce banc doit tourner en root.');
  console.error('Les deux assistants de quota exigent root et sortent sinon : sans root,');
  console.error('le controle positif ne prouverait rien, et un banc qui ne prouve rien');
  console.error('ne doit pas etre vert.');
  console.error('');
  console.error('  sudo -E env "PATH=$PATH" node test/quotas-linux.test.mjs');
  console.error('');
  process.exit(1);
}

const outil = (id) => {
  const t = tools.find((x) => x.id === id);
  if (!t) { console.error(`ECHEC : outil « ${id} » absent du catalogue`); process.exit(1); }
  return t;
};
const enable = outil('linux-quota-enable');
const limits = outil('linux-quota-limits');

const FSTAB_INITIAL = 'UUID=11111111-2222-3333-4444-555555555555 /srv/donnees ext4 defaults 0 2\n';

/**
 * Prépare un bac pour `linux-quota-enable`.
 *
 * Chaque réponse de doublure est une DÉCISION de scénario : c'est en les
 * changeant qu'on fabrique les passes B et C.
 */
function bacEnable(nom, {
  options = 'rw,relatime',
  optionsApres = 'rw,relatime,usrquota,grpquota',
  fstypeFs = 'ext4',
  fstab = FSTAB_INITIAL,
  fstabValide = true,
  codeQuotacheck = 0,
  confirmation = '/srv/donnees',
  cpCasse = false,
} = {}) {
  const bac = M.creerBac(nom);
  const chemin = join(bac.travail, 'fstab');
  writeFileSync(chemin, fstab, 'utf8');

  // findmnt répond selon ses arguments : l'état du montage, puis la
  // validation de la copie, puis les options après remontage.
  let remonte = false;
  M.poserMouchard(bac, 'findmnt', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '--verify --tab-file'; then exit ${fstabValide ? 0 : 1}; fi`,
      "if printf '%s' \"$*\" | grep -qE -- '-o OPTIONS'; then",
      `  if [ -e '${join(bac.racine, 'remonte')}' ]; then printf '%s\\n' '${optionsApres}';`,
      `  else printf '%s\\n' '${options}'; fi`,
      '  exit 0',
      'fi',
      `if printf '%s' "$*" | grep -qE -- '-o SOURCE'; then printf '%s\\n' '/dev/kjemo-essai1'; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- '-o FSTYPE'; then printf '%s\\n' '${fstypeFs}'; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- '--mountpoint'; then exit 0; fi",
    ],
  });
  M.poserMouchard(bac, 'df', { code: 0, sortie: 'Avail\n12G' });
  M.poserMouchard(bac, 'mount', {
    code: 0,
    avant: [`: > '${join(bac.racine, 'remonte')}'`],
  });
  M.poserMouchard(bac, 'quotacheck', { code: codeQuotacheck });
  M.poserMouchard(bac, 'quotaon', { code: 0, sortie: 'quotas actives' });
  M.poserMouchard(bac, 'quotaoff', { code: 0 });
  M.poserMouchard(bac, 'repquota', { code: 0, sortie: 'Block limits\nroot -- 0 0 0' });
  M.poserMouchard(bac, 'setquota', { code: 0 });

  // Pour le scénario A : casser la sauvegarde. `cp` n'est pas une commande
  // surveillée du harnais, mais le bac peut tout de même la doubler — et
  // c'est le seul moyen d'éprouver « la sauvegarde échoue ».
  if (cpCasse) M.poserMouchard(bac, 'cp', { code: 1 });

  const valeurs = {
    pointMontage: '/srv/donnees',
    portee: 'Les deux',
    confirmation,
    format: 'Console',
  };
  let texte = normalizeScriptSh(enable.generate(valeurs));
  const avant = texte;
  texte = texte.replace("KJEMO_FSTAB='/etc/fstab'", `KJEMO_FSTAB='${chemin}'`);
  if (texte === avant) fail('la redirection de /etc/fstab vers le bac a echoue : le banc ecrirait dans le vrai fichier');
  // Le gardien de chemin refuserait /srv/donnees ? Non : /srv n'est pas une
  // racine protegee. Le montage reste donc /srv/donnees, qui n'existe pas
  // dans ce conteneur — c'est findmnt, double, qui repond a sa place.
  return { bac, texte, chemin };
}

/** Prépare un bac pour `linux-quota-limits`. */
function bacLimits(nom, {
  cibleExiste = true,
  options = 'rw,relatime,usrquota,grpquota',
  repquotaRepond = true,
  blocsRelus = null,
  confirmation = 'essai',
  codeSetquota = 0,
  espaceSoft = '900',
  espaceHard = '1000',
} = {}) {
  const bac = M.creerBac(nom);
  const soft = blocsRelus ? blocsRelus[0] : String(Number(espaceSoft) * 1024);
  const hard = blocsRelus ? blocsRelus[1] : String(Number(espaceHard) * 1024);

  M.poserMouchard(bac, 'getent', { code: cibleExiste ? 0 : 2, sortie: cibleExiste ? 'essai:x:1001:1001::/home/essai:/bin/bash' : '' });
  M.poserMouchard(bac, 'findmnt', {
    code: 0,
    selonArgs: [
      { motif: '-o OPTIONS', code: 0, sortie: options },
      { motif: '--mountpoint', code: 0, sortie: '' },
    ],
  });
  M.poserMouchard(bac, 'repquota', {
    code: repquotaRepond ? 0 : 1,
    sortie: repquotaRepond ? `Block grace time: 7days\nessai -- 0 ${soft} ${hard} 0 0 0` : '',
  });
  M.poserMouchard(bac, 'quota', { code: 0, sortie: 'aucune limite' });
  M.poserMouchard(bac, 'setquota', { code: codeSetquota });

  const valeurs = {
    pointMontage: '/srv/donnees',
    typeCible: 'Utilisateur',
    nomCible: 'essai',
    unite: 'Mio',
    espaceSoft,
    espaceHard,
    inodesSoft: '0',
    inodesHard: '0',
    confirmation,
    format: 'Console',
  };
  return { bac, texte: normalizeScriptSh(limits.generate(valeurs)) };
}

// ===========================================================================
console.log('');
console.log('Passe A — la sauvegarde de /etc/fstab échoue');
{
  const { bac, texte, chemin } = bacEnable('A', { cpCasse: true });
  try {
    const r = M.executer(bac, texte);
    verifier(readFileSync(chemin, 'utf8') === FSTAB_INITIAL,
      'A — ZERO ÉCRITURE de fstab quand la sauvegarde échoue');
    verifier(M.compterAppels(r.journal, 'quotacheck') === 0,
      `A : ZERO quotacheck (${M.compterAppels(r.journal, 'quotacheck')})`);
    verifier(M.compterAppels(r.journal, 'quotaon') === 0, 'A : ZERO quotaon');
    verifier(r.code !== 0, `A : le script sort en erreur (code ${r.code})`);
    // La doublure de `cp` fait echouer la PREMIERE copie, celle du fichier de
    // travail — avant meme la sauvegarde. Le script doit donc parler de l une
    // ou de l autre, et surtout dire si /etc/fstab a ete touche : c est la
    // question urgente a ce moment-la. Premiere version de ce test : je
    // cherchais « sauvegarde » et le script mourait muet sur le cp, ce qui a
    // fait apparaitre un vrai defaut.
    verifier(/copie de travail|sauvegarde/i.test(r.sortie),
      'A : le script nomme l’etape qui a echoue');
    verifier(/PAS ete modifie/.test(r.sortie),
      'A : le script DIT que /etc/fstab n’a pas été modifié');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe B — findmnt --verify refuse la copie de fstab');
{
  const { bac, texte, chemin } = bacEnable('B', { fstabValide: false });
  try {
    const r = M.executer(bac, texte);
    verifier(readFileSync(chemin, 'utf8') === FSTAB_INITIAL,
      'B — ZERO REMPLACEMENT de fstab quand la validation échoue');
    verifier(M.compterAppels(r.journal, 'findmnt', '--verify --tab-file') >= 1,
      'B : la validation sur COPIE est bien tentée');
    verifier(M.compterAppels(r.journal, 'mount') === 0, 'B : ZERO remontage');
    verifier(M.compterAppels(r.journal, 'quotacheck') === 0, 'B : ZERO quotacheck');
    verifier(/PAS ete modifie/.test(r.sortie),
      'B : le script DIT que /etc/fstab n’a pas été modifié');
    verifier(r.code !== 0, `B : sortie en erreur (code ${r.code})`);
    const sauvegardes = r.fichiers.ajoutes.filter((f) => /fstab.*\.bak$/.test(f));
    verifier(sauvegardes.length === 0,
      `B : aucune sauvegarde créée — la validation précède la sauvegarde (${sauvegardes.length})`);
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe C — quotacheck échoue');
{
  const { bac, texte } = bacEnable('C', { codeQuotacheck: 3 });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'quotacheck') === 1,
      `C : quotacheck appelé une fois (${M.compterAppels(r.journal, 'quotacheck')})`);
    verifier(M.compterAppels(r.journal, 'quotaon') === 0,
      `C — ZERO quotaon quand quotacheck échoue (${M.compterAppels(r.journal, 'quotaon')})`);
    verifier(r.code !== 0, `C : sortie en erreur (code ${r.code})`);
    verifier(/quotacheck/i.test(r.sortie), 'C : le script nomme quotacheck');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe D — l’utilisateur visé n’existe pas');
{
  const { bac, texte } = bacLimits('D', { cibleExiste: false });
  try {
    const r = M.executer(bac, texte);
    verifier(M.compterAppels(r.journal, 'setquota') === 0,
      `D — ZERO setquota sur une cible inexistante (${M.compterAppels(r.journal, 'setquota')})`);
    verifier(M.compterAppels(r.journal, 'getent') >= 1, 'D : getent a bien été consulté');
    verifier(/inexistant|n existe pas/i.test(r.sortie) || /AUCUNE MODIFICATION/.test(r.sortie),
      'D : le script dit que la cible n’existe pas');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe E — limite souple supérieure à la limite dure');
{
  // Le formulaire refuse ce cas : generate() lèverait. On éprouve donc la
  // garde qui vit DANS le script, en modifiant les deux variables du script
  // généré — exactement ce qui arriverait si quelqu'un relisait le script et
  // retouchait un chiffre à la main avant de l'exécuter.
  const { bac, texte } = bacLimits('E', {});
  try {
    const trafique = texte
      .replace(/KJEMO_BLOCS_SOFT='\d+'/, "KJEMO_BLOCS_SOFT='2000000'")
      .replace(/KJEMO_BLOCS_HARD='\d+'/, "KJEMO_BLOCS_HARD='1000'");
    verifier(trafique !== texte, 'E : les deux limites du script ont bien été retouchées');
    const r = M.executer(bac, trafique);
    verifier(M.compterAppels(r.journal, 'setquota') === 0,
      `E — ZERO setquota quand souple > dure (${M.compterAppels(r.journal, 'setquota')})`);
    verifier(/souple > dure/.test(r.sortie) || /AUCUNE MODIFICATION/.test(r.sortie),
      'E : le script refuse et le dit');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe F — CONTRÔLE POSITIF sur les deux assistants');
{
  const { bac, texte, chemin } = bacEnable('F1');
  try {
    const r = M.executer(bac, texte);
    verifier(r.code === 0, `F1 : linux-quota-enable sort 0 (obtenu ${r.code})`);
    const contenu = readFileSync(chemin, 'utf8');
    verifier(/usrquota/.test(contenu) && /grpquota/.test(contenu),
      `F1 : fstab porte les deux options (${contenu.trim()})`);
    verifier(/UUID=11111111/.test(contenu),
      'F1 : l’UUID de la ligne est préservé — seule la 4e colonne change');
    // awk reconstruit la ligne avec des tabulations : fstab accepte n importe
    // quel blanc comme separateur, et les SIX champs sont ce qui compte.
    const champs = contenu.split('\n').find((l) => / \/srv\/donnees|\t\/srv\/donnees/.test(l))?.split(/\s+/) ?? [];
    verifier(champs.length === 6,
      `F1 : la ligne garde ses six champs (${champs.length} : ${champs.join('|')})`);
    verifier(champs[4] === '0' && champs[5] === '2',
      `F1 : les colonnes dump et passe fsck sont préservées (${champs[4]}, ${champs[5]})`);

    const iMount = r.journal.findIndex((e) => e.nom === 'mount');
    const iCheck = r.journal.findIndex((e) => e.nom === 'quotacheck');
    const iOn = r.journal.findIndex((e) => e.nom === 'quotaon');
    const iRep = r.journal.findIndex((e, k) => e.nom === 'repquota' && k > iOn);
    verifier(iMount !== -1 && iCheck !== -1 && iMount < iCheck,
      'F1 : le remontage précède quotacheck — les options doivent être en vigueur');
    verifier(iCheck !== -1 && iOn !== -1 && iCheck < iOn,
      'F1 : quotacheck précède quotaon');
    verifier(iOn !== -1 && iRep !== -1 && iOn < iRep,
      'F1 : repquota confirme APRÈS quotaon — c’est la relecture qui décide');
    const argsCheck = r.journal.filter((e) => e.nom === 'quotacheck').map((e) => e.args).join(' ');
    verifier(/-cugm/.test(argsCheck),
      `F1 : quotacheck reçoit -cugm, et non « -c » seul (${argsCheck})`);
    const sauvegardes = r.fichiers.ajoutes.filter((f) => /fstab.*\.bak$/.test(f));
    verifier(sauvegardes.length === 1,
      `F1 : une sauvegarde horodatée a été laissée (${sauvegardes.length})`);
    verifier(!existsSync(`${chemin}.kjemo-nouveau`),
      'F1 : le fichier intermédiaire du remplacement atomique n’est pas laissé');
  } finally { M.detruireBac(bac); }

  const { bac: bac2, texte: texte2 } = bacLimits('F2');
  try {
    const r = M.executer(bac2, texte2);
    verifier(r.code === 0, `F2 : linux-quota-limits sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'setquota') === 1,
      `F2 : setquota appelé exactement une fois (${M.compterAppels(r.journal, 'setquota')})`);
    const args = r.journal.find((e) => e.nom === 'setquota')?.args ?? '';
    // 900 Mio = 921600 blocs de 1 Kio. C'est la conversion, et c'est elle qui
    // fait la moitié des erreurs de quota dans la vraie vie.
    verifier(/\b921600\b/.test(args) && /\b1024000\b/.test(args),
      `F2 : les limites transmises sont converties en blocs de 1 Kio (${args})`);
    verifier(/-u/.test(args) && /essai/.test(args),
      `F2 : setquota reçoit « -u essai » (${args})`);
    const iSet = r.journal.findIndex((e) => e.nom === 'setquota');
    const iRep = r.journal.findIndex((e, k) => e.nom === 'repquota' && k > iSet);
    verifier(iSet !== -1 && iRep !== -1 && iSet < iRep,
      'F2 : la relecture repquota vient APRÈS setquota');
    verifier(M.compterAppels(r.journal, 'edquota') === 0,
      'F2 : edquota n’est JAMAIS appelé — il ouvrirait un éditeur et bloquerait le script');
  } finally { M.detruireBac(bac2); }
}

console.log('');
console.log('Passe G — chaque verrou désarmé séparément');
{
  // La relecture qui ne correspond pas : setquota « réussit » mais repquota
  // rend d'autres chiffres. Le script doit refuser de conclure.
  const { bac, texte } = bacLimits('G1', { blocsRelus: ['1', '2'] });
  try {
    const r = M.executer(bac, texte);
    verifier(r.code !== 0, `G1 : relecture divergente → sortie en erreur (code ${r.code})`);
    verifier(/ne correspondent pas/.test(r.sortie),
      'G1 : le script DIT que les valeurs relues ne correspondent pas');
  } finally { M.detruireBac(bac); }

  // repquota muet : la comptabilité n'est pas active.
  const { bac: b2, texte: t2 } = bacLimits('G2', { repquotaRepond: false });
  try {
    const r = M.executer(b2, t2);
    verifier(M.compterAppels(r.journal, 'setquota') === 0,
      'G2 : comptabilité inactive → ZERO setquota');
  } finally { M.detruireBac(b2); }

  // Options de montage sans usrquota.
  const { bac: b3, texte: t3 } = bacLimits('G3', { options: 'rw,relatime' });
  try {
    const r = M.executer(b3, t3);
    verifier(M.compterAppels(r.journal, 'setquota') === 0,
      'G3 : usrquota absent des options → ZERO setquota');
  } finally { M.detruireBac(b3); }

  // Confirmation absente, sur les deux assistants.
  const { bac: b4, texte: t4, chemin: c4 } = bacEnable('G4', { confirmation: '' });
  try {
    const r = M.executer(b4, t4);
    verifier(readFileSync(c4, 'utf8') === FSTAB_INITIAL,
      'G4 : confirmation absente → fstab inchangé octet pour octet');
    verifier(M.compterAppels(r.journal, 'quotacheck') === 0
      && M.compterAppels(r.journal, 'quotaon') === 0,
      'G4 : confirmation absente → ZERO quotacheck, ZERO quotaon');
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'G4 : le script nomme la condition manquante');
  } finally { M.detruireBac(b4); }

  const { bac: b5, texte: t5 } = bacLimits('G5', { confirmation: '' });
  try {
    const r = M.executer(b5, t5);
    verifier(M.compterAppels(r.journal, 'setquota') === 0,
      'G5 : confirmation absente → ZERO setquota');
  } finally { M.detruireBac(b5); }

  // xfs : refusé explicitement plutôt que traité de travers.
  const { bac: b6, texte: t6, chemin: c6 } = bacEnable('G6', { fstypeFs: 'xfs' });
  try {
    const r = M.executer(b6, t6);
    verifier(readFileSync(c6, 'utf8') === FSTAB_INITIAL, 'G6 : xfs → fstab inchangé');
    verifier(/xfs/.test(r.sortie), 'G6 : le script dit pourquoi xfs est refusé');
  } finally { M.detruireBac(b6); }

  // Montage absent de fstab : rien à modifier.
  const { bac: b7, texte: t7, chemin: c7 } = bacEnable('G7', { fstab: '# vide\n' });
  try {
    const r = M.executer(b7, t7);
    verifier(readFileSync(c7, 'utf8') === '# vide\n',
      'G7 : montage absent de fstab → fichier inchangé');
    verifier(M.compterAppels(r.journal, 'quotacheck') === 0,
      'G7 : montage absent de fstab → ZERO quotacheck');
  } finally { M.detruireBac(b7); }
}

// ===========================================================================
console.log('');
console.log(`Quotas Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Exécution RÉELLE avec doublures. Aucun vrai quotaon, aucun système de');
console.log('fichiers réellement équipé, aucun /etc/fstab réel touché.');
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
