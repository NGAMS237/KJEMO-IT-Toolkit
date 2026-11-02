/**
 * classement.mjs — UX-NAVIGATION-CATALOGUE-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * UNE SEULE source de classement du catalogue. Le menu latéral, les cartes de
 * rubrique, la recherche dans un périmètre, le fil d'Ariane des fiches et les
 * compteurs lisent tous ce fichier : aucun ne tient son propre classement.
 *
 * Trois niveaux au plus avant la fiche :
 *     domaine (la catégorie historique) → famille → sujet (facultatif) → tâche
 * Une famille n'a des sujets que si elle en porte au moins deux ; sinon elle
 * est elle-même la liste. Aucun niveau vide n'est imposé, aucune rubrique vide
 * n'est affichée (voir test/classement.test.mjs).
 *
 * Principe : on classe par SUJET, pas par type. Une commande rapide, une
 * procédure et un assistant d'un même sujet se retrouvent dans la même
 * rubrique ; le type et la méthode sont des badges. Chaque commande rapide et
 * chaque procédure suit son « hôte » — l'assistant complet qu'elle prolonge —
 * donc elle ne peut pas être classée ailleurs que lui.
 *
 * Ce module ne contient AUCUN contenu technique : seulement des noms de
 * rubriques et des identifiants. Ajouter un assistant sans le placer fait
 * échouer le banc de classement — jamais une entrée « orpheline ».
 */

/** Procédures et scénarios sans assistant : l'hôte qui décide de leur rubrique. */
export const HOTE_PROCEDURE = {
  'windows-ip-fixe': 'static-ip',
  'windows-ports-ecoute': 'tcp-port-test',
  'scenario-windows-diagnostic-reseau': 'gateway-diagnostic',
  'linux-espace-disque': 'linux-storage-diagnostic',
  'linux-ports-ecoute': 'linux-network-diagnostic',
  'scenario-linux-ssh': 'ssh-server-readiness',
  'scenario-cisco-ssh-commutateur': 'cisco-console-ssh',
  'scenario-cisco-inter-vlan-routeur': 'cisco-vlan-creation',
  // KJEMO-COMMANDES-COURS-TP2-01 : fiches rédigées à partir des notes de cours.
  'cours-partition-formater-monter': 'linux-disk-partition-mount',
  'cours-quotas-utilisateur': 'linux-quota-enable',
  'cours-raid1-creer': 'linux-raid1-create',
  'cours-raid1-panne-secours': 'linux-raid-member-manage',
  'cours-droits-dossier-partage': 'linux-permission-change',
  'cours-donner-dossier-compte': 'linux-permission-change',
  'cours-groupes-locaux': 'linux-user-create',
  'cours-samba-partage-utilisateurs': 'samba-share-create',
  'cours-samba-partage-groupe': 'samba-share-create',
  'cours-smbclient-transferts': 'samba-diagnostic',
  'samba-partage-parcourir': 'samba-diagnostic',
  'win-dhcp-exclusion': 'dhcp-scope-options',
  'cours-samba-groupes': 'samba-ad-user-manage',
  'cours-samba-import-csv': 'samba-ad-user-manage',
  'cours-samba-script-menu': 'samba-ad-user-manage',
  'samba-compte-voir': 'samba-ad-user-manage',
  'samba-mot-de-passe': 'samba-ad-user-manage',
  'samba-compte-creer': 'samba-ad-user-manage',
  'cours-samba-dns': 'samba-ad-health',
  'cours-ubuntu-jonction-ad': 'samba-ad-dc-readiness',
  'cours-ubuntu-jonction-ad-graphique': 'samba-ad-dc-readiness',
  'samba-ad-installer': 'samba-ad-dc-provision',
  'samba-ad-reconstruire': 'samba-ad-dc-provision',
  'linux-domaine-quitter-hors-ligne': 'samba-ad-dc-readiness',
  'win-domaine-quitter-hors-ligne': 'windows-domain-join',
  // KJEMO-COURS-TP2-01-R1 : postes clients du TP2.
  'cours-hyperviseur-ajouter-disque': 'linux-disk-partition-mount',
  'cours-ubuntu-reseau-client': 'linux-network-diagnostic',
  'cours-ubuntu-acces-partage': 'samba-diagnostic',
  'cours-windows-acces-partage': 'samba-diagnostic',
  // Compléments du mémo (commandes des notes sans route jusque-là).
  'cours-samba-connexions': 'samba-diagnostic',
  'cours-ifconfig-ancien': 'linux-network-diagnostic',
  'cours-disque-entretien': 'linux-disk-partition-mount',
  'cours-quota-edquota': 'linux-quota-enable',
};

