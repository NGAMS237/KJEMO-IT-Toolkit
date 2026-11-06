/**
 * schemas-cisco-s09.mjs — KJEMO-CISCO-S09-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Schémas ORIGINAUX (SVG en ligne) pour la semaine 9 : échange DORA, relais
 * DHCPv4, structure et types d'adresses IPv6, calcul EUI-64, indicateurs A / O /
 * M des annonces de routeur, qui donne quoi en SLAAC et DHCPv6, routes
 * statiques IPv6 et relais DHCPv6. Dessinés ici, avec nos mots : aucune
 * diapositive n'est copiée. Module PUR (aucun DOM). Mêmes règles que
 * schemas-cisco-reseau.mjs : titre, texte alternatif, légende, état dit par un
 * symbole ET un mot, thèmes clair/sombre. Adresses et sorties = EXEMPLES.
 */
import { DESSIN } from './schemas-cisco-reseau.mjs';

const { svg, txt, boite, ligne, fl, routeur, tableau, oui, non, att, T, S, CASE, BORD, ACC, CYAN, OK, KO, WARN } = DESSIN;

const poste = (x, y, nom, { w = 90, h = 36 } = {}) => boite(x, y, w, h, { bord: BORD, trait: 2, r: 6 }) + txt(x + w / 2, y + h / 2 + 5, nom, { gras: true, taille: 13 });
const rond = (x, y, c, couleur) => `<circle cx="${x}" cy="${y}" r="11" fill="${couleur}"/>` + txt(x, y + 4.5, c, { couleur: 'var(--on-accent,#17112e)', gras: true, taille: 13 });

// 1. DORA --------------------------------------------------------------------
function dhcp4Dora() {
  const g = [txt(360, 22, 'Obtenir une adresse IPv4 en quatre échanges : DORA', { gras: true, taille: 15 })];
  g.push(poste(40, 38, 'Poste', { w: 120 }), poste(560, 38, 'Serveur DHCP', { w: 130 }));
  g.push(ligne(100, 76, 100, 292, { couleur: BORD, largeur: 2, tirets: true }), ligne(625, 76, 625, 292, { couleur: BORD, largeur: 2, tirets: true }));
  const e = [
    ['D', 'DHCPDISCOVER', 'diffusion : « y a-t-il un serveur DHCP ? »', 112, true, ACC],
    ['O', 'DHCPOFFER', 'offre : une adresse libre mise de côté', 166, false, CYAN],
    ['R', 'DHCPREQUEST', 'diffusion : « j’accepte cette offre »', 220, true, WARN],
    ['A', 'DHCPACK', 'monodiffusion : bail confirmé', 274, false, OK],
  ];
  for (const [l, nom, sous, y, versServeur, c] of e) {
    g.push(versServeur ? fl(104, y, 620, y, { couleur: c, largeur: 3 }) : fl(621, y, 105, y, { couleur: c, largeur: 3 }));
    g.push(rond(versServeur ? 140 : 585, y, l, c));
    g.push(txt(360, y - 12, nom, { gras: true, taille: 13.5, mono: true }), txt(360, y + 18, sous, { taille: 11.5, couleur: S }));
  }
  return svg({
    id: 'sc-dhcp4-dora', largeur: 720, hauteur: 306, titre: 'Les quatre messages DHCPv4 : DORA',
    desc: 'Entre un poste et un serveur DHCP : 1 DHCPDISCOVER envoyé en diffusion par le poste, 2 DHCPOFFER du serveur avec une adresse proposée, 3 DHCPREQUEST du poste en diffusion pour accepter l’offre, 4 DHCPACK du serveur en monodiffusion qui confirme le bail. Avant la fin du bail, le poste le renouvelle avec un DHCPREQUEST.',
    corps: g.join(''),
  });
}

