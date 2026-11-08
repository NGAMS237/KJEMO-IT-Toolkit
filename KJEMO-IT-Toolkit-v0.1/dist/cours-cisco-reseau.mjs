/**
 * cours-cisco-reseau.mjs — KJEMO-CISCO-COURS-RESEAU-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Cours Cisco « Architecture réseau II » des semaines 1 à 5 et TP2, rangés
 * dans « Mes cours Cisco » à côté de la semaine 7 (EtherChannel et STP) :
 *
 *   S01  Révision et VLSM
 *   S02  Commutateur : base, SSH, sécurité des ports (et formatif 3.1)
 *   S02–S03  Routage statique et RIP
 *   S05  VLAN évolutifs : VTP et DTP
 *   TP2  Trois routeurs et routes statiques
 *
 * Chaque cours est un PARCOURS qui renvoie vers des fiches : il ne contient
 * aucune commande. Les fiches déjà au catalogue (VLAN, trunks, SSH, routes,
 * ARP, DHCP, DNS) sont citées, jamais refaites. Les énoncés sont résumés dans
 * nos mots ; les documents d'origine ne sont pas republiés.
 */
import { RESUME_S01, RESUME_S02, RESUME_ROUTAGE, RESUME_S05, RESUME_TP2_CISCO } from './cours-resume-cisco-reseau.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const AVERTISSEMENT = 'Les fiches expliquent comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) ; elles ne remplacent pas ton énoncé et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Le Toolkit n’exécute aucune commande et rien n’a été essayé sur du matériel Cisco réel.';

