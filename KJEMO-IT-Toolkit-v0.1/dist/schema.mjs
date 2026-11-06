/**
 * schema.mjs — JOURNAL-LABO-05 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Schéma d'architecture d'un labo, « façon Packet Tracer » mais pour
 * DOCUMENTER (rien ne s'exécute) : des équipements posés sur une feuille de
 * 1000 × 600 unités, reliés par des liens (plein, tirets, trunk) avec leurs
 * étiquettes d'interface, regroupés dans des zones (VLAN, site, réseau Azure),
 * annotés de textes. Un équipement du schéma peut être une fiche de
 * l'inventaire : son nom et son adresse viennent alors de l'inventaire.
 * Des types personnels (caméra, NAS, téléphone IP…) s'ajoutent à la palette.
 *
 * Un seul dessin, deux sorties : `dessinerSchema` produit une liste
 * d'opérations (rectangles, cercles, tracés, textes) que `versSvg` (écran,
 * fichier SVG) et `versPdf` (dossier PDF, vectoriel) traduisent. Module PUR.
 */
import { secretDans, nouvelId } from './journal.mjs';
import { largeur, versWinAnsi } from './pdf-a4.mjs';

export const FEUILLE = { largeur: 1000, hauteur: 600, pas: 10 };
export const LIMITES = { noeuds: 80, liens: 150, zones: 30, textes: 40, typesPerso: 30 };

const BLEU = '#1f5f99'; const VERT = '#1d7a4a'; const CYAN = '#0a6c8f'; const GRIS = '#5d6a79';
export const TYPES_NOEUD = [
  { id: 'routeur', label: 'Routeur', couleur: BLEU },
  { id: 'commutateur', label: 'Commutateur', couleur: BLEU },
  { id: 'pare-feu', label: 'Pare-feu', couleur: '#a1440f' },
  { id: 'point-acces', label: 'Point d’accès', couleur: BLEU },
  { id: 'serveur', label: 'Serveur', couleur: VERT },
  { id: 'poste', label: 'Poste client', couleur: VERT },
  { id: 'vm', label: 'Machine virtuelle', couleur: CYAN },
  { id: 'reseau-virtuel', label: 'Réseau virtuel', couleur: CYAN },
  { id: 'service-cloud', label: 'Service cloud', couleur: CYAN },
  { id: 'internet', label: 'Internet', couleur: GRIS },
  { id: 'autre', label: 'Autre', couleur: GRIS },
];
export const STYLES_LIEN = [
  { id: 'plein', label: 'Câble' }, { id: 'trunk', label: 'Trunk (épais)' }, { id: 'tirets', label: 'Tirets (VPN, sans fil, logique)' },
];
export const COULEURS_ZONE = [
  { id: 'bleu', label: 'Bleu', trait: '#1f5f99', fond: '#eaf2fa' }, { id: 'vert', label: 'Vert', trait: '#1d7a4a', fond: '#e8f5ee' },
  { id: 'orange', label: 'Orange', trait: '#a1440f', fond: '#fbefe6' }, { id: 'violet', label: 'Violet', trait: '#5b3fa8', fond: '#f0ecfa' },
  { id: 'gris', label: 'Gris', trait: '#5d6a79', fond: '#f1f3f5' },
];
export const typeNoeud = (id) => TYPES_NOEUD.find((t) => t.id === id) ?? TYPES_NOEUD.at(-1);
const couleurZone = (id) => COULEURS_ZONE.find((c) => c.id === id) ?? COULEURS_ZONE[0];

/** Type d'équipement de l'inventaire → type de nœud (mêmes identifiants, sauf exceptions). */
export function typeDepuisEquipement(typeEquipement) {
  return TYPES_NOEUD.some((t) => t.id === typeEquipement) ? typeEquipement : 'autre';
}

export const schemaVide = () => ({ noeuds: [], liens: [], zones: [], textes: [] });
export const idSchema = (p) => `${p}${nouvelId().slice(1, 14)}`;
const borne = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
const texte = (v, max) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, max).trim();
const ID = /^[a-z][\w]{2,40}$/;

