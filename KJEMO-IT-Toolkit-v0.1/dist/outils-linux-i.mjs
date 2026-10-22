/**
 * outils-linux-i.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Réseau Linux — quatre assistants.
 *
 *   linux-network-diagnostic  LIT les adresses, les routes, les voisins et les
 *                             sockets en écoute. Trois pannes qui se
 *                             ressemblent y sont distinguées : le lien, la
 *                             route, et la résolution.
 *   netplan-readiness         PRÉPARE une configuration Netplan, la valide sur
 *                             une COPIE, et n'applique RIEN. `netplan apply`
 *                             n'apparaît nulle part.
 *   linux-dns-diagnostic      LIT la résolution, et répond à la question que
 *                             le fichier /etc/resolv.conf ne permet plus de
 *                             poser depuis systemd-resolved.
 *   linux-firewall-audit      LIT le pare-feu, et croise les règles avec les
 *                             ports réellement en écoute.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI NETPLAN N'APPLIQUE JAMAIS
 * ---------------------------------------------------------------------------
 * `netplan apply` reconfigure le réseau immédiatement. Sur une machine
 * administrée à distance — c'est-à-dire presque toutes — une configuration
 * fautive coupe la session SSH au moment même où elle s'applique, et il n'y a
 * plus personne pour la corriger. Ce n'est pas un risque théorique : c'est le
 * mode de panne le plus courant du sujet.
 *
 * `netplan try` existe précisément pour cela : il applique, attend une
 * confirmation au clavier, et REVIENT tout seul en arrière après 120 secondes
 * si personne ne confirme. Mais il demande un terminal interactif, donc il ne
 * peut pas être lancé par un script — et un script qui le lancerait sans
 * terminal appliquerait la configuration puis la laisserait revenir en
 * arrière, ce qui est le pire des deux mondes.
 *
 * L'assistant prépare donc le fichier, le VALIDE sur une copie — avec
 * `netplan generate --root-dir`, qui ne touche pas au système et dont la page
 * de manuel dit explicitement « It does not apply the generated
 * configuration » — puis affiche les deux commandes à taper soi-même, dans
 * l'ordre. Rien n'est écrit dans /etc/netplan.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import { blocConfirmation, blocPorteFinale } from './gardes-bash.mjs';
import {
  validateChoix, validateCheminAbsolu, validateEntierBorne, validateNomFichier,
} from './validateurs-linux.mjs';
import { assertValid } from './noyau.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';
const NETPLAN = 'https://netplan.readthedocs.io/en/stable';

const OS_LINUX = [
  'Ubuntu Server 22.04 LTS et 24.04 LTS',
  'Ubuntu Desktop 22.04 et 24.04',
  'Debian 12 (bookworm)',
  'Toute distribution utilisant systemd et APT',
];

const DISTROS = ['Ubuntu 24.04 LTS (cible de référence)', 'Ubuntu 22.04 LTS', 'Debian 12'];

const CHAMP_FORMAT = {
  id: 'format',
  label: 'Format du rapport',
  type: 'select',
  default: 'Console',
  options: [['Console', 'Console seulement'], ['JSON', 'Console + fichier JSON'], ['CSV', 'Console + fichier CSV']],
  help: 'Le fichier est écrit dans ton dossier personnel, jamais ailleurs.',
};

function validerFormat(v, errors) {
  const r = validateChoix(v.format, ['Console', 'JSON', 'CSV'], 'Le format');
  if (!r.ok) errors.format = r.error;
}

const OUI_NON = [['Non', 'Non'], ['Oui', 'Oui']];

/**
 * Nom d'interface réseau.
 *
 * Les noms prévisibles d'Ubuntu — enp0s3, ens18, wlp2s0 — remplacent eth0
 * depuis des années, et c'est la première cause de configuration Netplan qui
 * ne s'applique à rien : le fichier décrit « eth0 », aucune interface ne
 * porte ce nom, et netplan ne s'en plaint pas. Il génère une configuration
 * pour une interface qui n'existe pas, et le réseau reste comme avant.
 */
function validateNomInterface(v, label = 'Le nom de l’interface') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 15) {
    return { ok: false, value: s, error: `${label} dépasse 15 caractères, la limite du noyau Linux (IFNAMSIZ).` };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} ne peut contenir que des lettres, des chiffres, « . », « _ » et « - ». Valeur saisie : « ${s} ».`,
    };
  }
  return { ok: true, value: s, error: null };
}

/** Une adresse IPv4 avec préfixe CIDR, obligatoire : Netplan l'exige ainsi. */
function validateAdresseCidr(v, label = 'L’adresse') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!m) {
    return {
      ok: false,
      value: s,
      error: `${label} doit porter son préfixe CIDR, par exemple 192.168.30.10/24. Netplan l’exige : une adresse sans préfixe est refusée par le générateur, et le message ne dit pas lequel des deux champs manque.`,
    };
  }
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o > 255)) {
    return { ok: false, value: s, error: `${label} : chaque octet doit être entre 0 et 255.` };
  }
  const p = Number(m[5]);
  if (p < 8 || p > 30) {
    return {
      ok: false,
      value: s,
      error: `${label} : le préfixe doit être entre /8 et /30. Un /31 ou /32 sur une interface ordinaire ne laisse aucune adresse utilisable pour un voisin, et un préfixe plus court que /8 n’a pas de sens sur un réseau local.`,
    };
  }
  return { ok: true, value: s, error: null };
}

/** Une adresse IPv4 nue : passerelle, serveur DNS. */
function validateIPv4(v, label = 'L’adresse') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m || m.slice(1, 5).map(Number).some((o) => o > 255)) {
    return { ok: false, value: s, error: `${label} doit être une adresse IPv4, par exemple 192.168.30.1. Valeur saisie : « ${s} ».` };
  }
  return { ok: true, value: s, error: null };
}

/** Un nom d'hôte ou une adresse, pour les tests de résolution et de route. */
function validateHote(v, label = 'La cible') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 253) return { ok: false, value: s, error: `${label} dépasse 253 caractères.` };
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} doit être un nom d’hôte ou une adresse IP, sans espace ni caractère spécial. Valeur saisie : « ${s} ».`,
    };
  }
  return { ok: true, value: s, error: null };
}

// ===========================================================================
// ASSISTANT 1 — LIRE LE RÉSEAU, ET DISTINGUER TROIS PANNES QUI SE RESSEMBLENT
//
// « Je n'ai pas Internet » couvre trois pannes de natures différentes, et on
// les traite presque toujours dans le mauvais ordre :
//
//   1. le LIEN      l'interface est-elle up, et porte-t-elle un signal ?
//   2. la ROUTE     y a-t-il une route par défaut, et la passerelle répond-elle ?
//   3. la RÉSOLUTION les noms se traduisent-ils en adresses ?
//
// Un ping vers un nom échoue dans les trois cas, avec trois messages
// différents que personne ne lit. L'assistant les sépare, dans cet ordre, et
// s'arrête de conclure dès que l'étage inférieur est en cause.
// ===========================================================================

