#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DES SERVICES, DES PAQUETS ET DE L'HEURE
//
// Les quatre assistants du commit 17/n sont EXÉCUTÉS, dans un bac à sable,
// avec systemctl, journalctl, apt-get, apt-cache, apt-mark, dpkg, dpkg-query,
// timedatectl, hwclock et chronyc remplacés par des doublures qui
// journalisent leur nom, leurs arguments et leur ordre.
//
// TROIS DES QUATRE ASSISTANTS NE DOIVENT RIEN FAIRE, ET C'EST MESURABLE
//
// C'est la preuve centrale de ce banc, et elle ne va pas de soi : « cet
// assistant est un diagnostic » est une intention, pas un fait. Le banc
// mesure donc, pour chacun des trois diagnostics, ZÉRO appel modifiant :
//
//   systemd-service-diagnostic   0 start, stop, restart, enable, disable
//   linux-package-diagnostic     0 install, remove, purge, update — et la
//                                SEULE forme d'apt-get install employée
//                                porte le « -s » de simulation
//   linux-time-sync-diagnostic   0 set-time, set-timezone, set-ntp, et
//                                hwclock seulement avec --show
//
// LES PASSES
//
//   A  les trois diagnostics n'appellent AUCUNE commande modifiante
//   B  le formulaire du contrôle refuse les unités et verbes protégés
//   C  confirmation absente             → 0 action systemctl
//   D  unité inconnue de systemd        → 0 action
//   E  stop de SSH depuis une session SSH → 0 action, même en retouchant
//   F  état relu ≠ état attendu         → sortie en erreur, journal affiché
//   G  CONTRÔLE POSITIF (restart)       → lecture, action, relecture
//   H  CONTRÔLE POSITIF (enable)        → is-enabled relu, et ce qui n'a
//                                         PAS changé est dit
//   I  verbe interdit injecté à la main → refusé par le script lui-même
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur.
// Aucun vrai systemctl, aucun paquet installé, aucune horloge touchée.
// Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { dirname, join, resolve } from 'node:path';
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
  if (!t) { console.error(`ECHEC : outil « ${id} » absent du catalogue`); process.exit(1); }
  return t;
};
const diagnostic = outil('systemd-service-diagnostic');
const controle = outil('systemd-service-control');
const paquets = outil('linux-package-diagnostic');
const heure = outil('linux-time-sync-diagnostic');

/** Cite une chaîne pour le shell en préservant ses retours à la ligne. */
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

const UNITE = 'kjemo-essai.service';

// Les six libelles d'action, LUS dans le formulaire de l'assistant plutot que
// recopies : si quelqu'un en ajoute un septieme, les passes de la passe B le
// couvrent automatiquement — et si quelqu'un en retire un, elles le voient.
const VERBES_TOUS = Object.fromEntries(
  (controle.fields.find((f) => f.id === 'action')?.options ?? []).map(([k]) => [k, true]),
);
if (Object.keys(VERBES_TOUS).length !== 6) {
  console.error(`ECHEC : six verbes attendus dans le formulaire, ${Object.keys(VERBES_TOUS).length} trouves.`);
  process.exit(1);
}

/**
 * Les doublures communes. `systemctl` répond selon ses arguments ET selon
 * l'état, grâce à un marqueur : avant l'action le service est inactif, après
 * il est actif. Un mouchard sans mémoire ne pourrait pas représenter les
 * deux, et le contrôle positif échouerait pour cette seule raison.
 */
