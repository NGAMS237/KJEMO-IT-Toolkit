/**
 * outils-azure-vm.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Famille C : machines virtuelles. Trois assistants lisent (inventaire, état et
 * dépannage, disques et interfaces) ; deux agissent (démarrage, arrêt).
 *
 * LA DISTINCTION QUI COÛTE DE L'ARGENT : arrêtée n'est pas désallouée.
 *
 *   - « Arrêtée » (VM stopped) : le système d'exploitation est arrêté, mais
 *     Azure garde le matériel réservé. Le calcul reste FACTURÉ.
 *   - « Désallouée » (VM deallocated) : le matériel est rendu. Le calcul n'est
 *     plus facturé. Les disques, les adresses IP statiques et les sauvegardes,
 *     eux, le restent. Une adresse IP publique dynamique est libérée et peut
 *     changer au prochain démarrage ; le disque temporaire est perdu.
 *
 * Éteindre une machine depuis le système d'exploitation (shutdown) la laisse
 * « arrêtée » et facturée : c'est l'erreur de laboratoire la plus courante.
 *
 * LES DEUX ACTIONS. Start-AzVM et Stop-AzVM sont, avec Restore-AzRecoveryServices
 * BackupItem, les seules commandes du lot qui prennent réellement en charge
 * -WhatIf. Le mode par défaut les exécute donc avec -WhatIf : une vraie
 * prévisualisation, pas un texte qui prétend en être une. Agir exige une cible
 * précise (un seul groupe de ressources, un seul nom, sans joker), le mode
 * « Appliquer » ET la phrase de confirmation exacte.
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
  validerBorne,
  validerChoixAzure,
} from './validateurs-azure.mjs';

const FAMILLE = 'Machines virtuelles';
const doc = (chemin) => `https://learn.microsoft.com/${chemin}`;
const verif = (errors, champ, r) => { if (!r.ok) errors[champ] = r.error; return r; };

const SRC_FACTURATION_VM = { label: 'États et facturation des machines virtuelles Azure', url: doc('azure/virtual-machines/states-billing') };

const PREREQS_VM_LECTURE = ['Rôle Lecteur (Reader) sur le groupe de ressources de la machine, au minimum.'];
const PREREQS_VM_ACTION = ['Un rôle qui autorise l’action sur CETTE machine : par exemple « Contributeur de machine virtuelle » au niveau de la machine ou de son groupe. Pas besoin de Propriétaire.'];

const ERREURS_VM = [
  {
    message: 'ResourceNotFound / ResourceGroupNotFound',
    cause: 'Le nom de la machine ou du groupe de ressources est faux, ou la machine est dans un autre abonnement que celui de la session.',
    fix: 'Vérifie l’orthographe dans le portail et le contexte affiché en tête de rapport. Aucun nom approchant n’est choisi à ta place.',
  },
];

// ===========================================================================
// Lecture
// ===========================================================================

/** 8. azure-vm-inventaire */
export const outilAzureVmInventaire = outilAzure({
  id: 'azure-vm-inventaire',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-vm-inventaire',
  title: 'Inventaire des machines virtuelles Azure et de leur état réel',
  summary: 'Liste les machines virtuelles de l’abonnement (ou d’un groupe de ressources) avec leur taille, leur région et leur état d’alimentation réel, et signale celles qui sont arrêtées sans être désallouées — donc encore facturées. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzVM'], facultatives: [] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources (facultatif)', default: '', help: 'Vide = tout l’abonnement. Nom exact, sans joker.' },
    { id: 'azLimite', label: 'Nombre maximal de machines détaillées', type: 'number', default: '100', min: 1, max: 500, help: 'Entre 1 et 500.' },
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
    ...LIGNES_AIDES_AZ,
    "$vms = @(Invoke-KjemoLecture 'Machines virtuelles' 'Configuration' {",
    '  if ($KjemoArgRg) { Get-AzVM -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzVM -ErrorAction Stop }',
    '})',
    '$lectureVm = $script:KjemoLectureOk',
    "$statuts = @(Invoke-KjemoLecture 'Machines virtuelles' 'Etat d alimentation' {",
    '  if ($KjemoArgRg) { Get-AzVM -ResourceGroupName $KjemoArgRg -Status -ErrorAction Stop } else { Get-AzVM -Status -ErrorAction Stop }',
    '})',
    '$lectureStatut = $script:KjemoLectureOk',
    'if ($lectureVm) {',
    "  [void](Add-KjemoResultat -Categorie 'Machines virtuelles' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$vms.Count + ' machine(s)'))",
    '  $parCle = @{}',
    '  foreach ($s in $statuts) { $parCle[(([string]$s.ResourceGroupName) + \'|\' + ([string]$s.Name)).ToLowerInvariant()] = $s }',
    '  foreach ($vm in @($vms | Sort-Object -Property Name | Select-Object -First ([int]$KjemoArgLimite))) {',
    "    $cle = (([string]$vm.ResourceGroupName) + '|' + ([string]$vm.Name)).ToLowerInvariant()",
    "    $etat = 'INFO'",
    "    $puissance = 'inconnu (lecture de l etat inaccessible)'",
    "    $note = 'Taille : ' + [string]$vm.HardwareProfile.VmSize + '. Region : ' + [string]$vm.Location + '. Groupe : ' + [string]$vm.ResourceGroupName + '.'",
    '    if ($lectureStatut -and $parCle.ContainsKey($cle)) {',
    '      $puissance = Get-KjemoPowerState $parCle[$cle]',
    "      if (-not $puissance) { $puissance = 'etat non fourni' }",
    "      if ($puissance -eq 'VM stopped') {",
    "        $etat = 'ATTENTION'",
    "        $note = $note + ' ARRETEE MAIS NON DESALLOUEE : le calcul reste FACTURE. Desallouer pour arreter la facturation du calcul.'",
    "      } elseif ($puissance -eq 'VM deallocated') {",
    "        $note = $note + ' Desallouee : calcul non facture ; disques, IP statiques et sauvegardes restent factures.'",
    '      }',
    '    } elseif (-not $lectureStatut) {',
    "      $etat = 'ATTENTION'",
    '    }',
    "    [void](Add-KjemoResultat -Categorie 'Machines virtuelles' -Controle ([string]$vm.Name) -Etat $etat -Valeur $puissance -Commentaire $note)",
    '  }',
    '  if ($vms.Count -gt [int]$KjemoArgLimite) {',
    "    [void](Add-KjemoResultat -Categorie 'Machines virtuelles' -Controle 'Limite' -Etat 'INFO' -Valeur ('seules les ' + [string]$KjemoArgLimite + ' premieres sont detaillees') -Commentaire 'Filtre par groupe de ressources ou augmente la limite.')",
    '  }',
    '  if ($vms.Count -eq 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Machines virtuelles' -Controle 'Resultat' -Etat 'INFO' -Valeur 'aucune machine lue' -Commentaire 'Aucune machine visible avec tes droits dans ce perimetre. Cela ne prouve pas qu aucune n existe.')",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Machines virtuelles : la liste avec l’état (En cours d’exécution, Arrêtée, Arrêtée (désallouée)).',
    'Portail Azure > une machine > Vue d’ensemble : l’état exact, l’adresse IP, la taille, le système d’exploitation.',
    'Portail Azure > Gestion des coûts > Analyse des coûts, regroupée par ressource : ce que chaque machine coûte réellement.',
    'Cloud Shell > Get-AzVM -Status : la même information depuis un terminal.',
  ],
  keywords: ['machine virtuelle', 'vm', 'azure vm', 'get-azvm', 'inventaire vm', 'etat vm', 'arretee', 'desallouee', 'deallocated', 'stopped', 'facturee', 'power state', 'laboratoire'],
  prereqs: PREREQS_VM_LECTURE,
  commonErrors: ERREURS_VM.concat([
    {
      message: 'Une machine « Arrêtée » continue de coûter',
      cause: 'Arrêtée (VM stopped) n’est pas désallouée : Azure garde le matériel réservé et continue de facturer le calcul.',
      fix: 'Pour cesser la facturation du calcul, la machine doit être désallouée (état « Arrêtée (désallouée) »). Voir l’assistant d’arrêt. Les disques et IP statiques restent facturés dans les deux cas.',
    },
  ]),
  verifyAfter: [
    'Compare le nombre de machines avec la liste du portail pour le même périmètre.',
    'Pour chaque ligne « ARRETEE MAIS NON DESALLOUEE », ouvre la machine dans le portail : l’état affiché doit être le même.',
    'Aucune ligne n’est INACCESSIBLE ; sinon l’état d’alimentation est inconnu pour certaines machines.',
  ],
  rollback: rollbackLecture('# L’état d’alimentation d’une machine précise\nGet-AzVM -ResourceGroupName \'rg-lab\' -Name \'vm-lab-01\' -Status | Select-Object -ExpandProperty Statuses'),
  checks: CHECKS_LECTURE,
  source: doc('powershell/module/az.compute/get-azvm'),
  sources: [
    { label: 'Get-AzVM', url: doc('powershell/module/az.compute/get-azvm') },
    SRC_FACTURATION_VM,
    { label: 'Tailles des machines virtuelles dans Azure', url: doc('azure/virtual-machines/sizes/overview') },
  ],
  cloud: {
    probleme: 'Savoir ce qui tourne, ce qui est arrêté, et surtout ce qui est « arrêté mais encore facturé ». Un laboratoire oublié coûte de l’argent chaque heure.',
    exemple: 'Après un cours, trois machines du laboratoire ont été éteintes depuis Windows. Elles sont « Arrêtées » mais pas désallouées : le calcul est toujours facturé. L’inventaire les signale.',
    lit: ['La configuration des machines (taille, région, groupe)', 'L’état d’alimentation réel de chaque machine'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur le périmètre lu'],
    licences: ['Aucune'],
    limites: [
      'L’état d’alimentation vient de l’API Azure ; un état transitoire (démarrage, désallocation en cours) est possible.',
      'Le coût réel se lit dans la Gestion des coûts : cet assistant signale un risque de facturation, il ne chiffre rien.',
      'Les ensembles de machines virtuelles identiques (VMSS) ne sont pas couverts.',
    ],
  },
});

