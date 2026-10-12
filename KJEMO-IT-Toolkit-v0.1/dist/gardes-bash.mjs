/**
 * gardes-bash.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les gardes communes aux scripts Bash qui MODIFIENT quelque chose : gardien
 * de chemin, sauvegarde vérifiée, confirmation, capture et restauration d'état,
 * et les portes de validation (testparm, sshd -t) qui doivent réussir avant
 * qu'une configuration soit appliquée.
 *
 * Un seul module, parce qu'une garde dupliquée est une garde qu'on corrige
 * dans un script et qu'on oublie dans l'autre. Le LOT 6 l'a appris : le
 * gardien de chemin Windows était partagé, et c'est précisément pour cela que
 * le corriger a corrigé les six outils d'un coup — au prix de 48 scripts
 * régénérés, ce qui est le bon prix.
 *
 * N'importe que noyau-bash.mjs, pour shQuote. Aucun cycle possible.
 */

import { shQuote } from './noyau-bash.mjs';

/**
 * Segments de chemin protégés — refusés dans N'IMPORTE QUEL segment du chemin
 * canonique, pas seulement le dernier.
 *
 * Cette précision vient d'un défaut réel corrigé au LOT 6 : le gardien Windows
 * ne comparait que le dernier segment, si bien qu'il refusait `C:\\Projet\\.git`
 * et acceptait `C:\\Projet\\.git\\journaux`. Un gardien qu'on contourne en
 * ajoutant un sous-dossier ne garde rien. Le gardien Linux est écrit avec cette
 * leçon déjà apprise, et le banc l'éprouve dans les deux sens.
 */
export const SEGMENTS_PROTEGES = ['.git', '.env', '.ssh', '.gnupg', '.aws', 'node_modules'];

/**
 * Racines système protégées : refusées elles-mêmes ET en descendance.
 *
 * `/etc` y figure parce qu'un script de ce lot ne doit jamais écrire dans
 * `/etc` par un chemin fourni au formulaire. Les outils qui modifient
 * légitimement un fichier d'`/etc` — smb.conf, exports, sshd_config — ne
 * passent pas par le gardien avec un chemin libre : ils visent un fichier
 * NOMMÉ dans le script, sauvegardé avant écriture, et validé avant rechargement.
 * La différence est tout le sujet : un chemin choisi par l'utilisateur et un
 * fichier connu du script ne méritent pas la même confiance.
 */
export const RACINES_PROTEGEES = [
  '/boot', '/dev', '/etc', '/proc', '/sys', '/root',
  '/bin', '/sbin', '/lib', '/lib64', '/usr', '/var/lib/dpkg',
];

/**
 * Le gardien de chemin, en Bash.
 *
 * Contrat, identique à celui du gardien Windows :
 *   - canonisation AVANT toute comparaison (sinon `/tmp/../etc` passe) ;
 *   - segments sensibles refusés dans TOUS les segments ;
 *   - racines système refusées en égalité ET en descendance ;
 *   - insensible à la casse pour les segments (un `.GIT` sur un montage
 *     insensible à la casse est le même dossier) ;
 *   - le message NOMME la zone détectée ;
 *   - AUCUNE écriture avant la décision.
 *
 * `realpath -m` canonise sans exiger que le chemin existe : on doit pouvoir
 * refuser `/etc/truc/qui/nexiste/pas` avant de le créer, et non après.
 *
 * @param {object} o
 * @param {boolean} o.lectureSeule  true : les racines système sont tolérées,
 *   les segments sensibles restent refusés. Même distinction qu'au LOT 6 : on
 *   ne protège pas /usr en refusant de le LIRE.
 */
