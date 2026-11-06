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
import { modele, modeleDefaut, MODELE_PERSO } from './modeles.mjs';

export const FEUILLE = { largeur: 1000, hauteur: 600, pas: 10 };
export const LIMITES = { noeuds: 80, liens: 150, zones: 30, textes: 40, typesPerso: 30 };

const BLEU = '#1f5f99'; const VERT = '#1d7a4a'; const CYAN = '#0a6c8f'; const GRIS = '#5d6a79';
/** Groupes de la palette, comme les catégories de Packet Tracer. */
export const GROUPES_NOEUD = [
  { id: 'reseau', label: 'Réseau' }, { id: 'terminaux', label: 'Terminaux' }, { id: 'serveurs', label: 'Serveurs' },
  { id: 'cloud', label: 'Azure et cloud' }, { id: 'wan', label: 'WAN' }, { id: 'autre', label: 'Autre' },
];
/** Filtre « système » de la palette. */
export const SYSTEMES_PALETTE = [
  { id: 'tous', label: 'Tous' }, { id: 'cisco', label: 'Cisco' }, { id: 'systeme', label: 'Système' }, { id: 'azure', label: 'Azure' },
];
export const TYPES_NOEUD = [
  { id: 'routeur', label: 'Routeur', couleur: BLEU, groupe: 'reseau', systemes: ['cisco'] },
  { id: 'commutateur', label: 'Commutateur d’accès', couleur: BLEU, groupe: 'reseau', systemes: ['cisco'] },
  { id: 'commutateur-l3', label: 'Commutateur de cœur (niveau 3)', couleur: BLEU, groupe: 'reseau', systemes: ['cisco'] },
  { id: 'pare-feu', label: 'Pare-feu', couleur: '#a1440f', groupe: 'reseau', systemes: ['cisco', 'systeme'] },
  { id: 'point-acces', label: 'Point d’accès', couleur: BLEU, groupe: 'reseau', systemes: ['cisco'] },
  { id: 'poste', label: 'Poste', couleur: VERT, groupe: 'terminaux', systemes: ['systeme', 'cisco'] },
  { id: 'portable', label: 'Portable', couleur: VERT, groupe: 'terminaux', systemes: ['systeme'] },
  { id: 'telephone-ip', label: 'Téléphone IP', couleur: VERT, groupe: 'terminaux', systemes: ['cisco', 'systeme'] },
  { id: 'imprimante', label: 'Imprimante', couleur: VERT, groupe: 'terminaux', systemes: ['systeme'] },
  { id: 'smartphone', label: 'Smartphone', couleur: VERT, groupe: 'terminaux', systemes: ['systeme'] },
  { id: 'camera-ip', label: 'Caméra IP', couleur: VERT, groupe: 'terminaux', systemes: ['systeme'] },
  { id: 'serveur', label: 'Serveur', couleur: VERT, groupe: 'serveurs', systemes: ['systeme'] },
  { id: 'nas', label: 'NAS', couleur: VERT, groupe: 'serveurs', systemes: ['systeme'] },
  { id: 'vm', label: 'Machine virtuelle', couleur: CYAN, groupe: 'cloud', systemes: ['azure', 'systeme'] },
  { id: 'reseau-virtuel', label: 'Réseau virtuel', couleur: CYAN, groupe: 'cloud', systemes: ['azure'] },
  { id: 'sous-reseau', label: 'Sous-réseau', couleur: CYAN, groupe: 'cloud', systemes: ['azure'] },
  { id: 'passerelle-vpn', label: 'Passerelle VPN', couleur: CYAN, groupe: 'cloud', systemes: ['azure'] },
  { id: 'service-cloud', label: 'Service cloud', couleur: CYAN, groupe: 'cloud', systemes: ['azure'] },
  { id: 'internet', label: 'Internet', couleur: GRIS, groupe: 'wan', systemes: ['cisco', 'systeme', 'azure'] },
  { id: 'nuage-operateur', label: 'Nuage de l’opérateur', couleur: GRIS, groupe: 'wan', systemes: ['cisco'] },
  { id: 'autre', label: 'Autre', couleur: GRIS, groupe: 'autre', systemes: ['cisco', 'systeme', 'azure'] },
];
/**
 * Types de câbles et de liaisons, comme la palette « Connexions » de Packet
 * Tracer. `aide` dit quand l'utiliser ; le trait (couleur, épaisseur,
 * tirets) permet de les distinguer à l'écran, dans le PDF et sa légende.
 */
