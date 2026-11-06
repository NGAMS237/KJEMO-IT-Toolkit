/**
 * schemas-cisco-reseau.mjs — KJEMO-CISCO-COURS-RESEAU-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Schémas ORIGINAUX (SVG en ligne) pour les cours Cisco des semaines 1 à 5 :
 * masques et VLSM, routes statiques, route flottante, RIP, états d'un port,
 * sécurité des ports, SSH, VTP, DTP et la topologie du TP2. Dessinés ici, avec
 * nos mots : aucune diapositive n'est copiée. Module PUR (aucun DOM).
 * Mêmes règles que schemas-cisco.mjs : titre, texte alternatif, légende, état
 * dit par un symbole ET un mot (jamais la couleur seule), thèmes clair/sombre.
 * Les adresses et sorties sont des EXEMPLES écrits à la main.
 */

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


/** Flèche avec pointe orientée selon le trait. */
function fl(x1, y1, x2, y2, { couleur = S, largeur = 2, tirets = false } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1); const c = Math.cos(a); const s = Math.sin(a);
  const p = (d, w) => `${(x2 - d * c - w * s).toFixed(1)},${(y2 - d * s + w * c).toFixed(1)}`;
  return ligne(x1, y1, x2 - 8 * c, y2 - 8 * s, { couleur, largeur, tirets }) + `<polygon points="${x2},${y2} ${p(12, 6)} ${p(12, -6)}" fill="${couleur}"/>`;
}
const routeur = (x, y, nom, { w = 70, h = 40, bord = BORD } = {}) =>
  boite(x, y, w, h, { bord, trait: 2, r: 20 }) + txt(x + w / 2, y + h / 2 + 5, nom, { gras: true });
const nuage = (x, y, w, h, nom, sous = '') =>
  boite(x, y, w, h, { fond: 'none', bord: CYAN, r: 18, trait: 1.8, tirets: true }) + txt(x + w / 2, y + h / 2 - 1, nom, { couleur: CYAN, gras: true, taille: 13 })
  + (sous ? txt(x + w / 2, y + h / 2 + 15, sous, { couleur: S, taille: 11, mono: true }) : '');

/** Tableau : colonnes (largeurs), en-têtes, lignes de cellules ; une cellule peut être { t, c, gras, mono }. */
function tableau(x, y, largeurs, entetes, lignes, { h = 30, taille = 12.5 } = {}) {
  const g = []; const total = largeurs.reduce((a, b) => a + b, 0);
  const cx = (i) => x + largeurs.slice(0, i).reduce((a, b) => a + b, 0);
  g.push(boite(x, y, total, h, { fond: CASE, bord: BORD, r: 6, trait: 1.5 }));
  entetes.forEach((t, i) => g.push(txt(cx(i) + largeurs[i] / 2, y + h / 2 + 5, t, { gras: true, taille, couleur: ACC })));
  lignes.forEach((l, r) => {
    const yy = y + h * (r + 1);
    g.push(boite(x, yy, total, h, { fond: 'none', bord: BORD, r: 0, trait: 1 }));
    l.forEach((cel, i) => {
      const c = typeof cel === 'string' ? { t: cel } : cel;
      g.push(txt(cx(i) + largeurs[i] / 2, yy + h / 2 + 5, c.t, { taille, couleur: c.c ?? T, gras: c.gras ?? false, mono: c.mono ?? false }));
    });
  });
  return g.join('');
}
const oui = (t = 'oui') => ({ t: `✓ ${t}`, c: OK });
const non = (t = 'non') => ({ t: `✗ ${t}`, c: KO });
const att = (t) => ({ t: `⚠ ${t}`, c: WARN });

// 1. Masques -----------------------------------------------------------------
function vlsmMasques() {
  const lignes = [['/24', '255.255.255.0', '256', '254', '256'], ['/25', '255.255.255.128', '128', '126', '128'], ['/26', '255.255.255.192', '64', '62', '64'],
    ['/27', '255.255.255.224', '32', '30', '32'], ['/28', '255.255.255.240', '16', '14', '16'], ['/29', '255.255.255.248', '8', '6', '8'], ['/30', '255.255.255.252', '4', '2', '4']]
    .map((l) => [{ t: l[0], gras: true, mono: true, c: CYAN }, { t: l[1], mono: true }, l[2], { t: l[3], c: OK, gras: true }, l[4]]);
  const g = [txt(360, 24, 'Dernier octet : de /24 à /30', { gras: true, taille: 15 }),
    tableau(30, 38, [90, 190, 120, 150, 110], ['Préfixe', 'Masque', 'Adresses', 'Hôtes utilisables', 'Pas'], lignes),
    txt(360, 294, 'Hôtes utilisables = adresses − 2 (la première est le réseau, la dernière la diffusion).', { taille: 12.5, couleur: S }),
    txt(360, 312, 'Le pas est l’écart entre deux adresses de réseau : /27 donne .0, .32, .64, .96…', { taille: 12.5, couleur: S })];
  return svg({
    id: 'sc-vlsm-masques', largeur: 720, hauteur: 328, titre: 'Masques de /24 à /30 et nombre d’hôtes',
    desc: 'Tableau des préfixes /24 à /30 avec le masque pointé, le nombre d’adresses, le nombre d’hôtes utilisables (adresses moins deux) et le pas entre deux réseaux : /24 256 adresses et 254 hôtes, /25 128 et 126, /26 64 et 62, /27 32 et 30, /28 16 et 14, /29 8 et 6, /30 4 et 2.',
    corps: g.join(''),
  });
}

