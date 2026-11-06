/**
 * vue-azure.mjs — JOURNAL-LABO-10 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Panneaux Azure de l'éditeur de schéma : configuration d'une ressource ou
 * d'une zone (VNet, sous-réseau, groupe, région) à partir des FORMULAIRES de
 * config-azure.mjs, aperçu des commandes Azure CLI, réglages Azure du labo et
 * modèles de schéma tirés des TP. Module PUR ; app.js branche :
 *   data-cfg="champ" | "liste|i|colonne"   valeur (case : booléen)
 *   data-cfgmulti="champ" value="id"        case d'une liste multiple
 *   data-cfgadd="liste" / data-cfgdel="liste|i"
 *   data-cfgaction="…"                      aides (copier, télécharger, découper…)
 */
import { FORMULAIRES, FORMULAIRES_ZONE, normaliserConfigAzure, optionsDynamiques, commandesAzure, commandesZone, auNiveauAz,
  typeAzure, genreZone, REGIONS, utilisablesAzure, contexteAzure, SOUS_RESEAUX_SPECIAUX } from './config-azure.mjs';
import { NIVEAUX } from './config-ios.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ident = (chemin) => `cfg-${chemin.replace(/[^\w-]/g, '_')}`;
const NIV = (n) => (n === 'simple' ? '' : ` <span class="cfg-niv">${esc(NIVEAUX.find((x) => x.id === n)?.label ?? n)}</span>`);

/** Options d'un champ choix (les options « @source » sont remplacées par la liste dynamique). */
function options(schema, f, el) {
  return f.options.flatMap(([v, l]) => (String(v).startsWith('@') ? optionsDynamiques(schema, f.dyn ?? v.slice(1), el) : [[v, l]]));
}
function champ(schema, f, valeur, chemin, el) {
  const id = ident(chemin);
  const aide = f.aide ? `<small>${esc(f.aide)}</small>` : '';
  if (f.type === 'case') return `<label class="j-case cfg-case"><input type="checkbox" id="${id}" data-cfg="${esc(chemin)}"${valeur ? ' checked' : ''}> ${esc(f.label)}${NIV(f.niveau)}</label>${aide}`;
  if (f.type === 'choix') {
    const ops = options(schema, f, el);
    const present = ops.some(([v]) => v === valeur);
    return `<div class="sch-champ"><label for="${id}">${esc(f.label)}${NIV(f.niveau)}</label><select id="${id}" data-cfg="${esc(chemin)}">`
      + (present || !valeur ? '' : `<option value="${esc(valeur)}" selected>${esc(valeur)} (introuvable)</option>`)
      + (ops.length ? ops.map(([v, l]) => `<option value="${esc(v)}"${v === valeur ? ' selected' : ''}>${esc(l)}</option>`).join('') : '<option value="">— rien sur le schéma —</option>')
      + `</select>${aide}</div>`;
  }
  if (f.type === 'multi') {
    const ops = optionsDynamiques(schema, f.source, el);
    return `<fieldset class="cfg-multi"><legend>${esc(f.label)}${NIV(f.niveau)}</legend>${ops.length
      ? ops.map(([v, l]) => `<label class="j-case cfg-case"><input type="checkbox" data-cfgmulti="${esc(chemin)}" value="${esc(v)}"${(valeur ?? []).includes(v) ? ' checked' : ''}> ${esc(l)}</label>`).join('')
      : '<p class="sch-info">Rien à choisir sur le schéma pour l’instant.</p>'}${aide}</fieldset>`;
  }
  return `<div class="sch-champ"><label for="${id}">${esc(f.label)}${NIV(f.niveau)}</label><input id="${id}" type="text" maxlength="200" autocomplete="off" spellcheck="false" data-cfg="${esc(chemin)}" value="${esc(valeur)}"${f.place ? ` placeholder="${esc(f.place)}"` : ''}>${aide}</div>`;
}
function liste(schema, f, lignes, el) {
  const corps = lignes.map((l, i) => `<div class="cfg-ligne">${f.colonnes.map((col) => champ(schema, col, l[col.id], `${f.id}|${i}|${col.id}`, el)).join('')}`
    + `<button type="button" class="secondary-button j-mini j-danger" data-cfgdel="${esc(f.id)}|${i}" aria-label="Retirer la ligne ${i + 1} de ${esc(f.label)}">Retirer</button></div>`).join('');
  return `<fieldset class="cfg-section"><legend>${esc(f.label)}${NIV(f.niveau)}</legend>${corps || '<p class="sch-info">Aucune ligne.</p>'}`
    + `<div class="params-actions"><button type="button" class="secondary-button j-mini" data-cfgadd="${esc(f.id)}">+ Ajouter</button></div></fieldset>`;
}
/** Le formulaire (champs du niveau choisi). */
export function formulaireAzure(schema, champs, c, el) {
  const visibles = champs.filter((f) => auNiveauAz(c.niveau, f.niveau));
  const simples = visibles.filter((f) => f.type !== 'liste' && f.type !== 'multi');
  return (simples.length ? `<div class="sch-champs">${simples.filter((f) => f.type !== 'case').map((f) => champ(schema, f, c[f.id], f.id, el)).join('')}</div>`
      + `<div class="cfg-cases">${simples.filter((f) => f.type === 'case').map((f) => champ(schema, f, c[f.id], f.id, el)).join('')}</div>` : '')
    + visibles.filter((f) => f.type === 'multi').map((f) => champ(schema, f, c[f.id], f.id, el)).join('')
    + visibles.filter((f) => f.type === 'liste').map((f) => liste(schema, f, c[f.id], el)).join('');
}

