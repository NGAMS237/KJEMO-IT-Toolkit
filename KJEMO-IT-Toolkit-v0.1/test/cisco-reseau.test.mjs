#!/usr/bin/env node
/**
 * cisco-reseau.test.mjs — KJEMO-CISCO-COURS-RESEAU-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles des cours Cisco « Architecture réseau II » (semaines 1 à 5) et du
 * TP2 : 17 fiches IOS, 5 cours et leurs parcours, 4 résumés pliables + 1 résumé
 * de TP, 14 schémas originaux (SVG), absence de doublons avec le catalogue
 * existant, classement et aide-mémoire.
 *
 * CAS FONCTIONNELS : contrat de chaque fiche, commandes rendues avec les valeurs
 * d'exemple (ASCII, sans « ? », sans marque non remplacée, sans secret saisi),
 * nouveaux validateurs (MAC IOS, texte ASCII, interface série), exactitude des
 * tableaux de masques et du découpage VLSM (RECALCULÉS ici), plan d'adressage
 * du TP2 recalculé, parcours résolus, résumés complets, schémas valides.
 * CONTRE-ÉPREUVES : on dégrade un cours, un résumé, une fiche, un paramètre, et
 * le contrôle DOIT échouer.
 * SÉCURITÉ / DROIT D'AUTEUR : aucun schéma ne contient d'image embarquée, de lien
 * ni de script ; aucune commande n'est exécutée ; aucun mot de passe dans une fiche.
 *
 * NE PROUVE PAS : le comportement sur un commutateur, un routeur ou Packet
 * Tracer (NON EXÉCUTÉ), ni l'exactitude d'un affichage dans un navigateur donné.
 * Usage : node test/cisco-reseau.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const C = await imp('classement.mjs'); const P = await imp('procedures.mjs');
const K = await imp('cours.mjs'); const M = await imp('memo.mjs'); const S = await imp('schemas-cisco.mjs');
const R = await imp('cours-resume-cisco-reseau.mjs'); const { COURS_CISCO_RESEAU } = await imp('cours-fiches-cisco-reseau.mjs');
const { COURS_CISCO_RESEAU_PARCOURS } = await imp('cours-cisco-reseau.mjs');
const VC = await imp('vue-cours.mjs'); const VT = await imp('vue-taches.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const IDS = ['cours-base-peripherique', 'cours-sw-gestion-ip', 'cours-sw-duplex-vitesse', 'cours-sw-diagnostiquer-port', 'cours-sw-ports-inutilises', 'cours-sw-portsec', 'cours-config-portable',
  'cours-rt-interface-ip', 'cours-rt-statique', 'cours-rt-defaut-flottante', 'cours-rt-tester', 'cours-rip-configurer', 'cours-rip-verifier',
  'cours-vtp-reseau', 'cours-vtp-transparent-etendus', 'cours-dtp-trunk', 'cours-vtp-dtp-depanner'];
const COURS_IDS = ['cisco-s01-revision-vlsm', 'cisco-s02-commutateur-securite', 'cisco-s02-s03-routage', 'cisco-s05-vlan-vtp-dtp', 'cisco-tp2-routage-statique'];
const SCHEMAS_NEUFS = ['vlsm-masques', 'vlsm-decoupage', 'rt-statique', 'rt-table', 'rt-flottante', 'rip-principe', 'rip-resume-auto', 'sw-etats-port', 'sw-portsec-modes', 'sw-ssh-ordre', 'vtp-modes', 'vtp-revision', 'dtp-modes', 'tp2-topologie'];
const exemple = (p) => Object.fromEntries(p.params.map((x) => [x.id, x.exemple]));
const rendu = (id, saisies = null) => { const p = T.entreeParId(id).procedure; return P.rendreMethode(p.methodes[0], p.params, saisies ?? exemple(p)); };
const lignes = (id, saisies = null) => rendu(id, saisies).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));

// ---------------------------------------------------------------------------
console.log('1. Les 17 fiches IOS');
assert(COURS_CISCO_RESEAU.length === 17 && COURS_CISCO_RESEAU.map((p) => p.id).join() === IDS.join(), '17 fiches, dans l’ordre prévu');
const AVEC_SECRET = { 'cours-base-peripherique': 2, 'cours-vtp-reseau': 1 };
for (const p of COURS_CISCO_RESEAU) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' ; '));
  assert(p.origine === 'cours' && p.id.startsWith('cours-'), `origine cours : ${p.id}`);
  assert(p.methodes.length === 1 && p.methodes[0].id === 'ios', `méthode IOS unique : ${p.id}`);
  const e = T.entreeParId(p.id);
  assert(e && e.procedure === p, `dans le catalogue : ${p.id}`);
  assert(e && e.plateformes.join() === 'Cisco', `plateforme Cisco seule : ${p.id}`, e?.plateformes?.join());
  assert(C.cheminDe(e)?.domaineId === 'reseau-cisco', `rangée sous Réseau Cisco : ${p.id}`);
  assert(M.groupeDeFiche(p.id) !== null, `dans l’aide-mémoire : ${p.id}`);
  assert(p.figures === undefined || p.figures.every((f) => S.IDS_SCHEMAS.includes(f)), `schémas connus : ${p.id}`);
  if (p.rappel) assert(p.rappel.points.length >= 3 || p.rappel.points.length >= 2, `rappel plié : ${p.id}`);
  assert(p.resume.length >= 20 && p.resume.length <= 400 && p.titre.length <= 70, `titre et résumé bornés : ${p.id}`);
  const secrets = p.methodes[0].etapes.flatMap((x) => x.lignes).filter((l) => l.secret).length;
  assert(secrets === (AVEC_SECRET[p.id] ?? 0), `lignes à secret : ${p.id} (${secrets})`);
}
assert(new Set(IDS).size === IDS.length, 'identifiants uniques');

// ---------------------------------------------------------------------------
console.log('2. Commandes rendues avec les valeurs d’exemple');
for (const p of COURS_CISCO_RESEAU) {
  const r = rendu(p.id);
  assert(r.manquants.length === 0, `aucune valeur manquante : ${p.id}`, r.manquants.join());
  for (const e of r.etapes) {
    for (const l of e.rendu?.lignes ?? []) {
      assert(/^[\x20-\x7e]+ ?$/.test(l.copie), `ASCII seul, sans tabulation : ${p.id}`, l.copie);
      assert(!/\?/.test(l.copie), `jamais de « ? » (IOS l’interprète à la frappe) : ${p.id}`, l.copie);
      assert(!/\{\{|\}\}/.test(l.copie) && !/‹|›/.test(l.copie), `aucune marque non remplacée : ${p.id}`, l.copie);
      assert(!/\b(reload|erase|write erase|delete|format)\b/i.test(l.copie), `aucune commande destructrice de la mémoire de l’équipement : ${p.id}`, l.copie);
      // un mot de passe n'est jamais écrit : la ligne à secret s'arrête sur le mot qui le précède
      if (/\b(password|secret)\s*$/.test(l.copie.trimEnd())) assert(/ $/.test(l.copie) || l.secret !== false, `ligne à secret terminée sans mot de passe : ${p.id}`, l.copie);
    }
  }
}
{
  const gi = lignes('cours-sw-gestion-ip');
  assert(gi.includes('interface vlan 1') && gi.includes('ip address 192.168.5.93 255.255.255.224') && gi.includes('ip default-gateway 192.168.5.94'), 'gestion : interface vlan, adresse, masque pointé et passerelle', gi.join(' | '));
  const rs = lignes('cours-rt-statique');
  assert(rs.includes('ip route 192.168.5.160 255.255.255.224 10.123.145.106'), 'route statique : réseau, masque, voisin', rs.join(' | '));
  const rt = lignes('cours-rt-interface-ip');
  assert(rt.includes('ip address 192.168.5.94 255.255.255.224') && rt.indexOf('no shutdown') > rt.indexOf('ip address 192.168.5.94 255.255.255.224'), 'interface de routeur : adresse puis no shutdown');
  assert(rt.includes('clock rate 64000'), 'interface série : clock rate (étape facultative)');
  const fl = lignes('cours-rt-defaut-flottante');
  assert(fl.includes('ip route 0.0.0.0 0.0.0.0 10.123.145.58') && fl.includes('ip route 192.168.5.160 255.255.255.224 10.123.145.106 5'), 'défaut et flottante : distance 5 en dernier', fl.join(' | '));
  const rip = lignes('cours-rip-configurer');
  assert(rip.indexOf('router rip') < rip.indexOf('version 2') && rip.includes('no auto-summary') && rip.includes('network 192.168.5.0') && rip.includes('passive-interface GigabitEthernet0/0'), 'RIPv2 : version 2, no auto-summary, network, passive-interface', rip.join(' | '));
  const ps = lignes('cours-sw-portsec');
  assert(ps.includes('switchport mode access') && ps.includes('switchport port-security maximum 1') && ps.includes('switchport port-security violation shutdown') && ps.includes('switchport port-security mac-address sticky') && ps.includes('switchport port-security mac-address 0001.4321.abcd'), 'port-security : accès, maximum, sanction, sticky, MAC fixe', ps.join(' | '));
  assert(ps.indexOf('switchport mode access') < ps.indexOf('switchport port-security'), 'port-security : le port passe en accès AVANT l’activation');
  const pi = lignes('cours-sw-ports-inutilises');
  assert(pi.includes('interface range FastEthernet0/5 - 24') && pi.includes('shutdown') && pi.includes('switchport access vlan 999'), 'ports inutilisés : plage, shutdown, VLAN de parcage', pi.join(' | '));
  const vt = lignes('cours-vtp-reseau');
  assert(vt.includes('vtp mode client') && vt.includes('vtp domain CCNA') && vt.some((l) => l.trimEnd() === 'vtp password') && vt.includes('vlan 10') && vt.includes('name Ventes'), 'VTP : mode, domaine, mot de passe (sans valeur), VLAN', vt.join(' | '));
  const te = lignes('cours-vtp-transparent-etendus');
  assert(te.includes('vtp mode transparent') && te.includes('vlan 2000'), 'VLAN étendus : transparent puis vlan 2000');
  const dt = lignes('cours-dtp-trunk');
  assert(dt.includes('switchport mode dynamic desirable') && dt.includes('switchport nonegotiate'), 'DTP : mode et nonegotiate');
  const ba = lignes('cours-base-peripherique');
  assert(ba.includes('hostname R1') && ba.includes('no ip domain-lookup') && ba.includes('service password-encryption') && ba.some((l) => l.startsWith('banner motd # Acces interdit')), 'base : hostname, domain-lookup, chiffrement, bannière', ba.join(' | '));
  assert(ba.some((l) => l.trimEnd() === 'enable secret') && ba.some((l) => l.trimEnd() === 'password'), 'base : enable secret et password sans valeur (tapés sur la console)');
}

// ---------------------------------------------------------------------------
console.log('3. Nouveaux validateurs : cas valides et REFUS');
{
  const mac = (v) => P.TYPES_PARAM.macIos(v, { label: 'MAC' });
  assert(mac('0001.4321.ABCD').ok && mac('0001.4321.ABCD').valeur === '0001.4321.abcd', 'macIos : format IOS accepté, mis en minuscules');
  for (const mauvais of ['00-15-5D-01-02-03', '0001.4321', '0001.4321.abcg', '0001.4321.abcd.ef01', '', '0001.4321.abcd; reload']) assert(!mac(mauvais).ok, `macIos : refuse « ${mauvais} »`);
  const asc = (v) => P.TYPES_PARAM.texteAscii(v, { label: 'texte' });
  assert(asc('Acces interdit').ok, 'texteAscii : texte simple accepté');
  for (const mauvais of ['Accès interdit', 'a#b', 'a\nb', '', 'x'.repeat(200)]) assert(!asc(mauvais).ok, `texteAscii : refuse « ${mauvais.slice(0, 12)} »`);
  const itf = (v) => P.TYPES_PARAM.interfaceRouteur(v, { label: 'interface' });
  assert(itf('Se0/0/0').valeur === 'Serial0/0/0' && itf('Gi0/0').valeur === 'GigabitEthernet0/0' && itf('Serial0/1/1').ok, 'interfaceRouteur : série acceptée, Gigabit toujours acceptée');
  for (const mauvais of ['Se0/0/0.10', 'Se0', 'Se00/0', 'Gi0/0 - 4', 'Tunnel0/0']) assert(!itf(mauvais).ok, `interfaceRouteur : refuse « ${mauvais} »`);
  const rs = T.entreeParId('cours-rt-statique').procedure;
  assert(Boolean(P.evaluerValeurs(rs.params, { ...exemple(rs), masque: '255.255.255.100' }).erreurs.masque), 'masque : un masque hors liste est refusé');
  assert(Boolean(P.evaluerValeurs(rs.params, { ...exemple(rs), reseau: '192.168.5.300' }).erreurs.reseau), 'réseau : une adresse invalide est refusée');
  const rf = T.entreeParId('cours-rt-defaut-flottante').procedure;
  assert(Boolean(P.evaluerValeurs(rf.params, { ...exemple(rf), distance: '1' }).erreurs.distance) && Boolean(P.evaluerValeurs(rf.params, { ...exemple(rf), distance: '300' }).erreurs.distance), 'distance de la route flottante : 2 à 254');
  const ext = T.entreeParId('cours-vtp-transparent-etendus').procedure;
  assert(Boolean(P.evaluerValeurs(ext.params, { ...exemple(ext), vlan: '100' }).erreurs.vlan), 'VLAN étendu : 100 refusé (1006 à 4094)');
  const pi = T.entreeParId('cours-sw-ports-inutilises').procedure;
  assert(Boolean(P.evaluerValeurs(pi.params, { ...exemple(pi), parc: '1' }).erreurs.parc), 'VLAN de parcage : le VLAN 1 est refusé');
  const ps = T.entreeParId('cours-sw-portsec').procedure;
  assert(Boolean(P.evaluerValeurs(ps.params, { ...exemple(ps), violation: 'drop' }).erreurs.violation), 'sanction : valeur hors liste refusée');
}

// ---------------------------------------------------------------------------
console.log('4. Exactitude des données du cours (recalculées)');
{
  // Tableau de masques : /24 à /30
  const dernier = (p) => 256 - 2 ** (32 - p);
  const svg = S.SCHEMAS['vlsm-masques'].svg();
  for (let p = 24; p <= 30; p++) {
    const total = 2 ** (32 - p);
    assert(svg.includes(`255.255.255.${dernier(p) === 0 ? 0 : dernier(p)}</text>`) && svg.includes(`>${total - 2}</text>`) && svg.includes(`/${p}</text>`), `tableau des masques : /${p} = ${total} adresses, ${total - 2} hôtes`);
  }
  // VLSM : blocs alignés, sans chevauchement, assez grands
  const blocs = [['/25', 0, 100], ['/26', 128, 50], ['/27', 192, 20], ['/30', 224, 2]];
  let fin = 0;
  for (const [pref, debut, besoin] of blocs) {
    const taille = 2 ** (32 - Number(pref.slice(1)));
    assert(debut % taille === 0, `VLSM : ${pref} commence sur une frontière de sa taille (${debut})`);
    assert(taille - 2 >= besoin && taille / 2 - 2 < besoin, `VLSM : ${pref} est le plus petit bloc pour ${besoin} hôtes`);
    assert(debut >= fin, `VLSM : ${pref} ne chevauche pas le bloc précédent`);
    fin = debut + taille;
  }
  const dec = S.SCHEMAS['vlsm-decoupage'].svg();
  assert(dec.includes('192.168.10.0/25') && dec.includes('192.168.10.128/26') && dec.includes('192.168.10.192/27') && dec.includes('192.168.10.224/30'), 'VLSM : les quatre adresses de réseau sont dans le schéma');
  // TP2 : plan d'adressage recalculé
  const ip = (s) => s.split('.').reduce((a, o) => a * 256 + Number(o), 0);
  const plage = (reseau, p) => { const n = ip(reseau); const t = 2 ** (32 - p); return { reseau: n, premier: n + 1, dernier: n + t - 2, diffusion: n + t - 1, ok: n % t === 0 }; };
  const pa = plage('192.168.5.64', 27); const pb = plage('192.168.5.160', 27); const pc = plage('192.168.5.224', 27);
  assert(pa.ok && pb.ok && pc.ok, 'TP2 : les trois réseaux /27 commencent sur une adresse de réseau valide');
  assert(pa.premier === ip('192.168.5.65') && pa.dernier === ip('192.168.5.94') && pb.premier === ip('192.168.5.161') && pb.dernier === ip('192.168.5.190') && pc.premier === ip('192.168.5.225') && pc.dernier === ip('192.168.5.254'), 'TP2 : première et dernière adresses d’hôte des /27 (celles du tableau de l’énoncé)');
  const l13 = plage('10.123.145.56', 29); const l12 = plage('10.123.145.104', 29); const l23 = plage('10.123.145.72', 29);
  assert(l13.ok && l12.ok && l23.ok && l13.premier === ip('10.123.145.57') && l13.dernier === ip('10.123.145.62') && l12.premier === ip('10.123.145.105') && l12.dernier === ip('10.123.145.110'), 'TP2 : liens /29 (R1–R3 .57 à .62, R1–R2 .105 à .110)');
  assert(ip('10.123.145.73') >= l23.premier && ip('10.123.145.74') <= l23.dernier, 'TP2 : R2 .73 et R3 .74 sont bien dans le réseau R2–R3 (10.123.145.72/29)');
  assert(!(ip('192.158.5.66') >= pa.premier && ip('192.158.5.66') <= pa.dernier) && ip('192.168.5.66') >= pa.premier && ip('192.168.5.66') <= pa.dernier, 'TP2 : 192.158.5.66 n’est PAS dans A-163, 192.168.5.66 l’est (faute de frappe probable)');
  assert(ip('10.123.145.56') === l13.reseau, 'TP2 : 10.123.145.56 est l’adresse du RÉSEAU R1–R3, pas un hôte (utilisée à tort sur R1 et R3)');
  const tp2 = K.COURS_PAR_ID.get('cisco-tp2-routage-statique');
  const amb = tp2.ambiguites.map((a) => a.texte).join(' ');
  assert(amb.includes('192.158.5.66') && amb.includes('10.123.145.56') && amb.includes('10.123.145.72/29'), 'TP2 : les trois incohérences de l’énoncé sont signalées');
}

// ---------------------------------------------------------------------------
console.log('5. Les cours et leurs parcours');
const resolveur = {
  fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodeParDefaut: ms[0].id, methodes: Object.fromEntries(ms.map((m) => [m.id, m.etapes.length])), titres: Object.fromEntries(ms.map((m) => [m.id, m.etapes.map((x) => x.titre)])) }; },
  assistants: (id) => Boolean(T.entreeParId(id)),
};
assert(COURS_CISCO_RESEAU_PARCOURS.map((c) => c.id).join() === COURS_IDS.join(), '5 cours dans l’ordre du semestre');
{
  const ordre = K.COURS.filter((c) => c.plateformes.includes('Cisco')).map((c) => c.id);
  assert(ordre.length === 6 && ordre.at(-1) === 'cisco-tp2-routage-statique' && ordre.includes('cisco-s07-etherchannel'), '6 cours Cisco au total (5 nouveaux + la semaine 7)');
}
for (const cid of COURS_IDS) {
  const c = K.COURS_PAR_ID.get(cid);
  assert(c && c.plateformes.join() === 'Cisco', `cours Cisco : ${cid}`);
  const pb = K.incoherencesCours(c, resolveur);
  assert(pb.length === 0, `le cours est conforme à son contrat : ${cid}`, pb.join(' ; '));
  assert(c.rappelCours && K.incoherencesRappel(c.rappelCours).length === 0, `résumé conforme : ${cid}`, K.incoherencesRappel(c.rappelCours ?? {}).join(' ; '));
  assert(K.lireRouteCours(`#/cours/${cid}/resume`)?.lettre === 'resume', `route /resume : ${cid}`);
  const items = c.parcours.flatMap((p) => p.items);
  assert(items.filter((i) => i.couvert === false).every((i) => i.note.length >= 40), `éléments non couverts expliqués : ${cid}`);
  assert(items.every((i) => i.couvert === false || i.refs.length || i.assistants?.length), `chaque élément couvert cite une fiche ou un assistant : ${cid}`);
  assert(K.aliasesDe(c.parcours.flatMap((p) => p.items).find((i) => i.refs.length)?.refs[0].fiche ?? '').length > 0, `alias de recherche : ${cid}`);
}
{
  const citees = new Set(COURS_IDS.flatMap((cid) => { const c = K.COURS_PAR_ID.get(cid); return [...c.parcours.flatMap((p) => [...p.prerequis.map((r) => r.fiche), ...p.items.flatMap((i) => i.refs.map((r) => r.fiche))]), ...c.soutien.map((s) => s.fiche)]; }));
  assert(IDS.every((id) => citees.has(id)), 'chaque nouvelle fiche est atteinte par un parcours', IDS.filter((id) => !citees.has(id)).join());
  const tp2 = K.COURS_PAR_ID.get('cisco-tp2-routage-statique');
  assert(tp2.parcours.map((p) => p.lettre).join('') === 'ABCD' && tp2.parcours.map((p) => p.points ?? 0).reduce((a, b) => a + b, 0) === 100, 'TP2 : parcours A à D, 10 + 70 + 20 points déclarés (la partie 2 est dans les 70 de la partie 1 selon l’énoncé)', tp2.parcours.map((p) => p.points).join());
}
// pas de doublon avec le catalogue existant : titres et intentions uniques, assistants repris une seule fois
{
  const toutes = T.TOUTES_LES_ENTREES.filter((e) => e.procedure);
  const titres = new Map();
  for (const e of toutes) { const t = e.titre.toLowerCase(); titres.set(t, (titres.get(t) ?? 0) + 1); }
  assert(COURS_CISCO_RESEAU.every((p) => titres.get(p.titre.toLowerCase()) === 1), 'aucun titre de fiche en double dans le catalogue');
  const hotes = COURS_CISCO_RESEAU.map((p) => p.assistant).filter(Boolean);
  assert(new Set(hotes).size === hotes.length, 'chaque assistant existant n’est repris que par UNE fiche', hotes.join());
  assert(hotes.every((h) => T.entreeParId(h)?.kind === 'assistant'), 'les assistants repris existent bien');
  const existantsCisco = ['cisco-creer-vlan', 'cisco-affecter-port-vlan', 'cisco-voir-trunks', 'cisco-voir-routes', 'cisco-enregistrer-config', 'cisco-trouver-adresse-mac', 'scenario-cisco-ssh-commutateur'];
  assert(existantsCisco.every((id) => T.entreeParId(id) && !IDS.includes(id)), 'les fiches existantes (VLAN, trunks, routes, SSH…) sont citées, jamais refaites');
  const cles = COURS_CISCO_RESEAU.flatMap((p) => p.intentions.map((i) => i.toLowerCase()));
  assert(new Set(cles).size === cles.length, 'aucune intention de recherche en double entre les nouvelles fiches');
}
// contre-épreuves
{
  const c = structuredClone(K.COURS_PAR_ID.get('cisco-s02-commutateur-securite'));
  c.parcours[1].items[0].refs[0].etape = 99;
  assert(K.incoherencesCours(c, resolveur).length > 0, 'contre-épreuve : une étape inexistante est détectée');
  const c2 = structuredClone(K.COURS_PAR_ID.get('cisco-s05-vlan-vtp-dtp'));
  c2.parcours[0].items[7].assistants = ['assistant-qui-n-existe-pas'];
  assert(K.incoherencesCours(c2, resolveur).length > 0, 'contre-épreuve : un assistant inconnu est détecté');
  const c3 = structuredClone(K.COURS_PAR_ID.get('cisco-s05-vlan-vtp-dtp'));
  c3.parcours[0].items[7].assistants = [];
  assert(K.incoherencesCours(c3, resolveur).length > 0, 'contre-épreuve : un élément couvert sans fiche ni assistant est détecté');
  const c4 = structuredClone(K.COURS_PAR_ID.get('cisco-s02-s03-routage'));
  c4.parcours[0].items[0].refs[0].titre = 'titre qui n’existe pas';
  assert(K.incoherencesCours(c4, resolveur).length > 0, 'contre-épreuve : un titre d’étape qui ne correspond plus est détecté');
  const r = structuredClone(R.RESUME_S05); r.questions = r.questions.slice(0, 2);
  assert(K.incoherencesRappel(r).length > 0, 'contre-épreuve : trop peu de questions est détecté');
  const r2 = structuredClone(R.RESUME_ROUTAGE); r2.sections[0].schemas = ['schema-inconnu'];
  assert(K.incoherencesRappel(r2).length > 0, 'contre-épreuve : un schéma inconnu est détecté');
  const p = structuredClone(T.entreeParId('cours-rt-statique').procedure);
  p.methodes[0].etapes[1].lignes[0].cmd = 'ip route {{inconnu}} {{masque}} {{saut}}';
  assert(P.incoherencesProcedure(p).length > 0, 'contre-épreuve : un paramètre non déclaré dans une fiche est détecté');
  const p2 = structuredClone(T.entreeParId('cours-sw-portsec').procedure);
  p2.params.find((x) => x.id === 'mac').exemple = '00-15-5D-01-02-03';
  assert(P.incoherencesProcedure(p2).length > 0, 'contre-épreuve : un exemple refusé par son propre validateur est détecté');
}

// ---------------------------------------------------------------------------
console.log('6. Les résumés pliables');
for (const [nom, r, schemas] of [['S01', R.RESUME_S01, ['vlsm-masques', 'vlsm-decoupage']], ['S02', R.RESUME_S02, ['sw-etats-port', 'sw-ssh-ordre', 'sw-portsec-modes']], ['ROUTAGE', R.RESUME_ROUTAGE, ['rt-statique', 'rt-table', 'rt-flottante', 'rip-principe', 'rip-resume-auto']], ['S05', R.RESUME_S05, ['vtp-modes', 'vtp-revision', 'dtp-modes']], ['TP2', R.RESUME_TP2_CISCO, ['tp2-topologie']]]) {
  assert(K.incoherencesRappel(r).length === 0, `résumé conforme : ${nom}`, K.incoherencesRappel(r).join(' ; '));
  assert(r.sections.length >= 3 && r.essentiel.length >= 5 && r.commandes.length >= 4 && r.questions.length >= 3 && r.pieges.length >= 3, `résumé substantiel : ${nom}`);
  const utilises = new Set(r.sections.flatMap((s) => s.schemas ?? []));
  assert(schemas.every((s) => utilises.has(s)), `schémas attendus dans le résumé : ${nom}`, schemas.filter((s) => !utilises.has(s)).join());
}
{
  const ctx = { fiche: (id) => { const e = T.entreeParId(id); return e ? { titre: e.titre, etapes: e.procedure.methodes[0].etapes } : null; }, assistant: () => null };
  for (const cid of COURS_IDS) {
    const c = K.COURS_PAR_ID.get(cid);
    const html = VC.coursPageMarkup(c, 'A', {}, ctx);
    assert(/<details class="cours-resume" id="resume-cours">/.test(html) && !/id="resume-cours" open/.test(html), `résumé PLIÉ par défaut : ${cid}`);
    assert(VC.coursPageMarkup(c, 'resume', {}, ctx).includes('id="resume-cours" open'), `route /resume : déplié : ${cid}`);
    const n = c.rappelCours.sections.reduce((a, s) => a + (s.schemas ?? []).length, 0);
    assert((html.match(/class="schema"/g) ?? []).length >= n, `schémas du résumé affichés : ${cid}`, String((html.match(/class="schema"/g) ?? []).length));
    assert((html.match(/class="rappel-question"/g) ?? []).length === c.rappelCours.questions.length, `une question repliée par question : ${cid}`);
    assert(!/<script|onclick=|javascript:/i.test(html), `aucun script dans le marquage : ${cid}`);
  }
  const liste = VC.coursListeMarkup(K.COURS.filter((c) => c.plateformes.includes('Cisco')), {}, ctx, 'Cisco');
  assert(COURS_IDS.every((cid) => liste.includes(`${cid}/resume`)), 'chaque carte de cours Cisco propose un lien direct vers le résumé');
}

// ---------------------------------------------------------------------------
console.log('7. Les 14 schémas originaux');
{
  assert(SCHEMAS_NEUFS.every((id) => S.IDS_SCHEMAS.includes(id)) && S.IDS_SCHEMAS.length >= 22, '14 schémas ajoutés aux 8 de la semaine 7');
  const tmp = mkdtempSync(resolve(tmpdir(), 'svg-'));
  for (const id of SCHEMAS_NEUFS) {
    const sc = S.SCHEMAS[id]; const svg = sc.svg();
    assert(svg.startsWith('<svg ') && svg.endsWith('</svg>'), `SVG complet : ${id}`);
    assert(/role="img"/.test(svg) && /<title id="[^"]+">[^<]{10,}<\/title>/.test(svg) && /<desc id="[^"]+">[^<]{30,}<\/desc>/.test(svg), `titre et description pour lecteur d’écran : ${id}`);
    assert(S.altSchema(id)?.length >= 30, `texte alternatif : ${id}`);
    assert(!/<image|data:|href=|<script|<foreignObject|onload=|xlink/i.test(svg), `aucune image embarquée, aucun lien, aucun script : ${id}`);
    assert(/viewBox="0 0 \d+ \d+"/.test(svg) && !/NaN|undefined/.test(svg), `viewBox et aucune valeur invalide : ${id}`);
    assert(sc.legende.length >= 40 && sc.titre.length >= 10, `légende et titre : ${id}`);
    assert(S.figureMarkup(id).includes('<figcaption>'), `figure + légende : ${id}`);
    const f = resolve(tmp, `${id}.svg`); writeFileSync(f, svg);
    try { execFileSync('xmllint', ['--noout', f], { stdio: 'pipe' }); assert(true, `XML bien formé : ${id}`); } catch (e) { assert(false, `XML bien formé : ${id}`, String(e.stderr ?? e.message).slice(0, 200)); }
  }
  // Jamais la couleur seule : les schémas d'état disent aussi l'état par un symbole ET un mot
  for (const id of ['sw-etats-port', 'sw-portsec-modes', 'vtp-modes', 'dtp-modes', 'rt-flottante', 'rip-resume-auto', 'vtp-revision']) {
    const svg = S.SCHEMAS[id].svg();
    assert(/[✓✗⚠⊘]/.test(svg), `symbole en plus de la couleur : ${id}`);
  }
  const dtp = S.SCHEMAS['dtp-modes'].svg();
  assert((dtp.match(/✓ trunk/g) ?? []).length === 8 && (dtp.match(/⚠ conflit/g) ?? []).length === 2, 'matrice DTP : 8 combinaisons forment un trunk, 2 sont en conflit', `${(dtp.match(/✓ trunk/g) ?? []).length}/${(dtp.match(/⚠ conflit/g) ?? []).length}`);
  const pm = S.SCHEMAS['sw-portsec-modes'].svg();
  assert(pm.includes('protect') && pm.includes('restrict') && pm.includes('shutdown') && pm.includes('err-disabled'), 'schéma des violations : trois modes et err-disabled');
}

// ---------------------------------------------------------------------------
console.log('8. Pages de fiche, classement et aide-mémoire');
{
  const e = T.entreeParId('cours-rt-statique');
  const html = VT.tachePageMarkup(e, { methodeId: 'ios', saisies: exemple(e.procedure) });
  assert(html.includes('id="schemas-fiche" open') && (html.match(/class="schema"/g) ?? []).length === e.procedure.figures.length, 'fiche route statique : schémas dépliés');
  assert(html.includes('id="rappel-cours"') && !/id="rappel-cours" open/.test(html), 'fiche route statique : rappel du cours PLIÉ');
  assert(!/<script|onclick=|javascript:/i.test(html), 'aucun script dans la page de fiche');
  const fam = C.noeud('reseau-cisco', 'routage')?.famille;
  assert(fam && ['cours-rt-interface-ip', 'cours-rt-statique', 'cours-rt-defaut-flottante', 'cours-rt-tester', 'cours-rip-configurer', 'cours-rip-verifier'].every((id) => fam.fiches.includes(id)), 'famille « Routage » du catalogue Cisco : 6 fiches');
  const memoIds = ['cisco-adressage-routage', 'cisco-acces-ports', 'cisco-vlan-vtp'];
  assert(memoIds.every((id) => M.MEMO_PAR_ID.has(id)), '3 groupes d’aide-mémoire ajoutés');
  const rangees = memoIds.flatMap((id) => M.fichesDuGroupe(M.MEMO_PAR_ID.get(id)));
  assert(rangees.length === 17 && IDS.every((id) => rangees.includes(id)), 'les 17 fiches sont rangées une fois, dans les trois groupes', String(rangees.length));
  assert(IDS.every((id) => M.AJOUTS[id]), 'badge « nouveau » : les 17 fiches ont une date d’ajout');
  const pbMemo = M.incoherencesMemo({ existe: (id) => Boolean(T.entreeParId(id)), fichesAttendues: IDS });
  assert(pbMemo.length === 0, 'aide-mémoire cohérent', pbMemo.join(' | '));
  const lies = M.fichesDuCours(K.COURS_PAR_ID.get('cisco-tp2-routage-statique'));
  assert(['cours-rt-statique', 'cours-rt-interface-ip', 'cours-sw-gestion-ip', 'cours-base-peripherique'].every((id) => lies.has(id)), 'filtre « Liés au TP » : le TP2 retrouve ses fiches');
  // classement des fiches sans assistant : chacune est placée directement
  for (const id of ['cours-config-portable', 'cours-sw-duplex-vitesse', 'cours-sw-diagnostiquer-port', 'cours-sw-ports-inutilises', 'cours-vtp-transparent-etendus']) assert(C.estPlaceDirect(id), `placée directement : ${id}`);
}

// ---------------------------------------------------------------------------
console.log('9. Recherche');
{
  for (const [req, attendu] of [['route statique', 'cours-rt-statique'], ['route flottante', 'cours-rt-defaut-flottante'], ['rip version 2', 'cours-rip-configurer'], ['switchport port-security violation', 'cours-sw-portsec'], ['vtp mode client', 'cours-vtp-reseau'],
    ['vlan etendu 2000', 'cours-vtp-transparent-etendus'], ['switchport mode dynamic desirable', 'cours-dtp-trunk'], ['ports inutilises shutdown', 'cours-sw-ports-inutilises'], ['duplex vitesse', 'cours-sw-duplex-vitesse'], ['banner motd', 'cours-base-peripherique'],
    ['ping traceroute', 'cours-rt-tester'], ['ip default-gateway switch', 'cours-sw-gestion-ip'], ['sauvegarder configuration fichier texte', 'cours-config-portable'], ['clock rate serie', 'cours-rt-interface-ip']]) {
    const res = T.chercher(req, { plateforme: 'Cisco' });
    const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 5).includes(attendu), `recherche « ${req} » : ${attendu} parmi les 5 premiers`, ids.slice(0, 5).join());
  }
}

console.log(`\ncisco-reseau : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, commutateur, routeur) : NON EXÉCUTÉE. Contrat, rendu des commandes, calculs, schémas et résumés vérifiés seulement.');
process.exit(failed ? 1 : 0);
