#!/usr/bin/env node
/**
 * cisco-tp-pvst.test.mjs — CISCO-TP-PVST-01 · KJEMO IT Toolkit
 * Fiche PARAMÉTRÉE « TP complet : PVST+, PortFast et BPDU guard (S1, S2, S3) » : contrat, cinq phases,
 * champs, ORDRE (VLAN avant port d'accès, trunks et gestion avant STP, STP avant PortFast), racines
 * sans doublon, annulations, parcours (références valides), classement, aide-mémoire.
 * CONTRE-ÉPREUVES : VLAN réservé, VLAN en double, mode STP inconnu, liste de VLAN contenant le VLAN 1.
 * NE PROUVE PAS que les commandes fonctionnent dans Packet Tracer ou sur du matériel (NON EXÉCUTÉ).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const K = await imp('cours.mjs'); const M = await imp('memo.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const ID = 'cours-tp-pvst';
const fiche = T.entreeParId(ID).procedure;
const m0 = fiche.methodes[0];
const base = m0.etapes.filter((e) => !e.annulation);
const annul = m0.etapes.filter((e) => e.annulation);
const exemple = Object.fromEntries(fiche.params.map((x) => [x.id, x.exemple]));
const rendre = (saisies) => P.rendreMethode(m0, fiche.params, saisies).etapes.map((e, i) => ({ i: i + 1, bloque: !!e.rendu?.bloque, lignes: (e.rendu?.lignes ?? []).map((l) => l.copie), manquants: e.rendu?.manquants ?? [] }));
const R = rendre(exemple);
const toutes = R.slice(0, base.length).flatMap((x) => x.lignes);
const idx = (re, depuis = 0) => toutes.findIndex((l, i) => i >= depuis && re.test(l));
const compte = (re) => toutes.filter((l) => re.test(l)).length;

// 1. Contrat et forme
assert(P.incoherencesProcedure(fiche).length === 0, 'contrat de fiche respecté', P.incoherencesProcedure(fiche).join(' | '));
assert(fiche.titre.length <= 70, 'titre ≤ 70 caractères', String(fiche.titre.length));
assert(base.length === 20 && annul.length === 3, `20 étapes + 3 annulations (${base.length} + ${annul.length})`);
const phases = [...new Set(base.map((e) => e.phase).filter(Boolean))];
assert(phases.length === 5 && phases.every((p, i) => p.startsWith(`Phase ${i + 1} —`)), 'cinq phases numérotées dans l’ordre', phases.join(' | '));
assert(base.every((e) => e.explication.length >= 30 && e.attendu.length >= 20), 'chaque étape explique et dit ce qu’on doit voir');
assert(R.every((x) => !x.bloque && x.manquants.length === 0), 'toutes les étapes se rendent avec l’exemple, sans champ manquant');

// 2. Commandes
for (const v of [10, 20, 30, 40, 50, 60, 70, 80, 99]) assert(compte(new RegExp(`^vlan ${v}$`)) === 3, `VLAN ${v} créé sur les trois commutateurs`);
assert(toutes.includes('hostname S1') && toutes.includes('hostname S2') && toutes.includes('hostname S3'), 'noms S1, S2 et S3');
assert(toutes.includes('switchport access vlan 30') && toutes.includes('switchport access vlan 20') && toutes.includes('switchport access vlan 10'), 'ports d’accès dans les VLAN 30, 20 et 10');
assert(compte(/^switchport mode trunk$/) === 3 && compte(/^switchport trunk native vlan 99$/) === 3, 'trois plages de trunk avec le VLAN natif 99');
assert(compte(/^interface range FastEthernet0\/1 - FastEthernet0\/4$/) === 3, 'plage Fa0/1 à Fa0/4 sur chaque commutateur', toutes.filter((l) => /range/.test(l)).join(' | '));
assert(toutes.includes('ip address 172.31.99.1 255.255.255.0') && toutes.includes('ip address 172.31.99.2 255.255.255.0') && toutes.includes('ip address 172.31.99.3 255.255.255.0'), 'adresses de gestion des trois commutateurs');
assert(compte(/^spanning-tree mode pvst$/) === 3, 'mode PVST sur les trois commutateurs');
assert(toutes.includes('spanning-tree vlan 10,30,50,70 root primary') && toutes.includes('spanning-tree vlan 1 root primary'), 'S1 racine principale du VLAN 1 et de 10,30,50,70');
assert(toutes.includes('spanning-tree vlan 20,40,60,80,99 root primary'), 'S3 racine principale de 20,40,60,80,99');
assert(toutes.includes('spanning-tree vlan 10,20,30,40,50,60,70,80,99 root secondary') && toutes.includes('spanning-tree vlan 1 root secondary'), 'S2 racine secondaire de tous les VLAN');
assert(compte(/^spanning-tree portfast$/) === 3 && compte(/^spanning-tree bpduguard enable$/) === 3, 'PortFast et BPDU guard sur les trois ports');
assert(toutes.filter((l) => /^interface Fast\w*0\/(6|18|11)$/.test(l)).length >= 6, 'ports F0/6, F0/18 et F0/11 visés (accès puis PortFast)');

// 3. Ordre
assert(idx(/^vlan 10$/) < idx(/^switchport access vlan 30$/), 'VLAN créés avant l’affectation du port');
assert(idx(/^switchport trunk native vlan/) < idx(/^spanning-tree mode/), 'trunks avant Spanning Tree');
assert(idx(/^spanning-tree vlan .* root/) < idx(/^spanning-tree portfast$/), 'racines avant PortFast');
assert(idx(/^spanning-tree portfast$/) < idx(/^spanning-tree bpduguard enable$/), 'PortFast avant la protection BPDU');
assert(idx(/^interface vlan 99$/) < idx(/^ping /), 'adresse de gestion avant le ping');
assert(toutes.at(-1) === 'copy running-config startup-config', 'enregistrement en dernier');

// 4. Pas de secret
assert(!base.some((e) => e.lignes.some((l) => l.secret)) && !JSON.stringify(fiche.params).match(/mot de passe|password|secret/i), 'aucun mot de passe en jeu');

// 5. Contre-épreuves
const ev = (saisies) => P.evaluerValeurs(fiche.params, { ...exemple, ...saisies });
const tableOk = (lignes) => ev({ vlans: lignes }).tables.vlans.ok;
assert(tableOk(exemple.vlans) === true, 'tableau de l’exemple accepté');
assert(tableOk([{ vlan: '1003', nom: 'X' }]) === false, 'VLAN réservé 1003 refusé');
assert(tableOk([{ vlan: '10', nom: 'A' }, { vlan: '10', nom: 'B' }]) === false, 'VLAN en double refusé');
const v = (id, valeur) => P.validerParametre(fiche.params.find((x) => x.id === id), valeur).ok;
assert(v('modeStp', 'mst') === false && v('modeStp', 'rapid-pvst') === true, 'mode STP : pvst et rapid-pvst seulement');
assert(v('racineS1', '1,10,30') === false, 'le VLAN 1 est refusé dans une liste (il a sa propre ligne)');
assert(v('vlanNatif', '1') === false, 'VLAN natif 1 refusé');
const rapide = rendre({ ...exemple, modeStp: 'rapid-pvst' }).slice(0, base.length).flatMap((x) => x.lignes);
assert(rapide.filter((l) => l === 'spanning-tree mode rapid-pvst').length === 3, 'mode Rapid PVST+ possible');

// 6. Annulations
assert(annul.every((e) => e.facultatif && ['modification', 'destructif', 'interruption'].includes(e.effet)), 'annulations facultatives et modifiantes');
const ra = P.rendreMethode(m0, fiche.params, exemple).etapes.slice(base.length).flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
assert(ra.includes('no spanning-tree portfast') && ra.includes('no spanning-tree bpduguard enable') && ra.includes('no vlan 99') && ra.some((l) => /^no spanning-tree vlan 20,40,60,80,99 root$/.test(l)), 'annulations : PortFast, BPDU guard, racines, VLAN');

// 7. Cours, classement, aide-mémoire
const cours = K.COURS_PAR_ID.get('cisco-tp-pvst');
assert(!!cours && cours.parcours.length === 5 && cours.rappelCours?.questions?.length >= 5, 'cours « TP complet PVST+ » : cinq parcours et un résumé avec questions');
const refs = cours.parcours.flatMap((p) => p.items.flatMap((it) => it.refs));
assert(refs.length >= 25 && refs.every((r) => T.entreeParId(r.fiche)), 'chaque renvoi du parcours vise une fiche existante');
assert(refs.filter((r) => r.fiche === ID).every((r) => r.etape >= 1 && r.etape <= m0.etapes.length), 'chaque renvoi vers la fiche du TP vise une étape qui existe');
assert(cours.parcours.flatMap((p) => p.items).every((it) => it.refs.length || it.couvert === false), 'une étape sans fiche est déclarée « couvert: false »');
assert(cours.ambiguites.length >= 3, 'ambiguïtés de l’énoncé signalées (réseaux 172.17 / 172.31, PortFast en plage)');
const groupe = M.MEMO_PAR_ID.get('cisco-tp-pvst');
assert(groupe && M.SECTIONS_MEMO.find((s) => s.id === 'Cisco').groupes.includes('cisco-tp-pvst') && M.groupeDeFiche(ID)?.id === 'cisco-tp-pvst', 'aide-mémoire : groupe du TP dans la section Cisco');

console.log(`cisco-tp-pvst : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, matériel) : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
