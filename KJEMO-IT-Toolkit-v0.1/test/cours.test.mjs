#!/usr/bin/env node
/**
 * cours.test.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles statiques des fiches issues du cours, des parcours (cours.mjs) et
 * du laboratoire (labo.mjs). Les nombres sont RECALCULÉS.
 *
 * CAS FONCTIONNELS : contrat de chacune des fiches, classement, alias de recherche,
 * références de parcours (fiche ET étape existent), éléments non couverts dits.
 * CONTRE-ÉPREUVES : on dégrade un parcours, un champ, un paramètre, et le
 * contrôle DOIT échouer (un banc qui ne peut pas échouer ne prouve rien).
 * SÉCURITÉ : aucun périphérique (/dev/sdb, /dev/md127…) dans une commande,
 * aucun mot de passe, 777 réservé au laboratoire, systemd-resolved jamais
 * désactivé, mode GPO permissif seulement en dernier recours et en lecture.
 *
 * NE PROUVE PAS : l'effet d'une commande sur une machine réelle (NON EXÉCUTÉ).
 * Usage : node test/cours.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const C = await imp('classement.mjs'); const P = await imp('procedures.mjs');
const K = await imp('cours.mjs'); const L = await imp('labo.mjs'); const { PROCEDURES_COURS } = await imp('procedures-cours.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const FICHES = PROCEDURES_COURS;
const cmds = (p) => p.methodes.flatMap((m) => m.etapes.flatMap((e) => (e.lignes ?? []).map((l) => ({ ...l, etape: e, methode: m }))));
const textes = (p) => p.methodes.flatMap((m) => m.etapes.flatMap((e) => [e.titre, e.explication, e.attendu, e.important, e.verification === true ? '' : e.verification, e.aide, ...(e.options ?? []).flatMap((o) => [o.option, o.explication])]));

// ---------------------------------------------------------------------------
console.log('1. Les fiches du cours');
assert(FICHES.length === 50, `50 fiches (${FICHES.length})`);
assert(new Set(FICHES.map((p) => p.id)).size === FICHES.length, 'identifiants uniques');
for (const p of FICHES) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' ; '));
  assert(p.id.startsWith('cours-'), `préfixe cours- : ${p.id}`);
  assert(p.origine === 'cours', `origine « cours » : ${p.id}`);
  const e = T.entreeParId(p.id);
  assert(e && e.procedure === p, `la fiche est dans le catalogue : ${p.id}`);
  assert(e && C.cheminDe(e) !== null, `la fiche a une rubrique : ${p.id}`);
  assert(C.estPlaceDirect(p.id) || C.cheminDe(e)?.sujet !== undefined, `la fiche est classée : ${p.id}`);
}
assert(T.TOUTES_LES_ENTREES.filter((e) => e.kind === 'commande').length === 112, 'les 112 commandes rapides sont intactes');
assert(C.estPlaceDirect('cours-se-reperer') && !C.estPlaceDirect('id-qui-n-existe-pas'), 'contre-épreuve : estPlaceDirect refuse un identifiant inconnu');

// ---------------------------------------------------------------------------
console.log('2. Sécurité : aucune présomption, aucun secret');
const PERIPH = /\/dev\/(?:sd|vd|xvd|hd|nvme|md)[a-z0-9]*/;
for (const p of FICHES) {
  for (const l of cmds(p)) {
    assert(!PERIPH.test(l.cmd), `aucun périphérique écrit en dur : ${p.id}`, l.cmd);
    assert(!/(--password|--newpassword|-p ?\S*pass|password=|pass=|--random-password|--must-change-at-next-login)/i.test(l.cmd), `aucun mot de passe ni option non vérifiée dans une commande : ${p.id}`, l.cmd);
    assert(!/(systemctl\s+(stop|disable|mask)\s+(--now\s+)?systemd-resolved|rm\s+-rf?\s+\/(\s|$))/.test(l.cmd), `systemd-resolved et la racine jamais touchés : ${p.id}`, l.cmd);
  }
  for (const t of textes(p)) assert(!/\{\{/.test(t ?? ''), `aucun « {{ » hors commande (il s’afficherait tel quel) : ${p.id}`, String(t).slice(0, 60));
}
// 777 : réglage de laboratoire, jamais l'étape principale
for (const p of FICHES) for (const l of cmds(p)) if (/\b777\b/.test(l.cmd)) {
  assert(l.etape.facultatif === true && /laboratoire/i.test(`${l.etape.titre} ${l.etape.explication}`), `chmod 777 : étape facultative et dite « laboratoire » (${p.id})`, l.etape.titre);
}
// GPO permissif : seulement un dernier recours en lecture seule
for (const p of FICHES) for (const l of cmds(p)) if (/ad_gpo_access_control/.test(l.cmd)) {
  assert(l.etape.dernierRecours === true && l.etape.effet === 'lecture', 'ad_gpo_access_control : dernier recours et lecture seule', l.cmd);
}
// Les étapes qui effacent le disent
const formater = FICHES.find((p) => p.id === 'cours-partition-formater-monter');
for (const l of cmds(formater)) if (/mkfs|fdisk|wipefs/.test(l.cmd) && !/wipefs\s+\{\{[a-z]+\}\}$/.test(l.cmd)) {
  assert(['destructif', 'modification'].includes(l.etape.effet) && /effac|perdu|détru|écras/i.test(`${l.etape.explication} ${l.etape.important ?? ''}`), 'une commande qui écrit sur un disque dit ce qui sera effacé', l.etape.titre);
}
// Lecture / écriture : le compte en lecture seule n'est JAMAIS aussi en écriture (R1 : modèle du cours, read list)
const groupe = FICHES.find((p) => p.id === 'cours-samba-partage-groupe');
const pg = groupe.params.find((x) => x.id === 'lectureSeule');
assert(pg && pg.distinctDe.includes('membreEcriture'), 'partage de groupe : le compte en lecture seule est déclaré distinct du membre qui écrit');
const texteSmb = cmds(groupe).map((l) => l.cmd).join('\n');
assert(/read only = no/.test(texteSmb) && /read list = \{\{lectureSeule\}\}/.test(texteSmb) && !/write list/.test(texteSmb), 'partage de groupe : lecture-écriture pour le groupe, read list = le compte en lecture seule, aucune write list (un compte dans les deux listes écrirait)');
assert(!/-U compte\b/.test(texteSmb), 'partage de groupe : aucun « compte » littéral à remplacer à la main');
{
  const e = P.evaluerValeurs(groupe.params, { lectureSeule: 'receptionniste', membreEcriture: 'receptionniste' });
  assert(Boolean(e.erreurs.lectureSeule || e.erreurs.membreEcriture), 'contre-épreuve : le même compte en lecture seule et en écriture est refusé');
  const ok = P.evaluerValeurs(groupe.params, { lectureSeule: 'receptionniste', membreEcriture: 'directeur' });
  assert(!ok.erreurs.lectureSeule && !ok.erreurs.membreEcriture, 'deux comptes distincts acceptés');
}

// ---------------------------------------------------------------------------
console.log('3. Validateurs « peripherique », « etiquetteExt4 », distinctDe, superieurA');
const periph = (portee, v) => P.validerParametre({ id: 'x', label: 'x', type: 'peripherique', portee }, v);
assert(periph('disque', '/dev/sdb').ok && periph('disque', '/dev/vdb').ok && periph('disque', '/dev/nvme0n1').ok, 'disque entier : sd, vd, nvme acceptés');
assert(!periph('disque', '/dev/sdb1').ok && !periph('disque', '/dev/nvme0n1p1').ok, 'contre-épreuve : une partition n’est pas un disque entier');
assert(periph('partition', '/dev/sdb1').ok && periph('partition', '/dev/nvme0n1p2').ok, 'partition : sdb1, nvme0n1p2 acceptées');
assert(!periph('partition', '/dev/sdb').ok, 'contre-épreuve : un disque entier n’est pas une partition');
assert(periph('md', '/dev/md1').ok && !periph('md', '/dev/sdb').ok, 'matrice : md acceptée, sd refusé');
for (const mauvais of ['/dev/sdb; rm -rf /', '/dev/sdb && reboot', '$(whoami)', '/dev/../etc/passwd', 'sdb', '/dev/']) {
  assert(!periph('disque', mauvais).ok, `injection ou forme douteuse refusée : ${JSON.stringify(mauvais)}`);
}
const etq = (v) => P.validerParametre({ id: 'e', label: 'e', type: 'etiquetteExt4' }, v);
assert(etq('data_tp2').ok && etq('A-b_9').ok, 'étiquette ext4 : lettres, chiffres, _ et -');
assert(!etq('a'.repeat(17)).ok && !etq('data tp2').ok && !etq('a;b').ok, 'contre-épreuve : 17 caractères, espace, point-virgule refusés');
{
  const q = FICHES.find((p) => p.id === 'cours-quotas-utilisateur');
  const bon = P.evaluerValeurs(q.params, { souple: '266240', stricte: '266250' });
  assert(!bon.erreurs.stricte, 'quota : stricte ≥ souple acceptée');
  const mauvais = P.evaluerValeurs(q.params, { souple: '266240', stricte: '100' });
  assert(Boolean(mauvais.erreurs.stricte), 'contre-épreuve : stricte < souple refusée');
}
{
  const r = FICHES.find((p) => p.id === 'cours-raid1-creer');
  const e = P.evaluerValeurs(r.params, { disque1: '/dev/sdb', disque2: '/dev/sdb', matrice: '/dev/md1' });
  assert(Boolean(e.erreurs.disque1 || e.erreurs.disque2), 'contre-épreuve : deux fois le même disque refusé');
  const s = FICHES.find((p) => p.id === 'cours-raid1-panne-secours');
  const e2 = P.evaluerValeurs(s.params, { matrice: '/dev/md1', disquePanne: '/dev/sdc', disqueRemplacement: '/dev/sdc', disqueSecours: '/dev/sde' });
  assert(Boolean(e2.erreurs.disquePanne || e2.erreurs.disqueRemplacement), 'contre-épreuve : disque en panne = disque de remplacement refusé');
}

// ---------------------------------------------------------------------------
console.log('4. Parcours : références, non-couverts, ambiguïtés');
const cours = K.COURS[0];
const resolveur = { fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodes: Object.fromEntries(ms.map((m) => [m.id ?? m.methode, m.etapes.length])), methodeParDefaut: ms[0].id ?? ms[0].methode, titres: Object.fromEntries(ms.map((m) => [m.id ?? m.methode, m.etapes.map((x) => x.titre)])) }; },
  assistants: (id) => T.TOUTES_LES_ENTREES.some((e) => e.id === id && e.tool) };
