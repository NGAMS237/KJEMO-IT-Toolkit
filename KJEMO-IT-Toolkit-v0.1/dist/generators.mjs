/**
 * generators.mjs — LOT 0 · KJEMO IT Toolkit
 * -------------------------------------------
 * Module ES canonique — placé dans dist/ pour que GitHub Pages puisse le servir.
 * Importé par :
 *   dist/app.js  →  import { ... } from './generators.mjs';
 *   tests        →  import { ... } from '../dist/generators.mjs';
 *
 * Aucune dépendance DOM — utilisable en Node.js sans shim.
 *
 * FICHIER UNIQUE — src/generators.mjs ne doit pas exister.
 */

// ---------------------------------------------------------------------------
// Fonctions d'échappement
// ---------------------------------------------------------------------------

/**
 * Encode une valeur utilisateur en expression PowerShell Base64 UTF-8.
 * Cette représentation préserve exactement tous les points de code Unicode :
 *   U+2018 ('), U+2019 ('), accents, $, backtick, guillemets, retours à la ligne, etc.
 *
 * Exemple d'expression générée :
 *   [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('T2...'))
 *
 * Utilisé pour toutes les valeurs fournies par l'utilisateur dans les scripts PS.
 */
export function psB64(v) {
  const bytes = new TextEncoder().encode(String(v ?? ''));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}'))`;
}

/**
 * assertValid : appelle tool.validate(v) et lève une exception si la moindre
 * erreur est détectée. Utilisé par chacun des huit generate() pour garantir
 * qu'aucun script n'est produit avec des données invalides.
 *
 * @param {object} tool   - l'objet outil (doit avoir une méthode validate)
 * @param {object} v      - les valeurs à valider
 */
export function assertValid(tool, v) {
  const errors = tool.validate(v);
  const keys = Object.keys(errors);
  if (keys.length > 0) {
    const msgs = keys.map((k) => `${k} : ${errors[k]}`).join(' | ');
    throw new Error(`Entrée invalide — ${msgs}`);
  }
}

/**
 * escapePowerShellSingleQuoted — conservé pour compatibilité et tests de bas niveau.
 * NE PAS utiliser pour intégrer des valeurs utilisateur dans les scripts générés :
 * utiliser psB64() à la place (préserve exactement l'Unicode).
 *
 * @deprecated Utiliser psB64() pour les valeurs utilisateur.
 */
