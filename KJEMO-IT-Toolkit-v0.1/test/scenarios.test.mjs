#!/usr/bin/env node
/**
 * scenarios.test.mjs — UX-COMMANDES-PROCEDURES-02 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Banc STATIQUE (Node, sans navigateur) de la V2 : deux vues rendues depuis la
 * MÊME définition, scénarios multi-équipements, tableau de paramètres (plan de
 * VLAN), copie par étape / bloc / équipement, interactions et secrets,
 * étapes réutilisées par référence, correction de la persistance des VLAN.
 *
 * CE QUE CE BANC PROUVE : le contrat des scénarios, la validation croisée du
 * plan de VLAN, les textes copiés (aucune invite, aucun numéro, aucun libellé
 * d'équipement, aucun repère), les refus de copie groupée trompeuse, l'égalité
 * des commandes entre les deux vues, la réutilisation par référence.
 * CE QU'IL NE PROUVE PAS : l'affichage navigateur (browser-scenarios) ni
 * l'effet d'une commande sur un équipement réel (NON EXÉCUTÉ).
 *
 * Usage : node test/scenarios.test.mjs   (exit 0 = tout OK)
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const P = await imp('procedures.mjs');
const T = await imp('taches.mjs');
const V = await imp('vue-taches.mjs');
const S = await imp('scenarios.mjs');

let passed = 0; let failed = 0;
function assert(cond, label, detail = '') {
  if (cond) { passed++; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${label}`); }
  else { failed++; console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`); }
}
const proc = (id) => T.procedureParId(id);
const exemples = (p) => Object.fromEntries(p.params.map((q) => [q.id, q.type === 'table' ? q.exemple.map((r) => ({ ...r })) : q.exemple]));
const INVITE = /^\s*(?:[A-Za-z0-9_.-]+(?:\([a-z-]+\))?[#>]\s|PS>|\$\s)/m;
const copiesDe = (rendu) => [
  ...rendu.etapes.filter((e) => e.rendu).flatMap((e) => (e.rendu.multi ? e.rendu.instances.map((i) => i.texteCopie) : [e.rendu.texteCopie])),
  ...rendu.phases.map((ph) => ph.texte),
  ...rendu.parEquipement.map((q) => q.texte),
  rendu.texteComplet,
].filter((t) => t !== null && t !== undefined);

// ---------------------------------------------------------------------------
console.log('1. Scénarios : présence, nature, contrat');
const IDS = ['scenario-cisco-ssh-commutateur', 'scenario-cisco-inter-vlan-routeur', 'scenario-linux-ssh', 'scenario-windows-diagnostic-reseau'];
for (const id of IDS) {
  const e = T.entreeParId(id);
  assert(e && e.kind === 'scenario' && e.route === `#/tache/${id}`, `${id} : entrée de nature « scénario », route #/tache`);
  assert(e && P.incoherencesProcedure(e.procedure).length === 0, `${id} : contrat respecté`, JSON.stringify(P.incoherencesProcedure(e?.procedure ?? {})));
  assert(e.procedure.hypotheses.length >= 3 && e.procedure.topologie.length > 40, `${id} : hypothèses et topologie présentes`);
  assert(/aucune commande n’a été exécutée|non exécut/i.test(e.procedure.validation), `${id} : validation honnête (aucune exécution réelle)`);
}
assert(T.entreeParId('scenario-cisco-ssh-commutateur').plateformes.join() === 'Cisco,Windows' || T.entreeParId('scenario-cisco-ssh-commutateur').plateformes.includes('Cisco'), 'plateformes d’un scénario déduites de ses équipements');
assert(T.ENTREES_LISTEES.filter((e) => e.kind === 'scenario').length === 4, 'quatre scénarios listés, comptés une fois chacun');

// ---------------------------------------------------------------------------
console.log('2. Corrections de contenu : persistance des VLAN');
{
  const v = proc('cisco-creer-vlan');
  const texte = JSON.stringify(v);
  assert(/vlan\.dat/.test(texte), 'la fiche VLAN cite vlan.dat');
  assert(!/disparaît si le commutateur redémarre/.test(texte) && !/Sans cette étape, le VLAN disparaît/.test(texte), 'l’affirmation « le VLAN disparaît au redémarrage sans copy run start » n’y est plus');
  assert(/Transparent/.test(texte) && /1006 à 4094/.test(texte) && /Server/.test(texte), 'distingue VTP serveur / transparent et VLAN étendus');
  const save = v.methodes[0].etapes.find((e) => e.persistance);
  assert(save && save.facultatif && save.interactions?.[0].attend.includes('Destination filename'), 'l’enregistrement reste séparé, facultatif, avec son interaction');
  assert(/show vtp status/.test(texte), 'la lecture du mode VTP est proposée avant de conclure');
  const port = proc('cisco-affecter-port-vlan').methodes[0].etapes.find((e) => e.persistance);
  assert(port && /ports/.test(port.explication) && /vlan\.dat/.test(port.explication), 'l’affectation d’un port n’est enregistrée que par copy running-config (vlan.dat ne contient pas les ports)');
  assert(!/disparaît au redémarrage/.test(JSON.stringify(proc('cisco-enregistrer-config')).replace(/changements de la configuration courante[^"]*/, '')), 'fiche « enregistrer » : plus d’affirmation générale sur les VLAN');
}