/**
 * Valide un schéma brut. Renvoie { schema, erreurs } : les éléments mal formés
 * sont écartés, les liens vers un nœud absent aussi, les coordonnées bornées à
 * la feuille ; un texte qui contient un mot de passe est une erreur.
 */
export function normaliserSchema(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const erreurs = {};
  const s = schemaVide();
  const vus = new Set();
  const unique = (x) => x && ID.test(String(x.id ?? '')) && !vus.has(x.id) && vus.add(x.id);
  for (const n of (Array.isArray(b.noeuds) ? b.noeuds : []).filter(unique).slice(0, LIMITES.noeuds)) {
    // Un type personnel garde sa référence même si sa définition manque (il s'affiche alors « ? »).
    const type = n.type === 'perso' && /^t[\w]{3,40}$/.test(String(n.typePerso ?? '')) ? 'perso' : typeNoeud(n.type).id;
    s.noeuds.push({ id: n.id, type, typePerso: type === 'perso' ? n.typePerso : null, nom: texte(n.nom, 60), note: texte(n.note, 80),
      equipementId: /^e[\w]{3,40}$/.test(String(n.equipementId ?? '')) ? n.equipementId : null,
      x: borne(n.x, 40, FEUILLE.largeur - 40), y: borne(n.y, 30, FEUILLE.hauteur - 60) });
  }
  const ids = new Set(s.noeuds.map((n) => n.id));
  for (const l of (Array.isArray(b.liens) ? b.liens : []).filter(unique).slice(0, LIMITES.liens)) {
    if (!ids.has(l.de) || !ids.has(l.a) || l.de === l.a) continue;
    s.liens.push({ id: l.id, de: l.de, a: l.a, style: STYLES_LIEN.some((x) => x.id === l.style) ? l.style : 'plein',
      etiquette: texte(l.etiquette, 40), etiquetteDe: texte(l.etiquetteDe, 30), etiquetteA: texte(l.etiquetteA, 30) });
  }
  for (const z of (Array.isArray(b.zones) ? b.zones : []).filter(unique).slice(0, LIMITES.zones)) {
    const x = borne(z.x, 0, FEUILLE.largeur - 60); const y = borne(z.y, 0, FEUILLE.hauteur - 40);
    s.zones.push({ id: z.id, nom: texte(z.nom, 60), couleur: couleurZone(z.couleur).id, x, y,
      l: borne(z.l, 60, FEUILLE.largeur - x), h: borne(z.h, 40, FEUILLE.hauteur - y) });
  }
  for (const t of (Array.isArray(b.textes) ? b.textes : []).filter(unique).slice(0, LIMITES.textes)) {
    const v = texte(t.texte, 120);
    if (!v) continue;
    s.textes.push({ id: t.id, texte: v, x: borne(t.x, 0, FEUILLE.largeur - 20), y: borne(t.y, 14, FEUILLE.hauteur - 4) });
  }
  const verifier = (cle, v) => { const x = secretDans(v); if (x) erreurs[cle] = `Le schéma contient ${x.quoi} : remplace la valeur par ***.`; };
  s.noeuds.forEach((n) => { verifier(`schema.${n.id}.nom`, n.nom); verifier(`schema.${n.id}.note`, n.note); });
  s.liens.forEach((l) => { verifier(`schema.${l.id}`, `${l.etiquette} ${l.etiquetteDe} ${l.etiquetteA}`); });
  s.zones.forEach((z) => verifier(`schema.${z.id}`, z.nom));
  s.textes.forEach((t) => verifier(`schema.${t.id}`, t.texte));
  return { schema: s, erreurs };
}

/** Types personnels : { id, nom, code } (code : 1 à 4 caractères affichés dans le symbole). */
export function normaliserTypesPerso(brut) {
  const vus = new Set(); const out = [];
  for (const t of Array.isArray(brut) ? brut : []) {
    if (!t || !/^t[\w]{3,40}$/.test(String(t.id ?? '')) || vus.has(t.id)) continue;
    const nom = texte(t.nom, 40); const code = texte(t.code, 4).toUpperCase();
    if (!nom || !code) continue;
    vus.add(t.id); out.push({ id: t.id, nom, code });
    if (out.length >= LIMITES.typesPerso) break;
  }
  return out;
}

