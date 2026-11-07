/**
 * schemas-azure-lb.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Schémas ORIGINAUX (SVG en ligne) des équilibreurs de charge Azure autres que
 * l'Azure Load Balancer public de base : Load Balancer interne, règles NAT et
 * sortantes, Load Balancer inter-régions, Application Gateway (avec WAF),
 * Front Door et Traffic Manager. Mêmes outils de dessin et mêmes règles que
 * schemas-azure.mjs : titre, texte alternatif <desc>, légende, état dit par un
 * symbole ET un mot (jamais la couleur seule), thèmes clair/sombre. Module PUR.
 * Les adresses et les noms sont des EXEMPLES écrits à la main.
 */
import { txt, boite, ligne, fl, carte, svg, S, ACC, CYAN, OK, KO, WARN, BORD as BORD_ } from './schemas-azure.mjs';

// 1. Load Balancer interne -----------------------------------------------------
function lbInterne() {
  const g = [txt(360, 22, 'Load Balancer interne : une frontale privée dans un sous-réseau', { gras: true, taille: 14.5 })];
  g.push(carte(14, 76, 110, 56, 'Internet', '✗ aucun accès direct', { bord: KO }));
  g.push(boite(150, 40, 556, 214, { fond: 'none', bord: CYAN, tirets: true, r: 16 }), txt(250, 60, 'Réseau virtuel vnet1', { gras: true, taille: 12.5, couleur: CYAN }));
  g.push(carte(170, 76, 130, 56, 'Couche web', 'vm-web1, vm-web2', { bord: ACC }));
  g.push(fl(300, 104, 352, 104, { couleur: OK }));
  g.push(carte(352, 76, 150, 56, 'Frontale PRIVÉE', '10.1.0.10 (Load Balancer)', { bord: ACC }));
  g.push(boite(530, 70, 166, 170, { fond: 'none', bord: BORD_, tirets: true, r: 12 }), txt(613, 88, 'Pool : couche données', { gras: true, taille: 11.5 }));
  g.push(carte(542, 98, 142, 40, 'vm-db1', '✓ sain · reçoit'), carte(542, 144, 142, 40, 'vm-db2', '✓ sain · reçoit'), carte(542, 190, 142, 40, 'vm-db3', '✗ sonde échoue · retirée', { bord: KO }));
  g.push(fl(502, 104, 540, 118, { couleur: OK }), fl(502, 108, 540, 164, { couleur: OK }), fl(502, 112, 540, 210, { couleur: KO, tirets: true }));
  g.push(carte(352, 160, 150, 50, 'Sonde TCP 1433', '⚠ vérifie chaque serveur', { bord: WARN }));
  g.push(ligne(427, 132, 427, 160, { couleur: WARN, tirets: true }));
  g.push(txt(240, 200, 'Le trafic reste dans le VNet :', { taille: 11, couleur: S }), txt(240, 216, 'visible seulement depuis le VNet,', { taille: 11, couleur: S }), txt(240, 232, 'un VNet appairé ou un VPN.', { taille: 11, couleur: S }));
  g.push(ligne(124, 104, 150, 104, { couleur: KO, tirets: true }));
  g.push(txt(360, 272, 'Même quatre composants que le Load Balancer public ; seule la frontale change : IP privée au lieu d’IP publique.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-lb-interne', largeur: 720, hauteur: 286, titre: 'Azure Load Balancer interne',
    desc: 'Dans un réseau virtuel, la couche web envoie ses connexions vers la frontale privée 10.1.0.10 d’un équilibreur de charge interne. Une règle les répartit entre les serveurs sains vm-db1 et vm-db2 du pool de la couche données ; vm-db3, dont la sonde TCP 1433 échoue, est retirée. Internet n’a aucun accès direct : seule la frontale privée existe.',
    corps: g.join(''),
  });
}

