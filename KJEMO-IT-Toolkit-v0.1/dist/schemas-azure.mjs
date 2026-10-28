/**
 * schemas-azure.mjs — KJEMO-AZURE-COURS-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Schémas ORIGINAUX (SVG en ligne) pour le cours d'infonuagique : hiérarchie
 * des ressources, régions et zones, modèles de service, réseau virtuel,
 * DNS public et privé, peering, routes, points de terminaison de service et
 * privés, et Azure Load Balancer. Dessinés ici, avec nos mots : aucune
 * diapositive n'est copiée. Module PUR (aucun DOM).
 * Mêmes règles que schemas-cisco.mjs : titre, texte alternatif, légende, état
 * dit par un symbole ET un mot (jamais la couleur seule), thèmes clair/sombre.
 * Les adresses sont des EXEMPLES écrits à la main.
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
/** Boîte avec un titre centré et une ligne de détail facultative. */
function carte(x, y, w, h, titre, detail = '', { bord = BORD, fond = CASE, couleur = T, tirets = false, mono = false } = {}) {
  return boite(x, y, w, h, { bord, fond, tirets }) + txt(x + w / 2, y + (detail ? h / 2 - 3 : h / 2 + 5), titre, { gras: true, taille: 13, couleur })
    + (detail ? txt(x + w / 2, y + h / 2 + 14, detail, { taille: 11, couleur: S, mono }) : '');
}
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

// 1. Hiérarchie ----------------------------------------------------------------
function hierarchie() {
  const g = [txt(360, 22, 'Du groupe d’administration à la ressource', { gras: true, taille: 15 })];
  g.push(carte(250, 36, 220, 40, 'Groupe d’administration', '', { bord: ACC }));
  g.push(carte(120, 108, 190, 44, 'Abonnement 1', 'facturation et accès', { bord: CYAN }), carte(410, 108, 190, 44, 'Abonnement 2', 'facturation et accès', { bord: CYAN }));
  g.push(fl(330, 76, 240, 108), fl(390, 76, 480, 108));
  g.push(carte(50, 184, 150, 40, 'Groupe A', 'rg-lab'), carte(220, 184, 150, 40, 'Groupe B', 'rg-prod'), carte(450, 184, 170, 40, 'Groupe C', 'rg-test'));
  g.push(fl(190, 152, 125, 184), fl(240, 152, 295, 184), fl(510, 152, 535, 184));
  g.push(carte(50, 250, 68, 34, 'VNet'), carte(132, 250, 68, 34, 'VM'), carte(220, 250, 150, 34, 'Stockage'), carte(450, 250, 170, 34, 'Ressources'));
  g.push(fl(125, 224, 84, 250), fl(125, 224, 166, 250), fl(295, 224, 295, 250), fl(535, 224, 535, 250));
  g.push(txt(360, 308, 'Droits (RBAC), verrous et règles : hérités vers le bas. Une ressource appartient à UN seul groupe.', { taille: 12, couleur: S }));
  return svg({
    id: 'sc-az-hierarchie', largeur: 720, hauteur: 322, titre: 'Hiérarchie : groupe d’administration, abonnement, groupe de ressources, ressource',
    desc: 'Un groupe d’administration contient des abonnements. Chaque abonnement contient des groupes de ressources, et chaque groupe contient des ressources comme un réseau virtuel, une machine ou un compte de stockage. Les droits, les verrous et les règles sont hérités vers le bas, et une ressource appartient à un seul groupe.',
    corps: g.join(''),
  });
}

