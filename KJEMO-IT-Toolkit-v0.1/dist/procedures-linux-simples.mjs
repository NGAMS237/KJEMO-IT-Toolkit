/**
 * procedures-linux-simples.mjs — KJEMO-LINUX-SIMPLES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Commandes de traitement de texte qui manquaient à l'aide-mémoire Linux et que
 * le TP2 rend nécessaires : remplacer du texte avec sed -i (copie de sécurité
 * .bak), afficher ou supprimer des lignes, vérifier le format d'un CSV
 * (séparateur, nombre de colonnes, fins de ligne), extraire une colonne,
 * corriger les fins de ligne Windows. Même contrat que les autres fiches ;
 * rien n'est exécuté par le Toolkit. Les valeurs saisies sont validées : aucun
 * caractère spécial de l'interpréteur (le séparateur est un CHOIX fermé).
 */
import { lec, mod, des, gui, sh, MAN, CATEGORIE_LINUX, V_COURS } from './cours-outils.mjs';

const SED = 'https://www.gnu.org/software/sed/manual/sed.html';
const FICHIER = { id: 'fichier', label: 'fichier à traiter', type: 'arg', exemple: 'comptes_tp2.csv', aide: 'Un fichier texte existant, dans le dossier courant ou avec son chemin.' };
const SEP = { id: 'sep', label: 'séparateur de colonnes', type: 'choix', choix: [';', ',', ':', '|'], exemple: ';', aide: 'Le caractère qui sépare les colonnes. Le TP2 utilise le point-virgule.' };

function fiche({ id, titre, resume, effet, intentions, motsCles, params = [], etapes, verification, retour = null, sources, privileges = 'Utilisateur ordinaire, avec le droit d’écrire dans le dossier du fichier.' }) {
  return {
    id, titre, categorie: CATEGORIE_LINUX, resume, effet, intentions, motsCles, params,
    origine: 'memo',
    methodes: [{ id: 'linux', privileges, etapes, verification, retour }],
    assistant: null, sources, validation: V_COURS,
  };
}

