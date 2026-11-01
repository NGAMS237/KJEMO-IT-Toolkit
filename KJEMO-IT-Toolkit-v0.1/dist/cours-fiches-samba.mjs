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
import { MAN, CATEGORIE_LINUX, V_COURS, lec, mod, des, itr, sh, ps, gui, ficheLinux } from './cours-outils.mjs';

const SAMBA_DOC = 'https://www.samba.org/samba/docs/current/man-html';
const SAMBA_WIKI = 'https://wiki.samba.org/index.php';

// Étapes de la jonction écrites une fois, rattachées au client Ubuntu par cl() dans la fiche ci-dessous.
const JONCTION_ANCIENNES = [
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
      mod('Nommer le poste', 'realm et Kerberos exigent un nom d’hôte complet dans le domaine.', [sh('sudo hostnamectl set-hostname {{poste}}.{{domaine}}')], 'Aucun message.'),
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
];
const sur = (machine, etape) => ({ ...etape, machine });
const cl = (etape) => sur('client-ubuntu', /^(Client|Serveur|Annuler|Purger) —/.test(etape.titre) ? etape : { ...etape, titre: `Client — ${etape.titre.charAt(0).toLowerCase()}${etape.titre.slice(1)}` });
const S = 'serveur'; const U = 'client-ubuntu';

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
    titre: 'Joindre un poste Ubuntu à un domaine Samba AD (serveur et client)',
    resume: 'Parcours complet sur deux postes : préparer le contrôleur Samba, préparer le client Ubuntu (DNS, nom, heure, realmd et SSSD), joindre le domaine, tester, puis annuler ou purger des deux côtés en cas d’erreur. Chaque étape dit sur quel poste elle se fait. Option graphique : fiche « … par l’interface graphique ».',
    effet: 'interruption',
    intentions: ['joindre ubuntu au domaine ad', 'realm join', 'sssd ad ubuntu', 'pam-auth-update mkhomedir', 'client ubuntu samba ad', 'realm discover', 'se connecter avec un compte du domaine ubuntu', 'realm leave', 'annuler la jonction au domaine', 'samba-tool computer delete'],
    motsCles: ['realm', 'realmd', 'sssd', 'adcli', 'pam-auth-update', 'mkhomedir', 'resolvectl', 'netplan', 'timesyncd', 'kerberos', 'domaine', 'jonction', 'ubuntu', 'serveur', 'client', 'purge', 'annuler'],
    prerequis: [
      { texte: 'Le contrôleur de domaine Samba est installé, démarré et le domaine existe.', fiche: 'cours-samba-groupes' },
      { texte: 'Le client Ubuntu a une adresse IP fixe et joint le serveur par ping.', fiche: 'cours-ubuntu-reseau-client' },
    ],
    params: [
      { id: 'domaine', label: 'nom du domaine', type: 'fqdn', exemple: 'serveur2.lan', aide: 'Le nom DNS du domaine Active Directory.', trouver: { poste: 'serveur', commande: 'sudo samba-tool domain info 127.0.0.1' } },
      { id: 'serveur', label: 'nom complet du contrôleur de domaine', type: 'fqdn', exemple: 'serverdc.serveur2.lan', aide: 'Le nom DNS complet du serveur Samba.', trouver: { poste: 'serveur', commande: 'hostname -f' } },
      { id: 'dns', label: 'adresse IP du contrôleur de domaine (DNS)', type: 'ipv4', exemple: '172.27.1.210', aide: 'Le serveur DNS du domaine : le contrôleur lui-même.', trouver: { poste: 'serveur', commande: 'ip -br address' } },
      { id: 'admin', label: 'compte qui joint le poste et administre le domaine', type: 'identifiant', exemple: 'administrator', aide: 'Un compte du domaine autorisé à joindre des machines. Son mot de passe est demandé à l’invite.', trouver: { poste: 'serveur', commande: 'sudo samba-tool user list' } },
      { id: 'interface', label: 'interface réseau du client', type: 'identifiant', exemple: 'ens33', aide: 'Lue sur le client ; ne la suppose pas.', trouver: { poste: 'client-ubuntu', commande: 'ip -br link' } },
      { id: 'poste', label: 'nom court voulu pour le client', type: 'hote', exemple: 'ubuntuclient', aide: 'Lettres, chiffres et tirets, sans point. Le nom complet sera ce nom suivi du domaine.', trouver: { poste: 'client-ubuntu', commande: 'hostnamectl --static', texte: '(le nom actuel, à noter pour pouvoir y revenir)' } },
      { id: 'ancienNom', label: 'nom actuel du client (pour y revenir)', type: 'hote', exemple: 'ubuntu', aide: 'Sert seulement à la partie « Annuler ou purger ».', trouver: { poste: 'client-ubuntu', commande: 'hostnamectl --static' } },
      { id: 'ipClient', label: 'adresse IP du client', type: 'ipv4', exemple: '172.27.1.230', aide: 'Une adresse FIXE du même réseau que le serveur.', trouver: { poste: 'client-ubuntu', commande: 'ip -br address' } },
      { id: 'zoneInverse', label: 'zone inverse du réseau /24', type: 'fqdn', exemple: '1.27.172.in-addr.arpa', aide: 'Les trois premiers octets à l’envers suivis de .in-addr.arpa : pour 172.27.1.0/24, 1.27.172.in-addr.arpa.', trouver: { poste: 'serveur', commande: 'samba-tool dns zonelist <serveur> -U administrator', texte: '(la zone existe-t-elle déjà ?)' } },
      { id: 'dernierOctet', label: 'dernier nombre de l’adresse du client', type: 'entier', min: 1, max: 254, exemple: '230', aide: 'Le nom de l’enregistrement inverse : 230 pour 172.27.1.230.', trouver: { poste: 'client-ubuntu', commande: 'ip -br address', texte: '(le dernier nombre de l’adresse)' } },
      { id: 'compteTest', label: 'compte du domaine pour le test', type: 'identifiant', exemple: 'user1', aide: 'Un compte existant du domaine.', trouver: { poste: 'serveur', commande: 'sudo samba-tool user list' } },
    ],
    privileges: 'Administrateur du serveur Samba (sudo) ET du poste client (sudo). Chaque étape indique le poste où la lancer.',
    etapes: [
      // ----------------------------------------------------------- 1. PRÉPARER LE SERVEUR
      sur(S, lec('Serveur — vérifier que le contrôleur de domaine fonctionne', 'Le service doit être actif et répondre avant toute jonction.', [sh('sudo systemctl is-active samba-ad-dc'), sh('sudo samba-tool domain info {{dns}}')], '« active », puis les lignes Forest, Domain et Netbios domain name.', { important: 'Service inactif : démarre-le avec sudo systemctl start samba-ad-dc et relis le journal avant de continuer.' })),
      sur(S, lec('Serveur — vérifier l’heure', 'Kerberos refuse l’authentification si les horloges du client et du serveur diffèrent de plus de cinq minutes. Le client sera aligné sur ce serveur.', [sh('timedatectl')], '« System clock synchronized: yes » et une heure correcte.', { important: 'Si l’heure du serveur est fausse, corrige-la d’abord : tout ce qui suit en dépend.' })),
      sur(S, lec('Serveur — vérifier le pare-feu', 'Si ufw est actif, il doit laisser passer le trafic du domaine depuis le réseau du client.', [sh('sudo ufw status')], '« Status: inactive », ou une liste de règles.', { important: 'Ports du domaine : 53 (DNS), 88 et 464 (Kerberos), 123 (heure), 135, 139, 389, 445, 636, 3268 et 3269. Ouvre-les seulement si ufw est actif et que la jonction échoue.' })),
      sur(S, mod('Serveur — déclarer le client dans le DNS (nom vers adresse)', 'La jonction crée normalement l’enregistrement toute seule. Fais cette étape seulement si, après la jonction, nslookup ne trouve pas le client.', [sh('samba-tool dns add {{serveur}} {{domaine}} {{poste}} A {{ipClient}} -U {{admin}}')], '« Record added successfully ».', { facultatif: true, interactions: [{ attend: 'Password for [DOMAINE\\administrator]:', reponds: 'Le mot de passe de l’administrateur du domaine, tapé au terminal.' }], important: 'Réservé à un client à adresse FIXE. Si l’enregistrement existe déjà, la commande le dit : ne l’ajoute pas deux fois.' })),
      sur(S, mod('Serveur — déclarer le client dans le DNS (adresse vers nom)', 'L’enregistrement inverse permet de retrouver le nom à partir de l’adresse. La zone inverse doit exister : sinon, crée-la avec la fiche DNS de Samba.', [sh('samba-tool dns add {{serveur}} {{zoneInverse}} {{dernierOctet}} PTR {{poste}}.{{domaine}} -U {{admin}}')], '« Record added successfully ».', { facultatif: true, interactions: [{ attend: 'Password for [DOMAINE\\administrator]:', reponds: 'Le mot de passe de l’administrateur du domaine, tapé au terminal.' }] })),
      // ----------------------------------------------------------- 2. PRÉPARER LE CLIENT
      sur(U, lec('Client — lire le réseau, le DNS et le nom actuel', 'Relève le nom de l’interface, les serveurs DNS actuels et le nom d’hôte : ce sont tes points de retour.', [sh('ip -br link'), sh('resolvectl status'), sh('hostnamectl --static')], 'Une ligne par interface ; les serveurs DNS actuels ; le nom d’hôte actuel (à noter).', { important: 'Sur Ubuntu récent, /etc/resolv.conf pointe vers 127.0.0.53 (systemd-resolved) : c’est normal. Ne le modifie pas à la main.' })),
      cl(JONCTION_ANCIENNES[1]),
      cl(JONCTION_ANCIENNES[2]),
      sur(U, mod('Client — nommer le poste', 'realm et Kerberos exigent un nom d’hôte complet dans le domaine. Le nom précédent a été noté à l’étape de lecture.', [sh('echo "127.0.1.1 {{poste}}.{{domaine}} {{poste}}" | sudo tee -a /etc/hosts'), sh('sudo hostnamectl set-hostname {{poste}}.{{domaine}}')], 'Aucune erreur ; hostname -f affiche le nom complet.', { important: 'La ligne ajoutée dans /etc/hosts évite le message « sudo : impossible de résoudre l’hôte » après le changement de nom.' })),
      cl(JONCTION_ANCIENNES[4]),
      cl(JONCTION_ANCIENNES[5]),
      cl(JONCTION_ANCIENNES[6]),
      // ----------------------------------------------------------- 3. JOINDRE
      cl(JONCTION_ANCIENNES[7]),
      sur(S, lec('Serveur — confirmer que le compte machine existe', 'La jonction crée un compte d’ordinateur dans l’annuaire du serveur : c’est la preuve côté serveur.', [sh('sudo samba-tool computer list | grep -i {{poste}}')], 'Une ligne avec le nom du poste suivi de « $ ».', { verification: true, important: 'Aucune ligne alors que realm join a réussi : relis le journal du serveur avec sudo journalctl -u samba-ad-dc -n 50 --no-pager.' })),
      cl(JONCTION_ANCIENNES[8]),
      cl(JONCTION_ANCIENNES[9]),
      cl(JONCTION_ANCIENNES[10]),
      cl(JONCTION_ANCIENNES[11]),
      cl(JONCTION_ANCIENNES[12]),
      // ----------------------------------------------------------- 4. ANNULER OU PURGER
      sur(U, lec('Annuler — constater l’état du client', 'Avant de défaire, relève ce qui est en place : cela évite de supprimer ce qui n’y est pas.', [sh('realm list'), sh('ls /etc/netplan /etc/systemd/timesyncd.conf.d'), sh('hostnamectl --static')], 'Le domaine joint (ou rien), les fichiers netplan et timesyncd ajoutés, et le nom d’hôte actuel.', { facultatif: true, important: 'À partir d’ici, tout sert à défaire. Fais ces étapes dans l’ordre : d’abord le client, ensuite le serveur.' })),
      sur(U, des('Annuler — quitter le domaine côté client et retirer le compte machine', 'realm leave retire la configuration SSSD du poste. --remove supprime aussi le compte d’ordinateur dans l’annuaire (mot de passe de l’administrateur demandé).', [sh('sudo realm leave --remove --user={{admin}} {{domaine}}')], 'Aucun message en cas de succès. Un échec d’authentification : le compte machine reste, nettoie-le côté serveur plus bas.', { facultatif: true, interactions: [{ attend: 'Password for administrator:', reponds: 'Le mot de passe du compte, tapé au terminal.' }] })),
      sur(U, mod('Annuler — retirer la création automatique des dossiers personnels', 'Défait le profil mkhomedir activé pendant la jonction.', [sh('sudo pam-auth-update --remove mkhomedir')], 'Aucun message en cas de succès.', { facultatif: true })),
      sur(U, mod('Annuler — vider le cache SSSD', 'Oublie les comptes du domaine gardés en mémoire.', [sh('sudo sss_cache -E')], 'Aucun message. « command not found » : SSSD est déjà désinstallé, passe à la suite.', { facultatif: true })),
      sur(U, itr('Annuler — retirer le DNS et l’heure du domaine', 'Supprime les deux fichiers de configuration ajoutés pendant la préparation, puis réapplique. netplan try annule tout seul si tu ne confirmes pas.', [sh('sudo rm /etc/netplan/60-domaine-ad.yaml'), sh('sudo rm /etc/systemd/timesyncd.conf.d/domaine-ad.conf'), sh('sudo netplan try'), sh('sudo systemctl restart systemd-timesyncd')], 'netplan try demande confirmation (Entrée) ; resolvectl status n’affiche plus le serveur du domaine.', { facultatif: true, interactions: [{ attend: 'Press ENTER before the timeout to accept the new configuration', reponds: 'Entrée, une fois que tu vérifies que la connexion fonctionne encore.' }], important: 'Ces deux fichiers sont ceux créés par cette fiche. Si tu avais déjà un fichier du même nom, ne le supprime pas.' })),
      sur(U, mod('Annuler — rendre au poste son nom d’origine', 'Retire la ligne ajoutée dans /etc/hosts et remet le nom d’hôte noté au début.', [sh('sudo sed -i \'/{{poste}}.{{domaine}}/d\' /etc/hosts'), sh('sudo hostnamectl set-hostname {{ancienNom}}')], 'Aucune erreur.', { facultatif: true })),
      sur(U, des('Purger — désinstaller realmd et SSSD (facultatif)', 'Retire les paquets de jonction et leurs réglages. À faire seulement pour revenir à un poste vierge ; le poste fonctionne très bien sans cette étape.', [sh('sudo apt purge -y realmd sssd sssd-ad sssd-tools adcli oddjob oddjob-mkhomedir'), sh('sudo apt autoremove -y')], 'apt liste les paquets retirés sans erreur.', { facultatif: true, important: 'samba-common-bin, packagekit, libnss-sss et libpam-sss sont laissés : d’autres logiciels peuvent en dépendre. Un mauvais autoremove retire des paquets que tu n’as pas listés : lis la liste avant de confirmer.' })),
      sur(S, lec('Serveur — vérifier que le compte machine a disparu', 'Après realm leave --remove, le compte d’ordinateur ne doit plus figurer dans l’annuaire.', [sh('sudo samba-tool computer list | grep -i {{poste}}')], 'Aucune ligne. Une ligne : le compte est resté, supprime-le à l’étape suivante.', { facultatif: true })),
      sur(S, des('Serveur — supprimer le compte machine resté (après un échec)', 'Un realm join raté ou un realm leave sans --remove laisse un compte d’ordinateur dans l’annuaire. Il faut le supprimer pour pouvoir rejoindre avec le même nom.', [sh('sudo samba-tool computer delete {{poste}}')], 'Un message de suppression réussie. « Unable to find » : il n’y a plus rien à supprimer.', { facultatif: true, important: 'Supprime un compte d’ordinateur de l’annuaire, sans corbeille. Vérifie le nom à l’étape précédente.' })),
      sur(S, des('Serveur — supprimer les enregistrements DNS du client', 'Retire le nom vers adresse, puis l’adresse vers nom. Pour les enregistrements créés par la jonction ou à la main.', [sh('samba-tool dns delete {{serveur}} {{domaine}} {{poste}} A {{ipClient}} -U {{admin}}'), sh('samba-tool dns delete {{serveur}} {{zoneInverse}} {{dernierOctet}} PTR {{poste}}.{{domaine}} -U {{admin}}')], '« Record deleted successfully » pour chacun. « Record does not exist » : déjà supprimé.', { facultatif: true, interactions: [{ attend: 'Password for [DOMAINE\\administrator]:', reponds: 'Le mot de passe de l’administrateur du domaine, tapé au terminal (une fois par commande).' }] })),
      sur(U, lec('Annuler — vérifier le retour à l’état initial', 'Le poste ne doit plus connaître le domaine ni ses comptes.', [sh('realm list'), sh('id {{compteTest}}@{{domaine}}')], 'realm list n’affiche rien ; id répond « no such user ».', { facultatif: true, verification: true })),
    ],
    verification: ['realm list montre le domaine ; id retrouve un compte du domaine avec ses groupes ; une session s’ouvre et crée le dossier personnel ; samba-tool computer list montre le client sur le serveur.', 'Après une annulation : realm list est vide et samba-tool computer list ne montre plus le client.'],
    retour: 'Les étapes « Annuler » et « Purger » défont tout, dans l’ordre : le client (realm leave --remove, mkhomedir, cache SSSD, netplan et heure, nom d’hôte, paquets), puis le serveur (compte machine, enregistrements DNS).',
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

