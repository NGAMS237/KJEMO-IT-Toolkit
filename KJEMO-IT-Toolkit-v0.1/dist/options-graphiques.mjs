/**
 * options-graphiques.mjs — KJEMO-RECONSTRUIRE-01 · KJEMO IT Toolkit
 * Ajoute l'OPTION GRAPHIQUE à des fiches qui n'avaient que des commandes. Appliqué dans taches.mjs.
 * Idempotent. Les libellés de fenêtres Windows ne sont pas vérifiés sur un poste réel.
 */
import { gui } from './cours-outils.mjs';

const OPTIONS = {
  'win-ad-joindre-domaine': {
    resumeAjout: ' Option graphique : sysdm.cpl.',
    methode: () => ({
      id: 'gui', privileges: 'Administrateur local du poste ; un compte du domaine autorisé à joindre des ordinateurs ; DNS du poste vers le contrôleur.',
      etapes: [
        gui('Ouvrir les propriétés système', 'lecture', 'sysdm.cpl ouvre l’onglet « Nom de l’ordinateur ».', ['Appuie sur **Windows + R**, tape **sysdm.cpl**, puis **Entrée**.', 'Onglet **Nom de l’ordinateur**, bouton **Modifier…**.'], 'La fenêtre « Modification du nom ou du domaine de l’ordinateur » s’affiche.'),
        gui('Joindre le domaine', 'interruption', 'Une fenêtre demande un compte du domaine autorisé : saisis-le dans la fenêtre, jamais dans un fichier.', ['Dans **Membre de**, coche **Domaine** et saisis le nom du domaine.', 'Clique **OK** ; saisis le nom et le mot de passe du compte autorisé.', 'Un message « Bienvenue dans le domaine » s’affiche : clique **OK**, puis redémarre quand Windows le demande.'], 'Message de bienvenue dans le domaine, puis redémarrage.', { important: 'Si Windows dit que le domaine est introuvable, le DNS du poste est faux : fiche « Régler le DNS d’un poste Windows ».' }),
        gui('Variante : Paramètres de Windows 11', 'interruption', 'Même résultat, autre chemin (Windows 11 Pro ou Entreprise).', ['**Paramètres › Comptes › Accès professionnel ou scolaire › Connecter**, puis **Joindre cet appareil à un domaine Active Directory local**.', 'Saisis le nom du domaine, puis le compte autorisé.'], 'Le poste demande un redémarrage.', { facultatif: true }),
        gui('Vérifier la jonction', 'lecture', 'Après le redémarrage, l’écran de connexion propose le domaine.', ['Rouvre **sysdm.cpl** : le champ **Domaine** affiche le nom du domaine.', 'Ouvre une session avec un compte du domaine (NOM\\compte).'], 'Le domaine est affiché et la session s’ouvre.', { verification: true }),
        gui('Annuler — sortir le poste du domaine', 'interruption', 'Même fenêtre : on repasse en groupe de travail. Le compte ordinateur reste dans l’annuaire jusqu’à son nettoyage.', ['**sysdm.cpl › Nom de l’ordinateur › Modifier…**', 'Coche **Groupe de travail**, saisis **WORKGROUP**, **OK**, saisis un compte autorisé si Windows le demande, puis redémarre.'], 'Le poste redémarre en groupe de travail.', { facultatif: true, annulation: true, phase: 'Annuler ou défaire' }),
      ],
      verification: ['sysdm.cpl affiche le domaine et un compte du domaine ouvre une session.'],
      retour: 'Modifier › Groupe de travail dans sysdm.cpl.',
    }),
  },
  'cours-rsat-windows': {
    resumeAjout: ' Option graphique : Fonctionnalités facultatives (Windows 10/11) ou Gestionnaire de serveur (Windows Server).',
    methode: () => ({
      id: 'gui', privileges: 'Compte administrateur local, accès Internet (Windows Update). Les libellés exacts varient selon la version de Windows et ne sont pas vérifiés ici.',
      etapes: [
        gui('Ouvrir les fonctionnalités facultatives (Windows 11)', 'lecture', 'Les outils RSAT sont des « fonctionnalités facultatives » de Windows 10 et 11.', ['**Paramètres › Système › Fonctionnalités facultatives** (Windows 10 : **Paramètres › Applications › Fonctionnalités facultatives**).', 'Clique **Afficher les fonctionnalités** (ou **Ajouter une fonctionnalité**).'], 'La liste des fonctionnalités à ajouter s’affiche.'),
        gui('Choisir et installer les outils AD et DNS', 'modification', 'Cherche « RSAT » : coche les deux outils utiles à Samba AD.', ['Dans la recherche, tape **RSAT**.', 'Coche **RSAT : Outils des services de domaine Active Directory et des services AD LDS** et **RSAT : Outils du serveur DNS**.', 'Clique **Suivant**, puis **Ajouter** ; attends la fin de l’installation (plusieurs minutes).'], 'Les deux outils apparaissent dans la liste des fonctionnalités installées.'),
        gui('Variante : Windows Server (Gestionnaire de serveur)', 'modification', 'Sur Windows Server, les mêmes outils sont des fonctionnalités du serveur.', ['**Gestionnaire de serveur › Gérer › Ajouter des rôles et fonctionnalités**, puis **Suivant** jusqu’à **Fonctionnalités**.', 'Déroule **Outils d’administration de serveur distant › Outils d’administration de rôles** et coche **Outils AD DS et AD LDS** et **Outils du serveur DNS**, puis **Installer**.'], 'L’assistant affiche « Installation réussie ».'),
        gui('Vérifier que les consoles s’ouvrent', 'lecture', 'dsa.msc et dnsmgmt.msc sont les consoles installées.', ['Appuie sur **Windows + R**, tape **dsa.msc**, puis **Entrée** : « Utilisateurs et ordinateurs Active Directory » s’ouvre.', 'Refais avec **dnsmgmt.msc** : le Gestionnaire DNS s’ouvre.'], 'Les deux consoles s’ouvrent.', { verification: true }),
        gui('Annuler — désinstaller les outils', 'modification', 'Retire les fonctionnalités ajoutées ; les comptes du domaine ne sont pas touchés.', ['**Paramètres › Système › Fonctionnalités facultatives**, liste **Fonctionnalités installées**, cherche **RSAT**.', 'Clique sur chaque outil, puis **Désinstaller**.'], 'Les outils RSAT disparaissent de la liste.', { facultatif: true, annulation: true, phase: 'Annuler ou défaire' }),
      ],
      verification: ['dsa.msc et dnsmgmt.msc s’ouvrent.'],
      retour: 'Fonctionnalités facultatives › RSAT › Désinstaller.',
    }),
  },
};

export function completerOptionsGraphiques(procedure) {
  const o = OPTIONS[procedure?.id];
  if (!o || procedure.methodes.some((m) => m.id === 'gui')) return procedure;
  procedure.methodes = [o.methode(), ...procedure.methodes];
  if (o.resumeAjout && !procedure.resume.includes(o.resumeAjout.trim())) procedure.resume += o.resumeAjout;
  return procedure;
}
