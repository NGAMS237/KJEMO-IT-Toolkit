#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 (25/n) — BANC DE LA SONDE DE CAPACITÉ : NON EXÉCUTÉ N'EST PAS VERT
//
// Ce banc éprouve la décision prise par test/permissions-linux.test.mjs quand
// le conteneur interdit `chown` vers un autre UID. Trois exigences :
//
//   1. une capacité ABSENTE donne NON EXÉCUTÉ, code 77, raison exacte — jamais 0 ;
//   2. une capacité PRÉSENTE exécute le banc, et un chown qui échoue ENSUITE est
//      un ÉCHEC (code 1) — c'est la distinction « limite du conteneur » /
//      « régression de l'assistant » ;
//   3. un environnement peut EXIGER la capacité (KJEMO_CAPACITES_REQUISES=1) :
//      l'absence est alors un ÉCHEC.
//
// Chaque exigence a sa contre-épreuve : on simule la panne (un faux `chown` en
// tête du PATH) et on exige que le banc DÉTECTE la situation. Une sonde qui
// répondrait « présente » partout rendrait la première exigence vraie pour rien.
//
// Le banc imbriqué est lancé en processus ENFANT, avec ses vrais codes de sortie
// lus un par un : on ne cherche pas « NON EXÉCUTÉ » dans un journal pour en
// déduire un code.
// ---------------------------------------------------------------------------
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CAP = await import(pathToFileURL(resolve(ROOT, 'test/capacites-linux.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('ECHEC : ce banc lance le banc des permissions, qui exige root.');
  console.error('  sudo -E env "PATH=$PATH" node test/capacites-linux.test.mjs');
  process.exit(1);
}

const BANC = resolve(ROOT, 'test/permissions-linux.test.mjs');
const dossier = mkdtempSync(join(tmpdir(), 'kjemo-capacites-'));

/** Un faux `chown` : message et code choisis. */
function fauxChown(nom, { message, code }) {
  const bin = join(dossier, nom);
  execFileSync('mkdir', ['-p', bin]);
  writeFileSync(join(bin, 'chown'),
    `#!/bin/sh\n${message ? `printf '%s\\n' ${JSON.stringify(message)} >&2\n` : ''}exit ${code}\n`, 'utf8');
  chmodSync(join(bin, 'chown'), 0o755);
  return bin;
}

const compteEssai = execFileSync('getent', ['passwd'], { encoding: 'utf8' }).split('\n')
  .map((l) => l.split(':')).find((c) => Number(c[2]) >= 1000 && Number(c[2]) < 30000);
if (!compteEssai) {
  console.error('ECHEC : aucun compte ordinaire (UID >= 1000) : la sonde n a rien a mesurer.');
  process.exit(1);
}
const [NOM, , UID, GID] = compteEssai;
const GROUPE = execFileSync('getent', ['group', GID], { encoding: 'utf8' }).split(':')[0];
const uid = Number(UID);

try {
  // =========================================================================
  console.log('');
  console.log('Passe A — la décision, sur toutes les entrées possibles');
  // =========================================================================
  const D = (etat, env = {}) => CAP.decider({ etat, raison: 'r' }, env).verdict;
  verifier(D('PRESENTE') === 'EXECUTER', 'A1 : capacité présente → EXECUTER');
  verifier(D('PRESENTE', { KJEMO_CAPACITES_REQUISES: '1' }) === 'EXECUTER',
    'A2 : capacité présente et exigée → EXECUTER');
  verifier(D('ABSENTE') === 'NON_EXECUTE', 'A3 : capacité absente, non exigée → NON_EXECUTE');
  verifier(D('ABSENTE', { KJEMO_CAPACITES_REQUISES: '1' }) === 'ECHEC',
    'A4 : capacité absente MAIS exigée → ECHEC (un runner dégradé ne passe pas en silence)');
  verifier(D('INDETERMINEE') === 'ECHEC', 'A5 : capacité indéterminée → ECHEC, jamais NON_EXECUTE');
  verifier(D('INDETERMINEE', { KJEMO_CAPACITES_REQUISES: '1' }) === 'ECHEC', 'A6 : indéterminée et exigée → ECHEC');
  verifier(D('N_IMPORTE_QUOI') === 'ECHEC', 'A7 : un état inconnu → ECHEC (aucune porte dérobée vers le vert)');
  // La seule voie vers NON_EXECUTE est « ABSENTE sans exigence ».
  const combinaisons = [];
  for (const etat of ['PRESENTE', 'ABSENTE', 'INDETERMINEE', 'X']) {
    for (const req of [undefined, '0', '1', 'oui']) {
      combinaisons.push([etat, req, D(etat, { KJEMO_CAPACITES_REQUISES: req })]);
    }
  }
  const nonExec = combinaisons.filter((c) => c[2] === 'NON_EXECUTE');
  // Trois valeurs d'exigence ne sont pas « 1 » (absente, '0', 'oui') : seule la valeur exacte « 1 » exige.
  verifier(nonExec.length === 3 && nonExec.every((c) => c[0] === 'ABSENTE' && c[1] !== '1'),
    `A8 : NON_EXECUTE n'est atteignable que par ABSENTE sans exigence (${nonExec.length} combinaison(s))`);

  // =========================================================================
  console.log('');
  console.log('Passe B — la sonde, devant une capacité réelle et devant des pannes simulées');
  // =========================================================================
  const reelle = CAP.sonderChown({ compte: NOM, groupe: GROUPE, uidAttendu: uid });
  verifier(reelle.etat === 'PRESENTE',
    `B1 : sur cette machine (root), la sonde mesure PRESENTE (obtenu ${reelle.etat} — ${reelle.raison})`);

  const cas = [
    ['Invalid argument', 'Invalid argument', 1, 'ABSENTE'],
    ['Operation not permitted', 'Operation not permitted', 1, 'ABSENTE'],
    ['panne non classée', 'chown: disque en feu', 1, 'INDETERMINEE'],
    ['chown muet qui ne change rien', '', 0, 'INDETERMINEE'],
  ];
  for (const [nom, msg, code, attendu] of cas) {
    const bin = fauxChown(`faux-${nom.replace(/\W+/g, '-')}`, { message: msg, code });
    const s = CAP.sonderChown({ compte: NOM, groupe: GROUPE, uidAttendu: uid,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
    verifier(s.etat === attendu, `B2 [${nom}] : la sonde conclut ${attendu} (obtenu ${s.etat})`);
    if (attendu === 'ABSENTE') {
      verifier(s.raison.includes(msg), `B2 [${nom}] : la raison cite le message exact du système`);
    }
  }
  // chown introuvable : la sonde ne conclut pas « absente »
  const vide = join(dossier, 'vide');
  execFileSync('mkdir', ['-p', vide]);
  const sansChown = CAP.sonderChown({ compte: NOM, groupe: GROUPE, uidAttendu: uid, env: { PATH: vide } });
  verifier(sansChown.etat === 'INDETERMINEE', `B3 : chown introuvable → INDETERMINEE, pas ABSENTE (${sansChown.etat})`);

  // =========================================================================
  console.log('');
  console.log('Passe C — le banc des permissions lancé pour de vrai, codes de sortie lus un à un');
  // =========================================================================
  const lancer = (env) => spawnSync(process.execPath, [BANC], {
    cwd: ROOT, encoding: 'utf8', timeout: 170000, env: { ...process.env, ...env },
  });
  const sortie = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`;

  // C1 : capacité simulée ABSENTE → NON EXÉCUTÉ, code 77, aucune passe jouée
  const binAbsent = fauxChown('c1', { message: 'chown: changing ownership of x: Invalid argument', code: 1 });
  const c1 = lancer({ PATH: `${binAbsent}:${process.env.PATH}`, KJEMO_CAPACITES_REQUISES: '' });
  verifier(c1.status === CAP.CODE_NON_EXECUTE, `C1 : code de sortie 77 (obtenu ${c1.status})`);
  verifier(c1.status !== 0, 'C1 — CONTRE-ÉPREUVE : NON EXÉCUTÉ n est JAMAIS un code 0');
  verifier(/NON EXÉCUTÉ/.test(sortie(c1)), 'C1 : le banc annonce « NON EXÉCUTÉ »');
  verifier(/Invalid argument/.test(sortie(c1)), 'C1 : la raison exacte du système est donnée');
  verifier(!/Passe A|\d+ OK, \d+ ÉCHEC/.test(sortie(c1)),
    'C1 : aucune passe n a été jouée, aucun total « N OK » n est affiché (rien n est prétendu mesuré)');

  // C2 : même panne, mais l'environnement EXIGE la capacité → ÉCHEC
  const c2 = lancer({ PATH: `${binAbsent}:${process.env.PATH}`, KJEMO_CAPACITES_REQUISES: '1' });
  verifier(c2.status === 1, `C2 : capacité exigée mais absente → code 1 (obtenu ${c2.status})`);
  verifier(/EXIGEE/.test(sortie(c2)), 'C2 : le message dit que la capacité était exigée');
  verifier(!/NON EXÉCUTÉ\./.test(sortie(c2)), 'C2 : ce n est pas présenté comme NON EXÉCUTÉ');

  // C3 : capacité réelle → le banc S'EXÉCUTE, et sort 0
  const c3 = lancer({ KJEMO_CAPACITES_REQUISES: '1' });
  verifier(c3.status === 0, `C3 : capacité présente et exigée → le banc s exécute et sort 0 (obtenu ${c3.status})`);
  const m3 = /Permissions Linux : (\d+) OK, (\d+) ÉCHEC/.exec(sortie(c3));
  verifier(Boolean(m3) && Number(m3[1]) > 100 && Number(m3[2]) === 0,
    `C3 : le banc a réellement joué ses contrôles (${m3 ? m3[1] : 'aucun total'} OK)`);

  // C4 : la sonde RÉUSSIT, puis le chown délégué par l'assistant ÉCHOUE → régression
  const binRegression = fauxChown('c4', { message: 'chown: Invalid argument', code: 1 });
  const c4 = lancer({ KJEMO_CAPACITES_REQUISES: '', KJEMO_BANC_CHOWN: join(binRegression, 'chown') });
  verifier(c4.status === 1,
    `C4 — RÉGRESSION ≠ LIMITE : sonde réussie puis chown en échec → code 1 (obtenu ${c4.status})`);
  verifier(c4.status !== CAP.CODE_NON_EXECUTE && c4.status !== 0,
    'C4 : ce n est ni NON EXÉCUTÉ ni un succès');
  verifier(/Capacite de chown : chown .* accepte/.test(sortie(c4)),
    'C4 : la sonde avait bien conclu « présente » avant que le banc ne rencontre l anomalie');
  verifier(/ÉCHEC\(S\)/.test(sortie(c4)) && !/Permissions Linux : \d+ OK, 0 ÉCHEC/.test(sortie(c4)),
    'C4 : le banc rapporte des échecs au lieu de se déclarer vert');
} finally {
  rmSync(dossier, { recursive: true, force: true });
}

console.log('');
console.log(`Sonde de capacité : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('NON EXÉCUTÉ (code 77) n est jamais un succès ; capacité exigée et absente = ÉCHEC.');
console.log('Ubuntu Server réel : NON EXÉCUTÉ.');
process.exit(echecs.length === 0 ? 0 : 1);
