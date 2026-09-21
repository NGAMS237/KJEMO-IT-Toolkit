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
// Noyau et validateurs — extraits en modules dédiés au LOT 2
//
// psB64() et assertValid() vivent dans noyau.mjs, validateIPv4() et
// validateShareName() dans validateurs.mjs. Ils sont ré-exportés ici : ce
// fichier reste le point d'entrée canonique, et aucun importateur existant
// n'a à changer. Le déplacement évite un import circulaire avec le catalogue
// Windows Server, qui a besoin des mêmes fonctions.
// ---------------------------------------------------------------------------
import { psB64, assertValid } from './noyau.mjs';
import { validateIPv4, validateShareName, escapeLdapRdn, domainToDn,
         validateSamAccountName, validateGroupName, validateOuName } from './validateurs.mjs';
import { toolsServeur } from './outils-serveur.mjs';
import { toolsAd } from './outils-ad.mjs';

export { psB64, assertValid, validateIPv4, validateShareName, escapeLdapRdn, domainToDn,
         validateSamAccountName, validateGroupName, validateOuName };

// ---------------------------------------------------------------------------
// Fonctions d'échappement
// ---------------------------------------------------------------------------



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

// ---------------------------------------------------------------------------
// Moteur de recherche
// ---------------------------------------------------------------------------

/**
 * Normalise une chaîne pour la recherche : minuscules, accents retirés,
 * ponctuation réduite à des espaces. Permet à « reseau » de trouver « Réseau »
 * et à « wi fi » de trouver « Wi-Fi ».
 */
