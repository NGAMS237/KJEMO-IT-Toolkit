#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DE SAMBA : LA VALIDATION AVANT L'ÉCRITURE, ET LE RETOUR ARRIÈRE
//
// Les trois assistants du commit 21/n sont EXÉCUTÉS dans un bac à sable.
// dpkg-query, systemctl, ss, ufw, getent, pdbedit, journalctl et smbcontrol
// sont remplacés par des doublures. `testparm` est le VRAI binaire : c'est lui
// qui valide, et une doublure ne prouverait que la doublure.
//
// /etc/samba/smb.conf est REDIRIGÉ vers le bac en réécrivant la seule ligne
// `KJEMO_SMBCONF='/etc/samba/smb.conf'` du script généré. Si cette
// substitution ne s'applique pas, le banc ÉCHOUE immédiatement — sans quoi il
// écrirait dans le vrai fichier de la machine de développement.
//
// CE QUE LE BANC A TROUVÉ, ET QUI A CHANGÉ L'ASSISTANT
//
// Le code de sortie de testparm ne suffit pas. Mesuré sur le vrai binaire :
// une directive mal orthographiée fait sortir testparm en 0 en écrivant
// « Unknown parameter encountered » sur l'erreur standard. Un assistant qui
// se fierait au seul code installerait une configuration dont un réglage est
// ignoré en silence. La passe G mesure exactement ce cas.
//
// LES PASSES
//
//   0  aucun contournement du PATH par un chemin absolu
//   A  les deux assistants en lecture n'appellent AUCUNE commande modifiante
//   B  confirmation absente              → zéro écriture, zéro sauvegarde
//   C  nom de partage déjà pris          → zéro écriture
//   D  groupe ou dossier absent          → zéro écriture
//   E  CONTRÔLE POSITIF                  → sauvegarde, écriture, relecture,
//                                          rechargement, dans cet ordre
//   F  la relecture échoue               → la sauvegarde est RESTAURÉE et
//                                          aucun service n'est rechargé
//   G  testparm sort 0 en avertissant    → zéro écriture quand même
//   H  le TEXTE des jeux : aucun guest ok, aucun mot de passe, aucun smbpasswd
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur,
// avec le VRAI testparm. Aucun smb.conf réel touché, aucun service réel
// rechargé, aucun mot de passe. Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
const prerequis = outil('samba-readiness');
const creer = outil('samba-share-create');
const diag = outil('samba-diagnostic');

