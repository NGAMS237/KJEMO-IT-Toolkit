#!/usr/bin/env node
/**
 * journal.test.mjs — JOURNAL-LABO-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Journal de labo : modèle (journal.mjs), moteur PDF (pdf-a4.mjs) et dossier
 * PDF (journal-pdf.mjs).
 * CAS FONCTIONNELS : garde « aucun secret », normalisation, références et
 * versions, labos à revoir, filtres, création depuis une fiche (TP VLAN avec 1
 * puis 3 VLAN, et TOUTES les fiches du catalogue avec leurs exemples),
 * sauvegarde et restauration, PDF valide (xref recalculée, pages, texte
 * extrait, accents, image JPEG, coupure des tableaux et du code).
 * CONTRE-ÉPREUVES : un mot de passe écrit, une sauvegarde étrangère, un JSON
 * cassé, une image non JPEG, un PDF à xref faussée DOIVENT être refusés.
 * NE PROUVE PAS : le rendu exact dans chaque lecteur PDF (qpdf et pdftotext
 * sont utilisés s'ils sont installés).
 * Usage : node test/journal.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const J = await imp('journal.mjs'); const PDF = await imp('pdf-a4.mjs'); const JP = await imp('journal-pdf.mjs');
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const V = await imp('vue-journal.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const JPEG = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQEAAgACAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAYABEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3V3uVlYIgK54JB9KRZbvjMS+/Bq3RTuIKKKKQxC6g4LAH60m9T0YfnRRQA6iiigD/2Q==', 'base64'));
const TMP = mkdtempSync(join(tmpdir(), 'kjemo-journal-'));
const outil = (nom) => { try { execFileSync(nom, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const QPDF = outil('qpdf'); const PDFTOTEXT = (() => { try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const texteDu = (octets) => { const f = join(TMP, `t${passed + failed}.pdf`); writeFileSync(f, octets); return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); };
const qpdfOk = (octets) => { const f = join(TMP, `q${passed + failed}.pdf`); writeFileSync(f, octets); try { execFileSync('qpdf', ['--check', f], { stdio: 'pipe' }); return true; } catch { return false; } };

/** Vérifie la table xref : chaque décalage pointe bien sur « n 0 obj ». */
function xrefValide(octets) {
  const s = Buffer.from(octets).toString('latin1');
  const sx = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(s)?.[1]);
  if (!Number.isFinite(sx) || !s.startsWith('xref', sx)) return false;
  const lignes = s.slice(sx).split('\n');
  const n = Number(lignes[1].split(' ')[1]);
  for (let k = 1; k < n; k++) {
    const off = Number(lignes[2 + k].slice(0, 10));
    if (!s.startsWith(`${k} 0 obj`, off)) return false;
  }
  return true;
}

console.log('1. Garde « aucun secret »');
for (const t of ['username admin privilege 15 secret Cisco123', 'enable secret 5 $1$mERr$hx5', 'enable password cisco', 'mot de passe : Abc123', 'mdp=toto',
  'az vm create --admin-password Abc!123', '-Password "P@ss1"', 'ConvertTo-SecureString "P@ss1" -AsPlainText -Force', 'key-string 7 1234', 'crypto isakmp key 0 cisco', 'pre-shared-key Secr3t',
  '-----BEGIN RSA PRIVATE KEY-----']) assert(J.secretDans(t), `refusé : « ${t} »`);
for (const t of ['username admin privilege 15 secret', 'enable secret ***', 'service password-encryption', 'le secret est tapé sur la console', 'password recovery',
  'gestionnaire de mots de passe, entrée SW1', 'New-LocalUser -Name eleve -Password $mdp', '-Password (Read-Host -AsSecureString)', 'ssh admin@192.168.99.2', 'show ip ssh'])
  assert(!J.secretDans(t), `accepté : « ${t} »`, J.secretDans(t)?.quoi);
assert(J.secretDans('ligne 1\nligne 2\nenable secret Cisco')?.ligne === 3, 'la ligne fautive est donnée');

