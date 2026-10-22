/**
 * outils-impression-win-action.mjs — LOT 9 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Parcours B et C — CONFIGURATION GUIDÉE et DÉBLOCAGE CIBLÉ, Windows.
 *
 *   B  imp-win-config-reseau       port TCP/IP + imprimante, avec un pilote
 *                                  DÉJÀ installé. Refuse d'écraser.
 *      imp-win-connexion-partage   connexion à \\serveur\partage dans le
 *                                  contexte du compte qui lance le script.
 *      imp-win-defaut              imprimante par défaut du compte courant.
 *      imp-win-page-test           page de test, action explicite qui annonce
 *                                  la consommation de papier et d'encre.
 *   C  imp-win-annuler-travail     UN travail identifié, après lecture.
 *      imp-win-spouleur-redemarrer redémarre le spouleur, sans purger.
 *
 * Aucune de ces fiches ne supprime d'imprimante, de port ni de pilote, ne
 * vide le dossier de spool, ni ne télécharge quoi que ce soit.
 *
 * Toutes partagent la même mécanique : Mode « Diagnostic » par défaut, phrase
 * de confirmation exacte qui NOMME la cible, lecture avant, relecture après.
 * Le verdict vient de la relecture, jamais du code de retour de la commande.
 */

import { outilImpression } from './noyau-impression.mjs';
import { psB64 } from './noyau.mjs';
import {
  validerNomImprimante, validerNomPort, validerNomPilote, validerHoteImprimante,
  validerPortTcpImpression, validerUncImprimante, validerIdTravail, validerChoix,
} from './validateurs-impression.mjs';
import {
  SRC, champNomImprimante, champHote, champUnc, verifierChamp, LIGNES_PARSE_UNC,
} from './outils-impression-win-lecture.mjs';

const LIMITE_ETAT = 'Un état relu conforme prouve que l’objet existe comme demandé, pas qu’une page s’imprimera : fais un essai d’impression réel.';

/** Nom NetBIOS d'une machine : 15 caractères au plus, lettres, chiffres, tirets. */
function validerMachine(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, error: 'Le nom de la machine est obligatoire : il sert de garde (le script refuse de tourner ailleurs).' };
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,14}$/.test(s)) {
    return { ok: false, error: 'Le nom de la machine est le nom NetBIOS : 15 caractères au plus, lettres, chiffres et tirets, sans point ni espace.' };
  }
  return { ok: true, value: s };
}

const GARDE_PORTE_REFUS = (quoi) => [
  '} elseif ($KjemoMode -ceq \'Appliquer\') {',
  '  $script:KjemoRefus = $true',
  `  Write-Host 'AUCUNE MODIFICATION : ${quoi} n a pas eu lieu. Les conditions non remplies sont dans les avertissements ci-dessus.'`,
];

// ===========================================================================
// 6. CONFIGURER UNE IMPRIMANTE RÉSEAU (PORT TCP/IP + IMPRIMANTE)
// ===========================================================================

