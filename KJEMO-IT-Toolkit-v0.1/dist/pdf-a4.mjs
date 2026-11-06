/**
 * pdf-a4.mjs — JOURNAL-LABO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Petit moteur PDF A4 écrit pour le Toolkit : AUCUNE dépendance, AUCUN réseau,
 * module PUR (ni DOM ni stockage). Le fichier est fabriqué dans le navigateur
 * et téléchargé : il ne quitte jamais l'ordinateur.
 *
 * Ce qu'il sait faire : texte (Helvetica, Helvetica gras, Courier) en
 * WinAnsiEncoding (français complet), rectangles, traits, images JPEG,
 * métadonnées (titre, auteur), et une mise en page en flux (titres, paragraphes,
 * tableaux coupés entre les pages avec en-tête répété, blocs de code, images
 * légendées), puis en-tête et pied de page « Page X / N ».
 * Les caractères hors WinAnsi sont remplacés par un équivalent lisible
 * (→ devient ->, ✔ devient OK…), jamais par un carré vide.
 */

/** Largeurs des glyphes (1/1000 em) par code WinAnsi, tirées des AFM Adobe. Courier : 600 partout. */
const L_HELV = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const L_HELV_GRAS = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

export const A4 = { largeur: 595.28, hauteur: 841.89 };

const EXTRA_WINANSI = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
/** Substituts lisibles pour les caractères que les polices standard n'ont pas. */
const SUBSTITUTS = {
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '↳': '->', '✔': 'OK', '✓': 'OK', '✖': 'X', '✗': 'X', '⚠': '(!)', '■': '#', '□': '[ ]',
  '≥': '>=', '≤': '<=', '≠': '!=', '…': '…', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '‑': '-', '−': '-', ' ': ' ',
  '★': '*', '☆': '*', '⌂': '', '⏎': '', '\t': '    ',
};

/** Code WinAnsi d'un caractère, ou null s'il n'existe pas dans ce jeu. */
function codeWinAnsi(ch) {
  const c = ch.codePointAt(0);
  if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255)) return c;
  return EXTRA_WINANSI[ch] ?? null;
}

/** Texte → texte représentable en WinAnsi (accents gardés, substituts sinon). */
export function versWinAnsi(texte) {
  let s = '';
  for (const ch of String(texte ?? '').normalize('NFC')) {
    if (ch === '\n') { s += '\n'; continue; }
    if (codeWinAnsi(ch) !== null) { s += ch; continue; }
    if (ch in SUBSTITUTS) { s += SUBSTITUTS[ch]; continue; }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base && [...base].every((b) => codeWinAnsi(b) !== null)) { s += base; continue; }
    if (/\p{Extended_Pictographic}|[​-‏️]/u.test(ch)) continue;
    s += '?';
  }
  return s;
}

export const POLICES = { normal: 'F1', gras: 'F2', mono: 'F3' };

/** Largeur en points d'un texte (déjà converti ou non) dans une police et une taille. */
export function largeur(texte, police = 'normal', taille = 10) {
  const t = versWinAnsi(texte);
  if (police === 'mono') return t.length * 0.6 * taille;
  const tab = police === 'gras' ? L_HELV_GRAS : L_HELV;
  let w = 0;
  for (const ch of t) w += tab[codeWinAnsi(ch) ?? 63] || 556;
  return (w / 1000) * taille;
}

/**
 * Coupe un texte en lignes qui tiennent dans `max` points. Les retours à la
 * ligne sont gardés ; un mot trop long (adresse, commande) est coupé net.
 */
