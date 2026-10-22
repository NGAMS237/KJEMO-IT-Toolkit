/**
 * outils-impression-win-lecture.mjs — LOT 9 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Parcours A — INVENTAIRE ET DIAGNOSTIC, Windows, en lecture seule.
 *
 *   imp-win-inventaire        imprimantes, ports, pilotes, imprimante par défaut,
 *                             et le GENRE de chaque file : locale, réseau
 *                             directe ou file partagée.
 *   imp-win-diagnostic-file   UNE file nommée : objet, port, pilote, travaux,
 *                             réseau, journal — et les quatre pistes usuelles.
 *   imp-win-spouleur          le service Spooler, son dossier de spool (compté,
 *                             jamais vidé), ses incidents récents.
 *   imp-win-reseau            DNS, ping et TCP vers une imprimante, pour le
 *                             protocole réellement utilisé.
 *   imp-win-partage-unc       un chemin \\serveur\partage : joignable, présent,
 *                             quel pilote, déjà connecté ?
 *
 * Aucune de ces fiches n'appelle de cmdlet modifiante. Un test le prouve en
 * exécutant chaque script avec des doublures qui enregistrent chaque appel.
 */

import { outilImpression, rollbackLectureImpression, CHECKS_LECTURE_IMPRESSION } from './noyau-impression.mjs';
import { psB64 } from './noyau.mjs';
import {
  validerNomImprimante, validerHoteImprimante, validerPortTcpImpression,
  validerProtocoleImpression, validerUncImprimante, validerEntier, validerChoix,
  PROTOCOLES_IMPRESSION,
} from './validateurs-impression.mjs';

const ML = 'https://learn.microsoft.com/en-us/powershell/module';

export const SRC = {
  getPrinter: { label: 'Get-Printer', url: `${ML}/printmanagement/get-printer` },
  getPort: { label: 'Get-PrinterPort', url: `${ML}/printmanagement/get-printerport` },
  getDriver: { label: 'Get-PrinterDriver', url: `${ML}/printmanagement/get-printerdriver` },
  getJob: { label: 'Get-PrintJob', url: `${ML}/printmanagement/get-printjob` },
  removeJob: { label: 'Remove-PrintJob', url: `${ML}/printmanagement/remove-printjob` },
  addPort: { label: 'Add-PrinterPort', url: `${ML}/printmanagement/add-printerport` },
  addPrinter: { label: 'Add-Printer', url: `${ML}/printmanagement/add-printer` },
  getService: { label: 'Get-Service', url: `${ML}/microsoft.powershell.management/get-service` },
  restartService: { label: 'Restart-Service', url: `${ML}/microsoft.powershell.management/restart-service` },
  getWinEvent: { label: 'Get-WinEvent', url: `${ML}/microsoft.powershell.diagnostics/get-winevent` },
  getCim: { label: 'Get-CimInstance', url: `${ML}/cimcmdlets/get-ciminstance` },
  invokeCim: { label: 'Invoke-CimMethod', url: `${ML}/cimcmdlets/invoke-cimmethod` },
  win32Printer: { label: 'Classe WMI Win32_Printer', url: 'https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-printer' },
};

// ---------------------------------------------------------------------------
// Champs et vérifications partagés (réutilisés par les fiches qui agissent)
// ---------------------------------------------------------------------------

export function champNomImprimante(aide, defaut = 'HP LaserJet Accueil') {
  return {
    id: 'impNom',
    label: 'Nom exact de l’imprimante',
    type: 'text',
    default: defaut,
    placeholder: defaut,
    help: aide || 'Le nom tel que « Get-Printer » ou la fenêtre « Imprimantes et scanners » l’affiche. Aucun joker : une imprimante, pas un motif.',
  };
}

export function champHote(aide) {
  return {
    id: 'impHote',
    label: 'Adresse de l’imprimante (IPv4 ou nom DNS)',
    type: 'text',
    default: '192.168.30.50',
    placeholder: '192.168.30.50',
    help: aide || 'L’adresse IP ou le nom DNS de l’imprimante. Les adresses de boucle locale, multicast et APIPA (169.254.x.x) sont refusées.',
  };
}

export function champUnc(aide) {
  return {
    id: 'impUnc',
    label: 'Chemin UNC de la file partagée',
    type: 'text',
    default: '\\\\srv-print\\Compta',
    placeholder: '\\\\serveur\\partage',
    help: aide || 'Forme \\\\serveur\\partage, rien d’autre. Les partages masqués (nom finissant par « $ ») sont refusés.',
  };
}

export const verifierNom = (v, errors) => {
  const r = validerNomImprimante(v.impNom);
  if (!r.ok) errors.impNom = r.error;
};

/** Valide un champ avec un validateur de validateurs-impression et inscrit l'erreur. */
export function verifierChamp(errors, id, r) {
  if (!r.ok) errors[id] = r.error;
}

/** Quelques lignes PowerShell qui parsent un UNC validé en $Serveur et $Partage. */
export const LIGNES_PARSE_UNC = (variableUnc) => [
  `$uncMorceaux = ([string]${variableUnc}).TrimStart([char]92).Split([char]92)`,
  '$Serveur = [string]$uncMorceaux[0]',
  '$Partage = [string]$uncMorceaux[1]',
];

const LIMITE_ETAT = 'Un état « Normal », un ping réussi ou un port ouvert ne prouvent pas qu’une page s’imprimera : seul un travail d’impression réel le prouve.';

// ===========================================================================
// 1. INVENTAIRE
// ===========================================================================