export const impWinConfigReseau = outilImpression({
  id: 'imp-win-config-reseau',
  famille: 'Configuration Windows',
  title: 'Configurer une imprimante réseau (port TCP/IP + imprimante)',
  summary: 'Crée un port TCP/IP puis une imprimante Windows qui l’utilise, avec un pilote DÉJÀ installé. Lit d’abord : pilote présent, nom d’imprimante et nom de port libres, joignabilité. Refuse d’écraser un objet existant, ne télécharge ni n’installe aucun pilote, et relit l’imprimante créée avant de conclure.',
  action: true,
  admin: true,
  champs: [
    champNomImprimante('Le nom de la NOUVELLE imprimante. S’il existe déjà, le script refuse : rien n’est remplacé.', 'HP LaserJet Accueil'),
    champHote(),
    { id: 'impPortTcp', label: 'Port TCP', type: 'number', default: '9100', min: 1, max: 65535, help: '9100 pour l’impression RAW, le cas le plus courant.' },
    {
      id: 'impPilote', label: 'Nom du pilote DÉJÀ installé', type: 'text', default: 'Microsoft IPP Class Driver',
      help: 'Le nom exact tel que « Get-PrinterDriver » l’affiche. S’il est absent, le script refuse : il ne télécharge et n’installe rien.',
    },
    {
      id: 'impNomPort', label: 'Nom du port (vide = IP_ + adresse)', type: 'text', default: '',
      help: 'Facultatif. Si un port de ce nom existe déjà vers une AUTRE adresse, le script refuse de le modifier.',
    },
  ],
  verifier(v, errors) {
    verifierChamp(errors, 'impNom', validerNomImprimante(v.impNom));
    verifierChamp(errors, 'impHote', validerHoteImprimante(v.impHote));
    verifierChamp(errors, 'impPortTcp', validerPortTcpImpression(v.impPortTcp));
    verifierChamp(errors, 'impPilote', validerNomPilote(v.impPilote));
    const np = nomPortEffectif(v);
    verifierChamp(errors, 'impNomPort', validerNomPort(np, 'Le nom du port'));
  },
  phrase(v) {
    return `CREER ${validerNomImprimante(v.impNom).value} SUR ${validerHoteImprimante(v.impHote).value}:${validerPortTcpImpression(v.impPortTcp).value}`;
  },
  phraseAide: 'CREER <nom de l’imprimante> SUR <adresse>:<port>',
  aideMode: 'Diagnostic lit et décrit ce qui serait créé (le port seul est simulé par -WhatIf). Appliquer crée le port puis l’imprimante.',
  parametres(v) {
    return [
      ['Imprimante', psB64(validerNomImprimante(v.impNom).value)],
      ['Hote', psB64(validerHoteImprimante(v.impHote).value)],
      ['PortTcp', `[int]${psB64(String(validerPortTcpImpression(v.impPortTcp).value))}`],
      ['Pilote', psB64(validerNomPilote(v.impPilote).value)],
      ['NomPort', psB64(nomPortEffectif(v))],
    ];
  },
  commandes: {
    obligatoires: ['Get-Printer', 'Get-PrinterPort', 'Get-PrinterDriver', 'Add-PrinterPort', 'Add-Printer'],
    facultatives: [],
  },
  prefixe: 'kjemo-imprimante-config',
  corps() {
    return [
      `if ($KjemoAdmin) {
  [void](Add-KjemoResultat -Categorie 'Droits' -Controle 'Console elevee' -Etat 'OK' -Valeur 'oui' -Commentaire 'Creer un port et une imprimante demande des droits d administrateur.')
} else {
  [void](Add-KjemoResultat -Categorie 'Droits' -Controle 'Console elevee' -Etat 'PROBLEME' -Valeur 'non' -Commentaire 'Creer un port et une imprimante exige une console PowerShell lancee en administrateur. Relance-la ainsi.')
}

# --- 1. Le pilote est-il DEJA installe ? Ce script ne telecharge rien. ---
$piloteOk = $false
$script:PilotesListe = @()
$lu = Invoke-KjemoLecture 'Pilote' 'Get-PrinterDriver' { $script:PilotesListe = @(Get-PrinterDriver -ErrorAction Stop) }
if ($lu) {
  foreach ($d in $script:PilotesListe) { if ([string]$d.Name -ieq $KjemoArgPilote) { $piloteOk = $true } }
  if ($piloteOk) {
    [void](Add-KjemoResultat -Categorie 'Pilote' -Controle 'Pilote installe' -Etat 'OK' -Valeur $KjemoArgPilote -Commentaire 'Le pilote est deja installe. Il ne sera pas modifie.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Pilote' -Controle 'Pilote installe' -Etat 'PROBLEME' -Valeur $KjemoArgPilote -Commentaire 'REFUS : ce pilote n est pas installe. Ce script ne telecharge ni n installe aucun pilote : installe-le toi-meme depuis le site du constructeur, puis relance.')
  }
}

# --- 2. Le nom d imprimante est-il LIBRE ? On n ecrase rien. ---
$nomLibre = $false
$res = Get-KjemoImprimanteExacte -Nom $KjemoArgImprimante
if ($res.Etat -eq 'ABSENTE') {
  $nomLibre = $true
  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Nom d imprimante' -Etat 'OK' -Valeur $KjemoArgImprimante -Commentaire 'Aucune imprimante ne porte ce nom : il est libre.')
} elseif ($res.Etat -eq 'ILLISIBLE') {
  $script:KjemoInaccessibles = $script:KjemoInaccessibles + 1
  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Nom d imprimante' -Etat 'ATTENTION' -Valeur 'INACCESSIBLE' -Commentaire ('La liste des imprimantes n a pas pu etre lue : ' + $res.Message + ' Sans cette lecture, aucune creation.'))
} else {
  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Nom d imprimante' -Etat 'PROBLEME' -Valeur $KjemoArgImprimante -Commentaire 'REFUS : une imprimante porte deja ce nom. Rien n est remplace ni modifie. Choisis un autre nom, ou utilise l assistant de diagnostic.')
}

# --- 3. Le port : a creer, a reutiliser, ou en conflit ---
$portAcreer = $false
$portOk = $false
$script:PortsListe = @()
$luPorts = Invoke-KjemoLecture 'Port' 'Get-PrinterPort' { $script:PortsListe = @(Get-PrinterPort -ErrorAction Stop) }
if ($luPorts) {
  $existant = $null
  foreach ($pp in $script:PortsListe) { if ([string]$pp.Name -ieq $KjemoArgNomPort) { $existant = $pp } }
  $memeAdresse = @($script:PortsListe | Where-Object { [string]$_.PrinterHostAddress -ieq $KjemoArgHote -and [int]$_.PortNumber -eq $KjemoArgPortTcp -and [string]$_.Name -ine $KjemoArgNomPort })
  if ($null -ne $existant) {
    if ([string]$existant.PrinterHostAddress -ieq $KjemoArgHote -and [int]$existant.PortNumber -eq $KjemoArgPortTcp) {
      $portOk = $true
      [void](Add-KjemoResultat -Categorie 'Port' -Controle 'Port existant' -Etat 'OK' -Valeur $KjemoArgNomPort -Commentaire 'Un port de ce nom existe deja vers la MEME adresse et le MEME numero : il sera reutilise, pas recree.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Port' -Controle 'Port existant' -Etat 'PROBLEME' -Valeur ($KjemoArgNomPort + ' -> ' + [string]$existant.PrinterHostAddress + ':' + [string]$existant.PortNumber) -Commentaire 'REFUS : ce nom de port existe deja vers une AUTRE adresse ou un autre numero. Le script ne le modifie pas : choisis un autre nom de port.')
    }
  } elseif ($memeAdresse.Count -gt 0) {
    [void](Add-KjemoResultat -Categorie 'Port' -Controle 'Port vers la meme adresse' -Etat 'PROBLEME' -Valeur ([string]$memeAdresse[0].Name) -Commentaire 'REFUS : un port d un autre nom vise deja cette adresse et ce numero. Renseigne ce nom dans le champ « Nom du port » pour le reutiliser, au lieu de dupliquer.')
  } else {
    $portAcreer = $true
    $portOk = $true
    [void](Add-KjemoResultat -Categorie 'Port' -Controle 'Port a creer' -Etat 'OK' -Valeur ($KjemoArgNomPort + ' -> ' + $KjemoArgHote + ':' + [string]$KjemoArgPortTcp) -Commentaire 'Aucun port de ce nom ni vers cette adresse : il sera cree.')
  }
}

# --- 4. Joignabilite (information : une imprimante eteinte reste configurable) ---
[void](Test-KjemoReseau -Hote $KjemoArgHote -Port $KjemoArgPortTcp -Protocole 'RAW')

# --- 5. Porte : toutes les conditions, sinon rien ---
$KjemoPeutAgir = ($KjemoAdmin -and $piloteOk -and $nomLibre -and $portOk)

if ($KjemoAgirDemande -and $KjemoPeutAgir) {
  $tout = $true
  if ($portAcreer) {
    try {
      Add-PrinterPort -Name $KjemoArgNomPort -PrinterHostAddress $KjemoArgHote -PortNumber $KjemoArgPortTcp -ErrorAction Stop
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-PrinterPort' -Etat 'INFO' -Valeur 'commande acceptee' -Commentaire 'Acceptee ne veut pas dire effective : la relecture decide.')
    } catch {
      $tout = $false
      $script:KjemoEcart = $true
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-PrinterPort' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message)))
    }
  }
  if ($tout) {
    try {
      Add-Printer -Name $KjemoArgImprimante -DriverName $KjemoArgPilote -PortName $KjemoArgNomPort -ErrorAction Stop
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-Printer' -Etat 'INFO' -Valeur 'commande acceptee' -Commentaire 'Acceptee ne veut pas dire effective : la relecture decide.')
    } catch {
      $tout = $false
      $script:KjemoEcart = $true
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-Printer' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire ((Hide-KjemoSecrets ([string]$_.Exception.Message)) + ' Si le port vient d etre cree, il reste en place : ce script ne le supprime pas.'))
    }
  }
  $script:KjemoAgi = $tout
  # --- Relecture : c est elle qui decide ---
  $apres = Get-KjemoImprimanteExacte -Nom $KjemoArgImprimante
  if ($apres.Etat -eq 'TROUVEE' -and [string]$apres.Objet.DriverName -ieq $KjemoArgPilote -and [string]$apres.Objet.PortName -ieq $KjemoArgNomPort) {
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Imprimante creee' -Etat 'OK' -Valeur ([string]$apres.Objet.Name + ' | pilote ' + [string]$apres.Objet.DriverName + ' | port ' + [string]$apres.Objet.PortName + ' | etat declare ' + [string]$apres.Objet.PrinterStatus) -Commentaire 'L imprimante existe avec le pilote et le port demandes. Cela ne prouve pas qu une page s imprimera.')
  } else {
    $script:KjemoEcart = $true
    $script:KjemoAgi = $false
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Imprimante creee' -Etat 'PROBLEME' -Valeur ([string]$apres.Etat) -Commentaire 'La relecture ne retrouve pas l imprimante telle que demandee.')
  }
  $portApres = $null
  $null = Invoke-KjemoLecture 'Relecture' 'Get-PrinterPort' { foreach ($x in @(Get-PrinterPort -ErrorAction Stop)) { if ([string]$x.Name -ieq $KjemoArgNomPort) { $script:PortApres = $x } } }
  if ($null -ne $script:PortApres -and [string]$script:PortApres.PrinterHostAddress -ieq $KjemoArgHote -and [int]$script:PortApres.PortNumber -eq $KjemoArgPortTcp) {
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Port' -Etat 'OK' -Valeur ($KjemoArgNomPort + ' -> ' + $KjemoArgHote + ':' + [string]$KjemoArgPortTcp))
  } else {
    $script:KjemoEcart = $true
    $script:KjemoAgi = $false
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Port' -Etat 'PROBLEME' -Valeur 'non retrouve tel que demande' -Commentaire 'La relecture du port ne correspond pas a la demande.')
  }`,
      ...GARDE_PORTE_REFUS('la creation'),
      `} else {
  [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Ce qui serait fait' -Etat 'INFO' -Valeur ('creer le port ' + $KjemoArgNomPort + ' puis l imprimante ' + $KjemoArgImprimante) -Commentaire 'MODE DIAGNOSTIC : rien n est cree.')
  if ($portAcreer -and $KjemoAdmin) {
    try { Add-PrinterPort -Name $KjemoArgNomPort -PrinterHostAddress $KjemoArgHote -PortNumber $KjemoArgPortTcp -WhatIf -ErrorAction Stop }
    catch { [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Add-PrinterPort -WhatIf' -Etat 'ATTENTION' -Valeur 'simulation impossible' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message))) }
  }
  [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Add-Printer' -Etat 'INFO' -Valeur 'pas de simulation native' -Commentaire 'Add-Printer n a pas de simulation (-WhatIf) fiable : le mode Diagnostic ne le lance pas et se limite a decrire.')
}`,
    ].join('\n').split('\n');
  },
  conclusionAgi: 'Port et imprimante crees ; la relecture les retrouve avec le pilote et le port demandes. Cela ne prouve PAS qu une page s imprimera : lance une impression reelle.',
  impression: {
    probleme: 'Tu dois ajouter une imprimante réseau à un poste, sans te tromper de port, sans écraser une configuration qui marche, et sans installer un pilote douteux.',
    exemple: 'HP LaserJet Accueil à 192.168.30.50, port 9100, pilote « Microsoft IPP Class Driver » déjà présent : le script vérifie que le pilote est là, que ni le nom ni le port n’existent, simule le port avec -WhatIf, puis (en mode Appliquer, avec la phrase exacte) crée le port, l’imprimante et relit le tout.',
    premiere: 'Lance-le d’abord en mode Diagnostic dans une console élevée : tu vois chaque objet qu’il créerait et chaque raison de refus, sans rien créer.',
    lit: 'Get-PrinterDriver, Get-Printer, Get-PrinterPort et un test TCP .NET vers l’imprimante.',
    ecrit: 'En mode Appliquer seulement : un port TCP/IP (Add-PrinterPort) puis une imprimante (Add-Printer). Rien d’autre.',
    effets: 'Une nouvelle imprimante apparaît pour tous les comptes du poste. Aucun pilote n’est installé ni modifié, aucun objet existant n’est remplacé, aucune page n’est imprimée.',
    limites: [
      LIMITE_ETAT,
      'Add-Printer n’a pas de simulation native fiable : en mode Diagnostic, seule la création du port est simulée par -WhatIf ; l’imprimante est décrite sans être lancée.',
      'Le script ne supprime rien. Si l’imprimante échoue après la création du port, le port reste : le retour arrière est décrit dans la fiche.',
      'Un pilote absent est un refus. Aucun pilote n’est téléchargé : installe-le toi-même depuis une source constructeur de confiance.',
    ],
  },
  gui: [
    'Ouvre PowerShell en administrateur.',
    'Vérifie que le pilote est installé : « Get-PrinterDriver | Select-Object Name ».',
    'Vérifie que le nom est libre : « Get-Printer | Select-Object Name ».',
    'Crée le port : « Add-PrinterPort -Name IP_192.168.30.50 -PrinterHostAddress 192.168.30.50 -PortNumber 9100 » (simulable avec -WhatIf).',
    'Crée l’imprimante : « Add-Printer -Name "HP LaserJet Accueil" -DriverName "<pilote>" -PortName IP_192.168.30.50 ».',
    'Relis : « Get-Printer -Name "HP LaserJet Accueil" | Format-List Name, DriverName, PortName, PrinterStatus ». Puis imprime une page réelle.',
  ],
  keywords: ['imprimante', 'port tcp/ip', 'add-printerport', 'add-printer', 'configurer', 'ajouter imprimante', 'pilote', 'raw', '9100', 'windows'],
  prereqs: ['Une console PowerShell élevée pour le mode Appliquer.', 'Le pilote DÉJÀ installé sur ce poste.'],
  reversible: true,
  rollback: {
    summary: 'Le retour arrière supprime ce que ce script a créé, dans l’ordre inverse : d’abord l’imprimante, puis le port si plus aucune file ne l’utilise. Ce script ne le fait JAMAIS lui-même.',
    diagnostic: 'Get-Printer -Name "HP LaserJet Accueil" | Format-List Name, DriverName, PortName\nGet-PrinterPort -Name "IP_192.168.30.50" | Format-List Name, PrinterHostAddress, PortNumber',
    command: '# A lancer toi-meme, en administrateur, apres avoir verifie que rien d autre n utilise ces objets :\nRemove-Printer -Name "HP LaserJet Accueil" -Confirm\nRemove-PrinterPort -Name "IP_192.168.30.50" -Confirm',
    warning: 'Remove-Printer supprime définitivement l’imprimante, ses préférences et ses travaux en attente. Ne supprime le port que si aucune autre imprimante ne l’utilise.',
  },
  checks: [
    'Mode Diagnostic par défaut ; Appliquer exige en plus la phrase « CREER <nom> SUR <adresse>:<port> », vérifiée de nouveau par le script.',
    'Le pilote doit déjà être installé ; sinon refus. Rien n’est téléchargé ni installé.',
    'Un nom d’imprimante ou un nom de port déjà utilisé vers une AUTRE cible est un refus : rien n’est écrasé ni remplacé silencieusement.',
    'Un port existant vers la même adresse est réutilisé, pas dupliqué ; un port d’un autre nom vers la même adresse est un refus explicite.',
    'Une console non élevée est un refus.',
    'Seul Add-PrinterPort est simulé par -WhatIf ; Add-Printer ne l’est pas (simulation non fiable) : le mode Diagnostic le décrit sans le lancer.',
    'L’imprimante et le port sont RELUS après l’action ; un écart donne la conclusion ECART, jamais un succès.',
  ],
  verifyAfter: [
    '« Get-Printer -Name "<nom>" » rend l’imprimante avec le pilote et le port demandés.',
    '« Get-PrinterPort -Name "<port>" » rend la bonne adresse et le bon numéro.',
    'Le rapport contient les lignes « Relecture » ; elles viennent de Get-Printer et Get-PrinterPort, pas du code de retour.',
    'Seul un travail d’impression réel prouve que la file imprime.',
  ],
  source: SRC.addPrinter.url,
  sources: [SRC.addPrinter, SRC.addPort, SRC.getPrinter, SRC.getPort, SRC.getDriver],
});

