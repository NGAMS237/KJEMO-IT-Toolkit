#!/usr/bin/env node
/**
 * windows-fiches.test.mjs — KJEMO-UX-MEMO-WINDOWS-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Les 26 fiches Windows à COMMANDE DIRECTE (procedures-windows.mjs) : contrat des fiches,
 * commandes rendues avec les valeurs d'exemple, aucun secret saisi ni écrit, nouveaux types
 * de paramètres (dn, cheminWin, principal, mac, cidr) avec leurs REFUS, rangement dans
 * l'aide-mémoire (une fois, jamais un assistant), lien vers l'assistant complet conservé.
 * CONTRE-ÉPREUVES : un paramètre piégé doit être refusé, une fiche dégradée doit échouer.
 * NE PROUVE PAS : le comportement sur un contrôleur de domaine, un serveur DHCP/DNS ou un poste
 * réel (NON EXÉCUTÉ) ; les commandes sont relues contre la documentation Microsoft.
 * Usage : node test/windows-fiches.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const M = await imp('memo.mjs');
const { PROCEDURES_WINDOWS: W } = await imp('procedures-windows.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

console.log('1. Contrat des 26 fiches');
assert(W.length === 26, `26 fiches attendues, ${W.length}`);
for (const p of W) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' | '));
  const e = T.entreeParId(p.id);
  assert(e?.kind === 'procedure' && (e.plateformes ?? []).includes('Windows'), `${p.id} : fiche, plateforme Windows`);
  assert(p.origine === 'memo', `${p.id} : origine « memo » (hors des tâches courantes de l'accueil)`);
  assert(Boolean(T.entreeParId(p.assistant)), `${p.id} : l'assistant complet « ${p.assistant} » existe (voie guidée conservée)`);
  assert(p.methodes.length === 1 && ['powershell', 'cmd'].includes(p.methodes[0].id), `${p.id} : une méthode console`);
  assert(p.methodes[0].etapes.some((s) => s.verification), `${p.id} : une étape de vérification`);
  assert(p.validation && /non exécutées/.test(p.validation), `${p.id} : honnêteté « non exécutées »`);
}

console.log('2. Commandes rendues avec les valeurs d’exemple');
for (const p of W) {
  const ex = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
  const r = P.rendreMethode(p.methodes[0], p.params, ex);
  const lignes = r.etapes.filter((e) => e.rendu).map((e) => e.rendu.texteCopie ?? '').join('\n');
  assert(r.manquants.length === 0, `${p.id} : tous les paramètres d'exemple sont acceptés`, r.manquants.join(','));
  assert(!/\{\{|‹|›/.test(lignes), `${p.id} : aucune marque non remplacée`);
  assert(lignes.trim().length > 0, `${p.id} : commandes non vides`);
  assert(!/ConvertTo-SecureString|-AsPlainText|-Password\s+["'$]|\/p:|net user .* \S+ \/add/i.test(lignes), `${p.id} : aucun mot de passe en clair`);
  const mdp = p.id.match(/creer-utilisateur|reinit-mot-de-passe/);
  if (mdp) assert(/Read-Host -AsSecureString/.test(lignes), `${p.id} : le mot de passe est demandé par PowerShell (Read-Host -AsSecureString)`);
  if (p.id === 'win-ad-joindre-domaine') assert(/Get-Credential/.test(lignes), `${p.id} : identifiants demandés par Get-Credential`);
  assert(!(p.params ?? []).some((q) => /mot de passe|password|secret|jeton|token/i.test(`${q.id} ${q.label}`)), `${p.id} : aucun paramètre secret`);
}
{
  const p = W.find((x) => x.id === 'win-ad-creer-ou');
  const r = P.rendreMethode(p.methodes[0], p.params, { ou: 'Ventes', parent: 'DC=lab,DC=local' });
  assert(r.etapes[1].rendu.texteCopie === 'New-ADOrganizationalUnit -Name "Ventes" -Path "DC=lab,DC=local" -ProtectedFromAccidentalDeletion $true', 'Créer une OU : la commande rendue est exacte', r.etapes[1].rendu.texteCopie);
  const vide = P.rendreMethode(p.methodes[0], p.params, { ou: '', parent: '' });
  assert(vide.texteComplet == null && vide.etapes[1].rendu.bloque, 'Créer une OU : copie refusée tant que les valeurs sont vides');
}

console.log('3. Nouveaux types de paramètres : cas valides et REFUS');
const q = (type, v, extra = {}) => P.validerParametre({ id: 'x', label: 'valeur', type, ...extra }, v);
assert(q('dn', 'OU=Ventes,DC=lab,DC=local').ok && q('dn', 'DC=lab,DC=local').ok && q('dn', 'OU=Ressources Humaines,DC=lab,DC=local').ok, 'dn : formes valides');
for (const bad of ['OU=Ventes', 'OU=A, DC=l', 'OU=Ventes,DC=lab,DC=local";Remove-Item *', 'OU=V`;x,DC=a,DC=b', 'DC=a,DC=b\nGet-Process', '', 'lab.local']) assert(!q('dn', bad).ok, `dn : refuse ${JSON.stringify(bad)}`);
assert(q('cheminWin', 'C:\\Partages\\Ventes').ok && q('cheminWin', 'D:\\Data').ok, 'cheminWin : formes valides');
for (const bad of ['C:\\a\\..\\b', 'C:\\a b', '\\\\srv\\partage', 'C:Partages', '/etc', 'C:\\a";x', 'C:\\']) assert(!q('cheminWin', bad).ok, `cheminWin : refuse ${JSON.stringify(bad)}`);
assert(q('principal', 'LAB\\Ventes_G').ok && q('principal', 'jdupont').ok, 'principal : formes valides');
for (const bad of ['a;b', 'LAB\\', 'LAB\\a\\b', 'a b', 'a"b', '']) assert(!q('principal', bad).ok, `principal : refuse ${JSON.stringify(bad)}`);
assert(q('mac', '00-15-5d-01-02-03').valeur === '00-15-5D-01-02-03', 'mac : normalisée en majuscules');
for (const bad of ['00:15:5D:01:02:03', '00-15-5D-01-02', 'ZZ-15-5D-01-02-03']) assert(!q('mac', bad).ok, `mac : refuse ${JSON.stringify(bad)}`);
assert(q('cidr', '192.168.1.0/24').ok, 'cidr : valide');
for (const bad of ['192.168.1.0', '192.168.1.0/33', '192.168.1.0/4', '300.1.1.1/24', '192.168.1.0/024']) assert(!q('cidr', bad).ok, `cidr : refuse ${JSON.stringify(bad)}`);

console.log('4. Aide-mémoire : une fois, jamais un assistant');
const gw = M.MEMO_GROUPES.filter((g) => g.id.startsWith('win-'));
const dansMemo = new Set(gw.flatMap(M.fichesDuGroupe));
for (const p of W) assert(dansMemo.has(p.id), `${p.id} est dans un groupe Windows de l'aide-mémoire`);
for (const id of dansMemo) assert(['procedure', 'scenario'].includes(T.entreeParId(id)?.kind), `${id} : une fiche ou un scénario à commandes directes (pas un assistant)`);
assert(M.incoherencesMemo({ existe: (id) => Boolean(T.entreeParId(id)?.procedure) }).length === 0, 'aide-mémoire cohérent');
for (const mot of ['créer une ou', 'créer un utilisateur active directory', 'étendue dhcp', 'zone dns', 'dossier partagé']) {
  const r = T.chercher(mot).slice(0, 5);
  assert(r.some((x) => W.some((p) => p.id === x.entree?.id)), `recherche « ${mot} » : une fiche Windows à commande directe dans les 5 premiers`, r.map((x) => x.entree?.id).join(','));
}

console.log('5. Contre-épreuves');
{
  const piege = P.validerParametre(W[1].params[0], 'x";Remove-Item *');
  assert(!piege.ok, 'nom d’OU piégé (guillemet, point-virgule) : refusé');
  const sansVerif = structuredClone(W[2]); sansVerif.methodes[0].verification = [];
  assert(P.incoherencesProcedure(sansVerif).length > 0, 'fiche sans vérification : refusée');
  const secret = structuredClone(W[2]); secret.params.push({ id: 'mdp', label: 'mot de passe', type: 'texte', exemple: 'x' });
  assert(P.incoherencesProcedure(secret).some((m) => /secret/.test(m)), 'paramètre « mot de passe » : refusé par le contrat');
  const dn = structuredClone(W[1]); dn.params[1].exemple = 'pas un dn';
  assert(P.incoherencesProcedure(dn).some((m) => /refusé par son propre validateur/.test(m)), 'exemple invalide : refusé');
}

console.log(`\nwindows-fiches.test.mjs : ${passed} OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
