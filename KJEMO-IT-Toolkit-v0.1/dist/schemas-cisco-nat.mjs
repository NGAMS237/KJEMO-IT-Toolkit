/**
 * schemas-cisco-nat.mjs — KJEMO-CISCO-NAT-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Schémas ORIGINAUX (SVG en ligne) : vocabulaire NAT (inside / outside, local /
 * global), les trois types de NAT, table de PAT, socket et plages de ports,
 * NAT64, types d'adresses IPv6 et leurs usages, modes de diffusion (dont la
 * télévision IP d'un hôtel) et récapitulation de routes. Module PUR (aucun
 * DOM). Mêmes règles que schemas-cisco-reseau.mjs : titre, texte alternatif,
 * légende, état dit par un symbole ET un mot, thèmes clair/sombre. Adresses et
 * ports = EXEMPLES (plages de documentation).
 */
import { DESSIN } from './schemas-cisco-reseau.mjs';

const { svg, txt, boite, ligne, fl, routeur, nuage, tableau, oui, non, T, S, BORD, ACC, CYAN, OK, KO, WARN } = DESSIN;

const poste = (x, y, nom, { w = 90, h = 36 } = {}) => boite(x, y, w, h, { bord: BORD, trait: 2, r: 6 }) + txt(x + w / 2, y + h / 2 + 5, nom, { gras: true, taille: 13 });

// 1. Vocabulaire NAT ---------------------------------------------------------
function natVocabulaire() {
  const g = [txt(360, 22, 'Les quatre adresses du vocabulaire NAT', { gras: true, taille: 15 })];
  g.push(boite(20, 44, 270, 150, { bord: ACC, tirets: true, r: 12 }), txt(155, 62, 'Réseau interne (inside)', { gras: true, taille: 12.5, couleur: ACC }));
  g.push(boite(430, 44, 270, 150, { bord: CYAN, tirets: true, r: 12 }), txt(565, 62, 'Internet (outside)', { gras: true, taille: 12.5, couleur: CYAN }));
  g.push(poste(34, 100, 'PC', { w: 70 }), routeur(300, 90, 'R1', { w: 120, h: 56 }), poste(560, 100, 'Serveur', { w: 100 }));
  g.push(ligne(104, 118, 300, 118, { couleur: BORD }), ligne(420, 118, 560, 118, { couleur: BORD }));
  g.push(txt(69, 156, '192.168.10.10', { mono: true, taille: 11 }), txt(610, 156, '198.51.100.50', { mono: true, taille: 11 }));
  g.push(txt(360, 160, 'ip nat inside | ip nat outside', { mono: true, taille: 10.5, couleur: S }));
  g.push(tableau(20, 204, [160, 200, 340], ['Nom', 'Exemple', 'C’est…'], [
    [{ t: 'Inside local', gras: true, c: ACC }, { t: '192.168.10.10', mono: true }, { t: 'l’adresse privée du poste, vue de l’intérieur', taille: 11.5 }],
    [{ t: 'Inside global', gras: true, c: ACC }, { t: '203.0.113.2', mono: true }, { t: 'la même machine, vue de l’extérieur (publique)', taille: 11.5 }],
    [{ t: 'Outside global', gras: true, c: CYAN }, { t: '198.51.100.50', mono: true }, { t: 'l’adresse du serveur sur Internet', taille: 11.5 }],
    [{ t: 'Outside local', gras: true, c: CYAN }, { t: '198.51.100.50', mono: true }, { t: 'le serveur vu de l’intérieur (souvent identique)', taille: 11.5 }],
  ], { h: 26, taille: 12 }));
  return svg({
    id: 'sc-nat-vocab', largeur: 720, hauteur: 346, titre: 'Vocabulaire NAT : inside, outside, local, global',
    desc: 'Un PC du réseau interne en 192.168.10.10 passe par le routeur R1 pour joindre un serveur sur Internet en 198.51.100.50. L’interface vers le PC est marquée ip nat inside, celle vers Internet ip nat outside. Inside local est l’adresse privée du PC, inside global son adresse publique vue de l’extérieur, outside global l’adresse du serveur, outside local le serveur vu de l’intérieur, en général identique.',
    corps: g.join(''),
  });
}

