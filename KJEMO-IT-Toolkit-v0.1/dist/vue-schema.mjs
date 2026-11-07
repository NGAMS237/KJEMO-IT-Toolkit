/**
 * vue-schema.mjs — JOURNAL-LABO-05 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * L'éditeur de schéma d'un labo : palette (types d'équipements, équipements de
 * l'inventaire, zones, textes, types personnels), feuille SVG et panneau des
 * propriétés de l'élément choisi. Module PUR : HTML échappé seulement ; le
 * glisser-déposer, la sélection et le clavier sont branchés dans app.js.
 */
import { MODELE_PERSO, modele, modelesDuType, portsDuNoeud, portsOccupes, resumePorts, clePort } from './modeles.mjs';
import { GROUPES_NOEUD, SYSTEMES_PALETTE, TYPES_NOEUD, STYLES_LIEN, COULEURS_ZONE, LIMITES, typeNoeud, styleLien, cablesUtilises, dessinerSchema, versSvg, decrireSchema } from './schema.mjs';
import { systeme, typeEquipement } from './inventaire.mjs';
import { configMarkup } from './vue-config.mjs';
import { famille } from './config-ios.mjs';
import { estAzure, GENRES_ZONE, genreZone } from './azure-types.mjs';
import { panneauRessourceAzure, panneauZoneAzure, reglagesAzureMarkup } from './vue-azure.mjs';
import { modelesPour } from './modeles-schema.mjs';

/** Système de la palette d'après la catégorie du labo (cisco, systeme, azure ; sinon tous). */
export const systemeDuLabo = (categorie) => (['cisco', 'systeme', 'azure'].includes(categorie) ? categorie : 'tous');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Menu des ports d'un équipement, ouvert sur la feuille au câblage (comme le
 * menu de Packet Tracer) : ports libres choisissables, ports pris grisés avec
 * leur destination. Positionné en pourcentage de la feuille.
 */
