/**
 * outils-poste-jonction.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Jonction d'un poste Windows à un domaine Active Directory. Trois assistants.
 *
 *   windows-domain-join-readiness   LIT tout ce qui décide qu'une jonction
 *                                   réussira : édition de Windows, nom du
 *                                   poste, adressage, DNS CLIENT, résolution
 *                                   des enregistrements A et SRV, écart
 *                                   d'horloge, joignabilité du contrôleur,
 *                                   état domaine ou groupe de travail, et
 *                                   l'existence d'un compte administrateur
 *                                   LOCAL utilisable après la jonction.
 *   windows-domain-join             JOINT le poste — et rien d'autre. Aucun
 *                                   mot de passe dans le formulaire, aucun
 *                                   secret dans le script, aucun redémarrage
 *                                   automatique, aucune modification du DNS,
 *                                   et aucune réussite annoncée avant la
 *                                   relecture d'après redémarrage.
 *   windows-domain-join-diagnostic  LIT pourquoi une jonction a échoué, ou
 *                                   pourquoi un poste déjà joint ne s'ouvre
 *                                   plus : canal sécurisé, compte machine
 *                                   existant, DNS, horloge, pare-feu,
 *                                   journaux.
 *
 * ---------------------------------------------------------------------------
 * CE MODULE EST WINDOWS, ET IL APPARTIENT AU LOT 7
 * ---------------------------------------------------------------------------
 * Il est rangé sous « Poste de travail Windows → Jonction de domaine », et
 * jamais sous « Linux et services réseau ». Le fait que le contrôleur de
 * domaine du laboratoire tourne sous Samba AD ne change rien : ces trois
 * assistants s'exécutent sur le POSTE CLIENT, en PowerShell, et une personne
 * qui cherche « joindre un poste au domaine » le cherche du côté du poste.
 *
 * Les 856 scripts PowerShell historiques ne sont pas touchés. Ces trois
 * assistants portent leur propre version, VERSION_JONCTION, distincte de
 * celle du LOT 6 — et la garde d'identité le vérifie dans les deux sens :
 * aucun script du LOT 6 ne porte la version du LOT 7, et aucun script de ce
 * module ne porte celle du LOT 6.
 *
 * ---------------------------------------------------------------------------
 * ADD-COMPUTER N'EXISTE QUE DANS WINDOWS POWERSHELL 5.1
 * ---------------------------------------------------------------------------
 * Sa page sur Microsoft Learn n'est publiée que pour la vue
 * « powershell-5.1 » : le sélecteur de version de la page n'offre rien
 * d'autre. L'applet de commande fait partie de Microsoft.PowerShell.Management
 * tel que Windows PowerShell 5.1 le livre, et PowerShell 7 ne l'emporte pas.
 *
 * La conséquence pratique est la panne la plus bête du sujet : on ouvre
 * « PowerShell 7 » depuis le menu Démarrer, on tape Add-Computer, et on
 * obtient « n'est pas reconnu comme nom d'applet de commande ». On cherche
 * alors du côté du domaine, du DNS et des droits, alors que le problème est la
 * fenêtre qu'on a ouverte. Les trois assistants vérifient donc la PRÉSENCE de
 * l'applet, et le disent avant toute autre chose.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CES TROIS ASSISTANTS NE FONT PAS, ET POURQUOI
 * ---------------------------------------------------------------------------
 * 1. AUCUN MOT DE PASSE. Pas de champ dans le formulaire, pas de secret dans
 *    le script, rien dans le journal, rien dans le rapport. Les informations
 *    d'identification sont demandées à l'écran, au moment de la jonction, par
 *    Get-Credential — qui les garde en mémoire protégée et ne les écrit nulle
 *    part. Un mot de passe de compte autorisé à joindre des machines au
 *    domaine est un secret de domaine : il ne traverse pas un formulaire web.
 *
 * 2. AUCUN REDÉMARRAGE AUTOMATIQUE. Add-Computer accepte un paramètre qui
 *    redémarre la machine ; il n'est pas utilisé, et aucun équivalent n'est
 *    appelé. Un poste qui redémarre sans prévenir emporte le travail non
 *    enregistré de la personne assise devant, et la jonction n'est jamais
 *    urgente à ce point. Le redémarrage est annoncé comme une étape manuelle.
 *
 * 3. AUCUNE MODIFICATION SILENCIEUSE DU DNS. Un poste dont le DNS client
 *    pointe vers la box ou vers un résolveur public ne trouvera jamais les
 *    enregistrements SRV du domaine. L'assistant le CONSTATE et nomme la
 *    correction ; il ne la fait pas. Changer l'adresse d'un serveur DNS à
 *    distance est le moyen le plus simple de perdre la machine qu'on dépanne.
 *
 * 4. AUCUN RETRAIT DE DOMAINE AUTOMATIQUE. Le retour au groupe de travail est
 *    expliqué, avec ses conséquences sur les profils, et laissé à la main.
 *
 * 5. AUCUNE RÉUSSITE ANNONCÉE AVANT LA RELECTURE D'APRÈS REDÉMARRAGE. Une
 *    jonction acceptée n'est pas une jonction effective : tant que le poste
 *    n'a pas redémarré, l'ouverture de session avec un compte du domaine n'est
 *    pas éprouvée. Le script dit « acceptée », jamais « réussie ».
 */

import { psB64, assertValid } from './noyau.mjs';
import {
  validerEntier,
  validerFormatRapport,
  validerModeExecution,
  validerCheminWindowsLocal,
} from './validateurs.mjs';
import { blocModeDiagnostic } from './rapport-ps.mjs';
import { champMode, champFormat, verifier, assembler } from './outils-serveur.mjs';
import {
  OS_POSTE,
  PREREQS_POSTE,
  ERREURS_POSTE,
  blocContextePoste,
  blocConsoleOuverte,
  blocAucunContournementPoste,
  blocGardienChemin,
  motsCles,
} from './outils-poste.mjs';

/**
 * La version de ces trois assistants.
 *
 * Elle n'est PAS celle du LOT 6, bien que la catégorie soit la même. La
 * catégorie dit où l'on range un outil pour celui qui le cherche ; la version
 * dit de quel lot il vient, pour celui qui lit un script retrouvé sur une clé
 * USB six mois plus tard. Confondre les deux ferait annoncer « LOT 6 » à un
 * script écrit au LOT 7, et la garde d'identité refuse les deux sens.
 */
export const VERSION_JONCTION = 'LOT 7 — Jonction de domaine Windows — 7.0.0';

const CAT = 'Poste de travail Windows';
const LEARN = 'https://learn.microsoft.com';

/** Sources communes aux trois fiches. Toutes vérifiées, toutes précises. */
const SRC_ADD = `${LEARN}/powershell/module/microsoft.powershell.management/add-computer`;
const SRC_REMOVE = `${LEARN}/powershell/module/microsoft.powershell.management/remove-computer`;
const SRC_CANAL = `${LEARN}/powershell/module/microsoft.powershell.management/test-computersecurechannel`;
const SRC_CRED = `${LEARN}/powershell/module/microsoft.powershell.security/get-credential`;
const SRC_DNS = `${LEARN}/powershell/module/dnsclient/resolve-dnsname`;
const SRC_DNSCLIENT = `${LEARN}/powershell/module/dnsclient/get-dnsclientserveraddress`;
const SRC_CS = `${LEARN}/windows/win32/cimwin32prov/win32-computersystem`;
const SRC_JOIN = `${LEARN}/windows-server/identity/ad-fs/deployment/join-a-computer-to-a-domain`;
const SRC_HORLOGE = `${LEARN}/windows/security/threat-protection/security-policy-settings/maximum-tolerance-for-computer-clock-synchronization`;
const SRC_TEMPS = `${LEARN}/windows-server/networking/windows-time-service/windows-time-service-top`;
const SRC_MDP_MACHINE = `${LEARN}/powershell/module/microsoft.powershell.management/reset-computermachinepassword`;
const SRC_RENAME = `${LEARN}/powershell/module/microsoft.powershell.management/rename-computer`;

// ---------------------------------------------------------------------------
// Validateurs propres à ce module
// ---------------------------------------------------------------------------

/**
 * Nom DNS d'un domaine Active Directory.
 *
 * On exige un nom DNS, pas un nom NetBIOS : `Add-Computer -DomainName` attend
 * le nom du domaine, et c'est par les enregistrements SRV de ce nom DNS que le
 * poste trouve un contrôleur. Saisir « KJEMO » au lieu de « kjemo.local »
 * fonctionne parfois — par diffusion NetBIOS, quand elle survit encore — et
 * échoue le reste du temps avec un message qui ne parle pas de noms.
 */
function validerDomaineDns(v) {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: 'Le nom du domaine est obligatoire : par exemple kjemo.local.' };
  if (s.length > 255) return { ok: false, value: s, error: 'Un nom de domaine DNS ne dépasse pas 255 caractères.' };
  if (/\s/.test(s)) return { ok: false, value: s, error: 'Un nom de domaine ne contient pas d’espace.' };
  if (/[\\/@:;,"'`$|<>*?]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom du domaine contient un caractère qui n’a pas sa place dans un nom DNS.' };
  }
  if (!s.includes('.')) {
    return {
      ok: false,
      value: s,
      error: 'Saisis le nom DNS du domaine, avec son suffixe — « kjemo.local », et non « KJEMO ». C’est le nom DNS qui porte les enregistrements SRV par lesquels le poste trouve un contrôleur ; le nom court ne fonctionne que par diffusion NetBIOS, quand elle survit encore sur le réseau.',
    };
  }
  for (const etiquette of s.split('.')) {
    if (etiquette === '') {
      return { ok: false, value: s, error: 'Le nom du domaine contient un point en trop, ou commence ou finit par un point.' };
    }
    if (etiquette.length > 63) {
      return { ok: false, value: s, error: 'Chaque étiquette d’un nom DNS est limitée à 63 caractères.' };
    }
    if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/.test(etiquette)) {
      return { ok: false, value: s, error: `L’étiquette « ${etiquette} » n’est pas un nom DNS valide : lettres, chiffres et tirets, sans tiret au début ni à la fin.` };
    }
  }
  return { ok: true, value: s, error: null };
}

/**
 * Nom distinctif d'une unité d'organisation, facultatif.
 *
 * Vide est accepté : le compte machine va alors dans le conteneur par défaut
 * des ordinateurs du domaine. C'est le comportement normal, et le dire vaut
 * mieux que de forcer une saisie dont personne ne connaît la forme.
 */
function validerUniteOrganisation(v) {
  const s = String(v ?? '').trim();
  if (s === '') return { ok: true, value: '', error: null };
  if (!/^(OU|CN)=/i.test(s)) {
    return {
      ok: false,
      value: s,
      error: 'Une unité d’organisation se désigne par son nom distinctif complet, qui commence par OU= ou CN= : par exemple OU=Postes,DC=kjemo,DC=local. Laisse le champ vide pour utiliser le conteneur par défaut des ordinateurs.',
    };
  }
  if (!/DC=/i.test(s)) {
    return { ok: false, value: s, error: 'Le nom distinctif doit se terminer par les composantes du domaine : …,DC=kjemo,DC=local.' };
  }
  if (/[;|`$<>"]/.test(s)) {
    return { ok: false, value: s, error: 'Le nom distinctif contient un caractère qui n’a pas sa place dans un nom distinctif LDAP.' };
  }
  if (s.length > 1024) {
    return { ok: false, value: s, error: 'Le nom distinctif dépasse 1024 caractères.' };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Nom ou adresse d'un contrôleur de domaine, facultatif.
 */
function validerHoteFacultatif(v, label) {
  const s = String(v ?? '').trim();
  if (s === '') return { ok: true, value: '', error: null };
  if (/\s/.test(s)) return { ok: false, value: s, error: `${label} ne contient pas d’espace.` };
  if (/[\\/@:;,"'`$|<>*?]/.test(s)) {
    return { ok: false, value: s, error: `${label} contient un caractère qui n’a pas sa place dans un nom d’hôte.` };
  }
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(s)) {
    return { ok: false, value: s, error: `${label} doit être un nom d’hôte ou une adresse IPv4.` };
  }
  return { ok: true, value: s, error: null };
}

// ---------------------------------------------------------------------------
// Socle commun des trois scripts
// ---------------------------------------------------------------------------

/** Les variables du script, posées à partir des paramètres. */
function blocVariables(paires) {
  return paires.map(([cle, expr]) => `$${cle} = ${expr}`).join('\n');
}

/** Champ de journal, commun aux assistants qui modifient quelque chose. */
function champJournal(id, aide) {
  return {
    id,
    label: 'Dossier du journal',
    type: 'text',
    default: 'C:\\Kjemo\\Journaux',
    placeholder: 'C:\\Kjemo\\Journaux',
    help: aide,
  };
}

/**
 * Le moteur PowerShell, et la présence de l'applet de jonction.
 *
 * C'est le premier contrôle des trois assistants, et ce n'est pas un hasard :
 * la panne la plus fréquente du sujet est d'avoir ouvert la mauvaise fenêtre.
 */
