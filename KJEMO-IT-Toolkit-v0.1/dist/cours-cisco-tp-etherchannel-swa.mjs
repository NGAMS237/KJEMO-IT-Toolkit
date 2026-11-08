/**
 * cours-cisco-tp-etherchannel-swa.mjs — CISCO-TP-ETHERCHANNEL-02 · KJEMO IT Toolkit
 * TP « Implémenter EtherChannel » (SWA, SWB, SWC) rangé dans « Mes cours et TP > Cisco » : cinq parcours qui
 * renvoient vers la fiche `cours-tp-etherchannel`, avec la correspondance des noms (SWA = S1, SWC = S2,
 * SWB = S3). Le parcours ne contient aucune commande ; la construction de la topologie n'a pas de
 * commande IOS : elle est déclarée « non couverte ». L'énoncé est résumé dans nos mots.
 */
import { RESUME_TP_ETHERCHANNEL_SWA } from './cours-resume-cisco-tp-etherchannel-swa.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const FT = 'cours-tp-etherchannel';
const AVERTISSEMENT = 'La fiche explique comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) avec des champs à remplir ; elle ne remplace pas ton énoncé et ne prouve rien : « coché » veut seulement dire « je l’ai fait ». Dans la fiche, SWA se saisit comme S1, SWC comme S2 et SWB comme S3.';