// 2. Découpage VLSM ----------------------------------------------------------
function vlsmDecoupage() {
  const X = 40; const K = 2.5; // 640 px pour 256 adresses
  const blocs = [['/25', 0, 128, '100 hôtes', '.0 – .127', OK], ['/26', 128, 64, '50 hôtes', '.128 – .191', CYAN], ['/27', 192, 32, '20 hôtes', '.192 – .223', WARN], ['/30', 224, 4, '2 hôtes', '.224', ACC]];
  const g = [txt(360, 24, 'Bloc 192.168.10.0/24 découpé du plus grand besoin au plus petit', { gras: true, taille: 14.5 })];
  g.push(boite(X, 44, 640, 56, { fond: 'none', bord: BORD, r: 6, trait: 1.5, tirets: true }));
  blocs.forEach((b, i) => {
    g.push(boite(X + b[1] * K, 44, Math.max(b[2] * K, 10), 56, { fond: CASE, bord: b[5], r: 4, trait: 2 }));
    if (b[2] >= 32) g.push(txt(X + b[1] * K + (b[2] * K) / 2, 78, b[0], { gras: true, mono: true, taille: 15, couleur: b[5] }));
  });
  g.push(txt(X + 228 * K + (28 * K) / 2, 78, 'libre', { taille: 12, couleur: S }));
  const lg = [['1', '/25', 'Réseau A', '192.168.10.0', '100 hôtes (126 possibles)', OK], ['2', '/26', 'Réseau B', '192.168.10.128', '50 hôtes (62 possibles)', CYAN], ['3', '/27', 'Réseau C', '192.168.10.192', '20 hôtes (30 possibles)', WARN], ['4', '/30', 'Lien routeur', '192.168.10.224', '2 hôtes (2 possibles)', ACC]];
  lg.forEach((l, i) => {
    const y = 134 + i * 28;
    g.push(`<circle cx="62" cy="${y - 5}" r="10" fill="${l[5]}"/>` + txt(62, y - 1, l[0], { couleur: 'var(--on-accent,#17112e)', gras: true, taille: 12 }));
    g.push(txt(90, y, `${l[2]} : ${l[3]}${l[1]}`, { ancre: 'start', mono: true, taille: 13 }), txt(430, y, l[4], { ancre: 'start', taille: 13, couleur: S }));
  });
  g.push(txt(360, 258, 'On range les besoins du plus grand au plus petit, puis chaque bloc commence où le précédent finit.', { taille: 12.5, couleur: S }));
  g.push(txt(360, 276, 'Ce qui reste (.228 à .255) est libre pour la suite.', { taille: 12.5, couleur: S }));
  return svg({
    id: 'sc-vlsm-decoupage', largeur: 720, hauteur: 292, titre: 'Exemple de découpage VLSM d’un /24',
    desc: 'Le bloc 192.168.10.0/24 est découpé selon quatre besoins : un /25 pour 100 hôtes à partir de .0, un /26 pour 50 hôtes à partir de .128, un /27 pour 20 hôtes à partir de .192 et un /30 pour un lien de deux hôtes à partir de .224. La fin du bloc reste libre.',
    corps: g.join(''),
  });
}

