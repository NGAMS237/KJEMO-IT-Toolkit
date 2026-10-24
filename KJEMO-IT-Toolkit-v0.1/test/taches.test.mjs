#!/usr/bin/env node
/**
 * taches.test.mjs — UX-COMMANDES-PROCEDURES-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Banc STATIQUE (Node, sans navigateur) de la couche « tâches » :
 * moteur de procédures, catalogue, recherche, marquage.
 *
 * CE QUE CE BANC PROUVE : le contrat des fiches (rédigées et adaptées des
 * commandes rapides), la substitution et la validation des paramètres, le
 * blocage de la copie, l'absence d'invite dans le texte copié, le classement
 * de la recherche sur des requêtes représentatives, la couverture des 211
 * assistants, le marquage HTML produit.
 * CE QU'IL NE PROUVE PAS : l'affichage dans un navigateur (voir
 * browser-taches.test.mjs) ni l'effet d'une commande sur une machine ou un
 * équipement réel (NON EXÉCUTÉ : le Toolkit n'exécute rien).
 *
 * Usage : node test/taches.test.mjs   (exit 0 = tout OK)
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const P = await imp('procedures.mjs');
const T = await imp('taches.mjs');
const V = await imp('vue-taches.mjs');
const { tools } = await imp('generators.mjs');
const PROCEDURES_PILOTES = T.PROCEDURES_REDIGEES;

let passed = 0; let failed = 0;
function assert(cond, label, detail = '') {
  if (cond) { passed++; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${label}`); }
  else { failed++; console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`); }
}
const proc = (id) => T.procedureParId(id);

// ---------------------------------------------------------------------------
console.log('1. Contrat des fiches');
for (const p of PROCEDURES_PILOTES) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `fiche rédigée conforme : ${p.id}`, pb.join(' | '));
}
const cr = T.TOUTES_LES_ENTREES.filter((e) => e.kind === 'commande');
assert(cr.length === 112, `112 commandes rapides adaptées (${cr.length})`);
for (const e of cr) {
  const pb = P.incoherencesProcedure(e.procedure);
  assert(pb.length === 0, `commande rapide adaptée conforme : ${e.id}`, pb.join(' | '));
}
const ids = T.TOUTES_LES_ENTREES.map((e) => e.id);
assert(new Set(ids).size === ids.length, 'aucun identifiant en double entre fiches, commandes et assistants');
for (const p of PROCEDURES_PILOTES) {
  assert(!p.assistant || tools.some((t) => t.id === p.assistant), `l'assistant lié existe : ${p.id} → ${p.assistant}`);
}
for (const e of cr) {
  assert(!e.assistant || tools.some((t) => t.id === e.assistant), `assistant lié existe : ${e.id}`);
}
// Méthodes réelles seulement : aucun onglet vide, aucune méthode graphique avec commande.
for (const p of PROCEDURES_PILOTES) {
  for (const m of p.methodes) {
    assert(m.etapes.length > 0, `méthode non vide : ${p.id}/${m.id}`);
    assert(m.id !== 'gui' || m.etapes.every((e) => Array.isArray(e.actions) && e.actions.length), `méthode graphique : actions en ordre : ${p.id}`);
  }
}
// Le contrat doit REFUSER les défauts : contre-épreuves.
{
  const base = structuredClone(PROCEDURES_PILOTES[0]);
  const faute = (mut) => { const c = structuredClone(base); mut(c); return P.incoherencesProcedure(c); };
  assert(faute((c) => { c.methodes[0].etapes[0].lignes[0].cmd = 'Switch# show vlan id {{vlan}}'; }).some((x) => /invite/.test(x)), 'refuse une invite collée dans la commande');
  assert(faute((c) => { c.methodes[0].etapes[0].lignes[0].cmd = 'show vlan id {{zzz}}'; }).some((x) => /non déclaré/.test(x)), 'refuse un paramètre non déclaré');
  assert(faute((c) => { c.params[0].exemple = '1'; }).some((x) => /exemple/.test(x)), 'refuse un exemple rejeté par son validateur');
  assert(faute((c) => { c.methodes.push({ id: 'linux', etapes: [], verification: ['x'] }); }).some((x) => /aucune étape/.test(x)), 'refuse un onglet sans étape');
  assert(faute((c) => { c.sources = []; }).some((x) => /source/.test(x)), 'refuse une fiche sans source');
  assert(faute((c) => { c.methodes[0].etapes[0].lignes[0].cmd = 'show vlan id {{vlan}} ‹x›'; }).some((x) => /repère/.test(x)), 'refuse un repère dans une commande');
}

// ---------------------------------------------------------------------------
console.log('2. Paramètres : valeurs, validation, blocage de la copie');
{
  const p = proc('cisco-creer-vlan');
  const m = p.methodes[0];
  const r0 = P.rendreMethode(m, p.params, {});
  assert(r0.etapes[0].rendu.bloque && r0.etapes[0].rendu.texteCopie === null, 'sans valeur : la copie de l’étape 1 est bloquée');
  assert(r0.etapes[1].rendu.bloque === false && r0.etapes[1].rendu.texteCopie === 'configure terminal', 'une étape sans paramètre reste copiable');
  assert(r0.etapes[0].rendu.lignes[0].affichage.includes('‹numéro du VLAN›'), 'repère visible à l’écran pour la valeur manquante');
  assert(r0.texteComplet === null, 'séquence complète bloquée tant qu’il manque une valeur');

  const r1 = P.rendreMethode(m, p.params, { vlan: '10', nom: 'ADMIN' });
  assert(r1.etapes[0].rendu.texteCopie === 'show vlan id 10\nshow vtp status', 'valeur reflétée dans la commande (show vlan id 10), suivie de la lecture du mode VTP');
  assert(r1.etapes[2].rendu.texteCopie === 'vlan 10\nname ADMIN', 'création : vlan 10 puis name ADMIN, sans invite');
  assert(!/Switch|#|‹/.test(r1.etapes[2].rendu.texteCopie), 'aucune invite, aucun repère dans le texte copié');
  assert(r1.texteComplet !== null && !/copy running-config/.test(r1.texteComplet), 'séquence complète SANS l’enregistrement facultatif (aucune sauvegarde durable ajoutée en silence)');
  assert(r1.etapes[5].rendu.texteCopie === 'copy running-config startup-config', 'l’enregistrement reste copiable seul, comme étape à part');
  assert(/^[\x00-\x7f]*$/.test(r1.texteComplet), 'texte IOS : ASCII uniquement');

  for (const [v, attendu] of [['1', false], ['4095', false], ['0', false], ['10;reload', false], ['1002', false], ['10\nreload', false], ['', false], ['abc', false], ['2', true], ['4094', true], [' 20 ', true]]) {
    assert(P.validerParametre(p.params[0], v).ok === attendu, `VLAN ${JSON.stringify(v)} → ${attendu ? 'accepté' : 'refusé'}`);
  }
  for (const [v, attendu] of [['ADMIN', true], ['RH-2', true], ['mon vlan', false], ['1RH', false], ['a;b', false], ['x'.repeat(33), false]]) {
    assert(P.validerParametre(p.params[1], v).ok === attendu, `nom VLAN ${JSON.stringify(v)} → ${attendu ? 'accepté' : 'refusé'}`);
  }
  const rInv = P.rendreMethode(m, p.params, { vlan: '10;reload', nom: 'ADMIN' });
  assert(rInv.etapes[0].rendu.texteCopie === null, 'valeur invalide : la copie est refusée, la commande n’est jamais assemblée');
  assert(!rInv.etapes[0].rendu.lignes[0].copie.includes('reload'), 'valeur hostile jamais présente dans le texte copiable');
}
{
  const p = proc('cisco-affecter-port-vlan');
  for (const [v, ok] of [['Fa0/7', true], ['Gi0/1', true], ['Gi1/0/7', true], ['fa0/7', true], ['Fa0/7\nshutdown', false], ['Fa0/99', false], ['Vlan10', false], ['', false]]) {
    assert(P.validerParametre(p.params.find((x) => x.id === 'interface'), v).ok === ok, `interface ${JSON.stringify(v)} → ${ok ? 'acceptée' : 'refusée'}`);
  }
  const r = P.rendreMethode(p.methodes[0], p.params, { interface: 'Fa0/7', vlan: '10' });
  assert(r.etapes[2].rendu.texteCopie === 'configure terminal\ninterface FastEthernet0/7\nswitchport mode access\nswitchport access vlan 10\nend', 'port : configuration complète, aucune sauvegarde');
}
{
  const p = proc('linux-etat-service');
  const prm = p.params[0];
  for (const [v, ok] of [['ssh.service', true], ['nginx', true], ['-rf', false], ['a;b', false], ['$(id)', false], ['a b', false], ['', false]]) {
    assert(P.validerParametre(prm, v).ok === ok, `service ${JSON.stringify(v)} → ${ok ? 'accepté' : 'refusé'}`);
  }
  const r = P.rendreMethode(p.methodes[0], p.params, { service: 'ssh.service' });
  assert(r.etapes[0].rendu.texteCopie === 'systemctl status ssh.service --no-pager', 'commande de service reflète la valeur');
}
{
  const p = proc('imprimante-file-bloquee');
  const m = p.methodes.find((x) => x.id === 'powershell');
  assert(P.validerParametre(p.params[0], 'Imprimante Accueil').ok, 'nom de file avec espace accepté (guillemets dans le modèle)');
  for (const v of ['A"; Stop-Computer; "', 'A`b', '$env:X', 'A\nB']) assert(!P.validerParametre(p.params[0], v).ok, `nom de file hostile refusé : ${JSON.stringify(v)}`);
  const r = P.rendreMethode(m, p.params, { imprimante: 'Imprimante Accueil', travail: '12' });
  assert(r.etapes[2].rendu.texteCopie === 'Remove-PrintJob -PrinterName "Imprimante Accueil" -ID 12', 'retrait d’UN travail : nom entre guillemets, identifiant numérique');
  assert(!P.validerParametre(p.params[1], '12; Restart-Service Spooler').ok && !P.validerParametre(p.params[1], '0').ok, 'numéro de travail : entier positif seul');
  assert(r.texteComplet !== null && !/Restart-Service/.test(r.texteComplet), 'dernier recours exclu de la séquence');
  assert(m.copieSequence === false, 'séquence non proposée pour la file bloquée (le numéro vient d’une lecture précédente)');
  assert(r.etapes[4].dernierRecours === true && r.etapes[4].effet === 'interruption', 'redémarrage du spouleur : dernier recours, effet « interruption »');
}

// Commandes rapides adaptées : arguments libres, durcis.
{
  const e = T.entreeParId('cr-ip-route');
  assert(e && e.procedure.methodes[0].etapes[0].lignes[0].cmd === 'ip route show default', 'commande rapide sans paramètre reprise telle quelle');
  const dossier = cr.find((x) => x.procedure.params.some((q) => q.type === 'arg'));
  const prm = dossier.procedure.params.find((q) => q.type === 'arg');
  for (const v of ['a;b', 'a|b', '$(id)', '`id`', 'a&&b', 'a>b', "a'b", 'a"b', '-rf', 'a\nb', 'x'.repeat(121), '']) {
    assert(!P.validerParametre(prm, v).ok, `argument libre hostile refusé : ${JSON.stringify(v).slice(0, 30)}`);
  }
  assert(P.validerParametre(prm, '/srv/donnees/équipe 1').ok, 'argument libre : chemin avec espace et accent accepté');
}
// Chaque exemple de chaque fiche passe son validateur et produit un texte sans repère ni invite.
for (const e of [...T.TOUTES_LES_ENTREES.filter((x) => x.procedure)]) {
  const exemples = Object.fromEntries(e.procedure.params.map((q) => [q.id, q.exemple]));
  for (const m of e.procedure.methodes.filter((x) => x.id !== 'gui')) {
    const r = P.rendreMethode(m, e.procedure.params, exemples);
    // Plusieurs machines : un texte PAR machine, jamais un seul (instances).
    const tout = r.etapes.filter((s) => s.rendu).flatMap((s) => (s.rendu.multi ? s.rendu.instances.map((i) => i.texteCopie) : [s.rendu.texteCopie]));
    // Les exemples de commandes rapides n'utilisent pas toujours TOUS les jetons d'une étape de vérification.
    assert(tout.every((t) => t !== null && !t.includes('‹') && !/^\s*(\$|PS>|Switch)/m.test(t)), `exemples → texte copiable propre : ${e.id}/${m.id}`);
  }
}

// ---------------------------------------------------------------------------
console.log('3. Recherche : classement sur des requêtes représentatives');
const premier = (q, opts) => T.chercher(q, opts)[0]?.entree;
const rang = (q, id) => T.chercher(q).findIndex((r) => r.entree.id === id);
for (const [q, id] of [
  ['créer vlan', 'cisco-creer-vlan'], ['creer un vlan', 'cisco-creer-vlan'], ['ajouter un vlan', 'cisco-creer-vlan'],
  ['vider dns', 'vider-cache-dns'], ['flush dns', 'vider-cache-dns'], ['ipconfig /flushdns', 'vider-cache-dns'], ['vider le cache DNS', 'vider-cache-dns'],
  ['voir ip linux', 'linux-voir-ip-reseau'], ['adresse ip linux', 'linux-voir-ip-reseau'],
  ['état service', 'linux-etat-service'], ['imprimante bloquée', 'imprimante-file-bloquee'], ['imprimante bloquee', 'imprimante-file-bloquee'],
  ['file d’impression bloquée', 'imprimante-file-bloquee'], ['annuler un travail d’impression', 'imprimante-file-bloquee'],
  ['changer le vlan d’un port', 'cisco-affecter-port-vlan'], ['switchport access vlan', 'cisco-affecter-port-vlan'],
  ['redémarrer un service linux', 'linux-redemarrer-service'], ['abonnement azure', 'azure-contexte-courant'], ['az account show', 'azure-contexte-courant'],
  ['tester ping', 'tester-ping'], ['tester un port', 'tester-port-tcp'], ['nslookup', 'resoudre-nom-dns'], ['renouveler ip dhcp', 'renouveler-bail-dhcp'],
  ['redémarrer service windows', 'redemarrer-service-windows'], ['sfc scannow', 'reparer-fichiers-systeme'], ['gpupdate', 'appliquer-strategies-groupe'],
  ['disque plein', 'espace-disque-windows'], ['erreurs windows', 'journal-evenements-windows'], ['compte verrouillé', 'ad-debloquer-compte'],
  ['repadmin', 'ad-etat-replication'], ['voir les vlan', 'cisco-voir-vlans'], ['show interfaces trunk', 'cisco-voir-trunks'], ['table mac', 'cisco-trouver-adresse-mac'],
  ['changer abonnement azure', 'azure-changer-abonnement'], ['groupes de ressources', 'azure-lister-groupes-ressources'], ['vm azure arrêtée', 'azure-etat-machines-virtuelles'],
  ['voir ip windows', 'windows-voir-ip'], ['copy run start', 'cisco-enregistrer-config'], ['get-printer', 'imprimantes-inventaire-windows'],
]) {
  const r = rang(q, id);
  assert(r === 0, `« ${q} » → ${id} en tête`, `rang ${r}, tête : ${premier(q)?.id}`);
}
assert(rang('état service', 'windows-etat-service') >= 0 && rang('état service', 'windows-etat-service') <= 2, '« état service » propose aussi le service Windows dans les 3 premiers');
assert(premier('état service windows')?.id === 'windows-etat-service', 'la plateforme dans la requête départage : « état service windows »');
assert(premier('état service linux')?.id === 'linux-etat-service', '« état service linux » → fiche Linux');
{
  const res = T.chercher('vlan');
  assert(res.slice(0, 2).every((r) => r.entree.kind === 'procedure'), '« vlan » : les fiches courtes passent avant les assistants');
  assert(T.chercher('xyzzy plugh').length === 0, 'requête sans rapport : aucun résultat (rien n’est forcé)');
  assert(T.chercher('zzqq').length === 0, 'mot inconnu : aucun résultat');
  assert(T.chercher('linux').every((r) => r.entree.plateformes.includes('Linux')), 'requête « linux » seule : uniquement la plateforme Linux');
  assert(T.chercher('cisco', { categorie: 'Réseau et Cisco' }).length > 0, 'filtre de catégorie combiné à la recherche');
  assert(T.chercher('vlan', { plateforme: 'Linux' }).every((r) => r.entree.plateformes.includes('Linux') && !r.entree.plateformes.includes('Cisco')), 'filtre de plateforme Linux : aucune fiche Cisco');
  assert(T.chercher('dns', { plateforme: 'Windows' }).every((r) => r.entree.plateformes.includes('Windows')), 'filtre de plateforme respecté');
  const a = T.chercher('créer vlan').map((r) => r.entree.id);
  assert(a.every((id, i) => a.indexOf(id) === i), 'aucun résultat en double');
  assert(T.chercher('  VLAN  ').length === T.chercher('vlan').length, 'casse et espaces ignorés');
  assert(T.chercher('éta').length >= 0, 'requête partielle acceptée sans erreur');
  assert(T.chercher('').length === T.ENTREES_LISTEES.length, 'requête vide : tout le catalogue listé');
}
// Une requête très commune ne ramène pas tout le catalogue.
assert(T.chercher('service').length < T.ENTREES_LISTEES.length / 2, '« service » ne ramène pas la moitié du catalogue');

// ---------------------------------------------------------------------------
console.log('4. Couverture : 211 assistants toujours accessibles');
{
  const cv = T.couverture();
  assert(cv.assistants === tools.length && tools.length === 211, `211 assistants au catalogue (${cv.assistants})`);
  const assistantsEntrees = T.TOUTES_LES_ENTREES.filter((e) => e.kind === 'assistant');
  assert(assistantsEntrees.length === 211 && assistantsEntrees.every((e) => e.route === `#/outil/${e.id}`), 'chaque assistant garde sa route #/outil/<id>');
  assert(tools.every((t) => assistantsEntrees.some((e) => e.id === t.id)), 'aucun assistant retiré du catalogue complet');
  // Un assistant plié sous une fiche reste joignable : par la fiche ET par la vue « assistants ».
  const pliés = assistantsEntrees.filter((e) => !T.ENTREES_LISTEES.includes(e));
  assert(pliés.length === PROCEDURES_PILOTES.length || pliés.length > 0, `assistants repliés sous leur fiche : ${pliés.length}`);
  for (const e of pliés) assert(T.ficheDeAssistant(e.id), `assistant replié → fiche existante : ${e.id}`);
  console.log(`   [info] fiches rédigées ${cv.procedures} · commandes rapides ${cv.commandesRapides} · assistants avec fiche courte ${cv.assistantsAvecFiche} · assistants sans fiche ${cv.assistantsSeuls.length}`);
}

// ---------------------------------------------------------------------------
console.log('5. Marquage HTML');
{
  const e = T.entreeParId('cisco-creer-vlan');
  const html0 = V.tachePageMarkup(e, { methodeId: 'ios', saisies: {}, debutant: true });
  assert(/aria-disabled="true"/.test(html0) && /À renseigner pour copier/.test(html0), 'copie désactivée et motif affiché quand une valeur manque');
  assert(/<mark class="ph"/.test(html0), 'repère « ‹…› » mis en évidence');
  assert(/class="cmd-prompt" aria-hidden="true">Switch#/.test(html0), 'invite affichée dans un span aria-hidden, séparé de la commande');
  assert(!/<span class="cmd-text">[^<]*Switch#/.test(html0), 'l’invite n’est jamais dans le texte de la commande');
  const html1 = V.tachePageMarkup(e, { methodeId: 'ios', saisies: { vlan: '10', nom: 'ADMIN' }, vue: 'pas' });
  assert(!/<mark class="ph"/.test(html1) && !/class="copy-step"[^>]*aria-disabled/.test(html1), 'valeurs renseignées : plus de repère, copie active');
  assert(/vlan 10/.test(html1) && /name ADMIN/.test(html1), 'valeurs reflétées dans l’affichage');
  assert((html1.match(/class="copy-step"/g) ?? []).length === 6, 'un bouton Copier par bloc de commande (6)');
  assert(/Facultatif/.test(html1) && /Résultat attendu/.test(html1), 'étape facultative et résultat attendu étiquetés');
  assert(/id="assistantLink"[^>]*href="#\/outil\/cisco-vlan-creation"/.test(html1), 'lien vers l’assistant complet');
  assert(/Sources et limites de validation/.test(html1) && /aucune de ces commandes n’a été exécutée/.test(html1), 'limites de validation affichées honnêtement');
  // V2 : le mode choisit la VUE par défaut ; la Vue rapide ne développe pas les résultats attendus, le Pas à pas les développe toujours.
  const htmlR = V.tachePageMarkup(e, { methodeId: 'ios', saisies: { vlan: '10', nom: 'ADMIN' }, vue: 'rapide' });
  assert(!/step-attendu/.test(htmlR) && /step-attendu/.test(html1), 'Vue rapide : résultats attendus absents ; Pas à pas : développés');
  assert(/important/i.test(html1) && /Important/.test(html1), 'effet important affiché près de l’action');
  // XSS : une valeur saisie est échappée.
  const hx = V.tachePageMarkup(e, { methodeId: 'ios', saisies: { vlan: '"><img src=x onerror=alert(1)>' }, debutant: true });
  assert(!/<img src=x/.test(hx), 'valeur saisie échappée dans la page');
  // Méthodes
  const w = T.entreeParId('windows-voir-ip');
  const hw = V.tachePageMarkup(w, { methodeId: 'gui', debutant: true });
  assert(/role="tablist"/.test(hw) && (hw.match(/role="tab"/g) ?? []).length === 3, 'trois onglets réels (PowerShell, CMD, interface graphique)');
  assert(/gui-actions/.test(hw) && !/copy-step/.test(hw), 'méthode graphique : clics en ordre, aucun bouton Copier');
  const mono = V.tachePageMarkup(T.entreeParId('cisco-etat-interfaces'), { methodeId: 'ios', debutant: true });
  assert(!/role="tablist"/.test(mono), 'une seule méthode : pas d’onglet inutile');
  const ligne = V.ligneResultatMarkup(e, {});
  assert(/class="tool-card task-row kind-procedure"/.test(ligne) && /Procédure/.test(ligne) && /Cisco/.test(ligne), 'ligne de résultat compacte : type et plateforme');
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
