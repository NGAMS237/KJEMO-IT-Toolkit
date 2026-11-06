/**
 * vue-config.mjs — JOURNAL-LABO-09 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Panneau « Configuration » d'un équipement du schéma : niveau (simple,
 * intermédiaire, complet), sections utiles à ce type d'équipement seulement,
 * aperçu des commandes générées et avertissements. Module PUR (HTML échappé) ;
 * la saisie est branchée dans app.js par les attributs :
 *   data-cfg="chemin|vers|valeur"   champ (case à cocher : valeur booléenne)
 *   data-cfgadd="liste"             ajoute une ligne à une liste
 *   data-cfgdel="liste|index"       retire une ligne
 *   data-cfgaction="…"              aide (proposer, DHCP par VLAN, OSPF…)
 */
import { NIVEAUX, auNiveau, famille, estIos, commandesNoeud, normaliserConfig, cidr } from './config-ios.mjs';
import { portsDuNoeud, portsOccupes, clePort } from './modeles.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const AIDE_NIVEAU = {
  commutateur: { simple: 'VLAN, ports d’accès et trunks, adresse de gestion.', intermediaire: 'En plus : VLAN natif et autorisés, VLAN voix, port-security, SSH, VTP.', complet: 'En plus : Spanning Tree (Rapid-PVST, PortFast, BPDU Guard) et EtherChannel.' },
  'commutateur-l3': { simple: 'VLAN, ports d’accès, trunks et ports routés, gestion.', intermediaire: 'En plus : VLAN natif et autorisés, SSH, DHCP, routes statiques, VTP.', complet: 'En plus : routage entre VLAN par SVI, Spanning Tree (racine), EtherChannel, OSPF, HSRP, NAT.' },
  routeur: { simple: 'Adresses des ports et sous-interfaces (routeur sur un bâton).', intermediaire: 'En plus : SSH, DHCP, relais DHCP, routes statiques.', complet: 'En plus : OSPF, HSRP, NAT (PAT vers Internet).' },
  hote: { simple: 'Adresse, passerelle et DNS.', intermediaire: 'Adresse, passerelle et DNS.', complet: 'Adresse, passerelle et DNS.' },
};
const ident = (chemin) => `cfg-${chemin.replace(/[^\w-]/g, '_')}`;

const txt = (chemin, label, valeur, { max = 60, aide = '', place = '', court = false } = {}) => `<div class="sch-champ${court ? ' sch-court' : ''}"><label for="${ident(chemin)}">${esc(label)}</label>`
  + `<input id="${ident(chemin)}" type="text" maxlength="${max}" autocomplete="off" spellcheck="false" data-cfg="${esc(chemin)}" value="${esc(valeur)}"${place ? ` placeholder="${esc(place)}"` : ''}>${aide ? `<small>${esc(aide)}</small>` : ''}</div>`;
