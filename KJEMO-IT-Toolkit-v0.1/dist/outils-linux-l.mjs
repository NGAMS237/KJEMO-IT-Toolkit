/**
 * outils-linux-l.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Samba — partage de fichiers. Trois assistants.
 *
 *   samba-readiness      LIT ce qui décide qu'un partage SMB peut fonctionner,
 *                        y compris la distinction que tout le monde manque :
 *                        un compte Unix n'est PAS un compte Samba.
 *   samba-share-create   AJOUTE une section de partage à smb.conf — sauvegarde
 *                        vérifiée, validation par testparm sur une COPIE,
 *                        remplacement, relecture, et retour arrière si la
 *                        relecture échoue.
 *   samba-diagnostic     LIT le cas du cours : « le partage est créé et je ne
 *                        peux pas écrire », ou « je ne le vois pas depuis
 *                        Windows ».
 *
 * ---------------------------------------------------------------------------
 * CE QUE testparm PERMET, ET QUI CHANGE TOUT
 * ---------------------------------------------------------------------------
 * La page de manuel de testparm(1) donne cette syntaxe :
 *
 *     testparm [-s|--suppress-prompt] ... {config filename} [hostname hostIP]
 *
 * Trois choses en découlent, et les trois sont utilisées ici :
 *
 *   1. testparm accepte un FICHIER QUELCONQUE en argument. On peut donc
 *      valider une copie candidate sans toucher au fichier en service. C'est
 *      ce qui rend possible « valider avant de remplacer » plutôt que
 *      « remplacer puis espérer ».
 *   2. « If testparm finds an error in the smb.conf file it returns an exit
 *      code of 1 to the calling program, else it returns an exit code of 0.
 *      This allows shell scripts to test the output from testparm. » Le code
 *      de sortie est donc une garantie documentée, et non une lecture de
 *      texte.
 *   3. `-s` est OBLIGATOIRE dans un script : « Without this option, testparm
 *      will prompt for a carriage return after printing the service names ».
 *      Sans lui, le script attend une touche et paraît bloqué — exactement le
 *      piège de `journalctl` sans `--no-pager`.
 *
 * La page dit aussi ce que testparm ne promet PAS, et il faut le répéter :
 * « Note that this is NOT a guarantee that the services specified in the
 * configuration file will be available or will operate as expected. » Une
 * configuration valide peut parfaitement désigner un dossier qui n'existe
 * pas.
 *
 * ---------------------------------------------------------------------------
 * LES TROIS CONFUSIONS QUE CE MODULE EXISTE POUR LEVER
 * ---------------------------------------------------------------------------
 * 1. UN COMPTE UNIX N'EST PAS UN COMPTE SAMBA. Samba tient sa propre base de
 *    mots de passe. Créer `blaise` avec `useradd` ne lui donne aucun accès
 *    SMB : il faut en plus `smbpasswd -a blaise`, qui demande le mot de passe
 *    de façon interactive. Le symptôme est un refus d'authentification avec
 *    le bon mot de passe Unix, et on cherche alors du côté du réseau.
 *
 * 2. UN PARTAGE EST EN LECTURE SEULE PAR DÉFAUT. smb.conf(5) : « Default:
 *    read only = yes ». Le partage se crée, se monte, s'ouvre — et rien ne
 *    s'y écrit. Ce n'est pas une permission Unix, c'est Samba.
 *
 * 3. LES MASQUES PAR DÉFAUT CASSENT L'ÉCRITURE PARTAGÉE. smb.conf(5) :
 *    « Default: create mask = 0744 » et « Default: directory mask = 0755 ».
 *    Un fichier déposé depuis Windows arrive donc SANS droit d'écriture pour
 *    le groupe : le collègue suivant le voit et ne peut pas le modifier. Deux
 *    personnes sur le même dossier partagé, et la panne est là — alors que
 *    les permissions du dossier, elles, sont correctes.
 *
 * ---------------------------------------------------------------------------
 * AUCUN SECRET, NULLE PART
 * ---------------------------------------------------------------------------
 * Aucun des trois assistants n'a de champ de mot de passe, n'en écrit un dans
 * un script, n'en journalise un, et aucun n'appelle `smbpasswd` autrement
 * qu'en l'AFFICHANT comme étape manuelle. `smbpasswd` demande le mot de passe
 * à la console : c'est la bonne façon, et l'automatiser demanderait de faire
 * passer un secret par un fichier.
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import {
  blocConfirmation, blocPorteFinale, blocSauvegardeFichier, blocGardienChemin,
} from './gardes-bash.mjs';
import {
  validateChoix, validateCheminAbsolu, validateNomPartage, validateNomGroupe,
  validateNomUtilisateur, validateClientNfs,
} from './validateurs-linux.mjs';
import { assertValid } from './noyau.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';
const WIKI = 'https://wiki.samba.org';

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
 * Les chemins qu'on ne partage pas, et la raison de chacun.
 *
 * /srv et /mnt n'y sont PAS : ce sont les endroits prévus pour des données
 * partagées, et les refuser rendrait l'assistant inutilisable. La liste visse
 * ce qui casse une machine ou expose tout son contenu.
 */
const PARTAGE_REFUSE = [
  '/', '/etc', '/usr', '/var', '/boot', '/bin', '/sbin', '/lib', '/lib64',
  '/opt', '/root', '/home', '/dev', '/proc', '/sys', '/run',
];

/** Les sections de smb.conf qui ne sont pas des partages ordinaires. */
const SECTIONS_RESERVEES = ['global', 'homes', 'printers', 'print$'];

/**
 * Le bloc commun aux trois assistants : paquets, unités, version, et la
 * validité du fichier EN SERVICE.
 *
 * Il est partagé pour la même raison qu'au module Cockpit : trois assistants
 * qui poseraient différemment les mêmes trois premières questions
 * produiraient trois rapports qui se contredisent sur la même machine.
 */
/**
 * testparm : le code de sortie NE SUFFIT PAS, et c'est mesuré.
 *
 * Sa page de manuel dit : « If testparm finds an error in the smb.conf file it
 * returns an exit code of 1 to the calling program, else it returns an exit
 * code of 0. » C'est exact, et insuffisant — parce que ce que testparm appelle
 * une « erreur » est plus étroit qu'on ne le croit. Mesuré sur le vrai binaire,
 * dans un conteneur, avant d'écrire une ligne de cet assistant :
 *
 *   fichier illisible ou section non fermée   exit 1
 *   directive inexistante (faute de frappe)   exit 0, et « Unknown parameter
 *                                             encountered » sur l'erreur
 *                                             standard
 *   valeur invalide pour une directive        exit 0
 *   deux sections du MÊME nom                 exit 0 — la dernière gagne, en
 *                                             silence
 *
 * Un assistant qui se fierait au seul code de sortie installerait donc une
 * configuration contenant une directive mal orthographiée, que Samba ignore
 * purement et simplement : le partage se déclare, se recharge, et le réglage
 * qu'on croyait avoir posé n'existe pas. C'est la panne la plus difficile à
 * voir, puisque rien n'a échoué.
 *
 * Cette fonction exige donc les DEUX : le code de sortie, et l'absence des
 * messages que testparm écrit sans échouer. Les deux derniers cas du tableau
 * ne sont pas couverts par ce contrôle — le premier est traité en vérifiant
 * que le nom de partage est libre, le second reste une limite assumée et
 * déclarée dans la fiche.
 */
function fonctionTestparmBash() {
  return [
    '# ---------------------------------------------------------------------------',
    '# testparm, ET LES AVERTISSEMENTS QU IL N ECHOUE PAS A SIGNALER',
    '#',
    '# Mesure faite sur le vrai binaire : une directive mal orthographiee fait',
    '# sortir testparm en 0 en ecrivant « Unknown parameter encountered » sur',
    '# l erreur standard. Se fier au seul code de sortie laisserait donc passer',
    '# une configuration dont un reglage est ignore en silence — et c est la',
    '# panne la plus difficile a voir, puisque rien n a echoue.',
    '#',
    '# Cette fonction exige les DEUX : code 0, et aucun de ces messages.',
    '# KJEMO_TP_SORTIE porte la sortie complete, pour le rapport.',
    '# ---------------------------------------------------------------------------',
    "KJEMO_TP_SORTIE=''",
    'kjemo_testparm() {',
    '  local fichier="${1:-}" code=0',
    "  KJEMO_TP_SORTIE=''",
    '  KJEMO_TP_SORTIE="$(testparm -s -- "${fichier}" 2>&1)" || code=$?',
    '  if [ "${code}" -ne 0 ]; then return 1; fi',
    '  case "${KJEMO_TP_SORTIE}" in',
    '    *"Unknown parameter encountered"*|*"Error loading services"*|*"Ignoring invalid value"*|*"Rejecting invalid"*|*"Unknown service"*)',
    '      return 2',
    '      ;;',
    '  esac',
    '  return 0',
    '}',
    '',
  ];
}

function blocSambaBase({ exigeValide = false } = {}) {
  return [
    '# ---------------------------------------------------------------------------',
    '# COUCHE 1 - LES PAQUETS',
    '#',
    '# Trois paquets, trois rôles, et on les confond :',
    '#   samba              le serveur — smbd et nmbd',
    '#   samba-common-bin   testparm, pdbedit, smbpasswd — les OUTILS',
    '#   smbclient          le CLIENT, pour se connecter a un partage',
    '#',
    '# Une machine qui a smbclient mais pas samba ne sert aucun partage : elle',
    '# peut seulement en consommer. C est le premier malentendu du sujet.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_PAQUET_OK=0',
    "KJEMO_PAQUETS_VUS=''",
    'if kjemo_dispo dpkg-query; then',
    '  for kjemo_p in samba samba-common-bin smbclient winbind; do',
    "    kjemo_etat=\"$(dpkg-query -W -f='${Status}' \"${kjemo_p}\" 2>/dev/null || true)\"",
    '    if [ "${kjemo_etat#*ok installed}" != "${kjemo_etat}" ]; then',
    '      KJEMO_PAQUETS_VUS="${KJEMO_PAQUETS_VUS} ${kjemo_p}"',
    '    fi',
    '  done',
    'fi',
    'case " ${KJEMO_PAQUETS_VUS} " in',
    '  *" samba "*)',
    '    KJEMO_PAQUET_OK=1',
    "    kjemo_resultat 'Paquet' 'samba' 'OK' \"${KJEMO_PAQUETS_VUS# }\" \\",
    '      "Paquets Samba installes :${KJEMO_PAQUETS_VUS:- aucun}. Le paquet « samba » apporte le serveur ; « samba-common-bin » apporte testparm, pdbedit et smbpasswd ; « smbclient » n est QUE le client."',
    '    ;;',
    '  *)',
    "    kjemo_resultat 'Paquet' 'samba' 'PROBLEME' \"${KJEMO_PAQUETS_VUS:-aucun}\" \\",
    '      "Le paquet « samba » n est pas installe (vus :${KJEMO_PAQUETS_VUS:- aucun}). Avoir smbclient ne suffit pas : c est le CLIENT. Le serveur s installe avec « sudo apt install samba »."',
    '    ;;',
    'esac',
    'if ! kjemo_dispo testparm; then',
    "  kjemo_resultat 'Paquet' 'testparm' 'PROBLEME' 'absent' \\",
    "    'La commande testparm est absente : elle vient du paquet samba-common-bin. Sans elle, aucune configuration ne peut etre validee avant d etre mise en service, et c est le controle le plus important de tout ce module.'",
    'fi',
    '',
    '# ---------------------------------------------------------------------------',
    '# COUCHE 2 - LES UNITES, ET CE QUE CHACUNE FAIT',
    '#',
    '#   smbd   sert les PARTAGES. C est elle qui compte.',
    '#   nmbd   sert les noms NetBIOS, pour l affichage dans le voisinage',
    '#          reseau. Un partage reste joignable par son adresse sans elle :',
    '#          « je ne le vois pas dans l explorateur » et « je ne peux pas',
    '#          m y connecter » sont donc DEUX pannes differentes.',
    '# ---------------------------------------------------------------------------',
    "KJEMO_SMBD='inconnu'",
    "KJEMO_NMBD='inconnu'",
    "KJEMO_SMBD_ACT='inconnu'",
    'KJEMO_SERVICE_OK=0',
    'if kjemo_dispo systemctl; then',
    '  KJEMO_SMBD="$(systemctl is-active smbd 2>/dev/null || true)"',
    '  KJEMO_NMBD="$(systemctl is-active nmbd 2>/dev/null || true)"',
    '  KJEMO_SMBD_ACT="$(systemctl is-enabled smbd 2>/dev/null || true)"',
    'fi',
    'if [ "${KJEMO_SMBD}" = \'active\' ]; then',
    '  KJEMO_SERVICE_OK=1',
    "  kjemo_resultat 'Unite' 'smbd' 'OK' \"active, au-demarrage=${KJEMO_SMBD_ACT:-inconnu}\" \\",
    '    "smbd tourne, et c est elle qui sert les partages (demarrage automatique : ${KJEMO_SMBD_ACT:-inconnu})."',
    'else',
    "  kjemo_resultat 'Unite' 'smbd' 'PROBLEME' \"${KJEMO_SMBD:-inconnu}\" \\",
    '    "smbd n est pas active (etat : ${KJEMO_SMBD:-inconnu}) : aucun partage n est servi. Ce script ne la demarre pas — l etat courant est la preuve."',
    'fi',
    "kjemo_resultat 'Unite' 'nmbd' 'INFO' \"${KJEMO_NMBD:-inconnu}\" \\",
    "  'nmbd ne sert que les noms NetBIOS, donc l affichage dans le voisinage reseau. Sans elle, un partage reste joignable par \\\\\\\\adresse\\\\partage : « je ne le vois pas » n est pas « je ne peux pas y acceder ».'",
    '',
    '# ---------------------------------------------------------------------------',
    '# COUCHE 3 - LA CONFIGURATION EN SERVICE EST-ELLE VALIDE ?',
    '#',
    '# testparm sur le fichier REEL, en lecture seule. Deux raisons de le faire',
    '# AVANT tout le reste :',
    '#   une configuration deja fautive empeche smbd de recharger, et tout ce',
    '#   qu on ajouterait ensuite serait accuse a tort ;',
    '#   le code de sortie est documente — 1 en cas d erreur, 0 sinon — donc',
    '#   c est une mesure, pas une lecture de texte.',
    '#',
    '# -s est indispensable : sans lui, testparm attend une touche.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_CONF_VALIDE=0',
    "KJEMO_TESTPARM_SORTIE=''",
    'if kjemo_dispo testparm && [ -r "${KJEMO_SMBCONF}" ]; then',
    '  KJEMO_TP_CODE=0',
    '  kjemo_testparm "${KJEMO_SMBCONF}" || KJEMO_TP_CODE=$?',
    '  KJEMO_TESTPARM_SORTIE="${KJEMO_TP_SORTIE}"',
    '  if [ "${KJEMO_TP_CODE}" -eq 0 ]; then',
    '    KJEMO_CONF_VALIDE=1',
    '    KJEMO_SECTIONS="$(printf \'%s\\n\' "${KJEMO_TESTPARM_SORTIE}" | grep -oE \'^\\[[^]]+\\]\' | paste -sd, - || true)"',
    "    kjemo_resultat 'Configuration' 'testparm' 'OK' \"${KJEMO_SECTIONS:-aucune section}\" \\",
    '      "La configuration en service est valide — testparm sort 0. Sections declarees : ${KJEMO_SECTIONS:-aucune}. Ce que testparm ne promet PAS, et sa page de manuel le dit : que les services soient disponibles ou se comportent comme prevu. Un chemin inexistant passe cette validation."',
    '  elif [ "${KJEMO_TP_CODE}" -eq 2 ]; then',
    "    kjemo_resultat 'Configuration' 'testparm' 'PROBLEME' 'avertissement sans echec' \\",
    '      "testparm sort en 0 et SIGNALE un probleme : ${KJEMO_TESTPARM_SORTIE}. Une directive mal orthographiee donne exactement cela — Samba l ignore en silence, et le reglage qu on croit avoir pose n existe pas. Mesure faite sur le vrai binaire : le seul code de sortie ne suffit pas, et cet assistant exige les deux."',
    '  else',
    "    kjemo_resultat 'Configuration' 'testparm' 'PROBLEME' 'refusee' \\",
    '      "testparm REFUSE la configuration en service : ${KJEMO_TESTPARM_SORTIE}. Tant que ce message subsiste, smbd ne rechargera pas, et toute modification ajoutee serait accusee a tort. C est la panne a corriger en premier."',
    '  fi',
    'else',
    "  kjemo_resultat 'Configuration' 'testparm' 'IGNORE' 'non executee' \\",
    '    "La validation n a PAS eu lieu : testparm est absent, ou ${KJEMO_SMBCONF} n est pas lisible depuis cette session. Ce rapport ne conclut rien sur la validite de la configuration."',
    'fi',
    '',
    ...(exigeValide ? [
      '# Un assistant qui MODIFIE refuse de travailler sur une configuration',
      '# deja fautive : il ne peut pas distinguer son propre ajout de l erreur',
      '# existante, et le retour arriere ne ramenerait qu a l etat fautif.',
      '',
    ] : []),
  ];
}

