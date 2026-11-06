/**
 * journal-pdf.mjs — JOURNAL-LABO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le dossier PDF A4 d'une entrée du Journal de labo, au format d'un document
 * d'entreprise : page de garde (contrôle du document, historique des révisions,
 * sommaire paginé), puis un plan FIXE dont les sections vides sont omises :
 *   Objet · Environnement · Architecture · Plan d'adressage · Configuration ·
 *   Validation · Exploitation · Incidents et solutions · Références · Captures.
 * Module PUR : reçoit l'entrée et les octets JPEG des captures, rend des octets.
 */
import { A4, DocumentPdf, Flux, STYLE, couper, largeur } from './pdf-a4.mjs';
import { categorie, etat, resultat } from './journal.mjs';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « 2026-11-05 » → « 5 novembre 2026 ». */
export function dateLongue(j) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(j ?? ''));
  return m ? `${Number(m[3])} ${MOIS[Number(m[2]) - 1]} ${m[1]}` : String(j ?? '');
}

/** Nom du fichier téléchargé : LAB-RES-2026-001_v1.2.pdf */
export function nomFichierPdf(entree) {
  return `${entree.reference}_v${entree.version}.pdf`.replace(/[^\w.-]/g, '_');
}

const plein = (s) => String(s ?? '').trim().length > 0;

/** Les sections présentes, dans l'ordre du plan (sert aussi au sommaire de l'écran). */
export function sectionsPresentes(e, { captures = {} } = {}) {
  const s = [];
  if (plein(e.objet)) s.push('objet');
  if (plein(e.environnement)) s.push('environnement');
  if (plein(e.architecture)) s.push('architecture');
  if (e.adressage.length) s.push('adressage');
  if (e.configuration.length) s.push('configuration');
  if (e.validation.length) s.push('validation');
  if (plein(e.acces) || plein(e.rangement) || plein(e.sauvegarde) || plein(e.retourArriere)) s.push('exploitation');
  if (e.incidents.length) s.push('incidents');
  if (e.fiches.length || plein(e.referencesTexte)) s.push('references');
  if (e.captures.some((c) => captures[c.id])) s.push('captures');
  return s;
}
export const TITRES_SECTIONS = {
  objet: 'Objet', environnement: 'Environnement', architecture: 'Architecture', adressage: 'Plan d’adressage', configuration: 'Configuration',
  validation: 'Validation', exploitation: 'Exploitation', incidents: 'Incidents et solutions', references: 'Références', captures: 'Captures',
};

/**
 * Fabrique le PDF. `captures` : id → Uint8Array (JPEG). `titresFiches` : id → titre.
 * Renvoie { octets, pages, sections } (sections : numéro, titre, page).
 */