/**
 * Entrées placées directement, faute d'assistant correspondant dans le
 * catalogue (la lecture des routes Cisco n'a pas d'assistant dédié).
 */
const DIRECT = { 'cisco-voir-routes': ['reseau-cisco', 'routage'] };

const F = (id, nom, extra) => ({ id, nom, ...extra });

/**
 * L'arbre. `sub` : sous-rubriques historiques des assistants (champ
 * `subcategory`) ; `hotes` : identifiants d'assistants, quand le sujet est plus
 * fin que la sous-rubrique. `sections` : titres de lecture à l'intérieur d'une
 * liste (ce n'est pas un niveau de navigation). `prevu` : ce qui est annoncé
 * mais PAS encore réalisé — affiché comme tel.
 */
export const ARBRE = {
  'poste-windows': [
    F('diagnostic', 'Diagnostic et performance', { sub: ['Diagnostic général', 'Performance et incidents'] }),
    F('peripheriques', 'Périphériques', { sub: ['Périphériques'] }),
    F('applications', 'Applications et mises à jour', { sub: ['Mises à jour et applications'] }),
    F('comptes', 'Comptes, services et domaine', { sub: ['Comptes et services', 'Jonction de domaine'] }),
    F('securite', 'Sécurité', { sub: ['Sécurité'] }),
    F('reparation', 'Réparation Windows', { sub: ['Réparation Windows'] }),
    F('stockage', 'Stockage et nettoyage', { sub: ['Stockage et nettoyage'] }),
    F('caches', 'Vider les caches', { fiches: ['win-cache-identifiants', 'win-cache-store', 'win-cache-windows-update', 'win-presse-papiers', 'win-kerberos-purger'] }),
    F('systeme', 'Informations sur le poste', { fiches: ['win-systeme-resume', 'win-version-windows', 'win-uptime', 'win-nom-poste-utilisateur', 'win-renommer-poste', 'win-whoami-groupes', 'win-licence-activation', 'win-bitlocker-etat'] }),
    F('processus', 'Processus, arrêt et sessions', { fiches: ['win-processus-trouver', 'win-processus-gourmands', 'win-processus-fermer', 'win-arret-redemarrage', 'win-arret-annuler', 'win-sessions-fermer'] }),
    F('fichiers', 'Fichiers, archives et droits', { fiches: ['win-disque-verifier', 'win-robocopy-copier', 'win-fichier-chercher', 'win-fichier-empreinte', 'win-archive-creer', 'win-archive-extraire', 'win-droits-prendre-possession'] }),
    F('logiciels', 'Logiciels et correctifs (en commande)', { fiches: ['win-winget-installer', 'win-winget-mettre-a-jour', 'win-correctifs-installes'] }),
    F('reglages', 'Tâches, variables et accès à distance', { fiches: ['win-tache-planifiee', 'win-variable-environnement', 'win-path-ajouter', 'win-bureau-distance-activer', 'win-ssh-client-installer', 'win-heure-synchroniser'] }),
    F('langue', 'Clavier, langue et format régional', { fiches: ['win-langue-voir', 'win-clavier-fixer', 'win-clavier-raccourci', 'win-region-format'] }),
    F('comptes-locaux', 'Comptes locaux (en commande)', { fiches: ['win-local-changer-mot-de-passe', 'win-local-admin-ajouter', 'win-local-desactiver'] }),
  ],
  'analyse-disques': [
    F('occupation', 'Occupation de l’espace', { sub: ['Occupation de l’espace'] }),
  ],
  'windows-server': [
    F('fichiers', 'Fichiers et partages', { sub: ['Serveur de fichiers'] }),
    F('dhcp', 'DHCP', { sub: ['DHCP'] }),
    F('dns', 'DNS', { sub: ['DNS'] }),
    F('stockage', 'Disques, quotas, miroir et sauvegarde', { fiches: ['win-disque-ajouter', 'win-quota-fsrm', 'win-sauvegarde-planifier', 'win-miroir-raid1'] }),
    F('examen', 'Examen Windows Server 2022 (plan et script)', { fiches: ['win-examen-parcours', 'win-script-utilisateur-partage'] }),
    F('routage', 'Routage et accès Internet', { sub: ['Routage et accès Internet'] }),
    F('maintenance', 'Diagnostic et maintenance', { sub: ['Diagnostic serveur'] }),
  ],
  'active-directory': [
    F('sante', 'Santé du domaine et contrôleurs', { sub: ['Santé du domaine', 'Contrôleurs de domaine'] }),
    F('utilisateurs', 'Utilisateurs, groupes et comptes', { sub: ['Utilisateurs', 'Utilisateurs et groupes', 'Cycle de vie des comptes'] }),
    F('ou', 'Unités d’organisation', { sub: ['Unités organisationnelles', 'Structure et OU'] }),
    F('maintenance', 'Maintenance des objets', { sub: ['Maintenance des objets'] }),
    F('rsat', 'Outils d’administration à distance (RSAT)', { fiches: ['cours-rsat-windows'] }),
    F('session-domaine', 'Ouvrir une session de domaine (poste Windows)', { fiches: ['cours-windows-connexion-domaine'] }),
    F('consultation', 'Consulter le domaine (en commande)', { fiches: ['win-ad-membres-groupe', 'win-ad-infos-utilisateur', 'win-ad-trouver-ordinateur', 'win-ad-controleur-connecte', 'win-ad-mot-de-passe-age'] }),
  ],
  gpo: [
    F('diagnostic', 'Diagnostic et inventaire', { sub: ['Diagnostic et inventaire'] }),
    F('creation', 'Création, liens et ciblage', { sub: ['Création, liens et ciblage'] }),
    F('utilisateur', 'Environnement utilisateur', { sub: ['Environnement utilisateur'] }),
    F('securite', 'Sécurité', { sub: ['Sécurité des postes et serveurs', 'Sécurité des comptes'] }),
    F('deploiement', 'Déploiement et maintenance', { sub: ['Déploiement et maintenance'] }),
  ],
  reseau: [
    F('adressage', 'Adressage et vue d’ensemble', { sub: ['Adressage IP', 'Vue d’ensemble'] }),
    F('connectivite', 'Connectivité IP', { sub: ['Connectivité IP'] }),
    F('noms', 'Résolution de noms', { sub: ['Résolution de noms'] }),
    F('ports', 'Ports et protocoles', { sub: ['Ports et protocoles'] }),
    F('routes', 'Routage et voisinage', { sub: ['Routage et voisinage'] }),
    F('acces', 'Accès aux ressources', { sub: ['Accès aux ressources'] }),
    F('wifi', 'Wi-Fi et VPN', { sub: ['Wi-Fi et VPN'] }),
    F('calculs', 'Calculs réseau', { sub: ['Calculs réseau'] }),
    F('poste-windows', 'Outils réseau du poste Windows', { fiches: ['win-dns-poste-regler', 'win-cache-arp', 'win-cache-netbios', 'win-ipconfig-complet', 'win-ip-liberer', 'win-tracert', 'win-pathping', 'win-winsock-reinit', 'win-route-voir', 'win-arp-voir', 'win-wifi-profils', 'win-pare-feu-etat', 'win-pare-feu-ouvrir-port', 'win-pare-feu-fermer-port'] }),
  ],
  imprimantes: [
    F('diagnostic', 'Diagnostic et inventaire', { sub: ['Inventaire et diagnostic Windows'] }),
    F('configuration', 'Configuration', { sub: ['Configuration Windows'] }),
    F('partage', 'Partage et connexion réseau', { sub: ['Réseau et files partagées'] }),
    F('files', 'Travaux et files bloquées', { sub: ['Déblocage ciblé Windows'] }),
    F('cups', 'Linux et CUPS', { sub: ['Linux et CUPS'] }),
  ],
  linux: [
    F('diagnostic', 'Diagnostic général', { sub: ['Diagnostic Linux'] }),
    F('fichiers', 'Fichiers et dossiers', { sujets: [
      F('reperer', 'Se repérer et inspecter', { fiches: ['cours-se-reperer', 'cours-identifier-fichier'] }),
      F('manipuler', 'Créer, copier, déplacer, supprimer', { fiches: ['cours-creer-dossiers-fichiers', 'cours-copier-deplacer', 'cours-supprimer-prudemment', 'cours-liens', 'cours-droits-fichier'] }),
      F('archives', 'Archiver et compresser', { fiches: ['cours-archives', 'cours-gzip-fichier'] }),
      F('localiser', 'Trouver une commande ou un fichier', { fiches: ['cours-trouver-commande'] }),
    ] }),
    F('texte', 'Lire, chercher et filtrer du texte', { fiches: ['cours-lire-fichiers', 'cours-grep-wc', 'cours-find-fichiers', 'cours-redirections-tubes', 'cours-comparer-trier', 'linux-sed-remplacer', 'linux-sed-lignes', 'linux-csv-verifier', 'linux-csv-colonne', 'linux-fins-ligne-windows'] }),
    F('services', 'Services, paquets et heure', { sujets: [
      F('systemd', 'Services systemd', { hotes: ['systemd-service-diagnostic', 'systemd-service-control'], fiches: ['cours-service-ancien'] }),
      F('processus', 'Processus, état du système et arrêt', { fiches: ['cours-processus', 'cours-etat-systeme', 'cours-arret-redemarrage'] }),
      F('planification', 'Tâches planifiées', { fiches: ['cours-planifier-taches'] }),
      F('paquets', 'Paquets', { hotes: ['linux-package-diagnostic'] }),
      F('heure', 'Heure et NTP', { hotes: ['linux-time-sync-diagnostic'] }),
      F('identite', 'Nom et identité de la machine', { fiches: ['linux-hostname-changer', 'linux-systeme-identite'] }),
      F('clavier', 'Clavier et langue', { fiches: ['linux-clavier-voir', 'linux-clavier-changer', 'linux-clavier-session', 'linux-langue-systeme'] }),
    ] }),
    F('utilisateurs', 'Utilisateurs et permissions', { sujets: [
      F('permissions', 'Permissions et ACL', { hotes: ['linux-permission-audit', 'linux-permission-change', 'linux-permission-acl'] }),
      F('comptes', 'Comptes locaux', { hotes: ['linux-user-audit', 'linux-user-create'], fiches: ['cours-creer-compte-local', 'cours-sessions-utilisateurs', 'cours-supprimer-compte-local', 'linux-comptes-locaux-lister', 'linux-groupes-locaux-lister', 'linux-sudo-su-expliquer', 'linux-mot-de-passe-local'] }),
    ] }),
    F('stockage', 'Stockage', { sujets: [
      F('disques', 'Disques, partitions et montages', { hotes: ['linux-storage-diagnostic', 'linux-disk-partition-mount'] }),
      F('raid', 'RAID', { hotes: ['linux-raid1-create', 'linux-raid-member-manage'] }),
      F('quotas', 'Quotas', { hotes: ['linux-quota-enable', 'linux-quota-limits'] }),
    ] }),
    F('reseau', 'Réseau', { sujets: [
      F('adresse-route', 'Adresse, route et résolution', { hotes: ['linux-network-diagnostic', 'linux-dns-diagnostic'] }),
      F('netplan', 'Netplan', { hotes: ['netplan-readiness'] }),
      F('pare-feu', 'Pare-feu', { hotes: ['linux-firewall-audit'] }),
    ] }),
    F('acces-distant', 'Accès distant', { sujets: [
      F('ssh', 'SSH', { hotes: ['ssh-server-readiness', 'ssh-client-diagnostic', 'ssh-key-readiness', 'ssh-hardening-audit'], fiches: ['linux-ssh-client-installer'] }),
      F('cockpit', 'Cockpit', { hotes: ['cockpit-install-readiness', 'cockpit-connection-diagnostic'] }),
    ] }),
    F('partages', 'Partages de fichiers', { sujets: [
      F('samba', 'Samba / SMB', {
        hotes: ['samba-readiness', 'samba-share-create', 'samba-diagnostic'],
        sections: [
          { id: 'prerequis', titre: 'Prérequis et configuration', hotes: ['samba-readiness'] },
          { id: 'partage', titre: 'Créer un partage et régler ses permissions', hotes: ['samba-share-create'] },
          { id: 'diagnostic', titre: 'Diagnostic et connexion d’un client', hotes: ['samba-diagnostic'] },
        ],
        prevu: 'Pas encore réalisé (SAMBA-ADV-01) : les ASSISTANTS guidés (script généré, garde, validation) pour la gestion des groupes avec samba-tool et pour les transferts smbclient. Des fiches pas à pas rédigées à la main existent (COURS-TP2-01) ; ce ne sont pas des assistants et elles n’ont pas été exécutées sur une machine réelle.',
      }),
      F('nfs', 'NFS', { hotes: ['nfs-server-readiness', 'nfs-export-create'] }),
    ] }),
    F('annuaire', 'Domaine et annuaire (Samba Active Directory)', { sub: ['Samba AD'] }),
    F('bash', 'Bash et automatisation', { sub: ['Bash et automatisation'], fiches: ['cours-bash-condition', 'cours-bash-boucles', 'cours-bash-fonctions', 'cours-bash-menu', 'cours-afficher-texte'] }),
  ],
  'azure-entra': [
    F('acces', 'Connexion, contexte et accès', { sub: ['Connexion, contexte et accès'], fiches: ['cours-az-groupe-ressources', 'cours-az-verrou-ressource', 'cours-az-role-coequipier'] }),
    F('identites', 'Identités (Entra ID)', { sub: ['Microsoft Entra ID'] }),
    F('vm', 'Machines virtuelles', { sub: ['Machines virtuelles'] }),
    F('reseau', 'Réseau Azure', { sub: ['Réseau Azure'], fiches: ['cours-az-vnet-creer', 'cours-az-sous-reseau-ajouter', 'cours-az-plan-adressage', 'cours-az-ip-publique-privee', 'cours-az-vm-creer-vnet', 'cours-az-dns-zone-publique', 'cours-az-dns-enregistrement-a', 'cours-az-dns-zone-privee'] }),
    F('peering-routage', 'Peering, routage et accès privé', { fiches: ['cours-az-peering-creer', 'cours-az-peering-verifier', 'cours-az-routes-effectives', 'cours-az-route-personnalisee', 'cours-az-point-prive-stockage'] }),
    F('equilibrage', 'Équilibrage de charge', { fiches: ['cours-az-lb-creer', 'cours-az-lb-etat'] }),
    F('stockage', 'Stockage et protection', { sub: ['Stockage et protection'] }),
    F('surveillance', 'Surveillance et coûts', { sub: ['Surveillance et coûts'] }),
  ],
  'reseau-cisco': [
    F('acces', 'Accès et configuration', { sub: ['Modes, identification et accès', 'Configuration et sauvegarde'], fiches: ['cours-config-portable'] }),
    F('interfaces', 'Interfaces et port-security', { sub: ['Interfaces, MAC et port-security'], fiches: ['cours-sw-duplex-vitesse', 'cours-sw-diagnostiquer-port', 'cours-sw-ports-inutilises'] }),
    F('vlan', 'VLAN et ports d’accès', { sub: ['VLAN et ports d’accès'] }),
    F('trunks', 'Trunks, DTP et VTP', { sub: ['Trunks et DTP', 'VTP et diagnostic'], fiches: ['cours-vtp-transparent-etendus'] }),
    F('commutation', 'EtherChannel et Spanning Tree', { fiches: ['cours-ec-avant-de-grouper', 'cours-ec-pagp', 'cours-ec-lacp', 'cours-ec-statique', 'cours-ec-verifier', 'cours-ec-depanner', 'cours-stp-lire', 'cours-stp-racines', 'cours-stp-portfast-bpduguard'] }),
    F('routage', 'Routage', { fiches: ['cours-rt-interface-ip', 'cours-rt-statique', 'cours-rt-defaut-flottante', 'cours-rt-tester', 'cours-rip-configurer', 'cours-rip-verifier'] }),
  ],
};

