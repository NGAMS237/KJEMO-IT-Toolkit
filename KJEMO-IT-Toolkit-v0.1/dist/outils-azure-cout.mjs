/**
 * outils-azure-cout.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Famille F : surveillance et coûts. Quatre assistants en LECTURE SEULE :
 * journal d'activité, alertes et diagnostics, budgets, ressources de
 * laboratoire potentiellement inutilisées.
 *
 * Trois règles de cette famille, vérifiées par le banc :
 *  1. Un budget Azure est une ALERTE, pas un plafond : il n'arrête rien et ne
 *     bloque aucune dépense. Aucune commande de création de budget n'est générée.
 *  2. Absence d'alerte lue ≠ supervision en place, et absence de budget lu ≠
 *     absence de budget (la commande ne couvre pas tous les types d'offre).
 *  3. Le nettoyage commence par un INVENTAIRE explicite. Aucune commande de
 *     suppression n'est générée : un candidat n'est jamais supprimé sur le seul
 *     constat du rapport.
 */

import { psB64 } from './noyau.mjs';
import {
  outilAzure,
  rollbackLecture,
  CHECKS_LECTURE,
  LIGNES_AIDES_AZ,
  LIGNES_NOM_DEPUIS_ID,
} from './noyau-azure.mjs';
import { validerGroupeRessources, validerBorne, validerChoixAzure } from './validateurs-azure.mjs';

const FAMILLE = 'Surveillance et coûts';
const doc = (chemin) => `https://learn.microsoft.com/${chemin}`;
const verif = (errors, champ, r) => { if (!r.ok) errors[champ] = r.error; return r; };

const PREREQ_MONITOR = 'Module Az.Monitor (journal, alertes, diagnostics). Rôle Lecteur (Reader) ou Lecteur de surveillance (Monitoring Reader).';

