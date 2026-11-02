/**
 * procedures-linux-acces-outils.mjs — KJEMO-OUTILS-ADMIN-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Deux fiches pour administrer à distance depuis Ubuntu :
 *   - Cockpit : console d'administration dans le navigateur (port 9090) ;
 *   - OpenRSAT : l'équivalent libre de RSAT pour gérer un Active Directory
 *     (Samba AD compris) depuis un poste Linux, macOS ou Windows.
 * Option graphique en premier onglet. Rien n'est exécuté par le Toolkit.
 * Sources : documentation de Cockpit, dépôt officiel OpenRSAT (Tranquil IT).
 */
import { lec, mod, des, itr, gui, sh, CATEGORIE_LINUX, V_COURS } from './cours-outils.mjs';

const SUDO = 'Utilisateur ordinaire autorisé à utiliser sudo, sur Ubuntu avec accès Internet (apt).';
const ANNUL = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
const DOC_COCKPIT = 'https://cockpit-project.org/running.html';
const GH = 'https://github.com/tranquilit/OpenRSAT';

function fiche({ id, titre, resume, effet, intentions, motsCles, params = [], methodes, sources }) {
  return { id, titre, categorie: CATEGORIE_LINUX, resume, effet, intentions, motsCles, params, origine: 'memo', methodes, assistant: null, sources, validation: V_COURS };
}

