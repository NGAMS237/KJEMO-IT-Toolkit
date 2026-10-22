/**
 * outils-linux-j.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * SSH — quatre assistants, dont AUCUN ne touche à /etc/ssh.
 *
 *   ssh-server-readiness   LIT les cinq couches qui font qu'un serveur SSH
 *                          répond ou ne répond pas, dans l'ordre où elles
 *                          cassent. Ne démarre rien, n'active rien.
 *   ssh-client-diagnostic  LIT ce que le client va réellement faire — `ssh -G`
 *                          dit la configuration effective — et demande au
 *                          serveur quelles authentifications il propose.
 *   ssh-key-readiness      VÉRIFIE que l'authentification par clé PEUT
 *                          fonctionner, sans jamais lire une clé privée.
 *   ssh-hardening-audit    AUDITE la configuration effective contre les
 *                          valeurs par défaut officielles, puis PRÉPARE un
 *                          fichier additionnel — dans le dossier personnel,
 *                          validé par `sshd -t`, jamais installé.
 *
 * ---------------------------------------------------------------------------
 * LES TROIS RÈGLES ABSOLUES DE CE MODULE
 * ---------------------------------------------------------------------------
 * 1. AUCUNE CLÉ PRIVÉE N'EST LUE, AFFICHÉE NI COPIÉE. Jamais, par aucun des
 *    quatre assistants, sous aucune condition. Les empreintes se calculent sur
 *    le fichier `.pub`, qui est public par définition, et une fonction du
 *    script REFUSE tout chemin qui ne finit pas par « .pub » avant d'appeler
 *    ssh-keygen. Un assistant qui « vérifierait » une clé privée en la lisant
 *    serait un assistant qui exfiltre une clé privée dans son rapport.
 *
 * 2. /etc/ssh/sshd_config N'EST JAMAIS REMPLACÉ, NI MODIFIÉ. Le durcissement
 *    passe par un fichier additionnel dans /etc/ssh/sshd_config.d/, et ce
 *    choix n'est pas une préférence : la page de manuel sshd_config(5) dit
 *    « For each keyword, the first obtained value will be used », et le
 *    fichier d'Ubuntu commence par « Include /etc/ssh/sshd_config.d/*.conf ».
 *    Un fichier additionnel inclus EN PREMIER gagne donc sur tout ce qui suit,
 *    sans qu'une seule ligne du fichier principal ait été touchée — et le
 *    retour en arrière consiste à supprimer un fichier qu'on a ajouté, non à
 *    restaurer un fichier qu'on a réécrit.
 *
 *    L'assistant VÉRIFIE que la ligne Include est bien présente. Si elle
 *    manque, un fichier additionnel serait purement et simplement ignoré : le
 *    dire est la différence entre un durcissement et l'illusion d'un
 *    durcissement.
 *
 * 3. RIEN N'EST APPLIQUÉ SANS QU'UN SECOND ACCÈS ADMINISTRATEUR SOIT PROUVÉ.
 *    Couper l'authentification par mot de passe ou l'accès root depuis une
 *    session SSH, sans avoir prouvé qu'un autre compte entre par clé, c'est
 *    s'enfermer dehors — et la seule issue est alors la console physique ou la
 *    console du superviseur de machines virtuelles. L'assistant de
 *    durcissement exige donc le nom d'un compte, et VÉRIFIE lui-même : le
 *    compte existe, il est dans un groupe d'administration, son
 *    authorized_keys contient au moins une clé, et les permissions
 *    qu'exige StrictModes sont correctes. Si la session courante est une
 *    session SSH et que cette preuve échoue, rien n'est préparé du tout.
 *
 * ---------------------------------------------------------------------------
 * CE QUE L'ACTIVATION PAR SOCKET CHANGE, ET QUI TROMPE TOUT LE MONDE
 * ---------------------------------------------------------------------------
 * Depuis Ubuntu 22.10, openssh-server est activé par socket : c'est
 * `ssh.socket` qui écoute, et `ssh.service` ne démarre qu'à la première
 * connexion. Conséquence directe : `systemctl is-active ssh` répond
 * « inactive » sur un serveur SSH parfaitement fonctionnel. C'est la fausse
 * alarme la plus fréquente du sujet, et l'assistant la nomme explicitement
 * plutôt que de la signaler comme une panne.
 *
 * Le port, lui, est un cas que ce projet NE TRANCHE PAS. Sous activation par
 * socket, le port écouté peut venir du fichier sshd_config ou de l'unité
 * socket, et le comportement a changé entre les versions — Canonical a
 * d'ailleurs ouvert un rapport d'anomalie à ce sujet. L'assistant MESURE donc
 * les deux — ce que dit la configuration, ce qui écoute réellement — et
 * signale un écart en le marquant « À VALIDER ». Il n'automatise rien sur ce
 * point : une hypothèse que la documentation officielle ne confirme pas n'a
 * pas sa place dans un script qui agit.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import { blocConfirmation, blocPorteFinale } from './gardes-bash.mjs';
import {
  validateChoix, validateNomFichier, validateNomUtilisateur, validatePortTcp,
} from './validateurs-linux.mjs';
import { assertValid } from './noyau.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';

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
 * Un nom d'hôte ou une adresse IPv4, pour le client.
 *
 * Volontairement strict : ce nom part dans une ligne de commande `ssh`, et
 * c'est shQuote qui le protège — mais une valeur qui ressemble à une option
 * (« -oProxyCommand=... ») serait interprétée par ssh comme une option même
 * correctement citée, parce que le danger n'est pas l'interpolation du shell
 * mais l'analyse des arguments par ssh lui-même. Un nom ne commence donc
 * jamais par un tiret.
 */