export const PROCEDURES_LINUX_SIMPLES = [
  fiche({
    id: 'linux-sed-remplacer', titre: 'Remplacer du texte dans un fichier (sed -i)', effet: 'modification',
    resume: 'Remplace un mot par un autre dans tout un fichier avec sed. Un aperçu s’affiche d’abord, et une copie de sécurité (.bak) est conservée pour revenir en arrière.',
    intentions: ['sed -i', 'remplacer un mot dans un fichier linux', 'rechercher et remplacer dans un fichier', 'changer un mot de passe dans le csv avec sed', 'sed s/ancien/nouveau/g'],
    motsCles: ['sed', 'remplacer', 'substitution', 'fichier', 'texte', 'csv', 'bak'],
    params: [FICHIER,
      { id: 'ancien', label: 'texte à remplacer', type: 'identifiant', exemple: 'MDP0001', aide: 'Un mot sans espace. Le point « . » compte comme « n’importe quel caractère » dans sed.' },
      { id: 'nouveau', label: 'nouveau texte', type: 'identifiant', exemple: 'Mdp0001x', aide: 'Un mot sans espace.' }],
    etapes: [
      lec('Voir l’aperçu sans rien modifier', 'Sans l’option -i, sed écrit le résultat à l’écran et ne touche pas au fichier. diff montre les lignes qui changeraient (< avant, > après).', [sh('sed \'s/{{ancien}}/{{nouveau}}/g\' {{fichier}} | diff {{fichier}} -')], 'Les lignes qui vont changer. Aucune sortie : le texte n’existe pas dans le fichier.'),
      mod('Appliquer le remplacement', 's/ancien/nouveau/g remplace toutes les occurrences de chaque ligne. -i.bak modifie le fichier sur place ET garde l’original sous le nom fichier.bak.', [sh('sed -i.bak \'s/{{ancien}}/{{nouveau}}/g\' {{fichier}}')], 'Aucun message en cas de succès.', { important: 'Sans « .bak » collé à -i, aucune copie n’est gardée. Ne l’enlève pas tant que tu n’as pas vérifié le résultat.' }),
      lec('Vérifier', 'Compare l’original sauvegardé et le fichier modifié.', [sh('diff {{fichier}}.bak {{fichier}}')], 'Les mêmes lignes que dans l’aperçu.', { verification: true }),
    ],
    verification: ['diff entre le .bak et le fichier ne montre que les remplacements voulus.'],
    retour: 'mv fichier.bak fichier remet le fichier d’origine.',
    sources: [{ label: 'sed (manuel GNU)', url: SED }, { label: 'sed(1)', url: `${MAN}/man1/sed.1.html` }, { label: 'diff(1)', url: `${MAN}/man1/diff.1.html` }],
  }),
  fiche({
    id: 'linux-sed-lignes', titre: 'Afficher ou supprimer des lignes d’un fichier (sed)', effet: 'modification',
    resume: 'Affiche une plage de lignes ou seulement celles qui contiennent un mot, puis supprime celles-ci avec une copie de sécurité. Pratique pour retirer une ligne d’un CSV ou d’un fichier de configuration.',
    intentions: ['sed supprimer une ligne', 'afficher les lignes 3 à 7 d’un fichier', 'sed -n p', 'retirer les lignes qui contiennent un mot', 'sed /motif/d'],
    motsCles: ['sed', 'lignes', 'supprimer', 'afficher', 'plage', 'motif', 'csv'],
    params: [FICHIER,
      { id: 'debut', label: 'première ligne', type: 'entier', min: 1, max: 100000, exemple: '1', aide: 'Numéro de la première ligne à afficher.' },
      { id: 'fin', label: 'dernière ligne', type: 'entier', min: 1, max: 100000, exemple: '5', aide: 'Numéro de la dernière ligne à afficher.' },
      { id: 'motif', label: 'mot que les lignes contiennent', type: 'identifiant', exemple: 'FICTIF', aide: 'Un mot sans espace.' }],
    etapes: [
      lec('Afficher une plage de lignes', '-n supprime l’affichage automatique ; « 1,5p » n’imprime que les lignes 1 à 5.', [sh('sed -n \'{{debut}},{{fin}}p\' {{fichier}}')], 'Les lignes demandées.'),
      lec('Afficher les lignes qui contiennent le mot', 'Contrôle ce qui sera supprimé avant de le faire.', [sh('sed -n \'/{{motif}}/p\' {{fichier}}')], 'Les lignes qui contiennent le mot. Aucune : rien ne sera supprimé.'),
      mod('Supprimer ces lignes', '« /mot/d » supprime les lignes qui contiennent le mot. -i.bak modifie le fichier et garde l’original sous fichier.bak.', [sh('sed -i.bak \'/{{motif}}/d\' {{fichier}}')], 'Aucun message en cas de succès.', { important: 'Un mot trop court supprime beaucoup de lignes : regarde d’abord l’étape précédente.' }),
      lec('Vérifier', 'Compte les lignes avant et après.', [sh('wc -l {{fichier}}.bak {{fichier}}')], 'Le fichier modifié a moins de lignes que le .bak.', { verification: true }),
    ],
    verification: ['Le fichier ne contient plus aucune ligne avec le mot ; le .bak garde l’original.'],
    retour: 'mv fichier.bak fichier remet le fichier d’origine.',
    sources: [{ label: 'sed (manuel GNU)', url: SED }, { label: 'sed(1)', url: `${MAN}/man1/sed.1.html` }, { label: 'wc(1)', url: `${MAN}/man1/wc.1.html` }],
  }),
  fiche({
    id: 'linux-csv-verifier', titre: 'Vérifier le format d’un fichier CSV avant un script', effet: 'lecture',
    resume: 'Contrôle le séparateur, le nombre de colonnes de chaque ligne et les fins de ligne Windows. Répond à « pourquoi mon script ignore toutes mes lignes ? ». Lecture seule.',
    intentions: ['vérifier un csv', 'nombre de colonnes de chaque ligne', 'ligne ignorée il faut 3 champs', 'cat -A voir les caractères cachés', 'awk -F nf colonnes csv'],
    motsCles: ['csv', 'colonnes', 'séparateur', 'awk', 'cat -A', 'crlf', 'format', 'file'],
    params: [FICHIER, SEP,
      { id: 'ncol', label: 'nombre de colonnes attendu', type: 'entier', min: 1, max: 50, exemple: '3', aide: 'Trois pour login;motdepasse;departement.' }],
    etapes: [
      lec('Voir les caractères cachés', 'cat -A marque la fin de chaque ligne par « $ », une tabulation par « ^I » et un retour Windows par « ^M ». Les séparateurs doivent être ceux attendus.', [sh('head -3 {{fichier}} | cat -A')], 'Des lignes comme « chef_ventes;Mdp0001!;Ventes$ ». « ^M$ » en fin de ligne : fins de ligne Windows.'),
      lec('Compter les colonnes de chaque ligne', 'NF est le nombre de champs vu par awk avec ce séparateur. uniq -c regroupe les lignes qui ont le même nombre.', [sh('awk -F\'{{sep}}\' \'{print NF}\' {{fichier}} | sort | uniq -c')], 'Une seule ligne, par exemple « 14 3 » : 14 lignes de 3 colonnes. Plusieurs lignes : le fichier est irrégulier.'),
      lec('Repérer les lignes qui n’ont pas le bon nombre de colonnes', 'Affiche le numéro et le contenu de chaque ligne fautive.', [sh('awk -F\'{{sep}}\' \'NF != {{ncol}} {print NR ": " $0}\' {{fichier}}')], 'Aucune sortie : toutes les lignes sont bonnes. Sinon, la liste des lignes à corriger.', { verification: true }),
    ],
    verification: ['Chaque ligne a le nombre de colonnes attendu et aucun « ^M » n’apparaît.'],
    sources: [{ label: 'awk (manuel GNU)', url: 'https://www.gnu.org/software/gawk/manual/gawk.html' }, { label: 'cat(1)', url: `${MAN}/man1/cat.1.html` }, { label: 'uniq(1)', url: `${MAN}/man1/uniq.1.html` }],
  }),
  fiche({
    id: 'linux-csv-colonne', titre: 'Extraire une colonne d’un fichier CSV (cut)', effet: 'lecture',
    resume: 'Affiche une seule colonne d’un fichier à séparateurs, par exemple la liste des logins ou des départements. Utile pour contrôler un CSV ou comparer avec samba-tool user list.',
    intentions: ['cut -d -f', 'extraire une colonne d’un csv', 'afficher seulement les logins', 'lister les départements du csv', 'colonne d’un fichier texte linux'],
    motsCles: ['cut', 'colonne', 'csv', 'champ', 'séparateur', 'sort', 'uniq'],
    params: [FICHIER, SEP,
      { id: 'colonne', label: 'numéro de la colonne', type: 'entier', min: 1, max: 50, exemple: '1', aide: 'La première colonne porte le numéro 1.' }],
    etapes: [
      lec('Afficher la colonne', '-d donne le séparateur, -f le numéro de colonne.', [sh('cut -d\'{{sep}}\' -f{{colonne}} {{fichier}}')], 'Une valeur par ligne (l’en-tête comprise).'),
      lec('La même colonne sans doublons', 'Pratique pour la liste des départements : sort trie, uniq retire les doublons consécutifs.', [sh('cut -d\'{{sep}}\' -f{{colonne}} {{fichier}} | sort | uniq')], 'Chaque valeur une seule fois.', { verification: true }),
    ],
    verification: ['Les valeurs affichées sont celles de la colonne voulue.'],
    sources: [{ label: 'cut(1)', url: `${MAN}/man1/cut.1.html` }, { label: 'sort(1)', url: `${MAN}/man1/sort.1.html` }],
  }),
  fiche({
    id: 'linux-fins-ligne-windows', titre: 'Corriger les fins de ligne Windows d’un fichier (CRLF)', effet: 'modification',
    resume: 'Un fichier créé sous Windows termine ses lignes par deux caractères (CRLF) que Linux ne comprend pas : un script ou un CSV se comporte alors bizarrement. Cette fiche détecte le problème et le corrige, avec une copie de sécurité.',
    intentions: ['crlf vers lf', 'dos2unix', 'fichier créé sous windows ne marche pas sous linux', 'bad interpreter ^m', 'supprimer le retour chariot'],
    motsCles: ['crlf', 'lf', 'windows', 'dos2unix', 'retour chariot', 'sed', 'file', 'fin de ligne'],
    params: [FICHIER],
    etapes: [
      lec('Détecter le problème', 'file annonce « with CRLF line terminators » pour un fichier au format Windows.', [sh('file {{fichier}}')], 'Le type du fichier. « CRLF » dans la réponse : le fichier est au format Windows.'),
      mod('Retirer le retour chariot', 's/\\r$// supprime le caractère « retour chariot » qui précède la fin de chaque ligne. -i.bak garde l’original sous fichier.bak.', [sh('sed -i.bak \'s/\\r$//\' {{fichier}}')], 'Aucun message en cas de succès.'),
      lec('Vérifier', 'Plus aucun « CRLF » : le format est Linux.', [sh('file {{fichier}}')], 'Le mot « CRLF » a disparu de la réponse.', { verification: true }),
    ],
    verification: ['file n’annonce plus de CRLF et le script ou le CSV se lit normalement.'],
    retour: 'mv fichier.bak fichier remet le fichier d’origine.',
    sources: [{ label: 'sed (manuel GNU)', url: SED }, { label: 'file(1)', url: `${MAN}/man1/file.1.html` }],
  }),
];

