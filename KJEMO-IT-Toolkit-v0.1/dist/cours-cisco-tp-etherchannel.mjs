/**
 * cours-cisco-tp-etherchannel.mjs — CISCO-TP-ETHERCHANNEL-01 · KJEMO IT Toolkit
 * TP « Configurer EtherChannel » rangé dans « Mes cours et TP > Cisco » : cinq parcours qui suivent la
 * fiche complète `cours-tp-etherchannel` phase par phase. Le parcours ne contient aucune commande :
 * il renvoie vers les étapes de la fiche. L'énoncé est résumé dans nos mots.
 */
import { RESUME_TP_ETHERCHANNEL } from './cours-resume-cisco-tp-etherchannel.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const FT = 'cours-tp-etherchannel';
const AVERTISSEMENT = 'La fiche explique comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) avec des champs à remplir (noms, ports, groupes, modes) ; elle ne remplace pas ton énoncé et ne prouve rien : « coché » veut seulement dire « je l’ai fait ».';

export const COURS_CISCO_TP_ETHERCHANNEL_PARCOURS = [
  {
    id: 'cisco-tp-etherchannel',
    plateformes: ['Cisco'],
    titre: 'TP complet — EtherChannel PAgP et LACP (S1, S2, S3)',
    resume: 'Nommer S1, S2 et S3, lire l’état des ports, former trois canaux (PAgP, LACP, LACP négocié), puis faire de S1 la racine du VLAN 1 pour que le canal Gigabit ne soit plus bloqué.',
    source: 'Énoncé du TP Packet Tracer « Configurer EtherChannel » fourni par l’enseignant, résumé dans nos mots, et documentation Cisco Catalyst 2960 (EtherChannel, Spanning Tree). Les noms, ports, groupes et modes sont ceux de l’exemple du laboratoire, à remplacer dans les champs ; en cas de doute, ton énoncé d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_TP_ETHERCHANNEL,
    parcours: [
      {
        lettre: 'A',
        titre: 'Partie 1 — Noms et état des ports',
        resume: 'Nommer les trois commutateurs, puis relever l’état, la vitesse, le duplex et le mode des ports qui les relient.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Nommer S1, S2 et S3 selon la topologie.', refs: [f(FT, 1, { titre: 'S1 : nommer' }), f(FT, 2, { titre: 'S2 : nommer' }), f(FT, 3, { titre: 'S3 : nommer' })] },
          { id: 'A2', texte: 'Lire l’état des ports avec show interfaces status et show interfaces trunk, avant de grouper.', refs: [f(FT, 4, { titre: 'Lire l’état des ports' }), f('cours-ec-avant-de-grouper', 1, { titre: 'Voir la vitesse' })] },
          { id: 'A3', texte: 'Régler tous les ports des canaux en trunk statique (DTP automatique les laisserait en accès).', refs: [f(FT, 5, { titre: 'S1 : canal 1' }), f('cours-dtp-trunk', 2, { titre: 'Choisir le mode' })], note: 'Le trunk statique est posé dans le bloc de chaque canal, juste avant l’extinction des ports.' },
          { id: 'A4', texte: 'Construire la topologie et câbler les ports du tableau des canaux.', refs: [], couvert: false, note: 'Se fait dans Packet Tracer (glisser les commutateurs, câbler les ports du tableau). Aucune commande IOS.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Partie 2 — Canal 1 : PAgP entre S1 et S3',
        resume: 'Ports F0/21 et F0/22 en trunk, éteints, groupés en desirable, rallumés ; puis le port-channel en trunk, sur S1 et S3.',
        prerequis: [f(FT, 4, { titre: 'Lire l’état des ports', pourquoi: 'les deux ports doivent avoir la même vitesse, le même duplex et le même mode.' })],
        items: [
          { id: 'B1', texte: 'S1 : canal 1 en PAgP (desirable), ports éteints avant, rallumés après.', refs: [f(FT, 5, { titre: 'S1 : canal 1' }), f('cours-ec-pagp', 2, { titre: 'groupe' })] },
          { id: 'B2', texte: 'S3 : le même canal 1, avec le même numéro de groupe.', refs: [f(FT, 6, { titre: 'S3 : canal 1' })] },
          { id: 'B3', texte: 'Régler l’interface port-channel 1 en trunk, sur les deux commutateurs.', refs: [f(FT, 5, { titre: 'port-channel' }), f('cours-ec-pagp', 4, { titre: 'port-channel' })] },
          { id: 'B4', texte: 'Vérifier le canal 1 : show etherchannel summary et show interfaces trunk.', refs: [f(FT, 7, { titre: 'Vérifier le canal 1' }), f('cours-ec-verifier', 1, { titre: 'Résumé' })], note: 'Si le canal manque, éteins puis rallume les ports aux deux bouts.' },
        ],
      },
      {
        lettre: 'C',
        titre: 'Partie 3 — Canal 2 : LACP entre S1 et S2',
        resume: 'Mêmes gestes avec les ports G0/1 et G0/2 et le mode active des deux côtés, avec un autre numéro de groupe.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'S1 : canal 2 en LACP (active) sur G0/1 et G0/2, avec un numéro de groupe différent du canal 1.', refs: [f(FT, 8, { titre: 'S1 : canal 2' }), f('cours-ec-lacp', 2, { titre: 'groupe' })] },
          { id: 'C2', texte: 'S2 : le même canal 2 en LACP (active).', refs: [f(FT, 9, { titre: 'S2 : canal 2' })] },
          { id: 'C3', texte: 'Vérifier le canal 2 et identifier le protocole de chaque canal.', refs: [f(FT, 10, { titre: 'Vérifier le canal 2' }), f('cours-ec-verifier', 1, { titre: 'Résumé' })], note: 'Sur S1 : canal 1 en PAgP et canal 2 en LACP.' },
        ],
      },
      {
        lettre: 'D',
        titre: 'Partie 4 — Canal 3 : LACP négocié entre S2 et S3',
        resume: 'Canal redondant entre S2 (passive) et S3 (active), puis S1 racine du VLAN 1 pour libérer le canal Gigabit.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'S2 : canal 3 sur F0/23 et F0/24 en mode passive (LACP seulement si l’autre bout le propose).', refs: [f(FT, 11, { titre: 'S2 : canal 3' }), f('cours-ec-lacp', 2, { titre: 'groupe' })] },
          { id: 'D2', texte: 'S3 : canal 3 en mode active, trunk sur l’interface port-channel.', refs: [f(FT, 12, { titre: 'S3 : canal 3' })] },
          { id: 'D3', texte: 'Vérifier le canal 3 avec show etherchannel summary.', refs: [f(FT, 13, { titre: 'Vérifier le canal 3' })] },
          { id: 'D4', texte: 'Constater avec show spanning-tree active quel canal Spanning Tree bloque.', refs: [f(FT, 14, { titre: 'Voir ce que Spanning Tree a bloqué' }), f('cours-stp-lire', 1, { titre: 'Lire' })] },
          { id: 'D5', texte: 'Faire de S1 la racine du VLAN 1 (root primary ou priorité 24576) et vérifier que le canal Gigabit transmet.', refs: [f(FT, 15, { titre: 'S1 : racine' }), f(FT, 16, { titre: 'Vérifier les canaux et l’arbre' }), f('cours-stp-racines', 2, { titre: 'Désigner la racine' })], note: 'Attends que Spanning Tree recalcule l’arbre (avance rapide dans Packet Tracer).' },
        ],
      },
      {
        lettre: 'E',
        titre: 'Enregistrer et défaire',
        resume: 'Enregistrer la configuration des trois commutateurs ; pour recommencer, utiliser les étapes d’annulation.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'Enregistrer la configuration de S1, S2 et S3.', refs: [f(FT, 17, { titre: 'Enregistrer' }), f('cisco-enregistrer-config')] },
          { id: 'E2', texte: 'Défaire le TP : défaire les trois canaux puis retirer la racine.', refs: [f(FT, 18, { titre: 'défaire le canal 1' })], note: 'Étapes « Annuler » à la fin de la fiche.' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-ec-pagp', pourquoi: 'PAgP en détail : desirable, auto et leurs pièges.' },
      { fiche: 'cours-ec-lacp', pourquoi: 'LACP en détail : active, passive et leurs pièges.' },
      { fiche: 'cours-ec-statique', pourquoi: 'le mode « on » : canal forcé sans protocole.' },
      { fiche: 'cours-ec-depanner', pourquoi: 'lire show etherchannel summary et trouver pourquoi un canal ne se forme pas.' },
      { fiche: 'cours-stp-racines', pourquoi: 'choisir la racine de Spanning Tree.' },
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe.' },
    ],
    ambiguites: [
      { id: 'EC-1', sujet: 'Valeurs de l’énoncé', texte: 'Les noms, les ports, les numéros de groupe et les modes sont des champs à remplir : ceux de l’exemple (S1 à S3, F0/21-22, G0/1-2, F0/23-24, groupes 1, 2 et 3) se remplacent si ton énoncé change.' },
      { id: 'EC-2', sujet: 'Tiret dans la plage de ports', texte: 'Les scripts de réponse de l’énoncé écrivent parfois « f0/21 – 22 » avec un tiret long : copié dans la console, il provoque une erreur. La fiche écrit la plage avec un tiret simple (ou deux ports séparés par une virgule).' },
      { id: 'EC-3', sujet: 'Version de Packet Tracer', texte: 'L’énoncé signale que les versions 7.2.1 et antérieures de Packet Tracer ne notent pas « switchport mode trunk » dans la configuration des interfaces port-channel : la commande reste valable, seule la lecture de la configuration diffère.' },
      { id: 'EC-4', sujet: 'Racine du VLAN 1', texte: 'L’énoncé propose « spanning-tree vlan 1 root primary » ou « spanning-tree vlan 1 priority 24576 » ; le champ de la fiche permet les deux, une seule suffit.' },
    ],
  },
];
