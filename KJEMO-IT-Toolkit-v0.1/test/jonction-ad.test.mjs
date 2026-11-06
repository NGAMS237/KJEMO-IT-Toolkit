#!/usr/bin/env node
/**
 * jonction-ad.test.mjs — KJEMO-JONCTION-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiche « Joindre un poste Ubuntu à un domaine Samba AD (serveur et client) » :
 *  - contrat de fiche et valeurs d'exemple valides ;
 *  - CHAQUE étape porte un poste (serveur ou client) et chaque commande est sur le bon poste
 *    (samba-tool sur le serveur ; realm, sssd, netplan, hostnamectl, pam-auth-update sur le client) ;
 *  - chaque paramètre dit où et avec quelle commande lire sa valeur (« trouver ») ;
 *  - annulation ET purge couvertes des deux côtés ;
 *  - contre-épreuves : une étape sans poste, une commande sur le mauvais poste, un « trouver » inconnu → refusés.
 * NE PROUVE PAS : l'effet des commandes sur un vrai contrôleur Samba ou un vrai client (NON EXÉCUTÉES).
 * Usage : node test/jonction-ad.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const P = await imp('procedures.mjs'); const T = await imp('taches.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const p = T.entreeParId('cours-ubuntu-jonction-ad').procedure;
const etapes = p.methodes[0].etapes;
const exemples = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
const lignes = (e) => (e.lignes ?? []).map((l) => l.cmd).join('\n');

console.log('1. Contrat et exemples');
assert(P.incoherencesProcedure(p).length === 0, 'contrat de fiche', P.incoherencesProcedure(p).join(' | '));
for (const q of p.params) assert(P.validerParametre(q, q.exemple).ok, `exemple valide : ${q.id}`);
const rendu = P.rendreMethode(p.methodes[0], p.params, exemples);
assert(rendu.manquants.length === 0, 'aucun paramètre manquant avec les exemples');
assert(rendu.parMachine.map((m) => m.id).sort().join() === 'client-ubuntu,serveur', 'deux postes : serveur et client Ubuntu');

console.log('2. Chaque étape a son poste, chaque commande le bon');
assert(etapes.every((e) => e.machine === 'serveur' || e.machine === 'client-ubuntu'), 'toute étape porte « serveur » ou « client-ubuntu »');
for (const e of etapes) {
  const cmd = lignes(e);
  if (/samba-tool/.test(cmd)) assert(e.machine === 'serveur', `samba-tool sur le serveur : ${e.titre}`);
  if (/\b(realm|sssd|sss_cache|netplan|hostnamectl|pam-auth-update|timesyncd|resolvectl)\b/.test(cmd)) assert(e.machine === 'client-ubuntu', `commande de poste client sur le client : ${e.titre}`);
  assert(e.machine === 'serveur' ? /^Serveur/.test(e.titre) : /^(Client|Annuler|Purger)/.test(e.titre), `titre annonce le poste : ${e.titre}`);
}

console.log('3. Préparation et jonction');
const tout = etapes.map((e) => `${e.machine}|${lignes(e)}`).join('\n');
for (const [attendu, poste] of [['systemctl is-active samba-ad-dc', 'serveur'], ['timedatectl', 'serveur'], ['ufw status', 'serveur'], ['dns add', 'serveur'], ['ip -br link', 'client-ubuntu'], ['netplan try', 'client-ubuntu'], ['set-hostname', 'client-ubuntu'], ['realm discover', 'client-ubuntu'], ['realm join', 'client-ubuntu'], ['samba-tool computer list', 'serveur'], ['pam-auth-update --enable mkhomedir', 'client-ubuntu']]) {
  assert(new RegExp(`^${poste}\\|[\\s\\S]*?${attendu.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'm').test(tout) || etapes.some((e) => e.machine === poste && lignes(e).includes(attendu)), `${attendu} sur ${poste}`);
}
const iJoin = etapes.findIndex((e) => lignes(e).includes('realm join'));
const iConfirme = etapes.findIndex((e) => lignes(e).includes('samba-tool computer list') && e.machine === 'serveur');
assert(iJoin >= 0 && iConfirme === iJoin + 1, 'la jonction est confirmée sur le serveur juste après realm join');
assert(!rendu.etapes.some((e) => /password|motdepasse/i.test(e.rendu.texteCopie) && /--password|-p\s/.test(e.rendu.texteCopie)), 'aucun mot de passe dans une commande');

console.log('4. Annuler et purger, des deux côtés');
const iAnnul = etapes.findIndex((e) => /^Annuler/.test(e.titre));
const fin = etapes.slice(iAnnul);
const dans = (poste, motif) => fin.some((e) => e.machine === poste && lignes(e).includes(motif));
for (const [poste, motif] of [['client-ubuntu', 'realm leave --remove'], ['client-ubuntu', 'pam-auth-update --remove mkhomedir'], ['client-ubuntu', 'sss_cache -E'], ['client-ubuntu', 'rm /etc/netplan/60-domaine-ad.yaml'], ['client-ubuntu', 'rm /etc/systemd/timesyncd.conf.d/domaine-ad.conf'], ['client-ubuntu', 'hostnamectl set-hostname'], ['client-ubuntu', 'apt purge'], ['serveur', 'samba-tool computer delete'], ['serveur', 'samba-tool dns delete'], ['client-ubuntu', 'realm list']]) assert(dans(poste, motif), `annulation : ${motif} sur ${poste}`);
assert(fin.every((e) => e.facultatif === true), 'toute la partie annulation est facultative (jamais faite par défaut)');
assert(fin.filter((e) => /supprimer|Purger|quitter/.test(e.titre)).every((e) => e.effet === 'destructif'), 'les suppressions sont marquées destructives');
assert(fin.findIndex((e) => e.machine === 'serveur') > fin.findIndex((e) => lignes(e).includes('realm leave')), 'le client est défait avant le serveur');
assert(/mkhomedir/.test(lignes(fin.find((e) => lignes(e).includes('pam-auth-update --remove')))), 'mkhomedir défait');
assert(/sans corbeille|annuaire/i.test(JSON.stringify(fin.find((e) => lignes(e).includes('computer delete')))), 'avertissement sur la suppression du compte machine');

console.log('5. Où lire chaque valeur (« trouver »)');
for (const q of p.params) {
  assert(q.trouver && P.MACHINES[q.trouver.poste] && (q.trouver.commande || q.trouver.texte), `paramètre ${q.id} : poste et commande indiqués`);
}
assert(p.params.find((q) => q.id === 'interface').trouver.poste === 'client-ubuntu' && p.params.find((q) => q.id === 'interface').trouver.commande === 'ip -br link', 'interface : « ip -br link » sur le client');
assert(p.params.find((q) => q.id === 'dns').trouver.poste === 'serveur', 'adresse du contrôleur : à lire sur le serveur');

console.log('6. Valeurs piégées');
const v = (id, val) => P.validerParametre(p.params.find((q) => q.id === id), val);
assert(!v('poste', 'client.lab').ok && !v('poste', 'a b').ok && !v('poste', 'x;rm').ok, 'poste : point, espace et injection refusés');
assert(!v('admin', 'a; reboot').ok && !v('dernierOctet', '0').ok && !v('dernierOctet', '255').ok && !v('ipClient', '172.27.1.999').ok, 'admin, octet et adresse invalides refusés');

console.log('7. Contre-épreuves');
{
  const a = structuredClone(p); delete a.methodes[0].etapes[0].machine; 
  const sansPoste = a.methodes[0].etapes.every((e) => e.machine);
  assert(!sansPoste, 'contre-épreuve : une étape sans poste est bien détectée par ce test');
  const b = structuredClone(p); b.params[0].trouver = { poste: 'poste-inconnu', commande: 'x' };
  assert(P.incoherencesProcedure(b).length > 0, 'un « trouver » vers un poste inconnu est refusé par le contrat');
  const c = structuredClone(p); c.params[0].trouver = { poste: 'serveur' };
  assert(P.incoherencesProcedure(c).length > 0, 'un « trouver » sans commande est refusé par le contrat');
  const d = structuredClone(p); d.methodes[0].etapes.find((e) => lignes(e).includes('computer list')).machine = 'client-ubuntu';
  assert(d.methodes[0].etapes.some((e) => /samba-tool/.test(lignes(e)) && e.machine !== 'serveur'), 'contre-épreuve : samba-tool sur le client est détecté');
}

console.log(`\njonction-ad : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Commandes samba-tool, realm, SSSD et netplan NON exécutées sur un vrai serveur ou client.');
process.exit(failed ? 1 : 0);