export function normalizeSearch(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Champs indexés d'un outil, groupés par motif de correspondance.
 * L'ordre définit la priorité affichée à l'utilisateur.
 */
export function searchFields(tool) {
  return [
    { reason: 'titre',      weight: 100, text: tool.title },
    { reason: 'mot-clé',    weight:  80, text: (tool.keywords ?? []).join(' ') },
    { reason: 'description',weight:  60, text: tool.summary },
    { reason: 'catégorie',  weight:  50, text: tool.category },
    { reason: 'message d\u2019erreur', weight: 70,
      text: (tool.commonErrors ?? []).map((e) => e.message).join(' ') },
    { reason: 'cause ou correction', weight: 40,
      text: (tool.commonErrors ?? []).map((e) => `${e.cause} ${e.fix}`).join(' ') },
    { reason: 'prérequis',  weight:  30,
      text: [...(tool.prereqs ?? []), ...(tool.os ?? [])].join(' ') },
  ];
}

/**
 * Recherche un outil. Tous les mots de la requête doivent être trouvés
 * (ET logique), chacun pouvant l'être dans un champ différent.
 *
 * Retourne [{ tool, reason, score }] trié par pertinence décroissante.
 * Une requête vide retourne tous les outils de la catégorie.
 */
export function searchTools(query, category = 'Tout', list = tools) {
  const parCategorie = list.filter((t) => category === 'Tout' || t.category === category);
  const mots = normalizeSearch(query).split(' ').filter(Boolean);
  if (mots.length === 0) return parCategorie.map((tool) => ({ tool, reason: null, score: 0 }));

  const resultats = [];
  for (const tool of parCategorie) {
    const champs = searchFields(tool).map((c) => ({ ...c, norm: normalizeSearch(c.text) }));
    let score = 0;
    let meilleur = null;
    let tousTrouves = true;

    for (const mot of mots) {
      const trouve = champs.filter((c) => c.norm.includes(mot));
      if (trouve.length === 0) { tousTrouves = false; break; }
      const top = trouve.reduce((a, b) => (b.weight > a.weight ? b : a));
      score += top.weight;
      if (!meilleur || top.weight > meilleur.weight) meilleur = top;
    }

    if (tousTrouves) resultats.push({ tool, reason: meilleur?.reason ?? null, score });
  }

  return resultats.sort((a, b) => b.score - a.score || a.tool.title.localeCompare(b.tool.title, 'fr'));
}

// ---------------------------------------------------------------------------
// EXECUTION_NOTES — bloc commun à toutes les fiches
// ---------------------------------------------------------------------------
/**
 * Un script téléchargé depuis ce site est un fichier .ps1 NON SIGNÉ provenant
 * d'Internet. Windows le bloque par défaut. Ce bloc explique pourquoi et
 * comment le débloquer proprement, sans jamais abaisser la sécurité de la
 * machine entière.
 *
 * Sources officielles Microsoft :
 *   about_Execution_Policies
 *   https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_execution_policies
 *   Unblock-File
 *   https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/unblock-file
 */
export const EXECUTION_NOTES = {
  title: 'Avant d\u2019exécuter le script',
  intro:
    'Le fichier téléchargé est un script texte non signé. Windows marque tout fichier '
    + 'venant d\u2019Internet, et la stratégie d\u2019exécution par défaut refuse alors de le lancer. '
    + 'Ce n\u2019est pas une erreur du script : c\u2019est une protection normale de Windows.',

  steps: [
    {
      label: 'Relire le script',
      detail:
        'L\u2019aperçu affiché ici est exactement le contenu du fichier téléchargé. '
        + 'Ouvre-le dans le Bloc-notes si tu veux le relire avant de le lancer. '
        + 'N\u2019exécute jamais un script que tu n\u2019as pas lu.',
    },
    {
      label: 'Débloquer le fichier téléchargé',
      detail:
        'Retire la marque « provient d\u2019Internet » sur ce seul fichier. '
        + 'La stratégie d\u2019exécution de la machine n\u2019est pas modifiée.',
      command: 'Unblock-File -Path "$env:USERPROFILE\\Downloads\\<nom-du-script>.ps1"',
    },
    {
      label: 'Ouvrir PowerShell avec les droits nécessaires',
      detail:
        'Les outils marqués ATTENTION ou DESTRUCTIF modifient la configuration du système '
        + 'et exigent une console ouverte en tant qu\u2019administrateur. '
        + 'Les outils DIAGNOSTIC se contentent le plus souvent d\u2019une session normale.',
    },
    {
      label: 'Vérifier la stratégie en vigueur si le blocage persiste',
      detail:
        'Cette commande affiche la stratégie de chaque portée. La portée la plus prioritaire '
        + 'l\u2019emporte : MachinePolicy et UserPolicy (stratégie de groupe), puis Process, '
        + 'CurrentUser, et enfin LocalMachine.',
      command: 'Get-ExecutionPolicy -List',
    },
  ],

  // Tableau de référence — about_Execution_Policies
  policies: [
    { name: 'Restricted',   local: 'Aucun script autorisé',        internet: 'Aucun script autorisé' },
    { name: 'AllSigned',    local: 'Signé par un éditeur approuvé', internet: 'Signé par un éditeur approuvé' },
    { name: 'RemoteSigned', local: 'Autorisé',                      internet: 'Signé, ou débloqué avec Unblock-File' },
    { name: 'Unrestricted', local: 'Autorisé',                      internet: 'Autorisé, avec avertissement' },
    { name: 'Bypass',       local: 'Autorisé',                      internet: 'Autorisé, sans avertissement' },
  ],

  errors: [
    {
      message: 'n\u2019est pas signé numériquement. Vous ne pouvez pas exécuter ce script sur le système actuel.',
      code: 'UnauthorizedAccess',
      cause:
        'Stratégie RemoteSigned (le cas le plus courant) et fichier marqué comme provenant '
        + 'd\u2019Internet. Le script n\u2019étant pas signé, il est refusé.',
      fix: 'Débloquer ce fichier précis avec Unblock-File, puis relancer.',
      command: 'Unblock-File -Path "$env:USERPROFILE\\Downloads\\<nom-du-script>.ps1"',
    },
    {
      message: 'L\u2019exécution de scripts est désactivée sur ce système.',
      code: 'UnauthorizedAccess',
      cause: 'Stratégie Restricted : aucun script n\u2019est autorisé, même local.',
      fix:
        'Lancer le script dans une session isolée, sans toucher à la configuration de la machine. '
        + 'La portée Process disparaît à la fermeture de la fenêtre. '
        + 'Si une stratégie de groupe impose Restricted, il faut passer par l\u2019administrateur du domaine.',
      command: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<chemin-du-script>.ps1"',
    },
    {
      message: 'Accès refusé / Requested registry access is not allowed.',
      code: 'PermissionDenied',
      cause: 'La console PowerShell n\u2019a pas été ouverte en tant qu\u2019administrateur.',
      fix: 'Fermer la fenêtre, puis rouvrir PowerShell avec un clic droit → Exécuter en tant qu\u2019administrateur.',
    },
    {
      message: 'Le terme « Get-ADUser » n\u2019est pas reconnu comme nom d\u2019applet de commande.',
      code: 'CommandNotFoundException',
      cause:
        'Le module ActiveDirectory est absent. Il est présent sur un contrôleur de domaine, '
        + 'mais doit être installé séparément sur un poste de travail (RSAT).',
      fix: 'Installer les outils RSAT Active Directory, puis rouvrir PowerShell.',
      command: 'Add-WindowsCapability -Online -Name "Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0"',
    },
  ],

  warning:
    'Ne modifie pas la stratégie d\u2019exécution de toute la machine pour faire passer un script. '
    + 'Débloquer le fichier concerné, ou utiliser une session isolée, suffit et reste réversible.',

  sources: [
    {
      label: 'about_Execution_Policies (Microsoft Learn)',
      url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_execution_policies',
    },
    {
      label: 'Unblock-File (Microsoft Learn)',
      url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/unblock-file',
    },
  ],
};


/**
 * Recherche dans les erreurs COMMUNES à tous les scripts (EXECUTION_NOTES).
 * Un technicien qui tape « signé numériquement » cherche une explication, pas
 * une liste des huit outils : on lui répond par l'explication elle-même.
 */
export function searchCommonErrors(query) {
  const mots = normalizeSearch(query).split(' ').filter(Boolean);
  if (mots.length === 0) return [];
  return EXECUTION_NOTES.errors.filter((e) => {
    const champ = normalizeSearch(`${e.message} ${e.code ?? ''} ${e.cause} ${e.fix}`);
    return mots.every((mot) => champ.includes(mot));
  });
}

// ---------------------------------------------------------------------------
// Audit de sécurité des procédures d'annulation
// ---------------------------------------------------------------------------
/**
 * Cmdlets considérés comme destructifs par leur verbe. Toute occurrence dans
 * une procédure d'annulation doit porter une confirmation réelle, ou figurer
 * dans la liste d'exceptions ci-dessous.
 */
export const VERBES_DESTRUCTIFS = [
  'Remove', 'Uninstall', 'Clear', 'Reset', 'Disable', 'Dismount', 'Format',
];

/**
 * Exceptions explicites — cmdlets qui correspondent au filtre mais ne
 * détruisent rien. La liste est volontairement courte et justifiée.
 */
export const CMDLETS_NON_DESTRUCTIFS = {
  // Le verbe « Format- » vise Format-Volume, qui efface un disque. Les quatre
  // cmdlets ci-dessous ne formatent que l'AFFICHAGE dans la console : elles ne
  // touchent ni disque, ni annuaire, ni configuration.
  'Format-Table':  'Mise en forme de l\u2019affichage console. Ne modifie rien.',
  'Format-List':   'Mise en forme de l\u2019affichage console. Ne modifie rien.',
  'Format-Wide':   'Mise en forme de l\u2019affichage console. Ne modifie rien.',
  'Format-Custom': 'Mise en forme de l\u2019affichage console. Ne modifie rien.',
};

/**
 * Extrait les cmdlets Verbe-Nom d'un bloc de commandes, en ignorant les lignes
 * de commentaire : un cmdlet cité dans une explication n'est pas exécuté.
 */
export function cmdletsExecutes(bloc) {
  return String(bloc ?? '')
    .split(/\r?\n/)
    .filter((ligne) => !/^\s*#/.test(ligne))
    .join('\n')
    .match(/\b[A-Z][a-zA-Z]*-[A-Z][A-Za-z0-9]*\b/g) ?? [];
}

/**
 * Audite la procédure d'annulation d'un outil et retourne la liste des
 * problèmes trouvés. Un tableau vide signifie « conforme ».
 *
 * Règles appliquées :
 *   1. -Confirm:$false est interdit sur un cmdlet destructif.
 *   2. -Force est interdit dans la procédure NORMALE sur un cmdlet destructif.
 *   3. Tout cmdlet destructif de la procédure normale doit porter -Confirm.
 *   4. Le bloc diagnostic ne doit contenir aucun cmdlet destructif sans -WhatIf.
 *   5. Un bloc exceptionnel qui emploie -Force ou -ForceRemoval doit porter un
 *      avertissement critique.
 */
export function auditerAnnulation(tool) {
  const pbs = [];
  const r = tool.rollback ?? {};

  const exempte     = (c) => Object.prototype.hasOwnProperty.call(CMDLETS_NON_DESTRUCTIFS, c);
  const estDestructif = (c) =>
    VERBES_DESTRUCTIFS.some((v) => c.startsWith(v + '-')) && !exempte(c);

  const lignesUtiles = (bloc) => String(bloc ?? '')
    .split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l.trim()));

  const BLOCS = [
    ['diagnostic',  r.diagnostic],
    ['command',     r.command],
    ['exceptional', r.exceptional],
  ];

  // --- RÈGLE 1 : -Confirm:$false est interdit PARTOUT dans une annulation.
  //     Ce paramètre n'a qu'un seul effet possible : supprimer la demande de
  //     confirmation. Aucun usage légitime dans une procédure documentée.
  for (const [nom, bloc] of BLOCS) {
    for (const ligne of lignesUtiles(bloc)) {
      if (/-Confirm\s*:\s*\$false/i.test(ligne)) {
        pbs.push(`${tool.id} : -Confirm:$false interdit (bloc ${nom})`);
      }
    }
  }

  // --- RÈGLE 2 : procédure NORMALE — confirmation exigée, -Force interdit.
  for (const ligne of lignesUtiles(r.command)) {
    const cmdlets = cmdletsExecutes(ligne);
    const dangereux = cmdlets.filter(estDestructif);

    if (/(^|\s)-Force(Removal)?\b/i.test(ligne) && !cmdlets.every(exempte)) {
      const quoi = dangereux[0] ?? cmdlets[0] ?? 'la commande';
      pbs.push(`${tool.id} : ${quoi} emploie -Force dans la procédure normale`);
    }

    for (const c of dangereux) {
      if (!/(^|\s)-Confirm\b(?!\s*:\s*\$false)/i.test(ligne) && !/-WhatIf\b/i.test(ligne)) {
        pbs.push(`${tool.id} : ${c} ne demande aucune confirmation dans la procédure normale`);
      }
    }
  }

  // --- RÈGLE 3 : bloc DIAGNOSTIC — constater, jamais modifier.
  for (const ligne of lignesUtiles(r.diagnostic)) {
    for (const c of cmdletsExecutes(ligne).filter(estDestructif)) {
      if (!/-WhatIf\b/i.test(ligne)) {
        pbs.push(`${tool.id} : ${c} dans le bloc diagnostic sans -WhatIf`);
      }
    }
  }

  // --- RÈGLE 4 : bloc EXCEPTIONNEL — -Force toléré, mais encadré.
  const exc = String(r.exceptional ?? '');
  if (exc.trim()) {
    const sensible = /(^|\s)-Force(Removal)?\b/i.test(exc)
      || /ntdsutil/i.test(exc)
      || cmdletsExecutes(exc).some(estDestructif);
    if (sensible) {
      if (!/AVERTISSEMENT CRITIQUE/i.test(exc)) {
        pbs.push(`${tool.id} : bloc exceptionnel sensible sans AVERTISSEMENT CRITIQUE`);
      }
      if (!/learn\.microsoft\.com/i.test(exc)) {
        pbs.push(`${tool.id} : bloc exceptionnel sans renvoi à une procédure Microsoft officielle`);
      }
    }
  }

  return pbs;
}

