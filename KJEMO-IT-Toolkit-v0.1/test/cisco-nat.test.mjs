#!/usr/bin/env node
/**
 * cisco-nat.test.mjs — KJEMO-CISCO-NAT-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles du cours NAT / PAT / adresses / récapitulation : 7 fiches IOS,
 * 1 cours (parcours A à D), 1 résumé pliable, 9 schémas SVG, classement,
 * aide-mémoire, recherche.
 * CAS FONCTIONNELS : contrat des fiches, commandes rendues (ASCII, sans « ? »,
 * sans marque restante, sans commande destructrice), adresse NAT64, récapitulation de routes et masques génériques
 * RECALCULÉS ici, schémas valides, cours résolu, ambiguïtés S09-1 à S09-5.
 * CONTRE-ÉPREUVES : un cours, un résumé, une fiche, un paramètre et une valeur
 * dégradés DOIVENT être refusés.
 * NE PROUVE PAS : le comportement dans Packet Tracer ou sur un routeur (NON EXÉCUTÉ).
 * Usage : node test/cisco-nat.test.mjs   (exit 0 = tout OK)
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
const { RESUME_NAT } = await imp('cours-resume-cisco-nat.mjs'); const { COURS_CISCO_NAT } = await imp('cours-fiches-cisco-nat.mjs');
const { COURS_CISCO_NAT_PARCOURS } = await imp('cours-cisco-nat.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const IDS = ['cours-nat-statique', 'cours-nat-dynamique', 'cours-nat-pat', 'cours-nat-redirection-port', 'cours-nat-verifier', 'cours-route-recap-statique', 'cours-route-recap-rip'];
const SCHEMAS_NEUFS = ['nat-vocabulaire', 'nat-trois-types', 'pat-table', 'socket-ports', 'nat64', 'ipv6-types-reels', 'cast-types', 'multicast-iptv', 'route-recap'];
const CID = 'cisco-nat-adressage-recap';
const exemple = (p) => Object.fromEntries(p.params.map((x) => [x.id, x.exemple]));
const rendu = (id, saisies = null) => { const p = T.entreeParId(id).procedure; return P.rendreMethode(p.methodes[0], p.params, saisies ?? exemple(p)); };
const texte = (id) => rendu(id).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie)).join('\n');

console.log('1. Les 7 fiches IOS');
assert(COURS_CISCO_NAT.length === 7 && COURS_CISCO_NAT.map((p) => p.id).join() === IDS.join(), '7 fiches, dans l’ordre prévu');
for (const p of COURS_CISCO_NAT) {
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
for (const p of COURS_CISCO_NAT) {
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
  assert(/ip nat inside source static 192\.168\.10\.10 203\.0\.113\.10/.test(texte('cours-nat-statique')) && /ip nat inside/.test(texte('cours-nat-statique')) && /ip nat outside/.test(texte('cours-nat-statique')), 'NAT statique : correspondance et deux marques');
  assert(/ip nat pool POOL-PUBLIC 203\.0\.113\.20 203\.0\.113\.30 netmask 255\.255\.255\.0/.test(texte('cours-nat-dynamique')) && /access-list 1 permit 192\.168\.10\.0 0\.0\.0\.255/.test(texte('cours-nat-dynamique')), 'NAT dynamique : pool et liste avec masque générique');
  assert(/ip nat inside source list 1 interface Serial0\/1\/0 overload/.test(texte('cours-nat-pat')), 'PAT : overload sur l’interface de sortie');
  assert(/ip nat inside source static tcp 192\.168\.10\.10 80 203\.0\.113\.10 8080/.test(texte('cours-nat-redirection-port')), 'redirection : tcp, port local 80, port public 8080');
  assert(/ip route 192\.168\.0\.0 255\.255\.252\.0 10\.0\.0\.2/.test(texte('cours-route-recap-statique')) && /Null0/.test(texte('cours-route-recap-statique')), 'récapitulation : route /22 et variante Null0');
  assert(/ip summary-address rip 192\.168\.0\.0 255\.255\.252\.0/.test(texte('cours-route-recap-rip')), 'RIPv2 : résumé sur l’interface');
}

console.log('3. Calculs recalculés');
{
  const ip = (a) => a.split('.').reduce((n, x) => n * 256 + Number(x), 0);
  const masqueDe = (p) => (p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0);
  const pointe = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
  // masques génériques = inverse des masques
  const nat = T.entreeParId('cours-nat-dynamique').procedure;
  const wild = nat.params.find((x) => x.id === 'wildcard').choix; const mask = nat.params.find((x) => x.id === 'masquePool').choix;
  assert(wild.length === mask.length && mask.every((m, i) => pointe((~ip(m)) >>> 0) === wild[i]), 'chaque masque générique est l’inverse du masque réseau');
  // récapitulation de quatre /24 : bits communs
  const reseaux = [0, 1, 2, 3].map((n) => ip(`192.168.${n}.0`));
  let p = 32; while (p > 0 && reseaux.some((r) => ((r ^ reseaux[0]) & masqueDe(p)) !== 0)) p--;
  assert(p === 22 && pointe(masqueDe(p)) === '255.255.252.0' && pointe(reseaux[0] & masqueDe(p)) === '192.168.0.0', 'quatre /24 voisins = 192.168.0.0/22, masque 255.255.252.0');
  const r2 = [1, 2, 3, 4].map((n) => ip(`192.168.${n}.0`));
  let q = 32; while (q > 0 && r2.some((r) => ((r ^ r2[0]) & masqueDe(q)) !== 0)) q--;
  assert(q === 21, '192.168.1.0 à 192.168.4.0 ne se regroupent qu’en /21 (qui couvre 0 à 7) : pas de regroupement exact');
  // alignement
  const aligne = (premier, n) => (n & (n - 1)) === 0 && premier % n === 0;
  assert(aligne(0, 4) && !aligne(1, 4) && !aligne(0, 3), 'règle d’alignement : puissance de 2 et premier multiple');
  const rec = T.entreeParId('cours-route-recap-statique').procedure;
  assert(rec.params.find((x) => x.id === 'masque').exemple === pointe(masqueDe(22)) && rec.params.find((x) => x.id === 'reseau').exemple === '192.168.0.0', 'les valeurs d’exemple de la fiche sont celles recalculées');
  // NAT64 : 8.8.8.8 -> 64:ff9b::808:808
  const hexa = (a) => { const o = a.split('.').map(Number); return `${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`; };
  assert(`64:ff9b::${hexa('8.8.8.8')}` === '64:ff9b::808:808' && S.SCHEMAS.nat64.svg().includes('64:ff9b::808:808'), 'NAT64 : 8.8.8.8 devient 64:ff9b::808:808 (recalculé)');
  assert(`64:ff9b::${hexa('192.0.2.33')}` === '64:ff9b::c000:221', 'NAT64 : 192.0.2.33 devient 64:ff9b::c000:221 (autre exemple)');
  // plages de ports
  const sock = S.SCHEMAS['socket-ports'].svg();
  assert(sock.includes('0 – 1023') && sock.includes('1024 – 49151') && sock.includes('49152 – 65535') && 65535 - 49152 + 1 === 16384, 'plages de ports : 0-1023, 1024-49151, 49152-65535 (16 384 ports dynamiques)');
  const v = (type, val, extra = {}) => P.validerParametre({ id: 'x', label: 'Port', type, ...extra }, val);
  assert(v('port', '8080').ok && !v('port', '70000').ok && !v('port', '0').ok, 'validateur de port : 8080 accepté, 70000 et 0 refusés');
  assert(v('entier', '1', { min: 1, max: 99 }).ok && !v('entier', '100', { min: 1, max: 99 }).ok, 'liste d’accès standard : 1 à 99 seulement');
}

console.log('4. Le cours et son résumé');
const resolveur = {
  fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodeParDefaut: ms[0].id, methodes: Object.fromEntries(ms.map((m) => [m.id, m.etapes.length])), titres: Object.fromEntries(ms.map((m) => [m.id, m.etapes.map((x) => x.titre)])) }; },
  assistants: (id) => Boolean(T.entreeParId(id)),
};
const c = K.COURS_PAR_ID.get(CID);
assert(c && COURS_CISCO_NAT_PARCOURS[0] === c && c.plateformes.join() === 'Cisco', 'cours enregistré, plateforme Cisco');
{
  const pb = K.incoherencesCours(c, resolveur);
  assert(pb.length === 0, 'le cours est conforme', pb.join(' ; '));
  assert(c.parcours.map((p) => p.lettre).join('') === 'ABCD', 'parcours A à D');
  assert(c.ambiguites.map((a) => a.id).join() === 'N-1,N-2,N-3', 'ambiguïtés N-1 à N-3');
  const items = c.parcours.flatMap((p) => p.items);
  assert(items.filter((i) => i.couvert === false).every((i) => i.note.length >= 40), 'éléments non couverts expliqués');
  assert(items.every((i) => i.couvert === false || i.refs.length || i.assistants?.length), 'chaque élément couvert cite une fiche');
  const cites = new Set(items.flatMap((i) => i.refs.map((r) => r.fiche)));
  assert(IDS.every((id) => cites.has(id) || c.soutien.some((s) => s.fiche === id)), 'chaque nouvelle fiche est citée');
  // les sujets de la liste de notes sont tous traités
  const tout = items.map((i) => i.texte.toLowerCase()).join(' ');
  for (const mot of ['nat', 'pat', 'redirection de port', 'socket', 'nat64', 'multidiffusion', 'anycast', 'slaac', 'récapitul', 'vtp', 'vlan', 'rip', 'ssh', 'sécurité des ports', 'statique', 'flottante']) assert(tout.includes(mot), `sujet des notes traité : ${mot}`);
  assert(K.lireRouteCours(`#/cours/${CID}/resume`)?.lettre === 'resume', 'route /resume');
  assert(c.rappelCours === RESUME_NAT, 'résumé rattaché au cours');
  const pr = K.incoherencesRappel(RESUME_NAT);
  assert(pr.length === 0, 'résumé conforme', pr.join(' ; '));
  const utilises = new Set(RESUME_NAT.sections.flatMap((s) => s.schemas ?? []));
  assert(SCHEMAS_NEUFS.every((id) => utilises.has(id)), 'les 9 schémas figurent dans le résumé');
}

console.log('5. Contre-épreuves');
{
  const a = structuredClone(c); a.parcours[0].items[0].refs[0].etape = 99;
  assert(K.incoherencesCours(a, resolveur).length > 0, 'étape inexistante détectée');
  const b = structuredClone(c); b.parcours[0].items[0].refs[0].fiche = 'cours-inconnue';
  assert(K.incoherencesCours(b, resolveur).length > 0, 'fiche inconnue détectée');
  const d = structuredClone(c); d.parcours[0].items[2].refs[0].titre = 'titre inexistant';
  assert(K.incoherencesCours(d, resolveur).length > 0, 'titre d’étape désaccordé détecté');
  const r = structuredClone(RESUME_NAT); r.questions = r.questions.slice(0, 2);
  assert(K.incoherencesRappel(r).length > 0, 'trop peu de questions détecté');
  const r2 = structuredClone(RESUME_NAT); r2.sections[0].schemas = ['schema-inconnu'];
  assert(K.incoherencesRappel(r2).length > 0, 'schéma inconnu détecté');
  const p = structuredClone(T.entreeParId('cours-nat-pat').procedure);
  p.methodes[0].etapes[1].lignes[0].cmd = 'ip nat inside source list {{inconnu}} interface {{externe}} overload';
  assert(P.incoherencesProcedure(p).length > 0, 'paramètre non déclaré détecté');
  const p2 = structuredClone(T.entreeParId('cours-nat-statique').procedure);
  p2.params.push({ ...p2.params[0] });
  assert(P.incoherencesProcedure(p2).length > 0, 'paramètre en double détecté');
  assert(!P.validerParametre({ id: 'acl', label: 'liste', type: 'entier', min: 1, max: 99 }, '150').ok, 'liste d’accès 150 refusée pour une liste standard');
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
  assert(/[✓✗]/.test(S.SCHEMAS['multicast-iptv'].svg()) && S.SCHEMAS['multicast-iptv'].svg().includes('aucun flux') && S.SCHEMAS['multicast-iptv'].svg().includes('reçoit le flux'), 'multicast hôtel : symbole ET mot pour chaque chambre');
  assert(/✓/.test(S.SCHEMAS['route-recap'].svg()) && /✗/.test(S.SCHEMAS['route-recap'].svg()), 'récapitulation : bon et mauvais exemples avec symbole');
  const ul = S.SCHEMAS['ipv6-types-reels'].svg();
  assert(['2000::/3', 'FE80::/10', '::1/128', '::/128', 'FC00::/7', '::ffff:0:0/96'].every((x) => ul.includes(x)), 'six types IPv6 : plages présentes');
  assert(S.SCHEMAS['cast-types'].svg().includes('anycast') || S.SCHEMAS['cast-types'].svg().includes('Anycast'), 'modes de diffusion : anycast présent');
}

console.log('7. Classement, aide-mémoire, recherche');
{
  const chemins = new Set(IDS.map((id) => JSON.stringify(C.cheminDe(T.entreeParId(id)))));
  assert(chemins.size >= 2, 'fiches réparties dans au moins 2 rubriques', [...chemins].join(' | '));
  const nat = M.MEMO_PAR_ID.get('cisco-nat');
  assert(nat && nat.sous.flatMap((s) => s.fiches).join() === IDS.slice(0, 5).join(), 'groupe « NAT, PAT et redirection de port » : 5 fiches');
  assert(M.groupeDeFiche('cours-route-recap-statique')?.id === 'cisco-adressage-routage' && M.groupeDeFiche('cours-route-recap-rip')?.id === 'cisco-adressage-routage', 'récapitulation rangée avec les routes');
  assert(M.SECTIONS_MEMO.find((x) => x.id === 'Cisco').groupes.includes('cisco-nat'), 'groupe NAT dans la section Cisco');
  for (const [req, attendu] of [['nat statique', 'cours-nat-statique'], ['pat overload', 'cours-nat-pat'], ['port forwarding', 'cours-nat-redirection-port'], ['redirection de port', 'cours-nat-redirection-port'],
    ['show ip nat translations', 'cours-nat-verifier'], ['nat dynamique pool', 'cours-nat-dynamique'], ['route récapitulative', 'cours-route-recap-statique'], ['route summary', 'cours-route-recap-statique'], ['ip summary-address rip', 'cours-route-recap-rip']]) {
    const res = T.chercher(req, { plateforme: 'Cisco' });
    const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 6).includes(attendu), `recherche « ${req} » : ${attendu}`, ids.slice(0, 6).join());
  }
}

console.log(`\ncisco-nat : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, routeur) : NON EXÉCUTÉE. Contrat, rendu, calculs, schémas et résumé vérifiés seulement.');
process.exit(failed ? 1 : 0);