// 2. Régions et zones ----------------------------------------------------------
function regionsZones() {
  const g = [txt(360, 22, 'Région, zones de disponibilité et paire régionale', { gras: true, taille: 15 })];
  g.push(boite(20, 40, 420, 190, { fond: 'none', bord: CYAN, tirets: true, r: 14 }), txt(230, 62, 'Région 1 (Canada Centre)', { gras: true, taille: 13, couleur: CYAN }));
  g.push(carte(36, 76, 120, 70, 'Zone 1', 'centre de données', {}), carte(170, 76, 120, 70, 'Zone 2', 'centre de données'), carte(304, 76, 120, 70, 'Zone 3', 'centre de données'));
  g.push(txt(230, 172, 'Alimentation, climatisation et réseau indépendants', { taille: 12, couleur: S }), txt(230, 192, 'reliés par fibre optique privée', { taille: 12, couleur: S }));
  g.push(txt(230, 216, '✓ une panne d’un centre de données ne coupe pas la région', { taille: 12, couleur: OK, gras: true }));
  g.push(boite(500, 40, 200, 190, { fond: 'none', bord: CYAN, tirets: true, r: 14 }), txt(600, 62, 'Région 2 (Canada Est)', { gras: true, taille: 13, couleur: CYAN }));
  g.push(carte(520, 82, 160, 60, 'Paire régionale', 'même zone géographique'));
  g.push(txt(600, 170, '≥ 500 km des deux régions', { taille: 12, couleur: S }), txt(600, 190, 'mises à jour décalées', { taille: 12, couleur: S }));
  g.push(fl(440, 110, 500, 110, { couleur: ACC, largeur: 3 }), fl(500, 125, 440, 125, { couleur: ACC, largeur: 3 }));
  g.push(txt(470, 98, 'copie', { taille: 11, couleur: ACC }));
  g.push(txt(360, 256, 'D’après le cours : machine seule 99,9 % (stockage Premium) · zones de disponibilité 99,99 % · deux régions = reprise après sinistre', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-regions', largeur: 720, hauteur: 274, titre: 'Régions, zones de disponibilité et paires régionales',
    desc: 'Une région contient jusqu’à trois zones de disponibilité, des centres de données physiquement séparés avec leur propre alimentation, climatisation et réseau. Une région est associée à une seconde région de la même zone géographique, à au moins 500 kilomètres, pour la reprise après sinistre.',
    corps: g.join(''),
  });
}

// 3. Modèles de service --------------------------------------------------------
function modeles() {
  const toi = { t: '✎ toi', c: WARN, gras: true };
  const four = { t: '☁ fournisseur', c: OK };
  const g = [txt(360, 22, 'Qui gère quoi : sur site, IaaS, PaaS, SaaS', { gras: true, taille: 15 })];
  g.push(tableau(30, 38, [190, 120, 120, 120, 120], ['', 'Sur site', 'IaaS', 'PaaS', 'SaaS'], [
    [{ t: 'Applications', gras: true }, toi, toi, toi, four],
    [{ t: 'Données et accès', gras: true }, toi, toi, toi, toi],
    [{ t: 'Système d’exploitation', gras: true }, toi, toi, four, four],
    [{ t: 'Serveurs, stockage, réseau', gras: true }, toi, four, four, four],
  ], { h: 36, taille: 12 }));
  g.push(txt(360, 232, 'IaaS : machines virtuelles · PaaS : App Service, bases de données · SaaS : Microsoft 365', { taille: 12, couleur: S }));
  g.push(txt(360, 252, 'Dans tous les modèles, tes données et tes accès restent ta responsabilité.', { taille: 12, couleur: WARN, gras: true }));
  return svg({
    id: 'sc-az-modeles', largeur: 720, hauteur: 268, titre: 'Responsabilités selon le modèle de service',
    desc: 'Un tableau compare quatre modèles. Sur site, tu gères tout. En IaaS, le fournisseur gère serveurs, stockage et réseau. En PaaS, il gère aussi le système d’exploitation. En SaaS, il gère aussi l’application. Les données et les accès restent toujours la responsabilité du client.',
    corps: g.join(''),
  });
}