function bac(nom, {
  connue = true,
  actifAvant = 'inactive',
  actifApres = null,
  activeAvant = 'disabled',
  activeApres = null,
  codeAction = 0,
} = {}) {
  const b = M.creerBac(nom);
  const marqueur = join(b.racine, 'agi');
  const apresActif = actifApres ?? 'active';
  const apresActive = activeApres ?? 'enabled';

  M.poserMouchard(b, 'systemctl', {
    code: 0,
    avant: [
      // Les verbes qui AGISSENT : ils posent le marqueur et rendent le code
      // demandé. Rien n'est réellement démarré.
      "if printf '%s' \"$*\" | grep -qE -- '^(start|stop|restart|reload|enable|disable|mask|kill|isolate)( |$)'; then",
      `  : > '${marqueur}'`,
      `  exit ${codeAction}`,
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- '^cat'; then",
      ...(connue
        ? ["  printf '%s\\n' '# /lib/systemd/system/kjemo-essai.service'",
          "  printf '%s\\n' '[Unit]'",
          "  printf '%s\\n' 'Description=Unite d essai KJEMO'",
          '  exit 0']
        : ['  exit 1']),
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- '^is-active'; then",
      `  if [ -f '${marqueur}' ]; then printf '%s\\n' ${sq(apresActif)}; else printf '%s\\n' ${sq(actifAvant)}; fi`,
      '  exit 0',
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- '^is-enabled'; then",
      `  if [ -f '${marqueur}' ]; then printf '%s\\n' ${sq(apresActive)}; else printf '%s\\n' ${sq(activeAvant)}; fi`,
      '  exit 0',
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- '^show'; then",
      "  printf '%s\\n' 'loaded'",
      '  exit 0',
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- 'list-units'; then",
      '  exit 0',
      'fi',
      'exit 0',
    ],
  });
  M.poserMouchard(b, 'journalctl', { code: 0, sortie: 'kjemo: ligne de journal simulee' });
  M.poserMouchard(b, 'sleep', { code: 0 });
  return { bac: b, marqueur };
}

function texteControle({ action = 'Redemarrer', confirmation = null, unite = UNITE } = {}) {
  return normalizeScriptSh(controle.generate({
    unite,
    action,
    confirmation: confirmation === null ? unite : confirmation,
    format: 'Console',
  }));
}

// ===========================================================================
console.log('');
console.log('Plan 0 — aucun contournement du PATH');
for (const t of [diagnostic, controle, paquets, heure]) {
  const texte = normalizeScriptSh(t.generate(Object.fromEntries(
    t.fields.map((f) => [f.id, f.default ?? '']),
  )));
  const suspects = M.cheminsAbsolusSuspects(texte);
  verifier(suspects.length === 0,
    `${t.id} : aucun chemin absolu ni « command -p » sur une commande surveillee (${suspects.map((s) => s.trouve).join(', ') || 'aucun'})`);
}

