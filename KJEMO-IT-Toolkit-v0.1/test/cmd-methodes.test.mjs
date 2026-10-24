#!/usr/bin/env node
/**
 * cmd-methodes.test.mjs — UX-COMMANDES-PROCEDURES-02b · KJEMO IT Toolkit
 * Inventaire et contrôle systématique des méthodes CMD (Invite de commandes).
 * PROUVE : syntaxe CMD déclarée, paramètres validés (métacaractères CMD refusés),
 * copie propre (ni invite, ni repère), droits et effets indiqués, retours exacts.
 * NE PROUVE PAS : l'effet d'une commande sur un poste Windows réel (NON EXÉCUTÉ).
 */
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const V = await imp('vue-taches.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const fiches = T.TOUTES_LES_ENTREES.filter((e) => e.procedure).map((e) => e.procedure);
const aCmd = (m) => m.id === 'cmd' || (m.equipements ?? []).some((q) => q.methode === 'cmd');
const cmdMethodes = fiches.flatMap((p) => p.methodes.filter(aCmd).map((m) => ({ p, m })));
const exemples = (p) => Object.fromEntries((p.params ?? []).map((q) => [q.id, q.exemple]));

console.log('1. Inventaire des méthodes CMD');
const ATTENDU = ['windows-voir-ip', 'windows-etat-service', 'vider-cache-dns', 'tester-ping', 'resoudre-nom-dns', 'renouveler-bail-dhcp',
  'redemarrer-service-windows', 'reparer-fichiers-systeme', 'appliquer-strategies-groupe', 'ad-etat-replication', 'windows-ip-fixe',
  'windows-ports-ecoute', 'scenario-windows-diagnostic-reseau', 'journal-evenements-windows'];
assert(JSON.stringify(cmdMethodes.map((x) => x.p.id).sort()) === JSON.stringify([...ATTENDU].sort()), `14 méthodes CMD attendues (${cmdMethodes.length})`, cmdMethodes.map((x) => x.p.id).join(','));
for (const id of ['scenario-windows-diagnostic-reseau', 'windows-ip-fixe', 'windows-ports-ecoute', 'vider-cache-dns']) {
  const p = fiches.find((x) => x.id === id);
  assert(p.methodes.some((m) => m.id === 'cmd' && m.etapes.length > 0), `${id} : méthode CMD réelle, non vide`);
}

console.log('2. Syntaxe CMD, copie propre');
const POWERSHELL = /^\s*[A-Z][a-z]+-[A-Z][A-Za-z]+\b|\$[_A-Za-z(]|`/;
for (const { p, m } of cmdMethodes) {
  assert(P.incoherencesProcedure(p).length === 0, `${p.id} : contrat respecté`, P.incoherencesProcedure(p).join(' | '));
  const r = P.rendreMethode(m, p.params ?? [], exemples(p));
  const lignes = r.etapes.flatMap((e) => (e.rendu?.lignes ?? [])).filter((l, i) => true);
  assert(lignes.length > 0, `${p.id} : des commandes CMD`);
  for (const e of r.etapes) {
    if (!e.rendu) continue;
    const eqM = m.id === 'scenario' ? (m.equipements.find((q) => q.id === e.equipement)?.methode) : m.id;
    if (eqM !== 'cmd') continue;
    for (const l of e.rendu.lignes) {
      assert(!POWERSHELL.test(l.copie), `${p.id} : « ${l.copie} » est bien du CMD`);
      assert(!/^[A-Za-z]:\\.*>|^>|^PS>/.test(l.copie) && !/‹|\{\{|<[A-Za-zÀ-ÿ]/.test(l.copie), `${p.id} : copie sans invite ni repère (« ${l.copie} »)`);
      assert(!/[`]/.test(l.copie), `${p.id} : pas de continuation PowerShell`);
    }
    assert(e.rendu.texteCopie === null || !/\r/.test(e.rendu.texteCopie), `${p.id} : fins de ligne propres`);
  }
  const vide = P.rendreMethode(m, p.params ?? [], {});
  const manque = vide.etapes.filter((e) => e.rendu && e.rendu.manquants.length);
  for (const e of manque) assert(e.rendu.bloque && e.rendu.texteCopie === null || e.rendu.instances.length, `${p.id} : sans valeur, « ${e.titre} » n'est pas copiable`);
  assert(/administrateur|ordinaire|compte|Utilisateur/i.test(m.privileges ?? ''), `${p.id} : privilèges indiqués`);
}

