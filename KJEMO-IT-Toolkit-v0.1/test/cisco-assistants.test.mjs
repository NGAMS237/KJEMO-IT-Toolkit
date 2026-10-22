#!/usr/bin/env node
/**
 * cisco-assistants.test.mjs — RESEAU-CISCO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Banc des 19 assistants Cisco IOS (socle + VLAN / trunks / DTP / VTP).
 *
 * NIVEAUX DE PREUVE, NE JAMAIS CONFONDUS
 *
 *   LOCAL / TEXTE   le banc LIT les fichiers de commandes produits : contrats de
 *                   fiche, validation, refus, absence de commandes interdites.
 *                   Il n'exécute AUCUNE commande IOS.
 *   SIMULATEUR      NON EXÉCUTÉ. Packet Tracer n'est pas disponible ici ; aucun
 *                   fichier .pka n'existe, aucun résultat observé n'est inventé.
 *   ÉQUIPEMENT      NON EXÉCUTÉ. Aucun commutateur réel (référence documentaire :
 *                   Cisco C1000-24T-4G-L) n'a reçu ces commandes.
 *
 * La syntaxe IOS n'est rapprochée que de la documentation publique de Cisco.
 * Une détection textuelle des secrets reste une heuristique : ce banc ne la
 * présente pas comme une garantie universelle.
 *
 * CONTRE-ÉPREUVES. Un contrôle qui n'a jamais échoué ne prouve rien : chaque
 * contrôle de sortie est éprouvé sur un texte volontairement fautif et le banc
 * exige que la faute soit DÉTECTÉE (et que le contrôle s'applique bien).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0;
const echecs = [];
const assert = (cond, msg) => {
  if (cond) { ok += 1; console.log(`  [OK]    ${msg}`); }
  else { echecs.push(msg); console.log(`  [FAIL]  ${msg}`); }
};
const section = (t) => console.log(`\n--- ${t} ---`);
const imp = (f) => import(pathToFileURL(join(ROOT, f)).href);

const { tools } = await imp('dist/generators.mjs');
const V = await imp('dist/validateurs-cisco.mjs');
const A = await imp('dist/analyse-cisco.mjs');
const P = await imp('dist/plateforme.mjs');
const { normalizeIos, VERSION_CISCO, ascii, commentaire, outilCisco } = await imp('dist/noyau-cisco.mjs');
const { SOUS_RUBRIQUES_CISCO, CATEGORIES } = await imp('dist/categories.mjs');
const { SRC, toutesLesSources } = await imp('dist/sources-cisco.mjs');

const cisco = tools.filter((t) => t.category === 'Réseau et Cisco');
const parId = Object.fromEntries(cisco.map((t) => [t.id, t]));

const CHAMPS_FICHE = ['id', 'icon', 'category', 'subcategory', 'title', 'risk', 'summary',
  'fields', 'validate', 'generate', 'gui', 'keywords', 'requiresAdmin', 'os', 'prereqs',
  'commonErrors', 'reversible', 'verifyAfter', 'rollback', 'checks', 'source', 'sources'];

// Valeurs de départ : défauts, plus de quoi rendre une configuration VALIDE.
const SPECIFIQUE = {
  'cisco-identification': { ciscoNouveauNom: 'SW-LAB-02', ciscoBanniere: 'Acces reserve aux administrateurs' },
  'cisco-table-mac': { ciscoEffacement: 'interface' },
  'cisco-vtp-configuration': { ciscoVtpRevisionLue: true },
};
const defauts = (t) => Object.fromEntries(t.fields.map((f) => [f.id, f.type === 'checkbox' ? Boolean(f.default) : String(f.default ?? '')]));
const phraseDe = (t, v) => {
  const e = t.validate({ ...v, ciscoMode: 'Configuration', ciscoConfirmation: '' }).ciscoConfirmation ?? '';
  const m = /« (.+?) »/.exec(e);
  return m ? m[1] : null;
};
/** Valeurs valides pour un mode donné (Configuration → avec la phrase exacte). */
function valeurs(t, mode = 'Lecture', pres = 'Commente', extra = {}) {
  const v = { ...defauts(t), ...(SPECIFIQUE[t.id] ?? {}), ...extra, ciscoPresentation: pres };
  if (t.fields.some((f) => f.id === 'ciscoMode')) {
    v.ciscoMode = mode;
    if (mode === 'Configuration') v.ciscoConfirmation = phraseDe(t, v) ?? '';
    else v.ciscoConfirmation = '';
  }
  return v;
}
const modifiant = (t) => t.fields.some((f) => f.id === 'ciscoMode');
const lignesActives = (s) => s.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('!'));

// ---------------------------------------------------------------------------
// Contrôles de SORTIE, isolés pour pouvoir être éprouvés sur des textes fautifs
// ---------------------------------------------------------------------------
const INTERDITES_ACTIVES = /^(?:no\s+vlan\b|delete\b|erase\b|write\s+erase|reload\b|format\b|copy\s+(?:\S+\s+)?\S*running-config\b.*\bstartup|vlan\s+database|shutdown\s*$|interface\s+range\b|clear\s+(?:mac|port-security)[^\n]*\b(?:all)\b|switchport\s+trunk\s+allowed\s+vlan\s+(?:all|none|except|\d))/i;
const SAUVEGARDE_ACTIVE = /^(?:copy\s+running-config\s+startup-config|write(?:\s+memory)?|wr)\s*$/i;
const LECTURE_AUTORISEE = /^(?:show|ping|enable|terminal length 0|do show)\b/i;
function violationsSortie(s, { lecture, sauvegardeAutorisee = false } = {}) {
  const v = [];
  if (/[^\x00-\x7f]/.test(s)) v.push('caractère non ASCII');
  if (s.includes('?')) v.push('point d’interrogation');
  if (/\t/.test(s)) v.push('tabulation');
  if (/\r/.test(s)) v.push('retour chariot');
  if (!s.endsWith('\n') || s.endsWith('\n\n')) v.push('saut de ligne final');
  if (/^﻿/.test(s)) v.push('BOM');
  for (const l of lignesActives(s)) {
    if (/^\s*(?:enable\s+(?:secret|password)|username\s+\S+\s+(?:privilege\s+\d+\s+)?(?:secret|password)|vtp\s+password|snmp-server\s+community|password\s+\S|crypto key generate)/i.test(l)) v.push(`secret ou saisie interactive active : ${l}`);
    if (/^\s*shutdown\s*$/i.test(l) && false) v.push(l);
    if (/^(?:no\s+vlan\b|delete\b|erase\b|write\s+erase|reload\b|vlan\s+database)/i.test(l)) v.push(`commande interdite active : ${l}`);
    if (/^\s*switchport\s+trunk\s+allowed\s+vlan\s+(?:all|none|except|\d)/i.test(l)) v.push(`liste de VLAN autorisés REMPLACÉE : ${l}`);
    if (/^interface\s+range\b/i.test(l)) v.push(`plage d’interfaces : ${l}`);
    if (/^clear\s+(?:mac\s+address-table|port-security)\b(?!.*\b(?:interface|vlan|address)\b)/i.test(l)) v.push(`effacement général : ${l}`);
    if (!sauvegardeAutorisee && SAUVEGARDE_ACTIVE.test(l)) v.push(`sauvegarde persistante active : ${l}`);
    if (lecture && !LECTURE_AUTORISEE.test(l)) v.push(`ligne non-lecture en mode Lecture : ${l}`);
  }
  return v;
}