// 4. VNet et sous-réseaux ------------------------------------------------------
function vnetSousReseaux() {
  const g = [txt(200, 22, 'Réseau virtuel et ses sous-réseaux', { gras: true, taille: 15 }), txt(560, 22, 'Les 5 adresses réservées d’un sous-réseau', { gras: true, taille: 14 })];
  g.push(boite(14, 36, 372, 250, { fond: 'none', bord: CYAN, tirets: true, r: 14 }), txt(200, 58, 'VNet vnet1 · 10.1.0.0/16', { mono: true, taille: 12.5, couleur: CYAN, gras: true }));
  g.push(carte(34, 72, 332, 54, 'Sous-réseau app', '10.1.0.0/24 · serveurs web', { mono: false }), carte(34, 138, 332, 54, 'Sous-réseau db', '10.1.1.0/24 · bases de données'), carte(34, 204, 332, 54, 'GatewaySubnet', '10.1.255.0/27 · passerelle VPN'));
  g.push(txt(200, 278, 'Chaque plage est unique et tient dans le VNet', { taille: 11.5, couleur: S }));
  g.push(tableau(404, 36, [116, 200], ['Adresse', 'Rôle'], [
    [{ t: '10.1.1.0', mono: true }, { t: '⊘ réseau', c: KO }],
    [{ t: '10.1.1.1', mono: true }, { t: '⊘ passerelle par défaut', c: KO }],
    [{ t: '10.1.1.2', mono: true }, { t: '⊘ DNS Azure', c: KO }],
    [{ t: '10.1.1.3', mono: true }, { t: '⊘ DNS Azure', c: KO }],
    [{ t: '10.1.1.4 à .254', mono: true }, { t: '✓ utilisables', c: OK }],
    [{ t: '10.1.1.255', mono: true }, { t: '⊘ diffusion', c: KO }],
  ], { h: 30, taille: 12 }));
  g.push(txt(564, 262, 'Plus petit sous-réseau : /29 (3 adresses utilisables)', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-vnet', largeur: 720, hauteur: 298, titre: 'Réseau virtuel, sous-réseaux et adresses réservées',
    desc: 'Un réseau virtuel 10.1.0.0/16 contient trois sous-réseaux aux plages uniques : app, db et GatewaySubnet. À droite, les adresses d’un sous-réseau : la première (réseau), la deuxième (passerelle par défaut), la troisième et la quatrième (DNS Azure) et la dernière (diffusion) sont réservées par Azure ; les autres sont utilisables.',
    corps: g.join(''),
  });
}

// 5. DNS public et privé -------------------------------------------------------
function dnsPublicPrive() {
  const g = [txt(180, 22, 'Zone publique', { gras: true, taille: 15 }), txt(540, 22, 'Zone privée', { gras: true, taille: 15 }), ligne(360, 12, 360, 270, { couleur: BORD, largeur: 1, tirets: true })];
  g.push(carte(30, 40, 300, 40, 'Internet : tout le monde interroge'), carte(30, 104, 300, 46, 'Bureau d’enregistrement', 'délègue vers les 4 serveurs Azure', { bord: WARN }));
  g.push(carte(30, 174, 300, 46, 'Zone contoso.com (Azure DNS)', 'www → 203.0.113.10 (A)', { bord: CYAN, mono: true }));
  g.push(fl(180, 80, 180, 104), fl(180, 150, 180, 174));
  g.push(txt(180, 246, '✓ visible depuis Internet', { couleur: OK, gras: true, taille: 12.5 }), txt(180, 264, 'Il faut posséder le domaine pour le déléguer', { taille: 11.5, couleur: S }));
  g.push(boite(380, 40, 320, 130, { fond: 'none', bord: CYAN, tirets: true, r: 14 }), txt(540, 60, 'VNet vnet1', { gras: true, taille: 12.5, couleur: CYAN }));
  g.push(carte(396, 72, 130, 40, 'vm1'), carte(554, 72, 130, 40, 'vm2'), txt(540, 140, 'vm1 trouve vm2.contoso.lab', { mono: true, taille: 12 }));
  g.push(carte(380, 194, 320, 46, 'Zone privée contoso.lab', 'liée au VNet (inscription automatique)', { bord: ACC }));
  g.push(ligne(540, 170, 540, 194, { couleur: ACC, largeur: 3 }));
  g.push(txt(540, 262, '✗ invisible depuis Internet', { couleur: KO, gras: true, taille: 12.5 }));
  return svg({
    id: 'sc-az-dns', largeur: 720, hauteur: 278, titre: 'Zone DNS publique et zone DNS privée',
    desc: 'À gauche, une zone publique : Internet interroge le bureau d’enregistrement, qui délègue aux quatre serveurs de noms Azure, qui contiennent la zone contoso.com et ses enregistrements. À droite, une zone privée contoso.lab liée à un réseau virtuel : les machines du réseau se trouvent par nom, et la zone est invisible depuis Internet.',
    corps: g.join(''),
  });
}

