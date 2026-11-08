/**
 * cours-resume-cisco-tp-etherchannel.mjs — CISCO-TP-ETHERCHANNEL-01 · KJEMO IT Toolkit
 * RÉSUMÉ PLIABLE du TP « Configurer EtherChannel » : l'essentiel, l'ordre qui marche, les commandes à
 * retenir, les pièges et des questions à réponse cachée. Écrit dans nos mots ; les noms, ports et
 * groupes sont ceux de l'exemple de laboratoire.
 */
export const RESUME_TP_ETHERCHANNEL = {
  titre: 'Résumé du TP — EtherChannel PAgP et LACP',
  intro: 'À relire avant de commencer ou avant un examen : pourquoi regrouper des liens, quel mode choisir de chaque côté, dans quel ordre taper les commandes et pourquoi Spanning Tree peut bloquer le canal le plus rapide.',
  essentiel: [
    'Deux liens redondants entre deux commutateurs créent une boucle : Spanning Tree en bloque un et on perd la moitié de la bande passante. EtherChannel regroupe jusqu’à huit liens en un seul lien logique, que Spanning Tree traite comme un seul.',
    'Trois façons de former un canal : PAgP (propriétaire Cisco, desirable ou auto), LACP (norme 802.3ad, active ou passive) ou « on » (statique, sans négociation).',
    'Modes compatibles : desirable–desirable et desirable–auto pour PAgP ; active–active et active–passive pour LACP. Auto–auto et passive–passive ne forment rien. On ne mélange pas PAgP et LACP sur un même canal.',
    'Dans le TP : canal 1 (S1–S3) en PAgP, canal 2 (S1–S2) en LACP, canal 3 (S2–S3) en LACP « négocié » (passive d’un côté, active de l’autre).',
    'L’ordre qui marche, sur chaque commutateur : ports en trunk statique, ports éteints (shutdown), channel-group avec son mode, ports rallumés (no shutdown), puis l’interface port-channel en trunk.',
    'Les ports d’un canal doivent être réglés pareil : même type, vitesse, duplex, mode, VLAN natif et VLAN autorisés. Un seul port différent suffit à empêcher le canal.',
    'Le numéro de groupe est local à chaque commutateur : le canal 1 de S1 peut s’entendre avec le canal 5 d’un autre commutateur.',
    'Le piège final : Spanning Tree bloque encore des liens entre commutateurs. Sans réglage, le canal Gigabit peut être celui qui est bloqué ; en faisant de S1 la racine du VLAN 1, il repasse en transmission.',
  ],
  sections: [
    {
      id: 'ec-plan', titre: 'Le plan du TP et les quatre parties', schemas: [],
      points: [
        'Partie 1 : noms S1, S2, S3, puis lecture de l’état des ports (show interfaces status, show interfaces trunk) et trunk statique sur tous les ports des canaux.',
        'Partie 2 : canal 1 sur F0/21 et F0/22 entre S1 et S3, en PAgP (desirable des deux côtés).',
        'Partie 3 : canal 2 sur G0/1 et G0/2 entre S1 et S2, en LACP (active des deux côtés).',
        'Partie 4 : canal 3 sur F0/23 et F0/24 entre S2 (passive) et S3 (active), puis S1 racine du VLAN 1.',
      ],
    },
    {
      id: 'ec-lire', titre: 'Lire « show etherchannel summary »', schemas: [],
      points: [
        'Une ligne par canal : numéro, port-channel avec ses lettres (SU = couche 2, en service ; SD = couche 2, hors service), protocole (PAgP ou LACP) et ports membres.',
        'Chaque port membre porte une lettre : (P) dans le canal, (I) seul, (s) suspendu, (D) éteint.',
        'Un canal en (SD) avec des ports en (I) veut dire que les deux bouts ne s’entendent pas : modes incompatibles, protocoles différents ou un côté pas encore configuré.',
      ],
    },
  ],
  commandes: [
    { cmd: 'interface range f0/21 - 22', sert: 'Choisir plusieurs ports d’un coup.' },
    { cmd: 'switchport mode trunk', sert: 'Fixer un trunk statique (DTP ne décide plus).' },
    { cmd: 'channel-group 1 mode desirable', sert: 'Ranger les ports dans le groupe 1 et proposer PAgP.' },
    { cmd: 'channel-group 2 mode active', sert: 'Ranger les ports dans le groupe 2 et proposer LACP.' },
    { cmd: 'channel-group 3 mode passive', sert: 'Répondre en LACP seulement si l’autre bout propose.' },
    { cmd: 'interface port-channel 1', sert: 'Régler le canal logique : un réglage s’applique à tous ses ports.' },
    { cmd: 'show etherchannel summary', sert: 'Lire l’état des canaux, du protocole et des ports.' },
    { cmd: 'show interfaces trunk', sert: 'Vérifier que le trunk passe par le port-channel.' },
    { cmd: 'spanning-tree vlan 1 root primary', sert: 'Faire de ce commutateur la racine du VLAN 1.' },
    { cmd: 'show spanning-tree active', sert: 'Voir les ports actifs, leur rôle et leur état.' },
  ],
  pieges: [
    'Deux « auto » (PAgP) ou deux « passive » (LACP) : personne ne propose, rien ne se forme.',
    'Mélanger PAgP d’un côté et LACP de l’autre : les deux protocoles ne se parlent pas.',
    'Laisser un port en DTP automatique : sans « switchport mode trunk », il reste en accès et ne rejoint pas le canal.',
    'Grouper les ports sans les avoir éteints : une protection du commutateur peut les mettre en erreur.',
    'Régler un seul côté du canal : le canal reste (SD) tant que l’autre bout n’est pas configuré aussi.',
    'Ports différents (vitesse, duplex, VLAN natif, VLAN autorisés) : le port est suspendu ou refusé.',
    'Oublier la racine : le canal Gigabit est bloqué par Spanning Tree et on croit à une panne.',
    'Oublier d’enregistrer : tout disparaît au redémarrage.',
  ],
  questions: [
    { q: 'Pourquoi EtherChannel est-il utile entre deux commutateurs ?', r: 'Sans lui, Spanning Tree bloque les liens redondants pour éviter une boucle ; avec lui, les liens forment un lien logique et toute la bande passante sert.' },
    { q: 'Quelle différence entre PAgP et LACP ?', r: 'PAgP est propriétaire Cisco (desirable, auto) ; LACP est la norme 802.3ad (active, passive) et fonctionne aussi avec d’autres fabricants.' },
    { q: 'Quels couples de modes forment un canal ?', r: 'Desirable–desirable et desirable–auto en PAgP ; active–active et active–passive en LACP. Auto–auto et passive–passive ne forment rien.' },
    { q: 'Pourquoi éteindre les ports avant channel-group ?', r: 'Pour éviter que la protection du commutateur (EtherChannel Misconfig Guard) mette les ports en erreur pendant la configuration ; on les rallume ensuite.' },
    { q: 'Pourquoi le canal Gigabit pouvait-il être bloqué, et comment y remédier ?', r: 'Spanning Tree bloque un canal entier selon la racine choisie. En faisant de S1 la racine du VLAN 1 (root primary ou priorité 24576), le canal Gigabit repasse en transmission.' },
  ],
};