function blocMoteurPowerShell() {
  return [
    "# --- Le moteur, et l'applet de jonction ------------------------------------------",
    "# Add-Computer fait partie de Windows PowerShell 5.1. Sa page de",
    "# documentation n'est publiee que pour la vue « powershell-5.1 » : PowerShell 7",
    "# ne l'emporte pas. La panne la plus bete du sujet est d'avoir ouvert",
    "# « PowerShell 7 » depuis le menu Demarrer, d'obtenir « n'est pas reconnu",
    "# comme nom d'applet de commande », et de chercher du cote du domaine.",
    '#',
    "# Le controle porte sur la PRESENCE de l'applet, et non sur le numero de",
    '# version : une edition de Windows peut surprendre, et une presence mesuree',
    "# vaut mieux qu'une version deduite.",
    '$MoteurVersion = [string]$PSVersionTable.PSVersion',
    '$MoteurEdition = [string]$PSVersionTable.PSEdition',
    '$AppletJonction = $null',
    "try { $AppletJonction = Get-Command -Name 'Add-Computer' -ErrorAction SilentlyContinue } catch { }",
    '$MoteurOk = [bool]$AppletJonction',
    "[void](Add-KjemoResultat -Categorie 'Moteur' -Controle 'PowerShell' -Etat 'INFO' -Valeur ($MoteurVersion + ' / ' + $MoteurEdition) -Commentaire 'Le moteur qui execute ce script. Windows PowerShell 5.1 se lance par « powershell.exe » ; PowerShell 7 par « pwsh.exe ». Les deux peuvent coexister sur la meme machine, et le menu Demarrer ne dit pas toujours lequel il ouvre.')",
    "[void](Add-KjemoResultat -Categorie 'Moteur' -Controle 'Applet Add-Computer' -Etat (& { if ($MoteurOk) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($MoteurOk) { 'presente' } else { 'absente de ce moteur' } }) -Commentaire (& { if ($MoteurOk) { 'L''applet de jonction est disponible dans cette session.' } else { 'L''applet de jonction est ABSENTE de ce moteur. Elle fait partie de Windows PowerShell 5.1, dont la documentation est la seule a la publier ; PowerShell 7 ne la fournit pas. Rouvre une console « Windows PowerShell » — powershell.exe — en tant qu''administrateur, et relance ce script. Ce n''est pas un probleme de domaine, de DNS ni de droits.' } }))",
  ].join('\n');
}

/**
 * L'état actuel : domaine ou groupe de travail, et le piège de Win32_ComputerSystem.
 */
function blocEtatAppartenance() {
  return [
    "# --- Domaine ou groupe de travail, et le piege de la propriete « Domain » --------",
    '#',
    "# Win32_ComputerSystem porte une propriete « Domain » qui est renseignee DANS",
    '# LES DEUX CAS : jointe au domaine, elle contient le nom du domaine ; hors',
    "# domaine, elle contient le nom du GROUPE DE TRAVAIL. Lire « Domain » sans",
    "# lire « PartOfDomain » fait donc conclure qu'un poste en WORKGROUP est",
    "# dans un domaine nomme « WORKGROUP ». C'est la propriete PartOfDomain, et",
    '# elle seule, qui tranche.',
    '$csPoste = $null',
    'try { $csPoste = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop } catch { }',
    '$DansDomaine = $false',
    "$AppartenanceNom = ''",
    '$NomPoste = [string]$env:COMPUTERNAME',
    'if ($csPoste) {',
    '  $DansDomaine = [bool]$csPoste.PartOfDomain',
    '  $AppartenanceNom = [string]$csPoste.Domain',
    '  $NomPoste = [string]$csPoste.Name',
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Etat actuel' -Etat 'INFO' -Valeur (& { if ($DansDomaine) { 'domaine ' + $AppartenanceNom } else { 'groupe de travail ' + $AppartenanceNom } }) -Commentaire (& { if ($DansDomaine) { 'Ce poste est DEJA joint a un domaine. Le joindre a un autre est une operation differente : il faut d''abord le sortir du premier, ce qu''aucun assistant de ce module ne fait a ta place.' } else { 'Ce poste n''est dans aucun domaine. La valeur affichee est le nom de son GROUPE DE TRAVAIL : la propriete Domain de Win32_ComputerSystem porte l''un ou l''autre, et c''est PartOfDomain qui dit lequel.' } }))",
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Nom du poste' -Etat 'INFO' -Valeur $NomPoste -Commentaire 'Le nom sous lequel le compte machine sera cree dans l''annuaire. Il doit etre unique dans le domaine : un homonyme fait echouer la jonction, ou pire, reprend le compte d''une autre machine.')",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Etat actuel' -Etat 'PROBLEME' -Valeur 'illisible' -Commentaire 'Win32_ComputerSystem n''a pas pu etre lu. Sans cette lecture, l''assistant ne sait pas si le poste est deja dans un domaine, et il ne devinera pas.')",
    '}',
    '',
    "# Le nom NetBIOS du poste est limite a 15 caracteres, et c'est une limite",
    "# reelle, pas une recommandation : au-dela, le nom est tronque et le poste",
    '# repond sous deux noms differents selon le protocole interroge.',
    '$NomPosteOk = $true',
    'if ([string]::IsNullOrWhiteSpace($NomPoste)) {',
    '  $NomPosteOk = $false',
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Nom du poste — forme' -Etat 'PROBLEME' -Valeur 'vide' -Commentaire 'Le nom du poste n''a pas pu etre lu.')",
    '} elseif ($NomPoste.Length -gt 15) {',
    '  $NomPosteOk = $false',
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Nom du poste — forme' -Etat 'PROBLEME' -Valeur ($NomPoste + ' (' + [string]$NomPoste.Length + ' caracteres)') -Commentaire 'Plus de 15 caracteres : la partie NetBIOS du nom sera tronquee, et le poste repondra sous deux noms selon le protocole interroge. Renommer AVANT de joindre, jamais apres — un renommage apres jonction demande de recreer le compte machine.')",
    "} elseif ($NomPoste -notmatch '^[A-Za-z0-9][A-Za-z0-9-]*$') {",
    '  $NomPosteOk = $false',
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Nom du poste — forme' -Etat 'PROBLEME' -Valeur $NomPoste -Commentaire 'Le nom contient un caractere refuse ou commence par un tiret. Un nom de poste s''ecrit en lettres, chiffres et tirets.')",
    "} elseif ($NomPoste -match '^[0-9]+$') {",
    '  $NomPosteOk = $false',
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Nom du poste — forme' -Etat 'PROBLEME' -Valeur $NomPoste -Commentaire 'Un nom entierement numerique est refuse : il se confond avec une adresse dans plusieurs resolutions.')",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Nom du poste — forme' -Etat 'OK' -Valeur ($NomPoste + ' (' + [string]$NomPoste.Length + ' caracteres)') -Commentaire 'Forme acceptable : 15 caracteres au plus, lettres, chiffres et tirets.')",
    '}',
  ].join('\n');
}

/**
 * L'édition de Windows. Les éditions Famille ne joignent pas de domaine.
 */
function blocEditionWindows() {
  return [
    "# --- L'edition de Windows ---------------------------------------------------------",
    '#',
    "# Les editions Famille n'ont pas le composant de jonction : le bouton",
    "# n'existe pas dans les parametres, et l'applet echoue. Ce n'est pas une",
    '# limitation de configuration, et aucune manipulation ne la leve.',
    '#',
    "# L'edition se lit par le NUMERO de SKU, et non par le libelle : le libelle",
    '# est traduit, et comparer « Famille » ou « Home » selon la langue du',
    '# systeme produit un controle qui marche sur la machine du developpeur et',
    '# nulle part ailleurs. Le libelle est affiche pour la lecture humaine ; le',
    '# numero decide.',
    '$osPoste = $null',
    'try { $osPoste = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop } catch { }',
    '$EditionJoignable = $true',
    "$EditionLibelle = 'inconnue'",
    '$EditionNumero = -1',
    '# Les SKU de la famille « Famille » : Core et ses variantes.',
    '$SkuFamille = @(98, 99, 100, 101)',
    'if ($osPoste) {',
    '  $EditionLibelle = [string]$osPoste.Caption',
    '  try { $EditionNumero = [int]$osPoste.OperatingSystemSKU } catch { $EditionNumero = -1 }',
    '  if ($SkuFamille -contains $EditionNumero) {',
    '    $EditionJoignable = $false',
    "    [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Edition' -Etat 'PROBLEME' -Valeur ($EditionLibelle + ' [SKU ' + [string]$EditionNumero + ']') -Commentaire 'Edition de la famille « Famille » : elle ne comporte pas le composant de jonction a un domaine. Aucune manipulation ne l''ajoute. Il faut une edition Professionnel, Entreprise ou Education — ce qui suppose une mise a niveau de licence, pas un reglage.')",
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Edition' -Etat 'OK' -Valeur ($EditionLibelle + ' [SKU ' + [string]$EditionNumero + ']') -Commentaire 'Edition compatible avec la jonction a un domaine. Le numero de SKU decide ; le libelle est traduit et ne sert qu''a la lecture.')",
    '  }',
    "  [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Version' -Etat 'INFO' -Valeur ([string]$osPoste.Version + ' build ' + [string]$osPoste.BuildNumber))",
    '} else {',
    '  $EditionJoignable = $false',
    "  [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Edition' -Etat 'PROBLEME' -Valeur 'illisible' -Commentaire 'Win32_OperatingSystem n''a pas pu etre lu : l''edition n''a PAS ete mesuree. Une absence de mesure n''est pas une compatibilite.')",
    '}',
  ].join('\n');
}

/**
 * Le DNS client, et la résolution des enregistrements du domaine.
 *
 * C'est la cause nº 1 d'un échec de jonction, et elle ne ressemble jamais à un
 * problème de DNS vue depuis le poste : « le domaine est introuvable ».
 */
function blocDnsDomaine() {
  return [
    "# --- Le DNS CLIENT, et ce qu'il sait du domaine -----------------------------------",
    '#',
    "# C'est la cause numero un d'un echec de jonction, et elle ne ressemble",
    "# jamais a un probleme de DNS : le message dit que le domaine est",
    '# introuvable. Un poste qui interroge la box, ou un resolveur public,',
    "# resout tres bien les sites web et ne trouvera JAMAIS les enregistrements",
    '# SRV du domaine : ces enregistrements ne vivent que dans le DNS du domaine.',
    '#',
    "# Ce script NE CHANGE AUCUN serveur DNS. Modifier l'adresse d'un serveur DNS",
    "# a distance est le moyen le plus simple de perdre la machine qu'on depanne.",
    '$ServeursDns = @()',
    'try {',
    '  $ServeursDns = @(Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |',
    '    Where-Object { $_.ServerAddresses -and $_.ServerAddresses.Count -gt 0 })',
    '} catch { }',
    '$DnsPublics = @()',
    "$ResolveursPublicsConnus = @('8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9', '208.67.222.222')",
    'if ($ServeursDns.Count -eq 0) {',
    "  [void](Add-KjemoResultat -Categorie 'DNS' -Controle 'Serveurs configures' -Etat 'PROBLEME' -Valeur 'aucun' -Commentaire 'Aucune interface ne declare de serveur DNS IPv4. Sans DNS, le poste ne trouvera aucun controleur de domaine.')",
    '} else {',
    '  foreach ($itf in $ServeursDns) {',
    "    $liste = ($itf.ServerAddresses -join ', ')",
    '    foreach ($adr in $itf.ServerAddresses) {',
    '      if ($ResolveursPublicsConnus -contains [string]$adr) { $DnsPublics += [string]$adr }',
    '    }',
    "    [void](Add-KjemoResultat -Categorie 'DNS' -Controle ('Interface ' + [string]$itf.InterfaceAlias) -Etat 'INFO' -Valeur $liste -Commentaire 'Les serveurs DNS de cette interface. Pour joindre un domaine, ils doivent etre ceux du DOMAINE — pas la box, pas un resolveur public.')",
    '  }',
    '  if ($DnsPublics.Count -gt 0) {',
    "    [void](Add-KjemoResultat -Categorie 'DNS' -Controle 'Resolveur public configure' -Etat 'PROBLEME' -Valeur ($DnsPublics -join ', ') -Commentaire 'Un resolveur PUBLIC est configure sur ce poste. Il resout parfaitement les sites web, et ne connaitra jamais les enregistrements SRV du domaine : ils n''existent que dans le DNS du domaine. C''est la cause numero un des jonctions qui echouent avec « domaine introuvable ». A corriger a la main, depuis le poste, sur l''interface concernee — ce script ne touche a aucun reglage reseau.')",
    '  }',
    '}',
    '',
    '# Les enregistrements qui comptent. Un seul A ne suffit pas : le poste',
    "# cherche un controleur par les SRV, et c'est leur absence qui fait echouer",
    '# la jonction alors que « ping domaine » repond.',
    '$ResolutionA = $false',
    '$ResolutionSrv = $false',
    '$SrvTrouves = @()',
    "if (Get-Command -Name 'Resolve-DnsName' -ErrorAction SilentlyContinue) {",
    '  $repA = $null',
    "  try { $repA = @(Resolve-DnsName -Name $Domaine -Type A -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq 'A' }) } catch { }",
    '  if ($repA -and $repA.Count -gt 0) {',
    '    $ResolutionA = $true',
    "    [void](Add-KjemoResultat -Categorie 'DNS' -Controle ('A — ' + $Domaine) -Etat 'OK' -Valeur (($repA | ForEach-Object { [string]$_.IPAddress }) -join ', ') -Commentaire 'Le nom du domaine se resout. Dans un domaine Active Directory, ces adresses sont celles des controleurs. Attention : cette reponse NE PROUVE PAS que la jonction fonctionnera — ce sont les SRV ci-dessous qui portent la localisation des services.')",
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'DNS' -Controle ('A — ' + $Domaine) -Etat 'PROBLEME' -Valeur 'aucune reponse' -Commentaire 'Le nom du domaine ne se resout pas depuis ce poste. Verifier les serveurs DNS de l''interface avant toute autre piste.')",
    '  }',
    '  foreach ($srv in @(("_ldap._tcp.dc._msdcs." + $Domaine), ("_kerberos._tcp." + $Domaine), ("_ldap._tcp." + $Domaine))) {',
    '    $rep = $null',
    "    try { $rep = @(Resolve-DnsName -Name $srv -Type SRV -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq 'SRV' }) } catch { }",
    '    if ($rep -and $rep.Count -gt 0) {',
    '      $SrvTrouves += $srv',
    "      [void](Add-KjemoResultat -Categorie 'DNS' -Controle ('SRV — ' + $srv) -Etat 'OK' -Valeur (($rep | ForEach-Object { [string]$_.NameTarget + ':' + [string]$_.Port }) -join ', ') -Commentaire 'Enregistrement de service present : le poste sait ou joindre ce service du domaine.')",
    '    } else {',
    "      [void](Add-KjemoResultat -Categorie 'DNS' -Controle ('SRV — ' + $srv) -Etat 'PROBLEME' -Valeur 'absent' -Commentaire 'Enregistrement de service ABSENT. C''est par ces enregistrements que le poste localise un controleur : sans eux, la jonction echoue en disant que le domaine est introuvable, meme si « ping » repond. Deux causes : le poste n''interroge pas le DNS du domaine, ou le controleur n''a pas enregistre ses SRV.')",
    '    }',
    '  }',
    '  $ResolutionSrv = ($SrvTrouves.Count -ge 2)',
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'DNS' -Controle 'Resolve-DnsName' -Etat 'IGNORE' -Valeur 'applet absente' -Commentaire 'L''applet de resolution DNS n''est pas disponible : la resolution n''a PAS ete mesuree. Une absence de mesure n''est pas une reussite.')",
    '}',
  ].join('\n');
}