/** 9. azure-vm-etat */
export const outilAzureVmEtat = outilAzure({
  id: 'azure-vm-etat',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-vm-etat',
  title: 'Configuration, état et éléments de dépannage d’une machine virtuelle',
  summary: 'Pour UNE machine précise : configuration, état d’alimentation, état de l’agent invité et des extensions, diagnostics de démarrage activés ou non, identité, étiquettes, et dernières opérations du journal d’activité. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzVM'], facultatives: ['Get-AzActivityLog'] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources', default: 'rg-lab', help: 'Nom exact, sans joker.' },
    { id: 'azVm', label: 'Machine virtuelle', default: 'vm-lab-01', help: 'Nom exact d’UNE machine, sans joker.' },
    { id: 'azHeures', label: 'Journal d’activité : heures en arrière', type: 'number', default: '24', min: 1, max: 168, help: 'Entre 1 et 168 (sept jours).' },
  ],
  verifier(v, errors) {
    verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azVm', validerNomVm(v.azVm));
    verif(errors, 'azHeures', validerBorne(v.azHeures, 1, 168, 'La fenêtre'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg).trim())],
    ['Vm', psB64(String(v.azVm).trim())],
    ['Heures', psB64(String(validerBorne(v.azHeures, 1, 168).value))],
  ],
  corps: () => [
    ...LIGNES_AIDES_AZ,
    "$vm = @(Invoke-KjemoLecture 'Machine' 'Configuration' { Get-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -ErrorAction Stop })",
    'if ($script:KjemoLectureOk -and $vm.Count -ne 1) {',
    "  [void](Add-KjemoResultat -Categorie 'Machine' -Controle 'Cible' -Etat 'PROBLEME' -Valeur ([string]$vm.Count + ' machine(s) retournee(s)') -Commentaire 'Une cible ambigue ou absente est refusee : exactement UNE machine est attendue.')",
    '} elseif ($script:KjemoLectureOk) {',
    '  $m = $vm[0]',
    "  [void](Add-KjemoResultat -Categorie 'Configuration' -Controle 'Taille et region' -Etat 'INFO' -Valeur ([string]$m.HardwareProfile.VmSize + ' / ' + [string]$m.Location) -Commentaire ('Provisionnement : ' + [string]$m.ProvisioningState))",
    "  $systeme = ''",
    '  if ($null -ne $m.StorageProfile -and $null -ne $m.StorageProfile.OsDisk) { $systeme = [string]$m.StorageProfile.OsDisk.OsType + \' - disque \' + [string]$m.StorageProfile.OsDisk.Name }',
    "  [void](Add-KjemoResultat -Categorie 'Configuration' -Controle 'Systeme et disque systeme' -Etat 'INFO' -Valeur $systeme)",
    '  $nbData = 0',
    '  if ($null -ne $m.StorageProfile -and $null -ne $m.StorageProfile.DataDisks) { $nbData = @($m.StorageProfile.DataDisks).Count }',
    "  [void](Add-KjemoResultat -Categorie 'Configuration' -Controle 'Disques de donnees' -Etat 'INFO' -Valeur ([string]$nbData))",
    '  $nbNic = 0',
    '  if ($null -ne $m.NetworkProfile -and $null -ne $m.NetworkProfile.NetworkInterfaces) { $nbNic = @($m.NetworkProfile.NetworkInterfaces).Count }',
    "  [void](Add-KjemoResultat -Categorie 'Configuration' -Controle 'Interfaces reseau' -Etat 'INFO' -Valeur ([string]$nbNic))",
    '  $bd = $false',
    '  if ($null -ne $m.DiagnosticsProfile -and $null -ne $m.DiagnosticsProfile.BootDiagnostics) { $bd = ($m.DiagnosticsProfile.BootDiagnostics.Enabled -eq $true) }',
    '  if ($bd) {',
    "    [void](Add-KjemoResultat -Categorie 'Depannage' -Controle 'Diagnostics de demarrage' -Etat 'OK' -Valeur 'actives' -Commentaire 'Capture d ecran et journal serie disponibles dans le portail en cas de machine inaccessible.')",
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Depannage' -Controle 'Diagnostics de demarrage' -Etat 'ATTENTION' -Valeur 'non actives' -Commentaire 'Sans diagnostics de demarrage, une machine qui ne repond plus est tres difficile a depanner. Les activer est une modification : a decider hors de cet assistant.')",
    '  }',
    "  $ident = 'aucune'",
    '  if ($null -ne $m.Identity -and $m.Identity.Type) { $ident = [string]$m.Identity.Type }',
    "  [void](Add-KjemoResultat -Categorie 'Configuration' -Controle 'Identite managee' -Etat 'INFO' -Valeur $ident)",
    '  $nbTags = 0',
    '  if ($null -ne $m.Tags) { $nbTags = @($m.Tags.Keys).Count }',
    "  [void](Add-KjemoResultat -Categorie 'Configuration' -Controle 'Etiquettes' -Etat 'INFO' -Valeur ([string]$nbTags))",
    '',
    "  $st = @(Invoke-KjemoLecture 'Etat' 'Etat d alimentation, agent et extensions' { Get-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -Status -ErrorAction Stop })",
    '  if ($script:KjemoLectureOk -and $st.Count -eq 1) {',
    '    $puissance = Get-KjemoPowerState $st[0]',
    "    if (-not $puissance) { $puissance = 'etat non fourni' }",
    "    $etatP = 'INFO'",
    "    $noteP = ''",
    "    if ($puissance -eq 'VM stopped') { $etatP = 'ATTENTION'; $noteP = 'ARRETEE MAIS NON DESALLOUEE : le calcul reste facture.' }",
    "    [void](Add-KjemoResultat -Categorie 'Etat' -Controle 'Alimentation' -Etat $etatP -Valeur $puissance -Commentaire $noteP)",
    '    $agent = $st[0].VMAgent',
    '    if ($null -eq $agent) {',
    "      [void](Add-KjemoResultat -Categorie 'Depannage' -Controle 'Agent invite' -Etat 'ATTENTION' -Valeur 'aucune information' -Commentaire 'Machine eteinte, agent absent ou etat non publie. Ce n est pas la preuve d un agent sain.')",
    '    } else {',
    "      $statutAgent = ''",
    '      if ($null -ne $agent.Statuses -and @($agent.Statuses).Count -gt 0) { $statutAgent = [string]@($agent.Statuses)[0].DisplayStatus }',
    "      $etatA = 'INFO'",
    "      if ($statutAgent -and $statutAgent -ne 'Ready') { $etatA = 'ATTENTION' }",
    "      [void](Add-KjemoResultat -Categorie 'Depannage' -Controle 'Agent invite' -Etat $etatA -Valeur ($statutAgent + ' (version ' + [string]$agent.VmAgentVersion + ')'))",
    '    }',
    '    foreach ($e in @($st[0].Extensions)) {',
    '      if ($null -eq $e) { continue }',
    "      $statutE = ''",
    '      if ($null -ne $e.Statuses -and @($e.Statuses).Count -gt 0) { $statutE = [string]@($e.Statuses)[0].DisplayStatus }',
    "      $etatE = 'INFO'",
    "      if ($statutE -and $statutE -notlike '*succeeded*') { $etatE = 'ATTENTION' }",
    "      [void](Add-KjemoResultat -Categorie 'Depannage' -Controle ('Extension ' + [string]$e.Name) -Etat $etatE -Valeur $statutE)",
    '    }',
    '  }',
    '',
    "  if ($null -ne (Get-Command -Name 'Get-AzActivityLog' -ErrorAction SilentlyContinue)) {",
    '    $debutJournal = (Get-Date).AddHours(-1 * [int]$KjemoArgHeures)',
    "    $evts = @(Invoke-KjemoLecture 'Journal d activite' 'Operations recentes de la machine' { Get-AzActivityLog -ResourceId $m.Id -StartTime $debutJournal -MaxRecord 20 -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk) {',
    "      [void](Add-KjemoResultat -Categorie 'Journal d activite' -Controle 'Total lu' -Etat 'INFO' -Valeur ([string]$evts.Count + ' evenement(s) sur ' + [string]$KjemoArgHeures + ' h'))",
    '      foreach ($ev in @($evts | Select-Object -First 20)) {',
    "        $op = Get-KjemoTexteLocalise $ev.OperationName",
    "        $statutEv = Get-KjemoTexteLocalise $ev.Status",
    "        $etatEv = 'INFO'",
    "        if ($statutEv -match '(?i)fail') { $etatEv = 'ATTENTION' }",
    "        [void](Add-KjemoResultat -Categorie 'Journal d activite' -Controle $op -Etat $etatEv -Valeur $statutEv -Commentaire ([string]$ev.EventTimestamp + ' par ' + [string]$ev.Caller))",
    '      }',
    '    }',
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > ta machine > Vue d’ensemble : état, taille, adresse IP, système d’exploitation.',
    'Portail Azure > ta machine > Diagnostics de démarrage : la capture d’écran et le journal série d’une machine qui ne répond plus.',
    'Portail Azure > ta machine > Extensions + applications : l’état de chaque extension (Provisioning succeeded ou failed).',
    'Portail Azure > ta machine > Journal d’activité : qui a fait quoi, et si l’opération a échoué.',
    'Portail Azure > ta machine > Aide > Resource health : l’état de santé de la plateforme pour cette machine.',
  ],
  keywords: ['vm', 'machine virtuelle', 'depannage vm', 'diagnostic vm', 'agent invite', 'vm agent', 'extension', 'boot diagnostics', 'diagnostics de demarrage', 'ne repond plus', 'journal d activite', 'get-azvm status', 'configuration vm'],
  prereqs: PREREQS_VM_LECTURE.concat(['Pour le journal d’activité : le module Az.Monitor et le droit de lire le journal (Lecteur suffit au niveau de la ressource).']),
  commonErrors: ERREURS_VM.concat([
    {
      message: 'L’agent invité n’affiche aucune information',
      cause: 'La machine est arrêtée, son agent n’est pas installé ou ne publie pas son état.',
      fix: 'Démarre la machine (assistant dédié) ou consulte les diagnostics de démarrage dans le portail. L’absence d’information n’est pas un agent en bonne santé.',
    },
    {
      message: 'Diagnostics de démarrage non activés',
      cause: 'Ils n’ont pas été activés à la création de la machine.',
      fix: 'Activer les diagnostics de démarrage modifie la machine : à décider consciemment, dans le portail, hors de cet assistant en lecture seule.',
    },
  ]),
  verifyAfter: [
    'Compare taille, région et état avec la page Vue d’ensemble de la machine dans le portail.',
    'Pour une extension « ATTENTION », ouvre-la dans le portail pour lire le message d’erreur complet.',
    'Aucune ligne n’est INACCESSIBLE ; sinon une partie du dépannage manque.',
  ],
  rollback: rollbackLecture('# L’état détaillé d’une machine\nGet-AzVM -ResourceGroupName \'rg-lab\' -Name \'vm-lab-01\' -Status'),
  checks: CHECKS_LECTURE.concat(['Aucun mot de passe d’administrateur, aucune clé et aucune donnée de profil système n’est lu ni affiché.']),
  source: doc('powershell/module/az.compute/get-azvm'),
  sources: [
    { label: 'Get-AzVM', url: doc('powershell/module/az.compute/get-azvm') },
    { label: 'Get-AzActivityLog', url: doc('powershell/module/az.monitor/get-azactivitylog') },
    { label: 'Diagnostics de démarrage', url: doc('azure/virtual-machines/boot-diagnostics') },
    { label: 'Agent invité Azure pour Windows', url: doc('azure/virtual-machines/extensions/agent-windows') },
  ],
  cloud: {
    probleme: 'Une machine ne répond plus, ou un déploiement a échoué : avant de la redémarrer au hasard, on rassemble ce qui permet de comprendre.',
    exemple: 'Une machine du laboratoire est inaccessible en bureau à distance. Le rapport montre qu’elle est démarrée, que l’agent invité est « Not Ready » et que les diagnostics de démarrage sont absents : la piste est l’agent ou le système, pas le réseau.',
    lit: ['Configuration, état d’alimentation, agent invité et extensions', 'Dernières opérations du journal d’activité pour cette machine'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur la machine ou son groupe de ressources'],
    licences: ['Aucune'],
    limites: [
      'L’état de l’agent et des extensions n’est publié que pour une machine démarrée.',
      'Les captures d’écran et le journal série ne sont pas téléchargés : ils se consultent dans le portail.',
      'Aucune commande de redémarrage, de réparation ni d’exécution à distance dans la machine n’est générée.',
    ],
  },
});