// 2. Les trois types de NAT --------------------------------------------------
function natTrois() {
  const lignes = [
    [{ t: 'NAT statique', gras: true, c: ACC }, { t: '1 ↔ 1, fixe', taille: 11.5 }, { t: 'une par serveur', taille: 11.5 }, { t: 'publier un serveur web ou courriel', taille: 11.5 }],
    [{ t: 'NAT dynamique', gras: true, c: CYAN }, { t: '1 ↔ 1, emprunt temporaire', taille: 11.5 }, { t: 'un pool', taille: 11.5 }, { t: 'peu de postes, beaucoup d’adresses', taille: 11.5 }],
    [{ t: 'PAT (overload)', gras: true, c: OK }, { t: 'n ↔ 1, par numéro de port', taille: 11.5 }, { t: 'une seule', taille: 11.5 }, { t: 'accès Internet d’un réseau, la box', taille: 11.5 }],
  ];
  const g = [txt(360, 22, 'Trois façons de traduire une adresse privée', { gras: true, taille: 15 }),
    tableau(14, 40, [130, 190, 130, 240], ['Type', 'Correspondance', 'Adresses publiques', 'Cas d’usage'], lignes, { h: 40, taille: 12 })];
  g.push(txt(360, 202, 'Commande clé : static  ·  pool  ·  interface … overload', { mono: true, taille: 12, couleur: S }));
  g.push(txt(360, 224, 'Seul le PAT tient avec une seule adresse publique, car il compte aussi sur les ports.', { taille: 12.5, couleur: S }));
  return svg({
    id: 'sc-nat-types', largeur: 720, hauteur: 240, titre: 'NAT statique, NAT dynamique et PAT',
    desc: 'Trois types. NAT statique : une adresse privée pour une adresse publique, fixe, pour publier un serveur. NAT dynamique : une adresse privée empruntée temporairement à un pool d’adresses publiques, pour peu de postes. PAT ou surcharge : plusieurs adresses privées partagent une seule adresse publique grâce aux numéros de port, pour l’accès Internet d’un réseau.',
    corps: g.join(''),
  });
}

// 3. Table PAT ---------------------------------------------------------------
function patTable() {
  const g = [txt(360, 22, 'PAT : une adresse publique, des ports différents', { gras: true, taille: 15 })];
  g.push(poste(20, 50, 'PC1', { w: 70 }), poste(20, 110, 'PC2', { w: 70 }), routeur(300, 74, 'R1', { w: 90, h: 50 }), nuage(560, 66, 130, 66, 'Internet', '198.51.100.50:80'));
  g.push(txt(55, 100, '192.168.10.2', { mono: true, taille: 10.5, couleur: S }), txt(55, 160, '192.168.10.3', { mono: true, taille: 10.5, couleur: S }));
  g.push(ligne(90, 68, 300, 92, { couleur: ACC }), ligne(90, 128, 300, 106, { couleur: OK }), ligne(390, 99, 560, 99, { couleur: BORD }));
  g.push(txt(475, 90, '203.0.113.2', { mono: true, taille: 11, gras: true }));
  g.push(tableau(20, 178, [140, 150, 150, 150, 110], ['Protocole', 'Inside local', 'Inside global', 'Outside global', 'Sens'], [
    [{ t: 'tcp', mono: true }, { t: '192.168.10.2:49200', mono: true, taille: 11 }, { t: '203.0.113.2:1025', mono: true, taille: 11, c: ACC, gras: true }, { t: '198.51.100.50:80', mono: true, taille: 11 }, { t: '→ sortie', taille: 11.5 }],
    [{ t: 'tcp', mono: true }, { t: '192.168.10.3:49200', mono: true, taille: 11 }, { t: '203.0.113.2:1026', mono: true, taille: 11, c: OK, gras: true }, { t: '198.51.100.50:80', mono: true, taille: 11 }, { t: '→ sortie', taille: 11.5 }],
  ], { h: 28, taille: 12 }));
  g.push(txt(360, 282, 'Même adresse publique, deux ports : à la réponse, le routeur lit le port et retrouve le bon poste.', { taille: 12, couleur: S }));
  g.push(txt(360, 300, 'Exemple écrit pour expliquer : les numéros de ports réels dépendent du routeur.', { taille: 11, couleur: S }));
  return svg({
    id: 'sc-pat-table', largeur: 720, hauteur: 314, titre: 'Table de traduction du PAT',
    desc: 'PC1 en 192.168.10.2 et PC2 en 192.168.10.3 envoient chacun une requête TCP depuis le port 49200 vers 198.51.100.50 port 80. Le routeur R1 les fait sortir avec la même adresse publique 203.0.113.2, mais avec les ports 1025 pour PC1 et 1026 pour PC2. Au retour, il lit le port de destination pour retrouver le bon poste. Les ports sont des exemples.',
    corps: g.join(''),
  });
}

