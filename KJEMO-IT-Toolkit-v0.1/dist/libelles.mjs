/**
 * libelles.mjs — LOT 1B · KJEMO IT Toolkit
 * -----------------------------------------------
 * Préparation à la traduction des LIBELLÉS D'INTERFACE.
 *
 * Ce module ne traduit rien aujourd'hui : une seule langue est déclarée, le
 * français, et c'est délibéré. Afficher un sélecteur de langue alors que les
 * procédures, les commandes, les prérequis et les messages d'erreur des outils
 * sont en français produirait une interface à moitié anglaise — pire qu'une
 * interface unilingue assumée. La traduction technique complète est un lot à
 * part entière.
 *
 * Ce qui est préparé ici : les libellés d'interface passent par une fonction de
 * résolution unique. Ajouter une langue consistera à ajouter une entrée à
 * LANGUES et un dictionnaire, sans toucher au code d'affichage.
 *
 * Aucun contenu technique d'outil ne doit entrer dans ce fichier : les
 * procédures, commandes et messages d'erreur appartiennent à generators.mjs.
 */

export const LANGUE_DEFAUT = 'fr';

/** Langues réellement complètes. Une langue partielle n'y figure pas. */
export const LANGUES = [
  { id: 'fr', label: 'Français' },
];

/** Libellés d'interface. Clé stable, valeur affichée. */
export const LIBELLES = {
  fr: {
    'accueil.titre': 'Résoudre un problème Windows, pas à pas.',
    'accueil.categories': 'Catégories',
    'accueil.outils': 'Outils',
    'accueil.tousLesOutils': 'Tous les outils',
    'recherche.etiquette': 'Rechercher un outil ou un message d’erreur',
    'recherche.effacer': 'Effacer la recherche',
    'recherche.aucunResultat': 'Aucun outil ne correspond',
    'raccourcis.favoris': 'Favoris',
    'raccourcis.recents': 'Consultés récemment',
    'mode.groupe': 'Mode de lecture',
    'mode.debutant': 'Débutant',
    'mode.technicien': 'Technicien',
    'theme.groupe': 'Thème',
    'theme.clair': 'Clair',
    'theme.sombre': 'Sombre',
    'theme.systeme': 'Système',
    'fiche.probleme': 'Problème et objectif',
    'fiche.risque': 'Risque, compatibilité et prérequis',
    'fiche.formulaire': 'Tes informations',
    'fiche.script': 'Script généré',
    'fiche.verification': 'Vérifier que ça a fonctionné',
    'fiche.annulation': 'Revenir en arrière',
    'fiche.graphique': 'Méthode graphique',
    'fiche.erreurs': 'Erreurs fréquentes',
    'fiche.sources': 'Sources officielles',
    'action.generer': 'Générer le script',
    'action.copier': 'Copier',
    'action.telecharger': 'Télécharger .ps1',
    'action.retour': '← Tous les outils',
  },
};

/**
 * Résout un libellé d'interface.
 *
 * Une clé absente retourne la clé elle-même : l'oubli devient visible à
 * l'écran plutôt que de produire un trou silencieux. Une langue inconnue
 * retombe sur le français.
 */
export function libelle(cle, langue = LANGUE_DEFAUT) {
  const dictionnaire = LIBELLES[langue] ?? LIBELLES[LANGUE_DEFAUT];
  return dictionnaire[cle] ?? LIBELLES[LANGUE_DEFAUT][cle] ?? cle;
}

/** Vrai si la langue est déclarée complète. Sert à ne proposer que celles-là. */
export function langueDisponible(id) {
  return LANGUES.some((l) => l.id === id);
}