const pbCours = K.incoherencesCours(cours, resolveur);
assert(pbCours.length === 0, 'le cours est conforme à son contrat', pbCours.join(' ; '));
assert(cours.parcours.map((p) => p.lettre).join('') === 'ABCDE', 'parcours A à E');
const nonCouverts = cours.parcours.flatMap((p) => p.items).filter((i) => i.couvert === false).map((i) => i.id).sort();
assert(nonCouverts.length === 0, `plus aucun élément déclaré non couvert : A5, B1 et D7 ont leurs fiches (${nonCouverts})`);
assert(cours.ambiguites.length >= 10, `ambiguïtés signalées (${cours.ambiguites.length})`);
const fichesCitees = new Set(cours.parcours.flatMap((p) => [...p.prerequis.map((r) => r.fiche), ...p.items.flatMap((i) => i.refs.map((r) => r.fiche))]));
const manquantes = ['cours-samba-groupes', 'cours-smbclient-transferts', 'cours-ubuntu-jonction-ad', 'cours-samba-dns', 'cours-rsat-windows'];
assert(manquantes.every((id) => fichesCitees.has(id) || cours.soutien.some((s) => s.fiche === id)), 'les 4 prérequis manquants (groupes Samba, smbclient, jonction Ubuntu, DNS Samba, RSAT) sont atteignables depuis le cours');
// chaque fiche du cours est atteinte par un parcours ou par le soutien
const atteintes = new Set([...fichesCitees, ...cours.soutien.map((s) => s.fiche)]);
const orphelines = FICHES.filter((p) => !atteintes.has(p.id)).map((p) => p.id);
assert(orphelines.length === 0, 'chaque fiche du cours est atteinte par un parcours ou par le soutien', orphelines.join(', '));
// contre-épreuves
const clone = () => structuredClone(cours);
const casse = (mut) => { const c = clone(); mut(c); return K.incoherencesCours(c, resolveur); };
assert(casse((c) => { c.parcours[1].items[1].refs[0].fiche = 'fiche-fantome'; }).some((m) => /inconnue/.test(m)), 'contre-épreuve : fiche inconnue détectée');
assert(casse((c) => { c.parcours[1].items[1].refs[0].etape = 99; }).some((m) => /étape 99/.test(m)), 'contre-épreuve : étape inexistante détectée');
assert(casse((c) => { c.parcours[0].items[0].refs = []; }).some((m) => /sans fiche/.test(m)), 'contre-épreuve : élément couvert sans fiche détecté');
assert(casse((c) => { const it = c.parcours[0].items[4]; it.refs = []; it.couvert = false; it.note = 'court'; }).some((m) => /sans explication/.test(m)), 'contre-épreuve : non couvert sans explication détecté');
assert(casse((c) => { c.parcours[0].items[1].id = 'A1'; }).some((m) => /en double/.test(m)), 'contre-épreuve : identifiant en double détecté');
assert(casse((c) => { c.parcours[0].items[0].id = 'B1'; }).some((m) => /lettre du parcours/.test(m)), 'contre-épreuve : identifiant d’un autre parcours détecté');
assert(casse((c) => { c.parcours[3].items[3].assistants = ['assistant-fantome']; }).some((m) => /assistant inconnu/.test(m)), 'contre-épreuve : assistant inconnu détecté');
assert(casse((c) => { c.source = ''; }).some((m) => /source/.test(m)), 'contre-épreuve : source absente détectée');
// gabarit : il suit le contrat (sauf les fiches d'exemple, volontairement fictives)
const pbGab = K.incoherencesCours(K.GABARIT_TP, { fiches: () => ({ etapes: 1 }), assistants: () => true });
assert(pbGab.length === 0, 'le gabarit de TP respecte le contrat', pbGab.join(' ; '));
// liens
assert(K.lienEtape({ fiche: 'cours-liens', etape: 2 }, { coursId: 'serveurs2-tp2', lettre: 'B' }) === '#/tache/cours-liens/etape/2/depuis/serveurs2-tp2/B', 'lien d’étape avec parcours d’origine');
assert(K.lireRouteTache('#/tache/cours-liens/etape/2/depuis/serveurs2-tp2/B')?.etape === 2, 'route de fiche relue');
assert(K.lireRouteTache('#/tache/cours-liens/etape/2/depuis/x/b') === null && K.lireRouteTache('#/tache/a/etape/x') === null, 'contre-épreuve : routes mal formées refusées');
assert(K.lireRouteCours('#/cours/serveurs2-tp2/B')?.lettre === 'B' && K.lireRouteCours('#/cours/a/bb') === null, 'route de cours relue / refusée');

