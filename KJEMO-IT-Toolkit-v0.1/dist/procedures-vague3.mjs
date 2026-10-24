/**
 * procedures-vague3.mjs — UX-COMMANDES-PROCEDURES-02 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Troisième vague de fiches TÂCHE : gestes courants Windows (PowerShell, CMD,
 * interface graphique), Linux/Bash et Cisco IOS, y compris des briques réutilisées
 * par les scénarios (scenarios.mjs).
 *
 * Même contrat que les vagues précédentes (vérifié par le banc) : aucune invite
 * dans les commandes, paramètres déclarés et validés, une vérification par
 * méthode, sources HTTPS, et aucune commande exécutée par le Toolkit.
 */

const V_DOC = 'Commandes relues contre la documentation de l’éditeur ; non exécutées sur un poste, un serveur ou un équipement réel.';
const MS = 'https://learn.microsoft.com';
const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

const lec = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'lecture', explication, lignes, attendu, ...extra });
const ps = (cmd) => ({ invite: 'PS>', cmd });
const cmdw = (cmd) => ({ invite: '>', cmd });
const sh = (cmd) => ({ invite: '$', cmd });
const ios = (cmd) => ({ invite: 'Switch#', cmd });

export const PROCEDURES_VAGUE3 = [
  {
    id: 'windows-ip-fixe',
    titre: 'Donner une adresse IP fixe à un poste Windows',
    categorie: 'Réseau',
    resume: 'Remplace l’adressage automatique (DHCP) d’une carte réseau par une adresse, un préfixe et une passerelle que tu choisis. Le poste perd sa connexion le temps du changement ; le serveur DNS est fixé à la main dans la même fiche.',
    effet: 'interruption',
    intentions: ['ip fixe windows', 'adresse ip statique', 'configurer une ip statique windows', 'désactiver dhcp', 'new-netipaddress', 'netsh set address'],
    motsCles: ['ip', 'statique', 'fixe', 'dhcp', 'passerelle', 'masque', 'carte', 'netsh', 'new-netipaddress', 'windows'],
    params: [
      { id: 'carte', label: 'nom de la carte réseau', type: 'nom', exemple: 'Ethernet', aide: 'Le nom affiché dans « ncpa.cpl » ou par Get-NetIPConfiguration (ex. Ethernet, Wi-Fi). Sans guillemets.' },
      { id: 'ip', label: 'adresse IP du poste', type: 'ipv4', exemple: '192.168.1.50', aide: 'Une adresse libre du réseau, hors de la plage DHCP.' },
      { id: 'prefixe', label: 'préfixe du réseau', type: 'prefixe', exemple: '24', aide: 'De 8 à 30 (24 = 255.255.255.0).' },
      { id: 'passerelle', label: 'passerelle par défaut', type: 'ipv4', exemple: '192.168.1.1', aide: 'L’adresse du routeur de ce réseau, dans le même réseau que le poste.' },
      { id: 'dns', label: 'serveur DNS', type: 'ipv4', exemple: '192.168.1.1', aide: 'Une carte en adressage statique doit aussi avoir son DNS fixé : sans lui, les noms ne se résolvent plus. Souvent l’adresse de la passerelle ou d’un serveur DNS interne.' },
    ],
    methodes: [
      { id: 'powershell', privileges: 'PowerShell **en administrateur**.', etapes: [
        lec('Lire la configuration actuelle', 'Note le nom exact de la carte, son adresse actuelle et si DHCP est actif : c’est ton retour en arrière.', [ps('Get-NetIPConfiguration')], 'Une entrée par carte, avec « InterfaceAlias », les adresses IPv4 et la passerelle.'),
        { titre: 'Désactiver DHCP sur la carte', effet: 'interruption', explication: 'Sans cela, New-NetIPAddress refuse parfois de définir l’adresse : la carte reste en adressage automatique.', lignes: [ps('Set-NetIPInterface -InterfaceAlias "{{carte}}" -Dhcp Disabled')], attendu: 'Aucun message. La carte peut perdre son adresse actuelle.', important: 'Si tu es connecté à distance par cette carte, tu perds la session. Fais ce changement sur place.' },
        { titre: 'Définir l’adresse, le préfixe et la passerelle', effet: 'interruption', explication: 'Crée l’adresse sur la carte et la route par défaut vers la passerelle.', lignes: [ps('New-NetIPAddress -InterfaceAlias "{{carte}}" -IPAddress {{ip}} -PrefixLength {{prefixe}} -DefaultGateway {{passerelle}}')], attendu: 'PowerShell affiche les propriétés de l’adresse créée (IPAddress, PrefixLength, PrefixOrigin « Manual »).', important: 'Si la carte avait déjà une passerelle, PowerShell peut répondre que la route existe : lis-la à l’étape 1 et retire-la d’abord (Remove-NetRoute) — le Toolkit ne le fait pas pour toi.' },
        { titre: 'Définir le serveur DNS', effet: 'modification', explication: 'Remplace les serveurs DNS de la carte par celui que tu as indiqué (la liste précédente est écrasée).', lignes: [ps('Set-DnsClientServerAddress -InterfaceAlias "{{carte}}" -ServerAddresses {{dns}}')], attendu: 'Aucun message en cas de succès.', important: 'Sans cette étape, une carte passée en statique peut ne plus résoudre les noms.' },
        lec('Vérifier', 'Relit la carte, puis envoie deux paquets à la passerelle.', [ps('Get-NetIPConfiguration -InterfaceAlias "{{carte}}"'), ps('Test-Connection -ComputerName {{passerelle}} -Count 2')], 'L’adresse choisie apparaît sur la carte, avec la bonne passerelle et le DNS choisi. La passerelle répond, sauf si elle filtre le ping.', { verification: true }),
      ], verification: ['« Get-NetIPConfiguration » montre l’adresse choisie en origine Manual, la passerelle et le DNS.'], retour: 'Pour revenir à l’adressage automatique : « Set-NetIPInterface -InterfaceAlias "<carte>" -Dhcp Enabled » puis « Set-DnsClientServerAddress -InterfaceAlias "<carte>" -ResetServerAddresses ». Retire aussi l’adresse et la route manuelles si elles persistent (Remove-NetIPAddress, Remove-NetRoute).' },
      { id: 'cmd', privileges: 'Invite de commandes **en administrateur**.', etapes: [
        lec('Lire la configuration actuelle', 'Note le nom exact de la carte et son adresse actuelle : c’est ton retour en arrière.', [cmdw('ipconfig /all')], 'Une section par carte, avec « Adresse IPv4 », « DHCP activé » et la passerelle.'),
        { titre: 'Définir l’adresse, le masque et la passerelle', effet: 'interruption', explication: 'netsh passe la carte en adressage statique et fixe l’adresse, le masque et la passerelle en une commande.', lignes: [cmdw('netsh interface ip set address name="{{carte}}" source=static addr={{ip}} mask={{prefixeMasque}} gateway={{passerelle}}')], attendu: 'Aucun message en cas de succès (netsh n’affiche rien).', important: 'Le poste perd sa connexion le temps du changement : ne le fais pas à distance par cette carte.' },
        { titre: 'Définir le serveur DNS', effet: 'modification', explication: 'Fixe le serveur DNS de la carte ; l’éventuelle liste précédente est remplacée.', lignes: [cmdw('netsh interface ip set dnsserver name="{{carte}}" source=static addr={{dns}} register=primary')], attendu: 'Aucun message en cas de succès.', important: 'La documentation précise qu’une carte en statique doit aussi avoir son DNS fixé à la main : sans cette étape, les noms peuvent ne plus se résoudre.' },
        lec('Vérifier', 'Relit la configuration et teste la passerelle.', [cmdw('ipconfig /all'), cmdw('ping {{passerelle}}')], '« DHCP activé : Non », l’adresse choisie et le serveur DNS choisi ; la passerelle répond, sauf si elle filtre le ping.', { verification: true }),
      ], verification: ['« ipconfig /all » indique « DHCP activé : Non », l’adresse choisie et le DNS choisi.'], retour: 'Pour revenir à DHCP : « netsh interface ip set address name="<carte>" source=dhcp » puis « netsh interface ip set dnsserver name="<carte>" source=dhcp ».' },
      { id: 'gui', privileges: 'Compte administrateur du poste.', etapes: [
        { titre: 'Ouvrir les propriétés IPv4 de la carte', effet: 'interruption', explication: 'Identique sous Windows 10 et 11 : la boîte « Connexions réseau » classique.', actions: ['Touche **Windows + R**, tape `ncpa.cpl`, Entrée.', 'Clic droit sur la carte voulue → **Propriétés**.', 'Sélectionne **Protocole Internet version 4 (TCP/IPv4)** → **Propriétés**.', 'Coche **Utiliser l’adresse IP suivante**, puis renseigne **Adresse IP**, **Masque de sous-réseau** et **Passerelle par défaut**.', 'Coche **Utiliser l’adresse de serveur DNS suivante** et renseigne **Serveur DNS préféré**.', 'Valide avec **OK**, puis **Fermer**.'], attendu: 'La connexion se rétablit avec l’adresse choisie. Contrôle avec « ipconfig /all ».', important: 'Le masque se saisit en notation pointée (24 = 255.255.255.0). Sans serveur DNS saisi, les noms peuvent ne plus se résoudre.' },
      ], verification: ['« ipconfig /all » indique l’adresse choisie et « DHCP activé : Non ».'], retour: 'Même fenêtre : coche **Obtenir une adresse IP automatiquement**.' },
    ],
    assistant: null,
    sources: [
      { label: 'New-NetIPAddress', url: `${MS}/powershell/module/nettcpip/new-netipaddress` },
      { label: 'Set-NetIPInterface', url: `${MS}/powershell/module/nettcpip/set-netipinterface` },
      { label: 'Netsh interface ip — set address, set dnsserver (documentation archivée, Windows Server 2008 R2)', url: `${MS}/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc731521(v=ws.10)` },
      { label: 'Set-DnsClientServerAddress', url: `${MS}/powershell/module/dnsclient/set-dnsclientserveraddress` },
    ],
    validation: V_DOC,
  },
  {
    id: 'linux-espace-disque',
    titre: 'Voir l’espace disque sous Linux',
    categorie: 'Linux et services réseau',
    resume: 'Montre l’espace libre par système de fichiers, les disques et partitions présents, puis les dossiers les plus gros d’un chemin. Lecture seule.',
    effet: 'lecture',
    intentions: ['espace disque linux', 'df -h', 'disque plein linux', 'taille des dossiers', 'du sort', 'lsblk'],
    motsCles: ['df', 'du', 'lsblk', 'disque', 'espace', 'partition', 'inodes', 'linux', 'bash'],
    params: [],
    methodes: [{ id: 'linux', privileges: 'Utilisateur ordinaire ; sudo pour lire les dossiers qui ne t’appartiennent pas.', etapes: [
      lec('Espace libre par système de fichiers', 'Une ligne par volume monté : taille, utilisé, libre et pourcentage.', [sh('df -h')], 'Un pourcentage « Use% » proche de 100 sur un volume signale le manque de place.'),
      lec('Disques et partitions', 'Montre l’arborescence des disques et leurs points de montage.', [sh('lsblk')], 'Chaque disque (TYPE disk) avec ses partitions (part) et leur MOUNTPOINT.'),
      lec('Les dix plus gros dossiers de la racine', 'Mesure chaque dossier du premier niveau du volume racine (option -x : sans traverser les autres volumes), du plus gros au plus petit. Peut durer plusieurs minutes.', [sh('sudo du -xh --max-depth=1 / 2>/dev/null | sort -rh | head -n 10')], 'Dix lignes « taille chemin », la première étant le dossier lui-même.', { verification: true, mode: 'sudo conseillé' }),
    ], verification: ['Le volume qui se remplit est identifié, ainsi que le dossier de premier niveau qui le remplit.'], retour: null }],
    assistant: null,
    sources: [
      { label: 'df(1)', url: `${MAN}/man1/df.1.html` },
      { label: 'du(1)', url: `${MAN}/man1/du.1.html` },
      { label: 'lsblk(8)', url: `${MAN}/man8/lsblk.8.html` },
    ],
    validation: V_DOC,
  },
  {
    id: 'linux-ports-ecoute',
    titre: 'Voir les ports en écoute sous Linux',
    categorie: 'Linux et services réseau',
    resume: 'Liste les ports TCP et UDP sur lesquels la machine attend des connexions, avec le processus concerné. Lecture seule.',
    effet: 'lecture',
    intentions: ['ports en écoute linux', 'ss -ltnp', 'quel service écoute', 'port ouvert linux', 'netstat linux'],
    motsCles: ['ss', 'port', 'écoute', 'listen', 'tcp', 'udp', 'linux', 'processus'],
    params: [],
    methodes: [{ id: 'linux', privileges: 'Utilisateur ordinaire ; sudo pour afficher le nom des processus des autres utilisateurs.', etapes: [
      lec('Ports TCP en écoute', 'Une ligne par port : adresse locale, port et processus (avec sudo).', [sh('sudo ss -ltnp')], 'Des lignes « LISTEN » ; une adresse 0.0.0.0 ou [::] écoute sur toutes les interfaces, 127.0.0.1 seulement en local.', { verification: true }),
      lec('Ports UDP en écoute', 'Même lecture pour UDP, qui n’a pas d’état « LISTEN ».', [sh('sudo ss -lunp')], 'Une ligne par socket UDP ouvert, avec le processus.'),
    ], verification: ['Le port attendu est en écoute sur la bonne adresse, par le bon processus.'], retour: null }],
    assistant: null,
    sources: [{ label: 'ss(8)', url: `${MAN}/man8/ss.8.html` }],
    validation: V_DOC,
  },
  {
    id: 'windows-ports-ecoute',
    titre: 'Voir les ports en écoute sous Windows',
    categorie: 'Réseau',
    resume: 'Liste les ports TCP sur lesquels le poste attend des connexions, avec le processus qui les ouvre. Lecture seule.',
    effet: 'lecture',
    params: [{ id: 'pid', label: 'PID du processus', type: 'entier', min: 1, max: 4294967295, methodes: ['cmd'], exemple: '1234', aide: 'Le nombre en dernière colonne de la commande précédente (CMD seulement : PowerShell affiche déjà le nom du processus).' }],
    intentions: ['ports en écoute windows', 'netstat windows', 'get-nettcpconnection', 'quel programme utilise le port', 'port ouvert windows'],
    motsCles: ['netstat', 'get-nettcpconnection', 'port', 'écoute', 'listening', 'tcp', 'pid', 'windows'],
    methodes: [
      { id: 'powershell', privileges: 'PowerShell ordinaire ; en administrateur pour voir tous les processus.', etapes: [
        lec('Lister les ports TCP en écoute', 'Associe chaque port au nom du processus qui l’ouvre.', [ps('Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess, @{n="Processus";e={(Get-Process -Id $_.OwningProcess).ProcessName}} | Sort-Object LocalPort')], 'Un tableau trié par port : adresse locale, port, PID et nom du processus.', { verification: true }),
      ], verification: ['Le port attendu apparaît avec le bon processus.'], retour: null },
      { id: 'cmd', privileges: 'Invite ordinaire ; en administrateur pour voir tous les processus.', etapes: [
        lec('Lister les ports TCP en écoute', 'netstat affiche le PID ; le nom du processus s’obtient avec la commande suivante.', [cmdw('netstat -ano | findstr LISTENING')], 'Des lignes « TCP adresse:port … LISTENING PID » (IPv4 et IPv6). Les sockets UDP, sans état « LISTENING », n’apparaissent pas ici.', { verification: true }),
        lec('Retrouver le programme d’un PID', 'Donne le nom du programme qui porte le PID lu ci-dessus (dernière colonne de netstat). Le PowerShell affiche ce nom directement.', [cmdw('tasklist /fi "PID eq {{pid}}"')], 'Le nom de l’image (exécutable) qui porte ce PID.'),
      ], verification: ['Le port attendu est en LISTENING, avec le PID du bon programme.'], retour: null },
    ],
    assistant: null,
    sources: [
      { label: 'Get-NetTCPConnection', url: `${MS}/powershell/module/nettcpip/get-nettcpconnection` },
      { label: 'netstat', url: `${MS}/windows-server/administration/windows-commands/netstat` },
    ],
    validation: V_DOC,
  },
  {
    id: 'cisco-voir-routes',
    titre: 'Voir les interfaces et la table de routage d’un routeur',
    categorie: 'Réseau et Cisco',
    resume: 'Affiche l’état et l’adresse de chaque interface du routeur puis sa table de routage : de quoi vérifier qu’un réseau est connu. Lecture seule.',
    effet: 'lecture',
    intentions: ['table de routage cisco', 'show ip route', 'show ip interface brief', 'interfaces du routeur', 'route connue'],
    motsCles: ['show ip route', 'show ip interface brief', 'routeur', 'routage', 'cisco', 'interface', 'passerelle'],
    params: [],
    methodes: [{ id: 'ios', privileges: 'Mode privilégié (enable).', etapes: [
      lec('Interfaces et adresses', 'Une ligne par interface : adresse IP, état (Status) et protocole (Protocol).', [{ invite: 'Router#', cmd: 'show ip interface brief' }], '« up / up » pour une interface en service ; « administratively down » si elle n’a pas été activée.', { mode: 'Mode privilégié' }),
      lec('Table de routage', 'Les codes C (connecté), L (local), S (statique) indiquent comment chaque réseau est connu.', [{ invite: 'Router#', cmd: 'show ip route' }], 'Une ligne « C » par réseau directement connecté ; un réseau absent de la table est injoignable depuis ce routeur.', { mode: 'Mode privilégié', verification: true }),
    ], verification: ['Le réseau cherché figure dans la table, derrière la bonne interface.'], retour: null }],
    assistant: null,
    sources: [{ label: 'IP Routing — commandes show (Cisco)', url: 'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/iproute_pi/command/iri-cr-book.html' }],
    validation: V_DOC,
  },
];
