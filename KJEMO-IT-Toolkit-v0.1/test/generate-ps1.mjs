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
for (const f of surplusHistorique) ecarts.push(`${f} : script historique inattendu`);
const nouveaux = tousLesScripts.filter((f) => !outilsReference.has(f.split('__')[0]));

console.log('');
if (ecarts.length === 0) {
  console.log(`Identité vs SHA de base ${baseline.baseSha.slice(0, 7)} : `
    + `${Object.keys(attendus).length}/${baseline.count} scripts historiques identiques octet par octet.`);
  console.log(`Nouveaux scripts, hors référence historique : ${nouveaux.length}.`);
} else {
  console.error(`Identité vs SHA de base : ${ecarts.length} écart(s).`);
  ecarts.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