/** 10. azure-vm-disques-interfaces */
export const outilAzureVmDisques = outilAzure({
  id: 'azure-vm-disques-interfaces',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-vm-disques',
  title: 'Diagnostic des disques managés et des interfaces réseau d’une machine',
  summary: 'Dans un groupe de ressources : disques managés (taille, type, attachés ou non) et interfaces réseau (adresses privées, transfert IP, groupe de sécurité, machine rattachée). Signale les disques non attachés, qui restent facturés. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzDisk', 'Get-AzNetworkInterface'], facultatives: [] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources', default: 'rg-lab', help: 'Nom exact, sans joker.' },
    { id: 'azVm', label: 'Machine virtuelle (facultatif)', default: '', help: 'Vide = tous les disques et interfaces du groupe. Rempli = seulement ceux rattachés à cette machine.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    if (String(v.azVm ?? '').trim()) verif(errors, 'azVm', validerNomVm(v.azVm));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg).trim())],
    ['Vm', psB64(String(v.azVm ?? '').trim())],
  ],
  corps: () => [
    ...LIGNES_NOM_DEPUIS_ID,
    "$disques = @(Invoke-KjemoLecture 'Disques' 'Disques manages du groupe' { Get-AzDisk -ResourceGroupName $KjemoArgRg -ErrorAction Stop })",
    'if ($script:KjemoLectureOk) {',
    '  foreach ($d in @($disques | Sort-Object -Property Name)) {',
    '    $proprio = Get-KjemoNomDepuisId $d.ManagedBy',
    '    if ($KjemoArgVm -and -not [string]::Equals($proprio, $KjemoArgVm, [System.StringComparison]::OrdinalIgnoreCase)) { continue }',
    "    $etat = 'INFO'",
    "    $valeur = 'attache a ' + $proprio",
    "    $note = 'Taille : ' + [string]$d.DiskSizeGB + ' Go. Type : ' + [string]$d.Sku.Name + '.'",
    "    if ([string]$d.DiskState -eq 'Unattached' -or -not $proprio) {",
    "      $etat = 'ATTENTION'",
    "      $valeur = 'NON ATTACHE'",
    "      $note = $note + ' Un disque managé non attaché reste FACTURE tant qu il existe. Rien n est supprime ici : verifier a qui il appartient avant toute decision.'",
    '    }',
    "    [void](Add-KjemoResultat -Categorie 'Disques' -Controle ([string]$d.Name) -Etat $etat -Valeur $valeur -Commentaire $note)",
    '  }',
    '}',
    "$nics = @(Invoke-KjemoLecture 'Interfaces reseau' 'Interfaces du groupe' { Get-AzNetworkInterface -ResourceGroupName $KjemoArgRg -ErrorAction Stop })",
    'if ($script:KjemoLectureOk) {',
    '  foreach ($n in @($nics | Sort-Object -Property Name)) {',
    '    $proprio = Get-KjemoNomDepuisId $n.VirtualMachine',
    '    if ($KjemoArgVm -and -not [string]::Equals($proprio, $KjemoArgVm, [System.StringComparison]::OrdinalIgnoreCase)) { continue }',
    "    $etat = 'INFO'",
    "    $valeur = 'rattachee a ' + $proprio",
    "    if (-not $proprio) { $valeur = 'rattachee a aucune machine' }",
    '    $ips = @()',
    '    foreach ($c in @($n.IpConfigurations)) { if ($null -ne $c) { $ips += [string]$c.PrivateIpAddress } }',
    "    $note = 'Adresses privees : ' + ($ips -join ', ') + '.'",
    '    $nsg = Get-KjemoNomDepuisId $n.NetworkSecurityGroup',
    "    if ($nsg) { $note = $note + ' Groupe de securite : ' + $nsg + '.' } else { $note = $note + ' Aucun groupe de securite sur l interface (peut etre porte par le sous-reseau).' }",
    "    if ($n.EnableIPForwarding -eq $true) { $etat = 'ATTENTION'; $note = $note + ' TRANSFERT IP ACTIF : normal pour un routeur virtuel, a justifier sinon.' }",
    "    if (-not $proprio) { $note = $note + ' Interface orpheline : pas facturee en elle-meme, mais elle garde ses adresses.' }",
    "    [void](Add-KjemoResultat -Categorie 'Interfaces reseau' -Controle ([string]$n.Name) -Etat $etat -Valeur $valeur -Commentaire $note)",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Disques : la liste avec l’état (Attaché, Non attaché) et la taille.',
    'Portail Azure > une machine > Disques : le disque système et les disques de données rattachés.',
    'Portail Azure > Interfaces réseau : adresses IP, groupe de sécurité réseau et machine rattachée.',
    'Portail Azure > Gestion des coûts > Analyse des coûts, filtre « Type de ressource = Disques » : ce que les disques non attachés coûtent.',
  ],
  keywords: ['disque', 'disque manage', 'disque non attache', 'get-azdisk', 'interface reseau', 'nic', 'get-aznetworkinterface', 'disque orphelin', 'facturation disque', 'transfert ip', 'ip forwarding', 'disques vm'],
  prereqs: PREREQS_VM_LECTURE,
  commonErrors: ERREURS_VM.concat([
    {
      message: 'Des disques « NON ATTACHE » apparaissent alors que la machine fonctionne',
      cause: 'Un disque détaché d’une ancienne machine, une copie, ou un disque restauré et jamais rattaché.',
      fix: 'Ne supprime rien sur la seule foi de cette ligne : retrouve qui l’a créé (étiquettes, journal d’activité) et s’il sert de sauvegarde. Un disque supprimé ne revient pas.',
    },
  ]),
  verifyAfter: [
    'Compare la liste des disques avec la page Disques du portail pour le même groupe.',
    'Pour un disque « NON ATTACHE », vérifie dans le journal d’activité qui l’a détaché ou créé.',
    'Aucune ligne n’est INACCESSIBLE ; sinon la liste est incomplète.',
  ],
  rollback: rollbackLecture('# Les disques du groupe, avec leur état\nGet-AzDisk -ResourceGroupName \'rg-lab\' | Select-Object Name, DiskState, DiskSizeGB'),
  checks: CHECKS_LECTURE.concat(['Aucun disque n’est supprimé, détaché ni redimensionné ; aucune interface n’est modifiée.']),
  source: doc('powershell/module/az.compute/get-azdisk'),
  sources: [
    { label: 'Get-AzDisk', url: doc('powershell/module/az.compute/get-azdisk') },
    { label: 'Get-AzNetworkInterface', url: doc('powershell/module/az.network/get-aznetworkinterface') },
    { label: 'Comprendre la facturation des disques managés', url: doc('azure/virtual-machines/disks-understand-billing') },
  ],
  cloud: {
    probleme: 'Les disques et les interfaces réseau survivent souvent aux machines qui les utilisaient, et coûtent ou bloquent des adresses. Il faut les voir avant de décider.',
    exemple: 'Après la suppression de trois machines de laboratoire, leurs disques de données sont restés. Ils sont non attachés mais facturés. L’assistant les liste, sans rien supprimer.',
    lit: ['Les disques managés du groupe (taille, type, état, machine rattachée)', 'Les interfaces réseau du groupe (adresses privées, transfert IP, groupe de sécurité)'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur le groupe de ressources'],
    licences: ['Aucune'],
    limites: [
      'Les disques non managés (fichiers VHD dans un compte de stockage) ne sont pas couverts.',
      'Les adresses IP publiques sont vues par l’assistant réseau, pas ici.',
      'Un disque « non attaché » n’est pas forcément inutile : il peut servir de sauvegarde ou de modèle.',
    ],
  },
});

