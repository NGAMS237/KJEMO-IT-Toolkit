#!/usr/bin/env node
/**
 * generate-ps1.mjs — LOT 0 · KJEMO IT Toolkit
 * -----------------------------------------------
 * Génère les fichiers .ps1 canoniques pour chaque assistant × jeu de données.
 * Utilisé par la CI et par identity.test.mjs.
 *
 * Usage : node test/generate-ps1.mjs
 * Sortie : test/generated/<id>__<dataset>.ps1   (64 fichiers)
 *          test/generated/report.json
 */

import { writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { openSync, readSync, closeSync } from 'node:fs';
import { createHash }                                  from 'node:crypto';
import { dirname, resolve }                               from 'node:path';
import { fileURLToPath, pathToFileURL }                   from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const OUT_DIR   = resolve(ROOT, 'test', 'generated');

const { tools, normalizeScript } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);
const { estBash, extensionDe, plateformeDe } = await import(pathToFileURL(resolve(ROOT, 'dist', 'plateforme.mjs')).href);
const { normalizeScriptSh } = await import(pathToFileURL(resolve(ROOT, 'dist', 'noyau-bash.mjs')).href);

// BOM UTF-8 : requis pour PowerShell 5.1 (lit les fichiers comme UTF-8)
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

// Vider le répertoire avant chaque génération pour éviter les fichiers obsolètes
mkdirSync(OUT_DIR, { recursive: true });
try {
  const existing = readdirSync(OUT_DIR);
  for (const f of existing) {
    if (f.endsWith('.ps1') || f.endsWith('.sh') || f === 'report.json') {
      rmSync(resolve(OUT_DIR, f));
    }
  }
} catch { /* ignore */ }

// ---------------------------------------------------------------------------
// Jeux de données communs (par field.id, overrides)
// ---------------------------------------------------------------------------
const DATASETS = [
  { name: 'default', values: {} },
  {
    name: 'apostrophe-ascii',
    values: {
      // LOT 2 — champs des outils Windows Server
      srvFqdn: "srv-dhcp1.hopitalbn.lan", zoneName: "labo1.hopitalbn.lan", cliTestHost: "www.microsoft.com", healthEvents: "12", reportFormat: "JSON",
      scopeName: "LAN-D'Adam", resName: "poste-o'brien", resDesc: "Poste de D'Arcy", bkFolder: "C:\\Sauvegardes\\D'Adam", bkName: "dhcp-dadam", auditPath: "C:\\Partages\\D'Adam", auditShare: "Donnees-D'Adam", smbUserFilter: "o'brien", leaseFilter: "o'brien", icsInternal: "Ethernet D'Adam", rrasInternal: "Ethernet D'Adam", recName: "srv-dadam", dnsQuery: "srv-dadam.hopitalbn.lan",
      adapter: "Ethernet D'Adam", share: "Données-D'Adam", path: "C:\\Users\\D'Adam",
      firstName: "D'Arcy", lastName: "O'Brien", ou: "Direction-D'Adam",
      domain: 'hopitalbn.lan', group: "GG-D'Adam-RW",
    },
  },
  {
    name: 'apostrophe-typographique',
    values: {
      // LOT 2 — champs des outils Windows Server
      srvFqdn: "srv-dhcp2.hopitalbn.lan", zoneName: "labo2.hopitalbn.lan", cliTestHost: "learn.microsoft.com", healthEvents: "48", reportFormat: "HTML",
      scopeName: "LAN-D\u2019Adam", resName: "poste-d\u2019adam", resDesc: "Poste de D\u2019Arcy \u2014 accueil", bkFolder: "C:\\Sauvegardes\\D\u2019Adam", bkName: "dhcp-typo", auditPath: "C:\\Partages\\D\u2019Adam", auditShare: "Donnees-D\u2019Adam", smbUserFilter: "d\u2019adam", leaseFilter: "d\u2019adam", icsInternal: "Ethernet D\u2019Adam", rrasInternal: "Ethernet D\u2019Adam", recName: "srv-typo", dnsQuery: "srv-typo.hopitalbn.lan",
      adapter: 'Ethernet D\u2019Adam', share: 'Donn\u00e9es-D\u2019Adam',
      path: 'C:\\Users\\D\u2019Adam', firstName: 'D\u2019Arcy', lastName: 'O\u2019Brien',
      ou: 'Direction-D\u2019Adam', domain: 'hopitalbn.lan', group: 'GG-D\u2019Adam-RW',
    },
  },
  {
    name: 'dollar-backtick-guillemets',
    values: {
      // LOT 2 — champs des outils Windows Server
      srvFqdn: "srv-dhcp3.hopitalbn.lan", zoneName: "labo3.hopitalbn.lan", cliTestHost: "docs.microsoft.com", healthEvents: "6", reportFormat: "CSV",
      scopeName: "LAN $special", resName: "poste`test", resDesc: "Bureau \"Direction\" $special", bkFolder: "C:\\Sauvegardes\\Test$", bkName: "dhcp-special", auditPath: "C:\\Partages\\Test$", auditShare: "Partage$special", smbUserFilter: "test$", leaseFilter: "$test", icsInternal: "Ethernet $special", rrasInternal: "Ethernet $special", recName: "srv-special", dnsQuery: "srv-special.hopitalbn.lan",
      adapter: 'Ethernet $special', share: 'Share`Test', path: 'C:\\Users\\Test"Dir',
      firstName: 'Jean-$special', lastName: 'Tremblay`test', ou: 'Test-Special',
      domain: 'hopitalbn.lan', group: 'GG-Test-RW',
    },
  },
  {
    name: 'espaces-et-accents',
    values: {
      // LOT 2 — champs des outils Windows Server
      srvFqdn: "srv-comptabilite.hopitalbn.lan", zoneName: "comptabilite.hopitalbn.lan", cliTestHost: "www.microsoft.com", healthEvents: "72", reportFormat: "JSON",
      scopeName: "R\u00e9seau \u00c9l\u00e9onore", resName: "poste-\u00e9l\u00e9onore", resDesc: "Comptabilit\u00e9 \u2014 poste fixe", bkFolder: "C:\\Sauvegardes\\Comptabilit\u00e9", bkName: "dhcp-comptabilite", auditPath: "C:\\Partages\\Comptabilit\u00e9", auditShare: "Donn\u00e9es \u00c9l\u00e9onore", smbUserFilter: "\u00e9l\u00e9onore", leaseFilter: "\u00e9l\u00e9onore", icsInternal: "Adaptateur r\u00e9seau interne", rrasInternal: "Adaptateur r\u00e9seau interne", recName: "srv-comptabilite", dnsQuery: "srv-comptabilite.hopitalbn.lan",
      adapter: 'Adaptateur Wi-Fi', share: 'Données Éléonore',
      path: 'C:\\Users\\L\u00e9vesque-Tr\u00e9panier', firstName: '\u00c9l\u00e9onore',
      lastName: 'L\u00e9vesque-Tr\u00e9panier', ou: 'Bureau \u00c9l\u00e9vation',
      domain: 'hopitalbn.lan', group: 'GG-Comptabilit\u00e9-RW',
    },
  },
  {
    name: 'virgule-et-point-virgule',
    values: {
      // LOT 2 — champs des outils Windows Server
      srvFqdn: "srv-dhcp4.hopitalbn.lan", zoneName: "labo4.hopitalbn.lan", cliTestHost: "azure.microsoft.com", healthEvents: "168", reportFormat: "Console",
      scopeName: "LAN,30;test", resName: "poste,accueil", resDesc: "Accueil; rez-de-chauss\u00e9e", bkFolder: "C:\\Sauvegardes\\DHCP,2026", bkName: "dhcp-2026", auditPath: "C:\\Partages\\Donnees,2026", auditShare: "Donnees;2026", smbUserFilter: "a,b", leaseFilter: "192.168.30.", icsInternal: "Ethernet,1", rrasInternal: "Ethernet,1", recName: "srv-virgule", dnsQuery: "srv-virgule.hopitalbn.lan",
      adapter: 'Ethernet,1', share: 'Partage;Test', path: 'C:\\Data,files;here',
      firstName: 'Marie,Anne', lastName: 'Tr;emblay', ou: 'Test,OU',
      domain: 'hopitalbn.lan', group: 'GG-Test,RW',
    },
  },
  {
    name: 'chemin-racine-c',
    values: {
      // LOT 2 — champs des outils Windows Server
      srvFqdn: "srv-racine.hopitalbn.lan", zoneName: "racine.hopitalbn.lan", cliTestHost: "www.microsoft.com", healthEvents: "1", reportFormat: "HTML",
      scopeName: "LAN-Racine", resName: "poste-racine", resDesc: "Racine du volume", bkFolder: "C:\\DHCP", bkName: "racine", auditPath: "C:\\Partages", auditShare: "RacineC", smbUserFilter: "", leaseFilter: "", icsInternal: "Ethernet", rrasInternal: "Ethernet", recName: "@", dnsQuery: "hopitalbn.lan",
      path: 'C:\\', share: 'RacineC',
      adapter: 'Ethernet', firstName: 'Marie', lastName: 'Tremblay',
      ou: 'Employes', domain: 'hopitalbn.lan', group: 'GG-Test-RW',
    },
  },
  {
    name: 'chemin-avec-apostrophe',
    values: {
      // LOT 2 — champs des outils Windows Server
      srvFqdn: "srv-obrien.hopitalbn.lan", zoneName: "obrien.hopitalbn.lan", cliTestHost: "support.microsoft.com", healthEvents: "24", reportFormat: "CSV",
      scopeName: "LAN-O'Brien", resName: "poste-o'brien-2", resDesc: "Bureau d'O'Brien", bkFolder: "C:\\Sauvegardes\\O'Brien\\DHCP", bkName: "dhcp-obrien", auditPath: "C:\\Users\\O'Brien\\Documents", auditShare: "OBrien", smbUserFilter: "o'b", leaseFilter: "00-15", icsInternal: "Ethernet O'Brien", rrasInternal: "Ethernet O'Brien", recName: "srv-obrien", dnsQuery: "srv-obrien.hopitalbn.lan",
      path: "C:\\Users\\O'Brien\\Documents", share: 'OBrien',
      adapter: 'Ethernet', firstName: 'Marie', lastName: "O'Brien",
      ou: 'Employes', domain: 'hopitalbn.lan', group: 'GG-Test-RW',
    },
  },
];