// 6. Peering -------------------------------------------------------------------
function peering() {
  const g = [txt(190, 22, 'Appairage dans les deux sens', { gras: true, taille: 15 }), txt(540, 22, 'Pas de transit', { gras: true, taille: 15 }), ligne(360, 12, 360, 236, { couleur: BORD, largeur: 1, tirets: true })];
  g.push(carte(30, 70, 120, 56, 'vnet1', '10.1.0.0/16', { bord: CYAN, mono: true }), carte(230, 70, 120, 56, 'vnet2', '10.2.0.0/16', { bord: CYAN, mono: true }));
  g.push(fl(152, 88, 228, 88, { couleur: OK, largeur: 3 }), fl(228, 110, 152, 110, { couleur: OK, largeur: 3 }));
  g.push(txt(190, 62, 'vnet1-vers-vnet2', { mono: true, taille: 10.5, couleur: S }), txt(190, 142, 'vnet2-vers-vnet1', { mono: true, taille: 10.5, couleur: S }));
  g.push(txt(190, 176, '✓ Connected (les deux sens)', { couleur: OK, gras: true, taille: 12.5 }));
  g.push(txt(190, 200, 'Un seul sens créé : « Initiated », rien ne passe', { couleur: WARN, taille: 11.5 }), txt(190, 220, 'Plages qui se chevauchent : appairage refusé', { couleur: KO, taille: 11.5 }));
  g.push(carte(380, 70, 90, 50, 'A', '', { bord: CYAN }), carte(500, 70, 90, 50, 'B', '', { bord: CYAN }), carte(620, 70, 80, 50, 'C', '', { bord: CYAN }));
  g.push(ligne(472, 95, 498, 95, { couleur: OK, largeur: 4 }), ligne(592, 95, 618, 95, { couleur: OK, largeur: 4 }));
  g.push(`<path d="M425 122 C425 175 660 175 660 122" fill="none" stroke="${KO}" stroke-width="3" stroke-dasharray="7 5"/>`);
  g.push(txt(542, 192, '✗ A ne joint pas C', { couleur: KO, gras: true, taille: 13 }));
  g.push(txt(540, 214, 'A↔B et B↔C : chaque lien se configure séparément.', { taille: 11.5, couleur: S }), txt(540, 232, 'Le trafic ne traverse pas B pour aller de A à C.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-peering', largeur: 720, hauteur: 250, titre: 'Appairage de réseaux virtuels : deux sens et pas de transit',
    desc: 'À gauche, deux réseaux virtuels appairés par deux objets, un dans chaque sens, qui doivent tous deux être Connected ; un seul sens donne Initiated et des plages qui se chevauchent sont refusées. À droite, trois réseaux A, B et C appairés en chaîne : A joint B et B joint C, mais A ne joint pas C car l’appairage n’est pas transitif.',
    corps: g.join(''),
  });
}

