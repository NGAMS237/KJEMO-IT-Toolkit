/**
 * cours-fiches-formatifs.mjs — KJEMO-UX-ACCUEIL-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiches ajoutées après comparaison avec les corrigés des formatifs 1 et 2 du
 * professeur : le MENU Bash (while + case + fonctions), le script du TP2 sous
 * forme de menu, et les droits d'un fichier en octal (chmod). Même niveau que
 * les corrigés : rien de plus avancé que ce qu'ils montrent.
 *
 * Les scripts viennent de cours-scripts-menu.mjs : le texte affiché est le texte
 * exécuté par test/cours-menu.test.mjs. Rédigées à la main ; rien n'est exécuté
 * par le Toolkit.
 */
import { MAN, BASH_REF, lec, mod, des, sh, ficheLinux } from './cours-outils.mjs';
import { SCRIPT_MENU_UTILISATEURS_LIGNES, SCRIPT_MENU_COMPTES_SAMBA_LIGNES } from './cours-scripts-menu.mjs';

const SAMBA_DOC = 'https://www.samba.org/samba/docs/current/man-html';

export const COURS_FORMATIFS = [
  ficheLinux({
    id: 'cours-bash-menu',
    titre: 'Écrire un menu en Bash : while, case et fonctions',
    resume: 'Crée un script à menu : une boucle while redessine le menu, un case aiguille selon le choix, des fonctions (pause, saisie) évitent les répétitions. Modèle du formatif 2 (question 5). Ne modifie que son propre fichier.',
    effet: 'modification',
    intentions: ['menu bash', 'script bash avec menu', 'while case bash menu', 'fonction pause bash', 'menu interactif linux', 'formatif 2 question 5'],
    motsCles: ['bash', 'menu', 'while', 'case', 'function', 'read', 'pause', 'clear', 'grep', 'id', 'formatif'],
    params: [{ id: 'script', label: 'nom du script', type: 'arg', exemple: 'menu.sh', aide: 'Créé dans le dossier courant ; remplace un fichier du même nom.' }],
    privileges: 'Utilisateur ordinaire.',
    etapes: [
      mod('Écrire le script du menu', 'Trois idées : (1) une FONCTION regroupe des lignes qu’on réutilise (pause, saisir_utilisateur) ; (2) « while [ "$rep" -eq 1 ] » répète le menu tant que la variable rep vaut 1 ; (3) « case "$choix" in … esac » choisit quoi faire selon la touche tapée, le « *) » attrapant tout le reste. Choisir 3 met rep à 0 : la boucle s’arrête.', [
        sh('cat > {{script}} <<\'EOF\''),
        ...SCRIPT_MENU_UTILISATEURS_LIGNES.map((l) => sh(l)),
        sh('EOF'),
      ], 'Aucun message : le fichier est créé.', { important: 'Si le script existait déjà, il est remplacé. « grep "^$util:" » cherche le nom au début d’une ligne de /etc/passwd ; un nom contenant des caractères spéciaux donnerait un résultat trompeur (acceptable pour ce niveau).' }),
      mod('Le rendre exécutable', 'chmod +x ajoute le droit d’exécution ; sans lui, « ./script » répond « Permission non accordée ».', [sh('chmod +x {{script}}')], 'Aucun message.'),
      lec('L’exécuter et essayer chaque choix', 'Tape 1 puis « root », Entrée ; 1 puis un nom inventé ; 2 puis « root » ; un choix invalide (7) ; enfin 3 pour quitter.', [sh('./{{script}}')], 'Le menu s’affiche. « L’utilisateur root existe », « n’existe pas » pour le nom inventé, la ligne « uid=0(root) … » pour le choix 2, « Choix invalide » pour 7, « Au revoir » pour 3.', { verification: true, interactions: [{ attend: 'Menu :', reponds: 'Un numéro (1, 2 ou 3) puis Entrée ; après chaque action, Entrée pour revenir au menu.' }] }),
    ],
    verification: ['Chaque choix du menu fait ce qu’il annonce et le choix 3 quitte proprement.'],
    retour: 'rm supprime le script.',
    sources: [{ label: 'Bash — case', url: `${BASH_REF}#Conditional-Constructs` }, { label: 'Bash — while', url: `${BASH_REF}#Looping-Constructs` }, { label: 'Bash — fonctions', url: `${BASH_REF}#Shell-Functions` }],
  }),

  ficheLinux({
    id: 'cours-samba-script-menu',
    titre: 'TP2 A : le script à menu qui crée les comptes depuis le CSV',
    resume: 'Version DU NIVEAU DU COURS du script de la partie A : un menu (créer les comptes depuis le CSV, lister comptes, groupes, membres) construit avec des fonctions, while read et case, comme les formatifs. Le CSV reste local à la VM. Laboratoire isolé seulement.',
    effet: 'modification',
    intentions: ['script csv samba-tool menu', 'créer des utilisateurs depuis un csv niveau cours', 'menu bash samba', 'tp2 a2 script', 'tp2 a3 liste des comptes', 'tp2 a4 liste des groupes', 'script de création de comptes samba', 'while read csv samba'],
    motsCles: ['csv', 'script', 'bash', 'menu', 'while', 'read', 'IFS', 'case', 'samba-tool', 'user create', 'group addmembers', 'département'],
    params: [
      { id: 'csv', label: 'fichier CSV (sur la VM)', type: 'arg', exemple: 'comptes_tp2.csv', aide: 'Créé dans le dossier courant de la VM ; remplace un fichier du même nom.' },
      { id: 'script', label: 'nom du script', type: 'arg', exemple: 'menu_comptes.sh', aide: 'Créé dans le dossier courant ; remplace un fichier du même nom.' },
    ],
    privileges: 'Administrateur du contrôleur de domaine : sudo, pour lancer le script.',
    etapes: [
      mod('Écrire le MODÈLE public du CSV (valeurs fictives)', 'Crée le fichier avec des droits restrictifs (toi seul), puis y écrit un modèle : « login;motdepasse;departement », séparateur « ; », une ligne par compte, SANS guillemets. Les mots de passe « FICTIF-… » sont inventés : le script les refuse.', [
        sh('install -m 600 /dev/null {{csv}}'),
        sh('cat > {{csv}} <<\'EOF\''),
        sh('login;motdepasse;departement'),
        sh('chef_ventes;FICTIF-0001;Ventes_Marketing'),
        sh('employe_ventes;FICTIF-0002;Ventes_Marketing'),
        sh('chef_finance;FICTIF-0003;Finance'),
        sh('chef_ti;FICTIF-0004;Technologies_Information'),
        sh('directeur;FICTIF-0005;Direction'),
        sh('EOF'),
      ], 'Aucun message : le fichier existe, droits -rw-------.', { important: 'Ce fichier ne sert qu’à voir le FORMAT. Le CSV avec les vrais comptes reste sur ta VM : il ne se copie nulle part ailleurs (ni chat, ni dépôt, ni site).' }),
      mod('Mettre tes vrais comptes dans le CSV — sur la VM seulement', 'Ouvre le fichier dans nano et remplace les lignes du modèle par les comptes et les mots de passe de ton énoncé, tapés dans l’éditeur de la VM. Garde les fins de ligne Linux (n’importe pas le fichier depuis Windows).', [sh('nano {{csv}}')], 'Le fichier contient tes comptes ; plus aucun « FICTIF- ».', {
        interactions: [{ attend: 'Éditeur nano ouvert', reponds: 'Remplace les lignes, Ctrl+O puis Entrée pour enregistrer, Ctrl+X pour quitter.' }],
        important: 'Un mot de passe doit respecter la politique de complexité du domaine, sinon samba-tool refuse le compte : le script écrit « ÉCHEC » pour cette ligne et continue. En entreprise, on ne stocke pas de mots de passe en clair.',
      }),
      mod('Écrire le script à menu', 'Chaque choix du menu appelle une fonction. « creer_comptes » lit le CSV avec « while IFS=\';\' read -r login mdp dept » : IFS=\';\' dit que le séparateur est le point-virgule, et read range les trois champs dans trois variables. Pour chaque ligne : le groupe du département est créé (si le groupe existe déjà, l’erreur est cachée par « 2>/dev/null »), puis le compte, puis son ajout au groupe, chaque étape annoncée par un « if » qui écrit réussite ou ÉCHEC avec la raison donnée par samba-tool. Le fichier est lu sur le descripteur 3 (« read -u 3 », « done 3< fichier ») et les commandes samba-tool reçoivent « < /dev/null » : sans cela, une commande qui lit le clavier avalerait le reste du CSV et seule la première ligne serait traitée.', [
        sh('cat > {{script}} <<\'EOF\''),
        ...SCRIPT_MENU_COMPTES_SAMBA_LIGNES.map((l) => sh(l)),
        sh('EOF'),
      ], 'Aucun message : le fichier est créé.', { important: 'Limites du niveau cours : le mot de passe est passé en argument à samba-tool (visible un court instant dans la liste des processus : laboratoire isolé seulement) ; le script ne gère pas les guillemets dans le CSV (les fins de ligne Windows et l’absence de retour à la ligne final sont tolérées). La ligne d’en-tête « login;… » est sautée. Une ligne à moins de 3 champs est ignorée. La version renforcée (essai sans écriture, contrôles) se trouve dans la fiche « version renforcée ».' }),
      mod('Rendre le script exécutable', 'Ajoute le droit d’exécution.', [sh('chmod +x {{script}}')], 'Aucun message.'),
      mod('Lancer le menu et choisir 1 : créer les comptes', 'Le script demande le nom du fichier CSV (tape-le tel qu’à l’étape 1), puis crée groupes, comptes et appartenances. Un compte qui existe déjà est signalé « ÉCHEC » avec le message de samba-tool, sans rien casser : relancer est sans danger.', [sh('sudo ./{{script}}')], 'Pour chaque ligne : « Compte créé : … » puis « ajouté au groupe … ». Les lignes en échec disent pourquoi.', { interactions: [{ attend: 'Menu - comptes Samba :', reponds: 'Tape 1, Entrée, le nom du fichier CSV, Entrée ; puis Entrée pour revenir au menu.' }] }),
      lec('Contrôler : comptes, groupes et membres (choix 2, 3, 4)', 'Les captures demandées par le sujet : liste des comptes (2), liste des groupes (3), membres d’un département (4, puis son nom). Quitte avec 5.', [sh('sudo ./{{script}}')], 'Les logins du CSV dans la liste des comptes, les départements dans la liste des groupes, les membres du département choisi.', { verification: true, interactions: [{ attend: 'Menu - comptes Samba :', reponds: '2, Entrée (comptes) ; 3, Entrée (groupes) ; 4, Entrée, le nom d’un département (membres) ; 5 pour quitter.' }] }),
      des('Supprimer le CSV après le laboratoire', 'Le fichier contient des mots de passe en clair : on le retire quand le laboratoire est fini. shred écrase puis supprime ; supprime aussi les copies et les instantanés de la VM.', [sh('shred -u {{csv}}')], 'Le fichier n’existe plus (ls renvoie « No such file »).', { facultatif: true }),
    ],
    verification: ['Chaque login du CSV apparaît dans « Lister les comptes » et dans les membres de son département.'],
    retour: 'samba-tool user delete suivi du login supprime un compte ; samba-tool group delete suivi du groupe supprime un groupe. Supprime aussi le CSV et le script.',
    sources: [{ label: 'samba-tool', url: `${SAMBA_DOC}/samba-tool.8.html` }, { label: 'Bash — while, read, IFS', url: `${BASH_REF}#Looping-Constructs` }, { label: 'Bash — case', url: `${BASH_REF}#Conditional-Constructs` }],
  }),

  ficheLinux({
    id: 'cours-droits-fichier',
    titre: 'Lire et changer les droits d’un fichier : ls -l, chmod',
    resume: 'Crée un fichier d’essai, lit ses droits avec ls -l, les change avec chmod en notation octale (trois chiffres : propriétaire, groupe, autres) et constate l’effet. Formatif 1, script 2.',
    effet: 'modification',
    intentions: ['chmod linux', 'chmod 644', 'droits fichier linux', 'ls -l droits', 'permissions octal', 'formatif 1 chmod 150'],
    motsCles: ['chmod', 'ls', 'droits', 'permissions', 'octal', 'rwx', 'propriétaire', 'groupe'],
    params: [
      { id: 'fichier', label: 'fichier d’essai', type: 'arg', exemple: 'fichierTest1', aide: 'Créé dans le dossier courant ; un fichier existant du même nom garde son contenu.' },
      { id: 'mode', label: 'droits en octal', type: 'choix', choix: ['600', '640', '644', '750', '755', '150'], exemple: '640', aide: 'Trois chiffres : propriétaire, groupe, autres. 4 = lire, 2 = écrire, 1 = exécuter ; on additionne (6 = 4+2, 5 = 4+1).' },
    ],
    privileges: 'Utilisateur ordinaire, dans un dossier où tu as le droit d’écrire.',
    etapes: [
      mod('Créer le fichier d’essai', 'touch crée un fichier vide s’il n’existe pas.', [sh('touch {{fichier}}')], 'Aucun message.'),
      lec('Lire les droits actuels', 'ls -l affiche dix caractères au début de la ligne : le premier donne le type (- fichier, d dossier), puis trois groupes de trois : propriétaire, groupe, autres (r lire, w écrire, x exécuter, - rien).', [sh('ls -l {{fichier}}')], 'Une ligne comme « -rw-r--r-- 1 toi toi 0 … fichier » : droits 644.'),
      mod('Changer les droits', 'chmod suivi de trois chiffres fixe les droits d’un coup. 640 : le propriétaire lit et écrit, le groupe lit, les autres n’ont rien. 150 : le propriétaire exécute seulement, le groupe lit et exécute, les autres rien (un cas du formatif).', [sh('chmod {{mode}} {{fichier}}')], 'Aucun message en cas de succès.', { options: [{ option: 'chiffres', explication: '4 = lire (r), 2 = écrire (w), 1 = exécuter (x). Premier chiffre : propriétaire ; deuxième : groupe ; troisième : tous les autres.' }] }),
      lec('Vérifier', 'Relis les droits : les dix caractères ont changé.', [sh('ls -l {{fichier}}')], 'Les lettres rwx correspondent aux chiffres choisis (640 : -rw-r-----).', { verification: true }),
      lec('Constater l’effet', 'Essaie de lire le fichier : si le propriétaire n’a pas le droit r (150, par exemple), le système refuse, même pour toi.', [sh('cat {{fichier}}')], 'Rien (le fichier est vide) ou « Permission non accordée » selon le mode choisi.'),
    ],
    verification: ['ls -l affiche les droits correspondant aux trois chiffres choisis.'],
    retour: 'chmod 644 remet un réglage ordinaire ; rm supprime le fichier d’essai.',
    sources: [{ label: 'chmod(1)', url: `${MAN}/man1/chmod.1.html` }, { label: 'ls(1)', url: `${MAN}/man1/ls.1.html` }],
  }),
];
