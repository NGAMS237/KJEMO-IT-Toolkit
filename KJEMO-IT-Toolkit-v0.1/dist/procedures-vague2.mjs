/**
 * procedures-vague2.mjs — UX-COMMANDES-PROCEDURES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Deuxième vague de fiches TÂCHE rédigées : les gestes courants du poste
 * Windows, de l'annuaire, de Cisco et d'Azure, dont les assistants complets
 * restent la voie guidée (validations, script complet, téléchargement).
 *
 * Même contrat que procedures-pilotes.mjs, vérifié par le banc : aucune
 * invite dans les commandes, paramètres déclarés et validés, une vérification
 * par méthode, sources HTTPS, et aucune commande exécutée par le Toolkit.
 */

const V_DOC = 'Commandes relues contre la documentation de l’éditeur ; non exécutées sur un poste, un tenant ou un équipement réel.';
const MS = 'https://learn.microsoft.com';
const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';
const C1000 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst1000/software/release/15-2_7_e';
const SRC_CISCO_VLAN = { label: 'Catalyst 1000 — Configuring VLAN', url: `${C1000}/configuration_guides/vlan/b_1527e_vlan_c1000_cg/configuring_vlan.html` };

const lec = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'lecture', explication, lignes, attendu, ...extra });
const ps = (cmd) => ({ invite: 'PS>', cmd });
const cmdw = (cmd) => ({ invite: '>', cmd });
const sh = (cmd) => ({ invite: '$', cmd });
const ios = (cmd) => ({ invite: 'Switch#', cmd });

