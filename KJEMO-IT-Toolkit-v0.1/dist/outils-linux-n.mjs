/**
 * outils-linux-n.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * NFS — partage de fichiers entre machines UNIX. Deux assistants.
 *
 *   nfs-server-readiness  LIT ce qui décide qu'un export NFS fonctionnera, et
 *                         AUDITE les lignes déjà présentes dans /etc/exports :
 *                         un « * », un joker, un « /0 » ou un
 *                         « no_root_squash » qui traînent sont signalés, parce
 *                         qu'ils sont la panne de sécurité la plus fréquente
 *                         du sujet et qu'on ne les voit jamais en regardant
 *                         « si ça marche ».
 *   nfs-export-create     PRÉPARE et ÉCRIT une ligne d'export dans
 *                         /etc/exports — sauvegarde vérifiée, comparaison,
 *                         relecture — et N'APPLIQUE RIEN. L'application reste
 *                         une étape manuelle, annoncée, et la raison en est
 *                         documentaire.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CET ASSISTANT N'APPLIQUE PAS, ET POURQUOI CE N'EST PAS DE LA TIMIDITÉ
 * ---------------------------------------------------------------------------
 * Samba a `testparm` : une commande officiellement prévue pour valider un
 * fichier de configuration QUELCONQUE sans rien appliquer, avec un code de
 * sortie documenté. C'est ce qui permet, au module Samba, de valider un
 * candidat puis de remplacer le fichier en connaissance de cause.
 *
 * NFS n'a pas d'équivalent. La page de manuel d'exportfs(8) pour Ubuntu 24.04
 * énumère ses options : -d, -a, -o, -i, -r, -u, -f, -v, -s. Aucune n'est un
 * « essai à blanc ». Et ce que fait `-r` est écrit noir sur blanc :
 *
 *   « Reexport all directories, synchronizing /var/lib/nfs/etab with
 *     /etc/exports and files under /etc/exports.d. This option removes
 *     entries in /var/lib/nfs/etab which have been deleted from
 *     /etc/exports or files under /etc/exports.d, and removes any entries
 *     from the kernel export table which are no longer valid. »
 *
 * Autrement dit `exportfs -ra` APPLIQUE, et il RETIRE. Un export ajouté à la
 * main avec `exportfs -o ... hôte:/chemin`, sans passer par le fichier,
 * disparaît au premier `-ra`. Présenter cette commande comme « une simple
 * vérification » — ce qu'on lit partout — est faux, et c'est le genre de
 * fausseté qui coûte un partage en production pendant un cours.
 *
 * La conséquence, assumée et écrite dans la fiche : cet assistant écrit la
 * ligne, la relit, et s'arrête là. Il affiche la commande d'application, avec
 * ce qu'elle fait réellement. Écrire dans /etc/exports n'a AUCUN effet sur le
 * service tant qu'on n'applique pas — c'est précisément ce qui rend cette
 * coupure sûre, et c'est aussi pour cela qu'il faut le dire : quelqu'un qui
 * croit avoir partagé un dossier et qui n'a pas appliqué cherchera du côté du
 * client pendant une heure.
 *
 * On ne fabrique pas une sécurité qui n'existe pas. On nomme celle qui manque.
 *
 * ---------------------------------------------------------------------------
 * LES QUATRE REFUS ABSOLUS, ET CE QU'ILS ÉVITENT
 * ---------------------------------------------------------------------------
 * 1. « * » EST REFUSÉ. exports(5) le décrit comme l'entrée « anonymous », qui
 *    « will match all clients ». Un export vers « * » est accessible à toute
 *    machine capable de joindre le port 2049.
 * 2. TOUT JOKER EST REFUSÉ. exports(5) : « Machine names may contain the
 *    wildcard characters * and ?, or may contain character class lists within
 *    [square brackets] », et prévient que ces caractères « also match the dots
 *    in a domain name » — `*.cs.foo.edu` attrape donc aussi les
 *    sous-domaines. Un joker dont on ne mesure pas la portée n'est pas une
 *    restriction.
 * 3. « /0 » EST REFUSÉ. C'est « * » écrit en notation CIDR, et il a l'air
 *    d'une restriction. C'est pire que « * », qui au moins se voit.
 * 4. « no_root_squash » N'EXISTE PAS DANS CET ASSISTANT. exports(5) : le
 *    squash de root « is the default, and can be turned off with
 *    no_root_squash », option « mainly useful for diskless clients ».
 *    Le désactiver donne à root d'une machine cliente les droits de root sur
 *    les fichiers exportés. Il n'y a pas de champ pour cela, donc pas de
 *    valeur à refuser dans le script : l'assistant écrit `root_squash`
 *    EXPLICITEMENT, pour que la lecture de la ligne montre la décision.
 *
 * ---------------------------------------------------------------------------
 * CE QUE NFS N'EST PAS, ET QU'IL FAUT AVOIR DIT UNE FOIS
 * ---------------------------------------------------------------------------
 * NFSv3 en `sec=sys` — le cas du cours, et le défaut — n'authentifie pas
 * l'utilisateur : le serveur « bases its access control to files on the server
 * machine on the uid and gid provided in each NFS RPC request » (exports(5)).
 * C'est le CLIENT qui annonce l'UID, et le serveur le croit. Un export NFS
 * n'est donc une protection que par l'adresse du client, et c'est pourquoi la
 * liste d'accès est le seul vrai verrou — et pourquoi un « * » y est une
 * faute, pas une facilité.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import {
  blocConfirmation, blocPorteFinale, blocSauvegardeFichier, blocGardienChemin,
} from './gardes-bash.mjs';
import {
  validateChoix, validateCheminAbsolu, validateClientNfs,
} from './validateurs-linux.mjs';
import { assertValid } from './noyau.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';
const DOCU = 'https://documentation.ubuntu.com/server/how-to/networking/install-nfs/';

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
 * Les chemins qu'on n'exporte pas.
 *
 * /srv et /mnt n'y sont PAS : ce sont les emplacements prévus pour des
 * données partagées. La liste visse ce qui expose la machine entière — et
 * « / » y figure en premier, parce que l'exemple de la page de manuel
 * d'exports(5) commence précisément par `/ master(rw) trusty(rw,no_root_squash)`
 * et que cet exemple est recopié bien plus souvent qu'il n'est compris.
 */
const EXPORT_REFUSE = [
  '/', '/etc', '/usr', '/var', '/boot', '/bin', '/sbin', '/lib', '/lib64',
  '/opt', '/root', '/home', '/dev', '/proc', '/sys', '/run',
];

/**
 * Le bloc commun aux deux assistants : les paquets, les unités, les ports, et
 * la distinction que tout le reste suppose — le FICHIER /etc/exports n'est pas
 * la TABLE en service.
 *
 * exportfs(8) : « The master export table is kept in a file named
 * /var/lib/nfs/etab. This file is read by rpc.mountd when a client sends an
 * NFS MOUNT request. » Le fichier /etc/exports n'est que la source dont on
 * initialise cette table. Les deux peuvent diverger, et c'est l'explication
 * de la moitié des « j'ai pourtant modifié le fichier ».
 */
