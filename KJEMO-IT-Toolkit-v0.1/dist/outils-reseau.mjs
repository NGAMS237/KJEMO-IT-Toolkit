/**
 * outils-reseau.mjs — LOT 5 · KJEMO IT Toolkit
 * ---------------------------------------------
 * Les vingt-deux assistants de la catégorie « Réseau ».
 *
 * Ce module suit exactement la forme des précédents : il importe psB64 et
 * assertValid du noyau, les validateurs partagés, les blocs de rapport et les
 * assembleurs communs d'outils-serveur.mjs. Aucun import circulaire :
 * generators.mjs importe ce module, jamais l'inverse. Aucun validateur n'est
 * redéfini ici.
 *
 * ---------------------------------------------------------------------------
 * Où s'arrête ce lot, et pourquoi
 * ---------------------------------------------------------------------------
 *
 * 1. CLIENT, pas serveur. Le rôle DHCP et le rôle DNS Server restent dans
 *    Windows Server. Ici, DHCP veut dire « le bail de cette machine » et DNS
 *    veut dire « ce que ce poste demande et ce qu'on lui répond ». Confondre
 *    les deux fait chercher un problème de serveur quand c'est le client qui
 *    a un suffixe de travers.
 *
 * 2. DIAGNOSTIQUER, pas reconfigurer. Dix-neuf assistants sur vingt-deux
 *    n'écrivent rien. Les trois qui peuvent écrire — cache DNS, serveurs DNS
 *    du client, route statique — partent en mode Diagnostic, montrent ce
 *    qu'ils feraient, et donnent la commande d'annulation exacte.
 *
 * 3. DÉFENSIF, pas offensif. Toute découverte se limite au sous-réseau privé
 *    local, s'arrête à /24 et à 254 hôtes, ne dépasse pas vingt ports nommés,
 *    borne sa concurrence et son délai. Aucune furtivité, aucun balayage UDP,
 *    aucune tentative d'exploitation, aucune collecte d'identifiant. Un
 *    assistant qui refuse dit pourquoi il refuse.
 *
 * 4. AUCUN SECRET. Pas de clé Wi-Fi affichée, pas de mot de passe demandé,
 *    pas d'identifiant écrit dans un rapport, pas de validation TLS
 *    désactivée. Ces quatre interdits sont vérifiés par assertion sur chaque
 *    script généré.
 *
 * 5. AUCUNE BOUCLE SANS FIN. Chaque mesure porte un nombre d'essais et un
 *    délai, tous deux bornés et validés. « ping -t » n'est pas un diagnostic.
 */

import { psB64, assertValid } from './noyau.mjs';
import {
  validateIPv4,
  validerIPv6,
  validerPrefixe,
  validerMasque,
  validerReseauCidr,
  validerFqdn,
  validerNomHote,
  validerCheminUnc,
  validerCheminWindowsLocal,
  validerLettreLecteur,
  validerEntier,
  validerChoix,
  validerFormatRapport,
  validerModeExecution,
  validerListeIPv4,
  validateShareName,
  ipVersEntier,
  entierVersIp,
  adresseReseau,
  prefixeVersMasque,
  ipDansReseau,
  validerPort,
  validerListePorts,
  validerDelaiMs,
  validerNombreEssais,
  validerCibleReseau,
  validerUrlHttpOuHttps,
  validerPlageDecouverte,
  validerConcurrence,
  validerNomProfilWifi,
  validerIndexInterface,
  validerSuffixeDns,
  estPlagePrivee,
  PORTS_MAX_PAR_LISTE,
  PREFIXE_DECOUVERTE_MIN,
  HOTES_DECOUVERTE_MAX,
} from './validateurs.mjs';
import {
  calculerSousReseau,
  memeSousReseau,
  decouperSousReseaux,
  prefixeDeMasque,
} from './calcul-ip.mjs';
import { blocModeDiagnostic } from './rapport-ps.mjs';
import { champMode, champFormat, verifier, assembler, PREREQS_SERVEUR } from './outils-serveur.mjs';

/**
 * Version portée par les vingt-deux assistants de ce lot.
 *
 * Les scripts du LOT 5 annonçaient « LOT 2 — 2.0.0 », par héritage du gabarit
 * commun. C'était faux : ils ne viennent pas du LOT 2, et un rapport remonté
 * du terrain devient inexploitable quand sa ligne de version désigne un autre
 * lot.
 *
 * Elle est passée explicitement à `assembler`, outil par outil, et nulle part
 * ailleurs : les 440 scripts antérieurs gardent VERSION_OUTILS, et restent
 * donc identiques octet pour octet. La dette historique — des scripts des
 * LOTS 3 et 4 qui portent encore l'ancienne version — est consignée dans le
 * rapport et ne sera réglée que par une migration globale explicitement
 * autorisée.
 */
export const VERSION_RESEAU = 'LOT 5 — Réseau avancé — 5.0.0';

// ---------------------------------------------------------------------------
// Socle commun
// ---------------------------------------------------------------------------

/** Systèmes couverts par ce lot. Le réseau se diagnostique aussi depuis un poste. */
export const OS_RESEAU = [
  'Windows 10 22H2 et Windows 11',
  'Windows Server 2016, Windows Server 2019, Windows Server 2022 et Windows Server 2025',
  'Windows PowerShell 5.1 (moteur de référence)',
  'PowerShell 7.4 et plus récent',
];

/** Prérequis communs. Le réseau se diagnostique souvent sans être administrateur. */
export const PREREQS_RESEAU = [
  'Windows PowerShell 5.1 ou PowerShell 7.',
  'Les applets du module NetTCPIP, livré avec Windows : aucune installation.',
  'La plupart des contrôles de ce lot fonctionnent sans élévation ; ceux qui en ont besoin le disent.',
];

/** Erreurs qu'on rencontre dans tout ce lot. */
export const ERREURS_RESEAU = [
  {
    message: 'Le terme « Test-NetConnection » n’est pas reconnu',
    cause: 'Le module NetTCPIP n’est pas chargé, ou la session tourne sous une édition très ancienne de PowerShell.',
    fix: 'Lancer « Import-Module NetTCPIP », puis vérifier la version avec $PSVersionTable. Sur Windows PowerShell 5.1 et plus récent, le module est présent d’origine.',
  },
  {
    message: 'Test-NetConnection répond « PingSucceeded : False » alors que le poste est joignable',
    cause: 'Le pare-feu de la cible bloque l’écho ICMP. Beaucoup de parcs le bloquent par défaut.',
    fix: 'Un ping qui échoue ne prouve pas qu’un hôte est éteint. Tester le port qui compte réellement, avec -Port.',
  },
  {
    message: 'La résolution de noms donne une adresse, mais rien ne répond dessus',
    cause: 'Un enregistrement DNS périmé, ou une entrée de cache qui survit à un changement d’adresse.',
    fix: 'Comparer la réponse du cache et celle du serveur, avec l’assistant de diagnostic DNS client.',
  },
];

/** Champ « cible » commun aux tests de connectivité. */
export function champCible(id = 'cible', aide = 'Nom ou adresse de la machine à joindre.', defaut = 'srv-fichiers.hopitalbn.lan') {
  return {
    id,
    label: 'Cible (nom ou adresse)',
    default: defaut,
    help: aide,
  };
}

/**
 * En-tête commun des scripts réseau : il nomme la machine qui exécute, parce
 * qu'un diagnostic réseau ne veut rien dire sans savoir d'où il a été pris.
 */
export function blocContexteReseau() {
  return [
    '# --- Contexte : d\'ou ce diagnostic a-t-il ete pris ? ------------------------------',
    '# Un resultat reseau ne veut rien dire sans ce bloc. La meme commande, lancee',
    "# depuis un autre poste ou sur une autre carte, peut repondre l'inverse.",
    '$carteActive = $null',
    'try {',
    '  $carteActive = Get-NetIPConfiguration -ErrorAction SilentlyContinue |',
    '    Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1',
    '} catch { }',
    "[void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Machine' -Etat 'INFO' -Valeur $env:COMPUTERNAME)",
    'if ($carteActive) {',
    "  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Carte utilisee' -Etat 'INFO' -Valeur $carteActive.InterfaceAlias -Commentaire ('index ' + $carteActive.InterfaceIndex))",
    '  $adr = $null',
    '  try { $adr = ($carteActive.IPv4Address | Select-Object -First 1) } catch { }',
    "  if ($adr) { [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Adresse locale' -Etat 'INFO' -Valeur ($adr.IPAddress + '/' + $adr.PrefixLength)) }",
    '  $pass = $null',
    '  try { $pass = $carteActive.IPv4DefaultGateway.NextHop } catch { }',
    "  if ($pass) { [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Passerelle' -Etat 'INFO' -Valeur $pass) }",
    '} else {',
    "  [void](Add-KjemoResultat -Categorie 'Contexte' -Controle 'Carte utilisee' -Etat 'ATTENTION' -Valeur 'aucune carte avec passerelle IPv4' -Commentaire 'La machine n''a pas de route par defaut : rien ne sortira du sous-reseau local.')",
    '}',
  ].join('\n');
}

/**
 * Bloc de rappel : aucune mesure de ce lot ne tourne sans fin.
 *
 * Il est inséré dans chaque script qui mesure, et le nombre d'essais y est
 * recopié. Ce n'est pas décoratif : c'est ce qu'on relit quand un script a
 * « l'air de rester bloqué ».
 */
export function blocMesureBornee(essais, delai) {
  return [
    '',
    "# --- Cette mesure est bornee -------------------------------------------------------",
    `# ${essais} essai(s), ${delai} ms d'attente au maximum par essai.`,
    "# Aucune boucle sans fin, aucun « ping -t » : un diagnostic qui ne s'arrete",
    '# pas tout seul finit par etre interrompu au clavier, et on ne sait plus ce',
    "# qu'il avait mesure.",
  ].join('\n');
}

/** Bloc de rappel : cet assistant ne contourne aucune permission. */
export function blocAucunContournement() {
  return [
    '',
    "Write-Host ''",
    "Write-Host '--- Ce que ce script ne fait pas ---'",
    "Write-Host 'Il ne demande aucun mot de passe et n''en ecrit aucun.'",
    "Write-Host 'Il ne contourne aucune permission : un acces refuse est rapporte,'",
    "Write-Host 'jamais force.'",
    "Write-Host 'Il ne desactive ni le pare-feu, ni Defender, ni aucune carte reseau.'",
    "Write-Host 'Il ne desactive jamais la validation d''un certificat TLS.'",
  ].join('\n');
}

/**
 * Bloc de rappel des limites d'une découverte : les faux négatifs sont la
 * règle, pas l'exception.
 */
export function blocLimitesDecouverte() {
  return [
    '',
    "Write-Host ''",
    "Write-Host '--- Limites de ce releve ---'",
    "Write-Host 'Un hote qui ne repond pas n''est pas forcement eteint : son pare-feu'",
    "Write-Host 'peut bloquer l''echo ICMP, ce que font beaucoup de parcs par defaut.'",
    "Write-Host 'Un port ferme n''est pas une preuve que le service est absent : il peut'",
    "Write-Host 'ecouter ailleurs, ou n''accepter que certaines sources.'",
    "Write-Host 'Ce releve est une photographie, prise depuis CETTE machine, a CET'",
    "Write-Host 'instant, sur CE chemin reseau.'",
  ].join('\n');
}
/**
 * 1. network-full-report — tout l'état réseau d'une machine, en une passe.
 *
 * Celui qu'on lance en premier quand on ne sait pas encore quoi chercher, et
 * qu'on joint au billet quand on passe le dossier à quelqu'un d'autre. Il ne
 * modifie rien : il relève, et il relève tout dans le même ordre à chaque
 * fois, pour que deux rapports se comparent à l'œil.
 */
export const outilRapportReseauComplet = {
  id: 'network-full-report',
  icon: '◈',
  category: 'Réseau',
  subcategory: 'Vue d’ensemble',
  title: 'Produire un rapport réseau complet',
  risk: 'diagnostic',
  summary: 'Relève en une passe le système, les cartes, les adresses, le DNS, les routes, les passerelles, les métriques, les profils réseau, le proxy, WinHTTP, l’état du pare-feu et la connectivité. N’écrit rien, et exporte en Console, CSV, JSON ou HTML.',
  fields: [
    champCible('nfrCible', 'Machine ou nom utilisé pour l’épreuve de connectivité finale.', 'www.microsoft.com'),
    {
      id: 'nfrPort', label: 'Port à éprouver', default: '443',
      help: 'Un port qui doit répondre depuis ce poste. 443 convient presque partout ; 445 pour un partage, 389 pour un contrôleur de domaine.',
    },
    {
      id: 'nfrDetail', label: 'Niveau de détail', type: 'select', default: 'Complet',
      options: [
        ['Essentiel', 'Essentiel — cartes, adresses, DNS, routes'],
        ['Complet', 'Complet — ajoute proxy, WinHTTP, pare-feu et profils'],
      ],
      help: 'Essentiel tient sur un écran. Complet est ce qu’on joint à un billet.',
    },
    champFormat('nfrFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'nfrCible', validerCibleReseau(v.nfrCible));
    verifier(errors, 'nfrPort', validerPort(v.nfrPort));
    verifier(errors, 'nfrDetail', validerChoix(v.nfrDetail, ['Essentiel', 'Complet'], 'Le niveau de détail'));
    verifier(errors, 'nfrFormat', validerFormatRapport(v.nfrFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerCibleReseau(v.nfrCible).value;
    const port = validerPort(v.nfrPort).value;
    const detail = validerChoix(v.nfrDetail, ['Essentiel', 'Complet']).value;

    const corps = [
      `$Cible = ${psB64(cible)}`,
      `$Port = ${port}`,
      `$Detail = ${psB64(detail)}`,
      `$KjemoFormat = ${psB64(v.nfrFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- 1. Systeme -------------------------------------------------------------------',
      '$os = $null',
      'try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue } catch { }',
      'if ($os) {',
      "  [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Version' -Etat 'INFO' -Valeur ($os.Caption + ' ' + $os.Version))",
      "  [void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Dernier demarrage' -Etat 'INFO' -Valeur $os.LastBootUpTime)",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Systeme' -Controle 'Domaine ou groupe de travail' -Etat 'INFO' -Valeur $env:USERDNSDOMAIN -Commentaire 'Vide : la machine n''est pas jointe a un domaine, ou la variable n''est pas renseignee dans cette session.')",
      "",
      '# --- 2. Cartes reseau -------------------------------------------------------------',
      '# On liste TOUTES les cartes, y compris celles qui sont coupees : une carte',
      "# desactivee qu'on croyait active explique bien des diagnostics qui tournent",
      '# en rond.',
      '$cartes = @()',
      'try { $cartes = @(Get-NetAdapter -ErrorAction SilentlyContinue | Sort-Object ifIndex) } catch { }',
      "[void](Add-KjemoResultat -Categorie 'Cartes' -Controle 'Nombre' -Etat 'INFO' -Valeur $cartes.Count)",
      'foreach ($c in $cartes) {',
      "  $etat = 'INFO'",
      "  if ($c.Status -eq 'Up') { $etat = 'OK' }",
      "  elseif ($c.Status -eq 'Disabled') { $etat = 'ATTENTION' }",
      "  [void](Add-KjemoResultat -Categorie 'Cartes' -Controle $c.Name -Etat $etat -Valeur ($c.Status + ' — ' + $c.LinkSpeed) -Commentaire ('index ' + $c.ifIndex + ' · ' + $c.InterfaceDescription))",
      '}',
      "",
      '# --- 3. Adresses ------------------------------------------------------------------',
      '$adresses = @()',
      'try { $adresses = @(Get-NetIPAddress -ErrorAction SilentlyContinue | Sort-Object InterfaceIndex, AddressFamily) } catch { }',
      'foreach ($a in $adresses) {',
      "  if ($a.IPAddress -like '169.254.*') {",
      "    [void](Add-KjemoResultat -Categorie 'Adresses' -Controle $a.InterfaceAlias -Etat 'PROBLEME' -Valeur ($a.IPAddress + '/' + $a.PrefixLength) -Commentaire 'Adresse APIPA : la carte n''a pas obtenu de bail DHCP. Elle ne joindra que son propre segment.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Adresses' -Controle $a.InterfaceAlias -Etat 'INFO' -Valeur ($a.IPAddress + '/' + $a.PrefixLength) -Commentaire ($a.AddressFamily.ToString() + ' · ' + $a.PrefixOrigin))",
      '  }',
      '}',
      "",
      '# --- 4. DNS client ----------------------------------------------------------------',
      '$dns = @()',
      'try { $dns = @(Get-DnsClientServerAddress -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses.Count -gt 0 }) } catch { }',
      'foreach ($d in $dns) {',
      "  [void](Add-KjemoResultat -Categorie 'DNS client' -Controle $d.InterfaceAlias -Etat 'INFO' -Valeur ($d.ServerAddresses -join ', ') -Commentaire $d.AddressFamily.ToString())",
      '}',
      '$global = $null',
      'try { $global = Get-DnsClientGlobalSetting -ErrorAction SilentlyContinue } catch { }',
      'if ($global) {',
      "  [void](Add-KjemoResultat -Categorie 'DNS client' -Controle 'Suffixe principal' -Etat 'INFO' -Valeur $global.SuffixSearchList -Commentaire 'Liste de recherche : ce que Windows ajoute a un nom court avant d''interroger le DNS.')",
      '}',
      "",
      '# --- 5. Routes et passerelles -----------------------------------------------------',
      '$routes = @()',
      'try { $routes = @(Get-NetRoute -ErrorAction SilentlyContinue | Sort-Object RouteMetric) } catch { }',
      "$defaut = @($routes | Where-Object { $_.DestinationPrefix -eq '0.0.0.0/0' })",
      'if ($defaut.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Routage' -Controle 'Route par defaut' -Etat 'PROBLEME' -Valeur 'absente' -Commentaire 'Sans route par defaut, rien ne sort du sous-reseau local.')",
      '} elseif ($defaut.Count -gt 1) {',
      "  [void](Add-KjemoResultat -Categorie 'Routage' -Controle 'Route par defaut' -Etat 'ATTENTION' -Valeur ($defaut.Count.ToString() + ' routes') -Commentaire 'Plusieurs passerelles : la metrique la plus BASSE gagne. Verifier que c''est bien celle qu''on veut.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Routage' -Controle 'Route par defaut' -Etat 'OK' -Valeur $defaut[0].NextHop -Commentaire ('interface ' + $defaut[0].InterfaceIndex + ' · metrique ' + $defaut[0].RouteMetric))",
      '}',
      'foreach ($r in $defaut) {',
      "  [void](Add-KjemoResultat -Categorie 'Passerelles' -Controle $r.NextHop -Etat 'INFO' -Valeur ('metrique ' + $r.RouteMetric) -Commentaire ('index ' + $r.InterfaceIndex))",
      '}',
      "",
      '# --- 6. Metriques d\'interface -----------------------------------------------------',
      '# La metrique decide quelle carte sert quand plusieurs peuvent sortir. Une',
      "# metrique automatique mal comprise est la cause la plus frequente d'un",
      '# « ca passe par le Wi-Fi alors que le cable est branche ».',
      '$interfaces = @()',
      'try { $interfaces = @(Get-NetIPInterface -ErrorAction SilentlyContinue | Where-Object { $_.ConnectionState -eq \'Connected\' } | Sort-Object InterfaceMetric) } catch { }',
      'foreach ($i in $interfaces) {',
      "  [void](Add-KjemoResultat -Categorie 'Metriques' -Controle $i.InterfaceAlias -Etat 'INFO' -Valeur ('metrique ' + $i.InterfaceMetric) -Commentaire ($i.AddressFamily.ToString() + ' · automatique : ' + $i.AutomaticMetric + ' · DHCP : ' + $i.Dhcp))",
      '}',
      "",
      "if ($Detail -eq 'Complet') {",
      '  # --- 7. Profils reseau ----------------------------------------------------------',
      "  # Le profil decide quelles regles de pare-feu s'appliquent. Une carte en",
      "  # profil Public sur un reseau d'entreprise bloque des choses qu'on croit",
      '  # autorisees.',
      '  $profils = @()',
      '  try { $profils = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue) } catch { }',
      '  foreach ($p in $profils) {',
      "    $etatP = 'INFO'",
      "    if ($p.NetworkCategory -eq 'Public') { $etatP = 'ATTENTION' }",
      "    [void](Add-KjemoResultat -Categorie 'Profils reseau' -Controle $p.InterfaceAlias -Etat $etatP -Valeur $p.NetworkCategory.ToString() -Commentaire ($p.Name + ' · IPv4 : ' + $p.IPv4Connectivity))",
      '  }',
      "",
      '  # --- 8. Proxy de la session et WinHTTP ------------------------------------------',
      '  # Deux proxys distincts, et les confondre fait perdre des heures : celui de',
      '  # la session (Internet Explorer / Edge, par utilisateur) et celui de WinHTTP',
      '  # (machine, utilise par les services et par Windows Update).',
      "  $cleProxy = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'",
      '  $proxy = $null',
      '  try { $proxy = Get-ItemProperty -Path $cleProxy -ErrorAction SilentlyContinue } catch { }',
      '  if ($proxy) {',
      "    $actif = 'non'",
      "    if ($proxy.ProxyEnable -eq 1) { $actif = 'oui' }",
      "    [void](Add-KjemoResultat -Categorie 'Proxy' -Controle 'Proxy de la session' -Etat 'INFO' -Valeur $actif -Commentaire $proxy.ProxyServer)",
      '    if ($proxy.AutoConfigURL) {',
      "      [void](Add-KjemoResultat -Categorie 'Proxy' -Controle 'Script de configuration' -Etat 'INFO' -Valeur $proxy.AutoConfigURL)",
      '    }',
      '  }',
      '  $winhttp = $null',
      "  try { $winhttp = (netsh winhttp show proxy) -join ' ' } catch { }",
      '  if ($winhttp) {',
      "    $etatW = 'INFO'",
      "    if ($winhttp -match 'Acc.s direct|Direct access') { $etatW = 'OK' }",
      "    [void](Add-KjemoResultat -Categorie 'Proxy' -Controle 'WinHTTP (machine)' -Etat $etatW -Valeur $winhttp.Trim() -Commentaire 'C''est CE proxy qu''utilisent les services et Windows Update, pas celui de la session.')",
      '  }',
      "",
      '  # --- 9. Pare-feu : ETAT SEULEMENT -----------------------------------------------',
      "  # Ce script lit l'etat des profils. Il ne desactive rien, dans aucun cas.",
      '  $pf = @()',
      '  try { $pf = @(Get-NetFirewallProfile -ErrorAction SilentlyContinue) } catch { }',
      '  foreach ($p in $pf) {',
      "    $etatF = 'OK'",
      "    $noteF = ''",
      "    if (-not $p.Enabled) { $etatF = 'PROBLEME' ; $noteF = 'Profil desactive. Cet assistant ne le reactive pas : c''est une decision qui se prend, pas un reglage qu''on corrige au passage.' }",
      "    [void](Add-KjemoResultat -Categorie 'Pare-feu' -Controle $p.Name.ToString() -Etat $etatF -Valeur ('actif : ' + $p.Enabled) -Commentaire $noteF)",
      '  }',
      '}',
      "",
      '# --- 10. Connectivite -------------------------------------------------------------',
      '$resolution = $null',
      'try { $resolution = Resolve-DnsName -Name $Cible -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress } | Select-Object -First 1 } catch { }',
      'if ($resolution) {',
      "  [void](Add-KjemoResultat -Categorie 'Connectivite' -Controle 'Resolution de la cible' -Etat 'OK' -Valeur ($Cible + ' -> ' + $resolution.IPAddress))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Connectivite' -Controle 'Resolution de la cible' -Etat 'PROBLEME' -Valeur $Cible -Commentaire 'Le nom ne se resout pas depuis ce poste.')",
      '}',
      '$tnc = $null',
      'try { $tnc = Test-NetConnection -ComputerName $Cible -Port $Port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($tnc) {',
      "  $etatT = 'PROBLEME'",
      "  if ($tnc.TcpTestSucceeded) { $etatT = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Connectivite' -Controle ('TCP ' + $Port) -Etat $etatT -Valeur ('ouvert : ' + $tnc.TcpTestSucceeded) -Commentaire ('ICMP : ' + $tnc.PingSucceeded + ' — un echo bloque ne prouve rien.'))",
      '}',
      blocLimitesDecouverte(),
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Rapport reseau complet',
      outil: 'network-full-report',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Cible', psB64(cible)],
        ['Port', psB64(String(port))],
        ['Detail', psB64(detail)],
        ['Format', psB64(v.nfrFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-rapport',
      formats: v.nfrFormat,
    });
  },
  gui: [
    'Paramètres > Réseau et Internet > Paramètres réseau avancés : cartes, adresses et profil de chaque connexion.',
    'Panneau de configuration > Centre Réseau et partage > Modifier les paramètres de la carte, pour l’affichage classique.',
    'Invite de commandes : « ipconfig /all » donne adresses, DNS, suffixes et bail DHCP d’un coup.',
    '« route print » donne la table de routage, « netsh winhttp show proxy » le proxy machine.',
    'Pare-feu Windows Defender avec fonctions avancées de sécurité : l’état des trois profils.',
  ],
  keywords: [
    'rapport reseau', 'etat reseau', 'ipconfig', 'get-netipconfiguration',
    'cartes reseau', 'passerelle', 'metrique', 'profil reseau', 'proxy',
    'winhttp', 'pare-feu', 'connectivite', 'diagnostic complet', 'inventaire reseau',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation nécessaire pour la lecture : seul l’état des profils de pare-feu peut rester incomplet sans droits.',
    'Le poste doit avoir au moins une carte réseau, même coupée.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Toutes les adresses commencent par 169.254',
      cause: 'Aucun serveur DHCP n’a répondu. Windows s’attribue alors une adresse APIPA, qui ne joint que le segment local.',
      fix: 'Vérifier le câble, le port du commutateur et le VLAN, puis le relais DHCP. L’assistant de diagnostic du client DHCP détaille le bail.',
    },
    {
      message: 'Le rapport montre deux routes par défaut',
      cause: 'Deux cartes ont une passerelle : un câble et un Wi-Fi, ou un VPN monté.',
      fix: 'La métrique la plus basse gagne. L’assistant des cartes multiples montre laquelle sert réellement.',
    },
    {
      message: 'Le proxy de la session est correct mais les services ne sortent pas',
      cause: 'WinHTTP a son propre proxy, distinct de celui de la session. Windows Update et les services l’utilisent.',
      fix: 'Comparer les deux lignes « Proxy » du rapport. « netsh winhttp import proxy source=ie » les aligne.',
    },
    {
      message: 'Une carte apparaît en profil Public sur le réseau de l’entreprise',
      cause: 'Le poste n’a pas identifié le domaine, souvent parce que le service de reconnaissance d’emplacement a démarré avant le réseau.',
      fix: 'Le profil décide des règles de pare-feu appliquées. Redémarrer le service NlaSvc, ou vérifier que le contrôleur de domaine est joignable au démarrage.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport nomme la machine, la carte utilisée, son adresse et sa passerelle : sans ce contexte, il n’est pas interprétable.',
    'Chaque carte apparaît, y compris celles qui sont coupées.',
    'L’épreuve de connectivité finale dit séparément si le nom s’est résolu et si le port a répondu.',
  ],
  rollback: {
    summary: 'Ce script ne modifie rien : il n’y a rien à annuler. Le rapport exporté peut être supprimé comme n’importe quel fichier.',
    diagnostic: '# Relire le dernier rapport exporte.\nGet-ChildItem .\\kjemo-reseau-rapport-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1',
    command: '# Rien a annuler : aucune commande de ce script n\'ecrit sur la machine.\n# Les fichiers de rapport se retirent comme tout autre fichier.\nGet-ChildItem .\\kjemo-reseau-rapport-*.* | Remove-Item -Confirm',
    warning: 'Le rapport décrit l’adressage interne du parc. Il se joint à un billet interne, pas à une conversation publique.',
  },
  checks: [
    'Aucune écriture : pas une seule commande de modification.',
    'L’état du pare-feu est lu, jamais changé.',
    'Les adresses APIPA sont signalées comme problème, pas comme information.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipconfiguration',
  sources: [
    { label: 'Get-NetIPConfiguration', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipconfiguration' },
    { label: 'Get-NetAdapter', url: 'https://learn.microsoft.com/powershell/module/netadapter/get-netadapter' },
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
    { label: 'Get-NetConnectionProfile', url: 'https://learn.microsoft.com/powershell/module/netconnection/get-netconnectionprofile' },
  ],
};

/**
 * 2. network-baseline — l'état réseau avant, puis après.
 *
 * Le seul outil qui répond vraiment à « ça marchait hier ». Il écrit une
 * photographie dans un fichier, et sait relire une photographie précédente
 * pour dire ce qui a bougé. Il ne touche pas à la machine : il la regarde.
 *
 * La comparaison porte sur ce qui change réellement et explique la plupart
 * des pannes : adresses, serveurs DNS, route par défaut, métriques, profils.
 * Pas sur les compteurs d'octets, qui changent toujours et ne disent rien.
 */
export const outilBaselineReseau = {
  id: 'network-baseline',
  icon: '◫',
  category: 'Réseau',
  subcategory: 'Vue d’ensemble',
  title: 'Capturer et comparer deux états réseau',
  risk: 'diagnostic',
  summary: 'Écrit une photographie de l’état réseau dans un fichier, et sait relire une photographie précédente pour dire exactement ce qui a changé : adresses, DNS, route par défaut, métriques, profils. Ne modifie jamais la machine.',
  fields: [
    {
      id: 'nbAction', label: 'Action', type: 'select', default: 'Capturer',
      options: [
        ['Capturer', 'Capturer — écrire l’état actuel dans un fichier'],
        ['Comparer', 'Comparer — état actuel contre une capture précédente'],
      ],
      help: 'Capturer avant l’intervention, comparer après. Les deux actions ne touchent pas à la configuration.',
    },
    {
      id: 'nbDossier', label: 'Dossier des captures', default: 'C:\\Kjemo\\Reseau',
      help: 'Dossier local où les photographies sont écrites et relues. Un fichier JSON par capture, horodaté.',
    },
    {
      id: 'nbReference', label: 'Capture de référence (facultatif)', default: '',
      help: 'Nom du fichier à comparer. Vide, pour l’action Comparer : la capture la plus récente du dossier est retenue, et le rapport dit laquelle.',
    },
    champFormat('nbFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'nbAction', validerChoix(v.nbAction, ['Capturer', 'Comparer'], 'L’action'));
    verifier(errors, 'nbDossier', validerCheminWindowsLocal(v.nbDossier));
    const ref = String(v.nbReference ?? '').trim();
    if (ref !== '') {
      if (/[\\/:*?"<>|]/.test(ref)) {
        errors.nbReference = 'Indique seulement le nom du fichier, sans chemin ni caractère interdit.';
      } else if (!/\.json$/i.test(ref)) {
        errors.nbReference = 'Une capture est un fichier .json écrit par cet assistant.';
      }
    }
    verifier(errors, 'nbFormat', validerFormatRapport(v.nbFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const action = validerChoix(v.nbAction, ['Capturer', 'Comparer']).value;
    const dossier = validerCheminWindowsLocal(v.nbDossier).value;
    const reference = String(v.nbReference ?? '').trim();

    const corps = [
      `$Action = ${psB64(action)}`,
      `$Dossier = ${psB64(dossier)}`,
      `$Reference = ${psB64(reference)}`,
      `$KjemoFormat = ${psB64(v.nbFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- 1. Prendre la photographie ----------------------------------------------------',
      '# On releve ce qui CHANGE et qui explique les pannes. Pas les compteurs',
      "# d'octets : ils changent toujours, et une comparaison ou tout differe ne",
      '# montre rien.',
      'function Get-KjemoEtatReseau {',
      '  $etat = [ordered]@{}',
      "  $etat['machine'] = $env:COMPUTERNAME",
      "  $etat['horodatage'] = (Get-Date -Format 's')",
      "",
      '  $cartes = @()',
      '  try {',
      '    $cartes = @(Get-NetAdapter -ErrorAction SilentlyContinue | Sort-Object ifIndex | ForEach-Object {',
      '      [ordered]@{ nom = $_.Name ; index = $_.ifIndex ; etat = $_.Status.ToString() ; mac = $_.MacAddress }',
      '    })',
      '  } catch { }',
      "  $etat['cartes'] = $cartes",
      "",
      '  $adresses = @()',
      '  try {',
      '    $adresses = @(Get-NetIPAddress -ErrorAction SilentlyContinue | Sort-Object InterfaceIndex, IPAddress | ForEach-Object {',
      '      [ordered]@{ carte = $_.InterfaceAlias ; adresse = $_.IPAddress ; prefixe = $_.PrefixLength ; origine = $_.PrefixOrigin.ToString() }',
      '    })',
      '  } catch { }',
      "  $etat['adresses'] = $adresses",
      "",
      '  $dns = @()',
      '  try {',
      '    $dns = @(Get-DnsClientServerAddress -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses.Count -gt 0 } | ForEach-Object {',
      "      [ordered]@{ carte = $_.InterfaceAlias ; famille = $_.AddressFamily.ToString() ; serveurs = ($_.ServerAddresses -join ', ') }",
      '    })',
      '  } catch { }',
      "  $etat['dns'] = $dns",
      "",
      '  $routes = @()',
      '  try {',
      "    $routes = @(Get-NetRoute -ErrorAction SilentlyContinue | Where-Object { $_.DestinationPrefix -eq '0.0.0.0/0' -or $_.DestinationPrefix -eq '::/0' } | ForEach-Object {",
      '      [ordered]@{ destination = $_.DestinationPrefix ; passerelle = $_.NextHop ; index = $_.InterfaceIndex ; metrique = $_.RouteMetric }',
      '    })',
      '  } catch { }',
      "  $etat['routesParDefaut'] = $routes",
      "",
      '  $metriques = @()',
      '  try {',
      "    $metriques = @(Get-NetIPInterface -ErrorAction SilentlyContinue | Where-Object { $_.ConnectionState -eq 'Connected' } | ForEach-Object {",
      '      [ordered]@{ carte = $_.InterfaceAlias ; famille = $_.AddressFamily.ToString() ; metrique = $_.InterfaceMetric ; auto = $_.AutomaticMetric.ToString() ; dhcp = $_.Dhcp.ToString() }',
      '    })',
      '  } catch { }',
      "  $etat['metriques'] = $metriques",
      "",
      '  $profils = @()',
      '  try {',
      '    $profils = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue | ForEach-Object {',
      '      [ordered]@{ carte = $_.InterfaceAlias ; nom = $_.Name ; categorie = $_.NetworkCategory.ToString() }',
      '    })',
      '  } catch { }',
      "  $etat['profils'] = $profils",
      "",
      '  return $etat',
      '}',
      "",
      '$actuel = Get-KjemoEtatReseau',
      "[void](Add-KjemoResultat -Categorie 'Capture' -Controle 'Elements releves' -Etat 'INFO' -Valeur (($actuel.cartes.Count + $actuel.adresses.Count + $actuel.dns.Count + $actuel.routesParDefaut.Count + $actuel.metriques.Count + $actuel.profils.Count).ToString()))",
      "",
      '# --- 2. Le dossier ------------------------------------------------------------------',
      '$dossierOk = $false',
      'try { $dossierOk = Test-Path -LiteralPath $Dossier } catch { }',
      'if (-not $dossierOk) {',
      '  try {',
      '    [void](New-Item -ItemType Directory -Path $Dossier -ErrorAction Stop)',
      '    $dossierOk = $true',
      "    [void](Add-KjemoResultat -Categorie 'Dossier' -Controle 'Creation' -Etat 'OK' -Valeur $Dossier -Commentaire 'Dossier cree pour accueillir les captures.')",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Dossier' -Controle 'Creation' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Dossier' -Controle 'Acces' -Etat 'OK' -Valeur $Dossier)",
      '}',
      "",
      '# --- 3. Capturer --------------------------------------------------------------------',
      "if ($Action -eq 'Capturer' -and $dossierOk) {",
      "  $nom = 'reseau-' + $env:COMPUTERNAME + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json'",
      '  $chemin = Join-Path $Dossier $nom',
      '  try {',
      '    $actuel | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $chemin -Encoding UTF8 -ErrorAction Stop',
      "    [void](Add-KjemoResultat -Categorie 'Capture' -Controle 'Fichier ecrit' -Etat 'OK' -Valeur $chemin -Commentaire 'Relancer cet assistant en mode Comparer apres l''intervention, en nommant ce fichier.')",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Capture' -Controle 'Fichier ecrit' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      "",
      '# --- 4. Comparer --------------------------------------------------------------------',
      "if ($Action -eq 'Comparer') {",
      '  $fichier = $null',
      "  if ($Reference -ne '') {",
      '    $candidat = Join-Path $Dossier $Reference',
      '    if (Test-Path -LiteralPath $candidat) { $fichier = Get-Item -LiteralPath $candidat }',
      '    else {',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Reference' -Etat 'PROBLEME' -Valeur $candidat -Commentaire 'Fichier introuvable.')",
      '    }',
      '  } elseif ($dossierOk) {',
      "    $fichier = Get-ChildItem -LiteralPath $Dossier -Filter 'reseau-*.json' -ErrorAction SilentlyContinue |",
      '      Sort-Object LastWriteTime -Descending | Select-Object -First 1',
      '    if ($fichier) {',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Choix de la reference' -Etat 'INFO' -Valeur $fichier.Name -Commentaire ('Aucun fichier nomme : la capture la plus recente a ete retenue, ecrite le ' + $fichier.LastWriteTime + '.'))",
      '    }',
      '  }',
      "",
      '  if (-not $fichier) {',
      "    [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Reference' -Etat 'PROBLEME' -Valeur 'aucune' -Commentaire 'Aucune capture dans ce dossier : il n''y a rien a comparer. Lancer d''abord l''action Capturer.')",
      '  } else {',
      '    $avant = $null',
      '    try { $avant = Get-Content -LiteralPath $fichier.FullName -Raw | ConvertFrom-Json } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Lecture' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '    }',
      '    if ($avant) {',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Capture lue' -Etat 'OK' -Valeur $fichier.Name -Commentaire ('prise le ' + $avant.horodatage + ' sur ' + $avant.machine))",
      '      if ($avant.machine -ne $actuel.machine) {',
      "        [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Machine' -Etat 'ATTENTION' -Valeur ($avant.machine + ' -> ' + $actuel.machine) -Commentaire 'La capture vient d''une AUTRE machine : la comparaison compare deux postes, pas deux instants.')",
      '      }',
      "",
      '      # Comparaison section par section, sur une cle lisible.',
      '      function Compare-KjemoSection {',
      '        param([string]$Nom, $Avant, $Apres, [string[]]$Cles)',
      '        $clef = { param($x) ($Cles | ForEach-Object { [string]$x.$_ }) -join \' | \' }',
      '        $listeAvant = @()',
      '        $listeApres = @()',
      '        foreach ($e in @($Avant)) { if ($e) { $listeAvant += (& $clef $e) } }',
      '        foreach ($e in @($Apres)) { if ($e) { $listeApres += (& $clef $e) } }',
      '        $apparus = @($listeApres | Where-Object { $listeAvant -notcontains $_ })',
      '        $disparus = @($listeAvant | Where-Object { $listeApres -notcontains $_ })',
      '        if ($apparus.Count -eq 0 -and $disparus.Count -eq 0) {',
      "          [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle $Nom -Etat 'OK' -Valeur 'identique')",
      '        } else {',
      "          [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle $Nom -Etat 'ATTENTION' -Valeur ($apparus.Count.ToString() + ' apparu(s), ' + $disparus.Count.ToString() + ' disparu(s)'))",
      "          foreach ($a in $apparus) { [void](Add-KjemoResultat -Categorie ('Apparu — ' + $Nom) -Controle $a -Etat 'INFO' -Valeur 'present maintenant') }",
      "          foreach ($d in $disparus) { [void](Add-KjemoResultat -Categorie ('Disparu — ' + $Nom) -Controle $d -Etat 'INFO' -Valeur 'present avant') }",
      '        }',
      '      }',
      "",
      "      Compare-KjemoSection -Nom 'Cartes' -Avant $avant.cartes -Apres $actuel.cartes -Cles @('nom','etat')",
      "      Compare-KjemoSection -Nom 'Adresses' -Avant $avant.adresses -Apres $actuel.adresses -Cles @('carte','adresse','prefixe')",
      "      Compare-KjemoSection -Nom 'Serveurs DNS' -Avant $avant.dns -Apres $actuel.dns -Cles @('carte','famille','serveurs')",
      "      Compare-KjemoSection -Nom 'Routes par defaut' -Avant $avant.routesParDefaut -Apres $actuel.routesParDefaut -Cles @('destination','passerelle','metrique')",
      "      Compare-KjemoSection -Nom 'Metriques' -Avant $avant.metriques -Apres $actuel.metriques -Cles @('carte','famille','metrique')",
      "      Compare-KjemoSection -Nom 'Profils reseau' -Avant $avant.profils -Apres $actuel.profils -Cles @('carte','categorie')",
      '    }',
      '  }',
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Ce que cette comparaison ne regarde pas ---'",
      "Write-Host 'Les compteurs d''octets, la duree depuis le demarrage et les adresses'",
      "Write-Host 'temporaires IPv6 changent a chaque instant. Les comparer produirait une'",
      "Write-Host 'liste d''ecarts ou le vrai changement serait noye.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Capture et comparaison d\'etat reseau',
      outil: 'network-baseline',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Action', psB64(action)],
        ['Dossier', psB64(dossier)],
        ['Format', psB64(v.nbFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-baseline',
      formats: v.nbFormat,
    });
  },
  gui: [
    'Il n’existe pas d’équivalent graphique : Windows ne garde pas d’historique de son état réseau.',
    'Le plus proche, à la main : « ipconfig /all > avant.txt », puis « ipconfig /all > apres.txt » et comparer les deux fichiers.',
    'L’Observateur d’événements, journal System, source Tcpip ou Dhcp, montre les changements d’adresse après coup.',
    'Le Moniteur de fiabilité (perfmon /rel) situe dans le temps l’installation qui a précédé la panne.',
    'Pour un parc : une capture avant chaque intervention planifiée, conservée avec le billet.',
  ],
  keywords: [
    'avant apres', 'baseline', 'capture reseau', 'comparer', 'ca marchait hier',
    'regression reseau', 'photographie', 'ecart de configuration', 'changement reseau',
    'historique reseau', 'instantane',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Un dossier local accessible en écriture pour y déposer les captures.',
    'Une capture prise AVANT l’intervention : sans elle, il n’y a rien à comparer après.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'La comparaison annonce « aucune capture dans ce dossier »',
      cause: 'Aucune photographie n’a été prise avant l’intervention, ou le dossier indiqué n’est pas celui qui les contient.',
      fix: 'Lancer l’action Capturer. C’est la raison d’être de cet assistant : il faut penser à l’avant.',
    },
    {
      message: 'La comparaison signale que la machine a changé',
      cause: 'La capture relue vient d’un autre poste.',
      fix: 'Comparer deux postes est parfois utile, mais ce n’est pas une régression : le rapport le dit pour éviter la confusion.',
    },
    {
      message: 'Tout apparaît comme changé alors que rien n’a bougé',
      cause: 'Les adresses IPv6 temporaires sont renouvelées régulièrement par conception.',
      fix: 'Elles sont relevées, mais la comparaison porte sur la carte, l’adresse et le préfixe : une adresse temporaire renouvelée apparaîtra comme apparue et disparue. C’est attendu.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le fichier de capture existe, et son horodatage correspond au moment de l’intervention.',
    'La comparaison nomme explicitement la capture relue et sa date.',
    'Chaque section comparée annonce « identique » ou liste ce qui est apparu et disparu.',
  ],
  rollback: {
    summary: 'Ce script ne modifie que son propre dossier de captures. Il n’y a rien à annuler côté réseau.',
    diagnostic: '# Les captures disponibles.\nGet-ChildItem \'C:\\Kjemo\\Reseau\\reseau-*.json\' | Select-Object Name,LastWriteTime,Length',
    command: '# Retirer les captures devenues inutiles. -Confirm est explicite.\nGet-ChildItem \'C:\\Kjemo\\Reseau\\reseau-*.json\' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-90) } | Remove-Item -Confirm',
    warning: 'Une capture décrit l’adressage interne, les noms de cartes et les serveurs DNS du parc. Elle se conserve avec le billet, pas sur un partage ouvert.',
  },
  checks: [
    'Aucune modification de la configuration réseau, dans aucune action.',
    'La capture relue est toujours nommée dans le rapport.',
    'Les éléments qui changent par conception sont exclus de la comparaison, et c’est dit.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipconfiguration',
  sources: [
    { label: 'Get-NetIPAddress', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipaddress' },
    { label: 'Get-NetIPInterface', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipinterface' },
    { label: 'Get-DnsClientServerAddress', url: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientserveraddress' },
  ],
};
/**
 * 3. ping-traceroute — joindre une cible, et voir par où ça passe.
 *
 * Le réflexe de tout le monde, fait proprement : résolution d'abord, écho
 * ensuite, port utile en troisième, chemin en quatrième. Dans cet ordre,
 * parce qu'un nom qui ne se résout pas rend tout le reste sans objet.
 *
 * Un écho ICMP bloqué ne prouve rien. C'est écrit dans le script, pas
 * seulement dans la fiche.
 */
export const outilPingTraceroute = {
  id: 'ping-traceroute',
  icon: '→',
  category: 'Réseau',
  subcategory: 'Connectivité IP',
  title: 'Joindre une cible et relever le chemin',
  risk: 'diagnostic',
  summary: 'Résout le nom, éprouve l’écho ICMP, teste le port qui compte vraiment, puis relève le chemin jusqu’à la cible. Le nombre d’essais et le nombre de sauts sont bornés : aucune mesure de cet assistant ne tourne sans fin.',
  fields: [
    champCible('ptCible', 'Nom ou adresse à joindre.', 'srv-fichiers.hopitalbn.lan'),
    {
      id: 'ptPort', label: 'Port à éprouver', default: '445',
      help: 'Le port du service qui vous intéresse. Il dit bien plus qu’un écho : 445 pour un partage, 443 pour un site, 389 pour un contrôleur de domaine.',
    },
    {
      id: 'ptEssais', label: 'Nombre d’échos', default: '4',
      help: 'Entre 1 et 100. Quatre suffit pour savoir si ça répond ; vingt commencent à dire si c’est stable.',
    },
    {
      id: 'ptSauts', label: 'Sauts maximum pour le chemin', default: '20',
      help: 'Entre 1 et 64. Au-delà de vingt sauts, on n’est plus sur le réseau de l’établissement.',
    },
    champFormat('ptFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'ptCible', validerCibleReseau(v.ptCible));
    verifier(errors, 'ptPort', validerPort(v.ptPort));
    verifier(errors, 'ptEssais', validerNombreEssais(v.ptEssais, { min: 1, max: 100, label: 'Le nombre d’échos' }));
    verifier(errors, 'ptSauts', validerEntier(v.ptSauts, 1, 64, 'Le nombre de sauts'));
    verifier(errors, 'ptFormat', validerFormatRapport(v.ptFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerCibleReseau(v.ptCible).value;
    const port = validerPort(v.ptPort).value;
    const essais = validerNombreEssais(v.ptEssais, { min: 1, max: 100 }).value;
    const sauts = validerEntier(v.ptSauts, 1, 64).value;

    const corps = [
      `$Cible = ${psB64(cible)}`,
      `$Port = ${port}`,
      `$Essais = ${essais}`,
      `$Sauts = ${sauts}`,
      `$KjemoFormat = ${psB64(v.ptFormat)}`,
      "",
      blocContexteReseau(),
      blocMesureBornee(essais, 4000),
      "",
      '# --- 1. Resolution ------------------------------------------------------------------',
      "# D'abord le nom. Un nom qui ne se resout pas rend tout le reste sans objet,",
      '# et une adresse resolue vers le mauvais serveur explique des pannes ou',
      '# « tout a l\'air de marcher ».',
      '$adresses = @()',
      'try { $adresses = @(Resolve-DnsName -Name $Cible -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress }) } catch { }',
      'if ($adresses.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Resolution' -Controle $Cible -Etat 'PROBLEME' -Valeur 'aucune reponse' -Commentaire 'Le nom ne se resout pas depuis ce poste. Les etapes suivantes ne diront rien d''utile tant que ce point n''est pas regle.')",
      '} else {',
      '  foreach ($a in $adresses) {',
      "    [void](Add-KjemoResultat -Categorie 'Resolution' -Controle $a.Type.ToString() -Etat 'OK' -Valeur $a.IPAddress -Commentaire ('TTL ' + $a.TTL + ' s'))",
      '  }',
      '  if ($adresses.Count -gt 1) {',
      "    [void](Add-KjemoResultat -Categorie 'Resolution' -Controle 'Reponses multiples' -Etat 'INFO' -Valeur $adresses.Count -Commentaire 'Plusieurs adresses : le client en choisit une, et ce n''est pas forcement celle qu''on teste a la main.')",
      '  }',
      '}',
      "",
      '# --- 2. Echo ICMP --------------------------------------------------------------------',
      '$reponses = 0',
      '$latences = New-Object System.Collections.ArrayList',
      'for ($i = 1; $i -le $Essais; $i++) {',
      '  $r = $null',
      '  try { $r = Test-Connection -ComputerName $Cible -Count 1 -ErrorAction SilentlyContinue } catch { }',
      '  if ($r) {',
      '    $reponses++',
      '    $ms = $null',
      '    if ($r.ResponseTime -ne $null) { $ms = $r.ResponseTime }',
      '    elseif ($r.Latency -ne $null) { $ms = $r.Latency }',
      '    if ($ms -ne $null) { [void]$latences.Add([double]$ms) }',
      '  }',
      '}',
      "$etatEcho = 'ATTENTION'",
      "$noteEcho = 'Aucun echo ne revient. Cela ne prouve PAS que la cible est eteinte : beaucoup de pare-feu bloquent l''echo ICMP par defaut. Le test du port, ci-dessous, est le seul qui tranche.'",
      "if ($reponses -eq $Essais) { $etatEcho = 'OK' ; $noteEcho = '' }",
      "elseif ($reponses -gt 0) { $etatEcho = 'ATTENTION' ; $noteEcho = 'Reponses partielles : perte de paquets sur le chemin, ou limitation de debit ICMP sur un equipement.' }",
      "[void](Add-KjemoResultat -Categorie 'Echo ICMP' -Controle 'Reponses' -Etat $etatEcho -Valeur ($reponses.ToString() + ' / ' + $Essais) -Commentaire $noteEcho)",
      'if ($latences.Count -gt 0) {',
      '  $moy = [Math]::Round((($latences | Measure-Object -Average).Average), 1)',
      '  $min = ($latences | Measure-Object -Minimum).Minimum',
      '  $max = ($latences | Measure-Object -Maximum).Maximum',
      "  [void](Add-KjemoResultat -Categorie 'Echo ICMP' -Controle 'Aller-retour' -Etat 'INFO' -Valeur ($moy.ToString() + ' ms en moyenne') -Commentaire ('min ' + $min + ' ms · max ' + $max + ' ms'))",
      '}',
      "",
      '# --- 3. Le port qui compte -----------------------------------------------------------',
      '# Un service repond sur un port, pas sur un echo. C\'est ce test-la qui dit si',
      '# la cible est utilisable.',
      '$tnc = $null',
      'try { $tnc = Test-NetConnection -ComputerName $Cible -Port $Port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($tnc) {',
      "  $etatP = 'PROBLEME'",
      "  $noteP = 'Le port ne repond pas : service arrete, pare-feu, ou mauvaise cible.'",
      "  if ($tnc.TcpTestSucceeded) { $etatP = 'OK' ; $noteP = 'La cible est joignable sur ce port, quoi que dise l''echo ICMP.' }",
      "  [void](Add-KjemoResultat -Categorie 'Port' -Controle ('TCP ' + $Port) -Etat $etatP -Valeur ('ouvert : ' + $tnc.TcpTestSucceeded) -Commentaire $noteP)",
      '  if ($tnc.RemoteAddress) {',
      "    [void](Add-KjemoResultat -Categorie 'Port' -Controle 'Adresse reellement jointe' -Etat 'INFO' -Valeur $tnc.RemoteAddress.IPAddressToString)",
      '  }',
      '  if ($tnc.InterfaceAlias) {',
      "    [void](Add-KjemoResultat -Categorie 'Port' -Controle 'Carte utilisee pour sortir' -Etat 'INFO' -Valeur $tnc.InterfaceAlias -Commentaire 'Si ce n''est pas la carte attendue, le probleme est dans les metriques, pas dans la cible.')",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Port' -Controle ('TCP ' + $Port) -Etat 'PROBLEME' -Valeur 'test impossible')",
      '}',
      "",
      '# --- 4. Le chemin ---------------------------------------------------------------------',
      '# Trace route, borne au nombre de sauts demande. Chaque saut qui ne repond',
      "# pas n'est pas une coupure : beaucoup de routeurs ne repondent pas aux",
      '# paquets expires, et laissent pourtant passer le trafic.',
      '$chemin = $null',
      'try {',
      '  $chemin = Test-NetConnection -ComputerName $Cible -TraceRoute -Hops $Sauts -WarningAction SilentlyContinue -ErrorAction SilentlyContinue',
      '} catch { }',
      'if ($chemin -and $chemin.TraceRoute) {',
      '  $n = 0',
      '  foreach ($saut in $chemin.TraceRoute) {',
      '    $n++',
      "    $etatS = 'INFO'",
      "    $noteS = ''",
      "    if ($saut -eq '0.0.0.0' -or $saut -eq '*') { $etatS = 'IGNORE' ; $noteS = 'Saut muet : le routeur ne repond pas aux paquets expires. Ce n''est pas une coupure.' }",
      "    [void](Add-KjemoResultat -Categorie 'Chemin' -Controle ('Saut ' + $n) -Etat $etatS -Valeur $saut -Commentaire $noteS)",
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Chemin' -Controle 'Longueur' -Etat 'INFO' -Valeur ($n.ToString() + ' saut(s)') -Commentaire ('Plafond demande : ' + $Sauts + '.'))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Chemin' -Controle 'Trace' -Etat 'ATTENTION' -Valeur 'indisponible' -Commentaire 'La trace n''a rien rendu : ICMP bloque en sortie, ou cible injoignable.')",
      '}',
      blocLimitesDecouverte(),
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Joindre une cible et relever le chemin',
      outil: 'ping-traceroute',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Cible', psB64(cible)],
        ['Port', psB64(String(port))],
        ['Essais', psB64(String(essais))],
        ['Format', psB64(v.ptFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-ping',
      formats: v.ptFormat,
    });
  },
  gui: [
    'Invite de commandes : « ping -n 4 <cible> » pour quatre échos. Jamais « ping -t », qui ne s’arrête pas.',
    '« tracert -h 20 <cible> » pour le chemin, borné à vingt sauts.',
    '« pathping <cible> » combine les deux et mesure la perte par saut, mais prend plusieurs minutes.',
    'PowerShell : « Test-NetConnection <cible> -Port 445 » dit en une ligne si le port répond.',
    'Un écho qui échoue alors que le port répond est normal : c’est le pare-feu de la cible.',
  ],
  keywords: [
    'ping', 'traceroute', 'tracert', 'test-netconnection', 'test-connection',
    'joindre', 'injoignable', 'chemin reseau', 'saut', 'latence', 'icmp',
    'destination unreachable', 'delai d attente depasse',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation : tous les tests de cet assistant sont accessibles à un compte ordinaire.',
    'Le trafic ICMP sortant doit être autorisé pour que l’écho et la trace disent quelque chose.',
  ]),
  commonErvide: null,
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Délai d’attente de la demande dépassé',
      cause: 'Aucun écho ne revient. La cible est éteinte, une route manque, ou — le plus souvent — son pare-feu bloque l’écho ICMP.',
      fix: 'Regarder le test de port du même rapport. S’il répond, la cible est joignable et l’écho n’est qu’un bruit.',
    },
    {
      message: 'Hôte de destination inaccessible',
      cause: 'Ce message vient d’un routeur du chemin, pas de la cible : il dit qu’il ne sait pas où envoyer le paquet.',
      fix: 'Vérifier la route par défaut et la passerelle avec l’assistant de diagnostic de passerelle.',
    },
    {
      message: 'La trace s’arrête sur des étoiles au bout de quelques sauts',
      cause: 'Les routeurs suivants ne répondent pas aux paquets expirés. C’est une configuration courante, pas une coupure.',
      fix: 'Si le port de destination répond, le chemin fonctionne. La trace n’est qu’indicative.',
    },
    {
      message: 'La résolution donne une adresse différente de celle attendue',
      cause: 'Enregistrement DNS périmé, ou entrée de cache qui survit à un changement d’adresse.',
      fix: 'Comparer la réponse du cache et celle du serveur avec l’assistant DNS client.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport dit séparément si le nom s’est résolu et si le port a répondu.',
    'Le nombre d’échos effectués correspond au nombre demandé : la mesure s’est bien arrêtée.',
    'La carte utilisée pour sortir est nommée : si ce n’est pas la bonne, le problème est ailleurs.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit et mesure. Il n’y a rien à annuler.',
    diagnostic: '# Refaire la mesure la plus simple, a la main.\nTest-NetConnection -ComputerName \'<cible>\' -Port 445',
    command: '# Rien a annuler. Aucune commande de ce script n\'ecrit sur la machine\n# ni sur le reseau : il envoie des echos et ouvre des connexions TCP\n# qui se referment seules.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Le rapport contient des adresses internes et le chemin réseau de l’établissement. Il se joint à un billet interne.',
  },
  checks: [
    'Le nombre d’échos est borné et validé : aucune boucle sans fin.',
    'Le nombre de sauts est borné et validé.',
    'Un écho bloqué est présenté comme une absence de preuve, pas comme une panne.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection',
  sources: [
    { label: 'Test-NetConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
    { label: 'Test-Connection', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/test-connection' },
    { label: 'tracert', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/tracert' },
  ],
};

/**
 * 4. latency-packet-loss — est-ce lent, ou est-ce instable ?
 *
 * Deux pannes très différentes qu'on décrit avec le même mot. Une latence
 * élevée mais régulière gêne la voix et laisse le reste tranquille ; une
 * latence basse mais qui saute de 5 à 300 ms casse tout, et le « ping moyen »
 * reste bon. Cet assistant mesure les deux, et refuse de tourner sans fin.
 */
export const outilLatencePerte = {
  id: 'latency-packet-loss',
  icon: '∿',
  category: 'Réseau',
  subcategory: 'Connectivité IP',
  title: 'Mesurer latence, gigue et perte de paquets',
  risk: 'diagnostic',
  summary: 'Mesure sur un nombre d’essais borné : latence minimale, moyenne et maximale, gigue approximative, et taux de perte. Distingue « lent » de « instable », qui sont deux pannes différentes qu’on décrit avec le même mot.',
  fields: [
    champCible('lpCible', 'Cible de la mesure. La passerelle pour un problème local, un serveur pour un problème de bout en bout.', '192.168.30.1'),
    {
      id: 'lpEssais', label: 'Nombre de mesures', default: '20',
      help: 'Entre 1 et 100. Vingt mesures donnent une idée ; cinquante commencent à être représentatives. Au-delà, mieux vaut répéter l’opération à des moments différents.',
    },
    {
      id: 'lpPause', label: 'Pause entre deux mesures (ms)', default: '200',
      help: 'Entre 100 et 30000. Deux cents millisecondes évitent de marteler la cible.',
    },
    {
      id: 'lpSeuil', label: 'Seuil d’alerte de latence (ms)', default: '100',
      help: 'Au-delà, le rapport signale. Cent millisecondes gênent déjà la téléphonie ; trente suffisent sur un réseau local.',
    },
    champFormat('lpFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'lpCible', validerCibleReseau(v.lpCible));
    verifier(errors, 'lpEssais', validerNombreEssais(v.lpEssais, { min: 1, max: 100, label: 'Le nombre de mesures' }));
    verifier(errors, 'lpPause', validerDelaiMs(v.lpPause, { min: 100, max: 30000, label: 'La pause' }));
    verifier(errors, 'lpSeuil', validerEntier(v.lpSeuil, 1, 10000, 'Le seuil d’alerte'));
    verifier(errors, 'lpFormat', validerFormatRapport(v.lpFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerCibleReseau(v.lpCible).value;
    const essais = validerNombreEssais(v.lpEssais, { min: 1, max: 100 }).value;
    const pause = validerDelaiMs(v.lpPause, { min: 100, max: 30000 }).value;
    const seuil = validerEntier(v.lpSeuil, 1, 10000).value;
    const dureeMax = Math.round((essais * (pause + 1000)) / 1000);

    const corps = [
      `$Cible = ${psB64(cible)}`,
      `$Essais = ${essais}`,
      `$Pause = ${pause}`,
      `$Seuil = ${seuil}`,
      `$KjemoFormat = ${psB64(v.lpFormat)}`,
      "",
      blocContexteReseau(),
      blocMesureBornee(essais, pause),
      `# Duree maximale de cette mesure : environ ${dureeMax} secondes.`,
      "",
      '# --- 1. Mesure -----------------------------------------------------------------------',
      '$valeurs = New-Object System.Collections.ArrayList',
      '$perdus = 0',
      'for ($i = 1; $i -le $Essais; $i++) {',
      '  $r = $null',
      '  try { $r = Test-Connection -ComputerName $Cible -Count 1 -ErrorAction SilentlyContinue } catch { }',
      '  if ($r) {',
      '    $ms = $null',
      '    if ($r.ResponseTime -ne $null) { $ms = $r.ResponseTime }',
      '    elseif ($r.Latency -ne $null) { $ms = $r.Latency }',
      '    if ($ms -ne $null) { [void]$valeurs.Add([double]$ms) } else { $perdus++ }',
      '  } else {',
      '    $perdus++',
      '  }',
      '  if ($i -lt $Essais) { Start-Sleep -Milliseconds $Pause }',
      '}',
      "",
      '# --- 2. Perte -------------------------------------------------------------------------',
      '$tauxPerte = [Math]::Round(($perdus / $Essais) * 100, 1)',
      "$etatPerte = 'OK'",
      "$notePerte = ''",
      "if ($tauxPerte -ge 100) { $etatPerte = 'PROBLEME' ; $notePerte = 'Aucune reponse. Soit la cible ne repond pas a l''echo, soit elle est injoignable : le test d''un port tranche.' }",
      "elseif ($tauxPerte -gt 5) { $etatPerte = 'PROBLEME' ; $notePerte = 'Au-dela de 5 %, la perte se voit sur les applications : coupures de voix, transferts qui recommencent.' }",
      "elseif ($tauxPerte -gt 0) { $etatPerte = 'ATTENTION' ; $notePerte = 'Perte faible mais reelle. Sur un reseau local filaire, elle ne devrait pas exister : chercher du cote du cable ou du port du commutateur.' }",
      "[void](Add-KjemoResultat -Categorie 'Perte' -Controle 'Paquets perdus' -Etat $etatPerte -Valeur ($perdus.ToString() + ' / ' + $Essais + ' (' + $tauxPerte + ' %)') -Commentaire $notePerte)",
      "",
      '# --- 3. Latence et gigue --------------------------------------------------------------',
      "# La gigue calculee ici est l'ecart-type des aller-retours : une approximation",
      "# honnete, et le mot « approximative » est dans le titre de l'outil. La gigue",
      '# au sens de la RFC 3550 se mesure sur un flux continu, pas sur des echos',
      '# espaces.',
      'if ($valeurs.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Latence' -Controle 'Mesure' -Etat 'PROBLEME' -Valeur 'aucune valeur' -Commentaire 'Rien a mesurer : aucun echo n''est revenu.')",
      '} else {',
      '  $stat = $valeurs | Measure-Object -Average -Minimum -Maximum',
      '  $moy = [Math]::Round($stat.Average, 1)',
      '  $ecart = 0',
      '  if ($valeurs.Count -gt 1) {',
      '    $somme = 0',
      '    foreach ($x in $valeurs) { $somme += [Math]::Pow($x - $stat.Average, 2) }',
      '    $ecart = [Math]::Round([Math]::Sqrt($somme / ($valeurs.Count - 1)), 1)',
      '  }',
      "  $etatL = 'OK'",
      "  $noteL = ''",
      "  if ($moy -gt $Seuil) { $etatL = 'PROBLEME' ; $noteL = 'Au-dela du seuil demande. Une latence elevee mais REGULIERE gene surtout la voix et la video.' }",
      "  [void](Add-KjemoResultat -Categorie 'Latence' -Controle 'Moyenne' -Etat $etatL -Valeur ($moy.ToString() + ' ms') -Commentaire $noteL)",
      "  [void](Add-KjemoResultat -Categorie 'Latence' -Controle 'Minimum' -Etat 'INFO' -Valeur ($stat.Minimum.ToString() + ' ms'))",
      "  [void](Add-KjemoResultat -Categorie 'Latence' -Controle 'Maximum' -Etat 'INFO' -Valeur ($stat.Maximum.ToString() + ' ms'))",
      '  $amplitude = $stat.Maximum - $stat.Minimum',
      "  $etatG = 'OK'",
      "  $noteG = 'Mesure approximative : ecart-type des aller-retours, pas la gigue au sens de la RFC 3550.'",
      "  if ($ecart -gt 30) { $etatG = 'PROBLEME' ; $noteG = 'Variation forte. Une latence BASSE mais instable casse plus de choses qu''une latence haute et reguliere — et la moyenne reste bonne, ce qui egare.' }",
      "  elseif ($ecart -gt 10) { $etatG = 'ATTENTION' ; $noteG = 'Variation notable : a surveiller si la voix ou la video sont concernees.' }",
      "  [void](Add-KjemoResultat -Categorie 'Stabilite' -Controle 'Gigue approximative' -Etat $etatG -Valeur ($ecart.ToString() + ' ms') -Commentaire $noteG)",
      "  [void](Add-KjemoResultat -Categorie 'Stabilite' -Controle 'Amplitude' -Etat 'INFO' -Valeur ($amplitude.ToString() + ' ms') -Commentaire 'Ecart entre la mesure la plus rapide et la plus lente.')",
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Lire ce rapport ---'",
      "Write-Host 'Lent et regulier : la voix souffre, le reste tient.'",
      "Write-Host 'Rapide mais instable : tout saccade, et la moyenne reste bonne.'",
      "Write-Host 'Perte superieure a 5 % : les applications le voient, pas seulement les mesures.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Latence, gigue et perte de paquets',
      outil: 'latency-packet-loss',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Cible', psB64(cible)],
        ['Essais', psB64(String(essais))],
        ['Pause', psB64(String(pause))],
        ['Format', psB64(v.lpFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-latence',
      formats: v.lpFormat,
    });
  },
  gui: [
    'Invite de commandes : « ping -n 20 <cible> » donne min, moyenne, max et perte en fin de série.',
    '« pathping <cible> » mesure la perte saut par saut, et dit où elle apparaît. Compter plusieurs minutes.',
    'Pour la voix : le Moniteur de performances, compteurs Interface réseau, suivis sur une plage de temps.',
    'Un test de débit vers Internet ne mesure pas la latence interne : il faut viser la passerelle ou le serveur concerné.',
    'Mesurer au moment où la panne se produit : une mesure prise au calme ne montre rien.',
  ],
  keywords: [
    'latence', 'gigue', 'jitter', 'perte de paquets', 'packet loss', 'lenteur reseau',
    'instable', 'saccade', 'voix sur ip', 'qualite reseau', 'ping moyen', 'pathping',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'La cible doit répondre à l’écho ICMP, sinon la mesure n’a rien à mesurer.',
    'Mesurer pendant la panne : une mesure prise au calme ne montre rien.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Perte de 100 % alors que le service fonctionne',
      cause: 'La cible ne répond pas à l’écho ICMP, par configuration.',
      fix: 'Viser la passerelle plutôt que le serveur, ou utiliser le test de port de l’assistant ping/traceroute.',
    },
    {
      message: 'La moyenne est bonne mais les utilisateurs se plaignent',
      cause: 'C’est la gigue, pas la latence. Une moyenne de 20 ms avec des pointes à 400 ms donne la même moyenne qu’un réseau sain.',
      fix: 'Regarder la ligne « Gigue approximative » et l’amplitude. Le maximum compte plus que la moyenne.',
    },
    {
      message: 'La mesure semble ne jamais se terminer',
      cause: 'Un grand nombre d’essais multiplié par une longue pause. Le script annonce sa durée maximale en tête.',
      fix: 'Le nombre d’essais est plafonné à cent et la pause à trente secondes : la durée est bornée par construction.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le nombre de mesures effectuées correspond au nombre demandé.',
    'Le rapport distingue la latence moyenne de la gigue : ce sont deux lignes séparées.',
    'La durée réelle ne dépasse pas la durée annoncée en tête de script.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant mesure. Il n’y a rien à annuler.',
    diagnostic: '# Refaire une mesure courte, a la main.\nTest-Connection -ComputerName \'<cible>\' -Count 10 | Measure-Object -Property ResponseTime -Average -Minimum -Maximum',
    command: '# Rien a annuler : aucune ecriture, aucun changement de configuration.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Une mesure répétée vers une cible externe peut être vue comme du trafic indésirable. Viser d’abord les équipements de l’établissement.',
  },
  checks: [
    'Le nombre d’essais et la pause sont bornés et validés : la durée est connue d’avance.',
    'La gigue est annoncée comme approximative, et la raison est écrite dans le script.',
    'Aucune boucle sans condition de sortie.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/test-connection',
  sources: [
    { label: 'Test-Connection', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/test-connection' },
    { label: 'pathping', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/pathping' },
    { label: 'ping', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/ping' },
  ],
};

/**
 * 5. gateway-diagnostic — la passerelle est-elle configurée, joignable,
 *    correcte, et réellement utilisée ?
 *
 * Quatre questions distinctes, et on les confond tout le temps. Une passerelle
 * peut être configurée et injoignable, joignable et hors du sous-réseau,
 * correcte et pourtant inutilisée parce qu'une autre carte a une métrique plus
 * basse. Le rapport répond aux quatre séparément.
 */
export const outilDiagnosticPasserelle = {
  id: 'gateway-diagnostic',
  icon: '⇥',
  category: 'Réseau',
  subcategory: 'Connectivité IP',
  title: 'Diagnostiquer la passerelle par défaut',
  risk: 'diagnostic',
  summary: 'Répond à quatre questions distinctes qu’on confond tout le temps : la passerelle est-elle configurée, est-elle joignable, est-elle dans le bon sous-réseau, et est-ce bien elle qui sert ?',
  fields: [
    {
      id: 'gdCarte', label: 'Carte à examiner (facultatif)', default: '',
      help: 'Nom exact de la carte, tel que Get-NetAdapter l’affiche. Vide : toutes les cartes qui ont une passerelle.',
    },
    {
      id: 'gdCibleExterne', label: 'Cible au-delà de la passerelle', default: 'www.microsoft.com',
      help: 'Un nom à joindre après la passerelle, pour distinguer « la passerelle ne répond pas » de « la passerelle ne route pas ».',
    },
    champFormat('gdFormat'),
  ],
  validate(v) {
    const errors = {};
    const carte = String(v.gdCarte ?? '').trim();
    if (carte !== '') {
      if (/["`$;|&<>]/.test(carte)) {
        errors.gdCarte = 'Le nom de la carte ne peut contenir ni guillemet ni caractère de commande.';
      } else if (carte.length > 128) {
        errors.gdCarte = 'Le nom de la carte dépasse 128 caractères.';
      }
    }
    verifier(errors, 'gdCibleExterne', validerCibleReseau(v.gdCibleExterne));
    verifier(errors, 'gdFormat', validerFormatRapport(v.gdFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const carte = String(v.gdCarte ?? '').trim();
    const externe = validerCibleReseau(v.gdCibleExterne).value;

    const corps = [
      `$Carte = ${psB64(carte)}`,
      `$Externe = ${psB64(externe)}`,
      `$KjemoFormat = ${psB64(v.gdFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- 1. Configuree ? -------------------------------------------------------------------',
      '$configs = @()',
      'try {',
      '  $configs = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -ne $null })',
      "  if ($Carte -ne '') { $configs = @($configs | Where-Object { $_.InterfaceAlias -eq $Carte }) }",
      '} catch { }',
      "",
      'if ($configs.Count -eq 0) {',
      "  $note = 'Aucune carte ne porte de passerelle IPv4. Rien ne sortira du sous-reseau local.'",
      "  if ($Carte -ne '') { $note = 'La carte demandee n''existe pas, ou ne porte aucune passerelle IPv4.' }",
      "  [void](Add-KjemoResultat -Categorie '1. Configuree' -Controle 'Passerelle' -Etat 'PROBLEME' -Valeur 'aucune' -Commentaire $note)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie '1. Configuree' -Controle 'Cartes avec passerelle' -Etat 'OK' -Valeur $configs.Count)",
      '  if ($configs.Count -gt 1) {',
      "    [void](Add-KjemoResultat -Categorie '1. Configuree' -Controle 'Passerelles multiples' -Etat 'ATTENTION' -Valeur $configs.Count -Commentaire 'Plusieurs passerelles : une seule sert reellement, celle dont la metrique est la plus BASSE. Voir la section 4.')",
      '  }',
      '}',
      "",
      'foreach ($cfg in $configs) {',
      '  $alias = $cfg.InterfaceAlias',
      '  $passerelle = $cfg.IPv4DefaultGateway.NextHop',
      '  $adresseLocale = $null',
      '  $prefixe = $null',
      '  try {',
      '    $ip = ($cfg.IPv4Address | Select-Object -First 1)',
      '    $adresseLocale = $ip.IPAddress',
      '    $prefixe = $ip.PrefixLength',
      '  } catch { }',
      "  [void](Add-KjemoResultat -Categorie '1. Configuree' -Controle $alias -Etat 'INFO' -Valeur $passerelle -Commentaire ('adresse locale ' + $adresseLocale + '/' + $prefixe))",
      "",
      '  # --- 2. Joignable ? ------------------------------------------------------------------',
      "  # Une passerelle qui ne repond pas a l'echo n'est pas forcement en panne :",
      '  # certains equipements ne repondent pas. Le voisinage ARP est plus parlant,',
      "  # parce qu'il prouve qu'elle a repondu au niveau 2.",
      '  $echo = $null',
      '  try { $echo = Test-Connection -ComputerName $passerelle -Count 2 -ErrorAction SilentlyContinue } catch { }',
      '  if ($echo) {',
      "    [void](Add-KjemoResultat -Categorie '2. Joignable' -Controle $passerelle -Etat 'OK' -Valeur 'repond a l''echo')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie '2. Joignable' -Controle $passerelle -Etat 'ATTENTION' -Valeur 'pas de reponse a l''echo' -Commentaire 'Certains equipements ne repondent pas a l''echo. Le voisinage ci-dessous tranche.')",
      '  }',
      '  $voisin = $null',
      '  try { $voisin = Get-NetNeighbor -IPAddress $passerelle -ErrorAction SilentlyContinue | Select-Object -First 1 } catch { }',
      '  if ($voisin) {',
      "    $etatV = 'OK'",
      "    $noteV = 'La passerelle a repondu au niveau 2 : elle est presente sur le segment.'",
      "    if ($voisin.State -eq 'Unreachable' -or $voisin.State -eq 'Incomplete') {",
      "      $etatV = 'PROBLEME'",
      "      $noteV = 'Aucune adresse MAC pour la passerelle : elle est absente du segment, ou le VLAN n''est pas le bon.'",
      '    }',
      "    [void](Add-KjemoResultat -Categorie '2. Joignable' -Controle 'Voisinage (MAC)' -Etat $etatV -Valeur ($voisin.LinkLayerAddress + ' — ' + $voisin.State) -Commentaire $noteV)",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie '2. Joignable' -Controle 'Voisinage (MAC)' -Etat 'ATTENTION' -Valeur 'aucune entree' -Commentaire 'Aucune resolution d''adresse MAC pour la passerelle.')",
      '  }',
      "",
      '  # --- 3. Correcte ? -------------------------------------------------------------------',
      "  # Une passerelle hors du sous-reseau local ne peut pas etre jointe : c'est une",
      "  # erreur de saisie frequente, et elle ne se voit pas a l'oeil.",
      '  if ($adresseLocale -and $prefixe -ne $null) {',
      '    $memeReseau = $false',
      '    try {',
      '      $octets = $adresseLocale.Split(\'.\')',
      '      $octetsP = $passerelle.Split(\'.\')',
      '      $bitsEntiers = [Math]::Floor($prefixe / 8)',
      '      $memeReseau = $true',
      '      for ($k = 0; $k -lt $bitsEntiers; $k++) {',
      '        if ($octets[$k] -ne $octetsP[$k]) { $memeReseau = $false }',
      '      }',
      '      if ($prefixe % 8 -ne 0 -and $bitsEntiers -lt 4) {',
      '        $reste = $prefixe % 8',
      '        $masqueOctet = 256 - [Math]::Pow(2, 8 - $reste)',
      '        if (([int]$octets[$bitsEntiers] -band $masqueOctet) -ne ([int]$octetsP[$bitsEntiers] -band $masqueOctet)) { $memeReseau = $false }',
      '      }',
      '    } catch { }',
      '    if ($memeReseau) {',
      "      [void](Add-KjemoResultat -Categorie '3. Correcte' -Controle 'Dans le sous-reseau' -Etat 'OK' -Valeur ($passerelle + ' dans ' + $adresseLocale + '/' + $prefixe))",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie '3. Correcte' -Controle 'Dans le sous-reseau' -Etat 'PROBLEME' -Valeur ($passerelle + ' hors de ' + $adresseLocale + '/' + $prefixe) -Commentaire 'Une passerelle hors du sous-reseau local ne peut pas etre jointe. Erreur de saisie, ou masque de sous-reseau faux.')",
      '    }',
      '  }',
      "",
      '  # --- 4. Utilisee ? -------------------------------------------------------------------',
      '  $route = $null',
      "  try { $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Where-Object { $_.NextHop -eq $passerelle } | Select-Object -First 1 } catch { }",
      '  if ($route) {',
      "    [void](Add-KjemoResultat -Categorie '4. Utilisee' -Controle $alias -Etat 'INFO' -Valeur ('metrique de route ' + $route.RouteMetric) -Commentaire 'La route par defaut dont la metrique TOTALE est la plus basse gagne : metrique de route + metrique d''interface.')",
      '  }',
      '}',
      "",
      '# --- 4 bis. Laquelle sert reellement ? ---------------------------------------------------',
      '$toutes = @()',
      "try { $toutes = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue) } catch { }",
      'if ($toutes.Count -gt 0) {',
      '  $classees = @($toutes | Sort-Object { $_.RouteMetric + $_.InterfaceMetric })',
      '  $gagnante = $classees[0]',
      "  [void](Add-KjemoResultat -Categorie '4. Utilisee' -Controle 'Passerelle qui sert' -Etat 'OK' -Valeur $gagnante.NextHop -Commentaire ('interface ' + $gagnante.InterfaceIndex + ' · metrique totale ' + ($gagnante.RouteMetric + $gagnante.InterfaceMetric)))",
      '  if ($classees.Count -gt 1) {',
      '    foreach ($r in ($classees | Select-Object -Skip 1)) {',
      "      [void](Add-KjemoResultat -Categorie '4. Utilisee' -Controle ('Inutilisee : ' + $r.NextHop) -Etat 'INFO' -Valeur ('metrique totale ' + ($r.RouteMetric + $r.InterfaceMetric)) -Commentaire 'Configuree, mais perdante.')",
      '    }',
      '  }',
      '}',
      "",
      '# --- 5. Au-dela de la passerelle ---------------------------------------------------------',
      "# Distingue « la passerelle ne repond pas » de « la passerelle ne route pas ».",
      '$audela = $null',
      'try { $audela = Test-NetConnection -ComputerName $Externe -Port 443 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($audela) {',
      "  $etatA = 'PROBLEME'",
      "  $noteA = 'La passerelle repond peut-etre, mais rien ne passe au-dela : routage, pare-feu periphérique, ou resolution de noms.'",
      "  if ($audela.TcpTestSucceeded) { $etatA = 'OK' ; $noteA = 'Le trafic traverse la passerelle et revient.' }",
      "  [void](Add-KjemoResultat -Categorie '5. Au-dela' -Controle $Externe -Etat $etatA -Valeur ('TCP 443 ouvert : ' + $audela.TcpTestSucceeded) -Commentaire $noteA)",
      '}',
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Diagnostic de la passerelle par defaut',
      outil: 'gateway-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Carte', psB64(carte)],
        ['Externe', psB64(externe)],
        ['Format', psB64(v.gdFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-passerelle',
      formats: v.gdFormat,
    });
  },
  gui: [
    'Paramètres > Réseau et Internet > Propriétés de la connexion : la passerelle IPv4 y figure.',
    '« ipconfig » affiche la passerelle de chaque carte, « route print » montre laquelle sert.',
    '« arp -a » montre si la passerelle a répondu au niveau 2 : une ligne absente est plus parlante qu’un ping sans réponse.',
    'Propriétés de la carte > TCP/IPv4 > Avancé > Métrique d’interface : c’est là qu’on force une carte à passer devant.',
    'Un VPN monté ajoute sa propre route par défaut : c’est voulu, et c’est la cause la plus fréquente d’un changement soudain.',
  ],
  keywords: [
    'passerelle', 'gateway', 'route par defaut', 'default gateway', 'pas d internet',
    'sort pas du reseau', 'metrique', 'arp', 'voisinage', 'deux passerelles',
    'passerelle injoignable', 'hors sous-reseau',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation nécessaire.',
    'Au moins une carte connectée : sans carte, il n’y a pas de passerelle à diagnostiquer.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'La passerelle ne répond pas au ping mais tout fonctionne',
      cause: 'L’équipement ne répond pas à l’écho ICMP, par configuration.',
      fix: 'Regarder la ligne « Voisinage (MAC) » : une adresse MAC résolue prouve que la passerelle est là.',
    },
    {
      message: 'La passerelle est hors du sous-réseau local',
      cause: 'Erreur de saisie de l’adresse, ou masque de sous-réseau faux — un /24 saisi là où il fallait un /16.',
      fix: 'Corriger le masque ou la passerelle. Une passerelle hors du sous-réseau ne peut pas être jointe, quoi qu’il arrive.',
    },
    {
      message: 'Le trafic passe par le Wi-Fi alors que le câble est branché',
      cause: 'La métrique totale de la route Wi-Fi est plus basse que celle du câble.',
      fix: 'La section 4 nomme la passerelle qui sert. L’assistant des cartes multiples détaille les métriques.',
    },
    {
      message: 'La passerelle répond, mais rien ne sort du réseau',
      cause: 'Elle est joignable sans router : route manquante en amont, pare-feu périphérique, ou DNS en panne.',
      fix: 'La section 5 distingue les deux cas. Si la résolution échoue, c’est le DNS, pas la passerelle.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les quatre questions ont chacune leur réponse dans le rapport, dans des sections numérotées.',
    'S’il y a plusieurs passerelles, la section 4 nomme celle qui sert et celles qui ne servent pas.',
    'La section 5 dit si quelque chose passe au-delà de la passerelle.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit la configuration et mesure. Il n’y a rien à annuler.',
    diagnostic: '# Les routes par defaut, classees par metrique totale.\nGet-NetRoute -DestinationPrefix \'0.0.0.0/0\' | Sort-Object { $_.RouteMetric + $_.InterfaceMetric } | Format-Table InterfaceAlias,NextHop,RouteMetric,InterfaceMetric',
    command: '# Rien a annuler : aucune ecriture.\n# Pour changer la passerelle qui sert, ce sont les METRIQUES qu\'on ajuste,\n# avec l\'assistant des cartes multiples, jamais en supprimant une route.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Changer une métrique d’interface à distance peut couper la session en cours : la route qui vous porte est peut-être celle que vous dégradez.',
  },
  checks: [
    'Les quatre questions sont posées séparément : configurée, joignable, correcte, utilisée.',
    'L’appartenance de la passerelle au sous-réseau est calculée, pas supposée.',
    'Aucune modification de route, de métrique ou d’adresse.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute',
  sources: [
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
    { label: 'Get-NetNeighbor', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netneighbor' },
    { label: 'Get-NetIPConfiguration', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipconfiguration' },
  ],
};
/**
 * 6. ip-conflict-detection — chercher un conflit d'adresse, prudemment.
 *
 * Un conflit IPv4 ne se prouve pas depuis une seule machine. Ce qu'on peut
 * faire : regarder ce que le voisinage ARP a appris, chercher les événements
 * que Windows écrit quand il en détecte un, et vérifier si l'adresse qu'on
 * croit libre répond déjà.
 *
 * Ce que cet assistant ne fera jamais : annoncer une certitude. Un conflit
 * peut être intermittent, masqué par un commutateur, ou disparu depuis cinq
 * minutes. Le rapport le dit, en toutes lettres, à chaque exécution.
 */
export const outilConflitIp = {
  id: 'ip-conflict-detection',
  icon: '⚠',
  category: 'Réseau',
  subcategory: 'Connectivité IP',
  title: 'Chercher un conflit d’adresse IPv4',
  risk: 'diagnostic',
  summary: 'Croise trois sources — voisinage ARP, journaux Windows, réponse de l’adresse visée — pour chercher un conflit IPv4. N’annonce jamais de certitude : un conflit peut être intermittent, et l’absence de preuve n’est pas une preuve d’absence.',
  fields: [
    {
      id: 'cfAdresse', label: 'Adresse à examiner', default: '192.168.30.50',
      help: 'L’adresse soupçonnée, ou celle qu’on veut attribuer avant de le faire.',
    },
    {
      id: 'cfJours', label: 'Profondeur des journaux (jours)', default: '7',
      help: 'Entre 1 et 90. Windows écrit un événement quand il détecte lui-même un conflit.',
    },
    {
      id: 'cfLocale', label: 'Cette adresse est-elle celle de ce poste ?', type: 'select', default: 'Non',
      options: [
        ['Non', 'Non — j’examine une adresse distante'],
        ['Oui', 'Oui — c’est l’adresse de cette machine'],
      ],
      help: 'Change la lecture : si l’adresse est locale, une réponse venue d’une AUTRE carte MAC est le signe recherché.',
    },
    champFormat('cfFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'cfAdresse', validateIPv4(v.cfAdresse));
    verifier(errors, 'cfJours', validerEntier(v.cfJours, 1, 90, 'La profondeur'));
    verifier(errors, 'cfLocale', validerChoix(v.cfLocale, ['Non', 'Oui'], 'La réponse'));
    verifier(errors, 'cfFormat', validerFormatRapport(v.cfFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const adresse = validateIPv4(v.cfAdresse).value;
    const jours = validerEntier(v.cfJours, 1, 90).value;
    const locale = validerChoix(v.cfLocale, ['Non', 'Oui']).value;

    const corps = [
      `$Adresse = ${psB64(adresse)}`,
      `$Jours = ${jours}`,
      `$Locale = ${psB64(locale)}`,
      `$KjemoFormat = ${psB64(v.cfFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- Avertissement, en tete et non en bas -----------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Ce que ce script peut et ne peut pas dire ---'",
      "Write-Host 'Un conflit d''adresse ne se prouve PAS depuis une seule machine.'",
      "Write-Host 'Ce script croise trois indices. Aucun des trois ne constitue une preuve,'",
      "Write-Host 'et leur absence ne prouve rien non plus : un conflit intermittent peut'",
      "Write-Host 'avoir disparu il y a cinq minutes et revenir ce soir.'",
      "Write-Host 'La certitude se prend sur le commutateur, en regardant quel port annonce'",
      "Write-Host 'quelle adresse MAC.'",
      "[void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Portee de ce diagnostic' -Etat 'INFO' -Valeur 'indices, pas preuve' -Commentaire 'Aucun resultat de ce rapport ne constitue une certitude. Un conflit intermittent echappe a toute mesure ponctuelle.')",
      "",
      '# --- 1. Voisinage ARP ---------------------------------------------------------------',
      "# La table de voisinage dit quelle adresse MAC repond pour cette IP. Deux",
      '# entrees differentes pour la meme adresse, a quelques instants d\'intervalle,',
      "# est l'indice le plus net qu'on puisse obtenir d'un poste.",
      '$voisins = @()',
      'try { $voisins = @(Get-NetNeighbor -IPAddress $Adresse -ErrorAction SilentlyContinue) } catch { }',
      'if ($voisins.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Voisinage' -Controle $Adresse -Etat 'INFO' -Valeur 'aucune entree' -Commentaire 'Ce poste n''a pas appris d''adresse MAC pour cette IP. Elle est peut-etre libre, peut-etre sur un autre segment, peut-etre simplement silencieuse.')",
      '} else {',
      '  $macs = @($voisins | Where-Object { $_.LinkLayerAddress } | Select-Object -ExpandProperty LinkLayerAddress -Unique)',
      '  foreach ($n in $voisins) {',
      "    [void](Add-KjemoResultat -Categorie 'Voisinage' -Controle ($n.InterfaceAlias + ' — ' + $n.State) -Etat 'INFO' -Valeur $n.LinkLayerAddress)",
      '  }',
      '  if ($macs.Count -gt 1) {',
      "    [void](Add-KjemoResultat -Categorie 'Voisinage' -Controle 'Adresses MAC distinctes' -Etat 'PROBLEME' -Valeur $macs.Count -Commentaire ('Plusieurs cartes repondent pour la meme adresse IP : ' + ($macs -join ', ') + '. C''est l''indice le plus net d''un conflit.'))",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Voisinage' -Controle 'Adresses MAC distinctes' -Etat 'OK' -Valeur 1 -Commentaire 'Une seule carte repond, a cet instant, vue depuis ce poste.')",
      '  }',
      '}',
      "",
      '# --- 2. Deuxieme releve, apres un instant --------------------------------------------',
      "# Un conflit se trahit souvent par une MAC qui change. Deux releves espaces",
      "# de quelques secondes valent mieux qu'un seul.",
      'Start-Sleep -Seconds 3',
      '$voisins2 = @()',
      'try { $voisins2 = @(Get-NetNeighbor -IPAddress $Adresse -ErrorAction SilentlyContinue) } catch { }',
      '$mac1 = @($voisins | Where-Object { $_.LinkLayerAddress } | Select-Object -ExpandProperty LinkLayerAddress -Unique)',
      '$mac2 = @($voisins2 | Where-Object { $_.LinkLayerAddress } | Select-Object -ExpandProperty LinkLayerAddress -Unique)',
      'if ($mac1.Count -gt 0 -and $mac2.Count -gt 0) {',
      "  if (($mac1 -join ',') -ne ($mac2 -join ',')) {",
      "    [void](Add-KjemoResultat -Categorie 'Voisinage' -Controle 'Second releve' -Etat 'PROBLEME' -Valeur (($mac1 -join ',') + ' puis ' + ($mac2 -join ',')) -Commentaire 'L''adresse MAC a change entre deux releves espaces de trois secondes. C''est le comportement typique d''un conflit.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Voisinage' -Controle 'Second releve' -Etat 'OK' -Valeur 'identique' -Commentaire 'La meme carte repond trois secondes plus tard.')",
      '  }',
      '}',
      "",
      '# --- 3. Journaux Windows --------------------------------------------------------------',
      "# Windows ecrit un evenement quand il detecte lui-meme un conflit d'adresse.",
      "# Source Tcpip, identifiants 4198 et 4199 ; Dhcp-Client pour un bail refuse.",
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evenements = @()',
      'try {',
      "  $evenements = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; StartTime = $depuis; Id = 4198, 4199, 4200, 4201 } -ErrorAction SilentlyContinue)",
      '} catch { }',
      'if ($evenements.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Conflits signales sur ' + $Jours + ' jour(s)') -Etat 'OK' -Valeur 0 -Commentaire 'Windows n''a signale aucun conflit sur cette machine. Un conflit entre deux AUTRES machines n''apparaitrait pas ici.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Conflits signales sur ' + $Jours + ' jour(s)') -Etat 'PROBLEME' -Valeur $evenements.Count)",
      '  foreach ($e in ($evenements | Select-Object -First 10)) {',
      '    $texte = $e.Message',
      '    if ($texte -and $texte.Length -gt 180) { $texte = $texte.Substring(0, 180) }',
      "    [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ($e.TimeCreated.ToString('s') + ' — ID ' + $e.Id) -Etat 'INFO' -Valeur $texte)",
      '  }',
      '}',
      "",
      '# --- 4. L\'adresse repond-elle ? ---------------------------------------------------------',
      '$echo = $null',
      'try { $echo = Test-Connection -ComputerName $Adresse -Count 2 -ErrorAction SilentlyContinue } catch { }',
      "if ($Locale -eq 'Oui') {",
      "  [void](Add-KjemoResultat -Categorie 'Reponse' -Controle 'Adresse locale' -Etat 'INFO' -Valeur $Adresse -Commentaire 'L''adresse est celle de ce poste : une reponse est normale. C''est une MAC DIFFERENTE de la sienne, dans le voisinage, qui serait le signe recherche.')",
      '  $siennes = @()',
      '  try { $siennes = @(Get-NetAdapter -ErrorAction SilentlyContinue | Select-Object -ExpandProperty MacAddress) } catch { }',
      '  foreach ($m in $mac2) {',
      '    if ($siennes -notcontains $m) {',
      "      [void](Add-KjemoResultat -Categorie 'Reponse' -Controle 'MAC etrangere pour notre adresse' -Etat 'PROBLEME' -Valeur $m -Commentaire 'Une carte qui n''est pas la notre repond pour notre adresse.')",
      '    }',
      '  }',
      '} else {',
      '  if ($echo) {',
      "    [void](Add-KjemoResultat -Categorie 'Reponse' -Controle $Adresse -Etat 'INFO' -Valeur 'repond' -Commentaire 'Cette adresse est deja prise par quelque chose. Ne pas l''attribuer sans savoir par quoi.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Reponse' -Controle $Adresse -Etat 'INFO' -Valeur 'ne repond pas' -Commentaire 'Silence. Cela ne veut pas dire libre : un poste eteint, en veille, ou qui ne repond pas a l''echo donne le meme silence.')",
      '  }',
      '}',
      "",
      '# --- 5. Conclusion prudente -------------------------------------------------------------',
      '$indices = 0',
      'if ($mac2.Count -gt 1) { $indices++ }',
      "if (($mac1 -join ',') -ne ($mac2 -join ',') -and $mac1.Count -gt 0 -and $mac2.Count -gt 0) { $indices++ }",
      'if ($evenements.Count -gt 0) { $indices++ }',
      'if ($indices -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Conclusion' -Controle 'Indices reunis' -Etat 'OK' -Valeur 0 -Commentaire 'Aucun indice de conflit a cet instant, depuis ce poste. Ce n''est pas une preuve qu''il n''y en a pas.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Conclusion' -Controle 'Indices reunis' -Etat 'PROBLEME' -Valeur ($indices.ToString() + ' / 3') -Commentaire 'Des indices concordent. La confirmation se prend sur le commutateur : quel port annonce quelle adresse MAC.')",
      '}',
      "Write-Host ''",
      "Write-Host 'Pour trancher : sur le commutateur, chercher l''adresse MAC dans la table'",
      "Write-Host 'd''adresses et voir sur quel port elle apparait. Deux ports pour la meme'",
      "Write-Host 'adresse IP, c''est un conflit ; un seul, c''est autre chose.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Recherche de conflit d\'adresse IPv4',
      outil: 'ip-conflict-detection',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Adresse', psB64(adresse)],
        ['Jours', psB64(String(jours))],
        ['Locale', psB64(locale)],
        ['Format', psB64(v.cfFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-conflit',
      formats: v.cfFormat,
    });
  },
  gui: [
    'Observateur d’événements > Journaux Windows > Système, filtrer sur la source Tcpip : les identifiants 4198 et 4199 signalent un conflit détecté.',
    '« arp -a » liste les adresses MAC apprises. Lancer deux fois à quelques secondes d’intervalle et comparer.',
    'Sur le commutateur : la table d’adresses MAC dit quel port annonce quelle adresse. C’est la seule preuve réelle.',
    'Côté serveur DHCP : les baux refusés (DECLINE) signalent qu’un client a trouvé son adresse déjà prise.',
    'Une adresse statique posée dans la plage du DHCP est la cause la plus fréquente : vérifier les exclusions.',
  ],
  keywords: [
    'conflit ip', 'adresse dupliquee', 'duplicate ip', 'conflit d adresse',
    'arp', 'mac', 'voisinage', 'tcpip 4198', 'tcpip 4199', 'deux machines meme ip',
    'adresse deja utilisee', 'decline dhcp',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Lire le journal Système demande parfois des droits selon la stratégie locale ; le reste fonctionne sans élévation.',
    'Le poste doit être sur le même segment que l’adresse examinée pour que le voisinage ARP dise quelque chose.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Aucun indice trouvé alors que les utilisateurs se plaignent',
      cause: 'Un conflit intermittent : la machine fautive est éteinte, en veille, ou n’a pas encore repris son adresse.',
      fix: 'Relancer à plusieurs moments, et surtout pendant la panne. Le rapport ne conclut jamais à l’absence de conflit.',
    },
    {
      message: 'Le voisinage ne montre rien pour cette adresse',
      cause: 'L’adresse est sur un autre segment, ou aucune machine ne l’a sollicitée récemment.',
      fix: 'Le voisinage ARP n’apprend que ce qui est sur le même segment de niveau 2. Depuis un autre VLAN, il ne dira rien.',
    },
    {
      message: 'Windows signale un conflit mais tout fonctionne',
      cause: 'Le conflit a été résolu : la seconde machine a relâché l’adresse ou reçu un autre bail.',
      fix: 'Regarder l’horodatage de l’événement. Un conflit d’il y a six jours n’explique pas une panne d’aujourd’hui.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport annonce dès le départ qu’il donne des indices et non une preuve.',
    'Deux relevés de voisinage espacés ont bien été faits : la section le montre.',
    'La conclusion compte les indices réunis sur trois, sans jamais affirmer de certitude.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit le voisinage et les journaux. Il n’y a rien à annuler.',
    diagnostic: '# Le voisinage appris pour une adresse.\nGet-NetNeighbor -IPAddress \'<adresse>\' | Format-Table InterfaceAlias,LinkLayerAddress,State',
    command: '# Rien a annuler : aucune ecriture.\n# Pour forcer un nouvel apprentissage d\'UNE entree, voir l\'assistant\n# de diagnostic ARP, qui ne vide jamais toute la table.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Le rapport contient des adresses MAC. Elles identifient du matériel : à traiter comme une donnée d’inventaire interne.',
  },
  checks: [
    'Aucune certitude n’est annoncée, dans aucun cas.',
    'Deux relevés espacés valent mieux qu’un, et le script le fait.',
    'Aucune écriture, aucune purge de table ARP.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netneighbor',
  sources: [
    { label: 'Get-NetNeighbor', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netneighbor' },
    { label: 'arp', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/arp' },
    { label: 'Get-WinEvent', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent' },
  ],
};

/**
 * 7. adapter-metric-multihoming — plusieurs cartes, une seule qui sert.
 *
 * Le poste a un câble, un Wi-Fi, parfois un VPN et une carte virtuelle
 * d'hyperviseur. Toutes fonctionnent. Une seule porte le trafic sortant, et
 * ce n'est pas toujours celle qu'on croit : Windows additionne la métrique
 * de la route et celle de l'interface, et la somme la plus basse gagne.
 *
 * Cet outil montre le calcul, pas seulement le résultat.
 */
export const outilCartesMultiples = {
  id: 'adapter-metric-multihoming',
  icon: '⇄',
  category: 'Réseau',
  subcategory: 'Connectivité IP',
  title: 'Diagnostiquer cartes multiples et métriques',
  risk: 'diagnostic',
  summary: 'Montre le calcul qui décide quelle carte porte le trafic sortant : métrique de route plus métrique d’interface, somme la plus basse gagnante. Signale les routes concurrentes, les passerelles multiples et les métriques automatiques.',
  fields: [
    {
      id: 'amCibleTest', label: 'Cible pour l’épreuve de sortie', default: 'www.microsoft.com',
      help: 'Une cible hors du réseau local, pour voir quelle carte sert réellement.',
    },
    {
      id: 'amFamille', label: 'Famille d’adresses', type: 'select', default: 'IPv4',
      options: [
        ['IPv4', 'IPv4 seulement'],
        ['Les deux', 'IPv4 et IPv6'],
      ],
      help: 'IPv6 a ses propres métriques et sa propre route par défaut : les regarder ensemble évite de chercher longtemps.',
    },
    champFormat('amFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'amCibleTest', validerCibleReseau(v.amCibleTest));
    verifier(errors, 'amFamille', validerChoix(v.amFamille, ['IPv4', 'Les deux'], 'La famille'));
    verifier(errors, 'amFormat', validerFormatRapport(v.amFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerCibleReseau(v.amCibleTest).value;
    const famille = validerChoix(v.amFamille, ['IPv4', 'Les deux']).value;

    const corps = [
      `$Cible = ${psB64(cible)}`,
      `$Famille = ${psB64(famille)}`,
      `$KjemoFormat = ${psB64(v.amFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- 1. Toutes les cartes connectees -------------------------------------------------',
      '$interfaces = @()',
      'try {',
      "  $interfaces = @(Get-NetIPInterface -ErrorAction SilentlyContinue | Where-Object { $_.ConnectionState -eq 'Connected' })",
      "  if ($Famille -eq 'IPv4') { $interfaces = @($interfaces | Where-Object { $_.AddressFamily -eq 'IPv4' }) }",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Interfaces' -Controle 'Connectees' -Etat 'INFO' -Valeur $interfaces.Count)",
      'foreach ($i in ($interfaces | Sort-Object InterfaceMetric)) {',
      "  $note = 'Metrique fixee a la main.'",
      "  if ($i.AutomaticMetric -eq 'Enabled') { $note = 'Metrique AUTOMATIQUE : Windows la deduit du debit annonce par la carte. Un lien 1 Gbit/s recoit une metrique plus basse qu''un Wi-Fi.' }",
      "  [void](Add-KjemoResultat -Categorie 'Interfaces' -Controle ($i.InterfaceAlias + ' (' + $i.AddressFamily + ')') -Etat 'INFO' -Valeur ('metrique ' + $i.InterfaceMetric) -Commentaire $note)",
      '}',
      "",
      '# --- 2. Le calcul qui decide -----------------------------------------------------------',
      '# Windows additionne la metrique de la ROUTE et celle de l\'INTERFACE. La',
      "# somme la plus basse gagne. On montre l'addition, pas seulement le resultat :",
      "# c'est la seule facon de comprendre pourquoi le Wi-Fi passe devant le cable.",
      '$prefixesDefaut = @(\'0.0.0.0/0\')',
      "if ($Famille -eq 'Les deux') { $prefixesDefaut = @('0.0.0.0/0', '::/0') }",
      '$routes = @()',
      'try { $routes = @(Get-NetRoute -ErrorAction SilentlyContinue | Where-Object { $prefixesDefaut -contains $_.DestinationPrefix }) } catch { }',
      "",
      'if ($routes.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Routes par defaut' -Etat 'PROBLEME' -Valeur 0 -Commentaire 'Aucune route par defaut : rien ne sort du sous-reseau local.')",
      '} else {',
      '  $lignes = New-Object System.Collections.ArrayList',
      '  foreach ($r in $routes) {',
      '    $mi = 0',
      '    $alias = $r.InterfaceAlias',
      '    try {',
      '      $inter = Get-NetIPInterface -InterfaceIndex $r.InterfaceIndex -AddressFamily $r.AddressFamily -ErrorAction SilentlyContinue | Select-Object -First 1',
      '      if ($inter) { $mi = $inter.InterfaceMetric ; $alias = $inter.InterfaceAlias }',
      '    } catch { }',
      '    [void]$lignes.Add([PSCustomObject]@{',
      '      Carte = $alias',
      '      Famille = $r.AddressFamily.ToString()',
      '      Passerelle = $r.NextHop',
      '      MetriqueRoute = $r.RouteMetric',
      '      MetriqueInterface = $mi',
      '      Total = $r.RouteMetric + $mi',
      '    })',
      '  }',
      '  $classees = @($lignes | Sort-Object Total)',
      '  $rang = 0',
      '  foreach ($l in $classees) {',
      '    $rang++',
      "    $etat = 'INFO'",
      "    $note = 'Configuree mais perdante : son trafic ne sortira pas par la, sauf route plus precise.'",
      "    if ($rang -eq 1) { $etat = 'OK' ; $note = 'C''est elle qui porte le trafic sortant.' }",
      "    [void](Add-KjemoResultat -Categorie 'Calcul' -Controle ($l.Carte + ' (' + $l.Famille + ')') -Etat $etat -Valeur ($l.MetriqueRoute.ToString() + ' + ' + $l.MetriqueInterface + ' = ' + $l.Total) -Commentaire ($note + ' Passerelle : ' + $l.Passerelle + '.'))",
      '  }',
      '  if ($classees.Count -gt 1) {',
      '    $exaequo = @($classees | Where-Object { $_.Total -eq $classees[0].Total })',
      '    if ($exaequo.Count -gt 1) {',
      "      [void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Egalite de metrique' -Etat 'ATTENTION' -Valeur $exaequo.Count -Commentaire 'Plusieurs routes a egalite : le choix devient difficile a prevoir, et peut changer d''un demarrage a l''autre. Departager en fixant une metrique d''interface.')",
      '    }',
      '  }',
      '}',
      "",
      '# --- 3. Routes concurrentes plus precises ------------------------------------------------',
      "# Une route /24 l'emporte toujours sur la route par defaut, quelle que soit la",
      "# metrique : le prefixe le plus long gagne AVANT que la metrique soit regardee.",
      '$precises = @()',
      'try {',
      '  $precises = @(Get-NetRoute -ErrorAction SilentlyContinue |',
      "    Where-Object { $_.DestinationPrefix -ne '0.0.0.0/0' -and $_.DestinationPrefix -ne '::/0' -and $_.NextHop -ne '0.0.0.0' -and $_.NextHop -ne '::' })",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Routes precises' -Controle 'Avec passerelle' -Etat 'INFO' -Valeur $precises.Count -Commentaire 'Une route plus precise l''emporte sur la route par defaut AVANT toute comparaison de metrique.')",
      'foreach ($p in ($precises | Sort-Object DestinationPrefix | Select-Object -First 20)) {',
      "  [void](Add-KjemoResultat -Categorie 'Routes precises' -Controle $p.DestinationPrefix -Etat 'INFO' -Valeur ('via ' + $p.NextHop) -Commentaire ($p.InterfaceAlias + ' · metrique ' + $p.RouteMetric))",
      '}',
      "",
      '# --- 4. Epreuve : quelle carte sert vraiment ? -------------------------------------------',
      '$tnc = $null',
      'try { $tnc = Test-NetConnection -ComputerName $Cible -Port 443 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($tnc -and $tnc.InterfaceAlias) {',
      "  [void](Add-KjemoResultat -Categorie 'Epreuve' -Controle 'Carte reellement utilisee' -Etat 'OK' -Valeur $tnc.InterfaceAlias -Commentaire ('vers ' + $Cible + ' · source ' + $tnc.SourceAddress.IPAddress))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Epreuve' -Controle 'Carte reellement utilisee' -Etat 'ATTENTION' -Valeur 'indeterminee' -Commentaire 'La cible n''a pas repondu : impossible de dire par ou le trafic serait sorti.')",
      '}',
      "",
      '# --- 5. Cartes virtuelles et VPN ----------------------------------------------------------',
      '$virtuelles = @()',
      'try {',
      '  $virtuelles = @(Get-NetAdapter -ErrorAction SilentlyContinue |',
      "    Where-Object { $_.InterfaceDescription -match 'Virtual|VPN|TAP|Hyper-V|VMware|VirtualBox|WireGuard|OpenVPN' })",
      '} catch { }',
      'if ($virtuelles.Count -gt 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Cartes virtuelles' -Controle 'Detectees' -Etat 'INFO' -Valeur $virtuelles.Count -Commentaire 'Une carte virtuelle active ajoute souvent sa propre route par defaut. C''est la cause la plus frequente d''un changement soudain de chemin.')",
      '  foreach ($vv in $virtuelles) {',
      "    [void](Add-KjemoResultat -Categorie 'Cartes virtuelles' -Controle $vv.Name -Etat 'INFO' -Valeur $vv.Status.ToString() -Commentaire $vv.InterfaceDescription)",
      '  }',
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Ce qu''il faut retenir ---'",
      "Write-Host 'Prefixe le plus long d''abord. A prefixe egal, metrique totale la plus basse.'",
      "Write-Host 'Metrique totale = metrique de route + metrique d''interface.'",
      "Write-Host 'Pour forcer une carte devant une autre, on fixe la metrique d''INTERFACE.'",
      "Write-Host 'On ne supprime jamais une route par defaut pour arriver au meme resultat.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Cartes multiples, metriques et routes concurrentes',
      outil: 'adapter-metric-multihoming',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Cible', psB64(cible)],
        ['Famille', psB64(famille)],
        ['Format', psB64(v.amFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-cartes',
      formats: v.amFormat,
    });
  },
  gui: [
    'Propriétés de la carte > TCP/IPv4 > Avancé : décocher « Métrique automatique » et saisir une valeur.',
    'Une métrique d’interface plus BASSE fait passer la carte devant : 10 pour le câble, 50 pour le Wi-Fi est un réglage courant.',
    '« route print » montre les métriques ; « netstat -rn » donne la même chose en plus compact.',
    'PowerShell : « Set-NetIPInterface -InterfaceAlias "Ethernet" -InterfaceMetric 10 » fixe la métrique.',
    'Un VPN monté ajoute sa route par défaut : c’est son fonctionnement normal, pas une anomalie.',
  ],
  keywords: [
    'cartes multiples', 'multihoming', 'metrique', 'interfacemetric', 'deux reseaux',
    'wifi et cable', 'passe par le mauvais reseau', 'route concurrente', 'vpn',
    'carte virtuelle', 'hyper-v', 'prefixe le plus long',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation pour la lecture. Fixer une métrique en demande une, et cet assistant ne le fait pas.',
    'Au moins deux cartes connectées pour que le diagnostic ait un objet.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le trafic passe par le Wi-Fi alors que le câble est branché',
      cause: 'La métrique automatique du Wi-Fi est plus basse, ou le câble a une métrique de route plus élevée.',
      fix: 'La section « Calcul » montre l’addition. Fixer la métrique d’interface du câble plus bas que celle du Wi-Fi.',
    },
    {
      message: 'Un sous-réseau précis n’emprunte pas la bonne carte',
      cause: 'Une route plus précise existe ailleurs : le préfixe le plus long gagne avant toute comparaison de métrique.',
      fix: 'La section « Routes précises » les liste. C’est là qu’il faut regarder, pas dans les métriques.',
    },
    {
      message: 'Le chemin change tout seul au redémarrage',
      cause: 'Deux routes à métrique totale égale : le choix devient imprévisible.',
      fix: 'Le rapport signale l’égalité. Départager en fixant une métrique d’interface différente.',
    },
    {
      message: 'Tout change dès qu’on monte le VPN',
      cause: 'Le client VPN ajoute sa propre route par défaut, souvent avec une métrique très basse.',
      fix: 'C’est son fonctionnement normal. Le diagnostic Wi-Fi/VPN détaille ce que le tunnel capte et ce qu’il laisse passer.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport montre l’addition métrique de route plus métrique d’interface, pas seulement un classement.',
    'La carte réellement utilisée est confirmée par une épreuve, pas déduite.',
    'Les routes plus précises que la route par défaut sont listées à part.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit et calcule. Si une métrique a été changée à la main par ailleurs, la remettre en automatique suffit.',
    diagnostic: '# Les metriques actuelles, et si elles sont automatiques.\nGet-NetIPInterface | Where-Object ConnectionState -eq \'Connected\' | Format-Table InterfaceAlias,AddressFamily,InterfaceMetric,AutomaticMetric',
    command: '# Remettre une carte en metrique automatique, si elle avait ete fixee.\nSet-NetIPInterface -InterfaceAlias \'<nom-de-la-carte>\' -AutomaticMetric Enabled -Confirm',
    warning: 'Changer une métrique à distance peut couper la session en cours : la carte dont on dégrade la métrique est peut-être celle qui porte la connexion.',
  },
  checks: [
    'L’addition qui décide est affichée, carte par carte.',
    'Les routes plus précises sont distinguées de la route par défaut.',
    'Aucune métrique n’est modifiée, aucune route supprimée.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipinterface',
  sources: [
    { label: 'Get-NetIPInterface', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipinterface' },
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
    { label: 'Get-NetAdapter', url: 'https://learn.microsoft.com/powershell/module/netadapter/get-netadapter' },
  ],
};
/**
 * 8. dns-client-diagnostic — ce que ce poste demande, et ce qu'on lui répond.
 *
 * Côté CLIENT, et seulement client. Le rôle DNS Server reste dans Windows
 * Server : on ne diagnostique pas un serveur depuis le poste qui l'interroge.
 *
 * Le cœur de l'outil : interroger chaque serveur configuré séparément, et
 * comparer. Deux serveurs qui ne répondent pas la même chose expliquent les
 * pannes les plus difficiles — celles où « ça marche sur mon poste ».
 */
export const outilDiagnosticDnsClient = {
  id: 'dns-client-diagnostic',
  icon: '◉',
  category: 'Réseau',
  subcategory: 'Résolution de noms',
  title: 'Diagnostiquer la résolution de noms côté client',
  risk: 'diagnostic',
  summary: 'Relève les serveurs DNS configurés, les suffixes de recherche et le cache, puis interroge CHAQUE serveur séparément et compare les réponses. Deux serveurs qui ne disent pas la même chose expliquent les pannes où « ça marche sur mon poste ».',
  fields: [
    {
      id: 'dcNom', label: 'Nom à résoudre', default: 'srv-fichiers.hopitalbn.lan',
      help: 'Le nom qui pose problème. Un nom court éprouve aussi les suffixes de recherche.',
    },
    {
      id: 'dcInverse', label: 'Adresse pour la résolution inverse (facultatif)', default: '',
      help: 'Adresse IPv4 dont on veut le nom. Vide : la résolution inverse n’est pas tentée.',
    },
    {
      id: 'dcType', label: 'Type d’enregistrement', type: 'select', default: 'A',
      options: [
        ['A', 'A — adresse IPv4'],
        ['AAAA', 'AAAA — adresse IPv6'],
        ['CNAME', 'CNAME — alias'],
        ['MX', 'MX — serveur de courrier'],
        ['SRV', 'SRV — service (contrôleurs de domaine)'],
        ['TXT', 'TXT — texte'],
      ],
      help: 'A convient dans la plupart des cas. SRV sert à vérifier qu’un domaine publie bien ses contrôleurs.',
    },
    champFormat('dcFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'dcNom', validerCibleReseau(v.dcNom, 'Le nom à résoudre'));
    const inv = String(v.dcInverse ?? '').trim();
    if (inv !== '') verifier(errors, 'dcInverse', validateIPv4(inv));
    verifier(errors, 'dcType', validerChoix(v.dcType, ['A', 'AAAA', 'CNAME', 'MX', 'SRV', 'TXT'], 'Le type'));
    verifier(errors, 'dcFormat', validerFormatRapport(v.dcFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const nom = validerCibleReseau(v.dcNom).value;
    const inverse = String(v.dcInverse ?? '').trim();
    const type = validerChoix(v.dcType, ['A', 'AAAA', 'CNAME', 'MX', 'SRV', 'TXT']).value;

    const corps = [
      `$Nom = ${psB64(nom)}`,
      `$Inverse = ${psB64(inverse)}`,
      `$Type = ${psB64(type)}`,
      `$KjemoFormat = ${psB64(v.dcFormat)}`,
      "",
      blocContexteReseau(),
      "",
      "# Ce script diagnostique le CLIENT DNS de cette machine. Il ne dit rien de la",
      "# sante d'un serveur DNS : pour cela, les assistants de la categorie Windows",
      '# Server examinent le role lui-meme.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Ce que ce script examine' -Etat 'INFO' -Valeur 'le client DNS de cette machine' -Commentaire 'Le role DNS Server se diagnostique avec les assistants Windows Server, depuis le serveur.')",
      "",
      '# --- 1. Serveurs configures --------------------------------------------------------',
      '$serveurs = New-Object System.Collections.ArrayList',
      '$configs = @()',
      'try { $configs = @(Get-DnsClientServerAddress -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses.Count -gt 0 }) } catch { }',
      'foreach ($c in $configs) {',
      "  [void](Add-KjemoResultat -Categorie 'Serveurs' -Controle ($c.InterfaceAlias + ' (' + $c.AddressFamily + ')') -Etat 'INFO' -Valeur ($c.ServerAddresses -join ', '))",
      "  if ($c.AddressFamily -eq 'IPv4') { foreach ($s in $c.ServerAddresses) { if (-not $serveurs.Contains($s)) { [void]$serveurs.Add($s) } } }",
      '}',
      'if ($serveurs.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Serveurs' -Controle 'IPv4 configures' -Etat 'PROBLEME' -Valeur 0 -Commentaire 'Aucun serveur DNS IPv4 : aucun nom ne se resoudra, sauf ceux du fichier hosts.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Serveurs' -Controle 'IPv4 distincts' -Etat 'OK' -Valeur $serveurs.Count)",
      '}',
      "",
      '# --- 2. Suffixes de recherche --------------------------------------------------------',
      "# Un nom court est complete par les suffixes, dans l'ordre, jusqu'a ce qu'un",
      '# essai reponde. Un suffixe de trop ralentit toute la machine ; un suffixe',
      "# manquant fait echouer des noms courts qui marchent ailleurs.",
      '$glob = $null',
      'try { $glob = Get-DnsClientGlobalSetting -ErrorAction SilentlyContinue } catch { }',
      'if ($glob) {',
      '  $liste = @($glob.SuffixSearchList)',
      '  if ($liste.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Suffixes' -Controle 'Liste de recherche' -Etat 'INFO' -Valeur 'vide' -Commentaire 'Windows utilise alors le suffixe principal de la machine et celui des connexions.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Suffixes' -Controle 'Liste de recherche' -Etat 'INFO' -Valeur ($liste -join ', ') -Commentaire ($liste.Count.ToString() + ' suffixe(s), essayes dans cet ordre.'))",
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Suffixes' -Controle 'Devolution' -Etat 'INFO' -Valeur $glob.UseDevolution.ToString() -Commentaire 'Activee, Windows remonte aussi vers les domaines parents.')",
      '}',
      '$parConnexion = @()',
      'try { $parConnexion = @(Get-DnsClient -ErrorAction SilentlyContinue | Where-Object { $_.ConnectionSpecificSuffix }) } catch { }',
      'foreach ($p in $parConnexion) {',
      "  [void](Add-KjemoResultat -Categorie 'Suffixes' -Controle ('Suffixe de ' + $p.InterfaceAlias) -Etat 'INFO' -Valeur $p.ConnectionSpecificSuffix)",
      '}',
      "",
      '# --- 3. Interroger CHAQUE serveur separement -------------------------------------------',
      "# C'est le coeur de l'outil. Passer par la resolution normale ne dit pas QUI a",
      '# repondu. En interrogeant chaque serveur nommement, on voit lequel ment.',
      '$reponses = @{}',
      'foreach ($s in $serveurs) {',
      '  $r = $null',
      '  try { $r = Resolve-DnsName -Name $Nom -Type $Type -Server $s -DnsOnly -ErrorAction SilentlyContinue } catch { }',
      '  if (-not $r) {',
      "    [void](Add-KjemoResultat -Categorie 'Interrogation' -Controle $s -Etat 'PROBLEME' -Valeur 'aucune reponse' -Commentaire 'Ce serveur n''a rien rendu : injoignable, ou il ne connait pas ce nom.')",
      "    $reponses[$s] = ''",
      '  } else {',
      '    $valeurs = @($r | Where-Object { $_.IPAddress -or $_.NameHost -or $_.Strings } | ForEach-Object {',
      '      if ($_.IPAddress) { $_.IPAddress }',
      '      elseif ($_.NameHost) { $_.NameHost }',
      "      else { ($_.Strings -join ' ') }",
      '    })',
      "    $joint = ($valeurs | Sort-Object) -join ', '",
      '    $reponses[$s] = $joint',
      "    [void](Add-KjemoResultat -Categorie 'Interrogation' -Controle $s -Etat 'OK' -Valeur $joint -Commentaire ('type ' + $Type))",
      '  }',
      '}',
      "",
      '# --- 4. Comparer -----------------------------------------------------------------------',
      'if ($serveurs.Count -gt 1) {',
      '  $distinctes = @($reponses.Values | Sort-Object -Unique)',
      '  if ($distinctes.Count -gt 1) {',
      "    [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Reponses divergentes' -Etat 'PROBLEME' -Valeur $distinctes.Count -Commentaire 'Les serveurs ne repondent pas la meme chose. C''est la cause des pannes ou « ca marche sur mon poste » : chaque client interroge le serveur qui lui repond le premier.')",
      '    foreach ($k in $reponses.Keys) {',
      "      [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle $k -Etat 'INFO' -Valeur $reponses[$k])",
      '    }',
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Reponses' -Etat 'OK' -Valeur 'identiques' -Commentaire 'Tous les serveurs configures repondent la meme chose.')",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Reponses' -Etat 'IGNORE' -Valeur 'un seul serveur' -Commentaire 'Avec un seul serveur configure, il n''y a rien a comparer — et aucun secours si celui-la tombe.')",
      '}',
      "",
      '# --- 5. Le cache local -----------------------------------------------------------------',
      "# Le cache repond avant les serveurs. Une entree perimee survit a un changement",
      "# d'adresse, et c'est la panne qui disparait toute seule « au bout d'un moment ».",
      '$cache = @()',
      'try { $cache = @(Get-DnsClientCache -ErrorAction SilentlyContinue | Where-Object { $_.Entry -like ("*" + $Nom + "*") }) } catch { }',
      'if ($cache.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Cache' -Controle $Nom -Etat 'INFO' -Valeur 'absent du cache' -Commentaire 'Chaque resolution part donc vers un serveur.')",
      '} else {',
      '  foreach ($e in ($cache | Select-Object -First 10)) {',
      "    $etatC = 'INFO'",
      "    $noteC = ('duree de vie restante : ' + $e.TimeToLive + ' s')",
      "    if ($e.TimeToLive -gt 3600) { $etatC = 'ATTENTION' ; $noteC = 'Duree de vie tres longue : une entree perimee restera longtemps. C''est la panne qui « se resout toute seule » au bout d''une heure.' }",
      "    [void](Add-KjemoResultat -Categorie 'Cache' -Controle $e.Entry -Etat $etatC -Valeur $e.Data -Commentaire $noteC)",
      '  }',
      '}',
      "",
      '# --- 6. Resolution inverse ---------------------------------------------------------------',
      "if ($Inverse -ne '') {",
      '  $inv = $null',
      '  try { $inv = Resolve-DnsName -Name $Inverse -Type PTR -ErrorAction SilentlyContinue } catch { }',
      '  if ($inv) {',
      "    foreach ($i in $inv) { [void](Add-KjemoResultat -Categorie 'Inverse' -Controle $Inverse -Etat 'OK' -Valeur $i.NameHost) }",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Inverse' -Controle $Inverse -Etat 'ATTENTION' -Valeur 'aucun PTR' -Commentaire 'Pas d''enregistrement inverse. Beaucoup de parcs n''en ont pas, et ce n''est pas toujours une anomalie — sauf pour Kerberos et certains outils de supervision.')",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Inverse' -Controle 'Resolution inverse' -Etat 'IGNORE' -Valeur 'non demandee')",
      '}',
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Diagnostic de la resolution de noms, cote client',
      outil: 'dns-client-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Nom', psB64(nom)],
        ['Type', psB64(type)],
        ['Format', psB64(v.dcFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-dns-client',
      formats: v.dcFormat,
    });
  },
  gui: [
    'Propriétés de la carte > TCP/IPv4 > Avancé > DNS : serveurs, suffixes et ordre de recherche.',
    '« ipconfig /all » donne les serveurs DNS et le suffixe de chaque connexion.',
    '« ipconfig /displaydns » montre le cache ; « nslookup <nom> <serveur> » interroge un serveur précis.',
    'PowerShell : « Resolve-DnsName <nom> -Server <adresse> -DnsOnly » contourne le cache et nomme le serveur.',
    'Pour les contrôleurs de domaine : « nslookup -type=SRV _ldap._tcp.<domaine> » doit lister les DC.',
  ],
  keywords: [
    'dns client', 'resolution de noms', 'resolve-dnsname', 'nslookup', 'suffixe',
    'cache dns', 'serveur dns', 'nom introuvable', 'mauvaise adresse',
    'ca marche sur mon poste', 'ptr', 'resolution inverse', 'srv',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation : tout est en lecture.',
    'Au moins un serveur DNS configuré, sinon il n’y a rien à interroger.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le nom se résout vers une ancienne adresse',
      cause: 'Entrée de cache périmée, ou enregistrement non mis à jour sur un des serveurs.',
      fix: 'Comparer la section Cache et la section Interrogation : si les serveurs disent la bonne adresse, c’est le cache.',
    },
    {
      message: 'Deux serveurs DNS répondent différemment',
      cause: 'Réplication en retard entre serveurs, ou un serveur qui sert une zone obsolète.',
      fix: 'C’est la section Comparaison. Le problème est côté serveur : voir les assistants Windows Server.',
    },
    {
      message: 'Un nom court ne se résout pas, le nom complet si',
      cause: 'Le suffixe de recherche nécessaire n’est pas dans la liste.',
      fix: 'La section Suffixes montre ce que Windows ajoute. Ajouter le suffixe manquant, de préférence par stratégie de groupe.',
    },
    {
      message: 'Resolve-DnsName répond mais le navigateur ne trouve pas',
      cause: 'Le navigateur peut utiliser DNS sur HTTPS, qui court-circuite le DNS de Windows.',
      fix: 'Vérifier le réglage de résolution sécurisée du navigateur : il peut interroger un résolveur public au lieu du DNS interne.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Chaque serveur configuré a été interrogé nommément, et sa réponse figure séparément.',
    'La section Comparaison dit si les serveurs sont d’accord.',
    'Le cache est présenté à part des réponses des serveurs : ce ne sont pas les mêmes informations.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant interroge et lit. Il n’y a rien à annuler.',
    diagnostic: '# Interroger un serveur precis, sans passer par le cache.\nResolve-DnsName -Name \'<nom>\' -Server \'<adresse-du-serveur>\' -DnsOnly',
    command: '# Rien a annuler : aucune ecriture, aucun vidage de cache.\n# Pour vider le cache, voir l\'assistant dedie, qui le montre avant.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Le rapport contient les noms internes et les adresses des serveurs DNS du parc. Il se joint à un billet interne.',
  },
  checks: [
    'Chaque serveur est interrogé séparément : on sait qui a répondu quoi.',
    'Le cache est lu, jamais vidé.',
    'La portée client est annoncée dès la première ligne du rapport.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dnsclient/resolve-dnsname',
  sources: [
    { label: 'Resolve-DnsName', url: 'https://learn.microsoft.com/powershell/module/dnsclient/resolve-dnsname' },
    { label: 'Get-DnsClientServerAddress', url: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientserveraddress' },
    { label: 'Get-DnsClientCache', url: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientcache' },
    { label: 'Get-DnsClient', url: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclient' },
  ],
};

/**
 * 9. dns-cache-reset — montrer le cache, puis le vider si on le demande.
 *
 * Vider un cache DNS est anodin et réversible — il se remplit tout seul. Ce
 * qui ne l'est pas, c'est de le vider sans l'avoir regardé : on efface la
 * preuve de ce qui n'allait pas, et on ne saura jamais pourquoi.
 *
 * D'où l'ordre imposé : afficher d'abord, toujours ; vider ensuite, et
 * seulement en mode Appliquer.
 */
export const outilCacheDns = {
  id: 'dns-cache-reset',
  icon: '↻',
  category: 'Réseau',
  subcategory: 'Résolution de noms',
  title: 'Afficher puis vider le cache DNS',
  risk: 'caution',
  summary: 'Affiche le cache DNS avant toute action, signale les entrées suspectes, puis le vide uniquement en mode Appliquer. Vider sans regarder efface la preuve de ce qui n’allait pas.',
  fields: [
    {
      id: 'dcrFiltre', label: 'Filtrer sur un nom (facultatif)', default: '',
      help: 'Ne montrer que les entrées contenant ce texte. Vide : tout le cache. Le vidage, lui, porte toujours sur la totalité — Windows ne sait pas en retirer une seule entrée.',
    },
    {
      id: 'dcrAussiNetbios', label: 'Relever aussi le cache NetBIOS', type: 'select', default: 'Non',
      options: [
        ['Non', 'Non — cache DNS seulement'],
        ['Oui', 'Oui — ajouter le cache de noms NetBIOS'],
      ],
      help: 'Utile quand des noms courts se résolvent de travers sur un réseau ancien.',
    },
    champMode('Diagnostic affiche le cache et ne touche à rien. Appliquer l’affiche, puis le vide.'),
  ],
  validate(v) {
    const errors = {};
    const filtre = String(v.dcrFiltre ?? '').trim();
    if (filtre !== '') {
      if (/["`$;|&<>]/.test(filtre)) {
        errors.dcrFiltre = 'Le filtre ne peut contenir ni guillemet ni caractère de commande.';
      } else if (filtre.length > 128) {
        errors.dcrFiltre = 'Le filtre dépasse 128 caractères.';
      }
    }
    verifier(errors, 'dcrAussiNetbios', validerChoix(v.dcrAussiNetbios, ['Non', 'Oui'], 'Le choix'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const filtre = String(v.dcrFiltre ?? '').trim();
    const netbios = validerChoix(v.dcrAussiNetbios, ['Non', 'Oui']).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Filtre = ${psB64(filtre)}`,
      `$Netbios = ${psB64(netbios)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocContexteReseau(),
      "",
      '# --- 1. Lire le cache AVANT toute action ---------------------------------------------',
      "# Toujours, dans les deux modes. Vider un cache sans l'avoir regarde efface la",
      '# preuve de ce qui n\'allait pas.',
      '$entrees = @()',
      'try {',
      '  $entrees = @(Get-DnsClientCache -ErrorAction SilentlyContinue)',
      "  if ($Filtre -ne '') { $entrees = @($entrees | Where-Object { $_.Entry -like ('*' + $Filtre + '*') }) }",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Entrees dans le cache' -Etat 'INFO' -Valeur $entrees.Count)",
      "",
      '$suspectes = 0',
      'foreach ($e in ($entrees | Sort-Object Entry | Select-Object -First 100)) {',
      "  $etat = 'INFO'",
      "  $note = ('duree de vie restante : ' + $e.TimeToLive + ' s')",
      '  if ($e.TimeToLive -gt 3600) {',
      "    $etat = 'ATTENTION'",
      "    $note = 'Duree de vie superieure a une heure : si cette entree est fausse, elle le restera longtemps.'",
      '    $suspectes++',
      '  }',
      "  if ($e.Status -ne 0) {",
      "    $etat = 'ATTENTION'",
      "    $note = 'Reponse negative mise en cache : le nom a ete declare introuvable, et Windows s''en souvient. Un nom cree depuis ne sera pas vu avant expiration.'",
      '    $suspectes++',
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Avant' -Controle $e.Entry -Etat $etat -Valeur $e.Data -Commentaire $note)",
      '}',
      'if ($entrees.Count -gt 100) {',
      "  [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Affichage tronque' -Etat 'INFO' -Valeur ('100 entrees sur ' + $entrees.Count))",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Entrees suspectes' -Etat (& { if ($suspectes -gt 0) { 'ATTENTION' } else { 'OK' } }) -Valeur $suspectes -Commentaire 'Duree de vie tres longue, ou reponse negative memorisee.')",
      "",
      "if ($Netbios -eq 'Oui') {",
      '  $nb = $null',
      "  try { $nb = (nbtstat -c) -join [Environment]::NewLine } catch { }",
      '  if ($nb) {',
      "    [void](Add-KjemoResultat -Categorie 'NetBIOS' -Controle 'Cache de noms' -Etat 'INFO' -Valeur 'releve' -Commentaire 'Voir la sortie console pour le detail.')",
      "    Write-Host ''",
      "    Write-Host '--- Cache de noms NetBIOS ---'",
      '    Write-Host $nb',
      '  }',
      '}',
      "",
      '# --- 2. Vider, uniquement en mode Appliquer --------------------------------------------',
      "# Windows ne sait pas retirer UNE entree du cache DNS : Clear-DnsClientCache",
      '# vide tout. Le filtre ci-dessus ne sert donc qu\'a l\'affichage, et le script',
      '# le dit plutot que de laisser croire le contraire.',
      "if ($Mode -eq 'Appliquer') {",
      "  if ($Filtre -ne '') {",
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Portee du vidage' -Etat 'ATTENTION' -Valeur 'cache entier' -Commentaire 'Un filtre a ete indique, mais Windows ne sait pas retirer une seule entree : le cache sera vide en entier.')",
      '  }',
      '  try {',
      '    Clear-DnsClientCache -ErrorAction Stop',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Vidage du cache DNS' -Etat 'OK' -Valeur 'effectue' -Commentaire 'Le cache se remplit a nouveau des la prochaine resolution. Cette action est sans consequence durable.')",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Vidage du cache DNS' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      "",
      '  # --- 3. Relire apres ------------------------------------------------------------------',
      '  $apres = @()',
      '  try { $apres = @(Get-DnsClientCache -ErrorAction SilentlyContinue) } catch { }',
      "  $etatA = 'OK'",
      "  $noteA = 'Le cache est vide, ou ne contient plus que des entrees recreees entre-temps.'",
      "  if ($apres.Count -ge $entrees.Count -and $entrees.Count -gt 0) { $etatA = 'ATTENTION' ; $noteA = 'Le cache n''a pas diminue : le vidage a peut-etre echoue, ou la machine resout activement.' }",
      "  [void](Add-KjemoResultat -Categorie 'Apres' -Controle 'Entrees restantes' -Etat $etatA -Valeur $apres.Count -Commentaire $noteA)",
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  Write-Host 'En mode Appliquer, le script viderait le cache DNS de cette machine.'",
      "  Write-Host 'Le cache se remplit a nouveau des la prochaine resolution : l''action est'",
      "  Write-Host 'sans consequence durable, mais elle efface ce que le cache montrait.'",
      '}',
      blocModeDiagnostic(),
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Cache DNS : afficher puis vider',
      outil: 'dns-cache-reset',
      diagnostic: v.mode !== 'Appliquer',
      admin: false,
      parametres: [
        ['Mode', psB64(v.mode)],
        ['Filtre', psB64(filtre)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-cache-dns',
      formats: 'Console',
    });
  },
  gui: [
    '« ipconfig /displaydns » affiche le cache, « ipconfig /flushdns » le vide.',
    'PowerShell : « Get-DnsClientCache » puis « Clear-DnsClientCache ».',
    'Toujours afficher avant de vider : le cache est la seule trace de ce que la machine croyait.',
    'Un navigateur a son propre cache DNS, indépendant de celui de Windows : le vider ne suffit pas toujours.',
    'Le service « Client DNS » peut être redémarré, mais vider le cache suffit presque toujours.',
  ],
  keywords: [
    'cache dns', 'flushdns', 'clear-dnsclientcache', 'displaydns', 'vider le cache',
    'ancienne adresse', 'nom perime', 'reponse negative', 'ttl', 'nbtstat',
  ],
  requiresAdmin: true,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Vider le cache DNS ne demande pas d’élévation sur un poste moderne : techniquement, un compte ordinaire y arrive.',
    'L’assistant est néanmoins classé comme administratif, parce qu’il modifie l’état de la machine. Dans ce catalogue, ce classement dit « action, pas lecture » — il ne prétend pas que Windows exigera une invite d’élévation.',
    'Afficher le cache avant de le vider : c’est l’ordre imposé par cet assistant.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le cache se remplit à nouveau immédiatement',
      cause: 'C’est son fonctionnement : chaque résolution y ajoute une entrée.',
      fix: 'Normal, et sans gravité. Ce qui compte est que l’entrée fautive ait disparu.',
    },
    {
      message: 'Le nom se résout toujours mal après le vidage',
      cause: 'Le serveur DNS répond lui-même la mauvaise valeur, ou le navigateur a son propre cache.',
      fix: 'Interroger les serveurs nommément avec l’assistant de diagnostic DNS client.',
    },
    {
      message: 'Une entrée a une durée de vie de plusieurs heures',
      cause: 'La zone DNS publie une durée de vie longue. Elle s’applique telle quelle.',
      fix: 'Avant une migration, baisser la durée de vie de l’enregistrement sur le serveur, plusieurs heures à l’avance.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le cache a été affiché avant toute action, dans les deux modes.',
    'Après vidage, le nombre d’entrées restantes est relu et comparé.',
    'Si un filtre a été saisi, le rapport rappelle que le vidage porte sur tout le cache.',
  ],
  rollback: {
    summary: 'Un cache vidé se remplit tout seul à la prochaine résolution. Il n’y a rien à restaurer — mais ce qu’il contenait est perdu, d’où l’affichage systématique avant.',
    diagnostic: '# Ce que le cache contient maintenant.\nGet-DnsClientCache | Format-Table Entry,Data,TimeToLive,Status',
    command: '# Il n\'y a pas d\'annulation : un cache ne se restaure pas.\n# Ce qui se refait, c\'est la resolution elle-meme.\nResolve-DnsName -Name \'<nom>\' -DnsOnly',
    warning: 'Vider le cache efface la trace de ce qui n’allait pas. Si le diagnostic n’est pas terminé, afficher d’abord et garder le rapport.',
  },
  checks: [
    'Le cache est toujours affiché avant d’être vidé.',
    'Le mode par défaut est Diagnostic.',
    'Le script dit que Windows ne sait pas retirer une seule entrée, plutôt que de laisser croire le contraire.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dnsclient/clear-dnsclientcache',
  sources: [
    { label: 'Clear-DnsClientCache', url: 'https://learn.microsoft.com/powershell/module/dnsclient/clear-dnsclientcache' },
    { label: 'Get-DnsClientCache', url: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientcache' },
    { label: 'ipconfig', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/ipconfig' },
  ],
};

/**
 * 10. dns-client-change — changer les serveurs DNS, avec le retour écrit avant.
 *
 * Le seul outil de ce lot qui modifie durablement la configuration réseau.
 * Il part donc en Diagnostic, et surtout : il écrit la commande d'annulation
 * EXACTE, avec les valeurs actuelles, avant de toucher à quoi que ce soit.
 *
 * Changer les serveurs DNS d'une machine à distance, c'est risquer de perdre
 * la machine. Le script le dit, et refuse de laisser la liste vide.
 */
export const outilChangementDnsClient = {
  id: 'dns-client-change',
  icon: '⇆',
  category: 'Réseau',
  subcategory: 'Résolution de noms',
  title: 'Changer les serveurs DNS d’une carte',
  risk: 'caution',
  summary: 'Sauvegarde les serveurs DNS actuels, écrit la commande d’annulation exacte AVANT d’agir, montre ce qui changerait, puis applique. Refuse une liste vide et prévient du risque de perdre une machine distante.',
  fields: [
    {
      id: 'dchCarte', label: 'Carte à modifier', default: 'Ethernet',
      help: 'Nom exact de la carte, tel que Get-NetAdapter l’affiche.',
    },
    {
      id: 'dchServeurs', label: 'Nouveaux serveurs DNS', default: '192.168.30.10,192.168.30.11',
      help: 'Une à trois adresses IPv4, séparées par des virgules. Deux au minimum en production : un seul serveur n’a aucun secours.',
    },
    {
      id: 'dchNomTest', label: 'Nom DNS servant d’épreuve', default: 'www.microsoft.com',
      help: 'Nom que chaque serveur demandé devra réellement résoudre avant qu’on l’impose. La valeur par défaut est un nom public, à remplacer par un nom interne du domaine (par exemple « dc01.exemple.local ») quand les serveurs visés sont des serveurs d’annuaire : un serveur interne peut n’avoir aucune résolution vers l’extérieur et pourtant être le bon.',
    },
    champMode('Diagnostic montre l’avant, l’après voulu, la commande d’annulation et le résultat de l’épreuve. Appliquer n’écrit la nouvelle liste que si l’épreuve réussit pour tous les serveurs.'),
  ],
  validate(v) {
    const errors = {};
    const carte = String(v.dchCarte ?? '').trim();
    if (carte === '') {
      errors.dchCarte = 'Indique la carte à modifier.';
    } else if (/["`$;|&<>]/.test(carte)) {
      errors.dchCarte = 'Le nom de la carte ne peut contenir ni guillemet ni caractère de commande.';
    }
    verifier(errors, 'dchServeurs', validerListeIPv4(v.dchServeurs));
    // Le nom d'epreuve doit etre un NOM : interroger un serveur DNS avec une
    // adresse IPv4 ferait une resolution inverse, qui echoue sur la plupart
    // des serveurs parfaitement sains. Ce ne serait donc pas une epreuve.
    const nomTest = validerCibleReseau(v.dchNomTest, 'Le nom DNS d’épreuve');
    if (!nomTest.ok) {
      errors.dchNomTest = nomTest.error;
    } else if (nomTest.forme === 'ipv4' || nomTest.forme === 'ipv6') {
      errors.dchNomTest = 'Indique un nom, pas une adresse : interroger un serveur DNS avec une adresse déclenche une résolution inverse, qui échoue sur des serveurs sains et ne prouve rien.';
    }
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const carte = String(v.dchCarte ?? '').trim();
    const serveurs = validerListeIPv4(v.dchServeurs).value;
    const liste = Array.isArray(serveurs) ? serveurs : String(serveurs).split(',').map((x) => x.trim());
    const nomTest = validerCibleReseau(v.dchNomTest, 'Le nom DNS d’épreuve').value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Carte = ${psB64(carte)}`,
      `$Serveurs = @(${liste.map((s) => psB64(s)).join(', ')})`,
      `$NomTest = ${psB64(nomTest)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocContexteReseau(),
      "",
      '# --- Avertissement ------------------------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- A lire avant d''appliquer ---'",
      "Write-Host 'Changer les serveurs DNS d''une machine distante peut la rendre'",
      "Write-Host 'injoignable : si la session passe par un nom, et que le nouveau serveur'",
      "Write-Host 'ne le resout pas, la connexion tombe et ne revient pas.'",
      "Write-Host 'La commande d''annulation est ecrite ci-dessous AVANT toute action :'",
      "Write-Host 'la noter, ou garder ce rapport ouvert.'",
      "",
      '# --- 1. La carte existe-t-elle ? -------------------------------------------------------',
      '$adaptateur = $null',
      'try { $adaptateur = Get-NetAdapter -Name $Carte -ErrorAction SilentlyContinue } catch { }',
      'if (-not $adaptateur) {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Carte' -Etat 'PROBLEME' -Valeur $Carte -Commentaire 'Carte introuvable. Get-NetAdapter donne les noms exacts.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Carte' -Etat 'OK' -Valeur ($adaptateur.Name + ' — ' + $adaptateur.Status) -Commentaire ('index ' + $adaptateur.ifIndex))",
      '}',
      "",
      '# --- 2. Sauvegarde de l\'etat actuel ------------------------------------------------------',
      '$actuels = @()',
      "$origine = 'inconnue'",
      '$config = $null',
      '$etatPrecedentReleve = $false',
      'try {',
      "  $config = Get-DnsClientServerAddress -InterfaceAlias $Carte -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1",
      '  if ($config) { $actuels = @($config.ServerAddresses) }',
      '  $inter = Get-NetIPInterface -InterfaceAlias $Carte -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1',
      "  if ($inter -and $inter.Dhcp -eq 'Enabled') { $origine = 'DHCP' } elseif ($inter) { $origine = 'fixee a la main' }",
      '} catch { }',
      '# Releve l\'etat precedent, ou non. Sans lui, aucune annulation fidele',
      "# n'est possible : le script refusera d'ecrire.",
      'if ($config) { $etatPrecedentReleve = $true }',
      "",
      'if (-not $etatPrecedentReleve) {',
      "  [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Etat precedent' -Etat 'PROBLEME' -Valeur 'non releve' -Commentaire 'Get-DnsClientServerAddress n''a rien renvoye pour cette carte. Sans l''etat de depart, la commande d''annulation serait une supposition : aucune modification ne sera tentee.')",
      '} elseif ($actuels.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Serveurs DNS actuels' -Etat 'INFO' -Valeur 'aucun' -Commentaire ('Origine de la configuration : ' + $origine + '.'))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Serveurs DNS actuels' -Etat 'INFO' -Valeur ($actuels -join ', ') -Commentaire ('Origine : ' + $origine + '.'))",
      '}',
      "",
      '# --- 3. La commande d\'annulation, ECRITE AVANT -------------------------------------------',
      "# C'est le coeur de cet outil. Elle porte les valeurs REELLES relevees a',",
      "# l'instant, pas un modele a completer.",
      "Write-Host ''",
      "Write-Host '--- Commande d''annulation, a garder ---'",
      "$annulation = ''",
      '$annulationConstruite = $false',
      'if (-not $etatPrecedentReleve) {',
      "  Write-Host '  Aucune commande d''annulation n''a pu etre composee : l''etat de depart'",
      "  Write-Host '  n''a pas ete releve. Le script n''ecrira rien.'",
      "  [void](Add-KjemoResultat -Categorie 'Annulation' -Controle 'Commande exacte' -Etat 'PROBLEME' -Valeur 'non construite' -Commentaire 'Une annulation inventee est pire que pas d''annulation du tout : elle donne confiance sans rien garantir.')",
      "} else {",
      "  if ($origine -eq 'DHCP') {",
      '    $annulation = "Set-DnsClientServerAddress -InterfaceAlias \'$Carte\' -ResetServerAddresses"',
      "    Write-Host '  La carte recevait ses serveurs par DHCP. Pour y revenir :'",
      '  } elseif ($actuels.Count -gt 0) {',
      "    $listeAnnulation = ($actuels | ForEach-Object { \"'\" + $_ + \"'\" }) -join ','",
      '    $annulation = "Set-DnsClientServerAddress -InterfaceAlias \'$Carte\' -ServerAddresses $listeAnnulation"',
      "    Write-Host '  Pour remettre exactement la liste actuelle :'",
      '  } else {',
      '    $annulation = "Set-DnsClientServerAddress -InterfaceAlias \'$Carte\' -ResetServerAddresses"',
      "    Write-Host '  Aucun serveur n''etait configure. Pour revenir a cet etat :'",
      '  }',
      "  if (-not [string]::IsNullOrWhiteSpace($annulation)) { $annulationConstruite = $true }",
      '  Write-Host ("    " + $annulation)',
      "  [void](Add-KjemoResultat -Categorie 'Annulation' -Controle 'Commande exacte' -Etat 'INFO' -Valeur $annulation -Commentaire 'Relevee sur l''etat reel de la machine, avant toute modification.')",
      '}',
      "",
      '# --- 4. Ce qui changerait -----------------------------------------------------------------',
      "[void](Add-KjemoResultat -Categorie 'Apres — voulu' -Controle 'Serveurs demandes' -Etat 'INFO' -Valeur ($Serveurs -join ', ') -Commentaire ($Serveurs.Count.ToString() + ' serveur(s).'))",
      'if ($Serveurs.Count -lt 2) {',
      "  [void](Add-KjemoResultat -Categorie 'Apres — voulu' -Controle 'Redondance' -Etat 'ATTENTION' -Valeur 'un seul serveur' -Commentaire 'Sans second serveur, toute panne du premier coupe la resolution de noms pour cette carte.')",
      '}',
      "",
      '# --- 4 bis. Epreuve REELLE de chaque serveur demande --------------------------------------',
      '# Un port 53 ouvert ne prouve rien : un pare-feu peut laisser passer la',
      "# connexion TCP sans qu'aucun service DNS ne reponde derriere, et un",
      '# serveur DNS parfaitement sain peut ne pas ecouter en TCP. La seule',
      "# preuve acceptable est une REQUETE DNS reelle, posee a ce serveur-la,",
      '# pour le nom choisi, et dont on regarde la reponse.',
      "Write-Host ''",
      "Write-Host '--- Epreuve des serveurs demandes ---'",
      'Write-Host ("  Nom interroge : " + $NomTest)',
      '$serveursEnEchec = @()',
      '$serveursDnsValides = $false',
      'foreach ($s in $Serveurs) {',
      '  $reponses = @()',
      "  $erreurTexte = ''",
      '  $chrono = [Diagnostics.Stopwatch]::StartNew()',
      '  try {',
      '    $reponses = @(Resolve-DnsName -Name $NomTest -Server $s -Type A -DnsOnly -NoHostsFile -ErrorAction Stop)',
      '  } catch {',
      '    $erreurTexte = [string]$_.Exception.Message',
      '  }',
      '  $chrono.Stop()',
      '  $ms = [int]$chrono.ElapsedMilliseconds',
      '  $avecAdresse = @()',
      '  foreach ($r in $reponses) {',
      '    if ($r -and ($r.PSObject.Properties.Name -contains \'IPAddress\') -and $r.IPAddress) { $avecAdresse += $r }',
      '  }',
      "  # Quatre issues distinguees, parce qu'elles n'appellent pas la meme",
      "  # correction : repondu / delai depasse / refus explicite / silence.",
      "  $classe = 'SILENCE'",
      "  $etatS = 'PROBLEME'",
      "  $noteS = ''",
      '  if ($avecAdresse.Count -gt 0) {',
      "    $classe = 'REPONSE'",
      "    $etatS = 'OK'",
      "    $noteS = 'Reponse DNS obtenue de ce serveur : ' + (($avecAdresse | ForEach-Object { [string]$_.IPAddress }) -join ', ') + '.'",
      '  } elseif ($reponses.Count -gt 0) {',
      "    $classe = 'REPONSE SANS ADRESSE'",
      "    $noteS = 'Le serveur a repondu, mais sans enregistrement A pour ce nom. Choisir un nom que ce serveur est cense resoudre, ou corriger sa zone.'",
      "  } elseif ($erreurTexte -match '(?i)timed?[ -]?out|timeout|delai|expir') {",
      "    $classe = 'DELAI DEPASSE'",
      "    $noteS = 'Aucune reponse dans le delai. Serveur arrete, filtre par un pare-feu, ou hors de portee par cette carte.'",
      "  } elseif ($erreurTexte -match '(?i)refus|refused|SERVFAIL|server failure|echec du serveur') {",
      "    $classe = 'REFUS'",
      "    $noteS = 'Le serveur a repondu en refusant la requete. Il est joignable mais n''accepte pas cette interrogation : recursion desactivee, ou client hors de la liste autorisee.'",
      "  } elseif ($erreurTexte -match '(?i)does not exist|n.existe pas|NXDOMAIN|introuvable|not found') {",
      "    $classe = 'REPONSE NEGATIVE'",
      "    $noteS = 'Le serveur a repondu que ce nom n''existe pas. Soit le nom d''epreuve est a changer, soit ce serveur n''est pas celui qui porte la zone.'",
      '  } elseif ($erreurTexte -ne \'\') {',
      "    $classe = 'SILENCE'",
      "    $noteS = 'Aucune reponse exploitable. Detail : ' + $erreurTexte",
      '  } else {',
      "    $classe = 'SILENCE'",
      "    $noteS = 'Aucune reponse, et aucune erreur rapportee.'",
      '  }',
      '  # Information complementaire seulement. Elle ne vaut pas preuve et',
      "  # n'entre dans aucune decision.",
      '  $joignable = $null',
      '  try { $joignable = Test-NetConnection -ComputerName $s -Port 53 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      "  $tcp53 = 'inconnu'",
      "  if ($joignable) { $tcp53 = [string]$joignable.TcpTestSucceeded }",
      "  if ($etatS -ne 'OK') { $serveursEnEchec += $s }",
      "  [void](Add-KjemoResultat -Categorie 'Apres — epreuve' -Controle $s -Etat $etatS -Valeur ($classe + ' (' + $ms + ' ms)') -Commentaire ($noteS + ' Indication seule, non probante : TCP 53 = ' + $tcp53 + '.'))",
      "  Write-Host ('  ' + $s + ' : ' + $classe)",
      '}',
      "",
      "# Le verrou. Il ne passe a vrai que si TOUS les serveurs demandes ont",
      '# repondu correctement au nom choisi.',
      'if ($Serveurs.Count -gt 0 -and $serveursEnEchec.Count -eq 0) { $serveursDnsValides = $true }',
      'if ($serveursDnsValides) {',
      "  [void](Add-KjemoResultat -Categorie 'Apres — epreuve' -Controle 'Verdict' -Etat 'OK' -Valeur 'tous les serveurs ont repondu' -Commentaire ('Les ' + $Serveurs.Count + ' serveur(s) demande(s) ont resolu ' + $NomTest + '.'))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Apres — epreuve' -Controle 'Verdict' -Etat 'PROBLEME' -Valeur ('serveur(s) en echec : ' + ($serveursEnEchec -join ', ')) -Commentaire 'Imposer un serveur qui ne repond pas coupe la resolution de noms de cette carte. La modification est bloquee.')",
      '}',
      "",
      '# --- 5. Appliquer ---------------------------------------------------------------------------',
      '# Quatre conditions, toutes necessaires, verifiees ensemble :',
      "#   carte trouvee, etat precedent releve, annulation construite,",
      '#   et tous les serveurs demandes eprouves avec succes.',
      '$conditionsAppliquer = ($null -ne $adaptateur) -and $etatPrecedentReleve -and $annulationConstruite -and $serveursDnsValides',
      "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {",
      '  $manquants = @()',
      "  if ($null -eq $adaptateur) { $manquants += 'carte introuvable' }",
      "  if (-not $etatPrecedentReleve) { $manquants += 'etat precedent non releve' }",
      "  if (-not $annulationConstruite) { $manquants += 'commande d''annulation non construite' }",
      "  if (-not $serveursDnsValides) { $manquants += 'serveur(s) DNS en echec : ' + ($serveursEnEchec -join ', ') }",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Conditions prealables' -Etat 'PROBLEME' -Valeur ($manquants -join ' ; ') -Commentaire 'Le mode Appliquer exige les quatre conditions a la fois. Au moins une manque.')",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Ecriture' -Etat 'IGNORE' -Valeur 'bloquee' -Commentaire 'Set-DnsClientServerAddress n''a pas ete appele. La configuration DNS de la carte est exactement celle d''avant.')",
      "  Write-Host ''",
      "  Write-Host '--- Modification BLOQUEE ---'",
      '  foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "  Write-Host '  Aucune ecriture n''a ete tentee.'",
      "} elseif ($Mode -eq 'Appliquer') {",
      '  try {',
      '    Set-DnsClientServerAddress -InterfaceAlias $Carte -ServerAddresses $Serveurs -ErrorAction Stop',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Ecriture' -Etat 'OK' -Valeur ($Serveurs -join ', '))",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Ecriture' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'La configuration precedente est intacte.')",
      '  }',
      '  # Relecture : on ne croit pas la commande sur parole.',
      '  $relu = @()',
      '  try {',
      '    $c2 = Get-DnsClientServerAddress -InterfaceAlias $Carte -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1',
      '    if ($c2) { $relu = @($c2.ServerAddresses) }',
      '  } catch { }',
      "  $etatR = 'PROBLEME'",
      "  if (($relu -join ',') -eq ($Serveurs -join ',')) { $etatR = 'OK' }",
      "  [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Liste relue' -Etat $etatR -Valeur ($relu -join ', '))",
      '  # Le cache garde les anciennes reponses : on le vide, sinon le changement',
      "  # ne se verra pas tout de suite.",
      '  try {',
      '    Clear-DnsClientCache -ErrorAction Stop',
      "    [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Cache DNS' -Etat 'OK' -Valeur 'vide' -Commentaire 'Sans cela, les anciennes reponses survivraient au changement de serveur.')",
      '  } catch { }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      '  if ($conditionsAppliquer) {',
      "    Write-Host 'Les quatre conditions sont reunies. En mode Appliquer, le script'",
      "    Write-Host 'ecrirait la nouvelle liste sur la carte, relirait la configuration'",
      "    Write-Host 'pour la verifier, et viderait le cache DNS.'",
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'INFO' -Valeur 'passerait' -Commentaire 'Carte trouvee, etat precedent releve, annulation construite, tous les serveurs eprouves.')",
      '  } else {',
      '    $manquants = @()',
      "    if ($null -eq $adaptateur) { $manquants += 'carte introuvable' }",
      "    if (-not $etatPrecedentReleve) { $manquants += 'etat precedent non releve' }",
      "    if (-not $annulationConstruite) { $manquants += 'commande d''annulation non construite' }",
      "    if (-not $serveursDnsValides) { $manquants += 'serveur(s) DNS en echec : ' + ($serveursEnEchec -join ', ') }",
      "    Write-Host 'En mode Appliquer, le script SERAIT BLOQUE et n''ecrirait rien.'",
      "    Write-Host 'Ce qui manque :'",
      '    foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'PROBLEME' -Valeur ('serait bloque : ' + ($manquants -join ' ; ')) -Commentaire 'En l''etat, passer en mode Appliquer ne modifierait rien : les conditions prealables ne sont pas reunies.')",
      '  }',
      '}',
      blocModeDiagnostic(),
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Changement des serveurs DNS d\'une carte',
      outil: 'dns-client-change',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Mode', psB64(v.mode)],
        ['Carte', psB64(carte)],
        ['Serveurs', psB64(liste.join(', '))],
        ['NomTest', psB64(nomTest)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-dns-change',
      formats: 'Console',
    });
  },
  gui: [
    'Propriétés de la carte > TCP/IPv4 > Utiliser l’adresse de serveur DNS suivante.',
    '« Obtenir les adresses des serveurs DNS automatiquement » rend la main au DHCP.',
    'PowerShell : « Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 10.0.0.1,10.0.0.2 ».',
    'Pour revenir au DHCP : « Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ResetServerAddresses ».',
    'Sur un parc, le réglage se fait par le serveur DHCP ou par stratégie, pas poste par poste.',
  ],
  keywords: [
    'changer dns', 'set-dnsclientserveraddress', 'serveur dns', 'resetserveraddresses',
    'dns statique', 'dns dhcp', 'annulation', 'rollback dns', 'carte reseau',
    'perdre la machine', 'retour arriere',
  ],
  requiresAdmin: true,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Droits d’administrateur local : modifier la configuration d’une carte en demande.',
    'Le nom exact de la carte, tel que Get-NetAdapter l’affiche.',
    'Noter la commande d’annulation que le script écrit AVANT d’agir.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'La machine devient injoignable après le changement',
      cause: 'La session passait par un nom que les nouveaux serveurs ne résolvent pas.',
      fix: 'C’est exactement le risque annoncé en tête du script. Reprendre la main par adresse IP, puis appliquer la commande d’annulation.',
    },
    {
      message: 'Le changement ne semble pas pris en compte',
      cause: 'Le cache DNS garde les anciennes réponses.',
      fix: 'Le script vide le cache après avoir écrit. Sinon : « Clear-DnsClientCache ».',
    },
    {
      message: 'Les serveurs reviennent à leur ancienne valeur au redémarrage',
      cause: 'Le DHCP réimpose sa liste, ou une stratégie de groupe la pousse.',
      fix: 'Régler au bon endroit : option 006 du serveur DHCP, ou stratégie. Un réglage poste par poste ne tient pas.',
    },
    {
      message: 'Accès refusé',
      cause: 'La session n’est pas élevée.',
      fix: 'Relancer PowerShell en tant qu’administrateur.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'La commande d’annulation figure dans le rapport, avec les valeurs réelles d’avant.',
    'Après écriture, la liste est relue et comparée à ce qui était demandé.',
    'Le cache DNS a été vidé, sinon le changement ne se voit pas.',
    'Un nom interne se résout toujours : « Resolve-DnsName <nom-interne> ».',
  ],
  rollback: {
    summary: 'L’annulation est écrite par le script lui-même, avec les valeurs relevées avant l’action. C’est elle qu’il faut garder, pas un modèle générique.',
    diagnostic: '# Ce que la carte utilise maintenant, et d\'ou cela vient.\nGet-DnsClientServerAddress -InterfaceAlias \'<nom-de-la-carte>\' -AddressFamily IPv4\nGet-NetIPInterface -InterfaceAlias \'<nom-de-la-carte>\' -AddressFamily IPv4 | Select-Object InterfaceAlias,Dhcp',
    command: '# Remettre une liste precise, relevee avant le changement.\nSet-DnsClientServerAddress -InterfaceAlias \'<nom-de-la-carte>\' -ServerAddresses \'<ancien1>\',\'<ancien2>\' -Confirm\n\n# Ou rendre la main au DHCP, si la carte etait en automatique.\nSet-DnsClientServerAddress -InterfaceAlias \'<nom-de-la-carte>\' -ResetServerAddresses -Confirm\n\n# Puis vider le cache, sinon les anciennes reponses survivent.\nClear-DnsClientCache -Confirm',
    warning: 'Sur une machine distante, cette annulation doit pouvoir être lancée SANS résolution de noms : garder une session ouverte par adresse IP avant d’appliquer quoi que ce soit.',
  },
  checks: [
    'La commande d’annulation est écrite avant toute modification, avec les valeurs réelles.',
    'Les nouveaux serveurs sont éprouvés avant d’être imposés.',
    'Une liste à un seul serveur est signalée comme sans secours.',
    'La configuration est relue après écriture, et le cache vidé.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/dnsclient/set-dnsclientserveraddress',
  sources: [
    { label: 'Set-DnsClientServerAddress', url: 'https://learn.microsoft.com/powershell/module/dnsclient/set-dnsclientserveraddress' },
    { label: 'Get-DnsClientServerAddress', url: 'https://learn.microsoft.com/powershell/module/dnsclient/get-dnsclientserveraddress' },
    { label: 'Clear-DnsClientCache', url: 'https://learn.microsoft.com/powershell/module/dnsclient/clear-dnsclientcache' },
  ],
};
/**
 * 11. tcp-port-test — un à vingt ports nommés, sur une cible nommée.
 *
 * Un outil d'administration teste les ports qu'on lui désigne. Au-delà de
 * vingt, on balaye, et ce projet ne balaye pas : le validateur refuse, et il
 * dit pourquoi plutôt que de tronquer en silence.
 */
export const outilTestPortsTcp = {
  id: 'tcp-port-test',
  icon: '⊡',
  category: 'Réseau',
  subcategory: 'Ports et protocoles',
  title: 'Tester des ports TCP nommés',
  risk: 'diagnostic',
  summary: 'Teste un à vingt ports TCP explicitement nommés, avec un délai borné par port. Ne balaye pas : les intervalles sont refusés, et la liste est plafonnée. Dit ce qu’un port fermé prouve, et surtout ce qu’il ne prouve pas.',
  fields: [
    champCible('tpCible', 'Machine à tester.', 'srv-fichiers.hopitalbn.lan'),
    {
      id: 'tpPorts', label: 'Ports à tester', default: '445,139,3389',
      help: 'Jusqu’à vingt ports, séparés par des virgules. Les intervalles (1-1024) sont refusés : nommer chaque port est ce qui distingue un test d’un balayage.',
    },
    {
      id: 'tpDelai', label: 'Délai par port (ms)', default: '2000',
      help: 'Entre 100 et 30000. Deux secondes suffisent sur un réseau local ; compter davantage à travers un lien lent.',
    },
    champFormat('tpFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'tpCible', validerCibleReseau(v.tpCible));
    verifier(errors, 'tpPorts', validerListePorts(v.tpPorts));
    verifier(errors, 'tpDelai', validerDelaiMs(v.tpDelai, { min: 100, max: 30000, label: 'Le délai' }));
    verifier(errors, 'tpFormat', validerFormatRapport(v.tpFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerCibleReseau(v.tpCible).value;
    const ports = validerListePorts(v.tpPorts).value;
    const delai = validerDelaiMs(v.tpDelai, { min: 100, max: 30000 }).value;
    const dureeMax = Math.ceil((ports.length * delai) / 1000);

    const corps = [
      `$Cible = ${psB64(cible)}`,
      `$Ports = @(${ports.join(', ')})`,
      `$Delai = ${delai}`,
      `$KjemoFormat = ${psB64(v.tpFormat)}`,
      "",
      blocContexteReseau(),
      "",
      `# Cette mesure teste ${ports.length} port(s), ${delai} ms au maximum chacun.`,
      `# Duree maximale : environ ${dureeMax} seconde(s). Aucune boucle sans fin.`,
      `# Plafond du catalogue : ${PORTS_MAX_PAR_LISTE} ports nommes. Les intervalles sont refuses`,
      "# par le formulaire : nommer chaque port est ce qui distingue un test d'un balayage.",
      "",
      '# --- 1. Resolution ------------------------------------------------------------------',
      '$adresse = $null',
      'try { $adresse = (Resolve-DnsName -Name $Cible -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress } | Select-Object -First 1).IPAddress } catch { }',
      'if ($adresse) {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Resolution' -Etat 'OK' -Valeur ($Cible + ' -> ' + $adresse))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Resolution' -Etat 'ATTENTION' -Valeur $Cible -Commentaire 'Le nom ne se resout pas. Si la cible est deja une adresse, c''est normal.')",
      '}',
      "",
      '# --- 2. Chaque port, nommement -------------------------------------------------------',
      "# On utilise un client TCP .NET avec un delai explicite : Test-NetConnection",
      "# n'expose pas de delai reglable, et attendre vingt secondes par port ferme",
      '# rend le test inutilisable.',
      '$ouverts = 0',
      '$fermes = 0',
      'foreach ($p in $Ports) {',
      '  $client = $null',
      '  $ok = $false',
      "  $detail = ''",
      '  try {',
      '    $client = New-Object System.Net.Sockets.TcpClient',
      '    $tache = $client.BeginConnect($Cible, $p, $null, $null)',
      '    $fini = $tache.AsyncWaitHandle.WaitOne($Delai, $false)',
      '    if ($fini) {',
      '      try { $client.EndConnect($tache) ; $ok = $client.Connected }',
      "      catch { $ok = $false ; $detail = $_.Exception.InnerException.Message }",
      '    } else {',
      "      $detail = 'delai depasse'",
      '    }',
      '  } catch {',
      '    $detail = $_.Exception.Message',
      '  } finally {',
      '    if ($client) { $client.Close() }',
      '  }',
      "",
      '  if ($ok) {',
      '    $ouverts++',
      "    [void](Add-KjemoResultat -Categorie 'Ports' -Controle ('TCP ' + $p) -Etat 'OK' -Valeur 'ouvert' -Commentaire (Get-KjemoNomPort $p))",
      '  } else {',
      '    $fermes++',
      "    $note = (Get-KjemoNomPort $p)",
      "    if ($detail -eq 'delai depasse') { $note = $note + ' — aucune reponse avant la fin du delai : filtre par un pare-feu, ou hote absent.' }",
      "    elseif ($detail) { $note = $note + ' — ' + $detail }",
      "    [void](Add-KjemoResultat -Categorie 'Ports' -Controle ('TCP ' + $p) -Etat 'PROBLEME' -Valeur 'ferme ou filtre' -Commentaire $note)",
      '  }',
      '}',
      "",
      "[void](Add-KjemoResultat -Categorie 'Bilan' -Controle 'Ports ouverts' -Etat (& { if ($ouverts -gt 0) { 'OK' } else { 'PROBLEME' } }) -Valeur ($ouverts.ToString() + ' / ' + $Ports.Count))",
      "",
      "Write-Host ''",
      "Write-Host '--- Ce qu''un resultat prouve, et ce qu''il ne prouve pas ---'",
      "Write-Host 'Port OUVERT : quelque chose ecoute et accepte la connexion. Cela ne dit'",
      "Write-Host 'pas QUOI ecoute, ni que le service repondra correctement.'",
      "Write-Host 'Port FERME : rien n''a repondu depuis CE poste, a CET instant, par CE'",
      "Write-Host 'chemin. Le service peut ecouter sur une autre carte, n''accepter que'",
      "Write-Host 'certaines sources, ou etre protege par un pare-feu entre les deux.'",
      "Write-Host 'Un port ferme n''est jamais la preuve qu''un service est absent.'",
      blocAucunContournement(),
    ];

    // Table des ports usuels, résolue côté JavaScript puis gravée dans le
    // script : pas d'appel réseau, pas de fichier à lire.
    const entete = [
      'function Get-KjemoNomPort {',
      '  param([int]$Port)',
      '  switch ($Port) {',
      ...[
        [20, 'FTP (donnees)'], [21, 'FTP (commandes)'], [22, 'SSH'], [23, 'Telnet — en clair'],
        [25, 'SMTP'], [53, 'DNS'], [67, 'DHCP (serveur)'], [80, 'HTTP — en clair'],
        [88, 'Kerberos'], [110, 'POP3'], [123, 'NTP'], [135, 'RPC Endpoint Mapper'],
        [137, 'NetBIOS (noms)'], [139, 'NetBIOS (session) — SMB ancien'],
        [143, 'IMAP'], [389, 'LDAP'], [443, 'HTTPS'], [445, 'SMB'],
        [464, 'Kerberos (changement de mot de passe)'], [514, 'Syslog'],
        [587, 'SMTP (soumission)'], [636, 'LDAPS'], [993, 'IMAPS'], [995, 'POP3S'],
        [1433, 'SQL Server'], [1521, 'Oracle'], [3268, 'Catalogue global'],
        [3269, 'Catalogue global (TLS)'], [3306, 'MySQL'], [3389, 'Bureau a distance'],
        [5432, 'PostgreSQL'], [5985, 'WinRM (HTTP)'], [5986, 'WinRM (HTTPS)'],
        [8080, 'HTTP alternatif'], [9389, 'Service web Active Directory'],
      ].map(([n, nom]) => `    ${n} { return '${nom}' }`),
      "    default { return 'service non repertorie dans cet assistant' }",
      '  }',
      '}',
      "",
    ].join('\n');

    return assembler({
      titre: 'Test de ports TCP nommes',
      outil: 'tcp-port-test',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Cible', psB64(cible)],
        ['Ports', psB64(ports.join(','))],
        ['Delai', psB64(String(delai))],
        ['Format', psB64(v.tpFormat)],
      ],
      corps: [entete].concat(corps),
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-ports',
      formats: v.tpFormat,
    });
  },
  gui: [
    'PowerShell : « Test-NetConnection <cible> -Port 445 » teste un port, sans délai réglable.',
    '« netstat -an | findstr :445 » montre ce qui écoute localement.',
    'Du côté de la cible : « Get-NetTCPConnection -State Listen » liste les ports ouverts localement.',
    'Pare-feu Windows Defender avec fonctions avancées : règles de trafic entrant, pour savoir ce qui est autorisé.',
    'Telnet convient pour un test manuel, mais la fonctionnalité n’est pas installée par défaut.',
  ],
  keywords: [
    'port tcp', 'port ferme', 'port ouvert', 'test-netconnection', 'telnet',
    'pare-feu bloque', 'connexion refusee', 'delai depasse', 'tcpclient',
    '445', '3389', 'service injoignable',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation.',
    'Connaître les ports du service visé : cet assistant teste ce qu’on lui nomme, il ne devine pas.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Connexion refusée par l’hôte distant',
      cause: 'La cible a répondu, mais rien n’écoute sur ce port. C’est une réponse nette, et elle est bonne à avoir.',
      fix: 'Vérifier que le service tourne sur la cible et qu’il écoute sur la bonne carte.',
    },
    {
      message: 'Délai dépassé sur tous les ports',
      cause: 'Un pare-feu jette les paquets sans répondre, ou l’hôte est absent.',
      fix: 'Un refus net et un silence ne veulent pas dire la même chose. Le silence évoque un filtrage.',
    },
    {
      message: 'Le port est ouvert mais l’application ne marche pas',
      cause: 'Un port ouvert prouve qu’une connexion s’établit, pas que le service répond correctement.',
      fix: 'Tester le protocole lui-même : l’assistant LDAP, SMB ou HTTPS selon le cas.',
    },
    {
      message: 'Le formulaire refuse « 1-1024 »',
      cause: 'Les intervalles ne sont pas acceptés, par conception.',
      fix: 'Nommer les ports qui comptent. C’est ce qui distingue un test d’administration d’un balayage.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Chaque port demandé a sa ligne dans le rapport, ouvert ou fermé.',
    'La durée réelle ne dépasse pas la durée annoncée en tête du script.',
    'Le rapport rappelle ce qu’un port fermé ne prouve pas.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant ouvre des connexions TCP qui se referment seules. Il n’y a rien à annuler.',
    diagnostic: '# Refaire un test simple, a la main.\nTest-NetConnection -ComputerName \'<cible>\' -Port 445',
    command: '# Rien a annuler : aucune ecriture, aucun changement de configuration.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Tester des ports sur une machine qui n’est pas sous votre responsabilité peut être perçu comme une reconnaissance. Rester sur le périmètre de l’établissement.',
  },
  checks: [
    'Vingt ports au maximum, nommés un à un : les intervalles sont refusés.',
    'Le délai par port est borné et validé.',
    'Aucun balayage, aucune furtivité, aucun test UDP de masse.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection',
  sources: [
    { label: 'Test-NetConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
    { label: 'Get-NetTCPConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-nettcpconnection' },
    { label: 'netstat', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/netstat' },
  ],
};

/**
 * 12. rpc-connectivity-test — le port 135 ouvert ne prouve presque rien.
 *
 * C'est tout le propos de cet outil. RPC commence par une négociation sur le
 * port 135, qui répond l'adresse ET LE PORT où la vraie conversation aura
 * lieu — un port dynamique, entre 49152 et 65535 par défaut. Un pare-feu qui
 * autorise 135 et bloque la plage dynamique laisse un diagnostic « vert »
 * alors que rien ne fonctionne.
 */
export const outilConnectiviteRpc = {
  id: 'rpc-connectivity-test',
  icon: '⊞',
  category: 'Réseau',
  subcategory: 'Ports et protocoles',
  title: 'Tester la connectivité RPC',
  risk: 'diagnostic',
  summary: 'Teste le mappeur de points de terminaison sur le port 135, puis la plage dynamique — parce qu’un port 135 ouvert ne prouve presque rien. Un pare-feu qui autorise 135 et bloque la suite laisse un diagnostic « vert » alors que rien ne fonctionne.',
  fields: [
    champCible('rpcCible', 'Serveur à tester : contrôleur de domaine, serveur de fichiers, serveur d’impression.', 'dc01.hopitalbn.lan'),
    {
      id: 'rpcEchantillon', label: 'Ports dynamiques à éprouver', default: '5',
      help: 'Entre 1 et 20. Quelques ports pris dans la plage dynamique suffisent à dire si elle est filtrée. Ce n’est pas un balayage : on ne cherche pas ce qui écoute, on cherche si le chemin est ouvert.',
    },
    {
      id: 'rpcDelai', label: 'Délai par port (ms)', default: '1500',
      help: 'Entre 100 et 30000.',
    },
    champFormat('rpcFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'rpcCible', validerCibleReseau(v.rpcCible));
    verifier(errors, 'rpcEchantillon', validerEntier(v.rpcEchantillon, 1, 20, 'Le nombre de ports dynamiques'));
    verifier(errors, 'rpcDelai', validerDelaiMs(v.rpcDelai, { min: 100, max: 30000, label: 'Le délai' }));
    verifier(errors, 'rpcFormat', validerFormatRapport(v.rpcFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerCibleReseau(v.rpcCible).value;
    const echantillon = validerEntier(v.rpcEchantillon, 1, 20).value;
    const delai = validerDelaiMs(v.rpcDelai, { min: 100, max: 30000 }).value;

    const corps = [
      `$Cible = ${psB64(cible)}`,
      `$Echantillon = ${echantillon}`,
      `$Delai = ${delai}`,
      `$KjemoFormat = ${psB64(v.rpcFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- Pourquoi ce script existe --------------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Ce qu''il faut comprendre avant de lire ce rapport ---'",
      "Write-Host 'RPC ne tient pas sur un seul port. La conversation commence sur le port'",
      "Write-Host '135, le mappeur de points de terminaison, qui repond : « le service que'",
      "Write-Host 'tu cherches ecoute sur tel port ». Ce port-la est DYNAMIQUE : entre'",
      "Write-Host '49152 et 65535 sur Windows Server 2008 et plus recent.'",
      "Write-Host ''",
      "Write-Host 'Un pare-feu qui autorise 135 et bloque la plage dynamique laisse donc un'",
      "Write-Host 'diagnostic « vert » alors que RIEN ne fonctionne. C''est la panne la plus'",
      "Write-Host 'courante, et la plus mal diagnostiquee, de tout l''ecosysteme Windows.'",
      "[void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Port 135 ouvert' -Etat 'INFO' -Valeur 'ne prouve presque rien' -Commentaire 'RPC negocie sur 135 puis bascule sur un port dynamique entre 49152 et 65535. Les deux doivent passer.')",
      "",
      '# --- 1. Resolution --------------------------------------------------------------------',
      '$adresse = $null',
      'try { $adresse = (Resolve-DnsName -Name $Cible -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress } | Select-Object -First 1).IPAddress } catch { }',
      'if ($adresse) {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Resolution' -Etat 'OK' -Valeur ($Cible + ' -> ' + $adresse))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Resolution' -Etat 'ATTENTION' -Valeur $Cible)",
      '}',
      "",
      '# --- 2. Le mappeur, port 135 -----------------------------------------------------------',
      '$mappeur = $null',
      'try { $mappeur = Test-NetConnection -ComputerName $Cible -Port 135 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($mappeur -and $mappeur.TcpTestSucceeded) {',
      "  [void](Add-KjemoResultat -Categorie 'Mappeur' -Controle 'TCP 135' -Etat 'OK' -Valeur 'ouvert' -Commentaire 'La negociation peut commencer. Elle ne peut pas ABOUTIR tant que la plage dynamique n''est pas joignable.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Mappeur' -Controle 'TCP 135' -Etat 'PROBLEME' -Valeur 'ferme ou filtre' -Commentaire 'Sans le mappeur, aucun service RPC n''est joignable : ni la console des services, ni la gestion a distance, ni la replication.')",
      '}',
      "",
      '# --- 3. La plage dynamique --------------------------------------------------------------',
      "# On eprouve quelques ports pris dans la plage, pour savoir si le CHEMIN est",
      "# ouvert. On ne cherche pas ce qui ecoute : ce serait un balayage, et ce n'est",
      "# pas la question. Un refus net prouve que le paquet est arrive ; un silence",
      '# evoque un filtrage.',
      '$base = 49152',
      '$pas = [Math]::Floor((65535 - 49152) / [Math]::Max($Echantillon, 1))',
      '$refus = 0',
      '$silences = 0',
      'for ($i = 0; $i -lt $Echantillon; $i++) {',
      '  $p = $base + ($i * $pas)',
      '  if ($p -gt 65535) { $p = 65535 }',
      '  $client = $null',
      "  $resultat = 'silence'",
      '  try {',
      '    $client = New-Object System.Net.Sockets.TcpClient',
      '    $tache = $client.BeginConnect($Cible, $p, $null, $null)',
      '    $fini = $tache.AsyncWaitHandle.WaitOne($Delai, $false)',
      '    if ($fini) {',
      "      try { $client.EndConnect($tache) ; $resultat = 'ouvert' }",
      "      catch { $resultat = 'refus net' }",
      '    }',
      '  } catch {',
      "    $resultat = 'refus net'",
      '  } finally {',
      '    if ($client) { $client.Close() }',
      '  }',
      "  if ($resultat -eq 'silence') { $silences++ } else { $refus++ }",
      "  [void](Add-KjemoResultat -Categorie 'Plage dynamique' -Controle ('TCP ' + $p) -Etat 'INFO' -Valeur $resultat)",
      '}',
      "",
      "$etatPlage = 'OK'",
      "$notePlage = 'Les paquets atteignent la cible : elle repond, meme pour dire qu''il n''y a rien sur ce port. Le chemin RPC est ouvert.'",
      'if ($silences -eq $Echantillon) {',
      "  $etatPlage = 'PROBLEME'",
      "  $notePlage = 'Aucune reponse sur aucun port de la plage : un pare-feu jette les paquets en silence. RPC negociera sur 135 et echouera ensuite — la panne « vert mais rien ne marche ».'",
      '} elseif ($silences -gt 0) {',
      "  $etatPlage = 'ATTENTION'",
      "  $notePlage = 'Reponses partielles : la plage est filtree en partie, ou le pare-feu limite son debit.'",
      '}',
      "[void](Add-KjemoResultat -Categorie 'Plage dynamique' -Controle 'Verdict' -Etat $etatPlage -Valeur ($refus.ToString() + ' reponse(s), ' + $silences + ' silence(s)') -Commentaire $notePlage)",
      "",
      '# --- 4. Conclusion croisee ---------------------------------------------------------------',
      '$mappeurOk = ($mappeur -and $mappeur.TcpTestSucceeded)',
      "$plageOk = ($etatPlage -eq 'OK')",
      'if ($mappeurOk -and $plageOk) {',
      "  [void](Add-KjemoResultat -Categorie 'Conclusion' -Controle 'Chemin RPC' -Etat 'OK' -Valeur 'mappeur et plage joignables' -Commentaire 'Le chemin reseau est ouvert. Un echec restant viendrait de l''authentification ou du service lui-meme, pas du reseau.')",
      '} elseif ($mappeurOk -and -not $plageOk) {',
      "  [void](Add-KjemoResultat -Categorie 'Conclusion' -Controle 'Chemin RPC' -Etat 'PROBLEME' -Valeur '135 ouvert, plage bloquee' -Commentaire 'C''EST la configuration trompeuse. Le test du port 135 passe, et rien ne fonctionne. Ouvrir la plage 49152-65535 entre les deux reseaux, ou restreindre la plage RPC cote serveur.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Conclusion' -Controle 'Chemin RPC' -Etat 'PROBLEME' -Valeur 'mappeur injoignable' -Commentaire 'Commencer par le port 135 : rien d''autre ne peut fonctionner avant.')",
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Si la plage dynamique doit etre reduite ---'",
      "Write-Host 'Cote serveur, la plage RPC se restreint par registre. Ce n''est pas une'",
      "Write-Host 'operation anodine : elle s''applique a TOUS les services RPC de la machine,'",
      "Write-Host 'et une plage trop etroite epuise les ports sous charge. Elle se decide, se'",
      "Write-Host 'documente, et se teste hors production. Cet assistant ne la configure pas.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Connectivite RPC : mappeur et plage dynamique',
      outil: 'rpc-connectivity-test',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Cible', psB64(cible)],
        ['Echantillon', psB64(String(echantillon))],
        ['Format', psB64(v.rpcFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-rpc',
      formats: v.rpcFormat,
    });
  },
  gui: [
    'Tester le port 135 : « Test-NetConnection <serveur> -Port 135 ».',
    'Sur le serveur : « netstat -ano | findstr :135 » confirme que le mappeur écoute.',
    'La plage dynamique par défaut est 49152-65535 depuis Windows Server 2008.',
    'Côté pare-feu périphérique : la règle doit autoriser 135 ET la plage dynamique entre les deux réseaux.',
    'Restreindre la plage se fait par registre, sous HKLM\\Software\\Microsoft\\Rpc\\Internet, et se teste hors production.',
  ],
  keywords: [
    'rpc', 'port 135', 'endpoint mapper', 'mappeur de points de terminaison',
    'plage dynamique', '49152', 'rpc server unavailable', 'serveur rpc non disponible',
    'console des services', 'gestion a distance', 'pare-feu rpc',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation.',
    'La cible doit être une machine Windows : RPC au sens de cet assistant est le RPC de Microsoft.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le serveur RPC n’est pas disponible',
      cause: 'Le mappeur est injoignable, ou la plage dynamique est bloquée après une négociation réussie.',
      fix: 'C’est exactement ce que ce rapport sépare. Regarder la conclusion croisée.',
    },
    {
      message: 'Le port 135 répond mais la console des services échoue',
      cause: 'La configuration trompeuse : 135 autorisé, plage dynamique bloquée.',
      fix: 'Ouvrir 49152-65535 entre les deux réseaux, ou restreindre la plage côté serveur et n’ouvrir que celle-là.',
    },
    {
      message: 'Tout fonctionne depuis le même sous-réseau, rien à travers le pare-feu',
      cause: 'Le pare-feu périphérique n’autorise que le port 135.',
      fix: 'Le trafic RPC traverse mal les pare-feu par conception. Beaucoup d’établissements préfèrent WinRM, qui tient sur un seul port.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport sépare l’état du mappeur de celui de la plage dynamique.',
    'La conclusion croisée distingue les trois cas : tout ouvert, 135 seul ouvert, rien ouvert.',
    'Le nombre de ports éprouvés correspond à l’échantillon demandé.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant ouvre des connexions TCP qui se referment seules.',
    diagnostic: '# Le mappeur repond-il ?\nTest-NetConnection -ComputerName \'<serveur>\' -Port 135',
    command: '# Rien a annuler : aucune ecriture.\n# La plage RPC se restreint cote serveur, par registre, et cet assistant\n# ne le fait pas : c\'est une decision qui se documente et se teste.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Restreindre la plage RPC s’applique à tous les services RPC de la machine. Une plage trop étroite épuise les ports sous charge.',
  },
  checks: [
    'L’échantillon de ports dynamiques est plafonné à vingt : ce n’est pas un balayage.',
    'Un refus net et un silence sont distingués : ils ne disent pas la même chose.',
    'Aucune configuration de la plage RPC n’est écrite.',
  ],
  source: 'https://learn.microsoft.com/troubleshoot/windows-server/networking/service-overview-and-network-port-requirements',
  sources: [
    { label: 'Ports réseau requis par les services Windows', url: 'https://learn.microsoft.com/troubleshoot/windows-server/networking/service-overview-and-network-port-requirements' },
    { label: 'Test-NetConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
    { label: 'Get-NetTCPConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-nettcpconnection' },
  ],
};
/**
 * 13. ldap-ldaps-connectivity — les quatre ports de l'annuaire, et le certificat.
 *
 * 389 et 636 pour le domaine, 3268 et 3269 pour le catalogue global. Les
 * confondre fait chercher longtemps : une requête qui porte sur toute la forêt
 * doit passer par le catalogue global, et lui seul.
 *
 * AUCUN mot de passe n'est demandé, écrit ou enregistré. Ce test porte sur le
 * CHEMIN et sur le CERTIFICAT, jamais sur une authentification.
 */
export const outilConnectiviteLdap = {
  id: 'ldap-ldaps-connectivity',
  icon: '◇',
  category: 'Réseau',
  subcategory: 'Ports et protocoles',
  title: 'Tester la connectivité LDAP et LDAPS',
  risk: 'diagnostic',
  summary: 'Éprouve les quatre ports de l’annuaire — 389, 636, 3268, 3269 —, vérifie la publication SRV du domaine et lit le certificat TLS avec sa date d’expiration. Ne demande aucun mot de passe et n’en écrit aucun : le test porte sur le chemin et le certificat, jamais sur une authentification.',
  fields: [
    champCible('llCible', 'Contrôleur de domaine à tester.', 'dc01.hopitalbn.lan'),
    {
      id: 'llDomaine', label: 'Domaine à vérifier (facultatif)', default: 'hopitalbn.lan',
      help: 'Pour contrôler que le domaine publie bien ses contrôleurs par enregistrements SRV. Vide : seul le serveur nommé est testé.',
    },
    {
      id: 'llAlerteJours', label: 'Alerter si le certificat expire dans (jours)', default: '30',
      help: 'Entre 1 et 365. Un certificat LDAPS expiré coupe toutes les liaisons sécurisées d’un coup, sans préavis.',
    },
    champFormat('llFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'llCible', validerCibleReseau(v.llCible));
    const dom = String(v.llDomaine ?? '').trim();
    if (dom !== '') verifier(errors, 'llDomaine', validerFqdn(dom));
    verifier(errors, 'llAlerteJours', validerEntier(v.llAlerteJours, 1, 365, 'Le seuil d’alerte'));
    verifier(errors, 'llFormat', validerFormatRapport(v.llFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const cible = validerCibleReseau(v.llCible).value;
    const domaine = String(v.llDomaine ?? '').trim();
    const alerte = validerEntier(v.llAlerteJours, 1, 365).value;

    const corps = [
      `$Cible = ${psB64(cible)}`,
      `$Domaine = ${psB64(domaine)}`,
      `$Alerte = ${alerte}`,
      `$KjemoFormat = ${psB64(v.llFormat)}`,
      "",
      blocContexteReseau(),
      "",
      "# Ce script n'authentifie RIEN. Il n'ouvre aucune session, ne demande aucun",
      "# mot de passe et n'en ecrit aucun. Il eprouve le chemin reseau et lit le",
      '# certificat presente, ce qui ne demande aucun identifiant.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Authentification' -Etat 'INFO' -Valeur 'aucune' -Commentaire 'Ce test porte sur le chemin et le certificat. Aucun identifiant n''est demande ni enregistre.')",
      "",
      '# --- 1. Les quatre ports ---------------------------------------------------------------',
      '# 389 et 636 : le domaine. 3268 et 3269 : le catalogue global, qui connait',
      "# toute la foret mais ne porte qu'un sous-ensemble des attributs. Une requete",
      '# sur la foret entiere doit passer par 3268, et par lui seul.',
      'foreach ($p in @(',
      "  @(389, 'LDAP — annuaire du domaine, en clair'),",
      "  @(636, 'LDAPS — annuaire du domaine, chiffre'),",
      "  @(3268, 'Catalogue global — toute la foret, attributs partiels'),",
      "  @(3269, 'Catalogue global chiffre')",
      ')) {',
      '  $t = $null',
      '  try { $t = Test-NetConnection -ComputerName $Cible -Port $p[0] -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      "  $etat = 'PROBLEME'",
      "  if ($t -and $t.TcpTestSucceeded) { $etat = 'OK' }",
      "  $note = $p[1]",
      "  if ($etat -eq 'PROBLEME' -and ($p[0] -eq 3268 -or $p[0] -eq 3269)) {",
      "    $note = $note + ' — ce serveur n''est peut-etre pas catalogue global. Tous les controleurs ne le sont pas.'",
      '  }',
      "  [void](Add-KjemoResultat -Categorie 'Ports' -Controle ('TCP ' + $p[0]) -Etat $etat -Valeur (& { if ($t) { 'ouvert : ' + $t.TcpTestSucceeded } else { 'test impossible' } }) -Commentaire $note)",
      '}',
      "",
      '# --- 2. Le domaine publie-t-il ses controleurs ? ------------------------------------------',
      "if ($Domaine -ne '') {",
      '  $srv = @()',
      "  try { $srv = @(Resolve-DnsName -Name ('_ldap._tcp.dc._msdcs.' + $Domaine) -Type SRV -ErrorAction SilentlyContinue | Where-Object { $_.NameTarget }) } catch { }",
      '  if ($srv.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Publication SRV' -Controle $Domaine -Etat 'PROBLEME' -Valeur 'aucun enregistrement' -Commentaire 'Le domaine ne publie pas ses controleurs : l''ouverture de session et la recherche de DC echoueront pour tout le parc.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Publication SRV' -Controle $Domaine -Etat 'OK' -Valeur ($srv.Count.ToString() + ' controleur(s) publie(s)'))",
      '    foreach ($s in ($srv | Select-Object -First 10)) {',
      "      [void](Add-KjemoResultat -Categorie 'Publication SRV' -Controle $s.NameTarget -Etat 'INFO' -Valeur ('port ' + $s.Port) -Commentaire ('priorite ' + $s.Priority + ' · poids ' + $s.Weight))",
      '    }',
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Publication SRV' -Controle 'Verification' -Etat 'IGNORE' -Valeur 'domaine non indique')",
      '}',
      "",
      '# --- 3. Le certificat LDAPS ---------------------------------------------------------------',
      '# On ouvre une session TLS pour LIRE le certificat presente. La validation',
      "# n'est jamais desactivee : on utilise le resultat du controle, on ne le",
      '# contourne pas.',
      '$certOk = $false',
      '$flux = $null',
      '$client = $null',
      'try {',
      '  $client = New-Object System.Net.Sockets.TcpClient',
      '  $client.Connect($Cible, 636)',
      '  $flux = New-Object System.Net.Security.SslStream($client.GetStream(), $false)',
      '  $flux.AuthenticateAsClient($Cible)',
      '  $cert = $flux.RemoteCertificate',
      '  if ($cert) {',
      '    $x = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cert)',
      '    $certOk = $true',
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Sujet' -Etat 'INFO' -Valeur $x.Subject)",
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Emetteur' -Etat 'INFO' -Valeur $x.Issuer)",
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Empreinte' -Etat 'INFO' -Valeur $x.Thumbprint)",
      '    $restant = [Math]::Floor(($x.NotAfter - (Get-Date)).TotalDays)',
      "    $etatC = 'OK'",
      "    $noteC = ('valide jusqu''au ' + $x.NotAfter.ToString('yyyy-MM-dd'))",
      '    if ($restant -lt 0) {',
      "      $etatC = 'PROBLEME'",
      "      $noteC = 'EXPIRE. Toutes les liaisons LDAPS echouent, et elles ont echoue d''un coup le jour de l''expiration.'",
      '    } elseif ($restant -lt $Alerte) {',
      "      $etatC = 'ATTENTION'",
      "      $noteC = 'Expire bientot. Un certificat LDAPS expire coupe toutes les liaisons securisees sans preavis.'",
      '    }',
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Expiration' -Etat $etatC -Valeur ($restant.ToString() + ' jour(s)') -Commentaire $noteC)",
      '    $sansChaine = $false',
      '    try {',
      '      $chaine = New-Object System.Security.Cryptography.X509Certificates.X509Chain',
      '      $sansChaine = -not $chaine.Build($x)',
      '      if ($sansChaine) {',
      "        $raisons = @($chaine.ChainStatus | ForEach-Object { $_.StatusInformation.Trim() })",
      "        [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Chaine de confiance' -Etat 'ATTENTION' -Valeur 'incomplete' -Commentaire (($raisons -join ' | ') + ' — vu depuis CE poste : une autorite interne absente de ce magasin donne ce resultat.'))",
      '      } else {',
      "        [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Chaine de confiance' -Etat 'OK' -Valeur 'complete' -Commentaire 'Vue depuis ce poste, avec son magasin de certificats.')",
      '      }',
      '    } catch { }',
      '  }',
      '} catch {',
      "  [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Lecture' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'La negociation TLS a echoue. Soit le port 636 est ferme, soit le certificat est refuse. La validation n''est PAS desactivee pour contourner ce refus.')",
      '} finally {',
      '  if ($flux) { $flux.Dispose() }',
      '  if ($client) { $client.Close() }',
      '}',
      "",
      'if (-not $certOk) {',
      "  [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Verdict' -Etat 'ATTENTION' -Valeur 'non lu' -Commentaire 'Sans certificat lisible, LDAPS ne fonctionnera pas, quelle que soit l''ouverture du port.')",
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- 389 ou 636, 389 ou 3268 ---'",
      "Write-Host '389 : l''annuaire du domaine, en clair. Beaucoup de parcs le restreignent.'",
      "Write-Host '636 : le meme, chiffre. Exige un certificat valide sur le controleur.'",
      "Write-Host '3268 : le catalogue global. Il connait TOUTE la foret, mais ne porte'",
      "Write-Host 'qu''un sous-ensemble des attributs. Une recherche sur la foret entiere doit'",
      "Write-Host 'passer par lui ; une lecture d''attribut rare doit passer par 389.'",
      "Write-Host 'Tous les controleurs ne sont pas catalogue global : 3268 ferme n''est pas'",
      "Write-Host 'forcement une panne.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Connectivite LDAP, LDAPS et catalogue global',
      outil: 'ldap-ldaps-connectivity',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Cible', psB64(cible)],
        ['Domaine', psB64(domaine)],
        ['Format', psB64(v.llFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-ldap',
      formats: v.llFormat,
    });
  },
  gui: [
    'ldp.exe, livré avec les outils AD DS : Connexion > Se connecter, puis le port 389 ou 636.',
    'Un échec sur 636 dans ldp.exe affiche la raison exacte du refus TLS.',
    '« nslookup -type=SRV _ldap._tcp.dc._msdcs.<domaine> » liste les contrôleurs publiés.',
    'Console des certificats du contrôleur > Personnel : le certificat d’authentification serveur y figure.',
    'Un certificat LDAPS doit porter le nom complet du contrôleur et l’usage « Authentification du serveur ».',
  ],
  keywords: [
    'ldap', 'ldaps', '389', '636', '3268', '3269', 'catalogue global',
    'global catalog', 'certificat ldaps', 'srv', 'controleur de domaine',
    'liaison securisee', 'annuaire injoignable', 'expiration certificat',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation, et aucun identifiant : ce test n’authentifie rien.',
    'Pour lire le certificat, le port 636 doit être joignable.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le port 3268 est fermé sur un contrôleur de domaine',
      cause: 'Ce contrôleur n’est pas catalogue global. Tous ne le sont pas.',
      fix: 'Ce n’est une panne que si l’application a besoin du catalogue global. Vérifier quels contrôleurs le sont.',
    },
    {
      message: 'LDAPS échoue alors que le port 636 est ouvert',
      cause: 'Le certificat est expiré, ne porte pas le bon nom, ou son autorité n’est pas connue du client.',
      fix: 'Les sections Certificat et Chaîne de confiance le disent. La chaîne est jugée depuis CE poste, avec son magasin.',
    },
    {
      message: 'La chaîne de confiance est incomplète depuis ce poste seulement',
      cause: 'L’autorité interne n’est pas dans le magasin de ce poste, alors qu’elle l’est sur les machines du domaine.',
      fix: 'Le rapport le précise. Déployer l’autorité racine interne par stratégie de groupe.',
    },
    {
      message: 'Aucun enregistrement SRV pour le domaine',
      cause: 'Les contrôleurs ne publient pas, ou le poste interroge un DNS qui ne porte pas la zone _msdcs.',
      fix: 'C’est une panne grave : l’ouverture de session de tout le parc en dépend.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les quatre ports ont chacun leur ligne, avec ce que chacun sert.',
    'Le certificat est lu, avec son sujet, son émetteur et ses jours restants.',
    'La chaîne de confiance est annoncée comme jugée depuis ce poste.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant ouvre des connexions qui se referment seules et lit un certificat.',
    diagnostic: '# Le certificat presente sur 636, lu a la main.\nTest-NetConnection -ComputerName \'<controleur>\' -Port 636\nResolve-DnsName -Name \'_ldap._tcp.dc._msdcs.<domaine>\' -Type SRV',
    command: '# Rien a annuler : aucune ecriture, aucune session ouverte.\n# Le remplacement d\'un certificat LDAPS se fait sur le controleur, par la\n# console des certificats ou l\'inscription automatique.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Le rapport contient le nom des contrôleurs de domaine et l’empreinte du certificat. C’est de l’information d’infrastructure : billet interne seulement.',
  },
  checks: [
    'Aucun mot de passe demandé, aucun identifiant écrit.',
    'La validation TLS n’est jamais désactivée, même quand elle échoue.',
    'Les quatre ports sont distingués, avec ce que chacun sert.',
  ],
  source: 'https://learn.microsoft.com/troubleshoot/windows-server/active-directory/config-firewall-for-ad-domains-and-trusts',
  sources: [
    { label: 'Ports à ouvrir pour les domaines et approbations AD', url: 'https://learn.microsoft.com/troubleshoot/windows-server/active-directory/config-firewall-for-ad-domains-and-trusts' },
    { label: 'Test-NetConnection', url: 'https://learn.microsoft.com/powershell/module/nettcpip/test-netconnection' },
    { label: 'Resolve-DnsName', url: 'https://learn.microsoft.com/powershell/module/dnsclient/resolve-dnsname' },
  ],
};

/**
 * 14. smb-connectivity-test — pourquoi ce partage ne s'ouvre pas.
 *
 * Quatre couches, dans l'ordre : le nom se résout-il, le port 445 répond-il,
 * SMB négocie-t-il, et le chemin existe-t-il. Chacune a sa panne, et les
 * confondre fait chercher des droits quand c'est le DNS.
 *
 * Aucun identifiant n'est demandé. Un accès refusé est RAPPORTÉ, jamais
 * contourné : c'est la différence entre un outil d'administration et autre
 * chose.
 */
export const outilConnectiviteSmb = {
  id: 'smb-connectivity-test',
  icon: '▤',
  category: 'Réseau',
  subcategory: 'Ports et protocoles',
  title: 'Tester la connectivité SMB',
  risk: 'diagnostic',
  summary: 'Quatre couches dans l’ordre : résolution, port 445, négociation SMB, existence du chemin. Chacune a sa panne, et les confondre fait chercher des droits quand c’est le DNS. Aucun identifiant demandé, aucun accès contourné.',
  fields: [
    champCible('smbServeur', 'Serveur de fichiers.', 'srv-fichiers.hopitalbn.lan'),
    {
      id: 'smbPartage', label: 'Nom du partage', default: 'Donnees',
      help: 'Nom du partage seul, sans les antislashs ni le nom du serveur.',
    },
    {
      id: 'smbSousDossier', label: 'Sous-dossier à vérifier (facultatif)', default: '',
      help: 'Chemin relatif dans le partage, par exemple « Comptabilité\\2026 ». Vide : seule la racine du partage est contrôlée.',
    },
    champFormat('smbcFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'smbServeur', validerCibleReseau(v.smbServeur));
    verifier(errors, 'smbPartage', validateShareName(v.smbPartage));
    const sous = String(v.smbSousDossier ?? '').trim();
    if (sous !== '') {
      if (/^[\\/]/.test(sous)) {
        errors.smbSousDossier = 'Indique un chemin relatif, sans antislash au début.';
      } else if (/["`$;|&<>*?]/.test(sous)) {
        errors.smbSousDossier = 'Le chemin ne peut contenir ni guillemet, ni joker, ni caractère de commande.';
      } else if (sous.includes('..')) {
        errors.smbSousDossier = 'Les remontées « .. » ne sont pas acceptées.';
      }
    }
    verifier(errors, 'smbcFormat', validerFormatRapport(v.smbcFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const serveur = validerCibleReseau(v.smbServeur).value;
    const partage = validateShareName(v.smbPartage).value;
    const sous = String(v.smbSousDossier ?? '').trim();

    const corps = [
      `$Serveur = ${psB64(serveur)}`,
      `$Partage = ${psB64(partage)}`,
      `$SousDossier = ${psB64(sous)}`,
      `$KjemoFormat = ${psB64(v.smbcFormat)}`,
      "$Unc = '\\\\' + $Serveur + '\\' + $Partage",
      "if ($SousDossier -ne '') { $Unc = $Unc + '\\' + $SousDossier }",
      "",
      blocContexteReseau(),
      "",
      "# Ce script n'ouvre aucune session avec des identifiants fournis et n'en",
      "# demande aucun. Il utilise le compte de la session en cours. Un acces refuse",
      '# est RAPPORTE, jamais contourne.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Identite utilisee' -Etat 'INFO' -Valeur ($env:USERDOMAIN + '\\' + $env:USERNAME) -Commentaire 'Le compte de cette session. Aucun identifiant n''est demande ni enregistre.')",
      "[void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Chemin UNC' -Etat 'INFO' -Valeur $Unc)",
      "",
      '# --- Couche 1 : le nom se resout-il ? -----------------------------------------------------',
      '$adresse = $null',
      'try { $adresse = (Resolve-DnsName -Name $Serveur -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress } | Select-Object -First 1).IPAddress } catch { }',
      'if ($adresse) {',
      "  [void](Add-KjemoResultat -Categorie '1. Resolution' -Controle $Serveur -Etat 'OK' -Valeur $adresse)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie '1. Resolution' -Controle $Serveur -Etat 'PROBLEME' -Valeur 'aucune reponse' -Commentaire 'Le nom ne se resout pas. Inutile de chercher des droits : rien ne peut aboutir.')",
      '}',
      "",
      '# --- Couche 2 : le port 445 ----------------------------------------------------------------',
      '$port445 = $null',
      'try { $port445 = Test-NetConnection -ComputerName $Serveur -Port 445 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($port445 -and $port445.TcpTestSucceeded) {',
      "  [void](Add-KjemoResultat -Categorie '2. Port' -Controle 'TCP 445' -Etat 'OK' -Valeur 'ouvert')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie '2. Port' -Controle 'TCP 445' -Etat 'PROBLEME' -Valeur 'ferme ou filtre' -Commentaire 'Beaucoup de reseaux bloquent 445 entre segments, et tous les fournisseurs d''acces le bloquent vers Internet.')",
      '}',
      '# Le port 139 sert au SMB ancien, sur NetBIOS. Sa presence seule est le signe',
      "# d'un serveur tres ancien, ou d'un client qui retombe sur SMB 1.",
      '$port139 = $null',
      'try { $port139 = Test-NetConnection -ComputerName $Serveur -Port 139 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($port139 -and $port139.TcpTestSucceeded) {',
      "  [void](Add-KjemoResultat -Categorie '2. Port' -Controle 'TCP 139' -Etat 'INFO' -Valeur 'ouvert' -Commentaire 'SMB sur NetBIOS. Si 445 est ferme et 139 ouvert, le serveur est tres ancien : SMB 1 est desactive par defaut depuis Windows 10 1709, et il ne faut pas le reactiver.')",
      '}',
      "",
      '# --- Couche 3 : SMB negocie-t-il ? ----------------------------------------------------------',
      '$config = $null',
      'try { $config = Get-SmbClientConfiguration -ErrorAction SilentlyContinue } catch { }',
      'if ($config) {',
      "  [void](Add-KjemoResultat -Categorie '3. SMB' -Controle 'Signature exigee par ce client' -Etat 'INFO' -Valeur $config.RequireSecuritySignature.ToString() -Commentaire 'Un client qui exige la signature ne se connectera pas a un serveur qui ne la propose pas.')",
      '}',
      '$connexions = @()',
      'try { $connexions = @(Get-SmbConnection -ServerName $Serveur -ErrorAction SilentlyContinue) } catch { }',
      'if ($connexions.Count -gt 0) {',
      '  foreach ($c in $connexions) {',
      "    $etatD = 'OK'",
      "    $noteD = ''",
      "    if ($c.Dialect -like '1.*') { $etatD = 'PROBLEME' ; $noteD = 'Dialecte SMB 1 : obsolete, non chiffre, et vulnerable. Il ne devrait plus etre utilise.' }",
      "    elseif ($c.Dialect -like '2.*') { $etatD = 'ATTENTION' ; $noteD = 'SMB 2 : fonctionnel, mais SMB 3 apporte le chiffrement et une bien meilleure resistance aux coupures.' }",
      "    [void](Add-KjemoResultat -Categorie '3. SMB' -Controle ('Connexion a ' + $c.ShareName) -Etat $etatD -Valeur ('dialecte ' + $c.Dialect) -Commentaire $noteD)",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie '3. SMB' -Controle 'Connexion etablie' -Etat 'INFO' -Valeur 'aucune' -Commentaire 'Aucune session SMB ouverte vers ce serveur a cet instant. Elle s''etablira au premier acces.')",
      '}',
      '$mappages = @()',
      'try { $mappages = @(Get-SmbMapping -ErrorAction SilentlyContinue | Where-Object { $_.RemotePath -like ("*" + $Serveur + "*") }) } catch { }',
      'foreach ($m in $mappages) {',
      "  $etatM = 'OK'",
      "  if ($m.Status -ne 'OK') { $etatM = 'PROBLEME' }",
      "  [void](Add-KjemoResultat -Categorie '3. SMB' -Controle ('Lecteur ' + $m.LocalPath) -Etat $etatM -Valeur ($m.RemotePath + ' — ' + $m.Status))",
      '}',
      "",
      '# --- Couche 4 : le chemin existe-t-il, et peut-on le lire ? ------------------------------------',
      '$accessible = $false',
      "$erreurAcces = ''",
      'try {',
      '  $accessible = Test-Path -LiteralPath $Unc -ErrorAction Stop',
      '} catch {',
      '  $erreurAcces = $_.Exception.Message',
      '}',
      'if ($accessible) {',
      "  [void](Add-KjemoResultat -Categorie '4. Chemin' -Controle $Unc -Etat 'OK' -Valeur 'accessible en lecture')",
      '  $contenu = $null',
      '  try { $contenu = @(Get-ChildItem -LiteralPath $Unc -ErrorAction Stop | Select-Object -First 1) } catch { $erreurAcces = $_.Exception.Message }',
      '  if ($contenu) {',
      "    [void](Add-KjemoResultat -Categorie '4. Chemin' -Controle 'Enumeration' -Etat 'OK' -Valeur 'le contenu se liste')",
      "  } elseif ($erreurAcces -ne '') {",
      "    [void](Add-KjemoResultat -Categorie '4. Chemin' -Controle 'Enumeration' -Etat 'PROBLEME' -Valeur $erreurAcces -Commentaire 'Le chemin existe mais son contenu ne se liste pas : droits NTFS ou droits de partage. Cet assistant RAPPORTE le refus, il ne le contourne pas.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie '4. Chemin' -Controle 'Enumeration' -Etat 'INFO' -Valeur 'dossier vide')",
      '  }',
      '} else {',
      "  $note = 'Le chemin n''est pas accessible depuis cette session.'",
      "  if ($erreurAcces -ne '') { $note = $erreurAcces }",
      "  [void](Add-KjemoResultat -Categorie '4. Chemin' -Controle $Unc -Etat 'PROBLEME' -Valeur 'inaccessible' -Commentaire $note)",
      '}',
      "",
      '# --- Lecture du rapport ---------------------------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Ou s''arreter ---'",
      "Write-Host 'Couche 1 en echec : c''est le DNS. Ne pas chercher de droits.'",
      "Write-Host 'Couche 2 en echec : c''est le reseau ou le pare-feu. Pas davantage.'",
      "Write-Host 'Couche 3 en echec : c''est la negociation SMB — dialecte, signature,'",
      "Write-Host 'ou chiffrement exige d''un cote et pas de l''autre.'",
      "Write-Host 'Couche 4 en echec, les trois premieres vertes : LA ce sont les droits,'",
      "Write-Host 'de partage ou NTFS. Les deux se cumulent, et le plus restrictif gagne.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Connectivite SMB, couche par couche',
      outil: 'smb-connectivity-test',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Serveur', psB64(serveur)],
        ['Partage', psB64(partage)],
        ['Format', psB64(v.smbcFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-smb',
      formats: v.smbcFormat,
    });
  },
  gui: [
    'Explorateur : saisir \\\\serveur\\partage dans la barre d’adresse. Le message d’erreur exact compte.',
    '« net use » liste les connexions en cours ; « net use * /delete » les ferme toutes.',
    'PowerShell : « Get-SmbConnection » montre le dialecte négocié, « Get-SmbMapping » les lecteurs.',
    'Sur le serveur : Gestionnaire de serveur > Services de fichiers > Partages, pour les droits de partage.',
    'Droits de partage et droits NTFS se cumulent : le plus restrictif des deux l’emporte.',
  ],
  keywords: [
    'smb', 'partage', 'unc', 'port 445', '139', 'acces refuse', 'chemin reseau introuvable',
    'get-smbconnection', 'get-smbmapping', 'dialecte smb', 'smb1', 'signature smb',
    'lecteur reseau', 'droits ntfs',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation : le test utilise le compte de la session en cours.',
    'Le nom du partage, sans les antislashs ni le nom du serveur.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le chemin réseau n’a pas été trouvé',
      cause: 'Le nom ne se résout pas, ou le port 445 est bloqué. Ce n’est pas un problème de droits.',
      fix: 'Les couches 1 et 2 du rapport répondent. Chercher des droits à ce stade fait perdre du temps.',
    },
    {
      message: 'Accès refusé alors que l’utilisateur a les droits',
      cause: 'Droits de partage et droits NTFS se cumulent : le plus restrictif gagne. Le partage est souvent oublié.',
      fix: 'Vérifier les deux. Un partage en « Lecture » annule un NTFS en « Modification ».',
    },
    {
      message: 'Le serveur n’est joignable que sur le port 139',
      cause: 'Serveur très ancien, qui n’écoute que SMB sur NetBIOS.',
      fix: 'SMB 1 est désactivé par défaut depuis Windows 10 1709 et ne doit pas être réactivé. Le serveur doit être mis à niveau.',
    },
    {
      message: 'La connexion échoue avec une erreur de signature ou de chiffrement',
      cause: 'Le client exige une signature ou un chiffrement que le serveur ne propose pas, ou l’inverse.',
      fix: 'La section 3 montre ce que ce client exige. Le réglage se décide côté serveur, pas en abaissant le client.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les quatre couches ont chacune leur verdict, dans l’ordre.',
    'Le dialecte SMB négocié est relevé s’il existe une connexion.',
    'Un refus d’accès est rapporté avec son message exact, sans tentative de contournement.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit. Aucune session n’est montée, aucun lecteur mappé.',
    diagnostic: '# Les sessions et lecteurs en cours vers ce serveur.\nGet-SmbConnection -ServerName \'<serveur>\'\nGet-SmbMapping',
    command: '# Rien a annuler : aucun montage, aucun identifiant enregistre.\n# Pour fermer une session SMB existante, ouverte par ailleurs :\nGet-SmbMapping -LocalPath \'<lettre>:\' | Remove-SmbMapping -Confirm',
    warning: 'Fermer une session SMB coupe les fichiers ouverts dessus. Prévenir avant.',
  },
  checks: [
    'Aucun identifiant demandé, aucun montage avec mot de passe.',
    'Un accès refusé est rapporté, jamais contourné.',
    'SMB 1 est signalé comme obsolète, et jamais proposé comme solution.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbconnection',
  sources: [
    { label: 'Get-SmbConnection', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbconnection' },
    { label: 'Get-SmbMapping', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbmapping' },
    { label: 'Get-SmbClientConfiguration', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbclientconfiguration' },
  ],
};
/**
 * 15. http-https-tls-test — DNS, TCP, requête, redirections, certificat.
 *
 * La règle absolue de cet outil : la validation TLS n'est JAMAIS désactivée.
 * C'est tentant — un « -SkipCertificateCheck » fait disparaître l'erreur et
 * donne l'impression d'avancer. Il fait surtout disparaître le diagnostic : on
 * ne sait plus si le certificat était expiré, mal nommé, ou signé par une
 * autorité inconnue. Et un contournement posé « juste pour tester » reste.
 */
export const outilTestHttpsTls = {
  id: 'http-https-tls-test',
  icon: '⚿',
  category: 'Réseau',
  subcategory: 'Ports et protocoles',
  title: 'Tester HTTP, HTTPS et le certificat TLS',
  risk: 'diagnostic',
  summary: 'Résolution, port, requête, redirections, puis certificat : sujet, autres noms, chaîne et expiration. La validation TLS n’est jamais désactivée — un contournement fait disparaître l’erreur et le diagnostic avec elle.',
  fields: [
    {
      id: 'htUrl', label: 'Adresse à tester', default: 'https://intranet.hopitalbn.lan/',
      help: 'Adresse complète, http:// ou https://. Le port peut être précisé après le nom d’hôte.',
    },
    {
      id: 'htRedirections', label: 'Suivre les redirections', type: 'select', default: 'Oui',
      options: [
        ['Oui', 'Oui — suivre et montrer la chaîne'],
        ['Non', 'Non — s’arrêter à la première réponse'],
      ],
      help: 'Suivre montre où l’on aboutit vraiment. Ne pas suivre montre ce que le serveur répond d’abord.',
    },
    {
      id: 'htDelai', label: 'Délai de la requête (ms)', default: '10000',
      help: 'Entre 100 et 30000.',
    },
    {
      id: 'htAlerteJours', label: 'Alerter si le certificat expire dans (jours)', default: '30',
      help: 'Entre 1 et 365.',
    },
    champFormat('htFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'htUrl', validerUrlHttpOuHttps(v.htUrl));
    verifier(errors, 'htRedirections', validerChoix(v.htRedirections, ['Oui', 'Non'], 'Le choix'));
    verifier(errors, 'htDelai', validerDelaiMs(v.htDelai, { min: 100, max: 30000, label: 'Le délai' }));
    verifier(errors, 'htAlerteJours', validerEntier(v.htAlerteJours, 1, 365, 'Le seuil d’alerte'));
    verifier(errors, 'htFormat', validerFormatRapport(v.htFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const url = validerUrlHttpOuHttps(v.htUrl).value;
    const suivre = validerChoix(v.htRedirections, ['Oui', 'Non']).value;
    const delai = validerDelaiMs(v.htDelai, { min: 100, max: 30000 }).value;
    const alerte = validerEntier(v.htAlerteJours, 1, 365).value;

    const corps = [
      `$Url = ${psB64(url)}`,
      `$Suivre = ${psB64(suivre)}`,
      `$Delai = ${delai}`,
      `$Alerte = ${alerte}`,
      `$KjemoFormat = ${psB64(v.htFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- Regle absolue de ce script ---------------------------------------------------------',
      "# La validation TLS n'est JAMAIS desactivee. Pas d'option pour le faire, pas de",
      "# rappel de verification remplace, pas de -SkipCertificateCheck. Un",
      "# contournement fait disparaitre l'erreur ET le diagnostic : on ne sait plus si",
      "# le certificat etait expire, mal nomme, ou signe par une autorite inconnue. Et",
      "# un contournement pose « juste pour tester » reste.",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Validation TLS' -Etat 'INFO' -Valeur 'jamais desactivee' -Commentaire 'Ce script utilise le resultat du controle de certificat, il ne le contourne pas.')",
      "",
      '# --- 1. Decomposer l\'adresse -------------------------------------------------------------',
      '$uri = $null',
      'try { $uri = [System.Uri]$Url } catch { }',
      'if (-not $uri) {',
      "  [void](Add-KjemoResultat -Categorie 'Adresse' -Controle 'Analyse' -Etat 'PROBLEME' -Valeur $Url -Commentaire 'Adresse illisible.')",
      '  return',
      '}',
      '$hote = $uri.Host',
      '$port = $uri.Port',
      "$chiffre = ($uri.Scheme -eq 'https')",
      "[void](Add-KjemoResultat -Categorie 'Adresse' -Controle 'Hote' -Etat 'INFO' -Valeur $hote)",
      "[void](Add-KjemoResultat -Categorie 'Adresse' -Controle 'Port' -Etat 'INFO' -Valeur $port -Commentaire ('schema ' + $uri.Scheme))",
      "if (-not $chiffre) {",
      "  [void](Add-KjemoResultat -Categorie 'Adresse' -Controle 'Chiffrement' -Etat 'ATTENTION' -Valeur 'http en clair' -Commentaire 'Le contenu circule en clair, y compris les identifiants s''il y en a. A reserver aux essais.')",
      '}',
      "",
      '# --- 2. Resolution ------------------------------------------------------------------------',
      '$adresses = @()',
      'try { $adresses = @(Resolve-DnsName -Name $hote -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress }) } catch { }',
      'if ($adresses.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Resolution' -Controle $hote -Etat 'PROBLEME' -Valeur 'aucune reponse')",
      '} else {',
      '  foreach ($a in $adresses) {',
      "    [void](Add-KjemoResultat -Categorie 'Resolution' -Controle $a.Type.ToString() -Etat 'OK' -Valeur $a.IPAddress)",
      '  }',
      '}',
      "",
      '# --- 3. Le port repond-il ? ----------------------------------------------------------------',
      '$tcp = $null',
      'try { $tcp = Test-NetConnection -ComputerName $hote -Port $port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($tcp -and $tcp.TcpTestSucceeded) {',
      "  [void](Add-KjemoResultat -Categorie 'Transport' -Controle ('TCP ' + $port) -Etat 'OK' -Valeur 'ouvert')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Transport' -Controle ('TCP ' + $port) -Etat 'PROBLEME' -Valeur 'ferme ou filtre' -Commentaire 'Sans le port, ni la requete ni le certificat ne diront quoi que ce soit.')",
      '}',
      "",
      '# --- 4. Le certificat, lu avant la requete --------------------------------------------------',
      "# On lit le certificat separement, parce qu'une requete qui echoue sur un",
      '# certificat refuse ne dit PAS pourquoi. En le lisant a part, on obtient la',
      '# raison exacte.',
      'if ($chiffre) {',
      '  $client = $null',
      '  $flux = $null',
      '  try {',
      '    $client = New-Object System.Net.Sockets.TcpClient',
      '    $client.Connect($hote, $port)',
      '    $flux = New-Object System.Net.Security.SslStream($client.GetStream(), $false)',
      '    $flux.AuthenticateAsClient($hote)',
      "    [void](Add-KjemoResultat -Categorie 'TLS' -Controle 'Negociation' -Etat 'OK' -Valeur 'aboutie' -Commentaire ('protocole ' + $flux.SslProtocol))",
      '    $x = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($flux.RemoteCertificate)',
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Sujet' -Etat 'INFO' -Valeur $x.Subject)",
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Emetteur' -Etat 'INFO' -Valeur $x.Issuer)",
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Empreinte' -Etat 'INFO' -Valeur $x.Thumbprint)",
      "",
      '    # Les autres noms acceptes : un certificat qui ne porte pas le nom demande',
      "    # sera refuse, meme s'il est valide par ailleurs. C'est l'erreur la plus",
      '    # frequente apres l\'expiration.',
      "    $sans = ''",
      '    try {',
      '      foreach ($ext in $x.Extensions) {',
      "        if ($ext.Oid.Value -eq '2.5.29.17') { $sans = $ext.Format($false) }",
      '      }',
      '    } catch { }',
      "    if ($sans -ne '') {",
      "      $porteLeNom = ($sans -match [Regex]::Escape($hote)) -or ($x.Subject -match [Regex]::Escape($hote))",
      "      [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Autres noms acceptes' -Etat (& { if ($porteLeNom) { 'OK' } else { 'PROBLEME' } }) -Valeur $sans -Commentaire (& { if ($porteLeNom) { 'Le nom demande figure bien dans le certificat.' } else { 'Le nom demande ne figure NI dans le sujet NI dans les autres noms : tout client refusera ce certificat pour cette adresse.' } }))",
      '    }',
      "",
      '    $restant = [Math]::Floor(($x.NotAfter - (Get-Date)).TotalDays)',
      "    $etatE = 'OK'",
      "    $noteE = ('valide du ' + $x.NotBefore.ToString('yyyy-MM-dd') + ' au ' + $x.NotAfter.ToString('yyyy-MM-dd'))",
      "    if ($restant -lt 0) { $etatE = 'PROBLEME' ; $noteE = 'EXPIRE. Tous les clients le refusent, et ils l''ont refuse d''un coup le jour de l''expiration.' }",
      "    elseif ($restant -lt $Alerte) { $etatE = 'ATTENTION' ; $noteE = 'Expire bientot : planifier le renouvellement maintenant.' }",
      "    [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Expiration' -Etat $etatE -Valeur ($restant.ToString() + ' jour(s)') -Commentaire $noteE)",
      "",
      '    try {',
      '      $chaine = New-Object System.Security.Cryptography.X509Certificates.X509Chain',
      '      $ok = $chaine.Build($x)',
      '      if ($ok) {',
      "        [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Chaine de confiance' -Etat 'OK' -Valeur ($chaine.ChainElements.Count.ToString() + ' element(s)') -Commentaire 'Jugee depuis CE poste, avec son magasin de certificats.')",
      '      } else {',
      '        $raisons = @($chaine.ChainStatus | ForEach-Object { $_.StatusInformation.Trim() })',
      "        [void](Add-KjemoResultat -Categorie 'Certificat' -Controle 'Chaine de confiance' -Etat 'PROBLEME' -Valeur 'incomplete' -Commentaire (($raisons -join ' | ') + ' — jugee depuis CE poste : une autorite interne absente de ce magasin donne ce resultat alors que les machines du domaine acceptent le certificat.'))",
      '      }',
      '    } catch { }',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'TLS' -Controle 'Negociation' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'La negociation a echoue. La validation n''est PAS desactivee pour passer outre : c''est ce message qui porte le diagnostic.')",
      '  } finally {',
      '    if ($flux) { $flux.Dispose() }',
      '    if ($client) { $client.Close() }',
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'TLS' -Controle 'Negociation' -Etat 'IGNORE' -Valeur 'adresse en http' -Commentaire 'Pas de certificat a lire.')",
      '}',
      "",
      '# --- 5. La requete ---------------------------------------------------------------------------',
      '$reponse = $null',
      "$erreurRequete = ''",
      'try {',
      "  if ($Suivre -eq 'Oui') {",
      '    $reponse = Invoke-WebRequest -Uri $Url -TimeoutSec ([Math]::Ceiling($Delai / 1000)) -UseBasicParsing -ErrorAction Stop',
      '  } else {',
      '    $reponse = Invoke-WebRequest -Uri $Url -TimeoutSec ([Math]::Ceiling($Delai / 1000)) -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop',
      '  }',
      '} catch {',
      '  $erreurRequete = $_.Exception.Message',
      '  try { $reponse = $_.Exception.Response } catch { }',
      '}',
      "",
      'if ($reponse -and $reponse.StatusCode) {',
      '  $code = [int]$reponse.StatusCode',
      "  $etatR = 'OK'",
      "  $noteR = ''",
      "  if ($code -ge 500) { $etatR = 'PROBLEME' ; $noteR = 'Erreur du serveur : le reseau a fait son travail, l''application non.' }",
      "  elseif ($code -ge 400) { $etatR = 'ATTENTION' ; $noteR = 'Erreur cote client : chemin inexistant, ou authentification requise.' }",
      "  elseif ($code -ge 300) { $etatR = 'INFO' ; $noteR = 'Redirection.' }",
      "  [void](Add-KjemoResultat -Categorie 'Requete' -Controle 'Code HTTP' -Etat $etatR -Valeur $code -Commentaire $noteR)",
      '  try {',
      '    $serveurEntete = $reponse.Headers[\'Server\']',
      "    if ($serveurEntete) { [void](Add-KjemoResultat -Categorie 'Requete' -Controle 'En-tete Server' -Etat 'INFO' -Valeur $serveurEntete) }",
      '    $emplacement = $reponse.Headers[\'Location\']',
      "    if ($emplacement) { [void](Add-KjemoResultat -Categorie 'Requete' -Controle 'Redirection vers' -Etat 'INFO' -Valeur $emplacement) }",
      '    $hsts = $reponse.Headers[\'Strict-Transport-Security\']',
      "    if ($hsts) { [void](Add-KjemoResultat -Categorie 'Requete' -Controle 'HSTS' -Etat 'OK' -Valeur $hsts -Commentaire 'Le serveur impose https pour les visites suivantes.') }",
      '  } catch { }',
      "  if ($Suivre -eq 'Oui' -and $reponse.BaseResponse -and $reponse.BaseResponse.ResponseUri) {",
      '    $final = $reponse.BaseResponse.ResponseUri.AbsoluteUri',
      '    if ($final -ne $Url) {',
      "      [void](Add-KjemoResultat -Categorie 'Requete' -Controle 'Adresse finale' -Etat 'INFO' -Valeur $final -Commentaire 'Apres redirections. Si le schema est passe de https a http, le contenu circule en clair.')",
      '    }',
      '  }',
      "} elseif ($erreurRequete -ne '') {",
      "  [void](Add-KjemoResultat -Categorie 'Requete' -Controle 'Echec' -Etat 'PROBLEME' -Valeur $erreurRequete -Commentaire 'Si le message parle du certificat, la section Certificat ci-dessus en donne la raison exacte.')",
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Ce que ce script ne fera jamais ---'",
      "Write-Host 'Il ne desactive pas la validation du certificat, meme si cela ferait'",
      "Write-Host '« passer » le test. Un certificat refuse l''est pour une raison, et cette'",
      "Write-Host 'raison est le diagnostic. Un contournement pose pour depanner reste en'",
      "Write-Host 'place des annees, et masque le jour ou le certificat est vraiment faux.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Test HTTP, HTTPS et certificat TLS',
      outil: 'http-https-tls-test',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Url', psB64(url)],
        ['Suivre', psB64(suivre)],
        ['Format', psB64(v.htFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-https',
      formats: v.htFormat,
    });
  },
  gui: [
    'Dans le navigateur : cliquer sur le cadenas > Détails du certificat, pour le sujet, l’émetteur et les dates.',
    'Outils de développement > Réseau : la chaîne de redirections et les en-têtes, requête par requête.',
    'certlm.msc sur le serveur : le certificat et sa clé privée, dans Personnel.',
    'certmgr.msc sur le poste : les autorités de confiance. Une autorité interne absente explique un refus local.',
    'PowerShell : « Invoke-WebRequest <url> -UseBasicParsing » sans jamais ajouter d’option qui ignore le certificat.',
  ],
  keywords: [
    'https', 'tls', 'certificat', 'certificat expire', 'autorite inconnue',
    'chaine de confiance', 'redirection', 'invoke-webrequest', 'code http',
    'hsts', 'nom du certificat', 'subject alternative name', 'erreur de certificat',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation.',
    'L’adresse complète, http:// ou https://, avec le port si ce n’est pas le port par défaut.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'La relation d’approbation pour le canal sécurisé n’a pas pu être établie',
      cause: 'L’autorité qui a signé le certificat n’est pas connue de ce poste, ou la chaîne est incomplète côté serveur.',
      fix: 'La section Chaîne de confiance le dit, et précise que le jugement vient de ce poste. Déployer l’autorité interne par stratégie.',
    },
    {
      message: 'Le certificat ne correspond pas au nom du site',
      cause: 'Le nom demandé ne figure ni dans le sujet ni dans les autres noms acceptés.',
      fix: 'La section « Autres noms acceptés » le montre. Il faut un certificat qui porte le nom réellement utilisé.',
    },
    {
      message: 'Le site répond en http après une adresse en https',
      cause: 'Une redirection fait retomber vers http.',
      fix: 'La ligne « Adresse finale » le montre. Le contenu circule alors en clair, ce qui est rarement voulu.',
    },
    {
      message: 'Erreur 403 ou 401 alors que le site fonctionne dans le navigateur',
      cause: 'Le navigateur envoie une authentification que ce script n’envoie pas : il n’envoie aucun identifiant.',
      fix: 'C’est voulu. Ce test porte sur le chemin et le certificat, pas sur l’accès authentifié.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le certificat est lu séparément de la requête : sa raison de refus apparaît même quand la requête échoue.',
    'La chaîne de confiance est annoncée comme jugée depuis ce poste.',
    'Si les redirections sont suivies, l’adresse finale est indiquée.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant ouvre des connexions sortantes qui se referment seules.',
    diagnostic: '# Refaire la requete a la main, sans jamais ignorer le certificat.\nInvoke-WebRequest -Uri \'<url>\' -UseBasicParsing | Select-Object StatusCode,Headers',
    command: '# Rien a annuler : aucune ecriture, aucune confiance ajoutee au magasin.\n# Si une autorite interne manque sur ce poste, elle se deploie par\n# strategie de groupe, pas en ignorant la validation.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'N’ajoutez jamais une autorité au magasin « Autorités de certification racines de confiance » pour faire passer un test : cela vaut pour tout le système, pas pour ce site.',
  },
  checks: [
    'La validation TLS n’est jamais désactivée, et aucune option ne le permet.',
    'Le certificat est lu séparément, pour obtenir la raison exacte d’un refus.',
    'Aucun identifiant n’est envoyé ni demandé.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/invoke-webrequest',
  sources: [
    { label: 'Invoke-WebRequest', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/invoke-webrequest' },
    { label: 'X509Certificate2', url: 'https://learn.microsoft.com/dotnet/api/system.security.cryptography.x509certificates.x509certificate2' },
    { label: 'SslStream', url: 'https://learn.microsoft.com/dotnet/api/system.net.security.sslstream' },
  ],
};
/**
 * 16. route-table-diagnostic — lire la table de routage, et comprendre qui gagne.
 *
 * Deux règles, dans cet ordre, et tout en découle : le préfixe le plus long
 * gagne d'abord ; à préfixe égal, la métrique totale la plus basse gagne.
 * Cet outil montre l'application de ces deux règles pour une destination
 * donnée, au lieu de laisser déchiffrer soixante lignes.
 */
export const outilTableRoutage = {
  id: 'route-table-diagnostic',
  icon: '⌁',
  category: 'Réseau',
  subcategory: 'Routage et voisinage',
  title: 'Diagnostiquer la table de routage',
  risk: 'diagnostic',
  summary: 'Montre la table de routage IPv4 et IPv6, la route par défaut, les métriques, les routes persistantes et les collisions — puis applique les deux règles de décision à une destination donnée, pour dire quelle route gagne et pourquoi.',
  fields: [
    {
      id: 'rtDestination', label: 'Destination à expliquer', default: '8.8.8.8',
      help: 'Une adresse IPv4 dont on veut savoir par quelle route elle sortira.',
    },
    {
      id: 'rtFamille', label: 'Famille d’adresses', type: 'select', default: 'IPv4',
      options: [
        ['IPv4', 'IPv4 seulement'],
        ['Les deux', 'IPv4 et IPv6'],
      ],
      help: 'IPv6 a sa propre table. Une machine peut router correctement en IPv4 et mal en IPv6, ou l’inverse.',
    },
    champFormat('rtFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'rtDestination', validateIPv4(v.rtDestination));
    verifier(errors, 'rtFamille', validerChoix(v.rtFamille, ['IPv4', 'Les deux'], 'La famille'));
    verifier(errors, 'rtFormat', validerFormatRapport(v.rtFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const destination = validateIPv4(v.rtDestination).value;
    const famille = validerChoix(v.rtFamille, ['IPv4', 'Les deux']).value;

    const corps = [
      `$Destination = ${psB64(destination)}`,
      `$Famille = ${psB64(famille)}`,
      `$KjemoFormat = ${psB64(v.rtFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- Les deux regles, dans l\'ordre ------------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Comment Windows choisit une route ---'",
      "Write-Host '1. Le PREFIXE LE PLUS LONG gagne. Une route /24 l''emporte sur une /16,'",
      "Write-Host '   qui l''emporte sur la route par defaut /0. La metrique n''intervient'",
      "Write-Host '   meme pas a ce stade.'",
      "Write-Host '2. A prefixe EGAL, la METRIQUE TOTALE la plus basse gagne.'",
      "Write-Host '   Metrique totale = metrique de route + metrique d''interface.'",
      "",
      '# --- 1. La table ---------------------------------------------------------------------------',
      '$routes = @()',
      'try {',
      '  $routes = @(Get-NetRoute -ErrorAction SilentlyContinue)',
      "  if ($Famille -eq 'IPv4') { $routes = @($routes | Where-Object { $_.AddressFamily -eq 'IPv4' }) }",
      '} catch { }',
      "[void](Add-KjemoResultat -Categorie 'Table' -Controle 'Routes relevees' -Etat 'INFO' -Valeur $routes.Count)",
      "",
      '# Metrique d\'interface, pour pouvoir calculer le total.',
      '$metriques = @{}',
      'try {',
      '  foreach ($i in (Get-NetIPInterface -ErrorAction SilentlyContinue)) {',
      "    $metriques[($i.InterfaceIndex.ToString() + '|' + $i.AddressFamily)] = $i.InterfaceMetric",
      '  }',
      '} catch { }',
      'function Get-KjemoMetriqueTotale {',
      '  param($Route)',
      "  $cle = $Route.InterfaceIndex.ToString() + '|' + $Route.AddressFamily",
      '  $mi = 0',
      '  if ($metriques.ContainsKey($cle)) { $mi = $metriques[$cle] }',
      '  return $Route.RouteMetric + $mi',
      '}',
      "",
      '# --- 2. Routes par defaut ------------------------------------------------------------------',
      "$defauts = @($routes | Where-Object { $_.DestinationPrefix -eq '0.0.0.0/0' -or $_.DestinationPrefix -eq '::/0' })",
      'if ($defauts.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Route par defaut' -Controle 'Presence' -Etat 'PROBLEME' -Valeur 'aucune' -Commentaire 'Rien ne sortira du sous-reseau local.')",
      '} else {',
      '  foreach ($d in ($defauts | Sort-Object { Get-KjemoMetriqueTotale $_ })) {',
      '    $tot = Get-KjemoMetriqueTotale $d',
      "    [void](Add-KjemoResultat -Categorie 'Route par defaut' -Controle ($d.DestinationPrefix + ' via ' + $d.NextHop) -Etat 'INFO' -Valeur ('metrique totale ' + $tot) -Commentaire ($d.InterfaceAlias + ' · route ' + $d.RouteMetric))",
      '  }',
      '  if ($defauts.Count -gt 1) {',
      "    [void](Add-KjemoResultat -Categorie 'Route par defaut' -Controle 'Nombre' -Etat 'ATTENTION' -Valeur $defauts.Count -Commentaire 'Plusieurs routes par defaut : une seule sert. Les autres n''interviennent qu''en cas de disparition de la premiere.')",
      '  }',
      '}',
      "",
      '# --- 3. Routes persistantes ------------------------------------------------------------------',
      "# Une route persistante survit au redemarrage. C'est utile, et c'est aussi la",
      "# source des routes oubliees qu'on retrouve des annees plus tard.",
      '$persistantes = @()',
      "try { $persistantes = @(Get-NetRoute -PolicyStore PersistentStore -ErrorAction SilentlyContinue) } catch { }",
      'if ($persistantes.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Persistantes' -Controle 'Routes enregistrees' -Etat 'OK' -Valeur 0 -Commentaire 'Aucune route ne survivra au redemarrage, hors celles posees par DHCP ou par un VPN.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Persistantes' -Controle 'Routes enregistrees' -Etat 'ATTENTION' -Valeur $persistantes.Count -Commentaire 'Ces routes reviennent a chaque demarrage. Verifier qu''elles sont toujours justifiees.')",
      '  foreach ($p in $persistantes) {',
      "    [void](Add-KjemoResultat -Categorie 'Persistantes' -Controle $p.DestinationPrefix -Etat 'INFO' -Valeur ('via ' + $p.NextHop) -Commentaire ('interface ' + $p.InterfaceIndex + ' · metrique ' + $p.RouteMetric))",
      '  }',
      '}',
      "",
      '# --- 4. Collisions ---------------------------------------------------------------------------',
      "# Deux routes pour le MEME prefixe : la machine en choisit une, et le choix",
      "# peut changer. C'est rarement voulu.",
      '$groupes = $routes | Group-Object DestinationPrefix | Where-Object { $_.Count -gt 1 }',
      'if (-not $groupes) {',
      "  [void](Add-KjemoResultat -Categorie 'Collisions' -Controle 'Prefixes en double' -Etat 'OK' -Valeur 0)",
      '} else {',
      '  $n = @($groupes).Count',
      "  [void](Add-KjemoResultat -Categorie 'Collisions' -Controle 'Prefixes en double' -Etat 'ATTENTION' -Valeur $n -Commentaire 'Plusieurs routes pour un meme prefixe. La metrique departage, mais le resultat peut changer au redemarrage si elles sont a egalite.')",
      '  foreach ($g in @($groupes | Select-Object -First 10)) {',
      '    foreach ($r in $g.Group) {',
      '      $tot = Get-KjemoMetriqueTotale $r',
      "      [void](Add-KjemoResultat -Categorie 'Collisions' -Controle $g.Name -Etat 'INFO' -Valeur ('via ' + $r.NextHop + ' — metrique totale ' + $tot) -Commentaire $r.InterfaceAlias)",
      '    }',
      '  }',
      '}',
      "",
      '# --- 5. Quelle route pour CETTE destination ? -------------------------------------------------',
      "# On applique les deux regles, et on montre le raisonnement.",
      '$octets = $Destination.Split(\'.\')',
      '$destEntier = ([int64]$octets[0] * 16777216) + ([int64]$octets[1] * 65536) + ([int64]$octets[2] * 256) + [int64]$octets[3]',
      '$candidates = New-Object System.Collections.ArrayList',
      "foreach ($r in ($routes | Where-Object { $_.AddressFamily -eq 'IPv4' })) {",
      '  $parts = $r.DestinationPrefix.Split(\'/\')',
      '  if ($parts.Count -ne 2) { continue }',
      '  $po = $parts[0].Split(\'.\')',
      '  if ($po.Count -ne 4) { continue }',
      '  $pre = [int]$parts[1]',
      '  $baseEntier = ([int64]$po[0] * 16777216) + ([int64]$po[1] * 65536) + ([int64]$po[2] * 256) + [int64]$po[3]',
      '  # Taille du bloc = 2^(32 - prefixe). Comparaison par bornes, sans operateur',
      '  # binaire signe : 192.x masque par & deviendrait negatif.',
      '  $taille = [Math]::Pow(2, 32 - $pre)',
      '  $debut = [Math]::Floor($baseEntier / $taille) * $taille',
      '  $fin = $debut + $taille - 1',
      '  if ($destEntier -ge $debut -and $destEntier -le $fin) {',
      '    [void]$candidates.Add([PSCustomObject]@{',
      '      Prefixe = $r.DestinationPrefix',
      '      Longueur = $pre',
      '      Passerelle = $r.NextHop',
      '      Carte = $r.InterfaceAlias',
      '      Total = (Get-KjemoMetriqueTotale $r)',
      '    })',
      '  }',
      '}',
      "",
      'if ($candidates.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Decision' -Controle $Destination -Etat 'PROBLEME' -Valeur 'aucune route' -Commentaire 'Aucune route ne couvre cette destination, pas meme une route par defaut.')",
      '} else {',
      '  $classees = @($candidates | Sort-Object -Property @{ Expression = \'Longueur\'; Descending = $true }, @{ Expression = \'Total\'; Descending = $false })',
      '  $gagnante = $classees[0]',
      "  [void](Add-KjemoResultat -Categorie 'Decision' -Controle ('Route retenue pour ' + $Destination) -Etat 'OK' -Valeur ($gagnante.Prefixe + ' via ' + $gagnante.Passerelle) -Commentaire ('carte ' + $gagnante.Carte + ' · prefixe /' + $gagnante.Longueur + ' · metrique totale ' + $gagnante.Total))",
      '  foreach ($c in ($classees | Select-Object -Skip 1)) {',
      "    $raison = 'prefixe plus court : ecartee avant toute comparaison de metrique'",
      "    if ($c.Longueur -eq $gagnante.Longueur) { $raison = 'prefixe egal, metrique totale plus elevee' }",
      "    [void](Add-KjemoResultat -Categorie 'Decision' -Controle ('Ecartee : ' + $c.Prefixe) -Etat 'INFO' -Valeur ('via ' + $c.Passerelle) -Commentaire $raison)",
      '  }',
      '}',
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Table de routage et regles de decision',
      outil: 'route-table-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Destination', psB64(destination)],
        ['Famille', psB64(famille)],
        ['Format', psB64(v.rtFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-routes',
      formats: v.rtFormat,
    });
  },
  gui: [
    '« route print » affiche la table complète ; « route print -4 » se limite à IPv4.',
    '« Get-NetRoute » en PowerShell, avec « -PolicyStore PersistentStore » pour les routes persistantes.',
    'Les routes persistantes sont stockées sous HKLM\\System\\CurrentControlSet\\Services\\Tcpip\\Parameters\\PersistentRoutes.',
    '« Find-NetRoute -RemoteIPAddress 8.8.8.8 » demande à Windows lui-même quelle route il choisirait.',
    'Un VPN monté ajoute ses routes : les comparer avant et après le montage explique la plupart des surprises.',
  ],
  keywords: [
    'table de routage', 'route print', 'get-netroute', 'route par defaut',
    'prefixe le plus long', 'metrique', 'route persistante', 'collision de route',
    'par ou ca passe', 'routage', 'next hop',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation pour la lecture.',
    'Une destination à expliquer : c’est ce qui rend la table lisible plutôt que longue.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le trafic ne prend pas la route attendue malgré une métrique basse',
      cause: 'Une autre route a un préfixe plus long. Elle gagne avant que la métrique soit regardée.',
      fix: 'La section Décision montre laquelle a gagné et pourquoi les autres ont été écartées.',
    },
    {
      message: 'Une route inconnue apparaît dans la table',
      cause: 'Posée par un VPN, un hyperviseur, ou enregistrée comme persistante il y a longtemps.',
      fix: 'La section Persistantes liste ce qui revient à chaque démarrage.',
    },
    {
      message: 'Le chemin change d’un redémarrage à l’autre',
      cause: 'Deux routes identiques à métrique égale : le choix devient imprévisible.',
      fix: 'La section Collisions les signale. Départager par une métrique d’interface.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'La route retenue pour la destination demandée est nommée, avec le préfixe et la métrique totale.',
    'Les routes écartées le sont avec leur raison : préfixe plus court, ou métrique plus élevée.',
    'Les routes persistantes sont listées à part de la table vivante.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit la table et calcule. Il n’y a rien à annuler.',
    diagnostic: '# Demander a Windows quelle route il choisirait.\nFind-NetRoute -RemoteIPAddress \'8.8.8.8\'\nGet-NetRoute -PolicyStore PersistentStore',
    command: '# Rien a annuler : aucune route n\'est ajoutee ni retiree par ce script.\n# Pour ajouter une route, voir l\'assistant dedie, qui sauvegarde avant.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'La table de routage décrit la topologie interne de l’établissement. Rapport interne seulement.',
  },
  checks: [
    'Les deux règles de décision sont appliquées dans l’ordre, et le raisonnement est affiché.',
    'Le calcul d’appartenance à un préfixe se fait par bornes entières, sans opérateur binaire signé.',
    'Aucune route n’est ajoutée, modifiée ni supprimée.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute',
  sources: [
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
    { label: 'Get-NetIPInterface', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipinterface' },
    { label: 'route', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/route_ws2008' },
  ],
};

/**
 * 17. route-manager — préparer l'ajout d'une route, et pouvoir revenir.
 *
 * Trois garde-fous, et le troisième est celui qui compte : la route par défaut
 * n'est jamais touchée sans une confirmation écrite distincte. Supprimer une
 * route par défaut à distance coupe la session et ne la rend pas.
 *
 * L'annulation ne porte QUE sur la route exacte créée par cet assistant :
 * destination, passerelle, interface. Jamais « Remove-NetRoute » sur un
 * préfixe, qui emporterait tout ce qui lui ressemble.
 */
export const outilGestionRoute = {
  id: 'route-manager',
  icon: '⊹',
  category: 'Réseau',
  subcategory: 'Routage et voisinage',
  title: 'Préparer et poser une route statique',
  risk: 'caution',
  summary: 'Prépare l’ajout d’une route explicite : vérifie que la passerelle est joignable et dans le bon sous-réseau, sauvegarde la table, montre l’effet avec -WhatIf, puis pose la route. Refuse la route par défaut sans confirmation écrite distincte, et l’annulation ne porte que sur la route exacte créée.',
  fields: [
    {
      id: 'rmDestination', label: 'Réseau de destination (CIDR)', default: '10.20.30.0/24',
      help: 'Notation CIDR, adresse de réseau exacte. 0.0.0.0/0 est la route par défaut : elle demande une confirmation écrite distincte.',
    },
    {
      id: 'rmPasserelle', label: 'Passerelle (saut suivant)', default: '192.168.30.254',
      help: 'Adresse IPv4 du routeur qui prendra le relais. Elle doit être dans un sous-réseau directement joignable.',
    },
    {
      id: 'rmCarte', label: 'Carte à utiliser', default: 'Ethernet',
      help: 'Nom exact de la carte. La route sera liée à cette interface, et l’annulation aussi.',
    },
    {
      id: 'rmMetrique', label: 'Métrique de la route', default: '1',
      help: 'Entre 1 et 9999. Une métrique basse fait préférer cette route à une autre de même préfixe.',
    },
    {
      id: 'rmPersistante', label: 'Survivre au redémarrage', type: 'select', default: 'Non',
      options: [
        ['Non', 'Non — la route disparaît au redémarrage'],
        ['Oui', 'Oui — route persistante'],
      ],
      help: 'Une route non persistante est le filet le plus simple : si elle casse quelque chose, un redémarrage répare.',
    },
    {
      id: 'rmConfirmationDefaut', label: 'Confirmation pour la route par défaut (facultatif)', default: '',
      help: 'Obligatoire uniquement si la destination est 0.0.0.0/0. Retaper exactement : JE REMPLACE LA ROUTE PAR DEFAUT',
    },
    champMode('Diagnostic vérifie tout et montre l’effet sans rien poser. Appliquer pose la route, après sauvegarde.'),
  ],
  validate(v) {
    const errors = {};
    const dest = String(v.rmDestination ?? '').trim();
    const estDefaut = dest === '0.0.0.0/0';
    if (!estDefaut) {
      verifier(errors, 'rmDestination', validerReseauCidr(dest));
    }
    verifier(errors, 'rmPasserelle', validateIPv4(v.rmPasserelle));
    const carte = String(v.rmCarte ?? '').trim();
    if (carte === '') {
      errors.rmCarte = 'Indique la carte à utiliser.';
    } else if (/["`$;|&<>]/.test(carte)) {
      errors.rmCarte = 'Le nom de la carte ne peut contenir ni guillemet ni caractère de commande.';
    }
    verifier(errors, 'rmMetrique', validerEntier(v.rmMetrique, 1, 9999, 'La métrique'));
    verifier(errors, 'rmPersistante', validerChoix(v.rmPersistante, ['Non', 'Oui'], 'Le choix'));
    const confirmation = String(v.rmConfirmationDefaut ?? '').trim();
    if (estDefaut && confirmation !== 'JE REMPLACE LA ROUTE PAR DEFAUT') {
      errors.rmConfirmationDefaut = 'La route par défaut porte tout le trafic sortant. Pour y toucher, retaper exactement : JE REMPLACE LA ROUTE PAR DEFAUT';
    }
    verifier(errors, 'mode', validerModeExecution(v.mode));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const dest = String(v.rmDestination ?? '').trim();
    const estDefaut = dest === '0.0.0.0/0';
    const destination = estDefaut ? '0.0.0.0/0' : validerReseauCidr(dest).value.reseau + '/' + validerReseauCidr(dest).value.prefixe;
    const passerelle = validateIPv4(v.rmPasserelle).value;
    const carte = String(v.rmCarte ?? '').trim();
    const metrique = validerEntier(v.rmMetrique, 1, 9999).value;
    const persistante = validerChoix(v.rmPersistante, ['Non', 'Oui']).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Destination = ${psB64(destination)}`,
      `$Passerelle = ${psB64(passerelle)}`,
      `$Carte = ${psB64(carte)}`,
      `$Metrique = ${metrique}`,
      `$Persistante = ${psB64(persistante)}`,
      `$EstRouteParDefaut = ${estDefaut ? '$true' : '$false'}`,
      // La confirmation renforcée de la route par défaut est exigée par le
      // formulaire : elle ne peut pas arriver jusqu'ici sans avoir été tapée.
      // Elle est tout de même portée dans le script, et entre dans les
      // conditions du mode Appliquer, pour qu'un script relu hors du site
      // montre lui aussi pourquoi il accepte ou refuse.
      `$ConfirmationOk = ${estDefaut ? (String(v.rmConfirmationDefaut ?? '').trim() === 'JE REMPLACE LA ROUTE PAR DEFAUT' ? '$true' : '$false') : '$true'}`,
      "$KjemoFormat = 'Console'",
      "",
      blocContexteReseau(),
      "",
      '# --- Avertissement ----------------------------------------------------------------------',
      'if ($EstRouteParDefaut) {',
      "  Write-Host ''",
      "  Write-Host '--- ATTENTION : route par defaut ---'",
      "  Write-Host 'La destination demandee est 0.0.0.0/0 : la route par defaut. Elle porte'",
      "  Write-Host 'TOUT le trafic sortant. Sur une machine distante, une erreur ici coupe la'",
      "  Write-Host 'session et ne la rend pas.'",
      "  [void](Add-KjemoResultat -Categorie 'Avertissement' -Controle 'Route par defaut' -Etat 'ATTENTION' -Valeur $Destination -Commentaire 'Une confirmation ecrite distincte a ete exigee par le formulaire.')",
      '}',
      "",
      '# --- 1. La carte existe-t-elle ? ------------------------------------------------------------',
      '$adaptateur = $null',
      'try { $adaptateur = Get-NetAdapter -Name $Carte -ErrorAction SilentlyContinue } catch { }',
      'if (-not $adaptateur) {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Carte' -Etat 'PROBLEME' -Valeur $Carte -Commentaire 'Carte introuvable.')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Carte' -Etat 'OK' -Valeur ($adaptateur.Name + ' — ' + $adaptateur.Status) -Commentaire ('index ' + $adaptateur.ifIndex))",
      '}',
      "",
      '# --- 2. La passerelle est-elle utilisable ? ---------------------------------------------------',
      "# Une passerelle hors d'un sous-reseau directement joignable produit une route",
      "# qui ne fonctionne pas : Windows l'accepte parfois, et le trafic disparait.",
      '# Appartenance a un prefixe, par arithmetique entiere.',
      '#',
      "# Les operateurs binaires de PowerShell sont signes, et [int] deborde a",
      '# 4294967295 : un masque construit par decalage donne un resultat negatif',
      "# des que le premier octet depasse 127. Le calcul se fait donc en [int64],",
      '# par multiplications et divisions entieres. Aucun decalage, aucun -band.',
      '#',
      '# Un prefixe qui ne tombe pas sur une frontiere d\'octet — /9, /17, /23,',
      '# /25, /30, /31 — est le cas qui compte : une comparaison octet par octet',
      '# le traite de travers, et le defaut reste invisible en /24.',
      'function Test-KjemoMemePrefixe {',
      '  [CmdletBinding()] param([string]$Adresse, [string]$Autre, [int]$Prefixe)',
      '  if ($Prefixe -lt 0 -or $Prefixe -gt 32) { return $false }',
      "  $a = ([string]$Adresse).Split('.')",
      "  $b = ([string]$Autre).Split('.')",
      '  if ($a.Count -ne 4 -or $b.Count -ne 4) { return $false }',
      '  $va = [int64]0',
      '  $vb = [int64]0',
      '  for ($k = 0; $k -lt 4; $k++) {',
      '    $oa = 0',
      '    $ob = 0',
      '    if (-not [int]::TryParse($a[$k], [ref]$oa)) { return $false }',
      '    if (-not [int]::TryParse($b[$k], [ref]$ob)) { return $false }',
      '    if ($oa -lt 0 -or $oa -gt 255 -or $ob -lt 0 -or $ob -gt 255) { return $false }',
      '    $va = $va * 256 + $oa',
      '    $vb = $vb * 256 + $ob',
      '  }',
      '  if ($Prefixe -eq 0) { return $true }',
      '  $taille = [int64][Math]::Pow(2, 32 - $Prefixe)',
      '  return ([int64][Math]::Floor($va / $taille)) -eq ([int64][Math]::Floor($vb / $taille))',
      '}',
      "",
      '$adresses = @()',
      "try { $adresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -eq $Carte }) } catch { }",
      '$joignableDirectement = $false',
      '$prefixesCarte = @()',
      'foreach ($a in $adresses) {',
      "  $prefixesCarte += ([string]$a.IPAddress + '/' + [string]$a.PrefixLength)",
      '  if (Test-KjemoMemePrefixe -Adresse ([string]$a.IPAddress) -Autre $Passerelle -Prefixe ([int]$a.PrefixLength)) {',
      '    $joignableDirectement = $true',
      '  }',
      '}',
      'if ($adresses.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Passerelle' -Controle 'Sous-reseau' -Etat 'PROBLEME' -Valeur ('aucune adresse IPv4 sur ' + $Carte) -Commentaire 'Sans adresse sur la carte, aucun prefixe n''est directement connecte : la passerelle ne peut pas etre jointe par cette interface.')",
      '} elseif ($joignableDirectement) {',
      "  [void](Add-KjemoResultat -Categorie 'Passerelle' -Controle 'Sous-reseau' -Etat 'OK' -Valeur ($Passerelle + ' joignable directement par ' + $Carte) -Commentaire ('Prefixe(s) directement connecte(s) : ' + ($prefixesCarte -join ', ') + '.'))",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Passerelle' -Controle 'Sous-reseau' -Etat 'PROBLEME' -Valeur ($Passerelle + ' hors des sous-reseaux de ' + $Carte) -Commentaire ('Une passerelle qui n''est pas directement joignable produit une route qui ne fonctionne pas, et le trafic disparait sans message. Correction attendue : choisir une passerelle appartenant a l''un des prefixes de la carte (' + ($prefixesCarte -join ', ') + '), ou poser la route sur la carte qui porte le bon prefixe.'))",
      '}',
      "# L'echo est une INDICATION, jamais une condition. Un routeur peut refuser",
      '# ICMP et router parfaitement : en faire un prealable interdirait des poses',
      '# legitimes, et le laisser decider serait un faux filet.',
      '$echo = $null',
      'try { $echo = Test-Connection -ComputerName $Passerelle -Count 2 -ErrorAction SilentlyContinue } catch { }',
      "[void](Add-KjemoResultat -Categorie 'Passerelle' -Controle 'Echo' -Etat 'INFO' -Valeur (& { if ($echo) { 'repond' } else { 'pas de reponse' } }) -Commentaire 'Indication seule, non probante et non bloquante : un routeur qui ne repond pas a l''echo peut router correctement, et un routeur qui y repond peut ne pas router.')",
      "",
      '# --- 3. La route existe-t-elle deja ? ----------------------------------------------------------',
      '$existantes = @()',
      'try { $existantes = @(Get-NetRoute -DestinationPrefix $Destination -ErrorAction SilentlyContinue) } catch { }',
      'if ($existantes.Count -gt 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Routes deja presentes' -Etat 'ATTENTION' -Valeur $existantes.Count -Commentaire 'Ce prefixe est deja route. La nouvelle route entrera en concurrence : la metrique departagera.')",
      '  foreach ($e in $existantes) {',
      "    [void](Add-KjemoResultat -Categorie 'Avant' -Controle ($e.DestinationPrefix + ' via ' + $e.NextHop) -Etat 'INFO' -Valeur ('metrique ' + $e.RouteMetric) -Commentaire $e.InterfaceAlias)",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Avant' -Controle 'Routes deja presentes' -Etat 'OK' -Valeur 0)",
      '}',
      "",
      '# --- 4. Sauvegarde de la table -------------------------------------------------------------------',
      "# Avant toute ecriture : la table complete sur disque. Ce n'est pas une",
      "# sauvegarde qui se restaure d'un clic, mais c'est la trace de l'etat d'avant.",
      '$sauvegarde = Join-Path $env:TEMP ("kjemo-routes-" + (Get-Date -Format \'yyyyMMdd-HHmmss\') + ".csv")',
      '$sauvegardeOk = $false',
      'try {',
      '  Get-NetRoute -ErrorAction Stop |',
      '    Select-Object DestinationPrefix,NextHop,InterfaceAlias,InterfaceIndex,RouteMetric,AddressFamily,Protocol |',
      '    Export-Csv -LiteralPath $sauvegarde -NoTypeInformation -Encoding UTF8 -ErrorAction Stop',
      '  $sauvegardeOk = Test-Path -LiteralPath $sauvegarde',
      '} catch { }',
      'if ($sauvegardeOk) {',
      "  [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Table enregistree' -Etat 'OK' -Valeur $sauvegarde)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Sauvegarde' -Controle 'Table enregistree' -Etat 'PROBLEME' -Valeur 'echec' -Commentaire 'Sans sauvegarde, la route ne sera pas posee.')",
      '}',
      "",
      '# --- 5. Apercu : ce que la commande ferait --------------------------------------------------------',
      "# -WhatIf demande a PowerShell lui-meme de decrire l'action. Ce n'est pas une",
      "# description ecrite a la main : c'est la commande qui parle.",
      'if ($adaptateur) {',
      "  Write-Host ''",
      "  Write-Host '--- Apercu (-WhatIf) ---'",
      '  try {',
      "    if ($Persistante -eq 'Oui') {",
      '      New-NetRoute -DestinationPrefix $Destination -NextHop $Passerelle -InterfaceIndex $adaptateur.ifIndex -RouteMetric $Metrique -PolicyStore PersistentStore -WhatIf',
      '    } else {',
      '      New-NetRoute -DestinationPrefix $Destination -NextHop $Passerelle -InterfaceIndex $adaptateur.ifIndex -RouteMetric $Metrique -WhatIf',
      '    }',
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Apercu' -Controle '-WhatIf' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '  }',
      '}',
      "",
      '# --- 6. La commande d\'annulation, ecrite avant -----------------------------------------------------',
      "# Elle porte la route EXACTE : destination, passerelle ET interface. Jamais",
      "# « Remove-NetRoute -DestinationPrefix » seul, qui emporterait toutes les",
      '# routes de ce prefixe, y compris celles posees par quelqu\'un d\'autre.',
      '$annulationConstruite = $false',
      'if ($adaptateur) {',
      '  $annulation = "Remove-NetRoute -DestinationPrefix \'$Destination\' -NextHop \'$Passerelle\' -InterfaceIndex $($adaptateur.ifIndex) -Confirm"',
      "  if ($Persistante -eq 'Oui') {",
      '    $annulation = $annulation + " ; Remove-NetRoute -DestinationPrefix \'$Destination\' -NextHop \'$Passerelle\' -InterfaceIndex $($adaptateur.ifIndex) -PolicyStore PersistentStore -Confirm"',
      '  }',
      "  Write-Host ''",
      "  Write-Host '--- Commande d''annulation, a garder ---'",
      '  Write-Host ("    " + $annulation)',
      "  [void](Add-KjemoResultat -Categorie 'Annulation' -Controle 'Commande exacte' -Etat 'INFO' -Valeur $annulation -Commentaire 'Elle vise la route exacte : destination, passerelle ET interface. Elle n''emporte rien d''autre.')",
      "  if (-not [string]::IsNullOrWhiteSpace($annulation)) { $annulationConstruite = $true }",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie 'Annulation' -Controle 'Commande exacte' -Etat 'PROBLEME' -Valeur 'non construite' -Commentaire 'Sans index d''interface, l''annulation ne pourrait viser que le prefixe — et emporterait les routes posees par d''autres. Le script prefere ne rien poser.')",
      '}',
      "",
      '# --- 7. Poser la route -----------------------------------------------------------------------------',
      '# Cinq conditions, toutes necessaires, verifiees ensemble :',
      '#   carte trouvee ; passerelle appartenant a un prefixe DIRECTEMENT',
      "#   connecte a cette carte ; sauvegarde de la table reussie ; commande",
      '#   d\'annulation construite ; confirmations deja exigees satisfaites.',
      "# L'echo ICMP n'en fait pas partie, et c'est voulu.",
      '$conditionsAppliquer = ($null -ne $adaptateur) -and $joignableDirectement -and $sauvegardeOk -and $annulationConstruite -and $ConfirmationOk',
      "if ($Mode -eq 'Appliquer' -and -not $conditionsAppliquer) {",
      '  $manquants = @()',
      "  if ($null -eq $adaptateur) { $manquants += 'carte introuvable' }",
      "  if (-not $joignableDirectement) { $manquants += 'passerelle ' + $Passerelle + ' hors de tout prefixe directement connecte a ' + $Carte }",
      "  if (-not $sauvegardeOk) { $manquants += 'sauvegarde de la table en echec' }",
      "  if (-not $annulationConstruite) { $manquants += 'commande d''annulation non construite' }",
      "  if (-not $ConfirmationOk) { $manquants += 'confirmation ecrite de la route par defaut absente' }",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Conditions prealables' -Etat 'PROBLEME' -Valeur ($manquants -join ' ; ') -Commentaire 'Le mode Appliquer exige les cinq conditions a la fois. Au moins une manque.')",
      "  [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Route posee' -Etat 'IGNORE' -Valeur 'bloquee' -Commentaire 'New-NetRoute n''a pas ete appele. La table de routage est exactement celle d''avant.')",
      "  Write-Host ''",
      "  Write-Host '--- Pose BLOQUEE ---'",
      '  foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      '  if (-not $joignableDirectement) {',
      "    Write-Host '  Correction attendue : choisir une passerelle appartenant a l''un des'",
      "    Write-Host '  prefixes de la carte, ou poser la route sur la carte qui porte le bon'",
      "    Write-Host '  prefixe. Prefixe(s) de cette carte :'",
      '    foreach ($p in $prefixesCarte) { Write-Host ("    " + $p) }',
      '  }',
      "  Write-Host '  Aucune ecriture n''a ete tentee.'",
      "} elseif ($Mode -eq 'Appliquer') {",
      '  try {',
      "    if ($Persistante -eq 'Oui') {",
      '      New-NetRoute -DestinationPrefix $Destination -NextHop $Passerelle -InterfaceIndex $adaptateur.ifIndex -RouteMetric $Metrique -PolicyStore PersistentStore -ErrorAction Stop | Out-Null',
      '    } else {',
      '      New-NetRoute -DestinationPrefix $Destination -NextHop $Passerelle -InterfaceIndex $adaptateur.ifIndex -RouteMetric $Metrique -ErrorAction Stop | Out-Null',
      '    }',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Route posee' -Etat 'OK' -Valeur ($Destination + ' via ' + $Passerelle))",
      '  } catch {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Route posee' -Etat 'PROBLEME' -Valeur $_.Exception.Message -Commentaire 'La table est intacte, et la sauvegarde est sur disque.')",
      '  }',
      '  $relue = @()',
      '  try { $relue = @(Get-NetRoute -DestinationPrefix $Destination -ErrorAction SilentlyContinue | Where-Object { $_.NextHop -eq $Passerelle }) } catch { }',
      "  [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Route relue' -Etat (& { if ($relue.Count -gt 0) { 'OK' } else { 'PROBLEME' } }) -Valeur $relue.Count)",
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      '  if ($conditionsAppliquer) {',
      "    Write-Host 'Les cinq conditions sont reunies. En mode Appliquer, le script poserait'",
      "    Write-Host 'la route telle que l''apercu -WhatIf l''a decrite, puis la relirait.'",
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'INFO' -Valeur 'passerait' -Commentaire 'Carte trouvee, passerelle directement joignable, table sauvegardee, annulation construite, confirmations satisfaites.')",
      '  } else {',
      '    $manquants = @()',
      "    if ($null -eq $adaptateur) { $manquants += 'carte introuvable' }",
      "    if (-not $joignableDirectement) { $manquants += 'passerelle ' + $Passerelle + ' hors de tout prefixe directement connecte a ' + $Carte }",
      "    if (-not $sauvegardeOk) { $manquants += 'sauvegarde de la table en echec' }",
      "    if (-not $annulationConstruite) { $manquants += 'commande d''annulation non construite' }",
      "    if (-not $ConfirmationOk) { $manquants += 'confirmation ecrite de la route par defaut absente' }",
      "    Write-Host 'En mode Appliquer, le script SERAIT BLOQUE et ne poserait rien.'",
      "    Write-Host 'Ce qui manque :'",
      '    foreach ($m in $manquants) { Write-Host ("  - " + $m) }',
      "    [void](Add-KjemoResultat -Categorie 'Simulation' -Controle 'Mode Appliquer' -Etat 'PROBLEME' -Valeur ('serait bloque : ' + ($manquants -join ' ; ')) -Commentaire 'En l''etat, passer en mode Appliquer ne poserait aucune route.')",
      '  }',
      '}',
      blocModeDiagnostic(),
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Pose d\'une route statique',
      outil: 'route-manager',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Mode', psB64(v.mode)],
        ['Destination', psB64(destination)],
        ['Passerelle', psB64(passerelle)],
        ['Carte', psB64(carte)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-route-pose',
      formats: 'Console',
    });
  },
  gui: [
    '« route add 10.20.30.0 mask 255.255.255.0 192.168.30.254 metric 1 » pose une route temporaire.',
    'Ajouter « -p » la rend persistante : « route -p add … ». C’est ce « -p » qu’on oublie, ou qu’on met par erreur.',
    '« route delete 10.20.30.0 » la retire, mais emporte toutes les routes de ce préfixe.',
    'PowerShell : « New-NetRoute » et « Remove-NetRoute », qui acceptent -NextHop et -InterfaceIndex pour viser précisément.',
    'Sur un parc, une route statique poste par poste est rarement la bonne réponse : c’est au routeur de router.',
  ],
  keywords: [
    'route statique', 'new-netroute', 'route add', 'remove-netroute',
    'route persistante', 'passerelle', 'metrique', 'whatif', 'annulation',
    'route par defaut', 'sous-reseau distant',
  ],
  requiresAdmin: true,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Droits d’administrateur local : ajouter une route en demande.',
    'Une passerelle directement joignable depuis la carte choisie.',
    'Noter la commande d’annulation écrite par le script avant qu’il agisse.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'La route est ajoutée mais le trafic ne passe pas',
      cause: 'La passerelle n’est pas directement joignable depuis la carte choisie.',
      fix: 'La section Passerelle le vérifie avant d’agir. Une passerelle hors sous-réseau donne une route inerte.',
    },
    {
      message: 'La route disparaît au redémarrage',
      cause: 'Elle n’était pas persistante.',
      fix: 'C’est souvent voulu : une route non persistante est le filet le plus simple. Passer « Survivre au redémarrage » à Oui si elle doit rester.',
    },
    {
      message: 'Remove-NetRoute a supprimé plus que prévu',
      cause: 'La commande visait un préfixe sans préciser la passerelle ni l’interface.',
      fix: 'L’annulation écrite par cet assistant précise les trois. C’est exactement pour cela.',
    },
    {
      message: 'Accès refusé',
      cause: 'La session n’est pas élevée.',
      fix: 'Relancer PowerShell en tant qu’administrateur.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'La table a été sauvegardée sur disque avant toute écriture, et le chemin du fichier figure dans le rapport.',
    'L’aperçu -WhatIf a décrit l’action avant qu’elle soit faite.',
    'La commande d’annulation vise destination, passerelle ET interface.',
    'Après pose, la route est relue et comptée.',
  ],
  rollback: {
    summary: 'L’annulation est écrite par le script, et elle ne vise que la route exacte qu’il a créée. La table complète d’avant est également sur disque, en CSV.',
    diagnostic: '# Les routes de ce prefixe, avec leur passerelle et leur interface.\nGet-NetRoute -DestinationPrefix \'<prefixe>\' | Format-Table DestinationPrefix,NextHop,InterfaceIndex,RouteMetric',
    command: '# Retirer UNIQUEMENT la route creee : les trois criteres sont necessaires.\nRemove-NetRoute -DestinationPrefix \'<prefixe>\' -NextHop \'<passerelle>\' -InterfaceIndex <index> -Confirm\n\n# Si elle etait persistante, la retirer aussi du magasin persistant.\nRemove-NetRoute -DestinationPrefix \'<prefixe>\' -NextHop \'<passerelle>\' -InterfaceIndex <index> -PolicyStore PersistentStore -Confirm',
    exceptional: 'AVERTISSEMENT CRITIQUE — supprimer la route par défaut (0.0.0.0/0) coupe tout le trafic sortant de la machine, immédiatement. Sur une machine distante, la session tombe et ne revient pas : il faut un accès console ou physique pour réparer. Cet assistant exige une confirmation écrite distincte pour y toucher, et ne la supprime jamais de lui-même : https://learn.microsoft.com/powershell/module/nettcpip/remove-netroute',
    warning: 'Une route posée à distance peut détourner la session en cours. Poser d’abord une route non persistante : un redémarrage répare.',
  },
  checks: [
    'La passerelle est vérifiée joignable et dans le bon sous-réseau avant toute écriture.',
    'La table est sauvegardée en CSV avant d’agir, et rien n’est posé si la sauvegarde échoue.',
    'La route par défaut exige une confirmation écrite distincte.',
    'L’annulation vise la route exacte, jamais un préfixe entier.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netroute',
  sources: [
    { label: 'New-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netroute' },
    { label: 'Remove-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/remove-netroute' },
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
  ],
};
/**
 * 18. arp-neighbor-diagnostic — le voisinage, et une entrée à la fois.
 *
 * Vider toute la table ARP est le réflexe qu'on trouve partout, et c'est
 * presque toujours excessif : la machine perd d'un coup la résolution de
 * niveau 2 vers tous ses voisins, y compris sa passerelle, et le temps de
 * tout réapprendre on croit avoir réparé quelque chose.
 *
 * Ici, le renouvellement est CIBLÉ. Une entrée, nommée.
 */
export const outilDiagnosticArp = {
  id: 'arp-neighbor-diagnostic',
  icon: '⋈',
  category: 'Réseau',
  subcategory: 'Routage et voisinage',
  title: 'Diagnostiquer le voisinage ARP et IPv6',
  risk: 'caution',
  summary: 'Relève la table de voisinage IPv4 et IPv6 avec l’état de chaque entrée, et sait renouveler UNE entrée nommée. Ne vide jamais toute la table : la machine y perdrait la résolution vers tous ses voisins, passerelle comprise.',
  fields: [
    {
      id: 'arpAdresse', label: 'Adresse à examiner (facultatif)', default: '',
      help: 'Une adresse précise. Vide : toute la table est relevée, en lecture seule.',
    },
    {
      id: 'arpFamille', label: 'Famille d’adresses', type: 'select', default: 'IPv4',
      options: [
        ['IPv4', 'IPv4 — table ARP'],
        ['IPv6', 'IPv6 — découverte de voisins'],
        ['Les deux', 'Les deux'],
      ],
      help: 'IPv4 utilise ARP, IPv6 la découverte de voisins. Les états portent les mêmes noms.',
    },
    champMode('Diagnostic relève la table. Appliquer renouvelle l’entrée nommée — et seulement elle.'),
  ],
  validate(v) {
    const errors = {};
    const adr = String(v.arpAdresse ?? '').trim();
    if (adr !== '') {
      const r = adr.includes(':') ? validerIPv6(adr) : validateIPv4(adr);
      if (!r.ok) errors.arpAdresse = r.error;
    }
    verifier(errors, 'arpFamille', validerChoix(v.arpFamille, ['IPv4', 'IPv6', 'Les deux'], 'La famille'));
    verifier(errors, 'mode', validerModeExecution(v.mode));
    // Renouveler demande de savoir QUOI renouveler.
    if (String(v.mode ?? '').trim() === 'Appliquer' && adr === '') {
      errors.arpAdresse = 'Pour renouveler, nommer l’adresse. Cet assistant ne vide jamais toute la table : la machine y perdrait la résolution vers tous ses voisins, passerelle comprise.';
    }
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const adresse = String(v.arpAdresse ?? '').trim();
    const famille = validerChoix(v.arpFamille, ['IPv4', 'IPv6', 'Les deux']).value;

    const corps = [
      `$Mode = ${psB64(v.mode)}`,
      `$Adresse = ${psB64(adresse)}`,
      `$Famille = ${psB64(famille)}`,
      "$KjemoFormat = 'Console'",
      "",
      blocContexteReseau(),
      "",
      '# --- Ce que les etats veulent dire -----------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Lire les etats du voisinage ---'",
      "Write-Host 'Reachable   : la machine a recemment echange avec ce voisin. Tout va bien.'",
      "Write-Host 'Stale       : l''entree est connue mais vieillit. Elle sera verifiee au'",
      "Write-Host '              prochain usage. Ce n''est PAS une panne.'",
      "Write-Host 'Incomplete  : une resolution est en cours et n''a pas abouti. Le voisin ne'",
      "Write-Host '              repond pas : eteint, autre VLAN, ou adresse fausse.'",
      "Write-Host 'Unreachable : la resolution a echoue. Meme lecture qu''Incomplete.'",
      "Write-Host 'Permanent   : entree posee a la main. Elle ne s''actualise jamais, et'",
      "Write-Host '              survit a un changement de carte chez le voisin.'",
      "",
      '# --- 1. La table -------------------------------------------------------------------------',
      '$voisins = @()',
      'try {',
      '  $voisins = @(Get-NetNeighbor -ErrorAction SilentlyContinue)',
      "  if ($Famille -eq 'IPv4') { $voisins = @($voisins | Where-Object { $_.AddressFamily -eq 'IPv4' }) }",
      "  elseif ($Famille -eq 'IPv6') { $voisins = @($voisins | Where-Object { $_.AddressFamily -eq 'IPv6' }) }",
      "  if ($Adresse -ne '') { $voisins = @($voisins | Where-Object { $_.IPAddress -eq $Adresse }) }",
      '} catch { }',
      "",
      "[void](Add-KjemoResultat -Categorie 'Voisinage' -Controle 'Entrees relevees' -Etat 'INFO' -Valeur $voisins.Count)",
      "",
      '$incompletes = 0',
      '$permanentes = 0',
      'foreach ($n in ($voisins | Sort-Object InterfaceAlias, IPAddress | Select-Object -First 200)) {',
      "  $etat = 'INFO'",
      "  $note = ''",
      "  switch ($n.State) {",
      "    'Reachable'   { $etat = 'OK' }",
      "    'Stale'       { $etat = 'INFO' ; $note = 'Vieillissante : sera verifiee au prochain usage. Pas une panne.' }",
      "    'Incomplete'  { $etat = 'PROBLEME' ; $note = 'Resolution sans reponse : voisin eteint, autre VLAN, ou adresse fausse.' ; $incompletes++ }",
      "    'Unreachable' { $etat = 'PROBLEME' ; $note = 'Resolution echouee.' ; $incompletes++ }",
      "    'Permanent'   { $etat = 'ATTENTION' ; $note = 'Entree posee a la main : elle ne s''actualisera jamais, meme si le voisin change de carte.' ; $permanentes++ }",
      '    default       { $etat = \'INFO\' }',
      '  }',
      "  [void](Add-KjemoResultat -Categorie ('Voisinage — ' + $n.InterfaceAlias) -Controle $n.IPAddress -Etat $etat -Valeur ($n.LinkLayerAddress + ' — ' + $n.State) -Commentaire $note)",
      '}',
      'if ($voisins.Count -gt 200) {',
      "  [void](Add-KjemoResultat -Categorie 'Voisinage' -Controle 'Affichage tronque' -Etat 'INFO' -Valeur ('200 entrees sur ' + $voisins.Count))",
      '}',
      "",
      "[void](Add-KjemoResultat -Categorie 'Bilan' -Controle 'Entrees sans reponse' -Etat (& { if ($incompletes -gt 0) { 'ATTENTION' } else { 'OK' } }) -Valeur $incompletes)",
      "[void](Add-KjemoResultat -Categorie 'Bilan' -Controle 'Entrees permanentes' -Etat (& { if ($permanentes -gt 0) { 'ATTENTION' } else { 'OK' } }) -Valeur $permanentes -Commentaire 'Une entree permanente oubliee survit a un remplacement de materiel et route vers une carte qui n''existe plus.')",
      "",
      '# --- 2. Doublons d\'adresse MAC -------------------------------------------------------------',
      "# Deux adresses IP qui repondent avec la MEME adresse MAC : routeur qui repond",
      "# pour autrui (proxy ARP), machine a deux adresses, ou usurpation. Les trois",
      '# existent, et il faut regarder.',
      '$parMac = $voisins | Where-Object { $_.LinkLayerAddress } | Group-Object LinkLayerAddress | Where-Object { $_.Count -gt 1 }',
      'if (-not $parMac) {',
      "  [void](Add-KjemoResultat -Categorie 'Doublons' -Controle 'Adresses MAC partagees' -Etat 'OK' -Valeur 0)",
      '} else {',
      '  foreach ($g in @($parMac | Select-Object -First 10)) {',
      "    $ips = ($g.Group | Select-Object -ExpandProperty IPAddress) -join ', '",
      "    [void](Add-KjemoResultat -Categorie 'Doublons' -Controle $g.Name -Etat 'ATTENTION' -Valeur $ips -Commentaire 'Plusieurs adresses IP pour une meme carte : routeur en proxy ARP, machine multi-adressee, ou usurpation. A regarder, pas a conclure.')",
      '  }',
      '}',
      "",
      '# --- 3. Renouveler UNE entree ---------------------------------------------------------------',
      "# Remove-NetNeighbor sur une adresse precise force une nouvelle resolution a la",
      "# prochaine utilisation. C'est cible, et c'est reversible par nature : l'entree",
      '# se reconstruit toute seule.',
      "if ($Mode -eq 'Appliquer' -and $Adresse -ne '') {",
      '  $avant = $null',
      '  try { $avant = Get-NetNeighbor -IPAddress $Adresse -ErrorAction SilentlyContinue | Select-Object -First 1 } catch { }',
      '  if (-not $avant) {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Renouvellement' -Etat 'IGNORE' -Valeur 'aucune entree' -Commentaire 'Rien a renouveler pour cette adresse.')",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Entree avant' -Etat 'INFO' -Valeur ($avant.LinkLayerAddress + ' — ' + $avant.State))",
      '    try {',
      '      Remove-NetNeighbor -IPAddress $Adresse -InterfaceIndex $avant.InterfaceIndex -Confirm:$true -ErrorAction Stop',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Renouvellement' -Etat 'OK' -Valeur $Adresse -Commentaire 'Entree retiree : elle sera reapprise au prochain echange. Les autres voisins ne sont pas touches.')",
      '    } catch {',
      "      [void](Add-KjemoResultat -Categorie 'Action' -Controle 'Renouvellement' -Etat 'PROBLEME' -Valeur $_.Exception.Message)",
      '    }',
      '    # Provoquer la reapprentissage, puis relire.',
      '    try { [void](Test-Connection -ComputerName $Adresse -Count 1 -ErrorAction SilentlyContinue) } catch { }',
      '    $apres = $null',
      '    try { $apres = Get-NetNeighbor -IPAddress $Adresse -ErrorAction SilentlyContinue | Select-Object -First 1 } catch { }',
      '    if ($apres) {',
      "      $change = ($apres.LinkLayerAddress -ne $avant.LinkLayerAddress)",
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Entree apres' -Etat (& { if ($change) { 'ATTENTION' } else { 'OK' } }) -Valeur ($apres.LinkLayerAddress + ' — ' + $apres.State) -Commentaire (& { if ($change) { 'L''adresse MAC a CHANGE apres renouvellement : l''ancienne entree etait perimee, ou deux cartes se disputent cette adresse.' } else { 'Meme carte qu''avant : l''entree etait correcte.' } }))",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'Verification' -Controle 'Entree apres' -Etat 'ATTENTION' -Valeur 'non reapprise' -Commentaire 'Le voisin n''a pas repondu : il est peut-etre reellement absent.')",
      '    }',
      '  }',
      '} else {',
      "  Write-Host ''",
      "  Write-Host '--- Simulation ---'",
      "  if ($Adresse -eq '') {",
      "    Write-Host 'Aucune adresse n''est nommee : en mode Appliquer, le formulaire refuserait.'",
      "    Write-Host 'Cet assistant ne vide jamais toute la table.'",
      '  } else {',
      "    Write-Host (\"En mode Appliquer, l''entree \" + $Adresse + \" serait retiree puis reapprise.\")",
      "    Write-Host 'Les autres voisins ne seraient pas touches.'",
      '  }',
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Pourquoi pas « arp -d * » ---'",
      "Write-Host 'Vider toute la table fait perdre d''un coup la resolution de niveau 2 vers'",
      "Write-Host 'TOUS les voisins, passerelle comprise. Le temps que tout se reapprenne, on'",
      "Write-Host 'croit avoir repare quelque chose. Une entree ciblee suffit, et dit quelque'",
      "Write-Host 'chose : si la MAC change apres renouvellement, l''ancienne etait perimee.'",
      blocModeDiagnostic(),
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Voisinage ARP et decouverte de voisins IPv6',
      outil: 'arp-neighbor-diagnostic',
      diagnostic: v.mode !== 'Appliquer',
      admin: true,
      parametres: [
        ['Mode', psB64(v.mode)],
        ['Adresse', psB64(adresse)],
        ['Famille', psB64(famille)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-arp',
      formats: 'Console',
    });
  },
  gui: [
    '« arp -a » affiche la table IPv4 ; « netsh interface ipv6 show neighbors » l’équivalent IPv6.',
    '« arp -d <adresse> » retire une entrée précise. « arp -d * » vide tout, et c’est rarement ce qu’il faut.',
    'PowerShell : « Get-NetNeighbor » et « Remove-NetNeighbor -IPAddress <adresse> ».',
    'Une entrée permanente se pose avec « netsh interface ipv4 add neighbors » — et s’oublie facilement.',
    'Sur le commutateur, la table d’adresses MAC dit sur quel port chaque adresse apparaît : c’est la source de vérité.',
  ],
  keywords: [
    'arp', 'voisinage', 'neighbor', 'adresse mac', 'incomplete', 'stale',
    'reachable', 'remove-netneighbor', 'cache arp', 'proxy arp', 'entree permanente',
    'decouverte de voisins', 'ipv6',
  ],
  requiresAdmin: true,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'La lecture ne demande rien ; retirer une entrée demande des droits d’administrateur.',
    'Être sur le même segment que l’adresse examinée : le voisinage n’apprend que ce qui est en niveau 2.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Une entrée reste « Incomplete »',
      cause: 'Le voisin ne répond pas : éteint, sur un autre VLAN, ou l’adresse n’existe pas.',
      fix: 'Vérifier que l’adresse est bien dans le sous-réseau local. Une adresse hors sous-réseau ne se résout jamais en ARP.',
    },
    {
      message: 'Deux adresses IP partagent la même adresse MAC',
      cause: 'Un routeur répond pour autrui (proxy ARP), une machine porte deux adresses, ou quelqu’un usurpe.',
      fix: 'Les trois existent. Regarder sur le commutateur quel port annonce cette MAC.',
    },
    {
      message: 'L’adresse MAC change après renouvellement',
      cause: 'L’ancienne entrée était périmée, ou deux cartes se disputent l’adresse.',
      fix: 'Le rapport le signale. Croiser avec l’assistant de recherche de conflit d’adresse.',
    },
    {
      message: 'Une entrée permanente pointe vers du matériel remplacé',
      cause: 'Une entrée posée à la main ne s’actualise jamais.',
      fix: 'Le rapport compte les entrées permanentes. Les retirer une à une après vérification.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'L’entrée renouvelée est relue, et le rapport dit si l’adresse MAC a changé.',
    'Les autres voisins ne figurent pas dans la section Action : ils n’ont pas été touchés.',
    'Les entrées permanentes sont comptées à part.',
  ],
  rollback: {
    summary: 'Une entrée de voisinage retirée se reconstruit toute seule au prochain échange. Il n’y a rien à restaurer — c’est pour cela que le renouvellement ciblé est sûr, là où vider toute la table ne l’est pas.',
    diagnostic: '# L\'entree actuelle pour une adresse.\nGet-NetNeighbor -IPAddress \'<adresse>\' | Format-Table InterfaceAlias,LinkLayerAddress,State',
    command: '# Il n\'y a pas d\'annulation : l\'entree se reapprend seule.\n# Pour provoquer le reapprentissage immediatement :\nTest-Connection -ComputerName \'<adresse>\' -Count 1',
    warning: 'Retirer l’entrée de la passerelle coupe brièvement tout le trafic sortant, le temps du réapprentissage. Sur une session distante, c’est perceptible.',
  },
  checks: [
    'Le renouvellement exige une adresse nommée : la table n’est jamais vidée en entier.',
    'L’entrée est relue après renouvellement, et un changement de MAC est signalé.',
    'Les états du voisinage sont expliqués, et « Stale » n’est pas présenté comme une panne.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netneighbor',
  sources: [
    { label: 'Get-NetNeighbor', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netneighbor' },
    { label: 'Remove-NetNeighbor', url: 'https://learn.microsoft.com/powershell/module/nettcpip/remove-netneighbor' },
    { label: 'arp', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/arp' },
  ],
};

/**
 * 19. dhcp-client-diagnostic — le bail de CETTE machine.
 *
 * Client, pas serveur. La distinction est écrite dans le rapport, parce que
 * « problème DHCP » recouvre deux choses très différentes : un poste qui
 * n'obtient pas de bail, et un service qui n'en distribue plus. Le second se
 * diagnostique sur le serveur, avec les assistants de Windows Server.
 *
 * Le signe le plus parlant est une adresse en 169.254 : la machine n'a reçu
 * aucune réponse et s'est servie elle-même.
 */
export const outilDiagnosticDhcpClient = {
  id: 'dhcp-client-diagnostic',
  icon: '⊜',
  category: 'Réseau',
  subcategory: 'Routage et voisinage',
  title: 'Diagnostiquer le bail DHCP du poste',
  risk: 'diagnostic',
  summary: 'Relève le bail de CETTE machine : serveur qui l’a délivré, dates, durée restante, options reçues, et détecte une adresse APIPA. Lit les événements du client DHCP. Dit clairement en quoi cela diffère du rôle DHCP Server, qui se diagnostique ailleurs.',
  fields: [
    {
      id: 'dhcCarte', label: 'Carte à examiner (facultatif)', default: '',
      help: 'Nom exact de la carte. Vide : toutes les cartes qui ont une configuration IPv4.',
    },
    {
      id: 'dhcJours', label: 'Profondeur des journaux (jours)', default: '7',
      help: 'Entre 1 et 90. Les événements du client DHCP disent si un bail a été refusé ou n’a jamais abouti.',
    },
    champFormat('dhcFormat'),
  ],
  validate(v) {
    const errors = {};
    const carte = String(v.dhcCarte ?? '').trim();
    if (carte !== '' && /["`$;|&<>]/.test(carte)) {
      errors.dhcCarte = 'Le nom de la carte ne peut contenir ni guillemet ni caractère de commande.';
    }
    verifier(errors, 'dhcJours', validerEntier(v.dhcJours, 1, 90, 'La profondeur'));
    verifier(errors, 'dhcFormat', validerFormatRapport(v.dhcFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const carte = String(v.dhcCarte ?? '').trim();
    const jours = validerEntier(v.dhcJours, 1, 90).value;

    const corps = [
      `$Carte = ${psB64(carte)}`,
      `$Jours = ${jours}`,
      `$KjemoFormat = ${psB64(v.dhcFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- Client, pas serveur ----------------------------------------------------------------',
      "# « Probleme DHCP » recouvre deux choses tres differentes : un poste qui",
      "# n'obtient pas de bail, et un service qui n'en distribue plus. Ce script",
      '# examine le PREMIER cas, sur CETTE machine. Le role DHCP Server se',
      '# diagnostique sur le serveur, avec les assistants de la categorie Windows',
      '# Server.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Ce que ce script examine' -Etat 'INFO' -Valeur 'le bail de cette machine' -Commentaire 'Le role DHCP Server se diagnostique depuis le serveur, pas depuis le client.')",
      "",
      '# --- 1. Les cartes et leur mode -----------------------------------------------------------',
      '$interfaces = @()',
      'try {',
      "  $interfaces = @(Get-NetIPInterface -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.ConnectionState -eq 'Connected' })",
      "  if ($Carte -ne '') { $interfaces = @($interfaces | Where-Object { $_.InterfaceAlias -eq $Carte }) }",
      '} catch { }',
      "",
      'if ($interfaces.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Cartes' -Controle 'Connectees' -Etat 'PROBLEME' -Valeur 0 -Commentaire 'Aucune carte IPv4 connectee a examiner.')",
      '}',
      "",
      'foreach ($i in $interfaces) {',
      '  $alias = $i.InterfaceAlias',
      "  $mode = 'adresse fixe'",
      "  if ($i.Dhcp -eq 'Enabled') { $mode = 'DHCP' }",
      "  [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Mode d''adressage' -Etat 'INFO' -Valeur $mode)",
      "",
      '  $adresses = @()',
      '  try { $adresses = @(Get-NetIPAddress -InterfaceIndex $i.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue) } catch { }',
      '  foreach ($a in $adresses) {',
      "    if ($a.IPAddress -like '169.254.*') {",
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Adresse' -Etat 'PROBLEME' -Valeur ($a.IPAddress + '/' + $a.PrefixLength) -Commentaire 'APIPA : aucun serveur DHCP n''a repondu, et la machine s''est servie elle-meme. Elle ne joindra que son propre segment. Chercher du cote du cable, du port, du VLAN, puis du relais DHCP.')",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Adresse' -Etat 'OK' -Valeur ($a.IPAddress + '/' + $a.PrefixLength) -Commentaire ('origine : ' + $a.PrefixOrigin + ' · suffixe : ' + $a.SuffixOrigin))",
      '      # Les dates du bail, quand elles existent.',
      '      if ($a.ValidLifetime -and $a.ValidLifetime.TotalSeconds -lt 315360000) {',
      '        $reste = [Math]::Floor($a.ValidLifetime.TotalHours)',
      "        $etatB = 'OK'",
      "        $noteB = 'Le client renouvelle a la moitie de la duree, puis aux sept huitiemes.'",
      "        if ($reste -lt 2) { $etatB = 'ATTENTION' ; $noteB = 'Bail tres court : le renouvellement est imminent. Si le serveur ne repond pas, l''adresse tombera.' }",
      "        [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Duree de bail restante' -Etat $etatB -Valeur ($reste.ToString() + ' heure(s)') -Commentaire $noteB)",
      '      }',
      '    }',
      '  }',
      "",
      '  # --- 2. Le serveur qui a delivre le bail -----------------------------------------------',
      "  # L'adresse du serveur DHCP n'est pas exposee par les applets NetTCPIP : elle",
      "  # vit dans la configuration de la carte, lue ici par CIM. C'est documente, et",
      "  # c'est ce que fait « ipconfig /all ».",
      '  $cfg = $null',
      '  try {',
      '    $cfg = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |',
      '      Where-Object { $_.InterfaceIndex -eq $i.InterfaceIndex } | Select-Object -First 1',
      '  } catch { }',
      '  if ($cfg) {',
      '    if ($cfg.DHCPServer) {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Serveur DHCP' -Etat 'OK' -Valeur $cfg.DHCPServer -Commentaire 'Si ce n''est pas le serveur attendu, un autre service DHCP repond sur ce segment.')",
      '    } elseif ($cfg.DHCPEnabled) {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Serveur DHCP' -Etat 'PROBLEME' -Valeur 'inconnu' -Commentaire 'La carte est en DHCP mais aucun serveur n''est enregistre : le bail n''a jamais abouti.')",
      '    }',
      '    if ($cfg.DHCPLeaseObtained) {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Bail obtenu le' -Etat 'INFO' -Valeur $cfg.DHCPLeaseObtained)",
      '    }',
      '    if ($cfg.DHCPLeaseExpires) {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Bail expire le' -Etat 'INFO' -Valeur $cfg.DHCPLeaseExpires)",
      '    }',
      '    if ($cfg.DNSServerSearchOrder) {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'DNS recus (option 006)' -Etat 'INFO' -Valeur ($cfg.DNSServerSearchOrder -join ', '))",
      '    }',
      '    if ($cfg.DNSDomain) {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Suffixe recu (option 015)' -Etat 'INFO' -Valeur $cfg.DNSDomain)",
      '    }',
      '    if ($cfg.DefaultIPGateway) {',
      "      [void](Add-KjemoResultat -Categorie ('Carte — ' + $alias) -Controle 'Passerelle recue (option 003)' -Etat 'INFO' -Valeur ($cfg.DefaultIPGateway -join ', '))",
      '    }',
      '  }',
      '}',
      "",
      '# --- 3. Les evenements du client DHCP -------------------------------------------------------',
      '$depuis = (Get-Date).AddDays(-$Jours)',
      '$evenements = @()',
      'try {',
      "  $evenements = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; StartTime = $depuis; ProviderName = 'Microsoft-Windows-Dhcp-Client' } -ErrorAction SilentlyContinue | Select-Object -First 30)",
      '} catch { }',
      'if ($evenements.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements sur ' + $Jours + ' jour(s)') -Etat 'OK' -Valeur 0 -Commentaire 'Le client DHCP n''a rien signale : les baux se sont obtenus et renouveles sans incident.')",
      '} else {',
      '  $graves = @($evenements | Where-Object { $_.LevelDisplayName -match \'Erreur|Error|Critique|Critical\' })',
      "  [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ('Evenements sur ' + $Jours + ' jour(s)') -Etat (& { if ($graves.Count -gt 0) { 'PROBLEME' } else { 'INFO' } }) -Valeur ($evenements.Count.ToString() + ' dont ' + $graves.Count + ' erreur(s)'))",
      '  foreach ($e in ($evenements | Select-Object -First 10)) {',
      '    $texte = $e.Message',
      '    if ($texte -and $texte.Length -gt 160) { $texte = $texte.Substring(0, 160) }',
      "    [void](Add-KjemoResultat -Categorie 'Journaux' -Controle ($e.TimeCreated.ToString('s') + ' — ID ' + $e.Id) -Etat (& { if ($e.LevelDisplayName -match 'Erreur|Error') { 'PROBLEME' } else { 'INFO' } }) -Valeur $texte)",
      '  }',
      '}',
      "",
      '# --- 4. Ce qu\'il faut faire ensuite -----------------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Renouveler un bail ---'",
      "Write-Host 'Ce script NE renouvelle PAS le bail : « ipconfig /release » coupe le reseau'",
      "Write-Host 'de la machine, et sur une session distante la commande suivante n''arrive'",
      "Write-Host 'jamais. C''est une operation qui se fait devant la machine.'",
      "Write-Host ''",
      "Write-Host 'Pour renouveler, sur place :'",
      "Write-Host '    ipconfig /renew'",
      "Write-Host 'Et seulement si le renouvellement simple ne suffit pas :'",
      "Write-Host '    ipconfig /release puis ipconfig /renew'",
      "[void](Add-KjemoResultat -Categorie 'Suite' -Controle 'Renouvellement' -Etat 'INFO' -Valeur 'non effectue par ce script' -Commentaire 'ipconfig /release coupe le reseau : sur une session distante, la commande suivante n''arrive jamais. A faire devant la machine.')",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Diagnostic du bail DHCP, cote client',
      outil: 'dhcp-client-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Carte', psB64(carte)],
        ['Jours', psB64(String(jours))],
        ['Format', psB64(v.dhcFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-dhcp-client',
      formats: v.dhcFormat,
    });
  },
  gui: [
    '« ipconfig /all » donne le serveur DHCP, les dates du bail et les options reçues.',
    '« ipconfig /renew » renouvelle. « ipconfig /release » libère — et coupe le réseau : à faire devant la machine.',
    'Observateur d’événements > Système, source Microsoft-Windows-Dhcp-Client.',
    'Une adresse en 169.254 signifie qu’aucun serveur n’a répondu : vérifier câble, port, VLAN, puis relais DHCP.',
    'Côté serveur : console DHCP > Baux d’adresses, pour voir ce qui a été attribué à cette machine.',
  ],
  keywords: [
    'dhcp client', 'bail', 'lease', 'apipa', '169.254', 'ipconfig renew',
    'pas d adresse ip', 'option 003', 'option 006', 'option 015',
    'serveur dhcp inconnu', 'relais dhcp', 'adresse automatique',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation pour la lecture ; le journal Système peut en demander selon la stratégie locale.',
    'Pour renouveler un bail : être devant la machine, pas en session distante.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'L’adresse commence par 169.254',
      cause: 'Aucun serveur DHCP n’a répondu. Windows s’est attribué une adresse de lien-local.',
      fix: 'Dans l’ordre : câble, port du commutateur, VLAN, relais DHCP (ip helper), puis état du serveur.',
    },
    {
      message: 'Le serveur DHCP n’est pas celui attendu',
      cause: 'Un autre service DHCP répond sur ce segment — borne Wi-Fi, routeur personnel, machine virtuelle mal configurée.',
      fix: 'Le rapport donne l’adresse du serveur qui a répondu. C’est elle qu’il faut retrouver physiquement.',
    },
    {
      message: 'Le bail expire dans moins de deux heures',
      cause: 'Bail court, ou renouvellements qui échouent et raccourcissent la durée restante.',
      fix: 'Regarder les événements du client DHCP : ils disent si les renouvellements aboutissent.',
    },
    {
      message: 'La machine a une adresse mais pas de passerelle ni de DNS',
      cause: 'Le serveur distribue l’adresse sans les options 003 et 006.',
      fix: 'C’est côté serveur : il manque les options 003 et 006 sur l’étendue. Voir les assistants Windows Server.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport distingue explicitement le client du rôle serveur.',
    'Chaque carte a son mode d’adressage, son adresse et, si elle existe, la date de son bail.',
    'Une adresse APIPA est rapportée comme PROBLÈME, avec l’ordre dans lequel chercher.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit la configuration et les journaux. Il ne renouvelle ni ne libère aucun bail.',
    diagnostic: '# Le bail actuel, tel qu\'ipconfig le montre.\nGet-CimInstance Win32_NetworkAdapterConfiguration | Where-Object DHCPEnabled | Select-Object Description,DHCPServer,DHCPLeaseObtained,DHCPLeaseExpires',
    command: '# Rien a annuler : aucune ecriture.\n# Le renouvellement se fait devant la machine, pas depuis ce script :\n#   ipconfig /renew\nWrite-Host \'Aucune action a annuler.\'',
    warning: '« ipconfig /release » coupe le réseau de la machine. Sur une session distante, la commande suivante n’arrive jamais.',
  },
  checks: [
    'Aucun bail n’est libéré ni renouvelé par ce script.',
    'La distinction client / rôle serveur est écrite dans le rapport.',
    'Une adresse APIPA est traitée comme un problème, avec la marche à suivre.',
  ],
  source: 'https://learn.microsoft.com/windows-server/administration/windows-commands/ipconfig',
  sources: [
    { label: 'ipconfig', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/ipconfig' },
    { label: 'Get-NetIPInterface', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipinterface' },
    { label: 'Get-NetIPAddress', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipaddress' },
  ],
};
/**
 * 20. network-share-diagnostic — « je n'arrive plus à ouvrir le lecteur P: ».
 *
 * L'appel le plus fréquent d'un service informatique, et celui où l'on part
 * le plus souvent sur la mauvaise piste : on cherche des droits alors que
 * c'est le DNS, ou on reprend un lecteur alors que le serveur est éteint.
 *
 * Huit contrôles, dans l'ordre où ils doivent être faits, et le rapport dit
 * où s'arrêter. Aucun montage avec mot de passe, jamais.
 */
export const outilDiagnosticPartage = {
  id: 'network-share-diagnostic',
  icon: '⊟',
  category: 'Réseau',
  subcategory: 'Accès aux ressources',
  title: 'Diagnostiquer un partage inaccessible',
  risk: 'diagnostic',
  summary: 'Huit contrôles dans l’ordre où il faut les faire : DNS, écho indicatif, TCP 445, chemin UNC, session existante, dialecte SMB, droits apparents, message d’erreur exact. Le rapport dit où s’arrêter. Aucun montage avec mot de passe.',
  fields: [
    {
      id: 'nsdChemin', label: 'Chemin UNC du partage', default: '\\\\srv-fichiers.hopitalbn.lan\\Donnees',
      help: 'Le chemin tel que la personne le saisit, avec les deux antislashs initiaux.',
    },
    {
      id: 'nsdLettre', label: 'Lettre du lecteur concerné (facultatif)', default: '',
      help: 'Si le partage est monté sur une lettre, par exemple P:. Vide : seul le chemin UNC est contrôlé.',
    },
    champFormat('nsdFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'nsdChemin', validerCheminUnc(v.nsdChemin));
    const lettre = String(v.nsdLettre ?? '').trim();
    if (lettre !== '') verifier(errors, 'nsdLettre', validerLettreLecteur(lettre));
    verifier(errors, 'nsdFormat', validerFormatRapport(v.nsdFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const chemin = validerCheminUnc(v.nsdChemin).value;
    const lettre = String(v.nsdLettre ?? '').trim();
    const sansTete = chemin.replace(/^\\\\/, '');
    const serveur = sansTete.split('\\')[0];

    const corps = [
      `$Chemin = ${psB64(chemin)}`,
      `$Serveur = ${psB64(serveur)}`,
      `$Lettre = ${psB64(lettre)}`,
      `$KjemoFormat = ${psB64(v.nsdFormat)}`,
      "",
      blocContexteReseau(),
      "",
      "# Ce script utilise le compte de la session en cours. Il ne demande aucun",
      "# identifiant, n'en enregistre aucun, et ne monte aucun lecteur avec un mot de",
      '# passe. Un acces refuse est RAPPORTE.',
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Identite utilisee' -Etat 'INFO' -Valeur ($env:USERDOMAIN + '\\' + $env:USERNAME) -Commentaire 'Si la personne qui se plaint n''est pas celle-ci, le diagnostic ne dit rien de son cas : il faut le lancer sous SON compte.')",
      "[void](Add-KjemoResultat -Categorie 'Cible' -Controle 'Chemin demande' -Etat 'INFO' -Valeur $Chemin)",
      "",
      '# --- 1. Le nom du serveur se resout-il ? ---------------------------------------------',
      '$adresse = $null',
      'try { $adresse = (Resolve-DnsName -Name $Serveur -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress } | Select-Object -First 1).IPAddress } catch { }',
      'if ($adresse) {',
      "  [void](Add-KjemoResultat -Categorie '1. DNS' -Controle $Serveur -Etat 'OK' -Valeur $adresse)",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie '1. DNS' -Controle $Serveur -Etat 'PROBLEME' -Valeur 'aucune reponse' -Commentaire 'ARRETER ICI. Tant que le nom ne se resout pas, chercher des droits est une perte de temps.')",
      '}',
      "",
      '# --- 2. Echo, a titre indicatif seulement ---------------------------------------------',
      '$echo = $null',
      'try { $echo = Test-Connection -ComputerName $Serveur -Count 2 -ErrorAction SilentlyContinue } catch { }',
      "[void](Add-KjemoResultat -Categorie '2. Echo' -Controle $Serveur -Etat (& { if ($echo) { 'OK' } else { 'INFO' } }) -Valeur (& { if ($echo) { 'repond' } else { 'pas de reponse' } }) -Commentaire 'Indicatif seulement : beaucoup de serveurs ne repondent pas a l''echo et partagent tres bien leurs fichiers.')",
      "",
      '# --- 3. Le port 445 -------------------------------------------------------------------',
      '$port = $null',
      'try { $port = Test-NetConnection -ComputerName $Serveur -Port 445 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      'if ($port -and $port.TcpTestSucceeded) {',
      "  [void](Add-KjemoResultat -Categorie '3. Port 445' -Controle 'TCP' -Etat 'OK' -Valeur 'ouvert')",
      '} else {',
      "  [void](Add-KjemoResultat -Categorie '3. Port 445' -Controle 'TCP' -Etat 'PROBLEME' -Valeur 'ferme ou filtre' -Commentaire 'ARRETER ICI. Serveur eteint, service Serveur arrete, ou pare-feu entre les deux. Les droits ne sont pas en cause.')",
      '}',
      "",
      '# --- 4. Le chemin repond-il ? ----------------------------------------------------------',
      '$accessible = $false',
      "$messageExact = ''",
      'try {',
      '  $accessible = Test-Path -LiteralPath $Chemin -ErrorAction Stop',
      '} catch {',
      '  $messageExact = $_.Exception.Message',
      '}',
      "[void](Add-KjemoResultat -Categorie '4. Chemin UNC' -Controle $Chemin -Etat (& { if ($accessible) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($accessible) { 'accessible' } else { 'inaccessible' } }) -Commentaire $messageExact)",
      "",
      '# --- 5. Sessions et lecteurs existants --------------------------------------------------',
      "# Une session SMB ouverte avec d'anciens identifiants empeche d'en ouvrir une",
      "# nouvelle vers le meme serveur. C'est la cause de « ca marche chez moi mais",
      '# pas chez lui » quand un compte a change de mot de passe.',
      '$sessions = @()',
      'try { $sessions = @(Get-SmbConnection -ServerName $Serveur -ErrorAction SilentlyContinue) } catch { }',
      'if ($sessions.Count -eq 0) {',
      "  [void](Add-KjemoResultat -Categorie '5. Sessions' -Controle 'Vers ce serveur' -Etat 'INFO' -Valeur 'aucune' -Commentaire 'Aucune session SMB ouverte a cet instant.')",
      '} else {',
      '  foreach ($s in $sessions) {',
      "    [void](Add-KjemoResultat -Categorie '5. Sessions' -Controle $s.ShareName -Etat 'INFO' -Valeur ('dialecte ' + $s.Dialect) -Commentaire ('compte : ' + $s.UserName))",
      '  }',
      '}',
      '$mappages = @()',
      'try { $mappages = @(Get-SmbMapping -ErrorAction SilentlyContinue) } catch { }',
      "if ($Lettre -ne '') {",
      "  $m = $mappages | Where-Object { $_.LocalPath -eq $Lettre } | Select-Object -First 1",
      '  if ($m) {',
      "    $etatM = 'OK'",
      "    $noteM = ''",
      "    if ($m.Status -ne 'OK') { $etatM = 'PROBLEME' ; $noteM = 'Le lecteur est monte mais son etat n''est pas bon : la session a ete coupee, ou le serveur ne repond plus.' }",
      '    if ($m.RemotePath -ne $Chemin) {',
      "      $etatM = 'ATTENTION'",
      "      $noteM = 'Le lecteur pointe vers UN AUTRE chemin que celui diagnostique : ' + $m.RemotePath",
      '    }',
      "    [void](Add-KjemoResultat -Categorie '5. Sessions' -Controle ('Lecteur ' + $Lettre) -Etat $etatM -Valeur ($m.RemotePath + ' — ' + $m.Status) -Commentaire $noteM)",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie '5. Sessions' -Controle ('Lecteur ' + $Lettre) -Etat 'PROBLEME' -Valeur 'non monte' -Commentaire 'Aucun lecteur sur cette lettre dans CETTE session. Un lecteur monte dans une session elevee n''est pas visible dans une session ordinaire, et inversement.')",
      '  }',
      '}',
      "",
      '# --- 6. Le dialecte negocie ---------------------------------------------------------------',
      '$conf = $null',
      'try { $conf = Get-SmbClientConfiguration -ErrorAction SilentlyContinue } catch { }',
      'if ($conf) {',
      "  [void](Add-KjemoResultat -Categorie '6. SMB' -Controle 'Signature exigee par ce client' -Etat 'INFO' -Valeur $conf.RequireSecuritySignature.ToString())",
      '}',
      'foreach ($s in $sessions) {',
      "  if ($s.Dialect -like '1.*') {",
      "    [void](Add-KjemoResultat -Categorie '6. SMB' -Controle 'Dialecte' -Etat 'PROBLEME' -Valeur $s.Dialect -Commentaire 'SMB 1 : obsolete et vulnerable. Il est desactive par defaut depuis Windows 10 1709, et il ne faut pas le reactiver pour faire marcher un partage.')",
      '  }',
      '}',
      "",
      '# --- 7. Droits apparents, vus de cette session ---------------------------------------------',
      "# « Apparents » est le mot juste : on voit ce que CE compte peut faire, a CET",
      "# instant. Les droits de partage et les droits NTFS se cumulent, et le plus",
      '# restrictif gagne. Ce script ne modifie aucun droit.',
      'if ($accessible) {',
      '  $peutLister = $false',
      "  $erreurListe = ''",
      '  try {',
      '    [void](Get-ChildItem -LiteralPath $Chemin -ErrorAction Stop | Select-Object -First 1)',
      '    $peutLister = $true',
      '  } catch { $erreurListe = $_.Exception.Message }',
      "  [void](Add-KjemoResultat -Categorie '7. Droits apparents' -Controle 'Lister le contenu' -Etat (& { if ($peutLister) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($peutLister) { 'autorise' } else { 'refuse' } }) -Commentaire $erreurListe)",
      '  $acl = $null',
      '  try { $acl = Get-Acl -Path $Chemin -ErrorAction SilentlyContinue } catch { }',
      '  if ($acl) {',
      "    [void](Add-KjemoResultat -Categorie '7. Droits apparents' -Controle 'Proprietaire' -Etat 'INFO' -Valeur $acl.Owner)",
      '    $pertinentes = @($acl.Access | Where-Object {',
      "      $_.IdentityReference -match [Regex]::Escape($env:USERNAME) -or",
      "      $_.IdentityReference -match 'Users|Utilisateurs|Everyone|Tout le monde|Authenticated'",
      '    } | Select-Object -First 10)',
      '    foreach ($a in $pertinentes) {',
      "      [void](Add-KjemoResultat -Categorie '7. Droits apparents' -Controle $a.IdentityReference.ToString() -Etat 'INFO' -Valeur ($a.AccessControlType.ToString() + ' — ' + $a.FileSystemRights) -Commentaire 'Droits NTFS. Les droits de PARTAGE se cumulent avec eux, et le plus restrictif des deux gagne.')",
      '    }',
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie '7. Droits apparents' -Controle 'Liste de controle d''acces' -Etat 'ATTENTION' -Valeur 'illisible' -Commentaire 'Ce compte ne peut pas lire les droits du dossier, ce qui est deja une reponse.')",
      '  }',
      '} else {',
      "  [void](Add-KjemoResultat -Categorie '7. Droits apparents' -Controle 'Examen' -Etat 'IGNORE' -Valeur 'chemin inaccessible' -Commentaire 'Inutile d''examiner des droits sur un chemin qu''on n''atteint pas.')",
      '}',
      "",
      '# --- 8. Ou s\'arreter ----------------------------------------------------------------------',
      "Write-Host ''",
      "Write-Host '--- Lire ce rapport dans l''ordre ---'",
      "Write-Host '1 en echec : c''est le DNS. Ne pas chercher de droits.'",
      "Write-Host '3 en echec : c''est le reseau, le service Serveur, ou un pare-feu.'",
      "Write-Host '4 en echec, 1 et 3 verts : le partage n''existe pas sous ce nom, ou'",
      "Write-Host '  l''acces est refuse des la racine.'",
      "Write-Host '5 : une session ouverte avec d''anciens identifiants empeche d''en ouvrir'",
      "Write-Host '  une nouvelle. C''est le « ca marche chez moi » le plus frequent.'",
      "Write-Host '7 en echec, tout le reste vert : LA ce sont les droits. Partage ET NTFS,'",
      "Write-Host '  et le plus restrictif des deux gagne.'",
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Diagnostic d\'un partage inaccessible',
      outil: 'network-share-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Chemin', psB64(chemin)],
        ['Serveur', psB64(serveur)],
        ['Format', psB64(v.nsdFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-partage',
      formats: v.nsdFormat,
    });
  },
  gui: [
    'Saisir le chemin UNC dans l’Explorateur : le message d’erreur exact est la première information utile.',
    '« net use » liste les connexions ; « net use P: /delete » retire une connexion restée en travers.',
    'Propriétés du dossier > Sécurité, sur le serveur : les droits NTFS. Onglet Partage > Autorisations : les droits de partage.',
    'Un lecteur monté dans une session élevée n’est pas visible dans une session ordinaire, et inversement.',
    'Gestionnaire de serveur > Services de fichiers > Partages, pour voir ce qui est réellement partagé.',
  ],
  keywords: [
    'partage inaccessible', 'lecteur reseau', 'unc', 'acces refuse',
    'chemin reseau introuvable', 'net use', 'p:', 'smb', 'droits ntfs',
    'droits de partage', 'session smb', 'ca marche chez moi', 'lecteur deconnecte',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Lancer le script SOUS LE COMPTE qui se plaint : un diagnostic fait sous un autre compte ne dit rien de son cas.',
    'Le chemin UNC tel que la personne le saisit, avec les deux antislashs initiaux.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le chemin réseau n’a pas été trouvé',
      cause: 'Le nom ne se résout pas, ou le port 445 est bloqué. Les contrôles 1 et 3 le disent.',
      fix: 'Ne pas chercher de droits tant que ces deux-là ne sont pas verts.',
    },
    {
      message: 'Plusieurs connexions à un serveur ne sont pas autorisées',
      cause: 'Une session SMB existe déjà vers ce serveur, avec d’autres identifiants.',
      fix: '« net use » pour la voir, « net use \\\\serveur\\partage /delete » pour la fermer, puis rouvrir.',
    },
    {
      message: 'Accès refusé alors que l’utilisateur figure dans le bon groupe',
      cause: 'L’appartenance au groupe date d’après l’ouverture de session : le jeton d’accès ne l’a pas.',
      fix: 'Fermer et rouvrir la session. Rien d’autre ne rafraîchit le jeton.',
    },
    {
      message: 'Le lecteur apparaît déconnecté mais s’ouvre si on clique dessus',
      cause: 'Comportement normal : Windows marque le lecteur déconnecté tant qu’il n’a pas été sollicité.',
      fix: 'Ce n’est pas une panne. Le contrôle 5 donne l’état réel de la session.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Les huit contrôles ont chacun leur ligne, numérotés dans l’ordre.',
    'Le message d’erreur exact figure dans le rapport, non reformulé.',
    'Le compte sous lequel le diagnostic a tourné est nommé en tête.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit. Aucun lecteur n’est monté, aucune session ouverte avec des identifiants.',
    diagnostic: '# Les sessions et lecteurs en cours.\nGet-SmbConnection\nGet-SmbMapping',
    command: '# Rien a annuler : aucun montage, aucun droit modifie.\n# Pour fermer une session restee en travers, ouverte par ailleurs :\nGet-SmbMapping -LocalPath \'<lettre>:\' | Remove-SmbMapping -Confirm',
    warning: 'Fermer une session SMB coupe les fichiers ouverts dessus, sans sauvegarde. Prévenir la personne avant.',
  },
  checks: [
    'Aucun identifiant demandé, aucun montage avec mot de passe.',
    'Aucun droit modifié : les droits sont lus et rapportés.',
    'Le message d’erreur exact est conservé, pas reformulé.',
  ],
  source: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbconnection',
  sources: [
    { label: 'Get-SmbConnection', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbconnection' },
    { label: 'Get-SmbMapping', url: 'https://learn.microsoft.com/powershell/module/smbshare/get-smbmapping' },
    { label: 'Get-Acl', url: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl' },
  ],
};

/**
 * 21. wifi-vpn-diagnostic — deux parcours, séparés.
 *
 * Le Wi-Fi et le VPN n'ont rien à voir l'un avec l'autre, sauf qu'on les
 * soupçonne dans les mêmes circonstances : « ça marche mal depuis la maison ».
 * Les mélanger dans un seul rapport produit une liste illisible. Ils sont
 * donc traités en deux parcours distincts, et le formulaire fait choisir.
 *
 * AUCUNE clé Wi-Fi n'est affichée. « netsh wlan show profile name=... key=clear »
 * existe et montre la clé en clair ; cet assistant ne l'appelle jamais.
 */
export const outilDiagnosticWifiVpn = {
  id: 'wifi-vpn-diagnostic',
  icon: '◡',
  category: 'Réseau',
  subcategory: 'Wi-Fi et VPN',
  title: 'Diagnostiquer le Wi-Fi ou le VPN',
  risk: 'diagnostic',
  summary: 'Deux parcours séparés, parce qu’ils n’ont rien à voir : Wi-Fi (carte, service, profil, signal, canal, adressage) ou VPN (interfaces, routes, DNS, métriques, tunnel partagé observable). Aucune clé Wi-Fi, aucun secret VPN, aucun mot de passe n’est affiché.',
  fields: [
    {
      id: 'wvParcours', label: 'Parcours', type: 'select', default: 'Wi-Fi',
      options: [
        ['Wi-Fi', 'Wi-Fi — carte, service, profil, signal, adressage'],
        ['VPN', 'VPN — interfaces, routes, DNS, tunnel partagé'],
      ],
      help: 'Les deux parcours sont distincts. Les mélanger produit un rapport illisible.',
    },
    {
      id: 'wvProfil', label: 'Profil à examiner (facultatif)', default: '',
      help: 'Nom du profil Wi-Fi ou de la connexion VPN. Vide : tous les profils sont listés, sans détail.',
    },
    {
      id: 'wvCibleInterne', label: 'Ressource interne à joindre', default: 'srv-fichiers.hopitalbn.lan',
      help: 'Un nom qui ne doit répondre que depuis l’intérieur : c’est ce qui prouve qu’un tunnel porte vraiment le trafic.',
    },
    champFormat('wvFormat'),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'wvParcours', validerChoix(v.wvParcours, ['Wi-Fi', 'VPN'], 'Le parcours'));
    const profil = String(v.wvProfil ?? '').trim();
    if (profil !== '') verifier(errors, 'wvProfil', validerNomProfilWifi(profil));
    verifier(errors, 'wvCibleInterne', validerCibleReseau(v.wvCibleInterne));
    verifier(errors, 'wvFormat', validerFormatRapport(v.wvFormat));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const parcours = validerChoix(v.wvParcours, ['Wi-Fi', 'VPN']).value;
    const profil = String(v.wvProfil ?? '').trim();
    const interne = validerCibleReseau(v.wvCibleInterne).value;

    const corps = [
      `$Parcours = ${psB64(parcours)}`,
      `$Profil = ${psB64(profil)}`,
      `$Interne = ${psB64(interne)}`,
      `$KjemoFormat = ${psB64(v.wvFormat)}`,
      "",
      blocContexteReseau(),
      "",
      '# --- Ce que ce script n\'affichera jamais --------------------------------------------',
      "# « netsh wlan show profile name=... key=clear » existe, et montre la cle du",
      "# reseau en clair. Ce script ne l'appelle JAMAIS : il n'ajoute jamais key=clear,",
      '# et aucun mot de passe, aucune cle, aucun secret VPN ne figure dans le rapport.',
      "# Un rapport de diagnostic circule par courriel, s'attache a un billet, et reste",
      "# dans un dossier partage pendant des annees. Rien de secret n'y a sa place.",
      "[void](Add-KjemoResultat -Categorie 'Portee' -Controle 'Secrets' -Etat 'INFO' -Valeur 'aucun affiche' -Commentaire 'Aucune cle Wi-Fi, aucun secret VPN, aucun mot de passe n''est lu ni ecrit par ce script.')",
      "",
      "if ($Parcours -eq 'Wi-Fi') {",
      '  # =====================================================================',
      '  # PARCOURS WI-FI',
      '  # =====================================================================',
      '  # --- 1. La carte sans fil --------------------------------------------------------',
      '  $cartes = @()',
      "  try { $cartes = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceDescription -match 'Wireless|Wi-?Fi|802\\.11|WLAN' }) } catch { }",
      '  if ($cartes.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'Wi-Fi — Carte' -Controle 'Detection' -Etat 'PROBLEME' -Valeur 'aucune carte sans fil' -Commentaire 'Pas de carte Wi-Fi reconnue : pilote absent, carte desactivee dans le BIOS, ou interrupteur materiel.')",
      '  } else {',
      '    foreach ($c in $cartes) {',
      "      $etat = 'OK'",
      "      $note = ''",
      "      if ($c.Status -ne 'Up') { $etat = 'PROBLEME' ; $note = 'Carte presente mais pas active. Cet assistant ne l''active pas : une carte se rallume devant la machine.' }",
      "      [void](Add-KjemoResultat -Categorie 'Wi-Fi — Carte' -Controle $c.Name -Etat $etat -Valeur ($c.Status + ' — ' + $c.LinkSpeed) -Commentaire ($c.InterfaceDescription + '. ' + $note))",
      '    }',
      '  }',
      "",
      '  # --- 2. Le service WLAN -----------------------------------------------------------',
      '  $svc = $null',
      "  try { $svc = Get-Service -Name 'WlanSvc' -ErrorAction SilentlyContinue } catch { }",
      '  if ($svc) {',
      "    $etatS = 'OK'",
      "    $noteS = ''",
      "    if ($svc.Status -ne 'Running') { $etatS = 'PROBLEME' ; $noteS = 'Sans ce service, aucun reseau sans fil n''apparait, meme si la carte fonctionne.' }",
      "    [void](Add-KjemoResultat -Categorie 'Wi-Fi — Service' -Controle 'Configuration automatique WLAN' -Etat $etatS -Valeur $svc.Status.ToString() -Commentaire $noteS)",
      '  }',
      "",
      '  # --- 3. Le reseau en cours et le signal -------------------------------------------',
      "  # netsh wlan show interfaces donne l'etat, le signal, le canal et le debit.",
      "  # Cette commande N'AFFICHE AUCUNE CLE : c'est « show profile ... key=clear »",
      '  # qui le ferait, et elle n\'est jamais appelee ici.',
      '  $interfaces = $null',
      '  try { $interfaces = (netsh wlan show interfaces) -join [Environment]::NewLine } catch { }',
      '  if ($interfaces) {',
      "    Write-Host ''",
      "    Write-Host '--- Etat de la connexion sans fil ---'",
      '    Write-Host $interfaces',
      '    $lignesSignal = @()',
      "    try { $lignesSignal = @((netsh wlan show interfaces) | Where-Object { $_ -match 'Signal|Canal|Channel|Radio|R.ception|D.bit|Rate' }) } catch { }",
      '    foreach ($l in $lignesSignal) {',
      "      $texte = $l.Trim()",
      "      if ($texte -ne '') {",
      "        $etatL = 'INFO'",
      "        if ($texte -match 'Signal') {",
      "          $chiffres = [Regex]::Match($texte, '(\\d+)\\s*%')",
      '          if ($chiffres.Success) {',
      '            $pourcent = [int]$chiffres.Groups[1].Value',
      "            if ($pourcent -lt 40) { $etatL = 'PROBLEME' }",
      "            elseif ($pourcent -lt 60) { $etatL = 'ATTENTION' }",
      "            else { $etatL = 'OK' }",
      '          }',
      '        }',
      "        [void](Add-KjemoResultat -Categorie 'Wi-Fi — Liaison' -Controle $texte -Etat $etatL -Valeur '')",
      '      }',
      '    }',
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'Wi-Fi — Liaison' -Controle 'Etat' -Etat 'ATTENTION' -Valeur 'indisponible' -Commentaire 'netsh wlan n''a rien rendu : service arrete, ou aucune carte sans fil.')",
      '  }',
      "",
      '  # --- 4. Les profils enregistres ----------------------------------------------------',
      '  $profils = @()',
      "  try { $profils = @((netsh wlan show profiles) | Where-Object { $_ -match ':' } | ForEach-Object { ($_ -split ':', 2)[1].Trim() } | Where-Object { $_ }) } catch { }",
      "  [void](Add-KjemoResultat -Categorie 'Wi-Fi — Profils' -Controle 'Enregistres' -Etat 'INFO' -Valeur $profils.Count -Commentaire 'Noms seulement. Les cles ne sont ni lues ni affichees.')",
      '  foreach ($p in ($profils | Select-Object -First 30)) {',
      "    [void](Add-KjemoResultat -Categorie 'Wi-Fi — Profils' -Controle $p -Etat 'INFO' -Valeur 'enregistre')",
      '  }',
      "  if ($Profil -ne '') {",
      "    $trouve = @($profils | Where-Object { $_ -eq $Profil })",
      "    [void](Add-KjemoResultat -Categorie 'Wi-Fi — Profils' -Controle ('Profil demande : ' + $Profil) -Etat (& { if ($trouve.Count -gt 0) { 'OK' } else { 'PROBLEME' } }) -Valeur (& { if ($trouve.Count -gt 0) { 'present' } else { 'absent de cette machine' } }))",
      '  }',
      "",
      '  # --- 5. Adressage obtenu par le Wi-Fi ----------------------------------------------',
      '  foreach ($c in $cartes) {',
      '    $cfg = $null',
      '    try { $cfg = Get-NetIPConfiguration -InterfaceIndex $c.ifIndex -ErrorAction SilentlyContinue } catch { }',
      '    if ($cfg) {',
      '      $ip = $null',
      '      try { $ip = ($cfg.IPv4Address | Select-Object -First 1) } catch { }',
      '      if ($ip) {',
      "        $etatA = 'OK'",
      "        $noteA = ''",
      "        if ($ip.IPAddress -like '169.254.*') { $etatA = 'PROBLEME' ; $noteA = 'APIPA : associe au reseau sans fil, mais aucun bail DHCP. L''authentification a peut-etre echoue apres l''association.' }",
      "        [void](Add-KjemoResultat -Categorie 'Wi-Fi — Adressage' -Controle $c.Name -Etat $etatA -Valeur ($ip.IPAddress + '/' + $ip.PrefixLength) -Commentaire $noteA)",
      '      }',
      '      $dns = $null',
      '      try { $dns = ($cfg.DNSServer | Where-Object { $_.AddressFamily -eq 2 } | Select-Object -First 1) } catch { }',
      "      if ($dns) { [void](Add-KjemoResultat -Categorie 'Wi-Fi — Adressage' -Controle 'Serveurs DNS' -Etat 'INFO' -Valeur ($dns.ServerAddresses -join ', ')) }",
      '      $pass = $null',
      '      try { $pass = $cfg.IPv4DefaultGateway.NextHop } catch { }',
      "      if ($pass) { [void](Add-KjemoResultat -Categorie 'Wi-Fi — Adressage' -Controle 'Passerelle' -Etat 'INFO' -Valeur $pass) }",
      '    }',
      '  }',
      "",
      '} else {',
      '  # =====================================================================',
      '  # PARCOURS VPN',
      '  # =====================================================================',
      '  # --- 1. Connexions VPN declarees ---------------------------------------------------',
      '  $vpns = @()',
      '  try { $vpns = @(Get-VpnConnection -ErrorAction SilentlyContinue) } catch { }',
      '  $vpnsMachine = @()',
      '  try { $vpnsMachine = @(Get-VpnConnection -AllUserConnection -ErrorAction SilentlyContinue) } catch { }',
      '  $tous = @($vpns) + @($vpnsMachine)',
      '  if ($tous.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'VPN — Connexions' -Controle 'Declarees' -Etat 'INFO' -Valeur 0 -Commentaire 'Aucune connexion VPN Windows. Un client tiers (OpenVPN, WireGuard, un editeur) n''apparait pas ici : regarder les interfaces ci-dessous.')",
      '  } else {',
      '    foreach ($vv in $tous) {',
      "      $etatV = 'INFO'",
      "      if ($vv.ConnectionStatus -eq 'Connected') { $etatV = 'OK' }",
      "      [void](Add-KjemoResultat -Categorie 'VPN — Connexions' -Controle $vv.Name -Etat $etatV -Valeur $vv.ConnectionStatus.ToString() -Commentaire ('serveur : ' + $vv.ServerAddress + ' · tunnel : ' + $vv.TunnelType + ' · tunnel partage : ' + $vv.SplitTunneling))",
      '    }',
      '  }',
      "",
      '  # --- 2. Interfaces de tunnel ---------------------------------------------------------',
      '  $tunnels = @()',
      '  try {',
      '    $tunnels = @(Get-NetAdapter -ErrorAction SilentlyContinue |',
      "      Where-Object { $_.InterfaceDescription -match 'VPN|TAP|WireGuard|WAN Miniport|Tunnel|Virtual Private' -or $_.Name -match 'VPN' })",
      '  } catch { }',
      "  [void](Add-KjemoResultat -Categorie 'VPN — Interfaces' -Controle 'Detectees' -Etat 'INFO' -Valeur $tunnels.Count -Commentaire 'Un client tiers se reconnait ici, meme s''il n''apparait pas dans les connexions Windows.')",
      '  foreach ($t in $tunnels) {',
      "    [void](Add-KjemoResultat -Categorie 'VPN — Interfaces' -Controle $t.Name -Etat (& { if ($t.Status -eq 'Up') { 'OK' } else { 'INFO' } }) -Valeur $t.Status.ToString() -Commentaire $t.InterfaceDescription)",
      '  }',
      "",
      '  # --- 3. Ce que le tunnel capte -------------------------------------------------------',
      "  # C'est la question qui compte : le tunnel prend-il TOUT le trafic, ou",
      '  # seulement certaines destinations ? La table de routage repond, et elle',
      "  # repond mieux qu'un reglage declare.",
      '  $indexTunnels = @($tunnels | Select-Object -ExpandProperty ifIndex)',
      '  $routesTunnel = @()',
      '  try {',
      '    if ($indexTunnels.Count -gt 0) {',
      '      $routesTunnel = @(Get-NetRoute -ErrorAction SilentlyContinue | Where-Object { $indexTunnels -contains $_.InterfaceIndex })',
      '    }',
      '  } catch { }',
      '  if ($routesTunnel.Count -eq 0) {',
      "    [void](Add-KjemoResultat -Categorie 'VPN — Portee' -Controle 'Routes du tunnel' -Etat 'INFO' -Valeur 0 -Commentaire 'Aucune route par une interface de tunnel : le VPN n''est pas monte, ou il ne porte rien.')",
      '  } else {',
      "    $defautTunnel = @($routesTunnel | Where-Object { $_.DestinationPrefix -eq '0.0.0.0/0' })",
      '    if ($defautTunnel.Count -gt 0) {',
      "      [void](Add-KjemoResultat -Categorie 'VPN — Portee' -Controle 'Tunnel complet' -Etat 'INFO' -Valeur 'oui' -Commentaire 'Le tunnel porte une route par defaut : TOUT le trafic passe par lui, y compris la navigation Internet. Attendu dans certains parcs, surprenant dans d''autres.')",
      '    } else {',
      "      [void](Add-KjemoResultat -Categorie 'VPN — Portee' -Controle 'Tunnel partage' -Etat 'INFO' -Valeur ($routesTunnel.Count.ToString() + ' route(s) precise(s)') -Commentaire 'Seules ces destinations passent par le tunnel. Le reste sort directement.')",
      '    }',
      '    foreach ($r in ($routesTunnel | Sort-Object DestinationPrefix | Select-Object -First 20)) {',
      "      [void](Add-KjemoResultat -Categorie 'VPN — Portee' -Controle $r.DestinationPrefix -Etat 'INFO' -Valeur ('via ' + $r.NextHop) -Commentaire ('metrique ' + $r.RouteMetric))",
      '    }',
      '  }',
      "",
      '  # --- 4. DNS du tunnel ------------------------------------------------------------------',
      "  # Un tunnel qui porte les routes mais pas le DNS donne la panne la plus",
      "  # deroutante : l'adresse repond, le nom ne se resout pas.",
      '  foreach ($t in $tunnels) {',
      '    $d = $null',
      '    try { $d = Get-DnsClientServerAddress -InterfaceIndex $t.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1 } catch { }',
      '    if ($d -and $d.ServerAddresses.Count -gt 0) {',
      "      [void](Add-KjemoResultat -Categorie 'VPN — DNS' -Controle $t.Name -Etat 'OK' -Valeur ($d.ServerAddresses -join ', '))",
      "    } elseif ($t.Status -eq 'Up') {",
      "      [void](Add-KjemoResultat -Categorie 'VPN — DNS' -Controle $t.Name -Etat 'ATTENTION' -Valeur 'aucun serveur DNS' -Commentaire 'Tunnel monte sans DNS : les adresses repondront, les noms internes non. C''est la panne la plus deroutante du VPN.')",
      '    }',
      '  }',
      "",
      '  # --- 5. Epreuve : la ressource interne repond-elle ? -------------------------------------',
      '  $resolution = $null',
      '  try { $resolution = Resolve-DnsName -Name $Interne -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress } | Select-Object -First 1 } catch { }',
      '  if ($resolution) {',
      "    [void](Add-KjemoResultat -Categorie 'VPN — Epreuve' -Controle ('Resolution de ' + $Interne) -Etat 'OK' -Valeur $resolution.IPAddress)",
      '  } else {',
      "    [void](Add-KjemoResultat -Categorie 'VPN — Epreuve' -Controle ('Resolution de ' + $Interne) -Etat 'PROBLEME' -Valeur 'aucune reponse' -Commentaire 'Le nom interne ne se resout pas : le tunnel ne porte pas le DNS interne, ou il n''est pas monte.')",
      '  }',
      '  $atteinte = $null',
      '  try { $atteinte = Test-NetConnection -ComputerName $Interne -Port 445 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue } catch { }',
      '  if ($atteinte) {',
      "    [void](Add-KjemoResultat -Categorie 'VPN — Epreuve' -Controle 'Acces a la ressource interne' -Etat (& { if ($atteinte.TcpTestSucceeded) { 'OK' } else { 'PROBLEME' } }) -Valeur ('TCP 445 : ' + $atteinte.TcpTestSucceeded) -Commentaire (& { if ($atteinte.InterfaceAlias) { 'sortie par ' + $atteinte.InterfaceAlias } else { '' } }))",
      '  }',
      "",
      '  # --- 6. Journaux ------------------------------------------------------------------------',
      '  $evenements = @()',
      '  try {',
      "    $evenements = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = (Get-Date).AddDays(-3) } -ErrorAction SilentlyContinue |",
      "      Where-Object { $_.ProviderName -match 'RasClient|RasMan|Vpn' } | Select-Object -First 10)",
      '  } catch { }',
      "  [void](Add-KjemoResultat -Categorie 'VPN — Journaux' -Controle 'Evenements (3 jours)' -Etat 'INFO' -Valeur $evenements.Count)",
      '  foreach ($e in $evenements) {',
      '    $texte = $e.Message',
      '    if ($texte -and $texte.Length -gt 160) { $texte = $texte.Substring(0, 160) }',
      "    [void](Add-KjemoResultat -Categorie 'VPN — Journaux' -Controle ($e.TimeCreated.ToString('s') + ' — ' + $e.ProviderName) -Etat 'INFO' -Valeur $texte)",
      '  }',
      '}',
      blocAucunContournement(),
    ];

    return assembler({
      titre: 'Diagnostic Wi-Fi ou VPN',
      outil: 'wifi-vpn-diagnostic',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Parcours', psB64(parcours)],
        ['Profil', psB64(profil)],
        ['Interne', psB64(interne)],
        ['Format', psB64(v.wvFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-wifi-vpn',
      formats: v.wvFormat,
    });
  },
  gui: [
    'Wi-Fi : « netsh wlan show interfaces » donne l’état, le signal, le canal et le débit de la liaison en cours.',
    '« netsh wlan show profiles » liste les profils enregistrés — les noms, pas les clés.',
    'Paramètres > Réseau et Internet > Wi-Fi > Gérer les réseaux connus : les profils, côté interface.',
    'VPN : Paramètres > Réseau et Internet > VPN, puis « route print » avant et après le montage pour voir ce que le tunnel capte.',
    'Observateur d’événements > Application, sources RasClient et RasMan, pour les échecs de connexion VPN.',
  ],
  keywords: [
    'wifi', 'sans fil', 'wlan', 'signal faible', 'profil wifi', 'netsh wlan',
    'vpn', 'tunnel', 'split tunnel', 'tunnel partage', 'rasclient',
    'ne joint pas le reseau interne', 'dns du vpn', 'canal wifi',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucune élévation : tout est en lecture.',
    'Pour le parcours VPN : le tunnel doit être monté au moment du diagnostic, sinon il n’y a rien à observer.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le VPN est connecté mais les ressources internes sont injoignables',
      cause: 'Le tunnel porte les routes mais pas le DNS interne : les adresses répondent, les noms non.',
      fix: 'La section « VPN — DNS » le dit. C’est la panne la plus déroutante du VPN, et la plus fréquente.',
    },
    {
      message: 'Tout Internet passe par le VPN et tout est lent',
      cause: 'Le tunnel porte une route par défaut : tunnel complet.',
      fix: 'La section « VPN — Portée » le montre. Le tunnel partagé se règle côté serveur VPN, pas sur le poste.',
    },
    {
      message: 'Le Wi-Fi est associé mais sans adresse utilisable',
      cause: 'Association réussie, authentification ou DHCP en échec. L’adresse est en 169.254.',
      fix: 'La section Adressage le signale. Chercher du côté de l’authentification 802.1X, puis du DHCP.',
    },
    {
      message: 'Le signal est bon mais le débit est mauvais',
      cause: 'Canal saturé, interférences, ou trop de clients sur la même borne.',
      fix: 'Le canal figure dans l’état de la liaison. Le diagnostic matériel approfondi relève d’un outil dédié au poste de travail.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le rapport ne contient aucune clé, aucun secret, aucun mot de passe.',
    'Un seul parcours a été suivi : les deux ne sont jamais mélangés.',
    'Pour le VPN : la portée du tunnel est dite explicitement, complète ou partagée.',
  ],
  rollback: {
    summary: 'Aucune modification : cet assistant lit l’état des cartes, des profils et des routes.',
    diagnostic: '# Etat de la liaison sans fil, sans aucune cle.\nnetsh wlan show interfaces\n\n# Ce que le tunnel capte.\nGet-NetRoute | Where-Object InterfaceAlias -match \'VPN\'',
    command: '# Rien a annuler : aucune ecriture, aucun profil modifie, aucune carte touchee.\n# Un profil Wi-Fi se retire devant la machine, en connaissance de cause :\n#   netsh wlan delete profile name="<nom>"\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Retirer un profil Wi-Fi efface la clé enregistrée : la personne devra la ressaisir, et elle ne l’a pas toujours.',
  },
  checks: [
    'Aucune clé Wi-Fi n’est lue ni affichée : « key=clear » n’apparaît nulle part.',
    'Aucun secret VPN, aucun mot de passe dans le rapport.',
    'Les deux parcours sont séparés, et aucune carte n’est activée ni désactivée.',
  ],
  source: 'https://learn.microsoft.com/windows-server/administration/windows-commands/netsh-wlan',
  sources: [
    { label: 'netsh wlan', url: 'https://learn.microsoft.com/windows-server/administration/windows-commands/netsh-wlan' },
    { label: 'Get-VpnConnection', url: 'https://learn.microsoft.com/powershell/module/vpnclient/get-vpnconnection' },
    { label: 'Get-NetRoute', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netroute' },
  ],
};
/**
 * 22. ipv4-subnet-calculator — le calcul se fait dans le navigateur.
 *
 * Cet assistant est différent des vingt et un autres, et la différence mérite
 * d'être dite.
 *
 * Les autres produisent un script qu'on va exécuter sur une machine. Celui-ci
 * CALCULE, et le résultat se lit immédiatement dans l'aperçu : le découpage
 * est fait en JavaScript, par dist/calcul-ip.mjs, au moment où le formulaire
 * change. Aucune exécution n'est nécessaire pour obtenir la réponse.
 *
 * Le script PowerShell téléchargeable refait le MÊME calcul, de façon
 * indépendante, avec les mêmes bornes. Il sert à deux choses : vérifier que
 * les deux implémentations s'accordent, et calculer sur une machine qui n'a
 * pas accès au site.
 *
 * Toute l'arithmétique passe par BigInt côté JavaScript — les opérateurs
 * binaires de JavaScript travaillent sur des entiers 32 bits SIGNÉS, et
 * (192 << 24) vaut moins un milliard. Côté PowerShell, le même calcul se fait
 * par divisions et modulos entiers, pour la même raison.
 *
 * Ce lot couvre IPv4. L'IPv6 n'est pas traitée, et ce n'est pas prétendu.
 */
export const outilCalculateurIpv4 = {
  id: 'ipv4-subnet-calculator',
  icon: '⊞',
  category: 'Réseau',
  subcategory: 'Calculs réseau',
  title: 'Calculer un sous-réseau IPv4',
  risk: 'diagnostic',
  summary: 'Calcule masque, wildcard, adresse de réseau, diffusion, première et dernière adresse utilisables, nombre total et utilisable. Compare deux adresses, et découpe en sous-réseaux plus petits. Le calcul se fait dans le navigateur ; le script PowerShell le refait de façon indépendante.',
  fields: [
    {
      id: 'calcAdresse', label: 'Adresse IPv4', default: '192.168.30.254',
      help: 'Une adresse d’hôte ou une adresse de réseau : les deux fonctionnent, et le résultat dit laquelle c’était.',
    },
    {
      id: 'calcPrefixe', label: 'Préfixe (CIDR)', default: '24',
      help: 'Entre 0 et 32. /31 et /32 sont traités à part, et le résultat l’explique.',
    },
    {
      id: 'calcComparer', label: 'Seconde adresse à comparer (facultatif)', default: '192.168.30.10',
      help: 'Pour savoir si deux adresses sont dans le même sous-réseau avec ce préfixe. Vide : pas de comparaison.',
    },
    {
      id: 'calcDecoupe', label: 'Découper en /x (facultatif)', default: '',
      help: 'Préfixe plus long, pour découper le réseau en sous-réseaux. Vide : pas de découpage. Le nombre de sous-réseaux affichés est plafonné, et le total est indiqué.',
    },
    champFormat('calcFormat', ['Console', 'JSON', 'CSV']),
  ],
  validate(v) {
    const errors = {};
    verifier(errors, 'calcAdresse', validateIPv4(v.calcAdresse));
    verifier(errors, 'calcPrefixe', validerPrefixe(v.calcPrefixe));
    const seconde = String(v.calcComparer ?? '').trim();
    if (seconde !== '') verifier(errors, 'calcComparer', validateIPv4(seconde));
    const decoupe = String(v.calcDecoupe ?? '').trim();
    if (decoupe !== '') {
      const d = validerPrefixe(decoupe);
      if (!d.ok) {
        errors.calcDecoupe = d.error;
      } else {
        const p = validerPrefixe(v.calcPrefixe);
        if (p.ok && d.value < p.value) {
          errors.calcDecoupe = `Le préfixe de découpage /${d.value} est plus court que /${p.value} : ce serait un regroupement, pas un découpage.`;
        }
      }
    }
    verifier(errors, 'calcFormat', validerChoix(v.calcFormat, ['Console', 'JSON', 'CSV'], 'Le format'));
    return errors;
  },
  generate(v) {
    assertValid(this, v);
    const adresse = validateIPv4(v.calcAdresse).value;
    const prefixe = validerPrefixe(v.calcPrefixe).value;
    const seconde = String(v.calcComparer ?? '').trim();
    const decoupe = String(v.calcDecoupe ?? '').trim();

    // ----------------------------------------------------------------------
    // Le calcul, ici, maintenant, dans le navigateur. BigInt de bout en bout.
    // ----------------------------------------------------------------------
    const r = calculerSousReseau(adresse, prefixe);
    const comparaison = seconde !== '' ? memeSousReseau(adresse, seconde, prefixe) : null;
    const decoupage = decoupe !== '' ? decouperSousReseaux(adresse, prefixe, validerPrefixe(decoupe).value, 32) : null;

    const lignes = [
      ['Adresse saisie', r.adresse],
      ['Préfixe', '/' + r.prefixe],
      ['Masque', r.masque],
      ['Wildcard', r.wildcard],
      ['Adresse de réseau', r.reseau],
      ['Adresse de diffusion', r.diffusion ?? 'sans objet pour ce préfixe'],
      ['Première adresse utilisable', r.premiereUtilisable],
      ['Dernière adresse utilisable', r.derniereUtilisable],
      ['Nombre total d\'adresses', String(r.totalAdresses)],
      ['Nombre d\'adresses utilisables', String(r.adressesUtilisables)],
      ['Notation CIDR du réseau', r.cidr],
      ['Portée', r.portee],
      ['Classe historique', r.classe],
    ];
    if (r.estAdresseReseau) lignes.push(['Remarque', 'L’adresse saisie EST l’adresse de réseau.']);
    if (r.estAdresseDiffusion) lignes.push(['Remarque', 'L’adresse saisie EST l’adresse de diffusion.']);

    const resultatConsole = [
      '# ===================================================================',
      '# RESULTAT — calcule par le navigateur, affiche tel quel',
      '# ===================================================================',
      '# Ce bloc n\'est pas produit par PowerShell : il a ete calcule en',
      '# JavaScript, en BigInt, au moment ou ce script a ete genere. Le code',
      '# PowerShell plus bas refait le MEME calcul, de facon independante : si',
      '# les deux ne s\'accordent pas, l\'un des deux a tort, et cela se voit.',
      '#',
      ...lignes.map(([k, val]) => `#   ${(k + ' ').padEnd(32, '.')} ${val}`),
      '#',
      `#   ${enApostropheAscii(r.note)}`,
    ];
    if (comparaison) {
      resultatConsole.push('#');
      resultatConsole.push(`#   Comparaison avec ${seconde} :`);
      resultatConsole.push(`#     ${adresse} appartient a ${comparaison.reseauA}/${prefixe}`);
      resultatConsole.push(`#     ${seconde} appartient a ${comparaison.reseauB}/${prefixe}`);
      resultatConsole.push(`#     ${comparaison.identique ? 'MEME sous-reseau.' : 'SOUS-RESEAUX DIFFERENTS : il faut un routeur entre les deux.'}`);
    }
    if (decoupage) {
      resultatConsole.push('#');
      resultatConsole.push(`#   Decoupage de ${decoupage.depuis} en ${decoupage.vers} :`);
      resultatConsole.push(`#     ${decoupage.nombreTotal} sous-reseau(x) au total`
        + (decoupage.tronque ? `, ${decoupage.nombreRendu} affiche(s) ci-dessous` : ''));
      for (const sr of decoupage.sousReseaux) {
        resultatConsole.push(`#     ${sr.cidr.padEnd(20, ' ')} hotes ${sr.premiereUtilisable} - ${sr.derniereUtilisable}`
          + `  (${sr.adressesUtilisables} utilisable(s))`);
      }
    }

    const corps = [
      ...resultatConsole,
      "",
      `$Adresse = ${psB64(adresse)}`,
      `$Prefixe = ${prefixe}`,
      `$Seconde = ${psB64(seconde)}`,
      `$Decoupe = ${psB64(decoupe)}`,
      `$KjemoFormat = ${psB64(v.calcFormat)}`,
      "",
      '# --- Arithmetique IPv4, sans operateur binaire signe -------------------------------',
      "# PowerShell n'a pas le probleme de signe de JavaScript, mais il a celui des",
      "# entiers 32 bits : [int]4294967295 deborde. On travaille donc en [int64],",
      '# par divisions et modulos, ce qui ne deborde jamais dans cette plage.',
      'function ConvertTo-KjemoEntier {',
      '  param([string]$Ip)',
      "  $o = $Ip.Split('.')",
      '  return ([int64]$o[0] * 16777216) + ([int64]$o[1] * 65536) + ([int64]$o[2] * 256) + [int64]$o[3]',
      '}',
      'function ConvertFrom-KjemoEntier {',
      '  param([int64]$N)',
      '  $a = [Math]::Floor($N / 16777216)',
      '  $b = [Math]::Floor(($N % 16777216) / 65536)',
      '  $c = [Math]::Floor(($N % 65536) / 256)',
      '  $d = $N % 256',
      "  return ('' + $a + '.' + $b + '.' + $c + '.' + $d)",
      '}',
      'function Get-KjemoMasqueEntier {',
      '  param([int]$P)',
      '  if ($P -eq 0) { return [int64]0 }',
      '  $taille = [int64][Math]::Pow(2, 32 - $P)',
      '  return [int64]4294967296 - $taille',
      '}',
      "",
      '# --- Le calcul ----------------------------------------------------------------------',
      '$ipEntier = ConvertTo-KjemoEntier $Adresse',
      '$masqueEntier = Get-KjemoMasqueEntier $Prefixe',
      '$taille = [int64][Math]::Pow(2, 32 - $Prefixe)',
      '$reseauEntier = [int64]([Math]::Floor($ipEntier / $taille)) * $taille',
      '$diffusionEntier = $reseauEntier + $taille - 1',
      '$wildcardEntier = $taille - 1',
      "",
      'if ($Prefixe -eq 32) {',
      '  $premiere = $reseauEntier',
      '  $derniere = $reseauEntier',
      '  $utilisables = 1',
      "  $note = 'Hote unique : /32 designe une seule adresse, sans reseau ni diffusion distincts.'",
      "  $diffusionTexte = 'sans objet pour ce prefixe'",
      '} elseif ($Prefixe -eq 31) {',
      '  $premiere = $reseauEntier',
      '  $derniere = $diffusionEntier',
      '  $utilisables = 2',
      "  $note = 'Liaison point a point (RFC 3021) : les DEUX adresses sont utilisables. Les compter comme zero serait faux.'",
      "  $diffusionTexte = 'sans objet pour ce prefixe'",
      '} else {',
      '  $premiere = $reseauEntier + 1',
      '  $derniere = $diffusionEntier - 1',
      '  $utilisables = $taille - 2',
      "  $note = 'L''adresse de reseau et l''adresse de diffusion ne sont pas attribuables a un hote.'",
      '  $diffusionTexte = ConvertFrom-KjemoEntier $diffusionEntier',
      '}',
      "",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Adresse saisie' -Etat 'INFO' -Valeur $Adresse)",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Prefixe' -Etat 'INFO' -Valeur ('/' + $Prefixe))",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Masque' -Etat 'INFO' -Valeur (ConvertFrom-KjemoEntier $masqueEntier))",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Wildcard' -Etat 'INFO' -Valeur (ConvertFrom-KjemoEntier $wildcardEntier))",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Adresse de reseau' -Etat 'INFO' -Valeur (ConvertFrom-KjemoEntier $reseauEntier))",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Adresse de diffusion' -Etat 'INFO' -Valeur $diffusionTexte)",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Premiere utilisable' -Etat 'INFO' -Valeur (ConvertFrom-KjemoEntier $premiere))",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Derniere utilisable' -Etat 'INFO' -Valeur (ConvertFrom-KjemoEntier $derniere))",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Adresses au total' -Etat 'INFO' -Valeur $taille)",
      "[void](Add-KjemoResultat -Categorie 'Calcul' -Controle 'Adresses utilisables' -Etat 'INFO' -Valeur $utilisables -Commentaire $note)",
      "",
      '# L\'adresse saisie etait-elle deja une adresse remarquable ?',
      'if ($Prefixe -lt 31) {',
      '  if ($ipEntier -eq $reseauEntier) {',
      "    [void](Add-KjemoResultat -Categorie 'Remarque' -Controle 'Adresse saisie' -Etat 'ATTENTION' -Valeur 'c''est l''adresse de reseau' -Commentaire 'Elle ne s''attribue pas a un hote.')",
      '  }',
      '  if ($ipEntier -eq $diffusionEntier) {',
      "    [void](Add-KjemoResultat -Categorie 'Remarque' -Controle 'Adresse saisie' -Etat 'ATTENTION' -Valeur 'c''est l''adresse de diffusion' -Commentaire 'Elle ne s''attribue pas a un hote.')",
      '  }',
      '}',
      "",
      '# --- Comparaison ---------------------------------------------------------------------',
      "if ($Seconde -ne '') {",
      '  $secondeEntier = ConvertTo-KjemoEntier $Seconde',
      '  $reseauSeconde = [int64]([Math]::Floor($secondeEntier / $taille)) * $taille',
      '  $meme = ($reseauSeconde -eq $reseauEntier)',
      "  [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle $Adresse -Etat 'INFO' -Valeur ((ConvertFrom-KjemoEntier $reseauEntier) + '/' + $Prefixe))",
      "  [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle $Seconde -Etat 'INFO' -Valeur ((ConvertFrom-KjemoEntier $reseauSeconde) + '/' + $Prefixe))",
      "  [void](Add-KjemoResultat -Categorie 'Comparaison' -Controle 'Verdict' -Etat (& { if ($meme) { 'OK' } else { 'INFO' } }) -Valeur (& { if ($meme) { 'meme sous-reseau' } else { 'sous-reseaux differents' } }) -Commentaire (& { if ($meme) { 'Les deux machines se parlent directement, sans routeur.' } else { 'Il faut un routeur entre les deux, et une route dans les deux sens.' } }))",
      '}',
      "",
      '# --- Decoupage ------------------------------------------------------------------------',
      "if ($Decoupe -ne '') {",
      '  $cible = [int]$Decoupe',
      '  $tailleCible = [int64][Math]::Pow(2, 32 - $cible)',
      '  $nombre = [int64][Math]::Pow(2, $cible - $Prefixe)',
      "  [void](Add-KjemoResultat -Categorie 'Decoupage' -Controle ('De /' + $Prefixe + ' vers /' + $cible) -Etat 'INFO' -Valeur ($nombre.ToString() + ' sous-reseau(x)'))",
      '  $limite = 32',
      '  $rendus = $nombre',
      '  if ($rendus -gt $limite) { $rendus = $limite }',
      '  for ($i = 0; $i -lt $rendus; $i++) {',
      '    $debut = $reseauEntier + ($i * $tailleCible)',
      '    $fin = $debut + $tailleCible - 1',
      '    if ($cible -ge 31) {',
      '      $p1 = $debut',
      '      $p2 = $fin',
      '    } else {',
      '      $p1 = $debut + 1',
      '      $p2 = $fin - 1',
      '    }',
      "    [void](Add-KjemoResultat -Categorie 'Decoupage' -Controle ((ConvertFrom-KjemoEntier $debut) + '/' + $cible) -Etat 'INFO' -Valeur ((ConvertFrom-KjemoEntier $p1) + ' - ' + (ConvertFrom-KjemoEntier $p2)))",
      '  }',
      '  if ($nombre -gt $limite) {',
      "    [void](Add-KjemoResultat -Categorie 'Decoupage' -Controle 'Affichage tronque' -Etat 'INFO' -Valeur ($limite.ToString() + ' sur ' + $nombre) -Commentaire 'Le nombre de sous-reseaux double a chaque bit emprunte : un /8 vers un /24 en produit plus de soixante mille.')",
      '  }',
      '}',
      "",
      "Write-Host ''",
      "Write-Host '--- Ce que ce calculateur ne fait pas ---'",
      "Write-Host 'Il ne couvre QUE IPv4. L''IPv6 a une arithmetique differente, des prefixes'",
      "Write-Host 'jusqu''a /128, et pas d''adresse de diffusion : la traiter avec les memes'",
      "Write-Host 'formules donnerait des resultats faux.'",
      "Write-Host ''",
      "Write-Host 'Il ne touche a rien sur cette machine : c''est de l''arithmetique.'",
    ];

    return assembler({
      titre: 'Calculateur de sous-reseau IPv4',
      outil: 'ipv4-subnet-calculator',
      diagnostic: true,
      admin: false,
      parametres: [
        ['Adresse', psB64(adresse)],
        ['Prefixe', psB64(String(prefixe))],
        ['Format', psB64(v.calcFormat)],
      ],
      corps,
      version: VERSION_RESEAU,
      prefixeFichier: 'kjemo-reseau-calcul-ipv4',
      formats: v.calcFormat,
    });
  },
  gui: [
    'Windows n’a pas de calculateur de sous-réseau intégré : la calculatrice en mode Programmeur convertit entre décimal et binaire, et c’est tout.',
    'À la main : le masque est une suite de 1 suivie de 0. /24 = 24 bits à 1 = 255.255.255.0.',
    'Le nombre d’adresses est 2^(32 − préfixe). On en retire deux — réseau et diffusion — sauf en /31 et /32.',
    'Pour savoir si deux adresses sont dans le même sous-réseau : appliquer le masque aux deux, comparer le résultat.',
    '« Get-NetIPAddress » donne le préfixe de chaque adresse de la machine, ce qui évite de le deviner.',
  ],
  keywords: [
    'calculateur', 'sous-reseau', 'subnet', 'cidr', 'masque', 'wildcard',
    'adresse de reseau', 'broadcast', 'diffusion', 'nombre d hotes',
    'meme sous-reseau', 'decoupage', 'vlsm', 'ipv4', '/24', '/26', 'rfc 3021',
  ],
  requiresAdmin: false,
  os: OS_RESEAU,
  prereqs: PREREQS_RESEAU.concat([
    'Aucun : le calcul se fait dans le navigateur, et le script PowerShell n’a besoin d’aucun module.',
    'Une adresse IPv4 et un préfixe. Les deux sont validés avant tout calcul.',
  ]),
  commonErrors: ERREURS_RESEAU.concat([
    {
      message: 'Le résultat annonce 0 adresse utilisable pour un /31',
      cause: 'Un calculateur qui retire systématiquement deux adresses se trompe sur /31.',
      fix: 'La RFC 3021 rend les deux adresses d’un /31 utilisables sur une liaison point à point. Cet assistant les compte.',
    },
    {
      message: 'Deux machines du même réseau ne se parlent pas',
      cause: 'Elles n’ont pas le même masque : l’une se croit dans un /24, l’autre dans un /16.',
      fix: 'La comparaison de cet assistant utilise UN préfixe pour les deux. Vérifier le masque réel de chaque machine avec Get-NetIPAddress.',
    },
    {
      message: 'L’adresse saisie est refusée',
      cause: 'Zéro de tête (010), octet supérieur à 255, ou nombre de points incorrect.',
      fix: 'Le validateur refuse « 010 » parce que ce n’est pas « 10 » partout : certains outils l’interprètent en octal.',
    },
    {
      message: 'Le découpage est refusé',
      cause: 'Le préfixe demandé est plus court que le préfixe de départ : ce serait un regroupement.',
      fix: 'Pour découper, le préfixe cible doit être plus long : /24 vers /26, pas l’inverse.',
    },
  ]),
  reversible: true,
  verifyAfter: [
    'Le bloc de résultat en tête du script, calculé par le navigateur, s’accorde avec ce que le script PowerShell affiche.',
    'Pour un /31 et un /32, le nombre d’adresses utilisables est 2 et 1, pas 0.',
    'Le réseau calculé correspond à ce que « Get-NetIPAddress » annonce sur une machine réelle du segment.',
  ],
  rollback: {
    summary: 'Aucune modification : c’est de l’arithmétique. Le script ne lit ni n’écrit quoi que ce soit sur la machine.',
    diagnostic: '# Verifier le calcul contre la configuration reelle d\'une machine.\nGet-NetIPAddress -AddressFamily IPv4 | Select-Object InterfaceAlias,IPAddress,PrefixLength',
    command: '# Rien a annuler : aucune lecture de configuration, aucune ecriture.\nWrite-Host \'Aucune action a annuler.\'',
    warning: 'Un calcul juste ne garantit pas un plan d’adressage juste : vérifier que le sous-réseau choisi n’est pas déjà utilisé ailleurs dans l’établissement.',
  },
  checks: [
    'Toute l’arithmétique JavaScript passe par BigInt : aucun opérateur binaire signé.',
    'Les cas /31 (RFC 3021) et /32 sont traités à part, et le résultat l’explique.',
    'Le script PowerShell refait le calcul de façon indépendante, pour que les deux se contrôlent.',
    'IPv6 n’est pas couverte, et ce n’est pas prétendu.',
  ],
  source: 'https://learn.microsoft.com/windows-server/networking/core-network-guide/core-network-guide',
  sources: [
    { label: 'Composants du réseau de base, côté Windows Server', url: 'https://learn.microsoft.com/windows-server/networking/core-network-guide/core-network-guide' },
    { label: 'Get-NetIPAddress', url: 'https://learn.microsoft.com/powershell/module/nettcpip/get-netipaddress' },
    { label: 'Classe IPAddress (System.Net)', url: 'https://learn.microsoft.com/dotnet/api/system.net.ipaddress' },
  ],
};

/**
 * Remplace les apostrophes et guillemets typographiques par leurs equivalents
 * ASCII.
 *
 * Les textes des fiches sont ecrits en francais soigne, apostrophe courbe
 * comprise. Dans un COMMENTAIRE PowerShell, cette apostrophe est inoffensive —
 * mais le projet interdit U+2018 et U+2019 partout dans un script genere, et
 * cette regle n'a pas a souffrir d'exception pour une ligne decorative : une
 * exception admise ici serait invoquee ailleurs.
 */
export function enApostropheAscii(texte) {
  return String(texte ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

// ---------------------------------------------------------------------------
// Catalogue exporté
// ---------------------------------------------------------------------------
export const toolsReseau = [
  outilRapportReseauComplet,
  outilBaselineReseau,
  outilPingTraceroute,
  outilLatencePerte,
  outilDiagnosticPasserelle,
  outilConflitIp,
  outilCartesMultiples,
  outilDiagnosticDnsClient,
  outilCacheDns,
  outilChangementDnsClient,
  outilTestPortsTcp,
  outilConnectiviteRpc,
  outilConnectiviteLdap,
  outilConnectiviteSmb,
  outilTestHttpsTls,
  outilTableRoutage,
  outilGestionRoute,
  outilDiagnosticArp,
  outilDiagnosticDhcpClient,
  outilDiagnosticPartage,
  outilDiagnosticWifiVpn,
  outilCalculateurIpv4,
];