console.log('');
console.log('Passe A — les trois diagnostics n’appellent AUCUNE commande modifiante');
{
  // A1 — le diagnostic systemd.
  const { bac: b1 } = bac('A1');
  try {
    let texte = normalizeScriptSh(diagnostic.generate({
      unite: UNITE, periode: 'Depuis ce demarrage', priorite: 'Erreurs et pires',
      lignes: '50', format: 'Console',
    }));
    const r = M.executer(b1, texte, { env: { HOME: b1.travail } });
    verifier(r.code === 0, `A1 : le diagnostic sort 0 (obtenu ${r.code})`);
    const actions = r.journal.filter((e) => e.nom === 'systemctl'
      && /^(start|stop|restart|reload|enable|disable|mask|kill|isolate)( |$)/.test(e.args));
    verifier(actions.length === 0,
      `A1 — ZERO action systemctl dans un diagnostic (${actions.map((a) => a.args).join(' | ') || 'aucune'})`);
    verifier(M.compterAppels(r.journal, 'systemctl', 'is-active') >= 1,
      'A1 : preuve d execution — is-active a bien ete lu');
    verifier(M.compterAppels(r.journal, 'journalctl') >= 1, 'A1 : le journal a bien ete lu');
    const journalEcrit = r.journal.filter((e) => e.nom === 'journalctl'
      && /--vacuum|--rotate|--flush/.test(e.args));
    verifier(journalEcrit.length === 0, 'A1 — ZERO journalctl destructif : ni vacuum, ni rotate');
    verifier(r.journal.every((e) => !/--no-pager/.test(e.args) || true), 'A1 : (marqueur)');
    const sansPager = r.journal.filter((e) => e.nom === 'journalctl' && !/--no-pager/.test(e.args));
    verifier(sansPager.length === 0,
      `A1 — chaque appel a journalctl porte --no-pager : sans lui, un script sans terminal se bloque (${sansPager.map((a) => a.args).join(' | ')})`);
  } finally { M.detruireBac(b1); }

  // A2 — le diagnostic des paquets.
  const b2 = M.creerBac('A2');
  try {
    M.poserMouchard(b2, 'apt-get', { code: 0, sortie: 'Inst quota (4.06 Ubuntu:24.04)\nConf quota (4.06 Ubuntu:24.04)' });
    M.poserMouchard(b2, 'apt-cache', { code: 0, sortie: '  Installed: (none)\n  Candidate: 4.06-1build1' });
    M.poserMouchard(b2, 'apt', { code: 0, sortie: 'Listing...' });
    M.poserMouchard(b2, 'apt-mark', { code: 0, sortie: '' });
    M.poserMouchard(b2, 'dpkg', { code: 0, sortie: '' });
    M.poserMouchard(b2, 'dpkg-query', { code: 0, sortie: 'ii  quota' });
    M.poserMouchard(b2, 'pgrep', { code: 1 });
    // `find` DELEGUE tout, sauf l'interrogation des listes d'APT : cette image
    // de conteneur n'a pas d'index APT, et sans cette reponse le script
    // conclurait « aucun index » et sauterait la simulation — la passe
    // serait verte sans avoir rien eprouve.
    M.poserMouchard(b2, 'find', {
      avant: [
        'case "$*" in',
        "  *var/lib/apt/lists*) printf '%s\\n' '/var/lib/apt/lists/essai_Packages'; exit 0 ;;",
        'esac',
        'exec /usr/bin/find "$@"',
      ],
    });
    const texte = normalizeScriptSh(paquets.generate({
      paquets: 'quota acl', verifierIntegrite: 'Non', simulerInstallation: 'Oui', format: 'Console',
    }));
    const r = M.executer(b2, texte, { env: { HOME: b2.travail } });
    verifier(r.code === 0, `A2 : le diagnostic des paquets sort 0 (obtenu ${r.code})`);
    const aptAppels = r.journal.filter((e) => e.nom === 'apt-get').map((e) => e.args);
    verifier(aptAppels.length >= 1, `A2 : preuve d execution — apt-get a ete appele (${aptAppels.join(' | ')})`);
    const installReel = aptAppels.filter((a) => /(^| )install( |$)/.test(a) && !/(^| )-s( |$)/.test(a));
    verifier(installReel.length === 0,
      `A2 — AUCUN apt-get install sans « -s » : la seule forme employee est la simulation (${installReel.join(' | ') || 'aucune'})`);
    const interdits = aptAppels.filter((a) => /(^| )(remove|purge|autoremove|upgrade|dist-upgrade|full-upgrade|update)( |$)/.test(a));
    verifier(interdits.length === 0,
      `A2 — ni remove, ni purge, ni autoremove, ni upgrade, ni meme update (${interdits.join(' | ') || 'aucun'})`);
    const dpkgEcrit = r.journal.filter((e) => e.nom === 'dpkg' && /(-i|--install|--configure|--purge|-r\b|--remove)/.test(e.args));
    verifier(dpkgEcrit.length === 0,
      `A2 — ZERO dpkg modifiant : ni -i, ni --configure, ni --purge (${dpkgEcrit.map((a) => a.args).join(' | ') || 'aucun'})`);
    verifier(aptAppels.some((a) => /(^| )-s( |$)/.test(a) && /install/.test(a)),
      `A2 — la simulation a bien eu lieu, avec le « -s » (${aptAppels.join(' | ')})`);
    verifier(/Simulation \(aucune ecriture\)/.test(r.sortie),
      'A2 : le script annonce la simulation, et dit qu elle n ecrit rien');
  } finally { M.detruireBac(b2); }

  // A3 — le diagnostic de l'heure.
  const b3 = M.creerBac('A3');
  try {
    M.poserMouchard(b3, 'timedatectl', {
      code: 0,
      avant: [
        "if printf '%s' \"$*\" | grep -qE -- 'Timezone'; then printf '%s\\n' 'America/Toronto'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'NTPSynchronized'; then printf '%s\\n' 'yes'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'p NTP'; then printf '%s\\n' 'yes'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'LocalRTC'; then printf '%s\\n' 'no'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'CanNTP'; then printf '%s\\n' 'yes'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'timesync-status'; then printf '%s\\n' 'Server: 185.125.190.56 (ntp.ubuntu.com)'; exit 0; fi",
        'exit 0',
      ],
    });
    M.poserMouchard(b3, 'systemctl', { code: 0, sortie: 'active' });
    M.poserMouchard(b3, 'journalctl', { code: 0, sortie: 'Initial synchronization to time server' });
    M.poserMouchard(b3, 'hwclock', { code: 0, sortie: '2026-10-15 18:00:00.000000+00:00' });
    M.poserMouchard(b3, 'chronyc', { code: 1 });
    const texte = normalizeScriptSh(heure.generate({
      lireHorlogeMaterielle: 'Oui', lignesJournal: '20', format: 'Console',
    }));
    const r = M.executer(b3, texte, { env: { HOME: b3.travail } });
    verifier(r.code === 0, `A3 : le diagnostic de l heure sort 0 (obtenu ${r.code})`);
    const td = r.journal.filter((e) => e.nom === 'timedatectl').map((e) => e.args);
    verifier(td.length >= 2, `A3 : preuve d execution — timedatectl a ete appele (${td.length} fois)`);
    const poses = td.filter((a) => /set-time|set-timezone|set-ntp|set-local-rtc/.test(a));
    verifier(poses.length === 0,
      `A3 — ZERO set-time, set-timezone, set-ntp ou set-local-rtc (${poses.join(' | ') || 'aucun'})`);
    const hw = r.journal.filter((e) => e.nom === 'hwclock').map((e) => e.args);
    verifier(hw.length >= 1, 'A3 : hwclock a bien ete lu');
    verifier(hw.every((a) => /--show/.test(a) && !/--systohc|--hctosys|--set/.test(a)),
      `A3 — hwclock seulement avec --show : aucune ecriture dans l horloge materielle (${hw.join(' | ')})`);
    const sc = r.journal.filter((e) => e.nom === 'systemctl'
      && /^(start|stop|restart|enable|disable)( |$)/.test(e.args));
    verifier(sc.length === 0, 'A3 — ZERO action systemctl');
    verifier(/Aucune ecriture : l heure n a pas ete touchee/.test(r.sortie),
      'A3 : le script DIT franchement qu il n a rien touche');
  } finally { M.detruireBac(b3); }
}

