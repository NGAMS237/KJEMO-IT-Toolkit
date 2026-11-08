#!/usr/bin/env node
/**
 * outils-admin.test.mjs — KJEMO-OUTILS-ADMIN-01
 * Cockpit (Ubuntu), OpenRSAT (Ubuntu) et l'option graphique de RSAT (Windows) : contrat, option graphique en premier,
 * annulations facultatives, rangement (aide-mémoire + catalogue), URL officielles.
 * NE PROUVE PAS : que l'installation fonctionne sur un vrai Ubuntu / Windows (NON EXÉCUTÉ), ni les libellés exacts des écrans.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const M = await imp('memo.mjs'); const C = await imp('classement.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
for (const id of ['linux-cockpit-installer', 'linux-openrsat-installer', 'cours-rsat-windows']) {
  const p = T.entreeParId(id)?.procedure;
  assert(Boolean(p), `${id} existe`);
  if (!p) continue;
  assert(P.incoherencesProcedure(p).length === 0, `${id} : contrat`, P.incoherencesProcedure(p).join(' | '));
  assert(p.methodes[0].id === 'gui', `${id} : option graphique en premier`);
  assert(p.methodes.length === 2 || id === 'cours-rsat-windows', `${id} : méthodes graphique + commandes`);
  const ex = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
  for (const m of p.methodes) {
    const r = P.rendreMethode(m, p.params, ex);
    assert(r.manquants.length === 0, `${id}/${m.id} : exemples acceptés`);
    assert(m.etapes.some((e) => e.annulation), `${id}/${m.id} : une étape d’annulation`);
    assert(m.etapes.filter((e) => e.annulation).every((e) => e.facultatif), `${id}/${m.id} : annulations facultatives`);
    assert(m.etapes.some((e) => e.verification), `${id}/${m.id} : une vérification`);
  }
}
const cmds = (id) => P.rendreMethode(T.entreeParId(id).procedure.methodes.find((m) => m.id === 'linux'), T.entreeParId(id).procedure.params, Object.fromEntries(T.entreeParId(id).procedure.params.map((q) => [q.id, q.exemple]))).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
const ck = cmds('linux-cockpit-installer').join('\n');
assert(/apt install -y cockpit/.test(ck) && /systemctl enable --now cockpit\.socket/.test(ck) && /9090/.test(ck), 'Cockpit : installation, socket et port 9090');
const rs = cmds('linux-openrsat-installer').join('\n');
assert(/github\.com\/tranquilit\/OpenRSAT\/releases\/download\/v0\.4\.519\/OpenRSAT-0\.4\.519-amd64\.deb/.test(rs), 'OpenRSAT : URL du .deb officiel (Tranquil IT)');
assert(/apt install -y \.\/OpenRSAT-0\.4\.519-amd64\.deb/.test(rs), 'OpenRSAT : installation du fichier local avec apt');
assert(/releases\/latest\/download\/OpenRSAT-linux-x64/.test(rs), 'OpenRSAT : variante binaire autonome');
const rangees = JSON.stringify(M.MEMO_GROUPES);
assert(rangees.includes('linux-cockpit-installer') && rangees.includes('linux-openrsat-installer'), 'aide-mémoire : les deux fiches sont rangées');
assert(JSON.stringify(C.ARBRE).includes('linux-cockpit-installer') && JSON.stringify(C.ARBRE).includes('linux-openrsat-installer'), 'catalogue : les deux fiches sont classées');
console.log(`\noutils-admin.test.mjs : ${passed} OK, ${failed} échec(s)`);
console.log('Exécution réelle sur Ubuntu / Windows : NON EXÉCUTÉE (contrat, rendu et rangement seulement).');
process.exit(failed ? 1 : 0);