function validateHoteSsh(v, label = 'L’hôte') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 253) return { ok: false, value: s, error: `${label} dépasse 253 caractères.` };
  if (s.startsWith('-')) {
    return {
      ok: false,
      value: s,
      error: `${label} ne peut pas commencer par « - » : ssh analyserait la valeur comme une option, même correctement citée pour le shell. C’est un piège d’analyse d’arguments, et non d’interpolation.`,
    };
  }
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} ne peut contenir que des lettres, des chiffres, « . » et « - », et ne peut ni commencer ni finir par « - » ou « . ». Valeur saisie : « ${s} ».`,
    };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Le bloc qui REFUSE de lire une clé privée.
 *
 * Il n'est pas décoratif. Les quatre assistants calculent des empreintes, et
 * ssh-keygen -lf accepte aussi bien un fichier public qu'un fichier privé :
 * c'est le script, et lui seul, qui décide de ne jamais lui donner le second.
 * Le refus est écrit une fois, ici, et chaque appel passe par lui.
 */
function fonctionEmpreinteBash() {
  return [
    '# ---------------------------------------------------------------------------',
    '# L EMPREINTE, ET LE REFUS DE LIRE UNE CLE PRIVEE',
    '#',
    '# ssh-keygen -lf accepte un fichier public comme un fichier prive. La',
    '# distinction n est donc PAS faite par ssh-keygen : elle est faite ici.',
    '# Tout chemin qui ne finit pas par « .pub » et qui n est pas un',
    '# authorized_keys ou un known_hosts est refuse, et le refus est consigne',
    '# dans le rapport — un refus silencieux ressemblerait a un fichier absent.',
    '#',
    '# Une empreinte de cle publique n est pas un secret : c est precisement ce',
    '# qu on compare pour reconnaitre un serveur. Une cle privee, elle, n a',
    '# aucune raison d entrer dans un rapport, et un rapport se copie dans un',
    '# courriel.',
    '# ---------------------------------------------------------------------------',
    'kjemo_empreinte() {',
    '  local chemin="${1:-}"',
    '  case "${chemin}" in',
    '    *.pub|*/authorized_keys|*/known_hosts) : ;;',
    '    *)',
    "      kjemo_resultat 'Cles' 'Lecture refusee' 'PROBLEME' 'chemin non public' \\",
    '        "Ce script refuse de lire ${chemin} : seuls les fichiers .pub, authorized_keys et known_hosts sont publics. Une cle privee n entre jamais dans un rapport, et ce refus est deliberement bruyant."',
    '      return 1',
    '      ;;',
    '  esac',
    '  if [ ! -r "${chemin}" ]; then return 1; fi',
    '  ssh-keygen -lf "${chemin}" 2>/dev/null || return 1',
    '}',
    '',
  ];
}

// ===========================================================================
// 1. ssh-server-readiness
// ===========================================================================
//
// Le cas du cours : « SSH ne répond pas. » Cinq couches peuvent en être la
// cause, et elles ne se corrigent pas de la même façon. L'assistant les lit
// dans l'ordre où elles cassent, et nomme la première qui manque — plutôt que
// de rendre un rapport où tout est vrai et où rien ne conclut.

const sshServerReadiness = {
  id: 'ssh-server-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'SSH et accès distant',
  title: 'Diagnostiquer un serveur SSH qui ne répond pas',
  risk: 'diagnostic',
  summary: 'Lit les cinq couches qui font qu’un serveur SSH répond : le paquet, l’unité — et l’activation par socket, qui fait répondre « inactive » à un serveur parfaitement fonctionnel depuis Ubuntu 22.10 —, le port réellement en écoute, la configuration effective lue par sshd lui-même, les clés d’hôte, puis le pare-feu. Ne démarre rien, n’active rien, n’ouvre aucun port.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'openssh-server — sshd (apt install openssh-server)',
    'systemd — systemctl, journalctl (présents par défaut)',
    'iproute2 — ss (présent par défaut)',
  ],
  privileges: 'root pour deux sections seulement : la configuration effective — « sshd -T » lit les clés d’hôte, qui sont en mode 600 — et le journal de l’unité. Tout le reste se lit sans privilège, et ce qui manque est annoncé IGNORE plutôt que passé sous silence',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'ssh.service et ssh.socket',
  limites: [
    'LIT seulement. Ne démarre ni ssh.service ni ssh.socket, n’active rien au démarrage, n’ouvre aucun port dans le pare-feu, ne touche à aucun fichier de /etc/ssh. Un diagnostic qui répare efface la panne avant qu’on l’ait comprise.',
    'Ne tranche pas la question du port sous activation par socket. Il MESURE ce que dit la configuration et ce qui écoute réellement, et signale un écart en le marquant « À VALIDER » : le comportement a changé entre les versions d’Ubuntu, et la documentation officielle ne le fixe pas.',
    'Ne lit aucune clé privée. Les empreintes des clés d’hôte sont calculées sur les fichiers .pub, et une fonction du script refuse tout autre chemin.',
    'Ne teste pas depuis l’extérieur. Un serveur peut être parfait et rester injoignable à cause d’un équipement réseau entre les deux : l’assistant le dit, et ne le devine pas.',
  ],

  fields: [
    {
      id: 'port',
      label: 'Port attendu',
      type: 'text',
      default: '22',
      placeholder: '22',
      help: 'Le port sur lequel le serveur est censé écouter. 22 par défaut, et sshd_config(5) le confirme : « The default is 22 ». Un port différent est un choix légitime — mais il doit être le même dans la configuration, dans ce qui écoute, et dans le pare-feu.',
    },
    {
      id: 'lireJournal',
      label: 'Lire le journal de l’unité',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Les vingt dernières lignes du journal de ssh. C’est là qu’apparaît « Authentication refused: bad ownership or modes », le message que personne ne va chercher.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const p = validatePortTcp(v.port, 'Le port attendu');
    if (!p.ok) errors.port = p.error;
    const j = validateChoix(v.lireJournal, ['Oui', 'Non'], 'La lecture du journal');
    if (!j.ok) errors.lireJournal = j.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const port = String(v.port).trim();
    const journal = String(v.lireJournal) === 'Oui';

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer un serveur SSH qui ne repond pas',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'la configuration effective et le journal de l unite se lisent avec root',
      }),
      ...fonctionEmpreinteBash(),
      ...blocVariablesBash([
        ['KJEMO_PORT', shQuote(port)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Port attendu' \"${KJEMO_PORT}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - aucun service demarre, aucun port ouvert, /etc/ssh intact'",
      "  printf '%s\\t%s\\n' 'Cles privees' 'JAMAIS LUES - empreintes calculees sur les fichiers .pub'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# COUCHE 1 - LE PAQUET EST-IL LA ?',
      '#',
      '# openssh-CLIENT est installe partout. openssh-SERVER ne l est pas',
      '# toujours : une installation de bureau, ou une installation minimale ou',
      '# la case n a pas ete cochee. « ssh ne repond pas » est alors exact, et',
      '# aucun reglage ne le corrigera.',
      '# ---------------------------------------------------------------------------',
      '# sshd n est PAS dans le PATH d un utilisateur standard : il vit dans',
      '# /usr/sbin. Son absence du PATH ne prouve donc rien, et c est le paquet',
      '# qu il faut interroger — pas le chemin, qu on serait tente de coder en',
      '# dur et qui contournerait toute observation.',
      'KJEMO_PAQUET_OK=0',
      "KJEMO_ETAT_PAQUET=''",
      'if kjemo_dispo dpkg-query; then',
      "  KJEMO_ETAT_PAQUET=\"$(dpkg-query -W -f='${Status}' openssh-server 2>/dev/null || true)\"",
      'fi',
      'if kjemo_dispo sshd; then',
      '  KJEMO_PAQUET_OK=1',
      "  kjemo_resultat 'Paquet' 'sshd' 'OK' 'present dans le PATH' \\",
      "    'Le demon est installe et joignable depuis cette session. C est la premiere couche, et la seule qu aucun reglage ne remplace.'",
      'elif [ "${KJEMO_ETAT_PAQUET#*ok installed}" != "${KJEMO_ETAT_PAQUET}" ]; then',
      '  KJEMO_PAQUET_OK=1',
      "  kjemo_resultat 'Paquet' 'sshd' 'OK' 'paquet installe' \\",
      '    "Le paquet openssh-server est installe (${KJEMO_ETAT_PAQUET}). Que sshd soit absent du PATH est normal pour un utilisateur standard : il vit dans /usr/sbin, qui n y figure pas."',
      'else',
      "  kjemo_resultat 'Paquet' 'sshd' 'PROBLEME' 'absent' \\",
      "    'Le demon sshd n est pas installe sur cette machine : « sudo apt install openssh-server ». Le paquet openssh-client, lui, est present partout — avoir la commande ssh ne veut pas dire avoir un serveur.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# COUCHE 2 - L UNITE, ET LE PIEGE DE L ACTIVATION PAR SOCKET',
      '#',
      '# Depuis Ubuntu 22.10, c est ssh.socket qui ecoute, et ssh.service ne',
      '# demarre qu a la premiere connexion. « systemctl is-active ssh » repond',
      '# donc « inactive » sur un serveur qui fonctionne parfaitement.',
      '#',
      '# C est la fausse alarme la plus frequente du sujet, et elle coute des',
      '# heures : on « repare » un service qui n avait rien, et on finit par',
      '# activer ssh.service EN PLUS du socket — ce qui donne deux processus qui',
      '# se disputent le meme port.',
      '# ---------------------------------------------------------------------------',
      "KJEMO_SERVICE='inconnu'",
      "KJEMO_SOCKET='inconnu'",
      "KJEMO_SERVICE_ACT='inconnu'",
      "KJEMO_SOCKET_ACT='inconnu'",
      'if kjemo_dispo systemctl; then',
      '  KJEMO_SERVICE="$(systemctl is-active ssh.service 2>/dev/null || true)"',
      '  KJEMO_SOCKET="$(systemctl is-active ssh.socket 2>/dev/null || true)"',
      '  KJEMO_SERVICE_ACT="$(systemctl is-enabled ssh.service 2>/dev/null || true)"',
      '  KJEMO_SOCKET_ACT="$(systemctl is-enabled ssh.socket 2>/dev/null || true)"',
      'fi',
      "kjemo_resultat 'Unite' 'ssh.socket' 'INFO' \"active=${KJEMO_SOCKET:-inconnu} au-demarrage=${KJEMO_SOCKET_ACT:-inconnu}\" \\",
      "  'Depuis Ubuntu 22.10, c est le socket qui ecoute. Quand il est actif, le serveur repond meme si ssh.service est inactif.'",
      "kjemo_resultat 'Unite' 'ssh.service' 'INFO' \"active=${KJEMO_SERVICE:-inconnu} au-demarrage=${KJEMO_SERVICE_ACT:-inconnu}\" \\",
      "  'Sous activation par socket, « inactive » est NORMAL : le service demarre a la premiere connexion et s arrete ensuite.'",
      '',
      '# Les quatre combinaisons, et ce qu elles veulent dire. C est ici que le',
      '# diagnostic se joue, et non dans la lecture brute des deux etats.',
      'KJEMO_ECOUTE_OK=0',
      'if [ "${KJEMO_SOCKET}" = \'active\' ] && [ "${KJEMO_SERVICE}" = \'active\' ]; then',
      "  kjemo_resultat 'Unite' 'Les deux sont actifs' 'ATTENTION' 'socket + service' \\",
      "    'ssh.socket ET ssh.service sont actifs en meme temps. Deux processus se disputent alors le meme port, et le symptome est une connexion sur deux qui echoue — un comportement si irregulier qu on cherche la cause ailleurs. Il faut choisir UN des deux modes.'",
      '  KJEMO_ECOUTE_OK=1',
      'elif [ "${KJEMO_SOCKET}" = \'active\' ]; then',
      "  kjemo_resultat 'Unite' 'Mode' 'OK' 'activation par socket' \\",
      "    'Activation par socket : le socket ecoute, et ssh.service demarre a la demande. Que ssh.service soit inactif ne pose aucun probleme — c est le fonctionnement prevu depuis Ubuntu 22.10, et le prendre pour une panne est la fausse alarme la plus frequente du sujet.'",
      '  KJEMO_ECOUTE_OK=1',
      'elif [ "${KJEMO_SERVICE}" = \'active\' ]; then',
      "  kjemo_resultat 'Unite' 'Mode' 'OK' 'service classique' \\",
      "    'Le demon tourne en permanence, sans activation par socket. C est le mode d avant Ubuntu 22.10, et il reste parfaitement valable.'",
      '  KJEMO_ECOUTE_OK=1',
      'else',
      "  kjemo_resultat 'Unite' 'Mode' 'PROBLEME' 'ni socket ni service actif' \\",
      "    'Ni ssh.socket ni ssh.service n est actif : rien n ecoute, et c est la cause. Ce script ne demarre rien — l etat courant est la preuve, et la demarrer l effacerait. La procedure d annulation en fin de fiche donne les deux commandes.'",
      'fi',
      '',      '# ---------------------------------------------------------------------------',
      '# COUCHE 3 - QU EST-CE QUI ECOUTE, ET SUR QUEL PORT ?',
      '#',
      '# La question que « systemctl status » ne repond pas. Un socket actif et',
      '# rien en ecoute sur le port attendu, cela arrive : port change dans la',
      '# configuration et unite socket pas rechargee, ou l inverse.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PORT_OK=0',
      "KJEMO_SOCKETS=''",
      'if kjemo_dispo ss; then',
      '  KJEMO_SOCKETS="$(ss -lntp 2>/dev/null | grep -E \'sshd|ssh\\.socket|systemd\' || true)"',
      "  kjemo_resultat 'Ecoute' 'Sockets lies a SSH' 'INFO' \"${KJEMO_SOCKETS:-aucun}\" \\",
      "    'Les options, lettre par lettre : -l en ecoute seulement, -n sans resoudre les noms, -t TCP, -p le processus. Sans root, la colonne du processus peut rester vide — le socket, lui, est visible.'",
      '  if printf \'%s\\n\' "${KJEMO_SOCKETS}" | grep -qE "[:.]${KJEMO_PORT}[[:space:]]"; then',
      '    KJEMO_PORT_OK=1',
      "    kjemo_resultat 'Ecoute' \"Port ${KJEMO_PORT}\" 'OK' 'en ecoute' \\",
      '      "Quelque chose ecoute bien sur le port ${KJEMO_PORT}. C est la seule preuve qui compte a cette couche : un service « actif » qui n ecoute sur rien est un service qui ne repond pas."',
      '  else',
      "    kjemo_resultat 'Ecoute' \"Port ${KJEMO_PORT}\" 'PROBLEME' 'rien en ecoute' \\",
      '      "Rien n ecoute sur le port ${KJEMO_PORT}. Sockets SSH vus : ${KJEMO_SOCKETS:-aucun}. Si un autre port apparait, la configuration et ce qui ecoute ne concordent pas — et c est l ecart signale plus bas."',
      '  fi',
      'else',
      "  kjemo_resultat 'Ecoute' 'ss' 'IGNORE' 'commande absente' \\",
      "    'La commande ss n est pas disponible : la couche « qu est-ce qui ecoute » n a PAS ete controlee. Elle vient du paquet iproute2, present par defaut.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# COUCHE 4 - LA CONFIGURATION EFFECTIVE, LUE PAR SSHD LUI-MEME',
      '#',
      '# « sshd -T » affiche la configuration telle que sshd la comprend, apres',
      '# les Include et les blocs Match. C est la seule lecture qui ne se trompe',
      '# pas : lire sshd_config a la main oublie les fichiers additionnels, et',
      '# sshd_config(5) precise que pour chaque mot-cle, c est la PREMIERE valeur',
      '# obtenue qui est retenue — donc un fichier inclus en tete gagne.',
      '#',
      '# La page de manuel de sshd(8) decrit -T comme « Extended test mode.',
      '# Check the validity of the configuration file, output the effective',
      '# configuration to stdout ». Elle verifie, elle affiche, elle n applique',
      '# pas : c est une lecture.',
      '#',
      '# Elle demande root, parce qu elle controle aussi la sante des cles',
      '# d hote, qui sont en mode 600. Sans root : IGNORE, et non « OK ».',
      '# ---------------------------------------------------------------------------',
      "KJEMO_EFFECTIVE=''",
      "KJEMO_PORT_CONF=''",
      'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo sshd; then',
      '  if KJEMO_EFFECTIVE="$(sshd -T 2>&1)"; then',
      '    KJEMO_PORT_CONF="$(printf \'%s\\n\' "${KJEMO_EFFECTIVE}" | awk \'$1 == "port" {print $2}\' | paste -sd, - || true)"',
      "    kjemo_resultat 'Configuration' 'sshd -T' 'OK' \"port=${KJEMO_PORT_CONF:-non lu}\" \\",
      '      "La configuration effective a ete lue par sshd lui-meme, fichiers additionnels compris. Port(s) declare(s) : ${KJEMO_PORT_CONF:-non lu}."',
      '  else',
      "    kjemo_resultat 'Configuration' 'sshd -T' 'PROBLEME' 'refusee' \\",
      '      "sshd REFUSE sa propre configuration : ${KJEMO_EFFECTIVE}. Tant que ce message subsiste, le demon ne demarrera pas, et aucun autre reglage n y changera rien. C est la panne a corriger en premier."',
      '  fi',
      'else',
      "  kjemo_resultat 'Configuration' 'sshd -T' 'IGNORE' 'non lue' \\",
      "    'La configuration effective n a PAS ete lue : « sshd -T » demande root — il controle aussi les cles d hote, en mode 600 — et sshd n est pas dans le PATH d un utilisateur standard. Relance avec sudo pour obtenir cette couche. Ce rapport ne conclut donc rien sur la configuration.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# L ECART ENTRE LE PORT CONFIGURE ET LE PORT ECOUTE : A VALIDER',
      '#',
      '# Sous activation par socket, lequel des deux gagne a change entre les',
      '# versions d Ubuntu, et Canonical a ouvert un rapport d anomalie a ce',
      '# sujet. Ce projet ne tranche donc pas : il MESURE les deux, et signale',
      '# l ecart. Une hypothese que la documentation officielle ne confirme pas',
      '# n a pas sa place dans un script qui agit.',
      '# ---------------------------------------------------------------------------',
      'if [ -n "${KJEMO_PORT_CONF}" ] && [ "${KJEMO_PORT_CONF}" != "${KJEMO_PORT}" ]; then',
      "  kjemo_resultat 'Configuration' 'Ecart de port' 'ATTENTION' \"conf=${KJEMO_PORT_CONF} attendu=${KJEMO_PORT}\" \\",
      '    "A VALIDER : la configuration declare le port ${KJEMO_PORT_CONF}, et le port attendu est ${KJEMO_PORT}. Sous activation par socket, c est l unite ssh.socket qui ouvre le port, et savoir lequel des deux reglages gagne depend de la version d Ubuntu — le comportement a change, et un rapport d anomalie de Canonical est ouvert. Ce script ne choisit pas a ta place : compare avec ce qui ecoute reellement, plus haut."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# COUCHE 5 - LES CLES D HOTE',
      '#',
      '# Sans cle d hote, sshd ne demarre pas. Les empreintes sont calculees sur',
      '# les fichiers .pub, et JAMAIS sur les cles privees : kjemo_empreinte',
      '# refuse tout autre chemin, bruyamment.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_CLES_OK=0',
      'KJEMO_NB_CLES=0',
      'for kjemo_pub in /etc/ssh/ssh_host_*_key.pub; do',
      '  if [ -r "${kjemo_pub}" ]; then',
      '    KJEMO_NB_CLES=$((KJEMO_NB_CLES + 1))',
      "    KJEMO_EMPREINTE=\"$(kjemo_empreinte \"${kjemo_pub}\" || printf '%s' 'non calculee')\"",
      "    kjemo_resultat 'Cles d hote' \"${kjemo_pub##*/}\" 'INFO' \"${KJEMO_EMPREINTE}\" \\",
      '      "Empreinte de la cle PUBLIQUE d hote : ${KJEMO_EMPREINTE}. C est elle que le client affiche a la premiere connexion, et c est elle qu il faut comparer — pas accepter sans regarder."',
      '  fi',
      'done',
      'if [ "${KJEMO_NB_CLES}" -gt 0 ]; then',
      '  KJEMO_CLES_OK=1',
      'else',
      "  kjemo_resultat 'Cles d hote' 'Inventaire' 'PROBLEME' 'aucune cle publique lisible' \\",
      "    'Aucune cle d hote publique n a ete trouvee dans /etc/ssh. Sans cle d hote, sshd ne demarre pas du tout. Elles se regenerent avec « sudo dpkg-reconfigure openssh-server » — et cela CHANGE l empreinte du serveur, donc tous les clients avertiront d un changement de cle, ce qui est normal et doit etre annonce aux utilisateurs.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# COUCHE 6 - LE PARE-FEU',
      '#',
      '# Derniere couche, et celle qui donne un symptome different des autres :',
      '# un pare-feu qui bloque donne un DELAI D ATTENTE, pas un refus immediat.',
      '# « Connection refused » vient de la machine, « timed out » vient du',
      '# chemin. Cette distinction economise une heure a chaque fois.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_FEU_OK=1',
      'if kjemo_dispo ufw; then',
      '  KJEMO_UFW="$(ufw status 2>/dev/null || true)"',
      '  case "${KJEMO_UFW}" in',
      '    *inactive*)',
      "      kjemo_resultat 'Pare-feu' 'ufw' 'INFO' 'inactif' \\",
      "        'UFW est inactif : il ne bloque rien. Si la connexion echoue, ce n est pas lui.'",
      '      ;;',
      '    *)',
      '      if printf \'%s\\n\' "${KJEMO_UFW}" | grep -qE "(^|[^0-9])${KJEMO_PORT}(/tcp)?[[:space:]]+ALLOW"; then',
      "        kjemo_resultat 'Pare-feu' \"ufw, port ${KJEMO_PORT}\" 'OK' 'autorise' \\",
      '          "UFW est actif et une regle autorise le port ${KJEMO_PORT}."',
      '      else',
      '        KJEMO_FEU_OK=0',
      "        kjemo_resultat 'Pare-feu' \"ufw, port ${KJEMO_PORT}\" 'PROBLEME' 'aucune regle vue' \\",
      '          "UFW est actif et aucune regle n autorise le port ${KJEMO_PORT}. Symptome attendu : un DELAI D ATTENTE, et non « Connection refused ». Ce script n ouvre rien — la commande figure dans la procedure en fin de fiche, et l ordre compte : autoriser SSH AVANT d activer le pare-feu, jamais l inverse."',
      '      fi',
      '      ;;',
      '  esac',
      'else',
      "  kjemo_resultat 'Pare-feu' 'ufw' 'INFO' 'absent' \\",
      "    'UFW n est pas installe. Un autre pare-feu peut etre en place : l assistant linux-firewall-audit lit aussi nftables et iptables, et croise les regles avec les ports en ecoute.'",
      'fi',
      '',
      ...(journal ? [
        '# -----------------------------------------------------------------------',
        '# LE JOURNAL, OU SE TROUVE LE MESSAGE QUE PERSONNE NE VA CHERCHER',
        '#',
        '# « Authentication refused: bad ownership or modes for directory ... »',
        '# n apparait QUE la, cote serveur. Le client, lui, affiche « Permission',
        '# denied (publickey) » — ce qui laisse croire a une mauvaise cle alors',
        '# que la cle est bonne et que c est le mode du dossier qui la fait',
        '# rejeter par StrictModes.',
        '# -----------------------------------------------------------------------',
        'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo journalctl; then',
        '  KJEMO_JOURNAL="$(journalctl -u ssh.service -u ssh.socket -n 20 --no-pager 2>/dev/null || true)"',
        "  kjemo_resultat 'Journal' 'ssh (20 dernieres lignes)' 'INFO' \"${KJEMO_JOURNAL:-vide}\" \\",
        "    'Le journal des deux unites. --no-pager est indispensable dans un script : sans lui, journalctl attend une touche et le script semble bloque.'",
        '  if printf \'%s\\n\' "${KJEMO_JOURNAL}" | grep -qiE \'bad ownership|bad modes\'; then',
        "    kjemo_resultat 'Journal' 'StrictModes' 'PROBLEME' 'permissions refusees' \\",
        "      'Le journal contient « bad ownership or modes » : sshd REFUSE la cle a cause des permissions du dossier personnel ou de ~/.ssh, pas a cause de la cle. Cote client, le message est « Permission denied (publickey) », ce qui envoie chercher au mauvais endroit. L assistant ssh-key-readiness mesure exactement ces permissions.'",
        '  fi',
        'else',
        "  kjemo_resultat 'Journal' 'ssh' 'IGNORE' 'non lu' \\",
        "    'Le journal de l unite n a PAS ete lu : journalctl -u demande root. C est pourtant le seul endroit ou apparait « bad ownership or modes », le message qui explique une cle refusee alors qu elle est bonne. Relance avec sudo pour cette section.'",
        'fi',
        '',
      ] : [
        '# Journal non demande : il n est pas lu. Le dire evite de croire que le',
        '# rapport couvre une couche qu il n a pas regardee.',
        "kjemo_resultat 'Journal' 'ssh' 'IGNORE' 'non demande' \\",
        "  'Le journal n a pas ete lu, parce que le formulaire ne l a pas demande. C est pourtant la que sshd explique une cle refusee : « Authentication refused: bad ownership or modes ».'",
        '',
      ]),
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT, QUI NOMME LA PREMIERE COUCHE MANQUANTE',
      '#',
      '# Un rapport ou tout est vrai et ou rien ne conclut laisse l operateur',
      '# exactement ou il etait. La premiere couche qui manque est CELLE a',
      '# corriger : les suivantes n ont pas de sens avant.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_PAQUET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le paquet' \\",
      "    'Le serveur SSH n est pas installe : « sudo apt install openssh-server ». Les couches suivantes n ont pas de sens avant celle-la.'",
      'elif [ "${KJEMO_ECOUTE_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'l unite' \\",
      "    'Le paquet est la, mais ni ssh.socket ni ssh.service n est actif : rien n ecoute. C est la couche a corriger, et les commandes sont dans la procedure d annulation de la fiche. Ce script ne demarre rien de lui-meme.'",
      'elif [ "${KJEMO_PORT_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le port' \\",
      '    "Une unite est active mais rien n ecoute sur le port ${KJEMO_PORT}. Compare le port de la configuration et le port ecoute, plus haut : sous activation par socket, les deux peuvent diverger."',
      'elif [ "${KJEMO_CLES_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'les cles d hote' \\",
      "    'Aucune cle d hote publique lisible. sshd ne demarre pas sans cle d hote, et une regeneration change l empreinte du serveur — a annoncer aux utilisateurs avant, pas apres.'",
      'elif [ "${KJEMO_FEU_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le pare-feu' \\",
      '    "Tout repond sur la machine, et UFW est actif sans regle pour le port ${KJEMO_PORT}. Symptome attendu depuis l exterieur : un delai d attente, et non un refus immediat."',
      'else',
      "  kjemo_resultat 'Verdict' 'Les cinq couches' 'OK' 'completes' \\",
      '    "Paquet present, unite active, port ${KJEMO_PORT} en ecoute, cles d hote presentes, pare-feu ouvert. Si la connexion echoue malgre tout, la cause est HORS de cette machine : un equipement reseau entre les deux, ou une regle sur le chemin. Ce script ne teste pas depuis l exterieur, et ne le devine pas."',
      'fi',
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucun service demarre ou active, aucun port ouvert, aucun fichier de /etc/ssh touche, aucune cle privee lue.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-ssh-serveur' }),
    ]);
  },

  gui: [
    'N’en conclus RIEN à partir de « systemctl is-active ssh » : depuis Ubuntu 22.10, c’est ssh.socket qui écoute, et le service répond « inactive » sur un serveur qui marche.',
    'Regarde les deux : « systemctl is-active ssh.socket » et « systemctl is-active ssh.service ». Les deux actifs en même temps est un défaut, pas une ceinture de sécurité.',
    'La seule preuve qui compte : « ss -lntp | grep ssh ». Un service « actif » qui n’écoute sur rien ne répond pas.',
    'La configuration effective se lit avec « sudo sshd -T », jamais à la main : lire sshd_config oublie les fichiers additionnels, et c’est la PREMIÈRE valeur obtenue qui gagne.',
    'Si sshd refuse sa configuration, « sudo sshd -t » le dit en une ligne. Tant que ce message subsiste, rien d’autre n’a d’effet.',
    'Distingue les deux symptômes : « Connection refused » vient de la machine (rien n’écoute), « timed out » vient du chemin (un pare-feu quelque part).',
    'Le message « bad ownership or modes » n’existe QUE dans le journal du serveur : « sudo journalctl -u ssh -n 50 --no-pager ». Le client, lui, dit « Permission denied (publickey) ».',
    'Dans un script, journalctl prend toujours --no-pager : sinon il attend une touche et le script paraît bloqué.',
    'Si tu changes le port : autorise le nouveau port dans le pare-feu AVANT de redémarrer SSH, garde la session ouverte, et vérifie depuis une seconde session.',
  ],

  keywords: ['ssh', 'sshd', 'openssh', 'serveur', 'socket', 'ssh.socket', 'activation',
    'port', '22', 'cle d hote', 'host key', 'ufw', 'pare-feu', 'journal',
    'strictmodes', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour les couches 1, 3, 5 et 6 : le paquet, l’écoute, les clés publiques d’hôte et UFW se lisent sans privilège.',
    'sudo pour deux sections : la configuration effective (« sshd -T ») et le journal de l’unité. Sans sudo, elles sont annoncées IGNORE — pas OK.',
    'Le port attendu, si ce n’est pas 22.',
  ],

  commonErrors: [
    {
      message: 'systemctl is-active ssh répond « inactive » mais SSH fonctionne',
      code: 'KJEMO',
      cause: 'L’activation par socket, par défaut depuis Ubuntu 22.10 : ssh.socket écoute, et ssh.service ne démarre qu’à la connexion.',
      fix: 'Interroger le socket, pas le service.',
      command: 'systemctl is-active ssh.socket; ss -lntp | grep ssh',
    },
    {
      message: 'Connection refused',
      code: 'ECONNREFUSED',
      cause: 'Rien n’écoute sur le port. La machine a répondu — c’est elle qui refuse, donc ce n’est pas un pare-feu sur le chemin.',
      fix: 'Vérifier qu’une unité est active et que le port écoute.',
      command: 'ss -lntp | grep ssh',
    },
    {
      message: 'Connection timed out',
      code: 'ETIMEDOUT',
      cause: 'Rien n’a répondu. Un pare-feu quelque part sur le chemin jette les paquets sans rien dire — c’est la différence avec un refus.',
      fix: 'Vérifier UFW sur le serveur, puis le chemin réseau.',
      command: 'sudo ufw status',
    },
    {
      message: 'Permission denied (publickey) alors que la clé est la bonne',
      code: 'KJEMO',
      cause: 'StrictModes refuse la clé à cause des permissions du dossier personnel ou de ~/.ssh. Le serveur l’écrit dans son journal ; le client, non.',
      fix: 'Lire le journal du serveur, puis corriger les permissions.',
      command: 'sudo journalctl -u ssh -n 50 --no-pager | grep -i "bad ownership"',
    },
    {
      message: 'sshd: no hostkeys available',
      code: 'KJEMO',
      cause: 'Aucune clé d’hôte. sshd ne démarre pas du tout dans cet état.',
      fix: 'Régénérer les clés d’hôte — en sachant que l’empreinte du serveur change, donc tous les clients avertiront.',
      command: 'sudo dpkg-reconfigure openssh-server',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport distingue ssh.socket et ssh.service, et dit explicitement qu’un ssh.service inactif est normal sous activation par socket.',
    'Les deux unités actives en même temps sont signalées ATTENTION.',
    'Le port est vérifié dans ce qui écoute réellement, et non seulement dans la configuration.',
    'Un écart entre le port configuré et le port attendu est marqué « À VALIDER », sans qu’une règle de résolution soit inventée.',
    'La configuration effective vient de « sshd -T », donc des fichiers additionnels compris — ou est annoncée IGNORE si root manque.',
    'Les empreintes des clés d’hôte sont calculées sur les fichiers .pub seulement ; tout autre chemin est refusé par kjemo_empreinte.',
    'Le verdict nomme la PREMIÈRE couche manquante, et non la liste de tout ce qui va.',
    'Aucune écriture : aucun service démarré, aucun port ouvert, aucun fichier touché.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne démarre pas le service, et c’est volontaire — l’état courant est la preuve, et le démarrer l’effacerait avant qu’on ait compris pourquoi il était arrêté.',
    diagnostic: `# Les deux unites, puis ce qui ecoute :
systemctl is-active ssh.socket ssh.service
ss -lntp | grep ssh
# La configuration telle que sshd la comprend :
sudo sshd -T | grep -E '^(port|permitrootlogin|passwordauthentication)'`,
    command: `# Aucune modification a annuler.
#
# Pour demarrer le serveur SOI-MEME, apres avoir constate pourquoi il
# etait arrete — et en choisissant UN seul des deux modes :
#   mode socket (defaut depuis Ubuntu 22.10) :
#     sudo systemctl enable --now ssh.socket
#   mode service classique :
#     sudo systemctl enable --now ssh.service
#
# Les deux en meme temps donnent deux processus sur le meme port, et une
# connexion sur deux qui echoue.
#
# Si le pare-feu bloque, l ORDRE compte : autoriser SSH d abord, activer
# ensuite. L inverse coupe la session en cours.
#   sudo ufw allow 22/tcp
#   sudo ufw enable
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Ne démarre pas ssh.service « pour voir » quand le socket est déjà actif : les deux ensemble se disputent le port.',
  },

  checks: [
    'Aucune écriture : aucun « systemctl start », aucun « systemctl enable », aucun « ufw allow », aucun fichier de /etc/ssh touché.',
    'Aucune clé privée lue, affichée ni copiée : kjemo_empreinte refuse tout chemin qui n’est pas .pub, authorized_keys ou known_hosts, et le refus est consigné.',
    'La présence du paquet est établie par dpkg-query et non par un chemin codé en dur : /usr/sbin/sshd n’apparaît pas dans le chemin d’exécution, qui contournerait toute observation.',
    'L’activation par socket est traitée comme le cas NORMAL, et les quatre combinaisons socket/service sont distinguées.',
    'Les deux unités actives en même temps sont signalées comme un défaut.',
    'Le port est cherché dans « ss -lntp », c’est-à-dire dans la réalité, puis comparé à la configuration.',
    'L’écart de port sous activation par socket est marqué « À VALIDER » : la documentation officielle ne fixe pas lequel des deux réglages gagne.',
    '« sshd -T » refusant la configuration est signalé PROBLEME, avec le message exact : rien d’autre n’a d’effet tant qu’il subsiste.',
    'Les sections réservées à root sont annoncées IGNORE quand root manque, jamais OK.',
    'Le verdict nomme la première couche manquante.',
    '« journalctl --no-pager » partout : sans lui, le script paraît bloqué.',
  ],

  source: `${M}/man8/sshd.8.html`,
  sources: [
    { label: 'sshd(8) — les modes de test -t et -T', url: `${M}/man8/sshd.8.html` },
    { label: 'sshd_config(5) — Port, Include, première valeur obtenue', url: `${M}/man5/sshd_config.5.html` },
    { label: 'systemctl(1)', url: `${M}/man1/systemctl.1.html` },
    { label: 'journalctl(1)', url: `${M}/man1/journalctl.1.html` },
    { label: 'ss(8)', url: `${M}/man8/ss.8.html` },
    { label: 'ufw(8)', url: `${M}/man8/ufw.8.html` },
  ],
};

// ===========================================================================
// 2. ssh-client-diagnostic
// ===========================================================================
//
// « Ça ne se connecte pas » n'est pas un diagnostic : c'est un symptôme qui a
// cinq causes différentes, et chacune donne un message différent. L'assistant
// lit d'abord ce que le client va RÉELLEMENT faire — `ssh -G` le dit, et le
// fichier ~/.ssh/config peut rediriger la connexion ailleurs sans le dire —
// puis il demande au serveur quelles authentifications il propose.

