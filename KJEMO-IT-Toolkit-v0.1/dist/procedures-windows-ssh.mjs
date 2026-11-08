/**
 * procedures-windows-ssh.mjs — KJEMO-SYSTEME-01 · KJEMO IT Toolkit
 * Client OpenSSH de Windows 10 et 11 : le vérifier et l'installer (fonctionnalité facultative).
 * Même contrat que les autres fiches Windows. Non exécuté sur un poste réel.
 */
import { fiche, ps, lec, mod, src, ADMIN } from './procedures-windows-simples.mjs';

export const PROCEDURES_WINDOWS_SSH = [
  fiche({
    id: 'win-ssh-client-installer', titre: 'Installer ou vérifier le client SSH de Windows', effet: 'modification', privileges: ADMIN,
    resume: 'Vérifie que la commande ssh existe sous Windows 10 ou 11 et installe le client OpenSSH, une fonctionnalité de Windows, si elle manque. Aucun logiciel externe n’est nécessaire.',
    intentions: ['openssh.client windows', 'add-windowscapability openssh', 'installer ssh sous windows 11', 'ssh n’est pas reconnu windows', 'se connecter en ssh depuis powershell'],
    motsCles: ['ssh', 'openssh', 'client', 'windows', 'add-windowscapability', 'powershell', 'fonctionnalité'],
    etapes: [
      lec('Vérifier si ssh existe', 'Si PowerShell répond avec une version, le client est déjà installé.', [ps('ssh -V')], 'Par exemple « OpenSSH_for_Windows_9.5p1 ». Une erreur « n’est pas reconnu » : il manque.'),
      lec('Voir l’état de la fonctionnalité', 'Installed signifie déjà présent ; NotPresent, à installer.', [ps('Get-WindowsCapability -Online | Where-Object Name -like \'OpenSSH.Client*\'')], 'Une ligne OpenSSH.Client avec State : Installed ou NotPresent.'),
      mod('Installer le client', 'Télécharge et active la fonctionnalité depuis Windows Update ; une connexion Internet est nécessaire.', [ps('Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0')], 'Une sortie avec « RestartNeeded : False » en général.', { important: 'Demande un PowerShell ouvert en tant qu’administrateur. Ferme et rouvre PowerShell ensuite pour que la commande ssh soit reconnue.' }),
      lec('Vérifier', 'La commande ssh doit maintenant répondre.', [ps('ssh -V')], 'Une version d’OpenSSH.', { verification: true }),
    ],
    verification: ['ssh -V affiche une version dans un PowerShell rouvert.'],
    retour: 'Remove-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 retire le client.',
    sources: [src('Prise en main d’OpenSSH pour Windows', '/windows-server/administration/openssh/openssh_install_firstuse'), src('Add-WindowsCapability', '/powershell/module/dism/add-windowscapability')],
  }),
];
