/**
 * schema-remplir.mjs — JOURNAL-LABO-07 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Remplir le document et l'inventaire depuis le schéma » : ce que tu as
 * dessiné (équipements, noms, câbles, interfaces, adresses, zones) commence à
 * remplir le dossier du labo et l'inventaire, sur ta demande (jamais à ton insu) :
 *   1. chaque équipement du schéma hors inventaire y est ajouté (nom, type,
 *      système déduit du symbole) et relié au labo ; le nœud pointe ensuite
 *      sur sa fiche ;
 *   2. les interfaces et adresses saisies aux bouts des câbles sont ajoutées
 *      (ou mises à jour) dans la fiche de chaque équipement ;
 *   3. le plan d'adressage reçoit une ligne par interface adressée (ou mise à
 *      jour si elle existe), avec la zone où se trouve l'équipement et, pour
 *      un poste ou un serveur, la passerelle trouvée dans le même réseau ;
 *   4. la description de l'architecture, si elle est vide, reprend la
 *      description du schéma ;
 *   5. (JOURNAL-LABO-09) la configuration de chaque équipement (config-ios)
 *      ajoute ses interfaces, VLAN et routes à sa fiche, ses adresses au plan,
 *      un bloc « Configuration de X » et des tests dans la Validation ;
 *      l'environnement, s'il est vide, liste les équipements et leur modèle.
 * Rien n'est effacé : les lignes et fiches existantes restent, seules les
 * valeurs vides ou différentes venant du schéma sont posées. Module PUR.
 */
import { normaliserEquipement, equipementVide, TYPES_EQUIPEMENT } from './inventaire.mjs';
import { typeNoeud, decrireSchema, normaliserSchema } from './schema.mjs';
import { modele, clePort } from './modeles.mjs';
import { estAzure, typeAzure, TYPES_AZURE, REGIONS } from './azure-types.mjs';
import { contexteAzure, scriptAzure, adressageAzure, tablesAzure, modeleAzure, testsAzure, nomAzure, utilisablesAzure } from './config-azure.mjs';
import { normaliserConfig, famille, estIos, commandesNoeud, texteAvecTitres, interfacesDepuisConfig, adressesDepuisConfig, routesDepuisConfig, vlansDepuisConfig, testsProposes, cidr } from './config-ios.mjs';

/** Système de l'inventaire déduit du symbole. */
export const SYSTEME_DU_TYPE = {
  routeur: 'cisco', commutateur: 'cisco', 'commutateur-l3': 'cisco', 'pare-feu': 'cisco', 'point-acces': 'cisco', 'telephone-ip': 'cisco',
  serveur: 'systeme', poste: 'systeme', portable: 'systeme', imprimante: 'systeme', smartphone: 'systeme', 'camera-ip': 'systeme', nas: 'systeme',
  'reseau-virtuel': 'azure', 'sous-reseau': 'azure',
  ...Object.fromEntries(TYPES_AZURE.map((t) => [t.id, 'azure'])),
};
/** Symboles qui jouent le rôle d'hôte : on leur cherche une passerelle. */
const HOTES = new Set(['poste', 'portable', 'telephone-ip', 'imprimante', 'smartphone', 'camera-ip', 'serveur', 'nas', 'vm']);
/** Symboles qui peuvent servir de passerelle. */
const PASSERELLES = new Set(['routeur', 'pare-feu', 'commutateur', 'commutateur-l3', 'point-acces']);

/** « 192.168.10.1/24 » → { ip (entier), prefixe } ; null si ce n'est pas une adresse IPv4 (préfixe facultatif). */
export function lireAdresse(texte) {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\s*\/\s*(\d{1,2}))?\s*$/.exec(String(texte ?? ''));
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some((x) => x > 255)) return null;
  const p = m[5] === undefined ? null : Number(m[5]);
  if (p !== null && p > 32) return null;
  return { ip: o.reduce((a, x) => a * 256 + x, 0), prefixe: p, texte: o.join('.') };
}
const masque = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
const memeReseau = (a, b, p) => ((a & masque(p)) >>> 0) === ((b & masque(p)) >>> 0);

