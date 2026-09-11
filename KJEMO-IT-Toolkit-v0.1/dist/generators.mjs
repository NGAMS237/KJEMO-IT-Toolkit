/**
 * generators.mjs — LOT 0 · KJEMO IT Toolkit
 * -------------------------------------------
 * Module ES canonique — placé dans dist/ pour que GitHub Pages puisse le servir.
 * Importé par :
 *   dist/app.js  →  import { ... } from './generators.mjs';
 *   tests        →  import { ... } from '../dist/generators.mjs';
 *
 * Aucune dépendance DOM — utilisable en Node.js sans shim.
 */

// ---------------------------------------------------------------------------
// Fonctions d'échappement
// ---------------------------------------------------------------------------

/**
 * Échappe une valeur pour une chaîne PowerShell à apostrophes simples ('...').
 * U+0027 ('), U+2018 (') et U+2019 (') ferment tous la chaîne PS et doivent
 * être doublés en '' (deux U+0027).
 */
export function escapePowerShellSingleQuoted(v) {
  return String(v ?? '').replace(/['\u2018\u2019]/g, "''");
}

/**
 * Échappe une valeur pour une chaîne PowerShell à guillemets doubles ("...").
 * Backtick, $ et " sont des caractères spéciaux.
 */
export function escapePowerShellDoubleQuoted(v) {
  return String(v ?? '')
    .replace(/`/g, '``')
    .replace(/\$/g, '`$')
    .replace(/"/g, '`"');
}

/**
 * Échappe une valeur pour un composant RDN LDAP (RFC 4514).
 * Caractères spéciaux : , + = " \ < > ; — ainsi que # en début et espaces en début/fin.
 */
export function escapeLdapRdn(v) {
  let s = String(v ?? '');
  // 1. Backslash en premier
  s = s.replace(/\\/g, '\\\\');
  // 2. NUL et autres caractères de contrôle RFC 4514 → \HH
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
  // 3. Caractères spéciaux RFC 4514
  s = s.replace(/[,+="<>;]/g, (c) => '\\' + c);
  // 4. Dièse en début de valeur
  if (s.startsWith('#')) s = '\\#' + s.slice(1);
  // 5. Espaces en début et en fin
  s = s.replace(/^( +)/, (m) => m.replace(/ /g, '\\ '));
  s = s.replace(/( +)$/, (m) => m.replace(/ /g, '\\ '));
  return s;
}

// ---------------------------------------------------------------------------
// Validateurs stricts
// Chaque validateur retourne { ok: boolean, value: any, error: string|null }
// ---------------------------------------------------------------------------

export function validateDomain(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le domaine ne peut pas être vide.' };
  if (s.length > 253) return { ok: false, value: s, error: 'Le nom de domaine est trop long (max 253 caractères).' };
  const labels = s.split('.');
  if (labels.length < 2) return { ok: false, value: s, error: 'Le domaine doit contenir au moins deux parties (ex. : hopitalbn.lan).' };
  for (const label of labels) {
    if (!label) return { ok: false, value: s, error: 'Le domaine contient un double point ou un point terminal.' };
    if (label.length > 63) return { ok: false, value: s, error: `Le composant « ${label} » dépasse 63 caractères.` };
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/.test(label)) {
      return { ok: false, value: s, error: `Le composant « ${label} » contient des caractères non autorisés.` };
    }
  }
  return { ok: true, value: s, error: null };
}

export function validateIPv4(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: "L'adresse IP ne peut pas être vide." };
  const parts = s.split('.');
  if (parts.length !== 4) return { ok: false, value: s, error: "L'adresse IPv4 doit contenir exactement quatre octets séparés par des points." };
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return { ok: false, value: s, error: `« ${part} » n'est pas un entier valide.` };
    const n = Number(part);
    if (n < 0 || n > 255) return { ok: false, value: s, error: `L'octet ${part} est hors de la plage 0–255.` };
    if (part !== String(n)) return { ok: false, value: s, error: `L'octet « ${part} » contient un zéro de tête non autorisé.` };
  }
  return { ok: true, value: s, error: null };
}

export function validateSamAccountName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le SamAccountName ne peut pas être vide.' };
  if (s.length > 20) return { ok: false, value: s, error: 'Le SamAccountName ne doit pas dépasser 20 caractères.' };
  if (/["\/\\[\]:;|=,+*?<>@\x00-\x1f\x7f]/.test(s)) {
    return { ok: false, value: s, error: 'Le SamAccountName contient un caractère non autorisé (" / \\ [ ] : ; | = , + * ? < > @).' };
  }
  return { ok: true, value: s, error: null };
}

export function validateGroupName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom du groupe ne peut pas être vide.' };
  if (s.length > 256) return { ok: false, value: s, error: 'Le nom du groupe ne doit pas dépasser 256 caractères.' };
  if (/[\x00-\x1f\x7f]/.test(s)) return { ok: false, value: s, error: 'Le nom du groupe contient un caractère de contrôle non autorisé.' };
  return { ok: true, value: s, error: null };
}

export function validateShareName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom du partage ne peut pas être vide.' };
  if (s.length > 80) return { ok: false, value: s, error: 'Le nom du partage ne doit pas dépasser 80 caractères.' };
  if (/[\\/:*?"<>|]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom du partage contient un caractère interdit (\\  /  :  *  ?  "  <  >  |).' };
  }
  return { ok: true, value: s, error: null };
}

export function validateIntegerStrict(v, min, max, label) {
  const s = String(v ?? '').trim();
  const lbl = label || 'La valeur';
  if (!s) return { ok: false, value: null, error: `${lbl} ne peut pas être vide.` };
  if (!/^-?\d+$/.test(s)) {
    return { ok: false, value: null, error: `${lbl} doit être un entier (exemple : 12). Valeur saisie : « ${s} ».` };
  }
  const n = Number(s);
  if (min !== undefined && n < min) {
    return { ok: false, value: null, error: `${lbl} doit être ≥ ${min}${max !== undefined ? ` et ≤ ${max}` : ''}.` };
  }
  if (max !== undefined && n > max) {
    return { ok: false, value: null, error: `${lbl} doit être ≤ ${max}${min !== undefined ? ` et ≥ ${min}` : ''}.` };
  }
  return { ok: true, value: n, error: null };
}

export function validateFloatStrict(v, min, max, label) {
  const s = String(v ?? '').trim();
  const lbl = label || 'La valeur';
  if (!s) return { ok: false, value: null, error: `${lbl} ne peut pas être vide.` };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) {
    return { ok: false, value: null, error: `${lbl} doit être un nombre décimal (exemple : 0.5). Valeur saisie : « ${s} ».` };
  }
  const n = Number(s);
  if (min !== undefined && n < min) {
    return { ok: false, value: null, error: `${lbl} doit être ≥ ${min}${max !== undefined ? ` et ≤ ${max}` : ''}.` };
  }
  if (max !== undefined && n > max) {
    return { ok: false, value: null, error: `${lbl} doit être ≤ ${max}${min !== undefined ? ` et ≥ ${min}` : ''}.` };
  }
  return { ok: true, value: n, error: null };
}

