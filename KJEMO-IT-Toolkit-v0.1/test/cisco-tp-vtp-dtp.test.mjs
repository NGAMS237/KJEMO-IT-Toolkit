#!/usr/bin/env node
/**
 * cisco-tp-vtp-dtp.test.mjs — CISCO-TP-VTP-DTP-01 · KJEMO IT Toolkit
 * Fiche PARAMÉTRÉE « TP complet : VTP et DTP (DS1, AS1, AS2) » (formatif 6) : contrat, cinq phases,
 * champs (noms, ports, modes, domaine, version, tableau de VLAN), ORDRE (trunks avant VTP, domaine
 * avant les VLAN, mot de passe en dernière ligne de son étape), aucun mot de passe écrit,
 * annulations, parcours (références valides), classement, aide-mémoire.
 * CONTRE-ÉPREUVES : un VLAN réservé, un VLAN en double, un nom de domaine avec espace, un mode
 * inconnu DOIVENT être refusés.
 * NE PROUVE PAS que les commandes fonctionnent dans Packet Tracer ou sur du matériel (NON EXÉCUTÉ).
 * Usage : node test/cisco-tp-vtp-dtp.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const K = await imp('cours.mjs'); const M = await imp('memo.mjs');
const { COURS_CISCO_TP_VTP_DTP } = await imp('cours-fiches-cisco-tp-vtp-dtp.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const ID = 'cours-tp-vtp-dtp';
const fiche = T.entreeParId(ID).procedure;
const m0 = fiche.methodes[0];
const base = m0.etapes.filter((e) => !e.annulation);
const annul = m0.etapes.filter((e) => e.annulation);
const exemple = Object.fromEntries(fiche.params.map((x) => [x.id, x.exemple]));
const rendre = (saisies) => P.rendreMethode(m0, fiche.params, saisies).etapes.map((e, i) => ({ i: i + 1, bloque: !!e.rendu?.bloque, lignes: (e.rendu?.lignes ?? []).map((l) => l.copie), manquants: e.rendu?.manquants ?? [] }));
const R = rendre(exemple);
const toutes = R.slice(0, base.length).flatMap((x) => x.lignes);
const idx = (re) => toutes.findIndex((l) => re.test(l));

// 1. Contrat et forme -------------------------------------------------------------------
assert(P.incoherencesProcedure(fiche).length === 0, 'contrat de fiche respecté', P.incoherencesProcedure(fiche).join(' | '));
assert(COURS_CISCO_TP_VTP_DTP.length === 1 && fiche.titre.length <= 70, 'une fiche, titre ≤ 70 caractères');
assert(base.length === 16 && annul.length === 5, `16 étapes + 5 annulations (${base.length} + ${annul.length})`);
const phases = [...new Set(base.map((e) => e.phase).filter(Boolean))];
assert(phases.length === 5 && phases.every((p, i) => p.startsWith(`Phase ${i + 1} —`)), 'cinq phases numérotées dans l’ordre', phases.join(' | '));
assert(base.every((e) => e.explication.length >= 40 && e.attendu.length >= 20), 'chaque étape explique et dit ce qu’on doit voir');
assert(R.every((x) => !x.bloque && x.manquants.length === 0), 'toutes les étapes se rendent avec l’exemple, sans champ manquant');

// 2. Commandes et ordre ------------------------------------------------------------------
assert(idx(/^switchport mode dynamic desirable$/) >= 0 && toutes.filter((l) => l === 'switchport mode dynamic desirable').length === 2, 'DS1 : dynamic desirable sur les deux ports');
assert(toutes.filter((l) => l === 'switchport mode dynamic auto').length === 2, 'AS1 et AS2 : dynamic auto');
assert(toutes.some((l) => /^interface Fast\w*0\/7$/.test(l)) && toutes.some((l) => /^interface Fast\w*0\/9$/.test(l)), 'ports F0/7 et F0/9 de l’énoncé', toutes.filter((l) => /^interface/.test(l)).join(' | '));
assert(toutes.includes('vtp mode server') && toutes.filter((l) => l === 'vtp mode client').length === 2, 'un serveur et deux clients VTP');
assert(toutes.filter((l) => l === 'vtp domain CCNA-LAB').length === 3 && toutes.filter((l) => l === 'vtp version 2').length === 3, 'domaine et version identiques sur les trois');
for (const v of [10, 20, 30, 40, 50]) assert(toutes.includes(`vlan ${v}`) && toutes.includes(`name VLAN${v}`), `VLAN ${v} créé et nommé`);
assert(idx(/^switchport mode dynamic desirable$/) < idx(/^vtp mode server$/), 'les trunks (DTP) avant VTP');
assert(idx(/^vtp domain /) < idx(/^vlan 10$/), 'le domaine avant la création des VLAN');
assert(toutes.indexOf('vtp mode server') < toutes.indexOf('vtp mode client'), 'le serveur avant les clients');

// 3. Mot de passe : jamais écrit ----------------------------------------------------------
const secretes = base.flatMap((e) => e.lignes.map((l, k) => ({ e, l, k })).filter((x) => x.l.secret));
assert(secretes.length === 3 && secretes.every((x) => x.k === x.e.lignes.length - 1 && /password$/.test(x.l.cmd)), 'trois lignes « vtp password » incomplètes, dernières de leur étape');
assert(!JSON.stringify(fiche).match(/cisco12345/i) && m0.etapes.every((e) => e.lignes.every((l) => !/password\s+\S/.test(l.cmd))), 'aucun mot de passe VTP dans la fiche ni dans ses lignes');
assert(!toutes.some((l) => /password\s+\S/.test(l)), 'aucun mot de passe dans les commandes rendues');

// 4. Contre-épreuves -----------------------------------------------------------------------
const ev = (saisies) => P.evaluerValeurs(fiche.params, { ...exemple, ...saisies });
const tableOk = (lignes) => ev({ vlans: lignes }).tables.vlans.ok;
assert(tableOk(exemple.vlans) === true, 'tableau de l’exemple accepté');
assert(tableOk([{ vlan: '1003', nom: 'X' }]) === false, 'VLAN réservé 1003 refusé');
assert(tableOk([{ vlan: '10', nom: 'A' }, { vlan: '10', nom: 'B' }]) === false, 'VLAN en double refusé');
assert(P.validerParametre(fiche.params.find((x) => x.id === 'domaine'), 'CCNA LAB').ok === false, 'domaine avec espace refusé');
assert(P.validerParametre(fiche.params.find((x) => x.id === 'modeDs'), 'access').ok === false, 'mode DS1 inconnu refusé');
const trunkFixe = rendre({ ...exemple, modeDs: 'trunk', modeAs: 'trunk' }).slice(0, base.length).flatMap((x) => x.lignes);
assert(trunkFixe.filter((l) => l === 'switchport mode trunk').length === 4 && !trunkFixe.includes('switchport mode dynamic desirable'), 'mode « trunk » fixe : quatre ports en trunk');

// 5. Annulations --------------------------------------------------------------------------
assert(annul.every((e) => e.facultatif && ['modification', 'destructif', 'interruption'].includes(e.effet)), 'annulations facultatives et modifiantes');
const ra = P.rendreMethode(m0, fiche.params, exemple).etapes.slice(base.length).flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
assert(ra.includes('vtp mode transparent') && ra.includes('no vtp password') && ra.includes('no vlan 50'), 'annulations : transparent, sans mot de passe, VLAN retirés');

// 6. Cours, classement, aide-mémoire --------------------------------------------------------
const cours = K.COURS_PAR_ID.get('cisco-tp-vtp-dtp');
assert(!!cours && cours.parcours.length === 5 && cours.rappelCours?.questions?.length >= 5, 'cours « TP complet VTP et DTP » : cinq parcours et un résumé avec questions');
const refs = cours.parcours.flatMap((p) => p.items.flatMap((it) => it.refs));
const ficheDe = (id) => T.entreeParId(id)?.procedure;
assert(refs.length >= 15 && refs.every((r) => ficheDe(r.fiche)), 'chaque renvoi du parcours vise une fiche existante');
assert(refs.filter((r) => r.fiche === ID).every((r) => r.etape >= 1 && r.etape <= m0.etapes.length), 'chaque renvoi vers la fiche du TP vise une étape qui existe');
assert(cours.parcours.flatMap((p) => p.items).every((it) => it.refs.length || it.couvert === false), 'une étape sans fiche est déclarée « couvert: false »');
const groupe = M.MEMO_PAR_ID.get('cisco-tp-vtp-dtp');
assert(groupe && M.SECTIONS_MEMO.find((s) => s.id === 'Cisco').groupes.includes('cisco-tp-vtp-dtp') && M.groupeDeFiche(ID)?.id === 'cisco-tp-vtp-dtp', 'aide-mémoire : groupe du TP dans la section Cisco');

console.log(`cisco-tp-vtp-dtp : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, matériel) : NON EXÉCUTÉE.');
process.exit(failed ? 1 : 0);
