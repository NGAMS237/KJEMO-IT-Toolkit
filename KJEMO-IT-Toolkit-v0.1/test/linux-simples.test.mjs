#!/usr/bin/env node
/**
 * linux-simples.test.mjs — KJEMO-LINUX-SIMPLES-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Les 5 fiches de traitement de texte (sed, CSV, fins de ligne) + 5 fiches comptes/groupes/mots de passe (locaux et Samba). Contrat, rendu, valeurs piégées
 * refusées, rangement/recherche, ET exécution RÉELLE des commandes rendues dans un dossier temporaire
 * (bash, sed, awk, cut, diff, file) sur de vrais fichiers : l'effet est constaté, pas supposé.
 * NE PROUVE PAS : le comportement sur une autre version de sed/awk (testé avec celles de la machine).
 * Usage : node test/linux-simples.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const M = await imp('memo.mjs'); const C = await imp('classement.mjs');
const { PROCEDURES_LINUX_SIMPLES: L5, PROCEDURES_LINUX_COMPTES: LC, PROCEDURES_LINUX_CLAVIER: LK } = await imp('procedures-linux-simples.mjs');
const { PROCEDURES_WINDOWS_LANGUE: WL } = await imp('procedures-windows-langue.mjs');
const L = [...L5, ...LC, ...LK, ...WL];
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const fiche = (id) => L.find((p) => p.id === id);

console.log('1. Contrat');
assert(L5.length === 5 && LC.length === 5 && LK.length === 4 && WL.length === 4 && L.length === 18, '5 fiches de texte + 5 de comptes + 4 clavier Linux + 4 clavier Windows');
for (const p of L) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' | '));
  const e = T.entreeParId(p.id);
  assert(e?.kind === 'procedure' && e.plateformes.length === 1 && e.plateformes[0] === (WL.includes(p) ? 'Windows' : 'Linux'), `${p.id} : une seule plateforme, la bonne`);
  assert(M.toutesLesFichesMemo().filter((x) => x === p.id).length === 1, `${p.id} : rangée UNE fois dans l’aide-mémoire`);
  assert(Boolean(C.cheminDe(e)?.famille), `${p.id} : classée dans le catalogue`);
  assert(Object.keys(M.AJOUTS).includes(p.id), `${p.id} : badge « nouveau »`);
  assert(p.sources.every((s) => s.url.startsWith('https://')), `${p.id} : sources HTTPS`);
  if (p.effet !== 'lecture') assert(Boolean(p.methodes[0].retour), `${p.id} : retour arrière`);
}
{
  const toutes = T.TOUTES_LES_ENTREES.filter((e) => e.procedure);
  const ids = new Set(L.map((p) => p.id));
  const cles = L.flatMap((p) => p.intentions.map((i) => i.toLowerCase()));
  const autres = toutes.filter((e) => !ids.has(e.id)).flatMap((e) => e.procedure.intentions.map((i) => i.toLowerCase()));
  assert(new Set(cles).size === cles.length && cles.every((c) => !autres.includes(c)), 'aucune intention en double dans le catalogue');
}

console.log('2. Valeurs piégées REFUSÉES');
const v = (id, pid, val) => P.validerParametre(fiche(id).params.find((q) => q.id === pid), val);
assert(!v('linux-sed-remplacer', 'ancien', 'a/b/;rm -rf').ok && !v('linux-sed-remplacer', 'nouveau', 'x y').ok, 'sed : barre oblique, point-virgule et espace refusés');
assert(!v('linux-sed-remplacer', 'fichier', 'c.csv; rm x').ok && !v('linux-sed-remplacer', 'fichier', '-i').ok, 'fichier : injection et option refusées');
assert(!v('linux-csv-verifier', 'sep', ';x').ok && !v('linux-csv-verifier', 'sep', ' ').ok && v('linux-csv-verifier', 'sep', ';').ok, 'séparateur : seulement ; , : |');
assert(!v('linux-csv-verifier', 'ncol', '0').ok && !v('linux-csv-verifier', 'ncol', '3; ls').ok, 'colonnes : 0 et injection refusés');
assert(!v('linux-sed-lignes', 'debut', '1p;d').ok, 'ligne : injection refusée');

console.log('3. Exécution réelle des commandes rendues');
function lancer(id, valeurs, fichiers, { etapes = null } = {}) {
  const p = fiche(id); const dir = mkdtempSync(join(tmpdir(), 'kjemo-ls-'));
  for (const [n, c] of Object.entries(fichiers)) writeFileSync(join(dir, n), c);
  const r = P.rendreMethode(p.methodes[0], p.params, valeurs);
  const sorties = r.etapes.map((e, i) => {
    if (etapes && !etapes.includes(i)) return null;
    const res = spawnSync('bash', ['-c', e.rendu.texteCopie], { cwd: dir, encoding: 'utf8' });
    return { out: res.stdout, err: res.stderr, code: res.status };
  });
  return { dir, sorties, lire: (n) => (existsSync(join(dir, n)) ? readFileSync(join(dir, n), 'utf8') : null) };
}
const CSV = 'login;motdepasse;departement\nchef_ventes;MDP0001;Ventes\nvendeur1;MDP0001;Ventes\nchef_fin;MDP0001;Finance\n';
{
  const r = lancer('linux-sed-remplacer', { fichier: 'c.csv', ancien: 'MDP0001', nouveau: 'Mdp0001x' }, { 'c.csv': CSV });
  assert(r.sorties[0].out.includes('> chef_ventes;Mdp0001x;Ventes') && r.lire('c.csv') !== null, 'sed : l’aperçu montre les lignes changées');
  assert(!r.lire('c.csv').includes('MDP0001') && (r.lire('c.csv').match(/Mdp0001x/g) ?? []).length === 3, 'sed : les 3 occurrences remplacées dans le fichier');
  assert(r.lire('c.csv.bak') === CSV, 'sed : la copie .bak est l’original exact');
  assert(r.sorties[2].out.includes('<') && r.sorties[2].code === 1, 'sed : diff .bak/fichier montre les différences');
}
{
  const r = lancer('linux-sed-remplacer', { fichier: 'c.csv', ancien: 'ZZZ', nouveau: 'y' }, { 'c.csv': CSV }, { etapes: [0] });
  assert(r.sorties[0].out.trim() === '', 'sed : texte absent → aperçu vide');
}
{
  const r = lancer('linux-sed-lignes', { fichier: 'c.csv', debut: '2', fin: '3', motif: 'Finance' }, { 'c.csv': CSV });
  assert(r.sorties[0].out === 'chef_ventes;MDP0001;Ventes\nvendeur1;MDP0001;Ventes\n', 'lignes : plage 2 à 3');
  assert(r.sorties[1].out.trim() === 'chef_fin;MDP0001;Finance', 'lignes : seules les lignes qui contiennent le mot');
  assert(!r.lire('c.csv').includes('Finance') && r.lire('c.csv.bak') === CSV, 'lignes : suppression + original gardé en .bak');
  assert(/4 .*c\.csv\.bak/.test(r.sorties[3].out) && /3 .*c\.csv\n/.test(r.sorties[3].out), 'lignes : wc montre 4 lignes avant, 3 après');
}
{
  const r = lancer('linux-csv-verifier', { fichier: 'c.csv', sep: ';', ncol: '3' }, { 'c.csv': CSV });
  assert(r.sorties[0].out.includes('chef_ventes;MDP0001;Ventes$'), 'csv : cat -A montre la fin de ligne $');
  assert(/\b4 3\b/.test(r.sorties[1].out), 'csv : 4 lignes de 3 colonnes');
  assert(r.sorties[2].out.trim() === '', 'csv correct : aucune ligne fautive');
  const mauvais = lancer('linux-csv-verifier', { fichier: 'c.csv', sep: ';', ncol: '3' }, { 'c.csv': 'login;mdp;dept\nseul;deux\nbon;Mdp1!;V\n' });
  assert(mauvais.sorties[2].out.trim() === '2: seul;deux', 'csv fautif : la ligne 2 est désignée');
  const virgules = lancer('linux-csv-verifier', { fichier: 'c.csv', sep: ';', ncol: '3' }, { 'c.csv': 'a,b,c\nd,e,f\n' });
  assert(/\b2 1\b/.test(virgules.sorties[1].out), 'csv à virgules lu avec « ; » : 1 seule colonne détectée (c’est le symptôme du TP2)');
  const crlf = lancer('linux-csv-verifier', { fichier: 'c.csv', sep: ';', ncol: '3' }, { 'c.csv': 'a;b;c\r\nd;e;f\r\n' });
  assert(crlf.sorties[0].out.includes('^M$'), 'csv Windows : ^M visible');
}
{
  const r = lancer('linux-csv-colonne', { fichier: 'c.csv', sep: ';', colonne: '3' }, { 'c.csv': CSV });
  assert(r.sorties[0].out.split('\n').filter(Boolean).join(',') === 'departement,Ventes,Ventes,Finance', 'cut : la 3e colonne');
  assert(r.sorties[1].out.split('\n').filter(Boolean).sort().join(',') === 'Finance,Ventes,departement', 'cut | sort | uniq : valeurs distinctes');
}
{
  const r = lancer('linux-fins-ligne-windows', { fichier: 's.sh' }, { 's.sh': '#!/bin/bash\r\necho ok\r\n' });
  assert(/CRLF/.test(r.sorties[0].out), 'CRLF : file le détecte');
  assert(r.lire('s.sh') === '#!/bin/bash\necho ok\n' && !/CRLF/.test(r.sorties[2].out), 'CRLF : corrigé, plus de CRLF');
  assert(r.lire('s.sh.bak') === '#!/bin/bash\r\necho ok\r\n', 'CRLF : original gardé');
}

console.log('4. Recherche');
for (const [req, attendu] of [['sed -i', 'linux-sed-remplacer'], ['remplacer un mot dans un fichier', 'linux-sed-remplacer'], ['supprimer une ligne sed', 'linux-sed-lignes'], ['vérifier un csv', 'linux-csv-verifier'], ['cut colonne', 'linux-csv-colonne'], ['dos2unix', 'linux-fins-ligne-windows']]) {
  const res = T.chercher(req, { plateforme: 'Linux' });
  const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
  assert(ids.slice(0, 5).includes(attendu), `recherche « ${req} » : ${attendu} parmi les 5 premiers`, ids.slice(0, 5).join());
}

console.log('6. Comptes, groupes et mots de passe');
{
  const r = lancer('linux-comptes-locaux-lister', { compte: 'root' }, {});
  assert(r.sorties[0].code === 0 && !/^root:/m.test(r.sorties[0].out), 'comptes : la liste des comptes ordinaires n’affiche pas root (UID 0)');
  const g = lancer('linux-groupes-locaux-lister', { groupe: 'root' }, {}, { etapes: [0, 1] });
  assert(g.sorties[0].code === 0 && g.sorties[1].out.startsWith('root:'), 'groupes : getent group root renvoie le groupe');
  const rendu = (id, val) => P.rendreMethode(fiche(id).methodes[0], fiche(id).params, val).etapes.map((e) => e.rendu.texteCopie).join('\n');
  assert(/samba-tool user show christian_chef/.test(rendu('samba-compte-voir', { compte: 'christian_chef' })), 'samba : user show rendu');
  assert(/samba-tool user setpassword christian_chef/.test(rendu('samba-mot-de-passe', { compte: 'christian_chef' })) && !/--newpassword/.test(rendu('samba-mot-de-passe', { compte: 'christian_chef' })), 'samba : setpassword sans mot de passe en clair dans la commande');
  assert(/passwd christian_chef/.test(rendu('linux-mot-de-passe-local', { compte: 'christian_chef' })), 'local : passwd rendu');
  assert(!v('linux-mot-de-passe-local', 'compte', 'a; rm -rf /').ok && !v('samba-mot-de-passe', 'compte', '$(id)').ok && !v('linux-groupes-locaux-lister', 'groupe', 'x y').ok, 'comptes : valeurs piégées refusées');
  for (const [req, attendu] of [['lister les utilisateurs locaux', 'linux-comptes-locaux-lister'], ['getent group', 'linux-groupes-locaux-lister'], ['changer le mot de passe linux', 'linux-mot-de-passe-local'], ['samba-tool user show', 'samba-compte-voir'], ['samba-tool user setpassword', 'samba-mot-de-passe']]) {
    const res = T.chercher(req, { plateforme: 'Linux' }); const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 6).includes(attendu), `recherche « ${req} » : ${attendu}`, ids.slice(0, 6).join());
  }
  assert(LC.every((p) => /remplac|hash|empreinte|récupér|retrouver/i.test(JSON.stringify(p)) || !/mot-de-passe/.test(p.id)), 'fiches mot de passe : précisent qu’on remplace, on ne relit pas');
}

console.log('7. Clavier et langue');
{
  const rendu = (id, val) => P.rendreMethode(fiche(id).methodes[0], fiche(id).params, val).etapes.map((e) => e.rendu.texteCopie).join('\n');
  assert(!v('linux-clavier-changer', 'disposition', 'ca; rm -rf /').ok && !v('linux-clavier-changer', 'disposition', 'xx').ok && v('linux-clavier-changer', 'disposition', 'ca').ok, 'disposition : seulement la liste fermée');
  assert(!v('linux-langue-systeme', 'langue', 'fr_CA').ok && v('linux-langue-systeme', 'langue', 'fr_CA.UTF-8').ok, 'langue Linux : liste fermée avec .UTF-8');
  assert(!v('win-clavier-fixer', 'langue', 'fr-CA; Remove-Item').ok && v('win-clavier-fixer', 'langue', 'fr-CA').ok, 'langue Windows : liste fermée');
  assert(/sudo localectl set-keymap ca/.test(rendu('linux-clavier-changer', { disposition: 'ca' })) && /set-x11-keymap ca/.test(rendu('linux-clavier-changer', { disposition: 'ca' })), 'localectl : console et X11');
  assert(/gsettings set org\.gnome\.desktop\.input-sources sources "\[\('xkb', 'us'\)\]"/.test(rendu('linux-clavier-session', { disposition: 'us' })), 'gsettings : une seule entrée rendue correctement');
  assert(/New-WinUserLanguageList -Language fr-CA\) -Force/.test(rendu('win-clavier-fixer', { langue: 'fr-CA' })), 'Windows : liste remplacée par une seule langue');
  assert(rendu('win-clavier-raccourci', {}).includes('Language Hotkey') && rendu('win-clavier-raccourci', {}).includes('"3"'), 'Windows : raccourci désactivé (valeur 3)');
  // Exécution réelle : les parties qui ne dépendent pas d'un bureau (locale -a, grep de la liste) tournent ici.
  const loc = spawnSync('bash', ['-c', 'locale -a | grep -ci "^c"'], { encoding: 'utf8' });
  assert(loc.status === 0, 'locale -a s’exécute sur cette machine');
  for (const [req, attendu, plat] of [['localectl set-keymap', 'linux-clavier-changer', 'Linux'], ['clavier qwerty azerty linux', 'linux-clavier-changer', 'Linux'], ['gsettings input-sources', 'linux-clavier-session', 'Linux'], ['locale-gen', 'linux-langue-systeme', 'Linux'], ['alt shift clavier', 'win-clavier-raccourci', 'Windows'], ['set-winuserlanguagelist', 'win-clavier-fixer', 'Windows'], ['set-culture', 'win-region-format', 'Windows'], ['clavier change tout seul', 'win-langue-voir', 'Windows']]) {
    const res = T.chercher(req, { plateforme: plat }); const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 6).includes(attendu), `recherche « ${req} » : ${attendu}`, ids.slice(0, 6).join());
  }
}

console.log('5. Contre-épreuves');
{
  const c = structuredClone(fiche('linux-csv-colonne')); c.params = c.params.filter((q) => q.id !== 'sep');
  assert(P.incoherencesProcedure(c).length > 0, 'paramètre utilisé mais non déclaré → échec');
  const d = structuredClone(fiche('linux-sed-remplacer')); d.methodes[0].verification = [];
  assert(P.incoherencesProcedure(d).length > 0, 'sans vérification → échec');
}

console.log(`\nlinux-simples : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Commandes exécutées pour de vrai sur des fichiers temporaires (bash, sed, awk, cut, file de cette machine).');
process.exit(failed ? 1 : 0);