// ---------------------------------------------------------------------------
// Résolution
// ---------------------------------------------------------------------------

/**
 * Cette entrée est-elle placée DIRECTEMENT (sans assistant hôte) ? Vrai pour
 * les entrées de DIRECT et pour celles que la liste `fiches` d'une famille ou
 * d'un sujet nomme. C'est la seule dérogation à la règle « chaque fiche suit
 * son hôte » ; le banc de classement la vérifie nommément.
 */
export function estPlaceDirect(id) {
  if (DIRECT[id]) return true;
  const visite = (n) => Boolean(n.fiches?.includes(id)) || (n.sujets ?? []).some(visite);
  return Object.values(ARBRE).some((familles) => familles.some(visite));
}

/** Sujet ou famille par identifiants, ou null. */
export function noeud(domaineId, familleId = null, sujetId = null) {
  const familles = ARBRE[domaineId];
  if (!familles) return null;
  if (!familleId) return { domaineId, familles };
  const famille = familles.find((f) => f.id === familleId);
  if (!famille) return null;
  if (!sujetId) return { domaineId, famille };
  const sujet = (famille.sujets ?? []).find((s) => s.id === sujetId);
  return sujet ? { domaineId, famille, sujet } : null;
}

/** Le niveau terminal (là où l'on liste des tâches) : un sujet, sinon la famille. */
export function estFeuille(n) {
  if (n.sujet) return true;
  if (n.famille) return !(n.famille.sujets?.length);
  return false;
}

