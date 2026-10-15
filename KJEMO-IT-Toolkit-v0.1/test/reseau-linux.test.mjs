#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DU RÉSEAU : CE QUI N'EST JAMAIS APPLIQUÉ
//
// Les quatre assistants du commit 18/n sont EXÉCUTÉS dans un bac à sable, avec
// netplan, ip, ss, ufw, nft, resolvectl, getent, dig, ping, tracepath,
// networkctl et nmcli remplacés par des doublures.
//
// LA PREUVE CENTRALE : « netplan apply » N'EXISTE PAS
//
// Elle est mesurée de deux façons, parce qu'une seule ne suffirait pas :
//
//   dans le JOURNAL   zéro appel à netplan avec apply ou try, sur chacun des
//                     huit jeux de données, et quelle que soit la passe ;
//   dans le TEXTE     la chaîne « netplan apply » n'apparaît pas dans le
//                     script généré — pas même dans un commentaire ou dans un
//                     message, où un copier-coller la ferait ressurgir.
//
// Le second contrôle attrape ce que le premier ne peut pas voir : une branche
// non empruntée pendant la passe.
//
// LES PASSES
//
//   A  les trois diagnostics n'appellent AUCUNE commande modifiante
//   B  « netplan apply » et « netplan try » sont absents du texte ET du journal
//   C  confirmation absente          → aucun fichier laissé sur le disque
//   D  interface inexistante         → refus, et aucun fichier
//   E  netplan refuse la configuration → aucun fichier, et le refus est dit
//   F  CONTRÔLE POSITIF              → validation sur COPIE par --root-dir,
//                                      fichier laissé en 600, cinq étapes
//                                      manuelles affichées
//   G  le formulaire refuse une passerelle hors du réseau de l'adresse
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur.
// Aucune interface configurée, aucune règle de pare-feu posée, aucun
// /etc/netplan touché. Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(ROOT, 'dist/noyau-bash.mjs')).href);
const M = await import(pathToFileURL(resolve(ROOT, 'test/mouchards-linux.mjs')).href);
// codeNu() retire les commentaires et le contenu des chaines : c'est l'outil
// du scanner, et c'est exactement ce qu'il faut ici. Chercher « netplan apply »
// dans le texte BRUT accuse les commentaires qui expliquent pourquoi on ne
// l'emploie pas — ce qui condamnerait la pedagogie au nom de la securite.
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
const reseau = outil('linux-network-diagnostic');
const netplan = outil('netplan-readiness');
const dns = outil('linux-dns-diagnostic');
const feu = outil('linux-firewall-audit');

const IFACE = 'enp0s3';

/** Cite une chaîne pour le shell en préservant ses retours à la ligne. */
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;

/** Le bac du préparateur Netplan. */
function bacNetplan(nom, {
  interfaceExiste = true,
  generateEchoue = false,
  confirmation = IFACE,
  methode = 'Adresse statique',
} = {}) {
  const bac = M.creerBac(nom);
  M.poserMouchard(bac, 'ip', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- 'link show dev'; then",
      ...(interfaceExiste
        ? [`  printf '%s\\n' ${sq(`${IFACE}            UP             08:00:27:aa:bb:cc <BROADCAST,MULTICAST,UP,LOWER_UP>`)}`, '  exit 0']
        : ['  exit 1']),
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- 'link show'; then",
      `  printf '%s\\n' ${sq(`lo               UNKNOWN        00:00:00:00:00:00\n${IFACE}            UP             08:00:27:aa:bb:cc`)}`,
      '  exit 0',
      'fi',
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'netplan', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '--version'; then printf '%s\\n' 'netplan.io 1.1.2'; exit 0; fi",
      "if printf '%s' \"$*\" | grep -qE -- 'generate'; then",
      ...(generateEchoue
        ? ["  printf '%s\\n' 'Error in network definition: unknown key dhcp5' >&2", '  exit 1']
        : ['  exit 0']),
      'fi',
      '# Toute autre forme — apply, try — est journalisee et rendue en erreur :',
      '# le banc verifie qu elle n est JAMAIS atteinte.',
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'systemctl', { code: 0, sortie: 'active' });
  M.poserMouchard(bac, 'nmcli', { code: 1 });
  M.poserMouchard(bac, 'networkctl', { code: 0, sortie: '' });

  const valeurs = {
    interface: IFACE,
    methode,
    adresseCidr: '192.168.30.10/24',
    passerelle: '192.168.30.1',
    dns: '192.168.30.1 1.1.1.1',
    confirmation,
    nomFichier: '99-kjemo-reseau.yaml',
    format: 'Console',
  };
  return { bac, texte: normalizeScriptSh(netplan.generate(valeurs)) };
}

