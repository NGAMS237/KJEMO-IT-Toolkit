/**
 * schemas-cisco.mjs — KJEMO-CISCO-S07-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Schémas ORIGINAUX (SVG en ligne) qui illustrent le cours EtherChannel et
 * Spanning Tree. Dessinés ici, avec nos mots : aucune diapositive du cours n'est
 * copiée ni redistribuée. Module PUR : aucun DOM, aucun stockage.
 *
 * RÈGLES
 *  - Chaque schéma a un titre, un texte alternatif (`alt`) et une légende ; le
 *    SVG porte role="img" + <title> + <desc> : un lecteur d'écran lit le sens.
 *  - Jamais la couleur seule : un état est aussi dit par un symbole (✓ ✗ ⊘) et un mot.
 *  - Les couleurs viennent des variables du thème (clair/sombre) avec repli.
 *  - Les « sorties » montrées sont des EXEMPLES écrits à la main pour expliquer ;
 *    elles ne proviennent d'aucun équipement et ne prouvent rien.
 */

import { SCHEMAS_RESEAU } from './schemas-cisco-reseau.mjs';

const T = 'var(--text-strong,#fff)';
const S = 'var(--text-soft,#c6cbe2)';
const FOND = 'var(--surface-3,#11152a)';
const CASE = 'var(--surface-2,#1d2340)';
const BORD = 'var(--border-strong,#646a9a)';
const ACC = 'var(--accent,#9c7aff)';
const CYAN = 'var(--cyan,#56d6d0)';
const OK = 'var(--ok-text,#9ce5c7)';
const KO = 'var(--danger-text,#ffb2b9)';
const WARN = 'var(--warn,#ffcd70)';