const parId = new Map();
let domaineParNom = null;

/** À appeler une fois avec les catégories et les entrées (évite tout cycle d'import). */
export function initialiser(categories, entrees) {
  domaineParNom = new Map(categories.map((c) => [c.name, c.id]));
  parId.clear();
  for (const e of entrees) parId.set(e.id, e);
  return true;
}

/** Hôte d'une entrée : l'assistant dont elle dépend (lui-même pour un assistant). */
export function hoteDe(entree) {
  if (entree.kind === 'assistant') return entree.id;
  return entree.hote ?? HOTE_PROCEDURE[entree.id] ?? null;
}

function sousCategorieDe(hote) {
  const h = parId.get(hote);
  return h?.tool?.subcategory ?? null;
}

function correspond(noeudDef, hote, sub, id = null) {
  if (id && noeudDef.fiches?.includes(id)) return true;
  if (noeudDef.hotes?.includes(hote)) return true;
  if (noeudDef.sub && sub && noeudDef.sub.includes(sub)) return true;
  return false;
}

/**
 * Chemin de classement d'une entrée : domaine, famille, sujet, section.
 * Retourne null si rien ne correspond (le banc l'interdit).
 */
export function cheminDe(entree) {
  const domaineId = domaineParNom?.get(entree.categorie);
  if (!domaineId) return null;
  const familles = ARBRE[domaineId] ?? [];
  const direct = DIRECT[entree.id];
  if (direct && direct[0] === domaineId) {
    const f = familles.find((x) => x.id === direct[1]);
    return f ? { domaineId, famille: f, sujet: null, section: null } : null;
  }
  const hote = hoteDe(entree);
  const sub = hote ? sousCategorieDe(hote) : null;
  for (const f of familles) {
    if (f.sujets) {
      const s = f.sujets.find((x) => correspond(x, hote, sub, entree.id));
      if (s) {
        const section = s.sections?.find((x) => x.fiches?.includes(entree.id) || x.hotes?.includes(hote)) ?? null;
        return { domaineId, famille: f, sujet: s, section };
      }
    } else if (correspond(f, hote, sub, entree.id)) {
      return { domaineId, famille: f, sujet: null, section: null };
    }
  }
  return null;
}