/** Fiches de l'aide-mémoire (origine « memo ») rattachées au TP2 : jonction par l'interface graphique. */
export const COURS_SAMBA_MEMO = [
(() => {
    const U2 = (e) => ({ ...e, machine: U });
    const S2 = (e) => ({ ...e, machine: S });
    const annul = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
    const f = ficheLinux({
      id: 'cours-ubuntu-jonction-ad-graphique',
      titre: 'Joindre Ubuntu à un domaine Samba AD par l’interface graphique',
      resume: 'Alternative aux commandes : préparer le DNS du client, puis joindre le domaine avec Cockpit (navigateur) ou avec Paramètres. La préparation (DNS, heure, paquets) reste indispensable ; l’onglet Terminal la fait pas à pas et contrôle le serveur.',
      effet: 'interruption',
      intentions: ['joindre ubuntu au domaine avec interface graphique', 'cockpit join domain', 'ubuntu rejoindre active directory sans terminal', 'connexion d’entreprise ubuntu', 'enterprise login ubuntu', 'realm join graphique', 'connection refused resolvectl domaine', 'le client ne trouve pas le domaine'],
      motsCles: ['cockpit', 'graphique', 'interface', 'paramètres', 'connexion d’entreprise', 'enterprise login', 'realmd', 'domaine', 'jonction', 'ubuntu', 'dns', 'networkmanager'],
      prerequis: [
        { texte: 'Le contrôleur de domaine Samba est installé et démarré (service samba-ad-dc actif, DNS sur le port 53).', fiche: 'samba-ad-installer' },
        { texte: 'Le client Ubuntu a une adresse du même réseau et joint le serveur par ping.', fiche: 'cours-ubuntu-reseau-client' },
      ],
      params: [
        { id: 'domaine', label: 'nom du domaine', type: 'fqdn', exemple: 'ad.lab', aide: 'Le nom DNS du domaine Active Directory.', trouver: { poste: 'serveur', commande: 'sudo samba-tool domain info 127.0.0.1' } },
        { id: 'dns', label: 'adresse IP du contrôleur de domaine (DNS)', type: 'ipv4', exemple: '192.168.20.1', aide: 'Le serveur DNS du domaine : le contrôleur lui-même.', trouver: { poste: 'serveur', commande: 'ip -br address' } },
        { id: 'admin', label: 'compte qui joint le poste', type: 'identifiant', exemple: 'administrator', aide: 'Un compte du domaine autorisé à joindre des machines. Son mot de passe est demandé à l’invite ou dans la fenêtre.', trouver: { poste: 'serveur', commande: 'sudo samba-tool user list' } },
        { id: 'connexion', label: 'nom de la connexion réseau du client', type: 'nom', exemple: 'Wired connection 1', aide: 'Celle de la carte reliée au serveur.', trouver: { poste: 'client-ubuntu', commande: 'nmcli -f NAME,DEVICE connection show --active' } },
        { id: 'poste', label: 'nom court voulu pour le client', type: 'hote', exemple: 'ubuntuclient', aide: 'Lettres, chiffres et tirets, sans point.', trouver: { poste: 'client-ubuntu', commande: 'hostnamectl --static', texte: '(le nom actuel, à noter pour pouvoir y revenir)' } },
        { id: 'ancienNom', label: 'nom actuel du client (pour y revenir)', type: 'hote', exemple: 'ubuntu', aide: 'Sert seulement à la partie « Annuler ».', trouver: { poste: 'client-ubuntu', commande: 'hostnamectl --static' } },
        { id: 'compteTest', label: 'compte du domaine pour le test', type: 'identifiant', exemple: 'user1', aide: 'Un compte existant du domaine.', trouver: { poste: 'serveur', commande: 'sudo samba-tool user list' } },
      ],
      privileges: 'Administrateur du poste client (sudo) ; le serveur sert aux contrôles.',
      etapes: [
        // ----------------------------------------------------------- Terminal : préparer, joindre, vérifier
        S2(lec('Serveur — le service de domaine répond sur le DNS (port 53)', 'Un « Connection refused » côté client veut dire que rien n’écoute le DNS sur le serveur. Contrôle d’abord le service puis le port : sans DNS, ni le terminal ni l’interface graphique ne peuvent joindre le domaine.', [sh('sudo systemctl is-active samba-ad-dc'), sh('sudo ss -lunpt | grep \':53 \''), sh('sudo ufw status')], '« active », une ligne qui écoute sur le port 53 (samba ou named), et ufw inactif ou avec une règle pour le port 53.', { important: 'Si le port 53 n’est pas écouté, ne continue pas : lis « sudo systemctl status samba-ad-dc » et corrige le serveur.' })),
        U2(lec('Client — joindre le serveur', 'Repère la connexion et vérifie que le serveur répond au ping.', [sh('nmcli -f NAME,DEVICE connection show --active'), sh('ip -br address'), sh('ping -c 2 {{dns}}')], 'Une connexion active, une adresse du même réseau que le serveur, 0% packet loss.')),
        U2(itr('Client — pointer le DNS vers le serveur (NetworkManager)', 'Sur Ubuntu Desktop, c’est NetworkManager qui gère la carte : on règle le DNS avec nmcli (même effet que l’onglet IPv4 de Paramètres). La connexion se coupe une seconde.', [sh('sudo nmcli connection modify \'{{connexion}}\' ipv4.dns {{dns}} ipv4.dns-search {{domaine}}'), sh('sudo nmcli connection up \'{{connexion}}\'')], 'Connection successfully activated.')),
        U2(lec('Client — vérifier que le domaine est trouvé', 'Le nom du domaine et l’enregistrement SRV du contrôleur doivent être résolus.', [sh('resolvectl query {{domaine}}'), sh('resolvectl query -t SRV _ldap._tcp.{{domaine}}')], 'Une adresse pour le domaine et un enregistrement SRV.', { verification: true, important: 'Tant que cette étape échoue, la jonction échouera.' })),
        U2(mod('Client — nommer le poste', 'Le nom complet est aussi écrit dans /etc/hosts, sinon sudo se plaint de ne pas pouvoir résoudre le nom du poste.', [sh('echo "127.0.1.1 {{poste}}.{{domaine}} {{poste}}" | sudo tee -a /etc/hosts'), sh('sudo hostnamectl set-hostname {{poste}}.{{domaine}}')], 'Aucune erreur ; hostname -f affiche le nom complet.')),
        U2(lec('Client — contrôler l’heure', 'Kerberos refuse l’authentification si l’écart avec le serveur dépasse cinq minutes. Compare avec l’heure du serveur.', [sh('timedatectl')], '« System clock synchronized: yes » et une heure correcte.')),
        U2(mod('Client — installer Cockpit, realmd et SSSD', 'Cockpit est l’interface web d’administration ; realmd et SSSD font la jonction. Installés à l’avance, ils évitent une installation en cours de route.', [sh('sudo apt update'), sh('sudo apt install -y cockpit realmd sssd sssd-ad sssd-tools libnss-sss libpam-sss adcli samba-common-bin oddjob oddjob-mkhomedir packagekit'), sh('sudo systemctl enable --now cockpit.socket')], 'Les paquets s’installent ; cockpit.socket est actif (port 9090).')),
        U2(lec('Client — découvrir le domaine', 'realm discover interroge le DNS : si le domaine est trouvé, la jonction graphique le sera aussi.', [sh('realm discover {{domaine}}')], 'Le nom du domaine, « type: kerberos » et « server-software: active-directory ».', { verification: true })),
        U2(itr('Client — joindre le domaine (équivalent du bouton Joindre)', 'Même opération que dans Cockpit, en une commande. Utilise-la si la fenêtre graphique échoue : son message d’erreur est plus précis. Le mot de passe est demandé à l’invite.', [sh('sudo realm join --user={{admin}} {{domaine}}')], 'Aucun message : le poste est joint.', { interactions: [{ attend: 'Password for administrator:', reponds: 'Le mot de passe du compte du domaine, tapé au terminal (rien ne s’affiche).' }], facultatif: true })),
        U2(mod('Client — créer automatiquement le dossier personnel', 'Sans cela, un compte du domaine n’a pas de dossier à sa première ouverture de session.', [sh('sudo pam-auth-update --enable mkhomedir')], 'Aucun message.')),
        U2(lec('Client — vérifier la jonction', 'realm list montre le domaine ; id retrouve un compte du domaine.', [sh('realm list'), sh('id {{compteTest}}@{{domaine}}')], 'Le domaine avec « configured: kerberos-member », puis l’identifiant du compte.', { verification: true })),
        // ----------------------------------------------------------- Annuler (terminal)
        U2(lec('Annuler — constater l’état du client', 'Avant de défaire, regarde ce qui est en place.', [sh('realm list'), sh('hostnamectl --static')], 'Le domaine joint (ou rien) et le nom actuel.', { facultatif: true, phase: 'Annuler ou défaire' })),
        U2(des('Annuler — quitter le domaine', 'Sort le poste du domaine et supprime son compte machine côté serveur. Le mot de passe est demandé à l’invite.', [sh('sudo realm leave --remove --user={{admin}} {{domaine}}')], 'Aucun message ; realm list ne montre plus le domaine.', { ...annul, interactions: [{ attend: 'Password for administrator:', reponds: 'Le mot de passe du compte du domaine, tapé au terminal (rien ne s’affiche).' }] })),
        U2(mod('Annuler — retirer la création des dossiers personnels', 'Annule pam-auth-update --enable mkhomedir.', [sh('sudo pam-auth-update --remove mkhomedir')], 'Aucun message.', annul)),
        U2(itr('Annuler — rendre le DNS au réseau', 'Efface le DNS et le domaine de recherche imposés à la connexion ; le DHCP les redonne.', [sh('sudo nmcli connection modify \'{{connexion}}\' ipv4.dns "" ipv4.dns-search ""'), sh('sudo nmcli connection up \'{{connexion}}\'')], 'Connection successfully activated.', annul)),
        U2(mod('Annuler — rendre au poste son nom d’origine', 'Retire la ligne ajoutée dans /etc/hosts et remet l’ancien nom.', [sh('sudo sed -i \'/{{poste}}.{{domaine}}/d\' /etc/hosts'), sh('sudo hostnamectl set-hostname {{ancienNom}}')], 'Aucune erreur ; hostnamectl --static affiche l’ancien nom.', annul)),
        S2(mod('Annuler — supprimer le compte machine resté sur le serveur', 'Seulement si la jonction a échoué à moitié et que le compte machine existe encore.', [sh('sudo samba-tool computer list | grep -i {{poste}}'), sh('sudo samba-tool computer delete {{poste}}')], 'La liste ne montre plus le poste.', annul)),
      ],
      verification: ['realm discover trouve le domaine.', 'realm list montre « kerberos-member ».', 'id retrouve un compte du domaine.'],
      retour: 'Les commandes sont dans les étapes « Annuler » : quitter le domaine, rendre le DNS et le nom d’origine.',
      sources: [
        { label: 'Cockpit — realmd (joindre un domaine)', url: 'https://cockpit-project.org/guide/latest/feature-realmd.html' },
        { label: 'Oracle Linux — Cockpit : joindre un domaine Active Directory', url: 'https://docs.oracle.com/en/operating-systems/oracle-linux/cockpit/cockpit-system_join_a_domain.html' },
        { label: 'Guide GNOME — connexion avec des identifiants d’entreprise', url: 'https://help.gnome.org/system-admin-guide/login-enterprise.html' },
        { label: 'realm(8)', url: `${MAN}/man8/realm.8.html` },
        { label: 'nmcli — référence', url: 'https://networkmanager.dev/docs/api/latest/nmcli.html' },
      ],
    });
    f.origine = 'memo';
    const gui2 = (e) => U2(e);
    f.methodes.unshift({
      id: 'gui', privileges: 'Administrateur du poste client Ubuntu Desktop (mot de passe demandé).',
      etapes: [
        gui2(gui('Faire la préparation d’abord', 'lecture', 'La jonction graphique a les mêmes exigences que la jonction par commandes : le client doit trouver le domaine par le DNS, avoir la bonne heure et avoir realmd. Un « Connection refused » à ce stade vient presque toujours du serveur (le DNS n’écoute pas).', ['Ouvre l’onglet **Terminal** de cette fiche et fais, dans l’ordre : le contrôle du serveur, le DNS du client, **vérifier que le domaine est trouvé**, le nom du poste, l’heure et l’installation de Cockpit.', 'Ne passe à la suite que si **realm discover** trouve le domaine.'], 'realm discover affiche le domaine.', { important: 'Les étapes de préparation sont des commandes : elles n’ont pas d’équivalent fiable en clics.' })),
        gui2(gui('Ouvrir Cockpit', 'lecture', 'Cockpit est une page web servie par le client lui-même, sur le port 9090.', ['Dans **Firefox**, ouvre l’adresse **https://localhost:9090**.', 'Accepte l’avertissement de certificat (certificat auto-signé de ton propre poste).', 'Ouvre une session avec ton compte local, puis clique **Accès limité** (en haut) et saisis ton mot de passe pour passer en mode administrateur.'], 'Le tableau de bord de Cockpit s’affiche, sans cadenas « accès limité ».')),
        gui2(gui('Joindre le domaine depuis Cockpit', 'interruption', 'Cockpit appelle realmd, comme la commande realm join.', ['Dans le menu de gauche, clique **Vue d’ensemble** (Overview).', 'Dans le panneau **Configuration**, ligne **Domaine**, clique **Joindre le domaine** (Join domain).', 'Saisis l’**adresse du domaine**, le **compte administrateur du domaine** (par exemple administrator) et son **mot de passe**, puis clique **Joindre**.', 'Si Cockpit propose d’installer des paquets manquants, accepte.'], 'La ligne Domaine affiche le nom du domaine.', { important: 'Si la fenêtre affiche une erreur, note-la et utilise l’étape « joindre le domaine » de l’onglet Terminal : son message est plus précis.' })),
        gui2(gui('Créer automatiquement le dossier personnel', 'modification', 'Cockpit ne règle pas les dossiers personnels des comptes du domaine : c’est une commande.', ['Dans l’onglet **Terminal**, fais l’étape **créer automatiquement le dossier personnel**.'], 'Aucun message.')),
        gui2(gui('Ouvrir une session avec un compte du domaine', 'lecture', 'Le nom de connexion s’écrit compte@domaine.', ['Ferme ta session (menu en haut à droite, **Fermer la session**).', 'À l’écran de connexion, choisis **Non listé ?** s’il est proposé, puis saisis **compte@domaine** et le mot de passe du compte.'], 'La session s’ouvre ; un dossier personnel est créé.', { verification: true })),
        gui2(gui('Variante : Paramètres › Utilisateurs › Connexion d’entreprise', 'modification', 'Le guide GNOME décrit cette voie. Je ne l’ai pas vérifiée sur Ubuntu 24.04 : si l’option n’apparaît pas, utilise Cockpit.', ['Ouvre **Paramètres**, puis **Utilisateurs**, clique **Déverrouiller** et saisis ton mot de passe.', 'Clique **+**, choisis **Connexion d’entreprise** (Enterprise Login).', 'Saisis le **domaine**, le **compte** et le **mot de passe**, puis clique **Ajouter**.'], 'Le compte du domaine apparaît dans la liste des utilisateurs.', { facultatif: true })),
        gui2(gui('Annuler — quitter le domaine', 'modification', 'Cockpit affiche le domaine joint dans la vue d’ensemble, avec la possibilité de le quitter. Je n’ai pas pu confirmer le libellé exact du bouton.', ['Dans **Cockpit › Vue d’ensemble**, clique le **nom du domaine** (ligne Domaine) puis **Quitter le domaine** (Leave domain).', 'Si ce n’est pas proposé, fais l’étape **Annuler — quitter le domaine** de l’onglet Terminal.', 'Pour le DNS et le nom du poste : étapes **Annuler** de l’onglet Terminal.'], 'La ligne Domaine n’affiche plus le domaine (et realm list ne le montre plus).', annul)),
      ],
      verification: ['Cockpit affiche le domaine dans la vue d’ensemble.', 'Une session s’ouvre avec compte@domaine.'],
      retour: 'Cockpit › Vue d’ensemble › nom du domaine › Quitter le domaine ; puis les étapes Annuler de l’onglet Terminal.',
    });
    return f;
  })()
];