const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const txt = (x, y, s, { taille = 14, ancre = 'middle', couleur = T, gras = false, mono = false } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${ancre}" font-size="${taille}" fill="${couleur}" xml:space="preserve" style="white-space:pre"${gras ? ' font-weight="700"' : ''}${mono ? ' font-family="ui-monospace,Consolas,monospace"' : ''}>${e(s)}</text>`;
const boite = (x, y, w, h, { fond = CASE, bord = BORD, r = 8, trait = 1.5, tirets = false } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fond}" stroke="${bord}" stroke-width="${trait}"${tirets ? ' stroke-dasharray="6 4"' : ''}/>`;
const ligne = (x1, y1, x2, y2, { couleur = BORD, largeur = 3, tirets = false } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${couleur}" stroke-width="${largeur}"${tirets ? ' stroke-dasharray="7 5"' : ''} stroke-linecap="round"/>`;
const commutateur = (x, y, nom, { w = 96, h = 44, bord = BORD } = {}) =>
  boite(x, y, w, h, { bord, trait: 2 }) + txt(x + w / 2, y + h / 2 + 5, nom, { gras: true });
const fleche = (x1, y1, x2, y2) => ligne(x1, y1, x2, y2, { couleur: S, largeur: 2 })
  + `<polygon points="${x2},${y2} ${x2 - 7},${y2 - 12} ${x2 + 7},${y2 - 12}" fill="${S}"/>`;

function svg({ id, largeur, hauteur, titre, desc, corps }) {
  return `<svg class="schema-svg" viewBox="0 0 ${largeur} ${hauteur}" width="100%" role="img" aria-labelledby="${id}-t ${id}-d" xmlns="http://www.w3.org/2000/svg" font-family="Inter,ui-sans-serif,system-ui,sans-serif">`
    + `<title id="${id}-t">${e(titre)}</title><desc id="${id}-d">${e(desc)}</desc>`
    + `<rect width="${largeur}" height="${hauteur}" rx="12" fill="${FOND}"/>${corps}</svg>`;
}

// ---------------------------------------------------------------------------
// 1. Pourquoi agréger ?
// ---------------------------------------------------------------------------
function faisceau() {
  const g = [];
  g.push(txt(180, 28, 'Sans EtherChannel', { taille: 16, gras: true }), txt(540, 28, 'Avec EtherChannel', { taille: 16, gras: true }));
  g.push(ligne(360, 14, 360, 232, { couleur: BORD, largeur: 1, tirets: true }));
  // gauche
  g.push(commutateur(132, 48, 'S1'), commutateur(132, 150, 'S2'));
  g.push(ligne(152, 92, 152, 150, { couleur: OK, largeur: 4 }), ligne(208, 92, 208, 150, { couleur: KO, largeur: 4, tirets: true }));
  g.push(txt(140, 126, '✓ actif', { ancre: 'end', couleur: OK, taille: 13 }), txt(222, 126, '⊘ bloqué par STP', { ancre: 'start', couleur: KO, taille: 13 }));
  g.push(txt(180, 222, 'Un seul lien sert : l’autre attend une panne.', { taille: 13, couleur: S }));
  // droite
  g.push(commutateur(452, 48, 'S1'), commutateur(452, 150, 'S2'));
  g.push(boite(458, 94, 84, 58, { fond: 'none', bord: ACC, r: 14, trait: 2.5 }));
  g.push(ligne(476, 92, 476, 150, { couleur: OK, largeur: 4 }), ligne(524, 92, 524, 150, { couleur: OK, largeur: 4 }));
  g.push(txt(560, 118, 'Port-channel 1', { ancre: 'start', couleur: ACC, gras: true, taille: 13 }), txt(560, 138, '✓ les 2 liens servent', { ancre: 'start', couleur: OK, taille: 13 }));
  g.push(txt(540, 222, 'STP voit UN seul lien logique : rien à bloquer.', { taille: 13, couleur: S }));
  return svg({
    id: 'sc-faisceau', largeur: 720, hauteur: 242,
    titre: 'Deux liens entre deux commutateurs, avec et sans EtherChannel',
    desc: 'À gauche, deux liens entre S1 et S2 : STP en bloque un. À droite, les deux liens sont regroupés dans le port-channel 1 : les deux servent.',
    corps: g.join(''),
  });
}

// ---------------------------------------------------------------------------
// 2. Modes de négociation
// ---------------------------------------------------------------------------
function tableauModes(x, y, titre, modes, regle) {
  const g = [];
  const cw = 78; const ch = 34; const gauche = x + 88;
  g.push(txt(gauche + (cw * 3) / 2 - 3, y, titre, { gras: true, taille: 15, couleur: ACC }));
  g.push(txt(gauche + (cw * 3) / 2 - 3, y + 18, 'mode de l’autre extrémité →', { taille: 12, couleur: S }));
  modes.forEach((m, i) => g.push(txt(gauche + cw * i + (cw - 6) / 2, y + 44, m, { taille: 13, gras: true, mono: true })));
  modes.forEach((a, r) => {
    const cy = y + 54 + ch * r;
    g.push(txt(x + 4, cy + 21, a, { taille: 13, gras: true, mono: true, ancre: 'start' }));
    modes.forEach((b, c) => {
      const ok = regle(a, b);
      const cx = gauche + cw * c;
      g.push(boite(cx, cy, cw - 6, ch - 4, { fond: CASE, bord: ok ? OK : KO, trait: 1.5, r: 6 }));
      g.push(txt(cx + (cw - 6) / 2, cy + 20, ok ? '✓ forme' : '✗ non', { taille: 13, couleur: ok ? OK : KO, gras: true }));
    });
  });
  return g.join('');
}
function modes() {
  const pagp = (a, b) => (a === 'on' && b === 'on') || (a !== 'on' && b !== 'on' && !(a === 'auto' && b === 'auto'));
  const lacp = (a, b) => (a === 'on' && b === 'on') || (a !== 'on' && b !== 'on' && !(a === 'passive' && b === 'passive'));
  const corps = tableauModes(10, 26, 'PAgP (Cisco) — ce côté ↓', ['desirable', 'auto', 'on'], pagp)
    + tableauModes(372, 26, 'LACP (IEEE 802.3ad) — ce côté ↓', ['active', 'passive', 'on'], lacp)
    + txt(360, 226, 'Règle : il faut que au moins un côté PROPOSE (desirable / active). « on » ne se marie qu’avec « on ».', { taille: 13, couleur: S })
    + txt(360, 246, 'Deux côtés passifs (auto-auto, passive-passive) attendent chacun que l’autre commence : rien ne se forme.', { taille: 13, couleur: S });
  return svg({
    id: 'sc-modes', largeur: 720, hauteur: 262,
    titre: 'Quels modes de négociation forment un EtherChannel',
    desc: 'PAgP : desirable avec desirable ou auto forme un canal, auto avec auto non. LACP : active avec active ou passive forme un canal, passive avec passive non. Le mode on ne forme un canal qu’avec on.',
    corps,
  });
}

// ---------------------------------------------------------------------------
// 3. Ordre de configuration
// ---------------------------------------------------------------------------
function ordre() {
  const etapes = [
    ['1', 'Éteindre les ports', ['interface range …', 'shutdown']],
    ['2', 'Grouper les ports', ['channel-group N', 'mode desirable|active']],
    ['3', 'Régler le port-channel', ['interface port-channel N', 'switchport mode trunk']],
    ['4', 'Rallumer et vérifier', ['no shutdown', 'show etherchannel', 'summary']],
  ];
  const g = [];
  etapes.forEach((s, i) => {
    const x = 12 + i * 176;
    g.push(boite(x, 22, 168, 150, { fond: CASE, bord: i === 3 ? OK : BORD, trait: 1.8, r: 10 }));
    g.push(`<circle cx="${x + 24}" cy="46" r="14" fill="${ACC}"/>` + txt(x + 24, 52, s[0], { couleur: 'var(--on-accent,#17112e)', gras: true, taille: 15 }));
    g.push(txt(x + 84, 88, s[1], { gras: true, taille: 13.5 }));
    s[2].forEach((l, k) => g.push(txt(x + 84, 116 + k * 18, l, { mono: true, taille: 10.5, couleur: CYAN })));
    if (i < 3) g.push(ligne(x + 168, 97, x + 176, 97, { couleur: S, largeur: 2 }));
  });
  g.push(txt(360, 202, 'À faire sur LES DEUX commutateurs. L’ordre compte : EtherChannel et Spanning Tree travaillent ensemble.', { taille: 13, couleur: S }));
  g.push(txt(360, 222, 'Éteindre d’abord évite que la protection du commutateur ne mette un port en erreur pendant la saisie.', { taille: 13, couleur: S }));
  return svg({
    id: 'sc-ordre', largeur: 720, hauteur: 238,
    titre: 'Les quatre temps de la configuration d’un EtherChannel',
    desc: 'Un : éteindre les ports. Deux : channel-group avec un mode. Trois : régler l’interface port-channel (trunk). Quatre : rallumer les ports et vérifier avec show etherchannel summary.',
    corps: g.join(''),
  });
}

// ---------------------------------------------------------------------------
// 4. Ce qui doit être identique
// ---------------------------------------------------------------------------
function regles() {
  const lignes = [
    ['Même type, même vitesse, même duplex', 'Fast Ethernet et Gigabit ne se mélangent pas'],
    ['Même mode : tous en accès (même VLAN) ou tous en trunk', 'jamais un port trunk et un port accès'],
    ['Même VLAN natif sur tous les ports du trunk', 'sinon les ports se suspendent'],
    ['Mêmes VLAN autorisés (allowed vlan)', 'une liste différente empêche le canal'],
    ['Au plus 8 ports par canal, du même commutateur', 'le 2960 gère jusqu’à 6 canaux'],
    ['Mode compatible aux deux bouts', 'PAgP avec PAgP, LACP avec LACP'],
  ];
  const g = [];
  g.push(txt(360, 26, 'Avant de grouper des ports : tout doit concorder', { taille: 16, gras: true }));
  lignes.forEach((l, i) => {
    const y = 42 + i * 38;
    g.push(boite(20, y, 680, 32, { fond: CASE, bord: BORD, r: 7 }));
    g.push(txt(38, y + 21, '✓', { couleur: OK, gras: true, taille: 16, ancre: 'start' }));
    g.push(txt(64, y + 21, l[0], { ancre: 'start', gras: true, taille: 13 }));
    g.push(txt(684, y + 21, l[1], { ancre: 'end', couleur: S, taille: 12 }));
  });
  return svg({
    id: 'sc-regles', largeur: 720, hauteur: 276,
    titre: 'Ce qui doit être identique pour former un EtherChannel',
    desc: 'Six conditions : même type, vitesse et duplex ; même mode accès ou trunk ; même VLAN natif ; mêmes VLAN autorisés ; huit ports au plus ; modes de négociation compatibles.',
    corps: g.join(''),
  });
}

// ---------------------------------------------------------------------------
// 5. Lire show etherchannel summary
// ---------------------------------------------------------------------------
function sommaire() {
  const g = [];
  g.push(boite(14, 14, 440, 150, { fond: 'var(--code-bg,#0b0e1c)', bord: 'var(--code-border,#282e4e)', r: 8 }));
  const lignesSortie = [
    'S1# show etherchannel summary',
    'Number of channel-groups in use: 1',
    'Group  Port-channel  Protocol  Ports',
    '-----+-------------+---------+------------------',
    '1      Po1(SU)       LACP      Fa0/1(P) Fa0/2(P)',
  ];
  lignesSortie.forEach((l, i) => g.push(txt(26, 40 + i * 24, l, { ancre: 'start', mono: true, taille: 12.5, couleur: 'var(--code-text,#dbe1ff)' })));
  g.push(txt(234, 184, 'Exemple écrit à la main, pas une capture d’équipement', { taille: 11.5, couleur: S }));
  // légende
  g.push(txt(476, 32, 'Lettres de l’interface logique', { ancre: 'start', gras: true, taille: 13, couleur: ACC }));
  g.push(txt(476, 54, 'S = couche 2    U = en service', { ancre: 'start', taille: 12.5, mono: true }));
  g.push(txt(476, 74, 'S + U → canal sain', { ancre: 'start', taille: 13, couleur: OK, gras: true }));
  g.push(txt(476, 94, 'D = en panne (down)', { ancre: 'start', taille: 12.5, couleur: KO, mono: true }));
  g.push(txt(476, 126, 'Lettres d’un port membre', { ancre: 'start', gras: true, taille: 13, couleur: ACC }));
  g.push(txt(476, 148, 'P = dans le canal ✓', { ancre: 'start', taille: 12.5, mono: true, couleur: OK }));
  g.push(txt(476, 168, 'I = isolé  s = suspendu', { ancre: 'start', taille: 12.5, mono: true, couleur: KO }));
  g.push(txt(476, 188, 'w = en attente  D = down', { ancre: 'start', taille: 12.5, mono: true, couleur: WARN }));
  g.push(txt(360, 218, 'Po1(SU) + ports (P) = le canal fonctionne.   Po1(SD) + ports (I) = il faut chercher la cause.', { taille: 13, couleur: S }));
  return svg({
    id: 'sc-sommaire', largeur: 720, hauteur: 234,
    titre: 'Lire la sortie de show etherchannel summary',
    desc: 'Exemple de sortie avec Po1(SU) et deux ports (P), et la légende : S couche 2, U en service, D en panne, P dans le canal, I isolé, s suspendu, w en attente.',
    corps: g.join(''),
  });
}

// ---------------------------------------------------------------------------
// 6. Arbre de dépannage
// ---------------------------------------------------------------------------
function depannage() {
  const g = [];
  g.push(boite(150, 10, 420, 38, { bord: ACC, trait: 2 }) + txt(360, 34, 'show etherchannel summary : Po(SD), ports (I) ?', { gras: true, taille: 14 }));
  g.push(txt(360, 66, '▼ quatre causes courantes', { taille: 12.5, couleur: S }));
  const causes = [
    ['1', 'Modes incompatibles', 'show run | begin interface Port-channel', 'auto-auto ? passive-passive ? PAgP face à LACP ?'],
    ['2', 'Port accès contre port trunk', 'show interfaces trunk', 'tous les ports du canal dans le même mode'],
    ['3', 'VLAN autorisés ou VLAN natif différents', 'show interfaces trunk', 'mêmes listes, même VLAN natif sur tous les ports'],
    ['4', 'Mauvais groupe ou mauvais port', 'show etherchannel summary', 'numéros et ports conformes au tableau du travail'],
  ];
  causes.forEach((c, i) => {
    const x = 14 + (i % 2) * 352; const y = 78 + Math.floor(i / 2) * 104;
    g.push(boite(x, y, 340, 94, { fond: CASE, bord: BORD, r: 9 }));
    g.push(`<circle cx="${x + 20}" cy="${y + 22}" r="12" fill="${ACC}"/>` + txt(x + 20, y + 27, c[0], { couleur: 'var(--on-accent,#17112e)', gras: true, taille: 13 }));
    g.push(txt(x + 40, y + 27, c[1], { ancre: 'start', gras: true, taille: 13.5 }));
    g.push(txt(x + 14, y + 52, 'Voir :', { ancre: 'start', taille: 12, couleur: S }));
    g.push(txt(x + 58, y + 52, c[2], { ancre: 'start', taille: 11.5, mono: true, couleur: CYAN }));
    g.push(txt(x + 14, y + 76, c[3], { ancre: 'start', taille: 12.5, couleur: S }));
  });
  g.push(txt(360, 304, 'Correction type : éteindre les ports, no channel-group, remettre le BON channel-group, rallumer.', { taille: 13, couleur: S }));
  return svg({
    id: 'sc-depannage', largeur: 720, hauteur: 322,
    titre: 'Où chercher quand l’EtherChannel ne se forme pas',
    desc: 'Quand show etherchannel summary montre Po(SD) et des ports (I), quatre causes courantes : modes incompatibles, port accès contre port trunk, VLAN autorisés ou VLAN natif différents, mauvais groupe ou mauvais port.',
    corps: g.join(''),
  });
}

// ---------------------------------------------------------------------------
// 7. STP et les boucles
// ---------------------------------------------------------------------------
function boucle() {
  const g = [];
  g.push(commutateur(312, 24, 'S1 (racine)', { w: 120, bord: OK }), commutateur(120, 150, 'S2'), commutateur(504, 150, 'S3'));
  g.push(ligne(340, 68, 190, 150, { couleur: OK, largeur: 4 }), ligne(404, 68, 554, 150, { couleur: OK, largeur: 4 }));
  g.push(ligne(216, 172, 504, 172, { couleur: KO, largeur: 4, tirets: true }));
  g.push(txt(360, 196, '⊘ port bloqué', { couleur: KO, gras: true, taille: 14 }));
  g.push(txt(360, 214, 'sans lui, les trames tourneraient en boucle', { couleur: S, taille: 12 }));
  g.push(txt(170, 106, '✓ transmet', { ancre: 'end', couleur: OK, taille: 13 }));
  g.push(txt(560, 106, '✓ transmet', { ancre: 'start', couleur: OK, taille: 13 }));
  g.push(txt(360, 244, 'Spanning Tree garde un seul chemin actif entre deux points et met les autres en réserve.', { taille: 13, couleur: S }));
  g.push(txt(360, 264, 'Si un lien actif tombe, le port bloqué prend le relais après la convergence.', { taille: 13, couleur: S }));
  return svg({
    id: 'sc-boucle', largeur: 720, hauteur: 280,
    titre: 'Spanning Tree bloque un lien pour éviter la boucle',
    desc: 'Trois commutateurs en triangle. S1 est la racine. Les liens S1-S2 et S1-S3 transmettent ; le lien S2-S3 est bloqué pour éviter une boucle.',
    corps: g.join(''),
  });
}

// ---------------------------------------------------------------------------
// 8. Ponts racines par VLAN
// ---------------------------------------------------------------------------
function racines() {
  const g = [];
  g.push(txt(360, 26, 'PVST+ : un arbre par VLAN, donc une racine différente par VLAN', { taille: 15, gras: true }));
  g.push(boite(20, 44, 200, 120, { bord: OK, trait: 2 }), txt(120, 70, 'S1', { gras: true, taille: 16 }), txt(120, 94, 'root primary', { couleur: OK, gras: true, taille: 13 }), txt(120, 116, 'VLAN 1, 10, 30, 50, 70', { mono: true, taille: 12 }), txt(120, 146, 'priorité abaissée (24576)', { couleur: S, taille: 11.5 }));
  g.push(boite(260, 44, 200, 120, { bord: WARN, trait: 2 }), txt(360, 70, 'S2', { gras: true, taille: 16 }), txt(360, 94, 'root secondary', { couleur: WARN, gras: true, taille: 13 }), txt(360, 116, 'tous les VLAN', { mono: true, taille: 12 }), txt(360, 146, 'reprend si une racine tombe', { couleur: S, taille: 11.5 }));
  g.push(boite(500, 44, 200, 120, { bord: OK, trait: 2 }), txt(600, 70, 'S3', { gras: true, taille: 16 }), txt(600, 94, 'root primary', { couleur: OK, gras: true, taille: 13 }), txt(600, 116, 'VLAN 20, 40, 60, 80, 99', { mono: true, taille: 12 }), txt(600, 146, 'priorité abaissée (24576)', { couleur: S, taille: 11.5 }));
  g.push(txt(360, 196, 'La racine = le commutateur de plus petite priorité (puis de plus petite adresse MAC).', { taille: 13, couleur: S }));
  g.push(txt(360, 216, 'En répartissant les VLAN entre deux racines, on répartit aussi le trafic sur les liens.', { taille: 13, couleur: S }));
  return svg({
    id: 'sc-racines', largeur: 720, hauteur: 232,
    titre: 'Répartir les ponts racines par VLAN avec PVST+',
    desc: 'S1 est racine principale des VLAN 1, 10, 30, 50 et 70. S3 est racine principale des VLAN 20, 40, 60, 80 et 99. S2 est racine secondaire de tous les VLAN.',
    corps: g.join(''),
  });
}

/** Les schémas : id → { titre, alt, legende, svg() }. */
export const SCHEMAS = {
  'ec-faisceau': { titre: 'Pourquoi agréger des liens', legende: 'Sans EtherChannel, STP bloque le lien redondant ; avec EtherChannel, les liens regroupés comptent pour un seul et servent tous.', svg: faisceau },
  'ec-modes': { titre: 'Modes de négociation PAgP et LACP', legende: 'Une extrémité au moins doit proposer (desirable ou active). « on » ne s’associe qu’à « on ».', svg: modes },
  'ec-ordre': { titre: 'Ordre de configuration', legende: 'Éteindre, grouper, régler le port-channel, rallumer et vérifier — sur les deux commutateurs.', svg: ordre },
  'ec-regles': { titre: 'Ce qui doit concorder', legende: 'Un seul écart de configuration entre les ports (ou entre les deux bouts) suffit à empêcher le canal.', svg: regles },
  'ec-sommaire': { titre: 'Lire show etherchannel summary', legende: 'Les lettres entre parenthèses disent l’état du canal (SU = bon) et celui de chaque port (P = dans le canal).', svg: sommaire },
  'ec-depannage': { titre: 'Où chercher en cas de panne', legende: 'Quatre causes courantes, et la commande qui permet de chacune la voir.', svg: depannage },
  'stp-boucle': { titre: 'Spanning Tree et les boucles', legende: 'Un lien redondant est mis en réserve (bloqué) pour qu’aucune trame ne tourne en rond.', svg: boucle },
  'stp-racines': { titre: 'Ponts racines par VLAN', legende: 'Deux racines principales se partagent les VLAN ; la secondaire prend le relais en cas de panne.', svg: racines },
  // Cours des semaines 1 à 5 (KJEMO-CISCO-COURS-RESEAU-01).
  ...SCHEMAS_RESEAU,
};

export const IDS_SCHEMAS = Object.keys(SCHEMAS);

/** Texte alternatif d'un schéma (le <desc> du SVG), pour les tests et l'export. */
export function altSchema(id) {
  const s = SCHEMAS[id];
  if (!s) return null;
  const m = /<desc id="[^"]+">([^<]*)<\/desc>/.exec(s.svg());
  return m ? m[1] : null;
}

/** <figure> prêt à insérer dans une page ; `null` si l'identifiant est inconnu. */
export function figureMarkup(id) {
  const s = SCHEMAS[id];
  if (!s) return null;
  return `<figure class="schema" data-schema="${e(id)}">${s.svg()}<figcaption><b>${e(s.titre)}.</b> ${e(s.legende)}</figcaption></figure>`;
}