/**
 * L'horloge. Kerberos refuse au-delà de cinq minutes d'écart, par défaut.
 */
function blocHorloge() {
  return [
    '# --- L horloge, et les cinq minutes de Kerberos -----------------------------------',
    '#',
    "# La strategie « Tolerance maximale pour la synchronisation de l'horloge de",
    "# l'ordinateur » vaut 5 minutes dans la strategie de domaine par defaut.",
    '# Au-dela, Kerberos refuse les tickets, et le message ne parle pas',
    "# d'horloge : on lit « nom d'utilisateur ou mot de passe incorrect » avec",
    '# un mot de passe parfaitement correct.',
    '#',
    "# L'ecart est mesure par w32tm, en lecture seule. Ce script ne synchronise",
    "# rien et ne touche pas au service de temps : forcer une synchronisation",
    '# sur un poste deja joint peut casser la hierarchie de temps du domaine.',
    "$EcartHorloge = ''",
    '$HorlogeOk = $false',
    '$HorlogeMesuree = $false',
    '$CibleTemps = $Domaine',
    'if (-not [string]::IsNullOrWhiteSpace($Controleur)) { $CibleTemps = $Controleur }',
    "[void](Add-KjemoResultat -Categorie 'Horloge' -Controle 'Heure locale' -Etat 'INFO' -Valeur ([string](Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' (' + [string](Get-TimeZone).Id + ')') -Commentaire 'L''heure de ce poste, et son fuseau. Un fuseau faux avec une heure juste ne gene pas Kerberos, qui compare des instants absolus ; une heure fausse, si.')",
    "if (Get-Command -Name 'w32tm' -ErrorAction SilentlyContinue) {",
    '  $sortieTemps = $null',
    "  try { $sortieTemps = (& w32tm '/stripchart' ('/computer:' + $CibleTemps) '/samples:1' '/dataonly' 2>&1 | Out-String) } catch { $sortieTemps = $null }",
    '  if ($sortieTemps) {',
    "    $m = [regex]::Match([string]$sortieTemps, '([+-]?[0-9]+[.,][0-9]+)s')",
    '    if ($m.Success) {',
    '      $HorlogeMesuree = $true',
    "      $valeur = [double](([string]$m.Groups[1].Value) -replace ',', '.')",
    '      $abs = [math]::Abs($valeur)',
    "      $EcartHorloge = ([string][math]::Round($abs, 2) + ' s')",
    '      $HorlogeOk = ($abs -lt 300)',
    "      [void](Add-KjemoResultat -Categorie 'Horloge' -Controle 'Ecart avec le controleur' -Etat (& { if ($HorlogeOk) { 'OK' } else { 'PROBLEME' } }) -Valeur $EcartHorloge -Commentaire (& { if ($HorlogeOk) { 'Ecart inferieur a la tolerance de 5 minutes de la strategie de domaine par defaut. Kerberos acceptera les tickets.' } else { 'Ecart SUPERIEUR a la tolerance de 5 minutes. Kerberos refusera les tickets, et le message affiche parlera d''un mot de passe incorrect — avec un mot de passe parfaitement correct. Corriger l''heure AVANT de joindre : ce script ne synchronise rien, parce qu''une synchronisation forcee sur un poste deja joint peut casser la hierarchie de temps du domaine.' } }))",
    '    } else {',
    "      [void](Add-KjemoResultat -Categorie 'Horloge' -Controle 'Ecart avec le controleur' -Etat 'ATTENTION' -Valeur 'non mesurable' -Commentaire ('La commande de mesure du temps a repondu sans donner d''ecart exploitable. Reponse brute : ' + ([string]$sortieTemps).Trim() + '. L''ecart n''a donc PAS ete mesure, et la tolerance de 5 minutes reste a verifier a la main.')) ",
    '    }',
    '  } else {',
    "    [void](Add-KjemoResultat -Categorie 'Horloge' -Controle 'Ecart avec le controleur' -Etat 'ATTENTION' -Valeur 'mesure impossible' -Commentaire 'La mesure d''ecart n''a pas pu etre faite. Elle exige que le port du service de temps soit joignable, ce qui n''est pas toujours le cas avant la jonction. A verifier a l''oeil : l''heure des deux machines, a la minute pres.')",
    '  }',
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Horloge' -Controle 'Outil de mesure' -Etat 'IGNORE' -Valeur 'w32tm absent' -Commentaire 'L''outil de mesure du temps est introuvable : l''ecart n''a PAS ete mesure.')",
    '}',
  ].join('\n');
}

/**
 * La joignabilité du contrôleur, port par port.
 */
function blocConnectiviteDc() {
  return [
    '# --- Le controleur est-il joignable, et sur quels ports ? -------------------------',
    '#',
    "# Chaque port porte un service, et l'echec de l'un se diagnostique",
    '# differemment des autres. Les nommer evite le « le reseau ne marche pas »',
    '# qui ne mene nulle part.',
    '$CibleReseau = $Domaine',
    'if (-not [string]::IsNullOrWhiteSpace($Controleur)) { $CibleReseau = $Controleur }',
    '$PortsOk = 0',
    '$PortsTestes = 0',
    "$PortsRoles = @{ 389 = 'LDAP — l''annuaire lui-meme'; 88 = 'Kerberos — l''authentification'; 445 = 'SMB — le partage SYSVOL et les strategies'; 135 = 'RPC — l''appel de procedure distante' }",
    "if (Get-Command -Name 'Test-NetConnection' -ErrorAction SilentlyContinue) {",
    '  foreach ($port in @(389, 88, 445, 135)) {',
    '    $PortsTestes += 1',
    '    $joignable = $false',
    "    try { $joignable = [bool](Test-NetConnection -ComputerName $CibleReseau -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction SilentlyContinue) } catch { $joignable = $false }",
    '    if ($joignable) { $PortsOk += 1 }',
    "    [void](Add-KjemoResultat -Categorie 'Reseau' -Controle ('Port ' + [string]$port + ' vers ' + $CibleReseau) -Etat (& { if ($joignable) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($joignable) { 'joignable' } else { 'injoignable' } }) -Commentaire ([string]$PortsRoles[$port] + (& { if ($joignable) { '. Le service repond.' } else { '. Le service ne repond pas : pare-feu entre les deux machines, controleur arrete, ou mauvaise cible. Un port ferme se diagnostique la ou il est ferme, pas sur le poste.' } })))",
    '  }',
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Reseau' -Controle 'Test des ports' -Etat 'IGNORE' -Valeur 'Test-NetConnection absent' -Commentaire 'L''applet de test de connexion est introuvable : les ports n''ont PAS ete mesures.')",
    '}',
    '$ReseauOk = ($PortsTestes -gt 0 -and $PortsOk -ge 3)',
  ].join('\n');
}

/**
 * Le compte administrateur LOCAL — celui qui reste utilisable après la jonction.
 *
 * C'est le contrôle qu'on oublie, et il coûte cher : un poste joint dont le
 * seul administrateur était un compte du domaine devient inadministrable dès
 * que le domaine n'est plus joignable.
 */
function blocAdminLocal() {
  return [
    '# --- Un administrateur LOCAL restera-t-il utilisable apres la jonction ? ---------',
    '#',
    "# C'est le controle qu'on oublie, et il coute cher : une fois le poste",
    '# joint, si le seul compte administrateur est un compte du DOMAINE, le',
    '# poste devient inadministrable des que le domaine est injoignable — reseau',
    "# coupe, controleur arrete, ou canal securise rompu. Il faut qu'un compte",
    "# LOCAL, actif, membre du groupe des administrateurs, existe AVANT.",
    '#',
    '# Le groupe est designe par son SID connu, S-1-5-32-544, et non par son nom.',
    "# Le nom est TRADUIT — « Administrateurs », « Administrators », et d'autres",
    '# selon la langue du systeme : un controle qui compare le nom fonctionne sur',
    '# la machine du developpeur et echoue sur celle du client.',
    '$AdminLocalOk = $false',
    '$AdminsLocaux = @()',
    "if (Get-Command -Name 'Get-LocalGroupMember' -ErrorAction SilentlyContinue) {",
    '  $membres = @()',
    "  try { $membres = @(Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction SilentlyContinue) } catch { }",
    '  foreach ($m in $membres) {',
    "    $estLocal = ([string]$m.PrincipalSource -eq 'Local')",
    "    $estUtilisateur = ([string]$m.ObjectClass -match 'User|Utilisateur')",
    '    if ($estLocal -and $estUtilisateur) {',
    "      $court = ([string]$m.Name -split '\\\\')[-1]",
    '      $actif = $null',
    '      try { $actif = (Get-LocalUser -Name $court -ErrorAction SilentlyContinue).Enabled } catch { }',
    '      if ($actif -eq $true) {',
    '        $AdminsLocaux += $court',
    '      }',
    '    }',
    '  }',
    '  $AdminLocalOk = ($AdminsLocaux.Count -gt 0)',
    "  [void](Add-KjemoResultat -Categorie 'Secours' -Controle 'Administrateur local actif' -Etat (& { if ($AdminLocalOk) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($AdminLocalOk) { ($AdminsLocaux -join ', ') } else { 'aucun' } }) -Commentaire (& { if ($AdminLocalOk) { 'Au moins un compte LOCAL actif est administrateur de ce poste. Il restera utilisable si le domaine devient injoignable. Verifie que son mot de passe est connu de quelqu''un : un compte dont personne n''a le mot de passe n''est pas un secours.' } else { 'AUCUN compte local actif n''est administrateur de ce poste. Une fois joint, si le domaine devient injoignable — reseau coupe, controleur arrete, canal securise rompu — plus personne ne pourra administrer cette machine. Creer et ACTIVER un compte local administrateur avant de joindre, et en noter le mot de passe dans le coffre de l''equipe.' } }))",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Secours' -Controle 'Administrateur local actif' -Etat 'IGNORE' -Valeur 'applet absente' -Commentaire 'Le module des comptes locaux n''est pas disponible : la presence d''un administrateur local n''a PAS ete verifiee. Une absence de mesure n''est pas une garantie.')",
    '}',
  ].join('\n');
}

