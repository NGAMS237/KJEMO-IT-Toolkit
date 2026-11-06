/**
 * cours-script-import.mjs — KJEMO-COURS-TP2-01-R1 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Script Bash du TP2 (question A4) : lit un CSV « login;motdepasse;departement »
 * et crée groupes, comptes et appartenances avec samba-tool.
 *
 * Écrit à la main, relu avec shellcheck, et exécuté par test/cours-import.test.mjs
 * contre un FAUX samba-tool (aucun domaine réel). Le test relit CES lignes : le
 * script affiché dans la fiche est exactement celui qui est testé.
 *
 * Comportement :
 *  - -n : essai ; ne modifie rien ; seules des lectures samba-tool sont faites.
 *  - Séparateur « ; ». Guillemets NON pris en charge (ligne rejetée) : un CSV
 *    avec champs entre guillemets n'est pas géré.
 *  - En-tête facultatif ; fins de ligne CRLF, BOM UTF-8, lignes vides tolérés.
 *  - Lignes invalides ou doublons rejetés (numéro de ligne affiché, jamais le
 *    contenu : il contient un mot de passe). Compte ou groupe existant : signalé,
 *    jamais modifié.
 *  - Chaque commande samba-tool est vérifiée (code de retour + relecture).
 *  - Les mots de passe sont masqués dans les messages d'erreur.
 *  - Mots de passe « FICTIF- » du modèle public refusés à l'application.
 *  - Codes de sortie : 0 tout va bien ; 1 erreur d'usage ou de système ; 2 au
 *    moins une ligne rejetée ou en échec.
 *  - Limite connue : samba-tool reçoit le mot de passe en argument (visible un
 *    court instant dans la liste des processus) ; acceptable en laboratoire isolé.
 */
