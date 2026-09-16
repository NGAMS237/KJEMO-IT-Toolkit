/**
 * outils-serveur.mjs — LOT 2 · KJEMO IT Toolkit
 * ---------------------------------------------
 * Catalogue Windows Server : diagnostic serveur, DHCP, DNS, serveur de
 * fichiers, routage et accès Internet.
 *
 * Ce module ne dépend que de trois modules sans dépendance — noyau.mjs,
 * validateurs.mjs et rapport-ps.mjs — pour qu'aucun import circulaire
 * n'existe avec generators.mjs, qui importe ce catalogue et le concatène au
 * sien.
 *
 * Trois règles gouvernent tout ce qui est produit ici :
 *
 *  1. DIAGNOSTIC PAR DÉFAUT. Un outil qui peut modifier la configuration
 *     commence en mode Diagnostic. Le mode Appliquer est un choix explicite,
 *     jamais une valeur par défaut.
 *
 *  2. RIEN DE DESTRUCTIF SANS CONFIRMATION. Aucun `-Confirm:$false`, aucun
 *     `-Force`. Une suppression demande confirmation, ou n'est pas automatisée
 *     du tout et reste documentée comme cas exceptionnel.
 *
 *  3. AUCUN SECRET. Aucun champ de mot de passe, aucune information
 *     d'identification dans un script ou dans un rapport.
 */

import { psB64, assertValid } from './noyau.mjs';
import {
  validateIPv4,
  validerIPv6,
  validerFqdn,
  validerNomHote,
  validerPrefixe,
  validerReseauCidr,
  validerPlageIp,
  validerScopeId,
  validerMac,
  validerClientId,
  validerCheminWindowsLocal,
  validerNomZoneDns,
  validerNomEnregistrement,
  validerTypeEnregistrement,
  validateShareName,
  validerProfondeur,
  validerDureeBail,
  validerFormatRapport,
  validerModeExecution,
  validerChoix,
  validerListeIPv4,
  validerEntier,
  ipDansReseau,
  adresseReseau,
  prefixeVersMasque,
} from './validateurs.mjs';
import {
  enteteScript,
  fonctionsRapport,
  blocExportRapport,
  blocParametres,
  blocModeDiagnostic,
  VERSION_OUTILS,
} from './rapport-ps.mjs';

export { VERSION_OUTILS };

// ---------------------------------------------------------------------------
// Éléments communs
// ---------------------------------------------------------------------------

/**
 * Systèmes visés. La règle est de ne déclarer que ce qui est documenté :
 * Windows Server 2025 apparaît, mais avec la mention honnête qu'il n'a pas été
 * éprouvé en laboratoire ici.
 */
export const OS_SERVEUR = [
  'Windows Server 2019 — modules intégrés',
  'Windows Server 2022 — modules intégrés',
  'Windows Server 2025 — cmdlets documentées identiques, non éprouvées en laboratoire par ce projet',
  'Windows PowerShell 5.1 — cible de référence, celle installée par défaut',
  'PowerShell 7 — utilisable, en important le module concerné avec -UseWindowsPowerShell si nécessaire',
];

/** Prérequis communs à tous les outils qui interrogent un serveur. */
export const PREREQS_SERVEUR = [
  'Session ouverte sur le serveur, ou session distante déjà établie.',
  'Aucun mot de passe n’est demandé ni stocké par ces scripts.',
  'Le script est un fichier texte : relis-le avant de l’exécuter.',
];

/** Erreurs fréquentes communes aux modules de rôle Windows Server. */
export const ERREURS_MODULE = [
  {
    message: 'Le terme « Get-DhcpServerv4Scope » n’est pas reconnu comme nom d’applet de commande',
    code: 'CommandNotFoundException',
    cause: 'Le module de gestion du rôle n’est pas installé sur cette machine : le rôle et ses outils d’administration sont deux choses distinctes.',
    fix: 'Installer les outils d’administration, puis rouvrir la console.',
    command: 'Get-WindowsFeature RSAT-DHCP | Format-Table Name,InstallState',
  },
  {
    message: 'Accès refusé (Access is denied)',
    code: '0x5',
    cause: 'La console PowerShell n’est pas élevée, ou le compte n’a pas les droits d’administration sur le rôle.',
    fix: 'Rouvrir PowerShell avec « Exécuter en tant qu’administrateur » et vérifier l’appartenance aux groupes requis.',
  },
  {
    message: 'Impossible de se connecter au serveur',
    cause: 'Le nom du serveur est incorrect, le service est arrêté, ou un pare-feu bloque la gestion à distance.',
    fix: 'Vérifier le nom, l’état du service et la connectivité avant de relancer.',
    command: 'Test-NetConnection -ComputerName <serveur> -Port 135',
  },
];

/** Sources officielles communes. */
export const SOURCE_PS = 'https://learn.microsoft.com/powershell/module/';

/**
 * Champ « mode » partagé par tous les outils modifiants.
 * Le défaut est Diagnostic : appliquer est une décision, pas un réflexe.
 */
export function champMode(aide = 'Diagnostic n’écrit rien. Appliquer effectue les modifications, après les contrôles.') {
  return {
    id: 'mode',
    label: 'Mode d’exécution',
    type: 'select',
    default: 'Diagnostic',
    options: [['Diagnostic', 'Diagnostic — n’écrit rien'], ['Appliquer', 'Appliquer — effectue les modifications']],
    help: aide,
  };
}

/** Champ « format de rapport » partagé par les outils de diagnostic. */
export function champFormat(id = 'reportFormat', formats = ['Console', 'JSON', 'HTML', 'CSV']) {
  return {
    id,
    label: 'Format du rapport',
    type: 'select',
    default: 'Console',
    options: formats.map((f) => [f, f === 'Console' ? 'Console seulement' : `Console + fichier ${f}`]),
    help: 'Les fichiers sont écrits sur le Bureau de la session. Aucun mot de passe ni identifiant n’y figure.',
  };
}

/** Raccourci : ajoute une erreur de validation si le validateur échoue. */
export function verifier(errors, champ, resultat) {
  if (!resultat.ok) errors[champ] = resultat.error;
  return resultat;
}

