/**
 * schemas-cisco-tp-vlan.mjs — KJEMO-CISCO-TP-VLAN-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Deux schémas ORIGINAUX (SVG en ligne) du TP « 3 VLAN, SSH et routage
 * inter-VLAN » : la topologie avec son plan d'adressage, puis le chemin d'un
 * paquet d'un VLAN à l'autre (étiquette 802.1Q sur le trunk). Module PUR (aucun
 * DOM). Mêmes règles que schemas-cisco-reseau.mjs : titre, texte alternatif,
 * légende, état dit par un symbole ET un mot, thèmes clair/sombre. Adresses =
 * EXEMPLES de laboratoire.
 */
import { DESSIN } from './schemas-cisco-reseau.mjs';

const { svg, txt, boite, ligne, fl, routeur, tableau, T, S, BORD, ACC, CYAN, OK } = DESSIN;

const poste = (x, y, nom, ip, couleur, port) => boite(x, y, 150, 58, { bord: couleur, trait: 2, r: 6 })
  + txt(x + 75, y + 19, nom, { gras: true, taille: 12.5 }) + txt(x + 75, y + 35, ip, { mono: true, taille: 10.5, couleur: S })
  + txt(x + 75, y + 50, port, { taille: 10.5, couleur, gras: true });

// 1. Topologie du TP ---------------------------------------------------------
function topologie() {
  const g = [txt(360, 22, 'TP : trois VLAN, un commutateur, un routeur', { gras: true, taille: 15 })];
  const postes = [
    [40, 'PC Ventes', '192.168.10.10', ACC, 'Fa0/1 · VLAN 10'],
    [110, 'PC Technique', '192.168.20.10', CYAN, 'Fa0/2 · VLAN 20'],
    [180, 'PC Gestion', '192.168.30.10', OK, 'Fa0/3 · VLAN 30'],
  ];
  postes.forEach(([y, nom, ip, c, port]) => {
    g.push(poste(14, y, nom, ip, c, port));
    g.push(ligne(164, y + 29, 300, 120 + (y - 40) / 3 + 10, { couleur: c, largeur: 2.5 }));
  });
  g.push(boite(300, 76, 110, 140, { bord: BORD, trait: 2.5, r: 10 }), txt(355, 140, 'SW1', { gras: true, taille: 16 }), txt(355, 160, 'commutateur', { taille: 11, couleur: S }));
  g.push(txt(355, 182, 'SVI VLAN 30', { taille: 10.5, couleur: S }), txt(355, 197, '192.168.30.2', { mono: true, taille: 10.5, couleur: S }));
  g.push(ligne(410, 146, 520, 146, { couleur: T, largeur: 5 }));
  g.push(txt(465, 128, 'TRUNK 802.1Q', { gras: true, taille: 11.5 }), txt(465, 166, 'Gi0/1 ↔ Gi0/0', { mono: true, taille: 10.5, couleur: S }), txt(465, 181, 'VLAN 10, 20, 30', { taille: 10.5, couleur: S }));
  g.push(routeur(520, 100, 'R1', { w: 90, h: 92 }));
  g.push(tableau(14, 252, [120, 150, 190, 236], ['VLAN', 'Réseau', 'Passerelle (sous-interface R1)', 'Port du commutateur'], [
    [{ t: '10 · VENTES', gras: true, c: ACC }, { t: '192.168.10.0/24', mono: true }, { t: '192.168.10.1 (Gi0/0.10)', mono: true, taille: 11 }, { t: 'Fa0/1, accès', taille: 11.5 }],
    [{ t: '20 · TECHNIQUE', gras: true, c: CYAN }, { t: '192.168.20.0/24', mono: true }, { t: '192.168.20.1 (Gi0/0.20)', mono: true, taille: 11 }, { t: 'Fa0/2, accès', taille: 11.5 }],
    [{ t: '30 · GESTION', gras: true, c: OK }, { t: '192.168.30.0/24', mono: true }, { t: '192.168.30.1 (Gi0/0.30)', mono: true, taille: 11 }, { t: 'Fa0/3, accès (et SSH)', taille: 11.5 }],
  ], { h: 26, taille: 12 }));
  g.push(txt(360, 368, 'Les adresses sont un exemple de laboratoire : adapte-les à ton énoncé.', { taille: 11, couleur: S }));
  return svg({
    id: 'sc-tp-vlan-topo', largeur: 720, hauteur: 384, titre: 'Topologie du TP : trois VLAN, un commutateur, un routeur',
    desc: 'Trois postes sont reliés au commutateur SW1 : PC Ventes sur Fa0/1 dans le VLAN 10 (192.168.10.10), PC Technique sur Fa0/2 dans le VLAN 20 (192.168.20.10) et PC Gestion sur Fa0/3 dans le VLAN 30 (192.168.30.10). SW1 a une adresse de gestion 192.168.30.2 dans le VLAN 30. Un seul câble, un trunk 802.1Q entre Gi0/1 de SW1 et Gi0/0 du routeur R1, transporte les trois VLAN. R1 porte une sous-interface par VLAN, qui sert de passerelle : 192.168.10.1, 192.168.20.1 et 192.168.30.1.',
    corps: g.join(''),
  });
}

