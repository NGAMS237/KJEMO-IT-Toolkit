/**
 * procedures-kiosque.mjs — KJEMO-KIOSQUE-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le mode KIOSQUE : un appareil qui n'ouvre qu'une seule application ou page,
 * sans pouvoir en sortir. Trois fiches complètes (option graphique, commandes,
 * vérification, annulation) :
 *   - Windows 10/11 : « Accès attribué » (Paramètres › Comptes › Autres
 *     utilisateurs › Configurer un kiosque, ou Set-AssignedAccess) ;
 *   - Ubuntu : compte dédié, ouverture de session automatique GDM, Firefox
 *     en plein écran (--kiosk) lancé au démarrage de la session ;
 *   - Azure / Microsoft Intune : profil de configuration « Kiosque » poussé
 *     à des appareils Windows inscrits (portail Intune + Azure CLI pour les
 *     groupes et le contrôle).
 * Sources : Microsoft Learn (Accès attribué, Set-AssignedAccess, Intune),
 * guide d'administration GNOME. Rien n'est exécuté par le Toolkit.
 */
import { lec, mod, des, itr, gui, sh, ps, MAN, CATEGORIE_LINUX, V_COURS } from './cours-outils.mjs';
import { POSTE, ADMIN, V_DOC, src } from './procedures-windows-simples.mjs';

const ANNUL = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
const COMPTE_WIN = { id: 'compte', label: 'compte du kiosque', type: 'identifiant', exemple: 'kiosque', aide: 'Un compte local STANDARD (pas administrateur) réservé au kiosque. Sans espace.' };
const APPLI_WIN = { id: 'appli', label: 'nom du paquet de l’application Microsoft Store', type: 'identifiant', exemple: 'Microsoft.WindowsCalculator', aide: 'Le nom du paquet tel que le donne Get-AppxPackage (colonne Name). Pas de joker.' };

