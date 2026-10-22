/**
 * outils-azure-stockage.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Famille E : stockage et protection. Quatre assistants : inventaire des
 * comptes de stockage, diagnostic de l'exposition d'un compte, inventaire des
 * coffres et de l'état des sauvegardes, restauration guidée vers une cible de
 * laboratoire distincte.
 *
 * ---------------------------------------------------------------------------
 * LES SECRETS DU STOCKAGE NE SONT JAMAIS LUS
 * ---------------------------------------------------------------------------
 * Un compte de stockage a des clés (qui donnent TOUS les droits sur les
 * données) et peut émettre des jetons SAP/SAS (des URL signées qui donnent un
 * accès sans compte). Lire ou générer l'un ou l'autre met un secret dans un
 * terminal, un journal, un presse-papiers, parfois un rapport. Aucun assistant
 * de ce lot n'appelle Get-AzStorageAccountKey, New-AzStorageAccountSASToken ni
 * leurs cousins : ils sont inscrits comme INTERDITS dans cmdlets.mjs, et un
 * banc vérifie qu'aucun script généré ne les contient.
 *
 * Le diagnostic d'exposition passe donc par le plan de gestion (propriétés du
 * compte, conteneurs par Get-AzRmStorageContainer) — jamais par le plan de
 * données, qui demanderait une clé ou un jeton.
 *
 * ---------------------------------------------------------------------------
 * UNE SAUVEGARDE DÉCLARÉE NE PROUVE PAS UNE RESTAURATION
 * ---------------------------------------------------------------------------
 * « Sauvegarde : Completed » dit qu'une copie a été écrite. Cela ne dit pas
 * qu'elle se relit, qu'elle démarre, ni que les données voulues y sont.
 * Seule une restauration réussie ET vérifiée le prouve. Aucune ligne du rapport
 * n'écrit « sauvegardes OK » : l'état est un constat, et la dernière ligne
 * rappelle que la restauration n'est pas testée.
 */

import { psB64 } from './noyau.mjs';
import {
  outilAzure,
  rollbackLecture,
  CHECKS_LECTURE,
  LIGNES_AIDES_AZ,
  LIGNES_NOM_DEPUIS_ID,
} from './noyau-azure.mjs';
import {
  validerGroupeRessources,
  validerNomVm,
  validerNomStockage,
  validerNomCoffre,
  validerBorne,
} from './validateurs-azure.mjs';

const FAMILLE = 'Stockage et protection';
const doc = (chemin) => `https://learn.microsoft.com/${chemin}`;
const verif = (errors, champ, r) => { if (!r.ok) errors[champ] = r.error; return r; };

const SRC_NE_PAS_LIRE_CLES = { label: 'Gérer les clés d’accès d’un compte de stockage (et pourquoi les éviter)', url: doc('azure/storage/common/storage-account-keys-manage') };

const CHECKS_STOCKAGE = CHECKS_LECTURE.concat([
  'Aucune clé de compte, aucune chaîne de connexion et aucun jeton SAS n’est lu, généré ni affiché : les commandes correspondantes sont interdites dans le catalogue.',
  'Aucun contenu de conteneur n’est lu : seul le plan de gestion (propriétés) est interrogé.',
]);