// ===========================================================================
// 21. azure-journal-activite
// ===========================================================================
export const outilAzureJournalActivite = outilAzure({
  id: 'azure-journal-activite',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-journal-activite',
  title: 'Journal d’activité : qui a fait quoi, et ce qui a échoué',
  summary: 'Lit le journal d’activité Azure (opérations de gestion) sur une période courte : opération, statut, appelant, ressource. Met les échecs en évidence. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzActivityLog'], facultatives: [] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources (facultatif)', default: '', help: 'Vide = tout l’abonnement. Nom exact, sans joker.' },
    { id: 'azHeures', label: 'Période (heures en arrière)', type: 'number', default: '24', min: 1, max: 168, help: 'Entre 1 et 168 (7 jours). Le journal conserve 90 jours au maximum.' },
    {
      id: 'azStatut', label: 'Statut', type: 'select', default: 'Tous',
      options: [['Tous', 'Tous les statuts'], ['Failed', 'Échecs seulement'], ['Succeeded', 'Réussites seulement']],
      help: 'Les échecs sont mis en évidence dans tous les cas.',
    },
    { id: 'azLimite', label: 'Nombre maximal d’événements', type: 'number', default: '100', min: 1, max: 500, help: 'Entre 1 et 500.' },
  ],
  verifier(v, errors) {
    if (String(v.azRg ?? '').trim()) verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azHeures', validerBorne(v.azHeures, 1, 168, 'La période'));
    verif(errors, 'azStatut', validerChoixAzure(v.azStatut, ['Tous', 'Failed', 'Succeeded'], 'Le statut'));
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 500, 'Le nombre maximal'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg ?? '').trim())],
    ['Heures', psB64(String(validerBorne(v.azHeures, 1, 168).value))],
    ['Statut', psB64(String(v.azStatut).trim())],
    ['Limite', psB64(String(validerBorne(v.azLimite, 1, 500).value))],
  ],
  corps: () => [
    ...LIGNES_NOM_DEPUIS_ID,
    ...LIGNES_AIDES_AZ,
    '$debutJournal = (Get-Date).AddHours(-[int]$KjemoArgHeures)',
    "$evts = @(Invoke-KjemoLecture 'Journal d activite' 'Evenements de la periode' {",
    '  $p = @{ StartTime = $debutJournal; MaxRecord = [int]$KjemoArgLimite; ErrorAction = \'Stop\' }',
    '  if ($KjemoArgRg) { $p[\'ResourceGroupName\'] = $KjemoArgRg }',
    "  if ($KjemoArgStatut -ne 'Tous') { $p['Status'] = $KjemoArgStatut }",
    '  Get-AzActivityLog @p',
    '})',
    'if ($script:KjemoLectureOk) {',
    "  [void](Add-KjemoResultat -Categorie 'Journal d activite' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$evts.Count + ' evenement(s) sur ' + [string]$KjemoArgHeures + ' h') -Commentaire 'Le journal couvre les operations de GESTION (creer, modifier, demarrer...), pas ce qui se passe a l interieur d une machine.')",
    '  $nbEchecs = 0',
    '  foreach ($e in @($evts | Sort-Object -Property EventTimestamp -Descending)) {',
    '    $statut = Get-KjemoTexteLocalise $e.Status',
    '    $op = Get-KjemoTexteLocalise $e.OperationName',
    '    $nom = Get-KjemoNomDepuisId $e.ResourceId',
    "    $etat = 'INFO'",
    "    if ($statut -eq 'Failed') { $etat = 'ATTENTION'; $nbEchecs++ }",
    "    $quand = ''",
    "    if ($null -ne $e.EventTimestamp) { $quand = ([datetime]$e.EventTimestamp).ToString('s') }",
    "    [void](Add-KjemoResultat -Categorie 'Journal d activite' -Controle ($quand + ' ' + $nom) -Etat $etat -Valeur ($op + ' : ' + $statut) -Commentaire ('Appelant : ' + [string]$e.Caller))",
    '  }',
    '  if ($nbEchecs -gt 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Journal d activite' -Controle 'Echecs' -Etat 'ATTENTION' -Valeur ([string]$nbEchecs + ' echec(s)') -Commentaire 'Un echec d autorisation (AuthorizationFailed) pointe vers les roles ; un echec de politique (RequestDisallowedByPolicy) vers Azure Policy.')",
    '  }',
    '  if ($evts.Count -ge [int]$KjemoArgLimite) {',
    "    [void](Add-KjemoResultat -Categorie 'Journal d activite' -Controle 'Limite atteinte' -Etat 'ATTENTION' -Valeur 'resultat peut-etre tronque' -Commentaire 'La limite d evenements est atteinte : reduis la periode, filtre par groupe ou par statut.')",
    '  }',
    '}',
  ],
  gui: [
    'Portail Azure > Surveiller > Journal d’activité : filtres sur la période, le groupe de ressources, le niveau d’événement.',
    'Ouvre un événement > onglet JSON : le détail complet de l’erreur et de l’appelant.',
    'Sur une ressource > Journal d’activité : seulement les opérations de cette ressource.',
  ],
  keywords: ['journal', 'journal d activite', 'activity log', 'get-azactivitylog', 'qui a supprime', 'qui a modifie', 'audit azure', 'operation echouee', 'authorizationfailed', 'historique azure'],
  prereqs: [PREREQ_MONITOR],
  commonErrors: [
    { message: 'Aucun événement alors qu’une opération a eu lieu', cause: 'Période trop courte, mauvais groupe de ressources, ou événement pas encore propagé (quelques minutes de retard possibles).', fix: 'Élargis la période ou retire le filtre de groupe.' },
    { message: 'AuthorizationFailed pour l’appelant d’une opération', cause: 'Le compte n’a pas le rôle nécessaire à cet endroit.', fix: 'Lis les attributions avec l’assistant RBAC avant de proposer un rôle.' },
  ],
  verifyAfter: [
    'Retrouve dans le portail (Journal d’activité) un événement du rapport : même heure, même appelant.',
    'Une ligne INACCESSIBLE signifie que le journal n’a pas été lu : ne conclus rien.',
  ],
  rollback: rollbackLecture('# Les 10 derniers événements d’un groupe\nGet-AzActivityLog -ResourceGroupName \'rg-lab\' -StartTime (Get-Date).AddHours(-24) -MaxRecord 10'),
  checks: CHECKS_LECTURE,
  source: doc('powershell/module/az.monitor/get-azactivitylog'),
  sources: [
    { label: 'Get-AzActivityLog', url: doc('powershell/module/az.monitor/get-azactivitylog') },
    { label: 'Journal d’activité Azure', url: doc('azure/azure-monitor/essentials/activity-log') },
  ],
  cloud: {
    probleme: 'Quand « quelque chose a changé » ou « ça ne marche plus depuis ce matin », le journal d’activité dit qui a lancé quelle opération de gestion, et si elle a réussi.',
    exemple: 'Une machine de labo est arrêtée depuis hier soir. Le journal montre une opération d’arrêt lancée par un collègue à 22 h 14, réussie.',
    lit: ['Les événements du journal d’activité de l’abonnement sur la période choisie'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : le journal d’activité est gratuit à la lecture'],
    permissions: ['Lecteur (Reader) sur l’abonnement ou le groupe de ressources'],
    licences: ['Aucune'],
    limites: [
      'Opérations de gestion seulement : rien sur le contenu d’une machine ni sur l’accès aux données.',
      'Conservation de 90 jours ; au-delà, il faut avoir exporté le journal vers un espace de travail Log Analytics.',
      'Un rapport sans échec ne prouve pas qu’il ne s’est rien passé hors de la période ou du filtre.',
    ],
  },
});