// ---------------------------------------------------------------------------
// LOT 4 — valeurs GPO pour les huit jeux de données.
//
// Sans ces valeurs, les dix-huit assistants GPO produisaient huit fichiers
// rigoureusement identiques : les jeux de données ne testaient rien. Chaque
// jeu porte maintenant ses propres apostrophes, accents, signes de dollar,
// virgules et chemins. Le champ « mode » n'est volontairement PAS surchargé
// ici : il est partagé avec les assistants des lots précédents, et le forcer
// à Appliquer changerait leurs scripts figés. Les branches d'écriture sont
// couvertes séparément, par les assertions de generate() en mode Appliquer.
// ---------------------------------------------------------------------------
const VALEURS_GPO = {
  "apostrophe-ascii": {
    "gpoDomain": "dadam.hopitalbn.lan",
    "invRecent": "7",
    "invFormat": "JSON",
    "sanGpoJours": "3",
    "sanGpoFormat": "JSON",
    "rsopCible": "PC-DADAM",
    "rsopUtilisateur": "",
    "rsopPortee": "Ordinateur",
    "rsopFormat": "HTML",
    "majPortee": "Utilisateur",
    "majForce": "Non",
    "crNomGpo": "GPO-D'Adam-Verrouillage",
    "crOu": "Médecin",
    "crEtatLien": "Inactive",
    "crOrdre": "2",
    "crApplique": "Non",
    "auOu": "",
    "auVue": "Directs",
    "auFormat": "JSON",
    "fsNomGpo": "GPO-D'Adam-Verrouillage",
    "fsGroupe": "GG-D'Adam-RW",
    "wmiRequete": "SELECT * FROM Win32_OperatingSystem WHERE ProductType = 3",
    "wmiEspace": "root\\CIMv2",
    "wmiNom": "Serveurs seulement dadam",
    "wmiFormat": "JSON",
    "dmLettre": "Q:",
    "dmChemin": "\\\\srv-fichiers\\Partage-D'Adam",
    "dmLibelle": "Partage dadam",
    "dmGroupe": "GG-D'Adam-RW",
    "dmAction": "Create",
    "dmFormat": "JSON",
    "imType": "Partagee",
    "imServeur": "srv-impression",
    "imPartage": "HP-dadam",
    "imGroupe": "GG-D'Adam-RW",
    "imFormat": "JSON",
    "scType": "Demarrage",
    "scChemin": "\\\\dadam.hopitalbn.lan\\SYSVOL\\dadam.hopitalbn.lan\\scripts",
    "scFichier": "demarrage-dadam.ps1",
    "scFormat": "JSON",
    "frDossier": "Bureau",
    "frRacine": "\\\\srv-fichiers\\Partage-D'Adam",
    "frGroupe": "GG-D'Adam-RW",
    "frDeplacer": "Non",
    "frFormat": "JSON",
    "vbNomGpo": "GPO-D'Adam-Verrouillage",
    "vbInactivite": "10",
    "vbFond": "\\\\srv-fichiers\\Images\\fond-d'adam.jpg",
    "drNomGpo": "GPO-D'Adam-Verrouillage",
    "drNiveau": "Audit",
    "fdRegles": "10",
    "fdFormat": "JSON",
    "wuNomGpo": "GPO-D'Adam-Verrouillage",
    "wuCible": "Serveurs",
    "wuReport": "14",
    "wuDebutActif": "8",
    "wuFinActif": "18",
    "slNomGpo": "GPO-D'Adam-Verrouillage",
    "slMsi": "\\\\srv-fichiers\\Paquets\\outil-d'adam.msi",
    "slRaccourci": "\\\\srv-fichiers\\Partage-D'Adam",
    "slNavigateur": "Edge",
    "slPageDemarrage": "https://intranet.hopitalbn.lan/accueil",
    "brNomGpo": "GPO-D'Adam-Verrouillage",
    "brDossier": "\\\\srv-fichiers\\Partage-D'Adam",
    "brAction": "Comparer",
    "brIdSauvegarde": "",
    "brConfirmation": ""
  },
  "apostrophe-typographique": {
    "gpoDomain": "typo.hopitalbn.lan",
    "invRecent": "14",
    "invFormat": "HTML",
    "sanGpoJours": "5",
    "sanGpoFormat": "HTML",
    "rsopCible": "PC-TYPO",
    "rsopUtilisateur": "dadam",
    "rsopPortee": "Utilisateur",
    "rsopFormat": "JSON",
    "majPortee": "Ordinateur",
    "majForce": "Oui",
    "crNomGpo": "GPO-D’Adam-Verrouillage",
    "crOu": "Médecin",
    "crEtatLien": "Inactive",
    "crOrdre": "2",
    "crApplique": "Non",
    "auOu": "",
    "auVue": "Complete",
    "auFormat": "HTML",
    "fsNomGpo": "GPO-D’Adam-Verrouillage",
    "fsGroupe": "GG-D’Adam-RW",
    "wmiRequete": "SELECT * FROM Win32_OperatingSystem WHERE ProductType = 3",
    "wmiEspace": "root\\CIMv2",
    "wmiNom": "Serveurs seulement typo",
    "wmiFormat": "JSON",
    "dmLettre": "Q:",
    "dmChemin": "\\\\srv-fichiers\\Partage-D’Adam",
    "dmLibelle": "Partage typo",
    "dmGroupe": "GG-D’Adam-RW",
    "dmAction": "Create",
    "dmFormat": "JSON",
    "imType": "Partagee",
    "imServeur": "srv-impression",
    "imPartage": "HP-typo",
    "imGroupe": "GG-D’Adam-RW",
    "imFormat": "JSON",
    "scType": "Demarrage",
    "scChemin": "\\\\typo.hopitalbn.lan\\SYSVOL\\typo.hopitalbn.lan\\scripts",
    "scFichier": "demarrage-typo.ps1",
    "scFormat": "JSON",
    "frDossier": "Bureau",
    "frRacine": "\\\\srv-fichiers\\Partage-D’Adam",
    "frGroupe": "GG-D’Adam-RW",
    "frDeplacer": "Non",
    "frFormat": "JSON",
    "vbNomGpo": "GPO-D’Adam-Verrouillage",
    "vbInactivite": "10",
    "vbFond": "\\\\srv-fichiers\\Images\\fond-d’adam.jpg",
    "drNomGpo": "GPO-D’Adam-Verrouillage",
    "drNiveau": "Audit",
    "fdRegles": "20",
    "fdFormat": "HTML",
    "wuNomGpo": "GPO-D’Adam-Verrouillage",
    "wuCible": "Serveurs",
    "wuReport": "14",
    "wuDebutActif": "8",
    "wuFinActif": "18",
    "slNomGpo": "GPO-D’Adam-Verrouillage",
    "slMsi": "\\\\srv-fichiers\\Paquets\\outil-d’adam.msi",
    "slRaccourci": "\\\\srv-fichiers\\Partage-D’Adam",
    "slNavigateur": "Edge",
    "slPageDemarrage": "https://intranet.hopitalbn.lan/accueil",
    "brNomGpo": "GPO-D’Adam-Verrouillage",
    "brDossier": "\\\\srv-fichiers\\Partage-D’Adam",
    "brAction": "Comparer",
    "brIdSauvegarde": "",
    "brConfirmation": ""
  },
  "dollar-backtick-guillemets": {
    "gpoDomain": "special.hopitalbn.lan",
    "invRecent": "21",
    "invFormat": "CSV",
    "sanGpoJours": "10",
    "sanGpoFormat": "CSV",
    "rsopCible": "PC-SPECIAL",
    "rsopUtilisateur": "testuser",
    "rsopPortee": "Les deux",
    "rsopFormat": "Console",
    "majPortee": "Les deux",
    "majForce": "Non",
    "crNomGpo": "GPO-$special-Verrouillage",
    "crOu": "Médecin",
    "crEtatLien": "Inactive",
    "crOrdre": "2",
    "crApplique": "Non",
    "auOu": "",
    "auVue": "Directs",
    "auFormat": "CSV",
    "fsNomGpo": "GPO-$special-Verrouillage",
    "fsGroupe": "GG-Test-RW",
    "wmiRequete": "SELECT * FROM Win32_OperatingSystem WHERE ProductType = 3",
    "wmiEspace": "root\\CIMv2",
    "wmiNom": "Serveurs $special",
    "wmiFormat": "JSON",
    "dmLettre": "Q:",
    "dmChemin": "\\\\srv-fichiers\\Partage$special",
    "dmLibelle": "Partage \"Direction\" $special",
    "dmGroupe": "GG-Test-RW",
    "dmAction": "Create",
    "dmFormat": "JSON",
    "imType": "Partagee",
    "imServeur": "srv-impression",
    "imPartage": "HP-special",
    "imGroupe": "GG-Test-RW",
    "imFormat": "JSON",
    "scType": "Demarrage",
    "scChemin": "\\\\special.hopitalbn.lan\\SYSVOL\\special.hopitalbn.lan\\scripts",
    "scFichier": "demarrage-special.ps1",
    "scFormat": "JSON",
    "frDossier": "Bureau",
    "frRacine": "\\\\srv-fichiers\\Partage$special",
    "frGroupe": "GG-Test-RW",
    "frDeplacer": "Non",
    "frFormat": "JSON",
    "vbNomGpo": "GPO-$special-Verrouillage",
    "vbInactivite": "10",
    "vbFond": "\\\\srv-fichiers\\Images\\fond`test.jpg",
    "drNomGpo": "GPO-$special-Verrouillage",
    "drNiveau": "Audit",
    "fdRegles": "30",
    "fdFormat": "CSV",
    "wuNomGpo": "GPO-$special-Verrouillage",
    "wuCible": "Serveurs",
    "wuReport": "14",
    "wuDebutActif": "8",
    "wuFinActif": "18",
    "slNomGpo": "GPO-$special-Verrouillage",
    "slMsi": "\\\\srv-fichiers\\Paquets\\outil`test.msi",
    "slRaccourci": "\\\\srv-fichiers\\Partage$special",
    "slNavigateur": "Edge",
    "slPageDemarrage": "https://intranet.hopitalbn.lan/accueil",
    "brNomGpo": "GPO-$special-Verrouillage",
    "brDossier": "\\\\srv-fichiers\\Partage$special",
    "brAction": "Comparer",
    "brIdSauvegarde": "",
    "brConfirmation": ""
  },
  "espaces-et-accents": {
    "gpoDomain": "comptabilite.hopitalbn.lan",
    "invRecent": "60",
    "invFormat": "Console",
    "sanGpoJours": "14",
    "sanGpoFormat": "Console",
    "rsopCible": "PC-COMPTABILITE",
    "rsopUtilisateur": "",
    "rsopPortee": "Ordinateur",
    "rsopFormat": "HTML",
    "majPortee": "Utilisateur",
    "majForce": "Oui",
    "crNomGpo": "GPO Comptabilité — Élévation",
    "crOu": "Médecin",
    "crEtatLien": "Inactive",
    "crOrdre": "2",
    "crApplique": "Non",
    "auOu": "",
    "auVue": "Complete",
    "auFormat": "Console",
    "fsNomGpo": "GPO Comptabilité — Élévation",
    "fsGroupe": "GG-Comptabilité-RW",
    "wmiRequete": "SELECT * FROM Win32_OperatingSystem WHERE ProductType = 3",
    "wmiEspace": "root\\CIMv2",
    "wmiNom": "Serveurs seulement comptabilite",
    "wmiFormat": "JSON",
    "dmLettre": "Q:",
    "dmChemin": "\\\\srv-fichiers\\Données Éléonore",
    "dmLibelle": "Partage comptabilite",
    "dmGroupe": "GG-Comptabilité-RW",
    "dmAction": "Create",
    "dmFormat": "JSON",
    "imType": "Partagee",
    "imServeur": "srv-impression",
    "imPartage": "HP-comptabilite",
    "imGroupe": "GG-Comptabilité-RW",
    "imFormat": "JSON",
    "scType": "Demarrage",
    "scChemin": "\\\\comptabilite.hopitalbn.lan\\SYSVOL\\comptabilite.hopitalbn.lan\\scripts",
    "scFichier": "demarrage-comptabilite.ps1",
    "scFormat": "JSON",
    "frDossier": "Bureau",
    "frRacine": "\\\\srv-fichiers\\Données Éléonore",
    "frGroupe": "GG-Comptabilité-RW",
    "frDeplacer": "Non",
    "frFormat": "JSON",
    "vbNomGpo": "GPO Comptabilité — Élévation",
    "vbInactivite": "10",
    "vbFond": "\\\\srv-fichiers\\Images\\fond éléonore.jpg",
    "drNomGpo": "GPO Comptabilité — Élévation",
    "drNiveau": "LectureSeule",
    "fdRegles": "40",
    "fdFormat": "Console",
    "wuNomGpo": "GPO Comptabilité — Élévation",
    "wuCible": "Serveurs",
    "wuReport": "14",
    "wuDebutActif": "8",
    "wuFinActif": "18",
    "slNomGpo": "GPO Comptabilité — Élévation",
    "slMsi": "\\\\srv-fichiers\\Paquets\\outil comptabilité.msi",
    "slRaccourci": "\\\\srv-fichiers\\Données Éléonore",
    "slNavigateur": "Edge",
    "slPageDemarrage": "https://intranet.hopitalbn.lan/accueil",
    "brNomGpo": "GPO Comptabilité — Élévation",
    "brDossier": "\\\\srv-fichiers\\Données Éléonore",
    "brAction": "Sauvegarder",
    "brIdSauvegarde": "",
    "brConfirmation": ""
  },
  "virgule-et-point-virgule": {
    "gpoDomain": "virgule.hopitalbn.lan",
    "invRecent": "90",
    "invFormat": "JSON",
    "sanGpoJours": "21",
    "sanGpoFormat": "JSON",
    "rsopCible": "PC-VIRGULE",
    "rsopUtilisateur": "mtremblay",
    "rsopPortee": "Utilisateur",
    "rsopFormat": "JSON",
    "majPortee": "Ordinateur",
    "majForce": "Non",
    "crNomGpo": "GPO-Postes,2026;test",
    "crOu": "Médecin",
    "crEtatLien": "Inactive",
    "crOrdre": "2",
    "crApplique": "Non",
    "auOu": "",
    "auVue": "Directs",
    "auFormat": "JSON",
    "fsNomGpo": "GPO-Postes,2026;test",
    "fsGroupe": "GG-Test,RW",
    "wmiRequete": "SELECT * FROM Win32_OperatingSystem WHERE ProductType = 3",
    "wmiEspace": "root\\CIMv2",
    "wmiNom": "Postes,2026",
    "wmiFormat": "JSON",
    "dmLettre": "Q:",
    "dmChemin": "\\\\srv-fichiers\\Donnees,2026",
    "dmLibelle": "Partage;2026",
    "dmGroupe": "GG-Test,RW",
    "dmAction": "Create",
    "dmFormat": "JSON",
    "imType": "Partagee",
    "imServeur": "srv-impression",
    "imPartage": "HP-virgule",
    "imGroupe": "GG-Test,RW",
    "imFormat": "JSON",
    "scType": "Demarrage",
    "scChemin": "\\\\virgule.hopitalbn.lan\\SYSVOL\\virgule.hopitalbn.lan\\scripts",
    "scFichier": "demarrage-virgule.ps1",
    "scFormat": "JSON",
    "frDossier": "Bureau",
    "frRacine": "\\\\srv-fichiers\\Donnees,2026",
    "frGroupe": "GG-Test,RW",
    "frDeplacer": "Non",
    "frFormat": "JSON",
    "vbNomGpo": "GPO-Postes,2026;test",
    "vbInactivite": "10",
    "vbFond": "\\\\srv-fichiers\\Images\\fond,2026.jpg",
    "drNomGpo": "GPO-Postes,2026;test",
    "drNiveau": "Audit",
    "fdRegles": "50",
    "fdFormat": "JSON",
    "wuNomGpo": "GPO-Postes,2026;test",
    "wuCible": "Serveurs",
    "wuReport": "14",
    "wuDebutActif": "8",
    "wuFinActif": "18",
    "slNomGpo": "GPO-Postes,2026;test",
    "slMsi": "\\\\srv-fichiers\\Paquets\\outil,2026.msi",
    "slRaccourci": "\\\\srv-fichiers\\Donnees,2026",
    "slNavigateur": "Edge",
    "slPageDemarrage": "https://intranet.hopitalbn.lan/accueil",
    "brNomGpo": "GPO-Postes,2026;test",
    "brDossier": "\\\\srv-fichiers\\Donnees,2026",
    "brAction": "Comparer",
    "brIdSauvegarde": "",
    "brConfirmation": ""
  },
  "chemin-racine-c": {
    "gpoDomain": "racine.hopitalbn.lan",
    "invRecent": "1",
    "invFormat": "HTML",
    "sanGpoJours": "1",
    "sanGpoFormat": "HTML",
    "rsopCible": "PC-RACINE",
    "rsopUtilisateur": "jdupont",
    "rsopPortee": "Les deux",
    "rsopFormat": "Console",
    "majPortee": "Les deux",
    "majForce": "Oui",
    "crNomGpo": "GPO-Racine",
    "crOu": "Médecin",
    "crEtatLien": "Inactive",
    "crOrdre": "1",
    "crApplique": "Non",
    "auOu": "",
    "auVue": "Complete",
    "auFormat": "HTML",
    "fsNomGpo": "GPO-Racine",
    "fsGroupe": "GG-Test-RW",
    "wmiRequete": "SELECT * FROM Win32_OperatingSystem WHERE ProductType = 3",
    "wmiEspace": "root\\CIMv2",
    "wmiNom": "Serveurs seulement racine",
    "wmiFormat": "JSON",
    "dmLettre": "Q:",
    "dmChemin": "\\\\srv-fichiers\\Racine",
    "dmLibelle": "Partage racine",
    "dmGroupe": "GG-Test-RW",
    "dmAction": "Update",
    "dmFormat": "JSON",
    "imType": "TcpIp",
    "imServeur": "imp-racine",
    "imPartage": "HP-racine",
    "imGroupe": "GG-Test-RW",
    "imFormat": "JSON",
    "scType": "Ouverture",
    "scChemin": "\\\\racine.hopitalbn.lan\\NETLOGON",
    "scFichier": "demarrage-racine.ps1",
    "scFormat": "JSON",
    "frDossier": "Documents",
    "frRacine": "\\\\srv-fichiers\\Racine",
    "frGroupe": "GG-Test-RW",
    "frDeplacer": "Non",
    "frFormat": "JSON",
    "vbNomGpo": "GPO-Racine",
    "vbInactivite": "1",
    "vbFond": "",
    "drNomGpo": "GPO-Racine",
    "drNiveau": "Audit",
    "fdRegles": "1",
    "fdFormat": "HTML",
    "wuNomGpo": "GPO-Racine",
    "wuCible": "Serveurs",
    "wuReport": "0",
    "wuDebutActif": "0",
    "wuFinActif": "17",
    "slNomGpo": "GPO-Racine",
    "slMsi": "",
    "slRaccourci": "\\\\srv-fichiers\\Racine",
    "slNavigateur": "Aucun",
    "slPageDemarrage": "",
    "brNomGpo": "GPO-Racine",
    "brDossier": "\\\\srv-fichiers\\Racine",
    "brAction": "Comparer",
    "brIdSauvegarde": "",
    "brConfirmation": ""
  },
  "chemin-avec-apostrophe": {
    "gpoDomain": "obrien.hopitalbn.lan",
    "invRecent": "180",
    "invFormat": "CSV",
    "sanGpoJours": "30",
    "sanGpoFormat": "CSV",
    "rsopCible": "PC-OBRIEN",
    "rsopUtilisateur": "",
    "rsopPortee": "Ordinateur",
    "rsopFormat": "HTML",
    "majPortee": "Utilisateur",
    "majForce": "Non",
    "crNomGpo": "GPO-O'Brien-Sauvegarde",
    "crOu": "Médecin",
    "crEtatLien": "Inactive",
    "crOrdre": "2",
    "crApplique": "Non",
    "auOu": "",
    "auVue": "Directs",
    "auFormat": "CSV",
    "fsNomGpo": "GPO-O'Brien-Sauvegarde",
    "fsGroupe": "GG-O'Brien-RW",
    "wmiRequete": "SELECT * FROM Win32_OperatingSystem WHERE ProductType = 3",
    "wmiEspace": "root\\CIMv2",
    "wmiNom": "Serveurs seulement obrien",
    "wmiFormat": "JSON",
    "dmLettre": "Q:",
    "dmChemin": "\\\\srv-fichiers\\Sauvegardes$\\O'Brien",
    "dmLibelle": "Partage obrien",
    "dmGroupe": "GG-O'Brien-RW",
    "dmAction": "Create",
    "dmFormat": "JSON",
    "imType": "Partagee",
    "imServeur": "srv-impression",
    "imPartage": "HP-obrien",
    "imGroupe": "GG-O'Brien-RW",
    "imFormat": "JSON",
    "scType": "Demarrage",
    "scChemin": "\\\\obrien.hopitalbn.lan\\SYSVOL\\obrien.hopitalbn.lan\\scripts",
    "scFichier": "demarrage-obrien.ps1",
    "scFormat": "JSON",
    "frDossier": "Bureau",
    "frRacine": "\\\\srv-fichiers\\Sauvegardes$\\O'Brien",
    "frGroupe": "GG-O'Brien-RW",
    "frDeplacer": "Non",
    "frFormat": "JSON",
    "vbNomGpo": "GPO-O'Brien-Sauvegarde",
    "vbInactivite": "10",
    "vbFond": "\\\\srv-fichiers\\Images\\O'Brien\\fond.jpg",
    "drNomGpo": "GPO-O'Brien-Sauvegarde",
    "drNiveau": "Audit",
    "fdRegles": "75",
    "fdFormat": "CSV",
    "wuNomGpo": "GPO-O'Brien-Sauvegarde",
    "wuCible": "Serveurs",
    "wuReport": "14",
    "wuDebutActif": "8",
    "wuFinActif": "18",
    "slNomGpo": "GPO-O'Brien-Sauvegarde",
    "slMsi": "\\\\srv-fichiers\\Paquets\\O'Brien\\outil.msi",
    "slRaccourci": "\\\\srv-fichiers\\Sauvegardes$\\O'Brien",
    "slNavigateur": "Chrome",
    "slPageDemarrage": "https://intranet.hopitalbn.lan:8443/portail",
    "brNomGpo": "GPO-O'Brien-Sauvegarde",
    "brDossier": "\\\\srv-fichiers\\Sauvegardes$\\O'Brien",
    "brAction": "Restaurer",
    "brIdSauvegarde": "{4F2B9C10-7A3D-4E58-9B61-0C8D2E7A1F33}",
    "brConfirmation": ""
  }
};

for (const jeu of DATASETS) {
  const ajout = VALEURS_GPO[jeu.name];
  if (ajout) Object.assign(jeu.values, ajout);
}

