/**
 * memo.mjs — KJEMO-UX-ACCUEIL-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * L'AIDE-MÉMOIRE du cours : les fiches issues des notes de cours, rangées par
 * ce que l'on veut FAIRE (fichiers, texte, comptes, services, réseau, stockage,
 * Samba, Windows, Cisco, Bash). Une ligne peut être une fiche rédigée
 * ou un assistant complet. Module pur : aucune dépendance au DOM, testable sous Node.
 *
 * Extensible sans toucher à l'interface :
 *  - une fiche nouvelle s'ajoute dans la liste `fiches` d'un sous-groupe ;
 *  - un groupe nouveau est un objet de plus dans MEMO_GROUPES (un groupe sans
 *    fiche n'est jamais affiché) ;
 *  - les compteurs, le badge « nouveau » et le filtre « Liés au TP » sont
 *    CALCULÉS (jamais saisis à la main) ; `incoherencesMemo` fait échouer le
 *    banc si une fiche est inconnue, rangée deux fois, ou oubliée.
 *
 * Les couleurs d'un groupe ne portent jamais seules l'information : chaque
 * groupe a aussi une icône et un nom (voir vue-portes.mjs).
 */

export const ROUTE_MEMO = '#/memo';
export const ROUTE_CATALOGUE = '#/catalogue';

