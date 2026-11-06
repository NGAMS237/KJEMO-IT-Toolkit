/**
 * procedures-windows-examen.mjs — KJEMO-EXAMEN-WS-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les fiches de l'examen pratique « Serveur I » (Windows Server 2022) et de l'aide-mémoire qui l'accompagne :
 *   Q2 disque + quota FSRM · Q3 sauvegarde planifiée · Q4 miroir RAID 1 et restauration · Q5 exclusion DHCP ·
 *   Q6 script PowerShell (utilisateur, dossier, partage), plus un parcours qui enchaîne les six questions.
 * Chaque fiche offre l'OPTION GRAPHIQUE (console) en premier onglet et les commandes PowerShell en second.
 * Commandes d'après la documentation Microsoft (sources de chaque fiche). Rien n'est exécuté sur un vrai serveur ;
 * ce qui n'a PAS pu être confirmé dans la documentation est dit dans la fiche (étape « important »).
 */
import { lec, mod, des, itr, gui } from './cours-outils.mjs';
import { fiche as ficheWin, src, ps, ADMIN, WC } from './procedures-windows-simples.mjs';

const annul = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
const LETTRES = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const HEURES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const lettre = (id, label, exemple, aide, distinctDe) => ({ id, label, type: 'choix', choix: LETTRES, exemple, aide, ...(distinctDe ? { distinctDe } : {}) });
const disque = (id, label, exemple, aide, distinctDe) => ({ id, label, type: 'entier', min: 0, max: 99, exemple, aide, ...(distinctDe ? { distinctDe } : {}) });
const IPV4 = (id, label, exemple, aide) => ({ id, label, type: 'ipv4', exemple, aide });
const EXAMEN = ['examen', 'windows server 2022', 'serveur i', 'cégep limoilou'];