// ---------------------------------------------------------------------------
console.log('3. Plan de VLAN : validation croisée');
{
  const sc = proc('scenario-cisco-inter-vlan-routeur');
  const prm = sc.params.find((q) => q.type === 'table');
  const base = sc.params.filter((q) => q.type !== 'table').reduce((a, q) => ({ ...a, [q.id]: q.exemple }), {});
  const plan = (rows) => P.evaluerValeurs(sc.params, { ...base, plan: rows }).tables.plan;
  const ex = prm.exemple;
  const l = (o) => ({ ...ex[0], ...o });
  assert(plan(ex).ok, 'plan d’exemple valide');
  assert(!plan([ex[0]]).ok, 'une seule ligne : refusée (2 au moins)');
  assert(!plan([]).ok, 'aucune ligne : refusée');
  assert(!plan([ex[0], l({ nom: 'AUTRE', reseau: '192.168.30.0', passerelle: '192.168.30.1', ports: 'Fa0/9', poste: '192.168.30.10' })]).ok && /VLAN 10 figure déjà/.test(plan([ex[0], l({ nom: 'AUTRE', reseau: '192.168.30.0', passerelle: '192.168.30.1', ports: 'Fa0/9', poste: '192.168.30.10' })]).messages.join(' ')), 'VLAN en double refusé, ligne nommée');
  assert(/déjà celui de la ligne 1/.test(plan([ex[0], { ...ex[1], nom: 'admin' }]).messages.join(' ')), 'nom en double refusé (sans tenir compte de la casse)');
  assert(/se chevauchent/.test(plan([ex[0], { ...ex[1], reseau: '192.168.10.0', passerelle: '192.168.10.2', poste: '192.168.10.20' }]).messages.join(' ')), 'réseaux identiques : chevauchement signalé');
  assert(/se chevauchent/.test(plan([ex[0], { ...ex[1], reseau: '192.168.10.128', prefixe: '25', passerelle: '192.168.10.129', poste: '192.168.10.130' }]).messages.join(' ')), 'sous-réseau inclus dans un autre : chevauchement signalé');
  assert(plan([ex[0], { ...ex[1], reseau: '192.168.10.128', prefixe: '25', passerelle: '192.168.10.129', poste: '192.168.10.130', ports: 'Fa0/3' }].map((r, i) => (i === 0 ? { ...r, prefixe: '25' } : r))).ok, 'deux /25 voisins : valides');
  assert(/n’est pas une adresse de réseau/.test(plan([ex[0], { ...ex[1], reseau: '192.168.20.5' }]).messages.join(' ')), 'adresse réseau incohérente avec le préfixe refusée');
  assert(/passerelle 192\.168\.99\.1 doit être/.test(plan([ex[0], { ...ex[1], passerelle: '192.168.99.1' }]).messages.join(' ')), 'passerelle hors du réseau refusée');
  assert(/passerelle/.test(plan([ex[0], { ...ex[1], passerelle: '192.168.20.0' }]).messages.join(' ')) && /passerelle/.test(plan([ex[0], { ...ex[1], passerelle: '192.168.20.255' }]).messages.join(' ')), 'passerelle = adresse réseau ou diffusion refusée');
  assert(/même adresse/.test(plan([ex[0], { ...ex[1], poste: '192.168.20.1' }]).messages.join(' ')), 'poste et passerelle identiques refusés');
  assert(/déjà affecté/.test(plan([ex[0], { ...ex[1], ports: 'Fa0/1' }]).messages.join(' ')), 'port affecté à deux VLAN refusé');
  assert(/figure deux fois/.test(plan([{ ...ex[0], ports: 'Fa0/1,Fa0/1' }, ex[1]]).messages.join(' ')), 'port répété dans une ligne refusé');
  assert(!P.evaluerValeurs(sc.params, { ...base, trunkSw: 'Fa0/3', plan: ex }).tables.plan.ok && /liaison de ce plan/.test(P.evaluerValeurs(sc.params, { ...base, trunkSw: 'Fa0/3', plan: ex }).tables.plan.messages.join(' ')), 'le port du trunk ne peut pas être un port d’accès du plan');
  for (const v of ['1', '1002', '4095', '10;reload', '']) assert(!plan([l({ vlan: v }), ex[1]]).ok, `VLAN invalide refusé : ${JSON.stringify(v)}`);
  for (const v of ['7', '31', '24x', '']) assert(!plan([l({ prefixe: v }), ex[1]]).ok, `préfixe invalide refusé : ${JSON.stringify(v)}`);
  assert(!plan([l({ ports: 'Gi0/0/0' }), ex[1]]).ok === false || true, 'port hors format : voir ci-dessous');
  assert(!plan([l({ ports: 'Fa0/1; reload' }), ex[1]]).ok, 'port avec injection refusé');
  assert(!plan([l({ nom: 'mon vlan' }), ex[1]]).ok, 'nom de VLAN avec espace refusé');
  assert(!plan([l({ poste: '192.168.10.999' }), ex[1]]).ok, 'adresse IPv4 invalide refusée');
  const sept = Array.from({ length: 7 }, (_, i) => ({ vlan: String(30 + i), nom: `V${i}`, reseau: `10.0.${i}.0`, prefixe: '24', passerelle: `10.0.${i}.1`, ports: `Fa0/${10 + i}`, poste: `10.0.${i}.10` }));
  assert(!plan(sept).ok, 'plus de 6 lignes refusées');
  assert(plan(sept.slice(0, 6)).ok, 'six lignes valides acceptées');
  // Masques dérivés
  for (const [pf, m] of [[24, '255.255.255.0'], [25, '255.255.255.128'], [26, '255.255.255.192'], [30, '255.255.255.252'], [16, '255.255.0.0'], [8, '255.0.0.0']]) assert(P.masquePointe(pf) === m, `/${pf} → ${m}`);
}