// ===========================================================================
// 17. azure-stockage-inventaire
// ===========================================================================
export const outilAzureStockageInventaire = outilAzure({
  id: 'azure-stockage-inventaire',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-stockage-inventaire',
  title: 'Inventaire des comptes de stockage et de leurs réglages de sécurité',
  summary: 'Liste les comptes de stockage (type, redondance, niveau d’accès) et relève les réglages qui touchent l’exposition : accès public aux blobs, HTTPS obligatoire, version minimale de TLS, pare-feu réseau, accès par clé. Ne lit aucune clé ni aucun jeton. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzStorageAccount'], facultatives: [] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources (facultatif)', default: '', help: 'Vide = tout l’abonnement. Nom exact, sans joker.' },
    { id: 'azLimite', label: 'Nombre maximal de comptes détaillés', type: 'number', default: '100', min: 1, max: 500, help: 'Entre 1 et 500.' },
  ],
  verifier(v, errors) {
    if (String(v.azRg ?? '').trim()) verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 500, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg ?? '').trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 500).value))],
  ],
  corps: () => [
    "$comptes = @(Invoke-KjemoLecture 'Comptes de stockage' 'Liste' {",
    '  if ($KjemoArgRg) { Get-AzStorageAccount -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzStorageAccount -ErrorAction Stop }',
    '})',
    'if ($script:KjemoLectureOk) {',
    "  [void](Add-KjemoResultat -Categorie 'Comptes de stockage' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$comptes.Count + ' compte(s)'))",
    '  foreach ($c in @($comptes | Sort-Object -Property StorageAccountName | Select-Object -First ([int]$KjemoArgLimite))) {',
    "    $etat = 'INFO'",
    '    $constats = @()',
    "    if ($c.AllowBlobPublicAccess -eq $true) { $etat = 'ATTENTION'; $constats += 'ACCES PUBLIC AUX BLOBS autorise au niveau du compte' }",
    "    elseif ($null -eq $c.AllowBlobPublicAccess) { $constats += 'acces public aux blobs : valeur non fournie (ne pas lire comme refuse)' }",
    "    if ($c.EnableHttpsTrafficOnly -eq $false) { $etat = 'PROBLEME'; $constats += 'HTTPS NON obligatoire' }",
    '    $tls = [string]$c.MinimumTlsVersion',
    "    if ($tls -eq 'TLS1_0' -or $tls -eq 'TLS1_1') { if ($etat -eq 'INFO') { $etat = 'ATTENTION' }; $constats += 'TLS minimal ancien (' + $tls + ')' }",
    "    elseif (-not $tls) { $constats += 'version TLS minimale non fournie' }",
    "    $action = ''",
    '    if ($null -ne $c.NetworkRuleSet) { $action = [string]$c.NetworkRuleSet.DefaultAction }',
    "    if ($action -eq 'Allow') { $constats += 'pare-feu du compte : tous les reseaux autorises (l authentification reste requise)' }",
    "    elseif ($action -eq 'Deny') { $constats += 'pare-feu du compte : acces restreint aux regles listees' }",
    "    else { $constats += 'pare-feu du compte : valeur non fournie' }",
    "    if ($c.AllowSharedKeyAccess -eq $false) { $constats += 'acces par cle de compte desactive' }",
    "    else { $constats += 'acces par cle de compte possible (les cles ne sont PAS lues ici)' }",
    "    [void](Add-KjemoResultat -Categorie 'Comptes de stockage' -Controle ([string]$c.StorageAccountName) -Etat $etat -Valeur ([string]$c.Kind + ' / ' + [string]$c.Sku.Name + ' / ' + [string]$c.Location) -Commentaire ($constats -join ' ; '))",
    '  }',
    '  if ($comptes.Count -gt [int]$KjemoArgLimite) {',
    "    [void](Add-KjemoResultat -Categorie 'Comptes de stockage' -Controle 'Limite' -Etat 'INFO' -Valeur ('seuls les ' + [string]$KjemoArgLimite + ' premiers sont detailles') -Commentaire 'Filtre par groupe de ressources ou augmente la limite.')",
    '  }',
    "  [void](Add-KjemoResultat -Categorie 'Limites' -Controle 'Ce que ce rapport ne dit pas' -Etat 'INFO' -Valeur 'plan de gestion seulement' -Commentaire 'Aucun contenu, aucune cle, aucun jeton n est lu. Un compte sans constat ici n est pas prouve sur : ses conteneurs, ses points de terminaison prives et ses roles de donnees se lisent avec l assistant d exposition et dans le portail.')",
    '}',
  ],
  gui: [
    'Portail Azure > Comptes de stockage : la liste avec type, performance, réplication et emplacement.',
    'Compte de stockage > Sécurité + mise en réseau > Mise en réseau : « Activé de tous les réseaux » ou « Activé à partir de réseaux virtuels et d’adresses IP sélectionnés ».',
    'Compte de stockage > Paramètres > Configuration : transfert sécurisé obligatoire, accès anonyme aux blobs, version TLS minimale, accès par clé de compte.',
    'Microsoft Defender pour le cloud > Recommandations : les écarts de configuration que le portail détecte déjà.',
  ],
  keywords: ['stockage', 'compte de stockage', 'storage account', 'get-azstorageaccount', 'blob public', 'acces anonyme', 'https', 'tls', 'exposition stockage', 'pare-feu stockage', 'inventaire stockage', 'cle de compte'],
  prereqs: ['Rôle Lecteur (Reader) sur les groupes de ressources contenant les comptes. Aucun rôle de données (Storage Blob Data) n’est nécessaire : aucun contenu n’est lu.'],
  commonErrors: [
    {
      message: 'Une propriété affiche « non fournie »',
      cause: 'Les propriétés de sécurité dépendent de la version du module Az.Storage et de l’ancienneté du compte.',
      fix: 'Une valeur absente n’est jamais lue comme « refusé » ou « sûr ». Vérifie la page Configuration du compte dans le portail.',
    },
  ],
  verifyAfter: [
    'Compare deux comptes du rapport avec leur page Configuration dans le portail : mêmes réglages.',
    'Pour un compte « ACCES PUBLIC », ouvre le détail avec l’assistant d’exposition avant de décider quoi que ce soit.',
    'Aucune ligne n’est INACCESSIBLE ; sinon l’inventaire est incomplet.',
  ],
  rollback: rollbackLecture('# Les réglages d’un compte précis (sans clés)\nGet-AzStorageAccount -ResourceGroupName \'rg-lab\' -Name \'stlabdemo001\' | Select-Object StorageAccountName, AllowBlobPublicAccess, EnableHttpsTrafficOnly, MinimumTlsVersion'),
  checks: CHECKS_STOCKAGE,
  source: doc('powershell/module/az.storage/get-azstorageaccount'),
  sources: [
    { label: 'Get-AzStorageAccount', url: doc('powershell/module/az.storage/get-azstorageaccount') },
    { label: 'Vue d’ensemble des comptes de stockage', url: doc('azure/storage/common/storage-account-overview') },
    { label: 'Empêcher l’accès anonyme en lecture aux blobs', url: doc('azure/storage/blobs/anonymous-read-access-prevent') },
    SRC_NE_PAS_LIRE_CLES,
  ],
  cloud: {
    probleme: 'Les fuites de données Azure viennent très souvent d’un compte de stockage exposé par erreur. Avant de chercher une faille complexe, on lit les réglages de base de chaque compte.',
    exemple: 'Un compte de laboratoire a été créé avec l’accès anonyme aux blobs autorisé « pour tester ». L’inventaire le met en tête de liste, sans qu’aucune clé n’ait été lue.',
    lit: ['Les propriétés de gestion des comptes de stockage : type, redondance, accès public, HTTPS, TLS, pare-feu, accès par clé'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur les groupes de ressources lus'],
    licences: ['Aucune'],
    limites: [
      'Aucune clé, aucune chaîne de connexion et aucun jeton SAS : leurs commandes sont interdites dans ce catalogue.',
      'Aucun contenu n’est lu : le plan de données demanderait une clé ou un rôle de données.',
      'Certaines propriétés peuvent manquer selon la version du module : une valeur absente n’est jamais interprétée comme sûre.',
    ],
  },
});