/** Chaque sous-groupe : un nom, et les identifiants de fiches (ordre d'affichage). */
export const MEMO_GROUPES = [
  { id: 'fichiers', titre: 'Fichiers et dossiers', icone: '📁', couleur: '#2563eb', commandes: 'ls, cp, mv, find, tar',
    resume: 'Se repérer, créer, copier, supprimer, archiver et retrouver.',
    sous: [
      { id: 'reperer', titre: 'Se repérer', fiches: ['cours-se-reperer', 'cours-identifier-fichier'] },
      { id: 'manipuler', titre: 'Créer, copier, supprimer', fiches: ['cours-creer-dossiers-fichiers', 'cours-copier-deplacer', 'cours-supprimer-prudemment', 'cours-liens', 'cours-droits-fichier'] },
      { id: 'archiver', titre: 'Archiver et compresser', fiches: ['cours-archives', 'cours-gzip-fichier'] },
      { id: 'trouver', titre: 'Trouver', fiches: ['cours-find-fichiers', 'cours-trouver-commande'] },
    ] },
  { id: 'texte', titre: 'Lire et filtrer du texte', icone: '📄', couleur: '#7c3aed', commandes: 'cat, grep, sort, diff',
    resume: 'Lire un fichier, chercher un motif, trier, comparer, rediriger.',
    sous: [
      { id: 'lire', titre: 'Lire et afficher', fiches: ['cours-lire-fichiers', 'cours-afficher-texte'] },
      { id: 'filtrer', titre: 'Chercher, comparer, enchaîner', fiches: ['cours-grep-wc', 'cours-comparer-trier', 'cours-redirections-tubes'] },
    ] },
  { id: 'comptes', titre: 'Comptes et droits', icone: '👤', couleur: '#db2777', commandes: 'useradd, chmod, chown',
    resume: 'Comptes et groupes locaux, sessions ouvertes, droits d’un dossier.',
    sous: [
      { id: 'locaux', titre: 'Comptes et groupes locaux', fiches: ['cours-creer-compte-local', 'cours-groupes-locaux', 'cours-sessions-utilisateurs', 'cours-supprimer-compte-local'] },
      { id: 'droits', titre: 'Droits d’un dossier', fiches: ['cours-droits-dossier-partage', 'cours-donner-dossier-compte'] },
    ] },
  { id: 'services', titre: 'Services et processus', icone: '⚙', couleur: '#ea580c', commandes: 'systemctl, ps, kill, at',
    resume: 'Services, processus, état de la machine, arrêt, tâches planifiées.',
    sous: [
      { id: 'services', titre: 'Services', fiches: ['cours-service-ancien'] },
      { id: 'processus', titre: 'Processus, état et arrêt', fiches: ['cours-processus', 'cours-etat-systeme', 'cours-arret-redemarrage'] },
      { id: 'planifier', titre: 'Tâches planifiées', fiches: ['cours-planifier-taches'] },
    ] },
  { id: 'reseau', titre: 'Réseau', icone: '🌐', couleur: '#0891b2', commandes: 'ip, ping, netplan',
    resume: 'Adresse et carte réseau d’un poste.',
    sous: [
      { id: 'poste', titre: 'Carte réseau d’un poste', fiches: ['cours-ubuntu-reseau-client', 'cours-ifconfig-ancien'] },
    ] },
  { id: 'stockage', titre: 'Disques, RAID, quotas', icone: '💽', couleur: '#65a30d', commandes: 'fdisk, mdadm, edquota',
    resume: 'Ajouter un disque, partitionner, monter, limiter, mettre en miroir.',
    sous: [
      { id: 'disque', titre: 'Disque, partition, montage', fiches: ['cours-hyperviseur-ajouter-disque', 'cours-partition-formater-monter', 'cours-disque-entretien'] },
      { id: 'quotas', titre: 'Quotas', fiches: ['cours-quotas-utilisateur', 'cours-quota-edquota'] },
      { id: 'raid', titre: 'RAID 1', fiches: ['cours-raid1-creer', 'cours-raid1-panne-secours'] },
    ] },
  { id: 'samba', titre: 'Samba et domaine', icone: '🗂', couleur: '#0b7a5a', commandes: 'samba-tool, smbclient',
    resume: 'Comptes du domaine, partages, clients Ubuntu et Windows, DNS.',
    sous: [
      { id: 'comptes', titre: 'Comptes et groupes du domaine', fiches: ['cours-samba-groupes', 'cours-samba-script-menu', 'cours-samba-import-csv'] },
      { id: 'partages', titre: 'Partages', fiches: ['cours-samba-partage-utilisateurs', 'cours-samba-partage-groupe', 'cours-samba-connexions'] },
      { id: 'clients', titre: 'Postes clients', fiches: ['cours-smbclient-transferts', 'cours-ubuntu-acces-partage', 'cours-windows-acces-partage', 'cours-windows-connexion-domaine'] },
      { id: 'domaine', titre: 'Domaine, DNS et outils', fiches: ['cours-samba-dns', 'cours-ubuntu-jonction-ad', 'cours-rsat-windows'] },
    ] },
  // Groupes Windows (KJEMO-UX-MEMO-WINDOWS-01) : fiches et assistants du catalogue, rangés par ce que l'on veut faire.
  { id: 'win-poste', titre: 'Poste Windows', icone: '🖥', couleur: '#1d4ed8', commandes: 'Get-Service, sfc, Get-WinEvent',
    resume: 'Services, journaux, réparation du système, disque et imprimantes d’un poste Windows.',
    sous: [
      { id: 'services', titre: 'Services et journaux', fiches: ['windows-etat-service', 'redemarrer-service-windows', 'windows-service-control', 'journal-evenements-windows'] },
      { id: 'reparer', titre: 'Réparer le système', fiches: ['reparer-fichiers-systeme', 'sfc-repair', 'dism-repair', 'restore-point-create', 'windows-update-diagnostic'] },
      { id: 'etat', titre: 'État, disque et inventaire', fiches: ['workstation-health-report', 'workstation-inventory', 'espace-disque-windows', 'workstation-storage-diagnostic', 'local-accounts-audit'] },
      { id: 'imprimantes', titre: 'Imprimantes', fiches: ['imprimantes-inventaire-windows', 'imprimante-file-bloquee'] },
    ] },
  { id: 'win-reseau', titre: 'Réseau Windows', icone: '🛜', couleur: '#0369a1', commandes: 'ipconfig, Test-NetConnection, Resolve-DnsName',
    resume: 'Adresse IP, DNS, tests de connectivité et diagnostic réseau d’un poste Windows.',
    sous: [
      { id: 'adresse', titre: 'Adresse IP et DNS', fiches: ['windows-voir-ip', 'windows-ip-fixe', 'renouveler-bail-dhcp', 'dns-client-change', 'dns-cache-reset'] },
      { id: 'tester', titre: 'Tester la connectivité', fiches: ['ping-traceroute', 'tester-port-tcp', 'windows-ports-ecoute', 'smb-connectivity-test', 'http-https-tls-test'] },
      { id: 'diagnostiquer', titre: 'Diagnostiquer', fiches: ['scenario-windows-diagnostic-reseau', 'gateway-diagnostic', 'dns-client-diagnostic', 'dhcp-client-diagnostic', 'network-share-diagnostic', 'ip-conflict-detection'] },
    ] },
  { id: 'win-ad', titre: 'Active Directory', icone: '🏛', couleur: '#6d28d9', commandes: 'New-ADUser, Get-ADUser, dcdiag',
    resume: 'Unités d’organisation, comptes, groupes, dépannage de comptes, santé du domaine, jonction d’un poste.',
    sous: [
      { id: 'structure', titre: 'Unités d’organisation, comptes et groupes', fiches: ['ad-ou', 'ad-ou-hierarchy', 'ad-user', 'ad-users-csv', 'ad-groups', 'ad-group-members-csv'] },
      { id: 'depanner', titre: 'Dépanner un compte', fiches: ['ad-debloquer-compte', 'ad-account-recovery', 'ad-account-health', 'ad-object-search-move'] },
      { id: 'sante', titre: 'Santé du domaine', fiches: ['ad-dcdiag-report', 'ad-repadmin-report', 'ad-etat-replication', 'ad-dns-health', 'ad-secure-channel'] },
      { id: 'jonction', titre: 'Joindre un poste au domaine', fiches: ['windows-domain-join-readiness', 'windows-domain-join', 'windows-domain-join-diagnostic'] },
    ] },
  { id: 'win-gpo', titre: 'Stratégies de groupe (GPO)', icone: '📋', couleur: '#be123c', commandes: 'gpupdate, gpresult, New-GPO',
    resume: 'Appliquer et vérifier les GPO, les créer et les lier, préparer les réglages courants.',
    sous: [
      { id: 'verifier', titre: 'Appliquer et vérifier', fiches: ['appliquer-strategies-groupe', 'gpo-refresh-diagnostic', 'gpo-resultant-set', 'gpo-health-report', 'gpo-inventory-report'] },
      { id: 'creer', titre: 'Créer, lier, sauvegarder', fiches: ['gpo-create-link', 'gpo-password', 'gpo-link-audit', 'gpo-security-filter', 'gpo-backup-restore-compare'] },
      { id: 'reglages', titre: 'Réglages courants', fiches: ['gpo-drive-mapping', 'gpo-session-desktop', 'gpo-folder-redirection', 'gpo-logon-startup-scripts', 'gpo-printer-deployment', 'gpo-firewall-defender'] },
    ] },
  { id: 'win-serveur', titre: 'Windows Server : DHCP, DNS, partages', icone: '🗄', couleur: '#b45309', commandes: 'Add-DhcpServerv4Scope, Add-DnsServerPrimaryZone, New-SmbShare',
    resume: 'Serveur DHCP, zones et enregistrements DNS, dossiers partagés et leurs permissions.',
    sous: [
      { id: 'dhcp', titre: 'DHCP', fiches: ['dhcp-install-authorize', 'dhcp-scope-options', 'dhcp-reservation', 'dhcp-leases-diagnostic', 'dhcp-backup'] },
      { id: 'dns', titre: 'DNS', fiches: ['dns-diagnostic', 'dns-zone', 'dns-record'] },
      { id: 'partages', titre: 'Partages et permissions', fiches: ['shared-folder', 'file-permissions-audit', 'smb-sessions-diagnostic'] },
    ] },
  { id: 'cisco-commutation', titre: 'Commutation Cisco', icone: '🔀', couleur: '#0e7490', commandes: 'channel-group, show etherchannel, spanning-tree',
    resume: 'Regrouper des liens (EtherChannel), les vérifier, les dépanner, régler Spanning Tree.',
    sous: [
      { id: 'etherchannel', titre: 'EtherChannel', fiches: ['cours-ec-avant-de-grouper', 'cours-ec-pagp', 'cours-ec-lacp', 'cours-ec-statique', 'cours-ec-verifier', 'cours-ec-depanner'] },
      { id: 'stp', titre: 'Spanning Tree', fiches: ['cours-stp-lire', 'cours-stp-racines', 'cours-stp-portfast-bpduguard'] },
    ] },
  { id: 'bash', titre: 'Bash', icone: '⌨', couleur: '#475569', commandes: 'if, for, select, printf',
    resume: 'Écrire de petits scripts : conditions, boucles, fonctions.',
    sous: [
      { id: 'scripts', titre: 'Scripts', fiches: ['cours-bash-condition', 'cours-bash-boucles', 'cours-bash-fonctions', 'cours-bash-menu'] },
    ] },
];