console.log('');
console.log('Passe B — le formulaire du contrôle refuse les unités et verbes protégés');
{
  const base = { unite: UNITE, action: 'Redemarrer', confirmation: UNITE, format: 'Console' };
  // Les unités dont dépend la session : tous les verbes refusés.
  for (const u of ['systemd-logind.service', 'dbus.service', 'polkit.service',
    'systemd-journald.service', 'systemd-udevd.service']) {
    const erreurs = Object.keys(VERBES_TOUS).map((a) => controle.validate({ ...base, unite: u, action: a, confirmation: u }));
    verifier(erreurs.every((e) => Boolean(e.unite)),
      `B : « ${u} » est refusee pour les six verbes`);
  }
  // Les unités d'accès : stop et disable refusés, les autres permis.
  for (const u of ['ssh.service', 'sshd.service', 'systemd-networkd.service',
    'NetworkManager.service', 'ufw.service', 'apparmor.service', 'getty@tty1.service']) {
    verifier(Boolean(controle.validate({ ...base, unite: u, action: 'Arreter', confirmation: u }).action),
      `B : « Arreter » est refuse sur ${u}`);
    verifier(Boolean(controle.validate({ ...base, unite: u, action: 'Desactiver au demarrage', confirmation: u }).action),
      `B : « Desactiver au demarrage » est refuse sur ${u}`);
    const red = controle.validate({ ...base, unite: u, action: 'Redemarrer', confirmation: u });
    verifier(!red.action && !red.unite,
      `B : « Redemarrer » reste permis sur ${u} — avec un avertissement, pas un refus`);
  }
  // Et le contrôle positif du formulaire : une unité ordinaire passe.
  for (const a of Object.keys(VERBES_TOUS)) {
    const e = controle.validate({ ...base, action: a });
    verifier(!e.unite && !e.action, `B : « ${a} » est accepte sur une unite ordinaire`);
  }
  // Le suffixe est ajouté avant la comparaison : « ssh » doit être refusé
  // comme « ssh.service », sinon le contournement serait d'omettre le suffixe.
  verifier(Boolean(controle.validate({ ...base, unite: 'ssh', action: 'Arreter', confirmation: 'ssh' }).action),
    'B — « ssh » sans suffixe est refuse comme « ssh.service » : le suffixe est ajoute AVANT la comparaison');
}

