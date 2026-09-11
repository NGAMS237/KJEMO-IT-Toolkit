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
  escapePowerShellSingleQuoted('O’Brien') === "O''Brien",
  'escPs1 : U+2019 → \'\'',
);
assert(
  escapePowerShellSingleQuoted('O‘Brien') === "O''Brien",
  'escPs1 : U+2018 → \'\'',
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
const adOuTool = tools.find((t) => t.id === 'ad-ou');
if (adOuTool) {
  const v = Object.fromEntries(adOuTool.fields.map((f) => [f.id, String(f.default ?? '')]));
  v.domain = 'nodot';
  const errs = adOuTool.validate(v);
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

// Résumé
console.log('');
console.log(`Tests d'identité terminés : ${passed} OK, ${failed} ÉCHEC(S).`);
if (failed > 0) process.exit(1);