// 2. Règles NAT entrantes et règle sortante ---------------------------------------
function lbNatSortant() {
  const g = [txt(360, 22, 'Règle NAT entrante et règle sortante (SNAT)', { gras: true, taille: 15 })];
  g.push(carte(14, 52, 120, 56, 'Administrateur', 'Internet', { bord: S }));
  g.push(carte(190, 52, 150, 56, 'Frontale publique', 'pip-lb : port 50001', { bord: ACC }));
  g.push(fl(134, 80, 190, 80, { couleur: OK }));
  g.push(carte(190, 176, 150, 56, 'Frontale sortante', 'pip-sortie', { bord: CYAN }));
  g.push(boite(430, 40, 276, 214, { fond: 'none', bord: BORD_, tirets: true, r: 14 }), txt(568, 60, 'Pool de serveurs', { gras: true, taille: 12.5 }));
  g.push(carte(450, 74, 236, 56, 'vm1 (le port 22 écoute)', '✓ entrant : NAT 50001 → 22', { bord: OK }));
  g.push(carte(450, 164, 236, 56, 'vm1, vm2 (appels vers Internet)', '✓ sortant : adresse pip-sortie', { bord: CYAN }));
  g.push(fl(340, 80, 448, 100, { couleur: OK }), txt(395, 70, 'règle NAT entrante', { taille: 10.5, couleur: S }));
  g.push(fl(448, 196, 342, 204, { couleur: CYAN }), txt(395, 232, 'règle sortante (SNAT)', { taille: 10.5, couleur: S }));
  g.push(carte(14, 176, 120, 56, 'Internet', 'sites appelés', { bord: S }));
  g.push(fl(190, 204, 136, 204, { couleur: CYAN }));
  g.push(txt(360, 274, 'NAT entrante : un port de la frontale mène à UNE machine. Règle sortante : on choisit l’adresse et le nombre de ports SNAT.', { taille: 11, couleur: S }));
  g.push(txt(360, 292, '⚠ Limite la source du port NAT (SSH) dans le groupe de sécurité réseau : sinon tout Internet peut essayer.', { taille: 11, couleur: WARN }));
  return svg({
    id: 'sc-az-lb-nat-sortant', largeur: 720, hauteur: 306, titre: 'Règle NAT entrante et règle sortante d’un Load Balancer',
    desc: 'Entrant : un administrateur sur Internet joint le port 50001 de la frontale publique ; la règle NAT entrante le dirige vers le port 22 de la machine vm1 du pool. Sortant : les machines du pool qui appellent Internet sortent avec l’adresse de la frontale sortante pip-sortie grâce à la règle sortante (SNAT). Un avertissement rappelle de limiter la source du port NAT dans le groupe de sécurité réseau.',
    corps: g.join(''),
  });
}

// 3. Load Balancer inter-régions -------------------------------------------------
function lbInterRegions() {
  const g = [txt(360, 22, 'Load Balancer inter-régions : une adresse globale devant des équilibreurs régionaux', { gras: true, taille: 14 })];
  g.push(carte(14, 100, 110, 56, 'Clients', 'monde entier'));
  g.push(carte(160, 100, 170, 56, 'Frontale GLOBALE', 'IP publique niveau Global', { bord: ACC }));
  g.push(fl(124, 128, 160, 128));
  g.push(carte(160, 176, 170, 44, 'Règle TCP 80', 'pool = frontaux régionaux', { bord: CYAN }));
  g.push(ligne(245, 156, 245, 176, { couleur: CYAN, tirets: true }));
  g.push(boite(378, 38, 328, 108, { fond: 'none', bord: BORD_, tirets: true, r: 14 }), txt(450, 56, 'Canada Centre', { gras: true, taille: 12 }));
  g.push(carte(394, 66, 132, 64, 'LB régional 1', '✓ en ligne', { bord: OK }), carte(546, 66, 144, 64, 'vm1, vm2', 'pool régional', { bord: BORD_ }));
  g.push(fl(526, 98, 544, 98, { couleur: OK }));
  g.push(boite(378, 158, 328, 108, { fond: 'none', bord: BORD_, tirets: true, r: 14 }), txt(446, 176, 'Europe Ouest', { gras: true, taille: 12 }));
  g.push(carte(394, 186, 132, 64, 'LB régional 2', '✗ en panne', { bord: KO }), carte(546, 186, 144, 64, 'vm3, vm4', 'pool régional', { bord: BORD_ }));
  g.push(fl(526, 218, 544, 218, { couleur: KO, tirets: true }));
  g.push(fl(330, 118, 392, 98, { couleur: OK }), fl(330, 138, 392, 218, { couleur: KO, tirets: true }));
  g.push(txt(360, 288, '✓ Le client est dirigé vers la région saine la plus proche ; ✗ une région en panne est retirée.', { taille: 11.5, couleur: S }));
  g.push(txt(360, 306, 'Niveau 4, TCP et UDP ; la frontale globale suit la santé des équilibreurs régionaux (sondes régionales).', { taille: 11, couleur: S }));
  return svg({
    id: 'sc-az-lb-inter-regions', largeur: 720, hauteur: 320, titre: 'Load Balancer inter-régions (global)',
    desc: 'Des clients du monde entier joignent une frontale globale, une adresse IP publique de niveau Global. Une règle TCP 80 envoie le trafic vers un pool dont les membres sont les frontaux d’équilibreurs régionaux : le LB régional 1 de Canada Centre, en ligne, avec vm1 et vm2, et le LB régional 2 d’Europe Ouest, en panne, avec vm3 et vm4, qui est retiré. Le client est dirigé vers la région saine la plus proche.',
    corps: g.join(''),
  });
}