// 4. Socket et ports ---------------------------------------------------------
function socketPorts() {
  const g = [txt(360, 22, 'Un socket = une adresse IP + un numéro de port', { gras: true, taille: 15 })];
  g.push(boite(210, 40, 300, 56, { bord: ACC, trait: 2, r: 10 }), txt(360, 76, '8.8.1.1:80', { mono: true, taille: 24, gras: true }));
  g.push(txt(285, 116, '↑ la machine', { taille: 12, couleur: ACC, gras: true }), txt(285, 132, '8.8.1.1', { mono: true, taille: 11, couleur: S }));
  g.push(txt(445, 116, '↑ le service', { taille: 12, couleur: CYAN, gras: true }), txt(445, 132, '80 = web (HTTP)', { mono: true, taille: 11, couleur: S }));
  const plages = [
    [20, 200, '0 – 1023', 'ports bien connus', '80, 443, 22, 53 : web, SSH, DNS', ACC],
    [230, 270, '1024 – 49151', 'ports enregistrés', 'applications et bases de données', CYAN],
    [510, 190, '49152 – 65535', 'ports dynamiques', 'choisis par le CLIENT', OK],
  ];
  for (const [x, w, plage, nom, ex, c] of plages) {
    g.push(boite(x, 152, w, 70, { bord: c, trait: 2, r: 8 }), txt(x + w / 2, 174, plage, { gras: true, taille: 13, mono: true }), txt(x + w / 2, 193, nom, { taille: 12, couleur: c, gras: true }), txt(x + w / 2, 211, ex, { taille: 10.5, couleur: S }));
  }
  g.push(txt(360, 246, 'Une connexion relie DEUX sockets :', { taille: 12.5, gras: true }));
  g.push(txt(360, 266, '192.168.10.10:51000  ──►  8.8.1.1:80', { mono: true, taille: 13 }));
  g.push(txt(360, 286, 'Le client prend un port dynamique, le serveur reste sur son port connu. C’est ce couple que le PAT retient.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-socket', largeur: 720, hauteur: 302, titre: 'Socket et plages de ports',
    desc: 'Un socket est une adresse IP suivie d’un numéro de port, par exemple 8.8.1.1:80 : la machine 8.8.1.1 et le service web sur le port 80. Trois plages de ports : 0 à 1023 bien connus, comme 80, 443, 22, 53 ; 1024 à 49151 enregistrés ; 49152 à 65535 dynamiques, choisis par le client. Une connexion relie deux sockets, par exemple 192.168.10.10:51000 vers 8.8.1.1:80.',
    corps: g.join(''),
  });
}