console.log('3. Paramètres : métacaractères CMD refusés (& | ^ % " < > ;)');
const HOSTILES = ['a&calc', 'a|b', 'a^b', '%PATH%', 'a"b', 'a<b', 'a>b', 'a;b', 'a\nb'];
const paramsCmd = new Map();
for (const { p, m } of cmdMethodes) for (const q of p.params ?? []) if (q.type !== 'table') paramsCmd.set(`${p.id}.${q.id}`, q);
for (const [cle, q] of paramsCmd) {
  const textuels = ['nom', 'identifiant', 'texte', 'arg'].includes(q.type);
  if (textuels) for (const h of HOSTILES) assert(!P.validerParametre(q, h).ok, `${cle} (${q.type}) refuse « ${h.replace('\n', '\\n')} »`);
  else for (const h of HOSTILES) assert(!P.validerParametre(q, h).ok, `${cle} (${q.type}) refuse « ${h.replace('\n', '\\n')} »`);
}

console.log('4. Contenu vérifié, fiche par fiche');
const get = (id) => fiches.find((x) => x.id === id);
const cmdDe = (id) => get(id).methodes.find((m) => m.id === 'cmd');
{
  const p = get('windows-ip-fixe'); const m = cmdDe('windows-ip-fixe');
  const r = P.rendreMethode(m, p.params, exemples(p));
  const textes = r.etapes.filter((e) => e.rendu).flatMap((e) => e.rendu.lignes.map((l) => l.copie));
  assert(textes.includes('netsh interface ip set address name="Ethernet" source=static addr=192.168.1.50 mask=255.255.255.0 gateway=192.168.1.1'), 'IP fixe CMD : syntaxe netsh documentée (source=static addr= mask= gateway=)');
  assert(textes.includes('netsh interface ip set dnsserver name="Ethernet" source=static addr=192.168.1.1 register=primary'), 'IP fixe CMD : DNS statique (la documentation l\'exige)');
  assert(/source=dhcp/.test(m.retour) && /dnsserver name="<carte>" source=dhcp/.test(m.retour), 'IP fixe CMD : retour arrière exact (adresse ET DNS)');
  assert(r.etapes.some((e) => e.effet === 'interruption') && /administrateur/i.test(m.privileges), 'IP fixe CMD : interruption et administrateur annoncés');
  const ps = p.methodes.find((x) => x.id === 'powershell');
  assert(/ResetServerAddresses/.test(ps.retour) && ps.etapes.some((e) => e.lignes?.some((l) => /Set-DnsClientServerAddress/.test(l.cmd))), 'IP fixe PowerShell : DNS et retour DNS présents');
  const cmdMasque = P.rendreMethode(m, p.params, { ...exemples(p), prefixe: '22' });
  assert(cmdMasque.etapes.some((e) => e.rendu?.lignes.some((l) => /mask=255\.255\.252\.0/.test(l.copie))), 'IP fixe CMD : /22 → 255.255.252.0');
}
{
  const p = get('windows-ports-ecoute'); const m = cmdDe('windows-ports-ecoute');
  const r = P.rendreMethode(m, p.params, exemples(p));
  const textes = r.etapes.flatMap((e) => e.rendu?.lignes.map((l) => l.copie) ?? []);
  assert(textes[0] === 'netstat -ano | findstr LISTENING' && textes[1] === 'tasklist /fi "PID eq 1234"', 'ports CMD : netstat + findstr, tasklist avec PID paramétré');
  assert(!textes.some((t) => /<PID>/.test(t)), 'ports CMD : plus de repère littéral <PID>');
  const htmlPs = V.tachePageMarkup(T.entreeParId('windows-ports-ecoute'), { methodeId: 'powershell', saisies: {} });
  const htmlCmd = V.tachePageMarkup(T.entreeParId('windows-ports-ecoute'), { methodeId: 'cmd', saisies: {} });
  assert(!/data-param="pid"/.test(htmlPs) && /data-param="pid"/.test(htmlCmd), 'le champ PID n\'apparaît que pour CMD');
  assert(/UDP/.test(r.etapes[0].attendu), 'ports CMD : la différence (UDP absent) est dite — pas d\'équivalence affichée à tort');
  assert(P.validerParametre(p.params[0], '0').ok === false && P.validerParametre(p.params[0], '1234').ok, 'PID : entier positif');
}
{
  const m = cmdDe('vider-cache-dns'); const r = P.rendreMethode(m, [], {});
  assert(r.etapes[0].rendu.lignes[0].copie === 'ipconfig /flushdns' && r.etapes[0].effet === 'modification' && /administrateur/i.test(m.privileges), 'cache DNS CMD : ipconfig /flushdns, modification, administrateur');
  assert(r.etapes[1].rendu.lignes[0].copie === 'ipconfig /displaydns', 'cache DNS CMD : relecture avec /displaydns');
}
{
  const p = get('scenario-windows-diagnostic-reseau'); const m = cmdDe('scenario-windows-diagnostic-reseau');
  const r = P.rendreMethode(m, p.params, exemples(p));
  const textes = r.etapes.flatMap((e) => e.rendu?.lignes.map((l) => l.copie) ?? []);
  assert(textes[0] === 'ipconfig /all' && textes.some((t) => /^ping 192\.168\.1\.1$/.test(t)) && textes.some((t) => /^nslookup /.test(t)) && textes.includes('ipconfig /flushdns'), 'diagnostic CMD : ipconfig, ping, nslookup, flushdns');
  const iFlush = r.etapes.findIndex((e) => e.rendu?.lignes.some((l) => l.copie === 'ipconfig /flushdns'));
  assert(r.etapes[iFlush].facultatif === true, 'diagnostic CMD : le vidage du cache est facultatif');
  assert(r.texteComplet && !/flushdns/.test(r.texteComplet), 'diagnostic CMD : « copier tout » n\'inclut pas le vidage facultatif');
  assert(/nslookup/.test(get('resoudre-nom-dns').methodes.find((x) => x.id === 'cmd').etapes[0].explication) && /ignore le cache/.test(get('resoudre-nom-dns').methodes.find((x) => x.id === 'cmd').etapes[0].explication), 'nslookup : la différence avec Resolve-DnsName est dite');
}