const sshClientDiagnostic = {
  id: 'ssh-client-diagnostic',
  icon: '◇',
  category: CAT,
  subcategory: 'SSH et accès distant',
  title: 'Diagnostiquer un client SSH qui ne se connecte pas',
  risk: 'diagnostic',
  summary: 'Lit la configuration que le client appliquera réellement — « ssh -G » résout ~/.ssh/config, et une entrée oubliée peut rediriger la connexion ailleurs —, contrôle les permissions que ssh exige sur ~/.ssh, cherche l’hôte dans known_hosts, puis demande au serveur quelles authentifications il propose, sans jamais s’authentifier ni accepter une clé d’hôte inconnue. N’écrit rien, et ne lit aucune clé privée.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'openssh-client — ssh, ssh-keygen (présent par défaut)',
    'libc-bin — getent (présent par défaut)',
  ],
  privileges: 'aucun : tout se lit dans le dossier personnel de la session, et c’est bien la configuration de CE compte qu’on veut diagnostiquer',
  privilegesRequis: 'aucun',
  readOnly: true,
  service: 'aucun',
  limites: [
    'N’écrit rien : ni ~/.ssh/config, ni known_hosts, ni les permissions. Une entrée périmée de known_hosts est retirée à la main, après avoir vérifié POURQUOI la clé a changé — l’automatiser reviendrait à accepter silencieusement un serveur qu’on ne reconnaît plus.',
    'N’accepte JAMAIS une clé d’hôte. Le test de connexion force « StrictHostKeyChecking=yes » : si l’hôte est inconnu, il échoue, et c’est le comportement voulu. « accept-new » est une décision de confiance, et une décision de confiance ne se prend pas dans un script.',
    'Ne s’authentifie pas. Le test demande « PreferredAuthentications=none » : le serveur répond en listant ce qu’il accepte, et aucun mot de passe ni aucune clé n’est présenté.',
    'Ne lit aucune clé privée. « ssh -G » ne cite que des NOMS de fichiers d’identité, et c’est tout ce que le rapport contient.',
    'Un test de connexion dépend du réseau au moment où il tourne, et il ouvre une connexion TCP vers l’hôte demandé. C’est la seule chose que cet assistant fait sortir de la machine, et le formulaire permet de s’en passer.',
  ],

  fields: [
    {
      id: 'hote',
      label: 'Hôte à joindre',
      type: 'text',
      default: 'srv-labo.kjemo.local',
      placeholder: 'srv-labo.kjemo.local',
      help: 'Le nom ou l’adresse du serveur SSH. Un nom qui apparaît dans ~/.ssh/config peut être un alias, et « ssh -G » dira vers quoi il pointe réellement.',
    },
    {
      id: 'utilisateur',
      label: 'Compte distant (vide = celui de la session)',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Si vide, ssh utilise le nom de la session courante — ou celui que ~/.ssh/config impose pour cet hôte, ce qui est une cause classique de « Permission denied » inexpliqué.',
    },
    {
      id: 'port',
      label: 'Port',
      type: 'text',
      default: '22',
      placeholder: '22',
      help: 'Le port du serveur. sshd_config(5) : « The default is 22 ».',
    },
    {
      id: 'interrogerServeur',
      label: 'Demander au serveur ses authentifications',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'Ouvre une connexion TCP, ne présente aucune authentification, et lit la liste que le serveur renvoie. C’est le contrôle le plus utile — et c’est aussi la seule chose qui sort de la machine.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const h = validateHoteSsh(v.hote, 'L’hôte à joindre');
    if (!h.ok) errors.hote = h.error;
    const u = String(v.utilisateur ?? '').trim();
    if (u !== '') {
      const r = validateNomUtilisateur(u, 'Le compte distant');
      if (!r.ok) errors.utilisateur = r.error;
    }
    const p = validatePortTcp(v.port, 'Le port');
    if (!p.ok) errors.port = p.error;
    const i = validateChoix(v.interrogerServeur, ['Oui', 'Non'], 'L’interrogation du serveur');
    if (!i.ok) errors.interrogerServeur = i.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const hote = String(v.hote).trim();
    const utilisateur = String(v.utilisateur ?? '').trim();
    const port = String(v.port).trim();
    const interroger = String(v.interrogerServeur) === 'Oui';

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer un client SSH qui ne se connecte pas',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'tout se lit dans le dossier personnel de la session',
      }),
      ...fonctionEmpreinteBash(),
      ...blocVariablesBash([
        ['KJEMO_HOTE', shQuote(hote)],
        ['KJEMO_UTIL', shQuote(utilisateur)],
        ['KJEMO_PORT', shQuote(port)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      '# La cible telle que ssh la recevra. Elle est construite ICI, une fois,',
      '# et jamais recomposee ailleurs : deux constructions differentes de la',
      '# meme cible, c est un diagnostic qui porte sur autre chose que le test.',
      'if [ -n "${KJEMO_UTIL}" ]; then',
      '  KJEMO_CIBLE="${KJEMO_UTIL}@${KJEMO_HOTE}"',
      'else',
      '  KJEMO_CIBLE="${KJEMO_HOTE}"',
      'fi',
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Cible' \"${KJEMO_CIBLE}\"",
      "  printf '%s\\t%s\\n' 'Port' \"${KJEMO_PORT}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - ni config, ni known_hosts, ni permissions'",
      "  printf '%s\\t%s\\n' 'Cle d hote inconnue' 'REFUSEE - StrictHostKeyChecking=yes, jamais accept-new'",
      "  printf '%s\\t%s\\n' 'Authentification' 'AUCUNE - PreferredAuthentications=none'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - CE QUE LE CLIENT VA REELLEMENT FAIRE',
      '#',
      '# « ssh -G » affiche la configuration effective pour cette cible, apres',
      '# resolution de ~/.ssh/config. Il ne se connecte pas.',
      '#',
      '# C est la ou se trouve une cause qu on ne soupconne jamais : une entree',
      '# « Host srv* » ecrite six mois plus tot impose un autre utilisateur, un',
      '# autre port, ou un rebond — et le message d erreur ne mentionne rien de',
      '# tout cela. Lire le fichier a la main ne suffit pas : c est la premiere',
      '# entree correspondante qui gagne, et les jokers se superposent.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_EFF_OK=0',
      "KJEMO_EFF=''",
      'if kjemo_dispo ssh; then',
      '  if KJEMO_EFF="$(ssh -G -p "${KJEMO_PORT}" -- "${KJEMO_CIBLE}" 2>&1)"; then',
      '    KJEMO_EFF_OK=1',
      '    KJEMO_EFF_HOTE="$(printf \'%s\\n\' "${KJEMO_EFF}" | awk \'$1 == "hostname" {print $2; exit}\' || true)"',
      '    KJEMO_EFF_UTIL="$(printf \'%s\\n\' "${KJEMO_EFF}" | awk \'$1 == "user" {print $2; exit}\' || true)"',
      '    KJEMO_EFF_PORT="$(printf \'%s\\n\' "${KJEMO_EFF}" | awk \'$1 == "port" {print $2; exit}\' || true)"',
      '    KJEMO_EFF_IDENT="$(printf \'%s\\n\' "${KJEMO_EFF}" | awk \'$1 == "identityfile" {print $2}\' | paste -sd, - || true)"',
      "    kjemo_resultat 'Client' 'Configuration effective' 'INFO' \"hote=${KJEMO_EFF_HOTE} util=${KJEMO_EFF_UTIL} port=${KJEMO_EFF_PORT}\" \\",
      '      "Ce que ssh fera vraiment : hote=${KJEMO_EFF_HOTE}, utilisateur=${KJEMO_EFF_UTIL}, port=${KJEMO_EFF_PORT}. Fichiers d identite envisages (NOMS seulement, aucun contenu lu) : ${KJEMO_EFF_IDENT:-aucun}."',
      '    # L ecart entre ce qui est demande et ce qui sera fait.',
      '    if [ -n "${KJEMO_EFF_HOTE}" ] && [ "${KJEMO_EFF_HOTE}" != "${KJEMO_HOTE}" ]; then',
      "      kjemo_resultat 'Client' 'Hote redirige' 'ATTENTION' \"${KJEMO_HOTE} -> ${KJEMO_EFF_HOTE}\" \\",
      '        "Le fichier ~/.ssh/config redirige ${KJEMO_HOTE} vers ${KJEMO_EFF_HOTE}. La connexion ne va donc PAS ou tu crois, et aucun message d erreur ne le dira. Dans ssh_config, c est la premiere valeur obtenue qui gagne : une entree ancienne avec un joker peut capturer un nom recent."',
      '    fi',
      '    if [ -n "${KJEMO_EFF_PORT}" ] && [ "${KJEMO_EFF_PORT}" != "${KJEMO_PORT}" ]; then',
      "      kjemo_resultat 'Client' 'Port impose' 'ATTENTION' \"demande=${KJEMO_PORT} effectif=${KJEMO_EFF_PORT}\" \\",
      '        "Le port demande est ${KJEMO_PORT} et le port effectif est ${KJEMO_EFF_PORT} : une entree de ~/.ssh/config l impose. Le reste de ce rapport porte sur le port demande."',
      '    fi',
      '    # Un rebond change entierement le chemin, et donc le diagnostic.',
      '    if printf \'%s\\n\' "${KJEMO_EFF}" | grep -qiE \'^(proxycommand|proxyjump) [^n]\'; then',
      "      kjemo_resultat 'Client' 'Rebond' 'ATTENTION' 'proxycommand ou proxyjump' \\",
      "        'La connexion passe par un rebond declare dans ~/.ssh/config. Le serveur final n est donc pas joint directement, et un echec peut venir du rebond et non de la cible — un test de port vers la cible ne prouve alors rien.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'Client' 'Configuration effective' 'PROBLEME' 'refusee' \\",
      '      "ssh refuse de resoudre la configuration pour cette cible : ${KJEMO_EFF}. Cause la plus frequente : les permissions de ~/.ssh/config, que ssh exige non accessibles en ecriture par le groupe ou les autres."',
      '  fi',
      'else',
      "  kjemo_resultat 'Client' 'ssh' 'PROBLEME' 'commande absente' \\",
      "    'La commande ssh n est pas installee : « sudo apt install openssh-client ». Rien d autre ne peut etre controle sans elle.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LES PERMISSIONS QUE SSH EXIGE COTE CLIENT',
      '#',
      '# ssh REFUSE de lire un ~/.ssh/config accessible en ecriture par le',
      '# groupe ou par les autres, et il refuse d utiliser une cle privee dans',
      '# le meme cas. Le message est « Bad owner or permissions on ... » — clair',
      '# quand on le lit, invisible quand on ne lit que la derniere ligne.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SSHDIR="${HOME}/.ssh"',
      'if [ -d "${KJEMO_SSHDIR}" ]; then',
      '  KJEMO_MODE_DIR="$(stat -c \'%a %U:%G\' -- "${KJEMO_SSHDIR}" 2>/dev/null || true)"',
      '  case "${KJEMO_MODE_DIR}" in',
      '    700*|7[0-9][0-9]*)',
      "      kjemo_resultat 'Permissions' 'Dossier .ssh' 'INFO' \"${KJEMO_MODE_DIR}\" \\",
      '      "Mode et proprietaire de ~/.ssh : ${KJEMO_MODE_DIR}. Le mode attendu est 700 : lisible et modifiable par son seul proprietaire."',
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Permissions' 'Dossier .ssh' 'ATTENTION' \"${KJEMO_MODE_DIR}\" \\",
      '      "Mode inattendu sur ~/.ssh : ${KJEMO_MODE_DIR}, alors que 700 est attendu. Cote serveur, StrictModes refusera les cles de ce compte, et le client affichera « Permission denied (publickey) » — ce qui envoie chercher une erreur de cle qui n existe pas. Correction a la main : chmod 700 ~/.ssh"',
      '      ;;',
      '  esac',
      '  if [ -f "${KJEMO_SSHDIR}/config" ]; then',
      '    KJEMO_MODE_CONF="$(stat -c \'%a %U:%G\' -- "${KJEMO_SSHDIR}/config" 2>/dev/null || true)"',
      '    case "${KJEMO_MODE_CONF}" in',
      '      6[0-4][0-4]*|4[0-4][0-4]*)',
      "        kjemo_resultat 'Permissions' 'Fichier .ssh/config' 'INFO' \"${KJEMO_MODE_CONF}\" \\",
      '        "Mode et proprietaire de ~/.ssh/config : ${KJEMO_MODE_CONF}. Acceptable : ni le groupe ni les autres ne peuvent y ecrire."',
      '        ;;',
      '      *)',
      "        kjemo_resultat 'Permissions' 'Fichier .ssh/config' 'PROBLEME' \"${KJEMO_MODE_CONF}\" \\",
      '        "Mode refuse par ssh sur ~/.ssh/config : ${KJEMO_MODE_CONF}. ssh refuse un fichier de configuration accessible en ecriture par le groupe ou par les autres, et le dit avec « Bad owner or permissions ». Correction a la main : chmod 600 ~/.ssh/config"',
      '        ;;',
      '    esac',
      '  else',
      "    kjemo_resultat 'Permissions' 'Fichier .ssh/config' 'INFO' 'absent' \\",
      "      'Aucun fichier ~/.ssh/config : rien ne redirige donc la connexion, et les valeurs du formulaire s appliquent telles quelles.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Permissions' 'Dossier .ssh' 'INFO' 'absent' \\",
      "    'Le dossier ~/.ssh n existe pas encore : c est normal sur un compte qui n a jamais utilise SSH. Il est cree au premier usage, ou par ssh-keygen.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - RESOLUTION, PUIS KNOWN_HOSTS',
      '#',
      '# Dans cet ordre : un nom qui ne resout pas rend tout le reste sans objet.',
      '# « ssh-keygen -F » cherche l hote dans known_hosts — c est une lecture de',
      '# donnees publiques, et il gere les entrees hachees, que grep ne trouve',
      '# pas.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_RESOLU=0',
      'if kjemo_dispo getent; then',
      '  KJEMO_ADR="$(getent hosts -- "${KJEMO_HOTE}" 2>/dev/null | head -3 || true)"',
      '  if [ -n "${KJEMO_ADR}" ]; then',
      '    KJEMO_RESOLU=1',
      "    kjemo_resultat 'Resolution' \"${KJEMO_HOTE}\" 'OK' \"${KJEMO_ADR}\" \\",
      '      "Le nom resout vers : ${KJEMO_ADR}. Si cette adresse n est pas celle attendue, le probleme est le DNS ou /etc/hosts, et non SSH."',
      '  else',
      "    kjemo_resultat 'Resolution' \"${KJEMO_HOTE}\" 'PROBLEME' 'non resolu' \\",
      '      "Le nom ${KJEMO_HOTE} ne resout vers aucune adresse. Le message de ssh sera « Could not resolve hostname », et il n a rien a voir avec SSH : c est la resolution de noms. L assistant linux-dns-diagnostic examine cette couche."',
      '  fi',
      'fi',
      "KJEMO_CONNU=''",
      'if kjemo_dispo ssh-keygen; then',
      '  if KJEMO_CONNU="$(ssh-keygen -F "${KJEMO_HOTE}" 2>/dev/null)" && [ -n "${KJEMO_CONNU}" ]; then',
      "    kjemo_resultat 'Confiance' 'known_hosts' 'INFO' 'hote connu' \\",
      "      'L hote figure dans known_hosts : sa cle a deja ete acceptee une fois. Si la connexion echoue maintenant avec « Host key verification failed », c est que la cle du serveur a CHANGE — ce qui arrive apres une reinstallation, et qui ressemble a une attaque. Ne retire pas l entree avant de savoir laquelle des deux explications est la bonne.'",
      '  else',
      "    kjemo_resultat 'Confiance' 'known_hosts' 'ATTENTION' 'hote inconnu' \\",
      '      "L hote ${KJEMO_HOTE} ne figure pas dans known_hosts. La premiere connexion demandera donc de verifier son empreinte, et le test de ce script la REFUSE deliberement : accepter une cle d hote est une decision de confiance, et elle se prend en comparant l empreinte avec celle relevee sur le serveur — pas en tapant « yes »."',
      '  fi',
      'fi',
      '',
      ...(interroger ? [
        '# -----------------------------------------------------------------------',
        '# ETAPE 4 - DEMANDER AU SERVEUR CE QU IL ACCEPTE',
        '#',
        '# Le controle le plus utile du lot, et il ne presente aucune',
        '# authentification :',
        '#   BatchMode=yes             aucune invite, donc utilisable sans humain',
        '#   PreferredAuthentications=none  on ne propose RIEN',
        '#   StrictHostKeyChecking=yes aucune cle inconnue acceptee',
        '#   ConnectTimeout=5          un echec franc plutot qu une attente',
        '#',
        '# Le serveur repond alors « Permission denied (publickey,password) », et',
        '# cette liste est la reponse a la question « pourquoi ca me demande un',
        '# mot de passe » ou « pourquoi ca ne me le demande pas ».',
        '# -----------------------------------------------------------------------',
        'if kjemo_dispo ssh; then',
        '  KJEMO_REP=\'\'',
        '  KJEMO_CODE=0',
        '  KJEMO_REP="$(ssh -o BatchMode=yes -o PreferredAuthentications=none \\',
        '    -o StrictHostKeyChecking=yes -o ConnectTimeout=5 \\',
        '    -p "${KJEMO_PORT}" -- "${KJEMO_CIBLE}" exit 2>&1)" || KJEMO_CODE=$?',
        "  kjemo_resultat 'Serveur' 'Reponse brute' 'INFO' \"${KJEMO_REP:-aucune}\" \\",
        '    "Reponse du serveur (code ${KJEMO_CODE}) : ${KJEMO_REP:-aucune}. Aucune authentification n a ete presentee, et aucune cle d hote n a ete acceptee."',
        '  case "${KJEMO_REP}" in',
        '    *"Permission denied"*)',
        '      KJEMO_METHODES="$(printf \'%s\\n\' "${KJEMO_REP}" | sed -n \'s/.*Permission denied (\\([^)]*\\)).*/\\1/p\' | head -1 || true)"',
        "      kjemo_resultat 'Serveur' 'Authentifications proposees' 'OK' \"${KJEMO_METHODES:-non lues}\" \\",
        '        "Le serveur repond, et il accepte : ${KJEMO_METHODES:-non lues}. C est la reponse exacte a « pourquoi il me demande un mot de passe » — ou a « pourquoi il ne me le demande pas ». La couche reseau et la couche SSH fonctionnent toutes les deux : seule l authentification reste."',
        '      case "${KJEMO_METHODES}" in',
        '        *password*)',
        "          kjemo_resultat 'Serveur' 'Mot de passe accepte' 'ATTENTION' 'password propose' \\",
        "            'Le serveur accepte encore l authentification par mot de passe. C est la valeur par defaut d OpenSSH — sshd_config(5) : « The default is yes » — et c est aussi ce qui expose le serveur aux tentatives automatisees. L assistant ssh-hardening-audit dit a quelles conditions on peut la couper sans s enfermer dehors.'",
        '          ;;',
        '      esac',
        '      ;;',
        '    *"Connection refused"*)',
        "      kjemo_resultat 'Serveur' 'Verdict' 'PROBLEME' 'connexion refusee' \\",
        '        "La machine a REPONDU, et elle refuse : rien n ecoute sur le port ${KJEMO_PORT}. Ce n est donc pas un pare-feu sur le chemin — un pare-feu qui bloque donne un delai d attente, pas un refus. Cote serveur : ss -lntp | grep ssh"',
        '      ;;',
        '    *"timed out"*|*"Timeout"*)',
        "      kjemo_resultat 'Serveur' 'Verdict' 'PROBLEME' 'delai depasse' \\",
        '        "Rien n a repondu avant 5 secondes. Un paquet jete sans reponse, c est la signature d un pare-feu sur le chemin — ou d une machine eteinte. La difference avec « Connection refused » est exactement la : refus = la machine a parle, delai = personne n a parle."',
        '      ;;',
        '    *"Host key verification failed"*|*"REMOTE HOST IDENTIFICATION HAS CHANGED"*)',
        "      kjemo_resultat 'Serveur' 'Verdict' 'PROBLEME' 'cle d hote refusee' \\",
        "        'La cle d hote ne correspond pas a celle enregistree, ou l hote est inconnu et ce script refuse de l accepter. Deux explications, et une seule est benigne : le serveur a ete reinstalle, ou quelqu un se place entre les deux. Compare l empreinte avec celle relevee SUR le serveur avant de toucher a known_hosts, et retire l entree a la main : ssh-keygen -R <hote>'",
        '      ;;',
        '    *"Could not resolve"*)',
        "      kjemo_resultat 'Serveur' 'Verdict' 'PROBLEME' 'nom non resolu' \\",
        "        'Le nom ne resout pas : la connexion n a meme pas ete tentee. C est la resolution de noms qu il faut regarder, pas SSH.'",
        '      ;;',
        '    *)',
        '      if [ "${KJEMO_CODE}" -eq 0 ]; then',
        "        kjemo_resultat 'Serveur' 'Verdict' 'ATTENTION' 'connexion reussie' \\",
        "          'La connexion a REUSSI sans qu aucune authentification soit proposee. Sur un serveur correctement configure, cela ne devrait pas arriver : verifie PermitEmptyPasswords et AuthenticationMethods avec l assistant ssh-hardening-audit.'",
        '      else',
        "        kjemo_resultat 'Serveur' 'Verdict' 'ATTENTION' \"code ${KJEMO_CODE}\" \\",
        '          "Le serveur a repondu quelque chose que ce script ne sait pas classer (code ${KJEMO_CODE}) : ${KJEMO_REP:-aucune sortie}. La reponse brute est dans le rapport, et c est elle qui compte — plutot qu un verdict invente."',
        '      fi',
        '      ;;',
        '  esac',
        'fi',
        '',
      ] : [
        '# Interrogation du serveur non demandee : aucune connexion n est ouverte.',
        "kjemo_resultat 'Serveur' 'Interrogation' 'IGNORE' 'non demandee' \\",
        "  'Aucune connexion n a ete ouverte vers l hote : le formulaire ne l a pas demande. Ce rapport ne dit donc RIEN sur ce que le serveur accepte, ni sur le fait qu il repond.'",
        '',
      ]),
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT SUR LES COUCHES LOCALES',
      '#',
      '# Les deux drapeaux ci-dessous ne sont pas decoratifs : sans eux, le',
      '# rapport dirait « la configuration effective a ete refusee » puis',
      '# conclurait sur les authentifications du serveur comme si de rien',
      '# n etait. Une couche qui n a pas pu etre lue doit empecher le verdict,',
      '# et non se contenter d une ligne de plus.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_EFF_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Couches locales' 'PROBLEME' 'configuration du client non resolue' \\",
      "    'La configuration effective du client n a pas pu etre resolue : ce rapport ne dit donc PAS vers quoi ssh irait, ni avec quel compte ni sur quel port. Tout ce qui suit porte sur les valeurs du formulaire, et non sur ce que ssh ferait reellement.'",
      'elif [ "${KJEMO_RESOLU}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Couches locales' 'PROBLEME' 'nom non resolu' \\",
      '    "Le nom ${KJEMO_HOTE} ne resout vers aucune adresse : c est la premiere couche manquante, et les suivantes n ont pas de sens avant elle. Ce n est pas un probleme SSH."',
      'else',
      "  kjemo_resultat 'Verdict' 'Couches locales' 'OK' 'completes' \\",
      '    "La configuration effective est resolue et le nom ${KJEMO_HOTE} resout : ce qui reste a diagnostiquer est du cote du serveur ou de l authentification."',
      'fi',
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : ni ~/.ssh/config, ni known_hosts, ni permissions corrigees. Aucune cle privee lue. Aucune cle d hote acceptee.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-ssh-client' }),
    ]);
  },

  gui: [
    'Commence par ce que ssh va RÉELLEMENT faire : « ssh -G -p 22 user@hote ». Il résout ~/.ssh/config et ne se connecte pas.',
    'Une entrée « Host srv* » écrite il y a six mois peut imposer un autre utilisateur, un autre port ou un rebond — et aucun message d’erreur ne le dira.',
    'Dans ssh_config comme dans sshd_config, c’est la PREMIÈRE valeur obtenue qui gagne : les entrées les plus spécifiques se placent en haut.',
    'Les permissions comptent : « chmod 700 ~/.ssh » et « chmod 600 ~/.ssh/config ». ssh refuse un fichier accessible en écriture au groupe, avec « Bad owner or permissions ».',
    'Demande au serveur ce qu’il accepte, sans rien présenter : « ssh -o PreferredAuthentications=none -o BatchMode=yes hote ». Il répond « Permission denied (publickey,password) ».',
    'Distingue les trois échecs : « Connection refused » (rien n’écoute), « timed out » (un pare-feu sur le chemin), « Host key verification failed » (la clé a changé).',
    'Pour comprendre une authentification refusée : « ssh -vv hote » et lis les lignes « Offering public key » et « Authentications that can continue ».',
    'Ne retire pas une entrée de known_hosts par réflexe. Vérifie d’abord POURQUOI la clé a changé — réinstallation, ou quelqu’un au milieu.',
    'N’utilise jamais « StrictHostKeyChecking=no » pour faire passer une connexion : cela désactive la seule vérification qui protège d’un serveur substitué.',
  ],

  keywords: ['ssh', 'client', 'ssh -G', 'ssh_config', 'known_hosts', 'host key',
    'permission denied', 'connection refused', 'timed out', 'proxyjump',
    'batchmode', 'authentifications', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien : tout se lit dans le dossier personnel de la session, et c’est bien cette configuration-là qu’on diagnostique.',
    'Le nom ou l’adresse du serveur, et le port s’il n’est pas 22.',
    'Pour l’interrogation du serveur : un accès réseau vers l’hôte. C’est la seule chose que cet assistant fait sortir de la machine.',
  ],

  commonErrors: [
    {
      message: 'Bad owner or permissions on /home/x/.ssh/config',
      code: 'KJEMO',
      cause: 'ssh refuse un fichier de configuration accessible en écriture par le groupe ou par les autres.',
      fix: 'Remettre le fichier en 600.',
      command: 'chmod 600 ~/.ssh/config',
    },
    {
      message: 'Permission denied (publickey)',
      code: 'KJEMO',
      cause: 'Le serveur n’accepte que les clés, et aucune clé présentée n’a été acceptée — souvent à cause des permissions côté serveur, que StrictModes contrôle.',
      fix: 'Voir ce que le client propose, puis les permissions du compte distant.',
      command: 'ssh -vv hote 2>&1 | grep -iE "offering|authentications that can continue"',
    },
    {
      message: 'WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED',
      code: 'KJEMO',
      cause: 'La clé d’hôte ne correspond plus. Deux explications : le serveur a été réinstallé, ou quelqu’un s’interpose. Les deux donnent le même message.',
      fix: 'Comparer l’empreinte avec celle relevée sur le serveur, PUIS seulement retirer l’entrée.',
      command: 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub   # a executer SUR le serveur',
    },
    {
      message: 'Could not resolve hostname',
      code: 'KJEMO',
      cause: 'Le nom ne résout pas. La connexion n’a pas été tentée : ce n’est pas un problème SSH.',
      fix: 'Diagnostiquer la résolution de noms.',
      command: 'getent hosts monserveur',
    },
    {
      message: 'La connexion part vers une autre machine que celle demandée',
      code: 'KJEMO',
      cause: 'Une entrée de ~/.ssh/config, souvent avec un joker, redirige l’hôte ou impose un rebond.',
      fix: 'Lire la configuration effective plutôt que le fichier.',
      command: 'ssh -G monserveur | grep -E "^(hostname|user|port|proxyjump)"',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport donne la configuration EFFECTIVE (ssh -G), et signale tout écart entre l’hôte ou le port demandé et celui qui s’appliquera.',
    'Un ProxyCommand ou un ProxyJump est signalé : il change le chemin, donc le diagnostic.',
    'Les permissions de ~/.ssh et de ~/.ssh/config sont mesurées, et un mode refusé par ssh est signalé PROBLEME.',
    'La présence de l’hôte dans known_hosts est établie par « ssh-keygen -F », qui trouve aussi les entrées hachées.',
    'Si l’interrogation a été demandée : la liste des authentifications proposées par le serveur figure dans le rapport, sans qu’aucune ait été présentée.',
    'Les trois échecs réseau sont distingués : refus, délai, clé d’hôte.',
    'Aucune clé d’hôte acceptée, aucune clé privée lue, aucune écriture.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit, et la seule chose qu’il fait sortir de la machine est une connexion TCP qui ne présente aucune authentification.',
    diagnostic: `# Ce que ssh fera reellement :
ssh -G monserveur | grep -E '^(hostname|user|port|identityfile|proxyjump)'
# Ce que le serveur accepte, sans rien presenter :
ssh -o BatchMode=yes -o PreferredAuthentications=none monserveur exit`,
    command: `# Aucune modification a annuler.
#
# Si une entree de known_hosts est reellement perimee — et APRES avoir
# compare l empreinte avec celle relevee sur le serveur lui-meme :
#   ssh-keygen -R monserveur
#
# Si les permissions bloquent :
#   chmod 700 ~/.ssh
#   chmod 600 ~/.ssh/config
#
# Ne mets JAMAIS StrictHostKeyChecking=no pour faire passer une
# connexion : c est la seule verification qui distingue le vrai serveur
# d un serveur substitue.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Retirer une entrée de known_hosts sans avoir vérifié pourquoi la clé a changé, c’est accepter sans regarder exactement ce que la vérification devait empêcher.',
  },

  checks: [
    'Aucune écriture : ni ~/.ssh/config, ni known_hosts, ni correction de permissions.',
    'Aucune clé privée lue : « ssh -G » ne cite que des noms de fichiers d’identité, et kjemo_empreinte refuse tout chemin non public.',
    'StrictHostKeyChecking=yes est imposé au test : une clé d’hôte inconnue fait échouer le test, et ce n’est pas un défaut mais le but.',
    '« accept-new » n’apparaît nulle part : accepter une clé est une décision de confiance, et elle ne se prend pas dans un script.',
    'PreferredAuthentications=none : aucune authentification n’est présentée, aucun mot de passe, aucune clé.',
    'BatchMode=yes : aucune invite, donc le script ne peut pas rester bloqué à attendre une saisie.',
    'La configuration effective est lue avec « ssh -G », pas en analysant ~/.ssh/config : les jokers et l’ordre des entrées rendent la lecture à la main trompeuse.',
    'La cible est construite une seule fois dans le script : deux constructions différentes diagnostiqueraient autre chose que ce qui est testé.',
    'Un nom d’hôte commençant par « - » est refusé par le formulaire : ssh l’analyserait comme une option, et c’est un piège d’analyse d’arguments que la citation shell ne couvre pas.',
    'Les trois échecs réseau sont nommés séparément, avec la raison pour laquelle un refus et un délai ne disent pas la même chose.',
  ],

  source: `${M}/man1/ssh.1.html`,
  sources: [
    { label: 'ssh(1) — l’option -G', url: `${M}/man1/ssh.1.html` },
    { label: 'ssh_config(5) — première valeur obtenue, Host, ProxyJump', url: `${M}/man5/ssh_config.5.html` },
    { label: 'ssh-keygen(1) — -F, -R, -l', url: `${M}/man1/ssh-keygen.1.html` },
    { label: 'sshd_config(5) — PasswordAuthentication, valeur par défaut', url: `${M}/man5/sshd_config.5.html` },
  ],
};

// ===========================================================================
// 3. ssh-key-readiness
// ===========================================================================
//
// « Ma clé est dans authorized_keys et il me demande quand même un mot de
// passe. » C'est presque toujours StrictModes : sshd_config(5) le décrit comme
// vérifiant « file modes and ownership of the user's files and home
// directory before accepting login », et sa valeur par défaut est yes. Un
// dossier personnel accessible en écriture au groupe suffit à faire refuser
// une clé parfaitement valide — et le client, lui, affiche « Permission
// denied (publickey) », ce qui envoie chercher une erreur de clé inexistante.
//
// L'assistant mesure donc la CHAÎNE de permissions, et jamais le contenu
// d'une clé privée.

const sshKeyReadiness = {
  id: 'ssh-key-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'SSH et accès distant',
  title: 'Vérifier que l’authentification par clé peut fonctionner',
  risk: 'diagnostic',
  summary: 'Mesure la chaîne de permissions que StrictModes contrôle — dossier personnel, ~/.ssh, authorized_keys — parce qu’un seul maillon trop ouvert fait refuser une clé valide, et que le client affiche alors « Permission denied (publickey) » sans rien dire des permissions. Compte les clés autorisées et calcule leurs empreintes. NE LIT JAMAIS une clé privée : seuls les noms et les modes des fichiers privés apparaissent.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'openssh-client — ssh-keygen (présent par défaut)',
    'libc-bin — getent (présent par défaut)',
    'coreutils — stat (présent par défaut)',
  ],
  privileges: 'aucun pour le compte de la session. Pour auditer le compte d’un AUTRE utilisateur, root est nécessaire — son dossier ~/.ssh est en 700, et c’est précisément ce qu’on vérifie : sans root, la section est annoncée IGNORE',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'aucun',
  limites: [
    'NE LIT JAMAIS une clé privée, et ne la copie nulle part. Le rapport ne contient que des NOMS de fichiers privés et leurs MODES. Une fonction du script refuse tout chemin qui n’est ni .pub, ni authorized_keys, ni known_hosts, et le refus est consigné plutôt que silencieux.',
    'Ne corrige aucune permission. Un chmod sur un dossier personnel touche tout ce qu’il contient, et le compte n’appartient pas forcément à celui qui lance le script : les commandes exactes sont affichées, à taper soi-même.',
    'Ne génère aucune clé. Une clé privée se crée avec une phrase de passe, et une phrase de passe se tape — elle n’entre pas dans un formulaire, et aucun formulaire de ce lot n’a de champ de secret.',
    'Ne dit pas si une clé privée porte une phrase de passe : le savoir exigerait de la lire. C’est une limite assumée, et non un contrôle oublié.',
    'Ne déduit rien de la force des clés au-delà de leur type et de leur taille, tels que ssh-keygen les rapporte.',
  ],

  fields: [
    {
      id: 'compte',
      label: 'Compte à vérifier (vide = celui de la session)',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Le compte dont on veut prouver que la connexion par clé peut aboutir. Auditer un autre compte que le sien demande root : son dossier ~/.ssh est en 700, et c’est justement ce qu’on vérifie.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const c = String(v.compte ?? '').trim();
    if (c !== '') {
      const r = validateNomUtilisateur(c, 'Le compte à vérifier');
      if (!r.ok) errors.compte = r.error;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const compte = String(v.compte ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Verifier que l authentification par cle peut fonctionner',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'auditer le dossier ~/.ssh d un autre compte demande root',
      }),
      ...fonctionEmpreinteBash(),
      ...blocVariablesBash([
        ['KJEMO_COMPTE_DEMANDE', shQuote(compte)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 0 - LE COMPTE, ET SON VRAI DOSSIER PERSONNEL',
      '#',
      '# Le dossier personnel se lit dans la base des comptes, jamais devine a',
      '# partir du nom : /home/<nom> est une convention, pas une regle, et un',
      '# compte de service ou un compte migre n y est pas.',
      '# ---------------------------------------------------------------------------',
      'if [ -n "${KJEMO_COMPTE_DEMANDE}" ]; then',
      '  KJEMO_COMPTE="${KJEMO_COMPTE_DEMANDE}"',
      'else',
      '  KJEMO_COMPTE="$(id -un)"',
      'fi',
      "KJEMO_LIGNE=''",
      'if kjemo_dispo getent; then',
      '  KJEMO_LIGNE="$(getent passwd -- "${KJEMO_COMPTE}" 2>/dev/null || true)"',
      'fi',
      'if [ -z "${KJEMO_LIGNE}" ]; then',
      "  kjemo_resultat 'Compte' \"${KJEMO_COMPTE}\" 'PROBLEME' 'inconnu' \\",
      '    "Le compte ${KJEMO_COMPTE} n existe pas dans la base des comptes. Rien d autre ne peut etre verifie : une cle autorisee pour un compte inexistant n autorise personne."',
      '  KJEMO_MAISON=\'\'',
      'else',
      '  KJEMO_MAISON="$(printf \'%s\\n\' "${KJEMO_LIGNE}" | cut -d: -f6)"',
      '  KJEMO_SHELL="$(printf \'%s\\n\' "${KJEMO_LIGNE}" | cut -d: -f7)"',
      "  kjemo_resultat 'Compte' \"${KJEMO_COMPTE}\" 'INFO' \"maison=${KJEMO_MAISON} shell=${KJEMO_SHELL}\" \\",
      '    "Dossier personnel : ${KJEMO_MAISON}. Interpreteur de connexion : ${KJEMO_SHELL}."',
      '  case "${KJEMO_SHELL}" in',
      '    */nologin|*/false)',
      "      kjemo_resultat 'Compte' 'Interpreteur' 'ATTENTION' \"${KJEMO_SHELL}\" \\",
      '        "L interpreteur de ce compte est ${KJEMO_SHELL} : meme avec une cle valide et des permissions correctes, la session se fermera immediatement. Ce n est pas une erreur de cle, et aucun reglage de SSH ne la corrige."',
      '      ;;',
      '  esac',
      'fi',
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Compte audite' \"${KJEMO_COMPTE}\"",
      "  printf '%s\\t%s\\n' 'Dossier personnel' \"${KJEMO_MAISON:-inconnu}\"",
      "  printf '%s\\t%s\\n' 'Cles privees' 'JAMAIS LUES - noms et modes seulement'",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - aucune permission corrigee, aucune cle generee'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LA CHAINE QUE STRICTMODES CONTROLE',
      '#',
      '# sshd_config(5), StrictModes : « should check file modes and ownership of',
      '# the user s files and home directory before accepting login », et « The',
      '# default is yes ». Trois maillons, et UN SEUL trop ouvert suffit :',
      '#',
      '#   le dossier personnel  ne doit pas etre accessible en ecriture par le',
      '#                         groupe ni par les autres. 755 va, 775 ne va pas,',
      '#                         et c est le cas le plus frequent — un chmod 775',
      '#                         pose pour partager un dossier casse SSH sans',
      '#                         aucun rapport apparent.',
      '#   ~/.ssh                700 attendu.',
      '#   authorized_keys       600 attendu, et appartenant au compte.',
      '#',
      '# Le symptome, cote client, est « Permission denied (publickey) ». Il ne',
      '# parle jamais de permissions. Le serveur, lui, ecrit dans son journal',
      '# « Authentication refused: bad ownership or modes for directory ... ».',
      '# ---------------------------------------------------------------------------',
      'KJEMO_CHAINE_OK=1',
      'KJEMO_LISIBLE=1',
      'if [ -n "${KJEMO_MAISON}" ] && [ -d "${KJEMO_MAISON}" ]; then',
      '  KJEMO_M_MAISON="$(stat -c \'%a %U:%G\' -- "${KJEMO_MAISON}" 2>/dev/null || true)"',
      '  KJEMO_OCTAL="$(printf \'%s\' "${KJEMO_M_MAISON}" | cut -d\' \' -f1)"',
      '  # Le chiffre du groupe et celui des autres : le bit 2 est l ecriture.',
      '  KJEMO_G=$(( $(printf \'%s\' "${KJEMO_OCTAL}" | cut -c2) ))',
      '  KJEMO_A=$(( $(printf \'%s\' "${KJEMO_OCTAL}" | cut -c3) ))',
      '  if [ $(( KJEMO_G & 2 )) -ne 0 ] || [ $(( KJEMO_A & 2 )) -ne 0 ]; then',
      '    KJEMO_CHAINE_OK=0',
      "    kjemo_resultat 'StrictModes' 'Dossier personnel' 'PROBLEME' \"${KJEMO_M_MAISON}\" \\",
      '      "Le dossier ${KJEMO_MAISON} est accessible en ECRITURE par le groupe ou par les autres (${KJEMO_M_MAISON}). StrictModes refusera toute cle de ce compte, et le client affichera « Permission denied (publickey) » sans jamais parler de permissions. Correction a la main : chmod go-w ${KJEMO_MAISON}"',
      '  else',
      "    kjemo_resultat 'StrictModes' 'Dossier personnel' 'OK' \"${KJEMO_M_MAISON}\" \\",
      '      "Ni le groupe ni les autres ne peuvent ecrire dans ${KJEMO_MAISON} : premier maillon correct."',
      '  fi',
      'elif [ -n "${KJEMO_MAISON}" ]; then',
      '  KJEMO_CHAINE_OK=0',
      "  kjemo_resultat 'StrictModes' 'Dossier personnel' 'PROBLEME' 'absent' \\",
      '    "Le dossier personnel ${KJEMO_MAISON} n existe pas. sshd ne trouvera donc ni ~/.ssh ni authorized_keys, et la connexion par cle est impossible."',
      'fi',
      '',
      'KJEMO_DOSSIER_SSH="${KJEMO_MAISON}/.ssh"',
      'KJEMO_AUTORISEES="${KJEMO_DOSSIER_SSH}/authorized_keys"',
      'if [ -n "${KJEMO_MAISON}" ] && [ ! -r "${KJEMO_DOSSIER_SSH}" ] && [ -e "${KJEMO_DOSSIER_SSH}" ]; then',
      '  KJEMO_LISIBLE=0',
      "  kjemo_resultat 'StrictModes' 'Dossier .ssh' 'IGNORE' 'illisible depuis cette session' \\",
      '    "Le dossier ${KJEMO_DOSSIER_SSH} existe mais n est pas lisible depuis cette session — ce qui est exactement ce qu on attend d un 700 appartenant a un autre compte. Relance avec sudo pour auditer ce compte. Ce rapport ne conclut RIEN sur ses cles."',
      'elif [ -n "${KJEMO_MAISON}" ] && [ -d "${KJEMO_DOSSIER_SSH}" ]; then',
      '  KJEMO_M_SSH="$(stat -c \'%a %U:%G\' -- "${KJEMO_DOSSIER_SSH}" 2>/dev/null || true)"',
      '  case "${KJEMO_M_SSH}" in',
      '    700*)',
      "      kjemo_resultat 'StrictModes' 'Dossier .ssh' 'OK' \"${KJEMO_M_SSH}\" \\",
      '        "Mode 700 sur ${KJEMO_DOSSIER_SSH} : deuxieme maillon correct."',
      '      ;;',
      '    *)',
      '      KJEMO_CHAINE_OK=0',
      "      kjemo_resultat 'StrictModes' 'Dossier .ssh' 'PROBLEME' \"${KJEMO_M_SSH}\" \\",
      '        "Mode inattendu sur ${KJEMO_DOSSIER_SSH} : ${KJEMO_M_SSH}, alors que 700 est attendu. Correction a la main : chmod 700 ${KJEMO_DOSSIER_SSH}"',
      '      ;;',
      '  esac',
      'elif [ -n "${KJEMO_MAISON}" ]; then',
      '  KJEMO_CHAINE_OK=0',
      "  kjemo_resultat 'StrictModes' 'Dossier .ssh' 'PROBLEME' 'absent' \\",
      '    "Le dossier ${KJEMO_DOSSIER_SSH} n existe pas : aucune cle ne peut etre autorisee pour ce compte. Il se cree avec « mkdir -m 700 ~/.ssh », ou automatiquement par ssh-copy-id."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LES CLES AUTORISEES',
      '#',
      '# authorized_keys contient des cles PUBLIQUES : les compter et calculer',
      '# leurs empreintes ne divulgue rien. C est d ailleurs l interet — une',
      '# empreinte se compare avec celle du poste client, et c est ainsi qu on',
      '# verifie que la bonne cle est bien en place.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_CLES_OK=0',
      'KJEMO_NB_AUTORISEES=0',
      'if [ "${KJEMO_LISIBLE}" -eq 1 ] && [ -r "${KJEMO_AUTORISEES}" ]; then',
      '  KJEMO_M_AUTH="$(stat -c \'%a %U:%G\' -- "${KJEMO_AUTORISEES}" 2>/dev/null || true)"',
      '  KJEMO_OCT_AUTH="$(printf \'%s\' "${KJEMO_M_AUTH}" | cut -d\' \' -f1)"',
      '  KJEMO_GA=$(( $(printf \'%s\' "${KJEMO_OCT_AUTH}" | cut -c2) ))',
      '  KJEMO_AA=$(( $(printf \'%s\' "${KJEMO_OCT_AUTH}" | cut -c3) ))',
      '  if [ $(( KJEMO_GA & 2 )) -ne 0 ] || [ $(( KJEMO_AA & 2 )) -ne 0 ]; then',
      '    KJEMO_CHAINE_OK=0',
      "    kjemo_resultat 'StrictModes' 'authorized_keys' 'PROBLEME' \"${KJEMO_M_AUTH}\" \\",
      '      "Le fichier ${KJEMO_AUTORISEES} est accessible en ECRITURE par le groupe ou par les autres (${KJEMO_M_AUTH}). StrictModes le refuse — et pour une bonne raison : qui peut y ecrire peut s autoriser lui-meme. Correction a la main : chmod 600 ${KJEMO_AUTORISEES}"',
      '  else',
      "    kjemo_resultat 'StrictModes' 'authorized_keys' 'OK' \"${KJEMO_M_AUTH}\" \\",
      '      "Mode acceptable sur ${KJEMO_AUTORISEES} (${KJEMO_M_AUTH}) : troisieme maillon correct."',
      '  fi',
      '  # Les lignes utiles : ni vides, ni commentaires.',
      '  KJEMO_NB_AUTORISEES="$(grep -cvE \'^[[:space:]]*($|#)\' -- "${KJEMO_AUTORISEES}" 2>/dev/null || printf \'%s\' 0)"',
      '  if [ "${KJEMO_NB_AUTORISEES}" -gt 0 ]; then',
      '    KJEMO_CLES_OK=1',
      "    KJEMO_EMPREINTES=\"$(kjemo_empreinte \"${KJEMO_AUTORISEES}\" | head -20 | paste -sd'; ' - || printf '%s' 'non calculees')\"",
      "    kjemo_resultat 'Cles autorisees' 'Inventaire' 'INFO' \"${KJEMO_NB_AUTORISEES} cle(s)\" \\",
      '      "${KJEMO_NB_AUTORISEES} cle(s) autorisee(s) pour ${KJEMO_COMPTE}. Empreintes PUBLIQUES : ${KJEMO_EMPREINTES}. Compare-les avec « ssh-keygen -lf ~/.ssh/id_ed25519.pub » sur le poste client : c est ainsi qu on verifie que la bonne cle est en place, et non en relisant la cle a l oeil."',
      '    # Les options de restriction, quand il y en a : c est une bonne',
      '    # pratique, et il faut la reconnaitre plutot que la signaler comme un',
      '    # defaut.',
      '    if grep -qE \'^(command=|restrict|no-pty|from=)\' -- "${KJEMO_AUTORISEES}" 2>/dev/null; then',
      "      kjemo_resultat 'Cles autorisees' 'Restrictions' 'INFO' 'presentes' \\",
      "        'Au moins une cle porte des options de restriction — command=, restrict, from=, no-pty. C est une bonne pratique : une cle de sauvegarde n a pas besoin d un interpreteur. Attention en revanche au diagnostic : une telle cle se connecte et ne donne pas de shell, ce qui ressemble a une panne.'",
      '    fi',
      '  else',
      "    kjemo_resultat 'Cles autorisees' 'Inventaire' 'PROBLEME' 'fichier vide' \\",
      '      "Le fichier ${KJEMO_AUTORISEES} existe mais ne contient aucune cle utile. L authentification par cle ne peut pas aboutir pour ${KJEMO_COMPTE} : c est le mot de passe, ou rien."',
      '  fi',
      'elif [ "${KJEMO_LISIBLE}" -eq 1 ] && [ -n "${KJEMO_MAISON}" ]; then',
      "  kjemo_resultat 'Cles autorisees' 'Inventaire' 'PROBLEME' 'absent' \\",
      '    "Aucun fichier ${KJEMO_AUTORISEES}. Tant qu il n existe pas, couper l authentification par mot de passe enfermerait ${KJEMO_COMPTE} dehors — et c est exactement la verification que fait l assistant ssh-hardening-audit avant de preparer quoi que ce soit."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LES CLES PRIVEES : LES NOMS ET LES MODES, RIEN D AUTRE',
      '#',
      '# Aucune lecture de contenu. ssh REFUSE une cle privee accessible par le',
      '# groupe ou par les autres, avec « UNPROTECTED PRIVATE KEY FILE », et',
      '# c est une protection, pas une tracasserie : une cle privee lisible par',
      '# tous n est plus privee.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_LISIBLE}" -eq 1 ] && [ -d "${KJEMO_DOSSIER_SSH}" ]; then',
      '  # Le motif non developpe — quand aucun fichier id_* n existe — est',
      '  # ecarte par le test -f, et non par une comparaison de chaine : c est',
      '  # la seule facon qui ne depende pas de la forme du motif.',
      '  for kjemo_priv in "${KJEMO_DOSSIER_SSH}"/id_*; do',
      '    case "${kjemo_priv}" in',
      '      *.pub) continue ;;',
      '    esac',
      '    if [ -f "${kjemo_priv}" ]; then',
      '      KJEMO_M_PRIV="$(stat -c \'%a %U:%G\' -- "${kjemo_priv}" 2>/dev/null || true)"',
      '      KJEMO_OCT_PRIV="$(printf \'%s\' "${KJEMO_M_PRIV}" | cut -d\' \' -f1)"',
      '      case "${KJEMO_OCT_PRIV}" in',
      '        600|400)',
      "          kjemo_resultat 'Cles privees' \"${kjemo_priv##*/}\" 'OK' \"${KJEMO_M_PRIV}\" \\",
      '          "Mode ${KJEMO_M_PRIV} : correct. Le CONTENU de ce fichier n a pas ete lu, et ne le sera pas — seuls son nom et son mode apparaissent dans ce rapport."',
      '          ;;',
      '        *)',
      "          kjemo_resultat 'Cles privees' \"${kjemo_priv##*/}\" 'PROBLEME' \"${KJEMO_M_PRIV}\" \\",
      '          "Mode ${KJEMO_M_PRIV} sur une cle PRIVEE, alors que 600 est attendu. ssh refusera de l utiliser en affichant « UNPROTECTED PRIVATE KEY FILE », et il a raison : une cle privee lisible par d autres comptes doit etre consideree comme compromise, donc remplacee et non seulement reprotegee. Correction du mode a la main : chmod 600 ${kjemo_priv}"',
      '          ;;',
      '      esac',
      '    fi',
      '  done',
      "  kjemo_resultat 'Cles privees' 'Phrase de passe' 'IGNORE' 'non verifiable sans lire la cle' \\",
      "    'Savoir si une cle privee porte une phrase de passe exigerait de la LIRE. Ce script ne le fait pas, et ce n est pas un controle oublie : c est la limite que s impose un outil qui produit un rapport destine a etre copie dans un courriel.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT, PUIS LA PROCEDURE MANUELLE',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_LISIBLE}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Connexion par cle' 'IGNORE' 'non concluante' \\",
      '    "Le dossier ~/.ssh de ${KJEMO_COMPTE} n a pas pu etre lu depuis cette session : aucun verdict. Relance avec sudo."',
      'elif [ "${KJEMO_CLES_OK}" -eq 1 ] && [ "${KJEMO_CHAINE_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Connexion par cle' 'OK' 'possible' \\",
      '    "${KJEMO_NB_AUTORISEES} cle(s) autorisee(s), et la chaine de permissions que StrictModes contrôle est correcte de bout en bout. L authentification par cle PEUT aboutir pour ${KJEMO_COMPTE} — ce qui est la condition prealable a tout durcissement."',
      'elif [ "${KJEMO_CLES_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Connexion par cle' 'PROBLEME' 'cles presentes, permissions refusees' \\",
      '    "Des cles sont autorisees pour ${KJEMO_COMPTE}, et StrictModes les REFUSERA a cause des permissions signalees plus haut. C est le piege exact : la cle est bonne, le client dit « Permission denied (publickey) », et personne ne va regarder les modes. Ne coupe surtout pas l authentification par mot de passe dans cet etat."',
      'else',
      "  kjemo_resultat 'Verdict' 'Connexion par cle' 'PROBLEME' 'aucune cle utilisable' \\",
      '    "Aucune cle utilisable pour ${KJEMO_COMPTE}. Couper l authentification par mot de passe maintenant enfermerait ce compte dehors. La procedure affichee ci-dessous met une cle en place, dans le bon ordre."',
      'fi',
      '',
      "printf '\\n%s\\n' '=============================================================='",
      "printf '%s\\n' 'METTRE UNE CLE EN PLACE - PROCEDURE MANUELLE, DANS CET ORDRE'",
      "printf '%s\\n' '=============================================================='",
      "printf '%s\\n' ''",
      "printf '%s\\n' '1. SUR LE POSTE CLIENT, cree la paire de cles. La phrase de'",
      "printf '%s\\n' '   passe se tape : elle n entre dans aucun formulaire, et'",
      "printf '%s\\n' '   aucun script de ce projet ne la demande.'",
      "printf '%s\\n' '     ssh-keygen -t ed25519 -C \"mon-poste\"'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '2. Releve l empreinte de la cle PUBLIQUE, pour pouvoir la'",
      "printf '%s\\n' '   comparer ensuite avec ce que le serveur aura enregistre :'",
      "printf '%s\\n' '     ssh-keygen -lf ~/.ssh/id_ed25519.pub'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '3. Copie la cle PUBLIQUE vers le serveur. ssh-copy-id cree'",
      "printf '%s\\n' '   ~/.ssh avec le bon mode et AJOUTE la cle sans ecraser les'",
      "printf '%s\\n' '   autres — ce qu une redirection vers authorized_keys ne'",
      "printf '%s\\n' '   fait pas, et c est ainsi qu on perd les cles existantes :'",
      'printf \'%s\\n\' "     ssh-copy-id ${KJEMO_COMPTE}@<serveur>"',
      "printf '%s\\n' ''",
      "printf '%s\\n' '4. EPROUVE la connexion par cle, en gardant la session'",
      "printf '%s\\n' '   actuelle ouverte, depuis un SECOND terminal :'",
      'printf \'%s\\n\' "     ssh -o PreferredAuthentications=publickey ${KJEMO_COMPTE}@<serveur>"',
      "printf '%s\\n' ''",
      "printf '%s\\n' '5. SEULEMENT si l etape 4 a reussi, et jamais avant, le'",
      "printf '%s\\n' '   durcissement peut etre envisage. L assistant'",
      "printf '%s\\n' '   ssh-hardening-audit refuse de preparer quoi que ce soit'",
      "printf '%s\\n' '   tant que cette preuve n est pas faite.'",
      "printf '%s\\n' ''",
      "printf '%s\\n' 'Ce que ce script n a PAS fait : il n a genere aucune cle, lu'",
      "printf '%s\\n' 'aucune cle privee, corrige aucune permission.'",
      "printf '%s\\n' '=============================================================='",
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucune permission corrigee, aucune cle generee, aucun authorized_keys modifie. Aucune cle privee lue.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-ssh-cles' }),
    ]);
  },

  gui: [
    'Le coupable, dans neuf cas sur dix : StrictModes. Un dossier personnel en 775 fait refuser une clé parfaitement valide.',
    'Mesure la chaîne entière : « stat -c \'%a %U:%G\' ~ ~/.ssh ~/.ssh/authorized_keys ». Un seul maillon trop ouvert suffit.',
    'Les modes attendus : dossier personnel sans écriture pour le groupe ni les autres, ~/.ssh en 700, authorized_keys en 600.',
    'Le message côté client, « Permission denied (publickey) », ne parle jamais de permissions. Le serveur, lui, le dit : « sudo journalctl -u ssh | grep -i "bad ownership" ».',
    'Compare les empreintes plutôt que les clés : « ssh-keygen -lf ~/.ssh/id_ed25519.pub » sur le client, « ssh-keygen -lf ~/.ssh/authorized_keys » sur le serveur.',
    'Copie la clé avec « ssh-copy-id » : il crée ~/.ssh avec le bon mode et AJOUTE la clé. Une redirection « >> » mal tapée devient « > » et efface les autres.',
    'Ne regarde jamais le contenu d’une clé privée, et ne l’envoie nulle part. Seule la clé .pub se copie.',
    'Une clé privée en 644 doit être considérée comme compromise : on la remplace, on ne se contente pas de corriger le mode.',
    'Éprouve la connexion par clé depuis un second terminal AVANT de couper l’authentification par mot de passe. Jamais après.',
  ],

  keywords: ['ssh', 'cle', 'clef', 'key', 'authorized_keys', 'strictmodes',
    'permissions', 'publickey', 'ssh-keygen', 'ssh-copy-id', 'empreinte',
    'fingerprint', 'ed25519', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour auditer le compte de la session.',
    'sudo pour auditer un AUTRE compte : son ~/.ssh est en 700, et c’est précisément ce qu’on vérifie. Sans sudo, la section est annoncée IGNORE et le rapport ne conclut rien.',
    'Le nom du compte, s’il n’est pas celui de la session.',
  ],

  commonErrors: [
    {
      message: 'Permission denied (publickey) alors que la clé est bien dans authorized_keys',
      code: 'KJEMO',
      cause: 'StrictModes refuse la clé à cause des modes du dossier personnel ou de ~/.ssh. La clé est bonne ; c’est la chaîne de permissions qui ne l’est pas.',
      fix: 'Mesurer les trois maillons, puis corriger celui qui est trop ouvert.',
      command: 'stat -c \'%a %U:%G\' ~ ~/.ssh ~/.ssh/authorized_keys',
    },
    {
      message: 'Authentication refused: bad ownership or modes for directory',
      code: 'KJEMO',
      cause: 'Le message exact, et il n’existe que dans le journal du serveur.',
      fix: 'Retirer l’écriture au groupe et aux autres sur le dossier personnel.',
      command: 'chmod go-w ~',
    },
    {
      message: 'UNPROTECTED PRIVATE KEY FILE',
      code: 'KJEMO',
      cause: 'Une clé privée est lisible par d’autres comptes. ssh refuse de l’utiliser.',
      fix: 'Considérer la clé comme compromise : en générer une nouvelle, et ne pas se contenter de corriger le mode.',
      command: 'ssh-keygen -t ed25519 -C "nouvelle-cle"',
    },
    {
      message: 'J’ai copié ma clé et les clés des collègues ont disparu',
      code: 'KJEMO',
      cause: 'Une redirection « > » au lieu de « >> » : authorized_keys a été remplacé au lieu d’être complété.',
      fix: 'Utiliser ssh-copy-id, qui ajoute.',
      command: 'ssh-copy-id utilisateur@serveur',
    },
    {
      message: 'La connexion réussit mais se ferme aussitôt',
      code: 'KJEMO',
      cause: 'L’interpréteur du compte est /usr/sbin/nologin, ou la clé porte une option command= qui ne donne pas de shell.',
      fix: 'Lire l’interpréteur du compte et les options de la clé.',
      command: 'getent passwd utilisateur | cut -d: -f7',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le dossier personnel vient de la base des comptes, et n’est pas deviné à partir du nom.',
    'Les trois maillons de StrictModes sont mesurés séparément, et celui qui échoue est nommé avec son mode réel.',
    'Le nombre de clés autorisées est compté sur les lignes utiles, commentaires et lignes vides exclus.',
    'Les empreintes publiques figurent dans le rapport, avec la commande qui permet de les comparer côté client.',
    'Les clés privées apparaissent par leur NOM et leur MODE seulement — jamais leur contenu.',
    'L’impossibilité de savoir si une clé privée porte une phrase de passe est annoncée IGNORE, comme une limite assumée.',
    'Le verdict distingue « aucune clé » de « clés présentes mais permissions refusées » : ce ne sont pas les mêmes corrections.',
    'Auditer un autre compte sans root donne IGNORE, et non OK.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne corrige aucune permission, et c’est volontaire — un chmod sur un dossier personnel touche tout ce qu’il contient, et le compte audité n’appartient pas forcément à celui qui lance le script.',
    diagnostic: `# La chaine entiere, d un seul coup :
stat -c '%a %U:%G' ~ ~/.ssh ~/.ssh/authorized_keys
# Les empreintes des cles autorisees :
ssh-keygen -lf ~/.ssh/authorized_keys`,
    command: `# Aucune modification a annuler.
#
# Les corrections, a taper soi-meme, dans cet ordre :
#   chmod go-w ~
#   chmod 700 ~/.ssh
#   chmod 600 ~/.ssh/authorized_keys
#
# Pour mettre une cle en place, depuis le POSTE CLIENT :
#   ssh-keygen -t ed25519 -C "mon-poste"
#   ssh-copy-id utilisateur@serveur
#   ssh -o PreferredAuthentications=publickey utilisateur@serveur
#
# Une cle privee qui a ete lisible par d autres comptes se REMPLACE.
# Corriger son mode ne la rend pas a nouveau secrete.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Ne coupe pas l’authentification par mot de passe tant que la connexion par clé n’a pas réussi depuis un second terminal.',
  },

  checks: [
    'Aucune clé privée lue : kjemo_empreinte refuse tout chemin qui n’est ni .pub, ni authorized_keys, ni known_hosts, et consigne le refus.',
    'Les clés privées n’apparaissent que par leur nom et leur mode.',
    'Aucune écriture : aucune permission corrigée, aucune clé générée, aucun authorized_keys modifié.',
    'Aucune clé générée par le script : une phrase de passe se tape, et aucun formulaire du lot n’a de champ de secret.',
    'Le dossier personnel est lu dans la base des comptes : /home/<nom> est une convention, pas une règle.',
    'Les bits d’écriture du groupe et des autres sont testés par un ET binaire sur le chiffre octal, et non par une liste de modes « connus ».',
    'Un ~/.ssh illisible depuis la session donne IGNORE : c’est le comportement attendu d’un 700 appartenant à un autre compte, et non un contrôle réussi.',
    'Les options de restriction des clés (command=, restrict, from=) sont reconnues comme une bonne pratique, et leur effet sur le diagnostic est expliqué.',
    'Un interpréteur /usr/sbin/nologin est signalé : aucune clé ne corrige cela.',
    'La procédure manuelle met l’épreuve de la connexion par clé AVANT tout durcissement, et le dit explicitement.',
  ],

  source: `${M}/man5/sshd_config.5.html`,
  sources: [
    { label: 'sshd_config(5) — StrictModes, AuthorizedKeysFile', url: `${M}/man5/sshd_config.5.html` },
    { label: 'ssh-keygen(1) — -l, -f', url: `${M}/man1/ssh-keygen.1.html` },
    { label: 'ssh-copy-id(1)', url: `${M}/man1/ssh-copy-id.1.html` },
    { label: 'sshd(8) — AUTHORIZED_KEYS FILE FORMAT', url: `${M}/man8/sshd.8.html` },
  ],
};

