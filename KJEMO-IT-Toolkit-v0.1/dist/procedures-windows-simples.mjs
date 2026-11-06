/**
 * procedures-windows-simples.mjs — KJEMO-WINDOWS-SIMPLES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les COMMANDES COURANTES d'un poste Windows qui manquaient à l'aide-mémoire :
 * vider les caches (ARP, NetBIOS, identifiants, Store, Windows Update,
 * presse-papiers, Kerberos), outils réseau (ipconfig /all, tracert, pathping,
 * route, arp, pare-feu, Winsock), informations système, processus, arrêt,
 * fichiers (robocopy, hash, archives, droits), logiciels (winget), tâches
 * planifiées, variables, Bureau à distance, comptes locaux et consultation
 * d'Active Directory.
 *
 * Même contrat que les autres fiches (voir procedures.mjs) : paramètres
 * déclarés et validés, une vérification par méthode, sources HTTPS, aucune
 * invite dans la commande. AUCUN mot de passe n'est saisi ni écrit : la commande
 * le demande à PowerShell (Read-Host -AsSecureString). Rien n'est exécuté par
 * le Toolkit ; rien n'a été lancé sur un poste Windows réel.
 */

export const MS = 'https://learn.microsoft.com';
export const V_DOC = 'Commandes rédigées d’après la documentation Microsoft (liens des sources, à ouvrir pour confirmer la syntaxe de ta version) ; non exécutées sur un poste, un serveur ou un contrôleur de domaine réel.';
export const ADMIN = 'PowerShell ouvert en tant qu’administrateur (clic droit sur PowerShell › Exécuter en tant qu’administrateur).';
export const USER = 'Aucun privilège particulier : PowerShell ou Invite de commandes ouverts normalement.';
export const RSAT = 'Module ActiveDirectory (outils RSAT ou contrôleur de domaine), PowerShell ouvert avec un compte du domaine autorisé à lire l’annuaire.';
export const POSTE = 'Poste de travail Windows';

export const ps = (cmd) => ({ invite: 'PS>', cmd });
export const lec = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'lecture', explication, lignes, attendu, ...extra });
export const mod = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'modification', explication, lignes, attendu, ...extra });
export const src = (label, chemin) => ({ label, url: `${MS}${chemin}` });
export const WC = '/windows-server/administration/windows-commands';

const CIBLE = { id: 'cible', label: 'machine ou adresse à joindre', type: 'arg', exemple: 'www.example.com', aide: 'Un nom (www.example.com) ou une adresse IP (8.8.8.8).' };
export const COMPTE = { id: 'compte', label: 'nom du compte', type: 'identifiant', exemple: 'marie', aide: 'Le nom court du compte, sans espace.' };
export const PROCESSUS = { id: 'processus', label: 'nom du processus (sans .exe)', type: 'identifiant', exemple: 'notepad', aide: 'Le nom tel qu’il apparaît dans le Gestionnaire des tâches, sans « .exe » : notepad, chrome, msedge…' };

/** Fiche à UNE méthode PowerShell. */
export function fiche({ id, titre, categorie = POSTE, resume, effet, intentions, motsCles, params = [], privileges = USER, etapes, verification, retour = null, sources }) {
  return {
    id, titre, categorie, resume, effet, intentions, motsCles, params,
    origine: 'memo',
    methodes: [{ id: 'powershell', privileges, etapes, verification, retour }],
    sources, validation: V_DOC,
  };
}

