#!/usr/bin/env node
/**
 * domaine-reconstruire.test.mjs — KJEMO-RECONSTRUIRE-01 · KJEMO IT Toolkit
 * DNS Windows, sortie d'un domaine sans serveur (Ubuntu, Windows), parcours « reconstruire », option graphique.
 *  - contrat, option graphique présente et mentionnée dans le résumé, ordre du parcours ;
 *  - jamais --remove dans la sortie hors ligne Ubuntu ; aucun mot de passe dans une commande ;
 *  - EXÉCUTION RÉELLE : retrait de la ligne /etc/hosts sur un fichier temporaire.
 * NE PROUVE PAS : realm, nmcli, Remove-Computer, WMI ni les libellés des fenêtres (NON EXÉCUTÉS).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const IDS = ['win-dns-poste-regler', 'linux-domaine-quitter-hors-ligne', 'win-domaine-quitter-hors-ligne', 'samba-ad-reconstruire', 'win-ad-joindre-domaine'];
for (const id of IDS) {
  const p = T.entreeParId(id)?.procedure;
  assert(Boolean(p), `${id} existe`);
  if (!p) continue;
  assert(P.incoherencesProcedure(p).length === 0, `${id} : contrat`, P.incoherencesProcedure(p).join(' | '));
  const ex = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
  for (const m of p.methodes) {
    const r = P.rendreMethode(m, p.params, ex);
    assert(r.manquants.length === 0, `${id}/${m.id} : exemples acceptés`);
    const lignes = r.etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie)).join('\n');
    assert(!/\{\{|‹/.test(lignes), `${id}/${m.id} : aucune marque restante`);
    assert(!/-AsPlainText|--password|-Password\s+["'$]/i.test(lignes), `${id}/${m.id} : aucun mot de passe`);
  }
  if (id !== 'samba-ad-reconstruire') {
    assert(p.methodes[0].id === 'gui' && p.methodes.length === 2, `${id} : option graphique + commandes`);
    assert(/graphique|ncpa|sysdm|Cockpit/i.test(p.resume), `${id} : le résumé mentionne l’option graphique`);
  }
}
const q = T.entreeParId('linux-domaine-quitter-hors-ligne').procedure.methodes.find((m) => m.id === 'linux');
const cmd = JSON.stringify(q.etapes.map((e) => e.lignes));
assert(/realm leave/.test(cmd) && !/realm leave[^"]*--remove/.test(cmd), 'sortie hors ligne : realm leave sans --remove');
const rec = T.entreeParId('samba-ad-reconstruire').procedure.methodes[0];
assert(rec.etapes.every((e) => e.machine), 'parcours : machine sur chaque étape');
const ordre = rec.etapes.map((e) => e.titre);
const pos = (s) => ordre.findIndex((t) => t.includes(s));
assert(pos('sortir de l’ancien') < pos('installer le contrôleur') && pos('installer le contrôleur') < pos('pointer le DNS vers le nouveau serveur') && pos('pointer le DNS') < pos('joindre le nouveau'), 'parcours : sortir, installer, DNS, joindre');
assert(T.entreeParId('win-ad-joindre-domaine').procedure.methodes.some((m) => m.id === 'gui' && m.etapes.some((e) => e.annulation)), 'jonction Windows : option graphique avec annulation');
// Exécution réelle : retrait de la ligne hosts
const d = mkdtempSync(join(tmpdir(), 'rec-')); const f = join(d, 'hosts');
writeFileSync(f, '127.0.0.1 localhost\n127.0.1.1 ubuntuclient.ad.lab ubuntuclient\n');
const sed = spawnSync('sed', ['-i', '/ubuntuclient.ad.lab/d', f]);
assert(sed.status === 0 && readFileSync(f, 'utf8') === '127.0.0.1 localhost\n', 'sed : la ligne ajoutée disparaît, localhost reste');
console.log(`\ndomaine-reconstruire.test.mjs : ${passed} OK, ${failed} échec(s)`);
console.log('Exécution réelle sur postes : NON EXÉCUTÉE (seul sed est exécuté).');
process.exit(failed ? 1 : 0);
