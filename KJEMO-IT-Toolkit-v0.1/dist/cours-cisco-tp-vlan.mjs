/**
 * cours-cisco-tp-vlan.mjs — KJEMO-CISCO-TP-VLAN-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * TP « Trois VLAN, SSH et routage inter-VLAN » rangé EN TÊTE de « Mes cours et
 * TP > Cisco » : six parcours qui suivent la fiche complète
 * `cours-tp-vlan-ssh-intervlan` phase par phase (VLAN et ports, adresse de
 * gestion et SSH, trunk, routeur, tests, enregistrement). Le parcours ne
 * contient aucune commande : il renvoie vers les étapes de la fiche.
 */
import { RESUME_TP_VLAN } from './cours-resume-cisco-tp-vlan.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const FT = 'cours-tp-vlan-ssh-intervlan';
const AVERTISSEMENT = 'La fiche explique comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) avec un plan d’adressage d’exemple ; elle ne remplace pas ton énoncé et ne prouve rien : « coché » veut seulement dire « je l’ai fait ». Le Toolkit n’exécute aucune commande et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.';

export const COURS_CISCO_TP_VLAN_PARCOURS = [
  {
    id: 'cisco-tp-vlan-ssh-intervlan',
    plateformes: ['Cisco'],
    titre: 'TP complet — 3 VLAN, SSH et routage inter-VLAN (de A à Z)',
    resume: 'Du premier VLAN au routage entre VLAN en passant par SSH : créer trois VLAN, affecter les ports, joindre le commutateur en SSH, installer le trunk, configurer le routeur sur un bâton, tester de bout en bout et enregistrer.',
    source: 'Assemblage fait pour le Toolkit à partir des fiches Cisco IOS du catalogue (VLAN, SSH, trunk, sous-interfaces) et de la documentation Cisco Catalyst ; le plan d’adressage (VLAN 10, 20, 30) est un exemple de laboratoire, pas un énoncé reproduit. En cas de doute, ton énoncé d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_TP_VLAN,
    parcours: [
      {
        lettre: 'A',
        titre: 'Créer les trois VLAN et leurs ports',
        resume: 'Lire l’état de départ, nommer le commutateur, créer les VLAN 10, 20 et 30 et affecter les ports d’accès.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Lire l’état de départ du commutateur : VLAN existants et interfaces.', refs: [f(FT, 1, { titre: 'Lire l’état de départ' })] },
          { id: 'A2', texte: 'Nommer le commutateur et poser le domaine (nécessaire pour SSH).', refs: [f(FT, 2, { titre: 'Nommer le commutateur' })] },
          { id: 'A3', texte: 'Créer les trois VLAN avec leur nom.', refs: [f(FT, 3, { titre: 'Créer les trois VLAN' }), f('cisco-creer-vlan')], note: 'La fiche générale « créer un VLAN » du catalogue donne la même commande avec un numéro libre.' },
          { id: 'A4', texte: 'Mettre le port du poste de gestion dans le VLAN 30.', refs: [f(FT, 4, { titre: 'port du poste de gestion' })] },
          { id: 'A5', texte: 'Affecter les ports d’accès des VLAN 10 et 20.', refs: [f(FT, 12, { titre: 'Affecter les ports' })] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Adresse de gestion et SSH',
        resume: 'Donner une adresse au commutateur, créer le compte, générer la clé, activer SSH, puis se connecter depuis le poste de gestion.',
        prerequis: [f(FT, 3, { titre: 'Créer les trois VLAN', pourquoi: 'l’interface VLAN 30 n’existe que si le VLAN 30 existe.' })],
        items: [
          { id: 'B1', texte: 'Adresse de gestion sur l’interface VLAN 30 et passerelle par défaut.', refs: [f(FT, 5, { titre: 'adresse de gestion' }), f('cours-sw-gestion-ip', 1, { titre: 'adresse' })] },
          { id: 'B2', texte: 'Créer le compte local (mot de passe tapé sur la console).', refs: [f(FT, 6, { titre: 'compte local' })] },
          { id: 'B3', texte: 'Générer la clé RSA.', refs: [f(FT, 7, { titre: 'clé RSA' })] },
          { id: 'B4', texte: 'Activer SSH version 2 et restreindre les lignes à SSH.', refs: [f(FT, 8, { titre: 'SSH version 2' }), f('scenario-cisco-ssh-commutateur')], note: 'Le scénario SSH du catalogue détaille le test avant la restriction, avec son dépannage.' },
          { id: 'B5', texte: 'Régler le poste de gestion et ouvrir la session SSH.', refs: [f(FT, 9, { titre: 'poste de gestion' }), f(FT, 10, { titre: 'Se connecter en SSH' })] },
          { id: 'B6', texte: 'Confirmer que la suite se fait bien par SSH.', refs: [f(FT, 11, { titre: 'travailles bien par SSH' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Le trunk vers le routeur',
        resume: 'Installer le trunk 802.1Q vers le routeur, éteindre les ports inutilisés et vérifier les VLAN et le trunk.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Créer le trunk sur Gi0/1 en limitant les VLAN autorisés.', refs: [f(FT, 13, { titre: 'trunk vers le routeur' }), f('cours-dtp-trunk', 2, { titre: 'Choisir' })] },
          { id: 'C2', texte: 'Éteindre les ports inutilisés (facultatif).', refs: [f(FT, 14, { titre: 'ports inutilisés' }), f('cours-sw-ports-inutilises', 2, { titre: 'Éteindre' })] },
          { id: 'C3', texte: 'Vérifier les VLAN et le trunk.', refs: [f(FT, 15, { titre: 'Vérifier les VLAN' }), f('cisco-voir-trunks')] },
        ],
      },
      {
        lettre: 'D',
        titre: 'Le routeur sur un bâton',
        resume: 'Allumer l’interface physique, créer une sous-interface par VLAN et vérifier que les trois réseaux sont connectés.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'Allumer l’interface physique du routeur, sans adresse.', refs: [f(FT, 16, { titre: 'allumer l’interface physique' })] },
          { id: 'D2', texte: 'Créer une sous-interface par VLAN avec son encapsulation et sa passerelle.', refs: [f(FT, 17, { titre: 'sous-interface par VLAN' })] },
          { id: 'D3', texte: 'Vérifier les sous-interfaces et la table de routage.', refs: [f(FT, 18, { titre: 'Vérifier le routeur' }), f('cisco-voir-routes')] },
          { id: 'D4', texte: 'Expliquer pourquoi il n’y a pas de route statique à écrire.', refs: [], couvert: false, note: 'Question de cours : les trois réseaux sont directement connectés au routeur, donc déjà dans sa table (routes « C »). Voir « Comment un paquet passe d’un VLAN à l’autre » dans le résumé.' },
        ],
      },
      {
        lettre: 'E',
        titre: 'Tests de bout en bout',
        resume: 'Régler les deux autres postes, joindre les passerelles, joindre un autre VLAN, ouvrir SSH à travers le routeur et lire les tables.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'Régler les adresses des postes Ventes et Technique.', refs: [f(FT, 19, { titre: 'poste Ventes' })] },
          { id: 'E2', texte: 'Joindre la passerelle de chaque VLAN.', refs: [f(FT, 20, { titre: 'joindre sa passerelle' }), f('cours-rt-tester', 1, { titre: 'Ping' })] },
          { id: 'E3', texte: 'Joindre un poste d’un autre VLAN (routage inter-VLAN).', refs: [f(FT, 21, { titre: 'routage entre VLAN' })] },
          { id: 'E4', texte: 'Ouvrir une session SSH sur le commutateur depuis un autre VLAN.', refs: [f(FT, 22, { titre: 'depuis un autre VLAN' })] },
          { id: 'E5', texte: 'Lire les tables MAC, ARP et de routage.', refs: [f(FT, 23, { titre: 'Lire les tables' })] },
        ],
      },
      {
        lettre: 'F',
        titre: 'Enregistrer, dépanner et défaire',
        resume: 'Enregistrer la configuration des deux équipements ; en cas de problème, suivre le dépannage ; pour recommencer, utiliser les étapes d’annulation.',
        prerequis: [],
        items: [
          { id: 'F1', texte: 'Enregistrer la configuration du commutateur et du routeur.', refs: [f(FT, 24, { titre: 'Enregistrer la configuration' }), f('cisco-enregistrer-config')] },
          { id: 'F2', texte: 'Défaire le TP dans l’ordre inverse (routeur, trunk, ports, VLAN, SSH).', refs: [f(FT, 25, { titre: 'sous-interfaces' }), f(FT, 30, { titre: 'retirer SSH' })], note: 'Étapes « Annuler » à la fin de la fiche ; l’avant-dernière (adresse de gestion) et la dernière (SSH) se font par la console.' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe : à garder sous la main.' },
      { fiche: 'cisco-voir-vlans', pourquoi: 'lire la liste des VLAN et des ports.' },
      { fiche: 'cours-vtp-dtp-depanner', pourquoi: 'démarche de lecture quand un trunk ou un VLAN ne se comporte pas comme prévu.' },
    ],
    ambiguites: [
      { id: 'TV-1', sujet: 'Plan d’adressage et numéros de ports', texte: 'La fiche utilise un plan d’exemple (VLAN 10, 20, 30, ports Fa0/1 à Fa0/3, trunk Gi0/1, routeur Gi0/0). Si ton énoncé donne d’autres numéros ou adresses, remplace-les dans les commandes copiées : la suite des étapes reste la même.' },
      { id: 'TV-2', sujet: 'Commutateur de niveau 3 au lieu du routeur', texte: 'Le TP utilise un routeur sur un bâton (une sous-interface par VLAN). Un commutateur de niveau 3 ferait le même travail avec une interface VLAN par réseau et « ip routing » ; ce montage n’est pas couvert par cette fiche.' },
    ],
  },
];