function nomPortEffectif(v) {
  const saisi = String(v.impNomPort ?? '').trim();
  if (saisi) return saisi;
  const h = validerHoteImprimante(v.impHote);
  return `IP_${h.ok ? h.value : String(v.impHote ?? '').trim()}`;
}

// ===========================================================================
// 7. SE CONNECTER À UNE FILE PARTAGÉE
// ===========================================================================

export const impWinConnexionPartage = outilImpression({
  id: 'imp-win-connexion-partage',
  famille: 'Configuration Windows',
  title: 'Se connecter à une file partagée \\\\serveur\\partage',
  summary: 'Connecte le compte qui lance le script à une file partagée par un serveur d’impression. Lit d’abord : serveur joignable, file présente, pilote réclamé et déjà installé ou non. Refuse d’installer un pilote venant du serveur sans acceptation explicite, et refuse si la connexion existe déjà.',
  action: true,
  admin: false,
  champs: [
    champUnc(),
    {
      id: 'impPiloteAuto', label: 'Accepter l’installation d’un pilote proposé par le serveur', type: 'select', default: 'Non',
      options: [['Non', 'Non — refuser si le pilote n’est pas déjà installé ici (recommandé)'], ['Oui', 'Oui — Windows peut installer le pilote du serveur (Point and Print)']],
      help: 'Se connecter à une file partagée peut faire installer automatiquement le pilote que le serveur propose. N’accepte que pour un serveur auquel tu fais confiance.',
    },
  ],
  verifier(v, errors) {
    verifierChamp(errors, 'impUnc', validerUncImprimante(v.impUnc));
    verifierChamp(errors, 'impPiloteAuto', validerChoix(v.impPiloteAuto, ['Non', 'Oui'], 'Le choix'));
  },
  phrase(v) {
    return `CONNECTER ${validerUncImprimante(v.impUnc).value}`;
  },
  phraseAide: 'CONNECTER <chemin UNC>',
  aideMode: 'Diagnostic lit et décrit la connexion, sans la créer. Appliquer connecte le compte qui lance le script.',
  parametres(v) {
    return [['Unc', psB64(validerUncImprimante(v.impUnc).value)], ['PiloteAuto', psB64(v.impPiloteAuto)]];
  },
  commandes: { obligatoires: ['Get-Printer', 'Add-Printer'], facultatives: ['Get-PrinterDriver'] },
  prefixe: 'kjemo-imprimante-connexion',
  corps() {
    return [
      ...LIGNES_PARSE_UNC('$KjemoArgUnc'),
      `if ($KjemoAdmin) {
  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Compte et elevation' -Etat 'ATTENTION' -Valeur 'console elevee' -Commentaire 'Une connexion de file partagee est propre au COMPTE. Depuis une console elevee, elle peut etre creee pour le compte administrateur et pas pour l utilisateur qui imprime. Lance ce script dans la session du compte concerne, sans elevation.')
}

# --- 1. Le serveur ---
$etatSmb = Test-KjemoReseau -Hote $Serveur -Port 445 -Protocole 'SMB'
$serveurOk = ($etatSmb -eq 'OUVERT')

# --- 2. Deja connecte ? On ne remplace rien. ---
$libre = $false
$script:Locales = @()
$lu = Invoke-KjemoLecture 'Ce poste' 'Get-Printer' { $script:Locales = @(Get-Printer -ErrorAction Stop) }
if ($lu) {
  $deja = @($script:Locales | Where-Object { [string]$_.Name -ieq $KjemoArgUnc })
  if ($deja.Count -gt 0) {
    [void](Add-KjemoResultat -Categorie 'Ce poste' -Controle 'Connexion existante' -Etat 'PROBLEME' -Valeur $KjemoArgUnc -Commentaire 'REFUS : ce compte est deja connecte a cette file. Rien n est remplace.')
  } else {
    $libre = $true
    [void](Add-KjemoResultat -Categorie 'Ce poste' -Controle 'Connexion existante' -Etat 'OK' -Valeur 'aucune' -Commentaire 'Ce compte n est pas encore connecte a cette file.')
  }
}

# --- 3. La file sur le serveur, et son pilote ---
$fichePresente = $false
$piloteDistant = ''
if ($serveurOk) {
  $script:Distantes = @()
  $luD = Invoke-KjemoLecture 'Serveur' 'Get-Printer -ComputerName' { $script:Distantes = @(Get-Printer -ComputerName $Serveur -ErrorAction Stop) }
  if ($luD) {
    $f = @($script:Distantes | Where-Object { [string]$_.ShareName -ieq $Partage })
    if ($f.Count -eq 1) {
      $fichePresente = $true
      $piloteDistant = [string]$f[0].DriverName
      [void](Add-KjemoResultat -Categorie 'Serveur' -Controle 'File partagee' -Etat 'OK' -Valeur ([string]$f[0].Name + ' | pilote : ' + $piloteDistant) -Commentaire 'La file existe sur le serveur.')
    } elseif ($f.Count -eq 0) {
      [void](Add-KjemoResultat -Categorie 'Serveur' -Controle 'File partagee' -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'REFUS : le serveur ne publie aucune file sous ce nom de partage.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Serveur' -Controle 'File partagee' -Etat 'PROBLEME' -Valeur ([string]$f.Count + ' correspondances') -Commentaire 'REFUS : plusieurs files portent ce nom de partage.')
    }
  }
}

# --- 4. Le pilote : decision explicite ---
$piloteOk = $false
if ($fichePresente) {
  $present = $false
  $script:PilotesListe = @()
  $luP = Invoke-KjemoLecture 'Pilote' 'Get-PrinterDriver' { $script:PilotesListe = @(Get-PrinterDriver -ErrorAction Stop) }
  if ($luP) {
    foreach ($d in $script:PilotesListe) { if ([string]$d.Name -ieq $piloteDistant) { $present = $true } }
    if ($present) {
      $piloteOk = $true
      [void](Add-KjemoResultat -Categorie 'Pilote' -Controle 'Pilote deja installe' -Etat 'OK' -Valeur $piloteDistant -Commentaire 'Aucune installation de pilote ne sera necessaire.')
    } elseif ($KjemoArgPiloteAuto -ceq 'Oui') {
      $piloteOk = $true
      [void](Add-KjemoResultat -Categorie 'Pilote' -Controle 'Pilote absent, installation acceptee' -Etat 'ATTENTION' -Valeur $piloteDistant -Commentaire 'Tu as accepte que Windows installe le pilote propose par le serveur. N accepte que pour un serveur de confiance ; Windows peut quand meme refuser (strategie Point and Print).')
    } else {
      [void](Add-KjemoResultat -Categorie 'Pilote' -Controle 'Pilote absent' -Etat 'PROBLEME' -Valeur $piloteDistant -Commentaire 'REFUS : ce pilote n est pas installe ici et l installation automatique n est pas acceptee. Installe-le toi-meme, ou regenere le script en acceptant explicitement.')
    }
  }
}

$KjemoPeutAgir = ($serveurOk -and $libre -and $fichePresente -and $piloteOk)

if ($KjemoAgirDemande -and $KjemoPeutAgir) {
  try {
    Add-Printer -ConnectionName $KjemoArgUnc -ErrorAction Stop
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-Printer -ConnectionName' -Etat 'INFO' -Valeur 'commande acceptee' -Commentaire 'Acceptee ne veut pas dire effective : la relecture decide.')
    $script:KjemoAgi = $true
  } catch {
    $script:KjemoEcart = $true
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-Printer -ConnectionName' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message)))
  }
  $apres = Get-KjemoImprimanteExacte -Nom $KjemoArgUnc
  if ($apres.Etat -eq 'TROUVEE') {
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Connexion' -Etat 'OK' -Valeur ([string]$apres.Objet.Name + ' | etat declare ' + [string]$apres.Objet.PrinterStatus) -Commentaire 'La connexion apparait dans la liste de CE compte. Cela ne prouve pas qu une page s imprimera.')
  } else {
    $script:KjemoEcart = $true
    $script:KjemoAgi = $false
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Connexion' -Etat 'PROBLEME' -Valeur ([string]$apres.Etat) -Commentaire 'La relecture ne retrouve pas la connexion demandee.')
  }`,
      ...GARDE_PORTE_REFUS('la connexion'),
      `} else {
  [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Ce qui serait fait' -Etat 'INFO' -Valeur ('connecter ce compte a ' + $KjemoArgUnc) -Commentaire 'MODE DIAGNOSTIC : rien n est connecte. Add-Printer -ConnectionName n a pas de simulation (-WhatIf) fiable : il n est pas lance.')
}`,
    ].join('\n').split('\n');
  },
  conclusionAgi: 'Connexion creee pour ce compte ; la relecture la retrouve. Cela ne prouve PAS qu une page s imprimera : lance une impression reelle.',
  impression: {
    probleme: 'Un utilisateur doit imprimer sur une file partagée par le serveur d’impression, et on veut éviter qu’une connexion installe un pilote inconnu ou doublonne une connexion existante.',
    exemple: '\\\\srv-print\\Compta : le serveur répond, la file existe, son pilote est déjà installé sur le poste — la connexion est créée pour le compte de l’utilisateur, puis relue.',
    premiere: 'Lance le script dans la session de l’utilisateur concerné, SANS élévation, d’abord en mode Diagnostic.',
    lit: 'Un test SMB (TCP 445) vers le serveur, Get-Printer sur ce poste, Get-Printer -ComputerName sur le serveur et Get-PrinterDriver ici.',
    ecrit: 'En mode Appliquer seulement : une connexion à la file partagée, pour le compte qui lance le script (Add-Printer -ConnectionName).',
    effets: 'La file apparaît dans la liste des imprimantes de ce compte. Si tu as accepté l’installation de pilote, Windows peut installer le pilote du serveur. Aucune page n’est imprimée.',
    limites: [
      'La connexion est PROPRE AU COMPTE : lancée dans une console élevée, elle peut être créée pour le compte administrateur et pas pour l’utilisateur qui imprime.',
      'Add-Printer -ConnectionName n’a pas de simulation (-WhatIf) fiable : le mode Diagnostic décrit sans lancer.',
      'Sans acceptation explicite, un pilote absent ou inconnu est un refus : le script ne devine pas ce que le serveur installerait.',
      LIMITE_ETAT,
    ],
  },
  gui: [
    'Ouvre PowerShell dans la session de l’utilisateur concerné, sans élévation.',
    'Vérifie le serveur : « Test-NetConnection <serveur> -Port 445 ».',
    'Vérifie la file et son pilote : « Get-Printer -ComputerName <serveur> | Select-Object Name, ShareName, DriverName ».',
    'Compare aux pilotes installés ici : « Get-PrinterDriver | Select-Object Name ».',
    'Connecte : « Add-Printer -ConnectionName \\\\serveur\\partage ».',
    'Relis : « Get-Printer | Where-Object Name -eq "\\\\serveur\\partage" ». Puis imprime une page réelle.',
  ],
  keywords: ['partage', 'unc', 'connexion', 'add-printer', 'connectionname', 'serveur d impression', 'point and print', 'windows'],
  prereqs: ['La session du compte qui imprimera, SANS élévation.'],
  reversible: true,
  rollback: {
    summary: 'Supprimer la connexion de ce compte à la file partagée. Elle ne supprime ni la file ni le pilote du serveur, mais peut laisser un pilote installé sur ce poste. Ce script ne le fait JAMAIS lui-même.',
    diagnostic: 'Get-Printer | Where-Object Name -like "\\\\*" | Select-Object Name, DriverName',
    command: '# A lancer toi-meme, dans la session du meme compte :\nRemove-Printer -Name "\\\\srv-print\\Compta" -Confirm',
    warning: 'Le pilote éventuellement installé par la connexion reste sur le poste : le retirer est une autre décision, qui peut affecter d’autres imprimantes.',
  },
  checks: [
    'Mode Diagnostic par défaut ; Appliquer exige la phrase « CONNECTER <chemin UNC> », vérifiée de nouveau par le script.',
    'Le serveur doit répondre en SMB et la file y exister, de façon unique, sinon refus.',
    'Une connexion déjà existante pour ce compte est un refus : rien n’est remplacé.',
    'Un pilote non installé est un refus, sauf acceptation explicite et visible dans le formulaire ; un pilote inconnu (serveur illisible) l’est aussi.',
    'Une console élevée est signalée : la connexion serait créée pour le mauvais compte.',
    'La connexion est RELUE après l’action ; un écart donne la conclusion ECART.',
  ],
  verifyAfter: [
    '« Get-Printer | Where-Object Name -eq "\\\\serveur\\partage" » rend la connexion, dans la session du bon compte.',
    'Le rapport contient une ligne « Relecture » issue de Get-Printer, pas du code de retour.',
    'Seul un travail d’impression réel prouve que la file imprime.',
  ],
  source: SRC.addPrinter.url,
  sources: [SRC.addPrinter, SRC.getPrinter, SRC.getDriver],
});

