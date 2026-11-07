/**
 * ecrans-portail.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Illustrations des étapes en interface graphique (portail Azure). Module PUR
 * (aucun DOM) : il fabrique du SVG en ligne depuis une description écrite à la
 * main. Ce sont des RECONSTITUTIONS schématiques, dessinées ici avec nos mots,
 * PAS des captures d'écran : les libellés exacts et la disposition peuvent
 * différer de ton portail (Microsoft les modifie souvent). Elles servent à
 * repérer OÙ cliquer et QUOI remplir ; les champs à toucher sont surlignés et
 * numérotés (le numéro et le mot « à remplir » portent l'information, jamais la
 * couleur seule).
 *
 * Description d'un écran (`ecran`) :
 *   {
 *     blade:  'Créer un réseau virtuel',            // titre du panneau
 *     fil:    'Accueil > Réseaux virtuels > Créer', // fil d'Ariane (facultatif)
 *     onglets: ['Informations de base', …],         // facultatif
 *     actif:  0,                                    // index de l'onglet actif
 *     champs: [ { label, valeur, genre, marque } ], // 1 à 9 lignes
 *     bouton: 'Vérifier + créer',                   // bouton mis en évidence (facultatif)
 *     note:   'Texte libre sous le panneau',        // facultatif
 *   }
 * `genre` d'un champ : 'texte' (défaut), 'liste' (menu déroulant), 'case'
 * (case à cocher ; `valeur` = 'coche' ou 'vide'), 'lecture' (grisé).
 * `marque: true` : champ à toucher (surligné, numéroté).
 */

const T = 'var(--text-strong,#fff)';
const S = 'var(--text-soft,#c6cbe2)';
const FOND = 'var(--surface-3,#11152a)';
const CASE = 'var(--surface-2,#1d2340)';
const BORD = 'var(--border-strong,#646a9a)';
const ACC = 'var(--accent,#9c7aff)';
const OK = 'var(--ok-text,#9ce5c7)';

const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const GENRES = ['texte', 'liste', 'case', 'lecture'];
export const NB_CHAMPS_MAX = 9;

/** Anomalies d'une description d'écran (liste vide = conforme). */
export function incoherencesEcran(ec, ou = 'écran') {
  const pb = [];
  const txt = (v) => (typeof v === 'string' ? v.trim() : '');
  if (!ec || typeof ec !== 'object') return [`${ou} : description absente`];
  if (txt(ec.blade).length < 4) pb.push(`${ou} : titre du panneau absent`);
  if (!Array.isArray(ec.champs) || !ec.champs.length) pb.push(`${ou} : aucun champ`);
  else if (ec.champs.length > NB_CHAMPS_MAX) pb.push(`${ou} : plus de ${NB_CHAMPS_MAX} champs`);
  (ec.champs ?? []).forEach((c, i) => {
    if (txt(c.label).length < 2) pb.push(`${ou} champ ${i + 1} : libellé absent`);
    if (c.genre !== undefined && !GENRES.includes(c.genre)) pb.push(`${ou} champ ${i + 1} : genre inconnu « ${c.genre} »`);
    if (c.genre === 'case' && !['coche', 'vide'].includes(c.valeur)) pb.push(`${ou} champ ${i + 1} : une case vaut « coche » ou « vide »`);
    if (c.genre !== 'case' && c.valeur !== undefined && typeof c.valeur !== 'string') pb.push(`${ou} champ ${i + 1} : valeur non textuelle`);
  });
  if (ec.onglets !== undefined) {
    if (!Array.isArray(ec.onglets) || ec.onglets.length < 2) pb.push(`${ou} : au moins deux onglets`);
    else if (!Number.isInteger(ec.actif) || ec.actif < 0 || ec.actif >= ec.onglets.length) pb.push(`${ou} : onglet actif hors liste`);
  }
  if (!(ec.champs ?? []).some((c) => c.marque) && !ec.bouton) pb.push(`${ou} : rien n'est surligné (au moins un champ à toucher ou un bouton)`);
  return pb;
}

