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
      { id: 'modifier', titre: 'Modifier, corriger, vérifier un fichier', fiches: ['linux-sed-remplacer', 'linux-sed-lignes', 'linux-csv-verifier', 'linux-csv-colonne', 'linux-fins-ligne-windows'] },
    ] },
  { id: 'comptes', titre: 'Comptes et droits', icone: '👤', couleur: '#db2777', commandes: 'useradd, chmod, chown',
    resume: 'Comptes et groupes locaux, sessions ouvertes, droits d’un dossier.',
    sous: [
      { id: 'locaux', titre: 'Comptes et groupes locaux', fiches: ['cours-creer-compte-local', 'cours-groupes-locaux', 'cours-sessions-utilisateurs', 'cours-supprimer-compte-local'] },
      { id: 'retrouver', titre: 'Lister les comptes, les groupes et changer un mot de passe', fiches: ['linux-comptes-locaux-lister', 'linux-groupes-locaux-lister', 'linux-mot-de-passe-local'] },
      { id: 'droits', titre: 'Droits d’un dossier', fiches: ['cours-droits-dossier-partage', 'cours-donner-dossier-compte'] },
    ] },
  { id: 'services', titre: 'Services et processus', icone: '⚙', couleur: '#ea580c', commandes: 'systemctl, ps, kill, at',
    resume: 'Services, processus, état de la machine, arrêt, tâches planifiées.',
    sous: [
      { id: 'services', titre: 'Services', fiches: ['cours-service-ancien'] },
      { id: 'processus', titre: 'Processus, état et arrêt', fiches: ['cours-processus', 'cours-etat-systeme', 'cours-arret-redemarrage'] },
      { id: 'planifier', titre: 'Tâches planifiées', fiches: ['cours-planifier-taches'] },
      { id: 'identite', titre: 'Nom et identité de la machine', fiches: ['linux-hostname-changer', 'linux-systeme-identite'] },
      { id: 'clavier', titre: 'Clavier et langue', fiches: ['linux-clavier-voir', 'linux-clavier-changer', 'linux-clavier-session', 'linux-langue-systeme'] },
    ] },
  { id: 'reseau', titre: 'Réseau', icone: '🌐', couleur: '#0891b2', commandes: 'ip, ping, netplan',
    resume: 'Adresse et carte réseau d’un poste.',
    sous: [
      { id: 'poste', titre: 'Carte réseau d’un poste', fiches: ['cours-ubuntu-reseau-client', 'cours-ifconfig-ancien'] },
      { id: 'ssh', titre: 'Se connecter à distance (SSH)', fiches: ['linux-ssh-client-installer'] },
      { id: 'tester', titre: 'Tester et résoudre un nom (Windows et Linux)', fiches: ['tester-ping', 'resoudre-nom-dns', 'vider-cache-dns'] },
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
      { id: 'comptes', titre: 'Comptes et groupes du domaine', fiches: ['cours-samba-groupes', 'cours-samba-script-menu', 'cours-samba-import-csv', 'samba-compte-voir', 'samba-mot-de-passe'] },
      { id: 'partages', titre: 'Partages', fiches: ['cours-samba-partage-utilisateurs', 'cours-samba-partage-groupe', 'cours-samba-connexions'] },
      { id: 'clients', titre: 'Postes clients', fiches: ['cours-smbclient-transferts', 'cours-ubuntu-acces-partage', 'cours-windows-acces-partage', 'cours-windows-connexion-domaine'] },
      { id: 'domaine', titre: 'Domaine, DNS et outils', fiches: ['samba-ad-installer', 'cours-samba-dns', 'cours-ubuntu-jonction-ad', 'cours-ubuntu-jonction-ad-graphique', 'cours-rsat-windows'] },
    ] },
  // Groupes Windows (KJEMO-UX-MEMO-WINDOWS-01) : uniquement des fiches à commande directe (les assistants complets restent dans le catalogue pro).
  { id: 'win-poste', titre: 'Poste Windows', icone: '🖥', couleur: '#1d4ed8', commandes: 'Get-Service, sfc, Get-LocalUser',
    resume: 'Services, journaux, réparation, disque, comptes locaux et imprimantes d’un poste Windows.',
    sous: [
      { id: 'services', titre: 'Services et journaux', fiches: ['windows-etat-service', 'redemarrer-service-windows', 'journal-evenements-windows'] },
      { id: 'reparer', titre: 'Réparer et surveiller', fiches: ['reparer-fichiers-systeme', 'espace-disque-windows'] },
      { id: 'caches', titre: 'Vider les caches', fiches: ['win-cache-identifiants', 'win-cache-store', 'win-cache-windows-update', 'win-presse-papiers', 'win-kerberos-purger', 'win-cache-arp', 'win-cache-netbios'] },
      { id: 'locaux', titre: 'Comptes locaux', fiches: ['win-local-voir-comptes', 'win-local-creer-utilisateur', 'win-local-changer-mot-de-passe', 'win-local-admin-ajouter', 'win-local-desactiver'] },
      { id: 'imprimantes', titre: 'Imprimantes', fiches: ['imprimantes-inventaire-windows', 'imprimante-file-bloquee'] },
    ] },
  { id: 'win-systeme', titre: 'Système, processus et arrêt', icone: '🧰', couleur: '#0f766e', commandes: 'systeminfo, Get-Process, shutdown, schtasks',
    resume: 'Informations sur le poste, processus, arrêt et sessions, tâches planifiées, variables, Bureau à distance et heure.',
    sous: [
      { id: 'infos', titre: 'Informations sur le poste', fiches: ['win-systeme-resume', 'win-version-windows', 'win-uptime', 'win-nom-poste-utilisateur', 'win-renommer-poste', 'win-whoami-groupes', 'win-licence-activation', 'win-bitlocker-etat'] },
      { id: 'processus', titre: 'Processus, arrêt et sessions', fiches: ['win-processus-trouver', 'win-processus-gourmands', 'win-processus-fermer', 'win-arret-redemarrage', 'win-arret-annuler', 'win-sessions-fermer'] },
      { id: 'reglages', titre: 'Tâches, variables et accès à distance', fiches: ['win-tache-planifiee', 'win-variable-environnement', 'win-path-ajouter', 'win-bureau-distance-activer', 'win-ssh-client-installer', 'win-heure-synchroniser'] },
      { id: 'langue', titre: 'Clavier, langue et format régional', fiches: ['win-langue-voir', 'win-clavier-fixer', 'win-clavier-raccourci', 'win-region-format'] },
    ] },
  { id: 'win-fichiers', titre: 'Disque, fichiers et logiciels', icone: '📂', couleur: '#a16207', commandes: 'robocopy, Get-FileHash, takeown, winget',
    resume: 'Vérifier un disque, copier, chercher, compresser, reprendre un dossier, installer et mettre à jour des logiciels.',
    sous: [
      { id: 'fichiers', titre: 'Disque, fichiers, archives et droits', fiches: ['win-disque-verifier', 'win-robocopy-copier', 'win-fichier-chercher', 'win-fichier-empreinte', 'win-archive-creer', 'win-archive-extraire', 'win-droits-prendre-possession'] },
      { id: 'logiciels', titre: 'Logiciels et correctifs', fiches: ['win-winget-installer', 'win-winget-mettre-a-jour', 'win-correctifs-installes'] },
    ] },
  { id: 'win-reseau', titre: 'Réseau Windows', icone: '🛜', couleur: '#0369a1', commandes: 'ipconfig, Test-NetConnection, netstat',
    resume: 'Voir et fixer l’adresse IP, renouveler le bail DHCP, tester un port, voir les ports en écoute.',
    sous: [
      { id: 'adresse', titre: 'Adresse IP', fiches: ['windows-voir-ip', 'win-ipconfig-complet', 'windows-ip-fixe', 'renouveler-bail-dhcp', 'win-ip-liberer', 'win-wifi-profils'] },
      { id: 'tester', titre: 'Tester et diagnostiquer', fiches: ['tester-port-tcp', 'win-tracert', 'win-pathping', 'windows-ports-ecoute', 'scenario-windows-diagnostic-reseau'] },
      { id: 'tables', titre: 'Routes et voisins', fiches: ['win-route-voir', 'win-arp-voir'] },
      { id: 'pare-feu', titre: 'Pare-feu', fiches: ['win-pare-feu-etat', 'win-pare-feu-ouvrir-port', 'win-pare-feu-fermer-port'] },
      { id: 'reparer', titre: 'Réparer la pile réseau', fiches: ['win-winsock-reinit'] },
    ] },
  { id: 'win-ad', titre: 'Active Directory', icone: '🏛', couleur: '#6d28d9', commandes: 'New-ADUser, New-ADOrganizationalUnit, Add-Computer',
    resume: 'Voir et créer des OU, des comptes et des groupes ; dépanner un compte ; joindre un poste au domaine.',
    sous: [
      { id: 'lire', titre: 'Voir le domaine', fiches: ['win-ad-voir-ou', 'win-ad-voir-utilisateurs', 'win-ad-membres-groupe', 'win-ad-infos-utilisateur', 'win-ad-trouver-ordinateur', 'win-ad-controleur-connecte', 'win-ad-mot-de-passe-age'] },
      { id: 'creer', titre: 'Créer OU, comptes et groupes', fiches: ['win-ad-creer-ou', 'win-ad-creer-utilisateur', 'win-ad-creer-groupe', 'win-ad-ajouter-membre'] },
      { id: 'comptes', titre: 'Dépanner et gérer un compte', fiches: ['ad-debloquer-compte', 'win-ad-reinit-mot-de-passe', 'win-ad-desactiver-compte', 'win-ad-deplacer-objet'] },
      { id: 'domaine', titre: 'Poste et domaine', fiches: ['win-ad-joindre-domaine', 'ad-etat-replication'] },
    ] },
  { id: 'win-gpo', titre: 'Stratégies de groupe (GPO)', icone: '📋', couleur: '#be123c', commandes: 'gpupdate, gpresult, New-GPO',
    resume: 'Lister les GPO, en créer une et la lier à une OU, forcer et vérifier son application.',
    sous: [
      { id: 'voir', titre: 'Voir', fiches: ['win-gpo-lister', 'win-gpo-resultat'] },
      { id: 'agir', titre: 'Créer, lier, appliquer', fiches: ['win-gpo-creer-lier', 'appliquer-strategies-groupe'] },
    ] },
  { id: 'win-serveur', titre: 'Windows Server : DHCP, DNS, partages', icone: '🗄', couleur: '#b45309', commandes: 'Add-DhcpServerv4Scope, Add-DnsServerPrimaryZone, New-SmbShare',
    resume: 'Serveur DHCP, zones et enregistrements DNS, dossiers partagés et leurs droits.',
    sous: [
      { id: 'dhcp', titre: 'DHCP', fiches: ['win-dhcp-installer', 'win-dhcp-etendue', 'win-dhcp-reservation', 'win-dhcp-baux'] },
      { id: 'dns', titre: 'DNS', fiches: ['win-dns-zone-directe', 'win-dns-zone-inverse', 'win-dns-enregistrement-a'] },
      { id: 'partages', titre: 'Partages et droits', fiches: ['win-partage-creer', 'win-partage-ntfs', 'win-partage-voir', 'win-partage-connecter'] },
    ] },
  { id: 'cisco-adressage-routage', titre: 'Adressage et routage Cisco', icone: '🧭', couleur: '#b45309', commandes: 'ip address, ip route, router rip, ping',
    resume: 'Adresser les interfaces, écrire des routes statiques (par défaut, flottantes), tester, puis RIPv2.',
    sous: [
      { id: 'interfaces', titre: 'Adresses et interfaces', fiches: ['cours-rt-interface-ip', 'cours-sw-gestion-ip'] },
      { id: 'statique', titre: 'Routes statiques et tests', fiches: ['cours-rt-statique', 'cours-rt-defaut-flottante', 'cours-rt-tester'] },
      { id: 'rip', titre: 'Routage dynamique RIP', fiches: ['cours-rip-configurer', 'cours-rip-verifier'] },
    ] },
  { id: 'cisco-acces-ports', titre: 'Accès et ports du commutateur', icone: '🔐', couleur: '#9333ea', commandes: 'hostname, speed, duplex, port-security',
    resume: 'Configuration de base, vitesse et duplex, diagnostic d’un port, ports inutilisés, sécurité des ports, sauvegarde.',
    sous: [
      { id: 'base', titre: 'Configuration de base et sauvegarde', fiches: ['cours-base-peripherique', 'cours-config-portable'] },
      { id: 'ports', titre: 'Ports : vitesse, diagnostic, inutilisés', fiches: ['cours-sw-duplex-vitesse', 'cours-sw-diagnostiquer-port', 'cours-sw-ports-inutilises'] },
      { id: 'securite', titre: 'Sécurité des ports', fiches: ['cours-sw-portsec'] },
    ] },
  { id: 'cisco-vlan-vtp', titre: 'VLAN, VTP et DTP', icone: '🏷', couleur: '#be185d', commandes: 'vtp mode, vtp domain, switchport mode',
    resume: 'Distribuer les VLAN avec VTP, créer des VLAN étendus, négocier les trunks avec DTP, dépanner.',
    sous: [
      { id: 'vtp', titre: 'VTP et VLAN étendus', fiches: ['cours-vtp-reseau', 'cours-vtp-transparent-etendus'] },
      { id: 'dtp', titre: 'DTP et trunks', fiches: ['cours-dtp-trunk'] },
      { id: 'depanner', titre: 'Dépanner VTP et DTP', fiches: ['cours-vtp-dtp-depanner'] },
    ] },
  // Groupes Azure (KJEMO-AZURE-COURS-01) : fiches de construction en Azure CLI ; les assistants de lecture restent dans le catalogue pro.
  { id: 'az-base', titre: 'Azure : abonnement et groupes', icone: '☁', couleur: '#0369a1', commandes: 'az group create, az lock create, az role assignment create',
    resume: 'Un groupe de ressources par laboratoire, un verrou contre la suppression, un rôle pour un coéquipier.',
    sous: [
      { id: 'organiser', titre: 'Organiser et protéger', fiches: ['cours-az-groupe-ressources', 'cours-az-verrou-ressource'] },
      { id: 'acces', titre: 'Partager l’accès', fiches: ['cours-az-role-coequipier'] },
    ] },
  { id: 'az-reseau', titre: 'Azure : réseau virtuel et DNS', icone: '🕸', couleur: '#0e7490', commandes: 'az network vnet create, az vm create, az network dns zone create',
    resume: 'Créer un VNet et ses sous-réseaux, relire le plan d’adressage, les adresses IP, une machine, puis le DNS public et privé.',
    sous: [
      { id: 'vnet', titre: 'Réseau virtuel et adresses', fiches: ['cours-az-vnet-creer', 'cours-az-sous-reseau-ajouter', 'cours-az-plan-adressage', 'cours-az-ip-publique-privee', 'cours-az-vm-creer-vnet'] },
      { id: 'dns', titre: 'DNS public et privé', fiches: ['cours-az-dns-zone-publique', 'cours-az-dns-enregistrement-a', 'cours-az-dns-zone-privee'] },
    ] },
  { id: 'az-routage-prive', titre: 'Azure : peering, routes et accès privé', icone: '🔗', couleur: '#6d28d9', commandes: 'az network vnet peering create, az network route-table create, az network private-endpoint create',
    resume: 'Appairer deux VNet, lire et créer des routes, limiter ou isoler un compte de stockage.',
    sous: [
      { id: 'peering', titre: 'Peering', fiches: ['cours-az-peering-creer', 'cours-az-peering-verifier'] },
      { id: 'routes', titre: 'Routes', fiches: ['cours-az-routes-effectives', 'cours-az-route-personnalisee'] },
      { id: 'prive', titre: 'Accès privé au stockage', fiches: ['cours-az-point-service-stockage', 'cours-az-point-prive-stockage'] },
    ] },
  { id: 'az-equilibrage', titre: 'Azure : équilibrage de charge', icone: '⚖', couleur: '#b45309', commandes: 'az network lb create, az network lb probe create',
    resume: 'Créer un Azure Load Balancer public avec sa sonde et sa règle, puis lire sa configuration.',
    sous: [
      { id: 'lb', titre: 'Azure Load Balancer', fiches: ['cours-az-lb-creer', 'cours-az-lb-etat'] },
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
).concat(
  ['cours-base-peripherique', 'cours-sw-gestion-ip', 'cours-sw-duplex-vitesse', 'cours-sw-diagnostiquer-port', 'cours-sw-ports-inutilises', 'cours-sw-portsec',
    'cours-config-portable', 'cours-rt-interface-ip', 'cours-rt-statique', 'cours-rt-defaut-flottante', 'cours-rt-tester', 'cours-rip-configurer', 'cours-rip-verifier',
    'cours-vtp-reseau', 'cours-vtp-transparent-etendus', 'cours-dtp-trunk', 'cours-vtp-dtp-depanner'].map((id) => [id, '2026-10-28']),
).concat(
  ['win-local-voir-comptes', 'win-local-creer-utilisateur', 'win-ad-voir-ou', 'win-ad-voir-utilisateurs', 'win-ad-creer-ou', 'win-ad-creer-utilisateur', 'win-ad-creer-groupe', 'win-ad-ajouter-membre', 'win-ad-reinit-mot-de-passe', 'win-ad-desactiver-compte', 'win-ad-deplacer-objet', 'win-ad-joindre-domaine', 'win-gpo-lister', 'win-gpo-resultat', 'win-gpo-creer-lier', 'win-dhcp-installer', 'win-dhcp-etendue', 'win-dhcp-reservation', 'win-dhcp-baux', 'win-dns-zone-directe', 'win-dns-zone-inverse', 'win-dns-enregistrement-a', 'win-partage-creer', 'win-partage-ntfs', 'win-partage-voir', 'win-partage-connecter'].map((id) => [id, '2026-10-28']),
).concat(
  ['cours-az-groupe-ressources', 'cours-az-verrou-ressource', 'cours-az-role-coequipier', 'cours-az-vnet-creer', 'cours-az-sous-reseau-ajouter', 'cours-az-plan-adressage', 'cours-az-ip-publique-privee', 'cours-az-vm-creer-vnet', 'cours-az-dns-zone-publique', 'cours-az-dns-enregistrement-a', 'cours-az-dns-zone-privee', 'cours-az-peering-creer', 'cours-az-peering-verifier', 'cours-az-routes-effectives', 'cours-az-route-personnalisee', 'cours-az-point-service-stockage', 'cours-az-point-prive-stockage', 'cours-az-lb-creer', 'cours-az-lb-etat'].map((id) => [id, '2026-10-28']),
  ['win-cache-arp', 'win-cache-netbios', 'win-ipconfig-complet', 'win-ip-liberer', 'win-tracert', 'win-pathping', 'win-winsock-reinit', 'win-route-voir', 'win-arp-voir', 'win-wifi-profils', 'win-pare-feu-etat', 'win-pare-feu-ouvrir-port', 'win-pare-feu-fermer-port', 'win-cache-identifiants', 'win-cache-store', 'win-cache-windows-update', 'win-presse-papiers', 'win-kerberos-purger', 'win-systeme-resume', 'win-version-windows', 'win-uptime', 'win-nom-poste-utilisateur', 'win-renommer-poste', 'win-whoami-groupes', 'win-licence-activation', 'win-bitlocker-etat', 'win-processus-trouver', 'win-processus-gourmands', 'win-processus-fermer', 'win-arret-redemarrage', 'win-arret-annuler', 'win-sessions-fermer', 'win-disque-verifier', 'win-robocopy-copier', 'win-fichier-chercher', 'win-fichier-empreinte', 'win-archive-creer', 'win-archive-extraire', 'win-droits-prendre-possession', 'win-winget-installer', 'win-winget-mettre-a-jour', 'win-correctifs-installes', 'win-tache-planifiee', 'win-variable-environnement', 'win-path-ajouter', 'win-bureau-distance-activer', 'win-heure-synchroniser', 'win-local-changer-mot-de-passe', 'win-local-admin-ajouter', 'win-local-desactiver', 'win-ad-membres-groupe', 'win-ad-infos-utilisateur', 'win-ad-trouver-ordinateur', 'win-ad-controleur-connecte', 'win-ad-mot-de-passe-age'].map((id) => [id, '2026-10-30']),
  ['linux-sed-remplacer', 'linux-sed-lignes', 'linux-csv-verifier', 'linux-csv-colonne', 'linux-fins-ligne-windows', 'linux-comptes-locaux-lister', 'linux-groupes-locaux-lister', 'linux-mot-de-passe-local', 'samba-compte-voir', 'samba-mot-de-passe', 'linux-clavier-voir', 'linux-clavier-changer', 'linux-clavier-session', 'linux-langue-systeme', 'win-langue-voir', 'win-clavier-fixer', 'win-clavier-raccourci', 'win-region-format', 'linux-hostname-changer', 'linux-systeme-identite', 'linux-ssh-client-installer', 'win-ssh-client-installer'].map((id) => [id, '2026-10-31']),
).concat(
  ['cours-ubuntu-jonction-ad-graphique', 'samba-ad-installer'].map((id) => [id, '2026-11-01']),
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