// ===========================================================================
// 4. ssh-hardening-audit
// ===========================================================================
//
// Le seul des quatre qui écrit un fichier — dans le dossier personnel, et
// nulle part ailleurs. Il audite la configuration effective contre les valeurs
// par défaut officielles, et ne PRÉPARE un fichier additionnel qu'après avoir
// prouvé lui-même qu'un second accès administrateur fonctionne.
//
// ---------------------------------------------------------------------------
// LE PIÈGE QUE LA PAGE DE MANUEL NOMME ELLE-MÊME
// ---------------------------------------------------------------------------
// `PasswordAuthentication no` ne suffit PAS à fermer l'entrée par mot de
// passe. sshd_config(5) décrit `KbdInteractiveAuthentication` avec « The
// default is yes », et l'entrée `UsePAM` dit, textuellement : « Because PAM
// keyboard-interactive authentication usually serves an equivalent role to
// password authentication, you should disable either PasswordAuthentication or
// KbdInteractiveAuthentication ». Le paquet openssh-server de Debian et
// d'Ubuntu active UsePAM.
//
// Autrement dit : couper le mot de passe et laisser le clavier-interactif
// ouvert donne un serveur qui redemande le même mot de passe par un autre
// chemin, tout en affichant une configuration qui a l'air durcie. Le fichier
// préparé pose donc les deux, et la relecture après installation le vérifie.