export const impWinInventaire = outilImpression({
  id: 'imp-win-inventaire',
  famille: 'Inventaire et diagnostic Windows',
  title: 'Inventaire des imprimantes, ports et pilotes Windows',
  summary: 'Liste, sans rien modifier, les imprimantes installées sur ce poste, leurs ports, leurs pilotes et l’imprimante par défaut, et classe chaque file : imprimante locale, imprimante réseau directe (port TCP/IP) ou file partagée par un serveur. L’état affiché est celui que Windows DÉCLARE.',
  champs: [],
  commandes: {
    obligatoires: ['Get-Printer', 'Get-PrinterPort', 'Get-PrinterDriver'],
    facultatives: ['Get-CimInstance', 'Get-Service'],
  },
  prefixe: 'kjemo-imprimantes-inventaire',
  corps() {
    return `$script:Imprimantes = @()
$script:PortsListe = @()
$script:PilotesListe = @()
$script:CimListe = @()
$null = Invoke-KjemoLecture 'Imprimantes' 'Get-Printer' { $script:Imprimantes = @(Get-Printer -ErrorAction Stop) }
$null = Invoke-KjemoLecture 'Ports' 'Get-PrinterPort' { $script:PortsListe = @(Get-PrinterPort -ErrorAction Stop) }
$null = Invoke-KjemoLecture 'Pilotes' 'Get-PrinterDriver' { $script:PilotesListe = @(Get-PrinterDriver -ErrorAction Stop) }
$null = Invoke-KjemoLecture 'Defaut' 'Win32_Printer' { $script:CimListe = @(Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop) }
$null = Invoke-KjemoLecture 'Spouleur' 'Service Spooler' {
  $s = Get-Service -Name 'Spooler' -ErrorAction Stop
  $etat = 'ATTENTION'
  if ([string]$s.Status -eq 'Running') { $etat = 'OK' }
  [void](Add-KjemoResultat -Categorie 'Spouleur' -Controle 'Service Spooler' -Etat $etat -Valeur ([string]$s.Status) -Commentaire 'Etat du service. Un spouleur en cours d execution ne prouve pas que les files fonctionnent.')
}

$nbLocale = 0
$nbReseau = 0
$nbPartage = 0
$nbVirtuelle = 0
foreach ($p in $script:Imprimantes) {
  $nom = [string]$p.Name
  $nomPort = [string]$p.PortName
  $port = $null
  foreach ($pp in $script:PortsListe) { if ([string]$pp.Name -ieq $nomPort) { $port = $pp } }
  $hote = ''
  if ($null -ne $port -and $null -ne $port.PrinterHostAddress) { $hote = [string]$port.PrinterHostAddress }
  $genre = ''
  if ($nom.StartsWith('\\\\') -or [string]$p.Type -eq 'Connection') { $genre = 'file partagee (connexion a un serveur)'; $nbPartage = $nbPartage + 1 }
  elseif ($hote) { $genre = 'imprimante reseau directe (port TCP/IP vers ' + $hote + ')'; $nbReseau = $nbReseau + 1 }
  elseif ($nomPort -match '^(PORTPROMPT|nul|FILE|XPSPort|PDF|Microsoft)') { $genre = 'imprimante virtuelle (fichier, PDF ou XPS)'; $nbVirtuelle = $nbVirtuelle + 1 }
  else { $genre = 'imprimante locale (port ' + $nomPort + ')'; $nbLocale = $nbLocale + 1 }

  $statut = [string]$p.PrinterStatus
  $defaut = ''
  $horsLigne = $false
  foreach ($c in $script:CimListe) {
    if ([string]$c.Name -ieq $nom) {
      if ($c.Default -eq $true) { $defaut = ' | imprimante par defaut de ce compte' }
      if ($c.WorkOffline -eq $true) { $horsLigne = $true }
    }
  }
  $valeur = $genre + ' | etat declare : ' + $statut + ' | pilote : ' + [string]$p.DriverName + $defaut
  $etat = 'ATTENTION'
  $commentaire = 'Etat anormal declare par Windows. Ouvre le diagnostic de cette file.'
  if ($statut -eq 'Normal' -and -not $horsLigne) {
    $etat = 'OK'
    $commentaire = 'Etat DECLARE par Windows. Il ne prouve pas qu une page sortira.'
  } elseif ($horsLigne) {
    $commentaire = 'Windows la declare hors ligne (WorkOffline). Les travaux restent en attente.'
  }
  [void](Add-KjemoResultat -Categorie 'Imprimante' -Controle $nom -Etat $etat -Valeur $valeur -Commentaire $commentaire)
  if ($null -eq $port) {
    [void](Add-KjemoResultat -Categorie 'Imprimante' -Controle ($nom + ' / port') -Etat 'ATTENTION' -Valeur ('port introuvable : ' + $nomPort) -Commentaire 'Le port declare par l imprimante n est pas dans la liste des ports.')
  }
  $piloteConnu = $false
  foreach ($d in $script:PilotesListe) { if ([string]$d.Name -ieq [string]$p.DriverName) { $piloteConnu = $true } }
  if ($script:PilotesListe.Count -gt 0 -and -not $piloteConnu) {
    [void](Add-KjemoResultat -Categorie 'Imprimante' -Controle ($nom + ' / pilote') -Etat 'ATTENTION' -Valeur ('pilote non liste : ' + [string]$p.DriverName) -Commentaire 'Le pilote declare n apparait pas dans Get-PrinterDriver.')
  }
  if ($p.Shared -eq $true) {
    [void](Add-KjemoResultat -Categorie 'Imprimante' -Controle ($nom + ' / partage') -Etat 'INFO' -Valeur ('partagee sous le nom ' + [string]$p.ShareName) -Commentaire 'Cette file est publiee par CE poste : un redemarrage du spouleur interrompt aussi ses clients.')
  }
}

[void](Add-KjemoResultat -Categorie 'Synthese' -Controle 'Nombre de files' -Etat 'INFO' -Valeur ([string]$script:Imprimantes.Count) -Commentaire ('locales : ' + $nbLocale + ' | reseau directes : ' + $nbReseau + ' | partagees : ' + $nbPartage + ' | virtuelles : ' + $nbVirtuelle))

$portsSansFile = @()
foreach ($pp in $script:PortsListe) {
  $utilise = $false
  foreach ($p in $script:Imprimantes) { if ([string]$p.PortName -ieq [string]$pp.Name) { $utilise = $true } }
  if (-not $utilise) { $portsSansFile = $portsSansFile + [string]$pp.Name }
}
[void](Add-KjemoResultat -Categorie 'Ports' -Controle 'Ports sans imprimante' -Etat 'INFO' -Valeur ([string]$portsSansFile.Count) -Commentaire 'Un port inutilise est courant (ports systeme). Ce script ne supprime aucun port : ne supprime rien sans avoir verifie qu aucune file ne l attend.')
[void](Add-KjemoResultat -Categorie 'Limite' -Controle 'Ce que ce rapport prouve' -Etat 'INFO' -Valeur 'etat declare' -Commentaire 'Ce rapport dit ce que Windows DECLARE. Un etat Normal ne prouve pas qu une page s imprimera.')`.split('\n');
  },
  impression: {
    probleme: 'Tu ne sais pas ce qui est installé sur le poste, ni si une file « HP » est une imprimante locale, une imprimante réseau ou la connexion à un serveur d’impression — et sans le savoir, on cherche la panne au mauvais endroit.',
    exemple: 'Un poste de la compta affiche trois files. L’inventaire montre que « Compta-Laser » est une file partagée par le serveur SRV-PRINT, que « HP LaserJet Accueil » est un port TCP/IP vers 192.168.30.50, et que la troisième est un PDF virtuel.',
    premiere: 'Lis le GENRE de la file en panne : une file partagée se dépanne côté serveur, une imprimante réseau directe côté réseau, une imprimante locale côté câble et pilote.',
    lit: 'Get-Printer, Get-PrinterPort, Get-PrinterDriver, la classe WMI Win32_Printer (imprimante par défaut, hors ligne) et le service Spooler. Que des lectures.',
    ecrit: 'Rien sur le système. Éventuellement un fichier de rapport (JSON ou CSV) dans le dossier courant.',
    effets: 'Aucun effet sur les imprimantes, les ports, les pilotes ni les travaux. Lecture sans privilège particulier ; certains détails de la file demandent une console élevée.',
    limites: [
      LIMITE_ETAT,
      'L’imprimante par défaut est celle du compte qui lance le script, pas celle de tous les utilisateurs du poste.',
      'Le classement local / réseau / partagée est déduit du type de la file et de son port : un port inhabituel peut être mal classé.',
    ],
  },
  gui: [
    'Ouvre PowerShell. Aucune élévation n’est nécessaire pour lire.',
    'Liste les files : « Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus ».',
    'Regarde les ports : « Get-PrinterPort | Select-Object Name, PrinterHostAddress, PortNumber ».',
    'Regarde les pilotes : « Get-PrinterDriver | Select-Object Name ».',
    'Rapproche chaque file de son port : un port avec PrinterHostAddress est une imprimante réseau directe ; un nom en « \\\\serveur\\… » est une connexion à une file partagée.',
  ],
  keywords: ['imprimante', 'imprimantes', 'inventaire', 'liste', 'port', 'pilote', 'driver', 'spooler', 'get-printer', 'partagee', 'reseau', 'defaut', 'windows'],
  rollback: rollbackLectureImpression(),
  checks: CHECKS_LECTURE_IMPRESSION.concat(['Le genre de chaque file (locale, réseau directe, partagée, virtuelle) est affiché, avec l’état DÉCLARÉ par Windows.']),
  verifyAfter: [
    'Le rapport liste autant de files que « (Get-Printer).Count ».',
    'Chaque file porte son genre et son port ; un port ou un pilote introuvable est signalé en ATTENTION.',
    'La conclusion rappelle qu’un état Normal ne prouve pas qu’une page s’imprimera.',
  ],
  source: SRC.getPrinter.url,
  sources: [SRC.getPrinter, SRC.getPort, SRC.getDriver, SRC.win32Printer, SRC.getCim],
});