// ===========================================================================
// 8. IMPRIMANTE PAR DÉFAUT
// ===========================================================================

export const impWinDefaut = outilImpression({
  id: 'imp-win-defaut',
  famille: 'Configuration Windows',
  title: 'Définir l’imprimante par défaut du compte courant',
  summary: 'Définit l’imprimante par défaut du compte qui lance le script (méthode SetDefaultPrinter de Win32_Printer). Lit d’abord l’imprimante par défaut actuelle et le réglage « Windows gère l’imprimante par défaut », qui peut la changer à nouveau. Relit l’état après.',
  action: true,
  admin: false,
  champs: [champNomImprimante(undefined, 'HP LaserJet Accueil')],
  verifier(v, errors) {
    verifierChamp(errors, 'impNom', validerNomImprimante(v.impNom));
  },
  phrase(v) {
    return `DEFINIR ${validerNomImprimante(v.impNom).value} PAR DEFAUT`;
  },
  phraseAide: 'DEFINIR <nom de l’imprimante> PAR DEFAUT',
  parametres(v) {
    return [['Imprimante', psB64(validerNomImprimante(v.impNom).value)]];
  },
  commandes: { obligatoires: ['Get-Printer', 'Get-CimInstance', 'Invoke-CimMethod'], facultatives: ['Get-ItemProperty'] },
  prefixe: 'kjemo-imprimante-defaut',
  corps() {
    return `$res = Get-KjemoImprimanteExacte -Nom $KjemoArgImprimante
$cibleOk = Add-KjemoCibleImprimante -Resolution $res -Nom $KjemoArgImprimante

$script:CimListe = @()
$luCim = Invoke-KjemoLecture 'Defaut' 'Win32_Printer' { $script:CimListe = @(Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop) }
$instance = $null
$avant = '(aucune)'
$dejaDefaut = $false
if ($luCim) {
  foreach ($c in $script:CimListe) {
    if ($c.Default -eq $true) { $avant = [string]$c.Name }
    if ($cibleOk -and [string]$c.Name -ieq [string]$res.Objet.Name) { $instance = $c }
  }
  [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Imprimante par defaut actuelle' -Etat 'INFO' -Valeur $avant -Commentaire 'Valeur de depart, a reprendre pour revenir en arriere.')
  if ($null -ne $instance -and $instance.Default -eq $true) { $dejaDefaut = $true }
  if ($cibleOk -and $null -eq $instance) {
    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Objet Win32_Printer' -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'REFUS : l imprimante est vue par Get-Printer mais pas par Win32_Printer.')
  }
  if ($dejaDefaut) {
    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Deja par defaut' -Etat 'PROBLEME' -Valeur ([string]$res.Objet.Name) -Commentaire 'Cette imprimante est deja celle par defaut de ce compte : il n y a rien a faire.')
  }
}

$null = Invoke-KjemoLecture 'Reglage' 'Windows gere l imprimante par defaut' {
  $mode = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name 'LegacyDefaultPrinterMode' -ErrorAction Stop
  if ([int]$mode.LegacyDefaultPrinterMode -eq 1) {
    [void](Add-KjemoResultat -Categorie 'Reglage' -Controle 'Gestion par Windows' -Etat 'OK' -Valeur 'desactivee' -Commentaire 'Le choix de l utilisateur est conserve par Windows.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Reglage' -Controle 'Gestion par Windows' -Etat 'ATTENTION' -Valeur 'activee' -Commentaire 'Windows gere l imprimante par defaut (derniere utilisee) : il peut remplacer ton choix. Desactive « Laisser Windows gerer mon imprimante par defaut » dans Parametres > Imprimantes et scanners.')
  }
}
[void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Portee' -Etat 'INFO' -Valeur (Get-KjemoCompte) -Commentaire 'L imprimante par defaut est PROPRE A CE COMPTE. Lance le script dans la session du compte concerne.')

$KjemoPeutAgir = ($cibleOk -and ($null -ne $instance) -and -not $dejaDefaut)

if ($KjemoAgirDemande -and $KjemoPeutAgir) {
  try {
    $r = Invoke-CimMethod -InputObject $instance -MethodName 'SetDefaultPrinter' -ErrorAction Stop
    $code = [int]$r.ReturnValue
    if ($code -eq 0) {
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'SetDefaultPrinter' -Etat 'INFO' -Valeur 'code 0' -Commentaire 'Commande acceptee ; la relecture decide.')
      $script:KjemoAgi = $true
    } else {
      $script:KjemoEcart = $true
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'SetDefaultPrinter' -Etat 'PROBLEME' -Valeur ('code ' + [string]$code) -Commentaire 'Windows a refuse de definir cette imprimante par defaut.')
    }
  } catch {
    $script:KjemoEcart = $true
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'SetDefaultPrinter' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message)))
  }
  $apresDefaut = '(aucune)'
  $luApres = Invoke-KjemoLecture 'Relecture' 'Win32_Printer' { foreach ($c in @(Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop)) { if ($c.Default -eq $true) { $script:ApresDefaut = [string]$c.Name } } }
  if ($luApres -and [string]$script:ApresDefaut -ieq [string]$res.Objet.Name) {
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Imprimante par defaut' -Etat 'OK' -Valeur ([string]$script:ApresDefaut) -Commentaire ('Relue apres l action. Valeur precedente : ' + $avant))
  } else {
    $script:KjemoEcart = $true
    $script:KjemoAgi = $false
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Imprimante par defaut' -Etat 'PROBLEME' -Valeur ([string]$script:ApresDefaut) -Commentaire 'La relecture ne montre pas l imprimante demandee comme imprimante par defaut.')
  }
${GARDE_PORTE_REFUS('le changement').join('\n')}
} else {
  [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Ce qui serait fait' -Etat 'INFO' -Valeur ('definir ' + $KjemoArgImprimante + ' par defaut pour ' + (Get-KjemoCompte)) -Commentaire 'MODE DIAGNOSTIC : rien n est modifie. SetDefaultPrinter n a pas de simulation native : il n est pas lance.')
}`.split('\n');
  },
  conclusionAgi: 'Imprimante par defaut modifiee ; la relecture la montre comme imprimante par defaut de ce compte. Windows peut la changer a nouveau si la gestion automatique est activee.',
  impression: {
    probleme: 'Un utilisateur imprime sur la mauvaise imprimante parce que la « par défaut » n’est pas la bonne.',
    exemple: 'Le compte de la secrétaire a « PDF » par défaut : on définit « HP LaserJet Accueil », puis on vérifie que Windows ne la remplace pas à la prochaine impression.',
    premiere: 'Lance le script dans la session du compte concerné et regarde la ligne « Gestion par Windows » : si elle est activée, ton choix peut être écrasé.',
    lit: 'Get-Printer, la classe Win32_Printer (imprimante par défaut actuelle) et la valeur de registre LegacyDefaultPrinterMode du compte courant.',
    ecrit: 'En mode Appliquer seulement : l’imprimante par défaut du compte courant (SetDefaultPrinter).',
    effets: 'Seul le compte qui lance le script est concerné. Aucune imprimante, aucun port, aucun pilote n’est créé ou supprimé.',
    limites: [
      'L’imprimante par défaut est propre au compte : les autres utilisateurs du poste ne sont pas touchés.',
      'Si Windows gère l’imprimante par défaut, il peut la changer à la prochaine impression.',
      'SetDefaultPrinter n’a pas de simulation native : le mode Diagnostic décrit sans lancer.',
    ],
  },
  gui: [
    'Ouvre PowerShell dans la session du compte concerné.',
    'Regarde l’actuelle : « Get-CimInstance Win32_Printer | Where-Object Default | Select-Object Name ».',
    'Définis la nouvelle : Paramètres > Bluetooth et appareils > Imprimantes et scanners > l’imprimante > « Définir par défaut ».',
    'Désactive « Laisser Windows gérer mon imprimante par défaut » si elle est activée.',
    'Relis la nouvelle valeur avec la même commande.',
  ],
  keywords: ['imprimante par defaut', 'defaut', 'default printer', 'setdefaultprinter', 'win32_printer', 'windows'],
  reversible: true,
  rollback: {
    summary: 'Redéfinir comme imprimante par défaut celle qui l’était avant : son nom est dans le rapport (ligne « Avant »).',
    diagnostic: 'Get-CimInstance Win32_Printer | Where-Object Default | Select-Object Name',
    command: '# Remets l ancienne imprimante par defaut (nom releve dans le rapport) :\n$p = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq "PDF" }\nInvoke-CimMethod -InputObject $p -MethodName SetDefaultPrinter',
    warning: 'Si Windows gère l’imprimante par défaut, il peut changer de nouveau ce réglage de lui-même.',
  },
  checks: [
    'Mode Diagnostic par défaut ; Appliquer exige la phrase « DEFINIR <nom> PAR DEFAUT », vérifiée de nouveau par le script.',
    'La cible est comparée par égalité de nom, sans joker ; zéro ou plusieurs correspondances sont un refus.',
    'L’imprimante par défaut ACTUELLE est relevée avant, pour pouvoir revenir en arrière.',
    'Le réglage « Windows gère l’imprimante par défaut » est lu et signalé.',
    'L’état est RELU après l’action ; un écart donne la conclusion ECART.',
  ],
  verifyAfter: [
    '« Get-CimInstance Win32_Printer | Where-Object Default » rend la nouvelle imprimante.',
    'Le rapport contient les lignes « Avant » et « Relecture » (valeur précédente et valeur relue).',
  ],
  source: SRC.win32Printer.url,
  sources: [SRC.win32Printer, SRC.getCim, SRC.invokeCim, SRC.getPrinter],
});