// 5. NAT64 -------------------------------------------------------------------
function nat64() {
  const g = [txt(360, 22, 'NAT64 : un poste IPv6 parle à un serveur IPv4', { gras: true, taille: 15 })];
  g.push(boite(14, 50, 150, 70, { bord: ACC, r: 10 }), txt(89, 72, 'Poste IPv6 seul', { gras: true, taille: 12.5 }), txt(89, 92, '2001:db8:1::10', { mono: true, taille: 11 }), txt(89, 109, 'aucune adresse IPv4', { taille: 10.5, couleur: S }));
  g.push(routeur(290, 58, 'Routeur NAT64', { w: 140, h: 54 }));
  g.push(boite(556, 50, 150, 70, { bord: CYAN, r: 10 }), txt(631, 72, 'Serveur IPv4 seul', { gras: true, taille: 12.5 }), txt(631, 92, '8.8.8.8', { mono: true, taille: 12 }), txt(631, 109, 'aucune adresse IPv6', { taille: 10.5, couleur: S }));
  g.push(fl(164, 85, 288, 85, { couleur: ACC, largeur: 3 }), fl(432, 85, 554, 85, { couleur: CYAN, largeur: 3 }));
  g.push(txt(226, 74, 'paquet IPv6', { taille: 11, couleur: ACC, gras: true }), txt(493, 74, 'paquet IPv4', { taille: 11, couleur: CYAN, gras: true }));
  g.push(boite(40, 146, 640, 80, { bord: WARN, r: 10 }));
  g.push(txt(360, 168, '1. Le serveur DNS64 répond avec une adresse IPv6 fabriquée :', { taille: 12.5 }));
  g.push(txt(360, 192, '64:ff9b::808:808   =   préfixe 64:ff9b::/96  +  8.8.8.8 écrit en hexadécimal (0808:0808)', { mono: true, taille: 11 }));
  g.push(txt(360, 214, '2. Le routeur reconnaît le préfixe, retire-le, et remplace l’adresse source IPv6 par une IPv4 de son pool.', { taille: 12 }));
  g.push(txt(360, 252, 'À ne pas confondre : NAT64 traduit entre IPv6 et IPv4 ; le NAT classique traduit IPv4 privé vers IPv4 public.', { taille: 12, couleur: S }));
  g.push(txt(360, 270, 'Sa syntaxe varie selon la plateforme et n’existe pas dans Packet Tracer : ici, on retient le principe.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-nat64', largeur: 720, hauteur: 286, titre: 'NAT64 : traduire entre IPv6 et IPv4',
    desc: 'Un poste qui n’a qu’IPv6, en 2001:db8:1::10, veut joindre un serveur qui n’a qu’IPv4, en 8.8.8.8. Le serveur DNS64 fabrique une adresse IPv6 avec le préfixe 64:ff9b::/96 suivi de l’adresse IPv4 en hexadécimal : 64:ff9b::808:808. Le routeur NAT64 reconnaît ce préfixe, retire l’IPv6 et envoie un paquet IPv4 avec une adresse source de son pool. Il traduit entre deux familles, contrairement au NAT classique.',
    corps: g.join(''),
  });
}