export function blocGardienChemin({ lectureSeule = false } = {}) {
  return [
    '# ---------------------------------------------------------------------------',
    '# GARDIEN DE CHEMIN',
    '#',
    '# Il canonise AVANT de comparer : sans cela, /tmp/../etc passerait pour',
    '# /tmp. Il cherche les segments sensibles dans TOUS les segments, et non',
    '# dans le dernier : un gardien qu on contourne en ajoutant un sous-dossier',
    '# ne garde rien. Et il NOMME la zone detectee, parce que "chemin refuse"',
    '# n apprend rien et pousse a essayer au hasard.',
    '#',
    '# Aucune ecriture n a lieu avant sa decision.',
    '# ---------------------------------------------------------------------------',
    `KJEMO_SEGMENTS_PROTEGES=(${SEGMENTS_PROTEGES.map((s) => shQuote(s)).join(' ')})`,
    `KJEMO_RACINES_PROTEGEES=(${RACINES_PROTEGEES.map((s) => shQuote(s)).join(' ')})`,
    '',
    '# realpath -m canonise sans exiger que le chemin EXISTE : il faut pouvoir',
    '# refuser /etc/x/y/z avant de le creer, pas apres.',
    'kjemo_canoniser() {',
    '  local brut="${1:-}"',
    '  if [ -z "${brut}" ]; then return 1; fi',
    '  local canon=\'\'',
    '  canon="$(realpath -m -- "${brut}" 2>/dev/null)" || return 1',
    '  if [ -z "${canon}" ]; then return 1; fi',
    '  printf \'%s\' "${canon}"',
    '}',
    '',
    '# Vrai si $1 est egal a $2 ou situe SOUS $2.',
    '# Le "/" ajoute evite le faux positif classique : /etc-sauvegarde n est pas',
    '# sous /etc, mais "commence par /etc" est vrai des deux.',
    'kjemo_sous_racine() {',
    '  local canon="${1:-}" racine="${2:-}"',
    '  if [ -z "${canon}" ] || [ -z "${racine}" ]; then return 1; fi',
    '  if [ "${canon}" = "${racine}" ]; then return 0; fi',
    '  case "${canon}" in',
    '    "${racine}"/*) return 0 ;;',
    '  esac',
    '  return 1',
    '}',
    '',
    '# Decide, et explique. Code 0 = accepte, 1 = refuse.',
    '# KJEMO_ZONE porte le nom de la zone detectee, pour le message.',
    'kjemo_chemin_sur() {',
    '  local brut="${1:-}" role="${2:-chemin}"',
    '  KJEMO_ZONE=\'\'',
    '  if [ -z "${brut}" ]; then',
    '    KJEMO_ZONE=\'chemin vide\'',
    '    return 1',
    '  fi',
    '  local canon=\'\'',
    '  canon="$(kjemo_canoniser "${brut}")" || {',
    '    KJEMO_ZONE=\'chemin non canonisable\'',
    '    return 1',
    '  }',
    '  if [ "${canon}" = \'/\' ]; then',
    '    KJEMO_ZONE=\'racine du systeme de fichiers\'',
    '    return 1',
    '  fi',
    '',
    '  # 1. Segments sensibles, dans TOUS les segments, insensible a la casse.',
    '  local bas=\'\' seg=\'\' protege=\'\'',
    '  bas="$(printf \'%s\' "${canon}" | tr \'[:upper:]\' \'[:lower:]\')"',
    '  local anciens_ifs="${IFS}"',
    '  IFS=\'/\'',
    '  # shellcheck disable=SC2086',
    '  set -- ${bas}',
    '  IFS="${anciens_ifs}"',
    '  for seg in "$@"; do',
    '    if [ -z "${seg}" ]; then continue; fi',
    '    for protege in "${KJEMO_SEGMENTS_PROTEGES[@]}"; do',
    '      if [ "${seg}" = "$(printf \'%s\' "${protege}" | tr \'[:upper:]\' \'[:lower:]\')" ]; then',
    '        KJEMO_ZONE="segment protege ${protege}"',
    '        return 1',
    '      fi',
    '    done',
    '  done',
    '',
    // Deux variantes, écrites comme deux blocs lisibles plutôt que comme une
    // liste de ternaires alignés par indice — cette forme-là se casse au
    // premier ajout de ligne, et personne ne s'en aperçoit avant que le
    // gardien généré soit syntaxiquement faux.
    ...(lectureSeule
      ? [
        '  # 2. LECTURE SEULE : les racines systeme ne sont PAS refusees.',
        '  #    On ne protege pas /usr ni /etc en refusant de les LIRE, et le',
        '  #    refuser casserait un diagnostic legitime sans rien proteger.',
        '  #    Les segments sensibles ci-dessus restent refuses, eux, meme en',
        '  #    lecture : le contenu d un .ssh ou d un .env n a pas a etre lu',
        '  #    par un script de diagnostic, et encore moins recopie dans un',
        '  #    rapport.',
        '  KJEMO_CHEMIN_CANON="${canon}"',
        '  return 0',
        '}',
      ]
      : [
        '  # 2. Racines systeme : egalite ou descendance.',
        '  local racine=\'\'',
        '  for racine in "${KJEMO_RACINES_PROTEGEES[@]}"; do',
        '    if kjemo_sous_racine "${canon}" "${racine}"; then',
        '      KJEMO_ZONE="zone systeme ${racine}"',
        '      return 1',
        '    fi',
        '  done',
        '',
        '  # 3. Le dossier personnel LUI-MEME, et la racine des profils. Leurs',
        '  #    SOUS-dossiers restent utilisables : c est la que travaille',
        '  #    quelqu un de normal, et les lui refuser rendrait l outil inutile.',
        '  if [ -n "${HOME:-}" ]; then',
        '    local home_canon=\'\'',
        '    home_canon="$(kjemo_canoniser "${HOME}")" || home_canon=\'\'',
        '    if [ -n "${home_canon}" ] && [ "${canon}" = "${home_canon}" ]; then',
        '      KJEMO_ZONE=\'racine du dossier personnel\'',
        '      return 1',
        '    fi',
        '  fi',
        '  if [ "${canon}" = \'/home\' ]; then',
        '    KJEMO_ZONE=\'racine des dossiers personnels\'',
        '    return 1',
        '  fi',
        '',
        '  KJEMO_CHEMIN_CANON="${canon}"',
        '  return 0',
        '}',
      ]),
    '',
    '# Refuse et explique, en nommant la zone. Le role dit a quoi servait le',
    '# chemin, pour qu on sache lequel des champs corriger.',
    'kjemo_exiger_chemin_sur() {',
    '  local brut="${1:-}" role="${2:-chemin}"',
    '  if kjemo_chemin_sur "${brut}" "${role}"; then',
    '    return 0',
    '  fi',
    '  printf \'ARRET : %s refuse.\\n\' "${role}" >&2',
    '  printf \'  Chemin demande : %s\\n\' "${brut}" >&2',
    '  printf \'  Zone protegee detectee : %s\\n\' "${KJEMO_ZONE}" >&2',
    '  printf \'\\n\' >&2',
    '  printf \'Ce refus est delibere. Choisis un chemin hors des zones systeme\\n\' >&2',
    '  printf \'et hors des dossiers techniques (.git, .ssh, .env).\\n\' >&2',
    '  exit 1',
    '}',
    '',
  ];
}