// 3. Routes statiques ---------------------------------------------------------
function rtStatique() {
  const g = [txt(360, 22, 'Il faut une route à l’aller ET une route au retour', { gras: true, taille: 15 })];
  g.push(boite(14, 70, 110, 44, { bord: CYAN }), txt(69, 90, 'LAN 1', { gras: true }), txt(69, 106, '192.168.1.0/24', { mono: true, taille: 11, couleur: S }));
  g.push(routeur(160, 68, 'R1'), routeur(325, 68, 'R2'), routeur(490, 68, 'R3'));
  g.push(boite(596, 70, 110, 44, { bord: CYAN }), txt(651, 90, 'LAN 3', { gras: true }), txt(651, 106, '192.168.3.0/24', { mono: true, taille: 11, couleur: S }));
  g.push(ligne(124, 92, 160, 92), ligne(230, 88, 325, 88, { couleur: ACC }), ligne(395, 88, 490, 88, { couleur: ACC }), ligne(560, 92, 596, 92));
  g.push(txt(278, 80, '10.0.12.0/30', { mono: true, taille: 11, couleur: S }), txt(443, 80, '10.0.23.0/30', { mono: true, taille: 11, couleur: S }));
  g.push(txt(240, 110, '.1', { mono: true, taille: 11, couleur: CYAN, ancre: 'start' }), txt(316, 110, '.2', { mono: true, taille: 11, couleur: CYAN, ancre: 'end' }));
  g.push(boite(60, 150, 290, 82, { bord: OK, trait: 1.8 }), txt(205, 172, '→ aller, sur R1', { gras: true, couleur: OK, taille: 13 }),
    txt(205, 196, 'ip route 192.168.3.0 255.255.255.0 10.0.12.2', { mono: true, taille: 10.5, couleur: CYAN }), txt(205, 216, 'vers LAN 3, passer par R2 (10.0.12.2)', { taille: 11.5, couleur: S }));
  g.push(boite(370, 150, 290, 82, { bord: WARN, trait: 1.8 }), txt(515, 172, '← retour, sur R3', { gras: true, couleur: WARN, taille: 13 }),
    txt(515, 196, 'ip route 192.168.1.0 255.255.255.0 10.0.23.1', { mono: true, taille: 10.5, couleur: CYAN }), txt(515, 216, 'vers LAN 1, passer par R2 (10.0.23.1)', { taille: 11.5, couleur: S }));
  g.push(txt(360, 258, 'R2 aussi a besoin d’une route vers chaque LAN qu’il ne touche pas.', { taille: 12.5, couleur: S }));
  return svg({
    id: 'sc-rt-statique', largeur: 720, hauteur: 274, titre: 'Routes statiques aller et retour entre trois routeurs',
    desc: 'Trois routeurs R1, R2 et R3 en ligne. Le réseau LAN 1 est derrière R1 et LAN 3 derrière R3. R1 a une route statique vers LAN 3 via 10.0.12.2, et R3 une route vers LAN 1 via 10.0.23.1. Sans la route retour, le ping n’aboutit pas.',
    corps: g.join(''),
  });
}

// 4. Lire la table de routage ----------------------------------------------------
function rtTable() {
  const L = [['C', 'C    192.168.5.64/27 is directly connected, Gi0/0', 'réseau directement connecté', OK], ['L', 'L    192.168.5.94/32 is directly connected, Gi0/0', 'adresse de l’interface elle-même', CYAN],
    ['S', 'S    192.168.5.160/27 [1/0] via 10.123.145.106', 'route statique, distance 1', WARN], ['R', 'R    192.168.5.224/27 [120/2] via 10.123.145.57', 'route RIP : distance 120, 2 sauts', ACC],
    ['S*', 'S*   0.0.0.0/0 [1/0] via 10.123.145.58', 'route statique par défaut', WARN]];
  const g = [txt(360, 22, 'Lire show ip route (exemple écrit à la main)', { gras: true, taille: 15 })];
  L.forEach((l, i) => {
    const y = 44 + i * 40;
    g.push(boite(14, y, 690, 34, { fond: CASE, bord: l[3], trait: 1.6, r: 6 }), txt(60, y + 22, l[1], { ancre: 'start', mono: true, taille: 11.5 }), txt(690, y + 22, l[2], { ancre: 'end', taille: 11.5, couleur: l[3] }));
  });
  g.push(txt(360, 262, '[distance/métrique] : la distance administrative dit la confiance (0 connecté, 1 statique, 120 RIP) ; la plus basse gagne.', { taille: 12, couleur: S }));
  g.push(txt(360, 282, 'À masques différents, le plus long (le plus précis) l’emporte.', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-rt-table', largeur: 720, hauteur: 298, titre: 'Les codes d’une table de routage',
    desc: 'Cinq lignes d’exemple de show ip route. C : réseau directement connecté. L : adresse locale de l’interface. S : route statique avec distance 1. R : route RIP avec distance 120 et nombre de sauts. S* : route statique par défaut.',
    corps: g.join(''),
  });
}