/** Installer un contrôleur de domaine Samba AD (Ubuntu récent), d'après la documentation Ubuntu Server. */
COURS_SAMBA_MEMO.push((() => {
  const sv = (e) => ({ ...e, machine: S });
  const annul = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
  const f = ficheLinux({
    id: 'samba-ad-installer',
    titre: 'Installer un contrôleur de domaine Samba AD sur Ubuntu',
    resume: 'Du serveur vide au domaine qui répond : nom et adresse, paquets, provisionnement, DNS et Kerberos, vérifications, puis annulation complète pour recommencer. Le mot de passe de l’administrateur se tape au terminal, jamais dans l’app.',
    effet: 'interruption',
    intentions: ['installer samba active directory ubuntu', 'samba-tool domain provision', 'créer un domaine samba ad', 'contrôleur de domaine samba ubuntu', 'samba-ad-dc ne démarre pas port 53', 'systemd-resolved samba ad dns', 'dns forwarder samba', 'recommencer le provisionnement samba', 'purger un domaine samba', 'installer le domaine ad.lab'],
    motsCles: ['samba', 'samba-tool', 'provision', 'active directory', 'contrôleur de domaine', 'kerberos', 'krb5', 'samba-ad-dc', 'systemd-resolved', 'dns forwarder', 'chrony', 'domaine', 'serveur', 'purge', 'annuler'],
    params: [
      { id: 'domaine', label: 'nom DNS du domaine', type: 'fqdn', exemple: 'ad.lab', aide: 'En minuscules. Évite un nom qui existe sur Internet (.com) ; .lab ou .internal conviennent au laboratoire.', trouver: { poste: 'serveur', commande: 'sudo samba-tool domain info 127.0.0.1', texte: '(s’il existe déjà ; sinon, tu l’inventes)' } },
      { id: 'royaume', label: 'royaume Kerberos (realm)', type: 'fqdn', exemple: 'AD.LAB', aide: 'Le nom du domaine en MAJUSCULES.' },
      { id: 'netbios', label: 'nom court du domaine (NetBIOS)', type: 'identifiant', exemple: 'AD', aide: '15 caractères au plus, en majuscules ; c’est le préfixe de connexion (AD\\compte).' },
      { id: 'hote', label: 'nom court du serveur', type: 'hote', exemple: 'serverdc', aide: 'Lettres, chiffres et tirets, sans point.', trouver: { poste: 'serveur', commande: 'hostnamectl --static' } },
      { id: 'fqdn', label: 'nom complet du serveur', type: 'fqdn', exemple: 'serverdc.ad.lab', aide: 'Le nom court suivi du domaine.' },
      { id: 'ipServeur', label: 'adresse IP du serveur', type: 'ipv4', exemple: '192.168.20.1', aide: 'Une adresse FIXE ; ce sera aussi le DNS des clients.', trouver: { poste: 'serveur', commande: 'ip -br address' } },
      { id: 'reseau', label: 'réseau des clients', type: 'cidr', exemple: '192.168.20.0/24', aide: 'Le réseau d’où viennent les clients, avec son préfixe.', trouver: { poste: 'serveur', commande: 'ip -br address', texte: '(l’adresse du serveur avec le dernier nombre à 0)' } },
      { id: 'forwarder', label: 'DNS en amont (Internet)', type: 'ipv4', exemple: '192.168.1.1', aide: 'Le serveur DNS qui répond aux noms d’Internet : souvent le routeur. PAS 127.0.0.53.', trouver: { poste: 'serveur', commande: 'resolvectl status', texte: '(ligne « Current DNS Server », AVANT de désactiver systemd-resolved)' } },
      { id: 'interface', label: 'interface réseau du serveur', type: 'identifiant', exemple: 'eth1', aide: 'Seulement pour fixer l’adresse (étape facultative).', trouver: { poste: 'serveur', commande: 'ip -br link' } },
      { id: 'prefixe', label: 'longueur du préfixe', type: 'prefixe', exemple: '24', aide: 'Ex. 24 pour 255.255.255.0.' },
      { id: 'passerelle', label: 'passerelle', type: 'ipv4', exemple: '192.168.20.254', aide: 'Seulement pour fixer l’adresse (étape facultative). Le routeur du réseau.', trouver: { poste: 'serveur', commande: 'ip route show default' } },
    ],
    privileges: 'Administrateur du serveur : sudo. Un serveur Ubuntu dédié (une VM suffit), avec accès Internet pour installer les paquets.',
    etapes: [
      // ---------------------------------------------------------- 1. PRÉPARER
      sv(lec('Lire l’état de départ', 'Note le nom, l’adresse et la présence d’un ancien smb.conf : provision refuse de travailler si un smb.conf existe.', [sh('hostnamectl --static'), sh('ip -br address'), sh('ls -l /etc/samba')], 'Un nom, une adresse du bon réseau, et pas de domaine déjà provisionné.', { phase: 'Préparer' })),
      sv(itr('Fixer l’adresse IP du serveur (facultatif)', 'Une adresse qui change casse tout le domaine. Si ton adresse est déjà fixe (réservation DHCP, hyperviseur), saute cette étape. netplan try annule tout seul au bout de 120 secondes si tu ne confirmes pas.', [
        sh('sudo tee /etc/netplan/60-samba-ad.yaml <<\'EOF\''),
        sh('network:'), sh('  version: 2'), sh('  ethernets:'), sh('    {{interface}}:'), sh('      dhcp4: false'), sh('      addresses: [{{ipServeur}}/{{prefixe}}]'),
        sh('      routes:'), sh('        - to: default'), sh('          via: {{passerelle}}'), sh('      nameservers:'), sh('        addresses: [{{forwarder}}]'), sh('EOF'),
        sh('sudo chmod 600 /etc/netplan/60-samba-ad.yaml'), sh('sudo netplan try'),
      ], 'netplan try demande de confirmer avec Entrée avant la fin du compte à rebours.', { facultatif: true, phase: 'Préparer', interactions: [{ attend: 'Press ENTER before the timeout to accept the new configuration', reponds: 'Entrée, une fois que tu vérifies que la connexion fonctionne encore.' }], important: 'Si un autre fichier de /etc/netplan configure déjà cette interface (cloud-init, installateur), les deux se combinent : lis-les avant. Fais-le depuis la console de la VM, pas en SSH.' })),
      sv(mod('Donner au serveur son nom complet', 'Le nom complet doit se résoudre vers l’adresse RÉELLE du serveur, jamais vers 127.0.1.1 : sinon le domaine publie une mauvaise adresse. On sauvegarde /etc/hosts, on retire la ligne 127.0.1.1 et on ajoute la bonne.', [
        sh('sudo cp -a /etc/hosts /etc/hosts.avant-ad'), sh('sudo sed -i \'/^127\\.0\\.1\\.1/d\' /etc/hosts'),
        sh('echo "{{ipServeur}} {{fqdn}} {{hote}}" | sudo tee -a /etc/hosts'), sh('sudo hostnamectl set-hostname {{fqdn}}'),
      ], 'Aucune erreur.', { phase: 'Préparer' })),
      sv(lec('Vérifier le nom', 'hostname -f doit afficher le nom complet, et getent l’adresse réelle du serveur.', [sh('hostname -f'), sh('getent hosts {{fqdn}}')], 'Le nom complet, puis l’adresse du serveur (pas 127.0.1.1).', { phase: 'Préparer', verification: true })),
      sv(mod('Servir l’heure aux clients (facultatif)', 'Kerberos refuse un écart de plus de cinq minutes. Un client réglé avec NTP=adresse du serveur n’obtient aucune réponse tant que le serveur ne sert pas l’heure : c’est ce que fait chrony (« Packet count: 0 » côté client). « local stratum 10 » lui permet de servir sa propre horloge sans Internet.', [
        sh('sudo apt install -y chrony'), sh('sudo mkdir -p /etc/chrony/conf.d'),
        sh('printf \'allow {{reseau}}\\nlocal stratum 10\\n\' | sudo tee /etc/chrony/conf.d/domaine-ad.conf'), sh('sudo systemctl restart chrony'), sh('chronyc tracking'),
      ], 'chronyc tracking affiche une ligne « Reference ID » et « Leap status : Normal ».', { facultatif: true, phase: 'Préparer', important: 'Installer chrony remplace systemd-timesyncd sur ce serveur. Non testé ici : lis chronyc tracking avant de t’y fier.' })),
      // ---------------------------------------------------------- 2. INSTALLER
      sv(mod('Installer les paquets', 'samba-ad-dc est le contrôleur de domaine ; krb5-user donne kinit pour tester ; bind9-dnsutils donne dig. DEBIAN_FRONTEND=noninteractive évite les questions de krb5 (le fichier est de toute façon remplacé plus loin).', [sh('sudo apt update'), sh('sudo DEBIAN_FRONTEND=noninteractive apt install -y samba-ad-dc krb5-user bind9-dnsutils')], 'Les paquets s’installent sans erreur.', { phase: 'Installer' })),
      sv(mod('Arrêter les services de partage classiques', 'Un contrôleur de domaine utilise un seul service, samba-ad-dc. smbd, nmbd et winbind sont arrêtés et masqués pour qu’ils ne démarrent jamais en même temps. Un message « unit not found » pour l’un d’eux est sans gravité.', [
        sh('sudo systemctl disable --now smbd nmbd winbind'), sh('sudo systemctl mask smbd nmbd winbind'), sh('sudo systemctl unmask samba-ad-dc'), sh('sudo systemctl enable samba-ad-dc'),
      ], 'Aucune erreur bloquante ; samba-ad-dc est enabled mais pas encore démarré.', { phase: 'Installer' })),
      sv(mod('Mettre l’ancien smb.conf de côté', 'provision refuse d’écraser un smb.conf existant. On le range sous un autre nom : l’annulation pourra le remettre.', [sh('sudo mv /etc/samba/smb.conf /etc/samba/smb.conf.orig')], 'Aucune erreur (ou « No such file » si aucun smb.conf n’existait).', { phase: 'Installer' })),
      sv(mod('Provisionner le domaine', 'Crée le domaine : bases de données, comptes, DNS interne (SAMBA_INTERNAL), Kerberos. Sans --adminpass, un mot de passe aléatoire est généré et affiché dans le résultat.', [sh('sudo samba-tool domain provision --domain {{netbios}} --realm={{royaume}} --server-role=dc --use-rfc2307 --dns-backend=SAMBA_INTERNAL')], 'Les dernières lignes affichent « Server Role: active directory domain controller », le domaine et le mot de passe de l’administrateur.', { phase: 'Installer', important: 'IRRÉVERSIBLE : il n’existe pas de « dé-provisionner ». Pour recommencer, utilise la partie « Annuler ou défaire ». Note le mot de passe affiché : l’étape suivante le remplace.' })),
      sv(itr('Choisir le mot de passe de l’administrateur', 'Remplace le mot de passe aléatoire. Il se tape ICI, au terminal : l’app ne le voit jamais. Le domaine exige un mot de passe complexe (8 caractères, majuscule, minuscule, chiffre).', [sh('sudo samba-tool user setpassword Administrator')], 'Changed password OK.', { phase: 'Installer', interactions: [{ attend: 'New Password:', reponds: 'Le nouveau mot de passe, tapé au terminal (rien ne s’affiche), puis une seconde fois pour confirmer.' }] })),
      // ---------------------------------------------------------- 3. DNS ET KERBEROS
      sv(lec('Lire le DNS en amont proposé', 'provision recopie souvent le DNS du système, qui est ici le relais local de systemd-resolved (127.0.0.53) : il disparaîtra à l’étape suivante et le domaine ne résoudrait plus Internet.', [sh('grep -n "dns forwarder" /etc/samba/smb.conf')], 'Une ligne « dns forwarder = … ».', { phase: 'DNS et Kerberos' })),
      sv(mod('Fixer le DNS en amont', 'Remplace la valeur par le vrai DNS d’Internet (le routeur, par exemple). Les clients résolvent le domaine chez Samba, et Samba relaie le reste.', [sh('sudo sed -i \'s/^[[:space:]]*dns forwarder = .*/\\tdns forwarder = {{forwarder}}/\' /etc/samba/smb.conf'), sh('grep -n "dns forwarder" /etc/samba/smb.conf'), sh('sudo testparm -s > /dev/null')], 'La ligne affiche votre DNS ; testparm ne signale aucune erreur.', { phase: 'DNS et Kerberos', important: 'Si grep ne montre aucune ligne, ajoute « dns forwarder = … » dans la section [global] avec un éditeur (sudo nano /etc/samba/smb.conf).' })),
      sv(itr('Libérer le port 53 et pointer le serveur sur lui-même', 'systemd-resolved occupe déjà le port 53 : sans cette étape, samba-ad-dc ne peut pas démarrer son DNS. Le serveur utilise ensuite son propre DNS (127.0.0.1).', [
        sh('sudo systemctl disable --now systemd-resolved'), sh('sudo unlink /etc/resolv.conf'),
        sh('printf \'nameserver 127.0.0.1\\nsearch {{domaine}}\\n\' | sudo tee /etc/resolv.conf'),
      ], 'resolv.conf contient « nameserver 127.0.0.1 ». sudo peut se plaindre de DNS jusqu’au démarrage de Samba.', { phase: 'DNS et Kerberos', important: 'C’est la cause la plus fréquente de « Connection refused » côté client : le DNS n’écoute pas parce que le port 53 est pris ou que le service n’a pas démarré.' })),
      sv(mod('Installer la configuration Kerberos générée', 'provision a écrit un krb5.conf exact pour ce domaine.', [sh('sudo cp -f /var/lib/samba/private/krb5.conf /etc/krb5.conf')], 'Aucune erreur.', { phase: 'DNS et Kerberos' })),
      sv(itr('Démarrer le contrôleur de domaine', 'Démarre le service. Le premier démarrage prend quelques secondes.', [sh('sudo systemctl start samba-ad-dc')], 'Aucune sortie ; l’étape suivante confirme.', { phase: 'DNS et Kerberos' })),
      // ---------------------------------------------------------- 4. VÉRIFIER
      sv(lec('Le service tourne et le DNS écoute', 'samba-ad-dc doit être actif et quelque chose doit écouter le port 53 en UDP et en TCP.', [sh('sudo systemctl is-active samba-ad-dc'), sh('sudo ss -lunpt | grep \':53 \'')], '« active », puis des lignes sur le port 53 (samba).', { phase: 'Vérifier', verification: true, important: 'Si le service est « failed » : sudo journalctl -u samba-ad-dc -n 50 --no-pager. Port 53 déjà pris : revois l’étape systemd-resolved.' })),
      sv(lec('Les enregistrements du domaine existent', 'Le DNS de Samba doit publier les services du domaine (SRV) et l’adresse du serveur.', [sh('dig @localhost +short -t SRV _ldap._tcp.{{domaine}}'), sh('dig @localhost +short -t SRV _kerberos._tcp.{{domaine}}'), sh('dig @localhost +short -t A {{fqdn}}')], 'Des lignes avec le nom du serveur, puis son adresse IP.', { phase: 'Vérifier', verification: true })),
      sv(lec('Obtenir un ticket Kerberos', 'Prouve que le royaume et le mot de passe fonctionnent. Se lance sans sudo.', [sh('kinit Administrator'), sh('klist')], 'klist affiche un ticket krbtgt pour votre royaume.', { phase: 'Vérifier', verification: true, interactions: [{ attend: 'Password for Administrator@AD.LAB:', reponds: 'Le mot de passe de l’administrateur du domaine, tapé au terminal (rien ne s’affiche).' }] })),
      sv(lec('Lire le domaine et ses comptes', 'Confirme que le domaine est créé et que les comptes de base existent.', [sh('sudo samba-tool domain info 127.0.0.1'), sh('sudo samba-tool user list')], 'Forest, Domain et Netbios domain name ; la liste contient Administrator et krbtgt.', { phase: 'Vérifier', verification: true })),
      sv(mod('Ouvrir le pare-feu aux clients (si ufw est actif)', 'Si « sudo ufw status » dit inactive, saute cette étape. Sinon, ouvre les ports du domaine (DNS, Kerberos, heure, RPC, LDAP, SMB) au réseau des clients seulement.', [
        sh('sudo ufw status'), sh('for p in 53 88 123 135 389 445 464 636 3268 3269; do sudo ufw allow from {{reseau}} to any port $p; done'), sh('sudo ufw allow from {{reseau}} to any port 49152:65535 proto tcp'),
      ], 'ufw liste les règles ajoutées.', { facultatif: true, phase: 'Vérifier' })),
      // ---------------------------------------------------------- ANNULER
      sv(lec('Annuler — constater l’état', 'Avant de défaire, regarde ce qui est en place.', [sh('sudo systemctl is-active samba-ad-dc'), sh('ls /var/lib/samba/private'), sh('ls -l /etc/samba')], 'Le service et les fichiers du domaine, s’ils existent.', { facultatif: true, phase: 'Annuler ou défaire' })),
      sv(des('Annuler — supprimer le domaine', 'EFFACE le domaine : comptes, groupes, DNS, mots de passe. Tous les clients joints devront être purgés. Sur Ubuntu, les bases sont dans /var/lib/samba.', [
        sh('sudo systemctl stop samba-ad-dc'), sh('sudo systemctl disable samba-ad-dc'), sh('sudo rm -f /etc/samba/smb.conf'),
        sh('sudo rm -rf /var/lib/samba/private/* /var/lib/samba/sysvol'), sh('sudo rm -f /var/lib/samba/*.tdb /var/lib/samba/*.ldb'),
      ], 'Le service est arrêté ; /var/lib/samba/private est vide.', { ...annul, important: 'Irréversible. Vérifie que tu es bien sur le serveur de laboratoire.' })),
      sv(mod('Annuler — remettre l’ancien smb.conf', 'Remet le fichier rangé avant le provisionnement, s’il existait.', [sh('sudo mv /etc/samba/smb.conf.orig /etc/samba/smb.conf')], 'Aucune erreur (ou « No such file » si aucun ancien fichier).', annul)),
      sv(itr('Annuler — rendre le DNS au système', 'Remet le lien habituel de resolv.conf et relance systemd-resolved.', [sh('sudo rm -f /etc/resolv.conf'), sh('sudo ln -s ../run/systemd/resolve/stub-resolv.conf /etc/resolv.conf'), sh('sudo systemctl enable --now systemd-resolved')], 'resolvectl status répond ; un nom d’Internet se résout.', annul)),
      sv(mod('Annuler — remettre /etc/hosts, l’heure et l’adresse', 'Remet le fichier hosts d’avant, retire la configuration chrony et le fichier netplan ajoutés (seulement si tu avais fait ces étapes facultatives).', [sh('sudo cp -a /etc/hosts.avant-ad /etc/hosts'), sh('sudo rm -f /etc/chrony/conf.d/domaine-ad.conf'), sh('sudo rm -f /etc/netplan/60-samba-ad.yaml')], 'Aucune erreur.', annul)),
      sv(mod('Annuler — rendre leurs services à smbd, nmbd et winbind', 'Les retire de l’état « masqué » pour pouvoir en faire un simple serveur de fichiers plus tard.', [sh('sudo systemctl unmask smbd nmbd winbind')], 'Aucune erreur.', annul)),
      sv(des('Annuler — désinstaller les paquets (facultatif)', 'Seulement si tu veux repartir d’une machine sans Samba.', [sh('sudo apt purge -y samba-ad-dc krb5-user'), sh('sudo apt autoremove -y')], 'Les paquets sont retirés.', annul)),
      sv(lec('Annuler — vérifier le retour à zéro', 'Plus de domaine, plus de service sur le port 53 de Samba.', [sh('sudo systemctl is-active samba-ad-dc'), sh('ls /var/lib/samba/private')], '« inactive » (ou unit not found) et un dossier vide.', { facultatif: true, phase: 'Annuler ou défaire' })),
    ],
    verification: ['samba-ad-dc est actif et le port 53 est écouté.', 'dig trouve les enregistrements SRV et l’adresse du serveur.', 'kinit Administrator donne un ticket.'],
    retour: 'Les commandes sont dans les étapes « Annuler ou défaire » : supprimer le domaine, remettre smb.conf, le DNS et /etc/hosts.',
    sources: [
      { label: 'Ubuntu Server — Provisioning a Samba Active Directory Domain Controller', url: 'https://ubuntu.com/server/docs/how-to/samba/provision-samba-ad-controller/' },
      { label: 'Wiki Samba — Setting up Samba as an Active Directory Domain Controller', url: `${SAMBA_WIKI}/Setting_up_Samba_as_an_Active_Directory_Domain_Controller` },
      { label: 'samba-tool — domain provision', url: `${SAMBA_DOC}/samba-tool.8.html` },
      { label: 'chrony — documentation', url: 'https://chrony-project.org/documentation.html' },
    ],
  });
  f.origine = 'memo';
  return f;
})());