export const schemaEstVide = (s) => !s || (!s.noeuds?.length && !s.zones?.length && !s.textes?.length);

/** Position aimantée au pas de la grille. */
export const aimanter = (v) => Math.round(v / FEUILLE.pas) * FEUILLE.pas;

/* ===========================================================================
 * Dessin : une liste d'opérations, indépendante de la sortie.
 * ======================================================================== */
/**
 * `resoudre(equipementId)` → équipement de l'inventaire (ou null).
 * `typesPerso` : types personnels. `selection` : id de l'élément mis en évidence (écran).
 * Renvoie une liste d'opérations en unités de feuille.
 */
export function dessinerSchema(schema, { resoudre = () => null, typesPerso = [], selection = null } = {}) {
  const ops = [];
  const persos = new Map(typesPerso.map((t) => [t.id, t]));
  // Zones d'abord (en dessous).
  for (const z of schema.zones) {
    const c = couleurZone(z.couleur);
    ops.push({ k: 'rect', id: z.id, x: z.x, y: z.y, w: z.l, h: z.h, r: 12, fond: c.fond, trait: c.trait, ep: 1.6, tirets: [8, 5] });
    if (z.nom) ops.push({ k: 'texte', x: z.x + 10, y: z.y + 18, t: z.nom, taille: 12, gras: true, couleur: c.trait });
    if (selection === z.id) ops.push({ k: 'rect', x: z.x - 4, y: z.y - 4, w: z.l + 8, h: z.h + 8, r: 14, trait: '#d4462e', ep: 2, tirets: [5, 4], selection: true });
  }
  const noeuds = new Map(schema.noeuds.map((n) => [n.id, n]));
  // Liens ensuite (sous les équipements).
  for (const l of schema.liens) {
    const a = noeuds.get(l.de); const b = noeuds.get(l.a);
    if (!a || !b) continue;
    const sel = selection === l.id;
    ops.push({ k: 'ligne', id: l.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, trait: sel ? '#d4462e' : (l.style === 'trunk' ? '#2a3b4c' : '#6b7785'),
      ep: l.style === 'trunk' ? 5 : 2.2, tirets: l.style === 'tirets' ? [9, 6] : null });
    const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    // Les étiquettes d'interface se placent à distance fixe de l'équipement (au-delà de son nom), sans dépasser le milieu du lien.
    const lg = Math.hypot(b.x - a.x, b.y - a.y) || 1; const bout = Math.min(0.4, 92 / lg);
    if (l.etiquette) { const m = at(0.5); ops.push({ k: 'etiquette', x: m.x, y: m.y, t: l.etiquette, taille: 11, gras: true }); }
    if (l.etiquetteDe) { const m = at(bout); ops.push({ k: 'etiquette', x: m.x, y: m.y, t: l.etiquetteDe, taille: 10, mono: true }); }
    if (l.etiquetteA) { const m = at(1 - bout); ops.push({ k: 'etiquette', x: m.x, y: m.y, t: l.etiquetteA, taille: 10, mono: true }); }
  }
  for (const n of schema.noeuds) {
    const eq = n.equipementId ? resoudre(n.equipementId) : null;
    const type = n.type === 'perso' ? null : typeNoeud(n.type);
    const perso = n.type === 'perso' ? persos.get(n.typePerso) : null;
    const couleur = type?.couleur ?? GRIS;
    icone(ops, n.type === 'perso' ? 'perso' : n.type, n.x, n.y, couleur, perso?.code ?? '');
    const nom = eq?.nom || n.nom || (perso ? perso.nom : type?.label ?? '');
    const sous = eq?.adresse || n.note;
    ops.push({ k: 'texte', x: n.x, y: n.y + 40, t: nom, taille: 13, gras: true, ancre: 'middle', couleur: '#1c2530', fondTexte: true });
    if (sous) ops.push({ k: 'texte', x: n.x, y: n.y + 54, t: sous, taille: 10.5, mono: true, ancre: 'middle', couleur: '#4b5866', fondTexte: true });
    if (selection === n.id) ops.push({ k: 'rect', x: n.x - 42, y: n.y - 32, w: 84, h: 92, r: 8, trait: '#d4462e', ep: 2, tirets: [5, 4], selection: true });
    ops.push({ k: 'clic', id: n.id, x: n.x - 40, y: n.y - 28, w: 80, h: 86 });
  }
  for (const t of schema.textes) {
    ops.push({ k: 'texte', id: t.id, x: t.x, y: t.y, t: t.texte, taille: 12, couleur: '#1c2530' });
    if (selection === t.id) ops.push({ k: 'rect', x: t.x - 4, y: t.y - 16, w: Math.min(FEUILLE.largeur - t.x, t.texte.length * 6.6 + 8), h: 22, r: 4, trait: '#d4462e', ep: 2, tirets: [5, 4], selection: true });
  }
  return ops;
}