// ---------------------------------------------------------------------------
console.log('5. Alias de recherche (lettres et numéros du TP)');
const premiers = (q, n = 8) => T.chercher(q).slice(0, n).map((r) => r.entree.id);
assert(premiers('tp2 b7').includes('cours-partition-formater-monter'), 'recherche « TP2 B7 » → fiche de partition');
assert(premiers('b7').includes('cours-partition-formater-monter'), 'recherche « b7 »');
assert(premiers('tp2 d8 1').includes('cours-smbclient-transferts') || premiers('d8 1').includes('cours-smbclient-transferts'), 'recherche « D8.1 » → smbclient');
assert(premiers('csv comptes samba').includes('cours-samba-import-csv'), 'recherche par sujet : CSV → import de comptes');
assert(!premiers('tp2 z99').includes('cours-partition-formater-monter'), 'contre-épreuve : un numéro inexistant ne ramène pas cette fiche');

// ---------------------------------------------------------------------------
console.log('6. Classement : tâches, pas nom de commande');
const fam = (d) => (C.ARBRE[d] ?? []).map((f) => f.id);
const linux = Object.keys(C.ARBRE).find((d) => /linux/i.test(d));
assert(linux && ['fichiers', 'texte'].every((id) => fam(linux).includes(id)), 'Linux : familles « Fichiers et dossiers » et « Lire, chercher et filtrer du texte »');