function blocNfsBase() {
  return [
    '# ---------------------------------------------------------------------------',
    '# SOCLE NFS — LES PAQUETS, LES UNITES, LES PORTS, LE FICHIER ET LA TABLE',
    '#',
    '# La confusion de depart : « nfs-common » est le CLIENT, « nfs-kernel-server »',
    '# est le SERVEUR. Installer le premier et chercher pourquoi rien ne',
    '# s exporte est le premier quart d heure perdu du sujet.',
    '#',
    '# La seconde, plus couteuse : /etc/exports est un FICHIER ; la table en',
    '# service est /var/lib/nfs/etab, lue par rpc.mountd. Modifier le fichier ne',
    '# change RIEN tant que la table n a pas ete resynchronisee.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_PAQUET_OK=0',
    'KJEMO_SERVICE_OK=0',
    'KJEMO_FICHIER_LISIBLE=0',
    '',
    'if kjemo_dispo dpkg-query; then',
    '  for KJEMO_P in nfs-kernel-server nfs-common; do',
    "    KJEMO_ETAT_P=\"$(dpkg-query -W -f='${Status}' -- \"${KJEMO_P}\" 2>/dev/null || true)\"",
    '    case "${KJEMO_ETAT_P}" in',
    '      *"install ok installed"*)',
    '        if [ "${KJEMO_P}" = \'nfs-kernel-server\' ]; then KJEMO_PAQUET_OK=1; fi',
    '        kjemo_resultat \'Paquets\' "${KJEMO_P}" \'OK\' \'installe\' \\',
    '          "${KJEMO_P} est installe."',
    '        ;;',
    '      *)',
    '        if [ "${KJEMO_P}" = \'nfs-kernel-server\' ]; then',
    "          kjemo_resultat 'Paquets' \"${KJEMO_P}\" 'PROBLEME' 'absent' \\",
    '            "nfs-kernel-server n est PAS installe : cette machine ne peut rien exporter. « nfs-common » ne suffit pas — c est le paquet CLIENT, celui qui permet de MONTER un partage distant. A taper soi-meme : « sudo apt install nfs-kernel-server »."',
    '        else',
    "          kjemo_resultat 'Paquets' \"${KJEMO_P}\" 'ATTENTION' 'absent' \\",
    '            "nfs-common n est pas installe. Ce n est pas requis pour SERVIR, mais sans lui cette machine ne peut pas monter un export pour s eprouver elle-meme."',
    '        fi',
    '        ;;',
    '    esac',
    '  done',
    'else',
    "  kjemo_resultat 'Paquets' 'dpkg-query' 'IGNORE' 'absent' \\",
    "    'dpkg-query est introuvable : l etat des paquets n a PAS ete mesure. Une absence de mesure n est pas une installation reussie.'",
    'fi',
    '',
    '# L unite. Sur Ubuntu elle s appelle nfs-server.service ; « nfs-kernel-server »',
    '# en est un alias, et les deux noms circulent dans les memes tutoriels.',
    'if kjemo_dispo systemctl; then',
    '  KJEMO_ACTIF="$(systemctl is-active nfs-server 2>/dev/null || true)"',
    '  KJEMO_VOULU="$(systemctl is-enabled nfs-server 2>/dev/null || true)"',
    '  if [ "${KJEMO_ACTIF}" = \'active\' ]; then',
    '    KJEMO_SERVICE_OK=1',
    "    kjemo_resultat 'Unite' 'nfs-server' 'OK' \"${KJEMO_ACTIF} / ${KJEMO_VOULU:-inconnu}\" \\",
    '      "nfs-server est actif (demarrage au boot : ${KJEMO_VOULU:-inconnu})."',
    '  else',
    "    kjemo_resultat 'Unite' 'nfs-server' 'PROBLEME' \"${KJEMO_ACTIF:-inconnu}\" \\",
    '      "nfs-server n est pas actif (${KJEMO_ACTIF:-inconnu}) : aucun client ne montera quoi que ce soit, quelle que soit la ligne du fichier. A taper soi-meme : « sudo systemctl enable --now nfs-server »."',
    '  fi',
    '  KJEMO_RPCBIND="$(systemctl is-active rpcbind 2>/dev/null || true)"',
    '  if [ "${KJEMO_RPCBIND}" != \'active\' ]; then',
    "    kjemo_resultat 'Unite' 'rpcbind' 'ATTENTION' \"${KJEMO_RPCBIND:-inconnu}\" \\",
    '      "rpcbind n est pas actif (${KJEMO_RPCBIND:-inconnu}). NFSv4 seul peut s en passer — il n utilise que le port 2049 — mais showmount et tout client NFSv3 en dependent, et c est showmount qu on lance en premier pour diagnostiquer."',
    '  fi',
    'else',
    "  kjemo_resultat 'Unite' 'systemctl' 'IGNORE' 'absent' \\",
    "    'systemctl est introuvable : l etat du service n a PAS ete mesure.'",
    'fi',
    '',
    '# Les ports. 2049 est NFS lui-meme ; 111 est le portmapper, dont NFSv3 a',
    '# besoin pour annoncer ou joindre mountd.',
    'if kjemo_dispo ss; then',
    '  KJEMO_ECOUTE="$(ss -lntu 2>/dev/null || true)"',
    '  for KJEMO_PORT in 2049 111; do',
    '    if printf \'%s\\n\' "${KJEMO_ECOUTE}" | awk \'{print $5}\' | grep -qE ":${KJEMO_PORT}\\$"; then',
    "      kjemo_resultat 'Ports' \"${KJEMO_PORT}\" 'OK' 'en ecoute' \\",
    '        "Le port ${KJEMO_PORT} est en ecoute."',
    '    else',
    "      kjemo_resultat 'Ports' \"${KJEMO_PORT}\" 'ATTENTION' 'pas en ecoute' \\",
    '        "Le port ${KJEMO_PORT} n apparait pas dans ce qui ecoute. 2049 est NFS lui-meme ; 111 est le portmapper, dont NFSv3 et showmount dependent. L adresse locale est lue dans la colonne 5 de « ss -lntu », et non n importe ou sur la ligne : la colonne du PAIR contient « 0.0.0.0:* » sur chaque ligne et ferait croire a une ecoute qui n existe pas."',
    '    fi',
    '  done',
    'else',
    "  kjemo_resultat 'Ports' 'ss' 'IGNORE' 'absent' \\",
    "    'ss est introuvable : les ports en ecoute n ont PAS ete mesures.'",
    'fi',
    '',
    '# LE FICHIER. Et, juste apres, la TABLE — les deux separement, toujours.',
    'if [ -r "${KJEMO_EXPORTS}" ]; then',
    '  KJEMO_FICHIER_LISIBLE=1',
    '  KJEMO_LIGNES_EXP="${KJEMO_TMP}/lignes-exports.txt"',
    '  grep -vE \'^[[:space:]]*(#|$)\' -- "${KJEMO_EXPORTS}" > "${KJEMO_LIGNES_EXP}" || true',
    '  KJEMO_NB_EXP="$(wc -l < "${KJEMO_LIGNES_EXP}" | tr -d \' \')"',
    "  kjemo_resultat 'Fichier' \"${KJEMO_EXPORTS}\" 'OK' \"${KJEMO_NB_EXP} ligne(s) active(s)\" \\",
    '    "${KJEMO_EXPORTS} est lisible et contient ${KJEMO_NB_EXP} ligne(s) hors commentaires. Ce fichier est la SOURCE : la table reellement servie est /var/lib/nfs/etab, lue par rpc.mountd. Les deux peuvent differer."',
    'else',
    '  KJEMO_LIGNES_EXP="${KJEMO_TMP}/lignes-exports.txt"',
    '  : > "${KJEMO_LIGNES_EXP}"',
    "  kjemo_resultat 'Fichier' \"${KJEMO_EXPORTS}\" 'PROBLEME' 'illisible ou absent' \\",
    '    "${KJEMO_EXPORTS} n est pas lisible. Sur une machine ou nfs-kernel-server est installe, ce fichier existe et appartient a root : son absence signale une installation incomplete, et son illisibilite un manque de privileges."',
    'fi',
    '',
    '# LE VERDICT DU SOCLE — et il existe pour que les trois drapeaux soient LUS.',
    '#',
    '# Ce n est pas une coquetterie : ShellCheck a signale ces variables comme',
    '# assignees et jamais lues (SC2034), et il avait raison. La reponse du lot',
    '# est toujours la meme depuis le commit 15/n — on ne supprime pas le',
    '# drapeau, on ecrit la ligne de rapport qui manquait. Un drapeau mort est',
    '# une verification dont personne ne voit le resultat.',
    'if [ "${KJEMO_PAQUET_OK}" -eq 1 ] && [ "${KJEMO_SERVICE_OK}" -eq 1 ] \\',
    '  && [ "${KJEMO_FICHIER_LISIBLE}" -eq 1 ]; then',
    "  kjemo_resultat 'Socle' 'Verdict' 'OK' 'paquet, service et fichier' \\",
    '    "Les trois conditions de base tiennent : le paquet SERVEUR est installe, nfs-server est actif, et le fichier des exports est lisible. Ce qui reste a verifier est propre a l export lui-meme."',
    'else',
    "  kjemo_resultat 'Socle' 'Verdict' 'ATTENTION' \"paquet=${KJEMO_PAQUET_OK} service=${KJEMO_SERVICE_OK} fichier=${KJEMO_FICHIER_LISIBLE}\" \\",
    '    "Le socle n est pas complet (paquet serveur=${KJEMO_PAQUET_OK}, service actif=${KJEMO_SERVICE_OK}, fichier lisible=${KJEMO_FICHIER_LISIBLE} ; 1 signifie en place). Tant qu un de ces trois points manque, le reste du rapport decrit une machine qui n exportera rien, et il faut lire les lignes ci-dessus avant celles qui suivent."',
    'fi',
    '',
  ];
}

/**
 * L'audit des lignes déjà présentes — la partie que personne ne fait.
 *
 * Elle ne corrige rien. Elle NOMME, et elle explique pourquoi c'est grave,
 * parce qu'un « * » dans /etc/exports ne produit aucun symptôme : tout marche,
 * et c'est exactement le problème.
 */
function blocAuditExports() {
  return [
    '# ---------------------------------------------------------------------------',
    '# AUDIT DES LIGNES DEJA PRESENTES',
    '#',
    '# Aucune de ces lignes ne produit de symptome : un export trop ouvert',
    '# FONCTIONNE. C est pour cela qu on ne le decouvre pas en testant, et',
    '# pour cela que cet audit existe.',
    '#',
    '# Il LIT. Il ne corrige rien, et ne propose aucune correction automatique :',
    '# retirer une ligne d export coupe un montage en cours chez quelqu un.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_N_ETOILE=0',
    'KJEMO_N_JOKER=0',
    'KJEMO_N_ZERO=0',
    'KJEMO_N_NOSQUASH=0',
    'KJEMO_N_ALLSQUASH=0',
    'KJEMO_N_ASYNC=0',
    'if [ "${KJEMO_FICHIER_LISIBLE}" -eq 1 ]; then',
    '  KJEMO_N_ETOILE="$(grep -cE \'(^|[[:space:]])\\*(\\(|[[:space:]]|$)\' -- "${KJEMO_LIGNES_EXP}" || true)"',
    // Trois formes de joker, et la premiere version de ce motif en manquait
    // une : « *.labo.local(rw) », ou l etoile ouvre le jeton. Le banc l a
    // trouve, et c est exactement ce qu on lui demande. Le « * » SEUL n est
    // pas compte ici : il a sa propre ligne, et le compter deux fois ferait
    // croire a deux defauts la ou il n y en a qu un.
    '  KJEMO_N_JOKER="$(grep -cE \'(^|[[:space:]])[^[:space:]]*[?[][^[:space:]]*\\(|(^|[[:space:]])[^[:space:]]*\\*[^[:space:]]+\\(|(^|[[:space:]])[^[:space:]]+\\*[^[:space:]]*\\(\' -- "${KJEMO_LIGNES_EXP}" || true)"',
    '  KJEMO_N_ZERO="$(grep -cE \'/0(\\(|[[:space:]]|$)\' -- "${KJEMO_LIGNES_EXP}" || true)"',
    '  KJEMO_N_NOSQUASH="$(grep -c \'no_root_squash\' -- "${KJEMO_LIGNES_EXP}" || true)"',
    '  KJEMO_N_ALLSQUASH="$(grep -c \'all_squash\' -- "${KJEMO_LIGNES_EXP}" || true)"',
    '  KJEMO_N_ASYNC="$(grep -cE \'[(,]async[,)]\' -- "${KJEMO_LIGNES_EXP}" || true)"',
    '',
    '  if [ "${KJEMO_N_ETOILE}" -gt 0 ]; then',
    "    kjemo_resultat 'Audit' 'Export vers *' 'PROBLEME' \"${KJEMO_N_ETOILE} ligne(s)\" \\",
    '      "${KJEMO_N_ETOILE} ligne(s) de ${KJEMO_EXPORTS} exportent vers « * ». exports(5) decrit cette entree comme « anonymous », qui « will match all clients » : toute machine joignant le port 2049 obtient le partage. Et NFSv3 en sec=sys fait confiance a l UID que le client ANNONCE — il suffit donc d etre root sur sa propre machine. Rien n a ete modifie : retirer une ligne d export coupe les montages en cours."',
    '  else',
    "    kjemo_resultat 'Audit' 'Export vers *' 'OK' 'aucune' \\",
    "      'Aucune ligne n exporte vers « * ».'",
    '  fi',
    '',
    '  if [ "${KJEMO_N_JOKER}" -gt 0 ]; then',
    "    kjemo_resultat 'Audit' 'Jokers' 'ATTENTION' \"${KJEMO_N_JOKER} ligne(s)\" \\",
    '      "${KJEMO_N_JOKER} ligne(s) utilisent un joker dans le nom du client. exports(5) previent que « * » et « ? » attrapent AUSSI les points d un nom de domaine : « *.cs.foo.edu » couvre donc tous les sous-domaines, et non la seule liste qu on avait en tete. Ce controle est une lecture de motif, pas une analyse de la grammaire d exports(5) : relis les lignes signalees avant de conclure."',
    '  fi',
    '',
    '  if [ "${KJEMO_N_ZERO}" -gt 0 ]; then',
    "    kjemo_resultat 'Audit' 'Prefixe /0' 'PROBLEME' \"${KJEMO_N_ZERO} ligne(s)\" \\",
    '      "${KJEMO_N_ZERO} ligne(s) portent un prefixe /0. C est « * » ecrit en notation CIDR, avec l apparence d une restriction : « 0.0.0.0/0 » se lit comme un reseau et designe l Internet entier. C est plus dangereux que « * », qui au moins se voit."',
    '  fi',
    '',
    '  if [ "${KJEMO_N_NOSQUASH}" -gt 0 ]; then',
    "    kjemo_resultat 'Audit' 'no_root_squash' 'PROBLEME' \"${KJEMO_N_NOSQUASH} ligne(s)\" \\",
    '      "${KJEMO_N_NOSQUASH} ligne(s) portent no_root_squash. exports(5) : le squash de root « is the default, and can be turned off with no_root_squash », option « mainly useful for diskless clients ». La desactiver donne a root d une machine CLIENTE les droits de root sur les fichiers exportes — y compris celui de poser un binaire setuid. Combine a un export large, c est une prise de controle, pas une facilite."',
    '  fi',
    '',
    '  if [ "${KJEMO_N_ALLSQUASH}" -gt 0 ]; then',
    "    kjemo_resultat 'Audit' 'all_squash' 'INFO' \"${KJEMO_N_ALLSQUASH} ligne(s)\" \\",
    '      "${KJEMO_N_ALLSQUASH} ligne(s) portent all_squash : tous les comptes clients sont ramenes a l utilisateur anonyme (65534 par defaut, modifiable par anonuid et anongid). C est un choix legitime pour un depot public ; c en est un mauvais pour des dossiers personnels, ou il efface la distinction entre les gens."',
    '  fi',
    '',
    '  if [ "${KJEMO_N_ASYNC}" -gt 0 ]; then',
    "    kjemo_resultat 'Audit' 'async' 'ATTENTION' \"${KJEMO_N_ASYNC} ligne(s)\" \\",
    '      "${KJEMO_N_ASYNC} ligne(s) portent async. exports(5) : cette option « allows the NFS server to violate the NFS protocol and reply to requests before any changes made by that request have been committed to stable storage », au prix qu un arret brutal « can cause data to be lost or corrupted ». Le gain est reel, la perte aussi : c est une decision, pas un reglage de performance anodin."',
    '  fi',
    'fi',
    '',
  ];
}