export const COURS_CISCO_TP_ETHERCHANNEL_SWA_PARCOURS = [
  {
    id: 'cisco-tp-etherchannel-swa',
    plateformes: ['Cisco'],
    titre: 'TP complet — Implémenter EtherChannel (SWA, SWB, SWC)',
    resume: 'Construire la topologie de trois commutateurs, puis former trois canaux : PAgP entre SWA et SWB, LACP entre SWA et SWC, LACP de sauvegarde entre SWB et SWC où SWC lance la négociation.',
    source: 'Énoncé du TP Packet Tracer « Implémenter EtherChannel » fourni par l’enseignant, résumé dans nos mots, et documentation Cisco Catalyst 2960 (EtherChannel). Les ports et les modes sont ceux de l’exemple du laboratoire ; en cas de doute, ton énoncé d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_TP_ETHERCHANNEL_SWA,
    parcours: [
      {
        lettre: 'A',
        titre: 'Partie 1 — Créer le réseau',
        resume: 'Placer les trois commutateurs, les nommer, les câbler selon le tableau, puis leur donner un nom d’hôte.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Placer trois commutateurs 2960 dans la zone de travail de Packet Tracer.', refs: [], couvert: false, note: 'Se fait dans Packet Tracer (Network Devices, Switches, 2960, glisser). Aucune commande IOS.' },
          { id: 'A2', texte: 'Renommer les noms d’affichage : SWA, SWB, SWC (l’étiquette sous l’icône, pas le nom d’hôte).', refs: [], couvert: false, note: 'Les noms d’affichage doivent correspondre exactement à l’énoncé pour être notés.' },
          { id: 'A3', texte: 'Câbler avec des câbles droits : SWA–SWB sur Gi0/1 et Gi0/2, SWA–SWC sur Fa0/21 et Fa0/22, SWB–SWC sur Fa0/23 et Fa0/24.', refs: [], couvert: false, note: 'Le schéma de topologie du résumé montre le câblage attendu. Aucune commande IOS.' },
          { id: 'A4', texte: 'Donner un nom d’hôte à chaque commutateur.', refs: [f(FT, 1, { titre: 'S1 : nommer (SWA)' }), f(FT, 2, { titre: 'S2 : nommer (SWC)' }), f(FT, 3, { titre: 'S3 : nommer (SWB)' })], note: 'Dans la fiche : S1 = SWA, S2 = SWC, S3 = SWB.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Canal 1 — PAgP entre SWA et SWB',
        resume: 'Ports Gi0/1 et Gi0/2 en trunk statique, groupés en desirable des deux côtés, puis le port-channel en trunk.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'SWA : trunk statique sur Gi0/1 et Gi0/2, canal 1 en desirable.', refs: [f(FT, 5, { titre: 'S1 : canal 1 (SWA)' }), f('cours-ec-pagp', 2, { titre: 'groupe' })], note: 'Fiche : champs « canal 1 » : ports Gi0/1 et Gi0/2, desirable des deux côtés.' },
          { id: 'B2', texte: 'SWB : les mêmes ports, canal 1 en desirable.', refs: [f(FT, 6, { titre: 'S3 : canal 1 (SWB)' })] },
          { id: 'B3', texte: 'Vérifier que le canal 1 est actif sur SWA et SWB.', refs: [f(FT, 7, { titre: 'Vérifier le canal 1' }), f('cours-ec-verifier', 1, { titre: 'Résumé' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Canal 2 — LACP entre SWA et SWC',
        resume: 'Ports Fa0/21 et Fa0/22 en trunk statique, groupés en active des deux côtés.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'SWA : trunk statique sur Fa0/21 et Fa0/22, canal 2 en active.', refs: [f(FT, 8, { titre: 'S1 : canal 2 (SWA)' }), f('cours-ec-lacp', 2, { titre: 'groupe' })], note: 'Fiche : champs « canal 2 » : ports Fa0/21 et Fa0/22, active des deux côtés.' },
          { id: 'C2', texte: 'SWC : les mêmes ports, canal 2 en active.', refs: [f(FT, 9, { titre: 'S2 : canal 2 (SWC)' })] },
          { id: 'C3', texte: 'Vérifier le canal 2 : SWA liste maintenant deux canaux, un PAgP et un LACP.', refs: [f(FT, 10, { titre: 'Vérifier le canal 2' })] },
        ],
      },
      {
        lettre: 'D',
        titre: 'Canal 3 — LACP de sauvegarde entre SWB et SWC',
        resume: 'Canal redondant où SWC lance la négociation et SWB répond seulement.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'SWC : canal 3 sur Fa0/23 et Fa0/24 en active (il lance la négociation).', refs: [f(FT, 11, { titre: 'S2 : canal 3 (SWC)' })], note: 'Fiche : « mode de S2 » = active (S2 est SWC).' },
          { id: 'D2', texte: 'SWB : le même canal 3 en passive (il n’initie pas).', refs: [f(FT, 12, { titre: 'S3 : canal 3 (SWB)' })], note: 'Fiche : « mode de S3 » = passive (S3 est SWB).' },
          { id: 'D3', texte: 'Vérifier le canal 3 avec show etherchannel summary sur SWB et SWC.', refs: [f(FT, 13, { titre: 'Vérifier le canal 3' })] },
        ],
      },
      {
        lettre: 'E',
        titre: 'Vérifier, enregistrer et défaire',
        resume: 'Contrôle final des trois canaux, enregistrement et annulation pour recommencer.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'Contrôler les trois canaux sur chaque commutateur (SWA : Po1 et Po2, SWB : Po1 et Po3, SWC : Po2 et Po3).', refs: [f(FT, 13, { titre: 'Vérifier' }), f('cours-ec-verifier', 1, { titre: 'Résumé' })] },
          { id: 'E2', texte: 'Enregistrer la configuration des trois commutateurs.', refs: [f(FT, 17, { titre: 'Enregistrer' }), f('cisco-enregistrer-config')] },
          { id: 'E3', texte: 'Défaire un canal pour recommencer.', refs: [f(FT, 18, { titre: 'défaire le canal 1' })], note: 'Étapes « Annuler » à la fin de la fiche. Ne fais pas la racine de Spanning Tree : elle n’est pas dans cet exercice.' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-ec-pagp', pourquoi: 'PAgP en détail : desirable, auto et leurs pièges.' },
      { fiche: 'cours-ec-lacp', pourquoi: 'LACP en détail : active, passive et leurs pièges.' },
      { fiche: 'cours-ec-depanner', pourquoi: 'lire show etherchannel summary et trouver pourquoi un canal ne se forme pas.' },
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe.' },
    ],
    ambiguites: [
      { id: 'SW-1', sujet: 'Noms dans la fiche', texte: 'La fiche s’appelle S1, S2, S3 : SWA se saisit dans S1, SWC dans S2 et SWB dans S3. Les étapes de la fiche suivent donc l’ordre SWA, SWC, SWB.' },
      { id: 'SW-2', sujet: 'Script du prof', texte: 'Le script de SWC se termine par « finir », qui n’est pas une commande IOS (il faut end), et celui de SWA contient deux interfaces vides ; la fiche n’en tient pas compte. Il ne contient pas non plus l’extinction des ports ni le trunk sur le port-channel : la fiche les ajoute, comme dans l’autre TP.' },
      { id: 'SW-3', sujet: 'Tableau des canaux', texte: 'Dans le tableau de l’énoncé, la ligne de type (PAgP, LACP) n’est écrite que sur le premier câble de chaque canal et des mots sont mélangés (« à », « to ») : les deux câbles d’un canal ont le même protocole.' },
      { id: 'SW-4', sujet: 'Spanning Tree', texte: 'Cet exercice n’a pas de partie Spanning Tree : saute les étapes « racine » de la fiche.' },
    ],
  },
];