// 2. Relais DHCPv4 -----------------------------------------------------------
function dhcp4Relais() {
  const g = [txt(360, 22, 'Le relais transforme la diffusion en monodiffusion', { gras: true, taille: 15 })];
  g.push(poste(20, 90, 'PC1', { w: 76 }), routeur(250, 82, 'R1', { w: 90, h: 50 }), routeur(570, 82, 'R2', { w: 90, h: 50 }));
  g.push(boite(590, 150, 110, 40, { bord: CYAN }), txt(645, 168, 'Serveur', { gras: true, taille: 12.5 }), txt(645, 183, '192.168.11.6', { mono: true, taille: 11, couleur: S }));
  g.push(ligne(96, 108, 250, 108, { couleur: BORD }), ligne(340, 108, 570, 108, { couleur: BORD }), ligne(615, 132, 645, 150, { couleur: BORD }));
  g.push(fl(110, 94, 244, 94, { couleur: ACC, largeur: 3, tirets: true }), txt(170, 78, 'diffusion', { taille: 12, couleur: ACC, gras: true }), txt(170, 138, '(DHCPDISCOVER)', { taille: 11, couleur: S, mono: true }));
  g.push(fl(346, 94, 564, 94, { couleur: OK, largeur: 3 }), txt(455, 78, 'monodiffusion vers le serveur', { taille: 12, couleur: OK, gras: true }));
  g.push(boite(206, 160, 178, 52, { bord: WARN, r: 8 }), txt(295, 180, 'Interface côté postes de R1 :', { taille: 11.5, couleur: S }), txt(295, 199, 'ip helper-address 192.168.11.6', { mono: true, taille: 11.5 }));
  g.push(txt(360, 246, 'Sans relais, la diffusion du poste s’arrête au routeur : le serveur ne la reçoit jamais.', { taille: 12.5, couleur: S }));
  g.push(txt(360, 264, 'On place la commande sur l’interface d’où viennent les demandes, pas côté serveur.', { taille: 12.5, couleur: S }));
  return svg({
    id: 'sc-dhcp4-relais', largeur: 720, hauteur: 280, titre: 'Relais DHCPv4 avec ip helper-address',
    desc: 'PC1 envoie une diffusion DHCPDISCOVER vers R1. R1, configuré avec ip helper-address 192.168.11.6 sur son interface côté postes, la transmet en monodiffusion à travers R2 jusqu’au serveur 192.168.11.6. Sans relais, la diffusion ne franchit pas le routeur.',
    corps: g.join(''),
  });
}

// 3. Adresse IPv6 ------------------------------------------------------------
function ipv6Adresse() {
  const g = [txt(360, 22, 'Une adresse IPv6 : 128 bits, 8 groupes de 16 bits', { gras: true, taille: 15 })];
  const seg = [['2001:0DB8:ACAD', 'préfixe de routage global', '48 bits', 40, 300, ACC], ['0001', 'sous-réseau', '16 bits', 340, 80, CYAN], ['0250:56FF:FE83:636D', 'identifiant d’interface', '64 bits', 420, 260, WARN]];
  for (const [a, nom, bits, x, w, c] of seg) {
    g.push(boite(x, 40, w, 44, { bord: c, trait: 2, r: 6 }), txt(x + w / 2, 68, a, { mono: true, gras: true, taille: 14 }));
    g.push(txt(x + w / 2, 104, nom, { taille: 12, couleur: c, gras: true }), txt(x + w / 2, 120, bits, { taille: 11.5, couleur: S }));
  }
  g.push(boite(40, 140, 640, 24, { fond: 'none', bord: BORD, r: 6, trait: 1, tirets: true }), txt(360, 157, 'le /64 d’un réseau local = tout ce qui est à gauche de l’identifiant d’interface', { taille: 11.5, couleur: S }));
  g.push(txt(40, 192, 'Règle 1 : on supprime les zéros de tête de chaque groupe.', { ancre: 'start', taille: 13, gras: true }), txt(60, 212, '0DB8 → DB8     0001 → 1     00AB → AB', { ancre: 'start', mono: true, taille: 12.5, couleur: S }));
  g.push(txt(40, 240, 'Règle 2 : « :: » remplace UNE suite de groupes à zéro (une seule fois).', { ancre: 'start', taille: 13, gras: true }), txt(60, 260, '2001:0DB8:0000:0000:0000:0000:0000:0001 → 2001:DB8::1', { ancre: 'start', mono: true, taille: 12.5, couleur: S }));
  g.push(txt(60, 280, '2001:DB8::ABCD::1234', { ancre: 'start', mono: true, taille: 12.5, couleur: KO }), txt(260, 280, '✗ interdit : deux « :: » seraient ambigus', { ancre: 'start', taille: 12, couleur: KO }));
  return svg({
    id: 'sc-ipv6-adresse', largeur: 720, hauteur: 300, titre: 'Structure et abréviation d’une adresse IPv6',
    desc: 'Une adresse IPv6 compte 128 bits : un préfixe de routage global de 48 bits, un identifiant de sous-réseau de 16 bits et un identifiant d’interface de 64 bits, par exemple 2001:0DB8:ACAD:0001:0250:56FF:FE83:636D. Deux règles d’abréviation : supprimer les zéros de tête de chaque groupe, et remplacer une seule suite de groupes à zéro par deux deux-points ; deux « :: » dans la même adresse sont interdits.',
    corps: g.join(''),
  });
}