// ===========================================================================
// 9. PAGE DE TEST
// ===========================================================================

export const impWinPageTest = outilImpression({
  id: 'imp-win-page-test',
  famille: 'Configuration Windows',
  title: 'Imprimer une page de test Windows',
  summary: 'Demande à Windows d’imprimer sa page de test sur UNE file nommée (méthode PrintTestPage de Win32_Printer). Action explicite : elle CONSOMME du papier et de l’encre ou du toner. Refuse si la file est hors ligne, et ne conclut jamais « imprimé » : Windows ne confirme que l’acceptation de la demande.',
  action: true,
  admin: false,
  champs: [champNomImprimante(undefined, 'HP LaserJet Accueil')],
  verifier(v, errors) {
    verifierChamp(errors, 'impNom', validerNomImprimante(v.impNom));
  },
  phrase(v) {
    return `IMPRIMER UNE PAGE DE TEST SUR ${validerNomImprimante(v.impNom).value}`;
  },
  phraseAide: 'IMPRIMER UNE PAGE DE TEST SUR <nom de l’imprimante>',
  aideMode: 'Diagnostic ne lance aucune impression. Appliquer lance la page de test : elle consomme du papier et de l’encre ou du toner.',
  parametres(v) {
    return [['Imprimante', psB64(validerNomImprimante(v.impNom).value)]];
  },
  commandes: { obligatoires: ['Get-Printer', 'Get-CimInstance', 'Invoke-CimMethod'], facultatives: ['Get-PrintJob'] },
  prefixe: 'kjemo-imprimante-page-test',
  corps() {
    return `[void](Add-KjemoResultat -Categorie 'Consommation' -Controle 'Papier et encre' -Etat 'ATTENTION' -Valeur 'une page' -Commentaire 'Cette action IMPRIME une page : papier et encre ou toner seront consommes. Prevois du papier dans le bac et verifie que la bonne imprimante est visee.')
$res = Get-KjemoImprimanteExacte -Nom $KjemoArgImprimante
$cibleOk = Add-KjemoCibleImprimante -Resolution $res -Nom $KjemoArgImprimante

$instance = $null
$horsLigne = $false
if ($cibleOk) {
  $statut = [string]$res.Objet.PrinterStatus
  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Etat declare' -Etat 'INFO' -Valeur $statut -Commentaire 'Etat declare par Windows : il ne dit pas si l imprimante est reellement prete.')
  if ($statut -match '(?i)offline') { $horsLigne = $true }
  $script:CimListe = @()
  $luCim = Invoke-KjemoLecture 'Cible' 'Win32_Printer' { $script:CimListe = @(Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop) }
  if ($luCim) {
    foreach ($c in $script:CimListe) {
      if ([string]$c.Name -ieq [string]$res.Objet.Name) { $instance = $c; if ($c.WorkOffline -eq $true) { $horsLigne = $true } }
    }
  }
  if ($horsLigne) {
    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Hors ligne' -Etat 'PROBLEME' -Valeur 'oui' -Commentaire 'REFUS : la file est declaree hors ligne. La page resterait en attente et sortirait peut-etre plus tard, a un moment inattendu. Remets la file en ligne ou diagnostique-la d abord.')
  }
  if ($null -eq $instance) {
    [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Objet Win32_Printer' -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'REFUS : l imprimante est vue par Get-Printer mais pas par Win32_Printer.')
  }
}
$script:TravauxAvant = -1
$luAvant = Invoke-KjemoLecture 'Avant' 'Get-PrintJob' { $script:TravauxAvant = @(Get-PrintJob -PrinterName ([string]$res.Objet.Name) -ErrorAction Stop).Count }
if ($luAvant) { [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Travaux en file' -Etat 'INFO' -Valeur ([string]$script:TravauxAvant)) }

$KjemoPeutAgir = ($cibleOk -and ($null -ne $instance) -and -not $horsLigne)

if ($KjemoAgirDemande -and $KjemoPeutAgir) {
  try {
    $r = Invoke-CimMethod -InputObject $instance -MethodName 'PrintTestPage' -ErrorAction Stop
    $code = [int]$r.ReturnValue
    if ($code -eq 0) {
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'PrintTestPage' -Etat 'INFO' -Valeur 'code 0 : demande acceptee' -Commentaire 'Windows a ACCEPTE la demande. Il ne confirme pas que la page est sortie.')
      $script:KjemoAgi = $true
    } else {
      $script:KjemoEcart = $true
      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'PrintTestPage' -Etat 'PROBLEME' -Valeur ('code ' + [string]$code) -Commentaire 'Windows a refuse la demande de page de test (le code 5 signifie un acces refuse).')
    }
  } catch {
    $script:KjemoEcart = $true
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'PrintTestPage' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message)))
  }
  Start-Sleep -Seconds 2
  $script:TravauxApres = -1
  $luApres = Invoke-KjemoLecture 'Apres' 'Get-PrintJob' { $script:TravauxApres = @(Get-PrintJob -PrinterName ([string]$res.Objet.Name) -ErrorAction Stop).Count }
  if ($luApres) { [void](Add-KjemoResultat -Categorie 'Apres' -Controle 'Travaux en file' -Etat 'INFO' -Valeur ([string]$script:TravauxApres) -Commentaire 'Information seulement : un travail deja sorti ne figure plus dans la file. Seul le papier dans le bac prouve que la page est sortie.') }
  [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'A faire par toi' -Etat 'ATTENTION' -Valeur 'regarde le bac de sortie' -Commentaire 'Windows ne confirme pas la sortie papier. Va voir l imprimante.')
${GARDE_PORTE_REFUS('l impression').join('\n')}
} else {
  [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Ce qui serait fait' -Etat 'INFO' -Valeur ('imprimer une page de test sur ' + $KjemoArgImprimante) -Commentaire 'MODE DIAGNOSTIC : rien n est imprime. PrintTestPage n a pas de simulation native : il n est pas lance.')
}`.split('\n');
  },
  conclusionAgi: 'Page de test DEMANDEE a Windows (code 0). Windows ne confirme pas la sortie papier : va regarder l imprimante.',
  impression: {
    probleme: 'Tu veux vérifier qu’une file imprime vraiment, après une configuration ou une réparation.',
    exemple: 'Après avoir créé « HP LaserJet Accueil », tu lances la page de test : Windows accepte la demande, et tu vas vérifier au bac de sortie que la page est bien sortie.',
    premiere: 'Vérifie qu’il y a du papier et que la file n’est pas hors ligne, puis lance en mode Diagnostic pour voir la cible exacte.',
    lit: 'Get-Printer, la classe Win32_Printer (état hors ligne) et le nombre de travaux en file avant et après.',
    ecrit: 'En mode Appliquer seulement : une page de test est envoyée à l’imprimante (PrintTestPage).',
    effets: 'CONSOMME une feuille de papier et de l’encre ou du toner. Rien n’est installé ni supprimé.',
    limites: [
      'Windows ne confirme que l’ACCEPTATION de la demande (code 0) : il ne dit pas que la page est sortie. Seul le bac de sortie le prouve.',
      'Une file hors ligne est refusée : la page sortirait plus tard, à un moment inattendu.',
      'PrintTestPage n’a pas de simulation native : le mode Diagnostic décrit sans lancer.',
    ],
  },
  gui: [
    'Vérifie le papier dans le bac et que l’imprimante est allumée et en ligne.',
    'Ouvre Paramètres > Imprimantes et scanners > l’imprimante > Propriétés de l’imprimante > « Imprimer une page de test ».',
    'Va regarder le bac de sortie : c’est la seule vraie preuve.',
  ],
  keywords: ['page de test', 'test', 'printtestpage', 'imprimer', 'verification', 'win32_printer', 'windows'],
  reversible: false,
  rollback: {
    summary: 'Une page imprimée ne se « dé-imprime » pas : le papier et l’encre sont consommés. Seul un travail encore en file peut être annulé.',
    diagnostic: 'Get-PrintJob -PrinterName "HP LaserJet Accueil"',
    command: '# Si la page est encore en file (imprimante lente ou hors ligne) :\nRemove-PrintJob -PrinterName "HP LaserJet Accueil" -ID 12 -Confirm',
    warning: 'Ce rollback ne concerne que la file d’attente. Une page sortie ne peut pas être annulée.',
  },
  checks: [
    'Mode Diagnostic par défaut ; Appliquer exige la phrase « IMPRIMER UNE PAGE DE TEST SUR <nom> », vérifiée de nouveau par le script.',
    'La consommation de papier et d’encre est annoncée dans le rapport, avant l’action.',
    'Une file hors ligne est un refus.',
    'Le code de retour est présenté comme « demande acceptée », jamais comme « imprimé » ; le rapport demande de vérifier le bac de sortie.',
  ],
  verifyAfter: [
    'La page est physiquement sortie dans le bac de l’imprimante visée.',
    'Le rapport contient « demande acceptée » et la consigne de vérifier au bac, jamais « imprimé ».',
  ],
  source: SRC.win32Printer.url,
  sources: [SRC.win32Printer, SRC.invokeCim, SRC.getPrinter, SRC.getJob],
});