const COMPTE = { id: 'compte', label: 'nom du compte', type: 'identifiant', exemple: 'christian_chef', aide: 'Le nom de connexion, sans espace.' };
const GROUPE = { id: 'groupe', label: 'nom du groupe', type: 'identifiant', exemple: 'users', aide: 'Le nom du groupe, sans espace.' };
const ADMIN = 'Administrateur : sudo.';

export const PROCEDURES_LINUX_COMPTES = [
  fiche({
    id: 'linux-comptes-locaux-lister', titre: 'Lister les comptes locaux et voir le détail d’un compte', effet: 'lecture',
    resume: 'Affiche les comptes de personnes de la machine (UID 1000 et plus) avec leur dossier personnel et leur interpréteur, puis le détail d’un compte et l’état de son mot de passe. Le mot de passe lui-même n’est jamais lisible : seule une empreinte est stockée.',
    intentions: ['lister les comptes locaux linux', 'getent passwd', 'voir tous les utilisateurs de la machine', 'cat /etc/passwd lisible', 'quels comptes existent sur ce serveur'],
    motsCles: ['comptes', 'utilisateurs', 'getent', 'passwd', 'uid', 'liste', 'local', 'mot de passe'],
    params: [COMPTE],
    etapes: [
      lec('Lister les comptes de personnes', 'getent passwd lit la base des comptes (fichier et domaine si configuré). awk garde les UID de 1000 à 59999 : les comptes créés par un administrateur, sans les comptes système.', [sh('getent passwd | awk -F: \'$3 >= 1000 && $3 < 60000 {print $1, $3, $6, $7}\'')], 'Une ligne par compte : nom, UID, dossier personnel, interpréteur. Aucune ligne : aucun compte de personne n’existe.'),
      lec('Voir le détail d’un compte', 'Les sept champs séparés par « : » : nom, x (le mot de passe est ailleurs), UID, GID du groupe principal, description, dossier personnel, interpréteur.', [sh('getent passwd {{compte}}'), sh('id {{compte}}')], 'Une ligne getent et une ligne id avec les groupes. Aucune sortie : le compte n’existe pas.'),
      lec('Voir l’état du mot de passe', 'Le deuxième champ indique P (mot de passe défini), L (compte verrouillé) ou NP (aucun mot de passe), puis la date du dernier changement. Le mot de passe en clair n’existe nulle part.', [sh('sudo passwd -S {{compte}}')], 'Par exemple « christian_chef P 10/17/2026 0 99999 7 -1 ».', { verification: true }),
    ],
    verification: ['Le compte attendu figure dans la liste et son état de mot de passe est P.'],
    sources: [{ label: 'getent(1)', url: `${MAN}/man1/getent.1.html` }, { label: 'passwd(1)', url: `${MAN}/man1/passwd.1.html` }, { label: 'id(1)', url: `${MAN}/man1/id.1.html` }],
  }),
  fiche({
    id: 'linux-groupes-locaux-lister', titre: 'Lister les groupes locaux et leurs membres', effet: 'lecture',
    resume: 'Affiche les groupes créés sur la machine avec leurs membres, le détail d’un groupe et les groupes d’un compte. Lecture seule.',
    intentions: ['lister les groupes locaux linux', 'getent group', 'qui est membre du groupe', 'voir les membres d’un groupe linux', 'cat /etc/group lisible'],
    motsCles: ['groupes', 'getent', 'group', 'membres', 'gid', 'liste', 'local'],
    params: [GROUPE, COMPTE],
    etapes: [
      lec('Lister les groupes de personnes', 'Les groupes dont le GID est de 1000 à 59999, avec leurs membres supplémentaires (le groupe principal d’un compte n’y apparaît pas toujours).', [sh('getent group | awk -F: \'$3 >= 1000 && $3 < 60000 {print $1, $3, $4}\'')], 'Une ligne par groupe : nom, GID, membres séparés par des virgules.'),
      lec('Voir un groupe', 'Le nom, le GID et la liste des membres.', [sh('getent group {{groupe}}')], 'Une ligne « groupe:x:GID:membre1,membre2 ». Aucune sortie : le groupe n’existe pas.'),
      lec('Voir les groupes d’un compte', 'Le groupe principal est le premier ; les autres suivent.', [sh('id {{compte}}'), sh('groups {{compte}}')], 'uid=…, gid=… et la liste complète des groupes.', { verification: true }),
    ],
    verification: ['Le groupe et ses membres attendus apparaissent.'],
    sources: [{ label: 'getent(1)', url: `${MAN}/man1/getent.1.html` }, { label: 'id(1)', url: `${MAN}/man1/id.1.html` }, { label: 'groups(1)', url: `${MAN}/man1/groups.1.html` }],
  }),
  fiche({
    id: 'linux-mot-de-passe-local', titre: 'Changer le mot de passe d’un compte Linux local', effet: 'modification',
    resume: 'Définit un nouveau mot de passe pour un compte local avec passwd. Le mot de passe est demandé à l’invite (saisie masquée) : il n’apparaît ni à l’écran ni dans l’historique. Un mot de passe oublié se remplace, il ne se retrouve pas.',
    intentions: ['changer le mot de passe d’un compte linux', 'passwd compte', 'mot de passe linux oublié', 'réinitialiser le mot de passe d’un utilisateur local', 'forcer le changement de mot de passe à la connexion'],
    motsCles: ['passwd', 'mot de passe', 'compte local', 'réinitialiser', 'chage', 'expiration'],
    params: [COMPTE],
    etapes: [
      lec('Vérifier le compte', 'Contrôle que le compte existe et lis l’état actuel de son mot de passe (P défini, L verrouillé).', [sh('getent passwd {{compte}}'), sh('sudo passwd -S {{compte}}')], 'Une ligne de compte, puis son état (par exemple « P »).'),
      mod('Définir le nouveau mot de passe', 'passwd demande le mot de passe deux fois, sans l’afficher.', [sh('sudo passwd {{compte}}')], 'Le message « passwd : mot de passe mis à jour avec succès ».', { interactions: [{ attend: 'Nouveau mot de passe', reponds: 'Tape le mot de passe (rien ne s’affiche), Entrée, puis retape-le pour confirmer.' }], important: 'Ne tape jamais le mot de passe dans la commande elle-même (echo … | passwd) : il resterait dans l’historique.' }),
      mod('Exiger un changement à la prochaine connexion (facultatif)', 'Pratique quand tu donnes un mot de passe provisoire à quelqu’un.', [sh('sudo passwd -e {{compte}}')], 'Le message « passwd : date d’expiration du mot de passe modifiée ».', { facultatif: true }),
      lec('Vérifier', 'La date du dernier changement doit être celle d’aujourd’hui.', [sh('sudo passwd -S {{compte}}')], 'État P et la date du jour.', { verification: true }),
    ],
    verification: ['L’état est P, la date de changement est celle d’aujourd’hui, et la connexion avec le nouveau mot de passe fonctionne.'],
    retour: 'Un mot de passe changé ne se retrouve pas : redéfinis-en un avec la même commande. sudo passwd -l COMPTE verrouille le compte, sudo passwd -u le déverrouille.',
    sources: [{ label: 'passwd(1)', url: `${MAN}/man1/passwd.1.html` }, { label: 'getent(1)', url: `${MAN}/man1/getent.1.html` }],
  }),
  fiche({
    id: 'samba-compte-voir', titre: 'Lister les comptes Samba AD et voir le détail d’un compte', effet: 'lecture',
    resume: 'Liste les comptes du domaine Samba, puis affiche le détail d’un compte : groupes, dernier changement de mot de passe, tentatives ratées, verrouillage. Le mot de passe en clair n’est jamais stocké : on ne peut que le remplacer.',
    intentions: ['samba-tool user show', 'voir les détails d’un compte samba', 'lister les comptes du domaine samba', 'groupes d’un compte samba ad', 'compte samba verrouillé'],
    motsCles: ['samba-tool', 'user list', 'user show', 'compte', 'domaine', 'memberof', 'pwdlastset', 'verrouillé'],
    params: [COMPTE],
    etapes: [
      lec('Lister les comptes du domaine', 'À lancer sur le contrôleur de domaine Samba.', [sh('sudo samba-tool user list')], 'Un login par ligne (Administrator, Guest, krbtgt et tes comptes).'),
      lec('Compter les comptes', 'Pour comparer avec le nombre de lignes de ton CSV (plus les comptes par défaut).', [sh('sudo samba-tool user list | wc -l')], 'Un nombre.'),
      lec('Voir le détail d’un compte', 'On ne garde que les lignes utiles : le groupe d’appartenance (memberOf), la date du dernier changement de mot de passe, les tentatives ratées et le verrouillage.', [sh('sudo samba-tool user show {{compte}} | grep -E \'^(sAMAccountName|memberOf|pwdLastSet|badPwdCount|lockoutTime|userAccountControl):\'')], 'sAMAccountName : le compte ; un memberOf par groupe ; badPwdCount : 0 pour un compte sain. Aucune sortie : le compte n’existe pas.', { verification: true }),
    ],
    verification: ['Le compte attendu figure dans la liste et appartient au bon groupe.'],
    sources: [{ label: 'samba-tool', url: 'https://www.samba.org/samba/docs/current/man-html/samba-tool.8.html' }, { label: 'grep(1)', url: `${MAN}/man1/grep.1.html` }],
  }),
  fiche({
    id: 'samba-mot-de-passe', titre: 'Changer le mot de passe d’un compte Samba AD', effet: 'modification',
    resume: 'Définit un nouveau mot de passe pour un compte du domaine Samba. Le mot de passe est demandé à l’invite (saisie masquée). Il doit respecter la complexité du domaine : sept caractères au moins et trois types parmi majuscule, minuscule, chiffre, symbole. Un mot de passe oublié se remplace, il ne se retrouve pas (seule une empreinte est stockée).',
    intentions: ['samba-tool user setpassword', 'changer le mot de passe d’un compte samba', 'réinitialiser le mot de passe du domaine samba', 'mot de passe refusé complexité samba', 'mdp0001 refusé samba'],
    motsCles: ['samba-tool', 'setpassword', 'mot de passe', 'compte', 'domaine', 'complexité', 'réinitialiser'],
    params: [COMPTE],
    etapes: [
      lec('Vérifier le compte', 'Contrôle que le compte existe et note la date actuelle du dernier changement.', [sh('sudo samba-tool user show {{compte}} | grep -E \'^(sAMAccountName|pwdLastSet):\'')], 'sAMAccountName et pwdLastSet. Aucune sortie : le compte n’existe pas.'),
      mod('Définir le nouveau mot de passe', 'samba-tool demande le mot de passe deux fois, sans l’afficher. Un mot de passe trop simple (MDP0001 : majuscules et chiffres seulement) est refusé avec un message sur la complexité.', [sh('sudo samba-tool user setpassword {{compte}}')], 'Le message « Changed password OK ». Une erreur « does not meet the complexity criteria » : ajoute un type de caractère (minuscule ou symbole).', { interactions: [{ attend: 'New Password', reponds: 'Tape le mot de passe (rien ne s’affiche), Entrée, puis retape-le pour confirmer.' }], important: 'Ne mets jamais le mot de passe dans la commande (--newpassword=…) : il serait visible dans l’historique et dans la liste des processus.' }),
      lec('Vérifier', 'pwdLastSet doit avoir changé. Teste ensuite l’ouverture de session du compte depuis un poste du domaine.', [sh('sudo samba-tool user show {{compte}} | grep -E \'^pwdLastSet:\'')], 'Une valeur pwdLastSet différente de celle de l’étape 1.', { verification: true }),
    ],
    verification: ['pwdLastSet a changé et le compte ouvre une session avec le nouveau mot de passe.'],
    retour: 'Un mot de passe changé ne se retrouve pas : redéfinis-en un avec la même commande.',
    sources: [{ label: 'samba-tool', url: 'https://www.samba.org/samba/docs/current/man-html/samba-tool.8.html' }, { label: 'grep(1)', url: `${MAN}/man1/grep.1.html` }],
  }),
  (() => {
    const annul = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
    const f = fiche({
      id: 'samba-compte-creer', titre: 'Créer un utilisateur Samba AD', effet: 'modification',
      resume: 'Crée un compte dans le domaine Samba, vérifie qu’il existe, puis permet de le désactiver ou de le supprimer. Le mot de passe est demandé à l’invite (saisie masquée) et doit respecter la complexité du domaine. Option graphique : « Utilisateurs et ordinateurs Active Directory » depuis un poste Windows.',
      intentions: ['samba-tool user create', 'créer un utilisateur samba', 'créer un compte du domaine samba ad', 'ajouter un utilisateur au domaine samba', 'nouveau compte active directory samba', 'créer un utilisateur dans l’ad'],
      motsCles: ['samba-tool', 'user create', 'compte', 'utilisateur', 'domaine', 'mot de passe', 'complexité', 'dsa.msc'],
      privileges: 'Sur le contrôleur de domaine Samba : utilisateur autorisé à utiliser sudo.',
      params: [COMPTE],
      etapes: [
        lec('Vérifier que le compte n’existe pas', 'Évite un doublon. Une erreur « Unable to find user » est la bonne réponse ici : le nom est libre.', [sh('sudo samba-tool user show {{compte}} | grep -E \'^sAMAccountName:\'')], 'Aucune sortie ou une erreur « Unable to find user » : le nom est libre.'),
        mod('Créer le compte', 'samba-tool demande le mot de passe deux fois, sans l’afficher. Un mot de passe trop simple (MDP0001 : majuscules et chiffres seulement) est refusé avec un message sur la complexité.', [sh('sudo samba-tool user create {{compte}}')], 'Le message « User \'…\' added successfully ». Une erreur « does not meet the complexity criteria » : ajoute un type de caractère (minuscule ou symbole). Une erreur « already exists » : le compte existe déjà.', { interactions: [{ attend: 'New Password', reponds: 'Tape le mot de passe (rien ne s’affiche), Entrée, puis retape-le pour confirmer.' }], important: 'Ne mets jamais le mot de passe dans la commande : il resterait dans l’historique du shell.' }),
        lec('Vérifier le compte', 'Le compte doit apparaître avec son nom de connexion et sa date de création du mot de passe.', [sh('sudo samba-tool user show {{compte}} | grep -E \'^(sAMAccountName|pwdLastSet|userAccountControl):\'')], 'sAMAccountName : le compte ; pwdLastSet : une valeur non nulle.', { verification: true }),
        { titre: 'Annuler — désactiver le compte', effet: 'modification', explication: 'Le compte ne peut plus ouvrir de session mais reste dans l’annuaire avec ses groupes : on peut le réactiver avec « samba-tool user enable ».', lignes: [sh('sudo samba-tool user disable {{compte}}')], attendu: 'Le message « Disabled user … ».', ...annul },
        des('Annuler — supprimer le compte', 'Supprime définitivement le compte de l’annuaire ; il quitte aussi ses groupes. Ses fichiers sur les partages restent, mais n’ont plus de propriétaire connu.', [sh('sudo samba-tool user delete {{compte}}')], 'Le message « Deleted user … ».', annul),
      ],
      verification: ['samba-tool user show affiche le compte, et le compte ouvre une session depuis un poste du domaine.'],
      retour: 'Les commandes de désactivation et de suppression sont dans les étapes « Annuler » ci-dessus. Pour mettre le compte dans un groupe : fiche « Gérer un groupe Samba ».',
      sources: [{ label: 'samba-tool', url: 'https://www.samba.org/samba/docs/current/man-html/samba-tool.8.html' }, { label: 'grep(1)', url: `${MAN}/man1/grep.1.html` }],
    });
    f.methodes.unshift({
      id: 'gui', privileges: 'Poste Windows du domaine, avec les outils RSAT installés et un compte autorisé à créer des utilisateurs.',
      etapes: [
        gui('Ouvrir la console des utilisateurs', 'lecture', 'dsa.msc est la console « Utilisateurs et ordinateurs Active Directory » (outils RSAT).', ['Appuie sur **Windows + R**, tape **dsa.msc**, puis **Entrée**.', 'Dans le volet de gauche, clique sur le conteneur voulu (**Users**, ou une unité d’organisation).'], 'La console s’ouvre sur ton domaine.'),
        gui('Créer l’utilisateur', 'modification', 'Un assistant demande le nom, le nom de connexion et le mot de passe.', ['Clique droit sur le conteneur, **Nouveau › Utilisateur**.', 'Renseigne le **Nom** et le **Nom d’ouverture de session**, puis **Suivant**.', 'Saisis le mot de passe deux fois (il doit respecter la complexité du domaine), choisis si l’utilisateur doit le changer à la première ouverture de session, puis **Suivant › Terminer**.'], 'Le compte apparaît dans la liste du conteneur.', { important: 'Si la console dit que le mot de passe ne respecte pas la stratégie, ajoute une minuscule ou un symbole.' }),
        gui('Vérifier le compte', 'lecture', 'Le compte doit s’ouvrir sans erreur.', ['Double-clique sur le compte : l’onglet **Compte** affiche le nom de connexion.'], 'Les propriétés du compte s’affichent.', { verification: true }),
        gui('Annuler — désactiver ou supprimer le compte', 'modification', 'Désactiver garde le compte ; supprimer l’efface de l’annuaire.', ['Clique droit sur le compte, **Désactiver le compte** (réversible : **Activer le compte**).', 'Pour supprimer : clique droit, **Supprimer**, puis confirme.'], 'Le compte est grisé (désactivé) ou a disparu de la liste.', annul),
      ],
      verification: ['Le compte figure dans la console et ouvre une session depuis un poste du domaine.'],
      retour: 'Clique droit sur le compte : Désactiver le compte ou Supprimer.',
    });
    return f;
  })(),
];