/** Symbole d'un équipement, centré sur (x, y), dans environ 64 × 44. */
function icone(ops, type, x, y, c, code) {
  const fond = '#ffffff';
  const R = (dx, dy, w, h, r = 4, extra = {}) => ops.push({ k: 'rect', x: x + dx, y: y + dy, w, h, r, fond, trait: c, ep: 2, ...extra });
  const L = (x1, y1, x2, y2, ep = 2) => ops.push({ k: 'ligne', x1: x + x1, y1: y + y1, x2: x + x2, y2: y + y2, trait: c, ep });
  const F = (pts, extra = {}) => ops.push({ k: 'chemin', pts: pts.map(([a, b]) => [x + a, y + b]), fond: c, ferme: true, ...extra });
  const T = (t, taille = 11) => ops.push({ k: 'texte', x, y: y + taille * 0.36, t, taille, gras: true, ancre: 'middle', couleur: c });
  switch (type) {
    case 'routeur':
      ops.push({ k: 'cercle', x, y, r: 22, fond, trait: c, ep: 2 });
      L(-12, -12, 12, 12); L(-12, 12, 12, -12);
      F([[12, 12], [5, 11], [11, 5]]); F([[-12, -12], [-5, -11], [-11, -5]]); F([[12, -12], [11, -5], [5, -11]]); F([[-12, 12], [-11, 5], [-5, 11]]);
      break;
    case 'commutateur':
      R(-30, -16, 60, 32, 5);
      L(-18, -5, 16, -5); F([[18, -5], [12, -9], [12, -1]]); L(18, 5, -16, 5); F([[-18, 5], [-12, 1], [-12, 9]]);
      break;
    case 'pare-feu':
      R(-26, -18, 52, 36, 2);
      L(-26, -6, 26, -6, 1.4); L(-26, 6, 26, 6, 1.4); L(-8, -18, -8, -6, 1.4); L(10, -18, 10, -6, 1.4); L(0, -6, 0, 6, 1.4); L(-16, 6, -16, 18, 1.4); L(16, 6, 16, 18, 1.4);
      break;
    case 'point-acces':
      R(-20, -2, 40, 18, 5); L(-8, -2, -14, -18); L(8, -2, 14, -18);
      ops.push({ k: 'cercle', x, y: y + 7, r: 2.6, fond: c, trait: null });
      break;
    case 'serveur':
      R(-16, -22, 32, 44, 3); L(-9, -12, 9, -12); L(-9, -2, 9, -2); L(-9, 8, 9, 8);
      ops.push({ k: 'cercle', x: x + 9, y: y + 16, r: 2, fond: c, trait: null });
      break;
    case 'poste':
      R(-22, -20, 44, 28, 3); L(0, 8, 0, 15); L(-11, 16, 11, 16, 2.4);
      break;
    case 'vm':
      R(-24, -18, 48, 36, 5, { tirets: [5, 3] }); T('VM', 12);
      break;
    case 'reseau-virtuel':
      R(-28, -16, 56, 32, 14); T('< >', 13);
      break;
    case 'service-cloud': case 'internet': {
      const nuage = [[-24, 8], { c: [-34, 8, -34, -8, -22, -8] }, { c: [-22, -20, -4, -24, 2, -14] }, { c: [8, -24, 26, -20, 24, -6] }, { c: [36, -4, 34, 10, 22, 10] }];
      ops.push({ k: 'chemin', pts: nuage.map((p) => (Array.isArray(p) ? [x + p[0], y + p[1]] : { c: p.c.map((v, i) => (i % 2 ? y + v : x + v)) })), fond, trait: c, ep: 2, ferme: true });
      if (type === 'internet') T('WWW', 10);
      break;
    }
    case 'perso':
      R(-24, -18, 48, 36, 8); T(code || '?', code.length > 3 ? 10 : 12);
      break;
    default:
      R(-24, -18, 48, 36, 8); T('?', 14);
  }
}

