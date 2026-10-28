/**
 * cours-fiches-samba.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Comptes, groupes, partages Samba, client smbclient, DNS du domaine, jonction
 * d'un poste Ubuntu et outils RSAT — les gestes du TP2 qui manquaient au
 * catalogue (voir docs/AUDIT-COURS-SAMBA-2026-10-27.md).
 *
 * RÈGLES PROPRES À CE FICHIER
 *  - Aucun vrai mot de passe n'est écrit dans une commande, un script ou la
 *    fiche : le CSV public est un MODÈLE fictif (mots de passe « FICTIF-… »,
 *    refusés par le script) ; le vrai CSV reste sur la VM de l'étudiant.
 *  - Les réglages de LABORATOIRE (chmod 777) sont des étapes facultatives
 *    séparées des réglages professionnels.
 *  - « read list » et « write list » : un compte présent dans les DEUX reçoit
 *    l'accès en écriture (manuel de smb.conf). Les fiches l'évitent en
 *    séparant les groupes.
 */
import { SCRIPT_IMPORT_LIGNES } from './cours-script-import.mjs';
import { MAN, CATEGORIE_LINUX, V_COURS, lec, mod, des, itr, sh, ps, ficheLinux } from './cours-outils.mjs';

const SAMBA_DOC = 'https://www.samba.org/samba/docs/current/man-html';
const SAMBA_WIKI = 'https://wiki.samba.org/index.php';