// ===========================================================================
// 22. azure-alertes-diagnostics
// ===========================================================================
export const outilAzureAlertesDiagnostics = outilAzure({
  id: 'azure-alertes-diagnostics',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-alertes-diagnostics',
  title: 'Alertes et paramètres de diagnostic : ce qui est surveillé',
  summary: 'Inventorie les règles d’alerte (métriques, journal d’activité), les groupes d’actions et les paramètres de diagnostic de l’abonnement. Signale les alertes désactivées ou sans groupe d’actions. Une absence n’est jamais présentée comme une supervision en place. Lecture seule.',
  portee: 'az',
  commandes: {
    obligatoires: ['Get-AzMetricAlertRuleV2'],
    facultatives: ['Get-AzActivityLogAlert', 'Get-AzActionGroup', 'Get-AzSubscriptionDiagnosticSetting'],
  },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources (facultatif)', default: '', help: 'Vide = tout l’abonnement. Nom exact, sans joker. Ne s’applique pas aux paramètres de diagnostic de l’abonnement.' },
  ],
  verifier(v, errors) {
    if (String(v.azRg ?? '').trim()) verif(errors, 'azRg', validerGroupeRessources(v.azRg));
  },
  parametres: (v) => [['Rg', psB64(String(v.azRg ?? '').trim())]],
  corps: () => [
    "$metriques = @(Invoke-KjemoLecture 'Alertes de metriques' 'Regles d alerte de metriques' {",
    '  if ($KjemoArgRg) { Get-AzMetricAlertRuleV2 -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzMetricAlertRuleV2 -ErrorAction Stop }',
    '})',
    '$nbAlertesLues = 0',
    'if ($script:KjemoLectureOk) {',
    '  $nbAlertesLues += $metriques.Count',
    "  [void](Add-KjemoResultat -Categorie 'Alertes de metriques' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$metriques.Count + ' regle(s)'))",
    '  foreach ($a in @($metriques | Sort-Object -Property Name)) {',
    "    $etat = 'INFO'; $constats = @()",
    "    if ($a.Enabled -eq $false) { $etat = 'ATTENTION'; $constats += 'regle DESACTIVEE' }",
    '    if (@($a.Actions).Count -eq 0) { $etat = \'ATTENTION\'; $constats += \'aucun groupe d actions : l alerte se declenche mais ne previent personne\' }',
    "    [void](Add-KjemoResultat -Categorie 'Alertes de metriques' -Controle ([string]$a.Name) -Etat $etat -Valeur ('gravite ' + [string]$a.Severity) -Commentaire ($constats -join ' ; '))",
    '  }',
    '}',
    "if ($null -ne (Get-Command -Name 'Get-AzActivityLogAlert' -ErrorAction SilentlyContinue)) {",
    "  $journal = @(Invoke-KjemoLecture 'Alertes du journal' 'Regles d alerte du journal d activite' {",
    '    if ($KjemoArgRg) { Get-AzActivityLogAlert -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzActivityLogAlert -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    '    $nbAlertesLues += $journal.Count',
    "    [void](Add-KjemoResultat -Categorie 'Alertes du journal' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$journal.Count + ' regle(s)'))",
    '    foreach ($a in @($journal | Sort-Object -Property Name)) {',
    "      $etat = 'INFO'; $constats = @()",
    "      if ($a.Enabled -eq $false) { $etat = 'ATTENTION'; $constats += 'regle DESACTIVEE' }",
    "      [void](Add-KjemoResultat -Categorie 'Alertes du journal' -Controle ([string]$a.Name) -Etat $etat -Valeur 'regle lue' -Commentaire ($constats -join ' ; '))",
    '    }',
    '  }',
    '}',
    "if ($null -ne (Get-Command -Name 'Get-AzActionGroup' -ErrorAction SilentlyContinue)) {",
    "  $groupes = @(Invoke-KjemoLecture 'Groupes d actions' 'Groupes d actions' {",
    '    if ($KjemoArgRg) { Get-AzActionGroup -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzActionGroup -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    "    [void](Add-KjemoResultat -Categorie 'Groupes d actions' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$groupes.Count + ' groupe(s)') -Commentaire 'Un groupe d actions existe : cela ne prouve pas que ses destinataires lisent les messages.')",
    '    foreach ($g in @($groupes | Sort-Object -Property Name)) {',
    "      [void](Add-KjemoResultat -Categorie 'Groupes d actions' -Controle ([string]$g.Name) -Etat 'INFO' -Valeur ('courriels : ' + [string]@($g.EmailReceiver).Count) -Commentaire '')",
    '    }',
    '  }',
    '}',
    "if ($null -ne (Get-Command -Name 'Get-AzSubscriptionDiagnosticSetting' -ErrorAction SilentlyContinue)) {",
    "  $diag = @(Invoke-KjemoLecture 'Diagnostics' 'Parametres de diagnostic de l abonnement' { Get-AzSubscriptionDiagnosticSetting -ErrorAction Stop })",
    '  if ($script:KjemoLectureOk) {',
    '    if ($diag.Count -eq 0) {',
    "      [void](Add-KjemoResultat -Categorie 'Diagnostics' -Controle 'Journal d activite de l abonnement' -Etat 'ATTENTION' -Valeur 'aucun parametre lu' -Commentaire 'Le journal d activite n est pas exporte : il disparait apres 90 jours. Peut aussi signifier un droit insuffisant.')",
    '    } else {',
    '      foreach ($d in @($diag | Sort-Object -Property Name)) {',
    "        $dest = @(); if ($d.WorkspaceId) { $dest += 'espace Log Analytics' }; if ($d.StorageAccountId) { $dest += 'compte de stockage' }; if ($d.EventHubAuthorizationRuleId) { $dest += 'Event Hub' }",
    "        [void](Add-KjemoResultat -Categorie 'Diagnostics' -Controle ([string]$d.Name) -Etat 'INFO' -Valeur $(if ($dest.Count -gt 0) { $dest -join ' + ' } else { 'destination non fournie' }) -Commentaire '')",
    '      }',
    '    }',
    '  }',
    '}',
    "if ($script:KjemoLectureOk -and $nbAlertesLues -eq 0) {",
    "  [void](Add-KjemoResultat -Categorie 'Conclusion prudente' -Controle 'Aucune alerte lue' -Etat 'ATTENTION' -Valeur 'aucune regle d alerte trouvee' -Commentaire 'Soit rien n est configure, soit ce compte ne voit pas les regles. Dans les deux cas, ne conclus PAS que tout va bien : aucune supervision n est prouvee.')",
    '}',
    "[void](Add-KjemoResultat -Categorie 'Limites' -Controle 'Ce que ce rapport ne dit pas' -Etat 'INFO' -Valeur 'inventaire de configuration' -Commentaire 'Une alerte configuree ne prouve pas qu elle se declenche au bon seuil ni qu une personne repond. Les parametres de diagnostic PAR RESSOURCE ne sont pas lus ici (portail > ressource > Parametres de diagnostic).')",
  ],
  gui: [
    'Portail Azure > Surveiller > Alertes > Règles d’alerte : état (activée/désactivée), gravité, ressource ciblée.',
    'Surveiller > Alertes > Gérer les actions : les groupes d’actions et leurs destinataires.',
    'Surveiller > Paramètres de diagnostic > Journal d’activité : où le journal est exporté.',
    'Sur une ressource > Paramètres de diagnostic : les journaux et métriques qu’elle envoie.',
  ],
  keywords: ['alerte', 'alertes', 'supervision', 'surveillance', 'monitor', 'diagnostic', 'parametres de diagnostic', 'groupe d actions', 'action group', 'log analytics', 'get-azmetricalertrulev2', 'azure monitor'],
  prereqs: [PREREQ_MONITOR],
  commonErrors: [
    { message: 'Une commande facultative est « absente »', cause: 'Le module Az.Monitor installé est ancien ou incomplet.', fix: 'Mets à jour le module dans ton terminal ; le rapport signale ce qu’il n’a pas pu lire.' },
    { message: 'Aucune alerte alors que le portail en montre', cause: 'Mauvais abonnement, groupe filtré, ou alertes d’un autre type (journal, requêtes de journaux) non couvertes.', fix: 'Vérifie le contexte et retire le filtre de groupe ; compare avec le portail.' },
  ],
  verifyAfter: [
    'Compare le nombre de règles avec Surveiller > Alertes du portail.',
    'Pour chaque alerte critique, déclenche un test dans le portail et confirme que quelqu’un reçoit le message.',
  ],
  rollback: rollbackLecture('# Une règle précise\nGet-AzMetricAlertRuleV2 -ResourceGroupName \'rg-lab\' -Name \'alerte-cpu\''),
  checks: CHECKS_LECTURE,
  source: doc('azure/azure-monitor/alerts/alerts-overview'),
  sources: [
    { label: 'Vue d’ensemble des alertes Azure Monitor', url: doc('azure/azure-monitor/alerts/alerts-overview') },
    { label: 'Get-AzMetricAlertRuleV2', url: doc('powershell/module/az.monitor/get-azmetricalertrulev2') },
    { label: 'Groupes d’actions', url: doc('azure/azure-monitor/alerts/action-groups') },
    { label: 'Paramètres de diagnostic', url: doc('azure/azure-monitor/essentials/diagnostic-settings') },
  ],
  cloud: {
    probleme: 'Une alerte qui n’existe pas ou qui ne prévient personne ne protège de rien. Cet assistant dresse l’inventaire de ce qui est configuré, sans prétendre que c’est suffisant.',
    exemple: 'Un labo a une alerte « CPU > 90 % » mais elle est désactivée depuis un test : l’inventaire la signale.',
    lit: ['Les règles d’alerte, les groupes d’actions et les paramètres de diagnostic de l’abonnement'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien pour la lecture. Attention : les alertes et l’export de journaux vers Log Analytics ont un coût lorsqu’ils sont créés (hors de cet assistant).'],
    permissions: ['Lecteur ou Lecteur de surveillance (Monitoring Reader)'],
    licences: ['Aucune'],
    limites: [
      'Inventaire de configuration : il ne teste ni le seuil, ni la livraison des messages.',
      'Les formes d’objets des règles varient selon la version du module ; une propriété absente n’est pas lue comme « tout va bien ».',
      'Les paramètres de diagnostic par ressource ne sont pas parcourus.',
    ],
  },
});

