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
// Catalogue exporté — complété au fil des sous-rubriques du LOT 2
// ---------------------------------------------------------------------------
export const toolsServeur = [
  outilSanteServeur,
];