/**
 * Le format du rapport, REELLEMENT pose.
 *
 * ---------------------------------------------------------------------------
 * UN DEFAUT MESURE, ET DECLARE : LE SELECTEUR DE FORMAT DU LOT 6B EST MORT
 * ---------------------------------------------------------------------------
 * blocExportRapport() branche la sortie sur `$KjemoFormat`, et ne la pose pas :
 * c'est a l'outil de l'affecter. Les assistants du LOT 2 le font
 * (`$KjemoFormat = ...`). Ceux du LOT 6B ne le font PAS — leur champ « Format
 * du rapport » existe, s'affiche, et n'a aucun effet : `$KjemoFormat` y vaut
 * $null, donc different de 'Console', donc le bloc d'export s'execute et
 * n'entre dans aucune des trois branches. Aucun fichier n'est ecrit, et rien
 * ne le dit.
 *
 * Le banc de jonction l'a trouve en cherchant son propre rapport JSON. Le
 * defaut n'est PAS corrige ici : il touche des scripts figes par la garde
 * d'identite, et une migration globale des versions historiques demande une
 * autorisation explicite. Il est consigne comme dette mesuree.
 *
 * Les trois assistants de ce module, eux, posent la variable.
 */
function blocFormatRapport(valeur) {
  return `$KjemoFormat = ${psB64(String(valeur ?? 'Console'))}`;
}

/** Le rappel commun : aucun secret, nulle part. */
function blocAucunSecret() {
  return [
    "Write-Host ''",
    "Write-Host '--- Ce que ce script ne manipule jamais ---'",
    "Write-Host 'Aucun mot de passe : ni dans le formulaire, ni dans ce fichier,'",
    "Write-Host 'ni dans le journal, ni dans le rapport. Les informations'",
    "Write-Host 'd''identification sont demandees a l''ecran au moment ou elles'",
    "Write-Host 'servent, et ne sont ecrites nulle part.'",
    "Write-Host 'Aucun redemarrage automatique, aucune modification du DNS,'",
    "Write-Host 'aucun retrait de domaine, aucun renommage de poste.'",
  ].join('\n');
}

// ===========================================================================
// 1. windows-domain-join-readiness
// ===========================================================================