/** Les ports SMB, et le pare-feu. Commun aux assistants de ce module. */
function blocSambaPorts() {
  return [
    '# ---------------------------------------------------------------------------',
    '# COUCHE 4 - LES PORTS, ET LE PARE-FEU',
    '#',
    '# 445/tcp  SMB direct. C est celui qui compte aujourd hui.',
    '# 139/tcp  SMB sur NetBIOS, historique. Un client recent n en a pas besoin.',
    '# 137-138/udp  noms NetBIOS, servis par nmbd : l affichage dans le',
    '#              voisinage reseau, et rien de plus.',
    '#',
    '# Le profil applicatif « Samba » d UFW ouvre les quatre d un coup. C est',
    '# commode et plus large que necessaire : le rapport le dit.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_PORT_OK=0',
    'if kjemo_dispo ss; then',
    '  KJEMO_ECOUTE="$(ss -lntup 2>/dev/null | grep -E \'[:.](445|139)[[:space:]]\' || true)"',
    '  if [ -n "${KJEMO_ECOUTE}" ]; then',
    '    KJEMO_PORT_OK=1',
    "    kjemo_resultat 'Ecoute' 'Ports SMB' 'OK' \"${KJEMO_ECOUTE}\" \\",
    '      "Quelque chose ecoute sur 445 ou 139 : ${KJEMO_ECOUTE}. L adresse locale compte autant que le port — un smbd lie au bouclage ne servirait que la machine elle-meme."',
    '  else',
    "    kjemo_resultat 'Ecoute' 'Ports SMB' 'PROBLEME' 'rien en ecoute' \\",
    "      'Rien n ecoute sur 445 ni sur 139. Si smbd est pourtant active, regarde son journal : une configuration que smbd refuse le fait sortir au demarrage.'",
    '  fi',
    'else',
    "  kjemo_resultat 'Ecoute' 'ss' 'IGNORE' 'commande absente' \\",
    "    'ss est absent : la couche « qu est-ce qui ecoute » n a PAS ete controlee.'",
    'fi',
    'KJEMO_FEU_OK=1',
    'if kjemo_dispo ufw; then',
    '  KJEMO_UFW="$(ufw status 2>/dev/null || true)"',
    '  case "${KJEMO_UFW}" in',
    '    *inactive*)',
    "      kjemo_resultat 'Pare-feu' 'ufw' 'INFO' 'inactif' \\",
    "        'UFW est inactif : il ne bloque rien. Si un client Windows n atteint pas le partage, ce n est pas lui.'",
    '      ;;',
    '    *)',
    '      if printf \'%s\\n\' "${KJEMO_UFW}" | grep -qE \'(^|[^0-9])(445|139)(/tcp)?[[:space:]]+ALLOW|Samba[[:space:]]+ALLOW\'; then',
    "        kjemo_resultat 'Pare-feu' 'ufw, SMB' 'OK' 'autorise' \\",
    "          'UFW est actif et une regle autorise SMB — par port, ou par le profil applicatif « Samba », qui ouvre 137, 138, 139 et 445 d un coup.'",
    '      else',
    '        KJEMO_FEU_OK=0',
    "        kjemo_resultat 'Pare-feu' 'ufw, SMB' 'PROBLEME' 'aucune regle vue' \\",
    "          'UFW est actif et aucune regle n autorise SMB. Cote Windows, cela donne une attente puis « le chemin reseau est introuvable » — jamais un refus franc. Ce script n ouvre rien : « sudo ufw allow samba » est dans la procedure, et son inverse exact est « sudo ufw delete allow samba ».'",
    '      fi',
    '      ;;',
    '  esac',
    'else',
    "  kjemo_resultat 'Pare-feu' 'ufw' 'INFO' 'absent' \\",
    "    'UFW n est pas installe. Un autre pare-feu peut filtrer : l assistant linux-firewall-audit lit aussi nftables et iptables.'",
    'fi',
    '',
  ];
}

/**
 * Les comptes Samba, qui ne sont PAS les comptes Unix.
 *
 * La confusion nº 1 du sujet, et elle se mesure : pdbedit -L liste la base
 * Samba, getent passwd liste la base Unix. Un nom présent dans la seconde et
 * absent de la première est un compte qui échouera à l'authentification avec
 * son mot de passe Unix correct.
 */
function blocSambaComptes() {
  return [
    '# ---------------------------------------------------------------------------',
    '# COUCHE 5 - LES COMPTES SAMBA NE SONT PAS LES COMPTES UNIX',
    '#',
    '# Samba tient sa propre base de mots de passe. « useradd blaise » ne donne',
    '# AUCUN acces SMB : il faut en plus « smbpasswd -a blaise », qui demande le',
    '# mot de passe a la console.',
    '#',
    '# Le symptome est un refus d authentification avec un mot de passe Unix',
    '# correct — et on cherche alors du cote du reseau pendant une heure.',
    '#',
    '# pdbedit demande root : la base des mots de passe ne se lit pas sans.',
    '# ---------------------------------------------------------------------------',
    "KJEMO_COMPTES_SAMBA=''",
    'KJEMO_COMPTES_LU=0',
    'if [ "${KJEMO_ROOT:-0}" -eq 1 ] && kjemo_dispo pdbedit; then',
    '  if KJEMO_COMPTES_SAMBA="$(pdbedit -L 2>/dev/null | cut -d: -f1 | paste -sd, -)"; then',
    '    KJEMO_COMPTES_LU=1',
    "    kjemo_resultat 'Comptes' 'Base Samba' 'INFO' \"${KJEMO_COMPTES_SAMBA:-aucun}\" \\",
    '      "Comptes connus de SAMBA : ${KJEMO_COMPTES_SAMBA:-aucun}. Un compte Unix absent de cette liste ne peut pas se connecter a un partage, meme avec son mot de passe Unix correct : il lui faut « sudo smbpasswd -a <compte> », qui demande le mot de passe a la console. Aucun script de ce projet ne le fait a sa place — un mot de passe qui passe par un fichier est un mot de passe qui fuit."',
    '  fi',
    'fi',
    'if [ "${KJEMO_COMPTES_LU}" -ne 1 ]; then',
    "  kjemo_resultat 'Comptes' 'Base Samba' 'IGNORE' 'non lue' \\",
    "    'La base des comptes Samba n a PAS ete lue : pdbedit demande root, ou le paquet samba-common-bin est absent. Ce rapport ne dit donc rien sur les comptes autorises — et c est la cause nº 1 des refus d authentification.'",
    'fi',
    '',
  ];
}

// ===========================================================================
// 1. samba-readiness
// ===========================================================================

