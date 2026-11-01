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
};

export function completerOptionsGraphiques(procedure) {
  const o = OPTIONS[procedure?.id];
  if (!o || procedure.methodes.some((m) => m.id === 'gui')) return procedure;
  procedure.methodes = [o.methode(), ...procedure.methodes];
  if (o.resumeAjout && !procedure.resume.includes(o.resumeAjout.trim())) procedure.resume += o.resumeAjout;
  return procedure;
}