// ===========================================================================
section('Catalogue : 19 assistants Cisco ; 153 historiques (+ 24 Azure une fois intégré) : aucun outil existant touché');
assert(cisco.length === 19, `19 assistants Cisco (${cisco.length})`);
const nbAzure = tools.filter((t) => t.category === 'Azure et Entra ID').length;
assert(nbAzure === 0 || nbAzure === 24, `Azure absent (branche Cisco seule) ou complet : 24 (${nbAzure})`);
const nbImpression = tools.filter((t) => t.category === 'Imprimantes').length;
assert(nbImpression === 0 || nbImpression === 15, `Imprimantes absent (branches Azure/Cisco) ou complet : 15 (${nbImpression})`);
assert(tools.length === 153 + nbAzure + 19 + nbImpression,
  `catalogue = 153 historiques + ${nbAzure} Azure + 19 Cisco + ${nbImpression} Imprimantes (${tools.length})`);
assert(tools.filter((t) => t.category !== 'Réseau et Cisco').every((t) => P.plateformeDe(t) !== 'Cisco'),
  'aucun outil historique ne déclare la plateforme Cisco');
assert(new Set(cisco.map((t) => t.id)).size === 19, 'identifiants uniques');
assert(CATEGORIES.some((c) => c.name === 'Réseau et Cisco'), 'catégorie « Réseau et Cisco » déclarée');
assert(!tools.some((t) => t.id === 'ipv4-subnet-calculator' && t.category === 'Réseau et Cisco'),
  'le calculateur de sous-réseaux IPv4 existant n’est ni dupliqué ni déplacé');
assert(SOUS_RUBRIQUES_CISCO.length === 6 && cisco.every((t) => SOUS_RUBRIQUES_CISCO.includes(t.subcategory)),
  'chaque assistant porte une des six sous-rubriques prévues');
assert(SOUS_RUBRIQUES_CISCO.every((s) => cisco.some((t) => t.subcategory === s)), 'aucune sous-rubrique vide');
for (const t of cisco) {
  for (const c of CHAMPS_FICHE) assert(t[c] !== undefined && t[c] !== null, `${t.id} : champ de fiche « ${c} »`);
  assert(P.plateformeDe(t) === 'Cisco' && P.sortieDe(t) === '.ios.txt' && P.extensionDe(t) === '.ios.txt', `${t.id} : plateforme Cisco, sortie .ios.txt`);
  assert(P.estIOS(t) && !P.estBash(t), `${t.id} : estIOS et non Bash`);
  assert(P.nomFichierDe(t) === `${t.id}.ios.txt`, `${t.id} : nom de fichier ${t.id}.ios.txt`);
  assert(P.commandesExecution(t).length === 0, `${t.id} : aucune commande d’exécution PowerShell/Bash proposée`);
  assert(P.incoherencesPlateforme(t).length === 0, `${t.id} : plateforme cohérente (${P.incoherencesPlateforme(t).join(' | ')})`);
  assert(t.requiresAdmin === false, `${t.id} : aucune élévation locale`);
  assert(t.gui.length >= 3 && t.prereqs.length >= 3 && t.verifyAfter.length >= 2 && t.commonErrors.length >= 2, `${t.id} : étapes, prérequis, vérifications, erreurs`);
  assert(t.rollback.summary && t.rollback.diagnostic && t.rollback.command, `${t.id} : retour en arrière en trois blocs`);
  assert(t.commonErrors.every((e) => e.message && e.cause && e.fix), `${t.id} : chaque erreur a message, cause, correctif`);
  assert(t.sources.length >= 2 && [t.source, ...t.sources.map((s) => s.url)].every((u) => /^https:\/\/www\.cisco\.com\/c\/en\/us\/\S+\.html$/.test(u)),
    `${t.id} : sources sur des pages cisco.com précises`);
  const c = t.cisco;
  for (const k of ['probleme', 'utilite', 'exemple', 'lecture', 'effets', 'attendu', 'limites', 'validation', 'materiel']) {
    assert(c[k] !== undefined && String(c[k]).length > 0, `${t.id} : contrat pédagogique « ${k} »`);
  }
  assert(/non (?:test|exécut)/i.test(c.validation) && /C1000-24T-4G-L/.test(c.materiel) && /non test/i.test(c.materiel),
    `${t.id} : matériel de référence nommé et déclaré NON testé`);
  assert(!/compatible avec (?:tous|toutes)|tous les (?:Cisco|commutateurs)|fonctionne sur tout/i.test(JSON.stringify([t.os, t.cisco, t.summary])) && /Aucune compatibilité universelle n’est revendiquée/.test(t.cisco.limites.join(' ') + t.cisco.validation.join(' ')),
    `${t.id} : aucune compatibilité universelle revendiquée (et le dit)`);
  assert(t.readOnly === !modifiant(t), `${t.id} : lecture seule ⇔ pas de sélecteur de mode`);
  if (modifiant(t)) assert(t.confirmation === true && t.risk === 'caution', `${t.id} : outil modifiant = confirmation + risque « caution »`);
  else assert(t.risk === 'diagnostic', `${t.id} : outil de lecture = risque « diagnostic »`);
}
assert(cisco.filter((t) => t.reversible === false).map((t) => t.id).join() === 'cisco-config-sauvegarde',
  'seule la sauvegarde de la startup-config est déclarée irréversible');