console.log('2. Normalisation');
{
  const vide = J.normaliserEntree({});
  assert(vide.erreurs.titre && Object.keys(vide.erreurs).length === 1, 'titre obligatoire, rien d’autre');
  const { entree, erreurs } = J.normaliserEntree({ titre: '  TP  ', categorie: 'azure', etat: 'service', reference: 'LAB-AZ-2026-004', version: '2.3', classification: 'Confidentiel',
    adressage: [{ equipement: 'R1', adresse: '10.0.0.1/24' }, { equipement: '', adresse: '' }, 'x'], validation: [{ test: 'ping', resultat: 'bizarre' }],
    configuration: [{ titre: 'R1', code: 'hostname R1\nenable secret ***' }], fiches: ['cours-tp-vlan-ssh-intervlan', 'a b', 'cours-tp-vlan-ssh-intervlan'],
    captures: [{ id: 'cap1234', nom: 'a.png' }, { id: '../x' }], creeLe: '2026-01-02', modifieLe: 'hier' });
  assert(!Object.keys(erreurs).length, 'entrée correcte acceptée', JSON.stringify(erreurs));
  assert(entree.titre === 'TP' && entree.categorie === 'azure' && entree.etat === 'service' && entree.version === '2.3' && entree.classification === 'Confidentiel', 'champs simples gardés');
  assert(entree.reference === 'LAB-AZ-2026-004', 'référence valide gardée');
  assert(entree.adressage.length === 1 && entree.validation[0].resultat === 'a-tester', 'lignes vides écartées, résultat inconnu → À tester');
  assert(entree.fiches.join() === 'cours-tp-vlan-ssh-intervlan' && entree.captures.length === 1, 'fiches dédoublonnées, capture au nom piégé écartée');
  assert(entree.modifieLe === '2026-01-02' && entree.revisions.length === 1, 'date invalide remplacée, historique créé');
  const r2 = J.normaliserEntree({ titre: 'x', reference: '../../etc', categorie: 'inconnue', etat: '?', classification: 'Secret défense' });
  assert(/^LAB-GEN-\d{4}-001$/.test(r2.entree.reference) && r2.entree.categorie === 'autre' && r2.entree.etat === 'brouillon' && r2.entree.classification === 'Interne', 'valeurs inconnues ramenées au défaut');
  const s = J.normaliserEntree({ titre: 'x', configuration: [{ titre: 'SW', code: 'hostname SW1\nusername admin privilege 15 secret Cisco123' }], incidents: [{ symptome: 'a', solution: 'mot de passe : abc' }], acces: 'ssh -l admin 10.0.0.1' });
  assert(s.erreurs['configuration.0.code'] && /ligne 2/.test(s.erreurs['configuration.0.code']) && s.erreurs['incidents.0.solution'] && !s.erreurs.acces, 'mot de passe écrit refusé dans le code et les incidents, avec la ligne');
  const long = J.normaliserEntree({ titre: 'x'.repeat(500), adressage: Array.from({ length: 100 }, (_, i) => ({ equipement: `E${i}` })) });
  assert(long.entree.titre.length === 120 && long.entree.adressage.length === 60, 'longueurs bornées (titre 120, 60 lignes)');
}