// ===========================================================================
// 2. DIAGNOSTIC D'UNE FILE
// ===========================================================================

export const impWinDiagnosticFile = outilImpression({
  id: 'imp-win-diagnostic-file',
  famille: 'Inventaire et diagnostic Windows',
  title: 'Diagnostic d’une file d’impression Windows',
  summary: 'Examine UNE file nommée sans rien modifier : objet, état déclaré, port et adresse, pilote, travaux en attente et leur ancienneté, joignabilité réseau du port, service Spooler et incidents récents du journal PrintService. Distingue quatre pistes : imprimante hors ligne, travail bloqué, file inaccessible, port ou pilote en cause.',
  champs: [
    champNomImprimante(),
    {
      id: 'impAge', label: 'Ancienneté d’un travail jugé suspect (minutes)', type: 'number',
      default: '30', min: 1, max: 1440,
      help: 'Un travail encore en file après ce délai est signalé comme possiblement bloqué. Rien n’est annulé.',
    },
    {
      id: 'impDocs', label: 'Afficher les noms de documents', type: 'select', default: 'Non',
      options: [['Non', 'Non — seulement l’identifiant, l’état et la taille (recommandé)'], ['Oui', 'Oui — affiche aussi le nom du document']],
      help: 'Un nom de document peut être confidentiel (paie, médical). Par défaut il n’entre pas dans le rapport.',
    },
  ],
  verifier(v, errors) {
    verifierNom(v, errors);
    verifierChamp(errors, 'impAge', validerEntier(v.impAge, 1, 1440, 'L’ancienneté'));
    verifierChamp(errors, 'impDocs', validerChoix(v.impDocs, ['Non', 'Oui'], 'Le choix'));
  },
  parametres(v) {
    return [['Imprimante', psB64(validerNomImprimante(v.impNom).value)], ['Age', `[int]${psB64(String(validerEntier(v.impAge, 1, 1440).value))}`], ['Docs', psB64(v.impDocs)]];
  },
  commandes: {
    obligatoires: ['Get-Printer', 'Get-PrinterPort', 'Get-PrintJob'],
    facultatives: ['Get-PrinterDriver', 'Get-Service', 'Get-WinEvent'],
  },
  prefixe: 'kjemo-imprimante-diagnostic',
  corps() {
    return `$res = Get-KjemoImprimanteExacte -Nom $KjemoArgImprimante
$cibleOk = Add-KjemoCibleImprimante -Resolution $res -Nom $KjemoArgImprimante
if (-not $cibleOk) {
  Write-Host 'Cible non resolue : le diagnostic de la file est interrompu.'
} else {
  $p = $res.Objet
  $nom = [string]$p.Name
  $statut = [string]$p.PrinterStatus
  $etat = 'ATTENTION'
  $com = 'Etat anormal declare par Windows : voir les pistes plus bas.'
  if ($statut -eq 'Normal') { $etat = 'OK'; $com = 'Etat DECLARE par Windows. Il ne prouve pas qu une page sortira.' }
  [void](Add-KjemoResultat -Categorie 'File' -Controle 'Etat declare' -Etat $etat -Valeur $statut -Commentaire $com)
  [void](Add-KjemoResultat -Categorie 'File' -Controle 'Type' -Etat 'INFO' -Valeur ([string]$p.Type) -Commentaire 'Connection = connexion a une file partagee par un serveur ; Local = file geree par ce poste.')
  [void](Add-KjemoResultat -Categorie 'File' -Controle 'Pilote declare' -Etat 'INFO' -Valeur ([string]$p.DriverName))

  $horsLigne = $false
  $null = Invoke-KjemoLecture 'File' 'Win32_Printer (hors ligne)' {
    foreach ($c in @(Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop)) {
      if ([string]$c.Name -ieq $nom -and $c.WorkOffline -eq $true) { $script:HorsLigneCim = $true }
    }
  }
  if ($script:HorsLigneCim -eq $true) {
    $horsLigne = $true
    [void](Add-KjemoResultat -Categorie 'Piste 1 - hors ligne' -Controle 'WorkOffline' -Etat 'ATTENTION' -Valeur 'declaree hors ligne' -Commentaire 'Windows a mis la file hors ligne : les travaux attendent. Cause frequente : imprimante injoignable ou eteinte.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Piste 1 - hors ligne' -Controle 'WorkOffline' -Etat 'INFO' -Valeur 'non declaree hors ligne' -Commentaire 'Ne prouve pas que l imprimante repond.')
  }

  # --- Port et reseau ---
  $port = $null
  $nomPort = [string]$p.PortName
  $script:PortsListe = @()
  $null = Invoke-KjemoLecture 'Port' 'Get-PrinterPort' { $script:PortsListe = @(Get-PrinterPort -ErrorAction Stop) }
  foreach ($pp in $script:PortsListe) { if ([string]$pp.Name -ieq $nomPort) { $port = $pp } }
  if ($null -eq $port) {
    [void](Add-KjemoResultat -Categorie 'Piste 4 - port ou pilote' -Controle 'Port' -Etat 'PROBLEME' -Valeur $nomPort -Commentaire 'Le port declare par la file est introuvable. Une file sans port ne peut rien imprimer.')
  } else {
    $hote = ''
    if ($null -ne $port.PrinterHostAddress) { $hote = [string]$port.PrinterHostAddress }
    $numPort = 0
    if ($null -ne $port.PortNumber) { $numPort = [int]$port.PortNumber }
    [void](Add-KjemoResultat -Categorie 'Piste 4 - port ou pilote' -Controle 'Port' -Etat 'INFO' -Valeur ($nomPort + ' -> ' + $hote + ':' + [string]$numPort) -Commentaire 'Port TCP/IP : adresse et numero de port declares.')
    if ($hote -and $numPort -gt 0) {
      [void](Test-KjemoReseau -Hote $hote -Port $numPort -Protocole 'TCP/IP')
    } elseif ($nom.StartsWith('\\\\') -or [string]$p.Type -eq 'Connection') {
      $cheminUnc = $nom.TrimStart([char]92).Split([char]92)
      [void](Add-KjemoResultat -Categorie 'Piste 3 - file inaccessible' -Controle 'Serveur de la file partagee' -Etat 'INFO' -Valeur ([string]$cheminUnc[0]) -Commentaire 'Pour une file partagee, la panne est souvent cote serveur : lance l assistant de la file partagee.')
      [void](Test-KjemoReseau -Hote ([string]$cheminUnc[0]) -Port 445 -Protocole 'SMB')
    } else {
      [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Test reseau' -Etat 'IGNORE' -Valeur 'port non reseau' -Commentaire 'Port local ou virtuel : aucun test reseau applicable.')
    }
  }

  # --- Pilote ---
  $null = Invoke-KjemoLecture 'Pilote' 'Get-PrinterDriver' {
    $connu = $false
    foreach ($d in @(Get-PrinterDriver -ErrorAction Stop)) { if ([string]$d.Name -ieq [string]$p.DriverName) { $connu = $true } }
    if ($connu) {
      [void](Add-KjemoResultat -Categorie 'Piste 4 - port ou pilote' -Controle 'Pilote installe' -Etat 'OK' -Valeur ([string]$p.DriverName) -Commentaire 'Le pilote declare figure dans Get-PrinterDriver. Cela ne dit pas qu il convient au modele.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Piste 4 - port ou pilote' -Controle 'Pilote installe' -Etat 'PROBLEME' -Valeur ([string]$p.DriverName) -Commentaire 'Pilote declare mais absent de Get-PrinterDriver.')
    }
  }

  # --- Travaux ---
  $script:Travaux = @()
  $lu = Invoke-KjemoLecture 'Travaux' 'Get-PrintJob' { $script:Travaux = @(Get-PrintJob -PrinterName $nom -ErrorAction Stop) }
  if ($lu) {
    [void](Add-KjemoResultat -Categorie 'Piste 2 - travail bloque' -Controle 'Travaux en file' -Etat 'INFO' -Valeur ([string]$script:Travaux.Count) -Commentaire 'Nombre de travaux presents dans la file.')
    $maintenant = Get-Date
    foreach ($j in $script:Travaux) {
      $etatJ = [string]$j.JobStatus
      $age = ''
      $vieux = $false
      if ($null -ne $j.SubmittedTime) {
        $minutes = [int](($maintenant - [datetime]$j.SubmittedTime).TotalMinutes)
        $age = [string]$minutes + ' min'
        if ($minutes -ge $KjemoArgAge) { $vieux = $true }
      }
      $texte = 'travail ' + [string]$j.ID + ' | ' + $etatJ + ' | utilisateur ' + [string]$j.UserName + ' | taille ' + [string]$j.Size + ' o | depuis ' + $age
      if ($KjemoArgDocs -eq 'Oui') { $texte = $texte + ' | document : ' + (Hide-KjemoSecrets ([string]$j.DocumentName)) }
      $etatJob = 'INFO'
      $comJob = 'Travail en file.'
      if ($etatJ -match '(?i)error|offline|paperout|blocked|deleting|user intervention') { $etatJob = 'ATTENTION'; $comJob = 'Etat de travail anormal. Un travail en erreur bloque souvent ceux qui le suivent.' }
      elseif ($vieux) { $etatJob = 'ATTENTION'; $comJob = 'Travail ancien : possiblement bloque. Ce script ne l annule pas ; utilise l assistant d annulation d un travail precis.' }
      [void](Add-KjemoResultat -Categorie 'Piste 2 - travail bloque' -Controle ('Travail ' + [string]$j.ID) -Etat $etatJob -Valeur $texte -Commentaire $comJob)
    }
  }

  # --- Spouleur ---
  $null = Invoke-KjemoLecture 'Spouleur' 'Service Spooler' {
    $s = Get-Service -Name 'Spooler' -ErrorAction Stop
    $e = 'PROBLEME'
    if ([string]$s.Status -eq 'Running') { $e = 'OK' }
    [void](Add-KjemoResultat -Categorie 'Piste 3 - file inaccessible' -Controle 'Service Spooler' -Etat $e -Valeur ([string]$s.Status) -Commentaire 'Sans spouleur en cours d execution, aucune file ne fonctionne.')
  }

  # --- Journal (le journal Admin de PrintService est actif par defaut ; Operational ne l est pas) ---
  $null = Invoke-KjemoLecture 'Journal' 'PrintService/Admin' {
    $debut = (Get-Date).AddDays(-3)
    $ev = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-PrintService/Admin'; StartTime = $debut; Level = 1,2,3 } -MaxEvents 5 -ErrorAction Stop)
    [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Incidents PrintService (3 jours)' -Etat 'INFO' -Valeur ([string]$ev.Count + ' evenement(s) recent(s) de niveau avertissement ou plus') -Commentaire 'Cinq au plus. Le journal peut etre vide meme en cas de panne.')
    foreach ($e in $ev) {
      $m = Hide-KjemoSecrets ([string]$e.Message)
      if ($m.Length -gt 160) { $m = $m.Substring(0, 160) + '...' }
      [void](Add-KjemoResultat -Categorie 'Journal' -Controle ('Evenement ' + [string]$e.Id) -Etat 'INFO' -Valeur $m -Commentaire ([string]$e.TimeCreated))
    }
  }
  [void](Add-KjemoResultat -Categorie 'Limite' -Controle 'Ce que ce rapport prouve' -Etat 'INFO' -Valeur 'etat declare' -Commentaire 'Ping, port ouvert et etat Normal ne prouvent pas qu une page s imprimera. Seul un travail reel le prouve.')
}`.split('\n');
  },
  impression: {
    probleme: 'Une file ne sort rien, et on ne sait pas si c’est l’imprimante, un travail coincé, le serveur ou le pilote.',
    exemple: 'La file « HP LaserJet Accueil » est « Hors ligne ». Le diagnostic montre un port TCP/IP vers 192.168.30.50, un port 9100 qui ne répond plus (délai dépassé) : la piste est réseau ou imprimante éteinte, pas le pilote.',
    premiere: 'Lis d’abord les pistes dans l’ordre : hors ligne, travail bloqué, file inaccessible, port ou pilote. Une seule suffit souvent à expliquer.',
    lit: 'Get-Printer, la classe Win32_Printer (hors ligne), Get-PrinterPort, Get-PrinterDriver, Get-PrintJob, le service Spooler, le journal PrintService/Admin et un test TCP .NET vers le port. Que des lectures.',
    ecrit: 'Rien sur le système. Éventuellement un fichier de rapport dans le dossier courant.',
    effets: 'Aucune modification de la file, des travaux ou du spouleur. Le test TCP ouvre puis ferme une connexion vers le port de l’imprimante, sans envoyer de données d’impression.',
    limites: [
      LIMITE_ETAT,
      'Le test réseau ne couvre que TCP : WSD et SNMP (UDP) ne sont pas testés.',
      'Le journal PrintService/Operational est désactivé par défaut sous Windows : son absence ne prouve rien ; seul le journal Admin est lu.',
      'Sur une file partagée, ce script ne voit que le côté client : l’état réel de l’imprimante est côté serveur.',
    ],
  },
  gui: [
    'Repère la file : « Get-Printer | Select-Object Name, PrinterStatus, PortName ».',
    'Regarde ses travaux : « Get-PrintJob -PrinterName "<nom>" ».',
    'Vérifie le port : « Get-PrinterPort -Name <port> | Select-Object Name, PrinterHostAddress, PortNumber ».',
    'Teste la connexion TCP au port : « Test-NetConnection <adresse> -Port 9100 ».',
    'Vérifie le spouleur : « Get-Service Spooler ».',
    'Rappelle-toi : tout cela montre un état déclaré ; seule une impression réelle prouve que la file marche.',
  ],
  keywords: ['imprimante', 'diagnostic', 'file', 'hors ligne', 'offline', 'travail bloque', 'queue', 'port', 'pilote', 'spooler', 'get-printjob', 'windows'],
  rollback: rollbackLectureImpression(),
  checks: CHECKS_LECTURE_IMPRESSION.concat([
    'Les quatre pistes (hors ligne, travail bloqué, file inaccessible, port ou pilote) sont séparées dans le rapport.',
    'Les noms de documents n’entrent dans le rapport que si tu le demandes.',
    'Les travaux anciens sont signalés, jamais annulés.',
  ]),
  verifyAfter: [
    'Le rapport nomme l’imprimante exacte et son port, ou refuse si le nom est absent ou ambigu.',
    'Chaque travail est listé avec son identifiant, son état et son ancienneté ; aucun n’a été annulé.',
    'Les lectures impossibles sont des ATTENTION (INACCESSIBLE), pas des OK.',
  ],
  source: SRC.getPrinter.url,
  sources: [SRC.getPrinter, SRC.getPort, SRC.getDriver, SRC.getJob, SRC.getService, SRC.getWinEvent, SRC.win32Printer],
});