// ===========================================================================
// 18. azure-stockage-exposition
// ===========================================================================
export const outilAzureStockageExposition = outilAzure({
  id: 'azure-stockage-exposition',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-stockage-exposition',
  title: 'Exposition et accès d’UN compte de stockage (conteneurs, réseau, protection)',
  summary: 'Pour un compte précis : niveau d’accès public de chaque conteneur (par le plan de gestion), règles réseau, accès par clé, et protection contre la suppression (conservation des blobs supprimés). Ne lit ni clé, ni jeton, ni contenu. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzStorageAccount'], facultatives: ['Get-AzRmStorageContainer', 'Get-AzStorageBlobServiceProperty'] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources', default: 'rg-lab', help: 'Nom exact, sans joker.' },
    { id: 'azCompte', label: 'Compte de stockage', default: 'stlabdemo001', help: '3 à 24 caractères, minuscules et chiffres. Un seul compte, sans joker.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azCompte', validerNomStockage(v.azCompte));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg).trim())],
    ['Compte', psB64(String(v.azCompte).trim())],
  ],
  corps: () => [
    "$compte = @(Invoke-KjemoLecture 'Compte' 'Proprietes' { Get-AzStorageAccount -ResourceGroupName $KjemoArgRg -Name $KjemoArgCompte -ErrorAction Stop })",
    'if ($script:KjemoLectureOk -and $compte.Count -ne 1) {',
    "  [void](Add-KjemoResultat -Categorie 'Compte' -Controle 'Cible' -Etat 'PROBLEME' -Valeur ([string]$compte.Count + ' compte(s) retourne(s)') -Commentaire 'Cible ambigue ou absente : exactement UN compte est attendu.')",
    '} elseif ($script:KjemoLectureOk) {',
    '  $c = $compte[0]',
    "  $reseau = 'non fourni'",
    '  $nbIp = 0',
    '  $nbVnet = 0',
    '  if ($null -ne $c.NetworkRuleSet) {',
    '    $reseau = [string]$c.NetworkRuleSet.DefaultAction',
    '    $nbIp = @($c.NetworkRuleSet.IpRules).Count',
    '    $nbVnet = @($c.NetworkRuleSet.VirtualNetworkRules).Count',
    '  }',
    "  $etatR = 'INFO'",
    "  if ($reseau -eq 'Allow') { $etatR = 'ATTENTION' }",
    "  [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Action par defaut du pare-feu' -Etat $etatR -Valeur $reseau -Commentaire ('Regles IP : ' + [string]$nbIp + '. Regles de reseau virtuel : ' + [string]$nbVnet + '. Allow = accessible depuis tous les reseaux (l authentification reste requise).'))",
    '  $pa = $c.AllowBlobPublicAccess',
    "  $etatP = 'INFO'",
    "  $texteP = 'non fourni'",
    "  if ($pa -eq $true) { $etatP = 'ATTENTION'; $texteP = 'autorise au niveau du compte' }",
    "  elseif ($pa -eq $false) { $texteP = 'interdit au niveau du compte' }",
    "  [void](Add-KjemoResultat -Categorie 'Acces' -Controle 'Acces public aux blobs (compte)' -Etat $etatP -Valeur $texteP)",
    "  $cle = 'acces par cle possible (les cles ne sont PAS lues)'",
    "  if ($c.AllowSharedKeyAccess -eq $false) { $cle = 'acces par cle desactive' }",
    "  [void](Add-KjemoResultat -Categorie 'Acces' -Controle 'Acces par cle de compte' -Etat 'INFO' -Valeur $cle)",
    '',
    "  if ($null -ne (Get-Command -Name 'Get-AzRmStorageContainer' -ErrorAction SilentlyContinue)) {",
    "    $conteneurs = @(Invoke-KjemoLecture 'Conteneurs' 'Niveau d acces par conteneur (plan de gestion)' { Get-AzRmStorageContainer -ResourceGroupName $KjemoArgRg -StorageAccountName $KjemoArgCompte -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk) {',
    "      [void](Add-KjemoResultat -Categorie 'Conteneurs' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$conteneurs.Count + ' conteneur(s)'))",
    '      foreach ($k in @($conteneurs | Sort-Object -Property Name)) {',
    '        $niveau = [string]$k.PublicAccess',
    "        if (-not $niveau) { $niveau = 'None' }",
    "        $etatK = 'INFO'",
    "        $noteK = ''",
    "        if ($niveau -ne 'None') {",
    "          $etatK = 'PROBLEME'",
    "          $noteK = 'LECTURE ANONYME : le contenu de ce conteneur est lisible SANS authentification par quiconque a l URL' + $(if ($pa -eq $false) { ' (le compte interdit pourtant l acces public : ce niveau est sans effet tant que l interdiction est active)' } else { '' }) + '.'",
    '        }',
    "        [void](Add-KjemoResultat -Categorie 'Conteneurs' -Controle ([string]$k.Name) -Etat $etatK -Valeur $niveau -Commentaire $noteK)",
    '      }',
    '    }',
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Conteneurs' -Controle 'Get-AzRmStorageContainer' -Etat 'ATTENTION' -Valeur 'absent' -Commentaire 'Les conteneurs ne sont pas lus : le rapport est incomplet, ne conclus pas a l absence d acces public.')",
    '  }',
    '',
    "  if ($null -ne (Get-Command -Name 'Get-AzStorageBlobServiceProperty' -ErrorAction SilentlyContinue)) {",
    "    $svc = @(Invoke-KjemoLecture 'Protection' 'Suppression recuperable des blobs' { Get-AzStorageBlobServiceProperty -ResourceGroupName $KjemoArgRg -StorageAccountName $KjemoArgCompte -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk -and $svc.Count -ge 1) {',
    '      $drp = $svc[0].DeleteRetentionPolicy',
    '      if ($null -ne $drp -and $drp.Enabled -eq $true) {',
    "        [void](Add-KjemoResultat -Categorie 'Protection' -Controle 'Suppression recuperable des blobs' -Etat 'INFO' -Valeur ('active (' + [string]$drp.Days + ' jours)') -Commentaire 'Un blob supprime reste recuperable pendant cette duree. Ce n est PAS une sauvegarde.')",
    '      } else {',
    "        [void](Add-KjemoResultat -Categorie 'Protection' -Controle 'Suppression recuperable des blobs' -Etat 'ATTENTION' -Valeur 'non active ou non fournie' -Commentaire 'Un blob supprime par erreur serait perdu. Ce reglage se decide dans le portail, hors de cet assistant.')",
    '      }',
    '    }',
    '  }',
    "  [void](Add-KjemoResultat -Categorie 'Limites' -Controle 'Ce que ce rapport ne dit pas' -Etat 'INFO' -Valeur 'plan de gestion seulement' -Commentaire 'Aucune cle, aucun jeton, aucun contenu n est lu. Les jetons SAS deja emis ne sont pas listables ici et peuvent encore etre valides : le seul moyen general de les invalider est de renouveler la cle qui les a signes (decision humaine, hors du Toolkit).')",
    '}',
  ],
  gui: [
    'Compte de stockage > Stockage de données > Conteneurs : le « Niveau d’accès public » de chaque conteneur (Privé, Blob, Conteneur).',
    'Compte de stockage > Sécurité + mise en réseau > Mise en réseau : pare-feu, réseaux virtuels et points de terminaison privés.',
    'Compte de stockage > Gestion des données > Protection des données : suppression récupérable, versioning, sauvegarde.',
    'Compte de stockage > Contrôle d’accès (IAM) : qui a un rôle de données (Storage Blob Data …) sur ce compte.',
  ],
  keywords: ['exposition stockage', 'conteneur public', 'acces anonyme', 'niveau d acces public', 'get-azrmstoragecontainer', 'storage blob', 'pare-feu stockage', 'suppression recuperable', 'soft delete', 'fuite de donnees', 'sas', 'cle de compte'],
  prereqs: ['Rôle Lecteur (Reader) sur le compte. Aucun rôle de données n’est nécessaire : aucun contenu n’est lu.'],
  commonErrors: [
    {
      message: 'Un conteneur « LECTURE ANONYME » alors que le compte l’interdit',
      cause: 'Le niveau d’accès du conteneur est configuré, mais l’interdiction au niveau du compte le rend sans effet.',
      fix: 'Le rapport le dit. Si l’interdiction du compte est un jour levée, ce conteneur redeviendrait public : à corriger dans le portail avant.',
    },
    {
      message: 'Impossible de dire si des jetons SAS circulent',
      cause: 'Les jetons SAS déjà émis ne sont pas listables : ils ne sont pas stockés côté Azure.',
      fix: 'Ne les cherche pas dans ce script. Un jeton compromis se traite en renouvelant la clé de signature, ce qui est une décision humaine avec des conséquences, hors de ce lot.',
    },
  ],
  verifyAfter: [
    'Compare la liste des conteneurs et leur niveau d’accès avec la page Conteneurs du portail.',
    'Pour un conteneur public voulu (site statique, par exemple), documente la raison : le rapport ne peut pas savoir si c’est voulu.',
    'Aucune ligne n’est INACCESSIBLE ; sinon l’exposition n’est pas établie.',
  ],
  rollback: rollbackLecture('# Les conteneurs d’un compte, par le plan de gestion (sans clé)\nGet-AzRmStorageContainer -ResourceGroupName \'rg-lab\' -StorageAccountName \'stlabdemo001\' | Select-Object Name, PublicAccess'),
  checks: CHECKS_STOCKAGE,
  source: doc('powershell/module/az.storage/get-azrmstoragecontainer'),
  sources: [
    { label: 'Get-AzRmStorageContainer', url: doc('powershell/module/az.storage/get-azrmstoragecontainer') },
    { label: 'Get-AzStorageBlobServiceProperty', url: doc('powershell/module/az.storage/get-azstorageblobserviceproperty') },
    { label: 'Aperçu de la sécurité du stockage Azure', url: doc('azure/storage/blobs/security-recommendations') },
    SRC_NE_PAS_LIRE_CLES,
  ],
  cloud: {
    probleme: 'Savoir précisément quels conteneurs d’un compte sont lisibles sans authentification, qui peut atteindre le compte par le réseau, et si une suppression accidentelle est récupérable.',
    exemple: 'Un étudiant a publié un conteneur « partage » avec lecture anonyme pour l’envoyer à un collègue. Le rapport le classe PROBLEME ; la correction (jeton à durée limitée, partage authentifié) est une décision humaine.',
    lit: ['Propriétés réseau et d’accès du compte', 'Le niveau d’accès public de chaque conteneur (plan de gestion)', 'La suppression récupérable des blobs'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur le compte de stockage'],
    licences: ['Aucune'],
    limites: [
      'Aucune clé, aucun jeton SAS, aucun contenu : ils ne sont ni lus ni générés.',
      'Les jetons SAS déjà émis ne se listent pas : leur validité ne peut pas être établie ici.',
      'Les rôles de données (Storage Blob Data …) ne sont pas lus : voir l’assistant RBAC pour les affectations au niveau du compte.',
    ],
  },
});

