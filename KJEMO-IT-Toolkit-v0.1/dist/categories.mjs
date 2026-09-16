/**
 * categories.mjs — LOT 1B · KJEMO IT Toolkit
 * -----------------------------------------------
 * Catalogue des catégories : nom, icône sobre, courte description.
 *
 * Ce module ne contient AUCUN contenu technique d'outil. Il décrit uniquement
 * la façon dont les outils sont regroupés et présentés.
 *
 * Deux natures de catégories cohabitent :
 *   - celles qui contiennent déjà des outils, affichées ;
 *   - celles prévues par la feuille de route, déclarées ici pour que le code
 *     soit prêt à les accueillir, mais MASQUÉES tant qu'elles sont vides.
 *     Une catégorie vide à l'écran est une promesse non tenue.
 *
 * `name` est la clé de rapprochement : il doit correspondre exactement au
 * champ `category` des outils dans generators.mjs.
 */

export const CATEGORIES = [
  // --- Catégories actuellement pourvues -----------------------------------
  {
    id: 'reseau',
    name: 'Réseau',
    icon: '◈',
    description: 'Adressage, passerelle, DNS et connectivité.',
  },
  {
    id: 'depannage-windows',
    name: 'Dépannage Windows',
    icon: '◉',
    description: 'Pannes courantes d’un poste Windows.',
  },
  {
    id: 'active-directory',
    name: 'Active Directory',
    icon: '◇',
    description: 'Comptes, unités d’organisation et contrôleurs de domaine.',
  },
  {
    id: 'gpo',
    name: 'GPO',
    icon: '▤',
    description: 'Stratégies de groupe appliquées au domaine.',
  },
  {
    id: 'fichiers-imprimantes',
    name: 'Fichiers & imprimantes',
    icon: '▥',
    description: 'Partages réseau, droits d’accès et impression.',
  },
  {
    id: 'stockage',
    name: 'Stockage',
    icon: '▦',
    description: 'Occupation disque et analyse d’espace.',
  },

  // --- Catégories prévues, masquées tant qu'aucun outil ne les remplit -----
  // Déclarées pour que la navigation les accueille sans modification de code.
  {
    id: 'windows-poste',
    name: 'Windows poste de travail',
    icon: '▣',
    description: 'Mises à jour, pare-feu, périphériques et intégrité système.',
  },
  {
    id: 'analyse-disques',
    name: 'Analyse et nettoyage des disques',
    icon: '▧',
    description: 'Gros fichiers, doublons et caches à récupérer.',
  },
  {
    id: 'windows-server',
    name: 'Windows Server',
    icon: '▨',
    description: 'Rôles serveur, DNS, DHCP et partages.',
  },
  {
    id: 'imprimantes',
    name: 'Imprimantes',
    icon: '▩',
    description: 'Files d’attente, pilotes et serveurs d’impression.',
  },
  {
    id: 'linux',
    name: 'Linux',
    icon: '△',
    description: 'Debian, Ubuntu, Rocky : réseau, services et permissions.',
  },
];

/** Identifiant technique de la pseudo-catégorie « toutes ». */
export const CATEGORIE_TOUT = 'Tout';

/**
 * Nombre d'outils réellement présents dans une catégorie.
 */
export function compterOutils(tools, nom) {
  if (nom === CATEGORIE_TOUT) return tools.length;
  return tools.filter((t) => t.category === nom).length;
}

/**
 * Catégories à AFFICHER : uniquement celles qui contiennent au moins un outil,
 * dans l'ordre du catalogue, chacune enrichie de son décompte.
 *
 * Une catégorie présente dans les outils mais absente du catalogue est tout de
 * même retournée, avec une icône neutre : mieux vaut l'afficher sans description
 * que la faire disparaître silencieusement de la navigation.
 */
export function categoriesVisibles(tools) {
  const connues = new Set(CATEGORIES.map((c) => c.name));
  const listees = CATEGORIES
    .map((c) => ({ ...c, count: compterOutils(tools, c.name) }))
    .filter((c) => c.count > 0);

  const orphelines = [...new Set(tools.map((t) => t.category))]
    .filter((nom) => !connues.has(nom))
    .map((nom) => ({
      id: nom.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: nom,
      icon: '○',
      description: '',
      count: compterOutils(tools, nom),
      horsCatalogue: true,
    }));

  return [...listees, ...orphelines];
}

/**
 * Catégories déclarées mais encore vides. Elles ne sont pas affichées ;
 * cette fonction existe pour que les tests puissent vérifier qu'aucune
 * catégorie vide ne se glisse dans la navigation.
 */
export function categoriesEnAttente(tools) {
  return CATEGORIES
    .map((c) => ({ ...c, count: compterOutils(tools, c.name) }))
    .filter((c) => c.count === 0);
}

/** Métadonnées d'une catégorie par son nom, ou null. */
export function categorieParNom(nom) {
  return CATEGORIES.find((c) => c.name === nom) ?? null;
}
