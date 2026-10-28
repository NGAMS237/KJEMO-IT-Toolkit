#!/usr/bin/env node
/** vue-portes-plateforme.test.mjs — UX-FENETRE-01 : accueil par plateforme (marquage pur, sans navigateur). */
import { portesAccueilMarkup } from '../dist/vue-portes.mjs';
let ok = 0; let ko = 0;
const t = (c, l) => { if (c) ok++; else { ko++; console.error(`  [FAIL]  ${l}`); } };
const base = { memoCartes: [], hrefCours: '#/cours', hrefLabo: '#/labo' };

const win = portesAccueilMarkup({ ...base, tp: null, memoTotal: 0, catalogueTotal: 22, plat: 'Windows' });
t(win.includes('Mes cours Windows') && win.includes('Aide-mémoire Windows') && win.includes('Catalogue pro Windows'), 'Windows : trois portes nommées');
t((win.match(/porte-vide/g) ?? []).length === 2, 'Windows : cours et aide-mémoire sont des cartes « Bientôt »');
t(!win.includes('id="porteTpBtn"') && !win.includes('id="porteMemoBtn"'), 'Windows : aucun faux bouton d’ouverture');
t(win.includes('id="porteProBtn"') && win.includes('22 procédures'), 'Windows : le catalogue est actif avec son compte');
t(win.includes('id="platEntete"'), 'Windows : phrase de vue');
t(!win.includes('statuts-table'), 'Windows : pas de tableau d’avancement');

const lin = portesAccueilMarkup({ ...base, tp: { titre: 'TP2', faits: 3, total: 45, href: '#/cours/x/A' }, memoTotal: 47, catalogueTotal: 205, plat: 'Linux' });
t(lin.includes('id="porteTpBtn"') && lin.includes('Continuer') && !lin.includes('porte-vide'), 'Linux : portes actives');

const tous = portesAccueilMarkup({ ...base, tp: null, memoTotal: 47, catalogueTotal: 239, statuts: [
  { plat: 'Linux', cours: 1, memo: 47, catalogue: 205 }, { plat: 'Windows', cours: 0, memo: 0, catalogue: 22 },
  { plat: 'Cisco', cours: 0, memo: 0, catalogue: 8 }, { plat: 'Azure', cours: 0, memo: 0, catalogue: 4 }] });
t((tous.match(/data-plat-go=/g) ?? []).length === 4, 'Toutes : une ligne par plateforme');
t((tous.match(/À venir/g) ?? []).length === 6, 'Toutes : six cases « À venir » (cours et mémo des trois autres)');
t(tous.includes('Mes cours et TP') && !tous.includes('id="platEntete"'), 'Toutes : titres génériques');

const evil = portesAccueilMarkup({ ...base, tp: null, memoTotal: 0, catalogueTotal: 1, plat: '<img src=x onerror=1>' });
t(!evil.includes('<img src=x'), 'plateforme : échappée dans le marquage');

console.log(`vue-portes-plateforme : ${ok} vérification(s) réussie(s), ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
