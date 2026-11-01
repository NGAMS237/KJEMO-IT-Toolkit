#!/usr/bin/env node
/**
 * trouver.test.mjs — KJEMO-TROUVER-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « À lire sur : poste + commande » sous les cases des fiches (dist/trouver.mjs).
 *  - la couverture a bien progressé et chaque note est valide (poste connu, commande non vide, aucun secret) ;
 *  - une valeur qu'on INVENTE (création) n'a PAS de note ; un scénario n'en reçoit pas ;
 *  - les définitions de paramètres PARTAGÉES entre fiches ne sont jamais modifiées (une fiche ne déteint pas sur l'autre) ;
 *  - un « trouver » écrit à la main n'est jamais écrasé ; l'opération est idempotente ;
 *  - les familles : fiches Samba → le serveur ; fiches Windows locales → Get-Local* ; fiches Azure qui créent → rien.
 * NE PROUVE PAS : que chaque commande donne la valeur attendue sur un vrai poste (NON EXÉCUTÉES).
 * Usage : node test/trouver.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const X = await imp('trouver.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const proc = (id) => T.entreeParId(id).procedure;
const trouver = (id, param) => proc(id).params.find((q) => q.id === param)?.trouver ?? null;
const toutes = T.TOUTES_LES_ENTREES.filter((e) => e.procedure);

console.log('1. Couverture et validité');
const notes = toutes.flatMap((e) => (e.procedure.params ?? []).filter((q) => q.trouver).map((q) => ({ f: e.id, q })));
assert(notes.length >= 200, `au moins 200 cases ont une note « à lire sur » (${notes.length})`);
for (const { f, q } of notes) {
  const ok = Boolean(P.MACHINES[q.trouver.poste] || X.POSTES_LECTURE[q.trouver.poste]) && typeof q.trouver.commande === 'string' && q.trouver.commande.trim().length > 2;
  if (!ok) assert(false, `note valide : ${f}:${q.id}`);
}
assert(notes.every(({ q }) => !/password|mot de passe|secret|token/i.test(q.trouver.commande)), 'aucune commande de note ne manipule un secret');
assert(toutes.every((e) => P.incoherencesProcedure(e.procedure).filter((x) => x.includes('trouver')).length === 0), 'le contrat valide toutes les notes');

console.log('2. Une valeur inventée n’a pas de note');
for (const [f, q] of [['cours-az-groupe-ressources', 'groupe'], ['cours-az-vnet-creer', 'vnet'], ['cours-az-vnet-creer', 'sousReseau'], ['win-ad-creer-groupe', 'groupe'], ['win-ad-creer-ou', 'ou'], ['win-gpo-creer-lier', 'gpo'], ['win-partage-creer', 'partage'], ['win-tache-planifiee', 'tache'], ['cisco-creer-vlan', 'vlan'], ['cours-ec-pagp', 'groupe'], ['win-dns-zone-directe', 'zone'], ['linux-sed-remplacer', 'nouveau'], ['linux-hostname-changer', 'nom']]) {
  assert(trouver(f, q) === null, `pas de note pour la valeur inventée ${f}:${q}`);
}
assert(toutes.filter((e) => e.kind === 'scenario').every((e) => (e.procedure.params ?? []).every((q) => !q.trouver)), 'aucun scénario ne reçoit de note automatique');

console.log('3. Les bonnes commandes, sur le bon poste');
const attendu = [
  ['win-ad-infos-utilisateur', 'compte', 'windows', 'Get-ADUser'], ['win-local-desactiver', 'compte', 'windows', 'Get-LocalUser'], ['win-local-creer-utilisateur', 'groupe', 'windows', 'Get-LocalGroup'],
  ['win-processus-fermer', 'processus', 'windows', 'Get-Process'], ['imprimante-file-bloquee', 'imprimante', 'windows', 'Get-Printer'], ['win-wifi-profils', 'profil', 'windows', 'netsh wlan show profiles'],
  ['cours-samba-partage-groupe', 'groupe', 'serveur', 'samba-tool group list'], ['cours-samba-partage-groupe', 'partage', 'serveur', 'testparm'], ['cours-smbclient-transferts', 'compte', 'serveur', 'samba-tool user list'],
  ['cours-groupes-locaux', 'groupe', 'linux', 'getent group'], ['cours-donner-dossier-compte', 'compte', 'linux', 'getent passwd'], ['cours-partition-formater-monter', 'disque', 'linux', 'lsblk'],
  ['linux-etat-service', 'service', 'linux', 'systemctl list-units'], ['cours-raid1-panne-secours', 'matrice', 'linux', '/proc/mdstat'], ['cr-ufw-delete', 'numero', 'linux', 'ufw status numbered'],
  ['cisco-affecter-port-vlan', 'interface', 'cisco', 'show interfaces status'], ['cisco-affecter-port-vlan', 'vlan', 'cisco', 'show vlan brief'], ['cours-ec-verifier', 'groupe', 'cisco', 'show etherchannel summary'], ['cours-rt-interface-ip', 'interface', 'cisco', 'show ip interface brief'],
  ['cours-az-sous-reseau-ajouter', 'groupe', 'azure', 'az group list'], ['cours-az-sous-reseau-ajouter', 'vnet', 'azure', 'az network vnet list'], ['cours-az-lb-etat', 'lb', 'azure', 'az network lb list'], ['cours-az-role-coequipier', 'abonnement', 'azure', 'az account list'],
  ['cours-ubuntu-reseau-client', 'connexion', 'client-ubuntu', 'nmcli'], ['cours-samba-dns', 'serveur', 'serveur', 'hostname -f'],
];
for (const [f, q, poste, cmd] of attendu) { const n = trouver(f, q); assert(n && n.poste === poste && n.commande.includes(cmd), `${f}:${q} → ${poste} « ${cmd} »`, JSON.stringify(n)); }

console.log('4. Pas de déteinte entre fiches, pas d’écrasement, idempotence');
{
  assert(trouver('cours-az-groupe-ressources', 'groupe') === null && trouver('cours-az-sous-reseau-ajouter', 'groupe') !== null, 'un paramètre partagé garde sa note d’une fiche à l’autre sans déteindre sur celle qui crée');
  const j = proc('cours-ubuntu-jonction-ad').params.find((q) => q.id === 'interface');
  assert(j.trouver.poste === 'client-ubuntu' && j.trouver.commande === 'ip -br link', 'la note écrite à la main dans la fiche n’est pas écrasée');
  const copie = { id: 'x', kind: 'procedure', params: [{ id: 'service', label: 'nom du service', type: 'identifiant', exemple: 'ssh' }] };
  assert(X.completerTrouver(copie, ['Linux']) === 1 && X.completerTrouver(copie, ['Linux']) === 0, 'idempotent : un second passage n’ajoute rien');
  const orig = copie.params[0];
  const copie2 = { id: 'y', kind: 'procedure', params: [orig] };
  X.completerTrouver(copie2, ['Windows']);
  assert(!('trouver' in orig) || orig === copie.params[0], 'l’objet de paramètre d’origine n’est pas modifié par la copie');
  const partage = { id: 'z', params: [{ id: 'service', label: 'nom du service', type: 'identifiant', exemple: 'ssh' }] };
  const avant = partage.params[0]; X.completerTrouver(partage, ['Linux']);
  assert(!('trouver' in avant), 'la définition d’origine reste intacte (copie)');
}

console.log('5. Contre-épreuves');
{
  const a = structuredClone(proc('win-ad-infos-utilisateur')); a.params[0].trouver = { poste: 'poste-inconnu', commande: 'Get-ADUser' };
  assert(P.incoherencesProcedure(a).length > 0, 'un poste inconnu est refusé');
  const b = structuredClone(proc('win-ad-infos-utilisateur')); b.params[0].trouver = { poste: 'windows' };
  assert(P.incoherencesProcedure(b).length > 0, 'une note sans commande est refusée');
  assert(X.trouverPour({ id: 'q', params: [] }, ['Linux'], { id: 'inexistant', label: 'chose' }) === null, 'un paramètre inconnu ne reçoit rien (on ne devine pas)');
  assert(X.trouverPour({ id: 'q' }, ['Linux'], { id: 'compte', label: 'nouveau compte à créer' }) === null, 'un libellé « nouveau… à créer » ne reçoit jamais de note');
}

console.log(`\ntrouver : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Commandes de lecture NON exécutées sur de vrais postes : seule leur présence, leur poste et leur validité sont vérifiées.');
process.exit(failed ? 1 : 0);