// 4. Application Gateway ----------------------------------------------------------
function appGateway() {
  const g = [txt(360, 22, 'Application Gateway : écouteur, règle, paramètres HTTP, pool', { gras: true, taille: 14.5 })];
  g.push(carte(10, 88, 86, 56, 'Clients', 'HTTP(S)'));
  g.push(boite(112, 38, 598, 228, { fond: 'none', bord: ACC, tirets: true, r: 16 }), txt(272, 58, 'Application Gateway v2 (sous-réseau dédié)', { gras: true, taille: 12, couleur: ACC }));
  g.push(fl(96, 116, 124, 116));
  g.push(carte(124, 88, 112, 56, '1. Écouteur', 'IP publique : 80', { bord: ACC }));
  g.push(carte(262, 88, 100, 56, '2. Règle', 'routage de base', { bord: CYAN }));
  g.push(carte(388, 88, 120, 56, '3. Param. HTTP', 'port 80, délai 30 s', { bord: CYAN }));
  g.push(fl(236, 116, 262, 116), fl(362, 116, 388, 116));
  g.push(boite(540, 52, 160, 200, { fond: 'none', bord: BORD_, tirets: true, r: 12 }), txt(620, 70, '4. Pool de serveurs', { gras: true, taille: 11.5 }));
  g.push(carte(552, 82, 136, 44, '10.2.1.4', '✓ sain · reçoit'), carte(552, 132, 136, 44, '10.2.1.5', '✓ sain · reçoit'), carte(552, 182, 136, 44, '10.2.1.6', '✗ sonde échoue · retiré', { bord: KO }));
  g.push(fl(508, 112, 550, 104, { couleur: OK }), fl(508, 120, 550, 154, { couleur: OK }), fl(508, 126, 550, 204, { couleur: KO, tirets: true }));
  g.push(carte(388, 176, 120, 52, '5. Sonde HTTP', '⚠ GET / → code 200', { bord: WARN }));
  g.push(ligne(448, 144, 448, 176, { couleur: WARN, tirets: true }), ligne(508, 202, 550, 204, { couleur: WARN, tirets: true }));
  g.push(carte(124, 176, 238, 52, 'WAF (option)', 'politique : Détection ou Prévention', { bord: KO, tirets: true }));
  g.push(ligne(180, 144, 180, 176, { couleur: KO, tirets: true }));
  g.push(txt(360, 286, 'Niveau 7 : lit la requête HTTP (nom d’hôte, chemin) pour choisir le pool. Régional : au sein d’une région.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-lb-appgw', largeur: 720, hauteur: 300, titre: 'Application Gateway : écouteur, règle, paramètres HTTP et pool',
    desc: 'Les clients atteignent l’écouteur de l’Application Gateway sur l’adresse IP publique, port 80. Une règle de routage envoie la requête, avec les paramètres HTTP (port 80, délai de 30 secondes), vers le pool de serveurs. Une sonde HTTP interroge chaque serveur : 10.2.1.4 et 10.2.1.5 sont sains et reçoivent le trafic, 10.2.1.6 échoue et est retiré. Un pare-feu d’applications web facultatif, en mode Détection ou Prévention, inspecte les requêtes.',
    corps: g.join(''),
  });
}