// ===========================================================================
// WINDOWS
// ===========================================================================
const windows = {
  id: 'win-kiosque-configurer', titre: 'Configurer un kiosque Windows (une seule application)', categorie: POSTE, effet: 'interruption',
  resume: 'Transforme un poste Windows 10/11 en kiosque : un compte réservé ouvre automatiquement UNE application (Edge sur une page web, ou une application du Store) et ne peut rien faire d’autre. Option graphique (Paramètres › Comptes › Autres utilisateurs › Configurer un kiosque) ou PowerShell (Set-AssignedAccess), avec sortie du kiosque et retrait.',
  intentions: ['mode kiosque windows', 'accès attribué windows 11', 'assigned access', 'configurer un kiosque une seule application', 'set-assignedaccess', 'kiosque edge plein écran windows', 'verrouiller un poste sur une application', 'quitter le mode kiosque windows', 'retirer le kiosque windows'],
  motsCles: ['kiosque', 'kiosk', 'assigned access', 'accès attribué', 'set-assignedaccess', 'clear-assignedaccess', 'edge', 'compte restreint', 'borne'],
  params: [COMPTE_WIN, APPLI_WIN],
  origine: 'memo',
  methodes: [
    {
      id: 'gui',
      privileges: 'Session d’administrateur sur Windows 10/11 Pro, Entreprise ou Éducation (l’édition Famille n’a pas cette fonction). UAC activé. Le kiosque se connecte à la console du poste : il ne fonctionne pas par Bureau à distance. Libellés des écrans non vérifiés sur ton poste.',
      etapes: [
        gui('Ouvrir l’assistant du kiosque', 'lecture', 'Windows crée lui-même le compte du kiosque pendant l’assistant : rien à préparer avant.', ['Ouvre **Paramètres › Comptes › Autres utilisateurs** (Windows 10 : **Comptes › Famille et autres utilisateurs**).', 'Dans **Configurer un kiosque**, clique **Commencer**.'], 'L’assistant demande le nom du compte du kiosque.'),
        gui('Créer le compte et choisir l’application', 'modification', 'Le compte du kiosque est un compte standard sans mot de passe, ouvert automatiquement. Une seule application lui est autorisée.', ['Saisis un nom de compte (par exemple **kiosque**), puis **Suivant**.', 'Choisis l’application à lancer (par exemple **Microsoft Edge** pour une page web), puis **Suivant**.', 'Pour Edge : choisis comment l’afficher (**navigation publique** ou **affichage dynamique plein écran**), saisis l’adresse de la page, puis le nombre de minutes d’inactivité après lesquelles la page redémarre (0 = jamais).', '**Suivant**, puis **Fermer** ou **Terminer**.'], 'Le compte du kiosque apparaît dans la liste des utilisateurs.'),
        gui('Tester le kiosque', 'interruption', 'Ferme ta session d’administrateur et ouvre celle du kiosque pour voir le résultat.', ['Ferme ta session (**Démarrer › ton nom › Se déconnecter**).', 'Ouvre la session du compte kiosque : l’application démarre seule en plein écran.'], 'L’application s’ouvre en plein écran, sans bureau ni barre des tâches.', { verification: true }),
        gui('Sortir du kiosque (administrateur)', 'interruption', 'Dans le kiosque, aucune fenêtre ni menu Démarrer n’est disponible : la combinaison de touches mène à l’écran de sécurité.', ['Appuie sur **Ctrl + Alt + Suppr**, puis choisis **Se déconnecter** (ou Changer d’utilisateur).', 'Rouvre ta session d’administrateur.'], 'Tu reviens à l’écran de connexion.'),
        gui('Changer l’application ou la page', 'modification', 'Depuis la session d’un administrateur, jamais depuis le kiosque.', ['**Paramètres › Comptes › Autres utilisateurs**, ouvre le kiosque dans **Configurer un kiosque**.', 'Modifie les réglages de l’application, ou clique **Changer l’application du kiosque**.'], 'Les nouveaux réglages s’appliquent à la prochaine ouverture de la session du kiosque.', { facultatif: true }),
        gui('Annuler — retirer le kiosque', 'modification', 'Le compte reste sur le poste (supprime-le ensuite dans les mêmes réglages si tu n’en as plus besoin).', ['Session d’administrateur : **Paramètres › Comptes › Autres utilisateurs**.', 'Dans **Configurer un kiosque**, ouvre le kiosque actif, clique **Retirer le kiosque**, puis confirme.'], 'Le compte redevient un compte ordinaire à la prochaine ouverture.', ANNUL),
      ],
      verification: ['L’ouverture de la session du kiosque lance l’application en plein écran, et Ctrl + Alt + Suppr permet d’en sortir.'],
      retour: 'Paramètres › Comptes › Autres utilisateurs › Configurer un kiosque › Retirer le kiosque.',
    },
    {
      id: 'powershell', privileges: `${ADMIN} Windows 10/11 Pro, Entreprise ou Éducation. Set-AssignedAccess ne gère qu’UNE application du Microsoft Store par compte (pas Edge en mode kiosque : utilise l’option graphique pour Edge).`,
      etapes: [
        { titre: 'Vérifier si un kiosque existe déjà', effet: 'lecture', explication: 'Get-AssignedAccess affiche le compte et l’application déjà configurés, ou rien.', lignes: [ps('Get-AssignedAccess')], attendu: 'Aucune sortie (pas de kiosque) ou le nom du compte et de l’application.' },
        mod('Créer un compte standard pour le kiosque', 'Le compte n’a pas de mot de passe : il s’ouvre d’un clic sur l’écran de connexion. Il ne doit pas être administrateur, sinon Set-AssignedAccess le refuse.', [ps('New-LocalUser -Name {{compte}} -NoPassword -AccountNeverExpires'), ps('Add-LocalGroupMember -Group Users -Member {{compte}}')], 'Le compte est créé puis ajouté au groupe Users sans message d’erreur.'),
        lec('Trouver le nom de l’application', 'Le nom du paquet est la colonne Name. L’application doit être installée pour le compte du kiosque : lance-la une fois dans sa session si elle manque.', [ps('Get-AppxPackage | Select-Object Name | Sort-Object Name')], 'Une liste de noms de paquets, dont Microsoft.WindowsCalculator.'),
        mod('Attribuer l’application au compte', 'Set-AssignedAccess lie le compte à UNE application du Store. Redémarre ensuite le poste si le compte était déjà connecté.', [ps('Set-AssignedAccess -UserName {{compte}} -AppName {{appli}}')], 'Pas de sortie, ou le nom du compte et de l’application. Une erreur sur le nom : essaie avec le nom d’affichage de l’application, sans joker.', { important: 'Le compte ne doit être ni un compte de domaine ni un administrateur. Redémarre le poste si la session du compte est déjà ouverte.' }),
        lec('Vérifier la configuration', 'Get-AssignedAccess doit répéter le compte et l’application choisis.', [ps('Get-AssignedAccess')], 'Le nom du compte kiosque et celui de l’application.', { verification: true }),
        { titre: 'Sortir du kiosque (administrateur)', effet: 'interruption', explication: 'Avec Set-AssignedAccess, Windows prévoit une combinaison de touches : appuyer rapidement 5 fois sur la touche Windows de gauche ramène à l’écran de connexion. Ctrl + Alt + Suppr fonctionne aussi dans la plupart des cas.', lignes: [ps('Get-AssignedAccess')], attendu: 'La manipulation se fait au clavier du poste kiosque ; la commande ne sert qu’à confirmer la configuration une fois reconnecté.', facultatif: true },
        { titre: 'Annuler — retirer le kiosque', effet: 'modification', explication: 'Clear-AssignedAccess défait le lien entre le compte et l’application. Le compte reste.', lignes: [ps('Clear-AssignedAccess')], attendu: 'Plus de configuration : Get-AssignedAccess ne renvoie rien.', ...ANNUL },
        { titre: 'Annuler — supprimer le compte du kiosque', effet: 'destructif', explication: 'Supprime le compte local. Son profil (le dossier C:\\Users\\kiosque) reste sur le disque jusqu’à son nettoyage.', lignes: [ps('Remove-LocalUser -Name {{compte}}')], attendu: 'Aucune sortie ; le compte disparaît de Get-LocalUser.', ...ANNUL },
        { titre: 'Annuler — retirer un kiosque posé par XML ou par MDM (facultatif)', effet: 'modification', explication: 'Cas d’un kiosque posé par une configuration XML (Edge, Intune, fichier de provisionnement). Microsoft donne cette suite de commandes, à lancer en SYSTEM (par exemple avec psexec -i -s powershell), puis redémarre le poste.', lignes: [ps('$obj = Get-CimInstance -Namespace "root\\cimv2\\mdm\\dmmap" -ClassName MDM_AssignedAccess'), ps('$obj.Configuration = $null'), ps('Set-CimInstance -CimInstance $obj')], attendu: 'Aucune sortie ; après le redémarrage, le poste n’est plus en kiosque.', ...ANNUL, important: 'Ces trois lignes ne marchent qu’en SYSTEM : en administrateur ordinaire, la classe est refusée.' },
      ],
      verification: ['Get-AssignedAccess affiche le compte et l’application, et la session du compte ouvre l’application seule.'],
      retour: 'Clear-AssignedAccess, puis Remove-LocalUser pour le compte.',
    },
  ],
  sources: [
    src('Set-AssignedAccess', '/powershell/module/assignedaccess/set-assignedaccess'),
    src('Accès attribué (Assigned Access) — vue d’ensemble', '/windows/configuration/assigned-access/overview'),
    src('Quickstart : kiosque Edge avec Accès attribué (retrait)', '/windows/configuration/assigned-access/quickstart-kiosk'),
  ],
  validation: V_DOC,
};