// 5. Route flottante -------------------------------------------------------------
function rtFlottante() {
  const g = [txt(180, 22, 'Fonctionnement normal', { gras: true, taille: 14 }), txt(540, 22, 'Lien principal coupé', { gras: true, taille: 14 }), ligne(360, 12, 360, 236, { couleur: BORD, largeur: 1, tirets: true })];
  const bloc = (x0, principalOk) => {
    g.push(routeur(x0 + 20, 90, 'R1'), routeur(x0 + 250, 90, 'R3'), routeur(x0 + 135, 170, 'R2'));
    g.push(ligne(x0 + 90, 105, x0 + 250, 105, { couleur: principalOk ? OK : KO, largeur: 4, tirets: !principalOk }));
    g.push(txt(x0 + 170, 94, principalOk ? '✓ distance 1 (utilisé)' : '✗ lien coupé', { couleur: principalOk ? OK : KO, taille: 12, gras: true }));
    g.push(ligne(x0 + 55, 130, x0 + 150, 170, { couleur: principalOk ? BORD : WARN, largeur: 3, tirets: principalOk }), ligne(x0 + 220, 170, x0 + 285, 130, { couleur: principalOk ? BORD : WARN, largeur: 3, tirets: principalOk }));
    g.push(txt(x0 + 170, 218, principalOk ? '⊘ distance 5 (en réserve)' : '✓ distance 5 (prend le relais)', { couleur: principalOk ? S : WARN, taille: 12, gras: true }));
  };
  bloc(0, true); bloc(360, false);
  g.push(txt(360, 252, 'La route de secours « flotte » : sa distance plus grande la garde cachée tant que la principale existe.', { taille: 12.5, couleur: S }));
  return svg({
    id: 'sc-rt-flottante', largeur: 720, hauteur: 268, titre: 'Route statique flottante : le secours prend le relais',
    desc: 'À gauche, R1 joint R3 par le lien direct, de distance 1, et le chemin de secours par R2, de distance 5, reste en réserve. À droite, le lien direct est coupé : le chemin par R2 prend le relais.',
    corps: g.join(''),
  });
}

// 6. RIP : principe ----------------------------------------------------------------
function ripPrincipe() {
  const g = [txt(360, 22, 'RIP : chaque routeur annonce ses routes à ses voisins', { gras: true, taille: 15 })];
  g.push(routeur(60, 70, 'R1'), routeur(325, 70, 'R2'), routeur(590, 70, 'R3'));
  g.push(ligne(130, 90, 325, 90, { couleur: BORD }), ligne(395, 90, 590, 90, { couleur: BORD }));
  g.push(fl(160, 62, 300, 62, { couleur: CYAN }), fl(300, 118, 160, 118, { couleur: CYAN }), fl(425, 62, 565, 62, { couleur: CYAN }), fl(565, 118, 425, 118, { couleur: CYAN }));
  g.push(txt(230, 54, 'toutes les 30 s', { taille: 11.5, couleur: CYAN }), txt(495, 54, 'toutes les 30 s', { taille: 11.5, couleur: CYAN }));
  g.push(boite(14, 150, 200, 78, { bord: OK }), txt(114, 172, 'R1 voit LAN 3', { gras: true, taille: 13 }), txt(114, 194, '✓ à 2 sauts, via R2', { couleur: OK, taille: 12.5 }), txt(114, 214, 'métrique 2', { mono: true, taille: 11.5, couleur: S }));
  g.push(boite(260, 150, 200, 78, { bord: WARN }), txt(360, 172, 'Limite : 15 sauts', { gras: true, taille: 13 }), txt(360, 194, '⚠ 16 = inaccessible', { couleur: WARN, taille: 12.5 }), txt(360, 214, 'distance administrative 120', { mono: true, taille: 11, couleur: S }));
  g.push(boite(506, 150, 200, 78, { bord: ACC }), txt(606, 172, 'RIPv2', { gras: true, taille: 13 }), txt(606, 194, '✓ envoie le masque', { couleur: OK, taille: 12.5 }), txt(606, 214, 'RIPv1 : sans masque', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-rip-principe', largeur: 720, hauteur: 244, titre: 'Principe de RIP : annonces toutes les 30 secondes',
    desc: 'Trois routeurs R1, R2 et R3 en ligne échangent leurs routes toutes les 30 secondes. R1 connaît le réseau de R3 à deux sauts. RIP compte au plus 15 sauts et considère 16 comme inaccessible. RIPv2 transmet le masque, RIPv1 non.',
    corps: g.join(''),
  });
}

