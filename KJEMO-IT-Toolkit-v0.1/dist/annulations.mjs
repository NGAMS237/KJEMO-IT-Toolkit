/**
 * annulations.mjs — KJEMO-ANNULER-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Étapes « Annuler » COPIABLES pour les fiches qui modifient un poste. Avant, ces fiches n'avaient
 * qu'une phrase de « retour » ; maintenant, la personne copie les commandes d'annulation une à une,
 * comme les autres étapes.
 *
 * Règles :
 *  - une étape d'annulation est FACULTATIVE (elle ne part jamais dans la copie de toute la fiche)
 *    et porte le drapeau `annulation` (puce « Annulation ») ;
 *  - elle n'utilise que les paramètres déjà déclarés dans la fiche ;
 *  - quand une valeur d'origine doit être RELUE (ancien groupe, ancien nom…), la ligne contient un
 *    repère en majuscules (ANCIEN_GROUPE…) que l'explication nomme : ce n'est pas un paramètre ;
 *  - Azure : aucune commande de suppression (règle du dépôt, test azure-cours) — seules les annulations sans « delete » y figurent ;
 *  - on ne modifie jamais les tableaux partagés : on clone la méthode (comme trouver.mjs).
 * Non exécuté sur de vrais postes : voir le CHANGELOG.
 */
import { sh, ps, cm } from './cours-outils.mjs';

/** Repères à remplacer à la main par une valeur relevée avant la modification. */
export const REPERES = [
  'ANCIEN_NOM', 'ANCIEN_ABONNEMENT', 'ANCIEN_GROUPE', 'ANCIEN_MODE', 'ANCIEN_COMPTE', 'ANCIENNE_DISPOSITION',
  'ANCIENNE_LANGUE', 'ANCIENNE_CULTURE', 'ANCIENNE_OU', 'DOSSIER_PARENT', 'ZONE_INVERSE', 'NUMERO', 'PORT',
  'HORODATAGE', 'ANCIEN_SOUPLE', 'ANCIEN_DUR', 'ANCIEN_ISOUPLE', 'ANCIEN_IDUR',
];

const faire = (effet) => (titre, explication, lignes, attendu, extra = {}) => ({
  titre: `Annuler — ${titre}`, effet, explication, lignes, attendu, facultatif: true, annulation: true, phase: 'Annuler ou défaire', ...extra,
});
const an = faire('modification');
const ad = faire('destructif');
const ai = faire('interruption');

const ios = (invite) => (cmd) => ({ invite, cmd });
const sw = ios('Switch(config)#'); const swi = ios('Switch(config-if)#'); const swr = ios('Switch(config-if-range)#');
const rt = ios('Router(config)#'); const rti = ios('Router(config-if)#'); const rtr = ios('Router(config-router)#');
const dv = ios('Device(config)#'); const dvl = ios('Device(config-line)#');

/** Politique du dépôt : une fiche Azure ne contient jamais de commande de suppression (az … delete). */
const AZURE_AJOUT = 'Les étapes « Annuler » donnent les commandes sans suppression ; les suppressions (az … delete) restent volontairement à taper à la main, après vérification.';

const SERV = { machine: 'serveur' };
const CLI = { machine: 'client-ubuntu' };