/** Parcourir un partage Samba depuis Ubuntu : session smbclient, montage cifs, dépannage « la lecture seule laisse écrire ». */
COURS_SAMBA_MEMO.push((() => {
  const cl = (e) => ({ ...e, machine: U });
  const sv = (e) => ({ ...e, machine: S });
  const annul = { facultatif: true, annulation: true, phase: 'Annuler ou défaire' };
  const mdp = { attend: 'Password for', reponds: 'Tape le mot de passe du compte (rien ne s’affiche), puis Entrée.' };
  const f = ficheLinux({
    id: 'samba-partage-parcourir',
    titre: 'Parcourir un partage Samba depuis Ubuntu (smbclient, montage)',
    resume: 'Un partage vit sur le serveur : « cd » et « ls -l » du terminal ne le voient pas. Deux façons de s’y promener : la session interactive de smbclient (invite smb:) ou le montage cifs, qui en fait un vrai dossier. Dépannage « le compte en lecture seule peut écrire ». Option graphique : Fichiers › Autres emplacements.',
    effet: 'modification',
    intentions: ['parcourir un partage samba', 'smbclient session interactive', 'cd partage samba ne marche pas', 'monter un partage samba ubuntu', 'mount -t cifs', 'smb: prompt ls cd put get', 'lecture seule peut écrire samba', 'read list ne marche pas', 'naviguer dans le dossier partagé'],
    motsCles: ['smbclient', 'cifs', 'mount', 'partage', 'samba', 'smb', 'read list', 'lecture seule', 'cd', 'ls', 'put', 'get', 'testparm'],
    prerequis: [{ texte: 'Le partage et le compte existent côté serveur.', fiche: 'cours-samba-partage-groupe' }],
    params: [
      { id: 'serveur', label: 'nom ou adresse IP du serveur', type: 'identifiant', exemple: '192.168.20.1', aide: 'Celle du serveur Samba.' },
      { id: 'partage', label: 'nom du partage', type: 'identifiant', exemple: 'direction', aide: 'Le nom déclaré entre crochets dans smb.conf.' },
      { id: 'domaine', label: 'nom NetBIOS du domaine', type: 'identifiant', exemple: 'SERVEUR2', aide: 'Le « workgroup » du domaine (testparm l’affiche), PAS le nom DNS (ad.lab).', trouver: { poste: 'serveur', commande: 'grep workgroup /etc/samba/smb.conf' } },
      { id: 'compte', label: 'compte du domaine', type: 'identifiant', exemple: 'receptioniste', aide: 'Écris-le exactement comme dans « samba-tool user list » (une lettre de trop ou en moins donne NT_STATUS_LOGON_FAILURE).', trouver: { poste: 'serveur', commande: 'sudo samba-tool user list' } },
    ],
    privileges: 'Utilisateur du client Ubuntu ; sudo pour installer et monter. Les mots de passe se tapent à l’invite.',
    etapes: [
      cl(mod('Installer smbclient et cifs-utils', 'smbclient sert à la session interactive, cifs-utils au montage.', [sh('sudo apt install smbclient cifs-utils')], 'Les paquets sont installés (ou déjà à jour).', { facultatif: true })),
      cl(lec('Lister les partages du serveur', 'Vérifie que le compte est accepté et que le partage existe. -W prend le nom NetBIOS court du domaine.', [sh('smbclient -L //{{serveur}} -W {{domaine}} -U {{compte}}')], 'Une table de partages dont {{partage}}. NT_STATUS_LOGON_FAILURE : compte mal orthographié, mauvais mot de passe ou mauvais nom de domaine.', { interactions: [mdp] })),
      cl(itr('Entrer dans le partage (session interactive)', 'Sans -c, smbclient ouvre l’invite « smb: \\> ». Les commandes ne sont plus celles de ton terminal : ls, cd, pwd, mkdir, put (envoyer un fichier local), get (rapatrier un fichier), rm, rmdir, lcd (changer le dossier LOCAL), exit. « ls -l » et « cd /{{partage}} » du terminal ne voient pas le partage : il est sur le serveur.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compte}}')], 'L’invite devient smb: \\>. Tape ls pour voir le contenu, puis exit pour sortir.', { facultatif: true, interactions: [mdp, { attend: 'smb: \\>', reponds: 'ls, cd nom, pwd, get fichier, put fichier, puis exit pour quitter.' }] })),
      cl(lec('Une commande à la fois (-c)', 'Avec -c, smbclient exécute les commandes entre apostrophes puis se ferme : pratique pour un test rapide.', [sh('smbclient //{{serveur}}/{{partage}} -W {{domaine}} -U {{compte}} -c \'pwd; ls\'')], 'Le dossier courant du partage et son contenu.', { interactions: [mdp] })),
      cl(mod('Monter le partage comme un dossier (facultatif)', 'Après le montage, cd et ls -l fonctionnent normalement dans /mnt/{{partage}}. Le mot de passe est demandé à l’invite, jamais écrit dans la commande.', [sh('sudo mkdir -p /mnt/{{partage}}'), sh('sudo mount -t cifs //{{serveur}}/{{partage}} /mnt/{{partage}} -o username={{compte}},domain={{domaine}}')], 'Aucun message. Une erreur « mount error(13) » : identifiants refusés ; « mount error(2) » : partage introuvable.', { facultatif: true, interactions: [mdp] })),
      cl(lec('Parcourir le dossier monté', 'Si tu as monté le partage, c’est un dossier ordinaire.', [sh('ls -l /mnt/{{partage}}')], 'Le contenu du partage, avec les droits.', { verification: true })),
      cl(mod('Annuler — démonter le partage', 'Libère le dossier de montage. À faire avant de supprimer le point de montage.', [sh('sudo umount /mnt/{{partage}}')], 'Aucun message ; ls -l /mnt/{{partage}} est vide.', annul)),
      cl(des('Annuler — supprimer le point de montage', 'Supprime le dossier vide /mnt/{{partage}} (échoue s’il n’est pas vide : c’est voulu).', [sh('sudo rmdir /mnt/{{partage}}')], 'Aucun message.', annul)),
      sv(lec('Dépannage : le compte en lecture seule peut écrire — voir le partage', 'À lancer sur le SERVEUR. Regarde les lignes « read list », « write list » et « valid users » du partage. Le nom du compte doit y être écrit EXACTEMENT comme dans l’annuaire : avec une lettre de différence, Samba ne le reconnaît pas et le laisse écrire par son groupe.', [sh('sudo testparm -s 2>/dev/null | sed -n \'/^\\[{{partage}}\\]/,/^$/p\'')], 'Les réglages du partage ; la ligne read list contient le compte en lecture seule.')),
      sv(lec('Dépannage : comparer avec les comptes de l’annuaire', 'Cherche l’orthographe exacte du compte.', [sh('sudo samba-tool user list')], 'La liste des comptes ; l’orthographe doit être identique à celle de read list.', { verification: true })),
    ],
    verification: ['Le contenu du partage s’affiche dans la session smbclient ou dans le dossier monté, et le compte en lecture seule reçoit NT_STATUS_ACCESS_DENIED quand il essaie d’écrire.'],
    retour: null,
    sources: [{ label: 'smbclient(1)', url: `${SAMBA_DOC}/smbclient.1.html` }, { label: 'smb.conf — read list, write list', url: `${SAMBA_DOC}/smb.conf.5.html` }, { label: 'mount.cifs(8)', url: `${MAN}/man8/mount.cifs.8.html` }],
  });
  f.origine = 'memo';
  f.methodes.unshift({
    id: 'gui', privileges: 'Utilisateur ordinaire du client Ubuntu Desktop.',
    etapes: [
      gui('Ouvrir le partage dans Fichiers', 'lecture', 'Le gestionnaire de fichiers monte le partage sans rien installer : tu y navigues comme dans un dossier.', ['Ouvre **Fichiers**, puis **Autres emplacements**.', 'En bas, dans **Se connecter à un serveur**, tape `smb://` suivi de l’adresse du serveur, puis `/` et le nom du partage. **Se connecter**.', 'Choisis **Utilisateur enregistré**, saisis le compte et le domaine (nom NetBIOS), le mot de passe dans cette fenêtre, puis **Se connecter**.'], 'Le contenu du partage s’affiche ; on y navigue en double-cliquant.'),
      gui('Annuler — éjecter le partage', 'modification', 'Ferme la connexion : indispensable avant de te reconnecter avec un autre compte.', ['Dans la barre latérale, clique l’icône **Éjecter** à côté du partage.'], 'Le partage disparaît de la barre latérale.', annul),
    ],
    verification: ['Le contenu du partage est visible dans Fichiers.'],
    retour: 'Éjecter le partage.',
  });
  return f;
})());