export const PROCEDURES_WINDOWS_SIMPLES = [
  // =========================================================================
  // RÉSEAU : caches, lecture, diagnostic, pare-feu
  // =========================================================================
  fiche({
    id: 'win-cache-arp', titre: 'Vider le cache ARP', categorie: 'Réseau', effet: 'modification',
    resume: 'Efface la table ARP (correspondances adresse IP ↔ adresse MAC) quand un poste a changé de carte réseau ou que deux machines se sont disputé une adresse. Windows la reconstruit tout seul.',
    intentions: ['vider le cache arp', 'arp -d', 'effacer la table arp', 'mauvaise adresse mac en cache', 'delete arpcache'],
    motsCles: ['arp', 'cache', 'mac', 'netsh', 'table arp', 'voisins'], privileges: ADMIN,
    etapes: [
      lec('Voir la table ARP avant', 'Une ligne par voisin récemment contacté : adresse IP, adresse physique (MAC) et type.', [ps('arp -a')], 'Une liste d’adresses IP avec leur adresse physique. Les types « dynamique » sont ceux qui seront effacés.'),
      mod('Vider le cache ARP', 'Supprime les entrées dynamiques. Les entrées statiques (ajoutées à la main) restent.', [ps('netsh interface ip delete arpcache')], 'Le mot « OK. » s’affiche.', { important: 'Sans effet sur la connexion en cours : le poste redemande simplement l’adresse MAC de chaque voisin au prochain échange.' }),
      lec('Vérifier', 'La table doit être presque vide, puis se remplir au fil des échanges.', [ps('arp -a')], 'Moins d’entrées dynamiques qu’avant ; elles reviennent après un ping vers un voisin.', { verification: true }),
    ],
    verification: ['Le cache ARP est vidé, puis se remplit à nouveau avec les bonnes adresses MAC.'],
    retour: 'Rien à défaire : les entrées effacées sont reconstruites automatiquement.',
    sources: [src('arp', `${WC}/arp`), src('netsh interface ip', '/windows-server/networking/technologies/netsh/netsh-interface-ip')],
  }),
  fiche({
    id: 'win-cache-netbios', titre: 'Vider le cache de noms NetBIOS', categorie: 'Réseau', effet: 'modification',
    resume: 'Efface puis recharge la table des noms NetBIOS distants quand un nom de poste ou de partage est résolu vers une ancienne adresse. Utile avec les vieux partages réseau.',
    intentions: ['vider le cache netbios', 'nbtstat -r', 'nom netbios obsolète', 'recharger la table des noms netbios', 'nbtstat -rr'],
    motsCles: ['netbios', 'nbtstat', 'cache', 'wins', 'nom'], privileges: ADMIN,
    etapes: [
      lec('Voir le cache des noms distants', 'Les noms NetBIOS résolus récemment, avec leur adresse.', [ps('nbtstat -c')], 'Une liste de noms distants, ou « Aucun nom dans le cache » si rien n’a été résolu.'),
      mod('Purger et recharger', 'Vide le cache, puis recharge les entrées du fichier lmhosts.', [ps('nbtstat -R')], 'Le message « Purge et préchargement réussis de la table de cache de noms distants NetBIOS. » (selon la langue).'),
      mod('Libérer et réenregistrer les noms locaux', 'Facultatif : le poste libère ses propres noms et les réenregistre.', [ps('nbtstat -RR')], 'Un message de réussite pour l’envoi des requêtes de libération.', { facultatif: true }),
      lec('Vérifier', 'Le cache doit être vide ou ne contenir que des entrées récentes.', [ps('nbtstat -c')], 'Moins d’entrées qu’au début.', { verification: true }),
    ],
    verification: ['Le cache de noms distants est vidé ; les noms sont résolus à nouveau vers la bonne adresse.'],
    retour: 'Rien à défaire : le cache se reconstruit à l’usage.',
    sources: [src('nbtstat', `${WC}/nbtstat`)],
  }),
  fiche({
    id: 'win-ipconfig-complet', titre: 'Voir la configuration réseau complète (ipconfig /all)', categorie: 'Réseau', effet: 'lecture',
    resume: 'Affiche pour chaque carte l’adresse IP, le masque, la passerelle, les serveurs DNS, le serveur DHCP, le bail et l’adresse MAC. C’est la première lecture quand « le réseau ne marche pas ».',
    intentions: ['ipconfig /all', 'voir l’adresse mac', 'voir la passerelle et le dns', 'configuration réseau complète', 'voir le serveur dhcp d’un poste'],
    motsCles: ['ipconfig', 'mac', 'passerelle', 'dns', 'dhcp', 'get-netipconfiguration', 'carte réseau'],
    etapes: [
      lec('Afficher tout', 'Toutes les cartes, avec tous les détails. Descends jusqu’à la carte active (celle qui a une passerelle).', [ps('ipconfig /all')], 'Pour la carte active : adresse IPv4, masque, passerelle par défaut, serveurs DNS, serveur DHCP.'),
      lec('Version résumée en PowerShell', 'Une vue plus courte : une carte, son IP, sa passerelle et ses DNS.', [ps('Get-NetIPConfiguration')], 'Un bloc par carte connectée.'),
      lec('Vérifier la carte et son adresse MAC', 'L’adresse MAC sert à créer une réservation DHCP ou à reconnaître un appareil.', [ps('Get-NetAdapter | Select-Object Name, Status, MacAddress, LinkSpeed')], 'Une ligne par carte : état Up pour la carte active, adresse MAC au format 00-11-22-AA-BB-CC.', { verification: true }),
    ],
    verification: ['L’adresse IP, la passerelle et les DNS de la carte active sont ceux attendus.'],
    sources: [src('ipconfig', `${WC}/ipconfig`), src('Get-NetIPConfiguration', '/powershell/module/nettcpip/get-netipconfiguration'), src('Get-NetAdapter', '/powershell/module/netadapter/get-netadapter')],
  }),
  fiche({
    id: 'win-ip-liberer', titre: 'Libérer et renouveler l’adresse IP (release / renew)', categorie: 'Réseau', effet: 'interruption',
    resume: 'Rend l’adresse IP au serveur DHCP puis en redemande une. La connexion est coupée quelques secondes. À ne pas faire à distance (RDP) : la session tomberait.',
    intentions: ['libérer l’adresse ip', 'forcer une nouvelle adresse dhcp', 'rendre l’adresse au serveur dhcp', 'adresse 169.254 apipa', 'release puis renew'],
    motsCles: ['ipconfig', 'release', 'renew', 'dhcp', 'apipa', '169.254'], privileges: ADMIN,
    etapes: [
      lec('Noter l’adresse actuelle', 'Pour comparer après.', [ps('Get-NetIPAddress -AddressFamily IPv4 | Select-Object InterfaceAlias, IPAddress, PrefixOrigin')], 'La carte active avec son adresse (PrefixOrigin : Dhcp).'),
      mod('Libérer puis renouveler', 'Les deux commandes d’affilée : le réseau tombe puis revient. Si le DHCP ne répond pas, le poste prend une adresse en 169.254.x.x.', [ps('ipconfig /release'), ps('ipconfig /renew')], 'Une adresse IPv4 s’affiche pour la carte. Une adresse en 169.254 signifie qu’aucun serveur DHCP n’a répondu.', { important: 'Ne le fais jamais dans une session Bureau à distance : tu perdrais la connexion avant le renouvellement.' }),
      lec('Vérifier', 'La carte doit avoir une adresse valide de ton réseau et une passerelle.', [ps('ipconfig')], 'Une adresse IPv4 de ton réseau (pas 169.254) et la passerelle par défaut.', { verification: true }),
    ],
    verification: ['Le poste a une adresse du bon réseau fournie par le DHCP.'],
    retour: 'Rien à défaire. Si l’adresse reste en 169.254, vérifie le câble ou le Wi-Fi puis relance « ipconfig /renew ».',
    sources: [src('ipconfig', `${WC}/ipconfig`)],
  }),
  fiche({
    id: 'win-tracert', titre: 'Suivre le chemin vers une machine (tracert)', categorie: 'Réseau', effet: 'lecture',
    resume: 'Liste les routeurs traversés pour atteindre une destination, avec le temps à chaque saut. Montre où le trafic s’arrête ou ralentit.',
    intentions: ['tracert', 'suivre le chemin réseau', 'traceroute windows', 'voir les routeurs traversés', 'où le trafic s’arrête'],
    motsCles: ['tracert', 'traceroute', 'route', 'saut', 'latence', 'test-netconnection'],
    params: [CIBLE],
    etapes: [
      lec('Tracer le chemin', 'L’option -d évite de résoudre chaque nom : c’est plus rapide.', [ps('tracert -d {{cible}}')], 'Une ligne par saut, avec trois temps en ms. Des « * » successifs indiquent un routeur qui ne répond pas ou un blocage.'),
      lec('Même chose en PowerShell', 'Ajoute le test de connexion final.', [ps('Test-NetConnection {{cible}} -TraceRoute')], 'TraceRoute : la liste des adresses traversées ; PingSucceeded : True si la destination répond.', { verification: true }),
    ],
    verification: ['Le dernier saut est la destination, ou le saut où le trafic s’arrête est identifié.'],
    sources: [src('tracert', `${WC}/tracert`), src('Test-NetConnection', '/powershell/module/nettcpip/test-netconnection')],
  }),
  fiche({
    id: 'win-pathping', titre: 'Mesurer la perte de paquets saut par saut (pathping)', categorie: 'Réseau', effet: 'lecture',
    resume: 'Combine tracert et ping : après avoir listé les sauts, mesure la perte de paquets de chacun. Plus long qu’un tracert (environ deux minutes), mais montre quel saut perd des paquets.',
    intentions: ['pathping', 'perte de paquets par saut', 'trouver le saut qui perd des paquets', 'diagnostic perte réseau windows', 'latence par routeur'],
    motsCles: ['pathping', 'perte', 'paquets', 'saut', 'latence'],
    params: [CIBLE],
    etapes: [
      lec('Lancer la mesure', 'Dix requêtes par saut, sans résolution de noms. Compte une à deux minutes avant le résultat.', [ps('pathping -n -q 10 {{cible}}')], 'D’abord la liste des sauts, puis après « Calcul des statistiques », un tableau avec le pourcentage de perte par saut.'),
      lec('Vérifier la destination', 'Confirme que la destination finale répond.', [ps('Test-Connection -ComputerName {{cible}} -Count 4')], 'Quatre réponses avec leur temps, sans perte.', { verification: true }),
    ],
    verification: ['Le saut où la perte apparaît est identifié ; la destination finale répond.'],
    sources: [src('pathping', `${WC}/pathping`)],
  }),
  fiche({
    id: 'win-winsock-reinit', titre: 'Réinitialiser la pile réseau (Winsock et TCP/IP)', categorie: 'Réseau', effet: 'interruption',
    resume: 'Remet à zéro le catalogue Winsock et la pile TCP/IP quand la connexion est cassée sans raison apparente (après un virus, un VPN ou un logiciel de sécurité désinstallé). Un redémarrage est nécessaire.',
    intentions: ['netsh winsock reset', 'réinitialiser la pile tcp/ip', 'réparer la connexion internet windows', 'netsh int ip reset', 'réinitialiser le réseau windows'],
    motsCles: ['winsock', 'netsh', 'tcp/ip', 'réinitialiser', 'réseau', 'réparer'], privileges: ADMIN,
    etapes: [
      lec('Noter l’état actuel', 'Pour comparer avant et après le redémarrage.', [ps('Get-NetIPConfiguration')], 'La configuration actuelle des cartes.'),
      mod('Réinitialiser Winsock', 'Remet le catalogue des protocoles réseau à son état d’origine.', [ps('netsh winsock reset')], 'Le message « Réinitialisation réussie du catalogue Winsock. Vous devez redémarrer l’ordinateur. »'),
      mod('Réinitialiser la pile IP', 'Réécrit les clés de registre de TCP/IP. Une adresse IP fixe doit être saisie à nouveau ensuite.', [ps('netsh int ip reset')], 'Une série de lignes « Réinitialisation… OK ! ».', { important: 'Si le poste utilise une adresse IP fixe, note-la avant : elle peut être remise en DHCP.' }),
      lec('Après le redémarrage : vérifier', 'Redémarre le poste, puis teste la sortie réseau.', [ps('Test-NetConnection')], 'PingSucceeded : True et une adresse IP source valide.', { verification: true }),
    ],
    verification: ['Après le redémarrage, le poste a une adresse valide et joint Internet.'],
    retour: 'Pas de retour direct : la commande remet les valeurs d’origine. Retape l’adresse IP fixe si le poste en utilisait une.',
    sources: [src('netsh winsock', '/windows-server/networking/technologies/netsh/netsh-winsock'), src('netsh interface ip', '/windows-server/networking/technologies/netsh/netsh-interface-ip')],
  }),
  fiche({
    id: 'win-route-voir', titre: 'Voir la table de routage du poste', categorie: 'Réseau', effet: 'lecture',
    resume: 'Liste les routes connues du poste : la route par défaut (0.0.0.0) et les routes des réseaux directement reliés. Sert à comprendre par quelle passerelle sort un paquet.',
    intentions: ['route print', 'voir la table de routage windows', 'passerelle par défaut du poste', 'get-netroute', 'quelle route prend le trafic'],
    motsCles: ['route', 'routage', 'passerelle', 'get-netroute', '0.0.0.0', 'métrique'],
    etapes: [
      lec('Afficher les routes IPv4', 'La table classique, avec la métrique de chaque route.', [ps('route print -4')], 'Une section « Tableau de routage IPv4 » avec la ligne 0.0.0.0 0.0.0.0 et la passerelle.'),
      lec('Version PowerShell, triée', 'Les routes triées par métrique : la plus basse gagne.', [ps('Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric | Select-Object DestinationPrefix, NextHop, RouteMetric, InterfaceAlias | Format-Table -AutoSize')], 'Une ligne par route ; 0.0.0.0/0 pointe vers ta passerelle.'),
      lec('Vérifier la route par défaut', 'Il doit y avoir une route par défaut, sinon le poste ne sort pas de son réseau.', [ps('Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Select-Object NextHop, RouteMetric, InterfaceAlias')], 'Au moins une ligne avec la passerelle attendue.', { verification: true }),
    ],
    verification: ['La route par défaut existe et pointe vers la bonne passerelle.'],
    sources: [src('route', `${WC}/route_ws2008`), src('Get-NetRoute', '/powershell/module/nettcpip/get-netroute')],
  }),
  fiche({
    id: 'win-arp-voir', titre: 'Voir les voisins du réseau (table ARP)', categorie: 'Réseau', effet: 'lecture',
    resume: 'Affiche les machines récemment jointes avec leur adresse IP et leur adresse MAC. Pratique pour retrouver l’adresse MAC d’un appareil ou repérer deux machines avec la même IP.',
    intentions: ['arp -a', 'voir la table arp', 'retrouver l’adresse mac d’une machine', 'get-netneighbor', 'voir les voisins réseau'],
    motsCles: ['arp', 'mac', 'voisin', 'get-netneighbor', 'table'],
    etapes: [
      lec('Afficher la table ARP', 'Elle ne contient que les machines contactées récemment : fais d’abord un ping vers celle qui t’intéresse.', [ps('arp -a')], 'Des blocs par interface, avec adresse Internet, adresse physique et type.'),
      lec('Version PowerShell', 'Ajoute l’état de chaque voisin (Reachable, Stale…).', [ps('Get-NetNeighbor -AddressFamily IPv4 | Select-Object IPAddress, LinkLayerAddress, State, InterfaceAlias')], 'Une ligne par voisin avec son adresse MAC.', { verification: true }),
    ],
    verification: ['L’adresse MAC attendue apparaît pour l’adresse IP de la machine ciblée.'],
    sources: [src('arp', `${WC}/arp`), src('Get-NetNeighbor', '/powershell/module/nettcpip/get-netneighbor')],
  }),
  fiche({
    id: 'win-wifi-profils', titre: 'Voir les réseaux Wi-Fi enregistrés et leur clé', categorie: 'Réseau', effet: 'lecture',
    resume: 'Liste les réseaux Wi-Fi mémorisés par le poste et affiche la clé de l’un d’eux. Sert à retrouver une clé oubliée pour connecter un autre appareil.',
    intentions: ['retrouver la clé wifi', 'netsh wlan show profiles', 'voir les réseaux wifi enregistrés', 'afficher le mot de passe wifi enregistré', 'oublié la clé du wifi'],
    motsCles: ['wifi', 'wlan', 'netsh', 'profil', 'clé', 'sécurité'], privileges: ADMIN,
    params: [{ id: 'profil', label: 'nom du réseau Wi-Fi', type: 'nom', exemple: 'MaisonWiFi', aide: 'Le nom exact du réseau, tel qu’affiché par la première commande.' }],
    etapes: [
      lec('Lister les réseaux enregistrés', 'Un nom par profil Wi-Fi mémorisé.', [ps('netsh wlan show profiles')], 'La liste « Profils utilisateur » avec le nom de chaque réseau.'),
      lec('Afficher la clé d’un réseau', 'La clé apparaît sous « Contenu de la clé » dans la section Paramètres de sécurité.', [ps('netsh wlan show profile name="{{profil}}" key=clear')], 'Une ligne « Contenu de la clé » avec la clé en clair.', { important: 'La clé s’affiche à l’écran : ne la copie pas dans un message et efface l’écran après (cls).', verification: true }),
    ],
    verification: ['Le réseau voulu est dans la liste et sa clé s’affiche.'],
    sources: [src('netsh wlan', '/windows-server/networking/technologies/netsh/netsh-wlan')],
  }),
  fiche({
    id: 'win-pare-feu-etat', titre: 'Voir l’état du pare-feu Windows', categorie: 'Réseau', effet: 'lecture',
    resume: 'Montre si le pare-feu est activé pour chaque profil (domaine, privé, public) et le comportement par défaut du trafic entrant. Lecture seule.',
    intentions: ['état du pare-feu windows', 'pare-feu activé ou désactivé', 'get-netfirewallprofile', 'netsh advfirewall show', 'vérifier le firewall windows'],
    motsCles: ['pare-feu', 'firewall', 'profil', 'netsh', 'advfirewall', 'get-netfirewallprofile'],
    etapes: [
      lec('Lire les trois profils', 'Domaine, Privé, Public : Enabled doit être True partout, sauf choix volontaire.', [ps('Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction')], 'Trois lignes. DefaultInboundAction : Block est la valeur sûre.'),
      lec('Même lecture avec netsh', 'Pratique sur un poste où PowerShell est restreint.', [ps('netsh advfirewall show allprofiles state')], 'Pour chaque profil : État ACTIVÉ (ou ON).', { verification: true }),
    ],
    verification: ['Les trois profils sont activés (sauf exception connue).'],
    sources: [src('Get-NetFirewallProfile', '/powershell/module/netsecurity/get-netfirewallprofile'), src('netsh advfirewall', '/windows-server/networking/technologies/netsh/netsh-advfirewall')],
  }),
  fiche({
    id: 'win-pare-feu-ouvrir-port', titre: 'Ouvrir un port entrant dans le pare-feu', categorie: 'Réseau', effet: 'modification',
    resume: 'Crée une règle qui autorise le trafic TCP entrant sur un port, pour un service installé sur ce poste. La règle porte un nom pour être retrouvée et supprimée facilement.',
    intentions: ['ouvrir un port dans le pare-feu windows', 'new-netfirewallrule', 'autoriser un port entrant', 'netsh advfirewall add rule', 'débloquer un port tcp'],
    motsCles: ['pare-feu', 'firewall', 'port', 'règle', 'new-netfirewallrule', 'entrant'], privileges: ADMIN,
    params: [
      { id: 'nom', label: 'nom de la règle', type: 'nom', exemple: 'Lab-Web-8080', aide: 'Un nom parlant, pour retrouver la règle plus tard.' },
      { id: 'port', label: 'port TCP à ouvrir', type: 'port', exemple: '8080', aide: 'Un numéro entre 1 et 65535.' },
    ],
    etapes: [
      lec('Vérifier que la règle n’existe pas déjà', 'Évite les doublons.', [ps('Get-NetFirewallRule -DisplayName "{{nom}}" -ErrorAction SilentlyContinue')], 'Aucune sortie : la règle n’existe pas encore.'),
      mod('Créer la règle', 'Autorise le TCP entrant sur ce port, sur tous les profils.', [ps('New-NetFirewallRule -DisplayName "{{nom}}" -Direction Inbound -Protocol TCP -LocalPort {{port}} -Action Allow')], 'Un résumé de la règle créée, avec Enabled : True et Action : Allow.', { important: 'N’ouvre que les ports d’un service réellement installé et à jour : un port ouvert est une porte d’entrée.' }),
      lec('Vérifier', 'La règle doit exister, activée, avec le bon port.', [ps('Get-NetFirewallRule -DisplayName "{{nom}}" | Get-NetFirewallPortFilter | Select-Object Protocol, LocalPort')], 'Protocol : TCP et LocalPort : le port choisi.', { verification: true }),
    ],
    verification: ['La règle existe, est activée et autorise le bon port.'],
    retour: 'Remove-NetFirewallRule -DisplayName "(nom de la règle)" supprime la règle (voir la fiche « Fermer un port »).',
    sources: [src('New-NetFirewallRule', '/powershell/module/netsecurity/new-netfirewallrule'), src('Get-NetFirewallRule', '/powershell/module/netsecurity/get-netfirewallrule')],
  }),
  fiche({
    id: 'win-pare-feu-fermer-port', titre: 'Fermer un port : supprimer une règle du pare-feu', categorie: 'Réseau', effet: 'modification',
    resume: 'Supprime une règle de pare-feu créée pour ouvrir un port. À utiliser quand le service n’est plus nécessaire. La règle disparue, le trafic retombe sous le comportement par défaut.',
    intentions: ['supprimer une règle de pare-feu', 'remove-netfirewallrule', 'fermer un port ouvert', 'retirer une règle firewall', 'netsh advfirewall delete rule'],
    motsCles: ['pare-feu', 'firewall', 'règle', 'supprimer', 'remove-netfirewallrule', 'port'], privileges: ADMIN,
    params: [{ id: 'nom', label: 'nom de la règle à supprimer', type: 'nom', exemple: 'Lab-Web-8080', aide: 'Le nom exact de la règle, tel que listé par Get-NetFirewallRule.' }],
    etapes: [
      lec('Voir la règle avant de la supprimer', 'Contrôle que c’est bien la bonne.', [ps('Get-NetFirewallRule -DisplayName "{{nom}}" | Select-Object DisplayName, Enabled, Direction, Action')], 'Une ligne avec le nom, Direction et Action de la règle.'),
      mod('Supprimer la règle', 'Supprime la règle portant exactement ce nom.', [ps('Remove-NetFirewallRule -DisplayName "{{nom}}"')], 'Aucun message en cas de succès.', { important: 'Ne supprime jamais une règle système (Bureau à distance, Partage de fichiers…) sans savoir ce qui en dépend.' }),
      lec('Vérifier', 'La règle ne doit plus exister.', [ps('Get-NetFirewallRule -DisplayName "{{nom}}" -ErrorAction SilentlyContinue')], 'Aucune sortie.', { verification: true }),
    ],
    verification: ['La règle n’apparaît plus dans la liste.'],
    retour: 'Recrée la règle avec la fiche « Ouvrir un port entrant dans le pare-feu ».',
    sources: [src('Remove-NetFirewallRule', '/powershell/module/netsecurity/remove-netfirewallrule')],
  }),
];
