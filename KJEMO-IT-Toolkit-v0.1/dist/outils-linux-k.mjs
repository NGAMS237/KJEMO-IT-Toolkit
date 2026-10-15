/**
 * outils-linux-k.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Cockpit — deux assistants, tous deux en LECTURE.
 *
 *   cockpit-install-readiness      Dit si Cockpit PEUT fonctionner sur cette
 *                                  machine, et remet la procédure
 *                                  d'installation. N'installe rien, n'active
 *                                  rien, n'ouvre aucun port.
 *   cockpit-connection-diagnostic  Le cas du cours : « Cockpit est installé et
 *                                  https://IP:9090 ne répond pas ». Six
 *                                  couches, dans l'ordre où elles cassent.
 *
 * ---------------------------------------------------------------------------
 * CE QUE L'ACTIVATION PAR SOCKET CHANGE, ICI AUSSI
 * ---------------------------------------------------------------------------
 * La documentation de Cockpit est explicite : « it typically starts on demand
 * via systemd socket activation », et « the actual cockpit.service and
 * cockpit-ws process will start on demand when a browser accesses the
 * cockpit.socket », « usually on port 9090 ».
 *
 * Conséquence, exactement comme pour SSH : `systemctl is-active cockpit` — le
 * SERVICE — répond « inactive » sur une machine où Cockpit fonctionne
 * parfaitement. C'est `cockpit.socket` qui écoute. Diagnostiquer le service
 * plutôt que le socket, c'est réparer ce qui n'a rien, et le symptôme
 * « installé mais ne répond pas » commence souvent là.
 *
 * ---------------------------------------------------------------------------
 * LE CERTIFICAT AUTOSIGNÉ : UN AVERTISSEMENT ATTENDU, PAS UNE PANNE
 * ---------------------------------------------------------------------------
 * La documentation officielle dit : « If no certificate is found, a
 * self-signed certificate is created and stored in the 0-self-signed.cert
 * file », dans `/etc/cockpit/ws-certs.d`, et Cockpit « will use the last file
 * with a .cert or .crt extension in alphabetical order ».
 *
 * Le navigateur avertit donc à la première visite. Cet avertissement est le
 * comportement NORMAL d'un certificat autosigné : il dit « je ne peux pas
 * vérifier qui tu es », et c'est vrai. La réponse n'est jamais de désactiver
 * la vérification — ni `curl -k`, ni `--insecure`, ni une case cochée dans le
 * navigateur « pour cette fois » qui devient une habitude. Elle est de
 * déposer un certificat reconnu dans ce dossier, ou de comparer l'empreinte
 * une fois, hors du canal qu'on cherche à sécuriser.
 *
 * Aucun des deux assistants n'émet de requête HTTPS, et `-k` comme
 * `--insecure` n'apparaissent nulle part : ni dans le code, ni dans une
 * procédure, ni dans une commande rapide. Le banc le mesure.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import { validateChoix, validatePortTcp } from './validateurs-linux.mjs';
import { assertValid } from './noyau.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';
const DOC = 'https://docs.cockpit-project.org/cockpit-guide/latest/guide';

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
 * Le bloc commun aux deux assistants : le paquet, le socket, le port.
 *
 * Il est partagé parce que les deux assistants posent les MÊMES trois
 * premières questions, et qu'une divergence entre eux produirait deux rapports
 * qui se contredisent sur la même machine — ce qui est pire que l'absence de
 * l'un des deux.
 */
function blocCockpitBase() {
  return [
    '# ---------------------------------------------------------------------------',
    '# COUCHE 1 - LE PAQUET',
    '#',
    '# « cockpit » est un meta-paquet : il tire cockpit-ws, cockpit-bridge et',
    '# cockpit-system. Une installation partielle — cockpit-ws sans',
    '# cockpit-system, par exemple — donne une interface qui s ouvre et dans',
    '# laquelle presque rien ne s affiche, ce qui ne ressemble pas du tout a un',
    '# probleme de paquet.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_PAQUET_OK=0',
    "KJEMO_PAQUETS_VUS=''",
    'if kjemo_dispo dpkg-query; then',
    '  for kjemo_p in cockpit cockpit-ws cockpit-bridge cockpit-system cockpit-networkmanager cockpit-storaged; do',
    "    kjemo_etat=\"$(dpkg-query -W -f='${Status}' \"${kjemo_p}\" 2>/dev/null || true)\"",
    '    if [ "${kjemo_etat#*ok installed}" != "${kjemo_etat}" ]; then',
    '      KJEMO_PAQUETS_VUS="${KJEMO_PAQUETS_VUS} ${kjemo_p}"',
    '    fi',
    '  done',
    'fi',
    'case " ${KJEMO_PAQUETS_VUS} " in',
    '  *" cockpit-ws "*)',
    '    KJEMO_PAQUET_OK=1',
    "    kjemo_resultat 'Paquet' 'cockpit-ws' 'OK' \"${KJEMO_PAQUETS_VUS# }\" \\",
    '      "Paquets Cockpit installes :${KJEMO_PAQUETS_VUS:- aucun}. cockpit-ws est le serveur web : c est lui qui ecoute. Sans cockpit-system, l interface s ouvre et reste presque vide — ce qui ne ressemble pas a un probleme de paquet."',
    '    ;;',
    '  *)',
    "    kjemo_resultat 'Paquet' 'cockpit-ws' 'PROBLEME' \"${KJEMO_PAQUETS_VUS:-aucun}\" \\",
    '      "Le paquet cockpit-ws n est pas installe (vus :${KJEMO_PAQUETS_VUS:- aucun}). Aucun reglage ne remplace cette couche : « sudo apt install cockpit » installe le meta-paquet et ses dependances."',
    '    ;;',
    'esac',
    '',
    '# ---------------------------------------------------------------------------',
    '# COUCHE 2 - LE SOCKET, ET NON LE SERVICE',
    '#',
    '# La documentation de Cockpit est explicite : le service demarre A LA',
    '# DEMANDE, quand un navigateur atteint cockpit.socket. Donc',
    '# « systemctl is-active cockpit » repond « inactive » sur une machine ou',
    '# Cockpit fonctionne — et c est le point de depart de la moitie des',
    '# diagnostics qui partent dans le mur.',
    '# ---------------------------------------------------------------------------',
    "KJEMO_SOCKET='inconnu'",
    "KJEMO_SOCKET_ACT='inconnu'",
    "KJEMO_SERVICE='inconnu'",
    'KJEMO_SOCKET_OK=0',
    'if kjemo_dispo systemctl; then',
    '  KJEMO_SOCKET="$(systemctl is-active cockpit.socket 2>/dev/null || true)"',
    '  KJEMO_SOCKET_ACT="$(systemctl is-enabled cockpit.socket 2>/dev/null || true)"',
    '  KJEMO_SERVICE="$(systemctl is-active cockpit.service 2>/dev/null || true)"',
    'fi',
    "kjemo_resultat 'Unite' 'cockpit.service' 'INFO' \"${KJEMO_SERVICE:-inconnu}\" \\",
    "  'Le SERVICE demarre a la demande, quand un navigateur atteint le socket : « inactive » est son etat normal au repos, et ne prouve aucune panne. C est le socket qu il faut interroger.'",
    'if [ "${KJEMO_SOCKET}" = \'active\' ]; then',
    '  KJEMO_SOCKET_OK=1',
    "  kjemo_resultat 'Unite' 'cockpit.socket' 'OK' \"active, au-demarrage=${KJEMO_SOCKET_ACT:-inconnu}\" \\",
    '    "Le socket ecoute (demarrage automatique : ${KJEMO_SOCKET_ACT:-inconnu}). Si « au-demarrage » n est pas « enabled », Cockpit repond maintenant et ne repondra plus apres un redemarrage — c est la panne qui apparait une semaine plus tard et qu on ne relie plus a rien."',
    '  if [ "${KJEMO_SOCKET_ACT}" != \'enabled\' ]; then',
    "    kjemo_resultat 'Unite' 'Demarrage automatique' 'ATTENTION' \"${KJEMO_SOCKET_ACT:-inconnu}\" \\",
    '      "cockpit.socket est actif mais son demarrage automatique vaut « ${KJEMO_SOCKET_ACT:-inconnu} ». Au prochain redemarrage, Cockpit ne repondra plus, et rien ne rappellera que ce socket avait ete demarre a la main. La documentation officielle donne la commande : systemctl enable cockpit.socket"',
    '  fi',
    'else',
    "  kjemo_resultat 'Unite' 'cockpit.socket' 'PROBLEME' \"${KJEMO_SOCKET:-inconnu}\" \\",
    '    "cockpit.socket n est pas actif (etat : ${KJEMO_SOCKET:-inconnu}) : rien n ecoute, et c est la cause. Ce script ne demarre rien — l etat courant est la preuve, et le demarrer l effacerait avant qu on ait compris pourquoi il etait arrete."',
    'fi',
    '',
    '# ---------------------------------------------------------------------------',
    '# COUCHE 3 - LE PORT, ET SURTOUT L ADRESSE SUR LAQUELLE IL ECOUTE',
    '#',
    '# Un socket actif qui ecoute sur 127.0.0.1 est joignable depuis la machine',
    '# SEULEMENT. Aucun pare-feu ouvert n y changera rien, et c est la cause la',
    '# plus frequente de « ca marche en local et pas depuis mon poste ».',
    '#',
    '# Le port vient de la directive ListenStream de l unite socket : la page de',
    '# cockpit-ws precise que l option --port n a aucun effet sous activation',
    '# par socket, et qu il faut modifier cockpit.socket « in the usual systemd',
    '# manner ».',
    '# ---------------------------------------------------------------------------',
    'KJEMO_PORT_OK=0',
    'KJEMO_EXPOSE=0',
    "KJEMO_SOCKETS=''",
    "KJEMO_LISTEN=''",
    'if kjemo_dispo systemctl; then',
    '  KJEMO_LISTEN="$(systemctl show cockpit.socket -p Listen --value 2>/dev/null || true)"',
    "  kjemo_resultat 'Ecoute' 'ListenStream declare' 'INFO' \"${KJEMO_LISTEN:-non lu}\" \\",
    '    "Ce que l unite socket DECLARE ecouter : ${KJEMO_LISTEN:-non lu}. Pour changer le port, c est ici que cela se fait — l option --port de cockpit-ws n a aucun effet sous activation par socket, la documentation le dit."',
    'fi',
    'if kjemo_dispo ss; then',
    '  KJEMO_SOCKETS="$(ss -lntp 2>/dev/null | grep -E "[:.]${KJEMO_PORT}[[:space:]]" || true)"',
    '  if [ -n "${KJEMO_SOCKETS}" ]; then',
    '    KJEMO_PORT_OK=1',
    '    # L adresse LOCALE est la 4e colonne de « ss -lntp ». Chercher le',
    '    # motif dans la ligne entiere accuse la colonne du PAIR, qui vaut',
    '    # « 0.0.0.0:* » pour un socket en ecoute : un service lie au bouclage',
    '    # etait alors declare expose. Defaut trouve par le banc.',
    "    KJEMO_LOCALES=\"$(printf '%s\\n' \"${KJEMO_SOCKETS}\" | awk '{print \$4}')\"",
    "    if printf '%s\\n' \"${KJEMO_LOCALES}\" | grep -qE '^(0\\.0\\.0\\.0|\\*|\\[::\\]):'; then",
    '      KJEMO_EXPOSE=1',
    "      kjemo_resultat 'Ecoute' \"Port ${KJEMO_PORT}\" 'OK' \"${KJEMO_SOCKETS}\" \\",
    '        "Le port ${KJEMO_PORT} est en ecoute sur toutes les interfaces : joignable depuis le reseau, si le pare-feu le permet."',
    '    else',
    "      kjemo_resultat 'Ecoute' \"Port ${KJEMO_PORT}\" 'PROBLEME' \"${KJEMO_SOCKETS}\" \\",
    '        "Le port ${KJEMO_PORT} ecoute sur le BOUCLAGE seulement (${KJEMO_SOCKETS}) : Cockpit repond depuis la machine et sera injoignable depuis ton poste, quoi que fasse le pare-feu. Ce n est pas un probleme de reseau : c est l adresse d ecoute du socket, et le pare-feu n y est pour rien : ouvrir le port dans UFW ne changera rien."',
    '    fi',
    '  else',
    "    kjemo_resultat 'Ecoute' \"Port ${KJEMO_PORT}\" 'PROBLEME' 'rien en ecoute' \\",
    '      "Rien n ecoute sur le port ${KJEMO_PORT}. Si le socket est pourtant actif, compare avec le ListenStream declare plus haut : un port change dans l unite et un socket non recharge donnent exactement ce resultat."',
    '  fi',
    'else',
    "  kjemo_resultat 'Ecoute' 'ss' 'IGNORE' 'commande absente' \\",
    "    'La commande ss est absente : la couche « qu est-ce qui ecoute » n a PAS ete controlee. Elle vient du paquet iproute2, present par defaut.'",
    'fi',
    '',
  ];
}