// ===========================================================================
// UBUNTU
// ===========================================================================
const COMPTE_LX = { id: 'compte', label: 'compte du kiosque', type: 'identifiant', exemple: 'kiosque', aide: 'Un compte Linux réservé au kiosque, sans mot de passe, qui ouvrira sa session tout seul.' };
const URL_LX = { id: 'url', label: 'adresse de la page à afficher', type: 'arg', exemple: 'https://www.example.org/', aide: 'L’adresse complète de la page (http:// ou https://). Les caractères ? & ; et les espaces ne sont pas acceptés ici.' };
const GNOME = 'https://help.gnome.org/admin/system-admin-guide/stable/lockdown-single-app-mode.html.en';
const SUDO = 'Utilisateur ordinaire autorisé à utiliser sudo, sur Ubuntu Desktop (GNOME, GDM3) avec Firefox installé (c’est le navigateur par défaut).';

const linux = {
  id: 'linux-kiosque-configurer', titre: 'Configurer un kiosque Ubuntu (une page web en plein écran)', categorie: CATEGORIE_LINUX, effet: 'interruption',
  resume: 'Fait d’un Ubuntu Desktop un kiosque : un compte dédié ouvre sa session tout seul (GDM) et Firefox affiche une page en plein écran dès le démarrage. Option graphique (Paramètres › Utilisateurs, Applications au démarrage) ou commandes ; sortie par un autre terminal et retrait complet.',
  intentions: ['mode kiosque ubuntu', 'firefox --kiosk', 'ouverture de session automatique ubuntu', 'gdm3 automaticlogin', 'chromium kiosk ubuntu', 'borne affichage ubuntu page web plein écran', 'lancer une application au démarrage de la session', 'quitter le mode kiosque ubuntu', 'retirer le kiosque ubuntu'],
  motsCles: ['kiosque', 'kiosk', 'firefox', 'gdm3', 'custom.conf', 'automaticlogin', 'autostart', 'plein écran', 'borne', 'affichage'],
  params: [COMPTE_LX, URL_LX],
  origine: 'memo',
  methodes: [
    {
      id: 'gui', privileges: 'Session d’administrateur sur Ubuntu Desktop (GNOME). Libellés des écrans variables selon la version d’Ubuntu, non vérifiés ici.',
      etapes: [
        gui('Créer le compte du kiosque', 'modification', 'Un compte standard réservé au kiosque, jamais administrateur.', ['Ouvre **Paramètres › Système › Utilisateurs** (selon la version : **Paramètres › Utilisateurs**).', 'Clique **Déverrouiller**, saisis ton mot de passe, puis **Ajouter un utilisateur…**.', 'Type de compte **Standard**, nom **kiosque**, et choisis **Permettre à l’utilisateur de définir son mot de passe à la prochaine connexion** ou saisis un mot de passe que tu notes.'], 'Le compte kiosque apparaît dans la liste des utilisateurs.'),
        gui('Activer l’ouverture de session automatique', 'modification', 'GDM ouvrira la session du kiosque sans demander de mot de passe à chaque démarrage.', ['Dans la liste des utilisateurs, sélectionne **kiosque**.', 'Active **Connexion automatique**.'], 'L’interrupteur est sur Activé pour le compte kiosque.'),
        gui('Ouvrir la session du kiosque et lancer la page au démarrage', 'modification', 'Cette étape se fait DANS la session du kiosque, pour que la configuration de démarrage soit la sienne.', ['Déconnecte-toi, puis ouvre la session **kiosque**.', 'Ouvre **Activités**, cherche **Applications au démarrage** (paquet gnome-startup-applications si absent), puis **Ajouter**.', 'Nom : **Kiosque**. Commande : **firefox --kiosk** suivi de l’adresse de la page. Enregistre.'], 'L’entrée « Kiosque » figure dans la liste des applications au démarrage.'),
        gui('Désactiver la mise en veille et le verrouillage d’écran', 'modification', 'Sinon l’écran s’éteint ou se verrouille sur un mot de passe que personne ne connaît.', ['Toujours dans la session du kiosque : **Paramètres › Alimentation › Économie d’énergie › Écran éteint** : choisis **Jamais**.', '**Paramètres › Confidentialité (ou Sécurité) › Verrouillage d’écran** : désactive **Verrouillage automatique de l’écran**.'], 'L’écran ne s’éteint plus tout seul.'),
        gui('Tester', 'interruption', 'Redémarre pour voir le comportement réel au démarrage.', ['Redémarre l’ordinateur.'], 'Ubuntu ouvre la session kiosque tout seul et Firefox affiche la page en plein écran.', { verification: true }),
        gui('Annuler — retirer la connexion automatique', 'modification', 'Redonne l’écran de connexion normal au prochain démarrage.', ['Session d’administrateur (ouvre-la avec Ctrl + Alt + F3, voir la méthode « linux » si le kiosque bloque).', '**Paramètres › Système › Utilisateurs**, sélectionne **kiosque**, désactive **Connexion automatique**.'], 'L’écran de connexion s’affiche à nouveau au démarrage.', ANNUL),
      ],
      verification: ['Au démarrage, la session kiosque s’ouvre seule et la page s’affiche en plein écran.'],
      retour: 'Désactiver Connexion automatique, retirer l’entrée de démarrage, supprimer le compte.',
    },
    {
      id: 'linux', privileges: SUDO,
      etapes: [
        lec('Vérifier que le compte n’existe pas', 'Évite d’écraser un compte existant. Le message « no such user » est la bonne réponse ici.', [sh('id {{compte}}')], 'id: ‘kiosque’: no such user.'),
        mod('Créer le compte du kiosque', 'Compte sans mot de passe (--disabled-password) : personne ne peut s’y connecter par mot de passe, mais GDM peut l’ouvrir automatiquement.', [sh('sudo adduser --disabled-password --gecos "" {{compte}}')], 'Le compte et son dossier /home/kiosque sont créés.'),
        mod('Faire une copie de sauvegarde de la configuration de GDM', 'À garder : elle sert à annuler.', [sh('sudo cp -a /etc/gdm3/custom.conf /etc/gdm3/custom.conf.bak')], 'Aucune sortie ; le fichier .bak existe.'),
        mod('Activer l’ouverture de session automatique', 'Dé-commente et règle les deux lignes AutomaticLoginEnable et AutomaticLogin dans la section [daemon] du fichier de GDM.', [sh('sudo sed -i -e \'s/^#\\?[[:space:]]*AutomaticLoginEnable[[:space:]]*=.*/AutomaticLoginEnable = true/\' -e \'s/^#\\?[[:space:]]*AutomaticLogin[[:space:]]*=.*/AutomaticLogin = {{compte}}/\' /etc/gdm3/custom.conf')], 'Aucune sortie. Les deux lignes sont maintenant actives.', { important: 'Si les deux lignes n’existent pas du tout dans le fichier, ajoute-les à la main sous [daemon] : le contrôle de l’étape suivante les montre.' }),
        lec('Contrôler le fichier de GDM', 'Les deux lignes doivent apparaître sans « # » devant, avec le bon compte.', [sh('grep -nE \'^(AutomaticLoginEnable|AutomaticLogin)[[:space:]]*=\' /etc/gdm3/custom.conf')], 'AutomaticLoginEnable = true et AutomaticLogin = kiosque.', { verification: true }),
        mod('Lancer Firefox en plein écran à l’ouverture de la session', 'Un fichier .desktop dans le dossier autostart du compte : GNOME le lance tout seul à l’ouverture de session. --kiosk met Firefox en plein écran sans barre.', [sh('sudo -u {{compte}} mkdir -p /home/{{compte}}/.config/autostart'), sh('printf \'[Desktop Entry]\\nType=Application\\nName=Kiosque\\nExec=firefox --kiosk {{url}}\\n\' | sudo -u {{compte}} tee /home/{{compte}}/.config/autostart/kiosque.desktop')], 'Le fichier kiosque.desktop est affiché par tee.'),
        mod('Empêcher la mise en veille et le verrouillage', 'Réglages GNOME du compte du kiosque : écran jamais éteint, pas de verrouillage.', [sh('sudo -u {{compte}} dbus-run-session gsettings set org.gnome.desktop.session idle-delay 0'), sh('sudo -u {{compte}} dbus-run-session gsettings set org.gnome.desktop.screensaver lock-enabled false')], 'Aucune sortie. Une erreur de connexion à dconf : fais ce réglage dans la session du kiosque (option graphique).'),
        lec('Contrôler le fichier de démarrage', 'Le fichier doit contenir la commande avec ton adresse.', [sh('sudo cat /home/{{compte}}/.config/autostart/kiosque.desktop')], 'Les lignes [Desktop Entry], Type=Application, Name=Kiosque, Exec=firefox --kiosk et l’adresse.', { verification: true }),
        itr('Redémarrer pour tester', 'Le redémarrage ferme les sessions ouvertes : enregistre ton travail avant.', [sh('sudo reboot')], 'Au redémarrage, la session kiosque s’ouvre seule et Firefox affiche la page en plein écran.'),
        lec('Vérifier que Firefox tourne dans la session du kiosque', 'À lancer depuis un autre terminal (Ctrl + Alt + F3, puis ta connexion d’administrateur) ou en SSH.', [sh('pgrep -u {{compte}} -a firefox')], 'Une ligne firefox --kiosk avec l’adresse.', { verification: true }),
        { titre: 'Sortir du kiosque (administrateur)', effet: 'interruption', explication: 'Le kiosque n’a pas de menu. Ouvre un autre terminal avec Ctrl + Alt + F3 (ou F4), connecte-toi avec ton compte d’administrateur : tu peux alors lancer les étapes « Annuler » de cette fiche. Ctrl + Alt + F1 ou F2 ramène à l’affichage graphique. Alt + F4 ferme seulement Firefox.', lignes: [sh('who')], attendu: 'who liste les sessions ouvertes, dont celle du kiosque.', facultatif: true },
        { titre: 'Annuler — rétablir la configuration de GDM', effet: 'modification', explication: 'Remet le fichier de GDM tel qu’avant : l’écran de connexion normal revient au prochain démarrage.', lignes: [sh('sudo cp -a /etc/gdm3/custom.conf.bak /etc/gdm3/custom.conf')], attendu: 'Aucune sortie.', ...ANNUL },
        { titre: 'Annuler — retirer le lancement de la page', effet: 'modification', explication: 'Supprime seulement le fichier de démarrage du kiosque.', lignes: [sh('sudo rm /home/{{compte}}/.config/autostart/kiosque.desktop')], attendu: 'Aucune sortie.', ...ANNUL },
        { titre: 'Annuler — supprimer le compte du kiosque', effet: 'destructif', explication: 'Supprime le compte ET son dossier personnel. Fais-le seulement après avoir rétabli GDM, sinon GDM cherche un compte qui n’existe plus.', lignes: [sh('sudo deluser --remove-home {{compte}}')], attendu: 'Le compte et /home/kiosque sont supprimés.', ...ANNUL },
      ],
      verification: ['grep montre l’ouverture automatique, kiosque.desktop contient la commande, et après redémarrage pgrep trouve Firefox dans la session du kiosque.'],
      retour: 'Copie de custom.conf.bak, suppression de kiosque.desktop, puis deluser --remove-home.',
    },
  ],
  sources: [
    { label: 'Guide d’administration GNOME — mode application unique (kiosque)', url: GNOME },
    { label: 'adduser(8)', url: `${MAN}/man8/adduser.8.html` },
    { label: 'Chromium kiosque sous Ubuntu (Pi My Life Up) — connexion automatique GDM', url: 'https://pimylifeup.com/ubuntu-chromium-kiosk/' },
  ],
  validation: V_COURS,
};

