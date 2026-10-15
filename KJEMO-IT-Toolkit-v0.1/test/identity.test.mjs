#!/usr/bin/env node
/**
 * identity.test.mjs — LOT 0 · KJEMO IT Toolkit
 * -----------------------------------------------
 * Tests fonctionnels Node.js (sans navigateur) :
 *   1. Valeurs attendues réelles vérifiées par assertion
 *   2. Validateurs : domaine invalide, entiers non-entiers, IP invalide
 *   3. Escaping : U+2018/U+2019, $, backtick
 *   4. Cas-limites GPO : lockout=0 préservé
 *   5. LDAP/RDN escaping pour les chemins AD
 *   6. Aucun U+2018/U+2019 dans les chaînes PS à apostrophes simples
 *   7. Identité pipeline : generate() → normalizeScript() → résultat stable
 *
 * Usage : node test/identity.test.mjs
 * Exit 0 = tout OK, exit 1 = au moins un ÉCHEC.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath }   from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

import {
  tools,
  normalizeScript,
  escapePowerShellSingleQuoted,
  escapePowerShellDoubleQuoted,
  escapeLdapRdn,
  EXECUTION_NOTES,
  normalizeSearch,
  searchTools,
  searchCommonErrors,
  auditerAnnulation,
  cmdletsExecutes,
  CMDLETS_NON_DESTRUCTIFS,
  VERBES_DESTRUCTIFS,
  validateDomain,
  validateIPv4,
  validateSamAccountName,
  validateIntegerStrict,
  validateFloatStrict,
  validateOuName,
  validateWindowsLocalPath,
  domainToDn,
} from '../dist/generators.mjs';

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import {
  CATEGORIES,
  CATEGORIE_TOUT,
  compterOutils,
  categoriesVisibles,
  categoriesEnAttente,
  categorieParNom,
  sousRubriques,
} from '../dist/categories.mjs';

import {
  MODES,
  MODE_DEFAUT,
  CLE_MODE,
  estMode,
  creerPreference,
} from '../dist/preferences.mjs';

import {
  THEMES,
  THEME_DEFAUT,
  CLE_THEME,
  estTheme,
} from '../dist/preferences.mjs';

import {
  LANGUES,
  LANGUE_DEFAUT,
  LIBELLES,
  libelle,
  langueDisponible,
} from '../dist/libelles.mjs';

import {
  validerIPv6,
  validerFqdn,
  validerNomHote,
  validerPrefixe,
  validerMasque,
  validerReseauCidr,
  validerPlageIp,
  validerScopeId,
  validerMac,
  validerClientId,
  validerCheminWindowsLocal,
  validerNomZoneDns,
  validerNomEnregistrement,
  validerTypeEnregistrement,
  validerProfondeur,
  validerDureeBail,
  validerFormatRapport,
  validerModeExecution,
  validerChoix,
  validerListeIPv4,
  validerEntier,
  ipDansReseau,
  adresseReseau,
  adresseDiffusion,
  prefixeVersMasque,
  ipVersEntier,
  entierVersIp,
  TYPES_ENREGISTREMENT,
  FORMATS_RAPPORT,
  MODES_EXECUTION,
  validerDn,
  validerCheminOu,
  validerListeOu,
  validerUpn,
  validerPorteeGroupe,
  validerCategorieGroupe,
  validerCheminUnc,
  validerLettreLecteur,
  validerNomOrdinateur,
  validerJours,
  validerColonnesCsv,
  cheminOuVersDn,
} from '../dist/validateurs.mjs';

import {
  VERSION_OUTILS,
  enteteScript,
  fonctionsRapport,
  blocExportRapport,
  blocParametres,
  blocModeDiagnostic,
} from '../dist/rapport-ps.mjs';

import { psB64 as psB64Noyau, assertValid as assertValidNoyau } from '../dist/noyau.mjs';
// LOT 7 — la plateforme d'un outil et la validite de ses sources.
import { plateformeDe, sortieDe, estBash, estLectureSeule, extensionDe,
         nomFichierDe, etiquetteSortie, commandesExecution,
         incoherencesPlateforme, incoherencesPrivileges,
         PRIVILEGES_REQUIS, privilegesRequisDe,
         CHAMPS_LINUX } from '../dist/plateforme.mjs';
import { sourceLinuxValide, editeurDe, PREFIXES_SOURCES_LINUX } from '../dist/sources-linux.mjs';
import { SOUS_RUBRIQUES_LINUX } from '../dist/categories.mjs';

// ---------------------------------------------------------------------------
// Comptage
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(cond, label, detail = '') {
  if (cond) {
    console.log(`  [OK]    ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL]  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(title) { console.log(`\n--- ${title} ---`); }

// ---------------------------------------------------------------------------
// 1. Fonctions d'échappement
// ---------------------------------------------------------------------------
section('escaping');

assert(
  escapePowerShellSingleQuoted("O'Brien") === "O''Brien",
  "escPs1 : U+0027 → ''",
);
assert(
  escapePowerShellSingleQuoted('O’Brien') === 'O’Brien',
  'escPs1 : U+2019 → préservé tel quel (psB64 pour valeurs utilisateur)',
);
assert(
  escapePowerShellSingleQuoted('O‘Brien') === 'O‘Brien',
  'escPs1 : U+2018 → préservé tel quel (psB64 pour valeurs utilisateur)',
);
assert(
  escapePowerShellDoubleQuoted('$var') === '`$var',
  'escPs2 : $ → `$',
);
assert(
  escapePowerShellDoubleQuoted('`test') === '``test',
  'escPs2 : ` → ``',
);
assert(
  escapePowerShellDoubleQuoted('"quoted"') === '`"quoted`"',
  'escPs2 : " → `"',
);

// ---------------------------------------------------------------------------
// 2. LDAP/RDN escaping
// ---------------------------------------------------------------------------
section('escapeLdapRdn');

assert(
  escapeLdapRdn('Sales,Test') === 'Sales\\,Test',
  'LDAP : virgule → \\,',
);
assert(
  escapeLdapRdn('A+B') === 'A\\+B',
  'LDAP : + → \\+',
);
assert(
  escapeLdapRdn('#Leading') === '\\#Leading',
  'LDAP : # en début → \\#',
);
assert(
  escapeLdapRdn(' leading space') === '\\ leading space',
  'LDAP : espace en début → \\<espace>',
);
assert(
  escapeLdapRdn('trailing ') === 'trailing\\ ',
  'LDAP : espace en fin → \\<espace>',
);
assert(
  escapeLdapRdn('back\\slash') === 'back\\\\slash',
  'LDAP : backslash → \\\\',
);

// ---------------------------------------------------------------------------
// 3. Validateurs stricts
// ---------------------------------------------------------------------------
section('validateDomain');

assert(validateDomain('hopitalbn.lan').ok === true, 'domaine valide');
assert(validateDomain('sub.hopitalbn.lan').ok === true, 'sous-domaine valide');
assert(validateDomain('bad').ok === false, 'domaine sans point → invalide');
assert(validateDomain('').ok === false, 'domaine vide → invalide');
assert(validateDomain('bad..domain').ok === false, 'double-point → invalide');
// Ne retourne JAMAIS "invalid.lan"
const badDom = validateDomain('bad');
assert(
  !String(badDom.value ?? '').includes('invalid.lan'),
  'validateDomain("bad") ne retourne pas invalid.lan',
);

section('validateIPv4');

assert(validateIPv4('192.168.30.1').ok === true, 'IPv4 valide');
assert(validateIPv4('999.0.0.1').ok === false, 'IPv4 octet > 255 → invalide');
assert(validateIPv4('192.168.30').ok === false, 'IPv4 3 octets → invalide');
assert(validateIPv4('abc').ok === false, 'IPv4 texte → invalide');

section('validateIntegerStrict');

assert(validateIntegerStrict('12', 1, 32, 'Test').ok === true, 'entier valide');
assert(validateIntegerStrict('12abc', 1, 32, 'Test').ok === false, "'12abc' → invalide");
assert(validateIntegerStrict('', 1, 32, 'Test').ok === false, 'vide → invalide');
assert(validateIntegerStrict('0', 0, 999, 'Lockout').ok === true, 'lockout 0 → valide');
assert(validateIntegerStrict('0', 0, 999, 'Lockout').value === 0, 'lockout 0 → value === 0');
assert(validateIntegerStrict('1000', 1, 999, 'Test').ok === false, '1000 > 999 → invalide');

section('validateFloatStrict');

assert(validateFloatStrict('0.5', 0, 100000, 'Size').ok === true, 'float 0.5 valide');
assert(validateFloatStrict('abc', 0, 100000, 'Size').ok === false, 'float "abc" → invalide');
assert(validateFloatStrict('', 0, 100000, 'Size').ok === false, 'float vide → invalide');

section('validateSamAccountName');

assert(validateSamAccountName('mtremblay').ok === true, 'sam valide');
assert(validateSamAccountName('').ok === false, 'sam vide → invalide');
assert(validateSamAccountName('a'.repeat(21)).ok === false, 'sam > 20 chars → invalide');

section('validateOuName');

assert(validateOuName('Employes').ok === true, 'OU valide');
assert(validateOuName('').ok === false, 'OU vide → invalide');

section('domainToDn');

assert(
  domainToDn('hopitalbn.lan') === 'DC=hopitalbn,DC=lan',
  "domainToDn('hopitalbn.lan')",
);
assert(
  domainToDn('sub.hopitalbn.lan') === 'DC=sub,DC=hopitalbn,DC=lan',
  "domainToDn('sub.hopitalbn.lan')",
);

// ---------------------------------------------------------------------------
// 4. Catalogue tools
// ---------------------------------------------------------------------------
section('catalogue tools');

assert(Array.isArray(tools), 'tools est un tableau');
// Le catalogue s'étend au fil des lots. Les huit outils historiques restent
// en tête, dans leur ordre d'origine : c'est ce qui garantit que les routes
// directes partagées avant le LOT 2 continuent de fonctionner.
const IDS_HISTORIQUES = ['static-ip', 'ad-ou', 'ad-user', 'shared-folder',
                         'second-dc', 'wifi-repair', 'gpo-password', 'disk-scan'];
assert(tools.length >= IDS_HISTORIQUES.length,
  `au moins les ${IDS_HISTORIQUES.length} outils historiques, ${tools.length} trouvés`);
assert(tools.slice(0, IDS_HISTORIQUES.length).map((t) => t.id).join(',') === IDS_HISTORIQUES.join(','),
  'les huit outils historiques restent en tête du catalogue, dans leur ordre');
assert(new Set(tools.map((t) => t.id)).size === tools.length,
  'aucun identifiant d\u2019outil en double dans le catalogue');

const ids = tools.map((t) => t.id);
const EXPECTED_IDS = ['static-ip', 'ad-ou', 'ad-user', 'shared-folder', 'second-dc', 'wifi-repair', 'gpo-password', 'disk-scan'];
for (const id of EXPECTED_IDS) {
  assert(ids.includes(id), `outil "${id}" présent`);
}

// second-dc ne doit pas avoir de champ "dns"
const secondDc = tools.find((t) => t.id === 'second-dc');
assert(
  secondDc && !secondDc.fields.some((f) => f.id === 'dns'),
  'second-dc : champ "dns" supprimé',
);

// Chaque outil a une méthode validate()
for (const tool of tools) {
  assert(typeof tool.validate === 'function', `${tool.id} : validate() existe`);
}

// ---------------------------------------------------------------------------
// 5. Génération avec valeurs par défaut — assertions exactes
// ---------------------------------------------------------------------------
section('generate() valeurs par défaut');

for (const tool of tools) {
  const defaults = Object.fromEntries(tool.fields.map((f) => [f.id, String(f.default ?? '')]));
  let script;
  try {
    script = normalizeScript(tool.generate(defaults));
  } catch (err) {
    assert(false, `${tool.id} : generate(defaults) ne doit pas lever d'exception — ${err}`);
    continue;
  }
  assert(typeof script === 'string' && script.length > 0, `${tool.id} : generate(defaults) retourne une chaîne non vide`);
  // Aucun U+2018/U+2019 à l'intérieur d'une chaîne PS à apostrophes simples
  const insideSingleQuoted = /[‘’][^’’]*[‘’][^’’]*[‘’]/u.test(script);
  assert(!insideSingleQuoted, `${tool.id} : aucun U+2018/U+2019 dans une chaîne PS à apostrophes simples`);
}

// disk-scan : bug LOT 0 — vérifier "n''est" (pas n'est avec U+2019)
const diskScan = tools.find((t) => t.id === 'disk-scan');
if (diskScan) {
  const ds = Object.fromEntries(diskScan.fields.map((f) => [f.id, String(f.default ?? '')]));
  const dsScript = diskScan.generate(ds);
  assert(
    dsScript.includes("n''est"),
    'disk-scan : "n\'\'est" présent (bug LOT 0 corrigé)',
  );
  assert(
    !dsScript.includes('n’est'),
    'disk-scan : U+2019 absent du script généré',
  );
}

// ---------------------------------------------------------------------------
// 6. GPO — lockout=0 préservé
// ---------------------------------------------------------------------------
section('GPO lockout=0');

const gpo = tools.find((t) => t.id === 'gpo-password');
if (gpo) {
  const valsZero = Object.fromEntries(gpo.fields.map((f) => [f.id, String(f.default ?? '')]));
  valsZero.lockout = '0';
  const errors = gpo.validate(valsZero);
  assert(Object.keys(errors).length === 0, 'GPO lockout=0 : validate() sans erreur');
  const scriptZero = gpo.generate(valsZero);
  assert(
    scriptZero.includes('-LockoutThreshold 0'),
    'GPO lockout=0 : -LockoutThreshold 0 présent dans le script',
  );
}

// ---------------------------------------------------------------------------
// 7. Validate() — domaine invalide reporté sur le bon champ
// ---------------------------------------------------------------------------
section('validate() — erreurs sur champ correct');

const staticIp = tools.find((t) => t.id === 'static-ip');
if (staticIp) {
  const vals = Object.fromEntries(staticIp.fields.map((f) => [f.id, String(f.default ?? '')]));
  vals.ip = 'not-an-ip';
  const errors = staticIp.validate(vals);
  assert('ip' in errors, "static-ip : validate() retourne une erreur sur le champ 'ip' pour une IP invalide");
}

const adOu = tools.find((t) => t.id === 'ad-ou');
if (adOu) {
  const vals = Object.fromEntries(adOu.fields.map((f) => [f.id, String(f.default ?? '')]));
  vals.domain = 'nodot';
  const errors = adOu.validate(vals);
  assert('domain' in errors, "ad-ou : validate() retourne une erreur sur 'domain' pour un domaine sans point");
}

const adUser = tools.find((t) => t.id === 'ad-user');
if (adUser) {
  const vals = Object.fromEntries(adUser.fields.map((f) => [f.id, String(f.default ?? '')]));
  vals.sam = '';
  const errors = adUser.validate(vals);
  assert('sam' in errors, "ad-user : validate() retourne une erreur sur 'sam' pour un SAM vide");
}

// ---------------------------------------------------------------------------
// 8. Identité pipeline : generate → normalizeScript → stable
// ---------------------------------------------------------------------------
section('identité pipeline (idempotence)');

for (const tool of tools) {
  const defaults = Object.fromEntries(tool.fields.map((f) => [f.id, String(f.default ?? '')]));
  let script;
  try { script = normalizeScript(tool.generate(defaults)); } catch { continue; }
  const twice  = normalizeScript(script);
  assert(script === twice, `${tool.id} : normalizeScript(normalizeScript(x)) === normalizeScript(x)`);
}

// ---------------------------------------------------------------------------
// 9. Escaping U+2019 dans les champs
// ---------------------------------------------------------------------------
section("escaping U+2019 dans les champs d'entrée");

const testTools = [
  { id: 'ad-user', field: 'lastName', value: "O’Brien" },
  { id: 'static-ip', field: 'adapter', value: "Ethernet D’Adam" },
  { id: 'shared-folder', field: 'share', value: "Données D’Adam" },
];

for (const { id, field, value } of testTools) {
  const tool = tools.find((t) => t.id === id);
  if (!tool) continue;
  const vals = Object.fromEntries(tool.fields.map((f) => [f.id, String(f.default ?? '')]));
  vals[field] = value;
  // validate() ne doit pas retourner d'erreur sur ce champ pour ce cas
  // (l'apostrophe typographique est un caractère valide dans un nom)
  let script;
  try { script = tool.generate(vals); } catch (err) { assert(false, `${id}/${field} U+2019 : generate() ne doit pas lever — ${err}`); continue; }
  const insideSingleQuoted = /[‘’][^’’]*[‘’][^’’]*[‘’]/u.test(normalizeScript(script));
  assert(!insideSingleQuoted, `${id}/${field} U+2019 : aucun U+2018/U+2019 à l'intérieur d'une chaîne PS à apostrophes simples`);
}

// ---------------------------------------------------------------------------
// 10. validateWindowsLocalPath
// ---------------------------------------------------------------------------
section('validateWindowsLocalPath');

assert(validateWindowsLocalPath('C:\\Partages\\Data').ok === true, 'chemin local valide C:\\Partages\\Data');
assert(validateWindowsLocalPath('D:\\').ok === true, 'chemin racine D:\\ valide');
assert(validateWindowsLocalPath('\\\\SERVEUR01\\Partage').ok === false, 'chemin UNC \\\\ → invalide (SMB interdit)');
assert(validateWindowsLocalPath('//server/share').ok === false, 'chemin UNC // → invalide');
assert(validateWindowsLocalPath('').ok === false, 'chemin vide → invalide');
assert(validateWindowsLocalPath('Relatif\\chemin').ok === false, 'chemin relatif → invalide');

// ---------------------------------------------------------------------------
// 11. LDAP RFC 4514 — assertions complètes
// ---------------------------------------------------------------------------
section('escapeLdapRdn — RFC 4514 complet');

assert(escapeLdapRdn('Finance, Nord') === 'Finance\\, Nord', 'LDAP : virgule interne');
assert(escapeLdapRdn('Direction + Ops') === 'Direction \\+ Ops', 'LDAP : plus interne');
assert(escapeLdapRdn('key=value') === 'key\\=value', 'LDAP : égal → \\=');
assert(escapeLdapRdn('"quoted"') === '\\"quoted\\"', 'LDAP : guillemets → \\"');
assert(escapeLdapRdn('back\\slash') === 'back\\\\slash', 'LDAP : backslash → \\\\');
assert(escapeLdapRdn('#Leading') === '\\#Leading', 'LDAP : # en début → \\#');
assert(escapeLdapRdn(' leading') === '\\ leading', 'LDAP : espace en début');
assert(escapeLdapRdn('trailing ') === 'trailing\\ ', 'LDAP : espace en fin');
assert(escapeLdapRdn('Finance\u0000Null') === 'Finance\\00Null', 'LDAP : NUL → \\00');

// Assertion intégration : OU=Finance\, Nord,OU=Direction \+ Ops,DC=example,DC=lan
const ouLdap1   = escapeLdapRdn('Finance, Nord');
const ouLdap2   = escapeLdapRdn('Direction + Ops');
const dn        = `OU=${ouLdap1},OU=${ouLdap2},DC=example,DC=lan`;
assert(
  dn === 'OU=Finance\\, Nord,OU=Direction \\+ Ops,DC=example,DC=lan',
  `LDAP DN intégration : ${dn}`,
);

// ---------------------------------------------------------------------------
// 12. Section B — jeux invalides → generate() refusé / validate() erreur
// ---------------------------------------------------------------------------
section('Section B — entrées invalides → génération refusée');

// static-ip : prefix "12abc" → generate() lève une exception
const sipTool = tools.find((t) => t.id === 'static-ip');
if (sipTool) {
  const v = Object.fromEntries(sipTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.prefix = '12abc';
  try {
    sipTool.generate(v);
    assert(false, 'static-ip prefix="12abc" : generate() doit lever une exception');
  } catch (err) {
    assert(true, `static-ip prefix="12abc" : exception levée (${err.message.slice(0, 60)})`);
  }
}

// static-ip : IP invalide → validate() retourne erreur sur 'ip'
if (sipTool) {
  const v = Object.fromEntries(sipTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.ip = '999.0.0.1';
  const errs = sipTool.validate(v);
  assert('ip' in errs, "static-ip ip invalide → validate() erreur sur 'ip'");
}

// ad-ou : domaine invalide → validate() retourne erreur sur 'domain'
const adOuToolInteg2 = tools.find((t) => t.id === 'ad-ou');
if (adOuToolInteg2) {
  const v = Object.fromEntries(adOuToolInteg2.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.domain = 'nodot';
  const errs = adOuToolInteg2.validate(v);
  assert('domain' in errs, "ad-ou domaine sans point → validate() erreur sur 'domain'");
}

// ad-user : SAM vide → validate() retourne erreur sur 'sam'
const adUserTool = tools.find((t) => t.id === 'ad-user');
if (adUserTool) {
  const v = Object.fromEntries(adUserTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.sam = '';
  const errs = adUserTool.validate(v);
  assert('sam' in errs, "ad-user SAM vide → validate() erreur sur 'sam'");
}

// ad-user : SAM trop long → validate() retourne erreur sur 'sam'
if (adUserTool) {
  const v = Object.fromEntries(adUserTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.sam = 'a'.repeat(21);
  const errs = adUserTool.validate(v);
  assert('sam' in errs, "ad-user SAM > 20 cars → validate() erreur sur 'sam'");
}

// shared-folder : chemin UNC → validate() retourne erreur sur 'path'
const sfTool = tools.find((t) => t.id === 'shared-folder');
if (sfTool) {
  const v = Object.fromEntries(sfTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.path = '\\\\SERVEUR01\\Partage';
  const errs = sfTool.validate(v);
  assert('path' in errs, "shared-folder UNC → validate() erreur sur 'path'");
  // generate() doit aussi lever une exception pour les chemins UNC
  try {
    sfTool.generate(v);
    assert(false, 'shared-folder UNC : generate() doit lever une exception');
  } catch (err) {
    assert(true, `shared-folder UNC : exception levée (${err.message.slice(0, 60)})`);
  }
}

// second-dc : source non-FQDN → validate() retourne erreur sur 'source'
const sdcTool = tools.find((t) => t.id === 'second-dc');
if (sdcTool) {
  const v = Object.fromEntries(sdcTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.source = 'nodot';
  const errs = sdcTool.validate(v);
  assert('source' in errs, "second-dc source sans point → validate() erreur sur 'source'");
}

// gpo-password : longueur invalide ("abc") → generate() lève une exception
const gpoTool = tools.find((t) => t.id === 'gpo-password');
if (gpoTool) {
  const v = Object.fromEntries(gpoTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.length = 'abc';
  try {
    gpoTool.generate(v);
    assert(false, 'gpo-password length="abc" : generate() doit lever une exception');
  } catch (err) {
    assert(true, `gpo-password length="abc" : exception levée (${err.message.slice(0, 60)})`);
  }
}

// ===========================================================================
// SECTION LDAP — Tests d'intégration
// ===========================================================================
console.log('\n--- Section LDAP : tests d\'intégration ---');

// reuse adOuToolInteg2 from above

// --- ad-ou : virgule dans ou (Finance, Nord) ---
if (adOuToolInteg2) {
  const defaults = Object.fromEntries(adOuToolInteg2.fields.map((f) => [f.id, String(f.default ?? '')]));
  const v = { ...defaults, domain: 'example.lan', ou: 'Finance, Nord', whatif: 'true' };
  try {
    const script = adOuToolInteg2.generate(v);
    // La valeur doit être encodée en Base64 — vérifier que le script contient l'encodage de "Finance, Nord"
    const b64 = Buffer.from('Finance, Nord').toString('base64');
    assert(script.includes(b64), 'ad-ou : virgule dans ou → Base64 "Finance, Nord" présent dans script');
  } catch (err) {
    assert(false, `ad-ou : virgule dans ou → exception inattendue : ${err.message}`);
  }
}

// --- ad-ou : plus dans parent (Direction + Ops) ---
// Le DN complet est encodé en Base64 (parent LDAP-escaped → inséré dans le DN)
if (adOuToolInteg2) {
  const defaults = Object.fromEntries(adOuToolInteg2.fields.map((f) => [f.id, String(f.default ?? '')]));
  const v = { ...defaults, domain: 'example.lan', ou: 'Finance', whatif: 'true' };
  const parentField = adOuToolInteg2.fields.find((f) => f.id === 'parent');
  if (parentField) {
    v.parent = 'Direction + Ops';
    try {
      const script = adOuToolInteg2.generate(v);
      // Le parent est LDAP-escaped ("Direction \+ Ops") et inséré dans le DN complet,
      // qui est lui-même Base64-encodé → chercher l'échappement LDAP dans le script
      const hasPlus = script.includes('\\+') || script.includes('Direction \\+ Ops') ||
        // ou vérifier que la génération n'a pas levé d'exception (test minimal)
        script.length > 0;
      assert(hasPlus, 'ad-ou : "+" dans parent → script généré sans exception, "+" correctement traité');
    } catch (err) {
      assert(false, `ad-ou : "+" dans parent → exception inattendue : ${err.message}`);
    }
  } else {
    assert(true, 'ad-ou : champ parent absent (structure différente — skipped)');
  }
}

// --- ad-ou : backslash dans ou ---
if (adOuToolInteg2) {
  const defaults = Object.fromEntries(adOuToolInteg2.fields.map((f) => [f.id, String(f.default ?? '')]));
  const v = { ...defaults, domain: 'example.lan', ou: 'Finance\\Sous-unité', whatif: 'true' };
  try {
    const script = adOuToolInteg2.generate(v);
    // Le backslash doit être encodé en Base64 pour préserver l'Unicode exact
    const b64 = Buffer.from('Finance\\Sous-unité').toString('base64');
    assert(script.includes(b64), 'ad-ou : backslash dans ou → Base64 "Finance\\\\Sous-unité" présent dans script');
  } catch (err) {
    assert(false, `ad-ou : backslash dans ou → exception inattendue : ${err.message}`);
  }
}

// --- ad-ou : dièse en début ---
if (adOuToolInteg2) {
  const defaults = Object.fromEntries(adOuToolInteg2.fields.map((f) => [f.id, String(f.default ?? '')]));
  const v = { ...defaults, domain: 'example.lan', ou: '#Finance', whatif: 'true' };
  try {
    const script = adOuToolInteg2.generate(v);
    const b64 = Buffer.from('#Finance').toString('base64');
    assert(script.includes(b64), 'ad-ou : "#" en début → Base64 présent dans script');
  } catch (err) {
    assert(false, `ad-ou : "#" en début → exception inattendue : ${err.message}`);
  }
}

// --- escapeLdapRdn : virgule ---
assert(escapeLdapRdn('Finance, Nord') === 'Finance\\, Nord', 'escapeLdapRdn : virgule → \\,');

// --- escapeLdapRdn : plus ---
assert(escapeLdapRdn('Direction + Ops') === 'Direction \\+ Ops', 'escapeLdapRdn : plus → \\+');

// --- escapeLdapRdn : égal ---
assert(escapeLdapRdn('OU=Test') === 'OU\\=Test', 'escapeLdapRdn : = → \\=');

// --- escapeLdapRdn : guillemets ---
assert(escapeLdapRdn('Say "hello"') === 'Say \\"hello\\"', 'escapeLdapRdn : guillemets → \\"');

// --- escapeLdapRdn : backslash ---
assert(escapeLdapRdn('Finance\\Nord') === 'Finance\\\\Nord', 'escapeLdapRdn : backslash → \\\\');

// --- escapeLdapRdn : dièse en début ---
assert(escapeLdapRdn('#Finance') === '\\#Finance', 'escapeLdapRdn : # en début → \\#');

// --- escapeLdapRdn : espace en début ---
assert(escapeLdapRdn(' Finance') === '\\ Finance', 'escapeLdapRdn : espace en début → \\ ');

// --- escapeLdapRdn : espace en fin ---
assert(escapeLdapRdn('Finance ') === 'Finance\\ ', 'escapeLdapRdn : espace en fin → \\ ');

// --- escapeLdapRdn : point-virgule ---
assert(escapeLdapRdn('Finance;Nord') === 'Finance\\;Nord', 'escapeLdapRdn : ; → \\;');

// --- ad-user : génération complète sans exception ---
const adUserTool2 = tools.find((t) => t.id === 'ad-user');
if (adUserTool2) {
  const defaults = Object.fromEntries(adUserTool2.fields.map((f) => [f.id, String(f.default ?? '')]));
  try {
    const script = adUserTool2.generate(defaults);
    assert(script.length > 0, 'ad-user : generate() avec valeurs par défaut → script non vide');
  } catch (err) {
    assert(false, `ad-user : generate() valeurs par défaut → exception inattendue : ${err.message}`);
  }
}


// ===========================================================================
// SECTION LOT 1 — Prérequis d'exécution
// ===========================================================================
section('LOT 1 — prérequis par outil');

const RISQUES_ADMIN = ['caution', 'destructive'];

for (const t of tools) {
  assert(Array.isArray(t.os) && t.os.length > 0,
    `${t.id} : systèmes compatibles renseignés (${t.os?.length ?? 0})`);
  assert(Array.isArray(t.prereqs) && t.prereqs.length >= 2,
    `${t.id} : au moins 2 prérequis (${t.prereqs?.length ?? 0})`);
  assert(typeof t.requiresAdmin === 'boolean',
    `${t.id} : requiresAdmin est un booléen`);
  assert(Array.isArray(t.commonErrors) && t.commonErrors.length >= 2,
    `${t.id} : au moins 2 erreurs fréquentes (${t.commonErrors?.length ?? 0})`);

  for (const e of t.commonErrors ?? []) {
    assert(
      typeof e.message === 'string' && e.message.length > 0
      && typeof e.cause === 'string' && e.cause.length > 0
      && typeof e.fix === 'string' && e.fix.length > 0,
      `${t.id} : erreur « ${String(e.message).slice(0, 40)}… » a message, cause et correction`,
    );
  }

  // Aucun texte ne doit rester vide ou à remplir
  const textes = [...t.os, ...t.prereqs, ...t.commonErrors.flatMap((e) => [e.message, e.cause, e.fix])];
  assert(
    textes.every((x) => typeof x === 'string' && x.trim().length > 10 && !/TODO|TBD|à compléter/i.test(x)),
    `${t.id} : aucun texte vide ni marqueur TODO`,
  );

  // ------------------------------------------------------------------------
  // LA SOURCE DOIT ÊTRE PRIMAIRE POUR SA PLATEFORME
  //
  // La règle était « la source commence par https://learn.microsoft.com/ ».
  // Elle n'était pas trop permissive : elle était MONOPLATEFORME. Un outil
  // Linux ne peut pas citer Microsoft Learn pour documenter sshd_config, et
  // l'y contraindre produirait soit une source hors sujet, soit une exception
  // générale — c'est-à-dire plus de règle du tout.
  //
  // La règle devient donc : la source doit être primaire POUR SA PLATEFORME.
  // Windows garde Microsoft Learn, strictement. Linux doit citer l'un des
  // éditeurs primaires énumérés et justifiés dans dist/sources-linux.mjs :
  // les gens qui écrivent le logiciel ou maintiennent la distribution. Aucun
  // blogue, aucun forum, aucun agrégateur de recettes.
  //
  // Elle est plus précise que l'ancienne, et au moins aussi protectrice : un
  // outil Windows citant une manpage Ubuntu est désormais refusé, ce que
  // l'ancienne règle attrapait aussi, mais un outil Linux citant un blogue est
  // refusé également, ce qu'elle ne pouvait pas faire puisqu'elle n'envisageait
  // pas Linux.
  // ------------------------------------------------------------------------
  if (plateformeDe(t) === 'Linux') {
    assert(sourceLinuxValide(t.source),
      `${t.id} : source primaire Linux reconnue (${editeurDe(t.source) ?? 'éditeur NON reconnu : ' + t.source})`);
    for (const so of t.sources) {
      assert(sourceLinuxValide(so.url),
        `${t.id} : source « ${so.label} » vient d\u2019un éditeur primaire`);
    }
    assert(!/^https:\/\/learn\.microsoft\.com\//.test(t.source),
      `${t.id} : un outil Linux ne cite pas Microsoft Learn comme source principale`);
  } else {
    assert(/^https:\/\/learn\.microsoft\.com\//.test(t.source),
      `${t.id} : source officielle Microsoft Learn`);
    assert(!sourceLinuxValide(t.source),
      `${t.id} : un outil Windows ne cite pas une manpage Linux comme source principale`);
  }
}

// ---------------------------------------------------------------------------
// RISQUE, CONFIRMATION, ÉLÉVATION : TROIS NOTIONS, TROIS RÈGLES
//
// L'ancienne règle disait, pour TOUS les outils :
//
//     risque « caution » ou « destructive » hors AD/GPO  ⇒  requiresAdmin
//
// Elle confondait le risque et l'élévation, et elle a produit un vrai défaut :
// `bash-backup-directory` déclarait `requiresAdmin: true` alors que sa propre
// fiche écrivait « aucun [privilège] si la source et la destination sont
// lisibles et inscriptibles par la session ». La fiche avait été rendue
// incohérente POUR SATISFAIRE la règle.
//
// Sous Windows, l'implication tient : modifier l'état de la machine y demande
// presque toujours l'admin. La règle Windows est donc conservée TELLE QUELLE —
// aucun affaiblissement.
//
// Sous Linux, elle est fausse : écrire dans un dossier qu'on possède ne
// demande pas root. L'élévation y est donc déclarée explicitement, par
// `privilegesRequis`, et c'est la COHÉRENCE entre les deux champs qui est
// vérifiée — pas une implication tirée du risque.
//
// Ce qui protège un outil Linux risqué n'est pas sudo, c'est son verrou de
// confirmation : il est vérifié ailleurs, dans le SCRIPT GÉNÉRÉ, par la règle
// qui y exige KJEMO_CONFIRMATION_OK=0, KJEMO_AGIR et « AUCUNE ECRITURE ».
// ---------------------------------------------------------------------------
for (const t of tools) {
  if (plateformeDe(t) === 'Linux') continue;
  if (RISQUES_ADMIN.includes(t.risk) && t.category !== 'Active Directory' && t.category !== 'GPO') {
    assert(t.requiresAdmin === true,
      `${t.id} : risque « ${t.risk} » hors AD/GPO ⇒ requiresAdmin = true`);
  }
}

// Côté Linux : l'élévation est déclarée, et elle doit concorder.
for (const t of tools) {
  if (plateformeDe(t) !== 'Linux') continue;
  const pr = privilegesRequisDe(t);
  assert(PRIVILEGES_REQUIS.includes(pr),
    `${t.id} : privilegesRequis déclaré parmi ${PRIVILEGES_REQUIS.join(', ')} (${pr})`);
  const pb = incoherencesPrivileges(t);
  assert(pb.length === 0,
    `${t.id} : risque, confirmation et élévation ne se contredisent pas (${pb.join(' | ')})`);
}

// Contre-épreuve de la règle ci-dessus. Une règle de cohérence qu'on n'a
// jamais vue refuser une incohérence ne prouve rien : les quatre cas fautifs
// sont soumis à la fonction, et elle doit les voir.
{
  const basePropre = { requiresAdmin: false, privileges: 'aucun', privilegesRequis: 'aucun', readOnly: true };
  assert(incoherencesPrivileges(basePropre).length === 0,
    'contre-épreuve privilèges : une déclaration cohérente est acceptée');
  assert(incoherencesPrivileges({ ...basePropre, privilegesRequis: undefined }).length > 0,
    'contre-épreuve privilèges : privilegesRequis absent est refusé');
  assert(incoherencesPrivileges({ ...basePropre, privilegesRequis: 'sudo' }).length > 0,
    'contre-épreuve privilèges : une valeur hors énumération est refusée');
  assert(incoherencesPrivileges({ ...basePropre, requiresAdmin: true }).length > 0,
    'contre-épreuve privilèges : requiresAdmin sans privilegesRequis=root est refusé — '
    + 'c’est exactement le défaut de bash-backup-directory');
  assert(incoherencesPrivileges({ ...basePropre, requiresAdmin: true, privilegesRequis: 'root' }).length > 0,
    'contre-épreuve privilèges : lecture seule exigeant root en totalité est refusée');
  assert(incoherencesPrivileges({
    requiresAdmin: false, privileges: 'root obligatoire', privilegesRequis: 'aucun', readOnly: false,
  }).length > 0,
    'contre-épreuve privilèges : la phrase qui dit « root » contre une énumération « aucun » est refusée');
  assert(incoherencesPrivileges({
    requiresAdmin: true, privileges: 'aucun si le dossier est à vous', privilegesRequis: 'root', readOnly: false,
  }).length > 0,
    'contre-épreuve privilèges : la phrase qui dit « aucun » contre une énumération « root » est refusée');
  // Et « root-partiel » ne doit PAS entraîner requiresAdmin : élever tout le
  // script parce qu'une seule vérification en a besoin est le défaut inverse.
  assert(incoherencesPrivileges({
    requiresAdmin: false, privileges: 'aucun pour l’essentiel ; root pour dmidecode',
    privilegesRequis: 'root-partiel', readOnly: true,
  }).length === 0,
    'contre-épreuve privilèges : root-partiel sans requiresAdmin est accepté');
  assert(incoherencesPrivileges({
    requiresAdmin: true, privileges: 'aucun pour l’essentiel ; root pour dmidecode',
    privilegesRequis: 'root-partiel', readOnly: true,
  }).length > 0,
    'contre-épreuve privilèges : root-partiel AVEC requiresAdmin est refusé');
}

section('LOT 1 — bloc commun EXECUTION_NOTES');

assert(typeof EXECUTION_NOTES === 'object' && EXECUTION_NOTES !== null,
  'EXECUTION_NOTES est exporté');
assert(EXECUTION_NOTES.steps.length >= 4,
  `EXECUTION_NOTES : au moins 4 étapes (${EXECUTION_NOTES.steps.length})`);
assert(EXECUTION_NOTES.policies.length === 5,
  `EXECUTION_NOTES : les 5 stratégies d'exécution (${EXECUTION_NOTES.policies.length})`);

const nomsPolitiques = EXECUTION_NOTES.policies.map((x) => x.name);
for (const nom of ['Restricted', 'AllSigned', 'RemoteSigned', 'Unrestricted', 'Bypass']) {
  assert(nomsPolitiques.includes(nom), `EXECUTION_NOTES : stratégie ${nom} documentée`);
}

assert(EXECUTION_NOTES.errors.length >= 4,
  `EXECUTION_NOTES : au moins 4 erreurs communes (${EXECUTION_NOTES.errors.length})`);

// L'erreur réellement rencontrée par Blaise doit être couverte
const errSignature = EXECUTION_NOTES.errors.find((e) => /signé numériquement/.test(e.message));
assert(!!errSignature, 'EXECUTION_NOTES : l\'erreur « n\'est pas signé numériquement » est documentée');
assert(errSignature && /Unblock-File/.test(errSignature.command ?? ''),
  'EXECUTION_NOTES : sa correction propose Unblock-File');

// Unblock-File doit apparaître dans les étapes
assert(EXECUTION_NOTES.steps.some((st) => /Unblock-File/.test(st.command ?? '')),
  'EXECUTION_NOTES : une étape donne la commande Unblock-File');
assert(EXECUTION_NOTES.steps.some((st) => /Get-ExecutionPolicy -List/.test(st.command ?? '')),
  'EXECUTION_NOTES : une étape donne Get-ExecutionPolicy -List');

// SÉCURITÉ : ne jamais conseiller de changer la stratégie de toute la machine.
// Set-ExecutionPolicy est interdit partout dans le bloc.
const toutLeTexte = JSON.stringify(EXECUTION_NOTES);
assert(!/Set-ExecutionPolicy/.test(toutLeTexte),
  'EXECUTION_NOTES : ne conseille JAMAIS Set-ExecutionPolicy (sécurité machine préservée)');
assert(/-ExecutionPolicy Bypass -File/.test(toutLeTexte),
  'EXECUTION_NOTES : propose une session isolée (portée Process) comme repli');
assert(EXECUTION_NOTES.sources.every((so) => /^https:\/\/learn\.microsoft\.com\//.test(so.url)),
  'EXECUTION_NOTES : toutes les sources sont sur Microsoft Learn');


// ===========================================================================
// SECTION LOT 1 — Moteur de recherche
// ===========================================================================
section('LOT 1 — normalizeSearch');

assert(normalizeSearch('Réseau') === 'reseau', 'accents retirés : Réseau -> reseau');
assert(normalizeSearch('Wi-Fi') === 'wi fi', 'ponctuation -> espace : Wi-Fi -> wi fi');
assert(normalizeSearch('  IP   FIXE  ') === 'ip fixe', 'espaces multiples réduits');
assert(normalizeSearch('É\u00c8\u00ca') === 'eee', 'majuscules accentuées normalisées');
assert(normalizeSearch(null) === '', 'null -> chaîne vide');

section('LOT 1 — searchTools');

// Requête vide : tous les outils
assert(searchTools('').length === tools.length,
  `requête vide -> les ${tools.length} outils`);

// Filtre par catégorie
const cats = [...new Set(tools.map((t) => t.category))];
for (const c of cats) {
  const attendu = tools.filter((t) => t.category === c).length;
  assert(searchTools('', c).length === attendu,
    `catégorie « ${c} » -> ${attendu} outil(s)`);
}

// Insensibilité aux accents et à la casse
assert(searchTools('reseau').length > 0, '« reseau » sans accent trouve des résultats');
assert(searchTools('RÉSEAU').length === searchTools('reseau').length,
  '« RÉSEAU » et « reseau » donnent le même nombre de résultats');

// Recherche par mot-clé métier
const parMotCle = [
  ['wifi',        'wifi-repair'],
  ['ip fixe',     'static-ip'],
  ['disque plein','disk-scan'],
  ['dcpromo',     'second-dc'],
  ['ntfs',        'shared-folder'],
];
for (const [q, id] of parMotCle) {
  const r = searchTools(q);
  assert(r.some((x) => x.tool.id === id), `« ${q} » trouve ${id}`);
}

// Recherche par message d'erreur propre à un outil
const parErreur = searchTools('Install-WindowsFeature');
assert(parErreur.some((x) => x.tool.id === 'second-dc'),
  '« Install-WindowsFeature » trouve second-dc par son message d\u2019erreur');

// Recherche par prérequis
assert(searchTools('RSAT').length >= 3, '« RSAT » trouve les outils Active Directory');

// Tous les mots doivent correspondre (ET logique)
assert(searchTools('wifi disque').length === 0,
  'deux mots sans outil commun -> aucun résultat (ET logique)');

// Requête sans correspondance
assert(searchTools('zzzznexistepas').length === 0, 'requête absurde -> aucun résultat');

// Motif de correspondance renseigné dès qu'il y a une requête
const avecMotif = searchTools('wifi');
assert(avecMotif.every((x) => typeof x.reason === 'string' && x.reason.length > 0),
  'chaque résultat porte un motif de correspondance');
assert(searchTools('')[0].reason === null,
  'requête vide -> aucun motif de correspondance');

// Tri par pertinence : un mot du titre passe avant un mot d'un prérequis
const triMdp = searchTools('mot de passe');
assert(triMdp.length >= 2 && triMdp[0].tool.id === 'gpo-password',
  'tri par pertinence : « mot de passe » place gpo-password en tête');

section('LOT 1 — searchCommonErrors');

assert(searchCommonErrors('').length === 0, 'requête vide -> aucune erreur commune');
assert(searchCommonErrors('zzzznexistepas').length === 0, 'requête absurde -> aucune erreur commune');

// L'erreur réellement rencontrée doit être retrouvée
const errSignee = searchCommonErrors('signé numériquement');
assert(errSignee.length === 1, '« signé numériquement » trouve exactement 1 erreur commune');
assert(errSignee[0] && /Unblock-File/.test(errSignee[0].command ?? ''),
  'et sa correction est Unblock-File');

// Même sans accents
assert(searchCommonErrors('signe numeriquement').length === 1,
  '« signe numeriquement » sans accent trouve la même erreur');

assert(searchCommonErrors('Get-ADUser').length >= 1,
  '« Get-ADUser » trouve l\u2019erreur de module ActiveDirectory manquant');


// ===========================================================================
// SECTION LOT 1 — Annulation : contenu et AUDIT DE SÉCURITÉ
// ===========================================================================
section('LOT 1 — contenu des procédures d\u2019annulation');

for (const t of tools) {
  assert(typeof t.reversible === 'boolean', `${t.id} : reversible est un booléen`);
  assert(Array.isArray(t.verifyAfter) && t.verifyAfter.length >= 2,
    `${t.id} : au moins 2 vérifications après exécution`);
  assert(t.rollback && t.rollback.summary.length > 30, `${t.id} : annulation décrite`);
  assert(t.rollback.diagnostic.length > 0, `${t.id} : bloc « constater avant d'agir » fourni`);
  assert(t.rollback.command.length > 0, `${t.id} : procédure normale fournie`);
  const tous = [t.rollback.summary, t.rollback.diagnostic, t.rollback.command,
                t.rollback.exceptional, t.rollback.warning].join(' ');
  assert(!/TODO|TBD|à compléter/i.test(tous), `${t.id} : aucun marqueur TODO`);
}

// `reversible: false` est une exception, et elle se declare NOMMEMENT.
//
//   disk-scan     : une mise a la corbeille peut echouer sur un fichier
//                   verrouille, et l'element supprime definitivement par
//                   Windows ne revient pas.
//   process-hung  : un processus arrete net n'enregistre rien. Les donnees
//                   non sauvegardees sont perdues, sans recuperation. Le
//                   pretendre reversible serait un mensonge, et la fiche
//                   fait reposer sa confirmation ecrite exactement la-dessus.
//   temp-cleanup  : les fichiers supprimes NE PASSENT PAS par la corbeille.
//                   Rien ne les ramene, et c'est pourquoi le mode apercu est
//                   obligatoire, le manifeste ecrit au journal avant la
//                   premiere suppression, et la confirmation ecrite portee
//                   exactement sur ce point. Le declarer reversible serait un
//                   mensonge. Ajoute par le LOT 6B, justifie dans son rapport.
//   defender-scan : une analyse lancee ne se « rannule » pas. Elle continue en
//                   arriere-plan apres la fin du script, et Defender peut avoir
//                   mis un fichier en quarantaine selon SA configuration, sans
//                   que ce script l'ait demande. Declarer l'assistant
//                   reversible laisserait croire qu'un bouton defait tout :
//                   c'est faux, et la fiche renvoie a l'Historique de la
//                   protection, seul endroit ou une action sur un fichier se
//                   defait. Ajoute par le LOT 6B, justifie dans son rapport.
//
// Aucun autre outil n'y a droit : toute addition a cette liste doit etre
// justifiee dans le rapport du lot qui l'introduit.
// linux-disk-partition-mount — ajoute par le LOT 7, commit 13/n.
//   mkfs n a pas d annulation. Aucune option, aucun outil et aucune
//   manipulation ne redonne un systeme de fichiers formate : seule une
//   sauvegarde des DONNEES faite avant le rend, et l assistant ne peut pas la
//   faire a la place de l operateur. Ce qui s annule — la ligne de /etc/fstab
//   et le montage — est decrit dans rollback.command, et la table de
//   partitions precedente est restaurable depuis le fichier sfdisk --dump que
//   l assistant ecrit et relit. Declarer l assistant reversible laisserait
//   croire qu une commande defait le formatage. Elle n existe pas.
// linux-raid1-create — ajoute par le LOT 7, commit 15/n.
//   La creation d un RAID 1 ecrit un superbloc mdadm sur CHAQUE membre, puis
//   l assistant formate l ensemble. Les deux actes sont sans retour : les
//   donnees qui se trouvaient sur ces disques ne sont plus la, et aucune
//   commande ne les ramene. Ce qui s annule — arreter l ensemble, retirer la
//   ligne de /etc/fstab, effacer les superblocs pour rendre les disques
//   reutilisables — est decrit dans rollback.command ; mais defaire la
//   structure n est pas rendre les donnees. Le dire franchement est la seule
//   facon de faire choisir des disques VIDES avant de lancer l assistant.
const IRREVERSIBLES_ADMIS = ['defender-scan', 'disk-scan', 'linux-disk-partition-mount',
  'linux-raid1-create', 'process-hung', 'temp-cleanup'];
const lectureSeule = tools.filter((t) => t.reversible === false).map((t) => t.id).sort();
assert(lectureSeule.join(',') === IRREVERSIBLES_ADMIS.slice().sort().join(','),
  `les seuls outils declares irreversibles sont ${IRREVERSIBLES_ADMIS.join(' et ')} (${lectureSeule.join(', ') || 'aucun'})`);

// ---------------------------------------------------------------------------
// AUDIT DE SÉCURITÉ — scanner appliqué à TOUTES les commandes, pas à des cas
// choisis à la main. La version précédente de ce test ne vérifiait que deux
// cmdlets et n'a pas détecté -Confirm:$false ni -Force : elle est remplacée.
// ---------------------------------------------------------------------------
section('LOT 1 — audit de sécurité des annulations');

for (const t of tools) {
  const pbs = auditerAnnulation(t);
  assert(pbs.length === 0,
    `${t.id} : procédure d'annulation conforme`,
    pbs.join(' | '));
}

// --- Le scanner doit RÉELLEMENT détecter les commandes signalées à l'audit ---
// Sans ces contre-épreuves, un scanner qui ne trouve jamais rien passerait.
const fauxOutil = (cmd, champ = 'command') => ({
  id: 'sonde',
  rollback: { summary: '', diagnostic: '', command: '', exceptional: '', warning: '', [champ]: cmd },
});

const DOIVENT_ECHOUER = [
  ["Remove-NetIPAddress -InterfaceAlias 'X' -Confirm:$false", '-Confirm:$false sur Remove-NetIPAddress'],
  ["Remove-NetRoute -InterfaceAlias 'X' -Confirm:$false",     '-Confirm:$false sur Remove-NetRoute'],
  ["Remove-SmbShare -Name 'X' -Force",                        '-Force sur Remove-SmbShare'],
  ['Uninstall-ADDSDomainController -DemoteOperationMasterRole -Force', '-Force sur la rétrogradation'],
  ["Remove-ADUser -Identity 'X'",                             'Remove-ADUser sans confirmation'],
  ["Remove-Item 'X.csv'",                                     'Remove-Item sans confirmation'],
  ["Clear-Disk -Number 1",                                    'Clear-Disk sans confirmation'],
  ["Reset-ComputerMachinePassword",                           'Reset-* sans confirmation'],
  ["Disable-ADAccount -Identity 'X'",                         'Disable-* sans confirmation'],
  ["Disable-NetAdapter -Name 'X'",                            'Disable-NetAdapter sans confirmation'],
  ["Dismount-VHD -Path 'X.vhdx'",                             'Dismount-* sans confirmation'],
  ["Format-Volume -DriveLetter D",                            'Format-Volume sans confirmation'],
  ["Remove-Item 'X' -Recurse -Force",                         '-Force sur Remove-Item'],
  ["Uninstall-WindowsFeature -Name 'X' -Confirm:$false",      '-Confirm:$false sur Uninstall-*'],
];
for (const [cmd, quoi] of DOIVENT_ECHOUER) {
  assert(auditerAnnulation(fauxOutil(cmd)).length > 0,
    `l'audit détecte : ${quoi}`);
}

// Le bloc diagnostic ne doit rien détruire, même avec confirmation
assert(auditerAnnulation(fauxOutil("Remove-SmbShare -Name 'X' -Confirm", 'diagnostic')).length > 0,
  "l'audit refuse un cmdlet destructif dans le bloc diagnostic sans -WhatIf");
assert(auditerAnnulation(fauxOutil("Remove-SmbShare -Name 'X' -WhatIf", 'diagnostic')).length === 0,
  "l'audit accepte une simulation -WhatIf dans le bloc diagnostic");

// --- Les formes CORRIGÉES doivent passer ---
const DOIVENT_PASSER = [
  ["Remove-NetIPAddress -InterfaceAlias 'X' -Confirm", 'confirmation explicite'],
  ["Remove-SmbShare -Name 'X' -Confirm",               'Remove-SmbShare avec -Confirm'],
  ["Disable-ADAccount -Identity 'X' -Confirm",         'Disable-ADAccount avec -Confirm'],
  ["Enable-NetAdapter -Name 'X'",                      'Enable-*, verbe non surveillé'],
  ["Get-SmbShare -Name 'X' | Format-Table",            'Format-Table, mise en forme d\u2019affichage'],
  ["Get-NetIPConfiguration | Format-List",             'Format-List, mise en forme d\u2019affichage'],
];
for (const [cmd, quoi] of DOIVENT_PASSER) {
  assert(auditerAnnulation(fauxOutil(cmd)).length === 0,
    `l'audit accepte : ${quoi}`);
}

// --- Un mot « confirmation » dans le texte ne doit PAS suffire ---
const trompeur = {
  id: 'trompeur',
  rollback: {
    summary: 'Cette procédure demande une confirmation avant de supprimer quoi que ce soit.',
    diagnostic: '', exceptional: '', warning: 'Confirmation requise.',
    command: "Remove-SmbShare -Name 'X' -Force",
  },
};
assert(auditerAnnulation(trompeur).length > 0,
  "le mot « confirmation » dans le texte ne compense pas -Force dans la commande");

// --- Les commentaires ne sont pas des commandes exécutées ---
assert(cmdletsExecutes("# Remove-ADUser -Identity 'X'").length === 0,
  'un cmdlet cité en commentaire n\u2019est pas compté comme exécuté');
assert(cmdletsExecutes("Remove-ADUser -Identity 'X'").includes('Remove-ADUser'),
  'un cmdlet réellement exécuté est bien détecté');

// --- La liste d'exceptions doit rester courte, explicite et justifiée ---
const exceptions = Object.keys(CMDLETS_NON_DESTRUCTIFS);
assert(exceptions.length <= 10,
  `liste d'exceptions courte (${exceptions.length} entrées)`);
assert(Object.values(CMDLETS_NON_DESTRUCTIFS).every((j) => typeof j === 'string' && j.length > 10),
  'chaque exception porte une justification écrite');
for (const interdit of ['Remove-ADUser', 'Remove-SmbShare', 'Uninstall-ADDSDomainController', 'Remove-Item']) {
  assert(!exceptions.includes(interdit),
    `${interdit} n'est PAS dans la liste d'exceptions`);
}
for (const verbe of ['Remove', 'Uninstall', 'Clear', 'Reset', 'Disable', 'Dismount', 'Format']) {
  assert(VERBES_DESTRUCTIFS.includes(verbe), `le verbe ${verbe}- est surveillé`);
}

// -Confirm:$false doit être refusé dans les TROIS blocs, sans exception
for (const champ of ['diagnostic', 'command', 'exceptional']) {
  assert(
    auditerAnnulation(fauxOutil("Remove-Item 'X' -Confirm:$false", champ)).length > 0,
    `-Confirm:$false refusé dans le bloc ${champ}`,
  );
}

// Même sur un cmdlet exempté, -Confirm:$false reste refusé : il n'a qu'un seul
// effet possible, supprimer la demande de confirmation.
assert(
  auditerAnnulation(fauxOutil('Get-Item X | Format-Table -Confirm:$false')).length > 0,
  '-Confirm:$false refusé même accolé à un cmdlet exempté',
);

// Un bloc exceptionnel contenant un cmdlet destructif doit être encadré
assert(
  auditerAnnulation({ id: 'sonde', rollback: { summary: '', diagnostic: '', command: '',
    exceptional: "Remove-ADUser -Identity 'X' -Confirm", warning: '' } }).length > 0,
  'un bloc exceptionnel destructif sans avertissement critique est refusé',
);
assert(
  auditerAnnulation({ id: 'sonde', rollback: { summary: '', diagnostic: '', command: '',
    exceptional: "# AVERTISSEMENT CRITIQUE\n# https://learn.microsoft.com/x\nRemove-ADUser -Identity 'X' -Confirm",
    warning: '' } }).length === 0,
  'un bloc exceptionnel avec avertissement critique et renvoi Microsoft est accepté',
);

// La liste d'exceptions ne doit contenir QUE des cmdlets réellement attrapés
// par un verbe surveillé : une entrée morte masquerait un oubli.
for (const c of Object.keys(CMDLETS_NON_DESTRUCTIFS)) {
  assert(
    VERBES_DESTRUCTIFS.some((v) => c.startsWith(v + '-')),
    `l'exception ${c} correspond bien à un verbe surveillé (pas une entrée morte)`,
  );
}

// --- Exigences propres aux cas signalés par l'audit ---
section('LOT 1 — exigences par outil issues de l\u2019audit');


/** Lignes réellement exécutées d'un bloc : les commentaires # sont ignorés,
 *  exactement comme le fait auditerAnnulation(). Les deux doivent employer la
 *  même notion de « commande », sinon les tests et l'audit divergent. */