// ===========================================================================
// Actions
// ===========================================================================

const LIGNES_RELECTURE_ETAT = [
  "$apres = @(Invoke-KjemoLecture 'Verification' 'Etat apres l operation' { Get-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -Status -ErrorAction Stop })",
  'if ($script:KjemoLectureOk -and $apres.Count -eq 1) {',
  '  $etatApres = Get-KjemoPowerState $apres[0]',
  "  if (-not $etatApres) { $etatApres = 'etat non fourni' }",
  "  [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Etat relu apres l operation' -Etat 'INFO' -Valeur $etatApres -Commentaire 'Aucune reussite n est annoncee avant cette relecture. Un etat transitoire (starting, deallocating) peut etre affiche : relance la lecture dans quelques instants.')",
  '}',
];

/** 11. azure-vm-demarrage */
export const outilAzureVmDemarrage = outilAzure({
  id: 'azure-vm-demarrage',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-vm-demarrage',
  title: 'Démarrer une machine virtuelle Azure (prévisualisation, puis action confirmée)',
  summary: 'Démarre UNE machine précise. Par défaut, le script exécute Start-AzVM avec -WhatIf (prévisualisation réelle) et ne démarre rien. Pour agir : mode « Appliquer » et phrase de confirmation exacte. Relit l’état après l’opération.',
  portee: 'az',
  action: true,
  risk: 'caution',
  commandes: { obligatoires: ['Get-AzVM', 'Start-AzVM'], facultatives: [] },
  phrase: (v) => `DEMARRER ${String(v.azVm ?? '').trim()}`,
  phraseAide: 'DEMARRER suivi d’un espace et du nom de la machine, par exemple : DEMARRER vm-lab-01',
  champs: [
    { id: 'azRg', label: 'Groupe de ressources', default: 'rg-lab', help: 'Nom exact, sans joker.' },
    { id: 'azVm', label: 'Machine virtuelle', default: 'vm-lab-01', help: 'Nom exact d’UNE machine, sans joker.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azVm', validerNomVm(v.azVm));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg).trim())],
    ['Vm', psB64(String(v.azVm).trim())],
  ],
  corps: () => [
    ...LIGNES_AIDES_AZ,
    "$cible = @(Invoke-KjemoLecture 'Cible' 'Existence et etat de la machine' { Get-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -Status -ErrorAction Stop })",
    'if ($script:KjemoLectureOk -and $cible.Count -ne 1) {',
    "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Cible' -Etat 'PROBLEME' -Valeur ([string]$cible.Count + ' machine(s) retournee(s)') -Commentaire 'Cible ambigue ou absente : AUCUNE action. Exactement UNE machine est attendue.')",
    '} elseif ($script:KjemoLectureOk) {',
    '  $avant = Get-KjemoPowerState $cible[0]',
    "  if (-not $avant) { $avant = 'etat non fourni' }",
    "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle ([string]$KjemoArgVm) -Etat 'INFO' -Valeur $avant -Commentaire 'Etat avant l operation.')",
    "  $phrase = 'DEMARRER ' + $KjemoArgVm",
    "  $agir = ($KjemoMode -eq 'Appliquer' -and $KjemoConfirmation -ceq $phrase)",
    "  if ($avant -eq 'VM running') {",
    "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Demarrage' -Etat 'INFO' -Valeur 'deja en cours d execution' -Commentaire 'Rien a faire : aucune commande de demarrage n est lancee.')",
    '  } elseif ($agir) {',
    "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Demarrage' -Etat 'INFO' -Valeur 'demarrage demande' -Commentaire 'Mode Appliquer et confirmation exacte. Le calcul est FACTURE des que la machine demarre.')",
    "    $res = @(Invoke-KjemoLecture 'Action' 'Start-AzVM' { Start-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -ErrorAction Stop })",
    '    if ($script:KjemoLectureOk) {',
    '      $statutOp = \'\'',
    '      if ($res.Count -gt 0 -and $null -ne $res[0].Status) { $statutOp = [string]$res[0].Status }',
    "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Reponse de l operation' -Etat 'INFO' -Valeur $statutOp -Commentaire 'Reponse brute de la commande : la verification se fait par la relecture de l etat.')",
    '    }',
    ...LIGNES_RELECTURE_ETAT.map((l) => `    ${l}`),
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Previsualisation' -Etat 'INFO' -Valeur 'Start-AzVM -WhatIf execute, RIEN demarre' -Commentaire 'Pour demarrer : regenere le script en mode Appliquer avec la phrase de confirmation exacte.')",
    "    [void](Invoke-KjemoLecture 'Action' 'Start-AzVM -WhatIf' { Start-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -WhatIf -ErrorAction Stop })",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > ta machine > Vue d’ensemble > Démarrer : la même action, avec l’état affiché en direct.',
    'Portail Azure > ta machine > Journal d’activité : l’opération « Start Virtual Machine » et son résultat.',
    'Portail Azure > ta machine > Vue d’ensemble : l’état doit passer à « En cours d’exécution ».',
    'Cloud Shell > Start-AzVM -ResourceGroupName <groupe> -Name <machine> -WhatIf : la prévisualisation depuis un terminal.',
  ],
  keywords: ['demarrer vm', 'start vm', 'start-azvm', 'allumer machine virtuelle', 'demarrage vm azure', 'whatif', 'previsualisation', 'vm arretee', 'vm desallouee', 'laboratoire'],
  prereqs: PREREQS_VM_ACTION,
  commonErrors: ERREURS_VM.concat([
    {
      message: 'AllocationFailed / ZonalAllocationFailed au démarrage',
      cause: 'Une machine désallouée doit retrouver du matériel ; la région ou la zone peut manquer de capacité pour cette taille.',
      fix: 'Réessaie plus tard ou change de taille (opération distincte, hors de cet assistant). Le script ne change ni la taille ni la région.',
    },
    {
      message: 'La confirmation est refusée',
      cause: 'La phrase doit être exactement DEMARRER suivi du nom de la machine, majuscules comprises.',
      fix: 'Recopie-la telle qu’affichée dans le formulaire, ou laisse le champ vide pour une prévisualisation.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'La ligne « Etat relu apres l operation » indique VM running (ou starting si tu relis trop tôt).',
    'Le portail affiche « En cours d’exécution » et le journal d’activité contient l’opération de démarrage.',
    'Rappelle-toi que le calcul est facturé dès maintenant : prévois l’arrêt avec désallocation.',
  ],
  rollback: {
    summary: 'Le retour arrière d’un démarrage est un arrêt avec désallocation : il arrête la facturation du calcul. Les disques et IP statiques restent facturés.',
    diagnostic: '# L’état actuel de la machine\nGet-AzVM -ResourceGroupName \'rg-lab\' -Name \'vm-lab-01\' -Status | Select-Object -ExpandProperty Statuses',
    command: '# Retour arriere : arreter ET desallouer (a lancer seulement si tu veux eteindre la machine)\nStop-AzVM -ResourceGroupName \'rg-lab\' -Name \'vm-lab-01\' -WhatIf\n# Retire -WhatIf pour l executer pour de bon, apres avoir verifie le nom.',
    warning: 'Éteindre une machine de production interrompt ses services et ses sessions. Vérifie qui l’utilise avant de l’arrêter.',
  },
  checks: [
    'Aucune connexion, aucun changement d’abonnement : le script lit le contexte et le compare.',
    'Le mode par défaut exécute Start-AzVM avec -WhatIf : aucune machine n’est démarrée.',
    'Le démarrage réel exige le mode Appliquer ET la phrase exacte « DEMARRER » + nom de la machine.',
    'Une cible ambiguë (zéro ou plusieurs machines) est refusée : aucune action.',
    'L’état est relu après l’opération et aucune réussite n’est annoncée avant cette relecture.',
    'Aucun secret demandé, lu ni écrit.',
  ],
  source: doc('powershell/module/az.compute/start-azvm'),
  sources: [
    { label: 'Start-AzVM', url: doc('powershell/module/az.compute/start-azvm') },
    { label: 'Get-AzVM', url: doc('powershell/module/az.compute/get-azvm') },
    SRC_FACTURATION_VM,
  ],
  cloud: {
    probleme: 'Démarrer une machine de laboratoire en étant certain de la bonne machine, du bon abonnement, et de ce que cela va coûter.',
    exemple: 'Avant le cours, l’enseignant démarre « vm-lab-01 » dans « rg-lab ». Le script vérifie l’abonnement, montre la prévisualisation, puis ne démarre qu’après la phrase de confirmation.',
    lit: ['L’existence et l’état d’alimentation de la machine cible'],
    ecrit: ['Mode Diagnostic : rien (prévisualisation -WhatIf)', 'Mode Appliquer avec confirmation : démarre UNE machine'],
    facture: ['Le calcul de la machine est facturé dès qu’elle démarre, selon sa taille', 'Les disques et IP statiques sont facturés dans tous les cas'],
    permissions: ['Action Microsoft.Compute/virtualMachines/start/action sur la machine, par exemple « Contributeur de machine virtuelle »'],
    licences: ['Aucune'],
    limites: [
      'Une seule machine à la fois ; aucun joker, aucun lot.',
      'Ne change ni la taille, ni la région, ni les disques.',
      '-WhatIf est pris en charge par Start-AzVM : c’est une vraie prévisualisation, mais elle ne garantit pas que l’allocation de matériel réussira ensuite.',
    ],
  },
});

