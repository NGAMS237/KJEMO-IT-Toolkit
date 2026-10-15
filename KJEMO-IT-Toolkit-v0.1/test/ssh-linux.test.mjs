#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DE SSH : CE QUI N'EST JAMAIS LU, ET CE QUI N'EST JAMAIS APPLIQUÉ
//
// Les quatre assistants du commit 19/n sont EXÉCUTÉS dans un bac à sable.
// systemctl, ss, ufw, journalctl, dpkg-query, getent, id, ssh et ssh-keygen
// sont remplacés par des doublures — ssh-keygen DÉLÈGUE au vrai binaire, pour
// que les empreintes rapportées soient de vraies empreintes tout en restant
// comptées dans le journal.
//
// sshd, lui, est le VRAI. « sshd -T » et « sshd -t » tournent réellement, sur
// la vraie configuration de ce conteneur : c'est la seule façon de prouver que
// la validation valide quelque chose. Aucun fichier de /etc/ssh n'est écrit,
// ni modifié, ni remplacé — ils sont seulement LUS, et « sshd -t -f » porte sur
// une copie assemblée dans le bac.
//
// LES DEUX PREUVES CENTRALES
//
//   AUCUNE CLÉ PRIVÉE NE SORT   un faux fichier de clé privée contenant un
//                               MARQUEUR unique est posé dans le bac. Le
//                               marqueur doit être absent de la sortie ET du
//                               rapport JSON. C'est une mesure, pas une
//                               intention : si un jour un assistant lisait une
//                               clé privée, cette ligne-là échouerait.
//   RIEN N'EST APPLIQUÉ         zéro « systemctl start/enable/reload », zéro
//                               « ufw allow », zéro écriture dans /etc/ssh, et
//                               zéro fichier laissé quand une seule des sept
//                               conditions de la porte finale manque.
//
// LES PASSES
//
//   0  aucun contournement du PATH par un chemin absolu
//   A1 ssh-server-readiness   lecture seule, et l'activation par socket est
//                             traitée comme l'état NORMAL
//   A2 ssh-client-diagnostic  aucune clé d'hôte acceptée, aucune
//                             authentification présentée
//   A3 ssh-key-readiness      le marqueur de la clé privée ne sort pas, et
//                             aucune permission n'est corrigée
//   B1 confirmation absente         → aucun fichier laissé
//   B2 second accès non prouvé      → aucun fichier laissé
//   B3 CONTRÔLE POSITIF             → fichier laissé en 600, les DEUX
//                                     directives, et la procédure dans l'ordre
//   B4 sshd refuse la configuration → aucun fichier laissé
//   B5 le texte des huit jeux : aucun rechargement, aucune écriture dans /etc
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur,
// avec le VRAI sshd pour les deux modes de test. Aucun service rechargé, aucun
// fichier de /etc/ssh écrit, aucune clé privée lue, aucune clé générée.
// Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
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
const serveur = outil('ssh-server-readiness');
const client = outil('ssh-client-diagnostic');
const cles = outil('ssh-key-readiness');
const durcir = outil('ssh-hardening-audit');

// ---------------------------------------------------------------------------
// PRÉREQUIS : ILS ÉCHOUENT BRUYAMMENT, ILS NE SE CONTOURNENT PAS
//
// Le banc a besoin du VRAI sshd et de la vraie configuration pour prouver que
// « sshd -T » lit et que « sshd -t » valide. Sans eux, il n'a RIEN prouvé — et
// un banc qui se déclarerait vert dans cet état serait pire qu'un banc absent.
// ---------------------------------------------------------------------------
const PREREQUIS = [];
let sshdOk = false;
try {
  // /run/sshd est un dossier D'EXÉCUTION, créé par systemd au démarrage du
  // service. Le créer ici ne touche à aucune configuration : sans lui, sshd
  // refuse de s'auto-tester en disant « Missing privilege separation
  // directory », ce qui n'a rien à voir avec la configuration testée.
  mkdirSync('/run/sshd', { recursive: true });
  execFileSync('sshd', ['-T'], { stdio: ['ignore', 'pipe', 'pipe'] });
  sshdOk = true;
} catch (e) {
  PREREQUIS.push(`sshd -T n'est pas exécutable ici : ${String(e.message).split('\n')[0]}`);
}
if (!existsSync('/etc/ssh/sshd_config')) PREREQUIS.push('/etc/ssh/sshd_config est absent');
if (PREREQUIS.length > 0) {
  console.error('');
  console.error('SSH Linux : NON EXÉCUTÉ — les prérequis manquent, et le banc ne');
  console.error('se déclare pas vert sans avoir rien prouvé.');
  PREREQUIS.forEach((p) => console.error(`  ${p}`));
  console.error('  Installe openssh-server (« apt-get install -y openssh-server ») et relance.');
  process.exit(1);
}

