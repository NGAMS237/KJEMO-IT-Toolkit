/**
 * commandes-cockpit.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les commandes rapides de Cockpit. ELLES OBSERVENT TOUTES.
 *
 * Installer la console, activer son socket et ouvrir son port sont trois
 * actions qui, prises dans le mauvais ordre, coupent la session par laquelle
 * on travaille. Elles vivent donc dans l'assistant
 * cockpit-install-readiness, qui les affiche dans l'ordre, avec leur
 * annulation — et non ici, où une commande se copie sans contexte.
 *
 * Aucune de ces commandes n'émet de requête HTTPS, et ni « -k » ni
 * « --insecure » n'apparaissent dans ce fichier. Une commande rapide qui
 * apprendrait à contourner la vérification d'un certificat ferait plus de
 * dégâts que la panne qu'elle sert à diagnostiquer.
 */

const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';
const DOC = 'https://docs.cockpit-project.org/cockpit-guide/latest/guide';

export const commandesCockpit = [
  {
    id: 'cr-cockpit-socket',
    notion: 'cockpit-connection-diagnostic',
    besoin: 'Savoir si la console Cockpit écoute, sans se tromper d’unité.',
    commande: 'systemctl is-active cockpit.socket cockpit.service',
    exemple: 'systemctl is-active cockpit.socket cockpit.service',
    parametres: [],
    options: [
      { option: 'is-active', explication: '« is-active » répond par un mot, là où « status » rend un pavé. Les deux unités sont interrogées dans le même appel, et la sortie garde leur ordre.' },
    ],
    resultat: 'Deux lignes. La documentation de Cockpit dit que le service démarre à la demande, quand un navigateur atteint le socket : « active » pour le socket et « inactive » pour le service est donc l’état NORMAL au repos. Interroger « cockpit » tout court répond sur le SERVICE, et fait conclure à une panne qui n’existe pas.',
    verification: 'ss -lntp | grep 9090',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'cockpit-connection-diagnostic',
    source: `${DOC}/startup.html`,
  },
  {
    id: 'cr-cockpit-ecoute',
    notion: 'cockpit-connection-diagnostic',
    besoin: 'Voir si le port de Cockpit écoute, et surtout SUR QUELLE adresse.',
    commande: 'ss -lntp | grep 9090',
    exemple: 'ss -lntp | grep 9090',
    parametres: [],
    options: [
      { option: '-lntp', explication: 'Quatre options courtes groupées : -l ne garde que les sockets en ÉCOUTE ; -n ne traduit pas les numéros de port en noms ; -t limite à TCP ; -p nomme le processus, et cette colonne reste vide sans privilège.' },
    ],
    resultat: 'La ligne du socket, s’il écoute. La colonne de l’adresse locale décide de tout : « 0.0.0.0:9090 » ou « [::]:9090 » est joignable depuis le réseau, « 127.0.0.1:9090 » ne l’est QUE depuis la machine — et aucune règle de pare-feu ne corrige cela, parce que le pare-feu n’y est pour rien. Aucune ligne du tout signifie que rien n’écoute : le navigateur recevra un refus immédiat, et non un délai d’attente.',
    verification: 'systemctl show cockpit.socket -p Listen --value',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'cockpit-connection-diagnostic',
    source: `${MAN}/man8/ss.8.html`,
  },
  {
    id: 'cr-cockpit-listen',
    notion: 'cockpit-install-readiness',
    besoin: 'Lire le port que l’unité socket DÉCLARE écouter.',
    commande: 'systemctl show cockpit.socket -p Listen --value',
    exemple: 'systemctl show cockpit.socket -p Listen --value',
    parametres: [],
    options: [
      { option: 'show', explication: '« show » rend les propriétés d’une unité telles que systemd les a chargées — y compris celles venues d’un fichier additionnel, que la lecture du fichier d’origine ne montre pas.' },
      { option: '-p', explication: '-p ne garde qu’une propriété. Sans lui, systemd en affiche plusieurs centaines.' },
      { option: '--value', explication: '--value n’affiche que la valeur, sans le « Listen= » devant : utile quand on compare, ou quand on réutilise la sortie.' },
    ],
    resultat: 'La ou les adresses d’écoute déclarées par l’unité. C’est ICI que le port de Cockpit se change — la page de cockpit-ws précise que son option --port n’a aucun effet sous activation par socket, et qu’il faut modifier la directive ListenStream de cockpit.socket « in the usual systemd manner ». Un écart entre ce que l’unité déclare et ce qui écoute signifie que le socket n’a pas été rechargé.',
    verification: 'ss -lntp | grep 9090',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'cockpit-install-readiness',
    source: `${MAN}/man1/systemctl.1.html`,
  },
  {
    id: 'cr-cockpit-certificats',
    notion: 'cockpit-install-readiness',
    besoin: 'Savoir quel certificat Cockpit va réellement présenter.',
    commande: 'sudo ls -1 /etc/cockpit/ws-certs.d/',
    exemple: 'sudo ls -1 /etc/cockpit/ws-certs.d/',
    parametres: [],
    options: [
      { option: '-1', explication: '-1 met un nom par ligne. C’est ce qui rend l’ordre alphabétique lisible d’un coup d’œil — et ici, l’ordre est tout.' },
    ],
    resultat: 'La liste des fichiers du dossier. La documentation officielle dit que Cockpit « will use the last file with a .cert or .crt extension in alphabetical order » : c’est donc le DERNIER de cette liste qui compte. Un certificat déposé sous un nom qui passe avant « 0-self-signed.cert » ne sera jamais utilisé, et rien ne le signalera. La clé privée doit porter le même nom avec le suffixe .key, et ne pas être chiffrée.',
    verification: 'sudo journalctl -u cockpit.service -n 30 --no-pager',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'cockpit-install-readiness',
    source: `${DOC}/https.html`,
  },
  {
    id: 'cr-cockpit-journal',
    notion: 'cockpit-connection-diagnostic',
    besoin: 'Lire ce que Cockpit explique et que le navigateur ne dit pas.',
    commande: 'sudo journalctl -u cockpit.socket -u cockpit.service -n 30 --no-pager',
    exemple: 'sudo journalctl -u cockpit.socket -u cockpit.service -n 30 --no-pager',
    parametres: [],
    options: [
      { option: '-u', explication: '-u limite à une unité, et se répète : les deux sont lues ensemble, parce que le socket accepte la connexion et que le service la traite — une panne peut être dans l’un ou dans l’autre.' },
      { option: '-n', explication: '-n borne le nombre de lignes, les plus récentes.' },
      { option: '--no-pager', explication: '--no-pager écrit directement. Sans lui, journalctl ouvre un afficheur qui attend une touche, et dans un script cela ressemble à un blocage.' },
    ],
    resultat: 'Les trente dernières lignes des deux unités. Deux familles de messages n’apparaissent QUE là : une erreur de certificat — un certificat déposé sans sa clé .key, ou avec une clé chiffrée, et cockpit-ws ne sert alors plus rien — et un refus d’authentification, qui veut dire que la page a bien été servie et que la panne n’est pas réseau.',
    verification: 'systemctl is-active cockpit.socket',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'cockpit-connection-diagnostic',
    source: `${MAN}/man1/journalctl.1.html`,
  },
  {
    id: 'cr-cockpit-adresses',
    notion: 'cockpit-connection-diagnostic',
    besoin: 'Savoir quelle adresse taper dans le navigateur.',
    commande: 'ip -brief address show scope global',
    exemple: 'ip -brief address show scope global',
    parametres: [],
    options: [
      { option: '-brief', explication: '-brief met une interface par ligne, avec ses adresses à la suite.' },
      { option: 'scope', explication: 'Le filtre « scope global » écarte le bouclage et les adresses de lien local : il ne reste que des adresses par lesquelles une AUTRE machine peut joindre celle-ci.' },
    ],
    resultat: 'Une ligne par interface, avec ses adresses routables. L’une d’elles, suivie de « :9090 », est l’adresse à ouvrir. C’est le contrôle qu’on oublie et qui coûte le plus de temps : un bail DHCP change, l’ancienne adresse reste dans l’historique du navigateur, et toute la machine est diagnostiquée pendant qu’on parle à une autre.',
    verification: 'ss -lntp | grep 9090',
    risque: 'lecture',
    retourArriere: null,
    assistant: 'cockpit-connection-diagnostic',
    source: `${MAN}/man8/ip-address.8.html`,
  },
];