// ---------------------------------------------------------------------------
// LOT 5 — valeurs Réseau pour les huit jeux de données.
//
// Même raison qu'au LOT 4 : sans ces valeurs, les vingt-deux assistants
// produisaient huit fichiers identiques, et les jeux de données ne testaient
// rien. Chaque jeu porte ici ses propres adresses, préfixes, ports, délais,
// chemins UNC et noms de profil — avec apostrophes ASCII et typographiques,
// dollar, accent grave, accents, virgules et points-virgules.
//
// Le jeu « chemin-avec-apostrophe » pousse aussi les bornes hautes : 100
// essais, 64 sauts, 30 000 ms, 20 ports nommés — le maximum que les
// validateurs acceptent. Le jeu « chemin-racine-c » pousse les bornes basses.
// ---------------------------------------------------------------------------
const VALEURS_RESEAU = {
  "apostrophe-ascii": {
    "nfrCible": "www.microsoft.com",
    "nfrPort": "445",
    "nfrDetail": "Essentiel",
    "nfrFormat": "JSON",
    "nbAction": "Capturer",
    "nbDossier": "C:\\Kjemo\\Reseau\\dadam",
    "nbReference": "",
    "nbFormat": "JSON",
    "ptCible": "srv-obrien.dadam.hopitalbn.lan",
    "ptPort": "445",
    "ptEssais": "4",
    "ptSauts": "20",
    "ptFormat": "JSON",
    "lpCible": "192.168.31.50",
    "lpEssais": "4",
    "lpPause": "200",
    "lpSeuil": "100",
    "lpFormat": "JSON",
    "gdCarte": "Ethernet D'Adam",
    "gdCibleExterne": "learn.microsoft.com",
    "gdFormat": "JSON",
    "cfAdresse": "192.168.31.50",
    "cfJours": "7",
    "cfLocale": "Non",
    "cfFormat": "JSON",
    "amCibleTest": "www.microsoft.com",
    "amFamille": "IPv4",
    "amFormat": "JSON",
    "dcNom": "srv-obrien.dadam.hopitalbn.lan",
    "dcInverse": "192.168.31.50",
    "dcType": "A",
    "dcFormat": "JSON",
    "dcrFiltre": "srv-obrien.dadam.hopitalbn.lan",
    "dcrAussiNetbios": "Non",
    "dchCarte": "Ethernet D'Adam",
    "dchServeurs": "192.168.31.10,192.168.31.11",
    "tpCible": "srv-obrien.dadam.hopitalbn.lan",
    "tpPorts": "445,139",
    "tpDelai": "2000",
    "tpFormat": "JSON",
    "rpcCible": "dc-dadam.dadam.hopitalbn.lan",
    "rpcEchantillon": "5",
    "rpcDelai": "2000",
    "rpcFormat": "JSON",
    "llCible": "dc-dadam.dadam.hopitalbn.lan",
    "llDomaine": "dadam.hopitalbn.lan",
    "llAlerteJours": "30",
    "llFormat": "JSON",
    "smbServeur": "srv-obrien.dadam.hopitalbn.lan",
    "smbPartage": "Donnees-D'Adam",
    "smbSousDossier": "Comptabilite",
    "htUrl": "https://intranet.dadam.hopitalbn.lan/",
    "htRedirections": "Oui",
    "htDelai": "10000",
    "htAlerteJours": "30",
    "htFormat": "JSON",
    "rtDestination": "8.8.8.8",
    "rtFamille": "IPv4",
    "rtFormat": "JSON",
    "rmDestination": "10.21.0.0/24",
    "rmPasserelle": "192.168.31.254",
    "rmCarte": "Ethernet D'Adam",
    "rmMetrique": "1",
    "rmPersistante": "Non",
    "rmConfirmationDefaut": "",
    "arpAdresse": "192.168.31.50",
    "arpFamille": "IPv4",
    "dhcCarte": "Ethernet D'Adam",
    "dhcJours": "7",
    "dhcFormat": "JSON",
    "nsdChemin": "\\\\srv-obrien.dadam.hopitalbn.lan\\Donnees-D'Adam",
    "nsdLettre": "P:",
    "nsdFormat": "JSON",
    "wvParcours": "Wi-Fi",
    "wvProfil": "Hopital-D'Adam",
    "wvCibleInterne": "srv-obrien.dadam.hopitalbn.lan",
    "wvFormat": "JSON",
    "calcAdresse": "192.168.31.50",
    "calcPrefixe": "24",
    "calcComparer": "192.168.31.200",
    "calcDecoupe": "26",
    "calcFormat": "JSON",
    "smbcFormat": "JSON"
  },
  "apostrophe-typographique": {
    "nfrCible": "www.microsoft.com",
    "nfrPort": "443",
    "nfrDetail": "Complet",
    "nfrFormat": "HTML",
    "nbAction": "Comparer",
    "nbDossier": "C:\\Kjemo\\Reseau\\typo",
    "nbReference": "",
    "nbFormat": "HTML",
    "ptCible": "srv-obrien.typo.hopitalbn.lan",
    "ptPort": "443",
    "ptEssais": "8",
    "ptSauts": "15",
    "ptFormat": "HTML",
    "lpCible": "192.168.32.60",
    "lpEssais": "8",
    "lpPause": "300",
    "lpSeuil": "50",
    "lpFormat": "HTML",
    "gdCarte": "Ethernet D’Adam",
    "gdCibleExterne": "learn.microsoft.com",
    "gdFormat": "HTML",
    "cfAdresse": "192.168.32.60",
    "cfJours": "14",
    "cfLocale": "Oui",
    "cfFormat": "HTML",
    "amCibleTest": "learn.microsoft.com",
    "amFamille": "Les deux",
    "amFormat": "HTML",
    "dcNom": "srv-obrien.typo.hopitalbn.lan",
    "dcInverse": "192.168.32.60",
    "dcType": "AAAA",
    "dcFormat": "HTML",
    "dcrFiltre": "srv-obrien.typo.hopitalbn.lan",
    "dcrAussiNetbios": "Oui",
    "dchCarte": "Ethernet D’Adam",
    "dchServeurs": "192.168.32.10,192.168.32.11,192.168.32.12",
    "tpCible": "srv-obrien.typo.hopitalbn.lan",
    "tpPorts": "443,80,8080",
    "tpDelai": "3000",
    "tpFormat": "HTML",
    "rpcCible": "dc-typo.typo.hopitalbn.lan",
    "rpcEchantillon": "8",
    "rpcDelai": "3000",
    "rpcFormat": "HTML",
    "llCible": "dc-typo.typo.hopitalbn.lan",
    "llDomaine": "typo.hopitalbn.lan",
    "llAlerteJours": "60",
    "llFormat": "HTML",
    "smbServeur": "srv-obrien.typo.hopitalbn.lan",
    "smbPartage": "Donnees-D’Adam",
    "smbSousDossier": "Comptabilite’2026",
    "htUrl": "https://portail.typo.hopitalbn.lan:8443/",
    "htRedirections": "Non",
    "htDelai": "15000",
    "htAlerteJours": "60",
    "htFormat": "HTML",
    "rtDestination": "1.1.1.1",
    "rtFamille": "Les deux",
    "rtFormat": "HTML",
    "rmDestination": "10.22.0.0/25",
    "rmPasserelle": "192.168.32.254",
    "rmCarte": "Ethernet D’Adam",
    "rmMetrique": "5",
    "rmPersistante": "Oui",
    "rmConfirmationDefaut": "",
    "arpAdresse": "192.168.32.60",
    "arpFamille": "IPv6",
    "dhcCarte": "Ethernet D’Adam",
    "dhcJours": "14",
    "dhcFormat": "HTML",
    "nsdChemin": "\\\\srv-obrien.typo.hopitalbn.lan\\Donnees-D’Adam",
    "nsdLettre": "Q:",
    "nsdFormat": "HTML",
    "wvParcours": "VPN",
    "wvProfil": "Hopital-D’Adam",
    "wvCibleInterne": "srv-obrien.typo.hopitalbn.lan",
    "wvFormat": "HTML",
    "calcAdresse": "192.168.32.60",
    "calcPrefixe": "25",
    "calcComparer": "192.168.32.200",
    "calcDecoupe": "27",
    "calcFormat": "Console",
    "smbcFormat": "HTML"
  },
  "dollar-backtick-guillemets": {
    "nfrCible": "www.microsoft.com",
    "nfrPort": "3389",
    "nfrDetail": "Essentiel",
    "nfrFormat": "CSV",
    "nbAction": "Capturer",
    "nbDossier": "C:\\Kjemo\\Reseau\\special",
    "nbReference": "",
    "nbFormat": "CSV",
    "ptCible": "srv-special.special.hopitalbn.lan",
    "ptPort": "3389",
    "ptEssais": "12",
    "ptSauts": "10",
    "ptFormat": "CSV",
    "lpCible": "10.33.4.70",
    "lpEssais": "12",
    "lpPause": "500",
    "lpSeuil": "30",
    "lpFormat": "CSV",
    "gdCarte": "Ethernet 2",
    "gdCibleExterne": "learn.microsoft.com",
    "gdFormat": "CSV",
    "cfAdresse": "10.33.4.70",
    "cfJours": "21",
    "cfLocale": "Non",
    "cfFormat": "CSV",
    "amCibleTest": "docs.microsoft.com",
    "amFamille": "IPv4",
    "amFormat": "CSV",
    "dcNom": "srv-special.special.hopitalbn.lan",
    "dcInverse": "10.33.4.70",
    "dcType": "CNAME",
    "dcFormat": "CSV",
    "dcrFiltre": "srv-special.special.hopitalbn.lan",
    "dcrAussiNetbios": "Non",
    "dchCarte": "Ethernet 2",
    "dchServeurs": "10.33.4.10,10.33.4.11",
    "tpCible": "srv-special.special.hopitalbn.lan",
    "tpPorts": "3389,5985,5986",
    "tpDelai": "1000",
    "tpFormat": "CSV",
    "rpcCible": "dc-special.special.hopitalbn.lan",
    "rpcEchantillon": "3",
    "rpcDelai": "1000",
    "rpcFormat": "CSV",
    "llCible": "dc-special.special.hopitalbn.lan",
    "llDomaine": "special.hopitalbn.lan",
    "llAlerteJours": "90",
    "llFormat": "CSV",
    "smbServeur": "srv-special.special.hopitalbn.lan",
    "smbPartage": "Partage$special",
    "smbSousDossier": "Test special",
    "htUrl": "https://intranet.special.hopitalbn.lan/accueil",
    "htRedirections": "Oui",
    "htDelai": "5000",
    "htAlerteJours": "90",
    "htFormat": "CSV",
    "rtDestination": "9.9.9.9",
    "rtFamille": "IPv4",
    "rtFormat": "CSV",
    "rmDestination": "10.23.0.0/26",
    "rmPasserelle": "10.33.4.126",
    "rmCarte": "Ethernet 2",
    "rmMetrique": "10",
    "rmPersistante": "Non",
    "rmConfirmationDefaut": "",
    "arpAdresse": "10.33.4.70",
    "arpFamille": "Les deux",
    "dhcCarte": "Ethernet 2",
    "dhcJours": "21",
    "dhcFormat": "CSV",
    "nsdChemin": "\\\\srv-special.special.hopitalbn.lan\\Partage$special",
    "nsdLettre": "R:",
    "nsdFormat": "CSV",
    "wvParcours": "Wi-Fi",
    "wvProfil": "Wi-Fi special",
    "wvCibleInterne": "srv-special.special.hopitalbn.lan",
    "wvFormat": "CSV",
    "calcAdresse": "10.33.4.70",
    "calcPrefixe": "26",
    "calcComparer": "10.33.4.100",
    "calcDecoupe": "28",
    "calcFormat": "CSV",
    "smbcFormat": "CSV"
  },
  "espaces-et-accents": {
    "nfrCible": "www.microsoft.com",
    "nfrPort": "389",
    "nfrDetail": "Complet",
    "nfrFormat": "Console",
    "nbAction": "Comparer",
    "nbDossier": "C:\\Kjemo\\Reseau\\comptabilite",
    "nbReference": "",
    "nbFormat": "Console",
    "ptCible": "srv-comptabilite.comptabilite.hopitalbn.lan",
    "ptPort": "389",
    "ptEssais": "30",
    "ptSauts": "25",
    "ptFormat": "Console",
    "lpCible": "172.20.5.130",
    "lpEssais": "30",
    "lpPause": "1000",
    "lpSeuil": "200",
    "lpFormat": "Console",
    "gdCarte": "Adaptateur reseau interne",
    "gdCibleExterne": "learn.microsoft.com",
    "gdFormat": "Console",
    "cfAdresse": "172.20.5.130",
    "cfJours": "30",
    "cfLocale": "Oui",
    "cfFormat": "Console",
    "amCibleTest": "azure.microsoft.com",
    "amFamille": "Les deux",
    "amFormat": "Console",
    "dcNom": "srv-comptabilite.comptabilite.hopitalbn.lan",
    "dcInverse": "172.20.5.130",
    "dcType": "SRV",
    "dcFormat": "Console",
    "dcrFiltre": "srv-comptabilite.comptabilite.hopitalbn.lan",
    "dcrAussiNetbios": "Oui",
    "dchCarte": "Adaptateur reseau interne",
    "dchServeurs": "172.20.5.129,172.20.5.130",
    "tpCible": "srv-comptabilite.comptabilite.hopitalbn.lan",
    "tpPorts": "389,636,3268,3269",
    "tpDelai": "5000",
    "tpFormat": "Console",
    "rpcCible": "dc-comptabilite.comptabilite.hopitalbn.lan",
    "rpcEchantillon": "10",
    "rpcDelai": "5000",
    "rpcFormat": "Console",
    "llCible": "dc-comptabilite.comptabilite.hopitalbn.lan",
    "llDomaine": "comptabilite.hopitalbn.lan",
    "llAlerteJours": "15",
    "llFormat": "Console",
    "smbServeur": "srv-comptabilite.comptabilite.hopitalbn.lan",
    "smbPartage": "Donnees Eleonore",
    "smbSousDossier": "Comptabilite 2026",
    "htUrl": "http://intranet.comptabilite.hopitalbn.lan/",
    "htRedirections": "Non",
    "htDelai": "20000",
    "htAlerteJours": "15",
    "htFormat": "Console",
    "rtDestination": "172.20.9.9",
    "rtFamille": "Les deux",
    "rtFormat": "Console",
    "rmDestination": "172.21.0.0/24",
    "rmPasserelle": "172.20.5.190",
    "rmCarte": "Adaptateur reseau interne",
    "rmMetrique": "100",
    "rmPersistante": "Oui",
    "rmConfirmationDefaut": "",
    "arpAdresse": "172.20.5.130",
    "arpFamille": "IPv4",
    "dhcCarte": "Adaptateur reseau interne",
    "dhcJours": "30",
    "dhcFormat": "Console",
    "nsdChemin": "\\\\srv-comptabilite.comptabilite.hopitalbn.lan\\Donnees Eleonore",
    "nsdLettre": "S:",
    "nsdFormat": "Console",
    "wvParcours": "VPN",
    "wvProfil": "Wi-Fi Invites Eleonore",
    "wvCibleInterne": "srv-comptabilite.comptabilite.hopitalbn.lan",
    "wvFormat": "Console",
    "calcAdresse": "172.20.5.130",
    "calcPrefixe": "26",
    "calcComparer": "172.20.5.140",
    "calcDecoupe": "28",
    "calcFormat": "JSON",
    "smbcFormat": "Console"
  },
  "virgule-et-point-virgule": {
    "nfrCible": "www.microsoft.com",
    "nfrPort": "53",
    "nfrDetail": "Essentiel",
    "nfrFormat": "JSON",
    "nbAction": "Capturer",
    "nbDossier": "C:\\Kjemo\\Reseau\\virgule",
    "nbReference": "",
    "nbFormat": "JSON",
    "ptCible": "srv-virgule.virgule.hopitalbn.lan",
    "ptPort": "53",
    "ptEssais": "50",
    "ptSauts": "30",
    "ptFormat": "JSON",
    "lpCible": "10.44.7.90",
    "lpEssais": "50",
    "lpPause": "150",
    "lpSeuil": "75",
    "lpFormat": "JSON",
    "gdCarte": "Ethernet,1",
    "gdCibleExterne": "learn.microsoft.com",
    "gdFormat": "JSON",
    "cfAdresse": "10.44.7.90",
    "cfJours": "60",
    "cfLocale": "Non",
    "cfFormat": "JSON",
    "amCibleTest": "support.microsoft.com",
    "amFamille": "IPv4",
    "amFormat": "JSON",
    "dcNom": "srv-virgule.virgule.hopitalbn.lan",
    "dcInverse": "10.44.7.90",
    "dcType": "MX",
    "dcFormat": "JSON",
    "dcrFiltre": "srv-virgule.virgule.hopitalbn.lan",
    "dcrAussiNetbios": "Non",
    "dchCarte": "Ethernet,1",
    "dchServeurs": "10.44.7.65,10.44.7.66",
    "tpCible": "srv-virgule.virgule.hopitalbn.lan",
    "tpPorts": "25,587,993,995",
    "tpDelai": "2500",
    "tpFormat": "JSON",
    "rpcCible": "dc-virgule.virgule.hopitalbn.lan",
    "rpcEchantillon": "15",
    "rpcDelai": "2500",
    "rpcFormat": "JSON",
    "llCible": "dc-virgule.virgule.hopitalbn.lan",
    "llDomaine": "virgule.hopitalbn.lan",
    "llAlerteJours": "7",
    "llFormat": "JSON",
    "smbServeur": "srv-virgule.virgule.hopitalbn.lan",
    "smbPartage": "Donnees,2026",
    "smbSousDossier": "Archives,2026",
    "htUrl": "https://intranet.virgule.hopitalbn.lan/page,1",
    "htRedirections": "Oui",
    "htDelai": "8000",
    "htAlerteJours": "7",
    "htFormat": "JSON",
    "rtDestination": "10.44.9.9",
    "rtFamille": "IPv4",
    "rtFormat": "JSON",
    "rmDestination": "10.24.0.0/27",
    "rmPasserelle": "10.44.7.94",
    "rmCarte": "Ethernet,1",
    "rmMetrique": "50",
    "rmPersistante": "Non",
    "rmConfirmationDefaut": "",
    "arpAdresse": "10.44.7.90",
    "arpFamille": "IPv6",
    "dhcCarte": "Ethernet,1",
    "dhcJours": "60",
    "dhcFormat": "JSON",
    "nsdChemin": "\\\\srv-virgule.virgule.hopitalbn.lan\\Donnees,2026",
    "nsdLettre": "T:",
    "nsdFormat": "JSON",
    "wvParcours": "Wi-Fi",
    "wvProfil": "Wi-Fi,Invites",
    "wvCibleInterne": "srv-virgule.virgule.hopitalbn.lan",
    "wvFormat": "JSON",
    "calcAdresse": "10.44.7.90",
    "calcPrefixe": "27",
    "calcComparer": "10.44.7.95",
    "calcDecoupe": "29",
    "calcFormat": "Console",
    "smbcFormat": "JSON"
  },
  "chemin-racine-c": {
    "nfrCible": "www.microsoft.com",
    "nfrPort": "80",
    "nfrDetail": "Complet",
    "nfrFormat": "HTML",
    "nbAction": "Comparer",
    "nbDossier": "C:\\Kjemo\\Reseau\\racine",
    "nbReference": "",
    "nbFormat": "HTML",
    "ptCible": "srv-racine.racine.hopitalbn.lan",
    "ptPort": "80",
    "ptEssais": "1",
    "ptSauts": "1",
    "ptFormat": "HTML",
    "lpCible": "10.0.0.1",
    "lpEssais": "1",
    "lpPause": "100",
    "lpSeuil": "1",
    "lpFormat": "HTML",
    "gdCarte": "Ethernet",
    "gdCibleExterne": "learn.microsoft.com",
    "gdFormat": "HTML",
    "cfAdresse": "10.0.0.1",
    "cfJours": "1",
    "cfLocale": "Oui",
    "cfFormat": "HTML",
    "amCibleTest": "www.bing.com",
    "amFamille": "Les deux",
    "amFormat": "HTML",
    "dcNom": "srv-racine.racine.hopitalbn.lan",
    "dcInverse": "10.0.0.1",
    "dcType": "TXT",
    "dcFormat": "HTML",
    "dcrFiltre": "srv-racine.racine.hopitalbn.lan",
    "dcrAussiNetbios": "Oui",
    "dchCarte": "Ethernet",
    "dchServeurs": "10.0.0.1",
    "tpCible": "srv-racine.racine.hopitalbn.lan",
    "tpPorts": "80",
    "tpDelai": "100",
    "tpFormat": "HTML",
    "rpcCible": "dc-racine.racine.hopitalbn.lan",
    "rpcEchantillon": "1",
    "rpcDelai": "100",
    "rpcFormat": "HTML",
    "llCible": "dc-racine.racine.hopitalbn.lan",
    "llDomaine": "racine.hopitalbn.lan",
    "llAlerteJours": "1",
    "llFormat": "HTML",
    "smbServeur": "srv-racine.racine.hopitalbn.lan",
    "smbPartage": "RacineC",
    "smbSousDossier": "",
    "htUrl": "http://intranet.racine.hopitalbn.lan/",
    "htRedirections": "Non",
    "htDelai": "100",
    "htAlerteJours": "1",
    "htFormat": "HTML",
    "rtDestination": "255.255.255.254",
    "rtFamille": "Les deux",
    "rtFormat": "HTML",
    "rmDestination": "10.25.0.0/24",
    "rmPasserelle": "10.0.0.254",
    "rmCarte": "Ethernet",
    "rmMetrique": "9999",
    "rmPersistante": "Oui",
    "rmConfirmationDefaut": "",
    "arpAdresse": "10.0.0.1",
    "arpFamille": "Les deux",
    "dhcCarte": "Ethernet",
    "dhcJours": "1",
    "dhcFormat": "HTML",
    "nsdChemin": "\\\\srv-racine.racine.hopitalbn.lan\\RacineC",
    "nsdLettre": "Z:",
    "nsdFormat": "HTML",
    "wvParcours": "VPN",
    "wvProfil": "",
    "wvCibleInterne": "srv-racine.racine.hopitalbn.lan",
    "wvFormat": "HTML",
    "calcAdresse": "10.0.0.1",
    "calcPrefixe": "8",
    "calcComparer": "10.255.255.254",
    "calcDecoupe": "",
    "calcFormat": "CSV",
    "smbcFormat": "HTML"
  },
  "chemin-avec-apostrophe": {
    "nfrCible": "www.microsoft.com",
    "nfrPort": "636",
    "nfrDetail": "Essentiel",
    "nfrFormat": "CSV",
    "nbAction": "Capturer",
    "nbDossier": "C:\\Kjemo\\Reseau\\obrien",
    "nbReference": "",
    "nbFormat": "CSV",
    "ptCible": "srv-obrien.obrien.hopitalbn.lan",
    "ptPort": "636",
    "ptEssais": "100",
    "ptSauts": "64",
    "ptFormat": "CSV",
    "lpCible": "192.168.99.129",
    "lpEssais": "100",
    "lpPause": "30000",
    "lpSeuil": "10000",
    "lpFormat": "CSV",
    "gdCarte": "Ethernet O'Brien",
    "gdCibleExterne": "learn.microsoft.com",
    "gdFormat": "CSV",
    "cfAdresse": "192.168.99.129",
    "cfJours": "90",
    "cfLocale": "Non",
    "cfFormat": "CSV",
    "amCibleTest": "login.microsoftonline.com",
    "amFamille": "IPv4",
    "amFormat": "CSV",
    "dcNom": "srv-obrien.obrien.hopitalbn.lan",
    "dcInverse": "192.168.99.129",
    "dcType": "A",
    "dcFormat": "CSV",
    "dcrFiltre": "srv-obrien.obrien.hopitalbn.lan",
    "dcrAussiNetbios": "Non",
    "dchCarte": "Ethernet O'Brien",
    "dchServeurs": "192.168.99.129,192.168.99.130",
    "tpCible": "srv-obrien.obrien.hopitalbn.lan",
    "tpPorts": "21,22,23,25,53,80,110,135,139,143,389,443,445,636,993,995,1433,3268,3389,5985",
    "tpDelai": "30000",
    "tpFormat": "CSV",
    "rpcCible": "dc-obrien.obrien.hopitalbn.lan",
    "rpcEchantillon": "20",
    "rpcDelai": "30000",
    "rpcFormat": "CSV",
    "llCible": "dc-obrien.obrien.hopitalbn.lan",
    "llDomaine": "obrien.hopitalbn.lan",
    "llAlerteJours": "365",
    "llFormat": "CSV",
    "smbServeur": "srv-obrien.obrien.hopitalbn.lan",
    "smbPartage": "OBrien",
    "smbSousDossier": "O'Brien",
    "htUrl": "https://intranet.obrien.hopitalbn.lan/o-brien",
    "htRedirections": "Oui",
    "htDelai": "30000",
    "htAlerteJours": "365",
    "htFormat": "CSV",
    "rtDestination": "192.168.99.130",
    "rtFamille": "IPv4",
    "rtFormat": "CSV",
    "rmDestination": "10.26.0.0/31",
    "rmPasserelle": "192.168.99.128",
    "rmCarte": "Ethernet O'Brien",
    "rmMetrique": "2",
    "rmPersistante": "Non",
    "rmConfirmationDefaut": "",
    "arpAdresse": "192.168.99.129",
    "arpFamille": "IPv4",
    "dhcCarte": "Ethernet O'Brien",
    "dhcJours": "90",
    "dhcFormat": "CSV",
    "nsdChemin": "\\\\srv-obrien.obrien.hopitalbn.lan\\OBrien",
    "nsdLettre": "O:",
    "nsdFormat": "CSV",
    "wvParcours": "Wi-Fi",
    "wvProfil": "Wi-Fi O'Brien",
    "wvCibleInterne": "srv-obrien.obrien.hopitalbn.lan",
    "wvFormat": "CSV",
    "calcAdresse": "192.168.99.129",
    "calcPrefixe": "31",
    "calcComparer": "192.168.99.130",
    "calcDecoupe": "32",
    "calcFormat": "JSON",
    "smbcFormat": "CSV"
  }
};