const caseC = (chemin, label, valeur) => `<label class="j-case cfg-case"><input type="checkbox" id="${ident(chemin)}" data-cfg="${esc(chemin)}"${valeur ? ' checked' : ''}> ${esc(label)}</label>`;
const sel = (chemin, label, options, valeur) => `<div class="sch-champ sch-court"><label for="${ident(chemin)}">${esc(label)}</label><select id="${ident(chemin)}" data-cfg="${esc(chemin)}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === valeur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
const section = (titre, corps, { niveau = 'simple', aide = '' } = {}) => `<fieldset class="cfg-section"><legend>${esc(titre)}${niveau !== 'simple' ? ` <span class="cfg-niv">${esc(NIVEAUX.find((x) => x.id === niveau).label)}</span>` : ''}</legend>${aide ? `<p class="cfg-aide">${esc(aide)}</p>` : ''}${corps}</fieldset>`;
const del = (liste, i, quoi) => `<button type="button" class="secondary-button j-mini j-danger" data-cfgdel="${esc(liste)}|${i}" aria-label="Retirer ${esc(quoi)}">Retirer</button>`;
const add = (liste, label) => `<button type="button" class="secondary-button j-mini" data-cfgadd="${esc(liste)}">${esc(label)}</button>`;
const ligne = (contenu) => `<div class="cfg-ligne">${contenu}</div>`;

/** Les ports à montrer : ceux câblés et ceux déjà configurés (tous si demandé), avec la clé de config à utiliser. */
export function portsAffiches(schema, n, c, { equipement = null, tous = false } = {}) {
  const tousPorts = portsDuNoeud(n, { equipement, liens: schema.liens });
  const occ = portsOccupes(n, schema.liens);
  const cles = Object.keys(c.ports);
  const garde = tousPorts.filter((p) => tous || occ.has(clePort(p)) || cles.some((k) => clePort(k) === clePort(p)));
  for (const k of cles) if (!garde.some((p) => clePort(p) === clePort(k)) && !/^vlan\d+$/i.test(k)) garde.push(k);
  return garde.map((p) => {
    const cle = cles.find((k) => clePort(k) === clePort(p)) ?? p;
    const o = occ.get(clePort(p));
    return { nom: p, cle, vers: o ? (schema.noeuds.find((x) => x.id === o.vers) ?? null) : null, portEnFace: o?.portEnFace ?? '', libres: tousPorts.length };
  });
}

/** Aperçu : commandes générées par bloc, et avertissements. */
export function apercuConfigMarkup(n, brut, { nom = '' } = {}) {
  const c = normaliserConfig(brut);
  const r = commandesNoeud(n, c, { nom });
  const avert = r.avertissements.length
    ? `<ul class="cfg-avert" role="list">${r.avertissements.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="cfg-ok">Aucun avertissement.</p>';
  const code = r.blocs.map((b) => `<span class="cfg-titre-bloc">${esc(estIos(n.type) ? '!' : '#')} --- ${esc(b.titre)} ---</span>\n${esc(b.lignes.join('\n'))}`).join('\n');
  return avert + (r.blocs.length ? `<pre class="cfg-code" id="cfgCode" tabindex="0" aria-label="Commandes générées pour ${esc(nom)}">${code}</pre>` : '<p class="sch-info">Rien à générer pour l’instant.</p>');
}

/**
 * Le panneau complet. `n` : nœud ; `c` : sa configuration (brute ou normalisée) ;
 * `nom` : nom d'hôte ; `tousPorts` : montrer tous les ports du modèle.
 */