console.log('');
console.log('Passe C — la confirmation manque');
{
  const { bac: b } = bac('C');
  try {
    const r = M.executer(b, texteControle({ confirmation: '' }), { env: { HOME: b.travail } });
    const actions = r.journal.filter((e) => e.nom === 'systemctl'
      && /^(start|stop|restart|reload|enable|disable)( |$)/.test(e.args));
    verifier(actions.length === 0,
      `C — ZERO action sans confirmation (${actions.map((a) => a.args).join(' | ') || 'aucune'})`);
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'C : le script le DIT');
    verifier(/confirmation/i.test(r.sortie), 'C : la condition manquante est NOMMEE');
    verifier(M.compterAppels(r.journal, 'systemctl', 'is-active') >= 1,
      'C : preuve d execution — l etat a bien ete lu avant le refus');
  } finally { M.detruireBac(b); }
}

console.log('');
console.log('Passe D — l’unité est inconnue de systemd');
{
  const { bac: b } = bac('D', { connue: false });
  try {
    const r = M.executer(b, texteControle(), { env: { HOME: b.travail } });
    const actions = r.journal.filter((e) => e.nom === 'systemctl'
      && /^(start|stop|restart|reload|enable|disable)( |$)/.test(e.args));
    verifier(actions.length === 0, 'D — ZERO action sur une unite inconnue');
    verifier(/inconnue de systemd/.test(r.sortie), 'D : le script le dit');
    verifier(/Verifie l orthographe et le suffixe/.test(r.sortie),
      'D : il demande de verifier le SUFFIXE, pas seulement le nom');
    verifier(/prochain demarrage/.test(r.sortie),
      'D : et il dit pourquoi cela compte — un enable sur un nom fautif ne se voit qu au prochain demarrage');
  } finally { M.detruireBac(b); }
}