// ===========================================================================
section('Génération : 19 assistants × 2 modes × 2 présentations');
for (const t of cisco) {
  const modes = modifiant(t) ? ['Lecture', 'Configuration'] : ['Lecture'];
  for (const mode of modes) for (const pres of ['Commente', 'Commandes seules']) {
    const v = valeurs(t, mode, pres);
    const errs = t.validate(v);
    assert(Object.keys(errs).length === 0, `${t.id} / ${mode} / ${pres} : valeurs valides (${JSON.stringify(errs).slice(0, 100)})`);
    const s = t.generate(v);
    const viol = violationsSortie(s, { lecture: mode === 'Lecture' && pres === 'Commandes seules', sauvegardeAutorisee: t.id === 'cisco-config-sauvegarde' && mode === 'Configuration' });
    assert(viol.length === 0, `${t.id} / ${mode} / ${pres} : sortie conforme (${viol.slice(0, 2).join(' ; ')})`);
    assert(s === normalizeIos(s), `${t.id} / ${mode} / ${pres} : sortie déjà normalisée (idempotence)`);
    if (pres === 'Commente') {
      assert(s.includes(v.ciscoCible) && /^! KJEMO IT Toolkit/m.test(s), `${t.id} / ${mode} : en-tête avec le nom de l’équipement visé`);
      assert(s.includes(ascii(VERSION_CISCO)), `${t.id} : version ${ascii(VERSION_CISCO)}`);
    } else {
      assert(!/^!/m.test(s), `${t.id} / ${mode} : « Commandes seules » ne contient aucune ligne de commentaire`);
    }
    if (mode === 'Lecture' && modifiant(t)) {
      // La configuration reste en COMMENTAIRE : rien à coller qui modifie.
      assert(lignesActives(s).every((l) => LECTURE_AUTORISEE.test(l)), `${t.id} : en mode Lecture, toutes les lignes actives sont des lectures`);
    }
  }
}
// La sauvegarde n'est JAMAIS active ailleurs que dans son assistant dédié.
for (const t of cisco.filter((x) => x.id !== 'cisco-config-sauvegarde')) {
  for (const mode of modifiant(t) ? ['Lecture', 'Configuration'] : ['Lecture']) {
    const s = t.generate(valeurs(t, mode));
    assert(!lignesActives(s).some((l) => SAUVEGARDE_ACTIVE.test(l)), `${t.id} / ${mode} : aucune sauvegarde persistante active`);
    if (mode === 'Configuration') assert(/sauvegarde persistante|copy running-config startup-config/i.test(s.split('\n').filter((l) => l.startsWith('!')).join('\n')), `${t.id} : la sauvegarde est expliquée en commentaire`);
  }
}
{
  const s = parId['cisco-config-sauvegarde'].generate(valeurs(parId['cisco-config-sauvegarde'], 'Configuration', 'Commandes seules'));
  assert(lignesActives(s).some((l) => /^copy running-config startup-config$/.test(l)), 'cisco-config-sauvegarde / Configuration : la sauvegarde est la seule commande de modification');
  const sl = parId['cisco-config-sauvegarde'].generate(valeurs(parId['cisco-config-sauvegarde'], 'Lecture', 'Commandes seules'));
  assert(!lignesActives(sl).some((l) => SAUVEGARDE_ACTIVE.test(l)), 'cisco-config-sauvegarde / Lecture : pas de sauvegarde');
}

// ===========================================================================
section('Confirmation : phrase exacte, sensible à la casse, jamais en mode Lecture');
for (const t of cisco.filter(modifiant)) {
  const base = valeurs(t, 'Configuration');
  const phrase = base.ciscoConfirmation;
  assert(/^(CONFIGURER|SAUVEGARDER|EFFACER)\b/.test(phrase), `${t.id} : phrase de confirmation connue (« ${phrase} »)`);
  assert(Object.keys(t.validate(base)).length === 0, `${t.id} : phrase exacte acceptée`);
  for (const [nom, c] of [['vide', ''], ['minuscules', phrase.toLowerCase()], ['espace final', `${phrase} `], ['tronquée', phrase.slice(0, -1)], ['autre cible', phrase.replace(/\S+$/, 'ZZ')], ['saut de ligne', `${phrase}\nreload`]]) {
    assert(t.validate({ ...base, ciscoConfirmation: c }).ciscoConfirmation, `${t.id} : confirmation ${nom} refusée`);
  }
  assert(t.validate({ ...base, ciscoMode: 'Lecture', ciscoConfirmation: 'xyz' }).ciscoConfirmation, `${t.id} : confirmation étrangère refusée en Lecture`);
  assert(Object.keys(t.validate({ ...base, ciscoMode: 'Lecture', ciscoConfirmation: '' })).length === 0, `${t.id} : Lecture sans confirmation acceptée`);
  assert(t.validate({ ...base, ciscoMode: 'Autre' }).ciscoMode, `${t.id} : mode inconnu refusé`);
  let leve = false; try { t.generate({ ...base, ciscoConfirmation: '' }); } catch { leve = true; }
  assert(leve, `${t.id} : generate() refuse une configuration sans confirmation`);
}

