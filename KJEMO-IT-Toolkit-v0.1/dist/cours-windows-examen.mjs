/**
 * cours-windows-examen.mjs — KJEMO-EXAMEN-WS-02 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Examen Serveur I » (Windows Server 2022) rangé dans « Mes cours et TP » :
 * un parcours par question (Q1 à Q6) qui renvoie vers les fiches déjà écrites
 * (EXAMEN-WS-01). Aucune commande ici : tout est dans les fiches. Les
 * documents de l'examen ne sont pas republiés ; le résumé est dans nos mots.
 */
const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });

const AVERTISSEMENT = 'Les fiches sont écrites d’après l’aide-mémoire et l’énoncé fournis par l’étudiant ; elles n’ont pas été exécutées sur un vrai Windows Server 2022. Les valeurs (noms, tailles, adresses, heures) sont des exemples : reprends celles de TON énoncé. Le Toolkit n’exécute rien et « coché » veut seulement dire « je l’ai fait » ; l’énoncé et ton enseignant font foi.';
const SOURCE = 'Aide-mémoire et énoncé de l’examen pratique Serveur I fournis par l’étudiant, non republiés ici : parcours et fiches sont écrits dans nos mots. En cas de doute, ton énoncé fait foi.';

export const COURS_WINDOWS_EXAMEN = [
  {
    id: 'examen-serveur-1-windows-2022',
    plateformes: ['Windows'],
    titre: 'Examen Serveur I — Windows Server 2022 (6 questions)',
    resume: 'Le plan de l’examen pratique, question par question : utilisateurs et groupes, disque et quota, sauvegarde planifiée, miroir RAID 1, serveur DHCP avec exclusion, puis le script PowerShell. Chaque question renvoie à ses fiches (option graphique et PowerShell), avec la vérification et l’annulation.',
    source: SOURCE,
    avertissement: AVERTISSEMENT,
    parcours: [
      {
        lettre: 'A',
        titre: 'Q1 — Utilisateurs et groupes',
        resume: 'Créer les groupes, créer les deux utilisateurs, puis mettre chaque utilisateur dans son groupe, et vérifier les membres.',
        prerequis: [],
        items: [
          { id: 'A1', texte: 'Lire les verbes de la consigne avant de commencer (créer, ajouter, planifier, restaurer).', refs: [f('win-examen-parcours', 1, { titre: 'Lire les verbes' })] },
          { id: 'A2', texte: 'Créer les groupes demandés dans l’annuaire.', refs: [f('win-ad-creer-groupe', 1, { titre: 'Créer le groupe' })] },
          { id: 'A3', texte: 'Créer chaque utilisateur (nom, mot de passe, OU).', refs: [f('win-ad-creer-utilisateur', 2, { titre: 'Créer le compte' })] },
          { id: 'A4', texte: 'Ajouter chaque utilisateur à son groupe, puis vérifier les membres.', refs: [f('win-ad-ajouter-membre', 1, { titre: 'Ajouter le compte' }), f('win-ad-ajouter-membre', 2, { titre: 'Vérifier les membres' })] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Q2 — Disque de 2 Go, dossier et quota',
        resume: 'Ajouter un disque, l’initialiser et le formater, créer le dossier demandé, puis y mettre un quota (rôle FSRM). Le quota se pose sur le dossier, pas sur le disque.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Ajouter le disque virtuel puis l’initialiser et le formater (option graphique : Gestion des disques).', refs: [f('win-disque-ajouter', 3, { titre: 'Initialiser le disque', methode: 'gui' }), f('win-disque-ajouter', 4, { titre: 'Créer le volume', methode: 'gui' })] },
          { id: 'B2', texte: 'Faire la même chose en PowerShell : initialiser, partitionner, formater en NTFS.', refs: [f('win-disque-ajouter', 3, { titre: 'Initialiser le disque', methode: 'powershell' }), f('win-disque-ajouter', 5, { titre: 'Formater en NTFS', methode: 'powershell' })] },
          { id: 'B3', texte: 'Installer le rôle FSRM et créer le dossier à limiter.', refs: [f('win-quota-fsrm', 2, { titre: 'Installer FSRM', methode: 'powershell' }), f('win-quota-fsrm', 3, { titre: 'Créer le dossier', methode: 'powershell' })] },
          { id: 'B4', texte: 'Appliquer le quota strict sur le dossier, puis le vérifier.', refs: [f('win-quota-fsrm', 4, { titre: 'quota STRICT', methode: 'powershell' }), f('win-quota-fsrm', 6, { titre: 'Vérifier le quota', methode: 'powershell' })] },
          { id: 'B5', texte: 'Option graphique du quota : console FSRM, créer le quota sur le dossier.', refs: [f('win-quota-fsrm', 4, { titre: 'Créer le quota', methode: 'gui' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Q3 — Sauvegarde planifiée (13 h et 16 h)',
        resume: 'Installer Sauvegarde Windows Server, planifier la sauvegarde du disque aux heures demandées vers un autre disque, en mode incrémentiel, et savoir restaurer un fichier.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Installer la fonctionnalité de sauvegarde.', refs: [f('win-sauvegarde-planifier', 2, { titre: 'Installer', methode: 'powershell' })] },
          { id: 'C2', texte: 'Créer la planification (volume source, heures, disque de destination) en PowerShell.', refs: [f('win-sauvegarde-planifier', 4, { titre: 'Créer et enregistrer', methode: 'powershell' })] },
          { id: 'C3', texte: 'Option graphique : l’assistant de planification, choix des heures et du mode incrémentiel.', refs: [f('win-sauvegarde-planifier', 4, { titre: 'Choisir les heures', methode: 'gui' }), f('win-sauvegarde-planifier', 6, { titre: 'incrémentiel', methode: 'gui' })] },
          { id: 'C4', texte: 'Vérifier la planification, lancer une première sauvegarde et lister les versions.', refs: [f('win-sauvegarde-planifier', 6, { titre: 'Vérifier la planification', methode: 'powershell' }), f('win-sauvegarde-planifier', 8, { titre: 'Voir les sauvegardes', methode: 'powershell' })] },
        ],
      },
      {
        lettre: 'D',
        titre: 'Q4 — Miroir RAID 1, panne et restauration',
        resume: 'Créer un miroir sur deux disques, y ajouter un fichier, simuler la panne en retirant un disque, ajouter un disque neuf et reconstruire.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'Créer le miroir (option graphique : Gestion des disques, Ajouter un miroir).', refs: [f('win-miroir-raid1', 2, { titre: 'Ajouter un miroir', methode: 'gui' })] },
          { id: 'D2', texte: 'Créer le miroir en ligne de commande (script diskpart) et ajouter un fichier d’essai.', refs: [f('win-miroir-raid1', 3, { titre: 'Lancer la création', methode: 'powershell' }), f('win-miroir-raid1', 4, { titre: 'Ajouter un fichier', methode: 'powershell' })] },
          { id: 'D3', texte: 'Simuler la panne en retirant un disque dans l’hyperviseur, puis vérifier l’état du miroir.', refs: [f('win-miroir-raid1', 6, { titre: 'Simuler la panne', methode: 'powershell' })] },
          { id: 'D4', texte: 'Ajouter le disque de remplacement et reconstruire le miroir.', refs: [f('win-miroir-raid1', 7, { titre: 'Ajouter le disque', methode: 'powershell' }), f('win-miroir-raid1', 8, { titre: 'Reconstruire', methode: 'powershell' })] },
          { id: 'D5', texte: 'Vérifier la restauration (le fichier est toujours là).', refs: [f('win-miroir-raid1', 9, { titre: 'Vérifier la restauration', methode: 'powershell' })] },
        ],
      },
      {
        lettre: 'E',
        titre: 'Q5 — Serveur DHCP et exclusion de 50 adresses',
        resume: 'Donner l’adresse fixe au serveur (192.168.50.1 dans l’énoncé), installer et autoriser DHCP, créer l’étendue puis exclure la plage demandée.',
        prerequis: [],
        items: [
          { id: 'E1', texte: 'Donner l’adresse IP fixe au serveur.', refs: [f('windows-ip-fixe', 3, { titre: 'adresse', methode: 'powershell' })] },
          { id: 'E2', texte: 'Installer le rôle DHCP et l’autoriser dans l’annuaire.', refs: [f('win-dhcp-installer', 1, { titre: 'Installer le rôle DHCP' }), f('win-dhcp-installer', 2, { titre: 'Autoriser' })] },
          { id: 'E3', texte: 'Créer l’étendue et ses options.', refs: [f('win-dhcp-etendue', 1, { titre: 'Créer l’étendue' })] },
          { id: 'E4', texte: 'Exclure la plage d’adresses demandée, puis vérifier (option graphique : console DHCP).', refs: [f('win-dhcp-exclusion', 2, { titre: 'Ajouter la plage', methode: 'powershell' }), f('win-dhcp-exclusion', 2, { titre: 'Ajouter la plage', methode: 'gui' })] },
        ],
      },
      {
        lettre: 'F',
        titre: 'Q6 — Script PowerShell : utilisateur, dossier, partage',
        resume: 'Écrire le script en six blocs (saisie, compte, groupe, dossier, droits, partage en lecture), le lancer avec des valeurs de test, puis vérifier chaque résultat.',
        prerequis: [],
        items: [
          { id: 'F1', texte: 'Lire l’énoncé et découper le script en six blocs.', refs: [f('win-script-utilisateur-partage', 2, { titre: 'Lire l’énoncé', methode: 'powershell' })] },
          { id: 'F2', texte: 'Écrire le script dans un fichier et le lancer avec des valeurs de test.', refs: [f('win-script-utilisateur-partage', 3, { titre: 'Écrire le script', methode: 'powershell' }), f('win-script-utilisateur-partage', 4, { titre: 'Lancer le script', methode: 'powershell' })] },
          { id: 'F3', texte: 'Vérifier utilisateur, groupe, dossier et partage.', refs: [f('win-script-utilisateur-partage', 5, { titre: 'Vérifier', methode: 'powershell' })] },
          { id: 'F4', texte: 'Faire la même chose sans script, avec les outils graphiques.', refs: [f('win-script-utilisateur-partage', 1, { titre: 'Créer l’utilisateur', methode: 'gui' }), f('win-script-utilisateur-partage', 3, { titre: 'partager en lecture', methode: 'gui' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'win-examen-parcours', pourquoi: 'le plan complet des 6 questions, à relire en début d’examen.' },
    ],
    ambiguites: [
      { id: 'EX-1', sujet: 'Valeurs de l’énoncé', texte: 'Les noms, tailles (2 Go, 200 Mo), heures (13 h et 16 h) et adresses des fiches viennent de l’énoncé fourni ; si ton énoncé en donne d’autres, remplace-les dans les paramètres de la fiche.' },
      { id: 'EX-2', sujet: 'Syntaxes à confirmer', texte: 'Les commandes diskpart du miroir et le mode incrémentiel de la sauvegarde en PowerShell sont signalés comme non confirmés dans les fiches : l’option graphique reste la référence si une commande est refusée.' },
    ],
  },
];