for (const jeu of DATASETS) {
  const ajout = VALEURS_RESEAU[jeu.name];
  if (ajout) Object.assign(jeu.values, ajout);
}


const VALEURS_POSTE = {
  "apostrophe-ascii": {
    "whJours": "12",
    "whSeuilDisque": "20",
    "whFormat": "JSON",
    "invPortee": "Complet",
    "invMaxLogiciels": "150",
    "wiFormat": "JSON",
    "audJours": "12",
    "audConfirmation": "",
    "micJours": "10",
    "micFormat": "JSON",
    "camJours": "12",
    "camFormat": "JSON",
    "btJours": "10",
    "btFormat": "JSON",
    "ecrJours": "12",
    "ecrFormat": "JSON",
    "drvAnciennete": "4",
    "drvInclureMicrosoft": "Non",
    "drvFormat": "JSON",
    "wudJours": "10",
    "wudFormat": "JSON",
    "wurJournal": "C:\\Kjemo\\Journaux\\D'Adam",
    "wurCible": "SoftwareDistribution",
    "wurConfirmation": "",
    "appChemin": "C:\\Program Files\\D'Adam\\o'brien.exe",
    "appProcessus": "o'brien",
    "appJours": "12",
    "appFormat": "JSON",
    "prcTop": "20",
    "prcPid": "",
    "prcConfirmation": ""
  },
  "apostrophe-typographique": {
    "whJours": "48",
    "whSeuilDisque": "25",
    "whFormat": "HTML",
    "invPortee": "Logiciels",
    "invMaxLogiciels": "300",
    "wiFormat": "HTML",
    "audJours": "48",
    "audConfirmation": "",
    "micJours": "14",
    "micFormat": "HTML",
    "camJours": "48",
    "camFormat": "HTML",
    "btJours": "14",
    "btFormat": "HTML",
    "ecrJours": "48",
    "ecrFormat": "HTML",
    "drvAnciennete": "6",
    "drvInclureMicrosoft": "Oui",
    "drvFormat": "HTML",
    "wudJours": "14",
    "wudFormat": "HTML",
    "wurJournal": "C:\\Kjemo\\Journaux\\D’Adam",
    "wurCible": "Les deux",
    "wurConfirmation": "",
    "appChemin": "C:\\Program Files\\D’Adam\\app-d’arcy.exe",
    "appProcessus": "appdarcy",
    "appJours": "48",
    "appFormat": "HTML",
    "prcTop": "25",
    "prcPid": "",
    "prcConfirmation": ""
  },
  "dollar-backtick-guillemets": {
    "whJours": "6",
    "whSeuilDisque": "30",
    "whFormat": "CSV",
    "invPortee": "Materiel",
    "invMaxLogiciels": "80",
    "wiFormat": "CSV",
    "audJours": "6",
    "audConfirmation": "",
    "micJours": "21",
    "micFormat": "CSV",
    "camJours": "6",
    "camFormat": "CSV",
    "btJours": "21",
    "btFormat": "CSV",
    "ecrJours": "6",
    "ecrFormat": "CSV",
    "drvAnciennete": "3",
    "drvInclureMicrosoft": "Non",
    "drvFormat": "CSV",
    "wudJours": "21",
    "wudFormat": "CSV",
    "wurJournal": "C:\\Kjemo\\Journaux\\Test$sp",
    "wurCible": "SoftwareDistribution",
    "wurConfirmation": "",
    "appChemin": "C:\\Outils\\Test$special\\outil`test.exe",
    "appProcessus": "outiltest",
    "appJours": "6",
    "appFormat": "CSV",
    "prcTop": "30",
    "prcPid": "",
    "prcConfirmation": ""
  },
  "espaces-et-accents": {
    "whJours": "30",
    "whSeuilDisque": "10",
    "whFormat": "HTML",
    "invPortee": "Complet",
    "invMaxLogiciels": "250",
    "wiFormat": "HTML",
    "audJours": "30",
    "audConfirmation": "",
    "micJours": "45",
    "micFormat": "HTML",
    "camJours": "30",
    "camFormat": "HTML",
    "btJours": "45",
    "btFormat": "HTML",
    "ecrJours": "30",
    "ecrFormat": "HTML",
    "drvAnciennete": "8",
    "drvInclureMicrosoft": "Non",
    "drvFormat": "HTML",
    "wudJours": "45",
    "wudFormat": "HTML",
    "wurJournal": "C:\\Kjemo\\Journaux\\Hôpital Bénin",
    "wurCible": "Les deux",
    "wurConfirmation": "",
    "appChemin": "C:\\Program Files\\Hôpital Bénin\\gestion de santé.exe",
    "appProcessus": "gestionsante",
    "appJours": "30",
    "appFormat": "HTML",
    "prcTop": "12",
    "prcPid": "",
    "prcConfirmation": ""
  },
  "virgule-et-point-virgule": {
    "whJours": "3",
    "whSeuilDisque": "40",
    "whFormat": "JSON",
    "invPortee": "Logiciels",
    "invMaxLogiciels": "500",
    "wiFormat": "JSON",
    "audJours": "3",
    "audConfirmation": "",
    "micJours": "7",
    "micFormat": "JSON",
    "camJours": "3",
    "camFormat": "JSON",
    "btJours": "7",
    "btFormat": "JSON",
    "ecrJours": "3",
    "ecrFormat": "JSON",
    "drvAnciennete": "10",
    "drvInclureMicrosoft": "Oui",
    "drvFormat": "JSON",
    "wudJours": "7",
    "wudFormat": "JSON",
    "wurJournal": "C:\\Kjemo\\Journaux\\Suite, v2; bis",
    "wurCible": "SoftwareDistribution",
    "wurConfirmation": "",
    "appChemin": "C:\\Outils\\Suite, Bureau; v2\\lanceur.exe",
    "appProcessus": "lanceur",
    "appJours": "3",
    "appFormat": "JSON",
    "prcTop": "8",
    "prcPid": "",
    "prcConfirmation": ""
  },
  "chemin-avec-apostrophe": {
    "whJours": "14",
    "whSeuilDisque": "35",
    "whFormat": "CSV",
    "invPortee": "Complet",
    "invMaxLogiciels": "120",
    "wiFormat": "CSV",
    "audJours": "14",
    "audConfirmation": "",
    "micJours": "60",
    "micFormat": "CSV",
    "camJours": "14",
    "camFormat": "CSV",
    "btJours": "60",
    "btFormat": "CSV",
    "ecrJours": "14",
    "ecrFormat": "CSV",
    "drvAnciennete": "2",
    "drvInclureMicrosoft": "Non",
    "drvFormat": "CSV",
    "wudJours": "60",
    "wudFormat": "CSV",
    "wurJournal": "C:\\Users\\D'Adam\\Journaux",
    "wurCible": "Les deux",
    "wurConfirmation": "",
    "appChemin": "C:\\Users\\D'Adam\\AppData\\Local\\Programmes\\agent.exe",
    "appProcessus": "agent",
    "appJours": "14",
    "appFormat": "CSV",
    "prcTop": "35",
    "prcPid": "",
    "prcConfirmation": ""
  },
  "chemin-racine-c": {
    "whJours": "90",
    "whSeuilDisque": "5",
    "whFormat": "Console",
    "invPortee": "Materiel",
    "invMaxLogiciels": "10",
    "wiFormat": "Console",
    "audJours": "90",
    "audConfirmation": "",
    "micJours": "88",
    "micFormat": "Console",
    "camJours": "90",
    "camFormat": "Console",
    "btJours": "89",
    "btFormat": "Console",
    "ecrJours": "90",
    "ecrFormat": "Console",
    "drvAnciennete": "15",
    "drvInclureMicrosoft": "Oui",
    "drvFormat": "Console",
    "wudJours": "180",
    "wudFormat": "Console",
    "wurJournal": "C:\\Kjemo",
    "wurCible": "SoftwareDistribution",
    "wurConfirmation": "",
    "appChemin": "C:\\",
    "appProcessus": "",
    "appJours": "90",
    "appFormat": "Console",
    "prcTop": "50",
    "prcPid": "",
    "prcConfirmation": ""
  }
};