/* ===========================================================================
 * Sorties
 * ======================================================================== */
const escXml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const POLICE_SVG = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO_SVG = 'ui-monospace,Consolas,monospace';

/** Largeur approchée d'un texte en unités de feuille (même mesure que le PDF). */
const largeurTexte = (t, taille, gras, mono) => largeur(t, mono ? 'mono' : (gras ? 'gras' : 'normal'), taille);

/**
 * SVG autonome (fichier, écran). `interactif` ajoute les attributs data-* qui
 * permettent à l'éditeur de savoir sur quoi on clique ; `grille` dessine le fond quadrillé.
 */
export function versSvg(ops, { titre = 'Schéma d’architecture', description = '', interactif = false, grille = false } = {}) {
  const W = FEUILLE.largeur; const H = FEUILLE.hauteur;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="schema-titre schema-desc"${interactif ? ' class="schema-svg"' : ''}>`);
  out.push(`<title id="schema-titre">${escXml(titre)}</title><desc id="schema-desc">${escXml(description)}</desc>`);
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"${interactif ? ' data-fond="1"' : ''}/>`);
  if (grille) {
    out.push('<defs><pattern id="schema-grille" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d5dbe2"/></pattern></defs>');
    out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#schema-grille)" pointer-events="none"/>`);
  }
  const attr = (o) => (interactif && o.id ? ` data-el="${escXml(o.id)}"` : '');
  for (const o of ops) {
    const trait = o.trait ? ` stroke="${o.trait}" stroke-width="${o.ep ?? 1}"` : ' stroke="none"';
    const tirets = o.tirets ? ` stroke-dasharray="${o.tirets.join(' ')}"` : '';
    const sel = o.selection ? ' pointer-events="none"' : '';
    if (o.k === 'clic') { if (interactif) out.push(`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="transparent" data-el="${escXml(o.id)}" class="sch-cible"/>`); continue; }
    if (o.k === 'rect') out.push(`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.r ?? 0}" fill="${o.fond ?? 'none'}"${trait}${tirets}${attr(o)}${sel}/>`);
    else if (o.k === 'cercle') out.push(`<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="${o.fond ?? 'none'}"${trait}/>`);
    else if (o.k === 'ligne') {
      if (interactif && o.id) out.push(`<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="transparent" stroke-width="16" data-el="${escXml(o.id)}"/>`);
      out.push(`<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke-linecap="round"${trait}${tirets}${interactif && o.id ? ' pointer-events="none"' : ''}/>`);
    } else if (o.k === 'chemin') {
      const d = o.pts.map((p, i) => (Array.isArray(p) ? `${i ? 'L' : 'M'}${p[0]} ${p[1]}` : `C${p.c.join(' ')}`)).join(' ') + (o.ferme ? ' Z' : '');
      out.push(`<path d="${d}" fill="${o.fond ?? 'none'}"${trait}${tirets}/>`);
    } else if (o.k === 'texte' || o.k === 'etiquette') {
      const police = o.mono ? MONO_SVG : POLICE_SVG; const poids = o.gras ? ' font-weight="700"' : '';
      if (o.k === 'etiquette' || o.fondTexte) {
        const w = largeurTexte(o.t, o.taille, o.gras, o.mono) + 8; const yb = o.k === 'etiquette' ? o.y + o.taille * 0.35 : o.y;
        out.push(`<rect x="${o.x - w / 2}" y="${yb - o.taille + 1}" width="${w}" height="${o.taille + 5}" rx="3" fill="#ffffff" fill-opacity="${o.k === 'etiquette' ? 0.95 : 0.85}" pointer-events="none"/>`);
        out.push(`<text x="${o.x}" y="${yb}" text-anchor="middle" font-family="${police}" font-size="${o.taille}"${poids} fill="${o.couleur ?? '#2a3b4c'}" pointer-events="none">${escXml(o.t)}</text>`);
      } else {
        out.push(`<text x="${o.x}" y="${o.y}"${o.ancre === 'middle' ? ' text-anchor="middle"' : ''} font-family="${police}" font-size="${o.taille}"${poids} fill="${o.couleur ?? '#1c2530'}"${attr(o)}${interactif && !o.id ? ' pointer-events="none"' : ''}>${escXml(o.t)}</text>`);
      }
    }
  }
  out.push('</svg>');
  return out.join('');
}

