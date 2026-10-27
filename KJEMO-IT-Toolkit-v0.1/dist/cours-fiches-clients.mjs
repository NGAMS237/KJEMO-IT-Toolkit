/**
 * cours-fiches-clients.mjs — KJEMO-COURS-TP2-01-R1 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les postes CLIENTS du TP2 : hyperviseur (ajout d'un disque), client Ubuntu
 * Desktop (carte réseau, accès au partage), client Windows 11 (session avec un
 * compte du domaine, accès au partage). Chaque étape dit sur QUELLE machine
 * elle se fait (champ « machine ») ; la copie est séparée par poste.
 *
 * RÈGLES PROPRES À CE FICHIER
 *  - Aucun mot de passe dans une commande : « net use … * » et smbclient -U
 *    le demandent à l'invite, sur la machine.
 *  - Jamais « net use * /delete » : on retire UNE connexion, ciblée. Un autre
 *    partage du même serveur, ou une session déjà ouverte, n'est pas touché.
 *  - Aucun nom de disque présumé : le nouveau disque se lit avec lsblk.
 *  - Les chemins de menus des hyperviseurs et des interfaces graphiques sont
 *    relus contre la documentation mais NON exécutés ; ils varient selon la
 *    version (la fiche le dit).
 */
import { MAN, lec, mod, des, itr, sh, ps, cm, gui, ficheLinux, V_COURS, CATEGORIE_LINUX } from './cours-outils.mjs';

const SAMBA_DOC = 'https://www.samba.org/samba/docs/current/man-html';
const MS_NETUSE = 'https://learn.microsoft.com/en-us/previous-versions/orphan-topics/ws.10/cc756153(v=ws.10)';
const MS_ERREURS = 'https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--1000-1299-';
const MS = 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands';

const S = 'serveur'; const U = 'client-ubuntu'; const W = 'client-windows'; const H = 'hyperviseur';
const sur = (machine, etape) => ({ ...etape, machine });

/** Fiche multi-méthodes (même modèle que ficheLinux, mais plusieurs méthodes). */
function fiche({ id, titre, resume, effet, intentions, motsCles, params = [], methodes, sources, prerequis = [], categorie = CATEGORIE_LINUX }) {
  return { id, titre, categorie, resume, effet, intentions, motsCles, params, methodes, assistant: null, sources, validation: V_COURS, origine: 'cours', ...(prerequis.length ? { prerequis } : {}) };
}