console.log('3. Références, versions, à revoir, filtres');
{
  assert(J.prochaineReference('cisco', '2026', []) === 'LAB-RES-2026-001', 'première référence');
  assert(J.prochaineReference('cisco', '2026', ['LAB-RES-2026-001', 'LAB-RES-2026-007', 'LAB-SYS-2026-009', 'LAB-RES-2025-030']) === 'LAB-RES-2026-008', 'suite par catégorie et par année');
  assert(J.prochaineReference('systeme', '2027', ['LAB-SYS-2026-009']) === 'LAB-SYS-2027-001', 'nouvelle année : on repart à 001');
  assert(J.versionSuivante('1.9') === '1.10' && J.versionSuivante('1.9', true) === '2.0' && J.versionSuivante('n/a') === '1.1', 'versions mineures et majeures');
  const base = J.normaliserEntree({ titre: 'TP', version: '1.2' }).entree;
  assert(J.publierVersion(base, { resume: ' ' }).erreur, 'nouvelle version : résumé obligatoire');
  assert(J.publierVersion(base, { resume: 'mot de passe : abc' }).erreur, 'nouvelle version : résumé avec mot de passe refusé');
  const v = J.publierVersion(base, { resume: 'Ajout du VLAN 20', date: new Date('2026-11-06T10:00:00') }).entree;
  assert(v.version === '1.3' && v.revisions.at(-1).resume === 'Ajout du VLAN 20' && v.revisions.at(-1).date === '2026-11-06' && v.modifieLe === '2026-11-06', 'version publiée et datée');
  const vieux = { ...base, modifieLe: '2026-08-01' };
  assert(J.aRevoir(vieux, new Date('2026-11-05T10:00:00')) && !J.aRevoir({ ...vieux, etat: 'archive' }, new Date('2026-11-05T10:00:00')) && !J.aRevoir({ ...vieux, modifieLe: '2026-10-01' }, new Date('2026-11-05T10:00:00')), 'à revoir après 60 jours, sauf archivé');
  const mk = (t, cat, etat, d, adr = []) => J.normaliserEntree({ titre: t, categorie: cat, etat, modifieLe: d, creeLe: '2026-01-01', adressage: adr }).entree;
  const liste = [mk('VLAN et routage', 'cisco', 'service', '2026-10-01', [{ adresse: '192.168.99.2/24' }]), mk('Jonction Samba', 'systeme', 'brouillon', '2026-11-01'), mk('VNet', 'azure', 'archive', '2026-09-01')];
  assert(J.filtrerJournal(liste).map((e) => e.titre).join() === 'Jonction Samba,VLAN et routage', 'actifs triés du plus récent, archives cachées');
  assert(J.filtrerJournal(liste, { filtre: 'archive' }).length === 1 && J.filtrerJournal(liste, { categorieId: 'cisco' }).length === 1, 'filtres état et catégorie');
  assert(J.filtrerJournal(liste, { requete: 'jonction' }).length === 1 && J.filtrerJournal(liste, { requete: '192.168.99' }).length === 1 && J.filtrerJournal(liste, { requete: 'ROUTÉ' }).length === 0, 'recherche dans le titre et les adresses, sans accents');
}