/** Zone (VLAN, site…) qui contient le centre d'un nœud : la plus petite si elles s'emboîtent. */
function zoneDe(n, zones) {
  const dedans = zones.filter((z) => n.x >= z.x && n.x <= z.x + z.l && n.y >= z.y && n.y <= z.y + z.h);
  return dedans.sort((a, b) => a.l * a.h - b.l * b.h)[0] ?? null;
}

/**
 * Calcule le remplissage. Ne modifie rien : renvoie de nouvelles valeurs.
 * `entree` : le labo (brouillon) ; `inventaire` : les équipements ;
 * `typesPerso` : types personnels du schéma.
 * Renvoie { entree, inventaire, bilan } où bilan compte ce qui a été fait.
 */
export function remplirDepuisSchema(entree, { inventaire = [], typesPerso = [], date = new Date() } = {}) {
  const e = structuredClone(entree);
  const inv = inventaire.map((q) => structuredClone(q));
  const persos = new Map(typesPerso.map((t) => [t.id, t]));
  const bilan = { equipementsCrees: [], equipementsLies: 0, interfaces: 0, lignesAjoutees: 0, lignesMisesAJour: 0, architecture: false,
    configurations: 0, routes: 0, vlans: 0, tests: 0, environnement: false, vnets: 0 };
  const s = e.schema;
  const parId = new Map(inv.map((q) => [q.id, q]));
  const nomsPris = new Set(inv.map((q) => q.nom.toLowerCase()));

  // 1. Équipements du schéma → inventaire et labo.
  for (const n of s.noeuds) {
    if (n.type === 'internet') continue;   // Internet n'est pas un équipement à inventorier
    let q = n.equipementId ? parId.get(n.equipementId) : null;
    if (!q) {
      const base = n.nom || (n.type === 'perso' ? persos.get(n.typePerso)?.nom : typeNoeud(n.type).label) || 'Équipement';
      let nom = base; let k = 2;
      // Un équipement du même nom existe déjà : on le réutilise plutôt que de créer un doublon.
      const memeNom = inv.find((x) => x.nom.toLowerCase() === base.toLowerCase());
      if (memeNom && n.nom) q = memeNom;
      else {
        while (nomsPris.has(nom.toLowerCase())) nom = `${base} ${k++}`;
        const typeEq = TYPES_EQUIPEMENT.some((t) => t.id === n.type) ? n.type : 'autre';
        const r = normaliserEquipement({ ...equipementVide({ systemeId: SYSTEME_DU_TYPE[n.type] ?? 'autre', typeId: typeEq, date }), nom, adresse: lireAdresse(n.note) ? n.note : '', modele: modele(n.modele)?.label ?? '' });
        if (Object.keys(r.erreurs).length) continue;
        q = r.equipement; inv.push(q); parId.set(q.id, q); nomsPris.add(nom.toLowerCase());
        bilan.equipementsCrees.push(nom);
        if (!n.nom) n.nom = nom;
      }
      n.equipementId = q.id;
    }
    if (!q.modele && modele(n.modele)) q.modele = modele(n.modele).label;
    if (!e.equipements.some((l) => l.id === q.id)) { e.equipements.push({ id: q.id, role: '' }); bilan.equipementsLies += 1; }
  }

  // 2. Interfaces et adresses aux bouts des câbles → fiches d'équipement.
  const noeuds = new Map(s.noeuds.map((n) => [n.id, n]));
  const bouts = [];   // { noeud, equipement, interface, adresse }
  for (const l of s.liens) {
    for (const [nid, itf, adr] of [[l.de, l.etiquetteDe, l.adresseDe], [l.a, l.etiquetteA, l.adresseA]]) {
      const n = noeuds.get(nid); const q = n?.equipementId ? parId.get(n.equipementId) : null;
      if (!n || (!itf && !adr)) continue;
      bouts.push({ noeud: n, equipement: q, interface: String(itf ?? '').trim(), adresse: String(adr ?? '').trim() });
      if (!q || !itf) continue;
      const existante = q.interfaces.find((i) => i.nom.toLowerCase() === itf.trim().toLowerCase());
      if (!existante) { q.interfaces.push({ nom: itf.trim(), adresse: adr.trim(), vlan: '', etat: '', description: '' }); bilan.interfaces += 1; }
      else if (adr && existante.adresse !== adr.trim()) { existante.adresse = adr.trim(); bilan.interfaces += 1; }
    }
  }
  // Adresse de gestion d'un équipement qui n'en a pas : sa première adresse.
  for (const q of inv) {
    if (!q.adresse && e.equipements.some((l) => l.id === q.id)) {
      const premiere = bouts.find((b) => b.equipement?.id === q.id && lireAdresse(b.adresse));
      if (premiere) q.adresse = lireAdresse(premiere.adresse).texte;
    }
  }

  // 2 bis. Configurations (config-ios.mjs) → interfaces, VLAN et table de routage des fiches.
  const configs = s.noeuds.filter((n) => n.config && famille(n.type)).map((n) => ({ n, c: normaliserConfig(n.config), q: n.equipementId ? parId.get(n.equipementId) : null }));
  const fusionner = (table, ligne, cle) => {
    const ex = table.find((x) => cle(x) === cle(ligne));
    if (!ex) { table.push(ligne); return true; }
    let ch = false;
    for (const [k, v] of Object.entries(ligne)) if (v && !ex[k]) { ex[k] = v; ch = true; }
    if (ligne.adresse && ex.adresse !== ligne.adresse) { ex.adresse = ligne.adresse; ch = true; }
    return ch;
  };
  for (const { n, c, q } of configs) {
    if (!q) continue;
    for (const i of interfacesDepuisConfig(n, c)) if (fusionner(q.interfaces, i, (x) => clePort(x.nom))) bilan.interfaces += 1;
    for (const r of routesDepuisConfig(n, c)) if (fusionner(q.routes, r, (x) => `${x.type}|${x.destination}`)) bilan.routes += 1;
    if (famille(n.type) !== 'routeur' && famille(n.type) !== 'hote') for (const v of vlansDepuisConfig(n, c, s.zones)) if (fusionner(q.vlans, v, (x) => String(x.numero))) bilan.vlans += 1;
    if (famille(n.type) === 'hote' && !q.adresse && cidr(c.hote.adresse)) q.adresse = cidr(c.hote.adresse).ip;
    if (famille(n.type) === 'commutateur' && !q.adresse && cidr(c.gestion.adresse)) q.adresse = cidr(c.gestion.adresse).ip;
  }

  // 3. Plan d'adressage : une ligne par interface adressée (ou nœud adressé par sa note).
  const candidats = [];
  for (const { n, c, q } of configs) {
    for (const a of adressesDepuisConfig(n, c)) candidats.push({ n, nom: q?.nom || n.nom, interface: a.interface, adresse: a.adresse, vlan: a.vlan, passerelle: a.passerelle });
  }
  const dejaCandidat = (n, itf, adr) => candidats.some((c) => c.n.id === n.id && (clePort(c.interface) === clePort(itf) || (adr && cidr(c.adresse)?.ip === (cidr(adr)?.ip ?? lireAdresse(adr)?.texte))));
  for (const b of bouts) if (b.adresse && !dejaCandidat(b.noeud, b.interface, b.adresse)) candidats.push({ n: b.noeud, nom: b.equipement?.nom || b.noeud.nom, interface: b.interface, adresse: b.adresse });
  for (const n of s.noeuds) {
    if (lireAdresse(n.note) && !candidats.some((c) => c.n.id === n.id)) candidats.push({ n, nom: (n.equipementId && parId.get(n.equipementId)?.nom) || n.nom, interface: '', adresse: n.note });
  }
  // Passerelles possibles : adresses des routeurs, pare-feu… sur le schéma, et interfaces de leur fiche (sous-interfaces comprises).
  const passerellesConnues = [
    ...candidats.filter((c) => PASSERELLES.has(c.n.type)).map((c) => ({ n: c.n, a: lireAdresse(c.adresse) })),
    ...s.noeuds.filter((n) => PASSERELLES.has(n.type) && n.equipementId && parId.get(n.equipementId))
      .flatMap((n) => parId.get(n.equipementId).interfaces.map((i) => ({ n, a: lireAdresse(i.adresse) }))),
  ].filter((c) => c.a)
    .sort((x, y) => (x.n.type === 'commutateur') - (y.n.type === 'commutateur'));   // un 2960 ne route pas : en dernier recours
  for (const c of candidats) {
    const zone = zoneDe(c.n, s.zones);
    let passerelle = c.passerelle ?? '';
    const a = lireAdresse(c.adresse);
    if (!passerelle && a && HOTES.has(c.n.type)) {
      const gw = passerellesConnues.find((g) => g.n.id !== c.n.id && memeReseau(a.ip, g.a.ip, a.prefixe ?? g.a.prefixe ?? 24));
      if (gw) passerelle = gw.a.texte;
    }
    const cle = (l) => `${l.equipement.toLowerCase()}|${l.interface.toLowerCase()}`;
    const ligne = { equipement: c.nom, interface: c.interface, adresse: c.adresse, vlan: c.vlan || (zone?.nom ?? ''), passerelle, note: '' };
    const existante = e.adressage.find((l) => cle(l) === cle(ligne)) ?? e.adressage.find((l) => l.equipement.toLowerCase() === ligne.equipement.toLowerCase() && l.adresse === ligne.adresse);
    if (!existante) { e.adressage.push(ligne); bilan.lignesAjoutees += 1; continue; }
    let change = false;
    for (const k of ['interface', 'adresse', 'vlan', 'passerelle']) {
      if (ligne[k] && !existante[k]) { existante[k] = ligne[k]; change = true; }
    }
    if (ligne.adresse && existante.adresse !== ligne.adresse) { existante.adresse = ligne.adresse; change = true; }
    if (change) bilan.lignesMisesAJour += 1;
  }

  // 3 bis. Configuration : un bloc « Configuration de X » par équipement configuré (remplacé s'il existe),
  // et les tests de vérification proposés dans la Validation (sans doublon).
  for (const { n, c, q } of configs) {
    const nom = q?.nom || n.nom || typeNoeud(n.type).label;
    const r = commandesNoeud(n, c, { nom });
    if (r.blocs.length) {
      const titre = `${estIos(n.type) ? 'Configuration' : 'Configuration IP'} de ${nom}`.slice(0, 120);
      const code = texteAvecTitres(n, r);
      const ex = e.configuration.find((b) => b.titre === titre);
      if (!ex) { e.configuration.push({ titre, code }); bilan.configurations += 1; }
      else if (ex.code !== code) { ex.code = code; bilan.configurations += 1; }
    }
    for (const t of testsProposes(n, c, nom)) {
      if (e.validation.some((v) => v.test === t.test)) continue;
      e.validation.push(t); bilan.tests += 1;
    }
  }
  // Azure : VNet dans l'inventaire, tables des ressources, plan d'adressage, commandes CLI et tests.
  const azure = s.zones.some((z) => z.genre) || s.noeuds.some((n) => estAzure(n.type));
  if (azure) remplirAzure(e, s, { inv, parId, nomsPris, bilan, date });

  // Environnement : la liste des équipements et de leur modèle, si le champ est vide.
  if (!azure && !String(e.environnement ?? '').trim() && s.noeuds.some((n) => n.type !== 'internet')) {
    const lignes = s.noeuds.filter((n) => n.type !== 'internet').map((n) => {
      const nom = (n.equipementId && parId.get(n.equipementId)?.nom) || n.nom || typeNoeud(n.type).label;
      return `${nom} : ${modele(n.modele)?.label ?? typeNoeud(n.type).label}`;
    });
    e.environnement = `Équipements du schéma : ${lignes.join(' ; ')}.`.slice(0, 2000);
    bilan.environnement = true;
  }

  // 4. Architecture : description du schéma si le champ est vide.
  if (!String(e.architecture ?? '').trim() && s.noeuds.length) {
    e.architecture = decrireSchema(s, { resoudre: (id) => parId.get(id) ?? null, typesPerso }).slice(0, 4000);
    bilan.architecture = true;
  }
  e.schema = normaliserSchema(s).schema;
  const inventaireFinal = inv.map((q) => normaliserEquipement(q).equipement);
  return { entree: e, inventaire: inventaireFinal, bilan };
}

