/**
 * cours-resume-cisco.mjs — KJEMO-CISCO-S07-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * RÉSUMÉ PLIABLE du cours de la semaine 7 (EtherChannel), pour se rafraîchir
 * la mémoire plus tard : l'essentiel, les schémas, les commandes à retenir, les
 * pièges et quelques questions d'auto-évaluation avec réponse cachée.
 *
 * Écrit dans nos mots à partir du cours et du formatif 07 ; les diapositives ne
 * sont pas republiées (voir schemas-cisco.mjs pour les schémas originaux). Les
 * exemples de configuration sont à lire, pas à exécuter : les fiches du
 * catalogue donnent les mêmes commandes avec des paramètres validés.
 */

export const RESUME_S07 = {
  titre: 'Résumé du cours — EtherChannel et Spanning Tree',
  intro: 'Relis ceci avant un examen ou avant de refaire le formatif. Chaque section renvoie aux fiches qui contiennent les commandes complètes.',
  essentiel: [
    'EtherChannel regroupe plusieurs liens physiques entre deux commutateurs en UN lien logique (le port-channel). Gain : plus de débit, de la redondance, et Spanning Tree ne bloque plus les liens regroupés.',
    'Deux protocoles négocient le canal : PAgP (propriétaire Cisco : desirable / auto) et LACP (norme IEEE 802.3ad : active / passive). Le mode « on » force le canal sans protocole.',
    'Il faut qu’au moins un bout PROPOSE : desirable ou active. auto-auto et passive-passive ne forment rien. Les deux bouts utilisent le même protocole.',
    'Tous les ports du canal se règlent pareil : même type, vitesse, duplex, mode (accès ou trunk), VLAN natif et VLAN autorisés. Huit ports au plus.',
    'On configure d’abord les ports (channel-group), puis l’interface port-channel (trunk, VLAN) : le réglage du port-channel s’applique à tous les ports.',
    'On vérifie avec show etherchannel summary : Po(SU) + ports (P) = canal sain ; Po(SD) + ports (I) = panne.',
    'Spanning Tree (PVST+, Rapid PVST+) évite les boucles en bloquant les liens redondants, avec une racine par VLAN ; PortFast et BPDU guard servent aux ports vers des postes.',
  ],
  sections: [
    {
      id: 'pourquoi', titre: 'Pourquoi agréger des liens ?', schemas: ['ec-faisceau'],
      points: [
        'Un seul lien peut manquer de débit ou tomber en panne. Mettre plusieurs câbles entre deux commutateurs ne sert à rien tant que Spanning Tree en bloque tous sauf un.',
        'EtherChannel présente les liens regroupés comme un seul lien logique : STP ne le voit qu’une fois, donc ne bloque rien dans le groupe.',
        'Avantages : un seul endroit pour configurer (l’interface port-channel), pas besoin de matériel plus rapide, répartition de la charge entre les liens, et la perte d’un lien physique ne change pas la topologie STP.',
      ],
    },
    {
      id: 'protocoles', titre: 'PAgP, LACP ou statique ?', schemas: ['ec-modes'],
      points: [
        'PAgP : propriétaire Cisco, échange des paquets toutes les 30 secondes. Modes : desirable (propose) et auto (répond).',
        'LACP : norme IEEE 802.3ad, utilisable entre fabricants différents. Modes : active (propose) et passive (répond).',
        'on : aucun protocole, aucun contrôle. Les deux bouts doivent être en « on » ; une erreur de câblage ou de réglage n’est pas détectée.',
        'Moyen de retenir : desirable et active sont les « bavards » ; auto et passive attendent qu’on leur parle.',
      ],
    },
    {
      id: 'regles', titre: 'Règles de configuration', schemas: ['ec-regles'],
      points: [
        'Mêmes caractéristiques sur tous les ports : type (Fast Ethernet et Gigabit ne se mélangent pas), vitesse, duplex.',
        'Tous en accès dans le même VLAN, ou tous en trunk avec les mêmes VLAN autorisés et le même VLAN natif.',
        'Les ports n’ont pas besoin d’être voisins sur le commutateur. Au plus huit ports par canal ; un 2960 gère jusqu’à six canaux.',
        'Le numéro de groupe (channel-group) est local à chaque commutateur.',
      ],
    },
    {
      id: 'config', titre: 'Configurer un canal', schemas: ['ec-ordre'],
      points: [
        'Choisir les ports avec interface range, les mettre en trunk, les éteindre (shutdown).',
        'channel-group N mode … crée l’interface Port-channel N et y range les ports.',
        'Rallumer (no shutdown), puis régler l’interface port-channel (switchport mode trunk, VLAN autorisés).',
        'Faire la même chose sur l’autre commutateur, avec un mode compatible.',
      ],
      code: [
        'interface range f0/21 , f0/22',
        ' switchport mode trunk',
        ' shutdown',
        ' channel-group 1 mode desirable',
        ' no shutdown',
        'interface port-channel 1',
        ' switchport mode trunk',
      ],
    },
    {
      id: 'verifier', titre: 'Vérifier', schemas: ['ec-sommaire'],
      points: [
        'show etherchannel summary : une ligne par canal, avec les lettres d’état (S couche 2, U en service, D en panne ; pour un port P dans le canal, I isolé, s suspendu).',
        'show interfaces port-channel N : l’interface logique est up et son débit est la somme des liens.',
        'show etherchannel port-channel : le détail d’un canal. show interfaces F0/1 etherchannel : le rôle d’un port membre.',
        'show spanning-tree active : le canal apparaît comme un seul port « Po ».',
      ],
    },
    {
      id: 'depanner', titre: 'Dépanner', schemas: ['ec-depannage'],
      points: [
        'Démarche : show etherchannel summary, puis show run | begin interface Port-channel pour lire les réglages, sur les DEUX commutateurs.',
        'Causes fréquentes : ports en accès et en trunk mélangés, VLAN autorisés ou natif différents, modes incompatibles (auto-auto, PAgP face à LACP), mauvais port ou mauvais groupe.',
        'Correction : éteindre les ports, no channel-group, remettre channel-group avec un mode compatible, rallumer. L’ordre compte, car EtherChannel et Spanning Tree travaillent ensemble.',
      ],
    },
    {
      id: 'stp', titre: 'Spanning Tree dans les exercices du formatif', schemas: ['stp-boucle', 'stp-racines'],
      points: [
        'Redondance : STP laisse un chemin actif et bloque les autres ; quand un lien tombe, le port bloqué prend le relais (observé dans l’exercice « Examining a Redundant Design »).',
        'PVST+ : un arbre par VLAN, donc une racine possible par VLAN. root primary abaisse la priorité ; root secondary prépare la relève. En répartissant les VLAN entre deux racines, on équilibre la charge.',
        'Rapid PVST+ (spanning-tree mode rapid-pvst) converge bien plus vite que PVST+.',
        'PortFast + BPDU guard sur les ports vers des postes seulement : transmission immédiate, et coupure du port si un commutateur y est branché.',
      ],
    },
  ],
  commandes: [
    { cmd: 'interface range f0/21 , f0/22', sert: 'Sélectionner plusieurs ports pour les régler d’un coup.' },
    { cmd: 'channel-group N mode desirable|auto|active|passive|on', sert: 'Ranger les ports dans le groupe N et choisir la négociation.' },
    { cmd: 'interface port-channel N', sert: 'Régler l’interface logique (trunk, VLAN) : cela vaut pour tous les ports du canal.' },
    { cmd: 'show etherchannel summary', sert: 'Voir tous les canaux, leur protocole et l’état des ports (SU, P, I, D…).' },
    { cmd: 'show interfaces port-channel N', sert: 'État de l’interface logique.' },
    { cmd: 'show etherchannel port-channel', sert: 'Détail d’un canal.' },
    { cmd: 'show interfaces F0/1 etherchannel', sert: 'Rôle d’un port dans le faisceau.' },
    { cmd: 'show run | begin interface Port-channel', sert: 'Relire la configuration des canaux pour comparer les deux bouts.' },
    { cmd: 'spanning-tree mode rapid-pvst', sert: 'Passer en Rapid PVST+.' },
    { cmd: 'spanning-tree vlan 10,30 root primary', sert: 'Faire de ce commutateur la racine des VLAN indiqués.' },
    { cmd: 'spanning-tree portfast / bpduguard enable', sert: 'Port vers un poste : transmission rapide et protection BPDU.' },
  ],
  pieges: [
    'Oublier d’éteindre les ports avant channel-group : la protection du commutateur peut mettre un port en erreur.',
    'Régler le trunk sur certains ports du canal seulement.',
    'Laisser deux côtés en auto (PAgP) ou en passive (LACP) : personne ne propose, rien ne se forme.',
    'Mélanger PAgP et LACP aux deux bouts.',
    'Attribuer un port au mauvais groupe parce qu’on a confondu les numéros (le tableau du travail fait foi).',
    'Utiliser PortFast sur un lien entre commutateurs.',
  ],
  questions: [
    { q: 'Pourquoi deux câbles entre deux commutateurs n’augmentent-ils pas le débit sans EtherChannel ?', r: 'Spanning Tree bloque le lien redondant pour éviter la boucle : un seul câble sert. EtherChannel regroupe les câbles en un lien logique que STP ne bloque pas.' },
    { q: 'desirable face à auto : le canal se forme-t-il ? Et auto face à auto ?', r: 'desirable-auto forme un canal (un bout propose). auto-auto ne forme rien : personne n’initie la négociation.' },
    { q: 'Quel protocole choisir entre un commutateur Cisco et un commutateur d’un autre fabricant ?', r: 'LACP (802.3ad), car c’est la norme ouverte. PAgP est propriétaire Cisco.' },
    { q: 'Que signifie Po1(SD) avec des ports (I) ?', r: 'Le canal est en couche 2 (S) mais en panne (D), et les ports sont isolés (I) : la négociation a échoué. Cherche modes incompatibles, ports accès/trunk mélangés, VLAN différents ou mauvais groupe.' },
    { q: 'Sur quelle interface règle-t-on le trunk d’un EtherChannel ?', r: 'Sur l’interface port-channel (et on avait déjà mis les ports en trunk avant le channel-group) : le réglage de l’interface logique s’applique à tous les ports.' },
    { q: 'Combien de ports peut-on regrouper et sous quelles conditions ?', r: 'Huit au plus, du même type, avec la même vitesse, le même duplex, le même mode (accès ou trunk), les mêmes VLAN et le même VLAN natif.' },
    { q: 'À quoi sert root primary et que fait Rapid PVST+ de plus que PVST+ ?', r: 'root primary rend ce commutateur racine du ou des VLAN indiqués (priorité abaissée). Rapid PVST+ converge beaucoup plus vite après un changement.' },
  ],
};