/** Le pare-feu, pour un port donné. Commun aux deux assistants. */
function blocCockpitFeu() {
  return [
    '# ---------------------------------------------------------------------------',
    '# COUCHE 4 - LE PARE-FEU',
    '#',
    '# Le symptome distingue cette couche des precedentes : un pare-feu qui',
    '# bloque donne un DELAI D ATTENTE dans le navigateur — la page tourne — et',
    '# non un refus immediat. « Connexion refusee » vient de la machine,',
    '# « delai depasse » vient du chemin.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_FEU_OK=1',
    'if kjemo_dispo ufw; then',
    '  KJEMO_UFW="$(ufw status 2>/dev/null || true)"',
    '  case "${KJEMO_UFW}" in',
    '    *inactive*)',
    "      kjemo_resultat 'Pare-feu' 'ufw' 'INFO' 'inactif' \\",
    "        'UFW est inactif : il ne bloque rien. Si le navigateur n obtient pas de reponse, ce n est pas lui.'",
    '      ;;',
    '    *)',
    '      if printf \'%s\\n\' "${KJEMO_UFW}" | grep -qE "(^|[^0-9])${KJEMO_PORT}(/tcp)?[[:space:]]+ALLOW"; then',
    "        kjemo_resultat 'Pare-feu' \"ufw, port ${KJEMO_PORT}\" 'OK' 'autorise' \\",
    '          "UFW est actif et une regle autorise le port ${KJEMO_PORT}."',
    '      else',
    '        KJEMO_FEU_OK=0',
    "        kjemo_resultat 'Pare-feu' \"ufw, port ${KJEMO_PORT}\" 'PROBLEME' 'aucune regle vue' \\",
    '          "UFW est actif et aucune regle n autorise le port ${KJEMO_PORT}. Dans le navigateur, cela donne un DELAI D ATTENTE, et non « connexion refusee ». Ce script n ouvre rien : la commande figure dans la procedure, et son inverse exact est « ufw delete allow ${KJEMO_PORT}/tcp »."',
    '      fi',
    '      ;;',
    '  esac',
    'else',
    "  kjemo_resultat 'Pare-feu' 'ufw' 'INFO' 'absent' \\",
    "    'UFW n est pas installe. Un autre pare-feu peut filtrer : l assistant linux-firewall-audit lit aussi nftables et iptables, et croise les regles avec les ports en ecoute.'",
    'fi',
    '',
  ];
}

/**
 * Le certificat. Commun aux deux assistants, et c'est la section où il serait
 * le plus tentant de proposer un contournement.
 */
