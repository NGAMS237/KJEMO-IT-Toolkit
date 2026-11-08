/**
 * schemas-cisco-tp-etherchannel.mjs — CISCO-TP-ETHERCHANNEL-02 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Six schémas ORIGINAUX (SVG en ligne) pour les deux TP EtherChannel : « Configurer EtherChannel »
 * (S1, S2, S3) et « Implémenter EtherChannel » (SWA, SWB, SWC) :
 *   - la topologie de chaque TP (trois commutateurs, trois canaux, ports, protocoles, modes) ;
 *   - qui propose et qui répond dans chaque canal (un schéma par TP) ;
 *   - la correspondance entre les noms de l'exercice SWA/SWB/SWC et les champs S1/S2/S3 de la fiche ;
 *   - Spanning Tree avant et après « root primary » sur S1.
 * Module PUR (aucun DOM). Mêmes règles que schemas-cisco.mjs : titre, texte alternatif, légende, état
 * dit par un symbole ET un mot, thèmes clair/sombre. Ports et modes = EXEMPLES de laboratoire.
 */
import { DESSIN } from './schemas-cisco-reseau.mjs';

const { svg, txt, boite, ligne, fl, tableau, T, S, BORD, ACC, CYAN, OK, KO, WARN } = DESSIN;

/** Deux traits parallèles : un canal = deux câbles regroupés. */
const canalLigne = (x1, y1, x2, y2, couleur) => {
  const dx = x2 - x1; const dy = y2 - y1; const n = Math.hypot(dx, dy) || 1;
  const ox = (-dy / n) * 4; const oy = (dx / n) * 4;
  return ligne(x1 + ox, y1 + oy, x2 + ox, y2 + oy, { couleur, largeur: 3 }) + ligne(x1 - ox, y1 - oy, x2 - ox, y2 - oy, { couleur, largeur: 3 });
};
const sur = (x1, y1, x2, y2, t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
const commut = (x, y, nom, { w = 130, h = 50, bord = BORD, sous = '' } = {}) =>
  boite(x, y, w, h, { bord, trait: 2.2, r: 8 }) + txt(x + w / 2, y + (sous ? 22 : 30), nom, { gras: true, taille: 16 }) + (sous ? txt(x + w / 2, y + 40, sous, { taille: 10.5, couleur: S }) : '');

// 1. Topologie d'un TP (paramétrée) ------------------------------------------------------------
/** noms = [premier, deuxième, troisième] (haut gauche, haut droit, bas) ; canaux : de 0/1/2 vers 0/1/2. */
function topologie({ id, noms, canaux, titre, desc, pied }) {
  const [A, B, C] = [[40, 54], [550, 54], [295, 248]];
  const pos = [A, B, C].map(([x, y]) => [x + 65, y + 25]);
  const ancres = { '0-1': [[170, 79], [550, 79]], '0-2': [[85, 104], [320, 250]], '1-2': [[635, 104], [400, 250]] };
  const g = [txt(360, 24, titre, { gras: true, taille: 15 })];
  const dessin = [];
  canaux.forEach((c) => {
    const [i, j] = c.de < c.vers ? [c.de, c.vers] : [c.vers, c.de];
    const [[x1, y1], [x2, y2]] = ancres[`${i}-${j}`];
    // premier bout = côté « de », second = côté « vers » (les ancres vont du plus petit au plus grand indice).
    const m = c.de < c.vers ? [c.modeDe, c.modeVers] : [c.modeVers, c.modeDe];
    g.push(canalLigne(x1, y1, x2, y2, c.couleur));
    const [mx, my] = sur(x1, y1, x2, y2, 0.5);
    const cle = `${i}-${j}`;
    const lx = cle === '0-1' ? mx : cle === '0-2' ? mx - 100 : mx + 100;
    const ly = cle === '0-1' ? my + 18 : my + 45;
    dessin.push(boite(lx - 80, ly, 160, 50, { bord: c.couleur, trait: 2, r: 8 }),
      txt(lx, ly + 17, `Canal ${c.po} · ${c.proto}`, { gras: true, taille: 12, couleur: c.couleur }),
      txt(lx, ly + 33, c.ports, { mono: true, taille: 11 }),
      txt(lx, ly + 46, c.note ?? '', { taille: 10, couleur: S }));
    // modes près des extrémités
    const [ax, ay] = sur(x1, y1, x2, y2, 0.14); const [bx, by] = sur(x1, y1, x2, y2, 0.86);
    const dy = cle === '0-1' ? -10 : 0;
    const dxm = cle === '0-2' ? -34 : cle === '1-2' ? 34 : 0;
    g.push(txt(ax + dxm, ay + dy + (dy ? 0 : 4), m[0], { mono: true, taille: 11, gras: true, couleur: c.couleur }), txt(bx + dxm, by + dy + (dy ? 0 : 4), m[1], { mono: true, taille: 11, gras: true, couleur: c.couleur }));
  });
  g.push(commut(A[0], A[1], noms[0], { bord: ACC }), commut(B[0], B[1], noms[1], { bord: ACC }), commut(C[0], C[1], noms[2], { bord: ACC }), ...dessin);
  void pos;
  g.push(txt(360, 338, pied, { taille: 11, couleur: S }));
  return svg({ id, largeur: 720, hauteur: 352, titre, desc, corps: g.join('') });
}

const topoS = () => topologie({
  id: 'sc-tp-ec-s', noms: ['S1', 'S3', 'S2'], titre: 'Topologie du TP « Configurer EtherChannel » (S1, S2, S3)',
  desc: 'Trois commutateurs en triangle, chaque paire reliée par un canal de deux câbles. Canal 1 entre S1 et S3 sur Fa0/21 et Fa0/22 en PAgP, desirable des deux côtés. Canal 2 entre S1 et S2 sur Gi0/1 et Gi0/2 en LACP, active des deux côtés. Canal 3 entre S2 et S3 sur Fa0/23 et Fa0/24 en LACP négocié : passive sur S2, active sur S3.',
  canaux: [
    { de: 0, vers: 1, po: 1, proto: 'PAgP', ports: 'Fa0/21 – Fa0/22', note: 'S1 ↔ S3', modeDe: 'desirable', modeVers: 'desirable', couleur: ACC },
    { de: 0, vers: 2, po: 2, proto: 'LACP', ports: 'Gi0/1 – Gi0/2', note: 'S1 ↔ S2', modeDe: 'active', modeVers: 'active', couleur: CYAN },
    { de: 1, vers: 2, po: 3, proto: 'LACP négocié', ports: 'Fa0/23 – Fa0/24', note: 'S3 ↔ S2', modeDe: 'active', modeVers: 'passive', couleur: OK },
  ],
  pied: 'Chaque canal = deux câbles = un seul lien logique PoN. Valeurs d’exemple : dans la fiche, chacune est un champ.',
});

const topoSwa = () => topologie({
  id: 'sc-tp-ec-swa', noms: ['SWA', 'SWB', 'SWC'], titre: 'Topologie du TP « Implémenter EtherChannel » (SWA, SWB, SWC)',
  desc: 'Trois commutateurs 2960 en triangle. Canal 1 entre SWA et SWB sur Gi0/1 et Gi0/2 en PAgP, desirable des deux côtés. Canal 2 entre SWA et SWC sur Fa0/21 et Fa0/22 en LACP, active des deux côtés. Canal 3 entre SWB et SWC sur Fa0/23 et Fa0/24 en LACP de sauvegarde : SWC active et lance la négociation, SWB passive et répond.',
  canaux: [
    { de: 0, vers: 1, po: 1, proto: 'PAgP', ports: 'Gi0/1 – Gi0/2', note: 'SWA ↔ SWB', modeDe: 'desirable', modeVers: 'desirable', couleur: ACC },
    { de: 0, vers: 2, po: 2, proto: 'LACP', ports: 'Fa0/21 – Fa0/22', note: 'SWA ↔ SWC', modeDe: 'active', modeVers: 'active', couleur: CYAN },
    { de: 1, vers: 2, po: 3, proto: 'LACP', ports: 'Fa0/23 – Fa0/24', note: 'SWB ↔ SWC · sauvegarde', modeDe: 'passive', modeVers: 'active', couleur: OK },
  ],
  pied: 'SWC propose, SWB répond. Aucun câble n’est branché en plus : un canal est deux câbles regroupés.',
});

// 2. Qui propose, qui répond ----------------------------------------------------------------
function propose({ id, titre, desc, lignes }) {
  const g = [txt(360, 24, titre, { gras: true, taille: 15 })];
  lignes.forEach((l, k) => {
    const y = 46 + k * 100;
    g.push(boite(14, y, 692, 88, { fond: 'none', bord: l.couleur, trait: 1.5, r: 10 }),
      txt(360, y + 18, `Canal ${l.po} · ${l.proto} · ${l.ports}`, { gras: true, taille: 12.5, couleur: l.couleur }),
      commut(34, y + 28, l.a, { w: 100, h: 40 }), commut(586, y + 28, l.b, { w: 100, h: 40 }),
      txt(84, y + 82, l.modeA, { mono: true, taille: 11.5, gras: true }), txt(636, y + 82, l.modeB, { mono: true, taille: 11.5, gras: true }));
    if (l.deux) {
      g.push(fl(140, y + 40, 580, y + 40, { couleur: l.couleur, largeur: 2.5 }), fl(580, y + 58, 140, y + 58, { couleur: l.couleur, largeur: 2.5 }));
      g.push(txt(360, y + 36, `${l.a} propose`, { taille: 10.5, couleur: S }), txt(360, y + 74, `${l.b} propose aussi`, { taille: 10.5, couleur: S }));
    } else {
      g.push(fl(140, y + 40, 580, y + 40, { couleur: l.couleur, largeur: 2.5 }), fl(580, y + 58, 140, y + 58, { couleur: l.couleur, largeur: 2, tirets: true }));
      g.push(txt(360, y + 36, `${l.a} propose`, { taille: 10.5, couleur: S }), txt(360, y + 74, `${l.b} répond (n’écrit pas le premier)`, { taille: 10.5, couleur: S }));
    }
    g.push(txt(360, y + 54, `✓ ${l.verdict}`, { taille: 11, couleur: OK, gras: true }));
  });
  return svg({ id, largeur: 720, hauteur: 352, titre, desc, corps: g.join('') });
}

const proposeS = () => propose({
  id: 'sc-tp-ec-propose-s', titre: 'Qui propose, qui répond (S1, S2, S3)',
  desc: 'Canal 1 : S1 et S3 sont tous deux en desirable, les deux proposent PAgP. Canal 2 : S1 et S2 sont tous deux en active, les deux proposent LACP. Canal 3 : S3 est en active et propose LACP, S2 est en passive et répond seulement : le canal se forme parce qu’un bout au moins propose.',
  lignes: [
    { po: 1, proto: 'PAgP', ports: 'Fa0/21-22', a: 'S1', b: 'S3', modeA: 'desirable', modeB: 'desirable', deux: true, verdict: 'les deux proposent : canal formé', couleur: ACC },
    { po: 2, proto: 'LACP', ports: 'Gi0/1-2', a: 'S1', b: 'S2', modeA: 'active', modeB: 'active', deux: true, verdict: 'les deux proposent : canal formé', couleur: CYAN },
    { po: 3, proto: 'LACP négocié', ports: 'Fa0/23-24', a: 'S3', b: 'S2', modeA: 'active', modeB: 'passive', deux: false, verdict: 'un propose, l’autre répond : canal formé', couleur: OK },
  ],
});

const proposeSwa = () => propose({
  id: 'sc-tp-ec-propose-swa', titre: 'Qui propose, qui répond (SWA, SWB, SWC)',
  desc: 'Canal 1 : SWA et SWB sont tous deux en desirable, les deux proposent PAgP. Canal 2 : SWA et SWC sont tous deux en active, les deux proposent LACP. Canal 3 : SWC est en active et propose LACP, SWB est en passive et répond seulement : le canal de sauvegarde se forme parce que SWC lance la négociation.',
  lignes: [
    { po: 1, proto: 'PAgP', ports: 'Gi0/1-2', a: 'SWA', b: 'SWB', modeA: 'desirable', modeB: 'desirable', deux: true, verdict: 'les deux proposent : canal formé', couleur: ACC },
    { po: 2, proto: 'LACP', ports: 'Fa0/21-22', a: 'SWA', b: 'SWC', modeA: 'active', modeB: 'active', deux: true, verdict: 'les deux proposent : canal formé', couleur: CYAN },
    { po: 3, proto: 'LACP de sauvegarde', ports: 'Fa0/23-24', a: 'SWC', b: 'SWB', modeA: 'active', modeB: 'passive', deux: false, verdict: 'SWC lance, SWB répond : canal formé', couleur: OK },
  ],
});

// 3. Correspondance SWA, SWB, SWC <-> champs de la fiche ----------------------------------------
function correspondance() {
  const g = [txt(360, 24, 'Où saisir SWA, SWB, SWC dans la fiche', { gras: true, taille: 15 })];
  g.push(tableau(10, 40, [200, 130, 360], ['Dans l’exercice', 'Dans la fiche', 'Ce que tu saisis'], [
    [{ t: 'SWA', gras: true, c: ACC }, { t: 'S1', gras: true, mono: true }, { t: 'nom du commutateur S1 = SWA', taille: 11.5 }],
    [{ t: 'SWC', gras: true, c: ACC }, { t: 'S2', gras: true, mono: true }, { t: 'nom du commutateur S2 = SWC', taille: 11.5 }],
    [{ t: 'SWB', gras: true, c: ACC }, { t: 'S3', gras: true, mono: true }, { t: 'nom du commutateur S3 = SWB', taille: 11.5 }],
    [{ t: 'Canal 1 : SWA–SWB (PAgP)', taille: 11.5, c: ACC, gras: true }, { t: 'canal 1 (S1–S3)', taille: 11 }, { t: 'Gi0/1 et Gi0/2 · desirable / desirable', taille: 11.5, mono: true }],
    [{ t: 'Canal 2 : SWA–SWC (LACP)', taille: 11.5, c: CYAN, gras: true }, { t: 'canal 2 (S1–S2)', taille: 11 }, { t: 'Fa0/21 et Fa0/22 · active / active', taille: 11.5, mono: true }],
    [{ t: 'Canal 3 : SWB–SWC (LACP)', taille: 11.5, c: OK, gras: true }, { t: 'canal 3 (S2–S3)', taille: 11 }, { t: 'Fa0/23 et Fa0/24 · S2 (SWC) active · S3 (SWB) passive', taille: 11 }],
  ], { h: 34, taille: 12 }));
  g.push(boite(10, 290, 700, 46, { bord: WARN, trait: 1.6 }),
    txt(360, 310, '⚠ L’ordre des étapes de la fiche est S1, S2, S3 : donc SWA, SWC, SWB.', { taille: 12, couleur: WARN, gras: true }),
    txt(360, 327, 'Les étapes « racine de Spanning Tree » ne font pas partie de l’exercice : tu peux les sauter.', { taille: 11, couleur: S }));
  return svg({
    id: 'sc-tp-ec-correspondance', largeur: 720, hauteur: 346, titre: 'Correspondance entre les noms de l’exercice et les champs de la fiche',
    desc: 'SWA se saisit dans le champ du commutateur S1, SWC dans celui de S2 et SWB dans celui de S3. Le canal 1 SWA–SWB correspond au canal 1 de la fiche (Gi0/1 et Gi0/2, desirable des deux côtés), le canal 2 SWA–SWC au canal 2 (Fa0/21 et Fa0/22, active des deux côtés), le canal 3 SWB–SWC au canal 3 (Fa0/23 et Fa0/24, S2 en active et S3 en passive).',
    corps: g.join(''),
  });
}

// 4. Spanning Tree avant / après --------------------------------------------------------------
function stp() {
  const g = [txt(360, 22, 'Spanning Tree et les canaux : avant et après « root primary » sur S1', { gras: true, taille: 14.5 })];
  const panneau = (ox, titre, racine, etats) => {
    g.push(boite(ox, 36, 346, 270, { fond: 'none', bord: BORD, trait: 1.3, r: 10 }), txt(ox + 173, 56, titre, { gras: true, taille: 13, couleur: ACC }));
    const N = { S2: [ox + 123, 76], S1: [ox + 14, 214], S3: [ox + 222, 214] };
    const bord = (n) => (n === racine ? OK : BORD);
    // lignes (canaux)
    const L = { po2: [ox + 64, 214, ox + 150, 126], po3: [ox + 196, 126, ox + 282, 214], po1: [ox + 110, 238, ox + 222, 238] };
    g.push(canalLigne(...L.po2, CYAN), canalLigne(...L.po3, OK), canalLigne(...L.po1, ACC));
    Object.entries(N).forEach(([n, [x, y]]) => g.push(commut(x, y, n, { w: 100, h: 50, bord: bord(n), sous: n === racine ? '★ racine' : '' })));
    const etat = (x1, y1, x2, y2, t, e, dx, dy) => { const [x, y] = sur(x1, y1, x2, y2, t); const bon = e === 'FWD'; g.push(txt(x + dx, y + dy, bon ? '✓ FWD' : '⊘ BLK', { taille: 10.5, gras: true, couleur: bon ? OK : KO, mono: true })); };
    etat(...L.po2, 0.18, etats.po2[0], -28, 4); etat(...L.po2, 0.82, etats.po2[1], -28, 4);
    etat(...L.po3, 0.18, etats.po3[0], 28, 4); etat(...L.po3, 0.82, etats.po3[1], 28, 4);
    etat(...L.po1, 0.2, etats.po1[0], 0, 20); etat(...L.po1, 0.8, etats.po1[1], 0, 20);
    g.push(txt(ox + 80, 168, 'Po2 · Gi', { taille: 10, couleur: CYAN, mono: true }), txt(ox + 270, 168, 'Po3 · Fa', { taille: 10, couleur: OK, mono: true }), txt(ox + 173, 270, 'Po1 · Fa', { taille: 10, couleur: ACC, mono: true }));
  };
  panneau(10, 'Avant : S3 est racine', 'S3', { po2: ['BLK', 'FWD'], po3: ['FWD', 'FWD'], po1: ['FWD', 'FWD'] });
  panneau(364, 'Après : S1 est racine', 'S1', { po2: ['FWD', 'FWD'], po3: ['FWD', 'BLK'], po1: ['FWD', 'FWD'] });
  g.push(txt(360, 322, 'Avant, le canal Gigabit (Po2) est bloqué côté S1 : le plus rapide ne sert pas. Après, c’est le canal Fast Ethernet Po3 qui est bloqué.', { taille: 11, couleur: S }));
  g.push(txt(360, 338, 'Coût d’un canal : 9 en Fast Ethernet, 3 en Gigabit. Le bout bloqué de Po3 dépend des priorités ; ici, celui de S3 (coût le plus élevé).', { taille: 10.5, couleur: S }));
  return svg({
    id: 'sc-tp-ec-stp', largeur: 720, hauteur: 350, titre: 'Spanning Tree avant et après « root primary » sur S1',
    desc: 'Deux triangles S1, S2, S3. Avant : S3 est la racine ; le canal Po2 (Gigabit, entre S1 et S2) est bloqué côté S1, les canaux Po1 et Po3 transmettent. Après avoir fait de S1 la racine du VLAN 1 : Po1 et Po2 transmettent et c’est le canal Po3 (Fast Ethernet, entre S2 et S3) qui est bloqué côté S3. Le canal Gigabit n’est plus bloqué.',
    corps: g.join(''),
  });
}

export const SCHEMAS_TP_ETHERCHANNEL = {
  'tp-ec-topologie': { titre: 'Topologie du TP « Configurer EtherChannel » (S1, S2, S3)', legende: 'Trois commutateurs en triangle : un canal PAgP (S1–S3), un canal LACP (S1–S2) et un canal LACP négocié (S3 propose, S2 répond).', svg: topoS },
  'tp-ec-topologie-swa': { titre: 'Topologie du TP « Implémenter EtherChannel » (SWA, SWB, SWC)', legende: 'Même triangle sous d’autres noms : PAgP sur les ports Gigabit (SWA–SWB), LACP sur Fa0/21-22 (SWA–SWC) et LACP de sauvegarde sur Fa0/23-24 (SWC propose, SWB répond).', svg: topoSwa },
  'tp-ec-propose': { titre: 'Qui propose, qui répond (S1, S2, S3)', legende: 'Un canal se forme dès qu’un bout au moins propose : desirable ou active. Le canal 3 a un bout qui propose (active) et un qui répond (passive).', svg: proposeS },
  'tp-ec-propose-swa': { titre: 'Qui propose, qui répond (SWA, SWB, SWC)', legende: 'Dans le canal de sauvegarde, SWC lance la négociation et SWB répond seulement ; dans les deux autres canaux les deux bouts proposent.', svg: proposeSwa },
  'tp-ec-correspondance': { titre: 'Correspondance entre les noms de l’exercice et les champs de la fiche', legende: 'SWA va dans le champ de S1, SWC dans celui de S2 et SWB dans celui de S3 ; les ports et les modes de chaque canal sont donnés ligne par ligne.', svg: correspondance },
  'tp-ec-stp': { titre: 'Spanning Tree avant et après « root primary » sur S1', legende: 'Avec S3 racine, le canal Gigabit est bloqué ; en faisant de S1 la racine du VLAN 1, il transmet et c’est un canal Fast Ethernet qui reste en réserve.', svg: stp },
};
