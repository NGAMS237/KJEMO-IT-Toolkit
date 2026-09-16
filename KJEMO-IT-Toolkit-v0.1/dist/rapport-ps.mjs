/**
 * rapport-ps.mjs — LOT 2 · KJEMO IT Toolkit
 * -------------------------------------------
 * Fragments PowerShell communs aux outils Windows Server : en-tête de script,
 * collecte des résultats, et export du rapport en console, JSON, HTML ou CSV.
 *
 * Ce module n'écrit pas de PowerShell « intelligent » : il fournit un socle
 * identique d'un outil à l'autre, pour que quelqu'un qui a lu un script de ce
 * lot reconnaisse immédiatement la structure du suivant.
 *
 * Contraintes respectées par tout ce qui est produit ici :
 *   - Windows PowerShell 5.1 : pas d'opérateur ternaire, pas de « ?? », pas de
 *     `ForEach-Object -Parallel`, pas de `Join-String`.
 *   - Aucune modification du système : ces fragments observent et rapportent.
 *   - Aucun secret dans le rapport : mots de passe, jetons et informations
 *     d'identification n'y entrent jamais, et rien ici ne lit de tels champs.
 *
 * Aucune dépendance : ce module n'importe rien.
 */

/** Version du catalogue d'outils, reportée dans chaque rapport généré. */
export const VERSION_OUTILS = 'LOT 2 — 2.0.0';

/**
 * En-tête commun : ce que fait le script, ce qu'il ne fait pas, et les
 * variables de contexte utilisées par le rapport.
 *
 * `#Requires -Version 5.1` documente le plancher réellement visé plutôt que de
 * laisser croire que n'importe quelle console fera l'affaire.
 */
export function enteteScript({ titre, outil, diagnostic = true, admin = true }) {
  const lignes = [
    '#Requires -Version 5.1',
    '',
    `# ${titre}`,
    `# Outil KJEMO : ${outil} — ${VERSION_OUTILS}`,
    '#',
    diagnostic
      ? '# Ce script OBSERVE. Dans son mode par défaut il ne modifie rien.'
      : '# Ce script peut MODIFIER la configuration : lis-le en entier avant de le lancer.',
    admin
      ? '# Console PowerShell en tant qu’administrateur requise.'
      : '# Une console PowerShell standard suffit pour la partie diagnostic.',
    '#',
    '# Relis le script avant exécution. Rien ici ne télécharge de code, ne',
    '# contacte un serveur tiers, ni ne manipule d’identifiants.',
    '',
    '$ErrorActionPreference = \'Continue\'',
    `$KjemoOutil = '${outil}'`,
    `$KjemoVersion = '${VERSION_OUTILS}'`,
    '$KjemoDebut = Get-Date',
    '$KjemoResultats = New-Object System.Collections.ArrayList',
    '$KjemoAvertissements = New-Object System.Collections.ArrayList',
  ];
  return lignes.join('\n');
}

/**
 * Fonctions de collecte. Un contrôle produit toujours la même forme d'objet :
 * catégorie, contrôle, état, valeur, commentaire. C'est ce qui permet au même
 * jeu de données d'alimenter la console, le JSON, le HTML et le CSV sans
 * retraitement.
 *
 * États : OK, ATTENTION, PROBLEME, INFO, IGNORE.
 */
