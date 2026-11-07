/**
 * azure-multi.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Ajoute à chaque fiche Azure les méthodes « Interface graphique » (portail,
 * avec illustrations) et « PowerShell » (module Az), à côté de la méthode
 * « azure » (Azure CLI) déjà écrite. Un registre par groupe de fiches :
 *   { [idFiche]: { gui: { privileges, etapes, verification, retour },
 *                  powershell: { privileges, etapes, verification, retour } } }
 * Les onglets s'affichent dans l'ordre débutant : GUI, PowerShell, CLI.
 * Les étapes sont numérotées PAR méthode (les cours visent la CLI).
 */
import { MULTI_BASE } from './azure-multi-base.mjs';
import { MULTI_RESEAU } from './azure-multi-reseau.mjs';
import { MULTI_ROUTAGE } from './azure-multi-routage.mjs';
import { MULTI_APP } from './azure-multi-app.mjs';
import { MULTI_LB } from './azure-multi-lb.mjs';

export const MULTI_AZURE = { ...MULTI_BASE, ...MULTI_RESEAU, ...MULTI_ROUTAGE, ...MULTI_APP, ...MULTI_LB };

const NOTE_MULTI = ' Méthodes « Interface graphique » et « PowerShell » (module Az) : rédigées d’après la documentation et notre connaissance des outils, NON exécutées dans un abonnement Azure ; les écrans sont des reconstitutions schématiques, pas des captures. Vérifie les noms d’options avec Get-Help ou le portail.';
const ORDRE = ['gui', 'powershell', 'azure'];

/** Retourne les procédures avec leurs méthodes GUI et PowerShell ajoutées (les autres sont inchangées). */
export function completerAzure(procedures) {
  return procedures.map((p) => {
    const extra = MULTI_AZURE[p.id];
    if (!extra) return p;
    const methodes = [...p.methodes];
    for (const id of ['gui', 'powershell']) if (extra[id] && !methodes.some((m) => m.id === id)) methodes.push({ id, ...extra[id] });
    methodes.sort((a, b) => ORDRE.indexOf(a.id) - ORDRE.indexOf(b.id));
    return { ...p, methodes, validation: `${p.validation ?? ''}${NOTE_MULTI}` };
  });
}
