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
import { createHash }                                  from 'node:crypto';
import { dirname, resolve }                               from 'node:path';
import { fileURLToPath, pathToFileURL }                   from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const OUT_DIR   = resolve(ROOT, 'test', 'generated');

const { tools, normalizeScript } = await import(pathToFileURL(resolve(ROOT, 'dist', 'generators.mjs')).href);

// BOM UTF-8 : requis pour PowerShell 5.1 (lit les fichiers comme UTF-8)
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

// Vider le répertoire avant chaque génération pour éviter les fichiers obsolètes
mkdirSync(OUT_DIR, { recursive: true });
try {
  const existing = readdirSync(OUT_DIR);
  for (const f of existing) {
    if (f.endsWith('.ps1') || f === 'report.json') {
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
    "brIdSauvegarde": "",
    "brConfirmation": ""
  }
};

for (const jeu of DATASETS) {
  const ajout = VALEURS_GPO[jeu.name];
  if (ajout) Object.assign(jeu.values, ajout);
}

const report = { generated: [], errors: [] };

for (const tool of tools) {
  const defaults = Object.fromEntries(tool.fields.map((f) => [f.id, String(f.default ?? '')]));

  for (const dataset of DATASETS) {
    // Merge defaults + dataset overrides (uniquement les fields que l'outil a)
    const values = {};
    for (const f of tool.fields) {
      values[f.id] = dataset.values[f.id] !== undefined ? dataset.values[f.id] : defaults[f.id];
    }

    let content;
    try {
      content = normalizeScript(tool.generate(values));
    } catch (err) {
      report.errors.push({ tool: tool.id, dataset: dataset.name, error: String(err) });
      console.error(`[ERR] ${tool.id} / ${dataset.name} : ${err}`);
      continue;
    }

    const filename = `${tool.id}__${dataset.name}.ps1`;
    const outPath  = resolve(OUT_DIR, filename);
    // Écriture avec BOM UTF-8 (EF BB BF) pour PS 5.1
    const contentBuf = Buffer.from(content, 'utf-8');
    writeFileSync(outPath, Buffer.concat([BOM, contentBuf]));
    // Vérification des 3 premiers octets
    const written = Buffer.alloc(3);
    const fd = (await import('node:fs')).openSync(outPath, 'r');
    (await import('node:fs')).readSync(fd, written, 0, 3, 0);
    (await import('node:fs')).closeSync(fd);
    if (!written.equals(BOM)) {
      console.error(`[BOM FAIL] ${filename} : premiers octets ${written.toString('hex')} ≠ efbbbf`);
      report.errors.push({ tool: tool.id, dataset: dataset.name, error: 'BOM manquant' });
    }
    report.generated.push({ tool: tool.id, dataset: dataset.name, file: filename, bytes: contentBuf.length + 3 });
  }
}

writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');



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