// ===========================================================================
// 3. SPOULEUR
// ===========================================================================

export const impWinSpouleur = outilImpression({
  id: 'imp-win-spouleur',
  famille: 'Inventaire et diagnostic Windows',
  title: 'État du spouleur d’impression Windows',
  summary: 'Lit l’état du service Spooler (démarrage, dépendances, services qui en dépendent), compte les fichiers du dossier de spool SANS rien supprimer, dénombre les travaux en attente et relève les incidents récents du Gestionnaire de contrôle des services. Ne redémarre rien.',
  champs: [
    {
      id: 'impJours', label: 'Fenêtre des incidents (jours)', type: 'number', default: '7', min: 1, max: 60,
      help: 'Incidents du Gestionnaire de contrôle des services concernant le spouleur.',
    },
  ],
  verifier(v, errors) {
    verifierChamp(errors, 'impJours', validerEntier(v.impJours, 1, 60, 'La fenêtre'));
  },
  parametres(v) {
    return [['Jours', `[int]${psB64(String(validerEntier(v.impJours, 1, 60).value))}`]];
  },
  commandes: {
    obligatoires: ['Get-Service', 'Get-Printer'],
    facultatives: ['Get-PrintJob', 'Get-WinEvent', 'Get-ItemProperty', 'Get-ChildItem'],
  },
  prefixe: 'kjemo-spouleur-etat',
  corps() {
    return `$null = Invoke-KjemoLecture 'Spouleur' 'Service Spooler' {
  $s = Get-Service -Name 'Spooler' -ErrorAction Stop
  $e = 'PROBLEME'
  if ([string]$s.Status -eq 'Running') { $e = 'OK' }
  elseif ([string]$s.Status -ne 'Stopped') { $e = 'ATTENTION' }
  [void](Add-KjemoResultat -Categorie 'Spouleur' -Controle 'Etat' -Etat $e -Valeur ([string]$s.Status) -Commentaire 'Running = en cours ; Stopped = arrete ; les etats en transition (StartPending, StopPending) signalent un spouleur qui change ou qui bloque.')
  [void](Add-KjemoResultat -Categorie 'Spouleur' -Controle 'Type de demarrage' -Etat 'INFO' -Valeur ([string]$s.StartType) -Commentaire 'Automatic est le reglage normal.')
  $dep = @($s.DependentServices | ForEach-Object { [string]$_.Name })
  [void](Add-KjemoResultat -Categorie 'Spouleur' -Controle 'Services qui en dependent' -Etat 'INFO' -Valeur ($dep -join ', ') -Commentaire 'Un redemarrage du spouleur les touche aussi.')
  $req = @($s.ServicesDependedOn | ForEach-Object { [string]$_.Name })
  [void](Add-KjemoResultat -Categorie 'Spouleur' -Controle 'Services requis' -Etat 'INFO' -Valeur ($req -join ', '))
}

$null = Invoke-KjemoLecture 'Files' 'Get-Printer' {
  $liste = @(Get-Printer -ErrorAction Stop)
  $nbPartagees = @($liste | Where-Object { $_.Shared -eq $true }).Count
  [void](Add-KjemoResultat -Categorie 'Files' -Controle 'Files gerees par ce spouleur' -Etat 'INFO' -Valeur ([string]$liste.Count) -Commentaire ('dont partagees avec d autres machines : ' + [string]$nbPartagees + '. Redemarrer le spouleur les interromprait aussi.'))
  $total = 0
  $enErreur = 0
  foreach ($f in $liste) {
    try {
      $tr = @(Get-PrintJob -PrinterName ([string]$f.Name) -ErrorAction Stop)
      $total = $total + $tr.Count
      $enErreur = $enErreur + @($tr | Where-Object { [string]$_.JobStatus -match '(?i)error|blocked|offline|paperout' }).Count
    } catch { }
  }
  $e = 'INFO'
  if ($enErreur -gt 0) { $e = 'ATTENTION' }
  [void](Add-KjemoResultat -Categorie 'Files' -Controle 'Travaux en attente (toutes files)' -Etat $e -Valeur ([string]$total) -Commentaire ('dont en erreur ou bloques : ' + [string]$enErreur))
}

$null = Invoke-KjemoLecture 'Dossier de spool' 'Chemin et contenu' {
  $chemin = $env:SystemRoot + '\\System32\\spool\\PRINTERS'
  try {
    $reg = Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers' -Name 'DefaultSpoolDirectory' -ErrorAction Stop
    if ($null -ne $reg.DefaultSpoolDirectory -and [string]$reg.DefaultSpoolDirectory) { $chemin = [string]$reg.DefaultSpoolDirectory }
  } catch { }
  $fichiers = @(Get-ChildItem -LiteralPath $chemin -File -ErrorAction Stop)
  $taille = 0
  foreach ($f in $fichiers) { $taille = $taille + [int64]$f.Length }
  $ko = [int]($taille / 1024)
  [void](Add-KjemoResultat -Categorie 'Dossier de spool' -Controle 'Fichiers' -Etat 'INFO' -Valeur ([string]$fichiers.Count + ' fichier(s), ' + [string]$ko + ' Ko') -Commentaire ('Dossier : ' + $chemin + '. Ce script COMPTE ; il ne supprime ni ne deplace rien. Vider ce dossier a la main perd les travaux en attente.'))
  $anciens = @($fichiers | Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-24) })
  if ($anciens.Count -gt 0) {
    [void](Add-KjemoResultat -Categorie 'Dossier de spool' -Controle 'Fichiers de plus de 24 h' -Etat 'ATTENTION' -Valeur ([string]$anciens.Count) -Commentaire 'Des fichiers anciens peuvent etre des travaux coinces. Identifie-les par l assistant de diagnostic de file avant toute action.')
  }
}

$null = Invoke-KjemoLecture 'Journal' 'Incidents du spouleur' {
  $debut = (Get-Date).AddDays(-$KjemoArgJours)
  $ev = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Service Control Manager'; StartTime = $debut } -MaxEvents 200 -ErrorAction Stop |
    Where-Object { [string]$_.Message -match '(?i)spooler|spouleur|print spooler' })
  $e = 'INFO'
  if ($ev.Count -gt 0) { $e = 'ATTENTION' }
  [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Evenements du spouleur' -Etat $e -Valeur ([string]$ev.Count + ' evenement(s)') -Commentaire 'Arrets, redemarrages et plantages signales par le Gestionnaire de controle des services.')
  foreach ($x in ($ev | Select-Object -First 5)) {
    $m = Hide-KjemoSecrets ([string]$x.Message)
    if ($m.Length -gt 160) { $m = $m.Substring(0, 160) + '...' }
    [void](Add-KjemoResultat -Categorie 'Journal' -Controle ('Evenement ' + [string]$x.Id) -Etat 'INFO' -Valeur $m -Commentaire ([string]$x.TimeCreated))
  }
}
[void](Add-KjemoResultat -Categorie 'Limite' -Controle 'Ce que ce rapport prouve' -Etat 'INFO' -Valeur 'etat declare' -Commentaire 'Un spouleur Running ne prouve pas qu une file imprime. Ce script ne redemarre rien : pour cela, utilise l assistant dedie.')`.split('\n');
  },
  impression: {
    probleme: 'Plus rien ne s’imprime sur le poste, ou des travaux restent coincés. Avant de redémarrer le spouleur « pour voir », on veut savoir s’il tourne, ce qu’il porte et ce qui s’est passé.',
    exemple: 'Le spouleur est « Running » mais le dossier de spool contient 40 fichiers dont 12 de plus de 24 h, et le journal montre deux arrêts inattendus cette semaine : la piste est un travail corrompu, pas un service arrêté.',
    premiere: 'Regarde l’état du service, puis le nombre de travaux en erreur, puis le journal. Ne redémarre qu’après avoir vu ce que le redémarrage interromprait.',
    lit: 'Le service Spooler et ses dépendances, Get-Printer et Get-PrintJob (comptage), le dossier de spool (nombre de fichiers et taille, sans les ouvrir), le journal System (Service Control Manager).',
    ecrit: 'Rien sur le système. Éventuellement un fichier de rapport dans le dossier courant.',
    effets: 'Aucun : ni redémarrage, ni suppression, ni déplacement de fichiers de spool.',
    limites: [
      'Le script compte les fichiers de spool mais ne les associe pas à un travail précis : pour cela, utilise le diagnostic de la file.',
      'La lecture du dossier de spool et du registre peut être refusée sans console élevée : le rapport le dit (INACCESSIBLE) au lieu de conclure.',
      LIMITE_ETAT,
    ],
  },
  gui: [
    'Regarde le service : « Get-Service Spooler | Format-List Name, Status, StartType ».',
    'Regarde ce qui en dépend : « (Get-Service Spooler).DependentServices ».',
    'Compte les travaux : « Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name } ».',
    'Regarde le dossier de spool SANS le vider : « Get-ChildItem C:\\Windows\\System32\\spool\\PRINTERS ».',
    'Regarde le journal : « Get-WinEvent -FilterHashtable @{LogName="System"; ProviderName="Service Control Manager"} -MaxEvents 50 ».',
  ],
  keywords: ['spooler', 'spouleur', 'service', 'spool', 'file d attente', 'bloque', 'impression', 'travaux', 'windows'],
  rollback: rollbackLectureImpression(),
  checks: CHECKS_LECTURE_IMPRESSION.concat([
    'Le dossier de spool est COMPTÉ et jamais vidé, déplacé ni ouvert.',
    'Le script ne redémarre ni ne démarre le spouleur : c’est l’affaire d’un autre assistant, avec confirmation.',
  ]),
  verifyAfter: [
    'Le rapport donne l’état du service, ses dépendances et le nombre de files partagées.',
    'Le nombre de fichiers de spool est donné, avec la mention que rien n’a été supprimé.',
    'Après le script, le dossier de spool contient exactement les mêmes fichiers qu’avant.',
  ],
  source: SRC.getService.url,
  sources: [SRC.getService, SRC.getPrinter, SRC.getJob, SRC.getWinEvent],
});