/**
 * Sauvegarde vérifiée d'un fichier, AVANT toute écriture.
 *
 * Trois propriétés, et la troisième est celle qu'on oublie :
 *   1. la copie conserve les permissions et le propriétaire (`cp -p`) — une
 *      sauvegarde de sshd_config restaurée en 0644 serait refusée par sshd ;
 *   2. la copie est RELUE et comparée à l'original (`cmp`) ;
 *   3. si la comparaison échoue, le script s'arrête AVANT d'écrire.
 *
 * Une sauvegarde qu'on n'a pas vérifiée n'est pas une sauvegarde, c'est une
 * intention. Et une intention ne restaure rien à trois heures du matin.
 */
export function blocSauvegardeFichier() {
  return [
    '# ---------------------------------------------------------------------------',
    '# SAUVEGARDE VERIFIEE',
    '#',
    '# cp -p conserve permissions et proprietaire : une sauvegarde de',
    '# sshd_config restauree en 0644 serait refusee par sshd, et on decouvrirait',
    '# le probleme au pire moment.',
    '#',
    '# La copie est RELUE et comparee a l original. Si la comparaison echoue, le',
    '# script s arrete AVANT d ecrire : une sauvegarde non verifiee n est pas une',
    '# sauvegarde, c est une intention.',
    '# ---------------------------------------------------------------------------',
    'KJEMO_SAUVEGARDE=\'\'',
    'kjemo_sauvegarder() {',
    '  local source="${1:-}"',
    '  if [ ! -f "${source}" ]; then',
    '    printf \'ARRET : %s est introuvable, rien a sauvegarder ni a modifier.\\n\' \\',
    '      "${source}" >&2',
    '    exit 1',
    '  fi',
    '  local horodatage=\'\'',
    '  horodatage="$(date +%Y%m%d-%H%M%S)"',
    '  local cible="${source}.kjemo-${horodatage}.bak"',
    '  if [ -e "${cible}" ]; then',
    '    printf \'ARRET : la sauvegarde %s existe deja. Rien n a ete modifie.\\n\' \\',
    '      "${cible}" >&2',
    '    exit 1',
    '  fi',
    '  if ! cp -p -- "${source}" "${cible}"; then',
    '    printf \'ARRET : la sauvegarde de %s a echoue. Rien n a ete modifie.\\n\' \\',
    '      "${source}" >&2',
    '    exit 1',
    '  fi',
    '  # La verification, et non la confiance.',
    '  if ! cmp -s -- "${source}" "${cible}"; then',
    '    printf \'ARRET : la sauvegarde %s differe de l original. Rien n a ete\\n\' \\',
    '      "${cible}" >&2',
    '    printf \'modifie. Verifie l espace disque et les permissions.\\n\' >&2',
    '    exit 1',
    '  fi',
    '  KJEMO_SAUVEGARDE="${cible}"',
    '  printf \'Sauvegarde verifiee : %s\\n\' "${cible}"',
    '}',
    '',
    '# Restauration : la procedure d annulation, ecrite dans le script meme,',
    '# pour qu elle soit sous les yeux de celui qui en a besoin.',
    'kjemo_restaurer() {',
    '  local cible="${1:-}"',
    '  if [ -z "${KJEMO_SAUVEGARDE}" ] || [ ! -f "${KJEMO_SAUVEGARDE}" ]; then',
    '    printf \'Aucune sauvegarde disponible : rien a restaurer.\\n\' >&2',
    '    return 1',
    '  fi',
    '  cp -p -- "${KJEMO_SAUVEGARDE}" "${cible}"',
    '  printf \'Restaure depuis %s\\n\' "${KJEMO_SAUVEGARDE}"',
    '}',
    '',
  ];
}