// 6. Types d'adresses IPv6 et usages -----------------------------------------
function ipv6TypesReels() {
  const m = (t) => ({ t, mono: true, taille: 10.5 });
  const lignes = [
    [{ t: 'Globale unicast', gras: true, c: ACC, taille: 11.5 }, m('2000::/3'), m('2001:db8:acad:1::10'), { t: 'ton poste, un serveur web : routable sur Internet', taille: 11 }],
    [{ t: 'Link-local', gras: true, c: CYAN, taille: 11.5 }, m('FE80::/10'), m('fe80::1'), { t: 'voisins d’un lien : passerelle, annonces ; non routée', taille: 11 }],
    [{ t: 'Bouclage', gras: true, c: OK, taille: 11.5 }, m('::1/128'), m('::1'), { t: 'tester sa propre pile réseau : ping ::1', taille: 11 }],
    [{ t: 'Non spécifiée', gras: true, c: WARN, taille: 11.5 }, m('::/128'), m('::'), { t: 'poste sans adresse (démarrage) ; ::/0 = route par défaut', taille: 11 }],
    [{ t: 'Locale unique', gras: true, c: ACC, taille: 11.5 }, m('FC00::/7'), m('fd12:3456:789a::1'), { t: 'réseau privé (comme 192.168.x.x) ; non routée sur Internet', taille: 11 }],
    [{ t: 'IPv4 intégré', gras: true, c: CYAN, taille: 11.5 }, m('::ffff:0:0/96'), m('::ffff:192.0.2.1'), { t: 'double pile ; avec 64:ff9b::/96 : NAT64', taille: 11 }],
  ];
  const g = [txt(360, 22, 'Les types d’adresses IPv6 et leur usage réel', { gras: true, taille: 15 }),
    tableau(8, 38, [112, 110, 150, 348], ['Type', 'Plage', 'Exemple', 'Cas d’utilisation'], lignes, { h: 40, taille: 12 })];
  g.push(txt(360, 330, 'Pas de diffusion en IPv6 : elle est remplacée par la multidiffusion (FF00::/8).', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-ipv6-reels', largeur: 720, hauteur: 346, titre: 'Types d’adresses IPv6 et cas d’utilisation',
    desc: 'Six types d’adresses IPv6. Globale unicast, plage 2000::/3, routable sur Internet. Link-local, FE80::/10, dialogue entre voisins d’un même lien, jamais routée. Bouclage, ::1/128, pour tester sa propre pile. Non spécifiée, ::/128, source d’un poste qui n’a pas encore d’adresse. Locale unique, FC00::/7, réseau privé interne comparable à 192.168. IPv4 intégré, ::ffff:0:0/96 et 64:ff9b::/96, pour la double pile et NAT64. Pas de diffusion en IPv6.',
    corps: g.join(''),
  });
}

// 7. Modes de diffusion ------------------------------------------------------
function castTypes() {
  const lignes = [
    [{ t: 'Monodiffusion (unicast)', gras: true, c: ACC, taille: 11.5 }, { t: '1 → 1', mono: true }, { t: 'charger une page web, un ping', taille: 11 }],
    [{ t: 'Diffusion (broadcast)', gras: true, c: WARN, taille: 11.5 }, { t: '1 → tous', mono: true }, { t: 'IPv4 seulement : ARP, DHCPDISCOVER', taille: 11 }],
    [{ t: 'Multidiffusion (multicast)', gras: true, c: OK, taille: 11.5 }, { t: '1 → un groupe', mono: true }, { t: 'télé IP d’un hôtel ; OSPF (224.0.0.5, FF02::5)', taille: 11 }],
    [{ t: 'Anycast', gras: true, c: CYAN, taille: 11.5 }, { t: '1 → le plus proche', mono: true }, { t: 'DNS publics (8.8.8.8, 1.1.1.1) : le serveur le plus proche répond', taille: 11 }],
  ];
  const g = [txt(360, 22, 'Qui reçoit le paquet ? Les quatre modes', { gras: true, taille: 15 }),
    tableau(10, 38, [190, 140, 370], ['Mode', 'Qui reçoit', 'Exemple réel'], lignes, { h: 40, taille: 12 })];
  g.push(txt(360, 262, 'En anycast, la même adresse est configurée sur plusieurs machines ; le routage choisit la plus proche.', { taille: 12, couleur: S }));
  g.push(txt(360, 282, 'IPv6 n’a pas de diffusion : le multicast FF02::1 (tous les nœuds) la remplace.', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-cast', largeur: 720, hauteur: 298, titre: 'Monodiffusion, diffusion, multidiffusion, anycast',
    desc: 'Quatre modes de livraison. Monodiffusion, un vers un : charger une page web. Diffusion, un vers tous, IPv4 seulement : ARP et DHCPDISCOVER. Multidiffusion, un vers un groupe : la télévision IP d’un hôtel, les annonces OSPF. Anycast, un vers le plus proche : les DNS publics comme 8.8.8.8. IPv6 n’a pas de diffusion, remplacée par la multidiffusion FF02::1.',
    corps: g.join(''),
  });
}

