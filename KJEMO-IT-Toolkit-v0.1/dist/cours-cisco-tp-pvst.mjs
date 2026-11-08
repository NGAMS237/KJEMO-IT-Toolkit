/**
 * cours-cisco-tp-pvst.mjs — CISCO-TP-PVST-01 · KJEMO IT Toolkit
 * TP « Configuration du protocole PVST+ » rangé dans « Mes cours et TP > Cisco » : cinq parcours qui
 * suivent la fiche complète `cours-tp-pvst` phase par phase. Le parcours ne contient aucune
 * commande : il renvoie vers les étapes de la fiche. L'énoncé est résumé dans nos mots.
 */
import { RESUME_TP_PVST } from './cours-resume-cisco-tp-pvst.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const FT = 'cours-tp-pvst';
const AVERTISSEMENT = 'La fiche explique comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) avec des champs à remplir (noms, VLAN, ports, adresses, racines) ; elle ne remplace pas ton énoncé et ne prouve rien : « coché » veut seulement dire « je l’ai fait ».';

export const COURS_CISCO_TP_PVST_PARCOURS = [
  {
    id: 'cisco-tp-pvst',
    plateformes: ['Cisco'],
    titre: 'TP complet — PVST+, PortFast et BPDU guard (S1, S2, S3)',
    resume: 'Créer les VLAN et les trunks sur S1, S2 et S3, choisir des racines PVST+ différentes selon les VLAN pour équilibrer la charge, puis protéger les ports des postes avec PortFast et la protection BPDU.',
    source: 'Énoncé du TP Packet Tracer « Configuration du protocole PVST+ » fourni par l’enseignant, résumé dans nos mots, et documentation Cisco Catalyst 2960 (Spanning Tree, VLAN, PortFast). Les noms, VLAN, ports et adresses sont ceux de l’exemple du laboratoire, à remplacer dans les champs ; en cas de doute, ton énoncé d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_TP_PVST,
    parcours: [
      {
        lettre: 'A',
        titre: 'Partie 1 — VLAN, ports d’accès, trunks et gestion',
        resume: 'Sur chaque commutateur : nommer, créer les VLAN, mettre le port du poste en accès dans son VLAN, créer les trunks à VLAN natif et poser l’adresse de gestion.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Nommer S1, S2 et S3.', refs: [f(FT, 1, { titre: 'S1 : nommer' }), f(FT, 3, { titre: 'S2 : nommer' }), f(FT, 5, { titre: 'S3 : nommer' })] },
          { id: 'A2', texte: 'Créer les VLAN 10, 20, 30, 40, 50, 60, 70, 80 et 99 sur les trois commutateurs.', refs: [f(FT, 2, { titre: 'S1 : créer les VLAN' }), f(FT, 4, { titre: 'S2 : créer les VLAN' }), f(FT, 6, { titre: 'S3 : créer les VLAN' }), f('cisco-creer-vlan')], note: 'Pas de VTP dans ce TP : les VLAN se créent sur chaque commutateur.' },
          { id: 'A3', texte: 'Ports d’accès : F0/6 de S1 (VLAN 30), F0/18 de S2 (VLAN 20), F0/11 de S3 (VLAN 10), allumés.', refs: [f(FT, 7, { titre: 'S1 : port d’accès' }), f(FT, 8, { titre: 'S2 : port d’accès' }), f(FT, 9, { titre: 'S3 : port d’accès' })] },
          { id: 'A4', texte: 'Trunks F0/1 à F0/4 de chaque commutateur, avec le VLAN natif 99.', refs: [f(FT, 7, { titre: 'trunks' }), f('cours-dtp-trunk', 2, { titre: 'Choisir le mode' })], note: 'Le VLAN natif doit être le même aux deux bouts de chaque trunk.' },
          { id: 'A5', texte: 'Adresse de gestion sur l’interface VLAN 99 de chaque commutateur.', refs: [f(FT, 7, { titre: 'adresse de gestion' }), f('cours-sw-gestion-ip', 1, { titre: 'adresse' })] },
          { id: 'A6', texte: 'Régler les adresses des PC (PC1, PC2, PC3).', refs: [], couvert: false, note: 'Se fait dans Packet Tracer sur chaque PC : Desktop, IP Configuration, adresse, masque et passerelle de l’énoncé. Aucune commande IOS.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Vérifier les VLAN et joindre les commutateurs',
        resume: 'Lire les VLAN et les trunks sur chaque commutateur, puis joindre les autres commutateurs par ping.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Vérifier les VLAN et les trunks avec « show vlan brief » et « show interfaces trunk ».', refs: [f(FT, 10, { titre: 'Vérifier les VLAN et les trunks' }), f('cisco-voir-vlans'), f('cisco-voir-trunks')] },
          { id: 'B2', texte: 'Joindre S2 et S3 depuis S1 par ping sur les adresses de gestion.', refs: [f(FT, 11, { titre: 'Joindre les autres commutateurs' }), f('cours-rt-tester', 1, { titre: 'Ping' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Partie 2 — PVST+ et équilibrage de charge',
        resume: 'Choisir PVST+ partout, puis répartir les racines : S1 principale pour ses VLAN, S3 principale pour les autres, S2 secondaire pour tous.',
        prerequis: [f(FT, 10, { titre: 'Vérifier les VLAN et les trunks', pourquoi: 'les racines se calculent sur des VLAN qui existent et sur des trunks actifs.' })],
        items: [
          { id: 'C1', texte: 'Mode PVST sur les trois commutateurs et S1 racine principale des VLAN 1, 10, 30, 50, 70.', refs: [f(FT, 12, { titre: 'S1 : PVST+ et racine principale' }), f('cours-stp-racines', 1, { titre: 'Choisir le mode' })] },
          { id: 'C2', texte: 'S2 racine secondaire de tous les VLAN.', refs: [f(FT, 13, { titre: 'S2 : racine secondaire' }), f('cours-stp-racines', 2, { titre: 'Désigner la racine' })] },
          { id: 'C3', texte: 'S3 racine principale des VLAN 20, 40, 60, 80, 99.', refs: [f(FT, 14, { titre: 'S3 : racine principale' })] },
          { id: 'C4', texte: 'Vérifier les racines avec « show spanning-tree ».', refs: [f(FT, 15, { titre: 'Vérifier les racines' }), f('cours-stp-lire', 1, { titre: 'Lire' })], note: '« This bridge is the root » doit apparaître sur le bon commutateur pour chaque VLAN.' },
        ],
      },
      {
        lettre: 'D',
        titre: 'Partie 3 — PortFast et protection BPDU',
        resume: 'Activer PortFast puis la protection BPDU sur le port de chaque poste, et relire la configuration.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'PortFast et protection BPDU sur F0/6 de S1.', refs: [f(FT, 16, { titre: 'S1 : PortFast' }), f('cours-stp-portfast-bpduguard', 2, { titre: 'Activer PortFast' })] },
          { id: 'D2', texte: 'PortFast et protection BPDU sur F0/18 de S2.', refs: [f(FT, 17, { titre: 'S2 : PortFast' })] },
          { id: 'D3', texte: 'PortFast et protection BPDU sur F0/11 de S3.', refs: [f(FT, 18, { titre: 'S3 : PortFast' })] },
          { id: 'D4', texte: 'Relire la configuration avec « show running-config ».', refs: [f(FT, 19, { titre: 'Relire la configuration' })] },
        ],
      },
      {
        lettre: 'E',
        titre: 'Enregistrer et défaire',
        resume: 'Enregistrer la configuration des trois commutateurs ; pour recommencer, utiliser les étapes d’annulation.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'Enregistrer la configuration de S1, S2 et S3.', refs: [f(FT, 20, { titre: 'Enregistrer' }), f('cisco-enregistrer-config')] },
          { id: 'E2', texte: 'Défaire le TP : retirer PortFast et BPDU guard, les racines, puis les VLAN.', refs: [f(FT, 21, { titre: 'PortFast et BPDU guard' })], note: 'Étapes « Annuler » à la fin de la fiche.' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-stp-lire', pourquoi: 'lire « show spanning-tree » : racine, rôles et états des ports.' },
      { fiche: 'cours-stp-racines', pourquoi: 'choisir PVST+ ou Rapid PVST+ et fixer les racines.' },
      { fiche: 'cours-stp-portfast-bpduguard', pourquoi: 'PortFast et BPDU guard sur un port d’accès, avec le port err-disabled.' },
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe.' },
    ],
    ambiguites: [
      { id: 'PV-1', sujet: 'Valeurs de l’énoncé', texte: 'Les noms, les VLAN, les ports et les adresses sont des champs à remplir : ceux de l’exemple (S1 à S3, VLAN 10 à 80 et 99, F0/1 à F0/4, 172.31.99.0/24) se remplacent si ton énoncé change.' },
      { id: 'PV-2', sujet: 'Réseaux du tableau des ports', texte: 'Le tableau de l’énoncé indique des réseaux 172.17.x.0/24 alors que la table d’adressage donne des PC en 172.31.x.0/24 : ce sont des incohérences de l’énoncé. Le TP ne configure aucune adresse de VLAN sur les commutateurs sauf le VLAN 99 ; suis la table d’adressage pour les PC.' },
      { id: 'PV-3', sujet: 'PortFast dans l’énoncé', texte: 'L’énoncé écrit « config-if-range » pour PortFast alors qu’il s’agit d’un seul port : la fiche utilise « config-if ». Le résultat est le même.' },
      { id: 'PV-4', sujet: 'Mode STP', texte: 'L’énoncé demande PVST+ ; le champ « mode de Spanning Tree » permet aussi Rapid PVST+ (convergence rapide).' },
    ],
  },
];