export const COURS_CISCO_RESEAU_PARCOURS = [
  // ===========================================================================
  {
    id: 'cisco-s01-revision-vlsm',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — Semaine 1 : révision et VLSM',
    resume: 'Les rappels d’Architecture réseau I (ARP, DHCP, DNS, commutateur, routeur), les masques et le découpage VLSM, avec un résumé pliable et les tableaux de masques.',
    source: 'Diapositives « Révision architecture réseau I » et « Révision VLSM », tableaux VLSM (classes A, B, C) et note de cours fournis par l’étudiant, non republiés ici : le résumé et les schémas sont écrits dans nos mots. En cas de doute, le document d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_S01,
    parcours: [
      {
        lettre: 'A',
        titre: 'Révision : ARP, DHCP, DNS, commutateur et routeur',
        resume: 'Les notions à maîtriser selon la note de cours : lire la table ARP, connaître DORA, déboguer un nom DNS dans l’ordre (hosts, cache, résolveur), lire la table MAC d’un commutateur et la table de routage d’un routeur.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'ARP : lire la table du poste (arp -a) et comprendre ce qu’elle contient.', refs: [], assistants: ['arp-neighbor-diagnostic'], note: 'Assistant Windows existant : il lit la table ARP et le voisinage.' },
          { id: 'A2', texte: 'DHCP : connaître DORA et lire le bail du poste.', refs: [f('renouveler-bail-dhcp', null, { titre: 'Renouveler l’adresse' })], assistants: ['dhcp-client-diagnostic'] },
          { id: 'A3', texte: 'DNS : retrouver où le technicien débogue en premier (hosts, cache, résolveur) et vider le cache.', refs: [f('vider-cache-dns'), f('resoudre-nom-dns')], assistants: ['dns-client-diagnostic'] },
          { id: 'A4', texte: 'Commutateur : retrouver sur quel port se trouve une adresse MAC (table CAM).', refs: [f('cisco-trouver-adresse-mac')] },
          { id: 'A5', texte: 'Routeur : lire les interfaces et la table de routage.', refs: [f('cisco-voir-routes')] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Masques et VLSM',
        resume: 'Trouver l’adresse réseau avec un masque, utiliser les tableaux de masques, découper un bloc en VLSM, puis appliquer les adresses sur un routeur et sur un commutateur.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Déterminer l’adresse réseau à partir d’une adresse IP et d’un masque (ET binaire).', refs: [], assistants: ['ipv4-subnet-calculator'], note: 'Calcul à faire à la main ; le calculateur du Toolkit sert à contrôler. Voir le résumé pliable.' },
          { id: 'B2', texte: 'Découper un bloc en sous-réseaux de tailles variables (VLSM), du plus grand besoin au plus petit.', refs: [], assistants: ['ipv4-subnet-calculator'], note: 'Calcul à la main : le résumé pliable donne la méthode, un exemple et les tableaux de masques.' },
          { id: 'B3', texte: 'Appliquer une adresse et un masque à une interface de routeur et l’allumer.', refs: [f('cours-rt-interface-ip', 2, { titre: 'Poser l’adresse' })] },
          { id: 'B4', texte: 'Donner une adresse de gestion à un commutateur, avec sa passerelle.', refs: [f('cours-sw-gestion-ip', 1, { titre: 'adresse' }), f('cours-sw-gestion-ip', 2, { titre: 'passerelle' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe : à garder sous la main.' },
      { fiche: 'cours-rt-tester', pourquoi: 'ping et traceroute pour tester un plan d’adressage.' },
    ],
    ambiguites: [
      { id: 'S01-1', sujet: 'Hôtes ou adresses dans les tableaux', texte: 'Les tableaux VLSM du cours comptent les ADRESSES d’un bloc (256, 128, 64…) ; le nombre d’hôtes utilisables est ce nombre moins deux (réseau et diffusion). Le résumé affiche les deux colonnes.' },
    ],
  },
  // ===========================================================================
  {
    id: 'cisco-s02-commutateur-securite',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — Semaine 2 : commutateur, SSH et sécurité des ports',
    resume: 'Configuration de base d’un commutateur (nom, mots de passe, adresse de gestion), accès SSH, vitesse et duplex, diagnostic des ports, ports inutilisés, sécurité des ports, puis sauvegarde et transfert d’une configuration (formatif 3.1).',
    source: 'Diapositive « Configuration des commutateurs : base, SSH, sécurité des ports » et formatif 3.1 (accès au commutateur par SSH) fournis par l’étudiant, non republiés ici : les parcours résument les demandes dans nos mots. En cas de doute, l’énoncé d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_S02,
    parcours: [
      {
        lettre: 'A',
        titre: 'Configuration de base et accès à distance',
        resume: 'Formatif 3.1 : accéder au commutateur en console, poser une adresse de gestion, un nom, une bannière, puis configurer SSH et tester l’accès sans câble console.',
        prerequis: [f('cours-base-peripherique', 1, { titre: 'Nommer', pourquoi: 'le nom d’hôte est exigé avant la clé SSH.' })],
        items: [
          { id: 'A1', texte: 'Ouvrir le CLI du commutateur par le câble console avec PuTTY (type « Serial », bon numéro de port COM).', refs: [], couvert: false, note: 'Le montage (câbles USB-série et console, numéro COM dans le gestionnaire de périphériques, réglage de PuTTY) se fait sur ton poste ; aucune commande du catalogue n’y répond.' },
          { id: 'A2', texte: 'Adresse IP sur l’interface de gestion (SVI) et passerelle.', refs: [f('cours-sw-gestion-ip', 1, { titre: 'adresse' }), f('cours-sw-gestion-ip', 2, { titre: 'passerelle' })] },
          { id: 'A3', texte: 'Nom de la machine et bannière du jour.', refs: [f('cours-base-peripherique', 1, { titre: 'Nommer' }), f('cours-base-peripherique', 6, { titre: 'bannière' })] },
          { id: 'A4', texte: 'Mots de passe de la console et du mode privilégié.', refs: [f('cours-base-peripherique', 2, { titre: 'console' }), f('cours-base-peripherique', 4, { titre: 'privilégié' })] },
          { id: 'A5', texte: 'Configuration de l’accès SSH : domaine, clé RSA, compte local, lignes vty, version 2.', refs: [f('scenario-cisco-ssh-commutateur')] },
          { id: 'A6', texte: 'Retirer le câble console et accéder au commutateur par SSH.', refs: [], couvert: false, note: 'Le test se fait depuis un poste (client SSH ou invite de commande) vers l’adresse de gestion ; il confirme que la configuration est bonne mais n’a pas de commande IOS propre.' },
          { id: 'A7', texte: 'Enregistrer la configuration.', refs: [f('cisco-enregistrer-config')] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Ports : vitesse, diagnostic, ports inutilisés et sécurité',
        resume: 'Les ports du commutateur : fixer vitesse et duplex, lire un port en panne, éteindre les ports inutilisés et protéger les ports utilisés avec port-security.',
        prerequis: [f('cours-sw-diagnostiquer-port', 1, { titre: 'Vue d’ensemble', pourquoi: 'repérer l’état de chaque port avant de modifier.' })],
        items: [
          { id: 'B1', texte: 'Vitesse, duplex et auto-MDIX d’un port.', refs: [f('cours-sw-duplex-vitesse', 2, { titre: 'Fixer' }), f('cours-sw-duplex-vitesse', 3, { titre: 'automatique' })] },
          { id: 'B2', texte: 'Lire un port en panne : état, protocole de ligne, erreurs.', refs: [f('cours-sw-diagnostiquer-port', 1, { titre: 'Vue d’ensemble' }), f('cours-sw-diagnostiquer-port', 2, { titre: 'Détail' })] },
          { id: 'B3', texte: 'Désactiver les ports inutilisés du commutateur.', refs: [f('cours-sw-ports-inutilises', 2, { titre: 'Éteindre' })] },
          { id: 'B4', texte: 'Sécurité des ports : maximum d’adresses, adresses sticky ou statiques.', refs: [f('cours-sw-portsec', 2, { titre: 'maximum' }), f('cours-sw-portsec', 3, { titre: 'sticky' }), f('cours-sw-portsec', 4, { titre: 'main' })] },
          { id: 'B5', texte: 'Modes de violation (protect, restrict, shutdown) et remise en service d’un port.', refs: [f('cours-sw-portsec', 5, { titre: 'sanction' }), f('cours-sw-portsec', 7, { titre: 'err-disabled' })] },
          { id: 'B6', texte: 'Vérifier les adresses sécurisées et la table d’adresses.', refs: [f('cours-sw-portsec', 6, { titre: 'Contrôler' }), f('cisco-trouver-adresse-mac')] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Sauvegarder et transférer une configuration (formatif 3.1, partie 4)',
        resume: 'Sauvegarder la configuration d’un routeur dans un fichier texte et la réutiliser sur un routeur physique ou Packet Tracer, en ajustant les interfaces et en gérant les lignes de cryptographie.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Ajouter le module d’extension au routeur Packet Tracer (même nombre d’interfaces que le routeur physique).', refs: [], couvert: false, note: 'L’ajout du module se fait dans l’onglet Physical de Packet Tracer (éteindre, glisser le module, rallumer) ; ce n’est pas une commande IOS.' },
          { id: 'C2', texte: 'Afficher la configuration et la copier dans un fichier texte.', refs: [f('cours-config-portable', 1, { titre: 'Afficher' })] },
          { id: 'C3', texte: 'Charger la configuration sur un autre routeur en configuration globale.', refs: [f('cours-config-portable', 4, { titre: 'Coller' })] },
          { id: 'C4', texte: 'Ajuster les noms d’interfaces et retirer les lignes de cryptographie qui ne se transfèrent pas.', refs: [f('cours-config-portable', 2, { titre: 'interfaces' }), f('cours-config-portable', 3, { titre: 'Préparer' })] },
          { id: 'C5', texte: 'Sauvegarder (write memory ou copy run start).', refs: [f('cours-config-portable', 5, { titre: 'Enregistrer' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe : à garder sous la main.' },
      { fiche: 'cisco-voir-trunks', pourquoi: 'lire les trunks quand un port ne se comporte pas comme prévu.' },
    ],
    ambiguites: [
      { id: 'S02-1', sujet: 'Démarrage, récupération et voyants', texte: 'La séquence de démarrage, la récupération par le chargeur d’amorçage et les voyants sont de la théorie : ils sont dans le résumé pliable, pas dans une fiche de commandes.' },
    ],
  },
  // ===========================================================================
  {
    id: 'cisco-s02-s03-routage',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — Semaines 2 et 3 : routage statique et RIP',
    resume: 'Adresser les interfaces d’un routeur, créer des routes statiques, par défaut et flottantes, tester avec ping et traceroute, puis le routage dynamique avec RIPv2.',
    source: 'Diapositives « Routage statique » et « Routage dynamique » (chapitre 14.5 de CCNA 2 v7) fournies par l’étudiant, non republiées ici : les parcours et le résumé sont écrits dans nos mots. En cas de doute, le document d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_ROUTAGE,
    parcours: [
      {
        lettre: 'A',
        titre: 'Routes statiques',
        resume: 'Adresser les interfaces, écrire les routes aller et retour, une route par défaut, une route de secours, puis tester.',
        prerequis: [f('cours-rt-interface-ip', 2, { titre: 'Poser l’adresse', pourquoi: 'on ne route que sur des interfaces adressées et allumées.' })],
        items: [
          { id: 'A1', texte: 'Adresser les interfaces du routeur et les allumer (no shutdown).', refs: [f('cours-rt-interface-ip', 2, { titre: 'Poser l’adresse' })] },
          { id: 'A2', texte: 'Fixer l’horloge sur le bout DCE d’un lien série.', refs: [f('cours-rt-interface-ip', 3, { titre: 'DCE' })] },
          { id: 'A3', texte: 'Écrire une route statique vers chaque réseau non directement connecté.', refs: [f('cours-rt-statique', 2, { titre: 'Ajouter' })] },
          { id: 'A4', texte: 'Écrire une route par défaut vers le fournisseur.', refs: [f('cours-rt-defaut-flottante', 1, { titre: 'par défaut' })] },
          { id: 'A5', texte: 'Préparer une route de secours (flottante) vers un réseau.', refs: [f('cours-rt-defaut-flottante', 3, { titre: 'secours' })] },
          { id: 'A6', texte: 'Lire la table de routage : codes C, L, S, S*, distance et métrique.', refs: [f('cours-rt-statique', 4, { titre: 'Contrôler' }), f('cisco-voir-routes')] },
          { id: 'A7', texte: 'Tester la connectivité et repérer l’endroit où elle casse.', refs: [f('cours-rt-tester', 1, { titre: 'Ping' }), f('cours-rt-tester', 2, { titre: 'Traceroute' })] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Routage dynamique : RIP',
        resume: 'Configurer RIPv2, taire l’interface vers les postes, propager une route par défaut et vérifier les routes apprises.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Comparer routage statique et dynamique, vecteur de distance et état de liens, IGP et BGP.', refs: [], couvert: false, note: 'Question de cours, sans commande : la comparaison est dans le résumé pliable (section « Routage dynamique : les notions »).' },
          { id: 'B2', texte: 'Activer RIP en version 2 sans résumé automatique.', refs: [f('cours-rip-configurer', 1, { titre: 'Démarrer' })] },
          { id: 'B3', texte: 'Annoncer les réseaux connectés.', refs: [f('cours-rip-configurer', 2, { titre: 'Annoncer' })] },
          { id: 'B4', texte: 'Taire l’interface vers les postes (passive-interface).', refs: [f('cours-rip-configurer', 3, { titre: 'Taire' })] },
          { id: 'B5', texte: 'Propager la route par défaut aux autres routeurs.', refs: [f('cours-rip-configurer', 4, { titre: 'Propager' })] },
          { id: 'B6', texte: 'Vérifier : version, réseaux annoncés, voisins et routes R.', refs: [f('cours-rip-verifier', 1, { titre: 'protocole' }), f('cours-rip-verifier', 2, { titre: 'routes apprises' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe : à garder sous la main.' },
      { fiche: 'cisco-enregistrer-config', pourquoi: 'enregistrer la configuration quand le travail est validé.' },
    ],
    ambiguites: [
      { id: 'S03-1', sujet: 'Réseau annoncé par network', texte: 'RIP raisonne par réseau de classe : si tu écris un sous-réseau dans « network », IOS le convertit en réseau de classe. Compare avec ce que le cours montre dans « show ip protocols ».' },
    ],
  },
  // ===========================================================================
  {
    id: 'cisco-s05-vlan-vtp-dtp',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — Semaine 5 : évolutivité des VLAN (VTP et DTP)',
    resume: 'Distribuer les VLAN avec VTP (serveur, client, transparent), éviter le piège du numéro de révision, créer des VLAN étendus et négocier les trunks avec DTP.',
    source: 'Diapositive « Évolutivité des VLAN : DTP, VTP » fournie par l’étudiant, non republiée ici : les parcours et le résumé sont écrits dans nos mots. En cas de doute, le document d’origine fait foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_S05,
    parcours: [
      {
        lettre: 'A',
        titre: 'VTP : configurer le serveur et les clients',
        resume: 'Les cinq étapes du cours : état par défaut, mode et domaine, mot de passe, création des VLAN sur le serveur, vérification chez les clients, puis ports et VLAN étendus.',
        prerequis: [f('cisco-voir-trunks', null, { titre: 'Voir les trunks', pourquoi: 'VTP ne circule que sur des trunks.' })],
        items: [
          { id: 'A1', texte: 'Lire l’état VTP par défaut (mode, domaine, version, révision).', refs: [f('cours-vtp-reseau', 1, { titre: 'état de départ' })] },
          { id: 'A2', texte: 'Configurer le serveur : mode serveur, domaine, mot de passe.', refs: [f('cours-vtp-reseau', 2, { titre: 'mode et le domaine' }), f('cours-vtp-reseau', 3, { titre: 'mot de passe' })] },
          { id: 'A3', texte: 'Configurer les clients : mode client, même domaine, même mot de passe.', refs: [f('cours-vtp-reseau', 2, { titre: 'mode et le domaine' }), f('cours-vtp-reseau', 3, { titre: 'mot de passe' })] },
          { id: 'A4', texte: 'Créer et nommer les VLAN sur le serveur.', refs: [f('cours-vtp-reseau', 4, { titre: 'Créer les VLAN' }), f('cisco-creer-vlan')] },
          { id: 'A5', texte: 'Vérifier que les clients ont reçu les VLAN (révision et liste).', refs: [f('cours-vtp-reseau', 5, { titre: 'Vérifier' })] },
          { id: 'A6', texte: 'Affecter les ports aux VLAN sur chaque commutateur.', refs: [f('cisco-affecter-port-vlan')] },
          { id: 'A7', texte: 'Créer un VLAN étendu (mode transparent).', refs: [f('cours-vtp-transparent-etendus', 1, { titre: 'transparent' }), f('cours-vtp-transparent-etendus', 2, { titre: 'étendu' })] },
          { id: 'A8', texte: 'Éviter le piège : remettre à neuf un commutateur avant de l’ajouter.', refs: [], assistants: ['cisco-vtp-raccordement'], note: 'Liste de contrôle du catalogue : elle vérifie la révision et le domaine avant l’ajout.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'DTP : négocier les trunks',
        resume: 'Choisir le mode d’un port (auto, desirable, trunk, access), prévoir le résultat selon les deux bouts, couper la négociation et vérifier.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Lire le mode administratif et le mode réel d’un port.', refs: [f('cours-dtp-trunk', 1, { titre: 'Lire le mode' })] },
          { id: 'B2', texte: 'Choisir le mode du port : access, dynamic auto, dynamic desirable ou trunk.', refs: [f('cours-dtp-trunk', 2, { titre: 'Choisir' })] },
          { id: 'B3', texte: 'Prévoir si un trunk se forme selon les modes des deux bouts.', refs: [], assistants: ['cisco-dtp-simulation'], note: 'Simulation du catalogue : elle donne le résultat de chaque combinaison de modes ; le schéma du résumé donne la même matrice.' },
          { id: 'B4', texte: 'Couper la négociation sur un trunk fixe (nonegotiate).', refs: [f('cours-dtp-trunk', 3, { titre: 'Couper' })] },
          { id: 'B5', texte: 'Vérifier les trunks.', refs: [f('cours-dtp-trunk', 4, { titre: 'Contrôler' }), f('cisco-voir-trunks')] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Dépanner VTP et DTP',
        resume: 'Versions incompatibles, mots de passe différents, domaine mal écrit, pas de trunk, VLAN natif différent : lire dans l’ordre et comparer les deux bouts.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Lire l’état VTP et le comparer au serveur.', refs: [f('cours-vtp-dtp-depanner', 1, { titre: 'état VTP' })] },
          { id: 'C2', texte: 'Lire les trunks et le mode du port.', refs: [f('cours-vtp-dtp-depanner', 2, { titre: 'trunks' }), f('cours-vtp-dtp-depanner', 3, { titre: 'mode du port' })] },
          { id: 'C3', texte: 'Lire les VLAN et leurs ports.', refs: [f('cours-vtp-dtp-depanner', 4, { titre: 'VLAN' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe : à garder sous la main.' },
      { fiche: 'cisco-voir-vlans', pourquoi: 'lire la liste des VLAN et des ports.' },
    ],
    ambiguites: [
      { id: 'S05-1', sujet: 'VTP version 3 et TLV', texte: 'Le cours indique que VTP version 3 et les TLV ne sont pas vus : les fiches se limitent aux versions 1 et 2.' },
    ],
  },
  // ===========================================================================
  {
    id: 'cisco-tp2-routage-statique',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — TP2 : trois routeurs et routes statiques',
    resume: 'Reproduire un réseau de trois routeurs dans Packet Tracer : tableau d’adressage, configuration des PC, des commutateurs et des routeurs, routes statiques, tests, puis changement de route après retrait d’un lien.',
    source: 'Énoncé du TP2 (5 % de la session, deux périodes de laboratoire) fourni par l’étudiant, non republié ici : les parcours résument les demandes dans nos mots. Les incohérences de l’énoncé sont signalées plus bas ; en cas de doute, l’énoncé d’origine et l’enseignant font foi.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_TP2_CISCO,
    parcours: [
      {
        lettre: 'A',
        titre: 'Avant de commencer : le plan d’adressage',
        resume: 'Compléter le second tableau (périphériques, ports, adresses, masque, passerelle) à partir du premier, avec des adresses basses pour les postes et hautes pour les équipements.',
        points: 10,
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Calculer pour chaque réseau l’adresse du réseau, la première et la dernière adresse d’hôte, avec les masques /27 et /29.', refs: [], assistants: ['ipv4-subnet-calculator'], note: 'Calcul à la main ; le calculateur du Toolkit contrôle le résultat et le résumé donne les tableaux de masques.' },
          { id: 'A2', texte: 'Attribuer les adresses : basses aux postes, hautes aux commutateurs et aux routeurs.', refs: [], couvert: false, note: 'C’est un travail de tableau (on le remplit sur l’énoncé). Les commandes qui appliquent ces adresses sont dans la partie 1.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Partie 1 : configurer les périphériques et les routes',
        resume: 'Configurer les PC, les commutateurs (adresse de gestion et passerelle), les interfaces des routeurs, les routes statiques, les réglages communs, puis tester entre tous les appareils.',
        points: 70,
        prerequis: [f('cours-rt-interface-ip', 2, { titre: 'Poser l’adresse', pourquoi: 'les interfaces des routeurs avant les routes.' })],
        items: [
          { id: 'B1', texte: 'Configurer chaque PC : adresse, masque et passerelle.', refs: [], couvert: false, note: 'Se fait dans Packet Tracer, sur le PC, onglet Desktop puis IP Configuration : aucune commande IOS.' },
          { id: 'B2', texte: 'Adresse de l’interface VLAN de chaque commutateur et passerelle par défaut.', refs: [f('cours-sw-gestion-ip', 1, { titre: 'adresse' }), f('cours-sw-gestion-ip', 2, { titre: 'passerelle' })] },
          { id: 'B3', texte: 'Adresser les interfaces Gigabit et série des routeurs.', refs: [f('cours-rt-interface-ip', 2, { titre: 'Poser l’adresse' }), f('cours-rt-interface-ip', 3, { titre: 'DCE' })] },
          { id: 'B4', texte: 'Établir toutes les routes statiques nécessaires (combien par routeur ?).', refs: [f('cours-rt-statique', 1, { titre: 'réseaux déjà connus' }), f('cours-rt-statique', 2, { titre: 'Ajouter' })] },
          { id: 'B5', texte: 'Nom (hostname) et désactivation de la résolution de noms (no ip domain-lookup).', refs: [f('cours-base-peripherique', 1, { titre: 'Nommer' })] },
          { id: 'B6', texte: 'Mot de passe console, mot de passe du mode privilégié (enable secret).', refs: [f('cours-base-peripherique', 2, { titre: 'console' }), f('cours-base-peripherique', 3, { titre: 'Exiger' }), f('cours-base-peripherique', 4, { titre: 'privilégié' })] },
          { id: 'B7', texte: 'Chiffrement des mots de passe et bannière du jour.', refs: [f('cours-base-peripherique', 5, { titre: 'Chiffrer' }), f('cours-base-peripherique', 6, { titre: 'bannière' })] },
          { id: 'B8', texte: 'Vérifier que tous les appareils se joignent par ping.', refs: [f('cours-rt-tester', 1, { titre: 'Ping' }), f('cours-rt-tester', 2, { titre: 'Traceroute' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Partie 2 : retirer le lien R1–R3',
        resume: 'Retirer le lien entre R1 et R3, modifier les routes pour que A-163 et B-235 communiquent via R2, puis refaire les tests.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Modifier ou ajouter les routes pour passer par R2.', refs: [f('cours-rt-statique', 2, { titre: 'Ajouter' }), f('cours-rt-defaut-flottante', 3, { titre: 'secours' })] },
          { id: 'C2', texte: 'Refaire les tests de connectivité.', refs: [f('cours-rt-tester', 1, { titre: 'Ping' })] },
        ],
      },
      {
        lettre: 'D',
        titre: 'Partie 3 : montage physique',
        resume: 'Réaliser le montage avec du matériel réel.',
        points: 20,
        prerequis: [],
        items: [
          { id: 'D1', texte: 'Faire le montage physique du réseau.', refs: [], couvert: false, note: 'Câblage et matériel en laboratoire : aucune fiche de commandes ne le remplace ; la configuration se refait avec les fiches de la partie 1.' },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-show-cisco', pourquoi: 'toutes les commandes show utiles, rangées par groupe : à garder sous la main.' },
      { fiche: 'cisco-enregistrer-config', pourquoi: 'enregistrer la configuration de chaque équipement.' },
      { fiche: 'cours-config-portable', pourquoi: 'copier la configuration d’un routeur vers un autre.' },
    ],
    ambiguites: [
      { id: 'TP2-1', sujet: 'Adresse de PC2', texte: 'Le tableau note 192.158.5.66 : cette adresse n’est pas dans le réseau A-163 (192.168.5.64/27). C’est probablement une faute de frappe pour 192.168.5.66 ; confirme avec l’enseignant.' },
      { id: 'TP2-2', sujet: 'Adresse S0/0/0 de R1 et de R3', texte: 'Les deux interfaces portent 10.123.145.56, qui est l’adresse du RÉSEAU R1–R3 (/29) et la même sur les deux bouts. Il faut deux adresses d’hôte différentes, entre .57 et .62.' },
      { id: 'TP2-3', sujet: 'Lien R2–R3 absent du premier tableau', texte: 'R2 (S0/0/1, .73) et R3 (S0/0/1, .74) sont dans le second tableau, mais le réseau R2–R3 (10.123.145.72/29) n’est pas dans le premier : il faut le compléter, sinon il manque des routes.' },
      { id: 'TP2-4', sujet: 'Adresses « basses » des postes', texte: 'L’énoncé demande des adresses basses pour les postes ; certains postes (PC5, PC6) reçoivent .165 et .166 au lieu de .161 et .162. Les deux restent dans la plage : suis ton enseignant.' },
    ],
  },
];
