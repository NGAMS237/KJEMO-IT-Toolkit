/**
 * cours-azure-cli.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * Les étapes d'une fiche sont numérotées PAR méthode. Les fiches Azure ayant
 * maintenant le portail, PowerShell et la CLI, les cours Azure (numérotés sur la
 * CLI) la désignent explicitement : sans cela, l'étape 3 d'un parcours serait
 * cherchée dans la méthode affichée en premier (le portail).
 */
const versRef = (r) => (r.methode ? r : { ...r, methode: 'azure' });
export const versCli = (cours) => cours.map((c) => ({
  ...c,
  parcours: (c.parcours ?? []).map((p) => ({
    ...p,
    prerequis: (p.prerequis ?? []).map(versRef),
    items: (p.items ?? []).map((it) => ({ ...it, refs: (it.refs ?? []).map(versRef) })),
  })),
}));