/** Texte alternatif lisible d'un écran (les mêmes mots que l'image). */
export function altEcran(ec) {
  const marques = (ec.champs ?? []).filter((c) => c.marque).map((c, i) => `${c.label}${c.valeur ? ` : ${c.genre === 'case' ? (c.valeur === 'coche' ? 'cochée' : 'décochée') : c.valeur}` : ''}`);
  return `Schéma du panneau « ${ec.blade} » du portail Azure${ec.fil ? ` (${ec.fil})` : ''}. `
    + (ec.onglets ? `Onglets : ${ec.onglets.join(', ')} ; actif : ${ec.onglets[ec.actif]}. ` : '')
    + (marques.length ? `À remplir ou toucher : ${marques.join(' ; ')}. ` : '')
    + (ec.bouton ? `Bouton à cliquer : ${ec.bouton}.` : '');
}

const L = 720;          // largeur
const MARGE = 20;
const H_LIGNE = 38;

function champSvg(c, y, n) {
  const genre = c.genre ?? 'texte';
  const x0 = MARGE + 14;
  const xBoite = 270;
  const wBoite = L - MARGE - 14 - xBoite;
  let s = '';
  const marque = Boolean(c.marque);
  if (marque) s += `<rect x="${MARGE + 4}" y="${y - 4}" width="${L - 2 * MARGE - 8}" height="${H_LIGNE - 2}" rx="6" fill="none" stroke="${ACC}" stroke-width="2" stroke-dasharray="5 3"/>`;
  s += `<text x="${x0 + (marque ? 22 : 0)}" y="${y + 17}" font-size="13" fill="${T}">${e(c.label)}</text>`;
  if (marque) s += `<circle cx="${x0 + 6}" cy="${y + 13}" r="9" fill="${ACC}"/><text x="${x0 + 6}" y="${y + 17}" text-anchor="middle" font-size="12" font-weight="700" fill="#10142a">${n}</text>`;
  if (genre === 'case') {
    const coche = c.valeur === 'coche';
    s += `<rect x="${xBoite}" y="${y + 3}" width="18" height="18" rx="3" fill="${coche ? ACC : CASE}" stroke="${BORD}" stroke-width="1.5"/>`;
    if (coche) s += `<path d="M${xBoite + 4} ${y + 12} l4 4 l7 -9" fill="none" stroke="#10142a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<text x="${xBoite + 28}" y="${y + 17}" font-size="12" fill="${S}">${coche ? 'cochée' : 'décochée'}</text>`;
  } else {
    const grise = genre === 'lecture';
    s += `<rect x="${xBoite}" y="${y + 1}" width="${wBoite}" height="24" rx="4" fill="${grise ? FOND : CASE}" stroke="${BORD}" stroke-width="1.2"${grise ? ' stroke-dasharray="3 3"' : ''}/>`;
    s += `<text x="${xBoite + 10}" y="${y + 17}" font-size="12.5" fill="${c.valeur ? T : S}" font-family="ui-monospace,Menlo,Consolas,monospace">${e(c.valeur || '—')}</text>`;
    if (genre === 'liste') s += `<path d="M${xBoite + wBoite - 20} ${y + 10} l5 6 l5 -6" fill="none" stroke="${S}" stroke-width="2" stroke-linecap="round"/>`;
    if (marque) s += `<text x="${xBoite + wBoite - 6}" y="${y - 6}" text-anchor="end" font-size="10.5" fill="${ACC}" font-weight="700">à remplir</text>`;
  }
  return s;
}

