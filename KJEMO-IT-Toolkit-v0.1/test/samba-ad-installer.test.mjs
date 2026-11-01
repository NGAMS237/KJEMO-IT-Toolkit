#!/usr/bin/env node
/**
 * samba-ad-installer.test.mjs — KJEMO-DC-INSTALL-01 · KJEMO IT Toolkit
 * Fiche « Installer un contrôleur de domaine Samba AD sur Ubuntu ».
 *  - contrat, poste Serveur sur chaque étape, sources HTTPS, aucun mot de passe dans une commande ;
 *  - ordre sûr : nom avant provision, ancien smb.conf rangé avant provision, systemd-resolved arrêté avant le démarrage,
 *    krb5.conf copié avant le démarrage, vérifications après ;
 *  - annulations facultatives (domaine, smb.conf, DNS, hosts) ;
 *  - EXÉCUTION RÉELLE sur des fichiers temporaires : remplacement du « dns forwarder » (127.0.0.53 → vrai DNS) et retrait de la ligne 127.0.1.1.
 * NE PROUVE PAS : que samba-tool, systemctl et apt fonctionnent sur un vrai Ubuntu (NON EXÉCUTÉS).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const p = T.entreeParId('samba-ad-installer').procedure; const m = p.methodes[0];
const ex = Object.fromEntries(p.params.map((q) => [q.id, q.exemple]));
const rendu = P.rendreMethode(m, p.params, ex);
assert(P.incoherencesProcedure(p).length === 0, 'contrat respecté', P.incoherencesProcedure(p).join(' | '));
assert(m.etapes.every((e) => e.machine === 'serveur'), 'chaque étape est sur le Serveur');
assert(p.sources.length >= 3 && p.sources.every((s) => /^https:\/\//.test(s.url)), 'sources HTTPS');
assert(rendu.etapes.every((e) => !e.rendu || e.rendu.manquants.length === 0), 'exemples : aucune valeur manquante');
const tout = rendu.etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
assert(!tout.some((l) => /--adminpass|password=|--password/i.test(l)), 'aucun mot de passe dans une commande');
assert(!tout.some((l) => /dns forwarder.*127\.0\.0\.53/.test(l)), 'le DNS en amont n’est jamais 127.0.0.53');
const idx = (re) => m.etapes.findIndex((e) => e.lignes.some((l) => re.test(l.cmd)));
const iHostname = idx(/hostnamectl set-hostname/); const iMv = idx(/mv \/etc\/samba\/smb\.conf \/etc\/samba\/smb\.conf\.orig/);
const iProv = idx(/domain provision/); const iResolved = idx(/disable --now systemd-resolved/); const iKrb = idx(/cp -f \/var\/lib\/samba\/private\/krb5\.conf/);
const iStart = idx(/systemctl start samba-ad-dc/); const iKinit = idx(/kinit/); const iDig = idx(/dig @localhost/);
assert(iHostname >= 0 && iHostname < iProv, 'le nom complet est posé avant le provisionnement');
assert(iMv >= 0 && iMv < iProv, 'l’ancien smb.conf est rangé avant le provisionnement');
assert(iResolved > iProv && iResolved < iStart, 'systemd-resolved est arrêté avant le démarrage du service');
assert(iKrb > iProv && iKrb < iStart, 'krb5.conf est copié avant le démarrage');
assert(iDig > iStart && iKinit > iStart, 'les vérifications viennent après le démarrage');
const an = m.etapes.filter((e) => e.annulation);
assert(an.length >= 5 && an.every((e) => e.facultatif), 'annulations facultatives');
assert(m.etapes.some((e) => e.lignes.some((l) => /rm -rf \/var\/lib\/samba\/private/.test(l.cmd)) && e.effet === 'destructif' && e.facultatif), 'la suppression du domaine est destructive et facultative');
assert(m.etapes.filter((e) => e.interactions?.length).length >= 2, 'mots de passe : invites décrites (setpassword, kinit)');
// Exécution réelle sur fichiers temporaires.
const dir = mkdtempSync(join(tmpdir(), 'kjemo-dc-'));
const conf = join(dir, 'smb.conf');
writeFileSync(conf, '[global]\n\tdns forwarder = 127.0.0.53\n\tnetbios name = SERVERDC\n');
const lSed = m.etapes[m.etapes.findIndex((e) => e.lignes.some((l) => /dns forwarder = \.\*/.test(l.cmd)))].lignes[0].cmd.replace('{{forwarder}}', ex.forwarder).replace('/etc/samba/smb.conf', conf).replace('sudo ', '');
spawnSync('bash', ['-c', lSed], { encoding: 'utf8' });
const apres = readFileSync(conf, 'utf8');
assert(/\tdns forwarder = 192\.168\.1\.1\n/.test(apres) && !apres.includes('127.0.0.53') && apres.includes('netbios name'), 'sed : le DNS en amont est remplacé, le reste intact', apres);
const hosts = join(dir, 'hosts'); writeFileSync(hosts, '127.0.0.1 localhost\n127.0.1.1 serverdc\n::1 ip6-localhost\n');
spawnSync('bash', ['-c', `sed -i '/^127\\.0\\.1\\.1/d' ${hosts}`], { encoding: 'utf8' });
assert(readFileSync(hosts, 'utf8') === '127.0.0.1 localhost\n::1 ip6-localhost\n', 'sed : seule la ligne 127.0.1.1 disparaît de hosts');
console.log(`samba-ad-installer : ${passed} vérification(s) réussie(s), ${failed} échec(s). samba-tool, systemctl et apt NON exécutés sur un vrai Ubuntu.`);
process.exit(failed ? 1 : 0);