/** 12. azure-vm-arret */
export const outilAzureVmArret = outilAzure({
  id: 'azure-vm-arret',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-vm-arret',
  title: 'Arrêter et désallouer une machine virtuelle Azure (prévisualisation, puis action confirmée)',
  summary: 'Arrête UNE machine précise, avec désallocation par défaut (arrête la facturation du calcul). Par défaut, le script exécute Stop-AzVM avec -WhatIf et n’arrête rien. Explique la différence entre arrêtée et désallouée. Relit l’état après l’opération.',
  portee: 'az',
  action: true,
  risk: 'caution',
  commandes: { obligatoires: ['Get-AzVM', 'Stop-AzVM'], facultatives: [] },
  phrase: (v) => `ARRETER ${String(v.azVm ?? '').trim()}`,
  phraseAide: 'ARRETER suivi d’un espace et du nom de la machine, par exemple : ARRETER vm-lab-01',
  champs: [
    { id: 'azRg', label: 'Groupe de ressources', default: 'rg-lab', help: 'Nom exact, sans joker.' },
    { id: 'azVm', label: 'Machine virtuelle', default: 'vm-lab-01', help: 'Nom exact d’UNE machine, sans joker.' },
    {
      id: 'azArret', label: 'Type d’arrêt', type: 'select', default: 'Desallouer',
      options: [
        ['Desallouer', 'Arrêter et DÉSALLOUER — le calcul n’est plus facturé (recommandé en laboratoire)'],
        ['SansDesallocation', 'Arrêter SANS désallouer — le calcul reste facturé, l’IP dynamique est conservée'],
      ],
      help: 'Désallouer rend le matériel : l’IP publique dynamique peut changer au prochain démarrage et le disque temporaire est perdu.',
    },
  ],
  verifier(v, errors) {
    verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azVm', validerNomVm(v.azVm));
    verif(errors, 'azArret', validerChoixAzure(v.azArret, ['Desallouer', 'SansDesallocation'], 'Le type d’arrêt'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg).trim())],
    ['Vm', psB64(String(v.azVm).trim())],
    ['Arret', psB64(v.azArret)],
  ],
  corps: () => [
    ...LIGNES_AIDES_AZ,
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Arretee n est pas desallouee' -Etat 'INFO' -Valeur 'VM stopped = encore facturee ; VM deallocated = calcul non facture' -Commentaire 'Eteindre depuis le systeme d exploitation laisse la machine arretee ET facturee. Disques, IP statiques et sauvegardes restent factures dans les deux cas.')",
    "$cible = @(Invoke-KjemoLecture 'Cible' 'Existence et etat de la machine' { Get-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -Status -ErrorAction Stop })",
    'if ($script:KjemoLectureOk -and $cible.Count -ne 1) {',
    "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Cible' -Etat 'PROBLEME' -Valeur ([string]$cible.Count + ' machine(s) retournee(s)') -Commentaire 'Cible ambigue ou absente : AUCUNE action. Exactement UNE machine est attendue.')",
    '} elseif ($script:KjemoLectureOk) {',
    '  $avant = Get-KjemoPowerState $cible[0]',
    "  if (-not $avant) { $avant = 'etat non fourni' }",
    "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle ([string]$KjemoArgVm) -Etat 'INFO' -Valeur $avant -Commentaire 'Etat avant l operation.')",
    "  $phrase = 'ARRETER ' + $KjemoArgVm",
    "  $agir = ($KjemoMode -eq 'Appliquer' -and $KjemoConfirmation -ceq $phrase)",
    "  $garder = ($KjemoArgArret -eq 'SansDesallocation')",
    "  if ($avant -eq 'VM deallocated') {",
    "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Arret' -Etat 'INFO' -Valeur 'deja desallouee' -Commentaire 'Rien a faire : aucune commande d arret n est lancee.')",
    '  } elseif ($agir) {',
    "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Arret' -Etat 'ATTENTION' -Valeur 'arret demande' -Commentaire 'Mode Appliquer et confirmation exacte. Les services et sessions de la machine seront interrompus.')",
    '    if ($garder) {',
    "      [void](Invoke-KjemoLecture 'Action' 'Stop-AzVM -StayProvisioned' { Stop-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -StayProvisioned -ErrorAction Stop })",
    '    } else {',
    "      [void](Invoke-KjemoLecture 'Action' 'Stop-AzVM' { Stop-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -ErrorAction Stop })",
    '    }',
    ...LIGNES_RELECTURE_ETAT.map((l) => `    ${l}`),
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Previsualisation' -Etat 'INFO' -Valeur 'Stop-AzVM -WhatIf execute, RIEN arrete' -Commentaire 'Pour arreter : regenere le script en mode Appliquer avec la phrase de confirmation exacte.')",
    '    if ($garder) {',
    "      [void](Invoke-KjemoLecture 'Action' 'Stop-AzVM -StayProvisioned -WhatIf' { Stop-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -StayProvisioned -WhatIf -ErrorAction Stop })",
    '    } else {',
    "      [void](Invoke-KjemoLecture 'Action' 'Stop-AzVM -WhatIf' { Stop-AzVM -ResourceGroupName $KjemoArgRg -Name $KjemoArgVm -WhatIf -ErrorAction Stop })",
    '    }',
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > ta machine > Vue d’ensemble > Arrêter : le portail désalloue par défaut et affiche « Arrêtée (désallouée) ».',
    'Portail Azure > ta machine > Vue d’ensemble : après l’opération, l’état doit être « Arrêtée (désallouée) », pas seulement « Arrêtée ».',
    'Portail Azure > Gestion des coûts > Analyse des coûts : confirme dans les jours suivants que le coût de calcul de la machine s’arrête.',
    'Cloud Shell > Stop-AzVM -ResourceGroupName <groupe> -Name <machine> -WhatIf : la prévisualisation depuis un terminal.',
  ],
  keywords: ['arreter vm', 'stop vm', 'stop-azvm', 'desallouer', 'deallocate', 'eteindre machine virtuelle', 'arretee desallouee', 'facturation vm', 'economiser azure', 'whatif', 'previsualisation', 'laboratoire', 'stayprovisioned'],
  prereqs: PREREQS_VM_ACTION,
  commonErrors: ERREURS_VM.concat([
    {
      message: 'La machine est « Arrêtée » mais la facture continue',
      cause: 'Elle a été éteinte depuis le système d’exploitation ou arrêtée sans désallocation : le calcul reste facturé.',
      fix: 'Relance cet assistant avec « Arrêter et DÉSALLOUER » : l’état doit devenir « Arrêtée (désallouée) ».',
    },
    {
      message: 'Une question « Voulez-vous continuer ? » apparaît en mode Appliquer',
      cause: 'C’est l’invite propre à Stop-AzVM. Le script n’utilise volontairement pas -Force : il y a donc une deuxième confirmation, après la phrase exacte.',
      fix: 'Réponds Oui (O ou Y) seulement si la machine affichée est bien la bonne ; sinon réponds Non.',
    },
    {
      message: 'L’adresse IP publique a changé après le redémarrage',
      cause: 'Une IP publique dynamique est libérée à la désallocation.',
      fix: 'Utilise un nom DNS ou une IP statique si l’adresse doit rester stable (modification distincte, qui a un coût, hors de cet assistant).',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'La ligne « Etat relu apres l operation » indique VM deallocated (ou VM stopped si tu as choisi sans désallocation).',
    'Le portail affiche « Arrêtée (désallouée) » : c’est l’état où le calcul n’est plus facturé.',
    'Le journal d’activité contient l’opération d’arrêt, avec ton compte comme initiateur.',
  ],
  rollback: {
    summary: 'Le retour arrière d’un arrêt est un démarrage. Une machine désallouée retrouve du matériel (pas toujours la même adresse IP publique dynamique), et le disque temporaire est vide.',
    diagnostic: '# L’état actuel de la machine\nGet-AzVM -ResourceGroupName \'rg-lab\' -Name \'vm-lab-01\' -Status | Select-Object -ExpandProperty Statuses',
    command: '# Retour arriere : redemarrer la machine\nStart-AzVM -ResourceGroupName \'rg-lab\' -Name \'vm-lab-01\' -WhatIf\n# Retire -WhatIf pour l executer pour de bon, apres avoir verifie le nom.',
    warning: 'Les données du disque temporaire (D: sous Windows, /mnt sous Linux) sont perdues à la désallocation. Les disques managés, eux, sont conservés.',
  },
  checks: [
    'Aucune connexion, aucun changement d’abonnement : le script lit le contexte et le compare.',
    'Le mode par défaut exécute Stop-AzVM avec -WhatIf : aucune machine n’est arrêtée.',
    'L’arrêt réel exige le mode Appliquer ET la phrase exacte « ARRETER » + nom de la machine.',
    'Une cible ambiguë (zéro ou plusieurs machines) est refusée : aucune action.',
    'La désallocation est le comportement par défaut ; l’arrêt sans désallocation est un choix explicite et annoncé comme encore facturé.',
    'L’état est relu après l’opération et aucune réussite n’est annoncée avant cette relecture.',
    'Aucun secret demandé, lu ni écrit.',
  ],
  source: doc('powershell/module/az.compute/stop-azvm'),
  sources: [
    { label: 'Stop-AzVM', url: doc('powershell/module/az.compute/stop-azvm') },
    { label: 'Get-AzVM', url: doc('powershell/module/az.compute/get-azvm') },
    SRC_FACTURATION_VM,
  ],
  cloud: {
    probleme: 'Éteindre une machine de laboratoire sans continuer à la payer. « Arrêtée » et « désallouée » ne sont pas la même chose, et la différence se voit sur la facture.',
    exemple: 'À la fin du cours, un étudiant éteint la machine depuis Windows. Elle reste facturée tout le week-end. Avec cet assistant, la machine est désallouée et l’état relu confirme que le calcul ne coûte plus.',
    lit: ['L’existence et l’état d’alimentation de la machine cible'],
    ecrit: ['Mode Diagnostic : rien (prévisualisation -WhatIf)', 'Mode Appliquer avec confirmation : arrête (et désalloue) UNE machine'],
    facture: ['Désallouée : le calcul n’est plus facturé ; disques, IP statiques et sauvegardes continuent de l’être', 'Arrêtée sans désallocation : le calcul reste facturé'],
    permissions: ['Action Microsoft.Compute/virtualMachines/deallocate/action (ou powerOff/action) sur la machine, par exemple « Contributeur de machine virtuelle »'],
    licences: ['Aucune'],
    limites: [
      'Une seule machine à la fois ; aucun joker, aucun lot.',
      'Un arrêt interrompt les services et les sessions de la machine : il n’attend pas que les utilisateurs aient fini.',
      'Le script ne supprime ni machine ni disque, et ne libère aucune IP statique.',
    ],
  },
});

export const toolsAzureVm = [
  outilAzureVmInventaire,
  outilAzureVmEtat,
  outilAzureVmDisques,
  outilAzureVmDemarrage,
  outilAzureVmArret,
];
