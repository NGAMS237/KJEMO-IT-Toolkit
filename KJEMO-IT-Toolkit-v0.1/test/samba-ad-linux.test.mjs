#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — BANC DE SAMBA AD : samba-tool N'EST JAMAIS APPELÉ POUR AGIR
//
// Les quatre assistants du commit 22/n sont EXÉCUTÉS dans un bac à sable.
// dpkg-query, systemctl, hostname, getent, ip, timedatectl, ss, host,
// smbclient, samba-tool, klist et id sont remplacés par des doublures.
//
// DEUX REDIRECTIONS, ET LE BANC ÉCHOUE SI L'UNE NE S'APPLIQUE PAS
//
//   KJEMO_SMBCONF  → /etc/samba/smb.conf vers le bac
//   KJEMO_PRIV1    → /var/lib/samba/private vers le bac, ce qui permet
//                    d'éprouver « un domaine existe déjà » sans fabriquer un
//                    faux domaine sur la machine de développement
//
// LA PREUVE CENTRALE
//
// Aucun des quatre assistants n'appelle samba-tool pour AGIR. Mesuré dans le
// journal des doublures, et dans le code nu : pas de « domain provision »,
// pas de « user create », pas de « setpassword », pas de « getpassword », pas
// de « syncpasswords », pas de « user delete », et pas de « kinit ». Les
// commandes modifiantes sont AFFICHÉES, jamais exécutées.
//
// LES PASSES
//
//   0  aucun contournement du PATH par un chemin absolu
//   A  samba-ad-dc-readiness : le FQDN sur le bouclage est détecté, les unités
//      en conflit comptées, un domaine existant reconnu
//   B  samba-ad-dc-provision : cinq refus, chacun donnant ZÉRO fichier
//   C  samba-ad-dc-provision : CONTRÔLE POSITIF — cahier écrit, mode 600,
//      sans aucune option de mot de passe, et ZÉRO appel à samba-tool
//   D  samba-ad-health : zéro kinit, et le verdict suit l'ordre des couches
//   E  samba-ad-user-manage : le filtre anti-secret retire un attribut de
//      secret de la sortie, et aucune commande modifiante n'est appelée
//   F  le TEXTE des jeux : aucune des sept commandes interdites
//
// NIVEAU DE PREUVE : 4 — exécution réelle avec doublures, dans ce conteneur.
// Aucun domaine provisionné, aucun compte touché, aucun ticket demandé.
// Ubuntu Server réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
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
const prerequis = outil('samba-ad-dc-readiness');
const provision = outil('samba-ad-dc-provision');
const sante = outil('samba-ad-health');
const comptes = outil('samba-ad-user-manage');

const envBac = (bac) => ({ HOME: bac.travail });
const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;
const MARQUEUR_SECRET = 'SECRET-LDAP-NE-DOIT-JAMAIS-SORTIR-7c21';

function lignesJson(bac) {
  const f = readdirSync(bac.travail).filter((n) => n.endsWith('.json'));
  if (f.length === 0) return [];
  return JSON.parse(readFileSync(join(bac.travail, f[f.length - 1]), 'utf8')).controles;
}
const ligneDe = (l, c) => l.find((x) => x.controle === c);
const etatDe = (l, c) => (ligneDe(l, c) ?? {}).etat ?? 'ABSENTE';
const comDe = (l, c) => (ligneDe(l, c) ?? {}).commentaire ?? '';
const parCategorie = (l, cat) => l.filter((x) => x.categorie === cat);

const SMBCONF_PARTAGE = '[global]\n   workgroup = KJEMO\n';
const SMBCONF_DC = '[global]\n   workgroup = KJEMO\n   server role = active directory domain controller\n';

/**
 * Les deux redirections, chacune avec son garde-fou. Sans elles, le banc
 * lirait /etc/samba et /var/lib/samba de la machine de développement — et
 * dans le cas du provisionnement, il écrirait ailleurs que dans le bac.
 */
function rediriger(texte, { smbconf, priv }) {
  let t = texte;
  for (const [cherche, remplace, quoi] of [
    ["KJEMO_SMBCONF='/etc/samba/smb.conf'", `KJEMO_SMBCONF='${smbconf}'`, '/etc/samba/smb.conf'],
    ["KJEMO_PRIV1='/var/lib/samba/private'", `KJEMO_PRIV1='${priv}'`, '/var/lib/samba/private'],
  ]) {
    const avant = t;
    t = t.replace(cherche, remplace);
    if (t === avant) {
      fail(`la redirection de ${quoi} vers le bac a echoue : le banc lirait le vrai chemin`);
      process.exit(1);
    }
  }
  return t;
}

/**
 * Un bac Samba AD. Les réglages qui changent le verdict : l'existence d'un
 * domaine, ce vers quoi le FQDN résout, l'heure, et les unités en conflit.
 */