const envBac = (bac) => ({ HOME: bac.travail });
const fichiersLaisses = (bac) => (existsSync(bac.travail)
  ? readdirSync(bac.travail).filter((f) => /kjemo-netplan/.test(f)) : []);

// ===========================================================================
console.log('');
console.log('Plan 0 — aucun contournement du PATH');
for (const t of [reseau, netplan, dns, feu]) {
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
  // A1 — le diagnostic réseau.
  const bac = M.creerBac('A1');
  try {
    M.poserMouchard(bac, 'ip', {
      code: 0,
      avant: [
        "if printf '%s' \"$*\" | grep -qE -- 'route show default'; then printf '%s\\n' 'default via 192.168.30.1 dev enp0s3 proto static'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'link show'; then printf '%s\\n' 'enp0s3 UP 08:00:27:aa:bb:cc'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'address show'; then printf '%s\\n' 'enp0s3 UP 192.168.30.10/24'; exit 0; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'neigh'; then printf '%s\\n' '192.168.30.1 dev enp0s3 lladdr 00:11:22:33:44:55 REACHABLE'; exit 0; fi",
        'exit 0',
      ],
    });
    M.poserMouchard(bac, 'ss', { code: 0, sortie: 'Netid State Recv-Q Send-Q Local:Port Peer:Port Process\ntcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=1,fd=3))' });
    M.poserMouchard(bac, 'ping', { code: 0, sortie: 'rtt min/avg/max/mdev = 0.5/0.6/0.7/0.1 ms' });
    M.poserMouchard(bac, 'tracepath', { code: 0, sortie: ' 1?: [LOCALHOST] pmtu 1500\n 1:  192.168.30.1  0.5ms' });
    M.poserMouchard(bac, 'networkctl', { code: 0, sortie: 'IDX LINK   TYPE     OPERATIONAL SETUP\n  2 enp0s3 ether    routable    configured' });
    M.poserMouchard(bac, 'nmcli', { code: 1 });
    const texte = normalizeScriptSh(reseau.generate({
      interface: '', cible: 'archive.ubuntu.com', testerConnectivite: 'Oui', format: 'Console',
    }));
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `A1 : le diagnostic reseau sort 0 (obtenu ${r.code})`);
    const ipAppels = r.journal.filter((e) => e.nom === 'ip').map((e) => e.args);
    verifier(ipAppels.length >= 3, `A1 : preuve d execution — ip appele ${ipAppels.length} fois`);
    const modifiants = ipAppels.filter((a) => /\b(addr|address|route|link|neigh)\s+(add|del|change|replace|set|flush)\b/.test(a));
    verifier(modifiants.length === 0,
      `A1 — ZERO ip modifiant : aucun add, del, change, replace, set ni flush (${modifiants.join(' | ') || 'aucun'})`);
    for (const cmd of ['ufw', 'nft', 'netplan']) {
      verifier(M.compterAppels(r.journal, cmd) === 0, `A1 — ZERO appel a ${cmd}`);
    }
    verifier(/Chemin/.test(r.sortie) || M.compterAppels(r.journal, 'tracepath') >= 1,
      'A1 : le chemin a bien ete trace');
  } finally { M.detruireBac(bac); }

  // A2 — le diagnostic DNS.
  const b2 = M.creerBac('A2');
  try {
    M.poserMouchard(b2, 'resolvectl', {
      code: 0,
      avant: [
        "if printf '%s' \"$*\" | grep -qE -- 'status'; then",
        `  printf '%s\\n' ${sq('Global\n  Protocols: -LLMNR\nLink 2 (enp0s3)\n  DNS Servers: 192.168.30.1 1.1.1.1\n  DNS Domain: labo.local')}`,
        '  exit 0',
        'fi',
        // Les SRV du domaine sont absents : c'est le cas qui compte, car
        // c'est la premiere cause d'echec de jonction — et c'est le seul qui
        // s'affiche, le rapport Console ne montrant pas les lignes OK.
        "if printf '%s' \"$*\" | grep -qE -- '--type=SRV'; then printf '%s\\n' 'resolve call failed: NXDOMAIN' >&2; exit 1; fi",
        "if printf '%s' \"$*\" | grep -qE -- 'query'; then printf '%s\\n' 'archive.ubuntu.com: 185.125.190.82 -- link: enp0s3'; exit 0; fi",
        'exit 0',
      ],
    });
    M.poserMouchard(b2, 'getent', { code: 0, sortie: '185.125.190.82  archive.ubuntu.com' });
    M.poserMouchard(b2, 'dig', { code: 0, sortie: '185.125.190.82' });
    M.poserMouchard(b2, 'systemctl', { code: 0, sortie: 'active' });
    const texte = normalizeScriptSh(dns.generate({
      nom: 'archive.ubuntu.com', domaineAd: 'kjemo.local', format: 'Console',
    }));
    const r = M.executer(b2, texte, { env: envBac(b2) });
    verifier(r.code === 0, `A2 : le diagnostic DNS sort 0 (obtenu ${r.code})`);
    const rc = r.journal.filter((e) => e.nom === 'resolvectl').map((e) => e.args);
    verifier(rc.length >= 3, `A2 : preuve d execution — resolvectl appele ${rc.length} fois`);
    const flush = rc.filter((a) => /flush-caches|revert|dns |domain |llmnr |dnssec /.test(a));
    verifier(flush.length === 0,
      `A2 — ZERO resolvectl modifiant : ni flush-caches, ni revert, ni pose de serveur (${flush.join(' | ') || 'aucun'})`);
    verifier(rc.some((a) => /--type=SRV/.test(a)),
      'A2 : les enregistrements SRV du domaine AD ont bien ete interroges');
    verifier(/_ldap\._tcp\.kjemo\.local/.test(r.sortie),
      'A2 : le rapport nomme l enregistrement _ldap._tcp.kjemo.local qui manque — « introuvable » sans le nom ne sert a rien');
    verifier(/_kerberos\._udp\.kjemo\.local/.test(r.sortie),
      'A2 : le verdict nomme aussi _kerberos._udp.kjemo.local');
  } finally { M.detruireBac(b2); }

  // A3 — l'audit de pare-feu.
  const b3 = M.creerBac('A3');
  try {
    M.poserMouchard(b3, 'ufw', { code: 0, sortie: 'Status: active\nDefault: deny (incoming), allow (outgoing), disabled (routed)\n22/tcp                     ALLOW       Anywhere' });
    M.poserMouchard(b3, 'nft', { code: 0, sortie: 'table inet filter {\n  chain input {\n    type filter hook input priority 0; policy drop;\n    tcp dport 22 accept\n  }\n}' });
    M.poserMouchard(b3, 'ss', { code: 0, sortie: 'Netid State Recv-Q Send-Q Local:Port Peer:Port Process\ntcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=1,fd=3))\ntcp LISTEN 0 70 127.0.0.1:33060 0.0.0.0:* users:(("mysqld",pid=2,fd=4))' });
    M.poserMouchard(b3, 'ip', { code: 0, sortie: '' });
    const texte = normalizeScriptSh(feu.generate({
      portVerifie: '22', lireIptables: 'Non', format: 'Console',
    }));
    const r = M.executer(b3, texte, { env: envBac(b3) });
    verifier(r.code === 0, `A3 : l audit de pare-feu sort 0 (obtenu ${r.code})`);
    const ufwAppels = r.journal.filter((e) => e.nom === 'ufw').map((e) => e.args);
    const nftAppels = r.journal.filter((e) => e.nom === 'nft').map((e) => e.args);
    verifier(ufwAppels.length >= 1 || nftAppels.length >= 1,
      'A3 : preuve d execution — le pare-feu a bien ete interroge');
    const ufwModif = ufwAppels.filter((a) => /^(allow|deny|reject|limit|enable|disable|reset|reload|delete|insert)\b/.test(a));
    verifier(ufwModif.length === 0,
      `A3 — ZERO ufw modifiant : ni allow, ni deny, ni enable, ni disable, ni reset, ni reload, ni delete (${ufwModif.join(' | ') || 'aucun'})`);
    const nftModif = nftAppels.filter((a) => /\b(add|delete|flush|insert|replace|-f)\b/.test(a));
    verifier(nftModif.length === 0,
      `A3 — ZERO nft modifiant : ni add, ni delete, ni flush, ni -f (${nftModif.join(' | ') || 'aucun'})`);
    verifier(ufwAppels.every((a) => /status/.test(a)) || ufwAppels.length === 0,
      `A3 : ufw n est appele qu avec « status » (${ufwAppels.join(' | ')})`);
    verifier(/bouclage seulement/.test(r.sortie) || /127\.0\.0\.1/.test(r.sortie),
      'A3 : le service lie au bouclage est signale a part — c est la moitie des « j ai ouvert le port »');
  } finally { M.detruireBac(b3); }
}

