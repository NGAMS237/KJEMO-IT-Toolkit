/**
 * preferences.mjs — LOT 1B · KJEMO IT Toolkit
 * -----------------------------------------------
 * Préférences d'interface persistantes : mode de lecture (Débutant /
 * Technicien) et, plus tard, thème.
 *
 * Deux règles gouvernent ce module :
 *
 *  1. La valeur courante vit EN MÉMOIRE. localStorage ne sert qu'à la
 *     retrouver au prochain chargement. Si le stockage est bloqué (navigation
 *     privée, cookies tiers refusés, politique d'entreprise), le sélecteur
 *     continue de fonctionner pour la session — il oublie simplement le choix
 *     à la fermeture de l'onglet. Une préférence d'affichage ne doit jamais
 *     pouvoir casser l'application.
 *
 *  2. Toute valeur relue est validée contre la liste des valeurs admises.
 *     Une clé corrompue ou héritée d'une version précédente retombe sur le
 *     défaut au lieu de mettre l'interface dans un état impossible.
 *
 * Ce module ne contient aucun contenu technique d'outil.
 */

export const CLE_MODE = 'kjemo.mode.v1';

/** Modes de lecture. Le même générateur de script sert les deux. */
export const MODES = [
  {
    id: 'debutant',
    label: 'Débutant',
    description: 'Explications en langage courant, étape par étape.',
  },
  {
    id: 'technicien',
    label: 'Technicien',
    description: 'Détail technique, commandes et sources officielles.',
  },
];

export const MODE_DEFAUT = 'debutant';

/** Vrai si l'identifiant correspond à un mode connu. */
export function estMode(valeur) {
  return MODES.some((m) => m.id === valeur);
}

/**
 * Crée une préférence persistante tolérante au stockage indisponible.
 *
 * Retourne un petit objet plutôt qu'une paire de fonctions libres : l'état
 * mémoire reste encapsulé, et personne ne peut le contourner par erreur.
 */
export function creerPreference({ cle, valeurs, defaut }) {
  if (!valeurs.includes(defaut)) {
    throw new Error(`preference ${cle} : le défaut n'est pas une valeur admise`);
  }

  const valide = (v) => (valeurs.includes(v) ? v : null);

  let courante = defaut;
  let persistante = false;

  // Lecture initiale — protégée : localStorage peut lancer à l'accès même.
  try {
    const relue = valide(localStorage.getItem(cle));
    if (relue) courante = relue;
    persistante = true;
  } catch {
    persistante = false;
  }

  return {
    /** Valeur courante, toujours valide. */
    lire() {
      return courante;
    },
    /**
     * Change la valeur. Retourne la valeur réellement appliquée : une valeur
     * inconnue est ignorée, pas appliquée silencieusement.
     */
    definir(v) {
      const propre = valide(v);
      if (!propre) return courante;
      courante = propre;
      try {
        localStorage.setItem(cle, propre);
        persistante = true;
      } catch {
        persistante = false;
      }
      return courante;
    },
    /** Vrai si le choix survivra au rechargement. */
    estPersistante() {
      return persistante;
    },
  };
}
