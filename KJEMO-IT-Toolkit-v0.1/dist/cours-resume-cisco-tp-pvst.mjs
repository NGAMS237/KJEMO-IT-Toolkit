/**
 * cours-resume-cisco-tp-pvst.mjs — CISCO-TP-PVST-01 · KJEMO IT Toolkit
 * RÉSUMÉ PLIABLE du TP « Configuration du protocole PVST+ » : l'essentiel, l'ordre qui marche, les
 * commandes à retenir, les pièges et des questions à réponse cachée. Écrit dans nos mots ; les noms,
 * VLAN, ports et adresses sont ceux de l'exemple de laboratoire.
 */
export const RESUME_TP_PVST = {
  titre: 'Résumé du TP — PVST+, PortFast et BPDU guard',
  intro: 'À relire avant de commencer ou avant un examen : pourquoi une racine par VLAN équilibre la charge, dans quel ordre configurer et à quoi servent PortFast et la protection BPDU.',
  essentiel: [
    'Spanning Tree évite les boucles en bloquant certains ports ; PVST+ calcule un arbre PAR VLAN, donc une racine différente peut être choisie pour chaque VLAN.',
    'Avec les priorités par défaut, la même racine sort pour tous les VLAN et seuls quelques trunks transmettent : les autres restent bloqués pour tous les VLAN, c’est du gaspillage.',
    'En faisant de S1 la racine de certains VLAN et de S3 la racine des autres, un port bloqué pour un VLAN transmet pour l’autre : le trafic se répartit sur plusieurs liens.',
    '« root primary » abaisse la priorité pour devenir racine ; « root secondary » donne une priorité intermédiaire pour prendre la relève si la racine tombe. Une racine principale par VLAN, jamais deux.',
    'Les VLAN se créent sur chaque commutateur (pas de VTP ici) et le VLAN natif doit être le même aux deux bouts d’un trunk.',
    'PortFast met un port d’accès en transmission presque immédiatement ; la protection BPDU coupe (err-disabled) ce port s’il reçoit un BPDU : les deux vont ensemble, uniquement vers des postes.',
    'L’ordre qui marche : VLAN, puis ports d’accès, trunks et gestion, puis ping, puis mode STP et racines, puis PortFast et BPDU guard, puis vérification et enregistrement.',
  ],
  sections: [
    {
      id: 'pvst-plan', titre: 'Le plan du TP et les trois parties', schemas: [],
      points: [
        'Partie 1 : VLAN 10 à 80 et 99 sur S1, S2, S3 ; ports d’accès F0/6 (VLAN 30), F0/18 (VLAN 20), F0/11 (VLAN 10) ; trunks F0/1 à F0/4 avec VLAN natif 99 ; adresses 172.31.99.1 à .3 sur le VLAN 99.',
        'Partie 2 : PVST+ ; S1 racine principale des VLAN 1, 10, 30, 50, 70 ; S3 racine principale des VLAN 20, 40, 60, 80, 99 ; S2 racine secondaire de tous.',
        'Partie 3 : PortFast puis protection BPDU sur F0/6 (S1), F0/18 (S2) et F0/11 (S3).',
      ],
    },
    {
      id: 'pvst-lire', titre: 'Lire « show spanning-tree »', schemas: [],
      points: [
        'Pour chaque VLAN : « Root ID » donne la racine ; la ligne « This bridge is the root » apparaît seulement sur le commutateur racine de ce VLAN.',
        'Chaque port a un rôle (racine, désigné, alternatif) et un état (transmission, blocage) : le même port peut transmettre pour un VLAN et bloquer pour un autre.',
        '« show spanning-tree summary » donne le mode (PVST ou Rapid PVST) et, par VLAN, le nombre de ports dans chaque état.',
      ],
    },
  ],
  commandes: [
    { cmd: 'spanning-tree mode pvst', sert: 'Choisir PVST+ comme mode de Spanning Tree (à faire sur tous les commutateurs).' },
    { cmd: 'spanning-tree vlan 10,30,50,70 root primary', sert: 'Faire de ce commutateur la racine principale de ces VLAN.' },
    { cmd: 'spanning-tree vlan 1,10,20 root secondary', sert: 'Faire de ce commutateur la racine de relève de ces VLAN.' },
    { cmd: 'spanning-tree portfast', sert: 'Passer un port d’accès en transmission presque immédiate.' },
    { cmd: 'spanning-tree bpduguard enable', sert: 'Couper (err-disabled) le port s’il reçoit un BPDU.' },
    { cmd: 'switchport trunk native vlan 99', sert: 'Fixer le VLAN natif d’un trunk (le même aux deux bouts).' },
    { cmd: 'interface range f0/1 - f0/4', sert: 'Configurer plusieurs ports d’un coup.' },
    { cmd: 'show spanning-tree', sert: 'Lire la racine et l’état des ports, VLAN par VLAN.' },
    { cmd: 'show spanning-tree summary', sert: 'Lire le mode STP et le résumé par VLAN.' },
    { cmd: 'show interfaces trunk', sert: 'Vérifier les trunks, le VLAN natif et les VLAN autorisés.' },
  ],
  pieges: [
    'Créer les VLAN sur un seul commutateur : sur un trunk, un VLAN absent à l’autre bout ne passe pas ; il n’y a pas de VTP dans ce TP.',
    'Un VLAN natif différent aux deux bouts d’un trunk : IOS signale un écart (native VLAN mismatch) et le trafic peut se mélanger.',
    'Mettre le même VLAN dans deux listes « root primary » : deux commutateurs se disputent la racine.',
    'Oublier le VLAN 1, qui n’entre pas dans les listes de VLAN de la fiche : sa racine se pose à part.',
    'PortFast ou BPDU guard sur un lien entre commutateurs : risque de boucle temporaire ou de port coupé à tort.',
    'Oublier d’enregistrer : tout disparaît au redémarrage.',
  ],
  questions: [
    { q: 'Pourquoi choisir des racines différentes selon les VLAN ?', r: 'PVST+ calcule un arbre par VLAN : avec deux racines, un port bloqué pour un VLAN peut transmettre pour l’autre, donc plusieurs liens servent au lieu d’un seul.' },
    { q: 'Quelle différence entre « root primary » et « root secondary » ?', r: 'La première abaisse la priorité pour gagner l’élection ; la seconde donne une priorité intermédiaire pour prendre la relève si la racine principale tombe.' },
    { q: 'À quoi sert PortFast et pourquoi l’associer à la protection BPDU ?', r: 'PortFast évite l’attente de convergence pour un poste ; la protection BPDU coupe le port si un commutateur y est branché, ce qui protège l’arbre.' },
    { q: 'Pourquoi le VLAN natif doit-il être le même aux deux bouts d’un trunk ?', r: 'Les trames du VLAN natif circulent sans étiquette : un écart les envoie dans un autre VLAN de l’autre côté, ce qui mélange les trafics.' },
    { q: 'Comment voir quel commutateur est racine d’un VLAN ?', r: 'Avec « show spanning-tree vlan N » : la ligne « This bridge is the root » apparaît sur la racine, et « Root ID » donne l’adresse de la racine ailleurs.' },
  ],
};