const sambaReadiness = {
  id: 'samba-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'Samba',
  title: 'Vérifier qu’une machine peut servir un partage Samba',
  risk: 'diagnostic',
  summary: 'Lit ce qui décide qu’un partage SMB fonctionnera : les trois paquets et leurs rôles — smbclient est le CLIENT, pas le serveur —, smbd et nmbd séparément, la validité de la configuration en service par testparm en lecture seule, les ports 445 et 139, le pare-feu, et la base des comptes SAMBA, qui n’est pas celle d’Unix. Examine au besoin le dossier envisagé. N’installe rien, ne démarre rien, n’ouvre aucun port, et ne touche à aucun mot de passe.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'samba — smbd, nmbd (apt install samba)',
    'samba-common-bin — testparm, pdbedit, smbpasswd',
    'smbclient — le client, facultatif pour un serveur',
  ],
  privileges: 'aucun pour les paquets, les unités, les ports et le pare-feu. root pour la base des comptes Samba (pdbedit) et parfois pour lire smb.conf — ces sections sont annoncées IGNORE plutôt que passées sous silence',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'smbd.service et nmbd.service',
  limites: [
    'LIT seulement. N’installe aucun paquet, ne démarre ni smbd ni nmbd, n’ouvre aucun port, n’ajoute aucun compte Samba, ne touche pas à smb.conf.',
    'Ne crée pas le dossier à partager, et ne corrige pas ses permissions. Il les MESURE et affiche les commandes exactes : créer un dossier partagé avec le mauvais propriétaire est la cause la plus fréquente de « je me connecte et je ne peux pas écrire », et la corriger à l’aveugle depuis un script toucherait à tout ce qu’il contient.',
    'N’appelle jamais smbpasswd. Il demande un mot de passe à la console, et c’est la bonne façon : aucun secret ne passe par un formulaire ni par un fichier de ce projet.',
    'testparm valide la FORME. Sa page de manuel le dit : ce n’est pas une garantie que les services soient disponibles ou se comportent comme prévu. Un chemin inexistant passe la validation.',
    'Ne teste pas depuis un client Windows. La machine peut être prête et le poste client échouer pour une raison qui lui est propre — version de protocole, compte, ou équipement réseau entre les deux.',
  ],

  fields: [
    {
      id: 'cheminEnvisage',
      label: 'Dossier à partager (vide = non examiné)',
      type: 'text',
      default: '',
      placeholder: '/srv/partage',
      optionnel: true,
      help: 'Si renseigné, l’assistant lit son existence, son propriétaire, son mode et son bit setgid — les trois choses qui décident si l’écriture partagée fonctionnera réellement.',
    },
    {
      id: 'compteEnvisage',
      label: 'Compte à vérifier (vide = non examiné)',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Si renseigné, l’assistant vérifie qu’il existe côté Unix ET côté Samba. Les deux bases sont distinctes, et c’est la confusion nº 1 du sujet.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const c = String(v.cheminEnvisage ?? '').trim();
    if (c !== '') {
      const r = validateCheminAbsolu(c, 'Le dossier à partager');
      if (!r.ok) {
        errors.cheminEnvisage = r.error;
      } else if (PARTAGE_REFUSE.includes(r.value.replace(/\/+$/, '') || '/')) {
        errors.cheminEnvisage = `« ${r.value} » ne se partage pas, et cet assistant refuse même de l’examiner comme candidat. Partager une zone système expose la machine entière à tout client qui s’authentifie. Un dossier de données dédié, par exemple /srv/partage, est l’emplacement prévu.`;
      }
    }
    const u = String(v.compteEnvisage ?? '').trim();
    if (u !== '') {
      const r = validateNomUtilisateur(u, 'Le compte à vérifier');
      if (!r.ok) errors.compteEnvisage = r.error;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const chemin = String(v.cheminEnvisage ?? '').trim();
    const compte = String(v.compteEnvisage ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Verifier qu une machine peut servir un partage Samba',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'la base des comptes Samba et smb.conf ne se lisent pas sans root',
      }),
      ...fonctionTestparmBash(),
      ...blocVariablesBash([
        ['KJEMO_SMBCONF', shQuote('/etc/samba/smb.conf')],
        ['KJEMO_CHEMIN', shQuote(chemin)],
        ['KJEMO_COMPTE', shQuote(compte)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Configuration lue' \"${KJEMO_SMBCONF}\"",
      "  printf '%s\\t%s\\n' 'Dossier examine' \"${KJEMO_CHEMIN:-aucun}\"",
      "  printf '%s\\t%s\\n' 'Compte examine' \"${KJEMO_COMPTE:-aucun}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - rien installe, rien demarre, aucun port ouvert, smb.conf intact'",
      "  printf '%s\\t%s\\n' 'Mots de passe' 'AUCUN - smbpasswd n est jamais appele'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      ...blocSambaBase(),
      ...blocSambaPorts(),
      ...blocSambaComptes(),
      '# ---------------------------------------------------------------------------',
      '# LES REGLAGES GLOBAUX QUI DECIDENT DU COMPORTEMENT',
      '#',
      '# Lus dans la sortie de testparm, donc EFFECTIFS : lire smb.conf a la main',
      '# donne les lignes ecrites, pas les valeurs appliquees, et Samba a des',
      '# centaines de valeurs par defaut qui ne figurent nulle part dans le',
      '# fichier.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_CONF_VALIDE}" -eq 1 ]; then',
      '  kjemo_global() {',
      '    printf \'%s\\n\' "${KJEMO_TESTPARM_SORTIE}" \\',
      '      | sed -n "s/^[[:space:]]*${1} = //p" | head -1',
      '  }',
      '  KJEMO_WORKGROUP="$(kjemo_global \'workgroup\')"',
      '  KJEMO_INVITE="$(kjemo_global \'map to guest\')"',
      '  KJEMO_MIN="$(kjemo_global \'server min protocol\')"',
      "  kjemo_resultat 'Global' 'workgroup' 'INFO' \"${KJEMO_WORKGROUP:-non declare}\" \\",
      '    "Groupe de travail declare : ${KJEMO_WORKGROUP:-non declare}. Il n a aucun effet sur l ACCES — un client atteint un partage par son adresse quel que soit le groupe de travail. Il ne change que le regroupement affiche dans le voisinage reseau."',
      '  case "${KJEMO_INVITE}" in',
      '    \'\'|Never|never)',
      "      kjemo_resultat 'Global' 'map to guest' 'OK' \"${KJEMO_INVITE:-Never}\" \\",
      '        "Les connexions dont le mot de passe est invalide sont REJETEES, et c est la valeur par defaut documentee. Un acces invite ouvrirait les partages a qui n a pas de compte."',
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Global' 'map to guest' 'ATTENTION' \"${KJEMO_INVITE}\" \\",
      '        "« map to guest = ${KJEMO_INVITE} » fait basculer certaines connexions ratees vers le compte INVITE au lieu de les refuser. Consequence a connaitre : un client qui se croit authentifie peut en realite travailler en invite, et ses ecritures appartiendront a un autre compte que le sien."',
      '      ;;',
      '  esac',
      "  kjemo_resultat 'Global' 'server min protocol' 'INFO' \"${KJEMO_MIN:-non declare}\" \\",
      '    "Protocole minimum accepte : ${KJEMO_MIN:-valeur par defaut de cette version}. C est ici que se joue la compatibilite avec un client ancien — et l abaisser pour faire fonctionner un vieux poste reactive un protocole que Microsoft a desactive pour de bonnes raisons. A VALIDER avant de le changer : la valeur par defaut depend de la version de Samba installee."',
      'fi',
      '',
      ...(chemin !== '' ? [
        '# -----------------------------------------------------------------------',
        '# LE DOSSIER ENVISAGE : TROIS CHOSES, ET LA TROISIEME EST LA DECISIVE',
        '#',
        '#   il existe          sinon le partage se declare, se valide, et echoue',
        '#                      a la connexion ;',
        '#   son groupe         c est par le groupe que plusieurs personnes',
        '#                      partagent le meme dossier ;',
        '#   son bit setgid     sans lui, un fichier cree dans le dossier',
        '#                      appartient au groupe PRINCIPAL de son auteur, et',
        '#                      non au groupe du dossier. Le collegue suivant le',
        '#                      voit et ne peut pas le modifier. C est la panne',
        '#                      « on travaille a deux et ca ne marche qu a moitie ».',
        '# -----------------------------------------------------------------------',
        'if [ -d "${KJEMO_CHEMIN}" ]; then',
        '  KJEMO_STAT="$(stat -c \'%a %U:%G\' -- "${KJEMO_CHEMIN}" 2>/dev/null || true)"',
        '  KJEMO_OCT="$(printf \'%s\' "${KJEMO_STAT}" | cut -d\' \' -f1)"',
        "  kjemo_resultat 'Dossier' 'Existence' 'OK' \"${KJEMO_STAT}\" \\",
        '    "Le dossier ${KJEMO_CHEMIN} existe : ${KJEMO_STAT}."',
        '  # Le setgid se lit sur quatre chiffres : 2775 le porte, 775 non.',
        '  case "${KJEMO_OCT}" in',
        '    2*|3*|6*|7*)',
        '      if [ "${#KJEMO_OCT}" -eq 4 ]; then',
        "        kjemo_resultat 'Dossier' 'Bit setgid' 'OK' \"${KJEMO_OCT}\" \\",
        '          "Le bit setgid est pose (mode ${KJEMO_OCT}) : tout fichier cree dans ce dossier heritera du GROUPE du dossier, et non du groupe principal de son auteur. C est ce qui fait fonctionner l ecriture a plusieurs."',
        '      else',
        "        kjemo_resultat 'Dossier' 'Bit setgid' 'ATTENTION' \"${KJEMO_OCT}\" \\",
        '          "Mode ${KJEMO_OCT} : pas de bit setgid. Un fichier cree ici appartiendra au groupe PRINCIPAL de son auteur, et le collegue suivant ne pourra pas le modifier. Correction a la main : chmod 2775 ${KJEMO_CHEMIN}"',
        '      fi',
        '      ;;',
        '    *)',
        "      kjemo_resultat 'Dossier' 'Bit setgid' 'ATTENTION' \"${KJEMO_OCT}\" \\",
        '        "Mode ${KJEMO_OCT} : pas de bit setgid. Un fichier cree ici appartiendra au groupe PRINCIPAL de son auteur. Pour un dossier partage a plusieurs : chmod 2775 ${KJEMO_CHEMIN}"',
        '      ;;',
        '  esac',
        'else',
        "  kjemo_resultat 'Dossier' 'Existence' 'PROBLEME' 'absent' \\",
        '    "Le dossier ${KJEMO_CHEMIN} n existe pas. Un partage qui le designe se declarera et passera testparm — la page de manuel previent que la validation ne garantit pas la disponibilite du service — puis echouera a la connexion. Les trois commandes a taper, dans cet ordre : « sudo mkdir -p ${KJEMO_CHEMIN} », « sudo chgrp <groupe> ${KJEMO_CHEMIN} », « sudo chmod 2775 ${KJEMO_CHEMIN} »."',
        'fi',
        '',
      ] : [
        '# Aucun dossier demande : la couche n est pas examinee, et le dire evite',
        '# de croire que le rapport la couvre.',
        "kjemo_resultat 'Dossier' 'Existence' 'IGNORE' 'aucun dossier demande' \\",
        "  'Aucun dossier n a ete examine. C est pourtant la que se decide l ecriture partagee : existence, groupe, et bit setgid — sans lequel un fichier cree appartient au groupe principal de son auteur.'",
        '',
      ]),
      ...(compte !== '' ? [
        '# -----------------------------------------------------------------------',
        '# LE COMPTE, DANS LES DEUX BASES',
        '# -----------------------------------------------------------------------',
        'KJEMO_UNIX_OK=0',
        'if kjemo_dispo getent && getent passwd -- "${KJEMO_COMPTE}" >/dev/null 2>&1; then',
        '  KJEMO_UNIX_OK=1',
        "  kjemo_resultat 'Compte' 'Cote Unix' 'OK' \"${KJEMO_COMPTE}\" \\",
        '    "Le compte ${KJEMO_COMPTE} existe dans la base Unix. Samba s appuie dessus pour les permissions des fichiers : un partage ne peut pas donner acces a un compte que le systeme de fichiers ne connait pas."',
        'else',
        "  kjemo_resultat 'Compte' 'Cote Unix' 'PROBLEME' 'inconnu' \\",
        '    "Le compte ${KJEMO_COMPTE} n existe pas cote Unix. Samba ne peut pas l utiliser : les permissions des fichiers sont des permissions Unix. L assistant linux-user-create le cree sans mot de passe en clair."',
        'fi',
        '# La portee du rapport : un compte present cote Unix dont on n a PAS pu',
        '# lire la base Samba est le cas le plus trompeur — tout a l air normal,',
        '# et la moitie de la reponse manque.',
        'if [ "${KJEMO_UNIX_OK}" -eq 1 ] && [ "${KJEMO_COMPTES_LU}" -ne 1 ]; then',
        "  kjemo_resultat 'Compte' 'Portee du rapport' 'IGNORE' 'base Samba non lue' \\",
        '    "Le compte ${KJEMO_COMPTE} existe cote Unix, et la base SAMBA n a pas pu etre lue : ce rapport ne dit donc PAS s il pourra s authentifier. C est la moitie de la reponse qui manque, et c est la moitie qui explique la plupart des refus. Relance avec sudo."',
        'fi',
        'if [ "${KJEMO_COMPTES_LU}" -eq 1 ]; then',
        '  case ",${KJEMO_COMPTES_SAMBA}," in',
        '    *",${KJEMO_COMPTE},"*)',
        "      kjemo_resultat 'Compte' 'Cote Samba' 'OK' \"${KJEMO_COMPTE}\" \\",
        '        "Le compte ${KJEMO_COMPTE} est aussi connu de SAMBA : les deux bases concordent, et l authentification SMB peut aboutir."',
        '      ;;',
        '    *)',
        "      kjemo_resultat 'Compte' 'Cote Samba' 'PROBLEME' 'absent de la base Samba' \\",
        '        "Le compte ${KJEMO_COMPTE} est connu d Unix et ABSENT de la base Samba. C est la confusion nº 1 du sujet : son mot de passe Unix sera refuse par SMB, et le message ne parlera pas de Samba. A taper soi-meme, le mot de passe etant demande a la console : « sudo smbpasswd -a ${KJEMO_COMPTE} »."',
        '      ;;',
        '  esac',
        'fi',
        '',
      ] : [
        "kjemo_resultat 'Compte' 'Verification' 'IGNORE' 'aucun compte demande' \\",
        "  'Aucun compte n a ete verifie. Les bases Unix et Samba sont distinctes : un compte present dans la premiere et absent de la seconde echoue a l authentification SMB avec un mot de passe Unix correct.'",
        '',
      ]),
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT : LA PREMIERE COUCHE MANQUANTE',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_PAQUET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le paquet' \\",
      "    'Le serveur Samba n est pas installe : « sudo apt install samba ». Les couches suivantes n ont pas de sens avant celle-la.'",
      'elif [ "${KJEMO_CONF_VALIDE}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'la configuration' \\",
      "    'La configuration en service est refusee par testparm, ou n a pas pu etre lue. Tant que testparm se plaint, smbd ne rechargera pas et rien d autre n a d effet.'",
      'elif [ "${KJEMO_SERVICE_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'l unite smbd' \\",
      "    'La configuration est valide et smbd ne tourne pas : aucun partage n est servi. « sudo systemctl enable --now smbd » est a taper soi-meme.'",
      'elif [ "${KJEMO_PORT_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'les ports' \\",
      "    'smbd est active et rien n ecoute sur 445 ni 139 : regarde son journal, « sudo journalctl -u smbd -n 50 --no-pager ». Une configuration que smbd refuse le fait sortir au demarrage.'",
      'elif [ "${KJEMO_FEU_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le pare-feu' \\",
      "    'Tout repond sur la machine, et UFW est actif sans regle pour SMB. Cote Windows, cela donne une attente puis « le chemin reseau est introuvable », jamais un refus franc.'",
      'else',
      "  kjemo_resultat 'Verdict' 'Machine prete' 'OK' 'les couches locales sont completes' \\",
      "    'Paquets presents, configuration valide, smbd actif, ports en ecoute, pare-feu ouvert. Restent les deux choses que cette machine ne peut pas garantir seule : un compte present dans la base SAMBA, et un dossier dont le groupe et le bit setgid permettent l ecriture a plusieurs.'",
      'fi',
      '',
      "printf '\\n%s\\n' '=============================================================='",
      "printf '%s\\n' 'PREPARER UN SERVEUR DE PARTAGE - PROCEDURE MANUELLE'",
      "printf '%s\\n' '=============================================================='",
      "printf '%s\\n' ''",
      "printf '%s\\n' '1. Installe le serveur, et non seulement le client :'",
      "printf '%s\\n' '     sudo apt install samba'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '2. Cree le dossier, donne-le au GROUPE qui partagera, et'",
      "printf '%s\\n' '   pose le bit setgid pour que les fichiers crees heritent'",
      "printf '%s\\n' '   de ce groupe :'",
      "printf '%s\\n' '     sudo mkdir -p /srv/partage'",
      "printf '%s\\n' '     sudo chgrp partage /srv/partage'",
      "printf '%s\\n' '     sudo chmod 2775 /srv/partage'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '3. Declare le partage. L assistant samba-share-create'",
      "printf '%s\\n' '   prepare la section, la VALIDE sur une copie, et ne'",
      "printf '%s\\n' '   remplace smb.conf qu apres cette validation.'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '4. Donne un mot de passe SAMBA au compte. Cette commande'",
      "printf '%s\\n' '   le demande a la console, et aucun script de ce projet ne'",
      "printf '%s\\n' '   la remplace :'",
      "printf '%s\\n' '     sudo smbpasswd -a <compte>'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '5. Ouvre le pare-feu, puis verifie :'",
      "printf '%s\\n' '     sudo ufw allow samba'",
      "printf '%s\\n' '     testparm -s'",
      "printf '%s\\n' '     smbclient -L localhost -U <compte>'",
      "printf '%s\\n' ''",
      "printf '%s\\n' 'POUR ANNULER :'",
      "printf '%s\\n' '     sudo ufw delete allow samba'",
      "printf '%s\\n' '     sudo smbpasswd -x <compte>'",
      "printf '%s\\n' '     sudo systemctl disable --now smbd nmbd'",
      "printf '%s\\n' ''",
      "printf '%s\\n' 'Ce que ce script n a PAS fait : aucun paquet installe, aucune'",
      "printf '%s\\n' 'unite demarree, aucun port ouvert, aucun compte ajoute, aucun'",
      "printf '%s\\n' 'mot de passe demande ni ecrit.'",
      "printf '%s\\n' '=============================================================='",
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucun paquet, aucune unite, aucun port, aucun compte Samba, aucun mot de passe, et smb.conf intact.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-samba-prerequis' }),
    ]);
  },

  gui: [
    'Installe « samba », pas « smbclient » : le second est le client. Une machine qui n’a que lui ne sert aucun partage.',
    'testparm valide et n’applique rien : « testparm -s » sur une machine en service est sans risque. Le « -s » est obligatoire dans un script, sinon il attend une touche.',
    'Un compte Unix n’est PAS un compte Samba : « sudo pdbedit -L » liste la base Samba, et « sudo smbpasswd -a <compte> » y ajoute un compte.',
    'Un partage est en LECTURE SEULE par défaut — smb.conf(5) : « Default: read only = yes ». Ce n’est pas une permission Unix.',
    'Pose le bit setgid sur un dossier partagé : « sudo chmod 2775 /srv/partage ». Sans lui, les fichiers créés appartiennent au groupe principal de leur auteur.',
    'Les masques par défaut — create mask = 0744, directory mask = 0755 — retirent l’écriture au groupe sur chaque fichier déposé. Pour de l’écriture à plusieurs, il faut les élargir.',
    'smbd sert les partages, nmbd sert les noms : « je ne le vois pas dans l’explorateur » et « je ne peux pas m’y connecter » sont deux pannes différentes.',
    'Ouvre le pare-feu avec « sudo ufw allow samba » : le profil applicatif ouvre 137, 138, 139 et 445 — commode, et plus large que nécessaire.',
    'Teste depuis la machine avant d’accuser le réseau : « smbclient -L localhost -U <compte> ».',
  ],

  keywords: ['samba', 'smb', 'cifs', 'partage', 'smbd', 'nmbd', 'testparm',
    'pdbedit', 'smbpasswd', 'smbclient', '445', '139', 'setgid', 'prerequis',
    'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour les paquets, les unités, les ports et le pare-feu.',
    'sudo pour la base des comptes Samba (pdbedit) et, selon les permissions, pour lire smb.conf. Sans sudo, ces sections sont annoncées IGNORE — pas OK.',
    'Le dossier envisagé et le compte envisagé, si l’on veut qu’ils soient examinés.',
  ],

  commonErrors: [
    {
      message: 'NT_STATUS_LOGON_FAILURE avec le bon mot de passe',
      code: 'KJEMO',
      cause: 'Le compte existe côté Unix et pas côté Samba. Les deux bases de mots de passe sont distinctes.',
      fix: 'Ajouter le compte à la base Samba — le mot de passe est demandé à la console.',
      command: 'sudo pdbedit -L; sudo smbpasswd -a blaise',
    },
    {
      message: 'Je me connecte au partage et je ne peux pas écrire',
      code: 'KJEMO',
      cause: 'Un partage est en lecture seule par défaut. Et si « read only = no » est posé, restent les permissions Unix du dossier.',
      fix: 'Lire la valeur effective, puis les permissions du dossier.',
      command: 'testparm -s | grep -A5 "\\[partage\\]"; stat -c \'%a %U:%G\' /srv/partage',
    },
    {
      message: 'Mon collègue voit mon fichier et ne peut pas le modifier',
      code: 'KJEMO',
      cause: 'Pas de bit setgid sur le dossier, et les masques par défaut (create mask = 0744) retirent l’écriture au groupe.',
      fix: 'Poser le setgid, puis élargir les masques dans la section du partage.',
      command: 'sudo chmod 2775 /srv/partage',
    },
    {
      message: 'Le chemin réseau est introuvable depuis Windows',
      code: 'KJEMO',
      cause: 'Rien n’a répondu : pare-feu, ou smbd arrêté. Une attente puis ce message, c’est la signature d’un filtrage, pas d’un refus.',
      fix: 'Vérifier l’écoute puis le pare-feu.',
      command: 'ss -lntup | grep 445; sudo ufw status',
    },
    {
      message: 'Je ne vois pas le serveur dans le voisinage réseau',
      code: 'KJEMO',
      cause: 'nmbd, qui sert les noms NetBIOS, est arrêté — ou le réseau ne propage pas la diffusion. Le partage reste joignable par son adresse.',
      fix: 'Essayer par l’adresse avant de conclure.',
      command: 'smbclient -L 192.168.30.10 -U blaise',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Les trois paquets sont distingués, et l’absence de « samba » n’est pas confondue avec la présence de « smbclient ».',
    'smbd et nmbd sont rapportés séparément, avec ce que chacun sert.',
    'La configuration en service est validée par testparm, et le code de sortie — documenté — est ce qui décide.',
    'La limite de testparm est citée : la validation ne garantit pas la disponibilité du service.',
    'Les ports 445 et 139 sont cherchés dans ce qui écoute réellement.',
    'La base des comptes Samba est lue séparément de la base Unix, ou annoncée IGNORE.',
    'Si un dossier a été demandé : son existence, son propriétaire, son mode et son bit setgid sont rapportés.',
    'Aucune écriture, aucun mot de passe, aucun appel à smbpasswd.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne crée pas le dossier et ne corrige pas ses permissions, et c’est volontaire — un chmod sur un dossier de partage touche tout ce qu’il contient.',
    diagnostic: `# La configuration effective, sans rien appliquer :
testparm -s
# Les comptes des DEUX bases :
getent passwd blaise
sudo pdbedit -L
# Ce qui ecoute, et le pare-feu :
ss -lntup | grep -E '445|139'
sudo ufw status`,
    command: `# Aucune modification a annuler par ce script.
#
# Pour defaire une installation de partage, dans cet ordre :
#   sudo ufw delete allow samba
#   sudo smbpasswd -x <compte>        # retire le compte de la base SAMBA
#   sudo systemctl disable --now smbd nmbd
#   sudo apt remove samba
#
# Retirer un compte de la base Samba ne touche PAS au compte Unix, et
# inversement : les deux bases sont independantes, et c est la source de
# la plupart des malentendus sur ce sujet.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Ne crée pas un dossier partagé en 777 pour « que ça marche » : le bit setgid et un groupe dédié font le même travail sans ouvrir le dossier à tout le monde.',
  },

  checks: [
    'Aucune écriture : aucun paquet installé, aucune unité démarrée, aucun port ouvert, aucun compte ajouté, smb.conf intact.',
    'Aucun mot de passe : aucun champ, aucun appel à smbpasswd, rien dans le rapport. smbpasswd n’apparaît qu’affiché, comme étape manuelle.',
    'testparm est toujours appelé avec « -s » : sans lui, il attend une touche et le script paraît bloqué.',
    'Le code de sortie de testparm est ce qui décide, et non une lecture de son texte : la page de manuel garantit 1 en cas d’erreur et 0 sinon.',
    'La limite de testparm est citée dans le rapport : une configuration valide peut désigner un dossier inexistant.',
    'Les valeurs globales sont lues dans la SORTIE de testparm, donc effectives — lire smb.conf à la main manque les centaines de valeurs par défaut.',
    'Les deux bases de comptes sont interrogées séparément, et l’écart entre elles est nommé comme la confusion nº 1 du sujet.',
    'Le bit setgid est contrôlé sur quatre chiffres : 2775 le porte, 775 non.',
    'Les zones système sont refusées par le formulaire, même comme simple candidat à l’examen.',
    'Les sections réservées à root sont annoncées IGNORE quand root manque, jamais OK.',
  ],

  source: `${M}/man1/testparm.1.html`,
  sources: [
    { label: 'testparm(1) — fichier en argument, code de sortie, -s obligatoire', url: `${M}/man1/testparm.1.html` },
    { label: 'smb.conf(5) — read only, guest ok, create mask, directory mask', url: `${M}/man5/smb.conf.5.html` },
    { label: 'smbd(8)', url: `${M}/man8/smbd.8.html` },
    { label: 'samba(7) — la suite et ses composants', url: `${M}/man7/samba.7.html` },
    { label: 'Samba Wiki — configuration d’un serveur de fichiers autonome', url: `${WIKI}/index.php/Setting_up_Samba_as_a_Standalone_Server` },
  ],
};

// ===========================================================================
// 2. samba-share-create
// ===========================================================================
//
// Le seul des trois qui écrit. Il AJOUTE une section à smb.conf — il ne le
// remplace pas, il ne réécrit aucune ligne existante — et il le fait dans cet
// ordre, qui est tout l'intérêt de l'assistant :
//
//   1. refuser si la configuration EN SERVICE est déjà fautive. Sinon on ne
//      saurait pas distinguer notre ajout de l'erreur existante, et le retour
//      arrière ne ramènerait qu'à un état cassé.
//   2. refuser si le nom de partage existe déjà.
//   3. refuser si le groupe ou le dossier n'existe pas.
//   4. assembler un CANDIDAT dans le dossier temporaire, et le valider avec
//      `testparm -s <candidat>`. Rien n'est écrit ailleurs à ce stade.
//   5. afficher l'aperçu exact.
//   6. derrière la confirmation : sauvegarde vérifiée, remplacement, cmp,
//      RELECTURE par testparm sur le fichier réel — et si cette relecture
//      échoue, restauration depuis la sauvegarde.
//   7. recharger seulement après que la relecture a réussi.
//
// Le mot de passe Samba reste dehors. `smbpasswd` est affiché comme étape
// manuelle, jamais appelé : il demande le secret à la console, et le faire
// passer autrement reviendrait à l'écrire quelque part.

const sambaShareCreate = {
  id: 'samba-share-create',
  icon: '◆',
  category: CAT,
  subcategory: 'Samba',
  title: 'Déclarer un partage Samba, validé avant d’être mis en service',
  risk: 'caution',
  summary: 'Ajoute une section de partage à smb.conf sans en réécrire une seule ligne existante. Refuse d’avancer si la configuration en service est déjà refusée par testparm, si le nom de partage existe déjà, ou si le groupe ou le dossier n’existe pas. Assemble un candidat dans le dossier temporaire, le VALIDE avec testparm, puis — derrière une confirmation exacte — sauvegarde smb.conf, le remplace, le RELIT, et restaure la sauvegarde si la relecture échoue. Ne recharge smbd qu’après. Aucun mot de passe nulle part.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'samba — smbd (apt install samba)',
    'samba-common-bin — testparm, smbcontrol',
  ],
  privileges: 'root — smb.conf appartient à root, et le rechargement du service aussi. Sans root, le script s’arrête avant toute écriture',
  privilegesRequis: 'root',
  readOnly: false,
  service: 'smbd.service',
  limites: [
    'NE REMPLACE PAS smb.conf par une version réécrite. Il AJOUTE une section à la fin et ne touche à aucune ligne existante : le fichier contient souvent des réglages locaux qu’aucun assistant ne peut deviner, et les perdre coûte plus cher que le partage ne rapporte.',
    'REFUSE de travailler sur une configuration que testparm rejette déjà. Dans cet état, un ajout serait accusé à tort, et le retour arrière ne ramènerait qu’à l’état fautif.',
    'Ne crée pas le dossier à partager et ne corrige pas ses permissions : il refuse et affiche les trois commandes exactes. Créer un dossier partagé avec le mauvais groupe est la cause la plus fréquente de « je me connecte et je ne peux pas écrire », et un chmod lancé par un script toucherait à tout ce que le dossier contient déjà.',
    'Ne pose JAMAIS « guest ok = yes ». smb.conf(5) le décrit ainsi : « If this parameter is yes for a service, then no password is required to connect to the service. » Un partage sans mot de passe est une décision qui se prend en le sachant, pas un défaut d’assistant.',
    'N’appelle jamais smbpasswd, et n’a aucun champ de mot de passe. L’étape est affichée : elle demande le secret à la console.',
    'Ne touche pas aux comptes, aux groupes, ni aux permissions Unix. Le partage référence un groupe existant ; il ne le crée pas.',
    'Ne redémarre pas smbd : il le RECHARGE, et seulement après une relecture réussie. Un redémarrage coupe les connexions en cours ; un rechargement ne les coupe pas.',
  ],

  fields: [
    {
      id: 'nomPartage',
      label: 'Nom du partage',
      type: 'text',
      default: 'partage',
      placeholder: 'partage',
      help: 'Le nom que les clients verront, entre crochets dans smb.conf. Sans espace et sans caractère que Windows refuse. Les sections réservées — global, homes, printers, print$ — sont refusées.',
    },
    {
      id: 'chemin',
      label: 'Dossier à partager',
      type: 'text',
      default: '/srv/partage',
      placeholder: '/srv/partage',
      help: 'Un dossier de données dédié, qui doit DÉJÀ exister. Les zones système sont refusées : partager /etc ou /home expose la machine entière à tout client qui s’authentifie.',
    },
    {
      id: 'groupe',
      label: 'Groupe Unix autorisé',
      type: 'text',
      default: 'partage',
      placeholder: 'partage',
      help: 'Le partage sera limité à ce groupe, par « valid users = @groupe ». Un groupe plutôt qu’une liste de comptes : ajouter quelqu’un devient une commande sur le groupe, et non une modification de smb.conf.',
    },
    {
      id: 'ecriture',
      label: 'Autoriser l’écriture',
      type: 'select',
      default: 'Oui',
      options: OUI_NON,
      help: 'smb.conf(5) : « Default: read only = yes ». Sans ce choix, le partage se monte et rien ne s’y écrit. En écriture, l’assistant élargit aussi les masques — les valeurs par défaut, 0744 et 0755, retirent l’écriture au groupe sur chaque fichier déposé.',
    },
    {
      id: 'hotesAutorises',
      label: 'Hôtes autorisés (vide = tous)',
      type: 'text',
      default: '',
      placeholder: '192.168.30.0/24',
      optionnel: true,
      help: 'Une ou plusieurs adresses ou réseaux, séparés par une espace. Les jokers et /0 sont refusés : « autoriser tout le monde » n’est pas une restriction, et l’écrire comme si c’en était une est pire que de ne rien écrire.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le nom du partage',
      type: 'text',
      default: '',
      placeholder: 'partage',
      optionnel: true,
      help: 'Le verrou est dans le script, pas dans ce formulaire : sans cette phrase exacte, le script diagnostique, prépare, valide, et n’écrit rien du tout.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const nom = String(v.nomPartage ?? '').trim();
    const rn = validateNomPartage(nom, 'Le nom du partage');
    if (!rn.ok) {
      errors.nomPartage = rn.error;
    } else if (SECTIONS_RESERVEES.includes(nom.toLowerCase())) {
      errors.nomPartage = `« ${nom} » est une section réservée de smb.conf. Écrire dedans changerait la configuration globale ou le partage des dossiers personnels, et non créer un partage.`;
    }
    const rc = validateCheminAbsolu(v.chemin, 'Le dossier à partager');
    if (!rc.ok) {
      errors.chemin = rc.error;
    } else {
      const propre = rc.value.replace(/\/+$/, '') || '/';
      if (PARTAGE_REFUSE.includes(propre)) {
        errors.chemin = `« ${propre} » ne se partage pas. Un client qui s’authentifie obtiendrait la machine entière — ou, pour /home, les dossiers personnels de tout le monde d’un coup. Partage un dossier de données dédié, par exemple /srv/partage.`;
      }
    }
    const rg = validateNomGroupe(v.groupe, 'Le groupe Unix autorisé');
    if (!rg.ok) errors.groupe = rg.error;
    const re = validateChoix(v.ecriture, ['Oui', 'Non'], 'L’autorisation d’écriture');
    if (!re.ok) errors.ecriture = re.error;
    const hotes = String(v.hotesAutorises ?? '').trim();
    if (hotes !== '') {
      const mauvais = [];
      for (const h of hotes.split(/[\s,]+/).filter(Boolean)) {
        const r = validateClientNfs(h, 'L’hôte autorisé');
        if (!r.ok) mauvais.push(r.error);
      }
      if (mauvais.length > 0) errors.hotesAutorises = mauvais[0];
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const nom = String(v.nomPartage).trim();
    const chemin = String(v.chemin).trim().replace(/\/+$/, '') || '/';
    const groupe = String(v.groupe).trim();
    const ecriture = String(v.ecriture) === 'Oui';
    const hotes = String(v.hotesAutorises ?? '').trim().split(/[\s,]+/).filter(Boolean);

    // Les lignes de la section. Construites ICI, en JS, et écrites une par une
    // avec printf : les seules valeurs qui viennent du formulaire sont déjà
    // validées, et elles sont citées par shQuote au moment de l'écriture.
    const lignesSection = [
      '',
      `[${nom}]`,
      '   comment = Partage prepare par KJEMO IT Toolkit',
      `   path = ${chemin}`,
      '   browseable = yes',
      `   read only = ${ecriture ? 'no' : 'yes'}`,
      `   valid users = @${groupe}`,
      ...(ecriture ? [
        '   # Les masques par defaut de Samba sont 0744 pour les fichiers et',
        '   # 0755 pour les dossiers : un fichier depose depuis Windows arrive',
        '   # donc SANS droit d ecriture pour le groupe, et le collegue suivant',
        '   # le voit sans pouvoir le modifier. Ces deux lignes rendent',
        '   # l ecriture a plusieurs possible.',
        '   create mask = 0664',
        '   directory mask = 0775',
      ] : [
        '   # Partage en lecture seule : c est aussi la valeur par defaut de',
        '   # Samba, et elle est ecrite ici pour qu elle soit visible.',
      ]),
      ...(hotes.length > 0 ? [
        '   # Restriction par adresse, en PLUS de l authentification : les deux',
        '   # se cumulent, elles ne se remplacent pas.',
        `   hosts allow = ${hotes.join(' ')}`,
      ] : []),
      '   # Aucun « guest ok » : un partage sans mot de passe est une decision',
      '   # qui se prend en le sachant, et cet assistant ne la prend pas.',
    ];

    return assemblerSh([
      ...enteteBash({
        titre: 'Declarer un partage Samba, valide avant d etre mis en service',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'smb.conf appartient a root, et le rechargement du service aussi',
      }),
      ...blocGardienChemin(),
      ...blocSauvegardeFichier(),
      ...fonctionTestparmBash(),
      ...blocVariablesBash([
        ['KJEMO_SMBCONF', shQuote('/etc/samba/smb.conf')],
        ['KJEMO_NOM', shQuote(nom)],
        ['KJEMO_CHEMIN', shQuote(chemin)],
        ['KJEMO_GROUPE', shQuote(groupe)],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Partage' \"${KJEMO_NOM}\"",
      "  printf '%s\\t%s\\n' 'Dossier' \"${KJEMO_CHEMIN}\"",
      "  printf '%s\\t%s\\n' 'Groupe autorise' \"${KJEMO_GROUPE}\"",
      `  printf '%s\\t%s\\n' 'Ecriture' ${shQuote(ecriture ? 'Oui - masques elargis a 0664 / 0775' : 'Non - lecture seule')}`,
      `  printf '%s\\t%s\\n' 'Hotes autorises' ${shQuote(hotes.length > 0 ? hotes.join(' ') : 'tous (aucune restriction par adresse)')}`,
      "  printf '%s\\t%s\\n' 'Mot de passe Samba' 'AUCUN - smbpasswd reste une etape manuelle'",
      "  printf '%s\\t%s\\n' 'Acces invite' 'JAMAIS - aucun guest ok'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# Les drapeaux de la porte finale, tous definis AVANT la premiere',
      '# condition : sous « set -u », un drapeau non defini arreterait le script',
      '# au moment le moins pratique.',
      'KJEMO_NOM_LIBRE=0',
      'KJEMO_GROUPE_OK=0',
      'KJEMO_DOSSIER_OK=0',
      'KJEMO_CANDIDAT_OK=0',
      'KJEMO_VALIDE_OK=0',
      '',
      '# Le gardien de chemin tranche AVANT toute lecture du reste : un chemin',
      '# refuse ne doit pas meme servir a construire un candidat.',
      'kjemo_exiger_chemin_sur "${KJEMO_CHEMIN}" \'le dossier a partager\'',
      'KJEMO_CHEMIN="${KJEMO_CHEMIN_CANON}"',
      '',
      ...blocSambaBase({ exigeValide: true }),
      '# ---------------------------------------------------------------------------',
      '# ETAPE 1 - LE NOM EST-IL LIBRE ?',
      '#',
      '# Deux sections du meme nom dans smb.conf ne donnent pas une erreur : la',
      '# derniere lue gagne, silencieusement. Ajouter un partage dont le nom',
      '# existe deja changerait donc un partage existant sans le dire — et',
      '# retirer notre ajout ne reviendrait pas a l etat d avant.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_CONF_VALIDE}" -eq 1 ]; then',
      '  if printf \'%s\\n\' "${KJEMO_TESTPARM_SORTIE}" | grep -qiE "^\\[${KJEMO_NOM}\\]$"; then',
      "    kjemo_resultat 'Nom' \"${KJEMO_NOM}\" 'PROBLEME' 'deja declare' \\",
      '      "Une section [${KJEMO_NOM}] existe DEJA dans la configuration en service. Deux sections du meme nom ne provoquent pas d erreur : la derniere lue gagne, en silence. Cet assistant refuse donc, pour ne pas changer un partage existant sans le dire. Choisis un autre nom, ou modifie la section existante en la relisant."',
      '  else',
      '    KJEMO_NOM_LIBRE=1',
      "    kjemo_resultat 'Nom' \"${KJEMO_NOM}\" 'OK' 'libre' \\",
      '      "Aucune section [${KJEMO_NOM}] dans la configuration en service : le nom est libre."',
      '  fi',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 2 - LE GROUPE EXISTE-T-IL ?',
      '#',
      '# « valid users = @groupe » sur un groupe inexistant donne un partage que',
      '# PERSONNE ne peut ouvrir, et testparm ne s en plaint pas : il valide la',
      '# forme, pas l existence du groupe.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo getent && getent group -- "${KJEMO_GROUPE}" >/dev/null 2>&1; then',
      '  KJEMO_GROUPE_OK=1',
      '  KJEMO_MEMBRES="$(getent group -- "${KJEMO_GROUPE}" | cut -d: -f4)"',
      "  kjemo_resultat 'Groupe' \"${KJEMO_GROUPE}\" 'OK' \"membres : ${KJEMO_MEMBRES:-aucun}\" \\",
      '    "Le groupe ${KJEMO_GROUPE} existe. Membres actuels : ${KJEMO_MEMBRES:-aucun}. Un groupe sans membre donne un partage que personne n ouvre : « sudo usermod -aG ${KJEMO_GROUPE} <compte> », puis la personne doit se reconnecter pour que son appartenance prenne effet."',
      'else',
      "  kjemo_resultat 'Groupe' \"${KJEMO_GROUPE}\" 'PROBLEME' 'inconnu' \\",
      '    "Le groupe ${KJEMO_GROUPE} n existe pas. « valid users = @${KJEMO_GROUPE} » donnerait un partage que PERSONNE ne peut ouvrir, et testparm ne s en plaindrait pas — il valide la forme, pas l existence. A taper soi-meme : « sudo groupadd ${KJEMO_GROUPE} »."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 3 - LE DOSSIER EXISTE-T-IL, ET AVEC QUOI ?',
      '#',
      '# testparm accepte une section dont le « path » n existe pas : sa page de',
      '# manuel previent que la validation ne garantit pas que les services',
      '# seront disponibles. L erreur n apparait qu a la connexion du client, et',
      '# elle ne mentionne pas le dossier.',
      '#',
      '# Cet assistant ne cree PAS le dossier. Le creer demanderait de choisir',
      '# son proprietaire et son mode a la place de l operateur, et un dossier',
      '# partage cree avec le mauvais groupe est la premiere cause de « je me',
      '# connecte et je ne peux pas ecrire ».',
      '# ---------------------------------------------------------------------------',
      'if [ -d "${KJEMO_CHEMIN}" ]; then',
      '  KJEMO_DOSSIER_OK=1',
      '  KJEMO_STAT="$(stat -c \'%a %U:%G\' -- "${KJEMO_CHEMIN}" 2>/dev/null || true)"',
      '  KJEMO_OCT="$(printf \'%s\' "${KJEMO_STAT}" | cut -d\' \' -f1)"',
      '  KJEMO_GRP_DOSSIER="$(stat -c \'%G\' -- "${KJEMO_CHEMIN}" 2>/dev/null || true)"',
      "  kjemo_resultat 'Dossier' 'Existence' 'OK' \"${KJEMO_STAT}\" \\",
      '    "Le dossier ${KJEMO_CHEMIN} existe : ${KJEMO_STAT}."',
      '  if [ "${KJEMO_GRP_DOSSIER}" != "${KJEMO_GROUPE}" ]; then',
      "    kjemo_resultat 'Dossier' 'Groupe du dossier' 'ATTENTION' \"${KJEMO_GRP_DOSSIER:-inconnu}\" \\",
      '      "Le dossier appartient au groupe ${KJEMO_GRP_DOSSIER:-inconnu}, et le partage autorisera le groupe ${KJEMO_GROUPE}. Les deux peuvent differer legitimement, mais alors les membres de ${KJEMO_GROUPE} n auront sur les fichiers que les droits des AUTRES — souvent la lecture seule, quoi que dise « read only = no ». Samba n outrepasse jamais les permissions Unix. A aligner a la main : « sudo chgrp ${KJEMO_GROUPE} ${KJEMO_CHEMIN} »."',
      '  fi',
      '  if [ "${#KJEMO_OCT}" -ne 4 ]; then',
      "    kjemo_resultat 'Dossier' 'Bit setgid' 'ATTENTION' \"${KJEMO_OCT}\" \\",
      '      "Mode ${KJEMO_OCT} : pas de bit setgid. Un fichier cree dans ce dossier appartiendra au groupe PRINCIPAL de son auteur, et non a ${KJEMO_GROUPE} : le collegue suivant le verra sans pouvoir le modifier. C est la panne « on travaille a deux et ca ne marche qu a moitie ». A taper soi-meme : « sudo chmod 2775 ${KJEMO_CHEMIN} »."',
      '  fi',
      'else',
      "  kjemo_resultat 'Dossier' 'Existence' 'PROBLEME' 'absent' \\",
      '    "Le dossier ${KJEMO_CHEMIN} n existe pas, et cet assistant ne le cree pas. testparm ne le verrait pas : sa page de manuel previent que la validation ne garantit pas que les services seront disponibles, donc une section au chemin inexistant passe et echoue a la connexion du client. Les trois commandes, dans cet ordre : « sudo mkdir -p ${KJEMO_CHEMIN} », « sudo chgrp ${KJEMO_GROUPE} ${KJEMO_CHEMIN} », « sudo chmod 2775 ${KJEMO_CHEMIN} ». Le troisieme est celui qu on oublie, et c est lui qui rend l ecriture a plusieurs possible."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 4 - LE CANDIDAT, DANS LE DOSSIER TEMPORAIRE',
      '#',
      '# Le fichier en service est COPIE, la section est AJOUTEE a la fin, et le',
      '# resultat est valide par testparm. Rien n est ecrit hors du dossier',
      '# temporaire a ce stade — pas meme la sauvegarde, qui n a de sens que si',
      '# une modification va vraiment avoir lieu.',
      '# ---------------------------------------------------------------------------',
      "KJEMO_ESSAI=''",
      "KJEMO_RELU=''",
      'KJEMO_CANDIDAT="${KJEMO_TMP}/smb.conf.candidat"',
      'if [ -r "${KJEMO_SMBCONF}" ]; then',
      '  if {',
      '    cat -- "${KJEMO_SMBCONF}"',
      ...lignesSection.map((l) => `    printf '%s\\n' ${shQuote(l)}`),
      '  } > "${KJEMO_CANDIDAT}"; then',
      '    KJEMO_CANDIDAT_OK=1',
      '    KJEMO_LIGNES_AV="$(wc -l < "${KJEMO_SMBCONF}" | tr -d \' \')"',
      '    KJEMO_LIGNES_AP="$(wc -l < "${KJEMO_CANDIDAT}" | tr -d \' \')"',
      "    kjemo_resultat 'Candidat' 'Assemblage' 'OK' \"${KJEMO_LIGNES_AV} -> ${KJEMO_LIGNES_AP} lignes\" \\",
      '      "Le candidat est assemble : le fichier en service, inchange, PLUS la nouvelle section a la fin (${KJEMO_LIGNES_AV} lignes avant, ${KJEMO_LIGNES_AP} apres). Aucune ligne existante n a ete modifiee, et rien n est encore ecrit hors du dossier temporaire."',
      '  else',
      "    kjemo_resultat 'Candidat' 'Assemblage' 'PROBLEME' 'echec d ecriture' \\",
      "      'Le candidat n a pas pu etre assemble dans le dossier temporaire. Rien n a ete modifie.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Candidat' 'Assemblage' 'PROBLEME' 'smb.conf illisible' \\",
      '    "Le fichier ${KJEMO_SMBCONF} n est pas lisible : impossible d assembler un candidat, et rien ne sera modifie."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 5 - LA VALIDATION, PAR TESTPARM, SUR LE CANDIDAT',
      '#',
      '# « If testparm finds an error in the smb.conf file it returns an exit',
      '# code of 1 to the calling program, else it returns an exit code of 0. »',
      '# C est donc le CODE DE SORTIE qui decide, et non la lecture de son texte.',
      '#',
      '# -s est obligatoire : sans lui, testparm attend une touche apres avoir',
      '# affiche les noms de services, et le script paraitrait bloque.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_CANDIDAT_OK}" -eq 1 ] && kjemo_dispo testparm; then',
      '  KJEMO_ESSAI_CODE=0',
      '  kjemo_testparm "${KJEMO_CANDIDAT}" || KJEMO_ESSAI_CODE=$?',
      '  KJEMO_ESSAI="${KJEMO_TP_SORTIE}"',
      '  if [ "${KJEMO_ESSAI_CODE}" -eq 0 ]; then',
      '    KJEMO_VALIDE_OK=1',
      '    KJEMO_SECTIONS_AP="$(printf \'%s\\n\' "${KJEMO_ESSAI}" | grep -oE \'^\\[[^]]+\\]\' | paste -sd, - || true)"',
      "    kjemo_resultat 'Validation' 'testparm sur candidat' 'OK' \"${KJEMO_SECTIONS_AP}\" \\",
      '      "testparm ACCEPTE le candidat (code 0). Sections apres ajout : ${KJEMO_SECTIONS_AP}. Cette validation n a rien applique : testparm lit un fichier et sort. Ce qu elle ne dit PAS, et sa page de manuel l ecrit : que le service sera disponible ou se comportera comme prevu — un chemin inexistant la passe sans broncher, et c est pourquoi l existence du dossier est verifiee separement."',
      '  elif [ "${KJEMO_ESSAI_CODE}" -eq 2 ]; then',
      "    kjemo_resultat 'Validation' 'testparm sur candidat' 'PROBLEME' 'avertissement sans echec' \\",
      '      "testparm sort en 0 et SIGNALE un probleme sur le candidat : ${KJEMO_ESSAI}. Aucune ecriture n aura lieu. C est le cas qu un controle du seul code de sortie laisserait passer : une directive mal orthographiee est ignoree en silence par Samba, et le reglage qu on croit avoir pose n existe pas."',
      '  else',
      "    kjemo_resultat 'Validation' 'testparm sur candidat' 'PROBLEME' 'refuse' \\",
      '      "testparm REFUSE le candidat : ${KJEMO_ESSAI}. Aucune ecriture n aura lieu. Installer une configuration que testparm refuse empecherait smbd de recharger, et sur un serveur distant le partage tomberait sans qu une relecture puisse le dire."',
      '  fi',
      'elif [ "${KJEMO_CANDIDAT_OK}" -eq 1 ]; then',
      "  kjemo_resultat 'Validation' 'testparm sur candidat' 'IGNORE' 'non executee' \\",
      "    'testparm est absent : la validation n a PAS eu lieu, et rien ne sera ecrit. Une absence de validation n est pas une validation reussie.'",
      'fi',
      '',
      '# L APERCU EXACT, imprime. Le rapport Console n affiche que les lignes',
      '# ATTENTION, PROBLEME et IGNORE, et seulement leur commentaire : une',
      '# section qu on va ajouter a la configuration d un serveur doit etre LUE,',
      '# en entier, telle qu elle sera ecrite.',
      "printf '\\n%s\\n' '--- APERCU EXACT DE LA SECTION A AJOUTER ---'",
      ...lignesSection.map((l) => `printf '%s\\n' ${shQuote(l)}`),
      "printf '%s\\n' '--- fin de l apercu ---'",
      '',
      '# smbd arrete : la section peut etre ecrite, et elle ne sera pas SERVIE.',
      '# Ce n est pas une raison de refuser — le fichier, lui, sera correct — mais',
      '# c est une raison de le dire, sans quoi on cherchera le partage depuis un',
      '# client pendant que le demon est a l arret.',
      'if [ "${KJEMO_SERVICE_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Unite' 'Portee de l ajout' 'ATTENTION' 'smbd arrete' \\",
      '    "smbd n est pas actif : la section sera ecrite et validee, et aucun client ne la verra tant que le demon est a l arret. Le rechargement ci-dessous echouera donc, et ce ne sera pas un defaut de l ajout. A taper soi-meme : « sudo systemctl enable --now smbd »."',
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: nom,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `ajouter la section [${nom}] a smb.conf, puis recharger smbd`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_PAQUET_OK', 'Le paquet samba n est pas installe.'],
          ['KJEMO_CONF_VALIDE', 'La configuration en service est deja refusee par testparm : un ajout serait accuse a tort, et le retour arriere ne ramenerait qu a l etat fautif.'],
          ['KJEMO_NOM_LIBRE', 'Une section du meme nom existe deja : la derniere lue gagne en silence, et retirer l ajout ne reviendrait pas a l etat d avant.'],
          ['KJEMO_GROUPE_OK', 'Le groupe Unix autorise n existe pas : le partage serait ouvrable par personne.'],
          ['KJEMO_DOSSIER_OK', 'Le dossier a partager n existe pas : la section passerait testparm et echouerait a la connexion.'],
          ['KJEMO_CANDIDAT_OK', 'Le candidat n a pas pu etre assemble.'],
          ['KJEMO_VALIDE_OK', 'testparm refuse le candidat.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le nom du partage.'],
        ],
        action: 'l ajout de la section et le rechargement de smbd',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 6 - SAUVEGARDE, REMPLACEMENT, RELECTURE, ET RETOUR ARRIERE',
      '#',
      '# La sauvegarde est faite ICI, et non plus tot : un script qui n ira pas',
      '# jusqu a ecrire n a aucune raison de laisser un .bak dans /etc/samba.',
      '# Elle est relue et comparee par la fonction elle-meme, qui s arrete si la',
      '# comparaison echoue.',
      '# ---------------------------------------------------------------------------',
      '  kjemo_sauvegarder "${KJEMO_SMBCONF}"',
      '',
      '  if ! cp -p -- "${KJEMO_CANDIDAT}" "${KJEMO_SMBCONF}"; then',
      "    printf '%s\\n' 'ARRET : le remplacement de smb.conf a echoue.' >&2",
      '    kjemo_restaurer "${KJEMO_SMBCONF}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree. Aucun service recharge.' >&2",
      '    exit 1',
      '  fi',
      '  if ! cmp -s -- "${KJEMO_CANDIDAT}" "${KJEMO_SMBCONF}"; then',
      "    printf '%s\\n' 'ARRET : le fichier en place ne correspond pas au candidat valide.' >&2",
      '    kjemo_restaurer "${KJEMO_SMBCONF}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree. Aucun service recharge.' >&2",
      '    exit 1',
      '  fi',
      '',
      '  # LA RELECTURE. C est elle qui transforme « j ai ecrit le fichier » en',
      '  # « la configuration en service est valide ». Si elle echoue, on',
      '  # restaure : un smb.conf refuse empeche smbd de recharger, et un',
      '  # serveur distant devient alors muet.',
      '  KJEMO_RELU_CODE=0',
      '  kjemo_testparm "${KJEMO_SMBCONF}" || KJEMO_RELU_CODE=$?',
      '  KJEMO_RELU="${KJEMO_TP_SORTIE}"',
      '  if [ "${KJEMO_RELU_CODE}" -ne 0 ]; then',
      "    printf '%s\\n' 'ARRET : apres ecriture, testparm REFUSE le fichier en service.' >&2",
      '    printf \'%s\\n\' "Message : ${KJEMO_RELU}" >&2',
      '    kjemo_restaurer "${KJEMO_SMBCONF}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree, et AUCUN service n a ete recharge.' >&2",
      "    printf '%s\\n' 'Relis la configuration avant de recommencer.' >&2",
      '    exit 1',
      '  fi',
      '  if ! printf \'%s\\n\' "${KJEMO_RELU}" | grep -qiE "^\\[${KJEMO_NOM}\\]$"; then',
      "    printf '%s\\n' 'ARRET : la section attendue est absente de la configuration relue.' >&2",
      '    kjemo_restaurer "${KJEMO_SMBCONF}" || true',
      "    printf '%s\\n' 'La sauvegarde a ete restauree. Aucun service recharge.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Ecriture' \"${KJEMO_SMBCONF}\" 'OK' 'ecrit, compare, relu' \\",
      '    "La section [${KJEMO_NOM}] est en place, le fichier a ete compare au candidat valide, et testparm accepte la configuration EN SERVICE. Sauvegarde conservee : ${KJEMO_SAUVEGARDE}."',
      '',
      '# ---------------------------------------------------------------------------',
      '# ETAPE 7 - LE RECHARGEMENT, SEULEMENT MAINTENANT',
      '#',
      '# smbcontrol(1) : « reload-config — Force daemon to reload smb.conf',
      '# configuration file. Can be sent to smbd, nmbd, or winbindd. »',
      '#',
      '# Un RECHARGEMENT, et non un redemarrage : un redemarrage coupe les',
      '# connexions en cours, c est-a-dire les fichiers que des gens ont ouverts.',
      '# ---------------------------------------------------------------------------',
      '  KJEMO_RECHARGE=0',
      '  if kjemo_dispo smbcontrol; then',
      '    if smbcontrol smbd reload-config >/dev/null 2>&1; then KJEMO_RECHARGE=1; fi',
      '  fi',
      '  if [ "${KJEMO_RECHARGE}" -ne 1 ] && kjemo_dispo systemctl; then',
      '    if systemctl reload smbd >/dev/null 2>&1; then KJEMO_RECHARGE=1; fi',
      '  fi',
      '  if [ "${KJEMO_RECHARGE}" -eq 1 ]; then',
      "    kjemo_resultat 'Rechargement' 'smbd' 'OK' 'recharge' \\",
      "      'smbd a relu sa configuration. Un rechargement, et non un redemarrage : les connexions en cours — donc les fichiers ouverts par des gens — ne sont pas coupees.'",
      '  else',
      "    kjemo_resultat 'Rechargement' 'smbd' 'ATTENTION' 'non recharge' \\",
      "      'La section est ecrite et VALIDE, et le rechargement n a pas abouti — smbcontrol absent, ou smbd arrete. Le partage n est donc pas encore servi. A taper soi-meme : « sudo smbcontrol smbd reload-config », ou « sudo systemctl reload smbd ». Rien n est a defaire : le fichier, lui, est bon.'",
      '  fi',
      '',
      "  printf '\\n%s\\n' '=============================================================='",
      "  printf '%s\\n' 'IL RESTE DEUX ETAPES, ET AUCUNE NE PEUT ETRE AUTOMATISEE'",
      "  printf '%s\\n' '=============================================================='",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '1. Donne un mot de passe SAMBA a chaque compte. La base de'",
      "  printf '%s\\n' '   Samba est distincte de celle d Unix : un mot de passe'",
      "  printf '%s\\n' '   Unix correct est refuse par SMB tant que cette etape'",
      "  printf '%s\\n' '   n est pas faite. La commande demande le secret a la'",
      "  printf '%s\\n' '   console, et c est pour cela qu aucun script ne la'",
      "  printf '%s\\n' '   remplace :'",
      "  printf '%s\\n' '     sudo smbpasswd -a <compte>'",
      '  printf \'%s\\n\' "     sudo usermod -aG ${KJEMO_GROUPE} <compte>"',
      "  printf '%s\\n' '   La personne doit se RECONNECTER pour que son'",
      "  printf '%s\\n' '   appartenance au groupe prenne effet.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '2. Eprouve le partage depuis la machine AVANT d accuser'",
      "  printf '%s\\n' '   le reseau :'",
      "  printf '%s\\n' '     smbclient -L localhost -U <compte>'",
      '  printf \'%s\\n\' "     smbclient //localhost/${KJEMO_NOM} -U <compte>"',
      "  printf '%s\\n' '   Puis, si le pare-feu est actif :'",
      "  printf '%s\\n' '     sudo ufw allow samba'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'POUR ANNULER CET AJOUT : restaure la sauvegarde, relis,'",
      "  printf '%s\\n' 'puis recharge. Dans cet ordre, et jamais l inverse.'",
      '  printf \'%s\\n\' "     sudo cp -p \\"${KJEMO_SAUVEGARDE}\\" \\"${KJEMO_SMBCONF}\\""',
      '  printf \'%s\\n\' "     sudo testparm -s -- \\"${KJEMO_SMBCONF}\\""',
      "  printf '%s\\n' '     sudo smbcontrol smbd reload-config'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'Ce que ce script n a PAS fait : il n a cree aucun dossier,'",
      "  printf '%s\\n' 'aucun groupe, aucun compte, aucun mot de passe, et il n a'",
      "  printf '%s\\n' 'ouvert aucun port.'",
      "  printf '%s\\n' '=============================================================='",
      "  kjemo_resultat 'Suite' 'Etapes manuelles' 'ATTENTION' 'deux etapes restent' \\",
      '    "La section est en service. Restent le mot de passe SAMBA de chaque compte (« smbpasswd -a »), son appartenance au groupe ${KJEMO_GROUPE} suivie d une reconnexion, et l ouverture du pare-feu si UFW est actif. Sauvegarde conservee : ${KJEMO_SAUVEGARDE}."',
      'fi',
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-samba-partage' }),
    ]);
  },

  gui: [
    'Ne réécris jamais smb.conf en entier : ajoute une section. Le fichier contient des réglages locaux qu’aucun modèle ne devine.',
    'Valide AVANT de remplacer : « testparm -s /chemin/du/candidat ». testparm accepte un fichier quelconque en argument, et son code de sortie est documenté.',
    'Le « -s » est obligatoire dans un script : sans lui, testparm attend une touche après avoir listé les services.',
    'Un partage est en lecture seule par défaut : il faut « read only = no » pour écrire.',
    'Élargis les masques pour l’écriture à plusieurs : « create mask = 0664 » et « directory mask = 0775 ». Les défauts, 0744 et 0755, retirent l’écriture au groupe.',
    'Pose le bit setgid sur le dossier : « sudo chmod 2775 /srv/partage ». Sinon les fichiers créés appartiennent au groupe principal de leur auteur.',
    'Samba n’outrepasse jamais les permissions Unix : « read only = no » sur un dossier dont le groupe n’a pas le droit d’écrire ne donne rien.',
    'Préfère « valid users = @groupe » à une liste de comptes : ajouter quelqu’un devient une commande sur le groupe, pas une modification de smb.conf.',
    'Recharge, ne redémarre pas : « sudo smbcontrol smbd reload-config » ne coupe pas les fichiers ouverts.',
    'Le mot de passe Samba est une étape à part : « sudo smbpasswd -a <compte> ». Et la personne doit se reconnecter pour que son groupe prenne effet.',
  ],

  keywords: ['samba', 'smb', 'partage', 'share', 'smb.conf', 'testparm',
    'read only', 'valid users', 'create mask', 'setgid', 'smbcontrol',
    'reload', 'sauvegarde', 'rollback', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'sudo : smb.conf appartient à root, et le rechargement du service aussi.',
    'Une configuration en service que testparm accepte DÉJÀ. Sinon l’assistant refuse : il ne pourrait pas distinguer son ajout de l’erreur existante.',
    'Le dossier à partager, créé, avec le bon groupe et le bit setgid. L’assistant le vérifie et refuse s’il manque, en affichant les trois commandes.',
    'Le groupe Unix, créé, et les comptes qui en sont membres.',
    'Après coup, et à la main : un mot de passe Samba par compte, et l’ouverture du pare-feu.',
  ],

  commonErrors: [
    {
      message: 'testparm refuse le candidat',
      code: 'KJEMO',
      cause: 'Une directive mal orthographiée ou une valeur refusée. Le message de testparm nomme la ligne.',
      fix: 'Rien n’a été écrit : corriger le formulaire et régénérer.',
      command: 'testparm -s /etc/samba/smb.conf',
    },
    {
      message: 'Je me connecte et je ne peux pas écrire, alors que read only = no',
      code: 'KJEMO',
      cause: 'Les permissions Unix du dossier. Samba ne les outrepasse jamais : si le groupe n’a pas le droit d’écrire, aucune directive ne le donne.',
      fix: 'Aligner le groupe du dossier sur celui du partage, et poser le setgid.',
      command: 'sudo chgrp partage /srv/partage && sudo chmod 2775 /srv/partage',
    },
    {
      message: 'NT_STATUS_ACCESS_DENIED à la connexion',
      code: 'KJEMO',
      cause: 'Le compte n’est pas membre du groupe de « valid users », ou il n’a pas encore de mot de passe Samba.',
      fix: 'Vérifier l’appartenance et la base Samba, puis se reconnecter.',
      command: 'id <compte>; sudo pdbedit -L',
    },
    {
      message: 'La section est écrite et le partage n’apparaît pas',
      code: 'KJEMO',
      cause: 'smbd n’a pas relu sa configuration.',
      fix: 'Recharger, sans redémarrer.',
      command: 'sudo smbcontrol smbd reload-config',
    },
    {
      message: 'J’ai ajouté le compte au groupe et il n’a toujours pas accès',
      code: 'KJEMO',
      cause: 'Une appartenance de groupe ne prend effet qu’à la session suivante.',
      fix: 'Se déconnecter et se reconnecter, puis vérifier.',
      command: 'id <compte>',
    },
  ],

  reversible: true,
  verifyAfter: [
    'La configuration en service était valide AVANT l’ajout : sinon rien n’est fait.',
    'Le nom de partage était libre : deux sections du même nom se recouvrent en silence.',
    'Le groupe et le dossier existent : testparm ne contrôle ni l’un ni l’autre.',
    'Le candidat a été assemblé dans le dossier temporaire et validé par testparm, code de sortie à l’appui.',
    'L’aperçu exact de la section a été imprimé avant toute écriture.',
    'Sans la confirmation exacte, aucune écriture — pas même une sauvegarde.',
    'La sauvegarde a été créée, relue et comparée avant le remplacement.',
    'Après écriture : comparaison avec le candidat, puis RELECTURE par testparm sur le fichier en service, puis vérification que la section y figure.',
    'Si la relecture échoue, la sauvegarde est restaurée et aucun service n’est rechargé.',
    'Le rechargement vient en dernier, et c’est un reload — pas un restart.',
    'Aucun mot de passe, aucun « guest ok », aucun dossier créé, aucun port ouvert.',
  ],

  rollback: {
    summary: 'Le retour en arrière est une restauration de la sauvegarde horodatée que le script a créée, suivie d’une relecture et d’un rechargement — dans cet ordre. Comme aucune ligne existante n’a été réécrite, retirer la section suffit aussi : le fichier d’avant est exactement le fichier d’après moins la section ajoutée.',
    diagnostic: `# Ce que smbd applique reellement :
testparm -s
# La section ajoutee, et sa valeur effective :
testparm -s | grep -A8 '\\[partage\\]'
# Les sauvegardes laissees par l assistant :
ls -l /etc/samba/smb.conf.kjemo-*.bak`,
    command: `# Restaurer la sauvegarde la plus recente, relire, puis recharger.
# L ordre compte : un rechargement avant relecture mettrait en service
# un fichier qu on n a pas verifie.
sudo cp -p /etc/samba/smb.conf.kjemo-<horodatage>.bak /etc/samba/smb.conf
sudo testparm -s -- /etc/samba/smb.conf
sudo smbcontrol smbd reload-config

# Puis RELIRE, parce qu une restauration ne prouve pas un etat :
testparm -s | grep -c '\\[partage\\]'   # doit rendre 0

# Ce que l annulation ne defait PAS, et qui n a pas ete fait par le
# script : aucun dossier cree, aucun compte, aucun mot de passe Samba,
# aucun port ouvert. Si tu as ajoute un mot de passe Samba a la main :
#   sudo smbpasswd -x <compte>`,
    warning: 'Recharge après avoir relu, jamais avant : un smb.conf refusé empêche smbd de recharger, et sur un serveur distant le partage tombe sans que rien ne le dise.',
  },

  checks: [
    'smb.conf n’est jamais réécrit : la section est AJOUTÉE à la fin, et aucune ligne existante n’est touchée.',
    'L’assistant refuse une configuration en service déjà rejetée par testparm : il ne pourrait pas distinguer son ajout de l’erreur existante.',
    'Un nom de partage déjà déclaré est refusé : la dernière section lue gagne en silence.',
    'Les sections réservées — global, homes, printers, print$ — sont refusées par le formulaire.',
    'Les zones système sont refusées par le formulaire ET par le gardien de chemin dans le script, qui canonise avant de comparer.',
    'Le groupe et le dossier sont vérifiés : testparm ne contrôle ni l’existence de l’un ni celle de l’autre.',
    'La validation porte sur un CANDIDAT dans le dossier temporaire, et son code de sortie décide — la page de manuel garantit 1 en cas d’erreur, 0 sinon.',
    'testparm est toujours appelé avec « -s » : sans lui, il attend une touche.',
    'Aucune écriture — pas même la sauvegarde — avant que les huit conditions de la porte finale soient réunies.',
    'La sauvegarde est relue et comparée ; une sauvegarde non vérifiée arrête le script.',
    'Après écriture, la relecture par testparm décide : si elle échoue, la sauvegarde est restaurée et aucun service n’est rechargé.',
    'La présence de la section dans la configuration RELUE est vérifiée, et non déduite de l’écriture.',
    'Le rechargement est un reload, documenté par smbcontrol(1), et il vient après la relecture.',
    'Aucun mot de passe : aucun champ, aucun appel à smbpasswd, rien dans le rapport.',
    'Aucun « guest ok » n’est écrit, sous aucune condition.',
  ],

  source: `${M}/man5/smb.conf.5.html`,
  sources: [
    { label: 'smb.conf(5) — read only, valid users, create mask, directory mask, guest ok', url: `${M}/man5/smb.conf.5.html` },
    { label: 'testparm(1) — fichier en argument, code de sortie, -s', url: `${M}/man1/testparm.1.html` },
    { label: 'smbcontrol(1) — reload-config', url: `${M}/man1/smbcontrol.1.html` },
    { label: 'smbd(8)', url: `${M}/man8/smbd.8.html` },
    { label: 'Samba Wiki — serveur de fichiers autonome', url: `${WIKI}/index.php/Setting_up_Samba_as_a_Standalone_Server` },
  ],
};

// ===========================================================================
// 3. samba-diagnostic
// ===========================================================================
//
// Le cas du cours, et il a trois formes qu'on confond :
//
//   « je ne vois pas le serveur »        nmbd, ou la diffusion NetBIOS
//   « je ne peux pas m'y connecter »     authentification, ou pare-feu
//   « je me connecte et je ne peux       read only, ou les permissions Unix,
//     pas écrire »                       ou les masques, ou le setgid
//
// Les trois se corrigent ailleurs. L'assistant les sépare, et s'appuie sur
// une capacité de testparm que personne n'utilise : la page de manuel dit
// « If the optional host name and host IP address are specified on the command
// line, this test program will run through the service entries reporting
// whether the specified host has access to each service. » On peut donc
// demander à Samba lui-même si TEL client a le droit d'accéder à TEL partage,
// sans rien installer sur ce client.

const sambaDiagnostic = {
  id: 'samba-diagnostic',
  icon: '◇',
  category: CAT,
  subcategory: 'Samba',
  title: 'Diagnostiquer un partage Samba qui ne répond pas comme prévu',
  risk: 'diagnostic',
  summary: 'Sépare les trois pannes que « le partage ne marche pas » recouvre : invisible dans le voisinage réseau (nmbd), injoignable (pare-feu ou authentification), ou joignable sans droit d’écriture (read only, permissions Unix, masques, bit setgid). Lit les valeurs EFFECTIVES d’une section par testparm, interroge les deux bases de comptes, et demande à Samba lui-même si un hôte donné a accès au partage. N’écrit rien et ne touche à aucun mot de passe.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'samba — smbd (apt install samba)',
    'samba-common-bin — testparm, pdbedit',
    'smbclient — pour éprouver le partage depuis la machine, facultatif',
  ],
  privileges: 'aucun pour les unités, les ports, le pare-feu et les permissions du dossier. root pour la base des comptes Samba et le journal de l’unité — ces sections sont annoncées IGNORE quand root manque',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'smbd.service et nmbd.service',
  limites: [
    'LIT seulement. Ne démarre aucune unité, n’ouvre aucun port, ne corrige aucune permission, ne touche ni à smb.conf ni aux comptes.',
    'N’essaie aucune connexion authentifiée. Un test avec smbclient demanderait un mot de passe, et aucun mot de passe n’entre dans un formulaire de ce projet : la commande est affichée, à taper.',
    'Le test d’accès par hôte porte sur « hosts allow » et « hosts deny » seulement — c’est ce que testparm évalue. Il ne dit rien du compte ni du mot de passe, qui sont une autre couche.',
    'Ne teste pas depuis le poste client. Tout peut être correct ici et le client échouer pour une raison qui lui est propre : version de protocole imposée, compte local, ou équipement réseau entre les deux.',
  ],

  fields: [
    {
      id: 'nomPartage',
      label: 'Partage à examiner (vide = tous)',
      type: 'text',
      default: 'partage',
      placeholder: 'partage',
      optionnel: true,
      help: 'Si renseigné, les valeurs EFFECTIVES de cette section sont lues dans la sortie de testparm — et non dans smb.conf, qui ne montre pas les centaines de valeurs par défaut.',
    },
    {
      id: 'compteTeste',
      label: 'Compte à vérifier (vide = aucun)',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Vérifié dans les DEUX bases : Unix et Samba. Un compte présent dans la première et absent de la seconde échoue à l’authentification avec un mot de passe correct.',
    },
    {
      id: 'hoteTeste',
      label: 'Adresse du client à tester (vide = aucun)',
      type: 'text',
      default: '',
      placeholder: '192.168.30.50',
      optionnel: true,
      help: 'Samba lui-même dira si cette adresse a accès à chaque partage, d’après « hosts allow » et « hosts deny ». Rien n’est installé sur le client, et aucune connexion n’est ouverte.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const nom = String(v.nomPartage ?? '').trim();
    if (nom !== '') {
      const r = validateNomPartage(nom, 'Le partage à examiner');
      if (!r.ok) errors.nomPartage = r.error;
    }
    const u = String(v.compteTeste ?? '').trim();
    if (u !== '') {
      const r = validateNomUtilisateur(u, 'Le compte à vérifier');
      if (!r.ok) errors.compteTeste = r.error;
    }
    const h = String(v.hoteTeste ?? '').trim();
    if (h !== '') {
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.split('.').some((o) => Number(o) > 255)) {
        errors.hoteTeste = `« ${h} » n’est pas une adresse IPv4. testparm attend une ADRESSE pour évaluer « hosts allow » et « hosts deny » — un nom l’obligerait à résoudre, et une résolution qui échoue ferait conclure à un refus d’accès qui n’existe pas.`;
      }
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const nom = String(v.nomPartage ?? '').trim();
    const compte = String(v.compteTeste ?? '').trim();
    const hote = String(v.hoteTeste ?? '').trim();

    return assemblerSh([
      ...enteteBash({
        titre: 'Diagnostiquer un partage Samba qui ne repond pas comme prevu',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'la base des comptes Samba et le journal de l unite demandent root',
      }),
      ...fonctionTestparmBash(),
      ...blocVariablesBash([
        ['KJEMO_SMBCONF', shQuote('/etc/samba/smb.conf')],
        ['KJEMO_NOM', shQuote(nom)],
        ['KJEMO_COMPTE', shQuote(compte)],
        ['KJEMO_HOTE', shQuote(hote)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Partage examine' \"${KJEMO_NOM:-tous}\"",
      "  printf '%s\\t%s\\n' 'Compte verifie' \"${KJEMO_COMPTE:-aucun}\"",
      "  printf '%s\\t%s\\n' 'Client teste' \"${KJEMO_HOTE:-aucun}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - rien demarre, aucun port, aucune permission corrigee'",
      "  printf '%s\\t%s\\n' 'Connexion authentifiee' 'AUCUNE - aucun mot de passe demande'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      ...blocSambaBase(),
      ...blocSambaPorts(),
      ...blocSambaComptes(),
      ...(nom !== '' ? [
        '# -----------------------------------------------------------------------',
        '# LES VALEURS EFFECTIVES DE LA SECTION',
        '#',
        '# Lues dans la sortie de testparm, et non dans smb.conf : Samba a des',
        '# centaines de valeurs par defaut qui ne figurent dans aucun fichier.',
        '# Lire le fichier revient a lire ce que quelqu un a ECRIT ; lire testparm',
        '# revient a lire ce que Samba APPLIQUE, et c est la seule des deux qui',
        '# explique un comportement.',
        '# -----------------------------------------------------------------------',
        'KJEMO_SECTION_OK=0',
        "KJEMO_BLOC=''",
        'if [ "${KJEMO_CONF_VALIDE}" -eq 1 ]; then',
        '  KJEMO_BLOC="$(printf \'%s\\n\' "${KJEMO_TESTPARM_SORTIE}" \\',
        '    | awk -v s="[${KJEMO_NOM}]" \'$0 == s {dedans=1; next} /^\\[/ {dedans=0} dedans {print}\' || true)"',
        '  if [ -n "${KJEMO_BLOC}" ]; then',
        '    KJEMO_SECTION_OK=1',
        '    kjemo_param() {',
        '      printf \'%s\\n\' "${KJEMO_BLOC}" | sed -n "s/^[[:space:]]*${1} = //p" | head -1',
        '    }',
        '    KJEMO_PATH="$(kjemo_param \'path\')"',
        '    KJEMO_RO="$(kjemo_param \'read only\')"',
        '    KJEMO_VU="$(kjemo_param \'valid users\')"',
        '    KJEMO_CM="$(kjemo_param \'create mask\')"',
        '    KJEMO_DM="$(kjemo_param \'directory mask\')"',
        '    KJEMO_GUEST="$(kjemo_param \'guest ok\')"',
        '    KJEMO_BROWSE="$(kjemo_param \'browseable\')"',
        '    KJEMO_HA="$(kjemo_param \'hosts allow\')"',
        "    kjemo_resultat 'Section' \"${KJEMO_NOM}\" 'INFO' \"path=${KJEMO_PATH:-non declare}\" \\",
        '      "Valeurs EFFECTIVES de [${KJEMO_NOM}] : path=${KJEMO_PATH:-non declare}, read only=${KJEMO_RO:-defaut}, valid users=${KJEMO_VU:-aucun}, create mask=${KJEMO_CM:-defaut}, directory mask=${KJEMO_DM:-defaut}, guest ok=${KJEMO_GUEST:-defaut}, browseable=${KJEMO_BROWSE:-defaut}, hosts allow=${KJEMO_HA:-aucun}."',
        '    # read only : la cause nº 1 de « je ne peux pas ecrire ».',
        '    case "${KJEMO_RO}" in',
        '      no|No|NO)',
        "        kjemo_resultat 'Section' 'Ecriture' 'OK' 'read only = no' \\",
        "          'Samba autorise l ecriture sur ce partage. Si elle echoue malgre tout, la cause est dans les permissions UNIX du dossier : Samba ne les outrepasse jamais.'",
        '        ;;',
        '      *)',
        "        kjemo_resultat 'Section' 'Ecriture' 'PROBLEME' \"read only = ${KJEMO_RO:-yes (defaut)}\" \\",
        '        "Le partage est en LECTURE SEULE (read only = ${KJEMO_RO:-yes, la valeur par defaut documentee de Samba}). Ce n est pas une permission Unix, et aucun chmod ne la changera : il faut « read only = no » dans la section. C est la cause nº 1 de « je me connecte et je ne peux pas ecrire »."',
        '        ;;',
        '    esac',
        '    # Les masques, et la panne qui n apparait qu a deux personnes.',
        '    case "${KJEMO_CM}" in',
        '      0664|0660|0666|0775|0770|0777|664|660|666)',
        "        kjemo_resultat 'Section' 'create mask' 'OK' \"${KJEMO_CM}\" \\",
        '          "create mask = ${KJEMO_CM} : un fichier depose garde le droit d ecriture pour le groupe, donc le collegue suivant peut le modifier."',
        '        ;;',
        '      *)',
        "        kjemo_resultat 'Section' 'create mask' 'ATTENTION' \"${KJEMO_CM:-0744 (defaut)}\" \\",
        '        "create mask = ${KJEMO_CM:-0744, la valeur par defaut de Samba} : chaque fichier depose depuis un client arrive SANS droit d ecriture pour le groupe. Deux personnes sur le meme dossier, et la seconde voit le fichier sans pouvoir le modifier — alors que les permissions du DOSSIER, elles, sont correctes. C est la panne la plus deroutante du sujet. Pour de l ecriture partagee : create mask = 0664 et directory mask = 0775."',
        '        ;;',
        '    esac',
        '    # guest ok : un partage sans mot de passe.',
        '    case "${KJEMO_GUEST}" in',
        '      yes|Yes|YES)',
        "        kjemo_resultat 'Section' 'guest ok' 'PROBLEME' 'yes' \\",
        "          'Ce partage accepte les connexions SANS mot de passe : smb.conf(5) le dit ainsi — « no password is required to connect to the service ». Les privileges seront ceux du compte invite. C est peut-etre voulu ; si ce ne l est pas, c est une exposition complete du contenu a tout ce qui atteint le port.'",
        '        ;;',
        '      *)',
        "        kjemo_resultat 'Section' 'guest ok' 'OK' \"${KJEMO_GUEST:-no (defaut)}\" \\",
        '          "Aucun acces invite (guest ok = ${KJEMO_GUEST:-no, la valeur par defaut}) : une authentification est exigee."',
        '        ;;',
        '    esac',
        '    # Le dossier designe existe-t-il vraiment ?',
        '    if [ -n "${KJEMO_PATH}" ] && [ ! -d "${KJEMO_PATH}" ]; then',
        "      kjemo_resultat 'Section' 'Dossier designe' 'PROBLEME' \"${KJEMO_PATH}\" \\",
        '        "La section designe ${KJEMO_PATH}, qui n existe pas. testparm a pourtant valide la configuration : sa page de manuel previent que ce n est PAS une garantie que les services soient disponibles. Cote client, l erreur arrive a la connexion et ne mentionne pas le dossier."',
        '    elif [ -n "${KJEMO_PATH}" ]; then',
        '      KJEMO_STAT="$(stat -c \'%a %U:%G\' -- "${KJEMO_PATH}" 2>/dev/null || true)"',
        '      KJEMO_OCT="$(printf \'%s\' "${KJEMO_STAT}" | cut -d\' \' -f1)"',
        "      kjemo_resultat 'Section' 'Dossier designe' 'INFO' \"${KJEMO_STAT}\" \\",
        '        "Le dossier ${KJEMO_PATH} existe : ${KJEMO_STAT}. Samba n outrepasse jamais ces permissions — « read only = no » sur un dossier dont le groupe ne peut pas ecrire ne donne rien."',
        '      if [ "${#KJEMO_OCT}" -ne 4 ]; then',
        "        kjemo_resultat 'Section' 'Bit setgid' 'ATTENTION' \"${KJEMO_OCT}\" \\",
        '          "Mode ${KJEMO_OCT} : pas de bit setgid sur ${KJEMO_PATH}. Les fichiers crees appartiendront au groupe PRINCIPAL de leur auteur, et non au groupe du dossier. Correction a la main : chmod 2775 ${KJEMO_PATH}"',
        '      fi',
        '    fi',
        '  else',
        "    kjemo_resultat 'Section' \"${KJEMO_NOM}\" 'PROBLEME' 'introuvable' \\",
        '      "Aucune section [${KJEMO_NOM}] dans la configuration EFFECTIVE. Soit le nom differe — la casse compte ici —, soit la section a ete ecrite dans un fichier que smb.conf n inclut pas, soit smbd n a pas relu sa configuration depuis l ajout : « sudo smbcontrol smbd reload-config »."',
        '  fi',
        'fi',
        '',
      ] : [
        "kjemo_resultat 'Section' 'Examen' 'IGNORE' 'aucun partage nomme' \\",
        "  'Aucune section n a ete examinee en detail. C est pourtant la que se lisent « read only », les masques et « guest ok » — les trois reglages qui expliquent la plupart des comportements inattendus.'",
        '',
      ]),
      ...(hote !== '' ? [
        '# -----------------------------------------------------------------------',
        '# DEMANDER A SAMBA SI CE CLIENT A ACCES',
        '#',
        '# testparm(1) : « If the optional host name and host IP address are',
        '# specified on the command line, this test program will run through the',
        '# service entries reporting whether the specified host has access to',
        '# each service. »',
        '#',
        '# C est Samba qui repond, d apres ses propres « hosts allow » et',
        '# « hosts deny » — pas une interpretation du script. Rien n est installe',
        '# sur le client, et aucune connexion n est ouverte.',
        '#',
        '# Ce que ce test ne dit PAS : rien sur le compte ni sur le mot de passe.',
        '# C est une autre couche, et les confondre fait chercher au mauvais',
        '# endroit.',
        '# -----------------------------------------------------------------------',
        'if kjemo_dispo testparm && [ "${KJEMO_CONF_VALIDE}" -eq 1 ]; then',
        '  KJEMO_ACCES="$(testparm -s -- "${KJEMO_SMBCONF}" "${KJEMO_HOTE}" "${KJEMO_HOTE}" 2>&1 \\',
        '    | grep -iE \'allow|deny\' | head -20 || true)"',
        '  if [ -n "${KJEMO_ACCES}" ]; then',
        "    kjemo_resultat 'Acces par hote' \"${KJEMO_HOTE}\" 'INFO' \"${KJEMO_ACCES}\" \\",
        '      "Verdict de Samba pour ${KJEMO_HOTE}, partage par partage : ${KJEMO_ACCES}. Il porte sur « hosts allow » et « hosts deny » SEULEMENT — il ne dit rien du compte ni du mot de passe, qui sont une autre couche."',
        '    if printf \'%s\\n\' "${KJEMO_ACCES}" | grep -qi \'deny connection\'; then',
        "      kjemo_resultat 'Acces par hote' 'Refus' 'PROBLEME' 'refus par adresse' \\",
        '        "Samba REFUSE au moins un partage a ${KJEMO_HOTE} a cause d une restriction par adresse. Le symptome cote client ressemble a un probleme d authentification, et le mot de passe n y est pour rien : c est « hosts allow » ou « hosts deny » qu il faut relire."',
        '    fi',
        '  else',
        "    kjemo_resultat 'Acces par hote' \"${KJEMO_HOTE}\" 'INFO' 'aucune restriction par adresse' \\",
        '      "testparm ne signale ni autorisation ni refus nominatif pour ${KJEMO_HOTE} : aucune restriction par adresse ne s applique, et tout client qui atteint le port peut tenter de s authentifier."',
        '  fi',
        'fi',
        '',
      ] : [
        "kjemo_resultat 'Acces par hote' 'Test' 'IGNORE' 'aucune adresse donnee' \\",
        "  'Aucun client n a ete teste. testparm sait pourtant repondre, partage par partage, si une adresse donnee a acces — d apres « hosts allow » et « hosts deny », sans rien installer sur le client.'",
        '',
      ]),
      '# ---------------------------------------------------------------------------',
      '# LE JOURNAL DE L UNITE',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo journalctl; then',
      '  KJEMO_JOURNAL="$(journalctl -u smbd -u nmbd -n 30 --no-pager 2>/dev/null || true)"',
      "  kjemo_resultat 'Journal' 'smbd et nmbd' 'INFO' \"${KJEMO_JOURNAL:-vide}\" \\",
      "    'Le journal des deux unites. --no-pager est indispensable dans un script : sans lui, journalctl attend une touche.'",
      '  if printf \'%s\\n\' "${KJEMO_JOURNAL}" | grep -qiE \'NT_STATUS_LOGON_FAILURE|wrong password\'; then',
      "    kjemo_resultat 'Journal' 'Authentification' 'ATTENTION' 'echecs journalises' \\",
      "      'Le journal contient des echecs d authentification. Avant d accuser le mot de passe : le compte est-il dans la base SAMBA ? « sudo pdbedit -L ». Un mot de passe Unix correct ne vaut rien cote SMB tant que « smbpasswd -a » n a pas ete fait.'",
      '  fi',
      'else',
      "  kjemo_resultat 'Journal' 'smbd et nmbd' 'IGNORE' 'non lu' \\",
      "    'Le journal n a PAS ete lu : journalctl -u demande root. C est pourtant la qu apparaissent les echecs d authentification, avec le nom du compte concerne.'",
      'fi',
      '',
      ...(compte !== '' ? [
        '# -----------------------------------------------------------------------',
        '# LE COMPTE, DANS LES DEUX BASES',
        '# -----------------------------------------------------------------------',
        'if kjemo_dispo getent && getent passwd -- "${KJEMO_COMPTE}" >/dev/null 2>&1; then',
        '  KJEMO_GROUPES="$(id -nG -- "${KJEMO_COMPTE}" 2>/dev/null || true)"',
        "  kjemo_resultat 'Compte' 'Cote Unix' 'OK' \"${KJEMO_GROUPES:-aucun groupe}\" \\",
        '    "Le compte ${KJEMO_COMPTE} existe cote Unix, groupes : ${KJEMO_GROUPES:-aucun}. Si le partage porte « valid users = @groupe », ce groupe doit figurer ici — et une appartenance ajoutee recemment ne prend effet qu a la SESSION SUIVANTE de la personne."',
        'else',
        "  kjemo_resultat 'Compte' 'Cote Unix' 'PROBLEME' 'inconnu' \\",
        '    "Le compte ${KJEMO_COMPTE} n existe pas cote Unix : Samba ne peut pas l utiliser, puisque les permissions des fichiers sont des permissions Unix."',
        'fi',
        'if [ "${KJEMO_COMPTES_LU}" -eq 1 ]; then',
        '  case ",${KJEMO_COMPTES_SAMBA}," in',
        '    *",${KJEMO_COMPTE},"*)',
        "      kjemo_resultat 'Compte' 'Cote Samba' 'OK' \"${KJEMO_COMPTE}\" \\",
        '        "Le compte ${KJEMO_COMPTE} est connu de Samba : les deux bases concordent."',
        '      ;;',
        '    *)',
        "      kjemo_resultat 'Compte' 'Cote Samba' 'PROBLEME' 'absent de la base Samba' \\",
        '        "Le compte ${KJEMO_COMPTE} est connu d Unix et ABSENT de la base Samba : son mot de passe Unix sera refuse par SMB, et le message cote client ne parlera pas de Samba. A taper soi-meme : « sudo smbpasswd -a ${KJEMO_COMPTE} »."',
        '      ;;',
        '  esac',
        'fi',
        '',
      ] : []),
      '# La portee du rapport : si une section a ete demandee et non trouvee,',
      '# tout ce qui suit porte sur la machine et non sur CE partage. Le dire',
      '# evite de lire un verdict global comme un verdict sur la section.',
      'if [ -n "${KJEMO_NOM}" ] && [ "${KJEMO_SECTION_OK:-0}" -ne 1 ]; then',
      "  kjemo_resultat 'Section' 'Portee du rapport' 'ATTENTION' 'section non examinee' \\",
      '    "La section [${KJEMO_NOM}] n a pas pu etre examinee : elle est absente de la configuration effective, ou celle-ci n a pas pu etre lue. Les lignes qui suivent portent sur la MACHINE, pas sur ce partage."',
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT : TROIS PANNES, ET ELLES NE SE CORRIGENT PAS AU MEME ENDROIT',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_PAQUET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le paquet' \\",
      "    'Le serveur Samba n est pas installe : rien ne peut servir de partage.'",
      'elif [ "${KJEMO_CONF_VALIDE}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'la configuration' \\",
      "    'testparm refuse la configuration en service, ou n a pas pu la lire. Tant que ce message subsiste, smbd ne rechargera pas.'",
      'elif [ "${KJEMO_SERVICE_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'l unite smbd' \\",
      "    'smbd ne tourne pas : aucun partage n est servi, et le client recevra un refus franc sur le port 445.'",
      'elif [ "${KJEMO_PORT_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'les ports' \\",
      "    'Rien n ecoute sur 445 ni 139. Regarde le journal de smbd : une configuration refusee le fait sortir au demarrage.'",
      'elif [ "${KJEMO_FEU_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'le pare-feu' \\",
      "    'Tout ecoute sur la machine, et UFW est actif sans regle pour SMB : cote Windows, une attente puis « le chemin reseau est introuvable ».'",
      'else',
      "  kjemo_resultat 'Verdict' 'Couches locales' 'OK' 'completes' \\",
      "    'Paquet, configuration, unite, ports et pare-feu : tout est en place. Si un client echoue malgre tout, la cause est dans les trois couches que cette machine ne garantit pas seule — le compte dans la base SAMBA, les permissions UNIX du dossier, et les reglages de la section.'",
      'fi',
      "kjemo_resultat 'Verdict' 'Les trois pannes' 'ATTENTION' 'a ne pas confondre' \\",
      "  'Je ne VOIS pas le serveur : nmbd ou la diffusion NetBIOS — essaie par l adresse, « smbclient -L <adresse> -U <compte> », avant de conclure. Je ne peux pas m y CONNECTER : pare-feu, ou compte absent de la base Samba. Je me connecte et je ne peux pas ECRIRE : « read only », puis les permissions Unix du dossier, puis les masques, puis le bit setgid — dans cet ordre, parce que chacun peut masquer le suivant.'",
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucune unite demarree, aucun port ouvert, aucune permission corrigee, smb.conf intact, aucun mot de passe demande ni ecrit.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-samba-diagnostic' }),
    ]);
  },

  gui: [
    'Sépare les trois pannes avant de chercher : invisible, injoignable, ou joignable sans écriture. Elles ne se corrigent pas au même endroit.',
    'Lis les valeurs EFFECTIVES, pas le fichier : « testparm -s | grep -A10 "\\[partage\\]" ». Samba a des centaines de défauts qui ne figurent nulle part.',
    '« read only = yes » est la valeur par défaut : c’est la cause nº 1 de « je ne peux pas écrire », et aucun chmod ne la change.',
    'Samba n’outrepasse jamais les permissions Unix : « read only = no » sur un dossier dont le groupe ne peut pas écrire ne donne rien.',
    'Demande à Samba si un client a accès : « testparm -s /etc/samba/smb.conf 192.168.30.50 192.168.30.50 ». Il répond partage par partage.',
    'Un compte Unix n’est pas un compte Samba : « sudo pdbedit -L » avant d’accuser le mot de passe.',
    'Essaie par l’adresse avant de conclure à une panne : « smbclient -L 192.168.30.10 -U blaise ». Ne pas voir le serveur n’est pas ne pas pouvoir y accéder.',
    'Une appartenance de groupe ajoutée ne prend effet qu’à la session suivante de la personne.',
    'Après toute modification de smb.conf : « sudo smbcontrol smbd reload-config ». Une section écrite et non rechargée n’existe pas pour smbd.',
  ],

  keywords: ['samba', 'smb', 'diagnostic', 'partage', 'read only', 'create mask',
    'setgid', 'hosts allow', 'testparm', 'pdbedit', 'smbclient', 'nmbd',
    'logon failure', 'acces refuse', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour les unités, les ports, le pare-feu, la configuration effective et les permissions du dossier.',
    'sudo pour la base des comptes Samba (pdbedit) et le journal des unités. Sans sudo, ces sections sont annoncées IGNORE — pas OK.',
    'Le nom du partage, le compte et l’adresse du client, si l’on veut qu’ils soient examinés.',
  ],

  commonErrors: [
    {
      message: 'NT_STATUS_LOGON_FAILURE',
      code: 'KJEMO',
      cause: 'Le compte n’est pas dans la base Samba, ou son mot de passe Samba diffère de son mot de passe Unix. Les deux bases sont indépendantes.',
      fix: 'Vérifier la base Samba avant tout le reste.',
      command: 'sudo pdbedit -L',
    },
    {
      message: 'NT_STATUS_ACCESS_DENIED',
      code: 'KJEMO',
      cause: 'Le compte s’est authentifié et n’a pas le droit : il n’est pas dans « valid users », ou une restriction par adresse s’applique.',
      fix: 'Lire la section effective, puis demander à Samba si l’adresse a accès.',
      command: 'testparm -s /etc/samba/smb.conf 192.168.30.50 192.168.30.50',
    },
    {
      message: 'Le chemin réseau est introuvable',
      code: 'KJEMO',
      cause: 'Rien n’a répondu : pare-feu, ou smbd arrêté. Une attente puis ce message est la signature d’un filtrage.',
      fix: 'Vérifier l’écoute puis le pare-feu.',
      command: 'ss -lntup | grep 445; sudo ufw status',
    },
    {
      message: 'Je peux lire et pas écrire',
      code: 'KJEMO',
      cause: 'Trois causes possibles, dans cet ordre : « read only », les permissions Unix du dossier, puis les masques de création.',
      fix: 'Lire les trois, dans cet ordre : chacun masque le suivant.',
      command: 'testparm -s | grep -A10 "\\[partage\\]"; stat -c \'%a %U:%G\' /srv/partage',
    },
    {
      message: 'La section est dans smb.conf et testparm ne la voit pas',
      code: 'KJEMO',
      cause: 'Elle a été écrite dans un fichier que smb.conf n’inclut pas, la casse du nom diffère, ou smbd n’a pas relu.',
      fix: 'Comparer la sortie de testparm au fichier, puis recharger.',
      command: 'testparm -s | grep -oE "^\\[[^]]+\\]"',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Les trois pannes sont nommées séparément dans le verdict, avec l’ordre dans lequel les examiner.',
    'Les valeurs de la section viennent de la sortie de testparm, donc effectives.',
    '« read only » est jugé, avec sa valeur par défaut rappelée.',
    'Les masques de création sont jugés, et la panne « à deux, ça ne marche qu’à moitié » est expliquée.',
    '« guest ok = yes » est signalé PROBLEME, avec la phrase de la page de manuel.',
    'Le dossier désigné par la section est vérifié : testparm ne le fait pas.',
    'Si une adresse a été donnée : c’est Samba qui répond sur l’accès, et le rapport dit que ce test ne porte pas sur le compte.',
    'Les deux bases de comptes sont interrogées séparément.',
    'Aucune écriture, aucune connexion authentifiée, aucun mot de passe.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne démarre aucune unité et ne corrige aucune permission — un chmod sur un dossier partagé touche tout ce qu’il contient déjà.',
    diagnostic: `# Les valeurs effectives, section par section :
testparm -s
# Les deux bases de comptes :
getent passwd blaise; sudo pdbedit -L
# L acces d un client, d apres Samba lui-meme :
testparm -s /etc/samba/smb.conf 192.168.30.50 192.168.30.50
# Le journal des deux unites :
sudo journalctl -u smbd -u nmbd -n 30 --no-pager`,
    command: `# Aucune modification a annuler.
#
# Les corrections, selon la panne, et a taper soi-meme :
#   lecture seule :        « read only = no » dans la section, puis
#                          sudo smbcontrol smbd reload-config
#   permissions Unix :     sudo chgrp partage /srv/partage
#                          sudo chmod 2775 /srv/partage
#   ecriture a plusieurs : « create mask = 0664 » et
#                          « directory mask = 0775 » dans la section
#   compte Samba :         sudo smbpasswd -a <compte>
#   groupe :               sudo usermod -aG partage <compte>, puis la
#                          personne se reconnecte
#   pare-feu :             sudo ufw allow samba
#
# Chaque correction se relit : « testparm -s » pour la configuration,
# « stat » pour les permissions, « sudo pdbedit -L » pour les comptes.
echo 'Aucune modification effectuee par cet assistant.'`,
    warning: 'Ne mets pas un dossier partagé en 777 pour avancer : le groupe et le bit setgid font le même travail sans ouvrir le dossier à tout le monde.',
  },

  checks: [
    'Aucune écriture : aucune unité démarrée, aucun port ouvert, aucune permission corrigée, smb.conf intact.',
    'Aucune connexion authentifiée, aucun mot de passe demandé ni écrit : smbclient n’est qu’affiché.',
    'Les valeurs de la section sont lues dans la sortie de testparm, pas dans le fichier.',
    'testparm est toujours appelé avec « -s ».',
    'Le test d’accès par hôte est délégué à Samba, et le rapport dit explicitement ce qu’il ne couvre pas : le compte et le mot de passe.',
    'L’adresse du client est validée comme une IPv4 par le formulaire : un nom obligerait testparm à résoudre, et une résolution ratée ferait conclure à un refus inexistant.',
    'L’existence du dossier désigné est vérifiée, avec le rappel que testparm ne la garantit pas.',
    'Les deux bases de comptes sont distinguées, et l’écart est relié au message réel vu par le client.',
    'Le verdict donne l’ordre d’examen des trois pannes, parce que chacune peut masquer la suivante.',
    '« journalctl --no-pager » partout.',
  ],

  source: `${M}/man1/testparm.1.html`,
  sources: [
    { label: 'testparm(1) — test d’accès par hôte, code de sortie, -s', url: `${M}/man1/testparm.1.html` },
    { label: 'smb.conf(5) — read only, guest ok, create mask, directory mask, hosts allow', url: `${M}/man5/smb.conf.5.html` },
    { label: 'smbclient(1)', url: `${M}/man1/smbclient.1.html` },
    { label: 'pdbedit(8) — la base des comptes Samba', url: `${M}/man8/pdbedit.8.html` },
    { label: 'smbd(8)', url: `${M}/man8/smbd.8.html` },
  ],
};

export const toolsLinuxL = [
  sambaReadiness,
  sambaShareCreate,
  sambaDiagnostic,
];