/**
 * La table en service, et ce qu'un client voit — deux choses distinctes.
 */
function blocTableEnService() {
  return [
    '# ---------------------------------------------------------------------------',
    '# LA TABLE EN SERVICE, ET CE QU UN CLIENT VOIT',
    '#',
    '# « exportfs -v » affiche la table reellement servie, avec ses options',
    '# EFFECTIVES — celles qu on n a pas ecrites comprises. Les defauts, que la',
    '# page de manuel d exportfs(8) donne explicitement, sont',
    '# sync,ro,root_squash,wdelay : un export dont on a oublie « rw » est donc',
    '# en lecture seule, et le client dira « Read-only file system » sans que',
    '# rien n ait echoue.',
    '#',
    '# « showmount -e » interroge le demon de montage, c est-a-dire ce qu un',
    '# client DECOUVRE. Les deux peuvent differer, et l ecart est l information.',
    '# ---------------------------------------------------------------------------',
    'if kjemo_dispo exportfs; then',
    "  KJEMO_TABLE=''",
    '  KJEMO_TABLE="$(exportfs -v 2>&1 || true)"',
    '  if [ -n "${KJEMO_TABLE}" ]; then',
    "    kjemo_resultat 'Table' 'exportfs -v' 'OK' \"${KJEMO_TABLE}\" \\",
    '      "Table en service : ${KJEMO_TABLE}. Ce sont les options EFFECTIVES, defauts compris (sync,ro,root_squash,wdelay). Si une ligne du fichier n apparait pas ici, c est que la table n a pas ete resynchronisee depuis la derniere modification du fichier."',
    '  else',
    "    kjemo_resultat 'Table' 'exportfs -v' 'ATTENTION' 'vide' \\",
    '      "La table en service est VIDE : rien n est exporte en ce moment, meme si ${KJEMO_EXPORTS} contient des lignes. C est l etat normal juste apres une modification du fichier et avant son application."',
    '  fi',
    'else',
    "  kjemo_resultat 'Table' 'exportfs' 'IGNORE' 'absent' \\",
    "    'exportfs est introuvable : la table en service n a PAS ete lue. Ce binaire vient avec nfs-kernel-server.'",
    'fi',
    '',
    'if kjemo_dispo showmount; then',
    "  KJEMO_VU=''",
    '  KJEMO_VU="$(showmount -e localhost 2>&1 || true)"',
    "  kjemo_resultat 'Vue client' 'showmount -e localhost' 'OK' \"${KJEMO_VU}\" \\",
    '    "Ce qu un client DECOUVRE en interrogeant cette machine : ${KJEMO_VU}. showmount parle a rpc.mountd ; s il echoue alors qu exportfs -v montre des exports, cherche du cote de rpcbind et du pare-feu, pas du cote du fichier."',
    'else',
    "  kjemo_resultat 'Vue client' 'showmount' 'IGNORE' 'absent' \\",
    "    'showmount est introuvable (paquet nfs-common) : la vue cliente n a PAS ete mesuree.'",
    'fi',
    '',
    'if kjemo_dispo rpcinfo; then',
    "  KJEMO_RPC=''",
    '  KJEMO_RPC="$(rpcinfo -p localhost 2>&1 | awk \'{print $5}\' | sort -u | paste -sd, - || true)"',
    "  kjemo_resultat 'RPC' 'rpcinfo -p' 'OK' \"${KJEMO_RPC}\" \\",
    '    "Programmes RPC enregistres : ${KJEMO_RPC}. On y cherche « nfs » et « mountd ». Leur absence alors que le service est actif pointe rpcbind, et non la configuration des exports."',
    'else',
    "  kjemo_resultat 'RPC' 'rpcinfo' 'IGNORE' 'absent' \\",
    "    'rpcinfo est introuvable : les enregistrements RPC n ont PAS ete lus.'",
    'fi',
    '',
  ];
}

// ===========================================================================
// 1. nfs-server-readiness
// ===========================================================================