// 7. Routes système ------------------------------------------------------------
function routesSysteme() {
  const g = [txt(360, 22, 'Routes système d’un sous-réseau, et une route personnalisée', { gras: true, taille: 15 })];
  g.push(tableau(40, 36, [150, 180, 150, 160], ['Source', 'Préfixe', 'Tronçon suivant', 'Rôle'], [
    ['Default', { t: 'plage du VNet', mono: true }, 'Réseau virtuel', oui('entre sous-réseaux')],
    ['Default', { t: '0.0.0.0/0', mono: true }, 'Internet', oui('sortie')],
    ['Default', { t: '10.0.0.0/8', mono: true }, 'Aucun', non('supprimé')],
    ['Default', { t: '172.16.0.0/12', mono: true }, 'Aucun', non('supprimé')],
    ['Default', { t: '192.168.0.0/16', mono: true }, 'Aucun', non('supprimé')],
    ['Default', { t: '100.64.0.0/10', mono: true }, 'Aucun', non('supprimé')],
    [{ t: 'User (UDR)', c: ACC, gras: true }, { t: '10.1.1.0/24', mono: true, c: ACC }, { t: 'Appliance 10.1.2.4', c: ACC }, { t: '✎ remplace', c: WARN, gras: true }],
  ], { h: 30, taille: 12 }));
  g.push(txt(360, 298, 'Le préfixe le plus précis gagne ; à préfixe égal, la route personnalisée passe avant la route système.', { taille: 11.5, couleur: S }));
  g.push(txt(360, 318, 'Un peering, une passerelle ou un point de service ajoutent leurs propres routes.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-routes', largeur: 720, hauteur: 332, titre: 'Routes système Azure et route personnalisée',
    desc: 'Un tableau liste les routes créées par Azure pour chaque sous-réseau : la plage du réseau virtuel vers le réseau virtuel, 0.0.0.0/0 vers Internet, et les blocs privés 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 et 100.64.0.0/10 vers Aucun, ce qui supprime le trafic. Une dernière ligne montre une route personnalisée qui envoie 10.1.1.0/24 vers une appliance et remplace la route système.',
    corps: g.join(''),
  });
}

// 8. Point de service ou point privé -------------------------------------------
function servicePrive() {
  const g = [txt(180, 22, 'Point de terminaison de service', { gras: true, taille: 15 }), txt(540, 22, 'Point de terminaison privé', { gras: true, taille: 15 }), ligne(360, 12, 360, 262, { couleur: BORD, largeur: 1, tirets: true })];
  g.push(boite(20, 40, 160, 110, { fond: 'none', bord: CYAN, tirets: true, r: 14 }), txt(100, 60, 'Sous-réseau app', { gras: true, taille: 12, couleur: CYAN }), carte(36, 74, 128, 56, 'machine', '10.1.0.4', { mono: true }));
  g.push(carte(230, 74, 120, 56, 'Stockage', 'IP publique', { bord: WARN }));
  g.push(fl(166, 102, 228, 102, { couleur: OK, largeur: 3 }));
    g.push(txt(180, 176, '✓ accès limité au sous-réseau', { couleur: OK, gras: true, taille: 12 }), txt(180, 196, '⚠ le service garde son adresse publique', { couleur: WARN, taille: 12 }), txt(180, 216, 'Trafic sur le réseau principal de Microsoft', { taille: 11.5, couleur: S }));
  g.push(boite(380, 40, 190, 110, { fond: 'none', bord: CYAN, tirets: true, r: 14 }), txt(475, 60, 'VNet · sous-réseau', { gras: true, taille: 12, couleur: CYAN }), carte(394, 74, 74, 56, 'machine', '', {}), carte(478, 74, 80, 56, 'point privé', '10.1.0.5', { bord: ACC, mono: true }));
  g.push(carte(600, 74, 100, 56, 'Stockage', 'Private Link', { bord: WARN }));
  g.push(fl(560, 102, 598, 102, { couleur: OK, largeur: 3 }));
  g.push(txt(540, 176, '✓ adresse privée dans ton VNet', { couleur: OK, gras: true, taille: 12 }), txt(540, 196, '✓ l’accès public peut être fermé', { couleur: OK, taille: 12 }), txt(540, 216, 'Le nom se résout via une zone DNS privée', { taille: 11.5, couleur: S }));
  g.push(txt(360, 250, 'Choix simple : point de service pour limiter ; point privé pour isoler complètement.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-service-prive', largeur: 720, hauteur: 264, titre: 'Point de terminaison de service et point de terminaison privé',
    desc: 'À gauche, un point de terminaison de service : le sous-réseau atteint le stockage par le réseau principal de Microsoft, l’accès est limité au sous-réseau, mais le stockage garde son adresse publique. À droite, un point de terminaison privé : le stockage reçoit une adresse privée dans le réseau virtuel via Private Link, et l’accès public peut être fermé.',
    corps: g.join(''),
  });
}