// 5. Front Door ---------------------------------------------------------------------
function frontDoor() {
  const g = [txt(360, 22, 'Front Door : la bordure mondiale de Microsoft devant tes origines', { gras: true, taille: 14.5 })];
  g.push(carte(10, 52, 100, 50, 'Client Europe', 'Paris'), carte(10, 192, 100, 50, 'Client Canada', 'Montréal'));
  g.push(boite(150, 38, 200, 216, { fond: 'none', bord: ACC, tirets: true, r: 16 }), txt(250, 58, 'Bordure mondiale', { gras: true, taille: 12.5, couleur: ACC }));
  g.push(carte(166, 70, 168, 54, 'Point de présence', 'Europe : TLS, cache, WAF', { bord: ACC }));
  g.push(carte(166, 168, 168, 54, 'Point de présence', 'Amérique : TLS, cache, WAF', { bord: ACC }));
  g.push(fl(110, 77, 164, 94), fl(110, 217, 164, 196));
  g.push(carte(384, 104, 120, 70, 'Route', 'endpoint + chemin /*', { bord: CYAN }));
  g.push(fl(334, 96, 384, 130, { couleur: S }), fl(334, 196, 384, 150, { couleur: S }));
  g.push(boite(540, 40, 166, 212, { fond: 'none', bord: BORD_, tirets: true, r: 14 }), txt(623, 58, 'Groupe d’origines', { gras: true, taille: 12 }));
  g.push(carte(552, 70, 142, 50, 'Origine Canada', '✓ sonde HTTP ok', { bord: OK }), carte(552, 128, 142, 50, 'Origine Europe', '✓ sonde HTTP ok', { bord: OK }), carte(552, 186, 142, 50, 'Origine sauvegarde', '✗ sonde échoue', { bord: KO }));
  g.push(fl(504, 128, 550, 96, { couleur: OK }), fl(504, 139, 550, 152, { couleur: OK }), fl(504, 150, 550, 210, { couleur: KO, tirets: true }));
  g.push(txt(360, 274, 'Niveau 7 et global : le client se connecte au point de présence le plus proche, qui relaie vers l’origine la plus rapide et saine.', { taille: 11, couleur: S }));
  g.push(txt(360, 292, 'Contrairement à Traffic Manager, Front Door voit et relaie le trafic HTTP(S) : cache, TLS et WAF au niveau de la bordure.', { taille: 11, couleur: S }));
  return svg({
    id: 'sc-az-lb-frontdoor', largeur: 720, hauteur: 306, titre: 'Azure Front Door : bordure mondiale et groupe d’origines',
    desc: 'Un client à Paris et un client à Montréal se connectent chacun au point de présence de la bordure mondiale Front Door le plus proche, où se font TLS, cache et pare-feu web. La route associe le point de terminaison et le modèle d’URL au groupe d’origines. La sonde HTTP de chaque origine décide : les origines Canada et Europe sont saines et reçoivent le trafic, l’origine de sauvegarde échoue et est écartée. Front Door voit et relaie le trafic HTTP et HTTPS.',
    corps: g.join(''),
  });
}