export const COURS_CLIENTS = [
  // ------------------------------------------------------------------ B1
  fiche({
    id: 'cours-hyperviseur-ajouter-disque',
    titre: 'Ajouter un disque virtuel de 1 Go à une VM et le repérer',
    resume: 'Retire les disques de l’ancien formatif, ajoute un disque virtuel de 1 Go dans TON hyperviseur (VMware, VirtualBox, Proxmox VE ou Hyper-V : à choisir), puis le repère dans Ubuntu avec lsblk. Le nom du disque se lit, il ne se devine pas.',
    effet: 'destructif',
    intentions: ['ajouter un disque à une vm', 'nouveau disque 1 go vmware', 'virtualbox ajouter disque', 'proxmox ajouter disque', 'hyper-v ajouter disque', 'tp2 b1 ajouter un disque', 'repérer le nouveau disque lsblk'],
    motsCles: ['hyperviseur', 'vmware', 'virtualbox', 'proxmox', 'hyper-v', 'disque virtuel', 'lsblk', 'fdisk -l', 'vm', 'ajouter un disque'],
    prerequis: [{ texte: 'La VM du serveur existe ; pour la plupart des hyperviseurs, éteins-la proprement avant de modifier son matériel.' }],
    params: [],
    methodes: [
      {
        id: 'gui', privileges: 'Administrateur de l’hyperviseur (ton poste hôte ou ton serveur de virtualisation).',
        etapes: [
          sur(H, gui('Choisir ton hyperviseur', 'lecture', 'Le sujet ne dit pas quel hyperviseur utiliser : suis UNE seule des quatre séries d’étapes ci-dessous, celle de ton hyperviseur (VMware, VirtualBox, Proxmox VE ou Hyper-V). Les noms de menus varient un peu selon les versions.', ['Repère l’application qui héberge ta VM de serveur.', 'Va directement à la série d’étapes qui porte son nom.'], 'Tu sais quelle série suivre.', { phase: 'Choisir' })),
          sur(H, gui('VMware — retirer les disques de l’ancien formatif', 'destructif', 'Le sujet demande de supprimer les disques ajoutés au dernier formatif. Retirer un disque de la VM le détache ; la case « supprimer les fichiers » l’efface pour de bon.', ['Éteins la VM (arrêt propre depuis Ubuntu : `sudo poweroff`).', 'Clique-droit sur la VM, **Settings** (Paramètres).', 'Onglet **Hardware** : sélectionne chaque disque ajouté au formatif précédent (jamais le disque système), puis **Remove**.', 'Valide avec **OK**.'], 'La liste du matériel ne montre plus que le disque système.', { phase: 'VMware' })),
          sur(H, gui('VMware — ajouter un disque de 1 Go', 'modification', 'L’assistant crée un fichier de disque virtuel de 1 Go.', ['Clique-droit sur la VM, **Settings**, onglet **Hardware**, bouton **Add…**.', 'Choisis **Hard Disk**, **Next**.', 'Type de disque recommandé (SCSI ou NVMe selon la version), **Next**.', 'Choisis **Create a new virtual disk**, **Next**.', 'Taille maximale : **1 GB**. Garde un seul fichier si tu veux simple. **Next**.', 'Accepte le nom proposé, **Finish**, puis **OK**.', 'Démarre la VM.'], 'Le matériel de la VM contient un disque de 1 GB de plus.', { phase: 'VMware' })),
          sur(H, gui('VirtualBox — retirer les disques de l’ancien formatif', 'destructif', 'Retirer le disque du contrôleur le détache de la VM ; son fichier reste dans le gestionnaire de médias tant que tu ne le supprimes pas.', ['Éteins la VM.', 'Sélectionne la VM, **Configuration** (Settings), **Stockage** (Storage).', 'Sous le contrôleur (SATA par exemple), sélectionne chaque disque ajouté au formatif précédent (jamais le disque système), puis l’icône **Supprimer le disque**.', 'Valide avec **OK**.'], 'Seul le disque système reste sous le contrôleur.', { phase: 'VirtualBox' })),
          sur(H, gui('VirtualBox — ajouter un disque de 1 Go', 'modification', 'On crée un nouveau disque virtuel dynamique de 1 Go sur le contrôleur existant.', ['**Configuration**, **Stockage**.', 'Sélectionne le contrôleur, clique l’icône **Ajoute un disque dur**.', '**Créer**, type **VDI**, **Suivant**, **Dynamiquement alloué**, **Suivant**.', 'Taille : **1 Go**, **Créer**.', 'Sélectionne le disque créé, **Choisir**, puis **OK**.', 'Démarre la VM.'], 'Un second disque dur apparaît sous le contrôleur de stockage.', { phase: 'VirtualBox' })),
          sur(H, gui('Proxmox VE — retirer les disques de l’ancien formatif', 'destructif', 'Dans Proxmox, **Detach** détache le disque (il devient « Unused ») ; **Remove** sur un disque non utilisé le supprime pour de bon.', ['Sélectionne la VM, **Hardware**.', 'Sélectionne chaque disque ajouté au formatif précédent (jamais le disque système), **Disk Action**, **Detach**.', 'Pour l’effacer pour de bon : sélectionne le disque « Unused Disk », **Remove**.'], 'Le matériel ne montre plus que le disque système.', { phase: 'Proxmox VE' })),
          sur(H, gui('Proxmox VE — ajouter un disque de 1 Go', 'modification', 'Proxmox demande le stockage cible et la taille en GiB.', ['Sélectionne la VM, **Hardware**, **Add**, **Hard Disk**.', 'Choisis le **Storage** cible, **Disk size (GiB)** : `1`.', 'Clique **Add**.'], 'Un disque de 1 GiB apparaît dans la liste du matériel.', { phase: 'Proxmox VE' })),
          sur(H, gui('Hyper-V — retirer les disques de l’ancien formatif', 'destructif', 'Retirer un disque de la configuration de la VM ne supprime pas le fichier .vhdx.', ['Éteins la VM.', 'Dans le **Gestionnaire Hyper-V**, clique-droit sur la VM, **Paramètres**.', 'Sous **Contrôleur SCSI**, sélectionne chaque disque ajouté au formatif précédent (jamais le disque système), **Supprimer**.', '**Appliquer**.'], 'Seul le disque système reste attaché.', { phase: 'Hyper-V' })),
          sur(H, gui('Hyper-V — ajouter un disque de 1 Go', 'modification', 'L’assistant de nouveau disque dur virtuel crée un fichier .vhdx.', ['Clique-droit sur la VM, **Paramètres**, **Contrôleur SCSI**.', 'Sélectionne **Disque dur**, **Ajouter**.', 'Clique **Nouveau** : format **VHDX**, type **Taille dynamique**, nom et emplacement au choix.', 'Taille : **1 Go**, **Terminer**.', '**Appliquer**, puis **OK**. Démarre la VM.'], 'Un nouveau disque dur virtuel apparaît sous le contrôleur SCSI.', { phase: 'Hyper-V' })),
        ],
        verification: ['Le matériel de la VM contient le nouveau disque de 1 Go (dans l’interface de l’hyperviseur).', 'Ubuntu le voit ensuite avec lsblk (méthode Linux de cette fiche).'], retour: 'Éteins la VM puis retire le nouveau disque du matériel de la VM (comme à l’étape de retrait de ton hyperviseur).',
      },
      {
        id: 'linux', privileges: 'Administrateur du serveur : sudo.',
        etapes: [
          sur(S, lec('Lister les disques AVANT l’ajout', 'Note ce que tu vois : c’est la référence qui te permettra de reconnaître le disque neuf. Si un ancien disque du formatif apparaît encore, retire-le d’abord dans l’hyperviseur.', [sh('lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS')], 'Le disque système (par exemple sda) et ses partitions.', { phase: 'Repérer' })),
          sur(S, lec('Lister les disques APRÈS l’ajout', 'Le disque neuf est celui de 1G, de type disk, sans partition ni point de montage. Son nom (sdb, sdc, vdb, nvme0n2…) dépend de ta machine : lis-le, ne le suppose pas.', [sh('lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS')], 'Une ligne de plus : un disque de 1G, TYPE disk, sans FSTYPE.', { phase: 'Repérer', verification: true })),
          sur(S, lec('Confirmer par la taille exacte (question B2)', 'fdisk -l liste les disques avec leur taille en octets ; le disque neuf mesure environ 1 GiB (1073741824 octets).', [sh('sudo fdisk -l')], 'Une section « Disk /dev/… : 1 GiB » sans table de partitions.', { phase: 'Repérer', verification: true })),
          sur(S, mod('Si le disque ajouté à chaud n’apparaît pas (facultatif)', 'Quand le disque est ajouté VM allumée, le noyau doit parfois rebalayer les adaptateurs SCSI. Cette boucle écrit « - - - » dans le fichier scan de chaque adaptateur : elle ne modifie aucun disque.', [sh('for h in /sys/class/scsi_host/host*/scan; do echo "- - -" | sudo tee "$h" > /dev/null; done'), sh('lsblk -o NAME,SIZE,TYPE')], 'Le disque de 1G apparaît dans lsblk.', { facultatif: true, phase: 'Repérer', important: 'Éteindre puis rallumer la VM fait la même chose, sans rien de particulier à taper.' })),
          sur(S, lec('S’assurer qu’aucun montage de l’ancien formatif ne manque', 'Une ligne d’/etc/fstab qui vise un disque retiré peut ralentir ou bloquer le démarrage. findmnt --verify relit fstab sans rien monter.', [sh('findmnt --verify'), sh('cat /proc/mdstat')], 'Aucune erreur sur un montage disparu ; aucune matrice RAID oubliée (/proc/mdstat vide de matrices).', { phase: 'Vérifier', verification: true })),
        ],
        verification: ['lsblk montre un disque de 1G de plus, sans partition.', 'fdisk -l confirme sa taille.'], retour: 'Éteins la VM et retire le disque dans l’hyperviseur.',
      },
    ],
    sources: [
      { label: 'VMware Workstation — documentation', url: 'https://docs.vmware.com/en/VMware-Workstation-Pro/index.html' },
      { label: 'VirtualBox — stockage virtuel', url: 'https://www.virtualbox.org/manual/ch05.html' },
      { label: 'Proxmox VE — machines virtuelles QEMU/KVM', url: 'https://pve.proxmox.com/wiki/Qemu/KVM_Virtual_Machines' },
      { label: 'Hyper-V — créer une machine virtuelle', url: 'https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/get-started/create-a-virtual-machine-in-hyper-v' },
      { label: 'lsblk(8)', url: `${MAN}/man8/lsblk.8.html` },
    ],
  }),

  // ------------------------------------------------------------------ D4
  fiche({
    id: 'cours-ubuntu-reseau-client',
    titre: 'Configurer la carte réseau d’un client Ubuntu Desktop',
    resume: 'Donne une adresse IPv4 fixe au client Ubuntu Desktop (interface graphique ou nmcli), vérifie l’adresse, puis teste la communication dans les deux sens avec le serveur par ping. Préalable à l’accès au partage.',
    effet: 'interruption',
    intentions: ['configurer la carte réseau ubuntu desktop', 'ip fixe ubuntu desktop', 'nmcli connection modify ipv4', 'ping le serveur samba', 'tp2 d4 carte réseau client ubuntu', 'networkmanager ipv4 manual'],
    motsCles: ['nmcli', 'networkmanager', 'ip fixe', 'ipv4', 'ping', 'ubuntu desktop', 'carte réseau', 'interface'],
    params: [
      { id: 'connexion', label: 'nom de la connexion réseau', type: 'nom', exemple: 'Wired connection 1', aide: 'Lu à l’étape 1 (colonne NAME de nmcli). Exemple seulement.' },
      { id: 'adresseClient', label: 'adresse IPv4 du client', type: 'ipv4', exemple: '172.27.1.211', aide: 'Une adresse libre du même réseau que le serveur.' },
      { id: 'prefixe', label: 'longueur du préfixe', type: 'prefixe', exemple: '24', aide: 'Ex. 24 pour 255.255.255.0 ; le même que celui du serveur.' },
      { id: 'serveurIp', label: 'adresse IPv4 du serveur', type: 'ipv4', exemple: '172.27.1.210', aide: 'Le serveur Samba ; il sert aussi de serveur DNS du domaine.' },
    ],
    methodes: [
      {
        id: 'gui', privileges: 'Administrateur du poste (mot de passe demandé pour modifier la configuration).',
        etapes: [
          sur(U, gui('Ouvrir les paramètres de la carte réseau', 'lecture', 'La carte du réseau local est celle qui est reliée au même réseau que le serveur ; sur une VM à deux cartes, l’autre sert à Internet.', ['Ouvre **Paramètres** (Settings), puis **Réseau** (Network).', 'Dans **Câblé** (Wired), clique l’icône d’engrenage de la connexion.'], 'La fenêtre de la connexion s’ouvre.')),
          sur(U, gui('Saisir l’adresse en mode manuel', 'interruption', 'Le mode manuel remplace l’adresse reçue du DHCP. La connexion est coupée et rétablie quand tu appliques.', ['Onglet **IPv4**, **Méthode** : **Manuel**.', 'Adresse : l’adresse IPv4 du client ; **Masque** : par exemple 255.255.255.0 ; **Passerelle** : seulement si ton réseau en a une.', '**DNS** : l’adresse du serveur (contrôleur de domaine).', 'Clique **Appliquer**, puis coupe et rétablis la connexion avec le bouton de la carte.'], 'La connexion revient avec la nouvelle adresse.')),
          sur(U, gui('Vérifier l’adresse affichée', 'lecture', 'La même fenêtre affiche l’adresse active.', ['Rouvre l’engrenage de la connexion, onglet **Détails**.'], 'L’adresse IPv4 affichée est celle que tu as saisie.', { verification: true })),
        ],
        verification: ['L’adresse IPv4 affichée est celle choisie.', 'Le ping vers le serveur répond (méthode Linux).'], retour: 'Remets la méthode IPv4 sur **Automatique (DHCP)**.',
      },
      {
        id: 'linux', privileges: 'Administrateur du poste client : sudo.',
        etapes: [
          sur(U, lec('Lire la connexion et l’interface', 'nmcli liste les connexions gérées par NetworkManager (la version Desktop). La colonne NAME donne le nom à saisir ; DEVICE, l’interface.', [sh('nmcli -f NAME,DEVICE,TYPE connection show --active'), sh('ip -br address')], 'Une connexion Ethernet active et son interface avec l’adresse actuelle.')),
          sur(U, itr('Fixer l’adresse IPv4', 'nmcli connection modify change la configuration enregistrée ; connection up la réapplique (la connexion se coupe une seconde). Sans passerelle : réseau strictement local.', [
            sh('sudo nmcli connection modify \'{{connexion}}\' ipv4.method manual ipv4.addresses {{adresseClient}}/{{prefixe}} ipv4.dns {{serveurIp}}'),
            sh('sudo nmcli connection up \'{{connexion}}\''),
          ], 'Connection successfully activated.', { important: 'Si le poste est administré à distance par SSH, tu perds la session le temps de la réactivation : fais-le depuis la console de la VM.' })),
          sur(U, lec('Vérifier l’adresse', 'L’adresse et le préfixe doivent être ceux saisis.', [sh('ip -br address')], 'L’interface porte l’adresse choisie suivie de /préfixe.', { verification: true })),
          sur(U, lec('Pinguer le serveur', 'Quatre paquets suffisent. Une réponse prouve que la couche IP fonctionne entre les deux machines.', [sh('ping -c 4 {{serveurIp}}')], '0% packet loss.', { verification: true })),
          sur(S, lec('Pinguer le client depuis le serveur', 'Le formatif demande le test dans les deux sens. À lancer dans un terminal du SERVEUR.', [sh('ping -c 4 {{adresseClient}}')], '0% packet loss.', { verification: true, important: 'Si le pare-feu du client bloque l’ICMP, le ping peut échouer alors que le réseau fonctionne : lis l’erreur avant de conclure.' })),
        ],
        verification: ['ip -br address montre l’adresse choisie.', 'Le ping répond dans les deux sens.'],
        retour: 'sudo nmcli connection modify (nom de la connexion) ipv4.method auto ipv4.addresses "" ipv4.dns "", puis connection up.',
      },
    ],
    sources: [{ label: 'nmcli — référence', url: 'https://networkmanager.dev/docs/api/latest/nmcli.html' }, { label: 'ip(8)', url: `${MAN}/man8/ip.8.html` }, { label: 'ping(8)', url: `${MAN}/man8/ping.8.html` }],
  }),

  // ------------------------------------------------------------------ D5 / D6
  fiche({
    id: 'cours-ubuntu-acces-partage',
    titre: 'Accéder au partage Samba depuis Ubuntu : écriture et lecture seule',
    resume: 'Depuis le client Ubuntu Desktop, ouvre le partage avec un compte autorisé en écriture, y crée un dossier, puis avec un compte en lecture seule : lecture réussie, écriture refusée. Interface graphique ou smbclient ; contrôle final sur le serveur.',
    effet: 'modification',
    intentions: ['accéder partage samba depuis ubuntu', 'smb:// nautilus fichiers', 'smbclient mkdir refusé', 'user1tp2 écrire partage', 'user2tp2 lecture seule', 'tp2 d5 d6 client ubuntu partage', 'NT_STATUS_ACCESS_DENIED'],
    motsCles: ['smbclient', 'smb://', 'nautilus', 'fichiers', 'lecture seule', 'écriture', 'NT_STATUS_ACCESS_DENIED', 'partage', 'ubuntu desktop'],
    prerequis: [
      { texte: 'Le partage et ses deux comptes existent côté serveur (un compte en écriture, un en lecture seule).', fiche: 'cours-samba-partage-utilisateurs' },
      { texte: 'Le client Ubuntu joint le serveur par le réseau.', fiche: 'cours-ubuntu-reseau-client' },
    ],
    params: [
      { id: 'serveur', label: 'nom ou adresse IP du serveur', type: 'identifiant', exemple: '172.27.1.210', aide: 'Celle du serveur Samba.' },
      { id: 'partage', label: 'nom du partage', type: 'identifiant', exemple: 'partage_tp2', aide: 'Le nom déclaré entre crochets dans smb.conf.' },
      { id: 'domaine', label: 'nom NetBIOS du domaine', type: 'identifiant', exemple: 'SERVEUR2', aide: 'Le « workgroup » du domaine (testparm l’affiche).' },
      { id: 'compteEcriture', label: 'compte autorisé en écriture', type: 'identifiant', distinctDe: ['compteLecture'], exemple: 'user1tp2', aide: 'Celui de write list.' },
      { id: 'compteLecture', label: 'compte en lecture seule', type: 'identifiant', distinctDe: ['compteEcriture'], exemple: 'user2tp2', aide: 'Celui qui ne doit pas pouvoir écrire.' },
      { id: 'chemin', label: 'dossier partagé sur le serveur', type: 'chemin', exemple: '/DATA_EXT4/partage_tp2', aide: 'Pour le contrôle final, côté serveur.' },
    ],
    methodes: [
      {
        id: 'gui', privileges: 'Utilisateur ordinaire du client Ubuntu Desktop.',
        etapes: [
          sur(U, gui('Ouvrir le partage dans Fichiers', 'lecture', 'Le gestionnaire de fichiers sait ouvrir un partage SMB sans rien installer.', ['Ouvre **Fichiers**, puis **Autres emplacements** (Other Locations).', 'En bas, dans **Se connecter à un serveur**, tape `smb://` suivi de l’adresse ou du nom du serveur, puis `/` et le nom du partage. **Se connecter**.'], 'Une fenêtre demande un nom d’utilisateur.')),
          sur(U, gui('S’authentifier avec le compte en écriture', 'lecture', 'Choisis **Utilisateur enregistré** : l’accès anonyme est refusé par le partage.', ['Nom d’utilisateur : le compte en écriture. **Domaine** : le nom NetBIOS du domaine.', 'Tape le mot de passe ici, dans cette fenêtre, jamais ailleurs.', 'Rappel du mot de passe : choisis **Oublier immédiatement**.', '**Se connecter**.'], 'Le contenu du partage s’affiche.')),
          sur(U, gui('Créer un dossier (écriture)', 'modification', 'Preuve d’écriture : une capture de la fenêtre avec le nouveau dossier.', ['Clique-droit dans le partage, **Nouveau dossier**, nomme-le `dossier_ecriture_ok`, **Entrée**.'], 'Le dossier apparaît dans le partage.', { verification: true })),
          sur(U, gui('Se déconnecter du partage', 'modification', 'Sans cette étape, le client garde la session du premier compte et le second compte n’est pas pris en compte.', ['Dans la barre latérale, clique l’icône **Éjecter** à côté du partage.', 'Ferme les fenêtres du partage.'], 'Le partage disparaît de la barre latérale.')),
          sur(U, gui('Se reconnecter avec le compte en lecture seule', 'lecture', 'Même adresse, autre compte.', ['Refais la connexion `smb://…` de l’étape 1 avec le compte en lecture seule (même domaine, **Oublier immédiatement**).'], 'Le partage s’ouvre ; le dossier créé par l’autre compte est visible (lecture permise).', { verification: true })),
          sur(U, gui('Essayer d’écrire (refus attendu)', 'lecture', 'La tentative d’écriture doit être REFUSÉE : c’est la preuve demandée.', ['Clique-droit dans le partage : **Nouveau dossier** est grisé, ou le dossier est refusé avec un message de permission.'], 'Message « Permission refusée » ou option indisponible : aucun dossier créé.', { verification: true })),
        ],
        verification: ['Le compte en écriture crée un dossier ; le compte en lecture seule lit mais ne peut pas écrire.'], retour: 'Éjecte le partage ; rien d’autre n’a été modifié sur le client.',
      },
      {
        id: 'linux', privileges: 'Utilisateur du client Ubuntu ; sudo seulement pour installer smbclient. Les mots de passe se tapent à l’invite.',
        etapes: [
          sur(U, mod('Installer smbclient', 'Le paquet fournit la commande smbclient.', [sh('sudo apt install smbclient')], 'Le paquet est installé (ou déjà à jour).', { facultatif: true })),
          sur(U, lec('Lister les partages du serveur', 'Le commentaire déclaré dans smb.conf s’affiche à côté du partage : c’est ce qu’on appelle la description visible dans le voisinage réseau.', [sh('smbclient -L //{{serveur}} -W {{domaine}} -U {{compteEcriture}}')], 'Une table de partages dont celui du TP2, avec son commentaire.', { interactions: [{ attend: 'Password for', reponds: 'Tape le mot de passe du compte, puis Entrée. Rien ne s’affiche pendant la frappe.' }], important: 'Si l’authentification échoue alors que le mot de passe est bon, essaie sans l’option -W, ou avec le nom de domaine complet : la forme attendue dépend de la configuration du domaine.' })),
          sur(U, mod('Compte en écriture : créer un dossier', 'smbclient -c exécute les commandes entre apostrophes puis se ferme. mkdir crée un dossier sur le partage, ls le liste.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compteEcriture}} -c \'mkdir dossier_ecriture_ok; ls\'')], 'Le dossier dossier_ecriture_ok figure dans la liste, sans erreur.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du compte en écriture, saisi à l’invite.' }], verification: true })),
          sur(U, lec('Compte en lecture seule : lire', 'La lecture doit réussir et montrer le dossier créé ci-dessus.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compteLecture}} -c \'ls\'')], 'La liste du partage, avec dossier_ecriture_ok.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du compte en lecture seule, saisi à l’invite.' }], verification: true })),
          sur(U, lec('Compte en lecture seule : essayer d’écrire (refus attendu)', 'L’écriture doit être REFUSÉE. C’est la preuve demandée : copie le message dans le rapport.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compteLecture}} -c \'mkdir dossier_ecriture_refuse\'')], 'NT_STATUS_ACCESS_DENIED : aucun dossier créé.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du compte en lecture seule, saisi à l’invite.' }], verification: true, important: 'Un succès ici signifierait que le compte a obtenu l’écriture (par exemple parce qu’il figure aussi dans write list ou que le partage n’est pas en lecture seule) : corrige la configuration du serveur.' })),
          sur(S, lec('Contrôler sur le serveur', 'À lancer dans un terminal du SERVEUR : le dossier du compte en écriture existe, celui du compte en lecture seule n’existe pas.', [sh('ls -l {{chemin}}')], 'dossier_ecriture_ok présent ; dossier_ecriture_refuse absent.', { verification: true })),
        ],
        verification: ['dossier_ecriture_ok existe ; dossier_ecriture_refuse n’existe pas.'], retour: 'Sur le serveur : sudo rmdir suivi du chemin de dossier_ecriture_ok (dossier vide).',
      },
    ],
    sources: [{ label: 'smbclient(1)', url: `${SAMBA_DOC}/smbclient.1.html` }, { label: 'smb.conf — read list, write list', url: `${SAMBA_DOC}/smb.conf.5.html` }],
  }),

  // ------------------------------------------------------------------ D7
  fiche({
    id: 'cours-windows-acces-partage',
    titre: 'Accéder au partage Samba depuis Windows 11 : écriture et lecture seule',
    resume: 'Depuis un poste Windows 11, ouvre le partage avec le compte en écriture (création d’un dossier), retire CETTE connexion seulement, puis ouvre le partage avec le compte en lecture seule : lecture réussie, écriture refusée. Explorateur, CMD ou PowerShell.',
    effet: 'modification',
    intentions: ['accéder partage samba depuis windows 11', 'net use \\\\serveur\\partage /user', 'erreur 1219 plusieurs connexions', 'déconnecter un partage windows sans tout supprimer', 'user1tp2 user2tp2 windows', 'tp2 d7 client windows 11', 'Accès refusé partage windows'],
    motsCles: ['net use', 'windows 11', 'partage smb', '1219', 'cmdkey', 'explorateur', 'lecture seule', 'écriture', 'get-smbconnection'],
    prerequis: [
      { texte: 'Le partage et ses deux comptes existent côté serveur.', fiche: 'cours-samba-partage-utilisateurs' },
      { texte: 'Le poste Windows 11 joint le serveur par le réseau (adresse IP du même réseau, DNS du domaine).' },
    ],
    params: [
      { id: 'serveur', label: 'nom ou adresse IP du serveur', type: 'identifiant', exemple: '172.27.1.210', aide: 'Celle du serveur Samba.' },
      { id: 'partage', label: 'nom du partage', type: 'identifiant', exemple: 'partage_tp2', aide: 'Le nom déclaré entre crochets dans smb.conf.' },
      { id: 'domaine', label: 'nom NetBIOS du domaine', type: 'identifiant', exemple: 'SERVEUR2', aide: 'Ce que Windows affiche avant le « \\ » d’un compte du domaine.' },
      { id: 'compteEcriture', label: 'compte autorisé en écriture', type: 'identifiant', distinctDe: ['compteLecture'], exemple: 'user1tp2', aide: 'Celui de write list.' },
      { id: 'compteLecture', label: 'compte en lecture seule', type: 'identifiant', distinctDe: ['compteEcriture'], exemple: 'user2tp2', aide: 'Celui qui ne doit pas pouvoir écrire.' },
    ],
    methodes: [
      {
        id: 'gui', privileges: 'Utilisateur ordinaire du poste Windows 11.',
        etapes: [
          sur(W, gui('Ouvrir le partage dans l’Explorateur', 'lecture', 'Une session Windows de domaine tente d’abord ses propres identifiants ; si le compte de la session n’est pas autorisé, Windows en demande d’autres.', ['Ouvre l’**Explorateur de fichiers** (Win + E).', 'Clique dans la barre d’adresse, tape `\\\\` suivi de l’adresse ou du nom du serveur, puis `\\` et le nom du partage. **Entrée**.'], 'Le partage s’ouvre, ou une fenêtre « Sécurité Windows » demande des identifiants.')),
          sur(W, gui('S’authentifier avec le compte en écriture', 'lecture', 'Le nom d’utilisateur d’un compte du domaine s’écrit DOMAINE\\compte. Windows ne garde qu’un jeu d’identifiants par serveur à la fois.', ['Dans la fenêtre, clique **Autres choix** puis **Utiliser un autre compte** si nécessaire.', 'Utilisateur : `NOMDOMAINE\\compte` (le nom NetBIOS du domaine, une barre oblique inverse, le compte en écriture).', 'Tape le mot de passe dans la fenêtre. **Décoche « Mémoriser mes informations d’identification ».**', '**OK**.'], 'Le contenu du partage s’affiche.')),
          sur(W, gui('Créer un dossier (écriture)', 'modification', 'Preuve d’écriture : capture de la fenêtre avec le nouveau dossier.', ['Clique-droit dans le partage, **Nouveau**, **Dossier**, nomme-le `dossier_ecriture_win`, **Entrée**.'], 'Le dossier apparaît.', { verification: true })),
          sur(W, gui('Retirer cette connexion avant de changer de compte', 'modification', 'Changer de compte vers le MÊME serveur échoue (erreur système 1219) tant que la première connexion est ouverte. On retire uniquement la connexion à ce partage, pas toutes celles du poste.', ['Ferme toutes les fenêtres de l’Explorateur ouvertes sur ce partage.', 'Ouvre une invite de commandes (Win + R, `cmd`).', 'Suis l’étape « Retirer la connexion à ce partage » de la méthode **CMD** de cette fiche.'], 'Le partage n’est plus connecté : la commande « net use » ne le liste plus.')),
          sur(W, gui('Se reconnecter avec le compte en lecture seule', 'lecture', 'Même adresse, autre compte.', ['Rouvre le partage comme à l’étape 1, avec `NOMDOMAINE\\compte` du compte en lecture seule (**sans** mémoriser).'], 'Le partage s’ouvre ; le dossier créé par l’autre compte est visible.', { verification: true })),
          sur(W, gui('Essayer d’écrire (refus attendu)', 'lecture', 'L’écriture doit être REFUSÉE : c’est la preuve demandée.', ['Clique-droit dans le partage, **Nouveau**, **Dossier** : un message « Vous avez besoin d’une autorisation » ou « Accès refusé » apparaît, ou l’option est absente.'], 'Aucun dossier créé.', { verification: true })),
          sur(W, gui('Nettoyer les identifiants mémorisés (si tu les avais mémorisés)', 'modification', 'Seulement les entrées de CE serveur.', ['Ouvre le **Gestionnaire d’identification** (menu Démarrer), **Informations d’identification Windows**.', 'Supprime l’entrée du serveur du TP2, pas les autres.'], 'Aucune entrée du serveur ne subsiste.', { facultatif: true })),
        ],
        verification: ['Le compte en écriture crée un dossier ; le compte en lecture seule lit mais ne peut pas écrire.'], retour: 'Retire la connexion au partage (méthode CMD, « net use … /delete » ciblé).',
      },
      {
        id: 'cmd', privileges: 'Utilisateur ordinaire, dans une invite de commandes. Les mots de passe se tapent à l’invite (option * de net use).',
        etapes: [
          sur(W, lec('Lister les connexions réseau ouvertes', 'Sans argument, net use liste les connexions de la session. Regarde si le serveur du TP2 y figure déjà (une connexion existante avec un autre compte provoque l’erreur 1219).', [cm('net use')], 'Une table (État, Local, Distant) ou « Il n’y a pas d’entrées dans la liste ».')),
          sur(W, mod('Retirer la connexion à CE partage (si elle existe)', 'La commande retire uniquement la connexion vers ce partage. N’utilise jamais « net use * /delete » : elle coupe aussi les autres connexions de ton poste (dossiers de travail, imprimantes…).', [cm('net use \\\\{{serveur}}\\{{partage}} /delete')], 'Réussite, ou « La connexion réseau est introuvable » si elle n’existait pas.', { facultatif: true })),
          sur(W, mod('Se connecter avec le compte en écriture', 'L’astérisque fait demander le mot de passe à l’invite, sans l’écrire dans la commande ni dans l’historique.', [cm('net use \\\\{{serveur}}\\{{partage}} /user:{{domaine}}\\{{compteEcriture}} *')], 'La commande s’est terminée correctement.', { interactions: [{ attend: 'Tapez le mot de passe de', reponds: 'Mot de passe du compte en écriture, puis Entrée (non affiché).' }], important: 'Erreur système 1219 : une connexion avec un autre compte existe déjà vers ce serveur. Retire-la (étape précédente) ; si elle persiste, retire aussi la connexion cachée « \\\\serveur\\IPC$ » ou ferme la session Windows. Cherche l’erreur dans la liste Microsoft des codes système.' })),
          sur(W, mod('Créer un dossier (écriture)', 'Preuve d’écriture avec le compte en écriture.', [cm('mkdir \\\\{{serveur}}\\{{partage}}\\dossier_ecriture_win'), cm('dir \\\\{{serveur}}\\{{partage}}')], 'Le dossier dossier_ecriture_win figure dans la liste.', { verification: true })),
          sur(W, mod('Retirer la connexion à ce partage', 'Avant de passer au second compte.', [cm('net use \\\\{{serveur}}\\{{partage}} /delete')], 'La connexion est supprimée.')),
          sur(W, mod('Se connecter avec le compte en lecture seule', 'Même démarche, autre compte.', [cm('net use \\\\{{serveur}}\\{{partage}} /user:{{domaine}}\\{{compteLecture}} *')], 'La commande s’est terminée correctement.', { interactions: [{ attend: 'Tapez le mot de passe de', reponds: 'Mot de passe du compte en lecture seule, puis Entrée (non affiché).' }] })),
          sur(W, lec('Lire le partage', 'La lecture doit réussir et montrer le dossier créé par l’autre compte.', [cm('dir \\\\{{serveur}}\\{{partage}}')], 'La liste, avec dossier_ecriture_win.', { verification: true })),
          sur(W, lec('Essayer d’écrire (refus attendu)', 'L’écriture doit être REFUSÉE : copie le message dans le rapport.', [cm('mkdir \\\\{{serveur}}\\{{partage}}\\dossier_ecriture_refuse')], 'Accès refusé (Access is denied) : aucun dossier créé.', { verification: true })),
          sur(W, mod('Retirer la connexion et contrôler', 'Fin du test : la connexion de ce partage est retirée, les autres ne sont pas touchées.', [cm('net use \\\\{{serveur}}\\{{partage}} /delete'), cm('net use')], 'Le partage n’est plus dans la liste.')),
          sur(W, lec('Voir les identifiants mémorisés', 'cmdkey /list affiche les entrées du Gestionnaire d’identification. S’il en existe une pour ce serveur et que tu ne la veux pas, supprime UNE entrée précise (cmdkey /delete: suivi de sa cible), jamais toutes.', [cm('cmdkey /list')], 'La liste des entrées ; aucune pour le serveur du TP2.', { facultatif: true })),
        ],
        verification: ['dir montre le dossier créé avec le compte en écriture.', 'mkdir est refusé avec le compte en lecture seule.'], retour: 'net use \\\\serveur\\partage /delete retire la connexion ; le dossier créé se supprime depuis le serveur.',
      },
      {
        id: 'powershell', privileges: 'Utilisateur ordinaire, dans PowerShell. Les mots de passe se tapent à l’invite (option * de net use).',
        etapes: [
          sur(W, lec('Lister les connexions SMB du client', 'Get-SmbConnection liste les connexions SMB ouvertes par ce poste vers des serveurs (serveur, partage, compte, dialecte).', [ps('Get-SmbConnection | Select-Object ServerName, ShareName, UserName, Dialect'), ps('net use')], 'La liste des connexions, ou rien si aucune n’est ouverte.', { important: 'Si Get-SmbConnection refuse de s’exécuter, ouvre PowerShell en administrateur ou utilise « net use », qui donne la même information.' })),
          sur(W, mod('Retirer la connexion à CE partage (si elle existe)', 'Seule cette connexion est retirée ; n’utilise jamais « net use * /delete ».', [ps('net use \\\\{{serveur}}\\{{partage}} /delete')], 'Réussite, ou « La connexion réseau est introuvable ».', { facultatif: true })),
          sur(W, mod('Se connecter avec le compte en écriture', 'net.exe demande le mot de passe à l’invite grâce à l’astérisque.', [ps('net use \\\\{{serveur}}\\{{partage}} /user:{{domaine}}\\{{compteEcriture}} *')], 'La commande s’est terminée correctement.', { interactions: [{ attend: 'Tapez le mot de passe de', reponds: 'Mot de passe du compte en écriture, puis Entrée (non affiché).' }] })),
          sur(W, mod('Créer un dossier (écriture)', 'New-Item crée le dossier sur le partage ; -ErrorAction Stop transforme un refus en erreur visible.', [ps('New-Item -ItemType Directory -Path \\\\{{serveur}}\\{{partage}}\\dossier_ecriture_win -ErrorAction Stop'), ps('Get-ChildItem \\\\{{serveur}}\\{{partage}}')], 'Le dossier dossier_ecriture_win figure dans la liste.', { verification: true })),
          sur(W, mod('Retirer la connexion à ce partage', 'Avant de passer au second compte.', [ps('net use \\\\{{serveur}}\\{{partage}} /delete')], 'La connexion est supprimée.')),
          sur(W, mod('Se connecter avec le compte en lecture seule', 'Même démarche, autre compte.', [ps('net use \\\\{{serveur}}\\{{partage}} /user:{{domaine}}\\{{compteLecture}} *')], 'La commande s’est terminée correctement.', { interactions: [{ attend: 'Tapez le mot de passe de', reponds: 'Mot de passe du compte en lecture seule, puis Entrée (non affiché).' }] })),
          sur(W, lec('Lire le partage', 'La lecture doit réussir.', [ps('Get-ChildItem \\\\{{serveur}}\\{{partage}}')], 'La liste, avec dossier_ecriture_win.', { verification: true })),
          sur(W, lec('Essayer d’écrire (refus attendu)', 'L’écriture doit être REFUSÉE ; l’erreur affichée est la preuve à copier dans le rapport.', [ps('New-Item -ItemType Directory -Path \\\\{{serveur}}\\{{partage}}\\dossier_ecriture_refuse -ErrorAction Stop')], 'Une erreur d’accès refusé (UnauthorizedAccessException) : aucun dossier créé.', { verification: true })),
          sur(W, mod('Retirer la connexion et contrôler', 'Les autres connexions du poste ne sont pas touchées.', [ps('net use \\\\{{serveur}}\\{{partage}} /delete'), ps('net use')], 'Le partage n’est plus dans la liste.')),
        ],
        verification: ['Get-ChildItem montre le dossier créé avec le compte en écriture.', 'New-Item est refusé avec le compte en lecture seule.'], retour: 'net use \\\\serveur\\partage /delete retire la connexion.',
      },
    ],
    sources: [
      { label: 'net use (Microsoft Learn)', url: MS_NETUSE },
      { label: 'Codes d’erreur système 1000-1299 (1219)', url: MS_ERREURS },
      { label: 'cmdkey (Microsoft Learn)', url: `${MS}/cmdkey` },
      { label: 'Get-SmbConnection (Microsoft Learn)', url: 'https://learn.microsoft.com/en-us/powershell/module/smbshare/get-smbconnection' },
    ],
  }),

  // ------------------------------------------------------------------ A5
  fiche({
    id: 'cours-windows-connexion-domaine',
    titre: 'Ouvrir une session Windows avec un compte du domaine',
    resume: 'Vérifie que le poste Windows 11 est joint au domaine, ouvre une session avec un compte du domaine (un par département), puis prouve l’identité et l’appartenance au groupe du département avec whoami. À répéter pour chaque département.',
    effet: 'lecture',
    intentions: ['ouvrir une session windows avec un compte du domaine', 'connexion poste windows compte samba', 'whoami /groups département', 'tp2 a5 test de connexion windows', 'DOMAINE\\login connexion', 'poste joint au domaine vérifier'],
    motsCles: ['whoami', 'session', 'domaine', 'compte du domaine', 'département', 'groupe', 'windows 11', 'connexion'],
    prerequis: [
      { texte: 'Les comptes et les groupes de départements existent dans le domaine.', fiche: 'cours-samba-import-csv' },
      { texte: 'Le poste Windows 11 est intégré au domaine (énoncé : « tout client Windows intégré au domaine ») ; la jonction elle-même n’est pas détaillée ici.' },
    ],
    params: [
      { id: 'departement', label: 'groupe du département du compte testé', type: 'identifiant', exemple: 'Ventes_Marketing', aide: 'Le groupe Samba dont le compte est membre.' },
    ],
    methodes: [
      {
        id: 'gui', privileges: 'Aucun droit particulier : c’est un utilisateur ordinaire qui ouvre sa session.',
        etapes: [
          sur(W, gui('Vérifier que le poste est dans le domaine', 'lecture', 'Une session de domaine n’est possible que sur un poste joint au domaine.', ['Ouvre **Paramètres**, **Système**, **À propos**.', 'Lis **Domaine ou groupe de travail** : le nom du domaine doit y figurer.'], 'Le nom du domaine apparaît (et non « WORKGROUP »).', { verification: true })),
          sur(W, gui('Fermer la session en cours', 'interruption', 'On ouvre une nouvelle session : enregistre ton travail avant.', ['Menu **Démarrer**, ton nom, **Se déconnecter** (ou Win + L pour verrouiller puis choisir l’autre utilisateur).'], 'L’écran d’ouverture de session s’affiche.')),
          sur(W, gui('Ouvrir la session avec le compte du département', 'lecture', 'Le nom du compte de domaine s’écrit NOMDOMAINE\\login ou login@nom.du.domaine. Le contrôleur de domaine doit être joignable.', ['Clique **Autre utilisateur**.', 'Tape `NOMDOMAINE\\login` du compte à tester (le nom NetBIOS du domaine, une barre oblique inverse, le login).', 'Tape le mot de passe dans le champ prévu, sur ce poste seulement.', 'Valide. La première ouverture crée le profil : elle prend un moment.'], 'Le bureau s’ouvre.')),
          sur(W, gui('Prouver l’identité', 'lecture', 'Le sujet demande la preuve pour un utilisateur de CHAQUE département.', ['Ouvre un terminal et suis la méthode **CMD** ou **PowerShell** de cette fiche (whoami, whoami /groups).', 'Fais une capture qui montre le nom de compte et le groupe du département.'], 'Le terminal affiche le compte de domaine et son groupe.', { verification: true })),
        ],
        verification: ['La session s’ouvre avec le compte du domaine.', 'whoami affiche NOMDOMAINE\\login et whoami /groups le groupe du département.'], retour: 'Déconnecte la session et rouvre la tienne.',
      },
      {
        id: 'cmd', privileges: 'Utilisateur ordinaire, invite de commandes de la session ouverte.',
        etapes: [
          sur(W, lec('Qui suis-je ?', 'whoami affiche DOMAINE\\compte pour un compte de domaine (et NOMPOSTE\\compte pour un compte local).', [cm('whoami'), cm('echo %USERDOMAIN%')], 'NOMDOMAINE\\login puis le nom du domaine.', { verification: true })),
          sur(W, lec('Le groupe du département', 'whoami /groups liste les groupes du jeton de la session. Le groupe du département doit y figurer.', [cm('whoami /groups | findstr /i {{departement}}')], 'Une ligne NOMDOMAINE\\groupe de type « Groupe » avec l’attribut « Groupe obligatoire ».', { verification: true, important: 'Le groupe n’apparaît pas si le compte y a été ajouté APRÈS l’ouverture de la session : ferme la session et rouvre-la.' })),
          sur(W, lec('Le poste est-il dans le domaine ?', 'systeminfo affiche le nom du domaine du poste (« Domain » ou « Domaine » selon la langue).', [cm('systeminfo | findstr /B /C:"Domain" /C:"Domaine"')], 'Le nom du domaine.', { facultatif: true })),
        ],
        verification: ['whoami donne NOMDOMAINE\\login ; la ligne du groupe est présente.'], retour: null,
      },
      {
        id: 'powershell', privileges: 'Utilisateur ordinaire, PowerShell de la session ouverte.',
        etapes: [
          sur(W, lec('Qui suis-je ?', 'whoami affiche DOMAINE\\compte pour un compte de domaine ; la variable d’environnement donne le domaine de la session.', [ps('whoami'), ps('Write-Output $env:USERDOMAIN')], 'NOMDOMAINE\\login puis le nom du domaine.', { verification: true })),
          sur(W, lec('Le groupe du département', 'whoami /groups liste les groupes du jeton ; Select-String garde la ligne du département.', [ps('whoami /groups | Select-String {{departement}}')], 'Une ligne NOMDOMAINE\\groupe.', { verification: true, important: 'Le groupe n’apparaît pas si le compte y a été ajouté APRÈS l’ouverture de la session : ferme la session et rouvre-la.' })),
          sur(W, lec('Le poste est-il dans le domaine ?', 'Win32_ComputerSystem indique le domaine et si le poste en fait partie.', [ps('Get-CimInstance Win32_ComputerSystem | Select-Object Name, Domain, PartOfDomain')], 'PartOfDomain : True et le nom du domaine.', { facultatif: true })),
        ],
        verification: ['whoami donne NOMDOMAINE\\login ; la ligne du groupe est présente.'], retour: null,
      },
    ],
    sources: [{ label: 'whoami (Microsoft Learn)', url: `${MS}/whoami` }, { label: 'findstr (Microsoft Learn)', url: `${MS}/findstr` }],
    categorie: 'Active Directory',
  }),
];