export function configMarkup(schema, n, brut, { nom = '', equipement = null, tousPorts = false, ouvert = true, note = '' } = {}) {
  const fam = famille(n.type);
  if (!fam) return `<p class="sch-info">Ce type d’équipement se documente (nom, adresse, interfaces), sans génération de commandes.</p>`;
  const entete = `<div class="cfg-entete"><button type="button" class="secondary-button j-mini" id="cfgBascule" aria-expanded="${ouvert}" aria-controls="cfgCorps">${ouvert ? '▾' : '▸'} Configuration de ${esc(nom || 'cet équipement')}</button></div>`;
  if (!ouvert) return `<div class="cfg">${entete}<p class="sch-info">Génère les commandes (VLAN, trunks, routage, STP, EtherChannel…) et remplit le document.</p></div>`;
  const c = normaliserConfig(brut);
  const niv = c.niveau;
  const N = (requis) => auNiveau(niv, requis);
  const niveaux = `<div class="cfg-niveaux" role="radiogroup" aria-label="Niveau de configuration">${NIVEAUX.map((x) => `<label class="cfg-niveau"><input type="radio" name="cfgNiveau" data-cfg="niveau" value="${x.id}"${x.id === niv ? ' checked' : ''}> ${esc(x.label)}</label>`).join('')}</div>`
    + `<p class="cfg-aide">${esc(AIDE_NIVEAU[fam][niv])}</p>`;
  const actions = `<div class="params-actions"><button type="button" class="primary-button j-mini" data-cfgaction="proposer">Proposer depuis le schéma</button>`
    + `<button type="button" class="secondary-button j-mini" data-cfgaction="copier">Copier les commandes</button>`
    + `<button type="button" class="secondary-button j-mini" data-cfgaction="telecharger">Télécharger (.txt)</button>`
    + `<button type="button" class="secondary-button j-mini j-danger" data-cfgaction="effacer">Effacer la configuration</button></div>`
    + (note ? `<p class="cfg-note" role="status">${esc(note)}</p>` : '');
  const s = [];

  if (fam === 'hote') {
    s.push(section('Adresse IP du poste', `<div class="sch-champs">${txt('hote|adresse', 'Adresse / préfixe', c.hote.adresse, { max: 20, place: '192.168.10.10/24' })}`
      + txt('hote|passerelle', 'Passerelle', c.hote.passerelle, { max: 15, place: '192.168.10.1' }) + txt('hote|dns', 'DNS', c.hote.dns, { max: 40, place: '8.8.8.8' }) + '</div>',
    { aide: '« Proposer » reprend l’adresse du câble et trouve la passerelle (routeur ou cœur dans le même réseau).' }));
  } else {
    // Général
    s.push(section('Général', `<div class="sch-champs">${N('intermediaire') || c.domaine ? txt('domaine', 'Nom de domaine', c.domaine, { place: 'cegeplimoilou.lan', aide: 'Obligatoire pour SSH.' }) : ''}`
      + (N('intermediaire') ? txt('banniere', 'Bannière (MOTD)', c.banniere, { max: 160, place: 'Accès réservé aux administrateurs' }) : '') + '</div>'
      + `<p class="cfg-aide">Nom d’hôte : <b>${esc(nom || '(à nommer)')}</b> (le nom de l’équipement).</p>`));
    // VLAN (commutateurs)
    if (fam !== 'routeur') {
      s.push(section('VLAN', c.vlans.map((v, i) => ligne(txt(`vlans|${i}|id`, 'Numéro', v.id, { max: 4, court: true, place: '10' }) + txt(`vlans|${i}|nom`, 'Nom', v.nom, { max: 32, place: 'VENTES' }) + del('vlans', i, `le VLAN ${v.id}`))).join('')
        + `<div class="params-actions">${add('vlans', '+ VLAN')}</div>`, { aide: 'Les zones « VLAN 10 · NOM · réseau » du schéma sont reprises par « Proposer ».' }));
      if (N('intermediaire')) s.push(section('VTP', `<div class="sch-champs">${sel('vtp|mode', 'Mode VTP', [['', '— non configuré —'], ['transparent', 'transparent'], ['server', 'server'], ['client', 'client']], c.vtp.mode)}${txt('vtp|domaine', 'Domaine VTP', c.vtp.domaine, { max: 32 })}</div>`, { niveau: 'intermediaire', aide: 'En labo, « transparent » évite qu’un commutateur efface les VLAN des autres.' }));
    }
    // Ports
    const ports = portsAffiches(schema, n, c, { equipement, tous: tousPorts });
    const modes = fam === 'routeur' ? null : [['', '—'], ['access', 'accès'], ['trunk', 'trunk'], ...(fam === 'commutateur-l3' ? [['routed', 'routé (L3)']] : [])];
    const lignesPorts = ports.map((p) => {
      const cp = c.ports[p.cle] ?? {}; const k = `ports|${p.cle}`;
      const vers = p.vers ? `→ ${p.vers.nom || p.vers.type}${p.portEnFace ? ` ${p.portEnFace}` : ''}` : 'non câblé';
      let champs = '';
      if (fam === 'routeur') {
        champs = txt(`${k}|adresse`, 'Adresse / préfixe', cp.adresse, { max: 20, place: '192.168.1.1/24' })
          + (N('intermediaire') ? txt(`${k}|helper`, 'Relais DHCP', cp.helper, { max: 15, court: true, place: 'IP du serveur' }) : '')
          + (N('complet') ? sel(`${k}|nat`, 'NAT', [['', '—'], ['inside', 'inside'], ['outside', 'outside']], cp.nat ?? '') : '');
      } else {
        champs = sel(`${k}|mode`, 'Mode', modes, cp.mode ?? '');
        if (cp.mode === 'access') {
          champs += txt(`${k}|vlan`, 'VLAN', cp.vlan, { max: 4, court: true, place: '10' })
            + (N('intermediaire') ? txt(`${k}|voix`, 'VLAN voix', cp.voix, { max: 4, court: true, place: '150' }) : '');
        }
        if (cp.mode === 'trunk' && N('intermediaire')) {
          champs += txt(`${k}|natif`, 'VLAN natif', cp.natif, { max: 4, court: true, place: '99' }) + txt(`${k}|autorises`, 'VLAN autorisés', cp.autorises, { max: 60, place: '10,20,99' });
        }
        if (cp.mode === 'routed') champs += txt(`${k}|adresse`, 'Adresse / préfixe', cp.adresse, { max: 20, place: '10.0.0.1/30' });
      }
      champs += txt(`${k}|description`, 'Description', cp.description, { max: 60, place: 'Vers R1 Gi0/0' });
      let cases = caseC(`${k}|eteint`, 'Éteint (shutdown)', cp.eteint);
      if (fam !== 'routeur' && cp.mode === 'access') {
        if (N('intermediaire')) cases += caseC(`${k}|securite`, 'Port-security', cp.securite) + (cp.securite ? txt(`${k}|securiteMax`, 'Max MAC', cp.securiteMax, { max: 3, court: true, place: '2' }) : '');
        if (N('complet')) cases += caseC(`${k}|portfast`, 'PortFast', cp.portfast) + caseC(`${k}|bpduguard`, 'BPDU Guard', cp.bpduguard);
      }
      return `<div class="cfg-port"><div class="cfg-port-nom"><b>${esc(p.nom)}</b> <span class="i-meta">${esc(vers)}</span></div><div class="sch-champs">${champs}</div><div class="cfg-cases">${cases}</div></div>`;
    }).join('');
    s.push(section(`Ports (${ports.length} affiché(s))`, (lignesPorts || '<p class="sch-info">Aucun port câblé : câble l’équipement sur le schéma, ou affiche tous les ports.</p>')
      + `<div class="params-actions"><button type="button" class="secondary-button j-mini" data-cfgaction="tousPorts" aria-pressed="${tousPorts}">${tousPorts ? 'Seulement les ports câblés et configurés' : `Afficher tous les ports (${ports[0]?.libres ?? 0})`}</button></div>`,
    { aide: fam === 'routeur' ? 'Un routeur n’a pas de trunk : pour plusieurs VLAN sur un câble, utilise les sous-interfaces.' : 'Accès : un seul VLAN (poste, imprimante). Trunk : plusieurs VLAN (vers un commutateur ou un routeur).' }));
    // Sous-interfaces (routeur sur un bâton)
    if (fam === 'routeur') {
      s.push(section('Sous-interfaces (routeur sur un bâton)', c.sousInterfaces.map((x, i) => ligne(txt(`sousInterfaces|${i}|port`, 'Port', x.port, { max: 30, court: true, place: 'Gi0/0' })
        + txt(`sousInterfaces|${i}|vlan`, 'VLAN', x.vlan, { max: 4, court: true, place: '10' }) + txt(`sousInterfaces|${i}|adresse`, 'Adresse / préfixe', x.adresse, { max: 20, place: '192.168.10.1/24' })
        + (N('intermediaire') ? txt(`sousInterfaces|${i}|helper`, 'Relais DHCP', x.helper, { max: 15, court: true }) : '')
        + (N('complet') ? sel(`sousInterfaces|${i}|nat`, 'NAT', [['', '—'], ['inside', 'inside'], ['outside', 'outside']], x.nat) : '')
        + caseC(`sousInterfaces|${i}|natif`, 'VLAN natif', x.natif) + del('sousInterfaces', i, `la sous-interface ${x.port}.${x.vlan}`))).join('')
        + `<div class="params-actions">${add('sousInterfaces', '+ Sous-interface')}</div>`, { aide: 'Une par VLAN, sur le port relié au trunk du commutateur. Son adresse est la passerelle des postes du VLAN.' }));
    }
    // Gestion (commutateurs)
    if (fam !== 'routeur') {
      s.push(section('Gestion à distance', `<div class="sch-champs">${txt('gestion|vlan', 'VLAN de gestion', c.gestion.vlan, { max: 4, court: true, place: '99' })}${txt('gestion|adresse', 'Adresse / préfixe', c.gestion.adresse, { max: 20, place: '192.168.99.2/24' })}`
        + (fam === 'commutateur' ? txt('gestion|passerelle', 'Passerelle (ip default-gateway)', c.gestion.passerelle, { max: 15, place: '192.168.99.1' }) : '') + '</div>'));
    }
    if (N('intermediaire')) {
      s.push(section('SSH', `${caseC('ssh|actif', 'Activer SSH version 2 (lignes VTY en SSH seulement)', c.ssh.actif)}<div class="sch-champs">${txt('ssh|utilisateur', 'Utilisateur local', c.ssh.utilisateur, { max: 30, place: 'admin' })}</div>`,
        { niveau: 'intermediaire', aide: 'La ligne « username … secret » s’arrête avant le mot de passe : tape-le sur l’équipement. Il n’est jamais écrit ici.' }));
    }
    // STP et EtherChannel (commutateurs, complet)
    if (fam !== 'routeur' && N('complet')) {
      s.push(section('Spanning Tree', `<div class="sch-champs">${sel('stp|mode', 'Mode', [['', '— par défaut (PVST+) —'], ['pvst', 'PVST+'], ['rapid-pvst', 'Rapid-PVST+']], c.stp.mode)}`
        + txt('stp|primaire', 'Racine primaire des VLAN', c.stp.primaire, { place: '10,20,99' }) + txt('stp|secondaire', 'Racine secondaire des VLAN', c.stp.secondaire, { place: '' }) + '</div>'
        + `<div class="cfg-cases">${caseC('stp|portfastDefaut', 'PortFast sur tous les ports d’accès', c.stp.portfastDefaut)}${caseC('stp|bpduguardDefaut', 'BPDU Guard sur les ports PortFast', c.stp.bpduguardDefaut)}</div>`,
      { niveau: 'complet', aide: 'Le commutateur de cœur est la racine : le trafic ne passe pas par un commutateur d’accès.' }));
      s.push(section('EtherChannel', c.canaux.map((k, i) => ligne(txt(`canaux|${i}|groupe`, 'Groupe', k.groupe, { max: 3, court: true, place: '1' })
        + sel(`canaux|${i}|protocole`, 'Protocole', [['lacp', 'LACP (802.3ad)'], ['pagp', 'PAgP (Cisco)'], ['on', 'Statique (on)']], k.protocole)
        + sel(`canaux|${i}|mode`, 'Mode', { lacp: [['active', 'active'], ['passive', 'passive']], pagp: [['desirable', 'desirable'], ['auto', 'auto']], on: [['on', 'on']] }[k.protocole], k.mode)
        + txt(`canaux|${i}|ports`, 'Ports (séparés par des virgules)', Array.isArray(k.ports) ? k.ports.join(', ') : k.ports, { max: 200, place: 'Gi0/1, Gi0/2' })
        + sel(`canaux|${i}|usage`, 'Usage', [['trunk', 'trunk'], ['access', 'accès']], k.usage)
        + (k.usage === 'trunk' ? txt(`canaux|${i}|natif`, 'VLAN natif', k.natif, { max: 4, court: true }) + txt(`canaux|${i}|autorises`, 'VLAN autorisés', k.autorises, { max: 60 }) : txt(`canaux|${i}|vlan`, 'VLAN', k.vlan, { max: 4, court: true }))
        + del('canaux', i, `l’EtherChannel ${k.groupe}`))).join('')
        + `<div class="params-actions">${add('canaux', '+ EtherChannel')}</div>`, { niveau: 'complet', aide: 'Deux câbles ou plus entre les mêmes équipements : « Proposer » les regroupe. Les deux côtés doivent avoir le même protocole (LACP active/active ou active/passive).' }));
    }
    // SVI et ip routing (cœur)
    if (fam === 'commutateur-l3' && N('complet')) {
      s.push(section('Routage entre VLAN (SVI)', caseC('ipRouting', 'ip routing (le commutateur route entre les VLAN)', c.ipRouting)
        + c.svis.map((x, i) => ligne(txt(`svis|${i}|vlan`, 'VLAN', x.vlan, { max: 4, court: true, place: '10' }) + txt(`svis|${i}|adresse`, 'Adresse / préfixe', x.adresse, { max: 20, place: '192.168.10.1/24' })
          + txt(`svis|${i}|helper`, 'Relais DHCP', x.helper, { max: 15, court: true }) + del('svis', i, `la SVI ${x.vlan}`))).join('')
        + `<div class="params-actions">${add('svis', '+ SVI')}</div>`, { niveau: 'complet', aide: 'Chaque SVI est la passerelle de son VLAN.' }));
    }
    // Routage, DHCP, HSRP, NAT (L3)
    if (fam !== 'commutateur') {
      if (N('intermediaire')) {
        s.push(section('Routes statiques', c.statiques.map((r, i) => ligne(txt(`statiques|${i}|reseau`, 'Réseau / préfixe', r.reseau, { max: 20, place: '0.0.0.0/0' }) + txt(`statiques|${i}|saut`, 'Prochain saut ou interface', r.saut, { max: 30, place: '203.0.113.1' }) + del('statiques', i, `la route ${r.reseau}`))).join('')
          + `<div class="params-actions">${add('statiques', '+ Route')}</div>`, { niveau: 'intermediaire', aide: '0.0.0.0/0 = route par défaut (vers Internet).' }));
        s.push(section('DHCP', c.dhcp.exclusions.map((x, i) => ligne(txt(`dhcp|exclusions|${i}|debut`, 'Exclure de', x.debut, { max: 15, place: '192.168.10.1' }) + txt(`dhcp|exclusions|${i}|fin`, 'à', x.fin, { max: 15, place: '192.168.10.10' }) + del('dhcp|exclusions', i, 'l’exclusion'))).join('')
          + c.dhcp.pools.map((p, i) => ligne(txt(`dhcp|pools|${i}|nom`, 'Pool', p.nom, { max: 32, court: true, place: 'VENTES' }) + txt(`dhcp|pools|${i}|reseau`, 'Réseau / préfixe', p.reseau, { max: 20, place: '192.168.10.0/24' })
            + txt(`dhcp|pools|${i}|passerelle`, 'Passerelle', p.passerelle, { max: 15, place: '192.168.10.1' }) + txt(`dhcp|pools|${i}|dns`, 'DNS', p.dns, { max: 40, place: '8.8.8.8' }) + del('dhcp|pools', i, `le pool ${p.nom}`))).join('')
          + `<div class="params-actions">${add('dhcp|pools', '+ Pool')}${add('dhcp|exclusions', '+ Exclusion')}<button type="button" class="secondary-button j-mini" data-cfgaction="dhcpParVlan">Un pool par VLAN</button></div>`,
        { niveau: 'intermediaire', aide: '« Un pool par VLAN » crée un pool pour chaque sous-interface ou SVI adressée, et exclut les 10 premières adresses.' }));
      }
      if (N('complet')) {
        s.push(section('OSPF', `<div class="sch-champs">${txt('ospf|processus', 'Processus', c.ospf.processus, { max: 5, court: true, place: '1' })}${txt('ospf|routerId', 'Router-ID', c.ospf.routerId, { max: 15, place: '1.1.1.1' })}${txt('ospf|passifs', 'Interfaces passives', c.ospf.passifs, { max: 120, place: 'Gi0/0.10, Gi0/0.20' })}</div>`
          + c.ospf.reseaux.map((r, i) => ligne(txt(`ospf|reseaux|${i}|reseau`, 'Réseau / préfixe', r.reseau, { max: 20, place: '10.0.0.0/30' }) + txt(`ospf|reseaux|${i}|zone`, 'Zone', r.zone, { max: 10, court: true, place: '0' }) + del('ospf|reseaux', i, `le réseau ${r.reseau}`))).join('')
          + `<div class="params-actions">${add('ospf|reseaux', '+ Réseau')}<button type="button" class="secondary-button j-mini" data-cfgaction="ospfReseaux">Annoncer mes réseaux</button></div>`,
        { niveau: 'complet', aide: 'Le masque inverse (wildcard) est calculé. Les interfaces vers les postes peuvent être passives.' }));
        s.push(section('HSRP (passerelle redondante)', c.hsrp.map((h, i) => ligne(txt(`hsrp|${i}|interface`, 'Interface', h.interface, { max: 30, court: true, place: 'Vlan10' }) + txt(`hsrp|${i}|groupe`, 'Groupe', h.groupe, { max: 4, court: true, place: '10' })
          + txt(`hsrp|${i}|ip`, 'IP virtuelle', h.ip, { max: 15, place: '192.168.10.254' }) + txt(`hsrp|${i}|priorite`, 'Priorité', h.priorite, { max: 3, court: true, place: '110' }) + caseC(`hsrp|${i}|preempt`, 'Preempt', h.preempt) + del('hsrp', i, 'le groupe HSRP'))).join('')
          + `<div class="params-actions">${add('hsrp', '+ Groupe HSRP')}</div>`, { niveau: 'complet', aide: 'Deux routeurs ou cœurs partagent l’IP virtuelle : c’est elle que les postes utilisent comme passerelle.' }));
        s.push(section('NAT (PAT vers Internet)', `<div class="sch-champs">${txt('nat|reseaux', 'Réseaux internes', c.nat.reseaux, { max: 160, place: '192.168.10.0/24, 192.168.20.0/24' })}${txt('nat|sortie', 'Interface de sortie', c.nat.sortie, { max: 30, court: true, place: 'Gi0/1' })}</div>`,
          { niveau: 'complet', aide: 'Marque aussi les interfaces « inside » et « outside » dans les ports et sous-interfaces.' }));
      }
    }
  }
  return `<div class="cfg">${entete}<div id="cfgCorps">${niveaux}${actions}${s.join('')}`
    + `<h4 class="cfg-h">Commandes générées</h4><p class="cfg-aide">Vérifiées pour leur forme et leur ordre, pas exécutées sur un équipement. À coller en mode configuration (Packet Tracer : onglet CLI).</p>`
    + `<div id="cfgApercu" aria-live="polite">${apercuConfigMarkup(n, c, { nom })}</div></div></div>`;
}