console.log('4. Création depuis une fiche');
const fiche = T.entreeParId('cours-tp-vlan-ssh-intervlan').procedure;
const exemple = (p) => Object.fromEntries((p.params ?? []).map((x) => [x.id, x.type === 'table' ? x.exemple.map((r) => ({ ...r })) : x.exemple]));
const depuis = (p, saisies) => {
  const m = p.methodes[0];
  return J.entreeDepuisFiche(p, { methode: m, rendu: P.rendreMethode(m, p.params ?? [], saisies), valeurs: J.valeursPourJournal(P.evaluerValeurs(p.params ?? [], saisies)),
    plateformes: T.plateformesDeProcedure(p), auteur: 'B. Nganbou', date: new Date('2026-11-05T10:00:00'), existantes: ['LAB-RES-2026-001'] });
};
{
  const { entree: e, erreurs } = depuis(fiche, exemple(fiche));
  const code = e.configuration.map((b) => b.code).join('\n');
  assert(!Object.keys(erreurs).length, 'TP VLAN : aucune erreur', JSON.stringify(erreurs));
  assert(e.reference === 'LAB-RES-2026-002' && e.categorie === 'cisco' && e.auteur === 'B. Nganbou' && e.fiches[0] === fiche.id, 'référence suivante, catégorie Cisco, auteur, fiche liée');
  assert(e.adressage.length === 3 && e.adressage[0].adresse === '192.168.99.2/24' && e.adressage[0].interface === 'Vlan99' && e.adressage[2].adresse === '192.168.10.0/24', 'adressage : gestion, poste de gestion et VLAN du tableau');
  assert(code.includes('switchport trunk allowed vlan 99,10') && code.includes('encapsulation dot1Q 10') && /username admin privilege 15 secret$/m.test(code), 'configuration reprise avec les valeurs, secret arrêté avant le mot de passe');
  assert(!/^no vlan|allowed vlan add|username tech2/m.test(code), 'ni annulations, ni étapes facultatives');
  assert(!code.includes('{{') && /^! 2\. Nommer le commutateur/m.test(code), 'aucun champ restant ; commentaire IOS avec le numéro d’étape');
  assert(e.configuration.length >= 6 && e.configuration[0].titre.startsWith('Phase 1'), 'un bloc par phase');
  assert(e.validation.length === 3 && e.validation.every((v) => v.resultat === 'a-tester'), 'validation : la vérification finale, à tester');
  assert(/« Annuler »/.test(e.retourArriere) && e.retourArriere.includes(fiche.titre), 'retour arrière : renvoie aux étapes Annuler de la fiche');
  const trois = exemple(fiche); trois.plan = [...trois.plan, { vlan: '20', nom: 'TECHNIQUE', reseau: '192.168.20.0', prefixe: '24', passerelle: '192.168.20.1', ports: 'Fa0/2', poste: '192.168.20.10' }];
  const e3 = depuis(fiche, trois).entree;
  assert(e3.adressage.length === 4 && e3.configuration.map((b) => b.code).join('\n').includes('allowed vlan 99,10,20'), 'un VLAN ajouté au tableau : une ligne et une commande de plus');
  const vides = depuis(fiche, {}).entree;
  assert(vides.configuration.every((b) => !b.code.includes('{{')) && vides.adressage.length === 0, 'fiche vide : étapes incomplètes non reprises, aucun « {{ »');
}
{
  let n = 0; const fautes = [];
  for (const en of T.TOUTES_LES_ENTREES) {
    const p = en.procedure; if (!p?.methodes?.length) continue;
    n++;
    const { entree: e, erreurs } = depuis(p, exemple(p));
    if (Object.keys(erreurs).length) fautes.push(`${p.id}: ${Object.keys(erreurs).join(',')}`);
    else if (JSON.stringify(e).includes('{{')) fautes.push(`${p.id}: {{`);
  }
  assert(n > 300 && fautes.length === 0, `toutes les fiches (${n}) donnent un labo valide, sans secret ni champ restant`, fautes.slice(0, 5).join(' | '));
}

console.log('5. Sauvegarde et restauration');
{
  const e1 = depuis(fiche, exemple(fiche)).entree; e1.captures = [{ id: 'cap0001', nom: 'vlan.png', legende: 'show vlan brief' }];
  const b64 = Buffer.from(JPEG).toString('base64');
  const txt = J.sauvegardeJournal([e1], { cap0001: b64, orpheline: b64 }, new Date('2026-11-05T10:00:00'));
  const r = J.lireSauvegarde(txt, []);
  assert(!r.erreur && r.entrees.length === 1 && JSON.stringify(r.entrees[0]) === JSON.stringify(J.normaliserEntree(e1).entree), 'aller-retour identique');
  assert(Object.keys(r.captures).join() === 'cap0001', 'seules les captures utilisées sont reprises');
  assert(J.lireSauvegarde(txt, [e1]).doublons[0] === e1.reference, 'les labos déjà présents sont signalés');
  assert(J.lireSauvegarde('{pas du json').erreur && J.lireSauvegarde(JSON.stringify({ format: 'autre' })).erreur, 'JSON cassé ou étranger refusé');
  const piege = JSON.parse(txt); piege.entrees.push({ titre: 'x', acces: 'mot de passe : abc' }); piege.captures.cap0001 = '<script>';
  const rp = J.lireSauvegarde(JSON.stringify(piege), []);
  assert(rp.ecartees === 1 && rp.entrees.length === 1 && !rp.captures.cap0001, 'entrée avec mot de passe écartée, image non base64 refusée');
}

