/**
 * trouver.mjs — KJEMO-TROUVER-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « À lire sur : poste + commande » sous les cases d'une fiche. Pour une valeur qu'on LIT dans le
 * système (compte existant, interface, disque, service…), on dit sur quel poste et avec quelle
 * commande. Une valeur qu'on INVENTE (nouveau nom, délai, taille) n'a pas de note : rien n'est lu.
 *
 * Trois niveaux, du plus précis au plus général :
 *   1. FICHES : réglage propre à une fiche (null = pas de note pour ce paramètre) ;
 *   2. PREFIXES : famille de fiches (par exemple les fiches Samba : le poste est le serveur) ;
 *   3. PLATEFORME : règle par défaut selon Linux, Windows, Cisco ou Azure.
 * Un « trouver » écrit dans la fiche elle-même n'est jamais écrasé.
 */

/** Postes de lecture en plus de MACHINES (procedures.mjs) : le poste où l'on est, selon la plateforme. */
export const POSTES_LECTURE = {
  linux: { id: 'linux', label: 'Ce poste Linux', court: 'Ce poste Linux' },
  windows: { id: 'windows', label: 'Ce poste Windows', court: 'Ce poste Windows' },
  cisco: { id: 'cisco', label: 'Équipement Cisco (console)', court: 'Équipement Cisco' },
  azure: { id: 'azure', label: 'Azure CLI (az)', court: 'Azure CLI' },
};

const t = (poste, commande, texte) => ({ poste, commande, ...(texte ? { texte } : {}) });
const SERV = (commande, texte) => t('serveur', commande, texte);

const LISTE_COMPTES = 'getent passwd | cut -d: -f1';
const LISTE_GROUPES = 'getent group | cut -d: -f1';
const SAMBA_COMPTES = SERV('sudo samba-tool user list');
const SAMBA_GROUPES = SERV('sudo samba-tool group list');

/** Règles par défaut, par plateforme et par nom de paramètre. */
const PLATEFORME = {
  Linux: {
    compte: t('linux', LISTE_COMPTES), utilisateur: t('linux', LISTE_COMPTES), membre: t('linux', LISTE_COMPTES),
    compteEcriture: t('linux', LISTE_COMPTES), compteLecture: t('linux', LISTE_COMPTES), ecriture: t('linux', LISTE_COMPTES),
    lecture: t('linux', LISTE_COMPTES), lectureSeule: t('linux', LISTE_COMPTES), membreEcriture: t('linux', LISTE_COMPTES),
    groupe: t('linux', LISTE_GROUPES),
    disque: t('linux', 'lsblk'), disque1: t('linux', 'lsblk'), disque2: t('linux', 'lsblk'), partition: t('linux', 'lsblk'),
    disqueActif: t('linux', 'cat /proc/mdstat'), disquePanne: t('linux', 'cat /proc/mdstat'), disqueRemplacement: t('linux', 'lsblk'), disqueSecours: t('linux', 'lsblk'),
    ensemble: t('linux', 'cat /proc/mdstat'), uuid: t('linux', 'sudo mdadm --detail --scan'),
    service: t('linux', 'systemctl list-units --type=service'), unite: t('linux', 'systemctl list-units --type=service'),
    pid: t('linux', 'ps aux'), programme: t('linux', 'ps aux'),
    connexion: t('linux', 'nmcli -f NAME,DEVICE connection show'),
    point_de_montage: t('linux', 'findmnt'), point: t('linux', 'findmnt -t nfs,nfs4'),
    numero: t('linux', 'sudo ufw status numbered'),
    serveurIp: SERV('ip -br address'), adresseClient: t('client-ubuntu', 'ip -br address'),
  },
  Windows: {
    carte: t('windows', 'Get-NetAdapter'), interface: t('windows', 'Get-NetAdapter'),
    passerelle: t('windows', 'Get-NetIPConfiguration'), dns: t('windows', 'Get-NetIPConfiguration'),
    service: t('windows', 'Get-Service'), processus: t('windows', 'Get-Process'),
    pid: t('windows', 'Get-NetTCPConnection -State Listen | Select-Object LocalPort, OwningProcess'),
    imprimante: t('windows', 'Get-Printer'), travail: t('windows', 'Get-PrintJob -PrinterName NOM_IMPRIMANTE'), lecteur: t('windows', 'Get-Volume'), tache: t('windows', 'Get-ScheduledTask'),
    session: t('windows', 'quser'), kb: t('windows', 'Get-HotFix'),
    ordinateur: t('windows', 'Get-ADComputer -Filter * | Select-Object Name'),
    compte: t('windows', 'Get-ADUser -Filter * | Select-Object SamAccountName'),
    groupe: t('windows', 'Get-ADGroup -Filter * | Select-Object Name'),
    ou: t('windows', 'Get-ADOrganizationalUnit -Filter * | Select-Object Name'),
    parent: t('windows', 'Get-ADOrganizationalUnit -Filter * | Select-Object DistinguishedName'),
    gpo: t('windows', 'Get-GPO -All | Select-Object DisplayName'),
    zone: t('windows', 'Get-DnsServerZone'), profil: t('windows', 'netsh wlan show profiles'),
    domaine: t('windows', 'Get-ADDomain | Select-Object Name, DNSRoot'),
    partage: t('windows', 'Get-SmbShare'),
    recherche: null, id: t('windows', 'winget search NOM_DU_LOGICIEL'),
  },
  Cisco: {
    vlan: t('cisco', 'show vlan brief'), interface: t('cisco', 'show interfaces status'),
    portA: t('cisco', 'show interfaces status'), portB: t('cisco', 'show interfaces status'),
    premier: t('cisco', 'show interfaces status'), dernier: t('cisco', 'show interfaces status'),
    trunkSw: t('cisco', 'show interfaces status'), routeurItf: t('cisco', 'show ip interface brief'),
    passive: t('cisco', 'show ip interface brief'), sortie: t('cisco', 'show ip interface brief'),
    groupe: t('cisco', 'show etherchannel summary'), domaine: t('cisco', 'show vtp status'),
    saut: t('cisco', 'show cdp neighbors detail'), secours: t('cisco', 'show cdp neighbors detail'),
  },
  Azure: {
    abonnement: t('azure', 'az account list --output table'),
    groupe: t('azure', 'az group list --output table'),
    region: null,
  },
};