// ===========================================================================
// 19. azure-sauvegarde-coffres
// ===========================================================================
export const outilAzureSauvegardeCoffres = outilAzure({
  id: 'azure-sauvegarde-coffres',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-sauvegarde-coffres',
  title: 'Coffres Recovery Services et état des sauvegardes de machines virtuelles',
  summary: 'Liste les coffres, les machines virtuelles protégées (état de protection, dernière sauvegarde, stratégie) et les machines sans protection. Signale les sauvegardes en échec ou anciennes. Ne dit JAMAIS « sauvegardes OK » : une sauvegarde déclarée ne prouve pas qu’une restauration a été testée. Lecture seule.',
  portee: 'az',
  commandes: {
    obligatoires: ['Get-AzRecoveryServicesVault', 'Get-AzRecoveryServicesBackupItem'],
    facultatives: ['Get-AzVM'],
  },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources des coffres (facultatif)', default: '', help: 'Vide = tous les coffres de l’abonnement. Nom exact, sans joker.' },
    { id: 'azJours', label: 'Ancienneté maximale acceptée de la dernière sauvegarde (jours)', type: 'number', default: '2', min: 1, max: 30, help: 'Au-delà, la machine est signalée. Entre 1 et 30.' },
    { id: 'azLimite', label: 'Nombre maximal de machines protégées détaillées par coffre', type: 'number', default: '100', min: 1, max: 500, help: 'Entre 1 et 500.' },
  ],
  verifier(v, errors) {
    if (String(v.azRg ?? '').trim()) verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azJours', validerBorne(v.azJours, 1, 30, 'L’ancienneté'));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 500, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg ?? '').trim())],
    ['Jours', psB64(String(validerBorne(v.azJours, 1, 30).value))],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 500).value))],
  ],
  corps: () => [
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Sauvegarde declaree n est pas restauration testee' -Etat 'INFO' -Valeur 'une sauvegarde reussie ne prouve pas qu elle se restaure' -Commentaire 'Seule une restauration reussie ET verifiee (donnees relues, machine demarree) le prouve. Ce rapport ne la teste pas.')",
    "$coffres = @(Invoke-KjemoLecture 'Coffres' 'Liste des coffres Recovery Services' {",
    '  if ($KjemoArgRg) { Get-AzRecoveryServicesVault -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzRecoveryServicesVault -ErrorAction Stop }',
    '})',
    'if ($script:KjemoLectureOk) {',
    "  [void](Add-KjemoResultat -Categorie 'Coffres' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$coffres.Count + ' coffre(s)'))",
    '  if ($coffres.Count -eq 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Coffres' -Controle 'Resultat' -Etat 'ATTENTION' -Valeur 'aucun coffre lu' -Commentaire 'Aucun coffre visible avec tes droits dans ce perimetre : les machines ne sont probablement PAS sauvegardees, ou tu ne vois pas leur coffre.')",
    '  }',
    '  $protegeIds = @{}',
    '  $comparable = $true',
    '  $seuil = (Get-Date).AddDays(-1 * [int]$KjemoArgJours)',
    '  foreach ($cf in @($coffres | Sort-Object -Property Name)) {',
    "    [void](Add-KjemoResultat -Categorie 'Coffres' -Controle ([string]$cf.Name) -Etat 'INFO' -Valeur ([string]$cf.Location) -Commentaire ('Groupe : ' + [string]$cf.ResourceGroupName))",
    "    $items = @(Invoke-KjemoLecture 'Sauvegardes' ('Machines protegees du coffre ' + [string]$cf.Name) { Get-AzRecoveryServicesBackupItem -BackupManagementType AzureVM -WorkloadType AzureVM -VaultId $cf.ID -ErrorAction Stop })",
    '    if (-not $script:KjemoLectureOk) { $comparable = $false; continue }',
    "    [void](Add-KjemoResultat -Categorie 'Sauvegardes' -Controle ([string]$cf.Name) -Etat 'INFO' -Valeur ([string]$items.Count + ' machine(s) protegee(s)'))",
    '    foreach ($it in @($items | Select-Object -First ([int]$KjemoArgLimite))) {',
    '      if ($null -ne $it.VirtualMachineId) { $protegeIds[([string]$it.VirtualMachineId).ToLowerInvariant()] = $true } else { $comparable = $false }',
    "      $etat = 'INFO'",
    '      $constats = @()',
    "      $dernier = [string]$it.LastBackupStatus",
    "      if ($dernier -ne 'Completed') { $etat = 'ATTENTION'; $constats += 'derniere sauvegarde : ' + $(if ($dernier) { $dernier } else { 'etat non fourni' }) }",
    '      if ($null -ne $it.LastBackupTime) {',
    '        if ([datetime]$it.LastBackupTime -lt $seuil) { $etat = \'ATTENTION\'; $constats += \'derniere sauvegarde ANCIENNE : \' + ([datetime]$it.LastBackupTime).ToString(\'s\') }',
    "        else { $constats += 'derniere sauvegarde : ' + ([datetime]$it.LastBackupTime).ToString('s') }",
    '      } else {',
    "        $etat = 'ATTENTION'; $constats += 'date de derniere sauvegarde non fournie'",
    '      }',
    "      $protection = [string]$it.ProtectionState",
    "      if ($protection -and $protection -ne 'Protected' -and $protection -ne 'IRPending') { $etat = 'ATTENTION'; $constats += 'protection : ' + $protection }",
    "      if ($it.ProtectionPolicyName) { $constats += 'strategie : ' + [string]$it.ProtectionPolicyName }",
    "      [void](Add-KjemoResultat -Categorie 'Sauvegardes' -Controle ([string]$it.Name) -Etat $etat -Valeur $(if ($protection) { $protection } else { 'etat non fourni' }) -Commentaire ($constats -join ' ; '))",
    '    }',
    '  }',
    "  if ($null -ne (Get-Command -Name 'Get-AzVM' -ErrorAction SilentlyContinue)) {",
    "    $vms = @(Invoke-KjemoLecture 'Machines non protegees' 'Machines virtuelles de l abonnement' { if ($KjemoArgRg) { Get-AzVM -ErrorAction Stop } else { Get-AzVM -ErrorAction Stop } })",
    '    if ($script:KjemoLectureOk -and $comparable -and $coffres.Count -gt 0) {',
    '      $sans = 0',
    '      foreach ($vm in $vms) {',
    '        if (-not $protegeIds.ContainsKey(([string]$vm.Id).ToLowerInvariant())) {',
    '          $sans = $sans + 1',
    "          [void](Add-KjemoResultat -Categorie 'Machines non protegees' -Controle ([string]$vm.Name) -Etat 'ATTENTION' -Valeur 'aucune protection trouvee dans les coffres lus' -Commentaire 'Peut etre voulu (machine jetable de laboratoire) ou un oubli. Le rapport ne peut pas le savoir.')",
    '        }',
    '      }',
    "      [void](Add-KjemoResultat -Categorie 'Machines non protegees' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$sans + ' machine(s) sans protection trouvee'))",
    '    } elseif ($coffres.Count -gt 0) {',
    "      [void](Add-KjemoResultat -Categorie 'Machines non protegees' -Controle 'Comparaison' -Etat 'ATTENTION' -Valeur 'impossible' -Commentaire 'Un coffre est illisible ou l identifiant de machine n est pas fourni par la commande : la liste des machines SANS protection n est pas etablie.')",
    '    }',
    '  }',
    "  [void](Add-KjemoResultat -Categorie 'Limites' -Controle 'Restauration' -Etat 'ATTENTION' -Valeur 'AUCUNE restauration testee par ce rapport' -Commentaire 'Planifie un test de restauration vers une cible de laboratoire distincte (assistant de restauration) et verifie les donnees : c est la seule preuve.')",
    '}',
  ],
  gui: [
    'Portail Azure > Centre de sauvegarde > Éléments de sauvegarde : la liste des éléments protégés avec l’état de la dernière sauvegarde.',
    'Coffre Recovery Services > Tâches de sauvegarde : les tâches terminées, en échec ou en cours.',
    'Coffre Recovery Services > Stratégies de sauvegarde : fréquence et durée de rétention.',
    'Une machine > Sauvegarde : la machine est-elle protégée, par quel coffre, avec quelle stratégie ?',
  ],
  keywords: ['sauvegarde', 'backup', 'coffre', 'recovery services', 'vault', 'get-azrecoveryservicesvault', 'sauvegarde vm', 'derniere sauvegarde', 'sauvegarde en echec', 'vm non sauvegardee', 'restauration testee', 'rpo', 'azure backup'],
  prereqs: ['Rôle Lecteur de sauvegarde (Backup Reader) ou Lecteur (Reader) sur les coffres. Le module Az.RecoveryServices est nécessaire.'],
  commonErrors: [
    {
      message: 'Une machine est « sans protection » alors qu’elle est sauvegardée',
      cause: 'Elle est protégée par un coffre que tu ne vois pas, ou la commande n’a pas fourni l’identifiant de machine.',
      fix: 'Compare avec la page Sauvegarde de la machine dans le portail. Le rapport le dit quand la comparaison n’est pas fiable.',
    },
    {
      message: 'La dernière sauvegarde est « Completed » mais la restauration échoue',
      cause: 'Une sauvegarde terminée ne garantit ni l’intégrité des données ni la restaurabilité.',
      fix: 'C’est exactement pourquoi un test de restauration régulier est nécessaire : voir l’assistant de restauration vers une cible de laboratoire.',
    },
  ],
  verifyAfter: [
    'Compare une machine protégée avec la page Éléments de sauvegarde du portail : même état, même date.',
    'Pour chaque machine « ANCIENNE » ou en échec, ouvre la tâche de sauvegarde dans le portail pour lire l’erreur.',
    'Retiens que ce rapport ne teste aucune restauration : planifie-en une.',
  ],
  rollback: rollbackLecture('# Les machines protégées d’un coffre précis\n$cf = Get-AzRecoveryServicesVault -ResourceGroupName \'rg-lab\' -Name \'rsv-lab\'\nGet-AzRecoveryServicesBackupItem -BackupManagementType AzureVM -WorkloadType AzureVM -VaultId $cf.ID'),
  checks: CHECKS_LECTURE.concat([
    'Aucune protection n’est activée, arrêtée ni modifiée ; aucune sauvegarde n’est déclenchée.',
    'Aucune ligne n’annonce « sauvegardes OK » : l’état est un constat, et la restauration reste non testée.',
  ]),
  source: doc('powershell/module/az.recoveryservices/get-azrecoveryservicesbackupitem'),
  sources: [
    { label: 'Get-AzRecoveryServicesVault', url: doc('powershell/module/az.recoveryservices/get-azrecoveryservicesvault') },
    { label: 'Get-AzRecoveryServicesBackupItem', url: doc('powershell/module/az.recoveryservices/get-azrecoveryservicesbackupitem') },
    { label: 'Sauvegarde de machines virtuelles Azure : vue d’ensemble', url: doc('azure/backup/backup-azure-vms-introduction') },
    { label: 'Restaurer une machine virtuelle Azure', url: doc('azure/backup/backup-azure-arm-restore-vms') },
  ],
  cloud: {
    probleme: 'Savoir quelles machines sont protégées, quand a eu lieu la dernière sauvegarde, et surtout quelles machines ne le sont pas. Et ne jamais confondre « sauvegardé » et « restaurable ».',
    exemple: 'Une machine de laboratoire critique a une dernière sauvegarde vieille de neuf jours. Une autre n’a aucune protection. Le rapport signale les deux, et rappelle qu’aucune restauration n’a été testée.',
    lit: ['Les coffres Recovery Services', 'Les éléments de sauvegarde de machines virtuelles (état, dernière sauvegarde, stratégie)', 'La liste des machines virtuelles, pour repérer celles sans protection'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur de sauvegarde (Backup Reader) ou Lecteur sur les coffres', 'Lecteur sur les machines virtuelles pour la comparaison'],
    licences: ['Aucune pour la lecture'],
    limites: [
      'Aucune restauration n’est testée : un statut « Completed » ne prouve pas que les données se relisent.',
      'Seules les machines virtuelles Azure protégées par un coffre sont couvertes (pas les bases de données, les partages de fichiers ni les sauvegardes de serveurs locaux).',
      'Les propriétés exactes des éléments de sauvegarde peuvent varier avec la version du module : une valeur absente est signalée, jamais interprétée comme saine.',
    ],
  },
});