// 7. RIP : résumé automatique -----------------------------------------------------
function ripResume() {
  const g = [txt(180, 22, 'auto-summary activé (RIPv1 / par défaut)', { gras: true, taille: 13, couleur: KO }), txt(540, 22, 'no auto-summary (RIPv2)', { gras: true, taille: 13, couleur: OK }), ligne(360, 12, 360, 252, { couleur: BORD, largeur: 1, tirets: true })];
  const cote = (x0, bon) => {
    g.push(boite(x0 + 10, 50, 150, 38, { bord: CYAN }), txt(x0 + 85, 74, '172.16.1.0/24', { mono: true, taille: 12 }));
    g.push(boite(x0 + 190, 50, 150, 38, { bord: CYAN }), txt(x0 + 265, 74, '172.16.2.0/24', { mono: true, taille: 12 }));
    g.push(boite(x0 + 90, 120, 170, 40, { fond: CASE, bord: bon ? OK : KO, r: 8 }), txt(x0 + 175, 145, 'réseau 10.0.0.0 entre eux', { taille: 11.5, couleur: S }));
    g.push(fl(x0 + 85, 90, x0 + 130, 118, { couleur: bon ? OK : KO }), fl(x0 + 265, 90, x0 + 220, 118, { couleur: bon ? OK : KO }));
    g.push(txt(x0 + 175, 186, bon ? 'annonce chaque /24 séparément' : 'annonce 172.16.0.0/16 aux deux bouts', { mono: true, taille: 11.5, couleur: bon ? OK : KO }));
    g.push(txt(x0 + 175, 208, bon ? '✓ chaque réseau est atteint' : '✗ ambigu : le trafic peut aller au mauvais endroit', { taille: 12, gras: true, couleur: bon ? OK : KO }));
  };
  cote(0, false); cote(360, true);
  g.push(txt(360, 244, 'Réseaux discontinus : sans no auto-summary, RIP les regroupe en réseau de classe et se trompe.', { taille: 12.5, couleur: S }));
  return svg({
    id: 'sc-rip-resume', largeur: 720, hauteur: 260, titre: 'Pourquoi désactiver le résumé automatique',
    desc: 'Deux sous-réseaux 172.16.1.0/24 et 172.16.2.0/24 sont séparés par un autre réseau. Avec le résumé automatique, chacun annonce 172.16.0.0/16, ce qui crée une ambiguïté. Avec no auto-summary, chaque /24 est annoncé séparément et atteint sa destination.',
    corps: g.join(''),
  });
}

// 8. États d'un port -----------------------------------------------------------------
function swEtatsPort() {
  const L = [[{ t: 'up / up', c: OK, gras: true, mono: true }, '✓ en service', 'rien à faire'], [{ t: 'down / down', c: KO, gras: true, mono: true }, '✗ pas de lien', 'câble, autre bout éteint'],
    [{ t: 'admin down', c: WARN, gras: true, mono: true }, '⚠ éteint (shutdown)', 'no shutdown si voulu'], [{ t: 'up / down', c: WARN, gras: true, mono: true }, '⚠ lien sans protocole', 'comparer les deux bouts'],
    [{ t: 'err-disabled', c: KO, gras: true, mono: true }, '✗ coupé par une protection', 'corriger, shutdown puis no shutdown']];
  const g = [txt(360, 22, 'Que dit « show interfaces » ?', { gras: true, taille: 15 }), tableau(20, 36, [170, 220, 290], ['État / protocole', 'Sens', 'Premier geste'], L, { h: 34 }),
    txt(360, 262, 'Erreurs CRC et collisions tardives avec un lien « up » : pense à un duplex mismatch ou à un mauvais câble.', { taille: 12.5, couleur: S })];
  return svg({
    id: 'sc-sw-etats-port', largeur: 720, hauteur: 282, titre: 'Lire l’état d’un port de commutateur',
    desc: 'Cinq états : up/up en service ; down/down sans lien physique ; administratively down port éteint par shutdown ; up/down lien sans protocole, à comparer aux deux bouts ; err-disabled port coupé par une protection, à corriger puis à rallumer.',
    corps: g.join(''),
  });
}

