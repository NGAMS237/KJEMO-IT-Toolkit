#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 (25/n) — LES 19 FAMILLES NÉGATIVES : CE QUE LES ASSISTANTS REFUSENT DE FAIRE
//
// Un assistant qui modifie une machine se juge sur ce qu'il refuse. Ce banc
// éprouve, famille par famille, les verrous des assistants du lot, selon un
// CONTRAT À TROIS TEMPS que chaque famille doit tenir — et que le banc vérifie
// lui-même en fin de course (voir « CONTRAT » plus bas) :
//
//   1. REFUS             le verrou refuse, ET aucun appel modifiant n'a lieu ;
//   2. CONTRÔLE POSITIF  quand tout est satisfait, l'action ou la porte
//                        s'ouvre : sans lui, on ne distingue pas un verrou qui
//                        bloque d'un script qui ne fait rien ;
//   3. CONTRE-ÉPREUVE    on DÉSARME volontairement le verrou (mutation exacte
//                        du script ou de dist/), et le banc doit alors
//                        DÉTECTER l'appel ou l'état interdit. Un banc qui
//                        reste vert devant un verrou arraché ne vaut rien.
//
// RÈGLES DE MESURE
//   - « zéro appel modifiant » est mesuré par un classifieur éprouvé à part
//     (famille N00) ; un test ne passe jamais parce que le script s'est arrêté
//     AVANT la zone observée : chaque refus est vérifié par son MESSAGE, et
//     chaque contrôle positif par la présence de l'appel attendu ;
//   - l'ORDRE des appels est mesuré là où il protège (état avant, action,
//     relecture) ;
//   - aucun secret ne doit apparaître dans une sortie, un journal d'appels, un
//     rapport ou un script ;
//   - un diagnostic ne modifie rien.
//
// D'OÙ VIENT LA LISTE DES 19 FAMILLES
//   Aucun artefact fourni ne la donnait. Elle est reconstruite à partir des
//   verrous RÉELS lus dans les scripts générés et dans dist/, et déclarée ici
//   sans détour : chaque famille est une classe de verrou, pas un test isolé.
//
// NIVEAUX DE PREUVE (rappel)
//   3 = exécution réelle dans ce conteneur ;
//   4 = exécution avec doublures (mouchards) ;
//   1 = analyse statique (pour PowerShell, faute de pwsh ou de session Windows).
//   Ubuntu Server réel, contrôleur Samba AD réel, export NFS réel, jonction
//   réelle, Windows PowerShell 5.1 : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, symlinkSync, rmSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as M from './mouchards-linux.mjs';
import * as N from './negatifs-lot7.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { tools } = await import(pathToFileURL(resolve(N.DIST, 'generators.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(N.DIST, 'noyau-bash.mjs')).href);
const { estBash } = await import(pathToFileURL(resolve(N.DIST, 'plateforme.mjs')).href);

// ---------------------------------------------------------------------------
// Comptabilité : chaque vérification est rangée dans UN des trois temps du
// contrat de SA famille. Le contrat est contrôlé en fin de banc.
// ---------------------------------------------------------------------------
let ok = 0;
const echecs = [];
const FAMILLES = new Map();   // id -> { titre, niveau, refus, positif, contre }
let courante = null;
let nonExecutes = [];

// Une interruption (mutation introuvable, exception) est un ÉCHEC étiqueté, jamais une sortie muette.
const interrompre = (e) => {
  console.error(`  [ECHEC] ${courante ?? 'N??'} — INTERRUPTION du banc : ${String((e && e.message) || e).split('\n')[0]}`);
  process.exit(1);
};
process.on('uncaughtException', interrompre);
process.on('unhandledRejection', interrompre);

const enregistrer = (temps, cond, msg) => {
  if (!courante) throw new Error('vérification hors famille');
  FAMILLES.get(courante)[temps] += 1;
  if (cond) { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${msg}`); }
  else { echecs.push(`${courante} ${msg}`); console.error(`  [ECHEC] ${courante} — ${msg}`); }
};
const refus = (c, m) => enregistrer('refus', c, `REFUS : ${m}`);
const positif = (c, m) => enregistrer('positif', c, `POSITIF : ${m}`);
const contre = (c, m) => enregistrer('contre', c, `CONTRE-ÉPREUVE : ${m}`);
// KJEMO_FAMILLES=N01,N02 : ne jouer que ces familles (contre-épreuves ciblées du banc lui-même).
// N00, le classifieur, est toujours joué : sans lui, aucun verdict n'a de sens.
const FILTRE = process.env.KJEMO_FAMILLES ? new Set(['N00', ...process.env.KJEMO_FAMILLES.split(',').map((x) => x.trim())]) : null;
const famille = (id, titre, niveau) => {
  courante = id;
  if (FILTRE && !FILTRE.has(id)) return false;
  FAMILLES.set(id, { titre, niveau, refus: 0, positif: 0, contre: 0 });
  console.log('');
  console.log(`${id} — ${titre}   [niveau de preuve ${niveau}]`);
  return true;
};

// ---------------------------------------------------------------------------
// Les assistants du lot
// ---------------------------------------------------------------------------
// Les assistants CUPS du LOT 9 (catégorie Imprimantes) ont leur propre banc,
// test/impression-assistants.test.mjs : ce banc reste celui du LOT 7.
const linux = tools.filter((t) => t.platform === 'Linux' && t.category !== 'Imprimantes');
const MODIFIANTS = linux.filter((t) => t.risk !== 'diagnostic');
const DIAGNOSTICS = linux.filter((t) => t.risk === 'diagnostic');
const outil = (id) => {
  const t = tools.find((x) => x.id === id);
  if (!t) { console.error(`ECHEC : outil « ${id} » absent du catalogue`); process.exit(1); }
  return t;
};
const brut = (t, v) => normalizeScriptSh(t.generate(v));
const sansDanger = (t, ch = {}) => ({ ...N.defauts(t), format: 'Console', ...ch });

// L'état de la machine qui exécute le banc : relevé avant, comparé après.
const SYSTEME_AVANT = N.empreinteSysteme();
const tmpdirLocal = () => tmpdir();

// ===========================================================================
// N00 — le classifieur d'appels : condition de validité de toutes les familles
// ===========================================================================
if (famille('N00', 'le classifieur « modifiant / lecture » est lui-même éprouvé', 3)) {
  const MODIFIE = [
    ['systemctl', 'restart -- nginx.service'], ['systemctl', 'stop ssh'], ['systemctl', 'mask x.service'],
    ['systemctl', 'daemon-reload'], ['useradd', '-m etudiant'], ['chmod', '750 -- /srv/x'],
    ['chown', 'root:root /srv/x'], ['setfacl', '-m u:a:rw /srv/x'], ['mount', '/dev/sdb1 /srv/d'],
    ['umount', '/srv/d'], ['sfdisk', '--label gpt /dev/sdb'], ['mkfs.ext4', '/dev/sdb1'],
    ['wipefs', '-a /dev/sdb'], ['mdadm', '--create /dev/md1 --level=1'], ['mdadm', '--add /dev/md1 /dev/sdd'],
    ['netplan', 'apply'], ['netplan', 'try'], ['netplan', 'generate'], ['ip', 'addr add 10.0.0.2/24 dev eth0'],
    ['ip', 'route replace default via 10.0.0.1'], ['ufw', 'allow 2049'], ['iptables', '-A INPUT -j DROP'],
    ['exportfs', '-ra'], ['exportfs', '-u 10.0.0.0/24:/srv/x'], ['samba-tool', 'domain provision --realm=X'],
    ['samba-tool', 'user create bob'], ['smbpasswd', '-a bob'], ['apt-get', 'install nginx'],
    ['apt-get', 'update'], ['dpkg', '-i x.deb'], ['timedatectl', 'set-timezone Europe/Paris'],
    ['hwclock', '--systohc'], ['quotaon', '/srv'], ['setquota', '-u bob 1 2 3 4 /srv'],
    ['sshd', ''], ['ssh-keygen', '-t ed25519 -f /root/k'], ['tar', '-czf /srv/a.tgz /srv/d'],
    ['passwd', 'bob'], ['chage', '-M 90 bob'],
  ];
  const LIT = [
    ['systemctl', 'is-active -- nginx.service'], ['systemctl', 'is-enabled ssh'], ['systemctl', 'show -p LoadState --value -- x'],
    ['systemctl', 'cat -- x.service'], ['systemctl', 'list-units --type=service'], ['journalctl', '-u ssh -n 20 --no-pager'],
    ['mount', ''], ['mount', '-l'], ['sfdisk', '--dump /dev/sdb'], ['sfdisk', '--help'], ['fdisk', '-l'],
    ['wipefs', '/dev/sdb'], ['wipefs', '-n -a /dev/sdb'], ['mdadm', '--detail /dev/md1'], ['mdadm', '--examine /dev/sdb'],
    ['netplan', '--version'], ['netplan', 'get'], ['netplan', 'generate --root-dir /tmp/kjemo-x/racine'],
    ['ip', '-brief link show dev eth0'], ['ip', 'addr show'], ['ip', 'route show'], ['ufw', 'status'],
    ['iptables', '-S'], ['exportfs', '-v'], ['exportfs', '-s'], ['exportfs', ''], ['testparm', '-s -- /etc/samba/smb.conf'],
    ['samba-tool', 'domain level show'], ['samba-tool', 'user list'], ['apt-get', '-s install nginx'],
    ['apt-get', '--simulate upgrade'], ['dpkg', '-l'], ['dpkg-query', '-W -f=${Status} samba'], ['apt-cache', 'policy samba'],
    ['timedatectl', 'show -p Timezone --value'], ['hwclock', '--show'], ['sshd', '-T'], ['sshd', '-t -f /tmp/x'],
    ['ssh-keygen', '-l -f /root/.ssh/k.pub'], ['tar', '-tzf /srv/a.tgz'], ['passwd', '-S bob'], ['chage', '-l bob'],
    ['chmod', '--test 750 x'],
  ];
  for (const [n, a] of MODIFIE) refus(N.estModifiant(n, a), `« ${n} ${a} » est classé MODIFIANT`);
  for (const [n, a] of LIT) positif(!N.estModifiant(n, a), `« ${n} ${a} » est classé LECTURE`);
  // Contre-épreuve : un classifieur qui dirait « lecture » partout serait vert
  // pour tout. On vérifie qu'il y a bien les deux classes, et que la règle de
  // prudence (commande surveillée inconnue = modifiante) existe.
  contre(MODIFIE.every(([n, a]) => N.estModifiant(n, a)) && LIT.every(([n, a]) => !N.estModifiant(n, a)),
    `le classifieur sépare ${MODIFIE.length} écritures de ${LIT.length} lectures, sans mélange`);
  contre(N.estModifiant('setfacl', '--restore=/tmp/x') && N.estModifiant('quotacheck', '-cug /srv') && !N.estModifiant('ls', '-l'),
    'une commande surveillée à sous-verbe inconnu est classée modifiante ; une commande non surveillée ne l\'est pas');
  // L'exception documentée : un chmod sur le fichier de travail du script.
  const j = [{ nom: 'chmod', args: '600 -- /tmp/kjemo-x/99.yaml' }, { nom: 'chmod', args: '750 -- /srv/x' }];
  contre(N.appelsModifiants(j, ['/tmp/kjemo-']).length === 1 && N.appelsModifiants(j, ['/tmp/kjemo-'])[0].args.includes('/srv/x'),
    'l\'exception « fichier de travail du script » ne couvre pas un chmod sur /srv');
}

// ===========================================================================
// N01 — confirmation absente
// ===========================================================================
const PORTES = new Map();   // id -> { bloc, phrase, texteVide }
if (famille('N01', 'confirmation absente : le script diagnostique et refuse d\'agir (15 assistants modifiants)', 4)) {
  positif(MODIFIANTS.length === 15, `le lot compte 15 assistants modifiants (obtenu ${MODIFIANTS.length})`);
  for (const t of MODIFIANTS) {
    const conf = N.champConfirmation(t);
    positif(conf !== null, `${t.id} porte un champ de confirmation`);
    if (!conf) continue;
    const r = N.lancer((bac) => brut(t, N.valeursDansLeBac(t, bac, { [conf]: '' })), { nom: 'n01' });
    const texte = r.texte;
    const phrase = N.phraseAnnoncee(r.sortie);
    refus(/\[PROBLEME\] Confirmation \/ Phrase exacte/.test(r.sortie), `${t.id} : la confirmation absente est NOMMÉE dans la sortie`);
    refus(phrase !== null && phrase.length > 0, `${t.id} : la phrase attendue est ANNONCÉE (« ${phrase} »)`);
    const mod = N.appelsModifiants(r.journal, r.racinesPropres);
    refus(mod.length === 0, `${t.id} : zéro appel modifiant sans confirmation (${N.resume(mod)})`);
    refus(r.journal.length > 0 || r.sortie.length > 0, `${t.id} : le script a réellement démarré (sortie ou journal non vides)`);

    const bloc = N.extraireBlocConfirmation(texte);
    positif(bloc !== null, `${t.id} : le bloc de confirmation est présent dans le script généré`);
    if (!bloc) continue;
    PORTES.set(t.id, { t, conf, bloc, phrase });
    positif(N.ouvreLaPorte(bloc, phrase ?? ''), `${t.id} : la phrase exacte annoncée OUVRE la porte`);
    refus(!N.ouvreLaPorte(bloc, ''), `${t.id} : la saisie vide laisse la porte FERMÉE`);

    // Contre-épreuve : la porte est arrachée (« if true »). La saisie vide doit
    // alors ouvrir — et le détecteur du banc doit le voir.
    const arrachee = N.muter(bloc.texte, /if \[ "\$\{\w+\}" = '(?:[^']|'\\'')*' \]; then/, 'if true; then', `${t.id} N01`);
    const detecte = N.ouvreLaPorte(bloc, '', arrachee) === true;
    contre(detecte, `${t.id} : porte arrachée — la saisie VIDE ouvre, et le banc le DÉTECTE`);
  }
}

// ===========================================================================
// N02 — confirmation approchante
// ===========================================================================
if (famille('N02', 'confirmation approchante : casse, espaces, préfixe, suffixe, phrase d\'un autre assistant', 4)) {
  const liste = [...PORTES.values()];
  // Sans les 15 portes extraites par N01, cette famille jugerait le vide : elle
  // le dit en son nom au lieu de passer vacuement.
  refus(liste.length === MODIFIANTS.length, `les ${MODIFIANTS.length} portes de confirmation sont disponibles pour l'épreuve des saisies voisines (obtenu ${liste.length})`);
  for (let i = 0; i < liste.length; i += 1) {
    const { t, bloc, phrase } = liste[i];
    const autre = liste[(i + 1) % liste.length].phrase;
    const variantes = [
      ['espace final', `${phrase} `], ['espace initial', ` ${phrase}`],
      ['préfixe seul', phrase.slice(0, -1)], ['suffixe ajouté', `${phrase}x`],
      ['réponse « oui »', 'oui'], ['réponse « OUI »', 'OUI'], ['retour à la ligne', `${phrase}\n`],
    ];
    if (phrase.toUpperCase() !== phrase) variantes.push(['casse changée', phrase.toUpperCase()]);
    if (autre && autre !== phrase) variantes.push(['phrase d\'un autre assistant', autre]);
    const ouvertes = variantes.filter(([, v]) => N.ouvreLaPorte(bloc, v)).map(([n]) => n);
    refus(ouvertes.length === 0, `${t.id} : ${variantes.length} saisies voisines, aucune n'ouvre la porte (ouvertes : ${ouvertes.join(', ') || 'aucune'})`);
    positif(N.ouvreLaPorte(bloc, phrase), `${t.id} : la phrase exacte ouvre toujours la porte`);

    // Contre-épreuve : la comparaison exacte devient « non vide » — la porte
    // s'ouvre pour n'importe quelle réponse, y compris « oui ».
    const laxiste = N.muter(bloc.texte, /if \[ "\$\{(\w+)\}" = '(?:[^']|'\\'')*' \]; then/, 'if [ -n "${$1}" ]; then', `${t.id} N02`);
    const laxisteDetecte = variantes.some(([, v]) => N.ouvreLaPorte(bloc, v, laxiste));
    contre(laxisteDetecte, `${t.id} : comparaison affaiblie en « non vide » — une saisie voisine ouvre, et le banc le DÉTECTE`);
  }
}

