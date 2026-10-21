/**
 * outils-linux-m.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Samba Active Directory — contrôleur de domaine. Quatre assistants.
 *
 *   samba-ad-dc-readiness   LIT les sept prérequis d'un contrôleur de domaine,
 *                           dont celui que personne ne vérifie : le FQDN ne
 *                           doit PAS résoudre vers 127.0.0.1.
 *   samba-ad-dc-provision   PRÉPARE le provisionnement : refus, puis un
 *                           cahier de manœuvre exact dans le dossier
 *                           personnel. N'exécute JAMAIS samba-tool.
 *   samba-ad-health         LIT la santé d'un contrôleur en service.
 *   samba-ad-user-manage    LIT les comptes du domaine, et PRÉPARE les
 *                           commandes qui les modifient.
 *
 * ---------------------------------------------------------------------------
 * SAMBA AD N'EST PAS SAMBA PARTAGE, ET LES MÉLANGER CASSE LES DEUX
 * ---------------------------------------------------------------------------
 * Un serveur de fichiers Samba fait tourner `smbd` et `nmbd`. Un contrôleur de
 * domaine Samba fait tourner un UNIQUE processus `samba`, qui contient son
 * propre serveur SMB, son propre LDAP, son propre Kerberos et son propre DNS.
 * Les deux modes s'excluent : laisser `smbd` et `nmbd` actifs sur un
 * contrôleur donne deux serveurs SMB qui se disputent le port 445.
 *
 * C'est pour cela que ce module vit dans sa propre sous-rubrique, « Samba AD »,
 * et qu'aucun de ses assistants ne partage de code avec ceux du partage : une
 * section `[partage]` écrite par samba-share-create sur un contrôleur serait
 * techniquement valide et conceptuellement fausse.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CES ASSISTANTS NE FONT PAS, ET POURQUOI
 * ---------------------------------------------------------------------------
 * AUCUN n'exécute `samba-tool domain provision`. Trois raisons, et la première
 * suffit :
 *
 *   1. LE MOT DE PASSE. Provisionner demande de choisir le mot de passe du
 *      compte Administrator du domaine. `samba-tool` le demande à la console,
 *      et c'est la bonne façon. L'option `--adminpass` existe ; l'employer
 *      mettrait le mot de passe de l'administrateur du domaine dans un
 *      fichier de script, dans l'historique du terminal et dans la liste des
 *      processus. Aucun formulaire de ce projet n'a de champ de secret, et
 *      celui-là serait le pire de tous.
 *   2. L'IRRÉVERSIBILITÉ. Un domaine provisionné ne s'annule pas. Il n'y a pas
 *      de « dé-provisionner » : il y a restaurer une sauvegarde de la machine,
 *      ou reconstruire la machine. Une procédure d'annulation honnête le dit,
 *      et ne prétend pas qu'un fichier retiré suffit.
 *   3. L'ÉTAT DE DÉPART. Le wiki officiel insiste : « This tutorial assumes
 *      that this is a fresh installation of Samba on a fresh operating system
 *      installation. » Un assistant ne peut pas vérifier qu'une machine est
 *      neuve ; il peut vérifier qu'elle n'est PAS déjà provisionnée, et c'est
 *      ce qu'il fait — en refusant s'il trouve une base de domaine.
 *
 * Ce que l'assistant de provisionnement fait, donc : tous les refus, puis un
 * CAHIER DE MANŒUVRE — les commandes exactes, dans l'ordre, avec les valeurs
 * saisies — laissé dans le dossier personnel et imprimé. C'est la même forme
 * que netplan-readiness et ssh-hardening-audit, et pour la même raison : la
 * seule chose plus dangereuse qu'une commande non documentée est une commande
 * lancée par un script qui n'a pas pu vérifier ses conditions.
 *
 * ---------------------------------------------------------------------------
 * LES CINQ ÉTAPES, TELLES QUE LE WIKI OFFICIEL LES DONNE
 * ---------------------------------------------------------------------------
 * « the entire process of setting up a Samba domain controller consists of 5
 * steps » : installation des paquets ; SUPPRESSION des fichiers de
 * configuration Samba et Kerberos préinstallés ; provisionnement ; édition de
 * smb.conf si nécessaire ; démarrage du contrôleur.
 *
 * La deuxième est celle qu'on saute, et elle explique la moitié des échecs :
 * `samba-tool domain provision` refuse de travailler si un smb.conf
 * préexistant est en place. Le wiki donne même la commande pour trouver où il
 * est : « smbd -b | grep "CONFIGFILE" ».
 */

import {
  assemblerSh, enteteBash, fonctionsRapportBash, fonctionsEchappementBash,
  blocVariablesBash, blocRapportBash, blocPrivilegesBash, shQuote,
} from './noyau-bash.mjs';
import { blocConfirmation, blocPorteFinale } from './gardes-bash.mjs';
import {
  validateChoix, validateNomFichier, validateNomUtilisateur,
} from './validateurs-linux.mjs';
// validateIPv4 vit dans validateurs.mjs depuis le LOT 2, precisement pour
// etre reutilisable sans import circulaire. En reecrire une seconde ici ferait
// diverger les deux a la premiere correction.
import { validateIPv4 } from './validateurs.mjs';
import { assertValid } from './noyau.mjs';

const CAT = 'Linux et services réseau';
const M = 'https://manpages.ubuntu.com/manpages/noble/en';
const WIKI = 'https://wiki.samba.org/index.php';
const WIKI_AD = `${WIKI}/Setting_up_Samba_as_an_Active_Directory_Domain_Controller`;

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
 * Un realm Active Directory.
 *
 * Trois refus, et chacun a coûté une soirée à quelqu'un :
 *
 *   pas de point        un nom sans point est un nom NetBIOS, pas un realm.
 *                       Les enregistrements SRV ne se cherchent pas avec lui.
 *   .local              c'est le domaine réservé de mDNS (Bonjour, Avahi).
 *                       Un realm en .local fonctionne souvent, et échoue
 *                       parfois, sur certains clients seulement, sans message
 *                       utile. Avertissement et non refus : d'innombrables
 *                       laboratoires l'emploient, le cours compris.
 *   un domaine réel     kjemo.com appartient à quelqu'un. Un realm qui
 *                       reprend un domaine public rend la résolution
 *                       ambiguë dès qu'une machine sort du réseau.
 */
function validateRealm(v, label = 'Le realm') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 253) return { ok: false, value: s, error: `${label} dépasse 253 caractères.` };
  if (!s.includes('.')) {
    return {
      ok: false,
      value: s,
      error: `« ${s} » n’a pas de point : c’est un nom NetBIOS, pas un realm Active Directory. Un realm en comporte toujours un, par exemple kjemo.lan. Les enregistrements SRV — ceux qu’un client cherche pour trouver un contrôleur — ne se cherchent pas avec un nom sans point.`,
    };
  }
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(s)) {
    return {
      ok: false,
      value: s,
      error: `${label} ne peut contenir que des lettres, des chiffres, « . » et « - ». Valeur saisie : « ${s} ».`,
    };
  }
  if (/^[0-9.]+$/.test(s)) {
    return { ok: false, value: s, error: `« ${s} » ressemble à une adresse IP, pas à un realm.` };
  }
  return { ok: true, value: s, error: null };
}

/** Un nom NetBIOS : 15 caractères, majuscules, sans point. */
function validateNetbios(v, label = 'Le nom NetBIOS') {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, value: s, error: `${label} ne peut pas être vide.` };
  if (s.length > 15) {
    return {
      ok: false,
      value: s,
      error: `${label} dépasse 15 caractères, la limite de NetBIOS. Un nom plus long est accepté par le formulaire d’un outil graphique puis tronqué silencieusement, et deux domaines se retrouvent avec le même nom court.`,
    };
  }
  if (s.includes('.')) {
    return {
      ok: false,
      value: s,
      error: `${label} ne contient pas de point : c’est le nom COURT du domaine, par exemple KJEMO pour le realm kjemo.lan.`,
    };
  }
  if (!/^[A-Za-z0-9-]+$/.test(s)) {
    return { ok: false, value: s, error: `${label} ne peut contenir que des lettres, des chiffres et « - ». Valeur saisie : « ${s} ».` };
  }
  return { ok: true, value: s, error: null };
}

/**
 * Le bloc qui détecte un domaine DÉJÀ provisionné.
 *
 * Deux preuves indépendantes, parce qu'une seule peut mentir :
 *   la base du domaine — sam.ldb dans le dossier privé de Samba. C'est LA
 *   preuve : elle contient le domaine, ses comptes et son SID ;
 *   le rôle déclaré dans la configuration — « server role = active directory
 *   domain controller ».
 *
 * Trouver l'une sans l'autre est un état intermédiaire, et il faut le dire :
 * une base sans rôle déclaré est un provisionnement dont la configuration a
 * été perdue ; un rôle déclaré sans base est une configuration écrite à la
 * main sur une machine jamais provisionnée.
 */
function blocAdExistant() {
  return [
    '# ---------------------------------------------------------------------------',
    '# UN DOMAINE EXISTE-T-IL DEJA SUR CETTE MACHINE ?',
    '#',
    '# Deux preuves independantes. La base du domaine — sam.ldb — est LA preuve :',
    '# elle contient le domaine, ses comptes et son identifiant de securite. Le',
    '# role declare dans la configuration est la seconde.',
    '#',
    '# Trouver l une sans l autre est un etat intermediaire, et le dire vaut',
    '# mieux que de conclure a la va-vite : une base sans role declare est un',
    '# provisionnement dont la configuration a disparu ; un role sans base est',
    '# une configuration ecrite a la main sur une machine jamais provisionnee.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_AD_BASE=0',
    'KJEMO_AD_ROLE=0',
    'KJEMO_AD_EXISTE=0',
    '# Les deux emplacements possibles du dossier prive, nommes dans des',
    '# variables plutot qu ecrits dans la boucle : c est ce qui permet au banc',
    '# de les rediriger vers un bac a sable, et donc d eprouver le cas « un',
    '# domaine existe deja » sans fabriquer un faux domaine sur la machine de',
    '# developpement. Le banc ECHOUE si la redirection ne s applique pas.',
    "KJEMO_PRIV1='/var/lib/samba/private'",
    "KJEMO_PRIV2='/usr/local/samba/private'",
    'for kjemo_priv in "${KJEMO_PRIV1}" "${KJEMO_PRIV2}"; do',
    '  if [ -f "${kjemo_priv}/sam.ldb" ]; then',
    '    KJEMO_AD_BASE=1',
    '    KJEMO_BASE_VUE="${kjemo_priv}/sam.ldb"',
    '  fi',
    'done',
    'if [ -r "${KJEMO_SMBCONF}" ] \\',
    '  && grep -qiE \'^[[:space:]]*server role[[:space:]]*=[[:space:]]*active directory domain controller\' "${KJEMO_SMBCONF}"; then',
    '  KJEMO_AD_ROLE=1',
    'fi',
    'if [ "${KJEMO_AD_BASE}" -eq 1 ] && [ "${KJEMO_AD_ROLE}" -eq 1 ]; then',
    '  KJEMO_AD_EXISTE=1',
    "  kjemo_resultat 'Domaine' 'Deja provisionne' 'INFO' 'base et role presents' \\",
    '    "Cette machine EST un controleur de domaine : la base ${KJEMO_BASE_VUE:-sam.ldb} existe et la configuration declare le role. Aucun provisionnement n est possible ici — un second provisionnement ne remplace pas le premier, il echoue ou cree un domaine incoherent."',
    'elif [ "${KJEMO_AD_BASE}" -eq 1 ]; then',
    '  KJEMO_AD_EXISTE=1',
    "  kjemo_resultat 'Domaine' 'Etat intermediaire' 'PROBLEME' 'base presente, role absent' \\",
    '    "La base du domaine ${KJEMO_BASE_VUE:-sam.ldb} existe, et la configuration NE declare PAS le role de controleur. C est un provisionnement dont la configuration a ete perdue ou remplacee. Ne reprovisionne pas par-dessus : la base contient le domaine, ses comptes et son identifiant de securite, et un nouveau provisionnement n en herite pas. Restaure la configuration, ou reconstruis la machine depuis une sauvegarde."',
    'elif [ "${KJEMO_AD_ROLE}" -eq 1 ]; then',
    "  kjemo_resultat 'Domaine' 'Etat intermediaire' 'PROBLEME' 'role declare, base absente' \\",
    '    "La configuration declare le role de controleur de domaine et AUCUNE base n existe. Le service ne demarrera pas : il n y a pas de domaine. Soit la configuration a ete ecrite a la main sans provisionner, soit la base a ete perdue. Dans le premier cas, retire cette declaration avant de provisionner ; dans le second, c est une restauration qu il faut, pas un provisionnement."',
    'else',
    "  kjemo_resultat 'Domaine' 'Aucun domaine' 'OK' 'machine non provisionnee' \\",
    "    'Ni base de domaine, ni role declare : cette machine n a jamais ete provisionnee. C est l etat de depart attendu — le wiki officiel precise que la procedure suppose une installation neuve de Samba sur un systeme neuf.'",
    'fi',
    '',
  ];
}

/**
 * Les unités qui s'excluent.
 *
 * Un contrôleur de domaine fait tourner UN processus `samba`. Laisser `smbd`
 * et `nmbd` actifs donne deux serveurs SMB sur le même port, et le symptôme
 * est une connexion sur deux qui échoue — assez irrégulier pour qu'on cherche
 * la cause ailleurs pendant longtemps.
 */
function blocAdUnites() {
  return [
    '# ---------------------------------------------------------------------------',
    '# LES UNITES QUI S EXCLUENT',
    '#',
    '# Un controleur de domaine fait tourner UN processus « samba », qui contient',
    '# son propre serveur SMB, son propre LDAP, son propre Kerberos et son propre',
    '# DNS. Laisser smbd et nmbd actifs donne DEUX serveurs SMB sur le port 445.',
    '#',
    '# L etat de l unite samba-ad-dc est MESURE et non suppose : selon la',
    '# distribution et la version, elle peut etre livree masquee. A VALIDER sur',
    '# ta machine plutot que de recopier une recette.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_CONFLIT=0',
    'if kjemo_dispo systemctl; then',
    '  for kjemo_u in smbd nmbd winbind; do',
    '    kjemo_etat="$(systemctl is-active "${kjemo_u}" 2>/dev/null || true)"',
    '    kjemo_dem="$(systemctl is-enabled "${kjemo_u}" 2>/dev/null || true)"',
    '    if [ "${kjemo_etat}" = \'active\' ] || [ "${kjemo_dem}" = \'enabled\' ]; then',
    '      KJEMO_CONFLIT=$((KJEMO_CONFLIT + 1))',
    "      kjemo_resultat 'Unites' \"${kjemo_u}\" 'PROBLEME' \"active=${kjemo_etat} au-demarrage=${kjemo_dem}\" \\",
    '        "L unite ${kjemo_u} est active ou activee au demarrage. Sur un controleur de domaine, elle entre en conflit avec le processus « samba » : deux serveurs SMB sur le port 445, et une connexion sur deux qui echoue. A arreter et desactiver AVANT de provisionner : « sudo systemctl disable --now ${kjemo_u} »."',
    '    else',
    "      kjemo_resultat 'Unites' \"${kjemo_u}\" 'OK' \"active=${kjemo_etat:-inactive} au-demarrage=${kjemo_dem:-disabled}\" \\",
    '        "L unite ${kjemo_u} n est ni active ni activee : aucun conflit de ce cote."',
    '    fi',
    '  done',
    '  KJEMO_ADDC_ETAT="$(systemctl is-active samba-ad-dc 2>/dev/null || true)"',
    '  KJEMO_ADDC_DEM="$(systemctl is-enabled samba-ad-dc 2>/dev/null || true)"',
    "  kjemo_resultat 'Unites' 'samba-ad-dc' 'INFO' \"active=${KJEMO_ADDC_ETAT:-inconnue} au-demarrage=${KJEMO_ADDC_DEM:-inconnu}\" \\",
    '    "L unite du controleur : active=${KJEMO_ADDC_ETAT:-inconnue}, au demarrage=${KJEMO_ADDC_DEM:-inconnu}. Si elle est « masked », elle ne demarrera pas tant qu elle n est pas demasquee — c est une mesure faite ici, et non une regle generale : selon la distribution et la version, elle peut etre livree masquee ou non."',
    'fi',
    '',
  ];
}

/**
 * Le bloc qui vérifie que le FQDN ne résout pas vers le bouclage.
 *
 * Le wiki officiel est catégorique : « The host name and FQDN must not resolve
 * to the 127.0.0.1 IP address or any other IP address than the one used on the
 * LAN interface of the DC. »
 *
 * C'est le prérequis que personne ne vérifie, et celui qui casse le plus
 * silencieusement : Ubuntu met souvent le nom de la machine en face de
 * 127.0.1.1 dans /etc/hosts. Le provisionnement réussit, le contrôleur
 * démarre, et il publie dans son propre DNS une adresse à laquelle aucun
 * client ne peut se connecter. L'erreur apparaît alors sur les clients, pas
 * sur le serveur.
 */
