#!/usr/bin/env node
/**
 * cours-menu.test.mjs — alignement sur les formatifs du professeur · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Exécute les DEUX scripts à menu AFFICHÉS dans les fiches (dist/cours-scripts-menu.mjs) :
 *  - le menu « utilisateur » (modèle du formatif 2, question 5) : vrais grep et id ;
 *  - le menu du TP2 (création des comptes depuis le CSV) : contre un FAUX samba-tool.
 * Les touches sont envoyées sur l'entrée standard, comme au clavier.
 * CAS : quitter, choix invalide, vérifier un compte présent / absent, UID, fichier CSV
 * introuvable, en-tête sautée, ligne à 2 champs ignorée, mot de passe du modèle refusé,
 * groupe créé une seule fois pour deux comptes, compte existant (ÉCHEC signalé, la suite
 * continue), groupe refusé, listes, membres, aucun mot de passe affiché.
 * CONTRE-ÉPREUVES : on dégrade le script (plus de saut d'en-tête, plus de refus du modèle,
 * plus de test du fichier, erreur de création ignorée) : le banc DOIT échouer.
 * NIVEAU : le script n'emploie ni tableau associatif, ni expression régulière, ni getopts,
 * ni select (vérifié ci-dessous) : c'est le niveau des corrigés du professeur.
 * NE PROUVE PAS : le comportement du vrai samba-tool (NON EXÉCUTÉ sur un domaine).
 * Usage : node test/cours-menu.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const S = await imp('cours-scripts-menu.mjs');
const { PROCEDURES_COURS } = await imp('procedures-cours.mjs');

const FAUX = `#!/bin/bash
D="$FAKE_DIR"
echo "$*" >> "$D/calls.log"
case "$1 $2" in
  "user list") cat "$D/users"; exit 0 ;;
  "group list") cat "$D/groups"; exit 0 ;;
  "group add")
    if grep -qxF "$3" "$D/groups"; then echo "ERROR: groupe existe" >&2; exit 1; fi
    if grep -qxF "group add $3" <<< "$FAKE_FAIL"; then echo "ERROR: groupe refuse" >&2; exit 1; fi
    echo "$3" >> "$D/groups"; : > "$D/m_$3"; exit 0 ;;
  "user create")
    if grep -qxF "$3" "$D/users"; then echo "ERROR: compte existe (mot de passe $4)" >&2; exit 1; fi
    if grep -qxF "user create $3" <<< "$FAKE_FAIL"; then echo "ERROR: complexite $4" >&2; exit 1; fi
    echo "$3" >> "$D/users"; echo "User '$3' created successfully"; exit 0 ;;
  "group addmembers")
    if grep -qxF "group addmembers $4" <<< "$FAKE_FAIL"; then echo "ERROR: membre refuse" >&2; exit 1; fi
    echo "$4" >> "$D/m_$3"; exit 0 ;;
  "group listmembers") cat "$D/m_$3" 2>/dev/null; exit 0 ;;
esac
echo "commande inconnue : $*" >&2; exit 9
`;
const CSV = ['login;motdepasse;departement', 'chef_vm;Zq7!lab-Alpha1;Ventes', 'emp_vm;Zq7!lab-Bravo2;Ventes', 'chef_fin;Zq7!lab-Charlie3;Finance'].join('\n') + '\n';
const nettoie = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

function banc(scriptSamba) {
  let ok = 0; const ko = [];
  const t = (c, l, d = '') => { if (c) ok++; else ko.push(`${l}${d ? ' — ' + d : ''}`); };
  const racine = mkdtempSync(join(tmpdir(), 'kjemo-menu-'));
  const bin = join(racine, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'samba-tool'), FAUX); chmodSync(join(bin, 'samba-tool'), 0o755);
  writeFileSync(join(racine, 'menu.sh'), scriptSamba); chmodSync(join(racine, 'menu.sh'), 0o755);
  let n = 0;
  const lancer = (touches, { csv = null, users = '', groupes = '', fail = '' } = {}) => {
    const dir = join(racine, 'run' + (++n)); mkdirSync(dir);
    writeFileSync(join(dir, 'users'), 'Administrator\nGuest\n' + users);
    writeFileSync(join(dir, 'groups'), 'Domain Admins\n' + groupes);
    if (csv !== null) writeFileSync(join(dir, 'c.csv'), csv);
    const r = spawnSync('bash', [join(racine, 'menu.sh')], { cwd: dir, input: touches, encoding: 'utf8', timeout: 20000,
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, TERM: 'xterm', FAKE_DIR: dir, FAKE_FAIL: fail, LC_ALL: 'C.UTF-8' } });
    const lire = (f) => { try { return readFileSync(join(dir, f), 'utf8'); } catch { return ''; } };
    return { sortie: nettoie(r.stdout + r.stderr), code: r.status, users: lire('users'), groups: lire('groups'), calls: lire('calls.log'), membres: (g) => lire('m_' + g) };
  };
  // quitter / choix invalide
  let r = lancer('5\n');
  t(r.code === 0 && r.sortie.includes('Au revoir'), 'quitter : code 0 et « Au revoir »');
  r = lancer('9\n\n5\n');
  t(r.sortie.includes('Choix invalide') && r.code === 0, 'choix invalide : message puis le menu revient');
  r = lancer('2\n\n3\n\n5\n', { users: 'alice\n', groupes: 'Ventes\n' });
  t(/alice/.test(r.sortie) && /Ventes/.test(r.sortie), 'listes : comptes et groupes affichés');
  r = lancer('4\nVentes\n\n5\n');
  t(r.calls.includes('group listmembers Ventes'), 'membres : listmembers appelé avec le groupe saisi');
  // import
  r = lancer('1\nc.csv\n\n5\n', { csv: CSV });
  t(r.code === 0, 'import : code 0');
  t(['chef_vm', 'emp_vm', 'chef_fin'].every((u) => r.users.includes(u)), 'import : les trois comptes créés');
  t(!/^login$/m.test(r.users), 'import : la ligne d’en-tête n’est pas traitée comme un compte');
  t(r.membres('Ventes').split('\n').filter(Boolean).join(',') === 'chef_vm,emp_vm' && r.membres('Finance').trim() === 'chef_fin', 'import : chaque compte dans le groupe de son département');
  t((r.calls.match(/group add Ventes/g) ?? []).length === 2 && r.groups.split('\n').filter((g) => g === 'Ventes').length === 1, 'import : groupe créé une seule fois, la 2e tentative est silencieuse');
  t(!/Zq7/.test(r.sortie), 'import : aucun mot de passe dans la sortie');
  // fichier absent
  r = lancer('1\nrien.csv\n\n5\n');
  t(r.sortie.includes('Fichier introuvable : rien.csv') && !r.calls.includes('user create'), 'fichier introuvable : message, aucune création');
  // lignes particulières
  r = lancer('1\nc.csv\n\n5\n', { csv: 'seul;deux\nok_user;Zq7!lab-X;Finance\n' });
  t(r.sortie.includes('Ligne ignorée') && r.users.includes('ok_user') && !r.users.includes('seul'), 'ligne à 2 champs ignorée, la suivante traitée');
  r = lancer('1\nc.csv\n\n5\n', { csv: 'a1;FICTIF-0001;Finance\nb1;Zq7!lab-Y;Finance\n' });
  t(r.sortie.includes('mot de passe du modèle') && !r.users.includes('a1') && r.users.includes('b1'), 'mot de passe FICTIF-… refusé, la suite continue');
  r = lancer('1\nc.csv\n\n5\n', { csv: CSV, users: 'emp_vm\n' });
  t(r.sortie.includes('ÉCHEC : emp_vm') && r.users.includes('chef_fin') && !/Bravo2/.test(r.sortie), 'compte déjà existant : ÉCHEC signalé, la suite continue, mot de passe masqué');
  r = lancer('1\nc.csv\n\n5\n', { csv: CSV, fail: 'user create chef_fin' });
  t(r.sortie.includes('ÉCHEC : chef_fin') && !r.membres('Finance').includes('chef_fin') && !/Charlie3/.test(r.sortie), 'création refusée : pas d’ajout au groupe, mot de passe masqué');
  r = lancer('1\nc.csv\n\n5\n', { csv: CSV, fail: 'group addmembers chef_vm' });
  t(r.sortie.includes('n\'a pas pu être ajouté au groupe Ventes'), 'ajout au groupe refusé : signalé');
  // CRLF : limite connue, dite (le mot de passe garderait un \r) — le CSV doit venir de nano sur la VM
  return { ok, ko };
}

let passed = 0; let failed = 0;
const rapport = (nom, { ok, ko }) => { passed += ok; failed += ko.length; for (const k of ko) console.error(`ÉCHEC [${nom}] : ${k}`); };
rapport('script du TP2 (menu comptes Samba)', banc(S.SCRIPT_MENU_COMPTES_SAMBA));

// menu utilisateur : vrais grep et id
{
  const dir = mkdtempSync(join(tmpdir(), 'kjemo-menu-u-'));
  writeFileSync(join(dir, 'm.sh'), S.SCRIPT_MENU_UTILISATEURS);
  const r = spawnSync('bash', [join(dir, 'm.sh')], { cwd: dir, input: '1\nroot\n\n1\nzzqqxx\n\n2\nroot\n\n7\n\n3\n', encoding: 'utf8', timeout: 20000, env: { PATH: process.env.PATH, TERM: 'xterm', HOME: dir, LC_ALL: 'C.UTF-8' } });
  const s = nettoie(r.stdout + r.stderr);
  const ko = [];
  if (r.status !== 0) ko.push(`code ${r.status}`);
  if (!s.includes('L\'utilisateur root existe')) ko.push('compte présent non reconnu');
  if (!s.includes('L\'utilisateur zzqqxx n\'existe pas')) ko.push('compte absent non signalé');
  if (!/uid=0\(root\)/.test(s)) ko.push('id root non affiché');
  if (!s.includes('Choix invalide') || !s.includes('Au revoir')) ko.push('choix invalide / sortie');
  rapport('menu utilisateur', { ok: 5 - ko.length, ko });
}

// niveau du cours : constructions interdites (au-delà de ce que montrent les corrigés)
for (const [nom, texte] of [['menu TP2', S.SCRIPT_MENU_COMPTES_SAMBA], ['menu utilisateur', S.SCRIPT_MENU_UTILISATEURS]]) {
  const interdits = [[/declare -A/, 'tableau associatif'], [/=~/, 'expression régulière'], [/getopts/, 'getopts'], [/\bselect\b/, 'select'], [/\$\{[^}]*,,\}/, 'minuscules ${x,,}'], [/<<</, 'here-string'], [/\[\[/, '[[ ]]']];
  const trouves = interdits.filter(([re]) => re.test(texte)).map(([, l]) => l);
  if (trouves.length) { failed++; console.error(`ÉCHEC [${nom}] : constructions hors niveau du cours : ${trouves.join(', ')}`); } else passed++;
}

// le texte affiché dans les fiches est le texte testé
{
  const lignesFiche = (id) => PROCEDURES_COURS.find((p) => p.id === id)?.methodes.flatMap((m) => m.etapes.flatMap((e) => (e.lignes ?? []).map((l) => l.cmd))) ?? [];
  const contient = (lignes, script) => { const a = lignes.join('\n'); return a.includes(script.join('\n')); };
  for (const [id, script] of [['cours-samba-script-menu', S.SCRIPT_MENU_COMPTES_SAMBA_LIGNES], ['cours-bash-menu', S.SCRIPT_MENU_UTILISATEURS_LIGNES]]) {
    if (contient(lignesFiche(id), script)) passed++; else { failed++; console.error(`ÉCHEC : la fiche ${id} n'affiche pas exactement le script testé`); }
  }
}

// contre-épreuves : chaque dégradation DOIT être vue
const muter = (avant, apres) => { const m = S.SCRIPT_MENU_COMPTES_SAMBA.replace(avant, apres); if (m === S.SCRIPT_MENU_COMPTES_SAMBA) throw new Error(`mutation sans effet : ${avant}`); return m; };
const MUTATIONS = [
  ['en-tête non sautée', muter('if [ "$login" = "login" ]; then', 'if [ "$login" = "zzz" ]; then')],
  ['mot de passe FICTIF accepté', muter('FICTIF-*)', 'ZZZZ-*)')],
  ['fichier absent non testé', muter('if [ ! -f "$csv" ]; then', 'if false; then')],
  ['échec de création ignoré', muter('      continue\n    fi\n    if samba-tool group addmembers', '      echo "Compte créé : $login"\n    fi\n    if samba-tool group addmembers')],
  ['mot de passe affiché', muter('samba-tool user create "$login" "$mdp" > /dev/null 2>&1', 'samba-tool user create "$login" "$mdp"')],
  ['département non validé', muter('if [ -z "$dept" ]; then', 'if false; then')],
];
for (const [nom, script] of MUTATIONS) {
  const { ko } = banc(script);
  if (ko.length > 0) passed++; else { failed++; console.error(`ÉCHEC : la contre-épreuve « ${nom} » n'a pas été vue par le banc`); }
}

console.log(`cours-menu : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