// 4. Types d'adresses --------------------------------------------------------
function ipv6Types() {
  const lignes = [
    [{ t: 'Globale unicast', gras: true, c: ACC }, { t: '2000::/3', mono: true }, 'Joignable sur Internet, comme une IPv4 publique'],
    [{ t: 'Link-local', gras: true, c: CYAN }, { t: 'FE80::/10', mono: true }, 'Un seul lien ; obligatoire sur chaque interface'],
    [{ t: 'Multidiffusion', gras: true, c: WARN }, { t: 'FF00::/8', mono: true }, 'FF02::1 tous les nœuds, FF02::2 tous les routeurs'],
    [{ t: 'Anycast', gras: true, c: OK }, 'adresse unicast', 'Partagée : le paquet va au plus proche'],
    [{ t: 'Bouclage', gras: true }, { t: '::1/128', mono: true }, 'Le poste lui-même'],
  ];
  const g = [txt(360, 22, 'Les types d’adresses IPv6 à connaître', { gras: true, taille: 15 }),
    tableau(30, 38, [140, 130, 390], ['Type', 'Plage', 'Rôle'], lignes, { h: 34 }),
    txt(360, 270, 'Pas de diffusion en IPv6 : la multidiffusion FF02::1 joue ce rôle.', { taille: 12.5, couleur: S }),
    txt(360, 288, '2001:DB8::/32 est réservé à la documentation : c’est la plage des exemples de laboratoire.', { taille: 12.5, couleur: S })];
  return svg({
    id: 'sc-ipv6-types', largeur: 720, hauteur: 304, titre: 'Types d’adresses IPv6',
    desc: 'Globale unicast dans 2000::/3, link-local dans FE80::/10 obligatoire sur chaque interface, multidiffusion dans FF00::/8 avec FF02::1 pour tous les nœuds et FF02::2 pour tous les routeurs, anycast qui est une adresse unicast partagée par plusieurs appareils, et bouclage ::1/128. IPv6 n’a pas de diffusion. La plage 2001:DB8::/32 est réservée à la documentation.',
    corps: g.join(''),
  });
}

// 5. EUI-64 ------------------------------------------------------------------
function ipv6Eui64() {
  const g = [txt(360, 22, 'Fabriquer l’identifiant d’interface en EUI-64', { gras: true, taille: 15 })];
  g.push(txt(40, 56, 'Adresse MAC du poste', { ancre: 'start', taille: 12.5, couleur: S }), boite(40, 64, 300, 40, { bord: ACC, trait: 2 }), txt(190, 90, '00-50-56-83-63-6D', { mono: true, gras: true, taille: 16 }));
  g.push(fl(190, 106, 190, 132, { couleur: S }), txt(215, 124, '1. couper en deux : OUI 00-50-56 | numéro 83-63-6D', { ancre: 'start', taille: 12, couleur: S }));
  g.push(boite(40, 138, 300, 40, { bord: CYAN, trait: 2 }), txt(190, 164, '0050:56 [FFFE] 83:636D', { mono: true, gras: true, taille: 15 }));
  g.push(txt(360, 160, '2. insérer FFFE au milieu', { ancre: 'start', taille: 12, couleur: S }));
  g.push(fl(190, 180, 190, 206, { couleur: S }), txt(215, 198, '3. inverser le 7e bit du premier octet (bit U/L)', { ancre: 'start', taille: 12, couleur: S }));
  g.push(boite(40, 212, 300, 40, { bord: WARN, trait: 2 }), txt(190, 238, '0250:56FF:FE83:636D', { mono: true, gras: true, taille: 15 }));
  g.push(boite(380, 206, 300, 54, { fond: 'none', bord: BORD, r: 8, trait: 1.5, tirets: true }), txt(395, 226, 'premier octet : 00 = 0000 0000', { ancre: 'start', mono: true, taille: 12 }), txt(395, 246, 'bit inversé : 02 = 0000 0010', { ancre: 'start', mono: true, taille: 12, couleur: WARN }));
  g.push(txt(360, 284, 'Repérer un EUI-64 : on voit FFFE au milieu de l’identifiant. Windows (depuis Vista) préfère un nombre aléatoire.', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-ipv6-eui64', largeur: 720, hauteur: 298, titre: 'Calcul de l’identifiant EUI-64 à partir d’une adresse MAC',
    desc: 'Exemple avec l’adresse MAC 00-50-56-83-63-6D. Étape 1 : couper en deux au milieu, 00-50-56 et 83-63-6D. Étape 2 : insérer FFFE au milieu, ce qui donne 0050:56FF:FE83:636D. Étape 3 : inverser le septième bit du premier octet : 00 devient 02. Résultat : 0250:56FF:FE83:636D. La présence de FFFE au milieu révèle un identifiant EUI-64.',
    corps: g.join(''),
  });
}