export function fonctionsRapport() {
  return [
    'function Add-KjemoResultat {',
    '  param(',
    '    [Parameter(Mandatory=$true)][string]$Categorie,',
    '    [Parameter(Mandatory=$true)][string]$Controle,',
    '    [ValidateSet(\'OK\',\'ATTENTION\',\'PROBLEME\',\'INFO\',\'IGNORE\')][string]$Etat = \'INFO\',',
    '    $Valeur = \'\',',
    '    [string]$Commentaire = \'\'',
    '  )',
    '  $texte = \'\'',
    '  if ($null -ne $Valeur) { $texte = ($Valeur | Out-String).Trim() }',
    '  $ligne = [pscustomobject]@{',
    '    Categorie    = $Categorie',
    '    Controle     = $Controle',
    '    Etat         = $Etat',
    '    Valeur       = $texte',
    '    Commentaire  = $Commentaire',
    '    Horodatage   = (Get-Date).ToString(\'s\')',
    '  }',
    '  [void]$KjemoResultats.Add($ligne)',
    '  if ($Etat -eq \'ATTENTION\' -or $Etat -eq \'PROBLEME\') {',
    '    [void]$KjemoAvertissements.Add(("[$Etat] $Categorie / $Controle : $Commentaire").Trim())',
    '  }',
    '  return $ligne',
    '}',
    '',
    '# Exécute un contrôle en capturant proprement son échec : un cmdlet absent',
    '# ou un accès refusé doit apparaître dans le rapport, pas interrompre le',
    '# diagnostic en cours.',
    'function Invoke-KjemoControle {',
    '  param(',
    '    [Parameter(Mandatory=$true)][string]$Categorie,',
    '    [Parameter(Mandatory=$true)][string]$Controle,',
    '    [Parameter(Mandatory=$true)][scriptblock]$Action,',
    '    [string]$Commentaire = \'\'',
    '  )',
    '  try {',
    '    $valeur = & $Action',
    '    if ($null -eq $valeur -or ($valeur -is [string] -and $valeur -eq \'\')) {',
    '      return Add-KjemoResultat -Categorie $Categorie -Controle $Controle -Etat \'INFO\' -Valeur \'(aucun résultat)\' -Commentaire $Commentaire',
    '    }',
    '    return Add-KjemoResultat -Categorie $Categorie -Controle $Controle -Etat \'OK\' -Valeur $valeur -Commentaire $Commentaire',
    '  } catch {',
    '    return Add-KjemoResultat -Categorie $Categorie -Controle $Controle -Etat \'ATTENTION\' -Valeur $_.Exception.Message -Commentaire \'Contrôle non exécutable sur cette machine.\'',
    '  }',
    '}',
  ].join('\n');
}

/**
 * Bloc d'export final. `$KjemoFormat` décide de la sortie ; le dossier de
 * destination est le bureau de l'utilisateur courant, jamais un partage réseau.
 *
 * Le rapport contient l'horodatage, la machine, la version du système, les
 * paramètres NON SENSIBLES du diagnostic, les contrôles, leurs résultats, les
 * avertissements, une conclusion et la version de l'outil. Il ne contient
 * jamais de mot de passe, de jeton, d'information d'identification ni de
 * contenu de fichier utilisateur.
 */
