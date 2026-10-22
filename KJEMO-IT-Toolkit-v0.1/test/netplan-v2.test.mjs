#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 (27/n) — NETPLAN : LA PASSERELLE ET LE FICHIER DE DESTINATION
//
// Deux fautes que « netplan generate » ne voit pas, et que la revue finale a
// retenues :
//
//   1. une passerelle égale à l'adresse de l'hôte, à l'adresse du réseau ou à
//      celle de diffusion était acceptée par le formulaire ;
//   2. rien n'empêchait de nommer le fichier préparé « 50-cloud-init.yaml »
//      (ni de poser un fichier du même nom qu'un existant), alors que
//      cloud-init réécrit ce fichier à chaque démarrage.
//
// Ce banc éprouve les deux, chacune selon le contrat à trois temps :
//   REFUS            le verrou refuse, et rien n'est écrit ni appliqué ;
//   CONTRÔLE POSITIF quand tout est en règle, le candidat est remis ;
//   CONTRE-ÉPREUVE   on désarme le verrou (mutation exacte, une occurrence),
//                    et le banc doit alors VOIR le défaut.
//
// Le dossier /etc/netplan du script est une constante de une ligne
// (KJEMO_NETPLAN_DIR) : le banc la remplace par un dossier du bac, jamais par
// une variable d'environnement. Aucun fichier de la machine hôte n'est lu ni
// écrit ; l'empreinte de /etc/netplan est comparée avant et après.
//
// NIVEAU DE PREUVE : 4 (Bash réel, doublures, dossier du bac). Ubuntu Server
// réel et cloud-init réel : NON EXÉCUTÉ.
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(ROOT, 'dist/noyau-bash.mjs')).href);
const M = await import(pathToFileURL(resolve(ROOT, 'test/mouchards-linux.mjs')).href);
const N = await import(pathToFileURL(resolve(ROOT, 'test/negatifs-lot7.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));
const compte = { refus: 0, positif: 0, contre: 0 };
const refus = (c, m) => { compte.refus += 1; verifier(c, `REFUS : ${m}`); };
const positif = (c, m) => { compte.positif += 1; verifier(c, `POSITIF : ${m}`); };
const contre = (c, m) => { compte.contre += 1; verifier(c, `CONTRE-EPREUVE : ${m}`); };

const netplan = tools.find((t) => t.id === 'netplan-readiness');
if (!netplan) { console.error('ECHEC : netplan-readiness absent du catalogue'); process.exit(1); }

const IFACE = 'enp0s3';
const BASE = {
  interface: IFACE, methode: 'Adresse statique', adresseCidr: '192.168.30.10/24',
  passerelle: '192.168.30.1', dns: '192.168.30.1 1.1.1.1', confirmation: IFACE,
  nomFichier: '99-kjemo-reseau.yaml', format: 'Console',
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
const empreinteMachine = N.empreinteSysteme();

// ===========================================================================
// V1 — LA PASSERELLE
// ===========================================================================
console.log('');
console.log('V1 — la passerelle : facultative, mais jamais l\'hôte, le réseau ni la diffusion');

/** Les cas de la passerelle : [intitulé, adresseCidr, passerelle, refusée ?]. */
const CAS_PASSERELLE = [
  ['égale à l\'adresse de l\'hôte', '192.168.30.10/24', '192.168.30.10', true, 'hote'],
  ['égale à l\'adresse du réseau', '192.168.30.10/24', '192.168.30.0', true, 'reseau'],
  ['égale à l\'adresse de diffusion', '192.168.30.10/24', '192.168.30.255', true, 'diffusion'],
  ['hors du réseau de l\'adresse', '192.168.30.10/24', '192.168.31.1', true, 'hors'],
  ['IPv4 invalide (octet > 255)', '192.168.30.10/24', '192.168.30.300', true, 'invalide'],
  ['/26 : adresse du réseau', '10.0.0.70/26', '10.0.0.64', true, 'reseau'],
  ['/26 : adresse de diffusion', '10.0.0.70/26', '10.0.0.127', true, 'diffusion'],
  ['/16 : adresse du réseau', '10.10.0.5/16', '10.10.0.0', true, 'reseau'],
  ['/16 : adresse de diffusion', '10.10.0.5/16', '10.10.255.255', true, 'diffusion'],
  ['/30 : hôte', '192.168.5.1/30', '192.168.5.1', true, 'hote'],
  ['normale (.1)', '192.168.30.10/24', '192.168.30.1', false, null],
  ['normale (.254)', '192.168.30.10/24', '192.168.30.254', false, null],
  ['/26 : normale', '10.0.0.70/26', '10.0.0.65', false, null],
  ['/16 : normale', '10.10.0.5/16', '10.10.1.1', false, null],
  ['/30 : l\'autre machine', '192.168.5.1/30', '192.168.5.2', false, null],
  ['vide (aucune route par défaut)', '192.168.30.10/24', '', false, null],
];

/** Joue les cas sur un catalogue donné et rend les cas où le verdict est faux. */
function mauvaisVerdicts(outil) {
  const faux = [];
  for (const [nom, adresseCidr, passerelle, doitRefuser] of CAS_PASSERELLE) {
    const refusee = Boolean(outil.validate({ ...BASE, adresseCidr, passerelle }).passerelle);
    if (refusee !== doitRefuser) faux.push(nom);
  }
  return faux;
}

{
  const faux = mauvaisVerdicts(netplan);
  for (const [nom, adresseCidr, passerelle, doitRefuser] of CAS_PASSERELLE) {
    const refusee = Boolean(netplan.validate({ ...BASE, adresseCidr, passerelle }).passerelle);
    if (doitRefuser) refus(refusee, `passerelle ${nom} (${passerelle}) est refusée`);
    else positif(!refusee, `passerelle ${nom}${passerelle ? ` (${passerelle})` : ''} est acceptée`);
  }
  verifier(faux.length === 0, `V1 : aucun verdict faux sur le produit intact (${faux.join(', ') || 'aucun'})`);

  // Le message dit POURQUOI, et nomme la faute.
  const m = (a, g) => netplan.validate({ ...BASE, adresseCidr: a, passerelle: g }).passerelle ?? '';
  refus(/machine elle-même/.test(m('192.168.30.10/24', '192.168.30.10')), 'le message de la passerelle = hôte dit que la machine serait sa propre sortie');
  refus(/RÉSEAU lui-même/.test(m('192.168.30.10/24', '192.168.30.0')), 'le message de la passerelle = réseau le nomme');
  refus(/DIFFUSION/.test(m('192.168.30.10/24', '192.168.30.255')), 'le message de la passerelle = diffusion le nomme');

  // En DHCP la passerelle est ignorée : même absurde, elle ne bloque pas.
  positif(!netplan.validate({ ...BASE, methode: 'DHCP', passerelle: '192.168.30.10' }).passerelle,
    'en DHCP, la passerelle saisie est ignorée et ne bloque pas');

  // Passerelle facultative : pas de route par défaut dans le YAML produit.
  const sansPasserelle = netplan.generate({ ...BASE, passerelle: '' });
  positif(!/to: default/.test(sansPasserelle) && !/via:/.test(sansPasserelle),
    'sans passerelle, le YAML ne déclare aucune route par défaut');
  positif(/aucune - pas de route par defaut/.test(sansPasserelle),
    'et le tableau des paramètres le dit (et ne prétend pas « fournie par DHCP »)');
  const avecPasserelle = netplan.generate(BASE);
  positif(/to: default/.test(avecPasserelle) && /via: 192\.168\.30\.1/.test(avecPasserelle),
    'avec passerelle, la route par défaut est écrite');
  positif(!netplan.validate({ ...BASE, passerelle: '' }).passerelle && !netplan.validate({ ...BASE, passerelle: '' }).adresseCidr,
    'la passerelle vide est acceptée en statique');
}

// Contre-épreuves : chaque verrou est arraché à tour de rôle dans une copie de dist/.
const VERROUS = [
  ['hors du réseau', 'if (((gw & masque) >>> 0) !== reseau) {', 'if (false) {', 'hors du réseau de l\'adresse'],
  ['égale à l\'hôte', 'if (gw === hote) {', 'if (false) {', 'égale à l\'adresse de l\'hôte'],
  ['égale au réseau', 'if (bits <= 30 && gw === reseau) {', 'if (false) {', 'égale à l\'adresse du réseau'],
  ['égale à la diffusion', 'if (bits <= 30 && gw === diffusion) {', 'if (false) {', 'égale à l\'adresse de diffusion'],
];
for (const [nom, de, vers, cas] of VERROUS) {
  let copie = null;
  try {
    copie = await N.distMutee('outils-linux-i.mjs', de, vers, `passerelle : ${nom}`);
    const muté = copie.tools.find((t) => t.id === 'netplan-readiness');
    const faux = mauvaisVerdicts(muté);
    contre(faux.length > 0, `verrou « ${nom} » arraché : le banc voit un défaut (verdicts faux : ${faux.join(', ') || 'AUCUN'})`);
    contre(faux.includes(cas), `verrou « ${nom} » arraché : c'est bien le cas « ${cas} » qui passe à tort`);
  } catch (e) {
    fail(`V1 contre-épreuve « ${nom} » : ${e.message}`);
  } finally { copie?.nettoyer(); }
}
{
  // La passerelle devient obligatoire en statique : le cas « vide » doit basculer.
  let copie = null;
  try {
    copie = await N.distMutee('outils-linux-i.mjs',
      "if (passerelle !== '') {\n        const e = erreurPasserelle(adresse, passerelle);",
      "if (true) {\n        const e = erreurPasserelle(adresse, passerelle);", 'passerelle facultative');
    const muté = copie.tools.find((t) => t.id === 'netplan-readiness');
    contre(mauvaisVerdicts(muté).includes('vide (aucune route par défaut)'),
      'passerelle rendue obligatoire : le banc voit que le cas « vide » est refusé à tort');
  } catch (e) { fail(`V1 contre-épreuve facultatif : ${e.message}`); } finally { copie?.nettoyer(); }
}

// ===========================================================================
// V2 — LE NOM DU FICHIER, AU FORMULAIRE
// ===========================================================================
console.log('');
console.log('V2 — le nom du fichier ne désigne jamais un fichier cloud-init');
{
  for (const nom of ['50-cloud-init.yaml', '99-Cloud-Init.yaml', '10-cloud-init-extra.yaml', 'cloud-init.yaml']) {
    refus(Boolean(netplan.validate({ ...BASE, nomFichier: nom }).nomFichier), `le nom « ${nom} » est refusé`);
  }
  for (const nom of ['99-kjemo-reseau.yaml', '60-vlan30.yaml', '70-labo.yaml']) {
    positif(!netplan.validate({ ...BASE, nomFichier: nom }).nomFichier, `le nom « ${nom} » est accepté`);
  }
  const defaut = netplan.fields.find((f) => f.id === 'nomFichier')?.default ?? '';
  positif(!/cloud-init/i.test(defaut), `le nom proposé par défaut (« ${defaut} ») n'est pas un nom cloud-init`);
  const valeurs = JSON.parse(readFileSync(join(ROOT, 'test/generated/_valeurs-linux.json'), 'utf8'));
  const jeux = Object.entries(valeurs).filter(([k]) => k.startsWith('netplan-readiness__'));
  positif(jeux.length === 8 && jeux.every(([, v]) => !/cloud-init/i.test(v.nomFichier)),
    `aucun des ${jeux.length} jeux de données ne propose un nom cloud-init`);
  positif(jeux.every(([, v]) => v.methode !== 'Adresse statique' || v.passerelle === ''
      || v.passerelle !== v.adresseCidr.split('/')[0]),
    'aucun jeu de données statique ne prend l\'adresse de l\'hôte pour passerelle');
  positif(jeux.every(([, v]) => Object.keys(netplan.validate(v)).length === 0),
    'les 8 jeux de données passent la validation corrigée');

  let copie = null;
  try {
    copie = await N.distMutee('outils-linux-i.mjs', '} else if (/cloud-init/i.test(String(v.nomFichier))) {', '} else if (false) {', 'nom cloud-init');
    const muté = copie.tools.find((t) => t.id === 'netplan-readiness');
    contre(!muté.validate({ ...BASE, nomFichier: '50-cloud-init.yaml' }).nomFichier,
      'refus du nom cloud-init arraché : « 50-cloud-init.yaml » passe, et le banc le voit');
  } catch (e) { fail(`V2 contre-épreuve : ${e.message}`); } finally { copie?.nettoyer(); }
}

// ===========================================================================
// V3 — L'EXÉCUTION : INVENTAIRE, CLOUD-INIT, NOM PRIS, CONFIGURATIONS CONCURRENTES
// ===========================================================================
console.log('');
console.log('V3 — le script inventorie, protège cloud-init, et refuse l\'écrasement et la concurrence');

const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;
const CONSTANTE = "KJEMO_NETPLAN_DIR='/etc/netplan'";

const ENTETE_CLOUD_INIT = [
  '# This file is generated from information provided by the datasource.  Changes',
  '# to it will not persist across an instance reboot.  To disable cloud-init\'s',
  '# network configuration capabilities, write a file',
  '# /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg with the following:',
  '# network: {config: disabled}',
].join('\n');
const yamlIface = (iface) => `network:\n    ethernets:\n        ${iface}:\n            dhcp4: true\n    version: 2\n`;
const CLOUD_INIT = `${ENTETE_CLOUD_INIT}\n${yamlIface(IFACE)}`;

/** Un bac avec un dossier « netplan » factice dans le bac, jamais /etc/netplan. */
function bac(nom, fichiers, { modifierTexte = null, valeurs = {} } = {}) {
  const b = M.creerBac(nom);
  M.poserMouchard(b, 'ip', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- 'link show dev'; then",
      `  printf '%s\\n' ${sq(`${IFACE}            UP             08:00:27:aa:bb:cc`)}`,
      '  exit 0',
      'fi',
      "if printf '%s' \"$*\" | grep -qE -- 'link show'; then",
      `  printf '%s\\n' ${sq(`lo UNKNOWN 00:00:00:00:00:00\n${IFACE} UP 08:00:27:aa:bb:cc`)}`,
      '  exit 0',
      'fi',
      'exit 0',
    ],
  });
  M.poserMouchard(b, 'netplan', {
    code: 0,
    avant: [
      "if printf '%s' \"$*\" | grep -qE -- '--version'; then printf '%s\\n' 'netplan.io 1.1.2'; exit 0; fi",
      'exit 0',
    ],
  });
  M.poserMouchard(b, 'systemctl', { code: 0, sortie: 'active' });
  M.poserMouchard(b, 'nmcli', { code: 1 });
  M.poserMouchard(b, 'networkctl', { code: 0, sortie: '' });

  const dossier = join(b.racine, 'etc-netplan');
  mkdirSync(dossier);
  for (const [f, contenu] of Object.entries(fichiers)) writeFileSync(join(dossier, f), contenu, 'utf8');

  let texte = normalizeScriptSh(netplan.generate({ ...BASE, ...valeurs }));
  // La constante de production est exactement UNE ligne : on la remplace par le bac.
  const n = texte.split(CONSTANTE).length - 1;
  if (n !== 1) throw new Error(`la constante ${CONSTANTE} est trouvée ${n} fois (exactement 1 exigée)`);
  texte = texte.replace(CONSTANTE, () => `KJEMO_NETPLAN_DIR=${sq(dossier)}`);
  if (modifierTexte) texte = modifierTexte(texte);
  return { b, texte, dossier };
}

/** Empreinte du dossier factice : noms ET contenus. */
const empreinteDossier = (dossier) => readdirSync(dossier).sort()
  .map((f) => `${f}:${sha(readFileSync(join(dossier, f)))}`).join('|');
const laisses = (b) => (existsSync(b.travail) ? readdirSync(b.travail).filter((f) => /kjemo-netplan/.test(f)) : []);

function jouer(nom, fichiers, options = {}) {
  const { b, texte, dossier } = bac(nom, fichiers, options);
  const avant = empreinteDossier(dossier);
  const r = M.executer(b, texte, { env: { HOME: b.travail } });
  const apres = empreinteDossier(dossier);
  const candidats = laisses(b);
  const appliquer = r.journal.filter((e) => e.nom === 'netplan' && /\b(apply|try)\b/.test(e.args));
  const generate = r.journal.find((e) => e.nom === 'netplan' && /generate/.test(e.args))?.args ?? '';
  const contenuCandidat = candidats[0] ? readFileSync(join(b.travail, candidats[0]), 'utf8') : '';
  M.detruireBac(b);
  return { r, avant, apres, candidats, appliquer, generate, dossier, contenuCandidat };
}

// Les prédicats de chaque scénario, réutilisés pour les contre-épreuves.
const SCENARIOS = {
  // cloud-init seul, déclarant l'interface : annoncé, intact, candidat séparé remis.
  S1: { nom: 'cloud-init seul', fichiers: { '50-cloud-init.yaml': CLOUD_INIT }, remis: true, annonce: true },
  // en-tête cloud-init sous un AUTRE nom : reconnu à l'en-tête.
  S2: { nom: 'en-tête cloud-init sous un autre nom', fichiers: { '10-lxd.yaml': `${ENTETE_CLOUD_INIT}\n${yamlIface('eth9')}` }, remis: true, annonce: true },
  // nom déjà pris par un fichier ordinaire.
  S3: { nom: 'nom déjà pris', fichiers: { '99-kjemo-reseau.yaml': yamlIface('eth7') }, remis: false, annonce: false, motif: /Nom deja pris/ },
  // deux fichiers déclarent déjà l'interface.
  S4: { nom: 'interface déclarée deux fois', fichiers: { '50-cloud-init.yaml': CLOUD_INIT, '60-manuel.yaml': yamlIface(IFACE) }, remis: false, annonce: true, motif: /declaree plusieurs fois/ },
  // un seul fichier déclare l'interface, les autres non : remis.
  S5: { nom: 'une seule déclaration parmi plusieurs fichiers', fichiers: { '50-cloud-init.yaml': CLOUD_INIT, '60-autre.yaml': yamlIface('eth5') }, remis: true, annonce: true },
  // dossier vide.
  S6: { nom: 'dossier vide', fichiers: {}, remis: true, annonce: false },
  // un fichier cloud-init au nom de cloud-init, sans en-tête (nom seul).
  S7: { nom: 'nom cloud-init sans en-tête', fichiers: { '50-cloud-init.yaml': yamlIface('eth8') }, remis: true, annonce: true },
};

/** Évalue un scénario : rend la liste des défauts observés (vide = tout est conforme). */
function defauts(id, resultat) {
  const s = SCENARIOS[id];
  const d = [];
  const sortie = resultat.r.sortie;
  if (resultat.appliquer.length > 0) d.push(`netplan apply/try appelé (${resultat.appliquer.map((e) => e.args).join(' | ')})`);
  if (resultat.avant !== resultat.apres) d.push('le dossier netplan a CHANGÉ');
  const remis = resultat.candidats.length === 1 && /A FAIRE MAINTENANT/.test(sortie);
  if (s.remis && !remis) d.push('le candidat n\'a pas été remis');
  if (!s.remis && (resultat.candidats.length > 0 || /A FAIRE MAINTENANT/.test(sortie))) d.push('un candidat a été remis alors qu\'il fallait bloquer');
  if (s.annonce && !/Fichier produit par cloud-init/.test(sortie)) d.push('le fichier cloud-init n\'est pas annoncé');
  if (!s.annonce && /Fichier produit par cloud-init/.test(sortie)) d.push('un fichier cloud-init est annoncé à tort');
  if (s.motif && !s.motif.test(sortie)) d.push('le motif du blocage n\'est pas dit');
  if (!/--root-dir/.test(resultat.generate) && /Validation/.test(sortie) && resultat.generate !== '') d.push('la validation n\'a pas employé --root-dir');
  return d;
}

const RESULTATS = {};
for (const [id, s] of Object.entries(SCENARIOS)) {
  RESULTATS[id] = jouer(`v3-${id.toLowerCase()}`, s.fichiers);
  const d = defauts(id, RESULTATS[id]);
  const registre = s.remis ? positif : refus;
  registre(d.length === 0, `${id} — ${s.nom} : conforme (${d.join(' ; ') || 'aucun défaut'})`);
}
{
  const r1 = RESULTATS.S1;
  positif(r1.candidats.length === 1 && !/cloud-init/i.test(r1.candidats[0]),
    `S1 : le candidat remis porte un autre nom que le fichier cloud-init (${r1.candidats.join(', ')})`);
  positif(r1.generate.includes('--root-dir') && !/ \/etc\/netplan/.test(r1.generate),
    `S1 : la validation s'est faite sur une copie (${r1.generate})`);
  positif(/n a pas ete modifie|ne le modifie JAMAIS/.test(r1.r.sortie),
    'S1 : le script dit qu\'il ne modifie pas le fichier cloud-init');
  refus(RESULTATS.S3.candidats.length === 0, 'S3 : aucun candidat laissé quand le nom est pris');
  refus(RESULTATS.S4.candidats.length === 0, 'S4 : aucun candidat laissé quand deux fichiers déclarent l\'interface');
  refus(/PROBLEME/.test(RESULTATS.S4.r.sortie) && /CONCURRENTE|concurren/i.test(RESULTATS.S4.r.sortie),
    'S4 : le blocage est nommé (configuration concurrente)');
}

// S8 — le fichier téléchargé a été ÉDITÉ pour viser 50-cloud-init.yaml : le verrou du script tient seul.
{
  const mod = (t) => N.muter(t, "KJEMO_NOM_FICHIER='99-kjemo-reseau.yaml'", "KJEMO_NOM_FICHIER='50-cloud-init.yaml'", 'S8 nom édité');
  const res = jouer('v3-s8', { '50-cloud-init.yaml': CLOUD_INIT }, { modifierTexte: mod });
  refus(res.candidats.length === 0 && /Nom deja pris/.test(res.r.sortie) && res.avant === res.apres && res.appliquer.length === 0,
    'S8 : un script édité pour viser 50-cloud-init.yaml est bloqué à l\'exécution, le fichier est intact');
}

// --- Contre-épreuves : on désarme chaque verrou du SCRIPT, et le banc doit le voir.
function contreEpreuve(id, intitule, de, vers, extra = null) {
  try {
    const res = jouer(`ce-${id}`, SCENARIOS[id].fichiers, { modifierTexte: (t) => N.muter(t, de, vers, intitule) });
    const d = defauts(id, res);
    contre(d.length > 0, `${intitule} : le banc VOIT le défaut (${d.join(' ; ') || 'AUCUN — le banc est aveugle'})`);
    if (extra) contre(extra(res, d), `${intitule} : et c'est le bon défaut`);
  } catch (e) { fail(`contre-épreuve « ${intitule} » : ${e.message}`); }
}
contreEpreuve('S3', 'verrou « nom déjà pris » désarmé', 'KJEMO_NOM_LIBRE_OK=0', 'KJEMO_NOM_LIBRE_OK=1',
  (res) => res.candidats.length === 1);
contreEpreuve('S4', 'verrou « configuration concurrente » désarmé', 'KJEMO_CONCURRENCE_OK=0', 'KJEMO_CONCURRENCE_OK=1',
  (res) => res.candidats.length === 1);
contreEpreuve('S2', 'détection par en-tête désarmée', "grep -qiE 'cloud-init|provided by the datasource'", "grep -qiE 'zzz-jamais-present'",
  (res, d) => d.some((x) => /pas annoncé/.test(x)));
contreEpreuve('S7', 'détection par le nom désarmée', "grep -qi 'cloud-init'", "grep -qi 'zzz-jamais-present'",
  (res, d) => d.some((x) => /pas annoncé/.test(x)));
// Un script qui écrirait dans le fichier cloud-init : l'empreinte du dossier doit bouger.
contreEpreuve('S1', 'écriture dans le fichier cloud-init injectée', 'KJEMO_CLOUDINIT=""',
  'KJEMO_CLOUDINIT=""\nprintf \'%s\\n\' injecte >> "${KJEMO_NETPLAN_DIR}/50-cloud-init.yaml"',
  (res, d) => d.some((x) => /CHANGÉ/.test(x)));
// Un script qui lancerait netplan apply : le journal doit le dire.
contreEpreuve('S1', '« netplan apply » injecté', 'KJEMO_CLOUDINIT=""', 'KJEMO_CLOUDINIT=""\nnetplan apply',
  (res, d) => d.some((x) => /apply\/try/.test(x)));

// ===========================================================================
// V4 — LES HUIT SCRIPTS GÉNÉRÉS
// ===========================================================================
console.log('');
console.log('V4 — les huit scripts générés de netplan-readiness');
{
  const dir = join(ROOT, 'test/generated');
  const fichiers = readdirSync(dir).filter((f) => f.startsWith('netplan-readiness__') && f.endsWith('.sh'));
  positif(fichiers.length === 8, `huit scripts netplan-readiness sont générés (obtenu ${fichiers.length})`);
  const { codeNu } = await import(pathToFileURL(resolve(ROOT, 'scripts/familles-dangereuses.mjs')).href);
  for (const f of fichiers) {
    const t = readFileSync(join(dir, f), 'utf8');
    const nu = codeNu(t);
    refus(!/\bnetplan\s+(apply|try)\b/.test(nu), `${f} : ni « netplan apply » ni « netplan try » dans le code`);
    positif(t.split(CONSTANTE).length - 1 === 1, `${f} : /etc/netplan est une constante d'une ligne`);
    positif(/Fichier produit par cloud-init/.test(t) && /Nom deja pris/.test(t) && /declaree plusieurs fois/.test(t),
      `${f} : l'inventaire cloud-init, le nom pris et la concurrence sont présents`);
    positif(!/\n\s*cp -p -- "\$\{KJEMO_PREPARE\}" "\$\{KJEMO_NETPLAN_DIR\}/.test(t) && !/>\s*"?\$\{?KJEMO_NETPLAN_DIR/.test(nu),
      `${f} : aucune écriture dans le dossier Netplan`);
  }
}

// ===========================================================================
// MACHINE HÔTE
// ===========================================================================
{
  const apres = N.empreinteSysteme();
  const diff = Object.keys(empreinteMachine).filter((k) => empreinteMachine[k] !== apres[k]);
  verifier(diff.length === 0, `la machine hôte n'a pas changé (${diff.join(', ') || 'aucune différence'})`);
}

console.log('');
for (const [k, v] of Object.entries(compte)) verifier(v > 0, `le contrat à trois temps est tenu : ${k} > 0 (${v})`);
console.log(`Netplan v2 : ${ok} OK, ${echecs.length} ÉCHEC(S) — refus ${compte.refus}, positifs ${compte.positif}, contre-épreuves ${compte.contre}.`);
console.log('Ubuntu Server réel, cloud-init réel, netplan try réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
