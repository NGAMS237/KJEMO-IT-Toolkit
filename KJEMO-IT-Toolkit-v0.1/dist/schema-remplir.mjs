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
 *      description du schéma.
 * Rien n'est effacé : les lignes et fiches existantes restent, seules les
 * valeurs vides ou différentes venant du schéma sont posées. Module PUR.
 */
import { normaliserEquipement, equipementVide, TYPES_EQUIPEMENT } from './inventaire.mjs';
import { typeNoeud, decrireSchema, normaliserSchema } from './schema.mjs';
import { modele } from './modeles.mjs';

/** Système de l'inventaire déduit du symbole. */
export const SYSTEME_DU_TYPE = {
  routeur: 'cisco', commutateur: 'cisco', 'commutateur-l3': 'cisco', 'pare-feu': 'cisco', 'point-acces': 'cisco', 'telephone-ip': 'cisco',
  serveur: 'systeme', poste: 'systeme', portable: 'systeme', imprimante: 'systeme', smartphone: 'systeme', 'camera-ip': 'systeme', nas: 'systeme',
  vm: 'azure', 'reseau-virtuel': 'azure', 'sous-reseau': 'azure', 'passerelle-vpn': 'azure', 'service-cloud': 'azure',
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
  const bilan = { equipementsCrees: [], equipementsLies: 0, interfaces: 0, lignesAjoutees: 0, lignesMisesAJour: 0, architecture: false };
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

  // 3. Plan d'adressage : une ligne par interface adressée (ou nœud adressé par sa note).
  const candidats = [];
  for (const b of bouts) if (b.adresse) candidats.push({ n: b.noeud, nom: b.equipement?.nom || b.noeud.nom, interface: b.interface, adresse: b.adresse });
  for (const n of s.noeuds) {
    if (lireAdresse(n.note) && !candidats.some((c) => c.n.id === n.id)) candidats.push({ n, nom: (n.equipementId && parId.get(n.equipementId)?.nom) || n.nom, interface: '', adresse: n.note });
  }
  // Passerelles possibles : adresses des routeurs, pare-feu… sur le schéma, et interfaces de leur fiche (sous-interfaces comprises).
  const passerellesConnues = [
    ...candidats.filter((c) => PASSERELLES.has(c.n.type)).map((c) => ({ n: c.n, a: lireAdresse(c.adresse) })),
    ...s.noeuds.filter((n) => PASSERELLES.has(n.type) && n.equipementId && parId.get(n.equipementId))
      .flatMap((n) => parId.get(n.equipementId).interfaces.map((i) => ({ n, a: lireAdresse(i.adresse) }))),
  ].filter((c) => c.a);
  for (const c of candidats) {
    const zone = zoneDe(c.n, s.zones);
    let passerelle = '';
    const a = lireAdresse(c.adresse);
    if (a && HOTES.has(c.n.type)) {
      const gw = passerellesConnues.find((g) => g.n.id !== c.n.id && memeReseau(a.ip, g.a.ip, a.prefixe ?? g.a.prefixe ?? 24));
      if (gw) passerelle = gw.a.texte;
    }
    const cle = (l) => `${l.equipement.toLowerCase()}|${l.interface.toLowerCase()}`;
    const ligne = { equipement: c.nom, interface: c.interface, adresse: c.adresse, vlan: zone?.nom ?? '', passerelle, note: '' };
    const existante = e.adressage.find((l) => cle(l) === cle(ligne)) ?? e.adressage.find((l) => l.equipement.toLowerCase() === ligne.equipement.toLowerCase() && l.adresse === ligne.adresse);
    if (!existante) { e.adressage.push(ligne); bilan.lignesAjoutees += 1; continue; }
    let change = false;
    for (const k of ['interface', 'adresse', 'vlan', 'passerelle']) {
      if (ligne[k] && !existante[k]) { existante[k] = ligne[k]; change = true; }
    }
    if (ligne.adresse && existante.adresse !== ligne.adresse) { existante.adresse = ligne.adresse; change = true; }
    if (change) bilan.lignesMisesAJour += 1;
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

/** Phrase de bilan pour la barre d'état. */
export function phraseBilan(b) {
  const p = [];
  if (b.equipementsCrees.length) p.push(`${b.equipementsCrees.length} équipement(s) ajouté(s) à l’inventaire (${b.equipementsCrees.join(', ')})`);
  if (b.equipementsLies) p.push(`${b.equipementsLies} relié(s) au labo`);
  if (b.interfaces) p.push(`${b.interfaces} interface(s) enregistrée(s) dans les fiches`);
  if (b.lignesAjoutees) p.push(`${b.lignesAjoutees} ligne(s) ajoutée(s) au plan d’adressage`);
  if (b.lignesMisesAJour) p.push(`${b.lignesMisesAJour} ligne(s) complétée(s)`);
  if (b.architecture) p.push('description de l’architecture rédigée');
  return p.length ? `Depuis le schéma : ${p.join(', ')}. Vérifie, puis enregistre.` : 'Le document et l’inventaire sont déjà à jour avec le schéma.';
}