// ===========================================================================
// CLAVIER ET LANGUE — KJEMO-CLAVIER-01
// ===========================================================================
const SUDO = 'Utilisateur ordinaire autorisé à utiliser sudo.';
const LECTURE = 'Aucun privilège particulier : utilisateur ordinaire.';
const LOCALE = { id: 'langue', label: 'langue du système', type: 'choix', choix: ['fr_CA.UTF-8', 'en_CA.UTF-8', 'fr_FR.UTF-8', 'en_US.UTF-8'], libelles: { 'fr_CA.UTF-8': 'Français (Canada)', 'en_CA.UTF-8': 'Anglais (Canada)', 'fr_FR.UTF-8': 'Français (France)', 'en_US.UTF-8': 'Anglais (États-Unis)' }, exemple: 'fr_CA.UTF-8', aide: 'fr_CA : français du Canada. Le suffixe .UTF-8 est obligatoire.' };
const DISPOSITION = { id: 'disposition', label: 'disposition du clavier', type: 'choix', choix: ['ca', 'us', 'fr', 'de', 'es'], libelles: { ca: 'Canadien (ca) : QWERTY canadien français ou multilingue', us: 'Américain (us) : QWERTY', fr: 'Français (fr) : AZERTY', de: 'Allemand (de) : QWERTZ', es: 'Espagnol (es) : QWERTY' }, exemple: 'ca', aide: 'QWERTY, AZERTY et QWERTZ désignent la disposition des lettres. Au Québec, choisis « Canadien ».' };
const LOC = 'https://www.freedesktop.org/software/systemd/man/latest';