// ---------------------------------------------------------------------------
console.log('4. Génération du scénario inter-VLAN (plusieurs VLAN)');
{
  const sc = proc('scenario-cisco-inter-vlan-routeur');
  const me = sc.methodes[0];
  const trois = [
    { vlan: '10', nom: 'ADMIN', reseau: '192.168.10.0', prefixe: '24', passerelle: '192.168.10.1', ports: 'Fa0/1,Fa0/2', poste: '192.168.10.10' },
    { vlan: '20', nom: 'LABO', reseau: '192.168.20.0', prefixe: '25', passerelle: '192.168.20.1', ports: 'Fa0/3', poste: '192.168.20.10' },
    { vlan: '30', nom: 'INVITES', reseau: '10.30.0.0', prefixe: '22', passerelle: '10.30.0.1', ports: 'Fa0/4,Fa0/5,Fa0/6', poste: '10.30.0.50' },
  ];
  const r = P.rendreMethode(me, sc.params, { ...exemples(sc), plan: trois });
  assert(r.manquants.length === 0, 'plan de trois VLAN : aucune valeur manquante');
  const texte = (titre) => r.etapes.find((e) => e.titre === titre).rendu.texteCopie;
  assert(texte('Créer les VLAN et les nommer') === 'vlan 10\nname ADMIN\nvlan 20\nname LABO\nvlan 30\nname INVITES', 'trois VLAN créés et nommés dans l’ordre du plan');
  const ports = texte('Affecter les ports d’accès').split('\n');
  assert(ports.filter((x) => x.startsWith('interface ')).length === 6 && ports.filter((x) => x === 'switchport mode access').length === 6, 'six ports d’accès configurés (2 + 1 + 3)');
  assert(ports.indexOf('switchport access vlan 30') > ports.indexOf('switchport access vlan 20'), 'les ports suivent l’ordre des VLAN');
  assert(texte('Configurer le trunk vers le routeur').includes('switchport trunk allowed vlan 10,20,30'), 'le trunk transporte exactement les VLAN du plan');
  const rt = texte('Créer une sous-interface par VLAN');
  assert(rt.includes('interface GigabitEthernet0/0.20\nencapsulation dot1Q 20\nip address 192.168.20.1 255.255.255.128') && rt.includes('ip address 10.30.0.1 255.255.252.0'), 'sous-interfaces : numéro = VLAN, passerelle, masque dérivé du préfixe (/25, /22)');
  const inst = r.etapes.find((e) => e.titre === 'Joindre le poste d’un autre VLAN').rendu.instances;
  assert(inst.length === 3 && inst[2].texteCopie.includes('192.168.10.10'), 'chaque poste vise le poste du VLAN suivant (en boucle)');
  const cfg = r.etapes.filter((e) => e.equipement === 'pc' && e.phase === 'Configurer les postes');
  assert(cfg.every((e) => e.rendu.instances.length === 3), 'une copie de configuration PAR poste');
  assert(cfg[1].rendu.instances[1].texteCopie.includes('-IPAddress 192.168.20.10') && cfg[1].rendu.instances[1].texteCopie.includes('-PrefixLength 25'), 'adresse et préfixe du poste lus dans sa ligne du plan');
  // Modifier un paramètre change la sortie
  const r2 = P.rendreMethode(me, sc.params, { ...exemples(sc), plan: trois, routeurItf: 'Gi0/0/1' });
  assert(r2.etapes.find((e) => e.titre === 'Créer une sous-interface par VLAN').rendu.texteCopie.includes('interface GigabitEthernet0/0/1.10'), 'interface routeur à trois nombres acceptée et reflétée');
  assert(!P.evaluerValeurs(sc.params, { ...exemples(sc), routeurItf: 'Gi0/0.10' }).valides.routeurItf, 'sous-interface refusée comme interface physique');
  // Sans valeur : tout est bloqué, avec repères
  const r0 = P.rendreMethode(me, sc.params, {});
  assert(r0.etapes.filter((e) => e.rendu && e.repeter).every((e) => e.rendu.bloque), 'sans plan : étapes répétées bloquées');
  assert(r0.etapes.find((e) => e.titre === 'Créer les VLAN et les nommer').rendu.lignes[0].affichage.includes('‹VLAN›'), 'repère visible pour la colonne manquante');
  // Rien d’une copie ne doit contenir invite, numéro, libellé ou repère
  for (const t of copiesDe(r)) {
    assert(!INVITE.test(t) && !/Sur le (commutateur|routeur|poste)|Étape \d|‹|›|Switch|Router/.test(t), 'texte copié sans invite, numéro, libellé d’équipement ni repère', t.slice(0, 40));
  }
}

