/**
 * procedures-domaine-reconstruire.mjs — KJEMO-RECONSTRUIRE-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Reconstruire un domaine Samba AD : régler le DNS d'un poste Windows, sortir un poste Ubuntu ou
 * Windows d'un domaine dont le serveur n'existe plus, puis un parcours qui enchaîne les fiches dans
 * l'ordre. Chaque fiche offre l'OPTION GRAPHIQUE à côté des commandes. Non exécuté sur de vrais postes.
 */
import { MAN, CATEGORIE_LINUX, lec, mod, des, itr, sh, ps, gui, ficheLinux } from './cours-outils.mjs';
import { fiche as ficheWin, src, ADMIN, V_DOC } from './procedures-windows-simples.mjs';

const annul = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
const ANCIEN = { id: 'ancienNom', label: 'nom du poste avant la jonction', type: 'hote', exemple: 'ubuntu', aide: 'Le nom que le poste avait avant d’entrer dans le domaine.', trouver: { poste: 'client-ubuntu', commande: 'hostnamectl --static', texte: '(le nom actuel ; l’ancien nom, tu le connais ou tu le choisis)' } };

export const PROCEDURES_DOMAINE_RECONSTRUIRE = [
  // ------------------------------------------------------------------ Windows : DNS
  (() => {
    const f = ficheWin({
      id: 'win-dns-poste-regler', titre: 'Régler le DNS d’un poste Windows', categorie: 'Réseau', effet: 'interruption', privileges: ADMIN,
      resume: 'Fait pointer la carte réseau du poste vers le serveur DNS du domaine, vide le cache et vérifie que le domaine est trouvé. Indispensable avant de joindre un domaine. Option graphique : ncpa.cpl.',
      intentions: ['changer le dns windows', 'set-dnsclientserveraddress', 'pointer le dns vers le contrôleur de domaine', 'le poste windows ne trouve pas le domaine', 'ncpa.cpl serveur dns', 'resolve-dnsname domaine'],
      motsCles: ['dns', 'carte réseau', 'set-dnsclientserveraddress', 'domaine', 'ncpa.cpl', 'resolve-dnsname', 'clear-dnsclientcache'],
      params: [
        { id: 'carte', label: 'nom de la carte réseau', type: 'nom', exemple: 'Ethernet', aide: 'Le nom affiché dans ncpa.cpl ou par Get-NetAdapter (Ethernet, Wi-Fi…).', trouver: { poste: 'client-windows', commande: 'Get-NetAdapter' } },
        { id: 'dns', label: 'adresse IP du serveur DNS (le contrôleur de domaine)', type: 'ipv4', exemple: '192.168.20.1', aide: 'L’adresse du serveur Samba ou Windows qui gère le domaine.', trouver: { poste: 'serveur', commande: 'ip -br address' } },
        { id: 'domaine', label: 'nom du domaine', type: 'fqdn', exemple: 'ad.lab', aide: 'Le nom DNS du domaine, pour le test.' },
      ],
      etapes: [
        lec('Lire la carte et son DNS actuel', 'Repère le nom de la carte reliée au serveur et les serveurs DNS qu’elle utilise.', [ps('Get-NetAdapter | Where-Object Status -eq Up | Select-Object Name, InterfaceDescription'), ps('Get-DnsClientServerAddress -InterfaceAlias "{{carte}}" -AddressFamily IPv4')], 'Le nom de la carte et la liste des DNS (ServerAddresses).'),
        mod('Pointer la carte vers le serveur du domaine', 'Remplace TOUTE la liste par une seule adresse : celle du contrôleur. Ne laisse pas de DNS public en second : Windows l’interrogerait et ne trouverait pas le domaine.', [ps('Set-DnsClientServerAddress -InterfaceAlias "{{carte}}" -ServerAddresses {{dns}}'), ps('Clear-DnsClientCache')], 'Aucun message.', { important: 'Un DNS public en second (8.8.8.8, par exemple) est la cause la plus fréquente d’un domaine « introuvable » par intermittence.' }),
        lec('Vérifier que le domaine est trouvé', 'Le nom du domaine et l’enregistrement SRV du contrôleur doivent être résolus.', [ps('Resolve-DnsName {{domaine}}'), ps('Resolve-DnsName -Type SRV _ldap._tcp.{{domaine}}')], 'Une adresse pour le domaine et un enregistrement SRV.', { verification: true }),
        itr('Annuler — rendre le DNS au DHCP', 'Efface les serveurs DNS fixes : la carte reprend ceux que le DHCP donne.', [ps('Set-DnsClientServerAddress -InterfaceAlias "{{carte}}" -ResetServerAddresses'), ps('Clear-DnsClientCache')], 'Get-DnsClientServerAddress montre les DNS du DHCP.', annul),
      ],
      verification: ['Resolve-DnsName trouve le domaine et son enregistrement SRV.'],
      retour: 'Les commandes sont dans l’étape « Annuler » ci-dessous.',
      sources: [src('Set-DnsClientServerAddress', '/powershell/module/dnsclient/set-dnsclientserveraddress'), src('Resolve-DnsName', '/powershell/module/dnsclient/resolve-dnsname'), src('Clear-DnsClientCache', '/powershell/module/dnsclient/clear-dnsclientcache')],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Compte administrateur du poste (mot de passe demandé).',
      etapes: [
        gui('Ouvrir les connexions réseau', 'lecture', 'ncpa.cpl ouvre la liste des cartes réseau du poste.', ['Appuie sur **Windows + R**, tape **ncpa.cpl**, puis **Entrée**.', 'Clique droit sur la carte reliée au serveur (par exemple **Ethernet**), puis **Propriétés**.'], 'La fenêtre des propriétés de la carte s’affiche.'),
        gui('Saisir le DNS du contrôleur de domaine', 'interruption', 'La connexion se coupe un instant à la validation.', ['Double-clique **Protocole Internet version 4 (TCP/IPv4)**.', 'Coche **Utiliser l’adresse de serveur DNS suivante**.', '**Serveur DNS préféré** : l’adresse du contrôleur de domaine. **Serveur DNS auxiliaire** : laisse VIDE.', 'Clique **OK**, puis **Fermer**.'], 'Les propriétés se ferment sans erreur.', { important: 'Laisse le DNS auxiliaire vide : un DNS public ne connaît pas ton domaine.' }),
        gui('Variante : Paramètres de Windows 11', 'interruption', 'Même réglage par un autre chemin.', ['**Paramètres › Réseau et Internet › Ethernet** (ou Wi-Fi), puis **Modifier** à côté de **Attribution du serveur DNS**.', 'Choisis **Manuel**, active **IPv4**, saisis l’adresse du contrôleur dans **DNS préféré**, puis **Enregistrer**.'], 'L’adresse du contrôleur apparaît dans les propriétés de la connexion.', { facultatif: true }),
        gui('Vérifier que le domaine est trouvé', 'lecture', 'nslookup interroge le DNS que tu viens de saisir.', ['Ouvre l’**Invite de commandes**, tape **nslookup** suivi du nom du domaine, puis **Entrée**.'], 'Le serveur affiché est le contrôleur de domaine, avec une adresse pour le domaine.', { verification: true }),
        gui('Annuler — rendre le DNS au DHCP', 'modification', 'Même fenêtre qu’à l’étape 2.', ['Dans **Protocole Internet version 4 › Propriétés**, coche **Obtenir les adresses des serveurs DNS automatiquement**, puis **OK**.'], 'La carte reprend les DNS du DHCP.', annul),
      ],
      verification: ['nslookup trouve le domaine et affiche le contrôleur comme serveur.'],
      retour: 'Propriétés IPv4 › Obtenir les adresses des serveurs DNS automatiquement.',
    });
    return f;
  })(),

  // ------------------------------------------------------------------ Ubuntu : sortir sans serveur
  (() => {
    const f = ficheLinux({
      id: 'linux-domaine-quitter-hors-ligne', titre: 'Sortir Ubuntu d’un domaine dont le serveur n’existe plus',
      resume: 'Retire le client Ubuntu d’un domaine sans contacter le serveur : realm leave sans --remove, dossiers personnels, DNS, nom du poste. À utiliser quand l’ancien contrôleur est éteint ou supprimé. Option graphique : Cockpit.',
      effet: 'interruption',
      intentions: ['sortir ubuntu du domaine serveur supprimé', 'realm leave sans serveur', 'quitter un domaine ad qui n’existe plus', 'ubuntu toujours dans l’ancien domaine', 'retirer sssd domaine ad', 'reconstruire le domaine client ubuntu'],
      motsCles: ['realm leave', 'sssd', 'domaine', 'ancien serveur', 'purge', 'ubuntu', 'client', 'hors ligne', 'cockpit'],
      params: [
        { id: 'domaine', label: 'nom de l’ancien domaine', type: 'fqdn', exemple: 'ad.lab', aide: 'Celui que « realm list » affiche.', trouver: { poste: 'client-ubuntu', commande: 'realm list' } },
        { id: 'poste', label: 'nom court donné au client dans le domaine', type: 'hote', exemple: 'ubuntuclient', aide: 'Sert à retirer la ligne ajoutée dans /etc/hosts.', trouver: { poste: 'client-ubuntu', commande: 'hostnamectl --static' } },
        ANCIEN,
        { id: 'connexion', label: 'nom de la connexion réseau', type: 'nom', exemple: 'Wired connection 1', aide: 'Celle de la carte du client.', trouver: { poste: 'client-ubuntu', commande: 'nmcli -f NAME,DEVICE connection show --active' } },
      ],
      privileges: 'Administrateur du client Ubuntu : sudo.',
      etapes: [
        lec('Constater l’état', 'Note le domaine joint et le nom actuel du poste. Si l’ancien serveur répond encore, préfère l’annulation de la fiche de jonction : elle supprime aussi le compte machine.', [sh('realm list'), sh('hostnamectl --static'), sh('ping -c 2 -W 2 {{domaine}}')], 'Le domaine joint ; le ping échoue si le serveur n’existe plus.'),
        mod('Quitter le domaine localement', 'Sans --remove, realm ne contacte pas le serveur : il retire seulement la configuration locale (SSSD, keytab).', [sh('sudo realm leave {{domaine}}')], 'Aucun message ; realm list ne montre plus le domaine.', { important: 'N’ajoute pas --remove : il tenterait de supprimer le compte machine sur un serveur absent et échouerait.' }),
        mod('Retirer la création automatique des dossiers personnels', 'Annule pam-auth-update --enable mkhomedir.', [sh('sudo pam-auth-update --remove mkhomedir')], 'Aucun message.'),
        mod('Vider le cache de SSSD', 'Efface les comptes du domaine gardés en mémoire.', [sh('sudo sss_cache -E')], 'Aucun message (une erreur « service not running » est sans gravité).'),
        itr('Rendre le DNS au réseau', 'Efface le DNS et le domaine de recherche imposés à la connexion ; le DHCP les redonne.', [sh('sudo nmcli connection modify \'{{connexion}}\' ipv4.dns "" ipv4.dns-search ""'), sh('sudo nmcli connection up \'{{connexion}}\'')], 'Connection successfully activated.'),
        mod('Rendre au poste son nom d’origine', 'Retire la ligne ajoutée dans /etc/hosts et remet l’ancien nom.', [sh('sudo sed -i \'/{{poste}}.{{domaine}}/d\' /etc/hosts'), sh('sudo hostnamectl set-hostname {{ancienNom}}')], 'Aucune erreur ; hostnamectl --static affiche l’ancien nom.'),
        lec('Vérifier la sortie', 'Plus de domaine ; un compte de l’ancien domaine n’est plus reconnu. Les dossiers personnels des anciens comptes restent dans /home.', [sh('realm list'), sh('id compte@{{domaine}}')], 'realm list ne montre rien ; id répond « no such user ».', { verification: true }),
      ],
      verification: ['realm list ne montre plus de domaine.', 'Le nom du poste est celui d’origine.'],
      retour: 'Pour rejoindre un domaine : la fiche « Joindre un poste Ubuntu à un domaine Samba AD » (commandes ou interface graphique).',
      sources: [{ label: 'realm(8)', url: `${MAN}/man8/realm.8.html` }, { label: 'Cockpit — realmd', url: 'https://cockpit-project.org/guide/latest/feature-realmd.html' }, { label: 'nmcli — référence', url: 'https://networkmanager.dev/docs/api/latest/nmcli.html' }],
    });
    f.origine = 'memo';
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du client Ubuntu Desktop (mot de passe demandé).',
      etapes: [
        gui('Quitter le domaine avec Cockpit', 'modification', 'Cockpit appelle realmd, comme la commande realm leave. Le libellé exact du bouton n’est pas confirmé : s’il manque ou échoue, fais l’onglet Terminal.', ['Dans Firefox, ouvre **https://localhost:9090** (Cockpit doit être installé : voir la fiche de jonction graphique) et connecte-toi.', '**Vue d’ensemble**, ligne **Domaine** : clique le nom du domaine, puis **Quitter le domaine** (Leave domain).'], 'La ligne Domaine n’affiche plus le domaine.', { important: 'Avec un serveur éteint, Cockpit peut afficher une erreur : la commande realm leave de l’onglet Terminal, elle, ne contacte pas le serveur.' }),
        gui('Rendre le DNS au réseau', 'modification', 'Retire le DNS imposé pour le domaine.', ['**Paramètres › Réseau**, engrenage de la connexion câblée, onglet **IPv4**.', 'Remets **DNS** sur **Automatique**, efface le domaine de recherche s’il y en a un, puis **Appliquer**.'], 'La connexion reprend le DNS du réseau.'),
        gui('Rendre au poste son nom d’origine', 'modification', 'Le nom affiché est celui de l’appareil.', ['**Paramètres › Système › À propos** : modifie **Nom de l’appareil**.', 'Le fichier /etc/hosts reste à nettoyer (onglet Terminal).'], 'Le nom de l’appareil est l’ancien nom.'),
        gui('Vérifier la sortie', 'lecture', 'Cockpit résume l’état du domaine.', ['**Cockpit › Vue d’ensemble** : la ligne Domaine propose de nouveau **Joindre le domaine**.'], 'Le poste n’est plus membre d’un domaine.', { verification: true }),
      ],
      verification: ['Cockpit propose de nouveau « Joindre le domaine ».'],
      retour: 'Les mêmes étapes en commandes : onglet Terminal.',
    });
    return f;
  })(),

  // ------------------------------------------------------------------ Windows : sortir sans serveur
  (() => {
    const f = ficheWin({
      id: 'win-domaine-quitter-hors-ligne', titre: 'Sortir un poste Windows d’un domaine dont le serveur n’existe plus', effet: 'interruption', privileges: ADMIN, categorie: 'Poste de travail Windows',
      resume: 'Remet le poste dans un groupe de travail quand l’ancien contrôleur est éteint ou supprimé. Il faut un compte administrateur LOCAL dont tu connais le mot de passe. Option graphique : sysdm.cpl.',
      intentions: ['quitter le domaine sans contrôleur', 'remove-computer domaine inaccessible', 'sortir windows du domaine serveur supprimé', 'sysdm.cpl groupe de travail', 'impossible de quitter le domaine windows', 'unjoindomainorworkgroup'],
      motsCles: ['domaine', 'groupe de travail', 'remove-computer', 'sysdm.cpl', 'workgroup', 'hors ligne', 'administrateur local'],
      params: [],
      etapes: [
        lec('Vérifier qu’un administrateur LOCAL existe', 'Une fois sorti du domaine, seuls les comptes locaux fonctionnent. Il faut en connaître un, avec son mot de passe, avant de continuer.', [ps('(Get-CimInstance Win32_ComputerSystem).Domain'), ps('Get-LocalGroupMember -SID S-1-5-32-544')], 'Le nom du domaine, puis la liste des administrateurs ; au moins un compte local (nom de la forme POSTE\\compte).', { important: 'Sans compte administrateur local connu, ne continue pas : tu ne pourrais plus ouvrir de session.' }),
        itr('Passer en groupe de travail', 'Remove-Computer sans identifiants du domaine : il retire le poste du domaine localement. Le compte ordinateur de l’annuaire ne peut pas être touché (le serveur n’existe plus).', [ps('Remove-Computer -WorkgroupName WORKGROUP -Force')], 'Un avertissement indique que le redémarrage est nécessaire.', { important: 'Ce comportement hors ligne n’est pas confirmé par la documentation Microsoft. Si la commande échoue, essaie l’étape suivante ou l’option graphique.' }),
        itr('Variante si la commande échoue (Windows PowerShell 5.1)', 'Appelle directement la méthode Windows qui retire le poste du domaine, sans demander de désactiver le compte ordinateur (option 0). Réservée au cas où l’étape précédente échoue.', [ps('(Get-WmiObject Win32_ComputerSystem).UnjoinDomainOrWorkgroup($null, $null, 0)')], 'ReturnValue : 0.', { facultatif: true, important: 'Non confirmé hors ligne : la page Microsoft de cette méthode ne décrit pas le cas d’un contrôleur injoignable.' }),
        itr('Redémarrer', 'Le changement ne prend effet qu’après le redémarrage. Enregistre ton travail.', [ps('Restart-Computer')], 'Le poste redémarre.'),
        lec('Vérifier la sortie', 'Après le redémarrage, ouvre une session avec le compte LOCAL.', [ps('(Get-CimInstance Win32_ComputerSystem).PartOfDomain'), ps('(Get-CimInstance Win32_ComputerSystem).Domain')], 'False, puis WORKGROUP.', { verification: true }),
        mod('Annuler — rendre le DNS au DHCP', 'Efface le DNS qui visait l’ancien serveur (remplace Ethernet par le nom de ta carte).', [ps('Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ResetServerAddresses'), ps('Clear-DnsClientCache')], 'Get-DnsClientServerAddress montre les DNS du DHCP.', annul),
      ],
      verification: ['PartOfDomain vaut False et le domaine affiché est WORKGROUP.'],
      retour: 'Pour rejoindre un domaine : la fiche « Joindre un poste Windows au domaine » (commandes ou interface graphique).',
      sources: [src('Remove-Computer', '/powershell/module/microsoft.powershell.management/remove-computer'), { label: 'Win32_ComputerSystem — UnjoinDomainOrWorkgroup', url: 'https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/unjoindomainorworkgroup-method-in-class-win32-computersystem' }, src('Get-CimInstance', '/powershell/module/cimcmdlets/get-ciminstance')],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Compte administrateur LOCAL du poste (mot de passe connu).',
      etapes: [
        gui('S’assurer d’avoir un administrateur local', 'lecture', 'Après la sortie, seuls les comptes locaux ouvrent une session.', ['**Windows + R**, tape **lusrmgr.msc**, puis **Entrée** (absent des éditions Famille : utilise alors l’onglet PowerShell).', '**Groupes › Administrateurs** : repère un compte local dont tu connais le mot de passe.'], 'Au moins un administrateur local connu.', { important: 'Sans compte administrateur local connu, ne continue pas.' }),
        gui('Passer en groupe de travail', 'interruption', 'Le chemin classique, valable même quand le serveur est éteint.', ['**Windows + R**, tape **sysdm.cpl**, puis **Entrée**.', 'Onglet **Nom de l’ordinateur**, bouton **Modifier…**.', 'Sous **Membre d’un**, choisis **Groupe de travail** et tape **WORKGROUP**, puis **OK**.', 'Si Windows dit qu’il ne peut pas contacter le domaine, **OK**/continuer : c’est attendu, le compte ordinateur restera dans l’annuaire. Saisis, si on te le demande, un compte administrateur LOCAL.', 'Redémarre quand Windows le propose.'], 'Windows affiche « Bienvenue dans le groupe de travail WORKGROUP » avant le redémarrage.', { important: 'Je n’ai pas pu confirmer le texte exact des messages hors ligne ; l’essentiel est que le groupe de travail soit accepté.' }),
        gui('Vérifier la sortie', 'lecture', 'Ouvre une session avec le compte LOCAL (**.\\compte**).', ['Après le redémarrage, ouvre **sysdm.cpl** › **Nom de l’ordinateur**.', 'La ligne **Groupe de travail** affiche WORKGROUP et plus un domaine.'], 'Groupe de travail : WORKGROUP.', { verification: true }),
        gui('Annuler — rendre le DNS au DHCP', 'modification', 'Retire le DNS qui visait l’ancien serveur.', ['**Windows + R**, **ncpa.cpl**, propriétés de la carte, **Protocole Internet version 4 › Propriétés**.', 'Coche **Obtenir les adresses des serveurs DNS automatiquement**, puis **OK**.'], 'La carte reprend les DNS du DHCP.', annul),
      ],
      verification: ['La ligne Groupe de travail affiche WORKGROUP.'],
      retour: 'Les mêmes étapes en commandes : onglet PowerShell.',
    });
    return f;
  })(),
  // ------------------------------------------------------------------ Parcours
  (() => {
    const f = ficheLinux({
      id: 'samba-ad-reconstruire', titre: 'Reconstruire le domaine Samba AD : l’ordre des fiches',
      resume: 'Parcours complet quand on refait le serveur : sortir les clients Ubuntu et Windows de l’ancien domaine, supprimer l’ancienne VM, installer le nouveau contrôleur, régler le DNS des clients, puis les joindre. Chaque étape renvoie à sa fiche et indique l’option graphique.',
      effet: 'interruption',
      intentions: ['reconstruire le domaine', 'refaire le serveur samba ad', 'nouvelle vm contrôleur de domaine', 'recommencer le domaine', 'ordre des étapes samba ad', 'sortir les clients de l’ancien domaine puis rejoindre', 'réinstaller l’ad'],
      motsCles: ['reconstruire', 'domaine', 'samba ad', 'parcours', 'nouveau serveur', 'clients', 'ordre', 'jonction'],
      params: [{ id: 'domaine', label: 'nom du domaine', type: 'fqdn', exemple: 'ad.lab', aide: 'Le nom DNS du domaine (le même ou un nouveau).' }],
      prerequis: [
        { texte: 'Les clients sont allumés et leur réseau fonctionne.', fiche: 'cours-ubuntu-reseau-client' },
      ],
      privileges: 'Administrateur du serveur, du client Ubuntu (sudo) et du client Windows.',
      etapes: [
        lec('Ubuntu — sortir de l’ancien domaine', 'FAIS-LE AVANT d’éteindre l’ancien serveur : la fiche « Joindre un poste Ubuntu à un domaine Samba AD » (étape Annuler) supprime aussi le compte machine. Serveur déjà éteint : fiche « Sortir Ubuntu d’un domaine dont le serveur n’existe plus ». Option graphique : Cockpit (Aperçu › Domaine).', [sh('realm list')], 'Le domaine joint ; après la sortie, plus rien.', { machine: 'client-ubuntu', phase: '1. Sortir les clients' }),
        lec('Windows — sortir de l’ancien domaine', 'Fiche « Joindre un poste Windows au domaine » (étape Annuler) si l’ancien serveur répond, sinon « Sortir Windows d’un domaine dont le serveur n’existe plus ». Option graphique : sysdm.cpl › Modifier › Groupe de travail.', [ps('(Get-CimInstance Win32_ComputerSystem).PartOfDomain')], 'True avant la sortie, False après.', { machine: 'client-windows', phase: '1. Sortir les clients' }),
        lec('Hyperviseur — retirer l’ancienne VM, créer la nouvelle', 'Dans ton hyperviseur, supprime (ou garde éteinte) l’ancienne VM serveur et crée la nouvelle avec Ubuntu Server. Rien à saisir ici : c’est dans l’interface de l’hyperviseur.', [sh('echo "VM serveur prête : Ubuntu Server installé, réseau configuré"')], 'Le message s’affiche.', { machine: 'hyperviseur', phase: '2. Nouveau serveur' }),
        lec('Serveur — installer le contrôleur de domaine', 'Fiche « Installer un contrôleur de domaine Samba AD sur Ubuntu Server » : paquets, provision, DNS, Kerberos, vérifications. À finir avant tout le reste.', [sh('sudo samba-tool domain level show')], 'Les niveaux du domaine et de la forêt s’affichent.', { machine: 'serveur', phase: '2. Nouveau serveur' }),
        lec('Windows — pointer le DNS vers le nouveau serveur', 'Fiche « Régler le DNS d’un poste Windows ». Option graphique : ncpa.cpl.', [ps('Resolve-DnsName -Type SRV _ldap._tcp.{{domaine}}')], 'Un enregistrement SRV du nouveau contrôleur.', { machine: 'client-windows', phase: '3. Régler le DNS des clients' }),
        lec('Ubuntu — pointer le DNS vers le nouveau serveur', 'Fiche « Joindre un poste Ubuntu à un domaine Samba AD », première partie (réseau). Option graphique : Paramètres › Réseau.', [sh('resolvectl query _ldap._tcp.{{domaine}} --type=SRV')], 'Un enregistrement SRV du nouveau contrôleur.', { machine: 'client-ubuntu', phase: '3. Régler le DNS des clients' }),
        lec('Ubuntu — joindre le nouveau domaine', 'Fiche « Joindre un poste Ubuntu à un domaine Samba AD » (commandes) ou « … par l’interface graphique » (Cockpit).', [sh('realm list')], 'Le nouveau domaine, avec « configured: kerberos-member ».', { machine: 'client-ubuntu', phase: '4. Joindre' }),
        lec('Windows — joindre le nouveau domaine', 'Fiche « Joindre un poste Windows au domaine » (PowerShell) ou son option graphique : sysdm.cpl › Modifier › Domaine.', [ps('(Get-CimInstance Win32_ComputerSystem).Domain')], 'Le nom du nouveau domaine, et non WORKGROUP.', { machine: 'client-windows', phase: '4. Joindre' }),
        lec('Serveur — voir les deux postes dans l’annuaire', 'Les deux comptes machine doivent apparaître.', [sh('sudo samba-tool computer list')], 'Les noms des deux clients suivis d’un $.', { machine: 'serveur', phase: '5. Vérifier', verification: true }),
      ],
      verification: ['Les deux clients sont dans le nouveau domaine et apparaissent dans samba-tool computer list.'],
      retour: null,
      sources: [{ label: 'Samba — Active Directory Domain Controller', url: 'https://wiki.samba.org/index.php/Setting_up_Samba_as_an_Active_Directory_Domain_Controller' }, { label: 'Ubuntu Server — Samba AD DC', url: 'https://documentation.ubuntu.com/server/how-to/samba/provision-samba-ad-controller/' }],
    });
    f.origine = 'memo';
    return f;
  })(),
];