/** Aperçu : commandes et avertissements d'un nœud ou d'une zone. */
export function apercuAzureMarkup(schema, el) {
  const r = 'genre' in el && el.genre ? commandesZone(schema, el) : commandesAzure(schema, el);
  const avert = r.avertissements.length ? `<ul class="cfg-avert" role="list">${r.avertissements.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="cfg-ok">Aucun avertissement.</p>';
  const code = r.blocs.map((b) => `<span class="cfg-titre-bloc"># --- ${esc(b.titre)} ---</span>\n${esc(b.lignes.join('\n'))}`).join('\n');
  return avert + (code ? `<pre class="cfg-code" id="cfgCode" tabindex="0" aria-label="Commandes Azure CLI">${code}</pre>` : '<p class="sch-info">Rien à générer pour l’instant.</p>');
}

const niveaux = (c) => `<div class="cfg-niveaux" role="radiogroup" aria-label="Niveau de configuration">${NIVEAUX.map((x) => `<label class="cfg-niveau"><input type="radio" name="cfgNiveau" data-cfg="niveau" value="${x.id}"${x.id === c.niveau ? ' checked' : ''}> ${esc(x.label)}</label>`).join('')}</div>`;
const actions = (note, extra = '') => `<div class="params-actions">${extra}<button type="button" class="secondary-button j-mini" data-cfgaction="copier">Copier les commandes</button>`
  + `<button type="button" class="secondary-button j-mini" data-cfgaction="telecharger">Télécharger (.sh)</button>`
  + `<button type="button" class="secondary-button j-mini j-danger" data-cfgaction="effacer">Effacer la configuration</button></div>${note ? `<p class="cfg-note" role="status">${esc(note)}</p>` : ''}`;
const pied = (schema, el) => `<h4 class="cfg-h">Commandes Azure CLI</h4><p class="cfg-aide">Dans l’ordre de déploiement (Cloud Shell ou az installé). Vérifiées dans leur forme, pas exécutées dans ton abonnement. Aucune clé ni chaîne de connexion n’est écrite : elles sont lues au moment de la commande.</p>`
  + `<div id="cfgApercu" aria-live="polite">${apercuAzureMarkup(schema, el)}</div>`;

/** Panneau d'une ressource Azure (nœud). */
export function panneauRessourceAzure(schema, n, { note = '', ouvert = true } = {}) {
  const ty = typeAzure(n.type);
  const c = normaliserConfigAzure(n.type, n.config);
  if (!c) return '';
  const entete = `<div class="cfg-entete"><button type="button" class="secondary-button j-mini" id="cfgBascule" aria-expanded="${ouvert}" aria-controls="cfgCorps">${ouvert ? '▾' : '▸'} Configuration Azure : ${esc(ty?.label ?? n.type)}</button></div>`;
  if (!ouvert) return `<div class="cfg">${entete}</div>`;
  const o = contexteAzure(schema).noeud(n);
  const lieu = `<p class="cfg-aide">Déployé dans : <b>${esc(o.groupe)}</b> · ${esc(REGIONS.find(([r]) => r === o.region)?.[1] ?? o.region)}${o.vnet ? ` · VNet <b>${esc(o.vnet.nom)}</b>` : ''}${o.sousReseau ? ` · sous-réseau <b>${esc(o.sousReseau.nom)}</b>${o.sousReseau.c.plage ? ` (${esc(o.sousReseau.c.plage)})` : ''}` : ''}. Pose la ressource dans une zone « Sous-réseau » pour l’y déployer.</p>`;
  return `<div class="cfg">${entete}<div id="cfgCorps">${niveaux(c)}${lieu}${actions(note)}`
    + `<fieldset class="cfg-section"><legend>${esc(ty?.label ?? '')}</legend>${formulaireAzure(schema, FORMULAIRES[n.type], c, n)}</fieldset>`
    + pied(schema, n) + `</div></div>`;
}