/** Enrobage commun d'un script : en-tête, fonctions, corps, rapport. */
export function assembler({ titre, outil, diagnostic, admin, parametres, corps, prefixeFichier, formats }) {
  return [
    enteteScript({ titre, outil, diagnostic, admin }),
    blocParametres(parametres),
    '',
    fonctionsRapport(),
    '',
    corps.join('\n'),
    blocExportRapport({ prefixeFichier, formats }),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// A. DIAGNOSTIC SERVEUR
// ---------------------------------------------------------------------------

/**
 * 1. server-health-report — état complet du serveur, sans rien modifier.
 *
 * Un diagnostic n'a de valeur que s'il conclut. Chaque contrôle porte donc un
 * état (OK, ATTENTION, PROBLEME) et, quand quelque chose cloche, une phrase qui
 * dit pourquoi cela compte — pas seulement la valeur brute.
 */
export const outilSanteServeur = {
  id: 'server-health-report',
  icon: '▤',
  category: 'Windows Server',
  subcategory: 'Diagnostic serveur',
  title: 'Diagnostic complet Windows Server',
  risk: 'diagnostic',
  summary: 'Dresse l’état complet d’un serveur : système, rôles, services, matériel, réseau, événements, pare-feu et certificats.',
  fields: [
    {
      id: 'healthEvents',
      label: 'Fenêtre des événements critiques (heures)',
      default: '24',
      help: 'Historique examiné dans les journaux Système et Application.',
    },
    {
      id: 'healthCertDays',
      label: 'Alerte certificats expirant dans (jours)',
      default: '30',
      help: 'Un certificat machine qui expire bientôt est signalé.',
    },
    champFormat(),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'healthEvents', validerEntier(v.healthEvents, 1, 720, 'La fenêtre d’événements'));
    verifier(errors, 'healthCertDays', validerEntier(v.healthCertDays, 1, 365, 'Le seuil des certificats'));
    verifier(errors, 'reportFormat', validerFormatRapport(v.reportFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const corps = [
      `$KjemoHeures = [int](${psB64(v.healthEvents)})`,
      `$KjemoJoursCert = [int](${psB64(v.healthCertDays)})`,
      `$KjemoFormat = ${psB64(v.reportFormat)}`,
      '',
      '# --- 1. Identité et durée de fonctionnement ------------------------------',
      '$os = $null',
      'try { $os = Get-CimInstance Win32_OperatingSystem } catch { }',
      '$cs = $null',
      'try { $cs = Get-CimInstance Win32_ComputerSystem } catch { }',
      '',
      "[void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Nom du serveur' -Etat 'INFO' -Valeur $env:COMPUTERNAME)",
      'if ($os) {',
      '  [void](Add-KjemoResultat -Categorie \'Systeme\' -Controle \'Version Windows\' -Etat \'INFO\' -Valeur ("$($os.Caption) - build $($os.BuildNumber)"))',
      '  [void](Add-KjemoResultat -Categorie \'Systeme\' -Controle \'Edition (code SKU)\' -Etat \'INFO\' -Valeur $os.OperatingSystemSKU)',
      '  $demarrage = $os.LastBootUpTime',
      '  $uptime = (Get-Date) - $demarrage',
      "  $etatUptime = 'OK'",
      "  $commentaireUptime = ''",
      '  if ($uptime.TotalDays -gt 90) {',
      "    $etatUptime = 'ATTENTION'",
      "    $commentaireUptime = 'Plus de 90 jours sans redemarrage : les mises a jour en attente ne sont probablement pas appliquees.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Systeme\' -Controle \'Duree de fonctionnement\' -Etat $etatUptime -Valeur ("{0} jour(s) {1} h - demarre le {2}" -f $uptime.Days, $uptime.Hours, $demarrage) -Commentaire $commentaireUptime)',
      '}',
      'if ($cs) {',
      "  $roleDomaine = 'Machine de groupe de travail'",
      '  if ($cs.PartOfDomain) { $roleDomaine = "Membre du domaine $($cs.Domain)" }',
      "  [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Domaine' -Etat 'INFO' -Valeur $roleDomaine)",
      '  $codeRole = [int]$cs.DomainRole',
      "  $libelleRole = 'Role inconnu'",
      '  switch ($codeRole) {',
      "    0 { $libelleRole = 'Poste de travail autonome' }",
      "    1 { $libelleRole = 'Poste de travail membre du domaine' }",
      "    2 { $libelleRole = 'Serveur autonome' }",
      "    3 { $libelleRole = 'Serveur membre du domaine' }",
      "    4 { $libelleRole = 'Controleur de domaine secondaire' }",
      "    5 { $libelleRole = 'Controleur de domaine principal' }",
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Role dans le domaine' -Etat 'INFO' -Valeur $libelleRole)",
      '}',
      '',
      '# --- 2. Roles et fonctionnalites -----------------------------------------',
      '$roles = $null',
      'try { $roles = Get-WindowsFeature | Where-Object { $_.Installed } } catch { }',
      'if ($null -eq $roles) {',
      "  [void](Add-KjemoResultat -Categorie 'Roles' -Controle 'Inventaire des roles' -Etat 'IGNORE' -Valeur 'Get-WindowsFeature indisponible' -Commentaire 'Ce cmdlet n''existe que sur Windows Server.')",
      '} else {',
      "  $principaux = $roles | Where-Object { $_.FeatureType -eq 'Role' } | Select-Object -ExpandProperty Name",
      '  [void](Add-KjemoResultat -Categorie \'Roles\' -Controle \'Roles installes\' -Etat \'INFO\' -Valeur ($principaux -join \', \') -Commentaire ("$(@($roles).Count) role(s) et fonctionnalite(s) installes."))',
      '}',
      '',
      '# --- 3. Services critiques ------------------------------------------------',
      "$servicesSuivis = @('DHCPServer','DNS','NTDS','LanmanServer','LanmanWorkstation','W32Time','RemoteAccess','Spooler','EventLog')",
      'foreach ($nom in $servicesSuivis) {',
      '  $svc = Get-Service -Name $nom -ErrorAction SilentlyContinue',
      '  if ($null -eq $svc) { continue }',
      "  $etatSvc = 'OK'",
      "  $commentaireSvc = ''",
      "  if ($svc.Status -ne 'Running' -and $svc.StartType -eq 'Automatic') {",
      "    $etatSvc = 'PROBLEME'",
      "    $commentaireSvc = 'Service automatique arrete : le role correspondant ne repond pas.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Services\' -Controle $svc.Name -Etat $etatSvc -Valeur ("$($svc.Status) / demarrage $($svc.StartType)") -Commentaire $commentaireSvc)',
      '}',
      '',
      '# --- 4. Processeur, memoire et disques ------------------------------------',
      'if ($cs) {',
      '  [void](Add-KjemoResultat -Categorie \'Materiel\' -Controle \'Processeur\' -Etat \'INFO\' -Valeur ("$($cs.NumberOfLogicalProcessors) processeur(s) logique(s)"))',
      '  $memGo = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)',
      '  $libreGo = 0',
      '  if ($os) { $libreGo = [math]::Round($os.FreePhysicalMemory / 1MB, 1) }',
      "  $etatMem = 'OK'",
      "  $commentaireMem = ''",
      '  if ($memGo -gt 0 -and ($libreGo / $memGo) -lt 0.1) {',
      "    $etatMem = 'ATTENTION'",
      "    $commentaireMem = 'Moins de 10 % de memoire libre.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Materiel\' -Controle \'Memoire\' -Etat $etatMem -Valeur ("$memGo Go installes, $libreGo Go libres") -Commentaire $commentaireMem)',
      '}',
      '$volumes = $null',
      'try { $volumes = Get-Volume | Where-Object { $_.DriveLetter } } catch { }',
      'if ($volumes) {',
      '  foreach ($vol in $volumes) {',
      '    if ($vol.Size -le 0) { continue }',
      '    $pourcent = [math]::Round(($vol.SizeRemaining / $vol.Size) * 100, 1)',
      "    $etatVol = 'OK'",
      "    $commentaireVol = ''",
      "    if ($pourcent -lt 10) { $etatVol = 'PROBLEME'; $commentaireVol = 'Moins de 10 % d''espace libre.' }",
      "    elseif ($pourcent -lt 20) { $etatVol = 'ATTENTION'; $commentaireVol = 'Moins de 20 % d''espace libre.' }",
      '    [void](Add-KjemoResultat -Categorie \'Disques\' -Controle ("Volume $($vol.DriveLetter):") -Etat $etatVol -Valeur ("{0} Go libres sur {1} Go ({2} %)" -f [math]::Round($vol.SizeRemaining/1GB,1), [math]::Round($vol.Size/1GB,1), $pourcent) -Commentaire $commentaireVol)',
      '  }',
      '}',
      '',
      '# --- 5. Reseau -------------------------------------------------------------',
      '$cartes = $null',
      "try { $cartes = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } } catch { }",
      'if ($cartes) {',
      '  foreach ($carte in $cartes) {',
      '    [void](Add-KjemoResultat -Categorie \'Reseau\' -Controle ("Carte $($carte.Name)") -Etat \'INFO\' -Valeur ("$($carte.Status) - $($carte.LinkSpeed) - $($carte.InterfaceDescription)"))',
      '  }',
      '}',
      '$confs = $null',
      'try { $confs = Get-NetIPConfiguration | Where-Object { $_.IPv4Address } } catch { }',
      'if ($confs) {',
      '  foreach ($conf in $confs) {',
      '    $adresses = ($conf.IPv4Address | ForEach-Object { "$($_.IPAddress)/$($_.PrefixLength)" }) -join \', \'',
      "    $passerelle = '(aucune)'",
      '    if ($conf.IPv4DefaultGateway) { $passerelle = ($conf.IPv4DefaultGateway | ForEach-Object { $_.NextHop }) -join \', \' }',
      "    $serveursDns = '(aucun)'",
      '    if ($conf.DNSServer) { $serveursDns = (($conf.DNSServer | Where-Object { $_.AddressFamily -eq 2 }).ServerAddresses) -join \', \' }',
      '    [void](Add-KjemoResultat -Categorie \'Reseau\' -Controle ("IP $($conf.InterfaceAlias)") -Etat \'INFO\' -Valeur ("Adresses : $adresses | Passerelle : $passerelle | DNS : $serveursDns"))',
      '  }',
      '}',
      '$passerelles = $null',
      "try { $passerelles = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue } catch { }",
      'if ($passerelles) {',
      '  $nbGw = @($passerelles).Count',
      "  $etatGw = 'OK'",
      "  $commentaireGw = ''",
      '  if ($nbGw -gt 1) {',
      "    $etatGw = 'ATTENTION'",
      "    $commentaireGw = 'Plusieurs passerelles par defaut : le routage devient imprevisible. Une seule carte doit porter la passerelle.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Reseau\' -Controle \'Passerelle(s) par defaut\' -Etat $etatGw -Valeur (($passerelles | ForEach-Object { "$($_.NextHop) via $($_.InterfaceAlias) (metrique $($_.RouteMetric))" }) -join \' ; \') -Commentaire $commentaireGw)',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Passerelle par defaut' -Etat 'ATTENTION' -Valeur 'aucune' -Commentaire 'Sans passerelle, le serveur ne sort pas de son reseau local.')",
      '}',
      '',
      '# --- 6. Pare-feu ------------------------------------------------------------',
      '$profils = $null',
      'try { $profils = Get-NetFirewallProfile } catch { }',
      'if ($profils) {',
      '  foreach ($profil in $profils) {',
      "    $etatFw = 'OK'",
      "    $commentaireFw = ''",
      '    if (-not $profil.Enabled) {',
      "      $etatFw = 'ATTENTION'",
      "      $commentaireFw = 'Profil desactive : la machine est exposee sur ce type de reseau.'",
      '    }',
      '    [void](Add-KjemoResultat -Categorie \'Pare-feu\' -Controle ("Profil $($profil.Name)") -Etat $etatFw -Valeur ("Active : $($profil.Enabled) - entrant : $($profil.DefaultInboundAction)") -Commentaire $commentaireFw)',
      '  }',
      '}',
      '',
      '# --- 7. Evenements critiques recents ---------------------------------------',
      '$depuis = (Get-Date).AddHours(-1 * $KjemoHeures)',
      '$evenements = @()',
      'try {',
      "  $evenements = @(Get-WinEvent -FilterHashtable @{ LogName = @('System','Application'); Level = @(1,2); StartTime = $depuis } -ErrorAction Stop)",
      '} catch { $evenements = @() }',
      'if (@($evenements).Count -eq 0) {',
      '  [void](Add-KjemoResultat -Categorie \'Evenements\' -Controle \'Erreurs et evenements critiques\' -Etat \'OK\' -Valeur ("aucun sur $KjemoHeures h"))',
      '} else {',
      '  $resume = $evenements | Group-Object ProviderName | Sort-Object Count -Descending | Select-Object -First 5',
      '  [void](Add-KjemoResultat -Categorie \'Evenements\' -Controle \'Erreurs et evenements critiques\' -Etat \'ATTENTION\' -Valeur (($resume | ForEach-Object { "$($_.Name) : $($_.Count)" }) -join \' ; \') -Commentaire ("$(@($evenements).Count) evenement(s) de niveau Erreur ou Critique sur $KjemoHeures h."))',
      '}',
      '',
      '# --- 8. Certificats machine proches de l\'\'expiration -----------------------',
      '$limite = (Get-Date).AddDays($KjemoJoursCert)',
      '$certs = @()',
      'try { $certs = @(Get-ChildItem Cert:\\LocalMachine\\My -ErrorAction Stop | Where-Object { $_.NotAfter -lt $limite }) } catch { $certs = @() }',
      'if (@($certs).Count -eq 0) {',
      '  [void](Add-KjemoResultat -Categorie \'Certificats\' -Controle \'Expiration proche\' -Etat \'OK\' -Valeur ("aucun certificat machine n\'\'expire dans les $KjemoJoursCert jours"))',
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Certificats\' -Controle \'Expiration proche\' -Etat \'ATTENTION\' -Valeur (($certs | ForEach-Object { "$($_.Subject) -> $($_.NotAfter.ToString(\'yyyy-MM-dd\'))" }) -join \' ; \') -Commentaire \'Renouveler avant expiration : un certificat expire coupe les services qui s\'\'appuient dessus.\')',
      '}',
      '',
      '# --- 9. Redemarrage en attente ---------------------------------------------',
      '$cles = @(',
      "  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending',",
      "  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired'",
      ')',
      '$attente = $false',
      'foreach ($cle in $cles) { if (Test-Path -LiteralPath $cle) { $attente = $true } }',
      'if ($attente) {',
      "  [void](Add-KjemoResultat -Categorie 'Maintenance' -Controle 'Redemarrage en attente' -Etat 'ATTENTION' -Valeur 'oui' -Commentaire 'Des mises a jour attendent un redemarrage pour etre reellement appliquees.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Maintenance' -Controle 'Redemarrage en attente' -Etat 'OK' -Valeur 'non')",
      '}',
    ];

    return assembler({
      titre: 'Diagnostic complet Windows Server - lecture seule',
      outil: 'server-health-report',
      diagnostic: true,
      admin: true,
      parametres: [
        ['FenetreEvenementsHeures', psB64(v.healthEvents)],
        ['SeuilCertificatsJours', psB64(v.healthCertDays)],
        ['FormatRapport', psB64(v.reportFormat)],
      ],
      corps,
      prefixeFichier: 'kjemo-sante-serveur',
    });
  },
  gui: [
    'Ouvrir le Gestionnaire de serveur : il résume rôles, services et alertes sur la page Tableau de bord.',
    'Observateur d’événements (eventvwr.msc) > Journaux Windows > Système et Application, filtrés sur Erreur et Critique.',
    'Moniteur de ressources (perfmon.exe /res) pour le processeur, la mémoire et les disques.',
    'Gestionnaire de certificats (certlm.msc) > Personnel > Certificats pour les dates d’expiration.',
    'Centre Réseau et partage, puis « Modifier les paramètres de la carte », pour l’adressage.',
  ],
  keywords: [
    'diagnostic serveur', 'sante serveur', 'etat du serveur', 'inventaire', 'roles installes',
    'services arretes', 'uptime', 'espace disque serveur', 'certificats expiration',
    'redemarrage en attente', 'rapport serveur', 'windows server',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu’administrateur : plusieurs contrôles (journaux, certificats machine, rôles) exigent l’élévation.',
    'Aucun module supplémentaire : tout est intégré à Windows Server.',
    'Le script est en lecture seule ; il peut être exécuté en production sans fenêtre de maintenance.',
  ]),
  commonErrors: [
    {
      message: 'Get-WindowsFeature : Le terme n’est pas reconnu',
      code: 'CommandNotFoundException',
      cause: 'Le script tourne sur Windows 10/11 et non sur Windows Server : ce cmdlet appartient au module ServerManager, absent des éditions client.',
      fix: 'Exécuter le diagnostic depuis le serveur. Le script signale l’absence et poursuit les autres contrôles.',
    },
    {
      message: 'Aucun événement correspondant n’a été trouvé',
      code: 'NoMatchingEventsFound',
      cause: 'Aucun événement Erreur ou Critique sur la fenêtre demandée. Ce n’est pas un échec du script.',
      fix: 'Élargir la fenêtre si un incident plus ancien est recherché.',
      command: 'Get-WinEvent -FilterHashtable @{ LogName = \'System\'; Level = @(1,2); StartTime = (Get-Date).AddDays(-7) }',
    },
    {
      message: 'Get-Volume : Accès refusé',
      cause: 'Console non élevée.',
      fix: 'Relancer PowerShell avec « Exécuter en tant qu’administrateur ».',
    },
  ],
  reversible: true,
  verifyAfter: [
    'Le tableau de la console liste chaque contrôle avec son état.',
    'La conclusion résume le nombre de points à examiner.',
    'Si un format fichier a été choisi, le chemin du rapport est affiché à la fin.',
    'Les lignes ATTENTION et PROBLEME sont reprises dans la section Avertissements.',
  ],
  rollback: {
    summary: 'Ce script ne modifie rien : il lit l’état du serveur et écrit, au plus, un fichier de rapport sur le Bureau. Il n’y a donc rien à annuler.',
    diagnostic: '# Vérifier ce que le script a produit : un fichier de rapport, rien d’autre.\nGet-ChildItem -Path (Join-Path $env:USERPROFILE \'Desktop\') -Filter \'kjemo-sante-serveur-*\' | Format-Table Name,Length,LastWriteTime',
    command: '# Aucune annulation nécessaire : aucune configuration n\'a été modifiée.\n# Le rapport peut être supprimé manuellement depuis le Bureau si tu n\'en as plus besoin.\nGet-ChildItem -Path (Join-Path $env:USERPROFILE \'Desktop\') -Filter \'kjemo-sante-serveur-*\' | Format-Table FullName',
    exceptional: '',
    warning: 'Le rapport contient l’inventaire du serveur. Il ne contient ni mot de passe ni identifiant, mais il décrit l’infrastructure : traite-le comme un document interne.',
  },
  checks: [
    'Aucun prérequis à vérifier avant : le script est en lecture seule.',
    'Choisir la fenêtre d’événements en fonction de l’incident recherché.',
    'Sur un serveur très chargé, la collecte des événements peut prendre une minute.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/servermanager/get-windowsfeature',
  sources: [
    { label: 'Get-WindowsFeature', url: 'https://learn.microsoft.com/powershell/module/servermanager/get-windowsfeature' },
    { label: 'Get-WinEvent', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent' },
    { label: 'Get-Volume', url: 'https://learn.microsoft.com/powershell/module/storage/get-volume' },
    { label: 'Get-NetIPConfiguration', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipconfiguration' },
    { label: 'Get-NetFirewallProfile', url: 'https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewallprofile' },
  ],
};

// ---------------------------------------------------------------------------
// B. DHCP
// ---------------------------------------------------------------------------

/**
 * 2. dhcp-install-authorize — installer le rôle DHCP et l'autoriser dans AD.
 *
 * Deux opérations distinctes que l'on confond souvent : installer le rôle rend
 * le service disponible ; l'autoriser dans Active Directory lui donne le droit
 * de répondre. Un serveur installé mais non autorisé se tait, et le symptôme
 * observé — « les clients n'ont pas d'adresse » — n'oriente pas vers la cause.
 */
export const outilDhcpInstallation = {
  id: 'dhcp-install-authorize',
  icon: '◈',
  category: 'Windows Server',
  subcategory: 'DHCP',
  title: 'Installer et autoriser un serveur DHCP',
  risk: 'caution',
  summary: 'Vérifie le rôle, les outils, l’appartenance au domaine et l’autorisation dans AD, puis installe et autorise ce qui manque.',
  fields: [
    { id: 'srvFqdn', label: 'Nom DNS complet du serveur', default: 'srv-dhcp.hopitalbn.lan', help: 'Nom pleinement qualifié, tel qu’il est inscrit dans le DNS.' },
    { id: 'srvIp', label: 'Adresse IPv4 du serveur', default: '192.168.30.254', help: 'Adresse sur laquelle le service DHCP répondra.' },
    { id: 'adDomain', label: 'Domaine Active Directory', default: 'hopitalbn.lan', help: 'Le domaine dans lequel le serveur doit être autorisé.' },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'srvFqdn', validerFqdn(v.srvFqdn));
    verifier(errors, 'srvIp', validateIPv4(v.srvIp));
    verifier(errors, 'adDomain', validerFqdn(v.adDomain));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Serveur = ${psB64(v.srvFqdn)}`,
      `$AdresseServeur = ${psB64(v.srvIp)}`,
      `$Domaine = ${psB64(v.adDomain)}`,
      "$KjemoFormat = 'Console'",
      "",
      '# --- 1. Le role DHCP est-il installe ? -----------------------------------',
      '$roleDhcp = $null',
      "try { $roleDhcp = Get-WindowsFeature -Name DHCP } catch { }",
      '$roleInstalle = $false',
      'if ($null -eq $roleDhcp) {',
      "  [void](Add-KjemoResultat -Categorie 'Role' -Controle 'Get-WindowsFeature' -Etat 'PROBLEME' -Valeur 'indisponible' -Commentaire 'Ce script doit etre execute sur Windows Server.')",
      '} else {',
      '  $roleInstalle = $roleDhcp.Installed',
      "  $etatRole = 'ATTENTION'",
      "  if ($roleInstalle) { $etatRole = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Role\' -Controle \'Role DHCP\' -Etat $etatRole -Valeur $roleDhcp.InstallState -Commentaire \'Le role fournit le service ; il ne suffit pas a repondre aux clients.\')',
      '}',
      "",
      '# --- 2. Les outils de gestion sont-ils presents ? ------------------------',
      '$outils = $null',
      'try { $outils = Get-WindowsFeature -Name RSAT-DHCP } catch { }',
      '$outilsInstalles = $false',
      'if ($outils) {',
      '  $outilsInstalles = $outils.Installed',
      "  $etatOutils = 'ATTENTION'",
      "  if ($outilsInstalles) { $etatOutils = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Role' -Controle 'Outils de gestion DHCP' -Etat $etatOutils -Valeur $outils.InstallState -Commentaire 'Sans eux, les cmdlets DhcpServer n''existent pas.')",
      '}',
      "",
      '# --- 3. Le serveur est-il membre du domaine ? ----------------------------',
      '$cs = $null',
      'try { $cs = Get-CimInstance Win32_ComputerSystem } catch { }',
      '$dansDomaine = $false',
      'if ($cs) {',
      '  $dansDomaine = [bool]$cs.PartOfDomain',
      "  $etatDom = 'PROBLEME'",
      "  $commentaireDom = 'Un serveur DHCP hors domaine ne peut pas etre autorise dans Active Directory.'",
      '  if ($dansDomaine) {',
      "    $etatDom = 'OK'",
      "    $commentaireDom = ''",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Domaine\' -Controle \'Appartenance au domaine\' -Etat $etatDom -Valeur ("PartOfDomain = $($cs.PartOfDomain) ; domaine = $($cs.Domain)") -Commentaire $commentaireDom)',
      '}',
      "",
      '# --- 4. Le serveur est-il deja autorise dans AD ? ------------------------',
      '$autorises = @()',
      'try { $autorises = @(Get-DhcpServerInDC) } catch { }',
      '$dejaAutorise = $false',
      'foreach ($entree in $autorises) {',
      '  if ($entree.DnsName -eq $Serveur -or $entree.IPAddress -eq $AdresseServeur) { $dejaAutorise = $true }',
      '}',
      'if (@($autorises).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Autorisation' -Controle 'Serveurs autorises dans AD' -Etat 'INFO' -Valeur 'aucun, ou interrogation impossible' -Commentaire 'Get-DhcpServerInDC exige les outils DHCP et un acces au domaine.')",
      '} else {',
      "  $etatAut = 'ATTENTION'",
      "  $commentaireAut = 'Ce serveur n''est pas encore autorise : il ne repondra pas aux clients.'",
      '  if ($dejaAutorise) {',
      "    $etatAut = 'OK'",
      "    $commentaireAut = 'Deja autorise : ne rien faire.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Autorisation\' -Controle \'Serveurs autorises dans AD\' -Etat $etatAut -Valeur (($autorises | ForEach-Object { "$($_.DnsName) / $($_.IPAddress)" }) -join \' ; \') -Commentaire $commentaireAut)',
      '}',
      "",
      '# --- 5. Etat du service ---------------------------------------------------',
      '$service = $null',
      'try { $service = Get-Service -Name DHCPServer -ErrorAction SilentlyContinue } catch { }',
      'if ($service) {',
      "  $etatSvc = 'ATTENTION'",
      "  if ($service.Status -eq 'Running') { $etatSvc = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Service\' -Controle \'DHCPServer\' -Etat $etatSvc -Valeur ("$($service.Status) / demarrage $($service.StartType)"))',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Service' -Controle 'DHCPServer' -Etat 'INFO' -Valeur 'service absent' -Commentaire 'Normal tant que le role n''est pas installe.')",
      '}',
      "",
      '# --- 6. Actions, uniquement en mode Appliquer -----------------------------',
      "if ($Mode -eq 'Appliquer') {",
      "",
      "  # 6a. Installer le role seulement s'il manque. Idempotent : rien a faire sinon.",
      '  if (-not $roleInstalle -or -not $outilsInstalles) {',
      "    Write-Host 'Installation du role DHCP et de ses outils de gestion...'",
      '    $resultat = Install-WindowsFeature -Name DHCP -IncludeManagementTools',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Installation du role' -Etat 'INFO' -Valeur (\"Succes : $($resultat.Success) ; redemarrage requis : $($resultat.RestartNeeded)\") -Commentaire 'Un redemarrage peut etre necessaire avant l''autorisation.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Installation du role' -Etat 'OK' -Valeur 'deja installe' -Commentaire 'Aucune action : l''operation est idempotente.')",
      '  }',
      "",
      "  # 6b. Autoriser dans AD seulement si ce n'est pas deja fait.",
      '  if (-not $dejaAutorise) {',
      '    if (-not $dansDomaine) {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Autorisation dans AD' -Etat 'PROBLEME' -Valeur 'impossible' -Commentaire 'Le serveur n''est pas membre du domaine : joindre le domaine d''abord.')",
      '    } else {',
      '      Write-Host "Autorisation de $Serveur ($AdresseServeur) dans Active Directory..."',
      '      Add-DhcpServerInDC -DnsName $Serveur -IPAddress $AdresseServeur',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Autorisation dans AD' -Etat 'INFO' -Valeur 'demandee' -Commentaire 'Verifie le resultat ci-dessous.')",
      '    }',
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Autorisation dans AD' -Etat 'OK' -Valeur 'deja autorise' -Commentaire 'Aucune action.')",
      '  }',
      "",
      "  # 6c. Demarrer le service s'il est arrete.",
      '  $service = Get-Service -Name DHCPServer -ErrorAction SilentlyContinue',
      "  if ($service -and $service.Status -ne 'Running') {",
      '    Start-Service -Name DHCPServer',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Demarrage du service' -Etat 'INFO' -Valeur 'demande')",
      '  }',
      "",
      '  # 6d. Configuration finale, relue depuis le systeme.',
      "  Write-Host ''",
      "  Write-Host '--- Configuration finale ---'",
      '  try { Get-DhcpServerInDC | Format-Table DnsName,IPAddress -AutoSize } catch { Write-Host "Get-DhcpServerInDC : $($_.Exception.Message)" }',
      '  try { Get-Service DHCPServer | Format-Table Name,Status,StartType -AutoSize } catch { }',
      '  try { Get-DhcpServerVersion | Format-List } catch { }',
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Installer et autoriser un serveur DHCP',
      outil: 'dhcp-install-authorize',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Serveur', psB64(v.srvFqdn)],
        ['AdresseServeur', psB64(v.srvIp)],
        ['Domaine', psB64(v.adDomain)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-dhcp-installation',
      formats: 'Console',
    });
  },
  gui: [
    'Gestionnaire de serveur > Gérer > Ajouter des rôles et fonctionnalités > Serveur DHCP.',
    'Laisser cochée l’option qui ajoute les outils d’administration.',
    'À la fin de l’assistant, cliquer sur « Terminer la configuration DHCP ».',
    'Console DHCP (dhcpmgmt.msc) : clic droit sur le serveur > Autoriser.',
    'Vérifier que la flèche verte apparaît sur l’icône du serveur : elle signale un serveur autorisé.',
  ],
  keywords: [
    'dhcp', 'installer dhcp', 'autoriser dhcp', 'add-dhcpserverindc', 'serveur dhcp non autorise',
    'les clients n ont pas d adresse', 'apipa', '169.254', 'role dhcp', 'rsat-dhcp',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu’administrateur.',
    'Compte membre de « Admins du domaine » ou disposant du droit d’autoriser un serveur DHCP dans Active Directory.',
    'Le serveur doit être membre du domaine pour être autorisé.',
    'Adresse IPv4 fixe sur la carte qui servira les clients : un serveur DHCP ne doit pas être client DHCP.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'Add-DhcpServerInDC : Access is denied',
      code: '0x5',
      cause: 'Le compte n’a pas le droit d’écrire l’objet d’autorisation dans la partition de configuration d’Active Directory.',
      fix: 'Utiliser un compte membre de « Admins de l’entreprise » ou délégué pour cette opération.',
    },
    {
      message: 'Les clients reçoivent une adresse 169.254.x.x',
      cause: 'Aucun serveur DHCP ne répond : rôle non installé, serveur non autorisé, service arrêté, ou étendue inactive.',
      fix: 'Exécuter ce diagnostic, puis vérifier l’étendue avec l’outil « Diagnostiquer les baux DHCP ».',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Get-DhcpServerInDC affiche le serveur avec son nom DNS et son adresse.',
    'Get-Service DHCPServer indique Status = Running.',
    'Dans la console dhcpmgmt.msc, le serveur porte la flèche verte.',
    'Un client sur le réseau obtient une adresse de l’étendue attendue.',
  ],
  rollback: {
    summary: 'L’annulation retire l’autorisation du serveur dans Active Directory. Le rôle, lui, n’est pas désinstallé : une désinstallation supprime la base des baux et se prépare, elle ne s’improvise pas.',
    diagnostic: '# Constater ce qui est autorise avant de retirer quoi que ce soit.\nGet-DhcpServerInDC | Format-Table DnsName,IPAddress\nGet-Service DHCPServer | Format-Table Name,Status,StartType',
    command: '# Retirer UNIQUEMENT l\'autorisation. Le serveur cesse de repondre aux clients\n# des la prochaine sollicitation : previens avant de lancer cette commande.\n# -Confirm est explicite : PowerShell demandera une confirmation.\nRemove-DhcpServerInDC -DnsName \'<fqdn-du-serveur>\' -IPAddress \'<ip-du-serveur>\' -Confirm',
    exceptional: '# AVERTISSEMENT CRITIQUE — desinstallation du role DHCP.\n#\n# Desinstaller le role supprime la configuration des etendues et la base des\n# baux de ce serveur. Les clients conservent leur bail jusqu\'a expiration, puis\n# se retrouvent sans adresse. Cette operation n\'est PAS automatisee ici.\n#\n# Avant d\'envisager la desinstallation :\n#   1. Sauvegarder la configuration (outil « Sauvegarder la configuration DHCP »).\n#   2. Verifier qu\'un autre serveur DHCP prend le relais sur ce reseau.\n#   3. Prevenir les utilisateurs : les postes perdront leur adresse.\n#\n# Procedure officielle Microsoft :\n# https://learn.microsoft.com/powershell/module/servermanager/uninstall-windowsfeature\n#\n# La commande, a executer manuellement et en connaissance de cause :\n#   Uninstall-WindowsFeature -Name DHCP -Confirm',
    warning: 'Retirer l’autorisation d’un serveur DHCP en production coupe la distribution d’adresses. Les postes déjà servis gardent leur bail jusqu’à expiration, puis tombent en 169.254.x.x.',
  },
  checks: [
    'Confirmer le nom complet et l’adresse du serveur avant d’autoriser : une erreur inscrit un mauvais serveur dans Active Directory.',
    'Vérifier qu’aucun autre serveur DHCP ne sert déjà ce réseau.',
    'Le mode Diagnostic répond à la question « qu’est-ce qui manque ? » sans rien changer.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverindc',
  sources: [
    { label: 'Add-DhcpServerInDC', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverindc' },
    { label: 'Get-DhcpServerInDC', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverindc' },
    { label: 'Remove-DhcpServerInDC', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/remove-dhcpserverindc' },
    { label: 'Install-WindowsFeature', url: 'https://learn.microsoft.com/powershell/module/servermanager/install-windowsfeature' },
    { label: 'DHCP — documentation Windows Server', url: 'https://learn.microsoft.com/windows-server/networking/technologies/dhcp/dhcp-top' },
  ],
};

/**
 * 3. dhcp-scope-options — créer une étendue et poser ses options.
 *
 * La plupart des pannes DHCP en laboratoire ne viennent pas de la commande mais
 * de la saisie : une plage inversée, une passerelle hors réseau, ou l'adresse du
 * serveur lui-même distribuée aux clients. Tout cela est refusé ici, AVANT de
 * produire le script.
 */
export const outilDhcpEtendue = {
  id: 'dhcp-scope-options',
  icon: '\u25a6',
  category: 'Windows Server',
  subcategory: 'DHCP',
  title: 'Créer une étendue et configurer ses options DHCP',
  risk: 'caution',
  summary: 'Valide le plan d\u2019adressage, crée l\u2019étendue de façon idempotente, pose les exclusions et les options passerelle, DNS et domaine.',
  fields: [
    { id: 'scopeName', label: 'Nom de l\u2019étendue', default: 'LAN-Hopital-30', help: 'Nom affiché dans la console DHCP.' },
    { id: 'scopeCidr', label: 'Réseau et préfixe', default: '192.168.30.0/24', help: 'Adresse de réseau en notation CIDR. Exemple de laboratoire, à adapter.' },
    { id: 'scopeStart', label: 'Première adresse distribuée', default: '192.168.30.1' },
    { id: 'scopeEnd', label: 'Dernière adresse distribuée', default: '192.168.30.244' },
    { id: 'scopeExclStart', label: 'Début d\u2019exclusion (facultatif)', default: '192.168.30.240', help: 'Laisser vide s\u2019il n\u2019y a rien à exclure.' },
    { id: 'scopeExclEnd', label: 'Fin d\u2019exclusion (facultatif)', default: '192.168.30.244' },
    { id: 'scopeLease', label: 'Durée du bail (heures)', default: '8', help: 'Bail court en laboratoire, plus long en production.' },
    { id: 'scopeGateway', label: 'Passerelle distribuée (option 3)', default: '192.168.30.254' },
    { id: 'scopeDns', label: 'Serveurs DNS distribués (option 6)', default: '192.168.30.254, 192.168.30.253', help: 'Une à trois adresses, séparées par des virgules.' },
    { id: 'scopeDnsDomain', label: 'Domaine DNS distribué (option 15)', default: 'hopitalbn.lan' },
    {
      id: 'scopeState', label: 'État de l\u2019étendue', type: 'select', default: 'Inactive',
      options: [['Inactive', 'Inactive — créée mais ne distribue pas encore'], ['Active', 'Active — distribue immédiatement']],
      help: 'Créer inactive puis activer après vérification évite de servir un plan d\u2019adressage erroné.',
    },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    const nom = String(v.scopeName ?? '').trim();
    if (!nom) errors.scopeName = 'Le nom de l\u2019étendue ne peut pas être vide.';
    else if (nom.length > 255) errors.scopeName = 'Le nom de l\u2019étendue ne doit pas dépasser 255 caractères.';
    else if (/[\x00-\x1f\x7f]/.test(nom)) errors.scopeName = 'Le nom contient un caractère de contrôle non autorisé.';

    const cidr = verifier(errors, 'scopeCidr', validerReseauCidr(v.scopeCidr));
    verifier(errors, 'scopeLease', validerDureeBail(v.scopeLease));

    if (cidr.ok) {
      const { reseau, prefixe } = cidr.value;

      const plage = validerPlageIp(v.scopeStart, v.scopeEnd, reseau, prefixe);
      if (!plage.ok) {
        // L'erreur est rattachée au champ concerné pour être affichée au bon endroit.
        if (/Première adresse|inversée|réseau /.test(plage.error)) errors.scopeStart = plage.error;
        else errors.scopeEnd = plage.error;
      }

      const gw = verifier(errors, 'scopeGateway', validateIPv4(v.scopeGateway));
      if (gw.ok) {
        if (!ipDansReseau(gw.value, reseau, prefixe)) {
          errors.scopeGateway = `${gw.value} n\u2019appartient pas au réseau ${reseau}/${prefixe} : les clients ne pourraient pas la joindre.`;
        } else if (plage.ok) {
          const dansPlage = (ip) => {
            const n = ip.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
            const d = plage.value.debut.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
            const f = plage.value.fin.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
            return n >= d && n <= f;
          };
          if (dansPlage(gw.value)) {
            errors.scopeGateway = `La passerelle ${gw.value} est comprise dans la plage distribuée : elle serait attribuée à un client. Réduis la plage ou exclus cette adresse.`;
          }
        }
      }

      const dns = verifier(errors, 'scopeDns', validerListeIPv4(v.scopeDns, { min: 1, max: 3, label: 'La liste des serveurs DNS' }));
      if (dns.ok && plage.ok) {
        const dansPlage = (ip) => {
          const n = ip.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
          const d = plage.value.debut.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
          const f = plage.value.fin.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
          return n >= d && n <= f;
        };
        const conflit = dns.value.filter((ip) => ipDansReseau(ip, reseau, prefixe) && dansPlage(ip));
        if (conflit.length) {
          errors.scopeDns = `${conflit.join(', ')} est dans la plage distribuée : un serveur DNS ne doit pas recevoir une adresse du pool. Exclus cette adresse ou réduis la plage.`;
        }
      }

      // Exclusion : les deux champs vont ensemble, et restent dans la plage.
      const dStr = String(v.scopeExclStart ?? '').trim();
      const fStr = String(v.scopeExclEnd ?? '').trim();
      if (dStr || fStr) {
        if (!dStr) errors.scopeExclStart = 'Indique le début de l\u2019exclusion, ou vide les deux champs.';
        else if (!fStr) errors.scopeExclEnd = 'Indique la fin de l\u2019exclusion, ou vide les deux champs.';
        else {
          const excl = validerPlageIp(dStr, fStr, reseau, prefixe);
          if (!excl.ok) errors.scopeExclStart = excl.error;
          else if (plage.ok) {
            const n = (ip) => ip.split('.').reduce((a, o) => (a * 256) + Number(o), 0);
            if (n(excl.value.debut) < n(plage.value.debut) || n(excl.value.fin) > n(plage.value.fin)) {
              errors.scopeExclStart = 'L\u2019exclusion doit être comprise dans la plage distribuée, sinon elle n\u2019exclut rien.';
            }
          }
        }
      }
    }

    verifier(errors, 'scopeDnsDomain', validerFqdn(v.scopeDnsDomain));
    verifier(errors, 'scopeState', validerChoix(v.scopeState, ['Inactive', 'Active'], 'L\u2019état de l\u2019étendue'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cidr = validerReseauCidr(v.scopeCidr).value;
    const dns = validerListeIPv4(v.scopeDns, { min: 1, max: 3 }).value;
    const avecExclusion = String(v.scopeExclStart ?? '').trim() !== '' && String(v.scopeExclEnd ?? '').trim() !== '';

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$NomEtendue = ${psB64(v.scopeName)}`,
      `$ScopeId = ${psB64(cidr.reseau)}`,
      `$Masque = ${psB64(cidr.masque)}`,
      `$Debut = ${psB64(v.scopeStart)}`,
      `$Fin = ${psB64(v.scopeEnd)}`,
      `$Passerelle = ${psB64(v.scopeGateway)}`,
      `$ServeursDns = @(${dns.map((d) => psB64(d)).join(', ')})`,
      `$DomaineDns = ${psB64(v.scopeDnsDomain)}`,
      `$Bail = [TimeSpan]::FromHours([int](${psB64(v.scopeLease)}))`,
      `$EtatVoulu = ${psB64(v.scopeState)}`,
      avecExclusion ? `$ExclDebut = ${psB64(v.scopeExclStart)}` : '$ExclDebut = $null',
      avecExclusion ? `$ExclFin = ${psB64(v.scopeExclEnd)}` : '$ExclFin = $null',
      "$KjemoFormat = 'Console'",
      "",
      '# --- 1. Le service DHCP repond-il ? --------------------------------------',
      '$service = Get-Service -Name DHCPServer -ErrorAction SilentlyContinue',
      'if ($null -eq $service) {',
      "  [void](Add-KjemoResultat -Categorie 'Service' -Controle 'DHCPServer' -Etat 'PROBLEME' -Valeur 'absent' -Commentaire 'Installe et autorise le role avant de creer une etendue.')",
      '} else {',
      "  $etatSvc = 'ATTENTION'",
      "  if ($service.Status -eq 'Running') { $etatSvc = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Service\' -Controle \'DHCPServer\' -Etat $etatSvc -Valeur $service.Status)',
      '}',
      "",
      '# --- 2. Cette etendue existe-t-elle deja ? -------------------------------',
      '$existante = $null',
      'try { $existante = Get-DhcpServerv4Scope -ScopeId $ScopeId -ErrorAction SilentlyContinue } catch { }',
      'if ($existante) {',
      "  [void](Add-KjemoResultat -Categorie 'Etendue' -Controle 'Existence' -Etat 'ATTENTION' -Valeur (\"$($existante.Name) : $($existante.StartRange) - $($existante.EndRange), etat $($existante.State)\") -Commentaire \"L''etendue existe deja. Elle ne sera pas recreee ; seules les options pourront etre mises a jour.\")",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Etendue' -Controle 'Existence' -Etat 'INFO' -Valeur 'aucune etendue sur ce ScopeId' -Commentaire 'Elle sera creee en mode Appliquer.')",
      '}',
      "",
      "# --- 3. Le plan d'adressage vu depuis le serveur -------------------------",
      '[void](Add-KjemoResultat -Categorie \'Plan\' -Controle \'Reseau\' -Etat \'INFO\' -Valeur ("$ScopeId / masque $Masque"))',
      '[void](Add-KjemoResultat -Categorie \'Plan\' -Controle \'Plage distribuee\' -Etat \'INFO\' -Valeur ("$Debut - $Fin"))',
      '[void](Add-KjemoResultat -Categorie \'Plan\' -Controle \'Passerelle (option 3)\' -Etat \'INFO\' -Valeur $Passerelle)',
      '[void](Add-KjemoResultat -Categorie \'Plan\' -Controle \'DNS (option 6)\' -Etat \'INFO\' -Valeur ($ServeursDns -join \', \'))',
      '[void](Add-KjemoResultat -Categorie \'Plan\' -Controle \'Domaine DNS (option 15)\' -Etat \'INFO\' -Valeur $DomaineDns)',
      "",
      '# Les adresses du serveur lui-meme ne doivent pas etre distribuees.',
      'function ConvertTo-KjemoEntierIp {',
      '  param([Parameter(Mandatory=$true)][string]$Adresse)',
      "  $o = $Adresse.Split('.')",
      '  return ([uint32]$o[0] * 16777216) + ([uint32]$o[1] * 65536) + ([uint32]$o[2] * 256) + [uint32]$o[3]',
      '}',
      '$nDebut = ConvertTo-KjemoEntierIp -Adresse $Debut',
      '$nFin = ConvertTo-KjemoEntierIp -Adresse $Fin',
      '$miennes = @()',
      "try { $miennes = @((Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' }).IPAddress) } catch { }",
      'foreach ($mienne in $miennes) {',
      '  $n = ConvertTo-KjemoEntierIp -Adresse $mienne',
      '  if ($n -ge $nDebut -and $n -le $nFin) {',
      "    [void](Add-KjemoResultat -Categorie 'Plan' -Controle 'Adresse du serveur dans la plage' -Etat 'PROBLEME' -Valeur $mienne -Commentaire \"L'adresse du serveur DHCP est comprise dans la plage distribuee : ajoute une exclusion, sinon un client recevra l'adresse du serveur.\")",
      '  }',
      '}',
      "",
      '# --- 4. Actions, uniquement en mode Appliquer -----------------------------',
      "if ($Mode -eq 'Appliquer') {",
      "",
      '  # 4a. Creation idempotente : rien si l\'etendue existe deja.',
      '  if ($null -eq $existante) {',
      '    Write-Host "Creation de l\'etendue $NomEtendue ($ScopeId)..."',
      '    Add-DhcpServerv4Scope -Name $NomEtendue -StartRange $Debut -EndRange $Fin -SubnetMask $Masque -State $EtatVoulu -LeaseDuration $Bail',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation de l''etendue' -Etat 'INFO' -Valeur 'demandee')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation de l''etendue' -Etat 'OK' -Valeur 'deja presente, rien a creer')",
      '  }',
      "",
      '  # 4b. Exclusion, seulement si elle n\'existe pas deja.',
      '  if ($null -ne $ExclDebut -and $null -ne $ExclFin) {',
      '    $exclusions = @()',
      '    try { $exclusions = @(Get-DhcpServerv4ExclusionRange -ScopeId $ScopeId -ErrorAction SilentlyContinue) } catch { }',
      '    $dejaExclue = $false',
      '    foreach ($ex in $exclusions) {',
      '      if ($ex.StartRange.IPAddressToString -eq $ExclDebut -and $ex.EndRange.IPAddressToString -eq $ExclFin) { $dejaExclue = $true }',
      '    }',
      '    if (-not $dejaExclue) {',
      '      Add-DhcpServerv4ExclusionRange -ScopeId $ScopeId -StartRange $ExclDebut -EndRange $ExclFin',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Exclusion' -Etat 'INFO' -Valeur \"$ExclDebut - $ExclFin\")",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Exclusion' -Etat 'OK' -Valeur 'deja presente')",
      '    }',
      '  }',
      "",
      '  # 4c. Options d\'etendue : passerelle, DNS, domaine.',
      '  Set-DhcpServerv4OptionValue -ScopeId $ScopeId -Router $Passerelle -DnsServer $ServeursDns -DnsDomain $DomaineDns',
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Options 3, 6 et 15' -Etat 'INFO' -Valeur 'appliquees')",
      "",
      '  # 4d. Relecture depuis le serveur : ce qui compte, c\'est l\'etat reel.',
      "  Write-Host ''",
      "  Write-Host '--- Etendue apres modification ---'",
      '  try { Get-DhcpServerv4Scope -ScopeId $ScopeId | Format-List Name,ScopeId,SubnetMask,StartRange,EndRange,State,LeaseDuration } catch { Write-Host $_.Exception.Message }',
      '  try { Get-DhcpServerv4OptionValue -ScopeId $ScopeId | Format-Table OptionId,Name,Value -AutoSize } catch { }',
      '  try { Get-DhcpServerv4ExclusionRange -ScopeId $ScopeId | Format-Table StartRange,EndRange -AutoSize } catch { }',
      '} else {',
      "",
      '  # Simulation : ce que les commandes feraient, sans les executer.',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  if ($null -eq $existante) {',
      '    Add-DhcpServerv4Scope -Name $NomEtendue -StartRange $Debut -EndRange $Fin -SubnetMask $Masque -State $EtatVoulu -LeaseDuration $Bail -WhatIf',
      '  }',
      '  if ($null -ne $ExclDebut -and $null -ne $ExclFin) {',
      '    Add-DhcpServerv4ExclusionRange -ScopeId $ScopeId -StartRange $ExclDebut -EndRange $ExclFin -WhatIf',
      '  }',
      '  Set-DhcpServerv4OptionValue -ScopeId $ScopeId -Router $Passerelle -DnsServer $ServeursDns -DnsDomain $DomaineDns -WhatIf',
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Creer une etendue DHCP et poser ses options',
      outil: 'dhcp-scope-options',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['NomEtendue', psB64(v.scopeName)],
        ['Reseau', psB64(v.scopeCidr)],
        ['Plage', psB64(`${v.scopeStart} - ${v.scopeEnd}`)],
        ['Passerelle', psB64(v.scopeGateway)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-dhcp-etendue',
      formats: 'Console',
    });
  },
  gui: [
    'Console DHCP (dhcpmgmt.msc) > IPv4 > clic droit > Nouvelle étendue.',
    'Renseigner nom, plage d\u2019adresses, masque, exclusions et durée du bail.',
    'À l\u2019étape des options : routeur (option 3), serveurs DNS (option 6), domaine DNS (option 15).',
    'Choisir « Non, j\u2019activerai cette étendue ultérieurement » pour vérifier avant de distribuer.',
    'Une fois vérifiée : clic droit sur l\u2019étendue > Activer.',
  ],
  keywords: [
    'etendue dhcp', 'scope dhcp', 'plage d adresses', 'option 3', 'option 6', 'option 15',
    'passerelle dhcp', 'dns dhcp', 'exclusion dhcp', 'bail dhcp', 'add-dhcpserverv4scope',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur, sur le serveur DHCP.',
    'Rôle DHCP installé, serveur autorisé dans Active Directory et service démarré.',
    'Plan d\u2019adressage arrêté : réseau, plage, passerelle, DNS, domaine.',
    'Aucune autre étendue ne doit déjà servir ce réseau.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'The specified scope already exists',
      code: '0x4E2D',
      cause: 'Une étendue couvre déjà ce ScopeId.',
      fix: 'Le script ne recrée pas une étendue existante. Modifier l\u2019étendue en place, ou la supprimer volontairement après sauvegarde.',
    },
    {
      message: 'The specified IP address range is invalid',
      cause: 'Plage inversée, hors du réseau, ou masque incohérent.',
      fix: 'Le formulaire refuse déjà ces cas : si l\u2019erreur apparaît, le script a été modifié à la main.',
    },
    {
      message: 'Les clients reçoivent une adresse mais pas d\u2019accès Internet',
      cause: 'Option 3 (routeur) absente ou incorrecte, ou option 6 (DNS) pointant vers un serveur injoignable.',
      fix: 'Vérifier les options avec Get-DhcpServerv4OptionValue et tester depuis un client.',
      command: 'Get-DhcpServerv4OptionValue -ScopeId <scope> | Format-Table OptionId,Name,Value',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Get-DhcpServerv4Scope affiche l\u2019étendue avec la plage et l\u2019état attendus.',
    'Get-DhcpServerv4OptionValue montre les options 3, 6 et 15.',
    'Get-DhcpServerv4ExclusionRange liste l\u2019exclusion demandée.',
    'Un client qui renouvelle son bail (ipconfig /renew) reçoit une adresse de la plage, la bonne passerelle et les bons DNS.',
  ],
  rollback: {
    summary: 'Une étendue nouvellement créée peut être désactivée — geste réversible et sans perte — puis supprimée si elle n\u2019a jamais servi. Supprimer une étendue efface aussi ses baux et ses réservations.',
    diagnostic: '# Constater l\'etat reel avant toute annulation.\nGet-DhcpServerv4Scope -ScopeId \'<scope>\' | Format-List Name,ScopeId,StartRange,EndRange,State\nGet-DhcpServerv4Lease -ScopeId \'<scope>\' | Measure-Object | Select-Object Count\nGet-DhcpServerv4OptionValue -ScopeId \'<scope>\' | Format-Table OptionId,Name,Value',
    command: '# Etape 1 — desactiver : reversible, aucun bail perdu, les clients existants\n# conservent leur adresse jusqu\'a expiration.\nSet-DhcpServerv4Scope -ScopeId \'<scope>\' -State Inactive\n\n# Etape 2 — supprimer, seulement si l\'etendue a ete creee par erreur et n\'a\n# jamais servi. -Confirm est explicite : PowerShell demandera confirmation.\nRemove-DhcpServerv4Scope -ScopeId \'<scope>\' -Confirm',
    exceptional: '# AVERTISSEMENT CRITIQUE — suppression d\'une etendue qui a distribue des baux.\n#\n# Supprimer une etendue active efface ses baux et ses reservations. Les clients\n# gardent leur adresse jusqu\'a expiration du bail, puis se retrouvent sans\n# adresse valide. Sur un reseau en production, cela coupe le service.\n#\n# Avant :\n#   1. Sauvegarder la configuration DHCP (outil dedie de ce lot).\n#   2. Desactiver l\'etendue et attendre l\'expiration des baux.\n#   3. Verifier qu\'aucun client actif ne depend de cette etendue.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/dhcpserver/remove-dhcpserverv4scope\n#\n# Commande, a executer manuellement apres ces verifications :\n#   Remove-DhcpServerv4Scope -ScopeId \'<scope>\' -Confirm',
    warning: 'Créer l\u2019étendue en état Inactive puis l\u2019activer après vérification évite de distribuer un plan d\u2019adressage erroné à tout un réseau.',
  },
  checks: [
    'Vérifier que la passerelle existe réellement et répond au ping depuis le serveur.',
    'Vérifier que les serveurs DNS distribués résolvent le domaine annoncé.',
    'Prévoir une exclusion pour les adresses fixes du réseau (serveurs, imprimantes).',
    'En laboratoire, un bail court facilite les essais ; en production, un bail court multiplie le trafic DHCP.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4scope',
  sources: [
    { label: 'Add-DhcpServerv4Scope', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4scope' },
    { label: 'Set-DhcpServerv4OptionValue', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/set-dhcpserverv4optionvalue' },
    { label: 'Add-DhcpServerv4ExclusionRange', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4exclusionrange' },
    { label: 'Remove-DhcpServerv4Scope', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/remove-dhcpserverv4scope' },
  ],
};

/**
 * 4. dhcp-reservation — réserver une adresse pour une machine précise.
 *
 * L'erreur classique n'est pas la commande mais le format de l'adresse MAC :
 * tirets, deux-points, points Cisco, ou rien du tout. Le formulaire accepte les
 * quatre et normalise vers la forme attendue par le cmdlet.
 */
export const outilDhcpReservation = {
  id: 'dhcp-reservation',
  icon: '\u25c9',
  category: 'Windows Server',
  subcategory: 'DHCP',
  title: 'Créer une réservation DHCP',
  risk: 'caution',
  summary: 'Normalise l\u2019adresse MAC, vérifie l\u2019appartenance à l\u2019étendue et les conflits, puis crée la réservation si elle n\u2019existe pas.',
  fields: [
    { id: 'resScopeId', label: 'ScopeId de l\u2019étendue', default: '192.168.30.0', help: 'Adresse de réseau de l\u2019étendue, pas une adresse d\u2019hôte.' },
    { id: 'resIp', label: 'Adresse IP réservée', default: '192.168.30.50' },
    { id: 'resClient', label: 'Adresse MAC ou ClientId', default: '00-15-5D-01-2A-3B', help: 'Tirets, deux-points, points ou sans séparateur : les quatre formes sont acceptées.' },
    { id: 'resName', label: 'Nom du client', default: 'poste-accueil-01' },
    { id: 'resDesc', label: 'Description', default: 'Poste d\u2019accueil — réservation permanente' },
    {
      id: 'resType', label: 'Type de réservation', type: 'select', default: 'Both',
      options: [['Both', 'Both — DHCP et BOOTP'], ['Dhcp', 'DHCP seulement'], ['Bootp', 'BOOTP seulement']],
    },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    const scope = verifier(errors, 'resScopeId', validerScopeId(v.resScopeId));
    const ip = verifier(errors, 'resIp', validateIPv4(v.resIp));
    if (scope.ok && ip.ok && !ipDansReseau(ip.value, scope.value, 24)) {
      errors.resIp = `${ip.value} ne semble pas appartenir à l\u2019étendue ${scope.value}/24. Vérifie le ScopeId et l\u2019adresse.`;
    }
    const client = String(v.resClient ?? '').trim();
    const mac = validerMac(client);
    if (!mac.ok) {
      const cid = validerClientId(client);
      if (!cid.ok) errors.resClient = mac.error;
    }
    const nom = String(v.resName ?? '').trim();
    if (!nom) errors.resName = 'Le nom du client ne peut pas être vide.';
    else if (nom.length > 255) errors.resName = 'Le nom du client ne doit pas dépasser 255 caractères.';
    if (String(v.resDesc ?? '').length > 255) errors.resDesc = 'La description ne doit pas dépasser 255 caractères.';
    verifier(errors, 'resType', validerChoix(v.resType, ['Both', 'Dhcp', 'Bootp'], 'Le type de réservation'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const mac = validerMac(v.resClient);
    const client = mac.ok ? mac.value : validerClientId(v.resClient).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$ScopeId = ${psB64(v.resScopeId)}`,
      `$Adresse = ${psB64(v.resIp)}`,
      `$ClientId = ${psB64(client)}`,
      `$NomClient = ${psB64(v.resName)}`,
      `$Description = ${psB64(v.resDesc)}`,
      `$TypeReservation = ${psB64(v.resType)}`,
      "$KjemoFormat = 'Console'",
      "",
      "# L'identifiant client a ete normalise par le formulaire, quel que soit le",
      "# separateur saisi. C'est la forme attendue par Add-DhcpServerv4Reservation.",
      '[void](Add-KjemoResultat -Categorie \'Saisie\' -Controle \'Identifiant client normalise\' -Etat \'INFO\' -Valeur $ClientId)',
      "",
      "# --- 1. L'etendue existe-t-elle ? ---------------------------------------",
      '$etendue = $null',
      'try { $etendue = Get-DhcpServerv4Scope -ScopeId $ScopeId -ErrorAction SilentlyContinue } catch { }',
      'if ($null -eq $etendue) {',
      "  [void](Add-KjemoResultat -Categorie 'Etendue' -Controle 'Existence' -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'Sans etendue, aucune reservation n''est possible.')",
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Etendue\' -Controle \'Existence\' -Etat \'OK\' -Valeur ("$($etendue.Name) : $($etendue.StartRange) - $($etendue.EndRange)"))',
      '}',
      "",
      "# --- 2. L'adresse appartient-elle bien a l'etendue ? --------------------",
      'if ($etendue) {',
      '  function ConvertTo-KjemoEntierIp {',
      '    param([Parameter(Mandatory=$true)][string]$Adresse)',
      "    $o = $Adresse.Split('.')",
      '    return ([uint32]$o[0] * 16777216) + ([uint32]$o[1] * 65536) + ([uint32]$o[2] * 256) + [uint32]$o[3]',
      '  }',
      '  $n = ConvertTo-KjemoEntierIp -Adresse $Adresse',
      '  $nd = ConvertTo-KjemoEntierIp -Adresse $etendue.StartRange.IPAddressToString',
      '  $nf = ConvertTo-KjemoEntierIp -Adresse $etendue.EndRange.IPAddressToString',
      '  if ($n -lt $nd -or $n -gt $nf) {',
      "    [void](Add-KjemoResultat -Categorie 'Adresse' -Controle 'Appartenance a la plage' -Etat 'PROBLEME' -Valeur $Adresse -Commentaire 'Adresse hors de la plage de l''etendue : la reservation sera refusee.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Adresse' -Controle 'Appartenance a la plage' -Etat 'OK' -Valeur $Adresse)",
      '  }',
      '}',
      "",
      '# --- 3. Reservations existantes et conflits ------------------------------',
      '$reservations = @()',
      'try { $reservations = @(Get-DhcpServerv4Reservation -ScopeId $ScopeId -ErrorAction SilentlyContinue) } catch { }',
      '$dejaReservee = $false',
      '$conflit = $null',
      'foreach ($r in $reservations) {',
      '  $ipR = $r.IPAddress.IPAddressToString',
      '  $idR = ($r.ClientId -replace \'[:.]\', \'-\').ToUpper()',
      '  if ($ipR -eq $Adresse -and $idR -eq $ClientId.ToUpper()) { $dejaReservee = $true }',
      '  elseif ($ipR -eq $Adresse) { $conflit = "adresse deja reservee pour $idR" }',
      '  elseif ($idR -eq $ClientId.ToUpper()) { $conflit = "ce client a deja la reservation $ipR" }',
      '}',
      'if ($dejaReservee) {',
      "  [void](Add-KjemoResultat -Categorie 'Reservation' -Controle 'Existence' -Etat 'OK' -Valeur 'deja presente, identique' -Commentaire 'Rien a faire : l''operation est idempotente.')",
      '} elseif ($conflit) {',
      "  [void](Add-KjemoResultat -Categorie 'Reservation' -Controle 'Conflit' -Etat 'PROBLEME' -Valeur $conflit -Commentaire 'Resous le conflit avant de creer la reservation.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Reservation' -Controle 'Existence' -Etat 'INFO' -Valeur 'aucune reservation correspondante')",
      '}',
      "",
      '# --- 4. Un bail actif occupe-t-il deja cette adresse ? -------------------',
      '$baux = @()',
      'try { $baux = @(Get-DhcpServerv4Lease -ScopeId $ScopeId -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress.IPAddressToString -eq $Adresse }) } catch { }',
      'foreach ($bail in $baux) {',
      '  $idBail = ($bail.ClientId -replace \'[:.]\', \'-\').ToUpper()',
      '  if ($idBail -ne $ClientId.ToUpper()) {',
      "    [void](Add-KjemoResultat -Categorie 'Bail' -Controle 'Conflit de bail' -Etat 'ATTENTION' -Valeur (\"$Adresse est louee a $idBail\") -Commentaire \"Le client actuel gardera l''adresse jusqu''a expiration du bail : previens-le ou attends l''expiration.\")",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Bail' -Controle 'Bail existant' -Etat 'OK' -Valeur 'deja loue au meme client')",
      '  }',
      '}',
      "",
      '# --- 5. Action, uniquement en mode Appliquer ------------------------------',
      "if ($Mode -eq 'Appliquer') {",
      '  if ($dejaReservee) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'OK' -Valeur 'ignoree, reservation identique deja presente')",
      '  } elseif ($conflit) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'PROBLEME' -Valeur 'refusee' -Commentaire 'Un conflit a ete detecte : rien n''a ete cree.')",
      '  } else {',
      '    Add-DhcpServerv4Reservation -ScopeId $ScopeId -IPAddress $Adresse -ClientId $ClientId -Name $NomClient -Description $Description -Type $TypeReservation',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'INFO' -Valeur 'demandee')",
      '  }',
      "  Write-Host ''",
      "  Write-Host '--- Reservations de l''etendue apres modification ---'",
      '  try { Get-DhcpServerv4Reservation -ScopeId $ScopeId | Format-Table IPAddress,ClientId,Name,Description -AutoSize } catch { Write-Host $_.Exception.Message }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  if (-not $dejaReservee -and -not $conflit) {',
      '    Add-DhcpServerv4Reservation -ScopeId $ScopeId -IPAddress $Adresse -ClientId $ClientId -Name $NomClient -Description $Description -Type $TypeReservation -WhatIf',
      '  }',
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Creer une reservation DHCP',
      outil: 'dhcp-reservation',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['ScopeId', psB64(v.resScopeId)],
        ['AdresseReservee', psB64(v.resIp)],
        ['IdentifiantClient', psB64(client)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-dhcp-reservation',
      formats: 'Console',
    });
  },
  gui: [
    'Console DHCP (dhcpmgmt.msc) > IPv4 > l\u2019étendue > Réservations > clic droit > Nouvelle réservation.',
    'Saisir le nom, l\u2019adresse IP réservée et l\u2019adresse MAC sans séparateur.',
    'Choisir le type pris en charge (DHCP, BOOTP ou les deux), puis Ajouter.',
    'Sur le client : ipconfig /release puis ipconfig /renew pour obtenir l\u2019adresse réservée.',
  ],
  keywords: [
    'reservation dhcp', 'adresse fixe dhcp', 'mac', 'clientid', 'bail fixe',
    'add-dhcpserverv4reservation', 'imprimante adresse fixe',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur.',
    'Étendue déjà créée et adresse comprise dans sa plage.',
    'Adresse MAC réellement relevée sur le client (ipconfig /all, ou l\u2019étiquette du matériel).',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'The specified IP address or hardware address is being used by another client',
      cause: 'Une réservation ou un bail actif occupe déjà cette adresse ou ce client.',
      fix: 'Le diagnostic de ce script détecte ces deux cas avant d\u2019agir : lire la section Reservation et Bail.',
    },
    {
      message: 'Le client ne reçoit pas l\u2019adresse réservée',
      cause: 'Le bail en cours n\u2019a pas expiré, ou l\u2019adresse MAC saisie n\u2019est pas celle de la carte utilisée.',
      fix: 'Sur le client : ipconfig /release puis ipconfig /renew. Vérifier la MAC avec ipconfig /all.',
      command: 'ipconfig /all',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Get-DhcpServerv4Reservation -ScopeId <scope> affiche la réservation avec le bon ClientId.',
    'Sur le client, ipconfig /renew donne l\u2019adresse réservée.',
    'La console DHCP montre la réservation sous l\u2019étendue.',
  ],
  rollback: {
    summary: 'Une réservation se retire sans toucher au reste de l\u2019étendue. Le client reprendra une adresse dynamique au prochain renouvellement.',
    diagnostic: '# Constater la reservation avant de la retirer.\nGet-DhcpServerv4Reservation -ScopeId \'<scope>\' | Format-Table IPAddress,ClientId,Name\nGet-DhcpServerv4Lease -ScopeId \'<scope>\' | Where-Object { $_.AddressState -like \'*Reservation*\' } | Format-Table IPAddress,ClientId,AddressState',
    command: '# Retirer la reservation. Le client repassera en adresse dynamique au\n# prochain renouvellement de bail. -Confirm est explicite.\nRemove-DhcpServerv4Reservation -ScopeId \'<scope>\' -ClientId \'<client-id>\' -Confirm',
    exceptional: '',
    warning: 'Retirer la réservation d\u2019un serveur, d\u2019une imprimante ou d\u2019un équipement référencé par son adresse IP le rend injoignable dès que son bail change.',
  },
  checks: [
    'Relever l\u2019adresse MAC sur le client lui-même, pas sur une étiquette ancienne.',
    'Vérifier que l\u2019adresse réservée est hors de la zone réellement distribuée si tu veux éviter tout conflit temporaire.',
    'Le mode Diagnostic dit exactement ce qui sera créé, sans rien créer.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4reservation',
  sources: [
    { label: 'Add-DhcpServerv4Reservation', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/add-dhcpserverv4reservation' },
    { label: 'Get-DhcpServerv4Reservation', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4reservation' },
    { label: 'Remove-DhcpServerv4Reservation', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/remove-dhcpserverv4reservation' },
  ],
};

/**
 * 5. dhcp-leases-diagnostic — lire les baux, mesurer l'occupation, trouver un client.
 * Diagnostic pur : rien n'est modifié, y compris quand un bail est en conflit.
 */
export const outilDhcpBaux = {
  id: 'dhcp-leases-diagnostic',
  icon: '\u25a7',
  category: 'Windows Server',
  subcategory: 'DHCP',
  title: 'Diagnostiquer les baux DHCP',
  risk: 'diagnostic',
  summary: 'Liste les baux actifs et expirés, recherche un client, mesure l\u2019occupation de l\u2019étendue et signale la saturation.',
  fields: [
    { id: 'leaseServer', label: 'Serveur DHCP (facultatif)', default: '', help: 'Vide = le serveur local.' },
    { id: 'leaseScopeId', label: 'ScopeId (facultatif)', default: '192.168.30.0', help: 'Vide = toutes les étendues du serveur.' },
    { id: 'leaseFilter', label: 'Filtre : adresse IP, nom ou MAC (facultatif)', default: '', help: 'Recherche partielle, insensible à la casse.' },
    { id: 'leaseThreshold', label: 'Seuil d\u2019alerte d\u2019occupation (%)', default: '80' },
    champFormat(),
  ],
  validate(v) {
    const errors = {};
    const srv = String(v.leaseServer ?? '').trim();
    if (srv) {
      const fq = validerFqdn(srv);
      const ip = validateIPv4(srv);
      const court = validerNomHote(srv);
      if (!fq.ok && !ip.ok && !court.ok) errors.leaseServer = 'Indique un nom d\u2019hôte, un nom complet ou une adresse IPv4, ou laisse vide.';
    }
    const scope = String(v.leaseScopeId ?? '').trim();
    if (scope) verifier(errors, 'leaseScopeId', validerScopeId(scope));
    if (String(v.leaseFilter ?? '').length > 100) errors.leaseFilter = 'Le filtre ne doit pas dépasser 100 caractères.';
    verifier(errors, 'leaseThreshold', validerEntier(v.leaseThreshold, 1, 100, 'Le seuil d\u2019occupation'));
    verifier(errors, 'reportFormat', validerFormatRapport(v.reportFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const srv = String(v.leaseServer ?? '').trim();
    const scope = String(v.leaseScopeId ?? '').trim();
    const filtre = String(v.leaseFilter ?? '').trim();

    const corps = [
      srv ? `$Serveur = ${psB64(srv)}` : '$Serveur = $env:COMPUTERNAME',
      scope ? `$ScopeId = ${psB64(scope)}` : '$ScopeId = $null',
      filtre ? `$Filtre = ${psB64(filtre)}` : "$Filtre = ''",
      `$Seuil = [int](${psB64(v.leaseThreshold)})`,
      `$KjemoFormat = ${psB64(v.reportFormat)}`,
      "",
      '# --- 1. Service et journaux ----------------------------------------------',
      '$service = Get-Service -Name DHCPServer -ErrorAction SilentlyContinue',
      'if ($service) {',
      "  $etatSvc = 'PROBLEME'",
      "  if ($service.Status -eq 'Running') { $etatSvc = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Service' -Controle 'DHCPServer' -Etat $etatSvc -Valeur $service.Status)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Service' -Controle 'DHCPServer' -Etat 'INFO' -Valeur 'service local absent' -Commentaire 'Normal si tu interroges un serveur distant.')",
      '}',
      '$audit = $null',
      'try { $audit = Get-DhcpServerAuditLog -ComputerName $Serveur -ErrorAction SilentlyContinue } catch { }',
      'if ($audit) {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle 'Audit DHCP' -Etat 'INFO' -Valeur (\"Active : $($audit.Enable) — dossier : $($audit.Path)\") -Commentaire \"Les journaux d''audit tracent les attributions et les refus.\")",
      '}',
      "",
      '# --- 2. Etendues a examiner ----------------------------------------------',
      '$etendues = @()',
      'try {',
      '  if ($null -eq $ScopeId) { $etendues = @(Get-DhcpServerv4Scope -ComputerName $Serveur) }',
      '  else { $etendues = @(Get-DhcpServerv4Scope -ComputerName $Serveur -ScopeId $ScopeId) }',
      '} catch {',
      '  [void](Add-KjemoResultat -Categorie \'Etendues\' -Controle \'Lecture\' -Etat \'PROBLEME\' -Valeur $_.Exception.Message -Commentaire "Verifie le nom du serveur et la presence des outils DHCP.")',
      '}',
      'if (@($etendues).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Etendues' -Controle 'Inventaire' -Etat 'ATTENTION' -Valeur 'aucune etendue' -Commentaire 'Sans etendue, le serveur ne distribue rien.')",
      '}',
      "",
      '# --- 3. Baux, occupation et conflits --------------------------------------',
      '$tousLesBaux = @()',
      'foreach ($e in $etendues) {',
      '  $id = $e.ScopeId.IPAddressToString',
      '  $baux = @()',
      '  try { $baux = @(Get-DhcpServerv4Lease -ComputerName $Serveur -ScopeId $id -AllLeases) } catch { }',
      '  $tousLesBaux += $baux',
      "",
      '  $actifs = @($baux | Where-Object { $_.AddressState -like \'*Active*\' })',
      '  $expires = @($baux | Where-Object { $_.AddressState -like \'*Expired*\' })',
      '  $conflits = @($baux | Where-Object { $_.AddressState -like \'*Declined*\' -or $_.AddressState -like \'*Bad*\' })',
      "",
      '  $stats = $null',
      '  try { $stats = Get-DhcpServerv4ScopeStatistics -ComputerName $Serveur -ScopeId $id } catch { }',
      '  if ($stats) {',
      '    $pourcent = [math]::Round($stats.PercentageInUse, 1)',
      "    $etatOcc = 'OK'",
      "    $commentaireOcc = ''",
      '    if ($pourcent -ge $Seuil) {',
      "      $etatOcc = 'ATTENTION'",
      "      $commentaireOcc = \"Occupation au-dela du seuil de $Seuil % : l''etendue approche de la saturation.\"",
      '    }',
      '    if ($pourcent -ge 100) {',
      "      $etatOcc = 'PROBLEME'",
      "      $commentaireOcc = 'Etendue saturee : plus aucune adresse libre, les nouveaux clients resteront sans adresse.'",
      '    }',
      '    [void](Add-KjemoResultat -Categorie "Etendue $id" -Controle \'Occupation\' -Etat $etatOcc -Valeur ("$pourcent % — $($stats.InUse) utilisees, $($stats.Free) libres sur $($stats.AddressesInUse + $stats.AddressesFree)") -Commentaire $commentaireOcc)',
      '  }',
      '  [void](Add-KjemoResultat -Categorie "Etendue $id" -Controle \'Baux\' -Etat \'INFO\' -Valeur ("actifs : $(@($actifs).Count) ; expires : $(@($expires).Count) ; refuses : $(@($conflits).Count)"))',
      '  if (@($conflits).Count -gt 0) {',
      "    [void](Add-KjemoResultat -Categorie \"Etendue $id\" -Controle 'Baux en conflit' -Etat 'ATTENTION' -Valeur (($conflits | ForEach-Object { $_.IPAddress.IPAddressToString }) -join ', ') -Commentaire \"Adresses refusees par un client : souvent un conflit d''adresse avec une machine configuree en statique.\")",
      '  }',
      '}',
      "",
      "# --- 4. Recherche d'un client ---------------------------------------------",
      "if ($Filtre -ne '') {",
      '  $trouves = @($tousLesBaux | Where-Object {',
      '    ($_.IPAddress.IPAddressToString -like "*$Filtre*") -or',
      '    ($_.HostName -like "*$Filtre*") -or',
      '    ($_.ClientId -like "*$Filtre*")',
      '  })',
      '  if (@($trouves).Count -eq 0) {',
      '    [void](Add-KjemoResultat -Categorie \'Recherche\' -Controle "Filtre $Filtre" -Etat \'INFO\' -Valeur \'aucun bail correspondant\')',
      '  } else {',
      '    foreach ($t in $trouves) {',
      '      [void](Add-KjemoResultat -Categorie \'Recherche\' -Controle $t.IPAddress.IPAddressToString -Etat \'INFO\' -Valeur ("$($t.HostName) / $($t.ClientId) / $($t.AddressState) / expire le $($t.LeaseExpiryTime)"))',
      '    }',
      '  }',
      '}',
      "",
      '# --- 5. Adresses libres ----------------------------------------------------',
      'foreach ($e in $etendues) {',
      '  $id = $e.ScopeId.IPAddressToString',
      '  $libre = $null',
      '  try { $libre = Get-DhcpServerv4FreeIPAddress -ComputerName $Serveur -ScopeId $id -NumAddress 5 } catch { }',
      '  if ($libre) {',
      '    [void](Add-KjemoResultat -Categorie "Etendue $id" -Controle \'Adresses libres (5 premieres)\' -Etat \'INFO\' -Valeur (($libre | ForEach-Object { $_.IPAddressToString }) -join \', \'))',
      '  } else {',
      '    [void](Add-KjemoResultat -Categorie "Etendue $id" -Controle \'Adresses libres\' -Etat \'ATTENTION\' -Valeur \'aucune renvoyee\' -Commentaire "Etendue saturee, ou cmdlet indisponible sur cette version.")',
      '  }',
      '}',
      "",
      "# Detail complet des baux, pour la console et pour l'export CSV.",
      "Write-Host ''",
      "Write-Host '--- Baux ---'",
      '$tousLesBaux | Select-Object @{N=\'Adresse\';E={$_.IPAddress.IPAddressToString}},HostName,ClientId,AddressState,LeaseExpiryTime | Format-Table -AutoSize',
    ];

    return assembler({
      titre: 'Diagnostiquer les baux DHCP - lecture seule',
      outil: 'dhcp-leases-diagnostic',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Serveur', srv ? psB64(srv) : '$env:COMPUTERNAME'],
        ['ScopeId', scope ? psB64(scope) : "'(toutes)'"],
        ['Filtre', filtre ? psB64(filtre) : "'(aucun)'"],
        ['SeuilOccupation', psB64(v.leaseThreshold)],
      ],
      corps,
      prefixeFichier: 'kjemo-dhcp-baux',
    });
  },
  gui: [
    'Console DHCP (dhcpmgmt.msc) > IPv4 > l\u2019étendue > Baux d\u2019adresses.',
    'Statistiques de l\u2019étendue : clic droit sur l\u2019étendue > Afficher les statistiques.',
    'Les baux refusés apparaissent avec l\u2019état « BAD_ADDRESS ».',
    'Journaux d\u2019audit : dossier %SystemRoot%\\System32\\dhcp, un fichier par jour.',
  ],
  keywords: [
    'bail dhcp', 'baux', 'lease', 'etendue saturee', 'plus d adresses', 'bad_address',
    'conflit d adresse', 'qui a cette ip', 'retrouver un poste', 'occupation etendue',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur, ou compte membre du groupe « Utilisateurs DHCP » pour la lecture.',
    'Outils de gestion DHCP installés si le serveur est interrogé à distance.',
    'Script en lecture seule : exécutable en production sans précaution particulière.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'Get-DhcpServerv4FreeIPAddress : aucune adresse disponible',
      cause: 'L\u2019étendue est saturée, ou toutes les adresses restantes sont exclues ou réservées.',
      fix: 'Élargir la plage, raccourcir la durée du bail, ou nettoyer les baux expirés.',
    },
    {
      message: 'Un client est en BAD_ADDRESS',
      cause: 'Le client a détecté que l\u2019adresse proposée était déjà utilisée — typiquement par une machine configurée en adresse statique dans la plage distribuée.',
      fix: 'Exclure l\u2019adresse statique de la plage, ou passer la machine en réservation.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport indique l\u2019occupation de chaque étendue et le seuil franchi le cas échéant.',
    'La recherche par filtre retrouve le bail attendu.',
    'Les baux refusés sont listés avec leur adresse.',
  ],
  rollback: {
    summary: 'Ce script lit les baux et n\u2019en modifie aucun. Il n\u2019y a rien à annuler.',
    diagnostic: '# Relire simplement les baux : aucune commande de ce script ne modifie l\'etat.\nGet-DhcpServerv4Lease -ScopeId \'<scope>\' -AllLeases | Format-Table IPAddress,HostName,AddressState',
    command: '# Aucune annulation necessaire : le script est en lecture seule.\nGet-DhcpServerv4ScopeStatistics | Format-Table ScopeId,InUse,Free,PercentageInUse',
    exceptional: '',
    warning: 'Le rapport contient des noms de machines et des adresses MAC : c\u2019est un document interne.',
  },
  checks: [
    'Pour interroger un serveur distant, vérifier que les outils DHCP sont installés localement.',
    'Un seuil d\u2019alerte à 80 % laisse le temps d\u2019agir avant la saturation.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4lease',
  sources: [
    { label: 'Get-DhcpServerv4Lease', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4lease' },
    { label: 'Get-DhcpServerv4ScopeStatistics', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/get-dhcpserverv4scopestatistics' },
  ],
};

/**
 * 6. dhcp-backup — sauvegarder la configuration DHCP.
 *
 * La restauration n'est PAS automatisée dans ce lot : elle écrase la
 * configuration en place, et cela se décide, cela ne se clique pas.
 */
export const outilDhcpSauvegarde = {
  id: 'dhcp-backup',
  icon: '\u25a9',
  category: 'Windows Server',
  subcategory: 'DHCP',
  title: 'Sauvegarder la configuration DHCP',
  risk: 'safe',
  summary: 'Vérifie l\u2019espace disponible, crée un dossier daté, exécute la sauvegarde, contrôle les fichiers produits et écrit un manifeste.',
  fields: [
    { id: 'bkServer', label: 'Serveur DHCP', default: 'srv-dhcp.hopitalbn.lan', help: 'Nom du serveur dont la configuration est sauvegardée.' },
    { id: 'bkFolder', label: 'Dossier de sauvegarde (local)', default: 'C:\\Sauvegardes\\DHCP', help: 'Chemin local. Les chemins réseau (UNC) sont refusés dans cette version.' },
    { id: 'bkName', label: 'Nom du sous-dossier', default: 'dhcp-config', help: 'Un horodatage est ajouté automatiquement.' },
    {
      id: 'bkLeases', label: 'Inclure la base des baux', type: 'select', default: 'Oui',
      options: [['Oui', 'Oui — sauvegarde complète'], ['Non', 'Non — configuration seule']],
      help: 'Backup-DhcpServer sauvegarde la base complète ; cette option documente l\u2019intention et le volume attendu.',
    },
    {
      id: 'bkMode', label: 'Mode d\u2019exécution', type: 'select', default: 'Diagnostic',
      options: [['Diagnostic', 'Diagnostic — vérifie sans sauvegarder'], ['Sauvegarder', 'Sauvegarder — exécute la sauvegarde']],
    },
  ],
  validate(v) {
    const errors = {};
    const srv = String(v.bkServer ?? '').trim();
    const fq = validerFqdn(srv);
    const court = validerNomHote(srv);
    const ip = validateIPv4(srv);
    if (!fq.ok && !court.ok && !ip.ok) errors.bkServer = 'Indique un nom d\u2019hôte, un nom complet ou une adresse IPv4.';
    verifier(errors, 'bkFolder', validerCheminWindowsLocal(v.bkFolder));
    const nom = String(v.bkName ?? '').trim();
    if (!nom) errors.bkName = 'Le nom du sous-dossier ne peut pas être vide.';
    else if (!/^[A-Za-z0-9._-]+$/.test(nom)) errors.bkName = 'Le nom du sous-dossier n\u2019accepte que lettres, chiffres, point, tiret et souligné.';
    verifier(errors, 'bkLeases', validerChoix(v.bkLeases, ['Oui', 'Non'], 'L\u2019option « inclure les baux »'));
    verifier(errors, 'bkMode', validerChoix(v.bkMode, ['Diagnostic', 'Sauvegarder'], 'Le mode'));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const corps = [
      `$Mode = ${psB64(v.bkMode)}`,
      `$Serveur = ${psB64(v.bkServer)}`,
      `$Dossier = ${psB64(validerCheminWindowsLocal(v.bkFolder).value)}`,
      `$NomSauvegarde = ${psB64(v.bkName)}`,
      `$AvecBaux = ${psB64(v.bkLeases)}`,
      "$KjemoFormat = 'Console'",
      "",
      '# --- 1. Le chemin est-il local ? ------------------------------------------',
      "# Les chemins UNC sont refuses par le formulaire : Backup-DhcpServer s'execute",
      "# sous le compte de service, qui n'a en general aucun droit sur un partage.",
      "if ($Dossier -like '\\\\\\\\*') {",
      "  [void](Add-KjemoResultat -Categorie 'Chemin' -Controle 'Type de chemin' -Etat 'PROBLEME' -Valeur $Dossier -Commentaire 'Chemin reseau refuse : utilise un chemin local.')",
      '  return',
      '}',
      "[void](Add-KjemoResultat -Categorie 'Chemin' -Controle 'Type de chemin' -Etat 'OK' -Valeur $Dossier)",
      "",
      '# --- 2. Espace disponible --------------------------------------------------',
      '$lecteur = $Dossier.Substring(0,1)',
      '$volume = $null',
      'try { $volume = Get-Volume -DriveLetter $lecteur -ErrorAction SilentlyContinue } catch { }',
      'if ($volume) {',
      '  $libreGo = [math]::Round($volume.SizeRemaining / 1GB, 2)',
      "  $etatEspace = 'OK'",
      "  $commentaireEspace = ''",
      '  if ($libreGo -lt 1) {',
      "    $etatEspace = 'PROBLEME'",
      "    $commentaireEspace = 'Moins de 1 Go libre : la sauvegarde risque d''echouer a mi-chemin.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Espace\' -Controle "Volume $lecteur" -Etat $etatEspace -Valeur ("$libreGo Go libres") -Commentaire $commentaireEspace)',
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Espace\' -Controle "Volume $lecteur" -Etat \'ATTENTION\' -Valeur \'volume introuvable\' -Commentaire "Verifie la lettre de lecteur.")',
      '}',
      "",
      '# --- 3. Service DHCP -------------------------------------------------------',
      '$service = Get-Service -Name DHCPServer -ErrorAction SilentlyContinue',
      'if ($service) {',
      '  [void](Add-KjemoResultat -Categorie \'Service\' -Controle \'DHCPServer\' -Etat \'INFO\' -Valeur $service.Status -Commentaire "Backup-DhcpServer fonctionne service demarre.")',
      '}',
      '$etendues = @()',
      'try { $etendues = @(Get-DhcpServerv4Scope -ComputerName $Serveur) } catch { }',
      '[void](Add-KjemoResultat -Categorie \'Contenu\' -Controle \'Etendues a sauvegarder\' -Etat \'INFO\' -Valeur ("$(@($etendues).Count) etendue(s)"))',
      '[void](Add-KjemoResultat -Categorie \'Contenu\' -Controle \'Base des baux incluse\' -Etat \'INFO\' -Valeur $AvecBaux -Commentaire "Backup-DhcpServer sauvegarde la base complete du serveur.")',
      "",
      '# --- 4. Sauvegarde ---------------------------------------------------------',
      "$horodatage = Get-Date -Format 'yyyyMMdd-HHmmss'",
      '$cible = Join-Path $Dossier ("$NomSauvegarde-$horodatage")',
      '[void](Add-KjemoResultat -Categorie \'Cible\' -Controle \'Dossier de destination\' -Etat \'INFO\' -Valeur $cible)',
      "",
      "if ($Mode -eq 'Sauvegarder') {",
      '  if (-not (Test-Path -LiteralPath $Dossier)) {',
      '    New-Item -ItemType Directory -Path $Dossier | Out-Null',
      '  }',
      '  New-Item -ItemType Directory -Path $cible | Out-Null',
      '  Backup-DhcpServer -ComputerName $Serveur -Path $cible',
      "",
      '  # Verifier que des fichiers ont reellement ete ecrits : une commande qui',
      "  # se termine sans erreur n'est pas une preuve de sauvegarde.",
      '  $fichiers = @()',
      '  try { $fichiers = @(Get-ChildItem -LiteralPath $cible -Recurse -File) } catch { }',
      '  if (@($fichiers).Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Fichiers produits' -Etat 'PROBLEME' -Valeur 'aucun fichier' -Commentaire 'La commande n''a rien ecrit : verifie les droits du compte de service DHCP sur ce dossier.')",
      '  } else {',
      '    $taille = [math]::Round((($fichiers | Measure-Object -Property Length -Sum).Sum) / 1MB, 2)',
      '    [void](Add-KjemoResultat -Categorie \'Sauvegarde\' -Controle \'Fichiers produits\' -Etat \'OK\' -Valeur ("$(@($fichiers).Count) fichier(s), $taille Mo"))',
      "",
      '    # Manifeste : ce qui a ete sauvegarde, quand, et par quel outil.',
      '    $manifeste = [pscustomobject]@{',
      '      Outil        = $KjemoOutil',
      '      Version      = $KjemoVersion',
      '      Serveur      = $Serveur',
      '      Date         = (Get-Date).ToString(\'s\')',
      '      Dossier      = $cible',
      '      NombreFichiers = @($fichiers).Count',
      '      TailleMo     = $taille',
      '      Etendues     = @($etendues | ForEach-Object { $_.ScopeId.IPAddressToString })',
      '    }',
      "    $manifeste | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $cible 'kjemo-manifeste.json') -Encoding UTF8",
      "    [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Manifeste' -Etat 'OK' -Valeur (Join-Path $cible 'kjemo-manifeste.json'))",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Execution' -Etat 'INFO' -Valeur 'non executee (mode Diagnostic)' -Commentaire 'Relance en mode Sauvegarder pour ecrire reellement.')",
      '}',
      "",
      '# --- 5. Restauration : documentee, jamais automatisee ----------------------',
      "Write-Host ''",
      "Write-Host '--- Restauration ---'",
      "Write-Host 'La restauration n''est pas automatisee par cet outil : elle remplace la'",
      "Write-Host 'configuration en place, etendues et baux compris.'",
      "Write-Host ''",
      "Write-Host 'Procedure, a executer manuellement et en connaissance de cause :'",
      "Write-Host '  1. Verifier le contenu du dossier de sauvegarde.'",
      "Write-Host '  2. Arreter le service DHCPServer.'",
      "Write-Host '  3. Restore-DhcpServer -ComputerName <serveur> -Path <dossier>'",
      "Write-Host '  4. Redemarrer le service et verifier les etendues.'",
      "Write-Host 'Reference : https://learn.microsoft.com/powershell/module/dhcpserver/restore-dhcpserver'",
      blocModeDiagnostic('Sauvegarder'),
    ];

    return assembler({
      titre: 'Sauvegarder la configuration DHCP',
      outil: 'dhcp-backup',
      diagnostic: v.bkMode !== 'Sauvegarder',
      admin: true,
      parametres: [
        ['Serveur', psB64(v.bkServer)],
        ['Dossier', psB64(v.bkFolder)],
        ['Mode', psB64(v.bkMode)],
      ],
      corps,
      prefixeFichier: 'kjemo-dhcp-sauvegarde',
      formats: 'Console',
    });
  },
  gui: [
    'Console DHCP (dhcpmgmt.msc) > clic droit sur le serveur > Sauvegarder.',
    'Choisir un dossier local ; la console propose %SystemRoot%\\System32\\dhcp\\backup par défaut.',
    'Pour restaurer : clic droit sur le serveur > Restaurer, puis sélectionner le dossier.',
    'Vérifier après restauration que les étendues et les réservations sont bien revenues.',
  ],
  keywords: [
    'sauvegarde dhcp', 'backup dhcp', 'backup-dhcpserver', 'restauration dhcp',
    'exporter configuration dhcp', 'migration dhcp',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur.',
    'Le compte de service DHCP doit pouvoir écrire dans le dossier de destination.',
    'Chemin local uniquement dans cette version : les chemins UNC sont refusés.',
    'Espace disque suffisant sur le volume de destination.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'Backup-DhcpServer : Access is denied',
      code: '0x5',
      cause: 'Le compte de service DHCP n\u2019a pas les droits d\u2019écriture sur le dossier cible.',
      fix: 'Choisir un dossier local accessible au service, ou ajuster les permissions NTFS du dossier.',
    },
    {
      message: 'La commande se termine sans erreur mais le dossier est vide',
      cause: 'Le dossier cible existait avec des droits restreints, ou la sauvegarde a été écrite ailleurs.',
      fix: 'Ce script vérifie les fichiers produits et signale ce cas au lieu de le passer sous silence.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le dossier daté contient des fichiers et un manifeste kjemo-manifeste.json.',
    'La taille totale correspond à l\u2019ordre de grandeur attendu pour la base DHCP.',
    'Le rapport affiche le nombre de fichiers écrits.',
  ],
  rollback: {
    summary: 'La sauvegarde n\u2019altère pas le serveur : elle écrit un dossier. L\u2019annulation consiste à supprimer ce dossier, ce qui n\u2019a aucun effet sur le service.',
    diagnostic: '# Constater ce qui a ete ecrit.\nGet-ChildItem -LiteralPath \'<dossier-de-sauvegarde>\' -Recurse | Format-Table FullName,Length,LastWriteTime\nGet-Content -LiteralPath (Join-Path \'<dossier-de-sauvegarde>\' \'kjemo-manifeste.json\')',
    command: '# Supprimer une sauvegarde devenue inutile. Rien de destructif pour le\n# service DHCP : ce dossier ne contient qu\'une copie. -Confirm est explicite.\nRemove-Item -LiteralPath \'<dossier-de-sauvegarde>\' -Recurse -Confirm',
    exceptional: '# AVERTISSEMENT CRITIQUE — restauration d\'une sauvegarde DHCP.\n#\n# Restore-DhcpServer REMPLACE la configuration en place : etendues, options,\n# reservations et baux du serveur cible sont ecrases par ceux de la sauvegarde.\n# Cette operation n\'est volontairement PAS automatisee dans ce lot.\n#\n# Avant de restaurer :\n#   1. Sauvegarder la configuration ACTUELLE, meme si elle semble cassee.\n#   2. Verifier la date et le contenu de la sauvegarde a restaurer.\n#   3. Prevenir : le service est interrompu pendant l\'operation.\n#\n# Procedure officielle :\n# https://learn.microsoft.com/powershell/module/dhcpserver/restore-dhcpserver\n#\n# Commandes, a executer manuellement :\n#   Stop-Service DHCPServer\n#   Restore-DhcpServer -ComputerName \'<serveur>\' -Path \'<dossier>\' -Confirm\n#   Start-Service DHCPServer',
    warning: 'Une sauvegarde qui n\u2019a jamais été restaurée en laboratoire n\u2019est pas une sauvegarde vérifiée : teste la restauration sur une machine d\u2019essai avant d\u2019en avoir besoin.',
  },
  checks: [
    'Vérifier l\u2019espace disponible avant de lancer la sauvegarde.',
    'Conserver les sauvegardes ailleurs que sur le serveur lui-même, une fois produites.',
    'Le mode Diagnostic contrôle le chemin, l\u2019espace et le contenu sans rien écrire.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dhcpserver/backup-dhcpserver',
  sources: [
    { label: 'Backup-DhcpServer', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/backup-dhcpserver' },
    { label: 'Restore-DhcpServer', url: 'https://learn.microsoft.com/powershell/module/dhcpserver/restore-dhcpserver' },
  ],
};

// ---------------------------------------------------------------------------
// C. DNS
// ---------------------------------------------------------------------------

/**
 * 7. dns-diagnostic — état d'un serveur DNS Windows, sans rien modifier.
 *
 * Un « problème DNS » recouvre des causes très différentes : service arrêté,
 * zone absente, redirecteur injoignable, résolution inverse manquante, port 53
 * filtré. Le rapport les sépare, pour que la correction porte sur la bonne.
 */
export const outilDnsDiagnostic = {
  id: 'dns-diagnostic',
  icon: '\u25cc',
  category: 'Windows Server',
  subcategory: 'DNS',
  title: 'Diagnostiquer un serveur DNS Windows',
  risk: 'diagnostic',
  summary: 'Vérifie le service, les zones, les redirecteurs, la récursivité, le cache, la résolution directe et inverse, le port 53 et les événements.',
  fields: [
    { id: 'dnsServer', label: 'Serveur DNS à interroger', default: '192.168.30.254', help: 'Nom ou adresse IPv4 du serveur.' },
    { id: 'dnsQuery', label: 'Nom à résoudre', default: 'srv-dc1.hopitalbn.lan', help: 'Nom dont la résolution directe est testée.' },
    { id: 'dnsReverse', label: 'Adresse IP pour la résolution inverse', default: '192.168.30.254' },
    {
      id: 'dnsRole', label: 'Type de serveur', type: 'select', default: 'DNS Active Directory',
      options: [['DNS Active Directory', 'DNS intégré à Active Directory'], ['DNS standard', 'DNS standard, hors domaine']],
      help: 'dcdiag /test:dns n\u2019est lancé que sur un contrôleur de domaine.',
    },
    champFormat(),
  ],
  validate(v) {
    const errors = {};
    const srv = String(v.dnsServer ?? '').trim();
    if (!validateIPv4(srv).ok && !validerFqdn(srv).ok && !validerNomHote(srv).ok) {
      errors.dnsServer = 'Indique une adresse IPv4, un nom d\u2019hôte ou un nom complet.';
    }
    verifier(errors, 'dnsQuery', validerFqdn(v.dnsQuery));
    verifier(errors, 'dnsReverse', validateIPv4(v.dnsReverse));
    verifier(errors, 'dnsRole', validerChoix(v.dnsRole, ['DNS Active Directory', 'DNS standard'], 'Le type de serveur'));
    verifier(errors, 'reportFormat', validerFormatRapport(v.reportFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const corps = [
      `$Serveur = ${psB64(v.dnsServer)}`,
      `$NomAResoudre = ${psB64(v.dnsQuery)}`,
      `$AdresseInverse = ${psB64(v.dnsReverse)}`,
      `$TypeServeur = ${psB64(v.dnsRole)}`,
      `$KjemoFormat = ${psB64(v.reportFormat)}`,
      "",
      '# --- 1. Service DNS -------------------------------------------------------',
      '$service = Get-Service -Name DNS -ErrorAction SilentlyContinue',
      'if ($null -eq $service) {',
      "  [void](Add-KjemoResultat -Categorie 'Service' -Controle 'DNS' -Etat 'INFO' -Valeur 'service local absent' -Commentaire 'Normal si tu interroges un serveur distant depuis un poste d''administration.')",
      '} else {',
      "  $etatSvc = 'PROBLEME'",
      "  $commentaireSvc = 'Service DNS arrete : aucune resolution n''est servie par ce serveur.'",
      "  if ($service.Status -eq 'Running') { $etatSvc = 'OK'; $commentaireSvc = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Service\' -Controle \'DNS\' -Etat $etatSvc -Valeur ("$($service.Status) / demarrage $($service.StartType)") -Commentaire $commentaireSvc)',
      '}',
      "",
      '# --- 2. Zones hebergees ---------------------------------------------------',
      '$zones = @()',
      'try { $zones = @(Get-DnsServerZone -ComputerName $Serveur -ErrorAction Stop) } catch {',
      '  [void](Add-KjemoResultat -Categorie \'Zones\' -Controle \'Lecture des zones\' -Etat \'ATTENTION\' -Valeur $_.Exception.Message -Commentaire "Module DnsServer absent, ou serveur injoignable.")',
      '}',
      'if (@($zones).Count -gt 0) {',
      '  $directes = @($zones | Where-Object { -not $_.IsReverseLookupZone })',
      '  $inverses = @($zones | Where-Object { $_.IsReverseLookupZone })',
      '  [void](Add-KjemoResultat -Categorie \'Zones\' -Controle \'Zones directes\' -Etat \'INFO\' -Valeur (($directes | ForEach-Object { $_.ZoneName }) -join \', \'))',
      '  if (@($inverses).Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Zones' -Controle 'Zones inverses' -Etat 'ATTENTION' -Valeur 'aucune' -Commentaire 'Sans zone inverse, la resolution PTR echoue : plusieurs outils et journaux affichent alors des adresses au lieu des noms.')",
      '  } else {',
      '    [void](Add-KjemoResultat -Categorie \'Zones\' -Controle \'Zones inverses\' -Etat \'OK\' -Valeur (($inverses | ForEach-Object { $_.ZoneName }) -join \', \'))',
      '  }',
      '  foreach ($z in $directes) {',
      '    [void](Add-KjemoResultat -Categorie \'Zones\' -Controle ("Zone $($z.ZoneName)") -Etat \'INFO\' -Valeur ("type $($z.ZoneType) ; integree AD : $($z.IsDsIntegrated) ; mises a jour dynamiques : $($z.DynamicUpdate)"))',
      '  }',
      '}',
      "",
      '# --- 3. Redirecteurs et recursivite --------------------------------------',
      '$redirecteurs = $null',
      'try { $redirecteurs = Get-DnsServerForwarder -ComputerName $Serveur -ErrorAction Stop } catch { }',
      'if ($redirecteurs) {',
      "  $liste = ($redirecteurs.IPAddress | ForEach-Object { $_.IPAddressToString }) -join ', '",
      "  $etatFwd = 'OK'",
      "  $commentaireFwd = ''",
      "  if ([string]::IsNullOrWhiteSpace($liste)) {",
      "    $etatFwd = 'ATTENTION'",
      "    $commentaireFwd = 'Aucun redirecteur : la resolution des noms Internet passe alors par les serveurs racine, ou echoue si le reseau les bloque.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'Redirecteurs\' -Controle \'Liste\' -Etat $etatFwd -Valeur $liste -Commentaire $commentaireFwd)',
      '  foreach ($ip in @($redirecteurs.IPAddress)) {',
      '    $test = $null',
      '    try { $test = Test-NetConnection -ComputerName $ip.IPAddressToString -Port 53 -WarningAction SilentlyContinue } catch { }',
      '    if ($test) {',
      "      $etatTest = 'PROBLEME'",
      "      if ($test.TcpTestSucceeded) { $etatTest = 'OK' }",
      '      [void](Add-KjemoResultat -Categorie \'Redirecteurs\' -Controle ("Port 53/TCP vers $($ip.IPAddressToString)") -Etat $etatTest -Valeur $test.TcpTestSucceeded -Commentaire "Un redirecteur injoignable fait echouer toute resolution externe.")',
      '    }',
      '  }',
      '}',
      '$recursivite = $null',
      'try { $recursivite = Get-DnsServerRecursion -ComputerName $Serveur -ErrorAction Stop } catch { }',
      'if ($recursivite) {',
      '  [void](Add-KjemoResultat -Categorie \'Recursivite\' -Controle \'Etat\' -Etat \'INFO\' -Valeur ("Activee : $($recursivite.Enable)") -Commentaire "Desactivee, le serveur ne resout que ses propres zones.")',
      '}',
      "",
      '# --- 4. Cache -------------------------------------------------------------',
      '$cache = $null',
      'try { $cache = Get-DnsServerCache -ComputerName $Serveur -ErrorAction Stop } catch { }',
      'if ($cache) {',
      '  [void](Add-KjemoResultat -Categorie \'Cache\' -Controle \'Parametres\' -Etat \'INFO\' -Valeur ("TTL max : $($cache.MaxTtl) ; TTL negatif : $($cache.MaxNegativeTtl)"))',
      '}',
      "",
      '# --- 5. Resolution directe ------------------------------------------------',
      '$directe = $null',
      'try { $directe = Resolve-DnsName -Name $NomAResoudre -Server $Serveur -Type A -DnsOnly -ErrorAction Stop } catch { }',
      'if ($directe) {',
      "  $adresses = (@($directe | Where-Object { $_.IPAddress }) | ForEach-Object { $_.IPAddress }) -join ', '",
      '  [void](Add-KjemoResultat -Categorie \'Resolution\' -Controle ("Directe : $NomAResoudre") -Etat \'OK\' -Valeur $adresses)',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Resolution' -Controle (\"Directe : $NomAResoudre\") -Etat 'PROBLEME' -Valeur 'echec' -Commentaire \"Le nom n''est pas resolu par ce serveur : zone absente, enregistrement manquant, ou serveur injoignable.\")",
      '}',
      "",
      '# --- 6. Resolution inverse -------------------------------------------------',
      '$inverse = $null',
      'try { $inverse = Resolve-DnsName -Name $AdresseInverse -Server $Serveur -Type PTR -DnsOnly -ErrorAction Stop } catch { }',
      'if ($inverse) {',
      '  [void](Add-KjemoResultat -Categorie \'Resolution\' -Controle ("Inverse : $AdresseInverse") -Etat \'OK\' -Valeur ((@($inverse) | ForEach-Object { $_.NameHost }) -join \', \'))',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Resolution' -Controle (\"Inverse : $AdresseInverse\") -Etat 'ATTENTION' -Valeur 'echec' -Commentaire \"Pas d''enregistrement PTR : cree la zone inverse correspondante si tu en as besoin.\")",
      '}',
      "",
      '# --- 7. Port 53 sur le serveur interroge ----------------------------------',
      "foreach ($proto in @('TCP')) {",
      '  $t = $null',
      '  try { $t = Test-NetConnection -ComputerName $Serveur -Port 53 -WarningAction SilentlyContinue } catch { }',
      '  if ($t) {',
      "    $etatPort = 'PROBLEME'",
      "    if ($t.TcpTestSucceeded) { $etatPort = 'OK' }",
      '    [void](Add-KjemoResultat -Categorie \'Reseau\' -Controle "Port 53/$proto" -Etat $etatPort -Valeur $t.TcpTestSucceeded -Commentaire "UDP/53 ne se teste pas de maniere fiable avec Test-NetConnection : la reponse a une requete reelle en tient lieu.")',
      '  }',
      '}',
      "",
      '# --- 8. SOA et NS de la zone du nom teste ---------------------------------',
      '$zoneDuNom = ($NomAResoudre -split \'\\.\', 2)[1]',
      "if ($zoneDuNom) {",
      '  $soa = $null',
      '  try { $soa = Resolve-DnsName -Name $zoneDuNom -Server $Serveur -Type SOA -DnsOnly -ErrorAction Stop } catch { }',
      '  if ($soa) {',
      '    [void](Add-KjemoResultat -Categorie \'Zone\' -Controle ("SOA de $zoneDuNom") -Etat \'OK\' -Valeur ((@($soa) | ForEach-Object { $_.PrimaryServer }) -join \', \'))',
      '  } else {',
      '    [void](Add-KjemoResultat -Categorie \'Zone\' -Controle ("SOA de $zoneDuNom") -Etat \'ATTENTION\' -Valeur \'introuvable\')',
      '  }',
      '  $ns = $null',
      '  try { $ns = Resolve-DnsName -Name $zoneDuNom -Server $Serveur -Type NS -DnsOnly -ErrorAction Stop } catch { }',
      '  if ($ns) {',
      '    [void](Add-KjemoResultat -Categorie \'Zone\' -Controle ("NS de $zoneDuNom") -Etat \'INFO\' -Valeur ((@($ns | Where-Object { $_.NameHost }) | ForEach-Object { $_.NameHost }) -join \', \'))',
      '  }',
      '}',
      "",
      '# --- 9. Evenements DNS recents ---------------------------------------------',
      '$evts = @()',
      "try { $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'DNS Server'; Level = @(1,2,3); StartTime = (Get-Date).AddDays(-2) } -ErrorAction Stop) } catch { $evts = @() }",
      'if (@($evts).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Evenements' -Controle 'Journal DNS Server (48 h)' -Etat 'OK' -Valeur 'aucun avertissement ni erreur')",
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Evenements\' -Controle \'Journal DNS Server (48 h)\' -Etat \'ATTENTION\' -Valeur ("$(@($evts).Count) evenement(s)") -Commentaire ((@($evts) | Select-Object -First 3 | ForEach-Object { "ID $($_.Id)" }) -join \', \'))',
      '}',
      "",
      '# --- 10. dcdiag, uniquement sur un controleur de domaine -------------------',
      '$estDc = $false',
      'try { $estDc = ((Get-CimInstance Win32_ComputerSystem).DomainRole -ge 4) } catch { }',
      "if ($TypeServeur -eq 'DNS Active Directory' -and $estDc) {",
      '  try {',
      '    $sortie = & dcdiag /test:dns /v 2>&1 | Out-String',
      '    $echecs = ([regex]::Matches($sortie, \'(?i)failed test\')).Count',
      "    $etatDcdiag = 'OK'",
      "    if ($echecs -gt 0) { $etatDcdiag = 'PROBLEME' }",
      '    [void](Add-KjemoResultat -Categorie \'Active Directory\' -Controle \'dcdiag /test:dns\' -Etat $etatDcdiag -Valeur ("$echecs test(s) en echec") -Commentaire "Sortie complete disponible en relancant dcdiag /test:dns /v a la main.")',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Active Directory' -Controle 'dcdiag /test:dns' -Etat 'IGNORE' -Valeur 'dcdiag indisponible')",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Active Directory' -Controle 'dcdiag /test:dns' -Etat 'IGNORE' -Valeur 'non applicable' -Commentaire 'Ce test ne concerne que les controleurs de domaine.')",
      '}',
    ];

    return assembler({
      titre: 'Diagnostiquer un serveur DNS Windows - lecture seule',
      outil: 'dns-diagnostic',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Serveur', psB64(v.dnsServer)],
        ['NomTeste', psB64(v.dnsQuery)],
        ['AdresseInverse', psB64(v.dnsReverse)],
        ['TypeServeur', psB64(v.dnsRole)],
      ],
      corps,
      prefixeFichier: 'kjemo-dns-diagnostic',
    });
  },
  gui: [
    'Console DNS (dnsmgmt.msc) : zones de recherche directes et inversées.',
    'Propriétés du serveur > onglet Redirecteurs, et onglet Avancé pour la récursivité.',
    'Clic droit sur le serveur > Lancer nslookup pour un test manuel.',
    'Observateur d\u2019événements > Journaux des applications et des services > DNS Server.',
    'Sur un contrôleur de domaine : invite de commandes, dcdiag /test:dns.',
  ],
  keywords: [
    'dns', 'resolution', 'nslookup', 'resolve-dnsname', 'zone dns', 'ptr', 'soa',
    'redirecteur', 'forwarder', 'recursivite', 'dcdiag', 'le nom ne se resout pas',
    'port 53', 'cache dns',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur pour lire la configuration du serveur DNS.',
    'Module DnsServer présent : rôle DNS installé, ou outils d\u2019administration RSAT-DNS-Server.',
    'Script en lecture seule : exécutable en production.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'Resolve-DnsName : DNS name does not exist',
      code: 'DNS_ERROR_RCODE_NAME_ERROR',
      cause: 'Le nom n\u2019existe pas dans les zones de ce serveur, ou le serveur ne fait pas autorité et n\u2019a pas pu résoudre.',
      fix: 'Vérifier la zone concernée et l\u2019enregistrement attendu, puis retester.',
      command: 'Get-DnsServerResourceRecord -ZoneName <zone> -Name <nom>',
    },
    {
      message: 'Get-DnsServerZone : Le terme n\u2019est pas reconnu',
      code: 'CommandNotFoundException',
      cause: 'Le module DnsServer n\u2019est pas présent sur la machine qui exécute le script.',
      fix: 'Installer les outils d\u2019administration DNS, ou exécuter depuis le serveur DNS.',
      command: 'Get-WindowsFeature RSAT-DNS-Server',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport indique l\u2019état du service, les zones et le résultat des deux résolutions.',
    'Un échec de résolution directe et un succès de résolution inverse orientent vers un enregistrement manquant, pas vers une panne du service.',
    'Les redirecteurs injoignables apparaissent explicitement.',
  ],
  rollback: {
    summary: 'Ce script interroge le serveur DNS et n\u2019écrit aucune configuration. Rien à annuler.',
    diagnostic: '# Relire l\'etat du serveur : ces commandes ne modifient rien.\nGet-DnsServerZone | Format-Table ZoneName,ZoneType,IsDsIntegrated,IsReverseLookupZone\nGet-DnsServerForwarder | Format-List',
    command: '# Aucune annulation necessaire : le script est en lecture seule.\nGet-Service DNS | Format-Table Name,Status,StartType',
    exceptional: '',
    warning: 'Le rapport décrit l\u2019infrastructure DNS interne : traite-le comme un document interne.',
  },
  checks: [
    'Interroger le serveur depuis un poste qui l\u2019utilise réellement : un test depuis le serveur lui-même masque les problèmes de filtrage.',
    'Un échec de résolution inverse n\u2019est pas toujours une panne : il faut une zone inverse pour que PTR existe.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverzone',
  sources: [
    { label: 'Get-DnsServerZone', url: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverzone' },
    { label: 'Resolve-DnsName', url: 'https://learn.microsoft.com/powershell/module/dnsclient/resolve-dnsname' },
    { label: 'Test-NetConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
    { label: 'dcdiag', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/dcdiag' },
    { label: 'DNS — documentation Windows Server', url: 'https://learn.microsoft.com/windows-server/networking/dns/dns-top' },
  ],
};

/**
 * 8. dns-zone — créer une zone directe ou inversée.
 * Une zone existante n'est JAMAIS remplacée : le script s'arrête et le dit.
 */
export const outilDnsZone = {
  id: 'dns-zone',
  icon: '\u25d3',
  category: 'Windows Server',
  subcategory: 'DNS',
  title: 'Créer une zone DNS directe ou inversée',
  risk: 'caution',
  summary: 'Valide le nom ou le réseau, détecte une zone existante, crée la zone de façon idempotente puis affiche SOA et NS.',
  fields: [
    {
      id: 'zoneType', label: 'Type de zone', type: 'select', default: 'Directe',
      options: [['Directe', 'Directe — noms vers adresses'], ['Inversée', 'Inversée — adresses vers noms']],
    },
    { id: 'zoneName', label: 'Nom de zone (directe) ou réseau CIDR (inversée)', default: 'hopitalbn.lan', help: 'Zone directe : hopitalbn.lan. Zone inversée : 192.168.30.0/24.' },
    {
      id: 'zoneStorage', label: 'Stockage', type: 'select', default: 'Active Directory',
      options: [['Active Directory', 'Intégrée à Active Directory'], ['Fichier', 'Zone standard, fichier .dns']],
    },
    {
      id: 'zoneReplication', label: 'Étendue de réplication', type: 'select', default: 'Domain',
      options: [['Domain', 'Tous les serveurs DNS du domaine'], ['Forest', 'Tous les serveurs DNS de la forêt'], ['Legacy', 'Compatibilité ascendante']],
      help: 'Ignoré pour une zone stockée en fichier.',
    },
    {
      id: 'zoneUpdates', label: 'Mises à jour dynamiques', type: 'select', default: 'Secure',
      options: [['Secure', 'Sécurisées uniquement (recommandé avec AD)'], ['NonSecure', 'Sécurisées et non sécurisées'], ['None', 'Aucune']],
    },
    { id: 'zoneServer', label: 'Serveur DNS cible', default: 'srv-dc1.hopitalbn.lan' },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    const type = verifier(errors, 'zoneType', validerChoix(v.zoneType, ['Directe', 'Inversée'], 'Le type de zone'));
    const nom = String(v.zoneName ?? '').trim();
    if (type.ok && type.value === 'Inversée') {
      const cidr = validerReseauCidr(nom);
      if (!cidr.ok) errors.zoneName = `Zone inversée : indique le réseau en notation CIDR (ex. : 192.168.30.0/24). ${cidr.error}`;
      else if (cidr.value.prefixe % 8 !== 0) {
        errors.zoneName = 'Une zone inversée classique se déclare sur un préfixe multiple de 8 (/8, /16, /24).';
      }
    } else {
      verifier(errors, 'zoneName', validerNomZoneDns(nom));
    }
    const stockage = verifier(errors, 'zoneStorage', validerChoix(v.zoneStorage, ['Active Directory', 'Fichier'], 'Le stockage'));
    verifier(errors, 'zoneReplication', validerChoix(v.zoneReplication, ['Domain', 'Forest', 'Legacy'], 'L\u2019étendue de réplication'));
    const maj = verifier(errors, 'zoneUpdates', validerChoix(v.zoneUpdates, ['Secure', 'NonSecure', 'None'], 'Les mises à jour dynamiques'));
    if (stockage.ok && maj.ok && stockage.value === 'Fichier' && maj.value === 'Secure') {
      errors.zoneUpdates = 'Les mises à jour sécurisées exigent une zone intégrée à Active Directory. Choisis « Sécurisées et non sécurisées » ou « Aucune » pour une zone fichier.';
    }
    const srv = String(v.zoneServer ?? '').trim();
    if (!validateIPv4(srv).ok && !validerFqdn(srv).ok && !validerNomHote(srv).ok) {
      errors.zoneServer = 'Indique une adresse IPv4, un nom d\u2019hôte ou un nom complet.';
    }
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const inversee = v.zoneType === 'Inversée';
    const cidr = inversee ? validerReseauCidr(v.zoneName).value : null;
    const nomZone = inversee
      ? `${cidr.reseau.split('.').slice(0, cidr.prefixe / 8).reverse().join('.')}.in-addr.arpa`
      : validerNomZoneDns(v.zoneName).value;
    const integree = v.zoneStorage === 'Active Directory';

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Serveur = ${psB64(v.zoneServer)}`,
      `$NomZone = ${psB64(nomZone)}`,
      inversee ? `$NetworkId = ${psB64(`${cidr.reseau}/${cidr.prefixe}`)}` : '$NetworkId = $null',
      `$MisesAJour = ${psB64(v.zoneUpdates)}`,
      `$Replication = ${psB64(v.zoneReplication)}`,
      `$Integree = ${integree ? '$true' : '$false'}`,
      "$KjemoFormat = 'Console'",
      "",
      '# --- 1. Service et module -------------------------------------------------',
      '$service = Get-Service -Name DNS -ErrorAction SilentlyContinue',
      'if ($service) {',
      '  [void](Add-KjemoResultat -Categorie \'Service\' -Controle \'DNS\' -Etat \'INFO\' -Valeur $service.Status)',
      '}',
      "",
      '# --- 2. La zone existe-t-elle deja ? --------------------------------------',
      '$existante = $null',
      'try { $existante = Get-DnsServerZone -ComputerName $Serveur -Name $NomZone -ErrorAction SilentlyContinue } catch { }',
      'if ($existante) {',
      '  [void](Add-KjemoResultat -Categorie \'Zone\' -Controle \'Existence\' -Etat \'ATTENTION\' -Valeur ("$($existante.ZoneName) — type $($existante.ZoneType) ; integree AD : $($existante.IsDsIntegrated) ; MAJ : $($existante.DynamicUpdate)") -Commentaire "La zone existe deja. Elle ne sera JAMAIS remplacee par ce script : remplacer une zone efface ses enregistrements.")',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Zone' -Controle 'Existence' -Etat 'INFO' -Valeur 'zone absente' -Commentaire 'Elle sera creee en mode Appliquer.')",
      '}',
      "",
      '# --- 3. Coherence demandee -------------------------------------------------',
      '[void](Add-KjemoResultat -Categorie \'Parametres\' -Controle \'Zone demandee\' -Etat \'INFO\' -Valeur ("$NomZone ; integree AD : $Integree ; mises a jour : $MisesAJour"))',
      'if (-not $Integree -and $MisesAJour -eq \'Secure\') {',
      "  [void](Add-KjemoResultat -Categorie 'Parametres' -Controle 'Coherence' -Etat 'PROBLEME' -Valeur 'incompatible' -Commentaire 'Les mises a jour securisees exigent une zone integree a Active Directory.')",
      '}',
      "",
      '# --- 4. Creation, uniquement en mode Appliquer ----------------------------',
      "if ($Mode -eq 'Appliquer') {",
      '  if ($existante) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'OK' -Valeur 'ignoree, zone deja presente' -Commentaire 'Operation idempotente : rien n''a ete ecrase.')",
      '  } else {',
      (inversee
        ? '    if ($Integree) {\n'
          + '      Add-DnsServerPrimaryZone -ComputerName $Serveur -NetworkId $NetworkId -ReplicationScope $Replication -DynamicUpdate $MisesAJour\n'
          + '    } else {\n'
          + "      Add-DnsServerPrimaryZone -ComputerName $Serveur -NetworkId $NetworkId -ZoneFile ($NomZone + '.dns') -DynamicUpdate $MisesAJour\n"
          + '    }'
        : '    if ($Integree) {\n'
          + '      Add-DnsServerPrimaryZone -ComputerName $Serveur -Name $NomZone -ReplicationScope $Replication -DynamicUpdate $MisesAJour\n'
          + '    } else {\n'
          + "      Add-DnsServerPrimaryZone -ComputerName $Serveur -Name $NomZone -ZoneFile ($NomZone + '.dns') -DynamicUpdate $MisesAJour\n"
          + '    }'),
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'INFO' -Valeur 'demandee')",
      '  }',
      "",
      '  # Relecture : SOA et NS disent si la zone est reellement en place.',
      "  Write-Host ''",
      "  Write-Host '--- Zone apres creation ---'",
      '  try { Get-DnsServerZone -ComputerName $Serveur -Name $NomZone | Format-List ZoneName,ZoneType,IsDsIntegrated,DynamicUpdate,ReplicationScope } catch { Write-Host $_.Exception.Message }',
      "  try { Get-DnsServerResourceRecord -ComputerName $Serveur -ZoneName $NomZone -RRType SOA | Format-List HostName,RecordType,RecordData } catch { }",
      "  try { Get-DnsServerResourceRecord -ComputerName $Serveur -ZoneName $NomZone -RRType NS | Format-Table HostName,RecordType,RecordData -AutoSize } catch { }",
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  if (-not $existante) {',
      (inversee
        ? '    Add-DnsServerPrimaryZone -ComputerName $Serveur -NetworkId $NetworkId -ReplicationScope $Replication -DynamicUpdate $MisesAJour -WhatIf'
        : '    Add-DnsServerPrimaryZone -ComputerName $Serveur -Name $NomZone -ReplicationScope $Replication -DynamicUpdate $MisesAJour -WhatIf'),
      '  }',
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Creer une zone DNS',
      outil: 'dns-zone',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['NomZone', psB64(nomZone)],
        ['Type', psB64(v.zoneType)],
        ['Stockage', psB64(v.zoneStorage)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-dns-zone',
      formats: 'Console',
    });
  },
  gui: [
    'Console DNS (dnsmgmt.msc) > clic droit sur « Zones de recherche directe » ou « inversée » > Nouvelle zone.',
    'Choisir « Zone principale » et, sur un contrôleur de domaine, cocher le stockage dans Active Directory.',
    'Zone inversée : saisir l\u2019ID réseau (ex. : 192.168.30) ; la console compose le nom in-addr.arpa.',
    'Choisir les mises à jour dynamiques sécurisées si la zone est intégrée à AD.',
    'Vérifier ensuite la présence des enregistrements SOA et NS dans la zone.',
  ],
  keywords: [
    'zone dns', 'zone inversee', 'in-addr.arpa', 'add-dnsserverprimaryzone',
    'creer une zone', 'mise a jour dynamique', 'replication dns', 'ptr',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur.',
    'Rôle DNS installé, ou outils d\u2019administration DNS pour agir à distance.',
    'Pour une zone intégrée : le serveur doit être contrôleur de domaine, et le compte doit pouvoir écrire dans Active Directory.',
    'Plan de nommage arrêté : une zone renommée après coup oblige à refaire les enregistrements.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'Add-DnsServerPrimaryZone : The zone already exists',
      code: 'DNS_ERROR_ZONE_ALREADY_EXISTS',
      cause: 'Une zone du même nom est déjà hébergée.',
      fix: 'Ce script ne remplace jamais une zone existante : il s\u2019arrête et l\u2019indique.',
    },
    {
      message: 'The parameter ReplicationScope is not valid for a file-backed zone',
      cause: 'L\u2019étendue de réplication ne s\u2019applique qu\u2019aux zones intégrées à Active Directory.',
      fix: 'Choisir le stockage « Active Directory », ou laisser l\u2019étendue de côté pour une zone fichier.',
    },
    {
      message: 'Les clients ne mettent pas leur enregistrement à jour',
      cause: 'Mises à jour dynamiques désactivées, ou sécurisées sur une zone non intégrée.',
      fix: 'Vérifier DynamicUpdate sur la zone, et le type de stockage.',
      command: 'Get-DnsServerZone -Name <zone> | Format-List ZoneName,IsDsIntegrated,DynamicUpdate',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Get-DnsServerZone affiche la zone avec le bon type et le bon mode de mise à jour.',
    'Les enregistrements SOA et NS existent dans la zone.',
    'Pour une zone inversée : un Resolve-DnsName -Type PTR sur une adresse du réseau répond une fois les enregistrements créés.',
  ],
  rollback: {
    summary: 'Une zone créée par erreur et encore vide se supprime sans conséquence. Une zone qui contient des enregistrements est une autre affaire : la supprimer efface tout ce qu\u2019elle contient.',
    diagnostic: '# Constater le contenu avant de supprimer quoi que ce soit.\nGet-DnsServerZone -Name \'<zone>\' | Format-List ZoneName,ZoneType,IsDsIntegrated\nGet-DnsServerResourceRecord -ZoneName \'<zone>\' | Measure-Object | Select-Object Count\nGet-DnsServerResourceRecord -ZoneName \'<zone>\' | Format-Table HostName,RecordType',
    command: '# Supprimer la zone. A ne faire que si elle vient d\'etre creee par erreur et\n# ne contient aucun enregistrement utile : la suppression emporte tout son\n# contenu. -Confirm est explicite.\nRemove-DnsServerZone -Name \'<zone>\' -Confirm',
    exceptional: '# AVERTISSEMENT CRITIQUE — suppression d\'une zone en service.\n#\n# Supprimer une zone DNS qui sert un domaine Active Directory rend le domaine\n# inutilisable : ouverture de session, replication et services s\'appuient sur\n# ces enregistrements. Cette operation n\'est pas automatisee ici.\n#\n# Avant d\'y penser :\n#   1. Exporter la zone (Export-DnsServerZone) et conserver le fichier.\n#   2. Verifier qu\'aucun service ne depend des noms qu\'elle heberge.\n#   3. Prevoir la restauration : une zone integree se recree, ses\n#      enregistrements non.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/dnsserver/remove-dnsserverzone\n#\n# Commande, a executer manuellement :\n#   Remove-DnsServerZone -Name \'<zone>\' -Confirm',
    warning: 'Sur un contrôleur de domaine, la zone du domaine Active Directory ne se supprime pas : elle se répare. Toute manipulation de cette zone doit être précédée d\u2019une sauvegarde de l\u2019état du système.',
  },
  checks: [
    'Confirmer le nom exact de la zone avant création : un nom erroné oblige à tout refaire.',
    'Pour une zone inversée, vérifier le préfixe : /24 crée 30.168.192.in-addr.arpa, pas autre chose.',
    'Sur un domaine AD, préférer la zone intégrée et les mises à jour sécurisées.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverprimaryzone',
  sources: [
    { label: 'Add-DnsServerPrimaryZone', url: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverprimaryzone' },
    { label: 'Get-DnsServerZone', url: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverzone' },
    { label: 'Get-DnsServerResourceRecord', url: 'https://learn.microsoft.com/powershell/module/dnsserver/get-dnsserverresourcerecord' },
  ],
};

/**
 * 9. dns-record — créer un enregistrement A, AAAA, CNAME ou PTR.
 * MX, SRV et TXT sont hors périmètre de ce lot, et le validateur le dit.
 */
export const outilDnsEnregistrement = {
  id: 'dns-record',
  icon: '\u25cb',
  category: 'Windows Server',
  subcategory: 'DNS',
  title: 'Créer un enregistrement DNS',
  risk: 'caution',
  summary: 'Valide selon le type choisi, vérifie la zone, détecte doublons et conflits, crée l\u2019enregistrement puis teste la résolution.',
  fields: [
    {
      id: 'recType', label: 'Type d\u2019enregistrement', type: 'select', default: 'A',
      options: [['A', 'A — nom vers adresse IPv4'], ['AAAA', 'AAAA — nom vers adresse IPv6'], ['CNAME', 'CNAME — alias vers un autre nom'], ['PTR', 'PTR — adresse vers nom']],
      help: 'MX, SRV et TXT ne sont pas pris en charge dans ce lot.',
    },
    { id: 'recZone', label: 'Zone', default: 'hopitalbn.lan', help: 'Zone directe pour A, AAAA et CNAME. Zone inversée pour PTR.' },
    { id: 'recName', label: 'Nom de l\u2019enregistrement', default: 'srv-fichiers', help: 'Relatif à la zone. « @ » désigne la zone elle-même. Pour un PTR : le dernier octet de l\u2019adresse.' },
    { id: 'recIPv4', label: 'Adresse IPv4 (type A)', default: '192.168.30.20' },
    { id: 'recIPv6', label: 'Adresse IPv6 (type AAAA)', default: '2001:db8:30::20' },
    { id: 'recTarget', label: 'Cible (CNAME ou PTR)', default: 'srv-fichiers.hopitalbn.lan', help: 'Nom complet vers lequel pointe l\u2019alias ou l\u2019enregistrement inverse.' },
    { id: 'recServer', label: 'Serveur DNS cible', default: 'srv-dc1.hopitalbn.lan' },
    champMode(),
  ],
  validate(v) {
    const errors = {};
    const type = verifier(errors, 'recType', validerTypeEnregistrement(v.recType));
    const zone = String(v.recZone ?? '').trim();
    verifier(errors, 'recZone', validerNomZoneDns(zone));
    verifier(errors, 'recName', validerNomEnregistrement(v.recName));

    if (type.ok) {
      if (type.value === 'A') verifier(errors, 'recIPv4', validateIPv4(v.recIPv4));
      if (type.value === 'AAAA') verifier(errors, 'recIPv6', validerIPv6(v.recIPv6));
      if (type.value === 'CNAME' || type.value === 'PTR') {
        verifier(errors, 'recTarget', validerFqdn(v.recTarget));
      }
      if (type.value === 'PTR' && zone && !/in-addr\.arpa$|ip6\.arpa$/i.test(zone)) {
        errors.recZone = 'Un enregistrement PTR se crée dans une zone inversée (…in-addr.arpa ou …ip6.arpa).';
      }
      if (type.value !== 'PTR' && /in-addr\.arpa$|ip6\.arpa$/i.test(zone)) {
        errors.recZone = `Une zone inversée n\u2019accueille que des enregistrements PTR, pas des ${type.value}.`;
      }
    }

    const srv = String(v.recServer ?? '').trim();
    if (!validateIPv4(srv).ok && !validerFqdn(srv).ok && !validerNomHote(srv).ok) {
      errors.recServer = 'Indique une adresse IPv4, un nom d\u2019hôte ou un nom complet.';
    }
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const type = validerTypeEnregistrement(v.recType).value;

    const creation = {
      A: 'Add-DnsServerResourceRecordA -ComputerName $Serveur -ZoneName $Zone -Name $Nom -IPv4Address $Valeur',
      AAAA: 'Add-DnsServerResourceRecordAAAA -ComputerName $Serveur -ZoneName $Zone -Name $Nom -IPv6Address $Valeur',
      CNAME: 'Add-DnsServerResourceRecordCName -ComputerName $Serveur -ZoneName $Zone -Name $Nom -HostNameAlias $Valeur',
      PTR: 'Add-DnsServerResourceRecordPtr -ComputerName $Serveur -ZoneName $Zone -Name $Nom -PtrDomainName $Valeur',
    }[type];

    const valeur = { A: v.recIPv4, AAAA: v.recIPv6, CNAME: v.recTarget, PTR: v.recTarget }[type];

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Serveur = ${psB64(v.recServer)}`,
      `$Zone = ${psB64(validerNomZoneDns(v.recZone).value)}`,
      `$Nom = ${psB64(v.recName)}`,
      `$Type = ${psB64(type)}`,
      `$Valeur = ${psB64(valeur)}`,
      "$KjemoFormat = 'Console'",
      "",
      '# --- 1. La zone existe-t-elle ? -------------------------------------------',
      '$zoneObj = $null',
      'try { $zoneObj = Get-DnsServerZone -ComputerName $Serveur -Name $Zone -ErrorAction SilentlyContinue } catch { }',
      'if ($null -eq $zoneObj) {',
      "  [void](Add-KjemoResultat -Categorie 'Zone' -Controle 'Existence' -Etat 'PROBLEME' -Valeur 'zone introuvable' -Commentaire 'Cree la zone avant d''y ajouter un enregistrement.')",
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Zone\' -Controle \'Existence\' -Etat \'OK\' -Valeur ("$($zoneObj.ZoneName) — type $($zoneObj.ZoneType)"))',
      '}',
      "",
      '# --- 2. Enregistrement identique ou conflictuel ? -------------------------',
      '$existants = @()',
      'try { $existants = @(Get-DnsServerResourceRecord -ComputerName $Serveur -ZoneName $Zone -Name $Nom -ErrorAction SilentlyContinue) } catch { }',
      '$identique = $false',
      '$conflit = $null',
      'foreach ($e in $existants) {',
      '  $donnee = ($e.RecordData | Out-String).Trim()',
      '  if ($e.RecordType -eq $Type -and $donnee -like "*$Valeur*") { $identique = $true }',
      '  elseif ($e.RecordType -eq $Type) { $conflit = "$($e.RecordType) existant avec une autre valeur : $donnee" }',
      "  elseif ($e.RecordType -eq 'CNAME' -or $Type -eq 'CNAME') { $conflit = \"un CNAME ne peut pas coexister avec un autre enregistrement du meme nom (present : $($e.RecordType))\" }",
      '}',
      'if ($identique) {',
      "  [void](Add-KjemoResultat -Categorie 'Enregistrement' -Controle 'Existence' -Etat 'OK' -Valeur 'deja present, identique' -Commentaire 'Rien a faire : l''operation est idempotente.')",
      '} elseif ($conflit) {',
      "  [void](Add-KjemoResultat -Categorie 'Enregistrement' -Controle 'Conflit' -Etat 'PROBLEME' -Valeur $conflit -Commentaire 'Resous le conflit : un enregistrement ne sera pas ecrase par ce script.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Enregistrement' -Controle 'Existence' -Etat 'INFO' -Valeur 'aucun enregistrement correspondant')",
      '}',
      '[void](Add-KjemoResultat -Categorie \'Enregistrement\' -Controle \'A creer\' -Etat \'INFO\' -Valeur ("$Type $Nom dans $Zone -> $Valeur"))',
      "",
      '# --- 3. Creation, uniquement en mode Appliquer ----------------------------',
      "if ($Mode -eq 'Appliquer') {",
      '  if ($identique) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'OK' -Valeur 'ignoree, enregistrement identique deja present')",
      '  } elseif ($conflit) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'PROBLEME' -Valeur 'refusee' -Commentaire 'Conflit detecte : rien n''a ete cree.')",
      '  } else {',
      `    ${creation}`,
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Creation' -Etat 'INFO' -Valeur 'demandee')",
      '  }',
      "",
      "  # Relecture, puis resolution reelle : l'enregistrement existe-t-il vraiment ?",
      "  Write-Host ''",
      "  Write-Host '--- Enregistrements apres modification ---'",
      '  try { Get-DnsServerResourceRecord -ComputerName $Serveur -ZoneName $Zone -Name $Nom | Format-Table HostName,RecordType,RecordData -AutoSize } catch { Write-Host $_.Exception.Message }',
      "  if ($Type -ne 'PTR') {",
      '    $fqdn = $Nom + \'.\' + $Zone',
      "    if ($Nom -eq '@') { $fqdn = $Zone }",
      '    try { Resolve-DnsName -Name $fqdn -Server $Serveur -DnsOnly -ErrorAction Stop | Format-Table Name,Type,IPAddress,NameHost -AutoSize } catch { Write-Host "Resolution : $($_.Exception.Message)" }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation (-WhatIf) ---'",
      '  if (-not $identique -and -not $conflit) {',
      `    ${creation} -WhatIf`,
      '  }',
      '}',
      blocModeDiagnostic(),
    ];

    return assembler({
      titre: 'Creer un enregistrement DNS',
      outil: 'dns-record',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Zone', psB64(v.recZone)],
        ['Nom', psB64(v.recName)],
        ['Type', psB64(type)],
        ['Mode', psB64(v.mode)],
      ],
      corps,
      prefixeFichier: 'kjemo-dns-enregistrement',
      formats: 'Console',
    });
  },
  gui: [
    'Console DNS (dnsmgmt.msc) > la zone > clic droit > Nouvel hôte (A ou AAAA), Nouvel alias (CNAME) ou Nouveau pointeur (PTR).',
    'Pour un hôte : cocher « Créer un enregistrement PTR associé » si la zone inversée existe.',
    'Vérifier l\u2019enregistrement dans la liste de la zone après création.',
    'Tester depuis un client avec nslookup <nom> <serveur>.',
  ],
  keywords: [
    'enregistrement dns', 'record', 'type a', 'aaaa', 'cname', 'ptr', 'alias dns',
    'add-dnsserverresourcerecord', 'creer un nom dns', 'resolution inverse',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur.',
    'Zone déjà créée, et du bon type : directe pour A, AAAA et CNAME, inversée pour PTR.',
    'Module DnsServer disponible localement si le serveur est administré à distance.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'The record already exists',
      code: 'DNS_ERROR_RECORD_ALREADY_EXISTS',
      cause: 'Un enregistrement du même nom et du même type existe déjà.',
      fix: 'Ce script détecte le doublon avant d\u2019agir et ne remplace rien.',
    },
    {
      message: 'CNAME and other data',
      code: 'DNS_ERROR_CNAME_COLLISION',
      cause: 'Un alias CNAME ne peut pas coexister avec un autre enregistrement portant le même nom.',
      fix: 'Choisir un autre nom d\u2019alias, ou retirer l\u2019enregistrement concurrent après vérification.',
    },
    {
      message: 'Le nom se résout mais pas en inverse',
      cause: 'L\u2019enregistrement PTR n\u2019existe pas, souvent parce que la zone inversée a été créée après l\u2019hôte.',
      fix: 'Créer la zone inversée, puis l\u2019enregistrement PTR correspondant.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Get-DnsServerResourceRecord affiche l\u2019enregistrement avec la bonne valeur.',
    'Resolve-DnsName sur le nom complet retourne la valeur attendue.',
    'Pour un PTR : Resolve-DnsName -Type PTR sur l\u2019adresse retourne le nom.',
  ],
  rollback: {
    summary: 'Un enregistrement se retire sans toucher au reste de la zone. C\u2019est réversible tant que l\u2019on sait quelle valeur remettre — d\u2019où la relecture avant suppression.',
    diagnostic: '# Noter la valeur exacte avant de supprimer : c\'est ce qui permettra de\n# la recreer a l\'identique si besoin.\nGet-DnsServerResourceRecord -ZoneName \'<zone>\' -Name \'<nom>\' | Format-List HostName,RecordType,RecordData,TimeToLive',
    command: '# Supprimer l\'enregistrement. -Confirm est explicite : PowerShell demandera\n# confirmation avant de retirer quoi que ce soit.\n$enr = Get-DnsServerResourceRecord -ZoneName \'<zone>\' -Name \'<nom>\' -RRType \'<type>\'\nRemove-DnsServerResourceRecord -ZoneName \'<zone>\' -InputObject $enr -Confirm',
    exceptional: '',
    warning: 'Supprimer l\u2019enregistrement d\u2019un serveur en service le rend injoignable par son nom dès que le cache des clients expire. Vérifie ce qui dépend de ce nom avant d\u2019agir.',
  },
  checks: [
    'Vérifier que la zone est du bon type avant de créer l\u2019enregistrement.',
    'Pour un PTR, le nom est le dernier octet de l\u2019adresse dans une zone /24.',
    'Le cache des clients retarde la prise en compte : ipconfig /flushdns pour tester immédiatement.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverresourcerecorda',
  sources: [
    { label: 'Add-DnsServerResourceRecordA', url: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverresourcerecorda' },
    { label: 'Add-DnsServerResourceRecordAAAA', url: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverresourcerecordaaaa' },
    { label: 'Add-DnsServerResourceRecordCName', url: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverresourcerecordcname' },
    { label: 'Add-DnsServerResourceRecordPtr', url: 'https://learn.microsoft.com/powershell/module/dnsserver/add-dnsserverresourcerecordptr' },
    { label: 'Remove-DnsServerResourceRecord', url: 'https://learn.microsoft.com/powershell/module/dnsserver/remove-dnsserverresourcerecord' },
  ],
};

// ---------------------------------------------------------------------------
// D. SERVEUR DE FICHIERS
// ---------------------------------------------------------------------------

/**
 * 10. file-permissions-audit — lire les permissions NTFS et SMB, et rien d'autre.
 *
 * Les droits effectifs d'un partage sont l'intersection des permissions SMB et
 * NTFS. Les regarder séparément explique mal ce que voit l'utilisateur ; le
 * rapport les met donc côte à côte.
 */
export const outilAuditPermissions = {
  id: 'file-permissions-audit',
  icon: '\u25e7',
  category: 'Windows Server',
  subcategory: 'Serveur de fichiers',
  title: 'Auditer les permissions NTFS et SMB',
  risk: 'diagnostic',
  summary: 'Relève propriétaire, ACL NTFS, héritage, permissions SMB, et signale Everyone FullControl, refus explicites et ACL orphelines.',
  fields: [
    { id: 'auditPath', label: 'Chemin local à auditer', default: 'C:\\Partages\\Donnees' },
    { id: 'auditShare', label: 'Nom du partage (facultatif)', default: 'Donnees', help: 'Laisser vide pour n\u2019auditer que le système de fichiers.' },
    { id: 'auditDepth', label: 'Profondeur d\u2019analyse', default: '1', help: '0 = le dossier seul. 1 = ses enfants directs. Maximum 10.' },
    {
      id: 'auditInherited', label: 'Inclure les permissions héritées', type: 'select', default: 'Non',
      options: [['Non', 'Non — seulement les permissions explicites'], ['Oui', 'Oui — héritées et explicites']],
      help: 'Les permissions explicites sont celles qui ont été posées sur l\u2019objet lui-même.',
    },
    champFormat('auditFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'auditPath', validerCheminWindowsLocal(v.auditPath));
    const partage = String(v.auditShare ?? '').trim();
    if (partage) verifier(errors, 'auditShare', validateShareName(partage));
    verifier(errors, 'auditDepth', validerProfondeur(v.auditDepth));
    verifier(errors, 'auditInherited', validerChoix(v.auditInherited, ['Oui', 'Non'], 'L\u2019option d\u2019héritage'));
    verifier(errors, 'auditFormat', validerFormatRapport(v.auditFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const partage = String(v.auditShare ?? '').trim();
    const corps = [
      `$Chemin = ${psB64(validerCheminWindowsLocal(v.auditPath).value)}`,
      partage ? `$Partage = ${psB64(partage)}` : "$Partage = ''",
      `$Profondeur = [int](${psB64(v.auditDepth)})`,
      `$AvecHeritees = ${psB64(v.auditInherited)}`,
      `$KjemoFormat = ${psB64(v.auditFormat)}`,
      "",
      '# --- 1. Le chemin existe-t-il ? -------------------------------------------',
      'if (-not (Test-Path -LiteralPath $Chemin)) {',
      "  [void](Add-KjemoResultat -Categorie 'Chemin' -Controle 'Existence' -Etat 'PROBLEME' -Valeur $Chemin -Commentaire 'Dossier introuvable : verifie le chemin.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Chemin' -Controle 'Existence' -Etat 'OK' -Valeur $Chemin)",
      "",
      '  # --- 2. Proprietaire et ACL NTFS du dossier racine ---------------------',
      '  $acl = $null',
      '  try { $acl = Get-Acl -LiteralPath $Chemin } catch {',
      '    [void](Add-KjemoResultat -Categorie \'NTFS\' -Controle \'Lecture de l\'\'ACL\' -Etat \'PROBLEME\' -Valeur $_.Exception.Message)',
      '  }',
      '  if ($acl) {',
      "    [void](Add-KjemoResultat -Categorie 'NTFS' -Controle 'Proprietaire' -Etat 'INFO' -Valeur $acl.Owner)",
      '    $heritageActif = -not $acl.AreAccessRulesProtected',
      "    [void](Add-KjemoResultat -Categorie 'NTFS' -Controle 'Heritage' -Etat 'INFO' -Valeur (\"actif : $heritageActif\") -Commentaire \"Heritage coupe signifie que les droits du parent ne s''appliquent plus ici.\")",
      "",
      '    $regles = @($acl.Access)',
      "    if ($AvecHeritees -eq 'Non') { $regles = @($regles | Where-Object { -not $_.IsInherited }) }",
      '    foreach ($regle in $regles) {',
      "      $etatRegle = 'INFO'",
      "      $commentaireRegle = ''",
      "      if ($regle.IdentityReference -match 'Everyone|Tout le monde' -and $regle.FileSystemRights -match 'FullControl') {",
      "        $etatRegle = 'PROBLEME'",
      "        $commentaireRegle = 'Everyone en controle total : tout utilisateur authentifie ou non peut modifier et supprimer.'",
      '      }',
      "      elseif ($regle.AccessControlType -eq 'Deny') {",
      "        $etatRegle = 'ATTENTION'",
      "        $commentaireRegle = 'Refus explicite : il l''emporte sur toute autorisation, y compris celle d''un groupe d''administration.'",
      '      }',
      '      # Une identite non resolue (SID brut) signale un compte supprime.',
      "      elseif ($regle.IdentityReference.Value -match '^S-1-[0-9-]+$') {",
      "        $etatRegle = 'ATTENTION'",
      "        $commentaireRegle = 'ACL orpheline : le compte ou groupe n''existe plus dans l''annuaire.'",
      '      }',
      '      [void](Add-KjemoResultat -Categorie \'NTFS\' -Controle $regle.IdentityReference.Value -Etat $etatRegle -Valeur ("$($regle.AccessControlType) $($regle.FileSystemRights) ; herite : $($regle.IsInherited)") -Commentaire $commentaireRegle)',
      '    }',
      '  }',
      "",
      "  # --- 3. Sous-dossiers, jusqu'a la profondeur demandee -----------------",
      '  if ($Profondeur -gt 0) {',
      '    $enfants = @()',
      '    try { $enfants = @(Get-ChildItem -LiteralPath $Chemin -Directory -Recurse -Depth ($Profondeur - 1) -ErrorAction SilentlyContinue) } catch { }',
      '    foreach ($enfant in $enfants) {',
      '      $aclEnfant = $null',
      '      try { $aclEnfant = Get-Acl -LiteralPath $enfant.FullName } catch { continue }',
      '      $explicites = @($aclEnfant.Access | Where-Object { -not $_.IsInherited })',
      '      if (@($explicites).Count -gt 0) {',
      "        [void](Add-KjemoResultat -Categorie 'NTFS — sous-dossiers' -Controle $enfant.FullName -Etat 'INFO' -Valeur ((@($explicites) | ForEach-Object { \"$($_.IdentityReference.Value) : $($_.AccessControlType) $($_.FileSystemRights)\" }) -join ' ; ') -Commentaire \"Permissions explicites : elles s''ajoutent ou se substituent a l''heritage.\")",
      '      }',
      '      if ($aclEnfant.AreAccessRulesProtected) {',
      "        [void](Add-KjemoResultat -Categorie 'NTFS — sous-dossiers' -Controle $enfant.FullName -Etat 'ATTENTION' -Valeur 'heritage coupe' -Commentaire 'Ce dossier ne suit plus les droits de son parent.')",
      '      }',
      '    }',
      '  }',
      '}',
      "",
      '# --- 4. Permissions SMB et comparaison avec NTFS ---------------------------',
      "if ($Partage -ne '') {",
      '  $share = $null',
      '  try { $share = Get-SmbShare -Name $Partage -ErrorAction SilentlyContinue } catch { }',
      '  if ($null -eq $share) {',
      '    [void](Add-KjemoResultat -Categorie \'SMB\' -Controle \'Partage\' -Etat \'ATTENTION\' -Valeur "$Partage introuvable" -Commentaire "Le dossier peut exister sans etre partage.")',
      '  } else {',
      '    [void](Add-KjemoResultat -Categorie \'SMB\' -Controle \'Partage\' -Etat \'OK\' -Valeur ("$($share.Name) -> $($share.Path) ; description : $($share.Description)"))',
      '    if ($share.Path -ne $Chemin) {',
      '      [void](Add-KjemoResultat -Categorie \'SMB\' -Controle \'Coherence chemin\' -Etat \'ATTENTION\' -Valeur ("partage : $($share.Path) ; audite : $Chemin") -Commentaire "Le partage ne pointe pas vers le dossier audite : les droits compares ne portent pas sur le meme contenu.")',
      '    }',
      '    $acces = @()',
      '    try { $acces = @(Get-SmbShareAccess -Name $Partage) } catch { }',
      '    foreach ($a in $acces) {',
      "      $etatAcces = 'INFO'",
      "      $commentaireAcces = ''",
      "      if ($a.AccountName -match 'Everyone|Tout le monde' -and $a.AccessRight -eq 'Full') {",
      "        $etatAcces = 'ATTENTION'",
      "        $commentaireAcces = 'Everyone en controle total cote SMB. Usage courant lorsque NTFS restreint reellement, mais a verifier.'",
      '      }',
      '      [void](Add-KjemoResultat -Categorie \'SMB\' -Controle $a.AccountName -Etat $etatAcces -Valeur ("$($a.AccessControlType) $($a.AccessRight)") -Commentaire $commentaireAcces)',
      '    }',
      "",
      "    # Les droits effectifs sont l'intersection des deux couches.",
      "    [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'NTFS et SMB' -Etat 'INFO' -Valeur 'voir les deux sections ci-dessus' -Commentaire 'Les droits effectifs d''un acces reseau sont l''intersection : le plus restrictif des deux l''emporte.')",
      '  }',
      '}',
      "",
      '# Rappel : cet outil ne modifie AUCUNE permission.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Modifications' -Etat 'OK' -Valeur 'aucune' -Commentaire 'Audit en lecture seule : aucun droit n''a ete change.')",
    ];

    return assembler({
      titre: 'Auditer les permissions NTFS et SMB - lecture seule',
      outil: 'file-permissions-audit',
      diagnostic: true,
      admin: true,
      parametres: [
        ['Chemin', psB64(v.auditPath)],
        ['Partage', partage ? psB64(partage) : "'(aucun)'"],
        ['Profondeur', psB64(v.auditDepth)],
        ['AvecHeritees', psB64(v.auditInherited)],
      ],
      corps,
      prefixeFichier: 'kjemo-permissions',
    });
  },
  gui: [
    'Explorateur : clic droit sur le dossier > Propriétés > onglet Sécurité pour les permissions NTFS.',
    'Bouton Avancé : propriétaire, héritage, et permissions effectives d\u2019un utilisateur donné.',
    'Onglet Partage > Partage avancé > Autorisations pour les permissions SMB.',
    'Gestionnaire de serveur > Services de fichiers et de stockage > Partages, pour la vue d\u2019ensemble.',
  ],
  keywords: [
    'permissions', 'ntfs', 'smb', 'acl', 'droits d acces', 'everyone', 'refus explicite',
    'heritage', 'get-acl', 'acces refuse au partage', 'audit des droits', 'sid orphelin',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur : lire une ACL complète demande des droits sur le dossier.',
    'Le dossier audité doit être local à la machine qui exécute le script.',
    'Script en lecture seule : aucune permission n\u2019est modifiée.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'Get-Acl : Accès au chemin refusé',
      code: 'UnauthorizedAccessException',
      cause: 'Le compte courant n\u2019a pas le droit de lire les permissions du dossier.',
      fix: 'Exécuter la console en tant qu\u2019administrateur, ou prendre connaissance du propriétaire avec Get-Acl sur le parent.',
    },
    {
      message: 'L\u2019utilisateur voit le partage mais ne peut pas ouvrir les fichiers',
      cause: 'Les droits SMB autorisent, mais NTFS refuse : c\u2019est l\u2019intersection qui s\u2019applique.',
      fix: 'Comparer les deux sections du rapport et corriger la couche la plus restrictive.',
    },
    {
      message: 'Une entrée d\u2019ACL affiche un SID au lieu d\u2019un nom',
      cause: 'Le compte ou groupe a été supprimé de l\u2019annuaire : l\u2019ACL est orpheline.',
      fix: 'Retirer l\u2019entrée après avoir vérifié qu\u2019aucun accès légitime n\u2019en dépend.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport liste propriétaire, héritage et chaque entrée d\u2019ACL avec son état.',
    'Les entrées Everyone FullControl, les refus explicites et les SID non résolus sont signalés.',
    'Quand un partage est indiqué, les droits SMB apparaissent à côté des droits NTFS.',
  ],
  rollback: {
    summary: 'Cet audit ne modifie aucune permission : il n\u2019y a rien à annuler. C\u2019est précisément son intérêt — comprendre avant de toucher.',
    diagnostic: '# Relire les permissions : ces commandes n\'ecrivent rien.\nGet-Acl -LiteralPath \'<chemin>\' | Format-List Owner,AreAccessRulesProtected\nGet-Acl -LiteralPath \'<chemin>\' | Select-Object -ExpandProperty Access | Format-Table IdentityReference,AccessControlType,FileSystemRights,IsInherited',
    command: '# Aucune annulation necessaire : audit en lecture seule.\nGet-SmbShareAccess -Name \'<partage>\' | Format-Table AccountName,AccessControlType,AccessRight',
    exceptional: '',
    warning: 'Le rapport détaille qui a accès à quoi : c\u2019est un document sensible au sens organisationnel. Il ne contient en revanche ni mot de passe, ni contenu de fichier.',
  },
  checks: [
    'Auditer avant de modifier : une permission retirée sans inventaire préalable est difficile à rétablir à l\u2019identique.',
    'Une profondeur élevée sur une arborescence volumineuse allonge sensiblement l\u2019exécution.',
    'Everyone FullControl côté SMB n\u2019est pas forcément une faute si NTFS restreint réellement — mais cela doit être un choix, pas un oubli.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl',
  sources: [
    { label: 'Get-Acl', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl' },
    { label: 'Get-SmbShareAccess', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshareaccess' },
    { label: 'Get-SmbShare', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshare' },
  ],
};

/**
 * 11. smb-sessions-diagnostic — voir qui est connecté et quels fichiers sont ouverts.
 *
 * Fermer une session ou un fichier ouvert n'est PAS automatisé : couper un
 * fichier en cours d'écriture fait perdre le travail de quelqu'un.
 */
export const outilSmbSessions = {
  id: 'smb-sessions-diagnostic',
  icon: '\u25eb',
  category: 'Windows Server',
  subcategory: 'Serveur de fichiers',
  title: 'Diagnostiquer les sessions et fichiers SMB ouverts',
  risk: 'diagnostic',
  summary: 'Liste partages, sessions, fichiers ouverts, durées, erreurs SMB récentes, état du service et disponibilité du port 445.',
  fields: [
    { id: 'smbShareFilter', label: 'Filtrer par partage (facultatif)', default: '', help: 'Laisser vide pour tous les partages.' },
    { id: 'smbUserFilter', label: 'Filtrer par utilisateur (facultatif)', default: '', help: 'Recherche partielle sur le nom de compte.' },
    { id: 'smbHours', label: 'Fenêtre des erreurs SMB (heures)', default: '24' },
    champFormat('smbFormat'),
  ],
  validate(v) {
    const errors = {};
    const partage = String(v.smbShareFilter ?? '').trim();
    if (partage) verifier(errors, 'smbShareFilter', validateShareName(partage));
    const utilisateur = String(v.smbUserFilter ?? '').trim();
    if (utilisateur && utilisateur.length > 104) errors.smbUserFilter = 'Le nom de compte ne doit pas dépasser 104 caractères.';
    if (/[\x00-\x1f\x7f]/.test(utilisateur)) errors.smbUserFilter = 'Le filtre contient un caractère de contrôle non autorisé.';
    verifier(errors, 'smbHours', validerEntier(v.smbHours, 1, 720, 'La fenêtre des erreurs'));
    verifier(errors, 'smbFormat', validerFormatRapport(v.smbFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const partage = String(v.smbShareFilter ?? '').trim();
    const utilisateur = String(v.smbUserFilter ?? '').trim();

    const corps = [
      partage ? `$FiltrePartage = ${psB64(partage)}` : "$FiltrePartage = ''",
      utilisateur ? `$FiltreUtilisateur = ${psB64(utilisateur)}` : "$FiltreUtilisateur = ''",
      `$Heures = [int](${psB64(v.smbHours)})`,
      `$KjemoFormat = ${psB64(v.smbFormat)}`,
      "",
      '# --- 1. Service et port ----------------------------------------------------',
      '$service = Get-Service -Name LanmanServer -ErrorAction SilentlyContinue',
      'if ($service) {',
      "  $etatSvc = 'PROBLEME'",
      "  $commentaireSvc = 'Service Serveur arrete : aucun partage n''est accessible.'",
      "  if ($service.Status -eq 'Running') { $etatSvc = 'OK'; $commentaireSvc = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Service\' -Controle \'LanmanServer\' -Etat $etatSvc -Valeur ("$($service.Status) / demarrage $($service.StartType)") -Commentaire $commentaireSvc)',
      '}',
      '$port = $null',
      'try { $port = Test-NetConnection -ComputerName $env:COMPUTERNAME -Port 445 -WarningAction SilentlyContinue } catch { }',
      'if ($port) {',
      "  $etatPort = 'PROBLEME'",
      "  if ($port.TcpTestSucceeded) { $etatPort = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Reseau\' -Controle \'Port 445\' -Etat $etatPort -Valeur $port.TcpTestSucceeded -Commentaire "Sans 445 ouvert, aucun client ne joint les partages.")',
      '}',
      "",
      '# --- 2. Partages publies ---------------------------------------------------',
      '$partages = @()',
      'try { $partages = @(Get-SmbShare) } catch { }',
      "if ($FiltrePartage -ne '') { $partages = @($partages | Where-Object { $_.Name -like \"*$FiltrePartage*\" }) }",
      'foreach ($p in $partages) {',
      '  [void](Add-KjemoResultat -Categorie \'Partages\' -Controle $p.Name -Etat \'INFO\' -Valeur ("$($p.Path) ; type $($p.ShareType) ; description : $($p.Description)"))',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Partages\' -Controle \'Total\' -Etat \'INFO\' -Valeur ("$(@($partages).Count) partage(s)"))',
      "",
      '# --- 3. Sessions ouvertes ---------------------------------------------------',
      '$sessions = @()',
      'try { $sessions = @(Get-SmbSession) } catch { }',
      "if ($FiltreUtilisateur -ne '') { $sessions = @($sessions | Where-Object { $_.ClientUserName -like \"*$FiltreUtilisateur*\" }) }",
      'foreach ($s in $sessions) {',
      '  [void](Add-KjemoResultat -Categorie \'Sessions\' -Controle $s.ClientUserName -Etat \'INFO\' -Valeur ("machine : $($s.ClientComputerName) ; fichiers ouverts : $($s.NumOpens) ; session : $($s.SessionId)"))',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Sessions\' -Controle \'Total\' -Etat \'INFO\' -Valeur ("$(@($sessions).Count) session(s)"))',
      "",
      '# --- 4. Fichiers ouverts ----------------------------------------------------',
      '$ouverts = @()',
      'try { $ouverts = @(Get-SmbOpenFile) } catch { }',
      "if ($FiltrePartage -ne '') { $ouverts = @($ouverts | Where-Object { $_.ShareRelativePath -like \"*$FiltrePartage*\" -or $_.Path -like \"*$FiltrePartage*\" }) }",
      "if ($FiltreUtilisateur -ne '') { $ouverts = @($ouverts | Where-Object { $_.ClientUserName -like \"*$FiltreUtilisateur*\" }) }",
      'foreach ($o in $ouverts) {',
      '  [void](Add-KjemoResultat -Categorie \'Fichiers ouverts\' -Controle $o.Path -Etat \'INFO\' -Valeur ("utilisateur : $($o.ClientUserName) ; machine : $($o.ClientComputerName) ; verrous : $($o.Locks) ; id : $($o.FileId)"))',
      '}',
      '[void](Add-KjemoResultat -Categorie \'Fichiers ouverts\' -Controle \'Total\' -Etat \'INFO\' -Valeur ("$(@($ouverts).Count) fichier(s) ouvert(s)"))',
      "",
      '# --- 5. Erreurs SMB recentes ------------------------------------------------',
      '$depuis = (Get-Date).AddHours(-1 * $Heures)',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-SMBServer/Operational'; Level = @(1,2,3); StartTime = $depuis } -ErrorAction Stop)",
      '} catch { $evts = @() }',
      'if (@($evts).Count -eq 0) {',
      '  [void](Add-KjemoResultat -Categorie \'Evenements\' -Controle "Journal SMBServer ($Heures h)" -Etat \'OK\' -Valeur \'aucun avertissement ni erreur\')',
      '} else {',
      '  $groupes = $evts | Group-Object Id | Sort-Object Count -Descending | Select-Object -First 5',
      '  [void](Add-KjemoResultat -Categorie \'Evenements\' -Controle "Journal SMBServer ($Heures h)" -Etat \'ATTENTION\' -Valeur ((@($groupes) | ForEach-Object { "ID $($_.Name) : $($_.Count)" }) -join \' ; \') -Commentaire ("$(@($evts).Count) evenement(s) au total."))',
      '}',
      "",
      "# --- 6. Detail tabulaire pour la console et l'export CSV -------------------",
      "Write-Host ''",
      "Write-Host '--- Sessions ---'",
      '$sessions | Select-Object ClientUserName,ClientComputerName,NumOpens,SessionId | Format-Table -AutoSize',
      "Write-Host '--- Fichiers ouverts ---'",
      '$ouverts | Select-Object ClientUserName,ClientComputerName,Path,Locks,FileId | Format-Table -AutoSize',
      "",
      '# --- 7. Fermeture : cas exceptionnel, jamais automatise ---------------------',
      "Write-Host ''",
      "Write-Host '--- Fermer une session ou un fichier ---'",
      "Write-Host 'Cet outil ne ferme rien. Fermer un fichier ouvert fait perdre les'",
      "Write-Host 'modifications non enregistrees de la personne qui l''utilise.'",
      "Write-Host 'A n''envisager qu''apres avoir identifie et prevenu l''utilisateur :'",
      "Write-Host '  Close-SmbOpenFile -FileId <id> -Confirm'",
      "Write-Host '  Close-SmbSession -SessionId <id> -Confirm'",
      "Write-Host 'Reference : https://learn.microsoft.com/powershell/module/smbshare/close-smbopenfile'",
    ];

    return assembler({
      titre: 'Diagnostiquer les sessions et fichiers SMB - lecture seule',
      outil: 'smb-sessions-diagnostic',
      diagnostic: true,
      admin: true,
      parametres: [
        ['FiltrePartage', partage ? psB64(partage) : "'(aucun)'"],
        ['FiltreUtilisateur', utilisateur ? psB64(utilisateur) : "'(aucun)'"],
        ['FenetreHeures', psB64(v.smbHours)],
      ],
      corps,
      prefixeFichier: 'kjemo-smb-sessions',
    });
  },
  gui: [
    'Gestion de l\u2019ordinateur (compmgmt.msc) > Dossiers partagés > Partages, Sessions, Fichiers ouverts.',
    'Gestionnaire de serveur > Services de fichiers et de stockage > Partages pour la vue d\u2019ensemble.',
    'Observateur d\u2019événements > Journaux des applications et des services > Microsoft > Windows > SMBServer.',
    'Une session se ferme depuis « Sessions » par clic droit — après avoir prévenu l\u2019utilisateur.',
  ],
  keywords: [
    'smb', 'session', 'fichier ouvert', 'verrou', 'fichier verrouille', 'qui utilise ce fichier',
    'get-smbopenfile', 'get-smbsession', 'port 445', 'lanmanserver', 'partage inaccessible',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu\u2019administrateur : les sessions SMB ne sont pas lisibles par un compte standard.',
    'Script à exécuter sur le serveur de fichiers lui-même.',
    'Script en lecture seule : aucune session ni aucun fichier n\u2019est fermé.',
  ]),
  commonErrors: ERREURS_MODULE.concat([
    {
      message: 'Get-SmbOpenFile : Accès refusé',
      cause: 'Console non élevée.',
      fix: 'Relancer PowerShell avec « Exécuter en tant qu\u2019administrateur ».',
    },
    {
      message: 'Le fichier est verrouillé par un autre utilisateur',
      cause: 'Une session SMB tient un verrou sur le fichier.',
      fix: 'Identifier l\u2019utilisateur avec ce rapport, le contacter, et ne fermer le fichier qu\u2019en dernier recours.',
      command: 'Get-SmbOpenFile | Where-Object { $_.Path -like \'*nom-du-fichier*\' }',
    },
    {
      message: 'Aucun client ne joint le partage',
      cause: 'Service LanmanServer arrêté, port 445 bloqué par le pare-feu, ou partage non publié.',
      fix: 'Les trois points sont contrôlés par ce rapport.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport indique le nombre de partages, de sessions et de fichiers ouverts.',
    'Le filtre par utilisateur ou par partage retrouve la session recherchée.',
    'Les erreurs SMB récentes sont regroupées par identifiant d\u2019événement.',
  ],
  rollback: {
    summary: 'Ce script observe : il ne ferme ni session ni fichier. Il n\u2019y a rien à annuler.',
    diagnostic: '# Relire l\'etat : aucune de ces commandes ne ferme quoi que ce soit.\nGet-SmbSession | Format-Table ClientUserName,ClientComputerName,NumOpens\nGet-SmbOpenFile | Format-Table ClientUserName,Path,Locks',
    command: '# Aucune annulation necessaire : diagnostic en lecture seule.\nGet-SmbShare | Format-Table Name,Path,Description',
    exceptional: '# AVERTISSEMENT CRITIQUE — fermeture d\'une session ou d\'un fichier ouvert.\n#\n# Fermer un fichier ouvert fait perdre les modifications non enregistrees de\n# la personne qui l\'utilise. Fermer une session deconnecte toutes ses ouvertures\n# d\'un coup. Cette operation n\'est volontairement pas automatisee.\n#\n# Avant :\n#   1. Identifier l\'utilisateur et la machine avec ce rapport.\n#   2. Le contacter et lui demander de fermer le document.\n#   3. N\'agir qu\'en dernier recours, et sur un fichier precis plutot que sur\n#      toute la session.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/smbshare/close-smbopenfile\n#\n# Commandes, a executer manuellement :\n#   Close-SmbOpenFile -FileId <id> -Confirm\n#   Close-SmbSession -SessionId <id> -Confirm',
    warning: 'Le rapport nomme des utilisateurs et des machines. Il décrit qui travaille sur quoi : ne le diffuse pas hors de l\u2019équipe technique.',
  },
  checks: [
    'Exécuter sur le serveur qui héberge les partages, pas depuis un poste client.',
    'Un fichier verrouillé depuis longtemps signale souvent une session restée ouverte sur un poste éteint.',
    'La création de partages reste du ressort de l\u2019outil « Créer un dossier partagé » : celui-ci ne fait que diagnostiquer.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbopenfile',
  sources: [
    { label: 'Get-SmbOpenFile', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbopenfile' },
    { label: 'Get-SmbSession', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbsession' },
    { label: 'Get-SmbShare', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbshare' },
    { label: 'Test-NetConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
  ],
};

// ---------------------------------------------------------------------------
// E. ROUTAGE ET ACCÈS INTERNET
// ---------------------------------------------------------------------------

/**
 * 12. internet-client-diagnostic — pourquoi ce poste n'a-t-il pas Internet ?
 *
 * Le rapport ne dit pas « pas d'Internet » : il sépare adressage, passerelle,
 * routage, DNS, HTTPS et proxy, parce que la correction n'est pas la même.
 * Le test ne repose jamais sur le seul ping : ICMP est très souvent filtré,
 * et conclure « pas de réseau » sur un ping bloqué est une erreur classique.
 */
export const outilDiagnosticInternet = {
  id: 'internet-client-diagnostic',
  icon: '◔',
  category: 'Windows Server',
  subcategory: 'Routage et accès Internet',
  title: 'Diagnostiquer l’accès Internet d’un client',
  risk: 'diagnostic',
  summary: 'Sépare les causes : adressage, passerelle, routage, DNS, HTTPS et proxy, avec un verdict par étape plutôt qu’un simple ping.',
  fields: [
    { id: 'cliGateway', label: 'Passerelle attendue', default: '192.168.30.254', help: 'Laisser la valeur détectée si tu ne sais pas : le script compare avec la passerelle réelle.' },
    { id: 'cliTestIp', label: 'Adresse IP publique de test', default: '9.9.9.9', help: 'Une adresse joignable sans DNS : elle sépare le routage de la résolution de noms.' },
    { id: 'cliTestHost', label: 'Nom HTTPS de test', default: 'www.microsoft.com', help: 'Nom résolu puis joint en TCP 443.' },
    champFormat('cliFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'cliGateway', validateIPv4(v.cliGateway));
    verifier(errors, 'cliTestIp', validateIPv4(v.cliTestIp));
    verifier(errors, 'cliTestHost', validerFqdn(v.cliTestHost));
    verifier(errors, 'cliFormat', validerFormatRapport(v.cliFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const corps = [
      `$PasserelleAttendue = ${psB64(v.cliGateway)}`,
      `$IpTest = ${psB64(v.cliTestIp)}`,
      `$NomTest = ${psB64(v.cliTestHost)}`,
      `$KjemoFormat = ${psB64(v.cliFormat)}`,
      "",
      '# --- 1. Adressage ----------------------------------------------------------',
      '$confs = @()',
      'try { $confs = @(Get-NetIPConfiguration | Where-Object { $_.IPv4Address }) } catch { }',
      '$adresseOk = $false',
      'foreach ($conf in $confs) {',
      '  foreach ($adr in @($conf.IPv4Address)) {',
      "    $etatAdr = 'OK'",
      "    $commentaireAdr = ''",
      "    if ($adr.IPAddress -like '169.254.*') {",
      "      $etatAdr = 'PROBLEME'",
      "      $commentaireAdr = 'Adresse APIPA : aucun serveur DHCP n''a repondu. Le poste n''a pas d''adresse utilisable.'",
      '    } else { $adresseOk = $true }',
      '    [void](Add-KjemoResultat -Categorie \'1. Adressage\' -Controle ("$($conf.InterfaceAlias)") -Etat $etatAdr -Valeur ("$($adr.IPAddress)/$($adr.PrefixLength)") -Commentaire $commentaireAdr)',
      '  }',
      '}',
      'if (@($confs).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie '1. Adressage' -Controle 'Interfaces' -Etat 'PROBLEME' -Valeur 'aucune interface avec adresse IPv4' -Commentaire 'Carte desactivee, cable debranche, ou pilote absent.')",
      '}',
      "",
      '# DHCP ou statique, et bail en cours.',
      '$interfaces = @()',
      "try { $interfaces = @(Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.ConnectionState -eq 'Connected' }) } catch { }",
      'foreach ($i in $interfaces) {',
      "  [void](Add-KjemoResultat -Categorie '1. Adressage' -Controle (\"DHCP sur $($i.InterfaceAlias)\") -Etat 'INFO' -Valeur (\"Dhcp : $($i.Dhcp) ; metrique : $($i.InterfaceMetric)\") -Commentaire \"Une adresse statique erronee produit les memes symptomes qu''une absence de DHCP.\")",
      '}',
      '$baux = @()',
      'try { $baux = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq \'Dhcp\' }) } catch { }',
      'foreach ($b in $baux) {',
      "  [void](Add-KjemoResultat -Categorie '1. Adressage' -Controle (\"Bail DHCP $($b.InterfaceAlias)\") -Etat 'INFO' -Valeur (\"$($b.IPAddress) ; origine $($b.PrefixOrigin)/$($b.SuffixOrigin) ; valide jusqu''a $($b.ValidLifetime)\"))",
      '}',
      "",
      '# --- 2. Passerelle ---------------------------------------------------------',
      '$routesDefaut = @()',
      "try { $routesDefaut = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue) } catch { }",
      '$passerelleReelle = $null',
      'if (@($routesDefaut).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie '2. Passerelle' -Controle 'Route par defaut' -Etat 'PROBLEME' -Valeur 'aucune' -Commentaire 'Sans route par defaut, le trafic ne sort pas du reseau local. Cause typique : carte sans passerelle, ou DHCP sans option 3.')",
      '} else {',
      '  $passerelleReelle = @($routesDefaut)[0].NextHop',
      "  $etatGw = 'OK'",
      "  $commentaireGw = ''",
      '  if (@($routesDefaut).Count -gt 1) {',
      "    $etatGw = 'ATTENTION'",
      "    $commentaireGw = 'Plusieurs passerelles par defaut : le systeme choisit selon la metrique, le comportement devient imprevisible.'",
      '  }',
      '  [void](Add-KjemoResultat -Categorie \'2. Passerelle\' -Controle \'Route(s) par defaut\' -Etat $etatGw -Valeur ((@($routesDefaut) | ForEach-Object { "$($_.NextHop) via $($_.InterfaceAlias) (metrique $($_.RouteMetric))" }) -join \' ; \') -Commentaire $commentaireGw)',
      '  if ($passerelleReelle -ne $PasserelleAttendue) {',
      "    [void](Add-KjemoResultat -Categorie '2. Passerelle' -Controle 'Conformite' -Etat 'ATTENTION' -Valeur (\"attendue : $PasserelleAttendue ; reelle : $passerelleReelle\") -Commentaire \"La passerelle distribuee n''est pas celle prevue : verifie l''option 3 de l''etendue DHCP.\")",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie '2. Passerelle' -Controle 'Conformite' -Etat 'OK' -Valeur $passerelleReelle)",
      '  }',
      "",
      "  # Joindre la passerelle : ICMP d'abord, mais son echec ne conclut rien.",
      '  $pingGw = $null',
      '  try { $pingGw = Test-Connection -ComputerName $passerelleReelle -Count 2 -Quiet -ErrorAction SilentlyContinue } catch { }',
      "  $etatPing = 'ATTENTION'",
      "  $commentairePing = 'ICMP sans reponse. Cela ne prouve pas que la passerelle est injoignable : beaucoup d''equipements filtrent le ping.'",
      "  if ($pingGw) { $etatPing = 'OK'; $commentairePing = '' }",
      '  [void](Add-KjemoResultat -Categorie \'2. Passerelle\' -Controle \'Ping de la passerelle\' -Etat $etatPing -Valeur $pingGw -Commentaire $commentairePing)',
      "",
      '  # La table ARP dit si la passerelle repond au niveau 2, ping ou pas.',
      '  $arp = $null',
      '  try { $arp = Get-NetNeighbor -IPAddress $passerelleReelle -ErrorAction SilentlyContinue } catch { }',
      '  if ($arp) {',
      '    [void](Add-KjemoResultat -Categorie \'2. Passerelle\' -Controle \'Resolution ARP\' -Etat \'OK\' -Valeur ("$($arp.LinkLayerAddress) — etat $($arp.State)") -Commentaire "La passerelle repond au niveau liaison : elle est bien presente sur le reseau.")',
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie '2. Passerelle' -Controle 'Resolution ARP' -Etat 'ATTENTION' -Valeur 'aucune entree' -Commentaire 'La passerelle ne repond pas au niveau liaison : mauvais VLAN, mauvais masque, ou equipement eteint.')",
      '  }',
      '}',
      "",
      '# --- 3. Routage vers Internet ----------------------------------------------',
      '# Test sur une IP publique : reussir ici sans DNS isole la resolution de noms.',
      '$routeTest = $null',
      'try { $routeTest = Test-NetConnection -ComputerName $IpTest -Port 443 -WarningAction SilentlyContinue } catch { }',
      'if ($routeTest) {',
      "  $etatRoute = 'PROBLEME'",
      "  $commentaireRoute = 'Aucune connexion TCP vers une IP publique : le trafic ne sort pas, ou il est filtre en sortie.'",
      "  if ($routeTest.TcpTestSucceeded) { $etatRoute = 'OK'; $commentaireRoute = 'Le routage sortant fonctionne, independamment du DNS.' }",
      '  [void](Add-KjemoResultat -Categorie \'3. Routage\' -Controle ("TCP 443 vers $IpTest") -Etat $etatRoute -Valeur $routeTest.TcpTestSucceeded -Commentaire $commentaireRoute)',
      '}',
      '$tracert = $null',
      'try { $tracert = Test-NetConnection -ComputerName $IpTest -TraceRoute -WarningAction SilentlyContinue } catch { }',
      'if ($tracert -and $tracert.TraceRoute) {',
      "  [void](Add-KjemoResultat -Categorie '3. Routage' -Controle 'Chemin' -Etat 'INFO' -Valeur ((@($tracert.TraceRoute) | Select-Object -First 6) -join ' -> ') -Commentaire \"Six premiers sauts. Un chemin qui s''arrete au premier saut designe la passerelle.\")",
      '}',
      "",
      '# --- 4. DNS -----------------------------------------------------------------',
      '$serveursDns = @()',
      'try { $serveursDns = @((Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses }).ServerAddresses) } catch { }',
      'if (@($serveursDns).Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie '4. DNS' -Controle 'Serveurs configures' -Etat 'PROBLEME' -Valeur 'aucun' -Commentaire 'Sans serveur DNS, aucun nom ne se resout, meme si le routage fonctionne.')",
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'4. DNS\' -Controle \'Serveurs configures\' -Etat \'OK\' -Valeur (($serveursDns | Select-Object -Unique) -join \', \'))',
      '}',
      '$resolution = $null',
      'try { $resolution = Resolve-DnsName -Name $NomTest -Type A -ErrorAction Stop } catch { }',
      'if ($resolution) {',
      '  [void](Add-KjemoResultat -Categorie \'4. DNS\' -Controle ("Resolution de $NomTest") -Etat \'OK\' -Valeur ((@($resolution | Where-Object { $_.IPAddress }) | ForEach-Object { $_.IPAddress }) -join \', \'))',
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'4. DNS\' -Controle ("Resolution de $NomTest") -Etat \'PROBLEME\' -Valeur \'echec\' -Commentaire "Probleme de resolution de noms : serveur DNS injoignable, mauvais serveur distribue, ou filtrage du port 53.")',
      '}',
      "",
      '# --- 5. HTTPS ----------------------------------------------------------------',
      '$https = $null',
      'try { $https = Test-NetConnection -ComputerName $NomTest -Port 443 -WarningAction SilentlyContinue } catch { }',
      'if ($https) {',
      "  $etatHttps = 'PROBLEME'",
      "  $commentaireHttps = 'Le nom se resout peut-etre, mais la connexion HTTPS n''aboutit pas : filtrage sortant, proxy obligatoire, ou inspection TLS.'",
      "  if ($https.TcpTestSucceeded) { $etatHttps = 'OK'; $commentaireHttps = '' }",
      '  [void](Add-KjemoResultat -Categorie \'5. HTTPS\' -Controle ("TCP 443 vers $NomTest") -Etat $etatHttps -Valeur $https.TcpTestSucceeded -Commentaire $commentaireHttps)',
      '}',
      "",
      '# --- 6. Proxy -----------------------------------------------------------------',
      '$proxyWinHttp = $null',
      'try { $proxyWinHttp = & netsh winhttp show proxy 2>&1 | Out-String } catch { }',
      'if ($proxyWinHttp) {',
      "  $etatProxy = 'INFO'",
      "  $commentaireProxy = 'Le proxy WinHTTP concerne les services et les taches systeme, pas le navigateur.'",
      "  if ($proxyWinHttp -match 'Direct access|Acces direct') { $commentaireProxy = 'Acces direct : aucun proxy systeme configure.' }",
      '  [void](Add-KjemoResultat -Categorie \'6. Proxy\' -Controle \'WinHTTP\' -Etat $etatProxy -Valeur $proxyWinHttp.Trim() -Commentaire $commentaireProxy)',
      '}',
      "",
      '# --- 7. Profil reseau et pare-feu ---------------------------------------------',
      '$profils = @()',
      'try { $profils = @(Get-NetConnectionProfile) } catch { }',
      'foreach ($p in $profils) {',
      "  [void](Add-KjemoResultat -Categorie '7. Profil' -Controle $p.InterfaceAlias -Etat 'INFO' -Valeur (\"$($p.NetworkCategory) ; IPv4 : $($p.IPv4Connectivity)\") -Commentaire \"Un profil Public applique des regles de pare-feu plus strictes qu''un profil Domaine.\")",
      '}',
      '$fw = @()',
      'try { $fw = @(Get-NetFirewallProfile) } catch { }',
      'foreach ($f in $fw) {',
      '  [void](Add-KjemoResultat -Categorie \'7. Profil\' -Controle ("Pare-feu $($f.Name)") -Etat \'INFO\' -Valeur ("actif : $($f.Enabled) ; sortant : $($f.DefaultOutboundAction)"))',
      '}',
      "",
      '# --- 8. Verdict ----------------------------------------------------------------',
      "# La conclusion designe l'etape qui bloque, pas un symptome general.",
      "$verdict = 'Chaine complete fonctionnelle : adressage, passerelle, routage, DNS et HTTPS.'",
      'if (-not $adresseOk) {',
      "  $verdict = 'Probleme d''ADRESSAGE : le poste n''a pas d''adresse utilisable. Commence par le DHCP.'",
      '} elseif (@($routesDefaut).Count -eq 0) {',
      "  $verdict = 'Probleme de PASSERELLE : aucune route par defaut. Verifie l''option 3 du DHCP ou la configuration statique.'",
      '} elseif ($routeTest -and -not $routeTest.TcpTestSucceeded) {',
      "  $verdict = 'Probleme de ROUTAGE ou de filtrage sortant : une IP publique n''est pas joignable en TCP.'",
      '} elseif ($null -eq $resolution) {',
      "  $verdict = 'Probleme DNS : le routage fonctionne mais les noms ne se resolvent pas.'",
      '} elseif ($https -and -not $https.TcpTestSucceeded) {',
      "  $verdict = 'Probleme HTTPS ou PROXY : le nom se resout, mais le port 443 n''aboutit pas.'",
      '}',
      "[void](Add-KjemoResultat -Categorie '8. Verdict' -Controle 'Etape en cause' -Etat 'INFO' -Valeur $verdict)",
    ];

    return assembler({
      titre: "Diagnostiquer l'acces Internet d'un client - lecture seule",
      outil: 'internet-client-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['PasserelleAttendue', psB64(v.cliGateway)],
        ['IpTest', psB64(v.cliTestIp)],
        ['NomTest', psB64(v.cliTestHost)],
      ],
      corps,
      prefixeFichier: 'kjemo-internet-client',
    });
  },
  gui: [
    'Paramètres > Réseau et Internet > Propriétés de la carte : adresse, passerelle et DNS.',
    'Invite de commandes : ipconfig /all pour l’adressage et le bail DHCP.',
    'Centre Réseau et partage > Résoudre les problèmes, pour le diagnostic guidé de Windows.',
    'Panneau de configuration > Options Internet > Connexions > Paramètres réseau, pour le proxy du navigateur.',
  ],
  keywords: [
    'pas d internet', 'pas de connexion', 'apipa', '169.254', 'passerelle',
    'dns ne resout pas', 'proxy', 'https bloque', 'test-netconnection', 'routage',
    'ping ne passe pas', 'internet ne marche pas',
  ],
  requiresAdmin: false,
  os: OS_SERVEUR.concat(['Windows 10 et 11 — le diagnostic client fonctionne aussi sur un poste de travail']),
  prereqs: PREREQS_SERVEUR.concat([
    'Une console PowerShell standard suffit : ce diagnostic ne demande pas d’élévation.',
    'À exécuter sur la machine qui a le problème, pas sur le serveur.',
    'Script en lecture seule : aucune configuration réseau n’est modifiée.',
  ]),
  commonErrors: [
    {
      message: 'Test-NetConnection : WARNING: Ping to ... failed',
      cause: 'L’avertissement porte sur ICMP seulement. Le test TCP du même cmdlet peut très bien réussir.',
      fix: 'Lire la valeur TcpTestSucceeded plutôt que l’avertissement : c’est exactement pourquoi ce script ne conclut jamais sur un ping.',
    },
    {
      message: 'L’adresse commence par 169.254',
      code: 'APIPA',
      cause: 'Aucun serveur DHCP n’a répondu : service arrêté, serveur non autorisé, étendue inactive ou saturée, ou VLAN sans relais DHCP.',
      fix: 'Diagnostiquer le serveur DHCP avec les outils DHCP de ce lot.',
    },
    {
      message: 'Le navigateur fonctionne mais pas les mises à jour Windows',
      cause: 'Le navigateur utilise son propre proxy ; les services système utilisent celui de WinHTTP.',
      fix: 'Comparer les deux : netsh winhttp show proxy et les options du navigateur.',
      command: 'netsh winhttp show proxy',
    },
  ],
  reversible: true,
  verifyAfter: [
    'Le rapport numérote les étapes : adressage, passerelle, routage, DNS, HTTPS, proxy.',
    'Le verdict final désigne l’étape qui bloque, pas un symptôme général.',
    'Un succès TCP sur une IP publique avec un échec de résolution isole formellement un problème DNS.',
  ],
  rollback: {
    summary: 'Ce diagnostic ne change aucune configuration réseau : il observe et teste. Rien à annuler.',
    diagnostic: '# Relire l\'etat reseau : aucune de ces commandes n\'ecrit quoi que ce soit.\nGet-NetIPConfiguration | Format-List InterfaceAlias,IPv4Address,IPv4DefaultGateway,DNSServer\nGet-NetRoute -DestinationPrefix \'0.0.0.0/0\' | Format-Table InterfaceAlias,NextHop,RouteMetric',
    command: '# Aucune annulation necessaire : le script est en lecture seule.\nGet-DnsClientServerAddress -AddressFamily IPv4 | Format-Table InterfaceAlias,ServerAddresses',
    exceptional: '',
    warning: 'Le rapport contient l’adressage interne du poste et le chemin réseau vers Internet : document interne.',
  },
  checks: [
    'Exécuter depuis la machine qui présente le problème : un test depuis une autre machine ne prouve rien pour celle-ci.',
    'Choisir une IP publique de test qui répond en TCP 443, sinon l’étape « routage » sera faussement négative.',
    'ICMP bloqué est fréquent : ne jamais conclure sur le seul ping.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection',
  sources: [
    { label: 'Test-NetConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
    { label: 'Get-NetIPConfiguration', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipconfiguration' },
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
    { label: 'Resolve-DnsName', url: 'https://learn.microsoft.com/powershell/module/dnsclient/resolve-dnsname' },
    { label: 'Get-NetConnectionProfile', url: 'https://learn.microsoft.com/powershell/module/netconnection/get-netconnectionprofile' },
  ],
};

/**
 * 13. ics-readiness — préparer et vérifier un partage de connexion ICS.
 *
 * ICS est une solution de LABORATOIRE. Elle impose son propre plan d'adressage
 * (192.168.137.1/24), démarre son propre service DHCP, et n'offre aucun réglage
 * fin. Le script vérifie les prérequis et constate l'état ; l'activation reste
 * manuelle, par l'interface graphique, faute d'API officielle scriptable.
 */
export const outilIcsPreparation = {
  id: 'ics-readiness',
  icon: '◕',
  category: 'Windows Server',
  subcategory: 'Routage et accès Internet',
  title: 'Préparer et vérifier un partage de connexion Internet ICS',
  risk: 'diagnostic',
  summary: 'LABORATOIRE — vérifie les deux cartes, les passerelles, les métriques, le risque de double DHCP et la réécriture d’adresse en 192.168.137.1.',
  fields: [
    { id: 'icsInternal', label: 'Carte interne (réseau sans Internet)', default: 'Ethernet' },
    { id: 'icsExternal', label: 'Carte Internet', default: 'Ethernet 2' },
    { id: 'icsInternalIp', label: 'Adresse IP interne prévue', default: '192.168.30.254' },
    { id: 'icsPrefix', label: 'Préfixe interne', default: '24' },
    { id: 'icsDomain', label: 'Domaine du réseau interne', default: 'hopitalbn.lan' },
    { id: 'icsTestIp', label: 'Adresse IP publique de test', default: '9.9.9.9' },
    { id: 'icsTestHost', label: 'Nom HTTPS de test', default: 'www.microsoft.com' },
    champFormat('icsFormat'),
  ],
  validate(v) {
    const errors = {};
    const interne = String(v.icsInternal ?? '').trim();
    const externe = String(v.icsExternal ?? '').trim();
    if (!interne) errors.icsInternal = 'Le nom de la carte interne ne peut pas être vide.';
    if (!externe) errors.icsExternal = 'Le nom de la carte Internet ne peut pas être vide.';
    if (interne && externe && interne.toLowerCase() === externe.toLowerCase()) {
      errors.icsExternal = 'La carte interne et la carte Internet doivent être deux cartes différentes : ICS partage l’une VERS l’autre.';
    }
    for (const [champ, valeur] of [['icsInternal', interne], ['icsExternal', externe]]) {
      if (valeur && /[\x00-\x1f\x7f]/.test(valeur)) errors[champ] = 'Le nom de la carte contient un caractère de contrôle non autorisé.';
    }
    verifier(errors, 'icsInternalIp', validateIPv4(v.icsInternalIp));
    verifier(errors, 'icsPrefix', validerPrefixe(v.icsPrefix));
    verifier(errors, 'icsDomain', validerFqdn(v.icsDomain));
    verifier(errors, 'icsTestIp', validateIPv4(v.icsTestIp));
    verifier(errors, 'icsTestHost', validerFqdn(v.icsTestHost));
    verifier(errors, 'icsFormat', validerFormatRapport(v.icsFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const corps = [
      `$CarteInterne = ${psB64(v.icsInternal)}`,
      `$CarteExterne = ${psB64(v.icsExternal)}`,
      `$IpInterne = ${psB64(v.icsInternalIp)}`,
      `$PrefixeInterne = [int](${psB64(String(validerPrefixe(v.icsPrefix).value))})`,
      `$DomaineInterne = ${psB64(v.icsDomain)}`,
      `$IpTest = ${psB64(v.icsTestIp)}`,
      `$NomTest = ${psB64(v.icsTestHost)}`,
      `$KjemoFormat = ${psB64(v.icsFormat)}`,
      "",
      "# Ce script est un DIAGNOSTIC. Il n'active pas ICS : l'activation se fait",
      "# dans ncpa.cpl, onglet Partage. Aucune API officielle scriptable n'existe",
      '# pour ICS, et ce lot refuse le registre non documente comme le COM obscur.',
      "",
      '# --- 1. Les deux cartes existent-elles, et sont-elles distinctes ? ---------',
      '$interne = $null',
      '$externe = $null',
      'try { $interne = Get-NetAdapter -Name $CarteInterne -ErrorAction SilentlyContinue } catch { }',
      'try { $externe = Get-NetAdapter -Name $CarteExterne -ErrorAction SilentlyContinue } catch { }',
      'if ($null -eq $interne) {',
      '  [void](Add-KjemoResultat -Categorie \'Cartes\' -Controle \'Carte interne\' -Etat \'PROBLEME\' -Valeur "$CarteInterne introuvable" -Commentaire "Liste les cartes avec Get-NetAdapter et reprends le nom exact.")',
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Cartes\' -Controle \'Carte interne\' -Etat \'OK\' -Valeur ("$($interne.Name) — $($interne.Status) — $($interne.InterfaceDescription)"))',
      '}',
      'if ($null -eq $externe) {',
      '  [void](Add-KjemoResultat -Categorie \'Cartes\' -Controle \'Carte Internet\' -Etat \'PROBLEME\' -Valeur "$CarteExterne introuvable")',
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Cartes\' -Controle \'Carte Internet\' -Etat \'OK\' -Valeur ("$($externe.Name) — $($externe.Status) — $($externe.InterfaceDescription)"))',
      '}',
      'if ($interne -and $externe -and $interne.ifIndex -eq $externe.ifIndex) {',
      "  [void](Add-KjemoResultat -Categorie 'Cartes' -Controle 'Cartes distinctes' -Etat 'PROBLEME' -Valeur 'meme carte' -Commentaire 'ICS partage une connexion VERS une autre : il faut deux cartes.')",
      '}',
      "",
      '# --- 2. Passerelles : une seule, du cote Internet --------------------------',
      '$confInterne = $null',
      '$confExterne = $null',
      'try { $confInterne = Get-NetIPConfiguration -InterfaceAlias $CarteInterne -ErrorAction SilentlyContinue } catch { }',
      'try { $confExterne = Get-NetIPConfiguration -InterfaceAlias $CarteExterne -ErrorAction SilentlyContinue } catch { }',
      'if ($confInterne) {',
      '  $gwInterne = $null',
      '  if ($confInterne.IPv4DefaultGateway) { $gwInterne = ($confInterne.IPv4DefaultGateway | ForEach-Object { $_.NextHop }) -join \', \' }',
      "  $etatGwInt = 'OK'",
      "  $commentaireGwInt = 'Correct : la carte interne ne doit porter aucune passerelle.'",
      '  if ($gwInterne) {',
      "    $etatGwInt = 'PROBLEME'",
      "    $commentaireGwInt = 'La carte interne porte une passerelle : deux passerelles par defaut rendent le routage imprevisible. Retire-la.'",
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Passerelles' -Controle 'Carte interne' -Etat $etatGwInt -Valeur $gwInterne -Commentaire $commentaireGwInt)",
      '}',
      'if ($confExterne) {',
      '  $gwExterne = $null',
      '  if ($confExterne.IPv4DefaultGateway) { $gwExterne = ($confExterne.IPv4DefaultGateway | ForEach-Object { $_.NextHop }) -join \', \' }',
      "  $etatGwExt = 'PROBLEME'",
      "  $commentaireGwExt = 'La carte Internet n''a pas de passerelle : elle ne sort pas.'",
      "  if ($gwExterne) { $etatGwExt = 'OK'; $commentaireGwExt = '' }",
      "  [void](Add-KjemoResultat -Categorie 'Passerelles' -Controle 'Carte Internet' -Etat $etatGwExt -Valeur $gwExterne -Commentaire $commentaireGwExt)",
      '}',
      '$routesDefaut = @()',
      "try { $routesDefaut = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue) } catch { }",
      'if (@($routesDefaut).Count -gt 1) {',
      "  [void](Add-KjemoResultat -Categorie 'Passerelles' -Controle 'Routes par defaut' -Etat 'PROBLEME' -Valeur ((@($routesDefaut) | ForEach-Object { \"$($_.NextHop) via $($_.InterfaceAlias)\" }) -join ' ; ') -Commentaire \"Deux passerelles par defaut : c''est la panne la plus frequente de ce montage.\")",
      '}',
      "",
      '# --- 3. Metriques ------------------------------------------------------------',
      '$metriques = @()',
      'try { $metriques = @(Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq $CarteInterne -or $_.InterfaceAlias -eq $CarteExterne }) } catch { }',
      'foreach ($m in $metriques) {',
      "  [void](Add-KjemoResultat -Categorie 'Metriques' -Controle $m.InterfaceAlias -Etat 'INFO' -Valeur (\"metrique $($m.InterfaceMetric) ; automatique : $($m.AutomaticMetric) ; DHCP : $($m.Dhcp)\") -Commentaire \"Une metrique interne plus basse que l''externe peut detourner le trafic sortant.\")",
      '}',
      "",
      '# --- 4. Adresse interne : ICS la reecrit-il ? -------------------------------',
      '$adressesInternes = @()',
      'try { $adressesInternes = @(Get-NetIPAddress -InterfaceAlias $CarteInterne -AddressFamily IPv4 -ErrorAction SilentlyContinue) } catch { }',
      '$a137 = $false',
      'foreach ($a in $adressesInternes) {',
      "  if ($a.IPAddress -eq '192.168.137.1') { $a137 = $true }",
      '  $conforme = ($a.IPAddress -eq $IpInterne -and [int]$a.PrefixLength -eq $PrefixeInterne)',
      "  $etatAdr = 'ATTENTION'",
      '  $commentaireAdr = "Adresse differente de celle prevue ($IpInterne/$PrefixeInterne)."',
      "  if ($conforme) { $etatAdr = 'OK'; $commentaireAdr = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Adressage interne\' -Controle $a.InterfaceAlias -Etat $etatAdr -Valeur ("$($a.IPAddress)/$($a.PrefixLength)") -Commentaire $commentaireAdr)',
      '}',
      'if ($a137) {',
      "  [void](Add-KjemoResultat -Categorie 'Adressage interne' -Controle 'Reecriture par ICS' -Etat 'PROBLEME' -Valeur '192.168.137.1' -Commentaire 'ICS a impose son propre plan d''adressage : il remplace l''adresse de la carte interne par 192.168.137.1/24. Remets l''adresse prevue apres activation, ou accepte ce plan pour tout le laboratoire.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Adressage interne' -Controle 'Reecriture par ICS' -Etat 'OK' -Valeur 'aucune adresse 192.168.137.1 detectee')",
      '}',
      "",
      '# --- 5. Risque de double DHCP -------------------------------------------------',
      "# ICS demarre son propre service DHCP. S'il coexiste avec un serveur DHCP",
      '# du reseau interne, les clients recoivent des baux incoherents.',
      '$svcDhcp = Get-Service -Name DHCPServer -ErrorAction SilentlyContinue',
      '$svcPartage = Get-Service -Name SharedAccess -ErrorAction SilentlyContinue',
      'if ($svcPartage) {',
      '  [void](Add-KjemoResultat -Categorie \'ICS\' -Controle \'Service SharedAccess\' -Etat \'INFO\' -Valeur ("$($svcPartage.Status) / demarrage $($svcPartage.StartType)") -Commentaire "SharedAccess est le service du partage de connexion Internet.")',
      '}',
      "if ($svcDhcp -and $svcDhcp.Status -eq 'Running' -and $svcPartage -and $svcPartage.Status -eq 'Running') {",
      "  [void](Add-KjemoResultat -Categorie 'ICS' -Controle 'Double DHCP' -Etat 'PROBLEME' -Valeur 'DHCPServer et SharedAccess actifs' -Commentaire 'Deux serveurs DHCP sur le meme reseau : les clients recevront des configurations contradictoires. Choisis l''un ou l''autre.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'ICS' -Controle 'Double DHCP' -Etat 'OK' -Valeur 'pas de coexistence detectee')",
      '}',
      '$rras = Get-Service -Name RemoteAccess -ErrorAction SilentlyContinue',
      "if ($rras -and $rras.Status -eq 'Running' -and $svcPartage -and $svcPartage.Status -eq 'Running') {",
      "  [void](Add-KjemoResultat -Categorie 'ICS' -Controle 'Conflit ICS / RRAS' -Etat 'PROBLEME' -Valeur 'les deux services tournent' -Commentaire 'ICS et RRAS assurent la meme fonction de partage et se genent : n''en garde qu''un.')",
      '}',
      "",
      '# --- 6. DNS et routes --------------------------------------------------------',
      '$dnsInterne = @()',
      'try { $dnsInterne = @((Get-DnsClientServerAddress -InterfaceAlias $CarteInterne -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses) } catch { }',
      '[void](Add-KjemoResultat -Categorie \'DNS\' -Controle \'Carte interne\' -Etat \'INFO\' -Valeur (($dnsInterne -join \', \')) -Commentaire "Les clients du reseau interne doivent pointer vers un DNS qui resout $DomaineInterne.")',
      '$resolutionInterne = $null',
      'try { $resolutionInterne = Resolve-DnsName -Name $DomaineInterne -Type SOA -ErrorAction Stop } catch { }',
      'if ($resolutionInterne) {',
      '  [void](Add-KjemoResultat -Categorie \'DNS\' -Controle ("Resolution de $DomaineInterne") -Etat \'OK\' -Valeur \'le domaine interne se resout\')',
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'DNS\' -Controle ("Resolution de $DomaineInterne") -Etat \'ATTENTION\' -Valeur \'echec\' -Commentaire "Le domaine interne ne se resout pas depuis cette machine.")',
      '}',
      "",
      '# --- 7. Sortie Internet depuis le serveur -------------------------------------',
      '$sortie = $null',
      'try { $sortie = Test-NetConnection -ComputerName $IpTest -Port 443 -WarningAction SilentlyContinue } catch { }',
      'if ($sortie) {',
      "  $etatSortie = 'PROBLEME'",
      "  if ($sortie.TcpTestSucceeded) { $etatSortie = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Internet\' -Controle ("TCP 443 vers $IpTest") -Etat $etatSortie -Valeur $sortie.TcpTestSucceeded -Commentaire "Si le serveur lui-meme ne sort pas, le partage ne donnera rien aux clients.")',
      '}',
      '$sortieNom = $null',
      'try { $sortieNom = Test-NetConnection -ComputerName $NomTest -Port 443 -WarningAction SilentlyContinue } catch { }',
      'if ($sortieNom) {',
      "  $etatNom = 'PROBLEME'",
      "  if ($sortieNom.TcpTestSucceeded) { $etatNom = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Internet\' -Controle ("HTTPS vers $NomTest") -Etat $etatNom -Valeur $sortieNom.TcpTestSucceeded)',
      '}',
      "",
      '# --- 8. Rappel de positionnement ------------------------------------------------',
      "[void](Add-KjemoResultat -Categorie 'Positionnement' -Controle 'Portee d''ICS' -Etat 'ATTENTION' -Valeur 'laboratoire ou petit environnement de test' -Commentaire 'ICS impose son plan d''adressage, demarre son propre DHCP et n''offre aucun reglage fin. Pour une infrastructure d''entreprise, la reponse est RRAS avec NAT.')",
      "",
      "Write-Host ''",
      "Write-Host '--- Activation d''ICS : par l''interface graphique ---'",
      "Write-Host '1. Win + R, puis ncpa.cpl'",
      "Write-Host '2. Clic droit sur la carte Internet, Proprietes'",
      "Write-Host '3. Onglet Partage'",
      "Write-Host '4. Cocher l''autorisation de partage de connexion'",
      "Write-Host '5. Selectionner la carte interne dans la liste'",
      "Write-Host '6. Verifier ensuite l''adresse de la carte interne'",
      "Write-Host '7. Remettre l''adresse prevue si Windows l''a remplacee par 192.168.137.1'",
      "Write-Host 'Reference : https://learn.microsoft.com/troubleshoot/windows-server/networking/set-up-internet-connection-sharing'",
    ];

    return assembler({
      titre: 'Preparer et verifier un partage de connexion ICS - laboratoire',
      outil: 'ics-readiness',
      diagnostic: true,
      admin: true,
      parametres: [
        ['CarteInterne', psB64(v.icsInternal)],
        ['CarteExterne', psB64(v.icsExternal)],
        ['IpInternePrevue', psB64(v.icsInternalIp)],
        ['DomaineInterne', psB64(v.icsDomain)],
      ],
      corps,
      prefixeFichier: 'kjemo-ics',
    });
  },
  gui: [
    'Win + R, puis ncpa.cpl.',
    'Clic droit sur la carte qui a Internet > Propriétés.',
    'Onglet Partage.',
    'Cocher l’autorisation de partage de connexion Internet.',
    'Sélectionner la carte du réseau interne dans la liste déroulante.',
    'Valider, puis vérifier l’adresse IP de la carte interne.',
    'Si Windows l’a remplacée par 192.168.137.1, remettre l’adresse prévue — ou adopter ce plan pour tout le laboratoire.',
  ],
  keywords: [
    'ics', 'partage de connexion', 'partage internet', 'ncpa.cpl', 'sharedaccess',
    '192.168.137.1', 'laboratoire', 'deux cartes reseau', 'double dhcp',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR.concat(['Windows 10 et 11 — ICS y est identique, et tout aussi limité']),
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu’administrateur pour lire la configuration réseau complète.',
    'Deux cartes réseau distinctes : une vers Internet, une vers le réseau interne.',
    'Aucune passerelle sur la carte interne ; la passerelle reste sur la carte Internet.',
    'Comprendre qu’ICS est une solution de laboratoire : elle impose 192.168.137.1/24 et son propre DHCP.',
  ]),
  commonErrors: [
    {
      message: 'L’adresse de la carte interne est devenue 192.168.137.1',
      cause: 'Comportement normal d’ICS : il impose son plan d’adressage à la carte partagée.',
      fix: 'Remettre l’adresse prévue après activation, ou adopter 192.168.137.0/24 pour tout le laboratoire. Le script détecte ce cas.',
    },
    {
      message: 'Les clients reçoivent deux configurations différentes',
      cause: 'Le DHCP d’ICS coexiste avec un serveur DHCP du réseau interne.',
      fix: 'N’en garder qu’un. Le script signale la coexistence des services SharedAccess et DHCPServer.',
    },
    {
      message: 'L’onglet Partage est absent ou grisé',
      cause: 'Une seule carte réseau est présente, ou une stratégie de groupe interdit ICS.',
      fix: 'Vérifier la présence de deux cartes, puis les stratégies de connexion réseau.',
    },
  ],
  reversible: true,
  verifyAfter: [
    'Les deux cartes sont listées, distinctes, et une seule porte la passerelle.',
    'Le rapport indique si l’adresse interne a été réécrite en 192.168.137.1.',
    'Aucun double DHCP, aucun conflit ICS / RRAS signalé.',
    'Depuis un client du réseau interne : une adresse, une passerelle, un DNS, puis un test HTTPS réussi.',
  ],
  rollback: {
    summary: 'Ce script ne modifie rien. Pour annuler un partage ICS activé dans l’interface, il faut décocher la case dans le même onglet Partage, puis remettre l’adresse interne prévue.',
    diagnostic: '# Constater l\'etat avant de defaire quoi que ce soit.\nGet-NetAdapter | Format-Table Name,Status,InterfaceDescription\nGet-NetIPAddress -AddressFamily IPv4 | Format-Table InterfaceAlias,IPAddress,PrefixLength,PrefixOrigin\nGet-Service SharedAccess | Format-Table Name,Status,StartType',
    command: '# Desactivation d\'ICS : elle se fait dans l\'interface graphique.\n#   1. Win + R, ncpa.cpl\n#   2. Clic droit sur la carte Internet, Proprietes, onglet Partage\n#   3. Decocher l\'autorisation de partage\n#   4. Remettre l\'adresse prevue sur la carte interne, si ICS l\'a modifiee :\n#      New-NetIPAddress -InterfaceAlias \'<carte interne>\' -IPAddress \'<ip>\' -PrefixLength <prefixe>\n# Verifier ensuite l\'etat avec la commande de diagnostic ci-dessus.\nGet-NetIPAddress -AddressFamily IPv4 | Format-Table InterfaceAlias,IPAddress,PrefixLength',
    exceptional: '',
    warning: 'Activer ou désactiver ICS coupe la connectivité du réseau interne le temps de la bascule, et peut réécrire l’adresse de la carte partagée. À ne pas faire pendant un cours ou une démonstration.',
  },
  checks: [
    'Confirmer quelle carte a réellement Internet avant de partager : se tromper de sens coupe tout.',
    'Relever l’adresse de la carte interne avant activation, pour pouvoir la remettre.',
    'En laboratoire, documenter le plan retenu : celui prévu, ou celui imposé par ICS.',
  ],
  source: 'https://learn.microsoft.com/troubleshoot/windows-server/networking/set-up-internet-connection-sharing',
  sources: [
    { label: 'Configurer le partage de connexion Internet', url: 'https://learn.microsoft.com/troubleshoot/windows-server/networking/set-up-internet-connection-sharing' },
    { label: 'Get-NetAdapter', url: 'https://learn.microsoft.com/powershell/module/netadapter/get-netadapter' },
    { label: 'Get-NetIPAddress', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipaddress' },
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
  ],
};

/**
 * 14. rras-nat-readiness — vérifier les prérequis de RRAS avec NAT.
 *
 * L'alternative professionnelle à ICS. Ce lot ne configure PAS le NAT : la
 * configuration se fait dans la console RRAS, et la scripter avec des commandes
 * obsolètes ou non documentées serait pire qu'utile.
 */
export const outilRrasPreparation = {
  id: 'rras-nat-readiness',
  icon: '◩',
  category: 'Windows Server',
  subcategory: 'Routage et accès Internet',
  title: 'Vérifier les prérequis RRAS et NAT',
  risk: 'diagnostic',
  summary: 'Alternative professionnelle à ICS : vérifie édition, interfaces, rôle RemoteAccess, service, routage, pare-feu et conflits avant configuration.',
  fields: [
    { id: 'rrasInternal', label: 'Interface interne (LAN)', default: 'Ethernet' },
    { id: 'rrasExternal', label: 'Interface externe (Internet)', default: 'Ethernet 2' },
    { id: 'rrasTestIp', label: 'Adresse IP publique de test', default: '9.9.9.9' },
    champFormat('rrasFormat'),
  ],
  validate(v) {
    const errors = {};
    const interne = String(v.rrasInternal ?? '').trim();
    const externe = String(v.rrasExternal ?? '').trim();
    if (!interne) errors.rrasInternal = 'Le nom de l’interface interne ne peut pas être vide.';
    if (!externe) errors.rrasExternal = 'Le nom de l’interface externe ne peut pas être vide.';
    if (interne && externe && interne.toLowerCase() === externe.toLowerCase()) {
      errors.rrasExternal = 'Les interfaces interne et externe doivent être distinctes : le NAT traduit de l’une vers l’autre.';
    }
    verifier(errors, 'rrasTestIp', validateIPv4(v.rrasTestIp));
    verifier(errors, 'rrasFormat', validerFormatRapport(v.rrasFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const corps = [
      `$Interne = ${psB64(v.rrasInternal)}`,
      `$Externe = ${psB64(v.rrasExternal)}`,
      `$IpTest = ${psB64(v.rrasTestIp)}`,
      `$KjemoFormat = ${psB64(v.rrasFormat)}`,
      "",
      "# DIAGNOSTIC ET PREPARATION. Ce script ne configure PAS le NAT : la",
      "# configuration se fait dans la console RRAS, dont la procedure officielle",
      '# est rappelee en fin de rapport.',
      "",
      '# --- 1. Edition de Windows ---------------------------------------------------',
      '$os = $null',
      'try { $os = Get-CimInstance Win32_OperatingSystem } catch { }',
      'if ($os) {',
      "  $estServeur = ($os.ProductType -ne 1)",
      "  $etatEdition = 'PROBLEME'",
      "  $commentaireEdition = 'RRAS est un role Windows Server : il n''existe pas sur une edition client.'",
      "  if ($estServeur) { $etatEdition = 'OK'; $commentaireEdition = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Edition\' -Controle \'Windows Server\' -Etat $etatEdition -Valeur ("$($os.Caption) — build $($os.BuildNumber)") -Commentaire $commentaireEdition)',
      '}',
      "",
      '# --- 2. Deux interfaces, identifiees -----------------------------------------',
      '$cartes = @()',
      'try { $cartes = @(Get-NetAdapter) } catch { }',
      '[void](Add-KjemoResultat -Categorie \'Interfaces\' -Controle \'Cartes presentes\' -Etat \'INFO\' -Valeur ((@($cartes) | ForEach-Object { "$($_.Name) ($($_.Status))" }) -join \' ; \'))',
      '$carteInterne = $cartes | Where-Object { $_.Name -eq $Interne }',
      '$carteExterne = $cartes | Where-Object { $_.Name -eq $Externe }',
      'if ($null -eq $carteInterne -or $null -eq $carteExterne) {',
      "  [void](Add-KjemoResultat -Categorie 'Interfaces' -Controle 'Interfaces designees' -Etat 'PROBLEME' -Valeur 'au moins une interface est introuvable' -Commentaire 'Reprends les noms exacts affiches ci-dessus.')",
      '} else {',
      '  [void](Add-KjemoResultat -Categorie \'Interfaces\' -Controle \'Interfaces designees\' -Etat \'OK\' -Valeur ("interne : $($carteInterne.Name) ; externe : $($carteExterne.Name)"))',
      '}',
      '$confInterne = $null',
      '$confExterne = $null',
      'try { $confInterne = Get-NetIPConfiguration -InterfaceAlias $Interne -ErrorAction SilentlyContinue } catch { }',
      'try { $confExterne = Get-NetIPConfiguration -InterfaceAlias $Externe -ErrorAction SilentlyContinue } catch { }',
      'if ($confInterne) {',
      '  $gwInt = $null',
      '  if ($confInterne.IPv4DefaultGateway) { $gwInt = ($confInterne.IPv4DefaultGateway | ForEach-Object { $_.NextHop }) -join \', \' }',
      "  $etatInt = 'OK'",
      "  $commentaireInt = 'Correct : cote LAN, pas de passerelle.'",
      "  if ($gwInt) { $etatInt = 'PROBLEME'; $commentaireInt = 'Une passerelle sur l''interface interne cree une seconde route par defaut.' }",
      '  [void](Add-KjemoResultat -Categorie \'Interfaces\' -Controle \'Passerelle interne\' -Etat $etatInt -Valeur ("adresse(s) : $((@($confInterne.IPv4Address) | ForEach-Object { $_.IPAddress }) -join \', \') ; passerelle : $gwInt") -Commentaire $commentaireInt)',
      '}',
      'if ($confExterne) {',
      '  $gwExt = $null',
      '  if ($confExterne.IPv4DefaultGateway) { $gwExt = ($confExterne.IPv4DefaultGateway | ForEach-Object { $_.NextHop }) -join \', \' }',
      "  $etatExt = 'PROBLEME'",
      "  $commentaireExt = 'Sans passerelle cote Internet, le NAT n''a nulle part ou envoyer le trafic.'",
      "  if ($gwExt) { $etatExt = 'OK'; $commentaireExt = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Interfaces\' -Controle \'Passerelle externe\' -Etat $etatExt -Valeur ("adresse(s) : $((@($confExterne.IPv4Address) | ForEach-Object { $_.IPAddress }) -join \', \') ; passerelle : $gwExt") -Commentaire $commentaireExt)',
      '}',
      "",
      '# --- 3. Role et service RemoteAccess ------------------------------------------',
      '$role = $null',
      'try { $role = Get-WindowsFeature -Name RemoteAccess } catch { }',
      'if ($role) {',
      "  $etatRole = 'ATTENTION'",
      "  $commentaireRole = 'Role absent : il devra etre installe avant toute configuration du NAT.'",
      "  if ($role.Installed) { $etatRole = 'OK'; $commentaireRole = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Role\' -Controle \'RemoteAccess\' -Etat $etatRole -Valeur $role.InstallState -Commentaire $commentaireRole)',
      '}',
      '$routing = $null',
      'try { $routing = Get-WindowsFeature -Name Routing } catch { }',
      'if ($routing) {',
      '  [void](Add-KjemoResultat -Categorie \'Role\' -Controle \'Service de routage\' -Etat \'INFO\' -Valeur $routing.InstallState -Commentaire "Le NAT fait partie du service de routage de RRAS.")',
      '}',
      '$service = Get-Service -Name RemoteAccess -ErrorAction SilentlyContinue',
      'if ($service) {',
      "  $etatSvc = 'ATTENTION'",
      "  $commentaireSvc = 'Service arrete : normal tant que RRAS n''est pas configure.'",
      "  if ($service.Status -eq 'Running') { $etatSvc = 'OK'; $commentaireSvc = '' }",
      '  [void](Add-KjemoResultat -Categorie \'Service\' -Controle \'RemoteAccess\' -Etat $etatSvc -Valeur ("$($service.Status) / demarrage $($service.StartType)") -Commentaire $commentaireSvc)',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Service' -Controle 'RemoteAccess' -Etat 'INFO' -Valeur 'service absent' -Commentaire 'Le role n''est pas installe.')",
      '}',
      "",
      '# --- 4. Routage IP au niveau du systeme ----------------------------------------',
      '$forwarding = @()',
      'try { $forwarding = @(Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq $Interne -or $_.InterfaceAlias -eq $Externe }) } catch { }',
      'foreach ($f in $forwarding) {',
      "  $etatFwd = 'INFO'",
      "  [void](Add-KjemoResultat -Categorie 'Routage' -Controle (\"Forwarding $($f.InterfaceAlias)\") -Etat $etatFwd -Valeur $f.Forwarding -Commentaire \"RRAS active le transfert IP lorsqu''il est configure : ce releve est un etat avant configuration.\")",
      '}',
      '$routes = @()',
      "try { $routes = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue) } catch { }",
      'if (@($routes).Count -gt 1) {',
      '  [void](Add-KjemoResultat -Categorie \'Routage\' -Controle \'Routes par defaut\' -Etat \'PROBLEME\' -Valeur ((@($routes) | ForEach-Object { "$($_.NextHop) via $($_.InterfaceAlias)" }) -join \' ; \') -Commentaire "Une seule route par defaut, cote Internet.")',
      '} elseif (@($routes).Count -eq 1) {',
      '  [void](Add-KjemoResultat -Categorie \'Routage\' -Controle \'Route par defaut\' -Etat \'OK\' -Valeur ("$(@($routes)[0].NextHop) via $(@($routes)[0].InterfaceAlias)"))',
      '}',
      "",
      '# --- 5. Pare-feu ----------------------------------------------------------------',
      '$profils = @()',
      'try { $profils = @(Get-NetFirewallProfile) } catch { }',
      'foreach ($p in $profils) {',
      '  [void](Add-KjemoResultat -Categorie \'Pare-feu\' -Controle ("Profil $($p.Name)") -Etat \'INFO\' -Valeur ("actif : $($p.Enabled) ; entrant : $($p.DefaultInboundAction) ; sortant : $($p.DefaultOutboundAction)"))',
      '}',
      "",
      '# --- 6. Conflits ------------------------------------------------------------------',
      '$ics = Get-Service -Name SharedAccess -ErrorAction SilentlyContinue',
      "if ($ics -and $ics.Status -eq 'Running') {",
      "  [void](Add-KjemoResultat -Categorie 'Conflits' -Controle 'ICS actif' -Etat 'PROBLEME' -Valeur 'SharedAccess en cours d''execution' -Commentaire 'ICS et RRAS assurent la meme fonction et se genent. Desactive ICS avant de configurer RRAS.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Conflits' -Controle 'ICS actif' -Etat 'OK' -Valeur 'non')",
      '}',
      '$dhcp = Get-Service -Name DHCPServer -ErrorAction SilentlyContinue',
      "if ($dhcp -and $dhcp.Status -eq 'Running') {",
      "  [void](Add-KjemoResultat -Categorie 'Conflits' -Controle 'Serveur DHCP local' -Etat 'INFO' -Valeur 'DHCPServer actif' -Commentaire 'Compatible avec RRAS, contrairement au DHCP integre a ICS : c''est un des avantages de RRAS.')",
      '}',
      '# Un autre routeur sur le meme reseau produit deux passerelles concurrentes.',
      '$voisins = @()',
      "try { $voisins = @(Get-NetNeighbor -AddressFamily IPv4 -State Reachable -ErrorAction SilentlyContinue) } catch { }",
      "[void](Add-KjemoResultat -Categorie 'Conflits' -Controle 'Voisins joignables' -Etat 'INFO' -Valeur (\"$(@($voisins).Count) entree(s) ARP actives\") -Commentaire \"Verifie qu''aucun autre routeur ou pare-feu ne sert deja de passerelle sur le reseau interne.\")",
      "",
      '# --- 7. Sortie Internet depuis le serveur -----------------------------------------',
      '$sortie = $null',
      'try { $sortie = Test-NetConnection -ComputerName $IpTest -Port 443 -WarningAction SilentlyContinue } catch { }',
      'if ($sortie) {',
      "  $etatSortie = 'PROBLEME'",
      "  if ($sortie.TcpTestSucceeded) { $etatSortie = 'OK' }",
      '  [void](Add-KjemoResultat -Categorie \'Internet\' -Controle ("TCP 443 vers $IpTest") -Etat $etatSortie -Valeur $sortie.TcpTestSucceeded -Commentaire "Le serveur doit sortir lui-meme avant de pouvoir traduire le trafic des autres.")',
      '}',
      "",
      '# --- 8. Limite assumee ---------------------------------------------------------------',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Configuration du NAT' -Etat 'INFO' -Valeur 'non automatisee dans ce lot' -Commentaire 'Les cmdlets modernes ne couvrent pas entierement la configuration du NAT RRAS. Plutot qu''employer une commande obsolete ou non documentee, ce lot s''arrete a la preparation et renvoie a la procedure officielle.')",
      "",
      "Write-Host ''",
      "Write-Host '--- Configurer le NAT dans RRAS : procedure officielle ---'",
      "Write-Host '1. Gestionnaire de serveur, Ajouter des roles : Acces a distance, service Routage.'",
      "Write-Host '2. Outils, Routage et acces distant.'",
      "Write-Host '3. Clic droit sur le serveur, Configurer et activer le routage et l''acces distant.'",
      "Write-Host '4. Choisir Traduction d''adresses reseau (NAT).'",
      "Write-Host '5. Designer l''interface publique, puis l''interface privee.'",
      "Write-Host '6. Verifier ensuite depuis un client : adresse, passerelle, DNS, puis test HTTPS.'",
      "Write-Host 'Reference : https://learn.microsoft.com/troubleshoot/windows-server/networking/set-up-routing-remote-access-intranet'",
    ];

    return assembler({
      titre: 'Verifier les prerequis RRAS et NAT - diagnostic et preparation',
      outil: 'rras-nat-readiness',
      diagnostic: true,
      admin: true,
      parametres: [
        ['InterfaceInterne', psB64(v.rrasInternal)],
        ['InterfaceExterne', psB64(v.rrasExternal)],
        ['IpTest', psB64(v.rrasTestIp)],
      ],
      corps,
      prefixeFichier: 'kjemo-rras',
    });
  },
  gui: [
    'Gestionnaire de serveur > Ajouter des rôles et fonctionnalités > Accès à distance > service de rôle Routage.',
    'Outils > Routage et accès distant.',
    'Clic droit sur le serveur > Configurer et activer le routage et l’accès distant.',
    'Choisir « Traduction d’adresses réseau (NAT) », puis désigner l’interface publique et l’interface privée.',
    'Vérifier depuis un client du réseau interne : adresse, passerelle, DNS, puis accès HTTPS.',
  ],
  keywords: [
    'rras', 'nat', 'routage et acces distant', 'remoteaccess', 'partage internet entreprise',
    'traduction d adresses', 'routeur windows', 'alternative ics',
  ],
  requiresAdmin: true,
  os: OS_SERVEUR,
  prereqs: PREREQS_SERVEUR.concat([
    'Console PowerShell en tant qu’administrateur.',
    'Windows Server : RRAS n’existe pas sur une édition client.',
    'Deux interfaces réseau distinctes, une seule portant la passerelle par défaut.',
    'ICS désactivé : les deux mécanismes assurent la même fonction et se gênent.',
  ]),
  commonErrors: [
    {
      message: 'Le service RemoteAccess ne démarre pas',
      cause: 'RRAS n’a pas encore été configuré : le service reste arrêté tant qu’aucun rôle de routage n’est actif.',
      fix: 'Configurer RRAS dans la console avant de s’attendre à voir le service démarré.',
    },
    {
      message: 'Les clients ne sortent pas malgré le NAT',
      cause: 'Interface publique et interface privée inversées dans l’assistant, ou clients sans passerelle correcte.',
      fix: 'Vérifier le sens du NAT dans la console, puis l’option 3 distribuée aux clients.',
    },
    {
      message: 'ICS et RRAS se disputent le partage',
      cause: 'Les deux services sont actifs simultanément.',
      fix: 'Désactiver ICS (ncpa.cpl, onglet Partage) avant de configurer RRAS. Ce script signale la coexistence.',
    },
  ],
  reversible: true,
  verifyAfter: [
    'Le rapport confirme l’édition serveur, deux interfaces distinctes et une seule route par défaut.',
    'Le rôle RemoteAccess apparaît comme installé ou à installer.',
    'Aucun conflit ICS signalé.',
    'Après configuration : un client du réseau interne accède à Internet, et la console RRAS affiche l’interface NAT.',
  ],
  rollback: {
    summary: 'Ce script prépare et vérifie : il ne configure rien. Il n’y a donc rien à annuler ici. La désactivation de RRAS, elle, se fait dans la console et coupe le routage pour tout le réseau interne.',
    diagnostic: '# Constater l\'etat avant toute intervention sur RRAS.\nGet-WindowsFeature -Name RemoteAccess,Routing | Format-Table Name,InstallState\nGet-Service RemoteAccess | Format-Table Name,Status,StartType\nGet-NetRoute -DestinationPrefix \'0.0.0.0/0\' | Format-Table InterfaceAlias,NextHop,RouteMetric',
    command: '# Aucune annulation necessaire pour ce diagnostic : rien n\'a ete configure.\n# Pour defaire une configuration RRAS existante, passer par la console :\n#   Outils > Routage et acces distant > clic droit sur le serveur >\n#   Desactiver le routage et l\'acces distant.\n# Cette action coupe le routage pour tout le reseau interne : previens avant.\nGet-Service RemoteAccess | Format-Table Name,Status,StartType',
    exceptional: '# AVERTISSEMENT CRITIQUE — desinstallation du role RemoteAccess.\n#\n# Desinstaller le role supprime la configuration RRAS, NAT compris, et coupe\n# l\'acces Internet de tout le reseau interne qui en depend. Un redemarrage est\n# generalement exige. Cette operation n\'est pas automatisee ici.\n#\n# Avant :\n#   1. Noter la configuration NAT en place (interfaces publique et privee).\n#   2. Prevoir le retour : une passerelle de remplacement, ou une fenetre de\n#      coupure acceptee.\n#   3. Verifier qu\'aucun acces distant VPN ne repose sur ce meme serveur.\n#\n# Reference officielle :\n# https://learn.microsoft.com/powershell/module/servermanager/uninstall-windowsfeature\n#\n# Commande, a executer manuellement :\n#   Uninstall-WindowsFeature -Name RemoteAccess -Confirm',
    warning: 'Configurer ou déconfigurer RRAS modifie le routage de tout le réseau interne. En laboratoire, c’est sans conséquence ; en production, cela se planifie.',
  },
  checks: [
    'Identifier sans ambiguïté quelle interface est publique et laquelle est privée : l’inversion est l’erreur la plus fréquente de l’assistant.',
    'Désactiver ICS avant de configurer RRAS.',
    'Vérifier qu’aucun autre routeur ne sert déjà de passerelle sur le réseau interne.',
  ],
  source: 'https://learn.microsoft.com/troubleshoot/windows-server/networking/set-up-routing-remote-access-intranet',
  sources: [
    { label: 'Configurer le routage et l’accès distant', url: 'https://learn.microsoft.com/troubleshoot/windows-server/networking/set-up-routing-remote-access-intranet' },
    { label: 'Install-RemoteAccess', url: 'https://learn.microsoft.com/powershell/module/remoteaccess/install-remoteaccess' },
    { label: 'Get-WindowsFeature', url: 'https://learn.microsoft.com/powershell/module/servermanager/get-windowsfeature' },
    { label: 'Get-NetIPInterface', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipinterface' },
  ],
};

// ---------------------------------------------------------------------------
// Catalogue exporté — complété au fil des sous-rubriques du LOT 2
// ---------------------------------------------------------------------------
export const toolsServeur = [
  outilSanteServeur,
  outilDhcpInstallation,
  outilDhcpEtendue,
  outilDhcpReservation,
  outilDhcpBaux,
  outilDhcpSauvegarde,
  outilDnsDiagnostic,
  outilDnsZone,
  outilDnsEnregistrement,
  outilAuditPermissions,
  outilSmbSessions,
  outilDiagnosticInternet,
  outilIcsPreparation,
  outilRrasPreparation,
];