/** La partie Azure du remplissage (voir l'en-tête). */
function remplirAzure(e, s, { inv, parId, nomsPris, bilan, date }) {
  const ctx = contexteAzure(s);
  const fusion = (table, ligne, cle) => {
    const ex = table.find((x) => cle(x) === cle(ligne));
    if (!ex) { table.push(ligne); return true; }
    let ch = false; for (const [k, v] of Object.entries(ligne)) if (v && ex[k] !== v) { ex[k] = v; ch = true; }
    return ch;
  };
  // 1. Chaque VNet devient une fiche « Réseau virtuel » : ses sous-réseaux sont ses interfaces.
  for (const v of ctx.vnets) {
    let q = inv.find((x) => x.type === 'reseau-virtuel' && x.nom.toLowerCase() === v.nom.toLowerCase());
    if (!q) {
      const r = normaliserEquipement({ ...equipementVide({ systemeId: 'azure', typeId: 'reseau-virtuel', date }), nom: v.nom });
      if (Object.keys(r.erreurs).length) continue;
      q = r.equipement; inv.push(q); parId.set(q.id, q); nomsPris.add(v.nom.toLowerCase()); bilan.equipementsCrees.push(v.nom);
    }
    q.adresse = v.c.espace || q.adresse; q.modele = q.modele || 'Réseau virtuel Azure';
    q.emplacement = q.emplacement || `${v.groupe} · ${REGIONS.find(([r]) => r === v.region)?.[1] ?? v.region}`;
    for (const sn of ctx.sousReseaux.filter((x) => x.vnet?.id === v.id)) {
      const desc = [sn.c.delegation && `délégué à ${sn.c.delegation}`, sn.c.pointsService.length && `points de service ${sn.c.pointsService.join(', ')}`,
        ...s.noeuds.filter((n) => (n.type === 'nsg' || n.type === 'table-routage' || n.type === 'passerelle-nat') && (n.config?.sousReseaux ?? []).includes(sn.id)).map((n) => `${typeAzure(n.type).code} ${nomAzure(n.nom)}`)].filter(Boolean).join(' ; ');
      if (fusion(q.interfaces, { nom: sn.nom, adresse: sn.c.plage, vlan: sn.c.plage ? `${utilisablesAzure(sn.c.plage)} utilisables` : '', etat: '', description: desc }, (x) => x.nom.toLowerCase())) bilan.interfaces += 1;
    }
    if (!e.equipements.some((l) => l.id === q.id)) { e.equipements.push({ id: q.id, role: '' }); bilan.equipementsLies += 1; }
    bilan.vnets += 1;
  }
  // 2. Ressources : modèle (taille, niveau), adresse privée, routes, règles, enregistrements DNS.
  for (const n of s.noeuds) {
    if (!estAzure(n.type) || !n.equipementId) continue;
    const q = parId.get(n.equipementId); if (!q) continue;
    if (n.config) q.modele = modeleAzure(n) || q.modele;
    const o = ctx.noeud(n);
    if (!q.emplacement) q.emplacement = `${o.groupe} · ${REGIONS.find(([r]) => r === o.region)?.[1] ?? o.region}${o.sousReseau ? ` · ${o.vnet?.nom ?? ''}/${o.sousReseau.nom}` : ''}`;
    const ip = n.config?.ipPrivee || n.config?.ip || n.config?.ipFrontend;
    if (ip && !q.adresse) q.adresse = ip;
    const t = tablesAzure(s, n);
    for (const r of t.routes ?? []) if (fusion(q.routes, r, (x) => `${x.type}|${x.destination}`)) bilan.routes += 1;
    for (const r of t.regles ?? []) fusion(q.regles, r, (x) => `${x.priorite}|${x.nom}`);
    for (const r of t.dns ?? []) fusion(q.dns, r, (x) => `${x.nom}|${x.type}`);
  }
  // 3. Plan d'adressage : sous-réseaux et adresses privées connues.
  for (const l of adressageAzure(s)) {
    const cle = (x) => `${x.equipement.toLowerCase()}|${x.interface.toLowerCase()}`;
    const ex = e.adressage.find((x) => cle(x) === cle(l));
    if (!ex) { e.adressage.push(l); bilan.lignesAjoutees += 1; }
    else if (Object.entries(l).some(([k, v]) => v && ex[k] !== v)) { Object.assign(ex, Object.fromEntries(Object.entries(l).filter(([, v]) => v))); bilan.lignesMisesAJour += 1; }
  }
  // 4. Configuration : les commandes Azure CLI, bloc par bloc, dans l'ordre de déploiement.
  for (const b of scriptAzure(s).blocs) {
    const titre = `Azure : ${b.titre}`.slice(0, 120); const code = b.lignes.join('\n');
    const ex = e.configuration.find((x) => x.titre === titre);
    if (!ex) { e.configuration.push({ titre, code }); bilan.configurations += 1; }
    else if (ex.code !== code) { ex.code = code; bilan.configurations += 1; }
  }
  // 5. Validation : tests proposés (sans doublon).
  for (const el of [...ctx.vnets.map((v) => v.zone), ...s.noeuds]) for (const t of testsAzure(s, el)) {
    if (e.validation.some((v) => v.test === t.test)) continue;
    e.validation.push(t); bilan.tests += 1;
  }
  // 6. Environnement, s'il est vide.
  if (!String(e.environnement ?? '').trim()) {
    const groupes = [...new Set([...ctx.vnets.map((v) => v.groupe), ...s.noeuds.filter((n) => estAzure(n.type)).map((n) => ctx.noeud(n).groupe)])];
    const regions = [...new Set([...ctx.vnets.map((v) => v.region), ...s.noeuds.filter((n) => estAzure(n.type)).map((n) => ctx.noeud(n).region)])].map((r) => REGIONS.find(([x]) => x === r)?.[1] ?? r);
    const res = s.noeuds.filter((n) => estAzure(n.type)).map((n) => `${nomAzure(n.nom, n.type)} (${typeAzure(n.type).label})`);
    e.environnement = `Microsoft Azure : groupe(s) de ressources ${groupes.join(', ') || '—'} ; région(s) ${regions.join(', ') || '—'}. `
      + `${ctx.vnets.length ? `Réseaux virtuels : ${ctx.vnets.map((v) => `${v.nom}${v.c.espace ? ` (${v.c.espace})` : ''}`).join(', ')}. ` : ''}${res.length ? `Ressources : ${res.join(' ; ')}.` : ''}`.slice(0, 2000);
    bilan.environnement = true;
  }
}