function blocCockpitCertificat() {
  return [
    '# ---------------------------------------------------------------------------',
    '# COUCHE 5 - LE CERTIFICAT, ET L AVERTISSEMENT QUI EST NORMAL',
    '#',
    '# La documentation officielle : « If no certificate is found, a self-signed',
    '# certificate is created and stored in the 0-self-signed.cert file », dans',
    '# /etc/cockpit/ws-certs.d, et Cockpit « will use the last file with a .cert',
    '# or .crt extension in alphabetical order ».',
    '#',
    '# Deux consequences que ce rapport doit dire :',
    '#   1. l avertissement du navigateur est ATTENDU avec un certificat',
    '#      autosigne. Ce n est pas une panne, et ce n est pas non plus rien :',
    '#      il signale qu on ne peut pas verifier l identite du serveur.',
    '#   2. l ordre ALPHABETIQUE decide. Un certificat depose sous un nom qui',
    '#      passe AVANT « 0-self-signed.cert » ne sera jamais utilise, et rien',
    '#      ne le dira.',
    '#',
    '# La reponse a l avertissement n est jamais de desactiver la verification.',
    '# Ni -k, ni --insecure, ni une exception permanente dans le navigateur :',
    '# c est deposer un certificat reconnu, ou comparer l empreinte une fois,',
    '# hors du canal qu on cherche justement a securiser.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_CERTS=\'/etc/cockpit/ws-certs.d\'',
    'KJEMO_CERT_OK=0',
    'if [ ! -d "${KJEMO_CERTS}" ]; then',
    "  kjemo_resultat 'Certificat' 'ws-certs.d' 'ATTENTION' 'dossier absent' \\",
    '    "Le dossier ${KJEMO_CERTS} n existe pas. Il est cree par le paquet, et Cockpit y depose son certificat autosigne au premier demarrage : son absence va de pair avec un cockpit-ws jamais lance, ou pas installe."',
    'elif [ ! -r "${KJEMO_CERTS}" ]; then',
    "  kjemo_resultat 'Certificat' 'ws-certs.d' 'IGNORE' 'illisible sans root' \\",
    '    "Le dossier ${KJEMO_CERTS} n est pas lisible depuis cette session : la couche certificat n a PAS ete controlee. Relance avec sudo. Ce rapport ne conclut rien sur le certificat."',
    'else',
    '  # find et non ls : un nom inattendu ne doit pas casser l inventaire.',
    '  # Deux appels a find plutot qu un groupe entre parentheses : celles de',
    '  # find doivent etre protegees du shell, et une protection qui traverse',
    '  # la generation du script est une erreur de syntaxe que bash -n a',
    '  # attrapee ici meme. find et non ls : un nom inattendu ne doit pas',
    '  # casser l inventaire (SC2012).',
    '  KJEMO_LISTE_CERTS="$( {',
    "    find \"${KJEMO_CERTS}\" -maxdepth 1 -type f -name '*.cert' -printf '%f\\n' 2>/dev/null || true",
    "    find \"${KJEMO_CERTS}\" -maxdepth 1 -type f -name '*.crt' -printf '%f\\n' 2>/dev/null || true",
    '  } | sort | paste -sd, - || true)"',
    '  if [ -z "${KJEMO_LISTE_CERTS}" ]; then',
    "    kjemo_resultat 'Certificat' 'Inventaire' 'ATTENTION' 'aucun' \\",
    '      "Aucun fichier .cert ni .crt dans ${KJEMO_CERTS}. Cockpit en genere un autosigne au premier demarrage de cockpit-ws : son absence signifie que ce service n a jamais demarre."',
    '  else',
    '    KJEMO_CERT_OK=1',
    '    # Le DERNIER par ordre alphabetique : c est celui que Cockpit utilise.',
    '    KJEMO_CERT_RETENU="$(printf \'%s\' "${KJEMO_LISTE_CERTS}" | tr \',\' \'\\n\' | tail -1)"',
    "    kjemo_resultat 'Certificat' 'Retenu' 'INFO' \"${KJEMO_CERT_RETENU}\" \\",
    '      "Certificats presents : ${KJEMO_LISTE_CERTS}. Celui que Cockpit utilise est le DERNIER par ordre alphabetique, soit ${KJEMO_CERT_RETENU} — la documentation officielle le dit ainsi. Un certificat depose sous un nom qui passe avant 0-self-signed.cert ne sera donc jamais utilise, et rien ne le signalera."',
    '    case "${KJEMO_CERT_RETENU}" in',
    '      0-self-signed.cert)',
    "        kjemo_resultat 'Certificat' 'Nature' 'ATTENTION' 'autosigne' \\",
    "          'Le certificat retenu est celui que Cockpit a genere lui-meme. Le navigateur AVERTIRA a chaque premiere visite, et cet avertissement est normal : il dit que l identite du serveur ne peut pas etre verifiee. La reponse n est jamais de desactiver la verification — ni -k, ni --insecure, ni une exception permanente — mais de deposer un certificat reconnu dans ce dossier, sous un nom qui passe APRES, ou de comparer l empreinte une fois hors du canal qu on securise.'",
    '        ;;',
    '      *)',
    "        kjemo_resultat 'Certificat' 'Nature' 'OK' 'fourni' \\",
    '          "Le certificat retenu (${KJEMO_CERT_RETENU}) n est pas l autosigne de Cockpit : un certificat a ete depose. La cle privee doit porter le MEME nom avec le suffixe .key, et ne pas etre chiffree — la documentation officielle l exige, et un certificat sans sa cle lisible fait echouer cockpit-ws au demarrage."',
    '        ;;',
    '    esac',
    '  fi',
    'fi',
    '',
  ];
}

