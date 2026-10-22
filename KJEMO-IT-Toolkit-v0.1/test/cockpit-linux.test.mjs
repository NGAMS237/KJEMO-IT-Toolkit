#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DE COCKPIT : LE SOCKET, L'ADRESSE D'ÉCOUTE, ET LE CERTIFICAT
//
// Les deux assistants du commit 20/n sont EXÉCUTÉS dans un bac à sable, avec
// dpkg-query, systemctl, ss, ufw, ip, journalctl, apt et apt-get remplacés par
// des doublures.
//
// LA PREUVE CENTRALE : ON N'APPREND PAS À CONTOURNER UN CERTIFICAT
//
// Ni « -k », ni « --insecure », ni aucune requête HTTPS n'apparaissent dans le
// code nu des deux scripts, sur chacun des jeux de données. C'est la seule
// erreur vraiment grave de ce sujet : un avertissement de certificat autosigné
// est le comportement ATTENDU, et le « réparer » en désactivant la
// vérification apprend exactement la mauvaise habitude.
//
// LES PASSES
//
//   0  aucun contournement du PATH par un chemin absolu
//   A  CONTRÔLE POSITIF : tout est en place → verdict « machine prête »
//   B  le cas du cours : le socket écoute sur le BOUCLAGE → c'est l'adresse
//      d'écoute qui est nommée, et le pare-feu est explicitement disculpé
//   C  socket inactif → refus immédiat, et rien n'est démarré
//   D  la couche certificat n'est pas lisible → la PORTÉE du rapport est dite,
//      et non passée sous silence
//   E  l'adresse tapée dans le navigateur n'est pas celle de la machine
//   F  le TEXTE des jeux : aucun -k, aucun --insecure, aucune installation,
//      aucune activation, aucun port ouvert
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur.
// Aucun paquet installé, aucune unité démarrée ou activée, aucun port ouvert,
// aucun certificat touché, aucune requête émise.
// Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync } from 'node:fs';
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
const prerequis = outil('cockpit-install-readiness');
const connexion = outil('cockpit-connection-diagnostic');

const envBac = (bac) => ({ HOME: bac.travail });
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

function lignesJson(bac) {
  const fichiers = readdirSync(bac.travail).filter((n) => n.endsWith('.json'));
  if (fichiers.length === 0) return [];
  return JSON.parse(readFileSync(join(bac.travail, fichiers[fichiers.length - 1]), 'utf8')).controles;
}
const ligneDe = (lignes, controle) => lignes.find((l) => l.controle === controle);
const etatDe = (lignes, controle) => (ligneDe(lignes, controle) ?? {}).etat ?? 'ABSENTE';
const comDe = (lignes, controle) => (ligneDe(lignes, controle) ?? {}).commentaire ?? '';

/**
 * Un bac Cockpit. Les trois réglages qui changent tout : le socket est-il
 * actif, sur quelle adresse écoute-t-il, et le pare-feu autorise-t-il ?
 */
function bacCockpit(nom, { socketActif = true, adresse = '0.0.0.0', feuOuvert = true, enabled = 'enabled' } = {}) {
  const bac = M.creerBac(nom);
  M.poserMouchard(bac, 'dpkg-query', { code: 0, sortie: 'install ok installed' });
  M.poserMouchard(bac, 'systemctl', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'is-active cockpit.socket'; then printf '%s\\n' ${sq(socketActif ? 'active' : 'inactive')}; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- 'is-enabled cockpit.socket'; then printf '%s\\n' ${sq(enabled)}; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- 'is-active cockpit.service'; then printf '%s\\n' 'inactive'; exit 3; fi",
      "if printf '%s' \"$*\" | grep -qE -- 'show cockpit.socket'; then printf '%s\\n' '[::]:9090'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'ss', {
    code: 0,
    sortie: socketActif
      ? `State  Recv-Q Send-Q Local:Port Peer:Port Process\nLISTEN 0 4096 ${adresse}:9090 0.0.0.0:* users:(("systemd",pid=1,fd=3))`
      : 'State  Recv-Q Send-Q Local:Port Peer:Port Process',
  });
  M.poserMouchard(bac, 'ufw', {
    code: 0,
    sortie: feuOuvert
      ? 'Status: active\n9090/tcp                   ALLOW       Anywhere'
      : 'Status: active\n22/tcp                     ALLOW       Anywhere',
  });
  M.poserMouchard(bac, 'ip', { code: 0, sortie: 'enp0s3           UP             192.168.30.10/24' });
  M.poserMouchard(bac, 'journalctl', { code: 0, sortie: 'cockpit-ws[800]: Using certificate: /etc/cockpit/ws-certs.d/0-self-signed.cert' });
  M.poserMouchard(bac, 'apt', { code: 0 });
  M.poserMouchard(bac, 'apt-get', { code: 0 });
  return bac;
}