// ---------------------------------------------------------------------------
// Jeux de données du LOT 6B
//
// Sans ces valeurs, les huit jeux produiraient huit fois le même script : les
// champs du LOT 6B n'existent dans aucun jeu antérieur, donc tous prendraient
// leur valeur par défaut. Huit empreintes identiques ne prouvent rien.
//
// Les valeurs sont volontairement variées — bornes basses et hautes, formats
// différents, cible de profil vide ou nommée. Elles restent DANS les bornes
// déclarées : un jeu de données sert à faire varier le script, pas à éprouver
// la validation. Les valeurs hostiles, elles, sont testées à part dans
// identity.test.mjs.
// ---------------------------------------------------------------------------
const VALEURS_POSTE_B = {
  "apostrophe-ascii": {
    "sbJours": "12",
    "sbMaxDemarrage": "60",
    "sbFormat": "JSON",
    "bsJours": "45",
    "bsMaxDumps": "30",
    "bsFormat": "JSON",
    "upCible": "obrien",
    "upJours": "21",
    "upFormat": "JSON",
    "perfEchantillons": "5",
    "perfTopProcessus": "15",
    "perfJours": "14",
    "perfFormat": "JSON",
    "lacInclureDesactives": "Non",
    "lacGroupes": "Tous les groupes locaux",
    "lacFormat": "JSON",
    "warTypeCompte": "Compte local",
    "warAutorisation": "Propriétaire identifié présent",
    "warFormat": "JSON",
    "svcNom": "Spooler",
    "svcAction": "Arrêter",
    "svcJours": "14",
    "svcJournal": "C:\\Kjemo\\Journaux\\D'Adam",
    "svcConfirmation": "",
    "svcFormat": "JSON",
    "fwPortee": "Règles autorisantes entrantes et sortantes",
    "fwMaxRegles": "120",
    "fwFormat": "JSON",
    "defJours": "60",
    "defExclusions": "Compter seulement",
    "defFormat": "JSON",
    "dsType": "Rapide",
    "dsChemin": "C:\\Kjemo\\Quarantaine\\D'Adam",
    "dsConfirmation": "",
    "dsFormat": "JSON",
    "sfcEtape": "Vérification sans correction",
    "sfcLignesJournal": "80",
    "sfcConfirmation": "",
    "sfcFormat": "JSON",
    "dsmEtape": "ScanHealth — vérification réelle",
    "dsmSource": "",
    "dsmLimiterWU": "Non",
    "dsmConfirmation": "",
    "dsmFormat": "JSON",
    "rpNom": "KJEMO - avant pilote O'Brien",
    "rpType": "DEVICE_DRIVER_INSTALL",
    "rpEtatProtection": "Constaté : lecteur système protégé",
    "rpConfirmation": "",
    "rpFormat": "JSON",
    "smeVariante": "Réseau",
    "smeApercuBcd": "Non, procédure graphique seulement",
    "smeFormat": "JSON",
    "stoSeuilAlerte": "20",
    "stoJoursTemporaires": "14",
    "stoFormat": "JSON",
    "tcEmplacements": "Session et cache Internet",
    "tcAgeMinimum": "60",
    "tcTailleMaxMo": "4096",
    "tcJournal": "C:\\Kjemo\\Journaux\\D'Adam",
    "tcConfirmation": "",
    "tcFormat": "JSON",
    "rbPortee": "Disque système seulement",
    "rbDetailAge": "Non",
    "rbFormat": "JSON",
    "bcNavigateurs": "Microsoft Edge seulement",
    "bcDetailProfils": "Non",
    "bcFormat": "JSON"
  },
  "apostrophe-typographique": {
    "sbJours": "21",
    "sbMaxDemarrage": "80",
    "sbFormat": "HTML",
    "bsJours": "60",
    "bsMaxDumps": "40",
    "bsFormat": "HTML",
    "upCible": "dadam",
    "upJours": "30",
    "upFormat": "HTML",
    "perfEchantillons": "7",
    "perfTopProcessus": "20",
    "perfJours": "21",
    "perfFormat": "HTML",
    "lacInclureDesactives": "Oui",
    "lacGroupes": "Tous les groupes locaux",
    "lacFormat": "HTML",
    "warTypeCompte": "Compte Microsoft",
    "warAutorisation": "Mandat du service informatique",
    "warFormat": "HTML",
    "svcNom": "Audiosrv2",
    "svcAction": "Démarrer",
    "svcJours": "30",
    "svcJournal": "C:\\Kjemo\\Journaux\\D’Adam",
    "svcConfirmation": "",
    "svcFormat": "HTML",
    "fwPortee": "Profils seulement",
    "fwMaxRegles": "200",
    "fwFormat": "HTML",
    "defJours": "90",
    "defExclusions": "Oui, avec avertissement",
    "defFormat": "HTML",
    "dsType": "Personnalisée",
    "dsChemin": "C:\\Kjemo\\Quarantaine\\D’Adam",
    "dsConfirmation": "",
    "dsFormat": "HTML",
    "sfcEtape": "Vérification et réparation",
    "sfcLignesJournal": "120",
    "sfcConfirmation": "",
    "sfcFormat": "HTML",
    "dsmEtape": "RestoreHealth — réparation",
    "dsmSource": "C:\\Sources\\install.wim",
    "dsmLimiterWU": "Oui",
    "dsmConfirmation": "",
    "dsmFormat": "HTML",
    "rpNom": "KJEMO - avant mise a jour",
    "rpType": "APPLICATION_INSTALL",
    "rpEtatProtection": "Non constaté",
    "rpConfirmation": "",
    "rpFormat": "HTML",
    "smeVariante": "Invite de commandes",
    "smeApercuBcd": "Oui, en aperçu documentaire avec son annulation",
    "smeFormat": "HTML",
    "stoSeuilAlerte": "25",
    "stoJoursTemporaires": "30",
    "stoFormat": "HTML",
    "tcEmplacements": "Tous les emplacements de la liste blanche",
    "tcAgeMinimum": "90",
    "tcTailleMaxMo": "8192",
    "tcJournal": "C:\\Kjemo\\Journaux\\D’Adam",
    "tcConfirmation": "",
    "tcFormat": "HTML",
    "rbPortee": "Tous les volumes locaux",
    "rbDetailAge": "Oui",
    "rbFormat": "HTML",
    "bcNavigateurs": "Chromium seulement",
    "bcDetailProfils": "Oui",
    "bcFormat": "HTML"
  },
  "dollar-backtick-guillemets": {
    "sbJours": "3",
    "sbMaxDemarrage": "15",
    "sbFormat": "CSV",
    "bsJours": "7",
    "bsMaxDumps": "5",
    "bsFormat": "CSV",
    "upCible": "test",
    "upJours": "3",
    "upFormat": "CSV",
    "perfEchantillons": "1",
    "perfTopProcessus": "5",
    "perfJours": "3",
    "perfFormat": "CSV",
    "lacInclureDesactives": "Non",
    "lacGroupes": "Administrateurs et bureau à distance",
    "lacFormat": "CSV",
    "warTypeCompte": "Compte de domaine",
    "warAutorisation": "Non établie",
    "warFormat": "CSV",
    "svcNom": "TestSvc",
    "svcAction": "Redémarrer",
    "svcJours": "3",
    "svcJournal": "C:\\Kjemo\\Journaux\\Test$",
    "svcConfirmation": "",
    "svcFormat": "CSV",
    "fwPortee": "Règles autorisantes entrantes",
    "fwMaxRegles": "20",
    "fwFormat": "CSV",
    "defJours": "7",
    "defExclusions": "Compter seulement",
    "defFormat": "CSV",
    "dsType": "Rapide",
    "dsChemin": "C:\\Kjemo\\Quarantaine\\Test$",
    "dsConfirmation": "",
    "dsFormat": "CSV",
    "sfcEtape": "Diagnostic des prérequis",
    "sfcLignesJournal": "10",
    "sfcConfirmation": "",
    "sfcFormat": "CSV",
    "dsmEtape": "CheckHealth — lecture d’un indicateur",
    "dsmSource": "",
    "dsmLimiterWU": "Non",
    "dsmConfirmation": "",
    "dsmFormat": "CSV",
    "rpNom": "KJEMO - test special",
    "rpType": "MODIFY_SETTINGS",
    "rpEtatProtection": "Constaté : lecteur système protégé",
    "rpConfirmation": "",
    "rpFormat": "CSV",
    "smeVariante": "Minimal",
    "smeApercuBcd": "Oui, en aperçu documentaire avec son annulation",
    "smeFormat": "CSV",
    "stoSeuilAlerte": "5",
    "stoJoursTemporaires": "1",
    "stoFormat": "CSV",
    "tcEmplacements": "Temporaires de la session seulement",
    "tcAgeMinimum": "7",
    "tcTailleMaxMo": "512",
    "tcJournal": "C:\\Kjemo\\Journaux\\Test$",
    "tcConfirmation": "",
    "tcFormat": "CSV",
    "rbPortee": "Disque système seulement",
    "rbDetailAge": "Oui",
    "rbFormat": "CSV",
    "bcNavigateurs": "Tous ceux qui sont détectés",
    "bcDetailProfils": "Non",
    "bcFormat": "CSV"
  },
  "espaces-et-accents": {
    "sbJours": "28",
    "sbMaxDemarrage": "120",
    "sbFormat": "Console",
    "bsJours": "90",
    "bsMaxDumps": "60",
    "bsFormat": "Console",
    "upCible": "comptabilite",
    "upJours": "45",
    "upFormat": "Console",
    "perfEchantillons": "9",
    "perfTopProcessus": "35",
    "perfJours": "30",
    "perfFormat": "Console",
    "lacInclureDesactives": "Oui",
    "lacGroupes": "Tous les groupes locaux",
    "lacFormat": "Console",
    "warTypeCompte": "Compte Entra ID",
    "warAutorisation": "Propriétaire identifié présent",
    "warFormat": "Console",
    "svcNom": "WSearch",
    "svcAction": "Arrêter",
    "svcJours": "45",
    "svcJournal": "C:\\Kjemo\\Journaux\\Comptabilite",
    "svcConfirmation": "",
    "svcFormat": "Console",
    "fwPortee": "Règles autorisantes entrantes et sortantes",
    "fwMaxRegles": "400",
    "fwFormat": "Console",
    "defJours": "120",
    "defExclusions": "Oui, avec avertissement",
    "defFormat": "Console",
    "dsType": "Personnalisée",
    "dsChemin": "C:\\Kjemo\\Quarantaine\\Comptabilite",
    "dsConfirmation": "",
    "dsFormat": "Console",
    "sfcEtape": "Vérification sans correction",
    "sfcLignesJournal": "300",
    "sfcConfirmation": "",
    "sfcFormat": "Console",
    "dsmEtape": "ScanHealth — vérification réelle",
    "dsmSource": "C:\\Sources\\Comptabilite\\install.esd",
    "dsmLimiterWU": "Non",
    "dsmConfirmation": "",
    "dsmFormat": "Console",
    "rpNom": "KJEMO - comptabilite",
    "rpType": "MODIFY_SETTINGS",
    "rpEtatProtection": "Non constaté",
    "rpConfirmation": "",
    "rpFormat": "Console",
    "smeVariante": "Réseau",
    "smeApercuBcd": "Oui, en aperçu documentaire avec son annulation",
    "smeFormat": "Console",
    "stoSeuilAlerte": "40",
    "stoJoursTemporaires": "90",
    "stoFormat": "Console",
    "tcEmplacements": "Tous les emplacements de la liste blanche",
    "tcAgeMinimum": "180",
    "tcTailleMaxMo": "20480",
    "tcJournal": "C:\\Kjemo\\Journaux\\Comptabilite",
    "tcConfirmation": "",
    "tcFormat": "Console",
    "rbPortee": "Tous les volumes locaux",
    "rbDetailAge": "Non",
    "rbFormat": "Console",
    "bcNavigateurs": "Chromium seulement",
    "bcDetailProfils": "Non",
    "bcFormat": "Console"
  },
  "virgule-et-point-virgule": {
    "sbJours": "5",
    "sbMaxDemarrage": "25",
    "sbFormat": "JSON",
    "bsJours": "15",
    "bsMaxDumps": "10",
    "bsFormat": "JSON",
    "upCible": "direction",
    "upJours": "7",
    "upFormat": "JSON",
    "perfEchantillons": "2",
    "perfTopProcessus": "8",
    "perfJours": "5",
    "perfFormat": "JSON",
    "lacInclureDesactives": "Non",
    "lacGroupes": "Tous les groupes locaux",
    "lacFormat": "HTML",
    "warTypeCompte": "À déterminer par le script",
    "warAutorisation": "Mandat du service informatique",
    "warFormat": "JSON",
    "svcNom": "Fax",
    "svcAction": "Démarrer",
    "svcJours": "7",
    "svcJournal": "C:\\Kjemo\\Journaux\\Direction",
    "svcConfirmation": "",
    "svcFormat": "JSON",
    "fwPortee": "Profils seulement",
    "fwMaxRegles": "35",
    "fwFormat": "JSON",
    "defJours": "14",
    "defExclusions": "Compter seulement",
    "defFormat": "HTML",
    "dsType": "Rapide",
    "dsChemin": "C:\\Kjemo\\Quarantaine\\Direction",
    "dsConfirmation": "",
    "dsFormat": "HTML",
    "sfcEtape": "Vérification et réparation",
    "sfcLignesJournal": "25",
    "sfcConfirmation": "",
    "sfcFormat": "JSON",
    "dsmEtape": "RestoreHealth — réparation",
    "dsmSource": "",
    "dsmLimiterWU": "Non",
    "dsmConfirmation": "",
    "dsmFormat": "HTML",
    "rpNom": "KJEMO - direction",
    "rpType": "APPLICATION_INSTALL",
    "rpEtatProtection": "Constaté : lecteur système protégé",
    "rpConfirmation": "",
    "rpFormat": "HTML",
    "smeVariante": "Minimal",
    "smeApercuBcd": "Non, procédure graphique seulement",
    "smeFormat": "HTML",
    "stoSeuilAlerte": "10",
    "stoJoursTemporaires": "7",
    "stoFormat": "JSON",
    "tcEmplacements": "Session et cache Internet",
    "tcAgeMinimum": "14",
    "tcTailleMaxMo": "1024",
    "tcJournal": "C:\\Kjemo\\Journaux\\Direction",
    "tcConfirmation": "",
    "tcFormat": "HTML",
    "rbPortee": "Disque système seulement",
    "rbDetailAge": "Non",
    "rbFormat": "HTML",
    "bcNavigateurs": "Microsoft Edge seulement",
    "bcDetailProfils": "Oui",
    "bcFormat": "HTML"
  },
  "chemin-racine-c": {
    "sbJours": "30",
    "sbMaxDemarrage": "200",
    "sbFormat": "HTML",
    "bsJours": "180",
    "bsMaxDumps": "100",
    "bsFormat": "HTML",
    "upCible": "",
    "upJours": "90",
    "upFormat": "HTML",
    "perfEchantillons": "10",
    "perfTopProcessus": "50",
    "perfJours": "60",
    "perfFormat": "HTML",
    "lacInclureDesactives": "Oui",
    "lacGroupes": "Administrateurs et bureau à distance",
    "lacFormat": "JSON",
    "warTypeCompte": "Compte local",
    "warAutorisation": "Non établie",
    "warFormat": "HTML",
    "svcNom": "Themes2",
    "svcAction": "Redémarrer",
    "svcJours": "60",
    "svcJournal": "C:\\Kjemo",
    "svcConfirmation": "",
    "svcFormat": "HTML",
    "fwPortee": "Règles autorisantes entrantes",
    "fwMaxRegles": "400",
    "fwFormat": "HTML",
    "defJours": "180",
    "defExclusions": "Oui, avec avertissement",
    "defFormat": "JSON",
    "dsType": "Personnalisée",
    "dsChemin": "C:\\Kjemo",
    "dsConfirmation": "",
    "dsFormat": "JSON",
    "sfcEtape": "Diagnostic des prérequis",
    "sfcLignesJournal": "200",
    "sfcConfirmation": "",
    "sfcFormat": "HTML",
    "dsmEtape": "CheckHealth — lecture d’un indicateur",
    "dsmSource": "C:\\Sources",
    "dsmLimiterWU": "Oui",
    "dsmConfirmation": "",
    "dsmFormat": "JSON",
    "rpNom": "KJEMO - racine",
    "rpType": "DEVICE_DRIVER_INSTALL",
    "rpEtatProtection": "Non constaté",
    "rpConfirmation": "",
    "rpFormat": "JSON",
    "smeVariante": "Invite de commandes",
    "smeApercuBcd": "Non, procédure graphique seulement",
    "smeFormat": "JSON",
    "stoSeuilAlerte": "50",
    "stoJoursTemporaires": "365",
    "stoFormat": "HTML",
    "tcEmplacements": "Temporaires de la session seulement",
    "tcAgeMinimum": "365",
    "tcTailleMaxMo": "51200",
    "tcJournal": "C:\\Kjemo",
    "tcConfirmation": "",
    "tcFormat": "JSON",
    "rbPortee": "Tous les volumes locaux",
    "rbDetailAge": "Oui",
    "rbFormat": "JSON",
    "bcNavigateurs": "Tous ceux qui sont détectés",
    "bcDetailProfils": "Oui",
    "bcFormat": "JSON"
  },
  "chemin-avec-apostrophe": {
    "sbJours": "1",
    "sbMaxDemarrage": "5",
    "sbFormat": "CSV",
    "bsJours": "1",
    "bsMaxDumps": "1",
    "bsFormat": "CSV",
    "upCible": "o-brien",
    "upJours": "1",
    "upFormat": "CSV",
    "perfEchantillons": "4",
    "perfTopProcessus": "3",
    "perfJours": "1",
    "perfFormat": "CSV",
    "lacInclureDesactives": "Non",
    "lacGroupes": "Administrateurs et bureau à distance",
    "lacFormat": "Console",
    "warTypeCompte": "Compte Microsoft",
    "warAutorisation": "Propriétaire identifié présent",
    "warFormat": "CSV",
    "svcNom": "PrintNotify",
    "svcAction": "Arrêter",
    "svcJours": "1",
    "svcJournal": "C:\\Kjemo\\Journaux\\O'Brien",
    "svcConfirmation": "",
    "svcFormat": "CSV",
    "fwPortee": "Règles autorisantes entrantes et sortantes",
    "fwMaxRegles": "5",
    "fwFormat": "CSV",
    "defJours": "1",
    "defExclusions": "Compter seulement",
    "defFormat": "Console",
    "dsType": "Rapide",
    "dsChemin": "C:\\Kjemo\\Quarantaine\\O'Brien",
    "dsConfirmation": "",
    "dsFormat": "CSV",
    "sfcEtape": "Vérification sans correction",
    "sfcLignesJournal": "5",
    "sfcConfirmation": "",
    "sfcFormat": "CSV",
    "dsmEtape": "ScanHealth — vérification réelle",
    "dsmSource": "C:\\Sources\\O'Brien\\install.wim",
    "dsmLimiterWU": "Non",
    "dsmConfirmation": "",
    "dsmFormat": "Console",
    "rpNom": "KJEMO - poste O'Brien",
    "rpType": "MODIFY_SETTINGS",
    "rpEtatProtection": "Constaté : lecteur système protégé",
    "rpConfirmation": "",
    "rpFormat": "Console",
    "smeVariante": "Réseau",
    "smeApercuBcd": "Oui, en aperçu documentaire avec son annulation",
    "smeFormat": "CSV",
    "stoSeuilAlerte": "2",
    "stoJoursTemporaires": "0",
    "stoFormat": "CSV",
    "tcEmplacements": "Tous les emplacements de la liste blanche",
    "tcAgeMinimum": "1",
    "tcTailleMaxMo": "1",
    "tcJournal": "C:\\Kjemo\\Journaux\\O'Brien",
    "tcConfirmation": "",
    "tcFormat": "Console",
    "rbPortee": "Disque système seulement",
    "rbDetailAge": "Oui",
    "rbFormat": "Console",
    "bcNavigateurs": "Microsoft Edge seulement",
    "bcDetailProfils": "Non",
    "bcFormat": "Console"
  }
};

// ---------------------------------------------------------------------------
// LOT 7 — valeurs Linux pour les huit jeux de données.
//
// MESURE AVANT CORRECTION : les 80 fichiers .sh produits par les dix
// assistants Linux ne portaient que DIX empreintes SHA-256 distinctes. Les
// huit jeux d'un même assistant étaient rigoureusement identiques octet pour
// octet : aucune valeur saisie n'atteignait le script, et le corpus .sh ne
// prouvait RIEN sur le transport des valeurs. Le dépôt avait déjà payé cette
// erreur deux fois (LOT 4, LOT 5) ; c'est la troisième.
//
// Ces valeurs ne sont PAS fusionnées dans DATASETS.values comme celles des
// lots précédents, et c'est volontaire : le champ « source » existe aussi sur
// un assistant Windows. Le fusionner globalement changerait un script figé et
// casserait la non-régression des 856. L'application est donc faite outil par
// outil, et seulement quand plateformeDe(tool) === 'Linux' (voir plus bas).
//
// Le champ « confirmation » EST surchargé : blocConfirmation() pose
// KJEMO_CONFIRMATION_OK=0 à l'écriture du script quelle que soit la phrase,
// et la comparaison a lieu à l'exécution. Le surcharger teste donc le
// transport d'une phrase accentuée sans désarmer le verrou.
// ---------------------------------------------------------------------------
const VALEURS_LINUX = {
  "apostrophe-ascii": {
    cible: "/dev/sdb", inclureSignatures: "Oui", inclureRaid: "Oui", tailleMiniGio: "5",
    joursJournal: "3", seuilDisque: "80", nbUnites: "8", lignes: "40",
    profondeur: "2", nbProcessus: "5", heure: "4", seuilInactif: "45",
    format: "JSON", inclurePaquets: "Tous", inclureMateriel: "Non",
    inclureChaine: "Non", priorite: "warning", periode: "6 hours ago",
    demarrage: "Actuel", avecJournal: "Non", avecSimulation: "Oui",
    avecVerrou: "Oui", compression: "zstd", sections: "Systemes",
    frequence: "Horaire", portee: "Tous",
    unite: "nginx.service", motif: "O'Brien",
    nomScript: "traitement-d-adam", description: "Traite les fichiers de D'Adam et ecrit un rapport.",
    source: "/srv/donnees/D'Adam", destination: "/srv/sauvegardes/D'Adam",
    etiquette: "donnees-dadam", confirmation: "SAUVEGARDER donnees-dadam",
    script: "/srv/scripts/traitement-d'adam.sh", journal: "/srv/scripts/journaux/d'adam.log",
  },
  "apostrophe-typographique": {
    cible: "", inclureSignatures: "Non", inclureRaid: "Oui", tailleMiniGio: "1",
    joursJournal: "5", seuilDisque: "90", nbUnites: "20", lignes: "120",
    profondeur: "3", nbProcessus: "15", heure: "22", seuilInactif: "120",
    format: "CSV", inclurePaquets: "Aucun", inclureMateriel: "Oui",
    inclureChaine: "Oui", priorite: "crit", periode: "7 days ago",
    demarrage: "Precedent", avecJournal: "Oui", avecSimulation: "Non",
    avecVerrou: "Oui", compression: "aucune", sections: "Services",
    frequence: "Hebdomadaire", portee: "Systeme",
    unite: "ssh.service", motif: "D\u2019Arcy",
    nomScript: "traitement-typo", description: "Traite les fichiers de D\u2019Adam \u2014 accueil.",
    source: "/srv/donnees/D\u2019Adam", destination: "/srv/sauvegardes/D\u2019Adam",
    etiquette: "donnees-typo", confirmation: "",
    script: "/srv/scripts/traitement-d\u2019adam.sh", journal: "/srv/scripts/journaux/d\u2019adam.log",
  },
  "dollar-backtick-guillemets": {
    cible: "/dev/nvme0n1", inclureSignatures: "Oui", inclureRaid: "Non", tailleMiniGio: "0",
    joursJournal: "1", seuilDisque: "70", nbUnites: "30", lignes: "200",
    profondeur: "4", nbProcessus: "20", heure: "0", seuilInactif: "365",
    format: "JSON", inclurePaquets: "Principaux", inclureMateriel: "Non",
    inclureChaine: "Oui", priorite: "emerg", periode: "15 min ago",
    demarrage: "Periode", avecJournal: "Oui", avecSimulation: "Oui",
    avecVerrou: "Non", compression: "gzip", sections: "Complet",
    frequence: "Mensuel", portee: "Humains",
    unite: "cockpit.socket", motif: "$(id -u)",
    nomScript: "traitement-dollar", description: "Ecrit dans $HOME puis lit `pwd` et \"cite\" le resultat.",
    source: "/srv/donnees/$HOME-et-`pwd`", destination: "/srv/sauvegardes/\"guillemets\"",
    etiquette: "dollar-backtick", confirmation: "SAUVEGARDER dollar-backtick",
    script: "/srv/scripts/$(whoami).sh", journal: "/srv/scripts/journaux/`date`.log",
  },
  "espaces-et-accents": {
    cible: "/dev/sdc", inclureSignatures: "Non", inclureRaid: "Non", tailleMiniGio: "10",
    joursJournal: "7", seuilDisque: "95", nbUnites: "12", lignes: "60",
    profondeur: "1", nbProcessus: "8", heure: "12", seuilInactif: "30",
    format: "CSV", inclurePaquets: "Tous", inclureMateriel: "Oui",
    inclureChaine: "Non", priorite: "notice", periode: "1 hour ago",
    demarrage: "Actuel", avecJournal: "Non", avecSimulation: "Non",
    avecVerrou: "Non", compression: "zstd", sections: "Complet",
    frequence: "Quotidien", portee: "Tous",
    unite: "systemd-journald.service", motif: "\u00e9chec de d\u00e9marrage",
    nomScript: "traitement-accentue", description: "Traite les donn\u00e9es partag\u00e9es du service r\u00e9seau.",
    source: "/srv/Donn\u00e9es partag\u00e9es/Hiver 2026", destination: "/srv/Sauvegardes archiv\u00e9es",
    etiquette: "donnees-partagees", confirmation: "",
    script: "/srv/scripts/mon traitement accentu\u00e9.sh", journal: "/srv/scripts/journaux/\u00e9tat r\u00e9seau.log",
  },
  "virgule-et-point-virgule": {
    cible: "/dev/mapper/vg0-lv0", inclureSignatures: "Oui", inclureRaid: "Oui", tailleMiniGio: "3",
    joursJournal: "2", seuilDisque: "60", nbUnites: "25", lignes: "90",
    profondeur: "2", nbProcessus: "12", heure: "6", seuilInactif: "60",
    format: "JSON", inclurePaquets: "Aucun", inclureMateriel: "Non",
    inclureChaine: "Oui", priorite: "alert", periode: "2 days ago",
    demarrage: "Periode", avecJournal: "Oui", avecSimulation: "Oui",
    avecVerrou: "Oui", compression: "gzip", sections: "Systemes",
    frequence: "Horaire", portee: "Systeme",
    unite: "smbd.service", motif: "err,warn;crit",
    nomScript: "traitement-ponctuation", description: "Traite A, puis B ; enfin C.",
    source: "/srv/donnees/A, B et C", destination: "/srv/sauvegardes/lot1;lot2",
    etiquette: "a-b_c", confirmation: "SAUVEGARDER a-b_c",
    script: "/srv/scripts/etape1;etape2.sh", journal: "/srv/scripts/journaux/a,b.log",
  },
  "chemin-racine-c": {
    cible: "/dev/sdd1", inclureSignatures: "Non", inclureRaid: "Oui", tailleMiniGio: "7",
    joursJournal: "4", seuilDisque: "75", nbUnites: "10", lignes: "30",
    profondeur: "3", nbProcessus: "6", heure: "18", seuilInactif: "180",
    format: "JSON", inclurePaquets: "Aucun", inclureMateriel: "Oui",
    inclureChaine: "Non", priorite: "info", periode: "30 days ago",
    demarrage: "Precedent", avecJournal: "Non", avecSimulation: "Oui",
    avecVerrou: "Non", compression: "aucune", sections: "Services",
    frequence: "Mensuel", portee: "Systeme",
    unite: "nfs-server.service", motif: "C:\\Windows",
    nomScript: "traitement-voisin-protege", description: "Recoit un chemin voisin d une racine protegee.",
    source: "/srv/etc-sauvegarde/donnees", destination: "/srv/gitlab-archives",
    etiquette: "voisin-protege", confirmation: "",
    script: "/srv/scripts/sous-dossier/traitement.sh", journal: "/srv/scripts/journaux/cron.log",
  },
  "chemin-avec-apostrophe": {
    cible: "", inclureSignatures: "Oui", inclureRaid: "Non", tailleMiniGio: "64",
    joursJournal: "6", seuilDisque: "88", nbUnites: "18", lignes: "150",
    profondeur: "5", nbProcessus: "25", heure: "2", seuilInactif: "15",
    format: "CSV", inclurePaquets: "Tous", inclureMateriel: "Non",
    inclureChaine: "Oui", priorite: "err", periode: "1 day ago",
    demarrage: "Actuel", avecJournal: "Oui", avecSimulation: "Non",
    avecVerrou: "Oui", compression: "zstd", sections: "Complet",
    frequence: "Hebdomadaire", portee: "Tous",
    unite: "cron.service", motif: "l'\u00e9chec d'hier",
    nomScript: "traitement-apostrophe", description: "Traite l'export d'hier et l'archive.",
    source: "/srv/d'adam/projet d'\u00e9t\u00e9", destination: "/srv/sauvegardes/d'adam",
    etiquette: "export-d-hier", confirmation: "SAUVEGARDER export-d-hier",
    script: "/srv/scripts/l'export d'hier.sh", journal: "/srv/scripts/journaux/l'echec.log",
  },
};

