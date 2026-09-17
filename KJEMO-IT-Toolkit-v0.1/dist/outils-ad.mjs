/**
 * outils-ad.mjs — LOT 3 · KJEMO IT Toolkit
 * ----------------------------------------
 * Catalogue Active Directory avancé : structure et OU, utilisateurs et groupes,
 * cycle de vie des comptes, maintenance des objets, santé du domaine.
 *
 * Dépendances : noyau.mjs, validateurs.mjs, rapport-ps.mjs et les éléments
 * communs d'outils-serveur.mjs. Aucun import circulaire : generators.mjs
 * importe ce module, jamais l'inverse.
 *
 * Quatre règles gouvernent ce catalogue :
 *
 *  1. DIAGNOSTIC PAR DÉFAUT. Toute opération modifiante commence en mode
 *     Diagnostic et n'écrit qu'après un choix explicite.
 *
 *  2. AUCUN SECRET DANS LE NAVIGATEUR. Aucun champ de mot de passe, aucun
 *     identifiant dans un script, une URL, un presse-papiers ou un rapport.
 *     Quand un mot de passe est nécessaire, le script le demande localement
 *     avec Read-Host -AsSecureString ou Get-Credential, au moment de son
 *     exécution.
 *
 *  3. AUCUNE SUPPRESSION AUTOMATIQUE. Un utilisateur, un groupe, une OU ou un
 *     ordinateur ne sont jamais supprimés par un script de ce lot. Désactiver,
 *     déplacer en quarantaine, exporter : oui. Supprimer : c'est une décision
 *     humaine, documentée en cas exceptionnel.
 *
 *  4. L'ANNUAIRE EST UNE BASE DE DONNÉES PARTAGÉE. Chaque écriture est précédée
 *     d'un constat, rendue idempotente, et suivie d'une relecture.
 */

import { psB64, assertValid } from './noyau.mjs';
import {
  validateIPv4,
  validateShareName,
  validateSamAccountName,
  validateGroupName,
  validateOuName,
  validerFqdn,
  validerNomHote,
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
  validerCheminWindowsLocal,
  validerFormatRapport,
  validerModeExecution,
  validerChoix,
  validerEntier,
  escapeLdapRdn,
  domainToDn,
  cheminOuVersDn,
  PORTEES_GROUPE,
  CATEGORIES_GROUPE,
} from './validateurs.mjs';
import { blocModeDiagnostic } from './rapport-ps.mjs';
import { champMode, champFormat, verifier, assembler, PREREQS_SERVEUR } from './outils-serveur.mjs';

// ---------------------------------------------------------------------------
// Éléments communs au catalogue Active Directory
// ---------------------------------------------------------------------------

/**
 * Systèmes visés. Le module ActiveDirectory est la dépendance réelle : il vient
 * du rôle AD DS sur un contrôleur, ou des outils d'administration à distance
 * sur un poste de gestion.
 */
export const OS_AD = [
  'Windows Server 2019 — module ActiveDirectory intégré au rôle AD DS',
  'Windows Server 2022 — module ActiveDirectory intégré au rôle AD DS',
  'Windows Server 2025 — cmdlets documentées identiques, non éprouvées en laboratoire par ce projet',
  'Windows 10 et 11 avec les outils d’administration RSAT-AD-PowerShell, pour l’administration à distance',
  'Windows PowerShell 5.1 — cible de référence',
  'PowerShell 7 — le module ActiveDirectory s’y importe avec -UseWindowsPowerShell',
];

/** Prérequis communs à tout outil qui interroge ou modifie l'annuaire. */
export const PREREQS_AD = PREREQS_SERVEUR.concat([
  'Module ActiveDirectory disponible : rôle AD DS installé, ou outils d’administration RSAT-AD-PowerShell.',
  'Compte disposant des droits sur la partie de l’annuaire visée. Les droits nécessaires sont précisés par outil.',
  'Aucun mot de passe n’est saisi dans le site : quand il en faut un, le script le demande localement à l’exécution.',
]);

/** Erreurs fréquentes communes au module ActiveDirectory. */
export const ERREURS_AD = [
  {
    message: 'Le terme « Get-ADUser » n’est pas reconnu comme nom d’applet de commande',
    code: 'CommandNotFoundException',
    cause: 'Le module ActiveDirectory n’est pas présent sur la machine qui exécute le script.',
    fix: 'Installer les outils d’administration, puis rouvrir la console.',
    command: 'Get-WindowsFeature RSAT-AD-PowerShell | Format-Table Name,InstallState',
  },
  {
    message: 'Unable to contact the server. This may be because this server does not exist, it is currently down, or it does not have the Active Directory Web Services running.',
    code: 'ADServerDownException',
    cause: 'Le service Active Directory Web Services est arrêté sur le contrôleur, ou le contrôleur est injoignable.',
    fix: 'Vérifier le service ADWS sur le contrôleur, et la résolution DNS du domaine depuis cette machine.',
    command: 'Get-Service ADWS ; Resolve-DnsName -Name <domaine> -Type SRV',
  },
  {
    message: 'Access is denied',
    code: '0x5',
    cause: 'Le compte utilisé n’a pas les droits sur l’objet ou l’unité d’organisation visée.',
    fix: 'Utiliser un compte délégué sur cette OU, ou vérifier la délégation avec l’outil d’audit de délégation.',
  },
];

/** Champ « domaine » commun, avec l'exemple de laboratoire du projet. */
export function champDomaine(aide = 'Domaine Active Directory visé. Le nom distinctif en est déduit automatiquement.') {
  return { id: 'adDomain', label: 'Domaine Active Directory', default: 'hopitalbn.lan', help: aide };
}

/**
 * Préambule PowerShell commun : import du module ActiveDirectory, avec un
 * message clair s'il manque, et relevé du contexte de domaine.
 */
export function blocModuleAd() {
  return [
    '# --- Module ActiveDirectory ------------------------------------------------',
    "# Le module vient du role AD DS, ou des outils d'administration RSAT.",
    '$moduleOk = $false',
    'try {',
    '  Import-Module ActiveDirectory -ErrorAction Stop',
    '  $moduleOk = $true',
    "  [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Module ActiveDirectory' -Etat 'OK' -Valeur 'charge')",
    '} catch {',
    "  [void](Add-KjemoResultat -Categorie 'Prerequis' -Controle 'Module ActiveDirectory' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Installe RSAT-AD-PowerShell, ou execute depuis un controleur de domaine.')",
    '}',
    '',
    '$domaineObj = $null',
    'if ($moduleOk) {',
    '  try { $domaineObj = Get-ADDomain -ErrorAction Stop } catch { }',
    '}',
    'if ($domaineObj) {',
    '  [void](Add-KjemoResultat -Categorie \'Domaine\' -Controle \'Domaine courant\' -Etat \'INFO\' -Valeur ("$($domaineObj.DNSRoot) — $($domaineObj.DistinguishedName)"))',
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Domaine' -Controle 'Domaine courant' -Etat 'ATTENTION' -Valeur 'non determine' -Commentaire 'Machine hors domaine, ou controleur injoignable.')",
    '}',
  ].join('\n');
}

/**
 * Bloc de rappel : ce lot ne supprime jamais un objet d'annuaire.
 * Affiché en fin de script des outils modifiants, pour que la personne qui lit
 * le script sache où s'arrête ce qu'il fait.
 */
export function blocAucuneSuppression(objet = 'objet') {
  return [
    '',
    "Write-Host ''",
    `Write-Host '--- Portee de ce script ---'`,
    `Write-Host 'Aucun ${objet} n''est supprime par ce script. La suppression d''un objet'`,
    "Write-Host 'Active Directory est une decision humaine : elle se fait a la main, apres'",
    "Write-Host 'sauvegarde, et en connaissance des dependances.'",
  ].join('\n');
}

// ---------------------------------------------------------------------------
// A. STRUCTURE ET OU
// ---------------------------------------------------------------------------

/**
 * 1. ad-ou-hierarchy — créer une arborescence d'OU d'un seul tenant.
 *
 * Le piège n'est pas la commande mais l'ordre : New-ADOrganizationalUnit échoue
 * si le parent n'existe pas encore. Le formulaire trie donc les OU par
 * profondeur, et ajoute les niveaux intermédiaires oubliés — écrire
 * « Medecin/Specialiste » sans « Medecin » est une omission, pas un choix.
 */