export function pdfJournal(e, { captures = {}, titresFiches = {}, date = new Date() } = {}) {
  const doc = new DocumentPdf({ titre: `${e.titre} (${e.reference} v${e.version})`, auteur: e.auteur, sujet: `Dossier de labo · ${categorie(e.categorie).label}` });
  const ref = `${e.reference} · v${e.version}`;

  // Page 1 : réservée à la page de garde, dessinée à la fin (le sommaire a besoin des numéros de page).
  doc.nouvellePage();
  const flux = new Flux(doc, { titreCourt: e.titre, reference: ref, classification: e.classification });
  const sections = sectionsPresentes(e, { captures });
  let num = 0;
  // Une section d'images garde son titre avec la première image (pas de titre seul en bas de page).
  const section = (id) => { num += 1; if (id === 'captures') flux.place(400); flux.titreSection(num, TITRES_SECTIONS[id]); return num; };

  for (const id of sections) {
    const n = section(id);
    if (id === 'objet') flux.paragraphe(e.objet);
    if (id === 'environnement') flux.paragraphe(e.environnement);
    if (id === 'architecture') flux.paragraphe(e.architecture);
    if (id === 'adressage') {
      const cols = [
        { id: 'equipement', titre: 'Équipement', part: 1.25 }, { id: 'interface', titre: 'Interface', part: 1, mono: true },
        { id: 'adresse', titre: 'Adresse / préfixe', part: 1.35, mono: true }, { id: 'vlan', titre: 'VLAN / zone', part: 0.85 },
        { id: 'passerelle', titre: 'Passerelle', part: 1.1, mono: true }, { id: 'note', titre: 'Note', part: 1.3 },
      ].filter((c) => e.adressage.some((l) => plein(l[c.id])));
      flux.tableau(cols, e.adressage.map((l) => cols.map((c) => l[c.id] ?? '')));
    }
    if (id === 'configuration') {
      flux.paragraphe('Les commandes ci-dessous sont celles appliquées. Les mots de passe n’y figurent pas : ils se tapent sur l’équipement.', { taille: 8.8, couleur: STYLE.pale });
      e.configuration.forEach((b, k) => flux.code(b.code, { titre: `${n}.${k + 1} ${b.titre || 'Commandes'}` }));
    }
    if (id === 'validation') {
      const ok = e.validation.filter((v) => v.resultat === 'conforme').length;
      flux.paragraphe(`${ok} test(s) conforme(s) sur ${e.validation.length}. « Conforme » est noté par l’auteur après exécution du test.`, { taille: 8.8, couleur: STYLE.pale });
      const couleurs = { conforme: '#1d7a4a', 'non-conforme': '#b3362c', 'a-tester': '#5d6a79' };
      flux.tableau([{ titre: 'Test', part: 2.2 }, { titre: 'Résultat attendu', part: 1.8 }, { titre: 'Résultat', part: 0.9 }],
        e.validation.map((v) => { const r = resultat(v.resultat); return { cellules: [v.test, v.attendu, `${r.symbole} ${r.label}`], styles: [{}, {}, { gras: true, couleur: couleurs[r.id] }] }; }));
    }
    if (id === 'exploitation') {
      const lignes = [['Accès', e.acces], ['Identifiants', e.rangement], ['Sauvegarde', e.sauvegarde], ['Retour arrière', e.retourArriere]].filter(([, v]) => plein(v));
      flux.tableau([{ titre: 'Rubrique', part: 1 }, { titre: 'Consigne', part: 3.6 }], lignes.map(([k, v]) => ({ cellules: [k, v], styles: [{ gras: true }] })), { enteteVisible: false });
    }
    if (id === 'incidents') {
      flux.tableau([{ titre: 'Symptôme', part: 1.4 }, { titre: 'Cause', part: 1.3 }, { titre: 'Solution', part: 1.6 }], e.incidents.map((l) => [l.symptome, l.cause, l.solution]));
    }
    if (id === 'references') {
      if (e.fiches.length) flux.tableau([{ titre: 'Fiche du KJEMO IT Toolkit', part: 3 }, { titre: 'Identifiant', part: 1.6, mono: true }], e.fiches.map((f) => [titresFiches[f] ?? f, f]));
      if (plein(e.referencesTexte)) flux.paragraphe(e.referencesTexte);
    }
    if (id === 'captures') {
      let k = 0;
      for (const c of e.captures) {
        if (!captures[c.id]) continue;
        k += 1;
        flux.image(captures[c.id], `Figure ${k} : ${c.legende || c.nom}`);
      }
    }
  }
  if (!sections.length) { flux.paragraphe('Ce document ne contient encore aucune section remplie.', { couleur: STYLE.pale }); }

  pageDeGarde(doc, e, flux.debutsSections);
  flux.finaliser();
  return { octets: doc.octets({ date }), pages: doc.pages.length, sections: flux.debutsSections.map((s) => ({ ...s, page: s.page + 1 })) };
}