export const PROCEDURES_LINUX_ACCES_OUTILS = [
  fiche({
    id: 'linux-cockpit-installer', titre: 'Installer Cockpit sur Ubuntu et s’y connecter', effet: 'modification',
    resume: 'Installe Cockpit (console d’administration web), démarre son socket et se connecte depuis un navigateur sur le port 9090. Option graphique : la connexion et les écrans de Cockpit ; commandes : installation, vérification et retrait.',
    intentions: ['installer cockpit ubuntu', 'cockpit port 9090', 'console web administration linux', 'systemctl enable --now cockpit.socket', 'ouvrir cockpit dans le navigateur', 'cockpit https 9090 certificat'],
    motsCles: ['cockpit', 'port 9090', 'console web', 'cockpit.socket', 'navigateur', 'administration'],
    params: [],
    methodes: [
      {
        id: 'gui', privileges: 'Cockpit déjà installé sur le serveur (méthode « linux »), un navigateur sur un poste qui atteint le serveur, et un compte du serveur membre du groupe sudo.',
        etapes: [
          gui('Ouvrir Cockpit dans le navigateur', 'lecture', 'Cockpit écoute sur le port 9090 en HTTPS, avec un certificat auto-signé : le navigateur affiche un avertissement la première fois.', ['Dans un navigateur, ouvre **https://** suivi de l’adresse IP du serveur, puis **:9090** (l’adresse s’affiche avec « hostname -I » sur le serveur).', 'Avertissement de certificat : **Avancé**, puis **Continuer vers le site** (c’est ton propre serveur).'], 'La page de connexion de Cockpit s’affiche.'),
          gui('Se connecter', 'lecture', 'Les comptes sont ceux du système. Le compte root est refusé par défaut.', ['Saisis le nom d’utilisateur et le mot de passe d’un compte du serveur, puis **Se connecter**.', 'Si le compte est dans le groupe sudo, clique sur **Accès limité** (ou « Activer l’accès administrateur ») en haut, puis saisis ton mot de passe : les actions qui modifient deviennent possibles.'], 'Le tableau de bord du serveur s’affiche, avec processeur, mémoire et état du système.'),
          gui('Explorer les écrans utiles', 'lecture', 'Le menu de gauche regroupe les outils : ils lisent les mêmes informations que les commandes.', ['**Vue d’ensemble** : état, processeur, mémoire.', '**Journaux**, **Stockage**, **Réseau**, **Comptes** et **Services** : consulte l’état ; modifie seulement avec l’accès administrateur activé.', '**Terminal** : un terminal Linux complet dans le navigateur.'], 'Tu peux lire un service, un disque ou un journal sans taper de commande.', { verification: true }),
          gui('Annuler — se déconnecter', 'interruption', 'Ferme la session Cockpit sans toucher au serveur. Pour désinstaller Cockpit, utilise la méthode « linux ».', ['Clique sur ton nom en haut à droite, puis **Se déconnecter**.'], 'Retour à la page de connexion.', ANNUL),
        ],
        verification: ['La page de connexion s’ouvre sur le port 9090 et le tableau de bord s’affiche après connexion.'],
        retour: 'Se déconnecter en haut à droite ; désinstallation : méthode « linux ».',
      },
      {
        id: 'linux', privileges: SUDO,
        etapes: [
          lec('Connaître la version d’Ubuntu', 'La documentation de Cockpit recommande, sur Ubuntu, d’installer depuis le dépôt « backports » de ta version pour avoir un Cockpit à jour.', [sh('grep -E \'^(PRETTY_NAME|VERSION_CODENAME)=\' /etc/os-release')], 'Le nom de la version et son nom de code (par exemple noble).'),
          mod('Installer Cockpit', 'Installe le paquet cockpit et ses dépendances depuis les dépôts d’Ubuntu.', [sh('sudo apt update'), sh('sudo apt install -y cockpit')], 'apt termine sans erreur.'),
          mod('Variante : Cockpit à jour (backports, facultatif)', 'Installe la version du dépôt backports de ta version d’Ubuntu, comme le conseille la documentation de Cockpit. À faire à la place de l’étape précédente.', [sh('sudo apt install -y -t "$(. /etc/os-release; echo ${VERSION_CODENAME})-backports" cockpit')], 'apt installe cockpit depuis backports. Une erreur « Release … not found » : ta version n’a pas de backports activés, garde l’étape précédente.', { facultatif: true }),
          mod('Démarrer le socket de Cockpit', 'Cockpit démarre à la demande : c’est le socket qui écoute le port 9090. « enable --now » le démarre tout de suite ET à chaque démarrage du serveur.', [sh('sudo systemctl enable --now cockpit.socket')], 'Aucune sortie en général, ou une ligne « Created symlink … ».'),
          lec('Vérifier que Cockpit écoute', 'Le socket doit être « active » et le port 9090 en écoute. Le service cockpit.service, lui, peut être « inactive » tant que personne ne se connecte : c’est normal.', [sh('systemctl is-active cockpit.socket'), sh('ss -tln | grep \':9090\'')], 'active, puis une ligne LISTEN sur le port 9090.', { verification: true }),
          lec('Trouver l’adresse à ouvrir dans le navigateur', 'Utilise l’une de ces adresses : https://adresse:9090.', [sh('hostname -I')], 'Une ou plusieurs adresses IP du serveur.'),
          lec('Pare-feu (seulement si ufw est actif)', 'Par défaut, ufw est inactif sur Ubuntu et rien n’est bloqué. S’il est « active », il faut autoriser le port 9090.', [sh('sudo ufw status')], 'Status: inactive (rien à faire) ou une liste de règles.'),
          mod('Autoriser le port 9090 dans ufw (facultatif)', 'À faire seulement si ufw est actif et que la connexion est refusée.', [sh('sudo ufw allow 9090/tcp')], 'Rule added.', { facultatif: true }),
          mod('Annuler — arrêter Cockpit', 'Ferme le port 9090 et empêche le démarrage automatique. Cockpit reste installé.', [sh('sudo systemctl disable --now cockpit.socket')], 'Le port 9090 n’écoute plus.', ANNUL),
          des('Annuler — désinstaller Cockpit', 'Retire le paquet Cockpit. Aucune donnée du serveur n’est touchée.', [sh('sudo apt remove -y cockpit')], 'apt retire cockpit.', ANNUL),
        ],
        verification: ['systemctl is-active cockpit.socket affiche active, le port 9090 écoute et la page de connexion s’ouvre dans le navigateur.'],
        retour: 'sudo systemctl disable --now cockpit.socket, puis sudo apt remove -y cockpit.',
      },
    ],
    sources: [{ label: 'Cockpit — Running Cockpit', url: DOC_COCKPIT }, { label: 'systemctl(1)', url: 'https://www.freedesktop.org/software/systemd/man/latest/systemctl.html' }],
  }),
  fiche({
    id: 'linux-openrsat-installer', titre: 'Installer OpenRSAT sur Ubuntu (RSAT libre pour Samba AD)', effet: 'modification',
    resume: 'OpenRSAT est l’équivalent libre de RSAT : une console pour gérer utilisateurs, groupes, DNS et sites d’un Active Directory (Samba AD compris) depuis Ubuntu. Installe le paquet .deb officiel, vérifie l’accès au contrôleur de domaine et ouvre la console. Projet encore en développement.',
    intentions: ['installer openrsat ubuntu', 'rsat sur linux', 'utilisateurs et ordinateurs active directory depuis ubuntu', 'console graphique samba ad linux', 'openrsat deb', 'équivalent rsat linux'],
    motsCles: ['openrsat', 'rsat', 'linux', 'samba ad', 'active directory', 'tranquil it', 'deb', 'console'],
    params: [
      { id: 'version', label: 'numéro de version d’OpenRSAT', type: 'arg', exemple: '0.4.519', aide: 'Dernière version vue à la rédaction : 0.4.519. Vérifie la plus récente sur la page des versions du dépôt (lien dans les sources).' },
      { id: 'serveur', label: 'nom du contrôleur de domaine', type: 'fqdn', exemple: 'srv1.ad.lab', aide: 'Le nom complet du serveur Samba AD que tu veux administrer.' },
    ],
    methodes: [
      {
        id: 'gui', privileges: 'Ubuntu avec interface graphique, accès Internet, droit sudo, et un contrôleur de domaine joignable (DNS du poste vers lui).',
        etapes: [
          gui('Télécharger le paquet officiel', 'modification', 'Le paquet .deb se trouve sur la page des versions du dépôt officiel de Tranquil IT. Prends celui qui finit par « amd64.deb » sur un PC ordinaire.', ['Ouvre le navigateur sur **github.com/tranquilit/OpenRSAT/releases/latest**.', 'Dans **Assets**, clique sur le fichier **OpenRSAT-…-amd64.deb** (il va dans le dossier Téléchargements).'], 'Le fichier .deb est dans Téléchargements.'),
          gui('Installer le paquet', 'modification', 'Le gestionnaire d’applications d’Ubuntu installe le .deb et ses dépendances. Il demande ton mot de passe.', ['Ouvre le dossier **Téléchargements**, clique droit sur le fichier .deb, **Ouvrir avec Installation de logiciels** (ou double-clique).', 'Clique **Installer** et saisis ton mot de passe.'], 'Le gestionnaire affiche « Installé » (les libellés exacts varient selon la version d’Ubuntu).'),
          gui('Ouvrir OpenRSAT et se connecter', 'lecture', 'La console demande où et comment se connecter. Les libellés exacts ne sont pas vérifiés ici.', ['Ouvre **Activités**, tape **OpenRSAT** et lance l’application.', 'Crée une connexion : saisis le nom du contrôleur de domaine, choisis une connexion **Kerberos** ou **simple** (avec TLS si ton serveur le propose), puis saisis un compte du domaine (par exemple Administrator).'], 'L’arborescence du domaine s’affiche : utilisateurs, groupes, ordinateurs, DNS.', { verification: true }),
          gui('Annuler — désinstaller', 'modification', 'Retire l’application ; le domaine n’est pas touché.', ['Ouvre le gestionnaire d’applications, onglet **Installées**, cherche **OpenRSAT**, clique **Désinstaller**.'], 'OpenRSAT disparaît de la liste des applications.', ANNUL),
        ],
        verification: ['OpenRSAT se lance et affiche l’annuaire du domaine après connexion.'],
        retour: 'Gestionnaire d’applications › Installées › OpenRSAT › Désinstaller.',
      },
      {
        id: 'linux', privileges: SUDO,
        etapes: [
          lec('Vérifier l’architecture du poste', 'Le paquet à prendre dépend du processeur : amd64 pour un PC ordinaire. D’autres paquets existent (arm64, armhf, i386).', [sh('dpkg --print-architecture')], 'amd64 sur un PC ordinaire. Autre valeur : prends le paquet correspondant sur la page des versions.'),
          lec('Vérifier que le contrôleur de domaine est joignable', 'OpenRSAT se connecte à l’annuaire par le nom du serveur : il doit se résoudre en adresse IP, et les ports LDAP (389) et LDAPS (636) répondre.', [sh('getent hosts {{serveur}}'), sh('nc -zv {{serveur}} 389 636')], 'Une adresse IP, puis « succeeded » pour les ports. Aucune ligne : corrige le DNS du poste d’abord (fiche « Régler le DNS d’un poste Windows » pour Windows ; netplan pour Ubuntu). nc absent : sudo apt install -y netcat-openbsd.'),
          mod('Télécharger le paquet .deb officiel', 'Télécharge depuis le dépôt GitHub de Tranquil IT, l’éditeur d’OpenRSAT. Vérifie que le nom du fichier correspond à la version choisie.', [sh('wget https://github.com/tranquilit/OpenRSAT/releases/download/v{{version}}/OpenRSAT-{{version}}-amd64.deb')], 'Un fichier OpenRSAT-…-amd64.deb dans le dossier courant. Erreur 404 : le numéro de version n’existe pas.'),
          mod('Installer le paquet', 'apt installe un fichier local quand son chemin commence par « ./ » et ajoute les dépendances manquantes.', [sh('sudo apt install -y ./OpenRSAT-{{version}}-amd64.deb')], 'apt termine sans erreur.'),
          lec('Voir ce que le paquet a installé', 'Affiche la commande et le lanceur du menu d’applications, pour savoir comment démarrer OpenRSAT.', [sh('dpkg -L "$(dpkg-deb -f OpenRSAT-{{version}}-amd64.deb Package)" | grep -iE \'bin/|\\.desktop$\'')], 'Un chemin dans /usr/bin ou /opt, et un fichier .desktop.', { verification: true }),
          lec('Vérifier l’installation', 'Le paquet doit apparaître à l’état « ii » (installé).', [sh('dpkg -l | grep -i openrsat')], 'Une ligne commençant par ii.', { verification: true }),
          mod('Variante : binaire autonome (facultatif)', 'Sans installer de paquet : télécharge le programme Linux x64, rends-le exécutable et lance-le. Aucune entrée de menu n’est créée.', [sh('wget -O OpenRSAT https://github.com/tranquilit/OpenRSAT/releases/latest/download/OpenRSAT-linux-x64'), sh('chmod +x OpenRSAT'), sh('./OpenRSAT')], 'La console OpenRSAT s’ouvre (session graphique requise).', { facultatif: true }),
          des('Annuler — désinstaller OpenRSAT', 'Retire le paquet ; le domaine n’est pas touché.', [sh('sudo apt remove -y "$(dpkg-deb -f OpenRSAT-{{version}}-amd64.deb Package)"')], 'apt retire le paquet.', ANNUL),
          des('Annuler — supprimer le fichier téléchargé', 'Efface seulement le .deb de ton dossier de travail.', [sh('rm -i OpenRSAT-{{version}}-amd64.deb')], 'Le fichier disparaît après confirmation.', ANNUL),
        ],
        verification: ['dpkg -l affiche OpenRSAT à l’état ii, et la console se connecte au contrôleur de domaine.'],
        retour: 'sudo apt remove du paquet, puis suppression du fichier .deb.',
      },
    ],
    sources: [{ label: 'OpenRSAT (dépôt officiel, Tranquil IT)', url: GH }, { label: 'OpenRSAT — versions', url: `${GH}/releases` }, { label: 'Installer OpenRSAT (documentation Samba-AD, Tranquil IT)', url: 'https://samba.tranquil.it/doc/en/samba_config_server-samba_install_RSAT.html' }],
  }),
];
