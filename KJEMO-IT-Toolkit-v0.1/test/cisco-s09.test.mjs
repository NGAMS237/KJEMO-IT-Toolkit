#!/usr/bin/env node
/**
 * cisco-s09.test.mjs — KJEMO-CISCO-S09-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles du cours de la semaine 9 (DHCPv4, IPv6, DHCPv6 + formatif 08) :
 * 13 fiches IOS, 1 cours (parcours A à E), 1 résumé pliable, 9 schémas SVG,
 * classement, aide-mémoire, recherche, validateurs ipv6 / cidr6.
 * CAS FONCTIONNELS : contrat des fiches, commandes rendues (ASCII, sans « ? »,
 * sans marque restante, sans commande destructrice), EUI-64 et abréviations IPv6
 * RECALCULÉS ici, schémas valides, cours résolu, ambiguïtés S09-1 à S09-5.
 * CONTRE-ÉPREUVES : un cours, un résumé, une fiche, un paramètre et une valeur
 * dégradés DOIVENT être refusés.
 * NE PROUVE PAS : le comportement dans Packet Tracer ou sur un routeur (NON EXÉCUTÉ).
 * Usage : node test/cisco-s09.test.mjs   (exit 0 = tout OK)
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
const { RESUME_S09 } = await imp('cours-resume-cisco-s09.mjs'); const { COURS_CISCO_S09 } = await imp('cours-fiches-cisco-s09.mjs');
const { COURS_CISCO_S09_PARCOURS } = await imp('cours-cisco-s09.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const IDS = ['cours-dhcp4-serveur-routeur', 'cours-dhcp4-relais', 'cours-dhcp4-client-routeur', 'cours-dhcp4-depanner',
  'cours-ipv6-adresser-interface', 'cours-ipv6-verifier', 'cours-ipv6-routes-statiques', 'cours-ipv6-defaut-flottante',
  'cours-dhcp6-slaac', 'cours-dhcp6-sans-etat', 'cours-dhcp6-avec-etat', 'cours-dhcp6-relais', 'cours-dhcp6-verifier'];
const SCHEMAS_NEUFS = ['dhcp4-dora', 'dhcp4-relais', 'ipv6-adresse', 'ipv6-types', 'ipv6-eui64', 'dhcp6-ra-flags', 'dhcp6-qui-donne-quoi', 'ipv6-routes-statiques', 'dhcp6-relais'];
const CID = 'cisco-s09-dhcp-ipv6';
const exemple = (p) => Object.fromEntries(p.params.map((x) => [x.id, x.exemple]));
const rendu = (id, saisies = null) => { const p = T.entreeParId(id).procedure; return P.rendreMethode(p.methodes[0], p.params, saisies ?? exemple(p)); };

console.log('1. Les 13 fiches IOS');
assert(COURS_CISCO_S09.length === 13 && COURS_CISCO_S09.map((p) => p.id).join() === IDS.join(), '13 fiches, dans l’ordre prévu');
for (const p of COURS_CISCO_S09) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' ; '));
  assert(p.origine === 'cours' && p.methodes.length === 1 && p.methodes[0].id === 'ios', `origine cours, méthode IOS : ${p.id}`);
  const e = T.entreeParId(p.id);
  assert(e && e.procedure === p && e.plateformes.join() === 'Cisco', `catalogue, plateforme Cisco : ${p.id}`);
  assert(C.cheminDe(e)?.domaineId === 'reseau-cisco', `rangée sous Réseau Cisco : ${p.id}`);
  assert(M.groupeDeFiche(p.id) !== null, `dans l’aide-mémoire : ${p.id}`);
  assert(p.titre.length <= 70 && p.resume.length >= 20, `titre et résumé bornés : ${p.id}`);
  assert(p.figures === undefined || p.figures.every((f) => S.IDS_SCHEMAS.includes(f)), `schémas connus : ${p.id}`);
}

console.log('2. Commandes rendues avec les valeurs d’exemple');
for (const p of COURS_CISCO_S09) {
  const r = rendu(p.id);
  assert(r.manquants.length === 0, `aucune valeur manquante : ${p.id}`, r.manquants.join());
  for (const e of r.etapes) for (const l of e.rendu?.lignes ?? []) {
    assert(/^[\x20-\x7e]+ ?$/.test(l.copie), `ASCII seul : ${p.id}`, l.copie);
    assert(!/\?/.test(l.copie), `jamais de « ? » : ${p.id}`, l.copie);
    assert(!/\{\{|\}\}|‹|›/.test(l.copie), `aucune marque restante : ${p.id}`, l.copie);
    assert(!/\b(reload|erase|delete|format)\b/i.test(l.copie), `aucune commande destructrice : ${p.id}`, l.copie);
  }
}
{
  const txt = (id) => rendu(id).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie)).join('\n');
  assert(/ipv6 unicast-routing/.test(txt('cours-dhcp6-slaac')), 'SLAAC : ipv6 unicast-routing présent');
  assert(/ipv6 dhcp pool/.test(txt('cours-dhcp6-sans-etat')) && /dns-server/.test(txt('cours-dhcp6-sans-etat')), 'DHCPv6 sans état : pool et dns-server');
  assert(/managed-config-flag/.test(txt('cours-dhcp6-avec-etat')) && /address prefix/.test(txt('cours-dhcp6-avec-etat')), 'DHCPv6 avec état : M flag et address prefix');
  assert(/ip helper-address/.test(txt('cours-dhcp4-relais')), 'relais DHCPv4 : ip helper-address');
  assert(/ip address dhcp/.test(txt('cours-dhcp4-client-routeur')), 'client routeur : ip address dhcp');
}

console.log('3. Validateurs ipv6 / cidr6 et calculs recalculés');
{
  const v = (type, val) => P.validerParametre({ id: 'x', label: 'Adresse', type }, val);
  for (const a of ['2001:db8:acad:1::1', 'fe80::1', '::1']) assert(v('ipv6', a).ok, `ipv6 accepté : ${a}`);
  for (const a of ['2001:db8:acad:1::1/64', 'zzzz::1', '1:2:3:4:5:6:7:8:9', '', '2001:::1']) assert(!v('ipv6', a).ok, `ipv6 refusé : ${a}`);
  for (const a of ['2001:db8:acad:1::1/64', '2001:db8::/32', 'fe80::1/128']) assert(v('cidr6', a).ok, `cidr6 accepté : ${a}`);
  for (const a of ['2001:db8::1', '2001:db8::1/0', '2001:db8::1/129', '2001:db8::1/064', 'abc/64']) assert(!v('cidr6', a).ok, `cidr6 refusé : ${a}`);
  // EUI-64 recalculé : MAC 00-50-56-83-63-6D -> 0250:56FF:FE83:636D
  const mac = '00-50-56-83-63-6D'.split('-').map((h) => parseInt(h, 16));
  mac[0] ^= 0x02;
  const h = (n) => n.toString(16).toUpperCase().padStart(2, '0');
  const eui = `${h(mac[0])}${h(mac[1])}:${h(mac[2])}FF:FE${h(mac[3])}:${h(mac[4])}${h(mac[5])}`;
  assert(eui === '0250:56FF:FE83:636D', 'EUI-64 recalculé', eui);
  assert(S.SCHEMAS['ipv6-eui64'].svg().includes('0250:56FF:FE83:636D'), 'le schéma EUI-64 affiche la valeur recalculée');
  // Abréviation : 2001:0DB8:ACAD:0001:0000:0000:0000:0001 -> 2001:db8:acad:1::1
  const complet = '2001:0DB8:ACAD:0001:0000:0000:0000:0001'.split(':').map((g) => g.replace(/^0+(?=.)/, '').toLowerCase());
  assert(complet.slice(0, 4).join(':') === '2001:db8:acad:1' && complet.slice(4).every((g) => g === '0' || g === '1'), 'abréviation : zéros de tête retirés');
}

console.log('4. Le cours et son résumé');
const resolveur = {
  fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodeParDefaut: ms[0].id, methodes: Object.fromEntries(ms.map((m) => [m.id, m.etapes.length])), titres: Object.fromEntries(ms.map((m) => [m.id, m.etapes.map((x) => x.titre)])) }; },
  assistants: (id) => Boolean(T.entreeParId(id)),
};
const c = K.COURS_PAR_ID.get(CID);
assert(c && COURS_CISCO_S09_PARCOURS[0] === c && c.plateformes.join() === 'Cisco', 'cours enregistré, plateforme Cisco');
assert(K.COURS.at(-1).id !== undefined && K.COURS.some((x) => x.id === CID), 'cours dans la liste');
{
  const pb = K.incoherencesCours(c, resolveur);
  assert(pb.length === 0, 'le cours est conforme', pb.join(' ; '));
  assert(c.parcours.map((p) => p.lettre ?? p.id).join('') === 'ABCDE', 'parcours A à E');
  assert(c.ambiguites.map((a) => a.id).join() === 'S09-1,S09-2,S09-3,S09-4,S09-5', 'ambiguïtés S09-1 à S09-5');
  const items = c.parcours.flatMap((p) => p.items);
  assert(items.filter((i) => i.couvert === false).every((i) => i.note.length >= 40), 'éléments non couverts expliqués');
  assert(items.every((i) => i.couvert === false || i.refs.length || i.assistants?.length), 'chaque élément couvert cite une fiche');
  const cites = new Set(items.flatMap((i) => i.refs.map((r) => r.fiche)));
  assert(IDS.every((id) => cites.has(id) || c.soutien.some((s) => (s.fiche ?? s) === id)), 'chaque fiche est citée par le parcours ou le soutien');
  assert(K.lireRouteCours(`#/cours/${CID}/resume`)?.lettre === 'resume', 'route /resume');
  assert(c.rappelCours === RESUME_S09, 'résumé rattaché au cours');
  const pr = K.incoherencesRappel(RESUME_S09);
  assert(pr.length === 0, 'résumé conforme', pr.join(' ; '));
  const utilises = new Set(RESUME_S09.sections.flatMap((s) => s.schemas ?? []));
  assert(SCHEMAS_NEUFS.every((id) => utilises.has(id)), 'les 9 schémas figurent dans le résumé');
}

console.log('5. Contre-épreuves');
{
  const a = structuredClone(c); a.parcours[0].items[0].refs[0].etape = 99;
  assert(K.incoherencesCours(a, resolveur).length > 0, 'étape inexistante détectée');
  const b = structuredClone(c); b.parcours[0].items[0].refs[0].fiche = 'cours-inconnue';
  assert(K.incoherencesCours(b, resolveur).length > 0, 'fiche inconnue détectée');
  const d = structuredClone(c); d.parcours[0].items[0].refs[0].titre = 'titre inexistant';
  assert(K.incoherencesCours(d, resolveur).length > 0, 'titre d’étape désaccordé détecté');
  const r = structuredClone(RESUME_S09); r.questions = r.questions.slice(0, 2);
  assert(K.incoherencesRappel(r).length > 0, 'trop peu de questions détecté');
  const r2 = structuredClone(RESUME_S09); r2.sections[0].schemas = ['schema-inconnu'];
  assert(K.incoherencesRappel(r2).length > 0, 'schéma inconnu détecté');
  const p = structuredClone(T.entreeParId('cours-ipv6-routes-statiques').procedure);
  p.methodes[0].etapes[1].lignes[0].cmd = 'ipv6 route {{inconnu}} {{saut}}';
  assert(P.incoherencesProcedure(p).length > 0, 'paramètre non déclaré détecté');
  const p2 = structuredClone(T.entreeParId('cours-dhcp6-relais').procedure);
  p2.params.push({ ...p2.params[0] });
  assert(P.incoherencesProcedure(p2).length > 0, 'paramètre en double détecté');
  const p3 = structuredClone(T.entreeParId('cours-dhcp4-relais').procedure);
  p3.titre = 'x'.repeat(80);
  assert(P.incoherencesProcedure(p3).length > 0, 'titre trop long détecté');
}

console.log('6. Les 9 schémas');
{
  assert(SCHEMAS_NEUFS.every((id) => S.IDS_SCHEMAS.includes(id)), '9 schémas enregistrés');
  const tmp = mkdtempSync(resolve(tmpdir(), 'svg-'));
  for (const id of SCHEMAS_NEUFS) {
    const sc = S.SCHEMAS[id]; const svg = sc.svg();
    assert(svg.startsWith('<svg ') && svg.endsWith('</svg>'), `SVG complet : ${id}`);
    assert(/role="img"/.test(svg) && /<title id="[^"]+">[^<]{10,}<\/title>/.test(svg) && /<desc id="[^"]+">[^<]{30,}<\/desc>/.test(svg), `titre et description : ${id}`);
    assert(!/<image|data:|href=|<script|<foreignObject|onload=|xlink/i.test(svg), `aucune image, lien ni script : ${id}`);
    assert(/viewBox="0 0 \d+ \d+"/.test(svg) && !/NaN|undefined/.test(svg), `viewBox valide : ${id}`);
    assert(sc.legende.length >= 40 && sc.titre.length >= 10 && S.figureMarkup(id).includes('<figcaption>'), `légende et figure : ${id}`);
    const f = resolve(tmp, `${id}.svg`); writeFileSync(f, svg);
    try { execFileSync('xmllint', ['--noout', f], { stdio: 'pipe' }); assert(true, `XML bien formé : ${id}`); } catch (e) { assert(false, `XML bien formé : ${id}`, String(e.stderr ?? e.message).slice(0, 200)); }
  }
  assert(/[✓✗⚠]/.test(S.SCHEMAS['dhcp6-ra-flags'].svg()), 'symbole en plus de la couleur : dhcp6-ra-flags');
}

console.log('7. Classement, aide-mémoire, recherche');
{
  const noms = ['dhcp-cisco', 'ipv6-cisco', 'dhcpv6-cisco'];
  const chemins = new Set(IDS.map((id) => C.cheminDe(T.entreeParId(id))?.id ?? C.cheminDe(T.entreeParId(id))?.sousId ?? JSON.stringify(C.cheminDe(T.entreeParId(id)))));
  assert(chemins.size >= 3, 'fiches réparties dans au moins 3 rubriques', [...chemins].join(' | '));
  assert(noms.every((n) => JSON.stringify(C.cheminDe(T.entreeParId(IDS[0]))).length > 0), 'chemin lisible');
  const g = new Set(IDS.map((id) => M.groupeDeFiche(id)?.id ?? JSON.stringify(M.groupeDeFiche(id))));
  assert(g.size === 1, 'les 13 fiches sont dans le même groupe d’aide-mémoire', [...g].join(' | '));
  for (const [req, attendu] of [['dhcp relais helper-address', 'cours-dhcp4-relais'], ['ipv6 route statique', 'cours-ipv6-routes-statiques'], ['slaac', 'cours-dhcp6-slaac'],
    ['dhcpv6 sans etat', 'cours-dhcp6-sans-etat'], ['ipv6 dhcp pool', 'cours-dhcp6-avec-etat'], ['show ipv6 interface brief', 'cours-ipv6-verifier'], ['ip address dhcp', 'cours-dhcp4-client-routeur']]) {
    const res = T.chercher(req, { plateforme: 'Cisco' });
    const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 6).includes(attendu), `recherche « ${req} » : ${attendu}`, ids.slice(0, 6).join());
  }
}

console.log(`\ncisco-s09 : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, routeur) : NON EXÉCUTÉE. Contrat, rendu, calculs, schémas et résumé vérifiés seulement.');
process.exit(failed ? 1 : 0);