export function validateOuName(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: "Le nom de l'OU ne peut pas être vide." };
  if (s.length > 64) return { ok: false, value: s, error: "Le nom de l'OU ne doit pas dépasser 64 caractères." };
  if (/[\x00-\x1f\x7f]/.test(s)) return { ok: false, value: s, error: "Le nom de l'OU contient un caractère de contrôle non autorisé." };
  return { ok: true, value: s, error: null };
}

/**
 * Valide un chemin local Windows absolu pour New-SmbShare.
 * Refuse les chemins UNC (\\serveur\...) car New-SmbShare exige un chemin local.
 */
export function validateWindowsLocalPath(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le chemin ne peut pas être vide.' };
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s)) {
    return { ok: false, value: s, error: 'Le chemin contient des caractères de contrôle non autorisés.' };
  }
  if (s.startsWith('\\\\') || s.startsWith('//')) {
    return { ok: false, value: s, error: 'Les chemins UNC (\\\\serveur\\...) ne sont pas acceptés pour New-SmbShare. Utilisez un chemin local absolu (ex. : D:\\Partages\\Nom).' };
  }
  if (!/^[A-Za-z]:[\\\/]/.test(s)) {
    return { ok: false, value: s, error: 'Le chemin doit être un chemin Windows absolu (ex. : D:\\Partages\\Nom).' };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Valide un chemin de fichier (usage général — scan disque, etc.).
 * Accepte chemins locaux Windows et UNC.
 */
export function validatePath(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le chemin ne peut pas être vide.' };
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s)) {
    return { ok: false, value: s, error: 'Le chemin contient des caractères de contrôle non autorisés.' };
  }
  return { ok: true, value: s, error: null };
}

// ---------------------------------------------------------------------------
// Utilitaires partagés
// ---------------------------------------------------------------------------

/**
 * Convertit un nom de domaine en Distinguished Name LDAP (RFC 4514).
 */
export function domainToDn(domain) {
  return String(domain).trim().split('.').filter(Boolean)
    .map((part) => `DC=${escapeLdapRdn(part)}`).join(',');
}

/**
 * Normalise un script PowerShell généré : convertit \ + newline en backtick + newline.
 */
export function normalizeScript(text) {
  return text.replace(/\\\n/g, '\`\n');
}

/**
 * Encode les caractères HTML spéciaux pour injection sûre dans innerHTML.
 */
export function textToCode(text) {
  return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
}

// Raccourci interne
const escPs = escapePowerShellSingleQuoted;

// ---------------------------------------------------------------------------
// Outils — 8 assistants
// ---------------------------------------------------------------------------