// 6. Indicateurs A / O / M ---------------------------------------------------
function dhcp6RaFlags() {
  const lignes = [
    [{ t: '1 SLAAC seul', gras: true, c: ACC }, { t: '✓ A = 1', mono: true }, { t: '✗ O = 0', mono: true }, { t: '✗ M = 0', mono: true }, { t: 'aucune de plus', c: S }],
    [{ t: '2 DHCPv6 sans état', gras: true, c: CYAN }, { t: '✓ A = 1', mono: true }, { t: '✓ O = 1', mono: true, c: WARN, gras: true }, { t: '✗ M = 0', mono: true }, { t: 'ipv6 nd other-config-flag', mono: true, taille: 11 }],
    [{ t: '3 DHCPv6 avec état', gras: true, c: OK }, { t: 'A selon config', c: S, taille: 11 }, { t: '✗ O = 0', mono: true }, { t: '✓ M = 1', mono: true, c: WARN, gras: true }, { t: 'ipv6 nd managed-config-flag', mono: true, taille: 11 }],
  ];
  const g = [txt(360, 22, 'Les trois indicateurs d’une annonce de routeur (RA)', { gras: true, taille: 15 }),
    tableau(20, 38, [170, 100, 90, 90, 250], ['Méthode', 'A', 'O', 'M', 'Commande sur l’interface'], lignes, { h: 38, taille: 12.5 })];
  g.push(txt(40, 186, 'A (Address) : fabriquer son adresse avec SLAAC.', { ancre: 'start', taille: 12.5 }), txt(40, 206, 'O (Other) : d’autres informations (DNS, domaine) viennent d’un serveur DHCPv6.', { ancre: 'start', taille: 12.5 }), txt(40, 226, 'M (Managed) : toute l’adresse vient d’un serveur DHCPv6 avec état.', { ancre: 'start', taille: 12.5 }));
  g.push(txt(360, 262, 'Le poste suit la suggestion de l’annonce, mais la décision finale lui revient.', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-dhcp6-ra-flags', largeur: 720, hauteur: 276, titre: 'Indicateurs A, O et M des annonces de routeur',
    desc: 'Trois méthodes d’adressage et l’indicateur qui les distingue. SLAAC seul : A à 1, O et M à 0, aucune commande en plus. DHCPv6 sans état : A à 1 et O à 1 avec ipv6 nd other-config-flag. DHCPv6 avec état : M à 1 avec ipv6 nd managed-config-flag. A signifie adresse fabriquée par SLAAC, O autres informations par DHCPv6, M adresse entière par DHCPv6. Le poste décide en dernier.',
    corps: g.join(''),
  });
}