function pageDeGarde(doc, e, debuts) {
  const m = STYLE.marge; const W = A4.largeur - 2 * m; const p = 0;
  doc.texte(p, m, 50, 'Dossier de labo', { taille: 9, couleur: STYLE.pale });
  const cl = e.classification; doc.texte(p, A4.largeur - m - largeur(cl, 'gras', 9), 50, cl, { police: 'gras', taille: 9, couleur: STYLE.accent });
  let y = 150;
  for (const l of couper(e.titre, 'gras', 24, W)) { doc.texte(p, m, y, l, { police: 'gras', taille: 24, couleur: STYLE.accent }); y += 29; }
  doc.rect(p, m, y - 6, 64, 4, { fond: STYLE.accent });
  y += 14;
  doc.texte(p, m, y, `${categorie(e.categorie).label} · dossier de configuration et d’exploitation`, { taille: 11, couleur: STYLE.pale });
  y += 40;

  // Contrôle du document
  const ligneKV = (k, v, yy) => {
    doc.rect(p, m, yy, 150, 20, { fond: STYLE.fondTete, trait: STYLE.filet, epaisseur: 0.5 });
    doc.rect(p, m + 150, yy, W - 150, 20, { trait: STYLE.filet, epaisseur: 0.5 });
    doc.texte(p, m + 6, yy + 13.5, k, { police: 'gras', taille: 9 });
    doc.texte(p, m + 156, yy + 13.5, couper(v, 'normal', 9.5, W - 162)[0] ?? '', { taille: 9.5 });
  };
  doc.texte(p, m, y, 'Contrôle du document', { police: 'gras', taille: 11 }); y += 8;
  const et = etat(e.etat);
  [['Référence', e.reference], ['Version', e.version], ['Date', dateLongue(e.modifieLe)], ['Créé le', dateLongue(e.creeLe)],
    ['Rédigé par', e.auteur || '-'], ['État', `${et.symbole} ${et.label}`], ['Classification', e.classification]]
    .forEach(([k, v]) => { ligneKV(k, v, y); y += 20; });
  y += 22;

  // Historique des révisions (les 8 dernières)
  doc.texte(p, m, y, 'Historique des révisions', { police: 'gras', taille: 11 }); y += 8;
  const cols = [70, 90, W - 160];
  const tete = ['Version', 'Date', 'Modification'];
  let x = m;
  tete.forEach((t, k) => { doc.rect(p, x, y, cols[k], 18, { fond: STYLE.fondTete, trait: STYLE.filet, epaisseur: 0.5 }); doc.texte(p, x + 5, y + 12.5, t, { police: 'gras', taille: 8.8 }); x += cols[k]; });
  y += 18;
  const revs = e.revisions.slice(-8);
  for (const r of revs) {
    const lignes = couper(r.resume, 'normal', 8.8, cols[2] - 10).slice(0, 2);
    const h = 8 + lignes.length * 11.5;
    x = m;
    [[r.version], [r.date], lignes].forEach((cell, k) => {
      doc.rect(p, x, y, cols[k], h, { trait: STYLE.filet, epaisseur: 0.5 });
      cell.forEach((l, j) => doc.texte(p, x + 5, y + 12 + j * 11.5, l, { taille: 8.8 }));
      x += cols[k];
    });
    y += h;
  }
  if (e.revisions.length > 8) { doc.texte(p, m, y + 11, `${e.revisions.length - 8} révision(s) plus ancienne(s) non affichée(s).`, { taille: 8, couleur: STYLE.pale }); y += 14; }
  y += 24;

  // Sommaire
  if (debuts.length) {
    doc.texte(p, m, y, 'Sommaire', { police: 'gras', taille: 11 }); y += 16;
    for (const s of debuts) {
      if (y > A4.hauteur - 90) break;
      const t = `${s.numero}. ${s.titre}`; const pg = String(s.page + 1);
      doc.texte(p, m, y, t, { taille: 9.5 });
      const debut = m + largeur(t, 'normal', 9.5) + 6; const fin = A4.largeur - m - largeur(pg, 'normal', 9.5) - 6;
      if (fin > debut) doc.texte(p, debut, y, '.'.repeat(Math.max(0, Math.floor((fin - debut) / largeur('.', 'normal', 9.5)))), { taille: 9.5, couleur: STYLE.filet });
      doc.texte(p, A4.largeur - m - largeur(pg, 'normal', 9.5), y, pg, { taille: 9.5 });
      y += 15;
    }
  }
}