export const MEMO_PAR_ID = new Map(MEMO_GROUPES.map((g) => [g.id, g]));

/**
 * Date d'ajout des fiches récentes (AAAA-MM-JJ). Une fiche absente de cette
 * table n'est pas « nouvelle ». « Nouveau » = ajoutée dans les 14 jours qui
 * précèdent la fiche la plus récente (calcul déterministe : aucune horloge).
 */
export const AJOUTS = Object.fromEntries([
  'cours-hyperviseur-ajouter-disque', 'cours-ubuntu-reseau-client', 'cours-ubuntu-acces-partage', 'cours-windows-acces-partage',
  'cours-windows-connexion-domaine', 'cours-processus', 'cours-sessions-utilisateurs', 'cours-supprimer-compte-local', 'cours-archives',
  'cours-gzip-fichier', 'cours-trouver-commande', 'cours-comparer-trier', 'cours-etat-systeme', 'cours-arret-redemarrage',
  'cours-disque-entretien', 'cours-quota-edquota', 'cours-samba-connexions', 'cours-planifier-taches', 'cours-ifconfig-ancien',
  'cours-service-ancien', 'cours-creer-compte-local', 'cours-afficher-texte',
].map((id) => [id, '2026-10-27']).concat(
  ['cours-bash-menu', 'cours-samba-script-menu', 'cours-droits-fichier'].map((id) => [id, '2026-10-28']),
).concat(
  ['cours-ec-avant-de-grouper', 'cours-ec-pagp', 'cours-ec-lacp', 'cours-ec-statique', 'cours-ec-verifier', 'cours-ec-depanner',
    'cours-stp-lire', 'cours-stp-racines', 'cours-stp-portfast-bpduguard'].map((id) => [id, '2026-10-28']),
));