export function menuPortsMarkup(schema, noeudId, { resoudre = () => null, typesPerso = [] } = {}) {
  const n = schema.noeuds.find((x) => x.id === noeudId);
  if (!n) return '';
  const persos = new Map(typesPerso.map((t) => [t.id, t]));
  const eq = n.equipementId ? resoudre(n.equipementId) : null;
  const ports = portsDuNoeud(n, { equipement: eq, liens: schema.liens });
  const occ = portsOccupes(n, schema.liens);
  const nom = nomNoeud(n, resoudre, persos);
  // À droite de l'équipement (à gauche s'il est au bord), au-dessus s'il est dans la moitié basse.
  const gauche = n.x > 680 ? Math.max(0, (n.x / 10) - 34) : Math.min(68, (n.x / 10) + 4);
  const haut = n.y > 300 ? Math.max(0, (n.y / 6) - 58) : Math.max(0, (n.y / 6) - 4);
  const options = ports.map((p) => {
    const o = occ.get(clePort(p));
    const adr = eq?.interfaces?.find((i) => clePort(i.nom) === clePort(p))?.adresse;
    if (o) return `<option value="${esc(p)}" disabled>${esc(p)} — pris → ${esc(nomNoeud(schema.noeuds.find((x) => x.id === o.vers) ?? {}, resoudre, persos))} ${esc(o.portEnFace ?? '')}</option>`;
    return `<option value="${esc(p)}">${esc(p)}${adr ? ` — ${esc(adr)}` : ''}</option>`;
  }).join('');
  const libres = ports.filter((p) => !occ.has(clePort(p))).length;
  return `<div class="sch-menu-ports" role="dialog" aria-label="Ports de ${esc(nom)}" style="left:${gauche}%;top:${haut}%">`
    + `<label for="schPortChoix"><b>${esc(nom)}</b> : choisis le port (${libres} libre(s))</label>`
    + (ports.length ? `<select id="schPortChoix" size="${Math.min(9, Math.max(3, ports.length))}">${options}</select>` : '<p>Aucun port connu : écris-le.</p>')
    + `<div class="sch-menu-autre"><label for="schPortLibre" class="sr-only">Autre port</label><input id="schPortLibre" type="text" maxlength="30" placeholder="Autre port (ex. Gi0/0.10)"><button type="button" class="secondary-button j-mini" id="schPortOk">Choisir</button></div>`
    + `<button type="button" class="secondary-button j-mini" id="schPortAnnuler">Annuler</button></div>`;
}

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
export function editeurSchemaMarkup(schema, { resoudre = () => null, typesPerso = [], inventaire = [], etat = {}, erreurs = {}, categorie = null } = {}) {
  const persos = new Map(typesPerso.map((t) => [t.id, t]));
  const sel = etat.selection;
  const n = schema.noeuds.find((x) => x.id === sel); const l = schema.liens.find((x) => x.id === sel);
  const z = schema.zones.find((x) => x.id === sel); const t = schema.textes.find((x) => x.id === sel);
  const plein = schema.noeuds.length >= LIMITES.noeuds;

  const duLabo = systemeDuLabo(categorie);
  const filtre = etat.filtreSysteme ?? duLabo;
  const echantillon = (st) => `<svg class="sch-ech" viewBox="0 0 34 10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" stroke="${st.trait}" stroke-width="${Math.min(st.ep, 4)}"${st.tirets ? ` stroke-dasharray="${st.tirets.join(' ')}"` : ''} stroke-linecap="round"/></svg>`;
  const cablage = etat.cablage;
  const peutCabler = schema.noeuds.length >= 2 || (schema.noeuds.length === 1 && schema.zones.some((z) => z.genre === 'sous-reseau'));
  const cables = `<div class="sch-groupe"><span class="sch-groupe-titre">Câbles</span><div class="sch-palette" role="toolbar" aria-label="Câbles : choisis un câble, puis clique deux équipements">`
    + `<button type="button" class="sch-outil sch-cable" data-scable="auto" aria-pressed="${cablage?.style === 'auto'}" title="Le bon câble est choisi selon les deux équipements et les ports (console, série, sans fil, droit ou croisé)"${peutCabler ? '' : ' disabled'}><span aria-hidden="true">⚡</span> Automatique</button>`
    + STYLES_LIEN.filter((st) => filtre === 'tous' || st.systemes.includes(filtre)).map((st) => `<button type="button" class="sch-outil sch-cable" data-scable="${esc(st.id)}" aria-pressed="${cablage?.style === st.id}" title="${esc(st.aide)}"${peutCabler ? '' : ' disabled'}>${echantillon(st)} ${esc(st.label)}</button>`).join('')
    + `</div></div>`;
  const nomCable = cablage ? (cablage.style === 'auto' ? 'Câble automatique' : styleLien(cablage.style).label) : '';
  const depuisNoeud = cablage?.depuis ? schema.noeuds.find((x) => x.id === cablage.depuis.noeud) : null;
  const bandeau = cablage
    ? `<div class="sch-bandeau" role="status"><span>${cablage.style === 'auto' ? '<span aria-hidden="true">⚡</span>' : echantillon(styleLien(cablage.style))} <b>${esc(nomCable)}</b> : ${depuisNoeud ? `depuis <b>${esc(nomNoeud(depuisNoeud, resoudre, persos))} ${esc(cablage.depuis.port)}</b>, clique maintenant le <b>deuxième</b> équipement puis choisis son port (ou un <b>sous-réseau</b> pour l’y lier).` : 'clique le <b>premier</b> équipement, puis choisis son port dans le menu (un sous-réseau se clique aussi : App Service, point privé, équilibreur interne).'}</span>`
      + `<button type="button" class="secondary-button j-mini" id="schCablageFin">Terminer</button></div>`
    : '';
  // Un labo Cisco, Système ou Azure ne montre que son système (et « Tous » pour un projet hybride).
  const onglets = `<div class="sch-onglets" role="group" aria-label="Filtrer la palette par système">${SYSTEMES_PALETTE.filter((x) => duLabo === 'tous' || x.id === duLabo || x.id === 'tous').map((x) => `<button type="button" class="j-onglet" data-sfiltre="${esc(x.id)}" aria-pressed="${filtre === x.id}">${esc(x.label)}</button>`).join('')}</div>`;
  const groupes = GROUPES_NOEUD.map((g) => {
    const types = TYPES_NOEUD.filter((x) => x.palette !== false && x.groupe === g.id && (filtre === 'tous' || x.systemes.includes(filtre)));
    if (!types.length) return '';
    return `<div class="sch-famille"><span class="sch-famille-titre">${esc(g.label)}</span>${types.map((x) => `<button type="button" class="sch-outil" data-sadd="${esc(x.id)}"${plein ? ' disabled' : ''}>${esc(x.label)}</button>`).join('')}</div>`;
  }).join('');
  const zonesAzure = filtre === 'azure' || filtre === 'tous'
    ? `<div class="sch-famille"><span class="sch-famille-titre">Azure · Zones</span>${GENRES_ZONE.slice().reverse().map((g) => `<button type="button" class="sch-outil" data-sadd="zone:${g.id}"${schema.zones.length >= LIMITES.zones ? ' disabled' : ''}>▭ ${esc(g.label)}</button>`).join('')}</div>` : '';
  const palette = `<div class="sch-groupe"><span class="sch-groupe-titre">${filtre === 'azure' ? 'Ressources Azure' : 'Équipements'}</span>${onglets}<div class="sch-palette sch-palette-familles" role="toolbar" aria-label="Ajouter au schéma">`
    + zonesAzure + groupes + `<div class="sch-famille"><span class="sch-famille-titre">Mes types et annotations</span>`
    + typesPerso.map((x) => `<button type="button" class="sch-outil sch-perso" data-sadd="perso:${esc(x.id)}"${plein ? ' disabled' : ''}><b>${esc(x.code)}</b> ${esc(x.nom)}</button>`).join('')
    + `<button type="button" class="sch-outil" data-sadd="zone"${schema.zones.length >= LIMITES.zones ? ' disabled' : ''}>▭ Zone</button>`
    + `<button type="button" class="sch-outil" data-sadd="texte"${schema.textes.length >= LIMITES.textes ? ' disabled' : ''}>T Texte</button>`
    + `<button type="button" class="sch-outil" id="schTypeOuvrir" aria-expanded="${Boolean(etat.typeOuvert)}">+ Mon propre type</button></div></div></div>`;
  const nouveauType = etat.typeOuvert
    ? `<div class="sch-nouveau-type" role="group" aria-label="Nouveau type d’équipement"><label for="schTypeNom">Nom du type</label><input id="schTypeNom" type="text" maxlength="40" placeholder="Ex. : Caméra IP, NAS, Téléphone IP">`
      + `<label for="schTypeCode">Code (1 à 4 lettres)</label><input id="schTypeCode" type="text" maxlength="4" placeholder="Ex. : CAM">`
      + `<button type="button" class="secondary-button j-mini" id="schTypeAjouter">Créer le type</button></div>` : '';
  const dispo = inventaire.filter((q) => !schema.noeuds.some((x) => x.equipementId === q.id) && (filtre === 'tous' || q.systeme === filtre || q.systeme === 'autre'));
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
      + choix('schType', 'Symbole', types, n.type === 'perso' ? `perso:${n.typePerso}` : n.type)
      + (!estAzure(n.type) && (n.type === 'perso' || n.type === 'autre' || modelesDuType(n.type).length)
        ? choix('schModele', 'Modèle (ses ports)', [...modelesDuType(n.type).map((m) => ({ id: m.id, label: m.label })), { id: MODELE_PERSO, label: 'Personnalisé : je liste les ports' }], n.modele ?? MODELE_PERSO) : '')
      + (n.modele === MODELE_PERSO ? champ('schPorts', 'Ports (plages permises)', n.ports, { max: 300, aide: 'Ex. : Gi0/1-24, Gi1/1/1-4, Console' }) : '')
      + `</div>`
      + (() => {
        const ports = portsDuNoeud(n, { equipement: eq, liens: schema.liens }); const occ = portsOccupes(n, schema.liens);
        return ports.length ? `<p class="sch-info">Ports : ${esc(resumePorts(n) || ports.slice(0, 6).join(', '))} · <b>${occ.size}</b> utilisé(s) sur ${ports.length}.</p>` : '';
      })()
      + (eq ? (eq.interfaces?.length
        ? `<div class="sch-itf"><b>Interfaces de ${esc(eq.nom)}</b><table><thead><tr><th scope="col">Interface</th><th scope="col">Adresse</th><th scope="col">VLAN</th></tr></thead><tbody>${eq.interfaces.map((i) => `<tr><td>${esc(i.nom)}</td><td>${esc(i.adresse)}</td><td>${esc(i.vlan)}</td></tr>`).join('')}</tbody></table><small>Elles se modifient dans la fiche de l’équipement, ou en choisissant un câble : l’adresse saisie de chaque côté y est enregistrée.</small></div>`
        : `<p class="sch-info">${esc(eq.nom)} n’a pas encore d’interface : choisis un câble relié à lui et saisis l’interface et son adresse, elles seront ajoutées à sa fiche.</p>`)
        : `<p class="sch-info">Pour garder ses interfaces et ses adresses, ajoute cet équipement à l’inventaire.</p>`)
      + (estAzure(n.type) ? `<div class="sch-config">${panneauRessourceAzure(schema, n, { note: etat.cfgNote ?? '', ouvert: etat.cfgOuvert !== false })}</div>` : '')
      + (famille(n.type) ? `<div class="sch-config">${configMarkup(schema, n, n.config, { nom: nomNoeud(n, resoudre, persos), equipement: eq, tousPorts: Boolean(etat.cfgTousPorts), ouvert: etat.cfgOuvert !== false, note: etat.cfgNote ?? '' })}</div>` : '')
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schRelier" aria-pressed="${etat.relierDepuis === n.id}">${etat.relierDepuis === n.id ? 'Clique l’autre équipement…' : 'Relier à… (câble droit)'}</button>`
      + (eq ? '' : `<button type="button" class="secondary-button j-mini" id="schVersInventaire">Ajouter à l’inventaire</button>`)
      + `<button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Retirer du schéma</button></div>`;
  } else if (l) {
    const a = schema.noeuds.find((x) => x.id === l.de); const b = schema.noeuds.find((x) => x.id === l.a);
    const na = nomNoeud(a, resoudre, persos); const nb = nomNoeud(b, resoudre, persos);
    const eqA = a?.equipementId ? resoudre(a.equipementId) : null; const eqB = b?.equipementId ? resoudre(b.equipementId) : null;
    const portsDe = (noeud, eq) => (noeud ? portsDuNoeud(noeud, { equipement: eq, liens: schema.liens }) : []);
    const liste = (id, noeud, eq) => { const ps = portsDe(noeud, eq); return ps.length ? `<datalist id="${id}">${ps.map((p) => `<option value="${esc(p)}">${esc(eq?.interfaces?.find((i) => clePort(i.nom) === clePort(p))?.adresse ?? '')}</option>`).join('')}</datalist>` : ''; };
    const cote = (suffixe, nomCote, noeud, eq, itf, adr) => `<fieldset class="sch-cote"><legend>Côté ${esc(nomCote)}</legend>`
      + `<div class="sch-champ"><label for="schItf${suffixe}">Interface (port)</label><input id="schItf${suffixe}" type="text" maxlength="30" autocomplete="off" spellcheck="false" value="${esc(itf)}" placeholder="${esc(portsDe(noeud, eq)[0] ? `ex. ${portsDe(noeud, eq)[0]}` : 'ex. GigabitEthernet0/1, Fa0/1, ens18')}"${portsDe(noeud, eq).length ? ` list="schListe${suffixe}"` : ''}>${liste(`schListe${suffixe}`, noeud, eq)}</div>`
      + `<div class="sch-champ"><label for="schAdr${suffixe}">Adresse IP de l’interface</label><input id="schAdr${suffixe}" type="text" maxlength="50" autocomplete="off" spellcheck="false" value="${esc(adr)}" placeholder="ex. 192.168.10.1/24 (vide pour un port de commutateur)"></div>`
      + (eq ? `<small>Enregistrée aussi dans la fiche de ${esc(eq.nom)} (Interfaces).</small>` : '<small>Équipement hors inventaire : l’adresse reste sur le schéma.</small>')
      + `</fieldset>`;
    const st = styleLien(l.style);
    props = `<h3>Câble : ${esc(na)} – ${esc(nb)}</h3><div class="sch-cotes">`
      + cote('De', na, a, eqA, l.etiquetteDe, l.adresseDe) + cote('A', nb, b, eqB, l.etiquetteA, l.adresseA) + `</div><div class="sch-champs">`
      + choix('schStyle', 'Type de câble', STYLES_LIEN, l.style)
      + champ('schEtiquette', 'Étiquette du lien', l.etiquette, { max: 40, aide: 'Ex. : 802.1Q, VPN site à site, 1 Gb/s' }) + `</div>`
      + `<p class="sch-info">${esc(st.aide)}</p>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schInverser">Inverser les côtés</button><button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Supprimer le lien</button></div>`;
  } else if (z) {
    const gz = z.genre ? genreZone(z.genre) : null;
    const aideNom = { vnet: 'Ex. : VNET1, vnet-solaria-canada', 'sous-reseau': 'Ex. : StorageSubnet, GatewaySubnet (nom imposé)', groupe: 'Ex. : rg-tardi', region: 'Ex. : Canada Centre' }[z.genre] ?? 'Ex. : VLAN 10 · VENTES · 192.168.10.0/24';
    props = `<h3>${esc(gz ? gz.label : 'Zone')} : ${esc(z.nom || 'sans nom')}</h3><div class="sch-champs">`
      + champ('schZoneNom', gz ? 'Nom' : 'Nom de la zone', z.nom, { aide: aideNom })
      + choix('schZoneGenre', 'Genre de zone', [{ id: '', label: 'Zone libre (VLAN, site…)' }, ...GENRES_ZONE.map((g) => ({ id: g.id, label: g.label }))], z.genre ?? '')
      + (gz ? '' : choix('schZoneCouleur', 'Couleur', COULEURS_ZONE, z.couleur))
      + nombre('schZoneL', 'Largeur', z.l, 60, 1000) + nombre('schZoneH', 'Hauteur', z.h, 40, 600) + `</div>`
      + `<p class="sch-info">Glisse la zone pour la déplacer ; glisse son coin en bas à droite pour l’agrandir.</p>`
      + (gz ? `<div class="sch-config">${panneauZoneAzure(schema, z, { note: etat.cfgNote ?? '' })}</div>` : '')
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Supprimer la zone</button></div>`;
  } else if (t) {
    props = `<h3>Texte</h3><div class="sch-champs">${champ('schTexte', 'Texte', t.texte, { max: 120 })}</div>`
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini j-danger" id="schSupprimer">Supprimer le texte</button></div>`;
  } else {
    props = `<p class="sch-info">${schema.noeuds.length} équipement(s), ${schema.liens.length} lien(s), ${schema.zones.length} zone(s). Choisis un élément sur la feuille (ou dans la liste ci-dessous) pour le modifier.</p>`
      + (filtre === 'azure' || schema.noeuds.some((x) => estAzure(x.type)) || schema.zones.some((x) => x.genre) ? reglagesAzureMarkup(schema, modelesPour('azure')) : '');
  }
  const elements = [
    ...schema.noeuds.map((x) => ({ id: x.id, label: `Équipement · ${nomNoeud(x, resoudre, persos)}` })),
    ...schema.liens.map((x) => ({ id: x.id, label: `${styleLien(x.style).court} · ${nomNoeud(schema.noeuds.find((y) => y.id === x.de), resoudre, persos)} – ${nomNoeud(schema.noeuds.find((y) => y.id === x.a), resoudre, persos)}` })),
    ...schema.zones.map((x) => ({ id: x.id, label: `${x.genre ? genreZone(x.genre).label : 'Zone'} · ${x.nom || 'sans nom'}` })),
    ...schema.textes.map((x) => ({ id: x.id, label: `Texte · ${x.texte.slice(0, 30)}` })),
  ];
  const liste = `<div class="sch-champ"><label for="schElement">Élément choisi</label><select id="schElement"><option value="">Aucun</option>${elements.map((x) => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>`;
  const errs = Object.entries(erreurs).filter(([k]) => k.startsWith('schema.')).map(([, v]) => `<p class="param-err" role="alert">${esc(v)}</p>`).join('');
  const legende = cablesUtilises(schema);
  return palette + cables + nouveauType + depuisInventaire + bandeau
    + `<div class="sch-feuille" id="schFeuille" tabindex="0" aria-label="Feuille du schéma : flèches pour déplacer l’élément choisi, Suppr pour le retirer, Échap pour désélectionner"${etat.relierDepuis || cablage ? ' data-relier="1"' : ''}>${feuilleSvg(schema, { resoudre, typesPerso, selection: sel })}${cablage?.enAttente ? menuPortsMarkup(schema, cablage.enAttente, { resoudre, typesPerso }) : ''}</div>`
    + (legende.length ? `<p class="sch-legende"><span>Légende :</span> ${legende.map((st) => `<span>${echantillon(st)} ${esc(st.label)}</span>`).join(' ')}</p>` : '')
    + `<p class="sch-aide">Pour câbler : choisis un câble dans « Câbles », puis clique les deux équipements ; saisis ensuite l’interface et l’adresse de chaque côté. Glisse pour déplacer (aimanté à la grille) · clique un câble pour le modifier · Suppr retire l’élément choisi · flèches pour ajuster.</p>`
    + errs
    + `<div class="sch-proprietes" aria-live="polite">${liste}${props}</div>`
    + `<div class="sch-remplir"><button type="button" class="primary-button j-btn" id="schRemplir"${schema.noeuds.length ? '' : ' disabled'}>Remplir le document et l’inventaire depuis le schéma</button>`
    + `<small>Ajoute à l’inventaire les équipements dessinés, y enregistre interfaces et adresses, complète le plan d’adressage (zone et passerelle comprises) et la description. Rien n’est effacé.</small></div>`
    + `<div class="params-actions"><button type="button" class="secondary-button j-mini" id="schSvg"${schema.noeuds.length || schema.zones.length ? '' : ' disabled'}>Exporter le schéma (SVG)</button>`
    + `<button type="button" class="secondary-button j-mini j-danger" id="schVider"${schema.noeuds.length || schema.zones.length || schema.textes.length ? '' : ' disabled'}>Vider le schéma</button></div>`;
}