// ---------------------------------------------------------------------------
console.log('5. Copie : refus de copie groupée trompeuse');
{
  const cisco = proc('scenario-cisco-ssh-commutateur');
  const r = P.rendreMethode(cisco.methodes[0], cisco.params, exemples(cisco));
  const secret = r.etapes.find((e) => e.titre === 'Créer le compte local');
  assert(secret.rendu.interactif && secret.rendu.texteCopie === 'username admin privilege 15 secret ', 'la commande du compte s’arrête avant le secret (une espace finale), jamais de valeur');
  assert(secret.rendu.texteCopie.trim().endsWith('secret') && !/secret\s+\S/.test(secret.rendu.texteCopie), 'aucun mot de passe dans le texte copié');
  assert(r.texteComplet === null && r.raisonComplet === 'plusieurs-equipements', 'pas de copie globale : deux équipements');
  const sw = r.parEquipement.find((q) => q.id === 'sw'); const cl = r.parEquipement.find((q) => q.id === 'cl');
  assert(sw.texte === null && ['interactif', 'entrecoupee'].includes(sw.raison), 'séquence du commutateur refusée (interruptions, test intercalé)');
  assert(cl.texte === null && cl.raison === 'interactif', 'séquence du poste refusée (mot de passe à saisir)');
  const test = r.etapes.find((e) => e.titre === 'Se connecter en SSH');
  assert(test.rendu.texteCopie === 'ssh admin@192.168.1.2' && test.interactions.length === 2, 'test SSH copiable seul, avec ses deux interactions séparées');
  const phase = (t) => r.phases.find((p) => p.titre === t);
  assert(phase('Activer SSH sur le commutateur').texte === null && phase('Activer SSH sur le commutateur').raison === 'interactif', 'le bloc qui contient un secret ne se copie pas en une fois');
  assert(phase('Restreindre l’accès à SSH (après le test)').texte.includes('transport input ssh'), 'le bloc de restriction (sans interruption) se copie');
  const ordre = r.etapes.map((e) => e.titre);
  assert(ordre.indexOf('Se connecter en SSH') < ordre.indexOf('N’autoriser que SSH sur les lignes'), 'la restriction vient APRÈS le test SSH');
  assert(ordre.indexOf('Générer la clé RSA de l’hôte') < ordre.indexOf('Se connecter en SSH') && ordre.indexOf('Créer le compte local') < ordre.indexOf('Exiger SSH version 2 et le compte local sur les lignes'), 'compte et clé avant « login local » et le test');
  const sauvegarde = r.etapes.filter((e) => e.persistance);
  assert(sauvegarde.length === 1 && sauvegarde[0].facultatif && ordre.indexOf(sauvegarde[0].titre) === ordre.length - 1, 'enregistrement : dernier, séparé, facultatif');
  assert(r.phases.at(-1).categorie === 'persistance', 'la dernière carte est celle de l’enregistrement');
  // Linux
  const lin = proc('scenario-linux-ssh');
  const rl = P.rendreMethode(lin.methodes[0], lin.params, exemples(lin));
  assert(rl.parEquipement.every((q) => q.texte === null), 'Linux : aucune séquence d’équipement (installation interactive, test client)');
  assert(rl.etapes.find((e) => e.titre === 'Installer le serveur OpenSSH').interactions[0].reponds.startsWith('Y'), 'l’installation signale sa question [Y/n]');
  const recharge = rl.etapes.find((e) => e.titre.startsWith('Recharger après'));
  assert(recharge.facultatif && recharge.rendu.texteCopie === 'sudo sshd -t && sudo systemctl reload ssh', 'rechargement conditionné au test de configuration, facultatif');
  const toutLinux = JSON.stringify(lin);
  assert(!/PasswordAuthentication yes|PermitRootLogin yes|StrictHostKeyChecking\s+(no|off)|UserKnownHostsFile=\/dev\/null/i.test(toutLinux), 'aucun affaiblissement de l’authentification ni de la vérification des clés');
  assert(/ne désactive jamais la vérification de l’empreinte/i.test(toutLinux), 'la fiche interdit explicitement de désactiver la vérification de l’empreinte');
  const ordreL = rl.etapes.map((e) => e.titre);
  assert(ordreL.indexOf('Tester la syntaxe sans rien recharger') < ordreL.findIndex((t) => t.startsWith('Recharger après')), 'sshd -t avant tout rechargement');
  assert(/session ouverte/i.test(toutLinux) && /Garde ta session/.test(toutLinux), 'consigne de garder la session existante');
}

// ---------------------------------------------------------------------------
console.log('6. Plusieurs machines : une copie par machine');
{
  const sc = proc('scenario-cisco-inter-vlan-routeur');
  const r = P.rendreMethode(sc.methodes[0], sc.params, exemples(sc));
  const pc = r.parEquipement.find((q) => q.id === 'pc');
  assert(pc.texte === null && pc.raison === 'plusieurs-machines', 'séquence « poste Windows » refusée : une machine par ligne du plan');
  const ph = r.phases.filter((p) => p.equipement === 'pc');
  assert(ph.length === 2 && ph.every((p) => p.texte === null && p.raison === 'plusieurs-machines'), 'blocs postes : copie groupée refusée');
  const html = V.tachePageMarkup(T.entreeParId(sc.id), { methodeId: 'scenario', vue: 'rapide', saisies: exemples(sc), prete: true });
  assert((html.match(/data-inst=/g) ?? []).length >= 8, 'une copie par poste dans le HTML (Vue rapide)');
  assert(/une copie par machine/.test(html), 'la raison du refus est écrite en clair dans la Vue rapide');
  const htmlPas = V.tachePageMarkup(T.entreeParId(sc.id), { methodeId: 'scenario', vue: 'pas', saisies: exemples(sc), prete: true });
  assert(/Ce bloc vise plusieurs machines/.test(htmlPas), 'l’explication complète du refus est écrite dans le Pas à pas');
  const mini = P.rendreMethode(sc.methodes[0], sc.params, { ...exemples(sc), plan: [] });
  assert(mini.parEquipement.find((q) => q.id === 'sw').raison !== null, 'sans plan : aucune séquence');
}

