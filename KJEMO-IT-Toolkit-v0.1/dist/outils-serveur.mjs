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

// ---------------------------------------------------------------------------
// Catalogue exporté — complété au fil des sous-rubriques du LOT 2
// ---------------------------------------------------------------------------
export const toolsServeur = [
  outilSanteServeur,
  outilDhcpInstallation,
  outilDhcpEtendue,
];