/**
 * Trace les opérations dans une page PDF, mises à l'échelle dans le cadre
 * (x, y, w, h) en gardant les proportions de la feuille. Les éléments de
 * sélection (écran) sont ignorés.
 */
export function versPdf(doc, page, x0, y0, w, h, ops) {
  const k = Math.min(w / FEUILLE.largeur, h / FEUILLE.hauteur);
  const ox = x0 + (w - FEUILLE.largeur * k) / 2; const oy = y0 + (h - FEUILLE.hauteur * k) / 2;
  const X = (v) => ox + v * k; const Y = (v) => oy + v * k;
  doc.rect(page, ox, oy, FEUILLE.largeur * k, FEUILLE.hauteur * k, { trait: '#cfd6de', epaisseur: 0.5 });
  for (const o of ops) {
    if (o.selection || o.k === 'clic') continue;
    const st = { fond: o.fond ?? null, trait: o.trait ?? null, epaisseur: (o.ep ?? 1) * k, tirets: o.tirets ? o.tirets.map((v) => v * k) : null };
    if (o.k === 'rect') {
      if (o.r) doc.rectArrondi(page, X(o.x), Y(o.y), o.w * k, o.h * k, Math.min(o.r * k, (o.w * k) / 2, (o.h * k) / 2), st);
      else doc.chemin(page, [[X(o.x), Y(o.y)], [X(o.x + o.w), Y(o.y)], [X(o.x + o.w), Y(o.y + o.h)], [X(o.x), Y(o.y + o.h)]], { ...st, ferme: true });
    } else if (o.k === 'cercle') doc.cercle(page, X(o.x), Y(o.y), o.r * k, st);
    else if (o.k === 'ligne') doc.chemin(page, [[X(o.x1), Y(o.y1)], [X(o.x2), Y(o.y2)]], { ...st, fond: null, arrondi: true });
    else if (o.k === 'chemin') doc.chemin(page, o.pts.map((p) => (Array.isArray(p) ? [X(p[0]), Y(p[1])] : { c: p.c.map((v, i) => (i % 2 ? Y(v) : X(v))) })), { ...st, ferme: o.ferme });
    else if (o.k === 'texte' || o.k === 'etiquette') {
      const police = o.mono ? 'mono' : (o.gras ? 'gras' : 'normal');
      const taille = o.taille * k; const t = versWinAnsi(o.t);
      const wt = largeur(t, police, taille);
      const yb = o.k === 'etiquette' ? Y(o.y) + taille * 0.35 : Y(o.y);
      const xg = o.k === 'etiquette' || o.ancre === 'middle' ? X(o.x) - wt / 2 : X(o.x);
      if (o.k === 'etiquette' || o.fondTexte) doc.rect(page, xg - 4 * k, yb - taille + k, wt + 8 * k, taille + 5 * k, { fond: '#ffffff' });
      doc.texte(page, xg, yb, t, { police, taille, couleur: o.couleur ?? '#2a3b4c' });
    }
  }
}