// ===========================================================================
// 4. RÉSEAU VERS UNE IMPRIMANTE
// ===========================================================================

export const impWinReseau = outilImpression({
  id: 'imp-win-reseau',
  famille: 'Réseau et files partagées',
  title: 'Joignabilité réseau d’une imprimante, par protocole',
  summary: 'Teste, depuis ce poste, la résolution DNS, le ping et la connexion TCP vers une imprimante, pour le protocole que tu utilises réellement (RAW 9100, LPR 515, IPP 631, IPPS ou SMB 445). Signale si Windows a déjà un port vers cette adresse. N’envoie aucune donnée d’impression.',
  champs: [
    champHote(),
    {
      id: 'impProto', label: 'Protocole réellement utilisé', type: 'select', default: 'RAW',
      options: Object.entries(PROTOCOLES_IMPRESSION).map(([k, p]) => [k, p.nom]),
      help: 'Le port testé en découle. Si tu ne sais pas lequel est configuré, regarde le port TCP/IP de la file avec l’assistant de diagnostic.',
    },
    {
      id: 'impPort', label: 'Port TCP (vide = défaut du protocole)', type: 'text', default: '', optionnel: true,
      help: 'À renseigner seulement si l’imprimante écoute ailleurs que sur le port habituel du protocole.',
    },
  ],
  verifier(v, errors) {
    verifierChamp(errors, 'impHote', validerHoteImprimante(v.impHote));
    verifierChamp(errors, 'impProto', validerProtocoleImpression(v.impProto));
    if (String(v.impPort ?? '').trim() !== '') verifierChamp(errors, 'impPort', validerPortTcpImpression(v.impPort));
  },
  parametres(v) {
    const proto = String(v.impProto);
    const port = String(v.impPort ?? '').trim() === '' ? PROTOCOLES_IMPRESSION[proto].port : validerPortTcpImpression(v.impPort).value;
    return [['Hote', psB64(validerHoteImprimante(v.impHote).value)], ['Protocole', psB64(proto)], ['Port', `[int]${psB64(String(port))}`]];
  },
  commandes: { obligatoires: ['Get-PrinterPort'], facultatives: [] },
  prefixe: 'kjemo-imprimante-reseau',
  corps() {
    return `[void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Imprimante testee' -Etat 'INFO' -Valeur ($KjemoArgHote + ' / ' + $KjemoArgProtocole + ' / TCP ' + [string]$KjemoArgPort) -Commentaire 'Le test porte sur le protocole declare dans le formulaire. Un autre protocole peut etre ouvert ou ferme sans que ce test le voie.')
$etatReseau = Test-KjemoReseau -Hote $KjemoArgHote -Port $KjemoArgPort -Protocole $KjemoArgProtocole
if ($KjemoArgProtocole -eq 'IPP' -or $KjemoArgProtocole -eq 'IPPS') {
  [void](Add-KjemoResultat -Categorie 'Limite' -Controle 'IPP' -Etat 'INFO' -Valeur 'TCP seulement' -Commentaire 'Le test ouvre une connexion TCP ; il n envoie aucune requete IPP et ne verifie ni le chemin de la file ni le chiffrement.')
}
if ($KjemoArgProtocole -eq 'LPR') {
  [void](Add-KjemoResultat -Categorie 'Limite' -Controle 'LPR' -Etat 'INFO' -Valeur 'nom de file non verifie' -Commentaire 'LPR demande un nom de file cote imprimante : un port ouvert ne dit pas que ce nom est le bon.')
}
$script:PortsListe = @()
$lu = Invoke-KjemoLecture 'Windows' 'Get-PrinterPort' { $script:PortsListe = @(Get-PrinterPort -ErrorAction Stop) }
if ($lu) {
  $trouve = @($script:PortsListe | Where-Object { [string]$_.PrinterHostAddress -ieq $KjemoArgHote })
  if ($trouve.Count -gt 0) {
    $noms = ($trouve | ForEach-Object { [string]$_.Name }) -join ', '
    [void](Add-KjemoResultat -Categorie 'Windows' -Controle 'Port existant pour cette adresse' -Etat 'INFO' -Valeur $noms -Commentaire 'Windows a deja un port TCP/IP vers cette adresse : une imprimante Windows est probablement deja configuree dessus.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Windows' -Controle 'Port existant pour cette adresse' -Etat 'INFO' -Valeur 'aucun' -Commentaire 'Aucun port TCP/IP de ce poste ne vise cette adresse (la comparaison est textuelle : un nom DNS et son adresse IP ne sont pas rapproches).')
  }
}
[void](Add-KjemoResultat -Categorie 'Limite' -Controle 'Ce que ce rapport prouve' -Etat 'INFO' -Valeur 'joignabilite' -Commentaire 'Un port ouvert prouve que quelque chose ecoute, PAS qu une page sortira. Les protocoles UDP (WSD, SNMP) ne sont pas testes.')`.split('\n');
  },
  impression: {
    probleme: 'Une imprimante réseau ne répond pas depuis ce poste. Est-ce le DNS, le réseau, un pare-feu ou le mauvais protocole ?',
    exemple: 'Le ping de 192.168.30.50 répond, mais le port RAW 9100 est refusé : l’imprimante est allumée, mais son impression RAW est désactivée ou elle attend sur un autre protocole.',
    premiere: 'Teste le protocole que la file utilise réellement. Un ping qui passe avec un port fermé n’est pas la même panne qu’un port qui ne répond pas du tout.',
    lit: 'La résolution DNS (.NET), le ping (.NET), une connexion TCP (.NET) vers le port du protocole, et Get-PrinterPort pour savoir si Windows a déjà un port vers cette adresse.',
    ecrit: 'Rien sur le système. Éventuellement un fichier de rapport dans le dossier courant.',
    effets: 'Une connexion TCP est ouverte puis fermée vers l’imprimante, sans donnée d’impression. Un ping peut apparaître dans les journaux du réseau.',
    limites: [
      LIMITE_ETAT,
      'Seul TCP est testé. WSD et SNMP (UDP) ne le sont pas, et une imprimante WSD peut imprimer alors que 9100 est fermé.',
      'Le test part de CE poste : un pare-feu ou un VLAN peut autoriser un autre poste et pas celui-ci.',
    ],
  },
  gui: [
    'Résous le nom : « Resolve-DnsName <nom> ».',
    'Teste le ping : « Test-Connection <adresse> -Count 2 ».',
    'Teste le port du protocole : « Test-NetConnection <adresse> -Port 9100 » (RAW), 515 (LPR), 631 (IPP).',
    'Compare avec le port configuré dans Windows : « Get-PrinterPort | Where-Object PrinterHostAddress -eq "<adresse>" ».',
    'Rappelle-toi : un port ouvert ne prouve pas qu’une page sortira.',
  ],
  keywords: ['imprimante', 'reseau', 'ping', 'port 9100', 'raw', 'lpr', 'ipp', 'tcp', 'joignable', 'dns', 'windows'],
  rollback: rollbackLectureImpression(),
  checks: CHECKS_LECTURE_IMPRESSION.concat([
    'L’adresse est validée : boucle locale, 0.x, multicast et APIPA sont refusées.',
    'Aucune donnée d’impression n’est envoyée : la connexion TCP est ouverte puis fermée.',
  ]),
  verifyAfter: [
    'Le rapport montre séparément DNS, ping et TCP, chacun avec son état.',
    'La conclusion ne dit jamais que l’imprimante « fonctionne » : elle dit ce qui a répondu.',
  ],
  source: SRC.getPort.url,
  sources: [SRC.getPort, SRC.getPrinter],
});