// ---------------------------------------------------------------------------
// LOT 7 — VALEURS PAR OUTIL
//
// VALEURS_LINUX est indexee par IDENTIFIANT DE CHAMP, et plusieurs assistants
// partagent des noms de champ : « confirmation », « etiquette », « source ».
// Le premier essai a donc donne a linux-disk-partition-mount la phrase de
// confirmation de bash-backup-directory — et la generation a echoue, a juste
// titre, puisque ce champ-la doit contenir le peripherique exact.
//
// Cette table-ci est indexee par OUTIL puis par champ, et elle est appliquee
// APRES les deux autres. Elle sert aux champs dont la valeur n a de sens que
// pour un assistant : une confirmation qui nomme sa cible, une etiquette dont
// la longueur depend du systeme de fichiers choisi juste au-dessus.
// ---------------------------------------------------------------------------
const VALEURS_PAR_OUTIL = {
  // Reseau. « cible » et « interface » sont des identifiants de champ partages
  // avec des assistants de stockage, dont les valeurs globales sont des
  // peripheriques : d'ou cette table par outil.
  'linux-dns-diagnostic': {
    'apostrophe-ascii':          { nom: 'archive.ubuntu.com', domaineAd: 'kjemo.local' },
    'apostrophe-typographique':  { nom: 'documentation.ubuntu.com', domaineAd: '' },
    'dollar-backtick-guillemets':{ nom: '1.1.1.1', domaineAd: 'labo.interne' },
    'espaces-et-accents':        { nom: 'srv-fichiers.labo.local', domaineAd: '' },
    'virgule-et-point-virgule':  { nom: 'dc01.kjemo.local', domaineAd: 'kjemo.local' },
    'chemin-racine-c':           { nom: 'localhost', domaineAd: '' },
    'chemin-avec-apostrophe':    { nom: 'd-adam.labo.local', domaineAd: 'd-adam.local' },
  },
  'linux-firewall-audit': {
    'apostrophe-ascii':          { portVerifie: '22', lireIptables: 'Non' },
    'apostrophe-typographique':  { portVerifie: '', lireIptables: 'Oui' },
    'dollar-backtick-guillemets':{ portVerifie: '9090', lireIptables: 'Non' },
    'espaces-et-accents':        { portVerifie: '445', lireIptables: 'Oui' },
    'virgule-et-point-virgule':  { portVerifie: '2049', lireIptables: 'Non' },
    'chemin-racine-c':           { portVerifie: '65535', lireIptables: 'Non' },
    'chemin-avec-apostrophe':    { portVerifie: '389', lireIptables: 'Oui' },
  },
  'linux-network-diagnostic': {
    'apostrophe-ascii':          { interface: 'enp0s3', cible: 'archive.ubuntu.com', testerConnectivite: 'Oui' },
    'apostrophe-typographique':  { interface: '', cible: '1.1.1.1', testerConnectivite: 'Non' },
    'dollar-backtick-guillemets':{ interface: 'ens18', cible: '192.168.30.1', testerConnectivite: 'Oui' },
    'espaces-et-accents':        { interface: 'wlp2s0', cible: 'documentation.ubuntu.com', testerConnectivite: 'Non' },
    'virgule-et-point-virgule':  { interface: 'eth0.30', cible: 'srv-fichiers.labo.local', testerConnectivite: 'Oui' },
    'chemin-racine-c':           { interface: 'lo', cible: '127.0.0.1', testerConnectivite: 'Non' },
    'chemin-avec-apostrophe':    { interface: 'br-lan', cible: 'dc01.kjemo.local', testerConnectivite: 'Oui' },
  },
  'netplan-readiness': {
    'apostrophe-ascii':          { confirmation: 'enp0s3', interface: 'enp0s3', methode: 'Adresse statique', adresseCidr: '192.168.30.10/24', passerelle: '192.168.30.1', dns: '192.168.30.1 1.1.1.1', nomFichier: '99-kjemo-reseau.yaml' },
    'apostrophe-typographique':  { confirmation: '', interface: 'ens18', methode: 'DHCP', adresseCidr: '', passerelle: '', dns: '', nomFichier: '99-dhcp.yaml' },
    'dollar-backtick-guillemets':{ confirmation: 'enp1s0', interface: 'enp1s0', methode: 'Adresse statique', adresseCidr: '10.10.0.5/16', passerelle: '10.10.0.1', dns: '10.10.0.1', nomFichier: '70-labo.yaml' },
    'espaces-et-accents':        { confirmation: '', interface: 'eth0.30', methode: 'Adresse statique', adresseCidr: '172.16.8.20/22', passerelle: '172.16.8.1', dns: '172.16.8.1 9.9.9.9', nomFichier: '60-vlan30.yaml' },
    'virgule-et-point-virgule':  { confirmation: 'br-lan', interface: 'br-lan', methode: 'DHCP', adresseCidr: '', passerelle: '', dns: '', nomFichier: '99-pont.yaml' },
    'chemin-racine-c':           { confirmation: '', interface: 'enx001122334455', methode: 'Adresse statique', adresseCidr: '192.168.1.200/24', passerelle: '192.168.1.254', dns: '192.168.1.254', nomFichier: '80-usb.yaml' },
    'chemin-avec-apostrophe':    { confirmation: 'wlp2s0', interface: 'wlp2s0', methode: 'DHCP', adresseCidr: '', passerelle: '', dns: '', nomFichier: '99-sansfil.yaml' },
  },
  // Services et journaux. Les champs « unite », « periode » et « priorite »
  // sont partages avec des assistants plus anciens dont le vocabulaire n'est
  // pas le meme : les valeurs globales de VALEURS_LINUX ne conviennent donc
  // pas, et c'est exactement la raison d'etre de cette table par outil.
  'linux-package-diagnostic': {
    'apostrophe-ascii':          { paquets: 'quota acl', verifierIntegrite: 'Non', simulerInstallation: 'Oui' },
    'apostrophe-typographique':  { paquets: '', verifierIntegrite: 'Oui', simulerInstallation: 'Non' },
    'dollar-backtick-guillemets':{ paquets: 'mdadm', verifierIntegrite: 'Non', simulerInstallation: 'Oui' },
    'espaces-et-accents':        { paquets: 'samba winbind krb5-user', verifierIntegrite: 'Non', simulerInstallation: 'Non' },
    'virgule-et-point-virgule':  { paquets: 'nfs-kernel-server,nfs-common', verifierIntegrite: 'Oui', simulerInstallation: 'Oui' },
    'chemin-racine-c':           { paquets: 'cockpit', verifierIntegrite: 'Non', simulerInstallation: 'Non' },
    'chemin-avec-apostrophe':    { paquets: 'openssh-server', verifierIntegrite: 'Oui', simulerInstallation: 'Oui' },
  },
  'linux-time-sync-diagnostic': {
    'apostrophe-ascii':          { lireHorlogeMaterielle: 'Oui', lignesJournal: '20' },
    'apostrophe-typographique':  { lireHorlogeMaterielle: 'Non', lignesJournal: '0' },
    'dollar-backtick-guillemets':{ lireHorlogeMaterielle: 'Oui', lignesJournal: '200' },
    'espaces-et-accents':        { lireHorlogeMaterielle: 'Non', lignesJournal: '50' },
    'virgule-et-point-virgule':  { lireHorlogeMaterielle: 'Oui', lignesJournal: '5' },
    'chemin-racine-c':           { lireHorlogeMaterielle: 'Non', lignesJournal: '120' },
    'chemin-avec-apostrophe':    { lireHorlogeMaterielle: 'Oui', lignesJournal: '75' },
  },
  'systemd-service-control': {
    'apostrophe-ascii':          { unite: 'nginx.service', action: 'Redemarrer', confirmation: 'nginx.service' },
    'apostrophe-typographique':  { unite: 'cron.service', action: 'Demarrer', confirmation: '' },
    'dollar-backtick-guillemets':{ unite: 'chrony.service', action: 'Arreter', confirmation: 'chrony.service' },
    'espaces-et-accents':        { unite: 'smbd.service', action: 'Activer au demarrage', confirmation: '' },
    'virgule-et-point-virgule':  { unite: 'nfs-server.service', action: 'Desactiver au demarrage', confirmation: 'nfs-server.service' },
    'chemin-racine-c':           { unite: 'cockpit.socket', action: 'Recharger', confirmation: '' },
    'chemin-avec-apostrophe':    { unite: 'mdmonitor.service', action: 'Redemarrer', confirmation: 'mdmonitor.service' },
  },
  'systemd-service-diagnostic': {
    'apostrophe-ascii':          { unite: 'ssh.service', periode: 'Depuis ce demarrage', priorite: 'Erreurs et pires', lignes: '200' },
    'apostrophe-typographique':  { unite: '', periode: '7 jours', priorite: 'Critiques seulement', lignes: '50' },
    'dollar-backtick-guillemets':{ unite: 'smbd.service', periode: '15 minutes', priorite: 'Tout', lignes: '1000' },
    'espaces-et-accents':        { unite: 'nfs-server.service', periode: '1 heure', priorite: 'Avertissements et pires', lignes: '300' },
    'virgule-et-point-virgule':  { unite: 'cron.service', periode: '24 heures', priorite: 'Erreurs et pires', lignes: '75' },
    'chemin-racine-c':           { unite: '', periode: 'Depuis ce demarrage', priorite: 'Tout', lignes: '5000' },
    'chemin-avec-apostrophe':    { unite: 'cockpit.service', periode: '7 jours', priorite: 'Avertissements et pires', lignes: '120' },
  },
  // Les quatre assistants de comptes et permissions. Les huit jeux doivent
  // produire huit scripts DISTINCTS : sans valeurs propres, « recursif » et
  // « format » suffisent rarement, et plusieurs jeux retombent sur le meme
  // fichier. C'est le defaut que les LOTS 4, 5 et 7 ont deja paye, et que le
  // Plan 3 de sh-hygiene refuse desormais.
  'linux-permission-audit': {
    'apostrophe-ascii':          { chemin: '/srv/donnees-dadam', recursif: 'Oui', chercherRisques: 'Oui' },
    'apostrophe-typographique':  { chemin: '/srv/donnees-typo', recursif: 'Non', chercherRisques: 'Non' },
    'dollar-backtick-guillemets':{ chemin: '/srv/dollar', recursif: 'Oui', chercherRisques: 'Non' },
    'espaces-et-accents':        { chemin: '/srv/Donnees partagees', recursif: 'Non', chercherRisques: 'Oui' },
    'virgule-et-point-virgule':  { chemin: '/srv/a-b_c', recursif: 'Oui', chercherRisques: 'Oui' },
    'chemin-racine-c':           { chemin: '/mnt/voisin', recursif: 'Non', chercherRisques: 'Non' },
    'chemin-avec-apostrophe':    { chemin: '/srv/d-adam/projet', recursif: 'Oui', chercherRisques: 'Non' },
  },
  'linux-permission-change': {
    'apostrophe-ascii':          { chemin: '/srv/donnees-dadam', proprietaire: 'o-brien', groupe: 'partage', mode: '2770', recursif: 'Non', confirmation: '/srv/donnees-dadam' },
    'apostrophe-typographique':  { chemin: '/srv/donnees-typo', proprietaire: '', groupe: 'gg-typo', mode: '750', recursif: 'Oui', confirmation: '' },
    'dollar-backtick-guillemets':{ chemin: '/srv/dollar', proprietaire: 'dadam', groupe: '', mode: '', recursif: 'Non', confirmation: '/srv/dollar' },
    'espaces-et-accents':        { chemin: '/srv/Donnees partagees', proprietaire: 'partage-admin', groupe: 'partage', mode: '2750', recursif: 'Oui', confirmation: '' },
    'virgule-et-point-virgule':  { chemin: '/srv/a-b_c', proprietaire: '', groupe: '', mode: '1770', recursif: 'Non', confirmation: '/srv/a-b_c' },
    'chemin-racine-c':           { chemin: '/mnt/voisin', proprietaire: 'voisin', groupe: 'voisins', mode: '700', recursif: 'Non', confirmation: '' },
    'chemin-avec-apostrophe':    { chemin: '/srv/d-adam/projet', proprietaire: 'd-adam', groupe: 'projet', mode: '770', recursif: 'Oui', confirmation: '/srv/d-adam/projet' },
  },
  'linux-permission-acl': {
    'apostrophe-ascii':          { chemin: '/srv/donnees-dadam', typeEntree: 'Utilisateur', nomEntree: 'o-brien', droits: 'rwx', appliquerDefaut: 'Oui', recursif: 'Non', confirmation: '/srv/donnees-dadam' },
    'apostrophe-typographique':  { chemin: '/srv/donnees-typo', typeEntree: 'Groupe', nomEntree: 'gg-typo', droits: 'r-x', appliquerDefaut: 'Non', recursif: 'Oui', confirmation: '' },
    'dollar-backtick-guillemets':{ chemin: '/srv/dollar', typeEntree: 'Utilisateur', nomEntree: 'dadam', droits: 'rw-', appliquerDefaut: 'Non', recursif: 'Non', confirmation: '/srv/dollar' },
    'espaces-et-accents':        { chemin: '/srv/Donnees partagees', typeEntree: 'Groupe', nomEntree: 'partage', droits: 'rwx', appliquerDefaut: 'Oui', recursif: 'Oui', confirmation: '' },
    'virgule-et-point-virgule':  { chemin: '/srv/a-b_c', typeEntree: 'Utilisateur', nomEntree: 'a-b_c', droits: 'r--', appliquerDefaut: 'Non', recursif: 'Non', confirmation: '/srv/a-b_c' },
    'chemin-racine-c':           { chemin: '/mnt/voisin', typeEntree: 'Groupe', nomEntree: 'voisins', droits: 'rw-', appliquerDefaut: 'Oui', recursif: 'Non', confirmation: '' },
    'chemin-avec-apostrophe':    { chemin: '/srv/d-adam/projet', typeEntree: 'Utilisateur', nomEntree: 'd-adam', droits: 'rwx', appliquerDefaut: 'Oui', recursif: 'Oui', confirmation: '/srv/d-adam/projet' },
  },
  'linux-user-create': {
    'apostrophe-ascii':          { nomUtilisateur: 'o-brien', commentaire: 'O Brien (apostrophe ASCII dans le nom)', groupePrincipal: '', groupesSecondaires: 'partage', shell: '/bin/bash', creerHome: 'Oui', confirmation: 'o-brien' },
    'apostrophe-typographique':  { nomUtilisateur: 'gg-typo', commentaire: 'Nom avec apostrophe typographique \u2019 au milieu', groupePrincipal: 'etudiants', groupesSecondaires: '', shell: '/usr/sbin/nologin', creerHome: 'Non', confirmation: '' },
    'dollar-backtick-guillemets':{ nomUtilisateur: 'dadam', commentaire: 'Valeur avec $HOME et `date` et "guillemets"', groupePrincipal: '', groupesSecondaires: 'partage,projet', shell: '/bin/bash', creerHome: 'Oui', confirmation: 'dadam' },
    'espaces-et-accents':        { nomUtilisateur: 'partage-admin', commentaire: 'Donnees partagees, equipe reseau', groupePrincipal: 'partage', groupesSecondaires: '', shell: '/bin/bash', creerHome: 'Oui', confirmation: '' },
    'virgule-et-point-virgule':  { nomUtilisateur: 'a-b_c', commentaire: 'a, b; c - separateurs dans le commentaire', groupePrincipal: '', groupesSecondaires: 'projet', shell: '/usr/sbin/nologin', creerHome: 'Non', confirmation: 'a-b_c' },
    'chemin-racine-c':           { nomUtilisateur: 'voisin', commentaire: 'Compte de service, aucune session', groupePrincipal: 'voisins', groupesSecondaires: '', shell: '/usr/sbin/nologin', creerHome: 'Non', confirmation: '' },
    'chemin-avec-apostrophe':    { nomUtilisateur: 'd-adam', commentaire: 'D Adam, projet /srv/d-adam', groupePrincipal: '', groupesSecondaires: 'projet,partage', shell: '/bin/bash', creerHome: 'Oui', confirmation: 'd-adam' },
  },
  'linux-raid1-create': {
    'apostrophe-ascii':          { ensemble: '/dev/md1', membre1: '/dev/sdb', membre2: '/dev/sdc', spare: '/dev/sdd', pointMontage: '/srv/raid-dadam', systemeFichiers: 'ext4', confirmation: '/dev/md1' },
    'apostrophe-typographique':  { ensemble: '/dev/md2', membre1: '/dev/sdb', membre2: '/dev/sdc', spare: '', pointMontage: '/srv/raid-typo', systemeFichiers: 'xfs', confirmation: '' },
    'dollar-backtick-guillemets':{ ensemble: '/dev/md3', membre1: '/dev/nvme0n1', membre2: '/dev/nvme1n1', spare: '/dev/nvme2n1', pointMontage: '/srv/raid-dollar', systemeFichiers: 'ext4', confirmation: '/dev/md3' },
    'espaces-et-accents':        { ensemble: '/dev/md4', membre1: '/dev/vdb', membre2: '/dev/vdc', spare: '', pointMontage: '/srv/raid partage', systemeFichiers: 'ext4', confirmation: '' },
    'virgule-et-point-virgule':  { ensemble: '/dev/md5', membre1: '/dev/sdd', membre2: '/dev/sde', spare: '/dev/sdf', pointMontage: '/srv/a-b_c-raid', systemeFichiers: 'xfs', confirmation: '/dev/md5' },
    'chemin-racine-c':           { ensemble: '/dev/md6', membre1: '/dev/sdg', membre2: '/dev/sdh', spare: '', pointMontage: '/mnt/raid-voisin', systemeFichiers: 'ext4', confirmation: '' },
    'chemin-avec-apostrophe':    { ensemble: '/dev/md7', membre1: '/dev/sdi', membre2: '/dev/sdj', spare: '/dev/sdk', pointMontage: '/srv/d-adam/raid', systemeFichiers: 'ext4', confirmation: '/dev/md7' },
  },
  'linux-raid-member-manage': {
    'apostrophe-ascii':          { ensemble: '/dev/md1', membreSortant: '/dev/sdc', membreEntrant: '/dev/sdd', confirmation: '/dev/md1' },
    'apostrophe-typographique':  { ensemble: '/dev/md2', membreSortant: '/dev/sdc', membreEntrant: '', confirmation: '' },
    'dollar-backtick-guillemets':{ ensemble: '/dev/md3', membreSortant: '', membreEntrant: '/dev/nvme2n1', confirmation: '/dev/md3' },
    'espaces-et-accents':        { ensemble: '/dev/md4', membreSortant: '/dev/vdc', membreEntrant: '/dev/vdd', confirmation: '' },
    'virgule-et-point-virgule':  { ensemble: '/dev/md5', membreSortant: '/dev/sde', membreEntrant: '', confirmation: '/dev/md5' },
    'chemin-racine-c':           { ensemble: '/dev/md6', membreSortant: '', membreEntrant: '/dev/sdh', confirmation: '' },
    'chemin-avec-apostrophe':    { ensemble: '/dev/md7', membreSortant: '/dev/sdj', membreEntrant: '/dev/sdk', confirmation: '/dev/md7' },
  },
  'linux-quota-enable': {
    'apostrophe-ascii':          { pointMontage: '/srv/donnees-dadam', portee: 'Utilisateurs', confirmation: '/srv/donnees-dadam' },
    'apostrophe-typographique':  { pointMontage: '/srv/donnees-typo', portee: 'Groupes', confirmation: '' },
    'dollar-backtick-guillemets':{ pointMontage: '/srv/dollar', portee: 'Les deux', confirmation: '/srv/dollar' },
    'espaces-et-accents':        { pointMontage: '/srv/Donnees partagees', portee: 'Les deux', confirmation: '' },
    'virgule-et-point-virgule':  { pointMontage: '/srv/a-b_c', portee: 'Utilisateurs', confirmation: '/srv/a-b_c' },
    'chemin-racine-c':           { pointMontage: '/mnt/voisin', portee: 'Groupes', confirmation: '' },
    'chemin-avec-apostrophe':    { pointMontage: "/srv/d-adam/projet", portee: 'Les deux', confirmation: "/srv/d-adam/projet" },
  },
  'linux-quota-limits': {
    'apostrophe-ascii':          { pointMontage: '/srv/donnees-dadam', typeCible: 'Utilisateur', nomCible: 'o-brien', unite: 'Mio', espaceSoft: '900', espaceHard: '1000', inodesSoft: '0', inodesHard: '0', confirmation: 'o-brien' },
    'apostrophe-typographique':  { pointMontage: '/srv/donnees-typo', typeCible: 'Groupe', nomCible: 'gg-typo', unite: 'Gio', espaceSoft: '5', espaceHard: '10', inodesSoft: '1000', inodesHard: '2000', confirmation: '' },
    'dollar-backtick-guillemets':{ pointMontage: '/srv/dollar', typeCible: 'Utilisateur', nomCible: 'dadam', unite: 'Kio', espaceSoft: '0', espaceHard: '0', inodesSoft: '0', inodesHard: '0', confirmation: 'dadam' },
    'espaces-et-accents':        { pointMontage: '/srv/Donnees partagees', typeCible: 'Groupe', nomCible: 'partage', unite: 'Mio', espaceSoft: '2048', espaceHard: '4096', inodesSoft: '0', inodesHard: '0', confirmation: '' },
    'virgule-et-point-virgule':  { pointMontage: '/srv/a-b_c', typeCible: 'Utilisateur', nomCible: 'a-b_c', unite: 'Mio', espaceSoft: '100', espaceHard: '0', inodesSoft: '50', inodesHard: '0', confirmation: 'a-b_c' },
    'chemin-racine-c':           { pointMontage: '/mnt/voisin', typeCible: 'Utilisateur', nomCible: 'voisin', unite: 'Gio', espaceSoft: '1', espaceHard: '2', inodesSoft: '0', inodesHard: '0', confirmation: '' },
    'chemin-avec-apostrophe':    { pointMontage: "/srv/d-adam/projet", typeCible: 'Groupe', nomCible: 'export-hier', unite: 'Mio', espaceSoft: '512', espaceHard: '512', inodesSoft: '10', inodesHard: '20', confirmation: 'export-hier' },
  },
  'linux-disk-partition-mount': {
    'apostrophe-ascii': {
      peripherique: '/dev/sdb', pointMontage: '/srv/donnees-dadam', systemeFichiers: 'ext4',
      etiquette: 'dadam', optionsMontage: 'defaults,nofail', confirmation: '/dev/sdb',
    },
    'apostrophe-typographique': {
      peripherique: '/dev/sdc', pointMontage: '/srv/donnees-typo', systemeFichiers: 'xfs',
      etiquette: 'typo', optionsMontage: 'defaults', confirmation: '',
    },
    'dollar-backtick-guillemets': {
      peripherique: '/dev/nvme0n1', pointMontage: '/srv/dollar', systemeFichiers: 'ext4',
      etiquette: '', optionsMontage: 'defaults,noatime,nofail', confirmation: '/dev/nvme0n1',
    },
    'espaces-et-accents': {
      peripherique: '/dev/vdb', pointMontage: '/srv/Donnees partagees', systemeFichiers: 'ext4',
      etiquette: 'partage', optionsMontage: 'defaults,nofail', confirmation: '',
    },
    'virgule-et-point-virgule': {
      peripherique: '/dev/sdd', pointMontage: '/srv/a-b_c', systemeFichiers: 'xfs',
      etiquette: 'a-b_c', optionsMontage: 'defaults', confirmation: '/dev/sdd',
    },
    'chemin-racine-c': {
      peripherique: '/dev/mmcblk0', pointMontage: '/mnt/voisin', systemeFichiers: 'ext4',
      etiquette: 'voisin', optionsMontage: 'defaults,nofail', confirmation: '',
    },
    'chemin-avec-apostrophe': {
      peripherique: '/dev/sde', pointMontage: '/srv/d-adam/projet', systemeFichiers: 'ext4',
      etiquette: 'export', optionsMontage: 'defaults,noatime,nofail', confirmation: '/dev/sde',
    },
  },
  // Les quatre assistants SSH. « port », « confirmation » et « nomFichier »
  // sont partages avec le reseau et le stockage, dont les valeurs globales
  // n'ont rien a voir : d'ou cette table par outil. Pour
  // ssh-hardening-audit, les jeux ou un durcissement est demande doivent
  // nommer un compte — le formulaire refuse l'inverse, et c'est voulu.
  // Samba AD. « realm », « netbios » et « adresseIp » sont propres a ce
  // module ; « confirmation » et « compte » sont partages avec presque tout le
  // lot, et leurs valeurs globales n'ont rien a voir avec un domaine.
  'samba-ad-dc-readiness': {
    'apostrophe-ascii':          { realm: 'kjemo.lan', netbios: 'KJEMO' },
    'apostrophe-typographique':  { realm: 'labo.interne', netbios: 'LABO' },
    'dollar-backtick-guillemets':{ realm: 'dollar.lan', netbios: 'DOLLAR' },
    'espaces-et-accents':        { realm: 'partage.lan', netbios: 'PARTAGE' },
    'virgule-et-point-virgule':  { realm: 'a-b-c.lan', netbios: 'A-B-C' },
    'chemin-racine-c':           { realm: 'voisin.lan', netbios: 'VOISIN' },
    'chemin-avec-apostrophe':    { realm: 'd-adam.lan', netbios: 'D-ADAM' },
  },
  'samba-ad-dc-provision': {
    'apostrophe-ascii':          { realm: 'kjemo.lan', netbios: 'KJEMO', adresseIp: '192.168.30.10', nomFichier: 'kjemo-provision-ad.txt', confirmation: 'kjemo.lan' },
    'apostrophe-typographique':  { realm: 'labo.interne', netbios: 'LABO', adresseIp: '10.10.0.5', nomFichier: 'labo-provision.txt', confirmation: '' },
    'dollar-backtick-guillemets':{ realm: 'dollar.lan', netbios: 'DOLLAR', adresseIp: '172.16.8.20', nomFichier: '70-dollar-ad.txt', confirmation: 'dollar.lan' },
    'espaces-et-accents':        { realm: 'partage.lan', netbios: 'PARTAGE', adresseIp: '192.168.1.200', nomFichier: 'partage-ad.txt', confirmation: '' },
    'virgule-et-point-virgule':  { realm: 'a-b-c.lan', netbios: 'A-B-C', adresseIp: '192.168.30.11', nomFichier: 'a-b_c-ad.txt', confirmation: 'a-b-c.lan' },
    'chemin-racine-c':           { realm: 'voisin.lan', netbios: 'VOISIN', adresseIp: '10.0.0.9', nomFichier: 'voisin-ad.txt', confirmation: '' },
    'chemin-avec-apostrophe':    { realm: 'd-adam.lan', netbios: 'D-ADAM', adresseIp: '192.168.30.12', nomFichier: 'd-adam-ad.txt', confirmation: 'd-adam.lan' },
  },
  'samba-ad-health': {
    'apostrophe-ascii':          { realm: 'kjemo.lan', verifierReplication: 'Oui' },
    'apostrophe-typographique':  { realm: 'labo.interne', verifierReplication: 'Non' },
    'dollar-backtick-guillemets':{ realm: 'dollar.lan', verifierReplication: 'Oui' },
    'espaces-et-accents':        { realm: 'partage.lan', verifierReplication: 'Non' },
    'virgule-et-point-virgule':  { realm: 'a-b-c.lan', verifierReplication: 'Oui' },
    'chemin-racine-c':           { realm: 'voisin.lan', verifierReplication: 'Non' },
    'chemin-avec-apostrophe':    { realm: 'd-adam.lan', verifierReplication: 'Oui' },
  },
  'samba-ad-user-manage': {
    'apostrophe-ascii':          { action: 'Lister les comptes', compte: '' },
    'apostrophe-typographique':  { action: 'Examiner un compte', compte: 'o-brien' },
    'dollar-backtick-guillemets':{ action: 'Préparer une création', compte: 'dadam' },
    'espaces-et-accents':        { action: 'Préparer une désactivation', compte: 'partage-admin' },
    'virgule-et-point-virgule':  { action: 'Préparer une réactivation', compte: 'a-b_c' },
    'chemin-racine-c':           { action: 'Préparer une création', compte: 'voisin' },
    'chemin-avec-apostrophe':    { action: 'Examiner un compte', compte: 'd-adam' },
  },
  // Samba. « chemin », « groupe » et « confirmation » sont partages avec les
  // assistants de permissions, dont les valeurs globales designent d'autres
  // cibles : d'ou cette table par outil.
  'samba-readiness': {
    'apostrophe-ascii':          { cheminEnvisage: '/srv/partage', compteEnvisage: 'o-brien' },
    'apostrophe-typographique':  { cheminEnvisage: '', compteEnvisage: '' },
    'dollar-backtick-guillemets':{ cheminEnvisage: '/srv/dollar', compteEnvisage: 'dadam' },
    'espaces-et-accents':        { cheminEnvisage: '/srv/Donnees partagees', compteEnvisage: '' },
    'virgule-et-point-virgule':  { cheminEnvisage: '/srv/a-b_c', compteEnvisage: 'a-b_c' },
    'chemin-racine-c':           { cheminEnvisage: '', compteEnvisage: 'voisin' },
    'chemin-avec-apostrophe':    { cheminEnvisage: '/srv/d-adam/projet', compteEnvisage: 'd-adam' },
  },
  'samba-share-create': {
    'apostrophe-ascii':          { nomPartage: 'partage', chemin: '/srv/partage', groupe: 'partage', ecriture: 'Oui', hotesAutorises: '192.168.30.0/24', confirmation: 'partage' },
    'apostrophe-typographique':  { nomPartage: 'archives', chemin: '/srv/archives', groupe: 'gg-typo', ecriture: 'Non', hotesAutorises: '', confirmation: '' },
    'dollar-backtick-guillemets':{ nomPartage: 'dollar', chemin: '/srv/dollar', groupe: 'dollar', ecriture: 'Oui', hotesAutorises: '10.10.0.0/16', confirmation: 'dollar' },
    'espaces-et-accents':        { nomPartage: 'donnees', chemin: '/srv/Donnees partagees', groupe: 'partage', ecriture: 'Oui', hotesAutorises: '', confirmation: '' },
    'virgule-et-point-virgule':  { nomPartage: 'a-b_c', chemin: '/srv/a-b_c', groupe: 'a-b_c', ecriture: 'Non', hotesAutorises: '172.16.8.0/22 192.168.1.5', confirmation: 'a-b_c' },
    'chemin-racine-c':           { nomPartage: 'voisin', chemin: '/mnt/voisin', groupe: 'voisins', ecriture: 'Non', hotesAutorises: '', confirmation: '' },
    'chemin-avec-apostrophe':    { nomPartage: 'd-adam', chemin: '/srv/d-adam/projet', groupe: 'projet', ecriture: 'Oui', hotesAutorises: '192.168.30.50', confirmation: 'd-adam' },
  },
  'samba-diagnostic': {
    'apostrophe-ascii':          { nomPartage: 'partage', compteTeste: 'o-brien', hoteTeste: '192.168.30.50' },
    'apostrophe-typographique':  { nomPartage: '', compteTeste: '', hoteTeste: '' },
    'dollar-backtick-guillemets':{ nomPartage: 'dollar', compteTeste: 'dadam', hoteTeste: '10.10.0.7' },
    'espaces-et-accents':        { nomPartage: 'donnees', compteTeste: 'partage-admin', hoteTeste: '' },
    'virgule-et-point-virgule':  { nomPartage: 'a-b_c', compteTeste: 'a-b_c', hoteTeste: '172.16.8.9' },
    'chemin-racine-c':           { nomPartage: 'voisin', compteTeste: '', hoteTeste: '192.168.1.200' },
    'chemin-avec-apostrophe':    { nomPartage: 'd-adam', compteTeste: 'd-adam', hoteTeste: '' },
  },
  // Cockpit. « port » est partage avec SSH et le pare-feu, dont les valeurs
  // globales n'ont rien a voir avec 9090.
  'cockpit-install-readiness': {
    'apostrophe-ascii':          { port: '9090', verifierCertificat: 'Oui' },
    'apostrophe-typographique':  { port: '9091', verifierCertificat: 'Non' },
    'dollar-backtick-guillemets':{ port: '9090', verifierCertificat: 'Non' },
    'espaces-et-accents':        { port: '8443', verifierCertificat: 'Oui' },
    'virgule-et-point-virgule':  { port: '10090', verifierCertificat: 'Oui' },
    'chemin-racine-c':           { port: '443', verifierCertificat: 'Non' },
    'chemin-avec-apostrophe':    { port: '19090', verifierCertificat: 'Oui' },
  },
  'cockpit-connection-diagnostic': {
    'apostrophe-ascii':          { adresseNavigateur: '192.168.30.10', port: '9090', lireJournal: 'Oui' },
    'apostrophe-typographique':  { adresseNavigateur: '', port: '9090', lireJournal: 'Non' },
    'dollar-backtick-guillemets':{ adresseNavigateur: '10.10.0.5', port: '9091', lireJournal: 'Oui' },
    'espaces-et-accents':        { adresseNavigateur: 'srv-labo.kjemo.local', port: '8443', lireJournal: 'Non' },
    'virgule-et-point-virgule':  { adresseNavigateur: 'dc01.kjemo.local', port: '10090', lireJournal: 'Oui' },
    'chemin-racine-c':           { adresseNavigateur: '', port: '443', lireJournal: 'Oui' },
    'chemin-avec-apostrophe':    { adresseNavigateur: 'd-adam.labo.local', port: '19090', lireJournal: 'Non' },
  },
  'ssh-server-readiness': {
    'apostrophe-ascii':          { port: '22', lireJournal: 'Oui' },
    'apostrophe-typographique':  { port: '2222', lireJournal: 'Non' },
    'dollar-backtick-guillemets':{ port: '22', lireJournal: 'Non' },
    'espaces-et-accents':        { port: '2022', lireJournal: 'Oui' },
    'virgule-et-point-virgule':  { port: '65535', lireJournal: 'Oui' },
    'chemin-racine-c':           { port: '1', lireJournal: 'Non' },
    'chemin-avec-apostrophe':    { port: '8022', lireJournal: 'Oui' },
  },
  'ssh-client-diagnostic': {
    'apostrophe-ascii':          { hote: 'srv-labo.kjemo.local', utilisateur: 'o-brien', port: '22', interrogerServeur: 'Oui' },
    'apostrophe-typographique':  { hote: 'dc01.kjemo.local', utilisateur: '', port: '22', interrogerServeur: 'Non' },
    'dollar-backtick-guillemets':{ hote: '192.168.30.10', utilisateur: 'dadam', port: '2222', interrogerServeur: 'Oui' },
    'espaces-et-accents':        { hote: 'srv-fichiers.labo.local', utilisateur: 'partage-admin', port: '22', interrogerServeur: 'Non' },
    'virgule-et-point-virgule':  { hote: 'srv-a-b-c.labo.local', utilisateur: 'a-b_c', port: '2022', interrogerServeur: 'Oui' },
    'chemin-racine-c':           { hote: 'localhost', utilisateur: '', port: '22', interrogerServeur: 'Non' },
    'chemin-avec-apostrophe':    { hote: 'd-adam.labo.local', utilisateur: 'd-adam', port: '8022', interrogerServeur: 'Oui' },
  },
  'ssh-key-readiness': {
    'apostrophe-ascii':          { compte: 'o-brien' },
    'apostrophe-typographique':  { compte: '' },
    'dollar-backtick-guillemets':{ compte: 'dadam' },
    'espaces-et-accents':        { compte: 'partage-admin' },
    'virgule-et-point-virgule':  { compte: 'a-b_c' },
    'chemin-racine-c':           { compte: 'voisin' },
    'chemin-avec-apostrophe':    { compte: 'd-adam' },
  },
  'ssh-hardening-audit': {
    'apostrophe-ascii':          { compteAdminProuve: 'o-brien', desactiverMotDePasse: 'Oui', interdireRoot: 'Oui', nomFichier: '99-kjemo-durcissement.conf', confirmation: 'o-brien' },
    'apostrophe-typographique':  { compteAdminProuve: '', desactiverMotDePasse: 'Non', interdireRoot: 'Non', nomFichier: '99-audit-seul.conf', confirmation: '' },
    'dollar-backtick-guillemets':{ compteAdminProuve: 'dadam', desactiverMotDePasse: 'Oui', interdireRoot: 'Non', nomFichier: '70-labo-ssh.conf', confirmation: 'dadam' },
    'espaces-et-accents':        { compteAdminProuve: 'partage-admin', desactiverMotDePasse: 'Non', interdireRoot: 'Oui', nomFichier: '60-sans-root.conf', confirmation: '' },
    'virgule-et-point-virgule':  { compteAdminProuve: 'a-b_c', desactiverMotDePasse: 'Oui', interdireRoot: 'Oui', nomFichier: '80-a-b_c.conf', confirmation: 'a-b_c' },
    'chemin-racine-c':           { compteAdminProuve: '', desactiverMotDePasse: 'Non', interdireRoot: 'Non', nomFichier: '90-voisin.conf', confirmation: '' },
    'chemin-avec-apostrophe':    { compteAdminProuve: 'd-adam', desactiverMotDePasse: 'Non', interdireRoot: 'Oui', nomFichier: '99-d-adam.conf', confirmation: 'd-adam' },
  },
};