export function blocExportRapport({ prefixeFichier, formats = 'Console, JSON, HTML, CSV' }) {
  return [
    '',
    '# ---------------------------------------------------------------------------',
    `# Rapport — formats disponibles : ${formats}`,
    '# Le rapport ne contient aucun mot de passe, jeton ni identifiant.',
    '# ---------------------------------------------------------------------------',
    '$KjemoFin = Get-Date',
    '$KjemoSysteme = \'(inconnu)\'',
    'try { $KjemoSysteme = (Get-CimInstance Win32_OperatingSystem).Caption } catch { }',
    '$KjemoConclusion = \'Aucun problème détecté par les contrôles exécutés.\'',
    'if ($KjemoAvertissements.Count -gt 0) {',
    '  $KjemoConclusion = "$($KjemoAvertissements.Count) point(s) à examiner — voir la section Avertissements."',
    '}',
    '',
    '$KjemoRapport = [pscustomobject]@{',
    '  Outil          = $KjemoOutil',
    '  Version        = $KjemoVersion',
    '  Machine        = $env:COMPUTERNAME',
    '  Systeme        = $KjemoSysteme',
    '  Debut          = $KjemoDebut.ToString(\'s\')',
    '  Fin            = $KjemoFin.ToString(\'s\')',
    '  Parametres     = $KjemoParametres',
    '  Controles      = @($KjemoResultats)',
    '  Avertissements = @($KjemoAvertissements)',
    '  Conclusion     = $KjemoConclusion',
    '}',
    '',
    '# Console — toujours affichée, quel que soit le format demandé.',
    'Write-Host \'\'',
    'Write-Host "=== $KjemoOutil - $($env:COMPUTERNAME) ==="',
    '$KjemoResultats | Format-Table Categorie,Controle,Etat,Commentaire -AutoSize',
    'if ($KjemoAvertissements.Count -gt 0) {',
    '  Write-Host \'\'',
    '  Write-Host \'--- Avertissements ---\'',
    '  $KjemoAvertissements | ForEach-Object { Write-Host $_ }',
    '}',
    'Write-Host \'\'',
    'Write-Host "Conclusion : $KjemoConclusion"',
    '',
    'if ($KjemoFormat -ne \'Console\') {',
    '  $KjemoDossier = Join-Path $env:USERPROFILE \'Desktop\'',
    '  if (-not (Test-Path -LiteralPath $KjemoDossier)) { $KjemoDossier = $env:USERPROFILE }',
    `  $KjemoBase = Join-Path $KjemoDossier ('${prefixeFichier}-' + $env:COMPUTERNAME + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))`,
    '',
    '  if ($KjemoFormat -eq \'JSON\') {',
    '    $KjemoRapport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath ($KjemoBase + \'.json\') -Encoding UTF8',
    '    Write-Host "Rapport JSON : $($KjemoBase).json"',
    '  }',
    '  elseif ($KjemoFormat -eq \'CSV\') {',
    '    $KjemoResultats | Export-Csv -LiteralPath ($KjemoBase + \'.csv\') -NoTypeInformation -Encoding UTF8',
    '    Write-Host "Rapport CSV : $($KjemoBase).csv"',
    '  }',
    '  elseif ($KjemoFormat -eq \'HTML\') {',
    '    $entete = @"',
    '<style>',
    'body { font-family: Segoe UI, sans-serif; margin: 24px; }',
    'table { border-collapse: collapse; width: 100%; }',
    'th, td { border: 1px solid #d0d4e4; padding: 6px 9px; text-align: left; vertical-align: top; }',
    'th { background: #eef0f8; }',
    '.meta { color: #444; font-size: 13px; }',
    '</style>',
    '"@',
    '    $avant = "<h1>$KjemoOutil</h1><p class=\'meta\'>Machine : $($env:COMPUTERNAME)<br/>Système : $KjemoSysteme<br/>Début : $($KjemoDebut.ToString(\'s\'))<br/>Version de l\'outil : $KjemoVersion</p>"',
    '    $apres = "<h2>Conclusion</h2><p>$KjemoConclusion</p>"',
    '    if ($KjemoAvertissements.Count -gt 0) {',
    '      $apres = $apres + \'<h2>Avertissements</h2><ul>\' + (($KjemoAvertissements | ForEach-Object { \'<li>\' + [System.Security.SecurityElement]::Escape($_) + \'</li>\' }) -join \'\') + \'</ul>\'',
    '    }',
    '    $KjemoResultats | ConvertTo-Html -Property Categorie,Controle,Etat,Valeur,Commentaire -Head $entete -PreContent $avant -PostContent $apres |',
    '      Set-Content -LiteralPath ($KjemoBase + \'.html\') -Encoding UTF8',
    '    Write-Host "Rapport HTML : $($KjemoBase).html"',
    '  }',
    '}',
  ].join('\n');
}

/**
 * Bloc de paramètres du rapport. Seules des valeurs non sensibles y entrent :
 * noms de serveurs, adresses, options de diagnostic.
 */
export function blocParametres(paires) {
  const lignes = ['', '# Paramètres du diagnostic, repris dans le rapport (aucune donnée sensible).',
    '$KjemoParametres = [pscustomobject]@{'];
  for (const [cle, expr] of paires) {
    lignes.push(`  ${cle} = ${expr}`);
  }
  lignes.push('}');
  return lignes.join('\n');
}

/**
 * Garde de mode : un outil modifiant ne modifie rien tant que l'utilisateur
 * n'a pas explicitement choisi « Appliquer ». Le bloc ci-dessous est inséré
 * juste avant la première action modifiante.
 */
export function blocModeDiagnostic(valeurAppliquer = 'Appliquer') {
  return [
    '',
    `if ($Mode -ne '${valeurAppliquer}') {`,
    '  Write-Host \'\'',
    '  Write-Host \'MODE DIAGNOSTIC — aucune modification n\'\'a été effectuée.\'',
    '  Write-Host \'Relis les constats ci-dessus. Pour appliquer, régénère le script\'',
    `  Write-Host 'depuis KJEMO IT Toolkit en choisissant le mode ${valeurAppliquer}.'`,
    '}',
  ].join('\n');
}