// ===========================================================================
section('Validateurs : cas limites');
const ok_ = (r) => r.ok === true;
{
  assert(ok_(V.validerHostnameIos('SW-LAB-01')) && ok_(V.validerHostnameIos('DS1')), 'nom d’hôte valide');
  for (const x of ['', '1SW', 'SW_01', 'SW-', 'SW 01', 'SW\n01', 'SW?', 'a'.repeat(64), 'é', 'SW;reload']) assert(!ok_(V.validerHostnameIos(x)), `nom d’hôte refusé : ${JSON.stringify(x).slice(0, 30)}`);
  const i2 = (x) => V.validerInterfaceIos(x, '2960'); const ip = (x) => V.validerInterfaceIos(x, 'pile');
  assert(i2('Fa0/7').valeur === 'FastEthernet0/7' && i2('fa0/7').valeur === 'FastEthernet0/7' && i2('Gi0/1').valeur === 'GigabitEthernet0/1', 'Fa0/7 et Gi0/1 acceptés en 2960, nom long canonique');
  assert(ip('Gi1/0/7').valeur === 'GigabitEthernet1/0/7', 'Gi1/0/7 accepté en numérotation à trois nombres');
  assert(!ok_(i2('Gi1/0/7')) && !ok_(ip('Fa0/7')) && !ok_(ip('Gi0/1')), 'Fa/Gi à deux nombres et Gi1/0/x ne se mélangent pas');
  for (const x of ['Fa0/1-5', 'Fa0/1,Fa0/2', 'range Fa0/1', 'Fa0/*', 'Fa0/07', 'Fa0/53', 'Fa0/0', 'Fa0/7 shutdown', 'Fa0/7\nreload', 'Fa0/7?', 'Vlan1', 'Loopback0', '']) assert(!ok_(i2(x)), `interface refusée : ${JSON.stringify(x)}`);
  assert(ok_(V.validerVlanIos('10')) && ok_(V.validerVlanIos(' 4094 ')), 'VLAN 10 et 4094 acceptés');
  for (const x of ['0', '1', '1002', '1005', '4095', '010', '-1', '1e2', '10;20', '10,20', '10\n', 'abc', '']) assert(!ok_(V.validerVlanIos(x)), `VLAN refusé : ${JSON.stringify(x)}`);
  assert(ok_(V.validerVlanIos('1', { lecture: true })) && ok_(V.validerVlanIos('1003', { lecture: true })), 'VLAN 1 et 1003 lisibles en lecture');
  const l = (x) => V.validerListeVlansIos(x);
  assert(l('10,20,30-35').valeur === '10,20,30-32,33,34,35' || l('10,20,30-35').valeur.startsWith('10,20,30'), 'liste de VLAN normalisée');
  assert(l('30,10,20,10').ids.join() === '10,20,30', 'liste triée et dédoublonnée');
  assert(l('10,11,12,20').valeur === '10-12,20', 'liste compactée en plages');
  for (const x of ['all', 'ALL', 'none', 'except 10', '1-5', '10,', ',10', '35-30', '10-', '10 20x', '1,10', '4095', '2-70', '10;reload', '']) assert(!ok_(l(x)), `liste de VLAN refusée : ${JSON.stringify(x)}`);
  assert(ok_(V.validerNomVlanIos('RH')) && ok_(V.validerNomVlanIos('Ventes_Nord-2')), 'noms de VLAN valides');
  for (const x of ['', '1RH', 'R H', 'RH?', 'RH\nname x', 'é', 'a'.repeat(33)]) assert(!ok_(V.validerNomVlanIos(x)), `nom de VLAN refusé : ${JSON.stringify(x).slice(0, 20)}`);
  assert(ok_(V.validerDomaineVtp('CCNA-LAB')) && V.validerDomaineVtp('ccna-lab').valeur === 'ccna-lab', 'domaine VTP : casse conservée');
  for (const x of ['', 'CCNA LAB', 'CCNA?', 'a'.repeat(33), 'x\ny', 'password=abc']) assert(!ok_(V.validerDomaineVtp(x)), `domaine VTP refusé : ${JSON.stringify(x).slice(0, 20)}`);
  assert(V.validerMacIos('AA:BB:CC:DD:EE:01').valeur === 'aabb.ccdd.ee01' && V.validerMacIos('aabb.ccdd.ee01').valeur === 'aabb.ccdd.ee01', 'MAC normalisée au format Cisco');
  for (const x of ['', '0000.0000.0000', 'ffff.ffff.ffff', '0100.5e00.0001', 'aabb.ccdd', 'zzzz.zzzz.zzzz', 'aabb.ccdd.ee01 x']) assert(!ok_(V.validerMacIos(x)), `MAC refusée : ${JSON.stringify(x)}`);
  const m = V.validerIpMasqueIos('192.168.99.10', '255.255.255.0');
  assert(m.ok && m.valeur.prefixe === 24 && m.valeur.reseau === '192.168.99.0' && m.valeur.diffusion === '192.168.99.255', 'IP + masque : préfixe, réseau, diffusion');
  for (const [a, b] of [['192.168.99.0', '255.255.255.0'], ['192.168.99.255', '255.255.255.0'], ['127.0.0.1', '255.0.0.0'], ['224.0.0.1', '255.255.255.0'], ['192.168.99.10', '255.0.255.0'], ['192.168.99.10', '255.255.255.255'], ['192.168.099.10', '255.255.255.0'], ['192.168.99', '255.255.255.0'], ['192.168.99.10', '0.0.0.255']]) assert(!V.validerIpMasqueIos(a, b).ok, `IP/masque refusés : ${a} ${b}`);
  assert(V.validerPasserelleIos('192.168.99.1', m.valeur).ok, 'passerelle dans le sous-réseau acceptée');
  for (const g of ['192.168.99.10', '192.168.100.1', '192.168.99.255', '192.168.99.0', 'x']) assert(!V.validerPasserelleIos(g, m.valeur).ok, `passerelle refusée : ${g}`);
  assert(V.validerCibleIpv4('192.168.99.1').ok && !V.validerCibleIpv4('224.0.0.1').ok && !V.validerCibleIpv4('0.0.0.0').ok && !V.validerCibleIpv4('h;ping').ok, 'cible de ping validée');
}