const sshHardeningAudit = {
  id: 'ssh-hardening-audit',
  icon: '◆',
  category: CAT,
  subcategory: 'SSH et accès distant',
  title: 'Auditer le durcissement SSH, et préparer un fichier additionnel validé',
  risk: 'caution',
  summary: 'Compare la configuration effective — lue par « sshd -T », donc fichiers additionnels compris — aux valeurs par défaut officielles d’OpenSSH, et explique pour chacune ce que l’écart change. Peut ensuite PRÉPARER un fichier additionnel pour /etc/ssh/sshd_config.d/, mais seulement après avoir prouvé qu’un second compte administrateur entre par clé : le fichier est écrit dans le dossier personnel, validé par « sshd -t », et son installation reste une suite de commandes à taper. /etc/ssh/sshd_config n’est jamais touché.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'openssh-server — sshd (apt install openssh-server)',
    'coreutils — stat, install (présents par défaut)',
  ],
  privileges: 'root : « sshd -T » et « sshd -t » contrôlent aussi la santé des clés d’hôte, qui sont en mode 600. Sans root, l’audit ne peut pas avoir lieu du tout — et le script s’arrête avant toute écriture plutôt que de rendre un rapport incomplet qui ressemblerait à un rapport',
  privilegesRequis: 'root',
  readOnly: false,
  service: 'ssh.service et ssh.socket',
  limites: [
    'N’ÉCRIT RIEN dans /etc/ssh. Le fichier préparé va dans le dossier personnel, et son installation est une commande à taper. Un script qui installe un durcissement SSH peut couper l’accès à la machine au moment où il le fait, et il n’y a alors plus personne pour revenir en arrière.',
    'NE REMPLACE JAMAIS /etc/ssh/sshd_config. Le durcissement passe par un fichier ADDITIONNEL : sshd_config(5) dit « For each keyword, the first obtained value will be used », et le fichier d’Ubuntu commence par « Include /etc/ssh/sshd_config.d/*.conf ». Le retour en arrière consiste donc à supprimer un fichier ajouté, non à restaurer un fichier réécrit.',
    'VÉRIFIE que la ligne Include existe. Si elle manque, un fichier additionnel serait purement ignoré, et le durcissement serait une illusion. Dans ce cas, rien n’est préparé.',
    'REFUSE de préparer quoi que ce soit si le second accès administrateur n’est pas prouvé : compte existant, membre d’un groupe d’administration, au moins une clé dans authorized_keys, et permissions acceptées par StrictModes. La preuve est faite par le script, pas déclarée par le formulaire.',
    'Ne touche pas aux fichiers additionnels existants, même pour les corriger : plusieurs fichiers qui se superposent sont un cas légitime autant qu’un accident.',
    'Ne lit aucune clé privée, et n’en génère aucune.',
    'Ne recharge pas le service. « systemctl reload ssh » est la commande qui met le durcissement en vigueur, et c’est exactement l’instant où un accès peut se perdre : elle figure dans la procédure, après « sshd -t ».',
  ],

  fields: [
    {
      id: 'compteAdminProuve',
      label: 'Compte administrateur à prouver (vide = audit seulement)',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Le compte qui devra pouvoir entrer par clé APRÈS le durcissement. Le script vérifie lui-même qu’il existe, qu’il est dans un groupe d’administration, qu’il a au moins une clé autorisée et que les permissions sont acceptées par StrictModes. Laissé vide, rien n’est préparé : l’assistant se contente d’auditer.',
    },
    {
      id: 'desactiverMotDePasse',
      label: 'Couper l’authentification par mot de passe',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Pose PasswordAuthentication no ET KbdInteractiveAuthentication no. Les deux, parce que couper le premier seul laisse ouverte la voie clavier-interactif, qui passe par PAM — la page de manuel sshd_config(5) le dit à l’entrée UsePAM.',
    },
    {
      id: 'interdireRoot',
      label: 'Interdire la connexion directe de root',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Pose PermitRootLogin no. La valeur par défaut d’OpenSSH est déjà prohibit-password : root ne peut pas entrer par mot de passe, mais peut entrer par clé. Passer à no ferme aussi la clé.',
    },
    {
      id: 'nomFichier',
      label: 'Nom du fichier additionnel',
      type: 'text',
      default: '99-kjemo-durcissement.conf',
      placeholder: '99-kjemo-durcissement.conf',
      help: 'Il doit finir par .conf : le fichier d’Ubuntu inclut « *.conf », et un fichier nommé autrement serait ignoré sans le moindre message. Le préfixe numérique fixe l’ordre de lecture.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le nom du compte administrateur',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Le verrou est dans le script, pas dans ce formulaire : sans cette phrase exacte, le script audite, prépare, valide, et ne laisse aucun fichier. Le nom demandé est celui du compte dont la perte t’enfermerait dehors.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const admin = String(v.compteAdminProuve ?? '').trim();
    if (admin !== '') {
      const r = validateNomUtilisateur(admin, 'Le compte administrateur');
      if (!r.ok) errors.compteAdminProuve = r.error;
    }
    const mdp = validateChoix(v.desactiverMotDePasse, ['Oui', 'Non'], 'La coupure du mot de passe');
    if (!mdp.ok) errors.desactiverMotDePasse = mdp.error;
    const rt = validateChoix(v.interdireRoot, ['Oui', 'Non'], 'L’interdiction de root');
    if (!rt.ok) errors.interdireRoot = rt.error;
    const nf = validateNomFichier(v.nomFichier, 'Le nom du fichier additionnel');
    if (!nf.ok) {
      errors.nomFichier = nf.error;
    } else if (!/\.conf$/.test(String(v.nomFichier).trim())) {
      errors.nomFichier = `« ${String(v.nomFichier).trim()} » ne finit pas par « .conf ». Le fichier d’Ubuntu inclut « /etc/ssh/sshd_config.d/*.conf » : un fichier nommé autrement serait ignoré sans le moindre message, et le durcissement n’aurait jamais lieu.`;
    }
    const demande = String(v.desactiverMotDePasse) === 'Oui' || String(v.interdireRoot) === 'Oui';
    if (demande && admin === '') {
      errors.compteAdminProuve = 'Un durcissement est demandé et aucun compte administrateur n’est nommé. Couper le mot de passe ou l’accès de root sans qu’un autre compte entre par clé, c’est s’enfermer dehors — et la seule issue est alors la console physique ou celle du superviseur de machines virtuelles. Nomme le compte : le script vérifiera lui-même qu’il peut entrer.';
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const admin = String(v.compteAdminProuve ?? '').trim();
    const coupeMdp = String(v.desactiverMotDePasse) === 'Oui';
    const interditRoot = String(v.interdireRoot) === 'Oui';
    const nomFichier = String(v.nomFichier).trim();
    const demande = coupeMdp || interditRoot;

    // Les lignes du fichier additionnel. Elles sont construites ICI, en JS, et
    // le script ne fait que les écrire une par une avec printf : aucune valeur
    // du formulaire n'entre dans ce contenu, donc rien à interpoler et rien à
    // échapper. Les directives sont des constantes, pas des saisies.
    const lignesDropIn = [
      '# Prepare par KJEMO IT Toolkit - ssh-hardening-audit',
      '# Fichier ADDITIONNEL : /etc/ssh/sshd_config n a pas ete modifie.',
      '# sshd_config(5) : pour chaque mot-cle, la PREMIERE valeur obtenue est',
      '# retenue, et le fichier principal d Ubuntu commence par un Include de',
      '# ce dossier — ces lignes gagnent donc sur celles du fichier principal.',
      '#',
      '# Retour en arriere : supprimer ce fichier, verifier avec « sshd -t »,',
      '# puis recharger le service. Rien d autre n a ete touche.',
      ...(coupeMdp ? [
        '',
        '# Les DEUX, et non seulement la premiere : sshd_config(5) a l entree',
        '# UsePAM dit que l authentification clavier-interactif par PAM joue',
        '# habituellement le meme role que le mot de passe, et qu il faut donc',
        '# desactiver l une ou l autre. Le paquet d Ubuntu active UsePAM.',
        'PasswordAuthentication no',
        'KbdInteractiveAuthentication no',
      ] : []),
      ...(interditRoot ? [
        '',
        '# La valeur par defaut d OpenSSH est prohibit-password : root ne peut',
        '# pas entrer par mot de passe, mais peut entrer par cle. « no » ferme',
        '# aussi la cle.',
        'PermitRootLogin no',
      ] : []),
    ];

    return assemblerSh([
      ...enteteBash({
        titre: 'Auditer le durcissement SSH, et preparer un fichier additionnel valide',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'sshd -T et sshd -t controlent aussi la sante des cles d hote, qui sont en mode 600',
      }),
      ...fonctionEmpreinteBash(),
      ...blocVariablesBash([
        ['KJEMO_ADMIN', shQuote(admin)],
        ['KJEMO_NOM_FICHIER', shQuote(nomFichier)],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Compte administrateur a prouver' \"${KJEMO_ADMIN:-aucun - audit seulement}\"",
      `  printf '%s\\t%s\\n' 'Couper le mot de passe' ${shQuote(coupeMdp ? 'Oui - et aussi le clavier-interactif' : 'Non')}`,
      `  printf '%s\\t%s\\n' 'Interdire root' ${shQuote(interditRoot ? 'Oui' : 'Non')}`,
      "  printf '%s\\t%s\\n' 'Fichier additionnel' \"${KJEMO_NOM_FICHIER}\"",
      "  printf '%s\\t%s\\n' 'Ecriture dans /etc/ssh' 'AUCUNE - fichier prepare dans le dossier personnel'",
      "  printf '%s\\t%s\\n' 'Rechargement du service' 'AUCUN - commande remise, a taper'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# Les drapeaux de la porte finale, tous definis AVANT la premiere',
      '# condition : sous « set -u », un drapeau non defini arreterait le script',
      '# au moment le moins pratique, et un drapeau defini a 1 « pour que ca',
      '# passe » serait pire.',
      'KJEMO_LU_OK=0',
      'KJEMO_INCLUDE_OK=0',
      `KJEMO_DEMANDE_OK=${demande ? '1' : '0'}`,
      'KJEMO_PREUVE_OK=0',
      'KJEMO_PREPARE_OK=0',
      'KJEMO_VALIDE_OK=0',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LA CONFIGURATION EFFECTIVE, ET NON LE FICHIER',
      '#',
      '# « sshd -T » affiche la configuration telle que sshd la comprend, apres',
      '# les Include et les blocs Match. Lire sshd_config a la main donne une',
      '# autre reponse des qu un fichier additionnel existe — et c est justement',
      '# le mecanisme qu on s apprete a utiliser.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_EFFECTIVE="${KJEMO_TMP}/effective.txt"',
      ': > "${KJEMO_EFFECTIVE}"',
      'if ! kjemo_dispo sshd; then',
      "  kjemo_resultat 'Audit' 'sshd' 'PROBLEME' 'commande absente' \\",
      "    'La commande sshd est introuvable : openssh-server n est pas installe, ou n est pas dans le PATH de cette session root. Aucun audit n est possible, et rien n a ete prepare.'",
      'elif sshd -T > "${KJEMO_EFFECTIVE}" 2>"${KJEMO_TMP}/sshd-T.err"; then',
      '  KJEMO_LU_OK=1',
      '  KJEMO_NB_LIGNES="$(wc -l < "${KJEMO_EFFECTIVE}" 2>/dev/null || printf \'%s\' 0)"',
      "  kjemo_resultat 'Audit' 'sshd -T' 'OK' \"${KJEMO_NB_LIGNES} directives\" \\",
      '    "La configuration effective a ete lue par sshd lui-meme : ${KJEMO_NB_LIGNES} directives, fichiers additionnels compris. C est la seule lecture qui ne se trompe pas."',
      'else',
      "  kjemo_resultat 'Audit' 'sshd -T' 'PROBLEME' 'refusee' \\",
      '    "sshd REFUSE sa propre configuration : $(cat -- "${KJEMO_TMP}/sshd-T.err" 2>/dev/null || true). Tant que ce message subsiste, le demon ne redemarrera pas, et ajouter un fichier additionnel ne ferait qu ajouter une cause a une panne existante. Rien n a ete prepare."',
      'fi',
      '',
      '# La valeur effective d une directive, lue dans le fichier et nulle part',
      '# ailleurs. sshd -T sort les mots-cles en minuscules.',
      'kjemo_valeur() {',
      '  awk -v clef="${1:-}" \'$1 == clef {$1 = ""; sub(/^ /, ""); print; exit}\' \\',
      '    "${KJEMO_EFFECTIVE}" 2>/dev/null || true',
      '}',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LA LIGNE INCLUDE, SANS LAQUELLE TOUT CECI NE SERT A RIEN',
      '#',
      '# Un fichier depose dans /etc/ssh/sshd_config.d/ n a d effet QUE si le',
      '# fichier principal l inclut. Si la ligne a ete retiree — ou si le',
      '# fichier principal a ete remplace par une version trouvee en ligne, ce',
      '# qui arrive —, le fichier additionnel est ignore SANS LE MOINDRE',
      '# MESSAGE. Un durcissement qui ne durcit rien est pire que pas de',
      '# durcissement : on croit la machine protegee.',
      '# ---------------------------------------------------------------------------',
      'if [ ! -r /etc/ssh/sshd_config ]; then',
      "  kjemo_resultat 'Include' '/etc/ssh/sshd_config' 'PROBLEME' 'illisible' \\",
      "    'Le fichier principal /etc/ssh/sshd_config n est pas lisible. Impossible de verifier que les fichiers additionnels sont inclus : rien ne sera prepare.'",
      'elif grep -qE \'^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\\.d/\\*\\.conf\' /etc/ssh/sshd_config; then',
      '  KJEMO_INCLUDE_OK=1',
      '  KJEMO_RANG="$(grep -nE \'^[[:space:]]*Include\' /etc/ssh/sshd_config | head -1 | cut -d: -f1 || true)"',
      "  kjemo_resultat 'Include' 'sshd_config.d' 'OK' \"ligne ${KJEMO_RANG:-?}\" \\",
      '    "La ligne Include est presente a la ligne ${KJEMO_RANG:-?} du fichier principal. Comme c est la PREMIERE valeur obtenue qui gagne pour chaque mot-cle, un fichier additionnel inclus avant le reste du fichier prime sur lui — sans qu une seule ligne du fichier principal soit touchee."',
      'else',
      "  kjemo_resultat 'Include' 'sshd_config.d' 'PROBLEME' 'absente' \\",
      "    'Le fichier principal ne contient PAS « Include /etc/ssh/sshd_config.d/*.conf ». Un fichier additionnel y serait donc ignore sans le moindre message, et le durcissement serait une illusion. Rien ne sera prepare : la ligne Include doit etre remise d abord, et c est une modification du fichier principal — donc une decision qui se prend en le lisant, pas un effet de bord d un script.'",
      'fi',
      '# Les fichiers additionnels deja presents : ils ne sont pas touches, mais',
      '# ils sont NOMMES. Un reglage qu on croit absent est souvent deja pose',
      '# ailleurs, et un fichier de rang inferieur gagne sur le notre.',
      'if [ -d /etc/ssh/sshd_config.d ]; then',
      '  # find et non ls : ShellCheck le demande a juste titre (SC2012), et il',
      '  # a raison — un nom de fichier inattendu dans ce dossier ne doit pas',
      '  # casser la lecture de l inventaire.',
      "  KJEMO_DEJA=\"$(find /etc/ssh/sshd_config.d -maxdepth 1 -type f -printf '%f\\n' 2>/dev/null | sort | paste -sd, - || true)\"",
      "  kjemo_resultat 'Include' 'Fichiers deja presents' 'INFO' \"${KJEMO_DEJA:-aucun}\" \\",
      '    "Fichiers additionnels deja en place : ${KJEMO_DEJA:-aucun}. Ils sont lus dans l ordre alphabetique, et la PREMIERE valeur obtenue gagne : un fichier dont le nom passe avant le notre imposera sa valeur. Aucun n a ete modifie."',
      'fi',
      '',      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - L AUDIT, DIRECTIVE PAR DIRECTIVE',
      '#',
      '# Chaque ligne dit TROIS choses : la valeur effective, la valeur par',
      '# defaut officielle d OpenSSH, et ce que la valeur courante AUTORISE. Un',
      '# audit qui se contente de « conforme / non conforme » apprend a cocher',
      '# des cases, pas a comprendre ce qu on ferme.',
      '# ---------------------------------------------------------------------------',
      'kjemo_juger() {',
      '  local clef="${1:-}" souhaite="${2:-}" defaut="${3:-}" note="${4:-}"',
      '  local val',
      '  val="$(kjemo_valeur "${clef}")"',
      '  if [ -z "${val}" ]; then',
      "    kjemo_resultat 'Durcissement' \"${clef}\" 'IGNORE' 'non lue' \\",
      '      "La directive ${clef} n apparait pas dans la sortie de sshd -T : cette version ne la connait pas, ou la lecture a echoue. Elle n a donc PAS ete auditee."',
      '    return 0',
      '  fi',
      '  if [ "${val}" = "${souhaite}" ]; then',
      "    kjemo_resultat 'Durcissement' \"${clef}\" 'OK' \"${val}\" \\",
      '      "${clef} = ${val} (defaut officiel : ${defaut}). ${note}"',
      '  else',
      "    kjemo_resultat 'Durcissement' \"${clef}\" 'ATTENTION' \"${val}\" \\",
      '      "${clef} = ${val}, et la valeur souhaitable est ${souhaite} (defaut officiel d OpenSSH : ${defaut}). ${note}"',
      '  fi',
      '}',
      '',
      'if [ "${KJEMO_LU_OK}" -eq 1 ]; then',
      '  # Le port, pour memoire : il ne durcit rien, et le deplacer n est pas',
      '  # une protection — c est seulement moins de bruit dans les journaux.',
      '  KJEMO_V_PORT="$(kjemo_valeur port)"',
      "  kjemo_resultat 'Durcissement' 'port' 'INFO' \"${KJEMO_V_PORT:-non lu}\" \\",
      '    "Port effectif : ${KJEMO_V_PORT:-non lu} (defaut officiel : 22). Deplacer le port ne durcit rien : il reduit le bruit des tentatives automatisees, et c est tout. Sous activation par socket, c est l unite ssh.socket qui ouvre le port, et ce point est traite par l assistant ssh-server-readiness."',
      '',
      '  # PermitRootLogin a trois valeurs utiles, pas deux : le traiter en',
      '  # oui/non ferait passer le defaut officiel pour une faute.',
      '  KJEMO_V_ROOT="$(kjemo_valeur permitrootlogin)"',
      '  case "${KJEMO_V_ROOT}" in',
      '    no)',
      "      kjemo_resultat 'Durcissement' 'permitrootlogin' 'OK' 'no' \\",
      "        'root ne peut pas se connecter du tout, ni par mot de passe ni par cle. C est le reglage le plus ferme, et il suppose qu un autre compte dispose de sudo — sans quoi la machine n a plus d administrateur joignable.'",
      '      ;;',
      '    prohibit-password|without-password)',
      "      kjemo_resultat 'Durcissement' 'permitrootlogin' 'INFO' \"${KJEMO_V_ROOT}\" \\",
      '        "${KJEMO_V_ROOT} : c est la valeur par DEFAUT d OpenSSH, et sshd_config(5) le confirme — root ne peut pas entrer par mot de passe, mais peut entrer par cle. Ce n est donc pas un defaut de configuration ; passer a « no » ferme aussi la cle."',
      '      ;;',
      '    yes)',
      "      kjemo_resultat 'Durcissement' 'permitrootlogin' 'PROBLEME' 'yes' \\",
      "        'root peut se connecter PAR MOT DE PASSE. C est plus permissif que le defaut officiel, qui est prohibit-password : quelqu un a donc change ce reglage. Les tentatives automatisees visent « root » en premier, et une reussite donne la machine entiere d un coup.'",
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Durcissement' 'permitrootlogin' 'ATTENTION' \"${KJEMO_V_ROOT:-non lu}\" \\",
      '        "Valeur inattendue pour permitrootlogin : ${KJEMO_V_ROOT:-non lu}. Les valeurs documentees sont yes, prohibit-password, forced-commands-only et no, et le defaut est prohibit-password."',
      '      ;;',
      '  esac',
      '',
      '  kjemo_juger passwordauthentication no yes \\',
      "    'Tant que cette valeur est yes, chaque tentative automatisee peut essayer un mot de passe. La couper suppose qu un autre compte entre par cle — c est la preuve que cet assistant exige avant de preparer quoi que ce soit.'",
      '',
      '  # Le piege nomme par la page de manuel elle-meme.',
      '  KJEMO_V_MDP="$(kjemo_valeur passwordauthentication)"',
      '  KJEMO_V_KBD="$(kjemo_valeur kbdinteractiveauthentication)"',
      '  if [ "${KJEMO_V_MDP}" = \'no\' ] && [ "${KJEMO_V_KBD}" = \'yes\' ]; then',
      "    kjemo_resultat 'Durcissement' 'kbdinteractiveauthentication' 'PROBLEME' 'yes alors que passwordauthentication est no' \\",
      "      'Le mot de passe est coupe et le clavier-interactif reste ouvert : l entree par mot de passe est donc TOUJOURS possible, par PAM, et la configuration a pourtant l air durcie. sshd_config(5) le dit a l entree UsePAM : l authentification clavier-interactif par PAM joue habituellement le meme role que le mot de passe, et il faut desactiver l une OU l autre. Le paquet d Ubuntu active UsePAM. C est le defaut le plus trompeur du sujet.'",
      '  else',
      '    kjemo_juger kbdinteractiveauthentication no yes \\',
      "      'Le clavier-interactif passe par PAM et peut redemander le meme mot de passe. Couper PasswordAuthentication sans couper celui-ci laisse la porte ouverte tout en ayant l air fermee.'",
      '  fi',
      '',
      '  kjemo_juger pubkeyauthentication yes yes \\',
      "    'Sans elle, aucune cle ne peut servir — et couper le mot de passe dans cet etat ferme le serveur a tout le monde.'",
      '  kjemo_juger permitemptypasswords no no \\',
      "    'Un compte sans mot de passe deviendrait accessible a tous. Le defaut officiel est no, et il n y a aucune raison legitime de le changer sur un serveur.'",
      '  kjemo_juger strictmodes yes yes \\',
      "    'C est elle qui refuse une cle quand le dossier personnel est accessible en ecriture par d autres. La desactiver fait disparaitre le symptome et garde le probleme : qui peut ecrire dans le dossier d un compte peut s autoriser a sa place.'",
      '  kjemo_juger x11forwarding no no \\',
      "    'Le paquet openssh-server de Debian et d Ubuntu met yes dans le fichier livre, alors que le defaut d OpenSSH est no : la page de manuel le signale. Sur un serveur sans interface graphique, cela n a aucun usage.'",
      '',
      '  # Deux valeurs numeriques, qui ne se jugent pas par egalite.',
      '  KJEMO_V_TRIES="$(kjemo_valeur maxauthtries)"',
      '  case "${KJEMO_V_TRIES}" in',
      '    \'\')',
      "      kjemo_resultat 'Durcissement' 'maxauthtries' 'IGNORE' 'non lue' \\",
      "        'La directive maxauthtries n a pas pu etre lue : elle n a donc pas ete auditee.'",
      '      ;;',
      '    *[!0-9]*)',
      "      kjemo_resultat 'Durcissement' 'maxauthtries' 'ATTENTION' \"${KJEMO_V_TRIES}\" \\",
      '        "Valeur non numerique pour maxauthtries : ${KJEMO_V_TRIES}. Elle n a pas pu etre comparee au defaut officiel, qui est 6."',
      '      ;;',
      '    *)',
      '      if [ "${KJEMO_V_TRIES}" -gt 6 ]; then',
      "        kjemo_resultat 'Durcissement' 'maxauthtries' 'ATTENTION' \"${KJEMO_V_TRIES}\" \\",
      '          "maxauthtries = ${KJEMO_V_TRIES}, au-dela du defaut officiel de 6. Chaque connexion peut donc tenter ${KJEMO_V_TRIES} authentifications : c est autant d essais offerts par connexion a un automate. A noter : des la moitie de cette valeur, sshd journalise les echecs."',
      '      else',
      "        kjemo_resultat 'Durcissement' 'maxauthtries' 'OK' \"${KJEMO_V_TRIES}\" \\",
      '          "maxauthtries = ${KJEMO_V_TRIES}, au plus egal au defaut officiel de 6."',
      '      fi',
      '      ;;',
      '  esac',
      '',
      '  KJEMO_V_GRACE="$(kjemo_valeur logingracetime)"',
      '  case "${KJEMO_V_GRACE}" in',
      '    \'\')',
      "      kjemo_resultat 'Durcissement' 'logingracetime' 'IGNORE' 'non lue' \\",
      "        'La directive logingracetime n a pas pu etre lue : elle n a donc pas ete auditee.'",
      '      ;;',
      '    0)',
      "      kjemo_resultat 'Durcissement' 'logingracetime' 'PROBLEME' '0' \\",
      "        'logingracetime = 0 : sshd_config(5) precise qu une valeur de 0 supprime toute limite de temps. Une connexion ouverte sans s authentifier peut alors rester indefiniment, et il suffit d en ouvrir assez pour saturer le serveur.'",
      '      ;;',
      '    *[!0-9]*)',
      "      kjemo_resultat 'Durcissement' 'logingracetime' 'INFO' \"${KJEMO_V_GRACE}\" \\",
      '        "logingracetime = ${KJEMO_V_GRACE}. La valeur n est pas un nombre de secondes simple — elle peut porter un suffixe d unite — et n a donc pas ete comparee au defaut officiel de 120 secondes."',
      '      ;;',
      '    *)',
      '      if [ "${KJEMO_V_GRACE}" -gt 120 ]; then',
      "        kjemo_resultat 'Durcissement' 'logingracetime' 'ATTENTION' \"${KJEMO_V_GRACE}\" \\",
      '          "logingracetime = ${KJEMO_V_GRACE} secondes, au-dela du defaut officiel de 120. Chaque connexion non authentifiee occupe une place pendant ce temps."',
      '      else',
      "        kjemo_resultat 'Durcissement' 'logingracetime' 'OK' \"${KJEMO_V_GRACE}\" \\",
      '          "logingracetime = ${KJEMO_V_GRACE} secondes, au plus egal au defaut officiel de 120."',
      '      fi',
      '      ;;',
      '  esac',
      '',
      '  # Qui a le droit d entrer : l absence de liste n est pas une faute, mais',
      '  # une liste explicite est le reglage qui resiste le mieux a la creation',
      '  # d un compte qu on avait oublie.',
      '  KJEMO_V_AU="$(kjemo_valeur allowusers)"',
      '  KJEMO_V_AG="$(kjemo_valeur allowgroups)"',
      '  if [ -n "${KJEMO_V_AU}${KJEMO_V_AG}" ]; then',
      "    kjemo_resultat 'Durcissement' 'allowusers / allowgroups' 'INFO' \"users=${KJEMO_V_AU:-aucun} groups=${KJEMO_V_AG:-aucun}\" \\",
      '      "Une liste explicite est en place : users=${KJEMO_V_AU:-aucun}, groups=${KJEMO_V_AG:-aucun}. Tout compte absent de cette liste ne peut pas entrer, meme avec une cle valide — c est le reglage qui protege d un compte cree plus tard et oublie. Attention en diagnostic : un compte legitime absent de la liste donne « Permission denied » sans explication."',
      '  else',
      "    kjemo_resultat 'Durcissement' 'allowusers / allowgroups' 'INFO' 'aucune liste' \\",
      "      'Aucune liste explicite : tout compte du systeme peut tenter de se connecter. Ce n est pas une faute — c est le comportement par defaut — mais une liste par groupe est le reglage qui resiste le mieux a la creation d un compte qu on avait oublie.'",
      '  fi',
      '',
      '  KJEMO_V_PAM="$(kjemo_valeur usepam)"',
      "  kjemo_resultat 'Durcissement' 'usepam' 'INFO' \"${KJEMO_V_PAM:-non lu}\" \\",
      '    "usepam = ${KJEMO_V_PAM:-non lu}. Le defaut d OpenSSH est no, et le paquet de Debian et d Ubuntu le met a yes : c est pour cela que le clavier-interactif compte autant que le mot de passe sur ces systemes."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LA PREUVE DU SECOND ACCES, FAITE PAR LE SCRIPT',
      '#',
      '# Le formulaire NOMME un compte ; il ne prouve rien. Quatre controles,',
      '# tous necessaires :',
      '#   le compte existe,',
      '#   il est dans un groupe d administration — sans sudo, entrer ne suffit',
      '#   pas a reparer,',
      '#   son authorized_keys contient au moins une cle,',
      '#   les permissions sont celles que StrictModes accepte — une cle en place',
      '#   derriere un dossier en 775 est une cle qui sera refusee.',
      '#',
      '# Le quatrieme est celui qu on oublie, et c est exactement celui qui',
      '# transforme un durcissement en enfermement.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SESSION_SSH=0',
      'if [ -n "${SSH_CONNECTION:-}" ] || [ -n "${SSH_TTY:-}" ]; then KJEMO_SESSION_SSH=1; fi',
      'if [ "${KJEMO_SESSION_SSH}" -eq 1 ]; then',
      "  kjemo_resultat 'Preuve' 'Session courante' 'ATTENTION' 'session SSH' \\",
      "    'Ce script tourne DANS une session SSH. Un durcissement applique depuis une telle session peut couper l acces au moment ou le service recharge sa configuration — et il n y a alors plus personne pour revenir en arriere. C est pour cela que la preuve du second acces est exigee, et non conseillee.'",
      'else',
      "  kjemo_resultat 'Preuve' 'Session courante' 'INFO' 'session locale' \\",
      "    'Ce script ne tourne pas dans une session SSH : une erreur de configuration ne couperait donc pas cette session. La preuve du second acces reste exigee — la machine, elle, continuera d etre administree a distance.'",
      'fi',
      '',
      'if [ -z "${KJEMO_ADMIN}" ]; then',
      "  kjemo_resultat 'Preuve' 'Compte administrateur' 'IGNORE' 'aucun compte nomme' \\",
      "    'Aucun compte administrateur n a ete nomme : la preuve n a pas ete faite, et rien ne sera prepare. C est le mode audit seulement, et c est un usage legitime — relire avant de changer.'",
      'else',
      '  KJEMO_P_EXISTE=0',
      '  KJEMO_P_GROUPE=0',
      '  KJEMO_P_CLE=0',
      '  KJEMO_P_MODES=0',
      '  KJEMO_LIGNE_ADMIN="$(getent passwd -- "${KJEMO_ADMIN}" 2>/dev/null || true)"',
      '  if [ -z "${KJEMO_LIGNE_ADMIN}" ]; then',
      "    kjemo_resultat 'Preuve' 'Compte existe' 'PROBLEME' 'inconnu' \\",
      '      "Le compte ${KJEMO_ADMIN} n existe pas dans la base des comptes. Nommer un compte inexistant comme second acces est exactement la facon de s enfermer dehors en croyant s etre protege."',
      '  else',
      '    KJEMO_P_EXISTE=1',
      '    KJEMO_MAISON_ADMIN="$(printf \'%s\\n\' "${KJEMO_LIGNE_ADMIN}" | cut -d: -f6)"',
      "    kjemo_resultat 'Preuve' 'Compte existe' 'OK' \"${KJEMO_ADMIN}\" \\",
      '      "Le compte ${KJEMO_ADMIN} existe, dossier personnel ${KJEMO_MAISON_ADMIN}."',
      '    # Les groupes d administration, nommes et non devines. La',
      '    # comparaison se fait sur la chaine ENTOUREE d espaces, et non par',
      '    # decoupage en mots : l IFS de ce script est reduit au saut de ligne',
      '    # et a la tabulation — un « for » sur la sortie de id -nG, qui est',
      '    # separee par des espaces, ne donnerait qu un seul mot et ne',
      '    # trouverait jamais rien.',
      '    KJEMO_GROUPES="$(id -nG -- "${KJEMO_ADMIN}" 2>/dev/null || true)"',
      '    case " ${KJEMO_GROUPES} " in',
      "      *' sudo '*|*' admin '*|*' root '*|*' wheel '*) KJEMO_P_GROUPE=1 ;;",
      '    esac',
      '    if [ "${KJEMO_P_GROUPE}" -eq 1 ]; then',
      "      kjemo_resultat 'Preuve' 'Groupe d administration' 'OK' \"${KJEMO_GROUPES}\" \\",
      '      "Le compte appartient a un groupe d administration (groupes : ${KJEMO_GROUPES}). Il pourra donc non seulement entrer, mais aussi reparer — entrer sans pouvoir reparer ne serait pas un second acces."',
      '    else',
      "      kjemo_resultat 'Preuve' 'Groupe d administration' 'PROBLEME' \"${KJEMO_GROUPES:-aucun}\" \\",
      '      "Le compte ${KJEMO_ADMIN} n est dans aucun des groupes d administration reconnus (sudo, admin, root, wheel). Ses groupes : ${KJEMO_GROUPES:-aucun}. Il pourrait entrer et ne rien pouvoir corriger : ce n est pas un second acces administrateur."',
      '    fi',
      '    # La cle, et les permissions que StrictModes exige. Les deux, parce que',
      '    # la premiere sans la seconde donne une cle qui sera refusee.',
      '    KJEMO_AUTH_ADMIN="${KJEMO_MAISON_ADMIN}/.ssh/authorized_keys"',
      '    if [ -r "${KJEMO_AUTH_ADMIN}" ]; then',
      '      KJEMO_NB_CLE="$(grep -cvE \'^[[:space:]]*($|#)\' -- "${KJEMO_AUTH_ADMIN}" 2>/dev/null || printf \'%s\' 0)"',
      '      if [ "${KJEMO_NB_CLE}" -gt 0 ]; then',
      '        KJEMO_P_CLE=1',
      "        KJEMO_EMPR_ADMIN=\"$(kjemo_empreinte \"${KJEMO_AUTH_ADMIN}\" | head -5 | paste -sd'; ' - || printf '%s' 'non calculees')\"",
      "        kjemo_resultat 'Preuve' 'Cle autorisee' 'OK' \"${KJEMO_NB_CLE} cle(s)\" \\",
      '        "${KJEMO_NB_CLE} cle(s) autorisee(s) pour ${KJEMO_ADMIN}. Empreintes PUBLIQUES : ${KJEMO_EMPR_ADMIN}. Compare-les avec celles du poste client avant de durcir : une cle en place n est pas forcement LA bonne."',
      '      else',
      "        kjemo_resultat 'Preuve' 'Cle autorisee' 'PROBLEME' 'fichier vide' \\",
      '        "Le fichier ${KJEMO_AUTH_ADMIN} existe mais ne contient aucune cle utile. Couper le mot de passe maintenant enfermerait ${KJEMO_ADMIN} dehors."',
      '      fi',
      '    else',
      "      kjemo_resultat 'Preuve' 'Cle autorisee' 'PROBLEME' 'authorized_keys absent ou illisible' \\",
      '      "Aucun fichier ${KJEMO_AUTH_ADMIN} lisible. L assistant ssh-key-readiness affiche la procedure qui met une cle en place, et elle se termine par une connexion EPROUVEE depuis un second terminal."',
      '    fi',
      '    # Le quatrieme controle, celui qu on oublie.',
      '    if [ -d "${KJEMO_MAISON_ADMIN}" ]; then',
      '      KJEMO_OCT_M="$(stat -c \'%a\' -- "${KJEMO_MAISON_ADMIN}" 2>/dev/null || printf \'%s\' 777)"',
      '      KJEMO_GM=$(( $(printf \'%s\' "${KJEMO_OCT_M}" | cut -c2) ))',
      '      KJEMO_AM=$(( $(printf \'%s\' "${KJEMO_OCT_M}" | cut -c3) ))',
      '      if [ $(( KJEMO_GM & 2 )) -eq 0 ] && [ $(( KJEMO_AM & 2 )) -eq 0 ]; then',
      '        KJEMO_P_MODES=1',
      "        kjemo_resultat 'Preuve' 'Permissions StrictModes' 'OK' \"${KJEMO_OCT_M}\" \\",
      '        "Le dossier personnel de ${KJEMO_ADMIN} est en ${KJEMO_OCT_M} : ni le groupe ni les autres n y ecrivent, donc StrictModes acceptera ses cles."',
      '      else',
      "        kjemo_resultat 'Preuve' 'Permissions StrictModes' 'PROBLEME' \"${KJEMO_OCT_M}\" \\",
      '        "Le dossier personnel de ${KJEMO_ADMIN} est en ${KJEMO_OCT_M} : le groupe ou les autres peuvent y ecrire, et StrictModes REFUSERA donc ses cles. La cle est en place et elle ne servira pas — c est precisement ainsi qu un durcissement devient un enfermement. Correction a la main : chmod go-w ${KJEMO_MAISON_ADMIN}"',
      '      fi',
      '    fi',
      '  fi',
      '  if [ "${KJEMO_P_EXISTE}" -eq 1 ] && [ "${KJEMO_P_GROUPE}" -eq 1 ] \\',
      '    && [ "${KJEMO_P_CLE}" -eq 1 ] && [ "${KJEMO_P_MODES}" -eq 1 ]; then',
      '    KJEMO_PREUVE_OK=1',
      "    kjemo_resultat 'Preuve' 'Second acces' 'OK' 'prouve' \\",
      '      "Les quatre controles passent pour ${KJEMO_ADMIN} : compte existant, groupe d administration, cle autorisee, permissions acceptees par StrictModes. Ce qu ils ne prouvent PAS : qu une connexion a reellement eu lieu. Eprouve-la depuis un second terminal avant d installer le fichier — la procedure le redit."',
      '  else',
      "    kjemo_resultat 'Preuve' 'Second acces' 'PROBLEME' 'non prouve' \\",
      '      "Au moins un des quatre controles echoue pour ${KJEMO_ADMIN} : les lignes ci-dessus disent lequel. Rien ne sera prepare — et ce refus est le seul interet de cet assistant par rapport a l ecriture directe du fichier a la main."',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LE FICHIER PREPARE, DANS LE DOSSIER TEMPORAIRE',
      '#',
      '# Ligne par ligne, avec printf : aucune valeur du formulaire n entre dans',
      '# ce contenu — les directives sont des constantes choisies par',
      '# l assistant, et le formulaire ne fait que decider lesquelles. Il n y a',
      '# donc rien a echapper ici, et c est voulu : un fichier de configuration',
      '# SSH construit a partir de saisies serait un fichier dans lequel une',
      '# saisie peut devenir une directive.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PREPARE="${KJEMO_TMP}/${KJEMO_NOM_FICHIER}"',
      'KJEMO_DESTINATION="${HOME}/${KJEMO_NOM_FICHIER}"',
      'if [ "${KJEMO_DEMANDE_OK}" -eq 1 ]; then',
      '  if {',
      ...lignesDropIn.map((l) => `    printf '%s\\n' ${shQuote(l)}`),
      '  } > "${KJEMO_PREPARE}"; then',
      '    KJEMO_PREPARE_OK=1',
      '    KJEMO_NB_DIR="$(grep -cvE \'^[[:space:]]*($|#)\' -- "${KJEMO_PREPARE}" 2>/dev/null || printf \'%s\' 0)"',
      "    kjemo_resultat 'Preparation' 'Fichier' 'OK' \"${KJEMO_NB_DIR} directive(s)\" \\",
      '      "Le fichier est prepare dans le dossier temporaire avec ${KJEMO_NB_DIR} directive(s) actives. Rien n a encore ete ecrit ailleurs, et /etc/ssh est intact."',
      '  else',
      "    kjemo_resultat 'Preparation' 'Fichier' 'PROBLEME' 'echec d ecriture' \\",
      "      'Le fichier n a pas pu etre ecrit dans le dossier temporaire. Rien n a ete prepare, et rien ne sera remis.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Preparation' 'Fichier' 'IGNORE' 'aucun durcissement demande' \\",
      "    'Aucun durcissement n a ete demande dans le formulaire : aucun fichier n est prepare, et c est le mode audit seulement. Les lignes « Durcissement » ci-dessus sont le resultat.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - LA VALIDATION, PAR SSHD LUI-MEME, SUR UNE COPIE',
      '#',
      '# « sshd -t » est decrit par sshd(8) comme « Test mode. Only check the',
      '# validity of the configuration file and sanity of the keys ». Il',
      '# verifie, il ne demarre rien, et il ne recharge rien.',
      '#',
      '# Le fichier de test place NOS lignes en tete, puis inclut la',
      '# configuration reelle : c est exactement la position qu occupera le',
      '# fichier additionnel, puisque la premiere valeur obtenue gagne. La',
      '# validation porte donc sur l ENSEMBLE, et non sur un fragment isole —',
      '# un fragment seul passerait un test qui ne veut rien dire.',
      '#',
      '# Limite a dire : le dossier des fichiers additionnels se retrouve inclus',
      '# deux fois dans ce test. Pour un controle de syntaxe, cela ne change',
      '# rien ; cela ne mesure pas, en revanche, l ordre final exact.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_TEST="${KJEMO_TMP}/essai-complet.conf"',
      'if [ "${KJEMO_PREPARE_OK}" -eq 1 ] && kjemo_dispo sshd; then',
      '  if {',
      '    cat -- "${KJEMO_PREPARE}"',
      "    printf '%s\\n' 'Include /etc/ssh/sshd_config'",
      '  } > "${KJEMO_TEST}"; then',
      '    if sshd -t -f "${KJEMO_TEST}" 2>"${KJEMO_TMP}/essai.err"; then',
      '      KJEMO_VALIDE_OK=1',
      "      kjemo_resultat 'Validation' 'sshd -t sur copie' 'OK' 'acceptee' \\",
      "        'sshd accepte l ENSEMBLE : nos lignes en tete, puis la configuration reelle. Cette validation n a rien applique et rien recharge — sshd(8) decrit -t comme un mode de test. Ce qu elle ne dit PAS : qu un acces restera possible. La syntaxe est correcte ; l enfermement, lui, est syntaxiquement valide.'",
      '    else',
      "      kjemo_resultat 'Validation' 'sshd -t sur copie' 'PROBLEME' 'refusee' \\",
      '        "sshd REFUSE la configuration preparee : $(cat -- "${KJEMO_TMP}/essai.err" 2>/dev/null || true). Aucun fichier ne sera remis : installer une configuration que sshd refuse empecherait le service de redemarrer, et c est la panne la plus difficile a corriger a distance — parce qu on ne peut plus se connecter pour la corriger."',
      '    fi',
      '  else',
      "    kjemo_resultat 'Validation' 'Fichier d essai' 'PROBLEME' 'echec d ecriture' \\",
      "      'Le fichier d essai n a pas pu etre assemble dans le dossier temporaire : la validation n a PAS eu lieu, et rien ne sera remis. Une absence de validation n est pas une validation reussie.'",
      '  fi',
      'elif [ "${KJEMO_DEMANDE_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Validation' 'sshd -t sur copie' 'IGNORE' 'non executee' \\",
      "    'La validation n a pas eu lieu : le fichier n a pas ete prepare, ou sshd est introuvable. Rien ne sera remis.'",
      'fi',
      '',
      '# L APERCU EXACT, imprime. Une ligne INFO dans un tableau ne se lit pas,',
      '# et le rapport Console n affiche de toute facon que les lignes',
      '# ATTENTION, PROBLEME et IGNORE : un fichier qu on s apprete a installer',
      '# sur un serveur doit etre LU, en entier, tel qu il est.',
      'if [ "${KJEMO_PREPARE_OK}" -eq 1 ]; then',
      "  printf '\\n%s\\n' '--- APERCU EXACT DU FICHIER PREPARE ---'",
      '  cat -- "${KJEMO_PREPARE}"',
      "  printf '%s\\n' '--- fin de l apercu ---'",
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: admin !== '' ? admin : 'aucun-compte-nomme',
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `laisser le fichier prepare dans le dossier personnel, et remettre la procedure d installation du durcissement de ${admin !== '' ? admin : 'aucun compte nomme'}`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_LU_OK', 'La configuration effective n a pas pu etre lue par sshd -T : auditer a l aveugle puis ecrire serait l inverse de l ordre a suivre.'],
          ['KJEMO_INCLUDE_OK', 'Le fichier principal n inclut pas /etc/ssh/sshd_config.d/*.conf : un fichier additionnel y serait ignore sans message.'],
          ['KJEMO_DEMANDE_OK', 'Aucun durcissement n a ete demande : il n y a rien a preparer, et l audit ci-dessus est le resultat.'],
          ['KJEMO_PREUVE_OK', 'Le second acces administrateur n est pas prouve : compte, groupe d administration, cle autorisee et permissions acceptees par StrictModes — les quatre sont necessaires.'],
          ['KJEMO_PREPARE_OK', 'Le fichier prepare n a pas pu etre ecrit.'],
          ['KJEMO_VALIDE_OK', 'sshd refuse la configuration preparee.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom du compte administrateur.'],
        ],
        action: 'la remise du fichier prepare et de la procedure d installation',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - LA REMISE, ET LES SIX COMMANDES A TAPER SOI-MEME',
      '#',
      '# La seule ecriture hors du dossier temporaire de tout ce script : une',
      '# copie dans le dossier personnel, en mode 600, relue par cmp.',
      '# ---------------------------------------------------------------------------',
      '  if ! cp -p -- "${KJEMO_PREPARE}" "${KJEMO_DESTINATION}"; then',
      "    printf '%s\\n' 'ARRET : impossible de laisser le fichier prepare dans le dossier personnel.' >&2",
      "    printf '%s\\n' 'Rien n a ete installe, et /etc/ssh est intact.' >&2",
      '    exit 1',
      '  fi',
      '  chmod 600 -- "${KJEMO_DESTINATION}" 2>/dev/null || true',
      '  if ! cmp -s -- "${KJEMO_PREPARE}" "${KJEMO_DESTINATION}"; then',
      "    printf '%s\\n' 'ARRET : le fichier recopie ne correspond pas a celui qui a ete valide.' >&2",
      "    printf '%s\\n' 'Rien n a ete installe dans /etc/ssh.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Remise' \"${KJEMO_DESTINATION}\" 'OK' 'ecrit, relu, mode 600' \\",
      "    'Identique a celui que sshd vient d accepter, verifie par cmp. C est le seul fichier laisse par ce script, et il est HORS de /etc/ssh.'",
      '',
      "  printf '\\n%s\\n' '=============================================================='",
      "  printf '%s\\n' 'A FAIRE MAINTENANT, A LA MAIN, DANS CET ORDRE'",
      "  printf '%s\\n' '=============================================================='",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '1. Garde cette session ouverte. Ouvre une SECONDE session'",
      '  printf \'%s\\n\' "   vers cette machine avec le compte ${KJEMO_ADMIN}, PAR CLE :"',
      '  printf \'%s\\n\' "     ssh -o PreferredAuthentications=publickey ${KJEMO_ADMIN}@<cette-machine>"',
      "  printf '%s\\n' '   Si cette commande echoue, ARRETE-TOI ICI. Les controles'",
      "  printf '%s\\n' '   de ce script prouvent que la cle est en place et que les'",
      "  printf '%s\\n' '   permissions l acceptent ; ils ne prouvent pas qu une'",
      "  printf '%s\\n' '   connexion aboutit.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '2. Installe le fichier additionnel. Il est ADDITIONNEL :'",
      "  printf '%s\\n' '   /etc/ssh/sshd_config n est pas touche.'",
      '  printf \'%s\\n\' "     sudo install -m 644 -o root -g root \\"${KJEMO_DESTINATION}\\" \\"/etc/ssh/sshd_config.d/${KJEMO_NOM_FICHIER}\\""',
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '3. VERIFIE avant de recharger. Si cette commande affiche la'",
      "  printf '%s\\n' '   moindre erreur, retire le fichier et ne recharge pas :'",
      "  printf '%s\\n' '     sudo sshd -t'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '4. Recharge le service. C est a cet instant precis que le'",
      "  printf '%s\\n' '   durcissement entre en vigueur, et que les sessions'",
      "  printf '%s\\n' '   futures sont concernees. Les sessions DEJA ouvertes ne'",
      "  printf '%s\\n' '   sont pas coupees par un reload : c est ce qui laisse une'",
      "  printf '%s\\n' '   chance de revenir en arriere.'",
      "  printf '%s\\n' '     sudo systemctl reload ssh'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '5. RELIS la configuration effective et le port ecoute. Ne te'",
      "  printf '%s\\n' '   fie pas au contenu du fichier : relis ce que sshd en a'",
      "  printf '%s\\n' '   compris.'",
      '  printf \'%s\\n\' "     sudo sshd -T | grep -E \'^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|port)\'"',
      "  printf '%s\\n' '     ss -lntp | grep ssh'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '6. EPROUVE une nouvelle connexion depuis un TROISIEME'",
      "  printf '%s\\n' '   terminal, avant de fermer les deux autres :'",
      '  printf \'%s\\n\' "     ssh ${KJEMO_ADMIN}@<cette-machine>"',
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'POUR ANNULER, a tout moment : supprime le fichier ajoute,'",
      "  printf '%s\\n' 'verifie, recharge. Aucun fichier n a ete reecrit, donc il n y'",
      "  printf '%s\\n' 'a aucune sauvegarde a restaurer.'",
      '  printf \'%s\\n\' "     sudo rm -f \\"/etc/ssh/sshd_config.d/${KJEMO_NOM_FICHIER}\\""',
      "  printf '%s\\n' '     sudo sshd -t && sudo systemctl reload ssh'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'Ce que ce script n a PAS fait : il n a rien ecrit dans'",
      "  printf '%s\\n' '/etc/ssh, il n a recharge aucun service, et il n a lu aucune'",
      "  printf '%s\\n' 'cle privee.'",
      "  printf '%s\\n' '=============================================================='",
      "  kjemo_resultat 'Suite' 'Commandes remises' 'ATTENTION' 'a taper a la main' \\",
      '    "Le fichier est prepare et accepte par sshd, et rien n est installe. Les six etapes sont affichees : seconde session PAR CLE d abord, installation, « sshd -t », rechargement, relecture de la configuration effective ET du port ecoute, puis une troisieme connexion eprouvee. Fichier laisse : ${KJEMO_DESTINATION}."',
      'fi',
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'dossier personnel seulement' \\",
      "  'Aucune ecriture dans /etc/ssh, aucun service recharge, aucun fichier existant modifie, aucune cle privee lue. La seule ecriture possible est une copie du fichier prepare dans le dossier personnel, et elle est derriere la porte finale.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-ssh-durcissement' }),
    ]);
  },

  gui: [
    'Lis la configuration EFFECTIVE, jamais le fichier : « sudo sshd -T ». Les fichiers additionnels et les blocs Match changent la réponse.',
    'Ne réécris pas /etc/ssh/sshd_config. Dépose un fichier dans /etc/ssh/sshd_config.d/ : il est inclus en tête, et c’est la PREMIÈRE valeur obtenue qui gagne.',
    'Vérifie que la ligne « Include /etc/ssh/sshd_config.d/*.conf » existe. Sans elle, ton fichier est ignoré sans le moindre message.',
    'Le fichier doit finir par .conf, sinon il n’est pas inclus. Le préfixe numérique fixe l’ordre.',
    'Couper « PasswordAuthentication no » ne suffit pas : ajoute « KbdInteractiveAuthentication no ». La page de manuel le dit à l’entrée UsePAM, et Ubuntu active UsePAM.',
    'PermitRootLogin a trois valeurs utiles. Le défaut officiel, prohibit-password, interdit déjà le mot de passe et autorise la clé.',
    'Avant de couper quoi que ce soit : ouvre une seconde session PAR CLÉ avec un compte de sudo, et garde-la ouverte.',
    'Toujours dans cet ordre : installer, « sudo sshd -t », puis « sudo systemctl reload ssh ». Un reload ne coupe pas les sessions déjà ouvertes.',
    'Après le rechargement, relis « sudo sshd -T » et « ss -lntp | grep ssh ». Le contenu du fichier ne prouve rien ; ce que sshd en a compris, oui.',
    'Pour annuler, supprime le fichier ajouté et recharge. Rien n’a été réécrit, donc il n’y a rien à restaurer.',
  ],

  keywords: ['ssh', 'durcissement', 'hardening', 'sshd_config', 'sshd -T', 'sshd -t',
    'drop-in', 'sshd_config.d', 'include', 'permitrootlogin',
    'passwordauthentication', 'kbdinteractive', 'usepam', 'strictmodes',
    'maxauthtries', 'logingracetime', 'audit', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'sudo : « sshd -T » et « sshd -t » contrôlent aussi la santé des clés d’hôte, en mode 600. Sans root, l’audit n’a pas lieu, et le script s’arrête avant toute écriture.',
    'Un second compte administrateur qui entre PAR CLÉ, et dont la connexion a été éprouvée depuis un second terminal. Le script vérifie quatre conditions ; il ne peut pas vérifier qu’une connexion aboutit.',
    'La ligne « Include /etc/ssh/sshd_config.d/*.conf » dans le fichier principal. Sans elle, rien n’est préparé.',
    'Une seconde session ouverte vers la machine pendant toute l’opération.',
  ],

  commonErrors: [
    {
      message: 'J’ai mis PasswordAuthentication no et il demande toujours un mot de passe',
      code: 'KJEMO',
      cause: 'Le clavier-interactif est resté actif et passe par PAM, qui redemande le même mot de passe. La configuration a l’air durcie et ne l’est pas.',
      fix: 'Couper les deux, puis relire la configuration effective.',
      command: 'sudo sshd -T | grep -E "^(passwordauthentication|kbdinteractiveauthentication|usepam)"',
    },
    {
      message: 'Mon fichier dans sshd_config.d n’a aucun effet',
      code: 'KJEMO',
      cause: 'Soit il ne finit pas par .conf, soit la ligne Include a disparu du fichier principal — souvent parce qu’il a été remplacé par une version trouvée en ligne.',
      fix: 'Vérifier l’inclusion, puis l’extension du fichier.',
      command: 'grep -n Include /etc/ssh/sshd_config; ls -l /etc/ssh/sshd_config.d/',
    },
    {
      message: 'Job for ssh.service failed',
      code: 'KJEMO',
      cause: 'sshd refuse la configuration. Le service ne redémarre pas, et sur une machine distante on ne peut plus se connecter pour corriger.',
      fix: 'Retirer le dernier fichier ajouté, vérifier, recharger. C’est pour cela que « sshd -t » passe AVANT le rechargement.',
      command: 'sudo sshd -t',
    },
    {
      message: 'Permission denied (publickey) pour tout le monde après le durcissement',
      code: 'KJEMO',
      cause: 'Le mot de passe a été coupé alors qu’aucune clé n’était réellement utilisable — souvent à cause des permissions, que StrictModes contrôle.',
      fix: 'Depuis une session encore ouverte : retirer le fichier et recharger. Sinon, console physique ou console du superviseur de machines virtuelles.',
      command: 'sudo rm -f /etc/ssh/sshd_config.d/99-kjemo-durcissement.conf && sudo sshd -t && sudo systemctl reload ssh',
    },
    {
      message: 'PermitRootLogin ne change rien',
      code: 'KJEMO',
      cause: 'Un autre fichier additionnel, lu avant le vôtre, impose déjà une valeur : c’est la première valeur obtenue qui gagne.',
      fix: 'Lire la valeur effective et l’ordre des fichiers.',
      command: 'sudo sshd -T | grep permitrootlogin; ls -1 /etc/ssh/sshd_config.d/',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport donne la configuration effective lue par « sshd -T », et non le contenu d’un fichier.',
    'La présence de la ligne Include est vérifiée, et son absence bloque toute préparation.',
    'Les fichiers additionnels déjà présents sont nommés, et la règle de la première valeur obtenue est rappelée.',
    'Chaque directive auditée est accompagnée de la valeur par défaut officielle d’OpenSSH et de ce que la valeur courante autorise.',
    'La combinaison « PasswordAuthentication no » avec « KbdInteractiveAuthentication yes » est signalée PROBLEME, avec la citation de la page de manuel.',
    'Les quatre contrôles du second accès sont rapportés séparément, et le verdict dit lequel manque.',
    'Le fichier préparé est affiché en entier, tel qu’il est.',
    'La validation est faite par « sshd -t » sur une copie qui place les lignes préparées en tête de la configuration réelle.',
    'Sans confirmation exacte, aucun fichier n’est laissé sur le disque.',
    'Rien n’est écrit dans /etc/ssh, et aucun service n’est rechargé.',
  ],

  rollback: {
    summary: 'Le retour en arrière consiste à supprimer un fichier qu’on a ajouté — et non à restaurer un fichier qu’on a réécrit. C’est tout l’intérêt du fichier additionnel : /etc/ssh/sshd_config n’a jamais été touché, donc il n’y a aucune sauvegarde à retrouver.',
    diagnostic: `# Ce que sshd a reellement compris :
sudo sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|usepam|port)'
# Les fichiers additionnels, dans leur ordre de lecture :
ls -1 /etc/ssh/sshd_config.d/
# Ce qui ecoute :
ss -lntp | grep ssh`,
    command: `# Retirer le durcissement, dans cet ordre :
sudo rm -f /etc/ssh/sshd_config.d/99-kjemo-durcissement.conf
sudo sshd -t
sudo systemctl reload ssh
# Puis RELIRE, parce qu un fichier retire ne prouve pas un etat :
sudo sshd -T | grep -E '^(permitrootlogin|passwordauthentication)'

# Si l acces est deja perdu, aucune commande a distance ne peut aider :
# il faut la console physique de la machine, ou la console du
# superviseur de machines virtuelles. C est exactement ce que la preuve
# du second acces sert a eviter, et c est pourquoi elle n est pas
# facultative.`,
    warning: 'Un « reload » ne coupe pas les sessions déjà ouvertes : garde-en une, c’est la seule chose qui permette d’annuler.',
  },

  checks: [
    'Aucune écriture dans /etc/ssh : le fichier préparé reste dans le dossier personnel, et son installation est une commande à taper.',
    '/etc/ssh/sshd_config n’est jamais remplacé ni modifié : le durcissement passe par un fichier additionnel, et le retour en arrière est une suppression.',
    'Aucun service n’est rechargé ni redémarré par le script : « systemctl reload ssh » n’apparaît que dans la procédure remise.',
    'La ligne Include est vérifiée : sans elle, un fichier additionnel serait ignoré sans message, et rien n’est préparé.',
    'Le nom du fichier doit finir par .conf, contrôlé par le formulaire : « *.conf » est le motif inclus.',
    'La preuve du second accès est FAITE par le script — compte, groupe d’administration, clé autorisée, permissions acceptées par StrictModes — et non déclarée par le formulaire.',
    'Le script dit explicitement ce que cette preuve ne couvre pas : qu’une connexion aboutisse réellement.',
    'La session SSH courante est détectée, et le risque qu’elle représente est nommé.',
    'Aucune valeur du formulaire n’entre dans le contenu du fichier préparé : les directives sont des constantes, donc rien à interpoler.',
    'La validation est faite par sshd lui-même, avec « sshd -t -f » sur une copie, et la double inclusion du dossier additionnel dans ce test est déclarée comme une limite.',
    'Zéro écriture après une validation échouée : le drapeau de validation est une condition de la porte finale.',
    'Aucune clé privée lue, aucune clé générée, aucun secret dans le formulaire ni dans le rapport.',
    'La procédure remise relit la configuration effective ET le port écouté après le rechargement : un fichier installé ne prouve pas un état.',
  ],

  source: `${M}/man5/sshd_config.5.html`,
  sources: [
    { label: 'sshd_config(5) — Include, première valeur obtenue, UsePAM, StrictModes', url: `${M}/man5/sshd_config.5.html` },
    { label: 'sshd(8) — les modes de test -t et -T', url: `${M}/man8/sshd.8.html` },
    { label: 'systemctl(1) — reload', url: `${M}/man1/systemctl.1.html` },
    { label: 'install(1) — mode et propriétaire en une seule opération', url: `${M}/man1/install.1.html` },
  ],
};

export const toolsLinuxJ = [
  sshServerReadiness,
  sshClientDiagnostic,
  sshKeyReadiness,
  sshHardeningAudit,
];