// 6. Traffic Manager ------------------------------------------------------------------
function trafficManager() {
  const g = [txt(360, 22, 'Traffic Manager : une réponse DNS, pas un relais du trafic', { gras: true, taille: 14.5 })];
  g.push(carte(10, 70, 100, 56, 'Client', 'navigateur'));
  g.push(carte(150, 70, 160, 56, 'Résolveur DNS', 'demande le nom', { bord: S }));
  g.push(carte(350, 70, 170, 56, 'Traffic Manager', 'tm-web.trafficmanager.net', { bord: ACC }));
  g.push(fl(110, 90, 150, 90), fl(310, 90, 350, 90));
  g.push(fl(350, 108, 312, 108, { couleur: OK }), fl(150, 108, 112, 108, { couleur: OK }));
  g.push(txt(230, 148, '1. Question DNS · 2. Réponse : adresse du point choisi', { taille: 10.5, couleur: S }));
  g.push(boite(556, 38, 150, 216, { fond: 'none', bord: BORD_, tirets: true, r: 14 }), txt(631, 56, 'Points de terminaison', { gras: true, taille: 11.5 }));
  g.push(carte(566, 68, 130, 50, 'site-ca', '✓ en ligne · priorité 1', { bord: OK }), carte(566, 126, 130, 50, 'site-fr', '✓ en ligne · priorité 2', { bord: OK }), carte(566, 184, 130, 50, 'site-us', '✗ dégradé · écarté', { bord: KO }));
  g.push(fl(520, 98, 564, 94, { couleur: CYAN, tirets: true }), fl(520, 104, 564, 152, { couleur: CYAN, tirets: true }), fl(520, 110, 564, 210, { couleur: KO, tirets: true }));
  g.push(txt(440, 148, '⚠ sondes de santé', { taille: 10.5, couleur: WARN }));
  g.push(carte(10, 190, 300, 60, '3. Le client contacte DIRECTEMENT le point', 'le trafic ne passe PAS par Traffic Manager', { bord: WARN }));
  g.push(fl(310, 210, 564, 160, { couleur: OK }));
  g.push(txt(360, 274, '⚠ Traffic Manager ne voit pas le trafic : il choisit une réponse DNS. Un basculement attend la fin du TTL du DNS.', { taille: 11, couleur: WARN }));
  g.push(txt(360, 292, 'Méthodes : Priorité, Pondéré, Performance, Géographique, Sous-réseau, Multivaleur. Tout protocole, au niveau du DNS.', { taille: 11, couleur: S }));
  return svg({
    id: 'sc-az-lb-trafficmanager', largeur: 720, hauteur: 306, titre: 'Traffic Manager : équilibrage par le DNS',
    desc: 'Le client demande au résolveur DNS le nom du profil Traffic Manager. Traffic Manager répond avec l’adresse d’un point de terminaison choisi selon la méthode de routage, parmi site-ca en ligne priorité 1, site-fr en ligne priorité 2, et site-us dégradé donc écarté après sa sonde. Le client contacte ensuite directement ce point de terminaison : le trafic ne passe pas par Traffic Manager, qui ne voit pas le trafic. Un basculement attend la fin du TTL du DNS.',
    corps: g.join(''),
  });
}

export const SCHEMAS_AZURE_LB = {
  'az-lb-interne': { titre: 'Load Balancer interne', legende: 'Frontale privée dans un sous-réseau : le service n’est joignable que depuis le réseau virtuel (ou un réseau relié).', svg: lbInterne },
  'az-lb-nat-sortant': { titre: 'Règle NAT entrante et règle sortante', legende: 'Un port de la frontale mène à une machine (entrant) ; la règle sortante choisit l’adresse et les ports SNAT des appels vers Internet.', svg: lbNatSortant },
  'az-lb-inter-regions': { titre: 'Load Balancer inter-régions', legende: 'Une frontale globale devant des équilibreurs régionaux : le client est dirigé vers la région saine la plus proche.', svg: lbInterRegions },
  'az-lb-appgw': { titre: 'Application Gateway', legende: 'Écouteur, règle de routage, paramètres HTTP, pool et sonde ; le WAF inspecte les requêtes en option.', svg: appGateway },
  'az-lb-frontdoor': { titre: 'Azure Front Door', legende: 'La bordure mondiale reçoit le client, applique la route et relaie vers l’origine saine du groupe d’origines.', svg: frontDoor },
  'az-lb-trafficmanager': { titre: 'Traffic Manager', legende: 'Il répond au DNS avec le bon point de terminaison, puis le client s’y connecte directement : Traffic Manager ne voit pas le trafic.', svg: trafficManager },
};