/** Clé « fiche|méthode » → étapes d'annulation (et, au besoin, le texte de retour remplacé). */
export const ANNULATIONS = {
  // ---- Cisco ----------------------------------------------------------------------------------
  'cisco-creer-vlan|ios': {
    retour: 'Pour un mauvais nom, retape « name » avec l’ancien nom lu à l’étape 1. Supprimer le VLAN détache tous les ports qui y sont affectés : regarde d’abord « show vlan brief ».',
    steps: [
      an('corriger le nom', 'Redonne au VLAN son ancien nom : remplace ANCIEN_NOM par le nom relevé à l’étape 1.', [sw('vlan {{vlan}}'), ios('Switch(config-vlan)#')('name ANCIEN_NOM')], 'Le VLAN a de nouveau son ancien nom. Remplace ANCIEN_NOM par le nom relevé.'),
      ad('supprimer le VLAN', 'ATTENTION : les ports affectés à ce VLAN deviennent inactifs tant qu’on ne les réaffecte pas. Vérifie avec « show vlan brief » qu’aucun port important n’y est.', [sw('no vlan {{vlan}}')], 'Le VLAN n’apparaît plus dans « show vlan brief ».'),
    ],
  },
  'cisco-affecter-port-vlan|ios': {
    steps: [an('remettre le port dans le VLAN 1', 'Retire l’affectation : le port retourne dans le VLAN 1 (par défaut). Pour un autre VLAN d’origine, retape « switchport access vlan » avec l’ancien numéro relevé à l’étape 1.', [sw('interface {{interface}}'), swi('no switchport access vlan'), swi('end')], '« show vlan brief » montre le port dans le VLAN 1.')],
  },
  // ---- Semaine 9 : DHCP et IPv6 -----------------------------------------------------------------
  'cours-dhcp4-serveur-routeur|ios': {
    steps: [
      an('retirer le pool', 'Supprime le pool et ses options (réseau, passerelle, DNS, domaine). Les baux déjà accordés continuent jusqu’à leur fin.', [rt('no ip dhcp pool {{pool}}')], '« show running-config | section dhcp » ne montre plus le pool.'),
      an('retirer les exclusions', 'Retape l’exclusion avec « no » devant, avec les mêmes adresses.', [rt('no ip dhcp excluded-address {{debut}} {{fin}}')], 'L’exclusion n’apparaît plus.'),
    ],
  },
  'cours-dhcp4-relais|ios': {
    steps: [an('retirer le relais', 'Retire l’adresse d’assistance de l’interface : les postes de ce réseau ne joignent plus le serveur éloigné.', [rt('interface {{interface}}'), rti('no ip helper-address {{serveur}}')], '« show running-config interface » ne montre plus « ip helper-address ».')],
  },
  'cours-dhcp4-client-routeur|ios': {
    steps: [an('rendre l’interface muette', 'Retire la demande DHCP. Pour une adresse fixe, retape ensuite « ip address » avec l’adresse voulue ; sinon éteins l’interface.', [rt('interface {{interface}}'), rti('no ip address dhcp'), rti('shutdown')], '« show ip interface brief » montre l’interface sans adresse (administratively down).')],
  },
  'cours-dhcp4-depanner|ios': null,
  'cours-ipv6-adresser-interface|ios': {
    steps: [an('retirer les adresses IPv6', 'Retire les adresses de l’interface (globale et link-local). « no ipv6 unicast-routing » n’est PAS donné ici : il couperait le routage IPv6 de tout le routeur.', [rt('interface {{interface}}'), rti('no ipv6 address {{adresse}}'), rti('no ipv6 address {{lien}} link-local')], '« show ipv6 interface brief » ne montre plus ces adresses.')],
  },
  'cours-ipv6-routes-statiques|ios': {
    steps: [an('retirer la route', 'Retape la forme que tu as utilisée avec « no » devant : même réseau, même saut ou même interface.', [rt('no ipv6 route {{reseau}} {{saut}}'), rt('no ipv6 route {{reseau}} {{interface}}'), rt('no ipv6 route {{reseau}} {{interface}} {{saut}}')], '« show ipv6 route static » ne montre plus la route.')],
  },
  'cours-ipv6-defaut-flottante|ios': {
    steps: [an('retirer les routes par défaut', 'Retire la route principale et la route de secours : mêmes paramètres que ceux posés.', [rt('no ipv6 route ::/0 {{saut}}'), rt('no ipv6 route ::/0 {{secours}} {{distance}}')], '« show ipv6 route static » ne montre plus de S* ::/0.')],
  },
  'cours-dhcp6-slaac|ios': {
    steps: [an('retirer les adresses de l’interface', 'Retire les adresses IPv6 de l’interface : le routeur n’annonce plus ce préfixe. « no ipv6 unicast-routing » n’est pas donné ici : il couperait le routage IPv6 de tout le routeur.', [rt('interface {{interface}}'), rti('no ipv6 address {{adresse}}'), rti('no ipv6 address {{lien}} link-local')], 'Les postes ne reçoivent plus d’adresse dans ce préfixe.')],
  },
  'cours-dhcp6-sans-etat|ios': {
    steps: [
      an('retirer le lien et l’indicateur O', 'Détache le pool de l’interface et remet l’indicateur O à 0.', [rt('interface {{interface}}'), rti('no ipv6 dhcp server {{pool}}'), rti('no ipv6 nd other-config-flag')], '« show running-config interface » ne montre plus ces lignes.'),
      an('supprimer le pool', 'Supprime le pool DHCPv6 et ses options.', [rt('no ipv6 dhcp pool {{pool}}')], '« show ipv6 dhcp pool » ne le liste plus.'),
    ],
  },
  'cours-dhcp6-avec-etat|ios': {
    steps: [
      an('retirer le lien et l’indicateur M', 'Détache le pool de l’interface et remet l’indicateur M à 0.', [rt('interface {{interface}}'), rti('no ipv6 dhcp server {{pool}}'), rti('no ipv6 nd managed-config-flag')], '« show running-config interface » ne montre plus ces lignes.'),
      an('supprimer le pool', 'Supprime le pool DHCPv6, son préfixe et ses options.', [rt('no ipv6 dhcp pool {{pool}}')], '« show ipv6 dhcp pool » ne le liste plus.'),
    ],
  },
  'cours-dhcp6-relais|ios': {
    steps: [an('retirer le relais', 'Retape la commande avec « no » devant ; reprends la forme que tu as utilisée (avec ou sans interface de sortie).', [rt('interface {{interface}}'), rti('no ipv6 dhcp relay destination {{serveur}}'), rti('no ipv6 dhcp relay destination {{serveur}} {{sortie}}')], 'La ligne du relais n’apparaît plus sur l’interface.')],
  },
  'cours-ec-pagp|ios': null, 'cours-ec-lacp|ios': null, 'cours-ec-statique|ios': null,
  'cours-stp-racines|ios': {
    steps: [
      an('retirer le rôle de racine', 'Retire la priorité imposée aux VLAN choisis : ils reprennent la priorité par défaut.', [sw('no spanning-tree vlan {{vlans}} root'), sw('no spanning-tree vlan 1 root')], '« show spanning-tree » ne te désigne plus comme racine (sauf si tu l’es naturellement).'),
      an('revenir au mode par défaut', 'Seulement si tu avais changé le mode à l’étape 1 : remets PVST+, le mode par défaut des commutateurs Cisco.', [sw('spanning-tree mode pvst')], '« show spanning-tree summary » indique le mode PVST.'),
    ],
  },
  'cours-stp-portfast-bpduguard|ios': {
    steps: [
      an('retirer PortFast et BPDU Guard', 'Retire les deux protections du port.', [sw('interface {{interface}}'), swi('no spanning-tree portfast'), swi('no spanning-tree bpduguard enable')], '« show running-config interface » ne montre plus ces lignes.'),
      ai('réactiver un port tombé en err-disabled', 'Si BPDU Guard a coupé le port, un arrêt puis un rallumage le relève (retire d’abord ce qui a branché un commutateur).', [sw('interface {{interface}}'), swi('shutdown'), swi('no shutdown')], 'Le port repasse en « connected ».'),
    ],
  },
  'cours-base-peripherique|ios': {
    steps: [
      an('retirer bannière, mots de passe et chiffrement', 'Remet l’appareil sans mot de passe console ni mot de passe privilégié. À faire seulement en laboratoire.', [dv('no banner motd'), dv('no enable secret'), dv('line console 0'), dvl('no password'), dvl('no login'), dvl('exit'), dv('no service password-encryption'), dv('ip domain-lookup')], '« show running-config » ne montre plus ces lignes.'),
      an('remettre le nom d’origine', 'Remplace ANCIEN_NOM par le nom relevé à l’étape 1 (Switch ou Router en usine).', [dv('hostname ANCIEN_NOM')], 'L’invite reprend l’ancien nom.'),
    ],
  },
  'cours-sw-gestion-ip|ios': {
    steps: [ai('retirer l’adresse de gestion', 'Supprime l’interface VLAN et la passerelle. Si tu es connecté par SSH ou Telnet à cette adresse, tu perds la session : passe par la console.', [sw('no ip default-gateway'), sw('no interface vlan {{vlan}}')], '« show ip interface brief » ne montre plus l’interface VLAN.')],
  },
  'cours-sw-ports-inutilises|ios': {
    steps: [
      an('rallumer les ports', 'Rallume les ports que tu avais éteints.', [sw('interface range {{premier}} - {{dernier}}'), swr('no shutdown')], 'Les ports repassent en « up » quand un câble y est branché.'),
      an('sortir les ports du VLAN de parc', 'Remet les ports dans le VLAN 1 (ou retape l’ancien VLAN relevé).', [sw('interface range {{premier}} - {{dernier}}'), swr('no switchport access vlan')], '« show vlan brief » montre les ports dans le VLAN 1.'),
    ],
  },
  'cours-sw-portsec|ios': {
    steps: [
      an('retirer la sécurité de port', 'Retire la sécurité de port ; les adresses apprises disparaissent avec.', [sw('interface {{interface}}'), swi('no switchport port-security')], '« show port-security interface » indique Disabled.'),
      ai('relever le port bloqué', 'Si une violation a mis le port en err-disabled, un arrêt puis un rallumage le relève.', [sw('interface {{interface}}'), swi('shutdown'), swi('no shutdown')], 'Le port repasse en « connected ».'),
    ],
  },
  'cours-rt-interface-ip|ios': {
    steps: [ai('retirer l’adresse de l’interface', 'Enlève l’adresse et éteint l’interface. Les routes qui passaient par elle disparaissent.', [rt('interface {{interface}}'), rti('no ip address'), rti('shutdown')], '« show ip interface brief » montre l’interface sans adresse, administrativement down.')],
  },
  'cours-rt-statique|ios': {
    steps: [an('retirer la route statique', 'Retape la route avec « no » devant : même réseau, même masque, même saut.', [rt('no ip route {{reseau}} {{masque}} {{saut}}'), rt('no ip route {{reseau}} {{masque}} {{sortie}}')], '« show ip route » ne montre plus la route. Si l’une des deux lignes n’existait pas, le routeur répond par une erreur sans gravité.')],
  },
  'cours-rt-defaut-flottante|ios': {
    steps: [an('retirer les routes', 'Retire la route par défaut, la route principale et la route de secours : mêmes paramètres que ceux posés.', [rt('no ip route 0.0.0.0 0.0.0.0 {{saut}}'), rt('no ip route {{reseau}} {{masque}} {{saut}}'), rt('no ip route {{reseau}} {{masque}} {{secours}} {{distance}}')], '« show ip route static » ne montre plus ces routes. Une erreur sur une ligne absente est sans gravité.')],
  },
  'cours-rip-configurer|ios': {
    steps: [an('supprimer RIP', 'Supprime tout le processus RIP : réseaux, version, interfaces passives.', [rt('no router rip')], '« show ip protocols » ne mentionne plus RIP.')],
  },
  'cours-vtp-reseau|ios': {
    steps: [
      an('sortir du jeu de VTP', 'Passe en mode transparent : le commutateur garde ses VLAN locaux et ne reçoit plus ceux des autres. Retire aussi le mot de passe VTP.', [sw('vtp mode transparent'), sw('no vtp password')], '« show vtp status » indique le mode Transparent.'),
      ad('supprimer le VLAN de test', 'Seulement si tu avais créé le VLAN facultatif. Les ports qui y sont affectés deviennent inactifs.', [sw('no vlan {{vlan}}')], 'Le VLAN n’apparaît plus dans « show vlan brief ».'),
    ],
  },
  'cours-vtp-transparent-etendus|ios': {
    steps: [
      ad('supprimer le VLAN', 'Retire le VLAN créé en mode transparent. Les ports qui y sont affectés deviennent inactifs.', [sw('no vlan {{vlan}}')], 'Le VLAN n’apparaît plus.'),
      an('reprendre part à VTP', 'Remet le commutateur en client VTP (ou « server » selon ton plan). Attention : un client reçoit les VLAN du réseau et peut remplacer les tiens.', [sw('vtp mode client')], '« show vtp status » indique le mode Client.'),
    ],
  },
  'cours-dtp-trunk|ios': {
    steps: [an('revenir au réglage par défaut', 'Remet la négociation automatique et retire « nonegotiate » (selon le modèle, « dynamic desirable » est le défaut).', [sw('interface {{interface}}'), swi('switchport mode dynamic auto'), swi('no switchport nonegotiate')], '« show interfaces trunk » ne liste plus ce port si l’autre bout ne négocie pas.')],
  },

  // ---- Windows ----------------------------------------------------------------------------------
  'windows-ip-fixe|powershell': {
    steps: [ai('revenir à l’adressage automatique (DHCP)', 'Retire la passerelle et l’adresse fixes, puis redemande une adresse au serveur DHCP. La connexion peut couper un instant.', [ps('Remove-NetRoute -InterfaceAlias "{{carte}}" -DestinationPrefix 0.0.0.0/0 -NextHop {{passerelle}} -Confirm:$false'), ps('Remove-NetIPAddress -InterfaceAlias "{{carte}}" -IPAddress {{ip}} -Confirm:$false'), ps('Set-NetIPInterface -InterfaceAlias "{{carte}}" -Dhcp Enabled'), ps('Set-DnsClientServerAddress -InterfaceAlias "{{carte}}" -ResetServerAddresses')], 'Get-NetIPConfiguration montre une adresse reçue du DHCP.')],
  },
  'windows-ip-fixe|cmd': {
    steps: [ai('revenir à DHCP', 'Remet l’adresse et le DNS en automatique.', [cm('netsh interface ip set address name="{{carte}}" source=dhcp'), cm('netsh interface ip set dnsserver name="{{carte}}" source=dhcp')], 'ipconfig /all indique « DHCP activé : Oui ».')],
  },
  'azure-changer-abonnement|azure': {
    steps: [an('revenir à l’abonnement précédent', 'Remplace ANCIEN_ABONNEMENT par l’identifiant ou le nom relevé avant le changement (az account show).', [sh('az account set --subscription ANCIEN_ABONNEMENT')], 'az account show affiche l’ancien abonnement.')],
  },
  'azure-changer-abonnement|powershell': {
    steps: [an('revenir à l’abonnement précédent', 'Remplace ANCIEN_ABONNEMENT par l’identifiant ou le nom relevé avant le changement (Get-AzContext).', [ps('Set-AzContext -Subscription ANCIEN_ABONNEMENT')], 'Get-AzContext affiche l’ancien abonnement.')],
  },
  'win-ad-creer-ou|powershell': {
    steps: [ad('supprimer l’unité d’organisation', 'Lève la protection, puis supprime l’OU. Elle doit être vide : déplace d’abord ses objets.', [ps('Set-ADOrganizationalUnit -Identity "OU={{ou}},{{parent}}" -ProtectedFromAccidentalDeletion $false'), ps('Remove-ADOrganizationalUnit -Identity "OU={{ou}},{{parent}}"')], 'Get-ADOrganizationalUnit ne la liste plus.')],
  },
  'win-ad-creer-utilisateur|powershell': {
    steps: [ad('supprimer le compte', 'Suppression définitive après confirmation. Pour un usage temporaire, désactive plutôt le compte.', [ps('Remove-ADUser -Identity {{compte}}')], 'Get-ADUser ne trouve plus le compte.')],
  },
  'win-ad-creer-groupe|powershell': {
    steps: [ad('supprimer le groupe', 'Supprime le groupe (ses membres, eux, restent dans l’annuaire).', [ps('Remove-ADGroup -Identity {{groupe}}')], 'Get-ADGroup ne le trouve plus.')],
  },
  'win-ad-ajouter-membre|powershell': {
    steps: [an('retirer le compte du groupe', 'Retire le compte du groupe après confirmation.', [ps('Remove-ADGroupMember -Identity {{groupe}} -Members {{compte}}')], 'Get-ADGroupMember ne liste plus le compte.')],
  },
  'win-ad-desactiver-compte|powershell': {
    steps: [an('réactiver le compte', 'Réactive le compte désactivé.', [ps('Enable-ADAccount -Identity {{compte}}')], 'Get-ADUser indique Enabled : True.')],
  },
  'win-ad-deplacer-objet|powershell': {
    steps: [an('remettre le compte dans son OU d’origine', 'Remplace ANCIENNE_OU par le chemin relevé avant le déplacement, par exemple OU=Ventes,DC=lab,DC=local.', [ps('Get-ADUser -Identity {{compte}} | Move-ADObject -TargetPath "ANCIENNE_OU"')], 'Get-ADUser montre l’ancien DistinguishedName.')],
  },
  'win-ad-joindre-domaine|powershell': {
    steps: [ai('sortir le poste du domaine', 'Le poste revient dans le groupe de travail WORKGROUP et redémarre. Son compte ordinateur reste dans l’annuaire jusqu’à son nettoyage.', [ps('Remove-Computer -UnjoinDomainCredential (Get-Credential) -WorkgroupName WORKGROUP -Restart')], 'Après le redémarrage, le poste est dans un groupe de travail.')],
  },
  'win-gpo-creer-lier|powershell': {
    steps: [
      an('retirer le lien', 'Retire le lien de la GPO avec l’OU ; la GPO existe toujours.', [ps('Remove-GPLink -Name "{{gpo}}" -Target "{{ou}}"')], 'Get-GPInheritance sur l’OU ne la liste plus.'),
      ad('supprimer la GPO', 'Supprime la GPO elle-même.', [ps('Remove-GPO -Name "{{gpo}}"')], 'Get-GPO ne la trouve plus.'),
    ],
  },
  'win-dhcp-installer|powershell': {
    steps: [
      an('retirer l’autorisation dans l’annuaire', 'Le serveur n’est plus autorisé à répondre.', [ps('Remove-DhcpServerInDC -DnsName {{fqdn}} -IPAddress {{ip}}')], 'Get-DhcpServerInDC ne le liste plus.'),
      ad('désinstaller le rôle DHCP', 'Supprime le rôle et ses étendues. Un redémarrage peut être demandé.', [ps('Uninstall-WindowsFeature DHCP')], 'Get-WindowsFeature DHCP indique Available.'),
    ],
  },
  'win-dhcp-etendue|powershell': {
    steps: [ad('supprimer l’étendue', 'Supprime l’étendue et ses baux : les clients perdent leur adresse à l’expiration du bail.', [ps('Remove-DhcpServerv4Scope -ScopeId {{reseau}} -Force')], 'Get-DhcpServerv4Scope ne la liste plus.')],
  },
  'win-dhcp-reservation|powershell': {
    steps: [an('supprimer la réservation', 'Libère l’adresse réservée.', [ps('Remove-DhcpServerv4Reservation -ScopeId {{reseau}} -IPAddress {{ip}}')], 'Get-DhcpServerv4Reservation ne la liste plus.')],
  },
  'win-dns-zone-directe|powershell': {
    steps: [ad('supprimer la zone', 'Supprime la zone ET tous ses enregistrements.', [ps('Remove-DnsServerZone -Name {{zone}} -Force')], 'Get-DnsServerZone ne la liste plus.')],
  },
  'win-dns-zone-inverse|powershell': {
    steps: [ad('supprimer la zone inverse', 'Liste les zones inverses, puis remplace ZONE_INVERSE par le nom exact de celle que tu as créée (par exemple 1.168.192.in-addr.arpa).', [ps('Get-DnsServerZone | Where-Object IsReverseLookupZone | Select-Object ZoneName'), ps('Remove-DnsServerZone -Name "ZONE_INVERSE" -Force')], 'La zone n’apparaît plus.')],
  },
  'win-dns-enregistrement-a|powershell': {
    steps: [an('supprimer l’enregistrement', 'Supprime l’enregistrement A.', [ps('Remove-DnsServerResourceRecord -ZoneName {{zone}} -RRType A -Name {{nom}} -Force')], 'Resolve-DnsName ne retrouve plus le nom.')],
  },
  'win-partage-creer|powershell': {
    steps: [an('retirer le partage', 'Retire seulement le partage réseau ; le dossier et son contenu restent en place.', [ps('Remove-SmbShare -Name {{partage}} -Force')], 'Get-SmbShare ne le liste plus.')],
  },
  'win-partage-ntfs|cmd': {
    steps: [an('retirer les droits NTFS', 'Retire toutes les entrées de ce compte ou groupe sur le dossier.', [cm('icacls "{{chemin}}" /remove "{{principal}}"')], 'icacls n’affiche plus ce compte.')],
  },
  'win-partage-connecter|cmd': {
    steps: [an('déconnecter le lecteur', 'Déconnecte le lecteur réseau et supprime la connexion mémorisée.', [cm('net use {{lettre}}: /delete')], 'net use ne liste plus le lecteur.')],
  },
  'win-local-creer-utilisateur|powershell': {
    steps: [
      an('retirer le compte du groupe', 'Retire le compte du groupe local.', [ps('Remove-LocalGroupMember -Group {{groupe}} -Member {{compte}}')], 'Get-LocalGroupMember ne le liste plus.'),
      ad('supprimer le compte', 'Supprime le compte ; son profil (dossier utilisateur) reste sur le disque.', [ps('Remove-LocalUser -Name {{compte}}')], 'Get-LocalUser ne le trouve plus.'),
    ],
  },
  'win-pare-feu-ouvrir-port|powershell': {
    steps: [an('fermer le port', 'Supprime la règle qui ouvrait le port.', [ps('Remove-NetFirewallRule -DisplayName "{{nom}}"')], 'Get-NetFirewallRule ne la trouve plus.')],
  },
  'win-renommer-poste|powershell': {
    steps: [ai('remettre l’ancien nom', 'Remplace ANCIEN_NOM par le nom relevé avant le changement ; le poste redémarre.', [ps('Rename-Computer -NewName ANCIEN_NOM'), ps('Restart-Computer')], 'Après le redémarrage, hostname affiche l’ancien nom.')],
  },
  'win-droits-prendre-possession|powershell': {
    steps: [an('rétablir les droits sauvegardés', 'Remplace DOSSIER_PARENT par le dossier qui CONTIENT le dossier traité (icacls /restore l’exige). La propriété, elle, reste aux administrateurs.', [ps('icacls "DOSSIER_PARENT" /restore "$env:USERPROFILE\\droits-avant.txt"')], 'icacls affiche de nouveau les droits d’origine.')],
  },
  'win-winget-installer|powershell': {
    steps: [ad('désinstaller le logiciel', 'Désinstalle le logiciel installé.', [ps('winget uninstall --id {{id}} -e')], 'winget list ne le liste plus.')],
  },
  'win-tache-planifiee|powershell': {
    steps: [an('supprimer la tâche', 'Supprime la tâche planifiée sans demander confirmation.', [ps('Unregister-ScheduledTask -TaskName {{tache}} -Confirm:$false')], 'Get-ScheduledTask ne la trouve plus.')],
  },
  'win-variable-environnement|powershell': {
    steps: [an('supprimer la variable', 'Supprime la variable de l’utilisateur ; ouvre un nouveau terminal pour le voir.', [ps('[Environment]::SetEnvironmentVariable("{{nom}}", $null, "User")')], 'Dans un nouveau terminal, la variable n’existe plus.')],
  },
  'win-path-ajouter|powershell': {
    steps: [an('retirer le dossier du PATH', 'Reconstruit le PATH de l’utilisateur sans le dossier ajouté ; aucune valeur à recopier, donc aucun risque d’effacer le reste.', [ps('[Environment]::SetEnvironmentVariable("Path", (([Environment]::GetEnvironmentVariable("Path", "User") -split ";" | Where-Object { $_ -and $_ -ne "{{dossier}}" }) -join ";"), "User")')], 'Dans un nouveau terminal, le dossier n’apparaît plus dans $env:Path.')],
  },
  'win-bureau-distance-activer|powershell': {
    steps: [an('désactiver le Bureau à distance', 'Refuse de nouveau les connexions et désactive les règles du pare-feu.', [ps('Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name fDenyTSConnections -Value 1'), ps('Get-NetFirewallRule -Name "RemoteDesktop-*" | Disable-NetFirewallRule')], 'Le port 3389 n’accepte plus de connexion.')],
  },
  'win-local-admin-ajouter|powershell': {
    steps: [an('retirer les droits d’administrateur', 'Retire le compte du groupe Administrateurs (identifié par son SID, valable dans toutes les langues).', [ps('Remove-LocalGroupMember -SID S-1-5-32-544 -Member {{compte}}')], 'Get-LocalGroupMember -SID S-1-5-32-544 ne le liste plus.')],
  },
  'win-local-desactiver|powershell': {
    steps: [an('réactiver le compte', 'Réactive le compte local.', [ps('Enable-LocalUser -Name {{compte}}')], 'Get-LocalUser indique Enabled : True.')],
  },
  'win-clavier-fixer|powershell': {
    steps: [an('remettre la langue d’origine', 'Remplace ANCIENNE_LANGUE par l’étiquette relevée à l’étape 1 (Get-WinUserLanguageList), par exemple fr-CA.', [ps('Set-WinUserLanguageList -LanguageList (New-WinUserLanguageList -Language ANCIENNE_LANGUE) -Force')], 'Get-WinUserLanguageList montre l’ancienne langue.')],
  },
  'win-clavier-raccourci|powershell': {
    steps: [an('remettre le raccourci par défaut', 'Remet « 1 » (Alt+Maj) dans les deux valeurs ; rouvre la session ensuite.', [ps('Set-ItemProperty -Path "HKCU:\\Keyboard Layout\\Toggle" -Name "Language Hotkey" -Value "1"'), ps('Set-ItemProperty -Path "HKCU:\\Keyboard Layout\\Toggle" -Name "Layout Hotkey" -Value "1"')], 'Après réouverture de session, Alt+Maj change de disposition.')],
  },
  'win-region-format|powershell': {
    steps: [an('remettre le format régional d’origine', 'Remplace ANCIENNE_CULTURE par la valeur relevée à l’étape 1 (Get-Culture), par exemple fr-CA.', [ps('Set-Culture ANCIENNE_CULTURE')], 'Get-Culture affiche l’ancien format.')],
  },
  'win-ssh-client-installer|powershell': {
    steps: [ad('désinstaller le client SSH', 'Retire la fonctionnalité OpenSSH Client.', [ps('Remove-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0')], 'Get-WindowsCapability indique NotPresent.')],
  },
  'cours-rsat-windows|powershell': {
    steps: [ad('désinstaller les outils RSAT', 'Retire les deux outils installés.', [ps('Remove-WindowsCapability -Online -Name "Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0"'), ps('Remove-WindowsCapability -Online -Name "Rsat.Dns.Tools~~~~0.0.1.0"')], 'Get-WindowsCapability indique NotPresent pour les deux.')],
  },

  // ---- Linux : comptes, droits, disques ---------------------------------------------------------
  'cours-groupes-locaux|linux': {
    steps: [
      an('remettre le groupe principal', 'Seulement si tu as fait l’étape facultative. Sur Ubuntu, le groupe principal par défaut porte le nom du compte.', [sh('sudo usermod -g {{utilisateur}} {{utilisateur}}')], 'id affiche de nouveau le groupe principal d’origine.'),
      an('retirer le compte du groupe', 'Retire le compte du groupe (il doit rouvrir sa session pour que ça prenne effet).', [sh('sudo gpasswd -d {{utilisateur}} {{groupe}}')], 'id n’affiche plus le groupe.'),
      ad('supprimer le groupe', 'Impossible si le groupe est le groupe principal de quelqu’un.', [sh('sudo groupdel {{groupe}}')], 'getent group ne le trouve plus.'),
    ],
  },
  'cours-droits-dossier-partage|linux': {
    steps: [an('remettre le groupe et le mode d’origine', 'Remplace ANCIEN_GROUPE et ANCIEN_MODE par les valeurs relevées à l’étape 1 (par exemple root et 755).', [sh('sudo chgrp ANCIEN_GROUPE {{dossier}}'), sh('sudo chmod ANCIEN_MODE {{dossier}}')], 'stat affiche le groupe et le mode d’origine.')],
  },
  'cours-partition-formater-monter|linux': {
    steps: [
      an('démonter et retirer la ligne de /etc/fstab', 'Sors du point de montage, démonte, puis remets le fstab d’avant. Sans cela, le système tentera de monter une partition disparue au démarrage.', [sh('cd ~'), sh('sudo umount {{pointMontage}}'), sh('sudo cp -a /etc/fstab.avant-cours /etc/fstab'), sh('sudo rmdir {{pointMontage}}')], 'findmnt ne montre plus le point de montage ; sudo findmnt --verify ne signale rien.'),
      ad('supprimer la partition', 'Dans fdisk : tape d (supprimer), choisis la partition, puis w pour écrire. Les données de la partition sont perdues.', [sh('sudo fdisk {{disque}}'), sh('sudo partprobe {{disque}}')], 'lsblk ne montre plus la partition.'),
    ],
  },
  'cours-quotas-utilisateur|linux': {
    steps: [
      an('retirer la limite du compte', 'Met les limites à zéro (zéro = aucune limite).', [sh('sudo setquota -u {{utilisateur}} 0 0 0 0 {{pointMontage}}')], 'sudo quota -u affiche zéro limite.'),
      an('désactiver les quotas et retirer l’option', 'Coupe la comptabilité, remet le fstab d’avant et remonte la partition.', [sh('sudo quotaoff -v {{pointMontage}}'), sh('sudo cp -a /etc/fstab.avant-quotas /etc/fstab'), sh('sudo mount -o remount {{pointMontage}}')], 'findmnt -no OPTIONS ne montre plus usrquota.'),
    ],
  },
  'cours-donner-dossier-compte|linux': {
    steps: [
      ad('supprimer le dossier de test', 'Supprime le dossier et le fichier créés pour l’essai.', [sh('sudo rm -r {{dossier}}/dossier-test')], 'ls ne montre plus dossier-test.'),
      an('remettre le propriétaire d’origine', 'Remplace ANCIEN_COMPTE et ANCIEN_GROUPE par les valeurs relevées à l’étape 2.', [sh('sudo chown ANCIEN_COMPTE:ANCIEN_GROUPE {{dossier}}')], 'stat affiche le propriétaire d’origine.'),
    ],
  },
  'cours-raid1-creer|linux': {
    steps: [
      an('démonter et retirer la ligne de /etc/fstab', 'Sors du point de montage, démonte et remets le fstab d’avant.', [sh('cd ~'), sh('sudo umount {{pointMontage}}'), sh('sudo cp -a /etc/fstab.avant-raid /etc/fstab')], 'findmnt ne montre plus le point de montage.'),
      an('retirer la ligne ARRAY de mdadm.conf', 'Ouvre le fichier, supprime la ligne ARRAY ajoutée, enregistre, puis régénère l’initramfs.', [sh('sudo nano /etc/mdadm/mdadm.conf'), sh('sudo update-initramfs -u')], 'La ligne ARRAY a disparu du fichier.'),
      ad('arrêter la matrice et effacer ses métadonnées', 'Efface les métadonnées RAID des deux disques : leur contenu devient illisible. Vérifie les noms avec lsblk.', [sh('sudo mdadm --stop {{matrice}}'), sh('sudo mdadm --zero-superblock {{disque1}} {{disque2}}')], 'cat /proc/mdstat ne liste plus la matrice.'),
    ],
  },
  'cours-samba-partage-utilisateurs|linux': {
    steps: [
      an('retirer le partage de smb.conf', 'Restaure la sauvegarde de smb.conf et recharge la configuration.', [sh('sudo cp -a /etc/samba/smb.conf.avant-cours /etc/samba/smb.conf'), sh('sudo smbcontrol all reload-config')], 'testparm -s ne liste plus le partage.'),
      ad('supprimer les deux comptes Samba', 'Supprime les comptes créés pour l’essai.', [sh('sudo samba-tool user delete {{ecriture}}'), sh('sudo samba-tool user delete {{lecture}}')], 'samba-tool user list ne les liste plus.'),
      ad('supprimer le dossier', 'Seulement s’il est vide : rmdir refuse sinon.', [sh('sudo rmdir {{chemin}}')], 'Le dossier n’existe plus.'),
    ],
  },
  'cours-samba-partage-groupe|linux': {
    steps: [
      an('supprimer le dossier d’essai', 'Sur le client : supprime le dossier créé pendant le test d’écriture.', [sh("smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{membreEcriture}} -c 'rmdir ecrit_par_membre'")], 'Le dossier ecrit_par_membre a disparu du partage.', CLI),
      an('retirer le partage et remettre le dossier', 'Sur le serveur : restaure smb.conf et recharge. Pour le groupe et le mode du dossier, remplace ANCIEN_GROUPE et ANCIEN_MODE par les valeurs relevées avant la modification.', [sh('sudo cp -a /etc/samba/smb.conf.avant-groupe /etc/samba/smb.conf'), sh('sudo smbcontrol all reload-config'), sh('sudo chgrp ANCIEN_GROUPE {{chemin}}'), sh('sudo chmod ANCIEN_MODE {{chemin}}')], 'testparm -s ne liste plus le partage.', SERV),
    ],
  },
  'cours-smbclient-transferts|linux': {
    steps: [
      ad('supprimer le dossier de travail du client', 'Sur le client : supprime ~/smb-tp2 et les fichiers téléchargés.', [sh('rm -r ~/smb-tp2')], 'Le dossier n’existe plus.', CLI),
      ad('supprimer les fichiers du serveur', 'Sur le serveur : supprime les fichiers créés pour l’essai.', [sh('sudo rm {{chemin}}/{{fichier1}} {{chemin}}/{{fichier2}} {{chemin}}/depot1 {{chemin}}/depot2')], 'ls du dossier ne les montre plus.', SERV),
    ],
  },
  'cours-samba-dns|linux': {
    steps: [ad('supprimer les enregistrements et la zone inverse', 'Supprime l’enregistrement PTR, la zone inverse, puis l’enregistrement A. Le mot de passe de administrator est demandé.', [sh('samba-tool dns delete {{serveur}} {{zoneInverse}} {{dernierOctet}} PTR {{hote}}.{{zone}} -U administrator'), sh('samba-tool dns zonedelete {{serveur}} {{zoneInverse}} -U administrator'), sh('samba-tool dns delete {{serveur}} {{zone}} {{hote}} A {{ip}} -U administrator')], 'samba-tool dns query ne liste plus l’enregistrement.')],
  },
  'cours-ubuntu-reseau-client|linux': {
    steps: [ai('revenir à l’adressage automatique', 'Remet DHCP et efface l’adresse et le DNS fixes. La connexion coupe un instant.', [sh("sudo nmcli connection modify '{{connexion}}' ipv4.method auto ipv4.addresses \"\" ipv4.dns \"\""), sh("sudo nmcli connection up '{{connexion}}'")], 'ip -br address montre une adresse reçue du DHCP.', CLI)],
  },
  'cours-ubuntu-acces-partage|linux': {
    steps: [an('supprimer le dossier d’essai', 'Supprime le dossier créé pendant le test d’écriture (vide).', [sh("smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compteEcriture}} -c 'rmdir dossier_ecriture_ok'")], 'Le dossier n’apparaît plus dans le partage.', CLI)],
  },
  'cours-disque-entretien|linux': {
    steps: [an('remettre le compteur de montages à zéro', 'Remet le compteur modifié pour provoquer la vérification.', [sh('sudo tune2fs -C 0 {{partition}}')], 'sudo tune2fs -l montre « Mount count » à 0.')],
  },
  'cours-quota-edquota|linux': {
    steps: [an('retirer la limite', 'Rouvre l’éditeur : mets 0 dans soft et hard, puis enregistre.', [sh('sudo edquota -u {{compte}}')], 'sudo quota -u affiche zéro limite.')],
  },
  'cours-planifier-taches|linux': {
    steps: [an('retirer la tâche en attente', 'Liste les tâches at, puis supprime-la avec son numéro (NUMERO).', [sh('atq'), sh('atrm NUMERO')], 'atq ne liste plus la tâche.')],
  },
  'cours-creer-compte-local|linux': {
    steps: [ad('supprimer le compte et son dossier', 'Supprime le compte et son dossier personnel.', [sh('sudo userdel -r {{compte}}')], 'getent passwd ne le trouve plus.')],
  },
  'cours-droits-fichier|linux': {
    steps: [an('remettre un mode ordinaire', 'Remet un mode ordinaire (lecture/écriture pour toi, lecture pour les autres).', [sh('chmod 644 {{fichier}}')], 'ls -l affiche -rw-r--r--.')],
  },

  // ---- Linux simples et commandes ---------------------------------------------------------------
  'linux-sed-remplacer|linux': {
    steps: [an('restaurer le fichier d’origine', 'Remet la copie .bak créée par sed -i.bak à la place du fichier modifié.', [sh('mv {{fichier}}.bak {{fichier}}')], 'Le fichier a de nouveau son contenu d’origine.')],
  },
  'linux-clavier-changer|linux': {
    steps: [an('remettre l’ancienne disposition', 'Remplace ANCIENNE_DISPOSITION par celle relevée avant le changement (localectl status).', [sh('sudo localectl set-keymap ANCIENNE_DISPOSITION'), sh('sudo localectl set-x11-keymap ANCIENNE_DISPOSITION')], 'localectl status affiche l’ancienne disposition.')],
  },
  'linux-clavier-session|linux': {
    steps: [an('remettre le réglage de session par défaut', 'Efface le réglage de la session graphique.', [sh('gsettings reset org.gnome.desktop.input-sources sources')], 'gsettings get affiche la valeur par défaut du système.')],
  },
  'linux-langue-systeme|linux': {
    steps: [an('remettre l’anglais', 'Remet la langue anglaise du système ; à adapter si ta langue d’origine était autre.', [sh('sudo localectl set-locale LANG=en_US.UTF-8')], 'localectl status affiche LANG=en_US.UTF-8.')],
  },
  'linux-hostname-changer|linux': {
    steps: [
      an('remettre l’ancien nom', 'Remplace ANCIEN_NOM par le nom relevé avant le changement.', [sh('sudo hostnamectl set-hostname ANCIEN_NOM')], 'hostnamectl affiche l’ancien nom.'),
      an('restaurer /etc/hosts', 'Seulement si tu as fait l’étape facultative (elle crée hosts.bak).', [sh('sudo mv /etc/hosts.bak /etc/hosts')], 'Le fichier /etc/hosts reprend l’ancienne ligne 127.0.1.1.'),
    ],
  },
  'cr-ufw-allow|linux': {
    steps: [an('refermer le port', 'Supprime la règle ajoutée, sans passer par un numéro.', [sh('sudo ufw delete allow {{port}}/tcp')], 'sudo ufw status ne liste plus la règle.')],
  },
  'cr-ufw-delete|linux': {
    steps: [an('remettre la règle supprimée', 'Remplace PORT par le port de la règle relevée avant la suppression.', [sh('sudo ufw allow PORT/tcp')], 'sudo ufw status liste la règle.')],
  },
  'cr-mount|linux': {
    steps: [an('démonter', 'Démonte la partition montée.', [sh('sudo umount {{point_de_montage}}')], 'findmnt ne liste plus le point de montage.')],
  },
  'cr-umount|linux': {
    steps: [an('remonter', 'Remonte ce point de montage (il doit figurer dans /etc/fstab).', [sh('sudo mount {{point_de_montage}}')], 'findmnt le liste de nouveau.')],
  },
  'cr-quotaon|linux': {
    steps: [an('désactiver les quotas', 'Coupe la comptabilité des quotas.', [sh('sudo quotaoff -v {{point_de_montage}}')], 'quotaon -p indique « off ».')],
  },
  'cr-quotaoff|linux': {
    steps: [an('réactiver les quotas', 'Rallume la comptabilité des quotas.', [sh('sudo quotaon -v {{point_de_montage}}')], 'quotaon -p indique « on ».')],
  },
  'cr-setquota-retirer|linux': {
    steps: [an('remettre les anciennes limites', 'Remplace ANCIEN_SOUPLE, ANCIEN_DUR, ANCIEN_ISOUPLE et ANCIEN_IDUR par les quatre valeurs relevées avant le retrait (repquota).', [sh('sudo setquota -u {{utilisateur}} ANCIEN_SOUPLE ANCIEN_DUR ANCIEN_ISOUPLE ANCIEN_IDUR {{point_de_montage}}')], 'sudo quota -u affiche les anciennes limites.')],
  },
  'cr-nfs-appliquer|linux': {
    steps: [an('restaurer /etc/exports', 'Liste les sauvegardes, puis remplace HORODATAGE par celle voulue et réapplique.', [sh('ls /etc/exports.kjemo-*.bak'), sh('sudo cp -p /etc/exports.kjemo-HORODATAGE.bak /etc/exports'), sh('sudo exportfs -ra')], 'sudo exportfs -v montre les anciens exports.')],
  },
  'cr-nfs-montage-essai|linux': {
    steps: [an('démonter l’essai', 'Démonte le montage d’essai.', [sh('sudo umount {{point}}')], 'findmnt ne le liste plus.')],
  },

  // ---- Azure -------------------------------------------------------------------------------------
  'cours-az-vm-creer-vnet|azure': {
    ajout: AZURE_AJOUT,
    steps: [
      ai('libérer la machine (arrêter la facturation du calcul)', 'Arrête et libère la machine ; les disques restent facturés.', [sh('az vm deallocate --resource-group {{groupe}} --name {{vm}}')], 'az vm get-instance-view indique « VM deallocated ».'),
    ],
  },
  'cours-az-dns-enregistrement-a|azure': {
    ajout: AZURE_AJOUT,
    steps: [
      an('retirer l’enregistrement A', 'Retire l’adresse de l’enregistrement.', [sh('az network dns record-set a remove-record --resource-group {{groupe}} --zone-name {{zone}} --record-set-name {{nom}} --ipv4-address {{adresse}}')], 'az network dns record-set a list ne le liste plus.'),
    ],
  },
  'cours-az-route-personnalisee|azure': {
    ajout: AZURE_AJOUT,
    steps: [
      ai('dissocier la table du sous-réseau', 'Le sous-réseau reprend le routage système.', [sh('az network vnet subnet update --resource-group {{groupe}} --vnet-name {{vnet}} --name {{sousReseau}} --remove routeTable')], 'az network vnet subnet show n’affiche plus de table de routage.'),
      an('désactiver le transfert d’IP', 'Seulement si tu avais activé le transfert sur l’appareil virtuel.', [sh('az network nic update --resource-group {{groupe}} --name {{nicAppliance}} --ip-forwarding false')], 'az network nic show indique enableIpForwarding : false.'),
    ],
  },
  'cours-az-point-service-stockage|azure': {
    steps: [
      an('rouvrir le compte de stockage', 'Autorise de nouveau tous les réseaux.', [sh('az storage account update --resource-group {{groupe}} --name {{compte}} --default-action Allow')], 'az storage account show indique defaultAction : Allow.'),
      an('retirer les règles réseau', 'Retire la règle du sous-réseau et celle de ton adresse (la seconde seulement si tu l’avais ajoutée).', [sh('az storage account network-rule remove --resource-group {{groupe}} --account-name {{compte}} --vnet-name {{vnet}} --subnet {{sousReseau}}'), sh('az storage account network-rule remove --resource-group {{groupe}} --account-name {{compte}} --ip-address {{monIp}}')], 'az storage account network-rule list ne les liste plus.'),
    ],
  },
  'cours-az-lb-creer|azure': {
    ajout: AZURE_AJOUT,
    steps: [
      an('retirer l’interface du pool', 'Retire l’interface réseau du pool du répartiteur.', [sh('az network nic ip-config address-pool remove --resource-group {{groupe}} --nic-name {{nic}} --ip-config-name ipconfig1 --lb-name {{lb}} --address-pool pool')], 'az network nic show ne mentionne plus le pool.'),
    ],
  },
};