console.log('6. Moteur PDF');
{
  assert(PDF.versWinAnsi('Été → ✔ 🚀 Œuvre ≥ 2') === 'Été -> OK  Œuvre >= 2', 'accents gardés, substituts lisibles, emoji retiré', PDF.versWinAnsi('Été → ✔ 🚀 Œuvre ≥ 2'));
  assert(PDF.largeur('W', 'gras', 10) > PDF.largeur('i', 'normal', 10) && PDF.largeur('abc', 'mono', 10) === 18, 'largeurs AFM et Courier');
  const l = PDF.couper('un mot trèstrèstrèstrèstrèslongsansespace fin', 'normal', 10, 60);
  assert(l.every((x) => PDF.largeur(x, 'normal', 10) <= 60.01) && l.join('').replace(/ /g, '') === 'unmottrèstrèstrèstrèstrèslongsansespacefin', 'coupure sans débordement ni perte');
  assert(JSON.stringify(PDF.dimensionsJpeg(JPEG)) !== 'null' && PDF.dimensionsJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])) === null, 'dimensions JPEG lues, PNG refusé');
  const doc = new PDF.DocumentPdf({ titre: 'Essai é' });
  assert(doc.ajouterJpeg(new Uint8Array([1, 2, 3])) === -1, 'contre-épreuve : image non JPEG refusée');
}

console.log('7. Dossier PDF');
{
  const e = depuis(fiche, exemple(fiche)).entree;
  e.incidents = [{ symptome: 'no matching key exchange method found', cause: 'IOS ancien', solution: 'ssh -o KexAlgorithms=+diffie-hellman-group14-sha1 admin@192.168.99.2' }];
  e.acces = 'ssh admin@192.168.99.2'; e.rangement = 'Gestionnaire de mots de passe, entrée « SW1 »';
  e.validation[0].resultat = 'conforme';
  e.captures = [{ id: 'cap0001', nom: 'vlan.jpg', legende: 'show vlan brief → OK' }];
  const r = JP.pdfJournal(e, { captures: { cap0001: JPEG }, titresFiches: { [fiche.id]: fiche.titre }, date: new Date('2026-11-05T10:00:00Z') });
  const s = Buffer.from(r.octets).toString('latin1');
  assert(s.startsWith('%PDF-1.4') && s.endsWith('%%EOF\n'), 'en-tête et fin de fichier PDF');
  assert(xrefValide(r.octets), 'table xref exacte (chaque objet à son décalage)');
  assert(new RegExp(`/Count ${r.pages} `).test(s) && r.pages >= 4, `${r.pages} pages déclarées`);
  assert(s.includes('/DCTDecode') && s.includes('/Im0 Do'), 'la capture JPEG est intégrée');
  assert(r.sections.map((x) => x.titre).join('|') === 'Objet|Plan d’adressage|Configuration|Validation|Exploitation|Incidents et solutions|Références|Captures', 'plan fixe, sections vides omises (environnement, architecture)');
  assert(r.sections.every((x, i) => i === 0 || x.page >= r.sections[i - 1].page) && r.sections[0].page === 2, 'sections dans l’ordre, à partir de la page 2');
  assert(JP.nomFichierPdf(e) === 'LAB-RES-2026-002_v1.0.pdf', 'nom du fichier : référence et version');
  if (QPDF) assert(qpdfOk(r.octets), 'qpdf --check : aucune erreur');
  if (PDFTOTEXT) {
    const t = texteDu(r.octets);
    for (const x of ['Contrôle du document', 'LAB-RES-2026-002', 'Historique des révisions', 'Sommaire', 'Plan d’adressage', '192.168.99.2/24', 'switchport trunk allowed vlan 99,10',
      '✔ Conforme'.replace('✔', 'OK'), 'Figure 1 : show vlan brief -> OK', `Page 1 / ${r.pages}`, `Page ${r.pages} / ${r.pages}`, 'B. Nganbou', '5 novembre 2026'])
      assert(t.includes(x), `texte du PDF : « ${x} »`);
    assert(!/secret\s+\S*[0-9A-Z]/.test(t.replace(/secret\n/g, '')), 'aucun mot de passe dans le texte du PDF');
    // Code long et tableau long : coupés entre les pages, rien de perdu.
    const gros = J.normaliserEntree({ titre: 'Gros labo', configuration: [{ titre: 'R1', code: Array.from({ length: 220 }, (_, i) => `ip route 10.${i}.0.0 255.255.0.0 192.0.2.1`).join('\n') }],
      adressage: Array.from({ length: 60 }, (_, i) => ({ equipement: `SW${i}`, adresse: `10.${i}.0.1/24`, note: 'note longue '.repeat(6) })) }).entree;
    const rg = JP.pdfJournal(gros, {});
    const tg = texteDu(rg.octets);
    assert(rg.pages >= 6 && xrefValide(rg.octets), `gros labo : ${rg.pages} pages, xref exacte`);
    assert(tg.includes('ip route 10.0.0.0') && tg.includes('ip route 10.219.0.0') && tg.includes('SW0') && tg.includes('SW59'), 'première et dernière lignes du code et du tableau présentes');
    assert((tg.match(/Équipement/g) ?? []).length >= 2, 'l’en-tête du tableau est répété sur la page suivante');
  } else console.log('  (pdftotext absent : contrôles du texte ignorés)');
  const sans = JP.pdfJournal(J.normaliserEntree({ titre: 'Vide' }).entree, {});
  assert(xrefValide(sans.octets) && sans.pages === 2 && sans.sections.length === 0, 'labo vide : page de garde et page « aucune section »');
  const faux = new Uint8Array(r.octets); const i = Buffer.from(faux).toString('latin1').lastIndexOf('0000000');
  faux[i + 9] = faux[i + 9] === 0x31 ? 0x32 : 0x31;
  assert(!xrefValide(faux), 'contre-épreuve : une xref faussée est détectée');
}

