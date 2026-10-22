// ===========================================================================
// LOT 9 — Imprimantes : jeux de valeurs et scénarios communs aux bancs.
//
// Tout ce qui est ici est inventé pour le banc. Aucun nom, aucune adresse
// n'est celui d'un équipement réel ; les adresses sont dans les plages privées
// ou de documentation, et les noms sont ceux des exemples des fiches.
// ===========================================================================

import { hostname } from 'node:os';

export const NOM_IMPRIMANTE = 'HP LaserJet Accueil';
export const PILOTE = 'Microsoft IPP Class Driver';
export const HOTE = '192.168.30.50';
export const UNC = '\\\\192.168.30.60\\Compta';

export const IMPRIMANTE = Object.freeze({
  Name: NOM_IMPRIMANTE, DriverName: PILOTE, PortName: `IP_${HOTE}`, Type: 'Local',
  PrinterStatus: 'Normal', Shared: false, ShareName: '', ComputerName: '', Published: false,
  Default: false,
});
export const TRAVAIL = Object.freeze({
  ID: 1, PrinterName: NOM_IMPRIMANTE, JobStatus: 'Normal', UserName: 'labo',
  DocumentName: 'document.pdf', TotalPages: 2,
  // Un travail RÉCENT : un travail ancien est signalé « possiblement bloqué » par le diagnostic.
  SubmittedTime: new Date(Date.now() - 60_000).toISOString(),
});
export const PORT = Object.freeze({ Name: `IP_${HOTE}`, PrinterHostAddress: HOTE, PortNumber: 9100, Description: 'Standard TCP/IP Port' });

/** Scénario nominal : une imprimante, un travail, un port, un pilote, un spouleur sain. */
export function scenarioNominal(extra = {}) {
  return {
    admin: true,
    user: 'KJEMO\\labo',
    printers: [{ ...IMPRIMANTE }],
    jobs: [{ ...TRAVAIL }],
    ports: [{ ...PORT }],
    drivers: [{ Name: PILOTE }],
    service: { Name: 'Spooler', Status: 'Running', StartType: 'Automatic', DependentServices: [] },
    events: [],
    spoolFiles: [],
    tcp: 'OUVERT',
    defaultPrinter: NOM_IMPRIMANTE,
    ...extra,
  };
}

/** Valeurs par défaut d'une fiche. */
export const defauts = (t) => Object.fromEntries(t.fields.map((f) => [f.id, String(f.default ?? '')]));

/** Phrase de confirmation exacte, lue dans le message de validation de la fiche elle-même. */
export function phraseDe(t, v) {
  const e = t.validate({ ...v, impMode: 'Appliquer', impConfirmation: '' }).impConfirmation ?? '';
  const m = /« (.+?) »/.exec(e);
  return m ? m[1] : null;
}

/** Valeurs complètes pour un mode donné ; en Appliquer, la phrase exacte est ajoutée. */
export function valeurs(t, { mode = 'Diagnostic', extra = {}, confirmation } = {}) {
  const v = { ...defauts(t), ...extra };
  if (t.fields.some((f) => f.id === 'impMode')) {
    v.impMode = mode;
    if (confirmation !== undefined) v.impConfirmation = confirmation;
    else v.impConfirmation = mode === 'Appliquer' ? (phraseDe(t, v) ?? '') : '';
  }
  return v;
}

/** Nom de la machine d'exécution, utilisable comme valeur du champ impMachine (sinon null). */
export function machineLocale() {
  const h = hostname();
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,14}$/.test(h) ? h : null;
}

/** Valeurs et scénario nominaux pour chaque assistant Windows. */
export function cas(t) {
  switch (t.id) {
    case 'imp-win-config-reseau':
      return { extra: {}, scenario: scenarioNominal({ printers: [], jobs: [], ports: [] }) };
    case 'imp-win-connexion-partage':
      return {
        extra: { impUnc: UNC },
        // Une connexion de file partagée est propre au COMPTE : console NON élevée.
        scenario: scenarioNominal({
          admin: false, printers: [], jobs: [], ports: [],
          remotePrinters: [{ Name: 'Compta', ShareName: 'Compta', DriverName: PILOTE, Shared: true, ComputerName: 'srv-print', PortName: 'IP_192.168.30.60', Type: 'Local', PrinterStatus: 'Normal' }],
        }),
      };
    case 'imp-win-defaut':
      return {
        extra: {},
        scenario: scenarioNominal({
          printers: [{ ...IMPRIMANTE }, { ...IMPRIMANTE, Name: 'Compta Etage 2', PortName: 'IP_192.168.30.60' }],
          defaultPrinter: 'Compta Etage 2',
        }),
      };
    case 'imp-win-spouleur-redemarrer':
      return { extra: { impMachine: machineLocale() ?? 'PC-ACCUEIL-01' }, scenario: scenarioNominal() };
    case 'imp-win-partage-unc':
      return { extra: { impUnc: UNC }, scenario: scenarioNominal({ admin: false, remotePrinters: [{ Name: 'Compta', ShareName: 'Compta', DriverName: PILOTE, Shared: true, ComputerName: '192.168.30.60', PortName: 'IP_192.168.30.61', Type: 'Local', PrinterStatus: 'Normal' }] }) };
    case 'imp-win-reseau':
    default:
      return { extra: {}, scenario: scenarioNominal() };
  }
}
