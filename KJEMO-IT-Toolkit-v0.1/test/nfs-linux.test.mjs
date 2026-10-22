#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DE NFS : ON ÉCRIT LA LIGNE, ON N'APPLIQUE PAS, ET ON LE PROUVE
//
// Les deux assistants du commit 23/n sont EXÉCUTÉS dans un bac à sable.
// dpkg-query, systemctl, ss, ufw, getent, findmnt, showmount, rpcinfo et
// exportfs sont remplacés par des doublures.
//
// IL N'Y A PAS DE « VRAI BINAIRE » À UTILISER ICI, ET C'EST LE SUJET.
//
// Le banc Samba se servait du VRAI testparm, parce que testparm valide un
// fichier quelconque sans rien appliquer : une doublure n'aurait prouvé que
// la doublure. NFS n'a pas d'équivalent. exportfs(8) pour Ubuntu 24.04
// n'offre aucune option d'essai à blanc, et « -r » applique et RETIRE. Le
// seul usage possible de l'outil dans ce banc est donc la DOUBLURE, dont le
// rôle est de prouver que l'assistant ne l'appelle JAMAIS pour agir.
//
// /etc/exports est REDIRIGÉ vers le bac en réécrivant la seule ligne
// `KJEMO_EXPORTS='/etc/exports'` du script généré. Si cette substitution ne
// s'applique pas, le banc ÉCHOUE immédiatement — sans quoi il écrirait dans
// le vrai fichier de la machine de développement.
//
// LES PASSES
//
//   0  aucun contournement du PATH par un chemin absolu
//   A  nfs-server-readiness n'appelle AUCUNE commande modifiante, et son
//      audit nomme « * », « /0 » et no_root_squash déjà présents
//   B  confirmation absente              → zéro écriture, zéro sauvegarde
//   C  dossier à exporter absent         → zéro écriture
//   D  couple dossier/client déjà là     → zéro écriture
//   E  CONTRÔLE POSITIF                  → sauvegarde, ajout en fin de
//                                          fichier, relecture, et ZÉRO appel
//                                          à exportfs
//   F  CONTRE-ÉPREUVE DU VERROU          → une ligne trafiquée portant « * »
//                                          ou no_root_squash est refusée PAR
//                                          LE SCRIPT, après le formulaire
//   G  les refus du FORMULAIRE : « * », joker, /0, zones système
//   H  le TEXTE des jeux : jamais « exportfs -ra », jamais no_root_squash,
//      et root_squash toujours écrit
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur.
// Aucun /etc/exports réel touché, aucun export réel appliqué, aucun montage
// réel. Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(ROOT, 'dist/noyau-bash.mjs')).href);
const M = await import(pathToFileURL(resolve(ROOT, 'test/mouchards-linux.mjs')).href);
const { codeNu } = await import(pathToFileURL(resolve(ROOT, 'scripts/familles-dangereuses.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

const outil = (id) => {
  const t = tools.find((x) => x.id === id);
  if (!t) { console.error(`ECHEC : outil « ${id} » absent du catalogue`); process.exit(1); }
  return t;
};
const prerequis = outil('nfs-server-readiness');
const creer = outil('nfs-export-create');

// ---------------------------------------------------------------------------
// PRÉREQUIS : root, parce que l'assistant modifiant s'arrête sans lui
// ---------------------------------------------------------------------------
// Le refus de blocPrivilegesBash est une BONNE chose — c'est la garde — mais
// un banc qui tomberait dessus ne mesurerait plus rien et sortirait vert sur
// huit refus de privilèges. Mieux vaut annoncer NON EXÉCUTÉ.
if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('');
  console.error('NFS Linux : NON EXÉCUTÉ — nfs-export-create exige root, et sans lui');
  console.error('le banc ne mesurerait que huit refus de privilèges. Un banc qui ne');
  console.error('mesure rien ne se déclare pas vert.');
  console.error('  Relance avec : sudo -E env "PATH=$PATH" node test/nfs-linux.test.mjs');
  process.exit(1);
}

const envBac = (bac) => ({ HOME: bac.travail });
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

function lignesJson(bac) {
  const f = readdirSync(bac.travail).filter((n) => n.endsWith('.json'));
  if (f.length === 0) return [];
  return JSON.parse(readFileSync(join(bac.travail, f[f.length - 1]), 'utf8')).controles;
}
const ligneDe = (l, c) => l.find((x) => x.controle === c);
const etatDe = (l, c) => (ligneDe(l, c) ?? {}).etat ?? 'ABSENTE';
const comDe = (l, c) => (ligneDe(l, c) ?? {}).commentaire ?? '';

const EXPORTS_SAIN = `# /etc/exports du bac
/srv/nfs/existant 192.168.40.0/24(ro,sync,root_squash,no_subtree_check)
`;

const EXPORTS_DANGEREUX = `# /etc/exports du bac
/srv/nfs/ouvert *(rw,sync,no_root_squash,no_subtree_check)
/srv/nfs/cidr 0.0.0.0/0(rw,async,root_squash)
/srv/nfs/joker *.labo.local(rw,sync,root_squash,all_squash)
`;

/**
 * Redirige /etc/exports vers le bac, et échoue bruyamment si la substitution
 * n'a pas eu lieu. Sans ce garde-fou, le banc écrirait dans le vrai fichier
 * de la machine de développement — qui, sur une machine de cours, sert.
 */
function rediriger(texte, chemin) {
  const apres = texte.replace("KJEMO_EXPORTS='/etc/exports'", `KJEMO_EXPORTS='${chemin}'`);
  if (apres === texte) {
    fail('la redirection de /etc/exports vers le bac a echoue : le banc ecrirait dans le vrai fichier');
    process.exit(1);
  }
  return apres;
}

/**
 * Un bac NFS. Les réglages qui changent le résultat : le contenu du fichier
 * des exports, l'existence du dossier à exporter, et l'état du service.
 */
function bacNfs(nom, {
  exports: contenu = EXPORTS_SAIN,
  dossierExiste = true,
  serviceActif = true,
  paquetServeur = true,
} = {}) {
  const bac = M.creerBac(nom);
  const cheminExports = join(bac.travail, 'exports');
  writeFileSync(cheminExports, contenu, 'utf8');
  const cheminExport = join(bac.travail, 'donnees');
  if (dossierExiste) mkdirSync(cheminExport, { recursive: true });

  M.poserMouchard(bac, 'dpkg-query', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'nfs-kernel-server'; then ${paquetServeur ? "printf '%s' 'install ok installed'; exit 0" : "printf '%s' ''; exit 1"}; fi`,
      "printf '%s' 'install ok installed'",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'systemctl', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'is-active nfs-server'; then printf '%s\\n' ${sq(serviceActif ? 'active' : 'inactive')}; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- 'is-active rpcbind'; then printf '%s\\n' 'active'; exit 0; fi",
      "if printf '%s' \"$*\" | grep -qE -- 'is-enabled'; then printf '%s\\n' 'enabled'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'ss', {
    code: 0,
    sortie: 'Netid State Recv-Q Send-Q Local Peer\ntcp LISTEN 0 64 0.0.0.0:2049 0.0.0.0:*\ntcp LISTEN 0 4096 0.0.0.0:111 0.0.0.0:*',
  });
  M.poserMouchard(bac, 'ufw', { code: 0, sortie: 'Status: active\n2049/tcp                   ALLOW       192.168.30.0/24' });
  M.poserMouchard(bac, 'getent', { code: 0, sortie: '192.168.30.50 poste-labo.kjemo.local' });
  M.poserMouchard(bac, 'findmnt', { code: 0, sortie: '/' });
  M.poserMouchard(bac, 'showmount', { code: 0, sortie: 'Export list for localhost:\n/srv/nfs/existant 192.168.40.0/24' });
  M.poserMouchard(bac, 'rpcinfo', { code: 0, sortie: '100003 3 tcp 2049 nfs\n100005 1 udp 20048 mountd' });
  // LA doublure du sujet : exportfs. Elle rend une table plausible pour « -v »
  // et journalise TOUT — c'est son journal qui prouve que « -ra » n'a jamais
  // ete appele.
  M.poserMouchard(bac, 'exportfs', {
    code: 0,
    sortie: '/srv/nfs/existant\n\t\t192.168.40.0/24(ro,sync,wdelay,root_squash,no_subtree_check)',
  });
  // « id » délègue : sans cela le contrôle de privilèges lirait un faux
  // identifiant et le script s'arrêterait avant toute mesure.
  M.poserMouchard(bac, 'id', { code: 0, avant: ['exec /usr/bin/id "$@"'] });
  return { bac, cheminExports, cheminExport };
}

const sauvegardes = (bac) => readdirSync(bac.travail).filter((n) => /\.kjemo-.*\.bak$/.test(n));
const lire = (chemin) => readFileSync(chemin, 'utf8');
/** Les appels d'exportfs qui AGISSENT : -r, -a, -u, -o. « -v » et « -s » lisent. */
const exportfsAgissants = (journal) => journal
  .filter((e) => e.nom === 'exportfs')
  .map((e) => e.args)
  .filter((a) => /(^|\s)-[a-z]*[raou]/.test(a));

// ===========================================================================
console.log('');
console.log('Passe 0 — aucun contournement du PATH par un chemin absolu');
// ===========================================================================
{
  const MOTIF = /(^|[\s|(&;])\/(usr\/)?s?bin\/(exportfs|showmount|rpcinfo|systemctl|ss|ufw|getent|dpkg-query|findmnt|mount|umount|stat)\b/m;
  for (const t of [prerequis, creer]) {
    const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
    const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
    verifier(!MOTIF.test(nu), `0 : ${t.id} n appelle aucune commande par un chemin absolu`);
    verifier(!/\bcommand\s+-p\b/.test(nu),
      `0 : ${t.id} n utilise pas « command -p », qui contournerait le PATH du banc`);
  }
}

// ===========================================================================
console.log('');
console.log('Passe A — nfs-server-readiness lit, et son audit nomme ce qui est ouvert');
// ===========================================================================
{
  const { bac, cheminExports, cheminExport } = bacNfs('A1');
  try {
    const avant = lire(cheminExports);
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      cheminEnvisage: cheminExport, clientEnvisage: '192.168.30.0/24', format: 'JSON',
    })), cheminExports);
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `A1 : sort 0 (obtenu ${r.code})`);
    verifier(lire(cheminExports) === avant,
      'A1 — ZERO ECRITURE : le fichier des exports est identique a l octet');
    verifier(sauvegardes(bac).length === 0,
      'A1 — aucune sauvegarde creee : un diagnostic n a rien a sauvegarder');
    verifier(exportfsAgissants(r.journal).length === 0,
      `A1 — ZERO exportfs agissant (${exportfsAgissants(r.journal).join(' | ') || 'aucun'})`);
    const expAppels = r.journal.filter((e) => e.nom === 'exportfs').map((e) => e.args);
    verifier(expAppels.length > 0 && expAppels.every((a) => /^-v$/.test(a.trim())),
      `A1 : exportfs n est appele qu avec « -v » (${expAppels.join(' | ') || 'aucun'})`);
    const sysModif = r.journal.filter((e) => e.nom === 'systemctl')
      .map((e) => e.args).filter((a) => /\b(start|stop|restart|reload|enable|disable|mask)\b/.test(a));
    verifier(sysModif.length === 0, `A1 — ZERO systemctl modifiant (${sysModif.join(' | ') || 'aucun'})`);
    const ufw = r.journal.filter((e) => e.nom === 'ufw').map((e) => e.args)
      .filter((a) => /^(allow|deny|enable|disable|reset|delete)\b/.test(a));
    verifier(ufw.length === 0, 'A1 — ZERO ufw modifiant : aucun port ouvert');
    verifier(M.compterAppels(r.journal, 'mount') === 0, 'A1 — ZERO montage');

    const lignes = lignesJson(bac);
    verifier(lignes.length > 0, `A1 : le rapport JSON contient ${lignes.length} controle(s)`);
    verifier(etatDe(lignes, 'exportfs -v') === 'OK',
      `A1 : la TABLE en service est lue separement du fichier (obtenu ${etatDe(lignes, 'exportfs -v')})`);
    verifier(/etab|table/i.test(JSON.stringify(lignes)),
      'A1 : le rapport distingue le FICHIER de la TABLE lue par rpc.mountd');
    verifier(/exportfs -ra n est pas lance|n a pas lance/.test(JSON.stringify(lignes)),
      'A1 : le rapport DIT qu il n a pas applique, au lieu de laisser croire');
    verifier(etatDe(lignes, 'Export vers *') === 'OK',
      `A1 : sur un fichier sain, l audit conclut OK (obtenu ${etatDe(lignes, 'Export vers *')})`);
  } finally { M.detruireBac(bac); }

  // --- A2 : le fichier DANGEREUX. C'est la passe qui justifie l'audit. -----
  const { bac: b2, cheminExports: c2 } = bacNfs('A2', { exports: EXPORTS_DANGEREUX });
  try {
    const avant = lire(c2);
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      cheminEnvisage: '', clientEnvisage: '', format: 'JSON',
    })), c2);
    const r = M.executer(b2, texte, { env: envBac(b2) });
    verifier(r.code === 0, `A2 : sort 0 (obtenu ${r.code})`);
    verifier(lire(c2) === avant,
      'A2 — ZERO CORRECTION : l audit ne touche a rien, meme devant un export vers *');
    const lignes = lignesJson(b2);
    verifier(etatDe(lignes, 'Export vers *') === 'PROBLEME',
      `A2 — « * » est signale comme PROBLEME (obtenu ${etatDe(lignes, 'Export vers *')})`);
    verifier(/will match all clients|toute machine/.test(comDe(lignes, 'Export vers *')),
      'A2 : le commentaire dit la CONSEQUENCE, et non « non recommande »');
    verifier(etatDe(lignes, 'Prefixe /0') === 'PROBLEME',
      `A2 — « /0 » est signale (obtenu ${etatDe(lignes, 'Prefixe /0')})`);
    verifier(/ecrit en notation CIDR|ecrit en CIDR/.test(comDe(lignes, 'Prefixe /0')),
      'A2 : le rapport explique que /0 est « * » deguise en reseau');
    verifier(etatDe(lignes, 'no_root_squash') === 'PROBLEME',
      `A2 — no_root_squash est signale (obtenu ${etatDe(lignes, 'no_root_squash')})`);
    verifier(/diskless|sans disque/.test(comDe(lignes, 'no_root_squash')),
      'A2 : le rapport cite l usage auquel la page de manuel reserve no_root_squash');
    verifier(etatDe(lignes, 'Jokers') === 'ATTENTION',
      `A2 — le joker « *.labo.local » est signale (obtenu ${etatDe(lignes, 'Jokers')})`);
    verifier(/sous-domaines/.test(comDe(lignes, 'Jokers')),
      'A2 : le rapport dit que le joker attrape aussi les sous-domaines');
    verifier(etatDe(lignes, 'async') === 'ATTENTION',
      `A2 — async est signale (obtenu ${etatDe(lignes, 'async')})`);
    verifier(etatDe(lignes, 'all_squash') === 'INFO',
      `A2 : all_squash est rapporte sans etre accuse (obtenu ${etatDe(lignes, 'all_squash')})`);
    verifier(exportfsAgissants(r.journal).length === 0,
      'A2 — ZERO exportfs agissant, meme devant un fichier dangereux');
  } finally { M.detruireBac(b2); }

  // --- A3 : le paquet serveur manque → PROBLEME, et nfs-common ne le masque pas.
  const { bac: b3, cheminExports: c3 } = bacNfs('A3', { paquetServeur: false, serviceActif: false });
  try {
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      cheminEnvisage: '', clientEnvisage: '', format: 'JSON',
    })), c3);
    const r = M.executer(b3, texte, { env: envBac(b3) });
    verifier(r.code === 0, `A3 : sort 0 (obtenu ${r.code})`);
    const lignes = lignesJson(b3);
    verifier(etatDe(lignes, 'nfs-kernel-server') === 'PROBLEME',
      `A3 : l absence du paquet SERVEUR est un PROBLEME (obtenu ${etatDe(lignes, 'nfs-kernel-server')})`);
    verifier(/paquet CLIENT|nfs-common/.test(comDe(lignes, 'nfs-kernel-server')),
      'A3 : le commentaire leve la confusion client/serveur, qui est la premiere du sujet');
    verifier(etatDe(lignes, 'Verdict') === 'ATTENTION',
      `A3 : le verdict du socle refuse de conclure (obtenu ${etatDe(lignes, 'Verdict')})`);
  } finally { M.detruireBac(b3); }
}

// ===========================================================================
console.log('');
console.log('Passe B à F — nfs-export-create : sept conditions, et aucune application');
// ===========================================================================

function creerScript(cheminExports, champs) {
  return rediriger(normalizeScriptSh(creer.generate({
    chemin: '/srv/nfs/partage', client: '192.168.30.0/24', ecriture: 'Oui',
    squashTous: 'Non', confirmation: '', format: 'Console', ...champs,
  })), cheminExports);
}

{
  // --- B : confirmation absente -------------------------------------------
  const { bac, cheminExports, cheminExport } = bacNfs('B');
  try {
    const avant = lire(cheminExports);
    const r = M.executer(bac, creerScript(cheminExports, { chemin: cheminExport, confirmation: '' }),
      { env: envBac(bac) });
    verifier(r.code === 0, `B : le script sort 0 sans confirmation (obtenu ${r.code})`);
    verifier(lire(cheminExports) === avant, 'B — ZERO ECRITURE sans confirmation');
    verifier(sauvegardes(bac).length === 0,
      `B — ZERO SAUVEGARDE : un script qui n ira pas jusqu a ecrire ne laisse pas de .bak (trouve : ${sauvegardes(bac).join(', ') || 'aucun'})`);
    verifier(/confirmation ne reprend pas exactement/.test(r.sortie),
      'B : la condition manquante est NOMMEE');
    verifier(/APERCU EXACT DE CE QUI SERA AJOUTE/.test(r.sortie),
      'B : l apercu est affiche quand meme — on doit pouvoir LIRE sans avoir confirme');
    verifier(exportfsAgissants(r.journal).length === 0, 'B — ZERO exportfs agissant');
  } finally { M.detruireBac(bac); }

  // --- C : dossier absent ---------------------------------------------------
  const { bac: bc, cheminExports: cc } = bacNfs('C', { dossierExiste: false });
  try {
    const cible = join(bc.travail, 'donnees');
    const avant = lire(cc);
    const r = M.executer(bc, creerScript(cc, { chemin: cible, confirmation: cible }), { env: envBac(bc) });
    verifier(lire(cc) === avant, 'C — ZERO ECRITURE quand le dossier a exporter n existe pas');
    verifier(sauvegardes(bc).length === 0, 'C — ZERO SAUVEGARDE');
    verifier(/n existe pas/.test(r.sortie), 'C : le dossier manquant est nomme');
    verifier(/Failed to stat|l application echouerait|application echouerait/.test(r.sortie),
      'C : le rapport dit que la ligne s ecrirait et que c est l APPLICATION qui refuserait');
  } finally { M.detruireBac(bc); }

  // --- D : le couple dossier/client est déjà là -----------------------------
  const { bac: bd, cheminExports: cd } = bacNfs('D', {
    exports: '/srv/nfs/deja 192.168.30.0/24(ro,sync,root_squash,no_subtree_check)\n',
  });
  try {
    mkdirSync(join(bd.travail, 'deja'), { recursive: true });
    const avant = lire(cd);
    // Le chemin du bac n'est pas celui du fichier : on réécrit la ligne du
    // fichier pour qu'elle désigne le dossier du bac, sinon le doublon ne
    // serait pas détecté et la passe ne mesurerait rien.
    const cible = join(bd.travail, 'deja');
    writeFileSync(cd, `${cible} 192.168.30.0/24(ro,sync,root_squash,no_subtree_check)\n`, 'utf8');
    const avant2 = lire(cd);
    verifier(avant !== avant2, 'D : le fichier du bac decrit bien le couple a dupliquer');
    const r = M.executer(bd, creerScript(cd, { chemin: cible, confirmation: cible }), { env: envBac(bd) });
    verifier(lire(cd) === avant2, 'D — ZERO ECRITURE quand le couple dossier/client existe deja');
    verifier(sauvegardes(bd).length === 0, 'D — ZERO SAUVEGARDE');
    verifier(/se recouvrent/.test(r.sortie),
      'D : le refus explique que deux lignes pour le meme couple se recouvrent');
  } finally { M.detruireBac(bd); }

  // --- E : CONTRÔLE POSITIF -------------------------------------------------
  const { bac: be, cheminExports: ce, cheminExport: pe } = bacNfs('E');
  try {
    const avant = lire(ce);
    const r = M.executer(be, creerScript(ce, {
      chemin: pe, confirmation: pe, ecriture: 'Oui', squashTous: 'Non', format: 'JSON',
    }), { env: envBac(be) });
    verifier(r.code === 0, `E : le controle positif sort 0 (obtenu ${r.code})`);
    const apres = lire(ce);
    verifier(apres !== avant, 'E — CONTROLE POSITIF : le fichier des exports a bien ete modifie');
    verifier(apres.startsWith(avant),
      'E — AJOUT SEUL : le contenu d origine est intact, octet pour octet, et la ligne est AJOUTEE a la fin');
    const ligneAttendue = `${pe} 192.168.30.0/24(rw,sync,root_squash,no_subtree_check)`;
    verifier(apres.split('\n').includes(ligneAttendue),
      `E : la ligne attendue est presente telle quelle (${ligneAttendue})`);
    verifier(/root_squash/.test(apres) && !/no_root_squash/.test(apres),
      'E : root_squash est ECRIT, et no_root_squash absent');
    verifier(!/[*?]/.test(apres.slice(avant.length)),
      'E : la ligne ajoutee ne contient ni joker ni etoile');
    const bak = sauvegardes(be);
    verifier(bak.length === 1, `E : une sauvegarde et une seule a ete creee (${bak.join(', ') || 'aucune'})`);
    if (bak.length === 1) {
      verifier(readFileSync(join(be.travail, bak[0]), 'utf8') === avant,
        'E : la sauvegarde contient EXACTEMENT le fichier d avant');
    }
    // L'ORDRE : aperçu, puis sauvegarde, puis écriture.
    const iApercu = r.sortie.indexOf('APERCU EXACT');
    const iSauve = r.sortie.indexOf('Sauvegarde verifiee');
    verifier(iApercu > -1 && iSauve > iApercu,
      'E : l apercu precede la sauvegarde — on lit avant que quoi que ce soit bouge');
    // LE POINT DU MODULE : aucune application.
    verifier(exportfsAgissants(r.journal).length === 0,
      `E — ZERO APPLICATION : exportfs n est jamais appele avec -r, -a, -u ou -o (${exportfsAgissants(r.journal).join(' | ') || 'aucun'})`);
    verifier(/IL RESTE UNE ETAPE/.test(r.sortie),
      'E : l etape manuelle restante est annoncee, et non passee sous silence');
    verifier(/removes entries|RETIRE/.test(r.sortie),
      'E : le script dit ce que « exportfs -ra » fait vraiment — il applique ET il retire');
    const lignesE = lignesJson(be);
    verifier(/ecrit, compare, relu/.test(JSON.stringify(lignesE)),
      'E : le rapport dit que le fichier a ete compare ET relu, et non seulement ecrit');
    const suite = lignesE.find((x) => x.controle === 'Application');
    verifier(suite !== undefined && suite.etat === 'ATTENTION',
      `E : l application non faite est rapportee en ATTENTION (obtenu ${suite ? suite.etat : 'ABSENTE'})`);
  } finally { M.detruireBac(be); }

  // --- E2 : all_squash et lecture seule ------------------------------------
  const { bac: be2, cheminExports: ce2, cheminExport: pe2 } = bacNfs('E2');
  try {
    const avant = lire(ce2);
    M.executer(be2, creerScript(ce2, {
      chemin: pe2, confirmation: pe2, ecriture: 'Non', squashTous: 'Oui',
    }), { env: envBac(be2) });
    const ajout = lire(ce2).slice(avant.length);
    verifier(/\(ro,sync,root_squash,no_subtree_check,all_squash\)/.test(ajout),
      `E2 : les options suivent le formulaire, « ro » compris (ajout : ${ajout.trim().split('\n').pop()})`);
  } finally { M.detruireBac(be2); }

  // --- F : CONTRE-ÉPREUVE DU VERROU ----------------------------------------
  // Le formulaire refuse « * » et no_root_squash. La question que cette passe
  // pose est l'autre : si une modification du générateur les laissait passer,
  // le SCRIPT refuserait-il ? On trafique donc la ligne dans le script généré,
  // exactement là où le générateur l'écrit, et on exige zéro écriture.
  for (const [nom, ligneTrafiquee, motifAttendu] of [
    ['F1 etoile', '/srv/nfs/partage *(rw,sync,root_squash,no_subtree_check)', /exporte vers/],
    ['F2 no_root_squash', '/srv/nfs/partage 192.168.30.0/24(rw,sync,no_root_squash,no_subtree_check)', /no_root_squash/],
    ['F3 prefixe zero', '/srv/nfs/partage 0.0.0.0/0(rw,sync,root_squash,no_subtree_check)', /prefixe \/0/],
    ['F4 root_squash absent', '/srv/nfs/partage 192.168.30.0/24(rw,sync,no_subtree_check)', /ne porte pas root_squash/],
  ]) {
    const { bac: bf, cheminExports: cf, cheminExport: pf } = bacNfs(nom.slice(0, 2));
    try {
      const avant = lire(cf);
      let texte = creerScript(cf, { chemin: pf, confirmation: pf });
      const ancre = texte.match(/^KJEMO_LIGNE='[^\n]*'$/m);
      if (!ancre) {
        fail(`${nom} : la ligne KJEMO_LIGNE est introuvable dans le script genere`);
      } else {
        texte = texte.replace(ancre[0], `KJEMO_LIGNE='${ligneTrafiquee}'`);
        const r = M.executer(bf, texte, { env: envBac(bf) });
        verifier(lire(cf) === avant,
          `${nom} — ZERO ECRITURE : la contre-epreuve du script refuse la ligne trafiquee`);
        verifier(sauvegardes(bf).length === 0, `${nom} — ZERO SAUVEGARDE`);
        verifier(motifAttendu.test(r.sortie),
          `${nom} : le motif refuse est NOMME dans la sortie`);
        verifier(/defaut du generateur/.test(r.sortie),
          `${nom} : le rapport dit que ce refus signale un defaut du generateur, et non une faute de saisie`);
        verifier(exportfsAgissants(r.journal).length === 0, `${nom} — ZERO exportfs agissant`);
      }
    } finally { M.detruireBac(bf); }
  }
}

// ===========================================================================
console.log('');
console.log('Passe G — ce que le FORMULAIRE refuse avant toute generation');
// ===========================================================================
{
  const base = { chemin: '/srv/nfs/partage', client: '192.168.30.0/24', ecriture: 'Oui', squashTous: 'Non', confirmation: '', format: 'Console' };
  for (const [quoi, champs, champFautif] of [
    ['le client « * »', { client: '*' }, 'client'],
    ['un joker de domaine', { client: '*.labo.local' }, 'client'],
    ['un point d interrogation', { client: 'poste?.labo.local' }, 'client'],
    ['le prefixe /0', { client: '0.0.0.0/0' }, 'client'],
    ['la racine /', { chemin: '/' }, 'chemin'],
    ['la zone systeme /etc', { chemin: '/etc' }, 'chemin'],
    ['les dossiers personnels /home', { chemin: '/home' }, 'chemin'],
    ['un chemin avec une espace', { chemin: '/srv/nfs/mes donnees' }, 'chemin'],
  ]) {
    const errors = creer.validate({ ...base, ...champs });
    verifier(typeof errors[champFautif] === 'string' && errors[champFautif].length > 20,
      `G : ${quoi} est refuse par le formulaire, avec une explication`);
  }
  // Contre-épreuve : les valeurs légitimes passent, donc le verrou ne refuse
  // pas tout.
  for (const [quoi, champs] of [
    ['une adresse seule', { client: '192.168.30.50' }],
    ['un reseau /24', { client: '192.168.30.0/24' }],
    ['un nom d hote', { client: 'poste-labo.kjemo.local' }],
    ['un dossier de donnees', { chemin: '/srv/nfs/partage' }],
    ['un dossier sous /mnt', { chemin: '/mnt/voisin' }],
  ]) {
    const errors = creer.validate({ ...base, ...champs });
    verifier(Object.keys(errors).length === 0,
      `G — CONTRE-EPREUVE : ${quoi} passe (${JSON.stringify(errors)})`);
  }
  // Et la preuve qu'aucun champ n'offre no_root_squash.
  for (const t of [prerequis, creer]) {
    const champs = JSON.stringify(t.fields ?? []).toLowerCase();
    verifier(!/no_root_squash/.test(champs),
      `G : ${t.id} — aucun champ du formulaire n offre no_root_squash`);
    verifier(!/mot de passe|password|secret/.test(champs),
      `G : ${t.id} — aucun champ de mot de passe`);
  }
}

// ===========================================================================
console.log('');
console.log('Passe H — le TEXTE des jeux : jamais d application, jamais no_root_squash');
// ===========================================================================
{
  const jeux = [
    { chemin: '/srv/nfs/partage', client: '192.168.30.0/24', ecriture: 'Oui', squashTous: 'Non', confirmation: '/srv/nfs/partage', cheminEnvisage: '/srv/nfs/partage', clientEnvisage: '192.168.30.0/24', format: 'Console' },
    { chemin: '/srv/nfs/archives', client: '10.0.0.5', ecriture: 'Non', squashTous: 'Oui', confirmation: '', cheminEnvisage: '', clientEnvisage: '', format: 'JSON' },
    { chemin: '/mnt/labo', client: 'poste-labo.kjemo.local', ecriture: 'Oui', squashTous: 'Non', confirmation: '/mnt/labo', cheminEnvisage: '/mnt/labo', clientEnvisage: 'poste-labo.kjemo.local', format: 'CSV' },
  ];
  const MOTIFS = [
    // Le cœur du commit : aucun appel qui APPLIQUE. On cherche exportfs suivi
    // d'une option contenant r, a, u ou o — et « -v » et « -s » restent
    // permis, puisqu'ils lisent.
    [/\bexportfs\s+-[a-z]*[raou]/, 'aucun appel a exportfs qui applique ou retire'],
    [/\bno_root_squash\b/, 'aucun no_root_squash ecrit dans le code'],
    [/\bsystemctl\s+(restart|reload|start|stop|enable|disable)\b/, 'aucun service demarre, arrete ou recharge'],
    [/\bufw\s+(allow|deny|delete|enable|disable)\b/, 'aucun port ouvert'],
    [/\bmount\s+-t\s+nfs\b/, 'aucun montage effectue par le script'],
    [/\bmkdir\b[^\n]*\/srv|\bmkdir\b[^\n]*\/mnt/, 'aucun dossier cree hors du dossier temporaire'],
    [/\bchmod\b|\bchown\b|\bchgrp\b/, 'aucune permission modifiee'],
  ];
  for (const t of [prerequis, creer]) {
    for (const [i, jeuBase] of jeux.entries()) {
      const champs = new Set((t.fields ?? []).map((f) => f.id));
      const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
      for (const [k, val] of Object.entries(jeuBase)) if (champs.has(k)) jeu[k] = val;
      const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
      for (const [motif, quoi] of MOTIFS) {
        verifier(!motif.test(nu), `H : ${t.id} jeu ${i + 1} — ${quoi}`);
      }
    }
  }
  // Et la preuve que la pédagogie, elle, PARLE de ces commandes : un code nu
  // vide de « exportfs -ra » ne doit pas vouloir dire que le script se tait
  // sur son existence. C'est la contre-épreuve de la contre-épreuve.
  const jeuPlein = Object.fromEntries((creer.fields ?? []).map((f) => [f.id, f.default ?? '']));
  const complet = normalizeScriptSh(creer.generate(jeuPlein));
  verifier(/exportfs -ra/.test(complet),
    'H — CONTRE-EPREUVE : le script PARLE de « exportfs -ra » (affichage et commentaires), il ne l appelle simplement jamais');
  verifier(/no_root_squash/.test(complet),
    'H — CONTRE-EPREUVE : le script EXPLIQUE no_root_squash pour le refuser, sans jamais l ecrire dans une ligne');
}

console.log('');
if (echecs.length === 0) {
  console.log(`NFS Linux : ${ok} OK, 0 ÉCHEC(S).`);
  console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur.');
  console.log('Aucun /etc/exports réel touché — la redirection vers le bac est vérifiée,');
  console.log('et son échec arrête le banc. Aucun export appliqué, aucun montage réel,');
  console.log('aucun appel à exportfs autre que « -v ».');
  console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
  process.exit(0);
}
console.error(`NFS Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
process.exit(1);
