#!/usr/bin/env node
/**
 * jonction-graphique.test.mjs — KJEMO-JONCTION-GUI-01 · KJEMO IT Toolkit
 * Fiche « Joindre Ubuntu à un domaine Samba AD par l'interface graphique » (alternative à la jonction par commandes).
 *  - deux méthodes (gui, linux), contrat respecté, étapes étiquetées par poste, aucune ligne de commande en mode graphique ;
 *  - le DNS du serveur (port 53) est contrôlé AVANT toute jonction, et le domaine doit être trouvé avant de joindre ;
 *  - Cockpit et la variante Paramètres sont décrits ; les annulations sont facultatives ; sources HTTPS ;
 *  - la fiche par commandes écrit maintenant le nom complet dans /etc/hosts (et le retire à l'annulation).
 * NE PROUVE PAS : que les clics et commandes fonctionnent sur un vrai Ubuntu 24.04 (NON EXÉCUTÉS).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const p = T.entreeParId('cours-ubuntu-jonction-ad-graphique').procedure;
const gui = p.methodes.find((m) => m.id === 'gui'); const lin = p.methodes.find((m) => m.id === 'linux');
assert(P.incoherencesProcedure(p).length === 0, 'contrat respecté', P.incoherencesProcedure(p).join(' | '));
assert(Boolean(gui && lin) && p.methodes[0].id === 'gui', 'méthodes gui (première) et linux');
assert(gui.etapes.every((e) => !e.lignes && e.actions?.length && e.machine), 'mode graphique : actions seulement, chaque étape a son poste');
assert(lin.etapes.every((e) => e.machine) && lin.etapes.some((e) => e.machine === 'serveur'), 'terminal : étapes étiquetées, dont le serveur');
const txt = (m) => m.etapes.map((e) => `${e.titre} ${e.explication} ${(e.actions ?? []).join(' ')}`).join('\n');
assert(/Cockpit/.test(txt(gui)) && /9090/.test(txt(gui)) && /Joindre le domaine/.test(txt(gui)), 'Cockpit : adresse et bouton Joindre le domaine');
assert(/Connexion d’entreprise/.test(txt(gui)) && /pas vérifiée/.test(txt(gui)), 'variante Paramètres signalée comme non vérifiée');
const iDns = lin.etapes.findIndex((e) => e.lignes.some((l) => /ss -lunpt/.test(l.cmd)));
const iJoin = lin.etapes.findIndex((e) => e.lignes.some((l) => /realm join/.test(l.cmd)));
const iDecouvre = lin.etapes.findIndex((e) => e.lignes.some((l) => /_ldap\._tcp/.test(l.cmd)));
assert(iDns === 0 && iDecouvre > iDns && iJoin > iDecouvre, 'DNS du serveur contrôlé en premier, domaine trouvé avant de joindre');
assert(lin.etapes.filter((e) => e.annulation).length >= 4 && lin.etapes.filter((e) => e.annulation).every((e) => e.facultatif), 'annulations facultatives');
assert(p.sources.length >= 3 && p.sources.every((s) => /^https:\/\//.test(s.url)), 'sources HTTPS');
assert(p.origine === 'memo', 'fiche de l’aide-mémoire (hors des 98 fiches de cours)');
const j = T.entreeParId('cours-ubuntu-jonction-ad').procedure.methodes[0];
const ligne = (re) => j.etapes.some((e) => e.lignes.some((l) => re.test(l.cmd)));
assert(ligne(/127\.0\.1\.1 \{\{poste\}\}\.\{\{domaine\}\} \{\{poste\}\}.*\/etc\/hosts/) && ligne(/sed -i .*\/etc\/hosts/), 'jonction par commandes : /etc/hosts ajouté puis retiré à l’annulation');
console.log(`jonction-graphique : ${passed} vérification(s) réussie(s), ${failed} échec(s). Clics et commandes NON exécutés sur un vrai Ubuntu.`);
process.exit(failed ? 1 : 0);