/** Route directe vers une rubrique. */
export function routeRubrique(domaineId, familleId = null, sujetId = null) {
  return `#/rubrique/${[domaineId, familleId, sujetId].filter(Boolean).join('/')}`;
}

/**
 * Décode #/rubrique/<d>[/<f>[/<s>]] (tâches) ou #/assistants/<d>[/<f>[/<s>]]
 * (assistants seuls) ; null si un identifiant est inconnu.
 */
export function lireRoute(hash) {
  const m = /^#\/(rubrique|assistants)\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?(?:\/([A-Za-z0-9_-]+))?$/.exec(hash || '');
  if (!m) return null;
  const n = noeud(m[2], m[3] ?? null, m[4] ?? null);
  return n ? { assistants: m[1] === 'assistants', domaineId: m[2], familleId: m[3] ?? null, sujetId: m[4] ?? null } : null;
}

/** Route d'une rubrique dans la vue des tâches ou dans celle des assistants. */
export function routePortee({ assistants = false, domaineId = null, familleId = null, sujetId = null } = {}) {
  if (!domaineId) return assistants ? '#/assistants' : '#/';
  const suite = [domaineId, familleId, sujetId].filter(Boolean).join('/');
  return `${assistants ? '#/assistants' : '#/rubrique'}/${suite}`;
}