/** Description textuelle (texte alternatif, lecteurs d'écran, sommaire du PDF). */
export function decrireSchema(schema, { resoudre = () => null, typesPerso = [] } = {}) {
  const persos = new Map(typesPerso.map((t) => [t.id, t]));
  const nom = (n) => { const eq = n.equipementId ? resoudre(n.equipementId) : null; return eq?.nom || n.nom || (n.type === 'perso' ? persos.get(n.typePerso)?.nom : typeNoeud(n.type).label) || 'équipement'; };
  const parId = new Map(schema.noeuds.map((n) => [n.id, n]));
  const morceaux = [];
  if (schema.noeuds.length) morceaux.push(`${schema.noeuds.length} équipement(s) : ${schema.noeuds.map(nom).join(', ')}.`);
  if (schema.liens.length) morceaux.push(`Liens : ${schema.liens.map((l) => `${nom(parId.get(l.de))} – ${nom(parId.get(l.a))}${l.etiquette ? ` (${l.etiquette})` : ''}`).join(' ; ')}.`);
  if (schema.zones.length) morceaux.push(`Zones : ${schema.zones.map((z) => z.nom || 'sans nom').join(', ')}.`);
  return morceaux.join(' ') || 'Schéma vide.';
}

/**
 * Schéma proposé par la fiche du TP VLAN : le routeur en haut, le commutateur
 * au milieu (trunk entre les deux), une zone par VLAN avec son poste.
 * `ids` : { commutateur, routeur } = identifiants des équipements de l'inventaire.
 */
export function schemaDepuisFiche(valeurs = {}, ids = {}) {
  const v = valeurs; const s = schemaVide();
  if (!v.hoteSw && !v.hoteRouteur) return s;
  const plan = Array.isArray(v.plan) ? v.plan : [];
  const rt = idSchema('n'); const sw = idSchema('n');
  if (v.hoteRouteur) s.noeuds.push({ id: rt, type: 'routeur', nom: v.hoteRouteur, note: '', equipementId: ids.routeur ?? null, typePerso: null, x: 500, y: 60 });
  if (v.hoteSw) s.noeuds.push({ id: sw, type: 'commutateur', nom: v.hoteSw, note: '', equipementId: ids.commutateur ?? null, typePerso: null, x: 500, y: 280 });
  if (v.hoteRouteur && v.hoteSw) s.liens.push({ id: idSchema('l'), de: rt, a: sw, style: 'trunk', etiquette: '802.1Q', etiquetteDe: v.routeurItf ?? '', etiquetteA: v.trunkSw ?? '' });
  const vlans = [];
  if (v.vlanGestion) vlans.push({ vlan: v.vlanGestion, nom: 'GESTION', reseau: v.gestionPasserelle ? '' : '', ports: v.portGestion ?? '', poste: v.gestionPoste ?? '', couleur: 'vert', posteNom: 'Poste de gestion' });
  for (const l of plan) vlans.push({ vlan: l.vlan, nom: l.nom ?? '', reseau: l.reseau ? `${l.reseau}/${l.prefixe ?? ''}` : '', ports: l.ports ?? '', poste: l.poste ?? '', couleur: 'bleu', posteNom: `PC ${l.nom ?? l.vlan}` });
  const n = Math.max(1, vlans.length); const marge = 20; const largeurZone = Math.min(300, Math.floor((FEUILLE.largeur - marge * (n + 1)) / n));
  const total = n * largeurZone + (n - 1) * marge; let x = Math.round((FEUILLE.largeur - total) / 2);
  const couleurs = ['vert', 'bleu', 'orange', 'violet', 'gris'];
  vlans.slice(0, 8).forEach((z, i) => {
    s.zones.push({ id: idSchema('z'), nom: `VLAN ${z.vlan} · ${z.nom}`.slice(0, 60), couleur: i === 0 && v.vlanGestion ? 'vert' : couleurs[(i % 4) + 1], x, y: 375, l: largeurZone, h: 215 });
    const pc = idSchema('n');
    s.noeuds.push({ id: pc, type: 'poste', nom: z.posteNom.slice(0, 60), note: z.poste, equipementId: null, typePerso: null, x: x + Math.round(largeurZone / 2), y: 480 });
    if (v.hoteSw) s.liens.push({ id: idSchema('l'), de: sw, a: pc, style: 'plein', etiquette: '', etiquetteDe: '', etiquetteA: String(z.ports).split(/[,\s]+/)[0] ?? '' });
    x += largeurZone + marge;
  });
  return normaliserSchema(s).schema;
}