// ===========================================================================
section('Secrets et injections : tous les champs texte de tous les assistants');
{
  assert(V.secretsDans('enable secret 5 $1$abcd$xyz').length > 0 && V.secretsDans('username admin password cisco').length > 0
    && V.secretsDans('vtp password monmotdepasse').length > 0 && V.secretsDans('snmp-server community prive RW').length > 0
    && V.secretsDans('password=abc').length > 0 && V.secretsDans('SW-LAB-01').length === 0,
    'heuristique de secrets : détecte les formes connues, ne bloque pas un nom ordinaire (HEURISTIQUE, pas une garantie)');
  const CHARGES = [
    ['saut de ligne', 'SW-A\nreload'], ['CRLF', 'SW-A\r\nwrite erase'], ['NUL', 'SW\u0000A'], ['point d’interrogation', 'SW?A'],
    ['tabulation', 'SW\tA'], ['accent', 'SWé'], ['secret enable', 'enable secret 5 $1$abcd$xyz'], ['secret username', 'username admin password cisco123'],
    ['secret vtp', 'vtp password mdp'], ['hachage', '$1$abcd$efghijkl'], ['mot de passe =', 'password=Cisco123'],
  ];
  let nbChamps = 0;
  for (const t of cisco) {
    const textes = t.fields.filter((f) => f.type === 'text');
    for (const f of textes) {
      for (const [nom, charge] of CHARGES) {
        nbChamps += 1;
        const base = valeurs(t, modifiant(t) ? 'Configuration' : 'Lecture');
        const errs = t.validate({ ...base, [f.id]: charge });
        let refus = Boolean(errs[f.id]) || Object.keys(errs).length > 0;
        if (!refus) {
          // Accepté ? Alors la charge ne doit apparaître nulle part, et la sortie reste conforme.
          const s = t.generate({ ...base, [f.id]: charge });
          refus = false;
          assert(violationsSortie(s).length === 0 && !s.includes('reload') && !s.includes('write erase'), `${t.id}.${f.id} : charge « ${nom} » acceptée mais sortie conforme`);
        } else {
          assert(true, `${t.id}.${f.id} : charge « ${nom} » refusée`);
        }
        if (['saut de ligne', 'CRLF', 'NUL', 'point d’interrogation', 'tabulation', 'accent'].includes(nom) || nom.startsWith('secret') || nom === 'hachage' || nom === 'mot de passe =') {
          assert(refus, `${t.id}.${f.id} : charge dangereuse « ${nom} » REFUSÉE`);
        }
      }
    }
  }
  assert(nbChamps > 200, `${nbChamps} combinaisons champ × charge éprouvées`);
  // Champs numériques et choix : valeurs hors liste ou non numériques
  for (const t of cisco) for (const f of t.fields.filter((x) => x.type === 'select' || x.type === 'number')) {
    const base = valeurs(t, modifiant(t) ? 'Configuration' : 'Lecture');
    const errs = t.validate({ ...base, [f.id]: f.type === 'number' ? '1; reload' : 'hors-liste\nreload' });
    assert(errs[f.id] || Object.keys(errs).length > 0, `${t.id}.${f.id} : valeur hors liste ou non numérique refusée`);
  }
  // Zones de texte (sorties collées) : jamais de secret ni d'extrait de configuration
  for (const t of cisco.filter((x) => x.fields.some((f) => f.type === 'textarea'))) {
    for (const f of t.fields.filter((x) => x.type === 'textarea')) {
      for (const [nom, charge] of [['secret', 'enable secret 5 $1$abcd$xyz'], ['extrait de configuration', 'username admin privilege 15 secret 5 x\nline vty 0 4'], ['caractère de contrôle', 'a\u0007b'], ['trop long', 'x'.repeat(30001)], ['vtp password', 'VTP password: abc']]) {
        assert(t.validate({ ...valeurs(t), [f.id]: charge })[f.id], `${t.id}.${f.id} : ${nom} refusé dans la sortie collée`);
      }
      assert(!t.validate({ ...valeurs(t), [f.id]: '' })[f.id], `${t.id}.${f.id} : champ vide accepté (facultatif)`);
    }
  }
}

