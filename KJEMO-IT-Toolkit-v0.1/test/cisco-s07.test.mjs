#!/usr/bin/env node
/**
 * cisco-s07.test.mjs — KJEMO-CISCO-S07-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles du cours Cisco « semaine 7 : EtherChannel et Spanning Tree » :
 * les 9 fiches IOS, le cours et ses parcours, le RÉSUMÉ PLIABLE, et les
 * SCHÉMAS ORIGINAUX (SVG).
 *
 * CAS FONCTIONNELS : contrat de chaque fiche, commandes rendues avec les
 * valeurs d'exemple (ASCII, sans « ? », sans tabulation, sans marque non
 * remplacée), classement dans « Réseau Cisco », mémo, filtre de plateforme,
 * parcours résolus, résumé complet, schémas valides.
 * CONTRE-ÉPREUVES : on dégrade un résumé, un schéma, une fiche, un paramètre, et
 * le contrôle DOIT échouer.
 * SÉCURITÉ / DROIT D'AUTEUR : aucun schéma ne contient d'image embarquée ni de
 * lien externe (rien n'est copié des diapositives) ; aucun secret ; les
 * commandes ne sont jamais exécutées.
 *
 * NE PROUVE PAS : le comportement sur un commutateur ou dans Packet Tracer
 * (NON EXÉCUTÉ), ni l'exactitude d'un affichage dans un navigateur donné.
 * Usage : node test/cisco-s07.test.mjs   (exit 0 = tout OK)
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
const R = await imp('cours-resume-cisco.mjs'); const { COURS_CISCO } = await imp('cours-fiches-cisco.mjs');
const VC = await imp('vue-cours.mjs'); const VT = await imp('vue-taches.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const IDS = ['cours-ec-avant-de-grouper', 'cours-ec-pagp', 'cours-ec-lacp', 'cours-ec-statique', 'cours-ec-verifier', 'cours-ec-depanner', 'cours-stp-lire', 'cours-stp-racines', 'cours-stp-portfast-bpduguard'];

// ---------------------------------------------------------------------------
console.log('1. Les 9 fiches IOS');
assert(COURS_CISCO.length === 9 && COURS_CISCO.map((p) => p.id).join() === IDS.join(), '9 fiches, dans l’ordre prévu');
for (const p of COURS_CISCO) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' ; '));
  assert(p.origine === 'cours' && p.id.startsWith('cours-'), `origine cours : ${p.id}`);
  assert(p.methodes.length === 1 && p.methodes[0].id === 'ios', `méthode IOS unique : ${p.id}`);
  const e = T.entreeParId(p.id);
  assert(e && e.procedure === p, `dans le catalogue : ${p.id}`);
  assert(e && e.plateformes.join() === 'Cisco', `plateforme Cisco seule : ${p.id}`, e?.plateformes?.join());
  assert(e && C.cheminDe(e) !== null && C.estPlaceDirect(p.id), `classée directement : ${p.id}`);
  assert(C.cheminDe(e)?.domaine?.id === 'reseau-cisco' || JSON.stringify(C.cheminDe(e)).includes('reseau-cisco'), `rangée sous Réseau Cisco : ${p.id}`, JSON.stringify(C.cheminDe(e)));
  assert(M.groupeDeFiche(p.id)?.id === 'cisco-commutation', `dans l’aide-mémoire « Commutation Cisco » : ${p.id}`);
  assert((p.figures ?? []).length >= 1 && p.figures.every((f) => S.IDS_SCHEMAS.includes(f)), `schémas connus : ${p.id}`, (p.figures ?? []).join());
  assert(p.rappel && p.rappel.points.length >= 3 && p.rappel.points.every((x) => x.length >= 20), `rappel de cours plié : ${p.id}`);
}

// ---------------------------------------------------------------------------
console.log('2. Commandes rendues avec les valeurs d’exemple');
const exemple = (p) => Object.fromEntries(p.params.map((x) => [x.id, x.exemple]));
for (const p of COURS_CISCO) {
  const rendu = P.rendreMethode(p.methodes[0], p.params, exemple(p));
  assert(rendu.manquants.length === 0, `aucune valeur manquante : ${p.id}`, rendu.manquants.join());
  for (const e of rendu.etapes) {
    for (const l of e.rendu?.lignes ?? []) {
      assert(/^[\x20-\x7e]+$/.test(l.copie), `ASCII seul, sans tabulation : ${p.id}`, l.copie);
      assert(!/\?/.test(l.copie), `jamais de « ? » (IOS l’interprète à la frappe) : ${p.id}`, l.copie);
      assert(!/\{\{|\}\}/.test(l.copie) && !/‹|›/.test(l.copie), `aucune marque non remplacée : ${p.id}`, l.copie);
      assert(!/\bpassword\b|\bsecret\b|enable secret/i.test(l.copie), `aucun secret : ${p.id}`, l.copie);
      assert(!/\b(reload|erase|write erase|delete|format)\b/i.test(l.copie), `aucune commande destructrice de la mémoire de l’équipement : ${p.id}`, l.copie);
    }
  }
}
const texteEtapes = (id) => P.rendreMethode(T.entreeParId(id).procedure.methodes[0], T.entreeParId(id).procedure.params, exemple(T.entreeParId(id).procedure)).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
const pagp = texteEtapes('cours-ec-pagp');
assert(pagp.includes('interface range FastEthernet0/21 , FastEthernet0/22'), 'PAgP : interface range avec « , » entre deux ports complets', pagp.join(' | '));
assert(pagp.includes('channel-group 1 mode desirable'), 'PAgP : channel-group 1 mode desirable');
assert(pagp.indexOf('shutdown') < pagp.indexOf('channel-group 1 mode desirable') && pagp.indexOf('channel-group 1 mode desirable') < pagp.indexOf('no shutdown'), 'PAgP : shutdown, puis channel-group, puis no shutdown (l’ordre du cours)');
assert(pagp.indexOf('no shutdown') < pagp.indexOf('interface port-channel 1'), 'PAgP : le port-channel se règle après avoir rallumé les ports');
const lacp = texteEtapes('cours-ec-lacp');
assert(lacp.includes('channel-group 1 mode active'), 'LACP : channel-group 1 mode active');
assert(texteEtapes('cours-ec-statique').includes('channel-group 1 mode on') && !texteEtapes('cours-ec-statique').some((l) => /desirable|active/.test(l)), 'statique : mode on, sans négociation');
assert(texteEtapes('cours-stp-racines').includes('spanning-tree vlan 10,30,50,70 root primary') && texteEtapes('cours-stp-racines').includes('spanning-tree vlan 1 root primary'), 'STP : root primary pour la liste, et pour le VLAN 1 à part');
assert(texteEtapes('cours-stp-racines').includes('spanning-tree mode rapid-pvst'), 'STP : mode rapid-pvst');
assert(texteEtapes('cours-stp-portfast-bpduguard').includes('spanning-tree bpduguard enable'), 'PortFast : bpduguard enable');
assert(texteEtapes('cours-ec-verifier').includes('show etherchannel summary') && texteEtapes('cours-ec-verifier').includes('show interfaces port-channel 1'), 'vérification : show etherchannel summary et show interfaces port-channel');
assert(texteEtapes('cours-ec-depanner').some((l) => l === 'show run | begin interface Port-channel'), 'dépannage : show run | begin interface Port-channel');
// valeurs refusées
{
  const pg = T.entreeParId('cours-ec-pagp').procedure;
  const mauvais = P.evaluerValeurs(pg.params, { ...exemple(pg), portB: 'Fa0/21' });
  assert(Boolean(mauvais.erreurs.portB || mauvais.erreurs.portA), 'contre-épreuve : le même port deux fois est refusé');
  const m2 = P.evaluerValeurs(pg.params, { ...exemple(pg), mode: 'active' });
  assert(Boolean(m2.erreurs.mode), 'contre-épreuve : PAgP refuse le mode « active » (c’est du LACP)');
  const m3 = P.evaluerValeurs(pg.params, { ...exemple(pg), groupe: '9' });
  assert(Boolean(m3.erreurs.groupe), 'contre-épreuve : groupe hors de 1 à 6 refusé');
  const m4 = P.evaluerValeurs(pg.params, { ...exemple(pg), portA: 'Fa0/21; reload' });
  assert(Boolean(m4.erreurs.portA), 'contre-épreuve : une seconde commande glissée dans un port est refusée');
  const lc = T.entreeParId('cours-ec-lacp').procedure;
  assert(Boolean(P.evaluerValeurs(lc.params, { ...exemple(lc), mode: 'desirable' }).erreurs.mode), 'contre-épreuve : LACP refuse « desirable »');
  const sr = T.entreeParId('cours-stp-racines').procedure;
  assert(Boolean(P.evaluerValeurs(sr.params, { ...exemple(sr), vlans: '10,all' }).erreurs.vlans), 'contre-épreuve : « all » refusé dans la liste de VLAN');
}

// ---------------------------------------------------------------------------
console.log('3. Le cours et ses parcours');
const cours = K.COURS_PAR_ID.get('cisco-s07-etherchannel');
assert(cours && cours.plateformes.join() === 'Cisco', 'le cours existe et appartient à la plateforme Cisco');
const resolveur = {
  fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodeParDefaut: ms[0].id, methodes: Object.fromEntries(ms.map((m) => [m.id, m.etapes.length])), titres: Object.fromEntries(ms.map((m) => [m.id, m.etapes.map((x) => x.titre)])) }; },
  assistants: () => true,
};
const pbCours = K.incoherencesCours(cours, resolveur);
assert(pbCours.length === 0, 'le cours est conforme à son contrat', pbCours.join(' ; '));
assert(cours.parcours.map((p) => p.lettre).join('') === 'ABC', 'parcours A, B, C');
const nonCouverts = cours.parcours.flatMap((p) => p.items).filter((i) => i.couvert === false);
assert(nonCouverts.length === 2 && nonCouverts.every((i) => i.note.length >= 40), 'deux éléments dits « non couverts » (construction de la topologie, mode simulation), chacun expliqué', nonCouverts.map((i) => i.id).join());
const citees = new Set(cours.parcours.flatMap((p) => [...p.prerequis.map((r) => r.fiche), ...p.items.flatMap((i) => i.refs.map((r) => r.fiche))]).concat(cours.soutien.map((s) => s.fiche)));
assert(IDS.every((id) => citees.has(id)), 'chaque fiche du cours est atteinte par un parcours', IDS.filter((id) => !citees.has(id)).join());
assert(K.lireRouteCours('#/cours/cisco-s07-etherchannel/resume')?.lettre === 'resume' && K.lireRouteCours('#/cours/cisco-s07-etherchannel/B')?.lettre === 'B', 'route #/cours/<id>/resume reconnue, route d’un parcours inchangée');
assert(K.aliasesDe('cours-ec-pagp').some((a) => a.startsWith('s07 ')), 'alias de recherche « s07 a3 »…');
// contre-épreuves
{
  const casse = structuredClone(cours);
  casse.parcours[0].items[0].refs[0].etape = 99;
  assert(K.incoherencesCours(casse, resolveur).length > 0, 'contre-épreuve : une étape inexistante est détectée');
  const casse2 = structuredClone(cours);
  casse2.parcours[0].items[0].refs[0].titre = 'titre qui n’existe pas';
  assert(K.incoherencesCours(casse2, resolveur).length > 0, 'contre-épreuve : un titre d’étape qui ne correspond plus est détecté');
}

// ---------------------------------------------------------------------------
console.log('4. Le résumé pliable');
const r = cours.rappelCours;
assert(r === R.RESUME_S07, 'le cours porte le résumé');
assert(K.incoherencesRappel(r).length === 0, 'le résumé est conforme à son contrat', K.incoherencesRappel(r).join(' ; '));
assert(r.sections.length >= 6 && r.essentiel.length >= 6 && r.commandes.length >= 8 && r.questions.length >= 6 && r.pieges.length >= 4, 'résumé substantiel : sections, essentiel, commandes, questions, pièges');
{
  const tout = JSON.stringify(r);
  for (const mot of ['PAgP', 'LACP', 'port-channel', 'desirable', 'active', 'passive', 'show etherchannel summary', 'SU', 'root primary', 'rapid-pvst', 'PortFast']) {
    assert(tout.includes(mot), `le résumé couvre « ${mot} »`);
  }
  const casse = structuredClone(r);
  casse.sections[0].schemas = ['schema-inconnu'];
  assert(K.incoherencesRappel(casse).some((x) => /inconnu/.test(x)), 'contre-épreuve : un schéma inconnu est détecté');
  const casse2 = structuredClone(r); casse2.questions = casse2.questions.slice(0, 1);
  assert(K.incoherencesRappel(casse2).length > 0, 'contre-épreuve : trop peu de questions est détecté');
  const casse3 = structuredClone(r); casse3.essentiel[0] = 'court';
  assert(K.incoherencesRappel(casse3).length > 0, 'contre-épreuve : un point trop court est détecté');
}
const ctx = { fiche: (id) => { const e = T.entreeParId(id); return e ? { titre: e.titre, etapes: e.procedure.methodes[0].etapes } : null; }, assistant: () => null };
{
  const html = VC.coursPageMarkup(cours, 'A', {}, ctx);
  assert(/<details class="cours-resume" id="resume-cours">/.test(html) && !/<details class="cours-resume" id="resume-cours" open>/.test(html), 'page du cours : le résumé est PLIÉ par défaut');
  assert(/<summary>[^<]*<span aria-hidden="true">📘<\/span> Résumé du cours/.test(html), 'le résumé a un titre cliquable');
  assert(VC.coursPageMarkup(cours, 'resume', {}, ctx).includes('id="resume-cours" open'), 'route /resume : le résumé est déplié');
  assert(VC.coursPageMarkup(cours, 'A', {}, ctx, { resumeOuvert: true }).includes('id="resume-cours" open'), 'l’état ouvert est conservé quand la page se redessine');
  assert((html.match(/class="schema"/g) ?? []).length >= 8, 'les 8 schémas du cours sont dans le résumé', String((html.match(/class="schema"/g) ?? []).length));
  assert((html.match(/class="rappel-question"/g) ?? []).length === r.questions.length, 'une question repliée par question');
  assert(!/<script|onclick=|javascript:/i.test(html), 'aucun script ni gestionnaire dans le marquage');
  assert(html.includes('rappel-commandes') && html.includes('rappel-pieges') && html.includes('rappel-essentiel'), 'essentiel, commandes et pièges présents');
  const liste = VC.coursListeMarkup(K.COURS.filter((c) => c.plateformes.includes('Cisco')), {}, ctx, 'Cisco');
  assert(liste.includes('cisco-s07-etherchannel/resume') && liste.includes('Résumé du cours'), 'la carte du cours Cisco propose un lien direct vers le résumé');
  assert(!VC.coursListeMarkup(K.COURS.filter((c) => c.plateformes.includes('Linux')), {}, ctx, 'Linux').includes('/resume'), 'le cours Linux n’a pas de lien de résumé');
}

// ---------------------------------------------------------------------------
console.log('5. Schémas originaux');
assert(S.IDS_SCHEMAS.length === 8 + 14 + 10, '32 schémas : 8 de la semaine 7, 14 des semaines 1 à 5 et 10 Azure');
const tmp = mkdtempSync(resolve(tmpdir(), 'svg-'));
for (const id of S.IDS_SCHEMAS) {
  const sc = S.SCHEMAS[id];
  const svg = sc.svg();
  assert(svg.startsWith('<svg ') && svg.endsWith('</svg>'), `SVG complet : ${id}`);
  assert(/role="img"/.test(svg) && /<title id="[^"]+">[^<]{10,}<\/title>/.test(svg) && /<desc id="[^"]+">[^<]{30,}<\/desc>/.test(svg), `titre et description pour lecteur d’écran : ${id}`);
  assert(/aria-labelledby="([^" ]+) ([^" ]+)"/.test(svg), `aria-labelledby : ${id}`);
  assert(S.altSchema(id) && S.altSchema(id).length >= 30, `texte alternatif : ${id}`);
  assert(!/<image|data:|href=|<script|<foreignObject|onload=|xlink/i.test(svg), `aucune image embarquée, aucun lien, aucun script (rien n’est copié des diapositives) : ${id}`);
  assert(/viewBox="0 0 \d+ \d+"/.test(svg), `viewBox (redimensionnable) : ${id}`);
  assert(sc.legende.length >= 40 && sc.titre.length >= 10, `légende : ${id}`);
  const fig = S.figureMarkup(id);
  assert(fig.startsWith('<figure class="schema"') && fig.includes('<figcaption>'), `figure + légende : ${id}`);
  const f = resolve(tmp, `${id}.svg`); writeFileSync(f, svg);
  try { execFileSync('xmllint', ['--noout', f], { stdio: 'pipe' }); assert(true, `XML bien formé : ${id}`); } catch (e) { assert(false, `XML bien formé : ${id}`, String(e.stderr ?? e.message).slice(0, 200)); }
  // Jamais la couleur seule : les schémas qui montrent un état le disent aussi par un symbole
}
{
  const modes = S.SCHEMAS['ec-modes'].svg();
  assert((modes.match(/✓ forme/g) ?? []).length === 8 && (modes.match(/✗ non/g) ?? []).length === 10, 'tableau des modes : 8 combinaisons qui forment un canal (3 PAgP + on-on, 3 LACP + on-on), 10 qui échouent, dites par un mot ET un symbole', `${(modes.match(/✓ forme/g) ?? []).length}/${(modes.match(/✗ non/g) ?? []).length}`);
  // PAgP : desirable-desirable, desirable-auto, auto-desirable = 3 ; LACP : 3 ; on-on dans chaque tableau = 2 ; total 8 attendus
}
assert(S.figureMarkup('inconnu') === null && S.altSchema('inconnu') === null, 'contre-épreuve : un schéma inconnu donne null, pas une page cassée');
{
  const sain = S.SCHEMAS['ec-modes'].svg();
  assert(!/<script/.test(sain), 'sain');
  const hostile = sain.replace('</svg>', '<script>alert(1)</script></svg>');
  assert(/<script/.test(hostile), 'contre-épreuve : la détection de <script> voit bien un script ajouté');
}

// ---------------------------------------------------------------------------
console.log('6. Fiches : schémas et rappel dans la page');
{
  const e = T.entreeParId('cours-ec-pagp');
  const html = VT.tachePageMarkup(e, { methodeId: 'ios', saisies: exemple(e.procedure) });
  assert(html.includes('id="schemas-fiche" open') && (html.match(/class="schema"/g) ?? []).length === e.procedure.figures.length, 'fiche PAgP : les schémas sont affichés (dépliés)');
  assert(html.includes('id="rappel-cours"') && !/id="rappel-cours" open/.test(html), 'fiche PAgP : rappel du cours PLIÉ');
  assert(html.indexOf('tache-resume') < html.indexOf('schemas-fiche') && html.indexOf('schemas-fiche') < html.indexOf('etapesZone'), 'les schémas viennent après le résumé et avant les étapes');
  const sans = T.entreeParId('cisco-creer-vlan');
  const h2 = VT.tachePageMarkup(sans, { methodeId: 'ios', saisies: {} });
  assert(!h2.includes('schemas-fiche') && !h2.includes('rappel-cours'), 'une fiche sans schéma ni rappel n’en affiche pas');
}

// ---------------------------------------------------------------------------
console.log('7. Plateforme Cisco, classement et aide-mémoire');
{
  const entrees = COURS_CISCO.map((p) => T.entreeParId(p.id));
  assert(entrees.every((x) => x.plateformes.length === 1 && x.plateformes[0] === 'Cisco'), 'les 9 fiches sont Cisco seulement (le filtre Cisco les garde, Linux et Windows non)');
  const fam = (C.ARBRE['reseau-cisco'] ?? []).find((f) => f.id === 'commutation');
  assert(fam && fam.fiches.length === 9 && IDS.every((id) => fam.fiches.includes(id)), 'famille « EtherChannel et Spanning Tree » du catalogue Cisco');
  const g = M.MEMO_PAR_ID.get('cisco-commutation');
  assert(g && g.sous.length === 2 && M.fichesDuGroupe(g).length === 9, 'groupe de l’aide-mémoire : 2 sous-groupes, 9 fiches');
  assert(M.idsNouveaux().has('cours-ec-pagp'), 'les fiches EtherChannel sont « nouvelles »');
  const liees = M.fichesDuCours(cours);
  assert(IDS.every((id) => liees.has(id)), 'le filtre « Liés au TP » retrouve les 9 fiches pour ce cours');
}

// ---------------------------------------------------------------------------
console.log('8. Recherche');
{
  for (const [req, attendu] of [['etherchannel pagp', 'cours-ec-pagp'], ['channel-group mode active', 'cours-ec-lacp'], ['show etherchannel summary', 'cours-ec-verifier'], ['rapid-pvst', 'cours-stp-racines'], ['portfast', 'cours-stp-portfast-bpduguard'], ['dépanner etherchannel', 'cours-ec-depanner']]) {
    const res = T.chercher(req, { plateforme: 'Cisco' });
    const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 5).includes(attendu), `recherche « ${req} » : ${attendu} parmi les 5 premiers`, ids.slice(0, 5).join());
  }
}

console.log(`\ncisco-s07 : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (Packet Tracer, commutateur) : NON EXÉCUTÉE. Contrat, rendu des commandes, schémas et résumé vérifiés seulement.');
process.exit(failed ? 1 : 0);