export const COURS_SAMBA = [
  ficheLinux({
    id: 'cours-samba-groupes',
    titre: 'Gérer les groupes Samba AD avec samba-tool',
    resume: 'Crée un groupe du domaine, y ajoute et retire des membres, liste les membres et lit l’identifiant numérique (gid) utile pour les droits Unix d’un dossier. À lancer sur le contrôleur de domaine Samba.',
    effet: 'modification',
    intentions: ['samba-tool group add', 'groupe samba ad', 'ajouter un utilisateur à un groupe samba', 'samba-tool group addmembers', 'wbinfo gid groupe', 'lister les membres d un groupe samba'],
    motsCles: ['samba-tool', 'group', 'addmembers', 'removemembers', 'listmembers', 'wbinfo', 'groupe', 'domaine', 'gid'],
    params: [
      { id: 'groupe', label: 'nom du groupe', type: 'identifiant', exemple: 'Ventes_Marketing', aide: 'Lettres, chiffres, « _ », « - », « . ». Pas d’espace.' },
      { id: 'membre', label: 'compte du domaine à ajouter', type: 'identifiant', exemple: 'alice_chef', aide: 'Un compte déjà créé (samba-tool user list).' },
    ],
    privileges: 'Administrateur du contrôleur de domaine : sudo.',
    etapes: [
      lec('Lister les groupes existants', 'Évite de créer un doublon et te donne le nom exact des groupes du domaine.', [sh('sudo samba-tool group list')], 'Une ligne par groupe, dont les groupes natifs (Domain Admins, Domain Users…).'),
      mod('Créer le groupe', 'Crée un groupe de sécurité dans l’annuaire. Il est immédiatement visible des clients Windows.', [sh('sudo samba-tool group add {{groupe}}')], 'Un message « Added group … ».'),
      mod('Ajouter un membre', 'addmembers prend le nom du groupe puis la liste des comptes (séparés par des virgules, sans espace).', [sh('sudo samba-tool group addmembers {{groupe}} {{membre}}')], 'Un message « Added members to group … ».'),
      lec('Lister les membres', 'Affiche les comptes membres du groupe.', [sh('sudo samba-tool group listmembers {{groupe}}')], 'Le compte ajouté figure dans la liste.', { verification: true }),
      lec('Lire l’identifiant numérique du groupe (gid)', 'wbinfo interroge winbind : le troisième champ est le gid que le serveur de fichiers attribue au groupe. Il sert à donner un dossier au groupe (chgrp avec un nombre). Il est attribué par le système : lis-le, ne le suppose pas.', [sh('wbinfo --group-info={{groupe}}')], 'Une ligne « groupe:*:gid: », par exemple … :3000024:.', { important: 'Si winbind ne répond pas, la commande échoue : vérifie que le service winbind tourne sur le contrôleur.' }),
      mod('Retirer un membre (facultatif)', 'removemembers retire le compte du groupe sans supprimer le compte.', [sh('sudo samba-tool group removemembers {{groupe}} {{membre}}')], 'Un message « Removed members from group … ».', { facultatif: true }),
    ],
    verification: ['samba-tool group listmembers affiche les comptes attendus.'],
    retour: 'samba-tool group removemembers retire un membre ; samba-tool group delete supprime le groupe (seulement s’il n’est plus utilisé nulle part).',
    sources: [{ label: 'samba-tool — group', url: `${SAMBA_DOC}/samba-tool.8.html` }, { label: 'Wiki Samba — User and Group management', url: `${SAMBA_WIKI}/User_and_Group_management` }],
  }),

  ficheLinux({
    id: 'cours-samba-import-csv',
    titre: 'Import CSV Samba renforcé (essai -n, hors cours)',
    resume: 'Version RENFORCÉE, hors niveau du cours (celle du cours : script à menu). Prépare un CSV « login;motdepasse;departement » LOCAL à la VM (modèle public entièrement fictif), puis un script Bash qui crée le groupe du département, le compte et son appartenance, vérifie chaque commande et résume. Essai (-n) d’abord : il ne modifie rien. Version de laboratoire : pas la pratique professionnelle.',
    effet: 'modification',
    intentions: ['script csv samba-tool', 'créer des utilisateurs depuis un csv', 'while read csv bash samba', 'import de comptes samba', 'créer plusieurs utilisateurs samba', 'script de création de comptes', 'tp2 a4 csv login mot de passe département'],
    motsCles: ['csv', 'script', 'bash', 'while', 'read', 'IFS', 'samba-tool', 'user create', 'group addmembers', 'comptes', 'département', 'motdepasse'],
    params: [
      { id: 'csv', label: 'fichier CSV (sur la VM)', type: 'arg', exemple: 'comptes_tp2.csv', aide: 'Créé dans le dossier courant de la VM ; remplace un fichier du même nom.' },
      { id: 'script', label: 'nom du script', type: 'arg', exemple: 'import_comptes.sh', aide: 'Créé dans le dossier courant ; remplace un fichier du même nom.' },
      { id: 'departement', label: 'département à contrôler', type: 'identifiant', exemple: 'Ventes_Marketing', aide: 'Le nom du groupe Samba d’un département de ton CSV.' },
    ],
    privileges: 'Administrateur du contrôleur de domaine : sudo, pour l’essai et l’application.',
    etapes: [
      mod('Écrire le MODÈLE public du CSV (valeurs fictives)', 'Crée le fichier avec des droits restrictifs (lecture/écriture pour toi seul), puis y écrit un modèle : en-tête « login;motdepasse;departement », séparateur « ; », une ligne par compte, SANS guillemets. Les logins et les mots de passe « FICTIF-… » sont inventés : le script les refuse à l’application.', [
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
      mod('Mettre tes vrais comptes dans le CSV — sur la VM seulement', 'Ouvre le fichier dans nano et remplace les lignes du modèle par les comptes et les mots de passe de ton énoncé, tapés directement dans l’éditeur de la VM. Ni cette application ni aucun autre site ne les reçoit.', [sh('nano {{csv}}')], 'Le fichier contient tes comptes ; plus aucun « FICTIF- ».', {
        interactions: [{ attend: 'Éditeur nano ouvert', reponds: 'Remplace les lignes, Ctrl+O puis Entrée pour enregistrer, Ctrl+X pour quitter.' }],
        important: 'Un mot de passe doit respecter la politique de complexité du domaine, sinon samba-tool refuse la ligne : le script le signale (sans afficher le mot de passe). En entreprise, on ne stocke pas de mots de passe en clair : mot de passe temporaire aléatoire, changement obligatoire à la première connexion (voir « samba-tool user create --help »).',
      }),
      mod('Écrire le script', 'Le script teste chaque ligne (3 champs, login et département valides, pas de doublon), ignore un compte qui existe déjà SANS le modifier, vérifie chaque commande samba-tool (code de retour puis relecture) et termine par un résumé et un code de sortie : 0 tout va bien, 1 erreur d’usage ou de système, 2 au moins une ligne rejetée ou en échec. Avec -n il ne modifie rien.', [
        sh('cat > {{script}} <<\'EOF\''),
        ...SCRIPT_IMPORT_LIGNES.map((l) => sh(l)),
        sh('EOF'),
      ], 'Aucun message : le fichier est créé.', { important: 'Guillemets : un CSV dont les champs sont entre guillemets n’est PAS pris en charge (la ligne est rejetée). Le mot de passe est passé en argument à samba-tool : il est visible un court instant dans la liste des processus du serveur. Acceptable en laboratoire isolé seulement.' }),
      mod('Rendre le script exécutable', 'Ajoute le droit d’exécution.', [sh('chmod +x {{script}}')], 'Aucun message.'),
      lec('Contrôler les droits du CSV', 'Le script refuse d’appliquer un CSV lisible par d’autres comptes.', [sh('ls -l {{csv}}')], '-rw------- (600) devant le nom du fichier.', { verification: true }),
      lec('ESSAI : lire et vérifier sans rien créer', 'Avec -n, le script ne fait que des lectures (samba-tool user list et group list). Il affiche ce qu’il créerait, les lignes rejetées avec leur numéro (jamais leur contenu) et un résumé.', [sh('sudo ./{{script}} -n {{csv}}')], 'Des lignes « ESSAI : créerait … » puis « ESSAI terminé : rien n’a été modifié. » et un résumé. Code de sortie 0 si tout est valide, 2 s’il y a des lignes rejetées.', { verification: true }),
      mod('APPLIQUER : créer groupes, comptes et appartenances', 'Crée ce qui manque, dans cet ordre : le groupe du département, le compte, l’ajout au groupe. Un compte ou un groupe existant est signalé et laissé tel quel.', [sh('sudo ./{{script}} {{csv}}')], 'Des lignes « créé : login dans le groupe … » puis un résumé « N comptes créés, … 0 échecs ». Code de sortie 0.', {
        important: 'Si le résumé indique des rejets ou des échecs (code 2), corrige le CSV ou la cause, puis relance : les comptes déjà créés sont ignorés, pas recréés.',
      }),
      lec('Contrôler les comptes, les groupes et les membres', 'Les captures demandées par le sujet : liste des comptes, liste des groupes, membres d’un département.', [sh('sudo samba-tool user list'), sh('sudo samba-tool group list'), sh('sudo samba-tool group listmembers {{departement}}')], 'Les logins du CSV figurent dans la liste des comptes, les départements dans la liste des groupes, et les membres du département sont ceux du CSV.', { verification: true }),
      lec('Relancer l’import (sans danger)', 'Un second passage ne recrée rien et ne change aucun mot de passe : chaque compte est annoncé « existe déjà ».', [sh('sudo ./{{script}} {{csv}}')], '« existe déjà : … ignoré » pour chaque ligne, résumé avec 0 compte créé, code 0.', { facultatif: true }),
      des('Supprimer le CSV après le laboratoire', 'Le fichier contient des mots de passe en clair : on le retire quand le laboratoire est fini. shred écrase puis supprime ; sur un système de fichiers à journal, l’écrasement n’est pas garanti, donc supprime aussi les copies et les instantanés de la VM.', [sh('shred -u {{csv}}')], 'Le fichier n’existe plus (ls renvoie « No such file »).', { facultatif: true }),
      lec('Lire les options de ta version (facultatif)', 'Pour imposer le changement de mot de passe à la première connexion ou générer un mot de passe aléatoire, regarde si ta version de samba-tool le propose.', [sh('samba-tool user create --help')], 'La liste des options de ta version.', { facultatif: true }),
    ],
    verification: ['Le résumé du script indique 0 rejet et 0 échec (code de sortie 0).', 'Chaque login du CSV existe (samba-tool user list) et appartient à son département (listmembers).'],
    retour: 'samba-tool user delete suivi du login supprime un compte ; samba-tool group delete suivi du groupe supprime un groupe. Supprime aussi le CSV et le script.',
    sources: [{ label: 'samba-tool', url: `${SAMBA_DOC}/samba-tool.8.html` }, { label: 'Bash — while, read, IFS', url: 'https://www.gnu.org/software/bash/manual/bash.html#Looping-Constructs' }, { label: 'Wiki Samba — User and Group management', url: `${SAMBA_WIKI}/User_and_Group_management` }],
  }),

  ficheLinux({
    id: 'cours-samba-partage-utilisateurs',
    titre: 'Partage Samba : un compte en écriture, un en lecture',
    resume: 'Crée un dossier, deux comptes du domaine, puis une section de partage dans smb.conf où un compte écrit et l’autre lit seulement. Valide la configuration avec testparm avant de la recharger. Modifie /etc/samba/smb.conf : sauvegarde d’abord.',
    effet: 'modification',
    intentions: ['partage samba smb.conf', 'write list read list samba', 'testparm', 'partager un dossier avec samba', 'lecture seule samba', 'valid users samba', 'smb.conf browseable comment'],
    motsCles: ['samba', 'smb.conf', 'partage', 'valid users', 'write list', 'read list', 'browseable', 'testparm', 'smbcontrol', 'comment', '777'],
    params: [
      { id: 'partage', label: 'nom du partage', type: 'identifiant', exemple: 'partage_tp2', aide: 'Le nom que les clients verront. Sans espace.' },
      { id: 'chemin', label: 'dossier à partager', type: 'chemin', exemple: '/DATA_EXT4/partage_tp2', aide: 'Chemin absolu sans espace ; créé s’il n’existe pas.' },
      { id: 'ecriture', label: 'compte autorisé en écriture', type: 'identifiant', distinctDe: ['lecture'], exemple: 'user1tp2', aide: 'Un compte du domaine (créé à l’étape 2 s’il n’existe pas).' },
      { id: 'lecture', label: 'compte en lecture seule', type: 'identifiant', distinctDe: ['ecriture'], exemple: 'user2tp2', aide: 'Un AUTRE compte. Un compte présent dans les deux listes recevrait l’écriture.' },
    ],
    privileges: 'Administrateur du serveur Samba : sudo.',
    etapes: [
      mod('Créer le dossier à partager', 'Crée le dossier (et ses parents). Les droits Unix s’appliquent EN PLUS des listes de Samba : le plus restrictif gagne.', [sh('sudo mkdir -p {{chemin}}')], 'Aucun message.'),
      mod('Créer les deux comptes du domaine', 'samba-tool demande le mot de passe à l’invite (deux fois). Rien n’est écrit dans la commande.', [sh('sudo samba-tool user create {{ecriture}}'), sh('sudo samba-tool user create {{lecture}}')], 'Pour chacun : demande du mot de passe, puis « User … created successfully ».', {
        interactions: [{ attend: 'New Password: puis Retype Password:', reponds: 'Un mot de passe conforme à la politique du domaine, tapé au terminal (rien ne s’affiche).' }],
        important: 'Si un compte existe déjà, samba-tool le dit et ne le modifie pas : passe à l’étape suivante.',
      }),
      mod('Régler les droits Unix du dossier — PROFESSIONNEL', 'Mode 2775 : le propriétaire et le groupe lisent et écrivent, les autres lisent et traversent seulement. Samba filtre ensuite l’écriture avec la write list. Pour un dossier réservé à un groupe, utilise plutôt la fiche des droits d’un dossier de groupe (770).', [sh('sudo chmod 2775 {{chemin}}')], 'Aucun message.', { facultatif: true, important: 'Si l’écriture reste refusée au compte autorisé alors que Samba l’autorise, c’est ici que ça bloque : un compte doit aussi avoir le droit Unix d’écrire.' }),
      mod('Régler les droits Unix du dossier — LABORATOIRE (777)', 'Donne tous les droits à tout le monde au niveau Unix : Samba devient alors le SEUL filtre. Pratique pour vérifier que write list et read list font leur travail ; à ne jamais laisser en production.', [sh('sudo chmod 777 {{chemin}}')], 'Aucun message.', { facultatif: true, important: 'Laboratoire seulement. En production, n’importe quel compte local pourrait modifier le contenu en contournant Samba.' }),
      mod('Sauvegarder smb.conf', 'Une copie datée te permet de revenir en arrière si testparm signale une erreur.', [sh('sudo cp -a /etc/samba/smb.conf /etc/samba/smb.conf.avant-cours')], 'Aucun message.'),
      mod('Ajouter la section de partage', 'browseable = yes : visible dans l’explorateur. read only = yes : lecture seule par défaut. write list : les comptes qui peuvent écrire. read list : ceux qui ne peuvent QUE lire. valid users : qui peut se connecter. comment : la description visible dans le voisinage réseau. Ne répète pas de section de même nom : Samba lirait la dernière.', [
        sh('sudo tee -a /etc/samba/smb.conf <<\'EOF\''),
        sh('[{{partage}}]'),
        sh('   comment = Partage de laboratoire'),
        sh('   path = {{chemin}}'),
        sh('   browseable = yes'),
        sh('   read only = yes'),
        sh('   guest ok = no'),
        sh('   valid users = {{ecriture}}, {{lecture}}'),
        sh('   write list = {{ecriture}}'),
        sh('   read list = {{lecture}}'),
        sh('EOF'),
      ], 'tee réaffiche les lignes ajoutées.', { important: 'Selon le manuel de smb.conf, un compte présent dans read list ET write list reçoit l’écriture. C’est pourquoi les deux comptes doivent être différents.' }),
      lec('Tester la configuration', 'testparm lit smb.conf, signale les paramètres inconnus ou invalides (« Error loading services » en cas d’erreur grave) et affiche la configuration effective. -s évite l’invite de confirmation.', [sh('testparm -s')], 'Aucune ligne « WARNING » ni « Error » ; la section du partage apparaît avec ses paramètres. En cas d’erreur, restaure smb.conf.avant-cours.', { options: [{ option: '-s', explication: 'N’affiche pas l’invite « Appuyez sur Entrée » : affiche directement la configuration.' }], verification: true }),
      itr('Recharger la configuration', 'smbcontrol demande aux processus Samba de relire smb.conf sans couper les connexions en cours (sur un contrôleur de domaine, le service s’appelle samba-ad-dc ; sur un simple serveur de fichiers, smbd).', [sh('sudo smbcontrol all reload-config')], 'Aucun message en cas de succès.', { important: 'Si le client ne voit pas le nouveau partage, redémarre le service concerné (samba-ad-dc sur un contrôleur de domaine, smbd sinon). Ouvre aussi le pare-feu si besoin : « sudo ufw allow samba » s’il est actif — sur un contrôleur de domaine, d’autres ports sont nécessaires.' }),
      lec('Vérifier la liste des partages', 'smbclient -L liste les partages tels qu’un client les voit (-N : sans mot de passe, pour la liste).', [sh('smbclient -L localhost -N')], 'Le partage figure dans la liste, avec son commentaire.', { options: [{ option: '-L', explication: 'Liste les partages du serveur indiqué.' }, { option: '-N', explication: 'Pas de mot de passe demandé (accès anonyme pour la liste).' }], verification: true }),
    ],
    verification: ['testparm ne signale aucune erreur ; le partage est listé ; le compte en écriture peut écrire, l’autre non (voir la fiche smbclient).'],
    retour: 'Restaure la sauvegarde : sudo cp -a /etc/samba/smb.conf.avant-cours /etc/samba/smb.conf, puis sudo smbcontrol all reload-config.',
    sources: [{ label: 'smb.conf — read list, write list, valid users', url: `${SAMBA_DOC}/smb.conf.5.html` }, { label: 'testparm(1)', url: `${MAN}/man1/testparm.1.html` }, { label: 'smbcontrol(1)', url: `${MAN}/man1/smbcontrol.1.html` }, { label: 'samba-tool', url: `${SAMBA_DOC}/samba-tool.8.html` }],
  }),

  ficheLinux({
    id: 'cours-samba-partage-groupe',
    titre: 'Partager un dossier avec un groupe Samba (un compte en lecture seule)',
    resume: 'Donne un dossier à un groupe du domaine (chgrp avec le gid, chmod 770), déclare le partage pour tout le groupe en lecture-écriture sauf un compte (read list), puis teste depuis le client Ubuntu qu’un membre écrit et que le compte en lecture seule est refusé. Département Direction du TP2, partie E.',
    effet: 'modification',
    intentions: ['partage par groupe samba', 'valid users @groupe', 'dossier de département samba', 'réceptionniste lecture seule', 'chgrp gid wbinfo', 'partage de groupe samba ad', 'tp2 e direction partage groupe', 'read list samba'],
    motsCles: ['samba', 'groupe', 'valid users', 'read list', 'wbinfo', 'chgrp', 'chmod 770', 'partage', 'département', 'direction', 'réceptionniste'],
    prerequis: [
      { texte: 'Le groupe du département et ses comptes existent dans le domaine (le réceptionniste et au moins un autre membre).', fiche: 'cours-samba-import-csv' },
      { texte: 'Pour le test depuis Ubuntu, le client joint le serveur par le réseau.', fiche: 'cours-ubuntu-reseau-client' },
    ],
    params: [
      { id: 'chemin', label: 'dossier à partager', type: 'chemin', exemple: '/DATA_EXT4/direction', aide: 'Chemin absolu sans espace ; créé s’il n’existe pas.' },
      { id: 'partage', label: 'nom du partage', type: 'identifiant', exemple: 'direction', aide: 'Le nom que les clients verront.' },
      { id: 'groupe', label: 'groupe du département', type: 'identifiant', exemple: 'Direction', aide: 'Tous ses membres peuvent lire et écrire, sauf le compte en lecture seule. Créé par le script du CSV.' },
      { id: 'lectureSeule', label: 'compte en lecture seule (réceptionniste)', type: 'identifiant', distinctDe: ['membreEcriture'], exemple: 'receptionniste', aide: 'Le login du réceptionniste dans TON CSV. Il doit être membre du groupe.' },
      { id: 'membreEcriture', label: 'autre membre du groupe (test d’écriture)', type: 'identifiant', distinctDe: ['lectureSeule'], exemple: 'directeur', aide: 'Un membre du groupe qui, lui, a le droit d’écrire.' },
      { id: 'gid', label: 'gid du groupe (relevé)', type: 'entier', min: 1, max: 4294967295, exemple: '3000024', aide: 'Le troisième champ de « wbinfo --group-info » (étape 2). Attribué par le système : ne le suppose pas.' },
      { id: 'serveur', label: 'nom ou adresse IP du serveur', type: 'identifiant', exemple: '172.27.1.210', aide: 'Pour les tests depuis le client Ubuntu.' },
      { id: 'domaine', label: 'nom NetBIOS du domaine', type: 'identifiant', exemple: 'SERVEUR2', aide: 'Le « workgroup » du domaine.' },
    ],
    privileges: 'Administrateur du serveur Samba : sudo. Les tests se font sur le client Ubuntu.',
    etapes: [
      { ...mod('Créer le dossier', 'Le dossier recevra les fichiers du département.', [sh('sudo mkdir -p {{chemin}}')], 'Aucun message.'), machine: 'serveur' },
      { ...lec('Lire le gid du groupe', 'Le dossier doit appartenir au groupe du domaine : pour cela on utilise son identifiant numérique (le « uid du groupe » du cours), que winbind fournit.', [sh('wbinfo --group-info={{groupe}}')], 'Une ligne « groupe:*:gid: ». Saisis ce nombre dans le champ « gid ».'), machine: 'serveur' },
      { ...mod('Donner le dossier au groupe', 'chgrp accepte un gid numérique : il fonctionne même si le nom du groupe n’est pas résolu par le système.', [sh('sudo chgrp {{gid}} {{chemin}}')], 'Aucun message.'), machine: 'serveur' },
      { ...mod('Limiter l’accès au groupe (770)', 'Le sujet demande « chmod 770 » : le propriétaire et le groupe lisent, écrivent et traversent ; les autres n’ont aucun droit.', [sh('sudo chmod 770 {{chemin}}')], 'Aucun message.', { options: [{ option: '770', explication: 'Mode octal : 7 rwx propriétaire, 7 rwx groupe, 0 rien pour les autres.' }] }), machine: 'serveur' },
      { ...mod('Sauvegarder smb.conf', 'Pour pouvoir revenir en arrière.', [sh('sudo cp -a /etc/samba/smb.conf /etc/samba/smb.conf.avant-groupe')], 'Aucun message.'), machine: 'serveur' },
      { ...mod('Déclarer le partage', 'valid users = @groupe : tout le département se connecte. read only = no : lecture-écriture pour ceux qui se connectent. read list = compte : ce compte n’aura QUE la lecture, même si le partage est en écriture (manuel de smb.conf).', [
        sh('sudo tee -a /etc/samba/smb.conf <<\'EOF\''),
        sh('[{{partage}}]'),
        sh('   comment = Dossier du département'),
        sh('   path = {{chemin}}'),
        sh('   browseable = yes'),
        sh('   read only = no'),
        sh('   guest ok = no'),
        sh('   valid users = @{{groupe}}'),
        sh('   read list = {{lectureSeule}}'),
        sh('EOF'),
      ], 'tee réaffiche les lignes ajoutées.', { important: 'Un compte qui figure à la fois dans read list et dans write list reçoit l’ÉCRITURE : ne mets jamais le réceptionniste dans write list. Si Samba ne reconnaît pas « @groupe » tel quel, ton serveur attend peut-être le nom préfixé du domaine : lis la sortie de testparm avant d’en déduire quoi que ce soit.' }), machine: 'serveur' },
      { ...lec('Tester puis recharger', 'testparm valide la syntaxe ; smbcontrol relit la configuration sans couper les connexions.', [sh('testparm -s'), sh('sudo smbcontrol all reload-config')], 'Aucune erreur ; la section du partage figure dans la configuration.', { verification: true }), machine: 'serveur' },
      { ...mod('Membre du groupe : créer un dossier (écriture permise)', 'Depuis le client Ubuntu : ce compte doit pouvoir écrire.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{membreEcriture}} -c \'mkdir ecrit_par_membre; ls\'')], 'Le dossier ecrit_par_membre figure dans la liste.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du membre, saisi à l’invite (non affiché).' }], verification: true }), machine: 'client-ubuntu' },
      { ...lec('Réceptionniste : essayer d’écrire (refus attendu)', 'Le sujet demande de montrer que le réceptionniste n’a pas le droit d’écrire. Le refus est la preuve.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{lectureSeule}} -c \'mkdir ecrit_par_receptionniste\'')], 'NT_STATUS_ACCESS_DENIED : aucun dossier créé.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du réceptionniste, saisi à l’invite (non affiché).' }], verification: true }), machine: 'client-ubuntu' },
      { ...lec('Réceptionniste : lire (lecture permise)', 'Il doit pouvoir lire ce que le membre a créé.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{lectureSeule}} -c \'ls\'')], 'La liste du partage, avec ecrit_par_membre.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du réceptionniste, saisi à l’invite (non affiché).' }], verification: true }), machine: 'client-ubuntu' },
    ],
    verification: ['Le membre écrit ; le réceptionniste lit sans pouvoir écrire ; un compte étranger au groupe n’entre pas.'],
    retour: 'Restaure /etc/samba/smb.conf.avant-groupe et recharge ; remets le groupe et le mode du dossier (chgrp, chmod) relevés avant la modification.',
    sources: [{ label: 'smb.conf — valid users, read list, write list', url: `${SAMBA_DOC}/smb.conf.5.html` }, { label: 'smbclient(1)', url: `${SAMBA_DOC}/smbclient.1.html` }, { label: 'wbinfo(1)', url: `${SAMBA_DOC}/wbinfo.1.html` }, { label: 'chgrp(1)', url: `${MAN}/man1/chgrp.1.html` }],
  }),

  ficheLinux({
    id: 'cours-smbclient-transferts',
    titre: 'Télécharger et déposer des fichiers avec smbclient',
    resume: 'Crée deux fichiers dans le dossier partagé sur le serveur, les télécharge depuis le client Ubuntu avec smbclient (get), crée deux fichiers locaux et les dépose (put), puis vérifie sur le serveur. Chaque étape dit sur quelle machine elle se fait.',
    effet: 'modification',
    intentions: ['smbclient get put', 'télécharger un fichier smbclient', 'déposer un fichier smbclient', 'smbclient -c', 'tp2 d8 smbclient fichier1tp2', 'copier un fichier vers un partage samba', 'smbclient session interactive'],
    motsCles: ['smbclient', 'get', 'put', 'ls', 'cd', 'partage', 'transfert', 'depot1', 'fichier1tp2'],
    prerequis: [
      { texte: 'Le partage existe et le compte en écriture peut y écrire (le dépôt exige l’écriture).', fiche: 'cours-samba-partage-utilisateurs' },
      { texte: 'Le client Ubuntu joint le serveur par le réseau et smbclient y est installé.', fiche: 'cours-ubuntu-acces-partage' },
    ],
    params: [
      { id: 'serveur', label: 'nom ou adresse IP du serveur', type: 'identifiant', exemple: '172.27.1.210', aide: 'Celle du serveur Samba.' },
      { id: 'partage', label: 'nom du partage', type: 'identifiant', exemple: 'partage_tp2', aide: 'Le nom déclaré entre crochets dans smb.conf.' },
      { id: 'domaine', label: 'nom NetBIOS du domaine', type: 'identifiant', exemple: 'SERVEUR2', aide: 'Le « workgroup » du domaine.' },
      { id: 'compte', label: 'compte autorisé en ÉCRITURE', type: 'identifiant', exemple: 'user1tp2', aide: 'Le dépôt (put) exige le droit d’écrire ; le téléchargement (get) n’exige que la lecture.' },
      { id: 'chemin', label: 'dossier partagé sur le serveur', type: 'chemin', exemple: '/DATA_EXT4/partage_tp2', aide: 'Le chemin déclaré dans smb.conf.' },
      { id: 'fichier1', label: 'premier fichier du serveur', type: 'identifiant', distinctDe: ['fichier2'], exemple: 'fichier1tp2', aide: 'L’énoncé écrit « fichier1tp2 et fichier1tp2 » : on suppose fichier1tp2 et fichier2tp2.' },
      { id: 'fichier2', label: 'second fichier du serveur', type: 'identifiant', distinctDe: ['fichier1'], exemple: 'fichier2tp2', aide: 'Deux noms différents.' },
    ],
    privileges: 'Serveur : sudo. Client Ubuntu : utilisateur ordinaire (les mots de passe se tapent à l’invite).',
    etapes: [
      { ...mod('Créer les deux fichiers dans le dossier partagé', 'Le sujet demande de les créer directement sur le serveur, dans le dossier partagé.', [sh('echo \'contenu du premier fichier\' | sudo tee {{chemin}}/{{fichier1}}'), sh('echo \'contenu du second fichier\' | sudo tee {{chemin}}/{{fichier2}}')], 'tee réaffiche chaque phrase.'), machine: 'serveur' },
      { ...lec('Vérifier la présence des fichiers', 'Ils doivent être lisibles par le compte qui téléchargera (le dossier est en 777 au laboratoire).', [sh('ls -l {{chemin}}')], 'Les deux fichiers sont listés.', { verification: true }), machine: 'serveur' },
      { ...lec('Lister les partages vus par le compte', 'Contrôle que le client atteint le serveur et que le compte s’authentifie.', [sh('smbclient -L //{{serveur}} -W {{domaine}} -U {{compte}}')], 'La table des partages, dont celui du TP2.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du compte, saisi à l’invite (non affiché).' }] }), machine: 'client-ubuntu' },
      { ...mod('Préparer un dossier de travail sur le client', 'Les fichiers téléchargés arriveront dans le dossier courant au moment du get : on en crée un dédié.', [sh('mkdir -p ~/smb-tp2')], 'Aucun message.'), machine: 'client-ubuntu' },
      { ...mod('Télécharger les deux fichiers (get)', 'L’option -c exécute les commandes de smbclient puis ferme la session. get copie du serveur vers le dossier courant du client.', [sh('cd ~/smb-tp2 && smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compte}} -c \'get {{fichier1}}; get {{fichier2}}\'')], 'Deux lignes « getting file … of size … ».', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du compte, saisi à l’invite (non affiché).' }] }), machine: 'client-ubuntu' },
      { ...mod('Variante : la session interactive (facultatif)', 'Sans -c, smbclient ouvre un prompt « smb: \\> » : ce sont alors des commandes de smbclient, pas du shell. Elles se tapent dans ce prompt, une par une.', [sh('cd ~/smb-tp2 && smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compte}}')], 'Le prompt « smb: \\> » s’affiche.', { facultatif: true, interactions: [
        { attend: 'Password for', reponds: 'Mot de passe du compte, saisi à l’invite (non affiché).' },
        { attend: 'smb: \\>', reponds: 'ls pour lister, get suivi du nom d’un fichier pour le télécharger, put suivi du nom d’un fichier local pour le déposer.' },
        { attend: 'smb: \\>', reponds: 'exit pour quitter la session.' },
      ] }), machine: 'client-ubuntu' },
      { ...lec('Vérifier les téléchargements', 'Les deux fichiers sont dans le dossier de travail, avec leur contenu.', [sh('ls -l ~/smb-tp2'), sh('cat ~/smb-tp2/{{fichier1}} ~/smb-tp2/{{fichier2}}')], 'Les deux fichiers et leurs phrases.', { verification: true }), machine: 'client-ubuntu' },
      { ...mod('Créer depot1 et depot2 sur le client', 'Le sujet demande deux fichiers locaux nommés depot1 et depot2.', [sh('echo \'dépôt numéro 1\' > ~/smb-tp2/depot1'), sh('echo \'dépôt numéro 2\' > ~/smb-tp2/depot2')], 'Aucun message.'), machine: 'client-ubuntu' },
      { ...mod('Déposer les deux fichiers (put)', 'put copie du client vers le partage. Le compte doit avoir le droit d’écrire.', [sh('cd ~/smb-tp2 && smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compte}} -c \'put depot1; put depot2; ls\'')], 'Deux lignes « putting file … » puis la liste du partage avec depot1 et depot2.', { interactions: [{ attend: 'Password for', reponds: 'Mot de passe du compte, saisi à l’invite (non affiché).' }], important: 'NT_STATUS_ACCESS_DENIED au put : le compte n’a pas le droit d’écrire (compte en lecture seule, ou dossier non inscriptible).' }), machine: 'client-ubuntu' },
      { ...lec('Contrôler l’arrivée sur le serveur', 'Les deux fichiers déposés doivent être dans le dossier partagé.', [sh('ls -l {{chemin}}')], 'depot1 et depot2 sont listés avec le compte déposant comme propriétaire.', { verification: true }), machine: 'serveur' },
    ],
    verification: ['Les deux fichiers du serveur sont dans ~/smb-tp2 sur le client.', 'depot1 et depot2 sont dans le dossier partagé du serveur.'],
    retour: 'Supprime ~/smb-tp2 sur le client ; sur le serveur, supprime avec rm les fichiers créés (fichiers du serveur, depot1, depot2).',
    sources: [{ label: 'smbclient(1)', url: `${SAMBA_DOC}/smbclient.1.html` }],
  }),

  ficheLinux({
    id: 'cours-samba-dns',
    titre: 'Gérer le DNS d’un domaine Samba : zone inverse, hôte A et PTR',
    resume: 'Liste les zones du DNS interne de Samba, ajoute un enregistrement d’hôte (A), crée une zone inverse pour un réseau /24 et y ajoute l’enregistrement PTR correspondant. Le mot de passe de l’administrateur est demandé à l’invite.',
    effet: 'modification',
    intentions: ['samba-tool dns', 'ajouter un enregistrement dns samba', 'zone inverse samba', 'enregistrement ptr', 'dns samba ad zonecreate', 'in-addr.arpa'],
    motsCles: ['samba-tool', 'dns', 'zonecreate', 'zonelist', 'add', 'query', 'PTR', 'A', 'in-addr.arpa', 'zone inverse', 'nslookup'],
    params: [
      { id: 'serveur', label: 'nom complet du contrôleur de domaine', type: 'fqdn', exemple: 'serverdc.serveur2.lan', aide: 'Le nom DNS complet du serveur Samba.' },
      { id: 'zone', label: 'zone directe', type: 'fqdn', exemple: 'serveur2.lan', aide: 'Le nom du domaine.' },
      { id: 'hote', label: 'nom de l’hôte à ajouter', type: 'identifiant', exemple: 'ubuntuclient', aide: 'Le nom court, sans le domaine.' },
      { id: 'ip', label: 'adresse IPv4 de l’hôte', type: 'ipv4', exemple: '172.27.1.230', aide: 'Une adresse FIXE : n’ajoute pas à la main un hôte en adressage automatique.' },
      { id: 'zoneInverse', label: 'zone inverse du réseau /24', type: 'fqdn', exemple: '1.27.172.in-addr.arpa', aide: 'Les trois premiers octets du réseau à l’envers, suivis de .in-addr.arpa : pour 172.27.1.0/24, 1.27.172.in-addr.arpa.' },
      { id: 'dernierOctet', label: 'dernier octet de l’adresse', type: 'entier', min: 1, max: 254, exemple: '230', aide: 'Le nom de l’enregistrement PTR : 230 pour 172.27.1.230.' },
    ],
    privileges: 'Sur le contrôleur de domaine, avec le compte administrateur du domaine (mot de passe demandé).',
    etapes: [
      lec('Lister les zones', 'Montre les zones directes et inverses déjà présentes : évite de créer une zone qui existe.', [sh('samba-tool dns zonelist {{serveur}} -U administrator')], 'Les zones du domaine (par exemple le nom du domaine et _msdcs…).', { interactions: [{ attend: 'Password for [DOMAINE\\administrator]:', reponds: 'Le mot de passe de l’administrateur du domaine, tapé au terminal (rien ne s’affiche).' }] }),
      mod('Ajouter l’hôte (enregistrement A)', 'Associe le nom à l’adresse dans la zone directe. Ne l’ajoute que pour un hôte à adresse fixe.', [sh('samba-tool dns add {{serveur}} {{zone}} {{hote}} A {{ip}} -U administrator')], '« Record added successfully ».', { interactions: [{ attend: 'Password for [DOMAINE\\administrator]:', reponds: 'Le mot de passe de l’administrateur, tapé au terminal.' }] }),
      mod('Créer la zone inverse', 'Une zone inverse permet de retrouver un nom à partir d’une adresse. Elle se crée une seule fois par réseau.', [sh('samba-tool dns zonecreate {{serveur}} {{zoneInverse}} -U administrator')], '« Zone … created successfully ».', { interactions: [{ attend: 'Password for [DOMAINE\\administrator]:', reponds: 'Le mot de passe de l’administrateur, tapé au terminal.' }] }),
      mod('Ajouter l’enregistrement PTR', 'Dans la zone inverse, le nom de l’enregistrement est le dernier octet de l’adresse, et sa donnée le nom complet de l’hôte.', [sh('samba-tool dns add {{serveur}} {{zoneInverse}} {{dernierOctet}} PTR {{hote}}.{{zone}} -U administrator')], '« Record added successfully ».', { interactions: [{ attend: 'Password for [DOMAINE\\administrator]:', reponds: 'Le mot de passe de l’administrateur, tapé au terminal.' }] }),
      lec('Vérifier la résolution dans les deux sens', 'nslookup interroge le serveur DNS configuré : d’abord le nom vers l’adresse, ensuite l’adresse vers le nom.', [sh('nslookup {{hote}}.{{zone}}'), sh('nslookup {{ip}}')], 'L’adresse choisie pour le nom, puis le nom complet de l’hôte pour l’adresse.', { verification: true, important: 'Si le client ne retrouve rien, vérifie que son serveur DNS est bien le contrôleur de domaine (resolvectl status), pas une autre adresse.' }),
    ],
    verification: ['nslookup résout le nom vers l’adresse ET l’adresse vers le nom.'],
    retour: 'samba-tool dns delete serveur zone nom A adresse -U administrator supprime un enregistrement ; samba-tool dns zonedelete serveur zoneInverse -U administrator supprime la zone inverse.',
    sources: [{ label: 'samba-tool — dns', url: `${SAMBA_DOC}/samba-tool.8.html` }, { label: 'Wiki Samba — DNS Administration', url: `${SAMBA_WIKI}/DNS_Administration` }],
  }),

  ficheLinux({
    id: 'cours-ubuntu-jonction-ad',
    titre: 'Joindre un poste Ubuntu à un domaine Samba AD (realmd et SSSD)',
    resume: 'Pointe le DNS du poste vers le contrôleur, aligne l’heure, installe realmd et SSSD, joint le domaine, active la création des dossiers personnels et teste une connexion. Le mot de passe de l’administrateur est saisi à l’invite ; aucun accès sudo n’est donné aux comptes du domaine.',
    effet: 'interruption',
    intentions: ['joindre ubuntu au domaine ad', 'realm join', 'sssd ad ubuntu', 'pam-auth-update mkhomedir', 'client ubuntu samba ad', 'realm discover', 'se connecter avec un compte du domaine ubuntu'],
    motsCles: ['realm', 'realmd', 'sssd', 'adcli', 'pam-auth-update', 'mkhomedir', 'resolvectl', 'netplan', 'timesyncd', 'kerberos', 'domaine', 'jonction', 'ubuntu'],
    params: [
      { id: 'domaine', label: 'nom du domaine', type: 'fqdn', exemple: 'serveur2.lan', aide: 'Le nom DNS du domaine Active Directory.' },
      { id: 'dns', label: 'adresse du contrôleur de domaine (DNS)', type: 'ipv4', exemple: '172.27.1.210', aide: 'Le serveur DNS du domaine : le contrôleur lui-même.' },
      { id: 'interface', label: 'interface réseau du poste', type: 'identifiant', exemple: 'ens33', aide: 'Lue dans « ip -br link » ; ne la suppose pas.' },
      { id: 'nom', label: 'nom complet du poste', type: 'fqdn', exemple: 'ubuntuclient.serveur2.lan', aide: 'Nom d’hôte du poste suivi du domaine.' },
      { id: 'admin', label: 'compte qui joint le poste', type: 'identifiant', exemple: 'administrator', aide: 'Un compte du domaine autorisé à joindre des machines.' },
      { id: 'compteTest', label: 'compte du domaine pour le test', type: 'identifiant', exemple: 'user1', aide: 'Un compte existant du domaine.' },
    ],
    privileges: 'Administrateur du poste : sudo. Accès réseau au contrôleur de domaine.',
    etapes: [
      lec('Lire l’état du réseau et du DNS', 'Relève le nom de l’interface et les serveurs DNS actuels : ce sont ton retour en arrière.', [sh('ip -br link'), sh('resolvectl status')], 'Une ligne par interface ; les serveurs DNS actuels de chaque interface.', { important: 'Sur Ubuntu récent, /etc/resolv.conf pointe vers 127.0.0.53 (systemd-resolved) : c’est normal. Ne le modifie pas à la main et ne désactive pas systemd-resolved : on configure le DNS par netplan à l’étape suivante.' }),
      itr('Pointer le DNS vers le contrôleur de domaine', 'Crée un fichier netplan qui ajoute le serveur DNS du domaine et le domaine de recherche à l’interface. netplan try applique la configuration et la RETIRE d’elle-même si tu n’appuies pas sur Entrée à temps : tu ne perds pas la connexion à cause d’une faute.', [
        sh('sudo tee /etc/netplan/60-domaine-ad.yaml <<\'EOF\''),
        sh('network:'),
        sh('  version: 2'),
        sh('  ethernets:'),
        sh('    {{interface}}:'),
        sh('      nameservers:'),
        sh('        addresses: [{{dns}}]'),
        sh('        search: [{{domaine}}]'),
        sh('EOF'),
        sh('sudo chmod 600 /etc/netplan/60-domaine-ad.yaml'),
        sh('sudo netplan try'),
      ], 'netplan try affiche un compte à rebours et attend ta confirmation.', { interactions: [{ attend: 'Press ENTER before the timeout to accept the new configuration', reponds: 'Entrée, une fois que tu vérifies que la connexion fonctionne encore.' }], important: 'Si l’interface reçoit son adresse par DHCP, le DNS fourni par le DHCP peut passer avant le tien : ajoute alors « dhcp4-overrides: { use-dns: false } » sous l’interface. Si le poste est configuré par NetworkManager (version Desktop), règle plutôt le DNS dans la connexion réseau.' }),
      lec('Vérifier que le domaine est trouvé par le DNS', 'Les enregistrements SRV annoncent les services LDAP et Kerberos du contrôleur : sans eux, la jonction échoue.', [sh('resolvectl query {{domaine}}'), sh('resolvectl query -t SRV _ldap._tcp.{{domaine}}')], 'L’adresse du contrôleur, puis un enregistrement SRV qui pointe vers lui.', { verification: true }),
      mod('Nommer le poste', 'realm et Kerberos exigent un nom d’hôte complet dans le domaine.', [sh('sudo hostnamectl set-hostname {{nom}}')], 'Aucun message.'),
      mod('Aligner l’heure (Kerberos tolère 5 minutes d’écart)', 'Un écart d’horloge de plus de cinq minutes fait échouer l’authentification Kerberos. Le fichier ci-dessous fait synchroniser l’heure sur le contrôleur, si celui-ci fournit un service NTP ; sinon utilise une source NTP commune au poste et au contrôleur.', [
        sh('sudo mkdir -p /etc/systemd/timesyncd.conf.d'),
        sh('sudo tee /etc/systemd/timesyncd.conf.d/domaine-ad.conf <<\'EOF\''),
        sh('[Time]'),
        sh('NTP={{dns}}'),
        sh('EOF'),
        sh('sudo systemctl restart systemd-timesyncd'),
        sh('timedatectl timesync-status'),
      ], 'timesync-status affiche le serveur utilisé et un décalage de quelques millisecondes.', { verification: true }),
      mod('Installer realmd, SSSD et leurs dépendances', 'realmd pilote la jonction ; SSSD fournit les comptes et l’authentification du domaine ; adcli joint la machine ; packagekit permet à realm d’installer ce qu’il manque.', [sh('sudo apt update'), sh('sudo apt install -y realmd sssd sssd-ad sssd-tools libnss-sss libpam-sss adcli samba-common-bin oddjob oddjob-mkhomedir packagekit')], 'apt installe les paquets sans erreur.'),
      lec('Découvrir le domaine', 'realm discover interroge le DNS et affiche les paquets requis et le type de domaine, SANS rien changer.', [sh('realm discover {{domaine}}')], 'Le nom du domaine, « type: kerberos », « server-software: active-directory », « client-software: sssd ».', { verification: true }),
      itr('Joindre le domaine', 'Crée le compte machine dans l’annuaire et configure SSSD. Le mot de passe de l’administrateur est demandé à l’invite.', [sh('sudo realm join --user={{admin}} {{domaine}}')], 'Après le mot de passe, la commande se termine sans message : le poste est joint.', { interactions: [{ attend: 'Password for administrator:', reponds: 'Le mot de passe du compte, tapé au terminal (rien ne s’affiche).' }], important: 'Cette étape modifie l’annuaire (compte machine) et la configuration d’authentification du poste. Ne la lance qu’une fois les étapes précédentes vérifiées.' }),
      mod('Créer automatiquement le dossier personnel', 'pam-auth-update --enable active le profil mkhomedir : le dossier /home/compte@domaine est créé à la première connexion.', [sh('sudo pam-auth-update --enable mkhomedir')], 'Aucun message en cas de succès.'),
      lec('Tester la résolution d’un compte du domaine', 'id et getent interrogent SSSD : ils doivent retrouver le compte avec ses groupes.', [sh('id {{compteTest}}@{{domaine}}'), sh('getent passwd {{compteTest}}@{{domaine}}')], 'Un uid, un gid et des groupes du domaine ; une ligne passwd avec le dossier personnel prévu.', { verification: true, important: 'Aucun compte du domaine n’a de droits sudo à ce stade, et c’est volontaire : donne-les par groupe, un par un (realm permit ou un fichier sudoers limité à un groupe précis), jamais à tous les comptes du domaine.' }),
      lec('Tester une ouverture de session', 'su ouvre une session du compte (mot de passe demandé) et doit créer son dossier personnel.', [sh('su - {{compteTest}}@{{domaine}}')], 'Une invite au nom du compte, dans son dossier personnel tout neuf.', { interactions: [{ attend: 'Password:', reponds: 'Le mot de passe du compte de test, tapé au terminal. exit pour revenir.' }] }),
      itr('Dépannage — vider le cache SSSD', 'Si un compte récemment créé ou modifié n’est pas vu, SSSD garde peut-être une ancienne réponse en cache. Vide-le et redémarre le service. Lis d’abord le journal pour savoir POURQUOI.', [sh('sudo journalctl -u sssd -n 50 --no-pager'), sh('sudo sss_cache -E'), sh('sudo systemctl restart sssd')], 'Le journal indique la cause ; après le redémarrage, id retrouve le compte.', { facultatif: true }),
      lec('Dernier recours — assouplir le contrôle d’accès GPO', 'Si, et seulement si, le journal montre que des règles GPO refusent la connexion alors que le compte est légitime, SSSD permet de basculer ce contrôle en mode « permissive » : les refus sont journalisés mais plus appliqués. Ce n’est PAS une réparation générale : il désactive de fait ce contrôle d’accès. Cette étape se contente de LIRE le réglage actuel ; la modifier reste ta décision, après diagnostic.', [sh('sudo grep -n ad_gpo_access_control /etc/sssd/sssd.conf')], 'La ligne actuelle du réglage, ou aucune sortie si le défaut s’applique.', { facultatif: true, dernierRecours: true, important: 'Cherche d’abord la règle GPO responsable et corrige-la ou le compte. N’active « permissive » que temporairement, pour diagnostiquer, et remets-le en mode normal ensuite.' }),
    ],
    verification: ['realm list montre le domaine ; id retrouve un compte du domaine avec ses groupes ; une session s’ouvre et crée le dossier personnel.'],
    retour: 'sudo realm leave quitte le domaine côté poste ; supprime aussi le compte machine dans l’annuaire. Supprime /etc/netplan/60-domaine-ad.yaml et /etc/systemd/timesyncd.conf.d/domaine-ad.conf, puis sudo netplan apply.',
    sources: [
      { label: 'Ubuntu Server — SSSD avec Active Directory', url: 'https://documentation.ubuntu.com/server/how-to/sssd/with-active-directory/' },
      { label: 'realm(8)', url: `${MAN}/man8/realm.8.html` },
      { label: 'netplan — référence', url: 'https://netplan.readthedocs.io/en/stable/netplan-yaml/' },
      { label: 'resolvectl(1)', url: `${MAN}/man1/resolvectl.1.html` },
      { label: 'sssd-ad(5)', url: `${MAN}/man5/sssd-ad.5.html` },
    ],
  }),

  {
    id: 'cours-rsat-windows',
    titre: 'Installer les outils RSAT (AD et DNS) sur un poste Windows',
    categorie: 'Active Directory',
    resume: 'Vérifie les fonctionnalités RSAT disponibles, installe celles d’Active Directory et de DNS sur un poste Windows 10 ou 11, puis contrôle leur état. L’installation demande une connexion Internet ou une source Windows Update et peut durer plusieurs minutes.',
    effet: 'modification',
    intentions: ['installer rsat', 'rsat windows 11', 'add-windowscapability rsat', 'gestionnaire dns rsat', 'utilisateurs et ordinateurs active directory poste', 'outils d administration à distance'],
    motsCles: ['rsat', 'add-windowscapability', 'get-windowscapability', 'dns', 'active directory', 'dsa.msc', 'dnsmgmt.msc', 'outils'],
    params: [],
    methodes: [{ id: 'powershell', privileges: 'PowerShell **en administrateur** sur un poste Windows 10 ou 11 (pas sur Windows Server, qui utilise Install-WindowsFeature).', etapes: [
      lec('Voir l’état des fonctionnalités RSAT', 'Liste les fonctionnalités RSAT et leur état (Installed ou NotPresent). Ne modifie rien.', [ps('Get-WindowsCapability -Online -Name "Rsat.*" | Select-Object Name, State')], 'Une ligne par outil RSAT, avec son état.'),
      mod('Installer les outils Active Directory', 'Installe « Utilisateurs et ordinateurs Active Directory » et les autres consoles AD DS. Attends la fin complète de l’installation.', [ps('Add-WindowsCapability -Online -Name "Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0"')], 'Un objet avec Online : True, et RestartNeeded : False en général.', { important: 'Nécessite l’accès à Windows Update (ou à une source de fonctionnalités à la demande configurée par ton organisation).' }),
      mod('Installer les outils DNS', 'Installe le « Gestionnaire DNS », avec lequel on administre le DNS d’un contrôleur de domaine Samba à distance.', [ps('Add-WindowsCapability -Online -Name "Rsat.Dns.Tools~~~~0.0.1.0"')], 'Un objet avec Online : True.'),
      lec('Contrôler l’installation', 'Les deux fonctionnalités doivent être à l’état Installed.', [ps('Get-WindowsCapability -Online -Name "Rsat.ActiveDirectory*","Rsat.Dns*" | Select-Object Name, State')], 'State : Installed pour les deux lignes.', { verification: true }),
      lec('Ouvrir les consoles', 'dsa.msc ouvre « Utilisateurs et ordinateurs AD », dnsmgmt.msc le « Gestionnaire DNS » (à connecter au contrôleur de domaine).', [ps('dsa.msc'), ps('dnsmgmt.msc')], 'Les deux consoles s’ouvrent ; le poste doit être dans le domaine ou joindre le contrôleur par son nom.', { facultatif: true }),
    ], verification: ['Get-WindowsCapability affiche Installed pour les outils AD et DNS.'], retour: 'Remove-WindowsCapability -Online -Name "<nom exact>" désinstalle un outil.' }],
    assistant: null,
    sources: [
      { label: 'Add-WindowsCapability', url: 'https://learn.microsoft.com/powershell/module/dism/add-windowscapability' },
      { label: 'Get-WindowsCapability', url: 'https://learn.microsoft.com/powershell/module/dism/get-windowscapability' },
      { label: 'Remote Server Administration Tools (RSAT)', url: 'https://learn.microsoft.com/windows-server/remote/remote-server-administration-tools' },
    ],
    validation: V_COURS,
    origine: 'cours',
  },
];

export { CATEGORIE_LINUX };