// ===========================================================================
section('Règles propres aux assistants');
{
  const tp = parId['cisco-trunk-preparation'];
  const base = (extra) => valeurs(tp, 'Configuration', 'Commandes seules', extra);
  const sortie = (extra) => tp.generate(base(extra));
  assert(/switchport trunk allowed vlan add 10,20,30\n/.test(sortie()), 'trunk : la liste est AJOUTÉE (add)');
  assert(/switchport trunk allowed vlan remove 10,20,30\n/.test(sortie({ ciscoTrunkAction: 'retirer' })), 'trunk : la liste est RETIRÉE (remove)');
  assert(!/allowed vlan/.test(sortie({ ciscoTrunkAction: 'aucune' })), 'trunk : « aucune » ne touche pas à la liste');
  for (const a of ['ajouter', 'retirer']) for (const liste of ['all', 'none', 'except 10', '10,all']) {
    assert(tp.validate({ ...base({ ciscoTrunkAction: a }), ciscoVlans: liste }).ciscoVlans, `trunk ${a} : « ${liste} » refusé (jamais de remplacement silencieux)`);
  }
  for (const a of ['ajouter', 'retirer', 'aucune']) assert(!lignesActives(sortie({ ciscoTrunkAction: a })).some((l) => /allowed vlan (?!add |remove )/.test(l)), `trunk ${a} : aucune forme « allowed vlan » sans add/remove`);
  assert(/switchport trunk native vlan 99\n/.test(sortie({ ciscoNatif: '99' })) && /switchport nonegotiate\n/.test(sortie({ ciscoNonegotiate: true })) && !/nonegotiate/.test(sortie()), 'trunk : natif et nonegotiate seulement si demandés');
  assert(!/trunk encapsulation/.test(sortie({ ciscoNatif: '99', ciscoNonegotiate: true }).split('\n').filter((l) => !l.startsWith('!')).join('\n')), 'trunk : aucune commande d’encapsulation active (802.1Q seul sur le matériel de référence)');
  assert(/remove 10,20,30/.test(tp.generate({ ...valeurs(tp, 'Configuration', 'Commente') })), 'trunk : le retour en arrière inverse add par remove');
  assert(tp.validate({ ...base(), ciscoMateriel: 'pile', ciscoInterface: 'Fa0/9' }).ciscoInterface && !tp.validate({ ...base(), ciscoMateriel: 'pile', ciscoInterface: 'Gi1/0/9', ciscoConfirmation: 'CONFIGURER GigabitEthernet1/0/9' }).ciscoInterface, 'trunk : Fa0/9 refusé en numérotation Gi1/0/x, Gi1/0/9 accepté');

  const vc = parId['cisco-vlan-creation'];
  const sv = vc.generate(valeurs(vc, 'Configuration', 'Commente'));
  assert(/^vlan 10\n name RH$/m.test(sv) && !/^no vlan|^delete|vlan\.dat/m.test(sv.split('\n').filter((l) => !l.startsWith('!')).join('\n')), 'VLAN : création + nom, aucune suppression ni vlan.dat actif');
  assert(/AUCUNE suppression de VLAN/i.test(sv), 'VLAN : l’absence de suppression est expliquée');

  const pa = parId['cisco-port-access'];
  const sa = pa.generate(valeurs(pa, 'Configuration', 'Commandes seules', { ciscoInterface: 'Fa0/7' }));
  assert(/interface FastEthernet0\/7\n switchport mode access\n switchport access vlan 10/.test(sa) && !/range/.test(sa), 'port d’accès : une interface, mode access puis VLAN');

  const dtp = parId['cisco-dtp-simulation'];
  const ATTENDU = {
    'auto/auto': 'access', 'auto/desirable': 'trunk', 'auto/access': 'access', 'auto/trunk': 'trunk', 'auto/trunk-nonegotiate': 'incoherent',
    'desirable/desirable': 'trunk', 'desirable/access': 'access', 'desirable/trunk': 'trunk', 'desirable/trunk-nonegotiate': 'incoherent',
    'access/access': 'access', 'access/trunk': 'incoherent', 'access/trunk-nonegotiate': 'incoherent',
    'trunk/trunk': 'trunk', 'trunk/trunk-nonegotiate': 'trunk', 'trunk-nonegotiate/trunk-nonegotiate': 'trunk',
  };
  let n = 0;
  for (const [a] of A.MODES_DTP) for (const [b] of A.MODES_DTP) {
    const cle = ATTENDU[`${a}/${b}`] ?? ATTENDU[`${b}/${a}`];
    n += 1;
    assert(A.simulerDtp(a, b).resultat === cle, `DTP ${a} / ${b} → ${cle}`);
    assert(A.simulerDtp(a, b).resultat === A.simulerDtp(b, a).resultat, `DTP ${a}/${b} symétrique`);
  }
  assert(n === 25, 'DTP : les 25 combinaisons sont couvertes');
  assert(A.matriceDtp().flat().every((r) => r.raison.length > 20), 'DTP : chaque résultat est expliqué');
  let leve = false; try { A.simulerDtp('auto', 'bidon'); } catch { leve = true; }
  assert(leve, 'DTP : mode inconnu refusé');
  const sd = dtp.generate({ ...valeurs(dtp), ciscoDtpLocal: 'auto', ciscoDtpDistant: 'auto' });
  assert(/SIMULATION DTP/.test(sd) && /ACCESS/.test(sd) && /rien n a ete lu sur un equipement/.test(sd) && lignesActives(sd).every((l) => /^show\b/.test(l)), 'DTP : la sortie est une simulation annoncée comme telle, avec lectures seules');

  const vc2 = parId['cisco-vtp-configuration'];
  const vb = (extra) => valeurs(vc2, 'Configuration', 'Commente', extra);
  assert(vc2.validate({ ...vb(), ciscoVtpVersion: '3' }).ciscoVtpVersion, 'VTP : version 3 refusée (hors périmètre)');
  assert(vc2.validate({ ...vb(), ciscoVtpMode: 'client', ciscoVtpRevisionLue: false }).ciscoVtpRevisionLue && vc2.validate({ ...vb(), ciscoVtpMode: 'server', ciscoVtpRevisionLue: false }).ciscoVtpRevisionLue, 'VTP : server/client exige la lecture de la révision');
  assert(!vc2.validate({ ...vb(), ciscoVtpMode: 'transparent', ciscoVtpRevisionLue: false }).ciscoVtpRevisionLue, 'VTP : transparent n’exige pas la case');
  assert(!vc2.fields.some((f) => /pass|mdp|secret/i.test(f.id) && f.type === 'text'), 'VTP : aucun champ texte pour un mot de passe');
  const sv2 = vc2.generate(vb({ ciscoVtpMotDePasse: true }));
  assert(/A TAPER A LA MAIN : vtp password <mot de passe du domaine>/.test(sv2) && !lignesActives(sv2).some((l) => /vtp password/.test(l)), 'VTP : le mot de passe est une ligne « à taper à la main », jamais collable');
  assert(!/show vtp password/.test(JSON.stringify(parId['cisco-vtp-diagnostic'].generate(valeurs(parId['cisco-vtp-diagnostic'])).split('\n').filter((l) => !l.startsWith('!')))), 'VTP : « show vtp password » (affiche le secret) n’est jamais proposé en commande');
  assert(/vtp mode client\nvtp domain CCNA-LAB\nvtp version 2/.test(vc2.generate(vb({ ciscoVtpRevisionLue: true }))), 'VTP : mode, domaine, version dans cet ordre');

  const ps = parId['cisco-port-security-config'];
  const r = ps.generate(valeurs(ps, 'Configuration', 'Commandes seules', { ciscoActionPs: 'remettre', ciscoNettoyage: 'dynamic' }));
  assert(/^clear port-security dynamic interface FastEthernet0\/7$/m.test(r) && /^ shutdown\n no shutdown$/m.test(r), 'port-security : remise en service ciblée sur UN port');
  assert(!lignesActives(r).some((l) => /clear port-security (?!dynamic interface|sticky interface)/.test(l)) && !/range/.test(r), 'port-security : aucun nettoyage général, aucune plage');
  assert(!/interface (?!FastEthernet0\/7)/.test(lignesActives(r).join('\n')), 'port-security : aucune autre interface touchée');

  const tm = parId['cisco-table-mac'];
  assert(tm.validate({ ...valeurs(tm, 'Configuration'), ciscoEffacement: 'tout' }).ciscoEffacement, 'table MAC : aucun effacement général');
  assert(tm.validate({ ...valeurs(tm, 'Configuration'), ciscoEffacement: 'aucun' }).ciscoEffacement, 'table MAC : mode Configuration sans cible d’effacement refusé');
  const st = tm.generate(valeurs(tm, 'Configuration', 'Commandes seules'));
  assert(/^clear mac address-table dynamic interface FastEthernet0\/7$/m.test(st), 'table MAC : effacement dynamique ciblé sur une interface');

  const cs = parId['cisco-console-ssh'];
  const ssh = cs.generate(valeurs(cs, 'Lecture', 'Commente', {}));
  assert(/A TAPER A LA MAIN : .*username/i.test(ssh) && /A TAPER A LA MAIN : .*crypto key generate rsa/.test(ssh), 'SSH : compte local et génération de clé = lignes à taper à la main');
  assert(!lignesActives(cs.generate(valeurs(cs, 'Configuration', 'Commandes seules'))).some((l) => /^(username|crypto key|enable)/.test(l)), 'SSH : aucune ligne username / crypto / enable collable');
  assert(cs.validate({ ...valeurs(cs), ciscoUtilisateur: 'admin password x' }).ciscoUtilisateur, 'SSH : un nom d’utilisateur ne peut pas porter un mot de passe');

  const gi = parId['cisco-gestion-ip'];
  const sg = gi.generate(valeurs(gi, 'Configuration', 'Commandes seules'));
  assert(/^interface vlan 99$/m.test(sg) && /^ ip address 192\.168\.99\.\d+ 255\.255\.255\.0$/m.test(sg) && /^ip default-gateway /m.test(sg), 'gestion IP : SVI + passerelle de niveau 2 (ip default-gateway)');
  const g3 = gi.generate(valeurs(gi, 'Configuration', 'Commandes seules', { ciscoNiveau: 'l3' }));
  assert(!/ip default-gateway/.test(lignesActives(g3).join('\n')), 'gestion IP : en niveau 3, pas de ip default-gateway actif');
}