export function couper(texte, police, taille, max) {
  const lignes = [];
  for (const para of versWinAnsi(texte).split('\n')) {
    if (police === 'mono') {
      // Le code garde ses espaces : coupe au caractère près.
      const n = Math.max(1, Math.floor(max / (0.6 * taille)));
      if (!para.length) { lignes.push(''); continue; }
      for (let i = 0; i < para.length; i += n) lignes.push(para.slice(i, i + n));
      continue;
    }
    const mots = para.split(/ +/);
    let cour = '';
    for (const mot of mots) {
      const essai = cour ? `${cour} ${mot}` : mot;
      if (largeur(essai, police, taille) <= max) { cour = essai; continue; }
      if (cour) lignes.push(cour);
      if (largeur(mot, police, taille) <= max) { cour = mot; continue; }
      let morceau = '';
      for (const ch of mot) {
        if (largeur(morceau + ch, police, taille) > max && morceau) { lignes.push(morceau); morceau = ch; } else morceau += ch;
      }
      cour = morceau;
    }
    lignes.push(cour);
  }
  return lignes;
}

/** Échappe une chaîne WinAnsi pour un opérateur Tj. */
function chainePdf(t) {
  let s = '(';
  for (const ch of t) {
    const c = codeWinAnsi(ch) ?? 63;
    if (c === 40 || c === 41 || c === 92) s += `\\${String.fromCharCode(c)}`;
    else if (c < 32 || c > 126) s += `\\${c.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(c);
  }
  return `${s})`;
}

/** Chaîne d'information (titre, auteur) : UTF-16BE avec BOM, en hexadécimal. */
function chaineInfo(t) {
  let h = 'FEFF';
  for (const ch of String(t ?? '')) {
    const cp = ch.codePointAt(0);
    const units = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
    for (const u of units) h += u.toString(16).toUpperCase().padStart(4, '0');
  }
  return `<${h}>`;
}

const n2 = (x) => (Math.round(x * 100) / 100).toString();
/** Couleur « #rrggbb » → opérandes PDF. */
function rgb(hex) {
  const v = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')?.[1] ?? '000000';
  return [0, 2, 4].map((i) => n2(parseInt(v.slice(i, i + 2), 16) / 255)).join(' ');
}

/** Dimensions d'un JPEG (marqueurs SOF0 à SOF15 hors DHT/DAC/JPG), ou null si ce n'est pas un JPEG lisible. */
export function dimensionsJpeg(octets) {
  const b = octets;
  if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const lg = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const hauteur = (b[i + 5] << 8) | b[i + 6]; const larg = (b[i + 7] << 8) | b[i + 8]; const comp = b[i + 9];
      if (!larg || !hauteur) return null;
      return { largeur: larg, hauteur, composantes: comp };
    }
    i += 2 + lg;
  }
  return null;
}

/**
 * Document PDF de bas niveau : des pages, des opérations de dessin, des images.
 * Coordonnées en points, origine EN HAUT à gauche (converties à l'écriture).
 */
export class DocumentPdf {
  constructor({ titre = '', auteur = '', sujet = '' } = {}) {
    this.info = { titre, auteur, sujet };
    this.pages = [];
    this.images = [];
  }
  nouvellePage() { this.pages.push({ ops: [], images: new Set() }); return this.pages.length - 1; }
  #y(y) { return A4.hauteur - y; }
  texte(page, x, y, t, { police = 'normal', taille = 10, couleur = '#1c2530' } = {}) {
    const s = versWinAnsi(t);
    if (!s) return;
    this.pages[page].ops.push(`BT /${POLICES[police]} ${n2(taille)} Tf ${rgb(couleur)} rg ${n2(x)} ${n2(this.#y(y))} Td ${chainePdf(s)} Tj ET`);
  }
  rect(page, x, y, w, h, { fond = null, trait = null, epaisseur = 0.6 } = {}) {
    const r = `${n2(x)} ${n2(this.#y(y + h))} ${n2(w)} ${n2(h)} re`;
    if (fond && trait) this.pages[page].ops.push(`${rgb(fond)} rg ${rgb(trait)} RG ${n2(epaisseur)} w ${r} B`);
    else if (fond) this.pages[page].ops.push(`${rgb(fond)} rg ${r} f`);
    else if (trait) this.pages[page].ops.push(`${rgb(trait)} RG ${n2(epaisseur)} w ${r} S`);
  }
  trait(page, x1, y1, x2, y2, { couleur = '#cfd6de', epaisseur = 0.6 } = {}) {
    this.pages[page].ops.push(`${rgb(couleur)} RG ${n2(epaisseur)} w ${n2(x1)} ${n2(this.#y(y1))} m ${n2(x2)} ${n2(this.#y(y2))} l S`);
  }
  /**
   * Tracé libre : liste de points [x, y] (lignes droites), ou de segments
   * { c: [x1, y1, x2, y2, x, y] } (courbes de Bézier). Fermé, rempli et/ou
   * tracé, en tirets si demandé. Sert aux schémas d'architecture.
   */
  chemin(page, points, { fond = null, trait = null, epaisseur = 1, ferme = false, tirets = null, arrondi = false } = {}) {
    if (!points.length) return;
    const pt = (x, y) => `${n2(x)} ${n2(this.#y(y))}`;
    let d = '';
    points.forEach((p, i) => {
      if (Array.isArray(p)) d += `${pt(p[0], p[1])} ${i === 0 ? 'm' : 'l'} `;
      else d += `${pt(p.c[0], p.c[1])} ${pt(p.c[2], p.c[3])} ${pt(p.c[4], p.c[5])} c `;
    });
    if (ferme) d += 'h ';
    const style = `${fond ? `${rgb(fond)} rg ` : ''}${trait ? `${rgb(trait)} RG ${n2(epaisseur)} w ` : ''}${tirets ? `[${tirets.map(n2).join(' ')}] 0 d ` : '[] 0 d '}${arrondi ? '1 J 1 j ' : '0 J 0 j '}`;
    const op = fond && trait ? 'B' : fond ? 'f' : 'S';
    this.pages[page].ops.push(`q ${style}${d}${op} Q`);
  }
  /** Cercle (quatre courbes de Bézier). */
  cercle(page, cx, cy, r, opts = {}) {
    const k = 0.5523 * r;
    this.chemin(page, [[cx + r, cy], { c: [cx + r, cy + k, cx + k, cy + r, cx, cy + r] }, { c: [cx - k, cy + r, cx - r, cy + k, cx - r, cy] },
      { c: [cx - r, cy - k, cx - k, cy - r, cx, cy - r] }, { c: [cx + k, cy - r, cx + r, cy - k, cx + r, cy] }], { ...opts, ferme: true });
  }
  /** Rectangle aux coins arrondis. */
  rectArrondi(page, x, y, w, h, r, opts = {}) {
    const k = 0.5523 * r;
    this.chemin(page, [[x + r, y], [x + w - r, y], { c: [x + w - r + k, y, x + w, y + r - k, x + w, y + r] }, [x + w, y + h - r],
      { c: [x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h] }, [x + r, y + h], { c: [x + r - k, y + h, x, y + h - r + k, x, y + h - r] },
      [x, y + r], { c: [x, y + r - k, x + r - k, y, x + r, y] }], { ...opts, ferme: true });
  }
  /** Ajoute une image JPEG (octets) ; renvoie son index ou -1 si illisible. */
  ajouterJpeg(octets) {
    const d = dimensionsJpeg(octets);
    if (!d || ![1, 3].includes(d.composantes)) return -1;
    this.images.push({ octets, ...d });
    return this.images.length - 1;
  }
  image(page, index, x, y, w, h) {
    this.pages[page].images.add(index);
    this.pages[page].ops.push(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(this.#y(y + h))} cm /Im${index} Do Q`);
  }

  /** Le fichier PDF complet. */
  octets({ date = new Date() } = {}) {
    const morceaux = []; let taille = 0; const offsets = [];
    const enc = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };
    const pousser = (u) => { morceaux.push(u); taille += u.length; };
    const objet = (num, corps) => { offsets[num] = taille; pousser(enc(`${num} 0 obj\n`)); for (const c of [].concat(corps)) pousser(typeof c === 'string' ? enc(c) : c); pousser(enc('\nendobj\n')); };

    pousser(enc('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
    // 1 catalogue, 2 pages, 3-5 polices, 6 info, puis images, puis pages et contenus.
    const nImg = this.images.length;
    const premierImg = 7; const premierePage = premierImg + nImg;
    const numPage = (i) => premierePage + i * 2; const numContenu = (i) => premierePage + i * 2 + 1;
    objet(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objet(2, `<< /Type /Pages /Count ${this.pages.length} /Kids [${this.pages.map((_, i) => `${numPage(i)} 0 R`).join(' ')}] >>`);
    objet(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objet(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    objet(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const p2 = (x) => String(x).padStart(2, '0');
    const dPdf = `D:${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
    objet(6, `<< /Title ${chaineInfo(this.info.titre)} /Author ${chaineInfo(this.info.auteur)} /Subject ${chaineInfo(this.info.sujet)} /Creator ${chaineInfo('KJEMO IT Toolkit')} /Producer ${chaineInfo('KJEMO IT Toolkit (pdf-a4)')} /CreationDate (${dPdf}) >>`);
    this.images.forEach((im, i) => {
      objet(premierImg + i, [`<< /Type /XObject /Subtype /Image /Width ${im.largeur} /Height ${im.hauteur} /ColorSpace /${im.composantes === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.octets.length} >>\nstream\n`, im.octets, '\nendstream']);
    });
    this.pages.forEach((pg, i) => {
      const xo = [...pg.images].map((k) => `/Im${k} ${premierImg + k} 0 R`).join(' ');
      objet(numPage(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(A4.largeur)} ${n2(A4.hauteur)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xo ? ` /XObject << ${xo} >>` : ''} >> /Contents ${numContenu(i)} 0 R >>`);
      const flux = enc(pg.ops.join('\n'));
      objet(numContenu(i), [`<< /Length ${flux.length} >>\nstream\n`, flux, '\nendstream']);
    });
    const total = premierePage + this.pages.length * 2;
    const debutXref = taille;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let k = 1; k < total; k++) xref += `${String(offsets[k]).padStart(10, '0')} 00000 n \n`;
    pousser(enc(`${xref}trailer\n<< /Size ${total} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`));
    const out = new Uint8Array(taille); let o = 0;
    for (const m of morceaux) { out.set(m, o); o += m.length; }
    return out;
  }
}

/* ===========================================================================
 * Mise en page en flux : marges, curseur, saut de page automatique.
 * ======================================================================== */
export const STYLE = {
  marge: 56, haut: 74, bas: 66,
  encre: '#1c2530', pale: '#5d6a79', filet: '#cfd6de', accent: '#0b4f58', fondTete: '#e8eef2', fondCode: '#f1f4f7',
};

export class Flux {
  constructor(doc, { titreCourt = '', reference = '', classification = '' } = {}) {
    this.doc = doc; this.entete = { titreCourt, reference, classification };
    this.page = -1; this.y = 0;
    this.largeurUtile = A4.largeur - 2 * STYLE.marge;
    this.debutsSections = [];
    this.nouvellePage();
  }
  get bas() { return A4.hauteur - STYLE.bas; }
  nouvellePage() { this.page = this.doc.nouvellePage(); this.y = STYLE.haut; }
  /** Garantit `h` points libres, sinon passe à la page suivante. */
  place(h) { if (this.y + h > this.bas) this.nouvellePage(); }
  espace(h) { this.y += h; }

  titreSection(numero, titre) {
    this.place(70);
    if (this.y > STYLE.haut) this.y += 10;
    this.debutsSections.push({ numero, titre, page: this.page });
    this.doc.texte(this.page, STYLE.marge, this.y + 13, `${numero}. ${titre}`, { police: 'gras', taille: 14, couleur: STYLE.accent });
    this.y += 19;
    this.doc.trait(this.page, STYLE.marge, this.y, STYLE.marge + this.largeurUtile, this.y, { couleur: STYLE.accent, epaisseur: 0.8 });
    this.y += 9;
  }
  sousTitre(t) {
    this.place(44);
    this.y += 4;
    this.doc.texte(this.page, STYLE.marge, this.y + 10, t, { police: 'gras', taille: 10.5 });
    this.y += 16;
  }
  paragraphe(t, { taille = 10, couleur = STYLE.encre, police = 'normal', interligne = 1.42 } = {}) {
    const lh = taille * interligne;
    for (const l of couper(t, police, taille, this.largeurUtile)) {
      this.place(lh);
      this.doc.texte(this.page, STYLE.marge, this.y + taille, l, { police, taille, couleur });
      this.y += lh;
    }
    this.y += 4;
  }
  /** Bloc de code : Courier sur fond clair, coupé entre les pages si besoin. */
  code(t, { titre = '' } = {}) {
    const taille = 8.6; const lh = 11.2; const pad = 7;
    const lignes = couper(t, 'mono', taille, this.largeurUtile - 2 * pad);
    if (titre) this.sousTitre(titre);
    let i = 0;
    while (i < lignes.length) {
      this.place(lh + 2 * pad);
      const dispo = Math.max(1, Math.floor((this.bas - this.y - 2 * pad) / lh));
      const lot = lignes.slice(i, i + dispo);
      const h = lot.length * lh + 2 * pad;
      this.doc.rect(this.page, STYLE.marge, this.y, this.largeurUtile, h, { fond: STYLE.fondCode, trait: STYLE.filet, epaisseur: 0.5 });
      lot.forEach((l, k) => this.doc.texte(this.page, STYLE.marge + pad, this.y + pad + taille + k * lh, l, { police: 'mono', taille }));
      this.y += h; i += lot.length;
      if (i < lignes.length) this.nouvellePage();
    }
    this.y += 8;
  }
  /**
   * Tableau : colonnes { titre, part (fraction de la largeur), mono? }.
   * Les lignes trop hautes passent à la page suivante ; l'en-tête est répété.
   */
  tableau(colonnes, lignes, { taille = 8.8, enteteVisible = true } = {}) {
    const total = colonnes.reduce((s, c) => s + (c.part ?? 1), 0);
    const larg = colonnes.map((c) => ((c.part ?? 1) / total) * this.largeurUtile);
    const pad = 4; const lh = taille * 1.32;
    const hauteurLigne = (cellules, gras) => Math.max(...cellules.map((c, k) => couper(c, colonnes[k].mono ? 'mono' : (gras ? 'gras' : 'normal'), colonnes[k].mono ? taille - 0.6 : taille, larg[k] - 2 * pad).length)) * lh + 2 * pad;
    const dessiner = (cellules, { tete = false, styles = [] } = {}) => {
      const h = hauteurLigne(cellules, tete);
      let x = STYLE.marge;
      cellules.forEach((c, k) => {
        this.doc.rect(this.page, x, this.y, larg[k], h, tete ? { fond: STYLE.fondTete, trait: STYLE.filet, epaisseur: 0.5 } : { trait: STYLE.filet, epaisseur: 0.5 });
        const police = tete ? 'gras' : (colonnes[k].mono ? 'mono' : (styles[k]?.gras ? 'gras' : 'normal'));
        const t = colonnes[k].mono && !tete ? taille - 0.6 : taille;
        couper(c, police, t, larg[k] - 2 * pad).forEach((l, j) => this.doc.texte(this.page, x + pad, this.y + pad + t + j * lh - 1, l, { police, taille: t, couleur: styles[k]?.couleur ?? STYLE.encre }));
        x += larg[k];
      });
      this.y += h;
    };
    const tete = colonnes.map((c) => c.titre);
    const hTete = enteteVisible ? hauteurLigne(tete, true) : 0;
    const premiere = lignes.length ? hauteurLigne(lignes[0].cellules ?? lignes[0], false) : 0;
    this.place(hTete + Math.min(premiere, 120));
    if (enteteVisible) dessiner(tete, { tete: true });
    for (const ligne of lignes) {
      const cellules = ligne.cellules ?? ligne;
      const h = hauteurLigne(cellules, false);
      if (this.y + h > this.bas) { this.nouvellePage(); if (enteteVisible) dessiner(tete, { tete: true }); }
      dessiner(cellules, { styles: ligne.styles ?? [] });
    }
    this.y += 10;
  }
  /**
   * Zone de dessin vectoriel de largeur utile et de hauteur `h`, légendée :
   * `dessiner(doc, page, x, y, largeur, hauteur)` y trace ce qu'il veut.
   */
  dessin(h, dessiner, legende = '') {
    this.place(h + 24);
    dessiner(this.doc, this.page, STYLE.marge, this.y, this.largeurUtile, h);
    this.y += h + 4;
    if (legende) for (const l of couper(legende, 'normal', 8.5, this.largeurUtile)) { this.doc.texte(this.page, STYLE.marge + (this.largeurUtile - largeur(l, 'normal', 8.5)) / 2, this.y + 8.5, l, { taille: 8.5, couleur: STYLE.pale }); this.y += 11.5; }
    this.y += 8;
  }
  /** Image JPEG légendée, ajustée à la largeur et à une hauteur maximale. */
  image(octets, legende, { hauteurMax = 330 } = {}) {
    const idx = this.doc.ajouterJpeg(octets);
    if (idx < 0) { this.paragraphe(`[Image illisible : ${legende}]`, { couleur: STYLE.pale, taille: 9 }); return false; }
    const im = this.doc.images[idx];
    let w = Math.min(this.largeurUtile, im.largeur * 0.75); let h = (w * im.hauteur) / im.largeur;
    if (h > hauteurMax) { h = hauteurMax; w = (h * im.largeur) / im.hauteur; }
    this.place(h + 24);
    const x = STYLE.marge + (this.largeurUtile - w) / 2;
    this.doc.image(this.page, idx, x, this.y, w, h);
    this.doc.rect(this.page, x, this.y, w, h, { trait: STYLE.filet, epaisseur: 0.5 });
    this.y += h + 4;
    if (legende) for (const l of couper(legende, 'normal', 8.5, this.largeurUtile)) { this.doc.texte(this.page, STYLE.marge + (this.largeurUtile - largeur(l, 'normal', 8.5)) / 2, this.y + 8.5, l, { taille: 8.5, couleur: STYLE.pale }); this.y += 11.5; }
    this.y += 8;
    return true;
  }

  /** En-tête et pied de page sur toutes les pages, une fois le nombre total connu. */
  finaliser({ premiereSansEntete = true } = {}) {
    const n = this.doc.pages.length; const { titreCourt, reference, classification } = this.entete;
    for (let i = 0; i < n; i++) {
      if (!(premiereSansEntete && i === 0)) {
        const titre = couper(titreCourt, 'normal', 8, this.largeurUtile * 0.62)[0] ?? '';
        this.doc.texte(i, STYLE.marge, 44, titre, { taille: 8, couleur: STYLE.pale });
        this.doc.texte(i, A4.largeur - STYLE.marge - largeur(reference, 'normal', 8), 44, reference, { taille: 8, couleur: STYLE.pale });
        this.doc.trait(i, STYLE.marge, 50, A4.largeur - STYLE.marge, 50);
      }
      const yb = A4.hauteur - 40;
      this.doc.trait(i, STYLE.marge, yb - 12, A4.largeur - STYLE.marge, yb - 12);
      this.doc.texte(i, STYLE.marge, yb, classification, { taille: 8, couleur: STYLE.pale });
      const p = `Page ${i + 1} / ${n}`;
      this.doc.texte(i, A4.largeur - STYLE.marge - largeur(p, 'normal', 8), yb, p, { taille: 8, couleur: STYLE.pale });
    }
  }
}