export const outilOuHierarchie = {
  id: 'ad-ou-hierarchy',
  icon: '\u25eb',
  category: 'Active Directory',
  subcategory: 'Structure et OU',
  title: 'Créer une hiérarchie d\u2019unités d\u2019organisation',
  risk: 'caution',
  summary: 'Trie les OU parents avant les enfants, complète les niveaux manquants, ignore celles qui existent et n\u2019écrase jamais rien.',
  fields: [
    champDomaine(),
    {
      id: 'ouList', label: 'Liste des OU, une par ligne', type: 'textarea',
      default: 'Médecin\nMédecin/Généraliste\nMédecin/Spécialiste\nInfirmière\nInfirmière/Principale\nInfirmière/Auxiliaire\nPatient\nAdministration',
      help: 'Chemin parent/enfant séparé par des barres obliques. Les lignes commençant par # sont ignorées. Accents et apostrophes acceptés.',
    },
    {
      id: 'ouProtect', label: 'Protection contre la suppression accidentelle', type: 'select', default: 'Oui',
      options: [['Oui', 'Oui — recommandé'], ['Non', 'Non']],
      help: 'Coche la case « Protéger contre la suppression accidentelle » de chaque OU créée.',
    },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'adDomain', validerFqdn(v.adDomain));
    verifier(errors, 'ouList', validerListeOu(v.ouList));
    verifier(errors, 'ouProtect', validerChoix(v.ouProtect, ['Oui', 'Non'], 'La protection'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.adDomain).value;
    const ous = validerListeOu(v.ouList).value;
    const proteger = v.ouProtect === 'Oui';

    // Chaque OU est décrite par son nom, le DN de son parent et son DN complet.
    // Tout est calculé ici, en JavaScript, avec l'échappement RFC 4514 : le
    // script n'a plus qu'à exécuter, ce qui le rend lisible et vérifiable.
    const lignesTable = ous.map((ou) => {
      const dnParent = ou.parent ? cheminOuVersDn(ou.parent, domaine) : domainToDn(domaine);
      const dn = cheminOuVersDn(ou.segments, domaine);
      return '  [pscustomobject]@{ Chemin = ' + psB64(ou.chemin)
        + '; Nom = ' + psB64(ou.nom)
        + '; Parent = ' + psB64(dnParent)
        + '; Dn = ' + psB64(dn)
        + '; Implicite = $' + (ou.implicite ? 'true' : 'false') + ' }';
    });

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$Proteger = $${proteger ? 'true' : 'false'}`,
      "$KjemoFormat = 'Console'",
      "",
      '# Les OU sont deja triees : parents d\'abord, enfants ensuite. Les noms',
      '# passent par un encodage Base64 UTF-8, ce qui preserve exactement les',
      '# accents et les apostrophes, et les DN sont echappes selon RFC 4514.',
      '$OUs = @(',
      lignesTable.join(',\n'),
      ')',
      "",
      blocModuleAd(),
      "",
      '# --- Etat initial : quelles OU existent deja ? ----------------------------',
      '$aCreer = New-Object System.Collections.ArrayList',
      '$existantes = New-Object System.Collections.ArrayList',
      '$refusees = New-Object System.Collections.ArrayList',
      "",
      'foreach ($ou in $OUs) {',
      '  if (-not $moduleOk) { [void]$refusees.Add($ou); continue }',
      '  $deja = $null',
      '  try { $deja = Get-ADOrganizationalUnit -Identity $ou.Dn -ErrorAction SilentlyContinue } catch { }',
      '  if ($deja) {',
      '    [void]$existantes.Add($ou)',
      "    [void](Add-KjemoResultat -Categorie 'OU existantes' -Controle $ou.Chemin -Etat 'OK' -Valeur $ou.Dn -Commentaire 'Deja presente : ni recreee, ni modifiee.')",
      '    continue',
      '  }',
      '  # Le parent doit exister, ou etre cree plus tot dans cette meme execution.',
      '  $parentOk = $false',
      '  try {',
      '    $parentObj = Get-ADObject -Identity $ou.Parent -ErrorAction SilentlyContinue',
      '    if ($parentObj) { $parentOk = $true }',
      '  } catch { }',
      '  if (-not $parentOk) {',
      '    $creePlusTot = $aCreer | Where-Object { $_.Dn -eq $ou.Parent }',
      '    if ($creePlusTot) { $parentOk = $true }',
      '  }',
      '  if (-not $parentOk) {',
      '    [void]$refusees.Add($ou)',
      "    [void](Add-KjemoResultat -Categorie 'OU refusees' -Controle $ou.Chemin -Etat 'PROBLEME' -Valeur $ou.Parent -Commentaire \"Parent introuvable : l''OU ne peut pas etre creee a cet emplacement.\")",
      '    continue',
      '  }',
      '  [void]$aCreer.Add($ou)',
      "  $note = ''",
      "  if ($ou.Implicite) { $note = 'Niveau intermediaire ajoute automatiquement : il manquait dans la liste.' }",
      "  [void](Add-KjemoResultat -Categorie 'OU a creer' -Controle $ou.Chemin -Etat 'INFO' -Valeur $ou.Dn -Commentaire $note)",
      '}',
      "",
      '[void](Add-KjemoResultat -Categorie \'Resume\' -Controle \'Inventaire\' -Etat \'INFO\' -Valeur ("a creer : $($aCreer.Count) ; existantes : $($existantes.Count) ; refusees : $($refusees.Count)"))',
      "",
      '# --- Creation, uniquement en mode Appliquer -------------------------------',
      "if ($Mode -eq 'Appliquer' -and $moduleOk) {",
      '  foreach ($ou in $aCreer) {',
      '    try {',
      '      New-ADOrganizationalUnit -Name $ou.Nom -Path $ou.Parent -ProtectedFromAccidentalDeletion $Proteger -ErrorAction Stop',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle $ou.Chemin -Etat 'OK' -Valeur 'creee')",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle $ou.Chemin -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Creation refusee par l''annuaire.')",
      '    }',
      '  }',
      "",
      '  # Relecture : ce qui compte, c\'est l\'arborescence reelle apres coup.',
      "  Write-Host ''",
      "  Write-Host '--- Arborescence apres creation ---'",
      '  foreach ($ou in $OUs) {',
      '    $verif = $null',
      '    try { $verif = Get-ADOrganizationalUnit -Identity $ou.Dn -Properties ProtectedFromAccidentalDeletion -ErrorAction SilentlyContinue } catch { }',
      '    if ($verif) {',
      '      [void](Add-KjemoResultat -Categorie \'Verification\' -Controle $ou.Chemin -Etat \'OK\' -Valeur ("presente ; protegee : $($verif.ProtectedFromAccidentalDeletion)"))',
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle $ou.Chemin -Etat 'PROBLEME' -Valeur 'absente apres execution')",
      '    }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  foreach ($ou in $aCreer) {',
      '    New-ADOrganizationalUnit -Name $ou.Nom -Path $ou.Parent -ProtectedFromAccidentalDeletion $Proteger -WhatIf',
      '  }',
      '}',
      blocModeDiagnostic(),
      blocAucuneSuppression('OU'),
    ];

    return assembler({
      titre: 'Creer une hierarchie d\'unites d\'organisation',
      outil: 'ad-ou-hierarchy',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['NombreOU', String(ous.length)],
        ['Protection', psB64(v.ouProtect)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-ad-ou',
      formats: 'Console',
    });
  },
  gui: [
    'Utilisateurs et ordinateurs Active Directory (dsa.msc).',
    'Clic droit sur le domaine ou sur une OU parente > Nouveau > Unité d\u2019organisation.',
    'Saisir le nom, laisser cochée « Protéger le conteneur contre une suppression accidentelle ».',
    'Répéter parent par parent : la console impose le même ordre que le script.',
    'Affichage > Fonctionnalités avancées pour voir les objets système et les onglets Sécurité.',
  ],
  keywords: [
    'ou', 'unite d organisation', 'arborescence', 'hierarchie', 'structure ad',
    'new-adorganizationalunit', 'creer des ou', 'dsa.msc', 'organisation du domaine',
  ],
  requiresAdmin: true,
  os: OS_AD,
  prereqs: PREREQS_AD.concat([
    'Droit de créer des unités d\u2019organisation dans le domaine ou dans l\u2019OU parente.',
    'Plan de nommage arrêté : renommer une OU après coup casse les chemins écrits ailleurs.',
  ]),
  commonErrors: ERREURS_AD.concat([
    {
      message: 'New-ADOrganizationalUnit : The object already exists',
      code: 'ADException',
      cause: 'Une OU du même nom existe déjà au même emplacement.',
      fix: 'Le script la détecte avant d\u2019agir et la laisse intacte : rien n\u2019est écrasé.',
    },
    {
      message: 'New-ADOrganizationalUnit : Directory object not found',
      cause: 'L\u2019OU parente n\u2019existe pas encore : c\u2019est ce qui arrive quand on crée les enfants avant les parents.',
      fix: 'Le tri par profondeur du formulaire élimine ce cas. Si l\u2019erreur apparaît, le parent a été supprimé entre-temps.',
    },
    {
      message: 'L\u2019OU ne peut pas être supprimée ensuite',
      cause: 'La protection contre la suppression accidentelle est active — c\u2019est voulu.',
      fix: 'Décocher la protection dans dsa.msc (Fonctionnalités avancées > onglet Objet) avant toute suppression réfléchie.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Get-ADOrganizationalUnit -Filter * affiche les OU créées avec leur DN.',
    'Dans dsa.msc, l\u2019arborescence correspond au plan saisi.',
    'La propriété ProtectedFromAccidentalDeletion vaut True si la protection a été demandée.',
  ],
  rollback: {
    summary: 'Une OU créée par erreur et encore vide se supprime, à la main, après avoir retiré sa protection. Une OU qui contient des objets ne se supprime pas : on déplace d\u2019abord son contenu.',
    diagnostic: '# Constater ce qui existe, et ce que chaque OU contient.\nGet-ADOrganizationalUnit -Filter * -Properties ProtectedFromAccidentalDeletion | Format-Table Name,DistinguishedName,ProtectedFromAccidentalDeletion\nGet-ADObject -SearchBase \'<dn-de-l-ou>\' -Filter * -SearchScope OneLevel | Format-Table Name,ObjectClass',
    command: '# Retirer la protection, puis supprimer une OU VIDE creee par erreur.\n# Les deux etapes sont volontairement separees : la premiere est anodine,\n# la seconde ne l\'est pas. -Confirm est explicite.\nSet-ADOrganizationalUnit -Identity \'<dn-de-l-ou>\' -ProtectedFromAccidentalDeletion $false\nRemove-ADOrganizationalUnit -Identity \'<dn-de-l-ou>\' -Confirm',
    exceptional: '# AVERTISSEMENT CRITIQUE — suppression d\'une OU qui contient des objets.\n#\n# Supprimer une OU peuplee supprime tout ce qu\'elle contient : comptes,\n# groupes, ordinateurs, et les OU filles. Les objets supprimes ne reviennent\n# que par la corbeille Active Directory, si elle est activee, ou par une\n# restauration d\'annuaire. Cette operation n\'est PAS automatisee ici.\n#\n# Avant d\'y penser :\n#   1. Exporter le contenu de l\'OU (Get-ADObject -SearchBase ... | Export-Csv).\n#   2. Deplacer ce qui doit etre conserve vers une autre OU.\n#   3. Verifier qu\'aucune GPO n\'est liee a cette OU.\n#   4. Verifier que la corbeille Active Directory est activee.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/activedirectory/remove-adorganizationalunit\n#\n# Commande, a executer manuellement et en connaissance de cause :\n#   Remove-ADOrganizationalUnit -Identity \'<dn>\' -Recursive -Confirm',
    warning: 'La protection contre la suppression accidentelle est activée par défaut, et c\u2019est une bonne chose : elle a déjà évité bien des restaurations d\u2019annuaire.',
  },
  checks: [
    'Vérifier le plan d\u2019OU avant de l\u2019appliquer : la structure conditionne les délégations et les GPO à venir.',
    'Le mode Diagnostic dit exactement ce qui sera créé, ce qui existe déjà et ce qui est refusé.',
    'Les niveaux intermédiaires ajoutés automatiquement sont signalés comme tels dans le rapport.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adorganizationalunit',
  sources: [
    { label: 'New-ADOrganizationalUnit', url: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adorganizationalunit' },
    { label: 'Get-ADOrganizationalUnit', url: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adorganizationalunit' },
    { label: 'Set-ADOrganizationalUnit', url: 'https://learn.microsoft.com/powershell/module/activedirectory/set-adorganizationalunit' },
    { label: 'Remove-ADOrganizationalUnit', url: 'https://learn.microsoft.com/powershell/module/activedirectory/remove-adorganizationalunit' },
  ],
};

// ---------------------------------------------------------------------------
// B. UTILISATEURS ET GROUPES
// ---------------------------------------------------------------------------

/**
 * 2. ad-users-csv — importer des comptes depuis un fichier CSV.
 *
 * Le navigateur ne lit pas le disque : le formulaire décrit le fichier, et le
 * script le lit au moment de son exécution. Aucun mot de passe ne transite par
 * le site — le script demande une politique au lancement, et crée les comptes
 * désactivés si aucun mot de passe n'est fourni.
 */
export const outilUtilisateursCsv = {
  id: 'ad-users-csv',
  icon: '\u25a4',
  category: 'Active Directory',
  subcategory: 'Utilisateurs et groupes',
  title: 'Importer des utilisateurs depuis un CSV',
  risk: 'caution',
  summary: 'Vérifie le schéma, prévisualise les lignes, détecte les doublons de SamAccountName, UPN et courriel, puis crée les comptes sans jamais manipuler de mot de passe côté site.',
  fields: [
    champDomaine(),
    { id: 'csvPath', label: 'Chemin local du fichier CSV', default: 'C:\\Imports\\utilisateurs.csv', help: 'Chemin sur la machine qui exécutera le script. Le site ne lit pas le fichier.' },
    {
      id: 'csvColumns', label: 'Colonnes attendues', default: 'Prenom,Nom,SamAccountName,Upn,Courriel,CheminOu',
      help: 'Séparées par des virgules. SamAccountName et CheminOu sont obligatoires.',
    },
    { id: 'csvDelimiter', label: 'Séparateur', type: 'select', default: ';', options: [[';', 'Point-virgule (Excel français)'], [',', 'Virgule'], ['\t', 'Tabulation']] },
    { id: 'csvPreview', label: 'Lignes à prévisualiser', default: '5' },
    {
      id: 'csvPassword', label: 'Politique de mot de passe', type: 'select', default: 'Comptes désactivés',
      options: [
        ['Comptes désactivés', 'Créer les comptes désactivés, sans mot de passe'],
        ['Mot de passe temporaire', 'Demander un mot de passe temporaire à l\u2019exécution'],
      ],
      help: 'Dans les deux cas, aucun mot de passe n\u2019est saisi ici : le script le demande localement.',
    },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'adDomain', validerFqdn(v.adDomain));
    verifier(errors, 'csvPath', validerCheminWindowsLocal(v.csvPath));
    if (!/\.csv$/i.test(String(v.csvPath ?? '').trim()) && !errors.csvPath) {
      errors.csvPath = 'Le fichier doit porter l\u2019extension .csv.';
    }
    verifier(errors, 'csvColumns', validerColonnesCsv(v.csvColumns, { obligatoires: ['SamAccountName', 'CheminOu'] }));
    verifier(errors, 'csvDelimiter', validerChoix(v.csvDelimiter, [';', ',', '\t'], 'Le séparateur'));
    verifier(errors, 'csvPreview', validerEntier(v.csvPreview, 1, 50, 'Le nombre de lignes à prévisualiser'));
    verifier(errors, 'csvPassword', validerChoix(v.csvPassword, ['Comptes désactivés', 'Mot de passe temporaire'], 'La politique de mot de passe'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.adDomain).value;
    const colonnes = validerColonnesCsv(v.csvColumns, { obligatoires: ['SamAccountName', 'CheminOu'] }).value;
    const motDePasseDemande = v.csvPassword === 'Mot de passe temporaire';

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$DnDomaine = ${psB64(domainToDn(domaine))}`,
      `$Fichier = ${psB64(validerCheminWindowsLocal(v.csvPath).value)}`,
      `$Separateur = ${psB64(v.csvDelimiter)}`,
      `$Apercu = [int](${psB64(v.csvPreview)})`,
      `$ColonnesAttendues = @(${colonnes.map((c) => psB64(c)).join(', ')})`,
      `$PolitiqueMotDePasse = ${psB64(v.csvPassword)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleAd(),
      "",
      '# --- 1. Le fichier existe-t-il, et a-t-il les bonnes colonnes ? -----------',
      'if (-not (Test-Path -LiteralPath $Fichier)) {',
      "  [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Existence' -Etat 'PROBLEME' -Valeur $Fichier -Commentaire 'Fichier introuvable sur cette machine.')",
      '  return',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Existence' -Etat 'OK' -Valeur $Fichier)",
      "",
      '$lignes = @()',
      'try {',
      '  $lignes = @(Import-Csv -LiteralPath $Fichier -Delimiter $Separateur -Encoding UTF8)',
      '} catch {',
      "  [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Lecture' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Verifie le separateur et l''encodage du fichier.')",
      '  return',
      '}',
      'if (@($lignes).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Contenu' -Etat 'PROBLEME' -Valeur '0 ligne' -Commentaire 'Fichier vide, ou separateur incorrect : une seule colonne serait alors lue.')",
      '  return',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Fichier\' -Controle \'Lignes lues\' -Etat \'OK\' -Valeur ("$(@($lignes).Count) ligne(s)"))',
      "",
      '$colonnesReelles = @($lignes[0].PSObject.Properties.Name)',
      '[void](Add-KjemoResultat -Categorie \'Schema\' -Controle \'Colonnes du fichier\' -Etat \'INFO\' -Valeur ($colonnesReelles -join \', \'))',
      '$manquantes = @($ColonnesAttendues | Where-Object { $colonnesReelles -notcontains $_ })',
      'if (@($manquantes).Count -gt 0) {',
      '  [void](Add-KjemoResultat -Categorie \'Schema\' -Controle \'Colonnes manquantes\' -Etat \'PROBLEME\' -Valeur ($manquantes -join \', \') -Commentaire "Le script ne peut pas creer de compte sans ces colonnes.")',
      '  return',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Schema' -Controle 'Colonnes attendues' -Etat 'OK' -Valeur ($ColonnesAttendues -join ', '))",
      "",
      '# --- 2. Apercu des premieres lignes ---------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Apercu du fichier ---'",
      '$lignes | Select-Object -First $Apercu | Format-Table -AutoSize',
      "",
      '# --- 3. Controles ligne par ligne -----------------------------------------',
      '$vusSam = @{}',
      '$vusUpn = @{}',
      '$vusMail = @{}',
      '$aCreer = New-Object System.Collections.ArrayList',
      '$ignores = New-Object System.Collections.ArrayList',
      '$erreurs = New-Object System.Collections.ArrayList',
      '$numero = 0',
      "",
      'foreach ($ligne in $lignes) {',
      '  $numero++',
      '  $sam = ("" + $ligne.SamAccountName).Trim()',
      '  $cheminOu = ("" + $ligne.CheminOu).Trim()',
      "  $upn = ''",
      '  if ($colonnesReelles -contains \'Upn\') { $upn = ("" + $ligne.Upn).Trim() }',
      "  $mail = ''",
      '  if ($colonnesReelles -contains \'Courriel\') { $mail = ("" + $ligne.Courriel).Trim() }',
      "",
      '  # 3a. Champs obligatoires',
      "  if ($sam -eq '' -or $cheminOu -eq '') {",
      '    [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = \'SamAccountName ou CheminOu vide\' })',
      '    [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $sam -Commentaire \'SamAccountName ou CheminOu vide.\')',
      '    continue',
      '  }',
      '  # 3b. Longueur et caracteres interdits du SamAccountName',
      '  if ($sam.Length -gt 20) {',
      '    [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = \'SamAccountName de plus de 20 caracteres\' })',
      '    [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $sam -Commentaire \'SamAccountName limite a 20 caracteres.\')',
      '    continue',
      '  }',
      '  # 3c. Doublons DANS le fichier',
      '  if ($vusSam.ContainsKey($sam.ToLower())) {',
      '    [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = "SamAccountName en double avec la ligne $($vusSam[$sam.ToLower()])" })',
      '    [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $sam -Commentaire "Doublon dans le fichier, deja vu ligne $($vusSam[$sam.ToLower()]).")',
      '    continue',
      '  }',
      '  $vusSam[$sam.ToLower()] = $numero',
      "  if ($upn -ne '') {",
      '    if ($vusUpn.ContainsKey($upn.ToLower())) {',
      '      [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $upn -Commentaire "UPN en double dans le fichier, deja vu ligne $($vusUpn[$upn.ToLower()]).")',
      '      [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = \'UPN en double dans le fichier\' })',
      '      continue',
      '    }',
      '    $vusUpn[$upn.ToLower()] = $numero',
      '  }',
      "  if ($mail -ne '') {",
      '    if ($vusMail.ContainsKey($mail.ToLower())) {',
      '      [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $mail -Commentaire "Courriel en double dans le fichier, deja vu ligne $($vusMail[$mail.ToLower()]).")',
      '      [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = \'Courriel en double dans le fichier\' })',
      '      continue',
      '    }',
      '    $vusMail[$mail.ToLower()] = $numero',
      '  }',
      "",
      '  if (-not $moduleOk) { continue }',
      "",
      '  # 3d. Doublons DANS l\'annuaire',
      '  $existant = $null',
      '  try { $existant = Get-ADUser -Filter "SamAccountName -eq \'$sam\'" -ErrorAction SilentlyContinue } catch { }',
      '  if ($existant) {',
      '    [void]$ignores.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = \'Compte deja present dans l\'\'annuaire\' })',
      '    [void](Add-KjemoResultat -Categorie \'Ignores\' -Controle "Ligne $numero" -Etat \'OK\' -Valeur $sam -Commentaire "Compte deja present : ni recree, ni modifie.")',
      '    continue',
      '  }',
      "  if ($upn -ne '') {",
      '    $existantUpn = $null',
      '    try { $existantUpn = Get-ADUser -Filter "UserPrincipalName -eq \'$upn\'" -ErrorAction SilentlyContinue } catch { }',
      '    if ($existantUpn) {',
      '      [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = \'UPN deja utilise dans l\'\'annuaire\' })',
      '      [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $upn -Commentaire "UPN deja porte par un autre compte : il doit etre unique dans la foret.")',
      '      continue',
      '    }',
      '  }',
      "",
      '  # 3e. L\'OU cible existe-t-elle ?',
      '  $segments = @($cheminOu.Split(\'/\') | Where-Object { $_ -ne \'\' })',
      '  [array]::Reverse($segments)',
      '  $dnOu = (($segments | ForEach-Object { "OU=" + ($_ -replace \'([,+"\\\\<>;=])\', \'\\$1\') }) -join \',\') + \',\' + $DnDomaine',
      '  $ouObj = $null',
      '  try { $ouObj = Get-ADOrganizationalUnit -Identity $dnOu -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $ouObj) {',
      '    [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Sam = $sam; Raison = "OU introuvable : $dnOu" })',
      "    [void](Add-KjemoResultat -Categorie 'Erreurs' -Controle \"Ligne $numero\" -Etat 'PROBLEME' -Valeur $dnOu -Commentaire \"OU introuvable : cree la hierarchie d''OU avant l''import.\")",
      '    continue',
      '  }',
      "",
      '  [void]$aCreer.Add([pscustomobject]@{',
      '    Ligne = $numero; Sam = $sam; Upn = $upn; Courriel = $mail; Dn = $dnOu',
      '    Prenom = ("" + $ligne.Prenom).Trim(); Nom = ("" + $ligne.Nom).Trim()',
      '  })',
      '  [void](Add-KjemoResultat -Categorie \'A creer\' -Controle "Ligne $numero" -Etat \'INFO\' -Valeur $sam -Commentaire $dnOu)',
      '}',
      "",
      '[void](Add-KjemoResultat -Categorie \'Resume\' -Controle \'Bilan des controles\' -Etat \'INFO\' -Valeur ("a creer : $($aCreer.Count) ; ignores : $($ignores.Count) ; erreurs : $($erreurs.Count)"))',
      "",
      '# --- 4. Creation, uniquement en mode Appliquer ----------------------------',
      "if ($Mode -eq 'Appliquer' -and $moduleOk -and $aCreer.Count -gt 0) {",
      "",
      '  # Le mot de passe n\'est jamais ecrit dans ce script : il est demande ici,',
      '  # localement, et reste un SecureString en memoire.',
      '  $motDePasse = $null',
      (motDePasseDemande
        ? "  Write-Host ''\n"
          + "  Write-Host 'Saisis le mot de passe temporaire commun aux comptes crees.'\n"
          + "  Write-Host 'Il n''est ni affiche, ni journalise, ni ecrit dans le rapport.'\n"
          + '  $motDePasse = Read-Host -Prompt \'Mot de passe temporaire\' -AsSecureString'
        : "  Write-Host ''\n"
          + "  Write-Host 'Politique retenue : les comptes sont crees DESACTIVES, sans mot de passe.'\n"
          + "  Write-Host 'Chaque compte devra recevoir un mot de passe puis etre active.'"),
      "",
      '  foreach ($compte in $aCreer) {',
      '    $parametres = @{',
      '      Name              = $compte.Sam',
      '      SamAccountName    = $compte.Sam',
      '      Path              = $compte.Dn',
      '      Enabled           = $false',
      '    }',
      "    if ($compte.Prenom -ne '') { $parametres['GivenName'] = $compte.Prenom }",
      "    if ($compte.Nom -ne '') { $parametres['Surname'] = $compte.Nom }",
      "    if ($compte.Upn -ne '') { $parametres['UserPrincipalName'] = $compte.Upn }",
      "    if ($compte.Courriel -ne '') { $parametres['EmailAddress'] = $compte.Courriel }",
      '    if ($null -ne $motDePasse) {',
      "      $parametres['AccountPassword'] = $motDePasse",
      "      $parametres['ChangePasswordAtLogon'] = $true",
      "      $parametres['Enabled'] = $true",
      '    }',
      '    try {',
      '      New-ADUser @parametres -ErrorAction Stop',
      "      $etatCompte = 'cree, desactive'",
      "      if ($null -ne $motDePasse) { $etatCompte = 'cree, actif, mot de passe a changer a la premiere ouverture' }",
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle $compte.Sam -Etat \'OK\' -Valeur $etatCompte)',
      '    } catch {',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle $compte.Sam -Etat \'PROBLEME\' -Valeur $_.Exception.Message)',
      '      [void]$erreurs.Add([pscustomobject]@{ Ligne = $compte.Ligne; Sam = $compte.Sam; Raison = $_.Exception.Message })',
      '    }',
      '  }',
      "",
      '  # Relecture : les comptes existent-ils vraiment, et ou ?',
      "  Write-Host ''",
      "  Write-Host '--- Comptes apres import ---'",
      '  foreach ($compte in $aCreer) {',
      '    $verif = $null',
      '    try { $verif = Get-ADUser -Identity $compte.Sam -Properties Enabled,DistinguishedName -ErrorAction SilentlyContinue } catch { }',
      '    if ($verif) {',
      '      [void](Add-KjemoResultat -Categorie \'Verification\' -Controle $compte.Sam -Etat \'OK\' -Valeur ("actif : $($verif.Enabled) ; $($verif.DistinguishedName)"))',
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle $compte.Sam -Etat 'PROBLEME' -Valeur 'compte absent apres import')",
      '    }',
      '  }',
      '} elseif ($Mode -ne \'Appliquer\') {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      '  Write-Host "$($aCreer.Count) compte(s) seraient crees. Aucune ecriture n\'a eu lieu."',
      '}',
      "",
      '# --- 5. Journal par utilisateur --------------------------------------------',
      "$dossierJournal = Join-Path $env:USERPROFILE 'Desktop'",
      '$journal = Join-Path $dossierJournal ("kjemo-ad-import-" + (Get-Date -Format \'yyyyMMdd-HHmmss\') + ".csv")',
      '$toutes = @()',
      "$toutes += @($aCreer | ForEach-Object { [pscustomobject]@{ Ligne = $_.Ligne; Compte = $_.Sam; Statut = 'A creer ou cree'; Detail = $_.Dn } })",
      "$toutes += @($ignores | ForEach-Object { [pscustomobject]@{ Ligne = $_.Ligne; Compte = $_.Sam; Statut = 'Ignore'; Detail = $_.Raison } })",
      "$toutes += @($erreurs | ForEach-Object { [pscustomobject]@{ Ligne = $_.Ligne; Compte = $_.Sam; Statut = 'Erreur'; Detail = $_.Raison } })",
      'if (@($toutes).Count -gt 0) {',
      '  $toutes | Export-Csv -LiteralPath $journal -NoTypeInformation -Encoding UTF8',
      '  Write-Host "Journal par utilisateur : $journal"',
      '}',
      blocModeDiagnostic(),
      blocAucuneSuppression('compte'),
    ];

    return assembler({
      titre: 'Importer des utilisateurs Active Directory depuis un CSV',
      outil: 'ad-users-csv',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Fichier', psB64(v.csvPath)],
        ['Politique', psB64(v.csvPassword)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-ad-import',
      formats: 'Console',
    });
  },
  gui: [
    'Préparer le CSV dans Excel, puis l\u2019enregistrer en « CSV UTF-8 (délimité par des points-virgules) ».',
    'Vérifier les en-têtes : ils doivent correspondre exactement aux colonnes attendues.',
    'Pour quelques comptes seulement : dsa.msc > clic droit sur l\u2019OU > Nouveau > Utilisateur.',
    'Après import : dsa.msc > l\u2019OU concernée, vérifier que les comptes sont là et dans le bon état.',
  ],
  keywords: [
    'import csv', 'creer des utilisateurs', 'new-aduser', 'import-csv', 'comptes en masse',
    'doublon samaccountname', 'upn', 'import utilisateurs ad', 'rentree', 'liste d eleves',
  ],
  requiresAdmin: true,
  os: OS_AD,
  prereqs: PREREQS_AD.concat([
    'Droit de créer des comptes dans les OU visées.',
    'Fichier CSV présent sur la machine qui exécute le script, encodé en UTF-8.',
    'Les OU cibles doivent exister : créer d\u2019abord la hiérarchie avec l\u2019outil dédié.',
    'Aucun mot de passe dans le CSV : le script en demande un à l\u2019exécution, ou crée les comptes désactivés.',
  ]),
  commonErrors: ERREURS_AD.concat([
    {
      message: 'Le fichier est lu comme une seule colonne',
      cause: 'Le séparateur choisi ne correspond pas à celui du fichier : Excel en français enregistre avec des points-virgules.',
      fix: 'Changer le séparateur dans le formulaire, ou réenregistrer le fichier avec le bon délimiteur.',
    },
    {
      message: 'New-ADUser : The specified account already exists',
      cause: 'Un compte porte déjà ce SamAccountName.',
      fix: 'Le script détecte ce cas avant d\u2019agir et classe la ligne en « ignoré ».',
    },
    {
      message: 'Les accents apparaissent mal dans l\u2019annuaire',
      cause: 'Le CSV n\u2019est pas en UTF-8.',
      fix: 'Réenregistrer le fichier en « CSV UTF-8 » depuis Excel, puis relancer.',
    },
    {
      message: 'New-ADUser : The password does not meet the length, complexity, or history requirement',
      code: '0x52D',
      cause: 'Le mot de passe temporaire saisi ne respecte pas la politique du domaine.',
      fix: 'Saisir un mot de passe conforme, ou créer les comptes désactivés puis attribuer les mots de passe ensuite.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le journal CSV écrit sur le Bureau liste chaque ligne avec son statut : créé, ignoré ou en erreur.',
    'Get-ADUser -Filter * -SearchBase <OU> affiche les comptes dans la bonne OU.',
    'Les comptes créés sans mot de passe sont désactivés : Enabled vaut False.',
    'Aucun mot de passe n\u2019apparaît nulle part — ni dans le script, ni dans le journal.',
  ],
  rollback: {
    summary: 'Un compte créé par erreur se désactive immédiatement — geste réversible et sans perte. La suppression, elle, n\u2019est pas automatisée : un compte porte un SID dont dépendent des permissions ailleurs.',
    diagnostic: '# Lister ce que l\'import a cree, avant toute decision.\nGet-ADUser -Filter * -SearchBase \'<dn-de-l-ou>\' -Properties WhenCreated,Enabled | Sort-Object WhenCreated -Descending | Format-Table SamAccountName,Enabled,WhenCreated,DistinguishedName',
    command: '# Desactiver un compte cree par erreur : reversible, immediat, sans perte.\n# -Confirm est explicite : PowerShell demandera confirmation.\nDisable-ADAccount -Identity \'<samaccountname>\' -Confirm\n\n# Verifier ensuite l\'etat reel du compte.\nGet-ADUser -Identity \'<samaccountname>\' -Properties Enabled | Format-List SamAccountName,Enabled,DistinguishedName',
    exceptional: '# AVERTISSEMENT CRITIQUE — suppression d\'un compte utilisateur.\n#\n# Supprimer un compte detruit son SID. Les permissions accordees a ce SID sur\n# des partages, des boites aux lettres ou des applications ne se retrouvent pas\n# en recreant un compte du meme nom : ce serait un autre SID. Cette operation\n# n\'est PAS automatisee ici.\n#\n# Avant d\'y penser :\n#   1. Verifier que la corbeille Active Directory est activee.\n#   2. Exporter les attributs du compte et ses appartenances de groupes.\n#   3. Verifier ce qui depend de ce compte : partages, applications, services.\n#   4. Preferer la desactivation, qui repond a presque tous les besoins.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/activedirectory/remove-aduser\n#\n# Commande, a executer manuellement :\n#   Remove-ADUser -Identity \'<samaccountname>\' -Confirm',
    warning: 'Un import en masse se teste sur trois lignes avant de passer à trois cents. Le mode Diagnostic sert exactement à cela.',
  },
  checks: [
    'Relire l\u2019aperçu des premières lignes : c\u2019est là qu\u2019un mauvais séparateur se voit immédiatement.',
    'Vérifier que les OU cibles existent avant de lancer l\u2019import.',
    'Ne jamais mettre de mot de passe dans le CSV : le script n\u2019en lit aucun.',
    'Commencer par un fichier réduit, en mode Diagnostic.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-aduser',
  sources: [
    { label: 'New-ADUser', url: 'https://learn.microsoft.com/powershell/module/activedirectory/new-aduser' },
    { label: 'Get-ADUser', url: 'https://learn.microsoft.com/powershell/module/activedirectory/get-aduser' },
    { label: 'Import-Csv', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/import-csv' },
    { label: 'Read-Host', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/read-host' },
    { label: 'Disable-ADAccount', url: 'https://learn.microsoft.com/powershell/module/activedirectory/disable-adaccount' },
  ],
};

/**
 * 3. ad-groups — créer des groupes, avec la portée qui convient.
 *
 * La portée n'est pas un détail : c'est elle qui décide si le groupe peut
 * contenir des comptes d'un autre domaine, et s'il peut recevoir des
 * permissions ailleurs dans la forêt. Le modèle AGDLP en dépend entièrement.
 */
export const outilGroupes = {
  id: 'ad-groups',
  icon: '\u25cb',
  category: 'Active Directory',
  subcategory: 'Utilisateurs et groupes',
  title: 'Créer et vérifier des groupes Active Directory',
  risk: 'caution',
  summary: 'Crée des groupes de sécurité ou de distribution avec la bonne portée, sans jamais écraser un groupe existant, et rappelle le modèle AGDLP.',
  fields: [
    champDomaine(),
    {
      id: 'grpList', label: 'Groupes à créer, un par ligne', type: 'textarea',
      default: 'GG-Medecins\nGG-Infirmieres\nGG-Administration\nDL-Dossiers-Patients-RW\nDL-Dossiers-Patients-R',
      help: 'Un nom par ligne. Convention utile : GG- pour les groupes globaux de personnes, DL- pour les groupes de domaine local porteurs de permissions.',
    },
    { id: 'grpOu', label: 'OU de destination', default: 'Administration', help: 'Chemin parent/enfant, relatif au domaine.' },
    {
      id: 'grpCategory', label: 'Catégorie', type: 'select', default: 'Security',
      options: [['Security', 'Sécurité — porte des permissions'], ['Distribution', 'Distribution — messagerie seulement']],
    },
    {
      id: 'grpScope', label: 'Portée', type: 'select', default: 'Global',
      options: [
        ['Global', 'Globale — regroupe des comptes du domaine'],
        ['DomainLocal', 'Domaine local — porte les permissions sur une ressource'],
        ['Universal', 'Universelle — traverse les domaines de la forêt'],
      ],
      help: 'AGDLP : comptes dans un groupe Global, permissions sur un groupe de Domaine local, le Global membre du Domaine local.',
    },
    { id: 'grpDescription', label: 'Description', default: 'Groupe créé par KJEMO IT Toolkit', help: 'Une description explicite évite les groupes orphelins dont personne ne sait à quoi ils servent.' },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'adDomain', validerFqdn(v.adDomain));

    const lignes = String(v.grpList ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
    if (lignes.length === 0) errors.grpList = 'Indique au moins un groupe, un par ligne.';
    else if (lignes.length > 50) errors.grpList = 'Pas plus de 50 groupes par exécution.';
    else {
      for (const nom of lignes) {
        const r = validateGroupName(nom);
        if (!r.ok) { errors.grpList = `« ${nom} » : ${r.error}`; break; }
      }
      const vus = lignes.map((l) => l.toLowerCase());
      if (!errors.grpList && new Set(vus).size !== vus.length) {
        errors.grpList = 'La liste contient deux fois le même groupe.';
      }
    }

    verifier(errors, 'grpOu', validerCheminOu(v.grpOu));
    verifier(errors, 'grpCategory', validerCategorieGroupe(v.grpCategory));
    verifier(errors, 'grpScope', validerPorteeGroupe(v.grpScope));
    const desc = String(v.grpDescription ?? '');
    if (desc.length > 1024) errors.grpDescription = 'La description ne doit pas dépasser 1024 caractères.';
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.adDomain).value;
    const segments = validerCheminOu(v.grpOu).value;
    const dnOu = cheminOuVersDn(segments, domaine);
    const groupes = String(v.grpList).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$DnOu = ${psB64(dnOu)}`,
      `$Categorie = ${psB64(v.grpCategory)}`,
      `$Portee = ${psB64(v.grpScope)}`,
      `$Description = ${psB64(v.grpDescription)}`,
      `$Groupes = @(${groupes.map((g) => psB64(g)).join(', ')})`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleAd(),
      "",
      '# --- 1. L\'OU de destination existe-t-elle ? -------------------------------',
      '$ouOk = $false',
      'if ($moduleOk) {',
      '  try {',
      '    $ouObj = Get-ADOrganizationalUnit -Identity $DnOu -ErrorAction SilentlyContinue',
      '    if ($ouObj) { $ouOk = $true }',
      '  } catch { }',
      '}',
      'if ($ouOk) {',
      "  [void](Add-KjemoResultat -Categorie 'Destination' -Controle 'OU cible' -Etat 'OK' -Valeur $DnOu)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Destination' -Controle 'OU cible' -Etat 'PROBLEME' -Valeur $DnOu -Commentaire 'OU introuvable : cree-la avant, avec l''outil de hierarchie d''OU.')",
      '}',
      "",
      '# --- 2. Etat des groupes demandes ------------------------------------------',
      '$aCreer = New-Object System.Collections.ArrayList',
      '$existants = New-Object System.Collections.ArrayList',
      'foreach ($nom in $Groupes) {',
      '  if (-not $moduleOk) { continue }',
      '  $existant = $null',
      '  try { $existant = Get-ADGroup -Filter "Name -eq \'$nom\'" -Properties GroupScope,GroupCategory,DistinguishedName,Description -ErrorAction SilentlyContinue } catch { }',
      '  if ($existant) {',
      '    [void]$existants.Add($existant)',
      "    $ecart = ''",
      '    if ($existant.GroupScope -ne $Portee) { $ecart = "Portee differente : $($existant.GroupScope) au lieu de $Portee. " }',
      '    if ($existant.GroupCategory -ne $Categorie) { $ecart = $ecart + "Categorie differente : $($existant.GroupCategory) au lieu de $Categorie." }',
      "    $etatG = 'OK'",
      '    if ($ecart -ne \'\') { $etatG = \'ATTENTION\' }',
      "    [void](Add-KjemoResultat -Categorie 'Groupes existants' -Controle $nom -Etat $etatG -Valeur (\"$($existant.GroupCategory) / $($existant.GroupScope) — $($existant.DistinguishedName)\") -Commentaire ($ecart + \" Le groupe n''est ni recree, ni modifie.\"))",
      '  } else {',
      '    [void]$aCreer.Add($nom)',
      "    [void](Add-KjemoResultat -Categorie 'Groupes a creer' -Controle $nom -Etat 'INFO' -Valeur \"$Categorie / $Portee dans $DnOu\")",
      '  }',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Resume\' -Controle \'Inventaire\' -Etat \'INFO\' -Valeur ("a creer : $($aCreer.Count) ; existants : $($existants.Count)"))',
      "",
      '# --- 3. Rappel du modele AGDLP ---------------------------------------------',
      "# A comme comptes, G comme groupe Global, DL comme groupe de Domaine Local,",
      "# P comme permissions. Les comptes entrent dans un groupe Global ; les",
      "# permissions se posent sur un groupe de Domaine Local ; le Global devient",
      "# membre du Domaine Local. Dans une foret multi-domaines, un groupe",
      "# Universel s'intercale : AGUDLP.",
      "[void](Add-KjemoResultat -Categorie 'Modele' -Controle 'AGDLP' -Etat 'INFO' -Valeur 'comptes -> groupe Global -> groupe de Domaine local -> permissions' -Commentaire 'Poser une permission directement sur un compte, ou sur un groupe Global, rend les droits impossibles a maintenir.')",
      "if ($Portee -eq 'Global' -and $Categorie -eq 'Security') {",
      "  [void](Add-KjemoResultat -Categorie 'Modele' -Controle 'Usage attendu' -Etat 'INFO' -Valeur 'groupe de personnes' -Commentaire 'Un groupe Global rassemble des comptes ; il ne devrait pas porter de permissions directement.')",
      "} elseif ($Portee -eq 'DomainLocal') {",
      "  [void](Add-KjemoResultat -Categorie 'Modele' -Controle 'Usage attendu' -Etat 'INFO' -Valeur 'groupe de permissions' -Commentaire 'Un groupe de Domaine local porte les droits sur une ressource et contient des groupes Globaux.')",
      "} elseif ($Portee -eq 'Universal') {",
      "  [void](Add-KjemoResultat -Categorie 'Modele' -Controle 'Usage attendu' -Etat 'INFO' -Valeur 'foret multi-domaines' -Commentaire 'Un groupe Universel est replique dans le catalogue global : a reserver aux besoins inter-domaines.')",
      '}',
      "",
      '# --- 4. Creation, uniquement en mode Appliquer -----------------------------',
      "if ($Mode -eq 'Appliquer' -and $moduleOk -and $ouOk) {",
      '  foreach ($nom in $aCreer) {',
      '    try {',
      '      New-ADGroup -Name $nom -SamAccountName $nom -GroupCategory $Categorie -GroupScope $Portee -Path $DnOu -Description $Description -ErrorAction Stop',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle $nom -Etat 'OK' -Valeur 'cree')",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle $nom -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '    }',
      '  }',
      "  Write-Host ''",
      "  Write-Host '--- Groupes apres creation ---'",
      '  foreach ($nom in $Groupes) {',
      '    $verif = $null',
      '    try { $verif = Get-ADGroup -Filter "Name -eq \'$nom\'" -Properties GroupScope,GroupCategory,DistinguishedName -ErrorAction SilentlyContinue } catch { }',
      '    if ($verif) {',
      '      [void](Add-KjemoResultat -Categorie \'Verification\' -Controle $nom -Etat \'OK\' -Valeur ("$($verif.GroupCategory) / $($verif.GroupScope) — $($verif.DistinguishedName)"))',
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle $nom -Etat 'PROBLEME' -Valeur 'absent apres execution')",
      '    }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  foreach ($nom in $aCreer) {',
      '    New-ADGroup -Name $nom -SamAccountName $nom -GroupCategory $Categorie -GroupScope $Portee -Path $DnOu -Description $Description -WhatIf',
      '  }',
      '}',
      blocModeDiagnostic(),
      blocAucuneSuppression('groupe'),
    ];

    return assembler({
      titre: 'Creer des groupes Active Directory',
      outil: 'ad-groups',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['OuCible', psB64(dnOu)],
        ['Portee', psB64(v.grpScope)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-ad-groupes',
      formats: 'Console',
    });
  },
  gui: [
    'Utilisateurs et ordinateurs Active Directory (dsa.msc).',
    'Clic droit sur l\u2019OU de destination > Nouveau > Groupe.',
    'Choisir l\u2019étendue (Globale, Domaine local, Universelle) et le type (Sécurité ou Distribution).',
    'Renseigner la description : c\u2019est ce qui évite les groupes dont plus personne ne connaît l\u2019usage.',
    'Onglet Membres et Membre de, pour construire la chaîne AGDLP.',
  ],
  keywords: [
    'groupe', 'new-adgroup', 'agdlp', 'agudlp', 'portee', 'global', 'domaine local',
    'universel', 'groupe de securite', 'distribution', 'droits ntfs par groupe',
  ],
  requiresAdmin: true,
  os: OS_AD,
  prereqs: PREREQS_AD.concat([
    'Droit de créer des groupes dans l\u2019OU visée.',
    'Convention de nommage arrêtée : renommer un groupe plus tard n\u2019est pas anodin quand des permissions y font référence.',
  ]),
  commonErrors: ERREURS_AD.concat([
    {
      message: 'New-ADGroup : The specified group already exists',
      cause: 'Un groupe porte déjà ce nom dans le domaine.',
      fix: 'Le script le détecte avant d\u2019agir et signale si la portée ou la catégorie diffèrent de ce qui est demandé.',
    },
    {
      message: 'Impossible de changer la portée d\u2019un groupe existant',
      cause: 'Active Directory n\u2019autorise que certaines conversions de portée, et seulement si les membres le permettent.',
      fix: 'Créer un nouveau groupe avec la bonne portée, y basculer les membres, puis retirer l\u2019ancien après vérification.',
    },
    {
      message: 'Les permissions ne suivent pas les utilisateurs ajoutés au groupe',
      cause: 'Le jeton de sécurité de la session ouverte ne contient pas les nouveaux groupes.',
      fix: 'Fermer puis rouvrir la session de l\u2019utilisateur. Un redémarrage n\u2019est pas nécessaire.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Get-ADGroup affiche chaque groupe avec sa portée, sa catégorie et son DN.',
    'Les groupes existants sont signalés, avec l\u2019écart éventuel de portée ou de catégorie.',
    'Dans dsa.msc, les groupes apparaissent dans l\u2019OU demandée.',
  ],
  rollback: {
    summary: 'Un groupe créé par erreur et sans membre ni permission se supprime proprement. Dès qu\u2019il porte des permissions, sa suppression laisse des ACL orphelines : on vide d\u2019abord, on documente, puis on décide.',
    diagnostic: '# Constater avant de defaire : membres, appartenances et anciennete.\nGet-ADGroup -Identity \'<nom-du-groupe>\' -Properties Members,MemberOf,WhenCreated,Description | Format-List Name,GroupScope,GroupCategory,WhenCreated,Description\nGet-ADGroupMember -Identity \'<nom-du-groupe>\' | Format-Table Name,ObjectClass',
    command: '# Retirer un groupe cree par erreur, apres avoir verifie qu\'il est vide et\n# qu\'aucune ressource ne s\'y refere. -Confirm est explicite.\nRemove-ADGroup -Identity \'<nom-du-groupe>\' -Confirm',
    exceptional: '# AVERTISSEMENT CRITIQUE — suppression d\'un groupe porteur de permissions.\n#\n# Supprimer un groupe detruit son SID. Toutes les ACL qui le mentionnent\n# deviennent orphelines : elles affichent un SID brut, et les droits qu\'elles\n# accordaient disparaissent sans que rien ne l\'annonce. Recreer un groupe du\n# meme nom ne les retablit pas : ce serait un autre SID.\n#\n# Avant d\'y penser :\n#   1. Auditer ou ce groupe est utilise (partages, NTFS, applications).\n#   2. Exporter la liste de ses membres.\n#   3. Verifier que la corbeille Active Directory est activee.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/activedirectory/remove-adgroup\n#\n# Commande, a executer manuellement :\n#   Remove-ADGroup -Identity \'<nom>\' -Confirm',
    warning: 'Un groupe de sécurité supprimé laisse des ACL orphelines partout où il était référencé. C\u2019est précisément ce que l\u2019outil d\u2019audit des permissions du LOT 2 détecte sous le nom « ACL orpheline ».',
  },
  checks: [
    'Choisir la portée d\u2019abord : elle conditionne tout le reste.',
    'Séparer les groupes de personnes (Global) des groupes de permissions (Domaine local).',
    'Renseigner une description : un groupe sans description devient un groupe qu\u2019on n\u2019ose plus toucher.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adgroup',
  sources: [
    { label: 'New-ADGroup', url: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adgroup' },
    { label: 'Get-ADGroup', url: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adgroup' },
    { label: 'Remove-ADGroup', url: 'https://learn.microsoft.com/powershell/module/activedirectory/remove-adgroup' },
  ],
};

/**
 * 4. ad-group-members-csv — ajouter des membres, sans jamais en retirer.
 *
 * L'ajout est réversible et sans perte ; le retrait ne l'est pas toujours,
 * parce qu'il faut savoir ce qui dépendait de cette appartenance. Ce script
 * ajoute, et c'est tout.
 */
export const outilMembresCsv = {
  id: 'ad-group-members-csv',
  icon: '\u25c7',
  category: 'Active Directory',
  subcategory: 'Utilisateurs et groupes',
  title: 'Importer les membres de groupes depuis un CSV',
  risk: 'caution',
  summary: 'Valide chaque compte et chaque groupe, détecte les doublons du fichier et les membres déjà présents, puis ajoute — sans jamais retirer personne.',
  fields: [
    champDomaine(),
    { id: 'memCsvPath', label: 'Chemin local du fichier CSV', default: 'C:\\Imports\\membres.csv', help: 'Deux colonnes : le compte et le groupe.' },
    { id: 'memColumns', label: 'Colonnes attendues', default: 'SamAccountName,Groupe', help: 'Les deux colonnes sont obligatoires.' },
    { id: 'memDelimiter', label: 'Séparateur', type: 'select', default: ';', options: [[';', 'Point-virgule (Excel français)'], [',', 'Virgule'], ['\t', 'Tabulation']] },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'adDomain', validerFqdn(v.adDomain));
    verifier(errors, 'memCsvPath', validerCheminWindowsLocal(v.memCsvPath));
    if (!/\.csv$/i.test(String(v.memCsvPath ?? '').trim()) && !errors.memCsvPath) {
      errors.memCsvPath = 'Le fichier doit porter l\u2019extension .csv.';
    }
    verifier(errors, 'memColumns', validerColonnesCsv(v.memColumns, { obligatoires: ['SamAccountName', 'Groupe'] }));
    verifier(errors, 'memDelimiter', validerChoix(v.memDelimiter, [';', ',', '\t'], 'Le séparateur'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.adDomain).value;
    const colonnes = validerColonnesCsv(v.memColumns, { obligatoires: ['SamAccountName', 'Groupe'] }).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$Fichier = ${psB64(validerCheminWindowsLocal(v.memCsvPath).value)}`,
      `$Separateur = ${psB64(v.memDelimiter)}`,
      `$ColonnesAttendues = @(${colonnes.map((c) => psB64(c)).join(', ')})`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleAd(),
      "",
      '# --- 1. Lecture et schema du fichier ---------------------------------------',
      'if (-not (Test-Path -LiteralPath $Fichier)) {',
      "  [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Existence' -Etat 'PROBLEME' -Valeur $Fichier -Commentaire 'Fichier introuvable sur cette machine.')",
      '  return',
      '}',
      '$lignes = @()',
      'try { $lignes = @(Import-Csv -LiteralPath $Fichier -Delimiter $Separateur -Encoding UTF8) } catch {',
      "  [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Lecture' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  return',
      '}',
      'if (@($lignes).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Fichier' -Controle 'Contenu' -Etat 'PROBLEME' -Valeur '0 ligne' -Commentaire 'Fichier vide, ou separateur incorrect.')",
      '  return',
      '}',
      '$colonnesReelles = @($lignes[0].PSObject.Properties.Name)',
      '$manquantes = @($ColonnesAttendues | Where-Object { $colonnesReelles -notcontains $_ })',
      'if (@($manquantes).Count -gt 0) {',
      '  [void](Add-KjemoResultat -Categorie \'Schema\' -Controle \'Colonnes manquantes\' -Etat \'PROBLEME\' -Valeur ($manquantes -join \', \'))',
      '  return',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Fichier\' -Controle \'Lignes lues\' -Etat \'OK\' -Valeur ("$(@($lignes).Count) ligne(s)"))',
      "",
      '# --- 2. Controles ligne par ligne -------------------------------------------',
      '$paires = @{}',
      '$aAjouter = New-Object System.Collections.ArrayList',
      '$ignores = New-Object System.Collections.ArrayList',
      '$erreurs = New-Object System.Collections.ArrayList',
      '$numero = 0',
      'foreach ($ligne in $lignes) {',
      '  $numero++',
      '  $sam = ("" + $ligne.SamAccountName).Trim()',
      '  $groupe = ("" + $ligne.Groupe).Trim()',
      "  if ($sam -eq '' -or $groupe -eq '') {",
      '    [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Compte = $sam; Groupe = $groupe; Raison = \'Colonne vide\' })',
      '    [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur "$sam / $groupe" -Commentaire \'Compte ou groupe vide.\')',
      '    continue',
      '  }',
      '  $cle = ($sam + \'|\' + $groupe).ToLower()',
      '  if ($paires.ContainsKey($cle)) {',
      '    [void]$ignores.Add([pscustomobject]@{ Ligne = $numero; Compte = $sam; Groupe = $groupe; Raison = "Doublon du fichier, deja vu ligne $($paires[$cle])" })',
      '    [void](Add-KjemoResultat -Categorie \'Ignores\' -Controle "Ligne $numero" -Etat \'INFO\' -Valeur "$sam -> $groupe" -Commentaire "Doublon dans le fichier, deja vu ligne $($paires[$cle]).")',
      '    continue',
      '  }',
      '  $paires[$cle] = $numero',
      '  if (-not $moduleOk) { continue }',
      "",
      '  $compteObj = $null',
      '  try { $compteObj = Get-ADUser -Filter "SamAccountName -eq \'$sam\'" -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $compteObj) {',
      '    [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Compte = $sam; Groupe = $groupe; Raison = \'Compte introuvable\' })',
      '    [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $sam -Commentaire \'Compte introuvable dans l\'\'annuaire.\')',
      '    continue',
      '  }',
      '  $groupeObj = $null',
      '  try { $groupeObj = Get-ADGroup -Filter "Name -eq \'$groupe\'" -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $groupeObj) {',
      '    [void]$erreurs.Add([pscustomobject]@{ Ligne = $numero; Compte = $sam; Groupe = $groupe; Raison = \'Groupe introuvable\' })',
      '    [void](Add-KjemoResultat -Categorie \'Erreurs\' -Controle "Ligne $numero" -Etat \'PROBLEME\' -Valeur $groupe -Commentaire \'Groupe introuvable dans l\'\'annuaire.\')',
      '    continue',
      '  }',
      '  $dejaMembre = $false',
      '  try {',
      '    $membres = @(Get-ADGroupMember -Identity $groupeObj.DistinguishedName -ErrorAction SilentlyContinue)',
      '    if ($membres | Where-Object { $_.distinguishedName -eq $compteObj.DistinguishedName }) { $dejaMembre = $true }',
      '  } catch { }',
      '  if ($dejaMembre) {',
      '    [void]$ignores.Add([pscustomobject]@{ Ligne = $numero; Compte = $sam; Groupe = $groupe; Raison = \'Deja membre\' })',
      '    [void](Add-KjemoResultat -Categorie \'Ignores\' -Controle "Ligne $numero" -Etat \'OK\' -Valeur "$sam -> $groupe" -Commentaire \'Deja membre : rien a faire.\')',
      '    continue',
      '  }',
      '  [void]$aAjouter.Add([pscustomobject]@{ Ligne = $numero; Compte = $compteObj.DistinguishedName; CompteNom = $sam; Groupe = $groupeObj.DistinguishedName; GroupeNom = $groupe })',
      '  [void](Add-KjemoResultat -Categorie \'A ajouter\' -Controle "Ligne $numero" -Etat \'INFO\' -Valeur "$sam -> $groupe")',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Resume\' -Controle \'Bilan\' -Etat \'INFO\' -Valeur ("a ajouter : $($aAjouter.Count) ; ignores : $($ignores.Count) ; erreurs : $($erreurs.Count)"))',
      "",
      '# --- 3. Ajout, uniquement en mode Appliquer ----------------------------------',
      "if ($Mode -eq 'Appliquer' -and $moduleOk) {",
      '  foreach ($paire in $aAjouter) {',
      '    try {',
      '      Add-ADGroupMember -Identity $paire.Groupe -Members $paire.Compte -ErrorAction Stop',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle "$($paire.CompteNom) -> $($paire.GroupeNom)" -Etat \'OK\' -Valeur \'ajoute\')',
      '    } catch {',
      '      [void](Add-KjemoResultat -Categorie \'Action\' -Controle "$($paire.CompteNom) -> $($paire.GroupeNom)" -Etat \'PROBLEME\' -Valeur $_.Exception.Message)',
      '      [void]$erreurs.Add([pscustomobject]@{ Ligne = $paire.Ligne; Compte = $paire.CompteNom; Groupe = $paire.GroupeNom; Raison = $_.Exception.Message })',
      '    }',
      '  }',
      "  Write-Host ''",
      "  Write-Host '--- Appartenances apres import ---'",
      '  foreach ($paire in $aAjouter) {',
      '    $ok = $false',
      '    try {',
      '      $m = @(Get-ADGroupMember -Identity $paire.Groupe -ErrorAction SilentlyContinue)',
      '      if ($m | Where-Object { $_.distinguishedName -eq $paire.Compte }) { $ok = $true }',
      '    } catch { }',
      "    $etatV = 'PROBLEME'",
      "    if ($ok) { $etatV = 'OK' }",
      '    [void](Add-KjemoResultat -Categorie \'Verification\' -Controle "$($paire.CompteNom) -> $($paire.GroupeNom)" -Etat $etatV -Valeur $ok)',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  foreach ($paire in $aAjouter) {',
      '    Add-ADGroupMember -Identity $paire.Groupe -Members $paire.Compte -WhatIf',
      '  }',
      '}',
      "",
      '# --- 4. Journal ---------------------------------------------------------------',
      '$journal = Join-Path (Join-Path $env:USERPROFILE \'Desktop\') ("kjemo-ad-membres-" + (Get-Date -Format \'yyyyMMdd-HHmmss\') + ".csv")',
      '$toutes = @()',
      "$toutes += @($aAjouter | ForEach-Object { [pscustomobject]@{ Ligne = $_.Ligne; Compte = $_.CompteNom; Groupe = $_.GroupeNom; Statut = 'A ajouter ou ajoute'; Detail = '' } })",
      "$toutes += @($ignores | ForEach-Object { [pscustomobject]@{ Ligne = $_.Ligne; Compte = $_.Compte; Groupe = $_.Groupe; Statut = 'Ignore'; Detail = $_.Raison } })",
      "$toutes += @($erreurs | ForEach-Object { [pscustomobject]@{ Ligne = $_.Ligne; Compte = $_.Compte; Groupe = $_.Groupe; Statut = 'Erreur'; Detail = $_.Raison } })",
      'if (@($toutes).Count -gt 0) {',
      '  $toutes | Export-Csv -LiteralPath $journal -NoTypeInformation -Encoding UTF8',
      '  Write-Host "Journal : $journal"',
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Portee de ce script ---'",
      "Write-Host 'Ce script AJOUTE des membres. Il n''en retire aucun : retirer une'",
      "Write-Host 'appartenance peut couper un acces dont personne n''avait note la'",
      "Write-Host 'dependance. Le retrait se fait a la main, apres verification.'",
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Importer les membres de groupes depuis un CSV',
      outil: 'ad-group-members-csv',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Domaine', psB64(domaine)],
        ['Fichier', psB64(v.memCsvPath)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-ad-membres',
      formats: 'Console',
    });
  },
  gui: [
    'dsa.msc > le groupe > Propriétés > onglet Membres > Ajouter.',
    'Ou : le compte > Propriétés > onglet Membre de > Ajouter, pour partir de l\u2019utilisateur.',
    'Pour vérifier : Get-ADGroupMember, ou l\u2019onglet Membres du groupe.',
    'Après ajout, l\u2019utilisateur doit fermer et rouvrir sa session pour que son jeton contienne le groupe.',
  ],
  keywords: [
    'membre de groupe', 'add-adgroupmember', 'import membres', 'appartenance',
    'csv groupes', 'ajouter au groupe', 'jeton de securite', 'droits ne suivent pas',
  ],
  requiresAdmin: true,
  os: OS_AD,
  prereqs: PREREQS_AD.concat([
    'Droit de modifier l\u2019appartenance des groupes visés.',
    'Les comptes et les groupes doivent exister : le script ne crée ni l\u2019un ni l\u2019autre.',
    'Fichier CSV en UTF-8, avec les deux colonnes attendues.',
  ]),
  commonErrors: ERREURS_AD.concat([
    {
      message: 'Add-ADGroupMember : The specified account name is already a member of the group',
      cause: 'Le compte appartient déjà au groupe.',
      fix: 'Le script détecte ce cas avant d\u2019agir et classe la ligne en « ignoré ».',
    },
    {
      message: 'Add-ADGroupMember : The server is unwilling to process the request',
      cause: 'La portée du groupe n\u2019autorise pas ce type de membre — un groupe Global ne peut pas contenir un compte d\u2019un autre domaine.',
      fix: 'Revoir la portée du groupe, ou passer par un groupe Universel dans une forêt multi-domaines.',
    },
    {
      message: 'L\u2019utilisateur ne voit pas ses nouveaux droits',
      cause: 'Le jeton de sécurité de sa session date d\u2019avant l\u2019ajout.',
      fix: 'Fermer puis rouvrir la session.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le journal CSV liste chaque paire compte/groupe avec son statut.',
    'Get-ADGroupMember montre les nouveaux membres.',
    'Dans dsa.msc, l\u2019onglet Membres du groupe est à jour.',
  ],
  rollback: {
    summary: 'Retirer une appartenance ajoutée par erreur est simple et réversible — encore faut-il savoir ce qui en dépendait. Le journal de l\u2019import donne exactement la liste des paires ajoutées.',
    diagnostic: '# Relire ce qui a ete ajoute, et l\'etat actuel du groupe.\nGet-ADGroupMember -Identity \'<groupe>\' | Format-Table Name,SamAccountName,ObjectClass\nGet-ADUser -Identity \'<compte>\' -Properties MemberOf | Select-Object -ExpandProperty MemberOf',
    command: '# Retirer une appartenance ajoutee par erreur. -Confirm est explicite :\n# PowerShell demandera confirmation avant de retirer le membre.\nRemove-ADGroupMember -Identity \'<groupe>\' -Members \'<compte>\' -Confirm',
    exceptional: '',
    warning: 'Retirer un compte d\u2019un groupe lui coupe les accès qui en dépendaient — parfois des accès dont personne n\u2019avait noté la dépendance. Vérifier avant, surtout sur les groupes d\u2019administration.',
  },
  checks: [
    'Vérifier que les comptes et les groupes existent avant de lancer l\u2019import.',
    'Le mode Diagnostic donne la liste exacte des ajouts qui auront lieu.',
    'Ce script n\u2019enlève jamais personne d\u2019un groupe : c\u2019est volontaire.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/activedirectory/add-adgroupmember',
  sources: [
    { label: 'Add-ADGroupMember', url: 'https://learn.microsoft.com/powershell/module/activedirectory/add-adgroupmember' },
    { label: 'Get-ADGroupMember', url: 'https://learn.microsoft.com/powershell/module/activedirectory/get-adgroupmember' },
    { label: 'Remove-ADGroupMember', url: 'https://learn.microsoft.com/powershell/module/activedirectory/remove-adgroupmember' },
  ],
};

/**
 * 5. ad-home-profile-paths — dossiers personnels et profils itinérants.
 *
 * Trois attributs d'annuaire, mais surtout deux couches de permissions et un
 * partage qui doivent suivre. Le script relève l'état existant AVANT de le
 * changer, et écrit les anciennes valeurs dans un fichier de reprise.
 */
export const outilCheminsProfils = {
  id: 'ad-home-profile-paths',
  icon: '\u25e8',
  category: 'Active Directory',
  subcategory: 'Utilisateurs et groupes',
  title: 'Dossiers personnels et profils itinérants',
  risk: 'caution',
  summary: 'Vérifie partage, dossiers et permissions, sauvegarde les anciennes valeurs, puis pose HomeDirectory, HomeDrive et ProfilePath de façon idempotente.',
  fields: [
    champDomaine(),
    { id: 'hpOu', label: 'OU des comptes concernés', default: 'Médecin', help: 'Chemin parent/enfant, relatif au domaine. Tous les comptes de cette OU sont traités.' },
    { id: 'hpHomeRoot', label: 'Racine des dossiers personnels (UNC)', default: '\\\\srv-fichiers\\Personnels', help: 'Le dossier de chaque compte est créé sous cette racine, à son nom.' },
    { id: 'hpDrive', label: 'Lettre de lecteur', default: 'H:', help: 'Lecteur auquel le dossier personnel sera monté.' },
    { id: 'hpProfileRoot', label: 'Racine des profils itinérants (UNC)', default: '\\\\srv-fichiers\\Profils', help: 'Windows ajoute le suffixe de version (.V6) de lui-même.' },
    {
      id: 'hpProfiles', label: 'Profils itinérants', type: 'select', default: 'Non',
      options: [['Non', 'Non — dossier personnel seulement'], ['Oui', 'Oui — dossier personnel et profil itinérant']],
      help: 'Le profil itinérant copie tout le profil à chaque ouverture et fermeture de session : à réserver aux cas qui le justifient.',
    },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'adDomain', validerFqdn(v.adDomain));
    verifier(errors, 'hpOu', validerCheminOu(v.hpOu));
    verifier(errors, 'hpHomeRoot', validerCheminUnc(v.hpHomeRoot));
    verifier(errors, 'hpDrive', validerLettreLecteur(v.hpDrive));
    const avecProfils = String(v.hpProfiles ?? '') === 'Oui';
    const racineProfil = String(v.hpProfileRoot ?? '').trim();
    if (avecProfils || racineProfil) {
      verifier(errors, 'hpProfileRoot', validerCheminUnc(racineProfil));
    }
    verifier(errors, 'hpProfiles', validerChoix(v.hpProfiles, ['Oui', 'Non'], 'L\u2019option de profil itinérant'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const domaine = validerFqdn(v.adDomain).value;
    const dnOu = cheminOuVersDn(validerCheminOu(v.hpOu).value, domaine);
    const avecProfils = v.hpProfiles === 'Oui';

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$DnOu = ${psB64(dnOu)}`,
      `$RacinePersonnels = ${psB64(validerCheminUnc(v.hpHomeRoot).value)}`,
      `$Lecteur = ${psB64(validerLettreLecteur(v.hpDrive).value)}`,
      `$RacineProfils = ${psB64(String(v.hpProfileRoot ?? '').trim())}`,
      `$AvecProfils = $${avecProfils ? 'true' : 'false'}`,
      "$KjemoFormat = 'Console'",
      "",
      blocModuleAd(),
      "",
      '# --- 1. Les partages repondent-ils ? ---------------------------------------',
      '# Un chemin UNC inscrit dans l\'annuaire alors que le partage n\'existe pas',
      "# donne un symptome deroutant : la session s'ouvre, mais le lecteur reseau",
      '# reste absent, sans message clair.',
      'function Test-KjemoPartage {',
      '  param([Parameter(Mandatory=$true)][string]$Chemin)',
      '  $ok = $false',
      '  try { $ok = Test-Path -LiteralPath $Chemin -ErrorAction SilentlyContinue } catch { }',
      '  return $ok',
      '}',
      "",
      '$racineOk = Test-KjemoPartage -Chemin $RacinePersonnels',
      "$etatRacine = 'PROBLEME'",
      "$commentaireRacine = 'Racine injoignable : verifie le partage, le nom du serveur et les droits.'",
      "if ($racineOk) { $etatRacine = 'OK'; $commentaireRacine = '' }",
      '[void](Add-KjemoResultat -Categorie \'Partages\' -Controle \'Racine des dossiers personnels\' -Etat $etatRacine -Valeur $RacinePersonnels -Commentaire $commentaireRacine)',
      "",
      'if ($AvecProfils) {',
      '  $profilsOk = Test-KjemoPartage -Chemin $RacineProfils',
      "  $etatProfils = 'PROBLEME'",
      "  if ($profilsOk) { $etatProfils = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Partages\' -Controle \'Racine des profils\' -Etat $etatProfils -Valeur $RacineProfils)',
      '}',
      "",
      '# Permissions SMB et NTFS de la racine : les deux comptent, et c\'est',
      "# l'intersection qui s'applique.",
      '$nomServeur = ($RacinePersonnels -split \'\\\\\')[2]',
      '$nomPartage = ($RacinePersonnels -split \'\\\\\')[3]',
      'if ($nomServeur -and $nomPartage) {',
      '  try {',
      '    $acces = @(Get-SmbShareAccess -Name $nomPartage -CimSession $nomServeur -ErrorAction SilentlyContinue)',
      '    foreach ($a in $acces) {',
      '      [void](Add-KjemoResultat -Categorie \'Permissions SMB\' -Controle $a.AccountName -Etat \'INFO\' -Valeur ("$($a.AccessControlType) $($a.AccessRight)"))',
      '    }',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Permissions SMB' -Controle 'Lecture' -Etat 'IGNORE' -Valeur 'non lisible a distance' -Commentaire 'Execute le diagnostic depuis le serveur de fichiers pour ce controle.')",
      '  }',
      '  try {',
      '    $acl = Get-Acl -LiteralPath $RacinePersonnels -ErrorAction SilentlyContinue',
      '    if ($acl) {',
      '      foreach ($regle in @($acl.Access | Where-Object { -not $_.IsInherited })) {',
      '        [void](Add-KjemoResultat -Categorie \'Permissions NTFS\' -Controle $regle.IdentityReference.Value -Etat \'INFO\' -Valeur ("$($regle.AccessControlType) $($regle.FileSystemRights)"))',
      '      }',
      '    }',
      '  } catch { }',
      '}',
      "",
      '# --- 2. Comptes concernes et etat actuel -----------------------------------',
      '$comptes = @()',
      'if ($moduleOk) {',
      '  try { $comptes = @(Get-ADUser -SearchBase $DnOu -Filter * -Properties HomeDirectory,HomeDrive,ProfilePath,SamAccountName) } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Comptes' -Controle 'Lecture' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'OU introuvable, ou droits insuffisants.')",
      '  }',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Comptes\' -Controle \'Comptes trouves\' -Etat \'INFO\' -Valeur ("$(@($comptes).Count) compte(s) dans $DnOu"))',
      "",
      '$aModifier = New-Object System.Collections.ArrayList',
      '$conformes = New-Object System.Collections.ArrayList',
      '$ancien = New-Object System.Collections.ArrayList',
      "",
      'foreach ($compte in $comptes) {',
      '  $cheminVoulu = Join-Path $RacinePersonnels $compte.SamAccountName',
      "  $profilVoulu = ''",
      '  if ($AvecProfils) { $profilVoulu = Join-Path $RacineProfils $compte.SamAccountName }',
      "",
      '  [void]$ancien.Add([pscustomobject]@{',
      '    SamAccountName = $compte.SamAccountName',
      '    HomeDirectory  = $compte.HomeDirectory',
      '    HomeDrive      = $compte.HomeDrive',
      '    ProfilePath    = $compte.ProfilePath',
      '  })',
      "",
      '  $dejaConforme = ($compte.HomeDirectory -eq $cheminVoulu) -and ($compte.HomeDrive -eq $Lecteur)',
      '  if ($AvecProfils) { $dejaConforme = $dejaConforme -and ($compte.ProfilePath -eq $profilVoulu) }',
      "",
      '  if ($dejaConforme) {',
      '    [void]$conformes.Add($compte.SamAccountName)',
      '    [void](Add-KjemoResultat -Categorie \'Comptes conformes\' -Controle $compte.SamAccountName -Etat \'OK\' -Valeur ("$($compte.HomeDrive) $($compte.HomeDirectory)") -Commentaire \'Deja conforme : aucune ecriture.\')',
      '  } else {',
      '    [void]$aModifier.Add([pscustomobject]@{ Sam = $compte.SamAccountName; Dn = $compte.DistinguishedName; Chemin = $cheminVoulu; Profil = $profilVoulu })',
      '    [void](Add-KjemoResultat -Categorie \'Comptes a modifier\' -Controle $compte.SamAccountName -Etat \'INFO\' -Valeur ("actuel : $($compte.HomeDrive) $($compte.HomeDirectory) -> voulu : $Lecteur $cheminVoulu"))',
      '  }',
      "",
      '  # Le dossier existe-t-il deja sous la racine ?',
      '  if ($racineOk) {',
      '    $existe = Test-KjemoPartage -Chemin $cheminVoulu',
      '    if (-not $existe) {',
      "      [void](Add-KjemoResultat -Categorie 'Dossiers' -Controle $compte.SamAccountName -Etat 'ATTENTION' -Valeur $cheminVoulu -Commentaire \"Dossier absent : il sera cree en mode Appliquer, avec un droit de modification pour l''utilisateur.\")",
      '    } else {',
      '      [void](Add-KjemoResultat -Categorie \'Dossiers\' -Controle $compte.SamAccountName -Etat \'OK\' -Valeur $cheminVoulu)',
      '    }',
      '  }',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Resume\' -Controle \'Bilan\' -Etat \'INFO\' -Valeur ("a modifier : $($aModifier.Count) ; deja conformes : $($conformes.Count)"))',
      "",
      '# --- 3. Sauvegarde des anciennes valeurs, AVANT toute ecriture -------------',
      '$sauvegarde = Join-Path (Join-Path $env:USERPROFILE \'Desktop\') ("kjemo-ad-chemins-avant-" + (Get-Date -Format \'yyyyMMdd-HHmmss\') + ".csv")',
      'if (@($ancien).Count -gt 0) {',
      '  $ancien | Export-Csv -LiteralPath $sauvegarde -NoTypeInformation -Encoding UTF8',
      "  [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Anciennes valeurs' -Etat 'OK' -Valeur $sauvegarde -Commentaire 'Ce fichier permet de remettre les valeurs precedentes, compte par compte.')",
      '}',
      "",
      '# --- 4. Application, uniquement en mode Appliquer ---------------------------',
      "if ($Mode -eq 'Appliquer' -and $moduleOk) {",
      '  foreach ($cible in $aModifier) {',
      '    # 4a. Creer le dossier personnel s\'il manque, et donner a l\'utilisateur',
      '    #     le droit de modifier SON dossier — pas plus.',
      '    if ($racineOk -and -not (Test-KjemoPartage -Chemin $cible.Chemin)) {',
      '      try {',
      '        New-Item -ItemType Directory -Path $cible.Chemin -ErrorAction Stop | Out-Null',
      '        $aclDossier = Get-Acl -LiteralPath $cible.Chemin',
      '        $regle = New-Object System.Security.AccessControl.FileSystemAccessRule(',
      '          $cible.Sam, \'Modify\', \'ContainerInherit,ObjectInherit\', \'None\', \'Allow\')',
      '        $aclDossier.AddAccessRule($regle)',
      '        Set-Acl -LiteralPath $cible.Chemin -AclObject $aclDossier',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle $cible.Sam -Etat 'OK' -Valeur 'dossier cree et droits poses')",
      '      } catch {',
      "        [void](Add-KjemoResultat -Categorie 'Action' -Controle $cible.Sam -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'Creation du dossier ou pose des droits refusee.')",
      '      }',
      '    }',
      '    # 4b. Ecrire les attributs d\'annuaire.',
      '    try {',
      '      if ($AvecProfils) {',
      '        Set-ADUser -Identity $cible.Dn -HomeDirectory $cible.Chemin -HomeDrive $Lecteur -ProfilePath $cible.Profil -ErrorAction Stop',
      '      } else {',
      '        Set-ADUser -Identity $cible.Dn -HomeDirectory $cible.Chemin -HomeDrive $Lecteur -ErrorAction Stop',
      '      }',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle $cible.Sam -Etat 'OK' -Valeur 'attributs mis a jour')",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle $cible.Sam -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '    }',
      '  }',
      "",
      "  Write-Host ''",
      "  Write-Host '--- Attributs apres modification ---'",
      '  foreach ($cible in $aModifier) {',
      '    $verif = $null',
      '    try { $verif = Get-ADUser -Identity $cible.Dn -Properties HomeDirectory,HomeDrive,ProfilePath -ErrorAction SilentlyContinue } catch { }',
      '    if ($verif) {',
      '      [void](Add-KjemoResultat -Categorie \'Verification\' -Controle $cible.Sam -Etat \'OK\' -Valeur ("$($verif.HomeDrive) $($verif.HomeDirectory) ; profil : $($verif.ProfilePath)"))',
      '    }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  foreach ($cible in $aModifier) {',
      '    Set-ADUser -Identity $cible.Dn -HomeDirectory $cible.Chemin -HomeDrive $Lecteur -WhatIf',
      '  }',
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Methode alternative ---'",
      "Write-Host 'La redirection de dossiers par strategie de groupe remplace avantageusement'",
      "Write-Host 'les profils itinerants dans la plupart des cas : elle ne copie que ce qui'",
      "Write-Host 'change, et n''allonge pas l''ouverture de session. Elle releve de la'",
      "Write-Host 'categorie GPO, et n''est pas traitee dans ce lot.'",
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Dossiers personnels et profils itinerants',
      outil: 'ad-home-profile-paths',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['OuCible', psB64(dnOu)],
        ['RacinePersonnels', psB64(v.hpHomeRoot)],
        ['Lecteur', psB64(v.hpDrive)],
        ['Profils', psB64(v.hpProfiles)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-ad-chemins',
      formats: 'Console',
    });
  },
  gui: [
    'dsa.msc > le compte > Propriétés > onglet Profil.',
    'Dossier de base : cocher « Connecter », choisir la lettre et saisir le chemin UNC.',
    'Chemin du profil : le renseigner seulement si un profil itinérant est réellement voulu.',
    'Sur le serveur de fichiers : vérifier que le partage existe et que les droits SMB et NTFS le permettent.',
    'La sélection multiple dans dsa.msc permet de traiter plusieurs comptes d\u2019un coup avec %username%.',
  ],
  keywords: [
    'dossier personnel', 'home directory', 'homedrive', 'profil itinerant', 'profilepath',
    'lecteur reseau', 'h:', 'unc', 'partage profils', 'redirection de dossiers',
  ],
  requiresAdmin: true,
  os: OS_AD,
  prereqs: PREREQS_AD.concat([
    'Droit de modifier les comptes de l\u2019OU visée.',
    'Partage SMB existant, avec des droits permettant au serveur de créer les dossiers.',
    'Droits NTFS cohérents sur la racine : chaque utilisateur doit pouvoir écrire dans SON dossier, et pas dans celui des autres.',
    'Exécuter depuis le serveur de fichiers permet de lire aussi les permissions SMB locales.',
  ]),
  commonErrors: ERREURS_AD.concat([
    {
      message: 'Le lecteur réseau n\u2019apparaît pas à l\u2019ouverture de session',
      cause: 'Chemin UNC incorrect, partage absent, ou droits insuffisants sur le dossier.',
      fix: 'Le diagnostic de ce script teste le partage et le dossier avant d\u2019écrire quoi que ce soit.',
    },
    {
      message: 'Le profil itinérant n\u2019est pas chargé et la session utilise un profil temporaire',
      cause: 'Droits insuffisants sur le dossier de profil, ou suffixe de version incompatible.',
      fix: 'Windows ajoute le suffixe .V6 de lui-même : ne pas l\u2019écrire dans le chemin. Vérifier les droits sur le dossier créé.',
    },
    {
      message: 'Set-ADUser : Access is denied',
      cause: 'Droits insuffisants sur les comptes de cette OU.',
      fix: 'Vérifier la délégation sur l\u2019OU avec l\u2019outil d\u2019audit de délégation.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le fichier CSV des anciennes valeurs est écrit sur le Bureau avant toute modification.',
    'Get-ADUser -Properties HomeDirectory,HomeDrive,ProfilePath montre les nouvelles valeurs.',
    'À l\u2019ouverture de session d\u2019un utilisateur concerné, le lecteur apparaît et il peut y écrire.',
    'Les comptes déjà conformes ne sont pas réécrits.',
  ],
  rollback: {
    summary: 'Les anciennes valeurs sont exportées avant toute écriture : l\u2019annulation consiste à les remettre, compte par compte, depuis ce fichier. Les dossiers créés, eux, contiennent des données utilisateur et ne sont pas supprimés.',
    diagnostic: '# Relire le fichier de sauvegarde et l\'etat actuel des comptes.\nImport-Csv -LiteralPath \'<fichier-kjemo-ad-chemins-avant.csv>\' | Format-Table SamAccountName,HomeDirectory,HomeDrive,ProfilePath\nGet-ADUser -SearchBase \'<dn-de-l-ou>\' -Filter * -Properties HomeDirectory,HomeDrive,ProfilePath | Format-Table SamAccountName,HomeDrive,HomeDirectory,ProfilePath',
    command: '# Remettre les valeurs precedentes depuis la sauvegarde. Le script ci-dessous\n# ne touche qu\'aux trois attributs concernes, compte par compte.\nImport-Csv -LiteralPath \'<fichier-kjemo-ad-chemins-avant.csv>\' | ForEach-Object {\n  Set-ADUser -Identity $_.SamAccountName -HomeDirectory $_.HomeDirectory -HomeDrive $_.HomeDrive -ProfilePath $_.ProfilePath -Confirm\n}',
    exceptional: '',
    warning: 'Les dossiers personnels créés contiennent des données des utilisateurs. Remettre les anciens attributs ne les supprime pas, et c\u2019est voulu : on ne détruit pas des données pour annuler un changement de chemin.',
  },
  checks: [
    'Vérifier le partage et les droits avant de pointer des centaines de comptes vers un chemin qui ne répond pas.',
    'Le profil itinérant allonge l\u2019ouverture et la fermeture de session : ne l\u2019activer que si le besoin le justifie.',
    'La redirection de dossiers par GPO est souvent la meilleure réponse — elle relève du lot GPO.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/activedirectory/set-aduser',
  sources: [
    { label: 'Set-ADUser', url: 'https://learn.microsoft.com/powershell/module/activedirectory/set-aduser' },
    { label: 'Get-ADUser', url: 'https://learn.microsoft.com/powershell/module/activedirectory/get-aduser' },
    { label: 'Get-SmbShareAccess', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshareaccess' },
    { label: 'Get-Acl', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl' },
  ],
};

// ---------------------------------------------------------------------------
// Catalogue exporté — complété au fil des sous-rubriques du LOT 3
// ---------------------------------------------------------------------------
export const toolsAd = [
  outilOuHierarchie,
  outilUtilisateursCsv,
  outilGroupes,
  outilMembresCsv,
  outilCheminsProfils,
];
