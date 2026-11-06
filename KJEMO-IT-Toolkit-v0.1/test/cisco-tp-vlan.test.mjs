#!/usr/bin/env node
/**
 * cisco-tp-vlan.test.mjs — KJEMO-CISCO-TP-VLAN-03 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles de la fiche PARAMÉTRÉE « TP complet : VLAN, SSH et routage inter-VLAN » :
 * contrat, neuf phases, champs (VLAN de gestion, adresses, ports, comptes) et
 * TABLEAU de VLAN extensible (1 à 6 lignes), ORDRE des commandes (nom et domaine
 * avant la clé RSA, VLAN avant port et interface VLAN, encapsulation avant
 * l'adresse d'une sous-interface), ajout d'un VLAN (bloc en plus, trunk « add »),
 * deuxième administrateur, aucun mot de passe écrit, annulations avec champs,
 * cours à sept parcours, schémas, classement, aide-mémoire, recherche.
 * CONTRE-ÉPREUVES : un VLAN en double, un VLAN égal à celui de gestion, un réseau
 * qui recouvre celui de gestion, un port réutilisé, un ordre inversé, un mot de
 * passe en clair DOIVENT être détectés.
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
const { COURS_CISCO_TP_VLAN } = await imp('cours-fiches-cisco-tp-vlan.mjs');
const { SCHEMAS_TP_VLAN } = await imp('schemas-cisco-tp-vlan.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const ID = 'cours-tp-vlan-ssh-intervlan';
const fiche = T.entreeParId(ID).procedure;
const m0 = fiche.methodes[0];
const etapes = m0.etapes;
const base = etapes.filter((e) => !e.annulation);
const annul = etapes.filter((e) => e.annulation);
const exemple = Object.fromEntries(fiche.params.map((x) => [x.id, x.exemple]));
const LIGNE = (vlan, nom, n, ports, extra = {}) => ({ vlan: String(vlan), nom, reseau: `192.168.${n}.0`, prefixe: '24', passerelle: `192.168.${n}.1`, ports, poste: `192.168.${n}.10`, ...extra });
const PLAN1 = exemple.plan;
const PLAN3 = [LIGNE(10, 'VENTES', 10, 'Fa0/1'), LIGNE(20, 'TECHNIQUE', 20, 'Fa0/2, Fa0/3'), LIGNE(30, 'COMPTA', 30, 'Fa0/4')];
const rendre = (saisies) => {
  const r = P.rendreMethode(m0, fiche.params, saisies);
  return r.etapes.map((e, i) => ({ i: i + 1, titre: e.titre, bloque: !!e.rendu?.bloque, lignes: (e.rendu?.lignes ?? []).map((l) => l.copie), manquants: e.rendu?.manquants ?? [] }));
};
const R1 = rendre(exemple);
const R3 = rendre({ ...exemple, plan: PLAN3 });
const step = (R, n) => R.find((x) => x.i === n);
const baseCmds = (R) => R.slice(0, base.length).flatMap((x) => x.lignes);
const toutes = baseCmds(R1);
const evalPlan = (saisies) => P.evaluerValeurs(fiche.params, { ...exemple, ...saisies });
const erreurPlan = (saisies) => { const ev = evalPlan(saisies); return ev.plan?.erreur ?? ev.resultats?.plan?.erreur ?? ev.erreurs?.plan ?? (ev.valides?.plan ? '' : JSON.stringify(ev.plan ?? ev.resultats?.plan ?? '')); };

// 1. Contrat et forme ------------------------------------------------------------
assert(P.incoherencesProcedure(fiche).length === 0, 'contrat de fiche respecté', P.incoherencesProcedure(fiche).join(' | '));
assert(COURS_CISCO_TP_VLAN.length === 1 && fiche.titre.length <= 70, 'une fiche, titre ≤ 70 caractères');
assert(base.length === 30 && annul.length === 9, `30 étapes + 9 annulations (${base.length} + ${annul.length})`);
const phases = [...new Set(base.map((e) => e.phase).filter(Boolean))];
assert(phases.length === 9 && phases.every((p, i) => p.startsWith(`Phase ${i + 1} —`)), 'neuf phases numérotées dans l’ordre', phases.join(' | '));
assert(base.every((e) => e.explication.length >= 40 && e.attendu.length >= 20), 'chaque étape explique et dit ce qu’on doit voir');
assert(base.filter((e) => e.effet === 'lecture').length >= 9 && base.some((e) => e.effet === 'modification'), 'étapes de lecture et de modification');
assert(base.filter((e) => e.facultatif).length === 4, 'quatre étapes facultatives (poste du VLAN suivant et les trois « plus tard »)', String(base.filter((e) => e.facultatif).length));
assert(base.every((e) => (e.options ?? []).every((o) => o.option.length >= 3 && o.explication.length >= 15)), 'options expliquées');
assert(toutes.every((c) => /^[\x20-\x7e]+$/.test(c)) && toutes.every((c) => !c.includes('?') && !c.includes('{{')), 'commandes rendues en ASCII, sans « ? » ni paramètre restant');

// 2. Champs et tableau ---------------------------------------------------------------
const ids = fiche.params.map((x) => x.id);
assert(['vlanGestion', 'gestionSwitch', 'gestionPasserelle', 'gestionPrefixe', 'gestionPoste', 'portGestion', 'trunkSw', 'hoteSw', 'hoteRouteur', 'routeurItf', 'domaine', 'admin', 'admin2', 'plan'].every((x) => ids.includes(x)), 'tous les champs prévus sont déclarés', ids.join());
const plan = fiche.params.find((x) => x.id === 'plan');
assert(plan.type === 'table' && plan.min === 1 && plan.max >= 6 && plan.exemple.length === 1, 'tableau : démarre avec UNE ligne, extensible jusqu’à 6 au moins');
assert(exemple.vlanGestion === '99' && PLAN1[0].vlan === '10', 'départ : VLAN de gestion 99 et un seul VLAN (10)');
assert(!fiche.params.some((x) => /mot de passe|password|secret|passphrase|jeton|token/i.test(`${x.id} ${x.label}`)), 'aucun champ de mot de passe');
assert(R1.slice(0, 30).every((x) => x.manquants.length === 0), 'avec l’exemple, aucune étape n’a de champ manquant');
// Départ : un seul VLAN dans chaque bloc répété.
assert(toutes.filter((c) => /^vlan \d+$/.test(c)).join() === 'vlan 99,vlan 10', 'départ : seulement vlan 99 et vlan 10 créés');
assert(step(R1, 15).lignes.includes('switchport trunk allowed vlan 99,10'), 'trunk au départ : 99,10');
// Ajout de VLAN : trois lignes.
assert(baseCmds(R3).filter((c) => /^vlan \d+$/.test(c)).join() === 'vlan 99,vlan 10,vlan 20,vlan 30', 'trois lignes : trois VLAN du tableau en plus de la gestion');
assert(step(R3, 15).lignes.includes('switchport trunk allowed vlan 99,10,20,30'), 'trunk avec trois lignes : 99,10,20,30');
assert(step(R3, 19).lignes.filter((c) => /^interface /.test(c)).join() === 'interface GigabitEthernet0/0.10,interface GigabitEthernet0/0.20,interface GigabitEthernet0/0.30', 'une sous-interface par ligne du tableau');
assert(step(R3, 14).lignes.filter((c) => /^interface /.test(c)).join() === 'interface FastEthernet0/1,interface FastEthernet0/2,interface FastEthernet0/3,interface FastEthernet0/4', 'un « interface » par port listé (4 ports pour 3 VLAN)');
assert(step(R3, 14).lignes.indexOf('switchport access vlan 20') > step(R3, 14).lignes.indexOf('switchport access vlan 10'), 'les ports de chaque VLAN suivent l’ordre du tableau');
assert(step(R3, 28).lignes.filter((c) => c.startsWith('switchport trunk allowed vlan add')).join() === 'switchport trunk allowed vlan add 10,switchport trunk allowed vlan add 20,switchport trunk allowed vlan add 30', 'phase 9 : « add » pour chaque VLAN du tableau');
assert(step(R3, 22).lignes.join() === 'ping 192.168.10.1,ping 192.168.20.1,ping 192.168.30.1', 'un ping de passerelle par VLAN');
assert(step(R3, 24).lignes.includes('ping 192.168.20.10'), 'le poste du VLAN suivant est testé (VLAN 10 → 20)');
assert(step(R3, 25).lignes.length === 3 && step(R3, 25).lignes.every((c) => c === 'ssh -l admin 192.168.99.2'), 'SSH testé depuis chaque VLAN');
// Autres valeurs : tout suit les champs.
{
  const R = rendre({ ...exemple, vlanGestion: '50', gestionSwitch: '10.50.0.2', gestionPasserelle: '10.50.0.1', gestionPrefixe: '24', gestionPoste: '10.50.0.10', portGestion: 'Fa0/20', trunkSw: 'Gi0/2', hoteSw: 'SWA', hoteRouteur: 'RA', routeurItf: 'Gi0/1', domaine: 'labo.test', admin: 'root1' });
  const c = baseCmds(R);
  assert(c.includes('vlan 50') && c.includes('interface vlan 50') && c.includes('ip address 10.50.0.2 255.255.255.0') && c.includes('ip default-gateway 10.50.0.1'), 'VLAN de gestion et adresses changés : commandes suivies');
  assert(c.includes('encapsulation dot1Q 50') && c.includes('interface GigabitEthernet0/1.50') && c.includes('ip address 10.50.0.1 255.255.255.0'), 'sous-interface de gestion suit le VLAN, l’interface et la passerelle');
  assert(c.includes('hostname SWA') && c.includes('hostname RA') && c.includes('ip domain-name labo.test') && c.includes('username root1 privilege 15 secret') && c.includes('interface GigabitEthernet0/2'), 'noms, domaine, compte et trunk suivent les champs');
}

// 3. Ordre des commandes -----------------------------------------------------------
const idx = (re) => toutes.findIndex((c) => re.test(c));
const idxAll = (re) => toutes.map((c, i) => (re.test(c) ? i : -1)).filter((i) => i >= 0);
const ordre = [/^hostname SW1$/, /^ip domain-name tp\.local$/, /^vlan 99$/, /^vlan 10$/, /^switchport access vlan 99$/, /^interface vlan 99$/, /^ip default-gateway 192\.168\.99\.1$/, /^username admin privilege 15 secret$/, /^crypto key generate rsa modulus 2048$/, /^transport input ssh$/, /^switchport access vlan 10$/, /^switchport mode trunk$/, /^hostname R1$/, /^encapsulation dot1Q 99$/, /^encapsulation dot1Q 10$/, /^copy running-config startup-config$/];
const pos = ordre.map(idx);
assert(pos.every((p) => p >= 0), 'toutes les commandes clés sont présentes', pos.join());
assert(pos.every((p, i) => i === 0 || p > pos[i - 1]), 'commandes clés dans le bon ordre (gestion, SSH, ports, trunk, routeur, enregistrement)', pos.join());
for (const [R, nl] of [[R1, [[99, '192.168.99.1'], [10, '192.168.10.1']]], [R3, [[99, '192.168.99.1'], [10, '192.168.10.1'], [20, '192.168.20.1'], [30, '192.168.30.1']]]]) {
  const t = baseCmds(R);
  for (const [n, ip] of nl) {
    const i0 = t.findIndex((c) => c === `interface GigabitEthernet0/0.${n}`);
    assert(i0 >= 0 && t[i0 + 1] === `encapsulation dot1Q ${n}` && t[i0 + 2] === `ip address ${ip} 255.255.255.0`, `sous-interface .${n} : encapsulation puis adresse ${ip}`);
  }
}
{
  const iCle = idx(/^crypto key generate rsa modulus 2048$/);
  const iCtl = idx(/^show running-config \| include \^hostname\|\^ip domain$/);
  assert(iCtl >= 0 && iCtl < iCle && idx(/^ip domain-name tp\.local$/) < iCtl && idx(/^hostname SW1$/) < iCtl, 'le nom d’hôte et le domaine sont posés puis contrôlés avant la clé RSA');
  assert(idx(/^username admin privilege 15 secret$/) < iCle && iCle < idx(/^ip ssh version 2$/) && idx(/^ip ssh version 2$/) < idx(/^login local$/) && idx(/^login local$/) < idx(/^transport input ssh$/), 'ordre SSH complet : compte, clé, version 2, login local, transport');
  const en = idxAll(/^enable$/);
  assert(en.length === 2 && en[0] < idx(/^hostname SW1$/) && en[1] < idx(/^hostname R1$/), '« enable » avant la configuration du commutateur puis avant celle du routeur');
  const dep = m0.depannage.map((d) => d.symptome).join(' | ');
  assert(/domain-name first/.test(dep) && /hostname other than Switch/.test(dep), 'le dépannage nomme les deux messages IOS de la clé RSA');
}
// Le port de gestion n'est jamais touché pendant la session SSH
assert(!step(R3, 14).lignes.some((c) => /Ethernet0\/24/.test(c)) && !step(R3, 15).lignes.some((c) => /Ethernet0\/24/.test(c)), 'la phase par SSH ne touche pas au port de gestion (Fa0/24)');
assert(step(R1, 5).lignes.includes('interface FastEthernet0/24') && step(R1, 5).lignes.includes('switchport access vlan 99'), 'le port de gestion est affecté au VLAN de gestion (phase 1)');

// 4. Contrôles de cohérence du tableau ------------------------------------------------
{
  const refus = (saisies, motif, lib) => { const ev = evalPlan(saisies); const t = JSON.stringify(ev); assert(motif.test(t), lib, t.slice(0, 200)); };
  const accepte = (saisies, lib) => { const ev = evalPlan(saisies); const t = JSON.stringify(ev); assert(!/déjà|recouvre|chevauche|doublon|deux fois/i.test(t), lib, t.slice(0, 200)); };
  accepte({ plan: PLAN3 }, 'un tableau de trois VLAN distincts est accepté');
  refus({ plan: [LIGNE(99, 'X', 10, 'Fa0/1')] }, /déjà le VLAN de gestion/, 'un VLAN du tableau égal au VLAN de gestion est refusé');
  refus({ plan: [LIGNE(10, 'A', 10, 'Fa0/1'), LIGNE(10, 'B', 20, 'Fa0/2')] }, /10/, 'un VLAN en double est refusé');
  refus({ plan: [LIGNE(10, 'A', 99, 'Fa0/1')] }, /gestion|recouvre|chevauche/i, 'un réseau qui recouvre le réseau de gestion est refusé');
  refus({ plan: [LIGNE(10, 'A', 10, 'Fa0/24')] }, /Fa0\/24|port/i, 'un port égal au port du poste de gestion est refusé');
  refus({ plan: [LIGNE(10, 'A', 10, 'Gi0/1')] }, /Gi0\/1|port|trunk/i, 'un port égal au trunk est refusé');
  refus({ plan: [LIGNE(10, 'A', 10, 'Fa0/1'), LIGNE(20, 'B', 20, 'Fa0/1')] }, /Fa0\/1|port/i, 'un même port dans deux VLAN est refusé');
  refus({ plan: [LIGNE(10, 'A', 10, 'Fa0/1'), LIGNE(20, 'B', 10, 'Fa0/2')] }, /réseau|192\.168\.10/i, 'deux VLAN dans le même réseau sont refusés');
  refus({ plan: [{ ...LIGNE(10, 'A', 10, 'Fa0/1'), passerelle: '192.168.77.1' }] }, /passerelle|réseau/i, 'une passerelle hors du réseau du VLAN est refusée');
  refus({ plan: [] }, /./, 'un tableau vide est refusé');
  const sept = Array.from({ length: 7 }, (_, k) => LIGNE(10 + k * 10, `V${k}`, 10 + k * 10, `Fa0/${k + 1}`));
  refus({ plan: sept }, /./, 'plus de six lignes sont refusées');
  // Étape bloquée tant que le VLAN de gestion n'est pas rempli.
  const Rv = rendre({ ...exemple, vlanGestion: '' });
  assert(step(Rv, 3).bloque && step(Rv, 3).manquants.length > 0, 'sans VLAN de gestion, l’étape de création est bloquée et nomme le champ manquant');
}

// 5. Deuxième administrateur, mots de passe -------------------------------------------
{
  const Rv = rendre({ ...exemple, admin2: '' });
  assert(step(Rv, 29).bloque && !step(Rv, 28).bloque && !step(Rv, 7).bloque, 'sans nom du 2e admin, seule la phase 9 de ce compte est bloquée (la fiche de base reste utilisable)');
  assert(step(R1, 29).lignes.join() === 'configure terminal,username tech2 privilege 15 secret', 'compte du 2e admin : la ligne s’arrête avant le secret');
  assert(step(R1, 30).lignes[0] === 'ssh -l tech2 192.168.99.2', 'test SSH du 2e admin');
  assert(base.filter((e) => e.facultatif).every((e) => e.phase.startsWith('Phase 9') || /suivant|autre VLAN/i.test(e.titre)), 'les étapes facultatives sont la phase 9 et le poste du VLAN suivant');
  const secretes = base.filter((e) => e.lignes.some((l) => l.secret));
  assert(secretes.length === 2 && secretes.every((e) => e.interactions?.some((i) => i.secret)), 'deux lignes secrètes (admin et admin2), chacune avec instruction de saisie');
  assert(secretes.every((e) => e.lignes[e.lignes.length - 1].secret), 'la ligne secrète est la dernière de son étape');
  assert(!toutes.some((c) => /\b(password|secret)\s+\S+/i.test(c)), 'aucun mot de passe écrit dans les commandes rendues');
  assert(!JSON.stringify(fiche).match(/mot de passe\s*[:=]\s*\S/i), 'aucun mot de passe donné en exemple dans la fiche');
  assert(!/tech2/.test(R1.slice(0, 27).flatMap((x) => x.lignes).join('\n')), 'le 2e admin n’apparaît pas avant la phase 9');
}

// 6. Annulations ----------------------------------------------------------------
assert(annul.every((e) => e.facultatif && e.titre.startsWith('Annuler —')), 'annulations facultatives et nommées');
const AN1 = R1.slice(base.length).flatMap((x) => x.lignes);
const AN3 = R3.slice(base.length).flatMap((x) => x.lignes);
assert(['no interface GigabitEthernet0/0.10', 'no interface GigabitEthernet0/0.99', 'no vlan 10', 'no vlan 99', 'no interface vlan 99', 'crypto key zeroize rsa', 'no ip default-gateway', 'no username admin', 'no username tech2'].every((c) => AN1.includes(c)), 'les annulations défont routeur, trunk, gestion, VLAN, SSH et 2e admin (départ à un VLAN)');
assert(['no interface GigabitEthernet0/0.20', 'no interface GigabitEthernet0/0.30', 'no vlan 20', 'no vlan 30'].every((c) => AN3.includes(c)), 'les annulations suivent les lignes ajoutées au tableau');
assert(AN3.filter((c) => c === 'no switchport access vlan').length >= 5, 'chaque port du tableau est remis dans le VLAN 1');
{
  const o = (re) => AN3.findIndex((c) => re.test(c));
  assert(o(/^no interface GigabitEthernet0\/0\.10$/) < o(/^switchport mode access$/) && o(/^switchport mode access$/) < o(/^no interface vlan 99$/) && o(/^no interface vlan 99$/) < o(/^no vlan 10$/) && o(/^no vlan 10$/) < o(/^no vlan 99$/), 'annulation dans l’ordre inverse (routeur, trunk, gestion, VLAN du tableau, VLAN de gestion)');
}
assert(annul.some((e) => /console/i.test(e.explication) && /SSH/.test(e.titre)) && annul.some((e) => /console/i.test(e.explication) && /gestion/.test(e.titre)), 'les annulations qui coupent la session SSH disent de passer par la console');

// 7. Cours ----------------------------------------------------------------------
const cours = K.COURS_PAR_ID.get('cisco-tp-vlan-ssh-intervlan');
assert(cours && cours.parcours.length === 7 && cours.parcours.map((p) => p.lettre).join('') === 'ABCDEFG', 'cours à sept parcours A–G');
assert(cours.rappelCours && cours.rappelCours.sections.length >= 3 && cours.rappelCours.questions.length >= 5, 'résumé pliable (sections, questions)');
const refsTp = cours.parcours.flatMap((p) => p.items.flatMap((i) => i.refs)).filter((r) => r.fiche === ID).map((r) => r.etape);
const couvertes = new Set(refsTp);
assert([...Array(30).keys()].every((i) => couvertes.has(i + 1)), 'les 30 étapes de la fiche sont toutes citées par un parcours');
assert(refsTp.includes(31) && refsTp.includes(38), 'les annulations sont citées');
assert(cours.parcours[6].titre.startsWith('Plus tard') && cours.parcours[6].items.length === 3, 'parcours G « Plus tard » : VLAN de plus et 2e administrateur');
assert(cours.soutien.some((s) => s.fiche === 'cours-show-cisco'), 'le soutien cite la fiche show');
assert(cours.ambiguites.length === 3, 'trois ambiguïtés signalées');
assert(!/trois VLAN|3 VLAN/.test(JSON.stringify(cours)), 'plus aucune mention d’un plan fixe à trois VLAN dans le cours');

// 8. Schémas ---------------------------------------------------------------------
for (const id of ['tp-vlan-topologie', 'tp-vlan-chemin']) {
  const s = SCHEMAS_TP_VLAN[id]; const svg = s.svg();
  assert(s.titre.length >= 10 && s.legende.length >= 40, `schéma ${id} : titre et légende`);
  assert(svg.includes('<title') && svg.includes('<desc') && !/<(image|script|a )/i.test(svg), `schéma ${id} : titre, texte alternatif, pas d’image ni de script`);
}
assert(['tp-vlan-topologie', 'tp-vlan-chemin'].every((id) => cours.rappelCours.sections.some((x) => x.schemas.includes(id))), 'les deux schémas sont dans le résumé');
const topo = SCHEMAS_TP_VLAN['tp-vlan-topologie'].svg();
assert(['192.168.99.10', '192.168.10.10', '192.168.99.2', 'TRUNK 802.1Q', 'VLAN 99', '+ VLAN à ajouter', 'stroke-dasharray'].every((t) => topo.includes(t)), 'topologie : gestion 99, un VLAN, emplacement en tirets et trunk');
assert(!topo.includes('192.168.30.'), 'topologie : plus d’ancien VLAN 30');
const chem = SCHEMAS_TP_VLAN['tp-vlan-chemin'].svg();
assert(chem.includes('VLAN 99') && chem.includes('Fa0/24') && !chem.includes('Fa0/2<'), 'chemin : du VLAN 10 vers le VLAN de gestion 99');

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

// 9. Contre-épreuves --------------------------------------------------------------------
{
  const mal = baseCmds(R1).slice();
  const a = mal.indexOf('vlan 10'); const b = mal.indexOf('switchport access vlan 10');
  assert(a >= 0 && b > a, 'référence : le VLAN est créé avant le port');
  const [x, y] = [mal[a], mal[b]]; mal[a] = y; mal[b] = x;
  assert(mal.indexOf('switchport access vlan 10') < mal.indexOf('vlan 10'), 'contre-épreuve : un port affecté avant la création du VLAN est détectable');
  const mal2 = JSON.parse(JSON.stringify(fiche)); mal2.titre = 'x'.repeat(80);
  assert(P.incoherencesProcedure(mal2).length > 0, 'contre-épreuve : un titre trop long est détecté');
  const mal3 = JSON.parse(JSON.stringify(fiche)); mal3.methodes[0].etapes[1].lignes.push({ invite: 'SW(config)#', cmd: 'ip address {{x}} 255.255.255.0' });
  assert(P.incoherencesProcedure(mal3).length > 0, 'contre-épreuve : un paramètre non déclaré est détecté');
  const mal4 = JSON.parse(JSON.stringify(fiche)); mal4.params = mal4.params.filter((p) => p.id !== 'admin2');
  assert(P.incoherencesProcedure(mal4).length > 0, 'contre-épreuve : un champ utilisé mais supprimé est détecté');
  const mal5 = JSON.parse(JSON.stringify(fiche)); mal5.params.push({ id: 'motDePasse', label: 'mot de passe', type: 'identifiant', exemple: 'abc' });
  assert(P.incoherencesProcedure(mal5).length > 0, 'contre-épreuve : un champ « mot de passe » est refusé');
  const faux = 'username admin privilege 15 secret Cisco123';
  assert(/\b(password|secret)\s+\S+/i.test(faux), 'contre-épreuve : un mot de passe écrit est détecté par le garde');
  const adr = ['ip address 192.168.10.1 255.255.255.0', 'ip address 192.168.10.1 255.255.255.0'];
  assert(new Set(adr.map((c) => c.split(' ')[2])).size !== adr.length, 'contre-épreuve : une adresse en double est détectée');
  const svgSans = '<svg><title>t</title><desc>d</desc><image/></svg>';
  assert(/<(image|script|a )/i.test(svgSans), 'contre-épreuve : un schéma avec image est détecté');
}

console.log(`cisco-tp-vlan : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
