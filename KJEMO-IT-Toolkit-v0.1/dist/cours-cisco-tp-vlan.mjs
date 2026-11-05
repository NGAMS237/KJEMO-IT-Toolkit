/**
 * cours-cisco-tp-vlan.mjs — KJEMO-CISCO-TP-VLAN-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * TP « VLAN, SSH et routage inter-VLAN » rangé EN TÊTE de « Mes cours et
 * TP > Cisco » : sept parcours qui suivent la fiche complète
 * `cours-tp-vlan-ssh-intervlan` phase par phase (VLAN de gestion et du tableau, adresse de
 * gestion et SSH, trunk, routeur, tests, enregistrement, ajouts plus tard). Le parcours ne
 * contient aucune commande : il renvoie vers les étapes de la fiche.
 */
import { RESUME_TP_VLAN } from './cours-resume-cisco-tp-vlan.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const FT = 'cours-tp-vlan-ssh-intervlan';
const AVERTISSEMENT = 'La fiche explique comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) avec des champs à remplir (VLAN de gestion, tableau de VLAN, comptes) et un exemple de départ ; elle ne remplace pas ton énoncé et ne prouve rien : « coché » veut seulement dire « je l’ai fait ». Le Toolkit n’exécute aucune commande et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.';

export const COURS_CISCO_TP_VLAN_PARCOURS = [
  {
    id: 'cisco-tp-vlan-ssh-intervlan',
    plateformes: ['Cisco'],
    titre: 'TP complet — VLAN, SSH et routage inter-VLAN (de A à Z)',
    resume: 'Du VLAN de gestion au routage entre VLAN en passant par SSH : on part du VLAN de gestion 99 et d’UN VLAN, on ajoute des VLAN au tableau selon le besoin, on retrouve les bonnes commandes, puis on ajoute un deuxième administrateur SSH.',
    source: 'Assemblage fait pour le Toolkit à partir des fiches Cisco IOS du catalogue (VLAN, SSH, trunk, sous-interfaces) et de la documentation Cisco Catalyst ; les numéros, noms et adresses sont des exemples de laboratoire à remplacer dans les champs, pas un énoncé reproduit. En cas de doute, ton énoncé d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_TP_VLAN,
    parcours: [
      {
        lettre: 'A',
        titre: 'Le VLAN de gestion, les VLAN du tableau et leurs ports',
        resume: 'Lire l’état de départ, nommer le commutateur, créer le VLAN de gestion puis les VLAN du tableau, et affecter les ports.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Lire l’état de départ du commutateur : VLAN existants et interfaces.', refs: [f(FT, 1, { titre: 'Lire l’état de départ' })] },
          { id: 'A2', texte: 'Nommer le commutateur et poser le domaine (nécessaire pour SSH).', refs: [f(FT, 2, { titre: 'Nommer le commutateur' })] },
          { id: 'A3', texte: 'Créer le VLAN de gestion (99 dans l’exemple).', refs: [f(FT, 3, { titre: 'Créer le VLAN de gestion' })] },
          { id: 'A4', texte: 'Créer les VLAN du tableau avec leur nom : un bloc par ligne.', refs: [f(FT, 4, { titre: 'Créer les VLAN du tableau' }), f('cisco-creer-vlan')], note: 'La fiche générale « créer un VLAN » du catalogue donne la même commande avec un numéro libre.' },
          { id: 'A5', texte: 'Mettre le port du poste de gestion dans le VLAN de gestion.', refs: [f(FT, 5, { titre: 'port du poste de gestion' })] },
          { id: 'A6', texte: 'Affecter les ports d’accès de chaque VLAN du tableau (étape faite par SSH, après la phase B).', refs: [f(FT, 14, { titre: 'Affecter les ports' })] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Adresse de gestion et SSH',
        resume: 'Donner une adresse au commutateur, créer le compte du premier administrateur, générer la clé, activer SSH, puis se connecter depuis le poste de gestion.',
        prerequis: [f(FT, 3, { titre: 'Créer le VLAN de gestion', pourquoi: 'l’interface VLAN de gestion n’existe que si ce VLAN existe.' })],
        items: [
          { id: 'B1', texte: 'Adresse de gestion sur l’interface VLAN de gestion et passerelle par défaut.', refs: [f(FT, 6, { titre: 'adresse de gestion' }), f('cours-sw-gestion-ip', 1, { titre: 'adresse' })] },
          { id: 'B2', texte: 'Créer le compte local du premier administrateur (mot de passe tapé sur la console).', refs: [f(FT, 7, { titre: 'compte local' })] },
          { id: 'B3', texte: 'Contrôler le nom et le domaine, puis générer la clé RSA.', refs: [f(FT, 8, { titre: 'clé RSA' })] },
          { id: 'B4', texte: 'Activer SSH version 2 et restreindre les lignes à SSH.', refs: [f(FT, 9, { titre: 'SSH version 2' }), f('scenario-cisco-ssh-commutateur')], note: 'Le scénario SSH du catalogue détaille le test avant la restriction, avec son dépannage.' },
          { id: 'B5', texte: 'Régler le poste de gestion et ouvrir la session SSH.', refs: [f(FT, 10, { titre: 'poste de gestion' }), f(FT, 11, { titre: 'Se connecter en SSH' })] },
          { id: 'B6', texte: 'Confirmer que la suite se fait bien par SSH.', refs: [f(FT, 12, { titre: 'travailles bien par SSH' }), f(FT, 13, { titre: 'configuration globale' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Le trunk vers le routeur',
        resume: 'Installer le trunk 802.1Q vers le routeur avec la liste des VLAN (gestion + tableau) et vérifier les VLAN et le trunk.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Créer le trunk en limitant les VLAN autorisés au VLAN de gestion et à ceux du tableau.', refs: [f(FT, 15, { titre: 'trunk vers le routeur' }), f('cours-dtp-trunk', 2, { titre: 'Choisir' })] },
          { id: 'C2', texte: 'Vérifier les VLAN et le trunk.', refs: [f(FT, 16, { titre: 'Vérifier les VLAN' }), f('cisco-voir-trunks')] },
        ],
      },
      {
        lettre: 'D',
        titre: 'Le routeur sur un bâton',
        resume: 'Allumer l’interface physique, créer la sous-interface de gestion puis une sous-interface par VLAN du tableau, et vérifier les réseaux connectés.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'Allumer l’interface physique du routeur, sans adresse.', refs: [f(FT, 17, { titre: 'allumer l’interface physique' })] },
          { id: 'D2', texte: 'Créer la sous-interface du VLAN de gestion.', refs: [f(FT, 18, { titre: 'sous-interface du VLAN de gestion' })] },
          { id: 'D3', texte: 'Créer une sous-interface par VLAN du tableau avec son encapsulation et sa passerelle.', refs: [f(FT, 19, { titre: 'sous-interface par VLAN' })] },
          { id: 'D4', texte: 'Vérifier les sous-interfaces et la table de routage.', refs: [f(FT, 20, { titre: 'Vérifier le routeur' }), f('cisco-voir-routes')] },
          { id: 'D5', texte: 'Expliquer pourquoi il n’y a pas de route statique à écrire.', refs: [], couvert: false, note: 'Question de cours : tous les réseaux sont directement connectés au routeur, donc déjà dans sa table (routes « C »). Voir « Comment un paquet passe d’un VLAN à l’autre » dans le résumé.' },
        ],
      },
      {
        lettre: 'E',
        titre: 'Tests de bout en bout',
        resume: 'Régler les postes de chaque VLAN, joindre les passerelles, joindre le poste de gestion, ouvrir SSH à travers le routeur et lire les tables.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'Régler les adresses des postes de chaque VLAN du tableau.', refs: [f(FT, 21, { titre: 'adresses des postes' })] },
          { id: 'E2', texte: 'Joindre la passerelle de chaque VLAN.', refs: [f(FT, 22, { titre: 'passerelle de son VLAN' }), f('cours-rt-tester', 1, { titre: 'Ping' })] },
          { id: 'E3', texte: 'Joindre le poste de gestion depuis chaque VLAN (routage inter-VLAN), puis un poste d’un autre VLAN.', refs: [f(FT, 23, { titre: 'poste de gestion depuis chaque VLAN' }), f(FT, 24, { titre: 'autre VLAN du tableau' })] },
          { id: 'E4', texte: 'Ouvrir une session SSH sur le commutateur depuis chaque VLAN.', refs: [f(FT, 25, { titre: 'par SSH depuis chaque VLAN' })] },
          { id: 'E5', texte: 'Lire les tables MAC, ARP et de routage.', refs: [f(FT, 26, { titre: 'Lire les tables' })] },
        ],
      },
      {
        lettre: 'F',
        titre: 'Enregistrer, dépanner et défaire',
        resume: 'Enregistrer la configuration des deux équipements ; en cas de problème, suivre le dépannage ; pour recommencer, utiliser les étapes d’annulation.',
        prerequis: [],
        items: [
          { id: 'F1', texte: 'Enregistrer la configuration du commutateur et du routeur.', refs: [f(FT, 27, { titre: 'Enregistrer la configuration' }), f('cisco-enregistrer-config')] },
          { id: 'F2', texte: 'Défaire le TP dans l’ordre inverse (routeur, trunk, ports, gestion, VLAN, SSH).', refs: [f(FT, 31, { titre: 'sous-interfaces' }), f(FT, 38, { titre: 'retirer SSH' })], note: 'Étapes « Annuler » à la fin de la fiche ; celles de l’adresse de gestion et de SSH se font par la console.' },
        ],
      },
      {
        lettre: 'G',
        titre: 'Plus tard : un VLAN de plus, un deuxième administrateur',
        resume: 'Ajouter une ligne au tableau pour un nouveau VLAN (et copier seulement son bloc), l’autoriser sur le trunk avec « add », puis créer et tester un deuxième compte SSH.',
        prerequis: [f(FT, 15, { titre: 'trunk vers le routeur', pourquoi: 'le nouveau VLAN s’ajoute à un trunk déjà en place.' })],
        items: [
          { id: 'G1', texte: 'Ajouter le VLAN au trunk sans effacer la liste (« add »).', refs: [f(FT, 28, { titre: 'nouveau VLAN sur le trunk' })], note: 'Pour le reste du nouveau VLAN, copie seulement son bloc dans les étapes de création, de ports et de sous-interface.' },
          { id: 'G2', texte: 'Créer le compte d’un deuxième administrateur (mot de passe tapé sur la console).', refs: [f(FT, 29, { titre: 'deuxième administrateur' })] },
          { id: 'G3', texte: 'Tester la connexion SSH du deuxième administrateur.', refs: [f(FT, 30, { titre: 'tester la connexion' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe : à garder sous la main.' },
      { fiche: 'cisco-voir-vlans', pourquoi: 'lire la liste des VLAN et des ports.' },
      { fiche: 'cours-vtp-dtp-depanner', pourquoi: 'démarche de lecture quand un trunk ou un VLAN ne se comporte pas comme prévu.' },
    ],
    ambiguites: [
      { id: 'TV-1', sujet: 'Valeurs de l’énoncé', texte: 'Tout ce qui varie d’un énoncé à l’autre est un champ à remplir : VLAN de gestion, adresses, ports, nom du routeur, comptes, et le tableau des VLAN (de 1 à 6 lignes). L’exemple (VLAN 99, VLAN 10, Fa0/1, trunk Gi0/1, routeur Gi0/0) n’est qu’un point de départ.' },
      { id: 'TV-2', sujet: 'Commutateur de niveau 3 au lieu du routeur', texte: 'Le TP utilise un routeur sur un bâton (une sous-interface par VLAN). Un commutateur de niveau 3 ferait le même travail avec une interface VLAN par réseau et « ip routing » ; ce montage n’est pas couvert par cette fiche.' },
      { id: 'TV-3', sujet: 'Mots de passe', texte: 'Les lignes « username … secret » s’arrêtent avant le mot de passe : tu le tapes toi-même sur l’équipement. Le Toolkit n’en demande ni n’en conserve aucun.' },
    ],
  },
];
