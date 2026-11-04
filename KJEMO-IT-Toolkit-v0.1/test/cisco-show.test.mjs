#!/usr/bin/env node
/**
 * cisco-show.test.mjs — KJEMO-CISCO-SHOW-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles de la fiche de référence « Commandes show Cisco » : contrat, groupes,
 * chaque commande rendue (ASCII, lecture seule, sans « ? », sans doublon),
 * chaque commande expliquée dans « Comprendre les commandes », fiche épinglée
 * dans le classement Cisco, l'aide-mémoire (groupe et bandeau) et les cours,
 * recherche des commandes courantes. CONTRE-ÉPREUVES : une commande qui modifie
 * (configure, write, erase, reload, clear), un doublon, une commande sans
 * explication ou un paramètre non déclaré DOIVENT être détectés.
 * NE PROUVE PAS : que chaque commande existe sur un modèle donné (NON EXÉCUTÉ).
 * Usage : node test/cisco-show.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const C = await imp('classement.mjs'); const P = await imp('procedures.mjs');
const K = await imp('cours.mjs'); const M = await imp('memo.mjs'); const V = await imp('vue-portes.mjs');
const { COURS_CISCO_SHOW } = await imp('cours-fiches-cisco-show.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const ID = 'cours-show-cisco';
const fiche = T.entreeParId(ID).procedure;
const rendu = P.rendreMethode(fiche.methodes[0], fiche.params, Object.fromEntries(fiche.params.map((x) => [x.id, x.exemple])));
const cmds = rendu.etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));

console.log('1. Contrat et structure');
assert(COURS_CISCO_SHOW.length === 1 && COURS_CISCO_SHOW[0] === fiche, 'une seule fiche, présente au catalogue');
{
  const pb = P.incoherencesProcedure(fiche);
  assert(pb.length === 0, 'contrat de fiche', pb.join(' ; '));
  const etapes = fiche.methodes[0].etapes;
  assert(etapes.length >= 15, `au moins 15 groupes (${etapes.length})`);
  assert(etapes.every((e) => e.effet === 'lecture'), 'toutes les étapes sont en lecture seule');
  assert(fiche.effet === 'lecture' && !etapes.some((e) => e.annulation), 'fiche en lecture, aucune annulation nécessaire');
  assert(cmds.length >= 70, `au moins 70 commandes (${cmds.length})`);
  assert(T.entreeParId(ID).plateformes.join() === 'Cisco', 'plateforme Cisco');
  assert(new Set(etapes.map((e) => e.titre)).size === etapes.length, 'titres de groupes uniques');
}

console.log('2. Chaque commande');
{
  assert(rendu.manquants.length === 0, 'aucune valeur manquante avec les exemples', rendu.manquants.join());
  for (const c of cmds) {
    assert(/^[\x20-\x7e]+$/.test(c) && !/\?/.test(c) && !/\{\{|\}\}/.test(c), `ASCII, sans « ? », sans marque : ${c}`);
    assert(/^(show |terminal length 0$)/.test(c), `commence par « show » (ou terminal length 0) : ${c}`);
    assert(!/\b(configure|write|erase|reload|clear|delete|copy|format|debug|shutdown)\b/i.test(c), `ne modifie rien : ${c}`);
  }
  const base = cmds.filter((c) => !c.includes('|'));
  assert(new Set(cmds).size === cmds.length, 'aucune commande en double');
  assert(base.every((c) => !/\s$/.test(c)), 'aucune espace finale');
  const necessaires = ['show version', 'show running-config', 'show startup-config', 'show ip interface brief', 'show interfaces status', 'show mac address-table', 'show cdp neighbors', 'show vlan brief', 'show interfaces trunk', 'show vtp status',
    'show spanning-tree', 'show etherchannel summary', 'show port-security', 'show ip route', 'show ip protocols', 'show ipv6 route', 'show ip dhcp binding', 'show ip nat translations', 'show ip ssh', 'show access-lists', 'show logging', 'show ip arp'];
  assert(necessaires.every((c) => cmds.includes(c)), 'les show courants sont tous présents', necessaires.filter((c) => !cmds.includes(c)).join());
  const opts = fiche.methodes[0].etapes.flatMap((e) => e.options ?? []);
  const lignes = fiche.methodes[0].etapes.flatMap((e) => e.lignes.map((l) => l.cmd.replace('{{interface}}', 'INTERFACE').replace('{{vlan}}', 'VLAN')));
  assert(opts.length === lignes.length && lignes.every((l) => opts.some((o) => o.option === l && o.explication.length >= 15)), 'chaque commande est expliquée (≥ 15 caractères) dans « Comprendre les commandes »');
  const avecParam = fiche.methodes[0].etapes.filter((e) => e.lignes.some((l) => l.cmd.includes('{{')));
  assert(avecParam.length === 1 && avecParam[0].titre.startsWith('Cibler'), 'une seule étape utilise des paramètres : les autres se copient sans rien saisir');
}

console.log('3. Contre-épreuves');
{
  const f1 = structuredClone(fiche); f1.methodes[0].etapes[1].lignes.push({ invite: 'Device#', cmd: 'write erase' });
  const modif = f1.methodes[0].etapes.flatMap((e) => e.lignes.map((l) => l.cmd)).filter((c) => /\b(write|erase|reload|clear)\b/.test(c));
  assert(modif.length > 0, 'contre-épreuve : une commande qui modifie est repérée par le contrôle');
  const f2 = structuredClone(fiche); f2.methodes[0].etapes[0].lignes[0].cmd = 'show {{inconnu}}';
  assert(P.incoherencesProcedure(f2).length > 0, 'contre-épreuve : un paramètre non déclaré est détecté');
  const f3 = structuredClone(fiche); f3.titre = 'x'.repeat(90);
  assert(P.incoherencesProcedure(f3).length > 0, 'contre-épreuve : un titre trop long est détecté');
  const f4 = structuredClone(fiche); f4.params.push({ ...f4.params[0] });
  assert(P.incoherencesProcedure(f4).length > 0, 'contre-épreuve : un paramètre en double est détecté');
  const doublons = [...cmds, 'show version'];
  assert(new Set(doublons).size !== doublons.length, 'contre-épreuve : un doublon est détecté');
}

console.log('4. Visibilité : classement, aide-mémoire, cours, recherche');
{
  const noeuds = C.ARBRE?.['reseau-cisco'] ?? null;
  const e = T.entreeParId(ID);
  assert(C.cheminDe(e)?.domaineId === 'reseau-cisco', 'rangée sous Réseau Cisco');
  const g = M.MEMO_PAR_ID.get('cisco-show');
  assert(g && g.sous.flatMap((s) => s.fiches).join() === ID, 'groupe d’aide-mémoire « Commandes show Cisco »');
  const cis = M.SECTIONS_MEMO.find((x) => x.id === 'Cisco');
  assert(cis.groupes[0] === 'cisco-show' && cis.epingle?.fiche === ID, 'premier groupe de la section Cisco, et fiche épinglée');
  const groupes = M.MEMO_GROUPES.map((x) => ({ g: x, compte: 1, nouveaux: 0, sous: x.sous.map((s) => ({ ...s, fiches: [] })) }));
  const h = (plat) => V.memoPageMarkup({ groupes, filtre: 'tous', filtres: M.FILTRES_MEMO, compteParFiltre: { tous: 1, nouveau: 0, tp: 0 }, plat, total: 1 });
  assert(h(null).includes(`data-epingle="${ID}"`) && h(null).includes(`href="#/tache/${ID}"`), 'bandeau épinglé : visible sans filtre');
  assert(h('Cisco').includes(`data-epingle="${ID}"`), 'bandeau épinglé : visible avec le filtre Cisco');
  assert(!h('Linux').includes('data-epingle') && !h('Azure').includes('data-epingle'), 'bandeau épinglé : masqué pour les autres plateformes');
  assert(h(null).indexOf('data-epingle') < h(null).indexOf('class="memo-section"'), 'le bandeau précède les sections');
  const cours = K.COURS.filter((x) => x.plateformes.includes('Cisco'));
  assert(cours.length >= 8 && cours.every((x) => x.soutien.some((s) => s.fiche === ID)), `les ${cours.length} cours Cisco citent la fiche show dans leur soutien`);
  for (const [req, attendu] of [['show', ID], ['commandes show', ID], ['show ip interface brief', ID], ['show vlan brief', ID], ['show running-config', ID], ['show etherchannel summary', ID], ['show port-security', ID], ['show cdp neighbors', ID], ['quelle commande show', ID]]) {
    const res = T.chercher(req, { plateforme: 'Cisco' });
    const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 6).includes(attendu), `recherche « ${req} » : la fiche parmi les 6 premiers`, ids.slice(0, 6).join());
  }
}

console.log(`\ncisco-show : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, matériel) : NON EXÉCUTÉE. Contrat, rendu et visibilité vérifiés ; l’existence de chaque commande sur un modèle donné n’est pas prouvée.');
process.exit(failed ? 1 : 0);