// ===========================================================================
// 10. ANNULER UN TRAVAIL PRÉCIS
// ===========================================================================

export const impWinAnnulerTravail = outilImpression({
  id: 'imp-win-annuler-travail',
  famille: 'Déblocage ciblé Windows',
  title: 'Annuler UN travail d’impression identifié',
  summary: 'Annule un seul travail, désigné par sa file et son identifiant, après avoir lu ses caractéristiques. Refuse si le travail n’existe plus ou si la file est ambiguë. N’annule jamais « tous les travaux », ne vide pas le dossier de spool, et relit la file pour vérifier la disparition du travail.',
  action: true,
  admin: false,
  champs: [
    champNomImprimante(undefined, 'HP LaserJet Accueil'),
    { id: 'impJob', label: 'Identifiant du travail', type: 'number', default: '1', min: 1, max: 2147483647, help: 'L’ID affiché par « Get-PrintJob -PrinterName "<file>" » ou par l’assistant de diagnostic de file.' },
  ],
  verifier(v, errors) {
    verifierChamp(errors, 'impNom', validerNomImprimante(v.impNom));
    verifierChamp(errors, 'impJob', validerIdTravail(v.impJob));
  },
  phrase(v) {
    return `ANNULER LE TRAVAIL ${validerIdTravail(v.impJob).value} DE ${validerNomImprimante(v.impNom).value}`;
  },
  phraseAide: 'ANNULER LE TRAVAIL <identifiant> DE <nom de la file>',
  aideMode: 'Diagnostic lit le travail et simule l’annulation (-WhatIf). Appliquer annule CE travail.',
  parametres(v) {
    return [['Imprimante', psB64(validerNomImprimante(v.impNom).value)], ['Travail', `[int]${psB64(String(validerIdTravail(v.impJob).value))}`]];
  },
  commandes: { obligatoires: ['Get-Printer', 'Get-PrintJob', 'Remove-PrintJob'], facultatives: [] },
  prefixe: 'kjemo-travail-annule',
  corps() {
    return `$res = Get-KjemoImprimanteExacte -Nom $KjemoArgImprimante
$cibleOk = Add-KjemoCibleImprimante -Resolution $res -Nom $KjemoArgImprimante

# --- Lecture AVANT : le travail existe-t-il, et quel est-il ? ---
$travailOk = $false
$script:Travaux = @()
if ($cibleOk) {
  $lu = Invoke-KjemoLecture 'Travail' 'Get-PrintJob' { $script:Travaux = @(Get-PrintJob -PrinterName ([string]$res.Objet.Name) -ErrorAction Stop) }
  if ($lu) {
    $t = @($script:Travaux | Where-Object { [int]$_.ID -eq $KjemoArgTravail })
    if ($t.Count -eq 1) {
      $travailOk = $true
      $j = $t[0]
      [void](Add-KjemoResultat -Categorie 'Travail' -Controle ('Travail ' + [string]$KjemoArgTravail) -Etat 'INFO' -Valeur ('etat ' + [string]$j.JobStatus + ' | utilisateur ' + [string]$j.UserName + ' | taille ' + [string]$j.Size + ' o | soumis ' + [string]$j.SubmittedTime) -Commentaire 'Le nom du document n est pas affiche : il peut etre confidentiel.')
      $moi = Get-KjemoCompte
      $moiCourt = $moi.Split([char]92)[-1]
      if ([string]$j.UserName -ine $moiCourt) {
        [void](Add-KjemoResultat -Categorie 'Travail' -Controle 'Proprietaire' -Etat 'ATTENTION' -Valeur ([string]$j.UserName) -Commentaire 'Ce travail appartient a un AUTRE utilisateur. Verifie que tu dois bien l annuler ; il faut le droit de gerer les documents.')
      }
      if ([string]$j.JobStatus -match '(?i)printing') {
        [void](Add-KjemoResultat -Categorie 'Travail' -Controle 'En cours d impression' -Etat 'ATTENTION' -Valeur 'oui' -Commentaire 'Des pages sont peut-etre deja sorties. L annuler peut laisser l imprimante au milieu d une page.')
      }
    } elseif ($t.Count -eq 0) {
      [void](Add-KjemoResultat -Categorie 'Travail' -Controle ('Travail ' + [string]$KjemoArgTravail) -Etat 'PROBLEME' -Valeur 'introuvable' -Commentaire 'REFUS : aucun travail de cet identifiant dans cette file. Il est peut-etre deja imprime, annule ou deplace. Relis la file.')
    } else {
      [void](Add-KjemoResultat -Categorie 'Travail' -Controle ('Travail ' + [string]$KjemoArgTravail) -Etat 'PROBLEME' -Valeur ([string]$t.Count + ' correspondances') -Commentaire 'REFUS : identifiant ambigu.')
    }
  }
}

$KjemoPeutAgir = ($cibleOk -and $travailOk)

if ($KjemoAgirDemande -and $KjemoPeutAgir) {
  try {
    Remove-PrintJob -PrinterName ([string]$res.Objet.Name) -ID $KjemoArgTravail -ErrorAction Stop
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Remove-PrintJob' -Etat 'INFO' -Valeur 'commande acceptee' -Commentaire 'Acceptee ne veut pas dire effective : la relecture decide.')
  } catch {
    $script:KjemoEcart = $true
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Remove-PrintJob' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message)))
  }
  # --- Relecture : on attend jusqu a 6 secondes que le travail disparaisse ---
  $disparu = $false
  $dernier = ''
  for ($i = 0; $i -lt 6 -and -not $disparu; $i++) {
    Start-Sleep -Seconds 1
    try {
      $reste = @(Get-PrintJob -PrinterName ([string]$res.Objet.Name) -ErrorAction Stop | Where-Object { [int]$_.ID -eq $KjemoArgTravail })
      if ($reste.Count -eq 0) { $disparu = $true } else { $dernier = [string]$reste[0].JobStatus }
    } catch {
      $dernier = 'lecture impossible'
      break
    }
  }
  if ($disparu) {
    $script:KjemoAgi = (-not $script:KjemoEcart)
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle ('Travail ' + [string]$KjemoArgTravail) -Etat 'OK' -Valeur 'absent de la file' -Commentaire 'Le travail n apparait plus dans la file apres l action. Les autres travaux n ont pas ete touches.')
  } else {
    $script:KjemoEcart = $true
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle ('Travail ' + [string]$KjemoArgTravail) -Etat 'PROBLEME' -Valeur ('toujours present : ' + $dernier) -Commentaire 'Le travail est encore dans la file (etat Deleting, travail coince ou lecture impossible). Ne le considere PAS comme annule.')
  }
${GARDE_PORTE_REFUS('l annulation').join('\n')}
} else {
  [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Ce qui serait fait' -Etat 'INFO' -Valeur ('annuler le travail ' + [string]$KjemoArgTravail + ' de ' + $KjemoArgImprimante) -Commentaire 'MODE DIAGNOSTIC : rien n est annule.')
  if ($cibleOk -and $travailOk) {
    try { Remove-PrintJob -PrinterName ([string]$res.Objet.Name) -ID $KjemoArgTravail -WhatIf -ErrorAction Stop }
    catch { [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Remove-PrintJob -WhatIf' -Etat 'ATTENTION' -Valeur 'simulation impossible' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message))) }
  }
}`.split('\n');
  },
  conclusionAgi: 'Le travail designe a ete annule ; la relecture ne le retrouve plus dans la file. Les autres travaux n ont pas ete touches. Cela ne dit pas que la file imprimera le suivant : essaie une impression reelle.',
  impression: {
    probleme: 'Un travail coincé bloque toute la file : les suivants attendent derrière lui.',
    exemple: 'Le travail 12 de « HP LaserJet Accueil » est en « Error » depuis une heure. Tu l’annules, lui seul, et tu relis la file pour vérifier qu’il a disparu et que les autres sont intacts.',
    premiere: 'Repère l’identifiant avec l’assistant de diagnostic de file, puis lance celui-ci en mode Diagnostic : il montre le travail et simule l’annulation.',
    lit: 'Get-Printer, puis Get-PrintJob de la file ciblée. Le nom du document n’est pas affiché.',
    ecrit: 'En mode Appliquer seulement : Remove-PrintJob sur CE travail de CETTE file. Rien d’autre.',
    effets: 'Un seul travail disparaît de la file. Les autres travaux, la file, le port, le pilote et le dossier de spool ne sont pas touchés. L’annulation est définitive : le document devra être renvoyé.',
    limites: [
      'Un seul travail à la fois. Aucun « tout annuler », aucune purge du dossier de spool.',
      'Un travail déjà en cours d’impression peut laisser l’imprimante au milieu d’une page.',
      'Annuler le travail d’un autre utilisateur demande le droit de gérer les documents.',
      'Si le travail reste en état « Deleting », il est coincé : le script le dit (ECART) ; la suite est une décision humaine, par exemple le redémarrage du spouleur.',
    ],
  },
  gui: [
    'Liste les travaux de la file : « Get-PrintJob -PrinterName "<file>" ».',
    'Repère l’identifiant et vérifie l’état, l’utilisateur et la taille.',
    'Simule : « Remove-PrintJob -PrinterName "<file>" -ID <id> -WhatIf ».',
    'Annule CE travail : « Remove-PrintJob -PrinterName "<file>" -ID <id> ».',
    'Relis : « Get-PrintJob -PrinterName "<file>" ».',
  ],
  keywords: ['annuler', 'travail', 'job', 'remove-printjob', 'bloque', 'file d attente', 'coince', 'windows'],
  reversible: false,
  rollback: {
    summary: 'Un travail annulé ne se récupère pas : il faut renvoyer le document depuis l’application.',
    diagnostic: 'Get-PrintJob -PrinterName "HP LaserJet Accueil"',
    command: "Write-Host 'Un travail annule ne se restaure pas : renvoie le document depuis l application.'",
    warning: 'Aucune commande ne restaure un travail supprimé. Vérifie l’identifiant avant de lancer en mode Appliquer.',
  },
  checks: [
    'Mode Diagnostic par défaut ; Appliquer exige la phrase « ANNULER LE TRAVAIL <id> DE <file> », vérifiée de nouveau par le script.',
    'Le travail est LU avant : s’il n’existe pas, ou si l’identifiant est ambigu, refus.',
    'Un seul travail est visé : Remove-PrintJob reçoit la file ET l’identifiant, jamais un joker ni la liste entière.',
    'Le propriétaire différent et le travail en cours d’impression sont signalés avant l’action.',
    'Remove-PrintJob est simulé par -WhatIf en mode Diagnostic (cmdlet qui le prend en charge).',
    'La file est RELUE après l’action : le travail doit avoir disparu, sinon ECART.',
  ],
  verifyAfter: [
    '« Get-PrintJob -PrinterName "<file>" » ne liste plus le travail annulé.',
    'Les autres travaux de la file sont toujours là.',
    'Le rapport contient une ligne « Relecture » issue de Get-PrintJob.',
  ],
  source: SRC.removeJob.url,
  sources: [SRC.removeJob, SRC.getJob, SRC.getPrinter],
});