// 8. Multicast : télévision IP d'un hôtel --------------------------------------
function iptvHotel() {
  const g = [txt(360, 22, 'Télévision IP d’un hôtel : un flux, seulement pour ceux qui regardent', { gras: true, taille: 15 })];
  g.push(boite(14, 70, 124, 70, { bord: ACC, r: 10 }), txt(76, 92, 'Serveur vidéo', { gras: true, taille: 12.5 }), txt(76, 112, 'groupe', { taille: 10.5, couleur: S }), txt(76, 128, '239.1.1.1', { mono: true, taille: 12 }));
  g.push(boite(280, 80, 110, 50, { bord: BORD, trait: 2 }), txt(335, 102, 'Commutateur', { gras: true, taille: 12 }), txt(335, 118, 'IGMP snooping', { taille: 10, couleur: S }));
  g.push(fl(138, 105, 278, 105, { couleur: ACC, largeur: 4 }), txt(208, 92, '1 seul flux', { taille: 12, gras: true, couleur: ACC }));
  const chambres = [[472, 44, '101', true], [472, 98, '102', true], [472, 152, '103', false], [472, 206, '104', false]];
  for (const [x, y, n, regarde] of chambres) {
    g.push(boite(x, y, 226, 44, { bord: regarde ? OK : KO, trait: 2, r: 8 }));
    g.push(txt(x + 46, y + 27, `Chambre ${n}`, { gras: true, taille: 12.5, ancre: 'middle' }));
    g.push(txt(x + 158, y + 27, regarde ? '✓ reçoit le flux' : '✗ aucun flux', { taille: 11.5, couleur: regarde ? OK : KO, gras: true }));
    if (regarde) g.push(fl(392, 105, x - 2, y + 22, { couleur: OK, largeur: 3 }));
    else g.push(ligne(392, 105, x - 2, y + 22, { couleur: KO, largeur: 1.5, tirets: true }));
  }
  g.push(boite(14, 160, 262, 92, { bord: WARN, r: 10 }), txt(145, 180, 'Pourquoi pas en monodiffusion ?', { gras: true, taille: 12 }), txt(145, 200, 'Un flux par chambre : 100 chambres', { taille: 11.5 }), txt(145, 218, '= 100 fois la bande passante.', { taille: 11.5 }), txt(145, 238, 'Multicast : un flux, quel que soit le nombre.', { taille: 11.5, couleur: OK, gras: true }));
  g.push(txt(360, 282, 'La télévision de chaque chambre « rejoint » le groupe 239.1.1.1 par IGMP (IPv4) ou MLD (IPv6) ; elle le quitte en éteignant la chaîne.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-iptv', largeur: 720, hauteur: 298, titre: 'Multidiffusion : la télévision IP d’un hôtel',
    desc: 'Un serveur vidéo envoie un seul flux vers le groupe de multidiffusion 239.1.1.1. Le commutateur, avec IGMP snooping, ne le copie que vers les chambres qui ont rejoint le groupe : les chambres 101 et 102 regardent et reçoivent, les chambres 103 et 104 sont éteintes et ne reçoivent rien. En monodiffusion, il faudrait un flux par chambre. Chaque télévision rejoint le groupe par IGMP en IPv4 ou MLD en IPv6.',
    corps: g.join(''),
  });
}

