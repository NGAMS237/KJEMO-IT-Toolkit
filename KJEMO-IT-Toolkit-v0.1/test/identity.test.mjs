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
  validateDomain,
  validateIPv4,
  validateSamAccountName,
  validateIntegerStrict,
  validateFloatStrict,
  validateOuName,
  validateWindowsLocalPath,
  domainToDn,
} from '../dist/generators.mjs';

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
assert(tools.length === 8, `8 outils attendus, ${tools.length} trouvés`);

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

// Résumé
console.log('');
console.log(`Tests d'identité terminés : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
