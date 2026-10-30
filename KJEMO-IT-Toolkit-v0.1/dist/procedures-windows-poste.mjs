/**
 * procedures-windows-poste.mjs — KJEMO-WINDOWS-SIMPLES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Suite des commandes courantes d'un poste Windows : caches, informations
 * système, processus, arrêt, disque et fichiers, logiciels, tâches et réglages,
 * comptes locaux. Voir procedures-windows-simples.mjs pour le contrat commun.
 * Aucun mot de passe écrit : Read-Host -AsSecureString. Non exécuté sur un poste réel.
 */
import { fiche, ps, lec, mod, src, ADMIN, USER, WC, COMPTE, PROCESSUS } from './procedures-windows-simples.mjs';

const PSM = '/powershell/module';
const MPM = `${PSM}/microsoft.powershell.management`;
const CHEMIN_EX = (id, label, exemple, aide = 'Un chemin Windows simple, sans espace ni guillemet.') => ({ id, label, type: 'cheminWin', exemple, aide });

export const PROCEDURES_WINDOWS_POSTE = [
  // =========================================================================
  // VIDER LES CACHES
  // =========================================================================
  fiche({
    id: 'win-cache-identifiants', titre: 'Voir et supprimer les identifiants enregistrés (cmdkey)', effet: 'modification',
    resume: 'Liste les identifiants mémorisés par Windows pour les partages et serveurs, et supprime celui d’une cible. Règle les « accès refusé » après un changement de mot de passe sur un partage réseau.',
    intentions: ['cmdkey /list', 'supprimer un identifiant enregistré', 'vider les identifiants windows', 'partage réseau refuse après changement de mot de passe', 'gestionnaire d’identification en ligne de commande'],
    motsCles: ['cmdkey', 'identifiants', 'cache', 'partage', 'credential', 'gestionnaire'],
    params: [{ id: 'cible', label: 'serveur ou partage concerné', type: 'hote', exemple: 'serveur01', aide: 'Le nom du serveur tel qu’il apparaît dans la liste « Cible : ».' }],
    etapes: [
      lec('Lister les identifiants', 'Pour chaque entrée : la cible, le type et l’utilisateur. Le mot de passe n’est jamais affiché.', [ps('cmdkey /list')], 'Une liste de « Cible : … » avec « Utilisateur : … ».'),
      mod('Supprimer celui d’une cible', 'La prochaine connexion à ce serveur redemandera le nom et le mot de passe.', [ps('cmdkey /delete:{{cible}}')], 'Le message « Les informations d’identification ont été supprimées. » (selon la langue).', { important: 'Copie la cible exactement comme la liste l’affiche (certaines commencent par « Domain: » ou « LegacyGeneric: »).' }),
      lec('Vérifier', 'La cible ne doit plus figurer dans la liste.', [ps('cmdkey /list')], 'L’entrée supprimée a disparu.', { verification: true }),
    ],
    verification: ['L’identifiant de la cible n’apparaît plus ; la prochaine connexion redemande le mot de passe.'],
    retour: 'Se reconnecter au partage et cocher « Mémoriser mes informations » (ou cmdkey /add:cible /user:compte, qui demande le mot de passe).',
    sources: [src('cmdkey', `${WC}/cmdkey`)],
  }),
  fiche({
    id: 'win-cache-store', titre: 'Vider le cache du Microsoft Store (wsreset)', effet: 'modification',
    resume: 'Réinitialise le cache du Microsoft Store quand il ne s’ouvre pas, ne télécharge plus ou plante. Ne supprime ni les applications ni les comptes.',
    intentions: ['wsreset', 'vider le cache du microsoft store', 'le store ne s’ouvre pas', 'réinitialiser le cache du store', 'le store ne télécharge plus'],
    motsCles: ['wsreset', 'store', 'cache', 'microsoft store', 'applications'],
    etapes: [
      mod('Réinitialiser le cache', 'Une fenêtre noire s’ouvre quelques secondes, puis le Store se lance tout seul.', [ps('wsreset.exe')], 'Le Microsoft Store s’ouvre à la fin.', { important: 'Ne ferme pas la fenêtre noire : elle disparaît seule quand c’est terminé.' }),
      lec('Vérifier que le Store est installé et à jour', 'Affiche la version du paquet Store.', [ps('Get-AppxPackage Microsoft.WindowsStore | Select-Object Name, Version')], 'Une ligne Microsoft.WindowsStore avec son numéro de version.', { verification: true }),
    ],
    verification: ['Le Store s’ouvre et télécharge normalement.'],
    retour: 'Rien à défaire : seul le cache est vidé.',
    sources: [src('Get-AppxPackage', `${PSM}/appx/get-appxpackage`)],
  }),
  fiche({
    id: 'win-cache-windows-update', titre: 'Vider le cache de Windows Update', effet: 'modification',
    resume: 'Arrête les services de mise à jour, renomme le dossier SoftwareDistribution (le cache de téléchargement) et relance les services. Windows recrée un dossier neuf. Règle les mises à jour bloquées.',
    intentions: ['vider le cache de windows update', 'softwaredistribution', 'mise à jour windows bloquée', 'réinitialiser le téléchargement des mises à jour', 'renommer softwaredistribution'],
    motsCles: ['windows update', 'softwaredistribution', 'cache', 'wuauserv', 'bits', 'mise à jour'], privileges: ADMIN,
    etapes: [
      mod('Arrêter les services', 'Windows Update (wuauserv) et le transfert intelligent (bits) verrouillent le dossier.', [ps('Stop-Service -Name wuauserv, bits -Force')], 'Aucun message en cas de succès.'),
      mod('Renommer le dossier de cache', 'On le renomme au lieu de le supprimer : on peut revenir en arrière.', [ps('Rename-Item -Path "$env:SystemRoot\\SoftwareDistribution" -NewName "SoftwareDistribution.old"')], 'Aucun message. Une erreur « utilisé par un autre processus » : les services ne sont pas arrêtés.'),
      mod('Relancer les services', 'Windows Update recrée un dossier SoftwareDistribution neuf au prochain passage.', [ps('Start-Service -Name bits, wuauserv')], 'Aucun message en cas de succès.'),
      lec('Vérifier', 'Les deux services tournent et l’ancien dossier est conservé.', [ps('Get-Service wuauserv, bits | Select-Object Name, Status'), ps('Test-Path "$env:SystemRoot\\SoftwareDistribution.old"')], 'Status : Running pour les deux services et True pour l’ancien dossier. Relance ensuite la recherche de mises à jour dans Paramètres.', { verification: true }),
    ],
    verification: ['Les services tournent, un nouveau dossier SoftwareDistribution est créé et la recherche de mises à jour repart.'],
    retour: 'Arrête les services, supprime le nouveau dossier SoftwareDistribution, renomme SoftwareDistribution.old en SoftwareDistribution, puis relance les services. Supprime le dossier .old seulement quand tout fonctionne.',
    sources: [src('Stop-Service', `${MPM}/stop-service`), src('Rename-Item', `${MPM}/rename-item`)],
  }),
  fiche({
    id: 'win-presse-papiers', titre: 'Vider le presse-papiers', effet: 'modification',
    resume: 'Efface le contenu du presse-papiers, utile après avoir copié un mot de passe ou une clé, avant de partager l’écran.',
    intentions: ['vider le presse-papiers', 'effacer le presse-papiers', 'clear clipboard windows', 'supprimer un mot de passe copié', 'clip commande'],
    motsCles: ['presse-papiers', 'clipboard', 'clip', 'effacer', 'copier'],
    etapes: [
      mod('Vider le presse-papiers', 'Envoie un texte vide au presse-papiers, qui remplace son contenu.', [ps('cmd /c "echo off | clip"')], 'Aucun message.'),
      lec('Vérifier', 'Le presse-papiers ne doit plus contenir ce que tu avais copié.', [ps('Get-Clipboard')], 'Aucune sortie, ou une ligne vide.', { verification: true }),
    ],
    verification: ['Coller ne donne plus rien.'],
    retour: 'Rien à défaire. L’historique du presse-papiers (touche Windows + V) se vide séparément.',
    sources: [src('clip', `${WC}/clip`), src('Get-Clipboard', `${MPM}/get-clipboard`)],
  }),
  fiche({
    id: 'win-kerberos-purger', titre: 'Vider les tickets Kerberos (klist purge)', effet: 'modification',
    resume: 'Supprime les tickets Kerberos de la session pour en obtenir de nouveaux. Utile après un changement de groupe dans Active Directory, qui n’est pris en compte qu’à l’obtention d’un nouveau ticket.',
    intentions: ['klist purge', 'vider les tickets kerberos', 'nouveau groupe active directory non pris en compte', 'renouveler le ticket kerberos', 'accès partage après ajout au groupe'],
    motsCles: ['kerberos', 'klist', 'ticket', 'cache', 'active directory', 'groupe'],
    etapes: [
      lec('Voir les tickets actuels', 'Le ticket TGT (krbtgt) et les tickets de service obtenus.', [ps('klist')], 'Une liste de tickets avec leur serveur et leur date d’expiration. Une liste vide : le poste n’est pas ouvert sur un domaine.'),
      mod('Purger les tickets', 'Efface les tickets de ta session ; Windows en redemande au prochain accès, avec tes groupes à jour.', [ps('klist purge')], 'Un message indiquant que les tickets ont été supprimés (« Purge des tickets… »).', { important: 'Pour que le ticket principal soit renouvelé, il faut parfois fermer puis rouvrir la session Windows.' }),
      lec('Vérifier', 'De nouveaux tickets apparaissent après le prochain accès à un partage du domaine.', [ps('klist')], 'La liste est vide juste après la purge, puis se remplit avec de nouveaux tickets.', { verification: true }),
    ],
    verification: ['Les tickets sont renouvelés et l’accès reflète les groupes à jour.'],
    retour: 'Rien à défaire : les tickets sont redemandés automatiquement.',
    sources: [src('klist', `${WC}/klist`)],
  }),

  // =========================================================================
  // INFORMATIONS SUR LE POSTE
  // =========================================================================
  fiche({
    id: 'win-systeme-resume', titre: 'Voir le résumé du système (nom, Windows, mémoire, processeur)', effet: 'lecture',
    resume: 'Donne en une commande le nom du poste, la version de Windows, la mémoire et le processeur. À lire avant de dépanner ou de remplir un inventaire.',
    intentions: ['systeminfo', 'voir les informations du système', 'quelle mémoire a ce poste', 'get-computerinfo', 'résumé matériel windows'],
    motsCles: ['systeminfo', 'get-computerinfo', 'mémoire', 'processeur', 'version', 'inventaire'],
    etapes: [
      lec('Résumé court en PowerShell', 'Les champs essentiels, sans le bruit.', [ps('Get-ComputerInfo | Select-Object CsName, WindowsProductName, WindowsVersion, OsBuildNumber, CsTotalPhysicalMemory, CsNumberOfLogicalProcessors')], 'Le nom du poste, l’édition de Windows, la version, la mémoire (en octets) et le nombre de processeurs logiques.'),
      lec('Rapport classique', 'Plus long, avec les correctifs et les cartes réseau.', [ps('systeminfo')], 'Une page de lignes : nom d’hôte, système, fabricant, mémoire, correctifs.', { verification: true }),
    ],
    verification: ['Le nom et la version de Windows correspondent à ce qui est attendu.'],
    sources: [src('Get-ComputerInfo', `${MPM}/get-computerinfo`), src('systeminfo', `${WC}/systeminfo`)],
  }),
  fiche({
    id: 'win-version-windows', titre: 'Voir la version et la build de Windows', effet: 'lecture',
    resume: 'Affiche l’édition (Famille, Pro, Entreprise), la version (23H2…) et le numéro de build. Sert à savoir si une fonction ou une mise à jour s’applique à ce poste.',
    intentions: ['quelle version de windows', 'winver', 'numéro de build windows', 'édition windows pro ou famille', 'voir la version de windows en ligne de commande'],
    motsCles: ['winver', 'version', 'build', 'édition', 'windows 11', 'windows 10'],
    etapes: [
      lec('Lire la version', 'Édition, version d’affichage et numéro de build.', [ps('Get-ComputerInfo -Property WindowsProductName, WindowsVersion, OsBuildNumber')], 'WindowsProductName : par exemple Windows 11 Pro ; WindowsVersion : par exemple 23H2.'),
      lec('Ouvrir la fenêtre « À propos de Windows »', 'La même information en fenêtre.', [ps('winver')], 'Une petite fenêtre avec la version et la build.', { verification: true }),
    ],
    verification: ['La version et la build lues sont celles que tu attends.'],
    sources: [src('Get-ComputerInfo', `${MPM}/get-computerinfo`)],
  }),
  fiche({
    id: 'win-uptime', titre: 'Voir depuis quand le poste est démarré (uptime)', effet: 'lecture',
    resume: 'Donne la date du dernier démarrage et la durée écoulée. Utile pour savoir si une mise à jour demande un redémarrage depuis longtemps.',
    intentions: ['uptime windows', 'depuis quand le poste est allumé', 'date du dernier démarrage', 'lastbootuptime', 'temps de fonctionnement du poste'],
    motsCles: ['uptime', 'démarrage', 'redémarrage', 'lastbootuptime', 'durée'],
    etapes: [
      lec('Lire la date du dernier démarrage', 'Date et heure du dernier démarrage complet.', [ps('(Get-CimInstance Win32_OperatingSystem).LastBootUpTime')], 'Une date et une heure.'),
      lec('Calculer la durée écoulée', 'Jours, heures et minutes depuis le démarrage.', [ps('(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime')], 'Days, Hours, Minutes : la durée de fonctionnement.', { verification: true, important: 'Le démarrage rapide de Windows peut faire croire que le poste n’a pas redémarré : utilise « Redémarrer » plutôt que « Arrêter » pour un vrai redémarrage.' }),
    ],
    verification: ['La durée affichée correspond à ce que tu sais du dernier redémarrage.'],
    sources: [src('Get-CimInstance', `${PSM}/cimcmdlets/get-ciminstance`)],
  }),
  fiche({
    id: 'win-nom-poste-utilisateur', titre: 'Voir le nom du poste et l’utilisateur connecté', effet: 'lecture',
    resume: 'Affiche le nom de l’ordinateur, le compte connecté, son domaine et le serveur qui l’a authentifié. Les premières informations à noter sur un ticket d’assistance.',
    intentions: ['hostname', 'whoami', 'quel est le nom de cet ordinateur', 'quel compte est connecté', 'voir le domaine et le serveur de connexion'],
    motsCles: ['hostname', 'whoami', 'nom du poste', 'utilisateur', 'domaine', 'logonserver'],
    etapes: [
      lec('Nom du poste et compte', 'Le nom court de l’ordinateur et le compte sous la forme DOMAINE\\compte.', [ps('hostname'), ps('whoami')], 'Le nom du poste puis, par exemple, LAB\\marie (ou POSTE01\\marie pour un compte local).'),
      lec('Domaine et serveur d’ouverture de session', 'Montre si la session vient du domaine ou du poste.', [ps('Write-Host "$env:USERDOMAIN $env:LOGONSERVER"'), ps('whoami /fqdn')], 'Le domaine, le contrôleur de domaine qui a ouvert la session et le nom complet du compte. « whoami /fqdn » échoue sur un compte local.', { verification: true }),
    ],
    verification: ['Le nom du poste et le compte sont ceux de la machine concernée.'],
    sources: [src('whoami', `${WC}/whoami`), src('hostname', `${WC}/hostname`)],
  }),
  fiche({
    id: 'win-renommer-poste', titre: 'Renommer le poste', effet: 'interruption',
    resume: 'Change le nom de l’ordinateur. Un redémarrage est nécessaire. Sur un poste joint à un domaine, le compte d’ordinateur doit être renommé aussi : demande un compte autorisé.',
    intentions: ['renommer le poste windows', 'rename-computer', 'changer le nom de l’ordinateur', 'modifier le nom d’hôte windows', 'nouveau nom de pc'],
    motsCles: ['renommer', 'rename-computer', 'nom du poste', 'hostname', 'redémarrer'], privileges: ADMIN,
    params: [{ id: 'nom', label: 'nouveau nom du poste', type: 'hote', exemple: 'PC-VENTES01', aide: 'Lettres, chiffres et tirets, 15 caractères au plus (limite NetBIOS).' }],
    etapes: [
      lec('Lire le nom actuel', 'Pour pouvoir revenir en arrière.', [ps('hostname')], 'Le nom actuel du poste.'),
      mod('Renommer', 'Le nom ne change qu’au prochain démarrage.', [ps('Rename-Computer -NewName {{nom}}')], 'Un avertissement « les modifications ne prendront effet qu’après le redémarrage ».', { important: 'Sur un poste joint à un domaine, ajoute -DomainCredential (Get-Credential) : sans lui, la commande échoue. Ne renomme pas un contrôleur de domaine avec cette fiche.' }),
      mod('Redémarrer', 'Applique le nouveau nom.', [ps('Restart-Computer')], 'Le poste redémarre.'),
      lec('Après le redémarrage : vérifier', 'Le nom affiché doit être le nouveau.', [ps('hostname')], 'Le nouveau nom.', { verification: true }),
    ],
    verification: ['Le poste porte le nouveau nom après le redémarrage.'],
    retour: 'Rename-Computer -NewName (ancien nom), puis redémarrer.',
    sources: [src('Rename-Computer', `${MPM}/rename-computer`)],
  }),
  fiche({
    id: 'win-whoami-groupes', titre: 'Voir les groupes et les privilèges de mon compte', effet: 'lecture',
    resume: 'Liste les groupes dont le compte connecté est membre et ses privilèges. Répond à « pourquoi n’ai-je pas accès ? » ou « suis-je administrateur ? ».',
    intentions: ['whoami /groups', 'dans quels groupes suis-je', 'suis-je administrateur', 'voir mes privilèges windows', 'whoami /priv'],
    motsCles: ['whoami', 'groupes', 'privilèges', 'administrateur', 'jeton', 'droits'],
    etapes: [
      lec('Voir les groupes', 'Chaque ligne est un groupe du jeton de la session.', [ps('whoami /groups')], 'Une liste de groupes avec leur SID. Le groupe Administrateurs figure ici si le compte en fait partie.'),
      lec('Voir les privilèges', 'Les privilèges disponibles dans cette fenêtre (plus nombreux en administrateur).', [ps('whoami /priv')], 'Une liste de privilèges avec leur état (Désactivé ou Activé).', { verification: true, important: 'Les groupes ajoutés depuis l’ouverture de session n’apparaissent qu’après avoir fermé puis rouvert la session.' }),
    ],
    verification: ['Les groupes affichés sont ceux auxquels le compte appartient.'],
    sources: [src('whoami', `${WC}/whoami`)],
  }),
  fiche({
    id: 'win-licence-activation', titre: 'Voir l’état d’activation de Windows', effet: 'lecture',
    resume: 'Indique si Windows est activé, le type de licence et la date d’expiration éventuelle (licence en volume). Lecture seule.',
    intentions: ['windows est-il activé', 'slmgr /xpr', 'état de la licence windows', 'date d’expiration de l’activation', 'slmgr dli'],
    motsCles: ['activation', 'licence', 'slmgr', 'xpr', 'clé', 'windows'],
    etapes: [
      lec('Lire l’état d’expiration', 'Affiche une fenêtre : « activé de façon permanente » ou la date d’expiration.', [ps('cscript //nologo "$env:SystemRoot\\System32\\slmgr.vbs" /xpr')], 'Une petite fenêtre avec « La machine est activée de manière permanente » (ou la date de fin).'),
      lec('Lire les détails de la licence', 'Édition, canal (Retail, volume) et état de la licence.', [ps('cscript //nologo "$env:SystemRoot\\System32\\slmgr.vbs" /dli')], 'Nom, description et État de la licence : sous licence.', { verification: true }),
    ],
    verification: ['La licence est « sous licence » et l’activation est permanente ou valide jusqu’à la date attendue.'],
    sources: [src('slmgr', '/windows-server/get-started/activation-slmgr-vbs-options')],
  }),
  fiche({
    id: 'win-bitlocker-etat', titre: 'Voir l’état du chiffrement BitLocker', effet: 'lecture',
    resume: 'Indique pour chaque disque s’il est chiffré, protégé et à quel pourcentage. À contrôler sur les portables avant de les confier à quelqu’un.',
    intentions: ['état de bitlocker', 'get-bitlockervolume', 'le disque est-il chiffré', 'manage-bde -status', 'vérifier le chiffrement du disque'],
    motsCles: ['bitlocker', 'chiffrement', 'disque', 'manage-bde', 'protection'], privileges: ADMIN,
    etapes: [
      lec('Lire l’état de chaque volume', 'VolumeStatus doit être FullyEncrypted et ProtectionStatus On pour un poste protégé.', [ps('Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage')], 'Une ligne par volume. FullyEncrypted et On : le disque est chiffré et protégé.'),
      lec('Même lecture avec manage-bde', 'Montre aussi les protecteurs de clé.', [ps('manage-bde -status')], 'Pour chaque volume : État de la conversion et État de la protection.', { verification: true, important: 'Ne copie jamais une clé de récupération dans un message : elle donne accès au disque.' }),
    ],
    verification: ['Le volume système est chiffré et la protection est activée.'],
    sources: [src('Get-BitLockerVolume', `${PSM}/bitlocker/get-bitlockervolume`), src('manage-bde', `${WC}/manage-bde`)],
  }),

  // =========================================================================
  // PROCESSUS, ARRÊT, SESSIONS
  // =========================================================================
  fiche({
    id: 'win-processus-trouver', titre: 'Trouver un processus et son numéro (PID)', effet: 'lecture',
    resume: 'Retrouve un programme en cours d’exécution à partir de son nom : son numéro de processus (PID), la mémoire et le temps processeur qu’il consomme. Première étape avant de le fermer.',
    intentions: ['tasklist', 'trouver un processus', 'get-process par nom', 'numéro pid d’un programme', 'le programme tourne-t-il'],
    motsCles: ['processus', 'tasklist', 'get-process', 'pid', 'programme'],
    params: [PROCESSUS],
    etapes: [
      lec('Chercher le processus', 'Une ligne par instance du programme.', [ps('Get-Process -Name {{processus}} | Select-Object Id, ProcessName, CPU, WorkingSet, StartTime')], 'Une ligne par instance avec son Id (le PID). Une erreur « introuvable » : le programme ne tourne pas.'),
      lec('Même recherche avec tasklist', 'Affiche aussi le numéro de session.', [ps('tasklist /fi "imagename eq {{processus}}.exe"')], 'Nom de l’image, PID, nom de la session, utilisation mémoire.', { verification: true }),
    ],
    verification: ['Le processus apparaît avec son PID, ou son absence est confirmée.'],
    sources: [src('Get-Process', `${MPM}/get-process`), src('tasklist', `${WC}/tasklist`)],
  }),
  fiche({
    id: 'win-processus-gourmands', titre: 'Voir les processus qui consomment le plus', effet: 'lecture',
    resume: 'Classe les programmes par temps processeur puis par mémoire. Repère ce qui ralentit un poste sans ouvrir le Gestionnaire des tâches.',
    intentions: ['quel processus ralentit le poste', 'processus qui consomme le plus de mémoire', 'top processus windows', 'processeur à 100 pourcent', 'classer les processus par mémoire'],
    motsCles: ['processus', 'cpu', 'mémoire', 'ralentissement', 'get-process', 'performance'],
    etapes: [
      lec('Les 10 plus gourmands en processeur', 'CPU est le temps processeur cumulé en secondes depuis le démarrage du programme.', [ps('Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Id, ProcessName, CPU')], 'Dix lignes, du plus gourmand au moins gourmand.'),
      lec('Les 10 plus gourmands en mémoire', 'WS est la mémoire physique utilisée, ici convertie en méga-octets.', [ps('Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Id, ProcessName, @{Name="Mo";Expression={[int]($_.WorkingSet/1MB)}}')], 'Dix lignes avec la mémoire en Mo.', { verification: true }),
    ],
    verification: ['Le ou les programmes en cause apparaissent en tête des deux listes.'],
    sources: [src('Get-Process', `${MPM}/get-process`), src('Sort-Object', `${PSM}/microsoft.powershell.utility/sort-object`)],
  }),
  fiche({
    id: 'win-processus-fermer', titre: 'Fermer un programme qui ne répond plus (Stop-Process)', effet: 'modification',
    resume: 'Termine de force un programme figé. Le travail non enregistré dans ce programme est perdu. À réserver aux programmes qui ne répondent plus.',
    intentions: ['taskkill', 'fermer un programme figé', 'stop-process', 'tuer un processus windows', 'application qui ne répond pas'],
    motsCles: ['processus', 'taskkill', 'stop-process', 'fermer', 'bloqué', 'ne répond pas'],
    params: [PROCESSUS],
    etapes: [
      lec('Vérifier ce qui sera fermé', 'Contrôle que c’est le bon programme.', [ps('Get-Process -Name {{processus}} | Select-Object Id, ProcessName, Responding')], 'Une ligne par instance ; Responding : False indique un programme figé.'),
      mod('Fermer le programme', 'Termine toutes les instances de ce programme.', [ps('Stop-Process -Name {{processus}} -Force')], 'Aucun message en cas de succès.', { important: 'Tout travail non enregistré dans ce programme est perdu. Ne ferme jamais un processus système (svchost, lsass, csrss…).' }),
      lec('Vérifier', 'Le processus ne doit plus exister.', [ps('Get-Process -Name {{processus}} -ErrorAction SilentlyContinue')], 'Aucune sortie.', { verification: true }),
    ],
    verification: ['Le programme n’apparaît plus dans la liste des processus.'],
    retour: 'Relance simplement le programme ; les données non enregistrées ne reviennent pas.',
    sources: [src('Stop-Process', `${MPM}/stop-process`), src('taskkill', `${WC}/taskkill`)],
  }),
  fiche({
    id: 'win-arret-redemarrage', titre: 'Redémarrer ou éteindre le poste (shutdown)', effet: 'interruption',
    resume: 'Programme un redémarrage ou un arrêt après un délai, ce qui laisse le temps d’enregistrer. Se retire avec « shutdown /a » tant que le délai n’est pas écoulé.',
    intentions: ['shutdown /r', 'redémarrer windows en ligne de commande', 'éteindre le poste dans 10 minutes', 'programmer un arrêt windows', 'redémarrage différé'],
    motsCles: ['shutdown', 'redémarrer', 'éteindre', 'arrêt', 'délai'], privileges: ADMIN,
    params: [
      { id: 'action', label: 'action (r = redémarrer, s = éteindre)', type: 'choix', choix: ['r', 's'], exemple: 'r', aide: 'r pour redémarrer, s pour éteindre.' },
      { id: 'delai', label: 'délai en secondes avant l’action', type: 'entier', min: 0, max: 3600, exemple: '60', aide: 'De 0 (immédiat) à 3600 secondes (une heure).' },
    ],
    etapes: [
      mod('Programmer l’action', 'Une notification annonce l’arrêt. /f ferme de force les programmes ouverts, à n’utiliser que pour un poste inactif : il n’est donc pas ajouté ici.', [ps('shutdown /{{action}} /t {{delai}}')], 'Une notification Windows « Vous allez être déconnecté » avec le délai.', { important: 'Un délai de 0 agit tout de suite. Sur un serveur, avertis d’abord les utilisateurs connectés.' }),
      lec('Vérifier', 'Windows journalise l’ordre d’arrêt (événement 1074).', [ps('Get-WinEvent -FilterHashtable @{LogName="System"; Id=1074} -MaxEvents 1 | Select-Object TimeCreated, Message')], 'Une entrée récente indiquant le processus, l’utilisateur et l’action demandée.', { verification: true }),
    ],
    verification: ['L’ordre d’arrêt est journalisé et le poste s’arrête ou redémarre à l’heure prévue.'],
    retour: 'Annuler avant la fin du délai avec « shutdown /a » (voir la fiche « Annuler un arrêt programmé »).',
    sources: [src('shutdown', `${WC}/shutdown`), src('Get-WinEvent', `${PSM}/microsoft.powershell.diagnostics/get-winevent`)],
  }),
  fiche({
    id: 'win-arret-annuler', titre: 'Annuler un arrêt ou un redémarrage programmé', effet: 'modification',
    resume: 'Annule un arrêt programmé tant que le délai n’est pas écoulé. Une fois le compte à rebours terminé, il est trop tard.',
    intentions: ['shutdown /a', 'annuler l’arrêt programmé', 'annuler un redémarrage windows', 'arrêter le compte à rebours d’arrêt', 'abort shutdown'],
    motsCles: ['shutdown', 'annuler', 'abort', 'arrêt', 'redémarrage'],
    etapes: [
      mod('Annuler l’arrêt', 'Efface l’ordre d’arrêt en attente.', [ps('shutdown /a')], 'Une notification « La déconnexion a été annulée ». Une erreur 1116 : aucun arrêt n’était programmé.'),
      lec('Vérifier qu’il ne reste rien en attente', 'Une seconde annulation doit échouer, ce qui prouve qu’il n’y a plus rien à annuler.', [ps('shutdown /a')], 'L’erreur 1116 « Impossible d’interrompre l’arrêt du système car il n’y avait aucun arrêt en cours ».', { verification: true }),
    ],
    verification: ['Aucun arrêt n’est plus en attente (erreur 1116 à la seconde tentative).'],
    retour: 'Reprogramme l’arrêt si nécessaire avec la fiche « Redémarrer ou éteindre le poste ».',
    sources: [src('shutdown', `${WC}/shutdown`)],
  }),
  fiche({
    id: 'win-sessions-fermer', titre: 'Voir les sessions ouvertes et en fermer une (logoff)', effet: 'interruption',
    resume: 'Liste les utilisateurs connectés (utile sur un serveur ou un poste en Bureau à distance) et déconnecte une session précise par son numéro. Le travail non enregistré de cette session est perdu.',
    intentions: ['query user', 'qui est connecté sur le serveur', 'fermer la session d’un utilisateur', 'logoff session', 'déconnecter un utilisateur rdp'],
    motsCles: ['session', 'query user', 'logoff', 'rdp', 'utilisateur connecté', 'déconnecter'], privileges: ADMIN,
    params: [{ id: 'session', label: 'numéro de la session (colonne ID)', type: 'entier', min: 0, max: 9999, exemple: '2', aide: 'Le numéro lu dans la colonne ID de « query user ».' }],
    etapes: [
      lec('Lister les sessions', 'Une ligne par session, avec le numéro (ID) et l’état. Le signe > marque ta propre session.', [ps('query user')], 'Une liste avec NOM UTILISATEUR, NOM SESSION, ID, ÉTAT. Une erreur « aucun utilisateur » : personne d’autre n’est connecté.'),
      mod('Fermer la session choisie', 'Ferme la session de cet utilisateur et l’y déconnecte de force.', [ps('logoff {{session}}')], 'Aucun message ; la session disparaît de la liste.', { important: 'Ne ferme pas ta propre session (repérée par le signe >) si tu es connecté à distance : tu perdrais la main.' }),
      lec('Vérifier', 'La session ne doit plus être listée.', [ps('query user')], 'La session fermée n’apparaît plus.', { verification: true }),
    ],
    verification: ['La session fermée n’apparaît plus dans la liste.'],
    retour: 'Aucun : l’utilisateur doit simplement rouvrir une session ; son travail non enregistré est perdu.',
    sources: [src('query user', `${WC}/query-user`), src('logoff', `${WC}/logoff`)],
  }),

  // =========================================================================
  // DISQUE ET FICHIERS
  // =========================================================================
  fiche({
    id: 'win-disque-verifier', titre: 'Vérifier les erreurs d’un disque (chkdsk)', effet: 'modification',
    resume: 'Analyse un volume sans rien modifier, puis, seulement si des erreurs sont trouvées, les répare. Sur le disque système, la réparation attend le prochain redémarrage.',
    intentions: ['chkdsk', 'vérifier les erreurs du disque', 'repair-volume', 'disque corrompu windows', 'réparer le système de fichiers ntfs'],
    motsCles: ['chkdsk', 'disque', 'erreurs', 'ntfs', 'repair-volume', 'corrompu'], privileges: ADMIN,
    params: [{ id: 'lecteur', label: 'lettre du lecteur', type: 'identifiant', exemple: 'D', aide: 'Une seule lettre, sans deux-points : C, D, E…' }],
    etapes: [
      lec('Analyser sans rien modifier', 'Lecture seule : la commande dit seulement si le volume a des erreurs.', [ps('Repair-Volume -DriveLetter {{lecteur}} -Scan')], 'NoErrorsFound si tout va bien. ScanErrorsFound : il y a des erreurs à réparer.'),
      mod('Réparer les erreurs trouvées', 'Corrige uniquement les erreurs signalées, sans reformater. Fais-la seulement si l’analyse a trouvé des erreurs.', [ps('Repair-Volume -DriveLetter {{lecteur}} -SpotFix')], 'Le message de fin de la réparation ; sur le disque système, elle s’applique au redémarrage.', { facultatif: true, important: 'Sauvegarde les données importantes avant de réparer un disque qui montre des signes de panne : une réparation ne remplace pas une sauvegarde.' }),
      lec('Vérifier la santé du volume', 'HealthStatus doit être Healthy.', [ps('Get-Volume -DriveLetter {{lecteur}} | Select-Object DriveLetter, FileSystem, HealthStatus, OperationalStatus')], 'HealthStatus : Healthy et OperationalStatus : OK.', { verification: true }),
    ],
    verification: ['Le volume est sain (Healthy / OK) et l’analyse ne trouve plus d’erreur.'],
    retour: 'Une réparation ne se défait pas : d’où la sauvegarde préalable.',
    sources: [src('Repair-Volume', `${PSM}/storage/repair-volume`), src('chkdsk', `${WC}/chkdsk`)],
  }),
  fiche({
    id: 'win-robocopy-copier', titre: 'Copier un dossier avec robocopy', effet: 'modification',
    resume: 'Copie un dossier et tout son contenu vers une destination, en reprenant en cas d’erreur. Une simulation d’abord, puis la vraie copie. Ne supprime jamais rien à la destination.',
    intentions: ['robocopy', 'copier un dossier windows en ligne de commande', 'sauvegarder un dossier vers un autre disque', 'copie fiable de dossier', 'copier avec reprise après erreur'],
    motsCles: ['robocopy', 'copie', 'dossier', 'sauvegarde', 'copier', 'répertoire'],
    params: [CHEMIN_EX('source', 'dossier à copier', 'C:\\Donnees'), CHEMIN_EX('destination', 'dossier de destination', 'D:\\Sauvegarde')],
    etapes: [
      lec('Simuler la copie', 'L’option /L liste ce qui serait copié sans rien copier.', [ps('robocopy "{{source}}" "{{destination}}" /E /R:2 /W:2 /L')], 'La liste des fichiers qui seraient copiés et un résumé (Dossiers, Fichiers, Octets).'),
      mod('Copier', '/E copie tous les sous-dossiers, même vides ; /R:2 /W:2 limite les essais en cas d’erreur à deux, espacés de deux secondes.', [ps('robocopy "{{source}}" "{{destination}}" /E /R:2 /W:2')], 'Un résumé final avec la colonne « Échec » à 0.', { important: 'N’ajoute jamais /MIR ou /PURGE sans savoir ce que tu fais : ils SUPPRIMENT à la destination ce qui n’existe plus dans la source.' }),
      lec('Comparer le nombre de fichiers', 'Les deux dossiers doivent contenir autant de fichiers.', [ps('(Get-ChildItem -Path "{{source}}" -Recurse -File | Measure-Object).Count'), ps('(Get-ChildItem -Path "{{destination}}" -Recurse -File | Measure-Object).Count')], 'Deux nombres identiques.', { verification: true }),
    ],
    verification: ['Le résumé robocopy indique 0 échec et les deux dossiers ont le même nombre de fichiers.'],
    retour: 'Supprime les fichiers copiés à la destination (la source n’est pas modifiée).',
    sources: [src('robocopy', `${WC}/robocopy`)],
  }),
  fiche({
    id: 'win-fichier-chercher', titre: 'Chercher un fichier par son nom', effet: 'lecture',
    resume: 'Retrouve les fichiers dont le nom contient un mot, dans un dossier et ses sous-dossiers, avec leur taille et leur date de modification.',
    intentions: ['chercher un fichier windows en ligne de commande', 'trouver un fichier par son nom', 'get-childitem recurse filter', 'où est mon fichier', 'dir /s'],
    motsCles: ['chercher', 'trouver', 'fichier', 'get-childitem', 'dir', 'recherche'],
    params: [CHEMIN_EX('dossier', 'dossier où chercher', 'C:\\Users', 'Le dossier de départ ; la recherche inclut ses sous-dossiers.'), { id: 'motif', label: 'mot contenu dans le nom', type: 'nom', exemple: 'rapport', aide: 'Un mot du nom du fichier, sans étoile ni jokers.' }],
    etapes: [
      lec('Chercher', 'Les erreurs d’accès à des dossiers protégés sont ignorées.', [ps('Get-ChildItem -Path "{{dossier}}" -Recurse -File -Filter "*{{motif}}*" -ErrorAction SilentlyContinue | Select-Object FullName, Length, LastWriteTime')], 'Une ligne par fichier trouvé, avec son chemin complet.'),
      lec('Compter les résultats', 'Savoir combien de fichiers correspondent.', [ps('(Get-ChildItem -Path "{{dossier}}" -Recurse -File -Filter "*{{motif}}*" -ErrorAction SilentlyContinue | Measure-Object).Count')], 'Un nombre : 0 si aucun fichier ne correspond.', { verification: true }),
    ],
    verification: ['Le fichier cherché figure dans la liste, avec la bonne date.'],
    sources: [src('Get-ChildItem', `${MPM}/get-childitem`)],
  }),
  fiche({
    id: 'win-fichier-empreinte', titre: 'Calculer l’empreinte d’un fichier (hash SHA-256)', effet: 'lecture',
    resume: 'Calcule l’empreinte SHA-256 d’un fichier pour la comparer à celle publiée par l’éditeur. Prouve qu’un téléchargement est intact et n’a pas été altéré.',
    intentions: ['get-filehash', 'vérifier l’intégrité d’un téléchargement', 'calculer le sha256 d’un fichier', 'hash d’un fichier windows', 'certutil -hashfile'],
    motsCles: ['hash', 'sha256', 'empreinte', 'intégrité', 'get-filehash', 'certutil'],
    params: [CHEMIN_EX('fichier', 'fichier à contrôler', 'C:\\Telechargements\\setup.exe')],
    etapes: [
      lec('Calculer l’empreinte', 'Compare le résultat, caractère par caractère, avec celle donnée par l’éditeur.', [ps('Get-FileHash -Algorithm SHA256 "{{fichier}}"')], 'Une ligne Algorithm : SHA256, Hash : 64 caractères hexadécimaux, Path : le fichier.'),
      lec('Recalculer avec un second outil', 'Les deux méthodes doivent donner exactement la même valeur.', [ps('certutil -hashfile "{{fichier}}" SHA256')], 'La même empreinte sur la ligne centrale.', { verification: true }),
    ],
    verification: ['L’empreinte calculée est identique à celle publiée par l’éditeur.'],
    sources: [src('Get-FileHash', `${PSM}/microsoft.powershell.utility/get-filehash`), src('certutil', `${WC}/certutil`)],
  }),
  fiche({
    id: 'win-archive-creer', titre: 'Compresser un dossier en fichier .zip', effet: 'modification',
    resume: 'Crée une archive .zip à partir d’un dossier avec la commande intégrée de PowerShell, sans logiciel supplémentaire.',
    intentions: ['compress-archive', 'créer un zip en ligne de commande', 'compresser un dossier windows', 'archiver un dossier en zip', 'zipper un dossier'],
    motsCles: ['zip', 'compress-archive', 'archive', 'compresser', 'dossier'],
    params: [CHEMIN_EX('dossier', 'dossier à compresser', 'C:\\Donnees\\Ventes'), CHEMIN_EX('archive', 'fichier .zip à créer', 'C:\\Sauvegardes\\ventes.zip', 'Le chemin complet du .zip, qui ne doit pas déjà exister.')],
    etapes: [
      mod('Créer l’archive', 'La commande échoue si le .zip existe déjà : elle n’écrase rien.', [ps('Compress-Archive -Path "{{dossier}}" -DestinationPath "{{archive}}"')], 'Aucun message en cas de succès (une barre de progression peut s’afficher).'),
      lec('Vérifier le contenu', 'tar sait lister un .zip : on voit les fichiers rangés dedans.', [ps('Get-Item "{{archive}}" | Select-Object Name, Length'), ps('tar -tf "{{archive}}"')], 'Le .zip avec sa taille, puis la liste des fichiers qu’il contient.', { verification: true }),
    ],
    verification: ['Le .zip existe et la liste de son contenu correspond au dossier.'],
    retour: 'Supprime le .zip (Remove-Item) : le dossier d’origine n’est pas modifié.',
    sources: [src('Compress-Archive', `${PSM}/microsoft.powershell.archive/compress-archive`)],
  }),
  fiche({
    id: 'win-archive-extraire', titre: 'Décompresser un fichier .zip', effet: 'modification',
    resume: 'Extrait le contenu d’un .zip dans un dossier. La commande refuse d’écraser des fichiers déjà présents : rien n’est perdu.',
    intentions: ['expand-archive', 'décompresser un zip en ligne de commande', 'extraire un zip windows', 'dézipper un fichier', 'ouvrir une archive zip powershell'],
    motsCles: ['zip', 'expand-archive', 'extraire', 'décompresser', 'archive'],
    params: [CHEMIN_EX('archive', 'fichier .zip à extraire', 'C:\\Telechargements\\outils.zip'), CHEMIN_EX('dossier', 'dossier de destination', 'C:\\Outils')],
    etapes: [
      lec('Lister le contenu avant d’extraire', 'Contrôle ce que contient l’archive.', [ps('tar -tf "{{archive}}"')], 'La liste des fichiers de l’archive.'),
      mod('Extraire', 'Crée le dossier de destination s’il n’existe pas. Sans -Force, un fichier déjà présent fait échouer la commande plutôt que d’être écrasé.', [ps('Expand-Archive -Path "{{archive}}" -DestinationPath "{{dossier}}"')], 'Aucun message en cas de succès.'),
      lec('Vérifier', 'Le dossier doit contenir les fichiers de l’archive.', [ps('Get-ChildItem -Path "{{dossier}}" -Recurse | Select-Object -First 15 FullName')], 'Les premiers fichiers extraits.', { verification: true }),
    ],
    verification: ['Les fichiers de l’archive se trouvent dans le dossier de destination.'],
    retour: 'Supprime le dossier de destination s’il ne contenait rien d’autre avant l’extraction.',
    sources: [src('Expand-Archive', `${PSM}/microsoft.powershell.archive/expand-archive`)],
  }),
  fiche({
    id: 'win-droits-prendre-possession', titre: 'Reprendre un dossier dont l’accès est refusé (takeown)', effet: 'modification',
    resume: 'Quand un dossier est inaccessible (ancien profil, disque d’un autre poste), prend la propriété du dossier puis donne le contrôle total aux administrateurs. L’état des droits est sauvegardé avant.',
    intentions: ['takeown', 'accès refusé à un dossier windows', 'prendre possession d’un dossier', 'ancien profil inaccessible', 'icacls donner contrôle total aux administrateurs'],
    motsCles: ['takeown', 'icacls', 'propriétaire', 'accès refusé', 'droits', 'dossier'], privileges: ADMIN,
    params: [CHEMIN_EX('chemin', 'dossier à récupérer', 'D:\\AncienProfil')],
    etapes: [
      mod('Sauvegarder les droits actuels', 'Un fichier qui permettra de revenir en arrière.', [ps('icacls "{{chemin}}" /save "$env:USERPROFILE\\droits-avant.txt" /T')], 'Un résumé « Traitement réussi de 1 fichiers » (ou plus).'),
      mod('Prendre la propriété', '/A donne la propriété au groupe Administrateurs ; /R traite tous les sous-dossiers.', [ps('takeown /F "{{chemin}}" /A /R /D O')], 'Une ligne « RÉUSSITE » par fichier traité.'),
      mod('Donner le contrôle total aux administrateurs', 'Le SID S-1-5-32-544 désigne le groupe Administrateurs, quelle que soit la langue de Windows.', [ps('icacls "{{chemin}}" /grant "*S-1-5-32-544:(OI)(CI)F" /T')], 'Un résumé « Traitement réussi de N fichiers ».', { important: 'À réserver aux dossiers dont tu es responsable. Sur un dossier système (C:\\Windows, C:\\Program Files), ne change jamais les droits.' }),
      lec('Vérifier', 'Le groupe Administrateurs doit apparaître avec (F), contrôle total.', [ps('icacls "{{chemin}}"')], 'Une ligne avec BUILTIN\\Administrators:(OI)(CI)(F).', { verification: true }),
    ],
    verification: ['Les administrateurs ont le contrôle total et le dossier s’ouvre.'],
    retour: 'icacls "(dossier parent)" /restore "%USERPROFILE%\\droits-avant.txt" rétablit les droits sauvegardés (la propriété, elle, reste aux administrateurs).',
    sources: [src('takeown', `${WC}/takeown`), src('icacls', `${WC}/icacls`)],
  }),

  // =========================================================================
  // LOGICIELS ET CORRECTIFS
  // =========================================================================
  fiche({
    id: 'win-winget-installer', titre: 'Installer un logiciel avec winget', effet: 'modification',
    resume: 'Cherche un logiciel dans le catalogue de winget, l’installe par son identifiant exact, et vérifie qu’il est présent. Évite le téléchargement manuel depuis un site.',
    intentions: ['winget install', 'installer un logiciel en ligne de commande', 'winget search', 'installer vlc avec winget', 'gestionnaire de paquets windows'],
    motsCles: ['winget', 'installer', 'logiciel', 'paquet', 'application', 'catalogue'],
    params: [{ id: 'recherche', label: 'nom du logiciel à chercher', type: 'nom', exemple: 'vlc', aide: 'Un mot du nom du logiciel.' }, { id: 'id', label: 'identifiant exact du logiciel', type: 'identifiant', exemple: 'VideoLAN.VLC', aide: 'L’identifiant lu dans la colonne Id de « winget search », par exemple VideoLAN.VLC.' }],
    etapes: [
      lec('Chercher le logiciel', 'Note l’identifiant (colonne Id) du bon résultat.', [ps('winget search {{recherche}}')], 'Un tableau Nom, Id, Version, Source.'),
      mod('Installer par identifiant', '-e exige une correspondance exacte de l’identifiant, pour ne pas installer un logiciel voisin.', [ps('winget install --id {{id}} -e')], 'Le téléchargement puis « Installé correctement ». Les accords de licence peuvent être demandés.', { important: 'Installe uniquement des logiciels dont la source est « winget » ou « msstore » et dont l’éditeur est celui que tu attends.' }),
      lec('Vérifier', 'Le logiciel doit figurer dans la liste des logiciels installés.', [ps('winget list --id {{id}} -e')], 'Une ligne avec le nom, l’identifiant et la version installée.', { verification: true }),
    ],
    verification: ['Le logiciel figure dans « winget list » avec la version attendue.'],
    retour: 'winget uninstall --id (identifiant) -e désinstalle le logiciel.',
    sources: [src('winget search', '/windows/package-manager/winget/search'), src('winget install', '/windows/package-manager/winget/install'), src('winget list', '/windows/package-manager/winget/list')],
  }),
  fiche({
    id: 'win-winget-mettre-a-jour', titre: 'Mettre à jour un logiciel avec winget', effet: 'modification',
    resume: 'Liste les logiciels qui ont une mise à jour disponible puis met à jour un logiciel précis. Plus sûr qu’une mise à jour de tout le poste d’un coup.',
    intentions: ['winget upgrade', 'mettre à jour un logiciel en ligne de commande', 'logiciels à mettre à jour windows', 'winget upgrade --all', 'quelles applications ont une mise à jour'],
    motsCles: ['winget', 'upgrade', 'mise à jour', 'logiciel', 'version'],
    params: [{ id: 'id', label: 'identifiant exact du logiciel', type: 'identifiant', exemple: 'VideoLAN.VLC', aide: 'L’identifiant lu dans la colonne Id de « winget upgrade ».' }],
    etapes: [
      lec('Voir ce qui peut être mis à jour', 'Les colonnes Version et Disponible montrent l’écart.', [ps('winget upgrade')], 'Un tableau des logiciels avec une version plus récente disponible, ou « Aucune mise à jour disponible ».'),
      mod('Mettre à jour un logiciel', 'Met à jour uniquement celui-là.', [ps('winget upgrade --id {{id}} -e')], 'Le téléchargement puis « Installé correctement ».', { important: 'Ferme le logiciel avant de le mettre à jour. Évite « winget upgrade --all » sur un poste de production sans l’avoir essayé ailleurs.' }),
      lec('Vérifier', 'La version installée doit être la nouvelle.', [ps('winget list --id {{id}} -e')], 'La colonne Version affiche la nouvelle version, sans valeur dans Disponible.', { verification: true }),
    ],
    verification: ['La version installée est la dernière disponible.'],
    retour: 'Réinstalle la version précédente avec winget install --id (identifiant) --version (numéro) si elle est encore au catalogue.',
    sources: [src('winget upgrade', '/windows/package-manager/winget/upgrade'), src('winget list', '/windows/package-manager/winget/list')],
  }),
  fiche({
    id: 'win-correctifs-installes', titre: 'Voir les correctifs Windows installés (KB)', effet: 'lecture',
    resume: 'Liste les dernières mises à jour installées et vérifie si un correctif précis (numéro KB) est présent. Répond à « ce poste est-il à jour pour ce correctif ? ».',
    intentions: ['get-hotfix', 'voir les mises à jour installées windows', 'le correctif kb est-il installé', 'liste des kb installées', 'historique des mises à jour en ligne de commande'],
    motsCles: ['hotfix', 'kb', 'correctif', 'mise à jour', 'get-hotfix', 'wmic qfe'],
    params: [{ id: 'kb', label: 'numéro du correctif (KB)', type: 'identifiant', exemple: 'KB5034441', aide: 'Le numéro commençant par KB, lu dans le bulletin de sécurité.' }],
    etapes: [
      lec('Les dix derniers correctifs', 'Triés du plus récent au plus ancien.', [ps('Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10 HotFixID, Description, InstalledOn')], 'Dix lignes avec le numéro KB et la date d’installation.'),
      lec('Chercher un correctif précis', 'Une erreur « introuvable » veut dire qu’il n’est pas installé.', [ps('Get-HotFix -Id {{kb}}')], 'Une ligne avec le correctif et sa date, ou une erreur s’il est absent.', { verification: true }),
    ],
    verification: ['Le correctif attendu est présent, ou son absence est confirmée.'],
    sources: [src('Get-HotFix', `${MPM}/get-hotfix`)],
  }),

  // =========================================================================
  // TÂCHES, VARIABLES, ACCÈS À DISTANCE, HEURE
  // =========================================================================
  fiche({
    id: 'win-tache-planifiee', titre: 'Planifier un script tous les jours (tâche planifiée)', effet: 'modification',
    resume: 'Crée une tâche planifiée qui lance un script PowerShell chaque jour à une heure donnée. Elle s’exécute avec ton compte quand tu es connecté.',
    intentions: ['créer une tâche planifiée', 'register-scheduledtask', 'lancer un script tous les jours', 'schtasks create', 'planifier un script powershell'],
    motsCles: ['tâche planifiée', 'scheduledtask', 'schtasks', 'planifier', 'script', 'quotidien'], privileges: ADMIN,
    params: [
      { id: 'tache', label: 'nom de la tâche', type: 'identifiant', exemple: 'SauvegardeNuit', aide: 'Un nom court, sans espace.' },
      CHEMIN_EX('script', 'script PowerShell à lancer', 'C:\\Scripts\\sauvegarde.ps1'),
      { id: 'heure', label: 'heure de lancement (HH:MM)', type: 'texte', exemple: '02:00', aide: 'L’heure au format 24 heures, par exemple 02:00 ou 18:30.' },
    ],
    etapes: [
      mod('Créer la tâche', 'Une seule commande : l’action à lancer, le déclencheur quotidien et l’enregistrement de la tâche.', [ps('Register-ScheduledTask -TaskName {{tache}} -Action (New-ScheduledTaskAction -Execute "powershell.exe" -Argument \'-NoProfile -File "{{script}}"\') -Trigger (New-ScheduledTaskTrigger -Daily -At {{heure}})')], 'Un résumé de la tâche avec son TaskName et l’état Ready.', { important: 'Teste d’abord le script à la main. Pour qu’il s’exécute même sans session ouverte, il faut un compte de service : ajoute -User et -Password dans une fiche dédiée, jamais en clair.' }),
      lec('Vérifier la tâche', 'Elle doit être prête, avec sa prochaine exécution.', [ps('Get-ScheduledTask -TaskName {{tache}} | Select-Object TaskName, State'), ps('Get-ScheduledTaskInfo -TaskName {{tache}} | Select-Object NextRunTime, LastTaskResult')], 'State : Ready et NextRunTime : demain à l’heure choisie.', { verification: true }),
    ],
    verification: ['La tâche est prête et sa prochaine exécution est à l’heure prévue.'],
    retour: 'Unregister-ScheduledTask -TaskName (nom de la tâche) -Confirm:$false supprime la tâche.',
    sources: [src('Register-ScheduledTask', `${PSM}/scheduledtasks/register-scheduledtask`), src('New-ScheduledTaskTrigger', `${PSM}/scheduledtasks/new-scheduledtasktrigger`), src('Get-ScheduledTaskInfo', `${PSM}/scheduledtasks/get-scheduledtaskinfo`)],
  }),
  fiche({
    id: 'win-variable-environnement', titre: 'Créer une variable d’environnement (compte courant)', effet: 'modification',
    resume: 'Crée ou modifie une variable d’environnement pour ton compte. Elle n’apparaît que dans les nouvelles fenêtres, pas dans celles déjà ouvertes.',
    intentions: ['créer une variable d’environnement', 'setx', 'setenvironmentvariable', 'définir une variable windows', 'ajouter une variable utilisateur'],
    motsCles: ['variable', 'environnement', 'setx', 'setenvironmentvariable', 'utilisateur'],
    params: [{ id: 'nom', label: 'nom de la variable', type: 'identifiant', exemple: 'LAB_DOSSIER', aide: 'Lettres, chiffres et soulignés, sans espace.' }, CHEMIN_EX('valeur', 'valeur de la variable', 'C:\\Lab', 'Ici un chemin ; une valeur simple convient aussi.')],
    etapes: [
      mod('Créer la variable', 'La portée « User » ne demande pas de droits d’administrateur et ne touche pas les autres comptes.', [ps('[Environment]::SetEnvironmentVariable("{{nom}}", "{{valeur}}", "User")')], 'Aucun message en cas de succès.'),
      lec('Vérifier', 'Relit la valeur enregistrée. Dans une fenêtre déjà ouverte, $env:NOM reste vide : ouvre-en une nouvelle.', [ps('[Environment]::GetEnvironmentVariable("{{nom}}", "User")')], 'La valeur que tu viens d’enregistrer.', { verification: true }),
    ],
    verification: ['La valeur lue est celle enregistrée et une nouvelle fenêtre la voit.'],
    retour: '[Environment]::SetEnvironmentVariable("(nom)", $null, "User") supprime la variable.',
    sources: [src('Environment.SetEnvironmentVariable', '/dotnet/api/system.environment.setenvironmentvariable')],
  }),
  fiche({
    id: 'win-path-ajouter', titre: 'Ajouter un dossier au PATH (compte courant)', effet: 'modification',
    resume: 'Ajoute un dossier à la fin de la variable PATH de ton compte pour pouvoir lancer ses programmes depuis n’importe où. Ajoute à la fin sans écraser l’existant.',
    intentions: ['ajouter au path windows', 'modifier la variable path', 'commande introuvable après installation', 'ajouter un dossier au path utilisateur', 'path setx'],
    motsCles: ['path', 'variable', 'environnement', 'commande introuvable', 'utilisateur'],
    params: [CHEMIN_EX('dossier', 'dossier à ajouter au PATH', 'C:\\Outils\\bin')],
    etapes: [
      lec('Lire le PATH actuel', 'Garde une copie : c’est la valeur à rétablir en cas de problème.', [ps('[Environment]::GetEnvironmentVariable("Path", "User")')], 'La liste des dossiers du PATH utilisateur séparés par des points-virgules (peut être vide).'),
      mod('Ajouter le dossier à la fin', 'Concatène l’ancien PATH, un point-virgule et le nouveau dossier. Ne remplace jamais le PATH par une seule valeur.', [ps('[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";{{dossier}}", "User")')], 'Aucun message en cas de succès.', { important: 'Ne fais pas « setx Path » : il coupe le PATH à 1024 caractères et peut en effacer une partie.' }),
      lec('Vérifier dans une nouvelle fenêtre', 'Ouvre un nouveau PowerShell pour que le PATH soit relu.', [ps('[Environment]::GetEnvironmentVariable("Path", "User") -split ";"')], 'Une ligne par dossier, avec le nouveau à la fin.', { verification: true }),
    ],
    verification: ['Le dossier figure dans le PATH et ses programmes se lancent depuis une nouvelle fenêtre.'],
    retour: 'Remets la valeur du PATH lue à la première étape avec [Environment]::SetEnvironmentVariable("Path", "(ancienne valeur)", "User").',
    sources: [src('Environment.SetEnvironmentVariable', '/dotnet/api/system.environment.setenvironmentvariable')],
  }),
  fiche({
    id: 'win-bureau-distance-activer', titre: 'Activer le Bureau à distance (RDP)', effet: 'modification',
    resume: 'Autorise les connexions Bureau à distance sur ce poste (Windows Pro ou Entreprise) et ouvre le port 3389 dans le pare-feu. L’authentification réseau (NLA) reste activée.',
    intentions: ['activer le bureau à distance', 'activer rdp en ligne de commande', 'fdenytsconnections', 'ouvrir le port 3389', 'se connecter à distance au poste'],
    motsCles: ['rdp', 'bureau à distance', '3389', 'terminal server', 'mstsc', 'accès distant'], privileges: ADMIN,
    etapes: [
      lec('Lire l’état actuel', '1 veut dire que les connexions sont refusées ; 0 qu’elles sont autorisées.', [ps('(Get-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server").fDenyTSConnections')], '1 si le Bureau à distance est désactivé.'),
      mod('Autoriser les connexions', 'Passe la valeur à 0.', [ps('Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name fDenyTSConnections -Value 0')], 'Aucun message en cas de succès.'),
      mod('Ouvrir le pare-feu pour le Bureau à distance', 'Active les règles prédéfinies du Bureau à distance.', [ps('Get-NetFirewallRule -Name "RemoteDesktop-*" | Enable-NetFirewallRule')], 'Aucun message en cas de succès.', { important: 'N’expose jamais le port 3389 directement sur Internet : passe par un VPN. Réserve l’accès aux comptes qui en ont besoin (groupe Utilisateurs du Bureau à distance).' }),
      lec('Vérifier', 'Le port 3389 doit répondre sur le poste.', [ps('Test-NetConnection -ComputerName localhost -Port 3389')], 'TcpTestSucceeded : True.', { verification: true }),
    ],
    verification: ['Le port 3389 répond et une connexion mstsc depuis un autre poste aboutit.'],
    retour: 'Remets fDenyTSConnections à 1 et désactive les règles avec Get-NetFirewallRule -Name "RemoteDesktop-*" | Disable-NetFirewallRule.',
    sources: [src('Enable-NetFirewallRule', `${PSM}/netsecurity/enable-netfirewallrule`), src('Set-ItemProperty', `${MPM}/set-itemproperty`), src('Test-NetConnection', `${PSM}/nettcpip/test-netconnection`)],
  }),
  fiche({
    id: 'win-heure-synchroniser', titre: 'Synchroniser l’heure du poste (w32tm)', effet: 'modification',
    resume: 'Force la synchronisation de l’horloge avec la source de temps du poste (le contrôleur de domaine ou un serveur NTP). Une heure décalée de plus de 5 minutes casse Kerberos et donc les connexions au domaine.',
    intentions: ['w32tm /resync', 'synchroniser l’heure windows', 'heure décalée sur le poste', 'erreur kerberos décalage horaire', 'forcer la synchronisation ntp'],
    motsCles: ['w32tm', 'heure', 'ntp', 'synchronisation', 'kerberos', 'horloge'], privileges: ADMIN,
    etapes: [
      lec('Voir l’état de la synchronisation', 'La source de temps et la dernière synchronisation réussie.', [ps('w32tm /query /status')], 'Les lignes « Source » et « Heure de la dernière synchronisation réussie ».'),
      mod('Forcer la synchronisation', 'Redemande l’heure à la source maintenant.', [ps('w32tm /resync')], '« La commande s’est terminée correctement. » Si le service est arrêté : démarre-le avec Start-Service w32time.'),
      lec('Vérifier', 'La dernière synchronisation doit être très récente.', [ps('w32tm /query /status')], 'L’heure de la dernière synchronisation réussie est celle de maintenant.', { verification: true }),
    ],
    verification: ['La dernière synchronisation date de quelques secondes et l’heure du poste est correcte.'],
    retour: 'Rien à défaire : l’horloge se resynchronise de toute façon à intervalle régulier.',
    sources: [src('w32tm', `${WC}/w32tm`)],
  }),

  // =========================================================================
  // COMPTES LOCAUX
  // =========================================================================
  fiche({
    id: 'win-local-changer-mot-de-passe', titre: 'Changer le mot de passe d’un compte local', effet: 'modification',
    resume: 'Définit un nouveau mot de passe pour un compte local. PowerShell le demande (saisie masquée) : il ne figure ni à l’écran ni dans l’historique des commandes.',
    intentions: ['changer le mot de passe d’un compte local', 'set-localuser password', 'réinitialiser le mot de passe local windows', 'mot de passe oublié compte local', 'net user mot de passe'],
    motsCles: ['mot de passe', 'compte local', 'set-localuser', 'réinitialiser', 'windows'], privileges: ADMIN,
    params: [{ ...COMPTE, label: 'nom du compte local', exemple: 'marie' }],
    etapes: [
      lec('Vérifier le compte', 'Contrôle que le compte existe et note la date du dernier changement.', [ps('Get-LocalUser -Name {{compte}} | Select-Object Name, Enabled, PasswordLastSet')], 'Une ligne avec le compte, Enabled et la date PasswordLastSet.'),
      mod('Définir le nouveau mot de passe', 'PowerShell te demande le mot de passe (saisie masquée).', [ps('Set-LocalUser -Name {{compte}} -Password (Read-Host -AsSecureString "Nouveau mot de passe")')], 'Une invite « Nouveau mot de passe : », puis aucun message en cas de succès.', { important: 'Communique le mot de passe par un autre canal et demande à l’utilisateur de le changer. Sur un compte Microsoft en ligne, cette commande ne s’applique pas.' }),
      lec('Vérifier', 'PasswordLastSet doit afficher la date d’aujourd’hui.', [ps('Get-LocalUser -Name {{compte}} | Select-Object Name, PasswordLastSet')], 'PasswordLastSet : la date et l’heure de maintenant.', { verification: true }),
    ],
    verification: ['La date de dernier changement du mot de passe est celle d’aujourd’hui et la connexion fonctionne.'],
    retour: 'Un mot de passe changé ne se retrouve pas : redéfinis-en un nouveau avec la même commande.',
    sources: [src('Set-LocalUser', `${PSM}/microsoft.powershell.localaccounts/set-localuser`), src('Read-Host', `${PSM}/microsoft.powershell.utility/read-host`)],
  }),
  fiche({
    id: 'win-local-admin-ajouter', titre: 'Ajouter un compte local au groupe Administrateurs', effet: 'modification',
    resume: 'Donne les droits d’administrateur à un compte local en l’ajoutant au groupe Administrateurs. Fonctionne quelle que soit la langue de Windows, car le groupe est désigné par son identifiant (SID).',
    intentions: ['ajouter un administrateur local', 'ajouter au groupe administrateurs windows', 'donner les droits administrateur à un compte', 'add-localgroupmember administrateurs', 'net localgroup administrators'],
    motsCles: ['administrateur', 'groupe', 'add-localgroupmember', 'droits', 'compte local', 'sid'], privileges: ADMIN,
    params: [{ ...COMPTE, label: 'nom du compte local', exemple: 'marie' }],
    etapes: [
      lec('Voir les administrateurs actuels', 'Pour savoir qui a déjà ces droits.', [ps('Get-LocalGroupMember -SID S-1-5-32-544')], 'La liste des comptes administrateurs du poste.'),
      mod('Ajouter le compte', 'S-1-5-32-544 est l’identifiant du groupe Administrateurs sur tous les Windows.', [ps('Add-LocalGroupMember -SID S-1-5-32-544 -Member {{compte}}')], 'Aucun message en cas de succès.', { important: 'Ce groupe donne tous les droits sur le poste. Ne l’accorde qu’à un compte qui en a vraiment besoin, et retire-le dès que le besoin disparaît.' }),
      lec('Vérifier', 'Le compte doit apparaître dans la liste.', [ps('Get-LocalGroupMember -SID S-1-5-32-544')], 'Le compte ajouté figure dans la liste. Il doit fermer puis rouvrir sa session pour que le droit soit actif.', { verification: true }),
    ],
    verification: ['Le compte est dans le groupe Administrateurs et dispose des droits après une nouvelle ouverture de session.'],
    retour: 'Remove-LocalGroupMember -SID S-1-5-32-544 -Member (nom du compte) retire les droits.',
    sources: [src('Add-LocalGroupMember', `${PSM}/microsoft.powershell.localaccounts/add-localgroupmember`), src('Get-LocalGroupMember', `${PSM}/microsoft.powershell.localaccounts/get-localgroupmember`)],
  }),
  fiche({
    id: 'win-local-desactiver', titre: 'Désactiver ou réactiver un compte local', effet: 'modification',
    resume: 'Désactive un compte local sans le supprimer : il ne peut plus ouvrir de session, mais son profil et ses fichiers restent. La réactivation se fait par la commande inverse.',
    intentions: ['désactiver un compte local', 'disable-localuser', 'bloquer un compte windows sans le supprimer', 'réactiver un compte local', 'enable-localuser'],
    motsCles: ['désactiver', 'compte local', 'disable-localuser', 'enable-localuser', 'bloquer'], privileges: ADMIN,
    params: [{ ...COMPTE, label: 'nom du compte local', exemple: 'marie' }],
    etapes: [
      lec('Voir l’état du compte', 'Enabled : True signifie que le compte peut ouvrir une session.', [ps('Get-LocalUser -Name {{compte}} | Select-Object Name, Enabled')], 'Enabled : True avant la désactivation.'),
      mod('Désactiver le compte', 'Le compte n’est pas supprimé.', [ps('Disable-LocalUser -Name {{compte}}')], 'Aucun message en cas de succès.', { important: 'Ne désactive jamais le dernier compte administrateur du poste : tu n’aurais plus de compte pour réparer.' }),
      lec('Vérifier', 'Enabled doit passer à False.', [ps('Get-LocalUser -Name {{compte}} | Select-Object Name, Enabled')], 'Enabled : False.', { verification: true }),
    ],
    verification: ['Le compte est désactivé (Enabled : False) et ne peut plus ouvrir de session.'],
    retour: 'Enable-LocalUser -Name (nom du compte) réactive le compte.',
    sources: [src('Disable-LocalUser', `${PSM}/microsoft.powershell.localaccounts/disable-localuser`), src('Enable-LocalUser', `${PSM}/microsoft.powershell.localaccounts/enable-localuser`)],
  }),
];