const linuxNetworkDiagnostic = {
  id: 'linux-network-diagnostic',
  icon: '◇',
  category: CAT,
  subcategory: 'Réseau Linux',
  title: 'Diagnostiquer le réseau : lien, route, puis résolution',
  risk: 'diagnostic',
  summary: 'Lit les interfaces, les adresses, les routes, la table des voisins et les sockets en écoute, puis sépare les trois pannes que « je n’ai pas Internet » confond : le lien, la route, la résolution. Teste au besoin la passerelle avant la cible — un ping qui échoue vers un nom ne dit pas lequel des trois étages est en cause. N’écrit rien et ne configure rien.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'iproute2 — ip, ss (présent par défaut)',
    'iputils-ping — ping (présent par défaut)',
    'iputils-tracepath — tracepath (présent par défaut)',
    'systemd — networkctl, resolvectl (présent par défaut)',
  ],
  privileges: 'aucun pour lire les adresses, les routes et les voisins ; root pour voir le PROCESSUS derrière chaque socket en écoute',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: null,
  limites: [
    'LIT seulement. Aucun « ip addr add », aucun « ip route add », aucun « ip link set » : configurer une interface à la main survit jusqu’au prochain redémarrage et masque alors le vrai problème, qui est dans la configuration persistante.',
    'N’écrit aucune configuration Netplan ni NetworkManager : c’est l’assistant de préparation Netplan qui s’en occupe, et lui non plus n’applique rien.',
    'Les tests de connectivité envoient des paquets ICMP et UDP — c’est leur objet. Ils sont facultatifs, et bornés à trois paquets et quelques secondes : un diagnostic ne doit pas devenir un test de charge.',
    'Un ping qui échoue ne prouve pas qu’un hôte est éteint : beaucoup de pare-feux bloquent ICMP et laissent passer le reste. L’assistant le dit plutôt que de conclure.',
    'Ne touche pas au sans-fil : associer une interface Wi-Fi demande des identifiants, et aucun identifiant n’entre dans un formulaire de ce lot.',
  ],

  fields: [
    {
      id: 'interface',
      label: 'Interface (vide = toutes)',
      type: 'text',
      default: '',
      placeholder: 'enp0s3',
      optionnel: true,
      help: 'Laisse vide pour examiner toutes les interfaces. Les noms prévisibles d’Ubuntu ressemblent à enp0s3 ou ens18 : « eth0 » n’existe plus sur une installation récente.',
    },
    {
      id: 'cible',
      label: 'Cible du test de connectivité',
      type: 'text',
      default: 'archive.ubuntu.com',
      placeholder: 'archive.ubuntu.com',
      help: 'Un nom pour éprouver la résolution ET la route ; une adresse IP pour éprouver la route seule. Les deux ensemble disent lequel des deux étages est en cause.',
    },
    {
      id: 'testerConnectivite',
      label: 'Tester la connectivité',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Oui envoie trois paquets vers la passerelle, puis vers la cible, et trace le chemin. Non se limite à la lecture de l’état local.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const iface = String(v.interface ?? '').trim();
    if (iface !== '') {
      const r = validateNomInterface(iface);
      if (!r.ok) errors.interface = r.error;
    }
    const c = validateHote(v.cible, 'La cible');
    if (!c.ok) errors.cible = c.error;
    const t = validateChoix(v.testerConnectivite, ['Oui', 'Non'], 'Le test de connectivité');
    if (!t.ok) errors.testerConnectivite = t.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const iface = String(v.interface ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer le reseau : lien, route, puis resolution',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'la lecture de l etat reseau ne demande rien ; root n est utile que pour voir le processus derriere chaque socket',
      }),
      ...blocVariablesBash([
        ['KJEMO_IFACE', shQuote(iface)],
        ['KJEMO_CIBLE', shQuote(String(v.cible).trim())],
        ['KJEMO_TESTER', shQuote(String(v.testerConnectivite))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Interface' \"${KJEMO_IFACE:-toutes}\"",
      "  printf '%s\\t%s\\n' 'Cible du test' \"${KJEMO_CIBLE}\"",
      "  printf '%s\\t%s\\n' 'Test de connectivite' \"${KJEMO_TESTER}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - rien n est configure'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LES OUTILS, ET CELUI QU IL NE FAUT PLUS CHERCHER',
      '#',
      '# ifconfig et route ne sont plus installes par defaut depuis des annees :',
      '# ils viennent du paquet net-tools, et leur sortie ne montre pas les',
      '# adresses secondaires ni les regles de routage par source. On ne les',
      '# utilise pas, et on le dit — parce que leur absence fait croire a une',
      '# machine mal installee.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      'for kjemo_o in ip ss; do',
      '  if kjemo_dispo "${kjemo_o}"; then',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'OK' 'present' ''",
      '  else',
      '    KJEMO_OUTILS_OK=0',
      "    kjemo_resultat 'Prerequis' \"${kjemo_o}\" 'PROBLEME' 'absent' \\",
      "      'Le paquet iproute2 est absent, ce qui est tres inhabituel : apt install iproute2.'",
      '  fi',
      'done',
      'if ! kjemo_dispo ifconfig; then',
      "  kjemo_resultat 'Prerequis' 'ifconfig' 'INFO' 'absent, et c est normal' \\",
      "    'ifconfig vient du paquet net-tools, qui n est plus installe par defaut. Son absence n est pas un probleme : « ip » le remplace et en montre plus — adresses secondaires, routes par source, etat du lien.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE LIEN : PREMIER ETAGE',
      '#',
      '# Trois etats a ne pas confondre, et ils se lisent sur la meme ligne :',
      '#   DOWN            l interface est administrativement eteinte.',
      '#   UP, NO-CARRIER  l interface est allumee et ne recoit aucun signal :',
      '#                   cable debranche, port de commutateur eteint, ou VLAN',
      '#                   absent cote commutateur.',
      '#   UP, LOWER_UP    le lien est etabli.',
      '#',
      '# NO-CARRIER est le cas qu on cherche le plus longtemps, parce que',
      '# l interface apparait « UP » dans une lecture rapide.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_OUTILS_OK}" -eq 1 ]; then',
      '  kjemo_args_l=(ip -brief link show)',
      '  if [ -n "${KJEMO_IFACE}" ]; then kjemo_args_l+=(dev "${KJEMO_IFACE}"); fi',
      '  KJEMO_LIENS="$("${kjemo_args_l[@]}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_LIENS}" ]; then',
      "    kjemo_resultat 'Lien' \"${KJEMO_IFACE:-toutes}\" 'PROBLEME' 'aucune interface' \\",
      "      'Aucune interface de ce nom. Les noms previsibles d Ubuntu ressemblent a enp0s3 ou ens18 : « eth0 » n existe plus sur une installation recente, et une configuration qui le nomme ne s applique a rien.'",
      '  else',
      "    kjemo_resultat 'Lien' 'Interfaces' 'INFO' \"${KJEMO_LIENS}\" \\",
      "      'Une ligne par interface : nom, etat, adresse materielle. « UP » suivi de NO-CARRIER signifie allumee mais sans signal.'",
      '    # NO-CARRIER, cherche explicitement : c est le diagnostic que la',
      '    # lecture rapide rate.',
      '    KJEMO_SANS_SIGNAL="$(printf \'%s\\n\' "${KJEMO_LIENS}" | grep -i \'NO-CARRIER\' || true)"',
      '    if [ -n "${KJEMO_SANS_SIGNAL}" ]; then',
      "      kjemo_resultat 'Lien' 'Sans signal' 'PROBLEME' \"${KJEMO_SANS_SIGNAL}\" \\",
      "        'Ces interfaces sont allumees et ne recoivent AUCUN signal : cable debranche, port de commutateur eteint, ou VLAN absent du cote commutateur. Aucune configuration IP n y changera quoi que ce soit — c est le premier etage, et il faut le reparer avant de regarder plus haut.'",
      '    fi',
      '    KJEMO_ETEINTES="$(printf \'%s\\n\' "${KJEMO_LIENS}" | grep -E \' DOWN \' || true)"',
      '    if [ -n "${KJEMO_ETEINTES}" ]; then',
      "      kjemo_resultat 'Lien' 'Interfaces eteintes' 'ATTENTION' \"${KJEMO_ETEINTES}\" \\",
      "        'Administrativement eteintes. Une interface qu aucune configuration ne reclame reste eteinte, et c est normal — ce n est un probleme que si c est celle qu on attendait.'",
      '    fi',
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LES ADRESSES',
      '#',
      '# Une adresse en 169.254.x.x est la signature d un DHCP qui n a pas',
      '# repondu : l interface s est attribuee une adresse de lien local. Elle',
      '# n est pas routable, et c est la panne qui ressemble le plus a « j ai une',
      '# adresse, donc le reseau marche ».',
      '# ---------------------------------------------------------------------------',
      '  kjemo_args_a=(ip -brief address show)',
      '  if [ -n "${KJEMO_IFACE}" ]; then kjemo_args_a+=(dev "${KJEMO_IFACE}"); fi',
      '  KJEMO_ADRESSES="$("${kjemo_args_a[@]}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Adresses' 'Configurees' 'INFO' \"${KJEMO_ADRESSES}\" \\",
      "    'Une ligne par interface, avec toutes ses adresses. Plusieurs adresses sur une interface est normal et courant.'",
      '  KJEMO_LIEN_LOCAL="$(printf \'%s\\n\' "${KJEMO_ADRESSES}" | grep \'169\\.254\\.\' || true)"',
      '  if [ -n "${KJEMO_LIEN_LOCAL}" ]; then',
      "    kjemo_resultat 'Adresses' 'Adresse de lien local' 'PROBLEME' \"${KJEMO_LIEN_LOCAL}\" \\",
      "      'Une adresse en 169.254.x.x signifie que le DHCP n a PAS repondu : l interface s en est attribuee une elle-meme, et elle n est pas routable. C est la panne qui ressemble le plus a « j ai une adresse, donc tout va bien ».'",
      '  fi',
      '  if [ -z "${KJEMO_ADRESSES}" ] || ! printf \'%s\\n\' "${KJEMO_ADRESSES}" | grep -qE \'[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+\'; then',
      "    kjemo_resultat 'Adresses' 'IPv4' 'PROBLEME' 'aucune adresse IPv4' \\",
      "      'Aucune adresse IPv4 configuree. Si une adresse etait attendue par DHCP, c est le serveur DHCP ou le VLAN qu il faut regarder ; si elle etait statique, c est la configuration persistante.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LA ROUTE : DEUXIEME ETAGE',
      '#',
      '# Sans route par defaut, tout ce qui sort du reseau local echoue — et le',
      '# message est « Network is unreachable », qu on prend pour une panne du',
      '# reseau distant. Le reseau local, lui, continue de fonctionner, ce qui',
      '# brouille le diagnostic.',
      '# ---------------------------------------------------------------------------',
      '  KJEMO_ROUTES="$(ip route show 2>/dev/null || true)"',
      "  kjemo_resultat 'Routes' 'Table principale' 'INFO' \"${KJEMO_ROUTES}\" \\",
      "    'La ligne qui commence par « default » est la route par defaut : tout ce qui n est pas sur un reseau local passe par elle.'",
      '  KJEMO_PASSERELLE="$(ip route show default 2>/dev/null | awk \'{print $3; exit}\' || true)"',
      '  if [ -n "${KJEMO_PASSERELLE}" ]; then',
      "    kjemo_resultat 'Routes' 'Passerelle par defaut' 'OK' \"${KJEMO_PASSERELLE}\" \\",
      "      'Adresse de la passerelle. Sa presence dans la table ne dit pas qu elle repond : c est le test de l etape 7 qui le dira.'",
      '    KJEMO_NB_DEFAUT="$(ip route show default 2>/dev/null | grep -c . || true)"',
      '    if [ "${KJEMO_NB_DEFAUT:-0}" -gt 1 ] 2>/dev/null; then',
      "      kjemo_resultat 'Routes' 'Plusieurs routes par defaut' 'ATTENTION' \"${KJEMO_NB_DEFAUT}\" \\",
      "        'Plusieurs routes par defaut coexistent. Le noyau choisit celle dont la metrique est la plus basse ; les autres ne servent qu en secours. C est voulu sur une machine a deux liens, et accidentel sur une machine ou deux configurations se superposent — par exemple Netplan et une configuration restee de NetworkManager.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'Routes' 'Passerelle par defaut' 'PROBLEME' 'absente' \\",
      "      'Aucune route par defaut : tout ce qui sort du reseau local echoue avec « Network is unreachable », message qu on prend pour une panne du reseau distant. Le reseau local, lui, continue de fonctionner, ce qui brouille le diagnostic.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LES VOISINS, ET L ADRESSE EN DOUBLE',
      '#',
      '# La table des voisins — l ancien cache ARP — est le seul endroit ou se',
      '# voit une adresse IP dupliquee sur le reseau : deux machines repondent',
      '# pour la meme adresse, et la connexion marche une fois sur deux. C est',
      '# une panne qui resiste a tous les diagnostics qui ne regardent que la',
      '# machine locale.',
      '# ---------------------------------------------------------------------------',
      '  KJEMO_VOISINS="$(ip neigh show 2>/dev/null | head -20 || true)"',
      "  kjemo_resultat 'Voisins' 'Table' 'INFO' \"${KJEMO_VOISINS:-vide}\" \\",
      "    'Les machines du reseau local vues recemment. « REACHABLE » est bon, « STALE » signifie seulement « pas verifie recemment », et « FAILED » que la machine n a pas repondu a la resolution d adresse materielle.'",
      '  KJEMO_ECHECS_V="$(printf \'%s\\n\' "${KJEMO_VOISINS}" | grep -c \'FAILED\' || true)"',
      '  if [ "${KJEMO_ECHECS_V:-0}" -gt 0 ] 2>/dev/null; then',
      "    kjemo_resultat 'Voisins' 'Resolutions echouees' 'ATTENTION' \"${KJEMO_ECHECS_V}\" \\",
      "      'Ces adresses du reseau local n ont pas repondu. Pour la passerelle, c est bloquant ; pour une machine eteinte, c est normal.'",
      '  fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - QUI ECOUTE, ET SUR QUELLE ADRESSE',
      '#',
      '# La distinction qui compte : un service lie a 127.0.0.1 n est joignable',
      '# QUE depuis la machine elle-meme. C est la cause de la moitie des',
      '# « le service tourne mais je ne peux pas m y connecter » — et le pare-feu',
      '# n y est pour rien.',
      '# ---------------------------------------------------------------------------',
      '  KJEMO_ECOUTE="$(ss -lntup 2>/dev/null | head -30 || true)"',
      "  kjemo_resultat 'Sockets' 'En ecoute' 'INFO' \"${KJEMO_ECOUTE}\" \\",
      "    'Les options, lettre par lettre : -l en ecoute seulement, -n sans resoudre les noms, -t TCP, -u UDP, -p le processus. Le processus n apparait que pour root.'",
      '  KJEMO_LOCAL_SEUL="$(printf \'%s\\n\' "${KJEMO_ECOUTE}" | awk \'$5 ~ /^127\\.0\\.0\\.1:/ {print $5, $7}\' | head -10 || true)"',
      '  if [ -n "${KJEMO_LOCAL_SEUL}" ]; then',
      "    kjemo_resultat 'Sockets' 'Lies a 127.0.0.1 seulement' 'ATTENTION' \"${KJEMO_LOCAL_SEUL}\" \\",
      "      'Ces services n acceptent QUE des connexions venant de la machine elle-meme. Depuis l exterieur, la connexion est refusee sans que le pare-feu y soit pour rien — et c est la cause de la moitie des « le service tourne mais je ne peux pas m y connecter ».'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - LES TESTS, DANS L ORDRE DES ETAGES',
      '#',
      '# La passerelle AVANT la cible, et une adresse AVANT un nom. Chaque test',
      '# ne vaut que si le precedent a reussi, et c est ce qui transforme',
      '# « je n ai pas Internet » en une cause precise.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_TESTER}" = \'Oui\' ] && [ "${KJEMO_OUTILS_OK}" -eq 1 ]; then',
      '  if [ -n "${KJEMO_PASSERELLE:-}" ] && kjemo_dispo ping; then',
      '    kjemo_code=0',
      '    ping -c 3 -W 2 -n -- "${KJEMO_PASSERELLE}" > "${KJEMO_TMP}/ping-gw.txt" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -eq 0 ]; then',
      '      KJEMO_RTT="$(grep -E \'rtt|round-trip\' "${KJEMO_TMP}/ping-gw.txt" | head -1 || true)"',
      "      kjemo_resultat 'Test' 'Passerelle' 'OK' \"${KJEMO_RTT:-repond}\" \\",
      "        'La passerelle repond : le lien et la route locale fonctionnent. Tout echec au-dela est plus loin.'",
      '    else',
      "      kjemo_resultat 'Test' 'Passerelle' 'PROBLEME' \"code ${kjemo_code}\" \\",
      "        'La passerelle ne repond pas. Inutile de chercher plus loin : le DNS et Internet ne peuvent pas fonctionner si le premier saut ne repond pas. Verifie le lien, le VLAN, et l adresse de la passerelle. Reserve : certaines passerelles sont configurees pour ignorer ICMP, et ce test est alors un faux negatif.'",
      '    fi',
      '  fi',
      '',
      '  # La cible : si c est un nom, l echec peut venir du DNS ou de la route.',
      '  # On teste donc une adresse NUMERIQUE en plus, pour separer les deux.',
      '  if kjemo_dispo ping; then',
      '    kjemo_code=0',
      '    ping -c 3 -W 2 -- "${KJEMO_CIBLE}" > "${KJEMO_TMP}/ping-cible.txt" 2>&1 || kjemo_code=$?',
      '    if [ "${kjemo_code}" -eq 0 ]; then',
      "      kjemo_resultat 'Test' \"Cible ${KJEMO_CIBLE}\" 'OK' 'repond' \\",
      "        'La cible repond : resolution, route et retour fonctionnent.'",
      '    else',
      '      KJEMO_RAISON="$(head -3 "${KJEMO_TMP}/ping-cible.txt" | tr \'\\n\' \' \' || true)"',
      '      case "${KJEMO_RAISON}" in',
      '        *"Name or service not known"*|*"Temporary failure in name resolution"*|*"Nom ou service inconnu"*)',
      "          kjemo_resultat 'Test' \"Cible ${KJEMO_CIBLE}\" 'PROBLEME' 'resolution impossible' \\",
      "            'Le nom ne se traduit pas en adresse : c est le TROISIEME etage, la resolution, et non la route. Lance le diagnostic DNS — la route est peut-etre parfaite.'",
      '          ;;',
      '        *"Network is unreachable"*|*"Reseau inaccessible"*|*"inaccessible"*)',
      "          kjemo_resultat 'Test' \"Cible ${KJEMO_CIBLE}\" 'PROBLEME' 'reseau inaccessible' \\",
      "            'Le noyau n a aucune route pour cette destination : c est le DEUXIEME etage. Regarde la route par defaut ci-dessus.'",
      '          ;;',
      '        *)',
      "          kjemo_resultat 'Test' \"Cible ${KJEMO_CIBLE}\" 'PROBLEME' \"${KJEMO_RAISON}\" \\",
      "            'La cible ne repond pas. Un pare-feu intermediaire peut bloquer ICMP sans bloquer le reste : ce test ne prouve pas que l hote est eteint.'",
      '          ;;',
      '      esac',
      '    fi',
      '  fi',
      '',
      '  # Le chemin : il montre OU la progression s arrete, ce qu un ping',
      '  # binaire ne dit pas.',
      '  if kjemo_dispo tracepath; then',
      '    KJEMO_CHEMIN="$(timeout 20 tracepath -m 8 -- "${KJEMO_CIBLE}" 2>&1 | head -12 || true)"',
      "    kjemo_resultat 'Test' 'Chemin' 'INFO' \"${KJEMO_CHEMIN}\" \\",
      "      'Huit sauts au plus, vingt secondes au plus. Le saut ou la progression s arrete est le dernier equipement qui a repondu : la panne est juste apres. Des sauts « no reply » au milieu d un chemin qui aboutit sont normaux — certains equipements ne repondent pas.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Test' 'Connectivite' 'IGNORE' 'non demande' \\",
      "    'Seul l etat local a ete lu. Aucun paquet n a ete envoye.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 8 - QUI CONFIGURE CE RESEAU ?',
      '#',
      '# La question a poser AVANT de modifier quoi que ce soit : deux moteurs',
      '# qui configurent la meme interface se defont mutuellement, et le symptome',
      '# est une configuration qui « revient » apres quelques secondes.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo networkctl; then',
      '  KJEMO_NETWORKCTL="$(networkctl list --no-pager 2>/dev/null | head -15 || true)"',
      "  kjemo_resultat 'Moteur' 'systemd-networkd' 'INFO' \"${KJEMO_NETWORKCTL}\" \\",
      "    'La colonne SETUP dit si networkd gere l interface : « configured » oui, « unmanaged » non. Une interface unmanaged est geree par quelqu un d autre — NetworkManager, ou personne.'",
      'fi',
      'if kjemo_dispo nmcli; then',
      '  KJEMO_NMCLI="$(nmcli -t -f DEVICE,TYPE,STATE device status 2>/dev/null | head -10 || true)"',
      '  if [ -n "${KJEMO_NMCLI}" ]; then',
      "    kjemo_resultat 'Moteur' 'NetworkManager' 'ATTENTION' \"${KJEMO_NMCLI}\" \\",
      "      'NetworkManager est present et repond. Sur un serveur Ubuntu, c est generalement Netplan avec systemd-networkd qui configure : si les deux gerent la meme interface, leurs configurations se defont mutuellement, et le symptome est un reglage qui « revient » apres quelques secondes.'",
      '  fi',
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-reseau' }),
    ]);
  },

  gui: [
    'Dans l’ordre des étages, et pas autrement. 1. Le lien : « ip -brief link show ». Cherche NO-CARRIER — allumée, sans signal.',
    '2. Les adresses : « ip -brief address show ». Une adresse en 169.254.x.x veut dire que le DHCP n’a pas répondu.',
    '3. La route : « ip route show default ». Sans route par défaut, tout ce qui sort du réseau local échoue.',
    '4. La passerelle répond-elle : « ping -c 3 <passerelle> ». Inutile de chercher plus loin si elle ne répond pas.',
    '5. Une adresse numérique, puis un nom : si l’adresse passe et le nom échoue, c’est le DNS, pas la route.',
    'Qui écoute, et sur quelle adresse : « ss -lntup ». Un service lié à 127.0.0.1 n’est joignable que localement.',
    'Les voisins, seul endroit où se voit une adresse IP dupliquée : « ip neigh show ».',
    'Où le chemin s’arrête : « tracepath <cible> ».',
    'Qui configure l’interface : « networkctl list ». La colonne SETUP dit « configured » ou « unmanaged ».',
    'ifconfig et route n’existent plus par défaut : ce n’est pas une machine mal installée, c’est « ip » qui les remplace.',
  ],

  keywords: ['reseau', 'network', 'ip', 'adresse', 'route', 'passerelle', 'gateway',
    'ss', 'socket', 'ecoute', 'ping', 'tracepath', 'voisin', 'arp', 'neigh',
    'no-carrier', 'dhcp', 'networkctl', 'nmcli', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour la lecture des adresses, des routes et des voisins.',
    'sudo pour voir le PROCESSUS derrière chaque socket en écoute — sans privilège, la colonne reste vide.',
    'Le nom de l’interface si le diagnostic est ciblé : « ip -brief link show » le donne.',
  ],

  commonErrors: [
    {
      message: 'ping: connect: Network is unreachable',
      code: 'ENETUNREACH',
      cause: 'Aucune route pour cette destination — le plus souvent, pas de route par défaut. Le réseau local continue de fonctionner, ce qui fait croire à une panne du réseau distant.',
      fix: 'Regarder la route par défaut. Si elle manque, c’est la configuration persistante qu’il faut corriger, pas une commande « ip route add » qui ne survivra pas au redémarrage.',
      command: 'ip route show default',
    },
    {
      message: 'ping: archive.ubuntu.com: Temporary failure in name resolution',
      code: 'EAI_AGAIN',
      cause: 'La résolution échoue. La route peut être parfaite : ce sont deux étages différents.',
      fix: 'Tester une adresse numérique. Si elle répond, le problème est le DNS et rien d’autre.',
      command: 'ping -c 3 1.1.1.1',
    },
    {
      message: 'J’ai une adresse en 169.254.x.x',
      code: 'KJEMO',
      cause: 'Le DHCP n’a pas répondu : l’interface s’est attribué une adresse de lien local, qui n’est pas routable.',
      fix: 'Chercher pourquoi le DHCP ne répond pas — VLAN, câble, serveur. L’adresse n’est pas le problème, elle en est le symptôme.',
      command: 'ip -brief address show',
    },
    {
      message: 'L’interface est UP et rien ne passe',
      code: 'KJEMO',
      cause: 'NO-CARRIER : allumée, sans signal. Câble débranché, port de commutateur éteint, ou VLAN absent côté commutateur.',
      fix: 'Réparer le premier étage. Aucune configuration IP n’y changera quoi que ce soit.',
      command: 'ip -brief link show',
    },
    {
      message: 'Le service tourne et je ne peux pas m’y connecter depuis une autre machine',
      code: 'ECONNREFUSED',
      cause: 'Le service écoute sur 127.0.0.1 seulement. Le pare-feu n’y est pour rien.',
      fix: 'Regarder l’adresse d’écoute, puis la configuration du service — c’est lui qui décide.',
      command: 'ss -lntup',
    },
    {
      message: 'ifconfig: command not found',
      code: 'ENOENT',
      cause: 'net-tools n’est plus installé par défaut depuis des années.',
      fix: 'Utiliser « ip », qui le remplace et en montre plus. Installer net-tools pour retrouver une commande obsolète n’apporte rien.',
      command: 'ip -brief address show',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport traite les trois étages dans l’ordre : lien, adresses et route, puis résolution.',
    'NO-CARRIER et les adresses en 169.254.x.x sont signalés explicitement, pas noyés dans une sortie brute.',
    'L’absence de route par défaut est un PROBLEME nommé, avec son message d’erreur habituel.',
    'Les services liés à 127.0.0.1 seulement sont listés à part.',
    'Si les tests ont été demandés : la passerelle a été testée AVANT la cible, et l’échec de résolution est distingué de l’échec de route.',
    'Aucune configuration n’a été modifiée : le script n’appelle ni « ip addr add », ni « ip route add », ni « ip link set ».',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant ne fait que lire, et les tests de connectivité n’envoient que quelques paquets.',
    diagnostic: `# L etat complet, dans l ordre des etages :
ip -brief link show
ip -brief address show
ip route show
ip neigh show
ss -lntup`,
    command: `# Aucune modification a annuler.
#
# Et une mise en garde qui vaut pour la suite : une correction faite avec
# « ip addr add » ou « ip route add » tient jusqu au prochain redemarrage,
# puis disparait — en laissant croire que le probleme est revenu tout seul.
# La configuration persistante d Ubuntu Server est dans /etc/netplan :
# c est la qu une correction doit aller, et l assistant de preparation
# Netplan la prepare sans l appliquer.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: null,
  },

  checks: [
    'Aucune écriture : ni « ip addr add », ni « ip route add », ni « ip link set », ni aucune modification de configuration.',
    'Les trois étages sont traités dans l’ordre — lien, route, résolution — et le rapport dit lequel bloque.',
    'NO-CARRIER est cherché explicitement : c’est l’état qu’une lecture rapide prend pour « UP ».',
    'Les adresses de lien local 169.254.x.x sont signalées comme la signature d’un DHCP sans réponse.',
    'L’absence de route par défaut, et la présence de PLUSIEURS routes par défaut, sont signalées séparément.',
    'La passerelle est testée avant la cible, et son échec arrête toute conclusion sur la suite.',
    'Un échec de résolution est distingué d’un échec de route par le MESSAGE de ping, pas par supposition.',
    'La réserve sur ICMP est écrite : un ping qui échoue ne prouve pas qu’un hôte est éteint.',
    'Les sockets liés à 127.0.0.1 sont extraits séparément, et chaque lettre des options de ss est expliquée.',
    'Le moteur de configuration est identifié, et la coexistence de networkd et NetworkManager est signalée comme ATTENTION.',
    'tracepath est borné à huit sauts et vingt secondes : un diagnostic ne devient pas un test de charge.',
  ],

  source: `${M}/man8/ip.8.html`,
  sources: [
    { label: 'ip(8)', url: `${M}/man8/ip.8.html` },
    { label: 'ip-address(8)', url: `${M}/man8/ip-address.8.html` },
    { label: 'ip-route(8)', url: `${M}/man8/ip-route.8.html` },
    { label: 'ip-neighbour(8) — la table des voisins', url: `${M}/man8/ip-neighbour.8.html` },
    { label: 'ss(8)', url: `${M}/man8/ss.8.html` },
    { label: 'ping(8)', url: `${M}/man8/ping.8.html` },
    { label: 'tracepath(8)', url: `${M}/man8/tracepath.8.html` },
    { label: 'networkctl(1)', url: `${M}/man1/networkctl.1.html` },
  ],
};

// ===========================================================================
// ASSISTANT 2 — PRÉPARER UNE CONFIGURATION NETPLAN, SANS JAMAIS L'APPLIQUER
// ===========================================================================

const METHODES = {
  'DHCP': 'dhcp',
  'Adresse statique': 'statique',
};

/**
 * Contrôle de la passerelle d'une configuration statique.
 *
 * Elle est FACULTATIVE : sans elle, la configuration ne déclare aucune route
 * par défaut (un réseau isolé n'en veut pas). Quand elle est renseignée, elle
 * doit désigner une machine du réseau — et pas n'importe quelle adresse du
 * réseau. Netplan accepte sans se plaindre une passerelle égale à l'adresse de
 * l'hôte (la machine se prend pour sa propre sortie), à l'adresse du réseau ou
 * à celle de diffusion : « netplan generate » ne voit aucune de ces fautes, et
 * le réseau ne route plus rien.
 *
 * Renvoie le message d'erreur, ou null.
 */
function erreurPasserelle(adresse, passerelle) {
  const p = validateIPv4(passerelle, 'La passerelle');
  if (!p.ok) return p.error;
  const a = validateAdresseCidr(adresse, 'L’adresse');
  if (!a.ok) return null; // l'adresse porte sa propre erreur
  const [ip, prefixe] = adresse.split('/');
  const bits = Number(prefixe);
  const enEntier = (x) => x.split('.').reduce((acc, o) => (acc * 256) + Number(o), 0);
  const masque = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  const hote = enEntier(ip);
  const gw = enEntier(passerelle);
  const reseau = (hote & masque) >>> 0;
  const diffusion = (reseau | (~masque >>> 0)) >>> 0;
  if (((gw & masque) >>> 0) !== reseau) {
    return `La passerelle « ${passerelle} » n’appartient pas au réseau de « ${adresse} ». Netplan génère cette configuration sans se plaindre, et le réseau ne fonctionne pas : le noyau n’a aucun moyen de joindre une passerelle hors de son propre réseau. C’est la faute la plus fréquente de ce formulaire, et la seule que « netplan generate » ne voit pas.`;
  }
  if (gw === hote) {
    return `La passerelle « ${passerelle} » est l’adresse de la machine elle-même (« ${ip} »). La machine serait sa propre sortie : aucun paquet ne quitterait le réseau, et « netplan generate » ne s’en plaint pas. Saisis l’adresse du routeur, ou laisse la passerelle vide si aucune route par défaut n’est voulue.`;
  }
  if (bits <= 30 && gw === reseau) {
    return `La passerelle « ${passerelle} » est l’adresse du RÉSEAU lui-même (le premier numéro du réseau ${adresse}), pas celle d’une machine : aucun routeur ne peut y répondre. Saisis l’adresse du routeur, ou laisse la passerelle vide.`;
  }
  if (bits <= 30 && gw === diffusion) {
    return `La passerelle « ${passerelle} » est l’adresse de DIFFUSION du réseau ${adresse}, pas celle d’une machine : elle s’adresse à tout le monde à la fois et aucun routeur ne peut la porter. Saisis l’adresse du routeur, ou laisse la passerelle vide.`;
  }
  return null;
}

const netplanReadiness = {
  id: 'netplan-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'Réseau Linux',
  title: 'Préparer une configuration Netplan, validée sans être appliquée',
  risk: 'caution',
  summary: 'Identifie le moteur réseau, inventorie les fichiers Netplan existants et leurs permissions, puis prépare le fichier YAML demandé et le VALIDE sur une copie avec « netplan generate --root-dir » — dont la page de manuel dit qu’il n’applique rien. N’écrit jamais dans /etc/netplan, n’exécute jamais « netplan apply », et affiche les deux commandes à taper soi-même, « netplan try » d’abord.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'netplan.io — netplan (présent par défaut sur Ubuntu Server)',
    'systemd — systemd-networkd (présent par défaut)',
  ],
  privileges: 'root — les fichiers de /etc/netplan ne sont lisibles que par root, et c’est voulu : ils peuvent contenir des clés Wi-Fi',
  privilegesRequis: 'root',
  readOnly: false,
  service: 'systemd-networkd.service',
  limites: [
    'N’EXÉCUTE JAMAIS « netplan apply ». Sur une machine administrée à distance, une configuration fautive coupe la session SSH au moment même où elle s’applique, et il n’y a plus personne pour la corriger. C’est le mode de panne le plus courant du sujet.',
    'N’écrit rien dans /etc/netplan. Le fichier préparé va dans le dossier personnel, avec les deux commandes à taper : « netplan try » d’abord, qui revient tout seul en arrière après 120 secondes si personne ne confirme.',
    'N’exécute pas « netplan try » non plus : il demande un terminal interactif. Un script qui le lancerait sans terminal appliquerait la configuration puis la laisserait revenir en arrière — le pire des deux mondes.',
    'Ne configure pas le sans-fil : une clé Wi-Fi est un secret, et aucun secret n’entre dans un formulaire de ce lot.',
    'Ne modifie JAMAIS un fichier produit par cloud-init (50-cloud-init.yaml en général : il est réécrit à chaque démarrage). Il le repère à son en-tête, l’annonce, et prépare un CANDIDAT SÉPARÉ sous un autre nom. Il refuse aussi un nom déjà présent dans /etc/netplan, et s’arrête quand plusieurs fichiers déclarent déjà l’interface.',
    'Ne touche pas aux fichiers Netplan existants, même pour les corriger. Il les lit, signale ce qui cloche, et laisse décider — plusieurs fichiers qui se superposent sont un cas légitime autant qu’un accident.',
    'IPv4 seulement. Une configuration IPv6 a ses propres pièges — autoconfiguration, adresses temporaires, routes annoncées — et les mélanger dans le même formulaire rendrait les deux obscures.',
  ],

  fields: [
    {
      id: 'interface',
      label: 'Interface à configurer',
      type: 'text',
      default: 'enp0s3',
      placeholder: 'enp0s3',
      help: 'Le nom EXACT, tel que « ip -brief link show » l’affiche. Une configuration qui nomme une interface inexistante est générée sans erreur et ne s’applique à rien.',
    },
    {
      id: 'methode',
      label: 'Méthode',
      type: 'select',
      default: 'DHCP',
      options: Object.keys(METHODES).map((k) => [k, k]),
      help: 'DHCP laisse le serveur décider. Statique exige l’adresse, la passerelle et les serveurs DNS — un serveur sans adresse fixe est un serveur qu’on cherche.',
    },
    {
      id: 'adresseCidr',
      label: 'Adresse avec préfixe (statique)',
      type: 'text',
      default: '192.168.30.10/24',
      placeholder: '192.168.30.10/24',
      optionnel: true,
      help: 'Obligatoire en statique, ignorée en DHCP. Le préfixe fait partie de l’adresse pour Netplan : « 192.168.30.10 » seul est refusé.',
    },
    {
      id: 'passerelle',
      label: 'Passerelle (statique, facultative)',
      type: 'text',
      default: '192.168.30.1',
      placeholder: '192.168.30.1',
      optionnel: true,
      help: 'Facultative : laisse-la vide si aucune route par défaut n’est voulue (réseau isolé). Renseignée, elle doit être une AUTRE machine du même réseau que l’adresse : ni l’adresse de l’hôte, ni celle du réseau, ni celle de diffusion. Ignorée en DHCP. L’assistant vérifie chacun de ces points.',
    },
    {
      id: 'dns',
      label: 'Serveurs DNS (statique)',
      type: 'text',
      default: '192.168.30.1 1.1.1.1',
      placeholder: '192.168.30.1 1.1.1.1',
      optionnel: true,
      help: 'Séparés par des espaces ou des virgules, trois au plus. En statique, aucun serveur DNS n’est fourni automatiquement : sans eux, les noms ne se résolvent plus.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation — retape le nom de l’interface',
      type: 'text',
      default: '',
      placeholder: 'enp0s3',
      optionnel: true,
      help: 'Sans cette phrase exacte, le script valide la configuration et l’affiche, sans laisser de fichier sur le disque ni remettre la procédure d’application. Le verrou ne porte pas sur une application — il n’y en a aucune — mais sur le fait de laisser un fichier prêt à être posé.',
    },
    {
      id: 'nomFichier',
      label: 'Nom du fichier préparé',
      type: 'text',
      default: '99-kjemo-reseau.yaml',
      placeholder: '99-kjemo-reseau.yaml',
      help: 'Netplan lit les fichiers de /etc/netplan dans l’ordre alphabétique : un nom commençant par 99 passe en dernier et l’emporte sur les autres. Le nom ne doit pas contenir « cloud-init » : ce fichier-là est régénéré par cloud-init et ne se remplace pas. À l’exécution, le script refuse aussi un nom déjà présent dans /etc/netplan.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const i = validateNomInterface(v.interface);
    if (!i.ok) errors.interface = i.error;
    const m = validateChoix(v.methode, Object.keys(METHODES), 'La méthode');
    if (!m.ok) errors.methode = m.error;

    const statique = String(v.methode) === 'Adresse statique';
    const adresse = String(v.adresseCidr ?? '').trim();
    const passerelle = String(v.passerelle ?? '').trim();
    const dns = String(v.dns ?? '').trim().split(/[\s,]+/).filter((x) => x !== '');

    if (statique) {
      const a = validateAdresseCidr(adresse, 'L’adresse');
      if (!a.ok) errors.adresseCidr = a.error;
      if (passerelle !== '') {
        const e = erreurPasserelle(adresse, passerelle);
        if (e !== null) errors.passerelle = e;
      }
      if (dns.length === 0) {
        errors.dns = 'En adresse statique, aucun serveur DNS n’est fourni automatiquement : sans eux, les noms ne se résolvent plus, et le symptôme ressemble à une panne réseau complète alors que la route fonctionne.';
      }
    }
    if (dns.length > 3) {
      errors.dns = `Trois serveurs DNS au plus, ${dns.length} demandés. Au-delà, le résolveur n’interroge de toute façon pas les suivants dans un délai utile.`;
    }
    for (const d of dns) {
      const r = validateIPv4(d, `Le serveur DNS « ${d} »`);
      if (!r.ok) { errors.dns = r.error; break; }
    }
    const f = validateNomFichier(v.nomFichier, 'Le nom du fichier');
    if (!f.ok) {
      errors.nomFichier = f.error;
    } else if (!/\.yaml$/.test(String(v.nomFichier).trim())) {
      errors.nomFichier = 'Le nom doit finir par « .yaml ». Netplan ne lit que les fichiers *.yaml de /etc/netplan : un fichier nommé autrement est ignoré en silence, et on cherche longtemps pourquoi la configuration ne s’applique pas.';
    } else if (/cloud-init/i.test(String(v.nomFichier))) {
      errors.nomFichier = 'Le nom ne doit pas contenir « cloud-init ». Un fichier comme 50-cloud-init.yaml est PRODUIT par cloud-init et réécrit à chaque démarrage : le remplacer, c’est perdre le changement au prochain redémarrage ou, pire, croire avoir configuré une machine qui revient à l’ancienne configuration. Choisis un nom à toi, par exemple 99-kjemo-reseau.yaml.';
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const iface = String(v.interface).trim();
    const statique = String(v.methode) === 'Adresse statique';
    const adresse = String(v.adresseCidr ?? '').trim();
    const passerelle = String(v.passerelle ?? '').trim();
    const dns = String(v.dns ?? '').trim().split(/[\s,]+/).filter((x) => x !== '');
    const nomFichier = String(v.nomFichier).trim();

    // Le YAML est construit ligne par ligne, et chaque ligne est écrite par un
    // printf '%s\n' distinct. Deux raisons : l'indentation du YAML est
    // significative — un espace de trop invalide le fichier — et un
    // here-document aurait interprété une valeur contenant un « $ ».
    const yaml = [
      '# Prepare par KJEMO IT Toolkit - netplan-readiness',
      '# Ce fichier n a PAS ete applique. Voir les commandes a la fin du rapport.',
      'network:',
      '  version: 2',
      '  renderer: networkd',
      '  ethernets:',
      `    ${iface}:`,
      ...(statique ? [
        '      dhcp4: false',
        '      addresses:',
        `        - ${adresse}`,
        ...(passerelle !== '' ? [
          '      routes:',
          '        - to: default',
          `          via: ${passerelle}`,
        ] : []),
        '      nameservers:',
        '        addresses:',
        ...dns.map((d) => `          - ${d}`),
      ] : [
        '      dhcp4: true',
      ]),
    ];

    return assemblerSh([
      ...enteteBash({
        titre: 'Preparer une configuration Netplan, validee sans etre appliquee',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'les fichiers de /etc/netplan ne sont lisibles que par root, et c est voulu',
      }),
      ...blocVariablesBash([
        ['KJEMO_IFACE', shQuote(iface)],
        ['KJEMO_METHODE', shQuote(statique ? 'statique' : 'dhcp')],
        ['KJEMO_ADRESSE', shQuote(adresse)],
        ['KJEMO_PASSERELLE', shQuote(passerelle)],
        ['KJEMO_DNS', shQuote(dns.join(' '))],
        ['KJEMO_NOM_FICHIER', shQuote(nomFichier)],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? ''))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Interface' \"${KJEMO_IFACE}\"",
      "  printf '%s\\t%s\\n' 'Methode' \"${KJEMO_METHODE}\"",
      "  printf '%s\\t%s\\n' 'Adresse' \"${KJEMO_ADRESSE:-fournie par DHCP}\"",
      `  printf '%s\\t%s\\n' 'Passerelle' "\${KJEMO_PASSERELLE:-${statique ? 'aucune - pas de route par defaut' : 'fournie par DHCP'}}"`,
      "  printf '%s\\t%s\\n' 'DNS' \"${KJEMO_DNS:-fournis par DHCP}\"",
      "  printf '%s\\t%s\\n' 'Application' 'AUCUNE - netplan apply n est jamais lance'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' 'CE SCRIPT N APPLIQUE RIEN'",
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' '  Il prepare un fichier, le valide sur une COPIE, et vous'",
      "printf '%s\\n' '  donne les commandes a taper. « netplan apply » n apparait'",
      "printf '%s\\n' '  nulle part : sur une machine administree a distance, une'",
      "printf '%s\\n' '  configuration fautive coupe la session au moment ou elle'",
      "printf '%s\\n' '  s applique, et il n y a plus personne pour la corriger.'",
      "printf '%s\\n' '--------------------------------------------------------------'",
      "printf '%s\\n' ''",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LE MOTEUR, ET LES FICHIERS EXISTANTS',
      '#',
      '# Netplan ne configure rien lui-meme : il GENERE la configuration d un',
      '# moteur — systemd-networkd sur un serveur, NetworkManager sur un poste.',
      '# Savoir lequel repond change l interpretation de tout le reste.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_OUTILS_OK=1',
      'if ! kjemo_dispo netplan; then',
      '  KJEMO_OUTILS_OK=0',
      "  kjemo_resultat 'Prerequis' 'netplan' 'PROBLEME' 'absent' \\",
      "    'Cette machine n utilise pas Netplan. Sur Debian, la configuration persistante est dans /etc/network/interfaces ou geree par NetworkManager : la procedure est differente, et cet assistant ne s y applique pas.'",
      'else',
      '  KJEMO_VERSION_NP="$(netplan --version 2>/dev/null | head -1 || true)"',
      "  kjemo_resultat 'Prerequis' 'netplan' 'OK' \"${KJEMO_VERSION_NP:-present}\" ''",
      'fi',
      'if kjemo_dispo systemctl; then',
      '  KJEMO_NETWORKD="$(systemctl is-active systemd-networkd 2>/dev/null || true)"',
      '  KJEMO_NM="$(systemctl is-active NetworkManager 2>/dev/null || true)"',
      "  kjemo_resultat 'Moteur' 'systemd-networkd' 'INFO' \"${KJEMO_NETWORKD:-inconnu}\" ''",
      '  if [ "${KJEMO_NM}" = \'active\' ] && [ "${KJEMO_NETWORKD}" = \'active\' ]; then',
      "    kjemo_resultat 'Moteur' 'Les deux actifs' 'ATTENTION' 'networkd et NetworkManager' \\",
      "      'Les deux moteurs tournent. Si tous deux gerent la MEME interface, leurs configurations se defont mutuellement et le symptome est un reglage qui « revient » apres quelques secondes. Le fichier prepare declare « renderer: networkd » : verifie que NetworkManager ne gere pas cette interface, avec nmcli device status.'",
      '  fi',
      'fi',
      '',
      '# Le dossier est une CONSTANTE du script, jamais une variable d environnement :',
      '# la seule chose qu il inventorie, copie pour valider et protege, c est celui-ci.',
      "KJEMO_NETPLAN_DIR='/etc/netplan'",
      'KJEMO_NOM_LIBRE_OK=1',
      'KJEMO_CONCURRENCE_OK=1',
      'KJEMO_CLOUDINIT=""',
      'KJEMO_FICHIERS="$(find "${KJEMO_NETPLAN_DIR}" -maxdepth 1 \\( -name \'*.yaml\' -o -name \'*.yml\' \\) 2>/dev/null | sort || true)"',
      'if [ -z "${KJEMO_FICHIERS}" ]; then',
      "  kjemo_resultat 'Fichiers' '/etc/netplan' 'ATTENTION' 'aucun fichier' \\",
      "    'Aucune configuration Netplan. Sur une machine installee, c est inhabituel : le reseau est peut-etre configure par cloud-init, par NetworkManager, ou l interface est en DHCP sans configuration explicite.'",
      'else',
      "  kjemo_resultat 'Fichiers' 'Existants' 'INFO' \"${KJEMO_FICHIERS}\" \\",
      "    'Netplan les lit dans l ordre alphabetique, et le dernier l emporte cle par cle. Un fichier nomme 99-… passe apres 50-cloud-init.yaml, ce qui est generalement l intention.'",
      '  # Les fichiers en .yml sont IGNORES par netplan, qui ne lit que .yaml.',
      '  # C est une heure perdue garantie quand cela arrive.',
      '  KJEMO_YML="$(printf \'%s\\n\' "${KJEMO_FICHIERS}" | grep \'\\.yml$\' || true)"',
      '  if [ -n "${KJEMO_YML}" ]; then',
      "    kjemo_resultat 'Fichiers' 'Extension .yml' 'PROBLEME' \"${KJEMO_YML}\" \\",
      "      'Netplan ne lit QUE les fichiers *.yaml. Ces fichiers sont ignores en silence : leur contenu n a aucun effet, et on cherche longtemps pourquoi la configuration ne s applique pas.'",
      '  fi',
      '  # Les fichiers PRODUITS PAR cloud-init : leur en-tete le dit, et leur nom',
      '  # aussi (50-cloud-init.yaml). cloud-init les reecrit a chaque demarrage :',
      '  # ce script ne les modifie JAMAIS, et refuse de poser un fichier du meme nom.',
      '  while IFS= read -r kjemo_f; do',
      '    [ -n "${kjemo_f}" ] || continue',
      '    if head -n 10 -- "${kjemo_f}" 2>/dev/null | grep -qiE \'cloud-init|provided by the datasource\' || printf \'%s\\n\' "${kjemo_f##*/}" | grep -qi \'cloud-init\'; then',
      '      KJEMO_CLOUDINIT="${KJEMO_CLOUDINIT}${KJEMO_CLOUDINIT:+ }${kjemo_f}"',
      '    fi',
      '  done <<KJEMO_LISTE',
      '${KJEMO_FICHIERS}',
      'KJEMO_LISTE',
      '  if [ -n "${KJEMO_CLOUDINIT}" ]; then',
      "    kjemo_resultat 'Fichiers' 'Fichier produit par cloud-init' 'ATTENTION' \"${KJEMO_CLOUDINIT}\" \\",
      "      'Ce fichier est genere par cloud-init et reecrit a chaque demarrage : ce script ne le modifie JAMAIS. Le fichier prepare est un CANDIDAT SEPARE, sous un autre nom, valide avec les existants. Pour que cloud-init cesse de gerer le reseau, c est une decision a part (un fichier /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg avec network: {config: disabled}) que ce script ne prend pas.'",
      '  fi',
      '  # Un nom deja present dans le dossier serait ECRASE par la mise en place :',
      '  # le script le refuse, quel que soit le fichier.',
      '  if [ -e "${KJEMO_NETPLAN_DIR}/${KJEMO_NOM_FICHIER}" ] || [ -L "${KJEMO_NETPLAN_DIR}/${KJEMO_NOM_FICHIER}" ]; then',
      '    KJEMO_NOM_LIBRE_OK=0',
      "    kjemo_resultat 'Fichiers' 'Nom deja pris' 'PROBLEME' \"${KJEMO_NETPLAN_DIR}/${KJEMO_NOM_FICHIER}\" \\",
      "      'Un fichier de ce nom existe deja dans /etc/netplan : la mise en place l ecraserait. Choisis un autre nom. Le fichier existant n a pas ete touche.'",
      '  fi',
      '  # Les permissions : un fichier Netplan lisible par tous peut exposer une',
      '  # cle Wi-Fi. netplan lui-meme avertit depuis la version 0.106.',
      '  KJEMO_LARGES="$(find "${KJEMO_NETPLAN_DIR}" -maxdepth 1 -name \'*.yaml\' -perm /044 2>/dev/null || true)"',
      '  if [ -n "${KJEMO_LARGES}" ]; then',
      "    kjemo_resultat 'Fichiers' 'Permissions trop larges' 'ATTENTION' \"${KJEMO_LARGES}\" \\",
      "      'Ces fichiers sont lisibles par le groupe ou par tous. Un fichier Netplan peut contenir une cle Wi-Fi ou un mot de passe de connexion : le mode attendu est 600. netplan lui-meme avertit a chaque execution quand ce n est pas le cas.'",
      '  fi',
      '  # Les interfaces DEJA declarees : si la notre y est, deux fichiers',
      '  # vont se superposer, et il faut le savoir AVANT.',
      '  KJEMO_DEJA="$(grep -l -E \"^[[:space:]]+${KJEMO_IFACE}:\" "${KJEMO_NETPLAN_DIR}"/*.yaml 2>/dev/null || true)"',
      '  KJEMO_NB_DEJA="$(printf \'%s\\n\' "${KJEMO_DEJA}" | grep -c . || true)"',
      '  if [ "${KJEMO_NB_DEJA:-0}" -ge 2 ]; then',
      '    KJEMO_CONCURRENCE_OK=0',
      "    kjemo_resultat 'Fichiers' 'Interface declaree plusieurs fois' 'PROBLEME' \"${KJEMO_DEJA}\" \\",
      '      "L interface ${KJEMO_IFACE} est deja declaree dans ${KJEMO_NB_DEJA} fichiers. Ajouter un fichier de plus creerait une configuration CONCURRENTE de plus, et le dernier lu l emporterait cle par cle sans que personne ne sache lequel. Le script s arrete avant toute ecriture : mets d abord ces fichiers d accord. Aucun n a ete touche."',
      '  elif [ -n "${KJEMO_DEJA}" ]; then',
      "    kjemo_resultat 'Fichiers' 'Interface deja declaree' 'ATTENTION' \"${KJEMO_DEJA}\" \\",
      '      "L interface ${KJEMO_IFACE} est deja declaree dans ces fichiers. Le fichier prepare s ajoutera par-dessus : Netplan fusionne cle par cle, et le dernier lu l emporte. Ce n est pas forcement une erreur, mais il faut le savoir — notamment pour dhcp4, qui restera a sa valeur precedente si le nouveau fichier ne la nomme pas."',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - L INTERFACE EXISTE-T-ELLE VRAIMENT ?',
      '#',
      '# C est la premiere cause de configuration qui « ne fait rien » : le',
      '# fichier decrit eth0, aucune interface ne porte ce nom, et netplan ne',
      '# s en plaint pas. Il genere une configuration pour une interface',
      '# inexistante, et le reseau reste comme avant.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_IFACE_OK=0',
      'if kjemo_dispo ip; then',
      '  if ip -brief link show dev "${KJEMO_IFACE}" > /dev/null 2>&1; then',
      '    KJEMO_IFACE_OK=1',
      '    KJEMO_ETAT_IFACE="$(ip -brief link show dev "${KJEMO_IFACE}" 2>/dev/null || true)"',
      "    kjemo_resultat 'Interface' \"${KJEMO_IFACE}\" 'OK' \"${KJEMO_ETAT_IFACE}\" \\",
      "      'L interface existe. Son etat actuel n empeche pas de preparer la configuration : une interface eteinte sera allumee par le moteur quand la configuration s appliquera.'",
      '  else',
      '    KJEMO_PRESENTES="$(ip -brief link show 2>/dev/null | awk \'{print $1}\' | tr \'\\n\' \' \' || true)"',
      "    kjemo_resultat 'Interface' \"${KJEMO_IFACE}\" 'PROBLEME' 'inexistante' \\",
      '      "Aucune interface de ce nom. Celles qui existent : ${KJEMO_PRESENTES}. Netplan accepterait ce nom sans se plaindre et generait une configuration pour une interface inexistante : le reseau resterait comme avant, et rien n indiquerait pourquoi."',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE FICHIER PREPARE, DANS LE DOSSIER PERSONNEL',
      '#',
      '# Et PAS dans /etc/netplan, pour deux raisons. La premiere : y poser un',
      '# fichier, c est deja changer la configuration qui sera lue au prochain',
      '# demarrage, meme sans « netplan apply ». La seconde : une sauvegarde',
      '# nommee « 50-cloud-init.yaml.bak » dans /etc/netplan serait ignoree —',
      '# netplan ne lit que *.yaml — mais une sauvegarde nommee',
      '# « 50-cloud-init.yaml.2026.yaml » serait LUE, et personne ne s en',
      '# apercevrait avant le prochain redemarrage.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PREPARE_OK=0',
      'KJEMO_HORO="$(date +%Y%m%d-%H%M%S 2>/dev/null || printf \'%s\' inconnu)"',
      '# Le fichier est d abord ecrit dans le dossier TEMPORAIRE, qui disparait',
      '# a la sortie du script : avant la confirmation, rien ne reste sur le',
      '# disque. Il n est recopie dans le dossier personnel qu apres la porte',
      '# finale — c est cela que le verrou protege, et rien d autre : aucune',
      '# application n a lieu, ici ni ailleurs.',
      'KJEMO_PREPARE="${KJEMO_TMP}/${KJEMO_NOM_FICHIER}"',
      'KJEMO_DESTINATION="${HOME}/kjemo-netplan-${KJEMO_HORO}-${KJEMO_NOM_FICHIER}"',
      '{',
      ...yaml.map((l) => `  printf '%s\\n' ${shQuote(l)}`),
      '} > "${KJEMO_PREPARE}" 2>/dev/null || true',
      'if [ ! -s "${KJEMO_PREPARE}" ]; then',
      "  kjemo_resultat 'Preparation' \"${KJEMO_PREPARE}\" 'PROBLEME' 'vide ou absent' \\",
      "    'Le fichier prepare n a pas pu etre ecrit dans le dossier personnel. Rien d autre n a ete tente.'",
      'else',
      '  chmod 600 -- "${KJEMO_PREPARE}" 2>/dev/null || true',
      '  KJEMO_PREPARE_OK=1',
      '  KJEMO_CONTENU="$(cat "${KJEMO_PREPARE}" 2>/dev/null || true)"',
      "  printf '\\n%s\\n' '--- APERCU EXACT DU FICHIER PREPARE ---'",
      '  cat -- "${KJEMO_PREPARE}"',
      "  printf '%s\\n' '--- fin de l apercu ---'",
      "  printf '%s\\n' ''",
      "  kjemo_resultat 'Preparation' 'Apercu' 'INFO' \"${KJEMO_CONTENU}\" \\",
      "    'Apercu EXACT de ce qui sera propose. Le fichier est pour l instant dans le dossier temporaire du script, qui disparait a la sortie : rien n est encore laisse sur le disque.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LA VALIDATION, SUR UNE COPIE',
      '#',
      '# « netplan generate --root-dir » lit /etc/netplan SOUS la racine qu on',
      '# lui donne, et ecrit sous cette meme racine. La page de manuel est',
      '# explicite : « It does not apply the generated configuration ». On copie',
      '# donc la configuration reelle dans un dossier temporaire, on y ajoute le',
      '# fichier prepare, et on valide l ENSEMBLE — parce que c est l ensemble',
      '# qui sera lu, et qu une erreur peut naitre de la rencontre de deux',
      '# fichiers valides separement.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_VALIDE_OK=0',
      'if [ "${KJEMO_PREPARE_OK}" -eq 1 ] && [ "${KJEMO_OUTILS_OK}" -eq 1 ]; then',
      '  KJEMO_RACINE="${KJEMO_TMP}/racine"',
      '  mkdir -p -- "${KJEMO_RACINE}/etc/netplan"',
      '  if [ -d "${KJEMO_NETPLAN_DIR}" ]; then',
      '    find "${KJEMO_NETPLAN_DIR}" -maxdepth 1 -name \'*.yaml\' -exec cp -p -- {} "${KJEMO_RACINE}/etc/netplan/" \\; 2>/dev/null || true',
      '  fi',
      '  cp -p -- "${KJEMO_PREPARE}" "${KJEMO_RACINE}/etc/netplan/${KJEMO_NOM_FICHIER}"',
      '  kjemo_code=0',
      '  netplan generate --root-dir "${KJEMO_RACINE}" > "${KJEMO_TMP}/generate.out" 2>&1 || kjemo_code=$?',
      '  if [ "${kjemo_code}" -ne 0 ]; then',
      '    KJEMO_ERREUR="$(head -15 "${KJEMO_TMP}/generate.out" | tr \'\\n\' \' \' || true)"',
      "    kjemo_resultat 'Validation' 'netplan generate sur copie' 'PROBLEME' \"${KJEMO_ERREUR}\" \\",
      "      'La configuration est REFUSEE par Netplan lui-meme, sur une copie — donc sans aucune consequence. Corrige d abord : appliquer cela aurait coupe le reseau. Les messages de Netplan nomment la ligne et la clef en cause.'",
      '  else',
      '    KJEMO_VALIDE_OK=1',
      '    KJEMO_GENERES="$(find "${KJEMO_RACINE}/run" -type f 2>/dev/null | head -10 || true)"',
      "    kjemo_resultat 'Validation' 'netplan generate sur copie' 'OK' 'acceptee' \\",
      '      "Netplan accepte l ENSEMBLE des fichiers, le nouveau compris. Fichiers qu il produirait : ${KJEMO_GENERES:-aucun visible}. Cette validation n a touche a rien : --root-dir confine lecture ET ecriture au dossier temporaire, et la page de manuel precise que generate n applique pas la configuration."',
      '    # Ce que la validation ne couvre PAS, et qu il faut dire : une',
      '    # configuration syntaxiquement valide peut couper le reseau.',
      "    kjemo_resultat 'Validation' 'Ce qu elle ne dit pas' 'ATTENTION' 'la coherence reste a verifier' \\",
      "      'Netplan valide la FORME, pas le resultat. Une adresse deja prise sur le reseau, un VLAN absent cote commutateur, une passerelle qui ne route rien : tout cela passe la validation et coupe la connexion. C est exactement pourquoi l etape suivante est « netplan try », et non « netplan apply ».'",
      '  fi',
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: iface,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `laisser le fichier prepare pour ${iface} dans le dossier personnel, et remettre la procedure d application`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_OUTILS_OK', 'netplan est absent de cette machine.'],
          ['KJEMO_IFACE_OK', 'L interface demandee n existe pas : la configuration ne s appliquerait a rien.'],
          ['KJEMO_PREPARE_OK', 'Le fichier prepare n a pas pu etre ecrit.'],
          ['KJEMO_VALIDE_OK', 'Netplan refuse la configuration preparee.'],
          ['KJEMO_NOM_LIBRE_OK', 'Le nom demande existe deja dans /etc/netplan : la mise en place l ecraserait.'],
          ['KJEMO_CONCURRENCE_OK', 'Plusieurs fichiers declarent deja cette interface : en ajouter un creerait une configuration concurrente.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom de l interface.'],
        ],
        action: 'la remise du fichier prepare et de la procedure',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LES DEUX COMMANDES, A TAPER SOI-MEME',
      '#',
      '# « netplan try » applique, attend une confirmation au clavier, et REVIENT',
      '# tout seul en arriere apres 120 secondes si personne ne confirme. C est',
      '# la seule facon sure de changer le reseau d une machine distante, et elle',
      '# exige un terminal interactif — donc un humain, donc pas ce script.',
      '# ---------------------------------------------------------------------------',
      '  # La seule ecriture hors du dossier temporaire de tout ce script, et',
      '  # elle est derriere la porte finale : une copie dans le dossier',
      '  # personnel, en mode 600.',
      '  if ! cp -p -- "${KJEMO_PREPARE}" "${KJEMO_DESTINATION}"; then',
      "    printf '%s\\n' 'ARRET : impossible de laisser le fichier prepare dans le dossier personnel.' >&2",
      "    printf '%s\\n' 'Rien n a ete applique, et /etc/netplan est intact.' >&2",
      '    exit 1',
      '  fi',
      '  chmod 600 -- "${KJEMO_DESTINATION}" 2>/dev/null || true',
      '  if ! cmp -s -- "${KJEMO_PREPARE}" "${KJEMO_DESTINATION}"; then',
      "    printf '%s\\n' 'ARRET : le fichier recopie ne correspond pas a celui qui a ete valide.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Remise' \"${KJEMO_DESTINATION}\" 'OK' 'ecrit, relu, mode 600' \\",
      "    'Identique a celui qui vient d etre valide, verifie par cmp. C est le seul fichier laisse par ce script, et il est HORS de /etc/netplan.'",
      '',
      "  printf '\\n%s\\n' '=============================================================='",
      "  printf '%s\\n' 'A FAIRE MAINTENANT, A LA MAIN, DANS CET ORDRE'",
      "  printf '%s\\n' '=============================================================='",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '1. Garde cette session ouverte, et ouvre-en une SECONDE vers'",
      "  printf '%s\\n' '   la meme machine. Si le reseau tombe, la seconde session est'",
      "  printf '%s\\n' '   ce qui te permettra de revenir en arriere.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '2. Mets le fichier en place :'",
      '  printf \'%s\\n\' "   sudo install -m 600 -o root -g root \\"${KJEMO_DESTINATION}\\" \\"/etc/netplan/${KJEMO_NOM_FICHIER}\\""',
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '3. ESSAIE la configuration. Cette commande applique, attend'",
      "  printf '%s\\n' '   ta confirmation, et revient TOUTE SEULE en arriere apres'",
      "  printf '%s\\n' '   120 secondes si tu ne confirmes pas :'",
      "  printf '%s\\n' '   sudo netplan try'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '   Si la session se coupe : ne touche a rien et attends deux'",
      "  printf '%s\\n' '   minutes. Netplan remet la configuration precedente seul.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '4. Verifie, dans la seconde session :'",
      '  printf \'%s\\n\' "   ip -brief address show dev ${KJEMO_IFACE}"',
      "  printf '%s\\n' '   ip route show default'",
      "  printf '%s\\n' '   resolvectl status'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '5. Pour annuler apres coup : retire le fichier et reapplique.'",
      '  printf \'%s\\n\' "   sudo rm -f /etc/netplan/${KJEMO_NOM_FICHIER}"',
      "  printf '%s\\n' '   sudo netplan try'",
      "  printf '%s\\n' ''",
      '  if [ -n "${KJEMO_CLOUDINIT}" ]; then',
      "    printf '%s\\n' 'Un fichier produit par cloud-init existe : il n a pas ete modifie, et le fichier remis porte un autre nom.'",
      '  fi',
      "  printf '%s\\n' 'Ce que ce script n a PAS fait : il n a rien ecrit dans'",
      "  printf '%s\\n' '/etc/netplan, et il n a lance ni netplan apply ni netplan try.'",
      "  printf '%s\\n' '=============================================================='",
      "  kjemo_resultat 'Suite' 'Commandes remises' 'ATTENTION' 'a taper a la main' \\",
      "    'La configuration est preparee et validee, et rien n est applique. Les cinq etapes sont affichees ci-dessus : seconde session, mise en place, netplan try, verification, annulation.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-netplan' }),
    ]);
  },

  gui: [
    'Relève le nom EXACT de l’interface : « ip -brief link show ». « eth0 » n’existe plus sur une installation récente.',
    'Regarde ce qui existe déjà : « ls -l /etc/netplan/ ». Netplan lit les *.yaml dans l’ordre alphabétique, et le dernier l’emporte clé par clé.',
    'Un fichier en .yml est IGNORÉ en silence : seuls les *.yaml sont lus.',
    'Si « 50-cloud-init.yaml » existe, ne le modifie pas : cloud-init le réécrit à chaque démarrage. Écris un fichier à part (99-…), et décide séparément de laisser ou non cloud-init gérer le réseau.',
    'Le mode attendu est 600 : un fichier Netplan peut contenir une clé Wi-Fi, et netplan avertit lui-même quand il est lisible par tous.',
    'Écris le fichier, par exemple « /etc/netplan/99-local.yaml », avec « network: », « version: 2 », « renderer: networkd », puis « ethernets: » et ton interface.',
    'En statique, l’adresse porte son préfixe — « 192.168.30.10/24 » — et les serveurs DNS sont obligatoires : rien ne les fournit plus.',
    'VALIDE sans appliquer : « sudo netplan generate ». Pour valider sans toucher au système, copie la configuration ailleurs et lance « sudo netplan generate --root-dir /tmp/essai ».',
    'Ouvre une SECONDE session avant d’appliquer. Si le réseau tombe, c’est elle qui te sauve.',
    'Applique avec « sudo netplan try », JAMAIS « netplan apply » : try revient tout seul en arrière après 120 secondes si tu ne confirmes pas.',
    'Vérifie dans la seconde session : « ip -brief address show », « ip route show default », « resolvectl status ».',
  ],

  keywords: ['netplan', 'yaml', 'reseau', 'network', 'interface', 'statique', 'dhcp',
    'passerelle', 'gateway', 'dns', 'networkd', 'renderer', 'try', 'apply',
    'generate', 'root-dir', 'ssh', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'Le nom exact de l’interface, relevé par « ip -brief link show ».',
    'L’adresse, la passerelle et les serveurs DNS, si la configuration est statique — et la certitude que l’adresse n’est pas déjà prise sur le réseau.',
    'sudo, ou une session root : les fichiers de /etc/netplan ne sont lisibles que par root.',
    'UNE SECONDE voie d’accès à la machine avant d’appliquer : seconde session SSH, console locale, ou accès à la console de l’hyperviseur.',
  ],

  commonErrors: [
    {
      message: 'La configuration ne s’applique à rien et netplan ne dit rien',
      code: 'KJEMO',
      cause: 'Le fichier nomme une interface qui n’existe pas — « eth0 » sur une machine où elle s’appelle enp0s3. Netplan génère sans se plaindre.',
      fix: 'Relever le nom réel. L’assistant refuse une interface inexistante et liste celles qui existent.',
      command: 'ip -brief link show',
    },
    {
      message: 'J’ai écrit le fichier et rien ne change',
      code: 'KJEMO',
      cause: 'Extension .yml au lieu de .yaml : Netplan ne lit que *.yaml, et ignore le reste en silence.',
      fix: 'Renommer en .yaml.',
      command: 'ls -l /etc/netplan/',
    },
    {
      message: 'Error in network definition: expected mapping',
      code: 'KJEMO',
      cause: 'Indentation YAML fautive — un espace de trop, ou une TABULATION, que YAML interdit absolument.',
      fix: 'Valider sur une copie avant d’appliquer : c’est l’étape 4 de cet assistant.',
      command: 'sudo netplan generate --root-dir /tmp/essai-netplan',
    },
    {
      message: 'J’ai perdu la session SSH en appliquant la configuration',
      code: 'KJEMO',
      cause: '« netplan apply » applique immédiatement et sans retour. Une adresse fautive, un VLAN absent ou une passerelle qui ne route rien coupe la connexion au moment même de l’application.',
      fix: 'Toujours « netplan try », qui revient seul en arrière après 120 secondes. Et toujours une seconde session ouverte avant.',
      command: 'sudo netplan try',
    },
    {
      message: 'Permissions for /etc/netplan/50-cloud-init.yaml are too open',
      code: 'KJEMO',
      cause: 'Le fichier est lisible par le groupe ou par tous, et il peut contenir une clé Wi-Fi. Netplan avertit à chaque exécution.',
      fix: 'Mode 600, propriétaire root.',
      command: 'sudo chmod 600 /etc/netplan/*.yaml',
    },
    {
      message: 'Le réglage revient tout seul après quelques secondes',
      code: 'KJEMO',
      cause: 'Deux moteurs gèrent la même interface — systemd-networkd par Netplan, et NetworkManager — et se défont mutuellement.',
      fix: 'N’en garder qu’un pour cette interface. L’assistant signale leur coexistence.',
      command: 'nmcli device status; networkctl list',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le fichier préparé existe dans le dossier personnel, en mode 600, et son contenu exact est dans le rapport.',
    'Le rapport contient une ligne « Validation / netplan generate sur copie » en OK : la validation a porté sur l’ENSEMBLE des fichiers, pas seulement le nouveau.',
    '/etc/netplan est INCHANGÉ : « ls -l /etc/netplan/ » ne montre aucun fichier nouveau, et aucune date modifiée.',
    'Aucun « netplan apply » ni « netplan try » n’a été exécuté : « ip -brief address show » rend la même chose qu’avant.',
    'Les cinq étapes manuelles sont affichées, « seconde session » en premier.',
  ],

  rollback: {
    summary: 'Rien à annuler côté système : l’assistant n’écrit que dans le dossier personnel. Si la configuration a été appliquée à la main ensuite, l’annulation est le retrait du fichier suivi d’un nouveau « netplan try ».',
    diagnostic: `# Ce que l assistant a prepare, et ou :
ls -l "\${HOME}"/kjemo-netplan-*
# Ce qui est reellement en place :
sudo ls -l /etc/netplan/
sudo netplan get all
# L etat du reseau maintenant :
ip -brief address show
ip route show default`,
    command: `# 1. Si le fichier n a pas ete mis en place : il n y a rien a annuler.
#    Le fichier prepare peut etre supprime sans consequence :
#    rm -f "\${HOME}"/kjemo-netplan-AAAAMMJJ-HHMMSS-99-kjemo-reseau.yaml

# 2. S il a ete mis en place et applique, et que le reseau fonctionne
#    encore : retire-le et reapplique, depuis une SECONDE session.
#    sudo rm -f /etc/netplan/99-kjemo-reseau.yaml
#    sudo netplan try

# 3. Si le reseau est tombe pendant « netplan try » : ne touche a rien et
#    attends deux minutes. netplan try remet la configuration precedente
#    tout seul, c est sa raison d etre.

# 4. Si le reseau est tombe apres « netplan apply » — que cet assistant ne
#    lance jamais — il n y a pas de retour automatique. Il faut la console
#    locale, ou celle de l hyperviseur, puis retirer le fichier et
#    reappliquer.

# 5. Verifier, dans tous les cas :
ip -brief address show
ip route show default
resolvectl status`,
    warning: 'Un réseau coupé sur une machine distante ne se répare pas à distance : c’est tout le sujet. « netplan try » est la seule commande qui revient seule en arrière, et elle exige un terminal interactif — aucun script ne peut la lancer à votre place. Et une configuration syntaxiquement valide peut couper la connexion : adresse déjà prise, VLAN absent, passerelle qui ne route rien.',
  },

  checks: [
    '« netplan apply » n’apparaît nulle part dans le script, et aucun champ ne permet de le demander.',
    '« netplan try » n’est pas exécuté non plus : il exige un terminal interactif, et un script qui le lancerait sans terminal appliquerait puis laisserait revenir en arrière.',
    'Rien n’est écrit dans /etc/netplan : le fichier préparé va dans le dossier personnel, en mode 600.',
    'La validation se fait sur une COPIE, par « netplan generate --root-dir », dont la page de manuel dit qu’il n’applique pas la configuration.',
    'La validation porte sur l’ENSEMBLE des fichiers, le nouveau compris : une erreur peut naître de la rencontre de deux fichiers valides séparément.',
    'Ce que la validation ne couvre pas est écrit : une configuration valide peut couper le réseau.',
    'L’interface doit exister, vérifié par « ip -brief link show », et les interfaces présentes sont listées en cas de refus.',
    'La passerelle doit appartenir au réseau de l’adresse — vérifié par le formulaire, parce que « netplan generate » ne le voit pas.',
    'Les serveurs DNS sont obligatoires en statique : rien ne les fournit plus, et leur absence ressemble à une panne réseau complète.',
    'Les fichiers en .yml et les permissions trop larges sont signalés : les premiers sont ignorés en silence, les seconds peuvent exposer une clé.',
    'La coexistence de systemd-networkd et NetworkManager est signalée.',
    'Les cinq étapes manuelles sont affichées, « ouvre une seconde session » en premier.',
  ],

  source: `${M}/man5/netplan.5.html`,
  sources: [
    { label: 'netplan(5) — format du fichier YAML', url: `${M}/man5/netplan.5.html` },
    { label: 'netplan-generate(8) — « It does not apply the generated configuration »', url: `${M}/man8/netplan-generate.8.html` },
    { label: 'netplan-try(8) — retour automatique après 120 s', url: `${M}/man8/netplan-try.8.html` },
    { label: 'Netplan — documentation de référence', url: `${NETPLAN}/netplan-generate/` },
    { label: 'ip(8)', url: `${M}/man8/ip.8.html` },
    { label: 'networkctl(1)', url: `${M}/man1/networkctl.1.html` },
  ],
};

// ===========================================================================
// ASSISTANT 3 — LA RÉSOLUTION DE NOMS, ET LE FICHIER QU'ON LIT ENCORE À TORT
//
// /etc/resolv.conf ne dit plus la vérité depuis systemd-resolved. Sur Ubuntu
// Server, il contient une seule ligne — « nameserver 127.0.0.53 » — qui
// désigne le résolveur local, et pas les serveurs réellement interrogés. On
// lit ce fichier, on y voit une adresse inconnue, et on en conclut que le DNS
// est mal configuré : il ne l'est pas, on regarde au mauvais endroit.
//
// Les vrais serveurs sont ceux que `resolvectl status` affiche, par interface
// — parce qu'ils viennent du DHCP de chaque interface, ou de Netplan.
// ===========================================================================

const linuxDnsDiagnostic = {
  id: 'linux-dns-diagnostic',
  icon: '◇',
  category: CAT,
  subcategory: 'Réseau Linux',
  title: 'Diagnostiquer la résolution de noms, par interface',
  risk: 'diagnostic',
  summary: 'Lit les serveurs DNS réellement interrogés — par interface, comme systemd-resolved les tient — au lieu de /etc/resolv.conf, qui ne contient plus que l’adresse du résolveur local et fait chercher au mauvais endroit. Résout un nom par trois chemins différents pour distinguer un cache menteur d’un serveur en panne, et vérifie au besoin les enregistrements SRV d’un domaine Active Directory. N’écrit rien.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'systemd — resolvectl (présent par défaut)',
    'libc-bin — getent (présent par défaut)',
    'dnsutils — dig, host (apt install dnsutils, facultatif)',
  ],
  privileges: 'aucun : la résolution de noms se lit sans privilège',
  privilegesRequis: 'aucun',
  readOnly: true,
  service: 'systemd-resolved.service',
  limites: [
    'LIT seulement. Ne modifie ni /etc/resolv.conf — qui est un lien symbolique géré par systemd-resolved, et l’écraser casse la résolution à la première mise à jour — ni la configuration Netplan, ni les réglages de resolved.',
    'Ne vide pas le cache. « resolvectl flush-caches » est une action, et elle efface la preuve : un cache qui contient une vieille réponse est exactement ce qu’on cherche à constater.',
    'IPv4 et noms seulement. Les enregistrements MX, TXT et DNSSEC ne sont pas interrogés : ce sont d’autres questions, et les mélanger rendrait le rapport illisible.',
    'Un test de résolution dépend du réseau au moment où il tourne. Un échec peut être transitoire, et l’assistant interroge donc par trois chemins différents plutôt que de conclure sur un seul.',
  ],

  fields: [
    {
      id: 'nom',
      label: 'Nom à résoudre',
      type: 'text',
      default: 'archive.ubuntu.com',
      placeholder: 'archive.ubuntu.com',
      help: 'Un nom public pour éprouver la résolution vers l’extérieur, ou un nom interne pour éprouver le serveur du réseau local.',
    },
    {
      id: 'domaineAd',
      label: 'Domaine Active Directory (vide = aucun)',
      type: 'text',
      default: '',
      placeholder: 'kjemo.local',
      optionnel: true,
      help: 'Si renseigné, les enregistrements SRV du domaine sont interrogés : ce sont eux qu’un client cherche pour trouver un contrôleur, et leur absence est la première cause d’échec de jonction.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const n = validateHote(v.nom, 'Le nom à résoudre');
    if (!n.ok) errors.nom = n.error;
    const ad = String(v.domaineAd ?? '').trim();
    if (ad !== '') {
      const r = validateHote(ad, 'Le domaine Active Directory');
      if (!r.ok) {
        errors.domaineAd = r.error;
      } else if (!ad.includes('.')) {
        errors.domaineAd = `« ${ad} » n’a pas de point : un realm Active Directory en comporte toujours un, par exemple kjemo.local. Un nom sans point est un nom NetBIOS, et les enregistrements SRV ne se cherchent pas avec lui.`;
      }
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const ad = String(v.domaineAd ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer la resolution de noms, par interface',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'la resolution de noms se lit sans privilege',
      }),
      ...blocVariablesBash([
        ['KJEMO_NOM', shQuote(String(v.nom).trim())],
        ['KJEMO_AD', shQuote(ad)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Nom a resoudre' \"${KJEMO_NOM}\"",
      "  printf '%s\\t%s\\n' 'Domaine AD' \"${KJEMO_AD:-aucun}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - aucun cache vide, aucune configuration touchee'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - QUI RESOUT, SUR CETTE MACHINE ?',
      '#',
      '# Trois reponses possibles, et elles ne se diagnostiquent pas de la meme',
      '# facon :',
      '#   systemd-resolved actif  les serveurs sont PAR INTERFACE, et',
      '#                           /etc/resolv.conf ne contient que 127.0.0.53.',
      '#   resolved absent         /etc/resolv.conf dit la verite.',
      '#   resolv.conf ecrase      quelqu un a remplace le lien symbolique par un',
      '#                           vrai fichier : cela fonctionne jusqu a la',
      '#                           prochaine mise a jour ou au prochain',
      '#                           redemarrage.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_RESOLVED=\'inconnu\'',
      'if kjemo_dispo systemctl; then',
      '  KJEMO_RESOLVED="$(systemctl is-active systemd-resolved 2>/dev/null || true)"',
      'fi',
      "kjemo_resultat 'Resolveur' 'systemd-resolved' 'INFO' \"${KJEMO_RESOLVED:-inconnu}\" \\",
      "  'Quand il est actif, c est LUI le resolveur de la machine, et les serveurs DNS sont tenus par interface.'",
      '',
      '# /etc/resolv.conf : ce qu il est, et non ce qu il contient.',
      'if [ -L /etc/resolv.conf ]; then',
      '  KJEMO_LIEN="$(readlink -f /etc/resolv.conf 2>/dev/null || true)"',
      '  case "${KJEMO_LIEN}" in',
      '    *stub-resolv.conf)',
      "      kjemo_resultat 'Resolveur' '/etc/resolv.conf' 'OK' \"lien vers ${KJEMO_LIEN}\" \\",
      "        'Configuration attendue sur Ubuntu : le fichier est un LIEN vers le stub de systemd-resolved. Il ne contient que « nameserver 127.0.0.53 », qui est le resolveur local — PAS les serveurs reellement interroges. Lire ce fichier pour connaitre les serveurs DNS est l erreur de diagnostic la plus frequente du sujet.'",
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Resolveur' '/etc/resolv.conf' 'INFO' \"lien vers ${KJEMO_LIEN}\" \\",
      "        'Lien symbolique vers une autre cible que le stub. C est le cas quand resolved est configure en mode « resolv.conf complet », ou quand un autre gestionnaire ecrit ce fichier.'",
      '      ;;',
      '  esac',
      'elif [ -f /etc/resolv.conf ]; then',
      '  if [ "${KJEMO_RESOLVED}" = \'active\' ]; then',
      "    kjemo_resultat 'Resolveur' '/etc/resolv.conf' 'ATTENTION' 'vrai fichier, et resolved est actif' \\",
      "      'Le lien symbolique a ete remplace par un vrai fichier alors que systemd-resolved tourne. Cela fonctionne — jusqu a la prochaine mise a jour du paquet ou au prochain redemarrage, ou le fichier peut etre recree ou ignore. La bonne facon d imposer des serveurs est la configuration Netplan ou resolved, pas l ecrasement de ce fichier.'",
      '  else',
      "    kjemo_resultat 'Resolveur' '/etc/resolv.conf' 'INFO' 'vrai fichier, resolved inactif' \\",
      "      'Sans systemd-resolved, ce fichier dit la verite : ses lignes « nameserver » sont les serveurs reellement interroges.'",
      '  fi',
      'fi',
      'KJEMO_RESOLVCONF="$(grep -E \'^(nameserver|search|domain|options)\' /etc/resolv.conf 2>/dev/null | head -10 || true)"',
      "kjemo_resultat 'Resolveur' 'Contenu de resolv.conf' 'INFO' \"${KJEMO_RESOLVCONF:-vide}\" \\",
      "  'Contenu brut. Si la seule ligne est « nameserver 127.0.0.53 », elle ne renseigne rien sur les serveurs du reseau : c est l etape suivante qui les donne.'",
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LES SERVEURS REELLEMENT INTERROGES, PAR INTERFACE',
      '#',
      '# C est l information que /etc/resolv.conf ne donne plus. Et le detail',
      '# qui compte : les serveurs sont attaches a une INTERFACE. Une machine a',
      '# deux liens peut interroger le DNS du mauvais reseau, et resoudre les',
      '# noms publics tout en echouant sur les noms internes.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_DNS_OK=0',
      'if kjemo_dispo resolvectl; then',
      '  KJEMO_STATUS="$(resolvectl status --no-pager 2>/dev/null | head -40 || true)"',
      '  if [ -n "${KJEMO_STATUS}" ]; then',
      '    KJEMO_DNS_OK=1',
      "    kjemo_resultat 'Serveurs' 'resolvectl status' 'INFO' \"${KJEMO_STATUS}\" \\",
      "      'Les serveurs sont groupes PAR INTERFACE, et c est le point : chaque interface apporte les siens, par DHCP ou par Netplan. « DNS Domain » donne les domaines de recherche, qui completent un nom court.'",
      '    KJEMO_SERVEURS="$(resolvectl status --no-pager 2>/dev/null | grep -E \'DNS Servers?:\' | head -5 || true)"',
      '    if [ -z "${KJEMO_SERVEURS}" ]; then',
      "      kjemo_resultat 'Serveurs' 'Aucun serveur DNS' 'PROBLEME' 'liste vide' \\",
      "        'Aucune interface ne fournit de serveur DNS. Rien ne se resoudra, et le symptome ressemble a une panne reseau complete alors que la route fonctionne parfaitement. En adresse statique, les serveurs DNS doivent etre declares explicitement : rien ne les fournit.'",
      '    else',
      "      kjemo_resultat 'Serveurs' 'Declares' 'OK' \"${KJEMO_SERVEURS}\" ''",
      '    fi',
      '  fi',
      'else',
      "  kjemo_resultat 'Serveurs' 'resolvectl' 'IGNORE' 'absent' \\",
      "    'Sans resolvectl, les serveurs sont ceux de /etc/resolv.conf lu ci-dessus.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - TROIS CHEMINS POUR LE MEME NOM',
      '#',
      '# Ce ne sont pas trois facons de faire la meme chose, et c est tout',
      '# l interet :',
      '#   getent hosts   passe par la bibliotheque C, donc par /etc/hosts PUIS',
      '#                  par le resolveur. C est le chemin que suivent les',
      '#                  programmes ordinaires.',
      '#   resolvectl     interroge systemd-resolved directement, et dit s il a',
      '#                  repondu depuis son CACHE.',
      '#   dig            interroge un serveur DNS sans passer par le cache',
      '#                  local, quand il est installe.',
      '#',
      '# Si getent reussit et dig echoue, la reponse venait de /etc/hosts ou du',
      '# cache. Si dig reussit et getent echoue, la configuration du resolveur',
      '# local est en cause. Un seul test ne distingue pas ces deux cas.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_GETENT="$(getent hosts "${KJEMO_NOM}" 2>/dev/null | head -5 || true)"',
      'if [ -n "${KJEMO_GETENT}" ]; then',
      "  kjemo_resultat 'Resolution' 'getent hosts' 'OK' \"${KJEMO_GETENT}\" \\",
      "    'Le chemin des programmes ordinaires : /etc/hosts d abord, le resolveur ensuite. C est ce que verra une application.'",
      'else',
      "  kjemo_resultat 'Resolution' 'getent hosts' 'PROBLEME' 'aucune reponse' \\",
      "    'Le nom ne se resout pas par le chemin normal. Les deux tests suivants disent si le probleme est le resolveur local ou le serveur.'",
      'fi',
      '',
      '# /etc/hosts a-t-il une entree pour ce nom ? Une entree oubliee la',
      '# masque le DNS entier pour ce nom, et aucun outil DNS ne le montre.',
      'KJEMO_HOSTS="$(grep -E "(^|[[:space:]])${KJEMO_NOM}([[:space:]]|$)" /etc/hosts 2>/dev/null || true)"',
      'if [ -n "${KJEMO_HOSTS}" ]; then',
      "  kjemo_resultat 'Resolution' '/etc/hosts' 'ATTENTION' \"${KJEMO_HOSTS}\" \\",
      "    'Ce nom a une entree dans /etc/hosts : elle PRIME sur le DNS pour tous les programmes ordinaires. Une entree oubliee la est une panne qui resiste a tous les diagnostics DNS, parce qu aucun outil DNS ne la voit.'",
      'fi',
      '',
      'if kjemo_dispo resolvectl; then',
      '  KJEMO_RQ="$(resolvectl query "${KJEMO_NOM}" 2>&1 | head -10 || true)"',
      '  case "${KJEMO_RQ}" in',
      '    *"resolve call failed"*|*"Name or service not known"*)',
      "      kjemo_resultat 'Resolution' 'resolvectl query' 'PROBLEME' \"${KJEMO_RQ}\" \\",
      "        'systemd-resolved n a pas pu resoudre ce nom. La raison exacte est dans le message : « No appropriate name servers » signifie qu aucune interface n a de serveur, et « Query timed out » que le serveur declare ne repond pas.'",
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Resolution' 'resolvectl query' 'OK' \"${KJEMO_RQ}\" \\",
      "        'La mention « cache » en fin de reponse signifie qu elle vient du CACHE local et non du serveur : une entree perimee peut donc paraitre correcte. C est pour cela qu on interroge aussi par un troisieme chemin.'",
      '      ;;',
      '  esac',
      'fi',
      '',
      'if kjemo_dispo dig; then',
      '  KJEMO_DIG="$(dig +short +timeout=3 +tries=1 -- "${KJEMO_NOM}" 2>/dev/null | head -5 || true)"',
      '  if [ -n "${KJEMO_DIG}" ]; then',
      "    kjemo_resultat 'Resolution' 'dig' 'OK' \"${KJEMO_DIG}\" \\",
      "      'Reponse obtenue sans passer par le cache local. Si ce test reussit et que getent echoue, le probleme est la configuration du resolveur local, pas le serveur DNS.'",
      '  else',
      "    kjemo_resultat 'Resolution' 'dig' 'PROBLEME' 'aucune reponse' \\",
      "      'Le serveur DNS lui-meme ne repond pas pour ce nom. Si getent reussit malgre tout, la reponse venait de /etc/hosts ou d un cache.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Resolution' 'dig' 'IGNORE' 'absent' \\",
      "    'dig vient du paquet dnsutils : apt install dnsutils. C est le seul des trois chemins qui contourne le cache local, et il vaut la peine d etre installe sur un serveur.'",
      'fi',
      '',
      '# Le test qui separe la resolution de la route, une fois pour toutes.',
      'KJEMO_NUM="$(getent hosts 1.1.1.1 2>/dev/null | head -1 || true)"',
      'if [ -z "${KJEMO_GETENT}" ] && [ -n "${KJEMO_NUM}" ]; then',
      "  kjemo_resultat 'Resolution' 'Contre-epreuve' 'INFO' 'une adresse numerique passe' \\",
      "    'Une adresse numerique est acceptee alors que le nom ne se resout pas : la pile reseau fonctionne, et le probleme est bien la RESOLUTION. C est la distinction que « je n ai pas Internet » ne fait pas.'",
      'fi',
      '',
      ...(ad !== '' ? [
        '# ---------------------------------------------------------------------------',
        '# ETAPE 4 - LES ENREGISTREMENTS SRV DU DOMAINE ACTIVE DIRECTORY',
        '#',
        '# Un client ne trouve pas un controleur de domaine par son nom : il',
        '# interroge les enregistrements SRV du domaine. Leur absence est la',
        '# PREMIERE cause d echec de jonction, et le message d erreur de Windows',
        '# ne parle jamais de SRV — il dit que le domaine est introuvable.',
        '#',
        '# Deux enregistrements comptent :',
        '#   _ldap._tcp.<domaine>              les controleurs du domaine',
        '#   _kerberos._udp.<domaine>          les serveurs Kerberos',
        '# ---------------------------------------------------------------------------',
        'KJEMO_SRV_OK=0',
        'if kjemo_dispo resolvectl; then',
        '  for kjemo_srv in "_ldap._tcp.${KJEMO_AD}" "_kerberos._udp.${KJEMO_AD}"; do',
        '    kjemo_rep="$(resolvectl query --type=SRV "${kjemo_srv}" 2>&1 | head -6 || true)"',
        '    case "${kjemo_rep}" in',
        '      *"resolve call failed"*|*"not found"*|*NXDOMAIN*)',
        "        kjemo_resultat 'Active Directory' \"${kjemo_srv}\" 'PROBLEME' \"${kjemo_rep}\" \\",
        // Le rapport Console n affiche QUE le commentaire : le nom de
        // l enregistrement doit donc y figurer, sinon l operateur lit
        // « introuvable » sans savoir lequel des deux manque.
        '          "L enregistrement SRV ${kjemo_srv} est introuvable. Un client ne peut pas localiser de controleur sans lui, et le message d erreur qu il affichera parlera d un « domaine introuvable » sans jamais mentionner SRV. Cause la plus frequente : le client interroge un DNS public au lieu du DNS du domaine."',
        '        ;;',
        '      *)',
        '        KJEMO_SRV_OK=1',
        "        kjemo_resultat 'Active Directory' \"${kjemo_srv}\" 'OK' \"${kjemo_rep}\" \\",
        "          'Enregistrement trouve : le DNS interroge connait le domaine. C est le prerequis d une jonction.'",
        '        ;;',
        '    esac',
        '  done',
        '  if [ "${KJEMO_SRV_OK}" -eq 0 ]; then',
        "    kjemo_resultat 'Active Directory' 'Verdict' 'PROBLEME' 'aucun SRV trouve' \\",
        '      "Ni _ldap._tcp.${KJEMO_AD} ni _kerberos._udp.${KJEMO_AD} n est resolu par le DNS de cette machine. Une jonction echouerait, et le message ne dirait pas pourquoi. Le DNS d un client de domaine doit etre le DNS DU DOMAINE — un DNS public ne connait pas ces enregistrements, et ne peut pas les connaitre."',
        '  fi',
        'fi',
      ] : [
        '# Aucun domaine Active Directory demande : les enregistrements SRV ne',
        '# sont pas interroges. Ils le seront par les assistants de jonction.',
        "kjemo_resultat 'Active Directory' 'SRV' 'IGNORE' 'aucun domaine demande' \\",
        "  'Pour eprouver la resolution d un domaine AD, renseigne le champ : les enregistrements _ldap._tcp et _kerberos._udp sont ceux qu un client cherche pour trouver un controleur.'",
      ]),

      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - CE QUE CE DIAGNOSTIC A PU LIRE, ET CE QU IL N A PAS PU',
      '#',
      '# Un rapport qui ne dit pas ce qu il n a pas pu voir laisse croire qu il',
      '# a tout vu. Quand resolvectl ne repond pas, les serveurs par interface',
      '# restent inconnus, et le diagnostic est PARTIEL — meme si tout le reste',
      '# est vert.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_DNS_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Portee' 'Serveurs enumeres' 'OK' 'par interface, via resolvectl' \\",
      "    'Le diagnostic a pu lire les serveurs reellement interroges, interface par interface.'",
      'else',
      "  kjemo_resultat 'Portee' 'Serveurs non enumeres' 'ATTENTION' 'resolvectl muet ou absent' \\",
      "    'Les serveurs DNS par interface n ont PAS pu etre lus : ce diagnostic est partiel. Les tests de resolution ci-dessus restent valables — ils disent si un nom se resout — mais ils ne disent pas QUEL serveur a repondu, ni depuis quelle interface. Sans systemd-resolved, ce sont les lignes « nameserver » de /etc/resolv.conf qui font foi.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-dns' }),
    ]);
  },

  gui: [
    'Ne commence PAS par /etc/resolv.conf : sur Ubuntu il ne contient que « nameserver 127.0.0.53 », le résolveur local, et pas les serveurs réellement interrogés.',
    'Les vrais serveurs, par interface : « resolvectl status ». Chaque interface apporte les siens, par DHCP ou par Netplan.',
    'Résous par trois chemins différents, parce qu’ils ne passent pas par les mêmes couches : « getent hosts <nom> », « resolvectl query <nom> », « dig +short <nom> ».',
    'Si getent réussit et dig échoue, la réponse venait de /etc/hosts ou du cache. Si dig réussit et getent échoue, c’est le résolveur local.',
    'Vérifie /etc/hosts : « grep <nom> /etc/hosts ». Une entrée oubliée prime sur le DNS et résiste à tous les diagnostics DNS.',
    'La mention « cache » dans la réponse de resolvectl veut dire qu’elle ne vient pas du serveur : une entrée périmée peut paraître correcte.',
    'Pour un domaine Active Directory, ce sont les SRV qui comptent : « resolvectl query --type=SRV _ldap._tcp.kjemo.local ».',
    'Un client de domaine doit interroger le DNS DU DOMAINE : un DNS public ne connaît pas ces enregistrements, et ne peut pas les connaître.',
    'N’écrase jamais /etc/resolv.conf à la main : c’est un lien géré par systemd-resolved, et cela tient jusqu’à la prochaine mise à jour.',
  ],

  keywords: ['dns', 'resolution', 'resolvectl', 'resolved', 'resolv.conf', 'getent',
    'dig', 'hosts', 'cache', 'srv', 'active directory', 'ldap', 'kerberos',
    'nameserver', 'search', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien : la résolution de noms se lit sans privilège.',
    'Le paquet dnsutils pour « dig », qui est le seul des trois chemins à contourner le cache local.',
    'Le nom du domaine Active Directory, si c’est une jonction qu’on prépare.',
  ],

  commonErrors: [
    {
      message: 'resolv.conf contient 127.0.0.53 et je ne comprends pas',
      code: 'KJEMO',
      cause: 'C’est le stub de systemd-resolved, et c’est la configuration normale d’Ubuntu. Ce fichier ne renseigne plus sur les serveurs du réseau.',
      fix: 'Lire les serveurs réels, par interface.',
      command: 'resolvectl status',
    },
    {
      message: 'Temporary failure in name resolution',
      code: 'EAI_AGAIN',
      cause: 'Aucun serveur DNS ne répond — ou aucune interface n’en déclare. En adresse statique, rien ne les fournit automatiquement.',
      fix: 'Vérifier que des serveurs sont déclarés, puis qu’ils répondent.',
      command: 'resolvectl status; dig +short archive.ubuntu.com',
    },
    {
      message: 'Un nom résout vers une ancienne adresse',
      code: 'KJEMO',
      cause: 'Le cache local, ou une entrée dans /etc/hosts. Les deux primentsur ce que dit le serveur.',
      fix: 'Vérifier /etc/hosts d’abord, puis interroger sans le cache avec dig.',
      command: 'grep monserveur /etc/hosts; dig +short monserveur',
    },
    {
      message: 'La jonction de domaine échoue en disant que le domaine est introuvable',
      code: 'KJEMO',
      cause: 'Les enregistrements SRV du domaine ne sont pas résolus, parce que le client interroge un DNS public au lieu du DNS du domaine.',
      fix: 'Pointer le client vers le DNS du domaine, puis vérifier les SRV.',
      command: 'resolvectl query --type=SRV _ldap._tcp.kjemo.local',
    },
    {
      message: 'J’ai écrit mes serveurs dans /etc/resolv.conf et ils ont disparu',
      code: 'KJEMO',
      cause: 'Le fichier est un lien géré par systemd-resolved : il est régénéré.',
      fix: 'Déclarer les serveurs dans la configuration Netplan, ou dans celle de resolved.',
      command: 'ls -l /etc/resolv.conf',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport dit ce qu’est /etc/resolv.conf — lien vers le stub, ou vrai fichier — avant d’en citer le contenu.',
    'Les serveurs DNS sont listés PAR INTERFACE, depuis resolvectl, et non depuis resolv.conf.',
    'Le nom demandé a été résolu par les trois chemins disponibles, et les divergences entre eux sont commentées.',
    'Une entrée de /etc/hosts pour ce nom est signalée comme ATTENTION.',
    'Si un domaine AD a été demandé : les deux enregistrements SRV ont été interrogés séparément.',
    'Aucune écriture : ni resolv.conf, ni flush-caches, ni configuration de resolved.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant ne fait que lire, et il ne vide même pas le cache — un cache qui contient une vieille réponse est une preuve, pas une gêne.',
    diagnostic: `# Qui resout, et avec quels serveurs :
resolvectl status
ls -l /etc/resolv.conf
# Le cache, et ses statistiques :
resolvectl statistics`,
    command: `# Aucune modification a annuler.
#
# Si un cache perime gene VRAIMENT, et apres avoir constate ce qu il
# contenait :
#   sudo resolvectl flush-caches
#
# Pour imposer des serveurs DNS durablement, ce n est PAS resolv.conf
# qu il faut ecrire — c est un lien gere par systemd-resolved, et il sera
# regenere. C est la configuration Netplan de l interface :
#   nameservers:
#     addresses: [192.168.30.1, 1.1.1.1]
# puis « sudo netplan try », jamais « netplan apply » sur une machine
# distante.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: null,
  },

  checks: [
    'Aucune écriture : ni /etc/resolv.conf, ni « resolvectl flush-caches » — vider le cache efface la preuve qu’on cherche.',
    'La nature de /etc/resolv.conf est lue avant son contenu : lien vers le stub, ou vrai fichier écrasé alors que resolved tourne.',
    'Les serveurs sont lus PAR INTERFACE depuis resolvectl : c’est l’information que resolv.conf ne donne plus.',
    'L’absence totale de serveur DNS est signalée comme PROBLEME, avec la mention qu’en statique rien ne les fournit.',
    'Le nom est résolu par trois chemins qui ne traversent pas les mêmes couches, et le rapport explique ce que chaque divergence signifie.',
    '/etc/hosts est consulté pour le nom demandé : une entrée oubliée y résiste à tous les diagnostics DNS.',
    'La mention « cache » dans la réponse de resolvectl est expliquée : une entrée périmée paraît correcte.',
    'Une contre-épreuve numérique distingue la résolution de la route.',
    'Les enregistrements SRV d’un domaine AD sont interrogés un par un, et leur absence est reliée au message d’erreur réel d’un client.',
    'Un domaine AD sans point est refusé par le formulaire : c’est un nom NetBIOS, et les SRV ne se cherchent pas avec lui.',
  ],

  source: `${M}/man1/resolvectl.1.html`,
  sources: [
    { label: 'resolvectl(1)', url: `${M}/man1/resolvectl.1.html` },
    { label: 'systemd-resolved.service(8) — le stub 127.0.0.53', url: `${M}/man8/systemd-resolved.service.8.html` },
    { label: 'resolv.conf(5)', url: `${M}/man5/resolv.conf.5.html` },
    { label: 'getent(1)', url: `${M}/man1/getent.1.html` },
  ],
};

// ===========================================================================
// ASSISTANT 4 — LE PARE-FEU, CROISÉ AVEC CE QUI ÉCOUTE VRAIMENT
//
// Un audit de pare-feu qui ne lit que les règles ne répond pas à la question
// qu'on se pose. La question est : « ce port est-il joignable ? », et elle a
// trois réponses possibles qu'il faut croiser :
//
//   le service écoute-t-il, et sur quelle adresse ?
//   une règle l'autorise-t-elle ?
//   la politique par défaut laisse-t-elle passer le reste ?
//
// Un port ouvert dans UFW devant un service lié à 127.0.0.1 ne sert à rien.
// Un service lié à 0.0.0.0 derrière une politique DENY n'est pas joignable.
// Les deux cas se diagnostiquent en regardant les deux côtés ensemble.
// ===========================================================================

const linuxFirewallAudit = {
  id: 'linux-firewall-audit',
  icon: '◇',
  category: CAT,
  subcategory: 'Réseau Linux',
  title: 'Auditer le pare-feu, et le croiser avec les ports en écoute',
  risk: 'diagnostic',
  summary: 'Lit le pare-feu en place — UFW, nftables, iptables — ses politiques par défaut et ses règles, puis les CROISE avec les ports réellement en écoute : un port autorisé devant un service lié à 127.0.0.1 ne sert à rien, et un service exposé derrière une politique DENY n’est pas joignable. Signale les ports en écoute qu’aucune règle n’autorise, et l’inverse. N’ajoute, ne retire et ne recharge aucune règle.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'ufw — ufw (présent par défaut sur Ubuntu, souvent inactif)',
    'nftables — nft (présent par défaut)',
    'iproute2 — ss (présent par défaut)',
    'iptables — iptables-save, pour les règles héritées (facultatif)',
  ],
  privileges: 'aucun pour lire les ports en écoute et les adresses ; root pour « ufw status », « nft list ruleset » et le processus derrière chaque socket',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'ufw.service',
  limites: [
    'LIT seulement. Aucun « ufw allow », aucun « ufw deny », aucun « ufw enable », aucun « nft add » : ouvrir un port est une décision, et c’est une commande rapide avec sa commande d’annulation exacte, pas un assistant.',
    'Ne recharge rien. « ufw reload » et « nft -f » appliquent, et un audit n’applique pas.',
    'Ne teste pas la joignabilité depuis l’extérieur : cela demande une seconde machine, et c’est une procédure manuelle. L’assistant croise ce qui écoute avec ce qui est autorisé — ce qui répond à la question dans la quasi-totalité des cas, et sans dépendre d’un tiers.',
    'Ne juge pas une politique. Une machine en DENY entrant qui n’autorise que SSH est bien configurée ; la même machine sans aucune règle est peut-être derrière un pare-feu de périmètre. L’assistant mesure, il ne conclut pas à la place de l’administrateur.',
    'IPv6 est lu mais pas interprété règle par règle : une règle qui n’existe qu’en IPv4 est signalée, et c’est le défaut le plus fréquent — mais l’analyse complète d’un jeu de règles double demande de connaître l’intention.',
  ],

  fields: [
    {
      id: 'portVerifie',
      label: 'Port à vérifier en priorité (vide = tous)',
      type: 'text',
      default: '22',
      placeholder: '22',
      optionnel: true,
      help: 'Un port dont on veut savoir s’il est joignable. Le croisement est fait pour tous les ports en écoute, mais celui-ci est traité à part et en premier.',
    },
    {
      id: 'lireIptables',
      label: 'Lire aussi les règles iptables héritées',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Oui lance « iptables-save », en lecture. Utile sur une machine migrée : des règles iptables peuvent coexister avec nftables et surprendre.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const port = String(v.portVerifie ?? '').trim();
    if (port !== '') {
      const r = validateEntierBorne(port, 1, 65535, 'Le port');
      if (!r.ok) errors.portVerifie = r.error;
    }
    const i = validateChoix(v.lireIptables, ['Oui', 'Non'], 'La lecture d’iptables');
    if (!i.ok) errors.lireIptables = i.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const port = String(v.portVerifie ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Auditer le pare-feu, croise avec les ports en ecoute',
        outil: this.id,
        diagnostic: true,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'les ports en ecoute se lisent sans privilege ; root est necessaire pour les REGLES, et les sections concernees sont alors annoncees IGNORE au lieu d echouer',
      }),
      ...blocVariablesBash([
        ['KJEMO_PORT', shQuote(port)],
        ['KJEMO_IPTABLES', shQuote(String(v.lireIptables))],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Port examine en priorite' \"${KJEMO_PORT:-tous}\"",
      "  printf '%s\\t%s\\n' 'Lecture iptables' \"${KJEMO_IPTABLES}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - aucune regle ajoutee, retiree ni rechargee'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - QUEL PARE-FEU EST EN PLACE ?',
      '#',
      '# UFW n est pas un pare-feu : c est une interface SIMPLIFIEE qui ecrit des',
      '# regles nftables. « ufw status inactive » ne veut donc pas dire « aucune',
      '# regle » — nftables peut en porter d autres, posees autrement. Les deux',
      '# se lisent, et dans cet ordre.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_UFW_ACTIF=0',
      'KJEMO_ROOT_OK=1',
      'if [ "$(id -u)" -ne 0 ]; then',
      '  KJEMO_ROOT_OK=0',
      "  kjemo_resultat 'Portee' 'Regles du pare-feu' 'IGNORE' 'root requis' \\",
      "    'Sans privilege, « ufw status » et « nft list ruleset » ne repondent pas : les REGLES ne peuvent pas etre lues, et le croisement avec les ports en ecoute sera donc partiel. Les ports en ecoute, eux, se lisent — sans le nom du processus. Relance avec sudo pour le diagnostic complet.'",
      'fi',
      'if [ "${KJEMO_ROOT_OK}" -eq 1 ] && kjemo_dispo ufw; then',
      '  KJEMO_UFW="$(ufw status verbose 2>/dev/null || true)"',
      '  case "${KJEMO_UFW}" in',
      '    *"Status: active"*|*"actif"*)',
      '      KJEMO_UFW_ACTIF=1',
      "      kjemo_resultat 'Pare-feu' 'UFW' 'OK' \"${KJEMO_UFW}\" \\",
      "        'UFW est actif. Les lignes « Default: » donnent les politiques par defaut, et ce sont elles qui decident du sort de tout ce qu aucune regle ne nomme.'",
      '      KJEMO_DEFAUT="$(printf \'%s\\n\' "${KJEMO_UFW}" | grep -i \'^Default:\' | head -1 || true)"',
      '      case "${KJEMO_DEFAUT}" in',
      '        *"deny (incoming)"*|*"reject (incoming)"*)',
      "          kjemo_resultat 'Pare-feu' 'Politique entrante' 'OK' \"${KJEMO_DEFAUT}\" \\",
      "            'Tout ce qui n est pas explicitement autorise est refuse en entree. C est la configuration attendue sur un serveur.'",
      '          ;;',
      '        *"allow (incoming)"*)',
      "          kjemo_resultat 'Pare-feu' 'Politique entrante' 'PROBLEME' \"${KJEMO_DEFAUT}\" \\",
      "            'La politique par defaut ACCEPTE tout en entree : les regles de refus deviennent la seule protection, et tout service qui ecoute est joignable des qu il demarre — y compris celui qu on vient d installer sans y penser. Un pare-feu en « allow » par defaut ne protege que ce qu on a pense a interdire.'",
      '          ;;',
      '      esac',
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Pare-feu' 'UFW' 'ATTENTION' 'inactif' \\",
      "        'UFW est installe et inactif. Cela ne veut PAS dire qu il n y a aucune regle : UFW n est qu une interface qui ecrit des regles nftables, et nftables peut en porter d autres, posees par un autre moyen. L etape suivante les lit.'",
      '      ;;',
      '  esac',
      'else',
      "  kjemo_resultat 'Pare-feu' 'UFW' 'INFO' 'absent' \\",
      "    'UFW n est pas installe. Le pare-feu, s il y en a un, est nftables directement.'",
      'fi',
      '',
      '# nftables : la verite de ce que le noyau applique.',
      'KJEMO_NFT_REGLES=0',
      'if [ "${KJEMO_ROOT_OK}" -eq 1 ] && kjemo_dispo nft; then',
      '  KJEMO_NFT="$(nft list ruleset 2>/dev/null || true)"',
      '  if [ -n "${KJEMO_NFT}" ]; then',
      '    KJEMO_NFT_REGLES="$(printf \'%s\\n\' "${KJEMO_NFT}" | grep -cE \'^[[:space:]]+(tcp|udp|ip|ip6|iif|oif|ct) \' || true)"',
      '    KJEMO_EXTRAIT="$(printf \'%s\\n\' "${KJEMO_NFT}" | head -40 || true)"',
      "    kjemo_resultat 'Pare-feu' 'nftables' 'INFO' \"${KJEMO_EXTRAIT}\" \\",
      '      "C est ce que le noyau applique reellement, UFW compris : UFW ecrit ses regles ici. Environ ${KJEMO_NFT_REGLES} regle(s) de filtrage. Quarante premieres lignes."',
      '    KJEMO_CHAINES="$(printf \'%s\\n\' "${KJEMO_NFT}" | grep -E \'type filter hook (input|forward)\' | head -5 || true)"',
      '    if [ -n "${KJEMO_CHAINES}" ]; then',
      "      kjemo_resultat 'Pare-feu' 'Politiques des chaines' 'INFO' \"${KJEMO_CHAINES}\" \\",
      "        'La « policy » en fin de ligne decide du sort de ce qu aucune regle ne nomme. « policy drop » refuse en silence, « policy accept » accepte tout le reste.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'Pare-feu' 'nftables' 'ATTENTION' 'aucune regle' \\",
      "      'Le noyau n applique AUCUNE regle de filtrage : tout service qui ecoute est joignable depuis tout ce qui peut atteindre la machine. Ce n est pas forcement une faute — la machine peut etre derriere un pare-feu de perimetre — mais c est une decision, et il faut l avoir prise.'",
      '  fi',
      'fi',
      '',
      'if [ "${KJEMO_IPTABLES}" = \'Oui\' ] && [ "${KJEMO_ROOT_OK}" -eq 1 ] && kjemo_dispo iptables-save; then',
      '  KJEMO_IPT="$(iptables-save 2>/dev/null | grep -vE \'^#\' | head -25 || true)"',
      '  if [ -n "${KJEMO_IPT}" ]; then',
      "    kjemo_resultat 'Pare-feu' 'iptables (herite)' 'INFO' \"${KJEMO_IPT}\" \\",
      "      'Sur un systeme recent, iptables est une facade au-dessus de nftables : ces regles apparaissent aussi dans nft list ruleset, sous une forme differente. Les lire ici aide quand la documentation d un service ne parle qu en iptables.'",
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - CE QUI ECOUTE, ET SUR QUELLE ADRESSE',
      '#',
      '# La distinction decisive, et celle qu on oublie :',
      '#   127.0.0.1:<port>  joignable UNIQUEMENT depuis la machine. Ouvrir le',
      '#                     port dans le pare-feu n y changera rien.',
      '#   0.0.0.0:<port>    joignable depuis partout ou le reseau et le',
      '#                     pare-feu le permettent.',
      '#   [::]:<port>       la meme chose en IPv6 — et une regle de pare-feu',
      '#                     ecrite seulement pour IPv4 ne la couvre pas.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_ECOUTE="$(ss -lntup 2>/dev/null | tail -n +2 || true)"',
      "kjemo_resultat 'Ecoute' 'Sockets' 'INFO' \"$(printf '%s\\n' \"${KJEMO_ECOUTE}\" | head -30)\" \\",
      "  'Les options, lettre par lettre : -l en ecoute seulement, -n sans resoudre les noms, -t TCP, -u UDP, -p le processus.'",
      '',
      '# Les trois categories, separees.',
      'KJEMO_EXPOSES="$(printf \'%s\\n\' "${KJEMO_ECOUTE}" | awk \'$5 ~ /^(0\\.0\\.0\\.0|\\*|\\[::\\]):/ {print $1, $5, $7}\' | head -20 || true)"',
      'KJEMO_LOCAUX="$(printf \'%s\\n\' "${KJEMO_ECOUTE}" | awk \'$5 ~ /^(127\\.0\\.0\\.1|\\[::1\\]):/ {print $1, $5, $7}\' | head -20 || true)"',
      'if [ -n "${KJEMO_EXPOSES}" ]; then',
      "  kjemo_resultat 'Ecoute' 'Exposes sur toutes les interfaces' 'ATTENTION' \"${KJEMO_EXPOSES}\" \\",
      "    'Ces services acceptent des connexions venant de n importe quelle interface. Chacun est joignable des que le pare-feu et le reseau le permettent : c est la liste a croiser avec les regles, et c est l objet de l etape suivante.'",
      'else',
      "  kjemo_resultat 'Ecoute' 'Exposes sur toutes les interfaces' 'OK' 'aucun' ''",
      'fi',
      'if [ -n "${KJEMO_LOCAUX}" ]; then',
      // ATTENTION, et non INFO : le rapport Console n affiche que les lignes
      // ATTENTION, PROBLEME et IGNORE, et seulement leur commentaire. Un
      // service lie au bouclage est la cause de la moitie des « j ai ouvert
      // le port et ca ne marche pas » : le laisser en INFO le rendrait
      // invisible a l operateur, et la liste doit figurer dans le
      // commentaire pour la meme raison.
      "  kjemo_resultat 'Ecoute' 'Lies au bouclage seulement' 'ATTENTION' \"${KJEMO_LOCAUX}\" \\",
      '    "Ces services ecoutent sur le bouclage seulement, donc ne sont joignables QUE depuis la machine : ${KJEMO_LOCAUX}. Ouvrir leur port dans le pare-feu ne les rendra pas accessibles : c est la configuration du service qu il faut changer — souvent une directive « bind » ou « listen ». C est la cause de la moitie des « j ai ouvert le port et ca ne marche pas »."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE CROISEMENT, QUI EST LA RAISON D ETRE DE CET ASSISTANT',
      '#',
      '# Pour chaque port expose, deux questions : une regle l autorise-t-elle ?',
      '# et la politique par defaut le laisse-t-elle passer ? Les deux reponses',
      '# ensemble disent si le port est joignable — ce qu aucune des deux ne dit',
      '# toute seule.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PORTS="$(printf \'%s\\n\' "${KJEMO_ECOUTE}" \\',
      '  | awk \'$5 ~ /^(0\\.0\\.0\\.0|\\*|\\[::\\]):/ {n=split($5,a,":"); print a[n]}\' \\',
      '  | sort -un | head -20 || true)"',
      'if [ -n "${KJEMO_PORTS}" ]; then',
      '  KJEMO_SANS_REGLE=\'\'',
      '  for kjemo_p in ${KJEMO_PORTS}; do',
      '    kjemo_trouve=0',
      '    if [ "${KJEMO_UFW_ACTIF}" -eq 1 ]; then',
      '      if printf \'%s\\n\' "${KJEMO_UFW}" | grep -qE "(^|[^0-9])${kjemo_p}(/| |$)"; then kjemo_trouve=1; fi',
      '    fi',
      '    if [ "${kjemo_trouve}" -eq 0 ] && [ -n "${KJEMO_NFT:-}" ]; then',
      '      if printf \'%s\\n\' "${KJEMO_NFT}" | grep -qE "dport [{ ]*[^}]*\\b${kjemo_p}\\b"; then kjemo_trouve=1; fi',
      '    fi',
      '    if [ "${kjemo_trouve}" -eq 0 ]; then',
      '      KJEMO_SANS_REGLE="${KJEMO_SANS_REGLE} ${kjemo_p}"',
      '    fi',
      '  done',
      '  if [ -n "${KJEMO_SANS_REGLE}" ]; then',
      '    if [ "${KJEMO_UFW_ACTIF}" -eq 1 ] || [ "${KJEMO_NFT_REGLES:-0}" -gt 0 ] 2>/dev/null; then',
      "      kjemo_resultat 'Croisement' 'Ports exposes sans regle qui les nomme' 'INFO' \"${KJEMO_SANS_REGLE# }\" \\",
      "        'Ces ports sont en ecoute sur toutes les interfaces et aucune regle ne les nomme. Avec une politique entrante en DENY, ils ne sont PAS joignables de l exterieur — et c est bien. Avec une politique en ALLOW, ils le sont tous. La recherche est textuelle : une regle par service nomme, ou par plage, peut les couvrir sans que leur numero apparaisse.'",
      '    else',
      "      kjemo_resultat 'Croisement' 'Ports exposes sans aucun pare-feu' 'PROBLEME' \"${KJEMO_SANS_REGLE# }\" \\",
      "        'Ces ports sont en ecoute sur toutes les interfaces, et le noyau n applique aucune regle de filtrage : ils sont joignables depuis tout ce qui peut atteindre la machine. Si elle n est pas derriere un pare-feu de perimetre, c est la liste de ce qui est expose.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'Croisement' 'Ports exposes sans regle' 'OK' 'aucun' \\",
      "      'Chaque port expose est nomme par au moins une regle.'",
      '  fi',
      '',
      '  # L inverse : une regle qui ouvre un port ou rien n ecoute. Ce n est pas',
      '  # dangereux, c est de la dette — et elle finit par autoriser un service',
      '  # installe des mois plus tard, sans decision.',
      '  if [ "${KJEMO_UFW_ACTIF}" -eq 1 ]; then',
      '    KJEMO_REGLES_PORTS="$(printf \'%s\\n\' "${KJEMO_UFW}" \\',
      '      | awk \'/ALLOW/ {print $1}\' | grep -oE \'^[0-9]+\' | sort -un | head -20 || true)"',
      '    KJEMO_INUTILES=\'\'',
      '    for kjemo_r in ${KJEMO_REGLES_PORTS}; do',
      '      if ! printf \'%s\\n\' "${KJEMO_PORTS}" | grep -qx -- "${kjemo_r}"; then',
      '        KJEMO_INUTILES="${KJEMO_INUTILES} ${kjemo_r}"',
      '      fi',
      '    done',
      '    if [ -n "${KJEMO_INUTILES}" ]; then',
      "      kjemo_resultat 'Croisement' 'Regles sans service en ecoute' 'ATTENTION' \"${KJEMO_INUTILES# }\" \\",
      "        'Ces ports sont autorises et rien n ecoute derriere. Ce n est pas dangereux aujourd hui : c est de la dette. Le jour ou un service se liera a l un de ces ports, il sera joignable sans que personne ait pris la decision de l exposer. Les regles devenues inutiles se retirent avec « ufw delete », par leur numero : « ufw status numbered ».'",
      '    fi',
      '  fi',
      'fi',
      '',
      ...(port !== '' ? [
        '# ---------------------------------------------------------------------------',
        '# ETAPE 4 - LE PORT DEMANDE, TRAITE A PART',
        '# ---------------------------------------------------------------------------',
        'KJEMO_ECOUTE_PORT="$(printf \'%s\\n\' "${KJEMO_ECOUTE}" | awk -v p=":${KJEMO_PORT}\\$" \'$5 ~ p {print $1, $5, $7}\' || true)"',
        'if [ -z "${KJEMO_ECOUTE_PORT}" ]; then',
        "  kjemo_resultat 'Port demande' \"${KJEMO_PORT}\" 'PROBLEME' 'rien n ecoute' \\",
        "    'Aucun service n ecoute sur ce port. Le pare-feu n y est pour rien : une connexion sera refusee meme si une regle l autorise, et le message cote client sera « Connection refused ». Verifie d abord que le service tourne.'",
        'else',
        '  case "${KJEMO_ECOUTE_PORT}" in',
        '    *127.0.0.1*|*::1*)',
        "      kjemo_resultat 'Port demande' \"${KJEMO_PORT}\" 'ATTENTION' \"${KJEMO_ECOUTE_PORT}\" \\",
        "        'Le service ecoute, mais sur le bouclage SEULEMENT : il est injoignable de l exterieur quoi que fasse le pare-feu. C est la configuration du service qu il faut changer — souvent une directive « bind » ou « listen ».'",
        '      ;;',
        '    *)',
        "      kjemo_resultat 'Port demande' \"${KJEMO_PORT}\" 'OK' \"${KJEMO_ECOUTE_PORT}\" \\",
        "        'Le service ecoute sur une adresse joignable. Reste la question du pare-feu, ci-dessous.'",
        '      ;;',
        '  esac',
        'fi',
        'if [ "${KJEMO_UFW_ACTIF}" -eq 1 ]; then',
        '  KJEMO_REGLE_PORT="$(printf \'%s\\n\' "${KJEMO_UFW}" | grep -E "(^|[^0-9])${KJEMO_PORT}(/| )" || true)"',
        '  if [ -n "${KJEMO_REGLE_PORT}" ]; then',
        "    kjemo_resultat 'Port demande' 'Regle UFW' 'OK' \"${KJEMO_REGLE_PORT}\" \\",
        "      'Une regle nomme ce port. Son verdict — ALLOW ou DENY — est en milieu de ligne, et la colonne de droite dit depuis OU : « Anywhere » signifie depuis partout.'",
        '  else',
        "    kjemo_resultat 'Port demande' 'Regle UFW' 'ATTENTION' 'aucune regle ne le nomme' \\",
        "      'Aucune regle UFW ne nomme ce port : son sort depend de la politique par defaut. En DENY entrant, il n est pas joignable. Pour l ouvrir, c est une commande rapide — avec sa commande d annulation exacte — et non cet assistant, qui ne modifie rien.'",
        '  fi',
        'fi',
      ] : []),
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - IPv6, LE JEU DE REGLES QU ON OUBLIE',
      '#',
      '# Une regle ecrite pour IPv4 seulement laisse le meme service joignable en',
      '# IPv6 si la machine en a une adresse. C est un trou discret, parce que',
      '# tous les tests faits « en IPv4 » le confirment ferme.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_IPV6="$(ip -6 -brief address show scope global 2>/dev/null | head -5 || true)"',
      'if [ -n "${KJEMO_IPV6}" ]; then',
      '  KJEMO_V6_ECOUTE="$(printf \'%s\\n\' "${KJEMO_ECOUTE}" | awk \'$5 ~ /^\\[::\\]:/ {print $1, $5, $7}\' | head -10 || true)"',
      '  if [ -n "${KJEMO_V6_ECOUTE}" ]; then',
      "    kjemo_resultat 'IPv6' 'Adresses globales et services a l ecoute' 'ATTENTION' \"${KJEMO_IPV6} || ${KJEMO_V6_ECOUTE}\" \\",
      "      'Cette machine a une adresse IPv6 globale ET des services en ecoute en IPv6. Une regle de pare-feu ecrite seulement pour IPv4 ne les couvre pas : le service reste joignable en IPv6, et tous les tests faits en IPv4 confirmeront que « c est bien ferme ». UFW gere les deux familles quand IPV6=yes dans /etc/default/ufw ; nftables demande des regles explicites pour ip6.'",
      '  fi',
      '  if kjemo_dispo ufw && [ -r /etc/default/ufw ]; then',
      '    KJEMO_UFW_V6="$(grep -E \'^IPV6=\' /etc/default/ufw 2>/dev/null | head -1 || true)"',
      "    kjemo_resultat 'IPv6' 'UFW et IPv6' 'INFO' \"${KJEMO_UFW_V6:-non renseigne}\" \\",
      "      'IPV6=yes fait appliquer chaque regle UFW aux deux familles. A « no », les regles ne valent que pour IPv4.'",
      '  fi',
      'else',
      "  kjemo_resultat 'IPv6' 'Adresse globale' 'OK' 'aucune' \\",
      "    'Aucune adresse IPv6 globale : la question ne se pose pas sur cette machine, pour l instant.'",
      'fi',

      ...blocRapportBash({ prefixeFichier: 'kjemo-pare-feu' }),
    ]);
  },

  gui: [
    'UFW n’est pas un pare-feu : c’est une interface qui écrit des règles nftables. « ufw status inactive » ne veut pas dire « aucune règle ».',
    'Lis les deux : « sudo ufw status verbose » puis « sudo nft list ruleset ».',
    'La ligne qui décide de tout est « Default: ». En « allow (incoming) », tout service qui écoute est joignable dès qu’il démarre.',
    'Regarde ce qui écoute, et sur quelle adresse : « sudo ss -lntup ».',
    'Croise les deux. Un port ouvert devant un service lié à 127.0.0.1 ne sert à rien ; un service lié à 0.0.0.0 derrière une politique DENY n’est pas joignable.',
    'Pour ouvrir un port : « sudo ufw allow 22/tcp ». Pour refermer, par son numéro : « sudo ufw status numbered » puis « sudo ufw delete <numéro> ».',
    'Les règles devenues inutiles sont de la dette : le jour où un service se liera à ce port, il sera exposé sans décision.',
    'IPv6 : une règle écrite pour IPv4 seulement laisse le service joignable en IPv6. Vérifie « IPV6=yes » dans /etc/default/ufw.',
    'Avant d’activer UFW sur une machine distante, autorise SSH D’ABORD : « sudo ufw allow OpenSSH » puis « sudo ufw enable ». Dans l’autre ordre, la session se coupe.',
  ],

  keywords: ['pare-feu', 'firewall', 'ufw', 'nft', 'nftables', 'iptables', 'port',
    'ouvert', 'ferme', 'politique', 'deny', 'allow', 'ss', 'ecoute', 'expose',
    'ipv6', 'audit', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'sudo pour lire les RÈGLES : « ufw status » et « nft list ruleset » ne répondent qu’à root. Sans privilège, les ports en écoute sont lus quand même, et les sections de règles sont annoncées IGNORE plutôt que vides.',
    'Le numéro du port à vérifier, si la question porte sur un service précis.',
    'Pour une vérification depuis l’extérieur : une seconde machine sur le même réseau. L’assistant ne la simule pas — il croise ce qui écoute avec ce qui est autorisé, ce qui répond à la question sans dépendre d’un tiers.',
  ],

  commonErrors: [
    {
      message: 'J’ai ouvert le port et la connexion est toujours refusée',
      code: 'ECONNREFUSED',
      cause: 'Le service écoute sur 127.0.0.1 seulement. « Connection refused » vient du service, pas du pare-feu — un pare-feu qui bloque donne un délai d’attente, pas un refus immédiat.',
      fix: 'Regarder l’adresse d’écoute, puis la configuration du service.',
      command: 'sudo ss -lntup | grep :8080',
    },
    {
      message: 'ufw status dit inactive, mais des connexions sont bloquées',
      code: 'KJEMO',
      cause: 'UFW inactif ne veut pas dire nftables vide : des règles peuvent avoir été posées autrement — par Docker, par un script, ou par un outil de configuration.',
      fix: 'Lire ce que le noyau applique vraiment.',
      command: 'sudo nft list ruleset',
    },
    {
      message: 'J’ai activé UFW et j’ai perdu ma session SSH',
      code: 'KJEMO',
      cause: 'UFW applique sa politique par défaut dès l’activation, et refuse l’entrant. Sans règle pour SSH posée AVANT, la session tombe.',
      fix: 'Toujours dans cet ordre : autoriser SSH, puis activer. Et garder une seconde voie d’accès.',
      command: 'sudo ufw allow OpenSSH && sudo ufw enable',
    },
    {
      message: 'Le port est fermé en IPv4 et le service reste joignable',
      code: 'KJEMO',
      cause: 'La règle ne couvre qu’IPv4, et le service écoute aussi en IPv6. Tous les tests faits en IPv4 confirment que « c’est bien fermé ».',
      fix: 'Vérifier IPV6=yes dans /etc/default/ufw, ou ajouter des règles ip6 explicites en nftables.',
      command: 'grep IPV6 /etc/default/ufw; sudo ss -lntup | grep \'\\[::\\]\'',
    },
    {
      message: 'Une règle autorise un port où rien n’écoute',
      code: 'KJEMO',
      cause: 'Dette laissée par un service retiré, ou par un essai. Inoffensive aujourd’hui.',
      fix: 'La retirer par son numéro, après l’avoir identifiée. Le jour où un service se liera à ce port, il serait exposé sans décision.',
      command: 'sudo ufw status numbered',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport lit UFW ET nftables, et dit que le second est la vérité de ce que le noyau applique.',
    'La politique par défaut entrante est signalée séparément : « allow » est un PROBLEME nommé.',
    'Les services exposés sur toutes les interfaces et ceux liés au bouclage sont listés séparément.',
    'Le croisement est présent : les ports exposés qu’aucune règle ne nomme, et les règles sans service en écoute.',
    'La couverture IPv6 est examinée dès que la machine a une adresse IPv6 globale.',
    'Aucune règle n’a été ajoutée, retirée ni rechargée : le script n’appelle ni « ufw allow », ni « ufw enable », ni « nft add », ni « ufw reload ».',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant ne fait que lire. Les commandes qui modifient le pare-feu sont des commandes rapides, chacune avec son annulation exacte.',
    diagnostic: `# L etat complet :
sudo ufw status verbose
sudo ufw status numbered
sudo nft list ruleset
sudo ss -lntup`,
    command: `# Aucune modification a annuler.
#
# Pour ouvrir un port — et le refermer, ce qui compte autant :
#   sudo ufw allow 22/tcp
#   sudo ufw status numbered
#   sudo ufw delete <numero>
#
# L ORDRE qui evite de perdre la session, sur une machine distante :
#   sudo ufw allow OpenSSH      # d ABORD
#   sudo ufw enable             # ensuite
# Dans l autre ordre, la politique par defaut s applique immediatement et
# la session tombe.
#
# Et « sudo ufw reset » remet UFW a zero : il EFFACE toutes les regles,
# y compris celle qui autorise SSH. A ne lancer que depuis une console
# locale.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Activer un pare-feu sur une machine distante coupe la session si aucune règle n’autorise SSH au moment de l’activation. Et « ufw reset » efface tout, y compris cette règle : il se lance depuis une console locale, ou pas du tout.',
  },

  checks: [
    'Aucune écriture : ni ufw allow, ni ufw deny, ni ufw enable, ni ufw disable, ni ufw reset, ni ufw reload, ni nft add, ni nft -f.',
    'UFW et nftables sont lus tous les deux, dans cet ordre, et le rapport explique que le second porte la vérité : UFW n’est qu’une interface qui écrit dedans.',
    'Un UFW inactif est signalé comme ATTENTION, avec la précision que nftables peut porter d’autres règles.',
    'Une politique par défaut entrante en « allow » est un PROBLEME nommé, avec sa conséquence : tout service qui écoute devient joignable dès qu’il démarre.',
    'Les sockets en écoute sont classés en trois catégories — exposés, bouclage, IPv6 — et chaque lettre des options de ss est expliquée.',
    'Le croisement se fait dans les deux sens : ports exposés sans règle, et règles sans service en écoute.',
    'La limite de la recherche textuelle est écrite : une règle par service nommé ou par plage peut couvrir un port sans que son numéro apparaisse.',
    'La couverture IPv6 est examinée, et le défaut « règle IPv4 seulement » est expliqué avec la raison pour laquelle il passe inaperçu.',
    'L’ordre « autoriser SSH puis activer » figure dans la fiche et dans la procédure d’annulation : l’inverse coupe la session.',
  ],

  source: `${M}/man8/ufw.8.html`,
  sources: [
    { label: 'ufw(8)', url: `${M}/man8/ufw.8.html` },
    { label: 'nft(8) — nftables', url: `${M}/man8/nft.8.html` },
    { label: 'iptables-save(8)', url: `${M}/man8/iptables-save.8.html` },
    { label: 'ss(8)', url: `${M}/man8/ss.8.html` },
    { label: 'ip(8)', url: `${M}/man8/ip.8.html` },
  ],
};

export const toolsLinuxI = [
  linuxNetworkDiagnostic,
  netplanReadiness,
  linuxDnsDiagnostic,
  linuxFirewallAudit,
];