// ===========================================================================
// 23. azure-budgets
// ===========================================================================
export const outilAzureBudgets = outilAzure({
  id: 'azure-budgets',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-budgets',
  title: 'Budgets Azure : lire les alertes de dépense (pas un plafond)',
  summary: 'Lit les budgets de l’abonnement (montant, période, dépense courante, seuils de notification). Rappelle qu’un budget est une alerte et ne bloque aucune dépense. Un résultat vide ne prouve pas l’absence de budget. Aucune création de budget. Lecture seule.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzConsumptionBudget'], facultatives: [] },
  champs: [
    { id: 'azLimite', label: 'Nombre maximal de budgets détaillés', type: 'number', default: '50', min: 1, max: 200, help: 'Entre 1 et 200.' },
  ],
  verifier(v, errors) {
    verif(errors, 'azLimite', validerBorne(v.azLimite, 1, 200, 'Le nombre maximal'));
  },
  parametres: (v) => [['Limite', psB64(String(validerBorne(v.azLimite, 1, 200).value))]],
  corps: () => [
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Budget = alerte' -Etat 'INFO' -Valeur 'un budget ne bloque rien' -Commentaire 'Un budget Azure envoie des notifications quand la depense atteint un seuil. Il n arrete aucune machine et ne bloque aucune depense. Pour limiter vraiment : supprimer ou desallouer les ressources, Azure Policy, ou une automatisation que TU construis.')",
    "$budgets = @(Invoke-KjemoLecture 'Budgets' 'Budgets de l abonnement' { Get-AzConsumptionBudget -ErrorAction Stop })",
    'if ($script:KjemoLectureOk) {',
    '  if ($budgets.Count -eq 0) {',
    "    [void](Add-KjemoResultat -Categorie 'Budgets' -Controle 'Aucun budget lu' -Etat 'ATTENTION' -Valeur 'resultat vide' -Commentaire 'Cela ne prouve PAS l absence de budget : la commande ne couvre pas tous les types d offre (ex. Entreprise) et demande un droit Cost Management. Verifie dans le portail : Cost Management > Budgets.')",
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Budgets' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$budgets.Count + ' budget(s)'))",
    '    foreach ($b in @($budgets | Sort-Object -Property Name | Select-Object -First ([int]$KjemoArgLimite))) {',
    "      $etat = 'INFO'; $constats = @()",
    '      $depense = $null',
    '      if ($null -ne $b.CurrentSpend -and $null -ne $b.CurrentSpend.Amount) { $depense = [decimal]$b.CurrentSpend.Amount }',
    '      $montant = $null',
    '      if ($null -ne $b.Amount) { $montant = [decimal]$b.Amount }',
    '      if ($null -ne $depense -and $null -ne $montant -and $montant -gt 0) {',
    '        $pct = [math]::Round(($depense / $montant) * 100, 0)',
    "        $constats += ('depense courante : ' + [string]$pct + ' % du budget')",
    "        if ($pct -ge 100) { $etat = 'ATTENTION'; $constats += 'BUDGET DEPASSE (aucune ressource n a ete arretee pour autant)' }",
    "        elseif ($pct -ge 80) { $etat = 'ATTENTION' }",
    "      } else { $constats += 'depense courante non fournie' }",
    '      $nbNotif = 0',
    '      if ($null -ne $b.Notification) { $nbNotif = @($b.Notification.Keys).Count }',
    "      if ($nbNotif -eq 0) { $etat = 'ATTENTION'; $constats += 'aucune notification lue : le budget ne previent personne' } else { $constats += ([string]$nbNotif + ' notification(s)') }",
    "      [void](Add-KjemoResultat -Categorie 'Budgets' -Controle ([string]$b.Name) -Etat $etat -Valeur ([string]$b.Amount + ' / ' + [string]$b.TimeGrain) -Commentaire ($constats -join ' ; '))",
    '    }',
    '  }',
    '}',
    "[void](Add-KjemoResultat -Categorie 'Limites' -Controle 'Ce que ce rapport ne dit pas' -Etat 'INFO' -Valeur 'pas une facture' -Commentaire 'La depense affichee est celle connue du budget, avec du retard (jusqu a 24 h) ; ce n est pas la facture. Aucun budget n est cree ni modifie par ce script.')",
  ],
  gui: [
    'Portail Azure > Cost Management + Billing > Cost Management > Budgets : liste et état des budgets.',
    'Créer un budget (hors de cet assistant) : Budgets > Ajouter > portée (abonnement ou groupe), montant, période, puis seuils d’alerte (par exemple 50 %, 80 %, 100 %) et destinataires.',
    'Analyse des coûts : la dépense réelle par service, groupe de ressources ou étiquette.',
  ],
  keywords: ['budget', 'budgets', 'cout', 'couts', 'facture', 'depense', 'cost management', 'plafond', 'alerte budget', 'get-azconsumptionbudget', 'azure gratuit', 'credit'],
  prereqs: ['Module Az.Billing. Rôle Lecteur Cost Management (Cost Management Reader) ou Lecteur sur l’abonnement.'],
  commonErrors: [
    { message: 'Résultat vide ou erreur « not supported »', cause: 'Certains types d’offre (Entreprise, partenaire) ou droits insuffisants ne permettent pas cette lecture.', fix: 'Consulte Cost Management > Budgets dans le portail ; ne conclus pas à l’absence de budget.' },
    { message: 'Le budget est dépassé mais les machines tournent encore', cause: 'C’est normal : un budget est une alerte, pas un plafond.', fix: 'Arrête ou désalloue les ressources toi-même, ou mets en place une automatisation volontaire.' },
  ],
  verifyAfter: [
    'Compare les montants avec Cost Management > Budgets dans le portail.',
    'Confirme qu’au moins une notification pointe vers une adresse lue régulièrement.',
  ],
  rollback: rollbackLecture('# Un budget précis\nGet-AzConsumptionBudget -Name \'budget-labo\''),
  checks: CHECKS_LECTURE.concat([
    'Aucune commande de création, de modification ou de suppression de budget n’est générée.',
  ]),
  source: doc('azure/cost-management-billing/costs/tutorial-acm-create-budgets'),
  sources: [
    { label: 'Créer et gérer des budgets', url: doc('azure/cost-management-billing/costs/tutorial-acm-create-budgets') },
    { label: 'Get-AzConsumptionBudget', url: doc('powershell/module/az.billing/get-azconsumptionbudget') },
    { label: 'Optimiser les coûts avec Cost Management', url: doc('azure/cost-management-billing/costs/cost-mgt-best-practices') },
  ],
  cloud: {
    probleme: 'Beaucoup d’étudiants croient qu’un budget « bloque » la dépense. Ce n’est pas le cas : il prévient, c’est tout.',
    exemple: 'Un budget de 20 $ est dépassé un vendredi soir ; la machine de labo continue de tourner tout le week-end parce que personne n’a lu l’alerte.',
    lit: ['Les budgets de l’abonnement et leur dépense courante'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : la lecture des budgets est gratuite'],
    permissions: ['Lecteur Cost Management ou Lecteur sur l’abonnement'],
    licences: ['Aucune'],
    limites: [
      'Un budget est une alerte, pas un plafond qui bloque automatiquement la dépense.',
      'Un résultat vide ne prouve pas l’absence de budget (types d’offre non couverts).',
      'La dépense affichée a du retard et n’est pas la facture.',
    ],
  },
});

