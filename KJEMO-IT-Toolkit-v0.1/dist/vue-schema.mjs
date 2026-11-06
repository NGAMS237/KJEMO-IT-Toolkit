/**
 * vue-schema.mjs — JOURNAL-LABO-05 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * L'éditeur de schéma d'un labo : palette (types d'équipements, équipements de
 * l'inventaire, zones, textes, types personnels), feuille SVG et panneau des
 * propriétés de l'élément choisi. Module PUR : HTML échappé seulement ; le
 * glisser-déposer, la sélection et le clavier sont branchés dans app.js.
 */
import { TYPES_NOEUD, STYLES_LIEN, COULEURS_ZONE, LIMITES, typeNoeud, dessinerSchema, versSvg, decrireSchema } from './schema.mjs';
import { systeme, typeEquipement } from './inventaire.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Le SVG de la feuille (seul, pour le redessiner pendant un glisser). */
export function feuilleSvg(schema, { resoudre, typesPerso, selection }) {
  const ops = dessinerSchema(schema, { resoudre, typesPerso, selection });
  return versSvg(ops, { titre: 'Schéma d’architecture du labo', description: decrireSchema(schema, { resoudre, typesPerso }), interactif: true, grille: true });
}

const nomNoeud = (n, resoudre, persos) => {
  const eq = n.equipementId ? resoudre(n.equipementId) : null;
  return eq?.nom || n.nom || (n.type === 'perso' ? persos.get(n.typePerso)?.nom : typeNoeud(n.type).label) || 'équipement';
};

/**
 * Le bloc complet. `etat` : { selection, relierDepuis, typeOuvert }.
 * `inventaire` : équipements disponibles ; `erreurs` : erreurs « schema.* » du journal.
 */