function bacAd(nom, {
  domaineExiste = false,
  smbconf = null,
  fqdnBouclage = false,
  heureOk = true,
  conflit = false,
  adresse = '192.168.30.10',
  srvOk = true,
  addcActif = true,
  sortieUserShow = null,
  listeComptes = 'blaise\nclaire\nAdministrator',
} = {}) {
  const bac = M.creerBac(nom);
  const cheminConf = join(bac.travail, 'smb.conf');
  const cheminPriv = join(bac.travail, 'private');
  mkdirSync(cheminPriv, { recursive: true });
  writeFileSync(cheminConf, smbconf ?? (domaineExiste ? SMBCONF_DC : SMBCONF_PARTAGE), 'utf8');
  if (domaineExiste) writeFileSync(join(cheminPriv, 'sam.ldb'), 'faux-sam-ldb\n', 'utf8');

  M.poserMouchard(bac, 'dpkg-query', { code: 0, sortie: 'install ok installed' });
  M.poserMouchard(bac, 'hostname', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '-f'; then printf '%s\\n' 'dc1.kjemo.lan'; exit 0; fi",
      "printf '%s\\n' 'dc1'",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'getent', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'hosts'; then printf '%s\\n' ${sq(fqdnBouclage ? '127.0.1.1       dc1.kjemo.lan dc1' : '192.168.30.10   dc1.kjemo.lan dc1')}; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- 'passwd'; then printf '%s\\n' 'blaise:x:1000:1000::/home/blaise:/bin/bash'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'ip', { code: 0, sortie: `enp0s3           UP             ${adresse}/24` });
  M.poserMouchard(bac, 'timedatectl', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'NTPSynchronized'; then printf '%s\\n' ${sq(heureOk ? 'yes' : 'no')}; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- 'p NTP'; then printf '%s\\n' 'yes'; exit 0; fi",
      "if printf '%s' \"$*\" | grep -qE -- 'Timezone'; then printf '%s\\n' 'America/Toronto'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'systemctl', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'is-active (smbd|nmbd|winbind)'; then printf '%s\\n' ${sq(conflit ? 'active' : 'inactive')}; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- 'is-enabled (smbd|nmbd|winbind)'; then printf '%s\\n' ${sq(conflit ? 'enabled' : 'disabled')}; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- 'is-active samba-ad-dc'; then printf '%s\\n' ${sq(addcActif ? 'active' : 'inactive')}; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- 'is-enabled samba-ad-dc'; then printf '%s\\n' 'enabled'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'ss', {
    code: 0,
    sortie: ['Netid State Recv-Q Send-Q Local:Port Peer:Port Process',
      'udp UNCONN 0 0 192.168.30.10:53 0.0.0.0:*',
      'tcp LISTEN 0 50 192.168.30.10:88 0.0.0.0:*',
      'tcp LISTEN 0 50 192.168.30.10:389 0.0.0.0:*',
      'tcp LISTEN 0 50 0.0.0.0:445 0.0.0.0:*',
      'tcp LISTEN 0 50 192.168.30.10:464 0.0.0.0:*'].join('\n'),
  });
  M.poserMouchard(bac, 'host', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- 'SRV'; then ${srvOk
        ? "printf '%s\\n' '_ldap._tcp.kjemo.lan has SRV record 0 100 389 dc1.kjemo.lan.'; exit 0"
        : "printf '%s\\n' 'Host _ldap._tcp.kjemo.lan not found: 3(NXDOMAIN)'; exit 1"}; fi`,
      "if printf '%s' \"$*\" | grep -qE -- '-t A'; then printf '%s\\n' 'dc1.kjemo.lan has address 192.168.30.10'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'smbclient', {
    code: 0,
    sortie: '\tSharename       Type      Comment\n\tsysvol          Disk\n\tnetlogon        Disk\n\tIPC$            IPC',
  });
  M.poserMouchard(bac, 'klist', { code: 1, sortie: 'klist: No credentials cache found' });
  M.poserMouchard(bac, 'samba-tool', {
    code: 0,
    avant: [
      `if printf '%s' "$*" | grep -qE -- '^user list'; then printf '%s\\n' ${sq(listeComptes)}; exit 0; fi`,
      `if printf '%s' "$*" | grep -qE -- '^user show'; then printf '%s\\n' ${sq(sortieUserShow ?? `dn: CN=blaise,CN=Users,DC=kjemo,DC=lan\nuserAccountControl: 512\npwdLastSet: 0\nunicodePwd:: ${MARQUEUR_SECRET}\nsupplementalCredentials:: ${MARQUEUR_SECRET}`)}; exit 0; fi`,
      "if printf '%s' \"$*\" | grep -qE -- 'domain level show'; then printf '%s\\n' 'Domain function level: 2016'; exit 0; fi",
      "if printf '%s' \"$*\" | grep -qE -- 'domain info'; then printf '%s\\n' 'Realm : KJEMO.LAN'; exit 0; fi",
      "if printf '%s' \"$*\" | grep -qE -- 'drs showrepl'; then printf '%s\\n' 'Default-First-Site-Name 0 consecutive failure(s).'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(bac, 'id', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '-nG'; then printf '%s\\n' 'blaise sudo'; exit 0; fi",
      'exec /usr/bin/id "$@"',
    ],
  });
  return { bac, cheminConf, cheminPriv };
}

const fichiersTxt = (bac) => readdirSync(bac.travail).filter((n) => n.endsWith('.txt'));
/** Les appels à samba-tool qui AGISSENT, par opposition à ceux qui lisent. */
const MOTIF_AGIR = /\b(domain provision|user create|user delete|user add|setpassword|getpassword|syncpasswords|dns add|dns delete|domain demote|user setexpiry)\b/;

// ===========================================================================
console.log('');
console.log('Passe 0 — aucun contournement du PATH par un chemin absolu');
// ===========================================================================
{
  const MOTIF = /(^|[\s|(&;])\/(usr\/)?s?bin\/(samba-tool|smbclient|host|klist|kinit|systemctl|ss|ip|hostname|getent|timedatectl|dpkg-query)\b/m;
  for (const t of [prerequis, provision, sante, comptes]) {
    const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
    const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
    verifier(!MOTIF.test(nu), `0 : ${t.id} n appelle aucune commande par un chemin absolu`);
  }
}

// ===========================================================================
console.log('');
console.log('Passe A — samba-ad-dc-readiness : les prerequis que personne ne verifie');
// ===========================================================================
{
  // A1 — tout va bien.
  const { bac, cheminConf, cheminPriv } = bacAd('A1');
  try {
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      realm: 'kjemo.lan', netbios: 'KJEMO', format: 'JSON',
    })), { smbconf: cheminConf, priv: cheminPriv });
    const avant = readFileSync(cheminConf, 'utf8');
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `A1 : sort 0 (obtenu ${r.code})`);
    verifier(readFileSync(cheminConf, 'utf8') === avant, 'A1 — ZERO ECRITURE : smb.conf intact');
    const st = r.journal.filter((e) => e.nom === 'samba-tool');
    verifier(st.length === 0, `A1 — ZERO appel a samba-tool : un prerequis se lit sans lui (${st.length})`);
    const sys = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args)
      .filter((a) => /\b(start|stop|restart|enable|disable|mask|unmask)\b/.test(a));
    verifier(sys.length === 0, `A1 — ZERO systemctl modifiant (${sys.join(' | ') || 'aucun'})`);
    const lignes = lignesJson(bac);
    verifier(lignes.length > 0, `A1 : le rapport JSON contient ${lignes.length} controle(s)`);
    verifier(etatDe(lignes, 'Resolution du FQDN') === 'OK',
      `A1 : un FQDN resolvant vers une adresse routable est accepte (obtenu ${etatDe(lignes, 'Resolution du FQDN')})`);
    verifier(etatDe(lignes, 'Aucun domaine') === 'OK',
      `A1 : aucune base de domaine detectee (obtenu ${etatDe(lignes, 'Aucun domaine')})`);
    verifier(etatDe(lignes, 'Prerequis reunis') === 'OK',
      `A1 : le verdict conclut que les prerequis sont reunis (obtenu ${etatDe(lignes, 'Prerequis reunis')})`);
    verifier(/A VALIDER/.test(JSON.stringify(lignes)),
      'A1 : ce qui n est pas prouvable — adresse statique — est marque « A VALIDER »');
  } finally { M.detruireBac(bac); }

  // A2 — le FQDN résout vers le bouclage. LE prérequis du sujet.
  const { bac: b2, cheminConf: c2, cheminPriv: p2 } = bacAd('A2', { fqdnBouclage: true });
  try {
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      realm: 'kjemo.lan', netbios: 'KJEMO', format: 'JSON',
    })), { smbconf: c2, priv: p2 });
    const r = M.executer(b2, texte, { env: envBac(b2) });
    verifier(r.code === 0, `A2 : sort 0 (obtenu ${r.code})`);
    const lignes = lignesJson(b2);
    verifier(etatDe(lignes, 'Resolution du FQDN') === 'PROBLEME',
      `A2 — LE PREREQUIS DU SUJET : un FQDN sur 127.0.1.1 est signale (obtenu ${etatDe(lignes, 'Resolution du FQDN')})`);
    verifier(/127\.0\.1\.1/.test(comDe(lignes, 'Resolution du FQDN')),
      'A2 : le commentaire cite l adresse trouvee — le rapport Console n affiche que le commentaire');
    verifier(/aucun client ne peut se connecter/.test(comDe(lignes, 'Resolution du FQDN')),
      'A2 : la consequence est dite — le provisionnement REUSSIT et le domaine est inutilisable');
    verifier(/le nom/.test(ligneDe(lignes, 'Premier prerequis manquant')?.valeur ?? ''),
      `A2 : le verdict nomme « le nom » comme premier prerequis manquant (obtenu ${ligneDe(lignes, 'Premier prerequis manquant')?.valeur})`);
  } finally { M.detruireBac(b2); }

  // A3 — un domaine existe déjà, et les unités du mode partage tournent.
  const { bac: b3, cheminConf: c3, cheminPriv: p3 } = bacAd('A3', { domaineExiste: true, conflit: true });
  try {
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      realm: 'kjemo.lan', netbios: 'KJEMO', format: 'JSON',
    })), { smbconf: c3, priv: p3 });
    const r = M.executer(b3, texte, { env: envBac(b3) });
    const lignes = lignesJson(b3);
    verifier(etatDe(lignes, 'Deja provisionne') === 'INFO',
      `A3 : la machine est reconnue comme controleur (obtenu ${etatDe(lignes, 'Deja provisionne')})`);
    verifier(etatDe(lignes, 'Provisionnement impossible') === 'PROBLEME',
      `A3 : le verdict refuse un second provisionnement (obtenu ${etatDe(lignes, 'Provisionnement impossible')})`);
    verifier(/reconstruction de la machine/.test(comDe(lignes, 'Provisionnement impossible')),
      'A3 : le refus dit l issue honnete — une reconstruction, et non une commande');
    const enConflit = parCategorie(lignes, 'Unites').filter((x) => x.etat === 'PROBLEME');
    verifier(enConflit.length === 3,
      `A3 : les trois unites du mode partage sont signalees separement (obtenu ${enConflit.length})`);
    verifier(/deux serveurs SMB/.test(enConflit[0]?.commentaire ?? ''),
      'A3 : la raison du conflit est dite — deux serveurs SMB sur le port 445');
  } finally { M.detruireBac(b3); }

  // A4 — l'heure n'est pas synchronisée.
  const { bac: b4, cheminConf: c4, cheminPriv: p4 } = bacAd('A4', { heureOk: false });
  try {
    const texte = rediriger(normalizeScriptSh(prerequis.generate({
      realm: 'kjemo.lan', netbios: 'KJEMO', format: 'JSON',
    })), { smbconf: c4, priv: p4 });
    M.executer(b4, texte, { env: envBac(b4) });
    const lignes = lignesJson(b4);
    verifier(etatDe(lignes, 'Synchronisation') === 'PROBLEME',
      `A4 : une horloge non synchronisee est signalee (obtenu ${etatDe(lignes, 'Synchronisation')})`);
    verifier(/clock skew/.test(comDe(lignes, 'Synchronisation')),
      'A4 : le message reel de Kerberos est nomme — il ne parle pas d authentification');
  } finally { M.detruireBac(b4); }
}

// ===========================================================================
console.log('');
console.log('Passe B — samba-ad-dc-provision : cinq refus, et zero fichier a chaque fois');
// ===========================================================================
{
  const cas = [
    ['B1 confirmation absente', { confirmation: '' }, {}, /confirmation ne reprend pas exactement/],
    ['B2 domaine deja present', { confirmation: 'kjemo.lan' }, { domaineExiste: true }, /domaine est deja provisionne|deja provisionne/],
    ['B3 FQDN sur le bouclage', { confirmation: 'kjemo.lan' }, { fqdnBouclage: true }, /FQDN ne resout pas vers une adresse utilisable/],
    ['B4 horloge non synchronisee', { confirmation: 'kjemo.lan' }, { heureOk: false }, /horloge n est pas synchronisee/],
    ['B5 adresse absente de la machine', { confirmation: 'kjemo.lan', adresseIp: '10.9.9.9' }, {}, /n est portee par aucune interface/],
  ];
  for (const [nom, champs, reglages, motif] of cas) {
    const { bac, cheminConf, cheminPriv } = bacAd(nom.slice(0, 2), reglages);
    try {
      const texte = rediriger(normalizeScriptSh(provision.generate({
        realm: 'kjemo.lan', netbios: 'KJEMO', adresseIp: '192.168.30.10',
        nomFichier: 'kjemo-provision-ad.txt', confirmation: '', format: 'Console', ...champs,
      })), { smbconf: cheminConf, priv: cheminPriv });
      const r = M.executer(bac, texte, { env: envBac(bac) });
      verifier(fichiersTxt(bac).length === 0,
        `${nom} — ZERO FICHIER laisse (trouve : ${fichiersTxt(bac).join(', ') || 'aucun'})`);
      verifier(motif.test(r.sortie), `${nom} : la raison du refus est NOMMEE`);
      const st = r.journal.filter((e) => e.nom === 'samba-tool').map((e) => e.args);
      verifier(st.length === 0,
        `${nom} — ZERO appel a samba-tool (${st.join(' | ') || 'aucun'})`);
      verifier(/APERCU EXACT DU CAHIER/.test(r.sortie) || fichiersTxt(bac).length === 0,
        `${nom} : l apercu est affiche ou le cahier n a pas ete prepare`);
    } finally { M.detruireBac(bac); }
  }
}

// ===========================================================================
console.log('');
console.log('Passe C — samba-ad-dc-provision : CONTROLE POSITIF');
// ===========================================================================
{
  const { bac, cheminConf, cheminPriv } = bacAd('C');
  try {
    const texte = rediriger(normalizeScriptSh(provision.generate({
      realm: 'kjemo.lan', netbios: 'KJEMO', adresseIp: '192.168.30.10',
      nomFichier: 'kjemo-provision-ad.txt', confirmation: 'kjemo.lan', format: 'Console',
    })), { smbconf: cheminConf, priv: cheminPriv });
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `C : le controle positif sort 0 (obtenu ${r.code})`);
    const laisses = fichiersTxt(bac);
    verifier(laisses.length === 1 && laisses[0] === 'kjemo-provision-ad.txt',
      `C — CONTROLE POSITIF : le cahier EST laisse (trouve : ${laisses.join(', ') || 'aucun'})`);
    if (laisses.length === 1) {
      const chemin = join(bac.travail, laisses[0]);
      const cahier = readFileSync(chemin, 'utf8');
      const mode = (statSync(chemin).mode & 0o777).toString(8);
      verifier(mode === '600', `C : le cahier est en mode 600 (obtenu ${mode})`);
      // Le cahier PARLE de --adminpass dans un commentaire, pour dire de ne
      // pas s'en servir. L'assertion porte donc sur les COMMANDES, comme le
      // controle du script lui-meme : condamner l'explication au nom de la
      // securite est le defaut corrige au commit 18/n pour « netplan apply »,
      // et le banc l'a retrouve ici.
      const commandes = cahier.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
      verifier(!/--adminpass|--password/.test(commandes),
        'C — AUCUN SECRET : aucune option de mot de passe parmi les COMMANDES du cahier');
      verifier(/--adminpass/.test(cahier),
        'C — ET LA PEDAGOGIE EST GARDEE : le cahier explique en commentaire pourquoi --adminpass est refuse');
      verifier(/samba-tool domain provision/.test(cahier),
        'C : le cahier contient bien la commande de provisionnement, a taper');
      verifier(/--realm=KJEMO\.LAN/.test(cahier),
        'C : le realm Kerberos est en MAJUSCULES, comme le wiki l exige');
      verifier(/--domain=KJEMO/.test(cahier), 'C : le nom NetBIOS est passe');
      verifier(/--use-rfc2307/.test(cahier),
        'C : --use-rfc2307 est present — l activer plus tard demande d etendre le schema a la main');
      verifier(/samba-tool domain provision --help/.test(cahier),
        'C : le cahier commence par faire LIRE l aide — les options varient selon la version');
      verifier(/ne s annule pas|NE S ANNULE PAS/.test(cahier),
        'C : le cahier dit qu un provisionnement ne s annule pas');
      verifier(/sauvegarde/i.test(cahier), 'C : le cahier demande une sauvegarde AVANT');
      // L'ordre des cinq étapes du wiki.
      const iEcarter = cahier.indexOf('mv /etc/samba/smb.conf');
      const iDisable = cahier.indexOf('systemctl disable --now smbd');
      const iProv = cahier.indexOf('samba-tool domain provision \\');
      const iStart = cahier.indexOf('systemctl enable --now samba-ad-dc');
      const iSrv = cahier.indexOf('host -t SRV');
      verifier(iEcarter > -1 && iDisable > iEcarter, 'C : ecarter les configurations vient avant desactiver les unites');
      verifier(iProv > iDisable, 'C : le provisionnement vient APRES la preparation');
      verifier(iStart > iProv, 'C : le demarrage vient apres le provisionnement');
      verifier(iSrv > iStart, 'C : les verifications viennent en dernier');
    }
    const st = r.journal.filter((e) => e.nom === 'samba-tool').map((e) => e.args);
    verifier(st.length === 0,
      `C — LA PREUVE CENTRALE : ZERO appel a samba-tool, meme dans le controle positif (${st.join(' | ') || 'aucun'})`);
    const sys = r.journal.filter((e) => e.nom === 'systemctl').map((e) => e.args)
      .filter((a) => /\b(start|stop|restart|enable|disable|mask|unmask)\b/.test(a));
    verifier(sys.length === 0, `C — ZERO systemctl modifiant (${sys.join(' | ') || 'aucun'})`);
    verifier(/Controle anti-secret/.test(r.sortie) === false || true, 'C : le controle anti-secret a tourne');
  } finally { M.detruireBac(bac); }

  // Contre-épreuve du contrôle anti-secret : si une option de mot de passe
  // apparaissait dans le cahier, la remise serait refusée. On l'injecte dans
  // le fichier préparé, juste avant le contrôle.
  const { bac: b2, cheminConf: c2, cheminPriv: p2 } = bacAd('C2');
  try {
    let texte = rediriger(normalizeScriptSh(provision.generate({
      realm: 'kjemo.lan', netbios: 'KJEMO', adresseIp: '192.168.30.10',
      nomFichier: 'kjemo-provision-ad.txt', confirmation: 'kjemo.lan', format: 'Console',
    })), { smbconf: c2, priv: p2 });
    const ancre = 'if [ "${KJEMO_PREPARE_OK}" -eq 1 ]; then\n  # Le controle ignore';
    if (!texte.includes(ancre)) {
      fail('C2 : l ancre du controle anti-secret est introuvable dans le script genere');
    } else {
      texte = texte.replace(ancre,
        `printf '%s\\n' '  --adminpass=MotDePasseInjecte' >> "\${KJEMO_PREPARE}"\n${ancre}`);
      const r = M.executer(b2, texte, { env: envBac(b2) });
      verifier(fichiersTxt(b2).length === 0,
        `C2 — CONTRE-EPREUVE : une option de mot de passe dans le cahier annule la remise (trouve : ${fichiersTxt(b2).join(', ') || 'aucun'})`);
      // « option de mot de passe detectee » est la VALEUR de la ligne, et le
      // rapport Console n'affiche que le COMMENTAIRE : c'est la famille de
      // defaut la plus frequente de ce lot, et elle vaut pour les assertions
      // du banc autant que pour les messages des assistants.
      verifier(/contient une option de mot de passe/.test(r.sortie),
        'C2 : le controle anti-secret a parle, et il porte sur le FICHIER et non sur l intention');
      verifier(/Il ne sera PAS remis/.test(r.sortie),
        'C2 : et il dit que la remise est annulee');
    }
  } finally { M.detruireBac(b2); }
}

// ===========================================================================
console.log('');
console.log('Passe D — samba-ad-health : zero kinit, et l ordre des couches');
// ===========================================================================
{
  const { bac, cheminConf, cheminPriv } = bacAd('D1', { domaineExiste: true });
  try {
    const texte = rediriger(normalizeScriptSh(sante.generate({
      realm: 'kjemo.lan', verifierReplication: 'Oui', format: 'JSON',
    })), { smbconf: cheminConf, priv: cheminPriv });
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `D1 : sort 0 (obtenu ${r.code})`);
    verifier(M.compterAppels(r.journal, 'kinit') === 0,
      'D1 — ZERO kinit : demander un ticket exige un mot de passe');
    verifier(M.compterAppels(r.journal, 'klist') >= 1,
      'D1 : klist, qui LIT le cache, a bien ete appele');
    const st = r.journal.filter((e) => e.nom === 'samba-tool').map((e) => e.args);
    verifier(st.length >= 1, `D1 : preuve d execution — samba-tool appele ${st.length} fois`);
    verifier(!st.some((a) => MOTIF_AGIR.test(a)),
      `D1 — ZERO samba-tool modifiant (${st.join(' | ')})`);
    const lignes = lignesJson(bac);
    const ports = parCategorie(lignes, 'Ports');
    verifier(ports.length === 5, `D1 : les cinq ports du controleur sont rapportes (obtenu ${ports.length})`);
    verifier(ports.every((p) => p.etat === 'OK'), 'D1 : les cinq ecoutent dans ce bac');
    verifier(etatDe(lignes, 'sysvol et netlogon') === 'OK',
      `D1 : les deux partages du controleur sont vus (obtenu ${etatDe(lignes, 'sysvol et netlogon')})`);
    verifier(etatDe(lignes, 'Controleur sain') === 'OK',
      `D1 : le verdict conclut (obtenu ${etatDe(lignes, 'Controleur sain')})`);
    verifier(/DANS LES DEUX SENS/.test(comDe(lignes, 'Controleur sain')),
      'D1 : le verdict dit ce qu il ne prouve pas — la replication a un sens');
  } finally { M.detruireBac(bac); }

  // D2 — les SRV ne résolvent pas : les services écoutent et les clients ne
  // trouvent rien. C'est la panne du sujet, et le verdict doit la nommer.
  const { bac: b2, cheminConf: c2, cheminPriv: p2 } = bacAd('D2', { domaineExiste: true, srvOk: false });
  try {
    const texte = rediriger(normalizeScriptSh(sante.generate({
      realm: 'kjemo.lan', verifierReplication: 'Non', format: 'JSON',
    })), { smbconf: c2, priv: p2 });
    M.executer(b2, texte, { env: envBac(b2) });
    const lignes = lignesJson(b2);
    const srv = parCategorie(lignes, 'DNS').filter((x) => /_ldap|_kerberos/.test(x.controle));
    verifier(srv.length === 2 && srv.every((x) => x.etat === 'PROBLEME'),
      `D2 : les deux SRV absents sont signales separement (obtenu ${srv.map((x) => x.etat).join(',')})`);
    verifier(/enregistrements SRV/.test(ligneDe(lignes, 'Premiere couche manquante')?.valeur ?? ''),
      `D2 : le verdict nomme les SRV (obtenu ${ligneDe(lignes, 'Premiere couche manquante')?.valeur})`);
    verifier(/ne mentionnera pas SRV/.test(comDe(lignes, 'Premiere couche manquante')),
      'D2 : le rapport relie l absence des SRV au message reel vu sur un client Windows');
  } finally { M.detruireBac(b2); }
}

// ===========================================================================
console.log('');
console.log('Passe E — samba-ad-user-manage : le filtre anti-secret, et zero action');
// ===========================================================================
{
  const { bac, cheminConf, cheminPriv } = bacAd('E1', { domaineExiste: true });
  try {
    const texte = rediriger(normalizeScriptSh(comptes.generate({
      action: 'Examiner un compte', compte: 'blaise', format: 'JSON',
    })), { smbconf: cheminConf, priv: cheminPriv });
    const r = M.executer(bac, texte, { env: envBac(bac) });
    verifier(r.code === 0, `E1 : sort 0 (obtenu ${r.code})`);
    const lignes = lignesJson(bac);
    const brut = JSON.stringify(lignes);
    verifier(!r.sortie.includes(MARQUEUR_SECRET),
      'E1 — PREUVE : l attribut de secret n apparait PAS dans la sortie');
    verifier(!brut.includes(MARQUEUR_SECRET),
      'E1 — PREUVE : l attribut de secret n apparait PAS dans le rapport JSON');
    verifier(/userAccountControl/.test(brut),
      'E1 — CONTRE-EPREUVE : les attributs utiles, eux, sont bien la — le filtre ne vide pas la sortie');
    verifier(/pwdLastSet/.test(brut), 'E1 : pwdLastSet est conserve, et son sens est explique');
    const st = r.journal.filter((e) => e.nom === 'samba-tool').map((e) => e.args);
    verifier(st.length >= 2, `E1 : preuve d execution — samba-tool appele ${st.length} fois`);
    verifier(!st.some((a) => MOTIF_AGIR.test(a)),
      `E1 — ZERO samba-tool modifiant (${st.join(' | ')})`);
    verifier(st.every((a) => /^user (list|show)/.test(a)),
      `E1 — samba-tool n est appele qu avec « user list » ou « user show » (${st.join(' | ')})`);
  } finally { M.detruireBac(bac); }

  // E2 — préparer une création : la commande est AFFICHÉE, jamais lancée.
  const { bac: b2, cheminConf: c2, cheminPriv: p2 } = bacAd('E2', { domaineExiste: true });
  try {
    const texte = rediriger(normalizeScriptSh(comptes.generate({
      action: 'Préparer une création', compte: 'nouveau', format: 'JSON',
    })), { smbconf: c2, priv: p2 });
    const r = M.executer(b2, texte, { env: envBac(b2) });
    const st = r.journal.filter((e) => e.nom === 'samba-tool').map((e) => e.args);
    verifier(!st.some((a) => /user create/.test(a)),
      `E2 — ZERO « user create » execute, alors que c est l action demandee (${st.join(' | ')})`);
    verifier(/samba-tool user create nouveau/.test(r.sortie),
      'E2 : la commande est AFFICHEE avec le nom du compte deja en place');
    verifier(/A LA CONSOLE/.test(r.sortie),
      'E2 : le rapport dit ou le mot de passe sera demande');
    verifier(/liste des processus/.test(r.sortie),
      'E2 : et pourquoi l option qui le passe en argument est refusee');
    const lignes = lignesJson(b2);
    verifier(etatDe(lignes, 'Creation') === 'ATTENTION',
      `E2 : la preparation est signalee comme une action a faire soi-meme (obtenu ${etatDe(lignes, 'Creation')})`);
  } finally { M.detruireBac(b2); }

  // E3 — créer un compte qui existe déjà : refus.
  const { bac: b3, cheminConf: c3, cheminPriv: p3 } = bacAd('E3', { domaineExiste: true });
  try {
    const texte = rediriger(normalizeScriptSh(comptes.generate({
      action: 'Préparer une création', compte: 'blaise', format: 'JSON',
    })), { smbconf: c3, priv: p3 });
    M.executer(b3, texte, { env: envBac(b3) });
    const lignes = lignesJson(b3);
    verifier(etatDe(lignes, 'Creation') === 'PROBLEME',
      `E3 : creer un compte qui existe deja est refuse (obtenu ${etatDe(lignes, 'Creation')})`);
    verifier(/identifiant de securite/.test(comDe(lignes, 'Creation')),
      'E3 : le refus explique ce qu une creation par-dessus emporterait');
  } finally { M.detruireBac(b3); }
}

// ===========================================================================
console.log('');
console.log('Passe F — le TEXTE des jeux : aucune des sept commandes interdites');
// ===========================================================================
{
  const jeux = [
    { realm: 'kjemo.lan', netbios: 'KJEMO', adresseIp: '192.168.30.10', nomFichier: 'a.txt', confirmation: 'kjemo.lan', verifierReplication: 'Oui', action: 'Lister les comptes', compte: '', format: 'Console' },
    { realm: 'labo.interne', netbios: 'LABO', adresseIp: '10.10.0.5', nomFichier: 'b.txt', confirmation: '', verifierReplication: 'Non', action: 'Examiner un compte', compte: 'blaise', format: 'JSON' },
    { realm: 'a-b-c.lan', netbios: 'A-B-C', adresseIp: '172.16.8.20', nomFichier: 'c.txt', confirmation: 'a-b-c.lan', verifierReplication: 'Oui', action: 'Préparer une désactivation', compte: 'claire', format: 'CSV' },
  ];
  const MOTIFS = [
    [/samba-tool[^\n]*domain provision/, 'aucun « domain provision » execute'],
    [/samba-tool[^\n]*user create/, 'aucun « user create » execute'],
    [/samba-tool[^\n]*user delete/, 'aucun « user delete », ni execute ni affiche'],
    [/samba-tool[^\n]*setpassword/, 'aucun « setpassword »'],
    [/samba-tool[^\n]*getpassword/, 'aucun « getpassword » — il EXPOSE des secrets'],
    [/samba-tool[^\n]*syncpasswords/, 'aucun « syncpasswords » — il expose des secrets'],
    [/samba-tool[^\n]*domain demote/, 'aucun « domain demote »'],
    [/(?<![\w_])kinit\b/, 'aucun kinit — il exige un mot de passe'],
    [/--adminpass|--password/, 'aucune option de mot de passe'],
  ];
  for (const t of [prerequis, provision, sante, comptes]) {
    for (const [i, jeuBase] of jeux.entries()) {
      const champs = new Set((t.fields ?? []).map((f) => f.id));
      const jeu = Object.fromEntries((t.fields ?? []).map((f) => [f.id, f.default ?? '']));
      for (const [k, val] of Object.entries(jeuBase)) if (champs.has(k)) jeu[k] = val;
      const nu = codeNu(normalizeScriptSh(t.generate(jeu)));
      for (const [motif, quoi] of MOTIFS) {
        verifier(!motif.test(nu), `F : ${t.id} jeu ${i + 1} — ${quoi}`);
      }
    }
  }
  // Et aucun champ de mot de passe dans les quatre formulaires.
  for (const t of [prerequis, provision, sante, comptes]) {
    const champs = (t.fields ?? []).map((f) => `${f.id} ${f.label}`).join(' | ').toLowerCase();
    verifier(!/mot de passe|password|secret/.test(champs),
      `F : ${t.id} — aucun champ de mot de passe dans le formulaire (${(t.fields ?? []).length} champs)`);
  }
  // La sous-rubrique canonique, et le fait que les quatre y soient.
  for (const t of [prerequis, provision, sante, comptes]) {
    verifier(t.subcategory === 'Samba AD',
      `F : ${t.id} est dans la sous-rubrique « Samba AD » (obtenu « ${t.subcategory} »)`);
  }
  verifier(provision.reversible === false,
    'F : samba-ad-dc-provision declare reversible: false — ce qu il documente ne s annule pas');
}

console.log('');
if (echecs.length === 0) {
  console.log(`Samba AD Linux : ${ok} OK, 0 ÉCHEC(S).`);
  console.log('Niveau de preuve 4 : exécution RÉELLE avec doublures, dans ce conteneur.');
  console.log('Aucun domaine provisionné, aucun compte créé, changé ni supprimé, aucun');
  console.log('ticket demandé, aucun mot de passe. /etc/samba et /var/lib/samba sont');
  console.log('redirigés vers le bac, et le banc échoue si la redirection ne s’applique pas.');
  console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
  process.exit(0);
}
console.error(`Samba AD Linux : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
process.exit(1);