// ===========================================================================
// 24. azure-ressources-inutilisees
// ===========================================================================
export const outilAzureRessourcesInutilisees = outilAzure({
  id: 'azure-ressources-inutilisees',
  famille: FAMILLE,
  prefixe: 'kjemo-azure-ressources-inutilisees',
  title: 'Ressources de laboratoire potentiellement inutilisées (inventaire)',
  summary: 'Dresse la liste explicite de CANDIDATS : disques non attachés, cartes réseau orphelines, adresses IP publiques non rattachées, machines arrêtées sans désallocation, instantanés anciens. N’efface rien et ne génère aucune commande de suppression : un candidat doit être vérifié par une personne.',
  portee: 'az',
  commandes: { obligatoires: ['Get-AzDisk'], facultatives: ['Get-AzNetworkInterface', 'Get-AzPublicIpAddress', 'Get-AzVM', 'Get-AzSnapshot'] },
  champs: [
    { id: 'azRg', label: 'Groupe de ressources (facultatif)', default: '', help: 'Vide = tout l’abonnement. Un groupe précis est recommandé pour un labo. Nom exact, sans joker.' },
    { id: 'azJoursSnapshot', label: 'Âge à partir duquel un instantané est « ancien » (jours)', type: 'number', default: '90', min: 1, max: 3650, help: 'Entre 1 et 3650.' },
  ],
  verifier(v, errors) {
    if (String(v.azRg ?? '').trim()) verif(errors, 'azRg', validerGroupeRessources(v.azRg));
    verif(errors, 'azJoursSnapshot', validerBorne(v.azJoursSnapshot, 1, 3650, 'L’âge'));
  },
  parametres: (v) => [
    ['Rg', psB64(String(v.azRg ?? '').trim())],
    ['JoursSnapshot', psB64(String(validerBorne(v.azJoursSnapshot, 1, 3650).value))],
  ],
  corps: () => [
    ...LIGNES_AIDES_AZ,
    '$nbCandidats = 0',
    "[void](Add-KjemoResultat -Categorie 'A lire avant' -Controle 'Candidat n est pas a supprimer' -Etat 'INFO' -Valeur 'inventaire, pas decision' -Commentaire 'Une ligne ATTENTION dit qu une ressource ressemble a un reste. Elle peut etre voulue (disque de donnees conserve, IP reservee, instantane avant mise a jour). Ce script ne supprime RIEN et ne genere aucune commande de suppression.')",
    "$disques = @(Invoke-KjemoLecture 'Disques' 'Disques manages' {",
    '  if ($KjemoArgRg) { Get-AzDisk -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzDisk -ErrorAction Stop }',
    '})',
    'if ($script:KjemoLectureOk) {',
    "  $orph = @($disques | Where-Object { [string]$_.DiskState -eq 'Unattached' -and -not $_.ManagedBy })",
    "  [void](Add-KjemoResultat -Categorie 'Disques' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$disques.Count + ' disque(s), ' + [string]$orph.Count + ' non attache(s)'))",
    '  foreach ($d in $orph) {',
    '    $nbCandidats++',
    "    [void](Add-KjemoResultat -Categorie 'Disques' -Controle ([string]$d.Name) -Etat 'ATTENTION' -Valeur ([string]$d.DiskSizeGB + ' Go / ' + [string]$d.Sku.Name) -Commentaire 'Non attache : il est quand meme FACTURE. Verifie qu il ne sert pas de sauvegarde avant toute decision.')",
    '  }',
    '}',
    "if ($null -ne (Get-Command -Name 'Get-AzNetworkInterface' -ErrorAction SilentlyContinue)) {",
    "  $nics = @(Invoke-KjemoLecture 'Cartes reseau' 'Cartes reseau' {",
    '    if ($KjemoArgRg) { Get-AzNetworkInterface -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzNetworkInterface -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    '    $orph = @($nics | Where-Object { -not $_.VirtualMachine -and -not $_.PrivateEndpoint })',
    "    [void](Add-KjemoResultat -Categorie 'Cartes reseau' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$nics.Count + ' carte(s), ' + [string]$orph.Count + ' sans machine'))",
    '    foreach ($n in $orph) {',
    '      $nbCandidats++',
    "      [void](Add-KjemoResultat -Categorie 'Cartes reseau' -Controle ([string]$n.Name) -Etat 'ATTENTION' -Valeur 'aucune machine rattachee' -Commentaire 'Une carte seule est gratuite, mais elle garde ses adresses et peut etre referencee ailleurs.')",
    '    }',
    '  }',
    '}',
    "if ($null -ne (Get-Command -Name 'Get-AzPublicIpAddress' -ErrorAction SilentlyContinue)) {",
    "  $ips = @(Invoke-KjemoLecture 'Adresses IP publiques' 'Adresses IP publiques' {",
    '    if ($KjemoArgRg) { Get-AzPublicIpAddress -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzPublicIpAddress -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    '    $orph = @($ips | Where-Object { -not $_.IpConfiguration })',
    "    [void](Add-KjemoResultat -Categorie 'Adresses IP publiques' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$ips.Count + ' adresse(s), ' + [string]$orph.Count + ' non rattachee(s)'))",
    '    foreach ($p in $orph) {',
    '      $nbCandidats++',
    "      [void](Add-KjemoResultat -Categorie 'Adresses IP publiques' -Controle ([string]$p.Name) -Etat 'ATTENTION' -Valeur ([string]$p.PublicIpAllocationMethod + ' / ' + [string]$p.Sku.Name) -Commentaire 'Non rattachee : une IP publique statique est facturee meme sans usage. Elle peut etre reservee volontairement (DNS, liste d autorisation chez un tiers).')",
    '    }',
    '  }',
    '}',
    "if ($null -ne (Get-Command -Name 'Get-AzVM' -ErrorAction SilentlyContinue)) {",
    "  $vms = @(Invoke-KjemoLecture 'Machines virtuelles' 'Etat des machines' {",
    '    if ($KjemoArgRg) { Get-AzVM -ResourceGroupName $KjemoArgRg -Status -ErrorAction Stop } else { Get-AzVM -Status -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    "    $arretees = @($vms | Where-Object { (Get-KjemoPowerState $_) -eq 'VM stopped' })",
    "    [void](Add-KjemoResultat -Categorie 'Machines virtuelles' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$vms.Count + ' machine(s), ' + [string]$arretees.Count + ' arretee(s) sans desallocation'))",
    '    foreach ($m in $arretees) {',
    '      $nbCandidats++',
    "      [void](Add-KjemoResultat -Categorie 'Machines virtuelles' -Controle ([string]$m.Name) -Etat 'ATTENTION' -Valeur 'VM stopped (non desallouee)' -Commentaire 'Arretee depuis le systeme : le calcul reste FACTURE. Seule la desallocation (VM deallocated) arrete la facturation du calcul. Utilise l assistant d arret pour la desallouer.')",
    '    }',
    '  }',
    '}',
    "if ($null -ne (Get-Command -Name 'Get-AzSnapshot' -ErrorAction SilentlyContinue)) {",
    "  $snaps = @(Invoke-KjemoLecture 'Instantanes' 'Instantanes de disques' {",
    '    if ($KjemoArgRg) { Get-AzSnapshot -ResourceGroupName $KjemoArgRg -ErrorAction Stop } else { Get-AzSnapshot -ErrorAction Stop }',
    '  })',
    '  if ($script:KjemoLectureOk) {',
    '    $seuilSnap = (Get-Date).AddDays(-[int]$KjemoArgJoursSnapshot)',
    '    $anciens = @($snaps | Where-Object { $null -ne $_.TimeCreated -and [datetime]$_.TimeCreated -lt $seuilSnap })',
    "    [void](Add-KjemoResultat -Categorie 'Instantanes' -Controle 'Total' -Etat 'INFO' -Valeur ([string]$snaps.Count + ' instantane(s), ' + [string]$anciens.Count + ' de plus de ' + [string]$KjemoArgJoursSnapshot + ' jours'))",
    '    foreach ($s in $anciens) {',
    '      $nbCandidats++',
    "      [void](Add-KjemoResultat -Categorie 'Instantanes' -Controle ([string]$s.Name) -Etat 'ATTENTION' -Valeur ([string]$s.DiskSizeGB + ' Go, cree le ' + ([datetime]$s.TimeCreated).ToString('s')) -Commentaire 'Ancien instantane : facture selon la taille. Peut etre le seul point de retour d une operation passee.')",
    '    }',
    '  }',
    '}',
    "[void](Add-KjemoResultat -Categorie 'Resume' -Controle 'Candidats a examiner' -Etat 'INFO' -Valeur ([string]$nbCandidats + ' candidat(s)') -Commentaire 'Pour chacun : qui l a cree (etiquettes, journal d activite), est-il encore reference, qui decide. Supprime ensuite UNE ressource precise, nommee, depuis le portail ou une commande ciblee que tu ecris toi-meme - jamais en bloc.')",
  ],
  gui: [
    'Portail Azure > Disques : filtre « État du disque = Non attaché ».',
    'Portail Azure > Interfaces réseau et Adresses IP publiques : colonne « Associé à » vide.',
    'Portail Azure > Machines virtuelles : l’état « Arrêtée » (facturée) se distingue de « Arrêtée (libérée) » (non facturée pour le calcul).',
    'Cost Management > Analyse des coûts > grouper par « Ressource » : repère les lignes inattendues avant de chercher des candidats.',
    'Azure Advisor > Coût : recommandations de ressources sous-utilisées.',
  ],
  keywords: ['ressources inutilisees', 'orphelin', 'orpheline', 'nettoyage', 'cout inutile', 'disque non attache', 'ip publique non utilisee', 'snapshot ancien', 'instantane', 'vm arretee facturee', 'labo oublie', 'economiser'],
  prereqs: ['Lecteur (Reader) sur les groupes de ressources examinés. Modules Az.Compute et Az.Network.'],
  commonErrors: [
    { message: 'Un « candidat » est en fait utilisé', cause: 'Le rapport ne voit que l’état des propriétés (non attaché, non rattaché), pas l’usage réel (sauvegarde, réservation voulue).', fix: 'Vérifie les étiquettes et le journal d’activité, demande à son créateur, puis décide.' },
    { message: 'Liste vide alors que des ressources traînent', cause: 'Mauvais groupe, mauvais abonnement ou lecture partielle (lignes INACCESSIBLE).', fix: 'Retire le filtre de groupe, vérifie le contexte et les lignes INACCESSIBLE.' },
  ],
  verifyAfter: [
    'Pour chaque candidat, ouvre-le dans le portail et lis ses étiquettes et son historique avant toute décision.',
    'Après un nettoyage fait par toi, relance l’inventaire : seul le candidat visé a disparu.',
  ],
  rollback: rollbackLecture('# Détail d’un disque candidat\nGet-AzDisk -ResourceGroupName \'rg-lab\' -DiskName \'ancien-disque-donnees\' | Format-List Name, DiskState, TimeCreated, Tags'),
  checks: CHECKS_LECTURE.concat([
    'Aucune commande Remove-* ou de suppression n’est générée : le nettoyage commence par un inventaire explicite et reste une décision humaine ciblée.',
  ]),
  source: doc('azure/cost-management-billing/costs/cost-mgt-best-practices'),
  sources: [
    { label: 'Bonnes pratiques Cost Management', url: doc('azure/cost-management-billing/costs/cost-mgt-best-practices') },
    { label: 'Get-AzDisk', url: doc('powershell/module/az.compute/get-azdisk') },
    { label: 'États et facturation des machines virtuelles', url: doc('azure/virtual-machines/states-billing') },
    { label: 'Adresses IP publiques Azure', url: doc('azure/virtual-network/ip-services/public-ip-addresses') },
  ],
  cloud: {
    probleme: 'Les factures surprises d’un labo viennent presque toujours de restes oubliés : disque détaché, IP statique, machine « arrêtée » mais pas libérée. Il faut les trouver sans rien casser.',
    exemple: 'Après un TP, un disque de 512 Go reste non attaché et une machine est « arrêtée » depuis Windows. L’inventaire les liste ; l’étudiant décide, un par un.',
    lit: ['Disques, cartes réseau, adresses IP publiques, état des machines et instantanés du périmètre choisi'],
    ecrit: ['Rien dans Azure', 'Un fichier de rapport dans le dossier courant, seulement si tu choisis JSON ou CSV'],
    facture: ['Rien : ces lectures ne créent aucune ressource'],
    permissions: ['Lecteur (Reader) sur les groupes de ressources lus'],
    licences: ['Aucune'],
    limites: [
      'Un candidat n’est jamais une preuve d’inutilité.',
      'Aucune suppression n’est effectuée ni proposée en bloc ; le nettoyage global automatique est exclu.',
      'Les ressources d’autres types (bases de données, passerelles…) ne sont pas couvertes.',
    ],
  },
});

export const toolsAzureCout = [
  outilAzureJournalActivite,
  outilAzureAlertesDiagnostics,
  outilAzureBudgets,
  outilAzureRessourcesInutilisees,
];
