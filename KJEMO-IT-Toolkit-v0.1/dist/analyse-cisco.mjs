/**
 * analyse-cisco.mjs — RESEAU-CISCO-01
 * ---------------------------------------------------------------------------
 * Analyse TEXTUELLE de sorties « show » collées par l'étudiant, et simulation
 * pédagogique de DTP. Rien ici ne se connecte à un équipement : on lit du
 * texte que l'étudiant a copié lui-même.
 *
 * Formats pris en charge (anglais, IOS 12.2 à 15.2) :
 *   - show vlan brief           (colonnes VLAN / Name / Status / Ports)
 *   - show interfaces trunk     (les 4 tableaux : Mode/Status/Native, allowed,
 *                                allowed and active, forwarding)
 *   - show vtp status           (Operating Mode, Domain Name, Version,
 *                                Configuration Revision, Number of existing VLANs)
 *
 * Limites : un format différent (autre langue, autre version, texte tronqué,
 * « show vlan » complet) est signalé comme NON RECONNU, jamais deviné. Un
 * verdict d'analyse n'est PAS un diagnostic exécuté sur l'équipement : il ne
 * dit que ce qui est lisible dans le texte collé.
 */

/** Développe « 1,10,20-23 » en tableau de nombres. Texte invalide → null. */
export function developperListeVlans(texte) {
  const s = String(texte ?? '').replace(/\s+/g, '');
  if (s === 'none' || s === '') return [];
  if (s === 'ALL' || s.toLowerCase() === 'all') return 'all';
  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(s)) return null;
  const ids = new Set();
  for (const bloc of s.split(',')) {
    const [a, b] = bloc.split('-').map(Number);
    const fin = b === undefined ? a : b;
    if (fin < a || fin > 4094 || fin - a > 4094) return null;
    for (let i = a; i <= fin; i += 1) ids.add(i);
  }
  return [...ids].sort((x, y) => x - y);
}

