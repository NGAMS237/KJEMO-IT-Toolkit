/**
 * cours-outils.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Petits constructeurs partagés par les fiches issues des notes de cours.
 * Aucune logique : ils fabriquent des objets du MÊME modèle que les autres
 * procédures (voir procedures.mjs), pour que le même contrat les vérifie.
 */

export const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';
export const BASH_REF = 'https://www.gnu.org/software/bash/manual/bash.html';
export const CATEGORIE_LINUX = 'Linux et services réseau';

export const V_COURS = 'Commandes relues contre la documentation officielle et recoupées avec les notes de cours ; NON exécutées sur une machine réelle par le Toolkit.';

/** Étape en lecture seule. */
export const lec = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'lecture', explication, lignes, attendu, ...extra });
/** Étape qui modifie. */
export const mod = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'modification', explication, lignes, attendu, ...extra });
/** Étape destructive. */
export const des = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'destructif', explication, lignes, attendu, ...extra });
/** Étape qui peut interrompre un service ou une session. */
export const itr = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'interruption', explication, lignes, attendu, ...extra });

export const sh = (cmd) => ({ invite: '$', cmd });
export const ps = (cmd) => ({ invite: 'PS>', cmd });

/** Fiche à une seule méthode Linux. */
export function ficheLinux({ id, titre, resume, effet, intentions, motsCles, params = [], privileges, etapes, verification, retour = null, sources, cours = null }) {
  return {
    id,
    titre,
    categorie: CATEGORIE_LINUX,
    resume,
    effet,
    intentions,
    motsCles,
    params,
    methodes: [{ id: 'linux', privileges, etapes, verification, retour }],
    assistant: null,
    sources,
    validation: V_COURS,
    origine: 'cours',
    ...(cours ? { cours } : {}),
  };
}
