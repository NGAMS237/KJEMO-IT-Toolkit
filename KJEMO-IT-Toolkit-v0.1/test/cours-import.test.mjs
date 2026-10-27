#!/usr/bin/env node
/**
 * cours-import.test.mjs — KJEMO-COURS-TP2-01-R1 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Exécute le script d'import CSV AFFICHÉ DANS LA FICHE (dist/cours-script-import.mjs)
 * contre un FAUX samba-tool (double de test) et vérifie les appels réellement faits.
 * Aucun domaine réel, aucun compte réel : tout vit dans un dossier temporaire.
 *
 * CAS : CSV conforme (3 colonnes « ; »), CRLF, BOM, sans en-tête, sans retour
 * final, lignes invalides, doublons, compte existant, groupe existant, échec de
 * création de compte / de groupe / d'appartenance, échec de lecture, mot de passe
 * du modèle, droits trop larges, mode essai (aucune écriture), aucun mot de passe
 * dans les sorties, codes de sortie.
 * CONTRE-ÉPREUVES : on dégrade le script (plus de redirection stdin, essai qui
 * écrit, doublon accepté, sortie non masquée, code de sortie toujours 0) : le
 * banc DOIT alors échouer.
 *
 * NE PROUVE PAS : le comportement du vrai samba-tool (NON EXÉCUTÉ sur un domaine).
 * Usage : node test/cours-import.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { SCRIPT_IMPORT } = await import(pathToFileURL(resolve(ROOT, 'dist', 'cours-script-import.mjs')).href);

const L = await import(pathToFileURL(resolve(ROOT, 'dist', 'labo.mjs')).href);

const FAUX = `#!/bin/bash
D="$FAKE_DIR"
echo "$*" >> "$D/calls.log"
cat > /dev/null
case "$1 $2" in
  "user list") [ -n "$FAKE_LIST_KO" ] && exit 1; cat "$D/users"; exit 0 ;;
  "group list") cat "$D/groups"; exit 0 ;;
  "group add")
    if grep -qxF "group add $3" <<< "$FAKE_FAIL"; then echo "ERROR: groupe refuse" >&2; exit 1; fi
    echo "$3" >> "$D/groups"; : > "$D/m_$3"; echo "Added group $3"; exit 0 ;;
  "user create")
    if grep -qxF "user create $3" <<< "$FAKE_FAIL"; then echo "ERROR(ldb): Failed to add user '$3' with password '$4' : complexite" >&2; exit 1; fi
    echo "$3" >> "$D/users"; echo "User '$3' created successfully"; exit 0 ;;
  "group addmembers")
    if grep -qxF "group addmembers $4" <<< "$FAKE_FAIL"; then echo "ERROR: membre refuse" >&2; exit 1; fi
    echo "$4" >> "$D/m_$3"; echo "Added members to group $3"; exit 0 ;;
  "group listmembers") cat "$D/m_$3" 2>/dev/null; exit 0 ;;
esac
echo "commande inconnue : $*" >&2; exit 9
`;

const MODELE = [
  'login;motdepasse;departement',
  'chef_vm;FICTIF-AAAA-0001;Ventes_Marketing',
  'emp_vm;FICTIF-AAAA-0002;Ventes_Marketing',
  'chef_fin;FICTIF-AAAA-0003;Finance',
  'chef_ti;FICTIF-AAAA-0004;Technologies_Information',
].join('\n') + '\n';
const REEL = [
  'login;motdepasse;departement',
  'chef_vm;Zq7!lab-Alpha1;Ventes_Marketing',
  'emp_vm;Zq7!lab-Bravo2;Ventes_Marketing',
  'chef_fin;Zq7!lab-Charlie3;Finance',
  'chef_ti;Zq7!lab-Delta4;Technologies_Information',
].join('\n') + '\n';

function banc(script) {
  let ok = 0; const ko = [];
  const t = (c, l, d = '') => { if (c) ok++; else ko.push(`${l}${d ? ' — ' + d : ''}`); };
  const racine = mkdtempSync(join(tmpdir(), 'kjemo-imp-'));
  const bin = join(racine, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'samba-tool'), FAUX); chmodSync(bin + '/samba-tool', 0o755);
  writeFileSync(join(racine, 'import.sh'), script); chmodSync(join(racine, 'import.sh'), 0o755);
  let n = 0;
  const lancer = (csv, { args = [], env = {}, mode = 0o600, users = '', groupes = '', membres = {}, nomCsv = 'c.csv' } = {}) => {
    const dir = join(racine, 'run' + (++n)); mkdirSync(dir);
    writeFileSync(join(dir, 'users'), 'Administrator\nGuest\nkrbtgt\n' + users);
    writeFileSync(join(dir, 'groups'), 'Domain Admins\nDomain Users\n' + groupes);
    for (const [g, m] of Object.entries(membres)) writeFileSync(join(dir, 'm_' + g), m);
    if (csv !== null) { writeFileSync(join(dir, nomCsv), csv); chmodSync(join(dir, nomCsv), mode); }
    const r = spawnSync('bash', [join(racine, 'import.sh'), ...args, join(dir, nomCsv)], {
      cwd: dir, encoding: 'utf8', timeout: 20000,
      env: { PATH: `${bin}:${process.env.PATH}`, FAKE_DIR: dir, ...env, LC_ALL: 'C.UTF-8' },
    });
    const lire = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '');
    return { r, sortie: (r.stdout || '') + (r.stderr || ''), code: r.status,
      appels: lire('calls.log').split('\n').filter(Boolean), users: lire('users').split('\n'), groupes: lire('groups').split('\n'),
      membres: (g) => lire('m_' + g).split('\n').filter(Boolean) };
  };
  const ecritures = (a) => a.appels.filter((x) => /^(group add|user create|group addmembers) /.test(x));
  const pwds = ['FICTIF-AAAA-0001', 'FICTIF-AAAA-0002', 'FICTIF-AAAA-0003', 'FICTIF-AAAA-0004', 'Zq7!lab-Alpha1', 'Zq7!lab-Bravo2', 'Zq7!lab-Charlie3', 'Zq7!lab-Delta4', 'secretKO1'];
  const sansSecret = (a, l) => t(!pwds.some((p) => a.sortie.includes(p)), `aucun mot de passe dans la sortie : ${l}`);

  // 0. Le modèle FICTIF que l'application fournit (téléchargement) passe l'essai sans rien écrire
  {
    const modele = L.csvDepuisLignes(L.LIGNES_CSV_MODELE);
    const e = lancer(modele, { args: ['-n'] });
    t(e.code === 0, 'modèle de l’application : l’essai (-n) réussit', `code ${e.code} ${e.sortie}`);
    t(ecritures(e).length === 0, 'modèle de l’application : l’essai ne modifie rien');
    const crlf = lancer(modele.replace(/\n/g, '\r\n'), { args: ['-n'] });
    t(crlf.code === 0, 'modèle de l’application avec fins de ligne Windows : accepté', `code ${crlf.code} ${crlf.sortie}`);
  }

  // 1. Nominal
  let a = lancer(REEL);
  t(a.code === 0, 'nominal : sortie 0', `code ${a.code} ${a.sortie}`);
  t(['chef_vm', 'emp_vm', 'chef_fin', 'chef_ti'].every((u) => a.users.includes(u)), 'nominal : 4 comptes créés');
  t(a.membres('Ventes_Marketing').join() === 'chef_vm,emp_vm', 'nominal : membres de Ventes_Marketing', a.membres('Ventes_Marketing').join());
  t(a.membres('Finance').join() === 'chef_fin' && a.membres('Technologies_Information').join() === 'chef_ti', 'nominal : autres départements');
  t(a.groupes.filter((g) => g === 'Ventes_Marketing').length === 1, 'nominal : le groupe partagé n’est créé qu’une fois');
  t(ecritures(a).filter((x) => /^group add \S+$/.test(x)).length === 3, 'nominal : 3 créations de groupe');
  t(/4 comptes créés, 3 groupes créés, 0 déjà existants, 0 rejetées, 0 échecs/.test(a.sortie), 'nominal : résumé exact', a.sortie);
  t(a.appels.some((x) => x === 'user create chef_vm Zq7!lab-Alpha1'), 'nominal : le mot de passe de la colonne 2 est transmis à samba-tool');
  sansSecret(a, 'nominal');

  // 2. Essai : aucune écriture
  a = lancer(REEL, { args: ['-n'] });
  t(a.code === 0, 'essai : sortie 0', a.sortie);
  t(ecritures(a).length === 0, 'essai : AUCUN appel d’écriture samba-tool', ecritures(a).join(' | '));
  t(a.users.join() === 'Administrator,Guest,krbtgt,' && !a.groupes.includes('Finance'), 'essai : rien n’a changé');
  t(/ESSAI terminé : rien n'a été modifié/.test(a.sortie) && /4 comptes à créer, 3 groupes à créer/.test(a.sortie), 'essai : message et résumé', a.sortie);
  sansSecret(a, 'essai');

  // 3. CRLF + BOM + sans retour final + lignes vides
  const crlf = '﻿' + REEL.replace(/\n/g, '\r\n').replace(/\r\n$/, '') .replace('chef_fin;', '\r\n\r\nchef_fin;');
  a = lancer(crlf);
  t(a.code === 0 && a.users.includes('chef_ti') && a.users.includes('chef_vm'), 'CRLF + BOM + ligne vide + sans retour final', a.sortie);
  t(!a.users.some((u) => u.includes('\r')), 'CRLF : aucun \\r dans les logins');
  t(a.membres('Technologies_Information').join() === 'chef_ti', 'CRLF : dernier département correct');

  // 4. Sans en-tête
  a = lancer(REEL.split('\n').slice(1).join('\n'));
  t(a.code === 0 && a.users.includes('chef_vm'), 'sans en-tête accepté', a.sortie);

  // 5. Lignes invalides
  const mauvais = ['login;motdepasse;departement', 'ok_un;Zq7!lab-Alpha1;Ventes_Marketing', 'deux;seulement', 'quatre;a;b;c', '"guil";"x";"y"',
    'videmdp;;Finance', 'Majus;Zq7!lab-Bravo2;Finance', 'okdeux;Zq7!lab-Charlie3;Ventes Marketing', 'accent;Zq7!lab-Delta4;Départ', 'ok_trois;Zq7!lab-Alpha1;Finance'].join('\n') + '\n';
  a = lancer(mauvais);
  t(a.code === 2, 'invalides : sortie 2', `code ${a.code}`);
  t(a.users.includes('ok_un') && a.users.includes('ok_trois'), 'invalides : les lignes valides sont quand même traitées');
  t(!['deux', 'quatre', 'guil', 'videmdp', 'Majus', 'okdeux', 'accent'].some((u) => a.users.includes(u)), 'invalides : aucun compte issu d’une ligne invalide');
  t((a.sortie.match(/ligne \d+ rejetée/g) || []).length === 7, 'invalides : 7 lignes rejetées avec leur numéro', a.sortie);
  t(/guillemets non pris en charge/.test(a.sortie), 'CSV entre guillemets : refus explicite');
  sansSecret(a, 'invalides');

  // 6. Doublons
  a = lancer('login;motdepasse;departement\ndup;Zq7!lab-Alpha1;Finance\ndup;Zq7!lab-Bravo2;Ventes_Marketing\n');
  t(a.code === 2 && /login en double : dup/.test(a.sortie), 'doublon : rejeté, sortie 2', a.sortie);
  t(a.appels.filter((x) => x.startsWith('user create dup')).length === 1 && a.appels.includes('user create dup Zq7!lab-Alpha1'), 'doublon : créé une seule fois avec la première ligne');
  t(!a.groupes.includes('Ventes_Marketing'), 'doublon : le groupe de la 2e ligne n’est pas créé');

  // 7. Compte existant : jamais modifié
  a = lancer(REEL, { users: 'chef_vm\n', groupes: 'Ventes_Marketing\n', membres: { Ventes_Marketing: '' } });
  t(a.code === 0, 'existant : sortie 0', a.sortie);
  t(!a.appels.some((x) => x.startsWith('user create chef_vm')), 'existant : pas de user create');
  t(!a.appels.some((x) => /^group addmembers \S+ chef_vm/.test(x)), 'existant : pas d’ajout de groupe');
  t(!a.appels.some((x) => x.startsWith('group add Ventes_Marketing')), 'groupe existant : pas de group add');
  t(/existe déjà : chef_vm ignoré/.test(a.sortie) && /1 déjà existants/.test(a.sortie), 'existant : signalé et compté', a.sortie);
  t(a.membres('Ventes_Marketing').join() === 'emp_vm', 'existant : seuls les nouveaux comptes sont ajoutés');
  a = lancer(REEL, { users: 'CHEF_VM\n' });
  t(!a.appels.some((x) => x.startsWith('user create chef_vm')), 'existant : comparaison insensible à la casse');

  // 8. Échec de création de compte
  a = lancer(REEL, { env: { FAKE_FAIL: 'user create emp_vm' } });
  t(a.code === 2, 'échec compte : sortie 2');
  t(!a.users.includes('emp_vm') && !a.membres('Ventes_Marketing').includes('emp_vm'), 'échec compte : compte absent, jamais ajouté au groupe');
  t(!a.appels.some((x) => x.startsWith('group addmembers Ventes_Marketing emp_vm')), 'échec compte : pas d’addmembers pour lui');
  t(a.users.includes('chef_fin') && a.users.includes('chef_ti'), 'échec compte : les lignes suivantes continuent');
  t(/ÉCHEC : création du compte emp_vm/.test(a.sortie) && /1 échecs/.test(a.sortie), 'échec compte : signalé et compté', a.sortie);
  t(a.sortie.includes('***') , 'échec compte : le mot de passe est masqué (***)');
  sansSecret(a, 'échec compte');

  // 9. Échec de groupe
  a = lancer(REEL, { env: { FAKE_FAIL: 'group add Ventes_Marketing' } });
  t(a.code === 2 && !a.users.includes('chef_vm') && !a.users.includes('emp_vm'), 'échec groupe : aucun compte du département n’est créé');
  t(a.users.includes('chef_fin') && a.users.includes('chef_ti'), 'échec groupe : les autres départements continuent');
  t(a.appels.filter((x) => x === 'group add Ventes_Marketing').length === 1, 'échec groupe : une seule tentative');

  // 10. Échec d'appartenance
  a = lancer(REEL, { env: { FAKE_FAIL: 'group addmembers chef_fin' } });
  t(a.code === 2 && /compte chef_fin créé mais NON ajouté au groupe Finance/.test(a.sortie), 'échec appartenance : signalé', a.sortie);
  t(/dont 1 comptes créés sans groupe/.test(a.sortie), 'échec appartenance : résumé fiable');
  t(!/4 comptes créés/.test(a.sortie), 'échec appartenance : le compte n’est pas compté comme réussi');

  // 11. Lecture impossible
  a = lancer(REEL, { env: { FAKE_LIST_KO: '1' } });
  t(a.code === 1 && ecritures(a).length === 0, 'user list en échec : sortie 1, aucune écriture', a.sortie);

  // 12. Mot de passe du modèle
  a = lancer(MODELE);
  t(a.code === 2 && ecritures(a).length === 0, 'modèle fictif : refusé à l’application, aucune écriture', a.sortie);
  t(/mot de passe du modèle fictif/.test(a.sortie), 'modèle fictif : message clair');
  a = lancer(MODELE, { args: ['-n'] });
  t(a.code === 0 && ecritures(a).length === 0 && /modèle fictif/.test(a.sortie), 'modèle fictif : l’essai reste possible et le signale', a.sortie);
  sansSecret(a, 'modèle');

  // 13. Droits du fichier
  a = lancer(REEL, { mode: 0o644 });
  t(a.code === 1 && a.appels.filter((x) => !/ list$/.test(x)).length === 0, 'droits 644 : refusé à l’application, aucune écriture', a.sortie);
  a = lancer(REEL, { mode: 0o644, args: ['-n'] });
  t(a.code === 0 && /chmod 600/.test(a.sortie), 'droits 644 : avertissement en essai', a.sortie);

  // 14. Entrées anormales
  a = lancer('login;motdepasse;departement\n');
  t(a.code === 1, 'en-tête seul : sortie 1');
  a = lancer(null);
  t(a.code === 1, 'fichier absent : sortie 1');
  a = lancer(REEL, { args: ['-x'] });
  t(a.code === 1 && ecritures(a).length === 0, 'option inconnue : sortie 1');

  // 15. Mot de passe contenant des caractères spéciaux
  a = lancer('login;motdepasse;departement\nspec;a$b`c\\d e*f;Finance\n');
  t(a.code === 0 && a.appels.includes('user create spec a$b`c\\d e*f'), 'mot de passe spécial transmis tel quel', a.appels.join('|'));

  rmSync(racine, { recursive: true, force: true });
  return { ok, ko };
}

console.log('1. Banc complet sur le script de la fiche');
const base = banc(SCRIPT_IMPORT);
let passed = base.ok; let failed = base.ko.length;
for (const l of base.ko) console.error(`  [FAIL]  ${l}`);

console.log('2. Contre-épreuves : un script dégradé DOIT être détecté');
const assert = (c, l) => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}`); } };
const mut = (nom, de, vers) => {
  assert(SCRIPT_IMPORT.includes(de), `mutation applicable : ${nom}`);
  const r = banc(SCRIPT_IMPORT.replace(de, vers));
  assert(r.ko.length > 0, `le banc détecte : ${nom} (${r.ko.length} échec[s])`);
};
mut('samba-tool lit le CSV (plus de </dev/null sur user create)', 'samba-tool user create "$login" "$mdp" </dev/null 2>&1', 'samba-tool user create "$login" "$mdp" 2>&1');
mut('l’essai écrit quand même', '    crees=$((crees + 1))\n    continue\n  fi\n  sortie=$(samba-tool user create', '    crees=$((crees + 1))\n  fi\n  sortie=$(samba-tool user create');
mut('doublon accepté', 'if [ -n "${vus[${login,,}]:-}" ]; then', 'if false; then');
mut('mot de passe non masqué', 'masquer() { printf \'%s\' "${1//"$mdp"/***}"; }', 'masquer() { printf \'%s\' "$1"; }');
mut('sortie toujours 0 malgré les échecs', 'if [ $((rejetees + echecs)) -gt 0 ]; then exit 2; fi', 'true');
mut('compte existant écrasé', 'if grep -qixF -- "$login" <<< "$comptes"; then', 'if false; then');
mut('échec de création ignoré', 'if [ "$rc" -ne 0 ]; then echec "création du compte', 'if false; then echec "création du compte');
mut('modèle fictif accepté', 'if [ "$modele" -eq 1 ] && [ "$essai" -eq 0 ]; then rejeter', 'if false; then rejeter');
mut('droits du CSV ignorés', 'if [ "$essai" -eq 0 ]; then\n    echo "erreur : $fichier est lisible', 'if false; then\n    echo "erreur : $fichier est lisible');

console.log(`\n${passed} OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
