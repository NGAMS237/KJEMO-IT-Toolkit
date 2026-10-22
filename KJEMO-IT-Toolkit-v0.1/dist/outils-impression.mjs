/**
 * outils-impression.mjs — LOT 9 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le catalogue de la catégorie « Imprimantes » : 15 assistants.
 *
 *   Windows, lecture      5   inventaire, diagnostic de file, spouleur, réseau,
 *                             file partagée
 *   Windows, action       6   configuration réseau, connexion à un partage,
 *                             imprimante par défaut, page de test, annulation
 *                             d'un travail, redémarrage du spouleur
 *   Linux / CUPS          4   inventaire, diagnostic, annulation d'un travail,
 *                             réactivation d'une file
 *
 * L'ordre ci-dessous est l'ordre d'apprentissage : on lit avant d'agir.
 */

import { toolsImpressionLecture } from './outils-impression-win-lecture.mjs';
import { toolsImpressionAction } from './outils-impression-win-action.mjs';
import { toolsImpressionCups } from './outils-impression-cups.mjs';

export const toolsImpression = [
  ...toolsImpressionLecture,
  ...toolsImpressionAction,
  ...toolsImpressionCups,
];