/** Valeur par défaut d'une nouvelle ligne de liste. */
export function nouvelleLigne(liste, c) {
  const vlanSuivant = () => String(Math.max(0, ...c.vlans.map((v) => Number(v.id) || 0)) + 10);
  return {
    vlans: { id: vlanSuivant(), nom: '' },
    sousInterfaces: { port: c.sousInterfaces[0]?.port ?? '', vlan: '', adresse: '', natif: false, helper: '', nat: '' },
    svis: { vlan: '', adresse: '', helper: '' },
    canaux: { groupe: String(c.canaux.length + 1), protocole: 'lacp', mode: 'active', ports: '', usage: 'trunk', vlan: '', natif: '', autorises: '' },
    statiques: { reseau: '', saut: '' },
    'dhcp|pools': { nom: '', reseau: '', passerelle: '', dns: '', domaine: '' },
    'dhcp|exclusions': { debut: '', fin: '' },
    'ospf|reseaux': { reseau: '', zone: '0' },
    hsrp: { interface: '', groupe: '', ip: '', priorite: '', preempt: false },
  }[liste] ?? null;
}

/** Un pool DHCP par sous-interface / SVI adressée (10 premières adresses exclues). */
export function poolsParVlan(c) {
  const sources = [...c.sousInterfaces.map((s) => ({ vlan: s.vlan, adresse: s.adresse })), ...c.svis.map((s) => ({ vlan: s.vlan, adresse: s.adresse }))];
  let k = 0;
  for (const s of sources) {
    const a = cidr(s.adresse); if (!a) continue;
    const reseau = `${a.reseau}/${a.prefixe}`;
    if (c.dhcp.pools.some((p) => cidr(p.reseau)?.reseau === a.reseau)) continue;
    const base = a.reseau.split('.').map(Number);
    const ip = (d) => [base[0], base[1], base[2], base[3] + d].join('.');
    c.dhcp.exclusions.push({ debut: ip(1), fin: ip(10) });
    c.dhcp.pools.push({ nom: c.vlans.find((v) => v.id === s.vlan)?.nom || `VLAN${s.vlan}`, reseau, passerelle: a.ip, dns: '', domaine: c.domaine });
    k++;
  }
  return k;
}

/** Les réseaux des interfaces adressées → réseaux OSPF (zone 0). */
export function ospfDepuisInterfaces(c) {
  const adresses = [...Object.values(c.ports).map((p) => p.adresse), ...c.sousInterfaces.map((s) => s.adresse), ...c.svis.map((s) => s.adresse)];
  let k = 0;
  for (const v of adresses) {
    const a = cidr(v); if (!a) continue;
    const r = `${a.reseau}/${a.prefixe}`;
    if (c.ospf.reseaux.some((x) => cidr(x.reseau)?.reseau === a.reseau && cidr(x.reseau)?.prefixe === a.prefixe)) continue;
    c.ospf.reseaux.push({ reseau: r, zone: '0' }); k++;
  }
  if (k && !c.ospf.processus) c.ospf.processus = '1';
  return k;
}
