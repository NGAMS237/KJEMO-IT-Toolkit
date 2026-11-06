#!/usr/bin/env node
/**
 * samba-partage-parcourir.test.mjs — KJEMO-PARCOURIR-01 · KJEMO IT Toolkit
 * Fiche « Parcourir un partage Samba depuis Ubuntu » : contrat, option graphique en premier, aucun mot de passe
 * dans une commande, machines (client Ubuntu / serveur), annulations du montage,
 * EXÉCUTION RÉELLE de l'extraction de la section du partage (sed) sur une sortie testparm d'exemple.
 * NE PROUVE PAS : que smbclient, mount.cifs et testparm fonctionnent sur un vrai Ubuntu (NON EXÉCUTÉS).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const p = T.entreeParId('samba-partage-parcourir').procedure;
assert(P.incoherencesProcedure(p).length === 0, 'contrat respecté', P.incoherencesProcedure(p).join(' | '));
assert(p.methodes[0].id === 'gui' && p.methodes[1].id === 'linux', 'option graphique en premier, puis les commandes');
assert(/Option graphique/.test(p.resume), 'le résumé mentionne l’option graphique');
const lin = p.methodes[1];
assert(lin.etapes.every((e) => e.machine === 'client-ubuntu' || e.machine === 'serveur'), 'chaque étape a une machine');
assert(lin.etapes.filter((e) => e.annulation).length === 2 && lin.etapes.filter((e) => e.annulation).every((e) => e.facultatif), 'deux annulations facultatives (umount, rmdir)');
const ex = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
const r = P.rendreMethode(lin, p.params, ex);
assert(r.manquants.length === 0, 'exemples acceptés');
const cmds = r.etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
assert(!cmds.some((c) => /password=|--password|-N\b.*-U/i.test(c)), 'aucun mot de passe dans une commande');
assert(cmds.some((c) => /^smbclient \/\/192\.168\.20\.1\/direction -W SERVEUR2 -U receptioniste$/.test(c)), 'session interactive sans -c');
assert(cmds.some((c) => /mount -t cifs \/\/192\.168\.20\.1\/direction \/mnt\/direction -o username=receptioniste,domain=SERVEUR2$/.test(c)), 'montage cifs');
// Exécution réelle de la commande de dépannage (partie sed) sur une sortie testparm d'exemple
const dep = cmds.find((c) => /testparm/.test(c));
assert(Boolean(dep), 'commande testparm présente');
const sedPart = dep.split('| ').slice(1).join('| ');
const entree = '[global]\n\tworkgroup = SERVEUR2\n\n[direction]\n\tpath = /DATA/direction\n\tread list = receptionniste\n\n[autre]\n\tpath = /x\n';
const out = spawnSync('bash', ['-c', sedPart], { input: entree, encoding: 'utf8' });
assert(out.status === 0 && /\[direction\]/.test(out.stdout) && /read list = receptionniste/.test(out.stdout) && !/\[autre\]/.test(out.stdout) && !/\[global\]/.test(out.stdout), 'sed : seule la section du partage est affichée');
console.log(`\nsamba-partage-parcourir.test.mjs : ${passed} OK, ${failed} échec(s)`);
console.log('Exécution réelle sur postes : NON EXÉCUTÉE (seul sed est exécuté).');
process.exit(failed ? 1 : 0);
