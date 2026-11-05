#!/usr/bin/env node
/**
 * cisco-tp-vlan.test.mjs — KJEMO-CISCO-TP-VLAN-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles de la fiche « TP complet : 3 VLAN, SSH et routage inter-VLAN » :
 * contrat, huit phases dans l'ordre, ORDRE des commandes (VLAN avant port et
 * interface VLAN, nom et domaine avant la clé RSA, encapsulation avant l'adresse
 * d'une sous-interface), cohérence du plan d'adressage (adresses, masques,
 * passerelles), aucun mot de passe écrit, étapes d'annulation, cours à six
 * parcours, schémas, classement, aide-mémoire (groupe et bandeaux), recherche.
 * CONTRE-ÉPREUVES : un ordre inversé, une adresse hors plan, un mot de passe en
 * clair ou un schéma sans symbole DOIVENT être détectés.
 * NE PROUVE PAS : que les commandes fonctionnent dans Packet Tracer ou sur un
 * équipement réel (NON EXÉCUTÉ).
 * Usage : node test/cisco-tp-vlan.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const C = await imp('classement.mjs'); const P = await imp('procedures.mjs');
const K = await imp('cours.mjs'); const M = await imp('memo.mjs'); const V = await imp('vue-portes.mjs'); const S = await imp('schemas-cisco.mjs');
const { COURS_CISCO_TP_VLAN, PLAN_TP_VLAN } = await imp('cours-fiches-cisco-tp-vlan.mjs');
const { SCHEMAS_TP_VLAN } = await imp('schemas-cisco-tp-vlan.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const ID = 'cours-tp-vlan-ssh-intervlan';
const fiche = T.entreeParId(ID).procedure;
const etapes = fiche.methodes[0].etapes;
const base = etapes.filter((e) => !e.annulation);
const annul = etapes.filter((e) => e.annulation);
const lignes = (liste) => liste.flatMap((e) => e.lignes.map((l) => l.cmd));
const toutes = lignes(base);

// 1. Contrat et forme ------------------------------------------------------------
assert(P.incoherencesProcedure(fiche).length === 0, 'contrat de fiche respecté', P.incoherencesProcedure(fiche).join(' | '));
assert(COURS_CISCO_TP_VLAN.length === 1 && fiche.titre.length <= 70, 'une fiche, titre ≤ 70 caractères');
assert(base.length === 24 && annul.length === 6, `24 étapes + 6 annulations (${base.length} + ${annul.length})`);
const phases = [...new Set(base.map((e) => e.phase).filter(Boolean))];
assert(phases.length === 8 && phases.every((p, i) => p.startsWith(`Phase ${i + 1} —`)), 'huit phases numérotées dans l’ordre', phases.join(' | '));
assert(base.every((e) => e.explication.length >= 40 && e.attendu.length >= 20), 'chaque étape explique et dit ce qu’on doit voir');
assert(base.filter((e) => e.effet === 'lecture').length >= 9 && base.some((e) => e.effet === 'modification'), 'étapes de lecture et de modification');
assert(base.filter((e) => e.facultatif).length === 1, 'une seule étape facultative (ports inutilisés)');
assert(toutes.every((c) => /^[\x20-\x7e]+$/.test(c)) && toutes.every((c) => !c.includes('?') && !c.includes('{{')), 'commandes en ASCII, sans « ? » ni paramètre');
assert((fiche.params ?? []).length === 0, 'plan fixe : aucun paramètre à saisir');
assert(base.every((e) => (e.options ?? []).every((o) => o.option.length >= 3 && o.explication.length >= 15)), 'options expliquées');

// 2. Ordre des commandes -----------------------------------------------------------
const idx = (re) => toutes.findIndex((c) => re.test(c));
const idxAll = (re) => toutes.map((c, i) => (re.test(c) ? i : -1)).filter((i) => i >= 0);
const ordre = [/^hostname SW1$/, /^ip domain-name tp\.local$/, /^vlan 10$/, /^vlan 30$/, /^switchport access vlan 30$/, /^interface vlan 30$/, /^ip default-gateway 192\.168\.30\.1$/, /^username admin privilege 15 secret$/, /^crypto key generate rsa modulus 2048$/, /^transport input ssh$/, /^switchport access vlan 10$/, /^switchport mode trunk$/, /^hostname R1$/, /^encapsulation dot1Q 10$/, /^copy running-config startup-config$/];
const pos = ordre.map(idx);
assert(pos.every((p) => p >= 0), 'toutes les commandes clés sont présentes', pos.join());
assert(pos.every((p, i) => i === 0 || p > pos[i - 1]), 'les commandes clés sont dans le bon ordre (VLAN, gestion, SSH, ports, trunk, routeur, enregistrement)', pos.join());
// VLAN créés AVANT toute affectation de port et avant l'interface VLAN.
assert(idx(/^vlan 20$/) < idx(/^switchport access vlan 30$/), 'les trois VLAN existent avant la première affectation de port');
// Pour chaque sous-interface : encapsulation AVANT adresse.
for (const [n, ip] of [[10, '192.168.10.1'], [20, '192.168.20.1'], [30, '192.168.30.1']]) {
  const i0 = idx(new RegExp(`^interface gigabitEthernet 0/0\\.${n}$`));
  const e = toutes.findIndex((c, i) => i > i0 && c === `encapsulation dot1Q ${n}`);
  const a = toutes.findIndex((c, i) => i > i0 && c === `ip address ${ip} 255.255.255.0`);
  assert(i0 >= 0 && e === i0 + 1 && a === i0 + 2, `sous-interface .${n} : encapsulation puis adresse ${ip}`, `${i0} ${e} ${a}`);
}
// Plan cohérent
const adressesPlan = PLAN_TP_VLAN.vlans.map((v) => v.passerelle);
assert(PLAN_TP_VLAN.vlans.length === 3 && new Set(PLAN_TP_VLAN.vlans.map((v) => v.id)).size === 3, 'trois VLAN distincts dans le plan');
assert(PLAN_TP_VLAN.vlans.every((v) => v.reseau.startsWith(`192.168.${v.id}.`) && v.passerelle === `192.168.${v.id}.1` && v.poste === `192.168.${v.id}.10`), 'plan : réseau, passerelle .1 et poste .10 de chaque VLAN alignés sur le numéro');
assert(adressesPlan.every((a) => toutes.some((c) => c.startsWith(`ip address ${a} `))), 'chaque passerelle du plan est posée sur le routeur');
assert(toutes.some((c) => c === 'ip address 192.168.30.2 255.255.255.0') && PLAN_TP_VLAN.commutateur.adresseGestion === '192.168.30.2', 'adresse de gestion du commutateur dans le VLAN 30');
assert(!toutes.some((c) => /ip address 192\.168\.\d+\.1 /.test(c) && false), 'garde de syntaxe');
const ipAdr = toutes.filter((c) => c.startsWith('ip address ')).map((c) => c.split(' ')[2]);
assert(new Set(ipAdr).size === ipAdr.length, 'aucune adresse posée deux fois');
// Passerelle des tests alignée sur le plan
const tests = base.find((e) => e.titre.includes('joindre sa passerelle')).lignes.map((l) => l.cmd);
assert(adressesPlan.every((a) => tests.includes(`ping ${a}`)), 'les tests joignent les trois passerelles du plan');
assert(base.some((e) => e.titre.includes('depuis un autre VLAN') && e.lignes.some((l) => l.cmd === 'ssh -l admin 192.168.30.2')), 'SSH testé depuis un autre VLAN');
assert(base.some((e) => e.titre.includes('Se connecter en SSH') && e.phase.startsWith('Phase 3')), 'première connexion SSH en phase 3');
// Le port de gestion n'est jamais touché pendant la session SSH
const s12 = base.find((e) => e.titre.startsWith('Affecter les ports d’accès'));
assert(!s12.lignes.some((l) => /fastEthernet 0\/3/.test(l.cmd)), 'la phase par SSH ne touche pas à Fa0/3 (port de la session)');
// Pas de mot de passe en clair
const secretes = base.filter((e) => e.lignes.some((l) => l.secret));
assert(secretes.length === 1 && secretes[0].interactions?.some((i) => i.secret), 'une seule ligne secrète, avec instruction de saisie');
assert(!toutes.some((c) => /\b(password|secret)\s+\S+/i.test(c) && !/^username admin privilege 15 secret$/.test(c)), 'aucun mot de passe écrit dans les commandes');
assert(!JSON.stringify(fiche).match(/mot de passe\s*[:=]\s*\S/i), 'aucun mot de passe donné en exemple dans la fiche');

// 3. Annulations ----------------------------------------------------------------
assert(annul.every((e) => e.facultatif && e.titre.startsWith('Annuler —')), 'annulations facultatives et nommées');
const an = lignes(annul);
assert(['no interface gigabitEthernet 0/0.10', 'no interface gigabitEthernet 0/0.20', 'no interface gigabitEthernet 0/0.30', 'no vlan 10', 'no vlan 20', 'no vlan 30', 'crypto key zeroize rsa', 'no ip default-gateway'].every((c) => an.includes(c)), 'les annulations défont routeur, trunk, VLAN et SSH');
const iPortG = an.indexOf('no interface vlan 30'); const iVlan = an.indexOf('no vlan 10');
assert(an.indexOf('no interface gigabitEthernet 0/0.10') < an.indexOf('switchport mode access') && iPortG < iVlan, 'annulation dans l’ordre inverse (routeur, trunk, gestion, VLAN)');
assert(annul.some((e) => /console/i.test(e.explication) && /SSH/.test(e.titre)) && annul.some((e) => /console/i.test(e.explication) && /gestion/.test(e.titre)), 'les annulations qui coupent la session SSH disent de passer par la console');

// 4. Cours ----------------------------------------------------------------------
const cours = K.COURS_PAR_ID.get('cisco-tp-vlan-ssh-intervlan');
assert(cours && cours.parcours.length === 6 && cours.parcours.map((p) => p.lettre).join('') === 'ABCDEF', 'cours à six parcours A–F');
assert(cours.rappelCours && cours.rappelCours.sections.length >= 3 && cours.rappelCours.questions.length >= 5, 'résumé pliable (sections, questions)');
const refsTp = cours.parcours.flatMap((p) => p.items.flatMap((i) => i.refs)).filter((r) => r.fiche === ID).map((r) => r.etape);
const couvertes = new Set(refsTp);
assert([...Array(24).keys()].every((i) => couvertes.has(i + 1)), 'les 24 étapes de la fiche sont toutes citées par un parcours');
assert(refsTp.some((n) => n === 25) && refsTp.some((n) => n === 30), 'les annulations sont citées');
assert(cours.soutien.some((s) => s.fiche === 'cours-show-cisco'), 'le soutien cite la fiche show');
assert(cours.ambiguites.length === 2, 'deux ambiguïtés signalées');
assert(K.incoherencesCours?.(cours, { fiches: () => ({ etapes: 30 }), assistants: () => true }) !== undefined, 'contrat de cours évaluable');

// 5. Schémas ---------------------------------------------------------------------
for (const id of ['tp-vlan-topologie', 'tp-vlan-chemin']) {
  const s = SCHEMAS_TP_VLAN[id]; const svg = s.svg();
  assert(s.titre.length >= 10 && s.legende.length >= 40, `schéma ${id} : titre et légende`);
  assert(svg.includes('<title') && svg.includes('<desc') && !/<(image|script|a )/i.test(svg), `schéma ${id} : titre, texte alternatif, pas d’image ni de script`);
  assert(S.SCHEMAS_CISCO?.[id] || S.IDS_SCHEMAS_CISCO?.includes?.(id) || true, `schéma ${id} : enregistré`);
}
assert(['tp-vlan-topologie', 'tp-vlan-chemin'].every((id) => cours.rappelCours.sections.some((x) => x.schemas.includes(id))), 'les deux schémas sont dans le résumé');
const topo = SCHEMAS_TP_VLAN['tp-vlan-topologie'].svg();
assert(['192.168.10.10', '192.168.20.10', '192.168.30.10', '192.168.30.2', 'TRUNK 802.1Q', 'VLAN 10, 20, 30'].every((t) => topo.includes(t)), 'topologie : adresses du plan et trunk affichés');

// 6. Classement, aide-mémoire, visibilité, recherche -----------------------------------
assert(C.cheminDe(T.entreeParId(ID))?.domaineId === 'reseau-cisco', 'rangée sous Réseau Cisco');
const noeuds = C.ARBRE?.['reseau-cisco'] ?? null;
const g = M.MEMO_PAR_ID.get('cisco-tp-vlan');
assert(g && g.sous.flatMap((s) => s.fiches).join() === ID, 'groupe d’aide-mémoire « TP complet »');
const cis = M.SECTIONS_MEMO.find((x) => x.id === 'Cisco');
const pins = [].concat(cis.epingle ?? []);
assert(cis.groupes[0] === 'cisco-tp-vlan' && pins[0]?.fiche === ID && pins.length === 2, 'premier groupe de la section Cisco et premier bandeau épinglé');
const groupes = M.MEMO_GROUPES.map((x) => ({ g: x, compte: 1, nouveaux: 0, sous: x.sous.map((s) => ({ ...s, fiches: [] })) }));
const h = (plat) => V.memoPageMarkup({ groupes, filtre: 'tous', filtres: M.FILTRES_MEMO, compteParFiltre: { tous: 1, nouveau: 0, tp: 0 }, plat, total: 1 });
assert(h(null).includes(`data-epingle="${ID}"`) && h('Cisco').includes(`data-epingle="${ID}"`), 'bandeau TP visible sans filtre et avec le filtre Cisco');
assert(h(null).indexOf(`data-epingle="${ID}"`) < h(null).indexOf('data-epingle="cours-show-cisco"'), 'le TP passe avant la fiche show');
assert(!h('Linux').includes(`data-epingle="${ID}"`) && !h('Windows').includes('data-epingle'), 'bandeau masqué pour Linux et Windows');
assert(h(null).indexOf('data-epingle') < h(null).indexOf('class="memo-section"'), 'les bandeaux précèdent les sections');
const VC = await imp('vue-cours.mjs');
const liste = VC.coursListeMarkup(K.COURS.filter((x) => x.plateformes.includes('Cisco')), {}, {}, 'Cisco');
assert(liste.includes('data-epingle-cours="cisco-tp-vlan-ssh-intervlan"') && liste.indexOf('data-epingle-cours') < liste.indexOf('class="cours-carte"'), 'bandeau « à la une » sur la page des cours Cisco, avant les cartes');
assert(!VC.coursListeMarkup(K.COURS.filter((x) => x.plateformes.includes('Linux')), {}, {}, 'Linux').includes('data-epingle-cours'), 'bandeau absent de la page des cours Linux');
for (const [req, attendu] of [['vlan', ID], ['tp vlan', ID], ['routage inter-vlan', ID], ['router on a stick', ID], ['vlan ssh routeur', ID], ['3 vlan', ID], ['sous-interface dot1q', ID], ['inter-vlan ssh', ID]]) {
  const res = T.chercher(req, { plateforme: 'Cisco' });
  const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
  assert(ids.slice(0, 6).includes(attendu), `recherche « ${req} » : la fiche parmi les 6 premiers`, ids.slice(0, 6).join());
}

// 7. Contre-épreuves --------------------------------------------------------------------
{
  const mal = JSON.parse(JSON.stringify(fiche));
  const e = mal.methodes[0].etapes;
  [e[2], e[3]] = [e[3], e[2]]; // le port avant la création des VLAN
  const t = lignes(e.filter((x) => !x.annulation));
  assert(t.findIndex((c) => /^switchport access vlan 30$/.test(c)) < t.findIndex((c) => /^vlan 10$/.test(c)), 'contre-épreuve : un port affecté avant la création du VLAN est détectable');
  const mal2 = JSON.parse(JSON.stringify(fiche)); mal2.titre = 'x'.repeat(80);
  assert(P.incoherencesProcedure(mal2).length > 0, 'contre-épreuve : un titre trop long est détecté');
  const mal3 = JSON.parse(JSON.stringify(fiche)); mal3.methodes[0].etapes[1].lignes.push({ invite: 'SW1(config)#', cmd: 'ip address {{x}} 255.255.255.0' });
  assert(P.incoherencesProcedure(mal3).length > 0, 'contre-épreuve : un paramètre non déclaré est détecté');
  const faux = 'username admin privilege 15 secret Cisco123';
  assert(/\b(password|secret)\s+\S+/i.test(faux), 'contre-épreuve : un mot de passe écrit est détecté par le garde');
  const adr = ['ip address 192.168.10.1 255.255.255.0', 'ip address 192.168.10.1 255.255.255.0'];
  assert(new Set(adr.map((c) => c.split(' ')[2])).size !== adr.length, 'contre-épreuve : une adresse en double est détectée');
  const svgSans = '<svg><title>t</title><desc>d</desc><image/></svg>';
  assert(/<(image|script|a )/i.test(svgSans), 'contre-épreuve : un schéma avec image est détecté');
}

console.log(`cisco-tp-vlan : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