/** Familles de fiches : le poste n'est pas « ce poste » mais le serveur Samba. */
const PREFIXES = [
  { re: /^cours-samba-(?!dns|script|import)|^cours-ubuntu-acces-partage|^cours-windows-acces-partage|^cours-smbclient/, regles: {
    compte: SAMBA_COMPTES, utilisateur: SAMBA_COMPTES, membre: SAMBA_COMPTES, compteEcriture: SAMBA_COMPTES, compteLecture: SAMBA_COMPTES,
    ecriture: SAMBA_COMPTES, lecture: SAMBA_COMPTES, lectureSeule: SAMBA_COMPTES, membreEcriture: SAMBA_COMPTES,
    groupe: SAMBA_GROUPES, partage: SERV('testparm -s | grep \'^\\[\''), serveur: SERV('ip -br address'),
    domaine: SERV('sudo samba-tool domain info 127.0.0.1', '(ligne « Netbios domain name »)'),
    chemin: null, fichier1: SERV('ls -l DOSSIER_DU_PARTAGE', '(les fichiers présents dans le dossier partagé)'), fichier2: SERV('ls -l DOSSIER_DU_PARTAGE'),
  } },
];

/** Réglages propres à une fiche (null = aucune note pour ce paramètre). */
const FICHES = {
  'cours-samba-dns': {
    serveur: SERV('hostname -f'), zone: SERV('sudo samba-tool domain info 127.0.0.1', '(ligne « Domain »)'),
    ip: t('client-ubuntu', 'ip -br address'), dernierOctet: t('client-ubuntu', 'ip -br address', '(le dernier nombre de l’adresse)'),
    zoneInverse: SERV('samba-tool dns zonelist <serveur> -U administrator', '(la zone existe-t-elle déjà ?)'),
  },
  'cours-samba-groupes': { groupe: SAMBA_GROUPES, membre: SAMBA_COMPTES },
  'cours-ubuntu-reseau-client': { connexion: t('client-ubuntu', 'nmcli -f NAME,DEVICE connection show'), adresseClient: null, serveurIp: SERV('ip -br address') },
  // Les fiches qui CRÉENT : la valeur est inventée, pas lue.
  'cours-az-groupe-ressources': { groupe: null },
  'cours-groupes-locaux': { groupe: t('linux', LISTE_GROUPES) },
  'cours-raid1-panne-secours': { matrice: t('linux', 'cat /proc/mdstat') },
  'win-local-voir-comptes': { groupe: t('windows', 'Get-LocalGroup') },
  'win-local-creer-utilisateur': { groupe: t('windows', 'Get-LocalGroup'), compte: null },
  'win-dns-zone-directe': { zone: null },
  'win-dns-zone-inverse': { zone: null },
  'win-tache-planifiee': { tache: null },
  'cisco-creer-vlan': { vlan: null },
  'cours-ec-pagp': { groupe: null }, 'cours-ec-lacp': { groupe: null }, 'cours-ec-statique': { groupe: null },
  'cours-vtp-transparent-etendus': { vlan: null },
  'cours-vtp-reseau': { domaine: null },
  'cours-sw-gestion-ip': { vlan: null },
  'cours-tp-vlan-ssh-intervlan': { domaine: null, vlan: null },
  'cours-tp-vtp-dtp': { domaine: null },
  'cours-tp-pvst': { vlan: null, vlanS1: null, vlanS2: null, vlanS3: null, vlanNatif: null, vlanGestion: null },
  'win-local-changer-mot-de-passe': { compte: t('windows', 'Get-LocalUser') },
  'win-local-admin-ajouter': { compte: t('windows', 'Get-LocalUser') },
  'win-local-desactiver': { compte: t('windows', 'Get-LocalUser') },
  'win-ad-creer-utilisateur': { compte: null, ou: t('windows', 'Get-ADOrganizationalUnit -Filter * | Select-Object Name'), groupe: t('windows', 'Get-ADGroup -Filter * | Select-Object Name') },
  'win-ad-creer-groupe': { groupe: null },
  'win-ad-creer-ou': { ou: null },
  'win-gpo-creer-lier': { gpo: null },
  'win-partage-creer': { partage: null },
  'win-partage-voir': { partage: t('windows', 'Get-SmbShare') },
  'win-partage-connecter': { serveur: t('serveur', 'hostname'), partage: t('serveur', 'Get-SmbShare') },
  'win-dhcp-etendue': { dns: t('windows', 'Get-NetIPConfiguration'), passerelle: t('windows', 'Get-NetIPConfiguration') },
  'windows-ip-fixe': { dns: null, passerelle: null },
  'win-dhcp-installer': { fqdn: t('windows', '(Get-CimInstance Win32_ComputerSystem) | Select-Object Name, Domain') },
  'win-ad-joindre-domaine': { domaine: t('serveur', 'sudo samba-tool domain info 127.0.0.1', '(ligne « Domain »)') },
  'azure-changer-abonnement': { abonnement: t('azure', 'az account list --output table') },
  // Fiches Azure qui s'appuient sur une ressource EXISTANTE : on la liste.
  'cours-az-sous-reseau-ajouter': { vnet: t('azure', 'az network vnet list --output table') },
  'cours-az-plan-adressage': { vnet: t('azure', 'az network vnet list --output table') },
  'cours-az-vm-creer-vnet': { vnet: t('azure', 'az network vnet list --output table'), sousReseau: t('azure', 'az network vnet subnet list --resource-group GROUPE --vnet-name VNET --output table') },
  'cours-az-peering-creer': { vnet1: t('azure', 'az network vnet list --output table'), vnet2: t('azure', 'az network vnet list --output table') },
  'cours-az-peering-verifier': { vnet: t('azure', 'az network vnet list --output table'), appairage: t('azure', 'az network vnet peering list --resource-group GROUPE --vnet-name VNET --output table') },
  'cours-az-routes-effectives': { nic: t('azure', 'az network nic list --output table') },
  'cours-az-lb-etat': { lb: t('azure', 'az network lb list --output table') },
  'cours-az-dns-enregistrement-a': { zone: t('azure', 'az network dns zone list --output table') },
  'cours-az-dns-zone-privee': { vnet: t('azure', 'az network vnet list --output table') },
  'cours-az-point-service-stockage': { vnet: t('azure', 'az network vnet list --output table'), sousReseau: t('azure', 'az network vnet subnet list --resource-group GROUPE --vnet-name VNET --output table') },
  'cours-az-point-prive-stockage': { vnet: t('azure', 'az network vnet list --output table'), sousReseau: t('azure', 'az network vnet subnet list --resource-group GROUPE --vnet-name VNET --output table') },
  // Commutateur ou routeur : les ports d'un routeur se lisent avec « show ip interface brief ».
  'cours-rt-statique': { interface: null, sortie: t('cisco', 'show ip interface brief') },
  'cours-rt-interface-ip': { interface: t('cisco', 'show ip interface brief') },
  'cours-rip-configurer': { interface: t('cisco', 'show ip interface brief') },
  'cours-dhcp4-relais': { interface: t('cisco', 'show ip interface brief') },
  'cours-nat-statique': { interne: t('cisco', 'show ip interface brief'), externe: t('cisco', 'show ip interface brief') },
  'cours-nat-dynamique': { interne: t('cisco', 'show ip interface brief'), externe: t('cisco', 'show ip interface brief') },
  'cours-nat-pat': { interne: t('cisco', 'show ip interface brief'), externe: t('cisco', 'show ip interface brief') },
  'cours-nat-redirection-port': { interne: t('cisco', 'show ip interface brief'), externe: t('cisco', 'show ip interface brief') },
  'cours-route-recap-rip': { interface: t('cisco', 'show ip interface brief') },
  'cours-dhcp4-client-routeur': { interface: t('cisco', 'show ip interface brief') },
  'cours-dhcp4-depanner': { interface: t('cisco', 'show ip interface brief') },
  'cours-ipv6-adresser-interface': { interface: t('cisco', 'show ip interface brief') },
  'cours-dhcp6-slaac': { interface: t('cisco', 'show ip interface brief') },
  'cours-dhcp6-sans-etat': { interface: t('cisco', 'show ip interface brief') },
  'cours-dhcp6-avec-etat': { interface: t('cisco', 'show ip interface brief') },
  'cours-dhcp6-verifier': { interface: t('cisco', 'show ip interface brief') },
};