export const PROCEDURES_LINUX_CLAVIER = [
  fiche({
    id: 'linux-clavier-voir', titre: 'Voir la disposition du clavier et la langue actuelles', effet: 'lecture', privileges: LECTURE,
    resume: 'Affiche la disposition du clavier (console et session graphique) et la langue du système. Première lecture quand les touches ne donnent pas le bon caractère ou que les messages changent de langue.',
    intentions: ['localectl status', 'quelle disposition de clavier est utilisée sous linux', 'le clavier écrit le mauvais caractère linux', 'voir la langue du système linux', 'echo $lang'],
    motsCles: ['clavier', 'keymap', 'localectl', 'locale', 'langue', 'setxkbmap', 'azerty', 'qwerty'],
    params: [],
    etapes: [
      lec('État du clavier et de la langue', 'localectl résume la langue du système (System Locale), la disposition de la console (VC Keymap) et celle de la session graphique (X11 Layout).', [sh('localectl status')], 'Des lignes « System Locale », « VC Keymap » et « X11 Layout ». Plusieurs dispositions séparées par une virgule (par exemple « us,ca ») expliquent un clavier qui change tout seul.'),
      lec('Langue vue par ta session', 'Les variables LANG et LC_* de ta session. Elles peuvent différer du système : une connexion SSH peut transmettre la langue du poste client.', [sh('locale')], 'LANG=fr_CA.UTF-8 par exemple. Des valeurs différentes d’une ligne à l’autre : langues mélangées.'),
      lec('Disposition de la session graphique (facultatif)', 'Seulement dans une session graphique : setxkbmap lit la disposition active du moment.', [sh('setxkbmap -query')], 'Les lignes « layout » et « variant ». « Cannot open display » : tu n’es pas dans une session graphique, ce n’est pas une erreur.', { facultatif: true }),
    ],
    verification: ['Tu sais quelle disposition et quelle langue sont réellement actives, à la console, en session graphique et dans ta session.'],
    sources: [{ label: 'localectl(1)', url: `${LOC}/localectl.html` }, { label: 'locale(1)', url: `${MAN}/man1/locale.1.html` }],
  }),
  fiche({
    id: 'linux-clavier-changer', titre: 'Fixer la disposition du clavier du système (localectl)', effet: 'modification', privileges: SUDO,
    resume: 'Définit une seule disposition de clavier pour la console et la session graphique. Remplace une liste de plusieurs dispositions, cause fréquente d’un clavier qui change tout seul.',
    intentions: ['localectl set-keymap', 'changer le clavier sous linux', 'clavier qwerty au lieu de azerty ubuntu', 'passer le clavier en canadien français linux', 'dpkg-reconfigure keyboard-configuration'],
    motsCles: ['clavier', 'localectl', 'set-keymap', 'set-x11-keymap', 'disposition', 'ca', 'etc default keyboard'],
    params: [DISPOSITION],
    etapes: [
      lec('Voir les dispositions disponibles', 'Vérifie que le nom existe avant de l’appliquer (la console et la session graphique n’utilisent pas toujours les mêmes noms).', [sh('localectl list-keymaps | grep -x {{disposition}}'), sh('localectl list-x11-keymap-layouts | grep -x {{disposition}}')], 'Le nom apparaît dans la liste de la session graphique. La console peut nommer le clavier canadien « cf » : si rien ne sort de la première commande pour « ca », lance localectl list-keymaps | grep -E \'^(ca|cf)\' et utilise le nom trouvé avec set-keymap.'),
      mod('Fixer la disposition de la console', 'Écrit la disposition de la console texte (celle de la machine virtuelle ou du serveur sans écran graphique).', [sh('sudo localectl set-keymap {{disposition}}')], 'Aucun message en cas de succès.'),
      mod('Fixer la disposition de la session graphique', 'Écrit la disposition du serveur graphique. Une seule valeur remplace une liste « us,ca ».', [sh('sudo localectl set-x11-keymap {{disposition}}')], 'Aucun message en cas de succès.', { important: 'Une session graphique déjà ouverte garde l’ancienne disposition jusqu’à la fermeture de session. Un réglage personnel du bureau peut aussi l’emporter : voir la fiche sur la session graphique.' }),
      lec('Vérifier', 'Les deux lignes doivent afficher la nouvelle disposition, sans virgule.', [sh('localectl status')], 'VC Keymap et X11 Layout égaux à la disposition choisie.', { verification: true }),
    ],
    verification: ['VC Keymap et X11 Layout affichent la disposition choisie, et les touches donnent les bons caractères après une nouvelle ouverture de session.'],
    retour: 'Relance les deux commandes avec l’ancienne disposition (visible dans le résultat de l’étape « Voir » de la fiche précédente).',
    sources: [{ label: 'localectl(1)', url: `${LOC}/localectl.html` }, { label: 'keyboard(5)', url: `${MAN}/man5/keyboard.5.html` }],
  }),
  fiche({
    id: 'linux-clavier-session', titre: 'Régler le clavier de la session graphique (GNOME, setxkbmap)', effet: 'modification', privileges: LECTURE,
    resume: 'Fixe la disposition de ta session graphique, qui prend le dessus sur le réglage du système. À utiliser quand le clavier revient à une autre disposition après chaque ouverture de session.',
    intentions: ['gsettings input-sources', 'le clavier change de disposition tout seul gnome', 'setxkbmap ca', 'retirer une disposition de clavier gnome', 'raccourci super espace change le clavier'],
    motsCles: ['gsettings', 'gnome', 'input-sources', 'setxkbmap', 'clavier', 'session', 'disposition'],
    params: [DISPOSITION],
    etapes: [
      lec('Voir les dispositions de la session', 'GNOME garde la liste des dispositions de chaque utilisateur. Plusieurs entrées : le raccourci Super+Espace bascule de l’une à l’autre.', [sh('gsettings get org.gnome.desktop.input-sources sources')], 'Par exemple [(\'xkb\', \'us\'), (\'xkb\', \'ca\')]. Une seule entrée : pas de basculement possible.'),
      mod('Ne garder que la disposition voulue', 'Remplace la liste par une seule entrée : plus de basculement involontaire.', [sh('gsettings set org.gnome.desktop.input-sources sources "[(\'xkb\', \'{{disposition}}\')]"')], 'Aucun message en cas de succès. « No such schema » : tu n’es pas sous GNOME, utilise l’étape suivante.', { important: 'À lancer dans la session graphique elle-même (terminal du bureau), pas par SSH ni avec sudo.' }),
      mod('Appliquer tout de suite sans GNOME (temporaire)', 'setxkbmap change la disposition de la session en cours, jusqu’à sa fermeture.', [sh('setxkbmap {{disposition}}')], 'Aucun message. Les touches changent immédiatement.', { facultatif: true }),
      lec('Vérifier', 'La liste doit contenir une seule entrée.', [sh('gsettings get org.gnome.desktop.input-sources sources')], 'Une seule entrée, avec la disposition choisie.', { verification: true }),
    ],
    verification: ['Une seule disposition reste dans la session et les touches donnent les bons caractères après une nouvelle ouverture de session.'],
    retour: 'gsettings reset org.gnome.desktop.input-sources sources remet le réglage par défaut du système.',
    sources: [{ label: 'setxkbmap(1)', url: `${MAN}/man1/setxkbmap.1.html` }, { label: 'GNOME : sources de saisie', url: 'https://help.gnome.org/users/gnome-help/stable/keyboard-layouts.html' }],
  }),
  fiche({
    id: 'linux-langue-systeme', titre: 'Changer la langue du système (locale)', effet: 'modification', privileges: SUDO,
    resume: 'Définit la langue des messages et des formats (dates, nombres) du système. Génère la langue si elle manque, puis l’enregistre pour toutes les prochaines sessions.',
    intentions: ['localectl set-locale', 'changer la langue ubuntu en français', 'locale-gen fr_ca.utf-8', 'les messages du système sont en anglais', 'warning setlocale cannot set lc_all'],
    motsCles: ['locale', 'langue', 'localectl', 'locale-gen', 'lang', 'utf-8', 'fr_ca', 'setlocale'],
    params: [LOCALE],
    etapes: [
      lec('Voir les langues déjà générées', 'Seules les langues générées sur la machine peuvent être utilisées.', [sh('locale -a | grep -i {{langue}}')], 'Une ligne avec la langue choisie. Rien : génère-la à l’étape suivante.'),
      mod('Générer la langue', 'Compile la langue sur la machine (Debian et Ubuntu).', [sh('sudo locale-gen {{langue}}')], 'Le message « Generating locales… done ».'),
      mod('Définir la langue du système', 'Écrit LANG dans le fichier de configuration du système.', [sh('sudo localectl set-locale LANG={{langue}}')], 'Aucun message en cas de succès.', { important: 'Appliquée à la prochaine ouverture de session. En SSH, la langue du poste client peut être transmise et l’emporter : un avertissement « setlocale » vient d’une langue non générée.' }),
      lec('Vérifier', 'System Locale doit afficher la nouvelle langue.', [sh('localectl status')], 'System Locale : LANG=<la langue choisie>.', { verification: true }),
    ],
    verification: ['System Locale affiche la langue choisie et, après une nouvelle ouverture de session, la commande locale aussi.'],
    retour: 'sudo localectl set-locale LANG=en_US.UTF-8 remet l’anglais.',
    sources: [{ label: 'localectl(1)', url: `${LOC}/localectl.html` }, { label: 'locale-gen(8)', url: `${MAN}/man8/locale-gen.8.html` }, { label: 'locale(7)', url: `${MAN}/man7/locale.7.html` }],
  }),
];