// ===========================================================================
// AZURE / INTUNE
// ===========================================================================
const GROUPE_AZ = { id: 'groupe', label: 'groupe Entra ID des appareils kiosques', type: 'identifiant', exemple: 'grp-kiosques', aide: 'Le nom du groupe Microsoft Entra qui contient les APPAREILS kiosques (pas des utilisateurs). Lettres, chiffres, tirets.' };
const PROFIL_AZ = { id: 'profil', label: 'nom du profil de kiosque', type: 'identifiant', exemple: 'Kiosque-Edge', aide: 'Le nom du profil de configuration créé dans Intune.' };
const APPAREIL_AZ = { id: 'appareil', label: 'nom de l’appareil Windows', type: 'identifiant', exemple: 'PC-KIOSQUE01', aide: 'Le nom de l’ordinateur tel qu’il apparaît dans Entra ID / Intune.' };
const ID_APPAREIL = { id: 'idAppareil', label: 'identifiant d’objet de l’appareil', type: 'uuid', exemple: '11111111-2222-3333-4444-555555555555', aide: 'Le GUID lu à l’étape précédente. L’exemple est fictif.' };
const ID_PROFIL = { id: 'idProfil', label: 'identifiant du profil', type: 'uuid', exemple: '66666666-7777-8888-9999-000000000000', aide: 'Le GUID du profil lu à l’étape « Retrouver le profil ». L’exemple est fictif.' };
const INTUNE = 'https://learn.microsoft.com/intune/intune-service/configuration/kiosk-settings-windows';
const GRAPH = 'https://learn.microsoft.com/graph/api/resources/intune-deviceconfig-windowskioskconfiguration?view=graph-rest-beta';
const V_AZ_K = `${V_COURS} Rien n’a été exécuté dans un abonnement Azure ni dans un locataire Intune. Les écrans du centre d’administration Intune changent souvent : suis les libellés que tu vois. Les commandes Microsoft Graph demandent un rôle Intune (administrateur Intune) et le consentement de l’application Azure CLI, parfois refusé par l’organisation.`;