// 9. Modes de violation ---------------------------------------------------------------
function swPortsecModes() {
  const L = [[{ t: 'protect', gras: true, mono: true, c: CYAN }, oui('ignorées'), non(), non(), non()], [{ t: 'restrict', gras: true, mono: true, c: WARN }, oui('ignorées'), oui('journal'), oui('compteur'), non()],
    [{ t: 'shutdown', gras: true, mono: true, c: KO }, oui('ignorées'), oui('journal'), oui('compteur'), oui('err-disabled')]];
  const g = [txt(360, 22, 'Que fait le port quand une adresse non autorisée apparaît ?', { gras: true, taille: 14.5 }),
    tableau(14, 36, [100, 130, 130, 140, 190], ['Mode', 'Trames illégales', 'Message', 'Violations', 'Port coupé'], L, { h: 40 }),
    txt(360, 222, 'shutdown est le mode par défaut. Pour rallumer : shutdown puis no shutdown, après avoir retiré l’appareil fautif.', { taille: 12.5, couleur: S }),
    txt(360, 242, 'Adresses : statique (écrite à la main), dynamique (perdue au redémarrage) ou sticky (apprise et gardée).', { taille: 12.5, couleur: S })];
  return svg({
    id: 'sc-sw-portsec', largeur: 720, hauteur: 258, titre: 'Les trois modes de violation de la sécurité des ports',
    desc: 'protect ignore les trames illégales sans rien dire. restrict les ignore, journalise un message et compte les violations. shutdown fait la même chose et coupe en plus le port, qui passe en err-disabled.',
    corps: g.join(''),
  });
}

// 10. Ordre de SSH ------------------------------------------------------------------------
function swSsh() {
  const E = [['1', 'Nom d’hôte', 'hostname SW1'], ['2', 'Domaine', 'ip domain-name lab.local'], ['3', 'Clé RSA', 'crypto key generate rsa'], ['4', 'Compte local', 'username admin … secret'], ['5', 'Lignes vty', 'login local · transport input ssh'], ['6', 'Version 2', 'ip ssh version 2']];
  const g = [txt(360, 22, 'Activer SSH : l’ordre compte', { gras: true, taille: 15 })];
  E.forEach((s, i) => {
    const c = i % 3; const r = Math.floor(i / 3); const x = 14 + c * 236; const y = 40 + r * 112;
    g.push(boite(x, y, 224, 98, { bord: i === 2 ? WARN : BORD, trait: 1.8, r: 10 }), `<circle cx="${x + 24}" cy="${y + 24}" r="13" fill="${ACC}"/>` + txt(x + 24, y + 29, s[0], { couleur: 'var(--on-accent,#17112e)', gras: true, taille: 14 }));
    g.push(txt(x + 120, y + 30, s[1], { gras: true, taille: 13.5 }), txt(x + 112, y + 70, s[2], { mono: true, taille: 10, couleur: CYAN }));
  });
  g.push(txt(360, 282, 'La clé RSA a besoin du nom d’hôte ET du domaine ; la générer active SSH. Telnet cesse alors si transport input ssh.', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-sw-ssh', largeur: 720, hauteur: 298, titre: 'Ordre de configuration de SSH sur un commutateur',
    desc: 'Six étapes : nom d’hôte, nom de domaine, génération de la clé RSA, compte local, lignes vty avec login local et transport ssh, puis SSH version 2.',
    corps: g.join(''),
  });
}

// 11. Modes VTP --------------------------------------------------------------------------------
function vtpModes() {
  const L = [[{ t: 'serveur', gras: true, c: OK }, oui(), oui(), oui(), oui('vlan.dat')], [{ t: 'client', gras: true, c: CYAN }, non(), oui(), oui(), non()], [{ t: 'transparent', gras: true, c: WARN }, oui('local'), oui('relaie'), non(), oui('local')]];
  const g = [txt(360, 22, 'Les trois modes VTP', { gras: true, taille: 15 }), tableau(14, 36, [120, 150, 140, 140, 140], ['Mode', 'Crée des VLAN', 'Annonce / relaie', 'Se synchronise', 'Garde en mémoire'], L, { h: 42 }),
    txt(360, 232, 'Par défaut, un commutateur est SERVEUR : celui qu’on ajoute à un réseau doit être remis à neuf avant.', { taille: 12.5, couleur: S }),
    txt(360, 252, 'VTP ne circule que sur des trunks, avec le même domaine et le même mot de passe.', { taille: 12.5, couleur: S })];
  return svg({
    id: 'sc-vtp-modes', largeur: 720, hauteur: 270, titre: 'Comparer les modes VTP serveur, client et transparent',
    desc: 'Le serveur crée, annonce, se synchronise et garde les VLAN en mémoire. Le client ne crée rien, relaie et se synchronise. Le mode transparent crée localement, relaie les annonces, ne se synchronise pas et garde ses VLAN locaux.',
    corps: g.join(''),
  });
}