// ===========================================================================
// NOM, IDENTITÉ ET CLIENT SSH — KJEMO-SYSTEME-01
// ===========================================================================
const HOTE = { id: 'nom', label: 'nouveau nom de la machine', type: 'hote', exemple: 'client-ubuntu01', aide: 'Lettres, chiffres et tirets, sans espace ni point. Exemple : client-ubuntu01.' };

export const PROCEDURES_LINUX_SYSTEME = [
  fiche({
    id: 'linux-hostname-changer', titre: 'Voir et changer le nom de la machine (hostname)', effet: 'modification', privileges: SUDO,
    resume: 'Affiche le nom actuel de la machine puis le change avec hostnamectl, et met à jour /etc/hosts pour que le système se retrouve lui-même sous son nouveau nom.',
    intentions: ['hostnamectl set-hostname', 'changer le nom de la machine ubuntu', 'renommer mon client linux', 'modifier le hostname', 'quel est le nom de ma machine linux'],
    motsCles: ['hostname', 'hostnamectl', 'nom', 'renommer', 'machine', 'etc hosts', '127.0.1.1'],
    params: [HOTE],
    etapes: [
      lec('Voir le nom actuel', 'Trois façons de lire le nom ; hostnamectl donne aussi la distribution et le noyau.', [sh('hostname'), sh('hostnamectl')], 'Le nom actuel, puis le détail (Static hostname, Operating System, Kernel).'),
      lec('Voir la ligne du nom dans /etc/hosts', 'Sur Ubuntu, la ligne 127.0.1.1 porte l’ancien nom : il faut la mettre à jour aussi, sinon sudo affiche « unable to resolve host ».', [sh('grep 127.0.1.1 /etc/hosts')], 'Une ligne « 127.0.1.1 ancien-nom ». Aucune ligne : saute l’étape de mise à jour.'),
      mod('Changer le nom', 'Écrit le nom dans /etc/hostname et l’applique tout de suite.', [sh('sudo hostnamectl set-hostname {{nom}}')], 'Aucun message en cas de succès.'),
      mod('Mettre à jour /etc/hosts', 'Remplace le nom de la ligne 127.0.1.1 et garde l’original dans /etc/hosts.bak.', [sh('sudo sed -i.bak \'s/^127\\.0\\.1\\.1.*/127.0.1.1 {{nom}}/\' /etc/hosts')], 'Aucun message en cas de succès.', { facultatif: true, important: 'À faire seulement si l’étape précédente a trouvé une ligne 127.0.1.1.' }),
      lec('Vérifier', 'Le nom doit être le nouveau, et sudo ne doit plus se plaindre.', [sh('hostnamectl --static'), sh('sudo true')], 'Le nouveau nom, puis aucun message d’erreur.', { verification: true }),
    ],
    verification: ['hostnamectl --static affiche le nouveau nom et sudo ne signale aucune erreur de résolution.'],
    retour: 'Relance la commande hostnamectl avec l’ancien nom ; sudo mv /etc/hosts.bak /etc/hosts remet le fichier hosts d’origine.',
    sources: [{ label: 'hostnamectl(1)', url: `${LOC}/hostnamectl.html` }, { label: 'hostname(5)', url: `${MAN}/man5/hostname.5.html` }, { label: 'hosts(5)', url: `${MAN}/man5/hosts.5.html` }],
  }),
  fiche({
    id: 'linux-systeme-identite', titre: 'Savoir sur quelle machine je suis (nom, version, adresse IP)', effet: 'lecture', privileges: LECTURE,
    resume: 'Rassemble en quelques commandes le nom de la machine, la version d’Ubuntu, le noyau, l’adresse IP, le compte connecté et la durée de fonctionnement. Utile en début de TP ou par SSH, pour vérifier qu’on est sur la bonne machine.',
    intentions: ['lsb_release -a', 'quelle version d’ubuntu j’utilise', 'quelle est mon adresse ip linux', 'uname -r', 'sur quelle machine suis-je connecté en ssh'],
    motsCles: ['version', 'ubuntu', 'noyau', 'adresse ip', 'whoami', 'hostname', 'os-release', 'uptime'],
    etapes: [
      lec('Qui et où', 'Le compte connecté et le nom de la machine.', [sh('whoami'), sh('hostname')], 'Ton compte, puis le nom de la machine.'),
      lec('Version du système', 'La distribution et sa version, puis la version du noyau.', [sh('cat /etc/os-release'), sh('uname -r')], 'Des lignes NAME, VERSION (par exemple Ubuntu 24.04) puis le numéro du noyau.'),
      lec('Adresse IP', '-br donne un résumé court : une ligne par carte réseau, avec son état et son adresse.', [sh('ip -br address'), sh('hostname -I')], 'Une ligne par carte (UP et l’adresse). hostname -I donne seulement les adresses.'),
      lec('Depuis quand elle tourne', 'Durée de fonctionnement et charge.', [sh('uptime')], 'Une ligne avec l’heure, la durée (up …) et la charge moyenne.', { verification: true }),
    ],
    verification: ['Tu sais quel compte, quelle machine, quelle version et quelle adresse IP tu utilises.'],
    sources: [{ label: 'os-release(5)', url: `${MAN}/man5/os-release.5.html` }, { label: 'ip(8)', url: `${MAN}/man8/ip.8.html` }, { label: 'uname(1)', url: `${MAN}/man1/uname.1.html` }],
  }),
  fiche({
    id: 'linux-ssh-client-installer', titre: 'Installer ou vérifier le client SSH sous Ubuntu', effet: 'modification', privileges: SUDO,
    resume: 'Vérifie que la commande ssh est présente et installe le paquet openssh-client si elle manque, puis teste la connexion vers un serveur. Le client sert à se connecter ; le serveur sert à recevoir des connexions.',
    intentions: ['ssh -v version', 'installer le client ssh ubuntu', 'apt install openssh-client', 'ssh command not found', 'se connecter à un serveur par ssh depuis ubuntu'],
    motsCles: ['ssh', 'openssh-client', 'client', 'installer', 'apt', 'connexion', 'port 22'],
    params: [{ id: 'cible', label: 'compte et serveur à joindre', type: 'arg', exemple: 'blaise@srvblaise', aide: 'Format compte@serveur, le serveur étant un nom ou une adresse IP.' }],
    etapes: [
      lec('Vérifier si le client est déjà là', '-V affiche la version ; « command not found » signifie qu’il manque.', [sh('ssh -V')], 'Par exemple « OpenSSH_9.6p1 Ubuntu… ». « command not found » : passe à l’installation.'),
      mod('Installer le client', 'Installe le paquet openssh-client (la commande ssh, scp, ssh-keygen). Sans effet s’il est déjà installé.', [sh('sudo apt update'), sh('sudo apt install openssh-client')], 'La fin de l’installation sans erreur.'),
      lec('Se connecter', 'La première connexion demande de confirmer l’empreinte du serveur (tape yes), puis le mot de passe du compte.', [sh('ssh {{cible}}')], 'L’invite du serveur distant. « Connection refused » : le serveur SSH n’est pas installé ou démarré ; « timed out » : adresse, réseau ou pare-feu.', { verification: true }),
    ],
    verification: ['ssh -V affiche une version et la connexion au serveur s’ouvre.'],
    retour: 'sudo apt remove openssh-client retire le client (rarement utile).',
    sources: [{ label: 'ssh(1)', url: `${MAN}/man1/ssh.1.html` }, { label: 'Ubuntu : OpenSSH', url: 'https://ubuntu.com/server/docs/openssh-server' }],
  }),
];