// ===========================================================================
// N17 — un diagnostic ne modifie rien
// ===========================================================================
if (famille('N17', 'un diagnostic ne modifie rien : aucun appel d\'écriture, aucun fichier, aucun contournement du PATH', 4)) {
  positif(DIAGNOSTICS.length === 28, `le lot compte 28 assistants diagnostics Bash (obtenu ${DIAGNOSTICS.length})`);
  let tousLesTextes = 0;
  for (const t of DIAGNOSTICS) {
    const r = N.lancer((bac) => {
      const ch = {};
      // Les champs de destination pointent vers le bac : un diagnostic n'écrit
      // nulle part, mais on ne parie pas la machine sur cette affirmation.
      for (const f of t.fields ?? []) {
        if (typeof f.default === 'string' && f.default.startsWith('/srv/')) ch[f.id] = f.default.replace('/srv/', `${bac.travail}/`);
      }
      return brut(t, sansDanger(t, ch));
    }, { nom: 'n17' });
    const mod = N.appelsModifiants(r.journal, r.racinesPropres);
    refus(mod.length === 0, `${t.id} : zéro appel modifiant (${N.resume(mod)})`);
    refus(r.fichiers.ajoutes.length === 0 && r.fichiers.modifies.length === 0 && r.fichiers.retires.length === 0,
      `${t.id} : aucun fichier créé, modifié ou retiré dans le dossier de travail (${r.fichiers.ajoutes.join(', ') || 'aucun'})`);
    refus(N.cheminsAbsolusSuspectsLocal(r.texte).length === 0,
      `${t.id} : aucune commande surveillée appelée par chemin absolu (contournement du PATH)`);
    positif(r.sortie.trim().length > 0, `${t.id} : le diagnostic a produit une sortie (il a réellement tourné)`);
    tousLesTextes += 1;
  }
  positif(tousLesTextes === DIAGNOSTICS.length, `les ${DIAGNOSTICS.length} diagnostics ont tous été exécutés`);

  // Contre-épreuves : on glisse un appel d'écriture dans un diagnostic.
  const hote = outil('systemd-service-diagnostic');
  const sain = brut(hote, sansDanger(hote));
  const direct = sain.replace('\nKJEMO_TMP=', '\nsystemctl restart -- ssh.service\nKJEMO_TMP=');
  contre(direct !== sain, 'N17 : la mutation « systemctl restart » s\'applique');
  const rd = N.lancer(direct, { nom: 'n17c' });
  contre(N.appelsModifiants(rd.journal, rd.racinesPropres).length >= 1, 'un diagnostic qui redémarre SSH est DÉTECTÉ par le journal des mouchards');
  // Le contournement par chemin absolu échappe au mouchard : c'est le scanner
  // statique qui doit le voir. On prouve les deux moitiés de cette phrase.
  const absolu = sain.replace('\nKJEMO_TMP=', '\n/bin/systemctl restart -- ssh.service || true\nKJEMO_TMP=');
  const ra = N.lancer(absolu, { nom: 'n17d' });
  contre(N.appelsModifiants(ra.journal, ra.racinesPropres).length === 0,
    'preuve de la FAILLE : l\'appel par chemin absolu n\'apparaît PAS au journal des mouchards');
  contre(N.cheminsAbsolusSuspectsLocal(absolu).length >= 1,
    'le scanner de chemins absolus DÉTECTE ce contournement, que le mouchard ne voit pas');
}

// ===========================================================================
// N18 — aucun secret
// ===========================================================================
if (famille('N18', 'aucun secret dans un script, une sortie, un journal d\'appels ou un rapport', 4)) {
  const masse = [];
  for (const t of linux) {
    const texte = brut(t, sansDanger(t));
    masse.push({ ou: `script ${t.id}`, texte });
  }
  // Sorties et journaux d'une série d'exécutions représentatives.
  const echantillon = [...MODIFIANTS.slice(0, 15), ...DIAGNOSTICS.slice(0, 28)];
  for (const t of echantillon) {
    const r = N.lancer((bac) => {
      const ch = {};
      for (const f of t.fields ?? []) {
        if (typeof f.default === 'string' && f.default.startsWith('/srv/')) ch[f.id] = f.default.replace('/srv/', `${bac.travail}/`);
      }
      const conf = N.champConfirmation(t);
      if (conf) ch[conf] = '';
      return brut(t, sansDanger(t, ch));
    }, { nom: 'n18' });
    masse.push({ ou: `sortie ${t.id}`, texte: r.sortie });
    masse.push({ ou: `journal ${t.id}`, texte: r.journal.map((e) => `${e.nom} ${e.args}`).join('\n') });
  }
  let nb = 0;
  for (const m of masse) {
    const s = N.secretsDans(m.texte);
    refus(s.length === 0, `${m.ou} : aucun secret en clair (${s.map((x) => `${x.motif} l.${x.ligne}`).join(' ; ') || 'aucun'})`);
    nb += 1;
  }
  positif(nb >= 100, `${nb} textes passés au détecteur de secrets`);
  // Contre-épreuve : le détecteur doit voir chaque forme de secret planté.
  const PLANTES = [
    'ADMIN_PASSWORD=Sup3rSecret!', '--adminpass=Sup3rSecret!', 'echo "bob:Sup3rSecret!" | chpasswd',
    '-----BEGIN OPENSSH PRIVATE KEY-----', 'token: ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'smb://admin:Sup3rSecret@srv/partage',
  ];
  for (const p of PLANTES) contre(N.secretsDans(p).length >= 1, `le détecteur voit le secret planté « ${p.slice(0, 40)} »`);
  // Et il ne crie pas sur la pédagogie, sinon on le désactiverait.
  positif(N.secretsDans('# Le rapport ne contient aucun mot de passe, jeton ni cle privee.').length === 0,
    'un commentaire pédagogique qui cite le mot « mot de passe » n\'est pas un secret');
  positif(N.secretsDans('password="${KJEMO_MDP}"').length === 0 && N.secretsDans('--password=$VAR').length === 0,
    'une référence à une variable n\'est pas un secret en clair');
}

// ===========================================================================
// Outillage commun aux familles N03 à N07 : systemd-service-control
// ===========================================================================
const svc = outil('systemd-service-control');
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

