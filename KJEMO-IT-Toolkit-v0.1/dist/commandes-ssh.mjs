/**
 * commandes-ssh.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides de SSH. ELLES OBSERVENT TOUTES.
 *
 * Aucune n'agit, et ce n'est pas une prudence de façade : chacune des actions
 * qu'on pourrait vouloir ici — recharger le service, installer un fichier de
 * durcissement, retirer une entrée de known_hosts, poser une clé — peut
 * couper l'accès à la machine ou accepter un serveur qu'on ne reconnaît plus.
 * Ces actions-là passent par un assistant, qui vérifie d'abord, ou par une
 * procédure manuelle affichée en entier.
 *
 * La règle du lot s'applique donc telle quelle : une commande rapide pour
 * observer, un assistant pour agir. C'est aussi pourquoi « ssh-keygen -R »,
 * « systemctl reload ssh » et « ufw allow 22/tcp » ne sont pas dans ce
 * fichier : la première est une décision de confiance, la deuxième est
 * l'instant précis où un durcissement coupe un accès, et la troisième vit
 * déjà dans les commandes du pare-feu, avec son inverse exact.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';

export const commandesSsh = [
  // =========================================================================
  // LE SERVEUR : L'UNITÉ, LE PORT, LA CONFIGURATION EFFECTIVE
  // =========================================================================
  {
    id: 'cr-ssh-unites',
    notion: 'ssh-server-readiness',
    besoin: 'Savoir si le serveur SSH écoute, sans se faire piéger par l’activation par socket.',
    commande: 'systemctl is-active ssh.socket ssh.service',
    exemple: 'systemctl is-active ssh.socket ssh.service',
    parametres: [],
    options: [
      { option: 'is-active', explication: '« is-active » répond par un mot et un code de sortie, là où « status » rend un pavé qu’il faut lire. Les deux unités sont interrogées dans le même appel, et la sortie garde leur ordre.' },
    ],
    resultat: 'Deux lignes, dans l’ordre demandé. Depuis Ubuntu 22.10, c’est ssh.socket qui écoute et ssh.service ne démarre qu’à la première connexion : « active » puis « inactive » est donc l’état NORMAL d’un serveur qui fonctionne. C’est la fausse alarme la plus fréquente du sujet. Deux « active » est en revanche un défaut : deux processus se disputent le même port, et une connexion sur deux échoue.',
    verification: 'ss -lntp | grep ssh',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-server-readiness',
    source: `${MAN}/man1/systemctl.1.html`,
  },
  {
    id: 'cr-ssh-ecoute',
    notion: 'ssh-server-readiness',
    besoin: 'Vérifier que quelque chose écoute réellement sur le port de SSH.',
    commande: 'ss -lntp | grep ssh',
    exemple: 'ss -lntp | grep ssh',
    parametres: [],
    options: [
      { option: '-lntp', explication: 'Quatre options courtes groupées, et chacune compte : -l ne garde que les sockets en ÉCOUTE, sans quoi les connexions établies noient la réponse ; -n n’essaie pas de traduire les numéros de port en noms, donc « 22 » reste « 22 » et la comparaison reste sûre ; -t limite à TCP, où SSH écoute ; -p nomme le PROCESSUS, et cette colonne reste vide sans privilège — le socket, lui, est visible quand même.' },
    ],
    resultat: 'Une ligne par socket en écoute, avec l’adresse locale et le port. C’est la seule preuve qui compte : un service « actif » qui n’écoute sur rien ne répond pas. Une adresse 0.0.0.0 ou [::] signifie joignable depuis partout où le réseau le permet ; 127.0.0.1 signifie depuis la machine seulement.',
    verification: 'sudo sshd -T | grep -E "^port"',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-server-readiness',
    source: `${MAN}/man8/ss.8.html`,
  },
  {
    id: 'cr-ssh-effective',
    notion: 'ssh-hardening-audit',
    besoin: 'Lire la configuration que sshd applique vraiment, fichiers additionnels compris.',
    commande: 'sudo sshd -T | grep -E \'^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|usepam)\'',
    exemple: 'sudo sshd -T | grep -E \'^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|usepam)\'',
    parametres: [],
    options: [
      { option: '-T', explication: '-T est le mode de test étendu : sshd(8) le décrit comme vérifiant la configuration et écrivant la configuration EFFECTIVE sur la sortie standard. Il ne démarre rien et ne recharge rien.' },
      { option: '-E', explication: '-E de grep active les expressions régulières étendues, ce qui permet la liste entre parenthèses séparée par des barres verticales.' },
    ],
    resultat: 'Une ligne par directive, en minuscules, telle que sshd l’a comprise APRÈS les Include et les blocs Match. C’est la seule lecture qui ne se trompe pas : lire /etc/ssh/sshd_config à la main oublie les fichiers de sshd_config.d/, et pour chaque mot-clé c’est la PREMIÈRE valeur obtenue qui gagne. Si « passwordauthentication no » cohabite avec « kbdinteractiveauthentication yes », l’entrée par mot de passe reste ouverte par PAM : la page de manuel le dit à l’entrée UsePAM.',
    verification: 'sudo sshd -t',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-hardening-audit',
    source: `${MAN}/man8/sshd.8.html`,
  },
  {
    id: 'cr-ssh-test-config',
    notion: 'ssh-hardening-audit',
    besoin: 'Vérifier qu’une configuration est valide AVANT de recharger le service.',
    commande: 'sudo sshd -t',
    exemple: 'sudo sshd -t',
    parametres: [],
    options: [
      { option: '-t', explication: '-t est le mode de test : sshd(8) le décrit comme ne contrôlant que la validité du fichier de configuration et la santé des clés. Il n’applique rien, ne redémarre rien, et son code de sortie est ce qui compte.' },
    ],
    resultat: 'Aucune sortie et un code 0 quand tout va. Sinon, la ligne et la raison exacte. C’est la commande à taper entre l’installation d’un fichier et le rechargement du service : une configuration refusée empêche sshd de redémarrer, et sur une machine distante on ne peut alors plus se connecter pour la corriger. Tant que cette commande se plaint, aucun autre réglage n’a d’effet.',
    verification: 'sudo sshd -T | head -5',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-hardening-audit',
    source: `${MAN}/man8/sshd.8.html`,
  },
  {
    id: 'cr-ssh-include',
    notion: 'ssh-hardening-audit',
    besoin: 'Vérifier que les fichiers additionnels de sshd_config.d sont bien inclus.',
    commande: 'grep -n Include /etc/ssh/sshd_config',
    exemple: 'grep -n Include /etc/ssh/sshd_config',
    parametres: [],
    options: [
      { option: '-n', explication: '-n donne le numéro de ligne. Il compte ici plus qu’ailleurs : pour chaque mot-clé, c’est la première valeur obtenue qui gagne, donc la POSITION de la ligne Include décide si un fichier additionnel prime sur le fichier principal ou non.' },
    ],
    resultat: 'La ligne « Include /etc/ssh/sshd_config.d/*.conf » et son numéro. Si elle est absente — ce qui arrive quand le fichier principal a été remplacé par une version trouvée en ligne —, tout fichier déposé dans ce dossier est ignoré SANS LE MOINDRE MESSAGE, et un durcissement qu’on croit en place n’existe pas. Si elle est présente mais après une directive, cette directive-là gagne.',
    verification: 'sudo sshd -T | grep -E "^permitrootlogin"',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-hardening-audit',
    source: `${MAN}/man5/sshd_config.5.html`,
  },
  {
    id: 'cr-ssh-journal',
    notion: 'ssh-server-readiness',
    besoin: 'Lire les refus que le serveur explique et que le client n’affiche pas.',
    commande: 'sudo journalctl -u ssh.service -n 50 --no-pager',
    exemple: 'sudo journalctl -u ssh.service -n 50 --no-pager',
    parametres: [],
    options: [
      { option: '-u', explication: '-u limite au journal d’une unité. Sans lui, le journal du système entier défile.' },
      { option: '-n', explication: '-n borne le nombre de lignes, les plus récentes.' },
      { option: '--no-pager', explication: '--no-pager écrit directement. Sans lui, journalctl ouvre un afficheur qui attend une touche, et dans un script cela ressemble à un blocage.' },
    ],
    resultat: 'Les cinquante dernières lignes du journal de sshd. C’est le SEUL endroit où apparaît « Authentication refused: bad ownership or modes for directory » — le message qui explique une clé refusée alors qu’elle est bonne. Côté client, la même situation affiche « Permission denied (publickey) », ce qui envoie chercher une erreur de clé inexistante.',
    verification: 'stat -c \'%a %U:%G\' ~ ~/.ssh ~/.ssh/authorized_keys',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-server-readiness',
    source: `${MAN}/man1/journalctl.1.html`,
  },
  {
    id: 'cr-ssh-cle-hote',
    notion: 'ssh-server-readiness',
    besoin: 'Relever l’empreinte d’une clé d’hôte, pour pouvoir la comparer côté client.',
    commande: 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub',
    exemple: 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub',
    parametres: [],
    options: [
      { option: '-lf', explication: 'Deux options groupées : -l affiche l’EMPREINTE au lieu de la clé, et -f désigne le fichier. Le « .pub » n’est pas un détail : c’est la clé PUBLIQUE, celle qu’on peut citer, relever et comparer. La clé privée voisine ne se lit pas, ne se copie pas, et n’entre dans aucun rapport.' },
    ],
    resultat: 'Une ligne : la taille, l’empreinte en SHA256, le commentaire et le type. C’est cette empreinte que le client affiche à la première connexion, et c’est à CELLE-LÀ qu’il faut la comparer — relevée sur le serveur, par un canal autre que la connexion qu’on cherche à établir. Taper « yes » sans comparer revient à accepter n’importe quel serveur.',
    verification: 'ssh-keygen -F <HOTE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-server-readiness',
    source: `${MAN}/man1/ssh-keygen.1.html`,
  },

  // =========================================================================
  // LE CLIENT : CE QU'IL VA FAIRE, ET CE QUE LE SERVEUR ACCEPTE
  // =========================================================================
  {
    id: 'cr-ssh-config-effective',
    notion: 'ssh-client-diagnostic',
    besoin: 'Savoir ce que ssh fera réellement : quel hôte, quel compte, quel port.',
    commande: 'ssh -G <HOTE> | grep -E \'^(hostname|user|port|identityfile|proxyjump)\'',
    exemple: 'ssh -G srv-labo.kjemo.local | grep -E \'^(hostname|user|port|identityfile|proxyjump)\'',
    parametres: [
      { jeton: '<HOTE>', role: 'Le nom tel qu’on le tape d’habitude — y compris un alias de ~/.ssh/config, puisque c’est justement sa résolution qu’on veut voir.', exemple: 'srv-labo.kjemo.local' },
    ],
    options: [
      { option: '-G', explication: '-G affiche la configuration effective pour cet hôte, après résolution de ~/.ssh/config, puis s’arrête. Il ne se connecte PAS : c’est une lecture, et elle ne touche à rien.' },
      { option: '-E', explication: '-E de grep active les expressions régulières étendues, pour la liste entre parenthèses.' },
    ],
    resultat: 'Les valeurs que ssh appliquera. C’est là que se cache une cause qu’on ne soupçonne jamais : une entrée « Host srv* » écrite six mois plus tôt impose un autre compte, un autre port ou un rebond, et aucun message d’erreur ne le mentionne. Dans ssh_config comme dans sshd_config, c’est la PREMIÈRE valeur obtenue qui gagne, donc les entrées les plus spécifiques se placent en haut. « identityfile » ne cite que des NOMS de fichiers : aucun contenu de clé n’est affiché.',
    verification: 'ls -l ~/.ssh/config',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-client-diagnostic',
    source: `${MAN}/man1/ssh.1.html`,
  },
  {
    id: 'cr-ssh-methodes',
    notion: 'ssh-client-diagnostic',
    besoin: 'Demander au serveur quelles authentifications il accepte, sans en présenter aucune.',
    commande: 'ssh -o BatchMode=yes -o PreferredAuthentications=none -o StrictHostKeyChecking=yes -o ConnectTimeout=5 <HOTE> exit',
    exemple: 'ssh -o BatchMode=yes -o PreferredAuthentications=none -o StrictHostKeyChecking=yes -o ConnectTimeout=5 srv-labo.kjemo.local exit',
    parametres: [
      { jeton: '<HOTE>', role: 'Le serveur à interroger, éventuellement sous la forme compte@serveur.', exemple: 'srv-labo.kjemo.local' },
    ],
    options: [
      { option: '-o', explication: '-o passe une option de configuration pour cette seule commande, sans rien écrire dans ~/.ssh/config.' },
      { option: 'BatchMode=yes', explication: 'BatchMode=yes supprime toute invite : la commande ne peut pas rester à attendre une saisie.' },
      { option: 'PreferredAuthentications=none', explication: 'Aucune authentification n’est proposée : ni mot de passe, ni clé. Le serveur répond alors en listant ce qu’il accepte.' },
      { option: 'StrictHostKeyChecking=yes', explication: 'Une clé d’hôte inconnue fait ÉCHOUER la commande, et c’est le but. La valeur « no » désactiverait la seule vérification qui distingue le vrai serveur d’un serveur substitué, et « accept-new » prendrait la décision de confiance à ta place.' },
      { option: 'ConnectTimeout=5', explication: 'Un échec franc après cinq secondes, au lieu d’une attente longue.' },
    ],
    resultat: 'Le serveur répond « Permission denied (publickey,password) », et cette liste est la réponse exacte à « pourquoi il me demande un mot de passe » ou « pourquoi il ne me le demande pas ». Trois autres réponses se distinguent : « Connection refused » signifie que la machine a répondu et que rien n’écoute ; « timed out » qu’aucune réponse n’est venue, signature d’un pare-feu sur le chemin ; « Host key verification failed » que la clé du serveur a changé ou qu’il est inconnu.',
    verification: 'ssh-keygen -F <HOTE>',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-client-diagnostic',
    source: `${MAN}/man1/ssh.1.html`,
  },
  {
    id: 'cr-ssh-connu',
    notion: 'ssh-client-diagnostic',
    besoin: 'Vérifier si un hôte figure déjà dans known_hosts, y compris sous forme hachée.',
    commande: 'ssh-keygen -F <HOTE>',
    exemple: 'ssh-keygen -F srv-labo.kjemo.local',
    parametres: [
      { jeton: '<HOTE>', role: 'Le nom ou l’adresse de l’hôte, tel qu’il a été utilisé lors de la connexion.', exemple: 'srv-labo.kjemo.local' },
    ],
    options: [
      { option: '-F', explication: '-F cherche l’hôte dans known_hosts et affiche l’entrée trouvée. Il faut l’utiliser plutôt que grep : les entrées peuvent être HACHÉES, et grep ne les trouve alors jamais — ce qui fait conclure à tort que l’hôte est inconnu.' },
    ],
    resultat: 'L’entrée correspondante, ou rien et un code de sortie non nul. Un hôte connu dont la connexion échoue avec « Host key verification failed » a vu sa clé CHANGER : deux explications, et une seule est bénigne — le serveur a été réinstallé, ou quelqu’un s’interpose. Compare l’empreinte avec celle relevée sur le serveur avant de toucher à known_hosts : retirer l’entrée par réflexe revient à accepter sans regarder exactement ce que la vérification devait empêcher.',
    verification: 'ssh -o BatchMode=yes -o PreferredAuthentications=none <HOTE> exit',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-client-diagnostic',
    source: `${MAN}/man1/ssh-keygen.1.html`,
  },

  // =========================================================================
  // LES CLÉS, ET LA CHAÎNE DE PERMISSIONS QUE STRICTMODES CONTRÔLE
  // =========================================================================
  {
    id: 'cr-ssh-permissions',
    notion: 'ssh-key-readiness',
    besoin: 'Mesurer d’un coup les trois permissions dont dépend l’authentification par clé.',
    commande: 'stat -c \'%a %U:%G %n\' ~ ~/.ssh ~/.ssh/authorized_keys',
    exemple: 'stat -c \'%a %U:%G %n\' ~ ~/.ssh ~/.ssh/authorized_keys',
    parametres: [],
    options: [
      { option: '-c', explication: '-c choisit le format : %a le mode en octal, %U le propriétaire, %G le groupe, %n le nom. La sortie par défaut de stat fait dix lignes par fichier, où le mode se lit mal.' },
    ],
    resultat: 'Trois lignes, une par maillon. Les modes attendus : le dossier personnel sans écriture pour le groupe ni les autres — 755 va, 775 ne va pas —, ~/.ssh en 700, authorized_keys en 600. UN SEUL maillon trop ouvert suffit à faire refuser une clé valide par StrictModes, dont sshd_config(5) dit « The default is yes ». Le client, lui, affiche « Permission denied (publickey) » sans jamais parler de permissions : c’est le piège le plus courant du sujet.',
    verification: 'sudo journalctl -u ssh.service -n 50 --no-pager',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-key-readiness',
    source: `${MAN}/man1/stat.1.html`,
  },
  {
    id: 'cr-ssh-empreintes-autorisees',
    notion: 'ssh-key-readiness',
    besoin: 'Comparer les clés réellement autorisées avec celle du poste client.',
    commande: 'ssh-keygen -lf ~/.ssh/authorized_keys',
    exemple: 'ssh-keygen -lf ~/.ssh/authorized_keys',
    parametres: [],
    options: [
      { option: '-lf', explication: 'Deux options groupées : -l affiche les EMPREINTES, et -f désigne le fichier. authorized_keys ne contient que des clés PUBLIQUES — les lire et les comparer ne divulgue rien, et c’est précisément à cela qu’une empreinte sert.' },
    ],
    resultat: 'Une empreinte par clé autorisée. Compare-les avec « ssh-keygen -lf ~/.ssh/id_ed25519.pub » tapé sur le poste client : c’est ainsi qu’on vérifie que LA bonne clé est en place, et non en relisant la clé à l’œil. Une clé en place n’est pas forcément celle qu’on croit, surtout quand plusieurs postes ont été configurés le même jour.',
    verification: 'stat -c \'%a %U:%G\' ~/.ssh/authorized_keys',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'ssh-key-readiness',
    source: `${MAN}/man1/ssh-keygen.1.html`,
  },
];
