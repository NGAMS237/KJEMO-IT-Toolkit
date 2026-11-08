/**
 * cours-resume-cisco-tp-etherchannel-swa.mjs — CISCO-TP-ETHERCHANNEL-02 · KJEMO IT Toolkit
 * RÉSUMÉ PLIABLE du TP « Implémenter EtherChannel » (SWA, SWB, SWC) : l'essentiel, la correspondance avec
 * la fiche, les commandes, les pièges et des questions à réponse cachée. Chaque section porte un schéma.
 * Écrit dans nos mots ; les ports et les modes sont ceux de l'exemple de laboratoire.
 */
export const RESUME_TP_ETHERCHANNEL_SWA = {
  titre: 'Résumé du TP — Implémenter EtherChannel (SWA, SWB, SWC)',
  intro: 'À relire avant de commencer : la topologie à construire, qui propose dans chaque canal, comment saisir SWA, SWB et SWC dans la fiche et ce qui diffère du TP S1, S2, S3.',
  essentiel: [
    'Le TP demande de CONSTRUIRE la topologie (trois commutateurs 2960, câbles droits, noms d’affichage SWA, SWB, SWC) puis de configurer trois canaux : un PAgP, deux LACP.',
    'Canal 1 : SWA–SWB sur Gi0/1 et Gi0/2 en PAgP (desirable des deux côtés). Canal 2 : SWA–SWC sur Fa0/21 et Fa0/22 en LACP (active des deux côtés). Canal 3 : SWB–SWC sur Fa0/23 et Fa0/24 en LACP de sauvegarde.',
    'Dans le canal 3, SWC lance la négociation (active) et SWB répond seulement (passive) : SWB n’initie pas.',
    'Les ports des canaux se règlent d’abord en trunk statique : sinon DTP les laisse en accès et le canal ne se forme pas.',
    'La fiche du TP est la même que pour S1, S2, S3 : tu saisis SWA dans S1, SWC dans S2 et SWB dans S3 ; ses étapes suivent donc l’ordre SWA, SWC, SWB.',
    'Le script du prof ne contient ni extinction des ports ni trunk sur le port-channel : la fiche les ajoute, comme dans l’autre TP, et le résultat est le même.',
    'Ce TP n’a pas de partie Spanning Tree : saute les étapes « racine » de la fiche.',
  ],
  sections: [
    {
      id: 'swa-topologie', titre: 'La topologie à construire', schemas: ['tp-ec-topologie-swa'],
      points: [
        'Trois commutateurs 2960 en triangle ; chaque paire est reliée par deux câbles droits en cuivre.',
        'SWA–SWB : Gi0/1 à Gi0/1 et Gi0/2 à Gi0/2. SWA–SWC : Fa0/21 à Fa0/21 et Fa0/22 à Fa0/22. SWB–SWC : Fa0/23 à Fa0/23 et Fa0/24 à Fa0/24.',
        'Les noms demandés sont des noms d’affichage (l’étiquette sous l’icône), pas le nom d’hôte ; le nom d’hôte se règle ensuite avec la commande hostname.',
      ],
    },
    {
      id: 'swa-propose', titre: 'Qui propose, qui répond', schemas: ['tp-ec-propose-swa', 'ec-modes'],
      points: [
        'Canal 1 en PAgP : desirable des deux côtés, les deux proposent. Canal 2 en LACP : active des deux côtés.',
        'Canal 3 en LACP : SWC en active propose, SWB en passive répond. Si les deux étaient en passive, rien ne se formerait.',
      ],
    },
    {
      id: 'swa-fiche', titre: 'Saisir SWA, SWB et SWC dans la fiche', schemas: ['tp-ec-correspondance'],
      points: [
        'SWA va dans le champ du commutateur S1, SWC dans celui de S2, SWB dans celui de S3.',
        'Canal 1 : ports Gi0/1 et Gi0/2, desirable des deux côtés. Canal 2 : Fa0/21 et Fa0/22, active des deux côtés. Canal 3 : Fa0/23 et Fa0/24, S2 (SWC) en active et S3 (SWB) en passive.',
      ],
    },
    {
      id: 'swa-ordre', titre: 'L’ordre des commandes sur un commutateur', schemas: ['ec-ordre'],
      points: ['Trunk statique, ports éteints, channel-group, ports rallumés, puis l’interface port-channel en trunk ; on répète sur le commutateur d’en face.'],
    },
    {
      id: 'swa-lire', titre: 'Vérifier les canaux', schemas: ['ec-sommaire'],
      points: [
        'show etherchannel summary : un canal sain affiche Po(SU) et ses ports en (P) ; SWA liste Po1 et Po2, SWB Po1 et Po3, SWC Po2 et Po3.',
        'show interfaces trunk : le trunk passe par les interfaces Port-channel, avec le même VLAN natif aux deux bouts.',
      ],
    },
    {
      id: 'swa-regles', titre: 'Ce qui doit concorder', schemas: ['ec-regles'],
      points: ['Même type de port, vitesse, duplex, mode, VLAN natif et VLAN autorisés sur tous les ports d’un canal et aux deux bouts.'],
    },
  ],
  commandes: [
    { cmd: 'interface range gi0/1 , gi0/2', sert: 'Choisir les deux ports du canal d’un coup (virgule entre les ports).' },
    { cmd: 'switchport mode trunk', sert: 'Fixer un trunk statique avant de grouper.' },
    { cmd: 'channel-group 1 mode desirable', sert: 'Canal 1 : ranger les ports et proposer PAgP.' },
    { cmd: 'channel-group 2 mode active', sert: 'Canal 2 : ranger les ports et proposer LACP.' },
    { cmd: 'channel-group 3 mode passive', sert: 'Canal 3 sur SWB : répondre en LACP seulement.' },
    { cmd: 'channel-group 3 mode active', sert: 'Canal 3 sur SWC : lancer la négociation LACP.' },
    { cmd: 'interface port-channel 1', sert: 'Régler le canal logique : un réglage s’applique à tous ses ports.' },
    { cmd: 'show etherchannel summary', sert: 'Lire l’état des canaux, du protocole et des ports.' },
    { cmd: 'show interfaces trunk', sert: 'Vérifier le trunk, le VLAN natif et les VLAN autorisés.' },
    { cmd: 'copy running-config startup-config', sert: 'Enregistrer la configuration.' },
  ],
  pieges: [
    'Écrire « finir » à la fin du script de SWC : ce n’est pas une commande IOS (la bonne est end).',
    'Confondre noms d’affichage et noms d’hôte : le nom d’affichage n’agit pas sur la configuration.',
    'Mettre SWB en passive ET SWC en passive : personne ne propose, le canal 3 ne se forme pas.',
    'Saisir les noms dans le mauvais ordre dans la fiche : les étapes s’appellent S1, S2, S3 mais correspondent à SWA, SWC, SWB.',
    'Oublier le trunk statique : DTP laisse les ports en accès.',
    'Régler un seul côté d’un canal : il reste hors service tant que l’autre bout n’est pas configuré.',
    'Oublier d’enregistrer : tout disparaît au redémarrage.',
  ],
  questions: [
    { q: 'Quel mode a SWB dans le canal 3, et pourquoi ?', r: 'Passive : SWB répond seulement et n’initie pas ; SWC, en active, lance la négociation LACP.' },
    { q: 'Quel protocole utilise chaque canal ?', r: 'Canal 1 (SWA–SWB) : PAgP. Canaux 2 (SWA–SWC) et 3 (SWB–SWC) : LACP.' },
    { q: 'Pourquoi mettre les ports en trunk statique d’abord ?', r: 'Par défaut, DTP les laisse en mode dynamique automatique : sans trunk fixé, ils peuvent rester des ports d’accès et ne rejoignent pas le canal.' },
    { q: 'Où saisis-tu SWA, SWB et SWC dans la fiche ?', r: 'SWA dans le champ de S1, SWC dans celui de S2 et SWB dans celui de S3 ; les ports et les modes de chaque canal se remplissent ensuite par canal.' },
    { q: 'Que vérifie show etherchannel summary ?', r: 'Pour chaque canal : l’état du port-channel (SU = en service), le protocole (PAgP ou LACP) et l’état de chaque port (P = dans le canal).' },
  ],
};