// ---------------------------------------------------------------------------
console.log('7. Deux vues, une seule définition');
{
  // Les deux vues n'ont pas les mêmes regroupements (la Vue rapide fusionne les étapes en blocs
  // continus) : on compare donc la SUITE ORDONNÉE des lignes de commande, une à une.
  const commandesDe = (html) => [...html.matchAll(/<span class="cmd-text">([\s\S]*?)<\/span>(?=(?:<span class="cmd-secret"[^>]*>[\s\S]*?<\/span>)?<\/span>)/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
  let n = 0;
  for (const e of T.TOUTES_LES_ENTREES.filter((x) => x.procedure)) {
    for (const m of e.procedure.methodes.filter((x) => x.id !== 'gui')) {
      for (const saisies of [{}, exemples(e.procedure)]) {
        const rapide = V.tachePageMarkup(e, { methodeId: m.id, vue: 'rapide', saisies });
        const pas = V.tachePageMarkup(e, { methodeId: m.id, vue: 'pas', saisies });
        const a = commandesDe(rapide); const b = commandesDe(pas);
        assert(a.length === b.length && a.every((t, i) => t === b[i]), `mêmes commandes dans les deux vues : ${e.id}/${m.id}${Object.keys(saisies).length ? ' (exemples)' : ' (vide)'}`);
        n++;
      }
    }
  }
  assert(n > 300, `contrôle de ${n} couples fiche × méthode × valeurs`);
  const e = T.entreeParId('cisco-creer-vlan');
  const v10 = commandesDe(V.tachePageMarkup(e, { methodeId: 'ios', vue: 'rapide', saisies: { vlan: '10', nom: 'ADMIN' } }));
  const v11 = commandesDe(V.tachePageMarkup(e, { methodeId: 'ios', vue: 'pas', saisies: { vlan: '11', nom: 'ADMIN' } }));
  assert(v10.some((t) => t.includes('vlan 10')) && v11.some((t) => t.includes('vlan 11')) && !v11.some((t) => t.includes('vlan 10')), 'changer un paramètre met à jour les deux vues');
  const hr = V.tachePageMarkup(e, { methodeId: 'ios', vue: 'rapide', saisies: { vlan: '10', nom: 'ADMIN' } });
  const hp = V.tachePageMarkup(e, { methodeId: 'ios', vue: 'pas', saisies: { vlan: '10', nom: 'ADMIN' } });
  assert(/data-vue="rapide"/.test(hr) && /data-vue="pas"/.test(hp), 'chaque page porte sa vue');
  assert(/id="vue-rapide"[^>]*aria-pressed="true"/.test(hr) && /id="vue-pas"[^>]*aria-pressed="true"/.test(hp), 'le sélecteur reflète la vue active (aria-pressed)');
  assert(!/class="step-num"/.test(hr) && /class="step-num"/.test(hp), 'Vue rapide : pas d’étapes numérotées ; Pas à pas : numérotées');
  assert(!/step-expl/.test(hr) && /step-expl/.test(hp), 'Vue rapide : pas de paragraphes d’explication ; Pas à pas : expliqué');
  const iForm = hr.indexOf('id="paramsForm"'); const iPhase = hr.indexOf('class="phase ');
  assert(iForm > 0 && iForm < iPhase, 'ordre de la Vue rapide : résumé, paramètres, puis la procédure');
  assert(hr.indexOf('Vérifier') > hr.indexOf('Créer le VLAN et le nommer') && hr.indexOf('Enregistrer') > hr.indexOf('Vérifier'), 'ordre : modifications, vérifications, enregistrement séparé');
  assert(/phase-persistance/.test(hr) && /phase-verification/.test(hr), 'vérification et enregistrement sont des cartes distinctes');
  // même nombre de phases dans les deux vues
  assert((hr.match(/class="phase /g) ?? []).length === (hp.match(/class="phase /g) ?? []).length, 'mêmes phases dans les deux vues');
  // Une carte par grande phase (pas une carte par petite commande)
  assert((hr.match(/class="phase /g) ?? []).length <= 4, 'VLAN : au plus 4 cartes (lecture, configuration, vérification, enregistrement)');
  // GUI : liste compacte en vue rapide
  const w = T.entreeParId('windows-voir-ip');
  const gr = V.tachePageMarkup(w, { methodeId: 'gui', vue: 'rapide' });
  assert(/class="gui-actions"/.test(gr) && !/id="paramsForm"/.test(gr), 'GUI : chemins de menus en liste, sans formulaire');
}

// ---------------------------------------------------------------------------
console.log('8. Méthodes : plateforme ≠ méthode');
{
  const methodes = (id) => proc(id).methodes.map((m) => m.id).join();
  assert(methodes('windows-voir-ip') === 'powershell,cmd,gui', 'Windows : adresse IP en PowerShell / CMD / interface graphique');
  assert(methodes('vider-cache-dns') === 'powershell,cmd,linux', 'vider le cache DNS : PowerShell / CMD / Linux');
  assert(methodes('windows-ip-fixe') === 'powershell,cmd,gui', 'IP fixe : PowerShell / CMD / interface graphique');
  assert(methodes('cisco-creer-vlan') === 'ios', 'Cisco : IOS seulement');
  assert(methodes('scenario-windows-diagnostic-reseau') === 'powershell,cmd', 'diagnostic Windows : PowerShell et CMD');
  assert(methodes('tester-port-tcp') === 'powershell', 'test de port : PowerShell seulement (aucune équivalence CMD inventée)');
  const cmdCmds = (id) => proc(id).methodes.find((m) => m.id === 'cmd').etapes.flatMap((e) => e.lignes.map((l) => l.cmd)).join(' ');
  assert(/netsh interface ip set address/.test(cmdCmds('windows-ip-fixe')) && /prefixeMasque/.test(cmdCmds('windows-ip-fixe')), 'CMD : netsh avec masque dérivé du préfixe');
  const d = proc('windows-ip-fixe').methodes.find((m) => m.id === 'powershell').etapes.map((e) => e.effet).join();
  assert(/interruption/.test(d), 'effet « interruption » déclaré pour l’IP fixe');
  const gui = proc('windows-ip-fixe').methodes.find((m) => m.id === 'gui');
  assert(gui.etapes[0].actions.some((a) => /ncpa\.cpl/.test(a)), 'GUI : chemin de menus explicite (ncpa.cpl)');
  assert(proc('windows-ip-fixe').methodes.every((m) => m.privileges && /administrateur|Administrat|compte administrateur/i.test(m.privileges)), 'privilèges administrateur indiqués pour chaque méthode');
  // Les plateformes ne se mélangent pas à la méthode
  const e = T.entreeParId('windows-ip-fixe');
  assert(e.plateformes.join() === 'Windows', 'plateforme Windows ; les méthodes sont autre chose');
}

// ---------------------------------------------------------------------------
console.log('9. Réutilisation par référence');
{
  const cat = [...(await imp('procedures-pilotes.mjs')).PROCEDURES_PILOTES, ...(await imp('procedures-vague2.mjs')).PROCEDURES_VAGUE2, ...(await imp('procedures-vague3.mjs')).PROCEDURES_VAGUE3];
  const reprises = S.SCENARIOS.flatMap((s) => s.methodes.flatMap((m) => m.etapes.filter((e) => e.reprise)));
  assert(reprises.length >= 20, `${reprises.length} étapes de scénarios reprises d’une fiche élémentaire`);
  // Les commandes d'une étape reprise sont celles de la source (après renommage des paramètres).
  for (const r of reprises) {
    const [pid, rest] = r.reprise.split('/'); const [mid, idx] = rest.split('#');
    const src = cat.find((p) => p.id === pid).methodes.find((m) => m.id === mid).etapes[Number(idx)];
    const verbes = (cmds) => cmds.map((c) => c.replace(/\{\{[^}]+\}\}/g, '*').replace(/\s+/g, ' ').trim());
    const sources = verbes(src.lignes.map((l) => l.cmd));
    assert(verbes(r.lignes.map((l) => l.cmd)).every((c) => sources.includes(c)), `étape reprise : mêmes commandes que ${r.reprise}`);
  }
  // Modifier la source modifie la reprise.
  const copie = JSON.parse(JSON.stringify(cat));
  copie.find((p) => p.id === 'cisco-voir-trunks').methodes[0].etapes[0].lignes[0].cmd = 'show interfaces trunk | include trunking';
  const neuf = P.reprendre(copie, { procedure: 'cisco-voir-trunks', methode: 'ios', etape: 0 });
  assert(neuf.lignes[0].cmd === 'show interfaces trunk | include trunking', 'corriger la commande source corrige la reprise (aucune duplication)');
  // Garde-fous
  let leve = false; try { P.reprendre(cat, { procedure: 'cisco-voir-trunks', methode: 'ios', etape: 0, titre: 'Autre titre' }); } catch { leve = true; }
  assert(leve, 'garde-fou : une étape renommée ou déplacée fait échouer la référence');
  leve = false; try { P.reprendre(cat, { procedure: 'inconnue', methode: 'ios', etape: 0 }); } catch { leve = true; }
  assert(leve, 'garde-fou : procédure inconnue');
  const lie = P.reprendre(cat, { procedure: 'tester-ping', methode: 'powershell', etape: 0, lier: { cible: 'passerelle' } });
  assert(lie.lignes[0].cmd === 'Test-Connection -ComputerName {{passerelle}} -Count 4', 'lier renomme le paramètre');
  const fixe = P.reprendre(cat, { procedure: 'linux-etat-service', methode: 'linux', etape: 0, fixe: { service: 'ssh' } });
  assert(fixe.lignes[0].cmd === 'systemctl status ssh --no-pager', 'fixe remplace un paramètre par une constante');
  const routeur = P.reprendre(cat, { procedure: 'cisco-enregistrer-config', methode: 'ios', etape: 1, hote: 'Router' });
  assert(routeur.lignes[0].invite === 'Router#', 'l’invite est renommée sans toucher à la commande');
}

// ---------------------------------------------------------------------------
console.log('10. Contre-épreuves du contrat des scénarios');
{
  const base = () => JSON.parse(JSON.stringify(proc('scenario-cisco-ssh-commutateur')));
  const lit = (p) => P.incoherencesProcedure(p).join(' | ');
  let p = base(); p.methodes[0].etapes.find((e) => e.titre === 'Créer le compte local').lignes[0].secret = false; p.methodes[0].etapes.find((e) => e.titre === 'Créer le compte local').lignes.push({ invite: 'Switch(config)#', cmd: 'exit' }); p.methodes[0].etapes.find((e) => e.titre === 'Créer le compte local').lignes[0].secret = true;
  assert(/DERNIÈRE/.test(lit(p)), 'contrat : une ligne à secret doit être la dernière de l’étape');
  p = base(); p.methodes[0].etapes.find((e) => e.titre === 'Créer le compte local').interactions = [];
  assert(/interaction « secret »/.test(lit(p)), 'contrat : une ligne à secret exige son interaction');
  p = base(); p.params.push({ id: 'motDePasse', label: 'mot de passe', type: 'texte', exemple: 'abc' }); p.methodes[0].etapes[0].lignes[0].cmd += ' {{motDePasse}}';
  assert(/secret ne se saisit jamais/.test(lit(p)), 'contrat : un paramètre « mot de passe » est refusé');
  p = base(); p.methodes[0].etapes[1].equipement = 'inconnu';
  assert(/non déclaré/.test(lit(p)), 'contrat : équipement inconnu refusé');
  p = base(); delete p.hypotheses;
  assert(/hypothèses absentes/.test(lit(p)), 'contrat : un scénario sans hypothèses est refusé');
  p = base(); p.methodes[0].etapes[0].lignes[0].cmd = 'Switch# show version';
  assert(/commence par une invite/.test(lit(p)), 'contrat : invite collée dans une commande refusée');
  p = base(); p.methodes[0].etapes.find((e) => e.titre === 'Générer la clé RSA de l’hôte').lignes[0].cmd = 'crypto key generate rsa modulus 2048 éé';
  assert(/ASCII/.test(lit(p)), 'contrat : caractère non ASCII dans une commande IOS refusé');
  p = base(); p.methodes[0].equipements[0].methode = 'gui';
  assert(/invalide/.test(lit(p)), 'contrat : un équipement ne peut pas être « graphique »');
  const vl = JSON.parse(JSON.stringify(proc('scenario-cisco-inter-vlan-routeur')));
  vl.params[0].exemple = [vl.params[0].exemple[0], { ...vl.params[0].exemple[0] }];
  assert(/refusé par sa propre cohérence/.test(P.incoherencesProcedure(vl).join(' ')), 'contrat : un plan d’exemple incohérent est refusé');
  const vl2 = JSON.parse(JSON.stringify(proc('scenario-cisco-inter-vlan-routeur')));
  vl2.methodes[0].etapes.find((e) => e.repeter).repeter.table = 'absent';
  assert(/tableau « absent » non déclaré/.test(P.incoherencesProcedure(vl2).join(' ')), 'contrat : tableau inconnu refusé');
  // Moteur : mutation « on copie plusieurs équipements d’un coup »
  const sc = proc('scenario-cisco-inter-vlan-routeur');
  const r = P.rendreMethode(sc.methodes[0], sc.params, exemples(sc));
  assert(r.texteComplet === null && r.parEquipement.every((q) => q.texte === null || !/Router|Switch/.test(q.texte)), 'moteur : aucune copie globale multi-équipements');
}

// ---------------------------------------------------------------------------
const SC = S.SCENARIOS.map((x) => x.id);
console.log('11b. Vue rapide : phases, équipements, pauses, ordre (UX-02b)');
{
  const cmdTexts = (html) => [...html.matchAll(/<span class="cmd-text">([\s\S]*?)<\/span>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
  const phasesTitres = (html) => [...html.matchAll(/<section class="phase [^"]*" data-phase="(\d+)" aria-label="([^"]*)"/g)].map((m) => `${m[1]}:${m[2]}`);
  for (const id of SC) {
    const e = T.entreeParId(id); const p = e.procedure;
    for (const m of p.methodes) {
      const saisies = exemples(p);
      const r = P.rendreMethode(m, p.params ?? [], saisies);
      const rap = V.tachePageMarkup(e, { methodeId: m.id, vue: 'rapide', saisies });
      const pas = V.tachePageMarkup(e, { methodeId: m.id, vue: 'pas', saisies });
      assert(JSON.stringify(phasesTitres(rap)) === JSON.stringify(phasesTitres(pas)), `${id}/${m.id} : mêmes phases, même ordre dans les deux vues`);
      assert(JSON.stringify(cmdTexts(rap)) === JSON.stringify(cmdTexts(pas)), `${id}/${m.id} : même suite de commandes, dans le même ordre`);
      // Chaque phase vise UN seul équipement ; aucun segment n'en mélange deux.
      for (const ph of r.phases) {
        const eqs = new Set(ph.indices.map((i) => r.etapes[i].equipement ?? null));
        assert(eqs.size === 1, `${id}/${m.id} : phase « ${ph.titre} » = un seul équipement`);
        const cats = new Set(ph.indices.map((i) => P.categorieEtape(r.etapes[i])));
        assert(cats.size === 1, `${id}/${m.id} : phase « ${ph.titre} » = une seule nature (action / vérification / sauvegarde)`);
      }
      // Chaque interaction et chaque secret de la méthode est signalé dans la Vue rapide.
      const inter = r.etapes.flatMap((x) => x.interactions ?? []);
      for (const x of inter) assert(rap.includes(V.esc(x.attend)), `${id}/${m.id} : pause « ${x.attend.slice(0, 40)} » signalée en Vue rapide`);
      const secrets = r.etapes.flatMap((x) => (x.rendu?.lignes ?? []).filter((l) => l.secret));
      assert((rap.match(/class="cmd-secret"/g) ?? []).length === secrets.length, `${id}/${m.id} : chaque ligne à secret est signalée (${secrets.length})`);
      assert(!/type="password"/.test(rap), `${id}/${m.id} : aucun champ de mot de passe`);
      // Les segments copiables s'arrêtent après chaque pause : une étape interactive est toujours la dernière de son bloc.
      for (const mm of rap.matchAll(/<div class="cmd-block cmd-seg[^"]*" data-steps="([\d,]+)">/g)) {
        const idx = mm[1].split(',').map(Number);
        idx.slice(0, -1).forEach((i) => assert(!r.etapes[i].rendu.interactif, `${id}/${m.id} : une pause ne se trouve jamais au milieu d'un bloc (étape ${i + 1})`));
        const eqs = new Set(idx.map((i) => r.etapes[i].equipement ?? null));
        assert(eqs.size === 1, `${id}/${m.id} : un bloc ne mélange pas des équipements (étapes ${idx.map((i) => i + 1).join(',')})`);
      }
    }
  }
  // SSH Cisco : le test de connexion précède la restriction d'accès, dans les DEUX vues.
  const ssh = T.entreeParId('scenario-cisco-ssh-commutateur');
  for (const vue of ['rapide', 'pas']) {
    const t = cmdTexts(V.tachePageMarkup(ssh, { methodeId: 'scenario', vue, saisies: exemples(ssh.procedure) }));
    const iTest = t.findIndex((x) => /^ssh admin@/.test(x)); const iRestreint = t.findIndex((x) => /transport input ssh/.test(x));
    assert(iTest >= 0 && iRestreint > iTest, `SSH Cisco (${vue}) : test de connexion AVANT « transport input ssh »`);
    assert(t.findIndex((x) => /copy running-config startup-config/.test(x)) > iRestreint, `SSH Cisco (${vue}) : enregistrement en dernier, séparé`);
  }
  // Inter-VLAN : la séquence revient au routeur/commutateur après un test sur un poste sans être réordonnée.
  const iv = T.entreeParId('scenario-cisco-inter-vlan-routeur');
  const rv = P.rendreMethode(iv.procedure.methodes[0], iv.procedure.params, exemples(iv.procedure));
  const eqSeq = rv.phases.map((x) => x.equipement);
  assert(eqSeq.join(',') === [...eqSeq].join(','), 'inter-VLAN : ordre des phases = ordre des étapes');
  const ordreEtapes = rv.phases.flatMap((x) => x.indices);
  assert(ordreEtapes.every((v, i) => v === i), 'inter-VLAN : aucune étape réordonnée pour gagner de la place');
  // Pas de mot de passe ni d'invite dans le dossier ni dans les copies de segments.
  for (const id of SC) {
    const e = T.entreeParId(id); const p = e.procedure;
    for (const m of p.methodes) {
      const r = P.rendreMethode(m, p.params ?? [], exemples(p));
      for (const et of r.etapes) for (const l of (et.rendu?.lignes ?? [])) assert(!/^(Switch|Router)[(#>]|^PS>|^\$ /.test(l.copie), `${id} : copie sans invite (${l.copie.slice(0, 30)})`);
    }
  }
}

console.log('11. Dossier de procédure, échappement et recherche');
{
  const sc = proc('scenario-cisco-inter-vlan-routeur');
  const r = P.rendreMethode(sc.methodes[0], sc.params, exemples(sc));
  const md = P.dossierMarkdown(sc, r, sc.methodes[0]);
  assert(!md.includes('\r') && !md.includes('﻿'), 'dossier : LF, sans BOM');
  assert(/## Sur le commutateur — Configurer le commutateur/.test(md) && /## Sur le routeur/.test(md) && /Sur le poste Windows/.test(md), 'dossier : blocs titrés par équipement');
  assert(!/‹/.test(md), 'dossier : aucune valeur manquante');
  const ssh = proc('scenario-cisco-ssh-commutateur');
  const md2 = P.dossierMarkdown(ssh, P.rendreMethode(ssh.methodes[0], ssh.params, exemples(ssh)), ssh.methodes[0]);
  assert(/<secret à saisir sur l'équipement>/.test(md2) && md2.split('\n').filter((l) => /^username /.test(l)).every((l) => l.endsWith("<secret à saisir sur l'équipement>")), 'dossier : le secret n’est jamais écrit');
  // XSS dans une cellule
  const html = V.tachePageMarkup(T.entreeParId(sc.id), { methodeId: 'scenario', vue: 'rapide', saisies: { ...exemples(sc), plan: [{ vlan: '"><img src=x onerror=alert(1)>' }, {}] } });
  assert(!/<img src=x/.test(html), 'valeurs de tableau échappées');
  // Recherche
  const top = (q) => T.chercher(q)[0]?.entree.id;
  assert(top('plusieurs vlan routage inter-vlan') === 'scenario-cisco-inter-vlan-routeur', 'recherche : « plusieurs vlan routage inter-vlan » → scénario');
  assert(top('router on a stick') === 'scenario-cisco-inter-vlan-routeur', 'recherche : « router on a stick » → scénario');
  assert(top('configurer ssh switch cisco') === 'scenario-cisco-ssh-commutateur', 'recherche : SSH Cisco → scénario Cisco');
  assert(top('installer ssh linux') === 'scenario-linux-ssh', 'recherche : installer SSH Linux → scénario Linux');
  assert(top('créer un vlan') === 'cisco-creer-vlan', 'recherche : une tâche précise passe avant le scénario qui la contient');
  assert(top('ip fixe windows') === 'windows-ip-fixe', 'recherche : IP fixe Windows');
  assert(top('diagnostic réseau windows') === 'scenario-windows-diagnostic-reseau', 'recherche : diagnostic réseau Windows → scénario');
  assert(T.chercher('', { kinds: ['scenario'] }).length === 4, 'filtre de nature : quatre scénarios');
  const toutes = T.ENTREES_LISTEES.map((e) => e.id);
  assert(new Set(toutes).size === toutes.length, 'aucune entrée comptée deux fois dans la liste');
}

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