// 7. Qui donne quoi ----------------------------------------------------------
function dhcp6QuiDonneQuoi() {
  const lignes = [
    [{ t: 'SLAAC seul', gras: true, c: ACC }, 'routeur (RA)', 'le poste', { t: 'poste : RA + son ID', taille: 11.5 }, non('aucun')],
    [{ t: 'DHCPv6 sans état', gras: true, c: CYAN }, 'routeur (RA)', 'le poste', { t: 'poste : RA + son ID', taille: 11.5 }, oui('DHCPv6')],
    [{ t: 'DHCPv6 avec état', gras: true, c: OK }, 'routeur (passerelle)', 'le serveur', oui('DHCPv6'), oui('DHCPv6')],
  ];
  const g = [txt(360, 22, 'Qui fournit quoi à un poste IPv6', { gras: true, taille: 15 }),
    tableau(14, 38, [150, 150, 110, 160, 130], ['Méthode', 'Préfixe et passerelle', 'ID d’interface', 'Adresse complète', 'DNS et domaine'], lignes, { h: 40, taille: 12 })];
  g.push(txt(360, 196, 'Avec état seulement, le serveur garde la liste des baux (show ipv6 dhcp binding).', { taille: 12.5, couleur: S }));
  g.push(txt(360, 216, 'SLAAC seul ne donne jamais de serveur DNS : il faut au moins le DHCPv6 sans état.', { taille: 12.5, couleur: S }));
  return svg({
    id: 'sc-dhcp6-qui', largeur: 720, hauteur: 232, titre: 'Qui fournit quoi : SLAAC, DHCPv6 sans état et avec état',
    desc: 'SLAAC seul : le routeur donne préfixe et passerelle, le poste fabrique son identifiant et son adresse, aucun DNS. DHCPv6 sans état : même chose, plus le DNS et le domaine fournis par DHCPv6. DHCPv6 avec état : le routeur donne la passerelle, le serveur DHCPv6 donne l’adresse complète, le DNS et le domaine, et garde les baux.',
    corps: g.join(''),
  });
}

// 8. Routes statiques IPv6 ---------------------------------------------------
function ipv6Routes() {
  const g = [txt(360, 20, 'Trois routeurs, trois formes de route statique IPv6', { gras: true, taille: 15 })];
  g.push(routeur(60, 70, 'R1'), routeur(325, 70, 'R2'), routeur(590, 70, 'R3'));
  g.push(ligne(130, 90, 325, 90, { couleur: ACC }), ligne(395, 90, 590, 90, { couleur: ACC }));
  g.push(txt(228, 80, '2001:db8:1:a001::/64', { mono: true, taille: 10.5, couleur: CYAN }), txt(492, 80, '2001:db8:1:a002::/64', { mono: true, taille: 10.5, couleur: CYAN }));
  g.push(ligne(95, 110, 95, 146, { couleur: BORD }), ligne(360, 110, 360, 146, { couleur: BORD }), ligne(625, 110, 625, 146, { couleur: BORD }));
  for (const [x, n] of [[95, 1], [360, 2], [625, 3]]) g.push(boite(x - 62, 146, 124, 30, { bord: CYAN, r: 6 }), txt(x, 166, `LAN ${n} : 1:${n}::/64`, { mono: true, taille: 11 }));
  const note = (x, titre, l1, l2, c) => boite(x, 196, 218, 80, { bord: c, r: 8, trait: 1.8 }) + txt(x + 109, 214, titre, { gras: true, taille: 12, couleur: c }) + txt(x + 8, 234, l1, { ancre: 'start', mono: true, taille: 10 }) + txt(x + 8, 252, l2, { ancre: 'start', mono: true, taille: 10 });
  g.push(note(8, 'R1 : récursive (3 routes)', 'ipv6 route RÉSEAU a001::2', 'vers les LAN 2, 3 et a002', ACC));
  g.push(note(251, 'R2 : connectée + spécifiée', 'LAN 1 : … Serial0/0/0', 'LAN 3 : … Se0/0/1 a002::2', WARN));
  g.push(note(494, 'R3 : route par défaut', 'ipv6 route ::/0', '2001:db8:1:a002::1', OK));
  g.push(txt(360, 300, 'À l’aller comme au retour : chaque réseau distant a besoin de sa route (ou d’une route par défaut).', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-ipv6-routes', largeur: 720, hauteur: 314, titre: 'Routes statiques IPv6 : récursive, connectée, entièrement spécifiée, par défaut',
    desc: 'Trois routeurs en ligne, R1 à R2 par 2001:db8:1:a001::/64 et R2 à R3 par 2001:db8:1:a002::/64, chacun avec son LAN 2001:db8:1:1::/64, 1:2::/64 et 1:3::/64. R1 écrit trois routes récursives vers les réseaux distants par 2001:db8:1:a001::2. R2 écrit une route connectée directement vers le LAN de R1 par Serial0/0/0, et une route entièrement spécifiée vers le LAN de R3 par Serial0/0/1 et 2001:db8:1:a002::2. R3 écrit une route par défaut ::/0 vers 2001:db8:1:a002::1.',
    corps: g.join(''),
  });
}