/** Panneau d'une zone Azure (VNet, sous-réseau, groupe, région). */
export function panneauZoneAzure(schema, z, { note = '' } = {}) {
  const g = genreZone(z.genre); const c = normaliserConfigAzure(z.genre, z.config, { zone: true });
  if (!g || !c) return '';
  let extra = ''; let info = '';
  if (z.genre === 'vnet') {
    const ctx = contexteAzure(schema); const sns = ctx.sousReseaux.filter((s) => s.vnet?.id === z.id);
    extra = `<button type="button" class="primary-button j-mini" data-cfgaction="decouper"${sns.length ? '' : ' disabled'}>Découper selon les besoins</button>`;
    info = sns.length ? `<table class="cfg-table"><caption>Sous-réseaux de ${esc(z.nom)}</caption><thead><tr><th scope="col">Sous-réseau</th><th scope="col">Plage</th><th scope="col">Besoin</th><th scope="col">Utilisables</th></tr></thead><tbody>`
      + sns.map((s) => `<tr><td>${esc(s.nom)}</td><td>${esc(s.c.plage || '—')}</td><td>${esc(s.c.besoin || '—')}</td><td>${s.c.plage ? utilisablesAzure(s.c.plage) : '—'}</td></tr>`).join('') + `</tbody></table>`
      + `<p class="cfg-aide">« Découper » attribue une plage à chaque sous-réseau selon son besoin (les plus grands d’abord, sans chevauchement), en comptant les 5 adresses réservées par Azure dans chacun. Sans besoin indiqué : un /24.</p>`
      : '<p class="sch-info">Ajoute des zones « Sous-réseau » à l’intérieur de ce VNet.</p>';
  }
  if (z.genre === 'sous-reseau') {
    const sp = SOUS_RESEAUX_SPECIAUX[z.nom];
    info = `<p class="cfg-aide">${c.plage ? `${utilisablesAzure(c.plage)} adresse(s) utilisable(s) : Azure réserve la première (réseau), les trois suivantes (passerelle .1, DNS .2 et .3) et la dernière.` : 'Indique la plage, ou un besoin puis « Découper » sur le VNet.'}`
      + `${sp ? ` Nom imposé par Azure pour ${esc(sp.pour)} : au moins /${sp.min}.` : ' Noms imposés : GatewaySubnet, AzureBastionSubnet, AzureFirewallSubnet.'}</p>`;
  }
  return `<div class="cfg"><div id="cfgCorps">${niveaux(c)}${actions(note, extra)}<fieldset class="cfg-section"><legend>${esc(g.label)}</legend>${formulaireAzure(schema, FORMULAIRES_ZONE[z.genre], c, z)}</fieldset>${info}`
    + (z.genre === 'vnet' || z.genre === 'sous-reseau' || z.genre === 'groupe' ? pied(schema, z) : '') + `</div></div>`;
}

/** Réglages Azure du labo (quand rien n'est choisi). */
export function reglagesAzureMarkup(schema, modeles = []) {
  const a = schema.azure ?? {};
  return `<fieldset class="cfg-section"><legend>Azure : réglages du labo</legend><div class="sch-champs">`
    + `<div class="sch-champ"><label for="azGroupe">Groupe de ressources par défaut</label><input id="azGroupe" type="text" maxlength="90" value="${esc(a.groupe ?? '')}" placeholder="rg-labo"></div>`
    + `<div class="sch-champ"><label for="azRegion">Région par défaut</label><select id="azRegion">${REGIONS.map(([r, l]) => `<option value="${r}"${r === (a.region || 'canadacentral') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>`
    + `<p class="cfg-aide">Une ressource hérite du groupe et de la région de sa zone (groupe, région, VNet), sinon de ces réglages.</p>`
    + `<div class="params-actions"><button type="button" class="secondary-button j-mini" data-cfgaction="scriptComplet"${schema.noeuds.length || schema.zones.length ? '' : ' disabled'}>Télécharger le script complet (.sh)</button></div>`
    + (modeles.length ? `<div class="sch-modeles"><label for="schModeleLabo">Partir d’un modèle</label><select id="schModeleLabo">${modeles.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('')}</select>`
      + `<button type="button" class="secondary-button j-mini" id="schModeleCharger">Charger le modèle</button><small>Le schéma actuel est remplacé (confirmation demandée s’il n’est pas vide).</small></div>` : '')
    + `</fieldset>`;
}