function blocAdNom() {
  return [
    '# ---------------------------------------------------------------------------',
    '# LE FQDN NE DOIT PAS RESOUDRE VERS LE BOUCLAGE',
    '#',
    '# Le wiki officiel : « The host name and FQDN must not resolve to the',
    '# 127.0.0.1 IP address or any other IP address than the one used on the LAN',
    '# interface of the DC. »',
    '#',
    '# C est le prerequis qu on saute, et celui qui casse le plus',
    '# silencieusement : Ubuntu met souvent le nom de la machine en face de',
    '# 127.0.1.1 dans /etc/hosts. Le provisionnement reussit, le controleur',
    '# demarre, et il publie dans son propre DNS une adresse a laquelle aucun',
    '# client ne peut se connecter. L erreur apparait alors sur les CLIENTS, et',
    '# pas sur le serveur — donc on la cherche du mauvais cote.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_NOM_OK=0',
    "KJEMO_FQDN=''",
    "KJEMO_COURT=''",
    'if kjemo_dispo hostname; then',
    '  KJEMO_FQDN="$(hostname -f 2>/dev/null || true)"',
    '  KJEMO_COURT="$(hostname 2>/dev/null || true)"',
    'fi',
    "kjemo_resultat 'Nom' 'FQDN et nom court' 'INFO' \"${KJEMO_FQDN:-inconnu} / ${KJEMO_COURT:-inconnu}\" \\",
    '  "Nom pleinement qualifie : ${KJEMO_FQDN:-inconnu}. Nom court : ${KJEMO_COURT:-inconnu}. Les deux doivent resoudre vers l adresse de l interface locale, et vers elle seule."',
    'if [ -z "${KJEMO_FQDN}" ] || [ "${KJEMO_FQDN}" = "${KJEMO_COURT}" ]; then',
    "  kjemo_resultat 'Nom' 'FQDN' 'PROBLEME' 'non qualifie' \\",
    '    "« hostname -f » ne rend pas un nom pleinement qualifie (${KJEMO_FQDN:-rien}) : il rend le meme nom que « hostname », ou rien du tout. Un controleur de domaine a besoin d un FQDN, par exemple dc1.kjemo.lan. Cela se corrige dans /etc/hosts, en mettant l adresse de l interface locale en face du FQDN PUIS du nom court, sur la meme ligne."',
    'else',
    '  KJEMO_RESOLU="$(getent hosts -- "${KJEMO_FQDN}" 2>/dev/null | awk \'{print $1}\' | paste -sd, - || true)"',
    '  case "${KJEMO_RESOLU}" in',
    "    ''|*127.0.0.1*|*127.0.1.1*)",
    "      kjemo_resultat 'Nom' 'Resolution du FQDN' 'PROBLEME' \"${KJEMO_RESOLU:-rien}\" \\",
    '        "Le FQDN ${KJEMO_FQDN} resout vers ${KJEMO_RESOLU:-rien}. Le wiki officiel l interdit explicitement : ni 127.0.0.1, ni aucune adresse autre que celle de l interface locale du controleur. Ubuntu met souvent le nom de la machine en face de 127.0.1.1 — et dans cet etat le provisionnement REUSSIT, le controleur demarre, et il publie dans son propre DNS une adresse a laquelle aucun client ne peut se connecter. Corrige /etc/hosts : une ligne « <adresse-locale> ${KJEMO_FQDN} ${KJEMO_COURT} »."',
    '      ;;',
    '    *)',
    '      KJEMO_NOM_OK=1',
    "      kjemo_resultat 'Nom' 'Resolution du FQDN' 'OK' \"${KJEMO_RESOLU}\" \\",
    '        "Le FQDN ${KJEMO_FQDN} resout vers ${KJEMO_RESOLU}, qui n est pas une adresse de bouclage. Verifie quand meme que c est bien l adresse de l interface locale, et non celle d une autre interface."',
    '      ;;',
    '  esac',
    'fi',
    '',
    '# Les adresses de la machine. Qu une adresse soit STATIQUE ne se lit pas de',
    '# facon fiable depuis ici : le dire est plus honnete que de le deviner.',
    "KJEMO_ADRESSES=''",
    'if kjemo_dispo ip; then',
    '  KJEMO_ADRESSES="$(ip -brief address show scope global 2>/dev/null | head -10 || true)"',
    'fi',
    "kjemo_resultat 'Adresse' 'Interfaces' 'INFO' \"${KJEMO_ADRESSES:-aucune}\" \\",
    '  "Adresses de portee globale : ${KJEMO_ADRESSES:-aucune}. A VALIDER separement : qu elles soient STATIQUES. Cela ne se lit pas de facon fiable depuis la machine — une adresse obtenue par DHCP ressemble a une adresse fixe. Le wiki rappelle qu un controleur doit avoir une adresse fixe, et que si elle vient quand meme du DHCP, elle doit etre hors de la plage distribuee. L assistant netplan-readiness montre la configuration reelle de l interface."',
    '',
  ];
}

/**
 * L'heure, et Kerberos.
 *
 * Kerberos refuse un ticket dont l'horodatage s'écarte trop de l'heure du
 * serveur. La tolérance par défaut est de quelques minutes, et le message
 * d'erreur parle de « clock skew » — ce qui n'évoque rien à qui cherche une
 * panne d'authentification.
 */
function blocAdHeure() {
  return [
    '# ---------------------------------------------------------------------------',
    '# L HEURE, ET POURQUOI KERBEROS LA REGARDE',
    '#',
    '# Kerberos refuse un ticket dont l horodatage s ecarte trop de l heure du',
    '# serveur : c est ce qui empeche de rejouer un ticket intercepte. La',
    '# tolerance par defaut se compte en minutes — krb5.conf(5) la documente',
    '# sous le nom « clockskew » — et le message d erreur parle de « clock',
    '# skew », ce qui n evoque rien a qui cherche une panne d authentification.',
    '#',
    '# Sur un controleur, l heure n est donc pas un detail de confort : c est un',
    '# prerequis de l authentification de tout le domaine.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_HEURE_OK=0',
    'if kjemo_dispo timedatectl; then',
    '  KJEMO_SYNC="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)"',
    '  KJEMO_NTP="$(timedatectl show -p NTP --value 2>/dev/null || true)"',
    '  KJEMO_FUSEAU="$(timedatectl show -p Timezone --value 2>/dev/null || true)"',
    '  if [ "${KJEMO_SYNC}" = \'yes\' ]; then',
    '    KJEMO_HEURE_OK=1',
    "    kjemo_resultat 'Heure' 'Synchronisation' 'OK' \"NTP=${KJEMO_NTP} synchronise=${KJEMO_SYNC} fuseau=${KJEMO_FUSEAU}\" \\",
    '      "L horloge est synchronisee (service NTP=${KJEMO_NTP}, fuseau ${KJEMO_FUSEAU}). Kerberos refuse un ticket dont l horodatage s ecarte de quelques minutes : c est donc un prerequis de l authentification de tout le domaine, et non un detail de confort."',
    '  else',
    "    kjemo_resultat 'Heure' 'Synchronisation' 'PROBLEME' \"NTP=${KJEMO_NTP:-inconnu} synchronise=${KJEMO_SYNC:-non}\" \\",
    '      "L horloge n est PAS synchronisee (service NTP=${KJEMO_NTP:-inconnu}). Kerberos refusera les tickets des que l ecart depassera sa tolerance, et le message parlera de « clock skew » — pas d authentification. Sur un controleur, cela casse l ouverture de session de tout le domaine. A corriger AVANT de provisionner : « sudo timedatectl set-ntp true », puis relire. L assistant linux-time-sync-diagnostic examine cette couche en detail."',
    '  fi',
    'else',
    "  kjemo_resultat 'Heure' 'Synchronisation' 'IGNORE' 'timedatectl absent' \\",
    "    'timedatectl est absent : la synchronisation n a PAS ete controlee. C est pourtant un prerequis de Kerberos, donc de l authentification du domaine entier.'",
    'fi',
    '',
  ];
}

/**
 * Le DNS, et le conflit sur le port 53.
 *
 * Un contrôleur AD avec le back-end interne de Samba sert lui-même le DNS, sur
 * le port 53 de son adresse locale. Et le wiki est précis sur ce que
 * /etc/resolv.conf doit contenir : « set the AD DNS domain in the search and
 * the IP of your DC in the nameserver parameter », puis « Do not add any other
 * lines, your DC should use itself as its nameserver ».
 */
function blocAdDns() {
  return [
    '# ---------------------------------------------------------------------------',
    '# LE DNS : QUI SERT LE PORT 53, ET QUI RESOUT POUR LA MACHINE',
    '#',
    '# Un controleur avec le back-end DNS interne de Samba sert LUI-MEME le DNS',
    '# sur le port 53 de son adresse locale. Deux consequences a mesurer :',
    '#',
    '#   1. ce qui occupe deja le port 53 entrera en conflit. systemd-resolved',
    '#      ecoute sur 127.0.0.53 par defaut — ce qui cohabite — mais il peut',
    '#      aussi ecouter plus largement. C est MESURE ici, pas suppose.',
    '#   2. apres provisionnement, le controleur doit se resoudre LUI-MEME. Le',
    '#      wiki : « set the AD DNS domain in the search and the IP of your DC',
    '#      in the nameserver parameter », et « Do not add any other lines ».',
    '#      Un resolveur qui reecrit /etc/resolv.conf tout seul defait donc ce',
    '#      reglage a chaque redemarrage.',
    '# ---------------------------------------------------------------------------',
    "KJEMO_PORT53=''",
    'if kjemo_dispo ss; then',
    '  KJEMO_PORT53="$(ss -lntup 2>/dev/null | grep -E \'[:.]53[[:space:]]\' | head -10 || true)"',
    'fi',
    'if [ -n "${KJEMO_PORT53}" ]; then',
    "  kjemo_resultat 'DNS' 'Port 53' 'ATTENTION' \"${KJEMO_PORT53}\" \\",
    '    "Quelque chose ecoute deja sur le port 53 : ${KJEMO_PORT53}. Lis l ADRESSE : 127.0.0.53 est le relais local de systemd-resolved et cohabite avec un controleur qui ecoute sur son adresse locale ; une ecoute sur 0.0.0.0:53 ou sur l adresse locale, en revanche, empechera le DNS interne de Samba de demarrer. A VALIDER sur cette machine avant de provisionner."',
    'else',
    "  kjemo_resultat 'DNS' 'Port 53' 'OK' 'libre' \\",
    "    'Rien n ecoute sur le port 53 : le DNS interne de Samba pourra s y lier.'",
    'fi',
    'if [ -L /etc/resolv.conf ]; then',
    '  KJEMO_LIEN="$(readlink -f /etc/resolv.conf 2>/dev/null || true)"',
    "  kjemo_resultat 'DNS' '/etc/resolv.conf' 'ATTENTION' \"lien vers ${KJEMO_LIEN:-inconnu}\" \\",
    '    "/etc/resolv.conf est un LIEN vers ${KJEMO_LIEN:-inconnu} : il est donc regenere automatiquement. Apres provisionnement, le controleur doit se resoudre lui-meme — le wiki demande « search <domaine> » et « nameserver <adresse-du-controleur> », et precise « Do not add any other lines ». Un fichier regenere defait ce reglage a chaque redemarrage : c est a traiter en meme temps que le provisionnement, et non apres avoir constate que la resolution retombe."',
    'elif [ -r /etc/resolv.conf ]; then',
    '  KJEMO_SERVEURS="$(grep -E \'^[[:space:]]*nameserver\' /etc/resolv.conf 2>/dev/null | paste -sd, - || true)"',
    "  kjemo_resultat 'DNS' '/etc/resolv.conf' 'INFO' \"${KJEMO_SERVEURS:-aucun}\" \\",
    '    "Fichier reel, serveurs declares : ${KJEMO_SERVEURS:-aucun}. Apres provisionnement, il devra contenir le domaine AD dans « search » et l adresse DU CONTROLEUR dans « nameserver », et rien d autre."',
    'else',
    "  kjemo_resultat 'DNS' '/etc/resolv.conf' 'IGNORE' 'illisible' \\",
    "    'Le fichier /etc/resolv.conf n est pas lisible depuis cette session : la couche resolution n a pas ete controlee.'",
    'fi',
    '',
  ];
}

// ===========================================================================
// 1. samba-ad-dc-readiness
// ===========================================================================