// ---------------------------------------------------------------------------
// PRÉREQUIS : LE VRAI testparm, OU RIEN
// ---------------------------------------------------------------------------
let testparmOk = false;
try {
  execFileSync('testparm', ['-s', '--', '/dev/null'], { stdio: ['ignore', 'pipe', 'pipe'] });
  testparmOk = true;
} catch (e) {
  // Un /dev/null vide peut faire sortir testparm en erreur ; ce qui compte est
  // qu'il soit EXÉCUTABLE. On distingue « absent » de « a refusé ce fichier ».
  testparmOk = !/ENOENT|not found/i.test(String(e.message));
}
if (!testparmOk) {
  console.error('');
  console.error('Samba Linux : NON EXÉCUTÉ — testparm est introuvable, et une doublure');
  console.error('ne prouverait que la doublure. Le banc ne se déclare pas vert sans');
  console.error('avoir rien validé.');
  console.error('  Installe samba-common-bin (« apt-get install -y samba-common-bin ») et relance.');
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

const SMBCONF_SAIN = `[global]
   workgroup = KJEMO
   server string = Serveur de labo
   map to guest = Never

[existant]
   path = /srv/existant
   read only = yes
`;

/**
 * Redirige /etc/samba/smb.conf vers le bac, et échoue bruyamment si la
 * substitution n'a pas eu lieu. Sans ce garde-fou, le banc écrirait dans le
 * vrai fichier de la machine de développement.
 */
function rediriger(texte, chemin) {
  const avant = texte;
  const apres = texte.replace("KJEMO_SMBCONF='/etc/samba/smb.conf'", `KJEMO_SMBCONF='${chemin}'`);
  if (apres === avant) {
    fail('la redirection de /etc/samba/smb.conf vers le bac a echoue : le banc ecrirait dans le vrai fichier');
    process.exit(1);
  }
  return apres;
}

/**
 * Un bac Samba. Les réglages qui changent le résultat : le contenu de
 * smb.conf, l'existence du groupe et du dossier, et l'état de smbd.
 */
function bacSamba(nom, {
  smbconf = SMBCONF_SAIN,
  groupeExiste = true,
  dossierExiste = true,
  smbdActif = true,
  modeDossier = 0o2775,
  groupeDossier = null,
} = {}) {
  const bac = M.creerBac(nom);
  const cheminConf = join(bac.travail, 'smb.conf');
  writeFileSync(cheminConf, smbconf, 'utf8');
  const cheminPartage = join(bac.travail, 'partage');
  if (dossierExiste) {
    mkdirSync(cheminPartage, { recursive: true });
    chmodSync(cheminPartage, modeDossier);
  }
  M.poserMouchard(bac, 'dpkg-query', { code: 0, sortie: 'install ok installed' });
  M.poserMouchard(bac, 'systemctl', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'is-active smbd'; then printf '%s\\n' ${sq(smbdActif ? 'active' : 'inactive')}; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- 'is-active nmbd'; then printf '%s\\n' 'active'; exit 0; fi",
      "if printf '%s' \"$*\" | grep -qE -- 'is-enabled'; then printf '%s\\n' 'enabled'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'ss', {
    code: 0,
    sortie: 'Netid State Recv-Q Send-Q Local:Port Peer:Port Process\ntcp LISTEN 0 50 0.0.0.0:445 0.0.0.0:* users:(("smbd",pid=9,fd=4))',
  });
  M.poserMouchard(bac, 'ufw', { code: 0, sortie: 'Status: active\nSamba                      ALLOW       Anywhere' });
  M.poserMouchard(bac, 'getent', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '^group'; then ${groupeExiste ? "printf '%s\\n' 'partage:x:1500:blaise,claire'; exit 0" : 'exit 2'}; fi`,
      "if printf '%s' \"$*\" | grep -qE -- '^passwd'; then printf '%s\\n' 'blaise:x:1000:1000:Blaise:/home/blaise:/bin/bash'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'pdbedit', { code: 0, sortie: 'blaise:1000:Blaise' });
  M.poserMouchard(bac, 'journalctl', { code: 0, sortie: 'smbd[9]: Loaded services file OK.' });
  M.poserMouchard(bac, 'smbcontrol', { code: 0 });
  // « id » délègue : sans cela le contrôle de privilèges lirait un faux
  // identifiant et le script s'arrêterait avant toute mesure.
  M.poserMouchard(bac, 'id', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '-nG'; then printf '%s\\n' 'blaise partage'; exit 0; fi",
      'exec /usr/bin/id "$@"',
    ],
  });
  return { bac, cheminConf, cheminPartage, groupeDossier };
}

const sauvegardes = (bac) => readdirSync(bac.travail).filter((n) => /\.kjemo-.*\.bak$/.test(n));
const lireConf = (chemin) => readFileSync(chemin, 'utf8');

// ===========================================================================
console.log('');
console.log('Passe 0 — aucun contournement du PATH par un chemin absolu');
// ===========================================================================
{
  const MOTIF = /(^|[\s|(&;])\/(usr\/)?s?bin\/(testparm|smbcontrol|pdbedit|smbpasswd|systemctl|ss|ufw|getent|dpkg-query|journalctl|stat)\b/m;
  for (const t of [prerequis, creer, diag]) {
    const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
    const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
    verifier(!MOTIF.test(nu), `0 : ${t.id} n appelle aucune commande par un chemin absolu`);
  }
}

// ===========================================================================
console.log('');
console.log('Passe A — les deux assistants en lecture n appellent AUCUNE commande modifiante');
// ===========================================================================
{
  for (const [t, nom, champs] of [
    [prerequis, 'A1 samba-readiness', { cheminEnvisage: '', compteEnvisage: 'blaise', format: 'JSON' }],
    [diag, 'A2 samba-diagnostic', { nomPartage: 'existant', compteTeste: 'blaise', hoteTeste: '192.168.30.50', format: 'JSON' }],
  ]) {
    const { bac, cheminConf } = bacSamba(nom.slice(0, 2));
    try {
      const texte = rediriger(normalizeScriptSh(t.generate(champs)), cheminConf);
      const avant = lireConf(cheminConf);
      const r = M.executer(bac, texte, { env: envBac(bac) });
      verifier(r.code === 0, `${nom} : sort 0 (obtenu ${r.code})`);
      verifier(lireConf(cheminConf) === avant,
        `${nom} — ZERO ECRITURE : smb.conf est identique a l octet`);
      verifier(sauvegardes(bac).length === 0,
        `${nom} — aucune sauvegarde creee : un diagnostic n a rien a sauvegarder`);
      const sys = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args);
      const sysModif = sys.filter((a) => /\b(start|stop|restart|reload|enable|disable|mask)\b/.test(a));
      verifier(sysModif.length === 0, `${nom} — ZERO systemctl modifiant (${sysModif.join(' | ') || 'aucun'})`);
      verifier(M.compterAppels(r.journal, 'smbcontrol') === 0,
        `${nom} — ZERO smbcontrol : aucun rechargement`);
      const ufw = r.journal.filter((e) => e.nom === 'ufw').map((e) => e.args)
        .filter((a) => /^(allow|deny|enable|disable|reset|delete)\b/.test(a));
      verifier(ufw.length === 0, `${nom} — ZERO ufw modifiant`);
      const lignes = lignesJson(bac);
      verifier(lignes.length > 0, `${nom} : le rapport JSON contient ${lignes.length} controle(s)`);
      verifier(etatDe(lignes, 'testparm') === 'OK',
        `${nom} : le VRAI testparm valide la configuration du bac (obtenu ${etatDe(lignes, 'testparm')})`);
      verifier(/Base Samba/.test(JSON.stringify(lignes)),
        `${nom} : la base des comptes SAMBA est traitee separement de celle d Unix`);
    } finally { M.detruireBac(bac); }
  }
  // La confusion nº 1, mesurée : un compte Unix absent de la base Samba.
  const { bac, cheminConf } = bacSamba('A3');
  try {
    M.poserMouchard(bac, 'pdbedit', { code: 0, sortie: 'autre:1001:Autre' });
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      cheminEnvisage: '', compteEnvisage: 'blaise', format: 'JSON',
    })), cheminConf);
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `A3 : sort 0 (obtenu ${r.code})`);
    const lignes = lignesJson(bac);
    verifier(etatDe(lignes, 'Cote Unix') === 'OK',
      `A3 : le compte existe cote Unix (obtenu ${etatDe(lignes, 'Cote Unix')})`);
    verifier(etatDe(lignes, 'Cote Samba') === 'PROBLEME',
      `A3 — LA CONFUSION Nº 1 : un compte Unix absent de la base Samba est signale (obtenu ${etatDe(lignes, 'Cote Samba')})`);
    verifier(/smbpasswd -a/.test(comDe(lignes, 'Cote Samba')),
      'A3 : le commentaire donne la commande exacte, qui demande le mot de passe a la console');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
console.log('');
console.log('Passe B à G — samba-share-create : huit conditions, et le retour arriere');
// ===========================================================================

function creerScript(cheminConf, champs) {
  return rediriger(normalizeScriptSh(creer.generate({
    nomPartage: 'partage', chemin: '', groupe: 'partage', ecriture: 'Oui',
    hotesAutorises: '', confirmation: '', format: 'Console', ...champs,
  })), cheminConf);
}

{
  // --- B : confirmation absente -------------------------------------------
  const { bac, cheminConf, cheminPartage } = bacSamba('B');
  try {
    const avant = lireConf(cheminConf);
    const r = M.executer(bac, creerScript(cheminConf, { chemin: cheminPartage, confirmation: '' }),
      { env: envBac(bac) });
    verifier(r.code === 0, `B : le script sort 0 sans confirmation (obtenu ${r.code})`);
    verifier(lireConf(cheminConf) === avant, 'B — ZERO ECRITURE sans confirmation');
    verifier(sauvegardes(bac).length === 0,
      `B — ZERO SAUVEGARDE : un script qui n ira pas jusqu a ecrire ne laisse pas de .bak (trouve : ${sauvegardes(bac).join(', ') || 'aucun'})`);
    verifier(/confirmation ne reprend pas exactement/.test(r.sortie),
      'B : la condition manquante est NOMMEE');
    verifier(/APERCU EXACT DE LA SECTION/.test(r.sortie),
      'B : l apercu est affiche quand meme — on doit pouvoir LIRE sans avoir confirme');
    verifier(M.compterAppels(r.journal, 'smbcontrol') === 0, 'B — ZERO rechargement');
  } finally { M.detruireBac(bac); }

  // --- C : nom déjà pris ---------------------------------------------------
  const { bac: bc, cheminConf: cc, cheminPartage: pc } = bacSamba('C');
  try {
    const avant = lireConf(cc);
    const r = M.executer(bc, creerScript(cc, { nomPartage: 'existant', chemin: pc, confirmation: 'existant' }),
      { env: envBac(bc) });
    verifier(lireConf(cc) === avant, 'C — ZERO ECRITURE quand le nom de partage existe deja');
    verifier(sauvegardes(bc).length === 0, 'C — ZERO SAUVEGARDE');
    verifier(/existe DEJA|du meme nom existe deja/.test(r.sortie),
      'C : le refus dit que la section existe deja, et pourquoi c est un refus');
    verifier(/derniere lue gagne/.test(r.sortie),
      'C : le rapport explique que deux sections du meme nom se recouvrent EN SILENCE');
  } finally { M.detruireBac(bc); }

  // --- D : groupe absent, puis dossier absent ------------------------------
  const { bac: bd, cheminConf: cd, cheminPartage: pd } = bacSamba('D1', { groupeExiste: false });
  try {
    const avant = lireConf(cd);
    const r = M.executer(bd, creerScript(cd, { chemin: pd, confirmation: 'partage' }), { env: envBac(bd) });
    verifier(lireConf(cd) === avant, 'D1 — ZERO ECRITURE quand le groupe Unix n existe pas');
    verifier(sauvegardes(bd).length === 0, 'D1 — ZERO SAUVEGARDE');
    verifier(/n existe pas|groupe/i.test(r.sortie), 'D1 : le groupe manquant est nomme');
    verifier(/ouvrable par personne|que PERSONNE ne peut ouvrir/.test(r.sortie),
      'D1 : le rapport dit ce que donnerait un « valid users » sur un groupe inexistant');
  } finally { M.detruireBac(bd); }

  const { bac: bd2, cheminConf: cd2 } = bacSamba('D2', { dossierExiste: false });
  try {
    const avant = lireConf(cd2);
    const r = M.executer(bd2, creerScript(cd2, { chemin: join(bd2.travail, 'partage'), confirmation: 'partage' }),
      { env: envBac(bd2) });
    verifier(lireConf(cd2) === avant, 'D2 — ZERO ECRITURE quand le dossier a partager n existe pas');
    verifier(sauvegardes(bd2).length === 0, 'D2 — ZERO SAUVEGARDE');
    verifier(/chmod 2775/.test(r.sortie),
      'D2 : les trois commandes sont donnees, dont le setgid — celui qu on oublie');
    verifier(/ne garantit pas|pas une garantie/.test(r.sortie),
      'D2 : le rapport rappelle que testparm valide une section dont le chemin n existe pas');
  } finally { M.detruireBac(bd2); }

  // --- E : CONTRÔLE POSITIF ------------------------------------------------
  const { bac: be, cheminConf: ce, cheminPartage: pe } = bacSamba('E');
  try {
    const avant = lireConf(ce);
    const r = M.executer(be, creerScript(ce, {
      chemin: pe, confirmation: 'partage', hotesAutorises: '192.168.30.0/24', format: 'JSON',
    }), { env: envBac(be) });
    verifier(r.code === 0, `E : le controle positif sort 0 (obtenu ${r.code})`);
    const apres = lireConf(ce);
    verifier(apres !== avant, 'E — CONTROLE POSITIF : smb.conf a bien ete modifie');
    verifier(apres.startsWith(avant),
      'E — AJOUT SEUL : le contenu d origine est intact, octet pour octet, et la section est AJOUTEE a la fin');
    verifier(/^\[partage\]$/m.test(apres), 'E : la section [partage] est presente');
    verifier(/^ {3}read only = no$/m.test(apres), 'E : « read only = no » est pose — sans quoi rien ne s ecrit');
    verifier(/^ {3}create mask = 0664$/m.test(apres) && /^ {3}directory mask = 0775$/m.test(apres),
      'E : les masques sont elargis — les defauts 0744 et 0775 cassent l ecriture a plusieurs');
    verifier(/^ {3}valid users = @partage$/m.test(apres), 'E : l acces passe par le GROUPE');
    verifier(/^ {3}hosts allow = 192\.168\.30\.0\/24$/m.test(apres), 'E : la restriction par adresse est posee');
    // Le COMMENTAIRE qui explique l'absence de « guest ok » est voulu : ce
    // qu'on interdit est la DIRECTIVE, en debut de ligne.
    verifier(!/^\s*guest ok\s*=/m.test(apres),
      'E — AUCUNE directive « guest ok » n est ecrite, sous aucune condition');
    verifier(/# Aucun « guest ok »/.test(apres),
      'E : et le fichier EXPLIQUE son absence, pour celui qui le relira dans six mois');
    // La sauvegarde, et son contenu.
    const bak = sauvegardes(be);
    verifier(bak.length === 1, `E : une sauvegarde et une seule a ete creee (${bak.join(', ') || 'aucune'})`);
    if (bak.length === 1) {
      verifier(readFileSync(join(be.travail, bak[0]), 'utf8') === avant,
        'E : la sauvegarde contient EXACTEMENT le fichier d avant');
    }
    // L'ordre : sauvegarde, écriture, relecture, rechargement.
    const iApercu = r.sortie.indexOf('APERCU EXACT');
    const iSauve = r.sortie.indexOf('Sauvegarde verifiee');
    verifier(iApercu > -1 && iSauve > iApercu,
      'E : l apercu precede la sauvegarde — on lit avant que quoi que ce soit bouge');
    verifier(M.compterAppels(r.journal, 'smbcontrol') === 1,
      `E : le rechargement a eu lieu une fois (${M.compterAppels(r.journal, 'smbcontrol')})`);
    const sc = r.journal.filter((e) => e.nom === 'smbcontrol').map((e) => e.args);
    verifier(sc.every((a) => /reload-config/.test(a)),
      `E : smbcontrol est appele avec « reload-config » — un reload, pas un restart (${sc.join(' | ')})`);
    const sys = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args)
      .filter((a) => /\brestart\b/.test(a));
    verifier(sys.length === 0, 'E — ZERO redemarrage : un restart couperait les fichiers ouverts');
    // Le rapport Console n'affiche que ATTENTION, PROBLEME et IGNORE : la
    // ligne de succes se lit dans le rapport JSON, et c'est la qu'on la verifie.
    const lignesE = lignesJson(be);
    verifier(/ecrit, compare, relu/.test(JSON.stringify(lignesE)),
      'E : le rapport dit que le fichier a ete compare ET relu, et non seulement ecrit');
    // « Rechargement » est une CATEGORIE, pas un controle : le controle
    // s'appelle « smbd », nom que porte aussi la ligne de l'unite. Chercher
    // par categorie est donc la seule facon de ne pas confondre les deux.
    const rechargement = lignesE.find((x) => x.categorie === 'Rechargement');
    verifier(rechargement !== undefined && rechargement.etat === 'OK',
      `E : le rechargement est rapporte et reussi (obtenu ${rechargement ? rechargement.etat : 'ABSENTE'})`);
    verifier(rechargement !== undefined && /non un redemarrage/.test(rechargement.commentaire),
      'E : le rapport dit que c est un reload et non un restart');
    verifier(/smbpasswd -a/.test(r.sortie),
      'E : les etapes manuelles restantes sont affichees, mot de passe Samba compris');
  } finally { M.detruireBac(be); }

  // --- F : la relecture échoue → restauration ------------------------------
  // Le candidat est valide, et le fichier en service devient invalide ENTRE
  // l'écriture et la relecture. C'est le seul moyen d'éprouver le retour
  // arrière : le formulaire ne peut pas produire un candidat valide qui
  // devienne invalide tout seul. La doublure est donc ici, et le banc le dit.
  const { bac: bf, cheminConf: cf, cheminPartage: pf } = bacSamba('F');
  try {
    const avant = lireConf(cf);
    let texte = creerScript(cf, { chemin: pf, confirmation: 'partage' });
    // Après la comparaison cmp, on casse le fichier : la relecture doit alors
    // restaurer la sauvegarde et refuser de recharger.
    const ancre = '  KJEMO_RELU_CODE=0';
    if (!texte.includes(ancre)) {
      fail('F : l ancre de la relecture est introuvable dans le script genere');
    } else {
      texte = texte.replace(ancre,
        `  printf '%s\\n' '[casse' >> "\${KJEMO_SMBCONF}"\n${ancre}`);
    }
    const r = M.executer(bf, texte, { env: envBac(bf) });
    verifier(r.code !== 0, `F : le script sort en erreur quand la relecture echoue (obtenu ${r.code})`);
    verifier(/testparm REFUSE le fichier en service/.test(r.sortie),
      'F : le refus de la relecture est annonce explicitement');
    verifier(/sauvegarde a ete restauree/i.test(r.sortie),
      'F — RETOUR ARRIERE : la sauvegarde est restauree');
    verifier(lireConf(cf) === avant,
      'F — PREUVE : smb.conf est revenu EXACTEMENT a son contenu d avant');
    verifier(M.compterAppels(r.journal, 'smbcontrol') === 0,
      'F — ZERO RECHARGEMENT apres une relecture echouee : un smb.conf refuse empeche smbd de recharger');
  } finally { M.detruireBac(bf); }

  // --- G : testparm sort 0 EN AVERTISSANT ----------------------------------
  // Le défaut que le banc a trouvé. Une directive inexistante dans le fichier
  // EN SERVICE fait sortir le vrai testparm en 0, avec « Unknown parameter
  // encountered » sur l'erreur standard. L'assistant doit refuser quand même.
  const { bac: bg, cheminConf: cg, cheminPartage: pg } = bacSamba('G', {
    smbconf: `[global]\n   workgroup = KJEMO\n   directive_qui_nexiste_pas = oui\n`,
  });
  try {
    const avant = lireConf(cg);
    const r = M.executer(bg, creerScript(cg, { chemin: pg, confirmation: 'partage' }), { env: envBac(bg) });
    verifier(lireConf(cg) === avant,
      'G — ZERO ECRITURE : testparm sort 0 et AVERTIT, et l assistant refuse quand meme');
    verifier(sauvegardes(bg).length === 0, 'G — ZERO SAUVEGARDE');
    verifier(/avertissement sans echec|Unknown parameter/.test(r.sortie),
      'G : le rapport nomme l avertissement que le seul code de sortie aurait laisse passer');
    verifier(/ignore en silence|ignoree en silence/.test(r.sortie),
      'G : le rapport explique la consequence — Samba ignore la directive sans rien dire');
  } finally { M.detruireBac(bg); }
  // Contre-épreuve : une configuration saine passe, donc le contrôle n'est pas
  // un refus systématique.
  const { bac: bg2, cheminConf: cg2, cheminPartage: pg2 } = bacSamba('G2');
  try {
    const r = M.executer(bg2, creerScript(cg2, { chemin: pg2, confirmation: 'partage' }), { env: envBac(bg2) });
    verifier(/^\[partage\]$/m.test(lireConf(cg2)),
      'G — CONTRE-EPREUVE : une configuration saine passe bien, le controle ne refuse pas tout');
    verifier(r.code === 0, `G2 : sort 0 (obtenu ${r.code})`);
  } finally { M.detruireBac(bg2); }
}

// ===========================================================================
console.log('');
console.log('Passe H — le TEXTE des jeux : aucun secret, aucun guest ok');
// ===========================================================================
{
  const jeux = [
    { nomPartage: 'partage', chemin: '/srv/partage', groupe: 'partage', ecriture: 'Oui', hotesAutorises: '192.168.30.0/24', confirmation: 'partage', nomPartageDiag: 'partage', compteTeste: 'blaise', hoteTeste: '192.168.30.50', cheminEnvisage: '/srv/partage', compteEnvisage: 'blaise', format: 'Console' },
    { nomPartage: 'archives', chemin: '/srv/archives', groupe: 'archives', ecriture: 'Non', hotesAutorises: '', confirmation: '', compteTeste: '', hoteTeste: '', cheminEnvisage: '', compteEnvisage: '', format: 'JSON' },
    { nomPartage: 'labo', chemin: '/mnt/labo', groupe: 'labo', ecriture: 'Oui', hotesAutorises: '10.0.0.0/8', confirmation: 'labo', compteTeste: 'claire', hoteTeste: '10.0.0.9', cheminEnvisage: '/mnt/labo', compteEnvisage: 'claire', format: 'CSV' },
  ];
  const MOTIFS = [
    [/guest ok/, 'aucun « guest ok » dans le code'],
    [/\bsmbpasswd\b/, 'aucun appel a smbpasswd'],
    [/\bmot de passe\b/i, 'aucun mot de passe manipule dans le code'],
    [/systemctl\s+restart/, 'aucun redemarrage de service'],
    [/\bchmod\b|\bchgrp\b|\bchown\b/, 'aucune permission corrigee par le script'],
    [/\bmkdir\b[^\n]*\/srv|\bmkdir\b[^\n]*\/mnt/, 'aucun dossier cree hors du bac temporaire'],
    // Deux exclusions, et les deux ont ete trouvees par le banc lui-meme :
    // « kjemo_testparm » (precede d'un souligne) et « kjemo_dispo testparm »,
    // qui teste la PRESENCE de la commande et n'est donc pas un appel.
    [/(?<![\w_])(?<!kjemo_dispo )testparm\s+(?!-s\b)/, 'testparm n est jamais appele sans -s'],
  ];
  for (const t of [prerequis, creer, diag]) {
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
  // Et la preuve qu'aucun champ de mot de passe n'existe dans les formulaires.
  for (const t of [prerequis, creer, diag]) {
    const champs = (t.fields ?? []).map((f) => `${f.id} ${f.label}`).join(' | ').toLowerCase();
    verifier(!/mot de passe|password|secret/.test(champs),
      `H : ${t.id} — aucun champ de mot de passe dans le formulaire (${(t.fields ?? []).length} champs)`);
  }
}

console.log('');
if (echecs.length === 0) {
  console.log(`Samba Linux : ${ok} OK, 0 ÉCHEC(S).`);
  console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur,');
  console.log('avec le VRAI testparm. Aucun /etc/samba/smb.conf réel touché — la');
  console.log('redirection vers le bac est vérifiée, et son échec arrête le banc.');
  console.log('Aucun mot de passe, aucun « guest ok », aucun service réel rechargé.');
  console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
  process.exit(0);
}
console.error(`Samba Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
process.exit(1);
