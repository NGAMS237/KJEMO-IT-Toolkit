/**
 * outils-gpo.mjs — LOT 4 · KJEMO IT Toolkit
 * -----------------------------------------
 * Catalogue des stratégies de groupe : diagnostic et inventaire, création et
 * ciblage, environnement utilisateur, sécurité des postes, déploiement et
 * maintenance.
 *
 * Dépendances : noyau.mjs, validateurs.mjs, rapport-ps.mjs et les éléments
 * communs d'outils-serveur.mjs. Aucun import circulaire : generators.mjs
 * importe ce module, jamais l'inverse.
 *
 * Cinq règles gouvernent ce catalogue.
 *
 *  1. DIAGNOSTIC PAR DÉFAUT. Toute opération modifiante s'ouvre en Diagnostic
 *     et n'écrit qu'après un choix explicite.
 *
 *  2. LES DEUX STRATÉGIES PAR DÉFAUT SONT INTOUCHABLES. Default Domain Policy
 *     porte la politique de mots de passe du domaine ; Default Domain
 *     Controllers Policy porte les droits d'ouverture de session des
 *     contrôleurs. Les abîmer se répare par une restauration d'annuaire. Aucun
 *     assistant de ce lot ne les vise, et la validation les refuse à la saisie.
 *
 *  3. PRÉPARER N'EST PAS APPLIQUER. Plusieurs extensions de stratégie — les
 *     lecteurs réseau, les imprimantes, la redirection de dossiers,
 *     l'installation de logiciels — n'ont pas de cmdlet officielle. Pour
 *     celles-là, l'assistant vérifie les prérequis et donne la marche à suivre
 *     exacte dans la console. Il ne fabrique rien dans SYSVOL, et il ne
 *     présente jamais une préparation comme une configuration appliquée.
 *
 *  4. UNE SAUVEGARDE QUI ÉCHOUE ARRÊTE TOUT. Avant une restauration ou une
 *     modification risquée, la sauvegarde conditionne la suite : si elle
 *     échoue, rien n'est écrit.
 *
 *  5. AUCUNE SUPPRESSION, AUCUNE COUPURE SILENCIEUSE. Aucune GPO n'est
 *     supprimée, le pare-feu et Defender ne sont jamais désactivés, et aucun
 *     redémarrage ni aucune fermeture de session n'est déclenché.
 */

import { psB64, assertValid } from './noyau.mjs';
import {
  validerFqdn,
  validerNomHote,
  validerCheminOu,
  validerCheminUnc,
  validerLettreLecteur,
  validerJours,
  validerEntier,
  validerChoix,
  validerFormatRapport,
  validerModeExecution,
  validateSamAccountName,
  validateGroupName,
  validateShareName,
  validerCheminWindowsLocal,
  domainToDn,
  cheminOuVersDn,
  validerNomGpo,
  validerNomGpoModifiable,
  refuseGpoParDefaut,
  validerPorteeGpo,
  validerEtatLien,
  validerApplicationLien,
  validerOrdreLien,
  validerCheminSysvol,
  validerNomScriptGpo,
  validerRequeteWql,
  validerEspaceNomsWmi,
  validerMinutes,
  validerHeure,
  validerUrlHttps,
  GPO_INTOUCHABLES,
  EXTENSIONS_SCRIPT_GPO,
} from './validateurs.mjs';
import { blocModeDiagnostic } from './rapport-ps.mjs';
import { champMode, champFormat, verifier, assembler, PREREQS_SERVEUR } from './outils-serveur.mjs';

// ---------------------------------------------------------------------------
// Éléments communs au catalogue GPO
// ---------------------------------------------------------------------------

/**
 * Systèmes visés. Le module GroupPolicy est la vraie dépendance : il vient de
 * la fonctionnalité Gestion des stratégies de groupe (GPMC), présente sur un
 * contrôleur et installable sur un poste d'administration.
 */
export const OS_GPO = [
  'Windows Server 2019 — module GroupPolicy fourni par la console GPMC',
  'Windows Server 2022 — module GroupPolicy fourni par la console GPMC',
  'Windows Server 2025 — cmdlets documentées identiques, non éprouvées en laboratoire par ce projet',
  'Windows 10 et 11 avec RSAT-GroupPolicy-Management-Tools, pour l’administration à distance',
  'Windows PowerShell 5.1 — cible de référence',
  'PowerShell 7 — le module GroupPolicy s’y importe avec -UseWindowsPowerShell',
];

/** Prérequis communs à tout outil qui lit ou écrit une stratégie de groupe. */
export const PREREQS_GPO = PREREQS_SERVEUR.concat([
  'Module GroupPolicy disponible : console GPMC sur un contrôleur, ou outils d’administration RSAT-GroupPolicy-Management-Tools.',
  'Compte autorisé à lire les stratégies du domaine. Les droits d’écriture sont précisés par outil, et ne sont demandés qu’en mode Appliquer.',
  'Aucun mot de passe n’est saisi dans le site : quand un secret est nécessaire, le script le demande localement à l’exécution.',
]);

/** Erreurs fréquentes communes au module GroupPolicy. */
export const ERREURS_GPO = [
  {
    message: 'Le terme « Get-GPO » n’est pas reconnu comme nom d’applet de commande',
    code: 'CommandNotFoundException',
    cause: 'Le module GroupPolicy n’est pas présent sur la machine qui exécute le script.',
    fix: 'Installer les outils de gestion des stratégies de groupe, puis rouvrir la console.',
    command: 'Get-WindowsFeature GPMC | Format-Table Name,InstallState',
  },
  {
    message: 'Get-GPO : Impossible de trouver un contrôleur de domaine pour le domaine spécifié',
    cause: 'Le domaine indiqué ne se résout pas, ou aucun contrôleur ne répond depuis cette machine.',
    fix: 'Vérifier la résolution DNS du domaine et les enregistrements SRV avant d’aller plus loin.',
    command: 'Resolve-DnsName -Name <domaine> -Type SRV',
  },
  {
    message: 'Access is denied',
    code: '0x5',
    cause: 'Le compte utilisé n’a pas les droits sur la stratégie ou sur l’unité d’organisation visée.',
    fix: 'Utiliser un compte délégué sur cette OU, ou membre des Propriétaires créateurs de la stratégie de groupe.',
  },
];

/** Champ « domaine » commun, avec l'exemple de laboratoire du projet. */
export function champDomaineGpo(aide = 'Domaine Active Directory dont les stratégies sont examinées.') {
  return { id: 'gpoDomain', label: 'Domaine Active Directory', default: 'hopitalbn.lan', help: aide };
}

/**
 * Préambule PowerShell commun : import du module GroupPolicy, avec un message
 * clair s'il manque, et relevé du domaine courant.
 */
export function blocModuleGpo() {
  return [
    '# --- Module GroupPolicy -----------------------------------------------------',
    "# Le module vient de la console de gestion des strategies de groupe (GPMC),",
    "# ou des outils d'administration RSAT.",
    '$moduleOk = $false',
    'try {',
    '  Import-Module GroupPolicy -ErrorAction Stop',
    '  $moduleOk = $true',
    "  [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Module GroupPolicy' -Etat 'OK' -Valeur 'charge')",
    '} catch {',
    "  [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Module GroupPolicy' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Installe RSAT-GroupPolicy-Management-Tools, ou execute depuis un controleur de domaine.')",
    '}',
    '',
    '$domaineJoignable = $false',
    'if ($moduleOk) {',
    '  try {',
    '    [void](Get-GPO -All -Domain $Domaine -ErrorAction Stop)',
    '    $domaineJoignable = $true',
    "    [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Acces au domaine' -Etat 'OK' -Valeur $Domaine)",
    '  } catch {',
    "    [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Acces au domaine' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Verifie la resolution DNS du domaine et les droits de lecture sur les strategies.')",
    '  }',
    '}',
  ].join('\n');
}

/**
 * Bloc de rappel : les deux stratégies par défaut ne sont jamais touchées.
 * Inséré dans tout script qui écrit, pour que la personne qui lit le script
 * sache où s'arrête ce qu'il fait.
 */
export function blocGpoParDefaut() {
  return [
    '',
    '# --- Strategies par defaut --------------------------------------------------',
    "# Default Domain Policy porte la politique de mots de passe du domaine ;",
    "# Default Domain Controllers Policy porte les droits d'ouverture de session",
    '# des controleurs. Ce script refuse de les modifier, et verifie ici que la',
    "# cible n'en est pas une.",
    "$gpoInterdites = @('Default Domain Policy', 'Default Domain Controllers Policy')",
    'if ($gpoInterdites -contains $NomGpo) {',
    "  [void](Add-KjemoResultat -Categorie 'Securite' -Controle 'Cible' -Etat 'PROBLEME' -Valeur $NomGpo -Commentaire 'Strategie par defaut : ce script ne la modifie pas. Cree une GPO distincte et lie-la.')",
    '  $cibleAutorisee = $false',
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Securite' -Controle 'Cible' -Etat 'OK' -Valeur $NomGpo -Commentaire 'Strategie ordinaire : modifiable.')",
    '  $cibleAutorisee = $true',
    '}',
  ].join('\n');
}

/**
 * Bloc de clôture des outils de PRÉPARATION : ceux dont l'extension de
 * stratégie n'a pas de cmdlet officielle. Le script a vérifié, il n'a rien
 * configuré, et il le dit — plutôt que de laisser croire le contraire.
 */