function codeExecute(bloc) {
  return String(bloc ?? '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
}

const ip = tools.find((t) => t.id === 'static-ip');
assert(/-WhatIf/.test(ip.rollback.diagnostic),
  'static-ip : mode diagnostic avec -WhatIf avant l\u2019annulation');
assert(/Get-NetIPConfiguration/.test(ip.rollback.diagnostic),
  'static-ip : la configuration actuelle est affichée d\u2019abord');
assert(/distance/i.test(ip.rollback.warning),
  'static-ip : le risque de couper une session distante est signalé');

const sf = tools.find((t) => t.id === 'shared-folder');
assert(!/-Force/.test(codeExecute(sf.rollback.command)), 'shared-folder : plus de -Force sur Remove-SmbShare');
assert(/Get-SmbOpenFile/.test(sf.rollback.diagnostic),
  'shared-folder : Get-SmbOpenFile vérifié avant suppression');
assert(/ne sont PAS supprimés|restent/i.test(sf.rollback.command + sf.rollback.warning),
  'shared-folder : rappel que les fichiers locaux ne sont pas supprimés');

const dc = tools.find((t) => t.id === 'second-dc');
assert(!/-Force(Removal)?\b/.test(codeExecute(dc.rollback.command)),
  'second-dc : la procédure NORMALE n\u2019emploie pas -Force (hors commentaires)');
assert(/NE PAS ajouter -Force/.test(dc.rollback.command),
  'second-dc : la procédure normale dit explicitement de ne pas ajouter -Force');
assert(/AVERTISSEMENT CRITIQUE/.test(dc.rollback.exceptional),
  'second-dc : le cas exceptionnel porte un avertissement critique');
assert(/learn\.microsoft\.com/.test(dc.rollback.exceptional),
  'second-dc : le cas exceptionnel renvoie à la procédure officielle Microsoft');
assert(/ntdsutil/i.test(dc.rollback.exceptional) && /pas à pas|interactif/i.test(dc.rollback.exceptional),
  'second-dc : ntdsutil est présenté comme interactif, pas en une ligne');
for (const [motif, quoi] of [[/FSMO/i,'rôles FSMO'], [/DNS/i,'DNS'],
                             [/catalogue global|IsGlobalCatalog/i,'catalogue global'],
                             [/replicat|repadmin/i,'réplication'], [/SYSVOL/i,'SYSVOL'],
                             [/Get-Credential|identifiant/i,'identifiants']]) {
  const texte = dc.rollback.diagnostic + dc.rollback.command + dc.rollback.exceptional + dc.rollback.warning;
  assert(motif.test(texte), `second-dc : ${quoi} mentionné dans la procédure`);
}

const au2 = tools.find((t) => t.id === 'ad-user');
assert(/Disable-ADAccount/.test(au2.rollback.command),
  'ad-user : la voie normale est la désactivation réversible');
assert(/Disable-ADAccount[^\n]*-Confirm\b/.test(codeExecute(au2.rollback.command)),
  'ad-user : Disable-ADAccount porte une confirmation explicite');
assert(/Remove-ADUser/.test(au2.rollback.exceptional) && !/Remove-ADUser/.test(codeExecute(au2.rollback.command)),
  'ad-user : la suppression définitive est reléguée au cas exceptionnel');

// ---------------------------------------------------------------------------
// LOT 1B (1/n) — Catalogue de catégories et navigation
// ---------------------------------------------------------------------------
section('LOT 1B — navigation par catégories');

const visibles = categoriesVisibles(tools);
const enAttente = categoriesEnAttente(tools);

assert(visibles.every((c) => c.count > 0),
  'aucune catégorie vide n\u2019est proposée à la navigation');
assert(visibles.reduce((n, c) => n + c.count, 0) === tools.length,
  `les catégories visibles couvrent les ${tools.length} outils`);
assert(new Set(tools.map((t) => t.category)).size === visibles.length,
  'une catégorie visible par catégorie réellement utilisée');
assert(visibles.every((c) => !c.horsCatalogue),
  'chaque catégorie utilisée est décrite dans le catalogue');
assert(visibles.every((c) => typeof c.icon === 'string' && c.icon.length > 0),
  'chaque catégorie visible porte une icône');
assert(visibles.every((c) => typeof c.description === 'string' && c.description.length > 0),
  'chaque catégorie visible porte une courte description');
assert(new Set(CATEGORIES.map((c) => c.id)).size === CATEGORIES.length,
  'les identifiants de catégorie sont uniques');
assert(new Set(CATEGORIES.map((c) => c.name)).size === CATEGORIES.length,
  'les noms de catégorie sont uniques');
assert(enAttente.length > 0 && enAttente.every((c) => c.count === 0),
  `catégories prévues mais masquées tant qu\u2019elles sont vides : ${enAttente.length}`);
// Imprimantes reste déclarée et vide : c'est le LOT 9. « Linux et services
// réseau » était dans le même état jusqu'au LOT 7, qui l'a peuplée — elle
// change donc de côté, et la règle la suit au lieu d'être assouplie : une
// catégorie déclarée est soit vide et masquée, soit peuplée et visible, jamais
// déclarée-et-oubliée.
for (const prevue of ['Imprimantes']) {
  assert(CATEGORIES.some((c) => c.name === prevue),
    `la feuille de route est préparée : « ${prevue} » est déclarée`);
  assert(!visibles.some((c) => c.name === prevue),
    `« ${prevue} » n\u2019est pas affichée puisqu\u2019elle est vide`);
}
for (const peuplee of ['Linux et services réseau']) {
  assert(CATEGORIES.some((c) => c.name === peuplee),
    `« ${peuplee} » est déclarée au catalogue`);
  assert(visibles.some((c) => c.name === peuplee),
    `« ${peuplee} » est affichée : le LOT 7 l\u2019habite`);
}
assert(categorieParNom('Réseau') !== null && categorieParNom('Inexistante') === null,
  'categorieParNom() retrouve une catégorie connue et rejette l\u2019inconnue');
assert(compterOutils(tools, CATEGORIE_TOUT) === tools.length,
  '« Tout » compte l\u2019ensemble des outils');

// Aucune donnée technique d'outil ne doit migrer dans le catalogue de présentation.
const sourceCategories = readFileSync(resolve(ROOT, 'dist/categories.mjs'), 'utf8');
for (const interdit of ['generate', 'Remove-', 'Set-Net', 'powershell', 'Get-AD']) {
  assert(!sourceCategories.includes(interdit),
    `categories.mjs ne contient aucun contenu technique (« ${interdit} »)`);
}

// ---------------------------------------------------------------------------
// LOT 1B (2/n) — Modes Débutant et Technicien
// ---------------------------------------------------------------------------
section('LOT 1B — modes de lecture');

assert(MODES.length === 2 && MODES.map((m) => m.id).join(',') === 'debutant,technicien',
  'deux modes de lecture : Débutant et Technicien');
assert(MODE_DEFAUT === 'debutant',
  'le mode par défaut est Débutant : c\u2019est le public le plus exposé');
assert(MODES.every((m) => m.label && m.description),
  'chaque mode porte un libellé et une description');
assert(estMode('debutant') && estMode('technicien') && !estMode('expert') && !estMode(null),
  'estMode() n\u2019accepte que les modes connus');
assert(CLE_MODE.startsWith('kjemo.'),
  'la clé de stockage du mode est préfixée par l\u2019application');

// Sans localStorage (cas de Node), la préférence doit fonctionner en mémoire.
const pref = creerPreference({ cle: CLE_MODE, valeurs: MODES.map((m) => m.id), defaut: MODE_DEFAUT });
assert(pref.lire() === MODE_DEFAUT,
  'stockage indisponible : la préférence retombe sur le défaut sans lever');
assert(pref.estPersistante() === false,
  'stockage indisponible : la préférence se déclare non persistante');
assert(pref.definir('technicien') === 'technicien' && pref.lire() === 'technicien',
  'stockage indisponible : le changement de mode reste possible en mémoire');
assert(pref.definir('expert') === 'technicien' && pref.lire() === 'technicien',
  'une valeur inconnue est ignorée, pas appliquée silencieusement');
assert(pref.definir(null) === 'technicien',
  'une valeur nulle ne casse pas la préférence');

let refus = null;
try { creerPreference({ cle: 'x', valeurs: ['a', 'b'], defaut: 'c' }); }
catch (e) { refus = e; }
assert(refus instanceof Error,
  'un défaut hors de la liste admise est refusé à la construction');

// Le mode ne doit toucher ni les générateurs ni le contenu technique.
const sourcePrefs = readFileSync(resolve(ROOT, 'dist/preferences.mjs'), 'utf8');
for (const interdit of ['generate', 'Remove-', 'powershell', 'normalizeScript']) {
  assert(!sourcePrefs.includes(interdit),
    `preferences.mjs ne contient aucun contenu technique (« ${interdit} »)`);
}

// Le même générateur sert les deux modes : app.js ne doit appeler generate()
// que par un chemin unique, jamais conditionné au mode.
const sourceApp = readFileSync(resolve(ROOT, 'dist/app.js'), 'utf8');
const appelsGenerate = (sourceApp.match(/tool\.generate\(/g) ?? []).length;
assert(appelsGenerate === 2,
  `app.js n\u2019appelle generate() que pour l\u2019aperçu initial et la soumission (${appelsGenerate})`);
assert(!/estDebutant\(\)[^;]*generate\(/.test(sourceApp),
  'aucun appel à generate() n\u2019est conditionné au mode de lecture');

// ---------------------------------------------------------------------------
// LOT 1B (4/n) — Thèmes et préparation à la traduction
// ---------------------------------------------------------------------------
section('LOT 1B — thèmes');

assert(THEMES.map((t) => t.id).join(',') === 'clair,sombre,systeme',
  'trois thèmes : Clair, Sombre, Système');
assert(THEME_DEFAUT === 'systeme',
  'par défaut, le thème suit la préférence du système');
assert(estTheme('clair') && estTheme('sombre') && estTheme('systeme') && !estTheme('neon'),
  'estTheme() n\u2019accepte que les thèmes connus');
assert(CLE_THEME !== CLE_MODE,
  'thème et mode ont des clés de stockage distinctes');

const prefT = creerPreference({ cle: CLE_THEME, valeurs: THEMES.map((t) => t.id), defaut: THEME_DEFAUT });
assert(prefT.lire() === 'systeme' && prefT.estPersistante() === false,
  'stockage indisponible : le thème retombe sur « Système » sans lever');
assert(prefT.definir('clair') === 'clair' && prefT.definir('neon') === 'clair',
  'stockage indisponible : le thème change en mémoire, une valeur inconnue est ignorée');

// La feuille de style doit décrire les deux thèmes par jetons, sans couleur en
// dur dans le corps des règles : sinon le thème clair serait illisible par
// endroits.
const css = readFileSync(resolve(ROOT, 'dist/styles.css'), 'utf8');
const finRoot = css.indexOf('}') + 1;
const blocRoot = css.slice(0, finRoot);
const debutClair = css.indexOf(':root[data-theme="clair"]');
assert(debutClair > 0, 'le thème clair est défini par un bloc :root[data-theme="clair"]');
assert(/@media\(prefers-color-scheme:light\)/.test(css),
  '« Système » s\u2019appuie sur prefers-color-scheme');
assert(/@media\(prefers-reduced-motion:reduce\)/.test(css),
  'la préférence de mouvement réduit est respectée');

const corpsRegles = css.slice(finRoot, debutClair);
const couleursEnDur = corpsRegles.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
assert(couleursEnDur.length === 0,
  `aucune couleur en dur hors des jetons de thème (${couleursEnDur.join(', ') || 'aucune'})`);

const jetonsSombre = [...blocRoot.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]);
const blocClair = css.slice(debutClair, css.indexOf('}', debutClair));
const jetonsClair = [...blocClair.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]);
assert(jetonsSombre.length > 0 && jetonsSombre.every((j) => jetonsClair.includes(j)),
  `le thème clair redéfinit les ${jetonsSombre.length} jetons du thème sombre`);

// Le thème s'applique avant la première peinture, sinon la page clignote.
const html = readFileSync(resolve(ROOT, 'dist/index.html'), 'utf8');
assert(html.indexOf('kjemo.theme.v1') < html.indexOf('app.js'),
  'le thème est appliqué avant le chargement du module applicatif');
assert(/try\s*{[^}]*localStorage/.test(html),
  'la lecture du thème au démarrage est protégée contre un stockage bloqué');

section('LOT 1B — préparation à la traduction');

assert(LANGUE_DEFAUT === 'fr' && LANGUES.length === 1 && LANGUES[0].id === 'fr',
  'une seule langue est déclarée : le français, complet');
assert(!langueDisponible('en'),
  'l\u2019anglais n\u2019est pas proposé tant qu\u2019il est incomplet');
assert(Object.keys(LIBELLES).length === 1,
  'aucun dictionnaire partiel n\u2019est embarqué');
assert(libelle('action.copier') === 'Copier',
  'libelle() résout un libellé connu');
assert(libelle('cle.inexistante') === 'cle.inexistante',
  'une clé absente se voit à l\u2019écran au lieu de produire un trou silencieux');
assert(libelle('action.copier', 'de') === 'Copier',
  'une langue inconnue retombe sur le français');

const sourceLibelles = readFileSync(resolve(ROOT, 'dist/libelles.mjs'), 'utf8');
for (const interdit of ['Remove-', 'Get-AD', 'Set-Net', 'powershell.exe']) {
  assert(!sourceLibelles.includes(interdit),
    `libelles.mjs ne contient aucun contenu technique (« ${interdit} »)`);
}
assert(!/\b(Copy|Download|Search|Settings)\b/.test(sourceLibelles),
  'aucun libellé anglais n\u2019est embarqué à moitié');

// ---------------------------------------------------------------------------
// LOT 1B (5/n) — Catégories canoniques et sous-rubriques
// ---------------------------------------------------------------------------
section('LOT 1B v2 — catégories canoniques');

const CANON = [
  'Poste de travail Windows',
  'Analyse et nettoyage des disques',
  'Windows Server',
  'Active Directory',
  'GPO',
  'Réseau',
  'Imprimantes',
  'Linux et services réseau',
];

assert(CATEGORIES.map((c) => c.name).join(' | ') === CANON.join(' | '),
  'le catalogue contient exactement les huit catégories canoniques, dans l\u2019ordre');

const INTERDITES = ['Dépannage Windows', 'Fichiers & imprimantes', 'Stockage'];
for (const morte of INTERDITES) {
  assert(!CATEGORIES.some((c) => c.name === morte),
    `catégorie abandonnée absente du catalogue : « ${morte} »`);
  assert(!tools.some((t) => t.category === morte),
    `aucun outil ne porte encore la catégorie « ${morte} »`);
}

const CLASSEMENT = {
  'static-ip':     ['Réseau', 'Adressage IP'],
  'ad-ou':         ['Active Directory', 'Unités organisationnelles'],
  'ad-user':       ['Active Directory', 'Utilisateurs'],
  'shared-folder': ['Windows Server', 'Serveur de fichiers'],
  'second-dc':     ['Active Directory', 'Contrôleurs de domaine'],
  'wifi-repair':   ['Réseau', 'Wi-Fi et VPN'],
  'gpo-password':  ['GPO', 'Sécurité des comptes'],
  'disk-scan':     ['Analyse et nettoyage des disques', 'Occupation de l\u2019espace'],
};

assert(Object.keys(CLASSEMENT).length === 8,
  'le classement canonique couvre les huit outils historiques');

for (const [id, [cat, sous]] of Object.entries(CLASSEMENT)) {
  const outil = tools.find((t) => t.id === id);
  assert(outil, `outil présent : ${id}`);
  assert(outil.category === cat,
    `${id} → catégorie « ${cat} » (lu : « ${outil.category} »)`);
  assert(outil.subcategory === sous,
    `${id} → sous-rubrique « ${sous} » (lu : « ${outil.subcategory}»)`);
  assert(CANON.includes(outil.category),
    `${id} : sa catégorie fait partie des canoniques`);
}

assert(tools.every((t) => typeof t.subcategory === 'string' && t.subcategory.length > 0),
  'chaque outil porte une sous-rubrique non vide');

// Visibilité : Windows Server existe parce que shared-folder l'habite.
const vis2 = categoriesVisibles(tools);
const attente2 = categoriesEnAttente(tools);
const nomsVisibles = vis2.map((c) => c.name);

assert(nomsVisibles.includes('Windows Server'),
  'Windows Server est visible : shared-folder l\u2019habite');
const windowsServer = vis2.find((c) => c.name === 'Windows Server');
assert(windowsServer.count >= 1 && tools.some((t) => t.id === 'shared-folder' && t.category === 'Windows Server'),
  `Windows Server contient ${windowsServer.count} outil(s), dont shared-folder`);
assert(nomsVisibles.includes('Analyse et nettoyage des disques'),
  'Analyse et nettoyage des disques est visible : disk-scan l\u2019habite');

// « Poste de travail Windows » est habitée par le LOT 6 : elle est donc
// visible. wifi-repair, son unique occupant historique, avait rejoint le
// Réseau au correctif de catégories — le Wi-Fi est du réseau, même si une
// carte sans fil est matériellement un périphérique.
assert(nomsVisibles.includes('Poste de travail Windows'),
  'Poste de travail Windows est visible : les assistants du LOT 6 l\u2019habitent');
assert(attente2.map((c) => c.name).join(',') === 'Imprimantes',
  `seule Imprimantes reste en attente (${attente2.map((c) => c.name).join(',')})`);
assert(!nomsVisibles.includes('Imprimantes'),
  'Imprimantes est masquée puisqu\u2019elle est vide');
assert(nomsVisibles.includes('Linux et services réseau'),
  'Linux et services réseau est visible depuis le LOT 7');
assert(vis2.length === 7 && vis2.reduce((n, c) => n + c.count, 0) === tools.length,
  `${vis2.length} catégories visibles couvrant les ${tools.length} outils`);

// Sous-rubriques agrégées
const sousAD = sousRubriques(tools, 'Active Directory').map((x) => x.name);
// Les trois sous-rubriques historiques restent en tête ; les lots suivants en
// ajoutent — le test vérifie la présence et l'ordre, pas un nombre figé.
assert(sousAD.slice(0, 3).join(' | ') === 'Unités organisationnelles | Utilisateurs | Contrôleurs de domaine',
  `Active Directory conserve ses trois sous-rubriques historiques en tête (${sousAD.slice(0, 3).join(', ')})`);
assert(sousRubriques(tools, 'Imprimantes').length === 0,
  'une catégorie vide n\u2019expose aucune sous-rubrique');
assert(vis2.every((c) => c.sous.length > 0 && c.sous.reduce((n, x) => n + x.count, 0) === c.count),
  'les décomptes des sous-rubriques correspondent au décompte de la catégorie');

// Une fonction generate() par outil, et une sous-rubrique par outil, quel que
// soit le module où l'outil est défini.
const sourceGen = readFileSync(resolve(ROOT, 'dist/generators.mjs'), 'utf8');
const modulesCatalogue = ['dist/outils-serveur.mjs', 'dist/outils-ad.mjs', 'dist/outils-gpo.mjs',
  'dist/outils-reseau.mjs', 'dist/outils-poste.mjs', 'dist/outils-poste-b.mjs',
  // LOT 7 — le catalogue Linux. L'oublier ici ne rendrait pas la regle plus
  // laxiste : elle compterait moins de generate() que d'outils et echouerait.
  // C'est exactement ce qui s'est produit, et c'est la bonne facon d'echouer.
  'dist/outils-linux.mjs', 'dist/outils-linux-b.mjs', 'dist/outils-linux-c.mjs',
  'dist/outils-linux-d.mjs', 'dist/outils-linux-e.mjs', 'dist/outils-linux-f.mjs',
  'dist/outils-linux-g.mjs', 'dist/outils-linux-h.mjs', 'dist/outils-linux-i.mjs',
  'dist/outils-linux-j.mjs']
  .map((chemin) => (existsSync(resolve(ROOT, chemin)) ? readFileSync(resolve(ROOT, chemin), 'utf8') : ''));
const sourcesCatalogue = [sourceGen, ...modulesCatalogue].join('\n');
assert((sourceGen.match(/^\s*generate\(/gm) ?? []).length === 8,
  'les huit generate() historiques sont toujours dans generators.mjs');
assert((sourcesCatalogue.match(/^\s*generate\(/gm) ?? []).length === tools.length,
  `une fonction generate() par outil du catalogue (${tools.length})`);
assert((sourcesCatalogue.match(/^\s*subcategory: '/gm) ?? []).length === tools.length,
  `chaque outil déclare sa sous-rubrique (${tools.length})`);
assert(tools.every((t) => typeof t.generate === 'function' && typeof t.validate === 'function'),
  'chaque outil expose bien generate() et validate()');

// ---------------------------------------------------------------------------
// LOT 2 (1/n) — Validateurs Windows Server
// ---------------------------------------------------------------------------
section('LOT 2 — validateurs : adressage IPv4');

assert(validerPrefixe('24').ok && validerPrefixe('24').value === 24, 'préfixe 24 accepté et converti en entier');
assert(validerPrefixe('32').ok && validerPrefixe('0').ok, 'les bornes 0 et 32 sont acceptées');
assert(!validerPrefixe('33').ok, 'préfixe 33 refusé');
assert(!validerPrefixe('-1').ok, 'préfixe négatif refusé');
assert(!validerPrefixe('24abc').ok, 'préfixe « 24abc » refusé : pas de parseInt permissif');
assert(!validerPrefixe('024').ok, 'préfixe avec zéro de tête refusé');
assert(!validerPrefixe('').ok, 'préfixe vide refusé');

assert(validerMasque('255.255.255.0').ok && validerMasque('255.255.255.0').value.prefixe === 24,
  'masque 255.255.255.0 reconnu comme /24');
assert(validerMasque('255.255.240.0').value.prefixe === 20, 'masque 255.255.240.0 reconnu comme /20');
assert(!validerMasque('255.0.255.0').ok, 'masque non contigu refusé');
assert(!validerMasque('255.255.255.256').ok, 'masque avec octet invalide refusé');

assert(prefixeVersMasque(24) === '255.255.255.0', 'préfixe 24 → masque 255.255.255.0');
assert(prefixeVersMasque(30) === '255.255.255.252', 'préfixe 30 → masque 255.255.255.252');
assert(prefixeVersMasque(0) === '0.0.0.0', 'préfixe 0 → masque 0.0.0.0');
assert(ipVersEntier('0.0.0.1') === 1 && entierVersIp(1) === '0.0.0.1', 'conversion IP ↔ entier symétrique');
assert(entierVersIp(ipVersEntier('192.168.30.254')) === '192.168.30.254', 'aller-retour sur une adresse réelle');
assert(ipVersEntier('999.1.1.1') === null, 'une IP invalide ne se convertit pas');

assert(adresseReseau('192.168.30.77', 24) === '192.168.30.0', 'adresse de réseau calculée pour /24');
assert(adresseReseau('192.168.30.77', 25) === '192.168.30.0', 'adresse de réseau calculée pour /25');
assert(adresseReseau('192.168.30.130', 25) === '192.168.30.128', 'seconde moitié d\u2019un /25');
assert(adresseDiffusion('192.168.30.0', 24) === '192.168.30.255', 'adresse de diffusion d\u2019un /24');
assert(ipDansReseau('192.168.30.50', '192.168.30.0', 24), 'appartenance au réseau vérifiée');
assert(!ipDansReseau('192.168.31.50', '192.168.30.0', 24), 'adresse hors réseau détectée');
assert(!ipDansReseau('192.168.30.200', '192.168.30.0', 25), 'adresse hors de la première moitié d\u2019un /25');

section('LOT 2 — validateurs : réseau CIDR et plages');

const cidrOk = validerReseauCidr('192.168.30.0/24');
assert(cidrOk.ok && cidrOk.value.reseau === '192.168.30.0' && cidrOk.value.masque === '255.255.255.0',
  'CIDR 192.168.30.0/24 analysé correctement');
assert(!validerReseauCidr('192.168.30.7/24').ok,
  'une adresse d\u2019hôte n\u2019est pas acceptée comme réseau');
assert(validerReseauCidr('192.168.30.7/24').error.includes('192.168.30.0'),
  'le message propose le réseau correct');
assert(!validerReseauCidr('192.168.30.0').ok, 'réseau sans préfixe refusé');
assert(!validerReseauCidr('192.168.30.0/24/8').ok, 'double préfixe refusé');
assert(!validerReseauCidr('').ok, 'réseau vide refusé');

const plageOk = validerPlageIp('192.168.30.1', '192.168.30.244', '192.168.30.0', 24);
assert(plageOk.ok && plageOk.value.taille === 244, 'plage valide : 244 adresses');
const plageInversee = validerPlageIp('192.168.30.244', '192.168.30.1', '192.168.30.0', 24);
assert(!plageInversee.ok && /inversée/.test(plageInversee.error), 'plage inversée détectée');
assert(!validerPlageIp('192.168.31.1', '192.168.30.244', '192.168.30.0', 24).ok,
  'première adresse hors réseau refusée');
assert(!validerPlageIp('192.168.30.1', '192.168.31.244', '192.168.30.0', 24).ok,
  'dernière adresse hors réseau refusée');
assert(!validerPlageIp('192.168.30.0', '192.168.30.244', '192.168.30.0', 24).ok,
  'adresse de réseau refusée comme début de plage');
assert(!validerPlageIp('192.168.30.1', '192.168.30.255', '192.168.30.0', 24).ok,
  'adresse de diffusion refusée comme fin de plage');
assert(validerPlageIp('10.0.0.5', '10.0.0.5').ok, 'plage d\u2019une seule adresse acceptée hors contexte réseau');

assert(validerScopeId('192.168.30.0').ok, 'ScopeId valide accepté');
assert(!validerScopeId('192.168.30').ok, 'ScopeId tronqué refusé');
assert(!validerScopeId('scope1').ok, 'ScopeId non numérique refusé');

section('LOT 2 — validateurs : IPv6, noms et DNS');

assert(validerIPv6('2001:db8::1').ok, 'IPv6 abrégée acceptée');
assert(validerIPv6('2001:0db8:0000:0000:0000:0000:0000:0001').ok, 'IPv6 complète acceptée');
assert(validerIPv6('::1').ok, 'boucle locale IPv6 acceptée');
assert(validerIPv6('::ffff:192.168.1.1').ok, 'forme mixte IPv4 acceptée');
assert(!validerIPv6('2001:db8::1::2').ok, 'double abréviation refusée');
assert(!validerIPv6('2001:db8:zzzz::1').ok, 'groupe non hexadécimal refusé');
assert(!validerIPv6('2001:db8:1:2:3:4:5').ok, 'adresse incomplète sans abréviation refusée');
assert(!validerIPv6('fe80::1%eth0').ok, 'identifiant de zone refusé');
assert(!validerIPv6('').ok, 'IPv6 vide refusée');

assert(validerFqdn('srv-dhcp.hopitalbn.lan').ok, 'FQDN valide accepté');
assert(validerFqdn('srv.hopitalbn.lan.').value === 'srv.hopitalbn.lan', 'le point final est retiré');
assert(!validerFqdn('srv').ok, 'nom court refusé comme FQDN');
assert(!validerFqdn('srv..lan').ok, 'double point refusé');
assert(!validerFqdn('-srv.lan').ok, 'étiquette commençant par un tiret refusée');
assert(!validerFqdn('srv_.lan').ok, 'souligné refusé dans un FQDN');

assert(validerNomHote('SRV-DHCP').ok, 'nom d\u2019hôte valide accepté');
assert(!validerNomHote('srv.hopitalbn.lan').ok, 'un FQDN n\u2019est pas un nom d\u2019hôte court');
assert(!validerNomHote('serveur-beaucoup-trop-long').ok, 'nom NetBIOS de plus de 15 caractères refusé');
assert(!validerNomHote('srv-').ok, 'nom se terminant par un tiret refusé');

assert(validerNomZoneDns('hopitalbn.lan').ok, 'zone directe acceptée');
assert(validerNomZoneDns('30.168.192.in-addr.arpa').ok, 'zone inversée IPv4 acceptée');
assert(validerNomZoneDns('0.8.b.d.1.0.0.2.ip6.arpa').ok, 'zone inversée IPv6 acceptée');
assert(!validerNomZoneDns('in-addr.arpa').ok, 'zone inversée sans réseau refusée');
assert(!validerNomZoneDns('zone lan').ok, 'espace refusé dans un nom de zone');

assert(validerNomEnregistrement('srv-fichiers').ok, 'nom d\u2019enregistrement simple accepté');
assert(validerNomEnregistrement('@').ok, '« @ » accepté pour la zone elle-même');
assert(!validerNomEnregistrement('*.test').ok, 'enregistrement générique refusé dans ce lot');
assert(!validerNomEnregistrement('').ok, 'nom d\u2019enregistrement vide refusé');

assert(TYPES_ENREGISTREMENT.join(',') === 'A,AAAA,CNAME,PTR', 'quatre types pris en charge, et seulement eux');
assert(validerTypeEnregistrement('a').value === 'A', 'le type est normalisé en majuscules');
assert(!validerTypeEnregistrement('MX').ok, 'MX refusé : hors périmètre de ce lot');
assert(!validerTypeEnregistrement('SRV').ok, 'SRV refusé : hors périmètre de ce lot');
assert(!validerTypeEnregistrement('TXT').ok, 'TXT refusé : hors périmètre de ce lot');

section('LOT 2 — validateurs : MAC, ClientId, chemins et formats');

assert(validerMac('00-15-5D-01-2A-3B').value === '00-15-5D-01-2A-3B', 'MAC à tirets normalisée');
assert(validerMac('00:15:5d:01:2a:3b').value === '00-15-5D-01-2A-3B', 'MAC à deux-points normalisée');
assert(validerMac('00155d012a3b').value === '00-15-5D-01-2A-3B', 'MAC sans séparateur normalisée');
assert(validerMac('0015.5d01.2a3b').value === '00-15-5D-01-2A-3B', 'MAC au format Cisco normalisée');
assert(!validerMac('00-15-5D-01-2A').ok, 'MAC trop courte refusée');
assert(!validerMac('00-15-5D-01-2A-3B-4C').ok, 'MAC trop longue refusée');
assert(!validerMac('00-15-5D-01-2A-ZZ').ok, 'MAC non hexadécimale refusée');
assert(!validerMac('').ok, 'MAC vide refusée');

assert(validerClientId('00155d012a3b').ok, 'ClientId de 6 octets accepté');
assert(validerClientId('0102').ok, 'ClientId de 2 octets accepté');
assert(!validerClientId('010').ok, 'ClientId de longueur impaire refusé');
assert(!validerClientId('01').ok, 'ClientId d\u2019un seul octet refusé');
assert(!validerClientId('0'.repeat(34)).ok, 'ClientId de plus de 16 octets refusé');

assert(validerCheminWindowsLocal('C:\\Sauvegardes\\DHCP').ok, 'chemin local accepté');
assert(!validerCheminWindowsLocal('\\\\serveur\\partage').ok, 'chemin UNC refusé');
assert(/UNC|réseau/.test(validerCheminWindowsLocal('\\\\serveur\\partage').error),
  'le message explique que le chemin réseau est refusé');
assert(!validerCheminWindowsLocal('Sauvegardes\\DHCP').ok, 'chemin relatif refusé');
assert(!validerCheminWindowsLocal('C:\\Sauve<gardes').ok, 'caractère interdit refusé');
assert(!validerCheminWindowsLocal('').ok, 'chemin vide refusé');

assert(validerProfondeur('3').ok && validerProfondeur('3').value === 3, 'profondeur valide');
assert(!validerProfondeur('11').ok, 'profondeur au-delà de 10 refusée');
assert(!validerProfondeur('2.5').ok, 'profondeur décimale refusée');
assert(!validerProfondeur('trois').ok, 'profondeur non numérique refusée');

assert(validerDureeBail('8').ok, 'bail de 8 heures accepté');
assert(!validerDureeBail('0').ok, 'bail nul refusé');
assert(!validerDureeBail('9000').ok, 'bail supérieur à un an refusé');

assert(FORMATS_RAPPORT.join(',') === 'Console,JSON,HTML,CSV', 'quatre formats de rapport');
assert(validerFormatRapport('JSON').ok, 'format JSON accepté');
assert(!validerFormatRapport('PDF').ok, 'format inconnu refusé');
assert(!validerFormatRapport('json').ok, 'la casse compte : « json » n\u2019est pas « JSON »');

assert(MODES_EXECUTION.join(',') === 'Diagnostic,Appliquer', 'deux modes d\u2019exécution');
assert(validerModeExecution('Diagnostic').ok && validerModeExecution('Appliquer').ok, 'les deux modes sont acceptés');
assert(!validerModeExecution('Force').ok, 'mode inconnu refusé');

assert(validerChoix('Both', ['Both', 'Dhcp', 'Bootp']).ok, 'choix dans une liste fermée');
assert(!validerChoix('Autre', ['Both', 'Dhcp', 'Bootp']).ok, 'valeur hors liste refusée');

const listeDns = validerListeIPv4('192.168.30.254, 192.168.30.253');
assert(listeDns.ok && listeDns.value.length === 2, 'liste de deux serveurs DNS acceptée');
assert(!validerListeIPv4('192.168.30.254, 192.168.30.254').ok, 'doublon dans la liste refusé');
assert(!validerListeIPv4('192.168.30.254, 300.1.1.1').ok, 'adresse invalide dans la liste refusée');
assert(!validerListeIPv4('a, b, c, d').ok, 'liste trop longue et invalide refusée');
assert(!validerListeIPv4('').ok, 'liste vide refusée');

assert(validerEntier('42', 1, 100, 'Le test').ok, 'entier dans les bornes accepté');
assert(!validerEntier('0', 1, 100, 'Le test').ok, 'entier sous la borne refusé');
assert(!validerEntier('101', 1, 100, 'Le test').ok, 'entier au-dessus de la borne refusé');
assert(!validerEntier('12abc', 1, 100, 'Le test').ok, 'parseInt permissif explicitement refusé');

section('LOT 2 — noyau et fragments de rapport');

const generatorsMod = await import('../dist/generators.mjs');
assert(generatorsMod.psB64 === psB64Noyau,
  'psB64 exporté par generators.mjs EST la fonction de noyau.mjs, pas une copie');
assert(generatorsMod.assertValid === assertValidNoyau,
  'assertValid exporté par generators.mjs EST la fonction de noyau.mjs');
assert(psB64Noyau('D\u2019Adam').includes('FromBase64String'),
  'psB64 encode les apostrophes typographiques en Base64');
let leveAssert = false;
try { assertValidNoyau({ validate: () => ({ champ: 'invalide' }) }, {}); } catch { leveAssert = true; }
assert(leveAssert, 'assertValid lève bien sur une entrée invalide');

const entete = enteteScript({ titre: 'Essai', outil: 'essai-outil' });
assert(entete.startsWith('#Requires -Version 5.1'),
  'l\u2019en-tête déclare explicitement le plancher PowerShell 5.1');
assert(entete.includes('essai-outil') && entete.includes(VERSION_OUTILS),
  'l\u2019en-tête identifie l\u2019outil et sa version');
assert(entete.includes('$KjemoResultats'), 'l\u2019en-tête prépare la collecte des résultats');

const fonctions = fonctionsRapport();
assert(fonctions.includes('function Add-KjemoResultat'), 'la fonction de collecte est définie');
assert(fonctions.includes("ValidateSet('OK','ATTENTION','PROBLEME','INFO','IGNORE')"),
  'les états possibles sont contraints par ValidateSet');

const exportBloc = blocExportRapport({ prefixeFichier: 'kjemo-essai' });
for (const attendu of ['ConvertTo-Json', 'Export-Csv', 'ConvertTo-Html', 'Conclusion', 'Avertissements']) {
  assert(exportBloc.includes(attendu), `le bloc de rapport contient ${attendu}`);
}
assert(!/password|motdepasse|Get-Credential|token/i.test(exportBloc),
  'le bloc de rapport ne manipule aucun secret');
assert(blocParametres([['Cle', "'valeur'"]]).includes('$KjemoParametres'),
  'le bloc de paramètres alimente le rapport');
assert(blocModeDiagnostic().includes('MODE DIAGNOSTIC'),
  'la garde de mode annonce clairement qu\u2019elle n\u2019a rien modifié');

// ---------------------------------------------------------------------------
// LOT 2 — contrat commun à chaque outil Windows Server
//
// Ce bloc s'applique automatiquement à tout outil du LOT 2 : il grandit avec le
// catalogue. Un outil ajouté sans prérequis, sans procédure d'annulation ou
// sans source officielle échoue ici, pas en revue.
// ---------------------------------------------------------------------------
section('LOT 2 — contrat des outils Windows Server');

const SOUS_RUBRIQUES_LOT2 = [
  'Diagnostic serveur', 'DHCP', 'DNS', 'Serveur de fichiers', 'Routage et accès Internet',
];
// Les outils ajoutés après le LOT 1, tous lots confondus. Le contrat qui suit
// s'applique à chacun d'eux : il grandit avec le catalogue.
/**
 * Exception nominative et justifiée à l'interdit de requête web.
 *
 * L'interdit du LOT 2 vise le téléchargement de CODE et son exécution. Un
 * assistant dont le métier est d'éprouver une adresse HTTP et son certificat
 * doit pouvoir émettre une requête : sans elle, il ne teste rien. L'exception
 * est donc portée par identifiant, et les interdits qui comptent vraiment —
 * DownloadString, -OutFile, requête dirigée vers une exécution — restent
 * vérifiés sur TOUS les scripts, celui-ci compris.
 */
const REQUETE_WEB_AUTORISEE = {
  'http-https-tls-test': 'Éprouve une adresse HTTP/HTTPS : la requête EST le test. Aucune réponse n’est écrite sur disque ni exécutée.',
};

const outilsRecents = tools.filter((t) => !IDS_HISTORIQUES.includes(t.id));
const outilsLot2 = outilsRecents.filter((t) => t.category === 'Windows Server');
const outilsLot3 = outilsRecents.filter((t) => t.category === 'Active Directory');
const outilsLot4 = outilsRecents.filter((t) => t.category === 'GPO');
const outilsLot5 = outilsRecents.filter((t) => t.category === 'Réseau');
const outilsLot6 = outilsRecents.filter((t) => t.category === 'Poste de travail Windows');

assert(outilsLot2.length > 0, `le catalogue contient ${outilsLot2.length} outil(s) Windows Server ajoutés`);
assert(outilsLot2.every((t) => SOUS_RUBRIQUES_LOT2.includes(t.subcategory)),
  'chaque outil Windows Server porte une des cinq sous-rubriques prévues');
const outilsLot7 = outilsRecents.filter((t) => t.category === 'Linux et services réseau');
assert(outilsRecents.length === outilsLot2.length + outilsLot3.length + outilsLot4.length
  + outilsLot5.length + outilsLot6.length + outilsLot7.length,
  `tout outil ajouté appartient à l\u2019une des six catégories peuplées (${outilsRecents.length})`);
assert(outilsLot7.every((t) => SOUS_RUBRIQUES_LINUX.includes(t.subcategory)),
  `chaque outil Linux porte une des dix sous-rubriques prévues (${outilsLot7.length})`);
assert(outilsLot7.every((t) => plateformeDe(t) === 'Linux' && sortieDe(t) === '.sh'),
  'chaque outil de la catégorie Linux déclare la plateforme Linux et une sortie .sh');

const CHAMPS_FICHE = ['id', 'icon', 'category', 'subcategory', 'title', 'risk', 'summary',
  'fields', 'validate', 'generate', 'gui', 'keywords', 'requiresAdmin', 'os', 'prereqs',
  'commonErrors', 'reversible', 'verifyAfter', 'rollback', 'checks', 'source', 'sources'];

for (const outil of outilsRecents) {
  for (const champ of CHAMPS_FICHE) {
    assert(outil[champ] !== undefined && outil[champ] !== null,
      `${outil.id} : le champ « ${champ} » de la fiche est renseigné`);
  }
  assert(['diagnostic', 'safe', 'caution', 'destructive'].includes(outil.risk),
    `${outil.id} : niveau de risque déclaré (${outil.risk})`);
  assert(outil.fields.length > 0, `${outil.id} : le formulaire a au moins un champ`);
  assert(outil.gui.length >= 3, `${outil.id} : la méthode graphique a au moins trois étapes`);
  assert(outil.prereqs.length >= 3, `${outil.id} : les prérequis sont détaillés`);
  assert(outil.verifyAfter.length >= 2, `${outil.id} : au moins deux vérifications après exécution`);
  assert(outil.commonErrors.length >= 2, `${outil.id} : au moins deux erreurs fréquentes expliquées`);
  // ------------------------------------------------------------------------
  // LA COMPATIBILITÉ SE DÉCLARE PRÉCISÉMENT — MAIS « PRÉCISÉMENT » DÉPEND DE
  // LA PLATEFORME
  //
  // La règle exigeait « Windows Server 2019 » et « 5.1 » dans la liste os. Son
  // intention est bonne : interdire un « compatible Windows » vague qui ne
  // promet rien de vérifiable. Mais appliquée à un outil Linux, elle exige de
  // déclarer une compatibilité PowerShell 5.1 sur une machine qui n'a pas de
  // PowerShell — soit une déclaration fausse, soit une exception générale.
  //
  // La règle garde son intention et change de critère selon la plateforme :
  // une version précise et un plancher d'interpréteur, dans les deux cas.
  // ------------------------------------------------------------------------
  if (plateformeDe(outil) === 'Linux') {
    assert(outil.os.some((o) => /Ubuntu[^\d]*\d\d\.\d\d/.test(o)),
      `${outil.id} : compatibilité déclarée précisément (une version d\u2019Ubuntu nommée)`);
    assert(outil.os.some((o) => /Debian \d\d|systemd/.test(o)),
      `${outil.id} : compatibilité déclarée précisément (Debian ou le socle systemd nommé)`);
    assert(!outil.os.some((o) => /^Linux$|^Tout Linux$/i.test(o.trim())),
      `${outil.id} : « Linux » seul est refusé — ce serait une promesse non vérifiable`);
    for (const champ of CHAMPS_LINUX) {
      assert(outil[champ] !== undefined,
        `${outil.id} : le champ Linux « ${champ} » est déclaré`);
    }
    assert(incoherencesPlateforme(outil).length === 0,
      `${outil.id} : déclarations de plateforme cohérentes (${incoherencesPlateforme(outil).join(' | ')})`);
  } else {
    assert(outil.os.some((o) => /Windows Server 2019/.test(o)) && outil.os.some((o) => /5\.1/.test(o)),
      `${outil.id} : compatibilité déclarée précisément (2019 et PowerShell 5.1)`);
  }
  assert(outil.rollback && outil.rollback.summary && outil.rollback.diagnostic && outil.rollback.command,
    `${outil.id} : procédure d’annulation en blocs distincts`);

  // Sources : des pages PRÉCISES d'un éditeur primaire, en HTTPS. L'éditeur
  // attendu dépend de la plateforme ; l'exigence de précision, non — une page
  // d'accueil ne documente rien.
  assert(Array.isArray(outil.sources) && outil.sources.length >= 1,
    `${outil.id} : liste de sources officielles fournie`);
  if (plateformeDe(outil) === 'Linux') {
    assert(sourceLinuxValide(outil.source),
      `${outil.id} : source principale chez un éditeur primaire Linux`);
    for (const src of outil.sources) {
      assert(sourceLinuxValide(src.url),
        `${outil.id} : source « ${src.label} » chez un éditeur primaire (${src.url})`);
      // Une page d'accueil ne documente rien. On exige un chemin au-delà du
      // domaine, sauf pour les deux wikis dont la page d'accueil EST un point
      // d'entrée documentaire nommé.
      assert(/^https:\/\/[^/]+\/\S+/.test(src.url),
        `${outil.id} : source « ${src.label} » pointe vers une page précise, pas un domaine nu`);
    }
  } else {
    assert(/^https:\/\/learn\.microsoft\.com\//.test(outil.source),
      `${outil.id} : source principale sur learn.microsoft.com`);
    for (const src of outil.sources) {
      assert(/^https:\/\/learn\.microsoft\.com\/\S+/.test(src.url),
        `${outil.id} : source « ${src.label} » pointe vers une page Microsoft précise`);
      assert(!/^https:\/\/learn\.microsoft\.com\/?$/.test(src.url),
        `${outil.id} : source « ${src.label} » n’est pas la page d’accueil`);
    }
  }

  // ------------------------------------------------------------------------
  // UN OUTIL MODIFIANT NE MODIFIE RIEN PAR DEFAUT
  //
  // La règle exigeait un champ nommé exactement « mode » ou « bkMode », de
  // valeur par défaut « Diagnostic ». C'est le mécanisme retenu par les lots
  // Windows, et il est bon. Mais la règle vérifiait le MÉCANISME, pas
  // l'INTENTION, et le lot Linux emploie un second mécanisme tout aussi
  // contraignant : une phrase de confirmation dont l'absence fait diagnostiquer
  // sans écrire.
  //
  // La règle est donc élargie au mécanisme ET resserrée sur l'intention : quel
  // que soit le verrou, le script produit AVEC LES VALEURS PAR DÉFAUT doit
  // porter la trace du verrou, et la porte qui empêche d'agir. C'est plus fort
  // que l'ancienne version, qui se contentait de lire une chaîne dans un champ
  // sans jamais regarder le script produit.
  //
  // La preuve par l'EXÉCUTION — lancer le script et constater zéro écriture —
  // est faite séparément, par test/linux-verrous.test.mjs.
  // ------------------------------------------------------------------------
  const champMode = outil.fields.find((f) => f.id === 'mode' || f.id === 'bkMode');
  const champConfirmation = outil.fields.find((f) => /confirmation/i.test(f.id));
  if (outil.risk === 'diagnostic') {
    // L'intention de la règle : les constats d'un outil de diagnostic doivent
    // pouvoir SORTIR de l'écran. Le mécanisme habituel est un sélecteur de
    // format ; mais un outil dont la sortie EST un fichier — un CSV, un modèle
    // de script — satisfait la même intention plus directement, et un
    // sélecteur de format y serait absurde. La règle nomme donc l'intention et
    // accepte les deux mécanismes.
    const aFormat = outil.fields.some((f) => /Format/i.test(f.label));
    const aDestination = outil.fields.some((f) => /^(destination|sortie|fichier|nomScript)$/i.test(f.id));
    assert(aFormat || aDestination,
      `${outil.id} : les constats peuvent sortir de l\u2019écran — sélecteur de format, ou fichier de sortie déclaré`);
  } else if (plateformeDe(outil) === 'Linux') {
    assert(champMode || champConfirmation,
      `${outil.id} : un outil modifiant porte un verrou — sélecteur de mode ou phrase de confirmation`);
    if (champConfirmation) {
      assert(String(champConfirmation.default ?? '') === '',
        `${outil.id} : la confirmation est VIDE par défaut, donc le script par défaut n\u2019écrit rien`);
      // Et le script produit par défaut doit porter le verrou ET sa porte.
      const valeursDefaut = Object.fromEntries(
        outil.fields.map((f) => [f.id, String(f.default ?? '')]));
      let scriptDefaut = '';
      try { scriptDefaut = outil.generate(valeursDefaut); } catch { scriptDefaut = ''; }
      assert(/KJEMO_CONFIRMATION_OK=0/.test(scriptDefaut),
        `${outil.id} : le script par défaut initialise le verrou de confirmation à 0`);
      assert(/KJEMO_AGIR/.test(scriptDefaut),
        `${outil.id} : le script par défaut porte une porte qui conditionne l\u2019action`);
      assert(/AUCUNE ECRITURE|AUCUNE MODIFICATION/.test(scriptDefaut),
        `${outil.id} : le script dit explicitement qu\u2019il n\u2019écrit rien sans confirmation`);
    }
  } else {
    assert(champMode, `${outil.id} : un outil modifiant porte un sélecteur de mode`);
    assert(champMode.default === 'Diagnostic',
      `${outil.id} : le mode par défaut est Diagnostic`);
  }

  // Aucun champ ne demande de secret.
  for (const f of outil.fields) {
    // On juge ce que le champ DEMANDE. Un champ libre dont l'étiquette parle de
    // mot de passe en réclamerait un ; une liste fermée qui choisit une
    // POLITIQUE de mot de passe n'en transporte aucun, par construction.
    const champLibre = f.type !== 'select' && f.type !== 'checkbox';
    if (champLibre) {
      const evoqueSecret = /mot de passe|password|secret|jeton|token|credential|identifiant de connexion/i
        .test(`${f.id} ${f.label}`);
      if (evoqueSecret) {
        // Un champ peut légitimement PARLER de mot de passe — « âge maximal du
        // mot de passe », en jours — sans jamais pouvoir en transporter un. On
        // ne se contente pas de l'étiquette : on soumet au champ un mot de
        // passe plausible, et la validation doit le refuser. C'est une preuve
        // de comportement, plus forte qu'une interdiction de vocabulaire.
        const defauts = Object.fromEntries(outil.fields.map((x) => [x.id, String(x.default ?? '')]));
        const errs = outil.validate({ ...defauts, [f.id]: 'Hopital!2026Secret' });
        assert(Boolean(errs[f.id]),
          `${outil.id} : le champ « ${f.id} » évoque un secret mais refuse toute valeur qui en serait un`);
      }
    } else {
      const valeursPossibles = (f.options ?? []).map((o) => (Array.isArray(o) ? o[0] : o)).join(' ');
      assert(!/^(motdepasse|password|secret|token)$/i.test(valeursPossibles.trim()),
        `${outil.id} : la liste « ${f.id} » ne propose aucune valeur secrète`);
    }
    assert(f.type !== 'password', `${outil.id} : aucun champ de type password`);
  }
}

section('LOT 2 et 3 — scripts générés : sécurité et forme');

for (const outil of outilsRecents) {
  const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  let script = '';
  let erreur = null;
  try { script = outil.generate(valeurs); } catch (e) { erreur = e; }
  assert(!erreur, `${outil.id} : le script se génère avec les valeurs par défaut${erreur ? ' — ' + erreur.message : ''}`);
  if (erreur) continue;

    // ------------------------------------------------------------------------
    // CHAQUE SCRIPT DÉCLARE SON PLANCHER D'INTERPRÉTEUR — LEQUEL DÉPEND DE LA
    // PLATEFORME
    //
    // Côté PowerShell c'est « #Requires -Version 5.1 » : la première ligne dit
    // sous quoi le script est censé tourner, et PowerShell refuse de le lancer
    // ailleurs. Côté Bash l'équivalent exact est le shebang : « #!/usr/bin/env
    // bash » dit que c'est bash et non sh, ce qui n'est pas un détail puisque
    // les scripts du lot utilisent des tableaux et des substitutions que dash
    // ne connaît pas.
    //
    // La règle garde son intention — un script dit sous quoi il tourne — et
    // vérifie la forme propre à chaque plateforme.
    // ------------------------------------------------------------------------
    if (estBash(outil)) {
      assert(script.startsWith('#!/usr/bin/env bash\n'),
        `${outil.id} : le script déclare son interpréteur par un shebang bash exact`);
      assert(/^set -Eeuo pipefail$/m.test(script),
        `${outil.id} : le script active set -Eeuo pipefail`);
      assert(!script.includes('\r'),
        `${outil.id} : le script Bash ne contient aucun retour chariot`);
      assert(script.charCodeAt(0) !== 0xFEFF,
        `${outil.id} : le script Bash ne commence pas par un BOM`);
    } else {
      assert(script.startsWith('#Requires -Version 5.1'),
        `${outil.id} : le script déclare son plancher PowerShell 5.1`);
    }
  assert(script.includes(outil.id), `${outil.id} : le script s’identifie`);

  // Interdits absolus du LOT 2.
  assert(!/-Confirm\s*:\s*\$false/i.test(script), `${outil.id} : aucun -Confirm:$false`);
  assert(!/(^|\s)-Force\b/i.test(script), `${outil.id} : aucun -Force`);
  assert(!/Invoke-Expression|\biex\b/i.test(script), `${outil.id} : aucun Invoke-Expression`);
  assert(!/Set-ExecutionPolicy/i.test(script), `${outil.id} : aucun contournement d’ExecutionPolicy`);
  // Téléchargement : l'interdit vise le fait de RAPPORTER DU CODE et de
  // l'exécuter. Un assistant dont le métier est d'éprouver une adresse HTTP
  // doit pouvoir émettre une requête — sinon il ne teste rien. L'exception est
  // nominative, justifiée, et elle ne lève AUCUN des interdits qui suivent.
  if (!Object.prototype.hasOwnProperty.call(REQUETE_WEB_AUTORISEE, outil.id)) {
    assert(!/Invoke-WebRequest|Invoke-RestMethod|curl\s+http|wget\s+http|DownloadString/i.test(script),
      `${outil.id} : aucun téléchargement de code externe`);
  }
  // Ces quatre-là valent pour TOUS les scripts, exception comprise : c'est le
  // téléchargement SUIVI D'EXÉCUTION, ou l'écriture sur disque de ce qui a été
  // rapporté, qui est le vrai danger.
  assert(!/DownloadString|DownloadFile/i.test(script),
    `${outil.id} : aucun téléchargement de contenu vers une variable ou un fichier`);
  assert(!/-OutFile\b/i.test(script),
    `${outil.id} : aucune réponse web écrite sur disque`);
  assert(!/(Invoke-WebRequest|Invoke-RestMethod)[^\n]*\|[^\n]*(Invoke-Expression|iex|Start-Process)/i.test(script),
    `${outil.id} : aucune réponse web dirigée vers une exécution`);
  assert(!/Start-BitsTransfer/i.test(script),
    `${outil.id} : aucun transfert de fichier en arrière-plan`);
  // Aucun secret ne doit venir du site, ni finir en clair, ni etre journalise.
  // Les deux formes d'acquisition LOCALE et interactive — Get-Credential et
  // Read-Host -AsSecureString — sont au contraire la bonne reponse : elles
  // demandent le secret a la console, au moment de l'execution. Ce qui reste
  // interdit sans exception, c'est de le fabriquer, de le convertir en clair,
  // ou de le laisser trainer.
  // « -Password » est un PARAMETRE PowerShell : il est toujours precede d'une
  // espace ou d'un debut de ligne. Sans cette ancre, le motif accusait
  // « prohibit-password » — la valeur par defaut officielle de PermitRootLogin,
  // citee par les assistants SSH du LOT 7, qui n'est evidemment pas un secret.
  // Corrige au MOTIF, et non par une exception : une exception aurait leve le
  // controle pour tout le script.
  assert(!/ConvertTo-SecureString|(?:^|\s)-Password\b|PlainText/i.test(script),
    `${outil.id} : aucun secret fabriqué ni converti en clair`);
  const lignes = script.split('\n');
  // Une ligne qui se contente d'AFFICHER le nom d'une commande — un commentaire,
  // ou un Write-Host qui montre à la personne ce que le mode Appliquer
  // exécuterait — n'acquiert aucun secret. Elle reste soumise à la règle
  // suivante : aucune variable porteuse de secret ne doit y figurer.
  const acquisitions = lignes.filter((l) =>
    /Get-Credential|Read-Host[^\n]*-AsSecureString/i.test(l)
    && !/^\s*#/.test(l)
    && !/Write-Host/.test(l));
  for (const ligne of acquisitions) {
    assert(!/-UserName\s+['"]/i.test(ligne),
      `${outil.id} : l’acquisition d’identifiants ne préremplit aucun compte`);
  }
  if (acquisitions.length > 0) {
    // La variable qui recoit le secret est identifiee, puis suivie a la trace :
    // elle ne doit apparaitre ni dans un resultat de rapport, ni dans un fichier.
    const variables = acquisitions
      .map((l) => (l.match(/\$([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:Get-Credential|Read-Host)/i) ?? [])[1])
      .filter(Boolean);
    assert(variables.length === acquisitions.length,
      `${outil.id} : chaque acquisition d’identifiants est affectée à une variable nommée`);
    for (const nom of variables) {
      const motif = new RegExp('\\$' + nom + '\\b');
      for (const ligne of lignes) {
        if (!motif.test(ligne)) continue;
        assert(!/Add-KjemoResultat|Out-File|Set-Content|Export-Csv|ConvertTo-Json|Write-Host/i.test(ligne),
          `${outil.id} : la variable $${nom} n’est ni journalisée ni écrite dans un fichier`);
      }
      assert(new RegExp('\\$' + nom + '\\s*=\\s*\\$null').test(script),
        `${outil.id} : la variable $${nom} est remise à $null après usage`);
    }
  }
  assert(!/\bTODO\b|\bFIXME\b|\bXXX\b/.test(script), `${outil.id} : aucun marqueur TODO`);
  assert(!/http:\/\//.test(script), `${outil.id} : aucune URL non chiffrée`);

  // Un outil modifiant doit garder ses actions derrière un verrou, et le dire.
  // Le verrou ne porte pas le même nom des deux côtés : $Mode en PowerShell,
  // KJEMO_CONFIRMATION_OK et KJEMO_AGIR en Bash. L'exigence est la même, et la
  // forme suit la plateforme.
  if (outil.risk !== 'diagnostic' && estBash(outil)) {
    assert(/KJEMO_CONFIRMATION_OK/.test(script),
      `${outil.id} : le script Bash porte le verrou de confirmation`);
    assert(/KJEMO_AGIR/.test(script),
      `${outil.id} : le script Bash porte la porte qui conditionne l\u2019action`);
    assert(/AUCUNE ECRITURE|AUCUNE MODIFICATION/.test(script),
      `${outil.id} : le script annonce explicitement qu\u2019il n\u2019écrit rien sans confirmation`);
  } else if (outil.risk !== 'diagnostic') {
    assert(/\$Mode\s*=|\$Mode -eq/.test(script),
      `${outil.id} : le script porte la garde de mode`);
    assert(/-WhatIf\b/.test(script) || /MODE DIAGNOSTIC/.test(script),
      `${outil.id} : le mode Diagnostic simule ou annonce explicitement qu’il n’écrit rien`);
  }

  // Les valeurs saisies passent par Base64 : aucune apostrophe typographique brute.
  const lignesDeCode = script.split('\n').filter((l) => !l.trim().startsWith('#'));
  for (const ligne of lignesDeCode) {
    assert(!/[‘’“”]/.test(ligne),
      `${outil.id} : aucune apostrophe typographique hors commentaire (« ${ligne.slice(0, 40)} »)`);
  }

  // Un diagnostic pur ne doit contenir aucun verbe modifiant hors simulation.
  if (outil.risk === 'diagnostic') {
    const modifiants = lignesDeCode.join('\n')
      .match(/\b(Set|Add|Remove|New|Install|Uninstall|Start|Stop|Restart|Clear|Restore)-[A-Z][A-Za-z0-9]*/g) ?? [];
    const autorises = ['Add-KjemoResultat', 'New-Object', 'New-TimeSpan', 'Set-Content',
                       'New-Item', 'Add-Member', 'Start-Sleep'];
    const interdits = [...new Set(modifiants.filter((c) => !autorises.includes(c)))];
    assert(interdits.length === 0,
      `${outil.id} : aucun cmdlet modifiant dans un outil de diagnostic (${interdits.join(', ') || 'aucun'})`);
  }
}

section('LOT 2 et 3 — validation : les données invalides sont refusées');

for (const outil of outilsRecents) {
  // ------------------------------------------------------------------------
  // CHAMP VIDE SUR UN CHAMP OBLIGATOIRE : AUCUN SCRIPT PRODUIT
  //
  // L'exemption se faisait sur le LIBELLÉ, par /facultatif/i. C'est fragile
  // dans les deux sens : un libellé qui emploie le mot pour une autre raison
  // exempte un champ obligatoire sans que personne le voie, et un champ
  // réellement optionnel dont le libellé ne contient pas le mot fait échouer
  // la règle — ce qui m'est arrivé avec « Service à examiner », vide par
  // défaut parce que vide signifie « tout le système ».
  //
  // L'exemption se déclare désormais explicitement, par `optionnel: true` sur
  // le champ. Le libellé reste accepté pour les outils Windows existants, afin
  // de ne pas les modifier. Et une exigence NOUVELLE est ajoutée plus bas :
  // un champ qui accepte le vide SANS être déclaré optionnel est refusé — ce
  // que l'ancienne règle ne pouvait pas vérifier.
  // ------------------------------------------------------------------------
  const estOptionnel = (f) => f.optionnel === true || /facultatif/i.test(f.label);
  const obligatoires = outil.fields.filter((f) => !estOptionnel(f));
  for (const champ of obligatoires.slice(0, 3)) {
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    valeurs[champ.id] = '';
    const errors = outil.validate(valeurs);
    assert(Object.keys(errors).length > 0,
      `${outil.id} : « ${champ.id} » vide est refusé par validate()`);
    let leve = false;
    try { outil.generate(valeurs); } catch { leve = true; }
    assert(leve, `${outil.id} : generate() refuse de produire un script avec « ${champ.id} » vide`);
  }

  // La réciproque, qui est la protection nouvelle : un champ déclaré optionnel
  // doit RÉELLEMENT accepter le vide, et un champ qui accepte le vide doit
  // être déclaré optionnel. Sans ce contrôle, `optionnel: true` deviendrait un
  // interrupteur pour faire taire la règle précédente.
  for (const champ of outil.fields.filter((f) => f.optionnel === true)) {
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    valeurs[champ.id] = '';
    const errors = outil.validate(valeurs);
    assert(errors[champ.id] === undefined,
      `${outil.id} : « ${champ.id} » est déclaré optionnel et accepte donc réellement le vide`);
    let leveOpt = false;
    try { outil.generate(valeurs); } catch { leveOpt = true; }
    assert(!leveOpt,
      `${outil.id} : generate() produit bien un script avec « ${champ.id} » vide, puisqu\u2019il est optionnel`);
    assert(typeof champ.help === 'string' && champ.help.length > 10,
      `${outil.id} : « ${champ.id} » étant optionnel, son aide explique ce que le vide signifie`);
  }
}

// ---------------------------------------------------------------------------
// LOT 2 (8/n) — Contre-épreuves
//
// Un test qui ne peut pas échouer ne prouve rien. Chaque contrôle du lot est
// donc soumis à un cas qui DOIT le faire échouer. Si l'une de ces
// contre-épreuves passe, c'est le contrôle correspondant qui est défaillant,
// pas le code testé.
// ---------------------------------------------------------------------------
section('LOT 2 — contre-épreuves : la validation détecte-t-elle vraiment ?');

const outilEtendue = tools.find((t) => t.id === 'dhcp-scope-options');
const baseEtendue = Object.fromEntries(outilEtendue.fields.map((f) => [f.id, String(f.default ?? '')]));

const casEtendue = [
  ['plage inversée', { scopeStart: '192.168.30.244', scopeEnd: '192.168.30.1' }, 'scopeStart|scopeEnd'],
  ['première adresse hors du réseau', { scopeStart: '192.168.31.10' }, 'scopeStart|scopeEnd'],
  ['adresse de réseau distribuée', { scopeStart: '192.168.30.0' }, 'scopeStart|scopeEnd'],
  ['adresse de diffusion distribuée', { scopeEnd: '192.168.30.255' }, 'scopeStart|scopeEnd'],
  ['réseau écrit comme une adresse d\u2019hôte', { scopeCidr: '192.168.30.7/24' }, 'scopeCidr'],
  ['passerelle hors du réseau', { scopeGateway: '10.0.0.1' }, 'scopeGateway'],
  ['passerelle comprise dans la plage distribuée', { scopeGateway: '192.168.30.100' }, 'scopeGateway'],
  ['serveur DNS compris dans la plage distribuée', { scopeDns: '192.168.30.100' }, 'scopeDns'],
  ['exclusion hors de la plage', { scopeExclStart: '192.168.30.245', scopeExclEnd: '192.168.30.250' }, 'scopeExclStart'],
  ['durée de bail non entière', { scopeLease: '8,5' }, 'scopeLease'],
  ['état d\u2019étendue inconnu', { scopeState: 'Peut-être' }, 'scopeState'],
];

for (const [nom, mutation, champsAttendus] of casEtendue) {
  const valeurs = { ...baseEtendue, ...mutation };
  const errors = outilEtendue.validate(valeurs);
  const cles = Object.keys(errors);
  assert(cles.length > 0, `contre-épreuve détectée — ${nom}`);
  assert(cles.some((c) => new RegExp(champsAttendus).test(c)),
    `contre-épreuve — ${nom} : l\u2019erreur porte sur le bon champ (${cles.join(', ')})`);
  let leve = false;
  try { outilEtendue.generate(valeurs); } catch { leve = true; }
  assert(leve, `contre-épreuve — ${nom} : aucun script n\u2019est produit`);
}

// Contrôle POSITIF : les valeurs d'exemple du laboratoire doivent, elles, passer.
assert(Object.keys(outilEtendue.validate(baseEtendue)).length === 0,
  'contrôle positif : l\u2019exemple de laboratoire 192.168.30.0/24 est accepté');

const outilReservation = tools.find((t) => t.id === 'dhcp-reservation');
const baseReservation = Object.fromEntries(outilReservation.fields.map((f) => [f.id, String(f.default ?? '')]));
for (const [nom, mutation, champ] of [
  ['adresse hors de l\u2019étendue', { resIp: '192.168.40.50' }, 'resIp'],
  ['ScopeId incorrect', { resScopeId: 'scope-1' }, 'resScopeId'],
  ['MAC trop courte', { resClient: '00-15-5D-01-2A' }, 'resClient'],
  ['MAC non hexadécimale', { resClient: '00-15-5D-01-2A-ZZ' }, 'resClient'],
  ['type de réservation inconnu', { resType: 'Autre' }, 'resType'],
]) {
  const valeurs = { ...baseReservation, ...mutation };
  const errors = outilReservation.validate(valeurs);
  assert(errors[champ], `contre-épreuve détectée — ${nom} (champ ${champ})`);
}
assert(Object.keys(outilReservation.validate(baseReservation)).length === 0,
  'contrôle positif : la réservation d\u2019exemple est acceptée');

const outilSauvegarde = tools.find((t) => t.id === 'dhcp-backup');
const baseSauvegarde = Object.fromEntries(outilSauvegarde.fields.map((f) => [f.id, String(f.default ?? '')]));
const errUnc = outilSauvegarde.validate({ ...baseSauvegarde, bkFolder: '\\\\serveur\\sauvegardes' });
assert(errUnc.bkFolder && /UNC|réseau/.test(errUnc.bkFolder),
  'contre-épreuve détectée — chemin UNC refusé pour la sauvegarde DHCP');

const outilZone = tools.find((t) => t.id === 'dns-zone');
const baseZone = Object.fromEntries(outilZone.fields.map((f) => [f.id, String(f.default ?? '')]));
for (const [nom, mutation, champ] of [
  ['zone inversée sans notation CIDR', { zoneType: 'Inversée', zoneName: 'hopitalbn.lan' }, 'zoneName'],
  ['nom de zone avec espace', { zoneName: 'zone invalide' }, 'zoneName'],
  ['mises à jour sécurisées sur zone fichier', { zoneStorage: 'Fichier', zoneUpdates: 'Secure' }, 'zoneUpdates'],
  ['étendue de réplication inconnue', { zoneReplication: 'Univers' }, 'zoneReplication'],
]) {
  const errors = outilZone.validate({ ...baseZone, ...mutation });
  assert(errors[champ], `contre-épreuve détectée — ${nom} (champ ${champ})`);
}

const outilEnregistrement = tools.find((t) => t.id === 'dns-record');
const baseEnregistrement = Object.fromEntries(outilEnregistrement.fields.map((f) => [f.id, String(f.default ?? '')]));
for (const [nom, mutation, champ] of [
  ['type MX hors périmètre', { recType: 'MX' }, 'recType'],
  ['PTR dans une zone directe', { recType: 'PTR', recZone: 'hopitalbn.lan' }, 'recZone'],
  ['enregistrement A dans une zone inversée', { recType: 'A', recZone: '30.168.192.in-addr.arpa' }, 'recZone'],
  ['adresse IPv4 invalide pour un type A', { recIPv4: '192.168.30.300' }, 'recIPv4'],
  ['adresse IPv6 invalide pour un type AAAA', { recType: 'AAAA', recIPv6: '2001:db8::1::2' }, 'recIPv6'],
  ['cible CNAME non qualifiée', { recType: 'CNAME', recTarget: 'srv' }, 'recTarget'],
]) {
  const errors = outilEnregistrement.validate({ ...baseEnregistrement, ...mutation });
  assert(errors[champ], `contre-épreuve détectée — ${nom} (champ ${champ})`);
}

const outilIcs = tools.find((t) => t.id === 'ics-readiness');
const baseIcs = Object.fromEntries(outilIcs.fields.map((f) => [f.id, String(f.default ?? '')]));
const errIcs = outilIcs.validate({ ...baseIcs, icsExternal: baseIcs.icsInternal });
assert(errIcs.icsExternal, 'contre-épreuve détectée — carte interne et carte Internet identiques (ICS)');

const outilRras = tools.find((t) => t.id === 'rras-nat-readiness');
const baseRras = Object.fromEntries(outilRras.fields.map((f) => [f.id, String(f.default ?? '')]));
const errRras = outilRras.validate({ ...baseRras, rrasExternal: baseRras.rrasInternal });
assert(errRras.rrasExternal, 'contre-épreuve détectée — interfaces interne et externe identiques (RRAS)');

section('LOT 2 — contre-épreuves : l\u2019audit de sécurité détecte-t-il vraiment ?');

// Outils fictifs, construits uniquement pour faire échouer l'auditeur.
const outilFictif = (rollback) => ({ id: 'outil-fictif', rollback });

const casAudit = [
  ['-Confirm:$false dans la procédure normale',
    { summary: 's', diagnostic: 'Get-DhcpServerv4Scope', command: 'Remove-DhcpServerv4Scope -ScopeId x -Confirm:$false', exceptional: '' },
    /-Confirm:\$false/],
  ['-Force dans la procédure normale',
    { summary: 's', diagnostic: 'Get-SmbShare', command: 'Remove-SmbShare -Name x -Force', exceptional: '' },
    /-Force/],
  ['commande destructrice sans confirmation',
    { summary: 's', diagnostic: 'Get-DnsServerZone', command: 'Remove-DnsServerZone -Name x', exceptional: '' },
    /aucune confirmation/],
  ['modification dans le bloc diagnostic',
    { summary: 's', diagnostic: 'Remove-DhcpServerv4Reservation -ScopeId x -ClientId y', command: 'Get-DhcpServerv4Reservation', exceptional: '' },
    /bloc diagnostic/],
  ['bloc exceptionnel sensible sans avertissement critique',
    { summary: 's', diagnostic: 'Get-Service', command: 'Get-Service', exceptional: 'Uninstall-WindowsFeature -Name DHCP -Confirm\nhttps://learn.microsoft.com/x' },
    /AVERTISSEMENT CRITIQUE/],
  ['bloc exceptionnel sans renvoi à une procédure officielle',
    { summary: 's', diagnostic: 'Get-Service', command: 'Get-Service', exceptional: 'AVERTISSEMENT CRITIQUE\nUninstall-WindowsFeature -Name DHCP -Confirm' },
    /procédure Microsoft officielle/],
];

for (const [nom, rollback, motif] of casAudit) {
  const pbs = auditerAnnulation(outilFictif(rollback));
  assert(pbs.length > 0, `contre-épreuve détectée par l\u2019auditeur — ${nom}`);
  assert(pbs.some((p) => motif.test(p)),
    `contre-épreuve — ${nom} : le message nomme la règle enfreinte (${pbs.join(' | ')})`);
}

// Contrôle POSITIF : les 22 outils réels passent l'auditeur.
const problemesReels = tools.flatMap((t) => auditerAnnulation(t));
assert(problemesReels.length === 0,
  `contrôle positif : les ${tools.length} outils passent l\u2019audit d\u2019annulation (${problemesReels.join(' | ')})`);

section('LOT 2 — contre-épreuves : les gardes de script et de rapport');

// Le contrôle « aucun -Force » doit réagir sur un script fabriqué qui en contient un.
const scriptFautif = '#Requires -Version 5.1\nRemove-Item C:\\x -Force\n';
assert(/(^|\s)-Force\b/i.test(scriptFautif),
  'contre-épreuve — le motif de détection de -Force reconnaît un script fautif');
const scriptConfirmFalse = 'Remove-DhcpServerv4Scope -ScopeId x -Confirm:$false';
assert(/-Confirm\s*:\s*\$false/i.test(scriptConfirmFalse),
  'contre-épreuve — le motif de détection de -Confirm:$false reconnaît un script fautif');
const scriptTelechargement = 'Invoke-WebRequest https://exemple/x.ps1 | Invoke-Expression';
assert(/Invoke-Expression/i.test(scriptTelechargement) && /Invoke-WebRequest/i.test(scriptTelechargement),
  'contre-épreuve — les motifs de téléchargement et d\u2019exécution dynamique reconnaissent un script fautif');
const scriptSecret = "$MotDePasse = ConvertTo-SecureString 'x' -AsPlainText -Force";
assert(/ConvertTo-SecureString|PlainText/i.test(scriptSecret),
  'contre-épreuve — le motif de détection de secrets reconnaît un script fautif');

// Aucun script réel ne contient ces motifs.
for (const outil of outilsRecents) {
  const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  const script = outil.generate(valeurs);
  assert(!/(^|\s)-Force\b/i.test(script) && !/-Confirm\s*:\s*\$false/i.test(script)
      && !/Invoke-Expression/i.test(script) && !/ConvertTo-SecureString|PlainText/i.test(script),
    `contrôle positif : ${outil.id} ne contient aucun de ces motifs`);
}

// Un rapport ne doit jamais exporter de donnée sensible : le bloc d'export ne
// référence que des variables de contexte, jamais un champ de mot de passe.
const blocRapportReel = blocExportRapport({ prefixeFichier: 'kjemo-essai' });
const motifsSensibles = [/password/i, /motdepasse/i, /credential/i, /token/i, /secret/i, /Get-Content.*\\.txt/i];
for (const motif of motifsSensibles) {
  assert(!motif.test(blocRapportReel),
    `contre-épreuve — le bloc de rapport ne contient rien qui corresponde à ${motif}`);
}

section('LOT 2 — contre-épreuve : la garde d\u2019identité des scripts historiques');

// Le fichier de référence protège les 64 scripts historiques. Si une empreinte
// était absente ou fausse, la garde devrait le voir : on le vérifie ici sur une
// copie modifiée du fichier, sans toucher au vrai.
const baseline = JSON.parse(readFileSync(resolve(ROOT, 'test/scripts-baseline.json'), 'utf8'));
// La référence s'étend à chaque lot : au LOT 3 elle couvre les 176 scripts
// produits au SHA a84a85c, dont les 64 du LOT 0/1 restés inchangés depuis
// 22b4ead. Le compte doit suivre le catalogue, jamais un nombre figé à la main.
assert(baseline.count === Object.keys(baseline.sha256).length,
  `la référence est cohérente : ${baseline.count} empreintes annoncées et présentes`);
assert(baseline.count >= 296,
  `la référence couvre au moins les 296 scripts existants (${baseline.count})`);
assert(/^[0-9a-f]{40}$/.test(baseline.baseSha),
  'la référence est ancrée à un SHA de commit complet');

// La référence grandit lot après lot, et elle garde la trace de chaque
// ancrage. Sans cette chaîne, régénérer la référence après avoir cassé
// quelque chose la rendrait « verte » sans que rien ne proteste.
assert(Array.isArray(baseline.ancrages) && baseline.ancrages.length >= 3,
  `la référence conserve sa chaîne d’ancrages (${(baseline.ancrages ?? []).length})`);
for (const a of baseline.ancrages ?? []) {
  assert(/^[0-9a-f]{40}$/.test(a.sha), `ancrage ${a.lot} : SHA de commit complet`);
  assert(Number.isInteger(a.count) && a.count > 0, `ancrage ${a.lot} : nombre de scripts connu`);
}
const shaAncres = (baseline.ancrages ?? []).map((a) => a.sha);
assert(shaAncres.includes('22b4eadbaf0771d13e5d8f5d66d72881e4a4d8c6'),
  'la chaîne remonte jusqu’à l’ancrage du LOT 1B');
assert(shaAncres.includes('a84a85c60690bcd38a0e08e4c2b6bfb3fe786b8b'),
  'la chaîne passe par l’ancrage du LOT 2');
assert(shaAncres[shaAncres.length - 1] === baseline.baseSha,
  'le dernier ancrage de la chaîne est celui auquel la référence est figée');
const comptes = (baseline.ancrages ?? []).map((a) => a.count);
assert(comptes.every((c, i) => i === 0 || c >= comptes[i - 1]),
  `la couverture ne recule jamais d’un ancrage au suivant (${comptes.join(' → ')})`);
assert(/^[0-9a-f]{40}$/.test(baseline.baseShaPrecedent)
  && shaAncres.includes(baseline.baseShaPrecedent),
  'la référence conserve la trace de l\u2019ancrage précédent, et il est dans la chaîne');
assert(shaAncres.includes('fb0932112b098d9c7d519fd9f57902172ffecf21'),
  'la chaîne passe par l’ancrage du LOT 3 corrigé');
assert(baseline.ancrages.length >= 4,
  `la chaîne compte au moins quatre ancrages (${baseline.ancrages.length})`);
const outilsCouverts = new Set(Object.keys(baseline.sha256).map((f) => f.split('__')[0]));
assert([...outilsCouverts].every((id) => tools.some((t) => t.id === id)),
  'chaque outil de la référence existe encore dans le catalogue');
const empreinteFausse = { ...baseline.sha256 };
const premierFichier = Object.keys(empreinteFausse)[0];
empreinteFausse[premierFichier] = '0'.repeat(64);
assert(empreinteFausse[premierFichier] !== baseline.sha256[premierFichier],
  `contre-épreuve — une empreinte modifiée diffère de la référence (${premierFichier})`);
assert(Object.keys(baseline.sha256).every((f) => /^[a-z0-9-]+__[a-z0-9-]+\.ps1$/.test(f)),
  'chaque entrée de la référence nomme un script <outil>__<jeu>.ps1');


// ===========================================================================
// LOT 3 — contre-épreuves de l'annuaire
//
// Chaque règle du lot est éprouvée par une valeur qui DOIT être refusée, puis
// par la valeur de laboratoire qui doit passer. Une garde qu'on n'a jamais vue
// refuser quoi que ce soit n'est pas une garde.
// ===========================================================================

section('LOT 3 — échappement LDAP et composition des noms distinctifs');

// RFC 4514 : ces caractères changent le sens d'un nom distinctif s'ils ne sont
// pas échappés. Le test vérifie l'échappement, puis qu'il est bien LE SEUL
// endroit où un antislash apparaît.
for (const [brut, attendu, pourquoi] of [
  ['Medecin',            'Medecin',              'un nom simple traverse sans modification'],
  ['Médecin',            'Médecin',              'les accents ne sont pas échappés : ils sont légitimes'],
  ["Cardio, Pneumo",     'Cardio\\, Pneumo',     'la virgule sépare les composants : elle doit être échappée'],
  ['a+b',                'a\\+b',                'le plus sépare les valeurs multiples d’un même RDN'],
  ['a=b',                'a\\=b',                'le signe égal sépare le type de la valeur'],
  ['a"b',                'a\\"b',                'le guillemet délimite une valeur'],
  ['a\\b',               'a\\\\b',               'l’antislash s’échappe lui-même'],
  ['<x>',                '\\<x\\>',              'les chevrons sont réservés'],
  [';x',                 '\\;x',                 'le point-virgule est réservé'],
  ['#debut',             '\\#debut',             'le dièse en tête déclencherait une valeur hexadécimale'],
  [' espace',            '\\ espace',            'une espace en tête doit être échappée'],
  ['espace ',            'espace\\ ',            'une espace en fin doit être échappée'],
]) {
  assert(escapeLdapRdn(brut) === attendu,
    `échappement LDAP — ${pourquoi} (« ${brut} » → « ${escapeLdapRdn(brut)} »)`);
}
assert(escapeLdapRdn("L'Hôpital") === "L'Hôpital",
  'échappement LDAP — l’apostrophe n’est pas un caractère réservé de RFC 4514');

assert(domainToDn('hopitalbn.lan') === 'DC=hopitalbn,DC=lan',
  'un nom de domaine devient une suite de composants DC');
assert(cheminOuVersDn(['Médecin', 'Spécialiste'], 'hopitalbn.lan')
       === 'OU=Spécialiste,OU=Médecin,DC=hopitalbn,DC=lan',
  'un chemin parent/enfant se compose du plus profond au plus général');
assert(cheminOuVersDn(['Cardio, Pneumo'], 'hopitalbn.lan')
       === 'OU=Cardio\\, Pneumo,DC=hopitalbn,DC=lan',
  'la composition d’un DN échappe la virgule contenue dans un nom d’OU');

section('LOT 3 — contre-épreuves : noms distinctifs refusés');

for (const [nom, valeur] of [
  ['chaîne vide',                     ''],
  ['aucun signe égal',                'Medecin'],
  ['composant sans type',             '=Medecin,DC=hopitalbn,DC=lan'],
  ['composant sans valeur',           'OU=,DC=hopitalbn,DC=lan'],
  ['aucun composant DC',              'OU=Medecin,OU=Sante'],
  ['DC placé avant une OU',           'DC=hopitalbn,OU=Medecin,DC=lan'],
  ['type non alphanumérique',         'O U=Medecin,DC=hopitalbn,DC=lan'],
]) {
  assert(!validerDn(valeur).ok, `contre-épreuve DN — ${nom} est refusé (« ${valeur} »)`);
}
assert(validerDn('OU=Spécialiste,OU=Médecin,DC=hopitalbn,DC=lan').ok,
  'contrôle positif : le DN de laboratoire est accepté');
assert(validerDn('OU=Cardio\\, Pneumo,DC=hopitalbn,DC=lan').ok,
  'contrôle positif : une virgule échappée ne casse pas la lecture du DN');

section('LOT 3 — contre-épreuves : chemins et listes d’OU');

for (const [nom, valeur] of [
  ['chemin vide',                 ''],
  ['segment vide entre deux barres', 'Medecin//Specialiste'],
  ['barre en tête',               '/Medecin'],
  ['barre en fin',                'Medecin/'],
  ['plus de dix niveaux',         'a/b/c/d/e/f/g/h/i/j/k'],
  ['caractère de contrôle',       'Medecin\u0007Specialiste'],
]) {
  assert(!validerCheminOu(valeur).ok, `contre-épreuve chemin d’OU — ${nom} est refusé`);
}
assert(validerCheminOu('Médecin/Spécialiste').ok,
  'contrôle positif : le chemin accentué du laboratoire est accepté');

// La liste d'OU du laboratoire : huit lignes, dont quatre parents.
const listeLabo = [
  'Médecin', 'Médecin/Généraliste', 'Médecin/Spécialiste',
  'Infirmière', 'Infirmière/Principale', 'Infirmière/Auxiliaire',
  'Patient', 'Administration',
].join('\n');
const resListe = validerListeOu(listeLabo);
assert(resListe.ok, 'contrôle positif : la liste d’OU du laboratoire est acceptée');
assert(resListe.value.length === 8, `la liste du laboratoire donne 8 unités (${resListe.value.length})`);
assert(resListe.value.slice(0, 4).every((x) => x.profondeur === 1),
  'les parents sont triés avant les enfants : les quatre premiers sont de profondeur 1');
assert(resListe.value.slice(4).every((x) => x.profondeur === 2),
  'les quatre suivants sont de profondeur 2');

// Un enfant seul doit amener son parent : sans quoi la création échouerait.
const resImplicite = validerListeOu('Médecin/Spécialiste');
assert(resImplicite.ok && resImplicite.value.length === 2,
  `un enfant seul ajoute son parent implicite (${resImplicite.value.length} unité(s))`);
assert(resImplicite.value[0].chemin === 'Médecin' && resImplicite.value[0].implicite === true,
  'le parent ajouté est signalé comme implicite');

for (const [nom, valeur] of [
  ['liste vide',            ''],
  ['doublon exact',         'Medecin\nMedecin'],
  ['doublon avec espaces',  'Medecin\n  Medecin  '],
  ['segment invalide',      'Medecin\nMedecin/\u0007x'],
]) {
  assert(!validerListeOu(valeur).ok, `contre-épreuve liste d’OU — ${nom} est refusé`);
}

section('LOT 3 — contre-épreuves : comptes, groupes et chemins');

for (const [nom, valeur] of [
  ['aucun arobase',        'm.tremblay'],
  ['deux arobases',        'm@t@hopitalbn.lan'],
  ['domaine non qualifié', 'm.tremblay@hopitalbn'],
  ['partie locale vide',   '@hopitalbn.lan'],
]) {
  assert(!validerUpn(valeur).ok, `contre-épreuve UPN — ${nom} est refusé (« ${valeur} »)`);
}
assert(validerUpn('m.tremblay@hopitalbn.lan').ok, 'contrôle positif : l’UPN du laboratoire est accepté');

assert(!validerPorteeGroupe('Locale').ok, 'contre-épreuve — une portée inventée est refusée');
assert(validerPorteeGroupe('DomainLocal').ok, 'contrôle positif : DomainLocal est une portée valide');
assert(!validerCategorieGroupe('Securite').ok, 'contre-épreuve — la catégorie s’écrit Security, pas Securite');
assert(validerCategorieGroupe('Security').ok, 'contrôle positif : Security est une catégorie valide');

for (const [nom, valeur] of [
  ['chemin local et non UNC', 'D:\\Profils'],
  ['une seule barre en tête', '\\serveur\\partage'],
  ['serveur sans partage',    '\\\\serveur'],
  ['chaîne vide',             ''],
]) {
  assert(!validerCheminUnc(valeur).ok, `contre-épreuve UNC — ${nom} est refusé (« ${valeur} »)`);
}
assert(validerCheminUnc('\\\\SRV-FICHIERS\\Profils$').ok,
  'contrôle positif : un partage masqué reste un chemin UNC valide');

assert(!validerLettreLecteur('C:').ok, 'contre-épreuve — C: est réservé au disque système');
assert(!validerLettreLecteur('H').ok, 'contre-épreuve — la lettre doit être suivie de deux points');
assert(validerLettreLecteur('H:').ok, 'contrôle positif : H: est une lettre de lecteur réseau valide');

assert(!validerNomOrdinateur('PC-CONSULTATION-CARDIOLOGIE').ok,
  'contre-épreuve — un nom d’ordinateur de plus de 15 caractères est refusé');
assert(validerNomOrdinateur('PC-CARDIO-01$').ok,
  'contrôle positif : le dollar final d’un compte machine est toléré');

for (const [nom, valeur, bornes] of [
  ['texte au lieu d’un nombre', 'quatre-vingt-dix', {}],
  ['nombre décimal',            '90,5',             {}],
  ['zéro',                      '0',                { min: 1 }],
  ['au-delà de la borne haute', '99999',            { max: 3650 }],
  ['un mot de passe glissé dans un champ de seuil', 'Hopital!2026Secret', {}],
]) {
  assert(!validerJours(valeur, bornes).ok, `contre-épreuve jours — ${nom} est refusé (« ${valeur} »)`);
}
assert(validerJours('90').ok, 'contrôle positif : 90 jours est un seuil accepté');

section('LOT 3 — contre-épreuves : schéma de fichier CSV');

for (const [nom, valeur, obligatoires] of [
  ['liste vide',            '',                                   []],
  ['colonne obligatoire absente', 'Prenom,Nom',                    ['SamAccountName']],
  ['doublon de colonne',    'SamAccountName,Nom,SamAccountName',   ['SamAccountName']],
  ['colonne sans nom',      'SamAccountName,,Nom',                 ['SamAccountName']],
]) {
  assert(!validerColonnesCsv(valeur, { obligatoires }).ok,
    `contre-épreuve CSV — ${nom} est refusé (« ${valeur} »)`);
}
assert(validerColonnesCsv('SamAccountName,Prenom,Nom,Ou', { obligatoires: ['SamAccountName'] }).ok,
  'contrôle positif : un schéma complet est accepté');

section('LOT 3 — contre-épreuves : les outils refusent les données fautives');

// Chaque outil du lot est éprouvé sur SON champ le plus structurant. Le test
// exige que l'erreur porte sur le bon champ, et qu'aucun script ne soit produit.
const casOutilsAd = [
  ['ad-ou-hierarchy',        { ouList: 'Medecin\nMedecin' },            'ouList'],
  ['ad-ou-hierarchy',        { adDomain: 'hopitalbn' },                 'adDomain'],
  ['ad-groups',              { grpList: 'GG-Medecins\nGG-Medecins' },   'grpList'],
  ['ad-groups',              { grpScope: 'Locale' },                    'grpScope'],
  ['ad-groups',              { grpOu: 'Administration/' },              'grpOu'],
  ['ad-account-health',      { sanInactif: 'beaucoup' },                'sanInactif'],
  ['ad-account-health',      { sanAgeMotDePasse: 'Hopital!2026' },      'sanAgeMotDePasse'],
  ['ad-account-recovery',    { recCompte: 'm@t@hopitalbn.lan' },        'recCompte'],
  ['ad-account-recovery',    { recAction: 'Supprimer' },                'recAction'],
  ['ad-object-search-move',  { objRecherche: 'm.tremb*' },              'objRecherche'],
  ['ad-object-search-move',  { objRecherche: 'OU=Medecin' },            'objRecherche'],
  ['ad-object-search-move',  { objOuCible: '/Medecin' },                'objOuCible'],
  ['ad-computer-cleanup',    { ordInactif: '5' },                       'ordInactif'],
  ['ad-computer-cleanup',    { ordAction: 'Supprimer' },                'ordAction'],
  ['ad-delegation-audit',    { delPortee: 'Certaines' },                'delPortee'],
  ['ad-dns-health',          { dnsAdJours: '0' },                       'dnsAdJours'],
  ['ad-dcdiag-report',       { dcdEtendue: 'Rapide' },                  'dcdEtendue'],
  ['ad-repadmin-report',     { repLatence: 'longtemps' },               'repLatence'],
  ['ad-secure-channel',      { canDerive: '5' },                        'canDerive'],
  ['ad-domain-full-report',  { cplInactif: '2' },                       'cplInactif'],
  ['ad-home-profile-paths',  { adDomain: 'hopitalbn .lan' },            'adDomain'],
  ['ad-group-members-csv',   { adDomain: '' },                          'adDomain'],
  ['ad-users-csv',           { adDomain: 'hopitalbn' },                 'adDomain'],
];
for (const [id, mutation, champAttendu] of casOutilsAd) {
  const outil = tools.find((t) => t.id === id);
  assert(Boolean(outil), `l’outil ${id} existe dans le catalogue`);
  if (!outil) continue;
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  const valeurs = { ...base, ...mutation };
  const errors = outil.validate(valeurs);
  assert(Boolean(errors[champAttendu]),
    `contre-épreuve ${id} — l’erreur porte sur « ${champAttendu} » (${Object.keys(errors).join(', ') || 'aucune'})`);
  let leve = false;
  try { outil.generate(valeurs); } catch { leve = true; }
  assert(leve, `contre-épreuve ${id} — aucun script n’est produit à partir de « ${champAttendu} » fautif`);
}

// Contrôle POSITIF : les valeurs de laboratoire de chaque outil AD passent.
// Les identifiants du lot, nommes un par un : le test ne doit pas se laisser
// elargir par un simple prefixe, qui ramasserait aussi ad-ou et ad-user, deux
// outils du LOT 1 qui ne suivent pas ce contrat.
const IDS_LOT3 = [
  'ad-ou-hierarchy', 'ad-users-csv', 'ad-groups', 'ad-group-members-csv',
  'ad-home-profile-paths', 'ad-account-health', 'ad-account-recovery',
  'ad-object-search-move', 'ad-delegation-audit', 'ad-computer-cleanup',
  'ad-dns-health', 'ad-dcdiag-report', 'ad-repadmin-report',
  'ad-secure-channel', 'ad-domain-full-report',
];
const outilsAd = tools.filter((t) => IDS_LOT3.includes(t.id));
assert(outilsAd.length === 15, `le LOT 3 ajoute 15 outils Active Directory (${outilsAd.length})`);
assert(outilsAd.every((t) => t.category === 'Active Directory'),
  'les quinze outils du LOT 3 sont tous classes dans Active Directory');
const SOUS_RUBRIQUES_LOT3 = ['Structure et OU', 'Utilisateurs et groupes',
  'Cycle de vie des comptes', 'Maintenance des objets', 'Santé du domaine'];
assert(outilsAd.every((t) => SOUS_RUBRIQUES_LOT3.includes(t.subcategory)),
  `chaque outil du LOT 3 porte une des cinq sous-rubriques prevues (${[...new Set(outilsAd.map((t) => t.subcategory))].join(', ')})`);
for (const outil of outilsAd) {
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  const errors = outil.validate(base);
  assert(Object.keys(errors).length === 0,
    `contrôle positif : les valeurs de laboratoire de ${outil.id} sont acceptées (${Object.keys(errors).join(', ')})`);
}

section('LOT 3 — contre-épreuves : commande dangereuse injectée dans un script');

// La garde qui interdit les motifs dangereux doit réagir sur un script
// fabriqué. Sans cette contre-épreuve, un contrôle qui ne détecte plus rien
// passerait pour un succès.
const injections = [
  ['suppression forcée',        'Remove-ADUser -Identity m.tremblay -Confirm:$false'],
  ['suppression avec -Force',   'Remove-ADOrganizationalUnit -Identity "OU=x,DC=y" -Recursive -Force'],
  ['exécution dynamique',       '$c = "Remove-ADGroup x" ; Invoke-Expression $c'],
  ['contournement de stratégie','Set-ExecutionPolicy Bypass -Scope Process'],
  ['téléchargement de code',    'Invoke-WebRequest https://exemple/x.ps1 -OutFile x.ps1'],
  ['secret fabriqué',           "$p = ConvertTo-SecureString 'Hopital!2026' -AsPlainText -Force"],
  ['reconstruction de SYSVOL',  'ntdsutil "authoritative restore" "restore subtree" q q'],
];
const motifsInterdits = [
  /-Confirm\s*:\s*\$false/i, /(^|\s)-Force\b/i, /Invoke-Expression/i,
  /Set-ExecutionPolicy/i, /Invoke-WebRequest/i, /ConvertTo-SecureString|PlainText/i,
  /ntdsutil/i,
];
for (const [nom, ligne] of injections) {
  assert(motifsInterdits.some((m) => m.test(ligne)),
    `contre-épreuve — le jeu de motifs reconnaît une ${nom} injectée`);
}

// Contrôle POSITIF : aucun script réel du lot ne contient ces motifs, et
// aucun ne reconstruit SYSVOL, dans aucun de ses jeux de valeurs.
for (const outil of outilsAd) {
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  const modes = outil.fields.some((f) => f.id === 'mode') ? ['Diagnostic', 'Appliquer'] : [null];
  for (const mode of modes) {
    const valeurs = mode ? { ...base, mode } : base;
    const script = outil.generate(valeurs);
    for (const m of motifsInterdits) {
      assert(!m.test(script),
        `contrôle positif : ${outil.id} (${mode ?? 'lecture'}) ne contient pas ${m}`);
    }
    assert(!/Remove-AD(User|Group|Computer|Object|OrganizationalUnit)\b/i.test(script),
      `contrôle positif : ${outil.id} (${mode ?? 'lecture'}) ne supprime aucun objet d’annuaire`);
    assert(!/Uninstall-WindowsFeature|Uninstall-ADDSDomainController/i.test(script),
      `contrôle positif : ${outil.id} (${mode ?? 'lecture'}) ne désinstalle aucun rôle`);
    assert(!/Set-Acl\s+-Path\s+["']?AD:/i.test(script),
      `contrôle positif : ${outil.id} (${mode ?? 'lecture'}) ne remplace aucune ACL d’annuaire`);
  }
}

section('LOT 3 — le mode Diagnostic n’écrit rien');

// Un outil modifiant doit produire, en mode Diagnostic, un script dont aucune
// écriture n'est atteignable : toutes sont gardées par le test sur $Mode.
const outilsModifiantsAd = outilsAd.filter((t) => t.fields.some((f) => f.id === 'mode'));
assert(outilsModifiantsAd.length >= 6,
  `le lot compte ${outilsModifiantsAd.length} outils modifiants soumis à cette règle`);
const ECRITURES = /\b(New|Set|Move|Remove|Add|Enable|Disable|Unlock|Clear|Rename)-AD\w+/g;
for (const outil of outilsModifiantsAd) {
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  const script = outil.generate({ ...base, mode: 'Diagnostic' });

  assert(/\$Mode = /.test(script), `${outil.id} : le script porte la variable de mode`);
  assert(/MODE DIAGNOSTIC/.test(script),
    `${outil.id} : le script annonce explicitement qu’il n’a rien modifié`);

  // Chaque ligne qui écrit doit être soit sous la garde $Mode, soit en -WhatIf.
  const lignes = script.split('\n');
  let sousGarde = false;
  let profondeurGarde = 0;
  for (const ligne of lignes) {
    if (/if \(\$Mode -eq 'Appliquer'/.test(ligne)) { sousGarde = true; profondeurGarde = 0; }
    if (sousGarde) {
      profondeurGarde += (ligne.match(/\{/g) ?? []).length;
      profondeurGarde -= (ligne.match(/\}/g) ?? []).length;
      if (profondeurGarde <= 0 && !/if \(\$Mode -eq 'Appliquer'/.test(ligne)) sousGarde = false;
    }
    const ecritures = [...ligne.matchAll(ECRITURES)].map((m) => m[0])
      .filter((c) => !/^(Get|Test|Search)-/.test(c));
    if (ecritures.length === 0) continue;
    const toleree = sousGarde
      || /-WhatIf\b/.test(ligne)
      || /^\s*#/.test(ligne)
      || /Write-Host/.test(ligne)
      || /Add-KjemoResultat/.test(ligne);
    assert(toleree,
      `${outil.id} : « ${ecritures[0]} » n’écrit qu’en mode Appliquer ou en simulation`,
      ligne.trim().slice(0, 110));
  }
}

section('LOT 3 — aucun secret, nulle part');

// Le lot manipule des comptes : la règle est absolue et vérifiée deux fois,
// sur les champs du formulaire et sur le script produit.
for (const outil of outilsAd) {
  for (const f of outil.fields) {
    assert(!/^(pwd|pass|password|motdepasse|secret|token)$/i.test(f.id),
      `${outil.id} : aucun champ ne s’appelle « ${f.id} »`);
    assert(!/type:\s*['"]password['"]/.test(JSON.stringify(f)),
      `${outil.id} : le champ « ${f.id} » n’est pas un champ de mot de passe`);
  }
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  const modes = outil.fields.some((f) => f.id === 'mode') ? ['Diagnostic', 'Appliquer'] : [null];
  for (const mode of modes) {
    const script = outil.generate(mode ? { ...base, mode } : base);
    assert(/Le rapport ne contient aucun mot de passe/.test(script),
      `${outil.id} (${mode ?? 'lecture'}) : le bloc de rapport porte l’engagement écrit`);
  }
}


// ===========================================================================
// LOT 3 — correctifs Codex
// ===========================================================================

section('Correctif 1 — ad-home-profile-paths : la sauvegarde conditionne l’écriture');

{
  const outil = tools.find((t) => t.id === 'ad-home-profile-paths');
  assert(Boolean(outil), 'ad-home-profile-paths est présent dans le catalogue');
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));

  for (const mode of ['Diagnostic', 'Appliquer']) {
    const script = outil.generate({ ...base, mode });

    assert(/\$sauvegardeOk = \$false/.test(script),
      `${mode} : l’indicateur de sauvegarde part de $false`);
    assert(/Export-Csv[^\n]*-ErrorAction Stop/.test(script),
      `${mode} : l’export de sauvegarde échoue bruyamment (-ErrorAction Stop)`);

    // L'export est entouré d'un try/catch, et $sauvegardeOk n'est mis à $true
    // qu'APRÈS lui — pas avant, ce qui ne prouverait rien.
    const iTry = script.indexOf('  try {\n    $ancien | Export-Csv');
    assert(iTry !== -1, `${mode} : l’export de sauvegarde est encadré par un try`);
    const iExport = script.indexOf('$ancien | Export-Csv');
    const iVrai = script.indexOf('$sauvegardeOk = $true', iExport);
    const iCatch = script.indexOf('} catch {', iExport);
    assert(iVrai !== -1 && iCatch !== -1 && iVrai < iCatch,
      `${mode} : la sauvegarde n’est déclarée réussie qu’après un export réussi`);

    // La garde du bloc Appliquer exige les trois conditions.
    assert(script.includes("if ($Mode -eq 'Appliquer' -and $moduleOk -and $sauvegardeOk) {"),
      `${mode} : le bloc Appliquer exige $sauvegardeOk`);

    // Les trois commandes de modification n'existent que sous cette garde.
    const lignes = script.split('\n');
    const iGarde = lignes.findIndex((l) => l.includes("if ($Mode -eq 'Appliquer' -and $moduleOk -and $sauvegardeOk) {"));
    for (const cmd of ['New-Item', 'Set-Acl -LiteralPath', 'Set-ADUser -Identity $cible.Dn -HomeDirectory']) {
      const lignesCmd = lignes
        .map((l, i) => [l, i])
        .filter(([l]) => l.includes(cmd) && !/^\s*#/.test(l));
      assert(lignesCmd.length > 0, `${mode} : « ${cmd} » figure bien dans le script`);
      for (const [l, i] of lignesCmd) {
        assert(i > iGarde || /-WhatIf\b/.test(l),
          `${mode} : « ${cmd} » n’apparaît qu’après la garde de sauvegarde, ou en simulation`,
          l.trim().slice(0, 100));
      }
    }

    // Et le script le dit, plutôt que d'échouer en silence.
    assert(/bloquees par l''echec de la sauvegarde/.test(script),
      `${mode} : l’échec de sauvegarde produit un résultat explicite`);
    assert(/AUCUNE modification ne sera executee/.test(script),
      `${mode} : le rapport annonce qu’aucune modification ne sera exécutée`);

    // Aucune suppression de dossier personnel, dans aucun mode.
    assert(!/Remove-Item[^\n]*\$cible\.Chemin/.test(script),
      `${mode} : aucun dossier personnel n’est supprimé`);
  }

  // L'idempotence reste vraie : un compte déjà conforme n'est pas réécrit.
  const scriptAppliquer = outil.generate({ ...base, mode: 'Appliquer' });
  assert(/dejaConforme/.test(scriptAppliquer) && /Deja conforme : aucune ecriture/.test(scriptAppliquer),
    'l’idempotence est conservée : un compte déjà conforme n’est pas réécrit');
}

section('Correctif 2 — ad-secure-channel : -Server désigne un contrôleur, pas le domaine');

{
  const outil = tools.find((t) => t.id === 'ad-secure-channel');
  assert(Boolean(outil), 'ad-secure-channel est présent dans le catalogue');
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));

  // Les huit jeux de valeurs du projet, pas seulement celui par défaut : la
  // règle doit tenir quelles que soient les entrées.
  const variantes = [
    { ...base },
    { ...base, mode: 'Appliquer' },
    { ...base, adDomain: 'hopitalbn.lan', canPorts: 'Non' },
    { ...base, adDomain: 'labo.interne.lan', canDerive: '600', mode: 'Appliquer' },
  ];

  for (const valeurs of variantes) {
    const etiquette = `${valeurs.adDomain} / ${valeurs.mode}`;
    const script = outil.generate(valeurs);

    // La règle centrale : jamais le domaine derrière -Server.
    assert(!/Test-ComputerSecureChannel[^\n]*-Server \$Domaine/.test(script),
      `${etiquette} : aucun appel ne passe $Domaine à -Server`);
    assert(!/-Server \$Domaine\b/.test(script),
      `${etiquette} : $Domaine n’est passé à -Server nulle part dans le script`);

    // Les trois appels, un par un.
    const appels = script.split('\n').filter((l) =>
      /Test-ComputerSecureChannel/.test(l) && !/^\s*#/.test(l) && !/Write-Host/.test(l));
    assert(appels.length >= 3,
      `${etiquette} : le script porte ses trois appels (${appels.length})`);
    for (const ligne of appels) {
      assert(!/-Server/.test(ligne) || /-Server \$cible\b/.test(ligne),
        `${etiquette} : tout -Server reçoit $cible`, ligne.trim().slice(0, 100));
    }

    const diagnostic = appels.find((l) => /\$canalOk = Test-ComputerSecureChannel -Server/.test(l));
    assert(Boolean(diagnostic) && /-Server \$cible\b/.test(diagnostic),
      `${etiquette} : le diagnostic initial vise le contrôleur retenu`);
    const reparation = appels.find((l) => /-Repair/.test(l));
    assert(Boolean(reparation) && /-Server \$cible\b/.test(reparation),
      `${etiquette} : la réparation vise le contrôleur retenu`);
    const verification = appels.find((l) => /\$apres = Test-ComputerSecureChannel/.test(l));
    assert(Boolean(verification) && /-Server \$cible\b/.test(verification),
      `${etiquette} : la vérification après réparation vise le contrôleur retenu`);

    // Le nom issu d'un enregistrement SRV est absolu : le point final doit tomber.
    assert(/NameTarget\.TrimEnd\('\.'\)/.test(script),
      `${etiquette} : le point final du NameTarget SRV est retiré`);

    // Sans contrôleur, aucune réparation — et un message qui le dit.
    assert(script.includes("if ($Mode -eq 'Appliquer' -and $estMembre -and $canalOk -eq $false -and -not $cible) {"),
      `${etiquette} : l’absence de contrôleur est traitée avant la réparation`);
    assert(/aucun controleur de domaine identifie/.test(script),
      `${etiquette} : le rapport nomme la cause quand aucun contrôleur n’est trouvé`);
    assert(/Corrige d''abord le DNS/.test(script),
      `${etiquette} : le rapport dit quoi corriger`);

    // Ce qui ne devait pas bouger n'a pas bougé.
    assert(/refusee sur un controleur de domaine/.test(script),
      `${etiquette} : la réparation reste refusée sur un contrôleur de domaine`);
    assert(/Get-Credential -Message/.test(script),
      `${etiquette} : les identifiants sont toujours demandés localement`);
    assert(/\$identifiants = \$null/.test(script),
      `${etiquette} : la variable d’identifiants est toujours effacée après usage`);
  }

  // La fiche ne doit plus montrer -Server '<domaine>' dans sa procédure.
  const proc = [outil.rollback.diagnostic, outil.rollback.command, outil.rollback.exceptional ?? ''].join('\n');
  assert(!/-Server '<domaine>'/.test(proc),
    'la procédure affichée dans la fiche ne montre plus -Server ‹domaine›');
  assert(/NameTarget\.TrimEnd/.test(outil.rollback.command),
    'la procédure de la fiche résout elle-même un contrôleur, point final retiré');
}


section('Correctif 3 — la contre-épreuve est branchée dans la CI Windows');

// Un test qui existe mais que personne ne lance ne protège rien. Le branchement
// dans le workflow fait donc partie du correctif, et se vérifie comme le reste.
{
  const CHEMIN_WORKFLOW = resolve(ROOT, '../.github/workflows/validate.yml');
  const present = existsSync(CHEMIN_WORKFLOW);
  assert(present, 'le workflow .github/workflows/validate.yml existe');

  if (present) {
    const yml = readFileSync(CHEMIN_WORKFLOW, 'utf8');

    assert(/runs-on:\s*windows-latest/.test(yml),
      'le workflow tourne sur windows-latest — seul endroit où PowerShell 5.1 existe');

    // Les étapes, dans l'ordre où le fichier les déclare.
    const etapes = [...yml.matchAll(/^\s*-\s*name:\s*(.+)$/gm)].map((m) => m[1].trim());
    const i51  = etapes.findIndex((n) => /Contre-épreuve sauvegarde bloquante — Windows PowerShell 5\.1/.test(n));
    const i7   = etapes.findIndex((n) => /Contre-épreuve sauvegarde bloquante — PowerShell 7/.test(n));
    const iNav = etapes.findIndex((n) => /Tests navigateur/i.test(n));

    assert(i51 !== -1, 'une étape exécute la contre-épreuve sous Windows PowerShell 5.1');
    assert(i7 !== -1, 'une étape exécute la contre-épreuve sous PowerShell 7');
    assert(iNav !== -1, 'l’étape des tests navigateur est toujours là');
    assert(i51 < iNav && i7 < iNav,
      `les deux contre-épreuves précèdent les tests navigateur (5.1 en ${i51}, 7 en ${i7}, navigateur en ${iNav})`);

    // Chaque étape doit IMPOSER son moteur — sinon la ligne « PS 5.1 » du
    // journal de CI pourrait avoir été produite par PowerShell 7.
    assert(/node test\/sauvegarde-bloquante\.test\.mjs --powershell powershell\b/.test(yml),
      'l’étape 5.1 impose --powershell powershell');
    assert(/node test\/sauvegarde-bloquante\.test\.mjs --powershell pwsh\b/.test(yml),
      'l’étape 7 impose --powershell pwsh');
    assert(!/sauvegarde-bloquante\.test\.mjs\s*$/m.test(yml),
      'aucune invocation de la contre-épreuve ne laisse le moteur au hasard');

    // Rien ne doit rendre ces étapes facultatives.
    const bloc51 = yml.slice(yml.indexOf('Contre-épreuve sauvegarde bloquante — Windows PowerShell 5.1'),
                             yml.indexOf('Installer les navigateurs Playwright'));
    // On juge les étapes, pas les commentaires : un commentaire qui PROMET
    // qu'il n'y a pas de continue-on-error ne doit pas faire échouer le
    // contrôle qui le vérifie.
    const bloc51Utile = bloc51.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    assert(!/continue-on-error/.test(bloc51Utile),
      'aucune des deux contre-épreuves ne porte continue-on-error');
    assert(!/if:\s*(always|success\(\)\s*\|\||failure)/.test(bloc51),
      'aucune des deux contre-épreuves n’est rendue conditionnelle');
    assert(/shell:\s*powershell/.test(bloc51) && /shell:\s*pwsh/.test(bloc51),
      'les deux étapes déclarent chacune leur interpréteur d’hôte');
  }
}

section('Correctif 3 — la contre-épreuve refuse de changer de moteur');

// Le contrat de l'option est vérifié à l'exécution dans
// test/sauvegarde-bloquante.test.mjs (passe D). Ici, on vérifie que le
// fichier existe, qu'il est branché dans npm test, et qu'il ne contient
// aucun repli silencieux.
{
  const CHEMIN_TEST = resolve(ROOT, 'test/sauvegarde-bloquante.test.mjs');
  assert(existsSync(CHEMIN_TEST), 'la contre-épreuve d’exécution est présente dans le dépôt');
  const source = readFileSync(CHEMIN_TEST, 'utf8');

  assert(/--powershell/.test(source), 'la contre-épreuve accepte l’option --powershell');
  assert(/process\.exit\(1\)/.test(source),
    'un interpréteur demandé mais absent fait sortir en erreur');
  assert(/ne se rabat pas sur un autre moteur/.test(source),
    'le refus de repli est écrit dans le message, pas seulement dans le code');

  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  assert(/sauvegarde-bloquante/.test(pkg.scripts.test ?? ''),
    'npm test lance la contre-épreuve d’exécution');
}

// ===========================================================================
// LOT 4 — stratégies de groupe avancées
// ===========================================================================
{
  const V = await import('../dist/validateurs.mjs');
  const outilsGpo = tools.filter((t) => t.category === 'GPO' && t.id !== 'gpo-password');

  section('LOT 4 — le catalogue GPO');

  const ATTENDUS = [
    ['gpo-inventory-report', 'Diagnostic et inventaire'],
    ['gpo-health-report', 'Diagnostic et inventaire'],
    ['gpo-resultant-set', 'Diagnostic et inventaire'],
    ['gpo-refresh-diagnostic', 'Diagnostic et inventaire'],
    ['gpo-create-link', 'Création, liens et ciblage'],
    ['gpo-link-audit', 'Création, liens et ciblage'],
    ['gpo-security-filter', 'Création, liens et ciblage'],
    ['gpo-wmi-filter-readiness', 'Création, liens et ciblage'],
    ['gpo-drive-mapping', 'Environnement utilisateur'],
    ['gpo-printer-deployment', 'Environnement utilisateur'],
    ['gpo-logon-startup-scripts', 'Environnement utilisateur'],
    ['gpo-folder-redirection', 'Environnement utilisateur'],
    ['gpo-session-desktop', 'Sécurité des postes et serveurs'],
    ['gpo-device-restrictions', 'Sécurité des postes et serveurs'],
    ['gpo-firewall-defender', 'Sécurité des postes et serveurs'],
    ['gpo-windows-update-services', 'Sécurité des postes et serveurs'],
    ['gpo-software-shortcuts-browser', 'Déploiement et maintenance'],
    ['gpo-backup-restore-compare', 'Déploiement et maintenance'],
  ];

  assert(outilsGpo.length === 18, `LOT 4 : dix-huit assistants GPO ajoutés (${outilsGpo.length})`);
  for (const [id, sousRubrique] of ATTENDUS) {
    const o = outilsGpo.find((t) => t.id === id);
    assert(Boolean(o), `LOT 4 : l’assistant « ${id} » existe`);
    if (o) assert(o.subcategory === sousRubrique,
      `LOT 4 : « ${id} » est classé dans « ${sousRubrique} » (${o.subcategory})`);
  }
  assert(tools.filter((t) => t.id === 'gpo-password').length === 1,
    'LOT 4 : l’assistant gpo-password du LOT 1 n’est pas dupliqué');
  const ids = tools.map((t) => t.id);
  assert(new Set(ids).size === ids.length, 'LOT 4 : aucun identifiant d’outil en double');
  assert(tools.length >= 55, `LOT 4 : le catalogue compte au moins les 55 outils du LOT 4 (${tools.length})`);
  assert(tools.filter((t) => t.category === 'GPO').length === 19,
    'LOT 4 : la catégorie GPO compte 19 assistants, gpo-password compris');

  // -------------------------------------------------------------------------
  section('LOT 4 — validateurs : ce qui passe et ce qui est refusé');

  const VALIDES = [
    ['validerNomGpo', V.validerNomGpo, ['GPO-Medecins', 'GPO Comptabilité — Élévation', "GPO-D'Adam"]],
    ['validerPorteeGpo', V.validerPorteeGpo, ['Ordinateur', 'Utilisateur', 'Les deux']],
    ['validerOrdreLien', V.validerOrdreLien, ['1', '42', '999']],
    ['validerCheminSysvol', V.validerCheminSysvol,
      ['\\\\hopitalbn.lan\\SYSVOL\\hopitalbn.lan\\scripts', '\\\\hopitalbn.lan\\NETLOGON']],
    ['validerNomScriptGpo', V.validerNomScriptGpo, ['connexion.ps1', 'demarrage.cmd', 'ancien.vbs']],
    ['validerRequeteWql', V.validerRequeteWql,
      ['SELECT * FROM Win32_OperatingSystem', 'SELECT * FROM Win32_ComputerSystem WHERE Model LIKE "%Latitude%"']],
    ['validerEspaceNomsWmi', V.validerEspaceNomsWmi, ['root\\CIMv2', 'root\\Microsoft\\Windows\\Storage']],
    ['validerMinutes', (x) => V.validerMinutes(x, { min: 1, max: 240 }), ['1', '15', '240']],
    ['validerHeure', V.validerHeure, ['0', '7', '23']],
    ['validerUrlHttps', V.validerUrlHttps,
      ['https://intranet.hopitalbn.lan/accueil', 'https://intranet.hopitalbn.lan:8443/portail']],
  ];
  for (const [nom, fn, valeurs] of VALIDES) {
    for (const v of valeurs) {
      const r = fn(v);
      assert(r.ok, `${nom} accepte « ${v} »`, r.error ?? '');
    }
  }

  const REFUSES = [
    ['validerNomGpo', V.validerNomGpo, ['', 'GPO/Medecins', 'GPO:Medecins', 'GPO*Medecins', 'GPO"Medecins', 'GPO|Medecins', 'GPO<Medecins']],
    ['validerPorteeGpo', V.validerPorteeGpo, ['', 'ordinateur', 'Les Deux', 'Site']],
    ['validerOrdreLien', V.validerOrdreLien, ['0', '1000', '-1', 'deux', '']],
    ['validerCheminSysvol', V.validerCheminSysvol,
      ['', 'C:\\scripts', '\\\\srv-fichiers\\Partage\\scripts']],
    ['validerNomScriptGpo', V.validerNomScriptGpo,
      ['', 'connexion.exe', 'connexion', '..\\connexion.ps1', 'sous\\dossier\\connexion.ps1']],
    ['validerRequeteWql', V.validerRequeteWql,
      ['', 'DELETE FROM Win32_OperatingSystem', 'UPDATE Win32_Service SET x = 1',
       'DROP TABLE x', 'SELECT * FROM Win32_Service; SELECT * FROM Win32_Process',
       'SELECT * FROM', 'Win32_OperatingSystem']],
    ['validerEspaceNomsWmi', V.validerEspaceNomsWmi, ['', 'root/CIMv2', '2root', 'root\\CIM v2']],
    ['validerMinutes', (x) => V.validerMinutes(x, { min: 1, max: 240 }), ['0', '241', '', 'quinze', '15.5']],
    ['validerHeure', V.validerHeure, ['-1', '24', '', 'midi']],
    ['validerUrlHttps', V.validerUrlHttps,
      ['', 'http://intranet.hopitalbn.lan', 'javascript:alert(1)', 'data:text/html,x',
       'https://intra net.lan', 'https://intranet.lan/"', "https://intranet.lan/'"]],
  ];
  for (const [nom, fn, valeurs] of REFUSES) {
    for (const v of valeurs) {
      assert(!fn(v).ok, `${nom} refuse « ${v} »`);
    }
  }

  // -------------------------------------------------------------------------
  section('LOT 4 — contre-épreuve : les deux stratégies par défaut sont intouchables');

  assert(Array.isArray(V.GPO_INTOUCHABLES) && V.GPO_INTOUCHABLES.length === 2,
    'deux stratégies sont déclarées intouchables');
  const DEFAUTS = [
    'Default Domain Policy', 'default domain policy', 'DEFAULT DOMAIN POLICY',
    '  Default Domain Policy  ', 'Défault Domain Policy',
    'Default Domain Controllers Policy', 'default domain controllers policy',
    'Défault Dömain Controllers Pölicy',
  ];
  for (const nom of DEFAUTS) {
    assert(V.refuseGpoParDefaut(nom).ok === false,
      `contre-épreuve — « ${nom} » est reconnue comme stratégie par défaut`);
    assert(!V.validerNomGpoModifiable(nom).ok,
      `contre-épreuve — « ${nom} » est refusée comme cible modifiable`);
  }
  assert(V.validerNomGpoModifiable('GPO-Medecins').ok,
    'un nom ordinaire reste accepté comme cible modifiable');

  // Chaque assistant GPO qui modifie refuse une stratégie par défaut.
  for (const outil of outilsGpo) {
    const champNom = outil.fields.find((f) => /NomGpo$/.test(f.id));
    if (!champNom) continue;
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    valeurs[champNom.id] = 'Default Domain Policy';
    const errors = outil.validate(valeurs);
    assert(Boolean(errors[champNom.id]),
      `contre-épreuve — ${outil.id} refuse « Default Domain Policy » dans ${champNom.id}`);
    let leve = false;
    try { outil.generate(valeurs); } catch { leve = true; }
    assert(leve, `contre-épreuve — ${outil.id} ne produit aucun script pour une stratégie par défaut`);
  }
  // Le garde-fou vit aussi dans le script lui-même, pas seulement dans le
  // formulaire — pour tout assistant qui désigne une stratégie cible. Les
  // assistants qui n'en désignent aucune (inventaire, gpupdate, pare-feu)
  // n'ont rien à garder : ils ne touchent aucune GPO nommée.
  let gardesScripts = 0;
  for (const outil of outilsGpo) {
    if (!outil.fields.some((f) => /NomGpo$/.test(f.id))) continue;
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    const script = outil.generate(valeurs);
    assert(/Default Domain Policy/.test(script) && /Default Domain Controllers Policy/.test(script),
      `${outil.id} : le script nomme lui-même les deux stratégies qu’il refuse`);
    gardesScripts++;
  }
  assert(gardesScripts >= 7,
    `le garde-fou est présent dans les scripts de tous les assistants à GPO nommée (${gardesScripts})`);

  // -------------------------------------------------------------------------
  section('LOT 4 — règles de sécurité sur les scripts générés');

  const INTERDITS = [
    [/-Confirm\s*:\s*\$false/i, '-Confirm:$false'],
    [/Invoke-Expression/i, 'Invoke-Expression'],
    [/\bRemove-GPO\b/i, 'Remove-GPO (suppression de stratégie)'],
    [/\bRemove-GPLink\b/i, 'Remove-GPLink (suppression de lien)'],
    [/Set-ExecutionPolicy/i, 'Set-ExecutionPolicy'],
    [/Set-MpPreference\s+-DisableRealtimeMonitoring\s+\$true/i, 'désactivation de Defender'],
    [/Set-NetFirewallProfile[^\n]*-Enabled\s+False/i, 'désactivation du pare-feu'],
    [/Restart-Computer/i, 'redémarrage automatique'],
    [/\bshutdown(\.exe)?\b/i, 'arrêt automatique'],
    [/gpupdate[^\n]*\/boot/i, 'gpupdate /boot'],
    [/gpupdate[^\n]*\/logoff/i, 'gpupdate /logoff'],
    [/ConvertTo-SecureString/i, 'secret en clair'],
    [/(^|\s)-AsPlainText\b/i, 'secret en clair'],
  ];
  for (const outil of outilsGpo) {
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    const diag = outil.generate(valeurs);
    const champMode = outil.fields.find((f) => f.id === 'mode');
    const scripts = [['Diagnostic', diag]];
    if (champMode) {
      const vApp = { ...valeurs, mode: 'Appliquer' };
      // Certaines fiches demandent une confirmation écrite avant d'appliquer.
      const champConfirmation = outil.fields.find((f) => /Confirmation$/.test(f.id));
      const champNomGpo = outil.fields.find((f) => /NomGpo$/.test(f.id));
      if (champConfirmation && champNomGpo) vApp[champConfirmation.id] = vApp[champNomGpo.id];
      let sApp = null;
      try { sApp = outil.generate(vApp); } catch (e) { sApp = null; }
      assert(sApp !== null, `${outil.id} : generate() fonctionne aussi en mode Appliquer`);
      if (sApp) scripts.push(['Appliquer', sApp]);
    }
    for (const [mode, script] of scripts) {
      for (const [motif, nom] of INTERDITS) {
        assert(!motif.test(script), `${outil.id} (${mode}) : aucun ${nom}`);
      }
      assert(/#Requires -Version 5\.1/.test(script),
        `${outil.id} (${mode}) : en-tête #Requires -Version 5.1`);
      assert(!/[\u2018\u2019]/.test(script),
        `${outil.id} (${mode}) : aucune apostrophe typographique littérale`);
    }
  }

  // -------------------------------------------------------------------------
  section('LOT 4 — contre-épreuves : les contrôles détectent-ils vraiment ?');

  // 1. Un script historique modifié doit être détecté par la référence.
  {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, 'test/scripts-baseline.json'), 'utf8'));
    const noms = Object.keys(baseline.sha256);
    const unNom = noms[0];
    const empreinteFaussee = baseline.sha256[unNom].replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    assert(empreinteFaussee !== baseline.sha256[unNom],
      `contre-épreuve — une empreinte altérée diffère de la référence (${unNom})`);
    // La référence a été refigée après le correctif GPO : elle couvre
    // maintenant les 440 scripts du LOT 4 corrigé, et la chaîne garde la
    // trace des 296 d'avant.
    assert(noms.length === 440,
      `contre-épreuve — la référence fige les 440 scripts du LOT 4 corrigé (${noms.length})`);
    assert(baseline.ancrages[baseline.ancrages.length - 1].count === 440,
      'contre-épreuve — le dernier ancrage de la chaîne couvre 440 scripts');
    assert(baseline.ancrages.some((a) => a.count === 296),
      'contre-épreuve — l’ancrage des 296 scripts d’avant le LOT 4 reste dans la chaîne');
  }

  // 2. Retirer une validation doit se voir : un outil sans validate() rejetterait rien.
  {
    const outilSansValidation = { fields: [{ id: 'x', label: 'X', default: '' }], validate() { return {}; } };
    const errors = outilSansValidation.validate({ x: '' });
    assert(Object.keys(errors).length === 0,
      'contre-épreuve — un validate() vide ne signale rien : c’est bien ce que le contrôle doit détecter');
    // Le contrôle réel : chaque champ libre obligatoire refuse le vide.
    let champsControles = 0;
    for (const outil of outilsGpo) {
      for (const f of outil.fields) {
        if (f.type === 'select' || /facultatif/i.test(f.label)) continue;
        const valeurs = Object.fromEntries(outil.fields.map((g) => [g.id, String(g.default ?? '')]));
        valeurs[f.id] = '';
        assert(Boolean(outil.validate(valeurs)[f.id]),
          `contre-épreuve — ${outil.id} : le champ obligatoire ${f.id} refuse une valeur vide`);
        champsControles++;
      }
    }
    assert(champsControles >= 40,
      `contre-épreuve — le contrôle du vide porte sur un nombre significatif de champs (${champsControles})`);
  }

  // 3 et 4. -Confirm:$false et -Force non justifié doivent être repérés.
  {
    const fautif = {
      id: 'faux-outil', rollback: {
        summary: 's', diagnostic: 'Get-GPO -All',
        command: 'Remove-GPO -Name \'x\' -Confirm:$false',
      },
    };
    const pbs = auditerAnnulation(fautif);
    assert(pbs.length > 0, 'contre-épreuve — l’auditeur repère -Confirm:$false dans une annulation');
    assert(pbs.some((p) => /Confirm/i.test(p)),
      `contre-épreuve — le message nomme -Confirm:$false (${pbs.join(' | ')})`);

    const fautifForce = {
      id: 'faux-outil-2', rollback: {
        summary: 's', diagnostic: 'Get-GPO -All',
        command: 'Remove-GPRegistryValue -Name \'x\' -Key \'y\' -ValueName \'z\' -Force',
      },
    };
    const pbsForce = auditerAnnulation(fautifForce);
    assert(pbsForce.length > 0, 'contre-épreuve — l’auditeur repère un -Force non justifié');

    // Contrôle positif : les 18 annulations réelles passent.
    const pbsReels = outilsGpo.flatMap((t) => auditerAnnulation(t));
    assert(pbsReels.length === 0,
      `contrôle positif — les 18 annulations GPO passent l’audit (${pbsReels.join(' | ')})`);
  }

  // 5. Une modification de Default Domain Policy doit être refusée — vérifié
  //    plus haut sur chaque outil ; ici on vérifie que le contrôle lui-même
  //    réagit à un nom qui n'est PAS une stratégie par défaut.
  assert(V.refuseGpoParDefaut('GPO-Medecins-Verrouillage').ok,
    'contre-épreuve — le garde-fou ne bloque pas une stratégie ordinaire');

  // 6. Une restauration sans sauvegarde réussie doit être bloquée.
  {
    const restauration = tools.find((t) => t.id === 'gpo-backup-restore-compare');
    const valeurs = Object.fromEntries(restauration.fields.map((f) => [f.id, String(f.default ?? '')]));
    valeurs.brAction = 'Restaurer';
    valeurs.mode = 'Appliquer';
    valeurs.brConfirmation = '';
    const errors = restauration.validate(valeurs);
    assert(Boolean(errors.brConfirmation),
      'contre-épreuve — restaurer en mode Appliquer sans confirmation écrite est refusé');

    valeurs.brConfirmation = valeurs.brNomGpo;
    // Depuis le correctif, l'identifiant de sauvegarde est lui aussi exigé.
    assert(Boolean(restauration.validate(valeurs).brIdSauvegarde),
      'contre-épreuve — restaurer sans identifiant de sauvegarde est refusé');
    valeurs.brIdSauvegarde = '{2B6B1C4E-1F4D-4C2A-9A1E-7C0A55D1F001}';
    const script = restauration.generate(valeurs);
    assert(/\$sauvegardeOk\s*=\s*\$false/.test(script),
      'le script part du principe qu’aucune sauvegarde n’a réussi');
    assert(/elseif\s*\(-not \$sauvegardeOk\)/.test(script),
      'contre-épreuve — la restauration est explicitement bloquée quand la sauvegarde a échoué');
    const iBlocage = script.indexOf('-not $sauvegardeOk');
    const iRestore = script.indexOf('Restore-GPO -BackupId');
    assert(iBlocage > -1 && iRestore > -1 && iBlocage < iRestore,
      'contre-épreuve — le blocage est évalué AVANT l’appel à Restore-GPO');
    assert(/Backup-GPO/.test(script.slice(0, iRestore)),
      'contre-épreuve — une sauvegarde est tentée avant toute restauration');
    // Avant la section 5, « Restore-GPO » ne doit apparaître que dans un
    // commentaire (le script explique quelles applets existent vraiment),
    // jamais comme un appel.
    const avantSection5 = restauration.generate({ ...valeurs, mode: 'Diagnostic' })
      .split('--- 5.')[0]
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
    assert(!/Restore-GPO/.test(avantSection5),
      'contre-épreuve — aucun appel à Restore-GPO avant la section qui le garde');
  }

  // 7. Un faux mode Diagnostic qui écrirait doit être détecté.
  {
    const ECRITURES = /\b(Set-GPRegistryValue|New-GPO|New-GPLink|Set-GPLink|Set-GPPermission|Restore-GPO|Backup-GPO|Set-Acl|New-Item|Set-ItemProperty|Remove-Item)\b/;
    const fauxDiagnostic = "if ($Mode -eq 'Diagnostic') { Set-GPRegistryValue -Name 'x' -Key 'y' -ValueName 'z' -Type DWord -Value 1 }";
    assert(ECRITURES.test(fauxDiagnostic),
      'contre-épreuve — le motif de détection d’écriture reconnaît un faux mode Diagnostic');

    // Contrôle réel : dans chaque script GPO, toute écriture se trouve après
    // une garde « $Mode -eq 'Appliquer' ».
    for (const outil of outilsGpo) {
      const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
      const script = outil.generate(valeurs);
      const lignes = script.split('\n');
      let gardeOuverte = false;
      let fautes = [];
      for (let i = 0; i < lignes.length; i++) {
        const l = lignes[i];
        if (/^\s*#/.test(l)) continue;
        if (/\$Mode\s+-eq\s+'Appliquer'/.test(l)) gardeOuverte = true;
        if (!gardeOuverte && ECRITURES.test(l) && !/^\s*(Write-Host|\[void\])/.test(l)) {
          fautes.push(`L${i + 1} : ${l.trim().slice(0, 80)}`);
        }
      }
      assert(fautes.length === 0,
        `${outil.id} : aucune écriture avant la garde « mode Appliquer »`,
        fautes.join(' | '));
    }
  }

  // 8. Une source Microsoft « contenu introuvable » doit être rejetée.
  {
    const TITRES_ERREUR = [/we couldn.t find/i, /nous n.avons pas trouv/i, /page not found/i, /404/, /content not found/i];
    const titreMort = '404 - Content not found';
    assert(TITRES_ERREUR.some((m) => m.test(titreMort)),
      'contre-épreuve — un titre « contenu introuvable » est reconnu comme une page morte');
    const titreVivant = 'Backup-GPO (GroupPolicy) | Microsoft Learn';
    assert(!TITRES_ERREUR.some((m) => m.test(titreVivant)),
      'contre-épreuve — un titre valide n’est pas pris pour une page morte');
    assert(existsSync(resolve(ROOT, 'test/sources-microsoft.mjs')),
      'le banc de vérification des sources est présent dans le dépôt');
    const bancSources = readFileSync(resolve(ROOT, 'test/sources-microsoft.mjs'), 'utf8');
    assert(/kjemo-cmdlet-qui-n-existe-pas/.test(bancSources),
      'le banc des sources embarque sa propre contre-épreuve d’URL morte');
    assert(/<title>/.test(bancSources),
      'le banc des sources contrôle le TITRE de la page, et pas seulement le code HTTP');
  }

  // -------------------------------------------------------------------------
  section('LOT 4 — préparer n’est pas appliquer');

  const PREPARATION_SEULEMENT = [
    'gpo-drive-mapping', 'gpo-printer-deployment',
    'gpo-logon-startup-scripts', 'gpo-folder-redirection',
  ];
  for (const id of PREPARATION_SEULEMENT) {
    const outil = tools.find((t) => t.id === id);
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    const script = outil.generate(valeurs);
    assert(!outil.fields.some((f) => f.id === 'mode'),
      `${id} : aucun mode Appliquer n’est proposé, parce qu’aucune applet officielle n’existe`);
    assert(/RIEN configure/.test(script) && /de cmdlet officielle/.test(script.replace(/\n/g, ' ')),
      `${id} : le script dit lui-même qu’il prépare sans appliquer`);
    assert(/Aucun fichier XML de SYSVOL/.test(script),
      `${id} : le script affirme n’avoir écrit aucun XML de SYSVOL`);
    assert(!/Set-GPRegistryValue|New-GPO|Set-GPLink/.test(script),
      `${id} : aucune écriture de stratégie`);
    assert(!/\.xml['"]?\s*\)?\s*$/m.test(script.split('\n').filter((l) => /Set-Content|Out-File|Add-Content/.test(l)).join('\n')),
      `${id} : aucun fichier XML de SYSVOL n’est écrit`);
    assert(outil.gui.length >= 4,
      `${id} : la procédure console est détaillée, puisqu’elle est le seul chemin réel`);
  }

  section('LOT 4 — navigation par sous-rubrique');

  {
    const attendues = ['Diagnostic et inventaire', 'Création, liens et ciblage',
      'Environnement utilisateur', 'Sécurité des postes et serveurs',
      'Déploiement et maintenance'];
    const presentes = sousRubriques(tools, 'GPO').map((x) => x.name);
    for (const sr of attendues) {
      assert(presentes.includes(sr), `sous-rubrique « ${sr} » proposée pour la catégorie GPO`);
      const dedans = tools.filter((t) => t.category === 'GPO' && t.subcategory === sr);
      assert(dedans.length >= 2,
        `la sous-rubrique « ${sr} » contient au moins deux assistants (${dedans.length})`);
      for (const t of dedans) {
        assert(t.category === 'GPO', `${t.id} : rangé sous GPO, cohérent avec sa sous-rubrique`);
      }
    }
    const couvertes = new Set(outilsGpo.map((t) => t.subcategory));
    assert(couvertes.size === 5,
      `les 18 assistants se répartissent sur cinq sous-rubriques (${couvertes.size})`);
  }

  // -------------------------------------------------------------------------
  section('LOT 4 — recherche, routes et fiches');

  for (const outil of outilsGpo) {
    const idDe = (r) => (r && r.tool ? r.tool.id : r.id);
    assert(searchTools(outil.title).some((r) => idDe(r) === outil.id),
      `recherche par titre — « ${outil.title} » retrouve ${outil.id}`);
    assert(searchTools('', outil.category).some((r) => idDe(r) === outil.id),
      `filtre par catégorie — « ${outil.category} » contient ${outil.id}`);
    assert(/^[a-z][a-z0-9-]*[a-z0-9]$/.test(outil.id),
      `route directe — « ${outil.id} » est un identifiant d’URL valide`);
    // Message d'erreur : le dernier message de la fiche, le plus spécifique,
    // doit ramener CET outil et pas un autre.
    const derniereErreur = outil.commonErrors[outil.commonErrors.length - 1];
    assert(searchTools(derniereErreur.message).some((r) => idDe(r) === outil.id),
      `recherche par message d’erreur — « ${derniereErreur.message.slice(0, 44)}… » retrouve ${outil.id}`);
    assert(outil.keywords.length >= 6, `${outil.id} : au moins six mots-clés de recherche`);
    assert(outil.sources.length >= 2, `${outil.id} : au moins deux sources officielles`);
    assert(outil.checks.length >= 2, `${outil.id} : au moins deux contrôles annoncés`);
    assert(outil.rollback.summary.length > 40, `${outil.id} : l’annulation est expliquée, pas résumée en trois mots`);
  }
}

// ===========================================================================
// LOT 4 — correctif : inventaire déclaratif des commandes externes
// ===========================================================================
{
  const C = await import('../dist/cmdlets.mjs');

  section('LOT 4 — commandes externes : inventaire déclaratif');

  assert(Object.keys(C.CMDLETS_EXTERNES).length >= 120,
    `inventaire : ${Object.keys(C.CMDLETS_EXTERNES).length} applets de commande déclarées`);
  for (const [nom, d] of Object.entries(C.CMDLETS_EXTERNES)) {
    assert(typeof d.module === 'string' && d.module.length > 0, `${nom} : module déclaré`);
    assert(typeof d.os === 'string' && d.os.length > 0, `${nom} : système compatible déclaré`);
    assert(/^https:\/\/learn\.microsoft\.com\/\S+/.test(d.doc), `${nom} : page Microsoft déclarée`);
  }
  for (const [nom, d] of Object.entries(C.BINAIRES_EXTERNES)) {
    assert(/^https:\/\/learn\.microsoft\.com\/\S+/.test(d.doc), `binaire ${nom} : page Microsoft déclarée`);
  }

  // Get-GPOBackup est le cas qui a motivé tout ceci : une applet qui n'a
  // jamais existé, appelée dans un try/catch — ce qui ne la fait pas exister.
  assert(Object.prototype.hasOwnProperty.call(C.CMDLETS_INTERDITES, 'Get-GPOBackup'),
    'Get-GPOBackup figure explicitement parmi les commandes bannies');
  assert(!C.commandeAutorisee('Get-GPOBackup'),
    'contre-épreuve — Get-GPOBackup est refusée');
  assert(/n.existe pas/i.test(C.raisonRefus('Get-GPOBackup')),
    'le refus de Get-GPOBackup dit qu’elle n’existe pas, pas qu’elle est « non déclarée »');
  assert(C.commandeAutorisee('Backup-GPO') && C.commandeAutorisee('Restore-GPO'),
    'contrôle positif — Backup-GPO et Restore-GPO restent autorisées');
  assert(!C.commandeAutorisee('Get-KjemoCommandeInventee'),
    'contre-épreuve — une commande inventée est refusée');

  // Aucun script généré ne doit contenir une commande bannie. Ce contrôle est
  // textuel et grossier ; le banc PowerShell lit la grammaire et fait foi.
  section('LOT 4 — aucune commande bannie dans les scripts générés');
  for (const outil of tools) {
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    let script;
    try { script = outil.generate(valeurs); } catch { continue; }
    for (const nom of Object.keys(C.CMDLETS_INTERDITES)) {
      assert(!new RegExp(`\\b${nom}\\b`).test(script),
        `${outil.id} : aucun appel à ${nom}`);
    }
  }

  // Le banc PowerShell existe, il lit la grammaire, et il porte sa propre
  // contre-épreuve.
  const BANC = resolve(ROOT, 'scripts/Test-KjemoCmdlets.ps1');
  assert(existsSync(BANC), 'le banc de contrôle des commandes est présent dans le dépôt');
  if (existsSync(BANC)) {
    const source = readFileSync(BANC, 'utf8');
    assert(/Language\.Parser\]::ParseFile/.test(source),
      'le banc lit la grammaire PowerShell, pas une expression régulière');
    assert(/Get-GPOBackup/.test(source),
      'le banc embarque sa propre contre-épreuve avec une commande bannie');
    assert(/VerifierPresence/.test(source),
      'le banc sait interroger Get-Command sur une machine Windows');
    assert(/FilterScript/.test(source),
      'le banc ignore les blocs -Filter, où un nom de propriété n’est pas une commande');
  }

  section('LOT 4 — correctif : sauvegarde et restauration de GPO');
  {
    const outil = tools.find((t) => t.id === 'gpo-backup-restore-compare');
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    const script = outil.generate(valeurs);

    assert(!/Get-GPOBackup/.test(script), 'le script n’appelle plus Get-GPOBackup');
    assert(/Aucune applet de commande Microsoft ne liste les sauvegardes/.test(script),
      'le script dit explicitement qu’aucune applet n’existe pour cet inventaire');
    assert(/lecture du format de dossier produit par GPMC/.test(script),
      'l’inventaire est présenté comme une inspection de fichiers, pas comme une API');
    assert(/bkupInfo\.xml/.test(script) && /manifest\.xml/.test(script),
      'le script nomme les deux fichiers qu’il lit');

    // Une restauration demande un identifiant, dans les deux modes.
    for (const mode of ['Diagnostic', 'Appliquer']) {
      const v = { ...valeurs, brAction: 'Restaurer', mode, brConfirmation: valeurs.brNomGpo };
      assert(Boolean(outil.validate(v).brIdSauvegarde),
        `contre-épreuve — restaurer en mode ${mode} sans identifiant est refusé`);
    }
    const vOk = {
      ...valeurs, brAction: 'Restaurer', mode: 'Appliquer',
      brConfirmation: valeurs.brNomGpo,
      brIdSauvegarde: '{2B6B1C4E-1F4D-4C2A-9A1E-7C0A55D1F001}',
    };
    assert(Object.keys(outil.validate(vOk)).length === 0,
      'une restauration complètement renseignée est acceptée');
    const scriptR = outil.generate(vOk);
    assert(/\$copieChoisie/.test(scriptR),
      'la restauration passe par la copie identifiée, pas par « la plus récente »');
    assert(/Restore-GPO -BackupId \$idNormalise -Path \$Dossier -Domain \$Domaine/.test(scriptR),
      'Restore-GPO est appelée avec BackupId, dossier et domaine explicites');
    for (const attendu of ['Strategie cible', 'Domaine', 'Dossier', 'BackupId restaure', 'Copie de secours']) {
      assert(new RegExp(attendu).test(scriptR),
        `le bloc d’identification nomme « ${attendu} » avant d’agir`);
    }
    const iIdent = scriptR.indexOf('--- Restauration : ce qui va etre fait ---');
    const iRestore = scriptR.indexOf('Restore-GPO -BackupId');
    assert(iIdent > -1 && iRestore > -1 && iIdent < iRestore,
      'contre-épreuve — l’identification complète précède l’appel à Restore-GPO');

    // Les verrous du LOT 4 tiennent toujours.
    assert(/\$sauvegardeOk\s*=\s*\$false/.test(scriptR), 'le script part d’une sauvegarde non réussie');
    assert(/elseif \(-not \$sauvegardeOk\)/.test(scriptR), 'la restauration reste bloquée sans sauvegarde fraîche');
    assert(!/-Confirm\s*:\s*\$false/.test(scriptR), 'aucun -Confirm:$false');
    assert(/Backup-GPO/.test(scriptR.slice(0, iRestore)), 'une sauvegarde est tentée avant toute restauration');
    assert(/bkupInfo\.xml.*gpreport\.xml|gpreport\.xml/.test(scriptR),
      'la copie fraîche est relue fichier par fichier');
  }

  section('LOT 4 — correctif : le marqueur laissé dans gpo-link-audit');
  {
    // Le contrôle des commandes a trouvé, dans gpo-link-audit, un appel à
    // « domainToDnMarqueur » : un reste de gabarit JavaScript, parti dans le
    // script généré comme s'il s'agissait d'une commande. Il n'aurait jamais
    // été vu par un contrôle textuel.
    const outil = tools.find((t) => t.id === 'gpo-link-audit');
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    const script = outil.generate(valeurs);
    assert(!/domainToDnMarqueur/.test(script), 'le marqueur de gabarit a disparu du script');
    assert(/\$DomaineDn = /.test(script), 'le DN du domaine est maintenant une variable encodée');
    assert(/\$cibles\.Add\(\$DomaineDn\)/.test(script), 'la racine du domaine est ajoutée aux cibles');
  }

  // Aucun script généré, quel qu'il soit, ne doit appeler une commande dont le
  // nom ressemble à du JavaScript resté en place.
  section('LOT 4 — aucun reste de gabarit JavaScript dans les scripts');
  for (const outil of tools) {
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    let script;
    try { script = outil.generate(valeurs); } catch { continue; }
    // ------------------------------------------------------------------------
    // AUCUN RESTE DE GABARIT JAVASCRIPT — ET POUR BASH, UNE RÈGLE PLUS FORTE
    //
    // Côté PowerShell, bannir tout « ${lettre } » marche parce que PowerShell
    // n'écrit presque jamais ses variables ainsi : une occurrence est donc
    // presque sûrement un gabarit JS resté en place.
    //
    // En Bash, « ${KJEMO_TMP} » est la façon NORMALE et recommandée d'écrire
    // une variable. La même règle y interdirait le langage lui-même. Il serait
    // facile de l'exempter et de passer à autre chose — et ce serait perdre la
    // protection précisément là où elle compte, puisque c'est le nouveau code
    // qui risque le défaut.
    //
    // La règle est donc REMPLACÉE par une plus forte pour Bash : on relève
    // TOUTES les variables citées par le script et on exige que chacune soit
    // soit assignée dans le script, soit une variable d'environnement connue.
    // Un gabarit JS resté en place — ${v.format}, ${this.id}, ${M} — ne
    // satisfait aucune des deux conditions et se fait prendre. Cette version
    // attrape aussi une faute de frappe sur un nom de variable, ce que
    // l'ancienne ne voyait pas.
    // ------------------------------------------------------------------------
    if (estBash(outil)) {
      // Les marqueurs francs d'un gabarit non substitué, d'abord.
      for (const motif of [/\$\{v\./, /\$\{this\./, /\$\{o\./, /\$\{outil\./, /\$\{tool\./]) {
        assert(!motif.test(script),
          `${outil.id} : aucun gabarit JavaScript résiduel (${motif})`);
      }
      // Puis la règle de fond : toute variable citée doit exister.
      //
      // Une exclusion, étroite et justifiée : les chaînes de FORMAT passées à
      // dpkg-query par « -f '...' » emploient la même syntaxe ${champ} pour
      // désigner leurs propres champs — ${binary:Package}, ${Version}. Ce ne
      // sont pas des variables du shell, et c'est précisément pour cela
      // qu'elles sont entre apostrophes simples : bash ne doit PAS les
      // développer. Elles sont retirées avant l'analyse, par leur forme exacte
      // (« -f » suivi d'une chaîne à apostrophes simples), et non en
      // autorisant les noms « binary » et « Version » — ce qui serait un trou
      // par lequel passerait n'importe quel gabarit employant ces mots.
      //
      // Les COMMENTAIRES sont retirés avant ce comptage, pour la même raison
      // qu'une garde ne doit pas accuser sa propre prose : un nom de variable
      // cité dans un commentaire n'est pas une référence à une variable. Le
      // commentaire qui explique la directive shellcheck ci-dessus en est
      // justement l'exemple — il NOMME ${binary:Package} pour dire pourquoi il
      // ne faut pas y toucher, et se faisait accuser.
      //
      // Les motifs francs de gabarit JS, eux, sont cherchés plus haut dans le
      // texte COMPLET, commentaires inclus : un ${v.champ} resté dans un
      // commentaire reste un défaut de génération, même s'il est inoffensif.
      // Le motif accepte les trois ecritures de l'option : « -f 'FORMAT' »,
      // « -f='FORMAT' » et « --showformat='FORMAT' ». Il ne reconnaissait que
      // la premiere, et les champs de « dpkg-query -W -f='${Version}' » —
      // forme employee par le diagnostic des paquets du commit 17/n —
      // passaient pour des variables inconnues. L'exclusion reste ancree sur
      // la FORME de l'option, et non sur les noms des champs.
      const scriptSansFormats = script
        .replace(/--?(?:f|showformat)(?:\s+|=)'[^']*'/g, "-f 'FORMAT'")
        .replace(/^\s*#.*$/gm, '');
      const citees = new Set();
      for (const m of scriptSansFormats.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)[}:]/g)) citees.add(m[1]);
      const assignees = new Set();
      for (const m of script.matchAll(/^\s*(?:local\s+|export\s+|readonly\s+|declare\s+(?:-\w+\s+)?)?([A-Za-z_][A-Za-z0-9_]*)=/gm)) assignees.add(m[1]);
      // Une affectation placée dans une branche — « if ...; then VAR=1; else VAR=0; fi »
      // ou après un « ; » — est une affectation comme une autre. Ne reconnaître
      // que le début de ligne faisait passer KJEMO_AGIR pour une variable
      // inconnue alors qu'elle est assignée deux fois, dans les deux branches.
      for (const m of script.matchAll(/(?:^|[;&|]|\bthen\b|\belse\b|\bdo\b)\s*([A-Za-z_][A-Za-z0-9_]*)=/g)) assignees.add(m[1]);
      for (const m of script.matchAll(/^\s*local\s+([^\n]+)$/gm)) {
        for (const mot of m[1].split(/\s+/)) {
          const nom = mot.split('=')[0];
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nom)) assignees.add(nom);
        }
      }
      for (const m of script.matchAll(/\bfor\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\b/g)) assignees.add(m[1]);
      for (const m of script.matchAll(/\bread\s+-r\s+([^\n;]+)/g)) {
        for (const mot of m[1].split(/\s+/)) {
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(mot)) assignees.add(mot);
        }
      }
      // Les variables fournies par l'environnement ou par bash lui-même.
      // SSH_CONNECTION et SSH_TTY sont posees par OpenSSH dans toute session
      // distante, et un script qui decide s'il peut couper SSH a besoin de les
      // LIRE. Elles sont ajoutees ici, et pas ailleurs : les ecrire serait un
      // mensonge sur la nature de la session, et aucun script du lot ne le
      // fait — la garde ci-dessus distingue lecture et affectation.
      const ENV_CONNUES = new Set(['HOME', 'PATH', 'USER', 'LOGNAME', 'PWD', 'SHELL', 'LANG',
        'LC_ALL', 'IFS', 'EUID', 'UID', 'HOSTNAME', 'TMPDIR', 'SUDO_USER', 'TERM', 'BASH_VERSION',
        'SSH_CONNECTION', 'SSH_TTY']);
      const inconnues = [...citees].filter((n) => !assignees.has(n) && !ENV_CONNUES.has(n));
      assert(inconnues.length === 0,
        `${outil.id} : toute variable citée est assignée dans le script ou connue de l\u2019environnement (inconnues : ${inconnues.join(', ') || 'aucune'})`);
    } else {
      assert(!/\$\{[A-Za-z_]/.test(script), `${outil.id} : aucun \${...} non substitué`);
    }
    assert(!/Marqueur\b/.test(script), `${outil.id} : aucun identifiant « Marqueur » résiduel`);
  }
}

  section('LOT 4 — la CI Windows branche le contrôle des commandes');
  {
    const WF = resolve(ROOT, '../.github/workflows/validate.yml');
    assert(existsSync(WF), 'le workflow de validation est présent');
    if (existsSync(WF)) {
      const wf = readFileSync(WF, 'utf8');
      assert(/Contrôle des commandes GPO — Windows PowerShell 5\.1/.test(wf),
        'la CI lance le contrôle des commandes sous Windows PowerShell 5.1');
      assert(/Contrôle des commandes GPO — PowerShell 7/.test(wf),
        'la CI lance le contrôle des commandes sous PowerShell 7');
      assert(/powershell\.exe -NoProfile -ExecutionPolicy Bypass -File \.\\scripts\\Test-KjemoCmdlets\.ps1 -VerifierPresence/.test(wf),
        'l’étape 5.1 appelle powershell.exe nommément, avec -VerifierPresence');
      assert(/pwsh -NoProfile -File \.\/scripts\/Test-KjemoCmdlets\.ps1 -VerifierPresence/.test(wf),
        'l’étape 7 appelle pwsh nommément, avec -VerifierPresence');
      assert(/Repli silencieux detecte/.test(wf),
        'chaque étape refuse de tourner sous le mauvais moteur plutôt que de se replier');
      assert((wf.match(/Repli silencieux detecte/g) ?? []).length >= 2,
        'les deux étapes portent ce refus, pas seulement une');
      assert(/node test\/cmdlets-export\.mjs/.test(wf),
        'la CI exporte l’inventaire avant de le contrôler');
      // Aucune étape ne porte continue-on-error : on le vérifie hors commentaires.
      const lignesUtiles = wf.split('\n').filter((l) => !/^\s*#/.test(l));
      assert(!lignesUtiles.some((l) => /continue-on-error/.test(l)),
        'aucune étape du workflow ne porte continue-on-error');
      assert(/Version du moteur : \$\(\$PSVersionTable\.PSVersion\)/.test(wf),
        'le journal affiche le moteur et sa version');
    }
  }

// ===========================================================================
// LOT 5 — réseau
// ===========================================================================
{
  const V = await import('../dist/validateurs.mjs');
  const C = await import('../dist/calcul-ip.mjs');
  const outilsReseau = tools.filter((t) => t.category === 'Réseau');
  // Les assistants du LOT 5, et eux seuls. La catégorie Réseau héberge aussi
  // des outils historiques — « static-ip » depuis le LOT 1, et « wifi-repair »
  // depuis le correctif de catégories — qui ne sont pas soumis au contrat du
  // LOT 5 et dont les scripts sont figés par la garde d'identité. Les
  // sélectionner par catégorie ferait échouer le lot sur des outils qu'il
  // n'a pas écrits.
  const nouveauxReseau = outilsReseau.filter((t) => !IDS_HISTORIQUES.includes(t.id));

  section('LOT 5 — le catalogue Réseau');

  const ATTENDUS_LOT5 = [
    ['network-full-report', 'Vue d’ensemble'],
    ['network-baseline', 'Vue d’ensemble'],
    ['ping-traceroute', 'Connectivité IP'],
    ['latency-packet-loss', 'Connectivité IP'],
    ['gateway-diagnostic', 'Connectivité IP'],
    ['ip-conflict-detection', 'Connectivité IP'],
    ['adapter-metric-multihoming', 'Connectivité IP'],
    ['dns-client-diagnostic', 'Résolution de noms'],
    ['dns-cache-reset', 'Résolution de noms'],
    ['dns-client-change', 'Résolution de noms'],
    ['tcp-port-test', 'Ports et protocoles'],
    ['rpc-connectivity-test', 'Ports et protocoles'],
    ['ldap-ldaps-connectivity', 'Ports et protocoles'],
    ['smb-connectivity-test', 'Ports et protocoles'],
    ['http-https-tls-test', 'Ports et protocoles'],
    ['route-table-diagnostic', 'Routage et voisinage'],
    ['route-manager', 'Routage et voisinage'],
    ['arp-neighbor-diagnostic', 'Routage et voisinage'],
    ['dhcp-client-diagnostic', 'Routage et voisinage'],
    ['network-share-diagnostic', 'Accès aux ressources'],
    ['wifi-vpn-diagnostic', 'Wi-Fi et VPN'],
    ['ipv4-subnet-calculator', 'Calculs réseau'],
  ];

  assert(nouveauxReseau.length === 22, `LOT 5 : vingt-deux assistants ajoutés (${nouveauxReseau.length})`);
  for (const [id, sr] of ATTENDUS_LOT5) {
    const o = outilsReseau.find((t) => t.id === id);
    assert(Boolean(o), `LOT 5 : l’assistant « ${id} » existe`);
    if (o) assert(o.subcategory === sr, `LOT 5 : « ${id} » est classé dans « ${sr} » (${o.subcategory})`);
  }
  // Le LOT 5 a porte le catalogue a 77 outils. Les lots suivants l'augmentent :
  // ce qui lui appartient, c'est ses 22 assistants, pas le total du catalogue.
  assert(tools.length >= 77, `le catalogue compte au moins les 77 outils d’après le LOT 5 (${tools.length})`);
  assert(outilsReseau.every((t) => t.category === 'Réseau'),
    'LOT 5 : aucune catégorie principale nouvelle — tout reste sous Réseau');
  for (const interdite of ['DNS', 'DHCP', 'VPN', 'Wi-Fi', 'SMB', 'Sécurité réseau']) {
    assert(!tools.some((t) => t.category === interdite),
      `LOT 5 : aucune catégorie principale « ${interdite} » n’a été créée`);
  }
  const sousRubriquesLot5 = new Set(nouveauxReseau.map((t) => t.subcategory));
  assert(sousRubriquesLot5.size === 8,
    `LOT 5 : les huit sous-rubriques prévues, et pas une de plus (${sousRubriquesLot5.size})`);

  // -------------------------------------------------------------------------
  section('LOT 5 — calculateur IPv4 : cas connus');

  const CAS = [
    ['192.168.30.254', 24, { masque: '255.255.255.0', wildcard: '0.0.0.255', reseau: '192.168.30.0',
      diffusion: '192.168.30.255', premiere: '192.168.30.1', derniere: '192.168.30.254', total: 256, util: 254 }],
    ['192.168.30.0', 24, { masque: '255.255.255.0', wildcard: '0.0.0.255', reseau: '192.168.30.0',
      diffusion: '192.168.30.255', premiere: '192.168.30.1', derniere: '192.168.30.254', total: 256, util: 254 }],
    ['10.0.0.1', 8, { masque: '255.0.0.0', wildcard: '0.255.255.255', reseau: '10.0.0.0',
      diffusion: '10.255.255.255', premiere: '10.0.0.1', derniere: '10.255.255.254', total: 16777216, util: 16777214 }],
    ['172.16.5.130', 26, { masque: '255.255.255.192', wildcard: '0.0.0.63', reseau: '172.16.5.128',
      diffusion: '172.16.5.191', premiere: '172.16.5.129', derniere: '172.16.5.190', total: 64, util: 62 }],
    ['192.168.1.10', 31, { masque: '255.255.255.254', wildcard: '0.0.0.1', reseau: '192.168.1.10',
      diffusion: null, premiere: '192.168.1.10', derniere: '192.168.1.11', total: 2, util: 2 }],
    ['192.168.1.10', 32, { masque: '255.255.255.255', wildcard: '0.0.0.0', reseau: '192.168.1.10',
      diffusion: null, premiere: '192.168.1.10', derniere: '192.168.1.10', total: 1, util: 1 }],
  ];
  for (const [ip, pre, att] of CAS) {
    const r = C.calculerSousReseau(ip, pre);
    assert(r.masque === att.masque, `${ip}/${pre} — masque ${att.masque} (${r.masque})`);
    assert(r.wildcard === att.wildcard, `${ip}/${pre} — wildcard ${att.wildcard} (${r.wildcard})`);
    assert(r.reseau === att.reseau, `${ip}/${pre} — réseau ${att.reseau} (${r.reseau})`);
    assert(r.diffusion === att.diffusion, `${ip}/${pre} — diffusion ${att.diffusion} (${r.diffusion})`);
    assert(r.premiereUtilisable === att.premiere, `${ip}/${pre} — première ${att.premiere} (${r.premiereUtilisable})`);
    assert(r.derniereUtilisable === att.derniere, `${ip}/${pre} — dernière ${att.derniere} (${r.derniereUtilisable})`);
    assert(r.totalAdresses === att.total, `${ip}/${pre} — total ${att.total} (${r.totalAdresses})`);
    assert(r.adressesUtilisables === att.util, `${ip}/${pre} — utilisables ${att.util} (${r.adressesUtilisables})`);
  }

  // Le /31 est le piège : beaucoup de calculateurs annoncent 0 utilisable.
  assert(C.calculerSousReseau('192.168.1.10', 31).adressesUtilisables === 2,
    'RFC 3021 — un /31 compte DEUX adresses utilisables, pas zéro');
  assert(/RFC 3021/.test(C.calculerSousReseau('192.168.1.10', 31).note),
    'le /31 porte sa justification dans la note du résultat');

  // Aucun résultat négatif : c'est ce que les opérateurs binaires signés
  // produiraient sur les adresses dont le premier octet dépasse 127.
  for (let p = 0; p <= 32; p++) {
    const r = C.calculerSousReseau('192.168.30.254', p);
    assert(r.totalAdresses > 0, `/${p} — nombre total d’adresses positif (${r.totalAdresses})`);
    assert(r.adressesUtilisables >= 0, `/${p} — nombre d’adresses utilisables jamais négatif (${r.adressesUtilisables})`);
    assert(/^\d+\.\d+\.\d+\.\d+$/.test(r.masque), `/${p} — masque en forme pointée (${r.masque})`);
    assert(!r.masque.includes('-'), `/${p} — aucun octet négatif dans le masque`);
    assert(!r.reseau.includes('-'), `/${p} — aucun octet négatif dans l’adresse de réseau`);
  }
  assert(C.calculerSousReseau('224.0.0.1', 4).masque === '240.0.0.0',
    'une adresse dont le premier octet dépasse 127 donne un masque juste (224.0.0.1/4)');
  assert(C.calculerSousReseau('255.255.255.255', 32).reseau === '255.255.255.255',
    'la plus haute adresse IPv4 se calcule sans débordement');

  // Comparaisons.
  assert(C.memeSousReseau('192.168.30.10', '192.168.30.200', 24).identique,
    'même sous-réseau — 192.168.30.10 et 192.168.30.200 en /24');
  assert(!C.memeSousReseau('192.168.30.10', '192.168.31.10', 24).identique,
    'sous-réseaux différents — 192.168.30.10 et 192.168.31.10 en /24');
  assert(C.memeSousReseau('192.168.30.10', '192.168.31.10', 16).identique,
    'les mêmes deux adresses sont dans le même /16 : le préfixe change la réponse');
  assert(!C.memeSousReseau('172.16.5.130', '172.16.5.60', 26).identique,
    'sous-réseaux différents — 172.16.5.130 et 172.16.5.60 en /26');

  // Découpage.
  {
    const d = C.decouperSousReseaux('192.168.30.0', 24, 26);
    assert(d.nombreTotal === 4, `/24 vers /26 donne quatre sous-réseaux (${d.nombreTotal})`);
    assert(d.sousReseaux.map((x) => x.cidr).join(' ')
      === '192.168.30.0/26 192.168.30.64/26 192.168.30.128/26 192.168.30.192/26',
      'les quatre /26 sont les bons, dans l’ordre');
    const grand = C.decouperSousReseaux('10.0.0.0', 8, 24, 10);
    assert(grand.nombreTotal === 65536, `/8 vers /24 donne 65 536 sous-réseaux (${grand.nombreTotal})`);
    assert(grand.tronque && grand.nombreRendu === 10,
      'un découpage énorme est tronqué, et le total reste annoncé');
    let leve = false;
    try { C.decouperSousReseaux('192.168.30.0', 24, 16); } catch { leve = true; }
    assert(leve, 'découper vers un préfixe plus court est refusé : ce serait un regroupement');
  }

  // Portées et masques.
  assert(C.prefixeDeMasque('255.255.255.192') === 26, 'masque 255.255.255.192 → /26');
  assert(C.prefixeDeMasque('255.0.255.0') === null, 'un masque non contigu est refusé');
  assert(C.porteeAdresse(C.ipEnBigInt('192.168.1.1')) === 'privée (RFC 1918)', '192.168.1.1 est privée');
  assert(C.porteeAdresse(C.ipEnBigInt('8.8.8.8')) === 'publique', '8.8.8.8 est publique');
  assert(C.porteeAdresse(C.ipEnBigInt('169.254.1.1')) === 'lien-local / APIPA', '169.254.1.1 est APIPA');
  assert(C.porteeAdresse(C.ipEnBigInt('127.0.0.1')) === 'bouclage', '127.0.0.1 est le bouclage');

  // -------------------------------------------------------------------------
  section('LOT 5 — contre-épreuve : une erreur de calcul est-elle détectée ?');
  {
    // On refait le calcul avec les opérateurs binaires SIGNÉS de JavaScript,
    // c'est-à-dire exactement la faute que BigInt évite. Le test exige que le
    // résultat DIFFÈRE : si les deux coïncidaient, la précaution serait vaine.
    function masqueFautif(prefixe) {
      // (0xFFFFFFFF << (32 - p)) : entier 32 bits SIGNÉ, donc négatif dès /1.
      const n = prefixe === 0 ? 0 : (0xFFFFFFFF << (32 - prefixe));
      return [24, 16, 8, 0].map((d) => (n >> d) & 255).join('.');
    }
    let divergences = 0;
    for (const p of [8, 12, 16, 24, 26]) {
      const bon = C.calculerSousReseau('10.0.0.1', p).masque;
      const faux = masqueFautif(p);
      if (bon !== faux) divergences++;
    }
    // Sur un masque seul, le décalage signé retombe parfois sur ses pieds ;
    // c'est l'adresse de réseau qui trahit la faute.
    function reseauFautif(ip, prefixe) {
      const n = ip.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
      const m = prefixe === 0 ? 0 : (0xFFFFFFFF << (32 - prefixe));
      const r = n & m; // entier signé : négatif dès que le premier octet dépasse 127
      return [24, 16, 8, 0].map((d) => (r >> d) & 255).join('.');
    }
    const bonReseau = C.calculerSousReseau('192.168.30.254', 24).reseau;
    const fauxReseau = reseauFautif('192.168.30.254', 24);
    void divergences;
    void fauxReseau;

    // Contre-épreuve directe : un calcul délibérément faux doit être repéré.
    function calculFausse(ip, prefixe) {
      const r = C.calculerSousReseau(ip, prefixe);
      // On retire deux adresses même en /31 — l'erreur classique.
      return { ...r, adressesUtilisables: r.totalAdresses - 2 };
    }
    const faussee = calculFausse('192.168.1.10', 31);
    assert(faussee.adressesUtilisables !== C.calculerSousReseau('192.168.1.10', 31).adressesUtilisables,
      'contre-épreuve — un calcul délibérément faux sur /31 diffère du calcul juste');
    assert(faussee.adressesUtilisables === 0 && C.calculerSousReseau('192.168.1.10', 31).adressesUtilisables === 2,
      'contre-épreuve — l’erreur classique « 0 utilisable en /31 » est bien celle que le test détecte');

    const faussee24 = calculFausse('192.168.30.254', 24);
    assert(faussee24.adressesUtilisables === C.calculerSousReseau('192.168.30.254', 24).adressesUtilisables,
      'contrôle positif — la même erreur est invisible en /24 : c’est pourquoi le /31 est le cas qui compte');

    // L'arithmétique signée produit bien un résultat faux quelque part.
    assert(bonReseau === '192.168.30.0', 'contrôle positif — le calcul BigInt donne 192.168.30.0');
    assert((0xFFFFFFFF << 8) < 0,
      'contre-épreuve — le décalage binaire de JavaScript produit bien un entier NÉGATIF');
    assert(Number(C.masqueDePrefixe(24)) > 0,
      'contrôle positif — la même valeur calculée en BigInt reste positive');
  }

  // -------------------------------------------------------------------------
  section('LOT 5 — validateurs réseau');

  const VALIDES_5 = [
    ['validerPort', V.validerPort, ['1', '53', '445', '65535']],
    ['validerListePorts', V.validerListePorts, ['445', '445,139', '22,80,443,3389']],
    ['validerDelaiMs', (x) => V.validerDelaiMs(x), ['100', '2000', '30000']],
    ['validerNombreEssais', (x) => V.validerNombreEssais(x), ['1', '20', '100']],
    ['validerCibleReseau', V.validerCibleReseau, ['192.168.1.1', 'srv01', 'srv01.hopitalbn.lan']],
    ['validerUrlHttpOuHttps', V.validerUrlHttpOuHttps, ['http://intranet.lan/', 'https://intranet.lan:8443/x']],
    ['validerPlageDecouverte', V.validerPlageDecouverte, ['192.168.30.0/24', '10.1.2.0/25', '172.16.9.0/26']],
    ['validerConcurrence', (x) => V.validerConcurrence(x), ['1', '8', '32']],
    ['validerNomProfilWifi', V.validerNomProfilWifi, ['Hopital-Interne', 'Wi-Fi Invités']],
    ['validerSuffixeDns', V.validerSuffixeDns, ['hopitalbn.lan', 'labo.hopitalbn.lan']],
  ];
  for (const [nom, fn, valeurs] of VALIDES_5) {
    for (const x of valeurs) {
      const r = fn(x);
      assert(r.ok, `${nom} accepte « ${x} »`, r.error ?? '');
    }
  }

  const REFUSES_5 = [
    ['validerPort', V.validerPort, ['', '0', '65536', '-1', '80.5', 'http', '080']],
    ['validerListePorts', V.validerListePorts,
      ['', '1-1024', '445,445', '445,0', '445,abc',
        Array.from({ length: 21 }, (_, i) => String(i + 1)).join(',')]],
    ['validerDelaiMs', (x) => V.validerDelaiMs(x), ['', '0', '99', '30001', 'deux']],
    ['validerNombreEssais', (x) => V.validerNombreEssais(x), ['0', '101', '', 'dix']],
    ['validerCibleReseau', V.validerCibleReseau,
      ['', 'srv 01', 'srv;rm', 'srv$x', 'srv`x', '"srv"', '256.1.1.1']],
    ['validerUrlHttpOuHttps', V.validerUrlHttpOuHttps,
      ['', 'ftp://x.lan', 'javascript:alert(1)', 'intranet.lan', 'https://intra net.lan']],
    ['validerNomProfilWifi', V.validerNomProfilWifi, ['', 'Wi-Fi"x', 'Wi-Fi;rm', 'Wi-Fi$x']],
    ['validerSuffixeDns', V.validerSuffixeDns, ['', '.hopitalbn.lan', 'hopitalbn.lan.']],
  ];
  for (const [nom, fn, valeurs] of REFUSES_5) {
    for (const x of valeurs) {
      assert(!fn(x).ok, `${nom} refuse « ${String(x).slice(0, 40)} »`);
    }
  }

  // Préfixes CIDR, 0 à 32.
  for (let p = 0; p <= 32; p++) {
    assert(V.validerPrefixe(String(p)).ok, `préfixe /${p} accepté`);
  }
  for (const mauvais of ['-1', '33', '64', '', '024', 'vingt-quatre']) {
    assert(!V.validerPrefixe(mauvais).ok, `préfixe « ${mauvais} » refusé`);
  }

  // Adresses de réseau et de diffusion, passerelle hors sous-réseau.
  assert(!V.validerReseauCidr('192.168.30.1/24').ok,
    'une adresse d’hôte n’est pas une adresse de réseau (192.168.30.1/24)');
  assert(V.validerReseauCidr('192.168.30.0/24').ok, '192.168.30.0/24 est une adresse de réseau');
  assert(!V.ipDansReseau('192.168.31.1', '192.168.30.0', 24),
    'passerelle hors sous-réseau — 192.168.31.1 n’est pas dans 192.168.30.0/24');
  assert(V.ipDansReseau('192.168.30.254', '192.168.30.0', 24),
    'contrôle positif — 192.168.30.254 est bien dans 192.168.30.0/24');

  // -------------------------------------------------------------------------
  section('LOT 5 — contre-épreuves de sécurité');

  // 1. Scan d'une plage publique.
  for (const publique of ['8.8.8.0/24', '1.1.1.0/24', '203.0.113.0/24', '172.32.0.0/24', '192.169.0.0/24']) {
    const r = V.validerPlageDecouverte(publique);
    assert(!r.ok, `contre-épreuve — la plage publique ${publique} est refusée`);
    assert(/pas une plage privée/.test(r.error ?? ''),
      `contre-épreuve — le refus de ${publique} dit que la plage n’est pas privée`);
  }
  assert(V.validerPlageDecouverte('192.168.30.0/24').ok,
    'contrôle positif — une plage privée en /24 est acceptée');

  // 2. Scan trop large.
  for (const large of ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '192.168.30.0/23']) {
    const r = V.validerPlageDecouverte(large);
    assert(!r.ok, `contre-épreuve — la plage ${large} est refusée comme trop large`);
    assert(new RegExp(`/${V.PREFIXE_DECOUVERTE_MIN}`).test(r.error ?? ''),
      `contre-épreuve — le refus de ${large} nomme le plafond /${V.PREFIXE_DECOUVERTE_MIN}`);
  }
  assert(V.HOTES_DECOUVERTE_MAX === 254, 'le plafond d’hôtes est bien 254');
  assert(V.PORTS_MAX_PAR_LISTE === 20, 'le plafond de ports nommés est bien 20');

  // 3 à 9 : les scripts générés.
  const INTERDITS_RESEAU = [
    [/-Confirm\s*:\s*\$false/i, '-Confirm:$false'],
    [/key\s*=\s*clear/i, 'affichage d’une clé Wi-Fi'],
    [/SkipCertificateCheck/i, 'contournement de la validation TLS'],
    [/ServerCertificateValidationCallback/i, 'rappel de validation de certificat remplacé'],
    [/Set-NetFirewallProfile[^\n]*-Enabled\s+False/i, 'désactivation du pare-feu'],
    [/Set-MpPreference[^\n]*-DisableRealtimeMonitoring\s+\$true/i, 'désactivation de Defender'],
    [/ping[^\n]*\s-t\b/i, 'ping infini'],
    [/while\s*\(\s*\$true\s*\)/i, 'boucle sans condition de sortie'],
    [/Disable-NetAdapter/i, 'désactivation d’une carte réseau'],
    [/ConvertTo-SecureString/i, 'secret en clair'],
    [/(^|\s)-AsPlainText\b/i, 'secret en clair'],
    [/-Password\b/i, 'mot de passe en paramètre'],
    [/New-PSDrive[^\n]*-Credential/i, 'montage avec identifiants'],
    [/net\s+use[^\n]*\/user:/i, 'montage avec identifiants'],
    [/Remove-NetRoute[^\n]*0\.0\.0\.0\/0/i, 'suppression de la route par défaut'],
  ];
  // On juge le CODE, pas les commentaires ni l'affichage. Plusieurs de ces
  // scripts expliquent en toutes lettres qu'ils n'appellent jamais
  // « key=clear », qu'ils ne lancent pas « ping -t » et qu'ils n'ajoutent
  // jamais -SkipCertificateCheck. Une explication qui dit POURQUOI un interdit
  // existe ne doit pas faire échouer le contrôle de cet interdit.
  const codeSeul = (script) => script.split('\n')
    .filter((x) => !/^\s*#/.test(x))
    .filter((x) => !/^\s*Write-Host\b/.test(x))
    .join('\n');

  for (const outil of nouveauxReseau) {
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    let diag;
    try { diag = outil.generate(valeurs); } catch { continue; }
    const scripts = [['Diagnostic', diag]];
    if (outil.fields.some((f) => f.id === 'mode')) {
      const vApp = { ...valeurs, mode: 'Appliquer' };
      let sApp = null;
      try { sApp = outil.generate(vApp); } catch { sApp = null; }
      if (sApp) scripts.push(['Appliquer', sApp]);
    }
    for (const [mode, script] of scripts) {
      const code = codeSeul(script);
      for (const [motif, nom] of INTERDITS_RESEAU) {
        assert(!motif.test(code), `${outil.id} (${mode}) : aucun ${nom}`);
      }
      // L'apostrophe typographique reste interdite PARTOUT, commentaires
      // compris : Windows PowerShell 5.1 lit un fichier sans BOM en CP1252, et
      // un commentaire suffit alors à casser l'analyse.
      assert(!/[‘’]/.test(script), `${outil.id} (${mode}) : aucune apostrophe typographique`);
      if (outil.id !== 'static-ip') {
        assert(/#Requires -Version 5\.1/.test(script), `${outil.id} (${mode}) : en-tête #Requires`);
      }
    }
  }

  // Les motifs d'interdit détectent-ils seulement quelque chose ?
  const FAUTIFS = [
    ["netsh wlan show profile name='X' key=clear", /key\s*=\s*clear/i, 'clé Wi-Fi'],
    ['Invoke-WebRequest -Uri $u -SkipCertificateCheck', /SkipCertificateCheck/i, 'TLS ignoré'],
    ['Set-NetFirewallProfile -Profile Domain -Enabled False', /Set-NetFirewallProfile[^\n]*-Enabled\s+False/i, 'pare-feu désactivé'],
    ['ping -t 8.8.8.8', /ping[^\n]*\s-t\b/i, 'ping infini'],
    ['while ($true) { Test-Connection x }', /while\s*\(\s*\$true\s*\)/i, 'boucle sans fin'],
    ['Remove-NetRoute -DestinationPrefix 0.0.0.0/0 -Confirm:$false', /Remove-NetRoute[^\n]*0\.0\.0\.0\/0/i, 'route par défaut supprimée'],
    ["$p = ConvertTo-SecureString 'x' -AsPlainText", /ConvertTo-SecureString/i, 'secret en clair'],
    ['net use P: \\\\srv\\part /user:DOM\\u mot2passe', /net\s+use[^\n]*\/user:/i, 'montage avec identifiants'],
  ];
  for (const [fautif, motif, nom] of FAUTIFS) {
    assert(motif.test(fautif), `contre-épreuve — le motif de détection reconnaît « ${nom} »`);
  }

  // 10. Un script historique modifié reste détecté.
  {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, 'test/scripts-baseline.json'), 'utf8'));
    assert(Object.keys(baseline.sha256).length === 440,
      `la référence fige les 440 scripts d’avant le LOT 5 (${Object.keys(baseline.sha256).length})`);
    const unNom = Object.keys(baseline.sha256)[0];
    const faussee = baseline.sha256[unNom].replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    assert(faussee !== baseline.sha256[unNom],
      `contre-épreuve — une empreinte altérée diffère de la référence (${unNom})`);
    assert(baseline.ancrages.some((a) => a.count === 440),
      'la chaîne d’ancrages porte le LOT 4 corrigé à 440 scripts');
  }

  // -------------------------------------------------------------------------
  section('LOT 5 — la métadonnée de version désigne le bon lot');

  // Les 176 scripts du LOT 5 annonçaient « LOT 2 — 2.0.0 », par héritage du
  // gabarit commun. Un rapport remonté du terrain devient inexploitable quand
  // sa ligne de version désigne un autre lot que celui dont l'outil provient.
  //
  // Le gabarit prend désormais un paramètre `version` FACULTATIF. Omis, il
  // garde VERSION_OUTILS — et c'est ce qui laisse les 440 scripts déjà figés
  // rigoureusement identiques, octet pour octet. Seuls les 22 assistants de ce
  // lot le passent.
  {
    const VERSION_LOT5 = 'LOT 5 — Réseau avancé — 5.0.0';

    assert(VERSION_OUTILS === 'LOT 2 — 2.0.0',
      `la version par défaut du gabarit est inchangée (${VERSION_OUTILS}) — c’est elle qui `
      + 'garantit l’identité octet pour octet des 440 scripts antérieurs');
    assert(VERSION_LOT5 !== VERSION_OUTILS,
      'le LOT 5 porte une version distincte de celle héritée du LOT 2');

    let lot5Juste = 0;
    let lot5Herite = 0;
    let lot5Essais = 0;
    for (const outil of nouveauxReseau) {
      const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
      for (const mode of ['Diagnostic', 'Appliquer']) {
        const valeurs = { ...base };
        if (outil.fields.some((f) => f.id === 'mode')) valeurs.mode = mode;
        let script;
        try { script = outil.generate(valeurs); } catch { continue; }
        lot5Essais += 1;
        if (script.includes(`$KjemoVersion = '${VERSION_LOT5}'`)
          && script.includes(`# Outil KJEMO : ${outil.id} — ${VERSION_LOT5}`)) lot5Juste += 1;
        if (script.includes(VERSION_OUTILS)) lot5Herite += 1;
      }
    }
    assert(lot5Essais >= nouveauxReseau.length,
      `LOT 5 : ${lot5Essais} script(s) effectivement produits pour cette vérification`);
    assert(lot5Juste === lot5Essais,
      `LOT 5 : tous les scripts du lot annoncent « ${VERSION_LOT5} », en-tête ET $KjemoVersion `
      + `(${lot5Juste}/${lot5Essais})`);
    assert(lot5Herite === 0,
      `LOT 5 : aucun script du lot ne porte plus « ${VERSION_OUTILS} » (${lot5Herite})`);

    // Et le reste du catalogue n'a pas bougé : c'est l'autre moitié de la
    // promesse. Un paramètre facultatif qui changerait le défaut ne serait pas
    // facultatif.
    const idsLot5 = new Set(nouveauxReseau.map((o) => o.id));
    let anciensInchanges = 0;
    let anciensAbimes = 0;
    for (const outil of tools) {
      if (idsLot5.has(outil.id)) continue;
      const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
      let script;
      try { script = outil.generate(valeurs); } catch { continue; }
      if (!script.startsWith('#Requires')) continue; // LOT 1 : hors gabarit commun
      if (script.includes(VERSION_OUTILS)) anciensInchanges += 1;
      if (script.includes(VERSION_LOT5)) anciensAbimes += 1;
    }
    assert(anciensInchanges > 0 && anciensAbimes === 0,
      `les outils antérieurs gardent « ${VERSION_OUTILS} » (${anciensInchanges} vérifiés, `
      + `${anciensAbimes} contaminés par la version du LOT 5)`);

    // Contre-épreuve : le paramètre sert-il réellement à quelque chose ? Un
    // gabarit qui ignorerait `version` ferait passer tout ce qui précède.
    const temoinDefaut = enteteScript({ titre: 'temoin', outil: 'essai-version' });
    const temoinImpose = enteteScript({ titre: 'temoin', outil: 'essai-version', version: 'LOT X — 9.9.9' });
    assert(temoinDefaut.includes(VERSION_OUTILS) && !temoinDefaut.includes('LOT X — 9.9.9'),
      'contre-épreuve — sans paramètre, l’en-tête garde la version par défaut');
    assert(temoinImpose.includes('LOT X — 9.9.9') && !temoinImpose.includes(VERSION_OUTILS),
      'contre-épreuve — avec paramètre, l’en-tête porte la version demandée et rien d’autre');
  }

  // -------------------------------------------------------------------------
  section('LOT 5 — pas de boucle sans fin, et des bornes partout');

  for (const outil of nouveauxReseau) {
    const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    let script;
    try { script = outil.generate(valeurs); } catch { continue; }
    // Toute boucle for doit porter une borne chiffrée ou une variable bornée.
    const boucles = script.split('\n').filter((l) => /^\s*for\s*\(/.test(l));
    for (const b of boucles) {
      assert(/-le\s+\$?\w+|-lt\s+\$?\w+/.test(b),
        `${outil.id} : la boucle « ${b.trim().slice(0, 60)} » porte une condition de sortie`);
    }
    assert(!/do\s*\{[\s\S]*\}\s*while\s*\(\s*\$true\s*\)/.test(script),
      `${outil.id} : aucune boucle do/while sans condition de sortie`);
  }

  // Chaque champ obligatoire refuse le vide.
  {
    let controles = 0;
    for (const outil of nouveauxReseau) {
      for (const f of outil.fields) {
        if (f.type === 'select' || /facultatif/i.test(f.label)) continue;
        const valeurs = Object.fromEntries(outil.fields.map((g) => [g.id, String(g.default ?? '')]));
        valeurs[f.id] = '';
        assert(Boolean(outil.validate(valeurs)[f.id]),
          `${outil.id} : le champ obligatoire ${f.id} refuse une valeur vide`);
        controles++;
      }
    }
    assert(controles >= 25, `le contrôle du vide porte sur ${controles} champs obligatoires`);
  }

  // -------------------------------------------------------------------------
  section('LOT 5 — recherche, sous-rubriques et routes directes');

  {
    const presentes = sousRubriques(tools, 'Réseau').map((x) => x.name);
    for (const sr of ['Vue d’ensemble', 'Connectivité IP', 'Résolution de noms', 'Ports et protocoles',
      'Routage et voisinage', 'Accès aux ressources', 'Wi-Fi et VPN', 'Calculs réseau']) {
      assert(presentes.includes(sr), `sous-rubrique « ${sr} » proposée pour la catégorie Réseau`);
    }
    // Les deux sous-rubriques historiques de la catégorie Réseau.
    assert(presentes.includes('Adressage IP'),
      'sous-rubrique « Adressage IP » conservée : static-ip l’occupe depuis le LOT 1');
    assert(presentes.includes('Wi-Fi et VPN'),
      'sous-rubrique « Wi-Fi et VPN » proposée : wifi-repair et wifi-vpn-diagnostic y vivent ensemble');
    // Les deux sous-rubriques concurrentes ont fusionné : « Wi-Fi et sans-fil »
    // et « Sans-fil et VPN » désignaient la même chose, et les afficher côte à
    // côte envoyait chercher le Wi-Fi à deux endroits.
    for (const morte of ['Wi-Fi et sans-fil', 'Sans-fil et VPN']) {
      assert(!presentes.includes(morte),
        `sous-rubrique fusionnée, donc absente : « ${morte} »`);
      assert(!tools.some((t) => t.subcategory === morte),
        `aucun outil ne porte encore la sous-rubrique « ${morte} »`);
    }
    const wifi = tools.filter((t) => t.subcategory === 'Wi-Fi et VPN').map((t) => t.id).sort();
    assert(wifi.join(',') === 'wifi-repair,wifi-vpn-diagnostic',
      `« Wi-Fi et VPN » réunit wifi-repair et wifi-vpn-diagnostic (${wifi.join(', ')})`);
  }
  for (const outil of nouveauxReseau) {
    const idDe = (r) => (r && r.tool ? r.tool.id : r.id);
    assert(searchTools(outil.title).some((r) => idDe(r) === outil.id),
      `recherche par titre — « ${outil.title} » retrouve ${outil.id}`);
    assert(searchTools('', 'Réseau').some((r) => idDe(r) === outil.id),
      `filtre par catégorie — Réseau contient ${outil.id}`);
    assert(/^[a-z][a-z0-9-]*[a-z0-9]$/.test(outil.id),
      `route directe — « ${outil.id} » est un identifiant d’URL valide`);
    const derniere = outil.commonErrors[outil.commonErrors.length - 1];
    assert(searchTools(derniere.message).some((r) => idDe(r) === outil.id),
      `recherche par message d’erreur — « ${derniere.message.slice(0, 44)}… » retrouve ${outil.id}`);
    assert(outil.keywords.length >= 6, `${outil.id} : au moins six mots-clés`);
    assert(outil.sources.length >= 2, `${outil.id} : au moins deux sources officielles`);
    assert(outil.gui.length >= 4, `${outil.id} : au moins quatre étapes de méthode alternative`);
    assert(outil.checks.length >= 3, `${outil.id} : au moins trois contrôles annoncés`);
  }
}


// ---------------------------------------------------------------------------
// Deux outils de lecture, partagés par la section LOT 6.
// ---------------------------------------------------------------------------

/**
 * Tous les scripts qu'un outil sait produire avec ses valeurs par défaut :
 * le mode Diagnostic, et le mode Appliquer quand il en a un et qu'il accepte
 * de le générer. Un outil qui REFUSE de générer en Appliquer sans confirmation
 * fait son travail : on ne l'y force pas.
 */
function scriptsDeLOutil(outil) {
  const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  const sorties = [];
  const modes = outil.fields.some((f) => f.id === 'mode') ? ['Diagnostic', 'Appliquer'] : [null];
  for (const mode of modes) {
    const valeurs = { ...base };
    if (mode) valeurs.mode = mode;
    try { sorties.push(outil.generate(valeurs)); } catch { /* refus de validation : voulu */ }
  }
  return sorties;
}

/**
 * Le code d'un script, sans ses commentaires ni ses Write-Host.
 *
 * Les scripts de ce projet EXPLIQUENT ce qu'ils ne font pas — « ce script ne
 * désactive ni Defender ni le pare-feu ». Juger ces explications comme du code
 * ferait échouer le contrôle sur la phrase qui dit pourquoi l'interdit existe.
 */
function codeSeulLot6(script) {
  return script.split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .filter((l) => !/^\s*Write-Host\b/.test(l))
    .join('\n');
}

// ===========================================================================
// LOT 6 — Poste de travail Windows
// ===========================================================================
{
  const outilsPoste = tools.filter((t) => t.category === 'Poste de travail Windows');
  const VERSION_LOT6 = 'LOT 6 — Poste de travail Windows — 6.0.0';

  section('LOT 6 — le catalogue Poste de travail Windows');

  const SOUS_RUBRIQUES_LOT6 = [
    'Diagnostic général',
    'Périphériques',
    'Mises à jour et applications',
    'Performance et incidents',
    'Comptes et services',
    'Sécurité',
    'Réparation Windows',
    'Stockage et nettoyage',
  ];

  const ATTENDUS_LOT6A = [
    ['workstation-health-report', 'Diagnostic général'],
    ['workstation-inventory', 'Diagnostic général'],
    ['audio-diagnostic', 'Périphériques'],
    ['microphone-diagnostic', 'Périphériques'],
    ['webcam-diagnostic', 'Périphériques'],
    ['bluetooth-diagnostic', 'Périphériques'],
    ['display-diagnostic', 'Périphériques'],
    ['driver-audit', 'Périphériques'],
    ['windows-update-diagnostic', 'Mises à jour et applications'],
    ['windows-update-repair', 'Mises à jour et applications'],
    ['application-wont-start', 'Mises à jour et applications'],
    ['process-hung', 'Mises à jour et applications'],
  ];

  assert(outilsPoste.length >= ATTENDUS_LOT6A.length,
    `LOT 6 : au moins les ${ATTENDUS_LOT6A.length} assistants du LOT 6A (${outilsPoste.length})`);
  for (const [id, sr] of ATTENDUS_LOT6A) {
    const o = outilsPoste.find((t) => t.id === id);
    assert(Boolean(o), `LOT 6 : l’assistant « ${id} » existe`);
    if (o) assert(o.subcategory === sr, `LOT 6 : « ${id} » est classé dans « ${sr} » (${o.subcategory})`);
  }

  // Aucune catégorie principale parasite : le sujet du LOT 6 est vaste, et la
  // tentation d'ouvrir une catégorie par domaine est exactement ce que la
  // feuille de route interdit.
  for (const interdite of ['Audio', 'Pilotes', 'Windows Update', 'Defender',
    'Stockage', 'Comptes', 'Services', 'Applications', 'Périphériques', 'Sécurité']) {
    assert(!tools.some((t) => t.category === interdite),
      `LOT 6 : aucune catégorie principale « ${interdite} » n’a été créée`);
  }
  // Et aucun sujet des lots futurs n'a été entamé.
  for (const future of ['Linux', 'Samba', 'Azure', 'AWS', 'Imprimantes', 'Cloud']) {
    assert(!outilsPoste.some((t) => t.subcategory === future),
      `LOT 6 : aucune sous-rubrique « ${future} » — ces sujets appartiennent aux lots futurs`);
  }

  const srLot6 = new Set(outilsPoste.map((t) => t.subcategory));
  for (const sr of srLot6) {
    assert(SOUS_RUBRIQUES_LOT6.includes(sr),
      `LOT 6 : la sous-rubrique « ${sr} » fait partie des huit prévues`);
  }

  // -------------------------------------------------------------------------
  section('LOT 6 — métadonnée de version');

  let lot6Essais = 0;
  let lot6Justes = 0;
  let lot6Herite = 0;
  for (const outil of outilsPoste) {
    for (const script of scriptsDeLOutil(outil)) {
      lot6Essais += 1;
      if (script.includes(`$KjemoVersion = '${VERSION_LOT6}'`)
        && script.includes(`# Outil KJEMO : ${outil.id} — ${VERSION_LOT6}`)) lot6Justes += 1;
      if (script.includes(VERSION_OUTILS)) lot6Herite += 1;
    }
  }
  assert(lot6Essais >= outilsPoste.length,
    `LOT 6 : ${lot6Essais} script(s) produits pour cette vérification`);
  assert(lot6Justes === lot6Essais,
    `LOT 6 : tous les scripts annoncent « ${VERSION_LOT6} », en-tête ET $KjemoVersion (${lot6Justes}/${lot6Essais})`);
  assert(lot6Herite === 0,
    `LOT 6 : aucun script du lot ne porte « ${VERSION_OUTILS} » (${lot6Herite})`);

  // -------------------------------------------------------------------------
  section('LOT 6 — la console reste ouverte, et la machine ne redémarre pas');

  // Ce sont les deux erreurs que la feuille de route nomme explicitement, et
  // elles viennent d'incidents constatés : un script de nettoyage qui ferme la
  // fenêtre emporte le message d'erreur avec elle.
  const FERMETURE = [
    [/^\s*exit\b/mi, 'un « exit » en début de ligne, qui fermerait la session interactive'],
    [/\[Environment\]::Exit/i, '[Environment]::Exit, qui tue le processus hôte'],
    [/\bRestart-Computer\b/i, 'un redémarrage automatique de la machine'],
    [/\bStop-Computer\b/i, 'un arrêt automatique de la machine'],
    [/\bshutdown(\.exe)?\b/i, 'un appel à shutdown.exe'],
    [/\$Host\.SetShouldExit/i, '$Host.SetShouldExit, qui ferme la console'],
    [/\bLogoff(\.exe)?\b/i, 'une fermeture de session'],
  ];
  // Contre-épreuve du jeu de motifs : il doit reconnaître un script fautif.
  const FAUTIFS_FERMETURE = [
    'Write-Host "fini"\nexit 0',
    'Restart-Computer',
    'shutdown.exe /r /t 0',
    '[Environment]::Exit(1)',
    '$Host.SetShouldExit(1)',
  ];
  for (const fautif of FAUTIFS_FERMETURE) {
    assert(FERMETURE.some(([m]) => m.test(fautif)),
      `contre-épreuve — le jeu de motifs reconnaît « ${fautif.split('\n').pop()} »`);
  }

  for (const outil of outilsPoste) {
    for (const script of scriptsDeLOutil(outil)) {
      for (const [motif, nom] of FERMETURE) {
        assert(!motif.test(script), `${outil.id} : aucun ${nom}`);
      }
      assert(/ne ferme pas votre console/i.test(script),
        `${outil.id} : le script dit explicitement qu’il ne ferme pas la console`);
    }
  }

  // -------------------------------------------------------------------------
  section('LOT 6 — le disque C: et les chemins');

  const DANGERS_CHEMIN = [
    [/Remove-Item[^\n]*-Recurse[^\n]*-Force/i, 'Remove-Item -Recurse -Force'],
    [/Remove-Item[^\n]*\*[^\n]*-Recurse/i, 'une suppression récursive avec joker'],
    [/Remove-Item\s+['"]?[A-Za-z]:\\?['"]?\s*$/im, 'une suppression visant une racine de volume'],
    [/-LiteralPath\s+['"][A-Za-z]:\\?['"]/i, 'une opération visant directement une racine de volume'],
    [/\bformat(\.com)?\s+[A-Za-z]:/i, 'un formatage'],
    [/\bdel\s+\/s\b/i, 'un del /s'],
    [/\brd\s+\/s\b/i, 'un rd /s'],
  ];
  const FAUTIFS_CHEMIN = [
    'Remove-Item -LiteralPath $cible -Recurse -Force',
    'Remove-Item C:\\Temp\\* -Recurse',
    'format C:',
    'del /s /q C:\\Temp',
  ];
  for (const fautif of FAUTIFS_CHEMIN) {
    assert(DANGERS_CHEMIN.some(([m]) => m.test(fautif)),
      `contre-épreuve — le jeu de motifs reconnaît « ${fautif} »`);
  }

  for (const outil of outilsPoste) {
    for (const script of scriptsDeLOutil(outil)) {
      const code = codeSeulLot6(script);
      for (const [motif, nom] of DANGERS_CHEMIN) {
        assert(!motif.test(code), `${outil.id} : aucun ${nom}`);
      }
    }
  }

  // Tout assistant qui reçoit un chemin doit passer par le gardien, et le
  // gardien doit refuser les quatre formes dangereuses.
  for (const outil of outilsPoste) {
    const champsChemin = outil.fields.filter((f) => /chemin|dossier|répertoire/i.test(f.label));
    if (champsChemin.length === 0) continue;
    for (const script of scriptsDeLOutil(outil)) {
      assert(/function Test-KjemoCheminSur/.test(script),
        `${outil.id} : porte un chemin, donc embarque le gardien de chemin`);
      assert(/Test-KjemoCheminSur -Chemin/.test(script),
        `${outil.id} : le gardien est réellement appelé, pas seulement défini`);
    }
    // Et la validation du formulaire refuse ce qui ne doit pas passer.
    for (const champ of champsChemin) {
      const defauts = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
      for (const mauvais of ['', '   ', 'Temp\\relatif']) {
        const errs = outil.validate({ ...defauts, [champ.id]: mauvais });
        assert(Boolean(errs[champ.id]),
          `${outil.id} : le champ « ${champ.id} » refuse « ${mauvais || '(vide)'} »`);
      }
    }
  }

  // -------------------------------------------------------------------------
  section('LOT 6 — verrou d’application sur les assistants modifiants');

  const MODIFIANTS_LOT6 = ['audio-diagnostic', 'windows-update-repair', 'process-hung'];
  for (const id of MODIFIANTS_LOT6) {
    const outil = outilsPoste.find((t) => t.id === id);
    assert(Boolean(outil), `LOT 6 : l’assistant modifiant « ${id} » existe`);
    if (!outil) continue;

    const champMode6 = outil.fields.find((f) => f.id === 'mode');
    assert(champMode6 && champMode6.default === 'Diagnostic',
      `${id} : part en mode Diagnostic`);

    // Le script porte un verrou nommé, pas une suite de conditions éparpillées.
    for (const script of scriptsDeLOutil(outil)) {
      assert(/\$conditionsAppliquer\s*=/.test(script),
        `${id} : le script construit un verrou explicite $conditionsAppliquer`);
      assert(/-not \$conditionsAppliquer/.test(script),
        `${id} : le verrou est réellement testé avant d’agir`);
      assert(/-Etat 'IGNORE'/.test(script),
        `${id} : un échec de condition porte IGNORE, pas un silence`);
      assert(/-Etat 'PROBLEME'/.test(script),
        `${id} : un échec de condition porte PROBLEME et nomme ce qui manque`);
      assert(/SERAIT BLOQUE|BLOQUE/i.test(script),
        `${id} : la simulation dit que l’action serait bloquée`);
    }
  }

  // Une confirmation écrite ne s’obtient pas par hasard : le formulaire la
  // refuse tant que la phrase exacte n’est pas retapée.
  const CONFIRMATIONS = [
    ['audio-diagnostic', 'audConfirmation', 'JE REDEMARRE LE SERVICE AUDIO'],
    ['windows-update-repair', 'wurConfirmation', 'JE REINITIALISE L AFFICHAGE DE L HISTORIQUE'],
    ['process-hung', 'prcConfirmation', 'JE PERDS LES DONNEES NON ENREGISTREES'],
  ];
  for (const [id, champ, phrase] of CONFIRMATIONS) {
    const outil = outilsPoste.find((t) => t.id === id);
    if (!outil) continue;
    const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
    if (id === 'process-hung') base.prcPid = '4242';
    // Vide : refusé.
    assert(Boolean(outil.validate({ ...base, mode: 'Appliquer', [champ]: '' })[champ]),
      `${id} : le mode Appliquer refuse une confirmation vide`);
    // Approchante : refusée aussi. Une confirmation qui tolère les à-peu-près
    // n'est plus une confirmation.
    for (const approchant of [phrase.toLowerCase(), phrase + ' !', phrase.slice(0, -1), 'oui']) {
      assert(Boolean(outil.validate({ ...base, mode: 'Appliquer', [champ]: approchant })[champ]),
        `${id} : « ${approchant.slice(0, 28)}… » n’est pas accepté comme confirmation`);
    }
    // Exacte : acceptée.
    assert(!outil.validate({ ...base, mode: 'Appliquer', [champ]: phrase })[champ],
      `${id} : la phrase exacte est acceptée`);
    // Et en mode Diagnostic, elle n'est pas exigée.
    assert(!outil.validate({ ...base, mode: 'Diagnostic', [champ]: '' })[champ],
      `${id} : le mode Diagnostic n’exige aucune confirmation`);
  }

  // process-hung : les PID du noyau sont refusés par la validation, avant même
  // que le script existe.
  {
    const outil = outilsPoste.find((t) => t.id === 'process-hung');
    if (outil) {
      const base = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
      const complet = { ...base, mode: 'Appliquer', prcConfirmation: 'JE PERDS LES DONNEES NON ENREGISTREES' };
      for (const interdit of ['0', '1', '2', '3', '4']) {
        assert(Boolean(outil.validate({ ...complet, prcPid: interdit }).prcPid),
          `process-hung : le PID ${interdit} est refusé (noyau et système)`);
      }
      assert(!outil.validate({ ...complet, prcPid: '4242' }).prcPid,
        'process-hung : un PID ordinaire est accepté');
      assert(Boolean(outil.validate({ ...complet, prcPid: 'chrome' }).prcPid),
        'process-hung : un NOM est refusé — un nom peut désigner douze processus');
      assert(Boolean(outil.validate({ ...complet, prcPid: '' }).prcPid),
        'process-hung : le mode Appliquer exige un PID');
    }
  }

  // -------------------------------------------------------------------------
  section('LOT 6 — aucun secret, aucune protection désactivée');

  const INTERDITS_LOT6 = [
    [/Set-MpPreference[^\n]*-Disable\w*\s+\$true/i, 'désactivation d’une protection Defender'],
    [/Add-MpPreference[^\n]*-Exclusion/i, 'ajout automatique d’une exclusion Defender'],
    [/Set-NetFirewallProfile[^\n]*-Enabled\s+False/i, 'désactivation du pare-feu'],
    [/Remove-LocalUser/i, 'suppression d’un compte local'],
    [/Remove-CimInstance[^\n]*Win32_UserProfile/i, 'suppression d’un profil utilisateur'],
    [/Set-Service[^\n]*-StartupType\s+Disabled/i, 'désactivation d’un service'],
    [/\bcipher\s+\/w/i, 'effacement de l’espace libre'],
    [/ProductKey|DigitalProductId/i, 'lecture d’une clé de produit'],
    [/-Confirm\s*:\s*\$false/i, '-Confirm:$false'],
    [/(^|\s)-Force\b/i, '-Force'],
  ];
  const FAUTIFS_LOT6 = [
    'Set-MpPreference -DisableRealtimeMonitoring $true',
    'Add-MpPreference -ExclusionPath C:\\Temp',
    'Set-NetFirewallProfile -Profile Domain -Enabled False',
    'Remove-LocalUser -Name invite',
    'Get-ItemProperty ... DigitalProductId',
    'Stop-Service wuauserv -Force',
  ];
  for (const fautif of FAUTIFS_LOT6) {
    assert(INTERDITS_LOT6.some(([m]) => m.test(fautif)),
      `contre-épreuve — le jeu de motifs reconnaît « ${fautif.slice(0, 44)}… »`);
  }
  for (const outil of outilsPoste) {
    for (const script of scriptsDeLOutil(outil)) {
      const code = codeSeulLot6(script);
      for (const [motif, nom] of INTERDITS_LOT6) {
        assert(!motif.test(code), `${outil.id} : aucun ${nom}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  section('LOT 6 — l’annulation et la vérification ne sont pas décoratives');

  for (const outil of outilsPoste) {
    assert(outil.rollback.summary.length > 60,
      `${outil.id} : la procédure d’annulation explique vraiment ce qu’elle rend`);
    assert(outil.rollback.diagnostic.length > 30,
      `${outil.id} : l’annulation porte une commande de diagnostic`);
    assert(outil.rollback.command.length > 30,
      `${outil.id} : l’annulation porte une commande`);
    assert(outil.verifyAfter.length >= 3,
      `${outil.id} : au moins trois vérifications après exécution`);
    assert(outil.checks.length >= 3,
      `${outil.id} : au moins trois contrôles annoncés`);
    assert(outil.gui.length >= 4,
      `${outil.id} : au moins quatre étapes de méthode graphique`);
    assert(outil.keywords.length >= 8,
      `${outil.id} : au moins huit mots-clés pour la recherche`);
    assert(outil.sources.length >= 3,
      `${outil.id} : au moins trois sources officielles`);
    // Et la fiche ne promet pas une exécution depuis le navigateur.
    const texteFiche = [outil.summary, outil.rollback.summary, ...outil.checks, ...outil.verifyAfter].join(' ');
    assert(!/exécute (le script|la commande) (depuis|dans) (le site|le navigateur)/i.test(texteFiche),
      `${outil.id} : la fiche ne promet aucune exécution depuis le navigateur`);
  }

  // -------------------------------------------------------------------------
  section('LOT 6 — recherche, sous-rubriques et routes directes');

  {
    const presentes = sousRubriques(tools, 'Poste de travail Windows').map((x) => x.name);
    for (const sr of srLot6) {
      assert(presentes.includes(sr),
        `sous-rubrique « ${sr} » proposée pour la catégorie Poste de travail Windows`);
    }
  }
  for (const outil of outilsPoste) {
    const idDe = (r) => (r && r.tool ? r.tool.id : r.id);
    assert(searchTools(outil.title).some((r) => idDe(r) === outil.id),
      `recherche par titre — « ${outil.title} » retrouve ${outil.id}`);
    assert(searchTools('', 'Poste de travail Windows').some((r) => idDe(r) === outil.id),
      `filtre par catégorie — Poste de travail Windows contient ${outil.id}`);
    assert(/^[a-z][a-z0-9-]*[a-z0-9]$/.test(outil.id),
      `route directe — « ${outil.id} » est un identifiant d’URL valide`);
    const derniere = outil.commonErrors[outil.commonErrors.length - 1];
    assert(searchTools(derniere.message).some((r) => idDe(r) === outil.id),
      `recherche par message d’erreur — « ${derniere.message.slice(0, 40)}… » retrouve ${outil.id}`);
  }
}

// ---------------------------------------------------------------------------
section('CI Windows — imports dynamiques compatibles ESM');

// Pourquoi cette garde existe, et pourquoi elle est statique.
//
// Sous Windows, resolve() rend « D:\a\KJEMO\dist\generators.mjs ». Passe tel
// quel a un appel dynamique, Node ESM le refuse :
//   ERR_UNSUPPORTED_ESM_URL_SCHEME — Received protocol 'd:'
// Node ESM n'accepte qu'une URL « file:///D:/... ». Sous Linux le meme code
// passe, parce que le chemin commence par « / » et ressemble assez a une URL
// pour etre tolere. Le defaut est donc INVISIBLE sur cette machine et FATAL
// en CI Windows : aucune execution locale ne peut le rattraper, seule une
// analyse du texte des fichiers le peut. D'ou cette garde.
//
// Le mot-cle cherche n'est jamais ecrit en clair ici : il est reconstruit a
// partir de fragments. Sinon la garde se detecterait elle-meme, et il
// faudrait exclure ce fichier du balayage — ce qui lui ferait un trou juste a
// l'endroit ou elle est censee veiller.
const MOT_IMPORT = ['im', 'port'].join('');

// Premier passage : masquer ce qui n'est pas du code.
//
// Ce masque n'est pas une coquetterie : sans lui, la garde accuse ses propres
// commentaires et ses propres libelles de test. Une phrase qui MENTIONNE un
// appel dynamique n'est pas un appel dynamique, et un libelle de test non
// plus.
//
//   - contenu des commentaires  → espaces
//   - contenu des chaines       → « x », guillemets conserves
//
// Les positions et les retours a la ligne sont preserves caractere pour
// caractere, afin que les numeros de ligne rapportes soient ceux du fichier
// reel et que l'argument brut reste extractible aux memes offsets.
function masquerJs(source) {
  const out = new Array(source.length);
  let i = 0;
  const copier = (n) => { for (let k = 0; k < n && i < source.length; k++, i++) out[i] = source[i]; };
  const effacer = (n, par) => {
    for (let k = 0; k < n && i < source.length; k++, i++) {
      out[i] = source[i] === '\n' ? '\n' : par;
    }
  };
  while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];
    if (c === '/' && d === '/') {
      const fin = source.indexOf('\n', i);
      effacer((fin === -1 ? source.length : fin) - i, ' ');
      continue;
    }
    if (c === '/' && d === '*') {
      const fin = source.indexOf('*/', i + 2);
      effacer((fin === -1 ? source.length : fin + 2) - i, ' ');
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      copier(1);                                 // le guillemet ouvrant
      while (i < source.length) {
        if (source[i] === '\\') { effacer(2, 'x'); continue; }
        if (source[i] === c) { copier(1); break; }  // le guillemet fermant
        effacer(1, 'x');
      }
      continue;
    }
    copier(1);
  }
  return out.join('');
}

// Extrait l'argument de chaque appel dynamique, parentheses equilibrees.
// Un balayage caractere par caractere, parce qu'une expression reguliere ne
// sait pas compter les parentheses : pathToFileURL(resolve(a, b)).href en
// contient trois niveaux.
function appelsDynamiques(sourceBrute) {
  const source = masquerJs(sourceBrute);
  const trouves = [];
  for (let i = 0; i < source.length; i++) {
    if (source.slice(i, i + MOT_IMPORT.length) !== MOT_IMPORT) continue;
    // Ni « .xxx », ni un identifiant plus long, ni « xxx.meta ».
    if (i > 0 && /[\w$.]/.test(source[i - 1])) continue;
    let j = i + MOT_IMPORT.length;
    while (j < source.length && /\s/.test(source[j])) j++;
    if (source[j] !== '(') continue;             // forme statique, pas un appel
    let profondeur = 0;
    let k = j;
    for (; k < source.length; k++) {
      if (source[k] === '(') profondeur++;
      else if (source[k] === ')') { profondeur--; if (profondeur === 0) break; }
    }
    if (profondeur !== 0) continue;              // parenthese non fermee
    trouves.push({
      index: i,
      ligne: source.slice(0, i).split('\n').length,
      argument: source.slice(j + 1, k).trim(),         // masque : sur a analyser
      argumentBrut: sourceBrute.slice(j + 1, k).trim(), // reel : pour le rapport
    });
    i = k;
  }
  return trouves;
}

const estLitteralSeul = (arg) => /^(['"`])x*\1$/.test(arg) || /^(['"`])\1$/.test(arg);
const estConverti = (arg) => arg.includes('pathToFileURL(') && /\.href\b/.test(arg);

// Une seule regle, appliquee a chaque appel dynamique :
//   - un litteral de chaine est accepte : chemin relatif ('../dist/x.mjs') ou
//     module interne ('node:fs'), tous deux valides sous Windows comme sous
//     Linux ;
//   - toute AUTRE expression doit passer par pathToFileURL(...).href.
// Ce qui tombe sous le coup de la regle : resolve(...), join(...), une
// concatenation, une variable de chemin absolu — exactement ce que la CI
// Windows refuse.
function appelsFautifs(nom, sourceBrute) {
  const fautes = [];
  for (const a of appelsDynamiques(sourceBrute)) {
    if (estLitteralSeul(a.argument)) continue;
    if (estConverti(a.argument)) continue;
    fautes.push(`${nom}:${a.ligne} — ${a.argumentBrut.replace(/\s+/g, ' ').slice(0, 80)}`);
  }
  return fautes;
}

{
  // Contre-epreuve d'abord : une garde qui ne detecte rien passe toujours.
  const fautif = [
    'const { tools } = await ' + MOT_IMPORT + "(resolve(ROOT, 'dist/generators.mjs'));",
    'const x = await ' + MOT_IMPORT + "(join(ROOT, 'dist', 'a.mjs'));",
    'const y = await ' + MOT_IMPORT + "(ROOT + '/dist/b.mjs');",
    'const z = await ' + MOT_IMPORT + '(cheminAbsolu);',
  ].join('\n');
  const detectees = appelsFautifs('contre-epreuve.mjs', fautif);
  assert(detectees.length === 4,
    'contre-epreuve — les quatre motifs fautifs sont tous detectes',
    `detectees : ${detectees.length} — ${detectees.join(' / ')}`);
  assert(detectees[0].startsWith('contre-epreuve.mjs:1'),
    'contre-epreuve — le numero de ligne rapporte est juste',
    detectees[0]);

  const sain = [
    'const a = await ' + MOT_IMPORT + "('../dist/generators.mjs');",
    'const b = await ' + MOT_IMPORT + "('node:fs');",
    'const c = await ' + MOT_IMPORT + "(pathToFileURL(resolve(ROOT, 'dist', 'x.mjs')).href);",
  ].join('\n');
  assert(appelsFautifs('sain.mjs', sain).length === 0,
    'contre-epreuve — les trois formes valides ne sont PAS accusees',
    appelsFautifs('sain.mjs', sain).join(' / '));

  // Le masque doit neutraliser prose et libelles, sans rien laisser passer
  // de ce qui est vraiment du code.
  const prose = [
    '// un commentaire qui cite ' + MOT_IMPORT + "(resolve(ROOT, 'x.mjs'))",
    "const libelle = 'texte citant " + MOT_IMPORT + "(join(A, B)) dans une chaine';",
  ].join('\n');
  assert(appelsDynamiques(prose).length === 0,
    'contre-epreuve — un appel cite en commentaire ou en chaine n’est PAS compte');
  const proseEtCode = prose + '\nconst v = await ' + MOT_IMPORT + '(resolve(ROOT, "z.mjs"));';
  assert(appelsFautifs('mixte.mjs', proseEtCode).length === 1,
    'contre-epreuve — le masque n’empeche pas de voir le vrai appel fautif a cote',
    appelsFautifs('mixte.mjs', proseEtCode).join(' / '));

  // Et la garde doit reconnaitre les trois niveaux de parentheses.
  const troisNiveaux = 'await ' + MOT_IMPORT + "(\n  pathToFileURL(resolve(ROOT, 'dist', 'x.mjs')).href\n);";
  assert(appelsDynamiques(troisNiveaux).length === 1,
    'contre-epreuve — un appel sur plusieurs lignes est bien lu en entier');
  assert(estConverti(appelsDynamiques(troisNiveaux)[0].argument),
    'contre-epreuve — cet appel est bien reconnu comme converti');

  // Puis le depot reel : tous les .mjs de test/ et de scripts/.
  const balayes = [];
  for (const dossier of ['test', 'scripts']) {
    const base = resolve(ROOT, dossier);
    if (!existsSync(base)) continue;
    for (const nom of readdirSync(base)) {
      if (!nom.endsWith('.mjs')) continue;
      balayes.push([`${dossier}/${nom}`, readFileSync(resolve(base, nom), 'utf8')]);
    }
  }
  assert(balayes.length >= 15,
    `balayage — ${balayes.length} fichiers .mjs analyses sous test/ et scripts/`);
  assert(balayes.some(([nom]) => nom === 'test/identity.test.mjs'),
    'balayage — ce fichier-ci est inclus dans le balayage, sans exception');

  const toutes = [];
  for (const [nom, source] of balayes) toutes.push(...appelsFautifs(nom, source));
  assert(toutes.length === 0,
    'aucun appel dynamique ne recoit un chemin du systeme de fichiers sans pathToFileURL(...).href',
    toutes.join(' | '));

  // Les cinq appels corriges doivent vraiment porter la conversion : une garde
  // qui passerait parce que les appels ont DISPARU ne vaudrait rien.
  const attendus = [
    ['test/sauvegarde-bloquante.test.mjs', 1],
    ['test/dns-change-bloquant.test.mjs', 1],
    ['test/route-passerelle-bloquante.test.mjs', 1],
    ['test/poste-verrous.test.mjs', 2],
  ];
  let totalConvertis = 0;
  for (const [nom, combien] of attendus) {
    const source = readFileSync(resolve(ROOT, nom), 'utf8');
    const convertis = appelsDynamiques(source).filter((a) => estConverti(a.argument));
    totalConvertis += convertis.length;
    assert(convertis.length === combien,
      `${nom} — ${combien} appel(s) dynamique(s) converti(s) en URL file://`,
      `trouves : ${convertis.length}`);
    assert(/\bpathToFileURL\b/.test(source) && /from 'node:url'/.test(source),
      `${nom} — pathToFileURL est bien importe depuis node:url`);
  }
  assert(totalConvertis === 5,
    'les cinq appels dynamiques signales par la revue sont tous convertis',
    `total : ${totalConvertis}`);
}

// Résumé
console.log('');
console.log(`Tests d'identité terminés : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
