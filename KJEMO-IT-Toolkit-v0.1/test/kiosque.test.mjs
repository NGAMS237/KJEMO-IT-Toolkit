#!/usr/bin/env node
/**
 * kiosque.test.mjs — KJEMO-KIOSQUE-01
 * Fiches « kiosque » Windows, Ubuntu et Azure/Intune : contrat, option graphique d'abord, annulations facultatives,
 * rangement (aide-mémoire + catalogue), syntaxe PowerShell (pwsh) et Bash (bash -n) de chaque ligne rendue,
 * et EXÉCUTION RÉELLE (bash) des deux commandes qui modifient un fichier : le sed de GDM et le printf du fichier .desktop.
 * NE PROUVE PAS : que le kiosque fonctionne sur un vrai Windows, Ubuntu ou locataire Intune (NON EXÉCUTÉ).
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const M = await imp('memo.mjs'); const C = await imp('classement.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const pwshOk = spawnSync('pwsh', ['-NoProfile', '-Command', '1'], { encoding: 'utf8' }).status === 0;
const rendre = (p, m) => P.rendreMethode(m, p.params, Object.fromEntries(p.params.map((q) => [q.id, q.exemple])));
let lignesLinux = [];
for (const id of ['win-kiosque-configurer', 'linux-kiosque-configurer', 'azure-intune-kiosque']) {
  const p = T.entreeParId(id)?.procedure;
  assert(Boolean(p), `${id} existe`);
  if (!p) continue;
  assert(P.incoherencesProcedure(p).length === 0, `${id} : contrat`, P.incoherencesProcedure(p).join(' | '));
  assert(p.methodes[0].id === 'gui', `${id} : option graphique en premier`);
  assert(p.methodes.length === 2, `${id} : deux méthodes`);
  for (const m of p.methodes) {
    const r = rendre(p, m);
    assert(r.manquants.length === 0, `${id}/${m.id} : exemples acceptés`);
    const annuls = m.etapes.filter((e) => e.annulation);
    assert(annuls.length > 0 && annuls.every((e) => e.facultatif), `${id}/${m.id} : annulations facultatives`);
    assert(m.etapes.some((e) => e.verification), `${id}/${m.id} : une vérification`);
    const lignes = r.etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
    assert(!lignes.some((l) => /password|motdepasse|secret/i.test(l.replace(/--disabled-password|-NoPassword/g, ''))), `${id}/${m.id} : aucun mot de passe dans une commande`);
    if (m.id === 'powershell' && pwshOk) {
      for (const l of lignes) {
        const f = mkdtempSync(resolve(tmpdir(), 'k-')) + '/x.ps1'; writeFileSync(f, l);
        const r2 = spawnSync('pwsh', ['-NoProfile', '-Command', `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${f}',[ref]$t,[ref]$e);if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`], { encoding: 'utf8' });
        assert(r2.status === 0, `${id} : syntaxe PowerShell « ${l.slice(0, 50)} »`, r2.stdout.slice(0, 150));
      }
    }
    if (m.id === 'linux' || m.id === 'azure') {
      for (const l of lignes) {
        const r2 = spawnSync('bash', ['-n', '-c', l], { encoding: 'utf8' });
        assert(r2.status === 0, `${id} : syntaxe Bash « ${l.slice(0, 50)} »`, r2.stderr.slice(0, 150));
      }
      if (id === 'linux-kiosque-configurer') lignesLinux = lignes;
    }
  }
}
// Exécution réelle : le sed sur un fichier GDM d'Ubuntu (lignes commentées) et le printf du fichier .desktop.
const dir = mkdtempSync(resolve(tmpdir(), 'gdm-'));
const conf = resolve(dir, 'custom.conf');
const modele = '# GDM configuration storage\n\n[daemon]\n# Uncomment the line below to force the login screen to use Xorg\n#WaylandEnable=false\n\n#  AutomaticLoginEnable = true\n#  AutomaticLogin = user1\n\n[security]\n';
const sedLigne = lignesLinux.find((l) => /sed -i/.test(l));
assert(Boolean(sedLigne), 'Linux : la ligne sed de GDM existe');
if (sedLigne) {
  for (const [nom, contenu] of [['lignes commentées', modele], ['lignes déjà actives', modele.replace('#  AutomaticLoginEnable = true', 'AutomaticLoginEnable = false').replace('#  AutomaticLogin = user1', 'AutomaticLogin = autre')]]) {
    writeFileSync(conf, contenu);
    const cmd = sedLigne.replace(/^sudo /, '').replace('/etc/gdm3/custom.conf', conf);
    const r = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
    const out = readFileSync(conf, 'utf8');
    assert(r.status === 0 && /^AutomaticLoginEnable = true$/m.test(out) && /^AutomaticLogin = kiosque$/m.test(out), `GDM (${nom}) : les deux lignes sont activées avec le bon compte`, r.stderr);
    assert(/^\[security\]$/m.test(out) && /^#WaylandEnable=false$/m.test(out), `GDM (${nom}) : le reste du fichier est intact`);
  }
}
const printfLigne = lignesLinux.find((l) => /printf/.test(l));
if (printfLigne) {
  const cible = resolve(dir, 'kiosque.desktop');
  const cmd = printfLigne.replace(/^printf (.*?) \| sudo -u \S+ tee \S+$/s, `printf $1 > ${cible}`);
  const r = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  const out = readFileSync(cible, 'utf8');
  assert(r.status === 0 && out.startsWith('[Desktop Entry]\nType=Application\n') && /^Exec=firefox --kiosk https:\/\/www\.example\.org\/$/m.test(out), 'Linux : le fichier .desktop produit est correct');
}
const rangees = JSON.stringify(M.MEMO_GROUPES); const arbre = JSON.stringify(C.ARBRE);
for (const id of ['win-kiosque-configurer', 'linux-kiosque-configurer', 'azure-intune-kiosque']) {
  assert(rangees.includes(id), `${id} : rangée dans l’aide-mémoire`);
  assert(arbre.includes(id), `${id} : classée dans le catalogue`);
}
console.log(`\nkiosque.test.mjs : ${passed} OK, ${failed} échec(s)`);
console.log('Exécution réelle d’un kiosque (Windows, Ubuntu, Intune) : NON EXÉCUTÉE. Syntaxe de chaque ligne, sed de GDM et fichier .desktop vérifiés pour de vrai.');
process.exit(failed ? 1 : 0);
