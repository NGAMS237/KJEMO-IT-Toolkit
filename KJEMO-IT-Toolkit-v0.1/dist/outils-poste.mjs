/**
 * outils-poste.mjs — LOT 6 · KJEMO IT Toolkit
 * ---------------------------------------------
 * Les assistants de la catégorie « Poste de travail Windows ».
 *
 * Ce module suit exactement la forme des précédents : il importe psB64 et
 * assertValid du noyau, les validateurs partagés, les blocs de rapport et les
 * assembleurs communs d'outils-serveur.mjs. Aucun import circulaire :
 * generators.mjs importe ce module, jamais l'inverse. Aucun validateur n'est
 * redéfini ici.
 *
 * ---------------------------------------------------------------------------
 * Où s'arrête ce lot, et pourquoi
 * ---------------------------------------------------------------------------
 *
 * 1. LE POSTE, PAS LE SERVEUR. Ce lot regarde la machine de l'utilisateur :
 *    ses périphériques, ses mises à jour, ses lenteurs, son espace disque.
 *    Les rôles serveur restent dans « Windows Server », l'annuaire dans
 *    « Active Directory », les stratégies dans « GPO », et le réseau dans
 *    « Réseau » — y compris le Wi-Fi.
 *
 * 2. DIAGNOSTIQUER AVANT DE RÉPARER. Tout assistant qui peut modifier l'état
 *    de la machine part en mode Diagnostic, montre ce qu'il ferait, et porte
 *    un VERROU explicite : une liste de conditions qui doivent TOUTES être
 *    vraies avant le premier appel modifiant. Une vérification qui ne bloque
 *    pas n'est pas une vérification.
 *
 * 3. LA CONSOLE RESTE OUVERTE. Aucun script de ce lot n'appelle « exit » pour
 *    fermer une session interactive, ne redémarre la machine, ni ne masque une
 *    erreur. Une console qui se ferme emporte le diagnostic, et la personne ne
 *    sait plus ce qui s'est passé. C'est une erreur constatée, pas une crainte
 *    théorique, et une assertion la surveille sur chaque script généré.
 *
 * 4. LE DISQUE C: N'EST PAS UN DISQUE DE DONNÉES. Toute analyse ou tout
 *    nettoyage le concernant porte un avertissement renforcé. Aucun joker,
 *    aucune récursion sur une racine, aucun chemin dérivé non vérifié, et
 *    jamais de suppression avant une estimation affichée.
 *
 * 5. AUCUN SECRET, AUCUN CONTOURNEMENT. Pas de clé de produit affichée, pas de
 *    mot de passe demandé, aucune protection Windows désactivée, aucun pilote
 *    téléchargé depuis une source tierce, aucune exclusion Defender ajoutée
 *    automatiquement.
 *
 * 6. L'APPLICATION N'EXÉCUTE RIEN. Le site produit un script à lire, puis à
 *    lancer soi-même. Il n'y a ni bouton « Réparer », ni exécution distante.
 */

import { psB64, assertValid } from './noyau.mjs';
import {
  validerEntier,
  validerFormatRapport,
  validerModeExecution,
  validerChoix,
  validerCheminWindowsLocal,
  validerNomOrdinateur,
} from './validateurs.mjs';
import { blocModeDiagnostic } from './rapport-ps.mjs';
import { champMode, champFormat, verifier, assembler } from './outils-serveur.mjs';

/**
 * Version portée par les assistants de ce lot.
 *
 * Elle est passée explicitement à `assembler`, outil par outil. Les scripts
 * des lots antérieurs gardent VERSION_OUTILS et restent identiques octet pour
 * octet : c'est la garde d'identité qui l'exige, et c'est vérifié.
 */
export const VERSION_POSTE = 'LOT 6 — Poste de travail Windows — 6.0.0';

// ---------------------------------------------------------------------------
// Socle commun
// ---------------------------------------------------------------------------

/**
 * Systèmes couverts. Le poste visé est Windows 10 ou 11 ; les mentions de
 * Windows Server sont là parce que la plupart de ces diagnostics y
 * fonctionnent aussi, et parce que le contrat de fiche les exige nommément.
 */
export const OS_POSTE = [
  'Windows 10 22H2 et Windows 11 (cible principale de ce lot)',
  'Windows Server 2019 et Windows Server 2022 : la plupart des contrôles y fonctionnent aussi',
  'Windows PowerShell 5.1 (moteur de référence)',
  'PowerShell 7.4 et plus récent',
];

/** Prérequis communs. Beaucoup de contrôles lisent sans élévation. */
export const PREREQS_POSTE = [
  'Windows PowerShell 5.1 ou PowerShell 7, sur le poste à examiner.',
  'Les modules livrés avec Windows : CimCmdlets, Microsoft.PowerShell.Management, Microsoft.PowerShell.Diagnostics. Aucune installation.',
  'Une partie des contrôles lit sans élévation ; ceux qui en ont besoin le disent avant, et le script le vérifie lui-même.',
];

/** Erreurs qu'on rencontre dans tout ce lot. */
export const ERREURS_POSTE = [
  {
    message: 'Le fichier n’est pas signé numériquement — PSSecurityException',
    cause: 'Windows a marqué le fichier comme venant d’Internet, et la stratégie d’exécution refuse de le lancer. C’est une protection qui fonctionne, pas une panne.',
    fix: 'Débloquer le fichier téléchargé : « Unblock-File -LiteralPath .\\le-script.ps1 ». S’il faut encore une session permissive, en ouvrir une ISOLÉE, qui meurt avec sa fenêtre : « powershell -ExecutionPolicy Bypass -File .\\le-script.ps1 ». Ne jamais changer la stratégie de la machine : « Set-ExecutionPolicy » hors d’une session isolée survit au redémarrage et vaut pour tous les scripts à venir. Le bloc « Avant d’exécuter » des fiches donne la marche à suivre complète.',
  },
  {
    message: 'Accès refusé (Access is denied) sur une lecture WMI ou CIM',
    cause: 'La classe demandée exige une élévation, ou la stratégie locale restreint l’accès à WMI.',
    fix: 'Relancer la console en tant qu’administrateur. Le script dit lui-même, dans son rapport, s’il tourne élevé ou non.',
  },
  {
    message: 'Get-WinEvent ne trouve aucun événement correspondant',
    cause: 'Le journal est vide sur la fenêtre demandée, a été purgé, ou le fournisseur n’existe pas sur cette édition de Windows.',
    fix: 'Ce n’est pas une erreur : un journal vide est une information. Élargir la fenêtre en jours, ou vérifier la taille du journal dans l’Observateur d’événements.',
  },
];

/**
 * En-tête commun des scripts de ce lot : il nomme la machine, son édition, et
 * dit si la console est élevée.
 *
 * Sans ce bloc, un rapport de poste ne veut rien dire : « le service est
 * arrêté » n'a pas le même sens selon l'édition de Windows, et « accès
 * refusé » s'explique la plupart du temps par une console non élevée.
 */
export function blocContextePoste() {
  return [
    "# --- Contexte : quelle machine, quelle edition, quels droits ? --------------------",
    "# Un diagnostic de poste ne se relit pas sans ces trois informations. « Le",
    "# service est arrete » et « acces refuse » ne veulent pas dire la meme chose",
    '# selon l\'edition de Windows et selon que la console est elevee ou non.',
    '$KjemoEleve = $false',
    'try {',
    '  $identite = [Security.Principal.WindowsIdentity]::GetCurrent()',
    '  $principal = New-Object Security.Principal.WindowsPrincipal($identite)',
    '  $KjemoEleve = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
    '} catch { }',
    "[void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Machine' -Etat 'INFO' -Valeur $env:COMPUTERNAME)",
    "[void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Session' -Etat 'INFO' -Valeur $env:USERNAME)",
    '$osInfo = $null',
    "try { $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue } catch { }",
    'if ($osInfo) {',
    "  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Systeme' -Etat 'INFO' -Valeur $osInfo.Caption -Commentaire ('version ' + $osInfo.Version + ' · build ' + $osInfo.BuildNumber))",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Systeme' -Etat 'ATTENTION' -Valeur 'non lu' -Commentaire 'Win32_OperatingSystem n''a pas repondu : WMI est peut-etre restreint sur ce poste.')",
    '}',
    'if ($KjemoEleve) {',
    "  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Elevation' -Etat 'OK' -Valeur 'console administrateur' -Commentaire 'Les controles qui demandent une elevation pourront aboutir.')",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Elevation' -Etat 'ATTENTION' -Valeur 'console standard' -Commentaire 'Certains controles seront IGNORE faute de droits. Ce n''est pas une panne : relancer en administrateur pour les obtenir.')",
    '}',
  ].join('\n');
}

/**
 * Bloc de rappel, présent dans CHAQUE script du lot : la console reste
 * ouverte, et le script ne redémarre rien.
 *
 * Il n'est pas décoratif. Un script de maintenance qui se termine par « exit »
 * ferme la fenêtre de la personne, emporte le message d'erreur avec elle, et
 * transforme un diagnostic en mystère. C'est une erreur constatée. Le bloc
 * l'énonce, et une assertion vérifie sur chaque script généré qu'aucun « exit »
 * nu ni aucun redémarrage ne s'y est glissé.
 */
export function blocConsoleOuverte() {
  return [
    '',
    "Write-Host ''",
    "Write-Host '--- Ce script ne ferme pas votre console ---'",
    "Write-Host 'Il ne contient aucun « exit » qui fermerait cette fenetre, et ne'",
    "Write-Host 'redemarre jamais Windows de lui-meme. Si une erreur survient, elle'",
    "Write-Host 'reste affichee : c''est elle qu''on relit.'",
    "Write-Host 'Fermez la fenetre vous-meme quand vous avez fini de lire.'",
  ].join('\n');
}

/** Bloc de rappel : cet assistant ne contourne aucune protection Windows. */
export function blocAucunContournementPoste() {
  return [
    '',
    "Write-Host ''",
    "Write-Host '--- Ce que ce script ne fait pas ---'",
    "Write-Host 'Il ne demande aucun mot de passe et n''en ecrit aucun.'",
    "Write-Host 'Il n''affiche aucune cle de produit, aucun jeton, aucun secret.'",
    "Write-Host 'Il ne desactive ni Defender, ni le pare-feu, ni le controle de compte.'",
    "Write-Host 'Il ne contourne aucune permission : un acces refuse est rapporte,'",
    "Write-Host 'jamais force.'",
    "Write-Host 'Il ne telecharge aucun pilote ni aucun programme.'",
  ].join('\n');
}

/**
 * Avertissement renforcé pour le disque système.
 *
 * `C:` n'est pas un disque de données : des fichiers y sont verrouillés,
 * d'autres sont nécessaires au démarrage, et l'espace qu'on y gagne ne vaut
 * jamais le risque d'un geste automatique. Le bloc s'insère dès qu'un
 * assistant regarde ou touche au volume système.
 */
export function blocAvertissementDisqueSysteme(action = 'analyse') {
  return [
    '',
    "Write-Host ''",
    "Write-Host '=== AVERTISSEMENT — DISQUE SYSTEME ==='",
    `Write-Host 'Cette ${action} concerne le volume systeme. Ce n''est pas un disque'`,
    "Write-Host 'de donnees : des fichiers y sont verrouillles par Windows, d''autres'",
    "Write-Host 'sont necessaires au demarrage, et l''espace qu''on y gagne ne vaut'",
    "Write-Host 'jamais le risque d''un geste automatique.'",
    "Write-Host 'Ce script n''effectue aucune suppression globale, n''utilise aucun'",
    "Write-Host 'joker, et ne descend jamais recursivement depuis une racine.'",
    "[void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Volume systeme' -Etat 'ATTENTION' -Valeur $env:SystemDrive -Commentaire 'Aucune suppression globale, aucun joker, aucune recursion depuis la racine.')",
  ].join('\n');
}

/**
 * Le gardien de chemin, commun à tous les assistants qui touchent au système
 * de fichiers.
 *
 * Il est écrit UNE fois, en PowerShell, et inséré tel quel. Un chemin vide,
 * relatif, racine de volume, ou pointant vers une zone protégée est refusé
 * AVANT toute énumération — pas après. Les protections ne sont pas une liste
 * de bonnes intentions : ce sont des refus, et le script le dit.
 */
export function blocGardienChemin() {
  return [
    "# --- Gardien de chemin --------------------------------------------------------------",
    "# Un chemin vide, relatif, racine de volume ou protege est refuse AVANT toute",
    '# enumeration. La fonction rend $true quand le chemin est utilisable, et dit',
    '# pourquoi quand il ne l\'est pas.',
    '$global:KjemoCheminsProteges = @(',
    "  '.git', '.env', '.ssh', 'System Volume Information', '`$Recycle.Bin',",
    "  'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData', 'Users', 'Boot', 'Recovery'",
    ')',
    'function Test-KjemoCheminSur {',
    '  [CmdletBinding()] param([string]$Chemin, [string]$Role)',
    '  if ([string]::IsNullOrWhiteSpace($Chemin)) {',
    "    [void](Add-KjemoResultat -Categorie 'Chemin' -Controle $Role -Etat 'PROBLEME' -Valeur 'vide' -Commentaire 'Un chemin vide se resout en repertoire courant : refuse.')",
    '    return $false',
    '  }',
    '  if (-not [System.IO.Path]::IsPathRooted($Chemin)) {',
    "    [void](Add-KjemoResultat -Categorie 'Chemin' -Controle $Role -Etat 'PROBLEME' -Valeur $Chemin -Commentaire 'Chemin relatif : refuse. Donner un chemin complet, lettre de lecteur comprise.')",
    '    return $false',
    '  }',
    '  $canon = $null',
    '  try { $canon = [System.IO.Path]::GetFullPath($Chemin) } catch { }',
    '  if (-not $canon) {',
    "    [void](Add-KjemoResultat -Categorie 'Chemin' -Controle $Role -Etat 'PROBLEME' -Valeur $Chemin -Commentaire 'Chemin impossible a canoniser.')",
    '    return $false',
    '  }',
    "  $canon = $canon.TrimEnd('\\')",
    '  if ($canon.Length -le 2) {',
    "    [void](Add-KjemoResultat -Categorie 'Chemin' -Controle $Role -Etat 'PROBLEME' -Valeur $canon -Commentaire 'Racine de volume : refuse. Aucune operation de ce script ne s''applique a un disque entier.')",
    '    return $false',
    '  }',
    "  if ($canon -like '\\\\*') {",
    "    [void](Add-KjemoResultat -Categorie 'Chemin' -Controle $Role -Etat 'PROBLEME' -Valeur $canon -Commentaire 'Chemin UNC : hors de portee de ce script, qui travaille sur le poste local.')",
    '    return $false',
    '  }',
    "  $feuilles = $canon.Split('\\') | Where-Object { $_ -ne '' }",
    '  $nom = $feuilles[$feuilles.Count - 1]',
    '  foreach ($protege in $global:KjemoCheminsProteges) {',
    '    if ($nom -eq $protege) {',
    "      [void](Add-KjemoResultat -Categorie 'Chemin' -Controle $Role -Etat 'PROBLEME' -Valeur $canon -Commentaire ('Dossier protege (' + $protege + ') : refuse. Ce script ne touche ni aux zones systeme, ni a .git, .env, .ssh.'))",
    '      return $false',
    '    }',
    '  }',
    "  [void](Add-KjemoResultat -Categorie 'Chemin' -Controle $Role -Etat 'OK' -Valeur $canon -Commentaire 'Chemin canonique, absolu, hors racine et hors zone protegee.')",
    '  return $true',
    '}',
  ].join('\n');
}

/** Normalise une liste de mots-clés : minuscules, sans doublon. */
function motsCles(...listes) {
  const vus = new Set();
  const sortie = [];
  for (const mot of listes.flat()) {
    const m = String(mot).toLowerCase().trim();
    if (m && !vus.has(m)) { vus.add(m); sortie.push(m); }
  }
  return sortie;
}

/**
 * Processus Windows qu'on n'arrête pas, quelle que soit la confirmation.
 *
 * La règle « PID supérieur à 4 = non système » est fausse : `lsass`, `csrss`,
 * `winlogon` ou `services` portent des PID ordinaires, et y mettre fin
 * provoque un écran bleu ou une déconnexion immédiate. Le PID ne dit rien ;
 * le nom, lui, dit quelque chose.
 *
 * **Cette liste n'est pas exhaustive, et ne prétend pas l'être.** Microsoft ne
 * publie pas de liste officielle fermée des processus critiques : la notion
 * qui s'en approche est celle des processus marqués « critiques » par le
 * noyau, et elle se constate à l'exécution, pas dans une page. C'est donc une
 * BARRIÈRE SUPPLÉMENTAIRE, posée au-dessus du refus des PID 0 à 4 — pas une
 * garantie. Un processus absent de cette liste peut parfaitement être vital
 * pour la machine, et c'est à la personne de le savoir.
 *
 * Les noms sont comparés sans tenir compte de la casse, et sans extension :
 * c'est la forme que rend `Get-Process`.
 */
export const PROCESSUS_PROTEGES = [
  'System', 'Registry', 'Idle', 'smss', 'csrss', 'wininit', 'winlogon',
  'services', 'lsass', 'lsaiso', 'fontdrvhost', 'dwm', 'logonui', 'svchost',
  'MemCompression', 'Secure System',
];

// ===========================================================================
// A. DIAGNOSTIC GÉNÉRAL
// ===========================================================================

/**
 * 1. workstation-health-report — l'état complet du poste, en une passe.
 *
 * Celui qu'on lance en premier quand on ne sait pas encore quoi chercher, et
 * qu'on joint au billet quand on passe le dossier à quelqu'un d'autre. Il ne
 * modifie rien, et il relève toujours dans le même ordre : deux rapports du
 * même poste, pris à deux moments, doivent se comparer à l'œil.
 *
 * Il ne refait pas le travail du LOT 5 : le réseau n'y figure qu'en résumé,
 * avec un renvoi vers les assistants qui l'examinent vraiment.
 */