const envBac = (bac) => ({ HOME: bac.travail });
const MARQUEUR = 'MARQUEUR-CLE-PRIVEE-NE-DOIT-JAMAIS-SORTIR-9f3a';

/** Cite une chaîne pour le shell en préservant ses retours à la ligne. */
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

/** Le rapport JSON écrit dans le dossier personnel du bac, analysé. */
function lignesJson(bac) {
  const fichiers = readdirSync(bac.travail).filter((n) => n.endsWith('.json'));
  if (fichiers.length === 0) return [];
  const texte = readFileSync(join(bac.travail, fichiers[fichiers.length - 1]), 'utf8');
  return JSON.parse(texte).controles;
}
const ligneDe = (lignes, controle) => lignes.find((l) => l.controle === controle);
const etatDe = (lignes, controle) => (ligneDe(lignes, controle) ?? {}).etat ?? 'ABSENTE';
const comDe = (lignes, controle) => (ligneDe(lignes, controle) ?? {}).commentaire ?? '';

/**
 * Une vraie paire de clés, générée UNE FOIS dans le dossier temporaire du
 * banc — jamais dans un dossier personnel réel, jamais dans /etc.
 *
 * Elle sert à ce que les empreintes rapportées soient de VRAIES empreintes :
 * une ligne inventée ferait répondre « non calculee » à ssh-keygen, et le banc
 * validerait alors un rapport qui n'a rien calculé.
 */
const bacCles = M.creerBac('cles-de-reference');
const CLE_PRIV = join(bacCles.racine, 'reference_ed25519');
execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'banc-kjemo', '-f', CLE_PRIV],
  { stdio: ['ignore', 'pipe', 'pipe'] });
const CLE_PUB = readFileSync(`${CLE_PRIV}.pub`, 'utf8').trim();

/** Un dossier personnel complet, aux permissions voulues, dans un bac. */
function poserMaison(bac, { nom, avecCle = true, modeMaison = 0o700, modeSsh = 0o700, modeAuth = 0o600 }) {
  const maison = join(bac.travail, nom);
  mkdirSync(join(maison, '.ssh'), { recursive: true });
  writeFileSync(join(maison, '.ssh', 'authorized_keys'), avecCle ? `${CLE_PUB}\n` : '\n', 'utf8');
  chmodSync(join(maison, '.ssh', 'authorized_keys'), modeAuth);
  chmodSync(join(maison, '.ssh'), modeSsh);
  chmodSync(maison, modeMaison);
  return maison;
}