// ===========================================================================
section('Analyseur de sorties collées (échantillons écrits à la main, NON capturés)');
{
  const E = A.ECHANTILLONS_NON_CAPTURES;
  const v = A.analyserVlanBrief(E.vlanBrief);
  assert(v.reconnu && v.vlans.length === 5 && v.vlans.find((x) => x.id === 30).ports.join() === 'Fa0/9,Fa0/10', 'show vlan brief : VLAN et ports (avec ligne de continuation)');
  assert(v.vlans.find((x) => x.id === 1002).etat === 'act/unsup', 'show vlan brief : état act/unsup lu');
  const t = A.analyserTrunks(E.trunk);
  assert(t.reconnu && t.ports['Fa0/9'].natif === 1 && t.ports['Fa0/9'].autorises.join() === '1,10,30' && t.ports['Fa0/9'].forwarding.join() === '1,10', 'show interfaces trunk : natif et trois listes');
  const p = A.analyserVtpStatus(E.vtp);
  assert(p.reconnu && p.mode === 'client' && p.domaine === 'CCNA-LAB' && p.revision === 4 && p.version === 2 && p.vlans === 8, 'show vtp status : mode, domaine, version, révision, VLAN');
  for (const [nom, fn, x] of [['vlan', A.analyserVlanBrief, ''], ['vlan', A.analyserVlanBrief, 'Bonjour'], ['vlan', A.analyserVlanBrief, 'VLAN Name Status Ports\n----'], ['vlan', A.analyserVlanBrief, E.vlanBrief.replace('VLAN Name', 'VLAN Nom')],
    ['trunk', A.analyserTrunks, ''], ['trunk', A.analyserTrunks, E.trunk.replace('Native vlan', 'VLAN natif')], ['trunk', A.analyserTrunks, 'Port Vlans allowed on trunk\nFa0/9 1,10'],
    ['vtp', A.analyserVtpStatus, ''], ['vtp', A.analyserVtpStatus, E.vtp.replace(/VTP Operating Mode.*\n?/, '').replace(/VTP Domain Name.*\n?/, '')], ['vtp', A.analyserVtpStatus, 'Mode opératoire VTP : client']]) {
    const r = fn(x);
    assert(r.reconnu === false && r.raison, `analyseur ${nom} : format non reconnu signalé (${JSON.stringify(x).slice(0, 30)})`);
  }
  assert(A.developperListeVlans('1,10,20-22').join() === '1,10,20,21,22' && A.developperListeVlans('none').length === 0 && A.developperListeVlans('ALL') === 'all' && A.developperListeVlans('x') === null, 'listes de VLAN développées');
  const pa = A.analyserParcours({ scenario: 'vlan-non-transporte', vlan: 20, sorties: { trunk: E.trunk, vlan: E.vlanBrief } });
  assert(pa.constats.some((c) => /VLAN 20 n’est PAS dans les VLAN autorisés/.test(c)) && pa.constats.some((c) => /allowed vlan add 20/.test(c)), 'parcours « non transporté » : VLAN 20 absent du trunk, correction par add');
  const pb = A.analyserParcours({ scenario: 'vlan-non-transporte', vlan: 30, sorties: { trunk: E.trunk, vlan: E.vlanBrief } });
  assert(pb.constats.some((c) => /autorisé, actif et en forwarding/.test(c)) === false && pb.constats.some((c) => /pas en état forwarding/.test(c)), 'parcours : VLAN 30 autorisé et actif mais pas forwarding → signalé sans conclure à tort');
  const pc = A.analyserParcours({ scenario: 'vlan-non-propage', sorties: { vtp: E.vtp.replace('Client', 'Transparent') } });
  assert(pc.constats.some((c) => /transparent/i.test(c)) && pc.manque.some((m) => /trunk/i.test(m)), 'parcours « non propagé » : mode transparent signalé, trunk manquant demandé');
  const pd = A.analyserParcours({ scenario: 'trunk-absent', interface: 'Fa0/7', sorties: { trunk: E.trunk } });
  assert(pd.constats.some((c) => /Fa0\/7 n’apparaît PAS/.test(c)), 'parcours « trunk absent » : interface absente de la liste des trunks');
  const pe = A.analyserParcours({ scenario: 'pc-injoignables', vlan: 10, sorties: {} });
  assert(pe.manque.length >= 2 && pe.constats.length === 0, 'parcours sans sortie : rien n’est conclu, ce qui manque est demandé');
  const pf = A.analyserParcours({ scenario: 'trunk-absent', sorties: { trunk: 'n’importe quoi' } });
  assert(pf.constats.some((c) => /NON RECONNU/.test(c)) && pf.reconnus.trunk === false, 'parcours : sortie inconnue → NON RECONNU, pas de verdict');
  assert([pa, pb, pc, pd, pe, pf].every((r) => r.limites.some((l) => /pas diagnostic exécuté|ne vaut pas diagnostic/i.test(l))), 'toute analyse rappelle qu’elle ne vaut pas diagnostic exécuté');
  // Dans les fichiers produits, l'analyse n'apparaît qu'en commentaire.
  const tp = parId['cisco-parcours-diagnostic'];
  const sf = tp.generate({ ...valeurs(tp), ciscoScenario: 'vlan-non-transporte', ciscoVlan: '20', ciscoSortieTrunk: E.trunk, ciscoSortieVlan: E.vlanBrief });
  assert(/ANALYSE DES SORTIES COLLEES/.test(sf) && /Constat/.test(sf) && !sf.includes('Ventes') && !sf.includes('1,10,30'), 'fichier : l’analyse est produite en commentaire, la sortie collée n’est jamais recopiée');
  assert(violationsSortie(sf).length === 0, 'fichier du parcours : sortie conforme');
  const vd = parId['cisco-vtp-diagnostic'];
  const sx = vd.generate({ ...valeurs(vd), ciscoSortieVtp: E.vtp });
  assert(/revision : 4/.test(sx) && /Mode : client/.test(sx) && /Manque/.test(sx), 'VTP diagnostic : lecture assistée avec ce qui manque');
}