const JOUR = 86400000;
const t = (d) => Date.parse(`${d}T00:00:00Z`);
export function idsNouveaux(ajouts = AJOUTS, jours = 14) {
  const dates = Object.values(ajouts).map(t).filter(Number.isFinite);
  if (!dates.length) return new Set();
  const limite = Math.max(...dates) - jours * JOUR;
  return new Set(Object.entries(ajouts).filter(([, d]) => t(d) >= limite).map(([id]) => id));
}

/** Toutes les fiches d'un groupe, dans l'ordre d'affichage. */
export const fichesDuGroupe = (g) => g.sous.flatMap((s) => s.fiches);
export const toutesLesFichesMemo = () => MEMO_GROUPES.flatMap(fichesDuGroupe);

export function groupeDeFiche(id) {
  return MEMO_GROUPES.find((g) => fichesDuGroupe(g).includes(id)) ?? null;
}

/** Identifiants de fiches cités par les parcours et le soutien d'un cours : le filtre « Liés au TP ». */
export function fichesDuCours(cours) {
  const ids = new Set();
  for (const p of cours.parcours ?? []) {
    for (const r of p.prerequis ?? []) if (r.fiche) ids.add(r.fiche);
    for (const it of p.items ?? []) for (const r of it.refs ?? []) ids.add(r.fiche);
  }
  for (const s of cours.soutien ?? []) ids.add(s.fiche);
  return ids;
}