/** Un nom d'hôte ou une adresse IPv4, tel qu'on le tape dans le navigateur. */
function validateAdresseOuNom(v, label = 'L’adresse') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 253) return { ok: false, value: s, error: `${label} dépasse 253 caractères.` };
  if (/^https?:\/\//i.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} ne doit PAS contenir « https:// » ni le port : écris seulement l’adresse ou le nom, par exemple 192.168.30.10. L’adresse complète est construite par l’assistant, avec le port du formulaire — et c’est voulu : une adresse recopiée depuis la barre du navigateur traîne souvent un chemin ou un port périmé.`,
    };
  }
  if (s.includes(':') || s.includes('/')) {
    return {
      ok: false,
      value: s,
      error: `${label} ne doit contenir ni « : » ni « / » : le port se saisit dans son propre champ, et aucun chemin n’est attendu. Valeur saisie : « ${s} ».`,
    };
  }
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} ne peut contenir que des lettres, des chiffres, « . » et « - ». Valeur saisie : « ${s} ».`,
    };
  }
  return { ok: true, value: s, error: null };
}

// ===========================================================================
// 1. cockpit-install-readiness
// ===========================================================================

const cockpitInstallReadiness = {
  id: 'cockpit-install-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'Cockpit',
  title: 'Vérifier qu’une machine est prête pour Cockpit',
  risk: 'diagnostic',
  summary: 'Lit ce qui décide qu’une console Cockpit sera joignable : les paquets réellement installés — un cockpit-ws sans cockpit-system donne une interface vide, ce qui ne ressemble pas à un problème de paquet —, l’état et le démarrage automatique de cockpit.socket, le port déclaré par l’unité comparé à ce qui écoute vraiment, le pare-feu, le certificat, et les adresses par lesquelles la machine peut être atteinte. N’installe rien, n’active rien, n’ouvre aucun port : la procédure est affichée, à taper.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'cockpit — le méta-paquet (apt install cockpit)',
    'systemd — systemctl (présent par défaut)',
    'iproute2 — ss, ip (présent par défaut)',
  ],
  privileges: 'aucun pour les paquets, le socket, le port et les adresses. root pour le dossier des certificats, qui n’est pas lisible autrement — et la section est annoncée IGNORE plutôt que passée sous silence',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'cockpit.socket',
  limites: [
    'N’INSTALLE RIEN. Ni « apt install », ni « systemctl enable », ni « ufw allow ». La procédure est affichée en entier, dans l’ordre, à taper soi-même : installer une console d’administration distante est une décision, pas un effet de bord d’un diagnostic.',
    'N’émet AUCUNE requête HTTPS, et « -k » comme « --insecure » n’apparaissent nulle part. Un outil qui apprendrait à contourner la vérification d’un certificat ferait plus de dégâts que la panne qu’il diagnostique.',
    'Ne génère et ne remplace aucun certificat. Le certificat autosigné est généré par Cockpit lui-même au premier démarrage, et déposer un certificat reconnu est une opération qui touche à une clé privée : elle reste manuelle.',
    'Ne modifie pas cockpit.conf, ni l’unité socket. Changer le port se fait dans l’unité — la documentation de cockpit-ws précise que l’option --port n’a aucun effet sous activation par socket — et c’est une modification que l’on fait en la lisant.',
    'Ne teste pas depuis l’extérieur : la machine peut être prête et rester injoignable à cause d’un équipement réseau entre les deux. L’assistant le dit, et ne le devine pas.',
  ],

  fields: [
    {
      id: 'port',
      label: 'Port attendu',
      type: 'text',
      default: '9090',
      placeholder: '9090',
      help: 'La documentation de Cockpit dit « usually on port 9090 ». Un autre port est possible, mais il se change dans la directive ListenStream de cockpit.socket, pas en passant une option à cockpit-ws.',
    },
    {
      id: 'verifierCertificat',
      label: 'Examiner le dossier des certificats',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Lit /etc/cockpit/ws-certs.d : quels certificats sont présents, et lequel Cockpit utilisera — le dernier par ordre alphabétique. Demande root.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const p = validatePortTcp(v.port, 'Le port attendu');
    if (!p.ok) errors.port = p.error;
    const c = validateChoix(v.verifierCertificat, ['Oui', 'Non'], 'L’examen des certificats');
    if (!c.ok) errors.verifierCertificat = c.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const port = String(v.port).trim();
    const cert = String(v.verifierCertificat) === 'Oui';

    return assemblerSh([
      ...enteteBash({
        titre: 'Verifier qu une machine est prete pour Cockpit',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'le dossier des certificats de Cockpit n est lisible qu avec root',
      }),
      ...blocVariablesBash([
        ['KJEMO_PORT', shQuote(port)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Port attendu' \"${KJEMO_PORT}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - rien installe, rien active, aucun port ouvert'",
      "  printf '%s\\t%s\\n' 'Requetes HTTPS' 'AUCUNE - et ni -k ni --insecure nulle part'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      ...blocCockpitBase(),
      ...blocCockpitFeu(),
      ...(cert ? blocCockpitCertificat() : [
        '# Certificats non demandes : la couche n est pas lue.',
        'KJEMO_CERT_OK=0',
        "kjemo_resultat 'Certificat' 'ws-certs.d' 'IGNORE' 'non demande' \\",
        "  'Le dossier des certificats n a pas ete lu, parce que le formulaire ne l a pas demande. Ce rapport ne dit donc RIEN sur le certificat que Cockpit presentera, ni sur l avertissement que le navigateur affichera.'",
        '',
      ]),
      '# ---------------------------------------------------------------------------',
      '# COUCHE 6 - PAR QUELLE ADRESSE ATTEINDRE CETTE MACHINE ?',
      '#',
      '# La question que personne ne pose, et qui fait taper la mauvaise adresse',
      '# pendant un quart d heure. Les adresses sont LUES, et non devinees.',
      '# ---------------------------------------------------------------------------',
      "KJEMO_ADRESSES=''",
      'if kjemo_dispo ip; then',
      '  KJEMO_ADRESSES="$(ip -brief address show scope global 2>/dev/null | head -10 || true)"',
      'fi',
      'if [ -n "${KJEMO_ADRESSES}" ]; then',
      "  kjemo_resultat 'Acces' 'Adresses de la machine' 'INFO' \"${KJEMO_ADRESSES}\" \\",
      '    "Adresses de portee globale : ${KJEMO_ADRESSES}. L une de celles-la, suivie de « :${KJEMO_PORT} », est l adresse a taper dans le navigateur. Le bouclage n y figure pas : il ne sert qu depuis la machine elle-meme."',
      'else',
      "  kjemo_resultat 'Acces' 'Adresses de la machine' 'PROBLEME' 'aucune adresse globale' \\",
      "    'Aucune adresse de portee globale : la machine n est joignable par aucune adresse routable, et aucun reglage de Cockpit n y changera rien. C est le reseau qu il faut regarder — l assistant linux-network-diagnostic suit les trois couches dans l ordre.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT : LA PREMIERE COUCHE MANQUANTE, ET ELLE SEULE',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_PAQUET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le paquet' \\",
      "    'Cockpit n est pas installe : la procedure affichee ci-dessous commence par cela. Les couches suivantes n ont pas de sens avant celle-la.'",
      'elif [ "${KJEMO_SOCKET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le socket' \\",
      "    'Les paquets sont la et cockpit.socket n est pas actif : rien n ecoute. Ce script ne le demarre pas — la commande est dans la procedure, et c est « cockpit.socket » qu on active, jamais « cockpit.service », qui demarre a la demande.'",
      'elif [ "${KJEMO_PORT_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le port' \\",
      '    "Le socket est actif et rien n ecoute sur le port ${KJEMO_PORT}. Compare avec le ListenStream declare : un port change dans l unite sans rechargement du socket donne exactement ce resultat."',
      'elif [ "${KJEMO_EXPOSE}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'l adresse d ecoute' \\",
      '    "Le port ${KJEMO_PORT} ecoute sur le bouclage seulement : Cockpit ne sera joignable que depuis cette machine. Ouvrir le pare-feu n y changera rien — c est l adresse d ecoute du socket qu il faut regarder."',
      'elif [ "${KJEMO_FEU_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le pare-feu' \\",
      '    "Tout repond sur la machine, et UFW est actif sans regle pour le port ${KJEMO_PORT}. Depuis un poste distant, le navigateur tournera jusqu au delai d attente sans message clair."',
      'else',
      "  kjemo_resultat 'Verdict' 'Machine prete' 'OK' 'les couches locales sont completes' \\",
      '    "Paquets presents, socket actif, port ${KJEMO_PORT} en ecoute sur une adresse joignable, pare-feu ouvert. Si le navigateur n obtient rien malgre tout, la cause est HORS de cette machine. A la premiere visite, un avertissement de certificat est attendu si le certificat est l autosigne de Cockpit : ce n est pas une panne."',
      'fi',
      '',
      '# La portee du rapport, quand la couche certificat n a pas ete lue : un',
      '# rapport qui se tait sur une couche doit le DIRE, sans quoi son silence',
      '# se lit comme un feu vert.',
      'if [ "${KJEMO_CERT_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Certificat' 'Portee du rapport' 'ATTENTION' 'non concluante' \\",
      "    'La couche certificat n a pas ete lue — non demandee, dossier absent, ou illisible sans root. Ce rapport ne dit donc rien sur le certificat que Cockpit presentera, ni sur l avertissement que le navigateur affichera a la premiere visite.'",
      'fi',
      '',
      "printf '\\n%s\\n' '=============================================================='",
      "printf '%s\\n' 'INSTALLER COCKPIT - PROCEDURE MANUELLE, DANS CET ORDRE'",
      "printf '%s\\n' '=============================================================='",
      "printf '%s\\n' ''",
      "printf '%s\\n' '1. Installe le meta-paquet. Il tire cockpit-ws, le serveur,'",
      "printf '%s\\n' '   cockpit-bridge et cockpit-system, sans lequel l interface'",
      "printf '%s\\n' '   s ouvre et reste presque vide :'",
      "printf '%s\\n' '     sudo apt install cockpit'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '2. AUTORISE le port AVANT d activer quoi que ce soit, et'",
      "printf '%s\\n' '   garde ta session SSH ouverte pendant toute l operation :'",
      'printf \'%s\\n\' "     sudo ufw allow ${KJEMO_PORT}/tcp"',
      "printf '%s\\n' ''",
      "printf '%s\\n' '3. Active le SOCKET, et non le service : la documentation'",
      "printf '%s\\n' '   officielle dit que le service demarre a la demande, quand'",
      "printf '%s\\n' '   un navigateur atteint le socket.'",
      "printf '%s\\n' '     sudo systemctl enable --now cockpit.socket'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '4. VERIFIE sur la machine, avant d ouvrir un navigateur :'",
      'printf \'%s\\n\' "     systemctl is-active cockpit.socket"',
      'printf \'%s\\n\' "     ss -lntp | grep ${KJEMO_PORT}"',
      "printf '%s\\n' '   L adresse d ecoute compte autant que le port : 0.0.0.0 est'",
      "printf '%s\\n' '   joignable, 127.0.0.1 ne l est que depuis la machine.'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '5. Ouvre la console depuis ton poste, avec une des adresses'",
      "printf '%s\\n' '   listees plus haut :'",
      'printf \'%s\\n\' "     https://<adresse-de-la-machine>:${KJEMO_PORT}"',
      "printf '%s\\n' '   Le navigateur AVERTIRA : le certificat est autosigne, et'",
      "printf '%s\\n' '   cet avertissement est normal. Ne desactive JAMAIS la'",
      "printf '%s\\n' '   verification pour le faire taire. Depose un certificat'",
      "printf '%s\\n' '   reconnu dans /etc/cockpit/ws-certs.d, sous un nom qui'",
      "printf '%s\\n' '   passe APRES 0-self-signed.cert par ordre alphabetique,'",
      "printf '%s\\n' '   avec sa cle privee au meme nom en .key et non chiffree.'",
      "printf '%s\\n' ''",
      "printf '%s\\n' 'POUR ANNULER :'",
      "printf '%s\\n' '     sudo systemctl disable --now cockpit.socket'",
      'printf \'%s\\n\' "     sudo ufw delete allow ${KJEMO_PORT}/tcp"',
      "printf '%s\\n' '     sudo apt remove cockpit'",
      "printf '%s\\n' ''",
      "printf '%s\\n' 'Ce que ce script n a PAS fait : il n a rien installe, rien'",
      "printf '%s\\n' 'active, aucun port ouvert, et il n a emis aucune requete.'",
      "printf '%s\\n' '=============================================================='",
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucun paquet installe, aucune unite activee, aucun port ouvert, aucun certificat genere, aucune requete HTTPS emise.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-cockpit-prerequis' }),
    ]);
  },

  gui: [
    'Installe le méta-paquet « cockpit », pas seulement cockpit-ws : sans cockpit-system, l’interface s’ouvre et reste presque vide.',
    'Active le SOCKET : « sudo systemctl enable --now cockpit.socket ». Le service démarre à la demande, quand un navigateur atteint le socket.',
    'N’en conclus rien de « systemctl is-active cockpit » : le service est inactif au repos sur une machine où Cockpit fonctionne.',
    'Autorise le port AVANT d’activer, et garde ta session SSH ouverte : « sudo ufw allow 9090/tcp ».',
    'Vérifie l’adresse d’écoute autant que le port : « ss -lntp | grep 9090 ». 127.0.0.1 n’est joignable que depuis la machine.',
    'Pour changer le port, modifie la directive ListenStream de cockpit.socket. L’option --port de cockpit-ws n’a aucun effet sous activation par socket.',
    'L’avertissement du navigateur est attendu : le certificat est autosigné. Cela ne se « répare » pas en désactivant la vérification.',
    'Pour un vrai certificat : dépose-le dans /etc/cockpit/ws-certs.d sous un nom qui passe APRÈS 0-self-signed.cert — c’est le dernier par ordre alphabétique qui est utilisé.',
    'La clé privée doit porter le même nom avec le suffixe .key, et ne pas être chiffrée : sinon cockpit-ws ne démarre pas.',
  ],

  keywords: ['cockpit', 'console web', 'administration', '9090', 'socket',
    'cockpit.socket', 'certificat', 'autosigne', 'ws-certs.d', 'ufw',
    'prerequis', 'installation', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour les paquets, le socket, le port et les adresses.',
    'sudo pour lire /etc/cockpit/ws-certs.d, qui n’est pas lisible autrement. Sans sudo, la section est annoncée IGNORE — pas OK.',
    'Le port, s’il n’est pas 9090.',
  ],

  commonErrors: [
    {
      message: 'systemctl is-active cockpit répond « inactive » et Cockpit fonctionne',
      code: 'KJEMO',
      cause: 'Cockpit est activé par socket : le service démarre à la demande, quand un navigateur atteint cockpit.socket.',
      fix: 'Interroger le socket.',
      command: 'systemctl is-active cockpit.socket',
    },
    {
      message: 'L’interface s’ouvre mais presque tous les menus manquent',
      code: 'KJEMO',
      cause: 'Installation partielle : cockpit-ws sans cockpit-system. Les pages viennent de paquets séparés.',
      fix: 'Installer le méta-paquet.',
      command: 'sudo apt install cockpit',
    },
    {
      message: 'Cockpit répond depuis la machine et pas depuis mon poste',
      code: 'KJEMO',
      cause: 'Le socket écoute sur 127.0.0.1, ou le pare-feu bloque. Les deux donnent des symptômes différents : refus immédiat contre délai d’attente.',
      fix: 'Lire l’adresse d’écoute, puis le pare-feu.',
      command: 'ss -lntp | grep 9090; sudo ufw status',
    },
    {
      message: 'Cockpit a cessé de répondre après un redémarrage',
      code: 'KJEMO',
      cause: 'Le socket avait été démarré à la main, sans « enable » : il ne revient pas au démarrage.',
      fix: 'Activer le démarrage automatique.',
      command: 'sudo systemctl enable cockpit.socket',
    },
    {
      message: 'J’ai déposé mon certificat et Cockpit utilise toujours l’autosigné',
      code: 'KJEMO',
      cause: 'Cockpit utilise le DERNIER fichier .cert ou .crt par ordre alphabétique : un nom qui passe avant 0-self-signed.cert n’est jamais retenu.',
      fix: 'Renommer le certificat pour qu’il passe après, et vérifier que la clé .key l’accompagne, non chiffrée.',
      command: 'ls -1 /etc/cockpit/ws-certs.d/',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport distingue cockpit.socket et cockpit.service, et dit que « inactive » pour le service est normal.',
    'Les paquets réellement installés sont listés, et l’absence de cockpit-system est reliée à une interface vide.',
    'Le démarrage automatique du socket est contrôlé séparément de son état courant.',
    'Le port est cherché dans ce qui écoute, et l’ADRESSE d’écoute est jugée à part : bouclage seulement est signalé PROBLEME.',
    'Le ListenStream déclaré par l’unité est lu et comparé.',
    'Le certificat retenu est celui que la règle officielle désigne — le dernier par ordre alphabétique — et sa nature est dite.',
    'Les adresses par lesquelles joindre la machine sont lues, pas devinées.',
    'Le verdict nomme la première couche manquante.',
    'Aucune écriture, aucune requête HTTPS, aucun « -k » ni « --insecure » nulle part.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. La procédure d’installation est affichée, et son annulation l’est aussi — désactiver le socket, retirer la règle de pare-feu, retirer le paquet.',
    diagnostic: `# Le socket, puis ce qui ecoute :