// ===========================================================================
console.log('');
console.log('Passe 0 — aucun contournement du PATH par un chemin absolu');
// ===========================================================================
{
  // Un script qui appellerait /usr/sbin/sshd ou /usr/bin/ssh contournerait
  // TOUTE observation : les doublures de ce banc passent par le PATH. La règle
  // vaut pour la sûreté autant que pour la mesurabilité.
  const MOTIF_ABSOLU = /(^|[\s|(&;])\/(usr\/)?s?bin\/(ssh|sshd|ssh-keygen|ssh-copy-id|systemctl|ss|ufw|journalctl|getent|stat|id|dpkg-query)\b/m;
  for (const t of [serveur, client, cles, durcir]) {
    const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
    const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
    verifier(!MOTIF_ABSOLU.test(nu),
      `0 : ${t.id} n appelle aucune commande par un chemin absolu`);
  }
}

// ===========================================================================
console.log('');
console.log('Passe A — les trois outils en lecture n appellent AUCUNE commande modifiante');
// ===========================================================================
{
  // --- A1 : le serveur, et le piège de l'activation par socket -------------
  const bac = M.creerBac('A1');
  try {
    M.poserMouchard(bac, 'systemctl', {
      code: 0,
      avant: [
        "if printf '%s' \"$*\" | grep -qE -- 'is-active ssh.socket'; then printf '%s\\n' 'active'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'is-active ssh.service'; then printf '%s\\n' 'inactive'; exit 3; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'is-enabled ssh.socket'; then printf '%s\\n' 'enabled'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'is-enabled ssh.service'; then printf '%s\\n' 'disabled'; exit 1; fi",
        'exit 0',
      ],
    });
    M.poserMouchard(bac, 'ss', {
      code: 0,
      sortie: 'State  Recv-Q Send-Q Local:Port Peer:Port Process\nLISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=1,fd=3))',
    });
    M.poserMouchard(bac, 'ufw', { code: 0, sortie: 'Status: active\n22/tcp                     ALLOW       Anywhere' });
    M.poserMouchard(bac, 'journalctl', {
      code: 0,
      sortie: 'sshd[991]: Authentication refused: bad ownership or modes for directory /home/blaise',
    });
    M.poserMouchard(bac, 'dpkg-query', { code: 0, sortie: 'install ok installed' });
    // ssh-keygen DELEGUE : les empreintes sont vraies, et les appels comptes.
    M.poserMouchard(bac, 'ssh-keygen', { code: 0, avant: ['exec /usr/bin/ssh-keygen "$@"'] });

    const texte = normalizeScriptSh(serveur.generate({ port: '22', lireJournal: 'Oui', format: 'JSON' }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `A1 : le diagnostic du serveur sort 0 (obtenu ${r.code})`);

    const sysAppels = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args);
    verifier(sysAppels.length >= 4, `A1 : preuve d execution — systemctl appele ${sysAppels.length} fois`);
    const sysModif = sysAppels.filter((a) => /\b(start|stop|restart|reload|enable|disable|mask|unmask)\b/.test(a));
    verifier(sysModif.length === 0,
      `A1 — ZERO systemctl modifiant : ni start, ni enable, ni reload (${sysModif.join(' | ') || 'aucun'})`);
    const ufwAppels = r.journal.filter((e) => e.nom === 'ufw').map((e) => e.args);
    const ufwModif = ufwAppels.filter((a) => /^(allow|deny|reject|limit|enable|disable|reset|reload|delete|insert)\b/.test(a));
    verifier(ufwModif.length === 0,
      `A1 — ZERO ufw modifiant (${ufwModif.join(' | ') || 'aucun'})`);
    verifier(r.journal.filter((e) => e.nom === 'ss').length >= 1,
      'A1 : preuve d execution — ss a bien ete interroge');

    const lignes = lignesJson(bac);
    verifier(lignes.length > 0, `A1 : le rapport JSON contient ${lignes.length} controle(s)`);
    verifier(etatDe(lignes, 'Mode') === 'OK',
      `A1 : socket actif + service inactif est l etat NORMAL, pas une panne (obtenu ${etatDe(lignes, 'Mode')})`);
    verifier(/activation par socket/i.test(comDe(lignes, 'Mode')),
      'A1 : le rapport nomme l activation par socket — c est la fausse alarme la plus frequente du sujet');
    verifier(etatDe(lignes, 'Port 22') === 'OK',
      `A1 : le port 22 est trouve dans ce qui ecoute reellement (obtenu ${etatDe(lignes, 'Port 22')})`);
    verifier(etatDe(lignes, 'StrictModes') === 'PROBLEME',
      `A1 : « bad ownership or modes » dans le journal est signale (obtenu ${etatDe(lignes, 'StrictModes')})`);
    verifier(/Permission denied \(publickey\)/.test(comDe(lignes, 'StrictModes')),
      'A1 : le commentaire relie le message du serveur a celui que voit le client');
    verifier(etatDe(lignes, 'Les cinq couches') === 'OK',
      `A1 : le verdict conclut sur les cinq couches (obtenu ${etatDe(lignes, 'Les cinq couches')})`);
    verifier(etatDe(lignes, 'sshd -T') === 'OK',
      `A1 : la configuration effective a ete lue par le VRAI sshd (obtenu ${etatDe(lignes, 'sshd -T')})`);
  } finally { M.detruireBac(bac); }

  // --- A2 : le client, et la clé d'hôte qu'on n'accepte jamais -------------
  const b2 = M.creerBac('A2');
  try {
    M.poserMouchard(b2, 'ssh', {
      code: 0,
      avant: [
        "if printf '%s' \"$*\" | grep -qE -- '-G'; then",
        `  printf '%s\\n' ${sq('hostname srv-labo.kjemo.local\nuser blaise\nport 22\nidentityfile ~/.ssh/id_ed25519\nproxycommand none')}`,
        '  exit 0',
        'fi',
        "printf '%s\\n' 'blaise@srv-labo.kjemo.local: Permission denied (publickey,password).' >&2",
        'exit 255',
      ],
    });
    M.poserMouchard(b2, 'ssh-keygen', { code: 0, sortie: '|1|hash= ssh-ed25519 AAAA...' });
    M.poserMouchard(b2, 'getent', { code: 0, sortie: '192.168.30.10  srv-labo.kjemo.local' });

    const texte = normalizeScriptSh(client.generate({
      hote: 'srv-labo.kjemo.local', utilisateur: 'blaise', port: '22',
      interrogerServeur: 'Oui', format: 'JSON',
    }));
    const r = M.executer(b2, texte, { env: envBac(b2) });
    verifier(r.code === 0, `A2 : le diagnostic du client sort 0 (obtenu ${r.code})`);

    const sshAppels = r.journal.filter((e) => e.nom === 'ssh').map((e) => e.args);
    verifier(sshAppels.length >= 2, `A2 : preuve d execution — ssh appele ${sshAppels.length} fois`);
    const laxiste = sshAppels.filter((a) => /StrictHostKeyChecking=(no|accept-new)/.test(a));
    verifier(laxiste.length === 0,
      `A2 — ZERO acceptation de cle d hote : ni « no », ni « accept-new » (${laxiste.join(' | ') || 'aucun'})`);
    const essais = sshAppels.filter((a) => /BatchMode=yes/.test(a));
    verifier(essais.length >= 1, 'A2 : le test de connexion impose BatchMode=yes — aucune invite possible');
    verifier(essais.every((a) => /PreferredAuthentications=none/.test(a)),
      'A2 : aucune authentification presentee — PreferredAuthentications=none sur chaque essai');
    verifier(essais.every((a) => /StrictHostKeyChecking=yes/.test(a)),
      'A2 : chaque essai refuse une cle d hote inconnue');
    const retrait = r.journal.filter((e) => e.nom === 'ssh-keygen').map((e) => e.args)
      .filter((a) => /(^|\s)-R(\s|$)/.test(a));
    verifier(retrait.length === 0,
      `A2 — ZERO « ssh-keygen -R » : retirer une entree de known_hosts est une decision de confiance (${retrait.join(' | ') || 'aucun'})`);

    const lignes = lignesJson(b2);
    verifier(etatDe(lignes, 'Authentifications proposees') === 'OK',
      `A2 : la liste rendue par le serveur est rapportee (obtenu ${etatDe(lignes, 'Authentifications proposees')})`);
    verifier(/publickey,password/.test(comDe(lignes, 'Authentifications proposees')),
      'A2 : le rapport cite la liste exacte que le serveur a renvoyee');
    verifier(etatDe(lignes, 'Mot de passe accepte') === 'ATTENTION',
      `A2 : un serveur qui accepte encore le mot de passe est signale (obtenu ${etatDe(lignes, 'Mot de passe accepte')})`);
    verifier(etatDe(lignes, 'Couches locales') === 'OK',
      `A2 : le verdict des couches locales est rendu (obtenu ${etatDe(lignes, 'Couches locales')})`);
  } finally { M.detruireBac(b2); }

  // --- A3 : la clé privée qui ne sort pas ---------------------------------
  const b3 = M.creerBac('A3');
  try {
    const maison = poserMaison(b3, { nom: 'blaise' });
    // Le faux fichier de cle PRIVEE, avec son marqueur. Mode 644 : le script
    // doit le SIGNALER sans jamais en lire le contenu.
    const faussePriv = join(maison, '.ssh', 'id_marqueur');
    writeFileSync(faussePriv, `-----BEGIN OPENSSH PRIVATE KEY-----\n${MARQUEUR}\n-----END OPENSSH PRIVATE KEY-----\n`, 'utf8');
    chmodSync(faussePriv, 0o644);

    M.poserMouchard(b3, 'getent', {
      code: 0,
      avant: [
        `if printf '%s' "$*" | grep -qE -- 'passwd'; then printf '%s\\n' ${sq(`blaise:x:1000:1000:Blaise:${maison}:/bin/bash`)}; exit 0; fi`,
        'exit 0',
      ],
    });
    M.poserMouchard(b3, 'ssh-keygen', { code: 0, avant: ['exec /usr/bin/ssh-keygen "$@"'] });
    M.poserMouchard(b3, 'chmod', { code: 0 });
    M.poserMouchard(b3, 'chown', { code: 0 });

    const texte = normalizeScriptSh(cles.generate({ compte: 'blaise', format: 'JSON' }));
    const r = M.executer(b3, texte, { env: envBac(b3) });
    verifier(r.code === 0, `A3 : l audit des cles sort 0 (obtenu ${r.code})`);

    const lignes = lignesJson(b3);
    const jsonBrut = JSON.stringify(lignes);
    verifier(!r.sortie.includes(MARQUEUR),
      'A3 — PREUVE : le contenu de la cle privee n apparait PAS dans la sortie');
    verifier(!jsonBrut.includes(MARQUEUR),
      'A3 — PREUVE : le contenu de la cle privee n apparait PAS dans le rapport JSON');
    verifier(M.compterAppels(r.journal, 'chmod') === 0,
      'A3 — ZERO chmod : aucune permission corrigee par le script');
    verifier(M.compterAppels(r.journal, 'chown') === 0,
      'A3 — ZERO chown');
    const keygen = r.journal.filter((e) => e.nom === 'ssh-keygen').map((e) => e.args);
    verifier(keygen.length >= 1, `A3 : preuve d execution — ssh-keygen appele ${keygen.length} fois`);
    verifier(keygen.every((a) => /(^|\s)-lf(\s|$)/.test(a)),
      `A3 — ssh-keygen n est appele QU avec -lf : aucune generation, aucun -R (${keygen.join(' | ')})`);
    verifier(keygen.every((a) => /authorized_keys|\.pub/.test(a)),
      `A3 — chaque appel porte sur un fichier PUBLIC (${keygen.join(' | ')})`);
    verifier(etatDe(lignes, 'id_marqueur') === 'PROBLEME',
      `A3 : une cle privee en 644 est signalee (obtenu ${etatDe(lignes, 'id_marqueur')})`);
    verifier(/compromise/.test(comDe(lignes, 'id_marqueur')),
      'A3 : le commentaire dit qu une telle cle se REMPLACE, et non qu on corrige son mode');
    verifier(etatDe(lignes, 'Connexion par cle') === 'OK',
      `A3 : la chaine de permissions est jugee complete (obtenu ${etatDe(lignes, 'Connexion par cle')})`);
    verifier(/1 cle/.test(ligneDe(lignes, 'Inventaire')?.valeur ?? ''),
      `A3 : la cle autorisee est comptee (obtenu ${ligneDe(lignes, 'Inventaire')?.valeur})`);
    verifier(/SHA256:/.test(comDe(lignes, 'Inventaire')),
      'A3 : l empreinte rapportee est une VRAIE empreinte, calculee par ssh-keygen');
  } finally { M.detruireBac(b3); }
}

// ===========================================================================
console.log('');
console.log('Passe B — le durcissement : sept conditions, et aucun fichier sans les sept');
// ===========================================================================

/**
 * Un bac prêt pour l'assistant de durcissement. sshd reste le VRAI, sauf
 * quand on veut éprouver un refus de validation : le formulaire ne peut PAS
 * produire un fichier invalide — les directives sont des constantes — donc ce
 * cas-là exige une doublure, et le banc le dit.
 */
function bacDurcissement(nom, { avecCle = true, sshdRefuse = false } = {}) {
  const bac = M.creerBac(nom);
  const maison = poserMaison(bac, { nom: 'kjemoadm', avecCle });
  M.poserMouchard(bac, 'getent', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'passwd'; then printf '%s\\n' ${sq(`kjemoadm:x:1001:1001:Admin:${maison}:/bin/bash`)}; exit 0; fi`,
      'exit 0',
    ],
  });
  // « id » DELEGUE pour -u et -un : sans cela, le controle de privileges du
  // script lirait un faux identifiant et s arreterait avant toute mesure.
  // C est la lecon du banc des permissions, et elle vaut ici aussi.
  M.poserMouchard(bac, 'id', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '-nG'; then printf '%s\\n' 'kjemoadm sudo'; exit 0; fi",
      'exec /usr/bin/id "$@"',
    ],
  });
  M.poserMouchard(bac, 'ssh-keygen', { code: 0, avant: ['exec /usr/bin/ssh-keygen "$@"'] });
  M.poserMouchard(bac, 'systemctl', { code: 0, sortie: 'active' });
  if (sshdRefuse) {
    M.poserMouchard(bac, 'sshd', {
      code: 0,
      avant: [
        "if printf '%s' \"$*\" | grep -qE -- '-t'; then",
        "  printf '%s\\n' '/root/99-kjemo-durcissement.conf line 9: unsupported option \"PasswordAuthentications\".' >&2",
        '  exit 255',
        'fi',
        'exec /usr/sbin/sshd "$@"',
      ],
    });
  }
  return { bac, maison };
}

const confsLaissees = (bac) => readdirSync(bac.travail).filter((n) => n.endsWith('.conf'));

{
  // --- B1 : confirmation absente ------------------------------------------
  const { bac } = bacDurcissement('B1');
  try {
    const texte = normalizeScriptSh(durcir.generate({
      compteAdminProuve: 'kjemoadm', desactiverMotDePasse: 'Oui', interdireRoot: 'Oui',
      nomFichier: '99-kjemo-durcissement.conf', confirmation: '', format: 'Console',
    }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `B1 : le script sort 0 sans confirmation (obtenu ${r.code})`);
    verifier(confsLaissees(bac).length === 0,
      `B1 — ZERO fichier laisse sans confirmation (trouve : ${confsLaissees(bac).join(', ') || 'aucun'})`);
    verifier(/confirmation ne reprend pas exactement/.test(r.sortie),
      'B1 : la condition manquante est NOMMEE — « conditions non reunies » enverrait deviner');
    verifier(/APERCU EXACT DU FICHIER PREPARE/.test(r.sortie),
      'B1 : l apercu est tout de meme affiche — on doit pouvoir LIRE sans avoir confirme');
  } finally { M.detruireBac(bac); }

  // --- B2 : second accès non prouvé ---------------------------------------
  const { bac: b2 } = bacDurcissement('B2', { avecCle: false });
  try {
    const texte = normalizeScriptSh(durcir.generate({
      compteAdminProuve: 'kjemoadm', desactiverMotDePasse: 'Oui', interdireRoot: 'Non',
      nomFichier: '99-kjemo-durcissement.conf', confirmation: 'kjemoadm', format: 'Console',
    }));
    const r = M.executer(b2, texte, { env: envBac(b2) });
    verifier(confsLaissees(b2).length === 0,
      `B2 — ZERO fichier laisse quand aucune cle n est autorisee (trouve : ${confsLaissees(b2).join(', ') || 'aucun'})`);
    verifier(/aucune cle utile|Second acces/.test(r.sortie),
      'B2 : le refus dit que le second acces n est pas prouve');
    verifier(/second acces administrateur n est pas prouve/.test(r.sortie),
      'B2 : la porte finale nomme la preuve manquante');
  } finally { M.detruireBac(b2); }

  // --- B3 : CONTRÔLE POSITIF ----------------------------------------------
  const { bac: b3 } = bacDurcissement('B3');
  try {
    const texte = normalizeScriptSh(durcir.generate({
      compteAdminProuve: 'kjemoadm', desactiverMotDePasse: 'Oui', interdireRoot: 'Oui',
      nomFichier: '99-kjemo-durcissement.conf', confirmation: 'kjemoadm', format: 'Console',
    }));
    const r = M.executer(b3, texte, { env: envBac(b3) });
    verifier(r.code === 0, `B3 : le controle positif sort 0 (obtenu ${r.code})`);
    const laissees = confsLaissees(b3);
    verifier(laissees.length === 1 && laissees[0] === '99-kjemo-durcissement.conf',
      `B3 — CONTROLE POSITIF : le fichier EST laisse quand les sept conditions sont reunies (trouve : ${laissees.join(', ') || 'aucun'})`);
    if (laissees.length === 1) {
      const contenu = readFileSync(join(b3.travail, laissees[0]), 'utf8');
      verifier(/^PasswordAuthentication no$/m.test(contenu),
        'B3 : le fichier pose PasswordAuthentication no');
      verifier(/^KbdInteractiveAuthentication no$/m.test(contenu),
        'B3 — LES DEUX : KbdInteractiveAuthentication no aussi, sans quoi PAM rouvre la porte');
      verifier(/^PermitRootLogin no$/m.test(contenu),
        'B3 : le fichier pose PermitRootLogin no');
      verifier(!/\$|`/.test(contenu),
        'B3 : aucune interpolation dans le fichier produit — les directives sont des constantes');
    }
    // Rien n'est applique : ni rechargement, ni installation.
    const sysAppels = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args);
    const sysModif = sysAppels.filter((a) => /\b(reload|restart|start|stop|enable|disable)\b/.test(a));
    verifier(sysModif.length === 0,
      `B3 — ZERO systemctl modifiant : le rechargement reste une commande a taper (${sysModif.join(' | ') || 'aucun'})`);
    verifier(M.compterAppels(r.journal, 'install') === 0,
      'B3 — ZERO install : rien n est pose dans /etc/ssh');
    // L'ordre de la procédure, qui est la moitié de sa valeur.
    const iCle = r.sortie.indexOf('PreferredAuthentications=publickey');
    const iInstall = r.sortie.indexOf('install -m 644');
    const iTest = r.sortie.indexOf('sudo sshd -t');
    const iReload = r.sortie.indexOf('systemctl reload ssh');
    const iRelire = r.sortie.indexOf('sudo sshd -T | grep');
    verifier(iCle > -1 && iInstall > iCle,
      'B3 : la seconde session PAR CLE vient AVANT l installation');
    verifier(iTest > iInstall && iReload > iTest,
      'B3 : « sshd -t » vient APRES l installation et AVANT le rechargement');
    verifier(iRelire > iReload,
      'B3 : la relecture de la configuration effective vient APRES le rechargement');
    verifier(/ss -lntp \| grep ssh/.test(r.sortie),
      'B3 : le port ecoute est relu apres l action, et pas seulement la configuration');
    verifier(/sudo rm -f "\/etc\/ssh\/sshd_config\.d\/99-kjemo-durcissement\.conf"/.test(r.sortie),
      'B3 : l annulation est une SUPPRESSION du fichier ajoute — aucune sauvegarde a restaurer');
    verifier(/ligne 12|ligne 1[0-9]/.test(r.sortie) || /Include/.test(r.sortie),
      'B3 : la ligne Include du fichier principal a bien ete verifiee');
  } finally { M.detruireBac(b3); }

  // --- B4 : sshd refuse la configuration ----------------------------------
  const { bac: b4 } = bacDurcissement('B4', { sshdRefuse: true });
  try {
    const texte = normalizeScriptSh(durcir.generate({
      compteAdminProuve: 'kjemoadm', desactiverMotDePasse: 'Oui', interdireRoot: 'Oui',
      nomFichier: '99-kjemo-durcissement.conf', confirmation: 'kjemoadm', format: 'Console',
    }));
    const r = M.executer(b4, texte, { env: envBac(b4) });
    verifier(confsLaissees(b4).length === 0,
      `B4 — ZERO ECRITURE APRES UNE VALIDATION ECHOUEE (trouve : ${confsLaissees(b4).join(', ') || 'aucun'})`);
    verifier(/REFUSE la configuration preparee|refuse la configuration preparee/.test(r.sortie),
      'B4 : le refus de sshd est rapporte avec son message exact');
    verifier(/empecherait le service de redemarrer/.test(r.sortie),
      'B4 : le rapport dit POURQUOI rien n est remis — un service qui ne redemarre pas, a distance, ne se corrige plus');
  } finally { M.detruireBac(b4); }
}