for (const jeu of DATASETS) {
  const ajout = VALEURS_POSTE[jeu.name];
  if (ajout) Object.assign(jeu.values, ajout);
  const ajoutB = VALEURS_POSTE_B[jeu.name];
  if (ajoutB) Object.assign(jeu.values, ajoutB);
}

const report = { generated: [], errors: [] };
const valeursLinuxUtilisees = {};

for (const tool of tools) {
  const defaults = Object.fromEntries(tool.fields.map((f) => [f.id, String(f.default ?? '')]));

  for (const dataset of DATASETS) {
    // Merge defaults + dataset overrides (uniquement les fields que l'outil a)
    //
    // Les valeurs Linux sont appliquées ICI, par outil, et APRÈS les valeurs
    // communes. Raison : « source » est un champ partagé avec un assistant
    // Windows figé. Une fusion globale dans DATASETS.values changerait son
    // script et casserait la non-régression des 856.
    const linux = plateformeDe(tool) === 'Linux' ? (VALEURS_LINUX[dataset.name] ?? {}) : {};
    const propres = (VALEURS_PAR_OUTIL[tool.id] ?? {})[dataset.name] ?? {};
    const values = {};
    for (const f of tool.fields) {
      if (propres[f.id] !== undefined) { values[f.id] = propres[f.id]; continue; }
      if (linux[f.id] !== undefined) { values[f.id] = linux[f.id]; continue; }
      values[f.id] = dataset.values[f.id] !== undefined ? dataset.values[f.id] : defaults[f.id];
    }

    // ------------------------------------------------------------------------
    // DEUX PLATEFORMES, DEUX RÈGLES D'ÉCRITURE OPPOSÉES
    //
    // .ps1 : BOM UTF-8 obligatoire. Sans lui, Windows PowerShell 5.1 relit le
    //        fichier en CP1252 et l'analyse déraille sur le premier tiret
    //        cadratin. Le LOT 6 l'a payé.
    // .sh  : BOM interdit, LF strict. Les trois octets du BOM se placeraient
    //        avant « #! » et masqueraient le shebang.
    //
    // Et deux NORMALISEURS distincts : normalizeScript() remplace « antislash +
    // saut de ligne » par « backtick + saut de ligne », ce qui est la
    // continuation de ligne PowerShell. Appliqué à du Bash, il remplacerait des
    // continuations valides par des substitutions de commande.
    // ------------------------------------------------------------------------
    const bash = estBash(tool);
    let content;
    try {
      const brut = tool.generate(values);
      content = bash ? normalizeScriptSh(brut) : normalizeScript(brut);
    } catch (err) {
      report.errors.push({ tool: tool.id, dataset: dataset.name, error: String(err) });
      console.error(`[ERR] ${tool.id} / ${dataset.name} : ${err}`);
      continue;
    }

    const filename = `${tool.id}__${dataset.name}${extensionDe(tool)}`;
    const outPath  = resolve(OUT_DIR, filename);
    const contentBuf = Buffer.from(content, 'utf-8');
    writeFileSync(outPath, bash ? contentBuf : Buffer.concat([BOM, contentBuf]));

    // Relecture des premiers octets, dans les DEUX sens. On ne se contente pas
    // d'avoir écrit ce qu'il fallait : on vérifie ce qui est sur le disque.
    const tete = Buffer.alloc(3);
    const fd = openSync(outPath, 'r');
    readSync(fd, tete, 0, 3, 0);
    closeSync(fd);
    if (bash) {
      if (tete.equals(BOM)) {
        console.error(`[BOM INTERDIT] ${filename} : un .sh ne doit JAMAIS commencer par EF BB BF — le shebang serait masqué.`);
        report.errors.push({ tool: tool.id, dataset: dataset.name, error: 'BOM présent sur un .sh' });
      }
      if (!content.startsWith('#!/usr/bin/env bash\n')) {
        console.error(`[SHEBANG] ${filename} : première ligne incorrecte.`);
        report.errors.push({ tool: tool.id, dataset: dataset.name, error: 'shebang incorrect' });
      }
      if (content.includes('\r')) {
        console.error(`[CRLF] ${filename} : le fichier contient un retour chariot.`);
        report.errors.push({ tool: tool.id, dataset: dataset.name, error: 'CR présent dans un .sh' });
      }
    } else if (!tete.equals(BOM)) {
      console.error(`[BOM FAIL] ${filename} : premiers octets ${tete.toString('hex')} ≠ efbbbf`);
      report.errors.push({ tool: tool.id, dataset: dataset.name, error: 'BOM manquant' });
    }
    report.generated.push({
      tool: tool.id, dataset: dataset.name, file: filename,
      bytes: contentBuf.length + (bash ? 0 : 3), sortie: bash ? '.sh' : '.ps1',
    });
    if (plateformeDe(tool) === 'Linux') valeursLinuxUtilisees[filename] = values;
  }
}

writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');

// Les valeurs REELLEMENT transmises a chaque script Bash, ecrites telles
// quelles. test/sh-shellcheck.test.mjs s en sert pour decider si une alerte
// ShellCheck porte sur une valeur saisie par l utilisateur ou sur du code
// ecrit par nous. Sans ce fichier, la tolerance serait une affirmation.
writeFileSync(resolve(OUT_DIR, '_valeurs-linux.json'), JSON.stringify(valeursLinuxUtilisees, null, 2), 'utf-8');



console.log('');
console.log(`${report.generated.length} fichiers générés, ${report.errors.length} erreur(s) JS.`);
if (report.errors.length > 0) {
  console.error('Erreurs :');
  report.errors.forEach((e) => console.error(`  [${e.tool}/${e.dataset}] ${e.error}`));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Garde-fou d'identité : les 64 scripts doivent rester octet pour octet ceux du
// SHA de base. Les empreintes sont figées dans test/scripts-baseline.json ; un
// écart signifie qu'un generate() a changé, ce qui n'est jamais anodin.
// ---------------------------------------------------------------------------
const baseline = JSON.parse(readFileSync(resolve(ROOT, 'test', 'scripts-baseline.json'), 'utf-8'));
const attendus = baseline.sha256;
const ecarts = [];

for (const [fichier, empreinte] of Object.entries(attendus)) {
  const chemin = resolve(OUT_DIR, fichier);
  if (!existsSync(chemin)) { ecarts.push(`${fichier} : absent`); continue; }
  const obtenue = createHash('sha256').update(readFileSync(chemin)).digest('hex');
  if (obtenue !== empreinte) ecarts.push(`${fichier} : ${obtenue.slice(0, 12)} != ${empreinte.slice(0, 12)}`);
}

// Les outils apparus APRÈS le SHA de base produisent légitimement de nouveaux
// scripts : ils sont comptés à part. Ce qui est interdit, c'est qu'un script
// d'un outil historique disparaisse, change, ou se dédouble.
const outilsReference = new Set(Object.keys(attendus).map((f) => f.split('__')[0]));
const tousLesScripts = readdirSync(OUT_DIR).filter((f) => f.endsWith('.ps1'));
const surplusHistorique = tousLesScripts
  .filter((f) => !(f in attendus) && outilsReference.has(f.split('__')[0]));
for (const f of surplusHistorique) ecarts.push(`${f} : script existant inattendu`);
const nouveaux = tousLesScripts.filter((f) => !outilsReference.has(f.split('__')[0]));

console.log('');
if (ecarts.length === 0) {
  console.log(`Identité vs SHA de base ${baseline.baseSha.slice(0, 7)} : `
    + `${Object.keys(attendus).length}/${baseline.count} scripts existants identiques octet par octet.`);
  console.log(`Nouveaux scripts, hors référence : ${nouveaux.length}.`);
} else {
  console.error(`Identité vs SHA de base : ${ecarts.length} écart(s).`);
  ecarts.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Garde de non-régression du LOT 6B : les 712 scripts du SHA 803870c
//
// La garde ci-dessus compare 440 scripts au SHA 4c37ce2. C'est l'ancrage
// historique, et il reste utile : il remonte jusqu'au LOT 2. Mais il ne
// couvre pas les 272 scripts apparus depuis, ceux des LOTS 5 et 6A. Un LOT 6B
// qui casserait un script du LOT 6A passerait donc la garde historique sans
// être vu.
//
// Cette seconde garde ferme ce trou. Sa référence est l'état réel au départ du
// LOT 6B : les 712 scripts du SHA 803870c, LOT 6A v3 compris. Les deux gardes
// coexistent — l'ancienne par héritage, celle-ci parce que c'est elle qui
// protège le travail du lot en cours.
// ---------------------------------------------------------------------------
const baseline712 = JSON.parse(readFileSync(resolve(ROOT, 'test', 'scripts-baseline-712.json'), 'utf-8'));
const attendus712 = baseline712.sha256;
const ecarts712 = [];

for (const [fichier, empreinte] of Object.entries(attendus712)) {
  const chemin = resolve(OUT_DIR, fichier);
  if (!existsSync(chemin)) { ecarts712.push(`${fichier} : absent`); continue; }
  const obtenue = createHash('sha256').update(readFileSync(chemin)).digest('hex');
  if (obtenue !== empreinte) ecarts712.push(`${fichier} : ${obtenue.slice(0, 12)} != ${empreinte.slice(0, 12)}`);
}

// Un outil déjà présent au SHA de référence ne doit pas se mettre à produire
// un script de plus : ce serait un jeu de données ajouté sous un outil gelé.
const outils712 = new Set(Object.keys(attendus712).map((f) => f.split('__')[0]));
const surplus712 = tousLesScripts
  .filter((f) => !(f in attendus712) && outils712.has(f.split('__')[0]));
for (const f of surplus712) ecarts712.push(`${f} : script existant inattendu`);
const nouveaux712 = tousLesScripts.filter((f) => !outils712.has(f.split('__')[0]));

console.log('');
if (ecarts712.length === 0) {
  console.log(`Non-régression LOT 6B vs SHA ${baseline712.baseSha.slice(0, 7)} : `
    + `${Object.keys(attendus712).length}/${baseline712.count} scripts antérieurs identiques octet par octet.`);
  console.log(`Scripts du LOT 6B, hors référence 712 : ${nouveaux712.length}.`);
} else {
  console.error(`Non-régression LOT 6B : ${ecarts712.length} écart(s) sur les 712 scripts du SHA ${baseline712.baseSha.slice(0, 7)}.`);
  ecarts712.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Métadonnée de version : chaque lot annonce le sien
//
// Les 176 scripts du LOT 5 annonçaient « LOT 2 — 2.0.0 », par héritage du
// gabarit commun. Un rapport remonté du terrain devient inexploitable quand
// sa ligne de version désigne un autre lot que celui dont l'outil provient.
//
// Trois affirmations, et les trois sont vérifiées sur les fichiers eux-mêmes,
// pas sur l'intention :
//   1. les 176 nouveaux scripts portent la version du LOT 5 ;
//   2. aucun nouveau script ne porte plus « LOT 2 — 2.0.0 » ;
//   3. les 440 scripts antérieurs sont inchangés — c'est le contrôle
//      d'identité ci-dessus qui l'établit, octet pour octet.
// ---------------------------------------------------------------------------
// Chaque lot annonce SA version. La correspondance se fait par la categorie
// de l'outil, lue dans le catalogue : c'est elle qui dit de quel lot vient un
// script, et non son nom de fichier.
const VERSIONS_PAR_LOT = [
  { lot: 'LOT 5', categorie: 'Réseau', version: 'LOT 5 — Réseau avancé — 5.0.0' },
  { lot: 'LOT 6', categorie: 'Poste de travail Windows', version: 'LOT 6 — Poste de travail Windows — 6.0.0' },
];
const VERSION_HERITEE = 'LOT 2 — 2.0.0';

// Les outils historiques vivent eux aussi dans ces categories (static-ip et
// wifi-repair sous Reseau) : leurs scripts sont figes par la reference et ne
// font pas partie des « nouveaux ».
const versionAttendue = new Map();
for (const t of tools) {
  const regle = VERSIONS_PAR_LOT.find((r) => r.categorie === t.category);
  if (regle) versionAttendue.set(t.id, regle);
}

const problemesVersion = [];
const comptesParLot = {};
let nouveauxAvecVersionHeritee = [];
let nouveauxSansRegle = [];

for (const f of nouveaux) {
  const idOutil = f.split('__')[0];
  const texte = readFileSync(resolve(OUT_DIR, f), 'utf-8');
  const regle = versionAttendue.get(idOutil);
  if (!regle) { nouveauxSansRegle.push(f); continue; }
  comptesParLot[regle.lot] = comptesParLot[regle.lot] || { attendus: 0, justes: 0 };
  comptesParLot[regle.lot].attendus += 1;
  if (texte.includes(regle.version)) comptesParLot[regle.lot].justes += 1;
  if (texte.includes(VERSION_HERITEE)) nouveauxAvecVersionHeritee.push(f);
}

if (nouveauxSansRegle.length > 0) {
  problemesVersion.push(
    `${nouveauxSansRegle.length} nouveau(x) script(s) sans regle de version : `
    + nouveauxSansRegle.slice(0, 5).join(', '));
}
for (const [lot, c] of Object.entries(comptesParLot)) {
  if (c.justes !== c.attendus) {
    problemesVersion.push(`${lot} : ${c.justes}/${c.attendus} scripts portent la bonne version.`);
  }
}
if (nouveauxAvecVersionHeritee.length !== 0) {
  problemesVersion.push(
    `${nouveauxAvecVersionHeritee.length} nouveau(x) script(s) portent encore « ${VERSION_HERITEE} » : `
    + nouveauxAvecVersionHeritee.slice(0, 5).join(', '));
}

console.log('');
if (problemesVersion.length === 0) {
  for (const regle of VERSIONS_PAR_LOT) {
    const c = comptesParLot[regle.lot];
    if (!c) continue;
    console.log(`Version des scripts — ${regle.lot} : ${c.justes}/${c.attendus} portent « ${regle.version} ».`);
  }
  console.log(`Aucun des ${nouveaux.length} nouveaux scripts ne porte « ${VERSION_HERITEE} ».`);
} else {
  console.error('Version des scripts : écart.');
  problemesVersion.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Dette historique, consignée et NON corrigée ici
//
// Elle est réelle, elle est connue, et la corriger reviendrait à réécrire les
// 440 scripts figés — exactement ce que la garde d'identité interdit. Elle
// attend une migration globale explicitement autorisée. La compter à chaque
// exécution évite qu'elle se perde.
// ---------------------------------------------------------------------------
const anciens = tousLesScripts.filter((f) => f in attendus);
let ancienSansVersion = 0;
let ancienVersionHeritee = 0;
for (const f of anciens) {
  const texte = readFileSync(resolve(OUT_DIR, f), 'utf-8');
  if (texte.includes(VERSION_HERITEE)) ancienVersionHeritee += 1;
  else if (!/^# Outil KJEMO :/m.test(texte)) ancienSansVersion += 1;
}
console.log('');
console.log('Dette historique (constatée, non corrigée dans ce correctif) :');
console.log(`  ${ancienVersionHeritee} scripts antérieurs portent « ${VERSION_HERITEE} », `
  + 'y compris ceux des LOTS 3 et 4, qui devraient annoncer leur propre lot.');
console.log(`  ${ancienSansVersion} scripts du LOT 1 ne passent pas par le gabarit commun `
  + 'et ne portent aucune ligne de version.');
console.log('  Ces deux points ne seront repris que dans une migration globale');
console.log('  explicitement autorisée : les modifier ici casserait la garde d’identité.');