/** Phrase de bilan pour la barre d'état. */
export function phraseBilan(b) {
  const p = [];
  if (b.equipementsCrees.length) p.push(`${b.equipementsCrees.length} équipement(s) ajouté(s) à l’inventaire (${b.equipementsCrees.join(', ')})`);
  if (b.equipementsLies) p.push(`${b.equipementsLies} relié(s) au labo`);
  if (b.interfaces) p.push(`${b.interfaces} interface(s) enregistrée(s) dans les fiches`);
  if (b.lignesAjoutees) p.push(`${b.lignesAjoutees} ligne(s) ajoutée(s) au plan d’adressage`);
  if (b.lignesMisesAJour) p.push(`${b.lignesMisesAJour} ligne(s) complétée(s)`);
  if (b.architecture) p.push('description de l’architecture rédigée');
  if (b.routes) p.push(`${b.routes} route(s) dans les tables de routage`);
  if (b.vlans) p.push(`${b.vlans} VLAN dans les fiches`);
  if (b.configurations) p.push(`${b.configurations} bloc(s) de configuration`);
  if (b.tests) p.push(`${b.tests} test(s) de validation proposé(s)`);
  if (b.environnement) p.push('environnement rempli');
  if (b.vnets) p.push(`${b.vnets} VNet documenté(s) avec leurs sous-réseaux`);
  return p.length ? `Depuis le schéma : ${p.join(', ')}. Vérifie, puis enregistre.` : 'Le document et l’inventaire sont déjà à jour avec le schéma.';
}