// 9. Récapitulation de routes ------------------------------------------------
function routeRecap() {
  const bin = (n) => n.toString(2).padStart(8, '0');
  const g = [txt(360, 22, 'Récapituler : garder les bits communs, mettre le reste à zéro', { gras: true, taille: 15 })];
  const lignes = [0, 1, 2, 3].map((n) => [{ t: `192.168.${n}.0/24`, mono: true, taille: 12 }, { t: `11000000.10101000.${bin(n).slice(0, 6)}`, mono: true, taille: 11 }, { t: bin(n).slice(6), mono: true, taille: 11, c: KO, gras: true }]);
  g.push(tableau(20, 40, [170, 360, 170], ['Réseau', '22 premiers bits (communs)', '2 derniers bits'], lignes, { h: 30, taille: 12 }));
  g.push(boite(20, 200, 680, 60, { bord: OK, trait: 2, r: 10 }));
  g.push(txt(360, 224, '✓ Route récapitulative : 192.168.0.0/22  (masque 255.255.252.0)', { gras: true, taille: 14, couleur: OK }));
  g.push(txt(360, 246, 'ip route 192.168.0.0 255.255.252.0 10.0.0.2', { mono: true, taille: 12 }));
  g.push(boite(20, 274, 680, 44, { bord: KO, trait: 1.5, r: 10 }));
  g.push(txt(360, 294, '✗ 192.168.1.0 à 192.168.4.0 ne se regroupent pas : 1 = 00000001 et 4 = 00000100 diffèrent trop tôt.', { taille: 11.5 }));
  g.push(txt(360, 310, 'Il faudrait un /21 (0 à 7), qui annonce aussi des réseaux qu’on n’a pas.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-route-recap', largeur: 720, hauteur: 332, titre: 'Récapitulation de routes : quatre /24 en un /22',
    desc: 'Les réseaux 192.168.0.0 à 192.168.3.0, quatre /24, ont les 22 mêmes premiers bits : seuls les deux derniers bits du troisième octet changent, de 00 à 11. On garde les 22 bits communs et on met le reste à zéro : la route récapitulative est 192.168.0.0/22, masque 255.255.252.0, avec la commande ip route 192.168.0.0 255.255.252.0 10.0.0.2. À l’inverse, 192.168.1.0 à 192.168.4.0 ne se regroupent pas proprement, car 1 vaut 00000001 et 4 vaut 00000100.',
    corps: g.join(''),
  });
}

export const SCHEMAS_NAT = {
  'nat-vocabulaire': { titre: 'Vocabulaire NAT', legende: 'Inside et outside désignent les côtés du routeur ; local et global, la vue de l’intérieur ou de l’extérieur.', svg: natVocabulaire },
  'nat-trois-types': { titre: 'Les trois types de NAT', legende: 'Statique (un pour un, fixe), dynamique (un pool) et PAT (une adresse, plusieurs ports).', svg: natTrois },
  'pat-table': { titre: 'Table de traduction du PAT', legende: 'Deux postes, une adresse publique : les ports source distinguent les conversations.', svg: patTable },
  'socket-ports': { titre: 'Socket et plages de ports', legende: 'Adresse IP plus port ; ports bien connus, enregistrés et dynamiques.', svg: socketPorts },
  'nat64': { titre: 'NAT64 : de l’IPv6 vers l’IPv4', legende: 'Un poste IPv6 atteint un serveur IPv4 grâce au préfixe 64:ff9b::/96 et à un routeur NAT64.', svg: nat64 },
  'ipv6-types-reels': { titre: 'Types d’adresses IPv6 et leurs usages', legende: 'Globale, link-local, bouclage, non spécifiée, locale unique et IPv4 intégré, avec un cas réel pour chacune.', svg: ipv6TypesReels },
  'cast-types': { titre: 'Modes de diffusion', legende: 'Monodiffusion, diffusion, multidiffusion et anycast avec un exemple réel chacun.', svg: castTypes },
  'multicast-iptv': { titre: 'Télévision IP d’un hôtel', legende: 'Un seul flux vers le groupe 239.1.1.1, copié seulement vers les chambres qui regardent.', svg: iptvHotel },
  'route-recap': { titre: 'Récapitulation de routes', legende: 'Quatre /24 voisins deviennent un /22 : on garde les bits communs.', svg: routeRecap },
};
