#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 (25/n) — CONTRE-ÉPREUVES DU BANC NÉGATIF : IL DOIT ÉCHOUER QUAND UN VERROU DU PRODUIT SAUTE
//
// test/negatifs-lot7.test.mjs éprouve 19 familles de verrous, et chacune porte
// sa propre contre-épreuve interne. Reste la question qu'on oublie : le banc,
// pris dans son ensemble, devient-il ROUGE quand le PRODUIT régresse ?
//
// Ce fichier y répond. Pour chaque panne, une COPIE de dist/ est mutilée au
// SOURCE (une mutation exacte, appliquée exactement une fois), puis le banc
// négatif est lancé sur cette copie (KJEMO_DIST_DIR), restreint aux familles
// concernées (KJEMO_FAMILLES). On exige :
//   - un code de sortie 1 (jamais 0, jamais un autre code) ;
//   - un [ECHEC] porté par la FAMILLE qui doit voir cette panne.
// Un contrôle positif ouvre la série : mêmes familles, dist/ intact, code 0.
//
// Séquentiel : un banc enfant à la fois, chacun avec ses bacs jetables.
// ---------------------------------------------------------------------------
import { cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BANC = resolve(ROOT, 'test/negatifs-lot7.test.mjs');

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

/** Une panne produit : fichier, texte exact, remplacement, familles jouées, familles qui doivent rougir. */
const PANNES = [
  { id: 'P01', nom: 'la confirmation s\'ouvre toujours (« if true »)', fichier: 'gardes-bash.mjs',
    de: '`if [ "\\${${variableSaisie}}" = ${shQuote(phraseAttendue)} ]; then`,', vers: '\'if true; then\',',
    jouer: 'N01,N02,N03', rouge: ['N01', 'N02', 'N03'] },
  { id: 'P02', nom: 'le gardien de chemin ne regarde plus les racines système', fichier: 'gardes-bash.mjs',
    de: '\'    if kjemo_sous_racine "${canon}" "${racine}"; then\',', vers: '\'    if false; then\',',
    jouer: 'N08', rouge: ['N08'] },
  { id: 'P03', nom: 'shQuote cite entre guillemets doubles : $(…) s\'exécute', fichier: 'noyau-bash.mjs',
    de: 'return `\'${s.split("\'").join("\'\\\\\'\'")}\'`;', vers: 'return `"${s}"`;',
    jouer: 'N09', rouge: ['N09'] },
  { id: 'P04', nom: 'les bornes d\'un port ne sont plus vérifiées', fichier: 'validateurs-linux.mjs',
    de: 'if (n < min || n > max) {', vers: 'if (false) {', jouer: 'N14', rouge: ['N14'] },
  { id: 'P05', nom: 'le client NFS « * » passe (règle dédiée ET repli nom d\'hôte)', fichier: 'validateurs-linux.mjs',
    de: ["if (s === '*' || s.includes('*') || s.includes('?')) {", '  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(s)) {'],
    vers: ['if (false) {', '  if (true) {'], jouer: 'N13', rouge: ['N13'] },
  { id: 'P06', nom: 'arrêter SSH n\'est plus refusé par la session', fichier: 'outils-linux-h.mjs',
    de: '\'        KJEMO_SESSION_OK=0\',', vers: '\'        KJEMO_SESSION_OK=1\',', jouer: 'N06', rouge: ['N06'] },
  { id: 'P07', nom: 'durcir SSH sans nommer de compte est accepté par le formulaire', fichier: 'outils-linux-j.mjs',
    de: "if (demande && admin === '') {", vers: 'if (false) {', jouer: 'N15', rouge: ['N15'] },
  { id: 'P08', nom: 'la preuve du second accès SSH ne conditionne plus la remise', fichier: 'outils-linux-j.mjs',
    de: "['KJEMO_PREUVE_OK', 'Le second acces", vers: "['KJEMO_DEMANDE_OK', 'Le second acces", jouer: 'N15', rouge: ['N15'] },
  { id: 'P09', nom: 'l\'assistant Netplan lance « netplan apply »', fichier: 'outils-linux-i.mjs',
    de: '\'  netplan generate --root-dir "${KJEMO_RACINE}" > "${KJEMO_TMP}/generate.out" 2>&1 || kjemo_code=$?\',',
    vers: '\'  netplan generate --root-dir "${KJEMO_RACINE}" > "${KJEMO_TMP}/generate.out" 2>&1 || kjemo_code=$?\',\n      \'  netplan apply\',',
    jouer: 'N16', rouge: ['N16'] },
  { id: 'P10', nom: 'les groupes privilégiés (sudo, docker…) sont acceptés', fichier: 'outils-linux-g.mjs',
    de: "const GROUPES_PRIVILEGIES = ['root', 'sudo', 'admin', 'adm', 'shadow', 'wheel',\n  'docker', 'lxd', 'disk', 'kvm', 'libvirt'];", vers: 'const GROUPES_PRIVILEGIES = [];',
    jouer: 'N11', rouge: ['N11'] },
  { id: 'P11', nom: 'le mode 777 est accepté', fichier: 'outils-linux-g.mjs',
    de: '} else if (/[0-7]?777$/.test(mode) || /[0-7]?666$/.test(mode)) {', vers: '} else if (false) {', jouer: 'N10', rouge: ['N10'] },
  { id: 'P12', nom: 'la porte de jonction de domaine devient « $true »', fichier: 'outils-poste-jonction.mjs',
    de: '$conditionsAppliquer = $KjemoEleve -and', vers: '$conditionsAppliquer = $true -or $KjemoEleve -and', jouer: 'N19', rouge: ['N19'] },
];

const dossier = mkdtempSync(join(tmpdir(), 'kjemo-neg-contre-'));

/** Lance le banc négatif en processus enfant, avec son vrai code de sortie. */
function lancer({ distDir = null, familles }) {
  const env = { ...process.env, KJEMO_FAMILLES: familles };
  if (distDir) env.KJEMO_DIST_DIR = distDir; else delete env.KJEMO_DIST_DIR;
  const r = spawnSync(process.execPath, [BANC], { cwd: ROOT, encoding: 'utf8', env, timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // Une famille est rouge soit par une ligne [ECHEC] Nxx —, soit par la ligne
  // CONTRAT qui la nomme (« CONTRAT — Nxx … : refus=0, positif=0 … ») quand
  // sa boucle s'est interrompue avant d'enregistrer ses trois temps.
  const rouges = [...new Set([
    ...[...sortie.matchAll(/\[ECHEC\] (N\d\d) —/g)].map((m) => m[1]),
    ...[...sortie.matchAll(/\[ECHEC\] CONTRAT — (N\d\d) /g)].map((m) => m[1]),
  ])];
  return { code: r.status, sortie, rouges };
}

try {
  console.log('');
  console.log('Contrôle positif — dist/ intact, mêmes familles : le banc doit être vert');
  const temoin = lancer({ familles: 'N01,N02,N06,N08,N10,N11,N13,N14,N15,N16,N19' });
  verifier(temoin.code === 0, `P00 : sur le produit sain, le banc sort 0 (obtenu ${temoin.code}, rouges : ${temoin.rouges.join(', ') || 'aucun'})`);
  const total = /Négatifs LOT 7 : (\d+) OK, (\d+) ÉCHEC/.exec(temoin.sortie);
  verifier(Boolean(total) && Number(total[1]) > 400 && Number(total[2]) === 0, `P00 : le banc a réellement joué ses vérifications (${total ? total[1] : 'aucun total'} OK)`);

  console.log('');
  console.log('Contre-épreuves — chaque régression du produit doit rougir la bonne famille');
  for (const p of PANNES) {
    const copie = join(dossier, p.id);
    cpSync(resolve(ROOT, 'dist'), copie, { recursive: true });
    const cible = join(copie, p.fichier);
    const avant = readFileSync(cible, 'utf8');
    const des = Array.isArray(p.de) ? p.de : [p.de];
    const verss = Array.isArray(p.vers) ? p.vers : [p.vers];
    let apres = avant;
    let appliquee = true;
    des.forEach((d, i) => {
      const n = apres.split(d).length - 1;
      if (n !== 1) { appliquee = false; fail(`${p.id} : la mutation « ${p.nom} » trouve sa cible ${n} fois dans ${p.fichier} (exactement 1 exigée)`); return; }
      apres = apres.replace(d, () => verss[i]);
    });
    if (!appliquee) { rmSync(copie, { recursive: true, force: true }); continue; }
    verifier(apres !== avant, `${p.id} — la mutation a bien MODIFIÉ ${p.fichier}`);
    writeFileSync(cible, apres, 'utf8');

    const r = lancer({ distDir: copie, familles: p.jouer });
    verifier(r.code === 1, `${p.id} — ${p.nom} : le banc ÉCHOUE, code 1 (obtenu ${r.code})`);
    for (const f of p.rouge) {
      verifier(r.rouges.includes(f), `${p.id} — la famille ${f} a vu la panne (familles en échec : ${r.rouges.join(', ') || 'aucune'})`);
    }
    rmSync(copie, { recursive: true, force: true });
  }
} finally {
  rmSync(dossier, { recursive: true, force: true });
}

console.log('');
console.log(`Contre-épreuves du banc négatif : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log(`${PANNES.length} régressions du produit injectées dans une copie de dist/, chacune vue par la bonne famille.`);
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