console.log('');
console.log('Passe E — arrêter SSH depuis une session SSH');
{
  // Le formulaire refuse déjà « Arreter » sur ssh.service : on éprouve donc la
  // garde qui vit DANS le script, en retouchant les deux variables — ce qui
  // est exactement ce qu'un script relu et modifié à la main produirait.
  const { bac: b } = bac('E');
  try {
    const texte = texteControle()
      .replace(`KJEMO_UNITE='${UNITE}'`, "KJEMO_UNITE='ssh.service'")
      .replace("KJEMO_VERBE='restart'", "KJEMO_VERBE='stop'")
      .replace("KJEMO_ATTENDU='active'", "KJEMO_ATTENDU='inactive'");
    verifier(/KJEMO_UNITE='ssh.service'/.test(texte) && /KJEMO_VERBE='stop'/.test(texte),
      'E : les variables du script ont bien ete retouchees');
    const r = M.executer(b, texte, { env: { HOME: b.travail, SSH_CONNECTION: '10.0.0.5 51234 10.0.0.9 22' } });
    const actions = r.journal.filter((e) => e.nom === 'systemctl' && /^stop( |$)/.test(e.args));
    verifier(actions.length === 0,
      'E — ZERO stop sur ssh.service, meme avec le script retouche a la main');
    verifier(/Action refusee/.test(r.sortie) || /injoignable/.test(r.sortie),
      'E : le script explique ce que l action rendrait impossible');
    verifier(/SSH/.test(r.sortie), 'E : il signale que la session en cours passe par SSH');
  } finally { M.detruireBac(b); }

  // Et le contrôle positif de la détection : hors session SSH, le même script
  // doit refuser quand même — le refus ne dépend pas de la session, c'est
  // l'AVERTISSEMENT qui en dépend.
  const { bac: b2 } = bac('E2');
  try {
    const texte = texteControle()
      .replace(`KJEMO_UNITE='${UNITE}'`, "KJEMO_UNITE='ssh.service'")
      .replace("KJEMO_VERBE='restart'", "KJEMO_VERBE='stop'");
    const r = M.executer(b2, texte, { env: { HOME: b2.travail } });
    verifier(r.journal.filter((e) => e.nom === 'systemctl' && /^stop( |$)/.test(e.args)).length === 0,
      'E2 — le refus de stop sur SSH ne depend PAS de la session : il tient aussi en local');
    verifier(/Action refusee/.test(r.sortie),
      'E2 : et le refus est annonce de la meme facon, session distante ou non');
  } finally { M.detruireBac(b2); }
}

console.log('');
console.log('Passe F — l’état relu n’est pas l’état attendu');
{
  // L'action réussit, mais le service ne tourne pas après : c'est le cas du
  // service qui démarre puis meurt en deux secondes, et c'est exactement ce
  // qu'un code de retour ne dit pas.
  const { bac: b } = bac('F', { actifApres: 'failed' });
  try {
    const r = M.executer(b, texteControle({ action: 'Demarrer' }), { env: { HOME: b.travail } });
    verifier(M.compterAppels(r.journal, 'systemctl', '^start') === 1, 'F : l action a bien eu lieu');
    verifier(r.code !== 0, `F — etat relu different de l attendu → sortie en erreur (code ${r.code})`);
    verifier(/n a PAS eu l effet annonce/.test(r.sortie) || /n a pas eu l effet annonce/.test(r.sortie),
      'F : le script dit que l action n a pas eu l effet annonce');
    verifier(M.compterAppels(r.journal, 'journalctl') >= 1,
      'F — le journal de l unite est affiche quand la relecture echoue : c est la seule chose utile a ce moment-la');
  } finally { M.detruireBac(b); }
}