// 9. Composants de Load Balancer -----------------------------------------------
function lbComposants() {
  const g = [txt(360, 22, 'Azure Load Balancer : quatre composants', { gras: true, taille: 15 })];
  g.push(carte(14, 90, 100, 56, 'Clients', 'Internet'));
  g.push(carte(150, 90, 150, 56, '1. IP frontale', 'publique ou privée', { bord: ACC }));
  g.push(carte(336, 90, 150, 56, '2. Règle', 'port 80 → port 80', { bord: CYAN }));
  g.push(fl(114, 118, 150, 118), fl(300, 118, 336, 118));
  g.push(boite(524, 40, 182, 196, { fond: 'none', bord: BORD, tirets: true, r: 14 }), txt(615, 60, '3. Pool de serveurs', { gras: true, taille: 12.5 }));
  g.push(carte(540, 72, 150, 44, 'vm1', '✓ sain · reçoit', { couleur: T }), carte(540, 124, 150, 44, 'vm2', '✓ sain · reçoit', { couleur: T }), carte(540, 176, 150, 44, 'vm3', '✗ sonde échoue · retirée', { bord: KO }));
  g.push(fl(486, 118, 538, 94, { couleur: OK }), fl(486, 118, 538, 146, { couleur: OK }), fl(486, 128, 538, 198, { couleur: KO, tirets: true }));
  g.push(carte(336, 176, 150, 56, '4. Sonde', 'TCP 80 ou HTTP 200', { bord: WARN }));
  g.push(ligne(486, 204, 538, 204, { couleur: WARN, tirets: true }), ligne(411, 146, 411, 176, { couleur: WARN, tirets: true }));
  g.push(txt(170, 200, 'IP publique = équilibreur public', { taille: 11.5, couleur: S, ancre: 'middle' }), txt(170, 218, 'IP privée = équilibreur interne', { taille: 11.5, couleur: S }));
  g.push(txt(360, 258, 'Niveau 4 : décide d’après l’adresse IP et le port, sans lire le contenu des requêtes.', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-lb', largeur: 720, hauteur: 274, titre: 'Composants d’un Azure Load Balancer',
    desc: 'Les clients atteignent l’adresse IP frontale de l’équilibreur. Une règle relie le port frontal à un pool de serveurs. Une sonde d’intégrité vérifie chaque serveur : les serveurs sains vm1 et vm2 reçoivent le trafic, vm3 dont la sonde échoue est retirée de la rotation. Une IP publique donne un équilibreur public, une IP privée un équilibreur interne.',
    corps: g.join(''),
  });
}