/** Paramètres dont le LIBELLÉ dit qu'on invente la valeur : jamais de note, quelle que soit la règle. */
const LIBELLE_INVENTE = /nouveau|nouvelle|à créer|créé[ée]?s?\b|nom de la copie|nom du lien|sortie|à écrire|résultat|restauration|à ajouter|à fixer|à choisir/i;

/** Plateforme principale d'une fiche à partir de ses plateformes. */
function plateformePrincipale(plateformes) {
  const l = plateformes ?? [];
  return ['Linux', 'Windows', 'Cisco', 'Azure'].find((p) => l.includes(p)) ?? null;
}

/** Le « trouver » d'un paramètre, ou null s'il n'y a rien à lire. */
export function trouverPour(procedure, plateformes, param) {
  if (param.trouver) return param.trouver;
  if (LIBELLE_INVENTE.test(param.label ?? '')) return null;
  const fiche = FICHES[procedure.id];
  if (fiche && Object.prototype.hasOwnProperty.call(fiche, param.id)) return fiche[param.id];
  for (const f of PREFIXES) if (f.re.test(procedure.id) && Object.prototype.hasOwnProperty.call(f.regles, param.id)) return f.regles[param.id];
  const plat = plateformePrincipale(plateformes);
  const regles = plat ? PLATEFORME[plat] : null;
  return regles && Object.prototype.hasOwnProperty.call(regles, param.id) ? regles[param.id] : null;
}

/**
 * Complète les paramètres d'une fiche. Les définitions de paramètres sont souvent PARTAGÉES entre fiches
 * (une même constante) : on remplace donc la liste par des copies, jamais on ne modifie l'objet partagé.
 * Retourne le nombre de notes ajoutées.
 */
export function completerTrouver(procedure, plateformes) {
  let n = 0;
  // Un scénario mêle plusieurs équipements : « ce poste » n'a pas de sens, on ne devine pas.
  if (!Array.isArray(procedure.params) || procedure.kind === 'scenario') return 0;
  procedure.params = procedure.params.map((q) => {
    if (q.type === 'table' || q.trouver) return q;
    const r = trouverPour(procedure, plateformes, q);
    if (!r) return q;
    n++;
    return { ...q, trouver: { ...r } };
  });
  return n;
}