console.log('');
console.log('Passe B — « netplan apply » est absent du TEXTE et du JOURNAL');
{
  // Le contrôle textuel, sur les HUIT jeux de données : il attrape ce qu'une
  // exécution ne peut pas voir, à savoir une branche non empruntée.
  const jeux = [
    { interface: IFACE, methode: 'Adresse statique', adresseCidr: '192.168.30.10/24', passerelle: '192.168.30.1', dns: '192.168.30.1', confirmation: IFACE, nomFichier: '99-a.yaml', format: 'Console' },
    { interface: IFACE, methode: 'DHCP', adresseCidr: '', passerelle: '', dns: '', confirmation: '', nomFichier: '99-b.yaml', format: 'JSON' },
    { interface: 'ens18', methode: 'DHCP', adresseCidr: '', passerelle: '', dns: '', confirmation: 'ens18', nomFichier: '70-c.yaml', format: 'CSV' },
    { interface: 'br-lan', methode: 'Adresse statique', adresseCidr: '10.0.0.5/8', passerelle: '10.0.0.1', dns: '10.0.0.1 9.9.9.9', confirmation: 'br-lan', nomFichier: '60-d.yaml', format: 'Console' },
  ];
  for (const v of jeux) {
    const texte = normalizeScriptSh(netplan.generate(v));
    const nu = codeNu(texte);
    verifier(!/\bnetplan\s+apply\b/.test(nu),
      `B — « netplan apply » absent du CODE (${v.nomFichier}, ${v.methode})`);
    verifier(!/\bnetplan\s+try\b/.test(nu),
      `B — « netplan try » absent du CODE aussi : il exige un terminal interactif (${v.nomFichier})`);
    // Il DOIT en revanche rester dans les instructions a taper : c'est la
    // seule commande d'application sure, et la cacher serait pire.
    verifier(/sudo netplan try/.test(texte),
      `B : « sudo netplan try » figure bien dans les instructions remises (${v.nomFichier})`);
    // Et la seule invocation de netplan dans du code nu est generate.
    const invocations = nu.split('\n')
      .filter((l) => /(^|[\s;&|(])netplan\s+[a-z-]/.test(l))
      .map((l) => l.trim());
    verifier(invocations.every((l) => /netplan\s+(--version|generate)/.test(l)),
      `B — les seules invocations de netplan sont --version et generate (${invocations.join(' | ') || 'aucune'})`);
    verifier(invocations.some((l) => /netplan\s+generate/.test(l)),
      `B : et generate est bien present (${invocations.join(' | ')})`);
  }
  // Le contrôle par exécution, sur la passe nominale.
  const { bac, texte } = bacNetplan('B');
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    const np = r.journal.filter((e) => e.nom === 'netplan').map((e) => e.args);
    verifier(np.length >= 1, `B : preuve d execution — netplan appele ${np.length} fois (${np.join(' | ')})`);
    verifier(!np.some((a) => /^apply\b|^try\b/.test(a)),
      `B — ZERO netplan apply et ZERO netplan try dans le journal (${np.join(' | ')})`);
    verifier(np.some((a) => /generate.*--root-dir/.test(a)),
      `B : la validation passe bien par « generate --root-dir » (${np.join(' | ')})`);
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe C — confirmation absente : aucun fichier laissé sur le disque');
{
  const { bac, texte } = bacNetplan('C', { confirmation: '' });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(fichiersLaisses(bac).length === 0,
      `C — aucun fichier laisse dans le dossier personnel (${fichiersLaisses(bac).join(', ') || 'aucun'})`);
    verifier(/AUCUNE MODIFICATION/.test(r.sortie), 'C : le script le DIT');
    verifier(/confirmation/i.test(r.sortie), 'C : la condition manquante est NOMMEE');
    verifier(!/A FAIRE MAINTENANT/.test(r.sortie),
      'C : la procedure d application n est PAS remise sans confirmation');
    // La validation, elle, a bien eu lieu : un refus ne doit pas empêcher de
    // savoir si la configuration était correcte.
    verifier(M.compterAppels(r.journal, 'netplan', 'generate') >= 1,
      'C : la configuration a tout de meme ete VALIDEE — un refus de remise n empeche pas de savoir si elle etait correcte');
    verifier(/APERCU EXACT DU FICHIER PREPARE/.test(r.sortie),
      'C : et l apercu EXACT du fichier est IMPRIME — le modele UX l exige, et une ligne INFO ne serait pas imprimee en mode Console');
    verifier(/network:/.test(r.sortie) && /version: 2/.test(r.sortie),
      'C : l apercu contient bien le YAML, et non une description du YAML');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe D — l’interface n’existe pas');
{
  const { bac, texte } = bacNetplan('D', { interfaceExiste: false });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(fichiersLaisses(bac).length === 0, 'D — aucun fichier laisse');
    verifier(/inexistante/.test(r.sortie), 'D : le script dit que l interface n existe pas');
    verifier(/sans se plaindre|resterait comme avant/.test(r.sortie),
      'D : et il dit POURQUOI cela compte — netplan accepterait ce nom sans rien signaler');
    verifier(!/A FAIRE MAINTENANT/.test(r.sortie), 'D : aucune procedure remise');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe E — Netplan refuse la configuration');
{
  const { bac, texte } = bacNetplan('E', { generateEchoue: true });
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(fichiersLaisses(bac).length === 0, 'E — aucun fichier laisse quand la validation echoue');
    verifier(/REFUSEE par Netplan/.test(r.sortie) || /refus/i.test(r.sortie),
      'E : le script dit que Netplan a refuse');
    verifier(/sur une copie|sans aucune consequence/.test(r.sortie),
      'E — et il dit que le refus est venu d une COPIE, donc sans consequence');
    verifier(!/A FAIRE MAINTENANT/.test(r.sortie), 'E : aucune procedure remise');
    verifier(M.compterAppels(r.journal, 'netplan', 'generate') >= 1, 'E : la validation a bien ete tentee');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe F — CONTRÔLE POSITIF : validé sur copie, fichier laissé, procédure remise');
{
  const { bac, texte } = bacNetplan('F');
  try {
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `F : le script sort 0 (obtenu ${r.code})`);
    const laisses = fichiersLaisses(bac);
    verifier(laisses.length === 1, `F : un seul fichier laisse (${laisses.join(', ')})`);
    if (laisses.length === 1) {
      const chemin = join(bac.travail, laisses[0]);
      const contenu = readFileSync(chemin, 'utf8');
      verifier(/^network:/m.test(contenu), 'F : le fichier commence bien par « network: »');
      verifier(/version: 2/.test(contenu), 'F : il declare « version: 2 »');
      verifier(new RegExp(`^    ${IFACE}:`, 'm').test(contenu),
        'F : l interface est declaree a la bonne indentation');
      verifier(/^      addresses:/m.test(contenu) && /^        - 192\.168\.30\.10\/24$/m.test(contenu),
        'F : l adresse porte son prefixe, indentee sous addresses');
      verifier(/to: default/.test(contenu) && /via: 192\.168\.30\.1/.test(contenu),
        'F : la route par defaut est ecrite dans la forme « routes / to: default / via: »');
      verifier(!/\t/.test(contenu),
        'F — aucune TABULATION dans le YAML : YAML les interdit absolument, et le message d erreur ne le dit pas clairement');
      const mode = (statSync(chemin).mode & 0o777).toString(8);
      verifier(mode === '600', `F — le fichier est en mode 600 : il peut contenir un secret (${mode})`);
    }
    // La validation a porté sur une COPIE, pas sur /etc/netplan.
    const gen = r.journal.find((e) => e.nom === 'netplan' && /generate/.test(e.args))?.args ?? '';
    verifier(/--root-dir/.test(gen), `F : la validation a bien employe --root-dir (${gen})`);
    verifier(/KJEMO|tmp|racine/.test(gen),
      `F — la racine de validation est un dossier TEMPORAIRE, pas /etc (${gen})`);
    // La procédure, et son ordre.
    verifier(/A FAIRE MAINTENANT/.test(r.sortie), 'F : la procedure est remise');
    const iSeconde = r.sortie.indexOf('SECONDE');
    const iInstall = r.sortie.indexOf('install -m 600');
    const iTry = r.sortie.indexOf('netplan try');
    verifier(iSeconde !== -1 && iInstall !== -1 && iSeconde < iInstall,
      'F — « ouvre une SECONDE session » vient AVANT la mise en place du fichier');
    verifier(iInstall !== -1 && iTry !== -1 && iInstall < iTry,
      'F : la mise en place vient avant « netplan try »');
    verifier(/120 secondes/.test(r.sortie),
      'F : le retour automatique apres 120 secondes est annonce');
    verifier(/n a rien ecrit dans/.test(r.sortie),
      'F : et le script rappelle qu il n a rien ecrit dans /etc/netplan');
  } finally { M.detruireBac(bac); }
}

console.log('');
console.log('Passe G — le formulaire refuse ce que « netplan generate » ne voit pas');
{
  const base = {
    interface: IFACE, methode: 'Adresse statique', adresseCidr: '192.168.30.10/24',
    passerelle: '192.168.30.1', dns: '192.168.30.1', confirmation: IFACE,
    nomFichier: '99-kjemo.yaml', format: 'Console',
  };
  verifier(!netplan.validate(base).passerelle, 'G : une passerelle du bon reseau est acceptee');
  verifier(Boolean(netplan.validate({ ...base, passerelle: '10.0.0.1' }).passerelle),
    'G — une passerelle HORS du reseau de l adresse est refusee : netplan generate ne le voit pas');
  verifier(Boolean(netplan.validate({ ...base, adresseCidr: '192.168.30.10' }).adresseCidr),
    'G : une adresse sans prefixe CIDR est refusee');
  verifier(Boolean(netplan.validate({ ...base, dns: '' }).dns),
    'G : en statique, l absence de serveur DNS est refusee — rien ne les fournit');
  verifier(Boolean(netplan.validate({ ...base, nomFichier: '99-kjemo.yml' }).nomFichier),
    'G : un nom de fichier en .yml est refuse — netplan ne lit que *.yaml');
  verifier(Boolean(netplan.validate({ ...base, interface: 'une interface' }).interface),
    'G : un nom d interface avec une espace est refuse');
  verifier(Boolean(netplan.validate({ ...base, adresseCidr: '192.168.30.10/31' }).adresseCidr),
    'G : un prefixe /31 est refuse sur une interface ordinaire');
  // En DHCP, les trois champs statiques sont ignorés : c'est ce qui permet de
  // les laisser vides, et le banc d'identité l'exige.
  verifier(Object.keys(netplan.validate({
    ...base, methode: 'DHCP', adresseCidr: '', passerelle: '', dns: '',
  })).length === 0, 'G : en DHCP, les trois champs statiques peuvent etre vides');
}

// ===========================================================================
console.log('');
console.log(`Reseau Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur.');
console.log('Aucune interface configurée, aucune règle de pare-feu posée, aucun');
console.log('/etc/netplan touché, et « netplan apply » absent du texte comme du journal.');
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