const azure = {
  id: 'azure-intune-kiosque', titre: 'Déployer un kiosque Windows avec Intune (profil Azure)', categorie: 'Azure et Entra ID', effet: 'modification',
  resume: 'Pousse un mode kiosque (Edge plein écran ou une application) à des appareils Windows gérés par Microsoft Intune : un groupe Entra ID d’appareils, un profil de configuration « Kiosque » dans le centre d’administration Intune, puis l’affectation. Azure CLI sert aux groupes et au contrôle ; la création du profil se fait dans le portail.',
  intentions: ['kiosque intune', 'profil de configuration kiosque windows', 'déployer un kiosque avec azure', 'mode kiosque entra id intune', 'single app full-screen kiosk intune', 'azure virtual desktop kiosque appareil', 'groupe d’appareils entra az ad group', 'retirer un profil kiosque intune'],
  motsCles: ['kiosque', 'kiosk', 'intune', 'entra', 'azure', 'profil de configuration', 'az ad group', 'microsoft graph', 'edge'],
  params: [GROUPE_AZ, PROFIL_AZ, APPAREIL_AZ, ID_APPAREIL, ID_PROFIL],
  prerequis: [{ texte: 'Licence Microsoft Intune, rôle Administrateur Intune (ou Gestionnaire de stratégies et profils), et appareils Windows 10/11 Pro, Entreprise ou Éducation inscrits dans Intune.' }],
  origine: 'memo',
  methodes: [
    {
      id: 'gui', privileges: 'Centre d’administration Microsoft Intune (intune.microsoft.com) avec un rôle Intune. Libellés d’après la documentation Microsoft, non vérifiés dans ton locataire.',
      etapes: [
        gui('Créer le groupe d’appareils', 'modification', 'Le profil sera affecté à un groupe d’APPAREILS, pas d’utilisateurs. Il peut aussi se créer en ligne de commande (méthode « azure »).', ['Ouvre **Microsoft Entra** (entra.microsoft.com) › **Groupes › Tous les groupes › Nouveau groupe**.', 'Type **Sécurité**, nom du groupe, type d’appartenance **Attribué**.', 'Clique **Aucun membre sélectionné**, ajoute les appareils kiosques, puis **Créer**.'], 'Le groupe apparaît avec les appareils comme membres.'),
        gui('Créer le profil de kiosque', 'modification', 'Le profil « Kiosque » est un modèle de profil de configuration pour Windows 10 et ultérieur.', ['Ouvre le centre d’administration **Intune › Appareils › Configuration** (selon la version : **Appareils › Gérer les appareils › Configuration**).', 'Clique **Créer › Nouvelle stratégie**.', '**Plateforme : Windows 10 et ultérieur**, **Type de profil : Modèles**, modèle **Kiosque**, puis **Créer**.', 'Saisis le nom du profil, puis **Suivant**.'], 'L’assistant ouvre la page « Paramètres de configuration ».'),
        gui('Régler le kiosque en application unique', 'modification', 'Edge s’affiche en plein écran sur une adresse. Le profil ne se charge que pour des comptes STANDARD, jamais pour un administrateur local.', ['**Sélectionner un mode kiosque : Kiosque plein écran à application unique**.', '**Type d’ouverture de session de l’utilisateur : Ouverture de session automatique** (Windows 10 version 1803 et ultérieur).', '**Type d’application : Ajouter le navigateur Microsoft Edge**, puis saisis l’**URL du kiosque Edge**.', 'Choisis le **type de mode kiosque Edge** : **Navigation publique (InPrivate)** (onglets limités) ou **Affichage dynamique / signalisation interactive (InPrivate)** (une seule page en plein écran).', 'Règle **Actualiser le navigateur après un temps d’inactivité** (0 à 1440 minutes), puis **Suivant**.'], 'Les paramètres du kiosque sont renseignés.'),
        gui('Affecter le profil au groupe', 'modification', 'Sans affectation, le profil reste sans effet.', ['Page **Affectations › Ajouter des groupes**, choisis le groupe d’appareils, puis **Suivant**.', 'Page **Vérifier + créer › Créer**.'], 'Le profil est créé et affecté au groupe.'),
        gui('Contrôler l’état de l’appareil', 'lecture', 'L’appareil reçoit le profil à sa prochaine synchronisation puis ouvre le kiosque à la prochaine ouverture de session.', ['**Intune › Appareils › Configuration**, ouvre le profil.', 'Consulte **État de l’appareil** : l’appareil doit passer à **Réussite**. Sur l’appareil, redémarre-le.'], 'État « Réussite » ; l’appareil ouvre une session automatique avec Edge en plein écran.', { verification: true }),
        gui('Annuler — retirer le profil', 'modification', 'Retire d’abord l’affectation, puis le profil ; après synchronisation, l’appareil quitte le kiosque (un redémarrage peut être nécessaire).', ['**Intune › Appareils › Configuration**, ouvre le profil, **Propriétés › Affectations › Modifier**, retire le groupe, **Enregistrer**.', 'Reviens à la liste, sélectionne le profil, **Supprimer**, puis confirme.'], 'Le profil disparaît de la liste.', ANNUL),
      ],
      verification: ['L’état de l’appareil indique Réussite et l’appareil ouvre le kiosque après redémarrage.'],
      retour: 'Retirer l’affectation puis supprimer le profil dans Intune.',
    },
    {
      id: 'azure', privileges: 'Azure CLI connectée (`az login`, faite par toi) avec un compte autorisé à gérer des groupes Entra et à lire Intune (rôle Administrateur Intune). La création du profil lui-même se fait dans le portail (méthode graphique).',
      etapes: [
        lec('Vérifier le compte connecté', 'Confirme le locataire (Tenant) dans lequel tu travailles : le profil sera créé là.', [sh('az account show --output table')], 'Le nom de l’abonnement et l’identifiant du locataire (Tenant ID).'),
        lec('Vérifier que le groupe n’existe pas', 'Une liste vide est la bonne réponse avant de créer le groupe.', [sh('az ad group list --display-name {{groupe}} --query "[].{nom:displayName,id:id}" --output table')], 'Aucune ligne, ou le groupe existant avec son identifiant.'),
        mod('Créer le groupe d’appareils', 'Groupe de sécurité Entra ID, à l’appartenance attribuée à la main. --mail-nickname est obligatoire.', [sh('az ad group create --display-name {{groupe}} --mail-nickname {{groupe}}')], 'Un bloc JSON avec l’identifiant (id) du groupe.'),
        lec('Retrouver l’appareil', 'Lit les appareils Entra et garde celui qui porte ton nom. Seuls les 100 premiers appareils sont lus : en cas de grand parc, passe par le portail.', [sh('az rest --method get --url https://graph.microsoft.com/v1.0/devices --query "value[?displayName==\'{{appareil}}\'].{nom:displayName,id:id}" --output table')], 'Une ligne avec le nom de l’appareil et son identifiant d’objet (GUID).'),
        mod('Ajouter l’appareil au groupe', 'L’identifiant est celui de l’appareil lu à l’étape précédente (id), pas son identifiant d’appareil Intune.', [sh('az ad group member add --group {{groupe}} --member-id {{idAppareil}}')], 'Aucune sortie en cas de réussite.'),
        lec('Vérifier les membres du groupe', 'L’appareil doit figurer dans la liste.', [sh('az ad group member list --group {{groupe}} --query "[].{nom:displayName,id:id}" --output table')], 'Une ligne pour chaque appareil du groupe.', { verification: true }),
        lec('Retrouver le profil créé dans Intune', 'Lit les profils de configuration Intune et garde celui qui porte ton nom. Garde son identifiant (id) pour la suite.', [sh('az rest --method get --url https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations --query "value[?contains(displayName,\'{{profil}}\')].{nom:displayName,id:id}" --output table')], 'Une ligne avec le nom du profil et son identifiant. Une erreur 403 : le consentement Graph d’Azure CLI est refusé ; utilise le portail.', { important: 'Cette commande lit la version beta de Microsoft Graph, qui peut changer. L’appel exige l’autorisation DeviceManagementConfiguration.Read.All.' }),
        lec('Vérifier l’affectation du profil', 'Le groupe d’appareils doit figurer dans les affectations du profil.', [sh('az rest --method get --url https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations/{{idProfil}}/assignments --query "value[].target.groupId" --output tsv')], 'L’identifiant du groupe (celui de la création du groupe).', { verification: true }),
        { titre: 'Annuler — retirer l’appareil du groupe', effet: 'modification', explication: 'Après la prochaine synchronisation, l’appareil ne reçoit plus le profil.', lignes: [sh('az ad group member remove --group {{groupe}} --member-id {{idAppareil}}')], attendu: 'Aucune sortie.', ...ANNUL },
        { titre: 'Annuler — supprimer le groupe', effet: 'destructif', explication: 'Supprime le groupe Entra ID. Retire d’abord l’affectation du profil dans Intune (méthode graphique), sinon le profil reste affecté à un groupe disparu.', lignes: [sh('az ad group delete --group {{groupe}}')], attendu: 'Aucune sortie.', ...ANNUL },
      ],
      verification: ['Le groupe contient l’appareil et le profil de kiosque est affecté à ce groupe.'],
      retour: 'Retirer l’affectation et supprimer le profil dans Intune, puis az ad group delete.',
    },
  ],
  sources: [
    { label: 'Intune — profil de kiosque Windows : application unique, Edge, ouverture automatique', url: INTUNE },
    { label: 'Microsoft Graph — windowsKioskConfiguration', url: GRAPH },
    { label: 'az ad group', url: 'https://learn.microsoft.com/cli/azure/ad/group' },
  ],
  validation: V_AZ_K,
};

export const PROCEDURES_KIOSQUE = [windows, linux, azure];
