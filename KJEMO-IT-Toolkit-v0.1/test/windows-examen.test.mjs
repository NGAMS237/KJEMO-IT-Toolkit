#!/usr/bin/env node
/**
 * windows-examen.test.mjs — KJEMO-EXAMEN-WS-01 · KJEMO IT Toolkit
 * Les fiches de l'examen pratique Windows Server 2022 : disque, quota FSRM, sauvegarde planifiée, miroir RAID 1,
 * exclusion DHCP, script PowerShell, plus le parcours de l'examen.
 *  - contrat, option graphique en premier, annulations facultatives, aucun mot de passe dans une commande ;
 *  - rangement : un groupe « Examen Windows Server 2022 » dans l'aide-mémoire, chaque fiche UNE fois, parcours relié à toutes les fiches ;
 *  - SYNTAXE PowerShell : chaque ligne rendue est analysée par l'analyseur de PowerShell 7 (si pwsh est installé) ;
 *  - EXÉCUTION RÉELLE (pwsh) : le bloc qui écrit le script du Q6 est exécuté, le fichier produit est relu et analysé.
 * NE PROUVE PAS : que les cmdlets FSRM, WindowsServerBackup, DHCP, Storage, diskpart et ActiveDirectory fonctionnent sur un vrai Windows Server (NON EXÉCUTÉS).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const M = await imp('memo.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const IDS = ['win-disque-ajouter', 'win-quota-fsrm', 'win-sauvegarde-planifier', 'win-miroir-raid1', 'win-dhcp-exclusion', 'win-script-utilisateur-partage', 'win-examen-parcours'];
const pwshOk = spawnSync('pwsh', ['-NoProfile', '-Command', '1'], { encoding: 'utf8' }).status === 0;
const toutes = [];
for (const id of IDS) {
  const p = T.entreeParId(id)?.procedure;
  assert(Boolean(p), `${id} existe`);
  if (!p) continue;
  assert(P.incoherencesProcedure(p).length === 0, `${id} : contrat`, P.incoherencesProcedure(p).join(' | '));
  assert(p.origine === 'memo', `${id} : origine memo`);
  const ex = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
  for (const m of p.methodes) {
    const r = P.rendreMethode(m, p.params, ex);
    assert(r.manquants.length === 0, `${id}/${m.id} : exemples acceptés`);
    const lignes = r.etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
    assert(!lignes.some((l) => /-AsPlainText|-Password\s+["']|ConvertTo-SecureString/i.test(l)), `${id}/${m.id} : aucun mot de passe dans une commande`);
    if (m.id === 'powershell') toutes.push({ id, lignes });
    const annuls = m.etapes.filter((e) => e.annulation);
    assert(annuls.every((e) => e.facultatif), `${id}/${m.id} : annulations facultatives`);
  }
  if (id !== 'win-examen-parcours') {
    assert(p.methodes[0].id === 'gui' && p.methodes[1].id === 'powershell', `${id} : option graphique en premier`);
    assert(/graphique|console|Gestion des disques|FSRM|assistant|à la main|dsa\.msc|diskmgmt/i.test(p.resume), `${id} : le résumé mentionne l’option graphique`);
    assert(p.methodes[0].etapes.some((e) => e.annulation), `${id} : l’option graphique a son annulation`);
    assert(p.methodes[1].etapes.some((e) => e.annulation), `${id} : les commandes ont leur annulation`);
  }
}
// Rangement
const g = M.MEMO_GROUPES.find((x) => x.id === 'win-examen');
assert(Boolean(g), 'groupe « Examen Windows Server 2022 » dans l’aide-mémoire');
const rangees = g ? g.sous.flatMap((s) => s.fiches) : [];
assert(IDS.every((i) => rangees.includes(i)) && rangees.length === IDS.length, 'les 7 fiches sont dans le groupe, une fois chacune');
assert(g && g.sous[0].fiches[0] === 'win-examen-parcours', 'le parcours est la première fiche du groupe');
const par = T.entreeParId('win-examen-parcours').procedure;
const cibles = (par.prerequis ?? []).map((x) => x.fiche);
assert(IDS.filter((i) => i !== 'win-examen-parcours').every((i) => cibles.includes(i)), 'le parcours renvoie vers les 6 fiches');
assert(cibles.every((i) => Boolean(T.entreeParId(i))), 'tous les liens du parcours existent');
assert(['win-ad-creer-groupe', 'win-ad-creer-utilisateur', 'win-ad-ajouter-membre', 'windows-ip-fixe', 'win-dhcp-installer', 'win-dhcp-etendue'].every((i) => cibles.includes(i)), 'le parcours renvoie aussi vers les fiches déjà existantes (Q1, Q5)');
// Recherche : une phrase d'examen retrouve la bonne fiche
for (const [req, id] of [['quota 200 mo sur un dossier', 'win-quota-fsrm'], ['sauvegarde planifiée 13h et 16h', 'win-sauvegarde-planifier'], ['raid 1 windows server miroir', 'win-miroir-raid1'], ['exclure 50 adresses dhcp', 'win-dhcp-exclusion'], ['ajouter un disque windows', 'win-disque-ajouter']]) {
  const rs = T.chercher(req); const liste = Array.isArray(rs) ? rs : (rs.resultats ?? rs.items ?? []);
  const tete = liste.slice(0, 5).map((r) => r.id ?? r.entree?.id);
  assert(tete.includes(id), `recherche « ${req} » → ${id}`, tete.join(','));
}
// Syntaxe PowerShell
if (pwshOk) {
  const dir = mkdtempSync(join(tmpdir(), 'exam-'));
  for (const { id, lignes } of toutes) {
    // Les lignes d'un bloc ici-chaîne (@' ... '@) forment une seule instruction : on analyse le texte complet de la méthode.
    const f = join(dir, `${id}.ps1`);
    writeFileSync(f, lignes.join('\n'), 'utf8');
    const r = spawnSync('pwsh', ['-NoProfile', '-Command', `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${f}',[ref]$t,[ref]$e);if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`], { encoding: 'utf8' });
    assert(r.status === 0, `${id} : syntaxe PowerShell valide`, (r.stdout + r.stderr).trim().split('\n')[0]);
  }
  // Exécution réelle du bloc qui écrit le script du Q6
  const q6 = T.entreeParId('win-script-utilisateur-partage').procedure;
  const cible = join(dir, 'CreerUtilisateur.ps1');
  const ex = Object.fromEntries(q6.params.map((q) => [q.id, q.exemple]));
  ex.script = cible; // le validateur Windows n'accepte pas un chemin Linux : on remplace après le rendu
  const r6 = P.rendreMethode(q6.methodes[1], q6.params, Object.fromEntries(q6.params.map((q) => [q.id, q.exemple])));
  const bloc = r6.etapes.find((e) => /Écrire le script/.test(e.titre)).rendu.lignes.map((l) => l.copie).join('\n').replace('C:\\Scripts\\CreerUtilisateur.ps1', cible);
  const run = spawnSync('pwsh', ['-NoProfile', '-Command', bloc], { encoding: 'utf8' });
  assert(run.status === 0, 'Q6 : le bloc qui écrit le script s’exécute', (run.stdout + run.stderr).slice(0, 200));
  const ecrit = readFileSync(cible, 'utf8');
  assert(/Read-Host "Nom de famille"/.test(ecrit) && /New-SmbShare/.test(ecrit) && /\$login = "\$\{nom\}\.\$\{prenom\}"/.test(ecrit), 'Q6 : le fichier produit contient les blocs attendus, $ intacts');
  const r = spawnSync('pwsh', ['-NoProfile', '-Command', `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${cible}',[ref]$t,[ref]$e);if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`], { encoding: 'utf8' });
  assert(r.status === 0, 'Q6 : le script écrit a une syntaxe PowerShell valide', r.stdout.slice(0, 200));
  assert(!/-AsPlainText/.test(ecrit) && /-AsSecureString/.test(ecrit), 'Q6 : le mot de passe est demandé en saisie masquée');
} else {
  console.log('  (pwsh absent : contrôles de syntaxe ignorés)');
}

// --- Entrée « Mes cours et TP » (EXAMEN-WS-02) ---
{
  const { COURS } = await import(pathToFileURL(fileURLToPath(new URL('../dist/cours.mjs', import.meta.url))).href);
  const c = COURS.find((x) => x.id === 'examen-serveur-1-windows-2022');
  assert(!!c && c.plateformes.includes('Windows'), 'cours : l’examen est dans « Mes cours et TP », plateforme Windows');
  assert(c && c.parcours.map((p) => p.lettre).join('') === 'ABCDEF', 'cours : un parcours par question, Q1 à Q6');
  assert(c && c.parcours.every((p, i) => p.titre.startsWith(`Q${i + 1} `)), 'cours : les titres des parcours portent Q1 à Q6');
}
console.log(`\nwindows-examen.test.mjs : ${passed} OK, ${failed} échec(s)`);
console.log('Exécution réelle sur Windows Server : NON EXÉCUTÉE (seuls la syntaxe PowerShell et l’écriture du script sont vérifiées).');
process.exit(failed ? 1 : 0);
