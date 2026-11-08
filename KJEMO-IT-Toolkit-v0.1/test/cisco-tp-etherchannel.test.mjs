#!/usr/bin/env node
/**
 * cisco-tp-etherchannel.test.mjs — CISCO-TP-ETHERCHANNEL-01 · KJEMO IT Toolkit
 * Fiche PARAMÉTRÉE « TP complet : EtherChannel PAgP et LACP (S1, S2, S3) » : contrat, cinq phases, champs,
 * ORDRE (trunk statique, extinction, groupe, rallumage, port-channel), modes par commutateur,
 * annulations, parcours (références valides), classement, aide-mémoire.
 * CONTRE-ÉPREUVES : même port deux fois, groupe hors limites, mode d'un autre protocole, méthode de racine inconnue.
 * NE PROUVE PAS que les commandes fonctionnent dans Packet Tracer ou sur du matériel (NON EXÉCUTÉ).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const S = await imp('schemas-cisco.mjs'); const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const K = await imp('cours.mjs'); const M = await imp('memo.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const ID = 'cours-tp-etherchannel';
const fiche = T.entreeParId(ID).procedure;
const m0 = fiche.methodes[0];
const base = m0.etapes.filter((e) => !e.annulation);
const annul = m0.etapes.filter((e) => e.annulation);
const exemple = Object.fromEntries(fiche.params.map((x) => [x.id, x.exemple]));
const rendre = (saisies) => P.rendreMethode(m0, fiche.params, saisies).etapes.map((e, i) => ({ i: i + 1, bloque: !!e.rendu?.bloque, lignes: (e.rendu?.lignes ?? []).map((l) => l.copie), manquants: e.rendu?.manquants ?? [] }));
const R = rendre(exemple);
const toutes = R.slice(0, base.length).flatMap((x) => x.lignes);
const etapeLignes = (n) => R[n - 1].lignes;
const idx = (re, depuis = 0) => toutes.findIndex((l, i) => i >= depuis && re.test(l));
const compte = (re) => toutes.filter((l) => re.test(l)).length;

// 1. Contrat et forme
assert(P.incoherencesProcedure(fiche).length === 0, 'contrat de fiche respecté', P.incoherencesProcedure(fiche).join(' | '));
assert(fiche.titre.length <= 70, 'titre ≤ 70 caractères', String(fiche.titre.length));
assert(base.length === 17 && annul.length === 4, `17 étapes + 4 annulations (${base.length} + ${annul.length})`);
const phases = [...new Set(base.map((e) => e.phase).filter(Boolean))];
assert(phases.length === 5 && phases.every((p, i) => p.startsWith(`Phase ${i + 1} —`)), 'cinq phases numérotées dans l’ordre', phases.join(' | '));
assert(base.every((e) => e.explication.length >= 30 && e.attendu.length >= 20), 'chaque étape explique et dit ce qu’on doit voir');
assert(R.every((x) => !x.bloque && x.manquants.length === 0), 'toutes les étapes se rendent avec l’exemple, sans champ manquant');

// 2. Commandes des canaux
assert(toutes.includes('hostname S1') && toutes.includes('hostname S2') && toutes.includes('hostname S3'), 'noms S1, S2 et S3');
assert(etapeLignes(5).includes('channel-group 1 mode desirable') && etapeLignes(6).includes('channel-group 1 mode desirable'), 'canal 1 : desirable sur S1 et S3');
assert(etapeLignes(8).includes('channel-group 2 mode active') && etapeLignes(9).includes('channel-group 2 mode active'), 'canal 2 : active sur S1 et S2');
assert(etapeLignes(11).includes('channel-group 3 mode passive') && etapeLignes(12).includes('channel-group 3 mode active'), 'canal 3 : passive sur S2, active sur S3');
assert(etapeLignes(5).some((l) => /^interface range FastEthernet0\/21 , FastEthernet0\/22$/.test(l)), 'canal 1 : ports F0/21 et F0/22', etapeLignes(5).join(' | '));
assert(etapeLignes(8).some((l) => /^interface range GigabitEthernet0\/1 , GigabitEthernet0\/2$/.test(l)), 'canal 2 : ports G0/1 et G0/2');
assert(etapeLignes(11).some((l) => /^interface range FastEthernet0\/23 , FastEthernet0\/24$/.test(l)), 'canal 3 : ports F0/23 et F0/24');
for (const [n, g] of [[5, 1], [6, 1], [8, 2], [9, 2], [11, 3], [12, 3]]) {
  const l = etapeLignes(n);
  assert(l.includes(`interface port-channel ${g}`) && l.filter((x) => x === 'switchport mode trunk').length === 2, `étape ${n} : port-channel ${g} réglé en trunk, ports aussi`);
}
assert(compte(/^channel-group \d+ mode /) === 6, 'six channel-group : deux par canal');
assert(toutes.includes('spanning-tree vlan 1 root primary'), 'S1 racine du VLAN 1');
assert(toutes.filter((l) => /show etherchannel summary/.test(l)).length >= 4, 'vérifications du résumé EtherChannel');

// 3. Ordre dans chaque bloc et dans le TP
for (const n of [5, 6, 8, 9, 11, 12]) {
  const l = etapeLignes(n);
  const i = (re) => l.findIndex((x) => re.test(x));
  assert(i(/^switchport mode trunk$/) < i(/^shutdown$/) && i(/^shutdown$/) < i(/^channel-group/) && i(/^channel-group/) < i(/^no shutdown$/) && i(/^no shutdown$/) < i(/^interface port-channel/), `étape ${n} : trunk, shutdown, groupe, no shutdown, puis port-channel`);
}
assert(idx(/^show interfaces status$/) < idx(/^channel-group 1/), 'lecture de l’état des ports avant le premier canal');
assert(idx(/^channel-group 1/) < idx(/^channel-group 2/) && idx(/^channel-group 2/) < idx(/^channel-group 3/), 'canaux dans l’ordre 1, 2, 3');
assert(idx(/^channel-group 3/) < idx(/^spanning-tree vlan 1/), 'racine après les trois canaux');
assert(toutes.at(-1) === 'copy running-config startup-config', 'enregistrement en dernier');
assert(!base.some((e) => e.lignes.some((l) => l.secret)) && !JSON.stringify(fiche.params).match(/mot de passe|password|secret/i), 'aucun mot de passe en jeu');

// 4. Variantes : modes différents, autre numéro de groupe, priorité à la main
const v2 = rendre({ ...exemple, c1ModeS1: 'desirable', c1ModeS3: 'auto', c3Groupe: '5', methodeRacine: 'priority 24576' }).slice(0, base.length);
assert(v2[4].lignes.includes('channel-group 1 mode desirable') && v2[5].lignes.includes('channel-group 1 mode auto'), 'canal 1 : desirable d’un côté, auto de l’autre');
assert(v2[10].lignes.includes('channel-group 5 mode passive') && v2[10].lignes.includes('interface port-channel 5'), 'numéro de groupe modifiable');
assert(v2.flatMap((x) => x.lignes).includes('spanning-tree vlan 1 priority 24576'), 'racine par priorité 24576 possible');

// 5. Contre-épreuves
const val = (id, valeur) => P.validerParametre(fiche.params.find((x) => x.id === id), valeur).ok;
assert(val('c1Groupe', '1') === true && val('c1Groupe', '0') === false && val('c1Groupe', '7') === false, 'groupe de 1 à 6 seulement');
assert(val('c1ModeS1', 'active') === false && val('c2ModeS1', 'desirable') === false, 'un mode d’un autre protocole est refusé');
assert(val('c1ModeS1', 'auto') === true && val('c3ModeS2', 'passive') === true, 'modes valides acceptés');
assert(val('methodeRacine', 'root secondary') === false, 'méthode de racine inconnue refusée');
assert(!!P.evaluerValeurs(fiche.params, { ...exemple, c1PortB: 'Fa0/21' }).erreurs.c1PortA, 'le même port deux fois dans un canal est refusé');
assert(fiche.params.filter((x) => x.distinctDe).length === 6, 'six ports déclarés distincts deux à deux');

// 6. Annulations
assert(annul.every((e) => e.facultatif && ['modification', 'destructif', 'interruption'].includes(e.effet)), 'annulations facultatives et modifiantes');
const ra = P.rendreMethode(m0, fiche.params, exemple).etapes.slice(base.length).flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
assert(['no channel-group', 'no interface port-channel 1', 'no interface port-channel 2', 'no interface port-channel 3', 'no spanning-tree vlan 1 root'].every((c) => ra.includes(c)), 'annulations : groupes, port-channel et racine');

// 7. Cours, classement, aide-mémoire
const cours = K.COURS_PAR_ID.get('cisco-tp-etherchannel');
assert(!!cours && cours.parcours.length === 5 && cours.rappelCours?.questions?.length >= 5, 'cours « TP complet EtherChannel » : cinq parcours et un résumé avec questions');
const refs = cours.parcours.flatMap((p) => p.items.flatMap((it) => it.refs));
assert(refs.length >= 20 && refs.every((r) => T.entreeParId(r.fiche)), 'chaque renvoi du parcours vise une fiche existante');
assert(refs.filter((r) => r.fiche === ID).every((r) => r.etape >= 1 && r.etape <= m0.etapes.length), 'chaque renvoi vers la fiche du TP vise une étape qui existe');
assert(cours.parcours.flatMap((p) => p.items).every((it) => it.refs.length || it.couvert === false), 'une étape sans fiche est déclarée « couvert: false »');
assert(cours.ambiguites.length >= 3, 'ambiguïtés de l’énoncé signalées (tiret long, version de Packet Tracer)');
const groupe = M.MEMO_PAR_ID.get('cisco-tp-etherchannel');
assert(groupe && M.SECTIONS_MEMO.find((s) => s.id === 'Cisco').groupes.includes('cisco-tp-etherchannel') && M.groupeDeFiche(ID)?.id === 'cisco-tp-etherchannel', 'aide-mémoire : groupe du TP dans la section Cisco');

// 8. Schémas : chaque section de chaque résumé en porte au moins un
const IDS = ['tp-ec-topologie', 'tp-ec-topologie-swa', 'tp-ec-propose', 'tp-ec-propose-swa', 'tp-ec-correspondance', 'tp-ec-stp'];
for (const id of IDS) {
  const sc = S.SCHEMAS[id]; const svg = sc?.svg() ?? '';
  assert(!!sc && sc.titre.length >= 10 && sc.legende.length >= 40, `schéma ${id} : titre et légende`);
  assert(svg.includes('<title') && svg.includes('<desc') && svg.includes('role="img"') && !/<(image|script|a )/i.test(svg), `schéma ${id} : titre, texte alternatif, pas d’image ni de script`);
}
const topoS = S.SCHEMAS['tp-ec-topologie'].svg(); const topoA = S.SCHEMAS['tp-ec-topologie-swa'].svg();
assert(['S1', 'S2', 'S3', 'PAgP', 'LACP', 'Fa0/21', 'Gi0/1', 'Fa0/23', 'desirable', 'passive'].every((t) => topoS.includes(t)), 'topologie S1, S2, S3 : noms, protocoles, ports et modes');
assert(['SWA', 'SWB', 'SWC', 'Gi0/1', 'Fa0/21', 'Fa0/23', 'sauvegarde', 'passive'].every((t) => topoA.includes(t)) && !topoA.includes('>S1<'), 'topologie SWA, SWB, SWC : noms, ports, sauvegarde');
const corr = S.SCHEMAS['tp-ec-correspondance'].svg();
assert(['SWA', 'S1', 'SWC', 'S2', 'SWB', 'S3', 'passive'].every((t) => corr.includes(t)), 'correspondance : SWA = S1, SWC = S2, SWB = S3');
assert(S.SCHEMAS['tp-ec-stp'].svg().includes('BLK') && S.SCHEMAS['tp-ec-stp'].svg().includes('racine'), 'schéma Spanning Tree : état bloqué et racine');
assert(fiche.figures.every((x) => S.IDS_SCHEMAS.includes(x)) && IDS.every((x) => fiche.figures.includes(x) || x === 'tp-ec-propose-swa'), 'la fiche affiche ses schémas (tous connus)');
const sansSchema = (c) => c.rappelCours.sections.filter((x) => !(x.schemas ?? []).length).map((x) => x.id);
assert(sansSchema(cours).length === 0, 'résumé S1, S2, S3 : chaque section porte un schéma', sansSchema(cours).join());

// 9. Parcours « Implémenter EtherChannel (SWA, SWB, SWC) »
const swa = K.COURS_PAR_ID.get('cisco-tp-etherchannel-swa');
assert(!!swa && swa.parcours.length === 5 && swa.rappelCours?.questions?.length >= 5 && sansSchema(swa).length === 0, 'cours SWA, SWB, SWC : cinq parcours, résumé illustré section par section', sansSchema(swa).join());
const refsA = swa.parcours.flatMap((p) => p.items.flatMap((it) => it.refs));
assert(refsA.length >= 14 && refsA.every((r) => T.entreeParId(r.fiche)) && refsA.filter((r) => r.fiche === ID).every((r) => r.etape >= 1 && r.etape <= m0.etapes.length), 'chaque renvoi du parcours SWA vise une fiche et une étape qui existent');
assert(swa.parcours.flatMap((p) => p.items).every((it) => it.refs.length || it.couvert === false), 'une étape sans fiche est déclarée « couvert: false »');
assert(swa.parcours[0].items.filter((it) => it.couvert === false).length === 3, 'la construction de la topologie (3 étapes) est déclarée non couverte');
assert(swa.ambiguites.length >= 3, 'ambiguïtés du script SWA (finir, extinction, tableau)');
assert(swa.rappelCours.sections.some((x) => x.schemas.includes('tp-ec-correspondance')) && swa.rappelCours.sections.some((x) => x.schemas.includes('tp-ec-topologie-swa')) && swa.rappelCours.sections.some((x) => x.schemas.includes('tp-ec-propose-swa')), 'résumé SWA : topologie, qui propose et correspondance des noms');
// La fiche, remplie avec les valeurs du prof, redonne le script de réponse (SWA = S1, SWC = S2, SWB = S3).
const prof = { ...exemple, hoteS1: 'SWA', hoteS2: 'SWC', hoteS3: 'SWB', c1PortA: 'Gi0/1', c1PortB: 'Gi0/2', c1ModeS1: 'desirable', c1ModeS3: 'desirable', c2PortA: 'Fa0/21', c2PortB: 'Fa0/22', c2ModeS1: 'active', c2ModeS2: 'active', c3PortA: 'Fa0/23', c3PortB: 'Fa0/24', c3ModeS2: 'active', c3ModeS3: 'passive' };
assert(Object.keys(P.evaluerValeurs(fiche.params, prof).erreurs).length === 0, 'valeurs du prof (SWA, SWB, SWC) acceptées sans erreur');
const RP = rendre(prof).slice(0, base.length);
const lg = (n) => RP[n - 1].lignes;
assert(lg(1).includes('hostname SWA') && lg(2).includes('hostname SWC') && lg(3).includes('hostname SWB'), 'noms d’hôte SWA, SWC, SWB dans l’ordre de la fiche');
assert(lg(5).some((l) => /GigabitEthernet0\/1 , GigabitEthernet0\/2$/.test(l)) && lg(5).includes('channel-group 1 mode desirable') && lg(6).includes('channel-group 1 mode desirable'), 'canal 1 SWA–SWB : Gi0/1 et Gi0/2, desirable des deux côtés');
assert(lg(8).includes('channel-group 2 mode active') && lg(9).includes('channel-group 2 mode active') && lg(8).some((l) => /FastEthernet0\/21 , FastEthernet0\/22$/.test(l)), 'canal 2 SWA–SWC : Fa0/21 et Fa0/22, active des deux côtés');
assert(lg(11).includes('channel-group 3 mode active') && lg(12).includes('channel-group 3 mode passive') && lg(11).some((l) => /FastEthernet0\/23 , FastEthernet0\/24$/.test(l)), 'canal 3 : SWC (S2) en active, SWB (S3) en passive');
assert(!RP.flatMap((x) => x.lignes).some((l) => /^finir$/.test(l)), 'jamais la fausse commande « finir »');

console.log(`cisco-tp-etherchannel : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, matériel) : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