export const STYLES_LIEN = [
  { id: 'droit', label: 'Câble droit', court: 'Droit', aide: 'Ethernet entre équipements différents (poste–commutateur, commutateur–routeur).', trait: '#5d6a79', ep: 2.2, tirets: null },
  { id: 'croise', label: 'Câble croisé', court: 'Croisé', aide: 'Ethernet entre équipements semblables (commutateur–commutateur, poste–poste).', trait: '#5d6a79', ep: 2.2, tirets: [4, 4] },
  { id: 'trunk', label: 'Trunk 802.1Q', court: 'Trunk', aide: 'Lien qui transporte plusieurs VLAN (commutateur–routeur ou commutateur–commutateur).', trait: '#2a3b4c', ep: 5, tirets: null },
  { id: 'console', label: 'Câble console', court: 'Console', aide: 'Du poste d’administration au port console de l’équipement.', trait: '#2b8fd6', ep: 2, tirets: [2, 4] },
  { id: 'serie', label: 'Série (WAN)', court: 'Série', aide: 'Liaison série entre deux routeurs (Se0/0/0).', trait: '#c0392b', ep: 2.4, tirets: null },
  { id: 'fibre', label: 'Fibre optique', court: 'Fibre', aide: 'Liaison fibre (ports SFP, Gi ou Te).', trait: '#d98a00', ep: 2.6, tirets: null },
  { id: 'sansfil', label: 'Sans fil', court: 'Wi-Fi', aide: 'Poste ou téléphone relié à un point d’accès.', trait: '#7d8a99', ep: 2, tirets: [1.5, 5] },
  { id: 'vpn', label: 'VPN / logique', court: 'VPN', aide: 'Tunnel ou lien logique (site à site, Azure VPN Gateway).', trait: '#5b3fa8', ep: 2.2, tirets: [10, 6] },
];
export const styleLien = (id) => STYLES_LIEN.find((x) => x.id === id) ?? STYLES_LIEN[0];
/** Anciens noms (avant JOURNAL-LABO-06) : « plein » et « tirets ». */
const ANCIENS_STYLES = { plein: 'droit', tirets: 'vpn' };
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
    // Modèle (ports) : un modèle du catalogue de ce type, « personnalisé » (liste écrite), ou celui proposé par défaut.
    const mod = n.modele === MODELE_PERSO ? MODELE_PERSO : (modele(n.modele)?.type === type ? n.modele : modeleDefaut(type));
    s.noeuds.push({ id: n.id, type, typePerso: type === 'perso' ? n.typePerso : null, nom: texte(n.nom, 60), note: texte(n.note, 80),
      modele: mod, ports: mod === MODELE_PERSO ? texte(n.ports, 300) : '',
      equipementId: /^e[\w]{3,40}$/.test(String(n.equipementId ?? '')) ? n.equipementId : null,
      x: borne(n.x, 40, FEUILLE.largeur - 40), y: borne(n.y, 30, FEUILLE.hauteur - 60) });
  }
  const ids = new Set(s.noeuds.map((n) => n.id));
  for (const l of (Array.isArray(b.liens) ? b.liens : []).filter(unique).slice(0, LIMITES.liens)) {
    if (!ids.has(l.de) || !ids.has(l.a) || l.de === l.a) continue;
    const style = ANCIENS_STYLES[l.style] ?? (STYLES_LIEN.some((x) => x.id === l.style) ? l.style : 'droit');
    s.liens.push({ id: l.id, de: l.de, a: l.a, style,
      etiquette: texte(l.etiquette, 40), etiquetteDe: texte(l.etiquetteDe, 30), etiquetteA: texte(l.etiquetteA, 30),
      adresseDe: texte(l.adresseDe, 50), adresseA: texte(l.adresseA, 50) });
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
  s.liens.forEach((l) => { verifier(`schema.${l.id}`, [l.etiquette, l.etiquetteDe, l.etiquetteA, l.adresseDe, l.adresseA].join('\n')); });
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
  // Plusieurs câbles entre les deux mêmes équipements (EtherChannel, redondance) : tracés côte à côte.
  const paires = new Map();
  for (const l of schema.liens) { const k = [l.de, l.a].sort().join('|'); paires.set(k, [...(paires.get(k) ?? []), l.id]); }
  for (const l of schema.liens) {
    const a0 = noeuds.get(l.de); const b0 = noeuds.get(l.a);
    if (!a0 || !b0) continue;
    const groupe = paires.get([l.de, l.a].sort().join('|')); const rang = groupe.indexOf(l.id) - (groupe.length - 1) / 2;
    const lg0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1; const sens = l.de < l.a ? 1 : -1;
    const dx = rang ? (-(b0.y - a0.y) / lg0) * rang * 12 * sens : 0; const dy = rang ? ((b0.x - a0.x) / lg0) * rang * 12 * sens : 0;
    const a = { x: a0.x + dx, y: a0.y + dy }; const b = { x: b0.x + dx, y: b0.y + dy };
    const sel = selection === l.id;
    const st = styleLien(l.style);
    ops.push({ k: 'ligne', id: l.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, trait: sel ? '#d4462e' : st.trait, ep: st.ep, tirets: st.tirets });
    const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    // Les étiquettes d'interface se placent à distance fixe de l'équipement (au-delà de son nom), sans dépasser le milieu du lien.
    const lg = Math.hypot(b.x - a.x, b.y - a.y) || 1; const bout = Math.min(0.4, 92 / lg);
    if (l.etiquette) { const m = at(0.5); ops.push({ k: 'etiquette', x: m.x, y: m.y, t: l.etiquette, taille: 11, gras: true }); }
    // Interface et adresse de chaque côté : deux lignes l'une sous l'autre.
    const bouts = [[l.etiquetteDe, l.adresseDe, at(bout)], [l.etiquetteA, l.adresseA, at(1 - bout)]];
    for (const [itf, adr, m] of bouts) {
      if (itf && adr) { ops.push({ k: 'etiquette', x: m.x, y: m.y - 7, t: itf, taille: 10, mono: true }); ops.push({ k: 'etiquette', x: m.x, y: m.y + 7, t: adr, taille: 9.5, mono: true, couleur: '#0b4f58' }); }
      else if (itf || adr) ops.push({ k: 'etiquette', x: m.x, y: m.y, t: itf || adr, taille: 10, mono: true, couleur: itf ? undefined : '#0b4f58' });
    }
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
    case 'commutateur-l3':
      R(-32, -18, 64, 36, 5);
      L(-20, -7, 10, -7); F([[12, -7], [6, -11], [6, -3]]); L(10, 3, -20, 3); F([[-22, 3], [-16, -1], [-16, 7]]);
      ops.push({ k: 'texte', x: x + 21, y: y + 13, t: 'L3', taille: 9, gras: true, ancre: 'middle', couleur: c });
      break;
    case 'portable':
      R(-18, -20, 36, 24, 3); F([[-26, 8], [26, 8], [22, 14], [-22, 14]], { fond: '#ffffff', trait: c, ep: 2 });
      break;
    case 'telephone-ip':
      R(-20, -10, 40, 30, 4); R(-24, -20, 48, 10, 5);
      for (const [dx, dy] of [[-10, 0], [0, 0], [10, 0], [-10, 9], [0, 9], [10, 9]]) ops.push({ k: 'cercle', x: x + dx, y: y + dy, r: 2, fond: c, trait: null });
      break;
    case 'imprimante':
      R(-14, -20, 28, 10, 2); R(-24, -10, 48, 20, 4); R(-14, 6, 28, 12, 2);
      L(-9, 12, 9, 12, 1.4);
      break;
    case 'smartphone':
      R(-11, -22, 22, 40, 5); ops.push({ k: 'cercle', x, y: y + 12, r: 2.2, fond: c, trait: null }); L(-6, -17, 6, -17, 1.4);
      break;
    case 'camera-ip':
      R(-22, -12, 34, 20, 4); ops.push({ k: 'cercle', x: x + 4, y: y - 2, r: 6, fond: '#ffffff', trait: c, ep: 2 });
      F([[12, -8], [24, -14], [24, 10], [12, 4]], { fond: '#ffffff', trait: c, ep: 2 }); L(-8, 8, -8, 18); L(-16, 18, 0, 18);
      break;
    case 'nas':
      R(-20, -20, 40, 40, 4); L(-12, -8, 12, -8); L(-12, 2, 12, 2);
      ops.push({ k: 'cercle', x: x + 10, y: y + 13, r: 2, fond: c, trait: null }); ops.push({ k: 'cercle', x: x + 3, y: y + 13, r: 2, fond: c, trait: null });
      break;
    case 'sous-reseau':
      R(-28, -14, 56, 28, 6, { tirets: [4, 3] }); T('/24', 12);
      break;
    case 'passerelle-vpn':
      R(-24, -16, 48, 32, 6); T('VPN', 11);
      break;
    case 'nuage-operateur': {
      const nuage = [[-24, 8], { c: [-34, 8, -34, -8, -22, -8] }, { c: [-22, -20, -4, -24, 2, -14] }, { c: [8, -24, 26, -20, 24, -6] }, { c: [36, -4, 34, 10, 22, 10] }];
      ops.push({ k: 'chemin', pts: nuage.map((p) => (Array.isArray(p) ? [x + p[0], y + p[1]] : { c: p.c.map((v, i) => (i % 2 ? y + v : x + v)) })), fond, trait: c, ep: 2, ferme: true, tirets: [5, 3] });
      T('WAN', 10);
      break;
    }
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

/** Types de câbles utilisés dans le schéma (légende de l'écran et du PDF). */
export function cablesUtilises(schema) {
  const ids = new Set(schema.liens.map((l) => l.style));
  return STYLES_LIEN.filter((x) => ids.has(x.id));
}

/** Description textuelle (texte alternatif, lecteurs d'écran, sommaire du PDF). */
export function decrireSchema(schema, { resoudre = () => null, typesPerso = [] } = {}) {
  const persos = new Map(typesPerso.map((t) => [t.id, t]));
  const nom = (n) => { const eq = n.equipementId ? resoudre(n.equipementId) : null; return eq?.nom || n.nom || (n.type === 'perso' ? persos.get(n.typePerso)?.nom : typeNoeud(n.type).label) || 'équipement'; };
  const parId = new Map(schema.noeuds.map((n) => [n.id, n]));
  const morceaux = [];
  if (schema.noeuds.length) morceaux.push(`${schema.noeuds.length} équipement(s) : ${schema.noeuds.map(nom).join(', ')}.`);
  const cote = (n, itf, adr) => `${nom(n)}${itf ? ` ${itf}` : ''}${adr ? ` ${adr}` : ''}`;
  if (schema.liens.length) morceaux.push(`Liens : ${schema.liens.map((l) => `${cote(parId.get(l.de), l.etiquetteDe, l.adresseDe)} – ${cote(parId.get(l.a), l.etiquetteA, l.adresseA)} (${styleLien(l.style).label}${l.etiquette ? `, ${l.etiquette}` : ''})`).join(' ; ')}.`);
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
  // Modèle du routeur deviné d'après le nom de son interface (Gi0/0 : 2911, Gi0/0/0 : 4321).
  const modeleRouteur = /\d+\/\d+\/\d+$/.test(String(v.routeurItf ?? '')) ? '4321' : '2911';
  if (v.hoteRouteur) s.noeuds.push({ id: rt, type: 'routeur', modele: modeleRouteur, nom: v.hoteRouteur, note: '', equipementId: ids.routeur ?? null, typePerso: null, x: 500, y: 40 });
  if (v.hoteSw) s.noeuds.push({ id: sw, type: 'commutateur', modele: '2960-24tt', nom: v.hoteSw, note: '', equipementId: ids.commutateur ?? null, typePerso: null, x: 500, y: 300 });
  if (v.hoteRouteur && v.hoteSw) s.liens.push({ id: idSchema('l'), de: rt, a: sw, style: 'trunk', etiquette: '802.1Q', etiquetteDe: v.routeurItf ?? '', etiquetteA: v.trunkSw ?? '', adresseDe: '', adresseA: '' });
  const vlans = [];
  if (v.vlanGestion) vlans.push({ vlan: v.vlanGestion, nom: 'GESTION', ports: v.portGestion ?? '', poste: v.gestionPoste ?? '', prefixe: v.gestionPrefixe ?? '', posteNom: 'Poste de gestion' });
  for (const l of plan) vlans.push({ vlan: l.vlan, nom: l.nom ?? '', ports: l.ports ?? '', poste: l.poste ?? '', prefixe: l.prefixe ?? '', posteNom: `PC ${l.nom ?? l.vlan}` });
  const n = Math.max(1, vlans.length); const marge = 20; const largeurZone = Math.min(300, Math.floor((FEUILLE.largeur - marge * (n + 1)) / n));
  const total = n * largeurZone + (n - 1) * marge; let x = Math.round((FEUILLE.largeur - total) / 2);
  const couleurs = ['vert', 'bleu', 'orange', 'violet', 'gris'];
  vlans.slice(0, 8).forEach((z, i) => {
    s.zones.push({ id: idSchema('z'), nom: `VLAN ${z.vlan} · ${z.nom}`.slice(0, 60), couleur: i === 0 && v.vlanGestion ? 'vert' : couleurs[(i % 4) + 1], x, y: 375, l: largeurZone, h: 215 });
    const pc = idSchema('n');
    s.noeuds.push({ id: pc, type: 'poste', modele: 'pc', nom: z.posteNom.slice(0, 60), note: '', equipementId: null, typePerso: null, x: x + Math.round(largeurZone / 2), y: 480 });
    // Le port du commutateur côté commutateur, l'adresse du poste côté poste.
    if (v.hoteSw) s.liens.push({ id: idSchema('l'), de: sw, a: pc, style: 'droit', etiquette: '', etiquetteDe: String(z.ports).split(/[,\s]+/)[0] ?? '', etiquetteA: '', adresseDe: '', adresseA: z.poste ? `${z.poste}${z.prefixe ? `/${z.prefixe}` : ''}` : '' });
    x += largeurZone + marge;
  });
  return normaliserSchema(s).schema;
}