// 10. Choisir un équilibreur ---------------------------------------------------
function lbChoix() {
  const g = [txt(360, 22, 'Quel service d’équilibrage choisir ?', { gras: true, taille: 15 })];
  g.push(tableau(20, 36, [150, 80, 100, 170, 200], ['Service', 'Couche', 'Portée', 'Trafic', 'Pour quoi faire'], [
    [{ t: 'Load Balancer', gras: true }, '4', 'régional', 'TCP, UDP', 'répartir des connexions'],
    [{ t: 'Application Gateway', gras: true }, '7', 'régional', 'HTTP, HTTPS (WAF)', 'routage par URL, pare-feu web'],
    [{ t: 'Traffic Manager', gras: true }, 'DNS', 'global', 'tout protocole', 'répartir par la résolution DNS'],
    [{ t: 'Front Door', gras: true }, '7', 'global', 'HTTP, HTTPS (WAF)', 'accélérer et basculer vite'],
  ], { h: 38, taille: 11.5 }));
  g.push(txt(360, 250, 'Régional : au sein d’une région · global : entre régions. Traffic Manager répond au niveau du DNS, il ne voit pas le trafic.', { taille: 11.5, couleur: S }));
  g.push(txt(360, 270, 'Couche 4 = adresse et port · couche 7 = contenu des requêtes HTTP (chemin, en-têtes).', { taille: 11.5, couleur: S }));
  return svg({
    id: 'sc-az-lb-choix', largeur: 720, hauteur: 286, titre: 'Comparer les services d’équilibrage de charge Azure',
    desc: 'Azure Load Balancer travaille en couche 4 au sein d’une région pour TCP et UDP. Application Gateway travaille en couche 7 au sein d’une région pour HTTP et HTTPS avec pare-feu web. Traffic Manager répartit par le DNS entre régions pour tout protocole. Front Door travaille en couche 7 entre régions pour HTTP et HTTPS avec pare-feu web.',
    corps: g.join(''),
  });
}

export const SCHEMAS_AZURE = {
  'az-hierarchie': { titre: 'Hiérarchie des ressources Azure', legende: 'Groupe d’administration, abonnement, groupe de ressources, ressource : les droits et verrous descendent la hiérarchie.', svg: hierarchie },
  'az-regions-zones': { titre: 'Régions, zones et paires régionales', legende: 'Une région compte plusieurs zones de disponibilité ; deux régions appairées protègent contre un sinistre régional.', svg: regionsZones },
  'az-modeles-service': { titre: 'Qui gère quoi : IaaS, PaaS, SaaS', legende: 'Plus le service est géré par le fournisseur, moins tu gères ; tes données et tes accès restent à toi.', svg: modeles },
  'az-vnet-sous-reseaux': { titre: 'Réseau virtuel, sous-réseaux et adresses réservées', legende: 'Chaque sous-réseau a une plage unique ; Azure y réserve cinq adresses.', svg: vnetSousReseaux },
  'az-dns-public-prive': { titre: 'Zone DNS publique et zone DNS privée', legende: 'La zone publique se délègue depuis le bureau d’enregistrement ; la zone privée est liée à un VNet et invisible d’Internet.', svg: dnsPublicPrive },
  'az-peering': { titre: 'Appairage de VNet : deux sens, pas de transit', legende: 'Les deux appairages doivent être Connected ; A ne joint pas C en passant par B.', svg: peering },
  'az-routes-systeme': { titre: 'Routes système et route personnalisée', legende: 'Azure crée les routes de base ; une route personnalisée plus précise (ou égale) les remplace.', svg: routesSysteme },
  'az-service-prive': { titre: 'Point de service ou point privé', legende: 'Le point de service limite l’accès mais garde l’adresse publique ; le point privé donne une adresse privée au service.', svg: servicePrive },
  'az-lb-composants': { titre: 'Composants d’Azure Load Balancer', legende: 'IP frontale, règle, pool de serveurs et sonde d’intégrité : un serveur dont la sonde échoue est retiré.', svg: lbComposants },
  'az-lb-choix': { titre: 'Choisir un service d’équilibrage de charge', legende: 'Couche 4 ou 7, régional ou global : Load Balancer, Application Gateway, Traffic Manager, Front Door.', svg: lbChoix },
};