systemctl is-active cockpit.socket
systemctl show cockpit.socket -p Listen --value
ss -lntp | grep 9090
# Le certificat retenu : le DERNIER par ordre alphabetique.
sudo ls -1 /etc/cockpit/ws-certs.d/`,
    command: `# Aucune modification a annuler par ce script.
#
# Pour retirer une installation de Cockpit, dans cet ordre :
#   sudo systemctl disable --now cockpit.socket
#   sudo ufw delete allow 9090/tcp
#   sudo apt remove cockpit
#
# Ne desactive jamais la verification du certificat pour faire taire
# l avertissement du navigateur : depose un certificat reconnu dans
# /etc/cockpit/ws-certs.d, sous un nom qui passe APRES
# 0-self-signed.cert, avec sa cle privee au meme nom en .key et non
# chiffree.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Ouvre le port avant d’activer le socket, et garde ta session SSH ouverte : l’ordre inverse coupe l’accès si le pare-feu est strict.',
  },

  checks: [
    'Aucune écriture : aucun « apt install », aucun « systemctl enable », aucun « ufw allow », aucun certificat généré.',
    'Aucune requête HTTPS n’est émise, et « -k » comme « --insecure » n’apparaissent nulle part : ni dans le code, ni dans la procédure.',
    'Le socket et le service sont distingués, et l’activation par socket est traitée comme le cas NORMAL.',
    'Le démarrage automatique est contrôlé séparément : un socket actif sans « enabled » est la panne qui apparaît une semaine plus tard.',
    'L’adresse d’écoute est jugée à part du port : un service lié au bouclage ne devient pas joignable parce qu’on ouvre le pare-feu.',
    'Le ListenStream de l’unité est lu, et la règle officielle est rappelée : l’option --port de cockpit-ws n’a aucun effet sous activation par socket.',
    'La règle de sélection du certificat — le dernier fichier .cert ou .crt par ordre alphabétique — vient de la documentation officielle, et le rapport en tire la conséquence pratique.',
    'find remplace ls pour l’inventaire des certificats : un nom inattendu ne casse pas la lecture.',
    'Les sections réservées à root sont annoncées IGNORE quand root manque, jamais OK.',
    'La procédure manuelle ouvre le port AVANT d’activer le socket, et donne son annulation exacte.',
  ],

  source: `${DOC}/startup.html`,
  sources: [
    { label: 'Cockpit — Start up : activation par socket, port 9090', url: `${DOC}/startup.html` },
    { label: 'Cockpit — SSL/TLS Usage : ws-certs.d, 0-self-signed.cert, ordre alphabétique', url: `${DOC}/https.html` },
    { label: 'cockpit.conf(5)', url: 'https://manpages.ubuntu.com/manpages/noble/man5/cockpit.conf.5.html' },
    { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
    { label: 'ss(8)', url: `${M}/man8/ss.8.html` },
    { label: 'ufw(8)', url: `${M}/man8/ufw.8.html` },
  ],
};

// ===========================================================================
// 2. cockpit-connection-diagnostic
// ===========================================================================
//
// Le cas du cours, mot pour mot : « Cockpit est installé et
// https://IP:9090 ne répond pas. »
//
// Six couches peuvent en être la cause, et elles donnent trois symptômes
// différents dans le navigateur. La distinction vaut plus que la liste :
//
//   refus immédiat          la machine a répondu, et rien n'écoute sur ce port
//   page qui tourne         personne n'a répondu : un pare-feu sur le chemin
//   avertissement TLS       tout fonctionne, et le certificat est autosigné
//
// Le troisième n'est PAS une panne, et le traiter comme telle conduit à la
// seule erreur vraiment grave de ce sujet : désactiver la vérification.