export const outilSantePoste = {
  id: 'workstation-health-report',
  icon: '▣',
  category: 'Poste de travail Windows',
  subcategory: 'Diagnostic général',
  title: 'Diagnostic complet du poste Windows',
  risk: 'diagnostic',
  summary: 'Relève en une passe l’identité du poste, le matériel, les volumes, le démarrage, les événements critiques, l’état de Windows Update et de Defender, les périphériques en erreur et les services automatiques arrêtés. Ne modifie rien. Le réseau n’y figure qu’en résumé : les assistants de la catégorie Réseau l’examinent pour de bon.',
  fields: [
    {
      id: 'whJours', label: 'Fenêtre des événements critiques (jours)', default: '7',
      help: 'Entre 1 et 90. Les journaux Système et Application sont lus sur cette période.',
    },
    {
      id: 'whSeuilDisque', label: 'Alerte si l’espace libre descend sous (%)', default: '15',
      help: 'Entre 1 et 90. Un volume sous ce seuil est signalé. Windows commence à mal se comporter bien avant d’être plein.',
    },
    champFormat('whFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'whJours', validerEntier(v.whJours, 1, 90, 'La fenêtre'));
    verifier(errors, 'whSeuilDisque', validerEntier(v.whSeuilDisque, 1, 90, 'Le seuil d’espace libre'));
    verifier(errors, 'whFormat', validerFormatRapport(v.whFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.whJours, 1, 90).value;
    const seuil = validerEntier(v.whSeuilDisque, 1, 90).value;

    const corps = [
      `$Jours = ${jours}`,
      `$SeuilDisque = ${seuil}`,
      `$KjemoFormat = ${psB64(v.whFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- 1. Identite de la machine ------------------------------------------------------------',
      '$cs = $null',
      '$bios = $null',
      "try { $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue } catch { }",
      "try { $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue } catch { }",
      'if ($cs) {',
      "  [void](Add-KjemoResultat -Categorie 'Machine' -Controle 'Fabricant et modele' -Etat 'INFO' -Valeur ([string]$cs.Manufacturer + ' ' + [string]$cs.Model))",
      "  [void](Add-KjemoResultat -Categorie 'Machine' -Controle 'Domaine ou groupe' -Etat 'INFO' -Valeur ([string]$cs.Domain) -Commentaire (& { if ($cs.PartOfDomain) { 'Membre d''un domaine.' } else { 'Machine hors domaine (groupe de travail).' } }))",
      '}',
      'if ($bios) {',
      "  [void](Add-KjemoResultat -Categorie 'Machine' -Controle 'BIOS / UEFI' -Etat 'INFO' -Valeur ([string]$bios.SMBIOSBIOSVersion) -Commentaire ('date : ' + [string]$bios.ReleaseDate))",
      '}',
      '# Le mode de demarrage : UEFI ou BIOS hérité. Il explique bien des',
      "# differences de comportement au demarrage, et conditionne Secure Boot.",
      '$firmware = $null',
      "try { $firmware = $env:firmware_type } catch { }",
      "if ($firmware) { [void](Add-KjemoResultat -Categorie 'Machine' -Controle 'Mode de demarrage' -Etat 'INFO' -Valeur $firmware) }",
      '',
      '# --- 2. Processeur et memoire -------------------------------------------------------------',
      '$cpu = $null',
      "try { $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1 } catch { }",
      'if ($cpu) {',
      "  [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Processeur' -Etat 'INFO' -Valeur ([string]$cpu.Name) -Commentaire ([string]$cpu.NumberOfCores + ' coeur(s), ' + [string]$cpu.NumberOfLogicalProcessors + ' processeur(s) logique(s)'))",
      '}',
      'if ($osInfo) {',
      '  $totalMo = [Math]::Round($osInfo.TotalVisibleMemorySize / 1024)',
      '  $libreMo = [Math]::Round($osInfo.FreePhysicalMemory / 1024)',
      '  $pctLibre = 0',
      '  if ($totalMo -gt 0) { $pctLibre = [Math]::Round(($libreMo * 100) / $totalMo) }',
      "  $etatMem = 'OK'",
      "  $noteMem = 'La memoire libre varie en permanence : ce chiffre est une photographie, pas une tendance.'",
      "  if ($pctLibre -lt 10) { $etatMem = 'ATTENTION' ; $noteMem = 'Moins de 10 % de memoire libre a cet instant. A confirmer par une mesure repetee avant d''en conclure quoi que ce soit.' }",
      "  [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Memoire' -Etat $etatMem -Valeur ([string]$libreMo + ' Mo libres sur ' + [string]$totalMo + ' Mo (' + [string]$pctLibre + ' %)') -Commentaire $noteMem)",
      '}',
      '',
      '# --- 3. Volumes et espace disponible ------------------------------------------------------',
      '$volumes = @()',
      "try { $volumes = @(Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DriveType -eq 3 }) } catch { }",
      'if ($volumes.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Volumes' -Controle 'Disques locaux' -Etat 'ATTENTION' -Valeur 0 -Commentaire 'Aucun volume local lu. WMI est peut-etre restreint.')",
      '}',
      'foreach ($vol in $volumes) {',
      '  $totalGo = 0',
      '  $libreGo = 0',
      '  if ($vol.Size) { $totalGo = [Math]::Round($vol.Size / 1GB, 1) }',
      '  if ($vol.FreeSpace) { $libreGo = [Math]::Round($vol.FreeSpace / 1GB, 1) }',
      '  $pct = 0',
      '  if ($vol.Size -and $vol.Size -gt 0) { $pct = [Math]::Round(($vol.FreeSpace * 100) / $vol.Size) }',
      "  $etatV = 'OK'",
      "  $noteV = 'Espace confortable.'",
      "  if ($pct -lt $SeuilDisque) { $etatV = 'ATTENTION' ; $noteV = 'Sous le seuil demande. Windows ralentit, les mises a jour echouent et les profils se chargent mal bien avant que le disque soit plein.' }",
      "  if ($pct -lt 5) { $etatV = 'PROBLEME' ; $noteV = 'Moins de 5 % libres : les mises a jour et les points de restauration vont echouer.' }",
      "  [void](Add-KjemoResultat -Categorie 'Volumes' -Controle ([string]$vol.DeviceID + ' ' + [string]$vol.VolumeName) -Etat $etatV -Valeur ([string]$libreGo + ' Go libres sur ' + [string]$totalGo + ' Go (' + [string]$pct + ' %)') -Commentaire $noteV)",
      '}',
      '',
      '# --- 4. Demarrage recent ------------------------------------------------------------------',
      '# Un poste qui n\'a pas redemarre depuis des semaines accumule des mises a',
      '# jour en attente et des fuites memoire. Un poste qui redemarre sans cesse',
      "# a un autre probleme. Les deux se lisent ici.",
      'if ($osInfo -and $osInfo.LastBootUpTime) {',
      '  $depuisBoot = (Get-Date) - $osInfo.LastBootUpTime',
      '  $heures = [Math]::Round($depuisBoot.TotalHours)',
      "  $etatB = 'OK'",
      "  $noteB = 'Duree de fonctionnement normale.'",
      "  if ($heures -gt 720) { $etatB = 'ATTENTION' ; $noteB = 'Plus de 30 jours sans redemarrage : des mises a jour attendent probablement, et la memoire se fragmente.' }",
      "  if ($heures -lt 1) { $noteB = 'La machine vient de demarrer : les services ne sont peut-etre pas tous stabilises.' }",
      "  [void](Add-KjemoResultat -Categorie 'Demarrage' -Controle 'Dernier demarrage' -Etat $etatB -Valeur ([string]$osInfo.LastBootUpTime) -Commentaire ($noteB + ' Il y a ' + [string]$heures + ' heure(s).'))",
      '}',
      '# Le demarrage rapide garde une partie de la session precedente : un',
      '# « redemarrage » par arret puis rallumage ne vide alors pas tout.',
      '$demarrageRapide = $null',
      'try {',
      "  $cle = Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name 'HiberbootEnabled' -ErrorAction SilentlyContinue",
      '  if ($cle) { $demarrageRapide = $cle.HiberbootEnabled }',
      '} catch { }',
      'if ($null -ne $demarrageRapide) {',
      "  $etatR = 'INFO'",
      "  $noteR = 'Desactive : un arret est un vrai arret.'",
      "  if ($demarrageRapide -eq 1) { $etatR = 'ATTENTION' ; $noteR = 'Active : « Arreter » puis rallumer ne vide pas la session. Pour repartir vraiment a zero, choisir « Redemarrer ».' }",
      "  [void](Add-KjemoResultat -Categorie 'Demarrage' -Controle 'Demarrage rapide' -Etat $etatR -Valeur ([string]$demarrageRapide) -Commentaire $noteR)",
      '}',
      '',
      '# --- 5. Evenements critiques recents ------------------------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      "foreach ($journal in @('System', 'Application')) {",
      '  $evts = @()',
      '  try {',
      '    $evts = @(Get-WinEvent -FilterHashtable @{ LogName = $journal; Level = 1,2; StartTime = $depuis } -ErrorAction SilentlyContinue | Select-Object -First 40)',
      '  } catch { }',
      '  if ($evts.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Evenements' -Controle ($journal + ' — critiques et erreurs') -Etat 'OK' -Valeur 0 -Commentaire ('Rien de critique sur ' + [string]$Jours + ' jour(s).'))",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Evenements' -Controle ($journal + ' — critiques et erreurs') -Etat 'ATTENTION' -Valeur $evts.Count -Commentaire ('Sur ' + [string]$Jours + ' jour(s). Les plus frequents sont detailles ci-dessous.'))",
      '    $groupes = $evts | Group-Object -Property Id | Sort-Object Count -Descending | Select-Object -First 5',
      '    foreach ($g in $groupes) {',
      '      $exemple = $g.Group | Select-Object -First 1',
      '      $texte = \'\'',
      '      try { $texte = ([string]$exemple.Message).Split("`n")[0] } catch { }',
      "      [void](Add-KjemoResultat -Categorie 'Evenements' -Controle ($journal + ' — ID ' + [string]$g.Name) -Etat 'INFO' -Valeur ([string]$g.Count + ' occurrence(s)') -Commentaire ([string]$exemple.ProviderName + ' · ' + $texte))",
      '    }',
      '  }',
      '}',
      '',
      '# --- 6. Windows Update, en lecture seule --------------------------------------------------',
      "foreach ($svc in @('wuauserv', 'bits', 'cryptsvc', 'trustedinstaller')) {",
      '  $s = $null',
      '  try { $s = Get-Service -Name $svc -ErrorAction SilentlyContinue } catch { }',
      '  if ($s) {',
      "    $etatS = 'INFO'",
      "    if ($s.Status -ne 'Running' -and $s.StartType -eq 'Disabled') { $etatS = 'PROBLEME' }",
      "    [void](Add-KjemoResultat -Categorie 'Windows Update' -Controle ('Service ' + $s.Name) -Etat $etatS -Valeur ([string]$s.Status) -Commentaire ('demarrage : ' + [string]$s.StartType + '. Un service de mise a jour desactive explique un poste qui ne se met plus a jour.'))",
      '  }',
      '}',
      '$majRecentes = @()',
      "try { $majRecentes = @(Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending | Select-Object -First 5) } catch { }",
      'if ($majRecentes.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Windows Update' -Controle 'Correctifs recents' -Etat 'ATTENTION' -Valeur 'aucun lu' -Commentaire 'Get-HotFix ne liste que les correctifs de type QFE : son silence n''est pas une preuve d''absence de mise a jour.')",
      '} else {',
      '  foreach ($maj in $majRecentes) {',
      "    [void](Add-KjemoResultat -Categorie 'Windows Update' -Controle ([string]$maj.HotFixID) -Etat 'INFO' -Valeur ([string]$maj.InstalledOn) -Commentaire ([string]$maj.Description))",
      '  }',
      '}',
      '# Un redemarrage en attente bloque les mises a jour suivantes.',
      '$redemarrageAttendu = $false',
      'try {',
      "  if (Test-Path -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') { $redemarrageAttendu = $true }",
      "  if (Test-Path -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') { $redemarrageAttendu = $true }",
      '} catch { }',
      'if ($redemarrageAttendu) {',
      "  [void](Add-KjemoResultat -Categorie 'Windows Update' -Controle 'Redemarrage en attente' -Etat 'ATTENTION' -Valeur 'oui' -Commentaire 'Tant qu''il n''a pas eu lieu, les mises a jour suivantes echoueront. Ce script ne redemarre rien : c''est a planifier.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Windows Update' -Controle 'Redemarrage en attente' -Etat 'OK' -Valeur 'non')",
      '}',
      '',
      '# --- 7. Microsoft Defender, en lecture seule ----------------------------------------------',
      '$def = $null',
      'try { $def = Get-MpComputerStatus -ErrorAction SilentlyContinue } catch { }',
      'if (-not $def) {',
      "  [void](Add-KjemoResultat -Categorie 'Defender' -Controle 'Etat' -Etat 'IGNORE' -Valeur 'non lisible' -Commentaire 'Get-MpComputerStatus n''a pas repondu : Defender est peut-etre remplace par un autre antivirus, ou la console n''est pas elevee. Ce n''est pas une preuve d''absence de protection.')",
      '} else {',
      "  $etatD = 'OK'",
      "  if (-not $def.RealTimeProtectionEnabled) { $etatD = 'PROBLEME' }",
      "  [void](Add-KjemoResultat -Categorie 'Defender' -Controle 'Protection en temps reel' -Etat $etatD -Valeur ([string]$def.RealTimeProtectionEnabled) -Commentaire 'Ce script ne modifie aucun reglage de Defender.')",
      '  $ageSignatures = 0',
      '  try { $ageSignatures = [int]$def.AntivirusSignatureAge } catch { }',
      "  $etatSig = 'OK'",
      "  if ($ageSignatures -gt 3) { $etatSig = 'ATTENTION' }",
      "  if ($ageSignatures -gt 14) { $etatSig = 'PROBLEME' }",
      "  [void](Add-KjemoResultat -Categorie 'Defender' -Controle 'Age des signatures' -Etat $etatSig -Valeur ([string]$ageSignatures + ' jour(s)') -Commentaire ('Derniere mise a jour : ' + [string]$def.AntivirusSignatureLastUpdated))",
      '}',
      '',
      '# --- 8. Peripheriques en erreur -----------------------------------------------------------',
      '# Le code 22 signale un peripherique desactive : ce n\'est pas une panne,',
      "# c'est une decision. Les autres codes meritent qu'on s'y arrete.",
      '$pnp = @()',
      "try { $pnp = @(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.ConfigManagerErrorCode -ne 0 }) } catch { }",
      'if ($pnp.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Peripheriques' -Controle 'En erreur' -Etat 'OK' -Valeur 0 -Commentaire 'Aucun peripherique ne signale de code d''erreur.')",
      '} else {',
      '  foreach ($p in ($pnp | Select-Object -First 25)) {',
      '    $code = [int]$p.ConfigManagerErrorCode',
      "    $etatP = 'PROBLEME'",
      "    $noteP = 'Code ' + [string]$code + '. Voir l''assistant d''audit des pilotes pour le detail.'",
      "    if ($code -eq 22) { $etatP = 'INFO' ; $noteP = 'Code 22 : peripherique desactive volontairement. Ce n''est pas une panne.' }",
      "    [void](Add-KjemoResultat -Categorie 'Peripheriques' -Controle ([string]$p.Name) -Etat $etatP -Valeur ('code ' + [string]$code) -Commentaire $noteP)",
      '  }',
      '}',
      '',
      '# --- 9. Services automatiques arretes -----------------------------------------------------',
      '# Certains services automatiques s\'arretent normalement apres leur travail :',
      "# ce sont des demarrages differes. Le rapport les distingue plutot que de",
      '# tout signaler en bloc.',
      '$arretes = @()',
      'try {',
      "  $arretes = @(Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue | Where-Object { $_.StartMode -eq 'Auto' -and $_.State -ne 'Running' })",
      '} catch { }',
      'if ($arretes.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Services' -Controle 'Automatiques arretes' -Etat 'OK' -Valeur 0)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Services' -Controle 'Automatiques arretes' -Etat 'ATTENTION' -Valeur $arretes.Count -Commentaire 'Certains sont a demarrage differe et s''arretent normalement. Les autres meritent un regard.')",
      '  foreach ($a in ($arretes | Select-Object -First 20)) {',
      "    [void](Add-KjemoResultat -Categorie 'Services' -Controle ([string]$a.DisplayName) -Etat 'INFO' -Valeur ([string]$a.Name) -Commentaire ('compte : ' + [string]$a.StartName))",
      '  }',
      '}',
      '',
      '# --- 10. Outils de reparation disponibles -------------------------------------------------',
      "# On ne les LANCE pas : on verifie qu'ils sont la, et on dit quel assistant",
      '# les encadre.',
      "foreach ($paire in @(@('sfc.exe', 'SFC'), @('DISM.exe', 'DISM'), @('chkdsk.exe', 'CHKDSK'))) {",
      '  $cmd = $null',
      '  try { $cmd = Get-Command -Name $paire[0] -ErrorAction SilentlyContinue } catch { }',
      '  if ($cmd) {',
      "    [void](Add-KjemoResultat -Categorie 'Reparation' -Controle ($paire[1] + ' disponible') -Etat 'OK' -Valeur ([string]$cmd.Source) -Commentaire 'Present. Ce script ne le lance pas : les assistants dedies l''encadrent.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Reparation' -Controle ($paire[1] + ' disponible') -Etat 'ATTENTION' -Valeur 'introuvable' -Commentaire 'L''outil n''est pas dans le chemin de recherche.')",
      '  }',
      '}',
      '',
      '# --- 11. Reseau : resume seulement --------------------------------------------------------',
      "# Ce lot ne refait pas le travail du LOT 5. Trois lignes pour situer, et un",
      '# renvoi vers les assistants qui examinent vraiment le reseau.',
      '$carteDefaut = $null',
      "try { $carteDefaut = Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1 } catch { }",
      'if ($carteDefaut) {',
      '  $ad = $null',
      '  try { $ad = ($carteDefaut.IPv4Address | Select-Object -First 1) } catch { }',
      "  [void](Add-KjemoResultat -Categorie 'Reseau (resume)' -Controle 'Carte principale' -Etat 'OK' -Valeur ([string]$carteDefaut.InterfaceAlias) -Commentaire (& { if ($ad) { 'adresse ' + [string]$ad.IPAddress } else { 'adresse non lue' } }))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Reseau (resume)' -Controle 'Carte principale' -Etat 'PROBLEME' -Valeur 'aucune route par defaut' -Commentaire 'Rien ne sortira du sous-reseau local.')",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Reseau (resume)' -Controle 'Pour aller plus loin' -Etat 'INFO' -Valeur 'categorie Reseau' -Commentaire 'Diagnostic DNS, ports, routes, passerelle et Wi-Fi : les assistants de la categorie Reseau font ce travail.')",
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic complet du poste Windows',
      outil: 'workstation-health-report',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Jours', psB64(String(jours))],
        ['SeuilDisque', psB64(String(seuil))],
        ['Format', psB64(v.whFormat)],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-diagnostic',
      formats: v.whFormat,
    });
  },
  gui: [
    'Paramètres > Système > Informations système donne l’édition, la version et le build.',
    '« msinfo32 » ouvre Informations système : matériel, BIOS, pilotes, environnement.',
    'Observateur d’événements > Journaux Windows > Système et Application, filtrés sur Critique et Erreur.',
    'Gestionnaire de périphériques : un triangle jaune signale un périphérique en erreur.',
    'Services.msc, colonne Type de démarrage : repérer les « Automatique » qui ne sont pas « En cours d’exécution ».',
    'Sécurité Windows > Protection contre les virus et menaces pour l’état de Defender.',
  ],
  keywords: motsCles(
    'diagnostic poste', 'etat windows', 'rapport machine', 'inventaire poste',
    'version windows', 'build', 'bios', 'uefi', 'memoire', 'espace disque',
    'evenements critiques', 'services arretes', 'peripheriques en erreur',
    'demarrage rapide', 'hiberboot', 'redemarrage en attente', 'bilan de sante',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Sans élévation : l’identité, le matériel, les volumes et les services sont lus. Certains journaux et l’état de Defender peuvent être refusés.',
    'Avec élévation : le rapport est complet. Le script dit lui-même, dès la première section, dans quel cas il se trouve.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Get-MpComputerStatus ne renvoie rien',
      cause: 'Defender est remplacé par un autre antivirus, ou la console n’est pas élevée.',
      fix: 'Le rapport inscrit IGNORE plutôt que « non protégé » : l’absence de réponse n’est pas une preuve d’absence de protection. Relancer en administrateur pour trancher.',
    },
    {
      message: 'Beaucoup de services « Automatique » apparaissent arrêtés',
      cause: 'Plusieurs services Windows sont à démarrage différé et s’arrêtent normalement après leur travail.',
      fix: 'Le rapport les liste sans les condamner. Le diagnostic des services Windows, dans ce même lot, fait le tri avec les dépendances et les journaux.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport commence par dire sur quelle machine il a été pris, sous quelle édition, et si la console était élevée.',
    'Chaque volume porte son espace libre en pourcentage, comparé au seuil demandé.',
    'Aucune section ne prétend avoir réparé quoi que ce soit : ce script ne modifie rien.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit la configuration, les journaux et l’état des services. Il n’écrit que son rapport, et seulement si un format de fichier a été choisi.',
    diagnostic: '# Ce que le script a lu, en une ligne :\nGet-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,LastBootUpTime',
    command: '# Rien a annuler : aucune ecriture de configuration.\n# Le seul fichier produit est le rapport, sur le Bureau, et il se supprime a la main.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Le rapport contient le nom de la machine, le nom de session et la liste des logiciels de sécurité. Il se traite comme une information interne, même s’il ne contient aucun secret.',
  },
  checks: [
    'Aucune commande de modification : ni Set-, ni Remove-, ni Stop-, ni Restart-.',
    'L’état d’élévation est rapporté avant tout le reste, pour que les IGNORE s’expliquent.',
    'Le réseau n’est traité qu’en résumé, avec un renvoi explicite vers la catégorie Réseau.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/cimcmdlets/get-ciminstance',
  sources: [
    { label: 'Get-CimInstance', url: 'https://learn.microsoft.com/powershell/module/cimcmdlets/get-ciminstance' },
    { label: 'Get-WinEvent', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent' },
    { label: 'Get-HotFix', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-hotfix' },
    { label: 'Get-MpComputerStatus', url: 'https://learn.microsoft.com/powershell/module/defender/get-mpcomputerstatus' },
  ],
};

/**
 * 2. workstation-inventory — ce qu'il y a dans la machine, et ce qui y tourne.
 *
 * L'inventaire qu'on joint à un billet de support, ou qu'on garde avant de
 * reconstruire un poste. Il répond à « quelle version de quoi ? », qui est la
 * première question posée à chaque appel.
 *
 * Il n'affiche AUCUNE clé de produit. C'est délibéré, et le script le dit :
 * un inventaire circule par courriel, s'attache à un billet, et reste des
 * années dans un dossier partagé. Une clé de produit n'a rien à y faire.
 */
export const outilInventairePoste = {
  id: 'workstation-inventory',
  icon: '▦',
  category: 'Poste de travail Windows',
  subcategory: 'Diagnostic général',
  title: 'Inventaire matériel et logiciel du poste',
  risk: 'diagnostic',
  summary: 'Dresse l’inventaire du poste : matériel principal, applications installées, correctifs récents, pilotes qui signalent une erreur, et les versions utiles au support. N’affiche aucune clé de produit, aucun jeton, aucun secret.',
  fields: [
    {
      id: 'invPortee', label: 'Étendue de l’inventaire', type: 'select', default: 'Complet',
      options: [
        ['Complet', 'Complet — matériel, logiciels, correctifs et pilotes'],
        ['Materiel', 'Matériel seulement'],
        ['Logiciels', 'Logiciels et correctifs seulement'],
      ],
      help: 'L’inventaire complet prend une à deux minutes sur un poste chargé : la lecture des logiciels installés parcourt le registre.',
    },
    {
      id: 'invMaxLogiciels', label: 'Nombre maximum d’applications listées', default: '200',
      help: 'Entre 10 et 1000. Un poste de bureau en porte entre 60 et 300. Au-delà, le rapport devient illisible.',
    },
    champFormat('wiFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'invPortee', validerChoix(v.invPortee, ['Complet', 'Materiel', 'Logiciels'], 'L’étendue'));
    verifier(errors, 'invMaxLogiciels', validerEntier(v.invMaxLogiciels, 10, 1000, 'Le nombre maximum'));
    verifier(errors, 'wiFormat', validerFormatRapport(v.wiFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const portee = validerChoix(v.invPortee, ['Complet', 'Materiel', 'Logiciels']).value;
    const maxLog = validerEntier(v.invMaxLogiciels, 10, 1000).value;

    const corps = [
      `$Portee = ${psB64(portee)}`,
      `$MaxLogiciels = ${maxLog}`,
      `$KjemoFormat = ${psB64(v.wiFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- Ce que cet inventaire n\'affichera jamais ---------------------------------------',
      "# Pas de cle de produit, pas de jeton, pas de mot de passe. Un inventaire",
      "# circule par courriel, s'attache a un billet, et reste des annees dans un",
      '# dossier partage. Une cle de produit n\'a rien a y faire, et la lire',
      "# n'apporte rien au diagnostic.",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Secrets' -Etat 'INFO' -Valeur 'aucun' -Commentaire 'Aucune cle de produit, aucun jeton, aucun identifiant ne figure dans ce rapport. C''est volontaire.')",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Etendue demandee' -Etat 'INFO' -Valeur $Portee)",
      '',
      "if ($Portee -eq 'Complet' -or $Portee -eq 'Materiel') {",
      '  # --- 1. Materiel principal ----------------------------------------------------------',
      '  $cs = $null',
      "  try { $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue } catch { }",
      '  if ($cs) {',
      "    [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Modele' -Etat 'INFO' -Valeur ([string]$cs.Manufacturer + ' ' + [string]$cs.Model))",
      "    [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Type de chassis' -Etat 'INFO' -Valeur ([string]$cs.PCSystemType) -Commentaire '1 = poste fixe, 2 = portable, 3 = station de travail. Utile quand on ne voit pas la machine.')",
      '  }',
      '  $bios = $null',
      "  try { $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue } catch { }",
      '  if ($bios) {',
      "    [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Version BIOS/UEFI' -Etat 'INFO' -Valeur ([string]$bios.SMBIOSBIOSVersion) -Commentaire ('publie le ' + [string]$bios.ReleaseDate + '. Le numero de serie n''est pas affiche : il identifie la machine aupres du fabricant.'))",
      '  }',
      '  $cpu = $null',
      "  try { $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1 } catch { }",
      "  if ($cpu) { [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Processeur' -Etat 'INFO' -Valeur ([string]$cpu.Name) -Commentaire ([string]$cpu.NumberOfCores + ' coeur(s) · ' + [string]$cpu.MaxClockSpeed + ' MHz')) }",
      '',
      '  # Les barrettes memoire, une par une : c\'est ce qu\'on veut savoir avant',
      '  # d\'en commander une de plus.',
      '  $barrettes = @()',
      "  try { $barrettes = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue) } catch { }",
      '  if ($barrettes.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Barrettes memoire' -Etat 'IGNORE' -Valeur 'non lisibles' -Commentaire 'Win32_PhysicalMemory n''a pas repondu. Frequent sur une machine virtuelle.')",
      '  } else {',
      '    $totalGo = 0',
      '    foreach ($b in $barrettes) {',
      '      $go = 0',
      '      if ($b.Capacity) { $go = [Math]::Round($b.Capacity / 1GB, 1) }',
      '      $totalGo = $totalGo + $go',
      "      [void](Add-KjemoResultat -Categorie 'Materiel' -Controle ('Barrette ' + [string]$b.DeviceLocator) -Etat 'INFO' -Valeur ([string]$go + ' Go') -Commentaire ([string]$b.Speed + ' MHz · ' + [string]$b.Manufacturer))",
      '    }',
      "    [void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Memoire installee' -Etat 'INFO' -Valeur ([string]$totalGo + ' Go sur ' + [string]$barrettes.Count + ' barrette(s)'))",
      '  }',
      '',
      '  # Les disques physiques, avec leur type de media : un poste lent sur',
      "  # disque rotatif ne se repare pas de la meme facon qu'un poste lent sur SSD.",
      '  $disques = @()',
      "  try { $disques = @(Get-PhysicalDisk -ErrorAction SilentlyContinue) } catch { }",
      '  if ($disques.Count -eq 0) {',
      "    try { $disques = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue) } catch { }",
      '    foreach ($d in $disques) {',
      "      [void](Add-KjemoResultat -Categorie 'Materiel' -Controle ('Disque ' + [string]$d.Index) -Etat 'INFO' -Valeur ([string]$d.Model) -Commentaire ([string]([Math]::Round($d.Size / 1GB)) + ' Go'))",
      '    }',
      '  } else {',
      '    foreach ($d in $disques) {',
      "      $etatD = 'OK'",
      "      if ($d.HealthStatus -ne 'Healthy') { $etatD = 'PROBLEME' }",
      "      [void](Add-KjemoResultat -Categorie 'Materiel' -Controle ('Disque ' + [string]$d.FriendlyName) -Etat $etatD -Valeur ([string]$d.MediaType + ' · ' + [string]([Math]::Round($d.Size / 1GB)) + ' Go') -Commentaire ('sante : ' + [string]$d.HealthStatus + '. Un disque rotatif explique une lenteur que le SSD n''aurait pas.'))",
      '    }',
      '  }',
      '',
      '  # La carte graphique et son pilote : la premiere chose a verifier devant',
      '  # un ecran noir ou une resolution impossible a changer.',
      '  $gpus = @()',
      "  try { $gpus = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue) } catch { }",
      '  foreach ($g in $gpus) {',
      "    [void](Add-KjemoResultat -Categorie 'Materiel' -Controle ('Carte graphique — ' + [string]$g.Name) -Etat 'INFO' -Valeur ([string]$g.DriverVersion) -Commentaire ('pilote du ' + [string]$g.DriverDate))",
      '  }',
      '}',
      '',
      "if ($Portee -eq 'Complet' -or $Portee -eq 'Logiciels') {",
      '  # --- 2. Applications installees -------------------------------------------------------',
      "  # On lit le registre de desinstallation, PAS Win32_Product : cette classe",
      '  # WMI declenche une reconfiguration MSI de chaque produit a chaque',
      "  # interrogation, ce qui est lent et peut provoquer des reinstallations",
      '  # silencieuses. Microsoft le deconseille explicitement.',
      '  $cles = @(',
      "    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "    'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "    'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
      '  )',
      '  $apps = @()',
      '  foreach ($cle in $cles) {',
      '    try {',
      '      $trouvees = @(Get-ItemProperty -Path $cle -ErrorAction SilentlyContinue |',
      '        Where-Object { $_.DisplayName -and -not $_.SystemComponent })',
      '      $apps = $apps + $trouvees',
      '    } catch { }',
      '  }',
      '  $uniques = @($apps | Sort-Object DisplayName -Unique)',
      "  [void](Add-KjemoResultat -Categorie 'Logiciels' -Controle 'Applications detectees' -Etat 'INFO' -Valeur $uniques.Count -Commentaire 'Lues dans le registre de desinstallation. Win32_Product n''est pas utilise : cette classe WMI reconfigure chaque produit MSI a chaque appel.')",
      '  if ($uniques.Count -gt $MaxLogiciels) {',
      "    [void](Add-KjemoResultat -Categorie 'Logiciels' -Controle 'Liste tronquee' -Etat 'ATTENTION' -Valeur ([string]$MaxLogiciels + ' sur ' + [string]$uniques.Count) -Commentaire 'Augmenter le plafond dans le formulaire pour tout voir.')",
      '  }',
      '  foreach ($a in ($uniques | Select-Object -First $MaxLogiciels)) {',
      '    $editeur = \'\'',
      '    if ($a.Publisher) { $editeur = [string]$a.Publisher }',
      '    $version = \'\'',
      '    if ($a.DisplayVersion) { $version = [string]$a.DisplayVersion }',
      "    [void](Add-KjemoResultat -Categorie 'Logiciels' -Controle ([string]$a.DisplayName) -Etat 'INFO' -Valeur $version -Commentaire $editeur)",
      '  }',
      '',
      '  # --- 3. Correctifs installes ----------------------------------------------------------',
      '  $correctifs = @()',
      "  try { $correctifs = @(Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending) } catch { }",
      '  if ($correctifs.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Correctifs' -Controle 'Correctifs lus' -Etat 'ATTENTION' -Valeur 0 -Commentaire 'Get-HotFix ne liste que les correctifs de type QFE. Son silence n''est pas une preuve d''absence de mise a jour : les mises a jour cumulatives recentes n''y apparaissent pas toutes.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Correctifs' -Controle 'Correctifs lus' -Etat 'INFO' -Valeur $correctifs.Count)",
      '    foreach ($c in ($correctifs | Select-Object -First 20)) {',
      "      [void](Add-KjemoResultat -Categorie 'Correctifs' -Controle ([string]$c.HotFixID) -Etat 'INFO' -Valeur ([string]$c.InstalledOn) -Commentaire ([string]$c.Description))",
      '    }',
      '  }',
      '',
      '  # --- 4. Versions utiles au support ----------------------------------------------------',
      '  # Celles qu\'on demande systematiquement, et qu\'on cherche a chaque fois.',
      "  [void](Add-KjemoResultat -Categorie 'Versions' -Controle 'PowerShell' -Etat 'INFO' -Valeur ([string]$PSVersionTable.PSVersion) -Commentaire ('edition : ' + [string]$PSVersionTable.PSEdition))",
      '  $dotnet = $null',
      '  try {',
      "    $dotnet = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full' -Name 'Release' -ErrorAction SilentlyContinue",
      '  } catch { }',
      "  if ($dotnet) { [void](Add-KjemoResultat -Categorie 'Versions' -Controle '.NET Framework 4.x' -Etat 'INFO' -Valeur ([string]$dotnet.Release) -Commentaire 'Numero de version interne. La table de correspondance est sur Microsoft Learn.') }",
      '  if ($osInfo) {',
      "    [void](Add-KjemoResultat -Categorie 'Versions' -Controle 'Windows' -Etat 'INFO' -Valeur ([string]$osInfo.Caption) -Commentaire ('version ' + [string]$osInfo.Version + ' · build ' + [string]$osInfo.BuildNumber + ' · installe le ' + [string]$osInfo.InstallDate))",
      '  }',
      '}',
      '',
      "if ($Portee -eq 'Complet') {",
      '  # --- 5. Pilotes qui signalent une erreur ----------------------------------------------',
      '  # Seulement ceux en erreur : la liste complete des pilotes est ingerable,',
      "  # et l'assistant d'audit des pilotes la traite pour de bon.",
      '  $enErreur = @()',
      "  try { $enErreur = @(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.ConfigManagerErrorCode -ne 0 -and $_.ConfigManagerErrorCode -ne 22 }) } catch { }",
      '  if ($enErreur.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Pilotes' -Controle 'Peripheriques en erreur' -Etat 'OK' -Valeur 0 -Commentaire 'Les peripheriques volontairement desactives (code 22) ne sont pas comptes ici.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Pilotes' -Controle 'Peripheriques en erreur' -Etat 'PROBLEME' -Valeur $enErreur.Count -Commentaire 'L''assistant d''audit des pilotes donne le detail et la marche a suivre.')",
      '    foreach ($p in ($enErreur | Select-Object -First 15)) {',
      "      [void](Add-KjemoResultat -Categorie 'Pilotes' -Controle ([string]$p.Name) -Etat 'PROBLEME' -Valeur ('code ' + [string]$p.ConfigManagerErrorCode) -Commentaire ([string]$p.DeviceID))",
      '    }',
      '  }',
      '}',
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Inventaire materiel et logiciel du poste',
      outil: 'workstation-inventory',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Portee', psB64(portee)],
        ['MaxLogiciels', psB64(String(maxLog))],
        ['Format', psB64(v.wiFormat)],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-inventaire',
      formats: v.wiFormat,
    });
  },
  gui: [
    '« msinfo32 » ouvre Informations système : matériel, composants, environnement logiciel.',
    'Paramètres > Applications > Applications installées liste les logiciels, avec taille et date.',
    'Paramètres > Windows Update > Historique des mises à jour pour les correctifs.',
    'Gestionnaire de périphériques > Affichage > Périphériques par type : un triangle jaune marque une erreur.',
    '« dxdiag » donne la carte graphique, son pilote et sa date en une page.',
  ],
  keywords: motsCles(
    'inventaire', 'materiel', 'logiciels installes', 'applications',
    'correctifs', 'hotfix', 'version windows', 'version powershell',
    'carte graphique', 'barrettes memoire', 'disque ssd', 'modele machine',
    'support', 'parc', 'audit poste', 'pilotes en erreur',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire pour l’essentiel. Les applications installées pour d’autres utilisateurs ne seront pas vues depuis une session standard.',
    'L’inventaire complet parcourt trois branches du registre : compter une à deux minutes sur un poste chargé.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Une application que je sais installée n’apparaît pas',
      cause: 'Elle est installée pour un autre utilisateur (branche HKCU de cette session seulement), ou elle ne s’enregistre pas dans le registre de désinstallation — cas des applications portables et de certaines applications du Microsoft Store.',
      fix: 'Ouvrir une session sous le compte concerné, ou consulter Paramètres > Applications installées, qui lit aussi le catalogue du Store.',
    },
    {
      message: 'Win32_PhysicalMemory ne renvoie rien',
      cause: 'Machine virtuelle, ou firmware qui n’expose pas la table SMBIOS.',
      fix: 'Le rapport inscrit IGNORE. La mémoire totale reste lisible dans la section Matériel du diagnostic complet.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport annonce, dès la section Portée, qu’aucune clé de produit ni aucun secret n’y figure.',
    'Le nombre d’applications détectées est donné avant la liste, et la troncature est signalée quand elle a lieu.',
    'Aucune ligne n’utilise Win32_Product : le script le dit, et explique pourquoi.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit le registre, WMI et la liste des correctifs. Il n’écrit que son rapport, et seulement si un format de fichier a été choisi.',
    diagnostic: '# Les applications, lues comme le script les lit :\nGet-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object DisplayName | Select-Object DisplayName,DisplayVersion,Publisher',
    command: '# Rien a annuler : aucune ecriture de configuration.\n# Le rapport, s\'il a ete produit, se trouve sur le Bureau et se supprime a la main.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'L’inventaire décrit précisément une machine et ses logiciels. Il ne contient aucun secret, mais il se traite comme une information interne : il dit à un attaquant quoi cibler.',
  },
  checks: [
    'Aucune clé de produit, aucun numéro de série, aucun jeton dans le rapport.',
    'Win32_Product n’est jamais appelé : la lecture se fait dans le registre de désinstallation.',
    'Aucune commande de modification : la lecture seule est vérifiée par assertion sur le script généré.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-itemproperty',
  sources: [
    { label: 'Get-ItemProperty', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-itemproperty' },
    { label: 'Get-HotFix', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-hotfix' },
    { label: 'Get-PhysicalDisk', url: 'https://learn.microsoft.com/powershell/module/storage/get-physicaldisk' },
    { label: 'Win32_PnPEntity', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-pnpentity' },
  ],
};

// ===========================================================================
// B. PÉRIPHÉRIQUES
// ===========================================================================

/**
 * Bloc commun aux assistants de périphérique : l'état d'un service, lu sans
 * le toucher, avec la phrase qui explique ce que son arrêt provoque.
 */
function blocServicePeripherique(nom, role) {
  return [
    `# Service ${nom} — ${role}`,
    `$svc_${nom} = $null`,
    `try { $svc_${nom} = Get-Service -Name '${nom}' -ErrorAction SilentlyContinue } catch { }`,
    `if (-not $svc_${nom}) {`,
    `  [void](Add-KjemoResultat -Categorie 'Services' -Controle '${nom}' -Etat 'ATTENTION' -Valeur 'introuvable' -Commentaire 'Ce service n''existe pas sur cette edition de Windows, ou son nom a change.')`,
    '} else {',
    `  $etat_${nom} = 'OK'`,
    `  $note_${nom} = '${role}'`,
    `  if ($svc_${nom}.Status -ne 'Running') { $etat_${nom} = 'PROBLEME' ; $note_${nom} = '${role} Arrete : c''est une cause frequente et directe de la panne.' }`,
    `  if ($svc_${nom}.StartType -eq 'Disabled') { $etat_${nom} = 'PROBLEME' ; $note_${nom} = '${role} DESACTIVE : il ne redemarrera pas tout seul au prochain demarrage.' }`,
    `  [void](Add-KjemoResultat -Categorie 'Services' -Controle ([string]$svc_${nom}.DisplayName) -Etat $etat_${nom} -Valeur ([string]$svc_${nom}.Status) -Commentaire ('demarrage : ' + [string]$svc_${nom}.StartType + '. ' + $note_${nom}))`,
    '}',
  ].join('\n');
}

/**
 * Bloc commun : les périphériques d'une classe PnP donnée, avec leur code
 * d'erreur traduit.
 *
 * Le code 22 mérite d'être traité à part : un périphérique désactivé n'est pas
 * un périphérique en panne, c'est une décision. Les confondre envoie chercher
 * un pilote là où il suffit de réactiver.
 */
function blocPnpParClasse(classes, categorie) {
  const liste = classes.map((c) => `'${c}'`).join(', ');
  return [
    `$classesPnp = @(${liste})`,
    '$peripheriques = @()',
    'try {',
    '  $peripheriques = @(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue |',
    '    Where-Object { $classesPnp -contains $_.PNPClass })',
    '} catch { }',
    'if ($peripheriques.Count -eq 0) {',
    `  [void](Add-KjemoResultat -Categorie '${categorie}' -Controle 'Peripheriques detectes' -Etat 'PROBLEME' -Valeur 0 -Commentaire 'Aucun peripherique de cette classe n''est declare. Le materiel est absent, debranche, ou son pilote n''est pas installe du tout.')`,
    '} else {',
    `  [void](Add-KjemoResultat -Categorie '${categorie}' -Controle 'Peripheriques detectes' -Etat 'OK' -Valeur $peripheriques.Count)`,
    '  foreach ($p in $peripheriques) {',
    '    $code = 0',
    '    try { $code = [int]$p.ConfigManagerErrorCode } catch { }',
    "    $etatP = 'OK'",
    "    $noteP = 'Le peripherique fonctionne selon Windows.'",
    "    if ($code -eq 22) { $etatP = 'ATTENTION' ; $noteP = 'Code 22 : DESACTIVE volontairement. Ce n''est pas une panne. Gestionnaire de peripheriques > clic droit > Activer.' }",
    "    elseif ($code -eq 28) { $etatP = 'PROBLEME' ; $noteP = 'Code 28 : aucun pilote installe. Windows Update ou le site du FABRICANT de la machine, jamais un site de pilotes tiers.' }",
    "    elseif ($code -eq 43) { $etatP = 'PROBLEME' ; $noteP = 'Code 43 : Windows a arrete le peripherique parce qu''il a signale un probleme. Souvent materiel, parfois pilote.' }",
    "    elseif ($code -eq 10) { $etatP = 'PROBLEME' ; $noteP = 'Code 10 : le peripherique ne peut pas demarrer. Pilote inadapte, ressource en conflit, ou materiel defaillant.' }",
    "    elseif ($code -ne 0) { $etatP = 'PROBLEME' ; $noteP = 'Code ' + [string]$code + ' : voir la table des codes du Gestionnaire de peripheriques.' }",
    `    [void](Add-KjemoResultat -Categorie '${categorie}' -Controle ([string]$p.Name) -Etat $etatP -Valeur ('code ' + [string]$code) -Commentaire ($noteP + ' · ' + [string]$p.Status))`,
    '  }',
    '}',
  ].join('\n');
}

/**
 * Bloc commun : les autorisations de confidentialité d'une catégorie
 * (microphone, caméra), LUES et expliquées, jamais modifiées.
 *
 * Ces réglages vivent dans le registre, et il serait techniquement facile de
 * les écrire. On ne le fait pas : une autorisation d'accès au microphone ou à
 * la caméra est une décision de la personne, pas un paramètre à corriger au
 * passage par un script de dépannage. Le script montre l'état et indique la
 * page de Paramètres où le changer.
 */
function blocConfidentialite(cle, libelle, pageReglages) {
  return [
    `# --- Autorisations de confidentialite : ${libelle} ---------------------------------`,
    "# LUES, jamais ecrites. Une autorisation d'acces au microphone ou a la camera",
    "# est une decision de la personne, pas un parametre qu'un script de depannage",
    '# corrige au passage. Le script montre, et dit ou changer.',
    `$cheminConf = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\${cle}'`,
    '$conf = $null',
    'try { $conf = Get-ItemProperty -Path $cheminConf -ErrorAction SilentlyContinue } catch { }',
    'if (-not $conf) {',
    `  [void](Add-KjemoResultat -Categorie 'Confidentialite' -Controle '${libelle} — acces global' -Etat 'IGNORE' -Valeur 'non lisible' -Commentaire 'La cle de consentement n''existe pas pour cette session. Verifier dans ${pageReglages}.')`,
    '} else {',
    "  $valeur = [string]$conf.Value",
    `  $etatC = 'OK'`,
    `  $noteC = 'L''acces est autorise pour les applications de bureau.'`,
    `  if ($valeur -ne 'Allow') { $etatC = 'PROBLEME' ; $noteC = 'L''acces est refuse. C''est la cause la plus frequente d''un peripherique « qui ne marche que dans une application ». A changer dans ${pageReglages} — ce script ne le fait pas.' }`,
    `  [void](Add-KjemoResultat -Categorie 'Confidentialite' -Controle '${libelle} — acces global' -Etat $etatC -Valeur $valeur -Commentaire $noteC)`,
    '}',
    '# Le reglage par application : il explique « ca marche dans Teams mais pas',
    '# dans le navigateur ».',
    '$parApp = @()',
    "try { $parApp = @(Get-ChildItem -Path ($cheminConf + '\\NonPackaged') -ErrorAction SilentlyContinue | Select-Object -First 15) } catch { }",
    'foreach ($app in $parApp) {',
    '  $vApp = $null',
    "  try { $vApp = (Get-ItemProperty -Path $app.PSPath -Name 'Value' -ErrorAction SilentlyContinue).Value } catch { }",
    '  if ($vApp) {',
    `    $etatA = 'OK'`,
    `    if ($vApp -ne 'Allow') { $etatA = 'ATTENTION' }`,
    `    [void](Add-KjemoResultat -Categorie 'Confidentialite' -Controle ('${libelle} — ' + [string]$app.PSChildName) -Etat $etatA -Valeur [string]$vApp)`,
    '  }',
    '}',
  ].join('\n');
}

/**
 * 3. audio-diagnostic — « je n'ai plus de son ».
 *
 * L'appel le plus fréquent après le réseau, et celui où l'on part le plus
 * souvent sur la mauvaise piste : on réinstalle un pilote alors que c'est le
 * périphérique par défaut qui a changé, ou que le service audio est arrêté.
 *
 * Le script regarde dans l'ordre où il faut regarder, et la réparation —
 * redémarrer les deux services audio — n'a lieu qu'après confirmation écrite.
 */
export const outilDiagnosticAudio = {
  id: 'audio-diagnostic',
  icon: '◉',
  category: 'Poste de travail Windows',
  subcategory: 'Périphériques',
  title: 'Diagnostiquer le son du poste',
  risk: 'caution',
  summary: 'Examine dans l’ordre : périphériques de lecture, périphérique par défaut, services audio, pilotes en erreur et événements récents. En mode Appliquer, redémarre les deux services audio — et seulement eux — après confirmation écrite. Ne touche à aucun pilote.',
  fields: [
    {
      id: 'audJours', label: 'Fenêtre des événements (jours)', default: '7',
      help: 'Entre 1 et 90. Les événements du service audio disent si le son est tombé après une mise à jour.',
    },
    {
      id: 'audConfirmation', label: 'Confirmation pour redémarrer les services audio (facultatif)', default: '',
      help: 'Obligatoire uniquement en mode Appliquer. Retaper exactement : JE REDEMARRE LE SERVICE AUDIO',
    },
    champMode('Diagnostic examine et n’écrit rien. Appliquer redémarre les deux services audio, après confirmation.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'audJours', validerEntier(v.audJours, 1, 90, 'La fenêtre'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    const confirmation = String(v.audConfirmation ?? '').trim();
    if (String(v.mode ?? '') === 'Appliquer' && confirmation !== 'JE REDEMARRE LE SERVICE AUDIO') {
      errors.audConfirmation = 'Redémarrer le service audio coupe le son de toutes les applications en cours. Pour le faire, retaper exactement : JE REDEMARRE LE SERVICE AUDIO';
    }
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.audJours, 1, 90).value;
    const confirme = String(v.audConfirmation ?? '').trim() === 'JE REDEMARRE LE SERVICE AUDIO';

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Jours = ${jours}`,
      `$ConfirmationOk = ${confirme ? '$true' : '$false'}`,
      "$KjemoFormat = 'Console'",
      '',
      blocContextePoste(),
      '',
      '# --- 1. Les peripheriques de lecture --------------------------------------------------',
      blocPnpParClasse(['AudioEndpoint', 'MEDIA'], 'Audio'),
      '',
      '# --- 2. Le peripherique par defaut ----------------------------------------------------',
      "# C'est la premiere cause, et la plus betement frequente : le son sort",
      "# ailleurs. Un casque debranche, un ecran HDMI allume, une station d'accueil",
      '# reconnectee, et Windows bascule la sortie sans rien dire.',
      '$rendus = @()',
      'try {',
      '  $rendus = @(Get-CimInstance -ClassName Win32_SoundDevice -ErrorAction SilentlyContinue)',
      '} catch { }',
      'if ($rendus.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Sortie' -Controle 'Cartes son declarees' -Etat 'PROBLEME' -Valeur 0 -Commentaire 'Aucune carte son. Le materiel est absent ou son pilote n''est pas installe.')",
      '} else {',
      '  foreach ($r in $rendus) {',
      "    $etatR = 'OK'",
      "    if ($r.Status -ne 'OK') { $etatR = 'PROBLEME' }",
      "    [void](Add-KjemoResultat -Categorie 'Sortie' -Controle ([string]$r.Name) -Etat $etatR -Valeur ([string]$r.Status) -Commentaire ('fabricant : ' + [string]$r.Manufacturer))",
      '  }',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Sortie' -Controle 'Peripherique par defaut' -Etat 'INFO' -Valeur 'a verifier a l''ecran' -Commentaire 'Windows n''expose pas le peripherique de sortie par defaut en PowerShell sans composant tiers. Parametres > Systeme > Son > Sortie le montre en une seconde, et c''est la premiere chose a regarder.')",
      '',
      '# --- 3. Les services audio ------------------------------------------------------------',
      blocServicePeripherique('Audiosrv', 'Service audio Windows : sans lui, aucun son nulle part.'),
      blocServicePeripherique('AudioEndpointBuilder', 'Construit la liste des peripheriques audio : sans lui, la liste est vide.'),
      '',
      '# --- 4. Les evenements recents --------------------------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1,2,3; StartTime = $depuis } -ErrorAction SilentlyContinue |",
      "    Where-Object { $_.ProviderName -like '*Audio*' -or $_.Message -like '*audio*' } | Select-Object -First 20)",
      '} catch { }',
      'if ($evts.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements audio sur ' + [string]$Jours + ' jour(s)') -Etat 'OK' -Valeur 0)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements audio sur ' + [string]$Jours + ' jour(s)') -Etat 'ATTENTION' -Valeur $evts.Count)",
      '  foreach ($e in ($evts | Select-Object -First 8)) {',
      '    $ligne = \'\'',
      '    try { $ligne = ([string]$e.Message).Split("`n")[0] } catch { }',
      "    [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ([string]$e.TimeCreated) -Etat 'INFO' -Valeur ('ID ' + [string]$e.Id) -Commentaire ([string]$e.ProviderName + ' · ' + $ligne))",
      '  }',
      '}',
      '',
      '# --- 5. Le verrou, puis l\'action ------------------------------------------------------',
      "# Trois conditions, toutes necessaires : console elevee, confirmation ecrite,",
      '# et les deux services presents. A defaut, rien n\'est redemarre et le script',
      '# dit lequel manque.',
      '$servicesPresents = ($null -ne $svc_Audiosrv) -and ($null -ne $svc_AudioEndpointBuilder)',
      '$conditionsAppliquer = $KjemoEleve -and $ConfirmationOk -and $servicesPresents',
      "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {",
      '  $manquants = @()',
      "  if (-not $KjemoEleve) { $manquants += 'console non elevee : le redemarrage d''un service exige une console administrateur' }",
      "  if (-not $ConfirmationOk) { $manquants += 'confirmation ecrite absente' }",
      "  if (-not $servicesPresents) { $manquants += 'un des deux services audio est introuvable' }",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Conditions prealables' -Etat 'PROBLEME' -Valeur ($manquants -join ' ; ') -Commentaire 'Le mode Appliquer exige les trois conditions a la fois.')",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Redemarrage des services' -Etat 'IGNORE' -Valeur 'bloque' -Commentaire 'Aucun service n''a ete arrete ni demarre. L''etat du poste est exactement celui d''avant.')",
      "  Write-Host ''",
      "  Write-Host '--- Redemarrage BLOQUE ---'",
      '  foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "} elseif ($Mode -eq 'Appliquer') {",
      "  Write-Host ''",
      "  Write-Host '--- Redemarrage des services audio ---'",
      "  Write-Host 'Le son va se couper quelques secondes dans toutes les applications.'",
      "  # On note l'etat AVANT, pour pouvoir le comparer apres.",
      '  $avant = @{}',
      "  foreach ($n in @('AudioEndpointBuilder', 'Audiosrv')) {",
      '    try { $avant[$n] = (Get-Service -Name $n -ErrorAction SilentlyContinue).Status } catch { }',
      '  }',
      "  # AudioEndpointBuilder d'abord : Audiosrv en depend.",
      "  foreach ($n in @('AudioEndpointBuilder', 'Audiosrv')) {",
      '    try {',
      '      Restart-Service -Name $n -ErrorAction Stop',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Redemarrage ' + $n) -Etat 'OK' -Valeur 'effectue')",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Redemarrage ' + $n) -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message) -Commentaire 'Le service n''a pas redemarre. L''etat precedent est rapporte ci-dessous.')",
      '    }',
      '  }',
      '  # Relecture : on ne croit pas la commande sur parole.',
      "  foreach ($n in @('AudioEndpointBuilder', 'Audiosrv')) {",
      '    $apres = $null',
      '    try { $apres = (Get-Service -Name $n -ErrorAction SilentlyContinue).Status } catch { }',
      "    $etatV = 'PROBLEME'",
      "    if ([string]$apres -eq 'Running') { $etatV = 'OK' }",
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle ($n + ' apres action') -Etat $etatV -Valeur ([string]$apres) -Commentaire ('avant : ' + [string]$avant[$n]))",
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      '  if ($conditionsAppliquer) {',
      "    Write-Host 'Les trois conditions sont reunies. En mode Appliquer, le script'",
      "    Write-Host 'redemarrerait AudioEndpointBuilder puis Audiosrv, dans cet ordre,'",
      "    Write-Host 'et relirait leur etat.'",
      '  } else {',
      "    Write-Host 'En mode Appliquer, le script SERAIT BLOQUE et ne redemarrerait rien.'",
      "    if (-not $KjemoEleve) { Write-Host '  - console non elevee' }",
      "    if (-not $ConfirmationOk) { Write-Host '  - confirmation ecrite absente' }",
      "    if (-not $servicesPresents) { Write-Host '  - un des deux services audio est introuvable' }",
      '  }',
      '}',
      '',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Pilotes' -Etat 'INFO' -Valeur 'non modifies' -Commentaire 'Cet assistant ne reinstalle, ne met a jour et ne telecharge aucun pilote audio. L''audit des pilotes dit ce qu''il faut savoir ; l''installation se fait par Windows Update ou par le site du fabricant de la machine.')",
      blocModeDiagnostic(),
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic du son du poste',
      outil: 'audio-diagnostic',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Mode', psB64(v.mode)],
        ['Jours', psB64(String(jours))],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-audio',
      formats: 'Console',
    });
  },
  gui: [
    'Paramètres > Système > Son > Sortie : le périphérique par défaut s’y change en un clic. À regarder en premier.',
    'Clic droit sur l’icône du volume > Résoudre les problèmes de son lance l’utilitaire Microsoft.',
    'services.msc : « Audio Windows » (Audiosrv) et « Générateur de points de terminaison du service Audio Windows ».',
    'Gestionnaire de périphériques > Contrôleurs audio, vidéo et jeu : un triangle jaune signale un pilote en erreur.',
    'Panneau de configuration > Son > onglet Lecture : les périphériques désactivés n’y apparaissent qu’avec « Afficher les périphériques désactivés ».',
  ],
  keywords: motsCles(
    'pas de son', 'audio', 'haut-parleur', 'casque', 'sortie audio',
    'audiosrv', 'audioendpointbuilder', 'peripherique par defaut',
    'son coupe', 'carte son', 'hdmi son', 'service audio',
  ),
  requiresAdmin: true,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Le diagnostic complet se lit sans élévation.',
    'Le mode Appliquer exige une console administrateur : redémarrer un service n’est pas permis autrement. Le script le vérifie lui-même et bloque proprement.',
    'Prévenir la personne : le son se coupe quelques secondes dans toutes les applications pendant le redémarrage des services.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Le son est revenu après avoir rebranché le casque, sans rien changer',
      cause: 'Le périphérique de sortie par défaut avait basculé sur un autre point de terminaison — écran HDMI, station d’accueil, casque Bluetooth.',
      fix: 'C’est la cause la plus fréquente. Paramètres > Système > Son > Sortie, et choisir le bon périphérique. Aucun pilote n’est en cause.',
    },
    {
      message: 'Audiosrv refuse de démarrer, erreur 1079',
      cause: 'Le compte de connexion du service a été modifié et ne correspond plus à celui des services dont il dépend.',
      fix: 'services.msc > Audio Windows > Connexion : remettre « Service local ». Ce script ne modifie aucun compte de service.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les deux services audio sont « En cours d’exécution » après l’action, et le rapport compare l’état avant et après.',
    'Le son revient dans une application fermée puis rouverte — certaines ne reprennent pas le point de terminaison à chaud.',
    'En cas de blocage, le rapport nomme la condition manquante et porte IGNORE pour l’action.',
  ],
  rollback: {
    summary: 'La seule action possible est le redémarrage de deux services, qui les laisse dans l’état « démarré » — leur état normal. Il n’y a pas de configuration à restaurer : aucun type de démarrage, aucun compte de service, aucun pilote n’est modifié.',
    diagnostic: '# L\'etat des deux services audio :\nGet-Service Audiosrv,AudioEndpointBuilder | Select-Object Name,Status,StartType',
    command: '# Si un service est reste arrete apres l\'action :\nStart-Service -Name AudioEndpointBuilder\nStart-Service -Name Audiosrv',
    warning: 'Le redémarrage coupe le son de toutes les applications en cours. En réunion ou en appel, le faire après, pas pendant.',
  },
  checks: [
    'Aucun pilote n’est téléchargé, installé ni désinstallé.',
    'Aucune autorisation de confidentialité n’est modifiée.',
    'Le mode Appliquer exige console élevée, confirmation écrite et services présents : à défaut, zéro appel à Restart-Service.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/restart-service',
  sources: [
    { label: 'Restart-Service', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/restart-service' },
    { label: 'Get-Service', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-service' },
    { label: 'Win32_SoundDevice', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-sounddevice' },
    { label: 'Win32_PnPEntity', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-pnpentity' },
  ],
};

/**
 * 4. microphone-diagnostic — « on ne m'entend pas ».
 *
 * Deux fois sur trois, ce n'est pas le matériel : c'est une autorisation de
 * confidentialité refusée, ou une application qui a gardé le microphone. Le
 * script regarde dans cet ordre, et il LIT les autorisations sans jamais les
 * écrire : accorder l'accès au microphone est une décision de la personne.
 */
export const outilDiagnosticMicrophone = {
  id: 'microphone-diagnostic',
  icon: '◎',
  category: 'Poste de travail Windows',
  subcategory: 'Périphériques',
  title: 'Diagnostiquer le microphone',
  risk: 'diagnostic',
  summary: 'Vérifie la présence du microphone, l’état de son pilote, les services audio et surtout les autorisations de confidentialité — cause la plus fréquente d’un micro muet. Les autorisations sont LUES et expliquées, jamais modifiées.',
  fields: [
    {
      id: 'micJours', label: 'Fenêtre des événements (jours)', default: '7',
      help: 'Entre 1 et 90.',
    },
    champFormat('micFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'micJours', validerEntier(v.micJours, 1, 90, 'La fenêtre'));
    verifier(errors, 'micFormat', validerFormatRapport(v.micFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.micJours, 1, 90).value;

    const corps = [
      `$Jours = ${jours}`,
      `$KjemoFormat = ${psB64(v.micFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- 1. Le microphone est-il la ? -----------------------------------------------------',
      blocPnpParClasse(['AudioEndpoint', 'MEDIA'], 'Microphone'),
      '',
      '# --- 2. Les services audio ------------------------------------------------------------',
      '# Le microphone depend des memes services que les haut-parleurs.',
      blocServicePeripherique('Audiosrv', 'Service audio Windows : sans lui, ni entree ni sortie.'),
      blocServicePeripherique('AudioEndpointBuilder', 'Construit la liste des peripheriques, microphones compris.'),
      '',
      blocConfidentialite('microphone', 'Microphone', 'Parametres > Confidentialite et securite > Microphone'),
      '',
      '# --- 4. Qui pourrait tenir le microphone ? --------------------------------------------',
      "# Windows ne dit pas simplement « telle application utilise le micro ». On",
      '# liste donc les processus connus pour le prendre, sans rien en conclure :',
      "# c'est une piste, pas un verdict.",
      "$suspects = @('Teams', 'ms-teams', 'Zoom', 'Discord', 'Skype', 'slack', 'chrome', 'msedge', 'firefox', 'obs64')",
      '$trouves = @()',
      'foreach ($nom in $suspects) {',
      '  $p = $null',
      '  try { $p = @(Get-Process -Name $nom -ErrorAction SilentlyContinue) } catch { }',
      '  if ($p -and $p.Count -gt 0) { $trouves += ($nom + ' + "' (' + [string]$p.Count + ')')" + ' }',
      '}',
      'if ($trouves.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Applications' -Controle 'Applications susceptibles d''utiliser le micro' -Etat 'OK' -Valeur 'aucune en cours' -Commentaire 'Aucune des applications courantes de visioconference ou de navigation n''est ouverte.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Applications' -Controle 'Applications susceptibles d''utiliser le micro' -Etat 'INFO' -Valeur ($trouves -join ', ') -Commentaire 'Piste, pas verdict : une application qui garde le micro empeche les autres de l''ouvrir. Fermer celles qui ne servent pas, puis reessayer.')",
      '}',
      '',
      '# --- 5. Les evenements recents --------------------------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1,2,3; StartTime = $depuis } -ErrorAction SilentlyContinue |",
      "    Where-Object { $_.ProviderName -like '*Audio*' } | Select-Object -First 15)",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements audio sur ' + [string]$Jours + ' jour(s)') -Etat (& { if ($evts.Count -eq 0) { 'OK' } else { 'ATTENTION' } }) -Valeur $evts.Count)",
      'foreach ($e in ($evts | Select-Object -First 6)) {',
      '  $ligne = \'\'',
      '  try { $ligne = ([string]$e.Message).Split("`n")[0] } catch { }',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ([string]$e.TimeCreated) -Etat 'INFO' -Valeur ('ID ' + [string]$e.Id) -Commentaire $ligne)",
      '}',
      '',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Ce que ce script ne fait pas' -Etat 'INFO' -Valeur 'aucune ecriture' -Commentaire 'Il n''accorde aucune autorisation, ne modifie aucun reglage de confidentialite, n''enregistre aucun son et ne ferme aucune application.')",
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic du microphone',
      outil: 'microphone-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Jours', psB64(String(jours))],
        ['Format', psB64(v.micFormat)],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-microphone',
      formats: v.micFormat,
    });
  },
  gui: [
    'Paramètres > Confidentialité et sécurité > Microphone : l’accès global, puis l’accès par application. À regarder en premier.',
    'Paramètres > Système > Son > Entrée : choisir le bon microphone et parler pour voir la barre de volume bouger.',
    'Panneau de configuration > Son > Enregistrement : les micros désactivés n’apparaissent qu’avec « Afficher les périphériques désactivés ».',
    'Gestionnaire de périphériques > Entrées et sorties audio : un triangle jaune signale un pilote en erreur.',
    'Dans Teams ou Zoom, les paramètres de périphérique de l’application priment sur ceux de Windows : vérifier aussi là.',
  ],
  keywords: motsCles(
    'microphone', 'micro', 'on ne m entend pas', 'micro muet',
    'confidentialite microphone', 'autorisation micro', 'entree audio',
    'teams micro', 'zoom micro', 'enregistrement', 'capture audio',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire : tout ce que lit ce script est accessible à la session courante.',
    'Les autorisations de confidentialité sont propres à la SESSION : lancer le script sous le compte qui a le problème, pas sous un compte d’administration.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Le micro fonctionne dans Teams mais pas dans le navigateur',
      cause: 'L’autorisation de confidentialité est accordée par application. Le navigateur a son propre réglage, en plus de celui de Windows.',
      fix: 'Paramètres > Confidentialité et sécurité > Microphone, puis la section « Autoriser les applications de bureau ». Et dans le navigateur, l’autorisation du site.',
    },
    {
      message: 'La clé de consentement n’existe pas pour cette session',
      cause: 'Le script tourne sous un compte différent de celui qui a le problème, ou l’autorisation n’a jamais été demandée sur ce poste.',
      fix: 'Relancer sous le compte concerné. Le rapport inscrit IGNORE plutôt que de conclure.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'L’accès global au microphone est rapporté avec sa valeur exacte, et un refus est signalé comme PROBLÈME.',
    'Les deux services audio apparaissent avec leur état et leur type de démarrage.',
    'Aucune section ne prétend avoir modifié une autorisation.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit le registre de consentement, l’état des services et les journaux. Il n’accorde ni ne retire aucune autorisation.',
    diagnostic: '# L\'autorisation globale du microphone, pour cette session :\nGet-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone" | Select-Object Value',
    command: '# Rien a annuler : aucune ecriture.\n# Une autorisation se change dans Parametres > Confidentialite et securite > Microphone,\n# par la personne, pas par un script.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Une autorisation d’accès au microphone est une décision personnelle. Ce projet ne l’écrit jamais par script, même quand c’est techniquement possible.',
  },
  checks: [
    'Les autorisations de confidentialité sont lues, jamais écrites.',
    'Aucun son n’est enregistré, aucune capture n’est faite.',
    'Aucune application n’est fermée : la liste des processus est une piste, pas une action.',
  ],
  source: 'https://learn.microsoft.com/windows/privacy/manage-windows-11-endpoints',
  sources: [
    { label: 'Get-ItemProperty', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-itemproperty' },
    { label: 'Get-Service', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-service' },
    { label: 'Win32_PnPEntity', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-pnpentity' },
  ],
};

/**
 * 5. webcam-diagnostic — « ma caméra ne marche pas ».
 *
 * Même logique que le microphone, avec une règle de plus, et elle n'est pas
 * négociable : ce script ne capture JAMAIS d'image. Il n'ouvre pas la caméra,
 * ne prend pas de photo « pour tester », n'allume rien. Un diagnostic qui
 * allume discrètement une caméra est une caméra allumée discrètement.
 */
export const outilDiagnosticWebcam = {
  id: 'webcam-diagnostic',
  icon: '▷',
  category: 'Poste de travail Windows',
  subcategory: 'Périphériques',
  title: 'Diagnostiquer la webcam',
  risk: 'diagnostic',
  summary: 'Vérifie la présence de la caméra, les erreurs PnP, le pilote, le service de capture et les autorisations de confidentialité, puis liste les applications susceptibles de la tenir. Ne capture AUCUNE image et n’ouvre jamais la caméra.',
  fields: [
    {
      id: 'camJours', label: 'Fenêtre des événements (jours)', default: '7',
      help: 'Entre 1 et 90.',
    },
    champFormat('camFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'camJours', validerEntier(v.camJours, 1, 90, 'La fenêtre'));
    verifier(errors, 'camFormat', validerFormatRapport(v.camFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.camJours, 1, 90).value;

    const corps = [
      `$Jours = ${jours}`,
      `$KjemoFormat = ${psB64(v.camFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- Ce que ce script ne fera jamais --------------------------------------------------',
      "# Il ne capture AUCUNE image. Il n'ouvre pas la camera, ne prend pas de photo",
      "# « pour tester », n'allume aucun voyant. Un diagnostic qui allume",
      '# discretement une camera est une camera allumee discretement, et cela ne se',
      '# fait pas. Pour verifier une image, ouvrir l\'application Camera de Windows,',
      '# devant la personne.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Capture d''image' -Etat 'INFO' -Valeur 'aucune' -Commentaire 'Ce script n''ouvre jamais la camera. Pour voir une image, utiliser l''application Camera de Windows, devant la personne.')",
      '',
      '# --- 1. La camera est-elle declaree ? -------------------------------------------------',
      blocPnpParClasse(['Camera', 'Image'], 'Camera'),
      '',
      '# --- 2. Le service de capture ---------------------------------------------------------',
      blocServicePeripherique('FrameServer', "Service de capture d''images Windows : il partage la camera entre applications."),
      '',
      blocConfidentialite('webcam', 'Camera', 'Parametres > Confidentialite et securite > Camera'),
      '',
      '# --- 4. Qui pourrait tenir la camera ? ------------------------------------------------',
      "# Une camera ne se partage pas toujours : une application qui la tient",
      "# empeche les autres de l'ouvrir, et le symptome est « ecran noir ».",
      "$suspects = @('Teams', 'ms-teams', 'Zoom', 'Discord', 'Skype', 'chrome', 'msedge', 'firefox', 'obs64', 'WindowsCamera')",
      '$trouves = @()',
      'foreach ($nom in $suspects) {',
      '  $p = $null',
      '  try { $p = @(Get-Process -Name $nom -ErrorAction SilentlyContinue) } catch { }',
      '  if ($p -and $p.Count -gt 0) { $trouves += ($nom + ' + "' (' + [string]$p.Count + ')')" + ' }',
      '}',
      'if ($trouves.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Applications' -Controle 'Applications susceptibles de tenir la camera' -Etat 'OK' -Valeur 'aucune en cours')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Applications' -Controle 'Applications susceptibles de tenir la camera' -Etat 'INFO' -Valeur ($trouves -join ', ') -Commentaire 'Une camera ne se partage pas toujours. Si l''image est noire, fermer ces applications une a une et reessayer. Ce script n''en ferme aucune.')",
      '}',
      '',
      '# --- 5. L\'obturateur physique ---------------------------------------------------------',
      "# Il n'est pas detectable en logiciel, et c'est pourtant une cause reelle,",
      '# frequente sur les portables professionnels.',
      "[void](Add-KjemoResultat -Categorie 'Materiel' -Controle 'Obturateur ou interrupteur physique' -Etat 'INFO' -Valeur 'non detectable en logiciel' -Commentaire 'Beaucoup de portables ont un cache coulissant ou une touche de fonction qui coupe la camera. Windows voit alors une camera presente qui ne donne qu''une image noire. A verifier a l''oeil avant de chercher plus loin.')",
      '',
      '# --- 6. Les evenements recents --------------------------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1,2,3; StartTime = $depuis } -ErrorAction SilentlyContinue |",
      "    Where-Object { $_.ProviderName -like '*Camera*' -or $_.ProviderName -like '*FrameServer*' } | Select-Object -First 15)",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements camera sur ' + [string]$Jours + ' jour(s)') -Etat (& { if ($evts.Count -eq 0) { 'OK' } else { 'ATTENTION' } }) -Valeur $evts.Count)",
      'foreach ($e in ($evts | Select-Object -First 6)) {',
      '  $ligne = \'\'',
      '  try { $ligne = ([string]$e.Message).Split("`n")[0] } catch { }',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ([string]$e.TimeCreated) -Etat 'INFO' -Valeur ('ID ' + [string]$e.Id) -Commentaire $ligne)",
      '}',
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic de la webcam',
      outil: 'webcam-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Jours', psB64(String(jours))],
        ['Format', psB64(v.camFormat)],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-webcam',
      formats: v.camFormat,
    });
  },
  gui: [
    'Vérifier d’abord l’obturateur physique ou la touche de fonction qui coupe la caméra : cause fréquente sur portable.',
    'Paramètres > Confidentialité et sécurité > Caméra : accès global, puis accès par application.',
    'Ouvrir l’application Caméra de Windows pour voir une image — devant la personne, jamais à son insu.',
    'Gestionnaire de périphériques > Caméras : un triangle jaune signale un pilote en erreur.',
    'Dans Teams ou Zoom, le choix du périphérique dans l’application prime sur celui de Windows.',
  ],
  keywords: motsCles(
    'webcam', 'camera', 'image noire', 'visio', 'frameserver',
    'confidentialite camera', 'autorisation camera', 'obturateur',
    'teams camera', 'zoom camera', 'pas d image',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire.',
    'Les autorisations de confidentialité sont propres à la SESSION : lancer le script sous le compte qui a le problème.',
    'Pour vérifier une image, le faire devant la personne, avec l’application Caméra. Le script ne le fait pas à sa place.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Windows voit la caméra, mais l’image reste noire',
      cause: 'Obturateur physique fermé, touche de fonction qui coupe la caméra, ou une autre application qui la tient déjà.',
      fix: 'Dans cet ordre : l’obturateur, la touche de fonction, puis fermer les applications listées dans le rapport. Le pilote vient en dernier, pas en premier.',
    },
    {
      message: 'La caméra disparaît du Gestionnaire de périphériques par intermittence',
      cause: 'Alimentation USB instable, ou gestion d’énergie qui suspend le contrôleur USB.',
      fix: 'Gestionnaire de périphériques > contrôleur USB > Gestion de l’alimentation : décocher la suspension. Ce script ne modifie aucun réglage d’alimentation.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport annonce, avant tout le reste, qu’aucune image n’est capturée.',
    'L’accès global à la caméra est rapporté avec sa valeur exacte.',
    'L’obturateur physique est rappelé comme cause non détectable en logiciel.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit le registre de consentement, l’état du service de capture et les journaux. Il n’ouvre jamais la caméra.',
    diagnostic: '# L\'autorisation globale de la camera, pour cette session :\nGet-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam" | Select-Object Value',
    command: '# Rien a annuler : aucune ecriture, aucune capture.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Une autorisation d’accès à la caméra est une décision personnelle. Ce projet ne l’écrit jamais par script, et n’ouvre jamais la caméra pour « tester ».',
  },
  checks: [
    'Aucune image n’est capturée, la caméra n’est jamais ouverte.',
    'Les autorisations de confidentialité sont lues, jamais écrites.',
    'Aucune application n’est fermée par le script.',
  ],
  source: 'https://learn.microsoft.com/windows/uwp/audio-video-camera/camera',
  sources: [
    { label: 'Get-Service', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-service' },
    { label: 'Win32_PnPEntity', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-pnpentity' },
    { label: 'Get-WinEvent', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent' },
  ],
};

/**
 * 6. bluetooth-diagnostic — l'adaptateur, la radio, les services, les paires.
 *
 * Le Bluetooth échoue rarement là où on le cherche : neuf fois sur dix c'est
 * la radio coupée par le mode avion ou une touche de fonction, ou le service
 * de prise en charge arrêté.
 */
export const outilDiagnosticBluetooth = {
  id: 'bluetooth-diagnostic',
  icon: '⌁',
  category: 'Poste de travail Windows',
  subcategory: 'Périphériques',
  title: 'Diagnostiquer le Bluetooth',
  risk: 'diagnostic',
  summary: 'Vérifie l’adaptateur Bluetooth, son pilote, l’état de la radio, les services de prise en charge et les périphériques associés. N’active ni ne désactive aucune radio : couper une radio à distance laisse une machine sans clavier.',
  fields: [
    { id: 'btJours', label: 'Fenêtre des événements (jours)', default: '7', help: 'Entre 1 et 90.' },
    champFormat('btFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'btJours', validerEntier(v.btJours, 1, 90, 'La fenêtre'));
    verifier(errors, 'btFormat', validerFormatRapport(v.btFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.btJours, 1, 90).value;

    const corps = [
      `$Jours = ${jours}`,
      `$KjemoFormat = ${psB64(v.btFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- 1. L\'adaptateur ------------------------------------------------------------------',
      blocPnpParClasse(['Bluetooth'], 'Bluetooth'),
      '',
      '# --- 2. La radio est-elle allumee ? ---------------------------------------------------',
      "# C'est la premiere cause, et la plus simple : mode avion, touche de",
      '# fonction, ou interrupteur de la machine. Windows voit alors un adaptateur',
      '# present et parfaitement sain, qui ne trouve rien.',
      '$radio = $null',
      'try {',
      "  $radio = Get-CimInstance -Namespace 'root/cimv2/mdm/dmmap' -ClassName 'MDM_Policy_Result01_Connectivity02' -ErrorAction SilentlyContinue",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Radio' -Controle 'Etat de la radio Bluetooth' -Etat 'INFO' -Valeur 'a verifier a l''ecran' -Commentaire 'Windows n''expose pas l''interrupteur radio de facon fiable en PowerShell. Parametres > Bluetooth et appareils, et le mode avion dans le volet rapide, repondent en une seconde. C''est la premiere chose a regarder.')",
      '# Le mode avion, lui, se lit dans le registre.',
      '$avion = $null',
      'try {',
      "  $avion = Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\RadioManagement\\SystemRadioState' -ErrorAction SilentlyContinue",
      '} catch { }',
      'if ($avion -and $null -ne $avion.\'(default)\') {',
      "  $etatA = 'OK'",
      "  $noteA = 'Mode avion inactif.'",
      "  if ([string]$avion.'(default)' -eq '0') { $etatA = 'ATTENTION' ; $noteA = 'Mode avion ACTIF : toutes les radios sont coupees, Bluetooth compris.' }",
      "  [void](Add-KjemoResultat -Categorie 'Radio' -Controle 'Mode avion' -Etat $etatA -Valeur ([string]$avion.'(default)') -Commentaire $noteA)",
      '}',
      '',
      '# --- 3. Les services de prise en charge -----------------------------------------------',
      blocServicePeripherique('bthserv', 'Service de prise en charge Bluetooth : sans lui, aucun appairage ne tient.'),
      blocServicePeripherique('BTAGService', 'Service de passerelle audio Bluetooth : casques et enceintes en dependent.'),
      '',
      '# --- 4. Les peripheriques associes ----------------------------------------------------',
      '$paires = @()',
      'try {',
      '  $paires = @(Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue |',
      "    Where-Object { $_.FriendlyName -and $_.InstanceId -like 'BTHENUM*' })",
      '} catch { }',
      'if ($paires.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Appairages' -Controle 'Peripheriques associes' -Etat 'INFO' -Valeur 0 -Commentaire 'Aucun peripherique appaire n''est declare. Si un casque devrait l''etre, l''appairage a ete perdu : le refaire depuis Parametres.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Appairages' -Controle 'Peripheriques associes' -Etat 'OK' -Valeur $paires.Count)",
      '  foreach ($pp in ($paires | Select-Object -First 20)) {',
      "    $etatPP = 'OK'",
      "    $notePP = 'Associe et present.'",
      "    if ($pp.Status -ne 'OK') { $etatPP = 'ATTENTION' ; $notePP = 'Associe mais absent ou en erreur : eteint, hors de portee, ou batterie vide.' }",
      "    [void](Add-KjemoResultat -Categorie 'Appairages' -Controle ([string]$pp.FriendlyName) -Etat $etatPP -Valeur ([string]$pp.Status) -Commentaire $notePP)",
      '  }',
      '}',
      '',
      '# --- 5. Les evenements recents --------------------------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1,2,3; StartTime = $depuis } -ErrorAction SilentlyContinue |",
      "    Where-Object { $_.ProviderName -like '*Bluetooth*' -or $_.ProviderName -like '*BTH*' } | Select-Object -First 15)",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements Bluetooth sur ' + [string]$Jours + ' jour(s)') -Etat (& { if ($evts.Count -eq 0) { 'OK' } else { 'ATTENTION' } }) -Valeur $evts.Count)",
      'foreach ($e in ($evts | Select-Object -First 6)) {',
      '  $ligne = \'\'',
      '  try { $ligne = ([string]$e.Message).Split("`n")[0] } catch { }',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ([string]$e.TimeCreated) -Etat 'INFO' -Valeur ('ID ' + [string]$e.Id) -Commentaire $ligne)",
      '}',
      '',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Radios' -Etat 'INFO' -Valeur 'jamais modifiees' -Commentaire 'Ce script n''allume ni n''eteint aucune radio. Couper une radio a distance laisse une machine sans clavier ni souris sans fil, et on ne la rallume plus a distance.')",
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic du Bluetooth',
      outil: 'bluetooth-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [['Jours', psB64(String(jours))], ['Format', psB64(v.btFormat)]],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-bluetooth',
      formats: v.btFormat,
    });
  },
  gui: [
    'Volet des paramètres rapides : vérifier que le mode avion est éteint et le Bluetooth allumé.',
    'Certains portables ont une touche de fonction ou un interrupteur physique qui coupe les radios.',
    'Paramètres > Bluetooth et appareils : retirer puis réassocier un périphérique capricieux.',
    'Gestionnaire de périphériques > Bluetooth : un triangle jaune signale un pilote en erreur.',
    'services.msc : « Service de prise en charge Bluetooth » (bthserv) doit être démarré.',
  ],
  keywords: motsCles(
    'bluetooth', 'appairage', 'casque bluetooth', 'souris bluetooth',
    'bthserv', 'mode avion', 'radio coupee', 'btagservice',
    'peripherique associe', 'pas de bluetooth',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire pour la lecture.',
    'Get-PnpDevice fait partie du module PnpDevice, livré avec Windows 10 et 11.',
    'Sur une machine sans Bluetooth, le rapport le dit plutôt que de signaler une panne.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'L’adaptateur est présent et sain, mais ne trouve aucun appareil',
      cause: 'La radio est coupée : mode avion, touche de fonction, ou interrupteur de la machine.',
      fix: 'Volet des paramètres rapides, puis la touche de fonction du clavier. Le script ne rallume aucune radio : c’est un geste qui se fait devant la machine.',
    },
    {
      message: 'Le casque est associé mais le son n’y sort pas',
      cause: 'Le profil audio Bluetooth n’est pas connecté, ou BTAGService est arrêté.',
      fix: 'Vérifier BTAGService dans le rapport, puis choisir le casque comme périphérique de sortie dans Paramètres > Système > Son.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'L’adaptateur apparaît avec son code d’erreur PnP traduit en clair.',
    'Les deux services Bluetooth sont rapportés avec leur état et leur type de démarrage.',
    'Le rapport rappelle que l’état de la radio se vérifie à l’écran, et pourquoi.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit l’état des périphériques, des services et des journaux. Il n’allume ni n’éteint aucune radio, et ne défait aucun appairage.',
    diagnostic: '# L\'adaptateur et les appairages, tels que le script les lit :\nGet-PnpDevice -Class Bluetooth | Select-Object FriendlyName,Status,InstanceId',
    command: '# Rien a annuler : aucune ecriture.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Ne jamais couper une radio sur une machine distante : un clavier ou une souris sans fil cesse alors de répondre, et on ne les rallume plus à distance.',
  },
  checks: [
    'Aucune radio n’est allumée ni éteinte.',
    'Aucun appairage n’est créé ni supprimé.',
    'Aucun pilote n’est téléchargé ni installé.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/pnpdevice/get-pnpdevice',
  sources: [
    { label: 'Get-PnpDevice', url: 'https://learn.microsoft.com/powershell/module/pnpdevice/get-pnpdevice' },
    { label: 'Get-Service', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-service' },
    { label: 'Win32_PnPEntity', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-pnpentity' },
  ],
};

/**
 * 7. display-diagnostic — écrans, résolution, fréquence, carte graphique.
 *
 * Il NE change pas la résolution. Windows n'expose aucune API officielle et
 * sûre pour le faire en PowerShell : les méthodes qui circulent passent par du
 * code compilé à la volée contre des API non documentées. Le script dit où
 * cliquer, ce qui prend trois secondes et ne casse rien.
 */
export const outilDiagnosticEcran = {
  id: 'display-diagnostic',
  icon: '▭',
  category: 'Poste de travail Windows',
  subcategory: 'Périphériques',
  title: 'Diagnostiquer les écrans et la résolution',
  risk: 'diagnostic',
  summary: 'Relève les écrans détectés, leur résolution et leur fréquence, la carte graphique et son pilote, et les périphériques d’affichage en erreur. Ne change aucune résolution : Windows n’offre pas d’API officielle et sûre pour le faire, et la page de Paramètres le fait en trois secondes.',
  fields: [
    { id: 'ecrJours', label: 'Fenêtre des événements (jours)', default: '7', help: 'Entre 1 et 90. Les événements d’affichage signalent les pilotes qui ont redémarré.' },
    champFormat('ecrFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'ecrJours', validerEntier(v.ecrJours, 1, 90, 'La fenêtre'));
    verifier(errors, 'ecrFormat', validerFormatRapport(v.ecrFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.ecrJours, 1, 90).value;

    const corps = [
      `$Jours = ${jours}`,
      `$KjemoFormat = ${psB64(v.ecrFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- 1. Les cartes graphiques ---------------------------------------------------------',
      '$gpus = @()',
      "try { $gpus = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue) } catch { }",
      'if ($gpus.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Carte graphique' -Controle 'Cartes detectees' -Etat 'PROBLEME' -Valeur 0 -Commentaire 'Aucune carte graphique declaree. Inhabituel : WMI est probablement restreint.')",
      '}',
      'foreach ($g in $gpus) {',
      "  $etatG = 'OK'",
      "  $noteG = 'pilote du ' + [string]$g.DriverDate",
      '  $code = 0',
      '  try { $code = [int]$g.ConfigManagerErrorCode } catch { }',
      "  if ($code -ne 0) { $etatG = 'PROBLEME' ; $noteG = 'Code d''erreur ' + [string]$code + '. ' + $noteG }",
      "  [void](Add-KjemoResultat -Categorie 'Carte graphique' -Controle ([string]$g.Name) -Etat $etatG -Valeur ('pilote ' + [string]$g.DriverVersion) -Commentaire $noteG)",
      "  if ($g.CurrentHorizontalResolution -and $g.CurrentVerticalResolution) {",
      "    [void](Add-KjemoResultat -Categorie 'Carte graphique' -Controle ([string]$g.Name + ' — mode actuel') -Etat 'INFO' -Valeur ([string]$g.CurrentHorizontalResolution + ' x ' + [string]$g.CurrentVerticalResolution) -Commentaire ([string]$g.CurrentRefreshRate + ' Hz · ' + [string]$g.CurrentBitsPerPixel + ' bits'))",
      '  }',
      '}',
      '',
      '# --- 2. Les ecrans connectes ----------------------------------------------------------',
      '# WmiMonitorID donne le fabricant et le modele reels, encodes en tableau de',
      '# caracteres : il faut les reassembler.',
      '$moniteurs = @()',
      "try { $moniteurs = @(Get-CimInstance -Namespace 'root/wmi' -ClassName WmiMonitorID -ErrorAction SilentlyContinue) } catch { }",
      'if ($moniteurs.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Ecrans' -Controle 'Ecrans identifies' -Etat 'IGNORE' -Valeur 'non lisibles' -Commentaire 'WmiMonitorID n''a pas repondu. Frequent sur machine virtuelle, ou quand l''ecran ne publie pas son EDID.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Ecrans' -Controle 'Ecrans identifies' -Etat 'OK' -Valeur $moniteurs.Count)",
      '  foreach ($m in $moniteurs) {',
      "    $fab = ''",
      "    $mod = ''",
      "    try { $fab = -join ($m.ManufacturerName | Where-Object { $_ -gt 0 } | ForEach-Object { [char]$_ }) } catch { }",
      "    try { $mod = -join ($m.UserFriendlyName | Where-Object { $_ -gt 0 } | ForEach-Object { [char]$_ }) } catch { }",
      "    [void](Add-KjemoResultat -Categorie 'Ecrans' -Controle ($fab + ' ' + $mod) -Etat 'INFO' -Valeur ([string]$m.YearOfManufacture) -Commentaire 'Identifie par son EDID. Le numero de serie n''est pas affiche.')",
      '  }',
      '}',
      '# Les modes acceptes par chaque ecran : utile pour savoir si une resolution',
      '# demandee est seulement absente de la liste.',
      '$modes = @()',
      "try { $modes = @(Get-CimInstance -Namespace 'root/wmi' -ClassName WmiMonitorListedSupportedSourceModes -ErrorAction SilentlyContinue) } catch { }",
      "if ($modes.Count -gt 0) { [void](Add-KjemoResultat -Categorie 'Ecrans' -Controle 'Ecrans publiant leurs modes' -Etat 'INFO' -Valeur $modes.Count -Commentaire 'Un mode absent de cette liste ne sera pas propose par Windows, meme si le cable le permettrait.') }",
      '',
      '# --- 3. Les peripheriques d\'affichage en erreur ---------------------------------------',
      blocPnpParClasse(['Display', 'Monitor'], 'Affichage'),
      '',
      '# --- 4. Les evenements recents --------------------------------------------------------',
      '# L\'evenement le plus parlant est « Display driver stopped responding and has',
      '# recovered » : un pilote graphique qui redemarre tout seul.',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1,2,3; StartTime = $depuis } -ErrorAction SilentlyContinue |",
      "    Where-Object { $_.ProviderName -like '*Display*' -or $_.ProviderName -like '*nvlddmkm*' -or $_.ProviderName -like '*amdkmdap*' -or $_.ProviderName -like '*igfx*' } | Select-Object -First 15)",
      '} catch { }',
      'if ($evts.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements affichage sur ' + [string]$Jours + ' jour(s)') -Etat 'OK' -Valeur 0)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements affichage sur ' + [string]$Jours + ' jour(s)') -Etat 'ATTENTION' -Valeur $evts.Count -Commentaire 'Un pilote graphique qui redemarre tout seul (TDR) signale une surchauffe, une alimentation insuffisante, ou un pilote inadapte.')",
      '  foreach ($e in ($evts | Select-Object -First 6)) {',
      '    $ligne = \'\'',
      '    try { $ligne = ([string]$e.Message).Split("`n")[0] } catch { }',
      "    [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ([string]$e.TimeCreated) -Etat 'INFO' -Valeur ('ID ' + [string]$e.Id) -Commentaire $ligne)",
      '  }',
      '}',
      '',
      '# --- 5. Pourquoi ce script ne change pas la resolution --------------------------------',
      "# Windows n'expose aucune applet officielle pour changer la resolution. Les",
      '# methodes qui circulent compilent du C# a la volee contre des API non',
      '# documentees : ca marche souvent, ca laisse un ecran noir parfois, et il',
      "# faut alors redemarrer en mode sans echec. La page de Parametres fait la",
      '# meme chose en trois secondes, avec un retour automatique si l\'ecran ne',
      '# tient pas le mode choisi.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Changement de resolution' -Etat 'INFO' -Valeur 'non automatise' -Commentaire 'Aucune API officielle et sure. Parametres > Systeme > Affichage > Resolution d''ecran le fait en trois secondes, et revient tout seul au mode precedent si l''ecran ne tient pas.')",
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic des ecrans et de la resolution',
      outil: 'display-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [['Jours', psB64(String(jours))], ['Format', psB64(v.ecrFormat)]],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-ecran',
      formats: v.ecrFormat,
    });
  },
  gui: [
    'Paramètres > Système > Affichage : résolution, mise à l’échelle, orientation et disposition des écrans.',
    'Paramètres > Système > Affichage > Paramètres d’affichage avancés : la fréquence de rafraîchissement, écran par écran.',
    'Windows + P bascule entre Dupliquer, Étendre et Écran secondaire uniquement.',
    'Gestionnaire de périphériques > Cartes graphiques : un triangle jaune signale un pilote en erreur.',
    '« dxdiag » résume la carte, son pilote et sa date en une page, à joindre à un billet.',
  ],
  keywords: motsCles(
    'ecran', 'resolution', 'affichage', 'frequence', 'hz', 'double ecran',
    'carte graphique', 'pilote graphique', 'ecran noir', 'edid',
    'mise a l echelle', 'tdr', 'moniteur',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire.',
    'Les classes WmiMonitorID et WmiMonitorListedSupportedSourceModes vivent dans l’espace de noms root/wmi : elles peuvent être absentes sur une machine virtuelle.',
    'Le script lit l’état ; aucun changement de résolution n’est tenté, même en mode administrateur.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'La résolution native n’est pas proposée dans la liste',
      cause: 'L’écran ne publie pas ce mode dans son EDID, ou le câble ne le permet pas — un HDMI ancien plafonne vite en 4K.',
      fix: 'Le rapport dit si l’écran publie ses modes. Vérifier ensuite le câble et le port : un DisplayPort ou un HDMI 2.0 change tout.',
    },
    {
      message: 'Le pilote graphique redémarre tout seul, l’écran clignote',
      cause: 'TDR — le pilote n’a pas répondu et Windows l’a relancé. Surchauffe, alimentation insuffisante, ou pilote inadapté.',
      fix: 'Les événements du rapport le confirment. Mettre à jour le pilote par Windows Update ou le site du fabricant de la machine, jamais par un site de pilotes tiers.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Chaque carte graphique apparaît avec sa version de pilote et sa date.',
    'Le mode actuel — résolution, fréquence, profondeur — est rapporté quand Windows le fournit.',
    'Le rapport explique en clair pourquoi la résolution n’est pas modifiée par script.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit WMI et les journaux. Il ne change ni résolution, ni fréquence, ni disposition d’écrans.',
    diagnostic: '# Le mode actuel, tel que le script le lit :\nGet-CimInstance Win32_VideoController | Select-Object Name,CurrentHorizontalResolution,CurrentVerticalResolution,CurrentRefreshRate,DriverVersion',
    command: '# Rien a annuler : aucune ecriture.\n# Une resolution se change dans Parametres > Systeme > Affichage, qui revient\n# tout seul au mode precedent si l\'ecran ne tient pas le nouveau.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Changer une résolution par script, contre des API non documentées, peut laisser un écran noir qu’il faut réparer en mode sans échec. Ce projet ne le fait pas.',
  },
  checks: [
    'Aucune résolution, fréquence ou disposition n’est modifiée.',
    'Aucun pilote graphique n’est téléchargé ni installé.',
    'Aucun numéro de série d’écran n’est affiché.',
  ],
  source: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-videocontroller',
  sources: [
    { label: 'Win32_VideoController', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-videocontroller' },
    { label: 'WmiMonitorID', url: 'https://learn.microsoft.com/windows/win32/wmicoreprov/wmimonitorid' },
    { label: 'Get-CimInstance', url: 'https://learn.microsoft.com/powershell/module/cimcmdlets/get-ciminstance' },
  ],
};

/**
 * 8. driver-audit — les pilotes qui posent problème, et eux seuls.
 *
 * Lister tous les pilotes d'un poste donne six cents lignes que personne ne
 * lit. Cet assistant ne retient que ce sur quoi on peut agir : les codes
 * d'erreur, les périphériques inconnus, et les pilotes anciens quand Windows
 * donne leur date.
 *
 * Il ne télécharge rien. Jamais. Les sites de pilotes tiers sont l'une des
 * voies d'infection les plus efficaces qui soient, et un pilote est du code
 * qui tourne en mode noyau.
 */
export const outilAuditPilotes = {
  id: 'driver-audit',
  icon: '⚙',
  category: 'Poste de travail Windows',
  subcategory: 'Périphériques',
  title: 'Auditer les pilotes du poste',
  risk: 'diagnostic',
  summary: 'Liste les périphériques en erreur avec leur code traduit, les périphériques inconnus, et les pilotes dont la date dépasse un seuil choisi. Ne télécharge, n’installe et ne désinstalle aucun pilote : un pilote est du code en mode noyau, et les sites de pilotes tiers sont une voie d’infection.',
  fields: [
    {
      id: 'drvAnciennete', label: 'Signaler les pilotes plus anciens que (années)', default: '5',
      help: 'Entre 1 et 15. Un pilote ancien n’est pas forcément mauvais : beaucoup de pilotes de classe Microsoft ne changent plus depuis des années, et c’est normal.',
    },
    {
      id: 'drvInclureMicrosoft', label: 'Inclure les pilotes fournis par Microsoft', type: 'select', default: 'Non',
      options: [['Non', 'Non — seulement les pilotes de fabricants'], ['Oui', 'Oui — tous, y compris les pilotes de classe Microsoft']],
      help: 'Les pilotes de classe Microsoft sont anciens par construction. Les inclure allonge beaucoup la liste sans rien apprendre.',
    },
    champFormat('drvFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'drvAnciennete', validerEntier(v.drvAnciennete, 1, 15, 'L’ancienneté'));
    verifier(errors, 'drvInclureMicrosoft', validerChoix(v.drvInclureMicrosoft, ['Non', 'Oui'], 'Le choix'));
    verifier(errors, 'drvFormat', validerFormatRapport(v.drvFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const annees = validerEntier(v.drvAnciennete, 1, 15).value;
    const inclureMs = validerChoix(v.drvInclureMicrosoft, ['Non', 'Oui']).value;

    const corps = [
      `$Annees = ${annees}`,
      `$InclureMicrosoft = ${psB64(inclureMs)}`,
      `$KjemoFormat = ${psB64(v.drvFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- Ce que cet assistant ne fera jamais ----------------------------------------------',
      "# Il ne telecharge aucun pilote, n'en installe aucun, n'en desinstalle aucun.",
      '# Un pilote est du code qui tourne en mode noyau : il a tous les droits sur',
      "# la machine. Les sites de pilotes tiers — ceux qui proposent un « scan",
      '# gratuit » — sont une voie d\'infection efficace, et leurs paquets sont',
      '# souvent plus anciens que ce que Windows Update propose deja.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Installation de pilotes' -Etat 'INFO' -Valeur 'aucune' -Commentaire 'Deux sources acceptables, et deux seulement : Windows Update, et le site du FABRICANT de la machine ou du composant. Jamais un site de pilotes tiers.')",
      '',
      '# --- 1. Les peripheriques en erreur ---------------------------------------------------',
      '$tous = @()',
      "try { $tous = @(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue) } catch { }",
      "[void](Add-KjemoResultat -Categorie 'Inventaire' -Controle 'Peripheriques declares' -Etat 'INFO' -Valeur $tous.Count)",
      '',
      '$enErreur = @($tous | Where-Object { $_.ConfigManagerErrorCode -ne 0 })',
      'if ($enErreur.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Erreurs' -Controle 'Peripheriques en erreur' -Etat 'OK' -Valeur 0 -Commentaire 'Aucun code d''erreur sur l''ensemble du poste.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Erreurs' -Controle 'Peripheriques en erreur' -Etat 'ATTENTION' -Valeur $enErreur.Count -Commentaire 'Les codes 22 (desactive volontairement) ne sont pas des pannes : ils sont distingues ci-dessous.')",
      '  foreach ($p in ($enErreur | Select-Object -First 30)) {',
      '    $code = 0',
      '    try { $code = [int]$p.ConfigManagerErrorCode } catch { }',
      "    $etatP = 'PROBLEME'",
      "    $noteP = 'Code ' + [string]$code + ' : voir la table des codes du Gestionnaire de peripheriques.'",
      "    if ($code -eq 22) { $etatP = 'INFO' ; $noteP = 'Code 22 : DESACTIVE volontairement. Ce n''est pas une panne. Gestionnaire de peripheriques > clic droit > Activer.' }",
      "    elseif ($code -eq 28) { $noteP = 'Code 28 : AUCUN PILOTE installe. C''est le cas le plus simple a corriger : Windows Update, puis le site du fabricant de la machine.' }",
      "    elseif ($code -eq 43) { $noteP = 'Code 43 : le peripherique a signale un probleme et Windows l''a arrete. Souvent materiel. Tester sur un autre port, ou sur une autre machine, avant de blamer le pilote.' }",
      "    elseif ($code -eq 10) { $noteP = 'Code 10 : le peripherique ne peut pas demarrer. Pilote inadapte, ressource en conflit, ou materiel defaillant.' }",
      "    elseif ($code -eq 31) { $noteP = 'Code 31 : Windows ne peut pas charger les pilotes necessaires. Souvent une installation precedente qui a mal fini.' }",
      "    elseif ($code -eq 45) { $noteP = 'Code 45 : peripherique absent. Il a ete branche un jour et ne l''est plus. Normal pour un peripherique nomade.' }",
      "    [void](Add-KjemoResultat -Categorie 'Erreurs' -Controle ([string]$p.Name) -Etat $etatP -Valeur ('code ' + [string]$code) -Commentaire ($noteP + ' · ' + [string]$p.DeviceID))",
      '  }',
      '}',
      '',
      '# --- 2. Les peripheriques inconnus ----------------------------------------------------',
      "# « Peripherique inconnu » veut dire que Windows ne sait meme pas de quoi il",
      "# s'agit. L'identifiant materiel du rapport est ce qu'on recherche chez le",
      '# fabricant pour trouver le bon pilote.',
      "$inconnus = @($tous | Where-Object { $_.Name -like '*Unknown*' -or $_.Name -like '*inconnu*' -or -not $_.PNPClass })",
      'if ($inconnus.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Inconnus' -Controle 'Peripheriques non identifies' -Etat 'OK' -Valeur 0)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Inconnus' -Controle 'Peripheriques non identifies' -Etat 'ATTENTION' -Valeur $inconnus.Count -Commentaire 'L''identifiant materiel ci-dessous est ce qu''il faut rechercher chez le fabricant de la machine.')",
      '  foreach ($u in ($inconnus | Select-Object -First 15)) {',
      "    [void](Add-KjemoResultat -Categorie 'Inconnus' -Controle ([string]$u.Name) -Etat 'INFO' -Valeur ([string]$u.DeviceID) -Commentaire 'Chercher cet identifiant (VEN_ et DEV_) sur le site du fabricant de la machine.')",
      '  }',
      '}',
      '',
      '# --- 3. Les pilotes anciens -----------------------------------------------------------',
      "# Un pilote ancien n'est pas forcement mauvais : beaucoup de pilotes de classe",
      '# Microsoft ne changent plus depuis des annees, et c\'est normal. On les',
      '# ecarte par defaut pour que la liste reste lisible.',
      '$limite = (Get-Date).AddYears(-$Annees)',
      '$pilotes = @()',
      "try { $pilotes = @(Get-CimInstance -ClassName Win32_PnPSignedDriver -ErrorAction SilentlyContinue | Where-Object { $_.DriverDate }) } catch { }",
      'if ($pilotes.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Anciennete' -Controle 'Pilotes dates' -Etat 'IGNORE' -Valeur 'non lisibles' -Commentaire 'Win32_PnPSignedDriver n''a pas repondu. Cette classe est lente et parfois restreinte ; son absence n''indique aucun probleme.')",
      '} else {',
      '  $candidats = @($pilotes | Where-Object { $_.DriverDate -lt $limite })',
      "  if ($InclureMicrosoft -eq 'Non') {",
      "    $candidats = @($candidats | Where-Object { $_.DriverProviderName -and $_.DriverProviderName -notlike 'Microsoft*' })",
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Anciennete' -Controle ('Pilotes anterieurs a ' + [string]$Annees + ' an(s)') -Etat (& { if ($candidats.Count -eq 0) { 'OK' } else { 'INFO' } }) -Valeur $candidats.Count -Commentaire ('Sur ' + [string]$pilotes.Count + ' pilote(s) dates. Un pilote ancien qui fonctionne n''a pas besoin d''etre remplace : ce n''est pas une liste de choses a faire.'))",
      '  foreach ($d in ($candidats | Sort-Object DriverDate | Select-Object -First 25)) {',
      "    [void](Add-KjemoResultat -Categorie 'Anciennete' -Controle ([string]$d.DeviceName) -Etat 'INFO' -Valeur ([string]$d.DriverVersion + ' du ' + [string]$d.DriverDate) -Commentaire ('fournisseur : ' + [string]$d.DriverProviderName))",
      '  }',
      '}',
      '',
      '# --- 4. Ou trouver un pilote, et ou ne pas en chercher --------------------------------',
      "Write-Host ''",
      "Write-Host '--- Ou trouver un pilote ---'",
      "Write-Host '1. Windows Update : Parametres > Windows Update > Options avancees >'",
      "Write-Host '   Mises a jour facultatives. C''est la source la plus sure.'",
      "Write-Host '2. Le site du FABRICANT de la machine (Dell, HP, Lenovo...), page de'",
      "Write-Host '   support du modele exact.'",
      "Write-Host '3. A defaut, le site du fabricant du COMPOSANT.'",
      "Write-Host ''",
      "Write-Host 'Jamais un site de pilotes tiers, meme bien reference. Un pilote tourne'",
      "Write-Host 'en mode noyau : il a tous les droits sur la machine.'",
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Audit des pilotes du poste',
      outil: 'driver-audit',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Annees', psB64(String(annees))],
        ['InclureMicrosoft', psB64(inclureMs)],
        ['Format', psB64(v.drvFormat)],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-pilotes',
      formats: v.drvFormat,
    });
  },
  gui: [
    'Gestionnaire de périphériques : un triangle jaune signale une erreur, une flèche vers le bas un périphérique désactivé.',
    'Clic droit sur un périphérique > Propriétés > Détails > Identifiants matériels : c’est ce qu’on recherche chez le fabricant.',
    'Paramètres > Windows Update > Options avancées > Mises à jour facultatives contient les pilotes proposés par Microsoft.',
    'Clic droit > Propriétés > Pilote > Version du pilote donne la date et la version installées.',
    'Clic droit > Propriétés > Pilote > Restaurer le pilote revient à la version précédente, quand elle existe encore.',
  ],
  keywords: motsCles(
    'pilote', 'driver', 'peripherique inconnu', 'code 28', 'code 43',
    'code 10', 'triangle jaune', 'gestionnaire de peripheriques',
    'pilote ancien', 'mise a jour pilote', 'identifiant materiel',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire pour la lecture.',
    'Win32_PnPSignedDriver est lent : compter dix à trente secondes sur un poste chargé. Son absence de réponse n’indique aucun problème.',
    'Installer un pilote demande une élévation — et ce script ne le fait pas.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Un périphérique porte le code 43 même après réinstallation du pilote',
      cause: 'Le code 43 vient du périphérique lui-même, qui a signalé un défaut. Ce n’est le plus souvent pas le pilote.',
      fix: 'Tester sur un autre port, puis sur une autre machine. Si le code suit le matériel, c’est le matériel.',
    },
    {
      message: 'Beaucoup de pilotes apparaissent comme « anciens »',
      cause: 'Les pilotes de classe Microsoft ne changent plus depuis des années, par conception.',
      fix: 'Laisser « Inclure les pilotes Microsoft » sur Non. Et se rappeler qu’un pilote ancien qui fonctionne n’a pas besoin d’être remplacé.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les codes 22 (désactivé volontairement) sont distingués des vraies pannes.',
    'Chaque périphérique inconnu apparaît avec son identifiant matériel, celui qu’on recherche chez le fabricant.',
    'Le rapport nomme les deux sources acceptables de pilotes, et dit laquelle ne l’est pas.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit WMI. Il ne télécharge, n’installe et ne désinstalle aucun pilote.',
    diagnostic: '# Les peripheriques en erreur, tels que le script les lit :\nGet-CimInstance Win32_PnPEntity | Where-Object ConfigManagerErrorCode -ne 0 | Select-Object Name,ConfigManagerErrorCode,DeviceID',
    command: '# Rien a annuler : aucune ecriture.\n# Pour revenir a la version precedente d\'un pilote, passer par :\n#   Gestionnaire de peripheriques > Proprietes > Pilote > Restaurer le pilote\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Ne jamais installer un pilote venant d’un site tiers. Un pilote tourne en mode noyau : il a tous les droits sur la machine, et une signature volée suffit à le faire accepter.',
  },
  checks: [
    'Aucun téléchargement : le script ne contient aucune requête web.',
    'Aucun pilote n’est installé, mis à jour ni désinstallé.',
    'Les périphériques volontairement désactivés ne sont pas comptés comme des pannes.',
  ],
  source: 'https://learn.microsoft.com/windows-hardware/drivers/install/device-manager-error-messages',
  sources: [
    { label: 'Codes d’erreur du Gestionnaire de périphériques', url: 'https://learn.microsoft.com/windows-hardware/drivers/install/device-manager-error-messages' },
    { label: 'Win32_PnPEntity', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-pnpentity' },
    { label: 'Win32_PnPSignedDriver', url: 'https://learn.microsoft.com/previous-versions/windows/desktop/whqlprov/win32-pnpsigneddriver' },
  ],
};

// ===========================================================================
// C. MISES À JOUR ET APPLICATIONS
// ===========================================================================

/**
 * 9. windows-update-diagnostic — pourquoi ce poste ne se met plus à jour.
 *
 * En lecture seule, dans l'ordre où les causes se présentent réellement :
 * services, redémarrage en attente, espace disque, historique, erreurs. Les
 * trois premières expliquent la grande majorité des cas, et aucune ne demande
 * de toucher au dossier SoftwareDistribution.
 */
export const outilDiagnosticWindowsUpdate = {
  id: 'windows-update-diagnostic',
  icon: '↻',
  category: 'Poste de travail Windows',
  subcategory: 'Mises à jour et applications',
  title: 'Diagnostiquer Windows Update',
  risk: 'diagnostic',
  summary: 'Examine en lecture seule les services de mise à jour, la dernière recherche, l’historique, le redémarrage en attente, les erreurs principales, l’espace disponible et la source des mises à jour (Microsoft, WSUS ou stratégie). Ne répare rien : l’assistant de réparation encadrée le fait, après confirmation.',
  fields: [
    { id: 'wudJours', label: 'Fenêtre des événements (jours)', default: '30', help: 'Entre 1 et 180. Les échecs de mise à jour se répètent : une fenêtre large montre le motif.' },
    champFormat('wudFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'wudJours', validerEntier(v.wudJours, 1, 180, 'La fenêtre'));
    verifier(errors, 'wudFormat', validerFormatRapport(v.wudFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.wudJours, 1, 180).value;

    const corps = [
      `$Jours = ${jours}`,
      `$KjemoFormat = ${psB64(v.wudFormat)}`,
      '',
      blocContextePoste(),
      '',
      '# --- 1. Les services -------------------------------------------------------------------',
      "# Quatre services, et l'ordre compte : wuauserv est celui qui travaille, les",
      "# trois autres sont ceux dont il depend et qu'on oublie de regarder.",
      "foreach ($paire in @(",
      "  @('wuauserv', 'Windows Update : le service qui cherche et installe.'),",
      "  @('bits', 'Transfert intelligent en arriere-plan : il telecharge. Arrete, rien n''arrive.'),",
      "  @('cryptsvc', 'Services de chiffrement : il verifie les signatures. Arrete, tout est refuse.'),",
      "  @('msiserver', 'Windows Installer : certaines mises a jour passent par lui.')",
      ')) {',
      '  $s = $null',
      '  try { $s = Get-Service -Name $paire[0] -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $s) {',
      "    [void](Add-KjemoResultat -Categorie 'Services' -Controle $paire[0] -Etat 'ATTENTION' -Valeur 'introuvable')",
      '  } else {',
      "    $etatS = 'OK'",
      '    $noteS = $paire[1]',
      "    if ($s.StartType -eq 'Disabled') { $etatS = 'PROBLEME' ; $noteS = 'DESACTIVE. ' + $paire[1] + ' C''est une cause directe et frequente : souvent un « optimiseur » ou une strategie qui l''a coupe.' }",
      "    elseif ($s.Status -ne 'Running' -and $paire[0] -eq 'cryptsvc') { $etatS = 'PROBLEME' ; $noteS = 'Arrete. ' + $paire[1] }",
      "    [void](Add-KjemoResultat -Categorie 'Services' -Controle ([string]$s.DisplayName) -Etat $etatS -Valeur ([string]$s.Status) -Commentaire ('demarrage : ' + [string]$s.StartType + '. ' + $noteS))",
      '  }',
      '}',
      '',
      '# --- 2. Le redemarrage en attente ------------------------------------------------------',
      "# Tant qu'il n'a pas eu lieu, les mises a jour suivantes echouent. C'est la",
      "# cause la plus simple, et celle qu'on neglige le plus.",
      '$marqueurs = @(',
      "  @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired', 'Windows Update'),",
      "  @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending', 'Maintenance des composants')",
      ')',
      '$attente = @()',
      'foreach ($mk in $marqueurs) {',
      '  try { if (Test-Path -LiteralPath $mk[0]) { $attente += $mk[1] } } catch { }',
      '}',
      'if ($attente.Count -gt 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Redemarrage' -Controle 'Redemarrage en attente' -Etat 'PROBLEME' -Valeur ($attente -join ', ') -Commentaire 'Tant qu''il n''a pas eu lieu, les mises a jour suivantes echoueront. Ce script ne redemarre rien : c''est a planifier avec la personne.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Redemarrage' -Controle 'Redemarrage en attente' -Etat 'OK' -Valeur 'aucun')",
      '}',
      '',
      '# --- 3. L\'espace disponible -------------------------------------------------------------',
      "# Une mise a jour de fonctionnalite demande plusieurs gigaoctets. En dessous",
      '# de 10 Go libres sur le volume systeme, les echecs deviennent la regle.',
      '$sys = $null',
      "try { $sys = Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -eq $env:SystemDrive } | Select-Object -First 1 } catch { }",
      'if ($sys) {',
      '  $libreGo = [Math]::Round($sys.FreeSpace / 1GB, 1)',
      "  $etatE = 'OK'",
      "  $noteE = 'Espace suffisant pour une mise a jour cumulative.'",
      "  if ($libreGo -lt 20) { $etatE = 'ATTENTION' ; $noteE = 'Moins de 20 Go : une mise a jour de fonctionnalite risque d''echouer.' }",
      "  if ($libreGo -lt 10) { $etatE = 'PROBLEME' ; $noteE = 'Moins de 10 Go : les echecs de mise a jour deviennent la regle. A traiter avant tout le reste.' }",
      "  [void](Add-KjemoResultat -Categorie 'Espace' -Controle ('Volume systeme ' + [string]$sys.DeviceID) -Etat $etatE -Valeur ([string]$libreGo + ' Go libres') -Commentaire $noteE)",
      '}',
      '',
      '# --- 4. D\'ou viennent les mises a jour ? ------------------------------------------------',
      "# Un poste pointe vers un WSUS qui n'existe plus ne se mettra jamais a jour,",
      '# et le message d\'erreur ne le dit pas clairement.',
      '$wu = $null',
      "try { $wu = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -ErrorAction SilentlyContinue } catch { }",
      'if (-not $wu) {',
      "  [void](Add-KjemoResultat -Categorie 'Source' -Controle 'Origine des mises a jour' -Etat 'OK' -Valeur 'Microsoft Update' -Commentaire 'Aucune strategie ne redirige ce poste : il s''adresse directement a Microsoft.')",
      '} else {',
      '  if ($wu.WUServer) {',
      "    [void](Add-KjemoResultat -Categorie 'Source' -Controle 'Serveur WSUS impose' -Etat 'INFO' -Valeur ([string]$wu.WUServer) -Commentaire 'Ce poste ne s''adresse pas a Microsoft mais a ce serveur. S''il n''existe plus ou n''est pas joignable, aucune mise a jour n''arrivera, et le message d''erreur ne le dira pas clairement.')",
      '  }',
      '  foreach ($nom in $wu.PSObject.Properties.Name) {',
      "    if ($nom -like 'PS*') { continue }",
      "    if ($nom -eq 'WUServer') { continue }",
      "    [void](Add-KjemoResultat -Categorie 'Source' -Controle ('Strategie : ' + $nom) -Etat 'INFO' -Valeur ([string]$wu.$nom) -Commentaire 'Impose par strategie de groupe. Ce script ne modifie aucune strategie.')",
      '  }',
      '}',
      '',
      '# --- 5. L\'historique ---------------------------------------------------------------------',
      '$correctifs = @()',
      "try { $correctifs = @(Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending) } catch { }",
      'if ($correctifs.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Historique' -Controle 'Correctifs QFE' -Etat 'ATTENTION' -Valeur 0 -Commentaire 'Get-HotFix ne voit que les correctifs de type QFE : son silence n''est pas une preuve d''absence de mise a jour.')",
      '} else {',
      '  $dernier = $correctifs | Select-Object -First 1',
      '  $age = 999',
      '  try { if ($dernier.InstalledOn) { $age = [int]((Get-Date) - $dernier.InstalledOn).TotalDays } } catch { }',
      "  $etatH = 'OK'",
      "  $noteH = 'Le poste recoit des mises a jour.'",
      "  if ($age -gt 60) { $etatH = 'ATTENTION' ; $noteH = 'Plus de 60 jours sans correctif QFE visible. A croiser avec l''historique de Parametres, plus complet.' }",
      "  [void](Add-KjemoResultat -Categorie 'Historique' -Controle 'Dernier correctif visible' -Etat $etatH -Valeur ([string]$dernier.HotFixID + ' le ' + [string]$dernier.InstalledOn) -Commentaire ($noteH + ' Il y a ' + [string]$age + ' jour(s).'))",
      '  foreach ($c in ($correctifs | Select-Object -First 10)) {',
      "    [void](Add-KjemoResultat -Categorie 'Historique' -Controle ([string]$c.HotFixID) -Etat 'INFO' -Valeur ([string]$c.InstalledOn) -Commentaire ([string]$c.Description))",
      '  }',
      '}',
      '',
      '# --- 6. Les erreurs recentes --------------------------------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1,2,3; StartTime = $depuis; ProviderName = 'Microsoft-Windows-WindowsUpdateClient' } -ErrorAction SilentlyContinue | Select-Object -First 30)",
      '} catch { }',
      'if ($evts.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Erreurs' -Controle ('Erreurs Windows Update sur ' + [string]$Jours + ' jour(s)') -Etat 'OK' -Valeur 0)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Erreurs' -Controle ('Erreurs Windows Update sur ' + [string]$Jours + ' jour(s)') -Etat 'ATTENTION' -Valeur $evts.Count -Commentaire 'Les memes codes qui reviennent valent mieux qu''une longue liste : ils sont regroupes ci-dessous.')",
      '  $groupes = $evts | Group-Object -Property Id | Sort-Object Count -Descending | Select-Object -First 6',
      '  foreach ($g in $groupes) {',
      '    $ex = $g.Group | Select-Object -First 1',
      '    $ligne = \'\'',
      '    try { $ligne = ([string]$ex.Message).Split("`n")[0] } catch { }',
      "    [void](Add-KjemoResultat -Categorie 'Erreurs' -Controle ('ID ' + [string]$g.Name) -Etat 'INFO' -Valeur ([string]$g.Count + ' occurrence(s)') -Commentaire $ligne)",
      '  }',
      '}',
      '',
      '# --- 7. La connectivite necessaire ---------------------------------------------------------',
      "# On ne teste PAS la connexion ici : la categorie Reseau le fait bien mieux.",
      "# On rappelle seulement ce dont Windows Update a besoin.",
      "[void](Add-KjemoResultat -Categorie 'Connectivite' -Controle 'Ce dont Windows Update a besoin' -Etat 'INFO' -Valeur 'HTTPS sortant' -Commentaire 'Acces HTTPS vers les domaines de mise a jour Microsoft, ou vers le WSUS indique plus haut. Pour eprouver le chemin reseau, utiliser les assistants de la categorie Reseau : ils le font pour de bon.')",
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic de Windows Update',
      outil: 'windows-update-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [['Jours', psB64(String(jours))], ['Format', psB64(v.wudFormat)]],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-wu-diagnostic',
      formats: v.wudFormat,
    });
  },
  gui: [
    'Paramètres > Windows Update : date de la dernière recherche, et bouton « Rechercher des mises à jour ».',
    'Paramètres > Windows Update > Historique des mises à jour : plus complet que Get-HotFix, avec les échecs et leurs codes.',
    'services.msc : wuauserv, BITS et « Services de chiffrement » doivent pouvoir démarrer.',
    'Observateur d’événements > Journaux des applications et des services > Microsoft > Windows > WindowsUpdateClient.',
    'Paramètres > Résolution des problèmes > Autres utilitaires > Windows Update lance l’utilitaire Microsoft.',
  ],
  keywords: motsCles(
    'windows update', 'mise a jour', 'wuauserv', 'bits', 'wsus',
    'redemarrage en attente', 'erreur mise a jour', 'historique mises a jour',
    'poste pas a jour', 'cryptsvc', 'espace insuffisant mise a jour',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire pour l’essentiel ; le journal Système peut en demander selon la stratégie locale.',
    'Ce script ne lance aucune recherche de mises à jour et n’en installe aucune.',
    'La connectivité réseau n’est pas éprouvée ici : les assistants de la catégorie Réseau le font.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Windows Update tourne indéfiniment sur « Recherche de mises à jour »',
      cause: 'Un serveur WSUS imposé par stratégie et devenu injoignable, ou un redémarrage en attente jamais effectué.',
      fix: 'Le rapport donne la source des mises à jour et l’état du redémarrage en attente. Ces deux lignes expliquent la plupart des cas.',
    },
    {
      message: 'Get-HotFix ne montre aucune mise à jour récente alors que le poste est à jour',
      cause: 'Get-HotFix ne liste que les correctifs de type QFE. Les mises à jour cumulatives modernes n’y apparaissent pas toutes.',
      fix: 'Croiser avec Paramètres > Windows Update > Historique des mises à jour, qui est la source complète.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les quatre services sont rapportés avec leur type de démarrage, et un service désactivé est un PROBLÈME.',
    'Le redémarrage en attente est cherché dans ses deux emplacements de registre.',
    'La source des mises à jour est nommée : Microsoft, ou le WSUS imposé par stratégie.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit les services, le registre, les correctifs et les journaux. Il ne démarre aucun service, n’installe aucune mise à jour et ne redémarre rien.',
    diagnostic: '# L\'etat des quatre services, et le redemarrage en attente :\nGet-Service wuauserv,bits,cryptsvc,msiserver | Select-Object Name,Status,StartType\nTest-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired"',
    command: '# Rien a annuler : aucune ecriture.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Le rapport peut contenir l’adresse du serveur WSUS interne. Il se traite comme une information d’infrastructure.',
  },
  checks: [
    'Aucun service n’est démarré, arrêté ni reconfiguré.',
    'Aucune mise à jour n’est recherchée ni installée.',
    'Aucune stratégie de groupe n’est modifiée, et aucun redémarrage n’est déclenché.',
  ],
  source: 'https://learn.microsoft.com/windows/deployment/update/windows-update-troubleshooting',
  sources: [
    { label: 'Résoudre les problèmes Windows Update', url: 'https://learn.microsoft.com/windows/deployment/update/windows-update-troubleshooting' },
    { label: 'Get-Service', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-service' },
    { label: 'Get-HotFix', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-hotfix' },
    { label: 'Codes d’erreur Windows Update', url: 'https://learn.microsoft.com/windows/deployment/update/windows-update-error-reference' },
  ],
};

/**
 * 10. windows-update-repair — la réparation encadrée, et ce qu'elle ne rend pas.
 *
 * La « réparation Windows Update » qui circule partout consiste à arrêter les
 * services, renommer SoftwareDistribution et catroot2, puis redémarrer. Elle
 * fonctionne souvent. Elle a deux conséquences que les pages qui la recopient
 * ne disent jamais :
 *
 *   1. L'HISTORIQUE DES MISES À JOUR EST PERDU. Il vit dans la base de données
 *      de SoftwareDistribution. Renommer le dossier le vide, définitivement.
 *      Les mises à jour restent installées — c'est leur HISTORIQUE affiché qui
 *      disparaît. Ce script le dit avant d'agir, pas après.
 *
 *   2. La prochaine recherche retélécharge tout le catalogue : compter de
 *      longues minutes, et plusieurs centaines de mégaoctets.
 *
 * Rien n'est renommé sans que les deux conséquences aient été affichées, et
 * sans confirmation écrite distincte. Les dossiers sont RENOMMÉS, jamais
 * supprimés : Windows en recrée de neufs, et les anciens restent sur le disque
 * tant que personne ne les efface à la main.
 */
export const outilReparationWindowsUpdate = {
  id: 'windows-update-repair',
  icon: '⟲',
  category: 'Poste de travail Windows',
  subcategory: 'Mises à jour et applications',
  title: 'Réparation encadrée de Windows Update',
  risk: 'caution',
  summary: 'Arrête les services de mise à jour réellement actifs, vérifie qu’ils le sont bien, renomme SoftwareDistribution et catroot2 — sans jamais les supprimer — puis rend à chaque service son état de départ. Le renommage est transactionnel : si le second échoue, le premier est remis en place. Ne redémarre jamais la machine.',
  fields: [
    {
      id: 'wurCible', label: 'Ce qu’il faut réinitialiser', type: 'select', default: 'SoftwareDistribution',
      options: [
        ['SoftwareDistribution', 'SoftwareDistribution seulement — le cas courant'],
        ['Les deux', 'SoftwareDistribution et catroot2 — quand les signatures sont en cause'],
      ],
      help: 'Commencer par SoftwareDistribution seul. catroot2 ne se touche que si les erreurs portent sur des signatures ou des certificats.',
    },
    {
      id: 'wurJournal', label: 'Dossier où déposer le journal de l’opération', default: 'C:\\Kjemo\\Journaux',
      help: 'Le script y écrit, AVANT d’agir, l’état relevé des services et des dossiers, puis le résultat de chaque étape. C’est la trace à joindre au billet. Le dossier est créé s’il manque.',
    },
    {
      id: 'wurConfirmation', label: 'Confirmation écrite (facultatif)', default: '',
      help: 'Obligatoire en mode Appliquer. Retaper exactement : JE REINITIALISE L AFFICHAGE DE L HISTORIQUE',
    },
    champMode('Diagnostic montre l’état, l’espace occupé, ce qui serait renommé et ce que cela coûte. Appliquer effectue la réinitialisation, après confirmation écrite.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'wurCible', validerChoix(v.wurCible, ['SoftwareDistribution', 'Les deux'], 'La cible'));
    verifier(errors, 'wurJournal', validerCheminWindowsLocal(v.wurJournal));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    const confirmation = String(v.wurConfirmation ?? '').trim();
    if (String(v.mode ?? '') === 'Appliquer' && confirmation !== 'JE REINITIALISE L AFFICHAGE DE L HISTORIQUE') {
      errors.wurConfirmation = 'Cette opération réinitialise l’historique affiché par Windows Update. Pour la faire, retaper exactement : JE REINITIALISE L AFFICHAGE DE L HISTORIQUE';
    }
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerChoix(v.wurCible, ['SoftwareDistribution', 'Les deux']).value;
    const journal = validerCheminWindowsLocal(v.wurJournal).value;
    const confirme = String(v.wurConfirmation ?? '').trim() === 'JE REINITIALISE L AFFICHAGE DE L HISTORIQUE';

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Cible = ${psB64(cible)}`,
      `$DossierJournal = ${psB64(journal)}`,
      `$ConfirmationOk = ${confirme ? '$true' : '$false'}`,
      "$KjemoFormat = 'Console'",
      '',
      blocContextePoste(),
      '',
      blocGardienChemin(),
      '',
      '# --- Ce que cette reparation fait, et ce qu\'elle ne promet pas ------------------------',
      "Write-Host ''",
      "Write-Host '=== A LIRE AVANT D''APPLIQUER ==='",
      "Write-Host 'L''historique affiche par Windows Update sera reinitialise. Les mises a'",
      "Write-Host 'jour installees restent installees. L''ancien dossier est conserve, mais'",
      "Write-Host 'la restauration de l''affichage historique n''est pas garantie ni presentee'",
      "Write-Host 'comme une procedure Microsoft prise en charge. Exporter les informations'",
      "Write-Host 'necessaires avant l''operation.'",
      "Write-Host ''",
      "Write-Host 'Autres consequences :'",
      "Write-Host '  - le catalogue sera entierement retelecharge a la prochaine recherche ;'",
      "Write-Host '    compter de longues minutes et plusieurs centaines de megaoctets ;'",
      "Write-Host '  - les dossiers sont RENOMMES sous un nom horodate, jamais supprimes ;'",
      "Write-Host '  - chaque service retrouvera son etat de depart : ceux qui etaient'",
      "Write-Host '    arretes avant le resteront apres ;'",
      "Write-Host '  - ce script ne redemarre JAMAIS la machine.'",
      "[void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Historique affiche' -Etat 'ATTENTION' -Valeur 'sera reinitialise' -Commentaire 'Les mises a jour installees restent installees. L''ancien dossier est conserve, mais la restauration de l''affichage historique n''est ni garantie, ni une procedure Microsoft prise en charge. Exporter ce qui doit l''etre AVANT.')",
      "[void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Dossiers' -Etat 'INFO' -Valeur 'renommes, jamais supprimes' -Commentaire 'Aucune suppression, ni pendant l''operation, ni pendant l''annulation.')",
      '',
      '# --- 1. Etat actuel des dossiers -------------------------------------------------------',
      "$racine = Join-Path $env:SystemRoot 'SoftwareDistribution'",
      "$racineCat = Join-Path $env:SystemRoot 'System32\\catroot2'",
      "$horodatage = (Get-Date -Format 'yyyyMMdd-HHmmss')",
      '$dossiers = @()',
      "$dossiers += ,@($racine, ($racine + '.kjemo-' + $horodatage), 'SoftwareDistribution')",
      "if ($Cible -eq 'Les deux') {",
      "  $dossiers += ,@($racineCat, ($racineCat + '.kjemo-' + $horodatage), 'catroot2')",
      '}',
      '',
      '$tousPresents = $true',
      'foreach ($d in $dossiers) {',
      '  $existe = $false',
      '  try { $existe = Test-Path -LiteralPath $d[0] } catch { }',
      '  if (-not $existe) {',
      '    $tousPresents = $false',
      "    [void](Add-KjemoResultat -Categorie 'Etat' -Controle $d[2] -Etat 'ATTENTION' -Valeur 'absent' -Commentaire 'Le dossier n''existe pas. Il a peut-etre deja ete reinitialise, ou Windows le recreera tout seul.')",
      '  } else {',
      '    $taille = 0',
      '    $nb = 0',
      '    try {',
      '      $contenu = @(Get-ChildItem -LiteralPath $d[0] -Recurse -File -ErrorAction SilentlyContinue)',
      '      $nb = $contenu.Count',
      '      foreach ($f in $contenu) { $taille = $taille + $f.Length }',
      '    } catch { }',
      '    $mo = [Math]::Round($taille / 1MB, 1)',
      "    [void](Add-KjemoResultat -Categorie 'Etat' -Controle $d[2] -Etat 'INFO' -Valeur ([string]$mo + ' Mo · ' + [string]$nb + ' fichier(s)') -Commentaire ('Sera renomme en : ' + $d[1]))",
      '  }',
      '}',
      '',
      '# --- 2. L\'etat de depart de chaque service, releve et CONSERVE -------------------------',
      "# Ce releve n'est pas decoratif : il decide de ce qui sera redemarre a la fin.",
      "# Un service arrete avant l'intervention doit rester arrete apres. Le",
      '# redemarrer « pour faire propre » change la configuration de la machine',
      "# sans que personne l'ait demande.",
      "$servicesArret = @('wuauserv', 'bits', 'cryptsvc', 'msiserver')",
      '$etatAvant = @{}',
      '$servicesLisibles = $true',
      '',
      '# Deux etats seulement sont STABLES : Running et Stopped. Tout le reste',
      "# — Paused, StopPending, StartPending, ContinuePending, PausePending —",
      '# decrit un service EN TRAIN de changer, ou suspendu en gardant ses',
      '# fichiers ouverts. On ne tente pas de le convertir : on bloque, et on',
      "# laisse la personne attendre ou corriger l'etat avant de relancer.",
      "$etatsStables = @('Running', 'Stopped')",
      '$etatsInitiauxStables = $true',
      'foreach ($n in $servicesArret) {',
      '  $s = $null',
      '  try { $s = Get-Service -Name $n -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $s) {',
      '    $servicesLisibles = $false',
      "    [void](Add-KjemoResultat -Categorie 'Services' -Controle $n -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'Service absent : la reparation ne peut pas se derouler proprement.')",
      '  } else {',
      '    $statut = [string]$s.Status',
      '    $stable = ($etatsStables -contains $statut)',
      '    if (-not $stable) {',
      '      $etatsInitiauxStables = $false',
      "      [void](Add-KjemoResultat -Categorie 'Services' -Controle ([string]$s.DisplayName) -Etat 'PROBLEME' -Valeur ($statut + ' — etat initial non stable') -Commentaire 'Seuls Running et Stopped sont des etats stables. Un service Paused ou en attente de transition peut encore tenir des fichiers ouverts, et ce script ne tente PAS de le convertir. Attendre que la transition se termine, ou corriger l''etat depuis services.msc, puis relancer.')",
      '    }',
      "    $actif = ($statut -eq 'Running')",
      '    $etatAvant[$n] = @($statut, [string]$s.StartType, $actif)',
      '    if ($stable) {',
      "      [void](Add-KjemoResultat -Categorie 'Services' -Controle ([string]$s.DisplayName) -Etat 'INFO' -Valeur $statut -Commentaire ('demarrage : ' + [string]$s.StartType + '. Etat de DEPART : ' + (& { if ($actif) { 'actif — il sera arrete puis redemarre' } else { 'arrete — il restera arrete' } })))",
      '    }',
      '  }',
      '}',
      'if (-not $etatsInitiauxStables) {',
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Reparation Windows Update' -Etat 'IGNORE' -Valeur 'bloquee' -Commentaire 'Au moins un service est dans un etat initial non stable. Aucun service n''a ete arrete, aucun dossier n''a ete touche.')",
      '}',
      '',
      '# --- 3. La procedure d\'annulation, ECRITE AVANT ----------------------------------------',
      "# Elle ne se contente pas de renommer l'ancien dossier : Windows aura recree",
      "# un dossier neuf sous le nom d'origine entre-temps, et le renommage",
      "# echouerait parce que le nom existe deja. Le dossier neuf est donc d'abord",
      '# mis de cote, sous un nom de conservation. Rien n\'est jamais supprime.',
      "Write-Host ''",
      "Write-Host '--- Procedure d''annulation, a garder ---'",
      "Write-Host '1. Arreter les services : ' -NoNewline",
      "Write-Host ($servicesArret -join ', ')",
      '$annulation = @()',
      "$suffixeRetour = 'kjemo-retour-' + $horodatage",
      'foreach ($d in $dossiers) {',
      '  $nomCourt = Split-Path -Leaf $d[0]',
      "  $annulation += ('  if (Test-Path -LiteralPath ''' + $d[0] + ''') { Rename-Item -LiteralPath ''' + $d[0] + ''' -NewName ''' + $nomCourt + '.' + $suffixeRetour + ''' }')",
      "  $annulation += ('  Rename-Item -LiteralPath ''' + $d[1] + ''' -NewName ''' + $nomCourt + '''')",
      '}',
      '$annulationConstruite = ($annulation.Count -gt 0)',
      "Write-Host '2. Mettre de cote le dossier recree, puis rendre son nom a l''ancien :'",
      'foreach ($a in $annulation) { Write-Host $a }',
      "Write-Host '3. Rendre a chaque service son etat de depart, celui du tableau ci-dessus.'",
      "Write-Host '4. Verifier : les dossiers d''origine sont revenus, les services sont'",
      "Write-Host '   dans leur etat de depart.'",
      "Write-Host 'Aucune suppression a aucune etape.'",
      "[void](Add-KjemoResultat -Categorie 'Annulation' -Controle 'Procedure exacte' -Etat 'INFO' -Valeur ($annulation -join ' ; ') -Commentaire 'Le dossier recree par Windows est mis de cote sous un nom de conservation, jamais supprime : sans cela, le renommage de retour echouerait parce que le nom existe deja.')",
      '',
      '# --- 4. Le journal de l\'operation ------------------------------------------------------',
      "# Ecrit AVANT d'agir, pas apres : un journal produit seulement en cas de",
      "# succes ne sert a rien le jour ou l'operation echoue a mi-chemin.",
      "$journalOk = Test-KjemoCheminSur -Chemin $DossierJournal -Role 'Dossier du journal'",
      "$FichierJournal = ''",
      'if ($journalOk) {',
      '  try {',
      '    if (-not (Test-Path -LiteralPath $DossierJournal)) {',
      '      [void](New-Item -ItemType Directory -Path $DossierJournal -ErrorAction Stop)',
      '    }',
      "    $FichierJournal = Join-Path $DossierJournal ('kjemo-wu-reparation-' + $env:COMPUTERNAME + '-' + $horodatage + '.log')",
      '    $entete = @()',
      "    $entete += '=== Reparation Windows Update — KJEMO IT Toolkit ==='",
      "    $entete += ('Machine        : ' + $env:COMPUTERNAME)",
      "    $entete += ('Session        : ' + $env:USERNAME)",
      "    $entete += ('Date           : ' + (Get-Date).ToString('s'))",
      "    $entete += ('Mode           : ' + $Mode)",
      "    $entete += ('Cible          : ' + $Cible)",
      "    $entete += ('Console elevee : ' + [string]$KjemoEleve)",
      "    $entete += '--- Etat de DEPART des services ---'",
      '    foreach ($n in $servicesArret) {',
      '      if ($etatAvant.ContainsKey($n)) {',
      "        $entete += ('  ' + $n + ' : ' + $etatAvant[$n][0] + ' (demarrage ' + $etatAvant[$n][1] + ')')",
      '      } else {',
      "        $entete += ('  ' + $n + ' : INTROUVABLE')",
      '      }',
      '    }',
      "    $entete += '--- Dossiers vises ---'",
      '    foreach ($d in $dossiers) {',
      "      $entete += ('  ' + $d[2] + ' : ' + $d[0] + ' -> ' + $d[1])",
      '    }',
      "    $entete += '--- Procedure d''annulation ---'",
      '    foreach ($a in $annulation) { $entete += $a }',
      '    Set-Content -LiteralPath $FichierJournal -Value $entete -Encoding UTF8 -ErrorAction Stop',
      "    [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Releve de depart' -Etat 'OK' -Valeur $FichierJournal -Commentaire 'Ecrit AVANT toute action. C''est la trace a joindre au billet.')",
      '  } catch {',
      '    $journalOk = $false',
      "    [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Releve de depart' -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message) -Commentaire 'Sans journal, l''operation ne serait pas tracable : elle est bloquee.')",
      '  }',
      '}',
      '',
      '# --- 5. Le verrou ------------------------------------------------------------------------',
      "# Six conditions, toutes necessaires : console elevee, confirmation ecrite,",
      "# services lisibles, dossiers cibles presents, procedure d'annulation",
      '# construite, et journal ecrit.',
      '$conditionsAppliquer = $KjemoEleve -and $ConfirmationOk -and $servicesLisibles -and $etatsInitiauxStables -and $tousPresents -and $annulationConstruite -and $journalOk',
      '',
      "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {",
      '  $manquants = @()',
      "  if (-not $KjemoEleve) { $manquants += 'console non elevee : arreter un service et renommer un dossier de Windows l''exigent' }",
      "  if (-not $ConfirmationOk) { $manquants += 'confirmation ecrite absente' }",
      "  if (-not $servicesLisibles) { $manquants += 'un des services de mise a jour est introuvable' }",
      "  if (-not $etatsInitiauxStables) { $manquants += 'un service est dans un etat initial non stable (Paused ou transition en cours) : attendre ou corriger depuis services.msc' }",
      "  if (-not $tousPresents) { $manquants += 'un dossier cible est absent' }",
      "  if (-not $annulationConstruite) { $manquants += 'procedure d''annulation non construite' }",
      "  if (-not $journalOk) { $manquants += 'journal de l''operation non ecrit' }",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Conditions prealables' -Etat 'PROBLEME' -Valeur ($manquants -join ' ; ') -Commentaire 'Le mode Appliquer exige les six conditions a la fois.')",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Reinitialisation' -Etat 'IGNORE' -Valeur 'bloquee' -Commentaire 'Aucun service n''a ete arrete, aucun dossier renomme. L''etat du poste est exactement celui d''avant.')",
      "  Write-Host ''",
      "  Write-Host '--- Reinitialisation BLOQUEE ---'",
      '  foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "  Write-Host '  Aucune action n''a ete tentee.'",
      "} elseif ($Mode -eq 'Appliquer') {",
      '',
      '  # --- 6. Arret des seuls services REELLEMENT ACTIFS -----------------------------------',
      "  # On n'arrete pas ce qui est deja arrete : la commande echouerait, ou",
      '  # pire, reussirait en laissant croire a une action.',
      "  Write-Host ''",
      "  Write-Host '--- Arret des services actifs ---'",
      '  foreach ($n in $servicesArret) {',
      '    $etaitActif = $false',
      '    if ($etatAvant.ContainsKey($n)) { $etaitActif = [bool]$etatAvant[$n][2] }',
      '    if (-not $etaitActif) {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Arret ' + $n) -Etat 'IGNORE' -Valeur 'deja arrete' -Commentaire 'Rien a faire : il etait deja arrete, et il le restera.')",
      '      continue',
      '    }',
      '    try {',
      '      Stop-Service -Name $n -ErrorAction Stop',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Arret ' + $n) -Etat 'OK' -Valeur 'commande acceptee')",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Arret ' + $n) -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message))",
      '    }',
      '  }',
      '',
      '  # --- 7. RELECTURE : les services sont-ils VRAIMENT arretes ? -------------------------',
      "  # Stop-Service peut rendre la main sans erreur alors que le service est",
      "  # encore en train de s'arreter, ou refuse de le faire. On ne croit donc pas",
      '  # la commande sur parole : on relit chaque service. C\'est ce controle, et',
      '  # non le succes de Stop-Service, qui autorise le renommage.',
      '  # Et la regle est STRICTE : seul Stopped compte comme arrete. Paused,',
      '  # StopPending, StartPending, ContinuePending et PausePending decrivent',
      '  # un service suspendu ou en transition, qui peut parfaitement garder des',
      '  # fichiers ouverts. Tester « different de Running » laisserait passer',
      '  # ces cinq etats-la.',
      '  $tousArretes = $true',
      '  $encoreActifs = @()',
      '  foreach ($n in $servicesArret) {',
      '    $serviceRelu = $null',
      '    try { $serviceRelu = Get-Service -Name $n -ErrorAction SilentlyContinue } catch { }',
      '    $statutRelu = [string]$serviceRelu.Status',
      "    if ($statutRelu -ne 'Stopped') {",
      '      $tousArretes = $false',
      "      $encoreActifs += ($n + ' (' + $statutRelu + ')')",
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle ('Arret reel de ' + $n) -Etat 'PROBLEME' -Valeur $statutRelu -Commentaire ('Statut relu : ' + $statutRelu + '. Seul Stopped autorise le renommage ; un service Paused ou en transition peut encore tenir des fichiers ouverts.'))",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle ('Arret reel de ' + $n) -Etat 'OK' -Valeur 'Stopped')",
      '    }',
      '  }',
      '',
      '  # --- 8. Renommage TRANSACTIONNEL -----------------------------------------------------',
      "  # Avec la cible « Les deux », le premier dossier peut etre renomme puis le",
      '  # second echouer. Un Windows Update avec SoftwareDistribution neuf et un',
      "  # catroot2 d'origine est dans un etat que personne n'a prevu. On tient donc",
      '  # la liste de ce qui a REELLEMENT ete renomme, et au premier echec on',
      '  # remet tout en place.',
      '  $renommes = @()',
      '  $renommageOk = $false',
      '  if (-not $tousArretes) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Renommage' -Etat 'IGNORE' -Valeur 'bloque' -Commentaire ('Service(s) encore actif(s) : ' + ($encoreActifs -join ', ') + '. Renommer un dossier qu''un service tient ouvert casserait Windows Update plus profondement. Aucun dossier n''a ete touche.'))",
      "    Write-Host '--- Renommage BLOQUE : un service est reste actif ---'",
      '  } else {',
      '    $echec = $false',
      '    foreach ($d in $dossiers) {',
      '      if ($echec) { break }',
      '      try {',
      '        Rename-Item -LiteralPath $d[0] -NewName (Split-Path -Leaf $d[1]) -ErrorAction Stop',
      '        $renommes += ,$d',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Renommage ' + $d[2]) -Etat 'OK' -Valeur $d[1] -Commentaire 'L''ancien dossier reste sur le disque sous ce nom. Rien n''a ete supprime.')",
      '      } catch {',
      '        $echec = $true',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Renommage ' + $d[2]) -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message) -Commentaire 'Ce dossier est intact. Les renommages deja faits vont etre defaits.')",
      '      }',
      '    }',
      '',
      '    if ($echec) {',
      '      # Retour en arriere immediat : aucun etat partiel ne doit subsister.',
      "      Write-Host ''",
      "      Write-Host '--- ECHEC EN COURS DE ROUTE : retour en arriere ---'",
      '      $retourComplet = $true',
      '      foreach ($d in $renommes) {',
      '        try {',
      '          Rename-Item -LiteralPath $d[1] -NewName (Split-Path -Leaf $d[0]) -ErrorAction Stop',
      "          [void](Add-KjemoResultat -Categorie 'Retour arriere' -Controle ('Restauration ' + $d[2]) -Etat 'OK' -Valeur $d[0])",
      '        } catch {',
      '          $retourComplet = $false',
      "          [void](Add-KjemoResultat -Categorie 'Retour arriere' -Controle ('Restauration ' + $d[2]) -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message) -Commentaire 'Le dossier n''a pas pu reprendre son nom. Voir la procedure d''annulation du journal.')",
      '        }',
      '      }',
      '      # On VERIFIE que le retour a reellement eu lieu, au lieu de le supposer.',
      '      foreach ($d in $renommes) {',
      "        # Deux conditions, pas une. Que le nom d''origine soit de nouveau",
      '        # present ne suffit pas : si la sauvegarde existe ENCORE sous son',
      "        # nom horodate, c''est que le renommage de retour n''a pas eu lieu et",
      '        # que Windows a simplement recree un dossier neuf. Deux dossiers au',
      "        # lieu d''un : ce n''est pas l''etat de depart.",
      '        $revenu = $false',
      '        $sauvegardePartie = $false',
      '        try { $revenu = Test-Path -LiteralPath $d[0] } catch { }',
      '        try { $sauvegardePartie = -not (Test-Path -LiteralPath $d[1]) } catch { }',
      '        $retourVerifie = ($revenu -and $sauvegardePartie)',
      '        if (-not $retourVerifie) { $retourComplet = $false }',
      "        [void](Add-KjemoResultat -Categorie 'Retour arriere' -Controle ('Verification ' + $d[2]) -Etat (& { if ($retourVerifie) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($retourVerifie) { 'dossier revenu a son nom, sauvegarde temporaire disparue' } elseif (-not $revenu) { 'dossier TOUJOURS absent sous son nom d''origine' } else { 'le nom d''origine existe, mais la sauvegarde horodatee existe ENCORE : deux dossiers au lieu d''un' } }) -Commentaire (& { if ($retourVerifie) { 'Le nom d''origine est revenu et la sauvegarde temporaire a disparu : c''est bien l''etat de depart.' } elseif (-not $revenu) { 'Le dossier n''a pas repris son nom d''origine. Voir la procedure d''annulation du journal.' } else { 'Le nom d''origine existe, mais la sauvegarde horodatee existe ENCORE : deux dossiers au lieu d''un. Windows a recree un dossier neuf a cote de la sauvegarde ; ce n''est PAS l''etat de depart.' } }))",
      '      }',
      '      if ($retourComplet) {',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Reinitialisation' -Etat 'IGNORE' -Valeur 'annulee, etat d''origine retabli' -Commentaire 'Un renommage a echoue. Les precedents ont ete defaits et verifies : le poste est dans son etat de depart. L''operation n''a PAS reussi.')",
      '      } else {',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Reinitialisation' -Etat 'PROBLEME' -Valeur 'ETAT PARTIEL' -Commentaire 'Un renommage a echoue ET le retour en arriere n''a pas abouti. Le poste est dans un etat intermediaire : suivre la procedure d''annulation du journal, a la main, avant toute autre tentative.')",
      '      }',
      '    } else {',
      '      $renommageOk = $true',
      '    }',
      '  }',
      '',
      '  # --- 9. Rendre a chaque service son etat de DEPART -----------------------------------',
      "  # Pas « redemarrer tout » : rendre son etat de depart. Un service arrete",
      "  # avant l'intervention reste arrete apres. L'ordre de demarrage est",
      '  # l\'inverse de celui de l\'arret.',
      "  Write-Host ''",
      "  Write-Host '--- Retour des services a leur etat de depart ---'",
      '  $restaurationOk = $true',
      "  foreach ($n in @('cryptsvc', 'bits', 'msiserver', 'wuauserv')) {",
      '    if (-not $etatAvant.ContainsKey($n)) { continue }',
      '    $etaitActif = [bool]$etatAvant[$n][2]',
      '    if (-not $etaitActif) {',
      "      [void](Add-KjemoResultat -Categorie 'Restauration' -Controle $n -Etat 'OK' -Valeur 'laisse arrete' -Commentaire 'Il etait arrete avant l''intervention : le redemarrer changerait la configuration du poste sans que personne l''ait demande.')",
      '      continue',
      '    }',
      '    try {',
      '      Start-Service -Name $n -ErrorAction Stop',
      '    } catch {',
      '      $restaurationOk = $false',
      "      [void](Add-KjemoResultat -Categorie 'Restauration' -Controle $n -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message) -Commentaire 'A redemarrer a la main depuis services.msc.')",
      '    }',
      '  }',
      '',
      '  # --- 10. Comparaison etat de depart / etat final -------------------------------------',
      '  foreach ($n in $servicesArret) {',
      '    if (-not $etatAvant.ContainsKey($n)) { continue }',
      '    $attendu = $etatAvant[$n][0]',
      '    $final = $null',
      '    try { $final = (Get-Service -Name $n -ErrorAction SilentlyContinue).Status } catch { }',
      "    $conforme = ([string]$final -eq [string]$attendu)",
      '    if (-not $conforme) { $restaurationOk = $false }',
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle ($n + ' — depart vs final') -Etat (& { if ($conforme) { 'OK' } else { 'PROBLEME' } }) -Valeur ([string]$attendu + ' -> ' + [string]$final) -Commentaire (& { if ($conforme) { 'Le service a retrouve son etat de depart.' } else { 'Le service N''A PAS retrouve son etat de depart. A corriger a la main depuis services.msc.' } }))",
      '  }',
      '  if (-not $restaurationOk) {',
      "    [void](Add-KjemoResultat -Categorie 'Restauration' -Controle 'Etat des services' -Etat 'PROBLEME' -Valeur 'non conforme au depart' -Commentaire 'Au moins un service n''a pas retrouve son etat de depart. Le tableau ci-dessus dit lequel.')",
      '  }',
      '',
      '  # --- 11. Conclusion, sans complaisance -----------------------------------------------',
      '  if ($renommageOk -and $restaurationOk) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Reinitialisation' -Etat 'OK' -Valeur 'effectuee' -Commentaire 'Dossiers renommes, services revenus a leur etat de depart.')",
      "    Write-Host ''",
      "    Write-Host '--- Et maintenant ---'",
      "    Write-Host 'Ouvrir Parametres > Windows Update et lancer une recherche. La premiere'",
      "    Write-Host 'prendra longtemps : tout le catalogue est retelecharge.'",
      "    Write-Host 'La machine n''a PAS ete redemarree, et ce script ne la redemarrera pas.'",
      '  } elseif ($renommageOk) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Reinitialisation' -Etat 'ATTENTION' -Valeur 'effectuee, mais etat des services non conforme' -Commentaire 'Les dossiers ont ete renommes, mais au moins un service n''a pas retrouve son etat de depart.')",
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      '  if ($conditionsAppliquer) {',
      "    Write-Host 'Les six conditions sont reunies. En mode Appliquer, le script :'",
      "    Write-Host '  1. arreterait les SEULS services actuellement actifs ;'",
      "    Write-Host '  2. RELIRAIT chaque service pour verifier qu''il est vraiment arrete ;'",
      "    Write-Host '  3. renommerait les dossiers, en defaisant les precedents au premier'",
      "    Write-Host '     echec — aucun etat partiel n''est accepte ;'",
      "    Write-Host '  4. rendrait a chaque service son etat de DEPART, en laissant arretes'",
      "    Write-Host '     ceux qui l''etaient ;'",
      "    Write-Host '  5. comparerait etat de depart et etat final, et le rapporterait.'",
      "    Write-Host 'Il ne redemarrerait PAS la machine.'",
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'INFO' -Valeur 'passerait' -Commentaire 'Console elevee, confirmation ecrite, services lisibles, dossiers presents, annulation construite, journal ecrit.')",
      '  } else {',
      '    $manquants = @()',
      "    if (-not $KjemoEleve) { $manquants += 'console non elevee' }",
      "    if (-not $ConfirmationOk) { $manquants += 'confirmation ecrite absente' }",
      "    if (-not $servicesLisibles) { $manquants += 'un service de mise a jour est introuvable' }",
      "    if (-not $etatsInitiauxStables) { $manquants += 'un service est dans un etat initial non stable' }",
      "    if (-not $tousPresents) { $manquants += 'un dossier cible est absent' }",
      "    if (-not $annulationConstruite) { $manquants += 'procedure d''annulation non construite' }",
      "    if (-not $journalOk) { $manquants += 'journal de l''operation non ecrit' }",
      "    Write-Host 'En mode Appliquer, le script SERAIT BLOQUE et ne toucherait a rien.'",
      "    Write-Host 'Ce qui manque :'",
      '    foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'PROBLEME' -Valeur ('serait bloque : ' + ($manquants -join ' ; ')) -Commentaire 'En l''etat, passer en mode Appliquer ne modifierait rien.')",
      '  }',
      '}',
      blocModeDiagnostic(),
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Reparation encadree de Windows Update',
      outil: 'windows-update-repair',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [['Mode', psB64(v.mode)], ['Cible', psB64(cible)], ['Journal', psB64(journal)]],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-wu-reparation',
      formats: 'Console',
    });
  },
  gui: [
    'Avant tout : Paramètres > Résolution des problèmes > Autres utilitaires > Windows Update. L’utilitaire Microsoft fait souvent l’affaire, sans rien perdre.',
    'Exporter l’historique AVANT : Paramètres > Windows Update > Historique des mises à jour, et en faire une capture ou une copie. C’est la seule trace qui restera.',
    'services.msc : arrêter wuauserv, BITS, « Services de chiffrement » et Windows Installer.',
    'Renommer C:\\Windows\\SoftwareDistribution en SoftwareDistribution.old, puis redémarrer les services.',
    'Rouvrir Paramètres > Windows Update et lancer une recherche : la première est longue.',
  ],
  keywords: motsCles(
    'reparer windows update', 'softwaredistribution', 'catroot2',
    'reinitialiser windows update', 'mise a jour bloquee', 'wuauserv',
    'historique reinitialise', 'catalogue retelecharge', 'erreur 0x80070',
    'etat des services restaure', 'renommage transactionnel',
  ),
  requiresAdmin: true,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Console administrateur OBLIGATOIRE en mode Appliquer : arrêter un service et renommer un dossier de Windows l’exigent. Le script le vérifie et bloque proprement.',
    'Exporter l’historique des mises à jour AVANT, s’il doit servir à une preuve de conformité : son affichage sera réinitialisé, et le remettre en place n’est pas une procédure prise en charge.',
    'Prévoir du temps après : la première recherche retélécharge tout le catalogue.',
    'Essayer d’abord l’utilitaire de résolution des problèmes de Microsoft, qui ne perd rien.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: '« etat initial non stable » : la réparation est bloquée avant même de commencer',
      cause: 'Un des quatre services est Paused, StopPending, StartPending, ContinuePending ou PausePending. Il est suspendu, ou en train de changer d’état.',
      fix: 'Attendre quelques dizaines de secondes qu’une transition se termine, puis relancer. Si l’état persiste, le corriger depuis services.msc avant de recommencer. Le script ne le convertit pas tout seul : forcer un service en transition est le meilleur moyen de laisser des fichiers ouverts pendant le renommage.',
    },

    {
      message: 'Accès refusé au renommage de SoftwareDistribution',
      cause: 'Un des services n’était pas vraiment arrêté et tient encore un fichier du dossier.',
      fix: 'Le script RELIT chaque service après la demande d’arrêt et bloque si l’un tourne encore — c’est cette relecture, et non le succès de Stop-Service, qui autorise le renommage. Relancer après avoir arrêté le service récalcitrant depuis services.msc.',
    },
    {
      message: 'L’historique affiché par Windows Update est vide après la réparation',
      cause: 'C’est le comportement attendu, pas un défaut : l’affichage se reconstruit depuis la base de SoftwareDistribution, qui vient d’être remplacée.',
      fix: 'Les mises à jour installées le restent — « Programmes et fonctionnalités > Mises à jour installées » et Get-HotFix les montrent toujours. L’ancien dossier est conservé, mais remettre l’affichage historique en place n’est ni garanti, ni une procédure Microsoft prise en charge : exporter ce qui doit l’être AVANT l’opération.',
    },
    {
      message: 'La recherche de mises à jour est très longue après la réparation',
      cause: 'Le catalogue entier est retéléchargé : c’est annoncé, et c’est normal.',
      fix: 'Laisser le poste branché et connecté. Compter de longues minutes et plusieurs centaines de mégaoctets.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Chaque service a retrouvé son état de DÉPART : le rapport compare départ et final, ligne par ligne, et signale tout écart.',
    'Un service arrêté avant l’intervention est toujours arrêté après.',
    'Les anciens dossiers sont toujours sur le disque, sous leur nom horodaté : rien n’a été supprimé.',
    'Si un renommage a échoué, le rapport dit que l’opération n’a PAS réussi et que les précédents ont été défaits.',
    'Une recherche de mises à jour aboutit — longue la première fois.',
  ],
  rollback: {
    summary: 'Les dossiers d’origine ne sont pas supprimés : ils portent un nom horodaté et restent sur le disque. L’annulation les remet en place — mais elle ne garantit pas le retour de l’affichage historique, et ce n’est pas une procédure Microsoft prise en charge. Aucune étape ne supprime quoi que ce soit.',
    diagnostic: '# Les dossiers mis de cote par ce script, et l\'etat des services :\nGet-ChildItem -LiteralPath $env:SystemRoot -Filter "SoftwareDistribution.kjemo-*" -Directory\nGet-ChildItem -LiteralPath (Join-Path $env:SystemRoot "System32") -Filter "catroot2.kjemo-*" -Directory\nGet-Service wuauserv,bits,cryptsvc,msiserver | Select-Object Name,Status,StartType',
    command: `# Annulation. Remplacer <horodatage> par celui des dossiers a restaurer, et
# <depart> par l'etat de depart note dans le journal de l'operation.
#
# 1. Arreter les services.
Stop-Service wuauserv,bits,cryptsvc,msiserver

# 2. Windows a recree un dossier neuf sous le nom d'origine. Le renommage de
#    retour echouerait parce que le nom existe deja : on met donc le dossier
#    recree DE COTE, sous un nom de conservation. On ne le supprime pas.
$sd = Join-Path $env:SystemRoot 'SoftwareDistribution'
if (Test-Path -LiteralPath $sd) {
  Rename-Item -LiteralPath $sd -NewName ('SoftwareDistribution.recree-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
Rename-Item -LiteralPath ($sd + '.kjemo-<horodatage>') -NewName 'SoftwareDistribution'

# 3. Le meme traitement pour catroot2, si les deux ont ete reinitialises.
$cat = Join-Path $env:SystemRoot 'System32\\catroot2'
if (Test-Path -LiteralPath $cat) {
  Rename-Item -LiteralPath $cat -NewName ('catroot2.recree-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
# Rename-Item -LiteralPath ($cat + '.kjemo-<horodatage>') -NewName 'catroot2'

# 4. Rendre a chaque service son etat de DEPART, celui du journal. Ne demarrer
#    que ceux qui etaient actifs avant l'intervention.
# Start-Service <ceux qui etaient actifs>

# 5. Verifier.
Get-ChildItem -LiteralPath $env:SystemRoot -Filter 'SoftwareDistribution*' -Directory
Get-Service wuauserv,bits,cryptsvc,msiserver | Select-Object Name,Status`,
    warning: 'Remettre les dossiers en place ne garantit PAS le retour de l’historique affiché : Windows a reconstruit sa base entre-temps, et Microsoft ne documente aucune procédure prise en charge pour cela. Les mises à jour installées, elles, n’ont jamais été touchées. Aucune étape de l’annulation ne supprime de dossier.',
  },
  checks: [
    'Aucune suppression : ni pendant l’opération, ni pendant l’annulation. Les dossiers sont renommés.',
    'La machine n’est jamais redémarrée par le script.',
    'Seuls les services RÉELLEMENT actifs sont arrêtés, et seuls ceux qui l’étaient sont redémarrés.',
    'Les services sont RELUS après la demande d’arrêt : c’est cette relecture, et non le succès de Stop-Service, qui autorise le renommage.',
    'La relecture exige le statut exact Stopped. Paused, StopPending, StartPending, ContinuePending et PausePending ne sont PAS des états arrêtés : un service suspendu ou en transition peut encore tenir ses fichiers ouverts, et le renommage reste bloqué.',
    'Si un service est déjà dans un état instable AVANT l’intervention, le mode Appliquer est bloqué d’emblée. Le script ne tente jamais de convertir ou de débloquer un service en transition : il le signale et laisse la personne décider.',
    'Le retour en arrière n’est déclaré complet que si le nom d’origine est revenu ET que la sauvegarde horodatée a disparu sous son nom. La seule présence du chemin d’origine ne suffit pas : Windows peut l’avoir recréé à côté de la sauvegarde.',
    'Le renommage est transactionnel : au premier échec, les précédents sont défaits, vérifiés, et l’opération n’est pas annoncée comme réussie.',
    'L’état de départ et l’état final de chaque service sont comparés et rapportés.',
  ],
  source: 'https://learn.microsoft.com/windows/deployment/update/windows-update-troubleshooting',
  sources: [
    { label: 'Résoudre les problèmes Windows Update', url: 'https://learn.microsoft.com/windows/deployment/update/windows-update-troubleshooting' },
    { label: 'Stop-Service', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/stop-service' },
    { label: 'Rename-Item', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/rename-item' },
    { label: 'Codes d’erreur Windows Update', url: 'https://learn.microsoft.com/windows/deployment/update/windows-update-error-reference' },
  ],
};

/**
 * 11. application-wont-start — « ça ne s'ouvre plus, rien ne se passe ».
 *
 * Le symptôme le plus vague du support, et celui où l'on perd le plus de
 * temps faute de méthode. Le script en impose une : l'exécutable existe-t-il,
 * le processus démarre-t-il puis meurt-il, que disent les journaux, le fichier
 * est-il bloqué par la zone Internet, reste-t-il de l'espace.
 *
 * Il ne LANCE jamais l'application. Un script de dépannage qui exécute un
 * binaire nommé dans un formulaire est un lanceur d'exécutable arbitraire.
 */
export const outilApplicationNeDemarrePas = {
  id: 'application-wont-start',
  icon: '◫',
  category: 'Poste de travail Windows',
  subcategory: 'Mises à jour et applications',
  title: 'Diagnostiquer une application qui ne démarre pas',
  risk: 'diagnostic',
  summary: 'Vérifie dans l’ordre : présence et signature de l’exécutable, marquage « venu d’Internet », processus déjà en cours, événements Application et Erreurs d’application, droits sur le dossier, compatibilité déclarée et espace disque. Ne lance jamais l’application.',
  fields: [
    {
      id: 'appChemin', label: 'Chemin complet de l’exécutable', default: 'C:\\Program Files\\Exemple\\exemple.exe',
      help: 'Chemin absolu. Le script le contrôle avant de s’en servir : pas de chemin vide, relatif, racine de volume ni UNC.',
    },
    {
      id: 'appProcessus', label: 'Nom du processus (sans .exe, facultatif)', default: '',
      help: 'Vide : déduit du nom de fichier. Utile quand l’exécutable lance un processus portant un autre nom.',
    },
    { id: 'appJours', label: 'Fenêtre des journaux (jours)', default: '7', help: 'Entre 1 et 90.' },
    champFormat('appFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'appChemin', validerCheminWindowsLocal(v.appChemin));
    const proc = String(v.appProcessus ?? '').trim();
    if (proc !== '' && /["`$;|&<>\\/]/.test(proc)) {
      errors.appProcessus = 'Le nom du processus ne peut contenir ni guillemet, ni barre oblique, ni caractère de commande.';
    }
    verifier(errors, 'appJours', validerEntier(v.appJours, 1, 90, 'La fenêtre'));
    verifier(errors, 'appFormat', validerFormatRapport(v.appFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const chemin = validerCheminWindowsLocal(v.appChemin).value;
    const proc = String(v.appProcessus ?? '').trim();
    const jours = validerEntier(v.appJours, 1, 90).value;

    const corps = [
      `$Chemin = ${psB64(chemin)}`,
      `$Processus = ${psB64(proc)}`,
      `$Jours = ${jours}`,
      `$KjemoFormat = ${psB64(v.appFormat)}`,
      '',
      blocContextePoste(),
      '',
      blocGardienChemin(),
      '',
      '# --- Ce que ce script ne fera jamais ---------------------------------------------------',
      "# Il ne LANCE pas l'application. Un script de depannage qui execute un binaire",
      "# nomme dans un formulaire est un lanceur d'executable arbitraire, et c'est",
      "# exactement ce qu'on ne veut pas fabriquer.",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Lancement de l''application' -Etat 'INFO' -Valeur 'jamais' -Commentaire 'Ce script observe. Lancer l''application se fait a la main, apres avoir lu ce rapport.')",
      '',
      '# --- 1. Le chemin est-il utilisable ? ---------------------------------------------------',
      "$cheminOk = Test-KjemoCheminSur -Chemin $Chemin -Role 'Executable a diagnostiquer'",
      '',
      '$fichier = $null',
      'if ($cheminOk) {',
      '  try { $fichier = Get-Item -LiteralPath $Chemin -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $fichier) {',
      "    [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Executable' -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'Le chemin est valide mais le fichier n''existe pas. Desinstallation partielle, mise a jour qui a deplace le programme, ou raccourci qui pointe vers l''ancien emplacement.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Executable' -Etat 'OK' -Valeur ([string]$fichier.FullName) -Commentaire ([string]([Math]::Round($fichier.Length / 1MB, 2)) + ' Mo · modifie le ' + [string]$fichier.LastWriteTime))",
      '    # La version du fichier : elle dit si une mise a jour est passee par la.',
      '    try {',
      '      $vi = $fichier.VersionInfo',
      '      if ($vi -and $vi.FileVersion) {',
      "        [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Version' -Etat 'INFO' -Valeur ([string]$vi.FileVersion) -Commentaire ([string]$vi.CompanyName + ' · ' + [string]$vi.FileDescription))",
      '      }',
      '    } catch { }',
      '    # La signature : une signature cassee est un fichier abime ou remplace.',
      '    $sig = $null',
      '    try { $sig = Get-AuthenticodeSignature -LiteralPath $Chemin -ErrorAction SilentlyContinue } catch { }',
      '    if ($sig) {',
      "      $etatSig = 'INFO'",
      "      $noteSig = 'Une application non signee n''est pas forcement suspecte : beaucoup d''outils internes ne le sont pas.'",
      "      if ([string]$sig.Status -eq 'Valid') { $etatSig = 'OK' ; $noteSig = 'Signature valide : le fichier n''a pas ete altere depuis sa publication.' }",
      "      elseif ([string]$sig.Status -eq 'HashMismatch') { $etatSig = 'PROBLEME' ; $noteSig = 'L''empreinte ne correspond pas a la signature : le fichier est abime ou a ete modifie. C''est une cause directe de refus de demarrage.' }",
      "      [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Signature' -Etat $etatSig -Valeur ([string]$sig.Status) -Commentaire $noteSig)",
      '    }',
      "    # La marque « venu d'Internet » : elle bloque silencieusement.",
      '    $zone = $null',
      "    try { $zone = Get-Item -LiteralPath ($Chemin + ':Zone.Identifier') -ErrorAction SilentlyContinue } catch { }",
      '    if ($zone) {',
      "      [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Marque de provenance' -Etat 'ATTENTION' -Valeur 'fichier marque comme venu d''Internet' -Commentaire 'Windows bride ou bloque ce fichier. Clic droit > Proprietes > Debloquer, ou « Unblock-File -LiteralPath <chemin> ». Ne le faire que si la provenance est sure.')",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Marque de provenance' -Etat 'OK' -Valeur 'aucune')",
      '    }',
      '  }',
      '}',
      '',
      '# --- 2. Le processus tourne-t-il deja ? -------------------------------------------------',
      "# Une application qui « ne s'ouvre pas » tourne parfois deja, sans fenetre",
      '# visible, et refuse une seconde instance. C\'est frequent, et invisible.',
      '$nomProc = $Processus',
      "if ([string]::IsNullOrWhiteSpace($nomProc) -and $fichier) { $nomProc = $fichier.BaseName }",
      'if ([string]::IsNullOrWhiteSpace($nomProc)) {',
      "  [void](Add-KjemoResultat -Categorie 'Processus' -Controle 'Nom du processus' -Etat 'IGNORE' -Valeur 'indetermine' -Commentaire 'Ni nom fourni, ni fichier lisible pour le deduire.')",
      '} else {',
      '  $instances = @()',
      '  try { $instances = @(Get-Process -Name $nomProc -ErrorAction SilentlyContinue) } catch { }',
      '  if ($instances.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Processus' -Controle ($nomProc + ' en cours') -Etat 'OK' -Valeur 0 -Commentaire 'Aucune instance ne tourne : l''application ne demarre donc pas du tout, ou elle meurt immediatement.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Processus' -Controle ($nomProc + ' en cours') -Etat 'ATTENTION' -Valeur $instances.Count -Commentaire 'L''application TOURNE DEJA, peut-etre sans fenetre visible. Beaucoup de programmes refusent alors une seconde instance et semblent « ne pas s''ouvrir ». L''assistant des processus bloques permet d''y mettre fin, apres confirmation.')",
      '    foreach ($i in ($instances | Select-Object -First 10)) {',
      "      [void](Add-KjemoResultat -Categorie 'Processus' -Controle ('PID ' + [string]$i.Id) -Etat 'INFO' -Valeur ([string]([Math]::Round($i.WorkingSet64 / 1MB)) + ' Mo') -Commentaire ('demarre le ' + [string]$i.StartTime))",
      '    }',
      '  }',
      '}',
      '',
      '# --- 3. Les journaux ---------------------------------------------------------------------',
      "# Deux sources, et la seconde est celle qu'on oublie : « Application Error »",
      "# et « Application Hang » portent le module fautif et le code d'exception.",
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Level = 1,2,3; StartTime = $depuis } -ErrorAction SilentlyContinue | Select-Object -First 100)",
      '} catch { }',
      '$pertinents = @()',
      'if ($nomProc) {',
      '  foreach ($e in $evts) {',
      '    $msg = [string]$e.Message',
      '    if ($msg -like ("*" + $nomProc + "*")) { $pertinents += $e }',
      '  }',
      '}',
      'if ($pertinents.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements nommant ' + $nomProc) -Etat 'INFO' -Valeur 0 -Commentaire 'Aucun evenement ne nomme cette application sur la fenetre demandee. Un plantage silencieux ne laisse pas toujours de trace.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements nommant ' + $nomProc) -Etat 'ATTENTION' -Valeur $pertinents.Count)",
      '  foreach ($e in ($pertinents | Select-Object -First 8)) {',
      '    $ligne = \'\'',
      '    try { $ligne = ([string]$e.Message) -replace "`r`n", " " } catch { }',
      '    if ($ligne.Length -gt 300) { $ligne = $ligne.Substring(0, 300) }',
      "    [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ([string]$e.TimeCreated) -Etat 'INFO' -Valeur ([string]$e.ProviderName + ' · ID ' + [string]$e.Id) -Commentaire $ligne)",
      '  }',
      '}',
      '',
      '# --- 4. Les droits sur le dossier ---------------------------------------------------------',
      'if ($fichier) {',
      '  $dossier = $fichier.DirectoryName',
      '  $acl = $null',
      '  try { $acl = Get-Acl -LiteralPath $dossier -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $acl) {',
      "    [void](Add-KjemoResultat -Categorie 'Droits' -Controle 'Dossier du programme' -Etat 'IGNORE' -Valeur 'non lisible' -Commentaire 'Les permissions n''ont pas pu etre lues depuis cette session.')",
      '  } else {',
      '    $lecture = $false',
      '    foreach ($regle in $acl.Access) {',
      "      if ([string]$regle.AccessControlType -eq 'Allow' -and ([string]$regle.FileSystemRights -like '*Read*' -or [string]$regle.FileSystemRights -like '*FullControl*')) { $lecture = $true }",
      '    }',
      "    [void](Add-KjemoResultat -Categorie 'Droits' -Controle 'Dossier du programme' -Etat (& { if ($lecture) { 'OK' } else { 'ATTENTION' } }) -Valeur $dossier -Commentaire ('proprietaire : ' + [string]$acl.Owner + ' · ' + [string]$acl.Access.Count + ' regle(s)'))",
      '  }',
      '',
      '  # --- 5. La compatibilite declaree -------------------------------------------------------',
      "  # Un mode de compatibilite colle a un executable survit aux mises a jour et",
      '  # provoque des refus de demarrage inexplicables.',
      '  $compat = $null',
      '  try {',
      "    $compat = Get-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers' -ErrorAction SilentlyContinue",
      '  } catch { }',
      '  if ($compat) {',
      '    $pose = $null',
      '    foreach ($nom in $compat.PSObject.Properties.Name) {',
      "      if ($nom -like 'PS*') { continue }",
      '      if ($nom -eq $fichier.FullName) { $pose = [string]$compat.$nom }',
      '    }',
      '    if ($pose) {',
      "      [void](Add-KjemoResultat -Categorie 'Compatibilite' -Controle 'Mode de compatibilite pose' -Etat 'ATTENTION' -Valeur $pose -Commentaire 'Un mode de compatibilite est colle a cet executable. Il survit aux mises a jour et provoque des refus de demarrage inexplicables. Clic droit > Proprietes > Compatibilite pour le retirer.')",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Compatibilite' -Controle 'Mode de compatibilite pose' -Etat 'OK' -Valeur 'aucun')",
      '    }',
      '  }',
      '}',
      '',
      '# --- 6. L\'espace disque -------------------------------------------------------------------',
      "# Un disque plein empeche la creation des fichiers temporaires, et beaucoup",
      "# d'applications meurent sans un mot.",
      '$sys = $null',
      "try { $sys = Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -eq $env:SystemDrive } | Select-Object -First 1 } catch { }",
      'if ($sys) {',
      '  $libreGo = [Math]::Round($sys.FreeSpace / 1GB, 1)',
      "  $etatE = 'OK'",
      "  $noteE = 'Espace suffisant.'",
      "  if ($libreGo -lt 2) { $etatE = 'PROBLEME' ; $noteE = 'Moins de 2 Go : les fichiers temporaires ne se creent plus, et beaucoup d''applications meurent sans un mot.' }",
      "  [void](Add-KjemoResultat -Categorie 'Espace' -Controle ('Volume systeme ' + [string]$sys.DeviceID) -Etat $etatE -Valeur ([string]$libreGo + ' Go libres') -Commentaire $noteE)",
      '}',
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic d\'une application qui ne demarre pas',
      outil: 'application-wont-start',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Chemin', psB64(chemin)],
        ['Processus', psB64(proc)],
        ['Jours', psB64(String(jours))],
        ['Format', psB64(v.appFormat)],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-application',
      formats: v.appFormat,
    });
  },
  gui: [
    'Gestionnaire des tâches > Détails : vérifier si le processus tourne déjà sans fenêtre visible.',
    'Clic droit sur l’exécutable > Propriétés : l’onglet Général porte le bouton « Débloquer » quand le fichier vient d’Internet.',
    'Clic droit > Propriétés > Compatibilité : décocher tout mode posé, qui survit aux mises à jour.',
    'Observateur d’événements > Journaux Windows > Application, sources « Application Error » et « Application Hang ».',
    'Lancer l’application depuis une invite de commandes : les messages d’erreur qui disparaissent avec la fenêtre y restent lisibles.',
  ],
  keywords: motsCles(
    'application ne demarre pas', 'ne s ouvre pas', 'rien ne se passe',
    'application error', 'application hang', 'plantage au demarrage',
    'unblock-file', 'mode de compatibilite', 'signature invalide',
    'processus deja en cours', 'exe introuvable',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation nécessaire pour l’essentiel. Les droits d’un dossier sous Program Files peuvent demander une console élevée.',
    'Lancer le script sous le compte qui rencontre le problème : les modes de compatibilité et les journaux applicatifs sont propres à la session.',
    'Le chemin doit être absolu et local. Le script refuse un chemin vide, relatif, racine de volume ou UNC, et le dit.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'L’application ne s’ouvre pas, et aucun événement n’apparaît dans les journaux',
      cause: 'Elle tourne déjà sans fenêtre visible et refuse une seconde instance — ou elle meurt avant d’avoir pu journaliser quoi que ce soit.',
      fix: 'Le rapport dit si le processus tourne. Si oui, y mettre fin avec l’assistant des processus bloqués, puis relancer.',
    },
    {
      message: 'La signature est en HashMismatch',
      cause: 'Le fichier a été modifié ou abîmé depuis sa publication : copie interrompue, disque défaillant, ou altération.',
      fix: 'Réinstaller l’application depuis sa source officielle. Ne pas tenter de « réparer » un exécutable dont l’empreinte ne correspond plus.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le chemin fourni est validé avant toute lecture, et un chemin refusé est rapporté comme PROBLÈME avec sa raison.',
    'Le rapport dit explicitement si le processus tourne déjà — la cause la plus souvent manquée.',
    'Aucune section ne prétend avoir lancé ou réparé l’application.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit le fichier, le registre de compatibilité, les journaux et les permissions. Il ne lance, ne débloque et ne réinstalle rien.',
    diagnostic: '# Le fichier et sa signature, tels que le script les lit :\nGet-Item -LiteralPath "C:\\Program Files\\Exemple\\exemple.exe" | Select-Object FullName,Length,LastWriteTime\nGet-AuthenticodeSignature -LiteralPath "C:\\Program Files\\Exemple\\exemple.exe" | Select-Object Status,SignerCertificate',
    command: '# Rien a annuler : aucune ecriture.\n# Si le rapport signale une marque de provenance, c\'est a la personne de decider :\n#   Unblock-File -LiteralPath <chemin>\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Ne débloquer un fichier marqué « venu d’Internet » que si sa provenance est sûre. Cette marque est une protection, et le script ne la retire jamais de lui-même.',
  },
  checks: [
    'L’application n’est jamais lancée par le script.',
    'Le chemin passe par le gardien avant toute lecture : ni vide, ni relatif, ni racine, ni UNC, ni dossier protégé.',
    'Aucun fichier n’est débloqué, modifié ni supprimé.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-authenticodesignature',
  sources: [
    { label: 'Get-AuthenticodeSignature', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-authenticodesignature' },
    { label: 'Unblock-File', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/unblock-file' },
    { label: 'Get-WinEvent', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent' },
    { label: 'Get-Process', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-process' },
  ],
};

/**
 * 12. process-hung — le processus qui ne répond plus.
 *
 * Mettre fin à un processus perd les données non enregistrées, et c'est
 * irréversible. Le script le dit, montre ce qu'il tuerait, et exige le PID
 * exact plus une confirmation écrite. Pas de nom, pas de joker : un nom peut
 * désigner douze processus, et « tuer tous les chrome » n'est pas la même
 * chose que « tuer celui qui est bloqué ».
 */
export const outilProcessusBloque = {
  id: 'process-hung',
  icon: '◐',
  category: 'Poste de travail Windows',
  subcategory: 'Mises à jour et applications',
  title: 'Diagnostiquer un processus bloqué',
  risk: 'caution',
  summary: 'Montre les processus les plus consommateurs, leur mémoire, leur temps processeur et leur état de réponse. En mode Appliquer, met fin à UN processus désigné par son PID exact, après confirmation écrite et avertissement sur les données non enregistrées. Jamais par nom, jamais plusieurs à la fois. Refuse sa propre console, les processus critiques de Windows et tout PID dont l’identité a changé depuis la lecture.',
  fields: [
    {
      id: 'prcTop', label: 'Nombre de processus affichés', default: '15',
      help: 'Entre 5 et 50, classés par mémoire décroissante.',
    },
    {
      id: 'prcPid', label: 'PID du processus à arrêter (facultatif)', default: '',
      help: 'Obligatoire en mode Appliquer. Le PID exact, lu dans le tableau du mode Diagnostic. Jamais un nom : un nom peut désigner douze processus.',
    },
    {
      id: 'prcConfirmation', label: 'Confirmation écrite (facultatif)', default: '',
      help: 'Obligatoire en mode Appliquer. Retaper exactement : JE PERDS LES DONNEES NON ENREGISTREES',
    },
    champMode('Diagnostic liste et n’arrête rien. Appliquer met fin au seul processus dont le PID est donné, après confirmation.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'prcTop', validerEntier(v.prcTop, 5, 50, 'Le nombre de processus'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    const estAppliquer = String(v.mode ?? '') === 'Appliquer';
    const pid = String(v.prcPid ?? '').trim();
    if (estAppliquer) {
      if (pid === '') {
        errors.prcPid = 'En mode Appliquer, le PID exact du processus est obligatoire. Le lire dans le tableau du mode Diagnostic.';
      } else {
        const r = validerEntier(pid, 1, 4294967295, 'Le PID');
        if (!r.ok) errors.prcPid = r.error;
        else if (r.value <= 4) {
          errors.prcPid = 'Les PID 0 à 4 sont ceux du noyau et du système. Y mettre fin provoque un écran bleu immédiat : refusé.';
        }
      }
      if (String(v.prcConfirmation ?? '').trim() !== 'JE PERDS LES DONNEES NON ENREGISTREES') {
        errors.prcConfirmation = 'Mettre fin à un processus perd les données non enregistrées, sans récupération possible. Pour le faire, retaper exactement : JE PERDS LES DONNEES NON ENREGISTREES';
      }
    } else if (pid !== '') {
      const r = validerEntier(pid, 1, 4294967295, 'Le PID');
      if (!r.ok) errors.prcPid = r.error;
    }
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const top = validerEntier(v.prcTop, 5, 50).value;
    const pidTexte = String(v.prcPid ?? '').trim();
    const pid = pidTexte === '' ? 0 : validerEntier(pidTexte, 1, 4294967295).value;
    const confirme = String(v.prcConfirmation ?? '').trim() === 'JE PERDS LES DONNEES NON ENREGISTREES';

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Top = ${top}`,
      `$Cible = ${pid}`,
      `$ConfirmationOk = ${confirme ? '$true' : '$false'}`,
      "$KjemoFormat = 'Console'",
      '',
      blocContextePoste(),
      '',
      '# --- Ce que « mettre fin a un processus » veut dire -------------------------------------',
      "Write-Host ''",
      "Write-Host '=== A LIRE AVANT D''APPLIQUER ==='",
      "Write-Host 'Mettre fin a un processus l''arrete NET. Il n''a pas le temps'",
      "Write-Host 'd''enregistrer : tout ce qui n''a pas ete sauvegarde est perdu, et ne se'",
      "Write-Host 'recupere pas. Un document, un courriel en cours de redaction, un fichier'",
      "Write-Host 'en cours d''ecriture peuvent aussi rester a moitie ecrits.'",
      "Write-Host 'Avant d''en arriver la : attendre un peu. Une application « qui ne repond'",
      "Write-Host 'pas » revient souvent toute seule au bout de quelques dizaines de secondes.'",
      "[void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Donnees non enregistrees' -Etat 'ATTENTION' -Valeur 'perdues sans recuperation' -Commentaire 'Un processus arrete net n''enregistre rien. Attendre quelques dizaines de secondes avant d''en arriver la : beaucoup d''applications reviennent toutes seules.')",
      '',
      '# --- 1. Les processus les plus consommateurs -------------------------------------------',
      '$procs = @()',
      'try { $procs = @(Get-Process -ErrorAction SilentlyContinue | Sort-Object WorkingSet64 -Descending | Select-Object -First $Top) } catch { }',
      'if ($procs.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Processus' -Controle 'Processus lus' -Etat 'PROBLEME' -Valeur 0 -Commentaire 'Get-Process n''a rien renvoye.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Processus' -Controle 'Processus affiches' -Etat 'INFO' -Valeur $procs.Count -Commentaire 'Classes par memoire decroissante. Le PID de la colonne est celui a reporter dans le formulaire.')",
      '  foreach ($p in $procs) {',
      '    $mo = [Math]::Round($p.WorkingSet64 / 1MB)',
      '    $cpu = 0',
      '    try { if ($p.CPU) { $cpu = [Math]::Round($p.CPU, 1) } } catch { }',
      "    $repond = 'inconnu'",
      '    try {',
      "      if ($p.MainWindowHandle -ne 0) { if ($p.Responding) { $repond = 'repond' } else { $repond = 'NE REPOND PAS' } }",
      "      else { $repond = 'sans fenetre' }",
      '    } catch { }',
      "    $etatP = 'INFO'",
      "    if ($repond -eq 'NE REPOND PAS') { $etatP = 'ATTENTION' }",
      '    $depart = \'\'',
      '    try { $depart = [string]$p.StartTime } catch { }',
      "    [void](Add-KjemoResultat -Categorie 'Processus' -Controle ('PID ' + [string]$p.Id + ' — ' + [string]$p.ProcessName) -Etat $etatP -Valeur ([string]$mo + ' Mo · ' + [string]$cpu + ' s CPU') -Commentaire ($repond + ' · demarre le ' + $depart))",
      '  }',
      '}',
      '',
      '# --- 2. La cible, si elle est nommee ----------------------------------------------------',
      "# On resout le PID AVANT toute action, et on montre ce qu'on arreterait. Un",
      "# PID se recycle : celui qu'on a lu il y a dix minutes peut designer autre",
      '# chose maintenant.',
      '$cibleProc = $null',
      '$cibleResolue = $false',
      'if ($Cible -gt 0) {',
      '  try { $cibleProc = Get-Process -Id $Cible -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $cibleProc) {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle ('PID ' + [string]$Cible) -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'Aucun processus ne porte ce PID. Il s''est termine tout seul, ou le PID a ete mal recopie.')",
      '  } else {',
      '    $cibleResolue = $true',
      '    $moC = [Math]::Round($cibleProc.WorkingSet64 / 1MB)',
      '    $chemC = \'\'',
      '    try { $chemC = [string]$cibleProc.Path } catch { }',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle ('PID ' + [string]$Cible + ' — ' + [string]$cibleProc.ProcessName) -Etat 'INFO' -Valeur ([string]$moC + ' Mo') -Commentaire ('C''est CE processus qui serait arrete. Chemin : ' + $chemC))",
      "    # Les processus enfants : les arreter n'est pas automatique, et il vaut",
      "    # mieux savoir qu'ils existent.",
      '    $enfants = @()',
      '    try {',
      '      $enfants = @(Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ParentProcessId -eq $Cible })',
      '    } catch { }',
      '    if ($enfants.Count -gt 0) {',
      "      [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Processus enfants' -Etat 'ATTENTION' -Valeur $enfants.Count -Commentaire 'Ce processus a des enfants. Ils ne seront PAS arretes par ce script : il n''arrete qu''un seul processus, celui du PID donne. Les enfants peuvent survivre, ou mourir avec leur parent selon l''application.')",
      '      foreach ($en in ($enfants | Select-Object -First 10)) {',
      "        [void](Add-KjemoResultat -Categorie 'Cible' -Controle ('Enfant PID ' + [string]$en.ProcessId) -Etat 'INFO' -Valeur ([string]$en.Name))",
      '      }',
      '    }',
      '  }',
      '}',
      '',
      '# --- 3. Les verrous -----------------------------------------------------------------------',
      "# Sept conditions, toutes necessaires. Les trois dernieres viennent de",
      '# defauts reels, pas de precautions theoriques.',
      '$cibleHorsSysteme = ($Cible -gt 4)',
      '',
      "# a) Le script ne doit jamais arreter SA PROPRE console. $PID est le PID du",
      "#    moteur PowerShell qui execute ce script : s'arreter soi-meme ferme la",
      '#    fenetre, emporte le diagnostic, et laisse la personne sans rien.',
      '$cibleNEstPasMoi = ($Cible -ne $PID)',
      'if (-not $cibleNEstPasMoi) {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Auto-protection' -Etat 'PROBLEME' -Valeur ('PID ' + [string]$Cible + ' = cette console') -Commentaire 'Le PID demande est celui du moteur PowerShell qui execute ce script. S''arreter soi-meme fermerait la fenetre et emporterait le diagnostic : refuse.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Auto-protection' -Etat 'OK' -Valeur ('cette console est le PID ' + [string]$PID) -Commentaire 'La cible est un autre processus.')",
      '}',
      '',
      "# b) Les processus critiques de Windows. Leur PID est ordinaire — lsass,",
      "#    csrss ou winlogon n'ont rien de special de ce cote — mais y mettre fin",
      '#    provoque un ecran bleu ou une deconnexion immediate. Cette liste est',
      "#    une BARRIERE SUPPLEMENTAIRE, pas une garantie : elle n'est pas",
      "#    exhaustive, et un processus qui n'y figure pas peut etre tout aussi",
      '#    vital pour cette machine-la.',
      `$ProcessusProteges = @(${PROCESSUS_PROTEGES.map((n) => `'${n}'`).join(', ')})`,
      '$cibleNonProtegee = $true',
      'if ($cibleResolue) {',
      '  $nomCible = [string]$cibleProc.ProcessName',
      '  foreach ($protege in $ProcessusProteges) {',
      '    if ($nomCible -ieq $protege) { $cibleNonProtegee = $false }',
      '  }',
      '  if (-not $cibleNonProtegee) {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Processus protege' -Etat 'PROBLEME' -Valeur $nomCible -Commentaire 'Processus critique de Windows. Y mettre fin provoque un ecran bleu ou une deconnexion immediate. Refuse meme avec confirmation et console elevee. Cette liste n''est pas exhaustive : un processus absent peut etre tout aussi vital.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Processus protege' -Etat 'OK' -Valeur ($nomCible + ' ne figure pas dans la liste de refus') -Commentaire 'Barriere supplementaire, non exhaustive : elle ne remplace pas le jugement de la personne.')",
      '  }',
      '}',
      '',
      '$conditionsAppliquer = ($Cible -gt 0) -and $cibleResolue -and $cibleHorsSysteme -and $cibleNEstPasMoi -and $cibleNonProtegee -and $ConfirmationOk',
      '',
      "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {",
      '  $manquants = @()',
      "  if ($Cible -le 0) { $manquants += 'aucun PID fourni' }",
      "  elseif (-not $cibleResolue) { $manquants += 'le PID ' + [string]$Cible + ' ne correspond a aucun processus en cours' }",
      "  if (-not $cibleHorsSysteme) { $manquants += 'PID systeme (0 a 4) : y mettre fin provoque un ecran bleu' }",
      "  if (-not $cibleNEstPasMoi) { $manquants += 'le PID demande est celui de CETTE console PowerShell' }",
      "  if (-not $cibleNonProtegee) { $manquants += 'processus critique de Windows, present dans la liste de refus' }",
      "  if (-not $ConfirmationOk) { $manquants += 'confirmation ecrite absente' }",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Conditions prealables' -Etat 'PROBLEME' -Valeur ($manquants -join ' ; ') -Commentaire 'Le mode Appliquer exige toutes les conditions a la fois.')",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Arret du processus' -Etat 'IGNORE' -Valeur 'bloque' -Commentaire 'Aucun processus n''a ete arrete.')",
      "  Write-Host ''",
      "  Write-Host '--- Arret BLOQUE ---'",
      '  foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "} elseif ($Mode -eq 'Appliquer') {",
      '',
      "  # c) La course au recyclage du PID. Entre la lecture du tableau et",
      "  #    l'execution, le processus peut s'etre termine et son PID avoir ete",
      '  #    reattribue a un autre. On RELIT donc juste avant d\'agir, et on',
      "  #    compare l'identite — nom et heure de demarrage — a celle relevee a la",
      '  #    premiere lecture. Si elle a change, on n\'arrete rien.',
      '  $nomAvant = [string]$cibleProc.ProcessName',
      '  $departAvant = $null',
      '  try { $departAvant = $cibleProc.StartTime } catch { }',
      '',
      '  $relu = $null',
      '  try { $relu = Get-Process -Id $Cible -ErrorAction SilentlyContinue } catch { }',
      '  $identiteStable = $false',
      '  if (-not $relu) {',
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Identite juste avant l''arret' -Etat 'PROBLEME' -Valeur 'processus disparu' -Commentaire 'Le processus s''est termine entre la lecture et l''action. Il n''y a plus rien a arreter — et le PID peut deja designer autre chose.')",
      '  } else {',
      '    $nomRelu = [string]$relu.ProcessName',
      '    $departRelu = $null',
      '    try { $departRelu = $relu.StartTime } catch { }',
      '    $memeNom = ($nomRelu -ieq $nomAvant)',
      '',
      "    # Par defaut FAUX, et non vrai. Si l''heure de demarrage n''est pas",
      "    # lisible \u2014 d''un cote ou de l''autre \u2014 l''identite n''est pas",
      '    # confirmee, elle est INCONNUE. Deux processus de meme nom se',
      "    # confondraient alors. Dans le doute, on n''arrete rien.",
      '    $memeDepart = $false',
      '    $departLisible = (($null -ne $departAvant) -and ($null -ne $departRelu))',
      '    if ($departLisible) { $memeDepart = ($departRelu -eq $departAvant) }',
      '    if ($memeNom -and $memeDepart) {',
      '      $identiteStable = $true',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Identite juste avant l''arret' -Etat 'OK' -Valeur ($nomRelu + ' \u00b7 demarre le ' + [string]$departRelu) -Commentaire 'Meme nom, meme heure de demarrage : c''est bien le processus vu dans le tableau.')",
      '    } elseif (-not $departLisible) {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Identite juste avant l''arret' -Etat 'PROBLEME' -Valeur 'heure de demarrage illisible' -Commentaire 'Identite du processus impossible a confirmer : l''heure de demarrage n''a pas pu etre lue. Le nom seul ne suffit pas, deux processus peuvent le partager. Aucun arret ne sera tente. Relancer dans une console elevee, qui lit StartTime sur davantage de processus.')",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Identite juste avant l''arret' -Etat 'PROBLEME' -Valeur ($nomAvant + ' -> ' + $nomRelu) -Commentaire ('Le PID ' + [string]$Cible + ' ne designe plus le meme processus : il a ete recycle entre la lecture et l''action. Relancer le diagnostic pour obtenir un PID a jour.'))",
      '    }',
      '  }',
      '',
      '  if (-not $identiteStable) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Arret du processus' -Etat 'IGNORE' -Valeur 'bloque' -Commentaire 'L''identite du processus n''a pas pu etre confirmee juste avant l''action : disparu, recycle, ou heure de demarrage illisible. Aucun arret n''a ete tente. Un PID recycle arrete revient a tuer un processus au hasard, et une identite a moitie verifiee ne vaut pas mieux.')",
      "    Write-Host ''",
      "    Write-Host '--- Arret BLOQUE : identite du processus non confirmee ---'",
      "    Write-Host 'Relancer le diagnostic pour obtenir un PID a jour.'",
      '  } else {',
      "  Write-Host ''",
      "  Write-Host '--- Arret du processus ---'",
      '  try {',
      '    Stop-Process -Id $Cible -ErrorAction Stop',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Arret du PID ' + [string]$Cible) -Etat 'OK' -Valeur $nomAvant)",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle ('Arret du PID ' + [string]$Cible) -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message) -Commentaire 'Un processus systeme ou appartenant a un autre utilisateur demande une console elevee.')",
      '  }',
      '  Start-Sleep -Seconds 2',
      '  $survivant = $null',
      '  try { $survivant = Get-Process -Id $Cible -ErrorAction SilentlyContinue } catch { }',
      '  if ($survivant) {',
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Processus apres action' -Etat 'PROBLEME' -Valeur 'toujours present' -Commentaire 'Le processus resiste. Souvent un pilote ou une operation d''entree-sortie bloquee : seul un redemarrage le reglera, et ce script ne redemarre pas la machine.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Processus apres action' -Etat 'OK' -Valeur 'termine' -Commentaire ($nomAvant + ' n''est plus en cours.'))",
      '  }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      '  if ($conditionsAppliquer) {',
      "    Write-Host ('En mode Appliquer, le script arreterait le PID ' + [string]$Cible + ' et lui seul.')",
      "    Write-Host 'Aucun autre processus ne serait touche, enfants compris.'",
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'INFO' -Valeur ('arreterait le PID ' + [string]$Cible))",
      '  } else {',
      "    Write-Host 'En mode Appliquer, le script SERAIT BLOQUE et n''arreterait rien.'",
      "    if ($Cible -le 0) { Write-Host '  - aucun PID fourni' }",
      "    elseif (-not $cibleResolue) { Write-Host '  - le PID donne ne correspond a aucun processus' }",
      "    if (-not $cibleHorsSysteme) { Write-Host '  - PID systeme (0 a 4) : refuse' }",
      "    if (-not $cibleNEstPasMoi) { Write-Host '  - le PID demande est celui de CETTE console PowerShell : refuse' }",
      "    if (-not $cibleNonProtegee) { Write-Host '  - processus critique de Windows, present dans la liste de refus' }",
      "    if (-not $ConfirmationOk) { Write-Host '  - confirmation ecrite absente' }",
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'PROBLEME' -Valeur 'serait bloque')",
      '  }',
      '}',
      '',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Nombre de processus arretes' -Etat 'INFO' -Valeur 'un au maximum' -Commentaire 'Ce script n''arrete jamais plusieurs processus, et jamais par nom. « Arreter tous les chrome » n''est pas la meme chose qu''arreter celui qui est bloque.')",
      blocModeDiagnostic(),
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];

    return assembler({
      titre: 'Diagnostic d\'un processus bloque',
      outil: 'process-hung',
      diagnostic: v.mode !== 'Appliquer',
      admin: false,
      parametres: [
        ['Mode', psB64(v.mode)],
        ['Top', psB64(String(top))],
        ['Cible', psB64(String(pid))],
      ],
      corps,
      version: VERSION_POSTE,
      prefixeFichier: 'kjemo-poste-processus',
      formats: 'Console',
    });
  },
  gui: [
    'Gestionnaire des tâches > Détails : la colonne PID, et « Fin de tâche » par clic droit.',
    'Ajouter la colonne « Mémoire » et trier dessus pour trouver le processus qui pèse.',
    'Attendre quelques dizaines de secondes avant de forcer : une application « qui ne répond pas » revient souvent seule.',
    'Moniteur de ressources > onglet UC > « Analyser la chaîne d’attente » montre ce qui bloque un processus.',
    'Gestionnaire des tâches > Démarrage : pour un processus qui revient à chaque démarrage.',
  ],
  keywords: motsCles(
    'processus bloque', 'ne repond pas', 'stop-process', 'fin de tache',
    'application figee', 'pid', 'memoire', 'cpu', 'gestionnaire des taches',
    'tuer un processus', 'programme fige', 'processus protege', 'pid recycle',
    'lsass', 'csrss', 'winlogon', 'svchost', 'ecran bleu', 'heure de demarrage',
  ),
  requiresAdmin: true,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Le diagnostic se lit sans élévation. Arrêter un processus appartenant à un autre utilisateur ou au système en demande une.',
    'Le PID se lit dans le tableau du mode Diagnostic, et se recopie tel quel. Un PID se recycle : relancer le diagnostic si quelques minutes ont passé.',
    'Prévenir la personne : les données non enregistrées du processus seront perdues.',
    'Le script écarte les processus critiques de Windows par une liste de refus. Cette liste n’est pas exhaustive : avant de valider un PID, vérifier dans le tableau à quelle application il correspond vraiment.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: 'Le processus est toujours là après Stop-Process',
      cause: 'Il est bloqué dans une opération d’entrée-sortie au niveau du noyau, souvent sur un pilote ou un partage réseau injoignable.',
      fix: 'Aucune commande n’en viendra à bout : seul un redémarrage le réglera. Ce script ne redémarre pas la machine, et le rapport le dit.',
    },
    {
      message: 'Accès refusé en voulant arrêter le processus',
      cause: 'Il appartient à un autre utilisateur, ou au système.',
      fix: 'Relancer dans une console administrateur. Et vérifier qu’il s’agit bien du bon processus : un PID se recycle.',
    },
    {
      message: '« Arret BLOQUE : le PID ne designe plus le meme processus »',
      cause: 'Entre le diagnostic et l’application, le processus s’est terminé et Windows a réattribué son PID à un autre. C’est fréquent sur un poste chargé.',
      fix: 'Relancer le mode Diagnostic pour obtenir un PID à jour, puis recommencer. Ne pas réutiliser le PID de la session précédente.',
    },
    {
      message: '« Processus protege » : le script refuse une cible pourtant visible dans le gestionnaire',
      cause: 'Le nom figure dans la liste de refus des processus critiques de Windows. Y mettre fin provoquerait un écran bleu ou une déconnexion immédiate.',
      fix: 'Ne pas chercher à contourner. Un processus critique figé se traite par un redémarrage propre de la machine, décidé et annoncé — pas par Stop-Process.',
    },
    {
      message: '« Identite du processus impossible a confirmer » alors que le processus est bien là',
      cause: 'L’heure de démarrage du processus n’a pas pu être lue. C’est fréquent sur un processus appartenant à un autre utilisateur ou au système, depuis une console non élevée.',
      fix: 'Relancer dans une console administrateur, qui lit StartTime sur bien davantage de processus. Le script refuse délibérément d’agir sur une identité à moitié vérifiée : le nom seul ne distingue pas deux processus homónymes.',
    },
    {
      message: 'svchost refusé alors qu’il consomme toute la mémoire',
      cause: 'Un processus svchost héberge un ou plusieurs services Windows. L’arrêter coupe ces services d’un coup, sans que personne sache lesquels.',
      fix: 'Identifier le service fautif — Gestionnaire des tâches > Détails > clic droit > « Aller aux services » — puis agir sur CE service, pas sur son hôte. Un assistant généraliste n’a pas à proposer d’arrêter svchost.',
    },
    {
      message: 'Le script refuse le PID donné en disant que c’est « cette console »',
      cause: 'Le PID saisi est celui du moteur PowerShell qui exécute le script.',
      fix: 'C’est voulu : s’arrêter soi-même fermerait la fenêtre et emporterait le diagnostic. Relire le tableau et reprendre le PID de l’application visée.',
    },
  ]),
  reversible: false,
  verifyAfter: [
    'Le rapport montre le processus visé — nom et chemin — avant d’y toucher.',
    'Avant l’action, le script relit le processus et compare son identité à celle du tableau : même nom, même heure de démarrage. Le rapport porte la ligne « Identite juste avant l’arret ».',
    'Après l’action, le script relit le PID et dit si le processus a réellement disparu.',
    'Un seul processus est arrêté, jamais ses enfants, et le rapport le dit.',
  ],
  rollback: {
    summary: 'Un processus arrêté ne se « rétablit » pas : il se relance. Les données non enregistrées sont perdues, définitivement. C’est pour cela que la confirmation écrite porte précisément là-dessus.',
    diagnostic: '# Le processus est-il encore la ?\nGet-Process -Id <PID> -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path,Responding',
    command: '# Rien a « annuler » : on relance l\'application, a la main.\n# Beaucoup d\'applications proposent une recuperation de document au redemarrage :\n# les rouvrir d\'abord, avant de recreer quoi que ce soit.\nWrite-Host \'Relancer l\'\'application a la main. Verifier si elle propose une recuperation.\'',
    warning: 'Cette action est IRRÉVERSIBLE pour les données non enregistrées. Les PID 0 à 4 sont refusés par la validation, le PID de la console elle-même est refusé par le script, et les processus critiques de Windows sont écartés par une liste de refus non exhaustive : y mettre fin provoque un écran bleu immédiat.',
  },
  checks: [
    'Un seul processus au maximum est arrêté, désigné par son PID exact, jamais par un nom ni un joker.',
    'Les PID 0 à 4 sont refusés par la validation du formulaire, avant même la génération.',
    'Le script refuse de s’arrêter lui-même : si le PID visé est celui de la console qui l’exécute ($PID), le verrou bloque et aucun arrêt n’est tenté.',
    'Une liste de refus explicite, comparée sans tenir compte de la casse, écarte les processus critiques de Windows (System, Registry, smss, csrss, wininit, winlogon, services, lsass, fontdrvhost, dwm, svchost et quelques autres). Cette liste est une barrière supplémentaire, elle n’est PAS exhaustive : un processus qui n’y figure pas peut être tout aussi vital.',
    'Juste avant Stop-Process, le processus est relu et son identité comparée — nom ET heure de démarrage. S’il a disparu ou si le PID a été recyclé, le script produit PROBLEME puis IGNORE et n’effectue aucun Stop-Process.',
    'L’heure de démarrage est OBLIGATOIRE, pas facultative : si elle n’est lisible ni à la première lecture ni à la seconde, l’identité est tenue pour non confirmée et le script refuse d’agir. Le nom seul ne suffit pas, deux processus peuvent le partager.',
    'Les processus enfants ne sont jamais arrêtés : le rapport signale leur existence.',
    'La machine n’est jamais redémarrée.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/stop-process',
  sources: [
    { label: 'Stop-Process', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/stop-process' },
    { label: 'Get-Process', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-process' },
    { label: 'Win32_Process', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-process' },
  ],
};

// ---------------------------------------------------------------------------
// Catalogue du lot. L'ordre est stable : il fixe les routes directes.
// ---------------------------------------------------------------------------
export const toolsPoste = [
  outilSantePoste,
  outilInventairePoste,
  outilDiagnosticAudio,
  outilDiagnosticMicrophone,
  outilDiagnosticWebcam,
  outilDiagnosticBluetooth,
  outilDiagnosticEcran,
  outilAuditPilotes,
  outilDiagnosticWindowsUpdate,
  outilReparationWindowsUpdate,
  outilApplicationNeDemarrePas,
  outilProcessusBloque,
];