// ===========================================================================
// 20. azure-sauvegarde-restauration (action)
// ===========================================================================

/** Mots qui doivent figurer dans le nom du groupe de ressources CIBLE. */
export const MOTS_CIBLE_LABORATOIRE = ['lab', 'test', 'restore', 'restauration', 'sandbox', 'labo'];

export function cibleRestaurationAcceptable(nom) {
  const s = String(nom ?? '').toLowerCase();
  return MOTS_CIBLE_LABORATOIRE.some((m) => s.includes(m));
}

export const outilAzureSauvegardeRestauration = outilAzure({
  id: 'azure-sauvegarde-restauration',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-sauvegarde-restauration',
  title: 'Restaurer les disques d’une machine sauvegardée vers une cible de laboratoire distincte',
  summary: 'Restaure les DISQUES du dernier point de récupération d’UNE machine vers un groupe de ressources de laboratoire DISTINCT de la source, sans toucher à la machine d’origine. Par défaut, exécute la restauration avec -WhatIf (prévisualisation réelle). Agir exige le mode Appliquer et la phrase exacte. Une restauration lancée n’est pas une restauration vérifiée.',
  portee: 'az',
  action: true,
  risk: 'caution',
  commandes: {
    obligatoires: [
      'Get-AzRecoveryServicesVault',
      'Get-AzRecoveryServicesBackupContainer',
      'Get-AzRecoveryServicesBackupItem',
      'Get-AzRecoveryServicesBackupRecoveryPoint',
      'Restore-AzRecoveryServicesBackupItem',
      'Get-AzResourceGroup',
      'Get-AzStorageAccount',
    ],
    facultatives: [],
  },
  phrase: (v) => `RESTAURER ${String(v.azVm ?? '').trim()} VERS ${String(v.azRgCible ?? '').trim()}`,
  phraseAide: 'RESTAURER <machine> VERS <groupe cible>, par exemple : RESTAURER vm-lab-01 VERS rg-lab-restore',
  champs: [
    { id: 'azRgCoffre', label: 'Groupe de ressources du coffre', default: 'rg-lab', help: 'Nom exact, sans joker.' },
    { id: 'azCoffre', label: 'Coffre Recovery Services', default: 'rsv-lab', help: 'Nom exact du coffre qui protège la machine.' },
    { id: 'azRgVm', label: 'Groupe de ressources de la machine SOURCE', default: 'rg-lab', help: 'Sert à vérifier que la cible est distincte de la source.' },
    { id: 'azVm', label: 'Machine sauvegardée à restaurer', default: 'vm-lab-01', help: 'Nom exact d’UNE machine protégée, sans joker.' },
    { id: 'azRgCible', label: 'Groupe de ressources CIBLE (laboratoire)', default: 'rg-lab-restore', help: 'Doit exister, être DIFFÉRENT de la source, et contenir lab, test, restore, restauration, sandbox ou labo. Les disques restaurés y seront créés.' },
    { id: 'azStockage', label: 'Compte de stockage de transit', default: 'stlabrestore001', help: 'Compte de stockage de la MÊME région que le coffre, qui reçoit temporairement les fichiers de restauration. Nom exact.' },
    { id: 'azRgStockage', label: 'Groupe de ressources du compte de transit', default: 'rg-lab-restore', help: 'Nom exact.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azRgCoffre', validerGroupeRessources(v.azRgCoffre, 'Le groupe du coffre'));
    verif(errors, 'azCoffre', validerNomCoffre(v.azCoffre));
    verif(errors, 'azRgVm', validerGroupeRessources(v.azRgVm, 'Le groupe de la machine source'));
    verif(errors, 'azVm', validerNomVm(v.azVm));
    const cible = verif(errors, 'azRgCible', validerGroupeRessources(v.azRgCible, 'Le groupe cible'));
    verif(errors, 'azStockage', validerNomStockage(v.azStockage, 'Le compte de transit'));
    verif(errors, 'azRgStockage', validerGroupeRessources(v.azRgStockage, 'Le groupe du compte de transit'));
    if (cible.ok) {
      if (!errors.azRgVm && String(v.azRgVm).trim().toLowerCase() === cible.value.toLowerCase()) {
        errors.azRgCible = 'La cible doit être DISTINCTE du groupe de la machine source : on ne restaure jamais sur place.';
      } else if (!cibleRestaurationAcceptable(cible.value)) {
        errors.azRgCible = `Le groupe cible doit être un groupe de laboratoire : son nom doit contenir l’un de ces mots : ${MOTS_CIBLE_LABORATOIRE.join(', ')}.`;
      }
    }
  },
  parametres: (v) => [
    ['RgCoffre', psB64(String(v.azRgCoffre).trim())],
    ['Coffre', psB64(String(v.azCoffre).trim())],
    ['RgVm', psB64(String(v.azRgVm).trim())],
    ['Vm', psB64(String(v.azVm).trim())],
    ['RgCible', psB64(String(v.azRgCible).trim())],
    ['Stockage', psB64(String(v.azStockage).trim())],
    ['RgStockage', psB64(String(v.azRgStockage).trim())],
  ],
  corps: () => [
    ...LIGNES_NOM_DEPUIS_ID,
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Ce que fait cette restauration' -Etat 'INFO' -Valeur 'restaure les DISQUES dans un groupe de laboratoire' -Commentaire 'La machine d origine n est ni arretee ni modifiee. Aucune machine n est recreee : tu pourras attacher les disques restaures a une machine de test et verifier les donnees.')",
    "if ([string]::Equals($KjemoArgRgCible, $KjemoArgRgVm, [System.StringComparison]::OrdinalIgnoreCase)) {",
    "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Cible distincte' -Etat 'PROBLEME' -Valeur 'cible identique a la source' -Commentaire 'REFUS : on ne restaure jamais sur place. Aucune lecture, aucune action.')",
    '} else {',
    "  $coffre = @(Invoke-KjemoLecture 'Cible' 'Coffre' { Get-AzRecoveryServicesVault -ResourceGroupName $KjemoArgRgCoffre -Name $KjemoArgCoffre -ErrorAction Stop })",
    '  $okCoffre = ($script:KjemoLectureOk -and $coffre.Count -eq 1)',
    "  if ($script:KjemoLectureOk -and $coffre.Count -ne 1) { [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Coffre' -Etat 'PROBLEME' -Valeur ([string]$coffre.Count + ' coffre(s)') -Commentaire 'Cible ambigue ou absente : exactement UN coffre est attendu.') }",
    "  $rgCible = @(Invoke-KjemoLecture 'Cible' 'Groupe de ressources cible' { Get-AzResourceGroup -Name $KjemoArgRgCible -ErrorAction Stop })",
    '  $okRg = ($script:KjemoLectureOk -and $rgCible.Count -eq 1)',
    "  $stockage = @(Invoke-KjemoLecture 'Cible' 'Compte de stockage de transit' { Get-AzStorageAccount -ResourceGroupName $KjemoArgRgStockage -Name $KjemoArgStockage -ErrorAction Stop })",
    '  $okSto = ($script:KjemoLectureOk -and $stockage.Count -eq 1)',
    '  $okRegion = $false',
    '  if ($okCoffre -and $okSto) {',
    '    if ([string]::Equals(([string]$stockage[0].Location).Replace(\' \', \'\'), ([string]$coffre[0].Location).Replace(\' \', \'\'), [System.StringComparison]::OrdinalIgnoreCase)) {',
    '      $okRegion = $true',
    "      [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Region du compte de transit' -Etat 'OK' -Valeur ([string]$stockage[0].Location) -Commentaire 'Meme region que le coffre.')",
    '    } else {',
    "      [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Region du compte de transit' -Etat 'PROBLEME' -Valeur ('compte = ' + [string]$stockage[0].Location + ' / coffre = ' + [string]$coffre[0].Location) -Commentaire 'REFUS : le compte de transit doit etre dans la meme region que le coffre.')",
    '    }',
    '  }',
    '  $conteneur = $null',
    '  $item = $null',
    '  $point = $null',
    '  if ($okCoffre -and $okRg -and $okSto -and $okRegion) {',
    "    $conteneur = @(Invoke-KjemoLecture 'Source' 'Conteneur de sauvegarde de la machine' { Get-AzRecoveryServicesBackupContainer -ContainerType AzureVM -Status Registered -FriendlyName $KjemoArgVm -VaultId $coffre[0].ID -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk -and $conteneur.Count -eq 1) {',
    "      $item = @(Invoke-KjemoLecture 'Source' 'Element de sauvegarde' { Get-AzRecoveryServicesBackupItem -Container $conteneur[0] -WorkloadType AzureVM -VaultId $coffre[0].ID -ErrorAction Stop })",
    '      if ($script:KjemoLectureOk -and $item.Count -eq 1) {',
    '        $debut = (Get-Date).AddDays(-30).ToUniversalTime()',
    '        $fin = (Get-Date).ToUniversalTime()',
    "        $points = @(Invoke-KjemoLecture 'Source' 'Points de recuperation (30 jours)' { Get-AzRecoveryServicesBackupRecoveryPoint -Item $item[0] -StartDate $debut -EndDate $fin -VaultId $coffre[0].ID -ErrorAction Stop })",
    '        if ($script:KjemoLectureOk) {',
    '          $tries = @($points | Sort-Object -Property RecoveryPointTime -Descending)',
    "          [void](Add-KjemoResultat -Categorie 'Source' -Controle 'Points de recuperation' -Etat 'INFO' -Valeur ([string]$tries.Count + ' point(s) sur 30 jours'))",
    '          if ($tries.Count -gt 0) {',
    '            $point = $tries[0]',
    "            [void](Add-KjemoResultat -Categorie 'Source' -Controle 'Point retenu (le plus recent)' -Etat 'INFO' -Valeur (([datetime]$point.RecoveryPointTime).ToString('s')) -Commentaire ('Type : ' + [string]$point.RecoveryPointType))",
    '          } else {',
    "            [void](Add-KjemoResultat -Categorie 'Source' -Controle 'Points de recuperation' -Etat 'PROBLEME' -Valeur 'aucun point' -Commentaire 'REFUS : aucun point de recuperation sur 30 jours. Rien a restaurer.')",
    '          }',
    '        }',
    '      } elseif ($script:KjemoLectureOk) {',
    "        [void](Add-KjemoResultat -Categorie 'Source' -Controle 'Element de sauvegarde' -Etat 'PROBLEME' -Valeur ([string]$item.Count + ' element(s)') -Commentaire 'Cible ambigue ou absente : exactement UN element de sauvegarde est attendu.')",
    '      }',
    '    } elseif ($script:KjemoLectureOk) {',
    "      [void](Add-KjemoResultat -Categorie 'Source' -Controle 'Conteneur de sauvegarde' -Etat 'PROBLEME' -Valeur ([string]$conteneur.Count + ' conteneur(s)') -Commentaire 'La machine n est pas protegee par ce coffre, ou le nom est ambigu : exactement UN conteneur est attendu.')",
    '    }',
    '  }',
    '',
    '  if ($null -ne $point) {',
    "    $phrase = 'RESTAURER ' + $KjemoArgVm + ' VERS ' + $KjemoArgRgCible",
    "    $agir = ($KjemoMode -eq 'Appliquer' -and $KjemoConfirmation -ceq $phrase)",
    '    if ($agir) {',
    "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Restauration' -Etat 'ATTENTION' -Valeur 'restauration des disques demandee' -Commentaire 'Mode Appliquer et confirmation exacte. Des disques manages et des fichiers de transit sont crees : ils sont FACTURES tant qu ils existent.')",
    "      $job = @(Invoke-KjemoLecture 'Action' 'Restore-AzRecoveryServicesBackupItem' { Restore-AzRecoveryServicesBackupItem -VaultId $coffre[0].ID -VaultLocation $coffre[0].Location -RecoveryPoint $point -StorageAccountName $stockage[0].StorageAccountName -StorageAccountResourceGroupName $stockage[0].ResourceGroupName -TargetResourceGroupName $KjemoArgRgCible -ErrorAction Stop })",
    '      if ($script:KjemoLectureOk -and $job.Count -gt 0) {',
    "        [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Tache de restauration' -Etat 'INFO' -Valeur ([string]$job[0].Status) -Commentaire ('Operation : ' + [string]$job[0].Operation + '. La restauration est ASYNCHRONE : suis la tache dans le coffre (Taches de sauvegarde) jusqu a Completed.'))",
    '      }',
    "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Restauration verifiee ?' -Etat 'ATTENTION' -Valeur 'NON : seulement lancee' -Commentaire 'Une restauration lancee n est pas une restauration verifiee. Attends Completed, attache les disques a une machine de TEST, relis les donnees voulues.')",
    '    } else {',
    "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Previsualisation' -Etat 'INFO' -Valeur 'Restore-AzRecoveryServicesBackupItem -WhatIf execute, RIEN restaure' -Commentaire 'Pour restaurer : regenere le script en mode Appliquer avec la phrase de confirmation exacte.')",
    "      [void](Invoke-KjemoLecture 'Action' 'Restore-AzRecoveryServicesBackupItem -WhatIf' { Restore-AzRecoveryServicesBackupItem -VaultId $coffre[0].ID -VaultLocation $coffre[0].Location -RecoveryPoint $point -StorageAccountName $stockage[0].StorageAccountName -StorageAccountResourceGroupName $stockage[0].ResourceGroupName -TargetResourceGroupName $KjemoArgRgCible -WhatIf -ErrorAction Stop })",
    '    }',
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Restauration' -Etat 'ATTENTION' -Valeur 'aucune action' -Commentaire 'Un prerequis de la cible ou de la source n est pas rempli : voir les lignes REFUS ci-dessus. Rien n a ete lance.')",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Coffre Recovery Services > Éléments de sauvegarde > Machine virtuelle Azure > ta machine > Restaurer la machine virtuelle.',
    'Choisis « Restaurer des disques » (pas « Créer une machine virtuelle ») et un groupe de ressources de laboratoire distinct comme cible.',
    'Coffre > Tâches de sauvegarde : suis la tâche de restauration jusqu’à « Terminé ».',
    'Une machine de TEST > Disques > Attacher un disque existant : attache le disque restauré, puis vérifie les données.',
  ],
  keywords: ['restauration', 'restore', 'restaurer vm', 'restore-azrecoveryservicesbackupitem', 'point de recuperation', 'test de restauration', 'cible de laboratoire', 'whatif', 'recuperer une vm', 'sauvegarde azure', 'disques restaures'],
  prereqs: [
    'Rôle Contributeur de sauvegarde (Backup Contributor) sur le coffre, et un droit d’écriture sur le groupe de ressources cible et sur le compte de stockage de transit.',
    'Un groupe de ressources cible DISTINCT de la source et de laboratoire (son nom doit contenir lab, test, restore, restauration, sandbox ou labo), qui existe déjà.',
    'Un compte de stockage de transit, existant, dans la MÊME région que le coffre.',
  ],
  commonErrors: [
    {
      message: 'La cible est refusée',
      cause: 'Le groupe cible est identique à la source, ou son nom ne contient aucun des mots de laboratoire acceptés.',
      fix: 'Crée un groupe de laboratoire dédié (par exemple rg-lab-restore) : la règle est une convention de sécurité, pas une preuve, mais elle évite de restaurer par réflexe sur la production.',
    },
    {
      message: 'UserErrorStorageAccountNotInSameRegion (ou équivalent)',
      cause: 'Le compte de transit n’est pas dans la même région que le coffre.',
      fix: 'Utilise un compte de stockage de la région du coffre. Le script refuse d’agir si les régions diffèrent.',
    },
    {
      message: 'La restauration est « InProgress » très longtemps',
      cause: 'La restauration copie les disques ; la durée dépend de leur taille et de la charge du service.',
      fix: 'Suis la tâche dans le coffre. Le script ne boucle pas et n’attend pas : il ne tient donc pas ta console pendant des heures.',
    },
  ],
  reversible: true,
  verifyAfter: [
    'La tâche de restauration du coffre atteint « Completed » : tant qu’elle ne l’est pas, rien n’est restauré.',
    'Les disques restaurés apparaissent dans le groupe cible, et PAS dans le groupe de la machine source.',
    'Attache un disque restauré à une machine de TEST et vérifie que les données voulues y sont : c’est la seule preuve que la sauvegarde est restaurable.',
  ],
  rollback: {
    summary: 'Le retour arrière d’une restauration de disques est la suppression, par toi, des disques restaurés et des fichiers de transit — une décision ciblée, nommée, ressource par ressource. Le script ne supprime jamais rien.',
    diagnostic: '# Ce qui a ete cree dans le groupe cible\nGet-AzDisk -ResourceGroupName \'rg-lab-restore\' | Select-Object Name, DiskState, DiskSizeGB',
    command: '# Retour arriere CIBLE, un disque a la fois, apres l avoir identifie dans le portail.\n# Aucune suppression globale : retire un disque nomme, jamais tout un groupe.\n# Exemple (a lancer seulement apres verification du nom) :\n# Remove-AzDisk -ResourceGroupName \'rg-lab-restore\' -DiskName \'<nom-du-disque-restaure>\' -WhatIf\nWrite-Host \'Aucune suppression automatique : identifie les disques restaures dans le portail.\'',
    warning: 'Les disques restaurés et les fichiers de transit sont facturés tant qu’ils existent. Supprime-les nommément quand le test est terminé, jamais par une commande qui viserait tout le groupe.',
  },
  checks: [
    'Aucune connexion, aucun changement d’abonnement : le script lit le contexte et le compare.',
    'La cible doit être un groupe de ressources DISTINCT de la source et de laboratoire ; une cible identique est refusée avant toute lecture.',
    'Le mode par défaut exécute Restore-AzRecoveryServicesBackupItem avec -WhatIf : rien n’est restauré.',
    'La restauration réelle exige le mode Appliquer ET la phrase exacte « RESTAURER <machine> VERS <cible> ».',
    'La machine d’origine n’est ni arrêtée, ni modifiée, ni remplacée ; aucune machine n’est recréée.',
    'Le script n’attend pas la fin de la restauration et n’annonce jamais « restauration réussie » : seule une restauration vérifiée par une personne compte.',
    'Aucun secret, aucune clé de compte ni jeton SAS n’est lu ou affiché.',
  ],
  source: doc('powershell/module/az.recoveryservices/restore-azrecoveryservicesbackupitem'),
  sources: [
    { label: 'Restore-AzRecoveryServicesBackupItem', url: doc('powershell/module/az.recoveryservices/restore-azrecoveryservicesbackupitem') },
    { label: 'Get-AzRecoveryServicesBackupRecoveryPoint', url: doc('powershell/module/az.recoveryservices/get-azrecoveryservicesbackuprecoverypoint') },
    { label: 'Restaurer des disques de machine virtuelle Azure avec PowerShell', url: doc('azure/backup/backup-azure-vms-automation') },
    { label: 'Restaurer une machine virtuelle Azure', url: doc('azure/backup/backup-azure-arm-restore-vms') },
  ],
  cloud: {
    probleme: 'Une sauvegarde qu’on n’a jamais restaurée est une hypothèse. Cet assistant prépare un test de restauration prudent : les disques vont dans un groupe de laboratoire, la machine d’origine n’est pas touchée.',
    exemple: 'Chaque trimestre, l’équipe restaure les disques de « vm-lab-01 » dans « rg-lab-restore », les attache à une machine de test et vérifie que la base de données s’ouvre. Le rapport ne dit jamais que c’est réussi : c’est la personne qui le constate.',
    lit: ['Le coffre, la machine protégée, ses points de récupération des 30 derniers jours', 'Le groupe cible et le compte de transit'],
    ecrit: ['Mode Diagnostic : rien (prévisualisation -WhatIf)', 'Mode Appliquer avec confirmation : crée des disques managés dans le groupe cible et des fichiers de transit dans le compte de stockage'],
    facture: ['Les disques restaurés sont facturés tant qu’ils existent', 'Les fichiers de transit du compte de stockage sont facturés tant qu’ils existent', 'La restauration peut entraîner des frais de lecture de sauvegarde selon la configuration'],
    permissions: ['Contributeur de sauvegarde sur le coffre', 'Droit d’écriture sur le groupe cible et sur le compte de stockage de transit'],
    licences: ['Aucune licence ; l’usage de la sauvegarde est facturé à la consommation'],
    limites: [
      'Restaure les DISQUES, pas une machine complète : pas de nouvelle machine, pas de remplacement sur place.',
      'Seul le point le plus récent des 30 derniers jours est utilisé ; choisir un point plus ancien se fait dans le portail.',
      '-WhatIf est pris en charge par Restore-AzRecoveryServicesBackupItem : c’est une prévisualisation réelle de la commande, qui ne garantit pas que la restauration réussira.',
      'La règle de nom du groupe cible est une convention de sécurité, pas une preuve que le groupe est vraiment un laboratoire.',
    ],
  },
});

export const toolsAzureStockage = [
  outilAzureStockageInventaire,
  outilAzureStockageExposition,
  outilAzureSauvegardeCoffres,
  outilAzureSauvegardeRestauration,
];