/** Ports « Fa0/7, Fa0/8, Gi0/1 » (avec lignes de continuation déjà recollées). */
function portsDe(texte) {
  return String(texte ?? '').split(',').map((p) => p.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
export function analyserVlanBrief(texte) {
  const lignes = String(texte ?? '').split('\n');
  const idx = lignes.findIndex((l) => /^\s*VLAN\s+Name\s+Status\s+Ports/i.test(l));
  if (idx < 0) return { reconnu: false, raison: 'En-tête « VLAN Name Status Ports » introuvable : ce n’est pas une sortie de « show vlan brief ».' };
  const vlans = [];
  let courant = null;
  for (const l of lignes.slice(idx + 1)) {
    if (/^\s*-+(\s+-+)*\s*$/.test(l) || l.trim() === '') continue;
    const m = /^(\d{1,4})\s+(\S+)\s+(active|act\/unsup|act\/lshut|suspended|sus\/lshut)\s*(.*)$/i.exec(l);
    if (m) {
      courant = { id: Number(m[1]), nom: m[2], etat: m[3].toLowerCase(), ports: portsDe(m[4]) };
      vlans.push(courant);
    } else if (courant && /^\s{10,}\S/.test(l)) {
      courant.ports.push(...portsDe(l));
    } else if (/^\s*(?:\S+#|\S+>)/.test(l)) {
      break;
    }
  }
  if (vlans.length === 0) return { reconnu: false, raison: 'Aucune ligne de VLAN lisible sous l’en-tête.' };
  return { reconnu: true, vlans };
}

export function analyserTrunks(texte) {
  const lignes = String(texte ?? '').split('\n');
  const t = { reconnu: false, ports: {} };
  let section = null;
  for (const l of lignes) {
    if (/^Port\s+Mode\s+Encapsulation\s+Status\s+Native vlan/i.test(l)) { section = 'etat'; continue; }
    if (/^Port\s+Vlans allowed on trunk/i.test(l)) { section = 'autorises'; continue; }
    if (/^Port\s+Vlans allowed and active in management domain/i.test(l)) { section = 'actifs'; continue; }
    if (/^Port\s+Vlans in spanning tree forwarding state and not pruned/i.test(l)) { section = 'forwarding'; continue; }
    if (!section || l.trim() === '') continue;
    const mot = l.trim().split(/\s+/);
    if (section === 'etat' && mot.length >= 5) {
      t.ports[mot[0]] = { ...(t.ports[mot[0]] ?? {}), mode: mot[1], encapsulation: mot[2], statut: mot[3], natif: Number(mot[4]) };
      t.reconnu = true;
    } else if (['autorises', 'actifs', 'forwarding'].includes(section) && mot.length >= 2) {
      const p = t.ports[mot[0]] ?? (t.ports[mot[0]] = {});
      p[section] = developperListeVlans(mot.slice(1).join(''));
    }
  }
  if (!t.reconnu) return { reconnu: false, raison: 'Tableau « Port Mode Encapsulation Status Native vlan » introuvable : ce n’est pas une sortie de « show interfaces trunk » (ou aucun trunk n’est actif : la sortie est alors vide).' };
  return t;
}

export function analyserVtpStatus(texte) {
  const s = String(texte ?? '');
  const prend = (re) => { const m = re.exec(s); return m ? m[1].trim() : null; };
  const mode = prend(/VTP Operating Mode\s*:\s*(\S+)/i);
  const domaine = prend(/VTP Domain Name\s*:\s*(.*)/i);
  if (mode === null && domaine === null) return { reconnu: false, raison: 'Lignes « VTP Operating Mode » / « VTP Domain Name » introuvables : ce n’est pas une sortie de « show vtp status ».' };
  const rev = prend(/Configuration Revision\s*:\s*(\d+)/i);
  const version = prend(/VTP version running\s*:\s*(\d+)/i) ?? prend(/running VTP version\s*:\s*(\d+)/i) ?? prend(/VTP Version\s*:\s*(\d+)/i);
  return {
    reconnu: true,
    mode: mode ? mode.toLowerCase() : null,
    domaine: domaine === '' ? '' : domaine,
    revision: rev === null ? null : Number(rev),
    version: version === null ? null : Number(version),
    vlans: prend(/Number of existing VLANs\s*:\s*(\d+)/i) === null ? null : Number(prend(/Number of existing VLANs\s*:\s*(\d+)/i)),
    elagage: prend(/VTP Pruning Mode\s*:\s*(\S+)/i),
    version3: /VTP Version capable\s*:\s*1 to 3/i.test(s),
  };
}

// ---------------------------------------------------------------------------
// Simulation DTP (pédagogique)
// ---------------------------------------------------------------------------
export const MODES_DTP = [
  ['auto', 'switchport mode dynamic auto — attend qu’on lui propose un trunk'],
  ['desirable', 'switchport mode dynamic desirable — propose activement un trunk'],
  ['access', 'switchport mode access — jamais de trunk'],
  ['trunk', 'switchport mode trunk — trunk fixe, continue d’envoyer des trames DTP'],
  ['trunk-nonegotiate', 'switchport mode trunk + switchport nonegotiate — trunk fixe, aucune trame DTP'],
];
const DYN = new Set(['auto', 'desirable']);

/**
 * Résultat attendu d'un lien entre deux ports. Modèle d'ENSEIGNEMENT : les
 * implémentations (et Packet Tracer) ont des particularités, et un lien
 * « incohérent » peut se comporter de façon surprenante.
 */
export function simulerDtp(local, distant) {
  const ok = (m) => MODES_DTP.some(([k]) => k === m);
  if (!ok(local) || !ok(distant)) throw new Error('Mode DTP inconnu.');
  const r = (resultat, raison) => ({ local, distant, resultat, raison });
  const nonego = (m) => m === 'trunk-nonegotiate';
  const fixe = (m) => m === 'trunk' || nonego(m);
  if (local === 'access' || distant === 'access') {
    if (fixe(local) || fixe(distant)) return r('incoherent', 'Un côté est en trunk fixe, l’autre en access : les trames ne sont pas étiquetées de la même façon des deux côtés, le lien ne fonctionne pas correctement (VLAN mélangés, perte de trafic).');
    return r('access', 'Un côté refuse le trunk : DTP ne forme pas de trunk.');
  }
  if (nonego(local) || nonego(distant)) {
    if (fixe(local) && fixe(distant)) return r('trunk', 'Les deux côtés sont en trunk fixe : le lien est un trunk, DTP n’est pas nécessaire.');
    return r('incoherent', 'Un côté est en trunk sans négociation, l’autre est dynamique : il ne reçoit aucune trame DTP, reste en access et le lien est incohérent.');
  }
  if (local === 'trunk' || distant === 'trunk') return r('trunk', 'Un côté est en trunk fixe : l’autre, dynamique ou fixe, passe en trunk via DTP.');
  if (local === 'auto' && distant === 'auto') return r('access', 'Les deux côtés attendent : personne ne propose le trunk, le lien reste en access.');
  if (DYN.has(local) && DYN.has(distant)) return r('trunk', 'Au moins un côté propose activement (desirable) : le trunk se forme.');
  return r('indetermine', 'Combinaison non couverte.');
}

/** Tout le tableau : utile pour l’affichage et pour les tests de cohérence. */
export function matriceDtp() {
  return MODES_DTP.map(([a]) => MODES_DTP.map(([b]) => simulerDtp(a, b)));
}

// ---------------------------------------------------------------------------
// Parcours de diagnostic guidé
// ---------------------------------------------------------------------------
export const SCENARIOS = [
  ['trunk-absent', 'Le trunk n’apparaît pas entre deux commutateurs'],
  ['vlan-non-transporte', 'Un VLAN existe des deux côtés mais ne traverse pas le trunk'],
  ['vlan-non-propage', 'Un VLAN créé sur un commutateur n’apparaît pas sur l’autre (VTP)'],
  ['pc-injoignables', 'Les PC sont injoignables alors que les VLAN sont présents'],
];

const dit = (liste, id) => (Array.isArray(liste) ? liste.includes(id) : liste === 'all');

/**
 * entree : { scenario, vlan, interface, sorties:{vlan, trunk, vtp} (textes déjà validés) }
 * Retourne { constats[], manque[], limites[] } en phrases, sans jamais conclure
 * au-delà de ce que les textes montrent.
 */
export function analyserParcours({ scenario, vlan, interface: iface, sorties = {} }) {
  const constats = []; const manque = []; const limites = [
    'Cette analyse lit du texte collé ; elle ne vaut pas diagnostic exécuté sur l’équipement.',
    'Elle ne voit que ce qui figure dans la sortie : un autre commutateur, un autre moment ou un format différent peuvent donner un autre résultat.',
  ];
  const v = sorties.vlan ? analyserVlanBrief(sorties.vlan) : null;
  const t = sorties.trunk ? analyserTrunks(sorties.trunk) : null;
  const p = sorties.vtp ? analyserVtpStatus(sorties.vtp) : null;
  for (const [nom, res] of [['show vlan brief', v], ['show interfaces trunk', t], ['show vtp status', p]]) {
    if (res && !res.reconnu) constats.push(`NON RECONNU — ${nom} : ${res.raison}`);
  }
  const vOk = v?.reconnu; const tOk = t?.reconnu; const pOk = p?.reconnu;

  if (scenario === 'trunk-absent') {
    if (!sorties.trunk) manque.push('Colle la sortie de « show interfaces trunk » pour lire les trunks actifs.');
    else if (!tOk) { /* déjà signalé */ }
    else {
      const ports = Object.keys(t.ports);
      constats.push(`Trunks listés : ${ports.join(', ') || 'aucun'}.`);
      if (iface) {
        const cible = ports.find((n) => n.toLowerCase() === iface.toLowerCase().replace('fastethernet', 'fa').replace('gigabitethernet', 'gi'));
        if (cible) constats.push(`L’interface ${iface} apparaît comme trunk (statut « ${t.ports[cible].statut} », natif ${t.ports[cible].natif}).`);
        else constats.push(`L’interface ${iface} n’apparaît PAS dans la liste des trunks : elle n’est pas (encore) en trunk, ou la sortie est tronquée. Regarde « show interfaces ${iface} switchport » (mode administratif et opérationnel) et les modes DTP des deux côtés.`);
      }
    }
  } else if (scenario === 'vlan-non-transporte') {
    if (!vlan) manque.push('Indique le VLAN suspecté.');
    if (!sorties.trunk) manque.push('Colle « show interfaces trunk » (listes de VLAN autorisés / actifs / forwarding).');
    if (tOk && vlan) {
      for (const [nom, p1] of Object.entries(t.ports)) {
        if (!iface || nom.toLowerCase() === iface.toLowerCase().replace('fastethernet', 'fa').replace('gigabitethernet', 'gi')) {
          if (p1.autorises === undefined) { constats.push(`${nom} : liste des VLAN autorisés illisible.`); continue; }
          if (!dit(p1.autorises, vlan)) constats.push(`${nom} : le VLAN ${vlan} n’est PAS dans les VLAN autorisés sur le trunk. Il faut l’ajouter avec « switchport trunk allowed vlan add ${vlan} » (jamais sans « add »).`);
          else if (p1.actifs !== undefined && !dit(p1.actifs, vlan)) constats.push(`${nom} : le VLAN ${vlan} est autorisé mais pas « allowed and active » : il n’existe pas (ou est inactif) sur ce commutateur.`);
          else if (p1.forwarding !== undefined && !dit(p1.forwarding, vlan)) constats.push(`${nom} : le VLAN ${vlan} est actif mais pas en état forwarding (spanning-tree ou élagage) : regarde « show spanning-tree vlan ${vlan} ».`);
          else constats.push(`${nom} : le VLAN ${vlan} est autorisé, actif et en forwarding dans cette sortie.`);
        }
      }
    }
    if (vlan && vOk) {
      const trouve = v.vlans.find((x) => x.id === vlan);
      constats.push(trouve ? `Le VLAN ${vlan} existe sur ce commutateur (nom ${trouve.nom}, ${trouve.etat}).` : `Le VLAN ${vlan} n’existe PAS dans cette sortie de « show vlan brief ».`);
    }
  } else if (scenario === 'vlan-non-propage') {
    if (!sorties.vtp) manque.push('Colle « show vtp status » des DEUX commutateurs (un à la fois) pour comparer.');
    if (pOk) {
      constats.push(`Mode ${p.mode}, domaine « ${p.domaine} », version ${p.version ?? 'non lue'}, révision ${p.revision ?? 'non lue'}, ${p.vlans ?? '?'} VLAN.`);
      if (p.mode === 'transparent') constats.push('Mode transparent : ce commutateur ne synchronise PAS sa base de VLAN, il relaie seulement les annonces. Un VLAN créé ici ou ailleurs ne s’y propage pas.');
      if (p.mode === 'client') constats.push('Mode client : on ne peut pas y créer de VLAN ; il reçoit ceux du serveur.');
      if (p.domaine === '') constats.push('Domaine VTP vide : ce commutateur n’a pas encore rejoint de domaine.');
      if (p.revision === 0) constats.push('Révision 0 : aucune modification annoncée n’a encore été reçue ou émise.');
      constats.push('Compare le domaine (sensible à la casse), la version et la révision avec l’autre commutateur : un domaine différent d’un caractère empêche toute propagation.');
    }
    if (!sorties.trunk) manque.push('VTP ne circule que sur les trunks : colle aussi « show interfaces trunk ».');
    else if (tOk && Object.keys(t.ports).length === 0) constats.push('Aucun trunk actif : VTP ne peut rien annoncer.');
    limites.push('La propagation dépend aussi du mot de passe VTP, que « show vtp status » n’affiche pas ; « show vtp password » le montre en clair et n’est pas généré par le Toolkit.');
  } else if (scenario === 'pc-injoignables') {
    if (!vlan) manque.push('Indique le VLAN des PC.');
    if (!sorties.vlan) manque.push('Colle « show vlan brief » : les PC sont-ils dans le bon VLAN ?');
    if (vOk && vlan) {
      const trouve = v.vlans.find((x) => x.id === vlan);
      if (!trouve) constats.push(`Le VLAN ${vlan} n’existe pas ici : les ports qui y sont affectés sont inactifs.`);
      else {
        constats.push(`VLAN ${vlan} « ${trouve.nom} » ${trouve.etat}, ports : ${trouve.ports.join(', ') || 'aucun'}.`);
        if (trouve.etat !== 'active') constats.push('Le VLAN n’est pas « active » (suspendu ou non pris en charge).');
        if (trouve.ports.length === 0) constats.push('Aucun port d’accès dans ce VLAN : les PC sont probablement dans un autre VLAN.');
      }
    }
    if (!sorties.trunk) manque.push('Colle « show interfaces trunk » : le VLAN traverse-t-il le trunk ?');
    if (tOk && vlan) {
      for (const [nom, p1] of Object.entries(t.ports)) {
        if (p1.autorises !== undefined && !dit(p1.autorises, vlan)) constats.push(`${nom} : le VLAN ${vlan} n’est pas autorisé sur ce trunk.`);
      }
    }
    limites.push('Même avec VLAN et trunk corrects, l’adressage IP (masque, passerelle) et le routage inter-VLAN restent à vérifier : ils ne sont pas dans ces sorties.');
  }
  return { constats, manque, limites, reconnus: { vlan: !!vOk, trunk: !!tOk, vtp: !!pOk } };
}

/** Échantillons ÉCRITS À LA MAIN pour les tests : ils ne proviennent d'AUCUN équipement. */
export const ECHANTILLONS_NON_CAPTURES = {
  vlanBrief: `VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Fa0/1, Fa0/2, Fa0/3, Fa0/4
10   RH                               active    Fa0/7
20   Compta                           active
30   Ventes                           active    Fa0/9
                                                Fa0/10
1002 fddi-default                     act/unsup
`,
  trunk: `Port        Mode         Encapsulation  Status        Native vlan
Fa0/9       on           802.1q         trunking      1

Port        Vlans allowed on trunk
Fa0/9       1,10,30

Port        Vlans allowed and active in management domain
Fa0/9       1,10,30

Port        Vlans in spanning tree forwarding state and not pruned
Fa0/9       1,10
`,
  vtp: `VTP Version capable             : 1 to 2
VTP version running             : 2
VTP Domain Name                 : CCNA-LAB
VTP Pruning Mode                : Disabled
VTP Traps Generation            : Disabled
Configuration Revision          : 4
Maximum VLANs supported locally : 255
Number of existing VLANs        : 8
VTP Operating Mode              : Client
`,
};