export function domaineIdDe(nom) { return domaineParNom?.get(nom) ?? null; }
export function domaineNomDe(id) {
  for (const [nom, i] of domaineParNom ?? []) if (i === id) return nom;
  return null;
}

/** L'entrée appartient-elle à la famille / au sujet demandé ? (sans niveau : toujours vrai) */
export function dans(entree, { familleId = null, sujetId = null } = {}) {
  if (!familleId) return true;
  const c = cheminDe(entree);
  return Boolean(c) && c.famille.id === familleId && (!sujetId || c.sujet?.id === sujetId);
}

/** Les enfants d'un nœud, avec leur nombre d'entrées dans `liste`. */
export function enfants(liste, domaineId, familleId = null) {
  const n = noeud(domaineId, familleId);
  if (!n) return [];
  const defs = familleId ? (n.famille.sujets ?? []) : n.familles;
  return defs.map((d) => {
    const compte = liste.filter((e) => {
      const c = cheminDe(e);
      if (!c || c.domaineId !== domaineId) return false;
      return familleId ? c.sujet?.id === d.id && c.famille.id === familleId : c.famille.id === d.id;
    }).length;
    return { def: d, compte };
  });
}

/**
 * Fil d'Ariane d'une entrée, du domaine à la rubrique la plus fine.
 * Chaque maillon porte son nom et sa route.
 */
