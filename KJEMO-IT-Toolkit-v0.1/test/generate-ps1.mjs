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

for (const jeu of DATASETS) {
  const ajout = VALEURS_POSTE[jeu.name];
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
