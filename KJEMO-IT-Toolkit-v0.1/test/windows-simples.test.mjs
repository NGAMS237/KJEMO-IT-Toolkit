#!/usr/bin/env node
/**
 * windows-simples.test.mjs — KJEMO-WINDOWS-SIMPLES-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Les 55 commandes courantes Windows (procedures-windows-simples / -poste / -ad-simples) :
 * contrat des fiches, commandes rendues, aucun secret, intentions uniques dans tout le catalogue,
 * rangement (aide-mémoire une seule fois, classement), recherche, et CONTRE-ÉPREUVES
 * (valeur piégée refusée, fiche dégradée en échec).
 * NE PROUVE PAS : l'effet des commandes sur un poste Windows réel (NON EXÉCUTÉ).
 * Usage : node test/windows-simples.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const M = await imp('memo.mjs'); const C = await imp('classement.mjs');
const { PROCEDURES_WINDOWS_SIMPLES: A } = await imp('procedures-windows-simples.mjs');
const { PROCEDURES_WINDOWS_POSTE: B } = await imp('procedures-windows-poste.mjs');
const { PROCEDURES_WINDOWS_AD: D } = await imp('procedures-windows-ad-simples.mjs');
const W = [...A, ...B, ...D];
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

console.log('1. Contrat des 55 fiches');
assert(A.length === 13 && B.length === 37 && D.length === 5 && W.length === 55, `13 réseau + 37 poste + 5 AD = 55 (${A.length}+${B.length}+${D.length})`);
assert(new Set(W.map((p) => p.id)).size === 55, 'identifiants uniques');
for (const p of W) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' | '));
  const e = T.entreeParId(p.id);
  assert(e?.kind === 'procedure' && (e.plateformes ?? []).includes('Windows') && e.plateformes.length === 1, `${p.id} : fiche, plateforme Windows seule`);
  assert(p.origine === 'memo', `${p.id} : origine « memo »`);
  assert(p.methodes.length === 1 && p.methodes[0].id === 'powershell', `${p.id} : une méthode console`);
  assert(p.methodes[0].etapes.at(-1).verification === true, `${p.id} : la dernière étape est la vérification`);
  assert(/non exécutées/.test(p.validation), `${p.id} : honnêteté « non exécutées »`);
  assert(p.sources.every((s) => s.url.startsWith('https://learn.microsoft.com/')), `${p.id} : sources HTTPS Microsoft`);
  if (p.effet !== 'lecture') assert(Boolean(p.methodes[0].retour), `${p.id} : une action qui modifie a un retour arrière`);
  if (p.effet === 'lecture') assert(p.methodes[0].etapes.every((s) => s.effet === 'lecture'), `${p.id} : fiche en lecture = toutes les étapes en lecture`);
}

console.log('2. Commandes rendues avec les valeurs d’exemple');
for (const p of W) {
  const ex = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
  const r = P.rendreMethode(p.methodes[0], p.params, ex);
  const txt = r.etapes.filter((e) => e.rendu).map((e) => e.rendu.texteCopie ?? '').join('\n');
  assert(r.manquants.length === 0, `${p.id} : exemples acceptés`, r.manquants.join(','));
  assert(!/\{\{|‹|›/.test(txt) && txt.trim().length > 0, `${p.id} : aucune marque restante, commandes non vides`);
  assert(!/ConvertTo-SecureString|-AsPlainText|-Password\s+["'$]|\/p:|net user .* \S+ \/add/i.test(txt), `${p.id} : aucun mot de passe en clair`);
  assert(!(p.params ?? []).some((q) => /mot de passe|password|secret|jeton|token/i.test(`${q.id} ${q.label}`)), `${p.id} : aucun paramètre secret`);
  assert(!/\/MIR|\/PURGE|Remove-Item\s+-Recurse|Format-Volume|\bdel\s+\/s|rd\s+\/s/i.test(txt), `${p.id} : aucune commande destructrice de masse`);
}
{
  const g = (id) => W.find((p) => p.id === id);
  const rendre = (id, v) => P.rendreMethode(g(id).methodes[0], g(id).params, v).etapes.filter((e) => e.rendu).map((e) => e.rendu.texteCopie).join('\n');
  assert(/Set-LocalUser -Name marie -Password \(Read-Host -AsSecureString/.test(rendre('win-local-changer-mot-de-passe', { compte: 'marie' })), 'changer un mot de passe local : demandé par Read-Host -AsSecureString');
  assert(/Add-LocalGroupMember -SID S-1-5-32-544 -Member marie/.test(rendre('win-local-admin-ajouter', { compte: 'marie' })), 'administrateurs : désigné par son SID (indépendant de la langue)');
  assert(rendre('win-arret-redemarrage', { action: 'r', delai: '60' }).includes('shutdown /r /t 60'), 'arrêt : commande exacte');
  assert(rendre('win-pare-feu-ouvrir-port', { nom: 'Lab-Web-8080', port: '8080' }).includes('-LocalPort 8080 -Action Allow'), 'pare-feu : règle exacte');
  assert(rendre('win-robocopy-copier', { source: 'C:\\Donnees', destination: 'D:\\Sauvegarde' }).includes('robocopy "C:\\Donnees" "D:\\Sauvegarde" /E /R:2 /W:2'), 'robocopy : copie sans suppression');
  assert(!/-Force/.test(rendre('win-archive-extraire', { archive: 'C:\\a.zip', dossier: 'C:\\Outils' })), 'extraction : n’écrase jamais (pas de -Force)');
  assert(/Stop-Process -Name notepad -Force/.test(rendre('win-processus-fermer', { processus: 'notepad' })), 'fermer un processus : par son nom');
  const vide = P.rendreMethode(g('win-processus-fermer').methodes[0], g('win-processus-fermer').params, { processus: '' });
  assert(vide.texteComplet == null && vide.etapes[1].rendu.bloque, 'fermer un processus : copie refusée tant que le nom est vide');
}

console.log('3. Valeurs piégées REFUSÉES');
const v = (id, pid, val) => { const p = W.find((x) => x.id === id); return P.validerParametre(p.params.find((q) => q.id === pid), val); };
assert(!v('win-processus-fermer', 'processus', 'notepad; shutdown /s').ok, 'processus : point-virgule refusé');
assert(!v('win-processus-fermer', 'processus', 'notepad.exe /f').ok, 'processus : espace et option refusés');
assert(!v('win-tracert', 'cible', '8.8.8.8 & del *').ok, 'cible : & refusé');
assert(!v('win-tracert', 'cible', '-h 1').ok, 'cible : option refusée');
assert(v('win-tracert', 'cible', '8.8.8.8').ok && v('win-tracert', 'cible', 'www.example.com').ok, 'cible : adresse et nom acceptés');
assert(!v('win-pare-feu-ouvrir-port', 'port', '70000').ok && !v('win-pare-feu-ouvrir-port', 'port', '80; calc').ok, 'port : hors plage et injection refusés');
assert(!v('win-pare-feu-ouvrir-port', 'nom', 'x"; Remove-NetFirewallRule *').ok, 'nom de règle : guillemet et point-virgule refusés');
assert(!v('win-arret-redemarrage', 'action', 'r /f').ok && !v('win-arret-redemarrage', 'action', 'x').ok, 'arrêt : action hors r/s refusée');
assert(!v('win-arret-redemarrage', 'delai', '-1').ok && !v('win-arret-redemarrage', 'delai', '99999').ok, 'arrêt : délai hors 0 à 3600 refusé');
assert(!v('win-sessions-fermer', 'session', '2; logoff 1').ok, 'session : injection refusée');
assert(!v('win-disque-verifier', 'lecteur', 'C: /f').ok, 'lecteur : option refusée');
assert(!v('win-robocopy-copier', 'source', 'C:\\Donnees" /MIR "').ok, 'robocopy : guillemet refusé dans le chemin');
assert(!v('win-fichier-chercher', 'motif', '*; Remove-Item').ok, 'motif : point-virgule refusé');
assert(!v('win-local-desactiver', 'compte', 'marie; Remove-LocalUser x').ok, 'compte : injection refusée');
assert(!v('win-renommer-poste', 'nom', 'PC VENTES; calc').ok, 'nom du poste : espace et injection refusés');

console.log('4. Aucune intention en double dans le catalogue');
{
  const toutes = T.TOUTES_LES_ENTREES.filter((e) => e.procedure);
  const titres = new Map();
  for (const e of toutes) { const t = e.titre.toLowerCase(); titres.set(t, (titres.get(t) ?? 0) + 1); }
  assert(W.every((p) => titres.get(p.titre.toLowerCase()) === 1), 'aucun titre de fiche en double');
  const cles = W.flatMap((p) => p.intentions.map((i) => i.toLowerCase()));
  assert(new Set(cles).size === cles.length, 'aucune intention en double entre les 55 fiches');
  const ids = new Set(W.map((p) => p.id));
  const autres = toutes.filter((e) => !ids.has(e.id)).flatMap((e) => e.procedure.intentions.map((i) => i.toLowerCase()));
  const communes = cles.filter((c) => autres.includes(c));
  assert(communes.length === 0, 'aucune intention déjà prise par une autre fiche', communes.join(' | '));
  // pas de refonte : les fiches existantes citées dans la demande restent
  for (const id of ['vider-cache-dns', 'tester-ping', 'resoudre-nom-dns', 'windows-voir-ip', 'renouveler-bail-dhcp', 'reparer-fichiers-systeme']) assert(Boolean(T.entreeParId(id)) && !ids.has(id), `fiche existante conservée, jamais refaite : ${id}`);
}

console.log('5. Aide-mémoire et classement');
{
  const dans = M.toutesLesFichesMemo();
  for (const p of W) assert(dans.filter((x) => x === p.id).length === 1, `${p.id} : rangée UNE fois dans l’aide-mémoire`);
  for (const id of ['vider-cache-dns', 'tester-ping', 'resoudre-nom-dns']) assert(dans.includes(id), `${id} : maintenant visible dans l’aide-mémoire`);
  const tout = Object.keys(M.AJOUTS);
  assert(W.every((p) => tout.includes(p.id)), 'les 55 fiches portent le badge « nouveau »');
  assert(M.incoherencesMemo({ existe: (id) => Boolean(T.entreeParId(id)) }).length === 0, 'aide-mémoire cohérent');
  const g = (id) => M.MEMO_PAR_ID.get(id);
  assert(g('win-systeme') && g('win-fichiers') && g('win-poste').sous.some((s) => s.id === 'caches'), 'groupes « Système… », « Disque, fichiers… » et sous-groupe « Vider les caches »');
  const caches = g('win-poste').sous.find((s) => s.id === 'caches').fiches;
  assert(['win-cache-identifiants', 'win-cache-store', 'win-cache-windows-update', 'win-presse-papiers', 'win-kerberos-purger', 'win-cache-arp', 'win-cache-netbios'].every((x) => caches.includes(x)), 'vider les caches : 7 fiches réunies');
  for (const p of W) { const e = T.entreeParId(p.id); const ch = C.cheminDe(e); assert(Boolean(ch?.famille), `${p.id} : classée dans le catalogue (${ch?.famille?.nom ?? '?'})`); }
}

console.log('6. Recherche');
for (const [req, attendu] of [['vider cache arp', 'win-cache-arp'], ['vider le cache netbios', 'win-cache-netbios'], ['klist purge', 'win-kerberos-purger'], ['wsreset', 'win-cache-store'], ['softwaredistribution', 'win-cache-windows-update'],
  ['vider le presse-papiers', 'win-presse-papiers'], ['ipconfig /all', 'win-ipconfig-complet'], ['tracert', 'win-tracert'], ['pathping', 'win-pathping'], ['netsh winsock reset', 'win-winsock-reinit'], ['route print', 'win-route-voir'],
  ['arp -a', 'win-arp-voir'], ['mot de passe wifi', 'win-wifi-profils'], ['ouvrir un port pare-feu', 'win-pare-feu-ouvrir-port'], ['systeminfo', 'win-systeme-resume'], ['taskkill', 'win-processus-fermer'],
  ['shutdown', 'win-arret-redemarrage'], ['chkdsk', 'win-disque-verifier'], ['robocopy', 'win-robocopy-copier'], ['get-filehash', 'win-fichier-empreinte'], ['takeown', 'win-droits-prendre-possession'],
  ['winget install', 'win-winget-installer'], ['get-hotfix', 'win-correctifs-installes'], ['tâche planifiée', 'win-tache-planifiee'], ['bureau à distance', 'win-bureau-distance-activer'], ['w32tm', 'win-heure-synchroniser'],
  ['get-adgroupmember', 'win-ad-membres-groupe'], ['nltest', 'win-ad-controleur-connecte']]) {
  const res = T.chercher(req, { plateforme: 'Windows' });
  const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
  assert(ids.slice(0, 5).includes(attendu), `recherche « ${req} » : ${attendu} parmi les 5 premiers`, ids.slice(0, 5).join());
}

console.log('7. Contre-épreuves');
{
  const c = structuredClone(W.find((p) => p.id === 'win-pare-feu-ouvrir-port'));
  c.params = c.params.filter((q) => q.id !== 'port');
  assert(P.incoherencesProcedure(c).length > 0, 'un paramètre utilisé mais non déclaré fait échouer le contrat');
  const d = structuredClone(W.find((p) => p.id === 'win-cache-arp'));
  d.methodes[0].verification = [];
  assert(P.incoherencesProcedure(d).length > 0, 'une fiche sans vérification fait échouer le contrat');
  const e = structuredClone(W.find((p) => p.id === 'win-winget-installer'));
  e.params[0].exemple = 'vlc; calc';
  assert(P.incoherencesProcedure(e).length > 0, 'un exemple refusé par son validateur fait échouer le contrat');
  const f = structuredClone(W.find((p) => p.id === 'win-heure-synchroniser'));
  f.sources = [{ label: 'x', url: 'http://exemple.test' }];
  assert(P.incoherencesProcedure(f).length > 0, 'une source non HTTPS fait échouer le contrat');
}

console.log(`\nwindows-simples : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (poste Windows) : NON EXÉCUTÉE. Contrat, rendu des commandes, refus de valeurs piégées, rangement et recherche vérifiés seulement.');
process.exit(failed ? 1 : 0);