export const FILTRES_MEMO = [
  { id: 'tous', libelle: 'Tous' },
  { id: 'nouveau', libelle: 'Nouveautés' },
  { id: 'tp', libelle: 'Liés au TP' },
];

/**
 * Fiches d'un groupe après filtres. `plateformesDe(id)` renvoie les plateformes
 * d'une fiche (ex. ['Linux']) ; `lies` est l'ensemble des fiches d'un TP.
 */
export function filtrerGroupe(g, { filtre = 'tous', plat = null, plateformesDe = () => [], lies = new Set(), nouveaux = idsNouveaux() } = {}) {
  const garde = (id) => (!plat || plateformesDe(id).includes(plat))
    && (filtre === 'tous' || (filtre === 'nouveau' && nouveaux.has(id)) || (filtre === 'tp' && lies.has(id)));
  return g.sous.map((s) => ({ ...s, fiches: s.fiches.filter(garde) })).filter((s) => s.fiches.length);
}

export const compteGroupe = (g, opts) => filtrerGroupe(g, opts).reduce((n, s) => n + s.fiches.length, 0);

/** Routes : #/memo · #/memo/<groupe> · #/catalogue. */
export const routeMemo = (groupeId = null) => (groupeId ? `${ROUTE_MEMO}/${groupeId}` : ROUTE_MEMO);
export function lireRouteMemo(hash) {
  const h = String(hash ?? '').split('?')[0];
  if (h === ROUTE_CATALOGUE) return { type: 'catalogue' };
  const m = h.match(/^#\/memo(?:\/([a-z0-9-]+))?\/?$/);
  return m ? { type: 'memo', groupeId: m[1] ?? null } : null;
}

/**
 * Contrôle de cohérence (utilisé par le banc) : chaque fiche existe, est rangée
 * UNE fois, et chaque fiche de cours est rangée quelque part.
 */
export function incoherencesMemo({ existe, fichesAttendues = [], groupes = MEMO_GROUPES } = {}) {
  const pb = [];
  const vus = new Map();
  const ids = new Set();
  for (const g of groupes) {
    if (!/^[a-z0-9-]+$/.test(g.id) || ids.has(g.id)) pb.push(`groupe « ${g.id} » : identifiant invalide ou en double`);
    ids.add(g.id);
    if (!/^#[0-9a-f]{6}$/i.test(g.couleur ?? '')) pb.push(`groupe ${g.id} : couleur absente ou mal formée`);
    if (!g.icone || !g.titre) pb.push(`groupe ${g.id} : icône et titre obligatoires (la couleur ne porte jamais seule l’information)`);
    if (!g.sous?.length) pb.push(`groupe ${g.id} : aucun sous-groupe`);
    const sids = new Set();
    for (const s of g.sous ?? []) {
      if (sids.has(s.id)) pb.push(`groupe ${g.id} : sous-groupe « ${s.id} » en double`);
      sids.add(s.id);
      if (!s.fiches?.length) pb.push(`groupe ${g.id} › ${s.id} : sous-groupe vide`);
      for (const f of s.fiches ?? []) {
        if (existe && !existe(f)) pb.push(`groupe ${g.id} › ${s.id} : fiche inconnue « ${f} »`);
        if (vus.has(f)) pb.push(`fiche ${f} rangée deux fois (${vus.get(f)} et ${g.id})`);
        vus.set(f, g.id);
      }
    }
  }
  for (const f of fichesAttendues) if (!vus.has(f)) pb.push(`fiche ${f} absente de l’aide-mémoire`);
  for (const f of Object.keys(AJOUTS)) if (!vus.has(f)) pb.push(`AJOUTS : fiche ${f} absente de l’aide-mémoire`);
  return pb;
}