{
  const p = get('journal-evenements-windows'); const m = cmdDe('journal-evenements-windows');
  const r = P.rendreMethode(m, [], {});
  assert(r.etapes[0].rendu.lignes[0].copie === 'wevtutil qe System /q:"*[System[(Level=2)]]" /c:20 /rd:true /f:text', 'journal CMD : wevtutil qe documenté (/q Level=2, /c:20, /rd:true, /f:text)');
  assert(/PowerShell/.test(r.etapes[0].attendu), 'journal CMD : la différence de format avec PowerShell est dite');
}

console.log('5. Contre-épreuves du contrat CMD');
{
  const base = () => structuredClone(get('windows-ports-ecoute'));
  let p = base(); p.methodes.find((m) => m.id === 'cmd').etapes[1].lignes[0].cmd = 'tasklist /fi "PID eq <PID>"';
  assert(P.incoherencesProcedure(p).some((x) => /repère littéral/.test(x)), 'contre-épreuve : <PID> littéral détecté');
  p = base(); p.methodes.find((m) => m.id === 'cmd').etapes[0].lignes[0].cmd = 'Get-NetTCPConnection -State Listen';
  assert(P.incoherencesProcedure(p).some((x) => /PowerShell, pas du CMD/.test(x)), 'contre-épreuve : cmdlet PowerShell dans un onglet CMD détecté');
  p = base(); p.methodes.find((m) => m.id === 'cmd').etapes[0].lignes[0].cmd = 'sudo ss -ltnp';
  assert(P.incoherencesProcedure(p).some((x) => /Linux, pas du CMD/.test(x)), 'contre-épreuve : commande Linux dans un onglet CMD détectée');
  p = base(); p.methodes.find((m) => m.id === 'powershell').etapes[0].lignes[0].cmd += ' {{pid}}';
  assert(P.incoherencesProcedure(p).some((x) => /réservé aux méthodes cmd/.test(x)), 'contre-épreuve : paramètre CMD employé dans PowerShell détecté');
  p = base(); p.methodes.find((m) => m.id === 'cmd').etapes = [];
  assert(P.incoherencesProcedure(p).some((x) => /onglet vide/.test(x)), 'contre-épreuve : onglet CMD vide refusé');
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
console.log('Windows réel : NON EXÉCUTÉ. Les commandes sont relues contre la documentation, jamais lancées.');
process.exit(failed ? 1 : 0);
