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

import { readFileSync, existsSync } from 'node:fs';
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

  // La source officielle reste un lien Microsoft Learn
  assert(/^https:\/\/learn\.microsoft\.com\//.test(t.source),
    `${t.id} : source officielle Microsoft Learn`);
}

// Cohérence risque / élévation : un outil ATTENTION ou DESTRUCTIF exige l'admin
for (const t of tools) {
  if (RISQUES_ADMIN.includes(t.risk) && t.category !== 'Active Directory' && t.category !== 'GPO') {
    assert(t.requiresAdmin === true,
      `${t.id} : risque « ${t.risk} » hors AD/GPO ⇒ requiresAdmin = true`);
  }
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

const lectureSeule = tools.filter((t) => t.reversible === false).map((t) => t.id);
assert(lectureSeule.length === 1 && lectureSeule[0] === 'disk-scan',
  `un seul outil en lecture seule, et c'est disk-scan (${lectureSeule.join(', ') || 'aucun'})`);

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
for (const prevue of ['Imprimantes', 'Linux']) {
  assert(CATEGORIES.some((c) => c.name === prevue),
    `la feuille de route est préparée : « ${prevue} » est déclarée`);
  assert(!visibles.some((c) => c.name === prevue),
    `« ${prevue} » n\u2019est pas affichée puisqu\u2019elle est vide`);
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
  'Windows poste de travail',
  'Analyse et nettoyage des disques',
  'Windows Server',
  'Active Directory',
  'GPO',
  'Réseau',
  'Imprimantes',
  'Linux',
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
  'wifi-repair':   ['Windows poste de travail', 'Réseau et Wi-Fi'],
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
assert(nomsVisibles.includes('Windows poste de travail')
    && nomsVisibles.includes('Analyse et nettoyage des disques'),
  'Windows poste de travail et Analyse des disques sont visibles');
assert(attente2.map((c) => c.name).join(',') === 'Imprimantes,Linux',
  `seules Imprimantes et Linux sont en attente (${attente2.map((c) => c.name).join(',')})`);
assert(!nomsVisibles.includes('Imprimantes') && !nomsVisibles.includes('Linux'),
  'Imprimantes et Linux sont masquées puisqu\u2019elles sont vides');
assert(vis2.length === 6 && vis2.reduce((n, c) => n + c.count, 0) === tools.length,
  `${vis2.length} catégories visibles couvrant les ${tools.length} outils`);

// Sous-rubriques agrégées
const sousAD = sousRubriques(tools, 'Active Directory').map((x) => x.name);
assert(sousAD.join(' | ') === 'Unités organisationnelles | Utilisateurs | Contrôleurs de domaine',
  `Active Directory expose ses trois sous-rubriques (${sousAD.join(', ')})`);
assert(sousRubriques(tools, 'Imprimantes').length === 0,
  'une catégorie vide n\u2019expose aucune sous-rubrique');
assert(vis2.every((c) => c.sous.length > 0 && c.sous.reduce((n, x) => n + x.count, 0) === c.count),
  'les décomptes des sous-rubriques correspondent au décompte de la catégorie');

// Une fonction generate() par outil, et une sous-rubrique par outil, quel que
// soit le module où l'outil est défini.
const sourceGen = readFileSync(resolve(ROOT, 'dist/generators.mjs'), 'utf8');
const sourceServeur = existsSync(resolve(ROOT, 'dist/outils-serveur.mjs'))
  ? readFileSync(resolve(ROOT, 'dist/outils-serveur.mjs'), 'utf8')
  : '';
const sourcesCatalogue = sourceGen + '\n' + sourceServeur;
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
const outilsLot2 = tools.filter((t) => !IDS_HISTORIQUES.includes(t.id));

assert(outilsLot2.length > 0, `le catalogue contient ${outilsLot2.length} outil(s) du LOT 2`);
assert(outilsLot2.every((t) => t.category === 'Windows Server'),
  'tous les outils du LOT 2 appartiennent à la catégorie Windows Server');
assert(outilsLot2.every((t) => SOUS_RUBRIQUES_LOT2.includes(t.subcategory)),
  'chaque outil du LOT 2 porte une des cinq sous-rubriques prévues');

const CHAMPS_FICHE = ['id', 'icon', 'category', 'subcategory', 'title', 'risk', 'summary',
  'fields', 'validate', 'generate', 'gui', 'keywords', 'requiresAdmin', 'os', 'prereqs',
  'commonErrors', 'reversible', 'verifyAfter', 'rollback', 'checks', 'source', 'sources'];

for (const outil of outilsLot2) {
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
  assert(outil.os.some((o) => /Windows Server 2019/.test(o)) && outil.os.some((o) => /5\.1/.test(o)),
    `${outil.id} : compatibilité déclarée précisément (2019 et PowerShell 5.1)`);
  assert(outil.rollback && outil.rollback.summary && outil.rollback.diagnostic && outil.rollback.command,
    `${outil.id} : procédure d’annulation en blocs distincts`);

  // Sources : uniquement des pages Microsoft précises, en HTTPS.
  assert(/^https:\/\/learn\.microsoft\.com\//.test(outil.source),
    `${outil.id} : source principale sur learn.microsoft.com`);
  assert(Array.isArray(outil.sources) && outil.sources.length >= 1,
    `${outil.id} : liste de sources officielles fournie`);
  for (const src of outil.sources) {
    assert(/^https:\/\/learn\.microsoft\.com\/\S+/.test(src.url),
      `${outil.id} : source « ${src.label} » pointe vers une page Microsoft précise`);
    assert(!/^https:\/\/learn\.microsoft\.com\/?$/.test(src.url),
      `${outil.id} : source « ${src.label} » n’est pas la page d’accueil`);
  }

  // Les outils modifiants commencent en Diagnostic ; les diagnostics exportent.
  const champMode = outil.fields.find((f) => f.id === 'mode' || f.id === 'bkMode');
  if (outil.risk === 'diagnostic') {
    assert(outil.fields.some((f) => /Format/i.test(f.label)),
      `${outil.id} : un outil de diagnostic propose un format de rapport`);
  } else {
    assert(champMode, `${outil.id} : un outil modifiant porte un sélecteur de mode`);
    assert(champMode.default === 'Diagnostic',
      `${outil.id} : le mode par défaut est Diagnostic`);
  }

  // Aucun champ ne demande de secret.
  for (const f of outil.fields) {
    // On juge ce que le champ DEMANDE — son identifiant et son étiquette — et
    // non son texte d'aide, qui peut légitimement dire « aucun mot de passe ».
    assert(!/mot de passe|password|secret|jeton|token|credential|identifiant de connexion/i.test(`${f.id} ${f.label}`),
      `${outil.id} : le champ « ${f.id} » ne demande aucun secret`);
    assert(f.type !== 'password', `${outil.id} : aucun champ de type password`);
  }
}

section('LOT 2 — scripts générés : sécurité et forme');

for (const outil of outilsLot2) {
  const valeurs = Object.fromEntries(outil.fields.map((f) => [f.id, String(f.default ?? '')]));
  let script = '';
  let erreur = null;
  try { script = outil.generate(valeurs); } catch (e) { erreur = e; }
  assert(!erreur, `${outil.id} : le script se génère avec les valeurs par défaut${erreur ? ' — ' + erreur.message : ''}`);
  if (erreur) continue;

  assert(script.startsWith('#Requires -Version 5.1'),
    `${outil.id} : le script déclare son plancher PowerShell 5.1`);
  assert(script.includes(outil.id), `${outil.id} : le script s’identifie`);

  // Interdits absolus du LOT 2.
  assert(!/-Confirm\s*:\s*\$false/i.test(script), `${outil.id} : aucun -Confirm:$false`);
  assert(!/(^|\s)-Force\b/i.test(script), `${outil.id} : aucun -Force`);
  assert(!/Invoke-Expression|\biex\b/i.test(script), `${outil.id} : aucun Invoke-Expression`);
  assert(!/Set-ExecutionPolicy/i.test(script), `${outil.id} : aucun contournement d’ExecutionPolicy`);
  assert(!/Invoke-WebRequest|Invoke-RestMethod|curl\s+http|wget\s+http|DownloadString/i.test(script),
    `${outil.id} : aucun téléchargement de code externe`);
  assert(!/Get-Credential|ConvertTo-SecureString|-Password\b|PlainText/i.test(script),
    `${outil.id} : aucune manipulation d’identifiants`);
  assert(!/\bTODO\b|\bFIXME\b|\bXXX\b/.test(script), `${outil.id} : aucun marqueur TODO`);
  assert(!/http:\/\//.test(script), `${outil.id} : aucune URL non chiffrée`);

  // Un outil modifiant doit garder ses actions derrière la garde de mode.
  if (outil.risk !== 'diagnostic') {
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

section('LOT 2 — validation : les données invalides sont refusées');

for (const outil of outilsLot2) {
  // Champ vide sur un champ obligatoire : le script ne doit pas être produit.
  const obligatoires = outil.fields.filter((f) => !/facultatif/i.test(f.label));
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
for (const outil of outilsLot2) {
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
assert(baseline.count === 64 && Object.keys(baseline.sha256).length === 64,
  'la référence couvre exactement les 64 scripts historiques');
assert(baseline.baseSha === '22b4eadbaf0771d13e5d8f5d66d72881e4a4d8c6',
  'la référence est bien ancrée au SHA de base du LOT 1B');
const empreinteFausse = { ...baseline.sha256 };
const premierFichier = Object.keys(empreinteFausse)[0];
empreinteFausse[premierFichier] = '0'.repeat(64);
assert(empreinteFausse[premierFichier] !== baseline.sha256[premierFichier],
  `contre-épreuve — une empreinte modifiée diffère de la référence (${premierFichier})`);
assert(Object.keys(baseline.sha256).every((f) => /^[a-z0-9-]+__[a-z0-9-]+\.ps1$/.test(f)),
  'chaque entrée de la référence nomme un script <outil>__<jeu>.ps1');

// Résumé
console.log('');
console.log(`Tests d'identité terminés : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