const cockpitConnectionDiagnostic = {
  id: 'cockpit-connection-diagnostic',
  icon: '◇',
  category: CAT,
  subcategory: 'Cockpit',
  title: 'Diagnostiquer une console Cockpit qui ne répond pas',
  risk: 'diagnostic',
  summary: 'Le cas du cours : Cockpit est installé et https://IP:9090 ne répond pas. Six couches sont lues dans l’ordre où elles cassent — paquets, socket et non service, port et surtout ADRESSE d’écoute, pare-feu, certificat, puis le journal et les restrictions de connexion. Vérifie aussi que l’adresse tapée dans le navigateur est bien une adresse de cette machine. N’émet aucune requête, ne démarre rien, et n’apprend nulle part à contourner la vérification d’un certificat.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'cockpit — le méta-paquet (apt install cockpit)',
    'systemd — systemctl, journalctl (présents par défaut)',
    'iproute2 — ss, ip (présent par défaut)',
  ],
  privileges: 'aucun pour les paquets, le socket, le port, les adresses et le pare-feu. root pour le dossier des certificats et pour le journal des unités — les deux sections sont annoncées IGNORE quand root manque',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'cockpit.socket',
  limites: [
    'LIT seulement. Ne démarre pas cockpit.socket, ne l’active pas, n’ouvre aucun port, ne touche ni à cockpit.conf ni au certificat. Un diagnostic qui répare efface la panne avant qu’on l’ait comprise — et ici, la panne apprend à distinguer trois symptômes qui se ressemblent.',
    'N’émet AUCUNE requête HTTPS. « -k » et « --insecure » n’apparaissent nulle part : ni dans le code, ni dans une procédure, ni dans un message. Un diagnostic qui contourne la vérification d’un certificat enseigne précisément la mauvaise habitude.',
    'Ne teste pas depuis le poste client. Les couches locales peuvent toutes être bonnes et le navigateur ne rien obtenir à cause d’un équipement réseau entre les deux : l’assistant le dit, et ne le devine pas.',
    'Les restrictions de connexion sont RAPPORTÉES telles que les fichiers de cette machine les contiennent. La règle générale — quels comptes une distribution interdit par défaut — n’est pas affirmée : elle est marquée « À VALIDER », parce que la documentation officielle consultée ne la fixe pas.',
    'Ne lit aucun mot de passe et aucune clé : Cockpit s’authentifie avec les comptes du système, et ce script n’essaie aucune connexion.',
  ],

  fields: [
    {
      id: 'adresseNavigateur',
      label: 'Adresse tapée dans le navigateur (vide = non vérifiée)',
      type: 'text',
      default: '',
      placeholder: '192.168.30.10',
      optionnel: true,
      help: 'Seulement l’adresse ou le nom, sans « https:// » ni port. Si elle est renseignée, l’assistant vérifie qu’elle correspond bien à une adresse de CETTE machine — l’erreur la plus simple et la plus longue à trouver.',
    },
    {
      id: 'port',
      label: 'Port',
      type: 'text',
      default: '9090',
      placeholder: '9090',
      help: 'La documentation de Cockpit dit « usually on port 9090 ».',
    },
    {
      id: 'lireJournal',
      label: 'Lire le journal des unités',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Les trente dernières lignes de cockpit.socket et cockpit.service. C’est là qu’apparaît un échec de certificat ou un refus d’authentification, qui n’apparaissent nulle part ailleurs.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const a = String(v.adresseNavigateur ?? '').trim();
    if (a !== '') {
      const r = validateAdresseOuNom(a, 'L’adresse tapée dans le navigateur');
      if (!r.ok) errors.adresseNavigateur = r.error;
    }
    const p = validatePortTcp(v.port, 'Le port');
    if (!p.ok) errors.port = p.error;
    const j = validateChoix(v.lireJournal, ['Oui', 'Non'], 'La lecture du journal');
    if (!j.ok) errors.lireJournal = j.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const adresse = String(v.adresseNavigateur ?? '').trim();
    const port = String(v.port).trim();
    const journal = String(v.lireJournal) === 'Oui';

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer une console Cockpit qui ne repond pas',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'le dossier des certificats et le journal des unites demandent root',
      }),
      ...blocVariablesBash([
        ['KJEMO_ADRESSE', shQuote(adresse)],
        ['KJEMO_PORT', shQuote(port)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Adresse du navigateur' \"${KJEMO_ADRESSE:-non renseignee}\"",
      "  printf '%s\\t%s\\n' 'Port' \"${KJEMO_PORT}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - rien demarre, aucun port ouvert, aucun certificat touche'",
      "  printf '%s\\t%s\\n' 'Requetes HTTPS' 'AUCUNE - et ni -k ni --insecure nulle part'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      ...blocCockpitBase(),
      ...blocCockpitFeu(),
      ...blocCockpitCertificat(),
      '# ---------------------------------------------------------------------------',
      '# L ADRESSE TAPEE DANS LE NAVIGATEUR EST-ELLE CELLE DE CETTE MACHINE ?',
      '#',
      '# L erreur la plus simple, et la plus longue a trouver : on tape',
      '# l adresse d une autre machine du laboratoire, ou celle que la machine',
      '# avait avant que le bail DHCP change. Tout est alors correct ici, et',
      '# rien ne repond la-bas.',
      '# ---------------------------------------------------------------------------',
      "KJEMO_ADRESSES=''",
      'if kjemo_dispo ip; then',
      '  KJEMO_ADRESSES="$(ip -brief address show scope global 2>/dev/null | head -10 || true)"',
      'fi',
      "kjemo_resultat 'Acces' 'Adresses de la machine' 'INFO' \"${KJEMO_ADRESSES:-aucune}\" \\",
      '    "Adresses de portee globale de cette machine : ${KJEMO_ADRESSES:-aucune}. C est l une de celles-la, suivie de « :${KJEMO_PORT} », qu il faut taper."',
      'if [ -n "${KJEMO_ADRESSE}" ]; then',
      '  if printf \'%s\\n\' "${KJEMO_ADRESSES}" | grep -qF -- "${KJEMO_ADRESSE}"; then',
      "    kjemo_resultat 'Acces' 'Adresse du navigateur' 'OK' \"${KJEMO_ADRESSE}\" \\",
      '      "L adresse ${KJEMO_ADRESSE} figure bien parmi celles de cette machine : ce n est donc pas une erreur de destination."',
      '  else',
      "    kjemo_resultat 'Acces' 'Adresse du navigateur' 'PROBLEME' \"${KJEMO_ADRESSE}\" \\",
      '      "L adresse ${KJEMO_ADRESSE} ne figure PAS parmi les adresses de cette machine (${KJEMO_ADRESSES:-aucune}). Ou bien c est un nom que le DNS resout vers elle — ce que ce controle ne voit pas —, ou bien le navigateur parle a une autre machine. Dans ce second cas, tout le reste de ce rapport est exact et sans objet."',
      '  fi',
      'else',
      "  kjemo_resultat 'Acces' 'Adresse du navigateur' 'IGNORE' 'non renseignee' \\",
      "    'L adresse tapee dans le navigateur n a pas ete donnee : ce rapport ne verifie donc PAS qu elle correspond a cette machine. C est pourtant l erreur la plus simple — et celle qui coute le plus de temps, parce que tout le reste est correct.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LES RESTRICTIONS DE CONNEXION : CE QUE LES FICHIERS DISENT, ET RIEN DE PLUS',
      '#',
      '# Le symptome ici n est pas « ne repond pas » mais « la page s affiche et',
      '# refuse mon mot de passe ». C est une autre panne, et la confondre avec',
      '# la premiere fait chercher du cote du reseau pendant une heure.',
      '#',
      '# Les fichiers sont LUS et rapportes tels quels. La regle generale — quels',
      '# comptes une distribution interdit par defaut — n est PAS affirmee ici :',
      '# la documentation officielle consultee ne la fixe pas, et une regle',
      '# inventee dans un rapport se propage ensuite comme un fait.',
      '# ---------------------------------------------------------------------------',
      'if [ -r /etc/cockpit/disallowed-users ]; then',
      '  KJEMO_INTERDITS="$(grep -vE \'^[[:space:]]*($|#)\' /etc/cockpit/disallowed-users 2>/dev/null | paste -sd, - || true)"',
      "  kjemo_resultat 'Connexion' 'Comptes interdits' 'ATTENTION' \"${KJEMO_INTERDITS:-aucun}\" \\",
      '    "Le fichier /etc/cockpit/disallowed-users de CETTE machine interdit la connexion a : ${KJEMO_INTERDITS:-aucun}. Un compte de cette liste obtient la page d accueil puis un refus, avec le bon mot de passe — ce qui ressemble a un mot de passe faux. A VALIDER sur ta distribution : ce que le paquet y met par defaut n est pas fixe par la documentation officielle consultee, et c est donc le CONTENU lu ici qui fait foi, pas une regle generale."',
      'else',
      "  kjemo_resultat 'Connexion' 'Comptes interdits' 'INFO' 'fichier absent ou illisible' \\",
      "    'Le fichier /etc/cockpit/disallowed-users est absent ou illisible depuis cette session. Son absence ne prouve pas qu aucun compte n est restreint : cockpit.conf peut aussi porter des reglages d authentification.'",
      'fi',
      'if [ -r /etc/cockpit/cockpit.conf ]; then',
      '  KJEMO_CONF="$(grep -vE \'^[[:space:]]*($|#)\' /etc/cockpit/cockpit.conf 2>/dev/null | head -20 || true)"',
      "  kjemo_resultat 'Connexion' 'cockpit.conf' 'INFO' \"${KJEMO_CONF:-vide}\" \\",
      '    "Le fichier de configuration existe, et son contenu utile est : ${KJEMO_CONF:-vide}. Il peut imposer une origine autorisee, un mode d authentification ou une banniere — autant de reglages qui donnent « ca ne repond pas » alors que tout ecoute."',
      'else',
      "  kjemo_resultat 'Connexion' 'cockpit.conf' 'INFO' 'absent' \\",
      "    'Aucun /etc/cockpit/cockpit.conf : Cockpit fonctionne avec ses valeurs par defaut, ce qui est le cas le plus courant et le plus simple a diagnostiquer.'",
      'fi',
      '',
      ...(journal ? [
        '# -----------------------------------------------------------------------',
        '# LE JOURNAL DES DEUX UNITES',
        '#',
        '# cockpit.socket et cockpit.service, ensemble : le socket accepte la',
        '# connexion et le service la traite, donc une panne peut etre dans l un',
        '# ou dans l autre, et les lire separement fait manquer la jointure.',
        '# -----------------------------------------------------------------------',
        'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo journalctl; then',
        '  KJEMO_JOURNAL="$(journalctl -u cockpit.socket -u cockpit.service -n 30 --no-pager 2>/dev/null || true)"',
        "  kjemo_resultat 'Journal' 'cockpit (30 dernieres lignes)' 'INFO' \"${KJEMO_JOURNAL:-vide}\" \\",
        "    'Le journal des deux unites. --no-pager est indispensable dans un script : sans lui, journalctl attend une touche et le script semble bloque.'",
        '  if printf \'%s\\n\' "${KJEMO_JOURNAL}" | grep -qiE \'certificate|ssl|tls\'; then',
        "    kjemo_resultat 'Journal' 'Certificat' 'PROBLEME' 'erreur TLS journalisee' \\",
        "      'Le journal mentionne un probleme de certificat ou de TLS. Cause la plus frequente : un certificat depose sans sa cle privee au MEME nom en .key, ou une cle chiffree — la documentation officielle exige les deux. Dans cet etat, cockpit-ws ne sert rien, et le navigateur n obtient pas de page du tout.'",
        '  fi',
        '  if printf \'%s\\n\' "${KJEMO_JOURNAL}" | grep -qiE \'permission denied|authentication failed|not permitted\'; then',
        "    kjemo_resultat 'Journal' 'Authentification' 'ATTENTION' 'refus journalise' \\",
        "      'Le journal contient un refus d authentification. Ce n est PAS la meme panne que « ne repond pas » : la page a ete servie. Regarde les comptes interdits plus haut, et le mot de passe du compte SYSTEME — Cockpit n a pas de compte a lui.'",
        '  fi',
        'else',
        "  kjemo_resultat 'Journal' 'cockpit' 'IGNORE' 'non lu' \\",
        "    'Le journal des unites n a PAS ete lu : journalctl -u demande root. C est pourtant le seul endroit ou apparaissent un echec de certificat et un refus d authentification. Relance avec sudo pour cette section.'",
        'fi',
        '',
      ] : [
        '# Journal non demande : il n est pas lu, et le rapport le dit plutot que',
        '# de laisser croire qu il couvre cette couche.',
        "kjemo_resultat 'Journal' 'cockpit' 'IGNORE' 'non demande' \\",
        "  'Le journal n a pas ete lu, parce que le formulaire ne l a pas demande. C est pourtant la que se voient un echec de certificat et un refus d authentification.'",
        '',
      ]),
      '# La portee du rapport, quand la couche certificat n a pas pu etre lue :',
      '# un rapport qui se tait sur une couche doit le DIRE, sans quoi son',
      '# silence se lit comme un feu vert.',
      'if [ "${KJEMO_CERT_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Certificat' 'Portee du rapport' 'ATTENTION' 'non concluante' \\",
      "    'La couche certificat n a pas pu etre lue — dossier absent, ou illisible sans root. Ce rapport ne dit donc rien sur le certificat que Cockpit presentera, ni sur l avertissement que le navigateur affichera a la premiere visite.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT, ET LES TROIS SYMPTOMES A NE PAS CONFONDRE',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_PAQUET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le paquet' \\",
      "    'cockpit-ws n est pas installe : rien ne peut repondre. L assistant cockpit-install-readiness affiche la procedure complete.'",
      'elif [ "${KJEMO_SOCKET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le socket' \\",
      '    "cockpit.socket n est pas actif : rien n ecoute, et le navigateur recevra un REFUS immediat — pas un delai d attente. Ce script ne le demarre pas : « sudo systemctl enable --now cockpit.socket » est a taper, et c est le SOCKET, jamais le service."',
      'elif [ "${KJEMO_PORT_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le port' \\",
      '    "Le socket est actif et rien n ecoute sur le port ${KJEMO_PORT} : compare avec le ListenStream declare par l unite, plus haut. Symptome : refus immediat."',
      'elif [ "${KJEMO_EXPOSE}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'l adresse d ecoute' \\",
      '    "Le port ${KJEMO_PORT} ecoute sur le bouclage SEULEMENT : depuis la machine, https://127.0.0.1:${KJEMO_PORT} repondra ; depuis ton poste, jamais. C est la cause qui resiste a toutes les regles de pare-feu, parce que le pare-feu n y est pour rien."',
      'elif [ "${KJEMO_FEU_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le pare-feu' \\",
      '    "Tout ecoute correctement, et UFW est actif sans regle pour le port ${KJEMO_PORT}. Symptome attendu : une page qui TOURNE jusqu au delai d attente — et non un refus immediat. C est cette difference qui dit, sans rien d autre, de quel cote chercher."',
      'else',
      "  kjemo_resultat 'Verdict' 'Couches locales' 'OK' 'completes' \\",
      '    "Paquets, socket, port ${KJEMO_PORT} expose, pare-feu : tout est en place sur cette machine. Si le navigateur n obtient rien, la cause est HORS de cette machine, ou l adresse tapee n est pas la sienne. Et si le navigateur AVERTIT au sujet du certificat, ce n est pas une panne : c est un certificat autosigne qui fait son travail."',
      'fi',
      "kjemo_resultat 'Verdict' 'Les trois symptomes' 'ATTENTION' 'a ne pas confondre' \\",
      '  "Refus immediat : la machine a repondu, et rien n ecoute sur le port. Page qui tourne jusqu au delai d attente : personne n a repondu, donc un pare-feu sur le chemin. Avertissement de certificat : tout fonctionne, et le certificat est autosigne — la reponse n est JAMAIS de desactiver la verification, mais de deposer un certificat reconnu dans /etc/cockpit/ws-certs.d sous un nom qui passe apres 0-self-signed.cert. L adresse a ouvrir est https://<une-des-adresses-ci-dessus>:${KJEMO_PORT}."',
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucune unite demarree ou activee, aucun port ouvert, aucun certificat genere ni remplace, aucun fichier de /etc/cockpit touche, aucune requete HTTPS emise.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-cockpit-connexion' }),
    ]);
  },

  gui: [
    'Distingue les trois symptômes : refus immédiat (rien n’écoute), page qui tourne (un pare-feu sur le chemin), avertissement TLS (tout marche, certificat autosigné).',
    'Interroge le SOCKET : « systemctl is-active cockpit.socket ». Le service est inactif au repos, et c’est normal.',
    'Regarde l’ADRESSE d’écoute autant que le port : « ss -lntp | grep 9090 ». 127.0.0.1 ne sera jamais joignable depuis un autre poste.',
    'Vérifie que l’adresse tapée est bien celle de la machine : « ip -brief address show scope global ». Un bail DHCP change, et l’ancienne adresse reste dans l’historique du navigateur.',
    'Si la page s’affiche et refuse le mot de passe, ce n’est plus un problème de réseau : regarde /etc/cockpit/disallowed-users et le compte SYSTÈME.',
    'Le journal dit ce que le navigateur ne dit pas : « sudo journalctl -u cockpit.socket -u cockpit.service -n 30 --no-pager ».',
    'Un certificat déposé sans sa clé .key au même nom, ou avec une clé chiffrée, empêche cockpit-ws de servir quoi que ce soit.',
    'Cockpit utilise le DERNIER fichier .cert ou .crt par ordre alphabétique : un nom qui passe avant 0-self-signed.cert ne sert à rien.',
    'Ne désactive jamais la vérification du certificat — ni dans le navigateur « pour cette fois », ni avec -k dans une commande. C’est la seule erreur vraiment grave de ce sujet.',
  ],

  keywords: ['cockpit', '9090', 'ne repond pas', 'socket', 'certificat',
    'autosigne', 'tls', 'ws-certs.d', 'disallowed-users', 'cockpit.conf',
    'bouclage', 'pare-feu', 'journal', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour les paquets, le socket, le port, les adresses et UFW.',
    'sudo pour deux sections : le dossier des certificats et le journal des unités. Sans sudo, elles sont annoncées IGNORE — pas OK.',
    'L’adresse exacte tapée dans le navigateur, si l’on veut qu’elle soit vérifiée.',
  ],

  commonErrors: [
    {
      message: 'La page tourne puis « délai d’attente dépassé »',
      code: 'KJEMO',
      cause: 'Personne n’a répondu : un pare-feu quelque part jette les paquets sans rien dire. Ce n’est pas un refus, et la différence suffit à savoir de quel côté chercher.',
      fix: 'Vérifier UFW sur la machine, puis le chemin réseau.',
      command: 'sudo ufw status',
    },
    {
      message: 'Connexion refusée immédiatement',
      code: 'ECONNREFUSED',
      cause: 'La machine a répondu, et rien n’écoute sur ce port : socket arrêté, ou port différent de celui qu’on croit.',
      fix: 'Vérifier le socket puis ce qui écoute.',
      command: 'systemctl is-active cockpit.socket; ss -lntp | grep 9090',
    },
    {
      message: 'Ça marche en local et pas depuis mon poste',
      code: 'KJEMO',
      cause: 'Le socket écoute sur 127.0.0.1 seulement. Aucune règle de pare-feu ne corrige cela.',
      fix: 'Lire l’adresse d’écoute, puis la directive ListenStream de l’unité.',
      command: 'ss -lntp | grep 9090; systemctl show cockpit.socket -p Listen --value',
    },
    {
      message: 'La page s’affiche et refuse mon mot de passe, qui est pourtant le bon',
      code: 'KJEMO',
      cause: 'Le compte figure dans /etc/cockpit/disallowed-users, ou cockpit.conf restreint l’authentification. La page a été servie : ce n’est plus une panne réseau.',
      fix: 'Lire la liste des comptes interdits sur CETTE machine, puis essayer avec un compte de sudo.',
      command: 'sudo cat /etc/cockpit/disallowed-users',
    },
    {
      message: 'Le navigateur avertit que la connexion n’est pas privée',
      code: 'KJEMO',
      cause: 'Le certificat est celui que Cockpit a généré lui-même : il ne peut pas être vérifié. C’est le comportement attendu, pas une panne.',
      fix: 'Déposer un certificat reconnu dans /etc/cockpit/ws-certs.d, sous un nom qui passe après 0-self-signed.cert, avec sa clé .key non chiffrée. Ne jamais désactiver la vérification.',
      command: 'sudo ls -1 /etc/cockpit/ws-certs.d/',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport interroge cockpit.socket et dit qu’un cockpit.service inactif est normal.',
    'L’adresse d’écoute est jugée séparément du port, et le bouclage seul est signalé PROBLEME.',
    'Le ListenStream déclaré par l’unité est lu et comparé à ce qui écoute.',
    'Le certificat retenu est celui que la règle officielle désigne, et sa nature est dite ; l’avertissement du navigateur est présenté comme attendu.',
    'L’adresse tapée dans le navigateur est comparée aux adresses réelles de la machine, quand elle est renseignée.',
    'Les restrictions de connexion sont rapportées depuis les fichiers de cette machine, et la règle générale est marquée « À VALIDER ».',
    'Les trois symptômes — refus, délai, avertissement TLS — sont distingués dans le verdict.',
    'Aucune écriture, aucune requête HTTPS, aucun « -k » ni « --insecure ».',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne démarre pas le socket, et c’est volontaire — un socket arrêté est la preuve, et le démarrer l’effacerait.',
    diagnostic: `# Le socket, puis ce qui ecoute et SUR QUELLE adresse :
systemctl is-active cockpit.socket
ss -lntp | grep 9090
# Les adresses par lesquelles joindre la machine :
ip -brief address show scope global
# Ce que les unites ont journalise :
sudo journalctl -u cockpit.socket -u cockpit.service -n 30 --no-pager`,
    command: `# Aucune modification a annuler.
#
# Pour demarrer la console SOI-MEME, apres avoir constate pourquoi elle
# etait arretee — et c est le SOCKET, jamais le service :
#   sudo systemctl enable --now cockpit.socket
#
# Si le pare-feu bloque, l ORDRE compte : autoriser d abord.
#   sudo ufw allow 9090/tcp
#
# Si le port doit changer, cela se fait dans la directive ListenStream
# de cockpit.socket : l option --port de cockpit-ws n a aucun effet sous
# activation par socket.
#
# Ne desactive JAMAIS la verification du certificat pour faire taire
# l avertissement du navigateur.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Un avertissement de certificat n’est pas une panne : le « réparer » en désactivant la vérification est la seule erreur vraiment grave de ce sujet.',
  },

  checks: [
    'Aucune écriture : aucune unité démarrée ou activée, aucun port ouvert, aucun fichier de /etc/cockpit touché.',
    'Aucune requête HTTPS n’est émise, et « -k » comme « --insecure » n’apparaissent nulle part.',
    'Le socket et le service sont distingués : « inactive » pour le service est le cas normal.',
    'L’adresse d’écoute est jugée à part : le bouclage seul est la cause qui résiste à toutes les règles de pare-feu.',
    'L’adresse tapée dans le navigateur est comparée aux adresses réelles, et la comparaison est faite avec grep -F : une adresse n’est pas une expression régulière.',
    'Le formulaire refuse une adresse contenant « https:// », « : » ou « / » : le port a son propre champ, et une adresse recopiée depuis la barre du navigateur traîne souvent un port périmé.',
    'La règle de sélection du certificat vient de la documentation officielle, et l’avertissement du navigateur est présenté comme attendu plutôt que comme une panne.',
    'Les restrictions de connexion sont lues dans les fichiers de la machine, et la règle générale est explicitement marquée « À VALIDER » : la documentation officielle consultée ne la fixe pas.',
    'Les trois symptômes sont nommés séparément, avec ce que chacun exclut.',
    '« journalctl --no-pager » partout : sans lui, le script paraît bloqué.',
  ],

  source: `${DOC}/startup.html`,
  sources: [
    { label: 'Cockpit — Start up : activation par socket, port 9090', url: `${DOC}/startup.html` },
    { label: 'Cockpit — SSL/TLS Usage : ws-certs.d, ordre alphabétique, clé .key non chiffrée', url: `${DOC}/https.html` },
    { label: 'cockpit.conf(5)', url: 'https://manpages.ubuntu.com/manpages/noble/man5/cockpit.conf.5.html' },
    { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
    { label: 'ss(8)', url: `${M}/man8/ss.8.html` },
    { label: 'ip(8)', url: `${M}/man8/ip.8.html` },
  ],
};

export const toolsLinuxK = [
  cockpitInstallReadiness,
  cockpitConnectionDiagnostic,
];