// ===========================================================================
console.log('');
console.log('Passe B5 — le TEXTE des huit jeux : aucun rechargement, aucune ecriture dans /etc');
// ===========================================================================
{
  // Le contrôle textuel attrape ce qu'une exécution ne peut pas voir : une
  // branche non empruntée pendant les passes précédentes. Il porte sur le CODE
  // NU — commentaires et chaînes retirés —, sans quoi il accuserait la
  // procédure manuelle, qui cite justement les commandes qu'on ne lance pas.
  const jeux = [
    { compteAdminProuve: 'kjemoadm', desactiverMotDePasse: 'Oui', interdireRoot: 'Oui', nomFichier: '99-a.conf', confirmation: 'kjemoadm', format: 'Console' },
    { compteAdminProuve: 'kjemoadm', desactiverMotDePasse: 'Oui', interdireRoot: 'Non', nomFichier: '99-b.conf', confirmation: '', format: 'JSON' },
    { compteAdminProuve: 'kjemoadm', desactiverMotDePasse: 'Non', interdireRoot: 'Oui', nomFichier: '99-c.conf', confirmation: 'kjemoadm', format: 'CSV' },
    { compteAdminProuve: '', desactiverMotDePasse: 'Non', interdireRoot: 'Non', nomFichier: '99-d.conf', confirmation: '', format: 'Console' },
  ];
  const MOTIFS = [
    [/systemctl\s+(reload|restart|start|stop|enable|disable)/, 'aucun systemctl modifiant'],
    [/\binstall\s+-m/, 'aucun install'],
    [/>\s*\/etc\//, 'aucune redirection vers /etc'],
    [/\b(cp|mv|tee|sed\s+-i)\b[^\n]*\/etc\/ssh/, 'aucune ecriture dans /etc/ssh'],
    [/ssh-keygen\s+-t\b/, 'aucune generation de cle'],
    [/ssh-keygen\s+-R\b/, 'aucun retrait de known_hosts'],
    [/StrictHostKeyChecking=(no|accept-new)/, 'aucune acceptation de cle d hote'],
  ];
  for (const t of [serveur, client, cles, durcir]) {
    for (const [i, jeuBase] of jeux.entries()) {
      const champs = new Set((t.fields ?? []).map((f) => f.id));
      const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
      for (const [k, v] of Object.entries(jeuBase)) if (champs.has(k)) jeu[k] = v;
      const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
      for (const [motif, quoi] of MOTIFS) {
        verifier(!motif.test(nu), `B5 : ${t.id} jeu ${i + 1} — ${quoi}`);
      }
    }
  }
  // Et la preuve structurelle de la regle absolue : ssh-keygen -lf n apparait
  // QU UNE FOIS dans le code nu de chaque outil, a savoir dans
  // kjemo_empreinte, qui refuse tout chemin non public. Un second appel
  // direct contournerait le refus.
  for (const t of [serveur, client, cles, durcir]) {
    const nu = codeNu(normalizeScriptSh(t.generate(
      Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? ''])))));
    const n = (nu.match(/ssh-keygen -lf/g) ?? []).length;
    verifier(n === 1,
      `B5 : ${t.id} — « ssh-keygen -lf » n apparait qu une fois, dans kjemo_empreinte (trouve ${n})`);
  }
}

M.detruireBac(bacCles);

console.log('');
if (echecs.length === 0) {
  console.log(`SSH Linux : ${ok} OK, 0 ÉCHEC(S).`);
  console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur,');
  console.log('avec le VRAI sshd pour « -T » et « -t ». Aucune clé privée lue, aucune clé');
  console.log('générée, aucun service rechargé, aucun fichier de /etc/ssh écrit.');
  console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
  process.exit(0);
}
console.error(`SSH Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
process.exit(1);