// ===========================================================================
section('Contre-épreuves : chaque contrôle de sortie DÉTECTE une sortie fautive');
{
  const bonne = '! ok\nshow vlan brief\n';
  assert(violationsSortie(bonne, { lecture: true }).length === 0, 'contrôle applicable : une sortie saine est acceptée');
  const fautes = [
    ['accent', 'show vlan brief é\n'], ['point d’interrogation', 'show ?\n'], ['tabulation', 'show\tvlan\n'], ['CRLF', 'show vlan\r\n'], ['BOM', '﻿show vlan\n'],
    ['pas de saut final', 'show vlan'], ['lignes vides finales', 'show vlan\n\n'],
    ['write erase', 'write erase\n'], ['reload', 'reload\n'], ['no vlan', 'no vlan 10\n'], ['delete vlan.dat', 'delete flash:vlan.dat\n'],
    ['sauvegarde active', 'copy running-config startup-config\n'], ['write memory', 'write memory\n'], ['allowed vlan sans add', 'switchport trunk allowed vlan 10,20\n'], ['allowed vlan all', ' switchport trunk allowed vlan all\n'],
    ['plage', 'interface range fa0/1 - 24\n'], ['effacement général', 'clear mac address-table dynamic\n'], ['secret enable', 'enable secret 5 xyz\n'], ['vtp password', 'vtp password abc\n'], ['username secret', 'username a secret b\n'], ['crypto', 'crypto key generate rsa\n'],
  ];
  for (const [nom, x] of fautes) assert(violationsSortie(x).length > 0, `contre-épreuve : « ${nom} » détecté`);
  assert(violationsSortie('configure terminal\nshow vlan\n', { lecture: true }).length > 0, 'contre-épreuve : une ligne de modification en mode Lecture est détectée');
  assert(violationsSortie('copy running-config startup-config\n', { sauvegardeAutorisee: true }).length === 0, 'la sauvegarde n’est tolérée que dans son assistant dédié');
  // Le générateur de sortie, lui, ne produit JAMAIS ces fautes avec une entrée hostile : déjà prouvé ci-dessus ; ici on muté un outil.
  const t = parId['cisco-vlan-creation'];
  const muté = { ...t, generate: (v) => `${t.generate(v)}no vlan 10\n` };
  assert(violationsSortie(muté.generate(valeurs(t, 'Configuration')), {}).length > 0, 'contre-épreuve : un générateur muté qui supprime un VLAN est détecté');
  const mute2 = { ...t, generate: (v) => `${t.generate(v)}copy running-config startup-config\n` };
  assert(violationsSortie(mute2.generate(valeurs(t, 'Configuration')), {}).length > 0, 'contre-épreuve : un générateur muté qui sauvegarde est détecté');
  // Contre-épreuve de la validation : un validateur affaibli laisserait passer « all ».
  const faible = (x) => /^[\d,\- a-z]+$/.test(x);
  assert(faible('all') && !V.validerListeVlansIos('all').ok, 'contre-épreuve : un validateur affaibli accepterait « all » ; le vrai le refuse');
  // Contre-épreuve de l'analyseur : une liste de VLAN trop complaisante conclurait à tort.
  assert(A.analyserTrunks('Port Mode Encapsulation Status Native vlan\nFa0/9 on 802.1q trunking 1\n\nPort Vlans allowed on trunk\nFa0/9 1,10\n').ports['Fa0/9'].autorises.includes(20) === false, 'contre-épreuve : le VLAN 20 absent n’est pas inventé');
}

// ===========================================================================
section('Commentaires : un saut de ligne dans une note ne crée JAMAIS de ligne active');
{
  const c = commentaire('premiere\nreload\n\nwrite erase');
  assert(c.length === 4 && c.every((l) => l.startsWith('!')), 'commentaire() préfixe chaque ligne par « ! »');
  assert(!/[^\x00-\x7f]/.test(ascii('é « a » — … ’')) && !ascii('a?b').includes('?') && ascii('« x »') === '"x"', 'ascii() : ASCII, sans « ? », guillemets nets');
  // Un outil dont une note porte un saut de ligne hostile : la sortie reste faite de commentaires + commandes déclarées.
  const piege = outilCisco({
    id: 'cisco-piege', famille: 'Test', title: 'Piege', summary: 's', keywords: ['t'], source: 'https://www.cisco.com/c/en/us/x.html', sources: [{ label: 'x', url: 'https://www.cisco.com/c/en/us/x.html' }],
    gui: ['a', 'b', 'c'], checks: ['a'], verifyAfter: ['a', 'b'], rollback: { summary: 's', diagnostic: 'd', command: 'c' }, prereqs: ['a', 'b', 'c'], commonErrors: [{ message: 'm', cause: 'c', fix: 'f' }],
    parse: () => ({ errors: {}, val: {} }),
    lecture: () => [{ n: 'note\nreload\nwrite erase', c: 'show version' }, { m: 'ligne\nerase startup-config' }],
    finFichier: () => ['fin\ndelete flash:vlan.dat'],
    cisco: { probleme: 'p', utilite: 'u', exemple: 'e', lecture: ['l'], effets: ['e'], attendu: ['a'], limites: ['l'] },
  });
  const sp = piege.generate({ ciscoCible: 'SW-T', ciscoPresentation: 'Commente' });
  assert(lignesActives(sp).join('|') === 'show version', `note piégée : seule la commande déclarée est active (${lignesActives(sp).join('|')})`);
  assert(sp.split('\n').filter((l) => /^(reload|write erase|erase|delete)/.test(l)).length === 0, 'note piégée : aucune ligne ne commence par une commande interdite');
}

// ===========================================================================
section('Sources : unicité et forme (l’existence en ligne est vérifiée par test/sources-cisco.mjs)');
{
  const urls = toutesLesSources().map((s) => s.url);
  assert(new Set(urls).size === urls.length, `${urls.length} URL distinctes`);
  assert(urls.every((u) => /^https:\/\/www\.cisco\.com\/c\/en\/us\/\S+\.html$/.test(u)), 'toutes les sources sont des pages précises de cisco.com');
  assert(cisco.every((t) => t.sources.every((s) => urls.includes(s.url))), 'chaque source citée par une fiche figure dans le registre sources-cisco.mjs');
}

// ---------------------------------------------------------------------------
console.log('\n=== NON EXÉCUTÉ (déclaré, jamais compté PASS) ===');
console.log('  Packet Tracer / simulateur : NON EXÉCUTÉ (aucun .pka ni résultat observé).');
console.log('  Commutateur réel (C1000-24T-4G-L en référence) : NON EXÉCUTÉ.');
console.log('  Syntaxe IOS : rapprochée de la documentation publique Cisco, jamais essayée.');
console.log('  Détection de secrets : heuristique, pas une garantie universelle.');
console.log(`\nBanc des assistants Cisco : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
if (echecs.length) { for (const e of echecs.slice(0, 40)) console.log(`  - ${e}`); process.exit(1); }