export function filDeEntree(entree, nomDomaine) {
  const c = cheminDe(entree);
  if (!c) return [];
  const fil = [{ nom: nomDomaine ?? entree.categorie, route: routeRubrique(c.domaineId) }];
  fil.push({ nom: c.famille.nom, route: routeRubrique(c.domaineId, c.famille.id) });
  if (c.sujet) fil.push({ nom: c.sujet.nom, route: routeRubrique(c.domaineId, c.famille.id, c.sujet.id) });
  return fil;
}

/**
 * Ordre de lecture à l'intérieur d'une liste : par tâche (hôte), puis par type.
 * Une procédure, ses commandes rapides et son assistant se suivent donc.
 */
const RANG_TYPE = { procedure: 0, scenario: 0, commande: 1, assistant: 2 };
export function comparer(a, b, ordreHotes = []) {
  const ha = hoteDe(a); const hb = hoteDe(b);
  if (ha !== hb) {
    const ia = ordreHotes.indexOf(ha); const ib = ordreHotes.indexOf(hb);
    if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    const ta = parId.get(ha)?.titre ?? ''; const tb = parId.get(hb)?.titre ?? '';
    const r = ta.localeCompare(tb, 'fr');
    if (r) return r;
  }
  const r = (RANG_TYPE[a.kind] ?? 3) - (RANG_TYPE[b.kind] ?? 3);
  return r || (a.titre ?? '').localeCompare(b.titre ?? '', 'fr');
}