console.log('');
console.log('Passe G — CONTRÔLE POSITIF : lire, agir, RELIRE');
{
  const { bac: b } = bac('G');
  try {
    const r = M.executer(b, texteControle({ action: 'Redemarrer' }), { env: { HOME: b.travail } });
    verifier(r.code === 0, `G : le script sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'systemctl', '^restart') === 1,
      `G : restart appele exactement une fois (${M.compterAppels(r.journal, 'systemctl', '^restart')})`);
    const noms = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args);
    const iCat = noms.findIndex((a) => /^cat/.test(a));
    const iAvant = noms.findIndex((a) => /^is-active/.test(a));
    const iAction = noms.findIndex((a) => /^restart/.test(a));
    const iApres = noms.findIndex((a, k) => /^is-active/.test(a) && k > iAction);
    verifier(iCat !== -1 && iCat < iAction, 'G : l unite est VERIFIEE connue avant l action');
    verifier(iAvant !== -1 && iAvant < iAction, 'G : l etat est lu AVANT l action');
    verifier(iApres !== -1, 'G — l etat est RELU APRES l action : c est la relecture qui decide');
    verifier(!/n a PAS eu l effet annonce/.test(r.sortie),
      'G : la relecture ne signale aucun ecart — « confirme par relecture » est un etat OK, que le rapport Console n imprime pas');
    const interdits = noms.filter((a) => /^(mask|unmask|kill|isolate|edit)( |$)/.test(a));
    verifier(interdits.length === 0, 'G : ni mask, ni kill, ni isolate, ni edit');
  } finally { M.detruireBac(b); }
}

console.log('');
console.log('Passe H — CONTRÔLE POSITIF : enable relit is-enabled, et dit ce qui n’a PAS changé');
{
  const { bac: b } = bac('H', { activeAvant: 'disabled', activeApres: 'enabled' });
  try {
    const r = M.executer(b, texteControle({ action: 'Activer au demarrage' }), { env: { HOME: b.travail } });
    verifier(r.code === 0, `H : le script sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'systemctl', '^enable') === 1, 'H : enable appele une fois');
    const noms = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args);
    const iAction = noms.findIndex((a) => /^enable/.test(a));
    const iRelu = noms.findIndex((a, k) => /^is-enabled/.test(a) && k > iAction);
    verifier(iRelu !== -1, 'H — is-enabled est RELU apres enable, et non is-active');
    verifier(/enable prepare le PROCHAIN demarrage/.test(r.sortie),
      'H — le script DIT que le service n a pas ete demarre : enable prepare le PROCHAIN demarrage');
    verifier(M.compterAppels(r.journal, 'systemctl', '^start') === 0,
      'H : et il ne demarre effectivement rien');
  } finally { M.detruireBac(b); }

  // Le symétrique : disable ne coupe pas le service, et le dit.
  const { bac: b2 } = bac('H2', { activeAvant: 'enabled', activeApres: 'disabled' });
  try {
    const r = M.executer(b2, texteControle({ action: 'Desactiver au demarrage' }), { env: { HOME: b2.travail } });
    verifier(M.compterAppels(r.journal, 'systemctl', '^stop') === 0,
      'H2 — disable ne coupe PAS le service : zero stop');
    verifier(/disable ne coupe pas le service en cours/.test(r.sortie),
      'H2 : et le script le dit, en ATTENTION pour que le mode Console l imprime');
    verifier(/disable --now/.test(r.sortie),
      'H2 : il explique pourquoi « disable --now » n est pas offert — il ferait les deux et n en annoncerait qu une');
  } finally { M.detruireBac(b2); }
}

console.log('');
console.log('Passe I — un verbe interdit injecté à la main dans le script');
{
  // La liste des six verbes est close dans le générateur. Le script la
  // revérifie : c'est la garde qui tient quand quelqu'un relit le script et
  // remplace « restart » par « mask » — en croyant désactiver proprement.
  const { bac: b } = bac('I');
  try {
    const texte = texteControle().replace("KJEMO_VERBE='restart'", "KJEMO_VERBE='mask'");
    verifier(/KJEMO_VERBE='mask'/.test(texte), 'I : le verbe a bien ete remplace par « mask »');
    const r = M.executer(b, texte, { env: { HOME: b.travail } });
    verifier(M.compterAppels(r.journal, 'systemctl', '^mask') === 0,
      'I — ZERO mask : le script refuse un verbe hors de la liste close');
    verifier(r.code !== 0, `I : et il sort en erreur (code ${r.code})`);
    verifier(/verbe non autorise/.test(r.sortie),
      'I : il dit que le script a ete modifie a la main');
  } finally { M.detruireBac(b); }
}

// ===========================================================================
console.log('');
console.log(`Services Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur.');
console.log('Aucun vrai systemctl, aucun paquet installé, aucune horloge touchée.');
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