/** Doublure de systemctl avec MÉMOIRE : après start/restart/reload, is-active rend `apres`. */
function systemctlSimule(bac, { apres = 'active', avant = 'active' } = {}) {
  const marque = join(bac.racine, 'agi.marque');
  M.poserMouchard(bac, 'systemctl', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '^(restart|start|reload|stop|enable|disable|mask) '; then : > ${sq(marque)}; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- 'is-active'; then if [ -e ${sq(marque)} ]; then printf '%s\\n' ${sq(apres)}; else printf '%s\\n' ${sq(avant)}; fi; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- 'is-enabled'; then printf '%s\\n' 'enabled'; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- 'LoadState'; then printf '%s\\n' 'loaded'; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- 'Description'; then printf '%s\\n' 'Service de test'; exit 0; fi`,
      'exit 0',
    ],
  });
}

/** Le script de service-control, la confirmation étant `exacte`, `''` ou une saisie donnée. */
function scriptSvc({ conf = '', unite = 'nginx.service', action = 'Redemarrer', retouche = null } = {}) {
  const base = brut(svc, { ...N.defauts(svc), format: 'Console', unite, action, confirmation: conf });
  return retouche ? retouche(base) : base;
}
const runSvc = (texte, opts = {}) => N.lancer(texte, { nom: 'svc', env: opts.env ?? {}, extra: (bac) => systemctlSimule(bac, opts) });
const appelsSvc = (r) => r.journal.filter((e) => e.nom === 'systemctl');
const AGISSANT = (r) => N.appelsModifiants(r.journal, r.racinesPropres);
const ARRACHE = (texte) => {
  const b = N.extraireBlocConfirmation(texte);
  return N.muter(texte, b.texte, b.texte.replace(/if \[ "\$\{\w+\}" = '(?:[^']|'\\'')*' \]; then/, 'if true; then'), 'porte arrachée');
};

// ===========================================================================
// N03 — le plein parcours : sans confirmation, l'action n'a pas lieu
// ===========================================================================
if (famille('N03', 'plein parcours sans confirmation : le script va jusqu\'au bout de ses lectures et n\'agit pas', 4)) {
  // --- systemd-service-control : l'appel interdit est `systemctl restart` ---
  {
    const r = runSvc(scriptSvc({ conf: '' }));
    refus(r.code === 0, `service-control sans confirmation : sort 0 (obtenu ${r.code})`);
    refus(/AUCUNE MODIFICATION/.test(r.sortie), 'service-control : la porte finale dit « AUCUNE MODIFICATION »');
    refus(AGISSANT(r).length === 0, `service-control : zéro appel modifiant (${N.resume(AGISSANT(r))})`);
    refus(appelsSvc(r).some((e) => /^is-active/.test(e.args)),
      'service-control : le script a atteint la zone des lectures (is-active appelé) — il ne s\'est pas arrêté avant');

    const p = runSvc(scriptSvc({ conf: 'nginx.service' }));
    positif(p.code === 0, `service-control avec la phrase exacte : sort 0 (obtenu ${p.code})`);
    const agit = AGISSANT(p);
    positif(agit.length === 1 && agit[0].nom === 'systemctl' && /^restart -- nginx\.service$/.test(agit[0].args),
      `service-control : UN SEUL appel modifiant, « systemctl restart -- nginx.service » (${N.resume(agit)})`);

    const c = runSvc(ARRACHE(scriptSvc({ conf: '' })));
    contre(AGISSANT(c).length >= 1 && AGISSANT(c).some((e) => /^restart/.test(e.args)),
      `service-control : porte arrachée, saisie VIDE — le restart a lieu et le banc le DÉTECTE (${N.resume(AGISSANT(c))})`);
  }

  // --- bash-backup-directory : l'appel interdit est `tar -c…` ---------------
  {
    const bk = outil('bash-backup-directory');
    const faire = (conf, mut = null) => N.lancer((bac) => {
      const sans = brut(bk, N.valeursDansLeBac(bk, bac, { confirmation: '' }));
      const phrase = N.phraseStatique(sans);
      let t = brut(bk, N.valeursDansLeBac(bk, bac, { confirmation: conf === 'EXACTE' ? phrase : conf }));
      if (mut) t = mut(t);
      return t;
    }, { nom: 'bk' });
    const tarCree = (r) => r.journal.filter((e) => e.nom === 'tar' && N.estModifiant('tar', e.args));
    const r = faire('');
    refus(/\[PROBLEME\] Confirmation \/ Phrase exacte/.test(r.sortie), 'sauvegarde sans confirmation : refus NOMMÉ');
    refus(tarCree(r).length === 0, `sauvegarde sans confirmation : aucune archive créée (${N.resume(tarCree(r))})`);
    refus(r.journal.some((e) => e.nom === 'id') && /Phrase exacte/.test(r.sortie),
      'sauvegarde : le script a atteint la zone de confirmation (il ne s\'est pas arrêté avant)');
    const p = faire('EXACTE');
    positif(tarCree(p).length === 1, `sauvegarde avec la phrase exacte : UNE archive créée (${N.resume(tarCree(p))})`);
    const c = faire('', ARRACHE);
    contre(tarCree(c).length === 1, 'sauvegarde : porte arrachée, saisie VIDE — l\'archive est créée et le banc le DÉTECTE');
  }

  // --- nfs-export-create : l'appel interdit est l'écriture de /etc/exports ---
  {
    const nfs = outil('nfs-export-create');
    const EXPORTS = '# exports du bac\n/srv/nfs/existant 192.168.40.0/24(ro,sync,root_squash,no_subtree_check)\n';
    const faire = (conf, mut = null) => {
      let fichier = null;
      const r = N.lancer((bac) => {
        fichier = join(bac.travail, 'exports');
        writeFileSync(fichier, EXPORTS, 'utf8');
        const dossier = join(bac.travail, 'donnees');
        mkdirSync(dossier, { recursive: true });
        const v = { ...N.defauts(nfs), format: 'Console', chemin: dossier, client: '192.168.30.0/24', ecriture: 'Oui', squashTous: 'Non' };
        const sans = brut(nfs, { ...v, confirmation: '' });
        const phrase = N.phraseStatique(sans);
        let t = brut(nfs, { ...v, confirmation: conf === 'EXACTE' ? phrase : conf });
        t = N.muter(t, "KJEMO_EXPORTS='/etc/exports'", `KJEMO_EXPORTS='${fichier}'`, 'redirection de /etc/exports');
        if (mut) t = mut(t);
        return t;
      }, {
        nom: 'nfs',
        apres: () => readFileSync(fichier, 'utf8'),
        extra: (bac) => {
          M.poserMouchard(bac, 'dpkg-query', { code: 0, avant: ["printf '%s' 'install ok installed'", 'exit 0'] });
          M.poserMouchard(bac, 'systemctl', { code: 0, avant: [
            `if printf '%s' "$*" | grep -qE -- 'is-active'; then printf '%s\\n' active; exit 0; fi`,
            `if printf '%s' "$*" | grep -qE -- 'is-enabled'; then printf '%s\\n' enabled; exit 0; fi`, 'exit 0'] });
          for (const c of ['ss', 'ufw', 'getent', 'findmnt', 'showmount', 'rpcinfo']) {
            M.poserMouchard(bac, c, { code: 0, sortie: c === 'findmnt' ? '/' : '' });
          }
          M.poserMouchard(bac, 'exportfs', { code: 0, sortie: '' });
        },
      });
      return { r, exports: r.lu };
    };
    const { r: r0, exports: e0 } = faire('');
    refus(e0 === EXPORTS, 'NFS sans confirmation : /etc/exports du bac est identique, à l\'octet');
    refus(/\[PROBLEME\] Confirmation \/ Phrase exacte/.test(r0.sortie), 'NFS sans confirmation : refus NOMMÉ');
    refus(/APERCU EXACT DE CE QUI SERA AJOUTE/.test(r0.sortie), 'NFS : l\'aperçu est affiché quand même (le script a atteint la zone observée)');
    const { r: r1, exports: e1 } = faire('EXACTE');
    positif(e1 !== EXPORTS && e1.startsWith(EXPORTS) && /root_squash/.test(e1.slice(EXPORTS.length)),
      'NFS avec la phrase exacte : une ligne root_squash est AJOUTÉE à la fin du fichier');
    positif(M.compterAppels(r1.journal, 'exportfs', '(^|\\s)-[a-z]*[raou]') === 0, 'NFS : même confirmé, exportfs n\'applique jamais');
    const { exports: e2 } = faire('', ARRACHE);
    contre(e2 !== EXPORTS, 'NFS : porte arrachée, saisie VIDE — le fichier des exports CHANGE et le banc le DÉTECTE');
  }
}

// ===========================================================================
// N04 — l'ORDRE : état avant, action, relecture
// ===========================================================================
if (famille('N04', 'ordre des appels : lire l\'état avant, agir, puis relire — jamais dans un autre ordre', 4)) {
  const ordreOk = (r) => {
    const s = appelsSvc(r);
    const iAct = s.findIndex((e) => /^restart/.test(e.args));
    const iAvant = s.findIndex((e) => /^is-active/.test(e.args));
    const iApres = s.findIndex((e, i) => i > iAct && /^is-active/.test(e.args));
    return { iAvant, iAct, iApres, ok: iAvant !== -1 && iAct !== -1 && iApres !== -1 && iAvant < iAct && iAct < iApres };
  };
  const r = runSvc(scriptSvc({ conf: 'nginx.service' }));
  const o = ordreOk(r);
  refus(o.iAvant !== -1 && o.iAvant < o.iAct, `l'état est lu AVANT l'action (is-active #${o.iAvant}, restart #${o.iAct})`);
  refus(o.iApres > o.iAct, `l'état est RELU après l'action (is-active #${o.iApres} > restart #${o.iAct})`);
  refus(M.appeleAvant(r.journal, 'id', 'systemctl'), 'les privilèges sont contrôlés (id) avant le premier appel systemctl');
  positif(o.ok, 'ordre complet : lecture, restart, relecture');

  // Contre-épreuve 1 : plus de lecture AVANT l'action.
  const sansAvant = scriptSvc({ conf: 'nginx.service', retouche: (t) => N.muter(t,
    'if [ "${KJEMO_UNITE_OK}" -eq 1 ]; then\n  KJEMO_ETAT="$(kjemo_etat_unite "${KJEMO_UNITE}")"',
    'if false; then\n  KJEMO_ETAT="$(kjemo_etat_unite "${KJEMO_UNITE}")"', 'état avant supprimé') });
  const c1 = ordreOk(runSvc(sansAvant));
  contre(!c1.ok && c1.iAvant === -1 || (c1.iAvant !== -1 && !(c1.iAvant < c1.iAct)),
    `lecture avant supprimée — l'ordre est cassé et le banc le DÉTECTE (is-active avant : #${c1.iAvant})`);
  // Contre-épreuve 2 : plus de relecture APRÈS l'action.
  const sansApres = scriptSvc({ conf: 'nginx.service', retouche: (t) => N.muter(t,
    "if ! kjemo_relire_unite \"${KJEMO_UNITE}\" \"${KJEMO_ATTENDU}\" 'apres action'; then", 'if false; then', 'relecture supprimée') });
  const c2 = ordreOk(runSvc(sansApres));
  contre(!c2.ok && c2.iApres === -1, `relecture supprimée — plus aucun is-active après l'action, et le banc le DÉTECTE (#${c2.iApres})`);
}

// ===========================================================================
// N05 — une relecture négative interdit de conclure au succès
// ===========================================================================
if (famille('N05', 'une relecture qui contredit l\'action fait échouer le script : « acceptée » n\'est pas « effective »', 4)) {
  const r = runSvc(scriptSvc({ conf: 'nginx.service' }), { apres: 'inactive' });
  refus(r.code === 1, `restart accepté mais service inactif ensuite : le script sort 1 (obtenu ${r.code})`);
  refus(/ARRET : l etat relu n est pas active/.test(r.sortie), 'le motif est NOMMÉ : « l etat relu n est pas active »');
  refus(AGISSANT(r).length === 1, `une seule action a eu lieu avant l'arrêt (${N.resume(AGISSANT(r))})`);
  const p = runSvc(scriptSvc({ conf: 'nginx.service' }), { apres: 'active' });
  positif(p.code === 0 && !/ARRET/.test(p.sortie), `service actif après restart : le script sort 0 sans ARRET (code ${p.code})`);
  const sansVerdict = scriptSvc({ conf: 'nginx.service', retouche: (t) => N.muter(t,
    "if ! kjemo_relire_unite \"${KJEMO_UNITE}\" \"${KJEMO_ATTENDU}\" 'apres action'; then", 'if false; then', 'verdict ignoré') });
  const c = runSvc(sansVerdict, { apres: 'inactive' });
  contre(c.code === 0, `verdict de relecture ignoré — le script sort 0 sur un service MORT, et le banc le DÉTECTE (code ${c.code})`);
}

// ===========================================================================
// N06 — les unités qui portent l'accès à la machine
// ===========================================================================
if (famille('N06', 'unités d\'accès (SSH, réseau) : jamais stop ni disable, même sur un script retouché à la main', 4)) {
  // Refus par le FORMULAIRE.
  const dv = { ...N.defauts(svc), format: 'Console' };
  const eForm = (u, a) => svc.validate({ ...dv, unite: u, action: a }).action;
  refus(typeof eForm('ssh.service', 'Arreter') === 'string', 'formulaire : « Arreter » sur ssh.service est refusé');
  refus(typeof eForm('ssh.service', 'Desactiver au demarrage') === 'string', 'formulaire : « Desactiver » sur ssh.service est refusé');
  refus(typeof eForm('NetworkManager.service', 'Arreter') === 'string', 'formulaire : « Arreter » sur NetworkManager.service est refusé');
  positif(eForm('ssh.service', 'Redemarrer') === undefined, 'formulaire : « Redemarrer » sur ssh.service reste permis (avec avertissement)');

  // Refus par le SCRIPT retouché : on remplace le verbe par stop / disable.
  const retouche = (unite, verbe) => (t) => {
    let x = t.split('nginx.service').join(unite);
    x = N.muter(x, "KJEMO_ACTION='Redemarrer'", `KJEMO_ACTION='retouche'`, 'action');
    x = N.muter(x, "KJEMO_VERBE='restart'", `KJEMO_VERBE='${verbe}'`, 'verbe');
    x = N.muter(x, "KJEMO_ATTENDU='active'", `KJEMO_ATTENDU='${verbe === 'stop' ? 'inactive' : ''}'`, 'attendu');
    return x;
  };
  for (const unite of ['ssh.service', 'sshd.service', 'ssh.socket', 'systemd-networkd.service', 'NetworkManager.service', 'networking.service']) {
    for (const verbe of ['stop', 'disable']) {
      const r = runSvc(scriptSvc({ conf: unite, unite: 'nginx.service', retouche: retouche(unite, verbe) }));
      const interdit = AGISSANT(r).filter((e) => new RegExp(`^${verbe}\\b`).test(e.args));
      refus(interdit.length === 0 && /Action refusee/.test(r.sortie),
        `script retouché « ${verbe} ${unite} » : refusé par la session, zéro appel (${N.resume(interdit)})`);
    }
  }
  // Positif : la même retouche sur une unité ORDINAIRE passe — le verrou ne bloque pas tout.
  const ord = runSvc(scriptSvc({ conf: 'nginx.service', retouche: retouche('nginx.service', 'stop') }), { apres: 'inactive' });
  positif(AGISSANT(ord).some((e) => /^stop -- nginx\.service$/.test(e.args)), 'stop sur nginx.service (ordinaire) est exécuté : le verrou ne bloque pas tout');
  const rest = runSvc(scriptSvc({ conf: 'ssh.service', unite: 'ssh.service' }), { env: { SSH_CONNECTION: '10.0.0.2 51000 10.0.0.9 22' } });
  positif(AGISSANT(rest).some((e) => /^restart -- ssh\.service$/.test(e.args)) && /Risque accepte/.test(rest.sortie),
    'restart sur ssh.service reste permis, avec le risque expliqué');

  // Contre-épreuve : on arrache le verrou de session.
  const desarme = (t) => N.muter(retouche('ssh.service', 'stop')(t),
    "KJEMO_SESSION_OK=0\n        kjemo_resultat 'Session' 'Action refusee'", "KJEMO_SESSION_OK=1\n        kjemo_resultat 'Session' 'Action refusee'", 'verrou de session');
  const c = runSvc(scriptSvc({ conf: 'ssh.service', retouche: desarme }), { apres: 'inactive' });
  contre(AGISSANT(c).some((e) => /^stop -- ssh\.service$/.test(e.args)),
    `verrou de session arraché — « systemctl stop ssh.service » a lieu, et le banc le DÉTECTE (${N.resume(AGISSANT(c))})`);
}

// ===========================================================================
// N07 — le verbe est pris dans une liste close
// ===========================================================================
if (famille('N07', 'verbe hors liste close : mask, isolate, kill et autres ne passent jamais', 4)) {
  const avecVerbe = (verbe) => (t) => {
    let x = N.muter(t, "KJEMO_VERBE='restart'", `KJEMO_VERBE='${verbe}'`, 'verbe');
    x = N.muter(x, "KJEMO_ATTENDU='active'", "KJEMO_ATTENDU=''", 'attendu');
    return x;
  };
  for (const verbe of ['mask', 'unmask', 'isolate', 'kill', 'daemon-reload', 'edit', 'poweroff', 'reboot', 'set-property']) {
    const r = runSvc(scriptSvc({ conf: 'nginx.service', retouche: avecVerbe(verbe) }));
    refus(r.code === 1 && /verbe non autorise/.test(r.sortie) && AGISSANT(r).length === 0,
      `verbe « ${verbe} » : sort 1, motif nommé, zéro appel modifiant (${N.resume(AGISSANT(r))})`);
  }
  for (const verbe of ['start', 'stop', 'restart', 'reload', 'enable', 'disable']) {
    const r = runSvc(scriptSvc({ conf: 'nginx.service', retouche: avecVerbe(verbe) }), { apres: 'active' });
    positif(AGISSANT(r).some((e) => new RegExp(`^${verbe} -- nginx\\.service$`).test(e.args)),
      `verbe autorisé « ${verbe} » : l'appel a lieu`);
  }
  const garde = "printf '%s\\n' 'ARRET : verbe non autorise. Ce script a ete modifie a la main.' >&2\n      exit 1";
  const desarme = (t) => N.muter(avecVerbe('mask')(t), garde, "printf '%s\\n' 'tolere' >&2\n      :", 'garde du verbe');
  const c = runSvc(scriptSvc({ conf: 'nginx.service', retouche: desarme }));
  contre(AGISSANT(c).some((e) => /^mask -- nginx\.service$/.test(e.args)),
    `garde du verbe arrachée — « systemctl mask » a lieu, et le banc le DÉTECTE (${N.resume(AGISSANT(c))})`);
}

// ===========================================================================
// Outillage commun aux familles de formulaire : N10 à N14
// ===========================================================================
const valeurs = (t, ch = {}) => ({ ...N.defauts(t), format: 'Console', ...ch });
const erreurDe = (t, champ, ch) => t.validate(valeurs(t, ch))[champ];
const refuse = (t, champ, v, ch = {}) => typeof erreurDe(t, champ, { ...ch, [champ]: v }) === 'string';

/**
 * Éprouve une liste de valeurs refusées et une liste de valeurs acceptées sur
 * l'outil intact, puis rejoue les valeurs refusées sur une copie de dist/
 * dont le verrou est ARRACHÉ : au moins une valeur doit alors passer.
 */
async function familleFormulaire({ outilId, champ, refusees, acceptees, ch = {}, mutations }) {
  const t = outil(outilId);
  for (const v of refusees) refus(refuse(t, champ, v, ch), `${outilId}.${champ} : « ${String(v).slice(0, 40)} » est refusé par le formulaire`);
  for (const v of acceptees) positif(!refuse(t, champ, v, ch), `${outilId}.${champ} : « ${String(v).slice(0, 40)} » est accepté`);
  for (const m of mutations) {
    const d = await N.distMutee(m.fichier, m.de, m.vers, m.nom);
    try {
      const tm = d.tools.find((x) => x.id === outilId);
      const passes = refusees.filter((v) => !refuse(tm, champ, v, ch));
      contre(passes.length > 0, `${m.nom} — verrou arraché : ${passes.length} valeur(s) refusée(s) deviennent ACCEPTÉES (${passes.slice(0, 3).map((v) => `« ${v} »`).join(', ')}), et le banc le DÉTECTE`);
      // Le témoin : la mutation ne casse pas les valeurs légitimes.
      positif(acceptees.every((v) => !refuse(tm, champ, v, ch)), `${m.nom} — les valeurs légitimes restent acceptées sur la copie mutilée`);
    } finally { d.nettoyer(); }
  }
}

// ===========================================================================
// N08 — le gardien de chemin
// ===========================================================================
if (famille('N08', 'chemins protégés : zones système, segments sensibles, liens symboliques — refusés par le SCRIPT', 4)) {
  const pc = outil('linux-permission-change');
  const groupe = (bac) => M.poserMouchard(bac, 'getent', { code: 0, avant: ["printf '%s\\n' 'partage:x:1500:'"] });
  const scriptPc = (chemin, mut = null) => {
    const v = valeurs(pc, { chemin, proprietaire: '', groupe: 'partage', mode: '2770', recursif: 'Non' });
    const phrase = N.phraseStatique(brut(pc, { ...v, confirmation: '' }));
    const t = brut(pc, { ...v, confirmation: phrase });
    return mut ? mut(t) : t;
  };
  const strict = (r) => N.appelsModifiants(r.journal, []);
  const lancerPc = (cheminDe, mut = null) => N.lancer((bac) => scriptPc(cheminDe(bac), mut), { nom: 'n08', extra: (bac) => { groupe(bac); } });
  const lienVersEtc = (bac) => { symlinkSync('/etc', join(bac.travail, 'lien')); return join(bac.travail, 'lien', 'ssh'); };

  const dossierSegment = (...parts) => (bac) => { const d = join(bac.travail, ...parts); mkdirSync(d, { recursive: true }); return d; };
  const HOSTILES = [
    ['/', 'racine du systeme de fichiers'], ['/etc', 'zone systeme /etc'], ['/etc/ssh/sshd_config', 'zone systeme /etc'],
    ['/boot/grub', 'zone systeme /boot'], ['/usr/bin/sudo', 'zone systeme /usr'], ['/bin', /zone systeme \/(bin|usr)/],
    ['/root/.bashrc', 'zone systeme /root'], ['/proc/1/mem', 'zone systeme /proc'], ['/sys/kernel', 'zone systeme /sys'],
    ['/dev/sda', 'zone systeme /dev'], ['/home', 'racine des dossiers personnels'], ['/lib/modules', /zone systeme \/(lib|usr)/],
    ['/var/lib/dpkg/status', 'zone systeme /var/lib/dpkg'],
    [dossierSegment('projet', '.git', 'config'), 'segment protege .git'], [dossierSegment('projet', '.GIT', 'config'), 'segment protege .git'],
    [dossierSegment('u', '.ssh', 'cles'), 'segment protege .ssh'], [dossierSegment('app', '.env'), 'segment protege .env'],
    [dossierSegment('app', 'node_modules', 'x'), 'segment protege node_modules'], [dossierSegment('u', '.gnupg', 'k'), 'segment protege .gnupg'],
    [dossierSegment('u', '.aws', 'c'), 'segment protege .aws'],
  ];
  for (const [chemin, zone] of HOSTILES) {
    const r = lancerPc((bac) => (typeof chemin === 'function' ? chemin(bac) : chemin));
    const nomme = zone instanceof RegExp ? zone.test(r.sortie) : r.sortie.includes(zone);
    refus(r.code === 1 && r.sortie.includes('Zone protegee detectee') && nomme && strict(r).length === 0,
      `permission-change « ${typeof chemin === 'function' ? 'dossier de travail avec ' + zone : chemin} » : sort 1, zone NOMMÉE (${zone}), zéro chmod/chown (${N.resume(strict(r))})`);
  }
  {
    const r = lancerPc(lienVersEtc);
    refus(r.code === 1 && r.sortie.includes('zone systeme /etc') && strict(r).length === 0,
      `permission-change : un lien symbolique vers /etc est CANONISÉ puis refusé (code ${r.code}, ${N.resume(strict(r))})`);
  }
  // Les autres assistants qui prennent un chemin libre portent le même gardien.
  for (const [id, champ] of [['bash-backup-directory', 'source'], ['linux-permission-acl', 'chemin']]) {
    const t = outil(id);
    for (const chemin of ['/etc', '/root', '/srv/projet/.ssh/k']) {
      const r = N.lancer((bac) => {
        const v = N.valeursDansLeBac(t, bac, { [champ]: chemin });
        const phrase = N.phraseStatique(brut(t, { ...v, [N.champConfirmation(t)]: '' }));
        return brut(t, { ...v, [N.champConfirmation(t)]: phrase ?? '' });
      }, { nom: 'n08b', extra: groupe });
      const mod = N.appelsModifiants(r.journal, []);
      refus(r.code === 1 && /Zone protegee detectee/.test(r.sortie) && mod.length === 0,
        `${id}.${champ} « ${chemin} » : refusé par le gardien, zéro appel modifiant (code ${r.code}, ${N.resume(mod)})`);
    }
  }

  // Positif : un dossier de travail ordinaire passe le gardien et reçoit chown puis chmod.
  const ok = lancerPc((bac) => { const d = join(bac.travail, 'dossier'); mkdirSync(d, { recursive: true }); return d; });
  positif(!/Zone protegee/.test(ok.sortie) && strict(ok).length === 2, `un dossier ordinaire passe le gardien : 2 appels (${N.resume(strict(ok))})`);
  positif(strict(ok).some((e) => e.nom === 'chown' && /:partage/.test(e.args)) && strict(ok).some((e) => e.nom === 'chmod' && /2770/.test(e.args)),
    'chown « :partage » puis chmod « 2770 » : les arguments sont ceux du formulaire');
  positif(M.appeleAvant(ok.journal, 'chown', 'chmod'), 'ordre : le groupe est posé AVANT le mode (le chown peut effacer setgid)');

  // Contre-épreuves : on arrache chaque étage du gardien.
  const sansRacines = (t) => N.muter(t, 'if kjemo_sous_racine "${canon}" "${racine}"; then', 'if false; then', 'racines du gardien');
  const c1 = lancerPc(() => '/etc/ssh/sshd_config', sansRacines);
  contre(strict(c1).length >= 1, `racines système arrachées — chmod/chown sur /etc/ssh/sshd_config a lieu, et le banc le DÉTECTE (${N.resume(strict(c1))})`);
  const sansSegments = (t) => N.muter(t, `if [ "\${seg}" = "$(printf '%s' "\${protege}" | tr '[:upper:]' '[:lower:]')" ]; then`, 'if false; then', 'segments du gardien');
  const c2 = lancerPc(dossierSegment('projet', '.git', 'config'), sansSegments);
  contre(strict(c2).length >= 1, `segments sensibles arrachés — chmod/chown dans .git a lieu, et le banc le DÉTECTE (${N.resume(strict(c2))})`);
  const sansCanon = (t) => N.muter(t, 'canon="$(realpath -m -- "${brut}" 2>/dev/null)" || return 1', 'canon="${brut}"', 'canonisation du gardien');
  const c3 = lancerPc(lienVersEtc, sansCanon);
  contre(strict(c3).length >= 1, `canonisation arrachée — le lien vers /etc passe et chmod/chown a lieu, et le banc le DÉTECTE (${N.resume(strict(c3))})`);
}

// ===========================================================================
// N09 — les champs libres n'exécutent rien
// ===========================================================================
if (famille('N09', 'injection : aucune saisie ne devient une commande (substitution, point-virgule, retour à la ligne, guillemets)', 4)) {
  const CHARGES = [
    (c) => `x$(touch ${c})y`, (c) => `x\`touch ${c}\`y`, (c) => `x; touch ${c} ;y`, (c) => `x\ntouch ${c}\ny`,
    (c) => `x' ; touch ${c} ; 'y`, (c) => `x" ; touch ${c} ; "y`, (c) => `x && touch ${c}`, (c) => `x | touch ${c}`,
    (c) => `x\${IFS}$(touch ${c})`,
  ];
  let parForm = 0; let parQuote = 0; let executions = 0; let canaris = 0;
  for (const t of linux) {
    for (const f of t.fields ?? []) {
      if (f.options || /^format$/i.test(f.id)) continue;
      const estConf = /confirm/i.test(f.id);
      for (const charge of (estConf ? CHARGES.slice(0, 3) : CHARGES)) {
        const err = t.validate(valeurs(t, { [f.id]: charge('/tmp/canari-validation') }))[f.id];
        if (typeof err === 'string') { parForm += 1; continue; }
        const r = N.lancer((bac) => brut(t, N.valeursDansLeBac(t, bac, { [f.id]: charge(join(bac.travail, 'canari')) })), {
          nom: 'n09', apres: (bac) => existsSync(join(bac.travail, 'canari')),
        });
        executions += 1; parQuote += 1;
        if (r.lu === true) { canaris += 1; refus(false, `${t.id}.${f.id} : la saisie a EXÉCUTÉ « touch » (canari créé) avec la charge ${CHARGES.indexOf(charge)}`); }
      }
    }
  }
  refus(canaris === 0, `${executions} exécutions avec une charge dans un champ libre accepté : aucun canari créé`);
  refus(parForm > 100, `${parForm} saisies hostiles refusées par le FORMULAIRE avant toute génération`);
  positif(executions >= 50 && parQuote === executions, `${executions} charges ont traversé le formulaire et le script (la citation shQuote les a rendues littérales)`);

  // Positif de la mesure : le détecteur de canari voit un script volontairement vulnérable.
  const vuln = N.lancer((bac) => `#!/usr/bin/env bash\nVAL='x$(touch ${join(bac.travail, 'canari')})y'\neval "echo ${'$'}VAL" > /dev/null\n`, {
    nom: 'n09v', apres: (bac) => existsSync(join(bac.travail, 'canari')),
  });
  positif(vuln.lu === true, 'le détecteur de canari VOIT un script volontairement vulnérable (eval d\'une saisie)');

  // Contre-épreuve : la citation est arrachée dans une copie de dist/.
  const d = await N.distMutee('noyau-bash.mjs', "return `'${s.split(\"'\").join(\"'\\\\''\")}'`;", 'return `"${s}"`;', 'shQuote arraché (guillemets doubles : $(…) s\'exécute encore)');
  try {
    const lg = d.tools.find((x) => x.id === 'linux-log-diagnostic');
    const { normalizeScriptSh: norm } = await import(`${pathToFileURL(join(d.dossier, 'noyau-bash.mjs')).href}?v=${Date.now()}`);
    const rm = N.lancer((bac) => norm(lg.generate(valeurs(lg, { motif: `x$(touch ${join(bac.travail, 'canari')})y` }))), {
      nom: 'n09c', apres: (bac) => existsSync(join(bac.travail, 'canari')),
    });
    contre(rm.lu === true, 'shQuote arraché — la saisie « $(touch …) » S\'EXÉCUTE, et le banc le DÉTECTE par le canari');
  } finally { d.nettoyer(); }
}

// ===========================================================================
// N10 — modes de permissions dangereux, récursion sur une racine
// ===========================================================================
if (famille('N10', 'permissions : 777, setuid, setgid sur fichier, récursion sur une racine système', 3)) {
  await familleFormulaire({
    outilId: 'linux-permission-change', champ: 'mode',
    refusees: ['777', '0777', '1777', '2777', '666', '0666', '4755', '6755', '7755', '4000', '4750', '7000', 'abc', '77', '99999'],
    acceptees: ['750', '640', '2770', '1770', '0750', '2750', '770', '700', '600'],
    mutations: [
      { nom: 'N10 règle 777/666 arrachée', fichier: 'outils-linux-g.mjs', de: '} else if (/[0-7]?777$/.test(mode) || /[0-7]?666$/.test(mode)) {', vers: '} else if (false) {' },
      { nom: 'N10 règle setuid arrachée', fichier: 'outils-linux-g.mjs', de: '} else if (mode.length === 4 && /^[467]/.test(mode)) {', vers: '} else if (false) {' },
    ],
  });
  await familleFormulaire({
    outilId: 'linux-permission-change', champ: 'chemin', ch: { recursif: 'Oui' },
    refusees: ['/', '/etc', '/home', '/usr', '/var', '/boot', '/root'],
    acceptees: ['/srv/donnees/equipe'],
    mutations: [{ nom: 'N10 récursion sur racine arrachée', fichier: 'outils-linux-g.mjs', de: 'if (RECURSIF_REFUSE.includes(c)) {', vers: 'if (false) {' }],
  });
}

// ===========================================================================
// N11 — noms de comptes, de groupes et groupes privilégiés
// ===========================================================================
if (famille('N11', 'comptes et groupes : comptes système, noms invalides, groupes qui donnent des privilèges', 3)) {
  await familleFormulaire({
    outilId: 'linux-user-create', champ: 'nomUtilisateur',
    refusees: ['root', 'daemon', 'sshd', 'nobody', 'www-data', 'Bad', 'a b', '1abc', '-x', 'a$(id)', 'a;b', '', 'a'.repeat(33)],
    acceptees: ['etudiant', '_svc', 'jean-marc', 'a1'],
    mutations: [
      { nom: 'N11 comptes réservés arrachés', fichier: 'validateurs-linux.mjs', de: 'if (RESERVES.includes(s)) {', vers: 'if (false) {' },
      { nom: 'N11 syntaxe du nom de compte arrachée', fichier: 'validateurs-linux.mjs',
        de: "dépasse 32 caractères, la limite de useradd.` };\n  }\n  if (!/^[a-z_][a-z0-9_-]*$/.test(s)) {", vers: "dépasse 32 caractères, la limite de useradd.` };\n  }\n  if (false) {" },
    ],
  });
  await familleFormulaire({
    outilId: 'linux-user-create', champ: 'groupesSecondaires',
    refusees: ['sudo', 'root', 'docker', 'adm', 'shadow', 'sudo,partage', 'a b'],
    acceptees: ['partage', 'partage,lecture', 'a,b'],
    mutations: [{ nom: 'N11 groupes privilégiés arrachés', fichier: 'outils-linux-g.mjs',
      de: "const GROUPES_PRIVILEGIES = ['root', 'sudo', 'admin', 'adm', 'shadow', 'wheel',\n  'docker', 'lxd', 'disk', 'kvm', 'libvirt'];", vers: 'const GROUPES_PRIVILEGIES = [];' }],
  });
  await familleFormulaire({
    outilId: 'linux-user-create', champ: 'shell',
    refusees: ['/bin/sh', '/bin/bash;id', ''],
    acceptees: ['/bin/bash', '/usr/sbin/nologin'],
    mutations: [],
  });
}

// ===========================================================================
// N12 — disques, points de montage, membres RAID
// ===========================================================================
if (famille('N12', 'stockage : points de montage système, nœuds hors /dev, disque monté ou porteur du système', 4)) {
  await familleFormulaire({
    outilId: 'linux-disk-partition-mount', champ: 'pointMontage',
    refusees: ['/', '/etc', '/boot', '/usr', '/var', '/bin', '/proc', '/dev', '/home', 'rel'],
    acceptees: ['/srv/donnees', '/mnt/data'],
    mutations: [],
  });
  await familleFormulaire({
    outilId: 'linux-disk-partition-mount', champ: 'peripherique',
    refusees: ['/dev/sdb1', '/dev/nvme0n1p1', '/dev/dm-0', '/dev/mapper/x', '/etc/passwd', 'sdb', '/dev/sdb;id', '/dev/loop0', '/dev/disk/by-id/x'],
    acceptees: ['/dev/sdb', '/dev/sda', '/dev/nvme0n1', '/dev/vda'],
    mutations: [],
  });
  const raid = outil('linux-raid1-create');
  refus(refuse(raid, 'membre2', '/dev/sdb'), 'raid1 : deux membres identiques sont refusés (un miroir sur un seul disque ne protège de rien)');
  refus(refuse(raid, 'pointMontage', '/'), 'raid1 : « / » comme point de montage est refusé');
  positif(!refuse(raid, 'membre2', '/dev/sdc'), 'raid1 : deux disques différents sont acceptés');

  // Le SCRIPT : la cible n'est pas un disque.
  const dk = outil('linux-disk-partition-mount');
  const phraseDe = (ch) => N.phraseStatique(brut(dk, valeurs(dk, { ...ch, confirmation: '' })));
  for (const dev of ['/dev/null', '/dev/zero']) {
    const r = N.lancer(brut(dk, valeurs(dk, { peripherique: dev, confirmation: phraseDe({ peripherique: dev }) })), { nom: 'n12' });
    const mod = N.appelsModifiants(r.journal, r.racinesPropres);
    refus(/\[PROBLEME\] Cible \/ /.test(r.sortie) && mod.length === 0,
      `disque : « ${dev} » avec la phrase exacte — Cible en PROBLÈME, zéro sfdisk/mkfs/wipefs modifiant (${N.resume(mod)})`);
  }
  // Les verrous de CIBLE et de DISQUE LIBRE, éprouvés SEULS (le script entier écrirait dans /etc/fstab).
  const txt = brut(dk, valeurs(dk, { confirmation: '' }));
  const cible = N.extraireEntre(txt, 'KJEMO_CIBLE_OK=0\nif [ ! -b "${KJEMO_DEV}" ]; then', '\n# ---------------------------------------------------------------------------\n# ETAPE 3');
  const libre = N.extraireEntre(txt, 'KJEMO_LIBRE_OK=1\nif [ "${KJEMO_CIBLE_OK}" -eq 1 ]; then', '\n# ---------------------------------------------------------------------------\n# ETAPE 4');
  const blocLsblk = (sortieType, sortieArbre) => (bac) => {
    M.poserMouchard(bac, 'lsblk', { code: 0, avant: [
      `case "$*" in *'-P'*) printf '%s\\n' ${sq(sortieArbre)};; *'TYPE'*) printf '%s\\n' ${sq(sortieType)};; *) printf '%s\\n' '10G';; esac`, 'exit 0'] });
  };
  // Un nœud bloc réel, si le conteneur l'autorise (mknod). Sinon : NON EXÉCUTÉ, dit.
  const nœud = join(tmpdirLocal(), `kjemo-blk-${process.pid}`);
  let aNoeud = false;
  try { execFileSync('mknod', [nœud, 'b', '7', '99']); aNoeud = true; } catch { aNoeud = false; }
  if (!aNoeud) nonExecutes.push('N12 : mknod impossible dans ce conteneur — le contrôle positif « cible = disque » (nœud bloc réel) n\'a pas été joué');
  const evalCible = (dev, type, texteCible = cible) => N.executerMorceau(texteCible, {
    avant: `KJEMO_DEV=${sq(dev)}`, apres: 'printf "OK=%s\\n" "${KJEMO_CIBLE_OK}"', extra: blocLsblk(type, ''),
  }).sortie.match(/OK=(\d)/)?.[1];
  refus(evalCible('/dev/null', 'disk') === '0', 'cible : « /dev/null » (pas un nœud bloc) → KJEMO_CIBLE_OK=0 même si lsblk prétend « disk »');
  if (aNoeud) {
    refus(evalCible(nœud, 'part') === '0', 'cible : un nœud bloc de type « part » (une partition) → KJEMO_CIBLE_OK=0');
    refus(evalCible(nœud, 'loop') === '0', 'cible : un nœud bloc de type « loop » → KJEMO_CIBLE_OK=0');
    positif(evalCible(nœud, 'disk') === '1', 'cible : un vrai nœud bloc de type « disk » → KJEMO_CIBLE_OK=1 (contrôle positif)');
    const sansBloc = N.muter(cible, 'if [ ! -b "${KJEMO_DEV}" ]; then', 'if false; then', 'test nœud bloc');
    contre(evalCible('/dev/null', 'disk', sansBloc) === '1', 'test « -b » arraché — /dev/null passe pour un disque, et le banc le DÉTECTE');
    const sansType = N.muter(cible, `if [ "\${kjemo_type_dev}" = 'disk' ]; then`, 'if true; then', 'test du type');
    contre(evalCible(nœud, 'part', sansType) === '1', 'test du type arraché — une partition passe pour un disque, et le banc le DÉTECTE');
    try { rmSync(nœud, { force: true }); } catch { /* sans importance */ }
  } else {
    // Sans nœud bloc, la contre-épreuve porte sur le seul test « -b ».
    const sansBloc = N.muter(cible, 'if [ ! -b "${KJEMO_DEV}" ]; then', 'if false; then', 'test nœud bloc');
    positif(evalCible('/dev/null', 'disk', sansBloc) !== undefined, 'cible : le morceau mutilé s\'exécute (mesure possible sans nœud bloc)');
    contre(evalCible('/dev/null', 'disk', sansBloc) === '1', 'test « -b » arraché — /dev/null passe pour un disque, et le banc le DÉTECTE');
  }
  // Disque libre : monté, porteur du système, swap, LVM, RAID, LUKS.
  const evalLibre = (arbre, texteLibre = libre) => N.executerMorceau(texteLibre, {
    avant: `KJEMO_DEV='/dev/sdb'\nKJEMO_CIBLE_OK=1\nKJEMO_FSTAB="\${KJEMO_TMP}/fstab"\n: > "\${KJEMO_FSTAB}"`,
    apres: 'printf "LIBRE=%s\\n" "${KJEMO_LIBRE_OK}"', extra: blocLsblk('disk', arbre),
  }).sortie.match(/LIBRE=(\d)/)?.[1];
  const ligne = (p, f, m) => `PATH="${p}" TYPE="part" FSTYPE="${f}" MOUNTPOINTS="${m}"`;
  const OCCUPES = [
    ['monté sur /srv/x', ligne('/dev/sdb1', 'ext4', '/srv/x')], ['porteur de /', ligne('/dev/sdb1', 'ext4', '/')],
    ['porteur de /boot', ligne('/dev/sdb2', 'vfat', '/boot')], ['swap', ligne('/dev/sdb2', 'swap', '')],
    ['membre LVM', ligne('/dev/sdb1', 'LVM2_member', '')], ['membre RAID', ligne('/dev/sdb1', 'linux_raid_member', '')],
    ['chiffré LUKS', ligne('/dev/sdb1', 'crypto_LUKS', '')],
  ];
  for (const [nom, arbre] of OCCUPES) refus(evalLibre(arbre) === '0', `disque libre : ${nom} → KJEMO_LIBRE_OK=0`);
  positif(evalLibre(ligne('/dev/sdb', '', '')) === '1', 'disque libre : un disque ni monté ni réservé → KJEMO_LIBRE_OK=1 (contrôle positif)');
  const libreArrache = N.muterN(libre, 'KJEMO_LIBRE_OK=0', 'KJEMO_LIBRE_OK=1', 8, 'fermetures du verrou de disque libre');
  contre(OCCUPES.every(([, arbre]) => evalLibre(arbre, libreArrache) === '1'),
    'fermetures du verrou arrachées — les SEPT disques occupés passent pour libres, et le banc le DÉTECTE');
}

// ===========================================================================
// N13 — clients NFS et hôtes Samba : jamais « tout le monde »
// ===========================================================================
if (famille('N13', 'exports : client « * », joker, /0, caractères de contrôle — refusés', 3)) {
  const REFUSEES = ['*', '*.lab.local', 'poste?.lab.local', '0.0.0.0/0', '10.0.0.0/0', '300.1.1.1', '10.0.0.0/33', '10.0.0.1;rm', '10.0.0.1(rw)', '$(id)', 'a b', ''];
  const ACCEPTEES = ['192.168.30.0/24', '192.168.30.5', 'poste-labo.kjemo.local', 'localhost', '10.0.0.0/8'];
  await familleFormulaire({
    outilId: 'nfs-export-create', champ: 'client', refusees: REFUSEES, acceptees: ACCEPTEES,
    mutations: [
      // La règle dédiée au joker est DOUBLÉE par l'expression de nom d'hôte, qui refuse
      // aussi « * » et « ? » : c'est une défense en profondeur. Arracher la règle seule ne
      // changerait rien (0 valeur nouvellement acceptée) ; le verrou ne tombe qu'avec les deux étages.
      { nom: 'N13 joker « * » arraché (règle dédiée ET repli nom d\'hôte)', fichier: 'validateurs-linux.mjs',
        de: ["if (s === '*' || s.includes('*') || s.includes('?')) {", "if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(s)) {"],
        vers: ['if (false) {', 'if (true) {'] },
      { nom: 'N13 préfixe /0 arraché', fichier: 'validateurs-linux.mjs', de: 'if (p === 0) {', vers: 'if (false) {' },
    ],
  });
  const smb = outil('samba-share-create');
  for (const v of ['*', '*.lab.local', '0.0.0.0/0']) refus(refuse(smb, 'hotesAutorises', v), `samba-share-create.hotesAutorises : « ${v} » est refusé`);
  positif(!refuse(smb, 'hotesAutorises', '192.168.30.0/24'), 'samba-share-create.hotesAutorises : un réseau précis est accepté');
}

// ===========================================================================
// N14 — ports
// ===========================================================================
if (famille('N14', 'ports TCP : 0, 65536, négatif, texte, injection — refusés', 3)) {
  const REFUSEES = ['0', '65536', '-1', '22;id', '', 'abc', '22.5', '1e3', ' ', '99999999', '0x16'];
  const ACCEPTEES = ['1', '22', '2222', '9090', '65535'];
  const CIBLES = [['ssh-server-readiness', 'port'], ['ssh-client-diagnostic', 'port'], ['cockpit-install-readiness', 'port'],
    ['cockpit-connection-diagnostic', 'port'], ['linux-firewall-audit', 'portVerifie']];
  for (const [id, champ] of CIBLES) {
    await familleFormulaire({
      outilId: id, champ, refusees: id === 'linux-firewall-audit' ? REFUSEES.filter((v) => v.trim() !== '') : REFUSEES, acceptees: ACCEPTEES,
      mutations: id === 'ssh-server-readiness' ? [
        { nom: 'N14 bornes du port arrachées', fichier: 'validateurs-linux.mjs', de: 'if (n < min || n > max) {', vers: 'if (false) {' },
        { nom: 'N14 syntaxe du port arrachée', fichier: 'validateurs-linux.mjs', de: 'if (!/^\\d+$/.test(s)) {', vers: 'if (false) {' },
      ] : [],
    });
  }
}

// ===========================================================================
// N15 — SSH : on ne durcit pas sans second accès PROUVÉ
// ===========================================================================
if (famille('N15', 'SSH anti-verrouillage : pas de durcissement sans second accès administrateur prouvé (compte, groupe, clé, permissions)', 4)) {
  const ssh = outil('ssh-hardening-audit');
  const FICHIER = '99-kjemo-durcissement.conf';
  /**
   * Un bac SSH. Les quatre preuves sont réglables une à une ; `include` règle le
   * fichier principal ; `sshdTest` règle le code de « sshd -t ».
   */
  const scenario = ({ compte = 'admin', existe = true, groupes = 'admin sudo', cle = 'valide', modeMaison = '750',
    include = true, sshdTest = 0, conf = 'EXACTE', demande = true, mut = null } = {}) => {
    return N.lancer((bac) => {
      const maison = join(bac.travail, 'maison-admin');
      mkdirSync(join(maison, '.ssh'), { recursive: true });
      chmodSync(maison, parseInt(modeMaison, 8));
      if (cle === 'valide') writeFileSync(join(maison, '.ssh', 'authorized_keys'), '# cle de test\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJEMOTEST admin@test\n', 'utf8');
      if (cle === 'vide') writeFileSync(join(maison, '.ssh', 'authorized_keys'), '# aucune cle ici\n\n', 'utf8');
      const principal = join(bac.travail, 'sshd_config');
      writeFileSync(principal, include ? 'Include /etc/ssh/sshd_config.d/*.conf\nPort 22\n' : 'Port 22\n', 'utf8');
      const v = valeurs(ssh, { compteAdminProuve: compte, desactiverMotDePasse: demande ? 'Oui' : 'Non', interdireRoot: demande ? 'Oui' : 'Non' });
      const phrase = N.phraseStatique(brut(ssh, { ...v, confirmation: '' }));
      let t = brut(ssh, { ...v, confirmation: conf === 'EXACTE' ? (phrase ?? '') : conf });
      t = N.muter(t, 'if [ ! -r /etc/ssh/sshd_config ]; then', `if [ ! -r '${principal}' ]; then`, 'redirection sshd_config (1)');
      t = N.muter(t, ".conf' /etc/ssh/sshd_config; then", `.conf' '${principal}'; then`, 'redirection sshd_config (2)');
      t = N.muter(t, "Include' /etc/ssh/sshd_config | head", `Include' '${principal}' | head`, 'redirection sshd_config (3)');
      return mut ? mut(t) : t;
    }, {
      nom: 'n15',
      apres: (bac) => readdirSync(bac.travail).filter((n) => n === FICHIER),
      extra: (bac) => {
        const maison = join(bac.travail, 'maison-admin');
        M.poserMouchard(bac, 'sshd', { code: 0, avant: [
          `if printf '%s' "$*" | grep -qE -- '(^| )-T'; then printf '%s\\n' 'port 22' 'permitrootlogin yes' 'passwordauthentication yes' 'kbdinteractiveauthentication yes' 'usepam yes' 'pubkeyauthentication yes'; exit 0; fi`,
          `if printf '%s' "$*" | grep -qE -- '(^| )-t'; then exit ${sshdTest}; fi`, 'exit 0'] });
        M.poserMouchard(bac, 'getent', { code: 0, avant: [
          existe ? `printf '%s\\n' ${sq(`${compte}:x:1000:1000:Admin:${maison}:/bin/bash`)}` : ':', 'exit 0'] });
        M.poserMouchard(bac, 'id', { code: 0, avant: [
          `if printf '%s' "$*" | grep -qE -- '-nG'; then printf '%s\\n' ${sq(groupes)}; exit 0; fi`, 'exec /usr/bin/id "$@"'] });
      },
    });
  };
  const livre = (r) => r.lu.length === 1;
  const ecritures = (r) => N.appelsModifiants(r.journal, r.racinesPropres);

  // --- positif : tout est prouvé ------------------------------------------
  const ok = scenario();
  positif(livre(ok) && ok.code === 0, `second accès PROUVÉ : le fichier prepare est remis dans le dossier personnel (code ${ok.code}, remis ${ok.lu.length})`);
  positif(ecritures(ok).length === 0, `même remis, le script n'appelle aucune commande modifiante : sshd -T/-t lisent seulement (${N.resume(ecritures(ok))})`);
  positif(M.compterAppels(ok.journal, 'systemctl') === 0, 'même remis, le script ne touche pas au service : aucun appel à systemctl (le rechargement reste à la main)');
  positif(M.compterAppels(ok.journal, 'sshd', '(^| )-t') >= 1, 'sshd -t VALIDE la copie avant la remise');
  positif(M.compterAppels(ok.journal, 'sshd') === M.compterAppels(ok.journal, 'sshd', '(^| )-[tT]'), 'tout appel à sshd est -t ou -T : jamais un démon démarré');

  // --- refus : une preuve manque ------------------------------------------
  const SANS_PREUVE = [
    ['audit seul : aucun durcissement demandé, aucun compte nommé', { compte: '', demande: false }],
    ['compte inexistant', { existe: false }],
    ['compte hors groupes d\'administration (groupes : users staff)', { groupes: 'users staff' }],
    ['authorized_keys absent', { cle: 'absente' }],
    ['authorized_keys sans clé utile', { cle: 'vide' }],
    ['dossier personnel en 775 (StrictModes refuserait la clé)', { modeMaison: '775' }],
    ['confirmation absente', { conf: '' }],
    ['sshd -t refuse la configuration préparée', { sshdTest: 1 }],
    ['fichier principal sans Include', { include: false }],
  ];
  for (const [nom, ch] of SANS_PREUVE) {
    const r = scenario(ch);
    refus(!livre(r) && /AUCUNE MODIFICATION/.test(r.sortie) && r.code === 0,
      `${nom} : rien n'est remis, « AUCUNE MODIFICATION » (remis ${r.lu.length}, code ${r.code})`);
    refus(r.journal.some((e) => e.nom === 'sshd'), `${nom} : le script a atteint l'audit (sshd appelé) — il ne s'est pas arrêté avant`);
  }

  // Le FORMULAIRE refuse un durcissement sans compte nommé.
  refus(refuse(ssh, 'compteAdminProuve', '', { desactiverMotDePasse: 'Oui' }), 'formulaire : durcir sans nommer de compte administrateur est refusé');
  refus(refuse(ssh, 'compteAdminProuve', '', { interdireRoot: 'Oui' }), 'formulaire : interdire root sans nommer de compte administrateur est refusé');
  positif(!refuse(ssh, 'compteAdminProuve', '', {}), 'formulaire : l\'audit seul (rien demandé) n\'exige aucun compte');
  {
    const d = await N.distMutee('outils-linux-j.mjs', "if (demande && admin === '') {", 'if (false) {', 'N15 refus formulaire arraché');
    try {
      const tm = d.tools.find((x) => x.id === 'ssh-hardening-audit');
      contre(!refuse(tm, 'compteAdminProuve', '', { desactiverMotDePasse: 'Oui' }),
        'refus du formulaire arraché — durcir sans compte nommé devient ACCEPTÉ, et le banc le DÉTECTE');
    } finally { d.nettoyer(); }
  }

  // --- contre-épreuves -----------------------------------------------------
  const sansPreuve = (t) => N.muter(t, 'if [ "${KJEMO_PREUVE_OK:-0}" -ne 1 ]; then', 'if false; then', 'condition « second accès prouvé »');
  const c1 = scenario({ cle: 'absente', mut: sansPreuve });
  contre(livre(c1), `condition « second accès prouvé » arrachée — le fichier est remis SANS clé autorisée, et le banc le DÉTECTE (remis ${c1.lu.length})`);
  const sansValidation = (t) => N.muter(t, 'if [ "${KJEMO_VALIDE_OK:-0}" -ne 1 ]; then', 'if false; then', 'condition « sshd accepte »');
  const c2 = scenario({ sshdTest: 1, mut: sansValidation });
  contre(livre(c2), `condition « sshd accepte » arrachée — une configuration REFUSÉE par sshd est remise, et le banc le DÉTECTE (remis ${c2.lu.length})`);
  const sansModes = (t) => N.muter(t, 'if [ "${KJEMO_PREUVE_OK:-0}" -ne 1 ]; then', 'if false; then', 'condition « second accès prouvé »');
  const c3 = scenario({ modeMaison: '775', mut: sansModes });
  contre(livre(c3), `permissions du dossier personnel ignorées — une clé que StrictModes refuserait est jugée suffisante, et le banc le DÉTECTE (remis ${c3.lu.length})`);
  // La contre-épreuve de la mesure : un systemctl glissé dans le script est vu.
  const rechargeur = scenario({ mut: (t) => N.muter(t, "printf '%s\\n' '     sudo sshd -t'", "printf '%s\\n' '     sudo sshd -t'\n  systemctl reload ssh", 'rechargement glissé') });
  contre(ecritures(rechargeur).some((e) => e.nom === 'systemctl' && /^reload/.test(e.args)),
    `un « systemctl reload ssh » glissé dans la remise est DÉTECTÉ par le journal (${N.resume(ecritures(rechargeur))})`);
}

// ===========================================================================
// N16 — Netplan : jamais appliqué, toujours validé sur une copie
// ===========================================================================
if (famille('N16', 'Netplan : jamais « apply » ni « try », validation sur une copie AVANT la remise, jamais dans /etc/netplan', 4)) {
  const np = outil('netplan-readiness');
  const scenario = ({ generate = 0, interfaceExiste = true, conf = 'EXACTE', mut = null, ch = {} } = {}) => N.lancer((bac) => {
    const v = valeurs(np, ch);
    const phrase = N.phraseStatique(brut(np, { ...v, confirmation: '' }));
    const t = brut(np, { ...v, confirmation: conf === 'EXACTE' ? (phrase ?? '') : conf });
    return mut ? mut(t) : t;
  }, {
    nom: 'n16',
    apres: (bac) => readdirSync(bac.travail).filter((n) => /^kjemo-netplan-.*\.yaml$/.test(n)),
    extra: (bac) => {
      M.poserMouchard(bac, 'netplan', { code: 0, avant: [
        `if printf '%s' "$*" | grep -qE -- '^--version'; then printf '%s\\n' '0.107'; exit 0; fi`,
        `if printf '%s' "$*" | grep -qE -- '^generate'; then ${generate === 0 ? 'exit 0' : "printf '%s\\n' 'Error in network definition: invalid YAML' >&2; exit 1"}; fi`, 'exit 0'] });
      M.poserMouchard(bac, 'ip', { code: interfaceExiste ? 0 : 1, sortie: interfaceExiste ? 'enp0s3 UP 08:00:27:00:00:01 <BROADCAST,MULTICAST,UP,LOWER_UP>' : '' });
    },
  });
  const remis = (r) => r.lu.length;
  const ecritures = (r) => N.appelsModifiants(r.journal, r.racinesPropres);
  const nettoie = (r) => r.journal.filter((e) => e.nom === 'netplan');

  const ok = scenario();
  positif(remis(ok) === 1 && ok.code === 0, `configuration valide : UN fichier est remis dans le dossier personnel (remis ${remis(ok)}, code ${ok.code})`);
  positif(nettoie(ok).some((e) => /^generate --root-dir \/tmp\/kjemo-/.test(e.args)), 'la validation est « netplan generate --root-dir <copie jetable> »');
  positif(!nettoie(ok).some((e) => /^(apply|try|set)\b/.test(e.args)) && ecritures(ok).length === 0,
    `jamais « netplan apply », « try » ni « set » ; zéro appel modifiant (${N.resume(ecritures(ok))})`);
  positif(ok.journal.findIndex((e) => e.nom === 'ip') < ok.journal.findIndex((e) => e.nom === 'netplan' && /^generate/.test(e.args)),
    'ordre : l\'interface est lue (ip) AVANT la validation (netplan generate)');

  const REFUS = [
    ['validation netplan refusée', { generate: 1 }], ['interface introuvable', { interfaceExiste: false }], ['confirmation absente', { conf: '' }],
  ];
  for (const [nom, ch] of REFUS) {
    const r = scenario(ch);
    refus(remis(r) === 0 && /AUCUNE MODIFICATION/.test(r.sortie), `${nom} : rien n'est remis, « AUCUNE MODIFICATION » (remis ${remis(r)})`);
    refus(!nettoie(r).some((e) => /^(apply|try|set)\b/.test(e.args)), `${nom} : jamais « netplan apply/try/set »`);
  }
  // Le FORMULAIRE refuse les saisies qui feraient un réseau faux ou une injection.
  const S = { methode: 'Adresse statique' };
  for (const [champ, v] of [['adresseCidr', '999.1.1.1/24'], ['adresseCidr', '192.168.30.10'], ['adresseCidr', '192.168.30.10/33'], ['adresseCidr', '0.0.0.0/0'],
    ['passerelle', '1.1.1.1;id'], ['passerelle', '10.9.9.9'], ['dns', '8.8.8.8;id'], ['dns', ''], ['interface', 'eth0;id'], ['nomFichier', '../x.yaml'], ['nomFichier', 'x.txt']]) {
    refus(refuse(np, champ, v, S), `formulaire : ${champ} « ${v} » est refusé en adresse statique`);
  }
  positif(Object.keys(np.validate(valeurs(np, S))).length === 0, 'formulaire : les valeurs par défaut en adresse statique sont acceptées');

  // Contre-épreuves.
  const sansValidation = (t) => N.muter(t, 'if [ "${KJEMO_VALIDE_OK:-0}" -ne 1 ]; then', 'if false; then', 'condition « netplan accepte »');
  const c1 = scenario({ generate: 1, mut: sansValidation });
  contre(remis(c1) === 1, `condition « netplan accepte » arrachée — une configuration REFUSÉE est remise, et le banc le DÉTECTE (remis ${remis(c1)})`);
  const sansInterface = (t) => N.muter(t, 'if [ "${KJEMO_IFACE_OK:-0}" -ne 1 ]; then', 'if false; then', 'condition « interface présente »');
  const c2 = scenario({ interfaceExiste: false, mut: sansInterface });
  contre(remis(c2) === 1, `condition « interface présente » arrachée — une configuration pour une interface INEXISTANTE est remise, et le banc le DÉTECTE (remis ${remis(c2)})`);
  const avecApply = scenario({ mut: (t) => N.muter(t, 'netplan generate --root-dir "${KJEMO_RACINE}" > "${KJEMO_TMP}/generate.out" 2>&1 || kjemo_code=$?',
    'netplan generate --root-dir "${KJEMO_RACINE}" > "${KJEMO_TMP}/generate.out" 2>&1 || kjemo_code=$?\n  netplan apply', 'apply glissé') });
  contre(ecritures(avecApply).some((e) => e.nom === 'netplan' && e.args === 'apply'), `un « netplan apply » glissé est DÉTECTÉ par le journal (${N.resume(ecritures(avecApply))})`);
  const sansRacine = scenario({ mut: (t) => N.muter(t, 'netplan generate --root-dir "${KJEMO_RACINE}" >', 'netplan generate >', 'root-dir retiré') });
  contre(ecritures(sansRacine).some((e) => e.nom === 'netplan' && /^generate$/.test(e.args)),
    `« netplan generate » SANS --root-dir (il écrirait dans /run) est DÉTECTÉ par le classifieur (${N.resume(ecritures(sansRacine))})`);
}

// ===========================================================================
// N19 — jonction de domaine : la jonction n'a lieu qu'après toutes les portes
// ===========================================================================
if (famille('N19', 'jonction de domaine (PowerShell) : Add-Computer seulement derrière toutes les conditions, sans mot de passe en clair', 1)) {
  nonExecutes.push('N19 : niveau 1 (analyse statique du script PowerShell). Windows PowerShell 5.1 n\'est pas disponible ici ; Add-Computer n\'existe pas sous PowerShell 7 : aucune jonction n\'a été exécutée.');
  const join_ = outil('windows-domain-join');
  const lecture = outil('windows-domain-join-readiness');
  const diag = outil('windows-domain-join-diagnostic');
  const gen = (t, ch = {}) => t.generate({ ...N.defauts(t), ...ch });
  const APPLETS_MUTANTS = ['Add-Computer', 'Remove-Computer', 'Rename-Computer', 'Restart-Computer', 'Stop-Computer', 'Set-DnsClientServerAddress',
    'Set-TimeZone', 'Set-Service', 'Stop-Service', 'Start-Service', 'Set-ItemProperty', 'New-ItemProperty', 'Remove-Item', 'Set-NetIPInterface',
    'New-NetIPAddress', 'Remove-NetIPAddress', 'Enable-NetAdapter', 'Disable-NetAdapter', 'Set-ExecutionPolicy', 'Disable-LocalUser', 'Set-LocalUser'];
  /** Les appels d'applets modifiantes à une position d'instruction (début de ligne, après `&`, `;`, `{`). */
  const appelsDe = (texte, applet) => [...texte.matchAll(new RegExp(`(^|[\\n;{(]|&\\s)\\s*${applet}\\b(?!['"])`, 'g'))]
    .map((m) => m.index).filter((i) => !/^\s*#/.test(texte.slice(texte.lastIndexOf('\n', i) + 1, i + 1)));

  /** Le verdict structurel sur un script de jonction : une liste de défauts, vide si tout tient. */
  const defauts = (texte) => {
    const d = [];
    const calls = [...texte.matchAll(/^[ \t]*Add-Computer\s+-/gm)].map((m) => m.index);
    const iDef = texte.indexOf('$conditionsAppliquer = ');
    const iBloque = texte.indexOf("if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {");
    const iElse = texte.indexOf("} elseif ($Mode -eq 'Appliquer') {");
    if (calls.length === 0) d.push('aucun appel Add-Computer (le script ne joint rien)');
    if (iDef === -1) d.push('définition $conditionsAppliquer absente');
    if (iBloque === -1) d.push('branche de blocage « -not $conditionsAppliquer » absente');
    if (iElse === -1) d.push('branche d\'exécution « elseif ($Mode -eq \'Appliquer\') » absente');
    if (calls.some((i) => i < iElse || iElse === -1)) d.push('Add-Computer appelé AVANT la branche gardée');
    if (iDef !== -1) {
      const ligne = texte.slice(iDef, texte.indexOf('\n', iDef));
      for (const cond of ['$KjemoEleve', '$ConfirmationOk', '$MoteurOk', '$ResolutionSrv', '$ReseauOk', '$AdminLocalOk', '$HorlogeOk', '-not $DansDomaine']) {
        if (!ligne.includes(cond)) d.push(`condition ${cond} absente de $conditionsAppliquer`);
      }
    }
    if (!/\$ConfirmationOk = \(\$Confirmation -ceq '/.test(texte)) d.push('la confirmation n\'est pas comparée en SENSIBLE À LA CASSE (-ceq)');
    if (iElse !== -1 && calls.length > 0) {
      const entre = texte.slice(iElse, calls[0]);
      if (/^}/m.test(entre.slice(1))) d.push('le bloc gardé est refermé avant Add-Computer');
      if (!/Get-Credential/.test(entre)) d.push('les identifiants ne sont pas demandés par Get-Credential avant la jonction');
    }
    if (/ConvertTo-SecureString|-AsPlainText|-Password\s+['"$]|PlainText/i.test(texte)) d.push('mot de passe manipulé en clair');
    if (/Restart-Computer|Stop-Computer/.test(texte.replace(/^[ \t]*#.*$/gm, '').split('\n').filter((l) => !/Add-KjemoResultat|Write-Host/.test(l)).join('\n'))) d.push('redémarrage déclenché par le script');
    return d;
  };

  // --- positif : l'assistant de jonction est structuré comme annoncé ----------
  const PHRASE_JONCTION = 'JE JOINS CE POSTE AU DOMAINE';
  const intact = gen(join_, { mode: 'Appliquer', jdConfirmation: PHRASE_JONCTION });
  const dIntact = defauts(intact);
  positif(dIntact.length === 0, `assistant de jonction : aucune défaillance structurelle (${dIntact.join(' ; ') || 'aucune'})`);
  positif([...intact.matchAll(/^[ \t]*Add-Computer\s+-/gm)].length === 2, 'assistant de jonction : exactement DEUX appels Add-Computer (avec et sans unité d\'organisation), tous deux gardés');
  const litteral = (texte, nom) => {
    const m = new RegExp(`^\\$${nom} = \\[Text\\.Encoding\\]::UTF8\\.GetString\\(\\[Convert\\]::FromBase64String\\('([^']*)'\\)\\)`, 'm').exec(texte);
    return m ? Buffer.from(m[1], 'base64').toString('utf8') : null;
  };
  positif(litteral(intact, 'Mode') === 'Appliquer', `le mode demandé est figé dans le script généré (« ${litteral(intact, 'Mode')} »)`);
  positif(litteral(intact, 'Confirmation') === PHRASE_JONCTION, 'la phrase de confirmation est figée dans le script généré');

  // --- refus ---------------------------------------------------------------
  const diagMode = gen(join_, { mode: 'Diagnostic' });
  refus(litteral(diagMode, 'Mode') === 'Diagnostic' && defauts(diagMode).length === 0, 'mode Diagnostic (défaut) : le script ne peut atteindre Add-Computer que si le mode devient « Appliquer »');
  for (const t of [lecture, diag]) {
    const texte = gen(t);
    const trouves = APPLETS_MUTANTS.filter((a) => appelsDe(texte, a).length > 0);
    refus(trouves.length === 0, `${t.id} : aucun appel d'applet modifiante (${trouves.join(', ') || 'aucune'})`);
    refus(!/Add-Computer\s+-/.test(texte), `${t.id} : aucune invocation d'Add-Computer`);
  }
  refus(appelsDe(intact, 'Remove-Computer').length === 0 && appelsDe(intact, 'Rename-Computer').length === 0 && appelsDe(intact, 'Restart-Computer').length === 0,
    'l\'assistant de jonction ne renomme pas, ne sort pas du domaine précédent et ne redémarre pas le poste');
  refus(/Get-Credential/.test(intact) && !/ConvertTo-SecureString|-AsPlainText/.test(intact), 'les identifiants sont demandés à l\'écran (Get-Credential), jamais fournis par le formulaire');
  refus(N.secretsDans(intact).length === 0, 'aucun secret en clair dans le script de jonction');

  // Le FORMULAIRE exige la phrase exacte pour le mode Appliquer.
  for (const v of ['', 'je joins ce poste au domaine', 'JE JOINS CE POSTE', 'oui', 'JE JOINS CE POSTE AU DOMAINE.']) {
    refus(refuse(join_, 'jdConfirmation', v, { mode: 'Appliquer' }), `formulaire : mode Appliquer avec la confirmation « ${v} » est refusé`);
  }
  positif(!refuse(join_, 'jdConfirmation', PHRASE_JONCTION, { mode: 'Appliquer' }), 'formulaire : la phrase exacte est acceptée en mode Appliquer');
  positif(!refuse(join_, 'jdConfirmation', '', { mode: 'Diagnostic' }), 'formulaire : le mode Diagnostic n\'exige aucune confirmation');
  {
    const d = await N.distMutee('outils-poste-jonction.mjs', "if (String(v.jdConfirmation ?? '').trim() !== 'JE JOINS CE POSTE AU DOMAINE') {", 'if (false) {', 'N19 refus formulaire arraché');
    try {
      const tm = d.tools.find((x) => x.id === 'windows-domain-join');
      contre(!refuse(tm, 'jdConfirmation', '', { mode: 'Appliquer' }), 'refus du formulaire arraché — le mode Appliquer sans phrase devient ACCEPTÉ, et le banc le DÉTECTE');
    } finally { d.nettoyer(); }
  }

  // --- contre-épreuves : chaque verrou structurel arraché est VU ---------------
  const MUTATIONS = [
    ['porte unique arrachée ($conditionsAppliquer = $true)', (t) => N.muter(t, /\$conditionsAppliquer = [^\n]*/, '$conditionsAppliquer = $true', 'porte unique'), /\$KjemoEleve absente|\$ConfirmationOk absente/],
    ['branche de blocage supprimée', (t) => N.muter(t, "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {", 'if ($false) {', 'branche de blocage'), /branche de blocage/],
    ['confirmation comparée sans sensibilité à la casse (-eq)', (t) => N.muter(t, /\$ConfirmationOk = \(\$Confirmation -ceq/, '$ConfirmationOk = ($Confirmation -eq', 'ceq'), /CASSE/],
    ['condition « poste déjà joint » retirée', (t) => N.muter(t, ' -and (-not $DansDomaine', ' -and ($true', 'dans domaine'), /DansDomaine/],
    ['condition d\'élévation retirée', (t) => N.muter(t, /\$conditionsAppliquer = \$KjemoEleve -and /, '$conditionsAppliquer = ', 'elevation'), /KjemoEleve/],
    ['Add-Computer glissé AVANT la porte', (t) => N.muter(t, '$manquants = @()', 'Add-Computer -DomainName $Domaine\n$manquants = @()', 'appel avant la porte'), /AVANT la branche gardée/],
    ['mot de passe en clair introduit', (t) => N.muter(t, '$identifiants = $null\n  try {', "$identifiants = $null\n  $motDePasse = ConvertTo-SecureString 'Sup3rSecret!' -AsPlainText -Force\n  try {", 'secret'), /mot de passe manipulé en clair/],
    ['redémarrage automatique introduit', (t) => N.muter(t, '$jonctionAcceptee = $false', '$jonctionAcceptee = $false\n    Restart-Computer -Force', 'redemarrage'), /redémarrage déclenché/],
  ];
  for (const [nom, mutation, attendu] of MUTATIONS) {
    const mut = mutation(intact);
    const d = defauts(mut);
    contre(d.length > 0 && d.some((x) => attendu.test(x)), `${nom} — le banc DÉTECTE le défaut (${d.slice(0, 2).join(' ; ') || 'aucun défaut vu'})`);
  }
}

// __FAMILLES_SUIVANTES__

// ===========================================================================
// CONTRAT : chaque famille tient les trois temps — sinon le banc échoue
// ===========================================================================
console.log('');
console.log('CONTRAT — chaque famille doit porter un refus, un contrôle positif et une contre-épreuve');
courante = 'CONTRAT';
FAMILLES.set('CONTRAT', { titre: 'contrat', niveau: 0, refus: 0, positif: 0, contre: 0 });
{
  const attendues = Array.from({ length: 19 }, (_, i) => `N${String(i + 1).padStart(2, '0')}`).filter((id) => !FILTRE || FILTRE.has(id));
  for (const id of attendues) {
    const f = FAMILLES.get(id);
    if (!f) { enregistrer('refus', false, `famille ${id} ABSENTE du banc`); continue; }
    enregistrer('refus', f.refus > 0 && f.positif > 0 && f.contre > 0,
      `${id} « ${f.titre} » : refus=${f.refus}, positif=${f.positif}, contre-épreuve=${f.contre} (les trois exigés)`);
  }
  const f0 = FAMILLES.get('N00');
  enregistrer('refus', f0 && f0.refus > 0 && f0.positif > 0 && f0.contre > 0, 'N00 (condition de validité) tient aussi les trois temps');
}

// La machine qui exécute le banc n'a pas bougé.
console.log('');
console.log('Machine hôte — aucun fichier système réel n\'a changé pendant le banc');
{
  const apres = N.empreinteSysteme();
  const diff = Object.keys(SYSTEME_AVANT).filter((k) => SYSTEME_AVANT[k] !== apres[k]);
  enregistrer('refus', diff.length === 0, `empreintes SHA-256 de ${Object.keys(SYSTEME_AVANT).length} fichiers/dossiers système identiques (modifiés : ${diff.join(', ') || 'aucun'})`);
}

const total = ok + echecs.length;
console.log('');
console.log(`Négatifs LOT 7 : ${ok} OK, ${echecs.length} ÉCHEC(S) sur ${total} vérifications, ${FAMILLES.size - 1} familles (N00 incluse).`);
for (const n of nonExecutes) console.log(`NON EXÉCUTÉ : ${n}`);
console.log('Ubuntu Server réel, contrôleur Samba AD réel, export NFS réel, jonction réelle : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
