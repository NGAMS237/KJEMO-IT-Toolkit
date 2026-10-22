/**
 * categories.mjs — LOT 1B · KJEMO IT Toolkit
 * -----------------------------------------------
 * Catalogue CANONIQUE des catégories : nom, icône sobre, courte description.
 *
 * Ce module ne contient AUCUN contenu technique d'outil. Il décrit uniquement
 * la façon dont les outils sont regroupés et présentés.
 *
 * Les huit catégories ci-dessous sont celles de la feuille de route, dans son
 * ordre. Elles sont toutes déclarées ; seules celles qui contiennent au moins
 * un outil sont AFFICHÉES. Une catégorie vide à l'écran est une promesse non
 * tenue ; une catégorie absente du code serait une architecture à refaire au
 * prochain outil.
 *
 * `name` est la clé de rapprochement : il doit correspondre exactement au
 * champ `category` des outils dans generators.mjs. La sous-rubrique
 * (`subcategory`) vient elle aussi de l'outil : c'est un rangement à
 * l'intérieur d'une catégorie, pas un second niveau de navigation.
 */

export const CATEGORIES = [
  {
    id: 'poste-windows',
    name: 'Poste de travail Windows',
    icon: '▣',
    description: 'Le poste de l’utilisateur : périphériques, mises à jour, performance, comptes, sécurité, réparation et stockage.',
  },
  {
    id: 'analyse-disques',
    name: 'Analyse et nettoyage des disques',
    icon: '▧',
    description: 'Occupation de l’espace, gros fichiers et artefacts récupérables.',
  },
  {
    id: 'windows-server',
    name: 'Windows Server',
    icon: '▨',
    description: 'Rôles serveur : partages, serveur de fichiers, services.',
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
    id: 'reseau',
    name: 'Réseau',
    icon: '◈',
    description: 'Adressage, passerelle, DNS et connectivité.',
  },
  {
    id: 'imprimantes',
    name: 'Imprimantes',
    icon: '▩',
    description: 'Files d’attente, pilotes et serveurs d’impression.',
  },
  {
    id: 'linux',
    name: 'Linux et services réseau',
    icon: '△',
    description: 'Ubuntu et Debian : diagnostic, Bash, permissions, services, réseau, SSH, Cockpit, Samba, NFS et stockage.',
  },
];

/**
 * Sous-rubriques canoniques de « Linux et services réseau », dans l'ordre
 * d'affichage voulu.
 *
 * Cet ordre n'est pas alphabétique : il suit la façon dont on dépanne. On
 * commence par constater l'état de la machine, puis on outille (Bash), puis on
 * remonte les couches dans l'ordre où elles cassent — permissions, services,
 * réseau — avant d'arriver aux services exposés, qui dépendent tous des
 * précédentes. Le stockage ferme la liste parce qu'il renvoie au LOT 10.
 *
 * Les quatre sujets qui réclameraient une catégorie à eux — SSH, Cockpit,
 * Samba, NFS — restent des SOUS-RUBRIQUES. Une catégorie principale par
 * service produirait une page d'accueil à quinze entrées où l'on ne trouve
 * plus rien ; et aucun de ces services ne se dépanne sans toucher aux
 * permissions, au réseau et aux journaux, qui sont ici.
 */
export const SOUS_RUBRIQUES_LINUX = [
  'Diagnostic Linux',
  'Bash et automatisation',
  'Utilisateurs et permissions',
  'Services et journaux',
  'Réseau Linux',
  'SSH et accès distant',
  'Cockpit',
  'Samba',
  // Nouvelle sous-rubrique canonique du commit 22/n. Samba AD et Samba
  // partage ne se melangent pas : un controleur de domaine fait tourner UN
  // processus « samba » qui contient son propre serveur SMB, et laisser smbd
  // actif a cote donne deux serveurs sur le port 445.
  'Samba AD',
  'NFS',
  'Stockage Linux',
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
 * Sous-rubriques réellement présentes dans une catégorie, sans doublon, avec
 * leur décompte, dans l'ordre du catalogue d'outils.
 */
export function sousRubriques(tools, nom) {
  const vues = new Map();
  for (const t of tools) {
    if (t.category !== nom || !t.subcategory) continue;
    vues.set(t.subcategory, (vues.get(t.subcategory) ?? 0) + 1);
  }
  return [...vues].map(([name, count]) => ({ name, count }));
}

/**
 * Catégories à AFFICHER : uniquement celles qui contiennent au moins un outil,
 * dans l'ordre du catalogue, chacune enrichie de son décompte et de ses
 * sous-rubriques.
 *
 * Une catégorie présente dans les outils mais absente du catalogue est tout de
 * même retournée, avec une icône neutre : mieux vaut l'afficher sans description
 * que la faire disparaître silencieusement de la navigation.
 */
export function categoriesVisibles(tools) {
  const connues = new Set(CATEGORIES.map((c) => c.name));
  const listees = CATEGORIES
    .map((c) => ({ ...c, count: compterOutils(tools, c.name), sous: sousRubriques(tools, c.name) }))
    .filter((c) => c.count > 0);

  const orphelines = [...new Set(tools.map((t) => t.category))]
    .filter((nom) => !connues.has(nom))
    .map((nom) => ({
      id: nom.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: nom,
      icon: '○',
      description: '',
      count: compterOutils(tools, nom),
      sous: sousRubriques(tools, nom),
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