// 9. Relais DHCPv6 -----------------------------------------------------------
function dhcp6Relais() {
  const g = [txt(360, 22, 'Relais DHCPv6 : atteindre un serveur d’un autre réseau', { gras: true, taille: 15 })];
  g.push(poste(20, 80, 'Client', { w: 84 }), routeur(270, 72, 'R1', { w: 90, h: 50 }), routeur(560, 72, 'R3', { w: 100, h: 50 }));
  g.push(ligne(104, 98, 270, 98, { couleur: BORD }), ligne(360, 98, 560, 98, { couleur: BORD }));
  g.push(fl(112, 86, 264, 86, { couleur: ACC, largeur: 3, tirets: true }), txt(188, 68, 'demande', { taille: 12, couleur: ACC, gras: true }), txt(188, 124, '(multidiffusion)', { taille: 11, couleur: S }));
  g.push(fl(366, 86, 554, 86, { couleur: OK, largeur: 3 }), txt(460, 68, 'transmise au serveur', { taille: 12, couleur: OK, gras: true }));
  g.push(txt(315, 150, 'Agent de relais', { taille: 12, couleur: S }), txt(610, 150, 'Serveur DHCPv6', { taille: 12, couleur: S }));
  g.push(boite(120, 168, 480, 52, { bord: WARN, r: 8 }), txt(360, 188, 'Interface de R1 côté client :', { taille: 11.5, couleur: S }), txt(360, 208, 'ipv6 dhcp relay destination 2001:db8:acad:1::2 G0/0/0', { mono: true, taille: 11.5 }));
  g.push(txt(360, 246, 'L’interface de sortie n’est obligatoire que si l’adresse du serveur est une adresse link-local.', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-dhcp6-relais', largeur: 720, hauteur: 262, titre: 'Relais DHCPv6',
    desc: 'Un client envoie sa demande DHCPv6 en multidiffusion vers R1, qui joue le rôle d’agent de relais grâce à ipv6 dhcp relay destination 2001:db8:acad:1::2 G0/0/0 sur son interface côté client, puis la transmet au serveur DHCPv6 sur R3. L’interface de sortie n’est nécessaire que lorsque l’adresse du serveur est une adresse link-local.',
    corps: g.join(''),
  });
}

export const SCHEMAS_S09 = {
  'dhcp4-dora': { titre: 'Les quatre messages DORA', legende: 'Discover et Request partent en diffusion ; Offer et Acknowledge reviennent du serveur.', svg: dhcp4Dora },
  'dhcp4-relais': { titre: 'Relais DHCPv4', legende: 'ip helper-address transforme la diffusion du poste en monodiffusion vers le serveur.', svg: dhcp4Relais },
  'ipv6-adresse': { titre: 'Structure et abréviation d’une adresse IPv6', legende: 'Préfixe de 48 bits, sous-réseau de 16 bits, interface de 64 bits ; deux règles pour écrire court.', svg: ipv6Adresse },
  'ipv6-types': { titre: 'Types d’adresses IPv6', legende: 'Globale, link-local, multidiffusion, anycast et bouclage ; IPv6 n’a pas de diffusion.', svg: ipv6Types },
  'ipv6-eui64': { titre: 'Calcul EUI-64', legende: 'Couper l’adresse MAC, insérer FFFE, inverser le septième bit.', svg: ipv6Eui64 },
  'dhcp6-ra-flags': { titre: 'Indicateurs A, O et M', legende: 'Trois méthodes d’adressage et la commande qui lève l’indicateur correspondant.', svg: dhcp6RaFlags },
  'dhcp6-qui-donne-quoi': { titre: 'Qui fournit quoi', legende: 'Préfixe, identifiant, adresse, DNS : ce que donnent le routeur, le poste et le serveur.', svg: dhcp6QuiDonneQuoi },
  'ipv6-routes-statiques': { titre: 'Routes statiques IPv6', legende: 'R1 récursive, R2 connectée et entièrement spécifiée, R3 par défaut.', svg: ipv6Routes },
  'dhcp6-relais': { titre: 'Relais DHCPv6', legende: 'Le routeur côté client transmet les demandes au serveur d’un autre réseau.', svg: dhcp6Relais },
};