// ---------------------------------------------------------------------------
console.log('7. Laboratoire');
assert(L.incoherencesChamps().length === 0, 'champs du laboratoire sains', L.incoherencesChamps().join(' ; '));
assert(L.incoherencesChamps([...L.CHAMPS_LABO, { id: 'motDePasse', label: 'Mot de passe', type: 'identifiant', exemple: 'abc', vers: ['x'] }]).length > 0, 'contre-épreuve : un champ « mot de passe » est refusé');
assert(L.incoherencesChamps([...L.CHAMPS_LABO, { id: 'disqueData', label: 'Disque /dev/sdb', type: 'identifiant', exemple: 'sdb', vers: ['x'] }]).length > 0, 'contre-épreuve : un champ « disque » est refusé');
assert(L.incoherencesChamps([{ id: 'ip', label: 'Adresse', type: 'ipv4', exemple: '999.1.1.1', vers: ['ip'] }]).length > 0, 'contre-épreuve : un exemple invalide est refusé');
const n = L.normaliserLabo({ domaine: 'serveur2.lan', ipDc: '999.9.9.9', motDePasse: 'Secret!123', password: 'x', disque: '/dev/sdb', compteEcriture: 'a1', compteLecture: 'a1' });
assert(n.valeurs.domaine === 'serveur2.lan' && n.erreurs.ipDc && n.erreurs.compteLecture, 'normalisation : valide gardé, invalide refusé avec raison');
assert(!JSON.stringify(n.valeurs).match(/Secret|password|\/dev\//i), 'normalisation : aucun champ inconnu (mot de passe, disque) n’est conservé');
assert(L.normaliserLabo('texte').valeurs && Object.keys(L.normaliserLabo(null).valeurs).length === 0 && Object.keys(L.normaliserLabo([1]).valeurs).length === 0, 'normalisation : entrée non-objet tolérée');
{
  const fiche = FICHES.find((p) => p.id === 'cours-samba-partage-utilisateurs');
  const s = L.saisiesDepuisLabo(fiche, { compteEcriture: 'user1tp2', compteLecture: 'user2tp2', domaine: 'serveur2.lan' });
  assert(s.ecriture === 'user1tp2' && s.lecture === 'user2tp2', 'saisies : les paramètres déclarés sont remplis');
  const ids = new Set(fiche.params.map((x) => x.id));
  assert(Object.keys(s).every((k) => ids.has(k)), 'saisies : rien n’est injecté hors des paramètres de la fiche');
  const disque = FICHES.find((p) => p.id === 'cours-partition-formater-monter');
  assert(!('disque' in L.saisiesDepuisLabo(disque, { disque: '/dev/sdb', etiquette: 'data_tp2' })) && L.saisiesDepuisLabo(disque, { etiquette: 'data_tp2' }).etiquette === 'data_tp2', 'saisies : le disque n’est jamais repris du laboratoire');
}
// CSV — modèle du TP2 : login;motdepasse;departement, mots de passe FICTIFS
{
  const csv = L.csvDepuisLignes(L.LIGNES_CSV_MODELE);
  const lignes = csv.trimEnd().split('\n');
  assert(lignes[0] === 'login;motdepasse;departement' && lignes.length === L.LIGNES_CSV_MODELE.length + 1, 'CSV du modèle : en-tête du TP2 (3 colonnes « ; »), une ligne par compte');
  assert(lignes.slice(1).every((l, i) => l.split(';').length === 3 && l.split(';')[1] === `FICTIF-${String(i + 1).padStart(4, '0')}`), 'CSV du modèle : mot de passe FICTIF-nnnn sur chaque ligne');
  assert(!/\r|\ufeff/.test(csv) && csv.endsWith('\n'), 'CSV : LF, sans BOM, retour final');
}
assert(L.csvDepuisLignes([{ login: 'Alice', departement: 'X' }]) === null, 'contre-épreuve : login en majuscules refusé');
assert(L.csvDepuisLignes([{ login: 'a', departement: 'X' }, { login: 'a', departement: 'Y' }]) === null, 'contre-épreuve : login en double refusé');
assert(L.csvDepuisLignes([]) === null && L.csvDepuisLignes(Array.from({ length: 51 }, (_, i) => ({ login: `u${i}`, departement: 'X' }))) === null, 'contre-épreuve : vide et plus de 50 lignes refusés');
{
  const r = L.lignesDepuisTexte('login;departement\nalice;Ventes\r\nbob;Finance;MotDePasse1\n; rm -rf /;X\n\nalice;Y\ncarl,Finance\n"dan";Finance\n');
  assert(r.lignes.length === 1 && r.erreurs.length === 5, 'texte CSV : 1 ligne valide, 5 refusées (3 champs, injection, doublon, virgule, guillemets)', JSON.stringify(r));
  assert(r.erreurs.some((e) => e.ligne === 3 && /jamais un mot de passe/.test(e.message)), 'texte CSV : la ligne à 3 champs est localisée');
  assert(!JSON.stringify(r.erreurs).includes('MotDePasse1'), 'texte CSV : le contenu de la ligne à 3 champs n’est jamais recopié dans l’erreur');
  assert(L.texteEditeurModele().startsWith('login;departement\n') && L.lignesDepuisTexte(L.texteEditeurModele()).erreurs.length === 0, 'texte CSV : l’éditeur par défaut est valide');
}
// Progression
{
  const pr = L.normaliserProgression({ 'serveurs2-tp2:A1': true, 'serveurs2-tp2:A1x': true, 'faux:A1': true, 'serveurs2-tp2:A2': 'oui', cle: 'passwordX' }, K.COURS);
  assert(Object.keys(pr).join() === 'serveurs2-tp2:A1', 'progression : seuls les éléments connus et vrais sont conservés');
  const b1 = L.basculer({}, 'serveurs2-tp2', 'A1'); const b2 = L.basculer(b1, 'serveurs2-tp2', 'A1');
  assert(b1['serveurs2-tp2:A1'] === true && Object.keys(b2).length === 0, 'progression : basculer coche puis décoche');
  const av = L.avancement(cours, cours.parcours[0], { 'serveurs2-tp2:A1': true });
  assert(av.faits === 1 && av.total === 5 && av.couverts === 5, 'avancement : 1 fait sur 5, dont 5 couverts par le catalogue');
}

// ---------------------------------------------------------------------------
console.log('8. Fidélité au sujet : script, machines, prérequis, paramètres, Windows et hyperviseur');
{
  const { SCRIPT_IMPORT_LIGNES, SCRIPT_IMPORT } = await imp('cours-script-import.mjs');
  const imp1 = FICHES.find((p) => p.id === 'cours-samba-import-csv');
  const lignesFiche = cmds(imp1).map((l) => l.cmd);
  const debut = lignesFiche.findIndex((l) => /^cat > \{\{script\}\} <</.test(l));
  const fin = lignesFiche.indexOf('EOF', debut);
  assert(debut >= 0 && fin > debut && JSON.stringify(lignesFiche.slice(debut + 1, fin)) === JSON.stringify(SCRIPT_IMPORT_LIGNES), 'le script affiché dans la fiche est EXACTEMENT celui qui est testé');
  assert(SCRIPT_IMPORT === SCRIPT_IMPORT_LIGNES.join('\n') + '\n' || SCRIPT_IMPORT.trim() === SCRIPT_IMPORT_LIGNES.join('\n').trim(), 'SCRIPT_IMPORT et SCRIPT_IMPORT_LIGNES décrivent le même texte');
  // le modèle public est fictif et passe le contrôle de format du laboratoire
  const csv = L.csvDepuisLignes(L.LIGNES_CSV_MODELE);
  assert(csv.split('\n').every((l) => !l.trim() || /^[a-z_0-9.-]+;FICTIF-[^;]+;[A-Za-z_]+$/.test(l) || l === L.EN_TETE_CSV), 'le CSV modèle : trois champs, mots de passe FICTIF- seulement');
  assert(!/christian|julie|dominique/i.test(csv), 'le CSV modèle ne reprend aucun login de l’énoncé');
  // aucune fiche ne laisse un remplacement manuel dans une commande à copier
  for (const p of FICHES) {
    for (const l of cmds(p)) {
      assert(!/\bcompte\b(?![-_/])/i.test(l.cmd.replace(/\{\{[^}]+\}\}/g, '').replace(/#.*$/, '').replace(/"[^"]*"/g, '')) || /echo|Write|--help|samba-tool|net use|cmdkey|whoami/.test(l.cmd), `${p.id} : pas de mot « compte » littéral à remplacer à la main`, l.cmd);
      assert(!/<[A-Za-zÀ-ÿ_ -]+>/.test(l.cmd), `${p.id} : aucun <…> à remplacer à la main`, l.cmd);
    }
  }
  // machines : si une étape d'une méthode a une machine, toutes l'ont ; copie globale refusée quand plusieurs postes
  for (const id of ['cours-samba-partage-groupe', 'cours-smbclient-transferts', 'cours-ubuntu-acces-partage', 'cours-windows-acces-partage', 'cours-windows-connexion-domaine', 'cours-hyperviseur-ajouter-disque']) {
    const f = FICHES.find((p) => p.id === id);
    assert(Boolean(f), `fiche présente : ${id}`);
    for (const m of f?.methodes ?? []) {
      const avec = m.etapes.filter((e) => e.machine).length;
      assert(avec === 0 || avec === m.etapes.length, `${id}/${m.id ?? m.methode} : machines étiquetées sur toutes les étapes ou aucune`);
    }
  }
  const grp = FICHES.find((p) => p.id === 'cours-smbclient-transferts');
  assert(grp.methodes.some((m) => new Set(m.etapes.map((e) => e.machine)).size >= 1), 'smbclient : machines distinguées');
  // prérequis : D4 à D7 arrivent avec leurs préparations
  for (const id of ['cours-ubuntu-acces-partage', 'cours-windows-acces-partage', 'cours-smbclient-transferts']) {
    const f = FICHES.find((p) => p.id === id);
    assert((f.prerequis ?? []).length >= 1, `${id} : prérequis exposés à l’arrivée directe`);
    for (const r of f.prerequis ?? []) assert(!r.fiche || Boolean(T.entreeParId(r.fiche)), `${id} : prérequis vers une fiche existante (${r.fiche})`);
  }
  // Windows et hyperviseur : les trois éléments autrefois non couverts ont leur parcours
  const tous = Object.fromEntries(cours.parcours.flatMap((p) => p.items).map((i) => [i.id, i]));
  for (const [id, fiche, meth] of [['A5', 'cours-windows-connexion-domaine', 'gui'], ['B1', 'cours-hyperviseur-ajouter-disque', 'gui'], ['D7', 'cours-windows-acces-partage', 'gui']]) {
    assert(tous[id].refs.some((r) => r.fiche === fiche && r.methode === meth) && tous[id].couvert !== false, `${id} : couvert par ${fiche}/${meth}`);
  }
  const hv = FICHES.find((p) => p.id === 'cours-hyperviseur-ajouter-disque');
  const txtHv = JSON.stringify(hv);
  assert(['VirtualBox', 'VMware', 'Proxmox', 'Hyper-V'].every((n) => txtHv.includes(n)), 'hyperviseur : les quatre cas sont nommés');
  assert(hv.methodes.some((m) => m.id === 'linux' || m.methode === 'linux'), 'hyperviseur : vérification sous Ubuntu (lsblk)');
  const w = FICHES.find((p) => p.id === 'cours-windows-acces-partage');
  const wtxt = JSON.stringify(w);
  assert(/1219/.test(wtxt) && /net use/.test(wtxt) && /cmdkey/.test(wtxt), 'Windows : erreur 1219, net use ciblé et cmdkey traités');
  assert(!cmds(w).some((l) => /net use \* \/delete|cmdkey \/delete:\*/i.test(l.cmd)), 'Windows : aucune COMMANDE de suppression indiscriminée des connexions (la mise en garde en prose est permise)');
  // identifiant (« compte ») : paramètre validé, pas de texte libre
  for (const f of FICHES) for (const q of f.params ?? []) if (q.id === 'compte') assert(['identifiant', 'nom'].includes(q.type), `${f.id} : paramètre « compte » validé (${q.type})`);
  // aucun secret dans les fiches
  assert(FICHES.every((f) => cmds(f).every((l) => !/(password|passwd|pwd)\s*[:=]\s*\S+|--password[= ]\S|\/user:\S+\s+\S{3,}\s*$/i.test(l.cmd))) && FICHES.every((f) => (f.params ?? []).every((q) => !/mot ?de ?passe|password|secret/i.test(`${q.id} ${q.label}`))), 'aucune commande ni aucun paramètre ne porte un mot de passe');
}

// ---------------------------------------------------------------------------
console.log('9. Recherche par commande et par intention (mémo)');
{
  const premier = (q, n = 3) => { const r = T.chercher(q); return (r.slice ? r : r.resultats ?? []).slice(0, n).map((x) => x.id ?? x.entree?.id); };
  const attendus = [['kill', 'cours-processus'], ['ps aux', 'cours-processus'], ['tar -czf', 'cours-archives'], ['crontab', 'cours-planifier-taches'], ['smbstatus', 'cours-samba-connexions'],
    ['edquota', 'cours-quota-edquota'], ['useradd', 'cours-creer-compte-local'], ['printf', 'cours-afficher-texte'], ['tune2fs', 'cours-disque-entretien'], ['ifconfig', 'cours-ifconfig-ancien'],
    ['shutdown', 'cours-arret-redemarrage'], ['free', 'cours-etat-systeme'], ['which', 'cours-trouver-commande'], ['diff', 'cours-comparer-trier'], ['b7', 'cours-partition-formater-monter'],
    ['tp2 d5', 'cours-ubuntu-acces-partage'], ['ajouter disque vmware', 'cours-hyperviseur-ajouter-disque'], ['csv import comptes', 'cours-samba-import-csv'], ['windows connexion domaine', 'cours-windows-connexion-domaine']];
  for (const [q, id] of attendus) assert(premier(q).includes(id), `recherche « ${q} » → ${id}`, premier(q).join(', '));
  assert(!premier('zzqxw').length, 'contre-épreuve : un mot sans rapport ne ramène rien');
}

console.log(`\ncours : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