const nfsServerReadiness = {
  id: 'nfs-server-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'NFS',
  title: 'Vérifier qu’une machine peut exporter en NFS — et auditer ce qu’elle exporte déjà',
  risk: 'diagnostic',
  summary: 'Lit les deux paquets et leurs rôles — nfs-common est le CLIENT —, l’unité nfs-server, rpcbind, les ports 2049 et 111, le fichier /etc/exports et, séparément, la table réellement en service lue par exportfs -v, puis ce qu’un client découvre par showmount. AUDITE les lignes déjà présentes : « * », jokers, « /0 », no_root_squash, all_squash et async sont nommés avec leur conséquence. Examine au besoin un dossier envisagé et la résolution d’un client. N’installe rien, n’exporte rien, n’applique rien.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'nfs-kernel-server — le SERVEUR : rpc.nfsd, rpc.mountd, exportfs (apt install nfs-kernel-server)',
    'nfs-common — le CLIENT : mount.nfs, showmount',
    'rpcbind — le portmapper, requis par NFSv3 et par showmount',
  ],
  privileges: 'aucun pour les paquets, les unités, les ports et la table en service. root est souvent nécessaire pour LIRE /etc/exports — cette section est alors annoncée PROBLEME, jamais passée sous silence',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'nfs-server.service et rpcbind.service',
  limites: [
    'LIT seulement. N’installe aucun paquet, ne démarre aucune unité, n’ouvre aucun port, n’écrit pas une ligne dans /etc/exports, et n’exécute JAMAIS exportfs -ra — qui n’est pas une vérification mais une application.',
    'Ne corrige aucune ligne existante, même manifestement dangereuse. Retirer une ligne d’export coupe les montages en cours chez les gens qui s’en servent : c’est une décision qui se prend en sachant qui est connecté.',
    'L’audit des jokers est une lecture de motif, pas une analyse de la grammaire complète d’exports(5). Il signale ce qu’il faut relire ; il ne prétend pas remplacer la lecture.',
    'Ne teste pas un montage depuis un vrai client. La machine peut être prête et le client échouer pour une raison qui lui est propre — version du protocole, pare-feu intermédiaire, ou résolution de nom.',
    'Ne dit pas si les permissions Unix du dossier conviennent aux comptes du client : NFS ne les outrepasse pas, et les UID des deux machines doivent correspondre pour que la question ait un sens.',
  ],

  fields: [
    {
      id: 'cheminEnvisage',
      label: 'Dossier à exporter (vide = non examiné)',
      type: 'text',
      default: '',
      placeholder: '/srv/nfs/partage',
      optionnel: true,
      help: 'Si renseigné, l’assistant lit son existence, son mode, son propriétaire, et s’il est la racine d’un système de fichiers ou un simple sous-dossier — ce qui décide de la question du subtree_check.',
    },
    {
      id: 'clientEnvisage',
      label: 'Client ou réseau envisagé (vide = non examiné)',
      type: 'text',
      default: '',
      placeholder: '192.168.30.0/24',
      optionnel: true,
      help: 'Une adresse, un réseau CIDR ou un nom d’hôte. Les jokers et /0 sont refusés dès le formulaire, y compris pour un simple examen : les écrire une fois, c’est les copier ensuite.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const c = String(v.cheminEnvisage ?? '').trim();
    if (c !== '') {
      const r = validateCheminAbsolu(c, 'Le dossier à exporter');
      if (!r.ok) {
        errors.cheminEnvisage = r.error;
      } else {
        const propre = r.value.replace(/\/+$/, '') || '/';
        if (EXPORT_REFUSE.includes(propre)) {
          errors.cheminEnvisage = `« ${propre} » ne s’exporte pas, même comme simple candidat à l’examen. L’exemple de la page de manuel d’exports(5) commence par « / master(rw) » : il est recopié bien plus souvent qu’il n’est compris. Exporte un dossier de données dédié, par exemple /srv/nfs/partage.`;
        }
      }
    }
    const cl = String(v.clientEnvisage ?? '').trim();
    if (cl !== '') {
      const r = validateClientNfs(cl, 'Le client envisagé');
      if (!r.ok) errors.clientEnvisage = r.error;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const chemin = String(v.cheminEnvisage ?? '').trim().replace(/\/+$/, '');
    const client = String(v.clientEnvisage ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Verifier qu une machine peut exporter en NFS, et auditer ses exports',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({ exige: false }),
      ...blocVariablesBash([
        ['KJEMO_EXPORTS', shQuote('/etc/exports')],
        ['KJEMO_CHEMIN', shQuote(chemin)],
        ['KJEMO_CLIENT', shQuote(client)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Fichier des exports' \"${KJEMO_EXPORTS}\"",
      `  printf '%s\\t%s\\n' 'Dossier examine' ${shQuote(chemin || '(aucun)')}`,
      `  printf '%s\\t%s\\n' 'Client examine' ${shQuote(client || '(aucun)')}`,
      "  printf '%s\\t%s\\n' 'Ecriture' 'AUCUNE - ce script lit'",
      "  printf '%s\\t%s\\n' 'Application' 'JAMAIS - exportfs -ra n est pas lance'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      ...blocNfsBase(),
      ...blocAuditExports(),
      ...blocTableEnService(),

      '# ---------------------------------------------------------------------------',
      '# LE PARE-FEU',
      '#',
      '# UFW connait le profil « nfs » sur Ubuntu. Un pare-feu actif sans regle',
      '# pour 2049 donne exactement le symptome d un export absent, et on cherche',
      '# alors dans le fichier.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo ufw; then',
      "  KJEMO_UFW=''",
      '  KJEMO_UFW="$(ufw status 2>/dev/null || true)"',
      '  if printf \'%s\\n\' "${KJEMO_UFW}" | grep -qi \'^Status: active\'; then',
      '    if printf \'%s\\n\' "${KJEMO_UFW}" | grep -qiE \'2049|nfs\'; then',
      "      kjemo_resultat 'Pare-feu' 'UFW' 'OK' 'actif, regle presente' \\",
      "        'UFW est actif et une regle mentionne NFS ou le port 2049.'",
      '    else',
      "      kjemo_resultat 'Pare-feu' 'UFW' 'PROBLEME' 'actif, aucune regle NFS' \\",
      '        "UFW est ACTIF et aucune regle ne mentionne NFS ni le port 2049 : le client echouera a monter, avec le meme message que si l export n existait pas. A taper soi-meme, en nommant le reseau plutot que « tout » : « sudo ufw allow from 192.168.30.0/24 to any port nfs »."',
      '    fi',
      '  else',
      "    kjemo_resultat 'Pare-feu' 'UFW' 'INFO' 'inactif' \\",
      "      'UFW est installe et inactif : il ne bloque rien, et il ne protege rien non plus.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Pare-feu' 'UFW' 'IGNORE' 'absent' \\",
      "    'ufw est introuvable : l etat du pare-feu n a PAS ete mesure. Une autre barriere — nftables, ou un equipement entre les deux machines — peut exister.'",
      'fi',
      '',

      '# ---------------------------------------------------------------------------',
      '# LE DOSSIER ENVISAGE, SI ON EN A DEMANDE UN',
      '#',
      '# La question qui decide du subtree_check : ce dossier est-il la RACINE',
      '# d un systeme de fichiers, ou un sous-dossier ? exports(5) :',
      '# « Normally you should only export only the root of a filesystem. »',
      '# ---------------------------------------------------------------------------',
      'if [ -n "${KJEMO_CHEMIN}" ]; then',
      '  if [ -d "${KJEMO_CHEMIN}" ]; then',
      '    KJEMO_STAT="$(stat -c \'%a %U:%G\' -- "${KJEMO_CHEMIN}" 2>/dev/null || true)"',
      "    kjemo_resultat 'Dossier' 'Existence' 'OK' \"${KJEMO_STAT}\" \\",
      '      "Le dossier ${KJEMO_CHEMIN} existe : ${KJEMO_STAT}. NFS n outrepasse pas les permissions Unix, et avec sec=sys il compare l UID ANNONCE par le client a celui des fichiers : les deux machines doivent s accorder sur les UID pour que ces permissions veuillent dire quelque chose."',
      '    if kjemo_dispo findmnt; then',
      '      KJEMO_MONT="$(findmnt -n -o TARGET --target "${KJEMO_CHEMIN}" 2>/dev/null | head -n 1 || true)"',
      '      if [ "${KJEMO_MONT}" = "${KJEMO_CHEMIN}" ]; then',
      "        kjemo_resultat 'Dossier' 'Racine de systeme de fichiers' 'OK' \"${KJEMO_MONT}\" \\",
      '        "${KJEMO_CHEMIN} est la racine d un systeme de fichiers. C est le cas recommande par exports(5) : « Normally you should only export only the root of a filesystem »."',
      '      else',
      "        kjemo_resultat 'Dossier' 'Racine de systeme de fichiers' 'ATTENTION' \"appartient a ${KJEMO_MONT:-inconnu}\" \\",
      '        "${KJEMO_CHEMIN} est un SOUS-DOSSIER du systeme de fichiers monte sur ${KJEMO_MONT:-inconnu}. exports(5) recommande de n exporter que la racine d un systeme de fichiers ; exporter un sous-dossier fonctionne, mais fait entrer en jeu le subtree_check, dont la page dit qu il « tends to cause more problems than it is worth ». La consequence pratique : des erreurs d acces sur des fichiers renommes pendant qu un client les a ouverts."',
      '      fi',
      '    else',
      "      kjemo_resultat 'Dossier' 'Racine de systeme de fichiers' 'IGNORE' 'findmnt absent' \\",
      "        'findmnt est introuvable : impossible de dire si ce dossier est la racine d un systeme de fichiers ou un sous-dossier.'",
      '    fi',
      '    if grep -qF -- "${KJEMO_CHEMIN}" "${KJEMO_LIGNES_EXP}" 2>/dev/null; then',
      "      kjemo_resultat 'Dossier' 'Deja dans le fichier' 'ATTENTION' 'une ligne le mentionne' \\",
      '        "Une ligne de ${KJEMO_EXPORTS} mentionne deja ${KJEMO_CHEMIN}. Ajouter une seconde ligne pour le meme chemin est legal — on exporte souvent le meme dossier a plusieurs clients — mais deux lignes pour le MEME couple chemin/client se recouvrent, et c est la derniere qui compte."',
      '    fi',
      '  else',
      "    kjemo_resultat 'Dossier' 'Existence' 'PROBLEME' 'absent' \\",
      '      "Le dossier ${KJEMO_CHEMIN} n existe pas. Une ligne d export vers un chemin inexistant est acceptee par le fichier et refusee a l application : « exportfs: Failed to stat ... No such file or directory ». A taper soi-meme : « sudo mkdir -p ${KJEMO_CHEMIN} »."',
      '  fi',
      'fi',
      '',

      '# ---------------------------------------------------------------------------',
      '# LE CLIENT ENVISAGE, SI ON EN A DEMANDE UN',
      '# ---------------------------------------------------------------------------',
      'if [ -n "${KJEMO_CLIENT}" ]; then',
      '  case "${KJEMO_CLIENT}" in',
      '    */*)',
      "      kjemo_resultat 'Client' \"${KJEMO_CLIENT}\" 'OK' 'reseau CIDR' \\",
      '        "${KJEMO_CLIENT} est un reseau en notation CIDR : exports(5) accepte « address/netmask », en decimal pointe ou en longueur de prefixe. Un reseau se verifie en comptant ce qu il contient, pas en le lisant : /24 vaut 254 machines, /16 en vaut 65 534."',
      '      ;;',
      '    *[0-9].[0-9]*)',
      "      kjemo_resultat 'Client' \"${KJEMO_CLIENT}\" 'OK' 'adresse ou nom' \\",
      '        "${KJEMO_CLIENT} sera inscrit tel quel dans la ligne d export."',
      '      ;;',
      '    *)',
      '      if kjemo_dispo getent; then',
      '        KJEMO_RESOL="$(getent hosts -- "${KJEMO_CLIENT}" 2>/dev/null | head -n 1 || true)"',
      '        if [ -n "${KJEMO_RESOL}" ]; then',
      "          kjemo_resultat 'Client' \"${KJEMO_CLIENT}\" 'OK' \"${KJEMO_RESOL}\" \\",
      '            "${KJEMO_CLIENT} se resout en : ${KJEMO_RESOL}. Un client designe par son NOM depend de la resolution au moment de la demande de montage : si le DNS tombe, l export cesse de reconnaitre la machine. Une adresse ou un reseau ne dependent de rien."',
      '        else',
      "          kjemo_resultat 'Client' \"${KJEMO_CLIENT}\" 'PROBLEME' 'ne se resout pas' \\",
      '            "${KJEMO_CLIENT} ne se resout pas depuis cette machine. Un nom qui ne se resout pas dans une ligne d export ne refuse pas le client : il ne le reconnait tout simplement jamais, et le message cote client est « access denied by server »."',
      '        fi',
      '      fi',
      '      ;;',
      '  esac',
      'fi',
      '',

      '# ---------------------------------------------------------------------------',
      '# CE QUE CE SCRIPT N A PAS FAIT, ET POURQUOI C EST ECRIT',
      '# ---------------------------------------------------------------------------',
      "kjemo_resultat 'Portee' 'Application' 'ATTENTION' 'exportfs -ra non lance' \\",
      "  'Ce script n a rien applique, et n a pas lance « exportfs -ra ». Cette commande n est PAS une verification : exportfs(8) ecrit qu elle reexporte tout, synchronise /var/lib/nfs/etab avec le fichier, en RETIRE les entrees supprimees du fichier, et retire de la table du noyau celles qui ne sont plus valides. Un export ajoute a la main sans passer par le fichier disparait au premier -ra. Elle s execute en sachant cela, pas pour voir.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-nfs-prerequis' }),
    ]);
  },

  gui: [
    'nfs-common est le CLIENT, nfs-kernel-server est le SERVEUR : installer le premier et chercher pourquoi rien ne s’exporte est le premier quart d’heure perdu.',
    '/etc/exports est un fichier ; la table servie est /var/lib/nfs/etab, lue par rpc.mountd. Les deux peuvent diverger.',
    'Les options par défaut d’un export sont sync, ro, root_squash, wdelay : un export sans « rw » est en lecture seule, et le client dira « Read-only file system ».',
    '« exportfs -v » montre les options EFFECTIVES, défauts compris. C’est la vraie réponse à « qu’est-ce que j’exporte ».',
    '« showmount -e localhost » montre ce qu’un client découvre. L’écart avec exportfs -v pointe rpcbind ou le pare-feu.',
    'Un « * » dans /etc/exports ne produit aucun symptôme : tout fonctionne. C’est pour cela qu’il faut le chercher.',
    '« /0 » est « * » déguisé en réseau. Il a l’air d’une restriction ; il n’en est pas une.',
    'no_root_squash donne à root du client les droits de root sur les fichiers exportés. La page de manuel le réserve aux clients sans disque.',
    'NFSv3 en sec=sys fait confiance à l’UID annoncé par le client : la liste d’accès est le vrai verrou, pas les permissions.',
    '« exportfs -ra » applique et RETIRE. Ce n’est pas une vérification, quoi qu’en disent les tutoriels.',
  ],

  keywords: ['nfs', 'exports', 'exportfs', 'showmount', 'rpcinfo', 'rpcbind',
    'nfs-kernel-server', 'nfs-common', 'root_squash', 'no_root_squash',
    'subtree_check', 'etab', 'mountd', '2049', 'linux', 'ubuntu', 'audit'],

  requiresAdmin: false,
  prereqs: [
    'Aucun privilège pour les paquets, les unités, les ports et la table en service.',
    'root pour LIRE /etc/exports sur la plupart des installations : sans lui, la section est annoncée PROBLEME et l’audit ne tourne pas.',
    'nfs-kernel-server installé pour que « exportfs » existe ; nfs-common pour que « showmount » existe.',
  ],

  commonErrors: [
    {
      message: 'exportfs -v ne montre rien alors que /etc/exports contient des lignes',
      code: 'KJEMO',
      cause: 'La table en service n’a pas été resynchronisée depuis la modification du fichier. C’est l’état normal, pas une panne.',
      fix: 'Appliquer — en sachant que la commande applique et retire.',
      command: 'sudo exportfs -ra && exportfs -v',
    },
    {
      message: 'clnt_create: RPC: Program not registered',
      code: 'KJEMO',
      cause: 'showmount parle à rpc.mountd via rpcbind, et l’un des deux ne tourne pas.',
      fix: 'Vérifier rpcbind et nfs-server, dans cet ordre.',
      command: 'systemctl status rpcbind nfs-server; rpcinfo -p localhost',
    },
    {
      message: 'Le client monte et obtient « Read-only file system »',
      code: 'KJEMO',
      cause: 'L’option par défaut est « ro ». Sans « rw » explicite, l’export est en lecture seule, et rien n’a échoué.',
      fix: 'Lire les options effectives avant de soupçonner les permissions.',
      command: 'exportfs -v',
    },
    {
      message: 'access denied by server while mounting',
      code: 'KJEMO',
      cause: 'L’adresse du client ne correspond à aucune ligne — ou son nom ne se résout pas côté serveur.',
      fix: 'Comparer l’adresse réelle du client à la liste d’accès.',
      command: 'exportfs -v; getent hosts poste-01',
    },
    {
      message: 'Le montage reste bloqué sans message',
      code: 'KJEMO',
      cause: 'Un pare-feu entre les deux machines absorbe le trafic du port 2049 sans le refuser.',
      fix: 'Vérifier le pare-feu du serveur avant tout le reste.',
      command: 'sudo ufw status',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Les deux paquets sont distingués, et l’absence du paquet SERVEUR n’est pas masquée par la présence du paquet client.',
    'nfs-server et rpcbind sont rapportés séparément.',
    'Les ports 2049 et 111 sont cherchés dans la colonne de l’adresse LOCALE de ss, et non n’importe où sur la ligne.',
    'Le fichier /etc/exports et la table en service sont rapportés séparément, et l’écart est expliqué.',
    'Les lignes existantes sont auditées : « * », jokers, /0, no_root_squash, all_squash, async.',
    'Si un dossier a été demandé : existence, mode, propriétaire, et racine de système de fichiers ou sous-dossier.',
    'Si un client a été demandé : sa résolution, et ce que son absence de résolution provoquerait.',
    'Aucune écriture, aucune application, aucun exportfs -ra.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne corrige aucune ligne, même dangereuse — retirer un export coupe les montages en cours.',
    diagnostic: `# Le fichier, puis la table en service, puis la vue client :
cat /etc/exports
exportfs -v
showmount -e localhost
rpcinfo -p localhost | grep -E 'nfs|mount'`,
    command: `# Aucune modification a annuler par cet assistant.
#
# Pour retirer un export, et dans cet ordre :
#   1. savoir QUI est monte dessus, parce que la suite le coupera :
#        ss -tn state established '( sport = :2049 )'
#   2. retirer ou commenter la ligne dans /etc/exports
#   3. appliquer, en sachant que -ra retire aussi les exports
#      ajoutes a la main :
#        sudo exportfs -ra
#   4. RELIRE, parce qu une suppression ne prouve pas un etat :
#        exportfs -v
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Ne corrige pas un « * » en pleine journée sans savoir qui est monté : le client perd son montage au milieu d’une écriture.',
  },

  checks: [
    'Aucune écriture : /etc/exports intact, aucun paquet installé, aucune unité démarrée, aucun port ouvert.',
    'exportfs n’est appelé qu’avec « -v », qui affiche. Jamais avec -r, -a, -u ou -o, qui agissent.',
    'Le fichier et la table en service ne sont jamais confondus : deux contrôles distincts, avec leur écart expliqué.',
    'L’audit nomme « * », les jokers, « /0 » et no_root_squash, et dit la conséquence de chacun plutôt que de les classer « non recommandés ».',
    'L’audit est présenté comme une lecture de motif, et sa limite est écrite : il ne remplace pas la lecture de la grammaire d’exports(5).',
    'Les ports sont lus dans la colonne 5 de « ss -lntu » : la colonne du pair contient « 0.0.0.0:* » sur chaque ligne et ferait croire à une écoute inexistante.',
    'Les zones système sont refusées par le formulaire, même comme simple candidat à l’examen.',
    'Les jokers et /0 sont refusés dans le champ du client, y compris pour un examen.',
    'Les sections qui demandent root sont annoncées PROBLEME ou IGNORE quand root manque, jamais OK.',
  ],

  source: `${M}/man5/exports.5.html`,
  sources: [
    { label: 'exports(5) — format, listes d’accès, root_squash, async, subtree_check', url: `${M}/man5/exports.5.html` },
    { label: 'exportfs(8) — etab, options par défaut, ce que fait -r', url: `${M}/man8/exportfs.8.html` },
    { label: 'showmount(8) — ce qu’un client découvre', url: `${M}/man8/showmount.8.html` },
    { label: 'rpcinfo(8) — programmes RPC enregistrés', url: `${M}/man8/rpcinfo.8.html` },
    { label: 'rpc.mountd(8) — le démon qui lit etab', url: `${M}/man8/rpc.mountd.8.html` },
    { label: 'Ubuntu Server — Network File System (NFS)', url: DOCU },
  ],
};

// ===========================================================================
// 2. nfs-export-create
// ===========================================================================
//
// Celui qui écrit — et qui n'applique pas.
//
// L'ordre, qui est tout l'intérêt :
//
//   1. refuser si le paquet serveur manque, si le dossier n'existe pas, ou si
//      le couple chemin/client est DÉJÀ dans le fichier ;
//   2. assembler un candidat dans le dossier temporaire : le fichier actuel,
//      inchangé, PLUS la ligne à la fin ;
//   3. CONTRE-ÉPREUVE sur la ligne construite : aucun « * », aucun joker,
//      aucun « /0 », aucun « no_root_squash ». Ce contrôle est redondant avec
//      la validation du formulaire, et c'est voulu : un verrou qui ne se
//      vérifie qu'une fois est un verrou qu'on retire sans s'en apercevoir ;
//   4. afficher l'aperçu exact de la ligne ;
//   5. derrière la confirmation : sauvegarde vérifiée, remplacement, cmp,
//      RELECTURE du fichier en place, et restauration si la relecture échoue ;
//   6. s'arrêter. L'application est affichée, expliquée, et laissée à l'humain.
//
// L'étape 6 est le point de ce module, et elle est documentaire : il n'existe
// pas, dans exportfs(8) pour Ubuntu 24.04, d'option d'essai à blanc. On ne
// fabrique pas la garantie qui manque ; on écrit qu'elle manque.

const nfsExportCreate = {
  id: 'nfs-export-create',
  icon: '◆',
  category: CAT,
  subcategory: 'NFS',
  title: 'Préparer une ligne d’export NFS, écrite et relue — l’application reste manuelle',
  risk: 'caution',
  summary: 'Ajoute UNE ligne à /etc/exports sans en réécrire une seule existante, avec root_squash écrit explicitement et sans aucun joker possible. Refuse si le paquet serveur manque, si le dossier n’existe pas, ou si le couple dossier/client est déjà présent. Assemble un candidat dans le dossier temporaire, le contre-vérifie caractère par caractère, affiche l’aperçu exact, puis — derrière une confirmation exacte — sauvegarde, remplace, compare et RELIT, en restaurant si la relecture échoue. N’exécute JAMAIS exportfs -ra : cette commande applique et retire, et aucune option d’essai à blanc n’existe.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'nfs-kernel-server — rpc.nfsd, rpc.mountd, exportfs (apt install nfs-kernel-server)',
  ],
  privileges: 'root — /etc/exports appartient à root. Sans root, le script s’arrête avant toute écriture',
  privilegesRequis: 'root',
  readOnly: false,
  service: 'nfs-server.service',
  limites: [
    'N’APPLIQUE PAS. Il écrit la ligne et s’arrête. exportfs(8) pour Ubuntu 24.04 n’offre aucune option d’essai à blanc : « -r » réexporte tout, synchronise etab avec le fichier, et en RETIRE les entrées supprimées — c’est une application, pas une vérification. L’assistant affiche la commande et ce qu’elle fait ; il ne la lance pas à la place de quelqu’un.',
    'Écrire dans /etc/exports n’a aucun effet sur le service tant qu’on n’applique pas. C’est ce qui rend cette coupure sûre, et c’est aussi pourquoi il faut le dire : croire avoir partagé un dossier sans avoir appliqué fait chercher la panne du mauvais côté.',
    'NE RÉÉCRIT AUCUNE LIGNE EXISTANTE. Il ajoute à la fin. Le fichier contient souvent des exports que personne ne doit toucher, et les perdre coûte plus que la ligne ne rapporte.',
    'N’OFFRE PAS no_root_squash. Pas de champ, donc pas de valeur à refuser : la ligne porte root_squash écrit en toutes lettres, pour que la lecture montre la décision.',
    'N’offre aucun joker, aucun « * », aucun « /0 ». Ils sont refusés par le formulaire ET contre-vérifiés dans le script.',
    'Ne crée pas le dossier à exporter et ne touche pas à ses permissions : il refuse et affiche la commande. NFS n’outrepasse pas les permissions Unix, et les corriger à l’aveugle toucherait à tout ce que le dossier contient.',
    'N’ouvre aucun port et ne touche pas au pare-feu.',
    'Ne vérifie pas que les UID des deux machines correspondent. Avec sec=sys, c’est pourtant ce qui décide de l’accès réel aux fichiers — et cela se règle hors de NFS.',
  ],

  fields: [
    {
      id: 'chemin',
      label: 'Dossier à exporter',
      type: 'text',
      default: '/srv/nfs/partage',
      placeholder: '/srv/nfs/partage',
      help: 'Un dossier de données dédié, qui doit DÉJÀ exister. Les zones système sont refusées : exporter / ou /home livre la machine entière à qui atteint le port 2049.',
    },
    {
      id: 'client',
      label: 'Client autorisé (adresse, réseau CIDR ou nom d’hôte)',
      type: 'text',
      default: '192.168.30.0/24',
      placeholder: '192.168.30.0/24',
      help: 'Le seul vrai verrou d’un export NFSv3 en sec=sys : le serveur croit l’UID que le client annonce, donc tout dépend de qui a le droit de parler. « * », les jokers et /0 sont refusés.',
    },
    {
      id: 'ecriture',
      label: 'Autoriser l’écriture',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Le défaut d’un export est « ro ». L’assistant écrit toujours le choix en toutes lettres — « ro » ou « rw » — parce qu’une option absente est une option qu’on croit avoir posée.',
    },
    {
      id: 'squashTous',
      label: 'Ramener tous les comptes à l’utilisateur anonyme (all_squash)',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Utile pour un dépôt public en lecture : tout le monde accède sous l’identité anonyme (65534). Mauvais pour des dossiers de travail, où il efface la distinction entre les gens. root reste squashé dans les deux cas.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le chemin du dossier à exporter',
      type: 'text',
      default: '',
      placeholder: '/srv/nfs/partage',
      optionnel: true,
      help: 'Le verrou est dans le script, pas dans ce formulaire : sans cette phrase exacte, le script diagnostique, prépare, affiche l’aperçu, et n’écrit rien du tout.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const rc = validateCheminAbsolu(v.chemin, 'Le dossier à exporter');
    if (!rc.ok) {
      errors.chemin = rc.error;
    } else {
      const propre = rc.value.replace(/\/+$/, '') || '/';
      if (EXPORT_REFUSE.includes(propre)) {
        errors.chemin = `« ${propre} » ne s’exporte pas. Un client reconnu obtiendrait la machine entière — ou, pour /home, les dossiers personnels de tout le monde d’un coup. Exporte un dossier de données dédié, par exemple /srv/nfs/partage.`;
      }
      if (/\s/.test(propre)) {
        errors.chemin = 'Un chemin contenant une espace demanderait des guillemets dans /etc/exports, et cet assistant ne les écrit pas : renomme le dossier plutôt que de compter sur la citation.';
      }
    }
    const rcl = validateClientNfs(v.client, 'Le client autorisé');
    if (!rcl.ok) errors.client = rcl.error;
    const re = validateChoix(v.ecriture, ['Oui', 'Non'], 'L’autorisation d’écriture');
    if (!re.ok) errors.ecriture = re.error;
    const rs = validateChoix(v.squashTous, ['Oui', 'Non'], 'Le choix all_squash');
    if (!rs.ok) errors.squashTous = rs.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const chemin = String(v.chemin).trim().replace(/\/+$/, '') || '/';
    const client = String(v.client).trim();
    const ecriture = String(v.ecriture) === 'Oui';
    const squashTous = String(v.squashTous) === 'Oui';

    // Les options, dans un ordre fixe et toutes ÉCRITES — défauts compris.
    // Une option absente est une option qu'on croit avoir posée : exportfs(8)
    // donne sync,ro,root_squash,wdelay comme valeurs par défaut, et personne
    // ne les a en tête au moment de relire une ligne.
    const options = [
      ecriture ? 'rw' : 'ro',
      'sync',
      'root_squash',
      'no_subtree_check',
      ...(squashTous ? ['all_squash'] : []),
    ];
    const ligneExport = `${chemin} ${client}(${options.join(',')})`;

    const lignesAjout = [
      '',
      '# Ligne preparee par KJEMO IT Toolkit.',
      '# root_squash est ECRIT, bien qu il soit le defaut : une option que l on',
      '# lit est une decision ; une option absente est une supposition.',
      '# no_subtree_check est ecrit parce que, sans l un des deux, exportfs',
      '# avertit que le changement de defaut est en attente.',
      ligneExport,
    ];

    return assemblerSh([
      ...enteteBash({
        titre: 'Preparer une ligne d export NFS, ecrite et relue, sans application',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: '/etc/exports appartient a root',
      }),
      ...blocGardienChemin(),
      ...blocSauvegardeFichier(),
      ...blocVariablesBash([
        ['KJEMO_EXPORTS', shQuote('/etc/exports')],
        ['KJEMO_CHEMIN', shQuote(chemin)],
        ['KJEMO_CLIENT', shQuote(client)],
        ['KJEMO_LIGNE', shQuote(ligneExport)],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Dossier exporte' \"${KJEMO_CHEMIN}\"",
      "  printf '%s\\t%s\\n' 'Client autorise' \"${KJEMO_CLIENT}\"",
      `  printf '%s\\t%s\\n' 'Options' ${shQuote(options.join(','))}`,
      "  printf '%s\\t%s\\n' 'Squash de root' 'root_squash - ECRIT, et sans option pour le retirer'",
      "  printf '%s\\t%s\\n' 'Application' 'MANUELLE - ce script n execute jamais exportfs -ra'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# Les drapeaux de la porte finale, tous definis AVANT la premiere',
      '# condition : sous « set -u », un drapeau non defini arreterait le script',
      '# au moment le moins pratique.',
      'KJEMO_DOSSIER_OK=0',
      'KJEMO_PAS_DEJA=0',
      'KJEMO_CANDIDAT_OK=0',
      'KJEMO_LIGNE_SAINE=0',
      '',
      '# Le gardien de chemin tranche AVANT toute lecture du reste : un chemin',
      '# refuse ne doit pas meme servir a construire une ligne.',
      'kjemo_exiger_chemin_sur "${KJEMO_CHEMIN}" \'le dossier a exporter\'',
      '',
      '# La ligne ecrite porte le chemin TEL QUE SAISI, et non sa forme',
      '# canonique : c est ce chemin-la qu un client montera, et le reecrire a sa',
      '# place serait changer silencieusement ce que l operateur a relu dans',
      '# l apercu. Mais si les deux formes DIFFERENT, il faut le dire : un lien',
      '# symbolique, un ".." ou une barre en trop donnent un export qui ne',
      '# designe pas le dossier qu on croit.',
      'if [ "${KJEMO_CHEMIN_CANON}" != "${KJEMO_CHEMIN}" ]; then',
      "  kjemo_resultat 'Chemin' 'Forme canonique' 'ATTENTION' \"${KJEMO_CHEMIN_CANON}\" \\",
      '    "Le chemin saisi (${KJEMO_CHEMIN}) et sa forme canonique (${KJEMO_CHEMIN_CANON}) DIFFERENT : un lien symbolique, un segment « .. » ou une barre oblique en trop. La ligne portera le chemin saisi, parce que c est celui que tu as relu dans l apercu — mais NFS exporte un systeme de fichiers reel, et un export posee sur un lien symbolique ne partage pas ce que le nom suggere. Verifie avec « realpath ${KJEMO_CHEMIN} » avant d appliquer."',
      'else',
      "  kjemo_resultat 'Chemin' 'Forme canonique' 'OK' \"${KJEMO_CHEMIN_CANON}\" \\",
      '    "Le chemin saisi est deja sous sa forme canonique."',
      'fi',
      '',
      ...blocNfsBase(),

      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LE DOSSIER EXISTE-T-IL ?',
      '#',
      '# Une ligne vers un chemin inexistant s ecrit sans probleme : c est a',
      '# l APPLICATION qu exportfs refuse, avec « Failed to stat ... No such file',
      '# or directory ». Autrement dit l erreur apparaitrait plus tard, ailleurs,',
      '# et sur une commande qu on aurait lancee en croyant verifier.',
      '# ---------------------------------------------------------------------------',
      'if [ -d "${KJEMO_CHEMIN}" ]; then',
      '  KJEMO_DOSSIER_OK=1',
      '  KJEMO_STAT="$(stat -c \'%a %U:%G\' -- "${KJEMO_CHEMIN}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Dossier' 'Existence' 'OK' \"${KJEMO_STAT}\" \\",
      '    "Le dossier ${KJEMO_CHEMIN} existe : ${KJEMO_STAT}. NFS n outrepasse pas ces permissions : avec sec=sys, le serveur compare l UID ANNONCE par le client a celui des fichiers. Si les UID des deux machines ne concordent pas, l acces sera refuse ou accorde a la mauvaise personne, et aucune option d export n y changera rien."',
      'else',
      "  kjemo_resultat 'Dossier' 'Existence' 'PROBLEME' 'absent' \\",
      '    "Le dossier ${KJEMO_CHEMIN} n existe pas, et cet assistant ne le cree pas : choisir son proprietaire et son mode a la place de l operateur est la premiere cause de « je monte et je ne peux rien ecrire ». A taper soi-meme : « sudo mkdir -p ${KJEMO_CHEMIN} », puis donne-lui le proprietaire et le mode qui conviennent aux comptes du client."',
      'fi',
      '',

      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE COUPLE DOSSIER/CLIENT EST-IL DEJA LA ?',
      '#',
      '# Exporter le meme dossier a plusieurs clients est normal. Deux lignes',
      '# pour le MEME couple ne le sont pas : elles se recouvrent, et retirer',
      '# notre ajout ne ramenerait pas a l etat d avant.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_FICHIER_LISIBLE}" -eq 1 ]; then',
      '  if grep -qE "^[[:space:]]*${KJEMO_CHEMIN}[[:space:]]+.*${KJEMO_CLIENT}" -- "${KJEMO_LIGNES_EXP}" 2>/dev/null; then',
      "    kjemo_resultat 'Doublon' 'Couple dossier/client' 'PROBLEME' 'deja present' \\",
      '      "Une ligne de ${KJEMO_EXPORTS} associe deja ${KJEMO_CHEMIN} a ${KJEMO_CLIENT}. Deux lignes pour le meme couple se recouvrent, et retirer la nouvelle ne ramenerait pas a l etat d avant. Modifie la ligne existante en la relisant, plutot que d en empiler une seconde."',
      '  else',
      '    KJEMO_PAS_DEJA=1',
      "    kjemo_resultat 'Doublon' 'Couple dossier/client' 'OK' 'libre' \\",
      '      "Aucune ligne n associe deja ${KJEMO_CHEMIN} a ${KJEMO_CLIENT}."',
      '  fi',
      'fi',
      '',

      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE CANDIDAT, DANS LE DOSSIER TEMPORAIRE',
      '# ---------------------------------------------------------------------------',
      'KJEMO_CANDIDAT="${KJEMO_TMP}/exports.candidat"',
      'if [ -r "${KJEMO_EXPORTS}" ]; then',
      '  if {',
      '    cat -- "${KJEMO_EXPORTS}"',
      ...lignesAjout.map((l) => `    printf '%s\\n' ${shQuote(l)}`),
      '  } > "${KJEMO_CANDIDAT}"; then',
      '    KJEMO_CANDIDAT_OK=1',
      '    KJEMO_LIGNES_AV="$(wc -l < "${KJEMO_EXPORTS}" | tr -d \' \')"',
      '    KJEMO_LIGNES_AP="$(wc -l < "${KJEMO_CANDIDAT}" | tr -d \' \')"',
      "    kjemo_resultat 'Candidat' 'Assemblage' 'OK' \"${KJEMO_LIGNES_AV} -> ${KJEMO_LIGNES_AP} lignes\" \\",
      '      "Le candidat est assemble : le fichier en service, inchange, PLUS la ligne a la fin (${KJEMO_LIGNES_AV} lignes avant, ${KJEMO_LIGNES_AP} apres). Aucune ligne existante n a ete modifiee, et rien n est encore ecrit hors du dossier temporaire."',
      '  else',
      "    kjemo_resultat 'Candidat' 'Assemblage' 'PROBLEME' 'echec d ecriture' \\",
      "      'Le candidat n a pas pu etre assemble dans le dossier temporaire. Rien n a ete modifie.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Candidat' 'Assemblage' 'PROBLEME' 'fichier illisible' \\",
      '    "Le fichier ${KJEMO_EXPORTS} n est pas lisible : impossible d assembler un candidat, et rien ne sera modifie."',
      'fi',
      '',

      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LA CONTRE-EPREUVE SUR LA LIGNE CONSTRUITE',
      '#',
      '# Redondante avec la validation du formulaire, et c est exactement le but.',
      '# Un verrou qui ne se verifie qu une fois est un verrou qu on retire sans',
      '# s en apercevoir : si une modification du generateur laissait passer un',
      '# joker, c est ICI que le script refuserait, dans le fichier qu on execute.',
      '#',
      '# Quatre refus, et ils portent sur la LIGNE, pas sur le formulaire :',
      '#   « * »              exports(5) : entree « anonymous », « will match all clients »',
      '#   joker ou classe    « * » et « ? » attrapent aussi les points d un nom',
      '#   « /0 »             « * » deguise en reseau',
      '#   no_root_squash     donne root du client sur les fichiers exportes',
      '# ---------------------------------------------------------------------------',
      'KJEMO_REFUS="${KJEMO_TMP}/refus-ligne.txt"',
      ': > "${KJEMO_REFUS}"',
      'if printf \'%s\\n\' "${KJEMO_LIGNE}" | grep -qE \'(^|[[:space:]])\\*(\\(|[[:space:]]|$)\'; then',
      '  printf \'%s\\n\' "- la ligne exporte vers « * », qui designe TOUS les clients" >> "${KJEMO_REFUS}"',
      'fi',
      'if printf \'%s\\n\' "${KJEMO_LIGNE}" | grep -qE \'[*?[]\'; then',
      '  printf \'%s\\n\' "- la ligne contient un joker ou une classe de caracteres" >> "${KJEMO_REFUS}"',
      'fi',
      'if printf \'%s\\n\' "${KJEMO_LIGNE}" | grep -qE \'/0(\\(|[[:space:]]|$)\'; then',
      '  printf \'%s\\n\' "- la ligne porte un prefixe /0, qui est « * » ecrit en CIDR" >> "${KJEMO_REFUS}"',
      'fi',
      'if printf \'%s\\n\' "${KJEMO_LIGNE}" | grep -q \'no_root_squash\'; then',
      '  printf \'%s\\n\' "- la ligne porte no_root_squash" >> "${KJEMO_REFUS}"',
      'fi',
      'if ! printf \'%s\\n\' "${KJEMO_LIGNE}" | grep -q \'root_squash\'; then',
      '  printf \'%s\\n\' "- la ligne ne porte pas root_squash explicitement" >> "${KJEMO_REFUS}"',
      'fi',
      'KJEMO_NB_REFUS="$(wc -l < "${KJEMO_REFUS}" | tr -d \' \')"',
      'if [ "${KJEMO_NB_REFUS}" -eq 0 ]; then',
      '  KJEMO_LIGNE_SAINE=1',
      "  kjemo_resultat 'Contre-epreuve' 'Ligne construite' 'OK' 'aucun motif refuse' \\",
      '    "La ligne ne contient ni « * », ni joker, ni « /0 », ni no_root_squash, et elle porte root_squash en toutes lettres. Ce controle refait dans le script ce que le formulaire a deja refuse : un verrou verifie une seule fois est un verrou qu on retire sans s en apercevoir."',
      'else',
      '  KJEMO_MOTIFS="$(tr \'\\n\' \' \' < "${KJEMO_REFUS}")"',
      "  kjemo_resultat 'Contre-epreuve' 'Ligne construite' 'PROBLEME' \"${KJEMO_NB_REFUS} motif(s)\" \\",
      '    "La ligne a ete REFUSEE par la contre-epreuve : ${KJEMO_MOTIFS}. Rien ne sera ecrit. Si ce refus survient, il signale un defaut du generateur et non une erreur de saisie : le formulaire aurait du refuser avant."',
      'fi',
      '',

      '# L APERCU EXACT. Le rapport Console n affiche que les lignes ATTENTION,',
      '# PROBLEME et IGNORE, et seulement leur commentaire : une ligne qu on va',
      '# ajouter au fichier d exports d un serveur doit etre LUE, telle qu elle',
      '# sera ecrite.',
      "printf '\\n%s\\n' '--- APERCU EXACT DE CE QUI SERA AJOUTE A LA FIN DU FICHIER ---'",
      ...lignesAjout.map((l) => `printf '%s\\n' ${shQuote(l)}`),
      "printf '%s\\n' '--- fin de l apercu ---'",
      "printf '%s\\n' ''",
      "printf '%s\\n' 'Rappel : ecrire cette ligne ne change RIEN au service tant que'",
      "printf '%s\\n' 'la table n a pas ete resynchronisee. C est volontaire.'",
      '',
      ...blocConfirmation({
        phraseAttendue: chemin,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `ajouter une ligne d export pour ${chemin} a /etc/exports, SANS appliquer`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_PAQUET_OK', 'Le paquet nfs-kernel-server n est pas installe : cette machine ne peut rien exporter.'],
          ['KJEMO_FICHIER_LISIBLE', 'Le fichier /etc/exports n est pas lisible.'],
          ['KJEMO_DOSSIER_OK', 'Le dossier a exporter n existe pas : la ligne s ecrirait et l application echouerait.'],
          ['KJEMO_PAS_DEJA', 'Une ligne associe deja ce dossier a ce client : deux lignes pour le meme couple se recouvrent.'],
          ['KJEMO_CANDIDAT_OK', 'Le candidat n a pas pu etre assemble.'],
          ['KJEMO_LIGNE_SAINE', 'La contre-epreuve a refuse la ligne construite.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le chemin du dossier.'],
        ],
        action: 'l ecriture de la ligne dans /etc/exports',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - SAUVEGARDE, REMPLACEMENT, RELECTURE, ET RETOUR ARRIERE',
      '#',
      '# La sauvegarde est faite ICI, et non plus tot : un script qui n ira pas',
      '# jusqu a ecrire n a aucune raison de laisser un .bak dans /etc.',
      '#',
      '# La relecture ne peut pas etre « exportfs valide le fichier » : cette',
      '# commande n existe pas. Elle est donc TEXTUELLE, et elle verifie trois',
      '# choses — que le fichier en place est bien le candidat, que la ligne y',
      '# figure, et que les lignes d avant sont inchangees a l octet pres.',
      '# C est moins qu une validation syntaxique, et c est dit.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_sauvegarder "${KJEMO_EXPORTS}"',
      '',
      '  if ! cp -p -- "${KJEMO_CANDIDAT}" "${KJEMO_EXPORTS}"; then',
      "    printf '%s\\n' 'ARRET : le remplacement de /etc/exports a echoue.' >&2",
      '    kjemo_restaurer "${KJEMO_EXPORTS}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree. Rien n a ete applique.' >&2",
      '    exit 1',
      '  fi',
      '  if ! cmp -s -- "${KJEMO_CANDIDAT}" "${KJEMO_EXPORTS}"; then',
      "    printf '%s\\n' 'ARRET : le fichier en place ne correspond pas au candidat.' >&2",
      '    kjemo_restaurer "${KJEMO_EXPORTS}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree. Rien n a ete applique.' >&2",
      '    exit 1',
      '  fi',
      '',
      '  # RELECTURE 1 : la ligne attendue figure-t-elle dans le fichier en place ?',
      '  if ! grep -qxF -- "${KJEMO_LIGNE}" "${KJEMO_EXPORTS}"; then',
      "    printf '%s\\n' 'ARRET : la ligne attendue est absente du fichier relu.' >&2",
      '    kjemo_restaurer "${KJEMO_EXPORTS}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree. Rien n a ete applique.' >&2",
      '    exit 1',
      '  fi',
      '',
      '  # RELECTURE 2 : les lignes d AVANT sont-elles intactes ? La comparaison',
      '  # porte sur les N premieres lignes du fichier relu face a la sauvegarde.',
      '  # Un ajout en fin de fichier qui aurait touche au debut serait un defaut',
      '  # grave, et il ne se verrait pas autrement.',
      '  KJEMO_N_AV="$(wc -l < "${KJEMO_SAUVEGARDE}" | tr -d \' \')"',
      '  if ! head -n "${KJEMO_N_AV}" -- "${KJEMO_EXPORTS}" | cmp -s - "${KJEMO_SAUVEGARDE}"; then',
      "    printf '%s\\n' 'ARRET : les lignes existantes ont change. Ce n est pas un ajout.' >&2",
      '    kjemo_restaurer "${KJEMO_EXPORTS}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree. Rien n a ete applique.' >&2",
      '    exit 1',
      '  fi',
      '',
      '  # RELECTURE 3 : la contre-epreuve, refaite sur le FICHIER, et non sur la',
      '  # variable. Ce qui compte est ce qui est sur le disque.',
      '  KJEMO_RELU_LIGNES="${KJEMO_TMP}/relu.txt"',
      '  grep -vE \'^[[:space:]]*(#|$)\' -- "${KJEMO_EXPORTS}" > "${KJEMO_RELU_LIGNES}" || true',
      '  if grep -qE \'(^|[[:space:]])\\*(\\(|[[:space:]]|$)|no_root_squash|/0(\\(|[[:space:]]|$)\' -- "${KJEMO_RELU_LIGNES}"; then',
      "    kjemo_resultat 'Relecture' 'Motifs refuses dans le fichier' 'ATTENTION' 'presents' \\",
      '      "Le fichier relu contient un « * », un « /0 » ou un no_root_squash — sur une AUTRE ligne que celle qui vient d etre ajoutee, puisque la notre a passe la contre-epreuve. Ces lignes etaient deja la. Rien n a ete retire : supprimer un export coupe les montages en cours."',
      '  fi',
      "  kjemo_resultat 'Ecriture' \"${KJEMO_EXPORTS}\" 'OK' 'ecrit, compare, relu' \\",
      '    "La ligne est dans ${KJEMO_EXPORTS}, le fichier a ete compare au candidat, la ligne a ete retrouvee telle quelle, et les lignes precedentes sont intactes a l octet pres. Sauvegarde conservee : ${KJEMO_SAUVEGARDE}. RIEN N A ETE APPLIQUE : le service sert toujours exactement ce qu il servait avant ce script."',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - L APPLICATION, QUI N A PAS LIEU ICI',
      '#',
      '# Et la raison, documentaire : exportfs(8) pour Ubuntu 24.04 n a pas',
      '# d option d essai a blanc. Ses options sont -d, -a, -o, -i, -r, -u, -f,',
      '# -v, -s, et aucune ne verifie sans agir. « -r » est decrit ainsi :',
      '# « Reexport all directories, synchronizing /var/lib/nfs/etab with',
      '# /etc/exports [...] This option removes entries in /var/lib/nfs/etab',
      '# which have been deleted from /etc/exports [...] and removes any entries',
      '# from the kernel export table which are no longer valid. »',
      '#',
      '# Donc : il applique, et il RETIRE. Un export ajoute a la main avec',
      '# « exportfs -o ... » sans passer par le fichier disparait au premier -ra.',
      '# Un script qui le lancerait « pour verifier » couperait les montages de',
      '# quelqu un pour voir.',
      '# ---------------------------------------------------------------------------',
      "  printf '\\n%s\\n' '=============================================================='",
      "  printf '%s\\n' 'IL RESTE UNE ETAPE, ET ELLE NE SERA PAS FAITE PAR CE SCRIPT'",
      "  printf '%s\\n' '=============================================================='",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'La ligne est ECRITE. Elle n est pas APPLIQUEE : le service'",
      "  printf '%s\\n' 'sert encore exactement ce qu il servait avant.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'Pourquoi ce script ne l applique pas : exportfs n a aucune'",
      "  printf '%s\\n' 'option d essai a blanc. « exportfs -ra » APPLIQUE, et sa'",
      "  printf '%s\\n' 'page de manuel precise qu il RETIRE de la table les entrees'",
      "  printf '%s\\n' 'supprimees du fichier, ainsi que celles du noyau qui ne sont'",
      "  printf '%s\\n' 'plus valides. Un export ajoute a la main sans passer par le'",
      "  printf '%s\\n' 'fichier disparait donc au premier -ra. Ce n est pas une'",
      "  printf '%s\\n' 'verification, quoi qu en disent les tutoriels.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '1. Sache qui est monte, parce que la suite peut le couper :'",
      "  printf '%s\\n' '     exportfs -v'",
      "  printf '%s\\n' \"     ss -tn state established '( sport = :2049 )'\"",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '2. Applique, en le sachant :'",
      "  printf '%s\\n' '     sudo exportfs -ra'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '3. RELIS, parce qu une application ne prouve pas un etat :'",
      "  printf '%s\\n' '     exportfs -v'",
      "  printf '%s\\n' '     showmount -e localhost'",
      '  printf \'%s\\n\' "     exportfs -v | grep -F \\"${KJEMO_CHEMIN}\\""',
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '4. Si UFW est actif, ouvre le port POUR CE RESEAU seulement :'",
      '  printf \'%s\\n\' "     sudo ufw allow from ${KJEMO_CLIENT} to any port nfs"',
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '5. Cote client, le montage d essai :'",
      '  printf \'%s\\n\' "     sudo mount -t nfs <serveur>:${KJEMO_CHEMIN} /mnt/essai"',
      "  printf '%s\\n' '   Et, seulement s il tient, la ligne de /etc/fstab.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'POUR ANNULER : restaure la sauvegarde. Tant que tu n as pas'",
      "  printf '%s\\n' 'applique, il n y a rien d autre a defaire.'",
      '  printf \'%s\\n\' "     sudo cp -p \\"${KJEMO_SAUVEGARDE}\\" \\"${KJEMO_EXPORTS}\\""',
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'Ce que ce script n a PAS fait : aucun dossier cree, aucune'",
      "  printf '%s\\n' 'permission changee, aucun port ouvert, aucune table modifiee.'",
      "  printf '%s\\n' '=============================================================='",
      "  kjemo_resultat 'Suite' 'Application' 'ATTENTION' 'manuelle, et non faite' \\",
      '    "La ligne est ecrite et relue ; elle n est PAS en service. L application est « sudo exportfs -ra », qui reexporte tout et retire de la table ce qui a disparu du fichier : c est une action, pas un controle, et elle se lance en sachant qui est monte. Relis ensuite avec « exportfs -v », puis « showmount -e localhost »."',
      'fi',
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-nfs-export' }),
    ]);
  },

  gui: [
    'Écris la ligne d’abord, applique ensuite : modifier /etc/exports n’a aucun effet tant que la table n’est pas resynchronisée.',
    '« exportfs -ra » n’est pas une vérification. Il réexporte tout et retire de la table ce qui a disparu du fichier.',
    'Écris root_squash même si c’est le défaut : une option qu’on lit est une décision, une option absente est une supposition.',
    'Écris « ro » ou « rw » explicitement : le défaut est « ro », et personne ne l’a en tête en relisant une ligne.',
    'Mets « no_subtree_check » : sans l’une des deux options, exportfs avertit que le changement de défaut est en attente.',
    'Jamais « * », jamais de joker, jamais « /0 » : NFSv3 en sec=sys croit l’UID annoncé par le client, et la liste d’accès est le seul verrou.',
    'Jamais no_root_squash : la page de manuel le réserve aux clients sans disque, et il donne root du client sur les fichiers exportés.',
    'Un client désigné par son nom dépend du DNS au moment du montage ; une adresse ne dépend de rien.',
    'Après l’application, relis : « exportfs -v » montre les options effectives, défauts compris.',
    'Ouvre le pare-feu pour le réseau concerné, pas pour tout le monde : « sudo ufw allow from 192.168.30.0/24 to any port nfs ».',
  ],

  keywords: ['nfs', 'export', 'exports', 'exportfs', '/etc/exports', 'root_squash',
    'no_subtree_check', 'sync', 'rw', 'ro', 'all_squash', 'partage', 'cidr',
    'sauvegarde', 'rollback', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'sudo : /etc/exports appartient à root.',
    'nfs-kernel-server installé — le paquet SERVEUR, pas nfs-common.',
    'Le dossier à exporter, créé, avec le propriétaire et le mode qui conviennent aux comptes du client. L’assistant le vérifie et refuse s’il manque.',
    'Savoir quelle adresse ou quel réseau autoriser. C’est le seul vrai verrou d’un export en sec=sys.',
    'Après coup, et à la main : l’application par « exportfs -ra », la relecture, et l’ouverture du pare-feu.',
  ],

  commonErrors: [
    {
      message: 'exportfs: Failed to stat /srv/nfs/partage: No such file or directory',
      code: 'KJEMO',
      cause: 'La ligne désigne un dossier qui n’existe pas. Le fichier l’accepte ; l’application le refuse.',
      fix: 'Créer le dossier, puis appliquer de nouveau.',
      command: 'sudo mkdir -p /srv/nfs/partage && sudo exportfs -ra',
    },
    {
      message: 'La ligne est dans le fichier et le client ne voit rien',
      code: 'KJEMO',
      cause: 'La table en service n’a pas été resynchronisée. C’est l’état attendu après ce script.',
      fix: 'Appliquer, puis relire.',
      command: 'sudo exportfs -ra && exportfs -v',
    },
    {
      message: 'exportfs: /etc/exports:N: syntax error',
      code: 'KJEMO',
      cause: 'Une espace entre le client et sa parenthèse d’options. exports(5) : « No whitespace is permitted between a client and its option list. » Une espace de trop change le sens de la ligne.',
      fix: 'Restaurer la sauvegarde et relire la ligne fautive.',
      command: 'sudo cp -p /etc/exports.kjemo-<horodatage>.bak /etc/exports',
    },
    {
      message: 'Le client monte en lecture seule alors que rw est écrit',
      code: 'KJEMO',
      cause: 'Les permissions Unix du dossier, ou un décalage d’UID entre les deux machines. NFS ne les outrepasse pas.',
      fix: 'Comparer les UID des deux côtés avant de toucher aux options.',
      command: 'ls -ln /srv/nfs/partage; id <compte>',
    },
    {
      message: 'Un export ajouté à la main a disparu',
      code: 'KJEMO',
      cause: 'Un « exportfs -ra » l’a retiré : il synchronise la table avec le fichier, et ce qui n’est pas dans le fichier n’y survit pas.',
      fix: 'Mettre l’export dans /etc/exports plutôt que sur la ligne de commande.',
      command: 'exportfs -s',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le paquet serveur est installé, et le fichier /etc/exports lisible.',
    'Le dossier existe : une ligne vers un chemin absent s’écrit et échoue à l’application.',
    'Le couple dossier/client n’était pas déjà présent.',
    'Le candidat a été assemblé dans le dossier temporaire : le fichier d’avant, inchangé, plus la ligne.',
    'La contre-épreuve a été passée sur la LIGNE : ni « * », ni joker, ni « /0 », ni no_root_squash, et root_squash présent.',
    'L’aperçu exact a été imprimé avant toute écriture.',
    'Sans la confirmation exacte, aucune écriture — pas même une sauvegarde.',
    'La sauvegarde a été créée, relue et comparée avant le remplacement.',
    'Après écriture : comparaison avec le candidat, présence littérale de la ligne, et lignes précédentes intactes à l’octet près.',
    'Aucune application : exportfs -ra n’a pas été lancé, et le rapport le dit plutôt que de le laisser croire.',
  ],

  rollback: {
    summary: 'Tant que l’application n’a pas eu lieu, il n’y a rien à défaire côté service : restaurer la sauvegarde suffit. Si l’export a été appliqué, il faut retirer la ligne PUIS appliquer de nouveau — et savoir que l’application coupe les montages des clients concernés.',
    diagnostic: `# Le fichier, la table en service, et la vue client :
grep -n '/srv/nfs/partage' /etc/exports
exportfs -v
showmount -e localhost
# Les sauvegardes laissees par l assistant :
ls -l /etc/exports.kjemo-*.bak`,
    command: `# Cas 1 - la ligne a ete ecrite et JAMAIS appliquee (etat de sortie
# de cet assistant). Rien n est en service : restaurer suffit.
sudo cp -p /etc/exports.kjemo-<horodatage>.bak /etc/exports

# Cas 2 - l application a eu lieu. Dans cet ordre, et pas un autre :
#   1. savoir qui est monte, parce que l etape 3 le coupera :
ss -tn state established '( sport = :2049 )'
#   2. restaurer le fichier :
sudo cp -p /etc/exports.kjemo-<horodatage>.bak /etc/exports
#   3. appliquer le retrait :
sudo exportfs -ra
#   4. RELIRE, parce qu un retrait ne prouve pas un etat :
exportfs -v | grep -F '/srv/nfs/partage'   # ne doit rien rendre

# Ce que l annulation ne defait PAS : aucun dossier n a ete cree par
# le script, aucune permission changee, aucun port ouvert.`,
    warning: 'Un retrait d’export coupe les montages en cours sans prévenir le client, qui restera bloqué sur son point de montage. Sache qui est connecté avant d’appliquer.',
  },

  checks: [
    'Aucune application : exportfs n’est jamais appelé avec -r, -a, -u ou -o, et la raison documentaire est écrite dans le script.',
    '/etc/exports n’est jamais réécrit : la ligne est AJOUTÉE à la fin, et l’intégrité des lignes précédentes est vérifiée à l’octet près après écriture.',
    'Le formulaire refuse « * », les jokers et « /0 » ; le script les refuse une SECONDE fois sur la ligne construite.',
    'no_root_squash n’existe nulle part : ni champ, ni valeur possible, et la contre-épreuve refuserait la ligne qui le porterait.',
    'root_squash est écrit explicitement, et son absence ferait échouer la contre-épreuve.',
    'Les zones système sont refusées par le formulaire ET par le gardien de chemin, qui canonise avant de comparer.',
    'Aucune écriture — pas même la sauvegarde — avant que les sept conditions de la porte finale soient réunies.',
    'La sauvegarde est relue et comparée ; une sauvegarde non vérifiée arrête le script.',
    'Après écriture, trois relectures : correspondance au candidat, présence littérale de la ligne, intégrité des lignes précédentes.',
    'La limite de ces relectures est déclarée : elles sont TEXTUELLES, et non une validation syntaxique — celle-ci n’existe pas pour /etc/exports.',
    'Aucun dossier créé, aucune permission modifiée, aucun port ouvert.',
  ],

  source: `${M}/man5/exports.5.html`,
  sources: [
    { label: 'exports(5) — format, root_squash, all_squash, subtree_check, sync', url: `${M}/man5/exports.5.html` },
    { label: 'exportfs(8) — options disponibles, etab, et ce que fait -r', url: `${M}/man8/exportfs.8.html` },
    { label: 'rpc.nfsd(8) — le serveur', url: `${M}/man8/rpc.nfsd.8.html` },
    { label: 'nfs(5) — options de montage côté client', url: `${M}/man5/nfs.5.html` },
    { label: 'mount.nfs(8) — le montage côté client', url: `${M}/man8/mount.nfs.8.html` },
    { label: 'Ubuntu Server — Network File System (NFS)', url: DOCU },
  ],
};

export const toolsLinuxN = [
  nfsServerReadiness,
  nfsExportCreate,
];