// 12. Piège du numéro de révision --------------------------------------------------------------------
function vtpRevision() {
  const g = [txt(360, 22, 'Le piège : un nouveau commutateur avec une révision plus élevée', { gras: true, taille: 14.5 })];
  g.push(commutateur(40, 70, 'S1 serveur', { w: 120, bord: OK }), commutateur(300, 70, 'S2 client', { w: 120 }), commutateur(560, 70, 'S4 neuf ?', { w: 120, bord: KO }));
  g.push(txt(100, 138, 'révision 12', { mono: true, taille: 12.5, couleur: S }), txt(360, 138, 'révision 12', { mono: true, taille: 12.5, couleur: S }), txt(620, 138, 'révision 35', { mono: true, taille: 12.5, couleur: KO, gras: true }));
  g.push(ligne(160, 92, 300, 92), ligne(420, 92, 560, 92, { couleur: KO }));
  g.push(fl(560, 168, 440, 168, { couleur: KO, largeur: 3 }), fl(440, 190, 160, 190, { couleur: KO, largeur: 3, tirets: true }));
  g.push(txt(500, 160, 'S4 « gagne »', { couleur: KO, taille: 12, gras: true }), txt(300, 184, 'sa base de VLAN remplace celle du réseau', { couleur: KO, taille: 12 }));
  g.push(boite(40, 212, 640, 46, { bord: WARN, trait: 1.8 }), txt(360, 232, '⚠ Avant de brancher un commutateur d’occasion : remets-le à neuf (révision 0)', { taille: 12, couleur: WARN }), txt(360, 250, 'ou passe-le en mode transparent. Un même domaine et mot de passe ne protègent pas.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-vtp-revision', largeur: 720, hauteur: 274, titre: 'Piège VTP : le numéro de révision le plus élevé gagne',
    desc: 'S1 serveur et S2 client sont en révision 12. S4, ajouté sans avoir été remis à neuf, est en révision 35 avec le même domaine. Sa base de VLAN remplace celle du réseau. Il faut le remettre à neuf ou le passer en mode transparent avant.',
    corps: g.join(''),
  });
}

// 13. Modes DTP --------------------------------------------------------------------------------------
function dtpModes() {
  const M = ['auto', 'desirable', 'trunk', 'access'];
  const R = { auto: [non('accès'), oui('trunk'), oui('trunk'), non('accès')], desirable: [oui('trunk'), oui('trunk'), oui('trunk'), non('accès')], trunk: [oui('trunk'), oui('trunk'), oui('trunk'), att('conflit')], access: [non('accès'), non('accès'), att('conflit'), non('accès')] };
  const lignes = M.map((m) => [{ t: m, gras: true, mono: true, c: CYAN }, ...R[m]]);
  const g = [txt(360, 22, 'Résultat de la négociation selon les deux modes', { gras: true, taille: 15 }), txt(450, 48, 'mode de l’autre extrémité →', { taille: 12, couleur: S }),
    tableau(30, 56, [120, 135, 135, 135, 135], ['ce port ↓', 'auto', 'desirable', 'trunk', 'access'], lignes, { h: 34 }),
    txt(360, 252, 'Deux « auto » ne forment pas de trunk. « trunk » face à « access » : liens incohérents, rien de fiable.', { taille: 12.5, couleur: S }),
    txt(360, 272, 'Le plus sûr : fixer les deux bouts en trunk (ou en access) et couper la négociation.', { taille: 12.5, couleur: S })];
  return svg({
    id: 'sc-dtp-modes', largeur: 720, hauteur: 288, titre: 'Quels modes DTP forment un trunk',
    desc: 'Matrice des modes auto, desirable, trunk et access de chaque côté. Un trunk se forme quand un côté est trunk ou desirable face à auto, desirable ou trunk. Deux auto donnent un lien d’accès. Trunk face à access est un conflit.',
    corps: g.join(''),
  });
}