export const tools = [
  // ── 1. IP statique ──────────────────────────────────────────────────────
  {
    id: 'static-ip',
    icon: '◈',
    category: 'Réseau',
    title: 'Configurer une IP statique',
    risk: 'caution',
    summary: 'Configure IPv4, passerelle et DNS sur une carte Windows.',
    fields: [
      { id: 'adapter', label: 'Nom de la carte réseau', default: 'Ethernet', help: 'Vérifie avec Get-NetAdapter.' },
      { id: 'ip',      label: 'Adresse IPv4',            default: '192.168.30.253' },
      { id: 'prefix',  label: 'Préfixe réseau',          type: 'number', default: '24', min: '1', max: '32', help: '24 correspond au masque 255.255.255.0.' },
      { id: 'gateway', label: 'Passerelle',               default: '192.168.30.254' },
      { id: 'dns',     label: 'DNS préféré',              default: '192.168.30.254' },
    ],
    validate(v) {
      const errors = {};
      const adapter = String(v.adapter ?? '').trim();
      if (!adapter) errors.adapter = 'Le nom de la carte ne peut pas être vide.';
      else if (/[\x00-\x1f\x7f]/.test(adapter)) errors.adapter = 'Le nom de la carte contient un caractère de contrôle non autorisé.';
      const ip = validateIPv4(v.ip);       if (!ip.ok)      errors.ip      = ip.error;
      const px = validateIntegerStrict(v.prefix, 1, 32, 'Le préfixe réseau'); if (!px.ok) errors.prefix = px.error;
      const gw = validateIPv4(v.gateway); if (!gw.ok)      errors.gateway = gw.error;
      const dn = validateIPv4(v.dns);     if (!dn.ok)      errors.dns     = dn.error;
      return errors;
    },
    generate(v) {
      // generate() refuse les données invalides — pas de correction silencieuse
      const px = validateIntegerStrict(v.prefix, 1, 32, 'Le préfixe réseau');
      if (!px.ok) throw new Error(`Préfixe invalide : ${px.error}`);
      const adapter = escPs(v.adapter);
      const ip      = escPs(v.ip);
      const prefix  = px.value;
      const gateway = escPs(v.gateway);
      const dns     = escPs(v.dns);
      return (
        `# Exécuter PowerShell en administrateur\n` +
        `# Vérification préalable\n` +
        `Get-NetAdapter\n` +
        `Get-NetIPConfiguration -InterfaceAlias '${adapter}'\n\n` +
        `# Désactiver DHCP et ajouter l'adresse statique\n` +
        `Set-NetIPInterface -InterfaceAlias '${adapter}' -AddressFamily IPv4 -Dhcp Disabled\n` +
        `New-NetIPAddress -InterfaceAlias '${adapter}' -IPAddress '${ip}' -PrefixLength ${prefix} -DefaultGateway '${gateway}'\n\n` +
        `# Définir le DNS\n` +
        `Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ServerAddresses '${dns}'\n\n` +
        `# Vérification\n` +
        `Get-NetIPConfiguration -InterfaceAlias '${adapter}'`
      );
    },
    gui: [
      'Ouvrir Param\u00e8tres > R\u00e9seau et Internet > Param\u00e8tres r\u00e9seau avanc\u00e9s.',
      'Cliquer sur la carte concern\u00e9e puis Modifier \u00e0 c\u00f4t\u00e9 de l\u2019attribution IP.',
      'Choisir Manuel, activer IPv4 et saisir IP, pr\u00e9fixe, passerelle et DNS.',
      'Enregistrer puis ouvrir une console et v\u00e9rifier avec ipconfig /all.',
    ],
    checks: [
      'La carte vis\u00e9e doit \u00eatre la bonne : une erreur peut couper l\u2019acc\u00e8s r\u00e9seau.',
      'Si cette adresse existe d\u00e9j\u00e0, supprimer ou modifier l\u2019ancienne configuration avant de lancer New-NetIPAddress.',
    ],
    source: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netipaddress',
  },

  // ── 2. Créer une OU ─────────────────────────────────────────────────────
  {
    id: 'ad-ou',
    icon: '\u2318',
    category: 'Active Directory',
    title: 'Cr\u00e9er une unit\u00e9 d\u2019organisation',
    risk: 'safe',
    summary: 'Cr\u00e9e une OU prot\u00e9g\u00e9e contre les suppressions accidentelles.',
    fields: [
      { id: 'domain', label: 'Nom du domaine',               default: 'hopitalbn.lan' },
      { id: 'ou',     label: 'Nom de la nouvelle OU',         default: 'Employes' },
      { id: 'parent', label: 'OU parente (facultatif)',        default: '', help: 'Exemple\u00a0: Administration. Laisser vide pour la racine du domaine.' },
      { id: 'whatif', label: 'Mode test', type: 'select',     default: 'true', options: [['true', 'Oui \u2014 ne rien cr\u00e9er'], ['false', 'Non \u2014 cr\u00e9er r\u00e9ellement']] },
    ],
    validate(v) {
      const errors = {};
      const dom = validateDomain(v.domain);  if (!dom.ok) errors.domain = dom.error;
      const ou  = validateOuName(v.ou);      if (!ou.ok)  errors.ou     = ou.error;
      if (v.parent) { const par = validateOuName(v.parent); if (!par.ok) errors.parent = par.error; }
      if (v.whatif !== 'true' && v.whatif !== 'false') errors.whatif = 'Mode test invalide.';
      return errors;
    },
    generate(v) {
      if (v.whatif !== 'true' && v.whatif !== 'false') throw new Error('Mode test invalide.');
      const dn = domainToDn(v.domain);

      // LDAP-escape the OU component names (RFC 4514)
      const ouLdap     = escapeLdapRdn(v.ou);
      const parentLdap = v.parent ? escapeLdapRdn(v.parent) : null;

      // Full LDAP Distinguished Names (correctly escaped)
      const pathDn = parentLdap ? `OU=${parentLdap},${dn}` : dn;
      const fullDn = `OU=${ouLdap},${pathDn}`;

      // PS-escape the LDAP DNs for embedding in single-quoted PS strings
      // (LDAP backslashes are literal in PS single-quoted strings; only ' needs doubling)
      const ouPs     = escPs(v.ou);                           // -Name : juste le nom, pas un DN
      const pathDnPs = escapePowerShellSingleQuoted(pathDn);  // -Path
      const fullDnPs = escapePowerShellSingleQuoted(fullDn);  // -Identity

      const whatif = v.whatif === 'true' ? ' -WhatIf' : '';
      return (
        `Import-Module ActiveDirectory\n\n` +
        `$OuName = '${ouPs}'\n` +
        `$OuPath = '${pathDnPs}'\n` +
        `$OuDn   = '${fullDnPs}'\n\n` +
        `if (Get-ADOrganizationalUnit -Identity $OuDn -ErrorAction SilentlyContinue) {\n` +
        `    Write-Warning "L'OU existe d\u00e9j\u00e0 : $OuDn"\n` +
        `}\n` +
        `else {\n` +
        `    New-ADOrganizationalUnit -Name $OuName -Path $OuPath -ProtectedFromAccidentalDeletion $true${whatif}\n` +
        `}\n\n` +
        `Get-ADOrganizationalUnit -Identity $OuDn`
      );
    },
    gui: [
      'Ouvrir Gestionnaire de serveur > Outils > Utilisateurs et ordinateurs Active Directory.',
      'D\u00e9velopper le domaine puis cliquer droit sur le conteneur parent.',
      'Choisir Nouveau > Unit\u00e9 d\u2019organisation.',
      'Saisir le nom et conserver la protection contre la suppression accidentelle.',
    ],
    checks: [
      'Le module ActiveDirectory est disponible sur un contr\u00f4leur de domaine ou avec RSAT.',
      'Cr\u00e9er l\u2019OU parente avant une sous-OU.',
    ],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adorganizationalunit',
  },

  // ── 3. Créer un utilisateur AD ───────────────────────────────────────────
  {
    id: 'ad-user',
    icon: '\u25c9',
    category: 'Active Directory',
    title: 'Cr\u00e9er un utilisateur AD',
    risk: 'caution',
    summary: 'Cr\u00e9e un utilisateur, demande le mot de passe localement et force son changement \u00e0 la premi\u00e8re ouverture.',
    fields: [
      { id: 'domain',    label: 'Nom du domaine',                      default: 'hopitalbn.lan' },
      { id: 'ou',        label: "Nom de l\u2019OU",                    default: 'Employes' },
      { id: 'firstName', label: 'Pr\u00e9nom',                         default: 'Marie' },
      { id: 'lastName',  label: 'Nom',                                  default: 'Tremblay' },
      { id: 'sam',       label: 'Identifiant (SamAccountName)',         default: 'mtremblay' },
      { id: 'whatif',    label: 'Mode test', type: 'select',            default: 'true', options: [['true', 'Oui \u2014 ne rien cr\u00e9er'], ['false', 'Non \u2014 cr\u00e9er r\u00e9ellement']] },
    ],
    validate(v) {
      const errors = {};
      const dom  = validateDomain(v.domain);          if (!dom.ok)  errors.domain    = dom.error;
      const ou   = validateOuName(v.ou);               if (!ou.ok)   errors.ou        = ou.error;
      const sam  = validateSamAccountName(v.sam);      if (!sam.ok)  errors.sam       = sam.error;
      const fn = String(v.firstName ?? '').trim();
      const ln = String(v.lastName  ?? '').trim();
      if (!fn) errors.firstName = 'Le pr\u00e9nom ne peut pas \u00eatre vide.';
      else if (fn.length > 64) errors.firstName = 'Le pr\u00e9nom ne doit pas d\u00e9passer 64 caract\u00e8res.';
      else if (/[\x00-\x1f\x7f]/.test(fn)) errors.firstName = 'Le pr\u00e9nom contient un caract\u00e8re de contr\u00f4le non autoris\u00e9.';
      if (!ln) errors.lastName  = 'Le nom ne peut pas \u00eatre vide.';
      else if (ln.length > 64) errors.lastName  = 'Le nom ne doit pas d\u00e9passer 64 caract\u00e8res.';
      else if (/[\x00-\x1f\x7f]/.test(ln)) errors.lastName  = 'Le nom contient un caract\u00e8re de contr\u00f4le non autoris\u00e9.';
      if (v.whatif !== 'true' && v.whatif !== 'false') errors.whatif = 'Mode test invalide.';
      return errors;
    },
    generate(v) {
      if (v.whatif !== 'true' && v.whatif !== 'false') throw new Error('Mode test invalide.');

      // LDAP-correct path DN for -Path parameter
      const ouLdap  = escapeLdapRdn(v.ou);
      const pathDn  = `OU=${ouLdap},${domainToDn(v.domain)}`;
      const pathPs  = escapePowerShellSingleQuoted(pathDn);

      const firstName = escPs(v.firstName);
      const lastName  = escPs(v.lastName);
      const sam       = escPs(v.sam);
      const domain    = escPs(v.domain);
      const whatif    = v.whatif === 'true' ? ' -WhatIf' : '';
      return (
        `Import-Module ActiveDirectory\n\n` +
        `$UserName = '${firstName} ${lastName}'\n` +
        `$Sam      = '${sam}'\n` +
        `$Path     = '${pathPs}'\n` +
        `$Password = Read-Host 'Mot de passe temporaire' -AsSecureString\n\n` +
        // Use scriptblock filter to avoid PS injection via $Sam variable interpolation
        `if (Get-ADUser -Filter {SamAccountName -eq $Sam} -ErrorAction SilentlyContinue) {\n` +
        `    Write-Warning "L'utilisateur $Sam existe d\u00e9j\u00e0."\n` +
        `}\n` +
        `else {\n` +
        `    New-ADUser -Name $UserName -GivenName '${firstName}' -Surname '${lastName}' \\\n` +
        `        -SamAccountName $Sam -UserPrincipalName "$Sam@${domain}" -Path $Path \\\n` +
        `        -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true${whatif}\n` +
        `}\n\n` +
        `Get-ADUser -Identity $Sam -Properties Enabled,UserPrincipalName |\n` +
        `    Select-Object Name,SamAccountName,Enabled,UserPrincipalName`
      );
    },
    gui: [
      'Ouvrir Utilisateurs et ordinateurs Active Directory.',
      "Ouvrir l\u2019OU voulue puis cliquer droit > Nouveau > Utilisateur.",
      'Saisir pr\u00e9nom, nom et identifiant.',
      '\u00ab L\u2019utilisateur doit changer le mot de passe \u00bb : cocher cette option.',
    ],
    checks: [
      'Le script ne stocke pas le mot de passe dans le fichier.',
      "V\u00e9rifier que l\u2019OU existe avant cr\u00e9ation.",
    ],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-aduser',
  },

  // ── 4. Dossier partagé ───────────────────────────────────────────────────
  {
    id: 'shared-folder',
    icon: '\u25a3',
    category: 'Fichiers & imprimantes',
    title: 'Cr\u00e9er un dossier partag\u00e9',
    risk: 'caution',
    summary: 'Cr\u00e9e le dossier, le partage SMB et donne un acc\u00e8s \u00e0 un groupe AD.',
    fields: [
      { id: 'path',   label: 'Chemin local',        default: 'D:\\Partages\\Comptabilite' },
      { id: 'share',  label: 'Nom du partage',       default: 'Comptabilite' },
      { id: 'group',  label: 'Groupe AD autoris\u00e9', default: 'GG-Comptabilite-RW' },
      { id: 'access', label: 'Niveau de partage',    type: 'select', default: 'Change', options: [['Change', 'Modification'], ['Read', 'Lecture'], ['Full', 'Contr\u00f4le total']] },
    ],
    validate(v) {
      const errors = {};
      // validateWindowsLocalPath refuse les chemins UNC pour New-SmbShare
      const path  = validateWindowsLocalPath(v.path);  if (!path.ok)  errors.path  = path.error;
      const share = validateShareName(v.share);         if (!share.ok) errors.share = share.error;
      const group = validateGroupName(v.group);         if (!group.ok) errors.group = group.error;
      if (!['Change', 'Read', 'Full'].includes(v.access)) errors.access = "Niveau d\u2019acc\u00e8s invalide.";
      return errors;
    },
    generate(v) {
      if (!['Change', 'Read', 'Full'].includes(v.access)) throw new Error('Niveau d\u2019acc\u00e8s invalide.');
      const pathValidation = validateWindowsLocalPath(v.path);
      if (!pathValidation.ok) throw new Error(pathValidation.error);
      const path   = escPs(v.path);
      const share  = escPs(v.share);
      const group  = escPs(v.group);
      const access = v.access; // validated above
      return (
        `# Ex\u00e9cuter sur le serveur de fichiers en administrateur\n` +
        `$Path      = '${path}'\n` +
        `$ShareName = '${share}'\n` +
        `$Group     = '${group}'\n\n` +
        `# Cr\u00e9er le dossier s'il n'existe pas\n` +
        `if (-not (Test-Path -LiteralPath $Path)) {\n` +
        `    New-Item -Path $Path -ItemType Directory\n` +
        `}\n\n` +
        `# Cr\u00e9er le partage SMB s'il n'existe pas\n` +
        `if (-not (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue)) {\n` +
        `    New-SmbShare -Name $ShareName -Path $Path -FullAccess 'BUILTIN\\Administrators'\n` +
        `}\n\n` +
        `# D\u00e9finir l'acc\u00e8s au partage et NTFS\n` +
        `Grant-SmbShareAccess -Name $ShareName -AccountName $Group -AccessRight ${access} -Force\n` +
        `icacls $Path /grant "$($Group):(OI)(CI)M"\n\n` +
        `# V\u00e9rification\n` +
        `Get-SmbShare -Name $ShareName\n` +
        `Get-SmbShareAccess -Name $ShareName`
      );
    },
    gui: [
      "Cr\u00e9er d\u2019abord le dossier dans l\u2019Explorateur de fichiers.",
      'Cliquer droit > Propri\u00e9t\u00e9s > Partage > Partage avanc\u00e9.',
      '\u00ab Partager ce dossier \u00bb : cocher, d\u00e9finir le nom et r\u00e9gler les autorisations.',
      "Dans l\u2019onglet S\u00e9curit\u00e9, ajouter le groupe AD et ses permissions NTFS.",
    ],
    checks: [
      "Les permissions du partage et NTFS s\u2019additionnent : l\u2019acc\u00e8s r\u00e9el est le plus restrictif.",
      'Utilise id\u00e9alement des groupes, pas des utilisateurs individuels.',
    ],
    source: 'https://learn.microsoft.com/powershell/module/smbshare/new-smbshare',
  },

  // ── 5. Second contrôleur de domaine ─────────────────────────────────────
  {
    id: 'second-dc',
    icon: '\u21c4',
    category: 'Active Directory',
    title: 'Ajouter un deuxi\u00e8me contr\u00f4leur',
    risk: 'caution',
    summary: "Pr\u00e9pare la promotion d\u2019un serveur d\u00e9j\u00e0 joint au domaine.",
    fields: [
      { id: 'domain', label: 'Nom du domaine',         default: 'hopitalbn.lan' },
      { id: 'source', label: 'Contr\u00f4leur source (FQDN)', default: 'srvh1bn.hopitalbn.lan' },
    ],
    validate(v) {
      const errors = {};
      const dom = validateDomain(v.domain); if (!dom.ok) errors.domain = dom.error;
      // source doit être un FQDN valide (ou IPv4 — ici on valide en FQDN)
      const src = validateDomain(v.source); if (!src.ok) errors.source = `Le contr\u00f4leur source doit \u00eatre un FQDN valide (ex. : srvh1bn.hopitalbn.lan). ${src.error}`;
      return errors;
    },
    generate(v) {
      const domain = escPs(v.domain);
      const source = escPs(v.source);
      return (
        `# Conditions : IP statique, DNS vers le premier contr\u00f4leur et serveur d\u00e9j\u00e0 joint au domaine\n` +
        `# V\u00e9rifications\n` +
        `Resolve-DnsName '${source}'\n` +
        `Test-ComputerSecureChannel -Verbose\n` +
        `Test-NetConnection '${source}' -Port 135\n` +
        `Test-NetConnection '${source}' -Port 389\n\n` +
        `# Installer le r\u00f4le si n\u00e9cessaire\n` +
        `Install-WindowsFeature AD-Domain-Services -IncludeManagementTools\n\n` +
        `# Promouvoir le serveur \u2014 le mot de passe DSRM sera demand\u00e9\n` +
        `Install-ADDSDomainController \\\n` +
        `    -DomainName '${domain}' \\\n` +
        `    -ReplicationSourceDC '${source}' \\\n` +
        `    -InstallDns:$true \\\n` +
        `    -CreateDnsDelegation:$false \\\n` +
        `    -Credential (Get-Credential)\n\n` +
        `# Apr\u00e8s le red\u00e9marrage, v\u00e9rifier depuis un contr\u00f4leur de domaine :\n` +
        `# Get-ADDomainController -Filter *\n` +
        `# repadmin /replsummary`
      );
    },
    gui: [
      'Ouvrir Gestionnaire de serveur > Ajouter des r\u00f4les et fonctionnalit\u00e9s.',
      "Ajouter Services AD DS puis terminer l\u2019assistant.",
      'Cliquer sur la notification puis \u00ab Promouvoir ce serveur en contr\u00f4leur de domaine \u00bb.',
      "\u00ab Ajouter un contr\u00f4leur de domaine \u00e0 un domaine existant \u00bb : saisir le domaine et les identifiants.",
    ],
    checks: [
      'Ne pas utiliser un DNS public sur le serveur \u00e0 promouvoir.',
      'V\u00e9rifier le canal s\u00e9curis\u00e9 et les ports avant la promotion.',
      'Le serveur red\u00e9marre automatiquement si l\u2019installation r\u00e9ussit.',
    ],
    source: 'https://learn.microsoft.com/windows-server/identity/ad-ds/deploy/install-active-directory-domain-services--level-100',
  },

  // ── 6. Réparation Wi-Fi ──────────────────────────────────────────────────
  {
    id: 'wifi-repair',
    icon: '\u2341',
    category: 'D\u00e9pannage Windows',
    title: 'Diagnostiquer et r\u00e9initialiser le Wi-Fi',
    risk: 'caution',
    summary: 'V\u00e9rifie la carte et le service WLAN, puis red\u00e9marre la carte choisie.',
    fields: [
      { id: 'adapter', label: 'Nom de la carte Wi-Fi', default: 'Wi-Fi', help: "Utilise d\u2019abord le bloc diagnostic pour confirmer le nom." },
    ],
    validate(v) {
      const errors = {};
      const adapter = String(v.adapter ?? '').trim();
      if (!adapter) errors.adapter = 'Le nom de la carte ne peut pas \u00eatre vide.';
      else if (/[\x00-\x1f\x7f]/.test(adapter)) errors.adapter = 'Le nom de la carte contient un caract\u00e8re de contr\u00f4le non autoris\u00e9.';
      return errors;
    },
    generate(v) {
      const adapter = escPs(v.adapter);
      return (
        `# DIAGNOSTIC \u2014 ne modifie rien\n` +
        `Get-Service WlanSvc\n` +
        `Get-NetAdapter -Physical | Format-Table Name,Status,LinkSpeed,InterfaceDescription -Auto\n` +
        `netsh wlan show interfaces\n` +
        `netsh wlan show networks mode=bssid\n\n` +
        `# R\u00c9PARATION L\u00c9G\u00c8RE \u2014 red\u00e9marre le service WLAN et la carte choisie\n` +
        `Start-Service WlanSvc\n` +
        `Disable-NetAdapter -Name '${adapter}' -Confirm:$false\n` +
        `Start-Sleep -Seconds 3\n` +
        `Enable-NetAdapter -Name '${adapter}' -Confirm:$false\n\n` +
        `# Rechercher les p\u00e9riph\u00e9riques r\u00e9install\u00e9s ou nouvellement d\u00e9tect\u00e9s\n` +
        `pnputil /scan-devices\n\n` +
        `# V\u00e9rifier de nouveau les r\u00e9seaux\n` +
        `netsh wlan show networks mode=bssid`
      );
    },
    gui: [
      'Ouvrir Gestionnaire de p\u00e9riph\u00e9riques > Cartes r\u00e9seau.',
      "Rep\u00e9rer la carte Wi-Fi puis choisir D\u00e9sactiver l\u2019appareil et R\u00e9activer l\u2019appareil.",
      "Si cela ne r\u00e9sout rien : clic droit > D\u00e9sinstaller l\u2019appareil, puis Action > Rechercher les modifications sur le mat\u00e9riel.",
      "T\u00e9l\u00e9charger le pilote depuis le fabricant seulement si Windows ne r\u00e9installe pas la carte.",
    ],
    checks: [
      'Le nom de la carte doit \u00eatre exact avant la d\u00e9sactivation.',
      "La d\u00e9sinstallation du pilote est une solution de second niveau : commence toujours par red\u00e9marrer la carte.",
    ],
    source: 'https://learn.microsoft.com/windows-hardware/drivers/devtest/pnputil-command-syntax',
  },

  // ── 7. Politique de mots de passe ────────────────────────────────────────
  {
    id: 'gpo-password',
    icon: '\u26bf',
    category: 'GPO',
    title: 'Politique de mots de passe du domaine',
    risk: 'caution',
    summary: 'Pr\u00e9pare la politique par d\u00e9faut du domaine avec validation et aper\u00e7u.',
    fields: [
      { id: 'domain',  label: 'Nom du domaine',                          default: 'hopitalbn.lan' },
      { id: 'length',  label: 'Longueur minimale',                        type: 'number', default: '12', min: '1',  max: '256' },
      { id: 'lockout', label: 'Tentatives avant verrouillage',            type: 'number', default: '5',  min: '0',  max: '999',   help: '0 d\u00e9sactive le verrouillage.' },
      { id: 'minutes', label: 'Minutes de verrouillage',                  type: 'number', default: '30', min: '1',  max: '99999' },
    ],
    validate(v) {
      const errors = {};
      const dom  = validateDomain(v.domain);                             if (!dom.ok)  errors.domain  = dom.error;
      const len  = validateIntegerStrict(v.length,  1, 256, 'La longueur minimale');        if (!len.ok)  errors.length  = len.error;
      const lock = validateIntegerStrict(v.lockout, 0, 999, 'Les tentatives avant verrouillage'); if (!lock.ok) errors.lockout = lock.error;
      const min  = validateIntegerStrict(v.minutes, 1, 99999, 'Les minutes de verrouillage');  if (!min.ok)  errors.minutes = min.error;
      return errors;
    },
    generate(v) {
      // Refuse invalid data — no silent correction
      const lenR  = validateIntegerStrict(v.length,  1, 256,   'La longueur minimale');
      const lockR = validateIntegerStrict(v.lockout, 0, 999,   'Les tentatives');
      const minR  = validateIntegerStrict(v.minutes, 1, 99999, 'Les minutes');
      if (!lenR.ok)  throw new Error(`Longueur invalide : ${lenR.error}`);
      if (!lockR.ok) throw new Error(`Verrouillage invalide : ${lockR.error}`);
      if (!minR.ok)  throw new Error(`Minutes invalides : ${minR.error}`);
      const domain   = escPs(v.domain);
      const length   = lenR.value;
      const lockout  = lockR.value; // 0 is valid — preserved exactly
      const minutes  = minR.value;
      return (
        `Import-Module ActiveDirectory\n\n` +
        `# Aper\u00e7u de la politique actuelle\n` +
        `Get-ADDefaultDomainPasswordPolicy -Identity '${domain}'\n\n` +
        `# Appliquer la nouvelle politique\n` +
        `Set-ADDefaultDomainPasswordPolicy -Identity '${domain}' \\\n` +
        `    -ComplexityEnabled $true \\\n` +
        `    -MinPasswordLength ${length} \\\n` +
        `    -LockoutThreshold ${lockout} \\\n` +
        `    -LockoutDuration (New-TimeSpan -Minutes ${minutes}) \\\n` +
        `    -LockoutObservationWindow (New-TimeSpan -Minutes ${minutes})\n\n` +
        `# V\u00e9rifier apr\u00e8s application\n` +
        `Get-ADDefaultDomainPasswordPolicy -Identity '${domain}'`
      );
    },
    gui: [
      'Ouvrir Gestion de la strat\u00e9gie de groupe.',
      "D\u00e9velopper la for\u00eat, le domaine, puis clic droit sur Default Domain Policy > Modifier.",
      'Aller \u00e0 Configuration ordinateur > Param\u00e8tres Windows > Param\u00e8tres de s\u00e9curit\u00e9 > Strat\u00e9gies de compte.',
      'Configurer les strat\u00e9gies de mot de passe et de verrouillage de compte.',
    ],
    checks: [
      "Cette politique touche les utilisateurs du domaine : teste d\u2019abord les seuils en laboratoire.",
      "Une strat\u00e9gie de mot de passe fine est pr\u00e9f\u00e9rable lorsqu\u2019un groupe sp\u00e9cifique requiert une r\u00e8gle diff\u00e9rente.",
    ],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/set-addefaultdomainpasswordpolicy',
  },
];

