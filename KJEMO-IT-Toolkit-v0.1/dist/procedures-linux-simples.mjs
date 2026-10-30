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
import { lec, mod, sh, MAN, CATEGORIE_LINUX, V_COURS } from './cours-outils.mjs';

const SED = 'https://www.gnu.org/software/sed/manual/sed.html';
const FICHIER = { id: 'fichier', label: 'fichier à traiter', type: 'arg', exemple: 'comptes_tp2.csv', aide: 'Un fichier texte existant, dans le dossier courant ou avec son chemin.' };
const SEP = { id: 'sep', label: 'séparateur de colonnes', type: 'choix', choix: [';', ',', ':', '|'], exemple: ';', aide: 'Le caractère qui sépare les colonnes. Le TP2 utilise le point-virgule.' };

function fiche({ id, titre, resume, effet, intentions, motsCles, params, etapes, verification, retour = null, sources }) {
  return {
    id, titre, categorie: CATEGORIE_LINUX, resume, effet, intentions, motsCles, params,
    origine: 'memo',
    methodes: [{ id: 'linux', privileges: 'Utilisateur ordinaire, avec le droit d’écrire dans le dossier du fichier.', etapes, verification, retour }],
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
