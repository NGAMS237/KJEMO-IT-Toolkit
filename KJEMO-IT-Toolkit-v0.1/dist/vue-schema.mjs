/**
 * vue-schema.mjs — JOURNAL-LABO-05 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * L'éditeur de schéma d'un labo : palette (types d'équipements, équipements de
 * l'inventaire, zones, textes, types personnels), feuille SVG et panneau des
 * propriétés de l'élément choisi. Module PUR : HTML échappé seulement ; le
 * glisser-déposer, la sélection et le clavier sont branchés dans app.js.
 */
import { TYPES_NOEUD, STYLES_LIEN, COULEURS_ZONE, LIMITES, typeNoeud, styleLien, cablesUtilises, dessinerSchema, versSvg, decrireSchema } from './schema.mjs';
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

  const echantillon = (st) => `<svg class="sch-ech" viewBox="0 0 34 10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" stroke="${st.trait}" stroke-width="${Math.min(st.ep, 4)}"${st.tirets ? ` stroke-dasharray="${st.tirets.join(' ')}"` : ''} stroke-linecap="round"/></svg>`;
  const cablage = etat.cablage;
  const cables = `<div class="sch-groupe"><span class="sch-groupe-titre">Câbles</span><div class="sch-palette" role="toolbar" aria-label="Câbles : choisis un câble, puis clique deux équipements">`
    + STYLES_LIEN.map((st) => `<button type="button" class="sch-outil sch-cable" data-scable="${esc(st.id)}" aria-pressed="${cablage?.style === st.id}" title="${esc(st.aide)}"${schema.noeuds.length < 2 ? ' disabled' : ''}>${echantillon(st)} ${esc(st.label)}</button>`).join('')
    + `</div></div>`;
  const bandeau = cablage
    ? `<div class="sch-bandeau" role="status"><span>${echantillon(styleLien(cablage.style))} <b>${esc(styleLien(cablage.style).label)}</b> : ${cablage.depuis ? `clique maintenant le <b>deuxième</b> équipement (depuis ${esc(nomNoeud(schema.noeuds.find((x) => x.id === cablage.depuis) ?? {}, resoudre, persos))}).` : 'clique le <b>premier</b> équipement à relier.'}</span>`
      + `<button type="button" class="secondary-button j-mini" id="schCablageFin">Terminer</button></div>`
    : '';
  const palette = `<div class="sch-groupe"><span class="sch-groupe-titre">Équipements</span><div class="sch-palette" role="toolbar" aria-label="Ajouter au schéma">`
    + TYPES_NOEUD.map((x) => `<button type="button" class="sch-outil" data-sadd="${esc(x.id)}"${plein ? ' disabled' : ''}>${esc(x.label)}</button>`).join('')
    + typesPerso.map((x) => `<button type="button" class="sch-outil sch-perso" data-sadd="perso:${esc(x.id)}"${plein ? ' disabled' : ''}><b>${esc(x.code)}</b> ${esc(x.nom)}</button>`).join('')
    + `<button type="button" class="sch-outil" data-sadd="zone"${schema.zones.length >= LIMITES.zones ? ' disabled' : ''}>▭ Zone</button>`
    + `<button type="button" class="sch-outil" data-sadd="texte"${schema.textes.length >= LIMITES.textes ? ' disabled' : ''}>T Texte</button>`
    + `<button type="button" class="sch-outil" id="schTypeOuvrir" aria-expanded="${Boolean(etat.typeOuvert)}">+ Mon propre type</button></div></div>`;
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
      + (eq ? (eq.interfaces?.length
        ? `<div class="sch-itf"><b>Interfaces de ${esc(eq.nom)}</b><table><thead><tr><th scope="col">Interface</th><th scope="col">Adresse</th><th scope="col">VLAN</th></tr></thead><tbody>${eq.interfaces.map((i) => `<tr><td>${esc(i.nom)}</td><td>${esc(i.adresse)}</td><td>${esc(i.vlan)}</td></tr>`).join('')}</tbody></table><small>Elles se modifient dans la fiche de l’équipement, ou en choisissant un câble : l’adresse saisie de chaque côté y est enregistrée.</small></div>`
        : `<p class="sch-info">${esc(eq.nom)} n’a pas encore d’interface : choisis un câble relié à lui et saisis l’interface et son adresse, elles seront ajoutées à sa fiche.</p>`)
        : `<p class="sch-info">Pour garder ses interfaces et ses adresses, ajoute cet équipement à l’inventaire.</p>`)
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schRelier" aria-pressed="${etat.relierDepuis === n.id}">${etat.relierDepuis === n.id ? 'Clique l’autre équipement…' : 'Relier à… (câble droit)'}</button>`
      + (eq ? '' : `<button type="button" class="secondary-button j-mini" id="schVersInventaire">Ajouter à l’inventaire</button>`)
      + `<button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Retirer du schéma</button></div>`;
  } else if (l) {
    const a = schema.noeuds.find((x) => x.id === l.de); const b = schema.noeuds.find((x) => x.id === l.a);
    const na = nomNoeud(a, resoudre, persos); const nb = nomNoeud(b, resoudre, persos);
    const eqA = a?.equipementId ? resoudre(a.equipementId) : null; const eqB = b?.equipementId ? resoudre(b.equipementId) : null;
    const liste = (id, eq) => (eq?.interfaces?.length ? `<datalist id="${id}">${eq.interfaces.map((i) => `<option value="${esc(i.nom)}">${esc(i.adresse || i.description || '')}</option>`).join('')}</datalist>` : '');
    const cote = (suffixe, nomCote, eq, itf, adr) => `<fieldset class="sch-cote"><legend>Côté ${esc(nomCote)}</legend>`
      + `<div class="sch-champ"><label for="schItf${suffixe}">Interface</label><input id="schItf${suffixe}" type="text" maxlength="30" autocomplete="off" spellcheck="false" value="${esc(itf)}" placeholder="${esc(eq?.interfaces?.[0]?.nom ? `ex. ${eq.interfaces[0].nom}` : 'ex. GigabitEthernet0/1, Fa0/1, ens18')}"${eq?.interfaces?.length ? ` list="schListe${suffixe}"` : ''}>${liste(`schListe${suffixe}`, eq)}</div>`
      + `<div class="sch-champ"><label for="schAdr${suffixe}">Adresse IP de l’interface</label><input id="schAdr${suffixe}" type="text" maxlength="50" autocomplete="off" spellcheck="false" value="${esc(adr)}" placeholder="ex. 192.168.10.1/24 (vide pour un port de commutateur)"></div>`
      + (eq ? `<small>Enregistrée aussi dans la fiche de ${esc(eq.nom)} (Interfaces).</small>` : '<small>Équipement hors inventaire : l’adresse reste sur le schéma.</small>')
      + `</fieldset>`;
    const st = styleLien(l.style);
    props = `<h3>Câble : ${esc(na)} – ${esc(nb)}</h3><div class="sch-cotes">`
      + cote('De', na, eqA, l.etiquetteDe, l.adresseDe) + cote('A', nb, eqB, l.etiquetteA, l.adresseA) + `</div><div class="sch-champs">`
      + choix('schStyle', 'Type de câble', STYLES_LIEN, l.style)
      + champ('schEtiquette', 'Étiquette du lien', l.etiquette, { max: 40, aide: 'Ex. : 802.1Q, VPN site à site, 1 Gb/s' }) + `</div>`
      + `<p class="sch-info">${esc(st.aide)}</p>`
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
    ...schema.liens.map((x) => ({ id: x.id, label: `${styleLien(x.style).court} · ${nomNoeud(schema.noeuds.find((y) => y.id === x.de), resoudre, persos)} – ${nomNoeud(schema.noeuds.find((y) => y.id === x.a), resoudre, persos)}` })),
    ...schema.zones.map((x) => ({ id: x.id, label: `Zone · ${x.nom || 'sans nom'}` })),
    ...schema.textes.map((x) => ({ id: x.id, label: `Texte · ${x.texte.slice(0, 30)}` })),
  ];
  const liste = `<div class="sch-champ"><label for="schElement">Élément choisi</label><select id="schElement"><option value="">Aucun</option>${elements.map((x) => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>`;
  const errs = Object.entries(erreurs).filter(([k]) => k.startsWith('schema.')).map(([, v]) => `<p class="param-err" role="alert">${esc(v)}</p>`).join('');
  const legende = cablesUtilises(schema);
  return palette + cables + nouveauType + depuisInventaire + bandeau
    + `<div class="sch-feuille" id="schFeuille" tabindex="0" aria-label="Feuille du schéma : flèches pour déplacer l’élément choisi, Suppr pour le retirer, Échap pour désélectionner"${etat.relierDepuis || cablage ? ' data-relier="1"' : ''}>${feuilleSvg(schema, { resoudre, typesPerso, selection: sel })}</div>`
    + (legende.length ? `<p class="sch-legende"><span>Légende :</span> ${legende.map((st) => `<span>${echantillon(st)} ${esc(st.label)}</span>`).join(' ')}</p>` : '')
    + `<p class="sch-aide">Pour câbler : choisis un câble dans « Câbles », puis clique les deux équipements ; saisis ensuite l’interface et l’adresse de chaque côté. Glisse pour déplacer (aimanté à la grille) · clique un câble pour le modifier · Suppr retire l’élément choisi · flèches pour ajuster.</p>`
    + errs
    + `<div class="sch-proprietes" aria-live="polite">${liste}${props}</div>`
    + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schSvg"${schema.noeuds.length || schema.zones.length ? '' : ' disabled'}>Exporter le schéma (SVG)</button>`
    + `<button type="button" class="secondary-button j-mini j-danger" id="schVider"${schema.noeuds.length || schema.zones.length || schema.textes.length ? '' : ' disabled'}>Vider le schéma</button></div>`;
}