export const PROCEDURES_VAGUE2 = [
  {
    id: 'tester-ping',
    titre: 'Tester si une machine répond (ping)',
    categorie: 'Réseau',
    resume: 'Envoie quelques paquets de test à une machine ou à une adresse et dit si elle répond. Un ping qui échoue ne prouve pas que la machine est éteinte : elle peut simplement filtrer le ping.',
    effet: 'lecture',
    intentions: ['tester un ping', 'ping', 'la machine répond-elle', 'joindre une machine', 'test-connection', 'vérifier la connectivité'],
    motsCles: ['ping', 'icmp', 'connectivité', 'test-connection', 'réseau', 'joindre'],
    params: [{ id: 'cible', label: 'adresse ou nom de la machine', type: 'identifiant', exemple: '192.168.1.1', aide: 'Une adresse IP ou un nom (sans espace).' }],
    methodes: [
      { id: 'powershell', privileges: 'Utilisateur ordinaire.', etapes: [
        lec('Envoyer quatre paquets', 'Test-Connection envoie quatre paquets par défaut et affiche une ligne par réponse.', [ps('Test-Connection -ComputerName {{cible}} -Count 4')], 'Une ligne par paquet avec le temps de réponse. Aucune ligne de réponse : la cible ne répond pas (éteinte, injoignable ou ping filtré).', { verification: true }),
      ], verification: ['Les quatre paquets reçoivent une réponse.'], retour: null },
      { id: 'cmd', privileges: 'Utilisateur ordinaire.', etapes: [
        lec('Envoyer quatre paquets', 'Sous Windows, ping envoie quatre paquets par défaut.', [cmdw('ping {{cible}}')], 'Quatre lignes « Réponse de … » puis des statistiques ; « Délai d’attente de la demande dépassé » signale l’absence de réponse.', { verification: true }),
      ], verification: ['Statistiques : 0 % de perte.'], retour: null },
      { id: 'linux', privileges: 'Utilisateur ordinaire.', etapes: [
        lec('Envoyer quatre paquets', 'Sous Linux, ping continue sans fin : -c 4 limite à quatre paquets.', [sh('ping -c 4 {{cible}}')], 'Quatre lignes « bytes from … » puis un résumé avec le pourcentage de perte.', { verification: true, options: [{ option: '-c', explication: '-c 4 arrête la commande après quatre paquets envoyés.' }] }),
      ], verification: ['Résumé : 0 % packet loss.'], retour: null },
    ],
    assistant: 'ping-traceroute',
    sources: [{ label: 'Test-Connection', url: `${MS}/powershell/module/microsoft.powershell.management/test-connection` }, { label: 'ping (Windows)', url: `${MS}/windows-server/administration/windows-commands/ping` }, { label: 'ping(8)', url: `${MAN}/man8/ping.8.html` }],
    validation: V_DOC,
  },
  {
    id: 'tester-port-tcp',
    titre: 'Tester si un port TCP est ouvert',
    categorie: 'Réseau',
    resume: 'Tente une connexion TCP vers un port précis d’une machine, pour savoir si le service écoute et si rien ne le bloque en chemin. Une seule tentative de connexion, aucune donnée envoyée.',
    effet: 'lecture',
    intentions: ['tester un port', 'port ouvert', 'test-netconnection', 'telnet port', 'le service répond-il sur le port', 'tester le port 443'],
    motsCles: ['port', 'tcp', 'test-netconnection', 'connexion', 'pare-feu', 'ouvert'],
    params: [
      { id: 'cible', label: 'adresse ou nom de la machine', type: 'identifiant', exemple: 'srv-fichiers', aide: 'Une adresse IP ou un nom (sans espace).' },
      { id: 'port', label: 'port', type: 'port', exemple: '445', aide: 'De 1 à 65535 (par exemple 445 pour SMB, 443 pour HTTPS).' },
    ],
    methodes: [{ id: 'powershell', privileges: 'Utilisateur ordinaire.', etapes: [
      lec('Tester la connexion TCP', 'Test-NetConnection tente la connexion et résume le résultat.', [ps('Test-NetConnection -ComputerName {{cible}} -Port {{port}}')], '« TcpTestSucceeded : True » : le port répond. « False » : fermé, filtré par un pare-feu, ou service arrêté.', { verification: true }),
    ], verification: ['TcpTestSucceeded vaut True.'], retour: null }],
    assistant: 'tcp-port-test',
    sources: [{ label: 'Test-NetConnection', url: `${MS}/powershell/module/nettcpip/test-netconnection` }],
    validation: V_DOC,
  },
  {
    id: 'resoudre-nom-dns',
    titre: 'Résoudre un nom DNS',
    categorie: 'Réseau',
    resume: 'Demande au DNS l’adresse d’un nom, pour vérifier qu’un enregistrement existe et pointe au bon endroit. Lecture seule.',
    effet: 'lecture',
    intentions: ['résoudre un nom dns', 'nslookup', 'resolve-dnsname', 'quelle adresse pour ce nom', 'tester le dns', 'dns ne résout pas'],
    motsCles: ['dns', 'nslookup', 'resolve-dnsname', 'résolution', 'nom', 'enregistrement', 'resolvectl'],
    params: [{ id: 'nom', label: 'nom à résoudre', type: 'identifiant', exemple: 'www.example.com', aide: 'Un nom de machine ou un nom complet (sans espace).' }],
    methodes: [
      { id: 'powershell', privileges: 'Utilisateur ordinaire.', etapes: [lec('Résoudre le nom', 'Interroge le DNS configuré sur le poste.', [ps('Resolve-DnsName {{nom}}')], 'Une ou plusieurs lignes avec le type d’enregistrement (A, AAAA, CNAME) et l’adresse. Une erreur « DNS name does not exist » : le nom n’existe pas pour ce serveur.', { verification: true })], verification: ['L’adresse obtenue est celle attendue.'], retour: null },
      { id: 'cmd', privileges: 'Utilisateur ordinaire.', etapes: [lec('Résoudre le nom', 'nslookup interroge directement un serveur DNS et affiche lequel : il ignore le cache DNS du poste et le fichier hosts, que Resolve-DnsName et la plupart des programmes consultent.', [cmdw('nslookup {{nom}}')], 'Le serveur DNS utilisé, puis « Nom » et « Adresse » de la cible. « Non-existent domain » : le nom n’existe pas.', { verification: true })], verification: ['Le serveur interrogé et l’adresse sont ceux attendus.'], retour: null },
      { id: 'linux', privileges: 'Utilisateur ordinaire ; systemd-resolved gère le DNS (Ubuntu par défaut).', etapes: [lec('Résoudre le nom', 'resolvectl query passe par le même chemin que les applications.', [sh('resolvectl query {{nom}}')], 'Les adresses trouvées, l’interface et le serveur utilisés.', { verification: true })], verification: ['L’adresse obtenue est celle attendue.'], retour: null },
    ],
    assistant: 'dns-client-diagnostic',
    sources: [{ label: 'Resolve-DnsName', url: `${MS}/powershell/module/dnsclient/resolve-dnsname` }, { label: 'nslookup', url: `${MS}/windows-server/administration/windows-commands/nslookup` }, { label: 'resolvectl(1)', url: `${MAN}/man1/resolvectl.1.html` }],
    validation: V_DOC,
  },
  {
    id: 'renouveler-bail-dhcp',
    titre: 'Renouveler l’adresse IP (DHCP)',
    categorie: 'Réseau',
    resume: 'Rend l’adresse obtenue par DHCP puis en redemande une. La connexion réseau est coupée quelques secondes ; sur un accès à distance, la session peut tomber.',
    effet: 'interruption',
    intentions: ['renouveler l’adresse ip', 'ipconfig /renew', 'ipconfig /release', 'renouveler le bail dhcp', 'obtenir une nouvelle adresse ip'],
    motsCles: ['dhcp', 'ipconfig', 'renew', 'release', 'bail', 'adresse', '169.254'],
    params: [],
    methodes: [{ id: 'cmd', privileges: 'Invite de commandes ouverte en administrateur.', etapes: [
      lec('Noter l’adresse actuelle', 'Garde une trace pour comparer après.', [cmdw('ipconfig')], 'Pour chaque carte, l’adresse IPv4 et la passerelle.'),
      { titre: 'Rendre l’adresse actuelle', effet: 'interruption', explication: 'Libère le bail DHCP : la carte n’a plus d’adresse tant que l’étape suivante n’est pas faite.', lignes: [cmdw('ipconfig /release')], attendu: 'Les cartes DHCP affichent une adresse vide ou 0.0.0.0.', important: 'La connexion réseau tombe. À ne pas faire sur la carte par laquelle tu es connecté à distance.' },
      { titre: 'Redemander une adresse', effet: 'modification', explication: 'Demande un nouveau bail au serveur DHCP.', lignes: [cmdw('ipconfig /renew')], attendu: 'Une adresse IPv4 revient pour chaque carte DHCP. Une adresse en 169.254.x.x signifie qu’aucun serveur DHCP n’a répondu.' },
      lec('Vérifier', 'Compare avec l’adresse notée à l’étape 1.', [cmdw('ipconfig /all')], 'Adresse, passerelle et serveurs DNS fournis par le DHCP ; « Bail obtenu » à la date du jour.', { verification: true }),
    ], verification: ['La carte a une adresse du réseau attendu, pas de 169.254.x.x.'], retour: 'Rien à défaire : le serveur DHCP réattribue en général la même adresse.' }],
    assistant: 'dhcp-client-diagnostic',
    sources: [{ label: 'ipconfig', url: `${MS}/windows-server/administration/windows-commands/ipconfig` }],
    validation: V_DOC,
  },
  {
    id: 'redemarrer-service-windows',
    titre: 'Redémarrer un service Windows',
    categorie: 'Poste de travail Windows',
    resume: 'Arrête puis relance un service Windows. Ce que le service fait s’interrompt le temps du redémarrage ; certains services dépendent d’autres services qui s’arrêtent avec lui.',
    effet: 'interruption',
    intentions: ['redémarrer un service windows', 'restart-service', 'relancer un service windows', 'net stop net start', 'relancer le service'],
    motsCles: ['service', 'restart-service', 'net stop', 'net start', 'services.msc', 'redémarrer', 'windows'],
    params: [{ id: 'service', label: 'nom du service', type: 'identifiant', exemple: 'Spooler', aide: 'Le nom court du service (pas le nom affiché).' }],
    methodes: [
      { id: 'powershell', privileges: 'Console PowerShell ouverte en administrateur.', etapes: [
        lec('Lire l’état avant', 'Garde une trace de l’état de départ.', [ps('Get-Service -Name {{service}}')], 'Status « Running » ou « Stopped ».'),
        { titre: 'Redémarrer', effet: 'interruption', explication: 'Arrête puis relance le service.', lignes: [ps('Restart-Service -Name {{service}}')], attendu: 'Aucun message en cas de succès.', important: 'Le service est indisponible pendant le redémarrage ; ses services dépendants sont arrêtés avec lui.' },
        lec('Vérifier', 'Le service doit être revenu.', [ps('Get-Service -Name {{service}}')], 'Status « Running ».', { verification: true }),
      ], verification: ['Status vaut Running.'], retour: 'Un redémarrage ne se défait pas ; si le service ne repart pas, consulte le journal des événements.' },
      { id: 'cmd', privileges: 'Invite de commandes ouverte en administrateur.', etapes: [
        { titre: 'Arrêter le service', effet: 'interruption', explication: 'Arrête le service.', lignes: [cmdw('net stop {{service}}')], attendu: '« Le service … a été arrêté. »', important: 'Le service est indisponible tant qu’il n’est pas relancé à l’étape suivante.' },
        { titre: 'Relancer le service', effet: 'modification', explication: 'Démarre de nouveau le service.', lignes: [cmdw('net start {{service}}')], attendu: '« Le service … a démarré. »' },
        lec('Vérifier', 'Confirme l’état.', [cmdw('sc query {{service}}')], 'STATE : RUNNING.', { verification: true }),
      ], verification: ['STATE vaut RUNNING.'], retour: null },
      { id: 'gui', privileges: 'Administrateur.', etapes: [
        { titre: 'Ouvrir la console Services', effet: 'lecture', explication: 'Elle liste les services et permet de les redémarrer.', actions: ['Appuie sur **Win + R**.', 'Tape `services.msc` puis valide avec **Entrée**.'], attendu: 'La fenêtre « Services » s’ouvre.' },
        { titre: 'Redémarrer le service', effet: 'interruption', explication: 'Le menu contextuel du service propose Redémarrer.', actions: ['Repère le service dans la liste.', 'Clic droit sur le service, puis **Redémarrer**.'], attendu: 'La colonne **État** repasse à « En cours d’exécution ».', important: 'Le service est interrompu pendant le redémarrage.', verification: true },
      ], verification: ['État : En cours d’exécution.'], retour: null },
    ],
    assistant: 'windows-service-control',
    sources: [{ label: 'Restart-Service', url: `${MS}/powershell/module/microsoft.powershell.management/restart-service` }, { label: 'net stop', url: `${MS}/windows-server/administration/windows-commands/net-stop` }, { label: 'net start', url: `${MS}/windows-server/administration/windows-commands/net-start` }],
    validation: V_DOC,
  },
  {
    id: 'reparer-fichiers-systeme',
    titre: 'Réparer les fichiers système (SFC, DISM)',
    categorie: 'Poste de travail Windows',
    resume: 'Vérifie les fichiers protégés de Windows et répare ceux qui sont corrompus. L’analyse est longue (plusieurs minutes) ; la réparation DISM a besoin d’un accès à Windows Update ou à une source de réparation.',
    effet: 'modification',
    intentions: ['réparer les fichiers système', 'sfc /scannow', 'dism restorehealth', 'windows corrompu', 'fichiers système corrompus', 'vérifier l’intégrité de windows'],
    motsCles: ['sfc', 'dism', 'scannow', 'restorehealth', 'corrompu', 'réparation', 'windows'],
    params: [],
    methodes: [{ id: 'cmd', privileges: 'Invite de commandes ou PowerShell ouverte en administrateur.', etapes: [
      { titre: 'Vérifier et réparer avec SFC', effet: 'modification', explication: 'Analyse tous les fichiers système protégés et remplace les fichiers abîmés par la copie en cache.', lignes: [cmdw('sfc /scannow')], attendu: '« Protection des ressources Windows n’a trouvé aucune violation d’intégrité » : rien à faire. « …a trouvé des fichiers corrompus et les a réparés » : terminé. « …n’a pas pu réparer » : passe à l’étape 2.', important: 'L’analyse dure plusieurs minutes : ne ferme pas la fenêtre. Elle peut remplacer des fichiers système.' },
      { titre: 'Réparer l’image Windows avec DISM', effet: 'modification', facultatif: true, explication: 'À faire seulement si SFC n’a pas pu réparer. DISM répare la source que SFC utilise.', lignes: [cmdw('DISM /Online /Cleanup-Image /RestoreHealth')], attendu: '« L’opération de restauration s’est terminée correctement. »', important: 'Demande un accès à Windows Update ; peut durer longtemps et paraître bloqué à 20 % ou 62 % : attends.' },
      { titre: 'Relancer SFC', effet: 'modification', facultatif: true, explication: 'Après DISM, SFC peut maintenant réparer ce qu’il n’avait pas pu.', lignes: [cmdw('sfc /scannow')], attendu: 'Aucune violation d’intégrité, ou fichiers réparés.', verification: true },
    ], verification: ['SFC ne signale plus de violation d’intégrité.'], retour: 'La réparation ne se défait pas ; pour garder une trace, consulte le journal CBS.log.' }],
    assistant: 'sfc-repair',
    sources: [{ label: 'sfc', url: `${MS}/windows-server/administration/windows-commands/sfc` }, { label: 'DISM — Repair a Windows image', url: `${MS}/windows-hardware/manufacture/desktop/repair-a-windows-image` }],
    validation: V_DOC,
  },
  {
    id: 'appliquer-strategies-groupe',
    titre: 'Forcer l’application des stratégies de groupe',
    categorie: 'GPO',
    resume: 'Demande au poste de relire les stratégies de groupe tout de suite, au lieu d’attendre le cycle automatique, puis affiche celles qui s’appliquent. Certains réglages ne prennent effet qu’après fermeture de session ou redémarrage.',
    effet: 'modification',
    intentions: ['forcer les gpo', 'gpupdate /force', 'appliquer les stratégies de groupe', 'gpresult', 'la gpo ne s’applique pas', 'rafraîchir les stratégies'],
    motsCles: ['gpo', 'gpupdate', 'gpresult', 'stratégie de groupe', 'force', 'rsop'],
    params: [],
    methodes: [{ id: 'cmd', privileges: 'Invite de commandes ouverte en administrateur (pour les stratégies de l’ordinateur).', etapes: [
      { titre: 'Forcer la mise à jour', effet: 'modification', explication: 'Relit toutes les stratégies, même celles qui n’ont pas changé.', lignes: [cmdw('gpupdate /force')], attendu: '« La mise à jour de la stratégie utilisateur s’est terminée sans erreur » et le même message pour l’ordinateur.', important: 'Certains réglages demandent une fermeture de session ou un redémarrage : la commande te le dit.' },
      lec('Voir ce qui s’applique', 'Affiche les stratégies réellement appliquées au poste et à l’utilisateur.', [cmdw('gpresult /r')], 'Les listes « Objets de stratégie de groupe appliqués » pour l’ordinateur et l’utilisateur ; ta GPO doit y figurer.', { verification: true }),
    ], verification: ['La GPO attendue figure dans les objets appliqués.'], retour: 'Rien à défaire : la commande ne modifie aucune stratégie, elle les relit.' }],
    assistant: 'gpo-resultant-set',
    sources: [{ label: 'gpupdate', url: `${MS}/windows-server/administration/windows-commands/gpupdate` }, { label: 'gpresult', url: `${MS}/windows-server/administration/windows-commands/gpresult` }],
    validation: V_DOC,
  },
  {
    id: 'espace-disque-windows',
    titre: 'Voir l’espace libre des disques Windows',
    categorie: 'Analyse et nettoyage des disques',
    resume: 'Affiche la taille et l’espace libre de chaque volume. Lecture seule ; pour savoir quels dossiers occupent la place, l’assistant d’analyse prend le relais.',
    effet: 'lecture',
    intentions: ['espace disque', 'disque plein', 'espace libre', 'get-volume', 'taille des disques windows', 'voir l’espace disque'],
    motsCles: ['disque', 'espace', 'volume', 'get-volume', 'libre', 'plein', 'stockage'],
    params: [],
    methodes: [
      { id: 'powershell', privileges: 'Utilisateur ordinaire.', etapes: [lec('Lister les volumes', 'Une ligne par volume : lettre, taille et espace restant.', [ps('Get-Volume | Select-Object DriveLetter, FileSystemLabel, Size, SizeRemaining')], 'Les tailles sont en octets. Compare SizeRemaining à Size : moins de 10 % de libre est un seuil d’alerte courant.', { verification: true })], verification: ['SizeRemaining est suffisant pour chaque volume.'], retour: null },
      { id: 'gui', privileges: 'Utilisateur ordinaire.', etapes: [{ titre: 'Ouvrir Ce PC', effet: 'lecture', explication: 'L’Explorateur de fichiers affiche une jauge par disque.', actions: ['Ouvre l’**Explorateur de fichiers** (**Win + E**).', 'Clique sur **Ce PC** dans le volet de gauche.'], attendu: 'Une jauge par disque avec « X Go libres sur Y Go ». La jauge passe au rouge quand le disque est presque plein.', verification: true }], verification: ['L’espace libre est suffisant.'], retour: null },
    ],
    assistant: 'disk-scan',
    sources: [{ label: 'Get-Volume', url: `${MS}/powershell/module/storage/get-volume` }],
    validation: V_DOC,
  },
  {
    id: 'journal-evenements-windows',
    titre: 'Lire les dernières erreurs du journal Windows',
    categorie: 'Poste de travail Windows',
    resume: 'Affiche les 20 dernières erreurs du journal Système, pour retrouver la cause d’un plantage, d’un service arrêté ou d’un pilote défaillant. Lecture seule.',
    effet: 'lecture',
    intentions: ['journal des événements', 'erreurs windows', 'get-winevent', 'observateur d’événements', 'eventvwr', 'pourquoi windows plante', 'erreurs système'],
    motsCles: ['journal', 'événements', 'get-winevent', 'eventvwr', 'erreur', 'système', 'log'],
    params: [],
    methodes: [
      { id: 'powershell', privileges: 'Utilisateur ordinaire pour le journal Système.', etapes: [lec('Lister les 20 dernières erreurs', 'Niveau 2 = Erreur. Chaque ligne donne l’heure, la source et un message.', [ps('Get-WinEvent -FilterHashtable @{LogName=\'System\'; Level=2} -MaxEvents 20')], 'Jusqu’à 20 événements, du plus récent au plus ancien. Repère l’heure du problème et la colonne ProviderName.', { verification: true })], verification: ['L’événement lié au problème figure dans la liste.'], retour: null },
      { id: 'cmd', privileges: 'Utilisateur ordinaire pour le journal Système.', etapes: [lec('Lister les 20 dernières erreurs', 'wevtutil lit le journal Système ; « /q » filtre le niveau 2 (Erreur), « /rd:true » met les plus récentes en premier, « /c:20 » limite à vingt.', [cmdw('wevtutil qe System /q:"*[System[(Level=2)]]" /c:20 /rd:true /f:text')], 'Jusqu’à 20 événements en texte, du plus récent au plus ancien : repère l’heure du problème et la ligne « Source ». Le format diffère de celui de PowerShell (texte brut, pas de tableau).', { verification: true })], verification: ['L’événement lié au problème figure dans la liste.'], retour: null },
      { id: 'gui', privileges: 'Utilisateur ordinaire.', etapes: [
        { titre: 'Ouvrir l’observateur d’événements', effet: 'lecture', explication: 'L’outil intégré à Windows pour lire les journaux.', actions: ['Appuie sur **Win + R**.', 'Tape `eventvwr.msc` puis valide avec **Entrée**.'], attendu: 'La fenêtre « Observateur d’événements » s’ouvre.' },
        { titre: 'Filtrer les erreurs du journal Système', effet: 'lecture', explication: 'Le filtre ne garde que les erreurs.', actions: ['Déplie **Journaux Windows**, puis clique sur **Système**.', 'Dans le volet de droite, clique sur **Filtrer le journal actuel…**.', 'Coche **Erreur**, puis valide avec **OK**.'], attendu: 'La liste centrale ne montre plus que les erreurs ; clique sur une ligne pour lire son détail.', verification: true },
      ], verification: ['L’événement lié au problème figure dans la liste.'], retour: null },
    ],
    assistant: 'workstation-health-report',
    sources: [{ label: 'Get-WinEvent', url: `${MS}/powershell/module/microsoft.powershell.diagnostics/get-winevent` }, { label: 'wevtutil', url: `${MS}/windows-server/administration/windows-commands/wevtutil` }],
    validation: V_DOC,
  },
  {
    id: 'ad-debloquer-compte',
    titre: 'Débloquer un compte Active Directory',
    categorie: 'Active Directory',
    resume: 'Lève le verrouillage d’un compte utilisateur après trop de mots de passe erronés. Le mot de passe n’est pas modifié ; si le compte se reverrouille, une machine ou une application garde un ancien mot de passe.',
    effet: 'modification',
    intentions: ['débloquer un compte', 'compte verrouillé', 'unlock-adaccount', 'déverrouiller un utilisateur', 'compte active directory bloqué'],
    motsCles: ['active directory', 'compte', 'verrouillé', 'unlock-adaccount', 'lockedout', 'utilisateur', 'ad'],
    params: [{ id: 'compte', label: 'nom de connexion (SamAccountName)', type: 'identifiant', exemple: 'jdupont', aide: 'Le nom de connexion court de l’utilisateur.' }],
    methodes: [
      { id: 'powershell', privileges: 'Module ActiveDirectory (outils RSAT) et droit délégué de déverrouiller les comptes.', etapes: [
        lec('Confirmer que le compte est verrouillé', 'LockedOut doit valoir True.', [ps('Get-ADUser -Identity {{compte}} -Properties LockedOut | Select-Object SamAccountName, LockedOut')], 'LockedOut : True. Si c’est False, le blocage vient d’ailleurs (compte désactivé, mot de passe expiré).'),
        { titre: 'Déverrouiller le compte', effet: 'modification', explication: 'Lève le verrouillage ; le mot de passe reste le même.', lignes: [ps('Unlock-ADAccount -Identity {{compte}}')], attendu: 'Aucun message en cas de succès.', important: 'Si le compte se reverrouille vite, cherche la machine ou l’application qui présente encore l’ancien mot de passe.' },
        lec('Vérifier', 'LockedOut doit être revenu à False.', [ps('Get-ADUser -Identity {{compte}} -Properties LockedOut | Select-Object SamAccountName, LockedOut')], 'LockedOut : False.', { verification: true }),
      ], verification: ['LockedOut vaut False et l’utilisateur peut se connecter.'], retour: 'Un déverrouillage ne se « défait » pas ; le compte se reverrouille de lui-même après de nouvelles erreurs.' },
      { id: 'gui', privileges: 'Console « Utilisateurs et ordinateurs Active Directory » et droit de déverrouiller.', etapes: [
        { titre: 'Ouvrir la console', effet: 'lecture', explication: 'La console de gestion des comptes du domaine.', actions: ['Appuie sur **Win + R**.', 'Tape `dsa.msc` puis valide avec **Entrée**.'], attendu: 'La fenêtre « Utilisateurs et ordinateurs Active Directory » s’ouvre.' },
        { titre: 'Déverrouiller le compte', effet: 'modification', explication: 'La case se trouve dans l’onglet Compte.', actions: ['Retrouve l’utilisateur (clic droit sur le domaine, **Rechercher…**).', 'Double-clique sur l’utilisateur, onglet **Compte**.', 'Coche **Déverrouiller le compte**, puis **OK**.'], attendu: 'La case disparaît quand tu rouvres les propriétés : le compte n’est plus verrouillé.', verification: true },
      ], verification: ['L’utilisateur peut se connecter.'], retour: null },
    ],
    assistant: 'ad-account-recovery',
    sources: [{ label: 'Unlock-ADAccount', url: `${MS}/powershell/module/activedirectory/unlock-adaccount` }, { label: 'Get-ADUser', url: `${MS}/powershell/module/activedirectory/get-aduser` }],
    validation: V_DOC,
  },
  {
    id: 'ad-etat-replication',
    titre: 'Voir l’état de la réplication Active Directory',
    categorie: 'Active Directory',
    resume: 'Résume la réplication entre contrôleurs de domaine : dernières réussites, échecs et ancienneté. Lecture seule, à lancer depuis un contrôleur de domaine ou un poste avec les outils d’administration.',
    effet: 'lecture',
    intentions: ['réplication active directory', 'repadmin', 'repadmin /replsummary', 'contrôleurs de domaine ne se répliquent pas', 'état de la réplication'],
    motsCles: ['active directory', 'réplication', 'repadmin', 'replsummary', 'contrôleur de domaine', 'dc'],
    params: [],
    methodes: [{ id: 'cmd', privileges: 'Invite de commandes avec un compte pouvant lire la réplication du domaine.', etapes: [
      lec('Résumé de la réplication', 'Une ligne par contrôleur : plus grand intervalle depuis la dernière réplication et nombre d’échecs.', [cmdw('repadmin /replsummary')], 'La colonne « échecs / total » doit être à 0 ; « plus grand delta » de quelques minutes à une heure en fonctionnement normal.'),
      lec('Détail par partenaire', 'Montre, pour chaque partition, la dernière réplication réussie et l’éventuel code d’erreur.', [cmdw('repadmin /showrepl')], 'Chaque ligne « Dernière tentative … a réussi ». Un message d’échec donne le code d’erreur à rechercher.', { verification: true }),
    ], verification: ['Aucun échec de réplication n’est signalé.'], retour: null }],
    assistant: 'ad-repadmin-report',
    sources: [{ label: 'repadmin', url: `${MS}/windows-server/administration/windows-commands/repadmin` }],
    validation: V_DOC,
  },

  // =========================================================================
  // CISCO
  // =========================================================================
  {
    id: 'cisco-voir-vlans',
    titre: 'Voir les VLAN du commutateur',
    categorie: 'Réseau et Cisco',
    resume: 'Liste les VLAN existants et les ports qui y sont affectés. Lecture seule ; c’est la première lecture avant de créer un VLAN ou de déplacer un port.',
    effet: 'lecture',
    intentions: ['voir les vlan', 'show vlan brief', 'liste des vlan', 'quels vlan existent', 'ports par vlan'],
    motsCles: ['vlan', 'show vlan', 'brief', 'cisco', 'ports', 'commutateur'],
    params: [],
    methodes: [{ id: 'ios', privileges: 'Mode privilégié (enable), ou mode utilisateur selon la configuration.', etapes: [
      lec('Lister les VLAN et leurs ports', 'Une ligne par VLAN : numéro, nom, état et ports d’accès affectés.', [ios('show vlan brief')], 'Le VLAN 1 (default) et les VLAN créés, avec l’état « active ». Les ports en trunk n’apparaissent pas dans cette liste.', { mode: 'Mode privilégié', verification: true }),
    ], verification: ['Le VLAN attendu est « active » avec les bons ports.'], retour: null }],
    assistant: 'cisco-vlan-inventaire',
    sources: [SRC_CISCO_VLAN],
    validation: V_DOC,
  },
  {
    id: 'cisco-voir-trunks',
    titre: 'Voir les liaisons trunk',
    categorie: 'Réseau et Cisco',
    resume: 'Affiche les ports en trunk, leur VLAN natif et les VLAN autorisés. Lecture seule ; utile quand un VLAN « ne passe pas » d’un commutateur à l’autre.',
    effet: 'lecture',
    intentions: ['voir les trunks', 'show interfaces trunk', 'trunk', 'vlan ne passe pas', 'liaison entre commutateurs'],
    motsCles: ['trunk', 'show interfaces trunk', 'vlan natif', 'autorisés', 'cisco', '802.1q'],
    params: [],
    methodes: [{ id: 'ios', privileges: 'Mode privilégié (enable).', etapes: [
      lec('Lister les trunks', 'Trois blocs : ports en trunk, VLAN autorisés, VLAN actifs et transmis.', [ios('show interfaces trunk')], 'Le port du lien apparaît avec « trunking » ; le VLAN cherché doit figurer dans « allowed » ET « forwarding ». Aucun port : aucun trunk actif.', { mode: 'Mode privilégié', verification: true }),
    ], verification: ['Le VLAN attendu est transmis sur le trunk.'], retour: null }],
    assistant: 'cisco-trunk-diagnostic',
    sources: [SRC_CISCO_VLAN],
    validation: V_DOC,
  },
  {
    id: 'cisco-trouver-adresse-mac',
    titre: 'Trouver sur quel port se trouve une adresse MAC',
    categorie: 'Réseau et Cisco',
    resume: 'Lit la table d’adresses MAC du commutateur pour retrouver le port auquel un appareil est branché, ou ce qu’apprend un port donné. Lecture seule.',
    effet: 'lecture',
    intentions: ['trouver une adresse mac', 'show mac address-table', 'sur quel port est branché', 'table mac', 'retrouver un appareil'],
    motsCles: ['mac', 'address-table', 'table mac', 'port', 'cisco', 'cam'],
    params: [{ id: 'interface', label: 'interface', type: 'interfaceIos', exemple: 'Fa0/7', aide: 'Fa0/7 ou Gi0/1 (2960) — Gi1/0/7 (Catalyst 1000, 9200).' }],
    methodes: [{ id: 'ios', privileges: 'Mode privilégié (enable).', etapes: [
      lec('Lire toute la table', 'Une ligne par adresse apprise : VLAN, adresse, type et port.', [ios('show mac address-table')], 'Les adresses de type DYNAMIC, associées au port où elles ont été vues. Cherche l’adresse de l’appareil : son port est dans la dernière colonne.', { mode: 'Mode privilégié' }),
      lec('Lire seulement un port', 'Limite la liste à ce que le commutateur a appris sur ce port.', [ios('show mac address-table interface {{interface}}')], 'Les adresses vues sur ce port ; plusieurs adresses indiquent un autre commutateur ou un poste avec un téléphone derrière.', { mode: 'Mode privilégié', verification: true }),
    ], verification: ['L’adresse attendue est sur le bon port et dans le bon VLAN.'], retour: null }],
    assistant: 'cisco-table-mac',
    sources: [{ label: 'Catalyst 1000 — Command Reference : Layer 2', url: `${C1000}/command_reference/b_1527e_1000_cr/layer_2_commands.html` }],
    validation: V_DOC,
  },

  // =========================================================================
  // AZURE
  // =========================================================================
  {
    id: 'azure-changer-abonnement',
    titre: 'Choisir l’abonnement Azure actif',
    categorie: 'Azure et Entra ID',
    resume: 'Change l’abonnement sur lequel s’appliquent les commandes suivantes. Seul le contexte local de ta console change : aucune ressource Azure n’est touchée. Vérifie-le toujours avant de créer ou supprimer quoi que ce soit.',
    effet: 'modification',
    intentions: ['changer d’abonnement azure', 'az account set', 'set-azcontext', 'choisir l’abonnement', 'mauvais abonnement azure'],
    motsCles: ['azure', 'abonnement', 'subscription', 'az account set', 'set-azcontext', 'contexte'],
    params: [{ id: 'abonnement', label: 'identifiant de l’abonnement', type: 'identifiant', exemple: '00000000-0000-0000-0000-000000000000', aide: 'L’identifiant (GUID) lu dans « az account list » ou « Get-AzSubscription ». L’exemple est fictif.' }],
    methodes: [
      { id: 'azure', privileges: 'Azure CLI connecté (`az login`, fait par toi) ; aucun rôle particulier requis.', etapes: [
        lec('Lister les abonnements', 'Repère l’identifiant de l’abonnement voulu.', [sh('az account list --output table')], 'Un tableau avec le nom, l’identifiant (SubscriptionId) et IsDefault.'),
        { titre: 'Choisir l’abonnement', effet: 'modification', explication: 'Définit l’abonnement par défaut de ta console. Rien n’est modifié dans Azure.', lignes: [sh('az account set --subscription {{abonnement}}')], attendu: 'Aucun message en cas de succès.', important: 'Toutes les commandes suivantes visent ce nouvel abonnement : vérifie-le à l’étape 3.' },
        lec('Vérifier', 'Confirme l’abonnement maintenant actif.', [sh('az account show --output table')], 'Le nom et l’identifiant de l’abonnement choisi.', { verification: true }),
      ], verification: ['« az account show » affiche l’abonnement voulu.'], retour: 'Repasse l’ancien identifiant avec la même commande.' },
      { id: 'powershell', privileges: 'Module Az installé et session ouverte (`Connect-AzAccount`, faite par toi).', etapes: [
        lec('Lister les abonnements', 'Repère l’identifiant voulu.', [ps('Get-AzSubscription')], 'Les abonnements visibles par ce compte, avec leur Id.'),
        { titre: 'Choisir l’abonnement', effet: 'modification', explication: 'Change le contexte de la session. Rien n’est modifié dans Azure.', lignes: [ps('Set-AzContext -Subscription {{abonnement}}')], attendu: 'Le nouveau contexte est affiché.', important: 'Toutes les commandes suivantes visent ce nouvel abonnement.' },
        lec('Vérifier', 'Confirme le contexte actif.', [ps('Get-AzContext')], 'SubscriptionName et SubscriptionId de l’abonnement choisi.', { verification: true }),
      ], verification: ['Get-AzContext affiche l’abonnement voulu.'], retour: 'Repasse l’ancien identifiant avec la même commande.' },
    ],
    assistant: 'azure-contexte',
    sources: [{ label: 'az account set', url: `${MS}/cli/azure/account` }, { label: 'Set-AzContext', url: `${MS}/powershell/module/az.accounts/set-azcontext` }],
    validation: 'Commandes relues contre la documentation Microsoft ; non exécutées sur un tenant réel.',
  },
  {
    id: 'azure-lister-groupes-ressources',
    titre: 'Lister les groupes de ressources Azure',
    categorie: 'Azure et Entra ID',
    resume: 'Liste les groupes de ressources de l’abonnement actif. Lecture seule ; demande au moins le rôle Lecteur sur l’abonnement.',
    effet: 'lecture',
    intentions: ['lister les groupes de ressources', 'az group list', 'get-azresourcegroup', 'resource group azure', 'voir les ressources azure'],
    motsCles: ['azure', 'groupe de ressources', 'resource group', 'az group list', 'get-azresourcegroup'],
    params: [],
    methodes: [
      { id: 'azure', privileges: 'Azure CLI connecté ; rôle Lecteur sur l’abonnement.', etapes: [lec('Lister les groupes', 'Une ligne par groupe : nom, région et état.', [sh('az group list --output table')], 'Un tableau Name / Location / Status. Vérifie d’abord l’abonnement actif (fiche « Vérifier le compte et l’abonnement Azure actifs »).', { verification: true })], verification: ['Le groupe cherché figure dans la liste.'], retour: null },
      { id: 'powershell', privileges: 'Module Az connecté ; rôle Lecteur sur l’abonnement.', etapes: [lec('Lister les groupes', 'Une entrée par groupe de ressources.', [ps('Get-AzResourceGroup | Select-Object ResourceGroupName, Location')], 'Un tableau ResourceGroupName / Location.', { verification: true })], verification: ['Le groupe cherché figure dans la liste.'], retour: null },
    ],
    assistant: 'azure-abonnements-rg',
    sources: [{ label: 'az group list', url: `${MS}/cli/azure/group` }, { label: 'Get-AzResourceGroup', url: `${MS}/powershell/module/az.resources/get-azresourcegroup` }],
    validation: 'Commandes relues contre la documentation Microsoft ; non exécutées sur un tenant réel.',
  },
  {
    id: 'azure-etat-machines-virtuelles',
    titre: 'Voir l’état des machines virtuelles Azure',
    categorie: 'Azure et Entra ID',
    resume: 'Liste les machines virtuelles de l’abonnement avec leur état (en cours, arrêtée, désallouée). Lecture seule. Une VM arrêtée mais pas désallouée continue d’être facturée en calcul.',
    effet: 'lecture',
    intentions: ['état des machines virtuelles azure', 'az vm list', 'get-azvm', 'vm azure arrêtée', 'lister les vm'],
    motsCles: ['azure', 'vm', 'machine virtuelle', 'az vm list', 'get-azvm', 'état', 'désallouée'],
    params: [],
    methodes: [
      { id: 'azure', privileges: 'Azure CLI connecté ; rôle Lecteur sur l’abonnement.', etapes: [lec('Lister les VM avec leur état', '« --show-details » ajoute l’état d’alimentation de chaque VM.', [sh('az vm list --show-details --output table')], 'La colonne PowerState vaut « VM running », « VM stopped » ou « VM deallocated ». « stopped » n’arrête pas la facturation du calcul ; « deallocated » oui.', { verification: true, options: [{ option: '--show-details', explication: '--show-details ajoute l’état d’alimentation et les adresses IP à la liste.' }, { option: '--output', explication: '--output table présente le résultat en tableau lisible.' }] })], verification: ['PowerState correspond à l’état attendu.'], retour: null },
      { id: 'powershell', privileges: 'Module Az connecté ; rôle Lecteur sur l’abonnement.', etapes: [lec('Lister les VM avec leur état', '« -Status » interroge l’état d’alimentation de chaque VM.', [ps('Get-AzVM -Status')], 'La colonne PowerState vaut « VM running », « VM stopped » ou « VM deallocated ».', { verification: true })], verification: ['PowerState correspond à l’état attendu.'], retour: null },
    ],
    assistant: 'azure-vm-inventaire',
    sources: [{ label: 'az vm list', url: `${MS}/cli/azure/vm` }, { label: 'Get-AzVM', url: `${MS}/powershell/module/az.compute/get-azvm` }],
    validation: 'Commandes relues contre la documentation Microsoft ; non exécutées sur un tenant réel.',
  },
];