// 14. Topologie du TP2 --------------------------------------------------------------------------------------
function tp2Topologie() {
  const g = [txt(360, 22, 'TP2 : trois routeurs, trois LAN, trois liens série', { gras: true, taille: 15 })];
  g.push(routeur(325, 56, 'R1'), routeur(120, 196, 'R2'), routeur(530, 196, 'R3'));
  g.push(ligne(350, 96, 175, 196, { couleur: ACC }), ligne(380, 96, 565, 196, { couleur: ACC }), ligne(190, 224, 530, 224, { couleur: ACC }));
  g.push(txt(238, 142, '10.123.145.104/29', { mono: true, taille: 10.5, couleur: CYAN, ancre: 'end' }), txt(480, 142, '10.123.145.56/29', { mono: true, taille: 10.5, couleur: CYAN, ancre: 'start' }), txt(360, 216, '10.123.145.72/29', { mono: true, taille: 10.5, couleur: CYAN }));
  g.push(boite(290, 252, 140, 26, { bord: WARN, r: 6 }), txt(360, 270, '⚠ absent du tableau 1', { taille: 10.5, couleur: WARN }));
  g.push(boite(455, 40, 190, 42, { bord: CYAN }), txt(550, 58, 'A-163 : 192.168.5.64/27', { mono: true, taille: 10.5 }), txt(550, 74, 'R1 Gi0/0 = .94', { mono: true, taille: 10.5, couleur: S }));
  g.push(boite(14, 252, 190, 42, { bord: CYAN }), txt(109, 270, 'B-666 : 192.168.5.224/27', { mono: true, taille: 10.5 }), txt(109, 286, 'R2 Gi0/0 = .254', { mono: true, taille: 10.5, couleur: S }));
  g.push(boite(516, 252, 190, 42, { bord: CYAN }), txt(611, 270, 'B-235 : 192.168.5.160/27', { mono: true, taille: 10.5 }), txt(611, 286, 'R3 Gi0/0 = .190', { mono: true, taille: 10.5, couleur: S }));
  return svg({
    id: 'sc-tp2-topologie', largeur: 720, hauteur: 306, titre: 'Topologie du TP2 : trois routeurs et trois liens série',
    desc: 'R1, R2 et R3 forment un triangle de liens série : R1-R2 en 10.123.145.104/29, R1-R3 en 10.123.145.56/29 et R2-R3 en 10.123.145.72/29, ce dernier absent du premier tableau de l’énoncé. Chaque routeur a un LAN : A-163 en 192.168.5.64/27 sur R1, B-666 en 192.168.5.224/27 sur R2 et B-235 en 192.168.5.160/27 sur R3.',
    corps: g.join(''),
  });
}

export const SCHEMAS_RESEAU = {
  'vlsm-masques': { titre: 'Masques de /24 à /30', legende: 'Préfixe, masque, nombre d’adresses et d’hôtes utilisables (adresses moins deux), avec le pas entre deux réseaux.', svg: vlsmMasques },
  'vlsm-decoupage': { titre: 'Découpage VLSM d’un /24', legende: 'On range les besoins du plus grand au plus petit ; chaque bloc commence où le précédent finit.', svg: vlsmDecoupage },
  'rt-statique': { titre: 'Routes statiques aller et retour', legende: 'Chaque routeur écrit la route vers les réseaux lointains ; sans la route retour, le ping échoue.', svg: rtStatique },
  'rt-table': { titre: 'Lire une table de routage', legende: 'Codes C, L, S, R et S* ; entre crochets, la distance administrative et la métrique.', svg: rtTable },
  'rt-flottante': { titre: 'Route statique flottante', legende: 'La route de secours a une distance plus grande : elle reste cachée tant que la principale existe.', svg: rtFlottante },
  'rip-principe': { titre: 'Principe de RIP', legende: 'Annonces toutes les 30 secondes, limite de 15 sauts, RIPv2 transmet le masque.', svg: ripPrincipe },
  'rip-resume-auto': { titre: 'Résumé automatique de RIP', legende: 'Avec des réseaux discontinus, le résumé automatique brouille les routes : on le désactive.', svg: ripResume },
  'sw-etats-port': { titre: 'États d’un port', legende: 'Cinq états d’un port et le premier geste pour chacun, avec symbole et mot.', svg: swEtatsPort },
  'sw-portsec-modes': { titre: 'Modes de violation de la sécurité des ports', legende: 'protect ignore, restrict ignore et journalise, shutdown coupe aussi le port (err-disabled).', svg: swPortsecModes },
  'sw-ssh-ordre': { titre: 'Ordre de configuration de SSH', legende: 'Nom, domaine, clé RSA, compte, lignes vty, version 2 : la clé a besoin des deux premiers.', svg: swSsh },
  'vtp-modes': { titre: 'Modes VTP : serveur, client, transparent', legende: 'Serveur, client et transparent : qui crée, qui relaie, qui se synchronise.', svg: vtpModes },
  'vtp-revision': { titre: 'Piège du numéro de révision VTP', legende: 'Un commutateur ajouté avec une révision plus élevée remplace la base de VLAN de tout le domaine.', svg: vtpRevision },
  'dtp-modes': { titre: 'Modes DTP et trunk', legende: 'Matrice de négociation : un trunk se forme si un bout propose et que l’autre accepte.', svg: dtpModes },
  'tp2-topologie': { titre: 'Topologie du TP2', legende: 'Trois routeurs en triangle, un LAN par routeur et le lien R2-R3 à ne pas oublier.', svg: tp2Topologie },
};

/** Outils de dessin partagés avec les autres modules de schémas (semaine 9…). */
export const DESSIN = { svg, txt, boite, ligne, fl, routeur, nuage, tableau, oui, non, att, T, S, FOND, CASE, BORD, ACC, CYAN, OK, KO, WARN };