console.log('8. Écrans');
{
  const e = depuis(fiche, exemple(fiche)).entree;
  const h = V.journalEditeurMarkup({ entree: e, erreurs: { 'configuration.0.code': 'X <b>' }, titresFiches: { [fiche.id]: fiche.titre } });
  assert(h.includes('id="jPdf"') && h.includes('Exporter en PDF') && h.includes('id="jEnregistrer"') && h.includes('data-jadd="adressage"'), 'fiche : actions et tableaux');
  assert(h.includes('X &lt;b&gt;') && !h.includes('X <b>') && h.includes('aria-invalid="true"'), 'erreurs échappées et reliées au champ');
  assert(!/mot de passe" |name="password|type="password"/i.test(h), 'aucun champ de mot de passe');
  const l = V.journalListeMarkup({ entrees: [e], total: 1, compte: () => 1 });
  assert(l.includes(V.routeEntreeJournal(e.id)) && l.includes(e.reference) && l.includes('Sauvegarder le journal'), 'liste : lien, référence, sauvegarde');
  assert(V.lireRouteJournal('#/journal').id === null && V.lireRouteJournal('#/journal/jabc12').id === 'jabc12' && V.lireRouteJournal('#/journal/../x') === null, 'routes du journal');
  const piege = V.journalListeMarkup({ entrees: [{ ...e, titre: '<img src=x onerror=alert(1)>' }], total: 1, compte: () => 1 });
  assert(!piege.includes('<img src=x'), 'titre échappé dans la liste');
}

console.log(`journal : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Le PDF est vérifié par sa structure, qpdf et pdftotext ; l’affichage dans chaque lecteur PDF n’est pas prouvé.');
process.exit(failed ? 1 : 0);