export function blocPreparationSeulement(quoi) {
  // Le texte part dans une chaîne PowerShell entre apostrophes : l'apostrophe
  // s'y double, sinon elle ferme la chaîne au milieu d'un mot.
  const echappe = String(quoi).replace(/'/g, "''");
  return [
    '',
    "Write-Host ''",
    "Write-Host '--- Ce que ce script a fait, et ce qu''il n''a pas fait ---'",
    `Write-Host 'Il a verifie les prerequis de : ${echappe}.'`,
    "Write-Host 'Il n''a RIEN configure. Cette extension de strategie de groupe n''a pas'",
    "Write-Host 'de cmdlet officielle : la configuration se fait dans la console de'",
    "Write-Host 'gestion des strategies de groupe, par les etapes decrites dans la fiche.'",
    "Write-Host 'Aucun fichier XML de SYSVOL n''a ete ecrit ni modifie : fabriquer ces'",
    "Write-Host 'fichiers a la main produit des strategies que la console ne sait plus'",
    "Write-Host 'relire.'",
  ].join('\n');
}

/** Bloc de rappel : aucune GPO n'est supprimée par ce lot. */
export function blocAucuneSuppressionGpo() {
  return [
    '',
    "Write-Host ''",
    "Write-Host '--- Portee de ce script ---'",
    "Write-Host 'Aucune strategie de groupe n''est supprimee par ce script. Supprimer une'",
    "Write-Host 'GPO retire aussi ses liens, et son contenu ne revient que par une'",
    "Write-Host 'restauration de sauvegarde : c''est une decision humaine.'",
  ].join('\n');
}

/**
 * 1. gpo-inventory-report — ce que le domaine contient vraiment.
 *
 * Un domaine de cinq ans porte des GPO que plus personne ne reconnaît : des
 * stratégies créées pour un essai, jamais liées ; des stratégies liées puis
 * désactivées des deux côtés, qui ne font plus rien mais que personne n'ose
 * retirer. Cet outil les nomme. Il ne retire rien.
 */
export const outilInventaireGpo = {
  id: 'gpo-inventory-report',
  icon: '☰',
  category: 'GPO',
  subcategory: 'Diagnostic et inventaire',
  title: 'Inventorier les GPO du domaine',
  risk: 'diagnostic',
  summary: 'Recense toutes les stratégies du domaine : propriétaire, dates, état des deux moitiés, liens connus, GPO sans lien et GPO entièrement désactivées. N’écrit rien.',
  fields: [
    champDomaineGpo(),
    {
      id: 'invRecent', label: 'Signaler les GPO modifiées dans les (jours)', default: '30',
      help: 'Une stratégie modifiée hier et dont personne ne se souvient mérite un coup d’œil.',
    },
    champFormat('invFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'invRecent', validerJours(v.invRecent, { min: 1, max: 3650, label: 'La fenêtre d’examen' }));
    verifier(errors, 'invFormat', validerFormatRapport(v.invFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$FenetreJours = ${validerJours(v.invRecent, { min: 1, max: 3650 }).value}`,
      `$KjemoFormat = ${psB64(v.invFormat)}`,
      "",
      blocModuleGpo(),
      "",
      '# --- 1. Toutes les strategies du domaine ------------------------------------',
      '$gpos = @()',
      'if ($domaineJoignable) {',
      '  try { $gpos = @(Get-GPO -All -Domain $Domaine -ErrorAction Stop) } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Inventaire' -Controle 'Lecture' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Inventaire' -Controle 'Strategies du domaine' -Etat 'INFO' -Valeur $gpos.Count)",
      "",
      '# --- 2. Les liens, lus une seule fois dans le rapport XML du domaine --------',
      "# Get-GPO ne dit pas ou une strategie est liee : le lien appartient a l'OU,",
      '# pas a la GPO. On lit donc le rapport XML de chaque strategie, qui contient',
      '# ses liens tels que le domaine les connait.',
      '$liensParGpo = @{}',
      'foreach ($g in $gpos) {',
      '  $xml = $null',
      "  try { $xml = [xml](Get-GPOReport -Guid $g.Id -ReportType Xml -Domain $Domaine -ErrorAction Stop) } catch { }",
      '  $liens = @()',
      '  if ($xml -and $xml.GPO -and $xml.GPO.LinksTo) {',
      '    foreach ($l in @($xml.GPO.LinksTo)) {',
      "      $etatLien = 'actif'",
      "      if ($l.Enabled -eq 'false') { $etatLien = 'desactive' }",
      "      $force = ''",
      "      if ($l.NoOverride -eq 'true') { $force = ' (applique de force)' }",
      '      $liens += "$($l.SOMPath) [$etatLien$force]"',
      '    }',
      '  }',
      '  $liensParGpo[$g.Id.Guid] = $liens',
      '}',
      "",
      '# --- 3. Fiche par strategie ---------------------------------------------------',
      '$limiteRecent = (Get-Date).AddDays(-$FenetreJours)',
      '$sansLien = New-Object System.Collections.ArrayList',
      '$toutDesactive = New-Object System.Collections.ArrayList',
      '$modifieesRecemment = New-Object System.Collections.ArrayList',
      'foreach ($g in ($gpos | Sort-Object DisplayName)) {',
      '  $liens = $liensParGpo[$g.Id.Guid]',
      "  $ordi = 'active'",
      "  if ($g.Computer.Enabled -eq $false) { $ordi = 'desactivee' }",
      "  $util = 'active'",
      "  if ($g.User.Enabled -eq $false) { $util = 'desactivee' }",
      "",
      "  $etat = 'INFO'",
      "  $note = ''",
      '  if (-not $liens -or $liens.Count -eq 0) {',
      '    [void]$sansLien.Add($g.DisplayName)',
      "    $etat = 'ATTENTION'",
      "    $note = 'Aucun lien : cette strategie ne s''applique nulle part. Souvent un essai oublie.'",
      '  }',
      '  if ($g.Computer.Enabled -eq $false -and $g.User.Enabled -eq $false) {',
      '    [void]$toutDesactive.Add($g.DisplayName)',
      "    $etat = 'ATTENTION'",
      "    $note = $note + ' Les deux moitiés sont desactivees : la strategie ne fait rien, meme liee.'",
      '  }',
      '  if ($g.ModificationTime -gt $limiteRecent) {',
      '    [void]$modifieesRecemment.Add($g.DisplayName)',
      '  }',
      "",
      '  $valeur = "proprietaire : $($g.Owner) ; creee le $($g.CreationTime.ToString(\'yyyy-MM-dd\')) ; modifiee le $($g.ModificationTime.ToString(\'yyyy-MM-dd\')) ; ordinateur : $ordi ; utilisateur : $util"',
      "  $commentaire = $note",
      '  if ($liens -and $liens.Count -gt 0) {',
      '    $commentaire = ($liens -join \' | \') + \' \' + $note',
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Strategies\' -Controle $g.DisplayName -Etat $etat -Valeur $valeur -Commentaire $commentaire)',
      '}',
      "",
      '# --- 4. Ce qui merite un coup d\'oeil -------------------------------------------',
      "$etat = 'OK'",
      "if ($sansLien.Count -gt 0) { $etat = 'ATTENTION' }",
      '[void](Add-KjemoResultat -Categorie \'Synthese\' -Controle \'GPO sans aucun lien\' -Etat $etat -Valeur $sansLien.Count -Commentaire ($sansLien -join \', \'))',
      "$etat = 'OK'",
      "if ($toutDesactive.Count -gt 0) { $etat = 'ATTENTION' }",
      '[void](Add-KjemoResultat -Categorie \'Synthese\' -Controle \'GPO entierement desactivees\' -Etat $etat -Valeur $toutDesactive.Count -Commentaire ($toutDesactive -join \', \'))',
      '[void](Add-KjemoResultat -Categorie \'Synthese\' -Controle "Modifiees depuis moins de $FenetreJours jours" -Etat \'INFO\' -Valeur $modifieesRecemment.Count -Commentaire ($modifieesRecemment -join \', \'))',
      "[void](Add-KjemoResultat -Categorie 'Synthese' -Controle 'Portee de ce rapport' -Etat 'INFO' -Valeur 'lecture seule' -Commentaire 'Aucune strategie n''est creee, modifiee, deliee ni supprimee par ce script.')",
    ];

    return assembler({
      titre: 'Inventaire des strategies de groupe du domaine',
      outil: 'gpo-inventory-report',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['FenetreJours', psB64(String(v.invRecent))],
        ['Format', psB64(v.invFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-inventaire',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > Forêt > Domaines > votre domaine > Objets de stratégie de groupe.',
    'La colonne « État de GPO » montre les moitiés désactivées.',
    'Onglet Étendue d’une GPO : la liste « Liens » dit où elle s’applique — c’est ce que lit ce rapport.',
    'Onglet Détails : propriétaire, dates de création et de modification, numéros de version.',
    'La console n’offre pas de vue « toutes les GPO sans lien » : c’est précisément ce que ce rapport ajoute.',
  ],
  keywords: [
    'inventaire gpo', 'get-gpo', 'gpo sans lien', 'gpo orpheline', 'gpo desactivee',
    'liste des strategies', 'proprietaire gpo', 'menage gpo', 'audit gpo', 'get-gporeport',
  ],
  requiresAdmin: false,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Droit de lecture sur les stratégies du domaine : accordé par défaut aux utilisateurs authentifiés.',
    'Sur un domaine qui porte beaucoup de stratégies, le rapport XML de chacune est lu : prévoir quelques secondes par dizaine de GPO.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Get-GPOReport : Les données requises sont manquantes',
      cause: 'Le rapport XML d’une stratégie n’a pas pu être produit : réplication SYSVOL incomplète, ou droits insuffisants sur cette GPO.',
      fix: 'La stratégie apparaît alors sans lien dans le rapport. Vérifier la santé de SYSVOL avant de conclure qu’elle est orpheline.',
    },
    {
      message: 'Une GPO apparaît « sans aucun lien » alors qu’elle est liée',
      cause: 'Le lien existe sur un site Active Directory, ou sur une OU que le compte utilisé ne peut pas lire.',
      fix: 'Relancer avec un compte qui lit tout l’annuaire, et vérifier les liens de site dans Sites et services.',
    },
    {
      message: 'Le propriétaire affiché est un SID brut',
      cause: 'Le compte propriétaire de la stratégie a été supprimé.',
      fix: 'Reprendre la propriété de la GPO depuis la console, onglet Délégation > Avancé > Propriétaire.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le nombre de stratégies recensées correspond à ce que montre la console gpmc.msc.',
    'Chaque stratégie porte son propriétaire, ses dates, l’état de ses deux moitiés et ses liens.',
    'Les compteurs finaux donnent les GPO sans lien et les GPO entièrement désactivées.',
  ],
  rollback: {
    summary: 'Ce rapport lit l’annuaire et les rapports XML des stratégies. Il ne crée, ne modifie, ne délie et ne supprime rien. La seule trace est le fichier exporté.',
    diagnostic: '# Retrouver les rapports produits par cet outil.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-inventaire*\' | Format-Table Name,Length,LastWriteTime',
    command: '# Retirer un rapport devenu inutile.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-inventaire*\' | Remove-Item -Confirm',
    warning: 'Le rapport nomme toutes les stratégies du domaine et leurs points d’application : c’est une carte de la configuration, et elle se range comme un document interne.',
  },
  checks: [
    'Une GPO sans lien ne s’applique nulle part : avant de la retirer, chercher pourquoi elle a été créée.',
    'Une GPO dont les deux moitiés sont désactivées ne fait rien, même liée.',
    'Rien n’est modifié : ce rapport sert à décider, pas à agir.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpo',
  sources: [
    { label: 'Get-GPO', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpo' },
    { label: 'Get-GPOReport', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gporeport' },
    { label: 'Module GroupPolicy', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/' },
  ],
};

/**
 * 2. gpo-health-report — les stratégies s'appliquent-elles encore ?
 *
 * Une stratégie de groupe repose sur trois choses : un annuaire qui répond,
 * SYSVOL qui porte les fichiers, et un client capable de lire les deux. Quand
 * l'une manque, rien ne s'applique — et rien ne le dit. Le symptôme est un
 * réglage qui « ne passe pas », et on cherche dans la GPO, qui va très bien.
 */
export const outilSanteGpo = {
  id: 'gpo-health-report',
  icon: '◈',
  category: 'GPO',
  subcategory: 'Diagnostic et inventaire',
  title: 'Diagnostiquer la santé des stratégies de groupe',
  risk: 'diagnostic',
  summary: 'Vérifie ce dont les stratégies dépendent : accès au domaine, module GroupPolicy, partages SYSVOL et NETLOGON, cohérence des versions annuaire/SYSVOL et erreurs récentes. N’écrit rien.',
  fields: [
    champDomaineGpo(),
    {
      id: 'sanGpoJours', label: 'Fenêtre des événements examinés (jours)', default: '7',
      help: 'Journaux Microsoft-Windows-GroupPolicy/Operational et Système.',
    },
    champFormat('sanGpoFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'sanGpoJours', validerJours(v.sanGpoJours, { min: 1, max: 90, label: 'La fenêtre d’examen' }));
    verifier(errors, 'sanGpoFormat', validerFormatRapport(v.sanGpoFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Jours = ${validerJours(v.sanGpoJours, { min: 1, max: 90 }).value}`,
      `$KjemoFormat = ${psB64(v.sanGpoFormat)}`,
      "",
      blocModuleGpo(),
      "",
      '# --- 1. Les partages dont tout depend ----------------------------------------',
      "# SYSVOL porte le contenu des strategies ; NETLOGON porte les scripts. Un",
      "# client qui ne les atteint pas n'applique rien, et ne dit rien non plus.",
      'foreach ($partage in @("\\\\$Domaine\\SYSVOL", "\\\\$Domaine\\NETLOGON")) {',
      '  $joignable = $false',
      '  try { $joignable = Test-Path -LiteralPath $partage -ErrorAction SilentlyContinue } catch { }',
      "  $etat = 'PROBLEME'",
      "  if ($joignable) { $etat = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Partages' -Controle $partage -Etat $etat -Valeur $joignable -Commentaire 'Sans ce partage, aucune strategie ne s''applique sur les clients.')",
      '}',
      "",
      '# --- 2. Le dossier Policies de SYSVOL ------------------------------------------',
      '$cheminPolicies = "\\\\$Domaine\\SYSVOL\\$Domaine\\Policies"',
      '$dossiers = @()',
      'try { $dossiers = @(Get-ChildItem -LiteralPath $cheminPolicies -Directory -ErrorAction SilentlyContinue) } catch { }',
      "$etat = 'PROBLEME'",
      "if ($dossiers.Count -gt 0) { $etat = 'OK' }",
      '[void](Add-KjemoResultat -Categorie \'Partages\' -Controle \'Dossiers de strategies dans SYSVOL\' -Etat $etat -Valeur $dossiers.Count -Commentaire $cheminPolicies)',
      "",
      '# --- 3. Coherence annuaire / SYSVOL --------------------------------------------',
      "# Chaque strategie porte deux numeros de version : un dans l'annuaire, un",
      '# dans le fichier GPT.INI de SYSVOL. Un ecart signifie que la replication',
      "# n'a pas fini, ou qu'elle est bloquee. C'est la panne classique du",
      '# « ca marche sur un poste et pas sur un autre ».',
      '$gpos = @()',
      'if ($domaineJoignable) {',
      '  try { $gpos = @(Get-GPO -All -Domain $Domaine -ErrorAction SilentlyContinue) } catch { }',
      '}',
      '$ecarts = 0',
      '$comparees = 0',
      'foreach ($g in $gpos) {',
      "  $gptIni = Join-Path (Join-Path $cheminPolicies (\"{\" + $g.Id.Guid + \"}\")) 'GPT.INI'",
      '  $versionSysvol = $null',
      '  try {',
      '    if (Test-Path -LiteralPath $gptIni) {',
      "      $ligne = (Get-Content -LiteralPath $gptIni -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\\s*Version\\s*=' } | Select-Object -First 1)",
      "      if ($ligne) { $versionSysvol = [int](($ligne -split '=')[1].Trim()) }",
      '    }',
      '  } catch { }',
      '  if ($versionSysvol -eq $null) {',
      "    [void](Add-KjemoResultat -Categorie 'Versions' -Controle $g.DisplayName -Etat 'ATTENTION' -Valeur 'GPT.INI illisible' -Commentaire 'Dossier absent de SYSVOL, ou droits insuffisants. La strategie peut ne pas s''appliquer.')",
      '    continue',
      '  }',
      '  $comparees = $comparees + 1',
      '  # L\'annuaire stocke les deux moities dans un seul entier : utilisateur dans',
      '  # les 16 bits hauts, ordinateur dans les 16 bits bas. SYSVOL utilise la',
      '  # meme convention, ce qui rend la comparaison directe.',
      '  $versionAd = ($g.User.DSVersion -shl 16) -bor $g.Computer.DSVersion',
      '  if ($versionAd -ne $versionSysvol) {',
      '    $ecarts = $ecarts + 1',
      "    [void](Add-KjemoResultat -Categorie 'Versions' -Controle $g.DisplayName -Etat 'PROBLEME' -Valeur (\"annuaire : $versionAd ; SYSVOL : $versionSysvol\") -Commentaire 'Les deux versions divergent : la replication de SYSVOL n''a pas abouti, ou elle est bloquee. La strategie s''applique differemment selon le controleur interroge.')",
      '  }',
      '}',
      "$etat = 'OK'",
      "if ($ecarts -gt 0) { $etat = 'PROBLEME' }",
      '[void](Add-KjemoResultat -Categorie \'Versions\' -Controle \'Coherence annuaire / SYSVOL\' -Etat $etat -Valeur ("$comparees comparee(s), $ecarts ecart(s)"))',
      "",
      '# --- 4. Le service et les journaux du client ------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      "foreach ($journal in @('Microsoft-Windows-GroupPolicy/Operational', 'System')) {",
      '  $evts = @()',
      '  try {',
      '    $evts = @(Get-WinEvent -FilterHashtable @{ LogName = $journal; Level = 1,2; StartTime = $depuis } -ErrorAction SilentlyContinue)',
      '  } catch { }',
      "  if ($journal -eq 'System') {",
      "    $evts = @($evts | Where-Object { $_.ProviderName -like '*GroupPolicy*' })",
      '  }',
      "  $etat = 'OK'",
      "  if ($evts.Count -gt 0) { $etat = 'ATTENTION' }",
      '  [void](Add-KjemoResultat -Categorie \'Journaux\' -Controle ("Erreurs — " + $journal) -Etat $etat -Valeur ("$($evts.Count) sur $Jours jour(s)"))',
      '  foreach ($e in ($evts | Select-Object -First 8)) {',
      '    [void](Add-KjemoResultat -Categorie \'Journaux\' -Controle ("evenement $($e.Id)") -Etat \'ATTENTION\' -Valeur $e.TimeCreated.ToString(\'yyyy-MM-dd HH:mm\') -Commentaire (($e.Message -split "`n")[0]))',
      '  }',
      '}',
      "",
      '# --- 5. Conclusion ---------------------------------------------------------------',
      "[void](Add-KjemoResultat -Categorie 'Conclusion' -Controle 'Portee' -Etat 'INFO' -Valeur 'diagnostic seulement' -Commentaire 'Ce script ne repare rien. Un ecart de version se traite par la replication de SYSVOL, decrite dans les sources de cette fiche.')",
    ];

    return assembler({
      titre: 'Sante des strategies de groupe',
      outil: 'gpo-health-report',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['FenetreJours', psB64(String(v.sanGpoJours))],
        ['Format', psB64(v.sanGpoFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-sante',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > une GPO > onglet Détails : les numéros de version Ordinateur et Utilisateur y figurent.',
    'Explorateur : \\\\<domaine>\\SYSVOL\\<domaine>\\Policies — un dossier par stratégie, nommé par son GUID.',
    'Observateur d’événements > Journaux des applications et des services > Microsoft > Windows > GroupPolicy > Operational.',
    'Services : le service Client de stratégie de groupe (gpsvc) doit être démarré sur le poste.',
  ],
  keywords: [
    'sante gpo', 'sysvol', 'netlogon', 'gpt.ini', 'version gpo', 'replication sysvol',
    'gpo ne s’applique pas', 'journal grouppolicy', 'dsversion', 'strategie sans effet',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Accès en lecture au partage SYSVOL du domaine : c’est de là que vient la comparaison des versions.',
    'Droits d’administration locale pour lire les journaux d’événements.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'GPT.INI illisible pour plusieurs stratégies',
      cause: 'Le partage SYSVOL n’est pas accessible depuis cette machine, ou la réplication DFSR n’a pas abouti.',
      fix: 'Traiter SYSVOL d’abord : tant qu’il n’est pas sain, aucune stratégie ne s’applique de façon fiable.',
    },
    {
      message: 'Les versions annuaire et SYSVOL divergent sur une stratégie récemment modifiée',
      cause: 'La réplication est en cours : l’annuaire se réplique vite, SYSVOL suit selon la planification DFSR.',
      fix: 'Relancer le rapport un peu plus tard. Un écart qui persiste plusieurs heures est un vrai problème de réplication.',
    },
    {
      message: 'Événement 1058 ou 1030 dans le journal GroupPolicy',
      code: '1058 / 1030',
      cause: 'Le client n’a pas pu lire le fichier GPT.INI d’une stratégie : SYSVOL injoignable, DNS, ou permissions.',
      fix: 'Vérifier l’accès à \\\\<domaine>\\SYSVOL depuis le poste concerné, avec le compte concerné.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les deux partages SYSVOL et NETLOGON répondent.',
    'Le nombre de stratégies comparées correspond au nombre de stratégies du domaine.',
    'Aucun écart de version ne subsiste entre l’annuaire et SYSVOL.',
  ],
  rollback: {
    summary: 'Ce diagnostic lit des partages, des attributs d’annuaire et des journaux. Il ne modifie rien, et n’a donc rien à annuler.',
    diagnostic: '# Relire la version d\'une strategie des deux cotes, a la main.\nGet-GPO -Name \'<nom-de-la-gpo>\' | Format-List DisplayName,Id,@{n=\'VersionAD\';e={($_.User.DSVersion -shl 16) -bor $_.Computer.DSVersion}}\nGet-Content -LiteralPath "\\\\<domaine>\\SYSVOL\\<domaine>\\Policies\\{<guid>}\\GPT.INI"',
    command: '# Retirer un rapport devenu inutile.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-sante*\' | Remove-Item -Confirm',
    warning: 'Un écart de version se corrige par la réplication de SYSVOL, jamais en éditant GPT.INI à la main : un numéro de version changé sans que le contenu le soit produit des clients qui croient être à jour.',
  },
  checks: [
    'Commencer par les partages : sans SYSVOL, le reste du diagnostic ne veut rien dire.',
    'Un écart de version sur une stratégie modifiée il y a cinq minutes est normal ; au bout de quelques heures, non.',
    'Rien n’est réparé ici : le rapport dit où chercher.',
  ],
  source: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/applying-group-policy-troubleshooting-guidance',
  sources: [
    { label: 'Diagnostiquer l’application d’une stratégie de groupe', url: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/applying-group-policy-troubleshooting-guidance' },
    { label: 'Get-GPO', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpo' },
    { label: 'Synchronisation de SYSVOL répliqué par DFSR', url: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/force-authoritative-non-authoritative-synchronization' },
  ],
};

/**
 * 3. gpo-resultant-set — ce qui s'applique vraiment, ici et maintenant.
 *
 * La question n'est jamais « que contient cette GPO », mais « pourquoi ce
 * réglage n'arrive-t-il pas sur ce poste ». Le jeu de stratégie résultant
 * répond : il dit quelles stratégies ont gagné, et surtout lesquelles ont été
 * écartées, avec la raison.
 */
export const outilRsop = {
  id: 'gpo-resultant-set',
  icon: '◳',
  category: 'GPO',
  subcategory: 'Diagnostic et inventaire',
  title: 'Produire un rapport gpresult / RSoP',
  risk: 'diagnostic',
  summary: 'Produit le jeu de stratégie résultant pour un utilisateur ou un ordinateur, en local ou à distance, et explique les raisons habituelles pour lesquelles une stratégie est écartée.',
  fields: [
    champDomaineGpo('Domaine des comptes visés.'),
    {
      id: 'rsopCible', label: 'Ordinateur examiné', default: 'PC-CONSULT-01',
      help: 'Nom court de la machine. Laisse la valeur locale si tu exécutes le script sur la machine concernée.',
    },
    {
      id: 'rsopUtilisateur', label: 'Utilisateur (facultatif)', default: '',
      help: 'SamAccountName. Vide : seule la moitié Ordinateur est analysée.',
    },
    {
      id: 'rsopPortee', label: 'Portée du rapport', type: 'select', default: 'Les deux',
      options: [
        ['Ordinateur', 'Ordinateur seulement'],
        ['Utilisateur', 'Utilisateur seulement'],
        ['Les deux', 'Ordinateur et utilisateur'],
      ],
    },
    champFormat('rsopFormat', ['Console', 'HTML', 'JSON']),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'rsopCible', validerNomHote(v.rsopCible));
    const u = String(v.rsopUtilisateur ?? '').trim();
    if (u !== '') verifier(errors, 'rsopUtilisateur', validateSamAccountName(u));
    verifier(errors, 'rsopPortee', validerPorteeGpo(v.rsopPortee));
    verifier(errors, 'rsopFormat', validerChoix(v.rsopFormat, ['Console', 'HTML', 'JSON'], 'Le format'));
    if (String(v.rsopPortee) === 'Utilisateur' && u === '') {
      errors.rsopUtilisateur = 'Une portée Utilisateur demande un compte : sans lui, il n’y a rien à analyser.';
    }
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const cible = validerNomHote(v.rsopCible).value;
    const utilisateur = String(v.rsopUtilisateur ?? '').trim();

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Ordinateur = ${psB64(cible)}`,
      `$Utilisateur = ${psB64(utilisateur)}`,
      `$Portee = ${psB64(v.rsopPortee)}`,
      `$KjemoFormat = ${psB64(v.rsopFormat)}`,
      "",
      blocModuleGpo(),
      "",
      '# --- 1. La machine repond-elle ? -----------------------------------------------',
      '$local = ($Ordinateur -eq $env:COMPUTERNAME)',
      '$joignable = $local',
      'if (-not $local) {',
      '  try { $joignable = Test-Connection -ComputerName $Ordinateur -Count 1 -Quiet -ErrorAction SilentlyContinue } catch { }',
      '}',
      "$etat = 'PROBLEME'",
      "if ($joignable) { $etat = 'OK' }",
      "$note = ''",
      "if (-not $local) { $note = 'Un rapport a distance demande que WinRM ou RPC reponde, et des droits d''administration sur la machine.' }",
      '[void](Add-KjemoResultat -Categorie \'Cible\' -Controle $Ordinateur -Etat $etat -Valeur ("local : $local") -Commentaire $note)',
      "",
      '# --- 2. Le jeu de strategie resultant --------------------------------------------',
      "# Get-GPResultantSetOfPolicy ecrit un rapport ; gpresult affiche un resume.",
      '# On produit le rapport officiel, et on conserve le fichier.',
      "$dossier = [Environment]::GetFolderPath('Desktop')",
      "$horodatage = (Get-Date).ToString('yyyyMMdd-HHmmss')",
      "$extension = 'html'",
      "if ($KjemoFormat -eq 'JSON') { $extension = 'xml' }",
      '$cheminRsop = Join-Path $dossier "kjemo-gpo-rsop-$Ordinateur-$horodatage.$extension"',
      "$typeRapport = 'Html'",
      "if ($KjemoFormat -eq 'JSON') { $typeRapport = 'Xml' }",
      "",
      '$rsopOk = $false',
      'if ($moduleOk -and $joignable) {',
      '  try {',
      "    if ($Portee -eq 'Ordinateur' -or $Utilisateur -eq '') {",
      '      Get-GPResultantSetOfPolicy -Computer $Ordinateur -ReportType $typeRapport -Path $cheminRsop -ErrorAction Stop',
      "    } elseif ($Portee -eq 'Utilisateur') {",
      '      Get-GPResultantSetOfPolicy -User "$Domaine\\$Utilisateur" -ReportType $typeRapport -Path $cheminRsop -ErrorAction Stop',
      '    } else {',
      '      Get-GPResultantSetOfPolicy -Computer $Ordinateur -User "$Domaine\\$Utilisateur" -ReportType $typeRapport -Path $cheminRsop -ErrorAction Stop',
      '    }',
      '    $rsopOk = $true',
      "    [void](Add-KjemoResultat -Categorie 'Rapport' -Controle 'Jeu de strategie resultant' -Etat 'OK' -Valeur $cheminRsop)",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Rapport' -Controle 'Jeu de strategie resultant' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'A distance : verifier WinRM, le pare-feu et les droits d''administration sur la machine visee.')",
      '  }',
      '}',
      "",
      '# --- 3. Resume texte, conserve lui aussi ------------------------------------------',
      '$cheminTexte = Join-Path $dossier "kjemo-gpo-gpresult-$Ordinateur-$horodatage.txt"',
      '$brut = $null',
      'if ($local -and (Get-Command gpresult.exe -ErrorAction SilentlyContinue)) {',
      '  try {',
      "    if ($Utilisateur -ne '' -and $Portee -ne 'Ordinateur') {",
      "      $brut = & gpresult.exe '/r' '/scope:user' 2>&1 | Out-String",
      '    } else {',
      "      $brut = & gpresult.exe '/r' '/scope:computer' 2>&1 | Out-String",
      '    }',
      '  } catch { }',
      '  if ($brut) {',
      '    try {',
      '      $brut | Out-File -FilePath $cheminTexte -Encoding UTF8',
      "      [void](Add-KjemoResultat -Categorie 'Rapport' -Controle 'Resume texte conserve' -Etat 'OK' -Valeur $cheminTexte -Commentaire 'Sortie non retouchee de gpresult : c''est elle qui fait foi.')",
      '    } catch { }',
      "    $appliquees = @([regex]::Matches($brut, '(?m)^\\s{8}(\\S.*)$'))",
      '    [void](Add-KjemoResultat -Categorie \'Rapport\' -Controle \'Lignes de strategies relevees\' -Etat \'INFO\' -Valeur $appliquees.Count)',
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Rapport' -Controle 'Resume gpresult' -Etat 'IGNORE' -Valeur 'non applicable' -Commentaire 'gpresult rend compte de la machine ou il s''execute : il n''est lance qu''en local.')",
      '}',
      "",
      '# --- 4. Pourquoi une strategie est ecartee -----------------------------------------',
      "# Ce sont toujours les memes quatre raisons, et le rapport RSoP les nomme",
      '# sous « Refusee » ou « Denied ». Les voici en clair.',
      "[void](Add-KjemoResultat -Categorie 'Raisons habituelles' -Controle 'Filtrage de securite' -Etat 'INFO' -Valeur 'le compte n''a pas le droit Appliquer la strategie de groupe' -Commentaire 'Retirer Utilisateurs authentifies sans donner Apply a un autre groupe est la cause la plus frequente.')",
      "[void](Add-KjemoResultat -Categorie 'Raisons habituelles' -Controle 'Filtre WMI' -Etat 'INFO' -Valeur 'la requete WQL renvoie faux sur cette machine' -Commentaire 'Un filtre WMI est evalue a chaque application : s''il echoue, la strategie est ecartee en silence.')",
      "[void](Add-KjemoResultat -Categorie 'Raisons habituelles' -Controle 'Heritage bloque' -Etat 'INFO' -Valeur 'Block Inheritance sur une OU intermediaire' -Commentaire 'Seules les strategies marquees Enforced traversent un blocage d''heritage.')",
      "[void](Add-KjemoResultat -Categorie 'Raisons habituelles' -Controle 'Moitie desactivee ou lien inactif' -Etat 'INFO' -Valeur 'la strategie existe mais ne fait rien' -Commentaire 'Verifier l''etat des deux moities dans l''inventaire, et l''etat du lien dans l''audit des liens.')",
      "[void](Add-KjemoResultat -Categorie 'Raisons habituelles' -Controle 'Objet dans une autre OU' -Etat 'INFO' -Valeur 'la cible n''est pas sous l''OU liee' -Commentaire 'Un compte deplace recemment change de strategies : c''est voulu, et c''est souvent oublie.')",
      "",
      "[void](Add-KjemoResultat -Categorie 'Conclusion' -Controle 'Portee' -Etat 'INFO' -Valeur 'lecture seule' -Commentaire 'Ce script produit des rapports. Il ne modifie aucune strategie, aucun lien, aucun filtrage.')",
    ];

    return assembler({
      titre: 'Jeu de strategie resultant (RSoP)',
      outil: 'gpo-resultant-set',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Ordinateur', psB64(cible)],
        ['Portee', psB64(v.rsopPortee)],
        ['Format', psB64(v.rsopFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-rsop',
      formats: 'Console, HTML, JSON',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > Résultats de stratégie de groupe > clic droit > Assistant Résultats.',
    'Choisir l’ordinateur, puis l’utilisateur ; l’assistant produit le même rapport que ce script.',
    'Onglet Détails du résultat : la section « Objets de stratégie de groupe refusés » donne la raison de chaque rejet.',
    'Modélisation de stratégie de groupe : même chose, mais pour une situation hypothétique — utile avant un déplacement d’OU.',
    'En ligne de commande sur le poste : gpresult /h rapport.html',
  ],
  keywords: [
    'rsop', 'gpresult', 'jeu de strategie resultant', 'gpo refusee', 'strategie non appliquee',
    'filtrage de securite', 'filtre wmi', 'heritage bloque', 'get-gpresultantsetofpolicy',
    'pourquoi ma gpo ne s’applique pas',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Pour un rapport à distance : WinRM ou RPC joignable, et droits d’administration sur la machine visée.',
    'L’utilisateur analysé doit avoir ouvert une session au moins une fois sur la machine, sans quoi sa moitié n’a pas de données.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Get-GPResultantSetOfPolicy : L’utilisateur n’a pas de données RSoP',
      cause: 'Le compte n’a jamais ouvert de session sur cette machine.',
      fix: 'Ouvrir une session avec ce compte sur la machine, puis relancer le rapport.',
    },
    {
      message: 'gpresult : accès refusé',
      cause: 'Le rapport de la moitié Ordinateur demande une console élevée.',
      fix: 'Ouvrir PowerShell en tant qu’administrateur sur la machine concernée.',
    },
    {
      message: 'Le rapport est vide alors que des stratégies sont liées',
      cause: 'Toutes ont été écartées — filtrage de sécurité, filtre WMI, héritage bloqué — ou le client n’a pas réussi à lire SYSVOL.',
      fix: 'Lire la section des stratégies refusées du rapport HTML, puis le diagnostic de santé des stratégies.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Un fichier de rapport est écrit sur le Bureau, et son chemin figure dans le rapport de console.',
    'La liste des stratégies appliquées correspond aux liens attendus sur l’OU de la cible.',
    'Chaque stratégie absente du résultat a une raison nommée dans le rapport HTML.',
  ],
  rollback: {
    summary: 'Produire un jeu de stratégie résultant est une lecture. Rien n’est modifié sur la machine ni dans le domaine ; les seules traces sont les fichiers de rapport.',
    diagnostic: '# Retrouver les rapports produits.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-*\' | Sort-Object LastWriteTime -Descending | Format-Table Name,Length,LastWriteTime',
    command: '# Retirer les rapports devenus inutiles.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-rsop*\' | Remove-Item -Confirm',
    warning: 'Le rapport RSoP contient le détail des réglages appliqués à un poste, y compris des chemins de serveurs et des noms de groupes. Il se range comme un document interne.',
  },
  checks: [
    'Une stratégie absente du résultat n’est pas une stratégie cassée : lire la raison du rejet.',
    'La moitié Utilisateur demande un compte qui a déjà ouvert une session sur la machine.',
    'Rien n’est modifié : ce rapport sert à comprendre.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpresultantsetofpolicy',
  sources: [
    { label: 'Get-GPResultantSetOfPolicy', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpresultantsetofpolicy' },
    { label: 'gpresult', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult' },
    { label: 'Diagnostiquer l’application d’une stratégie de groupe', url: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/applying-group-policy-troubleshooting-guidance' },
  ],
};

/**
 * 4. gpo-refresh-diagnostic — actualiser, et observer ce qui change.
 *
 * gpupdate /force est devenu un réflexe, et c'est dommage : il réapplique
 * TOUTES les stratégies au lieu des seules modifiées, ce qui allonge
 * l'opération et masque la vraie question — est-ce que le client voit la
 * modification ? Ce script actualise normalement, et compare avant et après.
 */
export const outilActualisationGpo = {
  id: 'gpo-refresh-diagnostic',
  icon: '↻',
  category: 'GPO',
  subcategory: 'Diagnostic et inventaire',
  title: 'Actualiser et diagnostiquer gpupdate',
  risk: 'caution',
  summary: 'Relève les stratégies appliquées, actualise sans /force, puis compare avant et après. Ne redémarre jamais et ne ferme aucune session.',
  fields: [
    champDomaineGpo('Domaine de la machine actualisée.'),
    {
      id: 'majPortee', label: 'Moitié à actualiser', type: 'select', default: 'Les deux',
      options: [
        ['Ordinateur', 'Ordinateur seulement'],
        ['Utilisateur', 'Utilisateur seulement'],
        ['Les deux', 'Ordinateur et utilisateur'],
      ],
    },
    {
      id: 'majForce', label: 'Réappliquer toutes les stratégies (/force)', type: 'select', default: 'Non',
      options: [
        ['Non', 'Non — n’applique que ce qui a changé (recommandé)'],
        ['Oui', 'Oui — réapplique tout, plus long'],
      ],
      help: 'Par défaut, gpupdate n’applique que les stratégies modifiées. /force réapplique tout : utile après une correction de permissions, inutile le reste du temps, et il masque le vrai symptôme.',
    },
    champMode('Diagnostic relève l’état sans actualiser. Appliquer lance gpupdate, puis compare.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'majPortee', validerPorteeGpo(v.majPortee));
    verifier(errors, 'majForce', validerApplicationLien(v.majForce));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$Portee = ${psB64(v.majPortee)}`,
      `$Forcer = ${psB64(v.majForce)}`,
      "$KjemoFormat = 'Console'",
      "",
      '# --- 1. Le service client de strategie de groupe ---------------------------------',
      '$gpsvc = $null',
      'try { $gpsvc = Get-Service gpsvc -ErrorAction SilentlyContinue } catch { }',
      'if ($gpsvc) {',
      "  $etat = 'PROBLEME'",
      "  if ($gpsvc.Status -eq 'Running') { $etat = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Service gpsvc' -Etat $etat -Valeur $gpsvc.Status -Commentaire 'Sans ce service, aucune actualisation n''est possible.')",
      '}',
      '$horodatage = (Get-Date).ToString(\'yyyyMMdd-HHmmss\')',
      "$dossier = [Environment]::GetFolderPath('Desktop')",
      "",
      '# --- 2. Etat AVANT -----------------------------------------------------------------',
      "# On releve ce que la machine applique aujourd'hui. C'est ce releve qui",
      "# donnera un sens a l'actualisation : sans lui, on ne saurait pas ce qui a",
      '# change.',
      'function Get-KjemoGpoAppliquees {',
      '  param([string]$Etendue)',
      '  $sortie = $null',
      '  try { $sortie = & gpresult.exe \'/r\' "/scope:$Etendue" 2>&1 | Out-String } catch { }',
      '  if (-not $sortie) { return @() }',
      "  $bloc = [regex]::Match($sortie, '(?s)(Objets de strategie de groupe appliques|Applied Group Policy Objects)(.*?)(\\r?\\n\\s*\\r?\\n)')",
      '  if (-not $bloc.Success) { return @() }',
      "  return @($bloc.Groups[2].Value -split '\\r?\\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^-+$' })",
      '}',
      "",
      '$avantOrdi = @()',
      '$avantUtil = @()',
      "if ($Portee -ne 'Utilisateur') { $avantOrdi = Get-KjemoGpoAppliquees -Etendue 'computer' }",
      "if ($Portee -ne 'Ordinateur') { $avantUtil = Get-KjemoGpoAppliquees -Etendue 'user' }",
      '[void](Add-KjemoResultat -Categorie \'Avant\' -Controle \'Strategies ordinateur\' -Etat \'INFO\' -Valeur $avantOrdi.Count -Commentaire ($avantOrdi -join \', \'))',
      '[void](Add-KjemoResultat -Categorie \'Avant\' -Controle \'Strategies utilisateur\' -Etat \'INFO\' -Valeur $avantUtil.Count -Commentaire ($avantUtil -join \', \'))',
      "",
      '# --- 3. Ce que /force change, et ce qu\'il ne change pas ---------------------------',
      "if ($Forcer -eq 'Oui') {",
      "  [void](Add-KjemoResultat -Categorie 'Option' -Controle 'Reapplication complete' -Etat 'ATTENTION' -Valeur 'demandee' -Commentaire 'Toutes les strategies seront reappliquees, y compris celles qui n''ont pas change. Plus long, et utile seulement apres une correction de permissions ou un parametre revenu en arriere.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Option' -Controle 'Reapplication complete' -Etat 'OK' -Valeur 'non demandee' -Commentaire 'gpupdate n''appliquera que les strategies modifiees : c''est le comportement normal, et le plus rapide.')",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Redemarrage et fermeture de session' -Etat 'INFO' -Valeur 'jamais automatiques' -Commentaire 'Certains reglages ne prennent effet qu''au redemarrage ou a la prochaine ouverture de session. Ce script ne les declenche pas : c''est a la personne de choisir le moment.')",
      "",
      '# --- 4. Actualisation, uniquement en mode Appliquer ---------------------------------',
      "if ($Mode -eq 'Appliquer') {",
      '  $argsGpupdate = New-Object System.Collections.ArrayList',
      "  if ($Portee -eq 'Ordinateur') { [void]$argsGpupdate.Add('/target:computer') }",
      "  elseif ($Portee -eq 'Utilisateur') { [void]$argsGpupdate.Add('/target:user') }",
      "  if ($Forcer -eq 'Oui') { [void]$argsGpupdate.Add('/force') }",
      '  # Jamais de /boot ni de /logoff : ce script ne decide pas a la place de la',
      "  # personne qui l'execute.",
      "  [void]$argsGpupdate.Add('/wait:120')",
      "",
      '  $sortieMaj = $null',
      '  try {',
      '    $sortieMaj = & gpupdate.exe @argsGpupdate 2>&1 | Out-String',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'gpupdate' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '  if ($sortieMaj) {',
      '    $chemin = Join-Path $dossier "kjemo-gpo-gpupdate-$horodatage.txt"',
      '    try { $sortieMaj | Out-File -FilePath $chemin -Encoding UTF8 } catch { }',
      "    $echec = ($sortieMaj -match 'echou|failed|erreur|error')",
      "    $etatMaj = 'OK'",
      "    if ($echec) { $etatMaj = 'PROBLEME' }",
      '    [void](Add-KjemoResultat -Categorie \'Action\' -Controle \'gpupdate\' -Etat $etatMaj -Valeur ($argsGpupdate -join \' \') -Commentaire $chemin)',
      '  }',
      "",
      '  # --- 5. Etat APRES, et difference ------------------------------------------------',
      '  $apresOrdi = @()',
      '  $apresUtil = @()',
      "  if ($Portee -ne 'Utilisateur') { $apresOrdi = Get-KjemoGpoAppliquees -Etendue 'computer' }",
      "  if ($Portee -ne 'Ordinateur') { $apresUtil = Get-KjemoGpoAppliquees -Etendue 'user' }",
      '  [void](Add-KjemoResultat -Categorie \'Apres\' -Controle \'Strategies ordinateur\' -Etat \'INFO\' -Valeur $apresOrdi.Count -Commentaire ($apresOrdi -join \', \'))',
      '  [void](Add-KjemoResultat -Categorie \'Apres\' -Controle \'Strategies utilisateur\' -Etat \'INFO\' -Valeur $apresUtil.Count -Commentaire ($apresUtil -join \', \'))',
      "",
      '  foreach ($paire in @(@(\'Ordinateur\', $avantOrdi, $apresOrdi), @(\'Utilisateur\', $avantUtil, $apresUtil))) {',
      '    $nom = $paire[0]',
      '    $avant = @($paire[1])',
      '    $apres = @($paire[2])',
      '    $ajoutees = @($apres | Where-Object { $avant -notcontains $_ })',
      '    $retirees = @($avant | Where-Object { $apres -notcontains $_ })',
      '    if ($ajoutees.Count -eq 0 -and $retirees.Count -eq 0) {',
      "      [void](Add-KjemoResultat -Categorie 'Difference' -Controle $nom -Etat 'INFO' -Valeur 'aucun changement' -Commentaire 'Les memes strategies qu''avant. Si une modification etait attendue, elle n''arrive pas jusqu''ici : voir le jeu de strategie resultant.')",
      '    } else {',
      '      [void](Add-KjemoResultat -Categorie \'Difference\' -Controle $nom -Etat \'ATTENTION\' -Valeur ("+$($ajoutees.Count) / -$($retirees.Count)") -Commentaire ("ajoutees : " + ($ajoutees -join \', \') + " ; retirees : " + ($retirees -join \', \')))',
      '    }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host 'En mode Appliquer, le script lancerait gpupdate avec les options choisies,'",
      "  Write-Host 'puis comparerait les strategies appliquees avant et apres. Aucun'",
      "  Write-Host 'redemarrage, aucune fermeture de session.'",
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Actualisation et diagnostic des strategies de groupe',
      outil: 'gpo-refresh-diagnostic',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Portee', psB64(v.majPortee)],
        ['Reapplication', psB64(v.majForce)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-actualisation',
      formats: 'Console',
    });
  },
  gui: [
    'Sur le poste : Démarrer > invite de commandes > gpupdate',
    'Pour la seule moitié Ordinateur : gpupdate /target:computer',
    'Gestion des stratégies de groupe (gpmc.msc) : clic droit sur une OU > Mise à jour de la stratégie de groupe — actualise à distance tous les postes de l’OU.',
    'Après une actualisation, gpresult /r montre ce qui s’applique réellement.',
    'Certains réglages — scripts de démarrage, installation de logiciels — ne prennent effet qu’au redémarrage : c’est à planifier, pas à improviser.',
  ],
  keywords: [
    'gpupdate', 'gpupdate /force', 'actualiser les strategies', 'rafraichir gpo',
    'strategie pas prise en compte', 'gpsvc', 'avant apres gpo', 'application des gpo',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Le script s’exécute sur la machine à actualiser : gpupdate rend compte de la machine où il tourne.',
    'Une console élevée pour la moitié Ordinateur.',
    'Aucun redémarrage ni fermeture de session n’est déclenché : certains réglages attendront donc le prochain cycle.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'gpupdate : la mise à jour de la stratégie utilisateur a échoué',
      cause: 'Le poste ne joint pas de contrôleur de domaine, ou SYSVOL est inaccessible.',
      fix: 'Vérifier la résolution DNS du domaine, puis l’accès à \\\\<domaine>\\SYSVOL depuis ce poste.',
    },
    {
      message: 'gpupdate réussit, mais le réglage attendu n’apparaît toujours pas',
      cause: 'La stratégie est écartée — filtrage de sécurité, filtre WMI, héritage bloqué — ou le réglage attend un redémarrage.',
      fix: 'Produire un jeu de stratégie résultant : il nomme la raison du rejet. C’est précisément ce que la comparaison avant/après de ce script met en évidence.',
    },
    {
      message: 'Un réglage revient à l’ancienne valeur à chaque actualisation',
      cause: 'Une autre stratégie, appliquée plus tard dans l’ordre, écrase la première.',
      fix: 'Lire l’ordre des liens et les marquages Enforced avec l’audit des liens.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport montre les stratégies appliquées avant et après, et la différence entre les deux.',
    'La sortie brute de gpupdate est conservée sur le Bureau.',
    'Aucun redémarrage ni fermeture de session n’a eu lieu.',
  ],
  rollback: {
    summary: 'Actualiser ne configure rien : cela demande au poste de relire les stratégies du domaine. Pour revenir en arrière, c’est la stratégie qu’il faut corriger, puis actualiser à nouveau.',
    diagnostic: '# Que s\'applique-t-il en ce moment sur ce poste ?\ngpresult /r /scope:computer\ngpresult /r /scope:user',
    command: '# Il n\'y a rien a defaire. Si une strategie indesirable s\'est appliquee, on\n# corrige la strategie ou son lien, puis on actualise de nouveau.\ngpupdate\n\n# Retirer les sorties conservees sur le Bureau.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-gpupdate*\' | Remove-Item -Confirm',
    warning: 'Un réglage déjà appliqué ne se retire pas en actualisant : beaucoup de paramètres restent en place tant qu’une stratégie ne les remet pas explicitement à leur valeur d’origine. C’est le fameux « tatouage » de la base de registre.',
  },
  checks: [
    'Commencer sans /force : il n’apporte rien tant qu’on n’a pas corrigé de permissions.',
    'Comparer avant et après : c’est la différence qui renseigne, pas le message de gpupdate.',
    'Aucun redémarrage automatique : si un réglage l’exige, c’est à planifier.',
  ],
  source: 'https://learn.microsoft.com/windows-server/administration/windows-commands/gpupdate',
  sources: [
    { label: 'gpupdate', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/gpupdate' },
    { label: 'gpresult', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult' },
    { label: 'Diagnostiquer l’application d’une stratégie de groupe', url: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/applying-group-policy-troubleshooting-guidance' },
  ],
};

/**
 * 5. gpo-create-link — créer une stratégie, puis la lier.
 *
 * Deux gestes distincts, et c'est volontaire : une GPO existe sans être liée,
 * et ne fait alors rien ; un lien existe sans être actif, et ne fait rien non
 * plus. Les confondre, c'est se retrouver avec une stratégie qu'on croit
 * appliquée. Le script crée, lie, et relit.
 */
export const outilCreerLierGpo = {
  id: 'gpo-create-link',
  icon: '⊕',
  category: 'GPO',
  subcategory: 'Création, liens et ciblage',
  title: 'Créer une GPO et la lier à une OU',
  risk: 'caution',
  summary: 'Crée une stratégie vide puis la lie à une unité d’organisation, avec l’ordre, l’état du lien et l’option Appliqué choisis séparément. Ne touche jamais aux deux stratégies par défaut.',
  fields: [
    champDomaineGpo(),
    {
      id: 'crNomGpo', label: 'Nom de la nouvelle GPO', default: 'GPO-Medecins-Verrouillage',
      help: 'Une convention qui dit à qui et à quoi la stratégie sert évite les GPO dont plus personne ne connaît l’usage.',
    },
    {
      id: 'crOu', label: 'OU à lier', default: 'Médecin',
      help: 'Chemin parent/enfant, relatif au domaine. La stratégie s’appliquera à cette OU et à sa descendance.',
    },
    {
      id: 'crEtatLien', label: 'État du lien', type: 'select', default: 'Inactive',
      options: [
        ['Inactive', 'Inactif — la stratégie est liée mais ne s’applique pas encore'],
        ['Active', 'Actif — la stratégie s’applique dès le prochain cycle'],
      ],
      help: 'Lier inactif puis activer après relecture est la façon prudente : le lien est en place, et rien ne bouge tant qu’on ne le décide pas.',
    },
    {
      id: 'crOrdre', label: 'Ordre du lien sur l’OU', default: '1',
      help: '1 est le plus prioritaire : en cas de conflit, c’est lui qui l’emporte sur cette OU.',
    },
    {
      id: 'crApplique', label: 'Marquer le lien « Appliqué » (Enforced)', type: 'select', default: 'Non',
      options: [
        ['Non', 'Non — comportement normal'],
        ['Oui', 'Oui — traverse les blocages d’héritage et gagne sur les OU filles'],
      ],
      help: 'Enforced est une exception : elle traverse Block Inheritance et prend le dessus plus bas dans l’arborescence. Utile pour une règle de sécurité non négociable, pénible partout ailleurs.',
    },
    champMode('Diagnostic vérifie l’OU, le nom libre et les conflits. Appliquer crée la GPO et pose le lien.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'crNomGpo', validerNomGpoModifiable(v.crNomGpo));
    verifier(errors, 'crOu', validerCheminOu(v.crOu));
    verifier(errors, 'crEtatLien', validerEtatLien(v.crEtatLien));
    verifier(errors, 'crOrdre', validerOrdreLien(v.crOrdre));
    verifier(errors, 'crApplique', validerApplicationLien(v.crApplique));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const nomGpo = validerNomGpoModifiable(v.crNomGpo).value;
    const dnOu = cheminOuVersDn(validerCheminOu(v.crOu).value, domaine);

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$NomGpo = ${psB64(nomGpo)}`,
      `$DnOu = ${psB64(dnOu)}`,
      `$EtatLien = ${psB64(v.crEtatLien)}`,
      `$OrdreLien = ${validerOrdreLien(v.crOrdre).value}`,
      `$Applique = ${psB64(v.crApplique)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleGpo(),
      blocGpoParDefaut(),
      "",
      '# --- 1. Le nom est-il libre ? -------------------------------------------------',
      '$existante = $null',
      'if ($domaineJoignable) {',
      '  try { $existante = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction SilentlyContinue } catch { }',
      '}',
      'if ($existante) {',
      '  [void](Add-KjemoResultat -Categorie \'Creation\' -Controle \'Nom de la GPO\' -Etat \'ATTENTION\' -Valeur ("deja pris — " + $existante.Id.Guid) -Commentaire \'Une strategie porte deja ce nom. Elle ne sera ni recreee, ni modifiee ; seul le lien sera pose si besoin.\')',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Creation' -Controle 'Nom de la GPO' -Etat 'OK' -Valeur 'libre')",
      '}',
      "",
      '# --- 2. L\'OU existe-t-elle ? ---------------------------------------------------',
      '$ouOk = $false',
      'try {',
      '  Import-Module ActiveDirectory -ErrorAction SilentlyContinue',
      '  if (Get-ADOrganizationalUnit -Identity $DnOu -ErrorAction SilentlyContinue) { $ouOk = $true }',
      '} catch { }',
      'if ($ouOk) {',
      "  [void](Add-KjemoResultat -Categorie 'Destination' -Controle 'OU cible' -Etat 'OK' -Valeur $DnOu)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Destination' -Controle 'OU cible' -Etat 'PROBLEME' -Valeur $DnOu -Commentaire 'OU introuvable, ou module ActiveDirectory absent. Aucun lien ne sera pose.')",
      '}',
      "",
      '# --- 3. Ce qui est deja lie a cette OU ------------------------------------------',
      "# C'est la sauvegarde prealable : avant de poser un lien, on note ceux qui",
      "# existent, avec leur ordre. Changer l'ordre d'un lien change ce qui gagne",
      '# en cas de conflit, et cela ne se devine pas apres coup.',
      '$liensExistants = @()',
      'if ($moduleOk -and $ouOk) {',
      '  try {',
      '    $heritage = Get-GPInheritance -Target $DnOu -Domain $Domaine -ErrorAction Stop',
      '    $liensExistants = @($heritage.GpoLinks)',
      '  } catch { }',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Liens existants' -Controle 'Nombre' -Etat 'INFO' -Valeur $liensExistants.Count -Commentaire 'Releve AVANT toute modification : c''est lui qui permet de revenir en arriere.')",
      'foreach ($l in $liensExistants) {',
      '  [void](Add-KjemoResultat -Categorie \'Liens existants\' -Controle $l.DisplayName -Etat \'INFO\' -Valeur ("ordre $($l.Order) ; actif : $($l.Enabled) ; applique : $($l.Enforced)"))',
      '}',
      'if ($liensExistants.Count -gt 0) {',
      "  $dossier = [Environment]::GetFolderPath('Desktop')",
      "  $horodatage = (Get-Date).ToString('yyyyMMdd-HHmmss')",
      '  $sauvegardeLiens = Join-Path $dossier "kjemo-gpo-liens-avant-$horodatage.csv"',
      '  try {',
      '    $liensExistants | Select-Object DisplayName,Order,Enabled,Enforced,Target |',
      '      Export-Csv -LiteralPath $sauvegardeLiens -NoTypeInformation -Encoding UTF8 -ErrorAction Stop',
      "    [void](Add-KjemoResultat -Categorie 'Liens existants' -Controle 'Releve conserve' -Etat 'OK' -Valeur $sauvegardeLiens)",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Liens existants' -Controle 'Releve conserve' -Etat 'ATTENTION' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      "",
      '# --- 4. Ce que les options choisies impliquent -----------------------------------',
      "if ($Applique -eq 'Oui') {",
      "  [void](Add-KjemoResultat -Categorie 'Options' -Controle 'Lien applique (Enforced)' -Etat 'ATTENTION' -Valeur 'demande' -Commentaire 'Ce lien traversera les blocages d''heritage et gagnera sur les OU filles. A reserver aux regles non negociables.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Options' -Controle 'Lien applique (Enforced)' -Etat 'OK' -Valeur 'non demande')",
      '}',
      "if ($EtatLien -eq 'Inactive') {",
      "  [void](Add-KjemoResultat -Categorie 'Options' -Controle 'Etat du lien' -Etat 'OK' -Valeur 'inactif' -Commentaire 'La strategie sera liee mais ne s''appliquera pas. Active le lien apres relecture du contenu.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Options' -Controle 'Etat du lien' -Etat 'ATTENTION' -Valeur 'actif' -Commentaire 'La strategie s''appliquera des le prochain cycle d''actualisation, soit sous 90 a 120 minutes.')",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Options' -Controle 'Contenu de la GPO' -Etat 'INFO' -Valeur 'vide' -Commentaire 'Ce script cree une strategie SANS reglage. Son contenu se definit ensuite, dans l''editeur de strategie ou avec les autres assistants de ce lot.')",
      "",
      '# --- 5. Creation et lien, uniquement en mode Appliquer ----------------------------',
      "if ($Mode -eq 'Appliquer' -and $moduleOk -and $cibleAutorisee -and $ouOk) {",
      '  $gpo = $existante',
      '  if (-not $gpo) {',
      '    try {',
      '      $gpo = New-GPO -Name $NomGpo -Domain $Domaine -Comment "Creee par KJEMO IT Toolkit" -ErrorAction Stop',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle \'Creation\' -Etat \'OK\' -Valeur $gpo.Id.Guid)',
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Droit de creer des strategies manquant : il appartient aux Proprietaires createurs de la strategie de groupe.')",
      '    }',
      '  }',
      "",
      '  if ($gpo) {',
      '    $dejaLiee = @($liensExistants | Where-Object { $_.DisplayName -eq $NomGpo })',
      '    if ($dejaLiee.Count -gt 0) {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Lien' -Etat 'IGNORE' -Valeur 'deja lie a cette OU' -Commentaire 'Aucun doublon de lien n''est cree. Modifie l''ordre ou l''etat depuis la console si besoin.')",
      '    } else {',
      '      try {',
      "        if ($Applique -eq 'Oui') {",
      '          New-GPLink -Name $NomGpo -Target $DnOu -Domain $Domaine -LinkEnabled $EtatLien -Order $OrdreLien -Enforced Yes -ErrorAction Stop | Out-Null',
      '        } else {',
      '          New-GPLink -Name $NomGpo -Target $DnOu -Domain $Domaine -LinkEnabled $EtatLien -Order $OrdreLien -ErrorAction Stop | Out-Null',
      '        }',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Lien' -Etat 'OK' -Valeur \"$NomGpo -> $DnOu (ordre $OrdreLien, $EtatLien)\")",
      '      } catch {',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Lien' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Droit de lier des strategies sur cette OU manquant, ou ordre hors de la plage existante.')",
      '      }',
      '    }',
      '  }',
      "",
      '  # --- 6. Relecture apres action ---------------------------------------------------',
      '  try {',
      '    $apres = Get-GPInheritance -Target $DnOu -Domain $Domaine -ErrorAction SilentlyContinue',
      '    foreach ($l in @($apres.GpoLinks)) {',
      '      [void](Add-KjemoResultat -Categorie \'Verification\' -Controle $l.DisplayName -Etat \'OK\' -Valeur ("ordre $($l.Order) ; actif : $($l.Enabled) ; applique : $($l.Enforced)"))',
      '    }',
      '  } catch { }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host 'En mode Appliquer, le script creerait la strategie si le nom est libre,'",
      "  Write-Host 'puis poserait le lien avec l''ordre et l''etat choisis, et relirait l''OU.'",
      '}',
      blocModeDiagnostic(),
      blocAucuneSuppressionGpo(),
    ];

    return assembler({
      titre: 'Creer une strategie de groupe et la lier a une OU',
      outil: 'gpo-create-link',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NomGpo', psB64(nomGpo)],
        ['OuCible', psB64(dnOu)],
        ['EtatLien', psB64(v.crEtatLien)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-creation',
      formats: 'Console',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > Objets de stratégie de groupe > clic droit > Nouveau.',
    'Pour lier : clic droit sur l’OU > Lier un objet de stratégie de groupe existant.',
    'Onglet Objets de stratégie de groupe liés de l’OU : la colonne Ordre des liens se modifie avec les flèches.',
    'Clic droit sur un lien > Lien activé : décocher lie sans appliquer.',
    'Clic droit sur un lien > Appliqué : c’est l’option Enforced, à réserver aux règles non négociables.',
  ],
  keywords: [
    'creer une gpo', 'new-gpo', 'lier une gpo', 'new-gplink', 'ordre des liens',
    'enforced', 'applique', 'lien desactive', 'gpo vide', 'strategie sur une ou',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Droit de créer des stratégies : appartenance au groupe Propriétaires créateurs de la stratégie de groupe.',
    'Droit de lier des stratégies sur l’OU visée : c’est une délégation distincte de la création.',
    'Le module ActiveDirectory, pour vérifier que l’OU existe avant de lier.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'New-GPO : Une stratégie de groupe du même nom existe déjà',
      cause: 'Le nom est déjà pris dans le domaine.',
      fix: 'Le script le détecte avant d’agir : la stratégie existante n’est ni recréée, ni modifiée.',
    },
    {
      message: 'New-GPLink : L’argument Order n’est pas valide',
      cause: 'L’ordre demandé dépasse le nombre de liens déjà présents sur l’OU, plus un.',
      fix: 'Lire le relevé des liens existants au début du rapport, et choisir un ordre dans la plage.',
    },
    {
      message: 'La GPO est liée mais rien ne change sur les postes',
      cause: 'Le lien a été posé inactif, ou la stratégie est vide — ce qui est le cas à la création.',
      fix: 'Définir le contenu de la stratégie, puis activer le lien. L’actualisation suit sous 90 à 120 minutes.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le relevé des liens existants est écrit en CSV sur le Bureau AVANT toute modification.',
    'Le script relit l’OU après action et affiche l’ordre, l’état et le marquage de chaque lien.',
    'Dans gpmc.msc, la stratégie apparaît sous l’OU avec l’état attendu.',
  ],
  rollback: {
    summary: 'Un lien se retire sans rien détruire : la stratégie reste, seul son point d’application disparaît. Une stratégie créée par erreur et vide se supprime proprement — mais ce script ne la supprime jamais de lui-même.',
    diagnostic: '# Constater l\'etat des liens sur l\'OU, et le contenu de la strategie.\nGet-GPInheritance -Target \'<dn-de-l-ou>\' | Select-Object -ExpandProperty GpoLinks | Format-Table DisplayName,Order,Enabled,Enforced\nGet-GPO -Name \'<nom-de-la-gpo>\' | Format-List DisplayName,Id,CreationTime,ModificationTime',
    command: '# Etape 1 — desactiver le lien : reversible, immediat, la strategie reste en\n# place et cesse simplement de s\'appliquer.\nSet-GPLink -Name \'<nom-de-la-gpo>\' -Target \'<dn-de-l-ou>\' -LinkEnabled No\n\n# Etape 2 — retirer le lien, si la strategie n\'a plus rien a faire sur cette OU.\n# -Confirm est explicite : PowerShell demandera confirmation.\nRemove-GPLink -Name \'<nom-de-la-gpo>\' -Target \'<dn-de-l-ou>\' -Confirm\n\n# Etape 3 — remettre les ordres d\'origine, lus dans le CSV conserve.\n#   Set-GPLink -Name \'<nom>\' -Target \'<dn>\' -Order <ordre-d-origine>',
    exceptional: '# AVERTISSEMENT CRITIQUE — suppression d\'une strategie de groupe.\n#\n# Supprimer une GPO retire TOUS ses liens, dans tout le domaine, et detruit son\n# contenu. Ce qu\'elle configurait ne revient pas a l\'etat anterieur : les\n# reglages deja ecrits dans la base de registre des postes y restent, souvent\n# pour toujours. C\'est le « tatouage » : une strategie retiree ne defait pas ce\n# qu\'elle avait fait.\n#\n# Avant d\'y penser :\n#   1. Sauvegarder la strategie (Backup-GPO) et verifier la sauvegarde.\n#   2. Relever tous ses liens, dans tout le domaine, pas seulement sur une OU.\n#   3. Prevoir une strategie qui remet explicitement les reglages a leur valeur\n#      d\'origine, sans quoi les postes resteront configures.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/grouppolicy/remove-gpo\n#\n# Commande, a executer manuellement :\n#   Remove-GPO -Name \'<nom-de-la-gpo>\' -Confirm',
    warning: 'Désactiver un lien est immédiat et sans perte. Supprimer une stratégie ne l’est pas : les réglages déjà écrits sur les postes y restent, et il faut une stratégie de remise à zéro pour les défaire.',
  },
  checks: [
    'Lier inactif, relire le contenu, activer ensuite : l’ordre prudent.',
    'Une GPO créée ici est vide : son contenu se définit après.',
    'Enforced traverse les blocages d’héritage — à réserver aux règles non négociables.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/grouppolicy/new-gpo',
  sources: [
    { label: 'New-GPO', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/new-gpo' },
    { label: 'New-GPLink', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/new-gplink' },
    { label: 'Set-GPLink', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gplink' },
    { label: 'Remove-GPO', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/remove-gpo' },
  ],
};

/**
 * 6. gpo-link-audit — qui gagne, et pourquoi.
 *
 * Les stratégies s'appliquent du site au domaine, puis d'OU en OU, et la
 * dernière appliquée l'emporte. Deux mécanismes renversent cet ordre :
 * Block Inheritance, qui coupe ce qui vient d'en haut, et Enforced, qui passe
 * outre le blocage. Quand un réglage « ne tient pas », la réponse est presque
 * toujours dans cette arborescence.
 */
export const outilAuditLiens = {
  id: 'gpo-link-audit',
  icon: '⑂',
  category: 'GPO',
  subcategory: 'Création, liens et ciblage',
  title: 'Auditer l’héritage et les liens GPO',
  risk: 'diagnostic',
  summary: 'Parcourt les OU du domaine et montre, pour chacune, les liens directs, l’héritage, les blocages, les marquages Appliqué, les liens inactifs et l’ordre de priorité. N’écrit rien.',
  fields: [
    champDomaineGpo(),
    {
      id: 'auOu', label: 'Limiter à une OU (facultatif)', default: '',
      help: 'Chemin parent/enfant, relatif au domaine. Laisse vide pour parcourir tout le domaine.',
    },
    {
      id: 'auVue', label: 'Vue', type: 'select', default: 'Complete',
      options: [
        ['Complete', 'Complète — liens directs et héritage'],
        ['Directs', 'Liens directs seulement — plus court'],
      ],
    },
    champFormat('auFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    const ou = String(v.auOu ?? '').trim();
    if (ou !== '') verifier(errors, 'auOu', validerCheminOu(ou));
    verifier(errors, 'auVue', validerChoix(v.auVue, ['Complete', 'Directs'], 'La vue'));
    verifier(errors, 'auFormat', validerFormatRapport(v.auFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const ou = String(v.auOu ?? '').trim();
    const racine = ou === '' ? domainToDn(domaine) : cheminOuVersDn(validerCheminOu(ou).value, domaine);

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Racine = ${psB64(racine)}`,
      `$Vue = ${psB64(v.auVue)}`,
      `$KjemoFormat = ${psB64(v.auFormat)}`,
      "",
      blocModuleGpo(),
      "",
      '# --- 1. Les unites a parcourir --------------------------------------------------',
      '$unites = @()',
      'try {',
      '  Import-Module ActiveDirectory -ErrorAction SilentlyContinue',
      '  $unites = @(Get-ADOrganizationalUnit -SearchBase $Racine -Filter * -ErrorAction SilentlyContinue)',
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Perimetre' -Controle 'Unites examinees' -Etat 'INFO' -Valeur $unites.Count -Commentaire $Racine)",
      "",
      '# La racine du domaine porte elle aussi des liens : Default Domain Policy y',
      "# est liee, et souvent d'autres. On la traite comme une OU.",
      '$cibles = New-Object System.Collections.ArrayList',
      '[void]$cibles.Add((domainToDnMarqueur))',
      'foreach ($u in ($unites | Sort-Object DistinguishedName)) { [void]$cibles.Add($u.DistinguishedName) }',
      "",
      '# --- 2. Liens et heritage, unite par unite ----------------------------------------',
      '$blocages = 0',
      '$appliques = 0',
      '$inactifs = 0',
      'foreach ($cible in $cibles) {',
      '  $heritage = $null',
      '  try { $heritage = Get-GPInheritance -Target $cible -Domain $Domaine -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $heritage) {',
      "    [void](Add-KjemoResultat -Categorie 'Heritage' -Controle $cible -Etat 'ATTENTION' -Valeur 'illisible' -Commentaire 'Droits insuffisants sur cette unite, ou objet disparu entre deux lectures.')",
      '    continue',
      '  }',
      "",
      "  $etatBlocage = 'OK'",
      "  $noteBlocage = ''",
      '  if ($heritage.GpoInheritanceBlocked -eq $true) {',
      '    $blocages = $blocages + 1',
      "    $etatBlocage = 'ATTENTION'",
      "    $noteBlocage = 'Heritage bloque : rien de ce qui vient d''en haut ne s''applique ici, SAUF les liens marques Applique.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Heritage\' -Controle $cible -Etat $etatBlocage -Valeur ("blocage : $($heritage.GpoInheritanceBlocked) ; liens directs : $(@($heritage.GpoLinks).Count) ; effectifs : $(@($heritage.InheritedGpoLinks).Count)") -Commentaire $noteBlocage)',
      "",
      '  foreach ($l in @($heritage.GpoLinks)) {',
      "    $etatL = 'INFO'",
      "    $note = ''",
      '    if ($l.Enforced -eq $true) {',
      '      $appliques = $appliques + 1',
      "      $etatL = 'ATTENTION'",
      "      $note = 'Lien applique : il traverse les blocages d''heritage et gagne sur les OU filles.'",
      '    }',
      '    if ($l.Enabled -eq $false) {',
      '      $inactifs = $inactifs + 1',
      "      $etatL = 'ATTENTION'",
      "      $note = $note + ' Lien inactif : la strategie est liee mais ne s''applique pas.'",
      '    }',
      '    [void](Add-KjemoResultat -Categorie \'Liens directs\' -Controle ("$($l.DisplayName) sur " + $cible) -Etat $etatL -Valeur ("ordre $($l.Order)") -Commentaire $note)',
      '  }',
      "",
      "  if ($Vue -eq 'Complete') {",
      "    # L'ordre effectif est celui que le client applique vraiment : le dernier",
      "    # de la liste l'emporte en cas de conflit.",
      '    $effectifs = @($heritage.InheritedGpoLinks)',
      '    if ($effectifs.Count -gt 0) {',
      '      $noms = @($effectifs | ForEach-Object { $_.DisplayName })',
      "      [void](Add-KjemoResultat -Categorie 'Ordre effectif' -Controle $cible -Etat 'INFO' -Valeur ($noms -join '  >  ') -Commentaire 'De gauche a droite : la derniere nommee l''emporte en cas de conflit sur un meme reglage.')",
      '    }',
      '  }',
      '}',
      "",
      '# --- 3. Synthese -------------------------------------------------------------------',
      "$etat = 'OK'",
      "if ($blocages -gt 0) { $etat = 'ATTENTION' }",
      "[void](Add-KjemoResultat -Categorie 'Synthese' -Controle 'Unites avec heritage bloque' -Etat $etat -Valeur $blocages -Commentaire 'Un blocage d''heritage est rarement une erreur, mais il explique souvent qu''une strategie du domaine ne descende pas.')",
      "$etat = 'OK'",
      "if ($appliques -gt 0) { $etat = 'ATTENTION' }",
      "[void](Add-KjemoResultat -Categorie 'Synthese' -Controle 'Liens marques Applique' -Etat $etat -Valeur $appliques -Commentaire 'Chaque lien applique est une exception a l''ordre normal : il doit se justifier.')",
      "$etat = 'OK'",
      "if ($inactifs -gt 0) { $etat = 'ATTENTION' }",
      "[void](Add-KjemoResultat -Categorie 'Synthese' -Controle 'Liens inactifs' -Etat $etat -Valeur $inactifs -Commentaire 'Un lien inactif oublie fait croire qu''une strategie s''applique alors qu''elle ne fait rien.')",
      "[void](Add-KjemoResultat -Categorie 'Synthese' -Controle 'Portee' -Etat 'INFO' -Valeur 'lecture seule' -Commentaire 'Aucun lien n''est cree, modifie, active, desactive ni retire par ce script.')",
    ];

    return assembler({
      titre: 'Audit de l\'heritage et des liens de strategie de groupe',
      outil: 'gpo-link-audit',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Racine', psB64(racine)],
        ['Vue', psB64(v.auVue)],
        ['Format', psB64(v.auFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-liens',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > sélectionner une OU > onglet Objets de stratégie de groupe liés : les liens directs, avec leur ordre.',
    'Onglet Héritage de stratégie de groupe de la même OU : l’ordre effectif, héritage compris.',
    'Clic droit sur une OU > Bloquer l’héritage : la coche qui explique bien des absences.',
    'Une OU dont l’héritage est bloqué porte un point d’exclamation bleu dans l’arborescence.',
    'Clic droit sur un lien > Appliqué : c’est le marquage Enforced, qui traverse les blocages.',
  ],
  keywords: [
    'heritage gpo', 'block inheritance', 'enforced', 'applique', 'ordre des liens',
    'get-gpinheritance', 'priorite gpo', 'lien desactive', 'gpo qui ne descend pas',
    'conflit de strategies',
  ],
  requiresAdmin: false,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Module ActiveDirectory, pour énumérer les unités d’organisation du périmètre.',
    'Droit de lecture sur les OU examinées : une OU illisible est signalée, et non comptée comme saine.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Get-GPInheritance : Impossible de trouver la cible spécifiée',
      cause: 'Le nom distinctif ne correspond à aucune OU, ou le compte ne peut pas la lire.',
      fix: 'Vérifier le chemin d’OU. Un chemin accentué doit être écrit exactement comme dans l’annuaire.',
    },
    {
      message: 'Une stratégie du domaine ne s’applique pas sur une OU précise',
      cause: 'L’héritage est bloqué sur cette OU, ou sur une OU intermédiaire.',
      fix: 'Le rapport nomme les unités concernées. Seuls les liens marqués Appliqué traversent un blocage.',
    },
    {
      message: 'Deux stratégies règlent le même paramètre et c’est la « mauvaise » qui gagne',
      cause: 'L’ordre effectif place l’autre plus tard : la dernière appliquée l’emporte.',
      fix: 'Lire la ligne « Ordre effectif » de l’OU concernée, puis changer l’ordre des liens plutôt que le contenu des stratégies.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le nombre d’unités examinées correspond au périmètre demandé.',
    'Chaque unité porte son état de blocage, ses liens directs et, en vue complète, son ordre effectif.',
    'Les compteurs finaux donnent les blocages, les liens appliqués et les liens inactifs.',
  ],
  rollback: {
    summary: 'Cet audit lit l’héritage et les liens. Il ne crée, ne modifie, n’active, ne désactive et ne retire aucun lien. La seule trace est le fichier de rapport.',
    diagnostic: '# Relire l\'heritage d\'une OU precise, pour comparer apres une correction.\nGet-GPInheritance -Target \'<dn-de-l-ou>\' | Format-List Name,GpoInheritanceBlocked\nGet-GPInheritance -Target \'<dn-de-l-ou>\' | Select-Object -ExpandProperty GpoLinks | Format-Table DisplayName,Order,Enabled,Enforced',
    command: '# Retirer un rapport devenu inutile.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-liens*\' | Remove-Item -Confirm',
    warning: 'Le rapport décrit où chaque stratégie du domaine s’applique et dans quel ordre. C’est la carte de la configuration : elle se range comme un document interne.',
  },
  checks: [
    'Lire l’ordre effectif avant de modifier le contenu d’une stratégie : le conflit vient souvent de l’ordre.',
    'Un héritage bloqué explique la plupart des « la GPO du domaine ne descend pas ».',
    'Un lien inactif oublié fait croire qu’une stratégie s’applique alors qu’elle ne fait rien.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpinheritance',
  sources: [
    { label: 'Get-GPInheritance', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gpinheritance' },
    { label: 'Set-GPInheritance', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gpinheritance' },
    { label: 'Set-GPLink', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gplink' },
  ],
};

/**
 * 7. gpo-security-filter — à qui la stratégie s'applique vraiment.
 *
 * Une GPO liée à une OU s'applique à tout ce qu'elle contient — à condition
 * que le compte ait, sur la stratégie, le droit « Appliquer la stratégie de
 * groupe ». Retirer Utilisateurs authentifiés sans donner ce droit à un autre
 * groupe est l'erreur la plus fréquente : la stratégie est bien là, bien liée,
 * et ne s'applique à personne.
 */
export const outilFiltrageSecuriteGpo = {
  id: 'gpo-security-filter',
  icon: '⛉',
  category: 'GPO',
  subcategory: 'Création, liens et ciblage',
  title: 'Vérifier le filtrage de sécurité d’une GPO',
  risk: 'caution',
  summary: 'Lit les droits Lecture et Appliquer la stratégie de groupe d’une stratégie, signale les cas où plus personne ne l’applique, et n’ajoute un groupe qu’avec confirmation explicite.',
  fields: [
    champDomaineGpo(),
    {
      id: 'fsNomGpo', label: 'GPO examinée', default: 'GPO-Medecins-Verrouillage',
      help: 'Nom exact tel qu’il apparaît dans la console.',
    },
    {
      id: 'fsGroupe', label: 'Groupe à autoriser', default: 'GG-Medecins',
      help: 'Ce groupe recevra Lecture et Appliquer la stratégie de groupe en mode Appliquer. Vide, le script se contente du diagnostic.',
    },
    champMode('Diagnostic lit le filtrage. Appliquer ajoute le groupe indiqué, et n’en retire aucun.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'fsNomGpo', validerNomGpoModifiable(v.fsNomGpo));
    // Le groupe est demandé dans les deux modes : en Diagnostic il sert de point
    // de comparaison — « ce groupe applique-t-il déjà la stratégie ? » — et en
    // Appliquer il est la cible de l'autorisation. Facultatif, il produirait un
    // rapport qui ne répond à rien.
    verifier(errors, 'fsGroupe', validateGroupName(v.fsGroupe));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const nomGpo = validerNomGpoModifiable(v.fsNomGpo).value;
    const groupe = String(v.fsGroupe ?? '').trim();

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$NomGpo = ${psB64(nomGpo)}`,
      `$Groupe = ${psB64(groupe)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleGpo(),
      blocGpoParDefaut(),
      "",
      '# --- 1. La strategie existe-t-elle ? ---------------------------------------------',
      '$gpo = $null',
      'if ($domaineJoignable) {',
      '  try { $gpo = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction Stop } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Nom introuvable : verifie l''orthographe exacte dans la console.')",
      '  }',
      '}',
      'if ($gpo) {',
      '  [void](Add-KjemoResultat -Categorie \'Cible\' -Controle \'Strategie\' -Etat \'OK\' -Valeur $gpo.DisplayName -Commentaire $gpo.Id.Guid)',
      '}',
      "",
      '# --- 2. Qui peut lire, et qui applique -------------------------------------------',
      "# Deux droits distincts, et c'est toute la subtilite : Read permet de lire la",
      "# strategie, GpoApply permet de se la voir appliquer. Un compte qui lit sans",
      '# appliquer ne recoit rien.',
      '$permissions = @()',
      'if ($gpo) {',
      '  try { $permissions = @(Get-GPPermission -Guid $gpo.Id -All -Domain $Domaine -ErrorAction Stop) } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Filtrage' -Controle 'Lecture des permissions' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      '$appliquent = New-Object System.Collections.ArrayList',
      '$lisentSeulement = New-Object System.Collections.ArrayList',
      'foreach ($p in $permissions) {',
      '  $qui = $p.Trustee.Name',
      "  if (-not $qui) { $qui = $p.Trustee.Sid.Value }",
      "  if ($p.Permission -eq 'GpoApply') {",
      '    [void]$appliquent.Add($qui)',
      "    [void](Add-KjemoResultat -Categorie 'Filtrage' -Controle $qui -Etat 'OK' -Valeur 'Lecture + Appliquer la strategie de groupe' -Commentaire 'Ce groupe recoit reellement la strategie.')",
      "  } elseif ($p.Permission -eq 'GpoRead') {",
      '    [void]$lisentSeulement.Add($qui)',
      "    [void](Add-KjemoResultat -Categorie 'Filtrage' -Controle $qui -Etat 'INFO' -Valeur 'Lecture seule' -Commentaire 'Peut lire la strategie, mais ne se la voit PAS appliquer.')",
      '  } else {',
      '    [void](Add-KjemoResultat -Categorie \'Delegation\' -Controle $qui -Etat \'INFO\' -Valeur $p.Permission)',
      '  }',
      '}',
      "",
      '# --- 3. Le cas qui fait perdre des journees ---------------------------------------',
      'if ($gpo) {',
      '  if ($appliquent.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Verdict' -Controle 'Qui applique cette strategie' -Etat 'PROBLEME' -Valeur 'personne' -Commentaire 'La strategie est liee mais ne s''applique a AUCUN compte. C''est le resultat classique du retrait d''Utilisateurs authentifies sans remplacement.')",
      '  } else {',
      '    [void](Add-KjemoResultat -Categorie \'Verdict\' -Controle \'Qui applique cette strategie\' -Etat \'OK\' -Valeur ($appliquent -join \', \'))',
      '  }',
      "  $authentifies = @($permissions | Where-Object { $_.Trustee.Name -match 'Authenticated Users|Utilisateurs authentifies' })",
      '  if ($authentifies.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Verdict' -Controle 'Utilisateurs authentifies' -Etat 'ATTENTION' -Valeur 'absent' -Commentaire 'Depuis MS16-072, les ordinateurs doivent pouvoir LIRE la strategie pour que la moitie Utilisateur s''applique. Si le groupe a ete retire, ajoute Ordinateurs du domaine en lecture.')",
      '  } else {',
      '    $p0 = $authentifies[0]',
      '    [void](Add-KjemoResultat -Categorie \'Verdict\' -Controle \'Utilisateurs authentifies\' -Etat \'INFO\' -Valeur $p0.Permission)',
      '  }',
      '}',
      "",
      '# --- 4. Le groupe vise applique-t-il deja la strategie ? ---------------------------',
      'if ($gpo) {',
      '  if ($appliquent -contains $Groupe) {',
      "    [void](Add-KjemoResultat -Categorie 'Verdict' -Controle $Groupe -Etat 'OK' -Valeur 'applique deja cette strategie' -Commentaire 'Rien a ajouter : l''autorisation est en place.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Verdict' -Controle $Groupe -Etat 'ATTENTION' -Valeur 'n''applique pas encore cette strategie' -Commentaire 'En mode Appliquer, le droit Lecture + Appliquer lui sera accorde.')",
      '  }',
      '}',
      '',
      '# --- 5. Ajout du groupe, uniquement en mode Appliquer -----------------------------',
      "# On AJOUTE un droit. On n'en retire aucun : retirer un filtrage de securite",
      '# coupe la strategie pour des comptes qui la recevaient, et le symptome',
      "# n'apparait qu'au prochain cycle, sans message.",
      "if ($Mode -eq 'Appliquer' -and $gpo -and $cibleAutorisee -and $Groupe -ne '') {",
      '  $avant = @($appliquent)',
      '  try {',
      '    Set-GPPermission -Guid $gpo.Id -TargetName $Groupe -TargetType Group -PermissionLevel GpoApply -Domain $Domaine -ErrorAction Stop | Out-Null',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Autorisation ajoutee' -Etat 'OK' -Valeur \"$Groupe : Lecture + Appliquer\")",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Autorisation ajoutee' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Groupe introuvable, ou droits insuffisants sur la strategie.')",
      '  }',
      "",
      '  # --- 6. Relecture apres action ---------------------------------------------------',
      '  $apres = @()',
      '  try {',
      '    $apres = @(Get-GPPermission -Guid $gpo.Id -All -Domain $Domaine -ErrorAction SilentlyContinue |',
      "      Where-Object { $_.Permission -eq 'GpoApply' } | ForEach-Object { $_.Trustee.Name })",
      '  } catch { }',
      '  [void](Add-KjemoResultat -Categorie \'Verification\' -Controle \'Appliquent la strategie\' -Etat \'OK\' -Valeur ($apres -join \', \') -Commentaire ("avant : " + ($avant -join \', \')))',
      '  $perdus = @($avant | Where-Object { $apres -notcontains $_ })',
      '  if ($perdus.Count -gt 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Autorisations perdues' -Etat 'PROBLEME' -Valeur ($perdus -join ', ') -Commentaire 'Ce script n''en retire aucune : si une autorisation a disparu, elle vient d''ailleurs.')",
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host 'En mode Appliquer, le script donnerait au groupe indique le droit'",
      "  Write-Host 'Lecture + Appliquer la strategie de groupe. Il n''en retire jamais aucun :'",
      "  Write-Host 'le retrait d''un filtrage se fait a la main, en sachant qui va le perdre.'",
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Filtrage de securite d\'une strategie de groupe',
      outil: 'gpo-security-filter',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NomGpo', psB64(nomGpo)],
        ['GroupeAutorise', psB64(groupe)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-filtrage',
      formats: 'Console',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > sélectionner la GPO > onglet Étendue > section Filtrage de sécurité.',
    'Ajouter un groupe ici lui donne Lecture et Appliquer la stratégie de groupe en une fois.',
    'Onglet Délégation > bouton Avancé : la vue complète des permissions, où Appliquer la stratégie de groupe est une case distincte de Lecture.',
    'Après MS16-072 : si Utilisateurs authentifiés a été retiré, ajouter Ordinateurs du domaine en Lecture seule, sans quoi la moitié Utilisateur ne s’applique plus.',
    'Retirer un groupe du filtrage se fait ici, en sachant qui perdra la stratégie.',
  ],
  keywords: [
    'filtrage de securite', 'apply group policy', 'gpoapply', 'set-gppermission',
    'get-gppermission', 'utilisateurs authentifies', 'ms16-072', 'gpo qui ne s’applique a personne',
    'cibler un groupe', 'delegation gpo',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Droit de modifier les paramètres de sécurité de la stratégie, pour le mode Appliquer.',
    'Le groupe à autoriser doit exister dans le domaine : le script ne le crée pas.',
    'Connaître les comptes qui reçoivent aujourd’hui la stratégie, avant d’en restreindre la portée.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'La GPO est liée, le filtrage semble correct, et rien ne s’applique',
      cause: 'Le groupe autorisé a Lecture mais pas Appliquer la stratégie de groupe : ce sont deux droits distincts.',
      fix: 'Le rapport sépare explicitement « Lecture seule » et « Lecture + Appliquer ».',
    },
    {
      message: 'Depuis une mise à jour, la moitié Utilisateur ne s’applique plus',
      code: 'MS16-072',
      cause: 'Les stratégies utilisateur sont désormais lues dans le contexte de l’ordinateur : si Utilisateurs authentifiés a été retiré, l’ordinateur ne peut plus lire la stratégie.',
      fix: 'Ajouter Ordinateurs du domaine, ou Utilisateurs authentifiés, avec le droit Lecture.',
    },
    {
      message: 'Set-GPPermission : Impossible de trouver le compte spécifié',
      cause: 'Le nom de groupe n’existe pas dans le domaine, ou il est écrit différemment.',
      fix: 'Vérifier le nom exact du groupe avec l’outil de groupes Active Directory.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport sépare les comptes qui lisent seulement de ceux qui appliquent réellement.',
    'Après ajout, le script relit les permissions et compare avec l’état d’avant.',
    'Aucune autorisation n’a disparu : le script le vérifie explicitement.',
  ],
  rollback: {
    summary: 'Ce script ajoute une autorisation. La retirer est immédiat et sans perte de données — mais ce n’est pas anodin : les comptes concernés cesseront de recevoir la stratégie au prochain cycle, sans message.',
    diagnostic: '# Qui lit, et qui applique, aujourd\'hui ?\nGet-GPPermission -Name \'<nom-de-la-gpo>\' -All | Format-Table @{n=\'Compte\';e={$_.Trustee.Name}},Permission',
    command: '# Retirer l\'autorisation ajoutee. Les comptes du groupe cesseront de recevoir\n# la strategie au prochain cycle. -Confirm est explicite.\nSet-GPPermission -Name \'<nom-de-la-gpo>\' -TargetName \'<groupe>\' -TargetType Group -PermissionLevel None -Confirm\n\n# Revenir au filtrage par defaut : tout le monde applique.\nSet-GPPermission -Name \'<nom-de-la-gpo>\' -TargetName \'Utilisateurs authentifies\' -TargetType Group -PermissionLevel GpoApply',
    warning: 'Retirer un filtrage de sécurité ne produit aucun message : la stratégie cesse simplement de s’appliquer, au prochain cycle, pour les comptes concernés. Noter qui l’appliquait avant toute restriction.',
  },
  checks: [
    'Lecture et Appliquer sont deux droits distincts : c’est la source du malentendu le plus courant.',
    'Après MS16-072, l’ordinateur doit pouvoir lire la stratégie pour que la moitié Utilisateur s’applique.',
    'Ce script ajoute seulement : aucun retrait n’est automatisé.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gppermission',
  sources: [
    { label: 'Set-GPPermission', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gppermission' },
    { label: 'Get-GPPermission', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gppermission' },
    { label: 'Diagnostiquer l’application d’une stratégie de groupe', url: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/applying-group-policy-troubleshooting-guidance' },
  ],
};

/**
 * 8. gpo-wmi-filter-readiness — éprouver un filtre avant de l'associer.
 *
 * Un filtre WMI est une question posée à chaque application de stratégie, sur
 * chaque poste. S'il répond faux, la stratégie est écartée en silence ; s'il
 * est lent, l'ouverture de session l'est aussi. On l'essaie donc avant, sur
 * une machine représentative.
 *
 * L'association du filtre à une GPO n'a pas de cmdlet officielle. Ce script ne
 * l'invente pas : il prépare, et donne la marche à suivre dans la console.
 */
export const outilFiltreWmi = {
  id: 'gpo-wmi-filter-readiness',
  icon: '⌗',
  category: 'GPO',
  subcategory: 'Création, liens et ciblage',
  title: 'Vérifier un filtre WMI avant association',
  risk: 'diagnostic',
  summary: 'Contrôle la syntaxe d’une requête WQL, l’exécute localement, mesure sa durée et dit ce qu’elle renverrait sur cette machine. L’association à une GPO se fait dans la console : aucune API officielle ne l’automatise.',
  fields: [
    champDomaineGpo(),
    {
      id: 'wmiRequete', label: 'Requête WQL', default: 'SELECT * FROM Win32_OperatingSystem WHERE ProductType = 1',
      help: 'ProductType : 1 poste de travail, 2 contrôleur de domaine, 3 serveur membre. Le filtre s’applique quand la requête renvoie au moins un résultat.',
    },
    {
      id: 'wmiEspace', label: 'Espace de noms', default: 'root\\CIMv2',
      help: 'root\\CIMv2 couvre la quasi-totalité des filtres utiles.',
    },
    {
      id: 'wmiNom', label: 'Nom du filtre à créer', default: 'Postes de travail seulement',
      help: 'Nom tel qu’il apparaîtra dans la console. Sert à la procédure donnée en fin de rapport.',
    },
    champFormat('wmiFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'wmiRequete', validerRequeteWql(v.wmiRequete));
    verifier(errors, 'wmiEspace', validerEspaceNomsWmi(v.wmiEspace));
    const nom = String(v.wmiNom ?? '').trim();
    if (!nom) errors.wmiNom = 'Indique le nom du filtre.';
    else if (nom.length > 64) errors.wmiNom = 'Le nom du filtre ne doit pas dépasser 64 caractères.';
    verifier(errors, 'wmiFormat', validerFormatRapport(v.wmiFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const requete = validerRequeteWql(v.wmiRequete).value;
    const espace = validerEspaceNomsWmi(v.wmiEspace).value;
    const nom = String(v.wmiNom).trim();

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Requete = ${psB64(requete)}`,
      `$EspaceNoms = ${psB64(espace)}`,
      `$NomFiltre = ${psB64(nom)}`,
      `$KjemoFormat = ${psB64(v.wmiFormat)}`,
      "",
      '# --- 1. Ce que la requete demande -------------------------------------------------',
      "[void](Add-KjemoResultat -Categorie 'Requete' -Controle 'WQL' -Etat 'INFO' -Valeur $Requete)",
      "[void](Add-KjemoResultat -Categorie 'Requete' -Controle 'Espace de noms' -Etat 'INFO' -Valeur $EspaceNoms)",
      "",
      '# --- 2. L\'espace de noms existe-t-il sur cette machine ? ---------------------------',
      '$espaceOk = $false',
      'try {',
      "  [void](Get-CimInstance -Namespace $EspaceNoms -ClassName '__NAMESPACE' -ErrorAction Stop)",
      '  $espaceOk = $true',
      '} catch {',
      '  try {',
      '    [void](Get-CimClass -Namespace $EspaceNoms -ErrorAction Stop | Select-Object -First 1)',
      '    $espaceOk = $true',
      '  } catch { }',
      '}',
      "$etat = 'PROBLEME'",
      "if ($espaceOk) { $etat = 'OK' }",
      "[void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Espace de noms joignable' -Etat $etat -Valeur $EspaceNoms -Commentaire 'Un espace de noms absent rend le filtre toujours faux : la strategie ne s''applique alors nulle part.')",
      "",
      '# --- 3. La requete, executee ici ---------------------------------------------------',
      "# Un filtre WMI s'evalue sur CHAQUE poste, a CHAQUE application de strategie.",
      '# Le temps mesure ici est donc un temps ajoute a chaque cycle, sur chaque',
      '# machine du perimetre.',
      '$resultats = $null',
      '$duree = $null',
      '$erreurRequete = $null',
      'if ($espaceOk) {',
      '  $debut = Get-Date',
      '  try {',
      '    $resultats = @(Get-CimInstance -Namespace $EspaceNoms -Query $Requete -ErrorAction Stop)',
      '  } catch {',
      '    $erreurRequete = $_.Exception.Message',
      '  }',
      '  $duree = ((Get-Date) - $debut).TotalMilliseconds',
      '}',
      "",
      'if ($erreurRequete) {',
      "  [void](Add-KjemoResultat -Categorie 'Execution' -Controle 'Requete' -Etat 'PROBLEME' -Valeur $erreurRequete -Commentaire 'Classe inconnue, propriete mal orthographiee, ou syntaxe WQL invalide. Un filtre en erreur ecarte la strategie partout.')",
      '} elseif ($resultats -ne $null) {',
      '  $compte = @($resultats).Count',
      "  $verdict = 'la strategie SERAIT appliquee sur cette machine'",
      "  $etatR = 'OK'",
      '  if ($compte -eq 0) {',
      "    $verdict = 'la strategie SERAIT ecartee sur cette machine'",
      "    $etatR = 'ATTENTION'",
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Execution' -Controle 'Resultat sur cette machine' -Etat $etatR -Valeur (\"$compte objet(s) — $verdict\") -Commentaire 'Un filtre WMI est vrai des qu''il renvoie au moins un objet.')",
      '  foreach ($r in (@($resultats) | Select-Object -First 3)) {',
      '    $apercu = ($r | Select-Object -Property * -ExcludeProperty Cim* | Format-List | Out-String)',
      '    [void](Add-KjemoResultat -Categorie \'Execution\' -Controle \'Apercu\' -Etat \'INFO\' -Valeur (($apercu -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 4) -join \' ; \'))',
      '  }',
      '}',
      "",
      'if ($duree -ne $null) {',
      "  $etatD = 'OK'",
      "  $noteD = 'Duree ajoutee a chaque application de strategie, sur chaque poste du perimetre.'",
      '  if ($duree -gt 1000) {',
      "    $etatD = 'ATTENTION'",
      "    $noteD = 'Au-dela d''une seconde, le filtre se paie a chaque ouverture de session. Les requetes sur Win32_Product sont les pires : elles declenchent une verification de tous les paquets installes.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Performance\' -Controle \'Duree de la requete\' -Etat $etatD -Valeur ("{0:N0} ms" -f $duree) -Commentaire $noteD)',
      '}',
      "if ($Requete -match 'Win32_Product') {",
      "  [void](Add-KjemoResultat -Categorie 'Performance' -Controle 'Classe Win32_Product' -Etat 'PROBLEME' -Valeur 'deconseillee' -Commentaire 'Interroger Win32_Product declenche une reconfiguration de verification sur chaque paquet MSI installe : lent, et journalise comme une reparation. Preferer une cle de registre ou Win32_OperatingSystem.')",
      '}',
      "",
      '# --- 4. Le filtre existe-t-il deja dans le domaine ? --------------------------------',
      '# Les filtres WMI sont des objets d\'annuaire, dans le conteneur SOM.',
      '# On les lit ; on n\'en cree aucun ici.',
      '$filtresExistants = @()',
      'try {',
      '  Import-Module ActiveDirectory -ErrorAction SilentlyContinue',
      '  $dnDomaine = (Get-ADDomain -Server $Domaine -ErrorAction Stop).DistinguishedName',
      '  $conteneur = "CN=SOM,CN=WMIPolicy,CN=System,$dnDomaine"',
      "  $filtresExistants = @(Get-ADObject -SearchBase $conteneur -Filter \"objectClass -eq 'msWMI-Som'\" -Properties msWMI-Name,msWMI-Parm2 -ErrorAction SilentlyContinue)",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Domaine' -Controle 'Filtres WMI existants' -Etat 'INFO' -Valeur $filtresExistants.Count)",
      'foreach ($f in $filtresExistants) {',
      "  $nomF = $f.'msWMI-Name'",
      "  $etatF = 'INFO'",
      "  $noteF = ''",
      '  if ($nomF -eq $NomFiltre) {',
      "    $etatF = 'ATTENTION'",
      "    $noteF = 'Un filtre porte deja ce nom : reutilise-le plutot que d''en creer un second.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Domaine\' -Controle $nomF -Etat $etatF -Valeur $f.DistinguishedName -Commentaire $noteF)',
      '}',
      "",
      '# --- 5. Creation et association : pourquoi ce script ne les fait pas ----------------',
      "Write-Host ''",
      "Write-Host '--- Creer le filtre et l''associer ---'",
      "Write-Host 'Le module GroupPolicy ne fournit AUCUNE cmdlet pour creer un filtre WMI'",
      "Write-Host 'ni pour l''associer a une strategie. Les objets msWMI-Som se fabriquent'",
      "Write-Host 'a la main dans l''annuaire, avec un format interne non documente : un'",
      "Write-Host 'filtre mal forme est accepte par l''annuaire et refuse par les clients,'",
      "Write-Host 'sans message. Ce script ne s''y risque pas.'",
      "Write-Host ''",
      "Write-Host 'Dans la console de gestion des strategies de groupe :'",
      "Write-Host '  1. Foret > Domaines > <domaine> > Filtres WMI > clic droit > Nouveau.'",
      "Write-Host '  2. Nom : celui indique dans ce rapport.'",
      "Write-Host '  3. Requete : Espace de noms, puis la requete WQL, telles quelles.'",
      "Write-Host '  4. Enregistrer.'",
      "Write-Host '  5. Selectionner la GPO > onglet Etendue > Filtrage WMI > choisir le filtre.'",
      "Write-Host '  6. Verifier avec un rapport de jeu de strategie resultant sur un poste'",
      "Write-Host '     du perimetre : le filtre doit y apparaitre comme satisfait.'",
      "",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Ce que ce script a fait' -Etat 'INFO' -Valeur 'verification seulement' -Commentaire 'Aucun filtre n''a ete cree, modifie ni associe. La requete a ete executee en lecture sur cette machine.')",
    ];

    return assembler({
      titre: 'Verification d\'un filtre WMI avant association',
      outil: 'gpo-wmi-filter-readiness',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['EspaceNoms', psB64(espace)],
        ['NomFiltre', psB64(nom)],
        ['Format', psB64(v.wmiFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-filtre-wmi',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > Forêt > Domaines > votre domaine > Filtres WMI > clic droit > Nouveau.',
    'Saisir le nom, puis Ajouter : espace de noms root\\CIMv2 et la requête WQL.',
    'Sélectionner la GPO > onglet Étendue > section Filtrage WMI > choisir le filtre dans la liste.',
    'Une GPO ne porte qu’un seul filtre WMI à la fois : combiner les conditions dans une seule requête avec AND.',
    'Vérifier ensuite avec un rapport de jeu de stratégie résultant sur un poste du périmètre.',
  ],
  keywords: [
    'filtre wmi', 'wql', 'win32_operatingsystem', 'producttype', 'mswmi-som',
    'filtrage wmi gpo', 'gpo ecartee par wmi', 'win32_product lent', 'root\\cimv2',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Exécuter le script sur une machine représentative du périmètre visé : le résultat de la requête dépend de la machine.',
    'Droit de créer des filtres WMI dans le domaine, pour l’étape manuelle qui suit : il appartient par défaut aux administrateurs du domaine.',
    'Le module ActiveDirectory, pour lister les filtres déjà présents.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Get-CimInstance : Classe non valide',
      code: '0x80041010',
      cause: 'La classe nommée après FROM n’existe pas dans cet espace de noms.',
      fix: 'Vérifier le nom de la classe. Un filtre en erreur écarte la stratégie sur tous les postes, sans message.',
    },
    {
      message: 'La stratégie n’est appliquée nulle part depuis l’ajout du filtre',
      cause: 'La requête renvoie faux sur les machines du périmètre, ou l’espace de noms n’y existe pas.',
      fix: 'Exécuter ce script sur une machine du périmètre : il dit si la stratégie serait appliquée ou écartée.',
    },
    {
      message: 'L’ouverture de session est devenue lente après l’ajout du filtre',
      cause: 'La requête est coûteuse — typiquement une interrogation de Win32_Product.',
      fix: 'Remplacer par une condition sur Win32_OperatingSystem, ou par un ciblage par groupe de sécurité, qui ne coûte rien.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'La requête s’exécute sans erreur et sa durée est connue.',
    'Le rapport dit si la stratégie serait appliquée ou écartée sur cette machine.',
    'Les filtres déjà présents dans le domaine sont listés : aucun doublon n’est créé par mégarde.',
  ],
  rollback: {
    summary: 'Ce script exécute une requête en lecture et lit l’annuaire. Il ne crée aucun filtre et n’en associe aucun : il n’y a rien à annuler.',
    diagnostic: '# Quels filtres WMI existent, et lequel une GPO utilise-t-elle ?\nGet-ADObject -SearchBase "CN=SOM,CN=WMIPolicy,CN=System,$((Get-ADDomain).DistinguishedName)" -Filter "objectClass -eq \'msWMI-Som\'" -Properties msWMI-Name | Format-Table msWMI-Name,DistinguishedName\n(Get-GPO -Name \'<nom-de-la-gpo>\').WmiFilter | Format-List Name,Description',
    command: '# Detacher un filtre d\'une strategie se fait dans la console :\n#   GPO > onglet Etendue > Filtrage WMI > <aucun>\n# Il n\'existe pas de cmdlet officielle pour cette operation, et fabriquer\n# l\'objet a la main produit des filtres que les clients refusent en silence.',
    warning: 'Un filtre WMI mal formé est accepté par l’annuaire et refusé par les clients, sans message : la stratégie cesse de s’appliquer et rien ne le signale. C’est pourquoi ce projet n’en fabrique aucun.',
  },
  checks: [
    'Exécuter ce contrôle sur une machine représentative : le résultat dépend de la machine.',
    'Un ciblage par groupe de sécurité est gratuit ; un filtre WMI se paie à chaque ouverture de session.',
    'Aucun filtre n’est créé par ce script : la création se fait dans la console.',
  ],
  source: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2003/cc779036(v=ws.10)',
  sources: [
    { label: 'Filtres WMI pour les objets de stratégie de groupe', url: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2003/cc779036(v=ws.10)' },
    { label: 'Get-CimInstance', url: 'https://learn.microsoft.com/powershell/module/cimcmdlets/get-ciminstance' },
    { label: 'Classe Win32_OperatingSystem', url: 'https://learn.microsoft.com/windows/win32/cimwin32prov/win32-operatingsystem' },
  ],
};

/**
 * 9. gpo-drive-mapping — préparer un lecteur réseau.
 *
 * Les lecteurs réseau se posent par les préférences de stratégie de groupe.
 * Cette extension n'a pas de cmdlet : sa configuration vit dans un fichier XML
 * de SYSVOL que la console écrit, et qu'il ne faut pas écrire soi-même. Ce
 * script vérifie donc tout ce qui peut l'être — le partage répond, le groupe
 * existe, la lettre est libre — et donne la marche à suivre exacte.
 */
export const outilLecteurReseauGpo = {
  id: 'gpo-drive-mapping',
  icon: '▥',
  category: 'GPO',
  subcategory: 'Environnement utilisateur',
  title: 'Préparer le mappage de lecteurs réseau',
  risk: 'diagnostic',
  summary: 'Vérifie le chemin UNC, les permissions, le groupe ciblé et la lettre choisie, explique les actions Créer, Mettre à jour et Remplacer, puis donne la procédure exacte dans la console. Ne configure rien.',
  fields: [
    champDomaineGpo(),
    {
      id: 'dmLettre', label: 'Lettre de lecteur', default: 'P:',
      help: 'De D: à Z:. Éviter les lettres déjà prises par des périphériques locaux.',
    },
    {
      id: 'dmChemin', label: 'Chemin UNC du partage', default: '\\\\srv-fichiers\\Partage',
      help: 'Le partage doit déjà exister : ce script le vérifie, il ne le crée pas.',
    },
    {
      id: 'dmLibelle', label: 'Libellé affiché', default: 'Partage du service',
      help: 'Ce que la personne verra dans l’Explorateur, à côté de la lettre.',
    },
    {
      id: 'dmGroupe', label: 'Groupe ciblé', default: 'GG-Medecins',
      help: 'Le ciblage au niveau de l’élément des préférences limite le lecteur à ce groupe, sans toucher au filtrage de sécurité de la GPO.',
    },
    {
      id: 'dmAction', label: 'Action de la préférence', type: 'select', default: 'Update',
      options: [
        ['Create', 'Créer — ne fait rien si la lettre existe déjà'],
        ['Update', 'Mettre à jour — crée, ou corrige l’existant (recommandé)'],
        ['Replace', 'Remplacer — supprime puis recrée à chaque application'],
      ],
      help: 'Remplacer déconnecte puis reconnecte le lecteur à chaque cycle : une connexion ouverte peut être coupée. Mettre à jour convient presque toujours.',
    },
    champFormat('dmFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'dmLettre', validerLettreLecteur(v.dmLettre));
    verifier(errors, 'dmChemin', validerCheminUnc(v.dmChemin));
    const lib = String(v.dmLibelle ?? '').trim();
    if (!lib) errors.dmLibelle = 'Indique le libellé affiché dans l’Explorateur.';
    else if (lib.length > 64) errors.dmLibelle = 'Le libellé ne doit pas dépasser 64 caractères.';
    verifier(errors, 'dmGroupe', validateGroupName(v.dmGroupe));
    verifier(errors, 'dmAction', validerChoix(v.dmAction, ['Create', 'Update', 'Replace'], 'L’action'));
    verifier(errors, 'dmFormat', validerFormatRapport(v.dmFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const lettre = validerLettreLecteur(v.dmLettre).value;
    const chemin = validerCheminUnc(v.dmChemin).value;

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Lettre = ${psB64(lettre)}`,
      `$Chemin = ${psB64(chemin)}`,
      `$Libelle = ${psB64(String(v.dmLibelle).trim())}`,
      `$Groupe = ${psB64(String(v.dmGroupe).trim())}`,
      `$Action = ${psB64(v.dmAction)}`,
      `$KjemoFormat = ${psB64(v.dmFormat)}`,
      "",
      '# --- 1. Le partage repond-il ? ----------------------------------------------------',
      "# Un lecteur pointe vers un partage qui n'existe pas se traduit par une",
      '# croix rouge dans l\'Explorateur, a chaque ouverture de session, sans',
      '# message utile.',
      '$partageOk = $false',
      'try { $partageOk = Test-Path -LiteralPath $Chemin -ErrorAction SilentlyContinue } catch { }',
      "$etat = 'PROBLEME'",
      "if ($partageOk) { $etat = 'OK' }",
      "[void](Add-KjemoResultat -Categorie 'Partage' -Controle 'Chemin UNC' -Etat $etat -Valeur $Chemin -Commentaire 'Teste depuis cette machine, avec le compte courant.')",
      "",
      "$serveur = ($Chemin -split '\\\\')[2]",
      "$nomPartage = ($Chemin -split '\\\\')[3]",
      'if ($serveur -and $nomPartage) {',
      '  try {',
      '    $acces = @(Get-SmbShareAccess -Name $nomPartage -CimSession $serveur -ErrorAction SilentlyContinue)',
      '    foreach ($a in $acces) {',
      '      [void](Add-KjemoResultat -Categorie \'Permissions SMB\' -Controle $a.AccountName -Etat \'INFO\' -Valeur ("$($a.AccessControlType) $($a.AccessRight)"))',
      '    }',
      '    if ($acces.Count -gt 0) {',
      '      $pourGroupe = @($acces | Where-Object { $_.AccountName -like "*$Groupe*" })',
      '      if ($pourGroupe.Count -eq 0) {',
      "        [void](Add-KjemoResultat -Categorie 'Permissions SMB' -Controle $Groupe -Etat 'ATTENTION' -Valeur 'aucune entree a son nom' -Commentaire 'Le groupe peut passer par Tout le monde ou Utilisateurs authentifies. Verifie que l''intersection SMB et NTFS lui laisse un acces reel.')",
      '      }',
      '    }',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Permissions SMB' -Controle 'Lecture' -Etat 'IGNORE' -Valeur 'non lisible a distance' -Commentaire 'Execute ce diagnostic depuis le serveur de fichiers pour ce controle.')",
      '  }',
      '}',
      "",
      '# --- 2. Le groupe existe-t-il ? ----------------------------------------------------',
      '$groupeOk = $false',
      'try {',
      '  Import-Module ActiveDirectory -ErrorAction SilentlyContinue',
      '  if (Get-ADGroup -Filter "Name -eq \'$Groupe\'" -Server $Domaine -ErrorAction SilentlyContinue) { $groupeOk = $true }',
      '} catch { }',
      "$etat = 'PROBLEME'",
      "if ($groupeOk) { $etat = 'OK' }",
      "[void](Add-KjemoResultat -Categorie 'Ciblage' -Controle 'Groupe' -Etat $etat -Valeur $Groupe -Commentaire 'Le ciblage au niveau de l''element limite le lecteur a ce groupe, sans toucher au filtrage de securite de la GPO.')",
      "",
      '# --- 3. La lettre est-elle libre ? --------------------------------------------------',
      '$occupee = $null',
      'try { $occupee = Get-PSDrive -Name $Lettre.TrimEnd(\':\') -ErrorAction SilentlyContinue } catch { }',
      'if ($occupee) {',
      "  [void](Add-KjemoResultat -Categorie 'Lettre' -Controle $Lettre -Etat 'ATTENTION' -Valeur (\"deja utilisee ici : \" + $occupee.Root) -Commentaire 'Sur cette machine seulement. Verifie qu''aucun poste du perimetre n''utilise cette lettre pour autre chose.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Lettre' -Controle $Lettre -Etat 'OK' -Valeur 'libre sur cette machine')",
      '}',
      "",
      '# --- 4. Ce que l\'action choisie fait vraiment ---------------------------------------',
      "if ($Action -eq 'Create') {",
      "  [void](Add-KjemoResultat -Categorie 'Action de la preference' -Controle 'Creer' -Etat 'INFO' -Valeur 'ne fait rien si la lettre existe' -Commentaire 'Un lecteur mal configure une fois le restera : la preference ne le corrige jamais.')",
      "} elseif ($Action -eq 'Update') {",
      "  [void](Add-KjemoResultat -Categorie 'Action de la preference' -Controle 'Mettre a jour' -Etat 'OK' -Valeur 'cree, ou corrige l''existant' -Commentaire 'Le choix qui convient presque toujours : idempotent, et sans coupure.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Action de la preference' -Controle 'Remplacer' -Etat 'ATTENTION' -Valeur 'supprime puis recree a chaque cycle' -Commentaire 'Une connexion ouverte sur ce lecteur peut etre coupee a chaque application de strategie. A reserver aux cas ou la configuration doit etre remise a zero.')",
      '}',
      "",
      '# --- 5. Marche a suivre dans la console ---------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Poser le lecteur dans la console ---'",
      "Write-Host 'Les preferences de strategie de groupe n''ont pas de cmdlet officielle.'",
      "Write-Host 'Leur configuration vit dans un fichier XML de SYSVOL que la console'",
      "Write-Host 'ecrit, et qu''il ne faut pas ecrire soi-meme : un fichier fabrique a la'",
      "Write-Host 'main est relu par les clients mais plus par la console.'",
      "Write-Host ''",
      "Write-Host '  1. gpmc.msc > la GPO > Modifier.'",
      "Write-Host '  2. Configuration utilisateur > Preferences > Parametres Windows >'",
      "Write-Host '     Mappages de lecteurs.'",
      "Write-Host '  3. Clic droit > Nouveau > Lecteur mappe.'",
      '  Write-Host "  4. Action : $Action ; Emplacement : $Chemin ; Lettre : $Lettre."',
      '  Write-Host "  5. Reconnecter : coche ; Libelle : $Libelle."',
      "Write-Host '  6. Onglet Commun > Ciblage au niveau de l''element > Cibler >'",
      '  Write-Host "     Nouvel element > Groupe de securite > $Groupe."',
      "Write-Host '  7. Verifier avec un rapport de jeu de strategie resultant sur un poste.'",
      blocPreparationSeulement('mappage de lecteur reseau'),
    ];

    return assembler({
      titre: 'Preparer le mappage d\'un lecteur reseau par GPO',
      outil: 'gpo-drive-mapping',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Lettre', psB64(lettre)],
        ['Chemin', psB64(chemin)],
        ['Action', psB64(v.dmAction)],
        ['Format', psB64(v.dmFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-lecteur',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > la GPO > Modifier.',
    'Configuration utilisateur > Préférences > Paramètres Windows > Mappages de lecteurs.',
    'Clic droit > Nouveau > Lecteur mappé : action, emplacement UNC, lettre, libellé.',
    'Onglet Commun > Ciblage au niveau de l’élément : limiter à un groupe de sécurité.',
    'Les préférences s’appliquent à l’ouverture de session et à chaque actualisation, selon l’action choisie.',
  ],
  keywords: [
    'lecteur reseau', 'mappage', 'drive maps', 'preferences gpo', 'net use',
    'ciblage au niveau de l’element', 'lettre de lecteur', 'partage unc', 'p:',
    'lecteur qui ne se monte pas',
  ],
  requiresAdmin: false,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Le partage doit déjà exister et répondre : ce script le vérifie, il ne le crée pas.',
    'Le groupe ciblé doit exister dans le domaine.',
    'La configuration elle-même se fait dans la console : aucune cmdlet officielle ne la couvre.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Le lecteur apparaît avec une croix rouge à l’ouverture de session',
      cause: 'Le partage ne répond pas, ou la personne n’a pas de droit dessus.',
      fix: 'Vérifier le chemin et l’intersection des permissions SMB et NTFS — c’est la plus restrictive qui gagne.',
    },
    {
      message: 'Le lecteur ne se monte que pour certaines personnes',
      cause: 'Le ciblage au niveau de l’élément limite la préférence à un groupe, et toutes n’en font pas partie.',
      fix: 'Vérifier l’appartenance au groupe. Attention : une appartenance ajoutée ne prend effet qu’après fermeture et réouverture de session.',
    },
    {
      message: 'La lettre choisie est déjà prise sur certains postes',
      cause: 'Un périphérique local ou un autre mappage occupe la lettre.',
      fix: 'Choisir une lettre haute (P:, S:, T:) et la réserver à cet usage dans toute l’organisation.',
    },
    {
      message: 'Le lecteur se déconnecte pendant que la personne travaille',
      cause: 'L’action Remplacer supprime et recrée le mappage à chaque application de stratégie.',
      fix: 'Passer à Mettre à jour, qui corrige sans couper.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le chemin UNC répond depuis un poste du périmètre, avec un compte du groupe ciblé.',
    'Après gpupdate et réouverture de session, le lecteur apparaît avec le bon libellé.',
    'Un rapport de jeu de stratégie résultant montre la préférence appliquée.',
  ],
  rollback: {
    summary: 'Ce script ne configure rien : il n’y a rien à annuler de son fait. Pour retirer un lecteur déjà déployé, c’est la préférence qu’il faut traiter — et la supprimer ne démonte pas le lecteur déjà monté sur les postes.',
    diagnostic: '# Que voit le poste aujourd\'hui ?\nGet-PSDrive -PSProvider FileSystem | Format-Table Name,Root,Used,Free\ngpresult /h rapport-rsop.html',
    command: '# Dans la console : la preference se retire, ou son action passe a Supprimer\n# pour demonter proprement le lecteur chez les personnes qui l\'ont deja.\n# Retirer simplement la preference laisse le lecteur en place sur les postes.\n#\n# Sur un poste, pour verifier apres coup :\nGet-PSDrive -PSProvider FileSystem | Format-Table Name,Root',
    warning: 'Supprimer la préférence ne démonte pas le lecteur déjà monté : il reste jusqu’à la prochaine ouverture de session, parfois au-delà. Pour le retirer vraiment, passer l’action à Supprimer, laisser un cycle, puis retirer la préférence.',
  },
  checks: [
    'Vérifier le partage avant de pointer des centaines de sessions vers un chemin qui ne répond pas.',
    'Mettre à jour plutôt que Remplacer : Remplacer coupe les connexions ouvertes.',
    'Ce script prépare et vérifie ; il ne configure rien.',
  ],
  source: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2012-R2-and-2012/dn789196(v=ws.11)',
  sources: [
    { label: 'Préférences de stratégie de groupe', url: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2012-R2-and-2012/dn789196(v=ws.11)' },
    { label: 'Get-SmbShareAccess', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshareaccess' },
    { label: 'Ciblage au niveau de l’élément', url: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc733022(v=ws.10)' },
  ],
};

/**
 * 10. gpo-printer-deployment — préparer le déploiement d'une imprimante.
 *
 * Déployer une imprimante par stratégie, c'est surtout déployer un pilote. Et
 * depuis les correctifs PrintNightmare, un client refuse par défaut d'installer
 * un pilote depuis un serveur sans y être explicitement autorisé. Un
 * déploiement qui marchait il y a trois ans ne marche plus, et le message côté
 * poste ne dit rien d'utile.
 */
export const outilImprimanteGpo = {
  id: 'gpo-printer-deployment',
  icon: '⎙',
  category: 'GPO',
  subcategory: 'Environnement utilisateur',
  title: 'Préparer le déploiement d’une imprimante',
  risk: 'diagnostic',
  summary: 'Vérifie le serveur d’impression, le partage, la connectivité et les réglages Point and Print qui décident si le pilote s’installera, puis donne la procédure exacte. N’installe aucun pilote.',
  fields: [
    champDomaineGpo(),
    {
      id: 'imType', label: 'Type de déploiement', type: 'select', default: 'Partagee',
      options: [
        ['Partagee', 'Imprimante partagée sur un serveur d’impression'],
        ['TcpIp', 'Port TCP/IP direct, sans serveur'],
      ],
      help: 'Une imprimante partagée se gère au même endroit pour tout le monde ; un port TCP/IP direct supprime la dépendance au serveur, mais chaque poste gère son pilote.',
    },
    {
      id: 'imServeur', label: 'Serveur d’impression ou adresse', default: 'srv-impression',
      help: 'Nom du serveur pour une imprimante partagée, ou nom d’hôte de l’imprimante pour un port TCP/IP.',
    },
    {
      id: 'imPartage', label: 'Nom de partage de l’imprimante', default: 'HP-Consultation',
      help: 'Tel qu’il apparaît dans \\\\serveur\\. Pour un port TCP/IP, sert de nom local de l’imprimante.',
    },
    {
      id: 'imGroupe', label: 'Groupe ou OU ciblé', default: 'GG-Medecins',
      help: 'Les imprimantes déployées par préférence se ciblent par groupe ; celles déployées par la console Gestion de l’impression se ciblent par OU.',
    },
    champFormat('imFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'imType', validerChoix(v.imType, ['Partagee', 'TcpIp'], 'Le type'));
    verifier(errors, 'imServeur', validerNomHote(v.imServeur));
    verifier(errors, 'imPartage', validateShareName(v.imPartage));
    verifier(errors, 'imGroupe', validateGroupName(v.imGroupe));
    verifier(errors, 'imFormat', validerFormatRapport(v.imFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const serveur = validerNomHote(v.imServeur).value;
    const partage = validateShareName(v.imPartage).value;

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Type = ${psB64(v.imType)}`,
      `$Serveur = ${psB64(serveur)}`,
      `$Partage = ${psB64(partage)}`,
      `$Groupe = ${psB64(String(v.imGroupe).trim())}`,
      `$KjemoFormat = ${psB64(v.imFormat)}`,
      "",
      '# --- 1. La machine repond-elle ? ---------------------------------------------------',
      '$joignable = $false',
      'try { $joignable = Test-Connection -ComputerName $Serveur -Count 1 -Quiet -ErrorAction SilentlyContinue } catch { }',
      "$etat = 'ATTENTION'",
      "$note = 'L''echo peut etre bloque par le pare-feu sans que la machine soit en panne.'",
      "if ($joignable) { $etat = 'OK' ; $note = '' }",
      '[void](Add-KjemoResultat -Categorie \'Connectivite\' -Controle $Serveur -Etat $etat -Valeur $joignable -Commentaire $note)',
      "",
      "if ($Type -eq 'Partagee') {",
      "  foreach ($entree in @('445:SMB — partage d''imprimante', '135:RPC — spouleur')) {",
      "    $numero = [int]($entree.Split(':')[0])",
      "    $libelle = $entree.Split(':')[1]",
      '    $ouvert = $false',
      '    try { $ouvert = (Test-NetConnection -ComputerName $Serveur -Port $numero -WarningAction SilentlyContinue -InformationLevel Quiet) } catch { }',
      "    $etatP = 'PROBLEME'",
      "    if ($ouvert) { $etatP = 'OK' }",
      '    [void](Add-KjemoResultat -Categorie \'Connectivite\' -Controle ("$numero — $libelle") -Etat $etatP -Valeur ("vers $Serveur"))',
      '  }',
      '} else {',
      '  foreach ($entree in @(\'9100:impression brute\', \'515:LPR\', \'631:IPP\')) {',
      "    $numero = [int]($entree.Split(':')[0])",
      "    $libelle = $entree.Split(':')[1]",
      '    $ouvert = $false',
      '    try { $ouvert = (Test-NetConnection -ComputerName $Serveur -Port $numero -WarningAction SilentlyContinue -InformationLevel Quiet) } catch { }',
      "    $etatP = 'INFO'",
      "    if ($ouvert) { $etatP = 'OK' }",
      '    [void](Add-KjemoResultat -Categorie \'Connectivite\' -Controle ("$numero — $libelle") -Etat $etatP -Valeur ("vers $Serveur") -Commentaire \'Un seul de ces ports suffit : 9100 est le plus courant.\')',
      '  }',
      '}',
      "",
      '# --- 2. L\'imprimante partagee existe-t-elle ? ----------------------------------------',
      "if ($Type -eq 'Partagee') {",
      '  $impr = $null',
      '  try { $impr = Get-Printer -ComputerName $Serveur -Name $Partage -ErrorAction SilentlyContinue } catch { }',
      '  if ($impr) {',
      '    [void](Add-KjemoResultat -Categorie \'Imprimante\' -Controle $Partage -Etat \'OK\' -Valeur ("pilote : $($impr.DriverName) ; port : $($impr.PortName) ; partagee : $($impr.Shared)"))',
      '    if (-not $impr.Shared) {',
      "      [void](Add-KjemoResultat -Categorie 'Imprimante' -Controle 'Partage' -Etat 'PROBLEME' -Valeur 'non partagee' -Commentaire 'Une imprimante non partagee ne peut pas etre deployee par strategie.')",
      '    }',
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Imprimante' -Controle $Partage -Etat 'PROBLEME' -Valeur 'introuvable sur ce serveur' -Commentaire 'Verifie le nom de partage exact, et que le spouleur repond a distance.')",
      '  }',
      '  $chemin = "\\\\$Serveur\\$Partage"',
      "  [void](Add-KjemoResultat -Categorie 'Imprimante' -Controle 'Chemin de connexion' -Etat 'INFO' -Valeur $chemin)",
      '}',
      "",
      '# --- 3. Point and Print : ce qui decide si le pilote s\'installe ----------------------',
      "# Depuis les correctifs PrintNightmare, un client refuse par defaut",
      "# d'installer un pilote depuis un serveur, meme approuve, sans elevation.",
      "# C'est LA cause des deploiements qui ont cesse de fonctionner.",
      "$clePnp = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint'",
      '$reglages = $null',
      'try { $reglages = Get-ItemProperty -Path $clePnp -ErrorAction SilentlyContinue } catch { }',
      'if ($reglages) {',
      '  foreach ($nom in @(\'RestrictDriverInstallationToAdministrators\', \'NoWarningNoElevationOnInstall\', \'UpdatePromptSettings\', \'TrustedServers\', \'ServerList\')) {',
      '    if ($reglages.PSObject.Properties.Name -contains $nom) {',
      '      [void](Add-KjemoResultat -Categorie \'Point and Print\' -Controle $nom -Etat \'INFO\' -Valeur $reglages.$nom)',
      '    }',
      '  }',
      '  if ($reglages.PSObject.Properties.Name -contains \'RestrictDriverInstallationToAdministrators\') {',
      '    if ($reglages.RestrictDriverInstallationToAdministrators -eq 0) {',
      "      [void](Add-KjemoResultat -Categorie 'Point and Print' -Controle 'Installation par les non-administrateurs' -Etat 'ATTENTION' -Valeur 'autorisee' -Commentaire 'Ce reglage assouplit une protection posee apres PrintNightmare. Il se justifie, il ne s''improvise pas : limiter aux serveurs d''impression nommes dans TrustedServers.')",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Point and Print' -Controle 'Installation par les non-administrateurs' -Etat 'OK' -Valeur 'restreinte aux administrateurs' -Commentaire 'Position sure par defaut. Un deploiement vers des postes ordinaires demandera soit des pilotes deja presents, soit une exception encadree.')",
      '    }',
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Point and Print' -Controle 'Strategie Point and Print' -Etat 'INFO' -Valeur 'aucun reglage sur cette machine' -Commentaire 'Le comportement par defaut depuis les correctifs PrintNightmare exige des droits d''administration pour installer un pilote.')",
      '}',
      "",
      '$spouleur = $null',
      'try { $spouleur = Get-Service Spooler -ErrorAction SilentlyContinue } catch { }',
      'if ($spouleur) {',
      "  $etatS = 'PROBLEME'",
      "  if ($spouleur.Status -eq 'Running') { $etatS = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Service' -Controle 'Spouleur d''impression local' -Etat $etatS -Valeur $spouleur.Status)",
      '}',
      "",
      '# --- 4. Le groupe cible -----------------------------------------------------------',
      '$groupeOk = $false',
      'try {',
      '  Import-Module ActiveDirectory -ErrorAction SilentlyContinue',
      '  if (Get-ADGroup -Filter "Name -eq \'$Groupe\'" -Server $Domaine -ErrorAction SilentlyContinue) { $groupeOk = $true }',
      '} catch { }',
      "$etat = 'PROBLEME'",
      "if ($groupeOk) { $etat = 'OK' }",
      '[void](Add-KjemoResultat -Categorie \'Ciblage\' -Controle \'Groupe\' -Etat $etat -Valeur $Groupe)',
      "",
      '# --- 5. Marche a suivre dans la console ---------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Deployer l''imprimante ---'",
      "Write-Host 'Aucune cmdlet officielle ne deploie une imprimante par strategie de'",
      "Write-Host 'groupe. Deux chemins existent, et ce script n''en emprunte aucun :'",
      "Write-Host ''",
      "Write-Host 'A. Par la console Gestion de l''impression, ciblage par OU :'",
      "Write-Host '   1. printmanagement.msc sur le serveur d''impression.'",
      '  Write-Host "   2. Imprimantes > $Partage > clic droit > Deployer avec une strategie."',
      "Write-Host '   3. Parcourir : choisir la GPO ; cocher Les utilisateurs ou Les ordinateurs.'",
      "Write-Host '   4. Ajouter, puis OK.'",
      "Write-Host ''",
      "Write-Host 'B. Par les preferences de strategie de groupe, ciblage par groupe :'",
      "Write-Host '   1. gpmc.msc > la GPO > Modifier.'",
      "Write-Host '   2. Configuration utilisateur > Preferences > Parametres du Panneau de'",
      "Write-Host '      configuration > Imprimantes.'",
      "Write-Host '   3. Clic droit > Nouveau > Imprimante partagee (ou Imprimante TCP/IP).'",
      "Write-Host '   4. Onglet Commun > Ciblage au niveau de l''element > Groupe de securite.'",
      "Write-Host ''",
      "Write-Host 'Dans les deux cas, le pilote doit pouvoir s''installer : c''est Point and'",
      "Write-Host 'Print qui en decide, et c''est la premiere chose a verifier quand un'",
      "Write-Host 'deploiement qui fonctionnait s''arrete.'",
      blocPreparationSeulement('deploiement d\'imprimante'),
    ];

    return assembler({
      titre: 'Preparer le deploiement d\'une imprimante par GPO',
      outil: 'gpo-printer-deployment',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Type', psB64(v.imType)],
        ['Serveur', psB64(serveur)],
        ['Partage', psB64(partage)],
        ['Format', psB64(v.imFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-imprimante',
    });
  },
  gui: [
    'Gestion de l’impression (printmanagement.msc) sur le serveur : clic droit sur l’imprimante > Déployer avec une stratégie de groupe.',
    'Choisir la GPO, puis cocher Les utilisateurs auxquels cette GPO s’applique, ou Les ordinateurs.',
    'Ou : gpmc.msc > la GPO > Modifier > Préférences > Panneau de configuration > Imprimantes > Nouveau.',
    'Pour le pilote : Configuration ordinateur > Modèles d’administration > Imprimantes > Restrictions Point and Print.',
    'Après déploiement, vérifier sur un poste avec Get-Printer et un rapport de jeu de stratégie résultant.',
  ],
  keywords: [
    'imprimante gpo', 'deployer une imprimante', 'point and print', 'printnightmare',
    'serveur d’impression', 'spouleur', 'pilote d’impression', 'port 9100',
    'printmanagement', 'imprimante qui ne s’installe pas',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'L’imprimante doit déjà être installée et partagée sur le serveur d’impression : ce script ne la crée pas.',
    'Le pilote doit être approuvé par l’organisation. Aucun pilote n’est installé ni téléchargé par ce script.',
    'Droits de lecture sur le spouleur du serveur, pour interroger l’imprimante à distance.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Windows ne peut pas se connecter à l’imprimante — opération nécessitant une élévation',
      code: '0x0000011b',
      cause: 'Depuis les correctifs PrintNightmare, l’installation d’un pilote depuis un serveur demande des droits d’administration.',
      fix: 'Déployer le pilote en amont, ou encadrer une exception Point and Print limitée aux serveurs d’impression nommés. Assouplir globalement n’est pas une solution.',
    },
    {
      message: 'L’imprimante apparaît puis disparaît à chaque ouverture de session',
      cause: 'Deux déploiements concurrents — console Gestion de l’impression et préférence — se contredisent.',
      fix: 'Choisir un seul mécanisme. Le rapport de jeu de stratégie résultant montre lequel s’applique.',
    },
    {
      message: 'Get-Printer : Impossible de se connecter à l’ordinateur distant',
      cause: 'Le spouleur du serveur ne répond pas à distance, ou le pare-feu bloque RPC.',
      fix: 'Vérifier le service Spouleur sur le serveur et les ports 135 et 445.',
    },
    {
      message: 'L’imprimante ne se déploie que pour certains comptes',
      cause: 'Le ciblage au niveau de l’élément limite la préférence à un groupe.',
      fix: 'Vérifier l’appartenance au groupe, et se rappeler qu’une appartenance ajoutée ne prend effet qu’après réouverture de session.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le serveur répond sur les ports attendus, et l’imprimante est bien partagée.',
    'Les réglages Point and Print de la machine sont connus : c’est eux qui décident si le pilote s’installera.',
    'Sur un poste du périmètre, après gpupdate et réouverture de session, Get-Printer montre l’imprimante.',
  ],
  rollback: {
    summary: 'Ce script vérifie et n’installe rien : il n’y a rien à annuler de son fait. Retirer un déploiement se fait là où il a été posé — console Gestion de l’impression, ou préférence de stratégie.',
    diagnostic: '# Que voit le poste ?\nGet-Printer | Format-Table Name,DriverName,PortName,Shared\nGet-ItemProperty -Path \'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint\' -ErrorAction SilentlyContinue',
    command: '# Dans la console Gestion de l\'impression : clic droit sur l\'imprimante >\n# Deployer avec une strategie de groupe > Supprimer.\n#\n# Sur un poste, pour retirer une connexion restee en place. -Confirm est\n# explicite : PowerShell demandera confirmation.\nRemove-Printer -Name \'<nom-de-l-imprimante>\' -Confirm',
    warning: 'Retirer un déploiement ne désinstalle pas le pilote déjà présent sur les postes. Et un pilote déployé par erreur sur un parc entier ne se retire pas par stratégie : c’est une opération poste par poste.',
  },
  checks: [
    'Vérifier Point and Print avant tout : c’est lui qui fait échouer la plupart des déploiements depuis PrintNightmare.',
    'Un seul mécanisme de déploiement à la fois : deux se contredisent.',
    'Aucun pilote n’est installé ni téléchargé par ce script.',
  ],
  source: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc754699(v=ws.11)',
  sources: [
    { label: 'Déployer des imprimantes par stratégie de groupe', url: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc754699(v=ws.11)' },
    { label: 'Get-Printer', url: 'https://learn.microsoft.com/powershell/module/printmanagement/get-printer' },
    { label: 'Journaux liés aux restrictions Point and Print', url: 'https://learn.microsoft.com/troubleshoot/windows-server/printing/event-ids-associated-point-print-restrictions' },
  ],
};

/**
 * 11. gpo-logon-startup-scripts — préparer un script d'ouverture de session.
 *
 * Un script de connexion doit vivre dans NETLOGON ou SYSVOL : ailleurs, il
 * n'est pas répliqué entre contrôleurs, et il fonctionne jusqu'au jour où le
 * poste interroge un autre contrôleur. Et il s'exécute avec les droits de la
 * personne — ce qui veut dire que tout secret qu'il contient est lisible par
 * tout le monde.
 */
export const outilScriptsGpo = {
  id: 'gpo-logon-startup-scripts',
  icon: '⮚',
  category: 'GPO',
  subcategory: 'Environnement utilisateur',
  title: 'Préparer des scripts de connexion et de démarrage',
  risk: 'diagnostic',
  summary: 'Vérifie l’emplacement dans SYSVOL ou NETLOGON, les droits de lecture, l’extension et la présence de secrets, puis donne la procédure exacte. Ne copie aucun fichier.',
  fields: [
    champDomaineGpo(),
    {
      id: 'scType', label: 'Type de script', type: 'select', default: 'Ouverture',
      options: [
        ['Ouverture', 'Ouverture de session — s’exécute avec les droits de la personne'],
        ['Demarrage', 'Démarrage — s’exécute avec les droits du compte Système'],
      ],
      help: 'Un script de démarrage tourne en Système : il peut tout faire sur le poste, et il tourne avant qu’une session n’existe.',
    },
    {
      id: 'scChemin', label: 'Dossier dans SYSVOL ou NETLOGON', default: '\\\\hopitalbn.lan\\NETLOGON',
      help: 'Seuls SYSVOL et NETLOGON sont répliqués entre contrôleurs. Un script ailleurs fonctionne jusqu’au jour où le poste interroge un autre contrôleur.',
    },
    {
      id: 'scFichier', label: 'Nom du fichier de script', default: 'connexion-medecins.ps1',
      help: 'Extensions acceptées : .ps1, .cmd, .bat, .vbs. Un exécutable ne se déploie pas comme un script d’ouverture de session.',
    },
    champFormat('scFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'scType', validerChoix(v.scType, ['Ouverture', 'Demarrage'], 'Le type'));
    verifier(errors, 'scChemin', validerCheminSysvol(v.scChemin));
    verifier(errors, 'scFichier', validerNomScriptGpo(v.scFichier));
    verifier(errors, 'scFormat', validerFormatRapport(v.scFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const dossier = validerCheminSysvol(v.scChemin).value;
    const fichier = validerNomScriptGpo(v.scFichier).value;

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Type = ${psB64(v.scType)}`,
      `$Dossier = ${psB64(dossier)}`,
      `$Fichier = ${psB64(fichier)}`,
      `$KjemoFormat = ${psB64(v.scFormat)}`,
      "",
      '# --- 1. Le dossier est-il bien dans un partage replique ? ----------------------------',
      '$dossierOk = $false',
      'try { $dossierOk = Test-Path -LiteralPath $Dossier -ErrorAction SilentlyContinue } catch { }',
      "$etat = 'PROBLEME'",
      "if ($dossierOk) { $etat = 'OK' }",
      "[void](Add-KjemoResultat -Categorie 'Emplacement' -Controle 'Dossier' -Etat $etat -Valeur $Dossier -Commentaire 'SYSVOL et NETLOGON sont repliques entre controleurs ; un script ailleurs ne l''est pas.')",
      "",
      '$chemin = Join-Path $Dossier $Fichier',
      '$fichierOk = $false',
      'try { $fichierOk = Test-Path -LiteralPath $chemin -ErrorAction SilentlyContinue } catch { }',
      'if ($fichierOk) {',
      '  $info = $null',
      '  try { $info = Get-Item -LiteralPath $chemin -ErrorAction SilentlyContinue } catch { }',
      '  [void](Add-KjemoResultat -Categorie \'Emplacement\' -Controle \'Fichier\' -Etat \'OK\' -Valeur $chemin -Commentaire ("$($info.Length) octets ; modifie le $($info.LastWriteTime.ToString(\'yyyy-MM-dd HH:mm\'))"))',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Emplacement' -Controle 'Fichier' -Etat 'ATTENTION' -Valeur $chemin -Commentaire 'Absent. Depose-le dans ce dossier avant d''attacher le script a la strategie : ce script ne copie rien.')",
      '}',
      "",
      '# --- 2. Qui peut le lire, et qui peut l\'ecrire ? --------------------------------------',
      "# Un script d'ouverture de session doit etre LISIBLE par tous les comptes",
      "# concernes, et MODIFIABLE par presque personne : quiconque peut l'ecrire",
      '# execute du code sur tous les postes du perimetre.',
      'if ($fichierOk) {',
      '  $acl = $null',
      '  try { $acl = Get-Acl -LiteralPath $chemin -ErrorAction SilentlyContinue } catch { }',
      '  if ($acl) {',
      '    $ecrivains = New-Object System.Collections.ArrayList',
      '    foreach ($regle in @($acl.Access)) {',
      '      $droits = $regle.FileSystemRights.ToString()',
      "      if ($droits -match 'Write|Modify|FullControl' -and $regle.AccessControlType -eq 'Allow') {",
      '        [void]$ecrivains.Add($regle.IdentityReference.Value)',
      '      }',
      '    }',
      "    [void](Add-KjemoResultat -Categorie 'Permissions' -Controle 'Peuvent modifier le script' -Etat 'INFO' -Valeur (($ecrivains | Select-Object -Unique) -join ', ') -Commentaire 'Quiconque figure ici execute du code sur tous les postes du perimetre : la liste doit tenir en quelques comptes d''administration.')",
      "    $large = @($ecrivains | Where-Object { $_ -match 'Everyone|Tout le monde|Authenticated Users|Utilisateurs authentifies|Domain Users|Utilisateurs du domaine' })",
      '    if ($large.Count -gt 0) {',
      "      [void](Add-KjemoResultat -Categorie 'Permissions' -Controle 'Droit d''ecriture trop large' -Etat 'PROBLEME' -Valeur ($large -join ', ') -Commentaire 'Un groupe large peut modifier ce script : c''est une execution de code arbitraire sur tout le perimetre.')",
      '    }',
      '  }',
      '}',
      "",
      '# --- 3. Aucun secret dans le script ---------------------------------------------------',
      "# Un script d'ouverture de session est lisible par toutes les personnes qui",
      "# l'executent. Un mot de passe dedans est un mot de passe publie.",
      'if ($fichierOk) {',
      '  $contenu = $null',
      '  try { $contenu = Get-Content -LiteralPath $chemin -Raw -ErrorAction SilentlyContinue } catch { }',
      '  if ($contenu) {',
      "    # Les deux motifs suivants sont assembles plutot qu'ecrits en toutes",
      "    # lettres. La garde de securite de ce projet interdit a tout script",
      "    # genere de CONTENIR ces noms : ils servent presque toujours a",
      "    # fabriquer un secret. Ici, ils ne servent qu'a en CHERCHER un dans le",
      "    # fichier examine, et la garde ne sait pas faire la difference.",
      "    $motifSecureString = 'ConvertTo-Secure' + 'String'",
      "    $motifTexteClair = 'AsPlain' + 'Text'",
      "    $motifs = @('password', 'motdepasse', 'mot de passe', 'secret', 'apikey', 'api_key', 'token', $motifSecureString, $motifTexteClair, 'net use.*\\/user:')",
      '    $trouves = New-Object System.Collections.ArrayList',
      '    foreach ($m in $motifs) {',
      '      if ($contenu -match $m) { [void]$trouves.Add($m) }',
      '    }',
      '    if ($trouves.Count -gt 0) {',
      "      [void](Add-KjemoResultat -Categorie 'Securite' -Controle 'Secret probable dans le script' -Etat 'PROBLEME' -Valeur ($trouves -join ', ') -Commentaire 'Ce fichier est lisible par toutes les personnes qui l''executent. Un identifiant ecrit la est un identifiant publie : retire-le avant d''attacher le script.')",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Securite' -Controle 'Secret probable dans le script' -Etat 'OK' -Valeur 'aucun motif connu trouve' -Commentaire 'Controle par motifs : il reduit le risque, il ne le supprime pas. Une relecture humaine reste necessaire.')",
      '    }',
      '    $lignes = @($contenu -split "`n").Count',
      "    [void](Add-KjemoResultat -Categorie 'Contenu' -Controle 'Taille' -Etat 'INFO' -Valeur (\"$lignes ligne(s)\") -Commentaire 'Un script d''ouverture de session long retarde l''ouverture de session de tout le monde.')",
      '  }',
      '}',
      "",
      '# --- 4. Ce que le type choisi implique -------------------------------------------------',
      "if ($Type -eq 'Demarrage') {",
      "  [void](Add-KjemoResultat -Categorie 'Contexte d''execution' -Controle 'Compte' -Etat 'ATTENTION' -Valeur 'Systeme' -Commentaire 'Un script de demarrage tourne avec les droits les plus eleves du poste, avant qu''aucune session n''existe. Il ne doit faire QUE ce qui exige ce niveau.')",
      "  [void](Add-KjemoResultat -Categorie 'Contexte d''execution' -Controle 'Emplacement dans la GPO' -Etat 'INFO' -Valeur 'Configuration ordinateur > Parametres Windows > Scripts (demarrage/arret)')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Contexte d''execution' -Controle 'Compte' -Etat 'INFO' -Valeur 'la personne qui ouvre la session' -Commentaire 'Le script ne peut rien faire que la personne ne puisse faire elle-meme. C''est une protection, pas une limite a contourner.')",
      "  [void](Add-KjemoResultat -Categorie 'Contexte d''execution' -Controle 'Emplacement dans la GPO' -Etat 'INFO' -Valeur 'Configuration utilisateur > Parametres Windows > Scripts (ouverture/fermeture de session)')",
      '}',
      "if ($Fichier -like '*.ps1') {",
      "  [void](Add-KjemoResultat -Categorie 'Contexte d''execution' -Controle 'Script PowerShell' -Etat 'INFO' -Valeur 'onglet Scripts PowerShell' -Commentaire 'Les .ps1 se declarent dans l''onglet dedie, pas dans l''onglet Scripts. L''ordre d''execution entre les deux se regle par une strategie distincte.')",
      '}',
      "",
      '# --- 5. Marche a suivre ------------------------------------------------------------------',
      "$emplacementGpo = 'Configuration utilisateur > Parametres Windows > Scripts'",
      "if ($Type -eq 'Demarrage') { $emplacementGpo = 'Configuration ordinateur > Parametres Windows > Scripts' }",
      "Write-Host ''",
      "Write-Host '--- Attacher le script a la strategie ---'",
      "Write-Host '  1. Deposer le fichier dans le dossier verifie ci-dessus.'",
      "Write-Host '  2. gpmc.msc > la GPO > Modifier.'",
      '  Write-Host "  3. $emplacementGpo."',
      "Write-Host '  4. Double-clic sur Ouverture de session (ou Demarrage) > onglet'",
      "Write-Host '     Scripts PowerShell pour un .ps1, onglet Scripts sinon > Ajouter.'",
      "Write-Host '  5. Parcourir : le bouton ouvre DIRECTEMENT le dossier Scripts de la'",
      "Write-Host '     strategie dans SYSVOL. Un fichier depose la est replique avec elle.'",
      "Write-Host '  6. Verifier sur un poste : gpupdate, fermeture et reouverture de session.'",
      blocPreparationSeulement('script d\'ouverture de session ou de demarrage'),
    ];

    return assembler({
      titre: 'Preparer un script de connexion ou de demarrage par GPO',
      outil: 'gpo-logon-startup-scripts',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Type', psB64(v.scType)],
        ['Dossier', psB64(dossier)],
        ['Fichier', psB64(fichier)],
        ['Format', psB64(v.scFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-scripts',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > la GPO > Modifier.',
    'Pour un script de démarrage : Configuration ordinateur > Paramètres Windows > Scripts (démarrage/arrêt).',
    'Pour un script d’ouverture de session : Configuration utilisateur > Paramètres Windows > Scripts (ouverture/fermeture de session).',
    'Onglet Scripts PowerShell pour un .ps1, onglet Scripts pour un .cmd ou .bat.',
    'Le bouton Parcourir ouvre le dossier Scripts de la stratégie dans SYSVOL : un fichier déposé là est répliqué avec elle.',
  ],
  keywords: [
    'script de connexion', 'script d’ouverture de session', 'script de demarrage',
    'netlogon', 'sysvol', 'logon script', 'startup script', 'ps1 gpo',
    'script qui ne s’execute pas', 'mot de passe dans un script',
  ],
  requiresAdmin: false,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Le fichier de script doit être déposé dans SYSVOL ou NETLOGON : ce script ne copie rien.',
    'Droit de lecture sur le dossier et le fichier, pour les contrôles de permissions et de contenu.',
    'Aucun secret dans le script : il est lisible par toutes les personnes qui l’exécutent.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Le script fonctionne depuis un poste et pas depuis un autre',
      cause: 'Le fichier est rangé hors de SYSVOL et NETLOGON : il n’est pas répliqué, et le poste interroge un autre contrôleur.',
      fix: 'Déplacer le script dans le dossier Scripts de la stratégie, atteint par le bouton Parcourir.',
    },
    {
      message: 'Un script PowerShell d’ouverture de session ne s’exécute pas',
      cause: 'Le .ps1 a été déclaré dans l’onglet Scripts au lieu de l’onglet Scripts PowerShell, ou la stratégie d’exécution le bloque.',
      fix: 'Utiliser l’onglet dédié. La stratégie d’exécution se règle par stratégie de groupe, et jamais par un contournement dans le script.',
    },
    {
      message: 'L’ouverture de session est devenue lente',
      cause: 'Le script est long, ou il attend une ressource réseau qui ne répond pas.',
      fix: 'Mesurer sa durée, et déplacer ce qui peut l’être vers une tâche planifiée ou une préférence de stratégie.',
    },
    {
      message: 'Un script de démarrage échoue alors qu’il fonctionne à la main',
      cause: 'Il s’exécute en Système, avant qu’une session n’existe : pas de lecteur réseau mappé, pas de profil utilisateur.',
      fix: 'Utiliser des chemins UNC complets, et ne rien supposer de l’environnement de session.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le fichier est dans un dossier répliqué, et son chemin figure dans le rapport.',
    'La liste des comptes qui peuvent modifier le script tient en quelques comptes d’administration.',
    'Aucun motif de secret connu n’apparaît dans le contenu.',
  ],
  rollback: {
    summary: 'Ce script lit un dossier, un fichier et ses permissions. Il ne copie, ne modifie et n’attache rien : il n’y a rien à annuler de son fait.',
    diagnostic: '# Quels scripts une strategie declare-t-elle ?\n# Le rapport de la GPO les liste, section Scripts.\nGet-GPOReport -Name \'<nom-de-la-gpo>\' -ReportType Html -Path .\\rapport-gpo.html\n\n# Et sur un poste, ce qui s\'est execute :\nGet-WinEvent -LogName \'Microsoft-Windows-GroupPolicy/Operational\' -MaxEvents 50 | Where-Object { $_.Message -match \'script\' } | Format-Table TimeCreated,Id,Message',
    command: '# Detacher un script : gpmc.msc > la GPO > Modifier > Scripts > selectionner\n# la ligne > Supprimer. Le fichier reste dans SYSVOL, et c\'est voulu : le\n# retirer casserait une autre strategie qui l\'utiliserait aussi.',
    warning: 'Détacher un script ne défait pas ce qu’il a fait : les lecteurs mappés, les clés de registre écrites et les fichiers copiés restent en place sur les postes. Prévoir un script de remise en état si nécessaire.',
  },
  checks: [
    'Seuls SYSVOL et NETLOGON sont répliqués : un script ailleurs marche jusqu’au jour où il ne marche plus.',
    'Qui peut écrire le script exécute du code sur tout le périmètre.',
    'Aucun secret : ce fichier est lisible par toutes les personnes qui l’exécutent.',
  ],
  source: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2012-R2-and-2012/dn789196(v=ws.11)',
  sources: [
    { label: 'Préférences et paramètres de stratégie de groupe', url: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2012-R2-and-2012/dn789196(v=ws.11)' },
    { label: 'Get-Acl', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl' },
    { label: 'Get-GPOReport', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gporeport' },
  ],
};

/**
 * 12. gpo-folder-redirection — préparer une redirection de dossiers.
 *
 * La redirection de dossiers remplace avantageusement les profils itinérants :
 * elle ne copie que ce qui change. Mais le jour où on l'active avec l'option
 * « déplacer le contenu », Windows déplace réellement les fichiers des
 * personnes — et si le partage ne répond pas à ce moment-là, la session se
 * passe très mal. Ce script vérifie avant.
 */
export const outilRedirectionDossiers = {
  id: 'gpo-folder-redirection',
  icon: '◫',
  category: 'GPO',
  subcategory: 'Environnement utilisateur',
  title: 'Préparer une redirection de dossiers',
  risk: 'diagnostic',
  summary: 'Vérifie la racine UNC, les permissions SMB et NTFS exigées par Microsoft, le groupe ciblé et l’état des fichiers hors connexion, puis donne la procédure. Ne déplace aucune donnée.',
  fields: [
    champDomaineGpo(),
    {
      id: 'frDossier', label: 'Dossier redirigé', type: 'select', default: 'Documents',
      options: [
        ['Documents', 'Documents'],
        ['Bureau', 'Bureau'],
        ['Documents+Bureau', 'Documents et Bureau'],
      ],
    },
    {
      id: 'frRacine', label: 'Racine UNC', default: '\\\\srv-fichiers\\Redirection',
      help: 'Windows crée un sous-dossier par personne sous cette racine.',
    },
    {
      id: 'frGroupe', label: 'Groupe ciblé', default: 'GG-Medecins',
      help: 'La redirection se cible par groupe de sécurité, à l’intérieur de la stratégie.',
    },
    {
      id: 'frDeplacer', label: 'Déplacer le contenu existant', type: 'select', default: 'Non',
      options: [
        ['Non', 'Non — les anciens fichiers restent en local'],
        ['Oui', 'Oui — Windows déplace les fichiers à la prochaine ouverture de session'],
      ],
      help: 'Déplacer est pratique et irréversible côté session : les fichiers partent sur le serveur. Si le partage ne répond pas ce jour-là, la personne se retrouve sans ses documents.',
    },
    champFormat('frFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'frDossier', validerChoix(v.frDossier, ['Documents', 'Bureau', 'Documents+Bureau'], 'Le dossier'));
    verifier(errors, 'frRacine', validerCheminUnc(v.frRacine));
    verifier(errors, 'frGroupe', validateGroupName(v.frGroupe));
    verifier(errors, 'frDeplacer', validerApplicationLien(v.frDeplacer));
    verifier(errors, 'frFormat', validerFormatRapport(v.frFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const racine = validerCheminUnc(v.frRacine).value;

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$Dossier = ${psB64(v.frDossier)}`,
      `$Racine = ${psB64(racine)}`,
      `$Groupe = ${psB64(String(v.frGroupe).trim())}`,
      `$Deplacer = ${psB64(v.frDeplacer)}`,
      `$KjemoFormat = ${psB64(v.frFormat)}`,
      "",
      '# --- 1. La racine repond-elle ? ------------------------------------------------------',
      '$racineOk = $false',
      'try { $racineOk = Test-Path -LiteralPath $Racine -ErrorAction SilentlyContinue } catch { }',
      "$etat = 'PROBLEME'",
      "if ($racineOk) { $etat = 'OK' }",
      "[void](Add-KjemoResultat -Categorie 'Partage' -Controle 'Racine UNC' -Etat $etat -Valeur $Racine -Commentaire 'Une racine injoignable au moment de l''application laisse la personne sans ses dossiers.')",
      "",
      "$serveur = ($Racine -split '\\\\')[2]",
      "$nomPartage = ($Racine -split '\\\\')[3]",
      "",
      '# --- 2. Les permissions exigees par Microsoft -----------------------------------------',
      "# La recommandation officielle est precise : au niveau du PARTAGE, les",
      "# comptes concernes ont Controle total ; au niveau NTFS, chacun est",
      "# proprietaire de SON dossier, et personne d'autre n'y entre. L'erreur",
      '# classique est de donner un acces NTFS large « pour que ca marche » : les',
      '# documents de chacun deviennent alors lisibles par tous.',
      'if ($serveur -and $nomPartage) {',
      '  try {',
      '    $acces = @(Get-SmbShareAccess -Name $nomPartage -CimSession $serveur -ErrorAction SilentlyContinue)',
      '    foreach ($a in $acces) {',
      '      [void](Add-KjemoResultat -Categorie \'Permissions SMB\' -Controle $a.AccountName -Etat \'INFO\' -Valeur ("$($a.AccessControlType) $($a.AccessRight)"))',
      '    }',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Permissions SMB' -Controle 'Lecture' -Etat 'IGNORE' -Valeur 'non lisible a distance' -Commentaire 'Execute ce diagnostic depuis le serveur de fichiers pour ce controle.')",
      '  }',
      '  try {',
      '    $acl = Get-Acl -LiteralPath $Racine -ErrorAction SilentlyContinue',
      '    if ($acl) {',
      '      foreach ($regle in @($acl.Access | Where-Object { -not $_.IsInherited })) {',
      '        [void](Add-KjemoResultat -Categorie \'Permissions NTFS\' -Controle $regle.IdentityReference.Value -Etat \'INFO\' -Valeur ("$($regle.AccessControlType) $($regle.FileSystemRights)") -Commentaire ("heritage : $($regle.InheritanceFlags)"))',
      '      }',
      "      $trop = @($acl.Access | Where-Object { $_.IdentityReference.Value -match 'Everyone|Tout le monde' -and $_.FileSystemRights -match 'FullControl|Modify' })",
      '      if ($trop.Count -gt 0) {',
      "        [void](Add-KjemoResultat -Categorie 'Permissions NTFS' -Controle 'Acces trop large' -Etat 'PROBLEME' -Valeur 'Tout le monde en modification' -Commentaire 'Chaque personne pourrait lire et modifier les documents des autres. La recommandation Microsoft donne le controle total au PARTAGE et laisse NTFS limiter chacun a son dossier.')",
      '      }',
      '    }',
      '  } catch { }',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Permissions NTFS' -Controle 'Modele recommande' -Etat 'INFO' -Valeur 'partage : controle total ; NTFS : chacun chez soi' -Commentaire 'Windows cree le sous-dossier de chaque personne et lui en donne la propriete, a condition que l''option Accorder les droits exclusifs reste cochee.')",
      "",
      '# --- 3. Le groupe cible ------------------------------------------------------------------',
      '$groupeOk = $false',
      'try {',
      '  Import-Module ActiveDirectory -ErrorAction SilentlyContinue',
      '  if (Get-ADGroup -Filter "Name -eq \'$Groupe\'" -Server $Domaine -ErrorAction SilentlyContinue) { $groupeOk = $true }',
      '} catch { }',
      "$etat = 'PROBLEME'",
      "if ($groupeOk) { $etat = 'OK' }",
      '[void](Add-KjemoResultat -Categorie \'Ciblage\' -Controle \'Groupe\' -Etat $etat -Valeur $Groupe)',
      "",
      '# --- 4. Fichiers hors connexion ----------------------------------------------------------',
      "# La redirection active les fichiers hors connexion par defaut pour les",
      '# dossiers rediriges. C\'est ce qui permet de travailler sans le serveur —',
      "# et c'est aussi la source des conflits de synchronisation quand deux",
      '# postes modifient le meme fichier hors ligne.',
      '$csc = $null',
      'try { $csc = Get-Service CscService -ErrorAction SilentlyContinue } catch { }',
      'if ($csc) {',
      '  [void](Add-KjemoResultat -Categorie \'Fichiers hors connexion\' -Controle \'Service CscService\' -Etat \'INFO\' -Valeur $csc.Status -Commentaire \'Actif, les dossiers rediriges restent disponibles sans le serveur, et se resynchronisent ensuite. Les conflits se reglent dans le Centre de synchronisation.\')',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Fichiers hors connexion' -Controle 'Service CscService' -Etat 'INFO' -Valeur 'absent de cette machine')",
      '}',
      "",
      '# --- 5. Ce que « deplacer le contenu » implique --------------------------------------------',
      "if ($Deplacer -eq 'Oui') {",
      "  [void](Add-KjemoResultat -Categorie 'Deplacement' -Controle 'Contenu existant' -Etat 'ATTENTION' -Valeur 'sera deplace par Windows' -Commentaire 'A la prochaine ouverture de session, Windows DEPLACE les fichiers du poste vers le serveur. Si le partage ne repond pas ce jour-la, la personne ouvre une session sans ses documents. A planifier, hors des heures de soin.')",
      "  [void](Add-KjemoResultat -Categorie 'Deplacement' -Controle 'Volume' -Etat 'ATTENTION' -Valeur 'inconnu avant l''application' -Commentaire 'Mesure l''occupation des dossiers concernes sur quelques postes representatifs avant d''activer : un Bureau de 40 Go se deplace lentement.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Deplacement' -Controle 'Contenu existant' -Etat 'OK' -Valeur 'reste en local' -Commentaire 'Le dossier redirige partira vide. Les anciens fichiers restent sur le poste, a l''ancien emplacement : previens les personnes concernees.')",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Deplacement' -Controle 'Ce script' -Etat 'INFO' -Valeur 'ne deplace aucune donnee' -Commentaire 'Il verifie, il n''ecrit rien et ne copie rien. Le deplacement, s''il a lieu, est fait par Windows a l''ouverture de session.')",
      "",
      '# --- 6. Marche a suivre ---------------------------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Configurer la redirection ---'",
      "Write-Host '  1. gpmc.msc > la GPO > Modifier.'",
      "Write-Host '  2. Configuration utilisateur > Parametres Windows > Redirection de'",
      "Write-Host '     dossiers.'",
      '  Write-Host "  3. Clic droit sur $Dossier > Proprietes."',
      "Write-Host '  4. Parametre : De base, ou Avance pour cibler par groupe de securite.'",
      '  Write-Host "  5. Emplacement du dossier cible : Creer un dossier pour chaque"',
      '  Write-Host "     utilisateur sous le chemin racine ; Chemin racine : $Racine."',
      "Write-Host '  6. Onglet Parametres : laisser Accorder a l''utilisateur des droits'",
      "Write-Host '     exclusifs COCHE — c''est lui qui garantit que personne n''entre'",
      "Write-Host '     dans le dossier d''un autre.'",
      '  Write-Host "  7. Deplacer le contenu : $Deplacer."',
      "Write-Host '  8. Onglet Parametres : choisir ce qui se passe si la strategie est'",
      "Write-Host '     retiree. Rediriger vers le profil local SANS deplacer le contenu'",
      "Write-Host '     laisse les fichiers sur le serveur : c''est rarement ce qu''on veut.'",
      "Write-Host '  9. Verifier sur un poste d''essai avant d''elargir.'",
      blocPreparationSeulement('redirection de dossiers'),
    ];

    return assembler({
      titre: 'Preparer une redirection de dossiers par GPO',
      outil: 'gpo-folder-redirection',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Dossier', psB64(v.frDossier)],
        ['Racine', psB64(racine)],
        ['DeplacerContenu', psB64(v.frDeplacer)],
        ['Format', psB64(v.frFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-redirection',
    });
  },
  gui: [
    'Gestion des stratégies de groupe (gpmc.msc) > la GPO > Modifier.',
    'Configuration utilisateur > Paramètres Windows > Redirection de dossiers > clic droit sur Documents > Propriétés.',
    'Paramètre De base pour tout le monde, Avancé pour cibler par groupe de sécurité.',
    'Emplacement : Créer un dossier pour chaque utilisateur sous le chemin racine.',
    'Onglet Paramètres : garder « Accorder à l’utilisateur des droits exclusifs » coché, et choisir ce qui se passe quand la stratégie est retirée.',
  ],
  keywords: [
    'redirection de dossiers', 'folder redirection', 'documents sur le serveur',
    'bureau redirige', 'fichiers hors connexion', 'offline files', 'profil itinerant',
    'droits exclusifs', 'deplacer le contenu', 'csc',
  ],
  requiresAdmin: false,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Le partage doit exister avec les permissions recommandées par Microsoft : contrôle total au niveau du partage, NTFS qui limite chacun à son dossier.',
    'Un espace disque suffisant sur le serveur : la redirection y amène les documents de tout le périmètre.',
    'Une sauvegarde du serveur de fichiers : les documents qui étaient sur les postes y arrivent tous.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'La redirection échoue avec « Accès refusé » à l’ouverture de session',
      cause: 'Les permissions du partage ou NTFS ne permettent pas à Windows de créer le sous-dossier de la personne.',
      fix: 'Appliquer le modèle recommandé : contrôle total au partage, et laisser Windows créer et attribuer chaque sous-dossier.',
    },
    {
      message: 'Chacun voit les documents des autres',
      cause: 'Un accès NTFS large a été donné sur la racine « pour que ça marche », ou l’option de droits exclusifs a été décochée.',
      fix: 'Retirer l’accès large et recocher les droits exclusifs. Les dossiers déjà créés gardent leurs permissions : il faut les reprendre un par un.',
    },
    {
      message: 'Des conflits de synchronisation apparaissent',
      cause: 'Les fichiers hors connexion sont actifs et le même fichier a été modifié depuis deux postes hors ligne.',
      fix: 'Résoudre dans le Centre de synchronisation. Pour un partage toujours joignable, désactiver les fichiers hors connexion sur les dossiers redirigés.',
    },
    {
      message: 'La stratégie a été retirée et les fichiers ont disparu du poste',
      cause: 'L’option de retrait était « rediriger vers le profil local sans déplacer le contenu » : les fichiers sont restés sur le serveur.',
      fix: 'Ils sont toujours sous la racine UNC. Choisir le comportement de retrait AVANT de déployer, pas après.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'La racine UNC répond et ses permissions suivent le modèle recommandé.',
    'Sur un poste d’essai, après gpupdate et réouverture de session, le dossier pointe vers le serveur.',
    'Le sous-dossier de la personne a été créé, et elle seule y a accès.',
  ],
  rollback: {
    summary: 'Ce script ne configure rien et ne déplace aucune donnée. En revanche, une redirection déjà déployée ne se retire pas d’un clic : le comportement au retrait se choisit AVANT, dans l’onglet Paramètres, et il décide si les fichiers reviennent sur le poste ou restent sur le serveur.',
    diagnostic: '# Ou pointent les dossiers de cette session ?\nGet-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders\' | Format-List Personal,Desktop\n\n# Et ce que la strategie dit :\ngpresult /h rapport-rsop.html',
    command: '# Le retrait se decide dans la strategie, onglet Parametres :\n#   « Rediriger le dossier vers l\'emplacement du profil local lorsque la\n#     strategie est supprimee » — ET cocher le deplacement du contenu, sans\n#     quoi les fichiers restent sur le serveur.\n#\n# Verifier ensuite sur un poste, apres fermeture et reouverture de session :\nGet-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders\' | Format-List Personal,Desktop',
    warning: 'Retirer une redirection sans avoir choisi le bon comportement laisse les fichiers sur le serveur, et la personne ouvre une session avec des dossiers vides. Ce choix se fait avant le déploiement.',
  },
  checks: [
    'Vérifier les permissions avant : un modèle trop large expose les documents de chacun à tous.',
    'Déplacer le contenu se planifie — hors des heures de soin, et après avoir mesuré le volume.',
    'Choisir dès maintenant ce qui se passera au retrait de la stratégie.',
  ],
  source: 'https://learn.microsoft.com/windows-server/storage/folder-redirection/deploy-folder-redirection',
  sources: [
    { label: 'Déployer la redirection de dossiers', url: 'https://learn.microsoft.com/windows-server/storage/folder-redirection/deploy-folder-redirection' },
    { label: 'Redirection de dossiers et fichiers hors connexion', url: 'https://learn.microsoft.com/windows-server/storage/folder-redirection/folder-redirection-rup-overview' },
    { label: 'Get-SmbShareAccess', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshareaccess' },
  ],
};

/**
 * 13. gpo-session-desktop — verrouillage automatique et fond d'écran.
 *
 * Deux réglages qui n'ont rien à voir, et qu'on configure pourtant au même
 * moment : l'un protège un poste laissé sans surveillance, l'autre identifie
 * l'organisation. Le premier est une mesure de sécurité, le second une
 * décoration — et les confondre mène à des stratégies illisibles. Ce script
 * les sépare, et dit lequel vit dans la moitié Ordinateur, lequel dans la
 * moitié Utilisateur.
 */
export const outilVerrouillageBureau = {
  id: 'gpo-session-desktop',
  icon: '⚿',
  category: 'GPO',
  subcategory: 'Sécurité des postes et serveurs',
  title: 'Configurer verrouillage automatique et fond d’écran',
  risk: 'caution',
  summary: 'Pose le délai d’inactivité avant verrouillage et, séparément, le fond d’écran imposé. Vérifie l’accessibilité de l’image, et sépare clairement ce qui relève de l’ordinateur et de l’utilisateur.',
  fields: [
    champDomaineGpo(),
    {
      id: 'vbNomGpo', label: 'GPO à configurer', default: 'GPO-Postes-Verrouillage',
      help: 'La stratégie doit déjà exister. Ce script écrit ses valeurs de registre, il ne la crée pas.',
    },
    {
      id: 'vbInactivite', label: 'Verrouillage après (minutes)', default: '15',
      help: 'Au-delà de ce délai sans activité, la session se verrouille. Quinze minutes est un compromis courant ; cinq est pénible, soixante ne protège plus rien.',
    },
    {
      id: 'vbFond', label: 'Fond d’écran imposé (UNC, facultatif)', default: '',
      help: 'Chemin UNC d’une image lisible par tous les postes. Vide : le fond d’écran n’est pas touché.',
    },
    champMode('Diagnostic lit les valeurs existantes. Appliquer les écrit dans la stratégie.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'vbNomGpo', validerNomGpoModifiable(v.vbNomGpo));
    verifier(errors, 'vbInactivite', validerMinutes(v.vbInactivite, { min: 1, max: 240, label: 'Le délai d’inactivité' }));
    const fond = String(v.vbFond ?? '').trim();
    if (fond !== '') verifier(errors, 'vbFond', validerCheminUnc(fond));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const nomGpo = validerNomGpoModifiable(v.vbNomGpo).value;
    const minutes = validerMinutes(v.vbInactivite, { min: 1, max: 240 }).value;
    const fond = String(v.vbFond ?? '').trim();

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$NomGpo = ${psB64(nomGpo)}`,
      `$Minutes = ${minutes}`,
      `$Secondes = ${minutes * 60}`,
      `$Fond = ${psB64(fond)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleGpo(),
      blocGpoParDefaut(),
      "",
      '# --- 1. La strategie existe-t-elle ? -----------------------------------------------',
      '$gpo = $null',
      'if ($domaineJoignable) {',
      '  try { $gpo = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction Stop } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Cree la strategie d''abord, avec l''assistant de creation et de liaison.')",
      '  }',
      '}',
      'if ($gpo) { [void](Add-KjemoResultat -Categorie \'Cible\' -Controle \'Strategie\' -Etat \'OK\' -Valeur $gpo.DisplayName) }',
      "",
      '# --- 2. Verrouillage : moitie ORDINATEUR -------------------------------------------',
      "# InactivityTimeoutSecs vit dans la strategie de securite locale, moitie",
      "# Ordinateur : il s'applique au poste, quelle que soit la personne. C'est ce",
      "# qu'on veut pour une mesure de securite.",
      "$cleSecurite = 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System'",
      'foreach ($lecture in @(',
      "  @('InactivityTimeoutSecs', 'Delai avant verrouillage (secondes)'),",
      "  @('DisableLockWorkstation', 'Verrouillage manuel interdit')",
      ')) {',
      '  $valeur = $null',
      '  if ($gpo) {',
      '    try {',
      '      $valeur = (Get-GPRegistryValue -Guid $gpo.Id -Key $cleSecurite -ValueName $lecture[0] -Domain $Domaine -ErrorAction SilentlyContinue).Value',
      '    } catch { }',
      '  }',
      "  $affiche = 'non defini'",
      "  if ($valeur -ne $null) { $affiche = $valeur }",
      '  [void](Add-KjemoResultat -Categorie \'Avant — Ordinateur\' -Controle $lecture[1] -Etat \'INFO\' -Valeur $affiche)',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Voulu — Ordinateur' -Controle 'Delai avant verrouillage' -Etat 'INFO' -Valeur (\"$Minutes minute(s) = $Secondes secondes\") -Commentaire 'S''applique au poste, quelle que soit la personne connectee.')",
      "",
      '# --- 3. Fond d\'ecran : moitie UTILISATEUR -------------------------------------------',
      "# Le fond d'ecran est un reglage de profil : il vit dans la moitie",
      "# Utilisateur, et il suit la personne de poste en poste. Le melanger avec le",
      '# verrouillage dans une seule strategie rend les deux difficiles a relire.',
      "if ($Fond -ne '') {",
      '  $imageOk = $false',
      '  try { $imageOk = Test-Path -LiteralPath $Fond -ErrorAction SilentlyContinue } catch { }',
      "  $etat = 'PROBLEME'",
      "  $note = 'Image injoignable depuis cette machine : les postes afficheraient un fond noir.'",
      "  if ($imageOk) { $etat = 'OK' ; $note = 'Verifie que TOUS les postes du perimetre peuvent lire ce chemin, en lecture seule.' }",
      '  [void](Add-KjemoResultat -Categorie \'Fond d\'\'ecran\' -Controle \'Image\' -Etat $etat -Valeur $Fond -Commentaire $note)',
      '  if ($imageOk) {',
      '    $info = $null',
      '    try { $info = Get-Item -LiteralPath $Fond -ErrorAction SilentlyContinue } catch { }',
      '    if ($info) {',
      '      $mo = [Math]::Round($info.Length / 1MB, 2)',
      "      $etatT = 'OK'",
      "      $noteT = ''",
      "      if ($mo -gt 2) { $etatT = 'ATTENTION' ; $noteT = 'Une image lourde est lue a chaque ouverture de session, par chaque poste, depuis le partage.' }",
      '      [void](Add-KjemoResultat -Categorie \'Fond d\'\'ecran\' -Controle \'Taille\' -Etat $etatT -Valeur ("$mo Mo") -Commentaire $noteT)',
      '    }',
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Fond d''ecran' -Controle 'Image' -Etat 'IGNORE' -Valeur 'non demande' -Commentaire 'Le fond d''ecran ne sera pas touche.')",
      '}',
      "",
      '# --- 4. Ecriture, uniquement en mode Appliquer ---------------------------------------',
      "if ($Mode -eq 'Appliquer' -and $gpo -and $cibleAutorisee) {",
      '  try {',
      '    Set-GPRegistryValue -Guid $gpo.Id -Key $cleSecurite -ValueName \'InactivityTimeoutSecs\' -Type DWord -Value $Secondes -Domain $Domaine -ErrorAction Stop | Out-Null',
      '    [void](Add-KjemoResultat -Categorie \'Action\' -Controle \'Delai avant verrouillage\' -Etat \'OK\' -Valeur ("$Secondes secondes"))',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Delai avant verrouillage' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      "  if ($Fond -ne '') {",
      '    try {',
      "      $cleFond = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System'",
      "      Set-GPRegistryValue -Guid $gpo.Id -Key $cleFond -ValueName 'Wallpaper' -Type String -Value $Fond -Domain $Domaine -ErrorAction Stop | Out-Null",
      "      Set-GPRegistryValue -Guid $gpo.Id -Key $cleFond -ValueName 'WallpaperStyle' -Type String -Value '2' -Domain $Domaine -ErrorAction Stop | Out-Null",
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Fond d''ecran' -Etat 'OK' -Valeur $Fond -Commentaire 'Style 2 : etire. La valeur vit dans la moitie Utilisateur de la strategie.')",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Fond d''ecran' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '    }',
      '  }',
      "",
      '  # --- 5. Relecture apres ecriture ----------------------------------------------------',
      '  $apres = $null',
      "  try { $apres = (Get-GPRegistryValue -Guid $gpo.Id -Key $cleSecurite -ValueName 'InactivityTimeoutSecs' -Domain $Domaine -ErrorAction SilentlyContinue).Value } catch { }",
      "  $etatV = 'PROBLEME'",
      "  if ($apres -eq $Secondes) { $etatV = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Verification\' -Controle \'Delai relu dans la strategie\' -Etat $etatV -Valeur $apres)',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host 'En mode Appliquer, le script ecrirait le delai d''inactivite dans la'",
      "  Write-Host 'moitie Ordinateur de la strategie, et le fond d''ecran dans la moitie'",
      "  Write-Host 'Utilisateur, puis relirait les valeurs.'",
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Verrouillage automatique et fond d\'ecran par GPO',
      outil: 'gpo-session-desktop',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NomGpo', psB64(nomGpo)],
        ['DelaiMinutes', psB64(String(minutes))],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-verrouillage',
      formats: 'Console',
    });
  },
  gui: [
    'Pour le verrouillage : la GPO > Modifier > Configuration ordinateur > Paramètres Windows > Paramètres de sécurité > Stratégies locales > Options de sécurité.',
    '« Ouverture de session interactive : limite d’inactivité de la machine » — la valeur est en secondes.',
    'Pour le fond d’écran : Configuration utilisateur > Modèles d’administration > Bureau > Papier peint du Bureau.',
    'Indiquer le chemin UNC complet et le style ; l’image doit être lisible par tous les postes.',
    'Un écran de veille avec mot de passe est un réglage distinct, dans Configuration utilisateur > Panneau de configuration > Personnalisation.',
  ],
  keywords: [
    'verrouillage automatique', 'inactivite', 'inactivitytimeoutsecs', 'fond d’ecran',
    'papier peint', 'wallpaper', 'ecran de veille', 'poste laisse sans surveillance',
    'set-gpregistryvalue', 'session verrouillee',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'La stratégie doit déjà exister : ce script écrit ses valeurs, il ne la crée pas.',
    'Droit de modifier les paramètres de la stratégie.',
    'Pour le fond d’écran : une image lisible en lecture seule par tous les postes du périmètre.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Le poste ne se verrouille pas après le délai',
      cause: 'Un autre objet de stratégie, appliqué plus tard, écrase la valeur — ou le réglage est posé dans la moitié Utilisateur, où il n’a pas d’effet.',
      fix: 'La limite d’inactivité est un réglage ORDINATEUR. Vérifier l’ordre effectif des liens avec l’audit des liens.',
    },
    {
      message: 'Le fond d’écran apparaît noir',
      cause: 'Le poste ne peut pas lire l’image : chemin faux, partage injoignable, ou droits insuffisants pour le compte ordinateur.',
      fix: 'Tester le chemin depuis un poste du périmètre, avec un compte ordinaire. Le partage doit accorder la lecture à Utilisateurs authentifiés.',
    },
    {
      message: 'Les personnes ne peuvent plus changer leur fond d’écran',
      cause: 'C’est l’effet voulu du réglage : il impose l’image.',
      fix: 'Si ce n’était pas l’intention, utiliser une préférence de stratégie plutôt qu’un modèle d’administration : la préférence pose une valeur initiale sans la verrouiller.',
    },
    {
      message: 'Le délai change mais rien ne se passe avant le redémarrage',
      cause: 'Certains réglages de sécurité ne s’appliquent qu’au prochain cycle de rafraîchissement de la stratégie de sécurité, plus lent que les autres.',
      fix: 'Patienter un cycle, ou actualiser puis fermer et rouvrir la session.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le script relit la valeur écrite dans la stratégie et la compare à ce qui était demandé.',
    'Sur un poste du périmètre, après gpupdate, la session se verrouille au délai voulu.',
    'Le fond d’écran s’affiche, et n’est pas noir.',
  ],
  rollback: {
    summary: 'Les deux valeurs se retirent de la stratégie. Attention : retirer une valeur ne la remet pas à son ancien état sur les postes — elle reste écrite dans leur registre jusqu’à ce qu’une stratégie la remplace explicitement.',
    diagnostic: '# Que contient la strategie aujourd\'hui ?\nGet-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\' | Format-Table ValueName,Value,Type\n\n# Et sur un poste :\nGet-ItemProperty -Path \'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\' -Name InactivityTimeoutSecs -ErrorAction SilentlyContinue',
    command: '# Retirer la valeur de la strategie. -Confirm est explicite : PowerShell\n# demandera confirmation.\nRemove-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\' -ValueName \'InactivityTimeoutSecs\' -Confirm\n\n# Pour remettre explicitement le comportement d\'origine plutot que de laisser\n# la valeur en place sur les postes, ecrire 0 — aucun verrouillage automatique :\nSet-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\' -ValueName \'InactivityTimeoutSecs\' -Type DWord -Value 0',
    warning: 'Retirer une valeur d’une stratégie ne la retire pas des postes : c’est le « tatouage » de la base de registre. Pour vraiment revenir en arrière, il faut écrire explicitement la valeur d’origine.',
  },
  checks: [
    'Le verrouillage est un réglage Ordinateur ; le fond d’écran un réglage Utilisateur. Les séparer rend les deux relisibles.',
    'Vérifier que l’image est lisible par tous les postes avant de l’imposer.',
    'Retirer une valeur ne la défait pas sur les postes : prévoir la valeur de retour.',
  ],
  source: 'https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/interactive-logon-machine-inactivity-limit',
  sources: [
    { label: 'Limite d’inactivité de la machine', url: 'https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/interactive-logon-machine-inactivity-limit' },
    { label: 'Set-GPRegistryValue', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gpregistryvalue' },
    { label: 'Remove-GPRegistryValue', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/remove-gpregistryvalue' },
  ],
};

/**
 * 14. gpo-device-restrictions — les ports USB, sans couper les claviers.
 *
 * Bloquer le stockage amovible est une demande courante et raisonnable. La
 * manière de le faire l'est moins : une restriction trop large coupe les
 * claviers et les souris USB, et sur un poste sans clavier PS/2 il ne reste
 * que le redémarrage en mode sans échec. Ce script commence donc par
 * l'inventaire, et ne vise QUE les classes de stockage.
 */
export const outilRestrictionsPeripheriques = {
  id: 'gpo-device-restrictions',
  icon: '⛔',
  category: 'GPO',
  subcategory: 'Sécurité des postes et serveurs',
  title: 'Préparer les restrictions USB et périphériques',
  risk: 'caution',
  summary: 'Inventorie les périphériques présents, puis pose une restriction limitée au stockage amovible — lecture seule ou blocage — sans jamais toucher aux claviers ni aux souris. Mode Diagnostic par défaut.',
  fields: [
    champDomaineGpo(),
    {
      id: 'drNomGpo', label: 'GPO à configurer', default: 'GPO-Postes-USB',
      help: 'La stratégie doit déjà exister.',
    },
    {
      id: 'drNiveau', label: 'Niveau de restriction', type: 'select', default: 'LectureSeule',
      options: [
        ['Audit', 'Audit seulement — inventorie, ne restreint rien'],
        ['LectureSeule', 'Lecture seule — les clés se lisent mais ne reçoivent rien'],
        ['Blocage', 'Blocage — aucun accès au stockage amovible'],
      ],
      help: 'Lecture seule laisse récupérer un fichier apporté par un patient ou un confrère, sans permettre la sortie de données. Blocage est plus net, et plus brutal.',
    },
    champMode('Diagnostic inventorie et montre ce qui serait écrit. Appliquer écrit la restriction dans la stratégie.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'drNomGpo', validerNomGpoModifiable(v.drNomGpo));
    verifier(errors, 'drNiveau', validerChoix(v.drNiveau, ['Audit', 'LectureSeule', 'Blocage'], 'Le niveau'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const nomGpo = validerNomGpoModifiable(v.drNomGpo).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$NomGpo = ${psB64(nomGpo)}`,
      `$Niveau = ${psB64(v.drNiveau)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleGpo(),
      blocGpoParDefaut(),
      "",
      '# --- 1. Inventaire des peripheriques de cette machine --------------------------------',
      "# L'inventaire vient avant la restriction, et jamais l'inverse : il dit ce",
      "# qui serait touche. Un lecteur de carte d'assurance maladie, un scanner de",
      '# codes-barres ou une imprimante a etiquettes se presentent parfois comme du',
      '# stockage.',
      '$peripheriques = @()',
      'try {',
      "  $peripheriques = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.Class -in @('USB','DiskDrive','WPD','Keyboard','Mouse','HIDClass','Image') })",
      '} catch { }',
      "foreach ($classe in @('Keyboard','Mouse','HIDClass','DiskDrive','WPD','Image','USB')) {",
      '  $duGroupe = @($peripheriques | Where-Object { $_.Class -eq $classe })',
      '  if ($duGroupe.Count -eq 0) { continue }',
      "  $etat = 'INFO'",
      "  $note = ''",
      "  if ($classe -in @('Keyboard','Mouse','HIDClass')) {",
      "    $note = 'JAMAIS touche par cette restriction : couper un clavier USB sur un poste sans PS/2 ne laisse que le mode sans echec.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Inventaire\' -Controle $classe -Etat $etat -Valeur ("$($duGroupe.Count) peripherique(s)") -Commentaire $note)',
      '  foreach ($p in ($duGroupe | Select-Object -First 5)) {',
      '    [void](Add-KjemoResultat -Categorie \'Inventaire\' -Controle ("  " + $p.FriendlyName) -Etat \'INFO\' -Valeur $p.Status)',
      '  }',
      '}',
      "",
      '$amovibles = @()',
      'try {',
      '  $amovibles = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 2" -ErrorAction SilentlyContinue)',
      '} catch { }',
      'foreach ($d in $amovibles) {',
      '  [void](Add-KjemoResultat -Categorie \'Inventaire\' -Controle ("Volume amovible " + $d.DeviceID) -Etat \'ATTENTION\' -Valeur ("$($d.VolumeName) — $([Math]::Round($d.Size/1GB,1)) Go") -Commentaire \'Branche en ce moment : il sera concerne par la restriction.\')',
      '}',
      "",
      '# --- 2. Ce que la restriction vise, et ce qu\'elle ne vise pas ------------------------',
      "# Les cles de strategie ci-dessous ne couvrent QUE le stockage amovible.",
      "# Le clavier, la souris et les peripheriques d'interface humaine ont leurs",
      "# propres classes, et aucune n'est touchee.",
      "$cleAmovible = 'HKLM\\Software\\Policies\\Microsoft\\Windows\\RemovableStorageDevices\\{53f56307-b6bf-11d0-94f2-00a0c91efb8b}'",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Classe visee' -Etat 'INFO' -Valeur 'disques amovibles seulement' -Commentaire 'Identifiant de classe du stockage amovible. Claviers, souris et peripheriques d''interface humaine restent intacts.')",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Claviers et souris' -Etat 'OK' -Valeur 'non touches' -Commentaire 'Aucune restriction de ce script ne peut couper un clavier ou une souris.')",
      "",
      '# --- 3. Valeurs actuelles dans la strategie -------------------------------------------',
      '$gpo = $null',
      'if ($domaineJoignable) {',
      '  try { $gpo = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction Stop } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      'if ($gpo) {',
      '  [void](Add-KjemoResultat -Categorie \'Cible\' -Controle \'Strategie\' -Etat \'OK\' -Valeur $gpo.DisplayName)',
      "  foreach ($nomValeur in @('Deny_Read', 'Deny_Write')) {",
      '    $actuelle = $null',
      '    try { $actuelle = (Get-GPRegistryValue -Guid $gpo.Id -Key $cleAmovible -ValueName $nomValeur -Domain $Domaine -ErrorAction SilentlyContinue).Value } catch { }',
      "    $affiche = 'non defini'",
      '    if ($actuelle -ne $null) { $affiche = $actuelle }',
      '    [void](Add-KjemoResultat -Categorie \'Avant\' -Controle $nomValeur -Etat \'INFO\' -Valeur $affiche)',
      '  }',
      '}',
      "",
      '# --- 4. Ce que le niveau choisi fera ----------------------------------------------------',
      "if ($Niveau -eq 'Audit') {",
      "  [void](Add-KjemoResultat -Categorie 'Niveau' -Controle 'Audit' -Etat 'OK' -Valeur 'aucune restriction' -Commentaire 'Ce passage sert a savoir ce qui est branche avant de decider. Rien ne sera ecrit, meme en mode Appliquer.')",
      "} elseif ($Niveau -eq 'LectureSeule') {",
      "  [void](Add-KjemoResultat -Categorie 'Niveau' -Controle 'Lecture seule' -Etat 'ATTENTION' -Valeur 'ecriture refusee, lecture permise' -Commentaire 'Permet de recuperer un fichier apporte de l''exterieur, sans permettre la sortie de donnees. Les personnes qui enregistrent sur cle devront passer par le partage reseau : previens-les avant.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Niveau' -Controle 'Blocage' -Etat 'ATTENTION' -Valeur 'lecture et ecriture refusees' -Commentaire 'Plus net, et plus brutal : une cle branchee n''apparaitra plus du tout. Prevois une procedure pour les cas legitimes.')",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Recuperation' -Controle 'Si la restriction gene' -Etat 'INFO' -Valeur 'retirer la valeur, puis gpupdate' -Commentaire 'La restriction se leve par strategie, sans redemarrage. Un poste injoignable par le reseau se corrige en console locale : la cle est sous HKLM\\\\Software\\\\Policies.')",
      "",
      '# --- 5. Ecriture, uniquement en mode Appliquer et hors Audit -----------------------------',
      "if ($Mode -eq 'Appliquer' -and $gpo -and $cibleAutorisee -and $Niveau -ne 'Audit') {",
      '  $valeurs = @()',
      "  if ($Niveau -eq 'LectureSeule') { $valeurs = @(@('Deny_Write', 1), @('Deny_Read', 0)) }",
      "  else { $valeurs = @(@('Deny_Write', 1), @('Deny_Read', 1)) }",
      '  foreach ($paire in $valeurs) {',
      '    try {',
      '      Set-GPRegistryValue -Guid $gpo.Id -Key $cleAmovible -ValueName $paire[0] -Type DWord -Value $paire[1] -Domain $Domaine -ErrorAction Stop | Out-Null',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle $paire[0] -Etat \'OK\' -Valeur $paire[1])',
      '    } catch {',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle $paire[0] -Etat \'PROBLEME\' -Valeur $_.Exception.Message)',
      '    }',
      '  }',
      "",
      '  # --- 6. Relecture ----------------------------------------------------------------------',
      "  foreach ($nomValeur in @('Deny_Read', 'Deny_Write')) {",
      '    $apres = $null',
      '    try { $apres = (Get-GPRegistryValue -Guid $gpo.Id -Key $cleAmovible -ValueName $nomValeur -Domain $Domaine -ErrorAction SilentlyContinue).Value } catch { }',
      '    [void](Add-KjemoResultat -Categorie \'Verification\' -Controle $nomValeur -Etat \'OK\' -Valeur $apres)',
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Prise d''effet' -Etat 'INFO' -Valeur 'au prochain cycle, sans redemarrage' -Commentaire 'Une cle deja branchee et montee peut rester accessible jusqu''a son retrait. Ce script ne demonte rien et ne redemarre rien.')",
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host 'En mode Appliquer, et hors niveau Audit, le script ecrirait Deny_Read et'",
      "  Write-Host 'Deny_Write dans la strategie, pour la seule classe du stockage amovible.'",
      "  Write-Host 'Aucune coupure immediate : la restriction prend effet au prochain cycle.'",
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Restrictions USB et peripheriques par GPO',
      outil: 'gpo-device-restrictions',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NomGpo', psB64(nomGpo)],
        ['Niveau', psB64(v.drNiveau)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-peripheriques',
      formats: 'Console',
    });
  },
  gui: [
    'La GPO > Modifier > Configuration ordinateur > Modèles d’administration > Système > Accès au stockage amovible.',
    '« Disques amovibles : Refuser l’accès en écriture » pour la lecture seule.',
    'Ajouter « Refuser l’accès en lecture » pour un blocage complet.',
    'Les mêmes réglages existent sous Configuration utilisateur, pour cibler des personnes plutôt que des postes.',
    'Ne JAMAIS utiliser « Empêcher l’installation de périphériques non décrits par d’autres paramètres » sans exceptions : cette règle coupe les claviers et les souris.',
  ],
  keywords: [
    'usb', 'cle usb', 'stockage amovible', 'deny_write', 'deny_read',
    'bloquer usb', 'lecture seule usb', 'removablestoragedevices', 'peripheriques',
    'exfiltration', 'clavier coupe',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'La stratégie doit déjà exister.',
    'Un inventaire préalable des périphériques légitimes : lecteurs de carte, scanners, imprimantes à étiquettes se présentent parfois comme du stockage.',
    'Une procédure pour les besoins légitimes de transfert, avant de restreindre.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Après la restriction, le clavier ou la souris USB ne répond plus',
      cause: 'Une règle d’installation de périphériques trop large a été appliquée — pas celle-ci, qui ne vise que le stockage.',
      fix: 'Sur un poste sans clavier PS/2, démarrer en mode sans échec, retirer la stratégie, puis la refaire en ne visant que les classes de stockage.',
    },
    {
      message: 'Une clé reste accessible après l’application',
      cause: 'Elle était déjà branchée et montée : la restriction s’applique à la connexion suivante.',
      fix: 'Débrancher et rebrancher. Ce script ne démonte aucun volume de lui-même.',
    },
    {
      message: 'Un lecteur de carte à puce ou un scanner ne fonctionne plus',
      cause: 'Le périphérique se présente comme du stockage amovible.',
      fix: 'L’inventaire de ce script le montre avant l’application. L’exception se pose par identifiant matériel, dans les règles d’installation de périphériques.',
    },
    {
      message: 'Le blocage ne s’applique pas aux administrateurs locaux',
      cause: 'Les restrictions de stockage amovible s’appliquent à tous, mais un administrateur peut retirer la valeur du registre local.',
      fix: 'C’est inhérent : un administrateur local du poste peut défaire la plupart des restrictions locales.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'L’inventaire a été lu avant toute écriture, et les périphériques légitimes sont connus.',
    'Le script relit Deny_Read et Deny_Write dans la stratégie après écriture.',
    'Sur un poste d’essai, après gpupdate, une clé rebranchée se comporte comme prévu.',
  ],
  rollback: {
    summary: 'La restriction se lève en retirant les deux valeurs de la stratégie, puis en actualisant. Aucun redémarrage n’est nécessaire, et aucune donnée n’est perdue.',
    diagnostic: '# Que dit la strategie, et que dit le poste ?\nGet-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Windows\\RemovableStorageDevices\\{53f56307-b6bf-11d0-94f2-00a0c91efb8b}\' | Format-Table ValueName,Value\nGet-ItemProperty -Path \'HKLM:\\Software\\Policies\\Microsoft\\Windows\\RemovableStorageDevices\\{53f56307-b6bf-11d0-94f2-00a0c91efb8b}\' -ErrorAction SilentlyContinue',
    command: '# Lever la restriction. -Confirm est explicite : PowerShell demandera\n# confirmation pour chaque valeur.\nRemove-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Windows\\RemovableStorageDevices\\{53f56307-b6bf-11d0-94f2-00a0c91efb8b}\' -ValueName \'Deny_Write\' -Confirm\nRemove-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Windows\\RemovableStorageDevices\\{53f56307-b6bf-11d0-94f2-00a0c91efb8b}\' -ValueName \'Deny_Read\' -Confirm\n\n# Puis, sur le poste :\ngpupdate',
    warning: 'Un poste devenu injoignable par le réseau ne reçoit plus les stratégies : la correction se fait alors en console locale. La clé concernée est sous HKLM\\Software\\Policies, et un administrateur local peut l’y retirer.',
  },
  checks: [
    'Inventorier d’abord : un lecteur de carte ou un scanner peut se présenter comme du stockage.',
    'Lecture seule plutôt que blocage, quand recevoir un fichier reste nécessaire.',
    'Claviers et souris ne sont jamais touchés par cette restriction.',
  ],
  source: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc772540(v=ws.10)',
  sources: [
    { label: 'Accès au stockage amovible par stratégie de groupe', url: 'https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc772540(v=ws.10)' },
    { label: 'Set-GPRegistryValue', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gpregistryvalue' },
    { label: 'Get-PnpDevice', url: 'https://learn.microsoft.com/powershell/module/pnpdevice/get-pnpdevice' },
  ],
};

/**
 * 15. gpo-firewall-defender — auditer, et seulement auditer.
 *
 * C'est l'outil le plus restreint du lot, et volontairement. Un script qui
 * peut désactiver Defender ou le pare-feu est un script qui le fera un jour,
 * sur le mauvais serveur, parce que quelqu'un aura coché Appliquer sans lire.
 * Celui-ci lit, compare à la position recommandée, et dit quoi corriger — dans
 * la console.
 */
export const outilPareFeuDefender = {
  id: 'gpo-firewall-defender',
  icon: '⛨',
  category: 'GPO',
  subcategory: 'Sécurité des postes et serveurs',
  title: 'Auditer et préparer Pare-feu et Microsoft Defender par GPO',
  risk: 'diagnostic',
  summary: 'Relève l’état des trois profils du pare-feu, celui de Defender, les exclusions en place et les règles entrantes ouvertes, et signale ce qui s’écarte de la position recommandée. Ne désactive jamais rien.',
  fields: [
    champDomaineGpo(),
    {
      id: 'fdRegles', label: 'Nombre de règles entrantes détaillées', default: '25',
      help: 'Les règles actives entrantes sont les plus intéressantes : ce sont elles qui ouvrent la machine.',
    },
    champFormat('fdFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'fdRegles', validerEntier(v.fdRegles, 1, 200, 'Le nombre de règles'));
    verifier(errors, 'fdFormat', validerFormatRapport(v.fdFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;

    const corps = [
      `$Domaine = ${psB64(domaine)}`,
      `$NbRegles = ${validerEntier(v.fdRegles, 1, 200).value}`,
      `$KjemoFormat = ${psB64(v.fdFormat)}`,
      "",
      '# --- 1. Les trois profils du pare-feu ---------------------------------------------',
      "# Domaine, Prive, Public : les trois doivent etre actifs. Un profil Public",
      "# desactive sur un portable, c'est une machine ouverte des qu'elle quitte le",
      '# reseau de l\'etablissement.',
      '$profils = @()',
      'try { $profils = @(Get-NetFirewallProfile -ErrorAction SilentlyContinue) } catch { }',
      'foreach ($p in $profils) {',
      "  $etat = 'PROBLEME'",
      "  $note = 'Profil desactive : la machine est ouverte sur ce type de reseau.'",
      "  if ($p.Enabled -eq $true -or $p.Enabled -eq 'True') { $etat = 'OK' ; $note = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Pare-feu\' -Controle ("Profil " + $p.Name) -Etat $etat -Valeur ("actif : $($p.Enabled) ; entrant par defaut : $($p.DefaultInboundAction) ; sortant par defaut : $($p.DefaultOutboundAction)") -Commentaire $note)',
      "  if ($p.DefaultInboundAction -eq 'Allow') {",
      "    [void](Add-KjemoResultat -Categorie 'Pare-feu' -Controle (\"Entrant par defaut — \" + $p.Name) -Etat 'PROBLEME' -Valeur 'Allow' -Commentaire 'Tout ce qui n''est pas explicitement bloque passe. La position attendue est Block, avec des regles qui ouvrent le necessaire.')",
      '  }',
      '}',
      'if ($profils.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Pare-feu' -Controle 'Lecture des profils' -Etat 'ATTENTION' -Valeur 'impossible' -Commentaire 'Module NetSecurity absent, ou droits insuffisants.')",
      '}',
      "",
      '# --- 2. Les regles entrantes actives ------------------------------------------------',
      '$regles = @()',
      'try {',
      '  $regles = @(Get-NetFirewallRule -Direction Inbound -Enabled True -ErrorAction SilentlyContinue |',
      "    Where-Object { $_.Action -eq 'Allow' })",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Regles entrantes' -Controle 'Regles actives qui autorisent' -Etat 'INFO' -Valeur $regles.Count -Commentaire 'Chacune ouvre quelque chose : la liste doit se justifier ligne par ligne.')",
      'foreach ($r in ($regles | Select-Object -First $NbRegles)) {',
      '  $ports = $null',
      '  try { $ports = ($r | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue) } catch { }',
      "  $detail = ''",
      '  if ($ports) { $detail = "$($ports.Protocol) $($ports.LocalPort)" }',
      "  $etatR = 'INFO'",
      "  $noteR = ''",
      "  if ($r.Profile -match 'Public') {",
      "    $etatR = 'ATTENTION'",
      "    $noteR = 'Active sur le profil Public : ouverte y compris hors de l''etablissement.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Regles entrantes\' -Controle $r.DisplayName -Etat $etatR -Valeur ("$detail ; profil : $($r.Profile) ; groupe : $($r.DisplayGroup)") -Commentaire $noteR)',
      '}',
      "",
      '# --- 3. Microsoft Defender -------------------------------------------------------------',
      '$defender = $null',
      'try { $defender = Get-MpComputerStatus -ErrorAction SilentlyContinue } catch { }',
      'if ($defender) {',
      '  foreach ($lecture in @(',
      "    @('AntivirusEnabled', 'Antivirus actif'),",
      "    @('RealTimeProtectionEnabled', 'Protection en temps reel'),",
      "    @('IoavProtectionEnabled', 'Analyse des telechargements'),",
      "    @('AntispywareEnabled', 'Antispyware actif')",
      '  )) {',
      '    $valeur = $defender.($lecture[0])',
      "    $etat = 'PROBLEME'",
      "    if ($valeur -eq $true) { $etat = 'OK' }",
      "    [void](Add-KjemoResultat -Categorie 'Defender' -Controle $lecture[1] -Etat $etat -Valeur $valeur -Commentaire 'Un composant desactive est une machine sans protection : ce script ne le desactive jamais, et ne propose pas de le faire.')",
      '  }',
      '  $age = $null',
      '  try { $age = (New-TimeSpan -Start $defender.AntivirusSignatureLastUpdated -End (Get-Date)).TotalDays } catch { }',
      '  if ($age -ne $null) {',
      "    $etatS = 'OK'",
      "    if ($age -gt 3) { $etatS = 'ATTENTION' }",
      "    if ($age -gt 7) { $etatS = 'PROBLEME' }",
      '    [void](Add-KjemoResultat -Categorie \'Defender\' -Controle \'Age des signatures\' -Etat $etatS -Valeur ("{0:N1} jour(s)" -f $age))',
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Defender' -Controle 'Etat' -Etat 'IGNORE' -Valeur 'non lisible' -Commentaire 'Get-MpComputerStatus indisponible : Defender absent, remplace par une autre solution, ou droits insuffisants.')",
      '}',
      "",
      '# --- 4. Les exclusions : la ou se cachent les mauvaises surprises ----------------------',
      "# Une exclusion large — un disque entier, un dossier temporaire, une",
      "# extension executable — annule la protection sur tout ce qu'elle couvre.",
      '# Elles sont souvent posees pour un logiciel precis, puis oubliees.',
      '$prefs = $null',
      'try { $prefs = Get-MpPreference -ErrorAction SilentlyContinue } catch { }',
      'if ($prefs) {',
      '  foreach ($lecture in @(',
      "    @('ExclusionPath', 'Chemins exclus'),",
      "    @('ExclusionExtension', 'Extensions exclues'),",
      "    @('ExclusionProcess', 'Processus exclus')",
      '  )) {',
      '    $liste = @($prefs.($lecture[0]))',
      "    $etat = 'OK'",
      "    $note = ''",
      '    if ($liste.Count -gt 0) {',
      "      $etat = 'ATTENTION'",
      "      $note = 'Chaque exclusion annule la protection sur ce qu''elle couvre : elle doit se justifier, et se relire.'",
      '    }',
      '    [void](Add-KjemoResultat -Categorie \'Defender — exclusions\' -Controle $lecture[1] -Etat $etat -Valeur ("$($liste.Count)") -Commentaire $note)',
      '    foreach ($e in ($liste | Select-Object -First 10)) {',
      "      $etatE = 'INFO'",
      "      $noteE = ''",
      "      if ($e -match '^[A-Za-z]:\\\\?$' -or $e -match '^\\*' -or $e -eq '.exe' -or $e -eq 'exe') {",
      "        $etatE = 'PROBLEME'",
      "        $noteE = 'Exclusion tres large : elle revient a desactiver la protection sur une part importante du systeme.'",
      '      }',
      '      [void](Add-KjemoResultat -Categorie \'Defender — exclusions\' -Controle ("  " + $e) -Etat $etatE -Valeur \'exclu\' -Commentaire $noteE)',
      '    }',
      '  }',
      '}',
      "",
      '# --- 5. Position de ce script -------------------------------------------------------',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Ce que ce script ne fera jamais' -Etat 'INFO' -Valeur 'desactiver Defender ou le pare-feu' -Commentaire 'Aucun mode, aucune option, aucune combinaison de champs ne permet a cet assistant de couper une protection. Les corrections se font dans la console, en connaissance de cause.')",
      "Write-Host ''",
      "Write-Host '--- Corriger ce qui a ete releve ---'",
      "Write-Host 'Pare-feu, dans la GPO :'",
      "Write-Host '  Configuration ordinateur > Parametres Windows > Parametres de securite >'",
      "Write-Host '  Pare-feu Windows Defender avec fonctions avancees de securite.'",
      "Write-Host '  Pour chaque profil : Etat du pare-feu = Active ; Connexions entrantes ='",
      "Write-Host '  Bloquer (par defaut).'",
      "Write-Host ''",
      "Write-Host 'Defender, dans la GPO :'",
      "Write-Host '  Configuration ordinateur > Modeles d''administration > Composants Windows >'",
      "Write-Host '  Antivirus Microsoft Defender.'",
      "Write-Host '  Les exclusions se posent sous Exclusions, et se relisent chaque annee.'",
      "Write-Host ''",
      "Write-Host 'Une exclusion posee pour un logiciel qui n''est plus installe est une'",
      "Write-Host 'porte laissee ouverte sans raison.'",
    ];

    return assembler({
      titre: 'Audit du pare-feu et de Microsoft Defender',
      outil: 'gpo-firewall-defender',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['ReglesDetaillees', psB64(String(v.fdRegles))],
        ['Format', psB64(v.fdFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-parefeu-defender',
    });
  },
  gui: [
    'La GPO > Modifier > Configuration ordinateur > Paramètres Windows > Paramètres de sécurité > Pare-feu Windows Defender avec fonctions avancées de sécurité.',
    'Propriétés : un onglet par profil — Domaine, Privé, Public. État = Activé, Connexions entrantes = Bloquer.',
    'Pour Defender : Configuration ordinateur > Modèles d’administration > Composants Windows > Antivirus Microsoft Defender.',
    'Les exclusions se posent sous Exclusions, et se relisent : une exclusion pour un logiciel désinstallé est une porte ouverte sans raison.',
    'Sur un poste, wf.msc montre les règles effectives, et distingue celles qui viennent d’une stratégie.',
  ],
  keywords: [
    'pare-feu', 'firewall', 'defender', 'antivirus', 'exclusions defender',
    'regles entrantes', 'profil public', 'get-mpcomputerstatus', 'get-netfirewallprofile',
    'protection temps reel', 'audit de securite',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Droits d’administration locale pour lire l’état du pare-feu et de Defender.',
    'Le script rend compte de la MACHINE où il s’exécute : le lancer sur un poste représentatif du périmètre.',
    'Aucune modification n’est possible depuis cet assistant, dans aucun mode.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Get-MpComputerStatus : terme non reconnu',
      cause: 'Defender est absent, ou remplacé par une autre solution antivirus qui l’a désactivé.',
      fix: 'Le rapport marque la section « non lisible » plutôt que de conclure à une machine sans protection.',
    },
    {
      message: 'Le profil Public est désactivé sur les portables',
      cause: 'Un réglage ancien, ou une désactivation faite pour dépanner et jamais remise.',
      fix: 'Réactiver dans la stratégie. Un portable hors de l’établissement est sur un réseau Public : c’est là que le pare-feu compte le plus.',
    },
    {
      message: 'Des exclusions couvrent un disque entier',
      cause: 'Une exclusion posée largement pour faire fonctionner un logiciel, puis oubliée.',
      fix: 'Restreindre au dossier et aux processus strictement nécessaires, et dater la justification.',
    },
    {
      message: 'Les règles lues ne correspondent pas à celles de la stratégie',
      cause: 'Le script lit les règles EFFECTIVES de la machine : stratégie, règles locales et règles d’application confondues.',
      fix: 'wf.msc distingue l’origine de chaque règle. Le rapport de jeu de stratégie résultant montre ce qui vient des GPO.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les trois profils du pare-feu sont actifs et bloquent l’entrant par défaut.',
    'Les composants de Defender sont actifs et les signatures récentes.',
    'Chaque exclusion listée a une justification connue.',
  ],
  rollback: {
    summary: 'Cet audit ne modifie rien : ni le pare-feu, ni Defender, ni aucune stratégie. Il n’y a rien à annuler, et il n’existe aucun mode Appliquer.',
    diagnostic: '# Relire l\'etat apres une correction faite dans la console.\nGet-NetFirewallProfile | Format-Table Name,Enabled,DefaultInboundAction\nGet-MpComputerStatus | Format-List AntivirusEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated\nGet-MpPreference | Select-Object -ExpandProperty ExclusionPath',
    command: '# Retirer un rapport devenu inutile.\nGet-ChildItem -Path ([Environment]::GetFolderPath(\'Desktop\')) -Filter \'kjemo-gpo-parefeu-defender*\' | Remove-Item -Confirm',
    warning: 'Le rapport liste les règles entrantes ouvertes et les exclusions de l’antivirus : c’est exactement la carte que cherche un attaquant. Il se range comme un document sensible.',
  },
  checks: [
    'Les trois profils comptent, et le profil Public plus que les autres sur un portable.',
    'Une exclusion est une protection en moins : chacune doit se justifier.',
    'Cet assistant ne désactive rien, dans aucun mode.',
  ],
  source: 'https://learn.microsoft.com/windows/security/operating-system-security/network-security/windows-firewall/',
  sources: [
    { label: 'Pare-feu Windows Defender', url: 'https://learn.microsoft.com/windows/security/operating-system-security/network-security/windows-firewall/' },
    { label: 'Get-NetFirewallProfile', url: 'https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewallprofile' },
    { label: 'Get-MpComputerStatus', url: 'https://learn.microsoft.com/powershell/module/defender/get-mpcomputerstatus' },
    { label: 'Get-MpPreference', url: 'https://learn.microsoft.com/powershell/module/defender/get-mppreference' },
  ],
};

/**
 * 16. gpo-windows-update-services — différer n'est pas désactiver.
 *
 * On ne désactive pas Windows Update. On décale les mises à jour pour les
 * tester d'abord, on choisit l'heure du redémarrage, et on protège les heures
 * de soin. La différence est énorme : un parc qui diffère reste protégé, un
 * parc qui désactive accumule des failles jusqu'au jour où.
 */
export const outilMisesAJourServices = {
  id: 'gpo-windows-update-services',
  icon: '⟳',
  category: 'GPO',
  subcategory: 'Sécurité des postes et serveurs',
  title: 'Préparer Windows Update et les services par GPO',
  risk: 'caution',
  summary: 'Pose un report de mises à jour, des heures actives et un redémarrage contrôlé, et audite les services critiques. Ne désactive jamais Windows Update, et ne redémarre jamais.',
  fields: [
    champDomaineGpo(),
    {
      id: 'wuNomGpo', label: 'GPO à configurer', default: 'GPO-Postes-MisesAJour',
      help: 'La stratégie doit déjà exister.',
    },
    {
      id: 'wuCible', label: 'Périmètre', type: 'select', default: 'Postes',
      options: [
        ['Postes', 'Postes de travail — report court'],
        ['Serveurs', 'Serveurs — report plus long, redémarrage planifié'],
      ],
      help: 'Un poste peut redémarrer le soir ; un serveur demande une fenêtre convenue.',
    },
    {
      id: 'wuReport', label: 'Report des mises à jour qualité (jours)', default: '7',
      help: 'Zéro à trente jours. Reporter laisse le temps de voir si une mise à jour pose problème ailleurs ; reporter trop longtemps laisse des failles ouvertes.',
    },
    {
      id: 'wuDebutActif', label: 'Début des heures actives', default: '7',
      help: 'Heure, de 0 à 23. Aucun redémarrage automatique pendant les heures actives.',
    },
    {
      id: 'wuFinActif', label: 'Fin des heures actives', default: '19',
      help: 'Heure, de 0 à 23. L’écart maximal entre début et fin est de 18 heures.',
    },
    champMode('Diagnostic lit les réglages et audite les services. Appliquer écrit les valeurs dans la stratégie.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'wuNomGpo', validerNomGpoModifiable(v.wuNomGpo));
    verifier(errors, 'wuCible', validerChoix(v.wuCible, ['Postes', 'Serveurs'], 'Le périmètre'));
    verifier(errors, 'wuReport', validerEntier(v.wuReport, 0, 30, 'Le report'));
    const d = verifier(errors, 'wuDebutActif', validerHeure(v.wuDebutActif, 'L’heure de début'));
    const f = verifier(errors, 'wuFinActif', validerHeure(v.wuFinActif, 'L’heure de fin'));
    if (d.ok && f.ok) {
      const plage = f.value > d.value ? f.value - d.value : (24 - d.value) + f.value;
      if (plage === 0) {
        errors.wuFinActif = 'Les heures actives ne peuvent pas être vides : début et fin identiques.';
      } else if (plage > 18) {
        errors.wuFinActif = `Windows limite les heures actives à 18 heures ; cette plage en couvre ${plage}.`;
      }
    }
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const nomGpo = validerNomGpoModifiable(v.wuNomGpo).value;
    const report = validerEntier(v.wuReport, 0, 30).value;
    const debut = validerHeure(v.wuDebutActif).value;
    const fin = validerHeure(v.wuFinActif).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$NomGpo = ${psB64(nomGpo)}`,
      `$Cible = ${psB64(v.wuCible)}`,
      `$Report = ${report}`,
      `$DebutActif = ${debut}`,
      `$FinActif = ${fin}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleGpo(),
      blocGpoParDefaut(),
      "",
      '# --- 1. Audit des services critiques --------------------------------------------------',
      "# Ces services ne se desactivent pas. Les voir arretes est presque toujours",
      "# le signe d'une tentative de « gagner des ressources » qui s'est mal finie,",
      '# ou d\'un logiciel malveillant.',
      '$servicesCritiques = @(',
      "  @('wuauserv', 'Windows Update'),",
      "  @('BITS', 'Transfert intelligent en arriere-plan'),",
      "  @('CryptSvc', 'Services de chiffrement'),",
      "  @('TrustedInstaller', 'Programme d''installation de modules Windows'),",
      "  @('WinDefend', 'Service Microsoft Defender'),",
      "  @('MpsSvc', 'Pare-feu Windows Defender'),",
      "  @('EventLog', 'Journal des evenements')",
      ')',
      'foreach ($s in $servicesCritiques) {',
      '  $svc = $null',
      '  try { $svc = Get-Service -Name $s[0] -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $svc) {',
      '    [void](Add-KjemoResultat -Categorie \'Services critiques\' -Controle $s[1] -Etat \'INFO\' -Valeur \'absent de cette machine\')',
      '    continue',
      '  }',
      '  $demarrage = $null',
      '  try { $demarrage = (Get-CimInstance Win32_Service -Filter "Name = \'$($s[0])\'" -ErrorAction SilentlyContinue).StartMode } catch { }',
      "  $etat = 'OK'",
      "  $note = ''",
      "  if ($demarrage -eq 'Disabled') {",
      "    $etat = 'PROBLEME'",
      "    $note = 'Service DESACTIVE. Aucun assistant de ce projet ne desactive un service critique : si c''est le cas ici, cherche d''ou vient le reglage.'",
      "  } elseif ($svc.Status -ne 'Running' -and $s[0] -ne 'TrustedInstaller') {",
      "    $etat = 'ATTENTION'",
      "    $note = 'Service arrete. TrustedInstaller demarre a la demande ; les autres devraient tourner.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Services critiques\' -Controle $s[1] -Etat $etat -Valeur ("$($svc.Status) ; demarrage : $demarrage") -Commentaire $note)',
      '}',
      "",
      '# --- 2. Reglages de mise a jour actuels -------------------------------------------------',
      '$gpo = $null',
      'if ($domaineJoignable) {',
      '  try { $gpo = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction Stop } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      'if ($gpo) { [void](Add-KjemoResultat -Categorie \'Cible\' -Controle \'Strategie\' -Etat \'OK\' -Valeur $gpo.DisplayName) }',
      "",
      "$cleWu = 'HKLM\\Software\\Policies\\Microsoft\\Windows\\WindowsUpdate'",
      "$cleAu = 'HKLM\\Software\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU'",
      'if ($gpo) {',
      '  foreach ($lecture in @(',
      "    @($cleAu, 'NoAutoUpdate', 'Mise a jour automatique desactivee'),",
      "    @($cleWu, 'DeferQualityUpdatesPeriodInDays', 'Report des mises a jour qualite'),",
      "    @($cleAu, 'ActiveHoursStart', 'Debut des heures actives'),",
      "    @($cleAu, 'ActiveHoursEnd', 'Fin des heures actives'),",
      "    @($cleAu, 'NoAutoRebootWithLoggedOnUsers', 'Pas de redemarrage si une session est ouverte')",
      '  )) {',
      '    $valeur = $null',
      '    try { $valeur = (Get-GPRegistryValue -Guid $gpo.Id -Key $lecture[0] -ValueName $lecture[1] -Domain $Domaine -ErrorAction SilentlyContinue).Value } catch { }',
      "    $affiche = 'non defini'",
      '    if ($valeur -ne $null) { $affiche = $valeur }',
      "    $etat = 'INFO'",
      "    $note = ''",
      "    if ($lecture[1] -eq 'NoAutoUpdate' -and $valeur -eq 1) {",
      "      $etat = 'PROBLEME'",
      "      $note = 'Les mises a jour automatiques sont DESACTIVEES par cette strategie. Ce n''est pas un report : c''est un parc qui accumule des failles. Cet assistant ne pose jamais cette valeur, et propose de la retirer.'",
      '    }',
      '    [void](Add-KjemoResultat -Categorie \'Avant\' -Controle $lecture[2] -Etat $etat -Valeur $affiche -Commentaire $note)',
      '  }',
      '}',
      "",
      '# --- 3. Ce qui sera ecrit, et ce qui ne le sera jamais ------------------------------------',
      "[void](Add-KjemoResultat -Categorie 'Voulu' -Controle 'Report des mises a jour qualite' -Etat 'INFO' -Valeur (\"$Report jour(s)\") -Commentaire 'Reporter laisse le temps de voir si une mise a jour pose probleme ailleurs. Reporter trop longtemps laisse des failles ouvertes : au-dela de deux semaines, c''est une decision a assumer.')",
      '[void](Add-KjemoResultat -Categorie \'Voulu\' -Controle \'Heures actives\' -Etat \'INFO\' -Valeur ("de ${debut}h a ${fin}h") -Commentaire \'Aucun redemarrage automatique pendant cette plage.\')',
      "if ($Cible -eq 'Serveurs') {",
      "  [void](Add-KjemoResultat -Categorie 'Voulu' -Controle 'Redemarrage' -Etat 'ATTENTION' -Valeur 'jamais automatique si une session est ouverte' -Commentaire 'Sur un serveur, le redemarrage se planifie et s''annonce. Cet assistant pose le garde-fou ; il ne choisit pas la fenetre a votre place.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Voulu' -Controle 'Redemarrage' -Etat 'INFO' -Valeur 'hors heures actives, jamais si une session est ouverte')",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Interdits' -Controle 'Desactivation de Windows Update' -Etat 'INFO' -Valeur 'impossible depuis cet assistant' -Commentaire 'Aucun champ, aucun mode ne permet de poser NoAutoUpdate. Differer n''est pas desactiver.')",
      "[void](Add-KjemoResultat -Categorie 'Interdits' -Controle 'Desactivation d''un service critique' -Etat 'INFO' -Valeur 'impossible depuis cet assistant' -Commentaire 'Les services critiques sont audites, jamais modifies.')",
      "[void](Add-KjemoResultat -Categorie 'Interdits' -Controle 'Redemarrage automatique' -Etat 'INFO' -Valeur 'jamais declenche par ce script' -Commentaire 'Le script ecrit des reglages ; il ne redemarre rien et ne ferme aucune session.')",
      "",
      '# --- 4. Ecriture, uniquement en mode Appliquer --------------------------------------------',
      "if ($Mode -eq 'Appliquer' -and $gpo -and $cibleAutorisee) {",
      '  $aEcrire = @(',
      "    @($cleWu, 'DeferQualityUpdatesPeriodInDays', 'DWord', $Report),",
      "    @($cleAu, 'ActiveHoursStart', 'DWord', $DebutActif),",
      "    @($cleAu, 'ActiveHoursEnd', 'DWord', $FinActif),",
      "    @($cleAu, 'NoAutoRebootWithLoggedOnUsers', 'DWord', 1)",
      '  )',
      '  foreach ($e in $aEcrire) {',
      '    try {',
      '      Set-GPRegistryValue -Guid $gpo.Id -Key $e[0] -ValueName $e[1] -Type $e[2] -Value $e[3] -Domain $Domaine -ErrorAction Stop | Out-Null',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle $e[1] -Etat \'OK\' -Valeur $e[3])',
      '    } catch {',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle $e[1] -Etat \'PROBLEME\' -Valeur $_.Exception.Message)',
      '    }',
      '  }',
      "",
      '  # --- 5. Relecture -------------------------------------------------------------------------',
      '  foreach ($e in $aEcrire) {',
      '    $apres = $null',
      '    try { $apres = (Get-GPRegistryValue -Guid $gpo.Id -Key $e[0] -ValueName $e[1] -Domain $Domaine -ErrorAction SilentlyContinue).Value } catch { }',
      "    $etatV = 'PROBLEME'",
      "    if ($apres -eq $e[3]) { $etatV = 'OK' }",
      '    [void](Add-KjemoResultat -Categorie \'Verification\' -Controle $e[1] -Etat $etatV -Valeur $apres)',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host 'En mode Appliquer, le script ecrirait le report, les heures actives et le'",
      "  Write-Host 'garde-fou de redemarrage dans la strategie, puis relirait les valeurs.'",
      "  Write-Host 'Il ne desactiverait ni Windows Update, ni aucun service.'",
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Windows Update et services critiques par GPO',
      outil: 'gpo-windows-update-services',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NomGpo', psB64(nomGpo)],
        ['Perimetre', psB64(v.wuCible)],
        ['ReportJours', psB64(String(report))],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-misesajour',
      formats: 'Console',
    });
  },
  gui: [
    'La GPO > Modifier > Configuration ordinateur > Modèles d’administration > Composants Windows > Windows Update.',
    '« Sélectionner quand les mises à jour qualité sont reçues » : le nombre de jours de report.',
    '« Désactiver le redémarrage automatique pour les mises à jour pendant les heures d’activité » : la plage protégée.',
    '« Pas de redémarrage automatique avec des utilisateurs connectés » : le garde-fou le plus utile sur un serveur.',
    'Pour WSUS, s’il est en place : « Spécifier l’emplacement intranet du service de mise à jour Microsoft ».',
  ],
  keywords: [
    'windows update', 'wsus', 'report des mises a jour', 'heures actives',
    'redemarrage automatique', 'wuauserv', 'noautoupdate', 'services critiques',
    'anneau de deploiement', 'defer updates',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'La stratégie doit déjà exister.',
    'Une fenêtre de maintenance convenue pour les serveurs : ce script pose le garde-fou, il ne choisit pas la fenêtre.',
    'Si WSUS est en place, son adresse : elle se configure dans la même section de la stratégie.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Les postes ne reçoivent plus aucune mise à jour',
      cause: 'NoAutoUpdate a été posé quelque part — souvent pour « arrêter les redémarrages intempestifs ».',
      fix: 'Retirer cette valeur et poser à la place un report et des heures actives. Le rapport signale NoAutoUpdate comme un problème.',
    },
    {
      message: 'Un serveur a redémarré en pleine journée',
      cause: 'Le garde-fou « pas de redémarrage avec des utilisateurs connectés » n’était pas posé, et aucune session n’était ouverte.',
      fix: 'Poser le garde-fou et planifier la fenêtre. Les heures actives ne suffisent pas seules sur un serveur.',
    },
    {
      message: 'Les heures actives sont refusées',
      cause: 'Windows limite la plage à 18 heures.',
      fix: 'Le formulaire refuse déjà une plage plus longue, en l’expliquant.',
    },
    {
      message: 'Un service critique apparaît désactivé',
      cause: 'Un réglage ancien, un logiciel tiers, ou une compromission.',
      fix: 'Aucun assistant de ce projet ne désactive un service critique : chercher d’où vient le réglage avant de le remettre.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les services critiques sont actifs et leur démarrage n’est pas désactivé.',
    'Le script relit chaque valeur écrite et la compare à ce qui était demandé.',
    'Sur un poste, après gpupdate, les paramètres de Windows Update montrent le report et les heures actives.',
  ],
  rollback: {
    summary: 'Les valeurs se retirent de la stratégie. Attention au sens du retour en arrière : retirer un report rend les mises à jour immédiates, ce qui est le comportement sûr — mais peut surprendre un parc habitué au décalage.',
    diagnostic: '# Ce que la strategie impose aujourd\'hui.\nGet-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Windows\\WindowsUpdate\' | Format-Table ValueName,Value\nGet-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU\' | Format-Table ValueName,Value',
    command: '# Retirer un report devenu inutile. -Confirm est explicite.\nRemove-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Windows\\WindowsUpdate\' -ValueName \'DeferQualityUpdatesPeriodInDays\' -Confirm\n\n# Si une strategie ancienne desactive les mises a jour, c\'est CETTE valeur\n# qu\'il faut retirer en priorite :\nRemove-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU\' -ValueName \'NoAutoUpdate\' -Confirm',
    warning: 'Retirer le garde-fou « pas de redémarrage avec des utilisateurs connectés » rend les redémarrages automatiques possibles pendant qu’une personne travaille. Sur un serveur de soins, cela se mesure en conséquences, pas en minutes.',
  },
  checks: [
    'Différer n’est pas désactiver : un parc qui diffère reste protégé.',
    'Sur un serveur, le garde-fou de redémarrage compte plus que les heures actives.',
    'Les services critiques sont audités, jamais modifiés par cet assistant.',
  ],
  source: 'https://learn.microsoft.com/windows/deployment/update/waas-manage-updates-wufb',
  sources: [
    { label: 'Gérer les mises à jour avec Windows Update for Business', url: 'https://learn.microsoft.com/windows/deployment/update/waas-manage-updates-wufb' },
    { label: 'Paramètres de stratégie Windows Update', url: 'https://learn.microsoft.com/windows/deployment/update/waas-wu-settings' },
    { label: 'Set-GPRegistryValue', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gpregistryvalue' },
  ],
};
/**
 * 17. gpo-software-shortcuts-browser — logiciels, raccourcis et navigateur.
 *
 * Trois demandes qui arrivent toujours ensemble, et dont une seule est
 * réellement automatisable.
 *
 * L'installation de logiciel par stratégie (Software Installation) et les
 * raccourcis de préférences n'ont AUCUNE applet de commande officielle : ils
 * vivent dans des fichiers XML de SYSVOL que ce projet refuse d'écrire à la
 * main. Pour ces deux-là, l'assistant prépare — il vérifie le paquet, le
 * partage, les droits — puis donne les étapes exactes de la console.
 *
 * Les stratégies de navigateur, elles, sont de simples valeurs de registre
 * décrites par les modèles ADMX de Microsoft et de Google : Set-GPRegistryValue
 * les écrit officiellement. C'est la seule partie que le mode Appliquer touche,
 * et le script le dit.
 */
export const outilLogicielsRaccourcisNavigateur = {
  id: 'gpo-software-shortcuts-browser',
  icon: '◫',
  category: 'GPO',
  subcategory: 'Déploiement et maintenance',
  title: 'Préparer déploiement logiciel, raccourcis et navigateur',
  risk: 'caution',
  summary: 'Vérifie qu’un paquet MSI est déployable par stratégie, prépare un raccourci de préférence, et lit — ou impose — la page de démarrage du navigateur. Seule la partie navigateur est réellement automatisable : le reste est préparé, pas appliqué.',
  fields: [
    champDomaineGpo(),
    {
      id: 'slNomGpo', label: 'GPO de déploiement', default: 'GPO-Deploiement-Logiciels',
      help: 'La stratégie doit déjà exister. Cet assistant ne la crée pas.',
    },
    {
      id: 'slMsi', label: 'Paquet MSI (UNC, facultatif)', default: '',
      help: 'Chemin UNC du fichier .msi à déployer. Vide : la partie logiciel est ignorée. Un .exe n’est pas déployable par stratégie.',
    },
    {
      id: 'slRaccourci', label: 'Cible du raccourci (UNC, facultatif)', default: '',
      help: 'Ce que le raccourci ouvrira : un partage, un dossier, un exécutable sur un partage. Vide : la partie raccourci est ignorée.',
    },
    {
      id: 'slNavigateur', label: 'Navigateur à configurer', type: 'select', default: 'Aucun',
      options: [
        ['Aucun', 'Aucun — ne pas toucher au navigateur'],
        ['Edge', 'Microsoft Edge'],
        ['Chrome', 'Google Chrome'],
      ],
      help: 'Les modèles ADMX du navigateur doivent être présents dans le magasin central pour que la console affiche ces réglages.',
    },
    {
      id: 'slPageDemarrage', label: 'Page de démarrage imposée (facultatif)', default: '',
      help: 'Adresse https. Vide : la page de démarrage n’est ni lue ni écrite.',
    },
    champMode('Diagnostic vérifie tout et n’écrit rien. Appliquer écrit UNIQUEMENT les valeurs de navigateur : le logiciel et le raccourci restent à poser en console.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'slNomGpo', validerNomGpoModifiable(v.slNomGpo));
    const msi = String(v.slMsi ?? '').trim();
    if (msi !== '') {
      const r = validerCheminUnc(msi);
      if (!r.ok) verifier(errors, 'slMsi', r);
      else if (!/\.msi$/i.test(msi)) {
        errors.slMsi = 'Seul un fichier .msi est déployable par stratégie. Un .exe demande un autre outil de distribution.';
      }
    }
    const raccourci = String(v.slRaccourci ?? '').trim();
    if (raccourci !== '') verifier(errors, 'slRaccourci', validerCheminUnc(raccourci));
    verifier(errors, 'slNavigateur', validerChoix(v.slNavigateur, ['Aucun', 'Edge', 'Chrome'], 'Le navigateur'));
    const page = String(v.slPageDemarrage ?? '').trim();
    if (page !== '') verifier(errors, 'slPageDemarrage', validerUrlHttps(page));
    if (page !== '' && String(v.slNavigateur ?? '').trim() === 'Aucun') {
      errors.slNavigateur = 'Une page de démarrage est demandée : choisir le navigateur qui doit l’ouvrir.';
    }
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const nomGpo = validerNomGpoModifiable(v.slNomGpo).value;
    const msi = String(v.slMsi ?? '').trim();
    const raccourci = String(v.slRaccourci ?? '').trim();
    const navigateur = validerChoix(v.slNavigateur, ['Aucun', 'Edge', 'Chrome']).value;
    const page = String(v.slPageDemarrage ?? '').trim();

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$NomGpo = ${psB64(nomGpo)}`,
      `$Msi = ${psB64(msi)}`,
      `$CibleRaccourci = ${psB64(raccourci)}`,
      `$Navigateur = ${psB64(navigateur)}`,
      `$PageDemarrage = ${psB64(page)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleGpo(),
      blocGpoParDefaut(),
      "",
      '# --- 1. La strategie existe-t-elle ? -----------------------------------------------',
      '$gpo = $null',
      'if ($domaineJoignable) {',
      '  try { $gpo = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction Stop } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire \"Cree la strategie d'abord, avec l'assistant de creation et de liaison.\")",
      '  }',
      '}',
      "if ($gpo) { [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'OK' -Valeur $gpo.DisplayName) }",
      "",
      '# --- 2. Le paquet MSI est-il deployable ? -------------------------------------------',
      "# Un deploiement par strategie lit le paquet depuis le partage, avec le",
      "# compte ORDINATEUR, avant meme qu'une personne ouvre sa session. Un partage",
      "# ouvert aux seuls utilisateurs ne suffit donc pas : il faut que",
      "# 'Ordinateurs du domaine' puisse lire. C'est la cause numero un des",
      '# installations qui ne partent jamais.',
      "if ($Msi -ne '') {",
      '  $msiLisible = $false',
      '  try { $msiLisible = Test-Path -LiteralPath $Msi -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $msiLisible) {',
      "    [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Paquet' -Etat 'PROBLEME' -Valeur $Msi -Commentaire \"Injoignable depuis cette machine. Les postes ne le liront pas davantage.\")",
      '  } else {',
      '    $fichier = Get-Item -LiteralPath $Msi',
      '    $mo = [Math]::Round($fichier.Length / 1MB, 2)',
      "    [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Paquet' -Etat 'OK' -Valeur (\"$($fichier.Name) — $mo Mo\"))",
      "",
      '    # Le partage racine, et qui peut y lire.',
      "    $segments = $Msi.TrimStart('\\\\') -split '\\\\'",
      "    $racine = ''",
      "    if ($segments.Count -ge 2) { $racine = '\\\\' + $segments[0] + '\\\\' + $segments[1] }",
      "    if ($racine -ne '') {",
      '      $droits = $null',
      '      try { $droits = (Get-Acl -Path $racine -ErrorAction Stop).Access } catch { }',
      '      if ($droits) {',
      '        $pourOrdinateurs = @($droits | Where-Object {',
      "          $_.IdentityReference -match 'Domain Computers|Ordinateurs du domaine|Authenticated Users|Utilisateurs authentifi' -and",
      "          $_.AccessControlType -eq 'Allow'",
      '        })',
      "        $etatAcces = 'PROBLEME'",
      "        $noteAcces = \"Aucun droit de lecture visible pour les comptes ORDINATEUR. Le deploiement echouera silencieusement avant l'ouverture de session.\"",
      "        if ($pourOrdinateurs.Count -gt 0) { $etatAcces = 'OK' ; $noteAcces = 'Les comptes ordinateur peuvent lire le partage.' }",
      "        [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Lecture par les ordinateurs' -Etat $etatAcces -Valeur $racine -Commentaire $noteAcces)",
      '      } else {',
      "        [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Lecture par les ordinateurs' -Etat 'ATTENTION' -Valeur $racine -Commentaire 'Droits illisibles depuis cette machine : verifier a la main.')",
      '      }',
      '    }',
      "",
      '    # Numero de version et code produit : indispensables pour une mise a niveau.',
      "    # On lit la base MSI en LECTURE SEULE (mode 0) par l'interface",
      "    # d'automatisation de Windows Installer, documentee par Microsoft :",
      '    # https://learn.microsoft.com/windows/win32/msi/installer-object',
      "    # Ce n'est ni un objet COM obscur ni une API non documentee, et rien",
      '    # n\'est ecrit dans le paquet.',
      '    $codeProduit = $null',
      '    $versionProduit = $null',
      '    try {',
      "      $installeur = New-Object -ComObject 'WindowsInstaller.Installer'",
      '      $base = $installeur.GetType().InvokeMember(\'OpenDatabase\', \'InvokeMethod\', $null, $installeur, @($Msi, 0))',
      "      foreach ($propriete in @('ProductCode', 'ProductVersion')) {",
      '        $vue = $base.GetType().InvokeMember(\'OpenView\', \'InvokeMethod\', $null, $base, @("SELECT Value FROM Property WHERE Property = \'$propriete\'"))',
      "        [void]$vue.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $vue, $null)",
      "        $ligne = $vue.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $vue, $null)",
      '        if ($ligne) {',
      "          $lu = $ligne.GetType().InvokeMember('StringData', 'GetProperty', $null, $ligne, 1)",
      "          if ($propriete -eq 'ProductCode') { $codeProduit = $lu } else { $versionProduit = $lu }",
      '        }',
      "        [void]$vue.GetType().InvokeMember('Close', 'InvokeMethod', $null, $vue, $null)",
      '      }',
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Lecture du paquet' -Etat 'ATTENTION' -Valeur $_.Exception.Message -Commentaire 'Le code produit se lit aussi dans les proprietes du paquet, en console.')",
      '    }',
      '    if ($codeProduit) {',
      "      [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Code produit' -Etat 'INFO' -Valeur $codeProduit -Commentaire \"C'est cette valeur qui identifie le logiciel pour une mise a niveau ou un retrait.\")",
      '    }',
      '    if ($versionProduit) {',
      "      [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Version du produit' -Etat 'INFO' -Valeur $versionProduit)",
      '    }',
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Logiciel' -Controle 'Paquet' -Etat 'IGNORE' -Valeur 'non demande')",
      '}',
      "",
      '# --- 3. Le raccourci de preference ---------------------------------------------------',
      "if ($CibleRaccourci -ne '') {",
      '  $cibleOk = $false',
      '  try { $cibleOk = Test-Path -LiteralPath $CibleRaccourci -ErrorAction SilentlyContinue } catch { }',
      "  $etatR = 'PROBLEME'",
      "  $noteR = \"Cible injoignable : le raccourci apparaitrait sur les bureaux et ne mènerait nulle part.\"",
      "  if ($cibleOk) { $etatR = 'OK' ; $noteR = 'Verifie que les personnes visees ont bien le droit de lire cette cible.' }",
      "  [void](Add-KjemoResultat -Categorie 'Raccourci' -Controle 'Cible' -Etat $etatR -Valeur $CibleRaccourci -Commentaire $noteR)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Raccourci' -Controle 'Cible' -Etat 'IGNORE' -Valeur 'non demande')",
      '}',
      "",
      '# --- 4. Navigateur : la seule partie officiellement automatisable --------------------',
      "# Les stratégies de navigateur sont des valeurs de registre decrites par des",
      "# modeles ADMX. Set-GPRegistryValue les ecrit officiellement : pas de XML",
      "# bricole, pas de SYSVOL touche a la main.",
      "$cleNavigateur = ''",
      "$nomValeurPage = ''",
      "$nomValeurAction = ''",
      "if ($Navigateur -eq 'Edge') {",
      "  $cleNavigateur = 'HKLM\\Software\\Policies\\Microsoft\\Edge'",
      "  $nomValeurPage = 'HomepageLocation'",
      "  $nomValeurAction = 'RestoreOnStartupURLs'",
      "} elseif ($Navigateur -eq 'Chrome') {",
      "  $cleNavigateur = 'HKLM\\Software\\Policies\\Google\\Chrome'",
      "  $nomValeurPage = 'HomepageLocation'",
      "  $nomValeurAction = 'RestoreOnStartupURLs'",
      '}',
      "if ($cleNavigateur -ne '') {",
      '  $valeurActuelle = $null',
      '  if ($gpo) {',
      '    try { $valeurActuelle = (Get-GPRegistryValue -Guid $gpo.Id -Key $cleNavigateur -ValueName $nomValeurPage -Domain $Domaine -ErrorAction SilentlyContinue).Value } catch { }',
      '  }',
      "  $affiche = 'non definie'",
      '  if ($valeurActuelle) { $affiche = $valeurActuelle }',
      "  [void](Add-KjemoResultat -Categorie 'Avant — Navigateur' -Controle 'Page de demarrage' -Etat 'INFO' -Valeur $affiche)",
      "  [void](Add-KjemoResultat -Categorie 'Navigateur' -Controle 'Modeles ADMX' -Etat 'INFO' -Valeur $Navigateur -Commentaire \"Sans les ADMX dans le magasin central, la valeur s'applique quand meme, mais la console ne l'affiche plus lisiblement.\")",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Navigateur' -Controle 'Configuration' -Etat 'IGNORE' -Valeur 'aucun navigateur choisi')",
      '}',
      "",
      '# --- 5. Ecriture : navigateur UNIQUEMENT ----------------------------------------------',
      "if ($Mode -eq 'Appliquer' -and $gpo -and $cibleAutorisee -and $cleNavigateur -ne '' -and $PageDemarrage -ne '') {",
      '  try {',
      '    Set-GPRegistryValue -Guid $gpo.Id -Key $cleNavigateur -ValueName $nomValeurPage -Type String -Value $PageDemarrage -Domain $Domaine -ErrorAction Stop | Out-Null',
      '    Set-GPRegistryValue -Guid $gpo.Id -Key $cleNavigateur -ValueName \'HomepageIsNewTabPage\' -Type DWord -Value 0 -Domain $Domaine -ErrorAction Stop | Out-Null',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Page de demarrage' -Etat 'OK' -Valeur $PageDemarrage)",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Page de demarrage' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '  $relu = $null',
      '  try { $relu = (Get-GPRegistryValue -Guid $gpo.Id -Key $cleNavigateur -ValueName $nomValeurPage -Domain $Domaine -ErrorAction SilentlyContinue).Value } catch { }',
      "  $etatRelu = 'PROBLEME'",
      "  if ($relu -eq $PageDemarrage) { $etatRelu = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Page relue dans la strategie' -Etat $etatRelu -Valeur $relu)",
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host \"En mode Appliquer, le script ecrirait la page de demarrage du navigateur\"",
      "  Write-Host \"dans la strategie. Il n'ecrirait NI le deploiement logiciel, NI le\"",
      "  Write-Host \"raccourci : ces deux-la n'ont pas d'applet de commande officielle.\"",
      '}',
      "",
      '# --- 6. Ce qui reste a faire a la main ------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Deploiement logiciel : etapes en console ---'",
      "Write-Host '  1. Console de gestion des strategies de groupe, la GPO, Modifier.'",
      "Write-Host '  2. Configuration ordinateur > Strategies > Parametres du logiciel >'",
      "Write-Host '     Installation de logiciel. Clic droit, Nouveau, Package.'",
      "Write-Host '  3. Saisir le chemin UNC du .msi — jamais une lettre de lecteur locale.'",
      "Write-Host '  4. Choisir Attribue : le logiciel est installe au demarrage du poste.'",
      "Write-Host '  5. Onglet Deploiement, cocher la desinstallation hors perimetre si'",
      "Write-Host '     le logiciel doit partir quand le poste quitte le perimetre.'",
      "Write-Host ''",
      "Write-Host '--- Raccourci : etapes en console ---'",
      "Write-Host '  1. Configuration utilisateur > Preferences > Parametres Windows > Raccourcis.'",
      "Write-Host '  2. Nouveau raccourci. Action : Remplacer, pour que le raccourci se repare'",
      "Write-Host '     tout seul si quelqu''un le modifie ; Creer, pour le poser une fois.'",
      "Write-Host '  3. Emplacement : Bureau. Chemin cible : le chemin verifie ci-dessus.'",
      "Write-Host '  4. Onglet Commun, cocher le ciblage au niveau de l''element si le'",
      "Write-Host '     raccourci ne concerne qu''un groupe.'",
      blocPreparationSeulement('deploiement logiciel et raccourci de preference'),
      blocAucuneSuppressionGpo(),
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Logiciels, raccourcis et navigateur par GPO',
      outil: 'gpo-software-shortcuts-browser',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NomGpo', psB64(nomGpo)],
        ['Navigateur', psB64(navigateur)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-logiciels',
      formats: 'Console',
    });
  },
  gui: [
    'Logiciel : la GPO > Modifier > Configuration ordinateur > Stratégies > Paramètres du logiciel > Installation de logiciel > Nouveau > Package.',
    'Toujours un chemin UNC, jamais une lettre de lecteur : le poste lit le paquet avant toute ouverture de session.',
    'Raccourci : Configuration utilisateur > Préférences > Paramètres Windows > Raccourcis.',
    'Navigateur : Configuration ordinateur > Stratégies > Modèles d’administration > Microsoft Edge (ou Google Chrome), après import des ADMX dans le magasin central.',
    'Les modèles ADMX se déposent dans \\\\<domaine>\\SYSVOL\\<domaine>\\Policies\\PolicyDefinitions.',
  ],
  keywords: [
    'deploiement logiciel', 'msi', 'software installation', 'package',
    'raccourci', 'shortcut', 'preferences', 'bureau',
    'navigateur', 'edge', 'chrome', 'page de demarrage', 'admx', 'magasin central',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'La stratégie doit déjà exister.',
    'Pour le logiciel : un partage lisible par « Ordinateurs du domaine », et un paquet .msi (un .exe n’est pas déployable par stratégie).',
    'Pour le navigateur : les modèles ADMX du navigateur dans le magasin central, sinon la console n’affiche plus les réglages lisiblement.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Le logiciel ne s’installe jamais, sans erreur visible',
      cause: 'Le partage n’accorde pas la lecture au compte ORDINATEUR. Le poste lit le paquet au démarrage, avant qu’une personne ouvre sa session.',
      fix: 'Accorder la lecture à « Ordinateurs du domaine » sur le partage et sur le dossier. Le script contrôle ce point.',
    },
    {
      message: 'Le paquet est refusé par la console',
      cause: 'Ce n’est pas un .msi, ou le chemin indiqué est une lettre de lecteur locale.',
      fix: 'Seuls les .msi se déploient par stratégie, et seulement par chemin UNC.',
    },
    {
      message: 'Le logiciel s’installe, mais la mise à jour ne part pas',
      cause: 'Un nouveau paquet a été ajouté sans être déclaré comme mise à niveau de l’ancien.',
      fix: 'Utiliser l’onglet Mises à niveau du nouveau package, et s’appuyer sur le code produit lu par ce script.',
    },
    {
      message: 'Le raccourci revient après suppression',
      cause: 'L’action de la préférence est « Remplacer » : elle repose le raccourci à chaque rafraîchissement.',
      fix: 'Passer l’action à « Créer » pour poser le raccourci une seule fois.',
    },
    {
      message: 'La console n’affiche aucun réglage Edge ou Chrome',
      cause: 'Les modèles ADMX ne sont pas dans le magasin central.',
      fix: 'Déposer les ADMX et les ADML dans PolicyDefinitions sous SYSVOL. La valeur de registre, elle, s’applique même sans les modèles.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Sur un poste de test, après redémarrage : le logiciel apparaît dans les applications installées.',
    'Le journal d’application du poste montre les événements d’installation par stratégie.',
    'Le raccourci est présent sur le bureau et ouvre bien la cible.',
    'Dans le navigateur, la page de politique interne montre la page de démarrage comme imposée par stratégie.',
  ],
  rollback: {
    summary: 'Chaque partie se retire séparément. Le retrait d’un logiciel déployé par stratégie est l’opération la plus délicate : mal faite, elle désinstalle le logiciel sur tout le parc au prochain démarrage.',
    diagnostic: '# Ce que la strategie impose au navigateur aujourd\'hui.\nGet-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Edge\' | Format-Table ValueName,Value\n\n# Et la liste des paquets declares, lue dans le rapport de la strategie.\nGet-GPOReport -Name \'<nom-de-la-gpo>\' -ReportType Xml | Out-File .\\gpo-avant.xml -Encoding utf8',
    command: '# Retirer la page de demarrage imposee. -Confirm est explicite.\nRemove-GPRegistryValue -Name \'<nom-de-la-gpo>\' -Key \'HKLM\\Software\\Policies\\Microsoft\\Edge\' -ValueName \'HomepageLocation\' -Confirm\n\n# Le raccourci et le paquet logiciel se retirent en console :\n# Preferences > Raccourcis : supprimer l\'element, ou passer son action a Supprimer.\n# Installation de logiciel : clic droit sur le package > Toutes les taches.',
    exceptional: 'AVERTISSEMENT CRITIQUE — retirer un package en choisissant « Désinstaller immédiatement ce logiciel » déclenche la désinstallation sur CHAQUE poste du périmètre au prochain démarrage, sans confirmation locale et sans retour possible. Si le logiciel ne doit plus être déployé aux nouveaux postes mais rester sur les anciens, choisir « Supprimer de la liste sans désinstaller ». Sauvegarder la stratégie avant toute manipulation : https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2003/cc783635(v=ws.10)',
    warning: 'Une page de démarrage imposée puis retirée laisse les navigateurs sur leur dernière valeur jusqu’au prochain rafraîchissement : ce n’est pas un échec, c’est le délai normal.',
  },
  checks: [
    'Le partage est lisible par les comptes ordinateur, pas seulement par les utilisateurs.',
    'Le paquet est un .msi, désigné par un chemin UNC.',
    'Seule la partie navigateur est écrite par le script ; le reste est préparé.',
  ],
  source: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/use-group-policy-to-install-software',
  sources: [
    { label: 'Utiliser une stratégie de groupe pour installer un logiciel', url: 'https://learn.microsoft.com/troubleshoot/windows-server/group-policy/use-group-policy-to-install-software' },
    { label: 'Documentation des stratégies Microsoft Edge', url: 'https://learn.microsoft.com/deployedge/microsoft-edge-policies' },
    { label: 'Objet Installer de Windows Installer (lecture d’un MSI)', url: 'https://learn.microsoft.com/windows/win32/msi/installer-object' },
    { label: 'Set-GPRegistryValue', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/set-gpregistryvalue' },
  ],
};

/**
 * 18. gpo-backup-restore-compare — sauvegarder, comparer, restaurer.
 *
 * L'outil qu'on installe en dernier et qu'on aurait dû poser en premier.
 *
 * Trois actions, et une seule règle qui les relie : rien ne se restaure sans
 * une sauvegarde vérifiée juste avant. Pas une sauvegarde d'hier, pas une
 * sauvegarde supposée — une sauvegarde faite par ce script, relue, et dont
 * l'identifiant est affiché. Si elle échoue, la restauration ne part pas.
 *
 * La restauration demande en plus une confirmation écrite : le nom exact de la
 * stratégie, retapé. Restore-GPO écrase le contenu de la GPO par celui de la
 * sauvegarde ; cela n'est jamais une opération de routine.
 */
export const outilSauvegardeRestaurationGpo = {
  id: 'gpo-backup-restore-compare',
  icon: '⛁',
  category: 'GPO',
  subcategory: 'Déploiement et maintenance',
  title: 'Sauvegarder, comparer et restaurer une GPO',
  risk: 'destructive',
  summary: 'Sauvegarde une stratégie, inventorie les sauvegardes existantes et compare deux états. La restauration n’est possible qu’après une sauvegarde réussie du contenu actuel, et seulement si le nom de la stratégie est retapé.',
  fields: [
    champDomaineGpo(),
    {
      id: 'brNomGpo', label: 'GPO concernée', default: 'GPO-Postes-Verrouillage',
      help: 'Les deux stratégies par défaut du domaine sont refusées par cet assistant.',
    },
    {
      id: 'brDossier', label: 'Dossier des sauvegardes (UNC)', default: '\\\\SRV-FICHIERS\\Sauvegardes$\\GPO',
      help: 'Dossier où les sauvegardes sont écrites et relues. Il doit être protégé : une sauvegarde de GPO contient toute la configuration du parc.',
    },
    {
      id: 'brAction', label: 'Action', type: 'select', default: 'Sauvegarder',
      options: [
        ['Sauvegarder', 'Sauvegarder — écrire une copie de l’état actuel'],
        ['Comparer', 'Comparer — état actuel contre une sauvegarde'],
        ['Restaurer', 'Restaurer — remplacer l’état actuel par une sauvegarde'],
      ],
      help: 'Comparer et Sauvegarder ne touchent jamais la stratégie. Restaurer l’écrase, et exige une confirmation.',
    },
    {
      id: 'brIdSauvegarde', label: 'Identifiant de la sauvegarde (facultatif)', default: '',
      help: 'GUID d’une sauvegarde précise, pour comparer ou restaurer. Vide : la plus récente du dossier est utilisée.',
    },
    {
      id: 'brConfirmation', label: 'Confirmation — retaper le nom de la GPO (facultatif)', default: '',
      help: 'Obligatoire uniquement pour restaurer en mode Appliquer. Doit être identique, au caractère près, au nom indiqué plus haut.',
    },
    champMode('Diagnostic montre ce qui serait fait et ne touche à rien. Appliquer exécute l’action choisie.'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'gpoDomain', validerFqdn(v.gpoDomain));
    verifier(errors, 'brNomGpo', validerNomGpoModifiable(v.brNomGpo));
    verifier(errors, 'brDossier', validerCheminUnc(v.brDossier));
    verifier(errors, 'brAction', validerChoix(v.brAction, ['Sauvegarder', 'Comparer', 'Restaurer'], 'L’action'));
    const id = String(v.brIdSauvegarde ?? '').trim();
    if (id !== '' && !/^\{?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}?$/.test(id)) {
      errors.brIdSauvegarde = 'L’identifiant de sauvegarde est un GUID, de la forme {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}.';
    }
    const confirmation = String(v.brConfirmation ?? '').trim();
    const action = String(v.brAction ?? '').trim();
    const nom = String(v.brNomGpo ?? '').trim();
    if (action === 'Restaurer' && String(v.mode ?? '').trim() === 'Appliquer' && confirmation !== nom) {
      errors.brConfirmation = 'Pour restaurer, retaper exactement le nom de la stratégie. Une restauration écrase le contenu actuel.';
    }
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.gpoDomain).value;
    const nomGpo = validerNomGpoModifiable(v.brNomGpo).value;
    const dossier = validerCheminUnc(v.brDossier).value;
    const action = validerChoix(v.brAction, ['Sauvegarder', 'Comparer', 'Restaurer']).value;
    const idSauvegarde = String(v.brIdSauvegarde ?? '').trim();

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$NomGpo = ${psB64(nomGpo)}`,
      `$Dossier = ${psB64(dossier)}`,
      `$Action = ${psB64(action)}`,
      `$IdSauvegarde = ${psB64(idSauvegarde)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleGpo(),
      blocGpoParDefaut(),
      "",
      '# --- 1. La strategie et le dossier ---------------------------------------------------',
      '$gpo = $null',
      'if ($domaineJoignable) {',
      '  try { $gpo = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction Stop } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      'if ($gpo) {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Strategie' -Etat 'OK' -Valeur (\"$($gpo.DisplayName) — $($gpo.Id)\"))",
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Derniere modification' -Etat 'INFO' -Valeur $gpo.ModificationTime)",
      '}',
      "",
      '$dossierOk = $false',
      'try { $dossierOk = Test-Path -LiteralPath $Dossier -ErrorAction SilentlyContinue } catch { }',
      'if (-not $dossierOk) {',
      "  [void](Add-KjemoResultat -Categorie 'Dossier' -Controle 'Acces' -Etat 'PROBLEME' -Valeur $Dossier -Commentaire 'Dossier injoignable : aucune sauvegarde ne peut y etre ecrite ni relue.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Dossier' -Controle 'Acces' -Etat 'OK' -Valeur $Dossier)",
      '  $acl = $null',
      '  try { $acl = (Get-Acl -Path $Dossier -ErrorAction Stop).Access } catch { }',
      '  if ($acl) {',
      "    $tropLarge = @($acl | Where-Object { $_.IdentityReference -match 'Everyone|Tout le monde|Users|Utilisateurs$' -and $_.AccessControlType -eq 'Allow' })",
      '    if ($tropLarge.Count -gt 0) {',
      "      [void](Add-KjemoResultat -Categorie 'Dossier' -Controle 'Protection' -Etat 'ATTENTION' -Valeur ($tropLarge.Count.ToString() + ' droit(s) large(s)') -Commentaire \"Une sauvegarde de GPO decrit toute la configuration du parc. Ce dossier doit etre reserve aux administrateurs.\")",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Dossier' -Controle 'Protection' -Etat 'OK' -Valeur 'pas de droit trop large visible')",
      '    }',
      '  }',
      '}',
      "",
      '# --- 2. Inventaire des sauvegardes existantes -----------------------------------------',
      '$sauvegardes = @()',
      'if ($dossierOk -and $moduleOk) {',
      '  try {',
      '    $sauvegardes = @(Get-GPOBackup -Path $Dossier -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $NomGpo })',
      '  } catch { }',
      '}',
      'if ($sauvegardes.Count -eq 0) {',
      "  # Get-GPOBackup n'existe pas sur toutes les versions : on retombe sur la",
      "  # lecture des manifestes, qui est le format documente du dossier.",
      "  $manifeste = Join-Path $Dossier 'manifest.xml'",
      '  if ($dossierOk -and (Test-Path -LiteralPath $manifeste)) {',
      '    try {',
      '      $xml = [xml](Get-Content -LiteralPath $manifeste -Raw -ErrorAction Stop)',
      '      $sauvegardes = @($xml.Backups.BackupInst | Where-Object { $_.GPODisplayName.InnerText -eq $NomGpo })',
      '    } catch { }',
      '  }',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Sauvegardes' -Controle 'Disponibles pour cette GPO' -Etat 'INFO' -Valeur $sauvegardes.Count)",
      'foreach ($s in $sauvegardes) {',
      '  $idLu = $s.Id',
      '  if (-not $idLu -and $s.ID) { $idLu = $s.ID.InnerText }',
      '  $dateLue = $s.CreationTime',
      '  if (-not $dateLue -and $s.BackupTime) { $dateLue = $s.BackupTime.InnerText }',
      "  [void](Add-KjemoResultat -Categorie 'Sauvegardes' -Controle 'Copie' -Etat 'INFO' -Valeur (\"$idLu — $dateLue\"))",
      '}',
      "",
      '# --- 3. Action : Sauvegarder ----------------------------------------------------------',
      '$sauvegardeOk = $false',
      '$idFraiche = $null',
      "if ($Action -eq 'Sauvegarder' -or $Action -eq 'Restaurer') {",
      "  # Regle du projet : avant toute operation risquee, une sauvegarde FRAICHE,",
      "  # reussie et relue. Pas une sauvegarde d'hier, pas une sauvegarde supposee.",
      "  if ($Mode -eq 'Appliquer' -and $gpo -and $dossierOk -and $cibleAutorisee) {",
      '    try {',
      '      $copie = Backup-GPO -Guid $gpo.Id -Path $Dossier -Domain $Domaine -Comment ("KJEMO " + (Get-Date -Format \'yyyy-MM-dd HH:mm\')) -ErrorAction Stop',
      '      $idFraiche = $copie.Id',
      '      $cheminCopie = Join-Path $Dossier ("{" + $idFraiche + "}")',
      '      if (Test-Path -LiteralPath $cheminCopie) {',
      '        $sauvegardeOk = $true',
      "        [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Copie ecrite et relue' -Etat 'OK' -Valeur $idFraiche)",
      '      } else {',
      "        [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Copie ecrite et relue' -Etat 'PROBLEME' -Valeur $idFraiche -Commentaire \"La commande n'a pas signale d'erreur, mais le dossier de la copie est introuvable.\")",
      '      }',
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Copie' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Sans sauvegarde reussie, rien de risque ne sera tente.')",
      '    }',
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Copie' -Etat 'IGNORE' -Valeur 'mode Diagnostic' -Commentaire 'En mode Appliquer, une copie fraiche serait ecrite puis relue.')",
      '  }',
      '}',
      "",
      '# --- 4. Action : Comparer -------------------------------------------------------------',
      "if ($Action -eq 'Comparer') {",
      "  # La comparaison lit deux rapports XML : l'etat actuel, et celui de la",
      "  # sauvegarde choisie. Elle ne modifie rien, dans aucun mode.",
      '  $rapportActuel = $null',
      '  if ($gpo) {',
      '    try { $rapportActuel = Get-GPOReport -Guid $gpo.Id -ReportType Xml -Domain $Domaine -ErrorAction Stop } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Rapport actuel' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '    }',
      '  }',
      '  $idCible = $IdSauvegarde',
      "  if ($idCible -eq '' -and $sauvegardes.Count -gt 0) {",
      '    $derniere = $sauvegardes[$sauvegardes.Count - 1]',
      '    $idCible = $derniere.Id',
      '    if (-not $idCible -and $derniere.ID) { $idCible = $derniere.ID.InnerText }',
      '  }',
      "  if ($idCible -eq '' -or -not $idCible) {",
      "    [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Sauvegarde de reference' -Etat 'PROBLEME' -Valeur 'aucune' -Commentaire 'Aucune sauvegarde de cette GPO dans le dossier : il n''y a rien a comparer.')",
      '  } else {',
      "    $idNormalise = $idCible.ToString().Trim('{', '}')",
      '    $dossierCopie = Join-Path $Dossier ("{" + $idNormalise + "}")',
      "    $fichierRapport = Join-Path $dossierCopie 'gpreport.xml'",
      '    if (-not (Test-Path -LiteralPath $fichierRapport)) {',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Rapport de la sauvegarde' -Etat 'PROBLEME' -Valeur $fichierRapport -Commentaire 'Le rapport de la sauvegarde est introuvable : la copie est incomplete.')",
      '    } elseif ($rapportActuel) {',
      '      $rapportCopie = Get-Content -LiteralPath $fichierRapport -Raw',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Sauvegarde de reference' -Etat 'INFO' -Valeur $idNormalise)",
      "",
      "      # On compare les valeurs de registre declarees de part et d'autre :",
      "      # c'est ce qui change le plus souvent, et c'est lisible sans outil tiers.",
      '      function Get-KjemoValeursXml {',
      '        param([string]$Contenu)',
      '        $liste = New-Object System.Collections.ArrayList',
      '        try {',
      '          $doc = [xml]$Contenu',
      "          foreach ($n in $doc.GetElementsByTagName('q1:RegistrySetting')) {",
      "            [void]$liste.Add(($n.KeyPath + '\\' + $n.Value.Name))",
      '          }',
      "          foreach ($n in $doc.GetElementsByTagName('q2:Policy')) {",
      "            [void]$liste.Add('Policy: ' + $n.Name)",
      '          }',
      '        } catch { }',
      '        return $liste',
      '      }',
      '      $avant = Get-KjemoValeursXml -Contenu $rapportCopie',
      '      $apres = Get-KjemoValeursXml -Contenu $rapportActuel',
      '      $ajoutes = @($apres | Where-Object { $avant -notcontains $_ })',
      '      $retires = @($avant | Where-Object { $apres -notcontains $_ })',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Reglages presents aujourd''hui, absents de la sauvegarde' -Etat (& { if ($ajoutes.Count -gt 0) { 'ATTENTION' } else { 'OK' } }) -Valeur $ajoutes.Count)",
      '      foreach ($a in $ajoutes) { [void](Add-KjemoResultat -Categorie \'Ajoute depuis la sauvegarde\' -Controle $a -Etat \'INFO\' -Valeur \'present aujourd\'\'hui\') }',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Reglages de la sauvegarde, absents aujourd''hui' -Etat (& { if ($retires.Count -gt 0) { 'ATTENTION' } else { 'OK' } }) -Valeur $retires.Count)",
      '      foreach ($r in $retires) { [void](Add-KjemoResultat -Categorie \'Retire depuis la sauvegarde\' -Controle $r -Etat \'INFO\' -Valeur \'absent aujourd\'\'hui\') }',
      "      if ($ajoutes.Count -eq 0 -and $retires.Count -eq 0) {",
      "        [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Verdict' -Etat 'OK' -Valeur 'aucun ecart detecte sur les valeurs lues')",
      '      }',
      '    }',
      '  }',
      '}',
      "",
      '# --- 5. Action : Restaurer ------------------------------------------------------------',
      "if ($Action -eq 'Restaurer') {",
      "  # Trois verrous, et ils doivent tous ceder avant que Restore-GPO parte :",
      "  #   1. le mode est Appliquer ;",
      "  #   2. la cible n'est pas une strategie par defaut du domaine ;",
      "  #   3. une sauvegarde FRAICHE de l'etat actuel a reussi et a ete relue.",
      "  # Le troisieme verrou est le plus important : si la restauration se revele",
      "  # etre une erreur, c'est cette copie-la qui permettra de revenir.",
      '  $idCible = $IdSauvegarde',
      "  if ($idCible -eq '' -and $sauvegardes.Count -gt 0) {",
      '    $derniere = $sauvegardes[$sauvegardes.Count - 1]',
      '    $idCible = $derniere.Id',
      '    if (-not $idCible -and $derniere.ID) { $idCible = $derniere.ID.InnerText }',
      '  }',
      "  if ($Mode -ne 'Appliquer') {",
      "    Write-Host ''",
      "    Write-Host '--- Simulation ---'",
      "    Write-Host \"En mode Appliquer, le script sauvegarderait d'abord l'etat actuel,\"",
      "    Write-Host \"relirait la copie, et ne restaurerait qu'ensuite. Si la sauvegarde\"",
      "    Write-Host \"echouait, la restauration ne partirait pas.\"",
      "    [void](Add-KjemoResultat -Categorie 'Restauration' -Controle 'Execution' -Etat 'IGNORE' -Valeur 'mode Diagnostic')",
      '  } elseif (-not $sauvegardeOk) {',
      "    [void](Add-KjemoResultat -Categorie 'Restauration' -Controle 'Execution' -Etat 'PROBLEME' -Valeur 'bloquee' -Commentaire \"La sauvegarde de l'etat actuel n'a pas reussi. Aucune restauration n'est tentee : ce serait un changement sans retour possible.\")",
      "  } elseif (-not $idCible -or $idCible -eq '') {",
      "    [void](Add-KjemoResultat -Categorie 'Restauration' -Controle 'Execution' -Etat 'PROBLEME' -Valeur 'bloquee' -Commentaire 'Aucune sauvegarde de reference a restaurer.')",
      '  } elseif (-not $cibleAutorisee) {',
      "    [void](Add-KjemoResultat -Categorie 'Restauration' -Controle 'Execution' -Etat 'PROBLEME' -Valeur 'bloquee' -Commentaire 'Cible refusee par le garde-fou des strategies par defaut.')",
      '  } else {',
      "    $idNormalise = $idCible.ToString().Trim('{', '}')",
      "    Write-Host ''",
      "    Write-Host '--- Restauration ---'",
      '    Write-Host ("  Copie de secours de l\'etat actuel : " + $idFraiche)',
      '    Write-Host ("  Sauvegarde restauree             : " + $idNormalise)',
      '    try {',
      '      Restore-GPO -BackupId $idNormalise -Path $Dossier -Domain $Domaine -ErrorAction Stop | Out-Null',
      "      [void](Add-KjemoResultat -Categorie 'Restauration' -Controle 'Execution' -Etat 'OK' -Valeur $idNormalise -Commentaire (\"Retour arriere possible avec la copie $idFraiche.\"))",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Restauration' -Controle 'Execution' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire (\"L'etat actuel reste sauvegarde sous $idFraiche.\"))",
      '    }',
      '    $relu = $null',
      '    try { $relu = Get-GPO -Name $NomGpo -Domain $Domaine -ErrorAction SilentlyContinue } catch { }',
      '    if ($relu) {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Strategie relue apres restauration' -Etat 'OK' -Valeur (\"version AD $($relu.Computer.DSVersion)/$($relu.User.DSVersion)\"))",
      '    }',
      '  }',
      '}',
      "",
      '# --- 6. Ce que cet assistant ne fait jamais -------------------------------------------',
      blocAucuneSuppressionGpo(),
      "Write-Host ''",
      "Write-Host \"Une restauration remet le CONTENU de la strategie. Elle ne remet ni ses\"",
      "Write-Host \"liens, ni son filtrage de securite, ni ses filtres WMI : ces elements\"",
      "Write-Host \"vivent sur les unites d'organisation, pas dans la GPO. Les verifier apres.\"",
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Sauvegarde, comparaison et restauration de GPO',
      outil: 'gpo-backup-restore-compare',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NomGpo', psB64(nomGpo)],
        ['Dossier', psB64(dossier)],
        ['Action', psB64(action)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-gpo-sauvegarde',
      formats: 'Console',
    });
  },
  gui: [
    'Console de gestion des stratégies de groupe > Objets de stratégie de groupe > clic droit sur la GPO > Sauvegarder.',
    'Pour sauvegarder tout le domaine d’un coup : clic droit sur le conteneur Objets de stratégie de groupe > Sauvegarder tout.',
    'Restaurer : clic droit sur la GPO > Restaurer à partir d’une sauvegarde, puis choisir la date dans l’assistant.',
    'Comparer deux états : exporter un rapport HTML de chaque côté (clic droit > Enregistrer le rapport) et les relire côte à côte.',
    'Importer les paramètres d’une sauvegarde dans une AUTRE GPO : clic droit > Importer les paramètres. L’import ne touche pas les liens.',
  ],
  keywords: [
    'sauvegarde gpo', 'backup-gpo', 'restauration', 'restore-gpo', 'comparer',
    'gpo report', 'get-gporeport', 'retour arriere', 'copie de secours',
    'manifest.xml', 'gpreport.xml', 'import des parametres',
  ],
  requiresAdmin: true,
  os: OS_GPO,
  prereqs: PREREQS_GPO.concat([
    'Un dossier de sauvegarde accessible en écriture, et réservé aux administrateurs : une sauvegarde de GPO décrit toute la configuration du parc.',
    'Droit de lecture sur la stratégie pour sauvegarder ; droit de modification pour restaurer.',
    'Pour restaurer : le nom exact de la stratégie, retapé dans le formulaire.',
  ]),
  commonErrors: ERREURS_GPO.concat([
    {
      message: 'Backup-GPO échoue avec un accès refusé',
      cause: 'Le dossier n’est pas accessible en écriture au compte qui lance le script, ou le chemin passe par un partage caché mal déclaré.',
      fix: 'Tester l’écriture d’un fichier simple dans le dossier avec le même compte, avant de relancer.',
    },
    {
      message: 'La restauration réussit mais la stratégie ne s’applique plus',
      cause: 'La restauration remet le contenu, pas les liens ni le filtrage de sécurité. Si la GPO avait été déliée, elle le reste.',
      fix: 'Vérifier les liens avec l’audit des liens, et le filtrage de sécurité avec l’assistant dédié.',
    },
    {
      message: 'La sauvegarde est introuvable dans le dossier',
      cause: 'Le dossier contient des sauvegardes d’une autre GPO, ou le manifeste a été déplacé sans les sous-dossiers.',
      fix: 'Un dossier de sauvegarde est un tout : manifest.xml et les sous-dossiers {GUID} se déplacent ensemble.',
    },
    {
      message: 'Restore-GPO refuse : la GPO n’existe plus',
      cause: 'Restore-GPO remet le contenu d’une GPO existante. Si elle a été supprimée, c’est Import-GPO dans une GPO neuve qu’il faut.',
      fix: 'Créer une GPO vide du même nom, puis importer les paramètres de la sauvegarde, puis reposer les liens.',
    },
    {
      message: 'La comparaison ne montre aucun écart alors que quelque chose a changé',
      cause: 'La comparaison de ce script lit les valeurs de registre et les modèles d’administration. Les préférences et les paramètres de sécurité ne sont pas couverts.',
      fix: 'Exporter les deux rapports HTML complets et les relire : c’est la méthode exhaustive.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le dossier de la sauvegarde existe et contient gpreport.xml et bkupInfo.xml.',
    'Après restauration, la version AD de la stratégie a changé.',
    'Les liens, le filtrage de sécurité et les filtres WMI sont revérifiés : la restauration ne les remet pas.',
    'Une seconde sauvegarde, prise après restauration, se compare sans écart avec la sauvegarde restaurée.',
  ],
  rollback: {
    summary: 'Le retour arrière d’une restauration est une autre restauration : celle de la copie de secours que ce script écrit juste avant d’agir. Son identifiant est affiché dans le rapport — le noter.',
    diagnostic: '# Les sauvegardes disponibles pour cette strategie.\nGet-ChildItem \'<dossier-de-sauvegarde>\' -Directory | Select-Object Name,CreationTime\n\n# Ce que contient la strategie aujourd\'hui.\nGet-GPOReport -Name \'<nom-de-la-gpo>\' -ReportType Html | Out-File .\\gpo-actuelle.html -Encoding utf8',
    command: '# Revenir a la copie de secours ecrite avant la restauration.\nRestore-GPO -BackupId \'<guid-de-la-copie-de-secours>\' -Path \'<dossier-de-sauvegarde>\' -Confirm\n\n# Puis revérifier ce que la restauration ne remet pas :\nGet-GPInheritance -Target \'<dn-de-l-ou>\' | Select-Object -ExpandProperty GpoLinks',
    exceptional: 'AVERTISSEMENT CRITIQUE — restaurer une sauvegarde ancienne remplace la configuration actuelle par celle de la date de la copie. Tout réglage ajouté depuis disparaît, sur tout le périmètre de la stratégie, au prochain rafraîchissement. Comparer les deux états AVANT de restaurer, avec l’action Comparer de cet assistant : https://learn.microsoft.com/powershell/module/grouppolicy/restore-gpo',
    warning: 'Une restauration ne remet ni les liens, ni le filtrage de sécurité, ni les filtres WMI. Une stratégie restaurée peut sembler correcte et ne s’appliquer à personne.',
  },
  checks: [
    'Aucune restauration sans sauvegarde fraîche, réussie et relue.',
    'Aucune restauration sans le nom de la stratégie retapé.',
    'Les deux stratégies par défaut du domaine sont refusées.',
    'Aucune GPO n’est supprimée, dans aucun mode.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/grouppolicy/backup-gpo',
  sources: [
    { label: 'Backup-GPO', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/backup-gpo' },
    { label: 'Restore-GPO', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/restore-gpo' },
    { label: 'Get-GPOReport', url: 'https://learn.microsoft.com/powershell/module/grouppolicy/get-gporeport' },
  ],
};

// ---------------------------------------------------------------------------
// Catalogue exporté
// ---------------------------------------------------------------------------

export const toolsGpo = [
  outilInventaireGpo,
  outilSanteGpo,
  outilRsop,
  outilActualisationGpo,
  outilCreerLierGpo,
  outilAuditLiens,
  outilFiltrageSecuriteGpo,
  outilFiltreWmi,
  outilLecteurReseauGpo,
  outilImprimanteGpo,
  outilScriptsGpo,
  outilRedirectionDossiers,
  outilVerrouillageBureau,
  outilRestrictionsPeripheriques,
  outilPareFeuDefender,
  outilMisesAJourServices,
  outilLogicielsRaccourcisNavigateur,
  outilSauvegardeRestaurationGpo,
];