/**
 * Confirmation par phrase SPÉCIFIQUE.
 *
 * Pas « tape oui ». Une phrase qui nomme l'action et la cible, pour qu'un
 * copier-coller distrait depuis un autre terminal ne la valide pas, et pour
 * qu'on ne puisse pas confirmer sans avoir lu ce qu'on confirme.
 *
 * La confirmation est fournie par le FORMULAIRE, donc figée dans le script
 * généré. Elle est donc relue par celui qui relit l'aperçu — ce qui est le
 * but. Le script ne lit rien sur l'entrée standard : un script qui pose une
 * question est un script qui bloque quand on le lance depuis cron.
 */
export function blocConfirmation({ phraseAttendue, variableSaisie, action }) {
  return [
    '# ---------------------------------------------------------------------------',
    '# CONFIRMATION',
    '#',
    '# La phrase attendue NOMME l action et la cible : un "oui" se tape sans',
    '# lire, une phrase precise ne se tape pas par distraction.',
    '#',
    '# Elle vient du formulaire, donc elle est figee dans ce script : relis-la',
    '# dans l apercu. Le script ne lit rien sur l entree standard, pour pouvoir',
    '# etre lance sans terminal interactif.',
    '# ---------------------------------------------------------------------------',
    `if [ "\${${variableSaisie}}" != ${shQuote(phraseAttendue)} ]; then`,
    `  printf 'ARRET : la confirmation ne correspond pas.\\n' >&2`,
    `  printf 'Action demandee : %s\\n' ${shQuote(action)} >&2`,
    `  printf 'Phrase attendue : %s\\n' ${shQuote(phraseAttendue)} >&2`,
    '  printf \'Rien n a ete modifie.\\n\' >&2',
    '  exit 1',
    'fi',
    '',
  ];
}

/**
 * Porte de validation : une commande de contrôle doit réussir avant qu'une
 * configuration soit appliquée ou rechargée.
 *
 * C'est le motif le plus important du lot pour Samba, NFS et SSH. `testparm`
 * et `sshd -t` existent précisément pour dire « cette configuration est
 * syntaxiquement valide » AVANT qu'on recharge le service. Recharger d'abord
 * et regarder ensuite, c'est se couper l'accès au serveur par SSH, ou rendre
 * tous les partages inaccessibles, pour une virgule.
 *
 * La sortie de la commande de contrôle est affichée EN ENTIER en cas d'échec :
 * c'est elle qui dit quelle ligne est fautive.
 */