export const outilJonctionPrerequis = {
  id: 'windows-domain-join-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'Jonction de domaine',
  title: 'Vérifier qu’un poste Windows peut rejoindre un domaine',
  risk: 'diagnostic',
  summary: 'Lit tout ce qui décide d’une jonction : présence de l’applet Add-Computer — absente de PowerShell 7 —, édition de Windows par son numéro de SKU plutôt que par son libellé traduit, longueur et forme du nom de poste, serveurs DNS du client et détection d’un résolveur public, résolution des enregistrements A et SRV du domaine, écart d’horloge face à la tolérance de cinq minutes de Kerberos, joignabilité des ports 389, 88, 445 et 135, état domaine ou groupe de travail, et existence d’un administrateur LOCAL actif qui restera utilisable après la jonction. N’écrit rien, ne joint rien, ne change aucun réglage réseau.',
  fields: [
    {
      id: 'jrDomaine', label: 'Nom DNS du domaine', type: 'text',
      default: 'kjemo.local', placeholder: 'kjemo.local',
      help: 'Le nom DNS complet, avec son suffixe — « kjemo.local », et non « KJEMO ». C’est lui qui porte les enregistrements SRV par lesquels le poste trouve un contrôleur.',
    },
    {
      id: 'jrControleur', label: 'Contrôleur de domaine à éprouver (facultatif)', type: 'text',
      default: '', placeholder: 'dc01.kjemo.local',
      help: 'Si renseigné, les ports et l’écart d’horloge sont mesurés vers CE contrôleur. Vide, ils le sont vers le nom du domaine, qui résout vers l’un quelconque des contrôleurs.',
    },
    champFormat('jrFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'jrDomaine', validerDomaineDns(v.jrDomaine));
    verifier(errors, 'jrControleur', validerHoteFacultatif(v.jrControleur, 'Le contrôleur de domaine'));
    verifier(errors, 'jrFormat', validerFormatRapport(v.jrFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const parametres = [
      ['Domaine', psB64(String(v.jrDomaine ?? '').trim())],
      ['Controleur', psB64(String(v.jrControleur ?? '').trim())],
    ];
    const corps = [
      blocVariables(parametres),
      blocFormatRapport(v.jrFormat),
      '',
      blocContextePoste(),
      '',
      blocMoteurPowerShell(),
      '',
      blocEditionWindows(),
      '',
      blocEtatAppartenance(),
      '',
      "# --- Deja joint : ce que cet assistant en dit ------------------------------------",
      'if ($DansDomaine) {',
      "  [void](Add-KjemoResultat -Categorie 'Appartenance' -Controle 'Jonction possible' -Etat 'ATTENTION' -Valeur ('deja dans ' + $AppartenanceNom) -Commentaire 'Ce poste est deja joint a un domaine. Les controles ci-dessous restent utiles — ils disent si le domaine demande serait joignable — mais joindre un second domaine exige de sortir du premier d''abord, et c''est une operation a part : elle rend les profils du domaine actuel inutilisables sur ce poste.')",
      '}',
      '',
      blocDnsDomaine(),
      '',
      blocHorloge(),
      '',
      blocConnectiviteDc(),
      '',
      blocAdminLocal(),
      '',
      "# --- L'adressage, pour memoire ----------------------------------------------------",
      '$Adresses = @()',
      "try { $Adresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { [string]$_.IPAddress -ne '127.0.0.1' }) } catch { }",
      'foreach ($a in $Adresses) {',
      "  [void](Add-KjemoResultat -Categorie 'Reseau' -Controle ('Adresse ' + [string]$a.InterfaceAlias) -Etat 'INFO' -Valeur ([string]$a.IPAddress + '/' + [string]$a.PrefixLength) -Commentaire ('Origine du bail : ' + [string]$a.PrefixOrigin + '. Une adresse obtenue par DHCP peut changer ; un poste joint s''en accommode, puisque c''est son compte machine et non son adresse qui l''identifie.'))",
      '}',
      '',
      "# --- LE VERDICT, et il refuse de conclure quand une mesure manque -----------------",
      '#',
      "# Un prerequis « IGNORE » n'est pas un prerequis rempli. Le verdict ne vaut",
      '# que sur ce qui a ete MESURE, et il le dit.',
      '$PretAJoindre = $MoteurOk -and $EditionJoignable -and $NomPosteOk -and $ResolutionSrv -and $ReseauOk -and $AdminLocalOk -and (-not $DansDomaine)',
      '$Manquants = @()',
      "if (-not $MoteurOk) { $Manquants += 'l''applet Add-Computer est absente de ce moteur' }",
      "if (-not $EditionJoignable) { $Manquants += 'l''edition de Windows ne joint pas de domaine' }",
      "if (-not $NomPosteOk) { $Manquants += 'le nom du poste ne convient pas' }",
      "if (-not $ResolutionSrv) { $Manquants += 'les enregistrements SRV du domaine ne se resolvent pas' }",
      "if (-not $ReseauOk) { $Manquants += 'les ports du controleur ne repondent pas tous' }",
      "if (-not $AdminLocalOk) { $Manquants += 'aucun administrateur LOCAL actif ne restera utilisable' }",
      "if ($DansDomaine) { $Manquants += 'ce poste est deja dans un domaine' }",
      "if (-not $HorlogeMesuree) { $Manquants += 'l''ecart d''horloge n''a pas pu etre mesure (a verifier a la main)' }",
      "if ($HorlogeMesuree -and -not $HorlogeOk) { $Manquants += 'l''ecart d''horloge depasse la tolerance de 5 minutes' }",
      "[void](Add-KjemoResultat -Categorie 'Verdict' -Controle 'Pret pour la jonction' -Etat (& { if ($PretAJoindre -and $HorlogeOk) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($PretAJoindre -and $HorlogeOk) { 'oui, sur les points mesures' } else { ($Manquants -join ' ; ') } }) -Commentaire 'Ce verdict ne porte que sur les points MESURES. Une ligne IGNORE plus haut signale une mesure qui n''a pas eu lieu, et une mesure absente n''est pas un prerequis rempli.')",
      "Write-Host ''",
      "Write-Host '--- Ce qui reste a faire a la main, dans cet ordre ---'",
      "Write-Host '1. Corriger ce que le verdict ci-dessus nomme.'",
      "Write-Host '2. Noter, dans le coffre de l''equipe, le compte administrateur'",
      "Write-Host '   LOCAL qui servira si le domaine devient injoignable.'",
      "Write-Host '3. Prevenir la personne qui utilise ce poste : la jonction'",
      "Write-Host '   demande un redemarrage, et sa premiere ouverture de session'",
      "Write-Host '   avec un compte du domaine creera un profil NEUF — bureau,'",
      "Write-Host '   documents et reglages du profil local ne suivent pas.'",
      blocAucunSecret(),
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];
    return assembler({
      titre: 'Verifier qu un poste Windows peut rejoindre un domaine',
      outil: 'windows-domain-join-readiness',
      diagnostic: true,
      admin: false,
      parametres,
      corps,
      version: VERSION_JONCTION,
      prefixeFichier: 'kjemo-jonction-prerequis',
      formats: v.jrFormat,
    });
  },
  gui: [
    'Paramètres > Système > Informations système : l’édition de Windows, le nom du poste, et la ligne « Domaine » ou « Groupe de travail ».',
    'ncpa.cpl > clic droit sur la carte > Propriétés > Protocole TCP/IPv4 > Propriétés : les serveurs DNS. Pour joindre un domaine, ce sont ceux du DOMAINE, pas ceux de la box.',
    'Invite de commandes : « nslookup -type=SRV _ldap._tcp.dc._msdcs.kjemo.local » — si cette commande ne répond pas, la jonction échouera.',
    'Paramètres > Heure et langue > Date et heure : l’écart avec le contrôleur doit rester sous cinq minutes, faute de quoi Kerberos refuse.',
    'lusrmgr.msc > Groupes > le groupe des administrateurs : vérifier qu’un compte LOCAL actif y figure, et que son mot de passe est connu.',
  ],
  keywords: motsCles(
    'jonction domaine', 'joindre un domaine', 'add-computer', 'active directory poste',
    'domaine introuvable', 'srv', '_ldap._tcp', 'dns client', 'kerberos horloge',
    'workgroup', 'groupe de travail', 'compte machine', 'prerequis jonction',
    'powershell 5.1', 'windows home domaine',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Le nom DNS du domaine, avec son suffixe. « KJEMO » ne suffit pas : c’est le nom DNS qui porte les enregistrements SRV.',
    'Windows PowerShell 5.1 pour que la présence de l’applet Add-Computer puisse être constatée — l’assistant le dit si la session n’est pas la bonne.',
    'Une connectivité réseau vers le contrôleur. Les ports fermés sont nommés un par un, avec le service que chacun porte.',
    'Aucune élévation n’est nécessaire : tout est en lecture. Les mesures qui en demanderaient une sont annoncées IGNORE.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: '« Add-Computer n’est pas reconnu comme nom d’applet de commande »',
      cause: 'La console ouverte est PowerShell 7. L’applet fait partie de Windows PowerShell 5.1, dont la documentation est la seule à la publier.',
      fix: 'Ouvrir « Windows PowerShell » — powershell.exe — en tant qu’administrateur, et relancer. Ce n’est pas un problème de domaine, de DNS ni de droits.',
    },
    {
      message: '« ping kjemo.local » répond, et la jonction dit que le domaine est introuvable',
      cause: 'Un enregistrement A suffit à faire répondre ping. La jonction, elle, cherche un contrôleur par les enregistrements SRV, qui n’existent que dans le DNS du domaine.',
      fix: 'Vérifier les serveurs DNS de l’interface : ils doivent être ceux du domaine. Puis « nslookup -type=SRV _ldap._tcp.dc._msdcs.kjemo.local ».',
    },
    {
      message: '« Nom d’utilisateur ou mot de passe incorrect » avec un mot de passe correct',
      cause: 'L’écart d’horloge dépasse la tolérance de cinq minutes de la stratégie de domaine par défaut. Kerberos refuse les tickets, et le message ne parle pas d’heure.',
      fix: 'Comparer les deux horloges, corriger celle du poste, puis réessayer.',
    },
    {
      message: 'Le poste affiche un domaine alors qu’il n’est dans aucun',
      cause: 'La propriété « Domain » de Win32_ComputerSystem contient le nom du GROUPE DE TRAVAIL quand le poste n’est pas joint. Lue seule, elle trompe.',
      fix: 'Lire « PartOfDomain » : c’est elle, et elle seule, qui tranche. Ce rapport les présente ensemble.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport nomme le moteur PowerShell et dit si l’applet de jonction y est présente.',
    'L’édition de Windows est jugée sur son numéro de SKU, et le libellé n’est là que pour la lecture.',
    'Les enregistrements SRV sont contrôlés séparément de l’enregistrement A : c’est leur absence qui fait échouer la jonction.',
    'L’écart d’horloge est comparé à cinq minutes, et une mesure impossible est annoncée comme telle.',
    'Les quatre ports sont rapportés un par un, avec le service que chacun porte.',
    'La présence d’un administrateur LOCAL actif est vérifiée par le SID du groupe, pas par son nom traduit.',
    'Le verdict final dit explicitement qu’il ne porte que sur les points mesurés.',
  ],
  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne joint aucun domaine, ne modifie aucun serveur DNS, ne renomme pas le poste, ne crée aucun compte, et ne redémarre rien. Les corrections qu’il nomme — DNS du client, heure, compte administrateur local — restent à faire à la main, et c’est voulu : changer l’adresse d’un serveur DNS à distance est le moyen le plus simple de perdre la machine qu’on dépanne.',
    diagnostic: '# Les trois lectures qui decident, dans l\'ordre ou elles comptent :\nGet-CimInstance Win32_ComputerSystem | Select-Object Name,PartOfDomain,Domain,Workgroup\nGet-DnsClientServerAddress -AddressFamily IPv4 | Select-Object InterfaceAlias,ServerAddresses\nResolve-DnsName -Name _ldap._tcp.dc._msdcs.kjemo.local -Type SRV',
    command: '# Aucune modification a annuler : cet assistant lit.\n#\n# Les corrections qu il nomme, et qui se font a la main :\n#   - serveurs DNS du client : ncpa.cpl, carte concernee, TCP/IPv4\n#   - heure du poste : Parametres > Heure et langue\n#   - compte administrateur local : lusrmgr.msc, groupe des administrateurs\n#\n# Et la relecture, parce qu une correction ne prouve pas un etat :\nResolve-DnsName -Name _ldap._tcp.dc._msdcs.kjemo.local -Type SRV',
    warning: 'Ne change pas les serveurs DNS d’un poste distant sans savoir comment tu y reviendras : une erreur de saisie coupe l’accès à la machine, y compris le tien.',
  },
  checks: [
    'Aucune écriture : aucun domaine joint, aucun réglage réseau modifié, aucun compte créé, aucun redémarrage.',
    'L’édition de Windows est jugée par son numéro de SKU : un contrôle sur le libellé traduit marcherait sur une seule langue.',
    'Le groupe des administrateurs est désigné par son SID connu, S-1-5-32-544, et non par un nom traduit.',
    'PartOfDomain et Domain sont lues ensemble : la seconde contient le groupe de travail quand le poste n’est pas joint.',
    'Les enregistrements SRV sont contrôlés séparément du A, et le rapport dit pourquoi le A ne suffit pas.',
    'Un résolveur DNS public configuré sur le poste est signalé comme un PROBLEME, avec sa conséquence.',
    'Les mesures impossibles sont annoncées IGNORE ou ATTENTION, jamais OK, et le verdict final rappelle qu’il ne porte que sur ce qui a été mesuré.',
    'Aucun mot de passe : aucun champ, aucune lecture, rien dans le rapport.',
  ],
  source: SRC_JOIN,
  sources: [
    { label: 'Joindre un ordinateur à un domaine', url: SRC_JOIN },
    { label: 'Add-Computer — publiée pour Windows PowerShell 5.1', url: SRC_ADD },
    { label: 'Win32_ComputerSystem — PartOfDomain, Domain, Workgroup', url: SRC_CS },
    { label: 'Resolve-DnsName', url: SRC_DNS },
    { label: 'Get-DnsClientServerAddress', url: SRC_DNSCLIENT },
    { label: 'Tolérance maximale pour la synchronisation de l’horloge — 5 minutes', url: SRC_HORLOGE },
  ],
};

// ===========================================================================
// 2. windows-domain-join
// ===========================================================================

export const outilJonctionDomaine = {
  id: 'windows-domain-join',
  icon: '▣',
  category: CAT,
  subcategory: 'Jonction de domaine',
  title: 'Joindre un poste Windows à un domaine, sans secret et sans redémarrage automatique',
  risk: 'caution',
  summary: 'Refait tous les contrôles de l’assistant de prérequis, puis — derrière une confirmation écrite, une console élevée et un journal écrit d’avance — appelle Add-Computer avec des informations d’identification demandées à l’écran. Aucun champ de mot de passe, aucun secret dans le script ni dans le journal, aucun redémarrage automatique, aucune modification du DNS, aucun renommage. Annonce la jonction « acceptée », jamais « réussie » : la vérification se fait après le redémarrage, à la main.',
  fields: [
    champMode('Diagnostic mesure et simule, sans rien joindre. Appliquer effectue la jonction, après tous les contrôles.'),
    {
      id: 'jdDomaine', label: 'Nom DNS du domaine', type: 'text',
      default: 'kjemo.local', placeholder: 'kjemo.local',
      help: 'Le nom DNS complet, avec son suffixe. C’est lui que l’applet attend, et lui qui porte les enregistrements SRV.',
    },
    {
      id: 'jdControleur', label: 'Contrôleur de domaine à éprouver (facultatif)', type: 'text',
      default: '', placeholder: 'dc01.kjemo.local',
      help: 'Sert aux mesures de ports et d’horloge. La jonction, elle, passe par les enregistrements SRV du domaine.',
    },
    {
      id: 'jdUniteOrg', label: 'Unité d’organisation du compte machine (facultatif)', type: 'text',
      default: '', placeholder: 'OU=Postes,DC=kjemo,DC=local',
      help: 'Nom distinctif complet. Vide, le compte machine va dans le conteneur par défaut des ordinateurs — ce qui est le comportement normal, et suffit dans la plupart des cas.',
    },
    champJournal('jdJournal', 'Le journal est écrit AVANT la jonction. Si son écriture échoue, la jonction est bloquée : pas de modification non traçable. Aucun mot de passe n’y figure.'),
    {
      id: 'jdConfirmation', label: 'Confirmation écrite', type: 'text',
      default: '', placeholder: 'JE JOINS CE POSTE AU DOMAINE',
      help: 'Joindre un poste crée un compte machine dans l’annuaire et change la façon dont les sessions s’ouvrent. Pour l’autoriser, retaper exactement : JE JOINS CE POSTE AU DOMAINE',
    },
    champFormat('jdFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'mode', validerModeExecution(v.mode));
    verifier(errors, 'jdDomaine', validerDomaineDns(v.jdDomaine));
    verifier(errors, 'jdControleur', validerHoteFacultatif(v.jdControleur, 'Le contrôleur de domaine'));
    verifier(errors, 'jdUniteOrg', validerUniteOrganisation(v.jdUniteOrg));
    verifier(errors, 'jdJournal', validerCheminWindowsLocal(v.jdJournal));
    if (v.mode === 'Appliquer') {
      if (String(v.jdConfirmation ?? '').trim() !== 'JE JOINS CE POSTE AU DOMAINE') {
        errors.jdConfirmation = 'Joindre un poste crée un compte machine dans l’annuaire et change la façon dont les sessions s’ouvrent sur cette machine. Pour le faire, retaper exactement : JE JOINS CE POSTE AU DOMAINE';
      }
    }
    verifier(errors, 'jdFormat', validerFormatRapport(v.jdFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const estAppliquer = v.mode === 'Appliquer';
    const unite = String(v.jdUniteOrg ?? '').trim();
    const parametres = [
      ['Mode', psB64(String(v.mode ?? 'Diagnostic'))],
      ['Domaine', psB64(String(v.jdDomaine ?? '').trim())],
      ['Controleur', psB64(String(v.jdControleur ?? '').trim())],
      ['UniteOrg', psB64(unite)],
      ['Journal', psB64(String(v.jdJournal ?? ''))],
      ['Confirmation', psB64(String(v.jdConfirmation ?? ''))],
    ];
    const corps = [
      blocVariables(parametres),
      blocFormatRapport(v.jdFormat),
      '',
      blocContextePoste(),
      '',
      blocMoteurPowerShell(),
      '',
      blocEditionWindows(),
      '',
      blocEtatAppartenance(),
      '',
      blocDnsDomaine(),
      '',
      blocHorloge(),
      '',
      blocConnectiviteDc(),
      '',
      blocAdminLocal(),
      '',
      "# --- La confirmation ecrite -------------------------------------------------------",
      "# La comparaison est sensible a la casse : une confirmation approximative",
      "# n'est pas une confirmation.",
      "$ConfirmationOk = ($Confirmation -ceq 'JE JOINS CE POSTE AU DOMAINE')",
      "[void](Add-KjemoResultat -Categorie 'Confirmation' -Controle 'Phrase exacte' -Etat (& { if ($ConfirmationOk) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($ConfirmationOk) { 'fournie' } else { 'absente ou inexacte' } }) -Commentaire 'Phrase attendue : JE JOINS CE POSTE AU DOMAINE')",
      '',
      blocGardienChemin(),
      '',
      "# Le dossier du journal passe par le gardien AVANT toute ecriture : un",
      '# chemin vide, relatif, racine de volume, UNC ou protege est refuse ici, et',
      '# aucun dossier ni fichier de journal ne sera cree.',
      "$journalCheminSur = Test-KjemoCheminSur -Chemin $Journal -Role 'Dossier du journal'",
      '$journalOk = $false',
      '$journalFichier = $null',
      'if (-not $journalCheminSur) {',
      "  [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Fichier' -Etat 'PROBLEME' -Valeur 'chemin refuse par le gardien' -Commentaire 'Aucun dossier et aucun fichier n''ont ete crees : le chemin a ete refuse AVANT toute ecriture. La jonction sera bloquee.')",
      '} elseif (-not [string]::IsNullOrWhiteSpace($Journal)) {',
      '  try {',
      '    if (-not (Test-Path -LiteralPath $Journal)) { [void](New-Item -ItemType Directory -Path $Journal -ErrorAction Stop) }',
      "    $journalFichier = Join-Path $Journal ('kjemo-jonction-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')",
      '    $entete = @()',
      "    $entete += '=== KJEMO — jonction de domaine ==='",
      "    $entete += ('Date      : ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))",
      "    $entete += ('Poste     : ' + $NomPoste)",
      "    $entete += ('Domaine   : ' + $Domaine)",
      "    $entete += ('Unite     : ' + (& { if ([string]::IsNullOrWhiteSpace($UniteOrg)) { '(conteneur par defaut)' } else { $UniteOrg } }))",
      "    $entete += ('Session   : ' + $env:USERNAME)",
      "    $entete += ('Elevation : ' + [string]$KjemoEleve)",
      "    $entete += 'Aucun mot de passe ne figure dans ce journal, par construction.'",
      '    Set-Content -LiteralPath $journalFichier -Value $entete -Encoding UTF8 -ErrorAction Stop',
      '    $journalOk = $true',
      "    [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Fichier' -Etat 'OK' -Valeur $journalFichier)",
      '  } catch {',
      '    $journalFichier = $null',
      "    [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Fichier' -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message) -Commentaire 'Sans journal, aucune jonction ne sera tentee.')",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Fichier' -Etat 'PROBLEME' -Valeur 'aucun dossier fourni' -Commentaire 'Le journal est obligatoire avant toute modification.')",
      '}',
      '',
      "# --- LE VERROU --------------------------------------------------------------------",
      '#',
      '# Toutes les conditions, reunies en une seule expression nommee. Une',
      "# verification qui ne bloque pas n'est pas une verification.",
      '#',
      "# « -not $DansDomaine » en fait partie : cet assistant ne deplace pas un",
      "# poste d'un domaine a un autre. Sortir du premier rend les profils du",
      '# domaine actuel inutilisables, et personne ne doit decouvrir cela parce',
      "# qu'un script l'a fait a sa place.",
      '$conditionsAppliquer = $KjemoEleve -and $ConfirmationOk -and $MoteurOk -and $EditionJoignable -and $NomPosteOk -and $ResolutionSrv -and $ReseauOk -and $AdminLocalOk -and $HorlogeOk -and $journalOk -and (-not $DansDomaine)',
      '',
      '$manquants = @()',
      "if (-not $KjemoEleve) { $manquants += 'console non elevee' }",
      "if (-not $ConfirmationOk) { $manquants += 'confirmation ecrite absente ou inexacte' }",
      "if (-not $MoteurOk) { $manquants += 'applet Add-Computer absente de ce moteur (ouvrir Windows PowerShell 5.1)' }",
      "if (-not $EditionJoignable) { $manquants += 'edition de Windows incompatible avec la jonction' }",
      "if (-not $NomPosteOk) { $manquants += 'nom de poste invalide ou trop long' }",
      "if (-not $ResolutionSrv) { $manquants += 'enregistrements SRV du domaine non resolus' }",
      "if (-not $ReseauOk) { $manquants += 'ports du controleur non joignables' }",
      "if (-not $AdminLocalOk) { $manquants += 'aucun administrateur LOCAL actif ne restera utilisable' }",
      "if (-not $HorlogeOk) { $manquants += 'ecart d''horloge non mesure ou superieur a 5 minutes' }",
      "if (-not $journalOk) { $manquants += 'journal non ecrit' }",
      "if ($DansDomaine) { $manquants += 'ce poste est deja joint a un domaine' }",
      '',
      "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Conditions prealables' -Etat 'PROBLEME' -Valeur ($manquants -join ' ; ') -Commentaire 'Le mode Appliquer exige toutes les conditions a la fois.')",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Jonction' -Etat 'IGNORE' -Valeur 'bloquee' -Commentaire 'Aucun compte machine n''a ete cree, et ce poste n''a ete joint a aucun domaine.')",
      "  Write-Host ''",
      "  Write-Host '--- Jonction BLOQUEE ---'",
      '  foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "} elseif ($Mode -eq 'Appliquer') {",
      '',
      "  # --- LES INFORMATIONS D'IDENTIFICATION, DEMANDEES A L'ECRAN ---------------------",
      '  #',
      "  # Get-Credential affiche une invite et garde le secret en memoire",
      '  # protegee. Il ne traverse ni le formulaire, ni ce fichier, ni le',
      '  # journal, ni le rapport. Un compte autorise a joindre des machines au',
      "  # domaine est un secret de domaine : il ne se tape pas dans un champ de",
      '  # page web, et il ne se stocke pas « pour la prochaine fois ».',
      '  $identifiants = $null',
      '  try {',
      "    $identifiants = Get-Credential -Message ('Compte autorise a joindre un poste au domaine ' + $Domaine + '. Il est demande ici, et n''est enregistre nulle part.')",
      '  } catch {',
      '    $identifiants = $null',
      '  }',
      '  if (-not $identifiants) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Identifiants' -Etat 'IGNORE' -Valeur 'non fournis' -Commentaire 'L''invite a ete annulee, ou la session n''est pas interactive. Rien n''a ete tente : la jonction exige un compte du domaine, demande a l''ecran.')",
      "    Write-Host ''",
      "    Write-Host '--- Jonction ABANDONNEE : aucun identifiant fourni ---'",
      '  } else {',
      "    Write-Host ''",
      "    Write-Host '--- Jonction au domaine ---'",
      '    $jonctionAcceptee = $false',
      '    $messageErreur = $null',
      '    try {',
      '      if ([string]::IsNullOrWhiteSpace($UniteOrg)) {',
      '        Add-Computer -DomainName $Domaine -Credential $identifiants -ErrorAction Stop',
      '      } else {',
      '        Add-Computer -DomainName $Domaine -OUPath $UniteOrg -Credential $identifiants -ErrorAction Stop',
      '      }',
      '      $jonctionAcceptee = $true',
      '    } catch {',
      '      $messageErreur = [string]$_.Exception.Message',
      '    }',
      '    $identifiants = $null',
      '',
      '    if ($messageErreur) {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-Computer' -Etat 'PROBLEME' -Valeur $messageErreur -Commentaire 'La jonction a echoue. Rien n''a ete redemarre, et le poste est reste dans l''etat ou il etait. L''assistant de diagnostic de jonction lit les causes les plus frequentes, dont le compte machine homonyme deja present dans l''annuaire.')",
      "      Write-Host ''",
      "      Write-Host '--- Jonction ECHOUEE ---'",
      '      Write-Host ("  " + $messageErreur)',
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Add-Computer' -Etat 'OK' -Valeur 'acceptee' -Commentaire 'L''applet n''a pas leve d''erreur : la demande a ete ACCEPTEE. Ce n''est pas la meme chose qu''une jonction effective — tant que le poste n''a pas redemarre, l''ouverture de session avec un compte du domaine n''est pas eprouvee. Aucune reussite n''est annoncee ici.')",
      '    }',
      '',
      "    # --- LA RELECTURE, ET CE QU'ELLE NE PEUT PAS ENCORE DIRE ----------------------",
      '    #',
      "    # On relit l'appartenance. Elle peut tres bien afficher encore l'etat",
      "    # d'avant : la jonction ne devient effective qu'au redemarrage. Dire",
      '    # « reussi » ici serait faux dans les deux sens — faux si la relecture',
      "    # n'a pas change, et insuffisant si elle a change.",
      '    $csApres = $null',
      '    try { $csApres = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue } catch { }',
      "    $etatApres = 'illisible'",
      "    if ($csApres) { $etatApres = (& { if ([bool]$csApres.PartOfDomain) { 'domaine ' + [string]$csApres.Domain } else { 'groupe de travail ' + [string]$csApres.Domain } }) }",
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Appartenance relue' -Etat 'INFO' -Valeur $etatApres -Commentaire 'Relue immediatement apres la demande. Cette valeur peut encore montrer l''etat d''AVANT : la jonction ne devient effective qu''au redemarrage. Ce n''est donc pas elle qui prouve quoi que ce soit, et c''est pourquoi aucune reussite n''est annoncee avant la relecture d''apres redemarrage.')",
      '',
      '    if ($journalFichier) {',
      '      try {',
      '        $lignes = @()',
      "        $lignes += ('Domaine demande : ' + $Domaine)",
      "        $lignes += ('Unite           : ' + (& { if ([string]::IsNullOrWhiteSpace($UniteOrg)) { '(conteneur par defaut)' } else { $UniteOrg } }))",
      "        $lignes += ('Demande         : ' + (& { if ($jonctionAcceptee) { 'ACCEPTEE' } else { 'ECHOUEE' } }))",
      "        if ($messageErreur) { $lignes += ('Message         : ' + $messageErreur) }",
      "        $lignes += ('Appartenance    : ' + $etatApres)",
      "        $lignes += 'Redemarrage     : A FAIRE A LA MAIN. Non effectue par ce script.'",
      "        $lignes += 'Verdict         : aucun. Il se prend apres redemarrage, par relecture.'",
      '        Add-Content -LiteralPath $journalFichier -Value $lignes -Encoding UTF8 -ErrorAction Stop',
      "        [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Resultat consigne' -Etat 'OK' -Valeur $journalFichier)",
      '      } catch {',
      "        [void](Add-KjemoResultat -Categorie 'Journal' -Controle 'Resultat consigne' -Etat 'PROBLEME' -Valeur ([string]$_.Exception.Message))",
      '      }',
      '    }',
      '',
      '    if ($jonctionAcceptee) {',
      "      Write-Host ''",
      "      Write-Host '=============================================================='",
      "      Write-Host 'LA DEMANDE EST ACCEPTEE. LA JONCTION N''EST PAS ENCORE EFFECTIVE.'",
      "      Write-Host '=============================================================='",
      "      Write-Host ''",
      "      Write-Host 'Ce script ne redemarre pas la machine, et c''est volontaire :'",
      "      Write-Host 'un poste qui redemarre sans prevenir emporte le travail non'",
      "      Write-Host 'enregistre de la personne assise devant.'",
      "      Write-Host ''",
      "      Write-Host '1. Previens la personne, et laisse-la enregistrer son travail.'",
      "      Write-Host '2. Redemarre le poste toi-meme, depuis le menu Demarrer.'",
      "      Write-Host '3. Apres le redemarrage, RELIS — une demande acceptee n''est'",
      "      Write-Host '   pas une jonction verifiee :'",
      "      Write-Host '     Get-CimInstance Win32_ComputerSystem | Select-Object PartOfDomain,Domain'",
      "      Write-Host '     Test-ComputerSecureChannel'",
      "      Write-Host '   La seconde doit rendre True : elle eprouve le canal'",
      "      Write-Host '   securise entre ce poste et le domaine.'",
      "      Write-Host '4. Ouvre une session avec un compte du domaine. Ce sera un'",
      "      Write-Host '   profil NEUF : bureau, documents et reglages du profil'",
      "      Write-Host '   local ne suivent pas, et personne ne doit le decouvrir'",
      "      Write-Host '   a ce moment-la.'",
      "      Write-Host ''",
      "      Write-Host 'Si quelque chose cloche apres le redemarrage, l''assistant'",
      "      Write-Host '« windows-domain-join-diagnostic » lit les causes une par une.'",
      "      Write-Host '=============================================================='",
      "      [void](Add-KjemoResultat -Categorie 'Suite' -Controle 'Redemarrage' -Etat 'ATTENTION' -Valeur 'a faire a la main' -Commentaire 'La jonction ne devient effective qu''au redemarrage, et ce script ne redemarre rien. Previens la personne, redemarre depuis le menu Demarrer, puis RELIS : Get-CimInstance Win32_ComputerSystem, et Test-ComputerSecureChannel qui doit rendre True. La premiere ouverture de session avec un compte du domaine creera un profil NEUF.')",
      '    }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      '  if ($conditionsAppliquer) {',
      "    Write-Host ('En mode Appliquer, le script demanderait un compte a l''ecran, puis joindrait ce poste au domaine ' + $Domaine + '.')",
      "    Write-Host 'Il ne redemarrerait PAS la machine, et n''annoncerait aucune'",
      "    Write-Host 'reussite : la verification se fait apres le redemarrage.'",
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'INFO' -Valeur ('jonction de ' + $NomPoste + ' au domaine ' + $Domaine))",
      '  } else {',
      "    Write-Host 'En mode Appliquer, le script SERAIT BLOQUE et ne joindrait rien.'",
      '    foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'PROBLEME' -Valeur 'serait bloque' -Commentaire ($manquants -join ' ; '))",
      '  }',
      '}',
      '',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Ce que ce script ne fait pas' -Etat 'INFO' -Valeur 'ni redemarrage, ni DNS, ni retrait, ni renommage' -Commentaire 'Aucun redemarrage automatique, aucune modification de serveur DNS, aucun retrait de domaine, aucun renommage de poste, et aucun mot de passe ecrit ou journalise.')",
      blocAucunSecret(),
      blocModeDiagnostic(),
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];
    return assembler({
      titre: 'Joindre un poste Windows a un domaine',
      outil: 'windows-domain-join',
      diagnostic: !estAppliquer,
      admin: true,
      parametres,
      corps,
      version: VERSION_JONCTION,
      prefixeFichier: 'kjemo-jonction-domaine',
      formats: v.jdFormat,
    });
  },
  gui: [
    'Paramètres > Système > Informations système > « Renommer ce PC (avancé) » > onglet Nom de l’ordinateur > Modifier > Membre d’un domaine.',
    'La boîte demande un compte autorisé à joindre des machines : c’est la même invite que celle du script, et le mot de passe n’est écrit nulle part.',
    'Windows propose ensuite de redémarrer. Prévenir la personne avant d’accepter : le travail non enregistré est perdu.',
    'Après le redémarrage : Paramètres > Système > Informations système doit afficher le domaine, et non un groupe de travail.',
    'Première ouverture de session avec un compte du domaine : « Autre utilisateur », puis DOMAINE\\compte. Un profil neuf est créé.',
  ],
  keywords: motsCles(
    'joindre domaine', 'jonction domaine', 'add-computer', 'compte machine',
    'active directory', 'ou path', 'unite organisation', 'get-credential',
    'domaine introuvable', 'redemarrage jonction', 'profil neuf domaine',
    'windows powershell 5.1', 'canal securise',
  ),
  requiresAdmin: true,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Une console Windows PowerShell 5.1 ÉLEVÉE : l’applet de jonction n’existe pas dans PowerShell 7, et la jonction exige l’élévation.',
    'Un compte autorisé à joindre des machines au domaine. Il est demandé à l’écran, au moment de la jonction, et n’est écrit nulle part.',
    'Les prérequis réseau remplis — DNS du domaine, enregistrements SRV, horloge à moins de cinq minutes. L’assistant de prérequis les mesure un par un.',
    'Un compte administrateur LOCAL actif, dont le mot de passe est connu : il sera le seul recours si le domaine devient injoignable.',
    'Un dossier de journal accessible en écriture. Si le journal échoue, la jonction est bloquée.',
    'Une fenêtre de redémarrage convenue avec la personne qui utilise le poste : la jonction ne devient effective qu’après, et le script ne redémarre rien.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: '« Un compte portant le même nom existe déjà dans Active Directory »',
      cause: 'Un compte machine homonyme est resté dans l’annuaire, souvent après une réinstallation du poste ou un retrait mal terminé.',
      fix: 'Faire supprimer ou réinitialiser le compte machine côté annuaire par un administrateur du domaine, puis réessayer. Ne pas renommer le poste pour contourner : le doublon reste, et il reviendra.',
    },
    {
      message: '« Le domaine spécifié n’existe pas ou n’a pas pu être contacté »',
      cause: 'Les enregistrements SRV ne se résolvent pas depuis ce poste — presque toujours parce que le DNS client n’est pas celui du domaine.',
      fix: 'Corriger les serveurs DNS de l’interface, puis vérifier avec « nslookup -type=SRV _ldap._tcp.dc._msdcs.<domaine> ». L’assistant de prérequis le mesure.',
    },
    {
      message: 'La jonction est acceptée et la session du domaine refuse de s’ouvrir',
      cause: 'Le poste n’a pas redémarré. Tant qu’il ne l’a pas fait, la jonction n’est pas effective.',
      fix: 'Redémarrer depuis le menu Démarrer, puis relire : Test-ComputerSecureChannel doit rendre True.',
    },
    {
      message: 'La personne ne retrouve ni son bureau ni ses documents après la jonction',
      cause: 'La première ouverture de session avec un compte du domaine crée un profil NEUF. Le profil local existe toujours, il n’est simplement pas celui-là.',
      fix: 'C’est le comportement normal, et il se prévient : annoncer ce point AVANT de joindre. Les données du profil local restent dans C:\\Utilisateurs\\<ancien compte>.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport dit « acceptée » et jamais « réussie » : aucune réussite n’est annoncée avant la relecture d’après redémarrage.',
    'Après le redémarrage, à la main : Get-CimInstance Win32_ComputerSystem montre PartOfDomain à True et le nom du domaine.',
    'Après le redémarrage : Test-ComputerSecureChannel rend True — c’est lui qui éprouve le canal sécurisé.',
    'Le compte machine existe dans l’annuaire, dans l’unité d’organisation demandée s’il y en avait une.',
    'Une session s’ouvre avec un compte du domaine, et le profil créé est neuf — ce qui était annoncé.',
    'Le journal contient le domaine, l’unité, l’état de la demande et la mention explicite que le redémarrage reste à faire.',
  ],
  rollback: {
    summary: 'Tant que le poste n’a pas redémarré, la jonction n’est pas effective : il reste un compte machine créé dans l’annuaire, que l’administrateur du domaine peut supprimer. Après le redémarrage, le retour en arrière est un retrait de domaine — opération que cet assistant ne fait PAS, parce qu’elle rend les profils du domaine inutilisables sur ce poste et qu’elle exige un compte administrateur local dont le mot de passe est connu. Les deux chemins sont décrits ci-dessous, et les deux se font à la main.',
    diagnostic: '# L\'etat reel, apres redemarrage :\nGet-CimInstance Win32_ComputerSystem | Select-Object Name,PartOfDomain,Domain,Workgroup\nTest-ComputerSecureChannel\n# Et le journal laisse par l assistant :\nGet-ChildItem C:\\Kjemo\\Journaux\\kjemo-jonction-*.txt | Sort-Object LastWriteTime | Select-Object -Last 1',
    command: `# Cas 1 — la demande a ete acceptee et le poste n a PAS redemarre.
# Il n y a rien a defaire sur le poste. Faire supprimer le compte
# machine dans l annuaire par un administrateur du domaine.

# Cas 2 — le poste a redemarre et il est joint. Le retour au groupe
# de travail se fait A LA MAIN, et dans cet ordre :
#   1. verifier qu un compte administrateur LOCAL actif existe et que
#      son mot de passe est connu. Sans lui, le poste devient
#      inadministrable des la sortie du domaine :
Get-LocalGroupMember -SID 'S-1-5-32-544'
#   2. prevenir la personne : ses documents du profil de domaine ne
#      seront plus accessibles depuis le profil local.
#   3. sortir du domaine, en ouvrant une invite elevee, avec la
#      commande Remove-Computer et son parametre -WorkgroupName.
#      Elle n est PAS ecrite ici sous forme executable, pour qu elle
#      ne soit pas copiee sans avoir lu les deux points precedents.
#   4. redemarrer depuis le menu Demarrer, puis RELIRE :
Get-CimInstance Win32_ComputerSystem | Select-Object PartOfDomain,Domain,Workgroup
#   5. faire supprimer le compte machine dans l annuaire.`,
    warning: 'Ne sors jamais un poste d’un domaine sans un compte administrateur local actif dont le mot de passe est connu : à la fermeture de session suivante, plus personne n’entre. Et le profil du domaine n’est pas transféré au profil local — les données restent sur le disque, mais sous un autre compte.',
  },
  checks: [
    'Aucun champ de mot de passe dans le formulaire, aucun secret dans le script, aucun secret dans le journal ni dans le rapport.',
    'Les informations d’identification sont demandées à l’écran par Get-Credential, et la variable qui les porte est vidée juste après l’appel.',
    'Aucun redémarrage automatique : le paramètre de redémarrage de l’applet n’est pas utilisé, et aucun équivalent n’est appelé.',
    'Aucune modification de serveur DNS, aucun renommage de poste, aucun retrait de domaine.',
    'Le verrou exige onze conditions à la fois, console élevée et journal écrit compris, et nomme celles qui manquent.',
    'Un poste déjà joint à un domaine est refusé : déplacer un poste d’un domaine à un autre est une autre opération, et elle rend les profils inutilisables.',
    'La jonction est annoncée « acceptée », jamais « réussie » : la relecture d’après redémarrage est présentée comme le seul verdict.',
    'Le journal est écrit AVANT la jonction, et son échec la bloque.',
    'Le dossier du journal passe par le gardien de chemin, qui refuse avant toute création de dossier.',
  ],
  source: SRC_ADD,
  sources: [
    { label: 'Add-Computer — publiée pour Windows PowerShell 5.1', url: SRC_ADD },
    { label: 'Get-Credential — l’invite qui n’écrit rien', url: SRC_CRED },
    { label: 'Joindre un ordinateur à un domaine', url: SRC_JOIN },
    { label: 'Remove-Computer — le retour au groupe de travail', url: SRC_REMOVE },
    { label: 'Test-ComputerSecureChannel', url: SRC_CANAL },
    { label: 'Win32_ComputerSystem', url: SRC_CS },
  ],
};

// ===========================================================================
// 3. windows-domain-join-diagnostic
// ===========================================================================

export const outilJonctionDiagnostic = {
  id: 'windows-domain-join-diagnostic',
  icon: '◇',
  category: CAT,
  subcategory: 'Jonction de domaine',
  title: 'Diagnostiquer une jonction de domaine qui a échoué, ou un poste joint qui ne s’ouvre plus',
  risk: 'diagnostic',
  summary: 'Sépare les deux pannes qu’on confond : « la jonction a échoué » et « le poste est joint et quelque chose ne marche plus ». Lit l’appartenance réelle par PartOfDomain, éprouve le canal sécurisé avec Test-ComputerSecureChannel sans jamais le réparer, contrôle la résolution des enregistrements SRV, l’écart d’horloge, la joignabilité des ports et le pare-feu, relit les événements Netlogon et d’ouverture de session, et explique le compte machine homonyme — la cause qu’on cherche le plus longtemps. Ne répare rien, ne retire aucun domaine, ne réinitialise aucun mot de passe de compte machine.',
  fields: [
    {
      id: 'jgDomaine', label: 'Domaine attendu (vide = celui du poste)', type: 'text',
      default: '', placeholder: 'kjemo.local', optionnel: true,
      help: 'Vide, l’assistant prend le domaine auquel le poste se dit joint. Renseigné, il compare ce qui est attendu à ce qui est constaté — utile quand la jonction a échoué et que le poste n’est dans aucun domaine.',
    },
    {
      id: 'jgControleur', label: 'Contrôleur de domaine à éprouver (facultatif)', type: 'text',
      default: '', placeholder: 'dc01.kjemo.local',
      help: 'Cible des mesures de ports et d’écart d’horloge. Vide, elles portent sur le nom du domaine.',
    },
    {
      id: 'jgJours', label: 'Fenêtre des événements (jours)', type: 'number',
      default: '7', min: 1, max: 60,
      help: 'Événements Netlogon et d’ouverture de session relus sur cette fenêtre.',
    },
    champFormat('jgFormat'),
  ],
  validate(v) {
    const errors = {};
    const d = String(v.jgDomaine ?? '').trim();
    if (d !== '') verifier(errors, 'jgDomaine', validerDomaineDns(d));
    verifier(errors, 'jgControleur', validerHoteFacultatif(v.jgControleur, 'Le contrôleur de domaine'));
    verifier(errors, 'jgJours', validerEntier(v.jgJours, 1, 60, 'La fenêtre'));
    verifier(errors, 'jgFormat', validerFormatRapport(v.jgFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const jours = validerEntier(v.jgJours, 1, 60, 'La fenêtre').value;
    const parametres = [
      ['DomaineAttendu', psB64(String(v.jgDomaine ?? '').trim())],
      ['Controleur', psB64(String(v.jgControleur ?? '').trim())],
      ['Jours', psB64(String(jours))],
    ];
    const corps = [
      blocVariables(parametres),
      blocFormatRapport(v.jgFormat),
      '',
      blocContextePoste(),
      '',
      blocMoteurPowerShell(),
      '',
      blocEtatAppartenance(),
      '',
      "# --- Quel domaine examiner ? -------------------------------------------------------",
      '#',
      "# Si le champ est vide, on prend celui auquel le poste se dit joint. S'il",
      "# n'est dans aucun domaine, il n'y a pas de domaine a examiner, et le",
      '# rapport le dit au lieu de mesurer dans le vide.',
      '$Domaine = $DomaineAttendu',
      'if ([string]::IsNullOrWhiteSpace($Domaine) -and $DansDomaine) { $Domaine = $AppartenanceNom }',
      '$DomaineConnu = -not [string]::IsNullOrWhiteSpace($Domaine)',
      'if (-not $DomaineConnu) {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Domaine examine' -Etat 'PROBLEME' -Valeur 'aucun' -Commentaire 'Ce poste n''est dans aucun domaine et aucun domaine attendu n''a ete indique. Les controles reseau n''ont donc pas de cible : renseigne le domaine attendu pour que l''assistant puisse dire pourquoi la jonction echouerait.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Domaine examine' -Etat 'INFO' -Valeur $Domaine -Commentaire (& { if ($DansDomaine) { 'Domaine auquel ce poste se dit joint.' } else { 'Domaine attendu, fourni au formulaire : ce poste n''y est PAS joint, et les controles ci-dessous disent ce qui s''y oppose.' } }))",
      '}',
      '',
      "# --- LE CANAL SECURISE, et pourquoi il n'est pas repare ici ----------------------",
      '#',
      '# Test-ComputerSecureChannel rend True ou False. Un False signifie que le',
      '# mot de passe du COMPTE MACHINE ne correspond plus a celui que connait',
      '# le domaine : le poste est joint sur le papier, et le domaine ne le',
      '# reconnait plus. Le symptome est « la relation d approbation entre cette',
      '# station de travail et le domaine principal a echoue ».',
      '#',
      "# Cette applet sait REPARER, avec un parametre que ce script n'utilise",
      '# pas. Une reparation exige des informations d identification du domaine,',
      '# change le mot de passe du compte machine, et doit etre decidee en',
      '# sachant si le compte machine a ete recree entre-temps : ce sont trois',
      "# raisons de ne pas l'automatiser dans un assistant de DIAGNOSTIC.",
      '$CanalOk = $null',
      "if ($DansDomaine -and (Get-Command -Name 'Test-ComputerSecureChannel' -ErrorAction SilentlyContinue)) {",
      '  try { $CanalOk = [bool](Test-ComputerSecureChannel -ErrorAction SilentlyContinue) } catch { $CanalOk = $null }',
      '  if ($CanalOk -eq $true) {',
      "    [void](Add-KjemoResultat -Categorie 'Canal securise' -Controle 'Test-ComputerSecureChannel' -Etat 'OK' -Valeur 'True' -Commentaire 'Le canal securise entre ce poste et le domaine est sain : le mot de passe du compte machine correspond. Si une session refuse quand meme de s''ouvrir, la cause est ailleurs — horloge, DNS, ou le compte de la personne.')",
      '  } elseif ($CanalOk -eq $false) {',
      "    [void](Add-KjemoResultat -Categorie 'Canal securise' -Controle 'Test-ComputerSecureChannel' -Etat 'PROBLEME' -Valeur 'False' -Commentaire 'Le canal securise est ROMPU : le mot de passe du compte machine ne correspond plus a celui que connait le domaine. C''est le message « la relation d''approbation entre cette station de travail et le domaine principal a echoue ». Causes habituelles : le poste a ete restaure depuis une image ancienne, ou le compte machine a ete recree dans l''annuaire. La reparation se decide — elle exige un compte du domaine et change le mot de passe du compte machine — et cet assistant de diagnostic ne la fait pas a ta place.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Canal securise' -Controle 'Test-ComputerSecureChannel' -Etat 'ATTENTION' -Valeur 'non concluant' -Commentaire 'L''epreuve du canal securise n''a pas abouti : le domaine n''etait peut-etre pas joignable au moment du test. Ce n''est pas un canal sain, c''est une mesure absente.')",
      '  }',
      '} elseif (-not $DansDomaine) {',
      "  [void](Add-KjemoResultat -Categorie 'Canal securise' -Controle 'Test-ComputerSecureChannel' -Etat 'IGNORE' -Valeur 'poste hors domaine' -Commentaire 'Le canal securise n''existe que pour un poste joint. Ici, la question est celle de la jonction elle-meme.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Canal securise' -Controle 'Test-ComputerSecureChannel' -Etat 'IGNORE' -Valeur 'applet absente' -Commentaire 'L''applet d''epreuve du canal securise est absente de ce moteur. Elle fait partie de Windows PowerShell 5.1.')",
      '}',
      '',
      '# --- Les controles reseau, quand une cible existe ---------------------------------',
      'if ($DomaineConnu) {',
      '',
      blocDnsDomaine(),
      '',
      blocHorloge(),
      '',
      blocConnectiviteDc(),
      '',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'DNS' -Controle 'Controles reseau' -Etat 'IGNORE' -Valeur 'aucune cible' -Commentaire 'Aucun domaine a examiner : les controles DNS, horloge et ports n''ont PAS ete faits.')",
      '}',
      '',
      '# --- Le compte machine homonyme, la cause qu on cherche le plus longtemps ---------',
      '#',
      "# Elle ne se voit pas depuis le poste : c'est dans l'annuaire que le",
      "# doublon existe. L'assistant ne peut donc pas la mesurer d'ici — il",
      '# serait malhonnete de pretendre le contraire — mais il peut la NOMMER,',
      '# avec ce qui la distingue des autres.',
      "[void](Add-KjemoResultat -Categorie 'Annuaire' -Controle 'Compte machine homonyme' -Etat 'INFO' -Valeur 'non verifiable depuis ce poste' -Commentaire 'Un compte machine portant deja ce nom dans l''annuaire fait echouer la jonction avec « un compte portant le meme nom existe deja ». Il reste apres une reinstallation du poste ou un retrait mal termine. Cette verification se fait COTE ANNUAIRE, par un administrateur du domaine, et pas depuis ici : l''affirmer mesurable serait faux. Ne pas renommer le poste pour contourner — le doublon reste, et il revient.')",
      '',
      "# --- Le pare-feu, et les profils -------------------------------------------------",
      "if (Get-Command -Name 'Get-NetFirewallProfile' -ErrorAction SilentlyContinue) {",
      '  $profils = @()',
      '  try { $profils = @(Get-NetFirewallProfile -ErrorAction SilentlyContinue) } catch { }',
      '  foreach ($p in $profils) {',
      "    [void](Add-KjemoResultat -Categorie 'Pare-feu' -Controle ('Profil ' + [string]$p.Name) -Etat 'INFO' -Valeur (& { if ([bool]$p.Enabled) { 'actif' } else { 'inactif' } }) -Commentaire 'Le profil « Domain » ne s''active que lorsque le poste reconnait son domaine : voir le profil « Public » actif sur un poste cense etre joint est un symptome, pas une cause. Ce script ne modifie aucun profil ni aucune regle.')",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Pare-feu' -Controle 'Profils' -Etat 'IGNORE' -Valeur 'applet absente' -Commentaire 'Les profils de pare-feu n''ont PAS ete lus.')",
      '}',
      '',
      '# --- Les evenements : Netlogon d abord, le reste ensuite --------------------------',
      '$evts = @()',
      'try {',
      "  $evts = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'NETLOGON'; StartTime = (Get-Date).AddDays(-" + String(jours) + ") } -ErrorAction SilentlyContinue)",
      '} catch { }',
      'if ($evts.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Evenements' -Controle 'Netlogon' -Etat 'OK' -Valeur 'aucun evenement' -Commentaire 'Sur la fenetre analysee. Un journal vide est une information : le service d''ouverture de session reseau ne s''est plaint de rien.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Evenements' -Controle 'Netlogon' -Etat 'ATTENTION' -Valeur ([string]$evts.Count) -Commentaire 'Le service d''ouverture de session reseau a ecrit dans le journal. Ces lignes nomment le controleur qu''il a cherche et ce qu''il n''a pas trouve : elles valent mieux que le message affiche a l''ecran.')",
      '  foreach ($e in ($evts | Select-Object -First 10)) {',
      '    $m = [string]$e.Message',
      '    if ($m.Length -gt 220) { $m = $m.Substring(0, 220) }',
      "    [void](Add-KjemoResultat -Categorie 'Evenements' -Controle ('ID ' + [string]$e.Id + ' du ' + [string]$e.TimeCreated) -Etat 'INFO' -Valeur ([string]$e.LevelDisplayName) -Commentaire $m)",
      '  }',
      '}',
      '',
      "# --- LE VERDICT, qui separe les deux pannes ---------------------------------------",
      'if (-not $DansDomaine) {',
      "  [void](Add-KjemoResultat -Categorie 'Verdict' -Controle 'Nature de la panne' -Etat 'PROBLEME' -Valeur 'le poste n est pas joint' -Commentaire 'Ce poste n''est dans aucun domaine : la panne est celle de la JONCTION, et elle se lit dans les lignes DNS, horloge et ports ci-dessus. L''assistant « windows-domain-join-readiness » mesure la meme chose avant de tenter quoi que ce soit.')",
      '} elseif ($CanalOk -eq $false) {',
      "  [void](Add-KjemoResultat -Categorie 'Verdict' -Controle 'Nature de la panne' -Etat 'PROBLEME' -Valeur 'canal securise rompu' -Commentaire 'Le poste est joint et le domaine ne le reconnait plus. La reparation change le mot de passe du compte machine et exige un compte du domaine : elle se decide, et elle ne figure dans aucun assistant de diagnostic. Verifier d''abord, cote annuaire, que le compte machine n''a pas ete recree.')",
      '} elseif ($CanalOk -eq $true) {',
      "  [void](Add-KjemoResultat -Categorie 'Verdict' -Controle 'Nature de la panne' -Etat 'OK' -Valeur 'jonction et canal sains' -Commentaire 'Le poste est joint et le canal securise est sain. Si une session refuse de s''ouvrir, chercher du cote du compte de la personne, de l''horloge, ou de la joignabilite du controleur au moment de l''ouverture — et non du cote de la jonction.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Verdict' -Controle 'Nature de la panne' -Etat 'ATTENTION' -Valeur 'indeterminee' -Commentaire 'Le poste se dit joint, et l''epreuve du canal securise n''a pas abouti. Une mesure absente n''est pas un verdict : relancer quand le controleur est joignable.')",
      '}',
      blocAucunSecret(),
      blocConsoleOuverte(),
      blocAucunContournementPoste(),
    ];
    return assembler({
      titre: 'Diagnostiquer une jonction de domaine',
      outil: 'windows-domain-join-diagnostic',
      diagnostic: true,
      admin: false,
      parametres,
      corps,
      version: VERSION_JONCTION,
      prefixeFichier: 'kjemo-jonction-diagnostic',
      formats: v.jgFormat,
    });
  },
  gui: [
    'Paramètres > Système > Informations système : la ligne « Domaine » ou « Groupe de travail » dit laquelle des deux pannes on a.',
    'Observateur d’événements > Journaux Windows > Système, source NETLOGON : le nom du contrôleur cherché, et ce qui n’a pas été trouvé.',
    'Invite de commandes : « nslookup -type=SRV _ldap._tcp.dc._msdcs.<domaine> » — sans réponse, rien d’autre ne marchera.',
    'Paramètres > Heure et langue : un écart de plus de cinq minutes avec le contrôleur suffit à faire refuser une session.',
    'wf.msc : le profil actif du pare-feu. « Public » sur un poste censé être joint est un symptôme, pas une cause.',
  ],
  keywords: motsCles(
    'relation approbation echouee', 'canal securise', 'test-computersecurechannel',
    'netlogon', 'jonction echouee', 'compte machine existe deja', 'domaine introuvable',
    'session domaine refusee', 'srv absent', 'horloge kerberos', 'diagnostic jonction',
    'partofdomain', 'profil pare-feu domaine',
  ),
  requiresAdmin: false,
  os: OS_POSTE,
  prereqs: PREREQS_POSTE.concat([
    'Aucune élévation n’est nécessaire pour la plupart des lectures ; celles qui en demanderaient une sont annoncées IGNORE.',
    'Si le poste n’est dans aucun domaine, renseigner le domaine attendu : sans cible, les contrôles réseau n’ont rien à mesurer.',
    'Windows PowerShell 5.1 pour que l’épreuve du canal sécurisé soit disponible.',
    'La vérification d’un compte machine homonyme se fait côté annuaire, par un administrateur du domaine : elle n’est pas possible depuis le poste.',
  ]),
  commonErrors: ERREURS_POSTE.concat([
    {
      message: '« La relation d’approbation entre cette station de travail et le domaine principal a échoué »',
      cause: 'Le mot de passe du compte machine ne correspond plus à celui que connaît le domaine : poste restauré depuis une image ancienne, ou compte machine recréé dans l’annuaire.',
      fix: 'Vérifier d’abord côté annuaire que le compte machine n’a pas été recréé. La réparation du canal sécurisé change ce mot de passe et exige un compte du domaine : elle se décide, et aucun assistant de diagnostic ne la fait.',
    },
    {
      message: 'Test-ComputerSecureChannel ne rend ni True ni False',
      cause: 'Le domaine n’était pas joignable au moment du test.',
      fix: 'C’est une mesure absente, pas un canal sain. Relancer quand le contrôleur répond — les lignes de ports du rapport disent s’il répond.',
    },
    {
      message: 'Le poste affiche le profil de pare-feu « Public » alors qu’il est joint',
      cause: 'Le profil « Domain » ne s’active que lorsque le poste reconnaît son domaine, ce qui suppose de le joindre réseau.',
      fix: 'Traiter la cause — DNS, ports, canal sécurisé — et non le profil : changer le profil à la main masquerait le symptôme.',
    },
    {
      message: 'Tout semble correct et la session du domaine refuse encore de s’ouvrir',
      cause: 'La jonction n’est pas en cause : compte de la personne désactivé ou expiré, écart d’horloge, ou contrôleur injoignable au moment précis de l’ouverture.',
      fix: 'Lire le verdict du rapport : il distingue « panne de jonction » de « poste joint et sain », ce qui évite de chercher au mauvais endroit.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le verdict final dit laquelle des deux pannes on a : jonction absente, canal rompu, ou poste joint et sain.',
    'Le canal sécurisé est éprouvé et jamais réparé — et le rapport dit pourquoi la réparation ne figure pas ici.',
    'Une épreuve non concluante est rapportée ATTENTION, jamais OK : une mesure absente n’est pas un canal sain.',
    'Les enregistrements SRV, l’écart d’horloge et les ports sont rapportés séparément, chacun avec sa conséquence.',
    'Le compte machine homonyme est nommé comme cause probable, et explicitement déclaré non vérifiable depuis le poste.',
    'Les événements Netlogon sont relus : ils nomment le contrôleur cherché, ce que le message à l’écran ne fait pas.',
  ],
  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne répare pas le canal sécurisé, ne retire aucun domaine, ne réinitialise aucun mot de passe de compte machine, ne modifie aucun profil de pare-feu et ne touche à aucun serveur DNS. Chacune de ces réparations se décide en connaissance de cause, et deux d’entre elles exigent un compte du domaine.',
    diagnostic: '# Les trois lectures qui separent les deux pannes :\nGet-CimInstance Win32_ComputerSystem | Select-Object Name,PartOfDomain,Domain,Workgroup\nTest-ComputerSecureChannel\nGet-WinEvent -FilterHashtable @{ LogName = \'System\'; ProviderName = \'NETLOGON\' } -MaxEvents 20',
    command: `# Aucune modification a annuler : cet assistant lit.
#
# Les reparations qu il NOMME sans les faire, et ce qu elles coutent :
#   - canal securise rompu : la reparation change le mot de passe du
#     compte machine et exige un compte du domaine. Verifier d abord,
#     cote annuaire, que le compte machine n a pas ete recree.
#   - compte machine homonyme : suppression cote annuaire, par un
#     administrateur du domaine. Ne pas renommer le poste pour
#     contourner — le doublon reste.
#   - DNS client errone : correction a la main, depuis le poste.
#
# Et la relecture, parce qu une reparation ne prouve pas un etat :
Test-ComputerSecureChannel`,
    warning: 'Un canal sécurisé rompu se répare parfois en re-joignant le poste, et c’est souvent le pire choix : si le compte machine a été recréé dans l’annuaire, on empile les doublons. Regarder l’annuaire avant de toucher au poste.',
  },
  checks: [
    'Aucune écriture : aucun canal réparé, aucun domaine retiré, aucun mot de passe de compte machine réinitialisé, aucun profil de pare-feu modifié.',
    'PartOfDomain et Domain sont lues ensemble : la seconde contient le groupe de travail quand le poste n’est pas joint.',
    'Le canal sécurisé est éprouvé en lecture seule, et le paramètre de réparation de l’applet n’est pas utilisé.',
    'Une épreuve non concluante est distinguée d’un échec et d’une réussite : trois états, pas deux.',
    'Les contrôles réseau sont annoncés IGNORE quand aucun domaine n’est à examiner, au lieu de mesurer dans le vide.',
    'Le compte machine homonyme est déclaré non vérifiable depuis le poste — l’affirmer mesurable serait faux.',
    'Le verdict distingue explicitement la panne de jonction de la panne d’un poste déjà joint.',
  ],
  source: SRC_CANAL,
  sources: [
    { label: 'Test-ComputerSecureChannel', url: SRC_CANAL },
    { label: 'Win32_ComputerSystem — PartOfDomain', url: SRC_CS },
    { label: 'Resolve-DnsName', url: SRC_DNS },
    { label: 'Reset-ComputerMachinePassword — la réparation qui se décide', url: SRC_MDP_MACHINE },
    { label: 'Service de temps Windows', url: SRC_TEMPS },
    { label: 'Rename-Computer — pourquoi on ne renomme pas pour contourner', url: SRC_RENAME },
  ],
};

export const toolsPosteJonction = [
  outilJonctionPrerequis,
  outilJonctionDomaine,
  outilJonctionDiagnostic,
];
