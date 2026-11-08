/**
 * cours-resume-cisco-tp-vtp-dtp.mjs — CISCO-TP-VTP-DTP-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * RÉSUMÉ PLIABLE du formatif 6 « Configurer VTP et DTP » : l'essentiel, l'ordre qui marche,
 * les commandes à retenir, les pièges et des questions à réponse cachée. Écrit dans nos mots ;
 * les noms (DS1, AS1, AS2), les ports et le domaine sont ceux de l'exemple de laboratoire.
 * Aucun mot de passe n'est écrit ici.
 */
export const RESUME_TP_VTP_DTP = {
  titre: 'Résumé du TP — VTP et DTP',
  intro: 'À relire avant de commencer ou avant un examen : qui forme les trunks, qui propage les VLAN, dans quel ordre configurer et ce qui casse le plus souvent.',
  essentiel: [
    'DTP (Dynamic Trunking Protocol) négocie la formation d’un trunk entre deux commutateurs voisins : « dynamic desirable » propose, « dynamic auto » répond, « trunk » est fixe.',
    'Un trunk se forme si un bout est « trunk » ou « desirable » face à un bout « trunk », « desirable » ou « auto » ; deux bouts « auto » ne forment rien, et un bout « access » face à un trunk casse le lien.',
    'VTP (VLAN Trunking Protocol) copie la liste des VLAN du serveur vers les clients du même domaine ; il ne transporte que les VLAN (pas l’affectation des ports) et ne passe que par des trunks.',
    'Le serveur crée, modifie et supprime les VLAN ; un client reçoit seulement et ne peut pas en créer ; un commutateur « transparent » ne participe pas mais relaie.',
    'Le domaine doit être écrit à l’identique partout (la casse compte), avec le même mot de passe et la même version de VTP ; sinon les annonces sont ignorées sans message.',
    'Chaque modification sur le serveur augmente le numéro de révision ; un client n’accepte que les annonces dont la révision est plus élevée que la sienne.',
    'L’ordre qui marche : câbles et trunks (DTP) d’abord, puis domaine, version et mot de passe sur le serveur, VLAN sur le serveur, domaine et mot de passe sur les clients, puis vérification, puis enregistrement.',
  ],
  sections: [
    {
      id: 'vtpdtp-ordre', titre: 'Le plan du TP et les cinq phases', schemas: ['vtp-modes'],
      points: [
        'DS1 est le serveur, AS1 et AS2 sont les clients ; F0/7 relie AS1 à DS1 et F0/9 relie AS2 à DS1 (exemple de l’énoncé).',
        'Phases : 1 liens et DTP, 2 DS1 serveur (domaine, mot de passe, VLAN 10 à 50), 3 AS1 et AS2 clients, 4 vérifier chez les clients, 5 enregistrer.',
        'Entre deux commutateurs, le câble est croisé (« Copper Cross-Over » dans Packet Tracer) : avec un câble droit le lien reste éteint et aucun trunk ne monte.',
      ],
    },
    {
      id: 'vtpdtp-lire', titre: 'Lire les sorties', schemas: ['dtp-modes'],
      points: [
        '« show interfaces trunk » : la colonne Mode donne desirable (DS1) ou auto (AS), Status doit dire trunking ; une liste vide veut dire qu’aucun trunk n’est monté.',
        '« show vtp status » : comparer le mode, le domaine, la version et « Configuration Revision » entre les trois commutateurs ; la révision doit être la même.',
        '« show vlan brief » sur un client : les VLAN du serveur y apparaissent (sans port) ; s’ils manquent, remonter dans l’ordre trunk, domaine, mot de passe, version, révision.',
      ],
    },
    {
      id: 'vtpdtp-reel', titre: 'En réel : fixer les trunks plutôt que négocier', schemas: ['vtp-revision'],
      points: [
        'On préfère « switchport mode trunk » des deux côtés, avec « switchport nonegotiate » : le trunk monte à coup sûr et le port n’envoie plus de trames DTP.',
        'La négociation laisse un appareil branché obtenir un trunk (saut de VLAN) ; les ports vers les postes restent en « access ».',
      ],
    },
  ],
  commandes: [
    { cmd: 'switchport mode dynamic desirable', sert: 'Proposer activement un trunk au voisin (DTP).' },
    { cmd: 'switchport mode dynamic auto', sert: 'Attendre la proposition du voisin pour former un trunk.' },
    { cmd: 'switchport mode trunk', sert: 'Fixer le trunk sans négociation.' },
    { cmd: 'switchport nonegotiate', sert: 'Arrêter l’envoi de trames DTP sur un trunk fixe.' },
    { cmd: 'vtp mode server', sert: 'Faire du commutateur le serveur du domaine (crée et diffuse les VLAN).' },
    { cmd: 'vtp mode client', sert: 'Faire du commutateur un client (reçoit les VLAN, n’en crée pas).' },
    { cmd: 'vtp domain NOM', sert: 'Poser le nom du domaine VTP (sensible à la casse).' },
    { cmd: 'vtp password', sert: 'Poser le mot de passe du domaine : il se tape sur l’équipement, jamais dans une fiche.' },
    { cmd: 'vtp version 2', sert: 'Aligner la version de VTP sur tous les commutateurs.' },
    { cmd: 'show vtp status', sert: 'Lire le mode, le domaine, la version et la révision.' },
    { cmd: 'show interfaces trunk', sert: 'Vérifier les trunks : mode, état et VLAN autorisés.' },
    { cmd: 'show vlan brief', sert: 'Lire les VLAN existants et leurs ports.' },
  ],
  pieges: [
    'Deux bouts en « dynamic auto » : personne ne propose, donc aucun trunk (et donc aucun VLAN reçu).',
    'Un câble droit entre deux commutateurs : le lien reste éteint ; prends un câble croisé.',
    'Un nom de domaine écrit autrement (casse comprise) ou un mot de passe différent : les annonces sont ignorées sans message d’erreur.',
    'Créer des VLAN sur un client en croyant les envoyer : un client ne crée rien ; tout se fait sur le serveur.',
    'Brancher un commutateur d’occasion dont la révision est plus élevée : il efface les VLAN de tout le domaine ; remets-le à neuf (mode transparent puis client).',
    'Oublier d’enregistrer : tout disparaît au redémarrage.',
  ],
  questions: [
    { q: 'Les ports de DS1 configurés en « dynamic desirable » deviennent-ils obligatoirement des trunks ?', r: 'Non : le trunk se forme seulement si l’autre bout répond (auto, desirable ou trunk) et si le lien est actif. Un bout en access, nonegotiate ou éteint l’empêche.' },
    { q: 'Quel mode « show interfaces trunk » affiche-t-il dans ce TP ?', r: 'Côté DS1 : desirable ; côté AS1 et AS2 (par défaut en dynamic auto) : auto ; l’état est trunking dans les deux cas. À confirmer sur ta propre sortie.' },
    { q: 'Pourquoi un client VTP ne reçoit-il aucun VLAN alors que le trunk est monté ?', r: 'Domaine écrit autrement (casse), mot de passe ou version différents, ou révision plus élevée que celle du serveur. On compare « show vtp status » des trois commutateurs.' },
    { q: 'Pourquoi crée-t-on les VLAN sur DS1 et pas sur AS1 ?', r: 'Parce que DS1 est le serveur : un client reçoit la liste du serveur et ne peut pas créer de VLAN.' },
    { q: 'Quelle différence entre VTP et DTP ?', r: 'DTP forme les trunks entre commutateurs voisins ; VTP distribue la liste des VLAN sur ces trunks. VTP dépend donc du trunk, pas l’inverse.' },
  ],
};