/** SVG d'un écran de portail. */
export function ecranSvg(ec, id = 'ecran') {
  const aOnglets = Array.isArray(ec.onglets);
  const yTitre = 62;
  const yOnglets = aOnglets ? 78 : 0;
  const yChamps = (aOnglets ? yOnglets + 40 : yTitre + 30);
  const n = ec.champs.length;
  const yBouton = yChamps + n * H_LIGNE + 14;
  const hauteur = yBouton + (ec.bouton ? 52 : 6) + (ec.note ? 26 : 0);
  let g = `<rect width="${L}" height="${hauteur}" rx="10" fill="${FOND}"/>`;
  // Barre du portail
  g += `<rect x="0" y="0" width="${L}" height="30" rx="10" fill="${CASE}"/><rect x="0" y="16" width="${L}" height="14" fill="${CASE}"/>`
    + `<text x="${MARGE}" y="20" font-size="12" fill="${S}">Portail Azure</text>`
    + `<rect x="${L - 250}" y="6" width="226" height="18" rx="9" fill="${FOND}" stroke="${BORD}" stroke-width="1"/><text x="${L - 237}" y="19" font-size="10.5" fill="${S}">Rechercher des ressources, services…</text>`;
  if (ec.fil) g += `<text x="${MARGE}" y="48" font-size="11.5" fill="${S}">${e(ec.fil)}</text>`;
  g += `<text x="${MARGE}" y="${yTitre + (ec.fil ? 6 : 0)}" font-size="18" font-weight="700" fill="${T}">${e(ec.blade)}</text>`;
  if (aOnglets) {
    let x = MARGE;
    ec.onglets.forEach((o, i) => {
      const w = Math.max(70, o.length * 6.6 + 24);
      const actif = i === ec.actif;
      g += `<text x="${x + w / 2}" y="${yOnglets + 18}" text-anchor="middle" font-size="12" fill="${actif ? T : S}"${actif ? ' font-weight="700"' : ''}>${e(o)}</text>`;
      if (actif) g += `<rect x="${x + 4}" y="${yOnglets + 24}" width="${w - 8}" height="3" rx="1.5" fill="${ACC}"/>`;
      x += w;
    });
    g += `<line x1="${MARGE}" y1="${yOnglets + 28}" x2="${L - MARGE}" y2="${yOnglets + 28}" stroke="${BORD}" stroke-width="1" opacity=".5"/>`;
  }
  let compte = 0;
  ec.champs.forEach((c, i) => { g += champSvg(c, yChamps + i * H_LIGNE, c.marque ? ++compte : 0); });
  if (ec.bouton) {
    const w = Math.max(150, ec.bouton.length * 8 + 40);
    g += `<rect x="${MARGE + 14}" y="${yBouton}" width="${w}" height="32" rx="5" fill="${ACC}"/>`
      + `<text x="${MARGE + 14 + w / 2}" y="${yBouton + 21}" text-anchor="middle" font-size="13" font-weight="700" fill="#10142a">${e(ec.bouton)}</text>`
      + `<text x="${MARGE + 14 + w + 14}" y="${yBouton + 21}" font-size="12" fill="${ACC}" font-weight="700">← à cliquer</text>`;
  }
  if (ec.note) g += `<text x="${MARGE}" y="${hauteur - 10}" font-size="11.5" fill="${S}" font-style="italic">${e(ec.note)}</text>`;
  return `<svg class="schema-svg ecran-svg" viewBox="0 0 ${L} ${hauteur}" width="100%" role="img" aria-labelledby="${id}-t ${id}-d" xmlns="http://www.w3.org/2000/svg" font-family="Inter,ui-sans-serif,system-ui,sans-serif">`
    + `<title id="${id}-t">${e(ec.blade)}</title><desc id="${id}-d">${e(altEcran(ec))}</desc>${g}</svg>`;
}

/** <figure> d'un écran, avec la mention « reconstitution ». */
export function ecranMarkup(ec, id = 'ecran') {
  return `<figure class="schema ecran" data-ecran="${e(id)}">${ecranSvg(ec, id)}`
    + `<figcaption><b>${e(ec.blade)}.</b> Reconstitution schématique du portail (pas une capture) : les libellés et la disposition peuvent différer de ton écran.${ec.legende ? ' ' + e(ec.legende) : ''}</figcaption></figure>`;
}