export const tools = [
  // ── 1. IP statique ──────────────────────────────────────────────────────
  {
    id: 'static-ip',
    icon: '◈',
    category: 'Réseau',
    subcategory: 'Adressage IP',
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
    keywords: [
      'ip fixe',
      'adresse ip',
      'ipv4',
      'passerelle',
      'gateway',
      'masque',
      'prefixe',
      'dns',
      'carte reseau',
      'tcp/ip',
      'dhcp',
      'configuration reseau',
    ],
    requiresAdmin: true,
    os: [
      'Windows 10 et 11',
      'Windows Server 2012 et versions ultérieures',
    ],
    prereqs: [
      'Console PowerShell ouverte en tant qu’administrateur.',
      'Modules NetTCPIP et DnsClient : intégrés à Windows depuis Windows 8 et Server 2012, aucune installation nécessaire.',
      'Connaître le nom exact de la carte réseau : la commande Get-NetAdapter le liste.',
    ],
    commonErrors: [
      {
        message: 'Instance MSFT_NetIPAddress already exists.',
        cause:   'Une adresse IP identique est déjà configurée sur la carte.',
        fix:     'Supprimer l’ancienne adresse avec Remove-NetIPAddress avant de relancer, ou choisir une autre adresse.',
      },
      {
        message: 'Aucune correspondance trouvée pour les critères de recherche : Name = ...',
        cause:   'Le nom de la carte réseau saisi ne correspond à aucune carte existante.',
        fix:     'Lister les cartes avec Get-NetAdapter et reprendre le nom exact, accents et espaces compris.',
      },
    ],
    reversible: true,
    verifyAfter: [
      'Get-NetIPConfiguration -InterfaceAlias \'<carte>\' affiche la nouvelle adresse, la passerelle et les DNS.',
      'Test-NetConnection <passerelle> répond avec PingSucceeded = True.',
      'Resolve-DnsName microsoft.com aboutit, ce qui valide les serveurs DNS.',
    ],
    rollback: {
      summary:     'Repasser la carte en DHCP annule la configuration manuelle. Constater d\'abord l\'état actuel, simuler ensuite, et seulement alors appliquer avec confirmation.',
      diagnostic:  '# 1. CONSTATER la configuration en place, et la noter avant de la défaire\nGet-NetIPConfiguration -InterfaceAlias \'<carte>\' | Format-List\nGet-NetIPAddress       -InterfaceAlias \'<carte>\' -AddressFamily IPv4\nGet-NetRoute           -InterfaceAlias \'<carte>\' -DestinationPrefix 0.0.0.0/0\nGet-DnsClientServerAddress -InterfaceAlias \'<carte>\' -AddressFamily IPv4\n\n# 2. SIMULER l\'annulation : -WhatIf montre ce qui serait fait, sans rien changer\nRemove-NetIPAddress -InterfaceAlias \'<carte>\' -WhatIf\nRemove-NetRoute     -InterfaceAlias \'<carte>\' -DestinationPrefix 0.0.0.0/0 -WhatIf',
      command:     '# Chaque suppression demande confirmation. Répondre O pour valider, N pour refuser.\nRemove-NetIPAddress -InterfaceAlias \'<carte>\' -Confirm\nRemove-NetRoute     -InterfaceAlias \'<carte>\' -DestinationPrefix 0.0.0.0/0 -Confirm\n\n# Remise en DHCP — ces deux commandes ne suppriment rien, elles reconfigurent.\nSet-NetIPInterface         -InterfaceAlias \'<carte>\' -Dhcp Enabled\nSet-DnsClientServerAddress -InterfaceAlias \'<carte>\' -ResetServerAddresses',
      exceptional: '',
      warning:     'Si ta session est ouverte À DISTANCE par cette carte, l\'annulation la coupe et tu perds la main sur la machine. Prévoir un accès console, iLO/iDRAC ou physique avant de commencer.',
    },
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
    subcategory: 'Unités organisationnelles',
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
    keywords: [
      'unite d organisation',
      'ou',
      'organizational unit',
      'annuaire',
      'active directory',
      'conteneur',
      'arborescence',
      'ldap',
    ],
    requiresAdmin: false,
    os: [
      'Contrôleur de domaine Windows Server 2012 et versions ultérieures',
      'Poste d’administration avec RSAT',
    ],
    prereqs: [
      'Module ActiveDirectory : présent sur un contrôleur de domaine, à installer via RSAT sur un poste de travail.',
      'Compte disposant du droit de créer une unité d’organisation dans le conteneur visé.',
      'L’OU parente doit exister avant de créer une sous-OU.',
    ],
    commonErrors: [
      {
        message: 'Directory object not found.',
        cause:   'Le conteneur parent indiqué n’existe pas dans l’annuaire.',
        fix:     'Vérifier le chemin de l’OU parente, ou la créer d’abord.',
      },
      {
        message: 'An attempt was made to add an object to the directory with a name that is already in use.',
        cause:   'Une OU portant ce nom existe déjà au même niveau.',
        fix:     'Choisir un autre nom, ou utiliser l’OU existante.',
      },
    ],
    reversible: true,
    verifyAfter: [
      'Get-ADOrganizationalUnit -Identity \'<DN de l OU>\' retourne l\'objet créé.',
      'L\'OU apparaît dans Utilisateurs et ordinateurs Active Directory après actualisation.',
    ],
    rollback: {
      summary:     'Supprimer l\'OU. Elle est protégée contre la suppression accidentelle par défaut : il faut retirer cette protection d\'abord. Vérifier qu\'elle est vide avant tout.',
      diagnostic:  '# 1. L\'OU contient-elle encore des objets ? S\'ils existent, ils seraient perdus.\nGet-ADObject -SearchBase \'<DN de l OU>\' -SearchScope Subtree -Filter * | Format-Table Name,ObjectClass\n\n# 2. État de la protection contre la suppression accidentelle\nGet-ADOrganizationalUnit -Identity \'<DN de l OU>\' -Properties ProtectedFromAccidentalDeletion |\n  Select-Object Name,ProtectedFromAccidentalDeletion\n\n# 3. SIMULER la suppression\nRemove-ADOrganizationalUnit -Identity \'<DN de l OU>\' -WhatIf',
      command:     '# Retirer la protection, puis supprimer avec confirmation explicite.\nSet-ADOrganizationalUnit    -Identity \'<DN de l OU>\' -ProtectedFromAccidentalDeletion $false\nRemove-ADOrganizationalUnit -Identity \'<DN de l OU>\' -Confirm',
      exceptional: '',
      warning:     'Ne jamais supprimer une OU sans avoir vérifié qu\'elle est vide : les comptes, groupes et ordinateurs qu\'elle contient seraient supprimés avec elle.',
    },
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
    subcategory: 'Utilisateurs',
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
    keywords: [
      'utilisateur',
      'compte',
      'nouvel employe',
      'embauche',
      'samaccountname',
      'upn',
      'mot de passe',
      'creation de compte',
      'ad',
    ],
    requiresAdmin: false,
    os: [
      'Contrôleur de domaine Windows Server 2012 et versions ultérieures',
      'Poste d’administration avec RSAT',
    ],
    prereqs: [
      'Module ActiveDirectory : présent sur un contrôleur de domaine, à installer via RSAT sur un poste de travail.',
      'Compte disposant du droit de créer des utilisateurs dans l’OU visée.',
      'L’OU de destination doit exister.',
      'La stratégie de mot de passe du domaine s’applique : un mot de passe trop faible sera refusé.',
    ],
    commonErrors: [
      {
        message: 'The password does not meet the length, complexity, or history requirement of the domain.',
        cause:   'Le mot de passe saisi ne respecte pas la stratégie du domaine.',
        fix:     'Utiliser un mot de passe conforme. L’assistant Stratégie de mot de passe permet de consulter les règles en vigueur.',
      },
      {
        message: 'The specified account already exists.',
        cause:   'Un compte portant le même identifiant de connexion existe déjà.',
        fix:     'Choisir un autre identifiant, ou modifier le compte existant.',
      },
    ],
    reversible: true,
    verifyAfter: [
      'Get-ADUser -Identity \'<identifiant>\' -Properties * retourne le compte avec ses attributs.',
      'Le compte apparaît dans l\'OU visée et son état Activé correspond à ce qui était voulu.',
    ],
    rollback: {
      summary:     'Désactiver le compte est réversible et préserve l\'historique : c\'est la voie à privilégier. La suppression est définitive et détruit le SID.',
      diagnostic:  '# Constater l\'état du compte et ce qui en dépend avant d\'agir\nGet-ADUser -Identity \'<identifiant>\' -Properties Enabled,MemberOf,LastLogonDate |\n  Select-Object Name,Enabled,LastLogonDate\nGet-ADUser -Identity \'<identifiant>\' -Properties MemberOf |\n  Select-Object -ExpandProperty MemberOf\n\n# SIMULER la suppression, si c\'est bien elle qui est envisagée\nRemove-ADUser -Identity \'<identifiant>\' -WhatIf',
      command:     '# VOIE NORMALE — réversible, à privilégier.\n# Le compte est désactivé mais conservé : droits, SID et historique intacts.\nDisable-ADAccount -Identity \'<identifiant>\' -Confirm\n\n# Pour réactiver plus tard :\n# Enable-ADAccount -Identity \'<identifiant>\'',
      exceptional: '# AVERTISSEMENT CRITIQUE — suppression DÉFINITIVE.\n# Le SID du compte est détruit avec lui. Un compte recréé plus tard avec le\n# même nom n\'aura PAS accès aux ressources de l\'ancien : partages, boîtes aux\n# lettres et permissions NTFS sont rattachés au SID, pas au nom.\n# N\'employer cette voie que si le compte a été créé par erreur et n\'a jamais servi.\n# Procédure officielle : https://learn.microsoft.com/powershell/module/activedirectory/remove-aduser\n#\n# Préférer Disable-ADAccount ci-dessus dans tous les autres cas.\nRemove-ADUser -Identity \'<identifiant>\' -Confirm',
      warning:     'Supprimer un compte détruit son SID. Un compte recréé plus tard avec le même nom n\'aura PAS accès aux ressources de l\'ancien : partages, boîtes aux lettres et permissions NTFS sont rattachés au SID, pas au nom.',
    },
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
    category: 'Windows Server',
    subcategory: 'Serveur de fichiers',
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
    keywords: [
      'partage',
      'dossier partage',
      'smb',
      'cifs',
      'ntfs',
      'droits',
      'permissions',
      'acces reseau',
      'lecteur reseau',
    ],
    requiresAdmin: true,
    os: [
      'Windows 10 et 11',
      'Windows Server 2012 et versions ultérieures',
    ],
    prereqs: [
      'Console PowerShell ouverte en tant qu’administrateur.',
      'Module SmbShare : intégré à Windows depuis Windows 8 et Server 2012.',
      'Le lecteur de destination doit exister et être local : les chemins UNC sont refusés par l’assistant.',
      'Le groupe auquel les droits sont accordés doit exister avant l’exécution.',
    ],
    commonErrors: [
      {
        message: 'Le partage est déjà configuré sur cet ordinateur.',
        cause:   'Un partage portant ce nom existe déjà.',
        fix:     'Supprimer l’ancien partage avec Remove-SmbShare, ou choisir un autre nom de partage.',
      },
      {
        message: 'Aucune correspondance trouvée pour le nom de compte fourni.',
        cause:   'Le groupe indiqué n’existe pas, ou n’est pas visible depuis cette machine.',
        fix:     'Créer le groupe d’abord, ou vérifier son orthographe et son domaine.',
      },
    ],
    reversible: true,
    verifyAfter: [
      'Get-SmbShare -Name \'<partage>\' retourne le partage.',
      'Get-SmbShareAccess -Name \'<partage>\' liste les droits accordés.',
      'Depuis un autre poste, \\\\<serveur>\\<partage> s\'ouvre avec les droits attendus.',
    ],
    rollback: {
      summary:     'Supprimer le partage retire l\'accès réseau. Le dossier et son contenu restent intacts sur le disque. Vérifier d\'abord que personne n\'a de fichier ouvert.',
      diagnostic:  '# 1. QUELQU\'UN TRAVAILLE-T-IL DESSUS ? À vérifier impérativement avant de retirer le partage.\nGet-SmbOpenFile  | Where-Object { $_.Path -like \'*<partage>*\' } | Format-Table ClientUserName,Path\nGet-SmbSession   | Format-Table ClientComputerName,ClientUserName,NumOpens\n\n# 2. Revoir le partage et ses droits avant de les perdre de vue\nGet-SmbShare       -Name \'<partage>\' | Format-List\nGet-SmbShareAccess -Name \'<partage>\'\nGet-Acl \'<chemin du dossier>\' | Format-List\n\n# 3. SIMULER la suppression du partage\nRemove-SmbShare -Name \'<partage>\' -WhatIf',
      command:     '# Suppression du partage avec confirmation explicite.\n# Les fichiers du dossier ne sont PAS supprimés : seul l\'accès réseau disparaît.\nRemove-SmbShare -Name \'<partage>\' -Confirm',
      exceptional: '',
      warning:     'Retirer un partage pendant qu\'un fichier y est ouvert peut faire perdre des modifications non enregistrées chez l\'utilisateur. Toujours passer par Get-SmbOpenFile d\'abord. Les droits NTFS ajoutés sur le dossier, eux, restent en place : les revoir séparément avec Get-Acl.',
    },
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
    subcategory: 'Contrôleurs de domaine',
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
    keywords: [
      'controleur de domaine',
      'dc',
      'second dc',
      'replication',
      'promotion',
      'dcpromo',
      'addsdeployment',
      'redondance',
      'tolerance de panne',
    ],
    requiresAdmin: true,
    os: [
      'Windows Server 2012 et versions ultérieures uniquement',
    ],
    prereqs: [
      'Windows Server obligatoire : Install-WindowsFeature n’existe pas sur Windows 10 ou 11.',
      'Console PowerShell ouverte en tant qu’administrateur.',
      'Compte membre des groupes Administrateurs de l’entreprise et Administrateurs du domaine.',
      'Le serveur doit déjà être joint au domaine et résoudre le contrôleur source par DNS.',
      'Le serveur redémarre à la fin de la promotion : prévoir une fenêtre de maintenance.',
    ],
    commonErrors: [
      {
        message: 'Verification of prerequisites for Domain Controller promotion failed.',
        cause:   'Un prérequis n’est pas rempli : DNS, appartenance au domaine, ou niveau fonctionnel.',
        fix:     'Lire le détail affiché par le contrôle de prérequis ; il nomme la condition manquante.',
      },
      {
        message: 'The term « Install-WindowsFeature » is not recognized.',
        cause:   'La commande est exécutée sur Windows 10 ou 11 au lieu de Windows Server.',
        fix:     'Exécuter cet assistant depuis un Windows Server.',
      },
    ],
    reversible: true,
    verifyAfter: [
      'Get-ADDomainController -Filter * liste le nouveau contrôleur.',
      'repadmin /replsummary ne signale aucune erreur de réplication.',
      'dcdiag /v sur le nouveau serveur passe tous les tests.',
      'Les partages SYSVOL et NETLOGON sont publiés sur le nouveau contrôleur.',
    ],
    rollback: {
      summary:     'Rétrograder un contrôleur de domaine est une opération lourde qui touche les rôles FSMO, le DNS, le catalogue global, la réplication et SYSVOL. Elle se prépare, puis s\'exécute de façon interactive.',
      diagnostic:  '# ÉTAPE 1 — DIAGNOSTIC PRÉALABLE. Ne rien rétrograder avant que tout ceci soit clair.\n\n# Ce contrôleur détient-il des rôles FSMO ? Ils doivent être transférés AVANT.\nnetdom query fsmo\nGet-ADDomainController -Identity \'<serveur>\' | Select-Object Name,OperationMasterRoles\n\n# Est-il catalogue global, et reste-t-il un autre GC sur le site ?\nGet-ADDomainController -Filter * | Format-Table Name,Site,IsGlobalCatalog\n\n# Sert-il le DNS pour le domaine ? Un autre serveur doit prendre le relais.\nGet-DnsServerZone -ErrorAction SilentlyContinue | Format-Table ZoneName,ZoneType,IsDsIntegrated\n\n# La réplication est-elle saine ? Rétrograder un domaine déjà malade aggrave tout.\nrepadmin /replsummary\nrepadmin /showrepl\ndcdiag /v\n\n# SYSVOL et NETLOGON sont-ils publiés ailleurs ?\nGet-SmbShare -Name SYSVOL,NETLOGON -ErrorAction SilentlyContinue',
      command:     '# ÉTAPE 2 — RÉTROGRADATION NORMALE, INTERACTIVE.\n# Prérequis : rôles FSMO transférés, un autre catalogue global disponible,\n# DNS assuré par un autre serveur, réplication saine.\n\n# a) Transférer chaque rôle FSMO détenu vers un contrôleur sain\nMove-ADDirectoryServerOperationMasterRole -Identity \'<autre DC sain>\' `\n  -OperationMasterRole PDCEmulator,RIDMaster,InfrastructureMaster,SchemaMaster,DomainNamingMaster\n\n# b) Rétrograder. La commande demande les identifiants et le mot de passe\n#    administrateur local du futur serveur membre, puis confirme chaque étape.\n#    NE PAS ajouter -Force : les contrôles de prérequis et la confirmation\n#    sont précisément ce qui protège le domaine.\nUninstall-ADDSDomainController -Credential (Get-Credential) -Confirm\n\n# Le serveur redémarre à la fin et devient un serveur membre du domaine.',
      exceptional: '# ÉTAPE 3 — CAS EXCEPTIONNEL : contrôleur définitivement irrécupérable.\n#\n# AVERTISSEMENT CRITIQUE — à ne PAS utiliser comme procédure normale.\n# Cette voie force la rétrogradation sans contrôle de prérequis et laisse des\n# métadonnées dans l\'annuaire si elle est mal menée. Une erreur ici peut casser\n# la réplication de TOUT le domaine, pas seulement de ce serveur.\n#\n# Conditions : le serveur est hors service ou inaccessible, aucune rétrogradation\n# normale n\'est possible, et une sauvegarde de l\'état système d\'un contrôleur\n# SAIN existe.\n#\n# Suivre la procédure officielle Microsoft avant d\'exécuter quoi que ce soit :\n# https://learn.microsoft.com/windows-server/identity/ad-ds/deploy/ad-ds-metadata-cleanup\n#\n# Si le serveur répond encore :\n# Uninstall-ADDSDomainController -ForceRemoval -DemoteOperationMasterRole\n#\n# Si le serveur ne répond plus, nettoyer les métadonnées DEPUIS UN DC SAIN.\n# ntdsutil est interactif et se suit pas à pas : il n\'existe pas de version\n# en une ligne sans risque.\n#   ntdsutil\n#     metadata cleanup\n#     connections\n#     ...\n# Après nettoyage : vérifier DNS, sites et services, et relancer\n# repadmin /replsummary sur l\'ensemble des contrôleurs.',
      warning:     'Ne jamais réinstaller simplement un contrôleur de domaine pour s\'en débarrasser : cela laisse son objet et ses métadonnées dans l\'annuaire, et casse la réplication. Avant toute rétrogradation, s\'assurer que les rôles FSMO sont transférés, qu\'un autre catalogue global existe, que le DNS est assuré ailleurs, que SYSVOL et NETLOGON sont publiés sur un autre contrôleur, et que la réplication est saine.',
    },
    checks: [
      'Ne pas utiliser un DNS public sur le serveur à promouvoir.',
      'Vérifier le canal sécurisé et les ports avant la promotion.',
      'Le serveur redémarre automatiquement si l\u2019installation réussit.',
    ],
    // Corrigé au LOT 2 : l'URL précédente renvoyait une page 404. Vérifiée par
    // scripts/verifier-sources.mjs, qui interroge réellement chaque source.
    source: 'https://learn.microsoft.com/powershell/module/addsdeployment/install-addsdomaincontroller',
  },

  // ── 6. Réparation Wi-Fi ──────────────────────────────────────────────────
  {
    id: 'wifi-repair',
    icon: '\u2341',
    category: 'Windows poste de travail',
    subcategory: 'Réseau et Wi-Fi',
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
    keywords: [
      'wifi',
      'wi-fi',
      'sans fil',
      'wlan',
      'wlansvc',
      'connexion',
      'reseau sans fil',
      'plus d internet',
      'deconnexion',
    ],
    requiresAdmin: true,
    os: [
      'Windows 10 et 11',
      'Windows Server avec carte sans fil',
    ],
    prereqs: [
      'Console PowerShell ouverte en tant qu’administrateur.',
      'Module NetAdapter : intégré à Windows.',
      'La carte est désactivée puis réactivée : la connexion sera coupée quelques secondes.',
      'À ne pas exécuter à distance via cette même carte, sous peine de perdre la session.',
    ],
    commonErrors: [
      {
        message: 'Aucune correspondance trouvée pour les critères de recherche : Name = ...',
        cause:   'Le nom de la carte sans fil ne correspond à aucune carte présente.',
        fix:     'Lister les cartes avec Get-NetAdapter et reprendre le nom exact.',
      },
      {
        message: 'Le service ne peut pas être démarré.',
        cause:   'Le service WLAN AutoConfig est désactivé, ou une stratégie l’interdit.',
        fix:     'Vérifier le type de démarrage du service WlanSvc dans services.msc.',
      },
    ],
    reversible: true,
    verifyAfter: [
      'Get-NetAdapter -Name \'<carte>\' affiche Status = Up.',
      'netsh wlan show interfaces indique l\'état de la connexion et le SSID.',
      'Test-NetConnection 8.8.8.8 confirme que le trafic sort.',
    ],
    rollback: {
      summary:     'Aucune configuration n\'est modifiée durablement : la carte est désactivée puis réactivée. Si le script a été interrompu au milieu, il suffit de la rallumer.',
      diagnostic:  '# État réel de la carte avant toute action\nGet-NetAdapter -Name \'<carte>\' | Format-Table Name,Status,LinkSpeed\nnetsh wlan show interfaces',
      command:     '# Rallumer la carte. Cette commande n\'est pas destructive : elle active,\n# elle ne supprime rien et ne reconfigure rien.\nEnable-NetAdapter -Name \'<carte>\'',
      exceptional: '',
      warning:     'Si le script a été interrompu entre la désactivation et la réactivation, la carte reste désactivée et la machine est sans réseau sans fil. La commande ci-dessus la rallume.',
    },
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
    subcategory: 'Sécurité des comptes',
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
    keywords: [
      'mot de passe',
      'strategie de mot de passe',
      'politique',
      'complexite',
      'verrouillage',
      'expiration',
      'gpo',
      'domaine',
    ],
    requiresAdmin: false,
    os: [
      'Contrôleur de domaine Windows Server 2012 et versions ultérieures',
      'Poste d’administration avec RSAT',
    ],
    prereqs: [
      'Module ActiveDirectory : présent sur un contrôleur de domaine, à installer via RSAT sur un poste de travail.',
      'Compte membre des Administrateurs du domaine.',
      'La modification s’applique à TOUT le domaine et affecte chaque utilisateur au prochain changement de mot de passe.',
      'Noter la configuration actuelle avant de la modifier : le script l’affiche en premier.',
    ],
    commonErrors: [
      {
        message: 'Insufficient access rights to perform the operation.',
        cause:   'Le compte utilisé n’est pas administrateur du domaine.',
        fix:     'Relancer avec un compte membre des Administrateurs du domaine.',
      },
      {
        message: 'The server is unwilling to process the request.',
        cause:   'Une valeur demandée est hors des limites acceptées par Active Directory.',
        fix:     'Vérifier la cohérence des durées et de la longueur minimale.',
      },
    ],
    reversible: true,
    verifyAfter: [
      'Get-ADDefaultDomainPasswordPolicy affiche les nouvelles valeurs.',
      'Sur un poste du domaine, gpresult /r confirme l\'application après actualisation.',
    ],
    rollback: {
      summary:     'Réappliquer les valeurs précédentes. Le script affiche la configuration en vigueur AVANT de la modifier : la noter permet de revenir exactement à l\'état initial.',
      diagnostic:  '# Relever les valeurs actuelles AVANT toute modification, et les conserver.\nGet-ADDefaultDomainPasswordPolicy | Format-List `\n  MinPasswordLength,PasswordHistoryCount,MaxPasswordAge,MinPasswordAge,`\n  LockoutThreshold,LockoutDuration,LockoutObservationWindow,ComplexityEnabled',
      command:     '# Réappliquer les anciennes valeurs relevées ci-dessus.\n# Aucune suppression : il s\'agit d\'une reconfiguration.\nSet-ADDefaultDomainPasswordPolicy -Identity \'<domaine>\' `\n  -MinPasswordLength    <ancienne valeur> `\n  -LockoutThreshold     <ancienne valeur> `\n  -LockoutDuration      (New-TimeSpan -Minutes <ancienne valeur>)',
      exceptional: '',
      warning:     'Les mots de passe déjà changés sous la nouvelle règle ne sont pas réinitialisés par l\'annulation. Seule la règle applicable aux prochains changements revient en arrière.',
    },
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
    category: 'Analyse et nettoyage des disques',
    subcategory: 'Occupation de l’espace',
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
    keywords: [
      'disque',
      'espace disque',
      'disque plein',
      'gros fichiers',
      'nettoyage',
      'stockage',
      'saturation',
      'c: plein',
      'manque de place',
    ],
    requiresAdmin: false,
    os: [
      'Windows 10 et 11',
      'Windows Server 2012 et versions ultérieures',
    ],
    prereqs: [
      'Aucun module particulier : utilise Get-ChildItem, présent partout.',
      'Une session normale suffit. Les droits administrateur ne servent qu’à parcourir les dossiers protégés.',
      'Outil DIAGNOSTIC : il lit et rapporte, il ne supprime rien.',
      'L’analyse d’un disque entier peut prendre plusieurs minutes.',
    ],
    commonErrors: [
      {
        message: 'L’accès au chemin d’accès est refusé.',
        cause:   'Certains dossiers système sont protégés et ne peuvent pas être parcourus.',
        fix:     'Message sans gravité : le script continue et ignore ces dossiers. Ouvrir PowerShell en administrateur pour les inclure.',
      },
      {
        message: 'Le chemin d’accès spécifié est introuvable.',
        cause:   'Le lecteur ou le dossier saisi n’existe pas.',
        fix:     'Vérifier la lettre de lecteur avec Get-PSDrive.',
      },
    ],
    reversible: false,
    verifyAfter: [
      'Le rapport CSV est créé à l\'emplacement indiqué en fin de script.',
      'Le tableau affiché liste les plus gros éléments par taille décroissante.',
    ],
    rollback: {
      summary:     'Aucune annulation nécessaire : cet outil est en LECTURE SEULE. Il analyse, affiche et écrit un rapport, mais ne supprime ni ne déplace aucun fichier.',
      diagnostic:  '# Rien à diagnostiquer : l\'outil n\'a modifié aucune donnée.\n# Emplacement du rapport produit, si tu veux le relire ou le retirer :\nGet-Item \'<chemin du rapport>.csv\' | Select-Object FullName,Length,LastWriteTime',
      command:     '# Rien à annuler côté système.\n# Pour retirer le rapport produit, avec confirmation :\nRemove-Item \'<chemin du rapport>.csv\' -Confirm',
      exceptional: '',
      warning:     '',
    },
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

// ---------------------------------------------------------------------------
// LOT 2 — catalogue Windows Server
// Les outils vivent dans dist/outils-serveur.mjs ; ils rejoignent ici le
// catalogue unique, seul point d'entrée pour l'interface et pour les tests.
// L'ordre est stable : les huit outils historiques d'abord, les nouveaux
// ensuite, pour que les routes directes et les tests restent lisibles.
// ---------------------------------------------------------------------------
for (const outil of toolsServeur) tools.push(outil);

// ---------------------------------------------------------------------------
// LOT 3 — catalogue Active Directory avancé
// Même principe qu'au LOT 2 : les outils vivent dans leur module, et rejoignent
// ici le catalogue unique. L'ordre reste stable, lot après lot.
// ---------------------------------------------------------------------------
for (const outil of toolsAd) tools.push(outil);