export function escapePowerShellSingleQuoted(v) {
  return String(v ?? '').replace(/'/g, "''");
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
  return text.replace(/\\\n/g, '`\n');
}

/**
 * Encode les caractères HTML spéciaux pour injection sûre dans innerHTML.
 */
export function textToCode(text) {
  return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
}

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
      assertValid(this, v);
      const px = validateIntegerStrict(v.prefix, 1, 32, 'Le préfixe réseau');
      const prefix  = px.value;
      // User-supplied strings: encoded as Base64 to preserve Unicode exactly
      const adapter = psB64(v.adapter);
      const ip      = psB64(v.ip);
      const gateway = psB64(v.gateway);
      const dns     = psB64(v.dns);
      return (
        `# Exécuter PowerShell en administrateur\n` +
        `$Adapter = ${adapter}\n` +
        `$IP      = ${ip}\n` +
        `$Gateway = ${gateway}\n` +
        `$DNS     = ${dns}\n\n` +
        `# Vérification préalable\n` +
        `Get-NetAdapter\n` +
        `Get-NetIPConfiguration -InterfaceAlias $Adapter\n\n` +
        `# Désactiver DHCP et ajouter l'adresse statique\n` +
        `Set-NetIPInterface -InterfaceAlias $Adapter -AddressFamily IPv4 -Dhcp Disabled\n` +
        `New-NetIPAddress -InterfaceAlias $Adapter -IPAddress $IP -PrefixLength ${prefix} -DefaultGateway $Gateway\n\n` +
        `# Définir le DNS\n` +
        `Set-DnsClientServerAddress -InterfaceAlias $Adapter -ServerAddresses $DNS\n\n` +
        `# Vérification\n` +
        `Get-NetIPConfiguration -InterfaceAlias $Adapter`
      );
    },
    gui: [
      'Ouvrir Paramètres > Réseau et Internet > Paramètres réseau avancés.',
      'Cliquer sur la carte concernée puis Modifier à côté de l\u2019attribution IP.',
      'Choisir Manuel, activer IPv4 et saisir IP, préfixe, passerelle et DNS.',
      'Enregistrer puis ouvrir une console et vérifier avec ipconfig /all.',
    ],
    checks: [
      'La carte visée doit être la bonne : une erreur peut couper l\u2019accès réseau.',
      'Si cette adresse existe déjà, supprimer ou modifier l\u2019ancienne configuration avant de lancer New-NetIPAddress.',
    ],
    source: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netipaddress',
  },

  // ── 2. Créer une OU ─────────────────────────────────────────────────────
  {
    id: 'ad-ou',
    icon: '\u2318',
    category: 'Active Directory',
    title: 'Créer une unité d\u2019organisation',
    risk: 'safe',
    summary: 'Crée une OU protégée contre les suppressions accidentelles.',
    fields: [
      { id: 'domain', label: 'Nom du domaine',               default: 'hopitalbn.lan' },
      { id: 'ou',     label: 'Nom de la nouvelle OU',         default: 'Employes' },
      { id: 'parent', label: 'OU parente (facultatif)',        default: '', help: 'Exemple\u00a0: Administration. Laisser vide pour la racine du domaine.' },
      { id: 'whatif', label: 'Mode test', type: 'select',     default: 'true', options: [['true', 'Oui \u2014 ne rien créer'], ['false', 'Non \u2014 créer réellement']] },
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
      assertValid(this, v);

      const dn = domainToDn(v.domain);
      // LDAP-escape the OU component names (RFC 4514)
      const ouLdap     = escapeLdapRdn(v.ou);
      const parentLdap = v.parent ? escapeLdapRdn(v.parent) : null;
      // Full LDAP Distinguished Names
      const pathDn = parentLdap ? `OU=${parentLdap},${dn}` : dn;
      const fullDn = `OU=${ouLdap},${pathDn}`;

      // User values encoded as Base64 PS expressions
      const ouExpr     = psB64(v.ou);     // -Name : le nom simple
      const pathDnExpr = psB64(pathDn);   // -Path : DN du conteneur parent
      const fullDnExpr = psB64(fullDn);   // -Identity : DN complet de la nouvelle OU

      const whatif = v.whatif === 'true' ? ' -WhatIf' : '';
      return (
        `Import-Module ActiveDirectory\n\n` +
        `$OuName = ${ouExpr}\n` +
        `$OuPath = ${pathDnExpr}\n` +
        `$OuDn   = ${fullDnExpr}\n\n` +
        `if (Get-ADOrganizationalUnit -Identity $OuDn -ErrorAction SilentlyContinue) {\n` +
        `    Write-Warning "L'OU existe déjà : $OuDn"\n` +
        `}\n` +
        `else {\n` +
        `    New-ADOrganizationalUnit -Name $OuName -Path $OuPath -ProtectedFromAccidentalDeletion $true${whatif}\n` +
        `}\n\n` +
        `Get-ADOrganizationalUnit -Identity $OuDn`
      );
    },
    gui: [
      'Ouvrir Gestionnaire de serveur > Outils > Utilisateurs et ordinateurs Active Directory.',
      'Développer le domaine puis cliquer droit sur le conteneur parent.',
      'Choisir Nouveau > Unité d\u2019organisation.',
      'Saisir le nom et conserver la protection contre la suppression accidentelle.',
    ],
    checks: [
      'Le module ActiveDirectory est disponible sur un contrôleur de domaine ou avec RSAT.',
      'Créer l\u2019OU parente avant une sous-OU.',
    ],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adorganizationalunit',
  },

  // ── 3. Créer un utilisateur AD ───────────────────────────────────────────
  {
    id: 'ad-user',
    icon: '\u25c9',
    category: 'Active Directory',
    title: 'Créer un utilisateur AD',
    risk: 'caution',
    summary: 'Crée un utilisateur, demande le mot de passe localement et force son changement à la première ouverture.',
    fields: [
      { id: 'domain',    label: 'Nom du domaine',                      default: 'hopitalbn.lan' },
      { id: 'ou',        label: "Nom de l\u2019OU",                    default: 'Employes' },
      { id: 'firstName', label: 'Prénom',                               default: 'Marie' },
      { id: 'lastName',  label: 'Nom',                                  default: 'Tremblay' },
      { id: 'sam',       label: 'Identifiant (SamAccountName)',         default: 'mtremblay' },
      { id: 'whatif',    label: 'Mode test', type: 'select',            default: 'true', options: [['true', 'Oui \u2014 ne rien créer'], ['false', 'Non \u2014 créer réellement']] },
    ],
    validate(v) {
      const errors = {};
      const dom  = validateDomain(v.domain);          if (!dom.ok)  errors.domain    = dom.error;
      const ou   = validateOuName(v.ou);               if (!ou.ok)   errors.ou        = ou.error;
      const sam  = validateSamAccountName(v.sam);      if (!sam.ok)  errors.sam       = sam.error;
      const fn = String(v.firstName ?? '').trim();
      const ln = String(v.lastName  ?? '').trim();
      if (!fn) errors.firstName = 'Le prénom ne peut pas être vide.';
      else if (fn.length > 64) errors.firstName = 'Le prénom ne doit pas dépasser 64 caractères.';
      else if (/[\x00-\x1f\x7f]/.test(fn)) errors.firstName = 'Le prénom contient un caractère de contrôle non autorisé.';
      if (!ln) errors.lastName  = 'Le nom ne peut pas être vide.';
      else if (ln.length > 64) errors.lastName  = 'Le nom ne doit pas dépasser 64 caractères.';
      else if (/[\x00-\x1f\x7f]/.test(ln)) errors.lastName  = 'Le nom contient un caractère de contrôle non autorisé.';
      if (v.whatif !== 'true' && v.whatif !== 'false') errors.whatif = 'Mode test invalide.';
      return errors;
    },
    generate(v) {
      assertValid(this, v);

      // LDAP-correct path DN for -Path parameter
      const ouLdap = escapeLdapRdn(v.ou);
      const pathDn = `OU=${ouLdap},${domainToDn(v.domain)}`;

      // User values as Base64 PS expressions
      const firstNameExpr = psB64(v.firstName);
      const lastNameExpr  = psB64(v.lastName);
      const samExpr       = psB64(v.sam);
      const domainExpr    = psB64(v.domain);
      const pathDnExpr    = psB64(pathDn);

      const whatif = v.whatif === 'true' ? ' -WhatIf' : '';
      return (
        `Import-Module ActiveDirectory\n\n` +
        `$FirstName = ${firstNameExpr}\n` +
        `$LastName  = ${lastNameExpr}\n` +
        `$Sam       = ${samExpr}\n` +
        `$Domain    = ${domainExpr}\n` +
        `$Path      = ${pathDnExpr}\n` +
        `$UserName  = "$FirstName $LastName"\n` +
        `$Password  = Read-Host 'Mot de passe temporaire' -AsSecureString\n\n` +
        `if (Get-ADUser -Filter {SamAccountName -eq $Sam} -ErrorAction SilentlyContinue) {\n` +
        `    Write-Warning "L'utilisateur $Sam existe déjà."\n` +
        `}\n` +
        `else {\n` +
        `    New-ADUser -Name $UserName -GivenName $FirstName -Surname $LastName \\\n` +
        `        -SamAccountName $Sam -UserPrincipalName "$Sam@$Domain" -Path $Path \\\n` +
        `        -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true${whatif}\n` +
        `}\n\n` +
        `Get-ADUser -Identity $Sam -Properties Enabled,UserPrincipalName |\n` +
        `    Select-Object Name,SamAccountName,Enabled,UserPrincipalName`
      );
    },
    gui: [
      'Ouvrir Utilisateurs et ordinateurs Active Directory.',
      "Ouvrir l\u2019OU voulue puis cliquer droit > Nouveau > Utilisateur.",
      'Saisir prénom, nom et identifiant.',
      '\u00ab L\u2019utilisateur doit changer le mot de passe \u00bb : cocher cette option.',
    ],
    checks: [
      'Le script ne stocke pas le mot de passe dans le fichier.',
      "Vérifier que l\u2019OU existe avant création.",
    ],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-aduser',
  },

  // ── 4. Dossier partagé ───────────────────────────────────────────────────
  {
    id: 'shared-folder',
    icon: '\u25a3',
    category: 'Fichiers & imprimantes',
    title: 'Créer un dossier partagé',
    risk: 'caution',
    summary: 'Crée le dossier, le partage SMB et donne un accès à un groupe AD.',
    fields: [
      { id: 'path',   label: 'Chemin local',        default: 'D:\\Partages\\Comptabilite' },
      { id: 'share',  label: 'Nom du partage',       default: 'Comptabilite' },
      { id: 'group',  label: 'Groupe AD autorisé',   default: 'GG-Comptabilite-RW' },
      { id: 'access', label: 'Niveau de partage',    type: 'select', default: 'Change', options: [['Change', 'Modification'], ['Read', 'Lecture'], ['Full', 'Contrôle total']] },
    ],
    validate(v) {
      const errors = {};
      const path  = validateWindowsLocalPath(v.path);  if (!path.ok)  errors.path  = path.error;
      const share = validateShareName(v.share);         if (!share.ok) errors.share = share.error;
      const group = validateGroupName(v.group);         if (!group.ok) errors.group = group.error;
      if (!['Change', 'Read', 'Full'].includes(v.access)) errors.access = "Niveau d\u2019accès invalide.";
      return errors;
    },
    generate(v) {
      assertValid(this, v);
      const access = v.access; // validated: one of Change, Read, Full (ASCII-safe)
      const pathExpr  = psB64(v.path);
      const shareExpr = psB64(v.share);
      const groupExpr = psB64(v.group);
      return (
        `# Exécuter sur le serveur de fichiers en administrateur\n` +
        `$Path      = ${pathExpr}\n` +
        `$ShareName = ${shareExpr}\n` +
        `$Group     = ${groupExpr}\n\n` +
        `# Créer le dossier s'il n'existe pas\n` +
        `if (-not (Test-Path -LiteralPath $Path)) {\n` +
        `    New-Item -Path $Path -ItemType Directory\n` +
        `}\n\n` +
        `# Créer le partage SMB s'il n'existe pas\n` +
        `if (-not (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue)) {\n` +
        `    New-SmbShare -Name $ShareName -Path $Path -FullAccess 'BUILTIN\\Administrators'\n` +
        `}\n\n` +
        `# Définir l'accès au partage et NTFS\n` +
        `Grant-SmbShareAccess -Name $ShareName -AccountName $Group -AccessRight ${access} -Force\n` +
        `icacls $Path /grant "$($Group):(OI)(CI)M"\n\n` +
        `# Vérification\n` +
        `Get-SmbShare -Name $ShareName\n` +
        `Get-SmbShareAccess -Name $ShareName`
      );
    },
    gui: [
      "Créer d\u2019abord le dossier dans l\u2019Explorateur de fichiers.",
      'Cliquer droit > Propriétés > Partage > Partage avancé.',
      '\u00ab Partager ce dossier \u00bb : cocher, définir le nom et régler les autorisations.',
      "Dans l\u2019onglet Sécurité, ajouter le groupe AD et ses permissions NTFS.",
    ],
    checks: [
      "Les permissions du partage et NTFS s\u2019additionnent : l\u2019accès réel est le plus restrictif.",
      'Utilise idéalement des groupes, pas des utilisateurs individuels.',
    ],
    source: 'https://learn.microsoft.com/powershell/module/smbshare/new-smbshare',
  },

  // ── 5. Second contrôleur de domaine ─────────────────────────────────────
  {
    id: 'second-dc',
    icon: '\u21c4',
    category: 'Active Directory',
    title: 'Ajouter un deuxième contrôleur',
    risk: 'caution',
    summary: "Prépare la promotion d\u2019un serveur déjà joint au domaine.",
    fields: [
      { id: 'domain', label: 'Nom du domaine',         default: 'hopitalbn.lan' },
      { id: 'source', label: 'Contrôleur source (FQDN)', default: 'srvh1bn.hopitalbn.lan' },
    ],
    validate(v) {
      const errors = {};
      const dom = validateDomain(v.domain); if (!dom.ok) errors.domain = dom.error;
      const src = validateDomain(v.source); if (!src.ok) errors.source = `Le contrôleur source doit être un FQDN valide (ex. : srvh1bn.hopitalbn.lan). ${src.error}`;
      return errors;
    },
    generate(v) {
      assertValid(this, v);
      const domainExpr = psB64(v.domain);
      const sourceExpr = psB64(v.source);
      return (
        `# Conditions : IP statique, DNS vers le premier contrôleur et serveur déjà joint au domaine\n` +
        `$Domain = ${domainExpr}\n` +
        `$Source = ${sourceExpr}\n\n` +
        `# Vérifications\n` +
        `Resolve-DnsName $Source\n` +
        `Test-ComputerSecureChannel -Verbose\n` +
        `Test-NetConnection $Source -Port 135\n` +
        `Test-NetConnection $Source -Port 389\n\n` +
        `# Installer le rôle si nécessaire\n` +
        `Install-WindowsFeature AD-Domain-Services -IncludeManagementTools\n\n` +
        `# Promouvoir le serveur — le mot de passe DSRM sera demandé\n` +
        `Install-ADDSDomainController \\\n` +
        `    -DomainName $Domain \\\n` +
        `    -ReplicationSourceDC $Source \\\n` +
        `    -InstallDns:$true \\\n` +
        `    -CreateDnsDelegation:$false \\\n` +
        `    -Credential (Get-Credential)\n\n` +
        `# Après le redémarrage, vérifier depuis un contrôleur de domaine :\n` +
        `# Get-ADDomainController -Filter *\n` +
        `# repadmin /replsummary`
      );
    },
    gui: [
      'Ouvrir Gestionnaire de serveur > Ajouter des rôles et fonctionnalités.',
      "Ajouter Services AD DS puis terminer l\u2019assistant.",
      'Cliquer sur la notification puis \u00ab Promouvoir ce serveur en contrôleur de domaine \u00bb.',
      "\u00ab Ajouter un contrôleur de domaine à un domaine existant \u00bb : saisir le domaine et les identifiants.",
    ],
    checks: [
      'Ne pas utiliser un DNS public sur le serveur à promouvoir.',
      'Vérifier le canal sécurisé et les ports avant la promotion.',
      'Le serveur redémarre automatiquement si l\u2019installation réussit.',
    ],
    source: 'https://learn.microsoft.com/windows-server/identity/ad-ds/deploy/install-active-directory-domain-services--level-100',
  },

  // ── 6. Réparation Wi-Fi ──────────────────────────────────────────────────
  {
    id: 'wifi-repair',
    icon: '\u2341',
    category: 'Dépannage Windows',
    title: 'Diagnostiquer et réinitialiser le Wi-Fi',
    risk: 'caution',
    summary: 'Vérifie la carte et le service WLAN, puis redémarre la carte choisie.',
    fields: [
      { id: 'adapter', label: 'Nom de la carte Wi-Fi', default: 'Wi-Fi', help: "Utilise d\u2019abord le bloc diagnostic pour confirmer le nom." },
    ],
    validate(v) {
      const errors = {};
      const adapter = String(v.adapter ?? '').trim();
      if (!adapter) errors.adapter = 'Le nom de la carte ne peut pas être vide.';
      else if (/[\x00-\x1f\x7f]/.test(adapter)) errors.adapter = 'Le nom de la carte contient un caractère de contrôle non autorisé.';
      return errors;
    },
    generate(v) {
      assertValid(this, v);
      const adapterExpr = psB64(v.adapter);
      return (
        `$Adapter = ${adapterExpr}\n\n` +
        `# DIAGNOSTIC — ne modifie rien\n` +
        `Get-Service WlanSvc\n` +
        `Get-NetAdapter -Physical | Format-Table Name,Status,LinkSpeed,InterfaceDescription -Auto\n` +
        `netsh wlan show interfaces\n` +
        `netsh wlan show networks mode=bssid\n\n` +
        `# RÉPARATION LÉGÈRE — redémarre le service WLAN et la carte choisie\n` +
        `Start-Service WlanSvc\n` +
        `Disable-NetAdapter -Name $Adapter -Confirm:$false\n` +
        `Start-Sleep -Seconds 3\n` +
        `Enable-NetAdapter -Name $Adapter -Confirm:$false\n\n` +
        `# Rechercher les périphériques réinstallés ou nouvellement détectés\n` +
        `pnputil /scan-devices\n\n` +
        `# Vérifier de nouveau les réseaux\n` +
        `netsh wlan show networks mode=bssid`
      );
    },
    gui: [
      'Ouvrir Gestionnaire de périphériques > Cartes réseau.',
      "Repérer la carte Wi-Fi puis choisir Désactiver l\u2019appareil et Réactiver l\u2019appareil.",
      "Si cela ne résout rien : clic droit > Désinstaller l\u2019appareil, puis Action > Rechercher les modifications sur le matériel.",
      "Télécharger le pilote depuis le fabricant seulement si Windows ne réinstalle pas la carte.",
    ],
    checks: [
      'Le nom de la carte doit être exact avant la désactivation.',
      "La désinstallation du pilote est une solution de second niveau : commence toujours par redémarrer la carte.",
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
    summary: 'Prépare la politique par défaut du domaine avec validation et aperçu.',
    fields: [
      { id: 'domain',  label: 'Nom du domaine',                          default: 'hopitalbn.lan' },
      { id: 'length',  label: 'Longueur minimale',                        type: 'number', default: '12', min: '1',  max: '256' },
      { id: 'lockout', label: 'Tentatives avant verrouillage',            type: 'number', default: '5',  min: '0',  max: '999',   help: '0 désactive le verrouillage.' },
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
      assertValid(this, v);
      const lenR  = validateIntegerStrict(v.length,  1, 256,   'La longueur minimale');
      const lockR = validateIntegerStrict(v.lockout, 0, 999,   'Les tentatives');
      const minR  = validateIntegerStrict(v.minutes, 1, 99999, 'Les minutes');
      const length   = lenR.value;
      const lockout  = lockR.value;
      const minutes  = minR.value;
      const domainExpr = psB64(v.domain);
      return (
        `Import-Module ActiveDirectory\n\n` +
        `$Domain = ${domainExpr}\n\n` +
        `# Aperçu de la politique actuelle\n` +
        `Get-ADDefaultDomainPasswordPolicy -Identity $Domain\n\n` +
        `# Appliquer la nouvelle politique\n` +
        `Set-ADDefaultDomainPasswordPolicy -Identity $Domain \\\n` +
        `    -ComplexityEnabled $true \\\n` +
        `    -MinPasswordLength ${length} \\\n` +
        `    -LockoutThreshold ${lockout} \\\n` +
        `    -LockoutDuration (New-TimeSpan -Minutes ${minutes}) \\\n` +
        `    -LockoutObservationWindow (New-TimeSpan -Minutes ${minutes})\n\n` +
        `# Vérifier après application\n` +
        `Get-ADDefaultDomainPasswordPolicy -Identity $Domain`
      );
    },
    gui: [
      'Ouvrir Gestion de la stratégie de groupe.',
      "Développer la forêt, le domaine, puis clic droit sur Default Domain Policy > Modifier.",
      'Aller à Configuration ordinateur > Paramètres Windows > Paramètres de sécurité > Stratégies de compte.',
      'Configurer les stratégies de mot de passe et de verrouillage de compte.',
    ],
    checks: [
      "Cette politique touche les utilisateurs du domaine : teste d\u2019abord les seuils en laboratoire.",
      "Une stratégie de mot de passe fine est préférable lorsqu\u2019un groupe spécifique requiert une règle différente.",
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
    title: 'Analyser et libérer de l\u2019espace disque',
    risk: 'diagnostic',
    summary: 'Classe les fichiers et dossiers lourds, repère les artefacts recréables et propose une corbeille contrôlée.',
    fields: [
      { id: 'path',    label: 'Disque ou dossier à analyser',              default: 'C:\\', help: 'Exemples : C:\\, C:\\Users\\Blaise\\Projet ou D:\\.' },
      { id: 'top',     label: 'Nombre maximal de lignes dans le rapport',      type: 'number', default: '50',  min: '5',   max: '200',    help: 'Le scan parcourt les éléments; ce nombre limite seulement l\u2019affichage.' },
      { id: 'minSize', label: 'Taille minimale en Go',                         type: 'number', default: '0.5', min: '0',   max: '100000', step: '0.1', help: '0 inclut aussi les petits éléments; 0,5 cible les éléments d\u2019au moins 500\u00a0Mo.' },
      { id: 'report',  label: 'Format du rapport',                             type: 'select', default: 'both', options: [['both', 'CSV + HTML \u2014 recommandé'], ['csv', 'CSV seulement'], ['html', 'HTML seulement']] },
      { id: 'action',  label: 'Après le rapport',                              type: 'select', default: 'report', options: [['report', 'Rapport uniquement \u2014 recommandé'], ['recycle', 'Permettre une sélection vers la corbeille']] },
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
      assertValid(this, v);
      const topR     = validateIntegerStrict(v.top, 5, 200, 'Le nombre de lignes');
      const minSizeR = validateFloatStrict(v.minSize, 0, 100000, 'La taille minimale');
      const top     = topR.value;
      const minSize = minSizeR.value;
      const report  = v.report;
      const action  = v.action;
      const targetExpr = psB64(v.path || 'C:\\');
      const lines = [
        '# KJEMO IT TOOLKIT — ANALYSE DE DISQUE',
        '# Windows PowerShell 5.1 ou PowerShell 7 sur Windows',
        '# Lecture et rapport par défaut. Aucune suppression automatique.',
        '',
        `$TargetPath = ${targetExpr}`,
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
        "    $PathNorm = if ($PathFull -match '^[A-Za-z]:\\\\$') { $PathFull } else { $PathFull.TrimEnd('\\') }",
        "    $RootNorm = if ($RootFull -match '^[A-Za-z]:\\\\$') { $RootFull } else { $RootFull.TrimEnd('\\') }",
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
        "    if ($Segments -contains '.git') { return '.git protégé' }",
        "    if ($Segments | Where-Object { $_ -like '.env*' }) { return '.env / configuration sensible protégé' }",
        "    if ($LowerLeaf -like '*backup*' -or $LowerLeaf -like '*sauvegarde*') { return 'sauvegarde protégée' }",
        "    $SensitiveExtensions = @('.bak', '.backup', '.db', '.dump', '.ldf', '.mdf', '.ndf', '.sql', '.sqlite', '.sqlite3')",
        "    if ($SensitiveExtensions -contains ([IO.Path]::GetExtension($Leaf).ToLowerInvariant())) { return 'base ou fichier de sauvegarde protégé' }",
        '    foreach ($Root in $ProtectedRoots) {',
        "        if (Test-PathWithin -Path $FullPath -Root $Root) { return 'zone système protégée' }",
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
        '        return "Artefact recréable de projet — $Leaf"',
        '    }',
        '    if ($Segments | Where-Object { $ArtifactNames -contains $_.ToLowerInvariant() }) {',
        "        return 'Fichier dans un artefact recréable de projet'",
        '    }',
        "    if ($IsDirectory) { return 'Dossier volumineux — à examiner' }",
        "    return 'Fichier volumineux — à examiner'",
        '}',
        '',
        '$TargetItem = Get-Item -LiteralPath $TargetPath -Force -ErrorAction Stop',
        "if (-not $TargetItem.PSIsContainer) { throw 'Le chemin doit être un disque ou un dossier.' }",
        "if ($TargetItem.FullName -match '^[A-Za-z]:\\\\?$' -and $TargetItem.FullName -eq ($env:SystemDrive + '\\')) { Write-Warning 'Un scan de la racine système peut être très long.' }",
        '$TargetResolved = $TargetItem.FullName',
        "if ($TargetResolved.Length -gt 3) { $TargetResolved = $TargetResolved.TrimEnd('\\') }",
        '$MinimumSizeBytes = [int64]($MinimumSizeGB * 1GB)',
        '',
        'Write-Host "Analyse de $TargetResolved en cours..." -ForegroundColor Cyan',
        '$Files = @(Get-ChildItem -LiteralPath $TargetResolved -File -Force -Recurse -ErrorAction SilentlyContinue)',
        '$DirectorySizes = @{}',
        '',
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
        "            SelectionPossible = [bool](-not $Protection -and $Classification -like 'Artefact recréable*')",
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
        "if ($ReportResults.Count -eq 0) { Write-Warning 'Aucun élément ne correspond à la taille minimale.' }",
        'else { $ReportResults | Format-Table Type,TailleGB,Classification,Protege,Path -AutoSize }',
        '',
        "if ($ReportFormat -in @('csv', 'both')) {",
        '    $CsvPath = "$ReportBase.csv"',
        '    $ReportResults | Export-Csv -LiteralPath $CsvPath -UseCulture -NoTypeInformation -Encoding UTF8',
        '    Write-Host "CSV créé : $CsvPath" -ForegroundColor Green',
        '}',
        "if ($ReportFormat -in @('html', 'both')) {",
        '    $HtmlPath = "$ReportBase.html"',
        "    $Css = '<style>body{font-family:Segoe UI,Arial;margin:2rem} table{border-collapse:collapse} th,td{border:1px solid #bbb;padding:.4rem;text-align:left} th{background:#eee}</style>'",
        "    $ReportResults | ConvertTo-Html -Title 'KJEMO — Analyse de disque' -Head $Css -PreContent \"<h1>Analyse de $TargetResolved</h1><p>Généré le $(Get-Date)</p>\" | Out-File -LiteralPath $HtmlPath -Encoding UTF8",
        '    Write-Host "HTML créé : $HtmlPath" -ForegroundColor Green',
        '}',
        '',
        'if ($AllowRecycleSelection -and $ReportResults.Count -gt 0) {',
        "    $Candidates = @($ReportResults | Where-Object { $_.SelectionPossible -eq $true })",
        "    $CandidateFolders = @($Candidates | Where-Object { $_.Type -eq 'Dossier' })",
        '    $Candidates = @($Candidates | Where-Object {',
        '        $CurrentCandidate = $_',
        "        $CurrentCandidate.Type -eq 'Dossier' -or -not ($CandidateFolders | Where-Object { Test-PathWithin -Path $CurrentCandidate.Path -Root $_.Path })",
        '    })',
        "    if ($Candidates.Count -eq 0) { Write-Host 'Aucun candidat non protégé n''est proposé pour la corbeille.' -ForegroundColor Yellow }",
        '    else {',
        '        Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction Stop',
        "        Write-Host ''",
        "        Write-Host 'Candidats proposés (les éléments protégés sont exclus) :' -ForegroundColor Yellow",
        '        for ($Index = 0; $Index -lt $Candidates.Count; $Index++) {',
        '            Write-Host ("[{0}] {1} — {2} Go — {3}" -f ($Index + 1), $Candidates[$Index].Type, $Candidates[$Index].TailleGB, $Candidates[$Index].Path)',
        '        }',
        '        $Confirmation = Read-Host "Pour continuer, tape exactement CONFIRMER; toute autre réponse annule"',
        "        if ($Confirmation -cne 'CONFIRMER') { Write-Host 'Opération annulée : aucun élément déplacé.' -ForegroundColor Cyan }",
        '        else {',
        "            $Selection = Read-Host 'Numéros à envoyer à la corbeille, séparés par des virgules (exemple : 1,3)'",
        "            $Indexes = $Selection -split '[,; ]+' | ForEach-Object { $Parsed = 0; if ([int]::TryParse($_, [ref]$Parsed)) { $Parsed } }",
        '            foreach ($Number in $Indexes) {',
        '                if ($Number -lt 1 -or $Number -gt $Candidates.Count) { Write-Warning "Numéro ignoré : $Number"; continue }',
        '                $Candidate = $Candidates[$Number - 1]',
        '                try {',
        "                    if ($Candidate.Type -eq 'Dossier') {",
        '                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)',
        '                    }',
        '                    else {',
        '                        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($Candidate.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)',
        '                    }',
        '                    Write-Host "Envoyé à la corbeille : $($Candidate.Path)" -ForegroundColor Green',
        '                }',
        '                catch { Write-Warning "Échec pour $($Candidate.Path) : $($_.Exception.Message)" }',
        '            }',
        '        }',
        '    }',
        '}',
        '',
        "Write-Host ''",
        'Write-Host "Terminé. Les rapports restent sur le Bureau; vérifie-les avant toute autre action." -ForegroundColor Cyan',
      ];
      return lines.join('\n');
    },
    gui: [
      'Ouvrir Paramètres > Système > Stockage pour un résumé rapide.',
      "Pour un dossier précis, ouvrir PowerShell et utiliser le chemin exact; l\u2019Explorateur peut aussi afficher les propriétés du disque.",
      'Dans un projet SaaS, examiner en priorité node_modules, .next, dist, build, out, coverage et les caches.',
      'Ne sélectionner pour la corbeille que des éléments non protégés; ne jamais toucher à .git, .env, bases ou sauvegardes.',
    ],
    checks: [
      'Compatible avec Windows PowerShell 5.1 ou PowerShell 7 sur Windows; le scan peut prendre du temps sur un gros disque.',
      'Le mode recommandé produit seulement un rapport CSV/HTML et ne supprime rien.',
      'Les chemins contenant .git, .env, bases, sauvegardes et zones système sont marqués protégés.',
      'La corbeille demande CONFIRMER puis des numéros; les éléments verrouillés sont signalés.',
    ],
    source: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-childitem',
  };
}

tools.push(createDiskScanTool());