export const SCRIPT_IMPORT_LIGNES = [
  "#!/bin/bash",
  "usage() {",
  "  echo \"usage : $0 [-n] fichier.csv\"",
  "  echo \"  -n  essai : lit et vérifie le fichier, ne modifie rien\"",
  "  echo \"  format : login;motdepasse;departement (une ligne par compte, sans guillemets)\"",
  "}",
  "essai=0",
  "while getopts \"n\" opt; do",
  "  case \"$opt\" in",
  "    n) essai=1 ;;",
  "    *) usage; exit 1 ;;",
  "  esac",
  "done",
  "shift $((OPTIND - 1))",
  "fichier=\"${1:-}\"",
  "if [ -z \"$fichier\" ] || [ ! -f \"$fichier\" ] || [ ! -r \"$fichier\" ]; then",
  "  usage",
  "  exit 1",
  "fi",
  "if ! command -v samba-tool >/dev/null 2>&1; then",
  "  echo \"erreur : samba-tool introuvable (lance ce script sur le contrôleur de domaine)\"",
  "  exit 1",
  "fi",
  "perm=$(stat -c %a \"$fichier\")",
  "if [ \"${perm: -2}\" != \"00\" ]; then",
  "  if [ \"$essai\" -eq 0 ]; then",
  "    echo \"erreur : $fichier est lisible par d'autres comptes (droits $perm). Lance : chmod 600 $fichier\"",
  "    exit 1",
  "  fi",
  "  echo \"avertissement : $fichier est lisible par d'autres comptes (droits $perm) ; chmod 600 $fichier\"",
  "fi",
  "comptes=$(samba-tool user list </dev/null 2>/dev/null) || { echo \"erreur : samba-tool user list a échoué (lance le script avec sudo)\"; exit 1; }",
  "groupes=$(samba-tool group list </dev/null 2>/dev/null) || { echo \"erreur : samba-tool group list a échoué (lance le script avec sudo)\"; exit 1; }",
  "re_entete='^login;mot[ _]?de[ _]?passe;d[eé]partement$'",
  "re_login='^[a-z][a-z0-9_.-]{0,19}$'",
  "re_dept='^[A-Za-z][A-Za-z0-9_]{0,63}$'",
  "declare -A vus",
  "declare -A groupe_ko",
  "n=0; lues=0; crees=0; sans_groupe=0; groupes_crees=0; ignores=0; rejetees=0; echecs=0",
  "vu_premiere=0",
  "rejeter() { rejetees=$((rejetees + 1)); echo \"ligne $n rejetée : $1\"; }",
  "echec() { echecs=$((echecs + 1)); echo \"ÉCHEC : $1\"; }",
  "masquer() { printf '%s' \"${1//\"$mdp\"/***}\"; }",
  "while IFS= read -r ligne || [ -n \"$ligne\" ]; do",
  "  n=$((n + 1))",
  "  ligne=\"${ligne%$'\\r'}\"",
  "  if [ \"$n\" -eq 1 ]; then ligne=\"${ligne#$'\\xef\\xbb\\xbf'}\"; fi",
  "  if [ -z \"${ligne//[[:space:]]/}\" ]; then continue; fi",
  "  if [ \"$vu_premiere\" -eq 0 ]; then",
  "    vu_premiere=1",
  "    minuscule=\"${ligne,,}\"",
  "    if [[ \"$minuscule\" =~ $re_entete ]]; then continue; fi",
  "  fi",
  "  lues=$((lues + 1))",
  "  if [[ \"$ligne\" == *\\\"* ]]; then rejeter \"guillemets non pris en charge\"; continue; fi",
  "  sep=\"${ligne//[^;]/}\"",
  "  if [ \"${#sep}\" -ne 2 ]; then rejeter \"il faut exactement 3 champs séparés par « ; »\"; continue; fi",
  "  IFS=';' read -r login mdp dept <<< \"$ligne\"",
  "  if ! [[ \"$login\" =~ $re_login ]]; then rejeter \"login invalide (minuscules, chiffres, _ . -, 20 caractères au plus)\"; continue; fi",
  "  if ! [[ \"$dept\" =~ $re_dept ]]; then rejeter \"département invalide pour $login (lettres, chiffres, _ ; ni espace ni accent)\"; continue; fi",
  "  if [ -z \"$mdp\" ]; then rejeter \"mot de passe vide pour $login\"; continue; fi",
  "  if [ -n \"${vus[${login,,}]:-}\" ]; then rejeter \"login en double : $login (la première ligne est conservée)\"; continue; fi",
  "  vus[${login,,}]=$n",
  "  modele=0",
  "  if [[ \"$mdp\" == FICTIF-* ]]; then modele=1; fi",
  "  if [ \"$modele\" -eq 1 ] && [ \"$essai\" -eq 0 ]; then rejeter \"$login porte le mot de passe du modèle fictif : utilise ton CSV local\"; continue; fi",
  "  if grep -qixF -- \"$login\" <<< \"$comptes\"; then",
  "    ignores=$((ignores + 1))",
  "    echo \"existe déjà : $login ignoré, rien n'est modifié (ni mot de passe ni groupe)\"",
  "    continue",
  "  fi",
  "  if [ -n \"${groupe_ko[$dept]:-}\" ]; then echec \"groupe $dept indisponible : compte $login non créé\"; continue; fi",
  "  if ! grep -qixF -- \"$dept\" <<< \"$groupes\"; then",
  "    if [ \"$essai\" -eq 1 ]; then",
  "      echo \"ESSAI : créerait le groupe $dept\"",
  "    else",
  "      sortie=$(samba-tool group add \"$dept\" </dev/null 2>&1); rc=$?",
  "      if [ \"$rc\" -ne 0 ]; then groupe_ko[$dept]=1; echec \"création du groupe $dept (code $rc) : $(masquer \"$sortie\")\"; continue; fi",
  "      if ! samba-tool group list </dev/null 2>/dev/null | grep -qixF -- \"$dept\"; then groupe_ko[$dept]=1; echec \"groupe $dept absent de la liste après création\"; continue; fi",
  "      echo \"groupe créé : $dept\"",
  "    fi",
  "    groupes_crees=$((groupes_crees + 1))",
  "    groupes=\"$groupes\"$'\\n'\"$dept\"",
  "  fi",
  "  if [ \"$essai\" -eq 1 ]; then",
  "    echo \"ESSAI : créerait le compte $login dans le groupe $dept\"",
  "    if [ \"$modele\" -eq 1 ]; then echo \"ESSAI : $login porte un mot de passe du modèle fictif (refusé à l'application)\"; fi",
  "    crees=$((crees + 1))",
  "    continue",
  "  fi",
  "  sortie=$(samba-tool user create \"$login\" \"$mdp\" </dev/null 2>&1); rc=$?",
  "  if [ \"$rc\" -ne 0 ]; then echec \"création du compte $login (code $rc) : $(masquer \"$sortie\")\"; continue; fi",
  "  if ! samba-tool user list </dev/null 2>/dev/null | grep -qixF -- \"$login\"; then echec \"compte $login absent de la liste après création\"; continue; fi",
  "  sortie=$(samba-tool group addmembers \"$dept\" \"$login\" </dev/null 2>&1); rc=$?",
  "  if [ \"$rc\" -ne 0 ]; then sans_groupe=$((sans_groupe + 1)); echec \"compte $login créé mais NON ajouté au groupe $dept (code $rc) : $(masquer \"$sortie\")\"; continue; fi",
  "  if ! samba-tool group listmembers \"$dept\" </dev/null 2>/dev/null | grep -qixF -- \"$login\"; then sans_groupe=$((sans_groupe + 1)); echec \"$login absent des membres de $dept après ajout\"; continue; fi",
  "  crees=$((crees + 1))",
  "  echo \"créé : $login dans le groupe $dept\"",
  "done < \"$fichier\"",
  "if [ \"$lues\" -eq 0 ]; then echo \"erreur : aucune ligne de compte exploitable dans $fichier\"; exit 1; fi",
  "echo \"----\"",
  "if [ \"$essai\" -eq 1 ]; then",
  "  echo \"ESSAI terminé : rien n'a été modifié.\"",
  "  echo \"Résumé : $lues lignes lues, $crees comptes à créer, $groupes_crees groupes à créer, $ignores déjà existants, $rejetees rejetées.\"",
  "else",
  "  echo \"Résumé : $lues lignes lues, $crees comptes créés, $groupes_crees groupes créés, $ignores déjà existants, $rejetees rejetées, $echecs échecs (dont $sans_groupe comptes créés sans groupe).\"",
  "fi",
  "if [ $((rejetees + echecs)) -gt 0 ]; then exit 2; fi",
  "exit 0",
];

export const SCRIPT_IMPORT = SCRIPT_IMPORT_LIGNES.join("\n") + "\n";