/** Les comptes d'appels modifiants, communs à toutes les passes. */
function aucuneAction(r, etiquette) {
  const sys = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args);
  const sysModif = sys.filter((a) => /\b(start|stop|restart|reload|enable|disable|mask)\b/.test(a));
  verifier(sysModif.length === 0,
    `${etiquette} — ZERO systemctl modifiant (${sysModif.join(' | ') || 'aucun'})`);
  const ufw = r.journal.filter((e) => e.nom === 'ufw').map((e) => e.args);
  const ufwModif = ufw.filter((a) => /^(allow|deny|reject|limit|enable|disable|reset|reload|delete|insert)\b/.test(a));
  verifier(ufwModif.length === 0,
    `${etiquette} — ZERO ufw modifiant (${ufwModif.join(' | ') || 'aucun'})`);
  verifier(M.compterAppels(r.journal, 'apt') === 0 && M.compterAppels(r.journal, 'apt-get') === 0,
    `${etiquette} — ZERO apt : rien n est installe`);
}

// ===========================================================================
console.log('');
console.log('Passe 0 — aucun contournement du PATH par un chemin absolu');
// ===========================================================================
{
  const MOTIF_ABSOLU = /(^|[\s|(&;])\/(usr\/)?s?bin\/(systemctl|ss|ufw|ip|journalctl|dpkg-query|apt|apt-get|curl|wget)\b/m;
  for (const t of [prerequis, connexion]) {
    const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
    const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
    verifier(!MOTIF_ABSOLU.test(nu), `0 : ${t.id} n appelle aucune commande par un chemin absolu`);
  }
}

// ===========================================================================
console.log('');
console.log('Passe A — CONTROLE POSITIF : tout est en place');
// ===========================================================================
{
  const bac = bacCockpit('A');
  try {
    const texte = normalizeScriptSh(prerequis.generate({
      port: '9090', verifierCertificat: 'Oui', format: 'JSON',
    }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `A : le diagnostic des prerequis sort 0 (obtenu ${r.code})`);
    aucuneAction(r, 'A');
    const lignes = lignesJson(bac);
    verifier(lignes.length > 0, `A : le rapport JSON contient ${lignes.length} controle(s)`);
    verifier(etatDe(lignes, 'cockpit-ws') === 'OK',
      `A : le paquet est reconnu installe (obtenu ${etatDe(lignes, 'cockpit-ws')})`);
    verifier(etatDe(lignes, 'cockpit.socket') === 'OK',
      `A : le socket actif est reconnu (obtenu ${etatDe(lignes, 'cockpit.socket')})`);
    verifier(/demarre a la demande/.test(comDe(lignes, 'cockpit.service')),
      'A : le rapport dit qu un cockpit.service inactif est NORMAL — c est le piege du sujet');
    verifier(etatDe(lignes, 'Port 9090') === 'OK',
      `A : le port est trouve dans ce qui ecoute (obtenu ${etatDe(lignes, 'Port 9090')})`);
    verifier(etatDe(lignes, 'Machine prete') === 'OK',
      `A — CONTROLE POSITIF : le verdict conclut « machine prete » (obtenu ${etatDe(lignes, 'Machine prete')})`);
    verifier(/ListenStream declare/.test(JSON.stringify(lignes)),
      'A : le ListenStream declare par l unite est lu');
    verifier(/INSTALLER COCKPIT - PROCEDURE MANUELLE/.test(r.sortie),
      'A : la procedure manuelle est affichee en entier');
    const iFeu = r.sortie.indexOf('ufw allow');
    const iEnable = r.sortie.indexOf('systemctl enable --now cockpit.socket');
    verifier(iFeu > -1 && iEnable > iFeu,
      'A : la procedure AUTORISE le port avant d activer le socket — l ordre inverse coupe la session');
    verifier(/ufw delete allow/.test(r.sortie),
      'A : l annulation exacte de la regle de pare-feu figure dans la procedure');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
console.log('');
console.log('Passe B — le cas du cours : le socket ecoute sur le BOUCLAGE');
// ===========================================================================
{
  const bac = bacCockpit('B', { adresse: '127.0.0.1' });
  try {
    const texte = normalizeScriptSh(connexion.generate({
      adresseNavigateur: '192.168.30.10', port: '9090', lireJournal: 'Oui', format: 'JSON',
    }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `B : le diagnostic de connexion sort 0 (obtenu ${r.code})`);
    aucuneAction(r, 'B');
    const lignes = lignesJson(bac);
    verifier(etatDe(lignes, 'Port 9090') === 'PROBLEME',
      `B : l ecoute sur le bouclage est signalee PROBLEME (obtenu ${etatDe(lignes, 'Port 9090')})`);
    verifier(/bouclage/i.test(comDe(lignes, 'Port 9090')),
      'B : le commentaire NOMME le bouclage — le rapport Console n affiche que le commentaire');
    verifier(/pare-feu ne changera rien|pare-feu n y est pour rien/i.test(comDe(lignes, 'Port 9090')),
      'B : le pare-feu est explicitement disculpe — sans quoi on ajoute des regles pendant une heure');
    verifier(etatDe(lignes, 'Premiere couche manquante') === 'PROBLEME',
      `B : le verdict nomme une couche manquante (obtenu ${etatDe(lignes, 'Premiere couche manquante')})`);
    verifier(/adresse d ecoute/.test(ligneDe(lignes, 'Premiere couche manquante')?.valeur ?? ''),
      `B : la couche nommee est l ADRESSE d ecoute (obtenu ${ligneDe(lignes, 'Premiere couche manquante')?.valeur})`);
    verifier(etatDe(lignes, 'Les trois symptomes') === 'ATTENTION',
      'B : les trois symptomes a ne pas confondre sont rappeles');
    verifier(/Refus immediat/.test(comDe(lignes, 'Les trois symptomes'))
      && /tourne/.test(comDe(lignes, 'Les trois symptomes'))
      && /autosigne/.test(comDe(lignes, 'Les trois symptomes')),
      'B : les trois symptomes sont bien les trois — refus, delai, avertissement de certificat');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
console.log('');
console.log('Passe C — socket inactif : refus immediat, et rien n est demarre');
// ===========================================================================
{
  const bac = bacCockpit('C', { socketActif: false });
  try {
    const texte = normalizeScriptSh(connexion.generate({
      adresseNavigateur: '', port: '9090', lireJournal: 'Non', format: 'JSON',
    }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `C : le diagnostic sort 0 meme socket arrete (obtenu ${r.code})`);
    aucuneAction(r, 'C');
    const lignes = lignesJson(bac);
    verifier(etatDe(lignes, 'cockpit.socket') === 'PROBLEME',
      `C : le socket inactif est signale (obtenu ${etatDe(lignes, 'cockpit.socket')})`);
    verifier(/le demarrer l effacerait|ne demarre rien/i.test(comDe(lignes, 'cockpit.socket')),
      'C : le rapport dit POURQUOI il ne demarre rien — l etat courant est la preuve');
    verifier(/REFUS immediat/i.test(comDe(lignes, 'Premiere couche manquante')),
      'C : le symptome attendu est nomme — un refus, et non un delai d attente');
    verifier(etatDe(lignes, 'Adresse du navigateur') === 'IGNORE',
      `C : l adresse non renseignee donne IGNORE, et non OK (obtenu ${etatDe(lignes, 'Adresse du navigateur')})`);
    verifier(etatDe(lignes, 'cockpit') === 'IGNORE',
      `C : le journal non demande donne IGNORE (obtenu ${etatDe(lignes, 'cockpit')})`);
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
console.log('');
console.log('Passe D — la couche certificat n est pas lisible : la PORTEE est dite');
// ===========================================================================
{
  // Dans ce conteneur, /etc/cockpit/ws-certs.d n'existe pas. Le script doit
  // donc le DIRE, et dire que son rapport ne conclut rien sur le certificat.
  // Un rapport qui se tait sur une couche voit son silence lu comme un feu
  // vert — et c'est exactement ce que cette passe refuse.
  const bac = bacCockpit('D');
  try {
    const texte = normalizeScriptSh(prerequis.generate({
      port: '9090', verifierCertificat: 'Oui', format: 'JSON',
    }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    const lignes = lignesJson(bac);
    const etatCert = etatDe(lignes, 'ws-certs.d');
    verifier(['ATTENTION', 'IGNORE'].includes(etatCert),
      `D : une couche certificat illisible n est jamais OK (obtenu ${etatCert})`);
    verifier(etatDe(lignes, 'Portee du rapport') === 'ATTENTION',
      `D : la portee du rapport est explicitement dite (obtenu ${etatDe(lignes, 'Portee du rapport')})`);
    verifier(/ne dit donc rien sur le certificat/.test(comDe(lignes, 'Portee du rapport')),
      'D : le rapport dit qu il ne conclut RIEN sur le certificat');
    verifier(/0-self-signed\.cert/.test(r.sortie),
      'D : la procedure nomme 0-self-signed.cert et la regle de l ordre alphabetique');
    verifier(!/--insecure|(^|\s)-k(\s|$)/.test(r.sortie),
      'D : ni -k ni --insecure dans la sortie, pas meme dans la procedure');
  } finally { M.detruireBac(bac); }
}

// ===========================================================================
console.log('');
console.log('Passe E — l adresse tapee n est pas celle de la machine');
// ===========================================================================
{
  const bac = bacCockpit('E');
  try {
    const texte = normalizeScriptSh(connexion.generate({
      adresseNavigateur: '192.168.30.99', port: '9090', lireJournal: 'Non', format: 'JSON',
    }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `E : le diagnostic sort 0 (obtenu ${r.code})`);
    const lignes = lignesJson(bac);
    verifier(etatDe(lignes, 'Adresse du navigateur') === 'PROBLEME',
      `E : une adresse etrangere a la machine est signalee (obtenu ${etatDe(lignes, 'Adresse du navigateur')})`);
    verifier(/parle a une autre machine/.test(comDe(lignes, 'Adresse du navigateur')),
      'E : le commentaire dit que tout le reste du rapport est alors exact et sans objet');
  } finally { M.detruireBac(bac); }
  // Contre-epreuve : l'adresse de la machine, elle, est acceptee.
  const b2 = bacCockpit('E2');
  try {
    const texte = normalizeScriptSh(connexion.generate({
      adresseNavigateur: '192.168.30.10', port: '9090', lireJournal: 'Non', format: 'JSON',
    }));
    M.executer(b2, texte, { env: envBac(b2) });
    const lignes = lignesJson(b2);
    verifier(etatDe(lignes, 'Adresse du navigateur') === 'OK',
      `E — CONTRE-EPREUVE : la bonne adresse est acceptee (obtenu ${etatDe(lignes, 'Adresse du navigateur')})`);
  } finally { M.detruireBac(b2); }
}

// ===========================================================================
console.log('');
console.log('Passe F — le TEXTE des jeux : aucun contournement, aucune action');
// ===========================================================================
{
  const jeux = [
    { port: '9090', verifierCertificat: 'Oui', adresseNavigateur: '192.168.30.10', lireJournal: 'Oui', format: 'Console' },
    { port: '9091', verifierCertificat: 'Non', adresseNavigateur: '', lireJournal: 'Non', format: 'JSON' },
    { port: '8443', verifierCertificat: 'Oui', adresseNavigateur: 'srv-labo.kjemo.local', lireJournal: 'Oui', format: 'CSV' },
    { port: '443', verifierCertificat: 'Non', adresseNavigateur: '', lireJournal: 'Oui', format: 'Console' },
  ];
  const MOTIFS = [
    [/--insecure/, 'aucun --insecure'],
    [/(^|\s)-k(\s|$)/m, 'aucun -k'],
    [/\b(curl|wget)\b/, 'aucune requete HTTP'],
    [/\bapt(-get)?\s+(install|remove|purge)/, 'aucune installation ni suppression de paquet'],
    [/systemctl\s+(enable|disable|start|stop|restart|reload)/, 'aucun systemctl modifiant'],
    [/ufw\s+(allow|deny|enable|disable|reset|delete)/, 'aucune regle de pare-feu posee'],
    [/>\s*\/etc\//, 'aucune ecriture dans /etc'],
  ];
  for (const t of [prerequis, connexion]) {
    for (const [i, jeuBase] of jeux.entries()) {
      const champs = new Set((t.fields ?? []).map((f) => f.id));
      const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
      for (const [k, v] of Object.entries(jeuBase)) if (champs.has(k)) jeu[k] = v;
      const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
      for (const [motif, quoi] of MOTIFS) {
        verifier(!motif.test(nu), `F : ${t.id} jeu ${i + 1} — ${quoi}`);
      }
    }
  }
}

console.log('');
if (echecs.length === 0) {
  console.log(`Cockpit Linux : ${ok} OK, 0 ÉCHEC(S).`);
  console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur.');
  console.log('Aucun paquet installé, aucune unité démarrée ni activée, aucun port ouvert,');
  console.log('aucun certificat touché, aucune requête émise, et ni « -k » ni « --insecure »');
  console.log('nulle part. Ubuntu Server réel : NON EXÉCUTÉ.');
  process.exit(0);
}
console.error(`Cockpit Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
process.exit(1);