// ── 8. Analyse de disque ─────────────────────────────────────────────────────
function createDiskScanTool() {
  return {
    id: 'disk-scan',
    icon: '\u25eb',
    category: 'Stockage',
    title: 'Analyser et lib\u00e9rer de l\u2019espace disque',
    risk: 'diagnostic',
    summary: 'Classe les fichiers et dossiers lourds, rep\u00e8re les artefacts recr\u00e9ables et propose une corbeille contr\u00f4l\u00e9e.',
    fields: [
      { id: 'path',    label: 'Disque ou dossier \u00e0 analyser',              default: 'C:\\', help: 'Exemples : C:\\, C:\\Users\\Blaise\\Projet ou D:\\.' },
      { id: 'top',     label: 'Nombre maximal de lignes dans le rapport',      type: 'number', default: '50',  min: '5',   max: '200',    help: 'Le scan parcourt les \u00e9l\u00e9ments; ce nombre limite seulement l\u2019affichage.' },
      { id: 'minSize', label: 'Taille minimale en Go',                         type: 'number', default: '0.5', min: '0',   max: '100000', step: '0.1', help: '0 inclut aussi les petits \u00e9l\u00e9ments; 0,5 cible les \u00e9l\u00e9ments d\u2019au moins 500\u00a0Mo.' },
      { id: 'report',  label: 'Format du rapport',                             type: 'select', default: 'both', options: [['both', 'CSV + HTML \u2014 recommand\u00e9'], ['csv', 'CSV seulement'], ['html', 'HTML seulement']] },
      { id: 'action',  label: 'Apr\u00e8s le rapport',                         type: 'select', default: 'report', options: [['report', 'Rapport uniquement \u2014 recommand\u00e9'], ['recycle', 'Permettre une s\u00e9lection vers la corbeille']] },
    ],
    validate(v) {
      const errors = {};
      const path    = validatePath(v.path);                                          if (!path.ok)    errors.path    = path.error;
      const top     = validateIntegerStrict(v.top, 5, 200, 'Le nombre de lignes');  if (!top.ok)     errors.top     = top.error;
      const minSize = validateFloatStrict(v.minSize, 0, 100000, 'La taille minimale'); if (!minSize.ok) errors.minSize = minSize.error;
      if (!['both', 'csv', 'html'].includes(v.report))    errors.report = 'Format de rapport invalide.';
      if (!['report', 'recycle'].includes(v.action))      errors.action = 'Action invalide.';
      return errors;
    },
    generate(v) {
      // Refuse invalid data — no silent correction
      const topR     = validateIntegerStrict(v.top, 5, 200, 'Le nombre de lignes');
      const minSizeR = validateFloatStrict(v.minSize, 0, 100000, 'La taille minimale');
      if (!topR.ok)     throw new Error(`Nombre de lignes invalide : ${topR.error}`);
      if (!minSizeR.ok) throw new Error(`Taille minimale invalide : ${minSizeR.error}`);
      if (!['both', 'csv', 'html'].includes(v.report)) throw new Error('Format de rapport invalide.');
      if (!['report', 'recycle'].includes(v.action))   throw new Error('Action invalide.');

      const top     = topR.value;
      const minSize = minSizeR.value;
      const report  = v.report;
      const action  = v.action;
      const lines = [
        '# KJEMO IT TOOLKIT \u2014 ANALYSE DE DISQUE',
        '# Windows PowerShell 5.1 ou PowerShell 7 sur Windows',
        '# Lecture et rapport par d\u00e9faut. Aucune suppression automatique.',
        '',
        "$TargetPath = '" + escapePowerShellSingleQuoted(v.path || 'C:\\') + "'",
        '$Top = ' + top,
        '$MinimumSizeGB = ' + minSize,
        "$ReportFormat = '" + report + "'",
        '$AllowRecycleSelection = $' + (action === 'recycle' ? 'true' : 'false'),
        "$Desktop = [Environment]::GetFolderPath('Desktop')",
        "$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'",
        "$ReportBase = Join-Path $Desktop ('KJEMO-Disk-Scan-' + $Stamp)",
        '',
        'function Test-PathWithin {',
        '    param([string]$Path, [string]$Root)',
        '    $PathFull = [IO.Path]::GetFullPath($Path)',
        '    $RootFull = [IO.Path]::GetFullPath($Root)',
        // Normalize: preserve trailing \ for drive roots (C:\), strip for others
        "    $PathNorm = if ($PathFull -match '^[A-Za-z]:\\\\$') { $PathFull } else { $PathFull.TrimEnd('\\') }",
        "    $RootNorm = if ($RootFull -match '^[A-Za-z]:\\\\$') { $RootFull } else { $RootFull.TrimEnd('\\') }",
        // RootSep for prefix check: drive root already ends with \; others need it appended
        "    $RootSep = if ($RootNorm.EndsWith('\\')) { $RootNorm } else { $RootNorm + '\\' }",
        '    return $PathNorm.Equals($RootNorm, [StringComparison]::OrdinalIgnoreCase) -or',
        '        $PathNorm.StartsWith($RootSep, [StringComparison]::OrdinalIgnoreCase)',
        '}',
        '',
        '$ProtectedRoots = @(',
        '    $env:SystemRoot,',
        '    $env:ProgramData,',
        '    $env:ProgramFiles,',
        "    [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),",
        "    (Join-Path $env:SystemDrive '$Recycle.Bin')",
        ') | Where-Object { $_ -and (Test-Path -LiteralPath $_) }',
        '',
        'function Get-ProtectionReason {',
        '    param([string]$FullPath)',
        "    $Segments = $FullPath.TrimEnd('\\').Split([IO.Path]::DirectorySeparatorChar)",
        "    $Leaf = Split-Path -Leaf $FullPath.TrimEnd('\\')",
        '    $LowerLeaf = $Leaf.ToLowerInvariant()',
        "    if ($Segments -contains '.git') { return '.git prot\u00e9g\u00e9' }",
        "    if ($Segments | Where-Object { $_ -like '.env*' }) { return '.env / configuration sensible prot\u00e9g\u00e9' }",
        "    if ($LowerLeaf -like '*backup*' -or $LowerLeaf -like '*sauvegarde*') { return 'sauvegarde prot\u00e9g\u00e9e' }",
        "    $SensitiveExtensions = @('.bak', '.backup', '.db', '.dump', '.ldf', '.mdf', '.ndf', '.sql', '.sqlite', '.sqlite3')",
        "    if ($SensitiveExtensions -contains ([IO.Path]::GetExtension($Leaf).ToLowerInvariant())) { return 'base ou fichier de sauvegarde prot\u00e9g\u00e9' }",
        '    foreach ($Root in $ProtectedRoots) {',
        "        if (Test-PathWithin -Path $FullPath -Root $Root) { return 'zone syst\u00e8me prot\u00e9g\u00e9e' }",
        '    }',
        '    return $null',
        '}',
        '',
        'function Get-Classification {',
        '    param([string]$FullPath, [bool]$IsDirectory)',
        "    $Segments = $FullPath.TrimEnd('\\').Split([IO.Path]::DirectorySeparatorChar)",
        "    $Leaf = Split-Path -Leaf $FullPath.TrimEnd('\\')",
        "    $ArtifactNames = @('node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.cache', '__pycache__', 'vendor')",
        '    if ($IsDirectory -and ($ArtifactNames -contains $Leaf.ToLowerInvariant())) {',
        '        return "Artefact recr\u00e9able de projet \u2014 $Leaf"',
        '    }',
        '    if ($Segments | Where-Object { $ArtifactNames -contains $_.ToLowerInvariant() }) {',
        "        return 'Fichier dans un artefact recr\u00e9able de projet'",
        '    }',
        "    if ($IsDirectory) { return 'Dossier volumineux \u2014 \u00e0 examiner' }",
        "    return 'Fichier volumineux \u2014 \u00e0 examiner'",
        '}',
        '',
        '$TargetItem = Get-Item -LiteralPath $TargetPath -Force -ErrorAction Stop',
        "if (-not $TargetItem.PSIsContainer) { throw 'Le chemin doit \u00eatre un disque ou un dossier.' }",
        "if ($TargetItem.FullName -match '^[A-Za-z]:\\\\?$' -and $TargetItem.FullName -eq ($env:SystemDrive + '\\')) { Write-Warning 'Un scan de la racine syst\u00e8me peut \u00eatre tr\u00e8s long.' }",
        '$TargetResolved = $TargetItem.FullName',
        "if ($TargetResolved.Length -gt 3) { $TargetResolved = $TargetResolved.TrimEnd('\\') }",
        '$MinimumSizeBytes = [int64]($MinimumSizeGB * 1GB)',
        '',
        'Write-Host "Analyse de $TargetResolved en cours..." -ForegroundColor Cyan',
        '$Files = @(Get-ChildItem -LiteralPath $TargetResolved -File -Force -Recurse -ErrorAction SilentlyContinue)',
        '$DirectorySizes = @{}',
        '',
        '# Une seule \u00e9num\u00e9ration des fichiers; les tailles des dossiers sont additionn\u00e9es par parent.',
        'foreach ($File in $Files) {',
        '    $Directory = Split-Path -Parent $File.FullName',
        '    while ($Directory -and (Test-PathWithin -Path $Directory -Root $TargetResolved)) {',
        '        if (-not $Directory.Equals($TargetResolved, [StringComparison]::OrdinalIgnoreCase)) {',
        '            if (-not $DirectorySizes.ContainsKey($Directory)) { $DirectorySizes[$Directory] = [int64]0 }',
        '            $DirectorySizes[$Directory] += [int64]$File.Length',
        '        }',
        '        if ($Directory.Equals($TargetResolved, [StringComparison]::OrdinalIgnoreCase)) { break }',
        '        $Parent = Split-Path -Parent $Directory',
        '        if ($Parent -eq $Directory) { break }',
        '        $Directory = $Parent',
        '    }',
        '}',
        '',
        '$DirectoryResults = foreach ($Entry in $DirectorySizes.GetEnumerator()) {',
        '    $Path = [string]$Entry.Key',
        '    $Bytes = [int64]$Entry.Value',
        '    if ($Bytes -ge $MinimumSizeBytes) {',
        '        $Protection = Get-ProtectionReason -FullPath $Path',
        '        $Classification = Get-Classification -FullPath $Path -IsDirectory $true',
        '        [PSCustomObject]@{',
        "            Type = 'Dossier'; Path = $Path; TailleGB = [math]::Round($Bytes / 1GB, 2); TailleMB = [math]::Round($Bytes / 1MB, 0)",
        '            Classification = $Classification; Protege = [bool]$Protection; MotifProtection = $Protection',
        "            SelectionPossible = [bool](-not $Protection -and $Classification -like 'Artefact recr\u00e9able*')",
        '        }',
        '    }',
        '}',
        '',
        '$FileResults = foreach ($File in $Files) {',
        '    if ([int64]$File.Length -ge $MinimumSizeBytes) {',
        '        $Protection = Get-ProtectionReason -FullPath $File.FullName',
        '        [PSCustomObject]@{',
        "            Type = 'Fichier'; Path = $File.FullName; TailleGB = [math]::Round($File.Length / 1GB, 2); TailleMB = [math]::Round($File.Length / 1MB, 0)",
        '            Classification = Get-Classification -FullPath $File.FullName -IsDirectory $false; Protege = [bool]$Protection; MotifProtection = $Protection',
        '            SelectionPossible = [bool](-not $Protection)',
        '        }',
        '    }',
        '}',
        '',
        '$Results = @($DirectoryResults) + @($FileResults) | Sort-Object TailleGB -Descending',
        '$ReportResults = @($Results | Select-Object -First $Top)',
        "if ($ReportResults.Count -eq 0) { Write-Warning 'Aucun \u00e9l\u00e9ment ne correspond \u00e0 la taille minimale.' }",
        'else { $ReportResults | Format-Table Type,TailleGB,Classification,Protege,Path -AutoSize }',
        '',
        '# Exporter les objets non format\u00e9s conserve des colonnes exploitables dans Excel et HTML.',
        "if ($ReportFormat -in @('csv', 'both')) {",
        '    $CsvPath = "$ReportBase.csv"',
        '    $ReportResults | Export-Csv -LiteralPath $CsvPath -UseCulture -NoTypeInformation -Encoding UTF8',
        '    Write-Host "CSV cr\u00e9\u00e9 : $CsvPath" -ForegroundColor Green',
        '}',
        "if ($ReportFormat -in @('html', 'both')) {",
        '    $HtmlPath = "$ReportBase.html"',
        "    $Css = '<style>body{font-family:Segoe UI,Arial;margin:2rem} table{border-collapse:collapse} th,td{border:1px solid #bbb;padding:.4rem;text-align:left} th{background:#eee}</style>'",
        "    $ReportResults | ConvertTo-Html -Title 'KJEMO \u2014 Analyse de disque' -Head $Css -PreContent \"<h1>Analyse de $TargetResolved</h1><p>G\u00e9n\u00e9r\u00e9 le $(Get-Date)</p>\" | Out-File -LiteralPath $HtmlPath -Encoding UTF8",
        '    Write-Host "HTML cr\u00e9\u00e9 : $HtmlPath" -ForegroundColor Green',
        '}',
        '',
        'if ($AllowRecycleSelection -and $ReportResults.Count -gt 0) {',
        "    $Candidates = @($ReportResults | Where-Object { $_.SelectionPossible -eq $true })",
        "    $CandidateFolders = @($Candidates | Where-Object { $_.Type -eq 'Dossier' })",
        '    $Candidates = @($Candidates | Where-Object {',
        '        $CurrentCandidate = $_',
        "        $CurrentCandidate.Type -eq 'Dossier' -or -not ($CandidateFolders | Where-Object { Test-PathWithin -Path $CurrentCandidate.Path -Root $_.Path })",
        '    })',
        // BUG LOT 0 CORRIGÉ : n\u2019est → n''est
        "    if ($Candidates.Count -eq 0) { Write-Host 'Aucun candidat non prot\u00e9g\u00e9 n''est propos\u00e9 pour la corbeille.' -ForegroundColor Yellow }",
        '    else {',
        '        Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction Stop',
        "        Write-Host ''",
        "        Write-Host 'Candidats propos\u00e9s (les \u00e9l\u00e9ments prot\u00e9g\u00e9s sont exclus) :' -ForegroundColor Yellow",
        '        for ($Index = 0; $Index -lt $Candidates.Count; $Index++) {',
        '            Write-Host ("[{0}] {1} \u2014 {2} Go \u2014 {3}" -f ($Index + 1), $Candidates[$Index].Type, $Candidates[$Index].TailleGB, $Candidates[$Index].Path)',
        '        }',
        '        $Confirmation = Read-Host "Pour continuer, tape exactement CONFIRMER; toute autre r\u00e9ponse annule"',
        "        if ($Confirmation -cne 'CONFIRMER') { Write-Host 'Op\u00e9ration annul\u00e9e : aucun \u00e9l\u00e9ment d\u00e9plac\u00e9.' -ForegroundColor Cyan }",
        '        else {',
        "            $Selection = Read-Host 'Num\u00e9ros \u00e0 envoyer \u00e0 la corbeille, s\u00e9par\u00e9s par des virgules (exemple : 1,3)'",
        "            $Indexes = $Selection -split '[,; ]+' | ForEach-Object { $Parsed = 0; if ([int]::TryParse($_, [ref]$Parsed)) { $Parsed } }",
        '            foreach ($Number in $Indexes) {',
        '                if ($Number -lt 1 -or $Number -gt $Candidates.Count) { Write-Warning "Num\u00e9ro ignor\u00e9 : $Number"; continue }',
        '                $Candidate = $Candidates[$Number - 1]',
        '                try {',
        "                    if ($Candidate.Type -eq 'Dossier') {",
        '                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)',
        '                    }',
        '                    else {',
        '                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)',
        '                    }',
        '                    Write-Host "Envoy\u00e9 \u00e0 la corbeille : $($Candidate.Path)" -ForegroundColor Green',
        '                }',
        '                catch { Write-Warning "\u00c9chec pour $($Candidate.Path) : $($_.Exception.Message)" }',
        '            }',
        '        }',
        '    }',
        '}',
        '',
        "Write-Host ''",
        'Write-Host "Termin\u00e9. Les rapports restent sur le Bureau; v\u00e9rifie-les avant toute autre action." -ForegroundColor Cyan',
      ];
      return lines.join('\n');
    },
    gui: [
      'Ouvrir Param\u00e8tres > Syst\u00e8me > Stockage pour un r\u00e9sum\u00e9 rapide.',
      "Pour un dossier pr\u00e9cis, ouvrir PowerShell et utiliser le chemin exact; l\u2019Explorateur peut aussi afficher les propri\u00e9t\u00e9s du disque.",
      'Dans un projet SaaS, examiner en priorit\u00e9 node_modules, .next, dist, build, out, coverage et les caches.',
      'Ne s\u00e9lectionner pour la corbeille que des \u00e9l\u00e9ments non prot\u00e9g\u00e9s; ne jamais toucher \u00e0 .git, .env, bases ou sauvegardes.',
    ],
    checks: [
      'Compatible avec Windows PowerShell 5.1 ou PowerShell 7 sur Windows; le scan peut prendre du temps sur un gros disque.',
      'Le mode recommand\u00e9 produit seulement un rapport CSV/HTML et ne supprime rien.',
      'Les chemins contenant .git, .env, bases, sauvegardes et zones syst\u00e8me sont marqu\u00e9s prot\u00e9g\u00e9s.',
      'La corbeille demande CONFIRMER puis des num\u00e9ros; les \u00e9l\u00e9ments verrouill\u00e9s sont signal\u00e9s.',
    ],
    source: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-childitem',
  };
}

tools.push(createDiskScanTool());