const sambaAdDcReadiness = {
  id: 'samba-ad-dc-readiness',
  icon: '◇',
  category: CAT,
  subcategory: 'Samba AD',
  title: 'Vérifier les prérequis d’un contrôleur de domaine Samba',
  risk: 'diagnostic',
  summary: 'Lit les sept prérequis d’un contrôleur de domaine Active Directory, dont celui que personne ne vérifie : le FQDN ne doit pas résoudre vers 127.0.0.1 — sinon le provisionnement réussit, le contrôleur démarre, et il publie une adresse à laquelle aucun client ne peut se connecter. Détecte un domaine déjà provisionné, les unités smbd et nmbd qui s’excluent avec un contrôleur, l’occupation du port 53, l’heure non synchronisée que Kerberos refusera, et le fichier resolv.conf régénéré. N’installe rien et ne provisionne rien.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'samba — le contrôleur (apt install samba)',
    'winbind — la résolution des comptes du domaine',
    'krb5-user — kinit, klist',
    'bind9-host ou dnsutils — host, pour vérifier les enregistrements SRV',
  ],
  privileges: 'aucun pour le nom, les adresses, l’heure, les unités et les ports. root pour la base du domaine et la configuration de Samba — ces sections sont annoncées IGNORE quand root manque',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'samba-ad-dc.service',
  limites: [
    'LIT seulement. N’installe aucun paquet, n’arrête aucune unité, ne touche ni à /etc/hosts, ni à resolv.conf, ni à l’heure, et ne provisionne rien.',
    'Ne peut pas prouver qu’une machine est NEUVE. Le wiki officiel suppose une installation fraîche de Samba sur un système frais ; cet assistant vérifie l’inverse mesurable — qu’aucun domaine n’est déjà provisionné.',
    'Ne peut pas prouver qu’une adresse est STATIQUE. Une adresse obtenue par DHCP ressemble à une adresse fixe depuis la machine : le rapport le dit et renvoie à netplan-readiness, plutôt que de deviner.',
    'L’état de l’unité samba-ad-dc est mesuré, pas supposé : selon la distribution et la version, elle peut être livrée masquée. Aucune recette n’est recopiée à sa place.',
    'Ne vérifie pas la réplication ni les enregistrements SRV : il n’y a pas encore de domaine. C’est samba-ad-health qui lit un contrôleur en service.',
  ],

  fields: [
    {
      id: 'realm',
      label: 'Realm envisagé',
      type: 'text',
      default: 'kjemo.lan',
      placeholder: 'kjemo.lan',
      help: 'Le nom DNS complet du domaine, avec un point. Évite un domaine public qui appartient à quelqu’un d’autre, et sache que « .local » est le domaine réservé de mDNS : il fonctionne souvent et échoue parfois, sur certains clients seulement.',
    },
    {
      id: 'netbios',
      label: 'Nom NetBIOS envisagé',
      type: 'text',
      default: 'KJEMO',
      placeholder: 'KJEMO',
      help: 'Le nom court du domaine, 15 caractères au plus, sans point. Un nom plus long est tronqué silencieusement par certains outils, et deux domaines se retrouvent avec le même nom court.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const r = validateRealm(v.realm, 'Le realm envisagé');
    if (!r.ok) errors.realm = r.error;
    const n = validateNetbios(v.netbios, 'Le nom NetBIOS envisagé');
    if (!n.ok) errors.netbios = n.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const realm = String(v.realm).trim();
    const netbios = String(v.netbios).trim().toUpperCase();

    return assemblerSh([
      ...enteteBash({
        titre: 'Verifier les prerequis d un controleur de domaine Samba',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'la base du domaine et la configuration de Samba ne se lisent pas sans root',
      }),
      ...blocVariablesBash([
        ['KJEMO_SMBCONF', shQuote('/etc/samba/smb.conf')],
        ['KJEMO_REALM', shQuote(realm)],
        ['KJEMO_REALM_MAJ', shQuote(realm.toUpperCase())],
        ['KJEMO_NETBIOS', shQuote(netbios)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Realm envisage' \"${KJEMO_REALM}\"",
      "  printf '%s\\t%s\\n' 'Realm Kerberos' \"${KJEMO_REALM_MAJ}\"",
      "  printf '%s\\t%s\\n' 'Nom NetBIOS' \"${KJEMO_NETBIOS}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - rien installe, rien arrete, aucun provisionnement'",
      "  printf '%s\\t%s\\n' 'Mots de passe' 'AUCUN - samba-tool n est jamais appele'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# PREREQUIS 1 - LES PAQUETS',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PAQUET_OK=0',
      "KJEMO_PAQUETS_VUS=''",
      "KJEMO_PAQUETS_MANQUE=''",
      'if kjemo_dispo dpkg-query; then',
      '  for kjemo_p in samba winbind krb5-user bind9-host dnsutils smbclient; do',
      "    kjemo_etat=\"$(dpkg-query -W -f='${Status}' \"${kjemo_p}\" 2>/dev/null || true)\"",
      '    if [ "${kjemo_etat#*ok installed}" != "${kjemo_etat}" ]; then',
      '      KJEMO_PAQUETS_VUS="${KJEMO_PAQUETS_VUS} ${kjemo_p}"',
      '    else',
      '      KJEMO_PAQUETS_MANQUE="${KJEMO_PAQUETS_MANQUE} ${kjemo_p}"',
      '    fi',
      '  done',
      'fi',
      'case " ${KJEMO_PAQUETS_VUS} " in',
      '  *" samba "*)',
      '    KJEMO_PAQUET_OK=1',
      "    kjemo_resultat 'Paquets' 'samba' 'OK' \"${KJEMO_PAQUETS_VUS# }\" \\",
      '      "Paquets presents :${KJEMO_PAQUETS_VUS:- aucun}. Absents :${KJEMO_PAQUETS_MANQUE:- aucun}. Le paquet « samba » apporte le controleur ; « winbind » resout les comptes du domaine ; « krb5-user » apporte kinit et klist, qui servent a EPROUVER l authentification ; « bind9-host » ou « dnsutils » apportent « host », qui sert a verifier les enregistrements SRV."',
      '    ;;',
      '  *)',
      "    kjemo_resultat 'Paquets' 'samba' 'PROBLEME' \"${KJEMO_PAQUETS_VUS:-aucun}\" \\",
      '      "Le paquet « samba » n est pas installe (absents :${KJEMO_PAQUETS_MANQUE:- aucun}). Rien ne peut etre provisionne. Sur Ubuntu, c est le meme paquet qui fournit le serveur de fichiers et le controleur de domaine : c est le PROVISIONNEMENT qui decide du role, pas l installation."',
      '    ;;',
      'esac',
      '',
      ...blocAdNom(),
      ...blocAdHeure(),
      ...blocAdDns(),
      ...blocAdExistant(),
      ...blocAdUnites(),
      '# ---------------------------------------------------------------------------',
      '# LA CONFIGURATION PREEXISTANTE, QU IL FAUDRA ECARTER',
      '#',
      '# Le wiki officiel liste cinq etapes, et la DEUXIEME est celle qu on saute :',
      '# « Deletion of pre-configured Samba and Kerberos placeholder configuration',
      '# files ». samba-tool refuse de provisionner par-dessus un smb.conf',
      '# preexistant, et le wiki donne meme la commande pour le trouver :',
      '# « smbd -b | grep "CONFIGFILE" ».',
      '# ---------------------------------------------------------------------------',
      'if [ -f "${KJEMO_SMBCONF}" ]; then',
      '  KJEMO_TAILLE="$(wc -l < "${KJEMO_SMBCONF}" 2>/dev/null | tr -d \' \' || printf \'%s\' 0)"',
      "  kjemo_resultat 'Configuration' 'smb.conf preexistant' 'ATTENTION' \"${KJEMO_TAILLE} lignes\" \\",
      '    "Un fichier ${KJEMO_SMBCONF} existe (${KJEMO_TAILLE} lignes). Le wiki officiel en fait la DEUXIEME de ses cinq etapes : supprimer les fichiers de configuration Samba et Kerberos preinstalles. samba-tool refuse de provisionner par-dessus. Ne le supprime pas : DEPLACE-le, pour pouvoir y relire les reglages locaux qu il contenait. La commande du wiki pour trouver le chemin reel : « smbd -b | grep CONFIGFILE »."',
      'else',
      "  kjemo_resultat 'Configuration' 'smb.conf preexistant' 'OK' 'absent' \\",
      '    "Aucun ${KJEMO_SMBCONF} : la deuxieme etape du wiki est deja satisfaite. Le provisionnement ecrira lui-meme une configuration de controleur."',
      'fi',
      'if [ -f /etc/krb5.conf ]; then',
      "  kjemo_resultat 'Configuration' '/etc/krb5.conf preexistant' 'ATTENTION' 'present' \\",
      "    'Un /etc/krb5.conf existe. Le provisionnement genere sa propre configuration Kerberos dans le dossier prive de Samba, et c est celle-la qu il faut mettre en place ensuite. Un krb5.conf preexistant, souvent pose par l installation du paquet, designe un autre realm et fait echouer kinit avec un message qui ne parle pas du fichier. DEPLACE-le plutot que de le supprimer.'",
      'else',
      "  kjemo_resultat 'Configuration' '/etc/krb5.conf preexistant' 'OK' 'absent' \\",
      "    'Aucun /etc/krb5.conf : rien a ecarter de ce cote.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT : LE PREMIER PREREQUIS MANQUANT',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_AD_EXISTE}" -eq 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Provisionnement impossible' 'PROBLEME' 'domaine deja present' \\",
      "    'Cette machine porte deja une base de domaine. Un second provisionnement ne remplace pas le premier : il echoue, ou cree un domaine incoherent dont les comptes et l identifiant de securite ne sont pas ceux d avant. Si le domaine existant doit disparaitre, c est une reconstruction de la machine qu il faut prevoir — pas une commande.'",
      'elif [ "${KJEMO_PAQUET_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premier prerequis manquant' 'PROBLEME' 'les paquets' \\",
      "    'Le paquet samba n est pas installe : « sudo apt install samba winbind krb5-user bind9-host ». Les prerequis suivants n ont pas de sens avant celui-la.'",
      'elif [ "${KJEMO_NOM_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premier prerequis manquant' 'PROBLEME' 'le nom' \\",
      '    "Le FQDN ne resout pas vers une adresse utilisable. C est le prerequis dont l oubli coute le plus cher : le provisionnement REUSSIT quand meme, et le controleur publie dans son propre DNS une adresse a laquelle aucun client ne peut se connecter. Corrige /etc/hosts d abord."',
      'elif [ "${KJEMO_HEURE_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premier prerequis manquant' 'PROBLEME' 'l heure' \\",
      "    'L horloge n est pas synchronisee. Kerberos refusera les tickets des que l ecart depassera sa tolerance, et cela casse l ouverture de session de TOUT le domaine. « sudo timedatectl set-ntp true », puis relire.'",
      'elif [ "${KJEMO_CONFLIT}" -gt 0 ]; then',
      "  kjemo_resultat 'Verdict' 'Premier prerequis manquant' 'PROBLEME' 'les unites en conflit' \\",
      '    "${KJEMO_CONFLIT} unite(s) du mode serveur de fichiers sont actives ou activees. Sur un controleur, elles se disputent le port 445 avec le processus « samba ». A arreter et desactiver avant de provisionner."',
      'else',
      "  kjemo_resultat 'Verdict' 'Prerequis reunis' 'OK' 'les sept sont satisfaits' \\",
      '    "Paquets presents, FQDN resolvable vers une adresse non locale, horloge synchronisee, port 53 examine, aucun domaine existant, aucune unite en conflit. Restent deux points que cette machine ne peut pas prouver seule : que son adresse est STATIQUE, et qu elle est NEUVE. L assistant samba-ad-dc-provision prepare la suite — il ne provisionne pas."',
      'fi',
      '',
      "printf '\\n%s\\n' '=============================================================='",
      "printf '%s\\n' 'LES CINQ ETAPES DU WIKI OFFICIEL, DANS L ORDRE'",
      "printf '%s\\n' '=============================================================='",
      "printf '%s\\n' ''",
      "printf '%s\\n' '1. Installer les paquets.'",
      "printf '%s\\n' '     sudo apt install samba winbind krb5-user bind9-host'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '2. ECARTER les fichiers de configuration preinstalles. C est'",
      "printf '%s\\n' '   l etape qu on saute, et samba-tool refuse de provisionner'",
      "printf '%s\\n' '   par-dessus. DEPLACE-les, ne les supprime pas : on veut'",
      "printf '%s\\n' '   pouvoir y relire ce qu ils contenaient.'",
      "printf '%s\\n' '     smbd -b | grep CONFIGFILE'",
      "printf '%s\\n' '     sudo mv /etc/samba/smb.conf /etc/samba/smb.conf.avant-ad'",
      "printf '%s\\n' '     sudo mv /etc/krb5.conf /etc/krb5.conf.avant-ad'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '3. Arreter et desactiver les unites du mode serveur de'",
      "printf '%s\\n' '   fichiers, qui s excluent avec un controleur :'",
      "printf '%s\\n' '     sudo systemctl disable --now smbd nmbd winbind'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '4. Provisionner. L assistant samba-ad-dc-provision prepare'",
      "printf '%s\\n' '   cette commande avec tes valeurs, et ne la lance PAS : elle'",
      "printf '%s\\n' '   demande le mot de passe de l administrateur du domaine a'",
      "printf '%s\\n' '   la console, et ce mot de passe n a sa place ni dans un'",
      "printf '%s\\n' '   script, ni dans un historique de terminal.'",
      "printf '%s\\n' ''",
      "printf '%s\\n' '5. Demarrer le controleur, puis EPROUVER : SRV, Kerberos,'",
      "printf '%s\\n' '   partages sysvol et netlogon. L assistant samba-ad-health'",
      "printf '%s\\n' '   fait ces lectures.'",
      "printf '%s\\n' ''",
      "printf '%s\\n' 'Ce que ce script n a PAS fait : aucun paquet installe, aucune'",
      "printf '%s\\n' 'unite arretee, aucun fichier deplace, aucun provisionnement.'",
      "printf '%s\\n' '=============================================================='",
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucun paquet, aucune unite touchee, aucun fichier deplace, aucun provisionnement, aucun mot de passe.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-samba-ad-prerequis' }),
    ]);
  },

  gui: [
    'Un contrôleur de domaine n’est pas un serveur de fichiers : il fait tourner UN processus « samba », et smbd/nmbd doivent être arrêtés et désactivés.',
    'Vérifie d’abord le nom : « hostname -f » doit rendre un FQDN, et « getent hosts $(hostname -f) » ne doit PAS rendre 127.0.0.1 ni 127.0.1.1.',
    'Ubuntu met souvent le nom de la machine en face de 127.0.1.1 : corrige /etc/hosts avec une ligne « <adresse-locale> dc1.kjemo.lan dc1 ».',
    'L’heure est un prérequis de Kerberos, pas un confort : « timedatectl » doit dire « synchronized: yes ».',
    'Écarte le smb.conf et le krb5.conf préinstallés avant de provisionner — c’est la deuxième des cinq étapes du wiki, et celle qu’on saute.',
    'Déplace-les, ne les supprime pas : on veut pouvoir relire les réglages locaux qu’ils contenaient.',
    'L’adresse du contrôleur doit être fixe. Si elle vient du DHCP, elle doit au moins être hors de la plage distribuée.',
    'Après provisionnement, le contrôleur se résout LUI-MÊME : « search <domaine> » et « nameserver <son adresse> » dans resolv.conf, et rien d’autre.',
    'Si resolv.conf est un lien régénéré automatiquement, traite-le en même temps que le provisionnement — sinon le réglage retombe au redémarrage.',
  ],

  keywords: ['samba', 'active directory', 'ad dc', 'controleur de domaine',
    'realm', 'netbios', 'kerberos', 'fqdn', 'hosts', 'dns', 'port 53',
    'prerequis', 'provisionnement', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour le nom, les adresses, l’heure, les unités et les ports.',
    'sudo pour la base du domaine (/var/lib/samba/private) et la configuration de Samba. Sans sudo, ces sections sont annoncées IGNORE — pas OK.',
    'Le realm et le nom NetBIOS envisagés.',
  ],

  commonErrors: [
    {
      message: 'Le provisionnement a réussi et aucun client ne trouve le domaine',
      code: 'KJEMO',
      cause: 'Le FQDN résolvait vers 127.0.1.1 au moment du provisionnement : le contrôleur a publié cette adresse dans son propre DNS.',
      fix: 'Corriger /etc/hosts, puis vérifier l’enregistrement A publié.',
      command: 'getent hosts $(hostname -f); host -t A $(hostname -f)',
    },
    {
      message: 'ERROR: Provision failed - smb.conf already exists',
      code: 'KJEMO',
      cause: 'La deuxième des cinq étapes du wiki a été sautée : les fichiers de configuration préinstallés doivent être écartés.',
      fix: 'Déplacer smb.conf, pas le supprimer.',
      command: 'smbd -b | grep CONFIGFILE',
    },
    {
      message: 'kinit : Clock skew too great',
      code: 'KJEMO',
      cause: 'L’horloge du client ou du contrôleur s’écarte trop. Kerberos le refuse par conception, pour empêcher le rejeu d’un ticket.',
      fix: 'Synchroniser l’heure des deux côtés.',
      command: 'timedatectl',
    },
    {
      message: 'Une connexion SMB sur deux échoue sur le contrôleur',
      code: 'KJEMO',
      cause: 'smbd tourne en plus du processus samba : deux serveurs SMB se disputent le port 445.',
      fix: 'Désactiver les unités du mode serveur de fichiers.',
      command: 'systemctl is-active smbd nmbd winbind',
    },
    {
      message: 'Le DNS interne de Samba ne démarre pas',
      code: 'KJEMO',
      cause: 'Un autre service occupe le port 53 sur l’adresse où Samba veut se lier.',
      fix: 'Lire qui écoute, et sur quelle adresse.',
      command: 'ss -lntup | grep :53',
    },
  ],

  reversible: true,
  verifyAfter: [
    'Le rapport dit si le FQDN résout vers une adresse de bouclage, et cite l’interdiction du wiki.',
    'La synchronisation de l’horloge est rapportée, avec sa conséquence sur Kerberos.',
    'L’occupation du port 53 est mesurée, et l’adresse d’écoute est distinguée du port.',
    'Un domaine déjà provisionné est détecté par DEUX preuves indépendantes, et les états intermédiaires sont nommés.',
    'Les unités smbd, nmbd et winbind sont rapportées séparément, actives et activées-au-démarrage.',
    'L’état de samba-ad-dc est mesuré, pas supposé.',
    'Les fichiers de configuration préinstallés sont signalés, avec la consigne de les DÉPLACER.',
    'Le verdict nomme le premier prérequis manquant.',
    'Ce que la machine ne peut pas prouver — adresse statique, machine neuve — est dit explicitement.',
    'Aucune écriture, aucun provisionnement, aucun mot de passe.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne déplace aucun fichier et n’arrête aucune unité, parce qu’une machine à moitié préparée est plus difficile à diagnostiquer qu’une machine intacte.',
    diagnostic: `# Le nom, et ce vers quoi il resout :
hostname -f; getent hosts "$(hostname -f)"
# L heure, que Kerberos regarde :
timedatectl
# Les unites qui s excluent :
systemctl is-active smbd nmbd winbind samba-ad-dc
# Un domaine existe-t-il deja ?
sudo ls -l /var/lib/samba/private/sam.ldb`,
    command: `# Aucune modification a annuler.
#
# La preparation, a taper soi-meme, dans cet ordre :
#   sudo apt install samba winbind krb5-user bind9-host
#   sudo systemctl disable --now smbd nmbd winbind
#   sudo mv /etc/samba/smb.conf /etc/samba/smb.conf.avant-ad
#   sudo mv /etc/krb5.conf /etc/krb5.conf.avant-ad
#   sudo timedatectl set-ntp true
#
# Et dans /etc/hosts, une ligne qui mette l adresse LOCALE en face du
# FQDN puis du nom court :
#   192.168.30.10  dc1.kjemo.lan  dc1
#
# Rien de tout cela n est fait par ce script.`,
    warning: 'Ne provisionne pas tant que « getent hosts $(hostname -f) » rend une adresse de bouclage : le provisionnement réussira, et le domaine sera inutilisable depuis les clients.',
  },

  checks: [
    'Aucune écriture : aucun paquet, aucune unité arrêtée, aucun fichier déplacé, aucun provisionnement.',
    'Aucun mot de passe : samba-tool n’est jamais appelé, et aucun champ de secret n’existe.',
    'Le FQDN est confronté à sa résolution réelle, et 127.0.1.1 est traité comme 127.0.0.1 — c’est la valeur qu’Ubuntu pose par défaut.',
    'Un domaine existant est détecté par deux preuves, et les deux états intermédiaires sont nommés séparément.',
    'Les unités en conflit sont comptées, et le compte alimente le verdict.',
    'L’état de samba-ad-dc est rapporté comme une mesure, avec la mention explicite qu’aucune règle générale n’est recopiée à sa place.',
    'Le port 53 est mesuré avec son adresse d’écoute, et la cohabitation avec le relais de systemd-resolved est distinguée d’un vrai conflit.',
    'Le realm sans point est refusé par le formulaire : c’est un nom NetBIOS, et les SRV ne se cherchent pas avec lui.',
    'Le nom NetBIOS de plus de 15 caractères est refusé, avec la raison : certains outils le tronquent en silence.',
    'Les deux choses non prouvables — adresse statique, machine neuve — sont déclarées comme telles et non devinées.',
  ],

  source: WIKI_AD,
  sources: [
    { label: 'Samba Wiki — contrôleur de domaine AD : les cinq étapes, /etc/hosts, resolv.conf', url: WIKI_AD },
    { label: 'samba-tool(8)', url: `${M}/man8/samba-tool.8.html` },
    { label: 'smb.conf(5) — server role', url: `${M}/man5/smb.conf.5.html` },
    { label: 'krb5.conf(5) — la tolérance d’horloge', url: `${M}/man5/krb5.conf.5.html` },
    { label: 'timedatectl(1)', url: `${M}/man1/timedatectl.1.html` },
  ],
};

// ===========================================================================
// 2. samba-ad-dc-provision
// ===========================================================================
//
// Il ne provisionne pas. C'est son nom, et c'est volontairement trompeur
// nulle part : la fiche, le résumé, les limites et le script le disent tous.
//
// Ce qu'il fait : tous les refus qui comptent, puis un CAHIER DE MANŒUVRE —
// les commandes exactes, dans l'ordre, avec les valeurs saisies — écrit dans
// le dossier personnel et imprimé. Il n'appelle jamais samba-tool, et le banc
// le mesure.

const sambaAdDcProvision = {
  id: 'samba-ad-dc-provision',
  icon: '◆',
  category: CAT,
  subcategory: 'Samba AD',
  title: 'Préparer le provisionnement d’un contrôleur de domaine, sans le lancer',
  risk: 'caution',
  summary: 'Vérifie les conditions d’un provisionnement et REFUSE si l’une manque : domaine déjà présent, FQDN résolvant vers le bouclage, horloge non synchronisée, unités du mode serveur de fichiers encore actives, adresse déclarée absente de la machine. Prépare ensuite un cahier de manœuvre — les commandes exactes, dans l’ordre, avec les valeurs saisies — dans le dossier personnel. N’appelle JAMAIS samba-tool : le mot de passe de l’administrateur du domaine se tape à la console, et un domaine provisionné ne s’annule pas.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'samba — samba-tool (apt install samba)',
    'winbind, krb5-user, bind9-host — pour la suite et les vérifications',
  ],
  privileges: 'root — la base du domaine et la configuration de Samba ne se lisent pas autrement, et les refus doivent être fondés sur ce qui est réellement là. Sans root, le script s’arrête avant d’écrire quoi que ce soit',
  privilegesRequis: 'root',
  readOnly: false,
  service: 'samba-ad-dc.service',
  limites: [
    'N’EXÉCUTE PAS « samba-tool domain provision », et n’exécute aucune autre commande de samba-tool. Trois raisons : le mot de passe de l’administrateur du domaine se tape à la console et n’a sa place ni dans un script ni dans un historique de terminal ; un domaine provisionné ne s’annule pas ; et le wiki officiel suppose une machine neuve, ce qu’aucun assistant ne peut vérifier.',
    'N’écrit qu’UN fichier, dans le dossier personnel : le cahier de manœuvre. Rien dans /etc, rien dans /var, aucune unité touchée, aucun fichier déplacé.',
    'Ne génère et n’affiche AUCUN mot de passe. Pas de champ de secret, pas de « --adminpass » dans le cahier de manœuvre, pas de mot de passe suggéré : c’est samba-tool qui le demandera, à la console, au moment du provisionnement.',
    'N’invente aucun domaine. Le realm vient du formulaire, et un realm sans point est refusé — c’est un nom NetBIOS, pas un realm.',
    'Ne supprime rien et ne reprovisionne rien. S’il trouve une base de domaine, il REFUSE : un second provisionnement ne remplace pas le premier, il crée un domaine dont les comptes et l’identifiant de sécurité ne sont pas ceux d’avant.',
    'L’annulation est honnête et elle est désagréable : un contrôleur provisionné se défait en restaurant une sauvegarde de la machine, ou en reconstruisant la machine. Aucun fichier retiré n’annule un domaine, et la fiche ne prétend pas le contraire.',
    'Les options de « samba-tool domain provision » varient selon la version. Le cahier de manœuvre commence donc par « samba-tool domain provision --help » — c’est ce que le wiki officiel recommande lui-même.',
  ],

  fields: [
    {
      id: 'realm',
      label: 'Realm du domaine',
      type: 'text',
      default: 'kjemo.lan',
      placeholder: 'kjemo.lan',
      help: 'Le nom DNS complet du domaine. Kerberos l’emploie en MAJUSCULES, et le cahier de manœuvre le met en majuscules là où il le faut — le wiki insiste : « Always enter the Kerberos realm in uppercase. »',
    },
    {
      id: 'netbios',
      label: 'Nom NetBIOS du domaine',
      type: 'text',
      default: 'KJEMO',
      placeholder: 'KJEMO',
      help: 'Le nom court, 15 caractères au plus, sans point.',
    },
    {
      id: 'adresseIp',
      label: 'Adresse du contrôleur',
      type: 'text',
      default: '192.168.30.10',
      placeholder: '192.168.30.10',
      help: 'L’adresse de l’interface locale du contrôleur. L’assistant vérifie qu’elle est bien portée par cette machine : une adresse recopiée d’un autre serveur produirait un cahier de manœuvre juste en apparence et faux à l’exécution.',
    },
    {
      id: 'nomFichier',
      label: 'Nom du cahier de manœuvre',
      type: 'text',
      default: 'kjemo-provision-ad.txt',
      placeholder: 'kjemo-provision-ad.txt',
      help: 'Le fichier laissé dans le dossier personnel. Il ne contient aucun secret : seulement les commandes, dans l’ordre, avec tes valeurs.',
    },
    {
      id: 'confirmation',
      label: 'Confirmation : retape le realm',
      type: 'text',
      default: '',
      placeholder: 'kjemo.lan',
      optionnel: true,
      help: 'Sans cette phrase exacte, le script vérifie tout, affiche le cahier de manœuvre, et ne laisse aucun fichier. Le verrou est dans le script, pas dans ce formulaire.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const r = validateRealm(v.realm, 'Le realm du domaine');
    if (!r.ok) errors.realm = r.error;
    const n = validateNetbios(v.netbios, 'Le nom NetBIOS du domaine');
    if (!n.ok) errors.netbios = n.error;
    const ip = validateIPv4(v.adresseIp);
    if (!ip.ok) {
      errors.adresseIp = `L’adresse du contrôleur : ${ip.error}`;
    } else if (/^127\./.test(String(v.adresseIp).trim())) {
      errors.adresseIp = `« ${String(v.adresseIp).trim()} » est une adresse de bouclage. Le wiki officiel l’interdit explicitement pour un contrôleur : le nom et le FQDN ne doivent résoudre ni vers 127.0.0.1 ni vers aucune autre adresse que celle de l’interface locale. Un contrôleur provisionné sur le bouclage démarre et reste injoignable depuis tout client.`;
    }
    const f = validateNomFichier(v.nomFichier, 'Le nom du cahier de manœuvre');
    if (!f.ok) errors.nomFichier = f.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const realm = String(v.realm).trim();
    const realmMaj = realm.toUpperCase();
    const netbios = String(v.netbios).trim().toUpperCase();
    const ip = String(v.adresseIp).trim();
    const nomFichier = String(v.nomFichier).trim();

    // Le cahier de manœuvre. Construit ICI, en JS, à partir de valeurs déjà
    // validées. Aucun mot de passe, aucune option « --adminpass », et la
    // première ligne exécutable est celle qui fait lire l'aide : les options
    // varient selon la version, et le wiki recommande lui-même de la lire.
    const cahier = [
      '# ===========================================================================',
      '# CAHIER DE MANOEUVRE - PROVISIONNEMENT D UN CONTROLEUR SAMBA AD',
      '# Prepare par KJEMO IT Toolkit - samba-ad-dc-provision',
      '# ===========================================================================',
      '#',
      `# Realm              : ${realm}`,
      `# Realm Kerberos     : ${realmMaj}   (toujours en MAJUSCULES)`,
      `# Nom NetBIOS        : ${netbios}`,
      `# Adresse du DC      : ${ip}`,
      '#',
      '# AUCUN MOT DE PASSE NE FIGURE DANS CE FICHIER, ET IL NE DOIT JAMAIS Y EN',
      '# FIGURER. samba-tool demande le mot de passe de Administrator a la',
      '# console, au moment du provisionnement. L option --adminpass existe :',
      '# l employer mettrait le mot de passe de l administrateur du domaine dans',
      '# ce fichier, dans l historique du terminal et dans la liste des processus.',
      '#',
      '# CE PROVISIONNEMENT NE S ANNULE PAS. Il n y a pas de commande inverse :',
      '# il y a restaurer une sauvegarde de la machine, ou reconstruire la',
      '# machine. Prends la sauvegarde AVANT, pas apres.',
      '# ---------------------------------------------------------------------------',
      '',
      '# ETAPE 0 - LIRE L AIDE. Les options varient selon la version de Samba, et',
      '# le wiki officiel recommande lui-meme de la consulter.',
      'samba-tool domain provision --help',
      '',
      '# ETAPE 1 - ECARTER les configurations preinstallees. C est la deuxieme des',
      '# cinq etapes du wiki, et celle qu on saute : samba-tool refuse de',
      '# provisionner par-dessus un smb.conf existant. DEPLACER, et non supprimer :',
      '# on veut pouvoir relire les reglages locaux qu ils contenaient.',
      'smbd -b | grep CONFIGFILE',
      'sudo mv /etc/samba/smb.conf /etc/samba/smb.conf.avant-ad',
      'sudo mv /etc/krb5.conf /etc/krb5.conf.avant-ad',
      '',
      '# ETAPE 2 - ARRETER et DESACTIVER les unites du mode serveur de fichiers.',
      '# Un controleur fait tourner UN processus « samba » qui contient son propre',
      '# serveur SMB : laisser smbd actif donne deux serveurs sur le port 445.',
      'sudo systemctl disable --now smbd nmbd winbind',
      '',
      '# ETAPE 3 - PROVISIONNER. Le mot de passe de Administrator est demande ICI,',
      '# a la console. Ne le passe pas en option.',
      '#',
      '# --use-rfc2307 est recommande par le wiki : il active les extensions NIS,',
      '# sans inconvenient, et les activer PLUS TARD sur un domaine existant',
      '# demande d etendre le schema a la main.',
      'sudo samba-tool domain provision \\',
      '  --server-role=dc \\',
      '  --use-rfc2307 \\',
      '  --dns-backend=SAMBA_INTERNAL \\',
      `  --realm=${realmMaj} \\`,
      `  --domain=${netbios}`,
      '',
      '# ETAPE 4 - METTRE EN PLACE la configuration Kerberos que le',
      '# provisionnement vient de generer dans le dossier prive de Samba. Sans',
      '# cela, kinit cherche un autre realm et echoue avec un message qui ne parle',
      '# pas du fichier.',
      'sudo cp /var/lib/samba/private/krb5.conf /etc/krb5.conf',
      '',
      '# ETAPE 5 - DEMARRER le controleur. Si l unite est masquee — le rapport du',
      '# script dit si elle l est SUR CETTE MACHINE — il faut la demasquer d abord.',
      'sudo systemctl unmask samba-ad-dc',
      'sudo systemctl enable --now samba-ad-dc',
      '',
      '# ETAPE 6 - LE CONTROLEUR SE RESOUT LUI-MEME. Le wiki : mettre le domaine',
      '# AD dans « search » et l adresse DU CONTROLEUR dans « nameserver », et',
      '# « Do not add any other lines ».',
      '#',
      '# Si /etc/resolv.conf est un lien regenere automatiquement, ce reglage',
      '# retombera au prochain redemarrage : traite-le maintenant, et non apres',
      '# avoir constate que la resolution ne tient pas.',
      '#',
      `#   search ${realm}`,
      `#   nameserver ${ip}`,
      '',
      '# ETAPE 7 - EPROUVER. Dans cet ordre : le DNS d abord, puis Kerberos, puis',
      '# les partages. Chacun depend du precedent, et un echec plus haut rend les',
      '# suivants illisibles.',
      `host -t SRV _ldap._tcp.${realm}.`,
      `host -t SRV _kerberos._udp.${realm}.`,
      '# Le nom complet du controleur, a reutiliser dans la commande suivante.',
      '# Il est demande ici plutot que substitue : un cahier de manoeuvre se lit',
      '# avant de s executer, et une substitution y cache ce qu on va taper.',
      'hostname -f',
      '# Puis, en remplacant <fqdn> par ce que la commande precedente a rendu :',
      'host -t A <fqdn>.',
      'smbclient -L localhost -N',
      '# kinit demande le mot de passe de Administrator, a la console :',
      'kinit administrator',
      'klist',
      'sudo samba-tool domain level show',
      'sudo samba-tool domain info 127.0.0.1',
      '',
      '# ===========================================================================',
      '# SI QUELQUE CHOSE A MAL TOURNE',
      '# ===========================================================================',
      '# Il n y a pas de « dе-provisionner ». Les deux seules issues honnetes :',
      '#   restaurer la sauvegarde de la machine prise AVANT l etape 3 ;',
      '#   reconstruire la machine, puis recommencer.',
      '#',
      '# Remettre les anciens fichiers de configuration ne defait PAS le domaine :',
      '# la base reste dans /var/lib/samba/private, avec ses comptes et son',
      '# identifiant de securite. Un nouveau provisionnement par-dessus ne la',
      '# reprend pas — il echoue, ou cree un domaine different qui porte le meme',
      '# nom.',
      '# ===========================================================================',
    ];

    return assemblerSh([
      ...enteteBash({
        titre: 'Preparer le provisionnement d un controleur de domaine, sans le lancer',
        outil: this.id,
        diagnostic: false,
        root: true,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: true,
        pourquoi: 'les refus doivent etre fondes sur la base du domaine et la configuration reelles, qui ne se lisent pas sans root',
      }),
      ...blocVariablesBash([
        ['KJEMO_SMBCONF', shQuote('/etc/samba/smb.conf')],
        ['KJEMO_REALM', shQuote(realm)],
        ['KJEMO_REALM_MAJ', shQuote(realmMaj)],
        ['KJEMO_NETBIOS', shQuote(netbios)],
        ['KJEMO_IP', shQuote(ip)],
        ['KJEMO_NOM_FICHIER', shQuote(nomFichier)],
        ['KJEMO_CONF_SAISIE', shQuote(String(v.confirmation ?? '').trim())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Realm' \"${KJEMO_REALM}\"",
      "  printf '%s\\t%s\\n' 'Realm Kerberos' \"${KJEMO_REALM_MAJ}\"",
      "  printf '%s\\t%s\\n' 'NetBIOS' \"${KJEMO_NETBIOS}\"",
      "  printf '%s\\t%s\\n' 'Adresse du DC' \"${KJEMO_IP}\"",
      "  printf '%s\\t%s\\n' 'samba-tool' 'JAMAIS APPELE - le cahier de manoeuvre est remis, pas execute'",
      "  printf '%s\\t%s\\n' 'Mots de passe' 'AUCUN - ni champ, ni --adminpass, ni suggestion'",
      "  printf '%s\\t%s\\n' 'Ecritures' 'UNE SEULE, derriere la porte : le cahier dans le dossier personnel'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# Les drapeaux de la porte finale, tous definis AVANT la premiere',
      '# condition : sous « set -u », un drapeau non defini arreterait le script',
      '# au moment le moins pratique.',
      'KJEMO_NEUF=0',
      'KJEMO_IP_OK=0',
      'KJEMO_PREPARE_OK=0',
      '',
      ...blocAdExistant(),
      'if [ "${KJEMO_AD_EXISTE}" -eq 0 ]; then KJEMO_NEUF=1; fi',
      '',
      ...blocAdNom(),
      ...blocAdHeure(),
      ...blocAdUnites(),
      '# ---------------------------------------------------------------------------',
      '# L ADRESSE DECLAREE EST-ELLE PORTEE PAR CETTE MACHINE ?',
      '#',
      '# Une adresse recopiee depuis un autre serveur — ou depuis le cours —',
      '# produirait un cahier de manoeuvre juste en apparence : les commandes',
      '# seraient correctes, et la ligne « nameserver » designerait une machine',
      '# qui n est pas celle-ci. Le controleur se resoudrait alors ailleurs.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo ip; then',
      '  if ip -brief address show scope global 2>/dev/null | grep -qF -- "${KJEMO_IP}/"; then',
      '    KJEMO_IP_OK=1',
      "    kjemo_resultat 'Adresse' 'Portee par la machine' 'OK' \"${KJEMO_IP}\" \\",
      '      "L adresse ${KJEMO_IP} est bien portee par une interface de cette machine : le cahier de manoeuvre designera le bon serveur."',
      '  else',
      "    kjemo_resultat 'Adresse' 'Portee par la machine' 'PROBLEME' \"${KJEMO_IP}\" \\",
      '      "L adresse ${KJEMO_IP} n est portee par AUCUNE interface de portee globale de cette machine. Soit c est une adresse recopiee d un autre serveur, soit l interface n est pas encore configuree. Un cahier de manoeuvre bati sur cette adresse serait juste en apparence et faux a l execution : la ligne « nameserver » designerait une autre machine, et le controleur se resoudrait ailleurs."',
      '  fi',
      'else',
      "  kjemo_resultat 'Adresse' 'Portee par la machine' 'IGNORE' 'commande ip absente' \\",
      "    'La commande ip est absente : l adresse declaree n a PAS pu etre confrontee aux interfaces. Rien ne sera prepare.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE CAHIER DE MANOEUVRE, DANS LE DOSSIER TEMPORAIRE',
      '#',
      '# Ligne par ligne, avec printf. Aucune valeur n est interpolee a',
      '# l execution : les quatre valeurs du formulaire sont deja validees et',
      '# citees au moment de la generation. Il n y a donc rien a echapper ici, et',
      '# surtout rien a evaluer.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PREPARE="${KJEMO_TMP}/${KJEMO_NOM_FICHIER}"',
      'KJEMO_DESTINATION="${HOME}/${KJEMO_NOM_FICHIER}"',
      'if {',
      ...cahier.map((l) => `  printf '%s\\n' ${shQuote(l)}`),
      '} > "${KJEMO_PREPARE}"; then',
      '  KJEMO_PREPARE_OK=1',
      '  KJEMO_NB_CMD="$(grep -cvE \'^[[:space:]]*($|#)\' -- "${KJEMO_PREPARE}" 2>/dev/null || printf \'%s\' 0)"',
      "  kjemo_resultat 'Cahier' 'Preparation' 'OK' \"${KJEMO_NB_CMD} commande(s)\" \\",
      '    "Le cahier de manoeuvre est prepare : ${KJEMO_NB_CMD} lignes de commande, le reste etant des explications. Aucun mot de passe n y figure, et aucune option « --adminpass » : samba-tool demandera le secret a la console."',
      'else',
      "  kjemo_resultat 'Cahier' 'Preparation' 'PROBLEME' 'echec d ecriture' \\",
      "    'Le cahier n a pas pu etre ecrit dans le dossier temporaire. Rien ne sera remis.'",
      'fi',
      '',
      '# UNE VERIFICATION QUI PORTE SUR LE FICHIER PRODUIT, ET NON SUR L INTENTION.',
      '# Si une option de mot de passe apparaissait un jour dans le cahier — par un',
      '# copier-coller, par une evolution malheureuse —, ce controle l attraperait',
      '# avant que le fichier quitte le dossier temporaire.',
      'if [ "${KJEMO_PREPARE_OK}" -eq 1 ]; then',
      '  # Le controle ignore les lignes de COMMENTAIRE, et c est la lecon que',
      '  # le banc a donnee ici : le cahier EXPLIQUE pourquoi il ne faut pas',
      '  # employer --adminpass, et la premiere version du controle accusait',
      '  # cette explication. Condamner la pedagogie au nom de la securite est',
      '  # exactement le defaut corrige au commit 18/n pour « netplan apply ».',
      '  if grep -vE \'^[[:space:]]*#\' -- "${KJEMO_PREPARE}" \\',
      "    | grep -qiE -- '--adminpass|--password|^[[:space:]]*password'; then",
      '    KJEMO_PREPARE_OK=0',
      "    kjemo_resultat 'Cahier' 'Controle anti-secret' 'PROBLEME' 'option de mot de passe detectee' \\",
      "      'Le cahier prepare contient une option de mot de passe. Il ne sera PAS remis. Ce controle porte sur le fichier produit et non sur l intention de l assistant : c est la difference entre « nous ne mettons pas de secret » et « aucun secret n est sorti ».'",
      '  else',
      "    kjemo_resultat 'Cahier' 'Controle anti-secret' 'OK' 'aucune option de mot de passe' \\",
      "      'Le fichier produit a ete relu, commentaires exclus : aucune option « --adminpass », aucune option « --password », aucune ligne « password » parmi les COMMANDES. Les commentaires, eux, en parlent — ils expliquent pourquoi il ne faut pas s en servir, et les accuser condamnerait la pedagogie au nom de la securite.'",
      '  fi',
      'fi',
      '',
      '# L APERCU EXACT, imprime. Un cahier de manoeuvre qu on va suivre sur un',
      '# serveur doit etre LU en entier avant, et le rapport Console n affiche que',
      '# les lignes ATTENTION, PROBLEME et IGNORE.',
      'if [ "${KJEMO_PREPARE_OK}" -eq 1 ]; then',
      "  printf '\\n%s\\n' '--- APERCU EXACT DU CAHIER DE MANOEUVRE ---'",
      '  cat -- "${KJEMO_PREPARE}"',
      "  printf '%s\\n' '--- fin de l apercu ---'",
      'fi',
      '',
      ...blocConfirmation({
        phraseAttendue: realm,
        variableSaisie: 'KJEMO_CONF_SAISIE',
        action: `laisser le cahier de manoeuvre du domaine ${realm} dans le dossier personnel`,
      }),
      ...blocPorteFinale({
        conditions: [
          ['KJEMO_NEUF', 'Un domaine est deja provisionne sur cette machine : un second provisionnement ne remplace pas le premier.'],
          ['KJEMO_NOM_OK', 'Le FQDN ne resout pas vers une adresse utilisable : le provisionnement reussirait et le domaine serait injoignable depuis les clients.'],
          ['KJEMO_HEURE_OK', 'L horloge n est pas synchronisee : Kerberos refusera les tickets de tout le domaine.'],
          ['KJEMO_IP_OK', 'L adresse declaree n est portee par aucune interface de cette machine.'],
          ['KJEMO_PREPARE_OK', 'Le cahier de manoeuvre n a pas pu etre ecrit, ou son controle anti-secret a echoue.'],
          ['KJEMO_CONFIRMATION_OK', 'La confirmation ne reprend pas exactement le realm.'],
        ],
        action: 'la remise du cahier de manoeuvre',
      }),
      'if [ "${KJEMO_AGIR}" -eq 1 ]; then',
      '  # Les unites en conflit n empechent PAS de remettre le cahier : elles sont',
      '  # son etape 2. Les refuser ici forcerait a preparer la machine a la main',
      '  # avant d obtenir la procedure qui explique comment la preparer.',
      '  if [ "${KJEMO_CONFLIT}" -gt 0 ]; then',
      "    kjemo_resultat 'Unites' 'A faire avant l etape 3' 'ATTENTION' \"${KJEMO_CONFLIT} unite(s)\" \\",
      '      "${KJEMO_CONFLIT} unite(s) du mode serveur de fichiers sont encore actives. C est l ETAPE 2 du cahier, et elle doit etre faite avant l etape 3 : le cahier la contient, dans l ordre."',
      '  fi',
      '  if ! cp -p -- "${KJEMO_PREPARE}" "${KJEMO_DESTINATION}"; then',
      "    printf '%s\\n' 'ARRET : impossible de laisser le cahier dans le dossier personnel.' >&2",
      "    printf '%s\\n' 'Rien n a ete provisionne, et aucune configuration n a ete touchee.' >&2",
      '    exit 1',
      '  fi',
      '  chmod 600 -- "${KJEMO_DESTINATION}" 2>/dev/null || true',
      '  if ! cmp -s -- "${KJEMO_PREPARE}" "${KJEMO_DESTINATION}"; then',
      "    printf '%s\\n' 'ARRET : le cahier recopie ne correspond pas a celui qui a ete controle.' >&2",
      '    exit 1',
      '  fi',
      "  kjemo_resultat 'Remise' \"${KJEMO_DESTINATION}\" 'OK' 'ecrit, relu, mode 600' \\",
      '    "Le cahier de manoeuvre est dans ${KJEMO_DESTINATION}, identique a celui qui vient d etre controle, verifie par cmp. C est le SEUL fichier laisse par ce script, et il est hors de /etc comme de /var."',
      '',
      "  printf '\\n%s\\n' '=============================================================='",
      "  printf '%s\\n' 'AVANT DE SUIVRE CE CAHIER, DEUX CHOSES'",
      "  printf '%s\\n' '=============================================================='",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '1. PRENDS UNE SAUVEGARDE DE LA MACHINE. Pas des fichiers :'",
      "  printf '%s\\n' '   de la machine. Un domaine provisionne ne s annule pas, et'",
      "  printf '%s\\n' '   la seule issue honnete en cas d erreur est de revenir a'",
      "  printf '%s\\n' '   un instantane d avant. Sur une machine virtuelle, c est'",
      "  printf '%s\\n' '   un instantane ; sur une machine physique, c est une image.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' '2. LE MOT DE PASSE DE Administrator SE TAPE A LA CONSOLE,'",
      "  printf '%s\\n' '   au moment de l etape 3. Il n est ni dans ce cahier, ni'",
      "  printf '%s\\n' '   dans ce script, et il ne doit jamais etre passe en'",
      "  printf '%s\\n' '   option : la liste des processus est lisible par tous.'",
      "  printf '%s\\n' ''",
      "  printf '%s\\n' 'Ce que ce script n a PAS fait : il n a appele aucune commande'",
      "  printf '%s\\n' 'samba-tool, n a deplace aucun fichier, n a arrete aucune'",
      "  printf '%s\\n' 'unite, et n a provisionne aucun domaine.'",
      "  printf '%s\\n' '=============================================================='",
      "  kjemo_resultat 'Suite' 'Cahier remis' 'ATTENTION' 'a suivre a la main' \\",
      '    "Le cahier est dans ${KJEMO_DESTINATION}. Prends une sauvegarde de la MACHINE avant son etape 3 : un domaine provisionne ne s annule pas, et aucun fichier retire ne le defait. Le mot de passe de Administrator sera demande a la console."',
      'fi',
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'dossier personnel seulement' \\",
      "  'Aucun appel a samba-tool, aucun fichier deplace, aucune unite touchee, aucun domaine provisionne, aucun mot de passe. La seule ecriture possible est le cahier de manoeuvre dans le dossier personnel, et elle est derriere la porte finale.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-samba-ad-provision' }),
    ]);
  },

  gui: [
    'Prends une sauvegarde de la MACHINE avant de provisionner. Un domaine provisionné ne s’annule pas : il n’existe pas de « dé-provisionner ».',
    'Écarte le smb.conf et le krb5.conf préinstallés d’abord : samba-tool refuse de provisionner par-dessus. Déplace-les, ne les supprime pas.',
    'Désactive smbd, nmbd et winbind : un contrôleur fait tourner UN processus « samba » qui contient son propre serveur SMB.',
    'Lis « samba-tool domain provision --help » avant : les options varient selon la version, et le wiki le recommande lui-même.',
    'Ne passe JAMAIS --adminpass : la liste des processus est lisible par tous, et l’historique du terminal garde la ligne.',
    '--use-rfc2307 est recommandé par le wiki : l’activer après coup sur un domaine existant demande d’étendre le schéma à la main.',
    'Le realm Kerberos s’écrit en MAJUSCULES — le wiki insiste : « Always enter the Kerberos realm in uppercase. »',
    'Après provisionnement, mets en place le krb5.conf que Samba a généré dans son dossier privé.',
    'Le contrôleur se résout lui-même : « search <domaine> » et « nameserver <son adresse> », et rien d’autre.',
    'Éprouve dans l’ordre : SRV, puis Kerberos, puis les partages. Un échec en haut rend tout ce qui suit illisible.',
  ],

  keywords: ['samba', 'active directory', 'provision', 'samba-tool', 'realm',
    'netbios', 'rfc2307', 'kerberos', 'krb5.conf', 'dc', 'controleur',
    'cahier de manoeuvre', 'sauvegarde', 'linux', 'ubuntu'],

  requiresAdmin: true,
  prereqs: [
    'sudo : les refus doivent être fondés sur la base du domaine et la configuration réelles, qui ne se lisent pas autrement.',
    'Les sept prérequis vérifiés par samba-ad-dc-readiness, et notamment un FQDN qui ne résout pas vers le bouclage.',
    'Une sauvegarde de la MACHINE — instantané de machine virtuelle, ou image. C’est la seule annulation qui existe.',
    'Le mot de passe que recevra le compte Administrator, choisi d’avance et tapé à la console au moment du provisionnement. Il n’entre dans aucun formulaire.',
  ],

  commonErrors: [
    {
      message: 'ERROR: Provision failed - smb.conf already exists',
      code: 'KJEMO',
      cause: 'La deuxième des cinq étapes du wiki a été sautée.',
      fix: 'Déplacer le fichier, puis relancer.',
      command: 'sudo mv /etc/samba/smb.conf /etc/samba/smb.conf.avant-ad',
    },
    {
      message: 'J’ai provisionné deux fois et le domaine est incohérent',
      code: 'KJEMO',
      cause: 'Un second provisionnement ne remplace pas le premier : la base existante garde ses comptes et son identifiant de sécurité, que le nouveau domaine ne reprend pas.',
      fix: 'Restaurer la sauvegarde de la machine. Il n’y a pas de correction en place.',
      command: 'sudo ls -l /var/lib/samba/private/sam.ldb',
    },
    {
      message: 'kinit administrator : KDC reply did not match expectations',
      code: 'KJEMO',
      cause: 'Le /etc/krb5.conf en place n’est pas celui que le provisionnement a généré : il désigne un autre realm.',
      fix: 'Mettre en place celui du dossier privé de Samba.',
      command: 'sudo cp /var/lib/samba/private/krb5.conf /etc/krb5.conf',
    },
    {
      message: 'Les clients ne trouvent pas le domaine après un provisionnement réussi',
      code: 'KJEMO',
      cause: 'Le FQDN résolvait vers le bouclage : le contrôleur a publié cette adresse dans son propre DNS.',
      fix: 'Corriger /etc/hosts, puis vérifier l’enregistrement publié.',
      command: 'host -t A "$(hostname -f)."',
    },
    {
      message: 'samba-ad-dc ne démarre pas : Unit is masked',
      code: 'KJEMO',
      cause: 'L’unité est livrée masquée sur certaines distributions, pour éviter qu’elle démarre avant tout provisionnement.',
      fix: 'La démasquer, puis l’activer.',
      command: 'sudo systemctl unmask samba-ad-dc && sudo systemctl enable --now samba-ad-dc',
    },
  ],

  reversible: false,
  verifyAfter: [
    'Un domaine déjà provisionné fait refuser, et le refus explique pourquoi un second provisionnement n’est pas une correction.',
    'Le FQDN, l’horloge et les unités en conflit sont rapportés avant toute préparation.',
    'L’adresse déclarée est confrontée aux interfaces réelles de la machine.',
    'Le cahier de manœuvre est relu par un contrôle anti-secret qui porte sur le FICHIER, et pas sur l’intention.',
    'L’aperçu exact du cahier est imprimé avant toute remise.',
    'Sans la confirmation exacte, aucun fichier n’est laissé.',
    'Le fichier remis est comparé à celui qui a été contrôlé, et mis en mode 600.',
    'Aucun appel à samba-tool, aucun fichier déplacé, aucune unité touchée.',
    'La procédure dit de prendre une sauvegarde de la MACHINE, et dit qu’il n’existe pas d’annulation.',
  ],

  rollback: {
    summary: 'Il n’y a pas d’annulation du provisionnement, et cette fiche ne prétend pas le contraire. Ce script-ci ne laisse qu’un fichier texte dans le dossier personnel : le supprimer l’annule entièrement. Le PROVISIONNEMENT, lui, si tu l’exécutes ensuite, ne se défait qu’en restaurant une sauvegarde de la machine ou en la reconstruisant.',
    diagnostic: `# Ce que ce script a laisse, et c est tout :
ls -l ~/kjemo-provision-ad.txt
# Un domaine existe-t-il ? C est la seule question qui compte ensuite :
sudo ls -l /var/lib/samba/private/sam.ldb
sudo samba-tool domain info 127.0.0.1`,
    command: `# Annuler CE script : supprimer le cahier de manoeuvre.
rm -f ~/kjemo-provision-ad.txt

# Annuler un PROVISIONNEMENT deja effectue : cela n existe pas.
# Les deux seules issues honnetes :
#   1. restaurer l instantane ou l image de la machine pris AVANT ;
#   2. reconstruire la machine, puis recommencer.
#
# Ce qui NE suffit PAS, et qu on essaie toujours en premier :
#   remettre l ancien smb.conf — la base du domaine reste dans
#   /var/lib/samba/private, avec ses comptes et son identifiant de
#   securite ;
#   supprimer /var/lib/samba/private — on obtient une machine qui n est
#   plus un controleur et dont la configuration dit le contraire, et les
#   comptes du domaine sont perdus sans retour ;
#   reprovisionner par-dessus — le nouveau domaine porte le meme nom et
#   n est pas le meme domaine : les machines deja jointes ne le
#   reconnaissent pas.`,
    warning: 'Prends la sauvegarde de la machine AVANT l’étape 3 du cahier. Après, il est trop tard : c’est la seule annulation qui existe.',
  },

  checks: [
    'Aucun appel à samba-tool, sous aucune condition : le cahier de manœuvre est remis, jamais exécuté.',
    'Aucun mot de passe : aucun champ de secret, aucune option « --adminpass » dans le cahier, aucune suggestion de mot de passe.',
    'Le fichier produit est RELU pour y chercher une option de mot de passe, et sa présence annule la remise : le contrôle porte sur le fichier, non sur l’intention.',
    'Un domaine déjà provisionné est détecté par deux preuves et fait refuser.',
    'L’adresse déclarée est vérifiée contre les interfaces de la machine : une adresse recopiée d’un autre serveur est refusée.',
    'Un realm sans point est refusé par le formulaire ; une adresse de bouclage comme adresse de contrôleur est refusée, avec la citation du wiki.',
    'Le realm est mis en majuscules pour Kerberos là où il le faut, et la règle est citée.',
    'Zéro écriture — pas même le cahier — avant que les six conditions de la porte finale soient réunies.',
    'Le cahier remis est comparé par cmp à celui qui a été contrôlé.',
    'La seule écriture possible est dans le dossier personnel, en mode 600 : rien dans /etc, rien dans /var.',
    'La fiche déclare reversible: false, et la procédure d’annulation dit qu’il n’y a pas d’annulation — elle ne fabrique pas une sécurité inexistante.',
  ],

  source: WIKI_AD,
  sources: [
    { label: 'Samba Wiki — les cinq étapes, --use-rfc2307, realm en majuscules, vérifications', url: WIKI_AD },
    { label: 'samba-tool(8)', url: `${M}/man8/samba-tool.8.html` },
    { label: 'smb.conf(5)', url: `${M}/man5/smb.conf.5.html` },
    { label: 'krb5.conf(5)', url: `${M}/man5/krb5.conf.5.html` },
    { label: 'systemctl(1) — unmask, enable --now', url: `${M}/man1/systemctl.1.html` },
  ],
};

// ===========================================================================
// 3. samba-ad-health
// ===========================================================================

const sambaAdHealth = {
  id: 'samba-ad-health',
  icon: '◇',
  category: CAT,
  subcategory: 'Samba AD',
  title: 'Lire la santé d’un contrôleur de domaine Samba',
  risk: 'diagnostic',
  summary: 'Lit un contrôleur en service dans l’ordre où ses couches dépendent l’une de l’autre : l’unité, les ports de chaque service — DNS, Kerberos, LDAP, SMB —, les enregistrements SRV que les clients cherchent, l’enregistrement A du contrôleur, les partages sysvol et netlogon, le niveau fonctionnel du domaine, et la réplication s’il y a plusieurs contrôleurs. N’appelle jamais kinit : demander un ticket exige un mot de passe, et aucun mot de passe n’entre dans ce projet.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'samba — samba-tool (apt install samba)',
    'bind9-host ou dnsutils — host, pour les enregistrements SRV',
    'krb5-user — klist, pour lire les tickets déjà en cache',
    'smbclient — pour lister les partages du contrôleur',
  ],
  privileges: 'aucun pour les ports, les enregistrements DNS, les partages et les tickets en cache. root pour samba-tool, qui lit la base du domaine — ces sections sont annoncées IGNORE quand root manque',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'samba-ad-dc.service',
  limites: [
    'LIT seulement. Ne démarre ni n’arrête aucune unité, ne touche pas à la base du domaine, ne modifie aucun enregistrement DNS, ne crée ni ne change aucun compte.',
    'N’APPELLE PAS kinit. Demander un ticket Kerberos exige un mot de passe, et aucun mot de passe n’entre dans un formulaire de ce projet. L’assistant lit les tickets DÉJÀ en cache avec klist, et affiche la commande kinit à taper soi-même.',
    'Ne corrige aucun enregistrement DNS manquant. « samba-tool dns add » existe ; l’employer demanderait des identifiants, et un enregistrement ajouté à la main dans un DNS intégré est une divergence de plus à diagnostiquer plus tard.',
    'La réplication n’est lue que si elle est demandée, et seulement sur CE contrôleur : « samba-tool drs showrepl » dit ce que cette machine sait de ses partenaires, pas ce qu’ils savent d’elle. Un diagnostic complet se fait des deux côtés.',
    'Ne teste pas depuis un client Windows. Un contrôleur peut être parfaitement sain et une jonction échouer pour une raison propre au client — DNS mal pointé, heure décalée, ou version de protocole imposée.',
  ],

  fields: [
    {
      id: 'realm',
      label: 'Realm du domaine',
      type: 'text',
      default: 'kjemo.lan',
      placeholder: 'kjemo.lan',
      help: 'Le realm à interroger. Les deux enregistrements SRV décisifs — _ldap._tcp et _kerberos._udp — sont cherchés dessous : leur absence est la première cause d’échec de jonction.',
    },
    {
      id: 'verifierReplication',
      label: 'Lire la réplication',
      type: 'select',
      default: 'Non',
      options: OUI_NON,
      help: 'Utile seulement avec plusieurs contrôleurs. Sur un contrôleur unique, la sortie est vide et ne prouve rien — ce qui est exactement ce que le rapport dira.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const r = validateRealm(v.realm, 'Le realm du domaine');
    if (!r.ok) errors.realm = r.error;
    const rep = validateChoix(v.verifierReplication, ['Oui', 'Non'], 'La lecture de la réplication');
    if (!rep.ok) errors.verifierReplication = rep.error;
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const realm = String(v.realm).trim();
    const replication = String(v.verifierReplication) === 'Oui';

    return assemblerSh([
      ...enteteBash({
        titre: 'Lire la sante d un controleur de domaine Samba',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'samba-tool lit la base du domaine, qui n est pas lisible sans root',
      }),
      ...blocVariablesBash([
        ['KJEMO_SMBCONF', shQuote('/etc/samba/smb.conf')],
        ['KJEMO_REALM', shQuote(realm)],
        ['KJEMO_REALM_MAJ', shQuote(realm.toUpperCase())],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Realm interroge' \"${KJEMO_REALM}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - aucune unite touchee, aucun enregistrement DNS modifie'",
      "  printf '%s\\t%s\\n' 'kinit' 'JAMAIS APPELE - il exige un mot de passe ; klist lit les tickets deja en cache'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      ...blocAdExistant(),
      'if [ "${KJEMO_AD_EXISTE}" -ne 1 ]; then',
      "  kjemo_resultat 'Portee' 'Ce n est pas un controleur' 'PROBLEME' 'aucun domaine' \\",
      "    'Cette machine ne porte pas de base de domaine : ce n est pas un controleur, et tout ce qui suit sera vide ou sans objet. Si tu attendais un controleur ici, c est le provisionnement qui a echoue ou qui n a pas eu lieu.'",
      'fi',
      '',
      ...blocAdUnites(),
      '# ---------------------------------------------------------------------------',
      '# LES PORTS, SERVICE PAR SERVICE',
      '#',
      '# Un controleur n est pas un service mais cinq, dans le meme processus.',
      '# Lire « le port 445 repond » ne dit rien de Kerberos ni du DNS, et c est',
      '# pourtant ainsi qu on declare un controleur « en bonne sante ».',
      '#',
      '#    53  DNS         sans lui, aucun client ne TROUVE le domaine',
      '#    88  Kerberos    sans lui, personne ne s AUTHENTIFIE',
      '#   389  LDAP        l annuaire lui-meme',
      '#   445  SMB         sysvol, netlogon, et les stratégies de groupe',
      '#   464  kpasswd     le changement de mot de passe',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PORTS_OK=0',
      'KJEMO_PORTS_MANQUE=0',
      'if kjemo_dispo ss; then',
      '  KJEMO_TOUT="$(ss -lntup 2>/dev/null || true)"',
      '  for kjemo_couple in \'53:DNS\' \'88:Kerberos\' \'389:LDAP\' \'445:SMB\' \'464:kpasswd\'; do',
      '    kjemo_port="${kjemo_couple%%:*}"',
      '    kjemo_role="${kjemo_couple##*:}"',
      '    if printf \'%s\\n\' "${KJEMO_TOUT}" | awk \'{print $5}\' | grep -qE "[:.]${kjemo_port}\\$"; then',
      '      KJEMO_PORTS_OK=$((KJEMO_PORTS_OK + 1))',
      "      kjemo_resultat 'Ports' \"${kjemo_port} (${kjemo_role})\" 'OK' 'en ecoute' \\",
      '        "Le port ${kjemo_port} est en ecoute : le service ${kjemo_role} du controleur repond."',
      '    else',
      '      KJEMO_PORTS_MANQUE=$((KJEMO_PORTS_MANQUE + 1))',
      "      kjemo_resultat 'Ports' \"${kjemo_port} (${kjemo_role})\" 'PROBLEME' 'rien en ecoute' \\",
      '        "Rien n ecoute sur le port ${kjemo_port} : le service ${kjemo_role} ne repond pas. Un controleur est cinq services dans un seul processus, et « le port 445 repond » ne dit rien des quatre autres. Sans 53, aucun client ne TROUVE le domaine ; sans 88, personne ne s AUTHENTIFIE."',
      '    fi',
      '  done',
      'else',
      "  kjemo_resultat 'Ports' 'ss' 'IGNORE' 'commande absente' \\",
      "    'ss est absent : aucun port n a ete controle. Le rapport ne dit donc rien de ce qui repond.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LES ENREGISTREMENTS QUE LES CLIENTS CHERCHENT',
      '#',
      '# Un client ne trouve pas un controleur par son nom : il interroge les',
      '# enregistrements SRV du domaine. Leur absence est la PREMIERE cause',
      '# d echec de jonction, et le message de Windows ne parle jamais de SRV —',
      '# il dit que le domaine est introuvable.',
      '#',
      '# Le wiki officiel donne exactement ces trois verifications.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_SRV_OK=0',
      'if kjemo_dispo host; then',
      '  for kjemo_srv in "_ldap._tcp.${KJEMO_REALM}." "_kerberos._udp.${KJEMO_REALM}."; do',
      '    kjemo_rep="$(host -t SRV "${kjemo_srv}" 2>&1 | head -4 || true)"',
      '    case "${kjemo_rep}" in',
      '      *"has SRV record"*)',
      '        KJEMO_SRV_OK=$((KJEMO_SRV_OK + 1))',
      "        kjemo_resultat 'DNS' \"${kjemo_srv}\" 'OK' \"${kjemo_rep}\" \\",
      '        "L enregistrement ${kjemo_srv} est resolu : ${kjemo_rep}. C est par la qu un client trouve un controleur."',
      '        ;;',
      '      *)',
      "        kjemo_resultat 'DNS' \"${kjemo_srv}\" 'PROBLEME' \"${kjemo_rep}\" \\",
      '        "L enregistrement ${kjemo_srv} n est PAS resolu : ${kjemo_rep}. Un client ne peut pas localiser de controleur sans lui, et Windows dira seulement que le domaine est introuvable. Deux causes a distinguer : le DNS du controleur ne sert pas la zone, ou cette machine n interroge pas son propre DNS — apres provisionnement, un controleur doit se resoudre lui-meme."',
      '        ;;',
      '    esac',
      '  done',
      '  KJEMO_FQDN="$(hostname -f 2>/dev/null || true)"',
      '  if [ -n "${KJEMO_FQDN}" ]; then',
      '    kjemo_a="$(host -t A "${KJEMO_FQDN}." 2>&1 | head -3 || true)"',
      '    case "${kjemo_a}" in',
      '      *"has address"*)',
      '        case "${kjemo_a}" in',
      '          *127.0.0.1*|*127.0.1.1*)',
      "            kjemo_resultat 'DNS' 'Enregistrement A du controleur' 'PROBLEME' \"${kjemo_a}\" \\",
      '            "Le controleur publie une adresse de BOUCLAGE pour lui-meme : ${kjemo_a}. Aucun client ne pourra s y connecter. C est la trace d un provisionnement fait alors que le FQDN resolvait vers 127.0.1.1 — le defaut se corrige dans le DNS du domaine, et pas seulement dans /etc/hosts."',
      '            ;;',
      '          *)',
      "            kjemo_resultat 'DNS' 'Enregistrement A du controleur' 'OK' \"${kjemo_a}\" \\",
      '            "Le controleur publie ${kjemo_a} pour lui-meme : une adresse joignable."',
      '            ;;',
      '        esac',
      '        ;;',
      '      *)',
      "        kjemo_resultat 'DNS' 'Enregistrement A du controleur' 'PROBLEME' \"${kjemo_a}\" \\",
      '        "Le FQDN ${KJEMO_FQDN} n est pas resolu par le DNS interrogé : ${kjemo_a}. Les enregistrements SRV designent un controleur par son nom — s il ne resout pas, les SRV ne servent a rien."',
      '        ;;',
      '    esac',
      '  fi',
      'else',
      "  kjemo_resultat 'DNS' 'host' 'IGNORE' 'commande absente' \\",
      "    'La commande host est absente — paquet bind9-host ou dnsutils. Les enregistrements SRV n ont PAS ete verifies, et c est la premiere cause d echec de jonction.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# SYSVOL ET NETLOGON',
      '#',
      '# Ces deux partages ne sont pas decoratifs : sysvol porte les stratégies de',
      '# groupe, netlogon les scripts d ouverture de session. Le wiki les donne',
      '# comme verification du serveur de fichiers du controleur, avec une',
      '# connexion ANONYME — « smbclient -L localhost -N » — qui ne demande donc',
      '# aucun mot de passe.',
      '# ---------------------------------------------------------------------------',
      'KJEMO_PARTAGES_OK=0',
      'if kjemo_dispo smbclient; then',
      '  KJEMO_LISTE="$(smbclient -L localhost -N 2>&1 | head -20 || true)"',
      '  if printf \'%s\\n\' "${KJEMO_LISTE}" | grep -qi \'sysvol\' \\',
      '    && printf \'%s\\n\' "${KJEMO_LISTE}" | grep -qi \'netlogon\'; then',
      '    KJEMO_PARTAGES_OK=1',
      "    kjemo_resultat 'Partages' 'sysvol et netlogon' 'OK' 'presents' \\",
      "      'Les deux partages d un controleur sont servis. sysvol porte les stratégies de groupe, netlogon les scripts d ouverture de session : leur absence ne casse pas l authentification, elle casse tout ce qui en depend.'",
      '  else',
      "    kjemo_resultat 'Partages' 'sysvol et netlogon' 'PROBLEME' \"${KJEMO_LISTE}\" \\",
      '      "Les partages sysvol et netlogon ne sont pas tous les deux presents : ${KJEMO_LISTE}. La connexion a ete faite en ANONYME, sans mot de passe, comme le wiki l indique. Si la liste est vide, c est le serveur SMB du controleur qui ne repond pas ; s il manque un seul des deux, c est le provisionnement qui est incomplet."',
      '  fi',
      'else',
      "  kjemo_resultat 'Partages' 'smbclient' 'IGNORE' 'commande absente' \\",
      "    'smbclient est absent : sysvol et netlogon n ont PAS ete verifies.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE DOMAINE LUI-MEME, PAR samba-tool',
      '#',
      '# Ces lectures demandent root : elles passent par la base du domaine.',
      '# Sans root, elles sont annoncees IGNORE — et non OK.',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo samba-tool; then',
      '  KJEMO_NIVEAU="$(samba-tool domain level show 2>&1 | head -10 || true)"',
      "  kjemo_resultat 'Domaine' 'Niveau fonctionnel' 'INFO' \"${KJEMO_NIVEAU:-non lu}\" \\",
      '    "Niveaux fonctionnels : ${KJEMO_NIVEAU:-non lu}. Ils bornent les fonctions disponibles et, surtout, les versions de Windows qui peuvent etre controleurs du domaine. On les eleve ; on ne les abaisse pas."',
      '  KJEMO_INFO="$(samba-tool domain info 127.0.0.1 2>&1 | head -12 || true)"',
      "  kjemo_resultat 'Domaine' 'Identite' 'INFO' \"${KJEMO_INFO:-non lu}\" \\",
      '    "Ce que le controleur dit de lui-meme : ${KJEMO_INFO:-non lu}. Compare le realm et le nom NetBIOS avec ceux que tu attendais : un domaine reprovisionne porte le meme nom et n est PAS le meme domaine — son identifiant de securite a change, et les machines deja jointes ne le reconnaissent plus."',
      'else',
      "  kjemo_resultat 'Domaine' 'samba-tool' 'IGNORE' 'non lu' \\",
      "    'Les lectures de samba-tool n ont PAS eu lieu : elles demandent root, ou la commande est absente. Le niveau fonctionnel et l identite du domaine sont donc inconnus de ce rapport.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# KERBEROS : CE QUI EST DEJA EN CACHE, ET RIEN DE PLUS',
      '#',
      '# klist LIT le cache de tickets. kinit en DEMANDE un, et pour cela il exige',
      '# un mot de passe : il n est donc pas appele ici, et il ne le sera jamais.',
      '# La commande est affichee, a taper soi-meme.',
      '# ---------------------------------------------------------------------------',
      'if kjemo_dispo klist; then',
      '  KJEMO_TICKETS="$(klist 2>&1 | head -10 || true)"',
      '  case "${KJEMO_TICKETS}" in',
      '    *"No credentials cache"*|*"not found"*)',
      "      kjemo_resultat 'Kerberos' 'Tickets en cache' 'INFO' 'aucun' \\",
      '      "Aucun ticket en cache pour cette session, ce qui est normal et ne prouve rien. Pour EPROUVER l authentification du domaine, a taper soi-meme — la commande demande le mot de passe a la console : « kinit administrator », puis « klist ». Le realm s ecrit en MAJUSCULES : ${KJEMO_REALM_MAJ}."',
      '      ;;',
      '    *)',
      "      kjemo_resultat 'Kerberos' 'Tickets en cache' 'INFO' \"${KJEMO_TICKETS}\" \\",
      '      "Tickets deja en cache : ${KJEMO_TICKETS}. Verifie que le principal porte bien le realm ${KJEMO_REALM_MAJ} en majuscules : un ticket obtenu pour un autre realm expliquerait des refus que rien d autre n explique."',
      '      ;;',
      '  esac',
      'else',
      "  kjemo_resultat 'Kerberos' 'klist' 'IGNORE' 'commande absente' \\",
      "    'klist est absent — paquet krb5-user. Les tickets en cache n ont pas ete lus.'",
      'fi',
      '',
      ...(replication ? [
        '# -----------------------------------------------------------------------',
        '# LA REPLICATION, ET CE QU ELLE NE DIT PAS',
        '#',
        '# « samba-tool drs showrepl » dit ce que CE controleur sait de ses',
        '# partenaires. Il ne dit pas ce qu ils savent de lui : une replication',
        '# peut etre saine dans un sens et cassee dans l autre, et c est meme le',
        '# cas le plus courant. Un diagnostic complet se fait des DEUX cotes.',
        '# -----------------------------------------------------------------------',
        'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo samba-tool; then',
        '  KJEMO_REPL="$(samba-tool drs showrepl 2>&1 | head -30 || true)"',
        '  case "${KJEMO_REPL}" in',
        '    *"WERR_"*|*"failed"*|*"Failed"*)',
        "      kjemo_resultat 'Replication' 'drs showrepl' 'PROBLEME' \"${KJEMO_REPL}\" \\",
        '      "La replication signale une erreur : ${KJEMO_REPL}. Regarde l heure des deux cotes avant tout le reste — un ecart d horloge casse Kerberos, et la replication passe par Kerberos. Puis relance la meme commande SUR L AUTRE controleur : ce rapport ne dit que ce que CETTE machine sait."',
        '      ;;',
        '    \'\')',
        "      kjemo_resultat 'Replication' 'drs showrepl' 'IGNORE' 'sortie vide' \\",
        "      'La commande n a rien rendu. Sur un controleur UNIQUE, c est normal et cela ne prouve rien : il n y a personne avec qui repliquer.'",
        '      ;;',
        '    *)',
        "      kjemo_resultat 'Replication' 'drs showrepl' 'INFO' \"${KJEMO_REPL}\" \\",
        '      "Etat de la replication vu depuis CE controleur : ${KJEMO_REPL}. Relance la meme commande sur chaque partenaire : une replication saine dans un sens et cassee dans l autre est le cas le plus courant, et un seul cote ne le montre jamais."',
        '      ;;',
        '  esac',
        'else',
        "  kjemo_resultat 'Replication' 'drs showrepl' 'IGNORE' 'non lue' \\",
        "    'La replication n a PAS ete lue : samba-tool demande root, ou la commande est absente.'",
        'fi',
        '',
      ] : [
        "kjemo_resultat 'Replication' 'drs showrepl' 'IGNORE' 'non demandee' \\",
        "  'La replication n a pas ete lue, parce que le formulaire ne l a pas demandee. Sur un controleur unique, elle ne prouverait rien de toute facon.'",
        '',
      ]),
      '# ---------------------------------------------------------------------------',
      '# LE VERDICT, DANS L ORDRE DES DEPENDANCES',
      '# ---------------------------------------------------------------------------',
      'if [ "${KJEMO_AD_EXISTE}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Pas un controleur' 'PROBLEME' 'aucun domaine' \\",
      "    'Cette machine ne porte aucune base de domaine : il n y a pas de sante a mesurer. C est le provisionnement qu il faut regarder.'",
      'elif [ "${KJEMO_ADDC_ETAT}" != \'active\' ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'l unite' \\",
      '    "Le domaine existe et l unite samba-ad-dc n est pas active (${KJEMO_ADDC_ETAT:-inconnue}) : aucun service du controleur ne repond. Si elle est « masked », il faut la demasquer avant de l activer."',
      'elif [ "${KJEMO_PORTS_MANQUE}" -gt 0 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'les ports' \\",
      '    "${KJEMO_PORTS_MANQUE} service(s) du controleur n ecoutent pas, sur ${KJEMO_PORTS_OK} qui ecoutent. Lis lesquels : sans le 53 aucun client ne TROUVE le domaine, sans le 88 personne ne s AUTHENTIFIE, et les deux donnent des symptomes differents."',
      'elif [ "${KJEMO_SRV_OK}" -lt 2 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'les enregistrements SRV' \\",
      '    "${KJEMO_SRV_OK} enregistrement(s) SRV sur 2 sont resolus. Les services ecoutent et les clients ne TROUVERONT pas le domaine : c est la premiere cause d echec de jonction, et le message de Windows ne mentionnera pas SRV."',
      'elif [ "${KJEMO_PARTAGES_OK}" -ne 1 ]; then',
      "  kjemo_resultat 'Verdict' 'Premiere couche manquante' 'PROBLEME' 'sysvol et netlogon' \\",
      "    'Les services repondent, les clients trouvent le domaine, et les deux partages du controleur ne sont pas tous les deux la. L authentification fonctionnera ; les stratégies de groupe et les scripts d ouverture de session, non.'",
      'else',
      "  kjemo_resultat 'Verdict' 'Controleur sain' 'OK' 'les couches locales sont completes' \\",
      '    "Domaine present, unite active, les cinq ports en ecoute, les deux SRV resolus, sysvol et netlogon servis. Reste ce que cette machine ne peut pas prouver seule : qu un client s authentifie vraiment — « kinit administrator » depuis un poste, a taper soi-meme — et, s il y a plusieurs controleurs, que la replication fonctionne DANS LES DEUX SENS."',
      'fi',
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucune unite touchee, aucun enregistrement DNS modifie, aucun compte change, aucun ticket demande, aucun mot de passe.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-samba-ad-sante' }),
    ]);
  },

  gui: [
    'Un contrôleur est cinq services dans un processus : 53 DNS, 88 Kerberos, 389 LDAP, 445 SMB, 464 kpasswd. « Le 445 répond » ne dit rien des quatre autres.',
    'Vérifie les SRV avant tout le reste côté client : « host -t SRV _ldap._tcp.kjemo.lan. ». Leur absence est la première cause d’échec de jonction.',
    'Vérifie aussi l’enregistrement A du contrôleur : s’il publie une adresse de bouclage, les SRV le désignent correctement et personne ne peut l’atteindre.',
    'sysvol et netlogon se listent sans mot de passe : « smbclient -L localhost -N ». C’est la vérification que donne le wiki.',
    'Pour éprouver Kerberos, c’est « kinit administrator » puis « klist » — à taper soi-même, parce que la commande demande un mot de passe.',
    'Le realm Kerberos s’écrit en MAJUSCULES. Un principal obtenu pour un autre realm explique des refus que rien d’autre n’explique.',
    'Après provisionnement, un contrôleur doit se résoudre LUI-MÊME : s’il interroge un autre DNS, ses propres SRV lui sont invisibles.',
    '« samba-tool drs showrepl » ne dit que ce que CE contrôleur sait : relance-la sur chaque partenaire.',
    'Si la réplication échoue, regarde l’heure d’abord : elle passe par Kerberos, et Kerberos refuse un écart d’horloge.',
  ],

  keywords: ['samba', 'active directory', 'sante', 'health', 'srv', 'kerberos',
    'klist', 'sysvol', 'netlogon', 'drs showrepl', 'niveau fonctionnel',
    'samba-tool', 'ports', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'Rien pour les ports, les enregistrements DNS, les partages et les tickets en cache.',
    'sudo pour samba-tool, qui lit la base du domaine. Sans sudo, ces sections sont annoncées IGNORE — pas OK.',
    'Le paquet bind9-host ou dnsutils pour « host », sans lequel les SRV ne sont pas vérifiés.',
    'Le realm du domaine.',
  ],

  commonErrors: [
    {
      message: 'La jonction d’un poste échoue : « le domaine est introuvable »',
      code: 'KJEMO',
      cause: 'Les enregistrements SRV ne sont pas résolus par le client. Windows ne mentionne jamais SRV dans ce message.',
      fix: 'Vérifier les SRV depuis le client, puis le serveur DNS que le client utilise.',
      command: 'host -t SRV _ldap._tcp.kjemo.lan.',
    },
    {
      message: 'Le contrôleur publie 127.0.1.1 pour lui-même',
      code: 'KJEMO',
      cause: 'Le FQDN résolvait vers le bouclage au moment du provisionnement.',
      fix: 'Corriger /etc/hosts, puis l’enregistrement dans le DNS du domaine — les deux, pas seulement le premier.',
      command: 'host -t A "$(hostname -f)."',
    },
    {
      message: 'kinit : Clock skew too great',
      code: 'KJEMO',
      cause: 'L’écart d’horloge dépasse la tolérance de Kerberos, par conception.',
      fix: 'Synchroniser l’heure des deux côtés, puis réessayer.',
      command: 'timedatectl',
    },
    {
      message: 'samba-ad-dc : Unit is masked',
      code: 'KJEMO',
      cause: 'L’unité est livrée masquée sur certaines distributions, pour éviter un démarrage avant provisionnement.',
      fix: 'La démasquer, puis l’activer.',
      command: 'sudo systemctl unmask samba-ad-dc',
    },
    {
      message: 'La réplication est verte ici et cassée sur l’autre contrôleur',
      code: 'KJEMO',
      cause: 'C’est le cas le plus courant : la réplication a un sens, et un seul côté ne le montre pas.',
      fix: 'Relancer la même lecture sur chaque partenaire.',
      command: 'sudo samba-tool drs showrepl',
    },
  ],

  reversible: true,
  verifyAfter: [
    'La présence d’une base de domaine est établie avant toute autre lecture.',
    'Les cinq ports sont rapportés séparément, avec le service de chacun.',
    'Les deux enregistrements SRV sont interrogés un par un.',
    'L’enregistrement A du contrôleur est vérifié, et une adresse de bouclage y est signalée PROBLEME.',
    'sysvol et netlogon sont vérifiés par une connexion anonyme, sans mot de passe.',
    'Les lectures de samba-tool sont annoncées IGNORE quand root manque.',
    'klist lit les tickets existants ; kinit n’est jamais appelé, et la commande est affichée.',
    'La réplication, si demandée, est accompagnée de la mention qu’elle ne vaut que pour ce contrôleur.',
    'Le verdict suit l’ordre des dépendances : unité, ports, SRV, partages.',
    'Aucune écriture, aucun mot de passe, aucun ticket demandé.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit. Il ne démarre pas l’unité, ne corrige aucun enregistrement DNS et ne demande aucun ticket.',
    diagnostic: `# Dans l ordre des dependances :
systemctl is-active samba-ad-dc
ss -lntup | grep -E '[:.](53|88|389|445|464)$'
host -t SRV _ldap._tcp.kjemo.lan.
host -t SRV _kerberos._udp.kjemo.lan.
smbclient -L localhost -N
sudo samba-tool domain level show`,
    command: `# Aucune modification a annuler.
#
# Les corrections, selon la couche, et a taper soi-meme :
#   unite masquee :     sudo systemctl unmask samba-ad-dc
#                       sudo systemctl enable --now samba-ad-dc
#   un port manquant :  lire le journal du controleur,
#                       sudo journalctl -u samba-ad-dc -n 50 --no-pager
#   SRV absents :       verifier que la machine interroge SON PROPRE DNS
#                       (search et nameserver dans /etc/resolv.conf)
#   Kerberos :          kinit administrator, puis klist — a la main,
#                       parce que la commande demande un mot de passe
#
# Ce que ce script ne fera jamais : demander un ticket, ajouter un
# enregistrement DNS, ou demarrer l unite a ta place.`,
    warning: 'Un contrôleur dont les cinq ports écoutent n’est pas un contrôleur sain : ce sont les SRV qui décident si les clients le trouvent.',
  },

  checks: [
    'Aucune écriture : aucune unité touchée, aucun enregistrement DNS modifié, aucun compte changé.',
    'kinit n’est jamais appelé : il exige un mot de passe. Seul klist, qui LIT le cache, est employé.',
    'Les cinq ports du contrôleur sont contrôlés séparément, et le rapport dit ce que l’absence de chacun provoque.',
    'La comparaison des ports se fait sur l’adresse LOCALE (4e colonne de ss), et non sur la ligne entière : la colonne du pair contient aussi des numéros.',
    'Les deux SRV sont interrogés un par un, et leur absence est reliée au message réel vu sur un client Windows.',
    'Une adresse de bouclage publiée par le contrôleur pour lui-même est signalée PROBLEME.',
    'La connexion qui liste sysvol et netlogon est ANONYME, comme le wiki l’indique : aucun mot de passe.',
    'Les sections réservées à root sont annoncées IGNORE, jamais OK.',
    'La réplication est présentée comme unidirectionnelle, et une sortie vide sur un contrôleur unique n’est pas comptée comme un succès.',
    'Le verdict suit l’ordre des dépendances, parce qu’une couche basse rend les suivantes illisibles.',
  ],

  source: WIKI_AD,
  sources: [
    { label: 'Samba Wiki — vérifications : SRV, enregistrement A, sysvol et netlogon, kinit', url: WIKI_AD },
    { label: 'samba-tool(8) — domain level, domain info, drs showrepl', url: `${M}/man8/samba-tool.8.html` },
    { label: 'smbclient(1)', url: `${M}/man1/smbclient.1.html` },
    { label: 'klist — documentation officielle MIT Kerberos (klist(1) n’est pas publiée pour noble)', url: 'https://web.mit.edu/Kerberos/krb5-devel/doc/user/user_commands/klist.html' },
    { label: 'ss(8)', url: `${M}/man8/ss.8.html` },
  ],
};

// ===========================================================================
// 4. samba-ad-user-manage
// ===========================================================================
//
// Il LIT les comptes du domaine, et PRÉPARE les commandes qui les modifient.
//
// Pourquoi il ne modifie pas : créer un compte demande un mot de passe —
// `samba-tool user create` le demande à la console, et l'option qui le passe
// en argument le laisse dans la liste des processus, lisible par tous. Quant à
// désactiver un compte, c'est réversible mais pas anodin : dans un annuaire,
// une action portée sur le mauvais compte se propage à chaque poste du domaine
// en quelques minutes.
//
// Un filtre anti-secret s'applique à la sortie de `samba-tool user show` : la
// liste des attributs varie selon la version, et un attribut de secret qui
// apparaîtrait un jour dans cette sortie se retrouverait dans un rapport qu'on
// copie dans un courriel.

const sambaAdUserManage = {
  id: 'samba-ad-user-manage',
  icon: '◇',
  category: CAT,
  subcategory: 'Samba AD',
  title: 'Lire les comptes du domaine, et préparer les commandes qui les changent',
  risk: 'diagnostic',
  summary: 'Liste les comptes du domaine et examine un compte avec un filtre qui retire les attributs de secret de la sortie — parce que la liste des attributs varie selon la version, et qu’un rapport se copie dans un courriel. Prépare ensuite, sans les exécuter, les commandes de création, de désactivation et de réactivation : créer un compte demande un mot de passe à la console, et une action portée sur le mauvais compte d’un annuaire se propage à tout le domaine en quelques minutes.',

  platform: 'Linux',
  output: '.sh',
  os: OS_LINUX,
  distros: DISTROS,
  packages: [
    'samba — samba-tool (apt install samba)',
  ],
  privileges: 'root : samba-tool lit la base du domaine. Sans root, la lecture est annoncée IGNORE et le rapport ne conclut rien',
  privilegesRequis: 'root-partiel',
  readOnly: true,
  service: 'samba-ad-dc.service',
  limites: [
    'LIT seulement. Ne crée, ne modifie, ne désactive et ne supprime aucun compte. Les commandes sont AFFICHÉES, avec les valeurs saisies, à taper soi-même.',
    'N’exécute jamais « samba-tool user create », « setpassword », « getpassword » ni « syncpasswords ». Les deux premières manipulent un mot de passe ; les deux dernières EXPOSENT des secrets de la base, et aucune ne sert à un diagnostic.',
    'Ne supprime aucun compte, et n’affiche pas la commande qui le fait. Dans un annuaire, une suppression emporte l’identifiant de sécurité du compte : le recréer avec le même nom ne lui rend ni ses accès, ni ses appartenances, ni la propriété de ses fichiers. Désactiver est réversible ; supprimer ne l’est pas.',
    'Filtre la sortie de « samba-tool user show » : les lignes dont l’attribut porte un nom de secret sont retirées avant d’entrer dans le rapport. Le filtre est nominatif, et il est là parce que la liste des attributs varie selon la version — pas parce qu’un secret y figure aujourd’hui.',
    'Ne touche pas aux comptes Unix. Un compte de domaine et un compte local sont deux choses : l’assistant linux-user-create s’occupe du second.',
  ],

  fields: [
    {
      id: 'action',
      label: 'Ce que l’on veut',
      type: 'select',
      default: 'Lister les comptes',
      options: [
        ['Lister les comptes', 'Lister les comptes'],
        ['Examiner un compte', 'Examiner un compte'],
        ['Préparer une création', 'Préparer une création'],
        ['Préparer une désactivation', 'Préparer une désactivation'],
        ['Préparer une réactivation', 'Préparer une réactivation'],
      ],
      help: 'Les deux premières LISENT. Les trois autres préparent une commande à taper : ni mot de passe, ni action exécutée par le script.',
    },
    {
      id: 'compte',
      label: 'Compte concerné (vide pour un simple inventaire)',
      type: 'text',
      default: '',
      placeholder: 'blaise',
      optionnel: true,
      help: 'Le nom d’ouverture de session dans le domaine. Obligatoire dès que l’action porte sur un compte précis.',
    },
    CHAMP_FORMAT,
  ],

  validate(v) {
    const errors = {};
    const actions = ['Lister les comptes', 'Examiner un compte', 'Préparer une création',
      'Préparer une désactivation', 'Préparer une réactivation'];
    const a = validateChoix(v.action, actions, 'L’action');
    if (!a.ok) errors.action = a.error;
    const compte = String(v.compte ?? '').trim();
    if (compte !== '') {
      const r = validateNomUtilisateur(compte, 'Le compte concerné');
      if (!r.ok) errors.compte = r.error;
    }
    if (compte === '' && String(v.action) !== 'Lister les comptes') {
      errors.compte = `L’action « ${String(v.action)} » porte sur un compte précis, et aucun compte n’est nommé. Dans un annuaire, une commande préparée sans cible est une commande qu’on complétera à la main au mauvais moment : le formulaire exige donc le nom dès maintenant.`;
    }
    validerFormat(v, errors);
    return errors;
  },

  generate(v) {
    assertValid(this, v);
    const action = String(v.action);
    const compte = String(v.compte ?? '').trim();
    const lecture = action === 'Lister les comptes' || action === 'Examiner un compte';

    return assemblerSh([
      ...enteteBash({
        titre: 'Lire les comptes du domaine, et preparer les commandes qui les changent',
        outil: this.id,
        diagnostic: true,
        root: false,
      }),
      ...fonctionsEchappementBash(),
      ...fonctionsRapportBash(),
      ...blocPrivilegesBash({
        exige: false,
        pourquoi: 'samba-tool lit la base du domaine, qui n est pas lisible sans root',
      }),
      ...blocVariablesBash([
        ['KJEMO_SMBCONF', shQuote('/etc/samba/smb.conf')],
        ['KJEMO_COMPTE', shQuote(compte)],
        ['KJEMO_ACTION', shQuote(action)],
        ['KJEMO_FORMAT', shQuote(String(v.format))],
      ]),
      '',
      'KJEMO_PARAMETRES="${KJEMO_TMP}/parametres.tsv"',
      '{',
      "  printf '%s\\t%s\\n' 'Action' \"${KJEMO_ACTION}\"",
      "  printf '%s\\t%s\\n' 'Compte' \"${KJEMO_COMPTE:-aucun}\"",
      "  printf '%s\\t%s\\n' 'Ecritures' 'AUCUNE - aucun compte cree, change, desactive ni supprime'",
      "  printf '%s\\t%s\\n' 'Mots de passe' 'AUCUN - ni create, ni setpassword, ni getpassword, ni syncpasswords'",
      "  printf '%s\\t%s\\n' 'Format' \"${KJEMO_FORMAT}\"",
      '} > "${KJEMO_PARAMETRES}"',
      '',
      '# ---------------------------------------------------------------------------',
      '# LE FILTRE ANTI-SECRET',
      '#',
      '# La sortie de « samba-tool user show » est une entree d annuaire, et la',
      '# liste de ses attributs varie selon la version de Samba. Ce filtre retire',
      '# NOMINATIVEMENT les attributs qui portent un secret, avant que la sortie',
      '# entre dans un rapport — et un rapport se copie dans un courriel.',
      '#',
      '# Il n est pas la parce qu un secret figure dans cette sortie aujourd hui :',
      '# il est la parce que la liste des attributs n est pas sous notre controle.',
      '# ---------------------------------------------------------------------------',
      'kjemo_sans_secret() {',
      '  grep -viE \'^(unicodePwd|dBCSPwd|supplementalCredentials|userPassword|clearTextPassword|msDS-KeyCredentialLink|ntPwdHistory|lmPwdHistory|krbgPrincipalKey)\' \\',
      '    || true',
      '}',
      '',
      ...blocAdExistant(),
      '# ---------------------------------------------------------------------------',
      '# LA LECTURE',
      '# ---------------------------------------------------------------------------',
      'KJEMO_LU=0',
      'if [ "${KJEMO_ROOT}" -eq 1 ] && kjemo_dispo samba-tool; then',
      '  KJEMO_LISTE="$(samba-tool user list 2>&1 | head -200 || true)"',
      '  KJEMO_NB="$(printf \'%s\\n\' "${KJEMO_LISTE}" | grep -cvE \'^[[:space:]]*$\' || printf \'%s\' 0)"',
      '  case "${KJEMO_LISTE}" in',
      '    *"ERROR"*|*"Traceback"*)',
      "      kjemo_resultat 'Comptes' 'Inventaire' 'PROBLEME' \"${KJEMO_LISTE}\" \\",
      '        "samba-tool ne peut pas lister les comptes : ${KJEMO_LISTE}. Si le domaine existe, c est souvent que le controleur n est pas demarre — la base se lit, l annuaire ne repond pas."',
      '      ;;',
      '    *)',
      '      KJEMO_LU=1',
      "      kjemo_resultat 'Comptes' 'Inventaire' 'INFO' \"${KJEMO_NB} compte(s)\" \\",
      '        "${KJEMO_NB} compte(s) dans le domaine : ${KJEMO_LISTE}. Les comptes de machines n y figurent pas — ils se listent avec « samba-tool computer list », et les confondre fait chercher un poste parmi les utilisateurs."',
      '      ;;',
      '  esac',
      'else',
      "  kjemo_resultat 'Comptes' 'Inventaire' 'IGNORE' 'non lu' \\",
      "    'Les comptes du domaine n ont PAS ete lus : samba-tool demande root, ou la commande est absente. Ce rapport ne dit donc rien des comptes existants.'",
      'fi',
      '',
      ...(action === 'Examiner un compte' ? [
        '# -----------------------------------------------------------------------',
        '# EXAMINER UN COMPTE, SANS SES SECRETS',
        '# -----------------------------------------------------------------------',
        'if [ "${KJEMO_LU}" -eq 1 ]; then',
        '  if printf \'%s\\n\' "${KJEMO_LISTE}" | grep -qxF -- "${KJEMO_COMPTE}"; then',
        '    KJEMO_FICHE="$(samba-tool user show "${KJEMO_COMPTE}" 2>&1 | kjemo_sans_secret | head -40 || true)"',
        "    kjemo_resultat 'Compte' \"${KJEMO_COMPTE}\" 'INFO' \"${KJEMO_FICHE:-non lue}\" \\",
        '      "Entree d annuaire de ${KJEMO_COMPTE}, filtrée des attributs de secret : ${KJEMO_FICHE:-non lue}. Deux attributs valent la lecture : « userAccountControl », dont un bit dit si le compte est DESACTIVE, et « pwdLastSet », qui a la valeur 0 quand le mot de passe doit etre change a la prochaine ouverture de session."',
        '  else',
        "    kjemo_resultat 'Compte' \"${KJEMO_COMPTE}\" 'PROBLEME' 'absent du domaine' \\",
        '      "Le compte ${KJEMO_COMPTE} ne figure pas dans la liste des comptes du domaine. Attention a la casse, et souviens-toi qu un compte de MACHINE ne figure pas dans cette liste : « samba-tool computer list » les montre."',
        '  fi',
        'fi',
        '',
      ] : []),
      ...(lecture ? [] : [
        '# -----------------------------------------------------------------------',
        '# LA COMMANDE PREPAREE, ET LA RAISON POUR LAQUELLE ELLE N EST PAS LANCEE',
        '# -----------------------------------------------------------------------',
        'if [ "${KJEMO_LU}" -eq 1 ]; then',
        '  if printf \'%s\\n\' "${KJEMO_LISTE}" | grep -qxF -- "${KJEMO_COMPTE}"; then',
        '    KJEMO_PRESENT=1',
        '  else',
        '    KJEMO_PRESENT=0',
        '  fi',
        ...(action === 'Préparer une création' ? [
          '  if [ "${KJEMO_PRESENT}" -eq 1 ]; then',
          "    kjemo_resultat 'Preparation' 'Creation' 'PROBLEME' 'le compte existe deja' \\",
          '      "Le compte ${KJEMO_COMPTE} existe DEJA dans le domaine. Une creation echouerait, et c est tant mieux : si elle reussissait, elle remplacerait un compte dont les appartenances et l identifiant de securite ne se retrouvent pas."',
          '  else',
          "    kjemo_resultat 'Preparation' 'Creation' 'ATTENTION' 'commande a taper' \\",
          '      "Le compte ${KJEMO_COMPTE} n existe pas : la commande est affichee ci-dessous. Elle demande le mot de passe A LA CONSOLE, et ce script ne la lance pas — l option qui passe le mot de passe en argument le laisserait dans la liste des processus, lisible par tous les comptes de la machine."',
          '  fi',
        ] : []),
        ...(action === 'Préparer une désactivation' ? [
          '  if [ "${KJEMO_PRESENT}" -ne 1 ]; then',
          "    kjemo_resultat 'Preparation' 'Desactivation' 'PROBLEME' 'compte absent' \\",
          '      "Le compte ${KJEMO_COMPTE} ne figure pas dans le domaine : il n y a rien a desactiver. Verifie la casse du nom avant de conclure."',
          '  else',
          "    kjemo_resultat 'Preparation' 'Desactivation' 'ATTENTION' 'commande a taper' \\",
          '      "La commande est affichee ci-dessous. Desactiver est REVERSIBLE — c est pourquoi on desactive au lieu de supprimer — mais l effet se propage a tout le domaine en quelques minutes : la personne perdra sa session suivante sur chaque poste. Previens avant, pas apres."',
          '  fi',
        ] : []),
        ...(action === 'Préparer une réactivation' ? [
          '  if [ "${KJEMO_PRESENT}" -ne 1 ]; then',
          "    kjemo_resultat 'Preparation' 'Reactivation' 'PROBLEME' 'compte absent' \\",
          '      "Le compte ${KJEMO_COMPTE} ne figure pas dans le domaine : il n y a rien a reactiver. Un compte SUPPRIME ne se reactive pas — il se recree, et le compte recree n est pas le meme : son identifiant de securite est different, donc ses anciens acces et la propriete de ses fichiers ne lui reviennent pas."',
          '  else',
          "    kjemo_resultat 'Preparation' 'Reactivation' 'ATTENTION' 'commande a taper' \\",
          '      "La commande est affichee ci-dessous. Verifie aussi « pwdLastSet » : un compte reactive dont le mot de passe a expire redemandera un changement a la prochaine ouverture de session, ce qui ressemble a une reactivation ratee."',
          '  fi',
        ] : []),
        'fi',
        '',
      ]),
      '# La portee du rapport. Les deux drapeaux ci-dessous ne sont pas',
      '# decoratifs : sans eux, un rapport qui n a RIEN pu lire se lirait comme',
      '# un rapport qui n a rien trouve.',
      'if [ "${KJEMO_AD_EXISTE}" -ne 1 ]; then',
      "  kjemo_resultat 'Portee' 'Ce n est pas un controleur' 'PROBLEME' 'aucun domaine' \\",
      "    'Cette machine ne porte aucune base de domaine : il n y a pas de comptes de domaine a lire ici. Si tu attendais un controleur, c est le provisionnement qu il faut regarder, et non les comptes.'",
      'elif [ "${KJEMO_LU}" -ne 1 ]; then',
      "  kjemo_resultat 'Portee' 'Lecture non concluante' 'IGNORE' 'comptes non lus' \\",
      "    'Le domaine existe et ses comptes n ont PAS pu etre lus — root manque, samba-tool est absent, ou l annuaire ne repond pas. Ce rapport ne dit donc rien des comptes : ne conclus pas d une liste vide qu il n y a pas de comptes.'",
      'fi',
      '',
      '# ---------------------------------------------------------------------------',
      '# LES COMMANDES, AFFICHEES ET NON EXECUTEES',
      '# ---------------------------------------------------------------------------',
      "printf '\\n%s\\n' '=============================================================='",
      "printf '%s\\n' 'A TAPER SOI-MEME'",
      "printf '%s\\n' '=============================================================='",
      "printf '%s\\n' ''",
      ...(action === 'Préparer une création' ? [
        "printf '%s\\n' 'Creer le compte. Le mot de passe est demande A LA CONSOLE :'",
        'printf \'%s\\n\' "  sudo samba-tool user create ${KJEMO_COMPTE}"',
        "printf '%s\\n' ''",
        "printf '%s\\n' 'Puis verifier, et exiger un changement a la premiere'",
        "printf '%s\\n' 'ouverture de session si c est la politique :'",
        'printf \'%s\\n\' "  sudo samba-tool user show ${KJEMO_COMPTE}"',
        "printf '%s\\n' ''",
        "printf '%s\\n' 'N emploie PAS l option qui passe le mot de passe en'",
        "printf '%s\\n' 'argument : la liste des processus est lisible par tous les'",
        "printf '%s\\n' 'comptes de la machine, et l historique du terminal garde la'",
        "printf '%s\\n' 'ligne.'",
      ] : []),
      ...(action === 'Préparer une désactivation' ? [
        "printf '%s\\n' 'Desactiver le compte — reversible :'",
        'printf \'%s\\n\' "  sudo samba-tool user disable ${KJEMO_COMPTE}"',
        "printf '%s\\n' ''",
        "printf '%s\\n' 'Puis RELIRE, parce qu une commande qui sort 0 ne prouve pas'",
        "printf '%s\\n' 'un etat :'",
        'printf \'%s\\n\' "  sudo samba-tool user show ${KJEMO_COMPTE}"',
        "printf '%s\\n' ''",
        "printf '%s\\n' 'Ne supprime pas a la place de desactiver. Une suppression'",
        "printf '%s\\n' 'emporte l identifiant de securite du compte : le recreer avec'",
        "printf '%s\\n' 'le meme nom ne lui rend ni ses acces, ni ses appartenances,'",
        "printf '%s\\n' 'ni la propriete de ses fichiers.'",
      ] : []),
      ...(action === 'Préparer une réactivation' ? [
        "printf '%s\\n' 'Reactiver le compte :'",
        'printf \'%s\\n\' "  sudo samba-tool user enable ${KJEMO_COMPTE}"',
        "printf '%s\\n' ''",
        "printf '%s\\n' 'Puis RELIRE, et regarder pwdLastSet : un mot de passe expire'",
        "printf '%s\\n' 'redemandera un changement a la premiere ouverture de session,'",
        "printf '%s\\n' 'ce qui ressemble a une reactivation ratee :'",
        'printf \'%s\\n\' "  sudo samba-tool user show ${KJEMO_COMPTE}"',
      ] : []),
      ...(lecture ? [
        "printf '%s\\n' 'Cette execution n a fait que LIRE. Pour agir sur un compte,'",
        "printf '%s\\n' 'relance cet assistant avec l action correspondante : il'",
        "printf '%s\\n' 'preparera la commande, avec ses avertissements, et ne la'",
        "printf '%s\\n' 'lancera pas davantage.'",
        "printf '%s\\n' ''",
        "printf '%s\\n' 'Les comptes de MACHINES se listent a part :'",
        "printf '%s\\n' '  sudo samba-tool computer list'",
      ] : []),
      "printf '%s\\n' ''",
      "printf '%s\\n' 'Ce que ce script n a PAS fait : aucun compte cree, change,'",
      "printf '%s\\n' 'desactive ni supprime, et aucun mot de passe demande, affiche'",
      "printf '%s\\n' 'ou ecrit.'",
      "printf '%s\\n' '=============================================================='",
      '',
      "kjemo_resultat 'Portee' 'Ecritures' 'INFO' 'aucune' \\",
      "  'Aucune ecriture : aucun compte cree, change, desactive ni supprime. Aucun mot de passe demande, affiche ou ecrit. Les attributs de secret sont retires de la sortie avant qu elle entre dans le rapport.'",
      '',
      ...blocRapportBash({ prefixeFichier: 'kjemo-samba-ad-comptes' }),
    ]);
  },

  gui: [
    'Liste d’abord : « sudo samba-tool user list ». Les comptes de machines n’y figurent pas — « samba-tool computer list » les montre.',
    'Examine un compte avec « sudo samba-tool user show <compte> », et lis « userAccountControl » : un bit y dit si le compte est désactivé.',
    '« pwdLastSet » à 0 signifie que le mot de passe doit être changé à la prochaine ouverture de session. Cela ressemble à une panne et n’en est pas une.',
    'Crée un compte avec « sudo samba-tool user create <compte> » : la commande demande le mot de passe à la console. N’emploie pas l’option qui le passe en argument.',
    'Désactive au lieu de supprimer : « sudo samba-tool user disable <compte> » est réversible, et une suppression ne l’est pas.',
    'Une suppression emporte l’identifiant de sécurité : le compte recréé avec le même nom n’a ni les mêmes accès, ni la propriété des mêmes fichiers.',
    'Relis après chaque action : une commande qui sort 0 ne prouve pas un état.',
    'Un compte de domaine et un compte Unix local sont deux choses. Ne cherche pas l’un avec « getent passwd » tant que winbind n’est pas en place.',
    'Prévenir avant de désactiver : l’effet se propage à tout le domaine en quelques minutes, et la personne perd sa session suivante sur chaque poste.',
  ],

  keywords: ['samba', 'active directory', 'comptes', 'samba-tool user',
    'user list', 'user show', 'disable', 'enable', 'userAccountControl',
    'pwdLastSet', 'annuaire', 'diagnostic', 'linux', 'ubuntu'],

  requiresAdmin: false,
  prereqs: [
    'sudo : samba-tool lit la base du domaine. Sans sudo, la lecture est annoncée IGNORE et le rapport ne conclut rien.',
    'Un contrôleur de domaine en service sur cette machine. L’assistant samba-ad-health le vérifie.',
    'Le nom du compte, dès que l’action porte sur un compte précis.',
  ],

  commonErrors: [
    {
      message: 'ERROR: Unable to find user',
      code: 'KJEMO',
      cause: 'Le nom ne correspond à aucun compte — casse différente, ou c’est un compte de machine, qui ne figure pas dans la liste des utilisateurs.',
      fix: 'Lister les deux familles avant de conclure.',
      command: 'sudo samba-tool user list; sudo samba-tool computer list',
    },
    {
      message: 'Le compte est activé et la personne ne peut pas ouvrir de session',
      code: 'KJEMO',
      cause: '« pwdLastSet » à 0 : le mot de passe doit être changé à la première ouverture de session.',
      fix: 'Lire l’attribut, puis laisser la personne changer son mot de passe.',
      command: 'sudo samba-tool user show blaise',
    },
    {
      message: 'J’ai supprimé un compte et je l’ai recréé, et il n’a plus ses accès',
      code: 'KJEMO',
      cause: 'Le compte recréé a un nouvel identifiant de sécurité. Les permissions, les appartenances et la propriété des fichiers étaient attachées à l’ancien.',
      fix: 'Il n’y a pas de correction : réattribuer les accès, et désactiver au lieu de supprimer la prochaine fois.',
      command: 'sudo samba-tool user show blaise',
    },
    {
      message: 'samba-tool : ERROR: Unable to open samdb',
      code: 'KJEMO',
      cause: 'La commande est lancée sans root, ou le contrôleur n’est pas démarré.',
      fix: 'Vérifier les deux.',
      command: 'id -u; systemctl is-active samba-ad-dc',
    },
    {
      message: 'Le compte existe dans le domaine et « getent passwd » ne le trouve pas',
      code: 'KJEMO',
      cause: 'Ce sont deux bases : « getent » interroge Unix, et il faut winbind pour qu’il voie les comptes du domaine.',
      fix: 'Comparer les deux sources avant de conclure à une absence.',
      command: 'sudo samba-tool user list; getent passwd blaise',
    },
  ],

  reversible: true,
  verifyAfter: [
    'La présence d’une base de domaine est établie avant toute lecture.',
    'La liste des comptes est lue par samba-tool, ou annoncée IGNORE si root manque.',
    'La sortie de « user show » passe par un filtre anti-secret nominatif avant d’entrer dans le rapport.',
    'Un compte absent est signalé PROBLEME, avec le rappel que les comptes de machines sont une autre liste.',
    'Pour une création : l’existence préalable du compte est vérifiée, et une création par-dessus est refusée.',
    'Pour une désactivation ou une réactivation : l’absence du compte est signalée avant d’afficher la commande.',
    'Les commandes sont affichées avec le nom du compte déjà en place, et jamais exécutées.',
    'Aucun compte créé, changé, désactivé ni supprimé. Aucun mot de passe.',
  ],

  rollback: {
    summary: 'Rien à annuler : l’assistant lit et affiche. Pour les commandes qu’il prépare, l’inverse exact est indiqué — « user enable » annule « user disable ». Ce qui n’a pas d’inverse, la suppression d’un compte, n’est pas proposé du tout.',
    diagnostic: `# Les deux familles de comptes :
sudo samba-tool user list
sudo samba-tool computer list
# Un compte, sans ses secrets :
sudo samba-tool user show blaise`,
    command: `# Aucune modification a annuler par ce script.
#
# Les inverses exacts des commandes qu il prepare :
#   sudo samba-tool user disable blaise   <->  sudo samba-tool user enable blaise
#
# La creation d un compte s annule par une desactivation, et non par une
# suppression : un compte supprime puis recree a un identifiant de
# securite different, donc il perd ses acces, ses appartenances et la
# propriete de ses fichiers. C est pour cela que la commande de
# suppression n est pas proposee par cet assistant.
#
# Apres chaque action, RELIRE : une commande qui sort 0 ne prouve pas
# un etat.
#   sudo samba-tool user show blaise`,
    warning: 'Désactiver se propage à tout le domaine en quelques minutes : la personne perd sa session suivante sur chaque poste. Préviens avant.',
  },

  checks: [
    'Aucune écriture : aucun compte créé, changé, désactivé ni supprimé.',
    'Aucun appel à « user create », « setpassword », « getpassword » ni « syncpasswords » : les deux premiers manipulent un mot de passe, les deux derniers exposent des secrets de la base.',
    'La commande de SUPPRESSION n’est ni exécutée ni affichée : elle n’a pas d’inverse, et la fiche explique pourquoi un compte recréé n’est pas le même compte.',
    'La sortie de « user show » est filtrée nominativement des attributs de secret, parce que la liste des attributs varie selon la version.',
    'Le formulaire exige le nom du compte dès que l’action porte sur un compte précis.',
    'L’existence du compte est vérifiée avant chaque commande préparée, et une création par-dessus un compte existant est refusée.',
    'Les lectures sont annoncées IGNORE quand root manque, jamais OK.',
    'Les comptes de machines sont distingués des comptes d’utilisateurs à chaque occasion où la confusion est possible.',
    'Chaque commande préparée est accompagnée de sa relecture : une commande qui sort 0 ne prouve pas un état.',
  ],

  source: `${M}/man8/samba-tool.8.html`,
  sources: [
    { label: 'samba-tool(8) — user list, user show, user disable, user enable', url: `${M}/man8/samba-tool.8.html` },
    { label: 'Samba Wiki — contrôleur de domaine AD', url: WIKI_AD },
    { label: 'Samba Wiki — extensions RFC2307 dans AD', url: `${WIKI}/Setting_up_RFC2307_in_AD` },
    { label: 'smb.conf(5)', url: `${M}/man5/smb.conf.5.html` },
  ],
};

export const toolsLinuxM = [
  sambaAdDcReadiness,
  sambaAdDcProvision,
  sambaAdHealth,
  sambaAdUserManage,
];
