/**
 * cours-cisco-tp-vtp-dtp.mjs — CISCO-TP-VTP-DTP-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Formatif 6 « Configurer VTP et DTP » rangé dans « Mes cours et TP > Cisco » : cinq parcours qui
 * suivent la fiche complète `cours-tp-vtp-dtp` phase par phase (liens et DTP, serveur VTP, clients
 * VTP, vérification, enregistrement). Le parcours ne contient aucune commande : il renvoie vers
 * les étapes de la fiche. Les énoncés sont résumés dans nos mots.
 */
import { RESUME_TP_VTP_DTP } from './cours-resume-cisco-tp-vtp-dtp.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const FT = 'cours-tp-vtp-dtp';
const AVERTISSEMENT = 'La fiche explique comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) avec des champs à remplir (noms, ports, domaine, tableau de VLAN) ; elle ne remplace pas ton énoncé et ne prouve rien : « coché » veut seulement dire « je l’ai fait ». Le mot de passe VTP se tape sur chaque commutateur : le Toolkit n’en demande ni n’en conserve aucun.';

export const COURS_CISCO_TP_VTP_DTP_PARCOURS = [
  {
    id: 'cisco-tp-vtp-dtp',
    plateformes: ['Cisco'],
    titre: 'TP complet — VTP et DTP (formatif 6, DS1, AS1, AS2)',
    resume: 'Former les trunks avec DTP entre DS1, AS1 et AS2, créer le domaine VTP (DS1 serveur, mot de passe, VLAN 10 à 50), configurer AS1 et AS2 en clients, puis vérifier que les VLAN sont arrivés et enregistrer.',
    source: 'Énoncé du formatif 6 (Packet Tracer : configurer VTP et DTP) fourni par l’enseignant, résumé dans nos mots, et documentation Cisco Catalyst 2960 (VTP, VLAN et trunks). Les noms, ports et domaine sont les exemples du laboratoire, à remplacer dans les champs ; en cas de doute, ton énoncé d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_TP_VTP_DTP,
    parcours: [
      {
        lettre: 'A',
        titre: 'Les liens : câbles et DTP',
        resume: 'Câbler AS1 et AS2 à DS1, mettre les ports de DS1 en « dynamic desirable », laisser AS1 et AS2 répondre, puis lire les trunks et répondre aux questions du formatif.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Lire l’état de départ de DS1 : trunks et VTP.', refs: [f(FT, 1, { titre: 'Lire l’état de départ' })] },
          { id: 'A2', texte: 'Relier F0/7 de AS1 à F0/7 de DS1, puis F0/9 de AS2 à F0/9 de DS1 (câble croisé).', refs: [], couvert: false, note: 'Se fait dans Packet Tracer : câble « Copper Cross-Over » (ou automatique) entre deux commutateurs. Avec un câble droit le lien reste éteint.' },
          { id: 'A3', texte: 'Mettre F0/7 et F0/9 de DS1 en DTP « desirable ».', refs: [f(FT, 2, { titre: 'proposer le trunk' }), f('cours-dtp-trunk', 2, { titre: 'Choisir le mode' })] },
          { id: 'A4', texte: 'Laisser AS1 et AS2 répondre (dynamic auto) et allumer leurs ports.', refs: [f(FT, 3, { titre: 'AS1' }), f(FT, 4, { titre: 'AS2' })] },
          { id: 'A5', texte: 'Question : est-il correct de dire que les ports F0/7 et F0/9 de DS1 « auraient dû devenir des liaisons trunk » ?', refs: [], couvert: false, note: 'Oui seulement si l’autre bout répond (auto, desirable ou trunk) et que le lien est actif ; deux « auto » ou un « access » en face l’empêchent. Voir la question 1 du résumé.' },
          { id: 'A6', texte: 'Vérifier avec « show interfaces trunk » sur les trois commutateurs et lire le mode obtenu.', refs: [f(FT, 5, { titre: 'Vérifier les trunks' }), f('cisco-voir-trunks')], note: 'Mode attendu : desirable côté DS1, auto côté AS, état trunking. À confirmer sur ta propre sortie.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'DS1 : serveur VTP et VLAN',
        resume: 'Faire de DS1 le serveur du domaine (mode, domaine, version, mot de passe), vérifier le domaine, puis créer les VLAN 10, 20, 30, 40 et 50.',
        prerequis: [f(FT, 5, { titre: 'Vérifier les trunks', pourquoi: 'VTP ne circule que sur un trunk : sans trunk, aucun client ne recevra les VLAN.' })],
        items: [
          { id: 'B1', texte: 'DS1 en mode serveur avec le domaine du TP et la version de VTP.', refs: [f(FT, 6, { titre: 'mode serveur' }), f('cours-vtp-reseau', 2, { titre: 'Choisir le mode et le domaine' })] },
          { id: 'B2', texte: 'Poser le mot de passe du domaine (tapé sur la console).', refs: [f(FT, 7, { titre: 'mot de passe' })], note: 'Le mot de passe de ton énoncé se tape sur l’équipement : il n’est écrit nulle part dans le Toolkit.' },
          { id: 'B3', texte: 'Vérifier que le domaine est créé.', refs: [f('cours-vtp-reseau', 1, { titre: 'Lire l’état' })], note: '« show vtp status » doit montrer le mode Server et le nom du domaine.' },
          { id: 'B4', texte: 'Créer les VLAN 10, 20, 30, 40 et 50 sur DS1.', refs: [f(FT, 8, { titre: 'créer les VLAN' }), f('cisco-creer-vlan')] },
        ],
      },
      {
        lettre: 'C',
        titre: 'AS1 et AS2 : clients VTP',
        resume: 'Mettre AS1 et AS2 en mode client dans le domaine du TP, puis leur donner le mot de passe VTP.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'AS1 en mode client, même domaine, même version.', refs: [f(FT, 9, { titre: 'AS1 client' })] },
          { id: 'C2', texte: 'Mot de passe VTP sur AS1 (tapé sur la console).', refs: [f(FT, 10, { titre: 'mot de passe AS1' })] },
          { id: 'C3', texte: 'AS2 en mode client, même domaine, même version.', refs: [f(FT, 11, { titre: 'AS2 client' })] },
          { id: 'C4', texte: 'Mot de passe VTP sur AS2 (tapé sur la console).', refs: [f(FT, 12, { titre: 'mot de passe AS2' })] },
        ],
      },
      {
        lettre: 'D',
        titre: 'Vérifier que les clients ont appris les VLAN',
        resume: 'Comparer l’état VTP et la liste des VLAN sur AS1, AS2 et DS1 ; en cas d’échec, suivre le dépannage.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'Sur AS1 : « show vtp status » puis « show vlan brief ».', refs: [f(FT, 13, { titre: 'AS1 : les VLAN sont arrivés' })] },
          { id: 'D2', texte: 'Sur AS2 : « show vtp status » puis « show vlan brief ».', refs: [f(FT, 14, { titre: 'AS2 : les VLAN sont arrivés' })] },
          { id: 'D3', texte: 'Sur DS1 : relire l’état du serveur et comparer la révision.', refs: [f(FT, 15, { titre: 'relire l’état du serveur' })] },
          { id: 'D4', texte: 'Si un client ne reçoit rien : suivre la démarche de dépannage VTP et DTP.', refs: [f('cours-vtp-dtp-depanner', 1, { titre: 'Lire l’état VTP' })], note: 'Dans l’ordre : le lien (trunk), puis domaine, mot de passe, version, révision.' },
        ],
      },
      {
        lettre: 'E',
        titre: 'Enregistrer et défaire',
        resume: 'Enregistrer la configuration des trois commutateurs ; pour recommencer, utiliser les étapes d’annulation.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'Enregistrer la configuration de DS1, AS1 et AS2.', refs: [f(FT, 16, { titre: 'Enregistrer' }), f('cisco-enregistrer-config')] },
          { id: 'E2', texte: 'Défaire le TP : retirer les VLAN, sortir du jeu de VTP, remettre les ports en négociation.', refs: [f(FT, 17, { titre: 'supprimer les VLAN' })], note: 'Étapes « Annuler » à la fin de la fiche.' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-dtp-trunk', pourquoi: 'choisir le mode DTP d’un port (auto, desirable, trunk, access) et le lire.' },
      { fiche: 'cours-vtp-reseau', pourquoi: 'VTP en cinq temps, avec le piège de la révision d’un commutateur d’occasion.' },
      { fiche: 'cours-vtp-dtp-depanner', pourquoi: 'démarche de lecture quand un trunk ou un VLAN ne se comporte pas comme prévu.' },
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe.' },
    ],
    ambiguites: [
      { id: 'VD-1', sujet: 'Valeurs de l’énoncé', texte: 'Les noms (DS1, AS1, AS2), les ports (F0/7, F0/9), le domaine (CCNA-LAB) et les VLAN (10 à 50) sont des champs à remplir : ils sont ceux de l’exemple et se remplacent si ton énoncé change.' },
      { id: 'VD-2', sujet: 'Mot de passe VTP', texte: 'Le mot de passe est donné par l’énoncé et se tape sur chaque commutateur après « vtp password ». Le Toolkit n’en demande ni n’en conserve aucun ; il doit être identique sur les trois commutateurs.' },
      { id: 'VD-3', sujet: 'DTP ou trunk fixe', texte: 'Le formatif demande « dynamic desirable » pour apprendre DTP. En réel, on fixe « switchport mode trunk » des deux côtés avec « switchport nonegotiate » ; le champ « mode » de la fiche permet les deux.' },
    ],
  },
];