export function editeurSchemaMarkup(schema, { resoudre = () => null, typesPerso = [], inventaire = [], etat = {}, erreurs = {} } = {}) {
  const persos = new Map(typesPerso.map((t) => [t.id, t]));
  const sel = etat.selection;
  const n = schema.noeuds.find((x) => x.id === sel); const l = schema.liens.find((x) => x.id === sel);
  const z = schema.zones.find((x) => x.id === sel); const t = schema.textes.find((x) => x.id === sel);
  const plein = schema.noeuds.length >= LIMITES.noeuds;

  const palette = `<div class="sch-palette" role="toolbar" aria-label="Ajouter au schéma">`
    + TYPES_NOEUD.map((x) => `<button type="button" class="sch-outil" data-sadd="${esc(x.id)}"${plein ? ' disabled' : ''}>${esc(x.label)}</button>`).join('')
    + typesPerso.map((x) => `<button type="button" class="sch-outil sch-perso" data-sadd="perso:${esc(x.id)}"${plein ? ' disabled' : ''}><b>${esc(x.code)}</b> ${esc(x.nom)}</button>`).join('')
    + `<button type="button" class="sch-outil" data-sadd="zone"${schema.zones.length >= LIMITES.zones ? ' disabled' : ''}>▭ Zone</button>`
    + `<button type="button" class="sch-outil" data-sadd="texte"${schema.textes.length >= LIMITES.textes ? ' disabled' : ''}>T Texte</button>`
    + `<button type="button" class="sch-outil" id="schTypeOuvrir" aria-expanded="${Boolean(etat.typeOuvert)}">+ Mon propre type</button></div>`;
  const nouveauType = etat.typeOuvert
    ? `<div class="sch-nouveau-type" role="group" aria-label="Nouveau type d’équipement"><label for="schTypeNom">Nom du type</label><input id="schTypeNom" type="text" maxlength="40" placeholder="Ex. : Caméra IP, NAS, Téléphone IP">`
      + `<label for="schTypeCode">Code (1 à 4 lettres)</label><input id="schTypeCode" type="text" maxlength="4" placeholder="Ex. : CAM">`
      + `<button type="button" class="secondary-button j-mini" id="schTypeAjouter">Créer le type</button></div>` : '';
  const dispo = inventaire.filter((q) => !schema.noeuds.some((x) => x.equipementId === q.id));
  const depuisInventaire = `<div class="sch-inventaire"><label for="schEq">Équipement de l’inventaire</label><select id="schEq"${dispo.length ? '' : ' disabled'}>`
    + (dispo.length ? dispo.map((q) => `<option value="${esc(q.id)}">${esc(q.nom)} · ${esc(typeEquipement(q.type).label)} (${esc(systeme(q.systeme).label)})</option>`).join('') : '<option>Tous sont déjà sur le schéma</option>')
    + `</select><button type="button" class="secondary-button j-mini" id="schEqAjouter"${dispo.length && !plein ? '' : ' disabled'}>Placer</button>`
    + `<button type="button" class="secondary-button j-mini" id="schLabo">Placer les équipements du labo</button></div>`;

  const champ = (id, label, valeur, { max = 60, aide = '', desactive = false } = {}) => `<div class="sch-champ"><label for="${id}">${esc(label)}</label><input id="${id}" type="text" maxlength="${max}" autocomplete="off" spellcheck="false" value="${esc(valeur)}"${desactive ? ' disabled' : ''}>${aide ? `<small>${esc(aide)}</small>` : ''}</div>`;
  const nombre = (id, label, valeur, min, max) => `<div class="sch-champ sch-court"><label for="${id}">${esc(label)}</label><input id="${id}" type="number" min="${min}" max="${max}" step="10" value="${esc(valeur)}"></div>`;
  const choix = (id, label, options, valeur) => `<div class="sch-champ"><label for="${id}">${esc(label)}</label><select id="${id}">${options.map((o) => `<option value="${esc(o.id)}"${o.id === valeur ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
  let props = '';
  if (n) {
    const eq = n.equipementId ? resoudre(n.equipementId) : null;
    const types = [...TYPES_NOEUD.map((x) => ({ id: x.id, label: x.label })), ...typesPerso.map((x) => ({ id: `perso:${x.id}`, label: `${x.nom} (${x.code})` }))];
    props = `<h3>Équipement : ${esc(nomNoeud(n, resoudre, persos))}</h3>`
      + (eq ? `<p class="sch-info">Nom et adresse viennent de l’inventaire. <a href="#/inventaire/${esc(eq.id)}" data-jeqouvrir="${esc(eq.id)}">Ouvrir la fiche de ${esc(eq.nom)}</a></p>` : '')
      + `<div class="sch-champs">${champ('schNom', 'Nom affiché', eq ? eq.nom : n.nom, { desactive: Boolean(eq) })}`
      + champ('schNote', eq ? 'Note (si l’équipement n’a pas d’adresse)' : 'Adresse ou note', n.note, { max: 80 })
      + choix('schType', 'Symbole', types, n.type === 'perso' ? `perso:${n.typePerso}` : n.type) + `</div>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schRelier" aria-pressed="${etat.relierDepuis === n.id}">${etat.relierDepuis === n.id ? 'Clique l’autre équipement…' : 'Relier à…'}</button>`
      + `<button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Retirer du schéma</button></div>`;
  } else if (l) {
    const a = schema.noeuds.find((x) => x.id === l.de); const b = schema.noeuds.find((x) => x.id === l.a);
    const na = nomNoeud(a, resoudre, persos); const nb = nomNoeud(b, resoudre, persos);
    props = `<h3>Lien : ${esc(na)} – ${esc(nb)}</h3><div class="sch-champs">`
      + champ('schEtiquetteDe', `Interface côté ${na}`, l.etiquetteDe, { max: 30, aide: 'Ex. : Gi0/1' })
      + champ('schEtiquetteA', `Interface côté ${nb}`, l.etiquetteA, { max: 30, aide: 'Ex. : Gi0/0' })
      + champ('schEtiquette', 'Étiquette du lien', l.etiquette, { max: 40, aide: 'Ex. : trunk 802.1Q, VPN, 1 Gb/s' })
      + choix('schStyle', 'Style', STYLES_LIEN, l.style) + `</div>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schInverser">Inverser les côtés</button><button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Supprimer le lien</button></div>`;
  } else if (z) {
    props = `<h3>Zone : ${esc(z.nom || 'sans nom')}</h3><div class="sch-champs">`
      + champ('schZoneNom', 'Nom de la zone', z.nom, { aide: 'Ex. : VLAN 10 · VENTES · 192.168.10.0/24' })
      + choix('schZoneCouleur', 'Couleur', COULEURS_ZONE, z.couleur)
      + nombre('schZoneL', 'Largeur', z.l, 60, 1000) + nombre('schZoneH', 'Hauteur', z.h, 40, 600) + `</div>`
      + `<p class="sch-info">Glisse la zone pour la déplacer ; glisse son coin en bas à droite pour l’agrandir.</p>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Supprimer la zone</button></div>`;
  } else if (t) {
    props = `<h3>Texte</h3><div class="sch-champs">${champ('schTexte', 'Texte', t.texte, { max: 120 })}</div>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Supprimer le texte</button></div>`;
  } else {
    props = `<p class="sch-info">${schema.noeuds.length} équipement(s), ${schema.liens.length} lien(s), ${schema.zones.length} zone(s). Choisis un élément sur la feuille (ou dans la liste ci-dessous) pour le modifier.</p>`;
  }
  const elements = [
    ...schema.noeuds.map((x) => ({ id: x.id, label: `Équipement · ${nomNoeud(x, resoudre, persos)}` })),
    ...schema.liens.map((x) => ({ id: x.id, label: `Lien · ${nomNoeud(schema.noeuds.find((y) => y.id === x.de), resoudre, persos)} – ${nomNoeud(schema.noeuds.find((y) => y.id === x.a), resoudre, persos)}` })),
    ...schema.zones.map((x) => ({ id: x.id, label: `Zone · ${x.nom || 'sans nom'}` })),
    ...schema.textes.map((x) => ({ id: x.id, label: `Texte · ${x.texte.slice(0, 30)}` })),
  ];
  const liste = `<div class="sch-champ"><label for="schElement">Élément choisi</label><select id="schElement"><option value="">Aucun</option>${elements.map((x) => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>`;
  const errs = Object.entries(erreurs).filter(([k]) => k.startsWith('schema.')).map(([, v]) => `<p class="param-err" role="alert">${esc(v)}</p>`).join('');
  return palette + nouveauType + depuisInventaire
    + `<div class="sch-feuille" id="schFeuille" tabindex="0" aria-label="Feuille du schéma : flèches pour déplacer l’élément choisi, Suppr pour le retirer, Échap pour désélectionner"${etat.relierDepuis ? ' data-relier="1"' : ''}>${feuilleSvg(schema, { resoudre, typesPerso, selection: sel })}</div>`
    + `<p class="sch-aide">Glisse pour déplacer (aimanté à la grille) · choisis un équipement puis « Relier à… » et clique l’autre · Suppr retire l’élément choisi · flèches pour ajuster.</p>`
    + errs
    + `<div class="sch-proprietes" aria-live="polite">${liste}${props}</div>`
    + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schSvg"${schema.noeuds.length || schema.zones.length ? '' : ' disabled'}>Exporter le schéma (SVG)</button>`
    + `<button type="button" class="secondary-button j-mini j-danger" id="schVider"${schema.noeuds.length || schema.zones.length || schema.textes.length ? '' : ' disabled'}>Vider le schéma</button></div>`;
}