// ===========================================================================
// 5. FILE PARTAGÉE (UNC)
// ===========================================================================

export const impWinPartageUnc = outilImpression({
  id: 'imp-win-partage-unc',
  famille: 'Réseau et files partagées',
  title: 'Contrôle d’une file partagée \\\\serveur\\partage',
  summary: 'Vérifie une file d’impression partagée avant de s’y connecter : le serveur répond-il (DNS, SMB 445), la file existe-t-elle sur ce serveur, quel pilote réclame-t-elle, ce pilote est-il déjà installé ici, et ce poste y est-il déjà connecté ? Ne connecte rien.',
  champs: [champUnc()],
  verifier(v, errors) {
    verifierChamp(errors, 'impUnc', validerUncImprimante(v.impUnc));
  },
  parametres(v) {
    return [['Unc', psB64(validerUncImprimante(v.impUnc).value)]];
  },
  commandes: { obligatoires: ['Get-Printer'], facultatives: ['Get-PrinterDriver'] },
  prefixe: 'kjemo-partage-unc',
  corps() {
    return [
      ...LIGNES_PARSE_UNC('$KjemoArgUnc'),
      `[void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Serveur' -Etat 'INFO' -Valeur $Serveur -Commentaire ('Partage : ' + $Partage))
$etatSmb = Test-KjemoReseau -Hote $Serveur -Port 445 -Protocole 'SMB'

$script:Locales = @()
$lu = Invoke-KjemoLecture 'Ce poste' 'Get-Printer' { $script:Locales = @(Get-Printer -ErrorAction Stop) }
if ($lu) {
  $deja = @($script:Locales | Where-Object { [string]$_.Name -ieq $KjemoArgUnc })
  if ($deja.Count -gt 0) {
    [void](Add-KjemoResultat -Categorie 'Ce poste' -Controle 'Deja connecte' -Etat 'INFO' -Valeur 'oui, pour ce compte' -Commentaire 'Les connexions de file partagee sont propres au compte. Un autre compte du poste peut ne pas l avoir.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Ce poste' -Controle 'Deja connecte' -Etat 'INFO' -Valeur 'non, pour ce compte')
  }
}

$piloteDistant = ''
$script:Distantes = @()
if ($etatSmb -eq 'OUVERT') {
  $lu2 = Invoke-KjemoLecture 'Serveur' 'Get-Printer -ComputerName' { $script:Distantes = @(Get-Printer -ComputerName $Serveur -ErrorAction Stop) }
  if ($lu2) {
    $f = @($script:Distantes | Where-Object { [string]$_.ShareName -ieq $Partage })
    if ($f.Count -eq 1) {
      $piloteDistant = [string]$f[0].DriverName
      $e = 'ATTENTION'
      if ([string]$f[0].PrinterStatus -eq 'Normal') { $e = 'OK' }
      [void](Add-KjemoResultat -Categorie 'Serveur' -Controle 'File partagee' -Etat $e -Valeur ([string]$f[0].Name + ' | etat declare : ' + [string]$f[0].PrinterStatus + ' | pilote : ' + $piloteDistant) -Commentaire 'Etat declare par le serveur : il ne prouve pas qu une page sortira.')
    } elseif ($f.Count -eq 0) {
      [void](Add-KjemoResultat -Categorie 'Serveur' -Controle 'File partagee' -Etat 'PROBLEME' -Valeur 'partage introuvable' -Commentaire 'Le serveur repond mais ne publie aucune file sous ce nom de partage.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Serveur' -Controle 'File partagee' -Etat 'PROBLEME' -Valeur ([string]$f.Count + ' correspondances') -Commentaire 'Plusieurs files portent ce nom de partage : ambigu, aucune n est choisie.')
    }
  }
} else {
  [void](Add-KjemoResultat -Categorie 'Serveur' -Controle 'File partagee' -Etat 'IGNORE' -Valeur 'serveur non joignable en SMB' -Commentaire 'La lecture du serveur est ignoree : sans SMB, rien ne peut etre conclu sur la file.')
}

if ($piloteDistant) {
  $null = Invoke-KjemoLecture 'Ce poste' 'Get-PrinterDriver' {
    $present = $false
    foreach ($d in @(Get-PrinterDriver -ErrorAction Stop)) { if ([string]$d.Name -ieq $piloteDistant) { $present = $true } }
    if ($present) {
      [void](Add-KjemoResultat -Categorie 'Ce poste' -Controle 'Pilote deja installe' -Etat 'OK' -Valeur $piloteDistant -Commentaire 'La connexion pourra utiliser un pilote deja present ici.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Ce poste' -Controle 'Pilote deja installe' -Etat 'ATTENTION' -Valeur ('absent : ' + $piloteDistant) -Commentaire 'Se connecter obligerait Windows a installer ce pilote depuis le serveur (Point and Print). L assistant de connexion refuse par defaut dans ce cas.')
    }
  }
}
[void](Add-KjemoResultat -Categorie 'Limite' -Controle 'Ce que ce rapport prouve' -Etat 'INFO' -Valeur 'etat declare' -Commentaire 'Ce controle ne connecte rien et ne prouve pas qu une page sortira. La lecture du serveur demande des droits : un refus est un INACCESSIBLE, pas un etat normal.')`,
    ];
  },
  impression: {
    probleme: 'Avant de connecter un poste à une file partagée du serveur d’impression, on veut savoir si le serveur répond, si la file existe vraiment, et si la connexion va installer un pilote.',
    exemple: '\\\\srv-print\\Compta : SMB répond, la file « Compta » existe et réclame le pilote « HP Universal Printing PCL 6 », absent de ce poste — la connexion déclencherait une installation de pilote.',
    premiere: 'Regarde si le pilote réclamé est déjà installé ici. S’il ne l’est pas, c’est une décision à prendre, pas un détail.',
    lit: 'Un test DNS et SMB (TCP 445) vers le serveur, Get-Printer sur ce poste puis Get-Printer -ComputerName sur le serveur, Get-PrinterDriver ici. Que des lectures.',
    ecrit: 'Rien sur le système. Éventuellement un fichier de rapport dans le dossier courant.',
    effets: 'Aucune connexion de file n’est créée. Une connexion TCP vers le port 445 du serveur est ouverte puis fermée.',
    limites: [
      'Lire les files d’un serveur demande des droits sur ce serveur : un refus est signalé comme INACCESSIBLE et ne prouve pas que la file est absente.',
      LIMITE_ETAT,
      'Les connexions de file partagée sont propres au compte : ce que voit ce script n’est pas ce que voit un autre utilisateur du poste.',
    ],
  },
  gui: [
    'Teste le serveur : « Test-NetConnection <serveur> -Port 445 ».',
    'Liste ses files : « Get-Printer -ComputerName <serveur> | Select-Object Name, ShareName, DriverName, PrinterStatus ».',
    'Compare le pilote réclamé aux pilotes installés ici : « Get-PrinterDriver | Select-Object Name ».',
    'Regarde si tu es déjà connecté : « Get-Printer | Where-Object Name -like "\\\\*" ».',
  ],
  keywords: ['partage', 'unc', 'serveur d impression', 'file partagee', 'smb', 'point and print', 'pilote', 'connexion', 'windows'],
  rollback: rollbackLectureImpression(),
  checks: CHECKS_LECTURE_IMPRESSION.concat([
    'Le chemin UNC est validé : deux antislash, un serveur, un partage, rien d’autre ; les partages masqués et les jokers sont refusés.',
    'Aucune connexion n’est créée : Add-Printer n’est jamais appelé.',
  ]),
  verifyAfter: [
    'Le rapport dit si le serveur répond en SMB, si la file existe et quel pilote elle réclame.',
    'Après le script, « Get-Printer » liste exactement les mêmes files qu’avant.',
  ],
  source: SRC.getPrinter.url,
  sources: [SRC.getPrinter, SRC.getDriver],
});

export const toolsImpressionLecture = [
  impWinInventaire, impWinDiagnosticFile, impWinSpouleur, impWinReseau, impWinPartageUnc,
];