export function blocPorteValidation({ titre, commande, fichier, consequence }) {
  return [
    '# ---------------------------------------------------------------------------',
    `# PORTE DE VALIDATION : ${titre}`,
    '#',
    '# La validation passe AVANT l application. Appliquer d abord et regarder',
    `# ensuite, c est ${consequence}`,
    '# pour une virgule.',
    '# ---------------------------------------------------------------------------',
    'kjemo_valider_configuration() {',
    `  local cible="\${1:-${fichier}}"`,
    '  local sortie=\'\' code=0',
    `  sortie="$(${commande} 2>&1)" || code=$?`,
    '  if [ "${code}" -ne 0 ]; then',
    `    printf 'ARRET : la validation a echoue (%s).\\n' ${shQuote(titre)} >&2`,
    '    printf \'Fichier controle : %s\\n\' "${cible}" >&2',
    // printf refuse un format qui COMMENCE par -- : il le prend pour une
    // option. D ou le '%s\\n' systematique pour tout texte litteral, qui a de
    // plus l avantage de ne pas interpreter un % present dans le texte.
    '    printf \'%s\\n\' \'--- sortie complete de la commande de controle ---\' >&2',
    '    printf \'%s\\n\' "${sortie}" >&2',
    '    printf \'%s\\n\' \'--------------------------------------------------\' >&2',
    '    printf \'Rien n a ete applique ni recharge.\\n\' >&2',
    '    return 1',
    '  fi',
    `  printf 'Validation reussie : %s\\n' ${shQuote(titre)}`,
    '  return 0',
    '}',
    '',
  ];
}

/**
 * Capture de l'état d'une unité systemd, puis relecture après action.
 *
 * Le verdict ne repose JAMAIS sur le code de retour de `systemctl start` : il
 * dit que la commande a été acceptée, pas que le service tourne. Un service
 * qui démarre puis meurt en deux secondes fait réussir `systemctl start` et
 * laisse la machine en panne. On relit donc l'état, après une pause, et c'est
 * la relecture qui décide.
 */
export function blocEtatService() {
  return [
    '# ---------------------------------------------------------------------------',
    '# ETAT D UNE UNITE SYSTEMD : capture, action, RELECTURE',
    '#',
    '# Le verdict ne repose jamais sur le code de retour de systemctl : il dit',
    '# que la commande a ete ACCEPTEE, pas que le service TOURNE. Un service qui',
    '# demarre puis meurt en deux secondes fait reussir "systemctl start" et',
    '# laisse la machine en panne. C est la relecture qui decide.',
    '# ---------------------------------------------------------------------------',
    'kjemo_etat_unite() {',
    '  local unite="${1:-}"',
    '  local actif=\'inconnu\' active=\'inconnu\'',
    '  actif="$(systemctl is-active -- "${unite}" 2>/dev/null || true)"',
    '  active="$(systemctl is-enabled -- "${unite}" 2>/dev/null || true)"',
    '  printf \'%s|%s\' "${actif:-inconnu}" "${active:-inconnu}"',
    '}',
    '',
    'kjemo_relire_unite() {',
    '  local unite="${1:-}" attendu="${2:-}" etiquette="${3:-apres action}"',
    '  # Une pause courte : un service peut etre "activating" juste apres la',
    '  # commande, et le declarer en panne a cet instant serait un faux negatif.',
    '  sleep 2',
    '  local etat=\'\'',
    '  etat="$(systemctl is-active -- "${unite}" 2>/dev/null || true)"',
    '  if [ "${etat}" = "${attendu}" ]; then',
    '    kjemo_resultat \'Service\' "${unite} ${etiquette}" \'OK\' "${etat}" \\',
    '      "Etat attendu (${attendu}) confirme par relecture."',
    '    return 0',
    '  fi',
    '  kjemo_resultat \'Service\' "${unite} ${etiquette}" \'PROBLEME\' "${etat:-inconnu}" \\',
    '    "Etat attendu ${attendu}, etat relu ${etat:-inconnu}. L action n a PAS eu l effet annonce."',
    '  printf \'\\n--- journal des dernieres lignes de %s ---\\n\' "${unite}"',
    '  journalctl -u "${unite}" -n 20 --no-pager 2>/dev/null || \\',
    '    printf \'(journal illisible sans privileges)\\n\'',
    '  return 1',
    '}',
    '',
  ];
}