// Les trois canaux d'agrégation partagent le même texte : une seule définition.
const CANAL = {
  steps: [
    ai('défaire le canal', 'Éteint les ports, retire le groupe, supprime l’interface logique, puis rallume. Les ports restent en mode trunk : remets-les en accès si besoin.', [swr('shutdown'), swr('no channel-group'), sw('no interface port-channel {{groupe}}'), sw('interface range {{portA}} , {{portB}}'), swr('no shutdown')], '« show etherchannel summary » ne liste plus le groupe.'),
  ],
};
for (const id of ['cours-ec-pagp', 'cours-ec-lacp', 'cours-ec-statique']) ANNULATIONS[`${id}|ios`] = CANAL;

for (const [k, v] of Object.entries(ANNULATIONS)) if (v === null) delete ANNULATIONS[k];

/**
 * Ajoute les étapes d'annulation à une procédure. Clone les méthodes concernées : les tableaux
 * d'étapes peuvent être partagés entre fiches. Retourne le nombre de méthodes complétées.
 */
export function completerAnnulations(procedure) {
  if (!Array.isArray(procedure?.methodes) || procedure.kind === 'scenario') return 0;
  let n = 0;
  procedure.methodes = procedure.methodes.map((m) => {
    const a = ANNULATIONS[`${procedure.id}|${m.id}`];
    if (!a || m.etapes.some((e) => e.annulation)) return m;
    n++;
    const retour = a.retour ?? `${m.retour ?? ''} ${a.ajout ?? 'Les commandes sont dans les étapes « Annuler » ci-dessous.'}`.trim();
    return { ...m, etapes: [...m.etapes, ...a.steps.map((s) => ({ ...s }))], retour };
  });
  return n;
}