// 2. Chemin d'un paquet d'un VLAN à l'autre -----------------------------------
function chemin() {
  const g = [txt(360, 22, 'Un paquet du VLAN 10 vers le VLAN 20', { gras: true, taille: 15 })];
  const noeuds = [
    [12, 'PC Ventes', '.10.10', ACC], [168, 'SW1', 'Fa0/1', BORD], [324, 'R1', 'Gi0/0', BORD], [480, 'SW1', 'Fa0/2', BORD], [636, 'PC Techn.', '.20.10', CYAN],
  ];
  noeuds.forEach(([x, nom, sous, c]) => {
    g.push(boite(x, 56, 72, 50, { bord: c, trait: 2, r: 8 }), txt(x + 36, 78, nom, { gras: true, taille: 12 }), txt(x + 36, 96, sous, { mono: true, taille: 10.5, couleur: S }));
  });
  const fleches = [
    [84, 'sans', 'étiquette', BORD], [240, 'étiquette', 'VLAN 10', ACC], [396, 'routage', '10 → 20', T], [552, 'étiquette', 'VLAN 20', CYAN],
  ];
  fleches.forEach(([x, l1, l2, c], i) => {
    g.push(fl(x, 81, x + 84, 81, { couleur: c, largeur: 2.5 }));
    g.push(txt(x + 42, 52, `${i + 1}`, { gras: true, taille: 13, couleur: c }));
    g.push(txt(x + 42, 124, l1, { taille: 10.5, couleur: S }), txt(x + 42, 138, l2, { taille: 10.5, couleur: S, gras: true }));
  });
  g.push(txt(654, 52, '5', { gras: true, taille: 13, couleur: CYAN }));
  g.push(txt(672, 124, 'sans', { taille: 10.5, couleur: S }), txt(672, 138, 'étiquette', { taille: 10.5, couleur: S, gras: true }));
  g.push(tableau(14, 156, [40, 170, 490], ['N°', 'Où', 'Ce qui se passe'], [
    [{ t: '1', gras: true }, { t: 'PC → SW1 (Fa0/1)', taille: 11.5 }, { t: 'Le PC envoie à sa passerelle 192.168.10.1 ; le port d’accès ne met pas d’étiquette.', taille: 11 }],
    [{ t: '2', gras: true }, { t: 'SW1 → R1 (trunk)', taille: 11.5 }, { t: 'SW1 sait que la trame vient du VLAN 10 : il la colle sur le trunk avec l’étiquette 10.', taille: 11 }],
    [{ t: '3', gras: true }, { t: 'R1 (Gi0/0.10)', taille: 11.5 }, { t: 'La sous-interface 10 reçoit, R1 route : 192.168.20.0/24 est connecté via Gi0/0.20.', taille: 11 }],
    [{ t: '4', gras: true }, { t: 'R1 → SW1 (trunk)', taille: 11.5 }, { t: 'R1 renvoie le paquet par le MÊME câble, cette fois avec l’étiquette 20.', taille: 11 }],
    [{ t: '5', gras: true }, { t: 'SW1 → PC (Fa0/2)', taille: 11.5 }, { t: 'SW1 retire l’étiquette et livre la trame au PC Technique, port d’accès du VLAN 20.', taille: 11 }],
  ], { h: 28, taille: 12 }));
  g.push(txt(360, 346, 'Le même câble est emprunté deux fois : c’est ce qu’on appelle un routeur « sur un bâton ».', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-tp-vlan-chemin', largeur: 720, hauteur: 362, titre: 'Chemin d’un paquet du VLAN 10 au VLAN 20',
    desc: 'Cinq étapes. 1 : le PC Ventes envoie sa trame à la passerelle, sans étiquette, sur le port d’accès Fa0/1. 2 : le commutateur la transmet au routeur sur le trunk avec l’étiquette VLAN 10. 3 : le routeur la reçoit sur la sous-interface Gi0/0.10 et choisit le réseau 192.168.20.0/24, connecté à Gi0/0.20. 4 : le routeur la renvoie par le même câble avec l’étiquette VLAN 20. 5 : le commutateur retire l’étiquette et la livre au PC Technique sur le port d’accès Fa0/2.',
    corps: g.join(''),
  });
}

export const SCHEMAS_TP_VLAN = {
  'tp-vlan-topologie': { titre: 'Topologie du TP : trois VLAN, un commutateur, un routeur', legende: 'Trois postes, un commutateur, un trunk 802.1Q et un routeur dont chaque sous-interface est la passerelle d’un VLAN.', svg: topologie },
  'tp-vlan-chemin': { titre: 'Chemin d’un paquet du VLAN 10 au VLAN 20', legende: 'Le paquet monte au routeur par le trunk avec l’étiquette 10 et redescend par le même câble avec l’étiquette 20.', svg: chemin },
};