// ===========================================================================
// 11. REDÉMARRER LE SPOULEUR
// ===========================================================================

export const impWinSpouleurRedemarrer = outilImpression({
  id: 'imp-win-spouleur-redemarrer',
  famille: 'Déblocage ciblé Windows',
  title: 'Redémarrer le spouleur d’impression',
  summary: 'Redémarre le service Spooler de CETTE machine, après avoir chiffré ce que le redémarrage interrompt (files, files partagées, travaux d’autres utilisateurs). Exige que le nom de machine saisi soit celui de la machine, une console élevée et une phrase exacte. Ne vide pas le dossier de spool, ne supprime rien, et relit le service et les files après.',
  action: true,
  admin: true,
  champs: [
    {
      id: 'impMachine', label: 'Nom de CETTE machine (garde)', type: 'text', default: 'PC-ACCUEIL-01',
      help: 'Le nom NetBIOS de la machine où le script sera lancé. S’il ne correspond pas, le script refuse : il évite de redémarrer le spouleur du mauvais serveur.',
    },
  ],
  verifier(v, errors) {
    const m = validerMachine(v.impMachine);
    if (!m.ok) errors.impMachine = m.error;
  },
  phrase(v) {
    const m = validerMachine(v.impMachine);
    return `REDEMARRER LE SPOULEUR DE ${m.ok ? m.value.toUpperCase() : String(v.impMachine ?? '').trim()}`;
  },
  phraseAide: 'REDEMARRER LE SPOULEUR DE <NOM DE LA MACHINE EN MAJUSCULES>',
  aideMode: 'Diagnostic chiffre l’impact et simule le redémarrage (-WhatIf). Appliquer redémarre le service.',
  parametres(v) {
    const m = validerMachine(v.impMachine);
    return [['Machine', psB64(m.ok ? m.value : '')]];
  },
  commandes: { obligatoires: ['Get-Service', 'Restart-Service', 'Get-Printer'], facultatives: ['Get-PrintJob'] },
  prefixe: 'kjemo-spouleur-redemarrage',
  corps() {
    return `# --- 1. Droits et machine : la garde "bonne machine" ---
$adminOk = $KjemoAdmin
if (-not $adminOk) {
  [void](Add-KjemoResultat -Categorie 'Droits' -Controle 'Console elevee' -Etat 'PROBLEME' -Valeur 'non' -Commentaire 'Redemarrer un service exige une console PowerShell lancee en administrateur.')
}
$reelle = [Environment]::MachineName
$machineOk = [string]::Equals($reelle, $KjemoArgMachine, [System.StringComparison]::OrdinalIgnoreCase)
if ($machineOk) {
  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Machine' -Etat 'OK' -Valeur $reelle -Commentaire 'Le nom saisi correspond a la machine ou le script tourne.')
} else {
  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Machine' -Etat 'PROBLEME' -Valeur ('ici = ' + $reelle + ' / attendu = ' + $KjemoArgMachine) -Commentaire 'REFUS : ce n est pas la machine visee. Le script ne redemarre pas le spouleur d une autre machine.')
}

# --- 2. Etat du service : seuls Running et Stopped sont stables ---
$serviceOk = $false
$etatAvant = ''
$script:Svc = $null
$luS = Invoke-KjemoLecture 'Spouleur' 'Get-Service' { $script:Svc = Get-Service -Name 'Spooler' -ErrorAction Stop }
if ($luS -and $null -ne $script:Svc) {
  $etatAvant = [string]$script:Svc.Status
  if ($etatAvant -eq 'Running' -or $etatAvant -eq 'Stopped') {
    $serviceOk = $true
    [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Etat du service' -Etat 'INFO' -Valeur $etatAvant -Commentaire 'Etat stable. Un spouleur arrete sera simplement demarre.')
  } else {
    [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Etat du service' -Etat 'PROBLEME' -Valeur $etatAvant -Commentaire 'REFUS : le service est dans un etat de transition ou suspendu. Attends qu il se stabilise, puis relance.')
  }
  $dep = @($script:Svc.DependentServices | Where-Object { [string]$_.Status -eq 'Running' })
  if ($dep.Count -gt 0) {
    [void](Add-KjemoResultat -Categorie 'Impact' -Controle 'Services dependants en cours' -Etat 'ATTENTION' -Valeur (($dep | ForEach-Object { [string]$_.Name }) -join ', ') -Commentaire 'Ils dependent du spouleur. Restart-Service refusera de les arreter sans option de forcage, et ce script n en utilise aucune.')
  }
}

# --- 3. Impact : ce que le redemarrage interrompt ---
$script:Files = @()
$nbAvant = -1
$travauxAvant = -1
$luF = Invoke-KjemoLecture 'Impact' 'Get-Printer' { $script:Files = @(Get-Printer -ErrorAction Stop) }
if ($luF) {
  $nbAvant = $script:Files.Count
  $partagees = @($script:Files | Where-Object { $_.Shared -eq $true })
  $e = 'INFO'
  if ($partagees.Count -gt 0) { $e = 'ATTENTION' }
  [void](Add-KjemoResultat -Categorie 'Impact' -Controle 'Files gerees' -Etat $e -Valeur ([string]$nbAvant + ' file(s), dont ' + [string]$partagees.Count + ' partagee(s)') -Commentaire 'Toutes les files de CETTE machine sont interrompues, pas seulement celle en panne. Les clients des files partagees perdent leur connexion le temps du redemarrage.')
  $total = 0
  $autres = 0
  $moiCourt = (Get-KjemoCompte).Split([char]92)[-1]
  foreach ($f in $script:Files) {
    try {
      $tr = @(Get-PrintJob -PrinterName ([string]$f.Name) -ErrorAction Stop)
      $total = $total + $tr.Count
      $autres = $autres + @($tr | Where-Object { [string]$_.UserName -ine $moiCourt }).Count
    } catch { }
  }
  $travauxAvant = $total
  $e2 = 'INFO'
  if ($autres -gt 0) { $e2 = 'ATTENTION' }
  [void](Add-KjemoResultat -Categorie 'Impact' -Controle 'Travaux en attente' -Etat $e2 -Valeur ([string]$total + ' travail(aux), dont ' + [string]$autres + ' d autres utilisateurs') -Commentaire 'Les travaux en attente sont en general conserves dans le dossier de spool ; un travail en cours de transmission peut etre relance ou perdu. Previens les utilisateurs concernes.')
}
[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Ce que le script ne fait pas' -Etat 'INFO' -Valeur 'pas de purge' -Commentaire 'Le dossier de spool n est ni vide ni modifie. Aucune imprimante, aucun port, aucun pilote n est supprime.')

$KjemoPeutAgir = ($adminOk -and $machineOk -and $serviceOk -and ($nbAvant -ge 0))

if ($KjemoAgirDemande -and $KjemoPeutAgir) {
  try {
    Restart-Service -Name 'Spooler' -ErrorAction Stop
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Restart-Service Spooler' -Etat 'INFO' -Valeur 'commande acceptee' -Commentaire 'Acceptee ne veut pas dire effective : la relecture decide.')
  } catch {
    $script:KjemoEcart = $true
    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Restart-Service Spooler' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message)))
  }
  # --- Relecture : le service tourne-t-il ? On attend jusqu a 15 secondes ---
  $tourne = $false
  $dernierEtat = ''
  for ($i = 0; $i -lt 15 -and -not $tourne; $i++) {
    try {
      $s = Get-Service -Name 'Spooler' -ErrorAction Stop
      $dernierEtat = [string]$s.Status
      if ($dernierEtat -eq 'Running') { $tourne = $true }
    } catch { $dernierEtat = 'lecture impossible' }
    if (-not $tourne) { Start-Sleep -Seconds 1 }
  }
  if ($tourne) {
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Service Spooler' -Etat 'OK' -Valeur 'Running' -Commentaire ('Etat avant : ' + $etatAvant))
  } else {
    $script:KjemoEcart = $true
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Service Spooler' -Etat 'PROBLEME' -Valeur $dernierEtat -Commentaire 'Le service ne tourne pas apres le delai. Regarde le journal System avant toute autre action.')
  }
  $script:FilesApres = @()
  $luA = Invoke-KjemoLecture 'Relecture' 'Get-Printer' { $script:FilesApres = @(Get-Printer -ErrorAction Stop) }
  if ($luA) {
    if ($script:FilesApres.Count -eq $nbAvant) {
      [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Files gerees' -Etat 'OK' -Valeur ([string]$script:FilesApres.Count) -Commentaire 'Meme nombre de files qu avant.')
    } else {
      $script:KjemoEcart = $true
      [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Files gerees' -Etat 'PROBLEME' -Valeur ([string]$script:FilesApres.Count + ' au lieu de ' + [string]$nbAvant) -Commentaire 'Le nombre de files a change. Verifie chacune.')
    }
    $totalApres = 0
    foreach ($f in $script:FilesApres) { try { $totalApres = $totalApres + @(Get-PrintJob -PrinterName ([string]$f.Name) -ErrorAction Stop).Count } catch { } }
    $e3 = 'INFO'
    if ($totalApres -lt $travauxAvant) { $e3 = 'ATTENTION' }
    [void](Add-KjemoResultat -Categorie 'Relecture' -Controle 'Travaux en attente' -Etat $e3 -Valeur ([string]$totalApres + ' (avant : ' + [string]$travauxAvant + ')') -Commentaire 'Un nombre plus bas peut signifier des travaux perdus OU simplement imprimes entre-temps.')
  }
  if ($tourne -and -not $script:KjemoEcart) { $script:KjemoAgi = $true }
${GARDE_PORTE_REFUS('le redemarrage').join('\n')}
} else {
  [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Ce qui serait fait' -Etat 'INFO' -Valeur 'redemarrer le service Spooler de cette machine' -Commentaire 'MODE DIAGNOSTIC : rien n est redemarre.')
  if ($KjemoAdmin -and $serviceOk) {
    try { Restart-Service -Name 'Spooler' -WhatIf -ErrorAction Stop }
    catch { [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Restart-Service -WhatIf' -Etat 'ATTENTION' -Valeur 'simulation impossible' -Commentaire (Hide-KjemoSecrets ([string]$_.Exception.Message))) }
  }
}`.split('\n');
  },
  conclusionAgi: 'Le service Spooler a ete redemarre ; la relecture le montre en cours d execution et le nombre de files est inchange. Cela ne prouve PAS que les files impriment : fais un essai reel. Les clients des files partagees ont ete interrompus quelques instants.',
  impression: {
    probleme: 'Plus rien ne s’imprime, un travail est coincé en « Deleting », et la dernière piste raisonnable est de redémarrer le spouleur — sans savoir ce que cela interrompt, ni sur quelle machine on est.',
    exemple: 'Sur SRV-PRINT, le travail 12 est coincé. L’assistant montre 8 files dont 5 partagées et 14 travaux de 6 utilisateurs, simule le redémarrage, puis (avec la phrase exacte) redémarre et relit : service Running, 8 files, travaux conservés.',
    premiere: 'Lance-le en mode Diagnostic dans une console élevée : tu lis l’impact avant d’engager quoi que ce soit, et tu préviens les utilisateurs.',
    lit: 'Le service Spooler (état, dépendants), Get-Printer et Get-PrintJob (nombre de files, de files partagées, de travaux, propriétaires).',
    ecrit: 'En mode Appliquer seulement : Restart-Service Spooler. Rien d’autre : ni purge du dossier de spool, ni suppression de file, de port ou de pilote.',
    effets: 'TOUTES les files de la machine sont interrompues quelques secondes, y compris pour les utilisateurs distants des files partagées. Un travail en cours de transmission peut être relancé ou perdu.',
    limites: [
      'Le redémarrage est irréversible dans ses effets : ce qui a été interrompu l’a été.',
      'Le script n’emploie aucune option de forçage : si des services dépendants tournent, Restart-Service refuse et le script le dit.',
      'Il ne vide JAMAIS le dossier de spool. Si un fichier de spool corrompu bloque tout, ce n’est pas cet assistant qui le supprimera.',
      LIMITE_ETAT,
    ],
  },
  gui: [
    'Prévenir les utilisateurs concernés, surtout sur un serveur d’impression.',
    'Ouvre PowerShell en administrateur sur la machine concernée (et vérifie son nom : « $env:COMPUTERNAME »).',
    'Regarde l’impact : « Get-Printer » (files partagées) et « Get-PrintJob -PrinterName … » (travaux).',
    'Simule : « Restart-Service Spooler -WhatIf ».',
    'Redémarre : « Restart-Service Spooler ».',
    'Relis : « Get-Service Spooler » puis « Get-Printer ». Fais une impression réelle.',
  ],
  keywords: ['spooler', 'spouleur', 'redemarrer', 'restart-service', 'bloque', 'file coincee', 'impression', 'windows'],
  prereqs: ['Une console PowerShell élevée sur la machine concernée.', 'Avoir prévenu les utilisateurs si des files sont partagées.'],
  reversible: false,
  rollback: {
    summary: 'Un redémarrage ne s’annule pas : ce qui a été interrompu l’a été. Si le service ne repart pas, il se démarre à la main.',
    diagnostic: 'Get-Service Spooler | Format-List Name, Status, StartType\nGet-WinEvent -FilterHashtable @{LogName="System"; ProviderName="Service Control Manager"} -MaxEvents 20',
    command: '# Si le service est arrete apres le redemarrage :\nStart-Service -Name Spooler\nGet-Service -Name Spooler',
    warning: 'Les travaux interrompus en cours de transmission doivent être renvoyés. Ne vide pas le dossier de spool pour « réparer » : tu perdrais les travaux en attente de tout le monde.',
  },
  checks: [
    'Mode Diagnostic par défaut ; Appliquer exige la phrase « REDEMARRER LE SPOULEUR DE <MACHINE> », vérifiée de nouveau par le script.',
    'Le nom de machine saisi doit être celui de la machine où le script tourne, sinon refus : pas de redémarrage sur le mauvais serveur.',
    'Console élevée obligatoire.',
    'L’état de départ doit être stable (Running ou Stopped) ; un état de transition ou suspendu est un refus.',
    'L’impact est chiffré AVANT : files, files partagées, travaux, travaux d’autres utilisateurs.',
    'Aucun -Force, aucune purge du dossier de spool, aucune suppression de file, de port ou de pilote.',
    'Restart-Service est simulé par -WhatIf en mode Diagnostic (cmdlet qui le prend en charge).',
    'Le service et les files sont RELUS après l’action ; un écart donne la conclusion ECART.',
  ],
  verifyAfter: [
    '« Get-Service Spooler » rend Running.',
    '« Get-Printer » rend le même nombre de files qu’avant.',
    'Les travaux attendus sont toujours en file, ou le rapport dit lesquels manquent.',
    'Seule une impression réelle prouve que les files impriment.',
  ],
  source: SRC.restartService.url,
  sources: [SRC.restartService, SRC.getService, SRC.getPrinter, SRC.getJob],
});

export const toolsImpressionAction = [
  impWinConfigReseau, impWinConnexionPartage, impWinDefaut, impWinPageTest,
  impWinAnnulerTravail, impWinSpouleurRedemarrer,
];