export const PROCEDURES_WINDOWS_EXAMEN = [
  // ------------------------------------------------------------------ Q2 — ajouter un disque
  (() => {
    const f = ficheWin({
      id: 'win-disque-ajouter', titre: 'Ajouter un disque à un serveur Windows (initialiser, formater)', categorie: 'Windows Server', effet: 'destructif', privileges: ADMIN,
      resume: 'Un disque neuf est « hors ligne » ou « non initialisé » : on l’initialise, on crée une partition, puis on la formate en NTFS avec une lettre. Examen Q2 : créer d’abord le disque de 2 Go dans l’hyperviseur. Option graphique : Gestion des disques.',
      intentions: ['ajouter un disque windows server', 'initialize-disk', 'new-partition', 'format-volume', 'formater un nouveau disque windows', 'gestion des disques diskmgmt', 'disque non initialisé', 'nouveau volume simple', 'créer un disque de 2 go'],
      motsCles: [...EXAMEN, 'disque', 'initialiser', 'partition', 'format-volume', 'ntfs', 'diskmgmt.msc', 'gpt', 'lettre'],
      params: [
        disque('numero', 'numéro du NOUVEAU disque', '1', 'Le numéro affiché par Get-Disk pour le disque vide (jamais 0 : c’est le disque système).'),
        lettre('lettre', 'lettre du lecteur à créer', 'E', 'Une lettre libre.'),
        { id: 'etiquette', label: 'nom du volume', type: 'identifiant', exemple: 'Donnees', aide: 'Le nom affiché dans l’Explorateur.' },
      ],
      etapes: [
        lec('Repérer le nouveau disque', 'Le disque neuf n’a pas de partition (RAW) et peut être « hors ligne ». Le disque système porte le numéro 0 : ne le touche pas.', [ps('Get-Disk | Select-Object Number, FriendlyName, Size, PartitionStyle, OperationalStatus'), ps('Get-Volume')], 'Une ligne par disque ; le nouveau a PartitionStyle RAW et la taille attendue (2 Go).', { important: 'Avant toute initialisation ou tout formatage, identifie le disque SYSTÈME : formater le mauvais disque détruit ses données.' }),
        mod('Mettre le disque en ligne (si besoin)', 'Un disque « Hors ligne » doit d’abord être mis en ligne et en lecture-écriture. Sans effet s’il l’est déjà.', [ps('Set-Disk -Number {{numero}} -IsOffline $false'), ps('Set-Disk -Number {{numero}} -IsReadOnly $false')], 'Aucun message.', { facultatif: true }),
        mod('Initialiser le disque', 'Choisit le style de partition : GPT (par défaut, recommandé). Le disque doit être vide.', [ps('Initialize-Disk -Number {{numero}} -PartitionStyle GPT')], 'Aucun message ; Get-Disk montre PartitionStyle GPT.'),
        mod('Créer la partition', 'Une seule partition qui prend tout le disque, avec la lettre choisie.', [ps('New-Partition -DiskNumber {{numero}} -UseMaximumSize -DriveLetter {{lettre}}')], 'Un tableau avec la lettre et la taille. Une fenêtre « Formater le disque » peut s’ouvrir : ferme-la, on formate à l’étape suivante.'),
        des('Formater en NTFS', 'Efface le contenu de la partition créée à l’étape précédente (vide) et lui donne son nom.', [ps('Format-Volume -DriveLetter {{lettre}} -FileSystem NTFS -NewFileSystemLabel {{etiquette}} -Confirm:$false')], 'Un tableau avec le système de fichiers NTFS et le nom du volume.'),
        lec('Vérifier', 'Le volume doit être sain, en NTFS, avec la bonne taille.', [ps('Get-Volume -DriveLetter {{lettre}}')], 'HealthStatus Healthy, FileSystem NTFS, taille proche de 2 Go.', { verification: true }),
        des('Annuler — effacer le disque (revenir à vide)', 'Supprime la partition et les données du disque dont tu as donné le numéro (jamais le disque 0). À n’utiliser que pour recommencer.', [ps('Clear-Disk -Number {{numero}} -RemoveData -Confirm:$false')], 'Aucun message ; le disque est de nouveau RAW.', annul),
      ],
      verification: ['Get-Volume montre le lecteur en NTFS, sain, à la taille attendue.'],
      retour: 'Clear-Disk -Number (numéro) -RemoveData efface le disque : les commandes sont dans l’étape « Annuler » ci-dessous.',
      sources: [src('Initialize-Disk', '/powershell/module/storage/initialize-disk'), src('New-Partition', '/powershell/module/storage/new-partition'), src('Format-Volume', '/powershell/module/storage/format-volume'), src('Clear-Disk', '/powershell/module/storage/clear-disk'), src('Gestion des disques', '/windows-server/storage/disk-management/overview-of-disk-management')],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du serveur.',
      etapes: [
        gui('Créer le disque virtuel dans l’hyperviseur', 'modification', 'Examen Q2 : « créez un nouveau disque de 2 Go ». Cette étape se fait HORS de Windows, dans l’hyperviseur, VM éteinte ou (selon l’hyperviseur) allumée.', ['Hyper-V : **Paramètres** de la VM › **Contrôleur SCSI** › **Disque dur** › **Ajouter** › **Nouveau** › taille **2 Go**. Autres hyperviseurs : ajouter un disque dur virtuel de 2 Go à la VM.'], 'La VM voit un disque de plus.'),
        gui('Ouvrir la Gestion des disques', 'lecture', 'Si le menu est difficile à atteindre : clic droit sur le menu Démarrer.', ['Appuie sur **Windows + R**, tape **diskmgmt.msc**, puis **Entrée** (ou clic droit sur le menu **Démarrer › Gestion des disques**).'], 'Une fenêtre liste les disques ; le nouveau est « Non alloué » ou « Hors ligne ».'),
        gui('Initialiser le disque', 'modification', 'Repère bien le NOUVEAU disque (taille 2 Go) : jamais le Disque 0.', ['Si le disque est **Hors ligne** : clic droit sur son nom à gauche › **En ligne**.', 'Clic droit › **Initialiser le disque** (ou la fenêtre s’ouvre toute seule), garde **GPT**, **OK**.'], 'Le disque passe à « En ligne » et « Non alloué ».', { important: 'Vérifie la taille avant de valider : le disque système est le Disque 0.' }),
        gui('Créer le volume simple et le formater', 'destructif', 'L’assistant crée la partition et la formate d’un coup.', ['Clic droit sur l’espace **Non alloué** › **Nouveau volume simple…** › **Suivant**.', 'Garde la taille maximale › **Suivant** › choisis la **lettre** › **Suivant**.', '**Système de fichiers : NTFS**, nom du volume, coche **Effectuer un formatage rapide** › **Suivant › Terminer**.'], 'Le volume apparaît « Sain » avec sa lettre dans l’Explorateur.'),
        gui('Vérifier', 'lecture', 'Le volume est visible partout.', ['Ouvre l’**Explorateur de fichiers › Ce PC** : le lecteur est présent avec la bonne taille.'], 'Le lecteur est présent avec environ 2 Go.', { verification: true }),
        gui('Annuler — supprimer le volume', 'destructif', 'Efface le volume et ses données ; l’espace redevient non alloué.', ['Dans **Gestion des disques**, clic droit sur le volume › **Supprimer le volume…** › confirme.'], 'L’espace redevient « Non alloué ».', annul),
      ],
      verification: ['Le lecteur apparaît « Sain » en NTFS dans Gestion des disques et dans Ce PC.'],
      retour: 'Clic droit sur le volume › Supprimer le volume.',
    });
    return f;
  })(),

  // ------------------------------------------------------------------ Q2 — quota
  (() => {
    const f = ficheWin({
      id: 'win-quota-fsrm', titre: 'Mettre un quota sur un dossier (FSRM)', categorie: 'Windows Server', effet: 'modification', privileges: ADMIN,
      resume: 'Installe le Gestionnaire de ressources du serveur de fichiers (FSRM), crée le dossier puis applique un quota sur CE dossier, pas sur le disque : strict (bloque) ou souple (surveille). Examen Q2 : 200 Mo sur « ExamenGR1 ». Option graphique : console FSRM.',
      intentions: ['quota sur un dossier windows server', 'new-fsrmquota', 'fsrm quota', 'limiter la taille d’un dossier windows', 'quota strict ou souple', 'gestionnaire de ressources du serveur de fichiers', 'quota 200 mo', 'examengr1'],
      motsCles: [...EXAMEN, 'quota', 'fsrm', 'new-fsrmquota', 'get-fsrmquota', 'dossier', 'strict', 'souple', 'ressources'],
      params: [
        { id: 'chemin', label: 'dossier à limiter', type: 'cheminWin', exemple: 'E:\\ExamenGR1', aide: 'Le chemin complet, sans espace. Le quota s’applique à ce dossier, pas au disque.' },
        { id: 'tailleMo', label: 'limite en Mo', type: 'entier', min: 1, max: 1048576, exemple: '200', aide: 'La taille maximale du dossier, en mégaoctets.' },
      ],
      etapes: [
        lec('Vérifier si FSRM est installé', 'Install State : Installed veut dire que le rôle est déjà là.', [ps('Get-WindowsFeature FS-Resource-Manager')], 'Une ligne avec [X] (installé) ou [ ] (à installer).'),
        mod('Installer FSRM', 'Ajoute le gestionnaire de ressources et sa console. Sans effet s’il est déjà installé.', [ps('Install-WindowsFeature FS-Resource-Manager -IncludeManagementTools')], 'Success : True. Un redémarrage n’est normalement pas nécessaire.'),
        mod('Créer le dossier', 'Le dossier à limiter doit exister (le disque doit déjà être formaté : fiche « Ajouter un disque »).', [ps('New-Item -Path {{chemin}} -ItemType Directory')], 'Une ligne avec le dossier créé. Une erreur « existe déjà » est sans gravité.'),
        mod('Appliquer le quota STRICT sur le dossier', 'Sans -SoftLimit, le quota est strict : une fois la limite atteinte, plus aucun fichier ne peut être enregistré dans le dossier. Il s’applique au dossier et à ses sous-dossiers.', [ps('New-FsrmQuota -Path {{chemin}} -Size {{tailleMo}}MB')], 'Un tableau avec le chemin, la taille en octets et le type de limite.', { important: 'Attention : ce quota est sur le DOSSIER. Un quota « sur le disque » (la racine E:\\) ne répond pas à la consigne.' }),
        mod('Variante : quota SOUPLE (facultatif)', 'Un quota souple surveille et avertit sans bloquer. Supprime d’abord le quota strict (étape Annuler), car un dossier n’a qu’un quota.', [ps('New-FsrmQuota -Path {{chemin}} -Size {{tailleMo}}MB -SoftLimit')], 'Un tableau avec SoftLimit : True.', { facultatif: true }),
        lec('Vérifier le quota', 'Montre la limite, l’usage et le type (strict ou souple).', [ps('Get-FsrmQuota -Path {{chemin}} | Format-List Path, Size, SoftLimit, Usage')], 'Path : le dossier ; Size : la taille en octets (200 Mo = 209715200) ; SoftLimit : False pour un quota strict.', { verification: true }),
        mod('Tester le blocage (facultatif)', 'Crée un fichier plus gros que la limite : avec un quota strict de 200 Mo, Windows refuse. Utile pour la capture d’écran de l’examen.', [ps('fsutil file createnew {{chemin}}\\essai_quota.bin 314572800')], 'Un message d’erreur de disque plein ou d’espace insuffisant (le fichier fait 300 Mo).', { facultatif: true }),
        mod('Annuler — supprimer le fichier d’essai', 'Retire le fichier créé par le test (s’il a été créé).', [ps('Remove-Item {{chemin}}\\essai_quota.bin -ErrorAction SilentlyContinue')], 'Aucun message.', annul),
        mod('Annuler — supprimer le quota', 'Retire le quota du dossier ; le dossier et ses fichiers restent.', [ps('Remove-FsrmQuota -Path {{chemin}} -Confirm:$false')], 'Aucun message ; Get-FsrmQuota ne retrouve plus le dossier.', annul),
      ],
      verification: ['Get-FsrmQuota affiche le dossier avec la bonne taille et le bon type de limite.'],
      retour: 'Remove-FsrmQuota supprime le quota : la commande est dans l’étape « Annuler » ci-dessous.',
      sources: [src('New-FsrmQuota', '/powershell/module/fileserverresourcemanager/new-fsrmquota'), src('Get-FsrmQuota', '/powershell/module/fileserverresourcemanager/get-fsrmquota'), src('Remove-FsrmQuota', '/powershell/module/fileserverresourcemanager/remove-fsrmquota'), src('Install-WindowsFeature', '/powershell/module/servermanager/install-windowsfeature')],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du serveur.',
      etapes: [
        gui('Installer le rôle FSRM', 'modification', 'Sans ce rôle, la console des quotas n’existe pas.', ['**Gestionnaire de serveur › Gérer › Ajouter des rôles et fonctionnalités**, **Suivant** jusqu’à **Rôles de serveurs**.', 'Déroule **Services de fichiers et de stockage › Services de fichiers et iSCSI** et coche **Gestionnaire de ressources du serveur de fichiers** (accepte d’ajouter les outils), puis **Suivant › Installer**.'], 'L’installation se termine par « Installation réussie ».'),
        gui('Créer le dossier', 'modification', 'Sur le disque formaté : par exemple E:\\ExamenGR1.', ['Dans l’**Explorateur**, ouvre le lecteur, clic droit › **Nouveau › Dossier**, nomme-le.'], 'Le dossier apparaît.'),
        gui('Ouvrir la console FSRM', 'lecture', 'La console est dans le menu Outils.', ['**Gestionnaire de serveur › Outils › Gestionnaire de ressources du serveur de fichiers**.', 'Déroule **Gestion des quotas › Quotas**.'], 'Le volet central liste les quotas (vide au début).'),
        gui('Créer le quota sur le DOSSIER', 'modification', 'Choisis bien « un quota sur le chemin » et non l’application automatique à des sous-dossiers.', ['Clic droit sur **Quotas › Créer un quota…**.', '**Chemin du quota** : le dossier (bouton **Parcourir**).', 'Coche **Créer un quota sur le chemin**.', 'Coche **Définir des propriétés de quota personnalisées**, puis **Propriétés personnalisées…**.', '**Limite d’espace** : la taille voulue (par exemple 200 Mo) ; **Quota strict** pour bloquer, **Quota souple** pour surveiller seulement ; **OK › Créer**.'], 'Le quota apparaît dans la liste avec le chemin du DOSSIER et la limite.', { important: 'Les libellés exacts de l’assistant peuvent varier légèrement ; l’idée est : chemin = le dossier, créer un quota sur le chemin, limite d’espace personnalisée.' }),
        gui('Vérifier le quota', 'lecture', 'Le volet central montre l’usage par rapport à la limite.', ['Dans **Quotas**, repère la ligne du dossier : colonne **Limite** et **Utilisation**.'], 'La ligne montre le dossier, la limite et le type (strict ou souple).', { verification: true }),
        gui('Annuler — supprimer le quota', 'modification', 'Le dossier et ses fichiers restent.', ['Clic droit sur le quota › **Supprimer le quota** › confirme.'], 'La ligne disparaît de la liste.', annul),
      ],
      verification: ['La console FSRM liste le quota sur le dossier, avec la bonne limite.'],
      retour: 'Clic droit sur le quota › Supprimer le quota.',
    });
    return f;
  })(),

  // ------------------------------------------------------------------ Q3 — sauvegarde planifiée
  (() => {
    const f = ficheWin({
      id: 'win-sauvegarde-planifier', titre: 'Planifier une sauvegarde incrémentale (Sauvegarde Windows Server)', categorie: 'Windows Server', effet: 'destructif', privileges: ADMIN,
      resume: 'Planifie la sauvegarde d’un lecteur vers un disque dédié, à heures fixes (exemple d’examen Q3 : 13 h et 16 h), en mode incrémentiel. Planifiée ne veut pas dire exécutée : on lance une première sauvegarde et on la vérifie. Option graphique : assistant de planification.',
      intentions: ['sauvegarde planifiée windows server', 'windows server backup', 'new-wbpolicy', 'set-wbschedule', 'planifier un backup deux fois par jour', 'sauvegarde incrémentale windows', 'wbadmin get versions', 'backup 13h et 16h', 'sauvegarde sur un disque dédié'],
      motsCles: [...EXAMEN, 'sauvegarde', 'backup', 'wbadmin', 'new-wbpolicy', 'set-wbschedule', 'incrémentiel', 'disque dédié', 'windows-server-backup'],
      params: [
        lettre('source', 'lecteur à sauvegarder', 'E', 'Celui du disque ajouté à la question 2.', ['rang']),
        disque('rang', 'rang du disque de sauvegarde dans Get-WBDisk', '1', 'Le rang (0 = premier) du disque DÉDIÉ dans la liste de Get-WBDisk. Jamais le disque système ni le disque à sauvegarder.'),
        { id: 'heure1', label: 'première heure', type: 'choix', choix: HEURES, exemple: '13:00', aide: 'Au format HH:MM.', distinctDe: ['heure2'] },
        { id: 'heure2', label: 'seconde heure', type: 'choix', choix: HEURES, exemple: '16:00', aide: 'Au format HH:MM.', distinctDe: ['heure1'] },
      ],
      etapes: [
        lec('Vérifier la fonctionnalité', 'Sauvegarde Windows Server est une fonctionnalité, pas un rôle.', [ps('Get-WindowsFeature Windows-Server-Backup')], '[X] si elle est installée.'),
        mod('Installer Sauvegarde Windows Server', 'Ajoute la fonctionnalité et la commande wbadmin.', [ps('Install-WindowsFeature Windows-Server-Backup')], 'Success : True.'),
        lec('Lister les disques utilisables comme destination', 'Les disques EN LIGNE que la sauvegarde peut utiliser. Note le rang du disque dédié (le premier est 0).', [ps('Get-WBDisk | Format-List *'), ps('Get-Disk | Select-Object Number, FriendlyName, Size')], 'Une fiche par disque avec sa taille ; repère celui qui est vide et dédié à la sauvegarde (ajoute-en un au besoin).', { important: 'La destination doit être DIFFÉRENTE de la source. Le disque de destination est préparé (et reformaté) par la sauvegarde : n’y mets rien d’important.' }),
        mod('Créer et enregistrer la planification', 'Une politique : le lecteur à sauvegarder, la destination et les heures. Set-WBPolicy l’enregistre : elle devient la sauvegarde planifiée du serveur. À coller d’un bloc dans la même fenêtre PowerShell.', [ps('$P = New-WBPolicy; Add-WBVolume -Policy $P -Volume (Get-WBVolume -VolumePath "{{source}}:"); Add-WBBackupTarget -Policy $P -Target (New-WBBackupTarget -Disk (Get-WBDisk)[{{rang}}]); Set-WBSchedule -Policy $P -Schedule {{heure1}},{{heure2}}; Set-WBPolicy -Policy $P -Force')], 'Aucun message d’erreur. Get-WBPolicy montre ensuite la politique.', { important: 'Cette commande n’a pas été exécutée sur un vrai serveur. Si PowerShell répond sur Get-WBDisk ou la destination, compare avec la section « Examples » de New-WBBackupTarget et Set-WBPolicy (sources).' }),
        mod('Mode incrémentiel (facultatif)', 'Après la première sauvegarde complète, ne copier que les changements : plus rapide. Cette commande suit la page de la documentation Microsoft, dont la syntaxe et l’exemple ne concordent pas : si PowerShell refuse, utilise l’option graphique « Configurer les performances ».', [ps('Set-WBPerformanceConfiguration -OverallPerformanceSetting AlwaysIncremental')], 'Aucun message. Si PowerShell refuse, voir l’onglet Option graphique.', { facultatif: true }),
        lec('Vérifier la planification', 'La politique doit montrer la source, la destination et les deux heures.', [ps('Get-WBPolicy'), ps('Get-WBSchedule -Policy (Get-WBPolicy)'), ps('Get-WBSummary')], 'La politique avec le lecteur, le disque de destination et les heures 13:00 et 16:00.', { verification: true }),
        mod('Lancer une première sauvegarde maintenant (facultatif)', 'Une sauvegarde planifiée ne produit une version qu’après son heure : pour la capture d’écran et pour être sûr que ça marche, lance-la tout de suite.', [ps('Start-WBBackup -Policy (Get-WBPolicy)')], 'Un suivi de progression, puis « Success » à la fin.', { facultatif: true }),
        lec('Voir les sauvegardes disponibles', 'Une ligne par version sauvegardée, avec sa date. C’est ce qu’on restaure ensuite.', [ps('wbadmin get versions')], 'Au moins une version après la première exécution.', { facultatif: true }),
        des('Annuler — supprimer la sauvegarde planifiée', 'Arrête les sauvegardes planifiées et libère le disque de destination. Les sauvegardes déjà faites restent sur ce disque.', [ps('Remove-WBPolicy -All -Force')], 'Aucun message ; Get-WBPolicy ne retourne plus rien.', annul),
      ],
      verification: ['Get-WBPolicy montre le lecteur, la destination dédiée et les heures prévues ; une version apparaît dans wbadmin get versions après la première exécution.'],
      retour: 'Remove-WBPolicy -All -Force supprime la planification : la commande est dans l’étape « Annuler » ci-dessous.',
      sources: [src('New-WBPolicy', '/powershell/module/windowsserverbackup/new-wbpolicy'), src('Set-WBSchedule', '/powershell/module/windowsserverbackup/set-wbschedule'), src('New-WBBackupTarget', '/powershell/module/windowsserverbackup/new-wbbackuptarget'), src('Set-WBPolicy', '/powershell/module/windowsserverbackup/set-wbpolicy'), src('Set-WBPerformanceConfiguration', '/powershell/module/windowsserverbackup/set-wbperformanceconfiguration'), src('Remove-WBPolicy', '/powershell/module/windowsserverbackup/remove-wbpolicy'), src('wbadmin get versions', `${WC}/wbadmin-get-versions`)],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du serveur. Le disque de destination doit être ajouté à la VM avant l’assistant.',
      etapes: [
        gui('Installer la fonctionnalité', 'modification', 'Sauvegarde Windows Server est une fonctionnalité du Gestionnaire de serveur.', ['**Gestionnaire de serveur › Gérer › Ajouter des rôles et fonctionnalités**, **Suivant** jusqu’à **Fonctionnalités**.', 'Coche **Sauvegarde Windows Server**, puis **Suivant › Installer**.'], 'Installation réussie.'),
        gui('Ouvrir l’assistant de planification', 'lecture', 'Tout se fait depuis la console de sauvegarde.', ['**Gestionnaire de serveur › Outils › Sauvegarde Windows Server**.', 'Dans le volet de droite **Actions**, clique **Planification de sauvegarde…** puis **Suivant**.'], 'L’assistant « Planification de sauvegarde » s’ouvre.'),
        gui('Choisir ce qu’il faut sauvegarder', 'modification', 'Ici, uniquement le lecteur de la question 2 et pas tout le serveur.', ['**Configuration de la sauvegarde : Personnalisée** › **Suivant**.', '**Ajouter des éléments** › coche le lecteur à sauvegarder (par exemple **E:**) › **OK › Suivant**.'], 'Le lecteur apparaît dans la liste des éléments.'),
        gui('Choisir les heures', 'modification', 'Deux sauvegardes par jour : il faut le demander explicitement.', ['**Spécifier l’heure de sauvegarde : Plusieurs fois par jour**.', 'Sélectionne **13:00** puis **Ajouter**, puis **16:00** puis **Ajouter**, **Suivant**.'], 'Les deux heures sont dans la liste de droite.'),
        gui('Choisir le disque de destination', 'destructif', 'Un disque DÉDIÉ, différent de la source. L’assistant le formate : n’y mets rien d’important.', ['**Type de destination : Sauvegarder sur un disque dur dédié à vos sauvegardes** › **Suivant**.', '**Ajouter** le disque dédié › **OK › Suivant**, confirme l’avertissement de formatage, **Suivant › Terminer**.'], 'Un résumé « La sauvegarde planifiée a été créée ».', { important: 'Les libellés exacts peuvent varier un peu selon la version ; l’ordre (éléments, heures, destination) reste le même.' }),
        gui('Choisir le mode incrémentiel', 'modification', 'Plus rapide : après la première sauvegarde complète, seules les modifications sont copiées.', ['Dans le volet **Actions**, clique **Configurer les performances…**.', 'Choisis **Performances de sauvegarde plus rapides** (sauvegardes incrémentielles) › **OK**.'], 'Le réglage est enregistré.', { important: 'Cette option graphique est la voie documentée par l’aide-mémoire du cours ; je n’ai pas pu confirmer son libellé exact sur une version précise.' }),
        gui('Vérifier la planification', 'lecture', 'La console montre la prochaine sauvegarde.', ['Dans le volet central, la zone **Sauvegarde planifiée** (ou **Messages**) indique la destination et la prochaine exécution.'], 'La prochaine heure d’exécution (13:00 ou 16:00) est affichée.', { verification: true }),
        gui('Restaurer un fichier (pour savoir le faire)', 'modification', 'Planifié ne veut pas dire testé : il faut savoir récupérer.', ['**Actions › Récupérer…** › **Ce serveur** › choisis la **date et l’heure** › **Fichiers et dossiers** › sélectionne le fichier › **Emplacement d’origine** ou un autre › **Récupérer**.'], 'Le fichier réapparaît à l’endroit choisi.', { facultatif: true }),
        gui('Annuler — arrêter la sauvegarde planifiée', 'modification', 'Libère le disque de destination ; les sauvegardes déjà faites restent.', ['Dans le volet **Actions**, **Planification de sauvegarde…** › **Arrêter la sauvegarde** › confirme.'], 'Plus de prochaine exécution affichée.', annul),
      ],
      verification: ['La console montre la sauvegarde planifiée, sa destination et la prochaine exécution.'],
      retour: 'Planification de sauvegarde › Arrêter la sauvegarde.',
    });
    return f;
  })(),

  // ------------------------------------------------------------------ Q4 — miroir RAID 1
  (() => {
    const f = ficheWin({
      id: 'win-miroir-raid1', titre: 'Créer un miroir RAID 1 sous Windows et le restaurer', categorie: 'Windows Server', effet: 'destructif', privileges: ADMIN,
      resume: 'Examen Q4 : transforme un volume en miroir sur un second disque (RAID 1), y met un fichier, puis simule une panne en retirant un disque et reconstruit le miroir avec un disque neuf. Option graphique : Gestion des disques (« Ajouter un miroir »). Un miroir n’est pas une sauvegarde.',
      intentions: ['raid 1 windows server', 'miroir windows server', 'ajouter un miroir gestion des disques', 'volume en miroir', 'restaurer un raid 1 windows', 'disque miroir en panne', 'diskpart add disk', 'redondance en échec', 'dynamic disk mirror'],
      motsCles: [...EXAMEN, 'raid1', 'raid 1', 'miroir', 'mirror', 'diskpart', 'disque dynamique', 'redondance', 'resynchronisation', 'diskmgmt.msc'],
      params: [
        lettre('volume', 'lettre du volume à mettre en miroir', 'E', 'Le volume qui contient les données à protéger.'),
        disque('disque1', 'numéro du disque qui porte déjà le volume', '1', 'Le numéro donné par Get-Disk.', ['disque2']),
        disque('disque2', 'numéro du second disque (celui du miroir)', '2', 'Un disque vide, de taille égale ou supérieure, jamais le disque 0.', ['disque1']),
        disque('nouveau', 'numéro du disque de remplacement', '3', 'Le disque neuf qui prend la place du disque perdu.'),
      ],
      etapes: [
        lec('Repérer les disques et le volume', 'Il faut un disque de plus, vide, pour le miroir. Ajoute-le dans l’hyperviseur au besoin (taille égale ou supérieure).', [ps('Get-Disk | Select-Object Number, FriendlyName, Size, PartitionStyle, OperationalStatus'), ps('Get-Volume -DriveLetter {{volume}}')], 'Le volume à protéger et un disque vide en plus.', { phase: 'Créer le miroir' }),
        mod('Écrire le script de création du miroir', 'diskpart ne se pilote pas ligne par ligne depuis PowerShell : on écrit ses commandes dans un fichier. Il convertit les deux disques en disques dynamiques (obligatoire pour un miroir), puis ajoute le miroir au volume.', [ps('Set-Content -Path $env:TEMP\\miroir.txt -Encoding ASCII -Value "select disk {{disque1}}","convert dynamic","select disk {{disque2}}","convert dynamic","select volume {{volume}}","add disk={{disque2}}"')], 'Aucun message : le fichier est créé.', { phase: 'Créer le miroir', important: 'Syntaxe diskpart (add disk=, convert dynamic) d’après la documentation de diskpart ; non exécutée sur un vrai serveur. En cas de doute, tape « add disk /? » dans diskpart ou utilise l’option graphique.' }),
        des('Lancer la création du miroir', 'Convertit les deux disques en dynamiques (opération qui ne se défait pas en un clic) et lance la synchronisation du miroir.', [ps('diskpart /s $env:TEMP\\miroir.txt')], 'Des messages « DiskPart a converti le disque » puis « DiskPart a ajouté le miroir au volume ».', { phase: 'Créer le miroir' }),
        mod('Ajouter un fichier sur le volume', 'Examen Q4 : « Ajouter un fichier sur le disque RAID 1 ».', [ps('Set-Content -Path {{volume}}:\\preuve_raid1.txt -Value "fichier de test RAID 1"')], 'Aucun message ; le fichier existe.', { phase: 'Créer le miroir' }),
        lec('Vérifier le miroir', 'Dans la liste des volumes, le volume est de type « Mirror » (ou « Miroir »). Attends que la synchronisation se termine.', [ps('"list volume" | diskpart'), ps('Get-Content {{volume}}:\\preuve_raid1.txt')], 'Le volume de type Mirror, puis le contenu du fichier de test.', { verification: true, phase: 'Créer le miroir', important: 'Dans l’Explorateur, un miroir apparaît comme UN seul lecteur : pour le vérifier, ouvre Gestion des disques (état « Sain » puis « Resynchronisation »).' }),
        itr('Simuler la panne : retirer un disque (dans l’hyperviseur)', 'Examen Q4 : « Supprimer un des disques du RAID 1 ». Éteins la VM, retire le second disque du miroir dans les paramètres de la VM, puis rallume. Le volume reste utilisable sur l’autre disque mais passe en « Redondance en échec ».', [ps('"list disk" | diskpart'), ps('"list volume" | diskpart')], 'Le disque retiré apparaît comme « Manquant » ou « Missing » ; le volume est marqué en échec de redondance.', { phase: 'Panne et restauration' }),
        mod('Ajouter le disque de remplacement et le rendre dynamique', 'Ajoute un disque neuf (taille égale ou supérieure) à la VM, puis écris le script de réparation : il retire le côté manquant du miroir, convertit le disque neuf, puis rattache un nouveau miroir.', [ps('Set-Content -Path $env:TEMP\\restaurer.txt -Encoding ASCII -Value "select volume {{volume}}","break disk={{disque2}} nokeep","select disk {{nouveau}}","convert dynamic","select volume {{volume}}","add disk={{nouveau}}"')], 'Aucun message : le fichier est créé.', { phase: 'Panne et restauration', important: '« break disk=N nokeep » retire le côté manquant du miroir ; sa syntaxe vient de mes souvenirs de diskpart, non confirmée dans la documentation lue : vérifie avec « break disk /? » ou utilise la voie graphique (clic droit › Supprimer le miroir).' }),
        des('Reconstruire le miroir', 'Applique le script : le miroir est refait sur le disque neuf et se resynchronise.', [ps('diskpart /s $env:TEMP\\restaurer.txt')], 'Des messages de confirmation de diskpart, puis la resynchronisation commence.', { phase: 'Panne et restauration' }),
        lec('Vérifier la restauration', 'Le fichier d’avant la panne doit être intact et le miroir sain.', [ps('Get-Content {{volume}}:\\preuve_raid1.txt'), ps('"list volume" | diskpart')], 'Le contenu du fichier de test et un volume de type Mirror.', { verification: true, phase: 'Panne et restauration' }),
        mod('Annuler — défaire le miroir en gardant les données', 'Sépare le miroir en deux volumes indépendants : chaque disque garde sa copie.', [ps('Set-Content -Path $env:TEMP\\separer.txt -Encoding ASCII -Value "select volume {{volume}}","break disk={{disque2}}"'), ps('diskpart /s $env:TEMP\\separer.txt')], 'diskpart confirme la séparation du miroir.', annul),
      ],
      verification: ['Le volume est de type Mirror et sain, le fichier de test est lisible, et après la panne le miroir est reconstruit sur le disque de remplacement.'],
      retour: 'La séparation du miroir est dans l’étape « Annuler » ci-dessous.',
      sources: [src('diskpart', `${WC}/diskpart`), src('convert dynamic', `${WC}/convert-dynamic`), src('Vue d’ensemble de la Gestion des disques', '/windows-server/storage/disk-management/overview-of-disk-management')],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du serveur.',
      etapes: [
        gui('Ouvrir la Gestion des disques', 'lecture', 'Win + R puis diskmgmt.msc, ou clic droit sur le menu Démarrer.', ['**Windows + R**, tape **diskmgmt.msc**, **Entrée**.', 'Repère le volume à protéger et le disque libre pour le miroir.'], 'Le volume de données et un disque « Non alloué » de taille égale ou supérieure.', { phase: 'Créer le miroir' }),
        gui('Ajouter un miroir au volume', 'destructif', 'Windows convertit les deux disques en disques DYNAMIQUES (acceptation demandée).', ['Clic droit sur le **volume** à protéger › **Ajouter un miroir…**.', 'Sélectionne le **second disque** › **Ajouter un miroir**.', 'Accepte la **conversion en disques dynamiques** si elle est demandée.'], 'Les deux disques portent le même volume ; l’état passe à « Resynchronisation » puis « Sain ».', { phase: 'Créer le miroir', important: 'La conversion en disque dynamique ne se défait pas simplement : choisis bien les disques.' }),
        gui('Ajouter un fichier et vérifier', 'lecture', 'Dans l’Explorateur, le miroir apparaît comme UN seul lecteur.', ['Crée un fichier dans le lecteur du miroir.', 'Dans **Gestion des disques**, attends l’état **Sain** sur les deux disques.'], 'Les deux disques sont « Sains » et affichent le même volume.', { verification: true, phase: 'Créer le miroir' }),
        gui('Simuler la panne : retirer un disque', 'interruption', 'Se fait dans l’hyperviseur : éteins la VM, retire un des deux disques du miroir, rallume la VM.', ['Dans **Gestion des disques**, le volume passe en **Redondance en échec** et un disque est **Manquant**.'], 'Le volume est utilisable mais sans redondance.', { phase: 'Panne et restauration' }),
        gui('Ajouter un disque neuf et reconstruire', 'destructif', 'On enlève le côté manquant puis on remet un miroir avec le disque neuf.', ['Ajoute un disque neuf à la VM, puis dans **Gestion des disques**, **Action › Réanalyser les disques**.', 'Clic droit sur la partie du miroir portée par le disque **Manquant** › **Supprimer le miroir…** › choisis le disque manquant › **Supprimer le miroir** › confirme.', 'Clic droit sur le volume restant › **Ajouter un miroir…** › choisis le **disque neuf** (conversion en dynamique acceptée).'], 'Le miroir repasse en « Resynchronisation » puis « Sain ».', { phase: 'Panne et restauration' }),
        gui('Vérifier la restauration', 'lecture', 'Le fichier d’avant la panne doit être intact.', ['Ouvre le lecteur : le fichier est présent. Dans **Gestion des disques**, les deux disques sont **Sains**.'], 'Fichier intact et miroir sain.', { verification: true, phase: 'Panne et restauration' }),
        gui('Annuler — supprimer le miroir en gardant les données', 'destructif', 'Garde une copie sur chaque disque (« Scinder le volume en miroir ») ou supprime un côté.', ['Clic droit sur le volume › **Scinder le volume en miroir** pour obtenir deux volumes indépendants, ou **Supprimer le miroir…** pour retirer un côté.'], 'Les deux disques ne sont plus en miroir.', annul),
      ],
      verification: ['Gestion des disques montre le volume sain sur deux disques, avant et après la reconstruction.'],
      retour: 'Clic droit sur le volume › Scinder le volume en miroir.',
    });
    return f;
  })(),

  // ------------------------------------------------------------------ Q5 — exclusion DHCP
  (() => {
    const f = ficheWin({
      id: 'win-dhcp-exclusion', titre: 'Exclure une plage d’adresses d’une étendue DHCP', categorie: 'Windows Server', effet: 'modification', privileges: 'Rôle DHCP installé et autorisé ; PowerShell en administrateur (ou membre du groupe « Administrateurs DHCP »).',
      resume: 'Retire une plage d’adresses de la distribution : ces adresses restent libres pour les serveurs à adresse fixe. Examen Q5 : réseau 192.168.50.0/24, les 50 premières adresses exclues, serveur en 192.168.50.1. Option graphique : console DHCP.',
      intentions: ['exclure des adresses dhcp', 'add-dhcpserverv4exclusionrange', 'plage d’exclusion dhcp', 'les 50 premières adresses exclues', 'adresses statiques hors de la plage dhcp', 'étendue dhcp 192.168.50.0'],
      motsCles: [...EXAMEN, 'dhcp', 'exclusion', 'étendue', 'scope', 'add-dhcpserverv4exclusionrange', 'plage'],
      params: [
        IPV4('reseau', 'identifiant de l’étendue (adresse du réseau)', '192.168.50.0', 'Le réseau de l’étendue, par exemple 192.168.50.0.'),
        IPV4('debut', 'première adresse exclue', '192.168.50.1', 'La première adresse qui ne sera pas distribuée.'),
        IPV4('fin', 'dernière adresse exclue', '192.168.50.50', 'Les 50 premières adresses : de .1 à .50.'),
      ],
      etapes: [
        lec('Voir l’étendue', 'L’étendue doit déjà exister (fiche « Créer une étendue DHCP »). Pour l’examen : début .1, fin .254, puis exclure .1 à .50 ; ou débuter directement à .51.', [ps('Get-DhcpServerv4Scope')], 'L’étendue avec son identifiant (192.168.50.0), sa plage et State : Active.'),
        mod('Ajouter la plage d’exclusion', 'Ces adresses ne seront plus louées aux clients. Une réservation située dans la plage reste honorée.', [ps('Add-DhcpServerv4ExclusionRange -ScopeId {{reseau}} -StartRange {{debut}} -EndRange {{fin}}')], 'Aucun message en cas de succès.'),
        lec('Vérifier les exclusions', 'La plage doit apparaître pour l’étendue.', [ps('Get-DhcpServerv4ExclusionRange -ScopeId {{reseau}}')], 'Une ligne avec StartRange et EndRange attendus.', { verification: true }),
        mod('Annuler — retirer la plage d’exclusion', 'Les adresses redeviennent distribuables.', [ps('Remove-DhcpServerv4ExclusionRange -ScopeId {{reseau}} -StartRange {{debut}} -EndRange {{fin}}')], 'Aucun message ; la plage disparaît de Get-DhcpServerv4ExclusionRange.', annul),
      ],
      verification: ['Get-DhcpServerv4ExclusionRange montre la plage exclue pour l’étendue.'],
      retour: 'Remove-DhcpServerv4ExclusionRange retire la plage : la commande est dans l’étape « Annuler » ci-dessous.',
      sources: [src('Add-DhcpServerv4ExclusionRange', '/powershell/module/dhcpserver/add-dhcpserverv4exclusionrange'), src('Get-DhcpServerv4ExclusionRange', '/powershell/module/dhcpserver/get-dhcpserverv4exclusionrange'), src('Remove-DhcpServerv4ExclusionRange', '/powershell/module/dhcpserver/remove-dhcpserverv4exclusionrange')],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du serveur DHCP.',
      etapes: [
        gui('Ouvrir la console DHCP', 'lecture', 'Le rôle DHCP doit être installé et autorisé.', ['**Gestionnaire de serveur › Outils › DHCP**.', 'Déroule le serveur › **IPv4** › l’étendue (par exemple **Étendue [192.168.50.0]**) › **Pool d’adresses**.'], 'Le pool affiche la plage distribuée.'),
        gui('Ajouter la plage d’exclusion', 'modification', 'Examen Q5 : les 50 premières adresses sont exclues.', ['Clic droit sur **Pool d’adresses › Nouvelle plage d’exclusion…**.', '**Adresse IP de début** et **de fin** : de .1 à .50, puis **Ajouter › Fermer**.'], 'La plage apparaît dans la liste du pool, marquée « Exclusion ».'),
        gui('Vérifier', 'lecture', 'Le pool distingue la plage distribuée et la plage exclue.', ['Dans **Pool d’adresses**, vérifie la ligne d’exclusion.'], 'La plage exclue est listée.', { verification: true }),
        gui('Annuler — retirer l’exclusion', 'modification', 'Les adresses redeviennent distribuables.', ['Dans **Pool d’adresses**, clic droit sur la ligne d’exclusion › **Supprimer**.'], 'La ligne disparaît.', annul),
      ],
      verification: ['La console DHCP affiche la plage d’exclusion dans le pool d’adresses.'],
      retour: 'Pool d’adresses › clic droit sur l’exclusion › Supprimer.',
    });
    return f;
  })(),
  // ------------------------------------------------------------------ Q6 — script PowerShell
  (() => {
    const SCRIPT_UTILISATEUR = [
      '$nom = Read-Host "Nom de famille"',
      '$prenom = Read-Host "Prenom"',
      '$ou = Read-Host "Unite organisationnelle, chemin complet (ex. OU=Etudiants,DC=examen,DC=lan)"',
      '$groupe = Read-Host "Groupe de securite"',
      '$mdp = Read-Host "Mot de passe" -AsSecureString',
      '$login = "${nom}.${prenom}"',
      '$domaine = Get-ADDomain',
      'New-ADUser -Name "$prenom $nom" -GivenName $prenom -Surname $nom -SamAccountName $login -UserPrincipalName "$login@$($domaine.DNSRoot)" -Path $ou -AccountPassword $mdp -Enabled $true',
      'Add-ADGroupMember -Identity $groupe -Members $login',
      '$racine = "C:\\DossierUtilisateur"',
      'if (-not (Test-Path $racine)) { New-Item -Path $racine -ItemType Directory | Out-Null }',
      '$dossier = Join-Path $racine $login',
      'New-Item -Path $dossier -ItemType Directory | Out-Null',
      '$compte = "$($domaine.NetBIOSName)\\$login"',
      'icacls $dossier /grant "${compte}:(OI)(CI)R" | Out-Null',
      'New-SmbShare -Name $login -Path $dossier -ReadAccess $compte',
      'Write-Host "Utilisateur $login cree, dossier et partage en lecture prets."',
    ];
    const SCRIPT_CSV = [
      'param(',
      '[Parameter(Mandatory=$true)]',
      '[string]$Fichier',
      ')',
      'Import-Module ActiveDirectory',
      '$MotDePasse = Read-Host "Mot de passe initial des comptes" -AsSecureString',
      '$Racine = "C:\\DonneesUtilisateurs"',
      '$DN = (Get-ADDomain).DistinguishedName',
      '$Dns = (Get-ADDomain).DNSRoot',
      'if (-not (Test-Path $Racine)) { New-Item -Path $Racine -ItemType Directory | Out-Null }',
      '$Utilisateurs = Import-Csv -Path $Fichier -Delimiter ";"',
      'foreach ($U in $Utilisateurs) {',
      '  $NomComplet = $U."Nom complet"',
      '  $Nom = $U.nom',
      '  $OU = $U."Unité organisationnelle"',
      '  $CheminOU = "OU=$OU,$DN"',
      '  if (-not (Get-ADOrganizationalUnit -Filter "Name -eq \'$OU\'" -ErrorAction SilentlyContinue)) {',
      '    New-ADOrganizationalUnit -Name $OU -Path $DN',
      '  }',
      '  if (-not (Get-ADUser -Filter "SamAccountName -eq \'$Nom\'" -ErrorAction SilentlyContinue)) {',
      '    New-ADUser -Name $NomComplet -SamAccountName $Nom -UserPrincipalName "$Nom@$Dns" -Path $CheminOU -AccountPassword $MotDePasse -Enabled $true',
      '    $Dossier = Join-Path $Racine $Nom',
      '    if (-not (Test-Path $Dossier)) { New-Item -Path $Dossier -ItemType Directory | Out-Null }',
      '  }',
      '}',
    ];
    const f = ficheWin({
      id: 'win-script-utilisateur-partage', titre: 'Script PowerShell : créer un utilisateur, son dossier et son partage', categorie: 'Windows Server', effet: 'modification', privileges: 'Contrôleur de domaine (module ActiveDirectory), PowerShell ouvert en administrateur.',
      resume: 'Examen Q6 : un script qui demande le nom, le prénom, l’OU et le groupe avec Read-Host, crée nom.prenom, le met dans le groupe, crée son dossier dans C:\\DossierUtilisateur et le partage en lecture. Avec un modèle param() + Import-Csv. Option graphique : faire à la main.',
      intentions: ['script powershell créer un utilisateur et son dossier', 'read-host nom prénom ou groupe', 'new-aduser add-adgroupmember new-smbshare', 'partage en lecture pour un utilisateur', 'script examen powershell', 'import-csv foreach new-aduser', 'param mandatory powershell', 'nom.prenom ad script'],
      motsCles: [...EXAMEN, 'script', 'powershell', 'read-host', 'new-aduser', 'new-smbshare', 'icacls', 'import-csv', 'param', 'foreach', 'test-path'],
      params: [
        { id: 'script', label: 'fichier du script à créer', type: 'cheminWin', exemple: 'C:\\Scripts\\CreerUtilisateur.ps1', aide: 'Un chemin sans espace.' },
        { id: 'login', label: 'login créé par le test (nom.prenom)', type: 'identifiant', exemple: 'tremblay.anne', aide: 'Pour vérifier et défaire : le nom de connexion que le script construit.' },
        { id: 'scriptCsv', label: 'fichier du modèle CSV à créer', type: 'cheminWin', exemple: 'C:\\Scripts\\ImporterUtilisateurs.ps1', aide: 'Un chemin sans espace.' },
        { id: 'csv', label: 'fichier CSV des utilisateurs', type: 'cheminWin', exemple: 'C:\\Scripts\\Donnees.csv', aide: 'Colonnes « Nom complet », nom, « Unité organisationnelle », séparées par des « ; ».' },
      ],
      etapes: [
        mod('Créer le dossier des scripts et le dossier racine des utilisateurs', 'Le script range les dossiers dans C:\\DossierUtilisateur (consigne de l’examen) : on le crée d’avance.', [ps('New-Item -Path C:\\Scripts -ItemType Directory -Force'), ps('New-Item -Path C:\\DossierUtilisateur -ItemType Directory -Force')], 'Deux lignes avec les dossiers créés (ou déjà présents).'),
        lec('Lire l’énoncé : le script en 6 blocs', 'Transforme l’énoncé en pseudo-code avant de taper : 1) quatre Read-Host (nom, prénom, OU, groupe) ; 2) login nom.prenom ; 3) New-ADUser dans l’OU reçue ; 4) Add-ADGroupMember ; 5) New-Item pour le dossier ; 6) New-SmbShare en lecture pour l’utilisateur. Trouve ton domaine et ton OU avant de lancer.', [ps('Get-ADDomain | Select-Object Name, DNSRoot, NetBIOSName, DistinguishedName'), ps('Get-ADOrganizationalUnit -Filter * | Select-Object Name, DistinguishedName'), ps('Get-ADGroup -Filter * | Select-Object Name')], 'Le nom du domaine (pour l’OU : DC=…,DC=…), les OU existantes avec leur chemin complet, et les groupes de sécurité.'),
        mod('Écrire le script dans un fichier', 'Un texte entre @\' et \'@ est écrit tel quel, sans que PowerShell n’interprète les $ : il est collé dans la console puis sauvegardé. Le script n’écrit JAMAIS le mot de passe : il le demande avec Read-Host -AsSecureString.', [ps('@\''), ...SCRIPT_UTILISATEUR.map((l) => ps(l)), ps('\'@ | Set-Content -Path {{script}} -Encoding UTF8')], 'Aucun message : le fichier est créé.', { important: 'Copie ce bloc en entier, d’un seul coup, dans la console. Le chemin de l’OU se saisit en entier au Read-Host (DN complet). Le nom de connexion (nom.prenom) ne doit pas dépasser 20 caractères.' }),
        itr('Lancer le script avec des valeurs de test', 'Le script pose ses questions l’une après l’autre. Garde la capture d’écran de l’exécution pour l’examen.', [ps('& {{script}}')], 'Quatre questions, puis le message « Utilisateur … cree, dossier et partage en lecture prets. ». Une erreur « le mot de passe ne respecte pas la stratégie » : complexité du domaine.', { interactions: [{ attend: 'Nom de famille', reponds: 'Tape le nom (par exemple Tremblay).' }, { attend: 'Prenom', reponds: 'Tape le prénom (par exemple Anne).' }, { attend: 'Unite organisationnelle', reponds: 'Le chemin COMPLET de l’OU : OU=…,DC=…,DC=…' }, { attend: 'Groupe de securite', reponds: 'Le nom du groupe existant (par exemple Etudiant).' }, { attend: 'Mot de passe', reponds: 'Tape le mot de passe (rien ne s’affiche), Entrée.' }] }),
        lec('Vérifier utilisateur, groupe, dossier et partage', 'Les preuves demandées à l’examen : le compte existe, il est dans le bon groupe, le dossier est créé et le partage donne la lecture à l’utilisateur.', [ps('Get-ADUser -Identity {{login}} -Properties MemberOf | Select-Object Name, SamAccountName, Enabled, MemberOf'), ps('Get-ChildItem C:\\DossierUtilisateur'), ps('Get-SmbShare -Name {{login}}'), ps('Get-SmbShareAccess -Name {{login}}')], 'Le compte activé et son groupe ; le dossier au nom de l’utilisateur ; le partage avec le droit Read pour lui.', { verification: true }),
        mod('Variante : modèle avec param() et Import-Csv (facultatif)', 'Pour une consigne « fichier CSV, nombre de lignes variable » : le chemin du CSV est reçu en paramètre, chaque ligne est traitée par foreach, l’OU et l’utilisateur sont créés seulement s’ils n’existent pas (Get-… puis New-…), et le dossier est créé s’il manque. Modèle de l’aide-mémoire, adapté : le domaine est lu avec Get-ADDomain.', [ps('@\''), ...SCRIPT_CSV.map((l) => ps(l)), ps('\'@ | Set-Content -Path {{scriptCsv}} -Encoding UTF8')], 'Aucun message : le modèle est créé.', { facultatif: true, important: 'Colonnes à adapter à ton CSV. Les noms avec espace ou accent s’écrivent entre guillemets : $U."Nom complet". Le CSV fourni utilise « ; » comme séparateur : -Delimiter ";".' }),
        itr('Lancer le modèle sur le CSV (facultatif)', 'Le chemin du CSV est passé en paramètre ; le mot de passe initial des comptes est demandé une fois.', [ps('& {{scriptCsv}} -Fichier {{csv}}')], 'Les comptes du CSV sont créés ; relance : aucun doublon (les comptes existants sont ignorés).', { facultatif: true, interactions: [{ attend: 'Mot de passe initial', reponds: 'Tape le mot de passe (rien ne s’affiche), Entrée.' }] }),
        des('Annuler — supprimer le partage, le dossier et le compte de test', 'Défait ce que le script a créé pour le login de test. Le compte est supprimé de l’annuaire : irréversible.', [ps('Remove-SmbShare -Name {{login}} -Force'), ps('Remove-Item C:\\DossierUtilisateur\\{{login}} -Recurse'), ps('Remove-ADUser -Identity {{login}} -Confirm:$false')], 'Aucun message ; Get-ADUser ne retrouve plus le compte.', annul),
      ],
      verification: ['Le compte existe dans la bonne OU et le bon groupe, son dossier est créé et le partage lui donne la lecture.'],
      retour: 'Les commandes de nettoyage sont dans l’étape « Annuler » ci-dessous.',
      sources: [src('Read-Host', '/powershell/module/microsoft.powershell.utility/read-host'), src('New-ADUser', '/powershell/module/activedirectory/new-aduser'), src('Add-ADGroupMember', '/powershell/module/activedirectory/add-adgroupmember'), src('New-SmbShare', '/powershell/module/smbshare/new-smbshare'), src('Import-Csv', '/powershell/module/microsoft.powershell.utility/import-csv'), src('about_Functions_Advanced_Parameters', '/powershell/module/microsoft.powershell.core/about/about_functions_advanced_parameters')],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du contrôleur de domaine.',
      etapes: [
        gui('Créer l’utilisateur', 'modification', 'Même résultat que New-ADUser, à la main (si le script ne marche pas le jour de l’examen).', ['**Windows + R**, tape **dsa.msc**, **Entrée**.', 'Clic droit sur l’**OU** › **Nouveau › Utilisateur** › **Prénom**, **Nom**, **Nom d’ouverture de session** (nom.prenom) › **Suivant**, mot de passe deux fois › **Terminer**.'], 'Le compte apparaît dans l’OU.'),
        gui('Le mettre dans le groupe', 'modification', 'Même résultat qu’Add-ADGroupMember.', ['Double-clic sur le compte › onglet **Membre de** › **Ajouter…** › saisis le groupe › **Vérifier les noms › OK**.'], 'Le groupe figure dans la liste « Membre de ».'),
        gui('Créer le dossier et le partager en lecture', 'modification', 'Même résultat que New-Item et New-SmbShare.', ['Dans l’**Explorateur**, crée **C:\\DossierUtilisateur** puis, dedans, un dossier au nom de l’utilisateur.', 'Clic droit sur ce dossier › **Propriétés › Partage › Partage avancé…** › coche **Partager ce dossier** › **Autorisations** › supprime **Tout le monde**, **Ajouter** l’utilisateur et coche **Lecture** seulement › **OK**.'], 'Le partage existe, avec la lecture pour l’utilisateur.'),
        gui('Vérifier', 'lecture', 'Les preuves de l’examen.', ['Dans **dsa.msc**, ouvre le compte (onglet **Membre de**) ; dans l’**Explorateur**, ouvre l’onglet **Partage** des propriétés du dossier.'], 'Compte, groupe, dossier et partage sont conformes.', { verification: true }),
        gui('Annuler — supprimer le compte, le partage et le dossier', 'destructif', 'Défait les trois créations.', ['Propriétés du dossier › **Partage avancé** › décoche **Partager ce dossier**.', 'Supprime le dossier dans l’Explorateur.', 'Dans **dsa.msc**, clic droit sur le compte › **Supprimer** › confirme.'], 'Le compte, le dossier et le partage ont disparu.', annul),
      ],
      verification: ['Le compte, le groupe, le dossier et le partage en lecture sont tous présents.'],
      retour: 'Supprimer le compte (dsa.msc), le partage et le dossier.',
    });
    return f;
  })(),

  // ------------------------------------------------------------------ Parcours : l'examen en six questions
  (() => {
    const q = (phase, titre, explication, lignes, attendu, extra = {}) => lec(titre, explication, lignes, attendu, { phase, ...extra });
    const f = ficheWin({
      id: 'win-examen-parcours', titre: 'Examen Windows Server 2022 : les 6 questions et leurs fiches', categorie: 'Windows Server', effet: 'lecture', privileges: ADMIN,
      resume: 'Le plan de l’examen pratique Serveur I (60 points, 6 questions) : pour chaque question, la fiche à ouvrir, l’option graphique et la commande qui montre le résultat à capturer. Les fiches se suivent en cliquant les liens « Prérequis » ci-dessus.',
      intentions: ['examen windows server 2022', 'examen pratique serveur i', 'plan de l’examen windows server', 'aide-mémoire examen serveur', 'quoi faire à l’examen pratique', 'examen cégep limoilou windows server', 'questions 1 à 6 examen'],
      motsCles: [...EXAMEN, 'parcours', 'quota', 'sauvegarde', 'raid 1', 'dhcp', 'script powershell', 'utilisateurs'],
      etapes: [
        q('Avant de commencer', 'Lire les verbes de la consigne', 'Les verbes disent l’outil : « créer un utilisateur avec PowerShell » → New-ADUser ; « quota sur le dossier, pas sur le disque » → FSRM sur le dossier ; « planifier » → Sauvegarde Windows Server ; « RAID 1 » → miroir ; « serveur DHCP » → rôle DHCP + étendue + exclusion ; « reçu en paramètre » → param(). Utilise la VM de l’examen, pas celle des formatifs (note de 0 sinon). Identifie le disque système avant tout formatage.', [ps('Get-Disk | Select-Object Number, FriendlyName, Size, PartitionStyle'), ps('Get-NetIPAddress -AddressFamily IPv4 | Select-Object InterfaceAlias, IPAddress')], 'Les disques (le système est le numéro 0) et l’adresse IP de chaque carte : à la question 5, utilise la carte NON Internet.'),
        q('Q1 — Utilisateurs (10 pts)', 'Créer les deux utilisateurs et leurs groupes', 'Fiches : « Créer un groupe », « Créer un utilisateur Active Directory », « Ajouter un membre ». VotreNom va dans les groupes enseignant et administrateurs, Anne Tremblay dans étudiant. Le mot de passe est demandé par PowerShell, jamais écrit.', [ps('Get-ADUser -Filter * -Properties MemberOf | Select-Object Name, SamAccountName, MemberOf')], 'Les deux comptes avec leurs groupes : c’est la capture à montrer.', { verification: true }),
        q('Q2 — Disque et quota (10 pts)', 'Créer le disque de 2 Go, le dossier ExamenGR1 et le quota de 200 Mo', 'Fiches : « Ajouter un disque à un serveur Windows » puis « Mettre un quota sur un dossier (FSRM) ». Le quota est sur le DOSSIER, pas sur le disque. Clic droit sur le menu Démarrer › Gestion des disques si le menu est difficile à atteindre.', [ps('Get-Volume'), ps('Get-FsrmQuota | Format-List Path, Size, SoftLimit, Usage')], 'Le nouveau disque en NTFS et un quota de 209715200 octets (200 Mo) sur le dossier ExamenGR1.', { verification: true }),
        q('Q3 — Sauvegarde planifiée (10 pts)', 'Planifier le backup du disque à 13 h et 16 h', 'Fiche : « Planifier une sauvegarde incrémentale ». Disque de destination DÉDIÉ et différent de la source ; deux heures ; incrémentiel. Lance une première sauvegarde pour vérifier.', [ps('Get-WBPolicy'), ps('wbadmin get versions')], 'La politique avec le lecteur source, le disque dédié et les heures 13:00 et 16:00.', { verification: true }),
        q('Q4 — RAID 1 (10 pts)', 'Créer le miroir, ajouter un fichier, retirer un disque, restaurer', 'Fiche : « Créer un miroir RAID 1 sous Windows et le restaurer ». Dans l’Explorateur, le miroir apparaît comme un seul lecteur : la preuve se fait dans Gestion des disques (état « Sain »).', [ps('"list volume" | diskpart')], 'Le volume de type Mirror avant la panne, « Redondance en échec » pendant, « Sain » après la restauration.', { verification: true }),
        q('Q5 — DHCP (10 pts)', 'Serveur DHCP en 192.168.50.1, 50 adresses exclues', 'Fiches : « Régler l’adresse IP fixe », « Installer et autoriser un serveur DHCP », « Créer une étendue DHCP et ses options », « Exclure une plage d’adresses d’une étendue DHCP ». Réseau 192.168.50.0/24, .1 à .50 exclues, le reste dans le pool, DNS = le serveur. Carte NON Internet (note de 0 sinon).', [ps('Get-DhcpServerv4Scope'), ps('Get-DhcpServerv4ExclusionRange -ScopeId 192.168.50.0'), ps('Get-DhcpServerv4OptionValue -ScopeId 192.168.50.0')], 'L’étendue active, l’exclusion .1 à .50 et les options (passerelle, DNS 192.168.50.1).', { verification: true }),
        q('Q6 — Script PowerShell (10 pts)', 'Script : utilisateur, dossier, partage en lecture', 'Fiche : « Script PowerShell : créer un utilisateur, son dossier et son partage ». Quatre Read-Host, nom.prenom, groupe, dossier dans C:\\DossierUtilisateur, partage en lecture. Colle le SCRIPT et les captures de preuve dans le document.', [ps('Get-SmbShare | Select-Object Name, Path')], 'Le partage de l’utilisateur de test et son dossier.', { verification: true }),
      ],
      verification: ['Chaque question a sa preuve : utilisateurs, quota, politique de sauvegarde, miroir sain, étendue DHCP avec exclusion, script et partage.'],
      sources: [src('Windows Server — documentation', '/windows-server/'), src('Get-WBPolicy', '/powershell/module/windowsserverbackup/get-wbpolicy'), src('Get-FsrmQuota', '/powershell/module/fileserverresourcemanager/get-fsrmquota')],
    });
    f.prerequis = [
      { texte: 'Q1 — créer le groupe de sécurité.', fiche: 'win-ad-creer-groupe' },
      { texte: 'Q1 — créer l’utilisateur.', fiche: 'win-ad-creer-utilisateur' },
      { texte: 'Q1 — l’ajouter à son groupe.', fiche: 'win-ad-ajouter-membre' },
      { texte: 'Q2 — ajouter et formater le disque de 2 Go.', fiche: 'win-disque-ajouter' },
      { texte: 'Q2 — quota de 200 Mo sur le dossier.', fiche: 'win-quota-fsrm' },
      { texte: 'Q3 — sauvegarde planifiée à 13 h et 16 h.', fiche: 'win-sauvegarde-planifier' },
      { texte: 'Q4 — miroir RAID 1 et restauration.', fiche: 'win-miroir-raid1' },
      { texte: 'Q5 — adresse IP fixe du serveur.', fiche: 'windows-ip-fixe' },
      { texte: 'Q5 — installer et autoriser le serveur DHCP.', fiche: 'win-dhcp-installer' },
      { texte: 'Q5 — créer l’étendue et ses options.', fiche: 'win-dhcp-etendue' },
      { texte: 'Q5 — exclure les 50 premières adresses.', fiche: 'win-dhcp-exclusion' },
      { texte: 'Q6 — script utilisateur, dossier et partage.', fiche: 'win-script-utilisateur-partage' },
    ];
    return f;
  })(),
];
