/**
 * commandes-samba.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides de Samba. ELLES OBSERVENT TOUTES.
 *
 * Deux actions auraient pu figurer ici, et n'y sont pas :
 *
 *   smbpasswd -a   elle demande un secret à la console. C'est la BONNE façon,
 *                  et c'est précisément pourquoi elle n'est pas une commande
 *                  rapide : un bloc copiable avec un mot de passe dedans est
 *                  un mot de passe dans l'historique du terminal.
 *   smbcontrol smbd reload-config
 *                  elle met en service un fichier qu'on n'a peut-être pas
 *                  relu, et elle n'a pas d'inverse : on ne « dé-recharge »
 *                  pas. Elle vit dans l'assistant samba-share-create, qui ne
 *                  l'exécute qu'après une relecture réussie, et dans la
 *                  procédure d'annulation, où elle vient APRÈS la
 *                  restauration et la relecture.
 *
 * Toutes les commandes de ce fichier sont sans effet sur la configuration,
 * sur les comptes et sur les permissions.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

export const commandesSamba = [
  {
    id: 'cr-samba-testparm',
    notion: 'samba-readiness',
    besoin: 'Vérifier que la configuration Samba est valide, sans rien appliquer.',
    commande: 'testparm -s',
    exemple: 'testparm -s',
    parametres: [],
    options: [
      { option: '-s', explication: '-s supprime l’invite. Sans lui, testparm affiche les noms de services puis ATTEND une touche avant de continuer : dans un script, cela ressemble à un blocage. Sa page de manuel le dit explicitement.' },
    ],
    resultat: 'La configuration EFFECTIVE, telle que Samba la comprend — valeurs par défaut comprises, et il y en a des centaines qui ne figurent dans aucun fichier. Sa page de manuel garantit le code de sortie : 1 si une erreur est trouvée, 0 sinon. Attention cependant, et c’est mesurable : une directive mal orthographiée fait sortir testparm en 0 en écrivant « Unknown parameter encountered » sur l’erreur standard. Lis donc les deux — le code ET les messages.',
    verification: 'echo $?',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-readiness',
    source: `${MAN}/man1/testparm.1.html`,
  },
  {
    id: 'cr-samba-sections',
    notion: 'samba-diagnostic',
    besoin: 'Lister les partages réellement déclarés, et rien d’autre.',
    commande: 'testparm -s | grep -oE \'^\\[[^]]+\\]\'',
    exemple: 'testparm -s | grep -oE \'^\\[[^]]+\\]\'',
    parametres: [],
    options: [
      { option: '-s', explication: '-s supprime l’invite de testparm, sans quoi la commande attend une touche.' },
      { option: '-oE', explication: 'Deux options de grep groupées : -o n’affiche que la partie qui correspond, et non la ligne entière — on obtient une liste de noms, pas un extrait de configuration ; -E active les expressions régulières étendues, nécessaires ici pour la classe de caractères négative.' },
    ],
    resultat: 'Un nom de section par ligne, crochets compris. C’est la liste de ce que Samba sert vraiment : une section écrite dans un fichier que smb.conf n’inclut pas n’y figure pas, et une section ajoutée sans rechargement n’y figure pas non plus. Si un partage manque ici alors qu’il est dans le fichier, le problème est l’un des deux — pas le client.',
    verification: 'sudo smbcontrol smbd reload-config',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-diagnostic',
    source: `${MAN}/man1/testparm.1.html`,
  },
  {
    id: 'cr-samba-section-detail',
    notion: 'samba-diagnostic',
    besoin: 'Lire les réglages effectifs d’un partage, et non ce qui est écrit dans le fichier.',
    commande: 'testparm -s | grep -A 12 -- \'^\\[<PARTAGE>\\]$\'',
    exemple: 'testparm -s | grep -A 12 -- \'^\\[partage\\]$\'',
    parametres: [
      { jeton: '<PARTAGE>', role: 'Le nom du partage, tel qu’il apparaît entre crochets. La casse compte.', exemple: 'partage' },
    ],
    options: [
      { option: '-s', explication: '-s supprime l’invite de testparm : sans lui, il attend une touche après avoir listé les services, et la commande semble figée.' },
      { option: '-A', explication: '-A affiche les N lignes qui SUIVENT la correspondance : c’est le corps de la section. Douze suffit pour une section ordinaire ; augmente si elle est longue.' },
      { option: '--', explication: 'Le double tiret arrête la lecture des options : sans lui, un motif commençant par un tiret serait pris pour une option de grep.' },
    ],
    resultat: 'Le corps de la section, avec les valeurs que Samba APPLIQUE. Trois lignes décident de presque tout : « read only » — dont la valeur par défaut documentée est « yes », et c’est la cause nº 1 de « je ne peux pas écrire » ; « create mask », dont le défaut 0744 retire l’écriture au groupe sur chaque fichier déposé ; et « valid users », qui dit qui a le droit d’entrer. Samba n’outrepasse jamais les permissions Unix du dossier : « read only = no » sur un dossier fermé au groupe ne donne rien.',
    verification: 'stat -c \'%a %U:%G\' /srv/partage',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-diagnostic',
    source: `${MAN}/man5/smb.conf.5.html`,
  },
  {
    id: 'cr-samba-acces-hote',
    notion: 'samba-diagnostic',
    besoin: 'Demander à Samba si un client donné a le droit d’accéder aux partages.',
    commande: 'testparm -s /etc/samba/smb.conf <ADRESSE> <ADRESSE>',
    exemple: 'testparm -s /etc/samba/smb.conf 192.168.30.50 192.168.30.50',
    parametres: [
      { jeton: '<ADRESSE>', role: 'L’adresse IPv4 du client. Elle est répétée parce que testparm attend un nom d’hôte PUIS une adresse : donner l’adresse aux deux places évite une résolution de nom qui, en échouant, ferait conclure à un refus inexistant.', exemple: '192.168.30.50' },
    ],
    options: [
      { option: '-s', explication: '-s supprime l’invite, sans quoi testparm attend une touche.' },
    ],
    resultat: 'Une ligne par partage, disant si cet hôte y a accès. Sa page de manuel décrit la capacité : « If the optional host name and host IP address are specified on the command line, this test program will run through the service entries reporting whether the specified host has access to each service. » C’est Samba qui répond, d’après ses propres « hosts allow » et « hosts deny » — rien n’est installé sur le client et aucune connexion n’est ouverte. Ce test ne dit RIEN du compte ni du mot de passe : c’est une autre couche, et les confondre fait chercher au mauvais endroit.',
    verification: 'testparm -s | grep -i "hosts allow"',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-diagnostic',
    source: `${MAN}/man1/testparm.1.html`,
  },
  {
    id: 'cr-samba-comptes',
    notion: 'samba-readiness',
    besoin: 'Savoir quels comptes SAMBA existent — ce qui n’est pas la liste des comptes Unix.',
    commande: 'sudo pdbedit -L',
    exemple: 'sudo pdbedit -L',
    parametres: [],
    options: [
      { option: '-L', explication: '-L liste les comptes de la base Samba. La base des mots de passe ne se lit pas sans privilège, et c’est voulu.' },
    ],
    resultat: 'Un compte par ligne, au format compte:UID:nom. C’est la confusion nº 1 du sujet : Samba tient sa propre base de mots de passe, et « useradd blaise » ne donne aucun accès SMB. Un compte présent dans « getent passwd » et absent d’ici échouera à l’authentification AVEC son mot de passe Unix correct, et le message côté client ne parlera pas de Samba. L’ajouter : « sudo smbpasswd -a <compte> », qui demande le mot de passe à la console.',
    verification: 'getent passwd blaise',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-readiness',
    source: `${MAN}/man8/pdbedit.8.html`,
  },
  {
    id: 'cr-samba-ecoute',
    notion: 'samba-readiness',
    besoin: 'Vérifier que smbd écoute, et sur quelle adresse.',
    commande: 'ss -lntup | grep -E \'445|139\'',
    exemple: 'ss -lntup | grep -E \'445|139\'',
    parametres: [],
    options: [
      { option: '-lntup', explication: 'Cinq options courtes groupées : -l en écoute seulement ; -n sans traduire les ports en noms ; -t TCP ; -u UDP ; -p le processus, colonne qui reste vide sans privilège.' },
      { option: '-E', explication: '-E de grep active les expressions régulières étendues, pour la barre verticale.' },
    ],
    resultat: 'Les sockets de SMB. 445 est celui qui compte aujourd’hui ; 139 est l’historique, sur NetBIOS. L’adresse locale compte autant que le port : un smbd lié à 127.0.0.1 ne servirait que la machine. Aucune ligne du tout alors que smbd est actif signifie qu’il a refusé sa configuration au démarrage — son journal le dit.',
    verification: 'sudo journalctl -u smbd -n 20 --no-pager',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-readiness',
    source: `${MAN}/man8/ss.8.html`,
  },
  {
    id: 'cr-samba-liste-client',
    notion: 'samba-diagnostic',
    besoin: 'Voir les partages comme un client les voit, depuis la machine elle-même.',
    commande: 'smbclient -L <SERVEUR> -U <COMPTE>',
    exemple: 'smbclient -L localhost -U blaise',
    parametres: [
      { jeton: '<SERVEUR>', role: 'Le nom ou l’adresse du serveur. « localhost » éprouve la machine sans passer par le réseau, ce qui sépare la panne locale de la panne de chemin.', exemple: 'localhost' },
      { jeton: '<COMPTE>', role: 'Un compte de la base SAMBA. Le mot de passe est demandé à la console, et ne doit jamais être écrit dans la commande.', exemple: 'blaise' },
    ],
    options: [
      { option: '-L', explication: '-L liste les partages offerts par le serveur, au lieu d’ouvrir une session interactive.' },
      { option: '-U', explication: '-U donne le compte. Ne lui accole JAMAIS le mot de passe — la forme « -U compte%motdepasse » existe, elle fonctionne, et elle écrit le secret dans l’historique du terminal et dans la liste des processus.' },
    ],
    resultat: 'La liste des partages visibles pour ce compte. Essayer depuis « localhost » d’abord sépare deux pannes : si cela fonctionne ici et pas depuis un poste, la cause est le pare-feu ou le chemin réseau ; si cela échoue ici, la cause est sur la machine. Un refus porte un nom précis — NT_STATUS_LOGON_FAILURE signifie compte ou mot de passe SAMBA, NT_STATUS_ACCESS_DENIED signifie authentifié mais pas autorisé.',
    verification: 'sudo pdbedit -L',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-diagnostic',
    source: `${MAN}/man1/smbclient.1.html`,
  },
  {
    id: 'cr-samba-permissions',
    notion: 'samba-share-create',
    besoin: 'Lire les permissions Unix du dossier partagé, que Samba n’outrepasse jamais.',
    commande: 'stat -c \'%a %U:%G %n\' <CHEMIN>',
    exemple: 'stat -c \'%a %U:%G %n\' /srv/partage',
    parametres: [
      { jeton: '<CHEMIN>', role: 'Le dossier désigné par « path » dans la section du partage.', exemple: '/srv/partage' },
    ],
    options: [
      { option: '-c', explication: '-c choisit le format : %a le mode en octal, %U le propriétaire, %G le groupe, %n le nom. La sortie par défaut fait dix lignes où le mode se lit mal.' },
    ],
    resultat: 'Une ligne : mode, propriétaire, groupe. Deux choses à y lire. Le GROUPE doit être celui des personnes autorisées, sinon elles n’auront sur les fichiers que les droits des « autres » — souvent la lecture seule, quoi que dise « read only = no ». Et le mode doit faire QUATRE chiffres, par exemple 2775 : le 2 de tête est le bit setgid, sans lequel un fichier créé dans le dossier appartient au groupe PRINCIPAL de son auteur et non au groupe du dossier. C’est la panne « on travaille à deux et ça ne marche qu’à moitié ».',
    verification: 'testparm -s | grep -A 12 -- \'^\\[partage\\]$\'',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-share-create',
    source: `${MAN}/man1/stat.1.html`,
  },
  {
    id: 'cr-samba-journal',
    notion: 'samba-diagnostic',
    besoin: 'Lire ce que smbd explique et que le client ne dit pas.',
    commande: 'sudo journalctl -u smbd -u nmbd -n 30 --no-pager',
    exemple: 'sudo journalctl -u smbd -u nmbd -n 30 --no-pager',
    parametres: [],
    options: [
      { option: '-u', explication: '-u limite au journal d’une unité, et se répète : les deux sont lues ensemble, parce que smbd sert les partages et nmbd les noms.' },
      { option: '-n', explication: '-n borne le nombre de lignes, les plus récentes.' },
      { option: '--no-pager', explication: '--no-pager écrit directement. Sans lui, journalctl ouvre un afficheur qui attend une touche, et dans un script cela ressemble à un blocage.' },
    ],
    resultat: 'Les trente dernières lignes des deux unités. C’est là qu’apparaissent les échecs d’authentification AVEC le nom du compte concerné — ce que le client, lui, ne dit pas. Avant d’accuser le mot de passe : ce compte est-il dans la base Samba ? C’est aussi là que smbd explique pourquoi il a refusé sa configuration au démarrage, quand rien n’écoute sur 445.',
    verification: 'sudo pdbedit -L',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'samba-diagnostic',
    source: `${MAN}/man1/journalctl.1.html`,
  },
];
