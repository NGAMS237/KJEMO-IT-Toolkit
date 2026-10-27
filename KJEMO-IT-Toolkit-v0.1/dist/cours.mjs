/**
 * cours.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Mes cours et TP » : des PARCOURS qui renvoient vers les fiches du
 * catalogue. Un parcours ne contient aucune commande : il dit quelle fiche, et
 * quelle ÉTAPE de cette fiche, répond à chaque demande d'un travail pratique.
 * Corriger une commande dans la fiche corrige donc tous les parcours.
 *
 * Les lettres et numéros du travail (A, B7, C5…) sont conservés comme ALIAS DE
 * RECHERCHE : taper « TP2 B7 » ou « b7 » retrouve la fiche. Ils ne sont pas des
 * identifiants de fiche.
 *
 * Ce module est PUR (aucun DOM, aucun stockage). Les énoncés sont résumés dans
 * nos propres mots : les documents d'origine ne sont pas republiés.
 *
 * Une entrée « couvert: false » dit CE QUI N'EST PAS COUVERT, plutôt que de le
 * taire.
 */

export const ROUTE_COURS = '#/cours';
export const ROUTE_LABO = '#/labo';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });

export const COURS = [
  {
    id: 'serveurs2-tp2',
    titre: 'Serveurs II — TP2 : comptes, stockage et partages Samba',
    resume: 'Un serveur Samba contrôleur de domaine : comptes créés par script depuis un CSV, disques et quotas, RAID 1, partages Samba pour des comptes et pour un groupe, clients Ubuntu et Windows.',
    source: 'Notes de cours et énoncé du TP2 fournis par l’étudiant (non republiés ici). Les parcours ci-dessous sont NOTRE lecture de l’énoncé : en cas de doute, c’est l’énoncé qui fait foi.',
    avertissement: 'Les fiches expliquent comment faire ; elles ne remplacent pas ton énoncé, ne produisent aucune capture et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ».',
    parcours: [
      {
        lettre: 'A',
        titre: 'Créer les comptes depuis un fichier CSV',
        points: 24,
        resume: 'Un script lit un fichier CSV et crée, sur le contrôleur de domaine, les comptes et les groupes de départements ; test de connexion depuis Windows.',
        prerequis: [
          f('cours-bash-boucles', 1, { pourquoi: 'while read et IFS, la base du script.' }),
          f('cours-samba-groupes', 1, { pourquoi: 'créer un groupe et y ajouter des membres avec samba-tool.' }),
        ],
        items: [
          { id: 'A1', texte: 'Écrire le fichier CSV des employés (login, département).', refs: [f('cours-samba-import-csv', 1)] },
          { id: 'A2', texte: 'Écrire le script qui lit le CSV et crée groupes, comptes et appartenances.', refs: [f('cours-samba-import-csv', 2), f('cours-samba-import-csv', 3)] },
          { id: 'A3', texte: 'Lancer le script en essai, puis pour de bon.', refs: [f('cours-samba-import-csv', 4), f('cours-samba-import-csv', 5)] },
          { id: 'A4', texte: 'Lister les comptes et les groupes créés (captures demandées).', refs: [f('cours-samba-import-csv', 6)] },
          { id: 'A5', texte: 'Tester une connexion depuis un poste Windows pour un compte de chaque département.', refs: [], couvert: false, note: 'Pas de fiche pour l’ouverture de session Windows avec un compte de domaine. Pour joindre le poste au domaine, voir l’assistant « Joindre un poste Windows à un domaine ».', assistants: ['windows-domain-join'] },
        ],
      },
      {
        lettre: 'B',
        titre: 'Disques, système de fichiers et quotas',
        points: 22,
        resume: 'Un disque de 1 Go : partition, ext4, étiquette, UUID, montage, fstab, quotas utilisateur, propriétaire du dossier.',
        prerequis: [
          f('cours-lire-fichiers', 1, { pourquoi: 'lire fstab et les sorties de commandes.' }),
        ],
        items: [
          { id: 'B1', texte: 'Ajouter un disque de 1 Go à la machine virtuelle.', refs: [], couvert: false, note: 'Ce geste se fait dans l’hyperviseur (VMware, VirtualBox, Proxmox…), pas dans le système invité : hors catalogue. Puis lis lsblk.' },
          { id: 'B2', texte: 'Retrouver le nom que le système a donné au nouveau disque.', refs: [f('cours-partition-formater-monter', 1)] },
          { id: 'B3', texte: 'Lancer fdisk sur ce disque.', refs: [f('cours-partition-formater-monter', 3)] },
          { id: 'B4', texte: 'Créer une partition primaire.', refs: [f('cours-partition-formater-monter', 3)] },
          { id: 'B5', texte: 'Forcer la relecture de la table de partitions.', refs: [f('cours-partition-formater-monter', 4)] },
          { id: 'B6', texte: 'Créer un système de fichiers ext4 dans la partition.', refs: [f('cours-partition-formater-monter', 5)] },
          { id: 'B7', texte: 'Donner une étiquette au système de fichiers.', refs: [f('cours-partition-formater-monter', 6)] },
          { id: 'B8', texte: 'Relever l’UUID du système de fichiers.', refs: [f('cours-partition-formater-monter', 7)] },
          { id: 'B9', texte: 'Créer le dossier qui servira de point de montage.', refs: [f('cours-partition-formater-monter', 8)] },
          { id: 'B10', texte: 'Monter la partition sur ce dossier.', refs: [f('cours-partition-formater-monter', 8)] },
          { id: 'B11', texte: 'Créer un premier fichier dans la partition montée.', refs: [f('cours-partition-formater-monter', 9)] },
          { id: 'B12', texte: 'Écrire la ligne de /etc/fstab qui monte la partition par son étiquette.', refs: [f('cours-partition-formater-monter', 10), f('cours-partition-formater-monter', 11)] },
          { id: 'B13', texte: 'Afficher l’occupation des systèmes de fichiers, lisiblement.', refs: [f('cours-partition-formater-monter', 12)] },
          { id: 'B14', texte: 'Activer l’option de quotas utilisateur dans fstab et remonter.', refs: [f('cours-quotas-utilisateur', 3), f('cours-quotas-utilisateur', 4)] },
          { id: 'B15', texte: 'Créer et activer les quotas sur la partition.', refs: [f('cours-quotas-utilisateur', 5), f('cours-quotas-utilisateur', 6)] },
          { id: 'B16', texte: 'Fixer une limite souple de 260 Mo à un compte, limite stricte = souple + 10 Ko.', refs: [f('cours-quotas-utilisateur', 7)], note: 'Unités à trancher : voir l’ambiguïté sur « Mo ».' },
          { id: 'B17', texte: 'Donner le dossier monté à un compte et à un groupe.', refs: [f('cours-donner-dossier-compte', 3)] },
          { id: 'B18', texte: 'Se connecter avec ce compte et y créer un dossier et un fichier.', refs: [f('cours-donner-dossier-compte', 4), f('cours-creer-dossiers-fichiers', 1)] },
        ],
      },
      {
        lettre: 'C',
        titre: 'RAID 1 : création, panne, remplacement, disque de secours',
        points: 14,
        resume: 'Un miroir de deux disques de 1 Go, formaté, rempli de fichiers ; une panne simulée, le remplacement du disque, puis un disque de secours.',
        prerequis: [
          f('cours-creer-dossiers-fichiers', 1, { pourquoi: 'créer les fichiers de test dans le RAID.' }),
        ],
        items: [
          { id: 'C1', texte: 'Créer le RAID 1 avec deux nouveaux disques.', refs: [f('cours-raid1-creer', 4)] },
          { id: 'C2', texte: 'Donner l’état du RAID.', refs: [f('cours-raid1-creer', 5)] },
          { id: 'C3', texte: 'Formater le RAID.', refs: [f('cours-raid1-creer', 6)] },
          { id: 'C4', texte: 'Créer trois fichiers texte dans le RAID.', refs: [f('cours-raid1-creer', 7), f('cours-creer-dossiers-fichiers', 3)] },
          { id: 'C5', texte: 'Simuler la panne d’un des disques.', refs: [f('cours-raid1-panne-secours', 2)] },
          { id: 'C6', texte: 'Donner l’état du RAID après la panne.', refs: [f('cours-raid1-panne-secours', 3)] },
          { id: 'C7', texte: 'Remplacer le disque en panne.', refs: [f('cours-raid1-panne-secours', 4), f('cours-raid1-panne-secours', 6), f('cours-raid1-panne-secours', 7)] },
          { id: 'C8', texte: 'Ajouter un disque de secours et suivre toutes les étapes de la section correspondante du formatif.', refs: [f('cours-raid1-panne-secours', 8), f('cours-raid1-panne-secours', 9)], note: 'Le formatif crée parfois le RAID AVEC le disque de secours ; la fiche l’ajoute après coup.' },
        ],
      },
      {
        lettre: 'D',
        titre: 'Partage Samba : un compte écrit, un compte lit',
        points: 20,
        resume: 'Un dossier partagé dans le RAID, deux comptes aux droits différents, test de configuration, accès depuis Ubuntu et Windows 11, puis smbclient.',
        prerequis: [
          f('cours-samba-groupes', 2, { pourquoi: 'comprendre comptes et groupes du domaine avant d’en créer.' }),
          f('cours-droits-dossier-partage', 2, { pourquoi: 'distinguer le réglage de laboratoire (777) du réglage professionnel.' }),
        ],
        items: [
          { id: 'D1', texte: 'Créer, dans le RAID, le dossier à partager avec les droits demandés.', refs: [f('cours-samba-partage-utilisateurs', 1), f('cours-samba-partage-utilisateurs', 4)], note: 'L’énoncé demande 777 : c’est un réglage de LABORATOIRE (étape facultative de la fiche) ; le réglage professionnel est à côté.' },
          { id: 'D2', texte: 'Déclarer le partage dans smb.conf : visible, avec description, un compte en écriture, un compte en lecture.', refs: [f('cours-samba-partage-utilisateurs', 2), f('cours-samba-partage-utilisateurs', 6)] },
          { id: 'D3', texte: 'Tester les paramètres avec testparm.', refs: [f('cours-samba-partage-utilisateurs', 7)] },
          { id: 'D4', texte: 'Configurer la carte réseau du client Ubuntu pour atteindre le serveur.', refs: [f('cours-ubuntu-jonction-ad', 2)], assistants: ['netplan-readiness'], note: 'Le réglage DNS par netplan est dans la fiche de jonction ; l’assistant Netplan prépare une configuration complète.' },
          { id: 'D5', texte: 'Montrer, depuis Ubuntu, que le compte en écriture peut écrire.', refs: [f('cours-smbclient-transferts', 3)] },
          { id: 'D6', texte: 'Montrer que le compte en lecture ne peut pas écrire mais peut lire.', refs: [f('cours-smbclient-transferts', 3)] },
          { id: 'D7', texte: 'Refaire D5 et D6 depuis un client Windows 11.', refs: [], couvert: false, note: 'Pas de fiche pour l’accès graphique à un partage depuis Windows (\\\\serveur\\partage). À faire dans l’explorateur de fichiers.' },
          { id: 'D8.1', texte: 'Avec smbclient, télécharger deux fichiers du partage vers le client.', refs: [f('cours-smbclient-transferts', 3), f('cours-smbclient-transferts', 4)], note: 'L’énoncé cite deux fois le même nom de fichier : lu comme deux fichiers distincts.' },
          { id: 'D8.2', texte: 'Avec smbclient, déposer deux fichiers créés sur le client dans le partage.', refs: [f('cours-smbclient-transferts', 2), f('cours-smbclient-transferts', 3)] },
        ],
      },
      {
        lettre: 'E',
        titre: 'Partage d’un dossier par groupe Samba',
        points: 12,
        resume: 'Un dossier pour le groupe d’un département : droits 770, déclaration dans smb.conf, lecture et écriture pour tous sauf un compte en lecture seule, test d’écriture.',
        prerequis: [
          f('cours-samba-groupes', 2, { pourquoi: 'créer le groupe et lire son gid.' }),
          f('cours-samba-import-csv', 1, { pourquoi: 'les comptes du département viennent du CSV de la partie A.' }),
        ],
        items: [
          { id: 'E1', texte: 'Créer le dossier partagé du groupe.', refs: [f('cours-samba-partage-groupe', 1)] },
          { id: 'E2', texte: 'Donner le dossier au groupe et mettre ses droits en 770.', refs: [f('cours-samba-partage-groupe', 2), f('cours-samba-partage-groupe', 3), f('cours-samba-partage-groupe', 4)] },
          { id: 'E3', texte: 'Déclarer le partage dans smb.conf (groupe en lecture et écriture, un compte en lecture seule).', refs: [f('cours-samba-partage-groupe', 6)], note: 'Un compte présent à la fois dans read list et write list reçoit l’écriture : la fiche utilise deux groupes.' },
          { id: 'E4', texte: 'Tester, avec le compte en lecture seule, qu’il ne peut pas écrire.', refs: [f('cours-samba-partage-groupe', 7), f('cours-samba-partage-groupe', 8), f('cours-smbclient-transferts', 3)] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-ubuntu-jonction-ad', pourquoi: 'Joindre un poste Ubuntu au domaine (realmd, SSSD, PAM).' },
      { fiche: 'cours-samba-dns', pourquoi: 'Enregistrements A, zone inverse et PTR dans le DNS de Samba.' },
      { fiche: 'cours-rsat-windows', pourquoi: 'Installer les consoles AD et DNS sur un poste Windows.' },
      { fiche: 'cours-bash-condition', pourquoi: 'if et case pour écrire un script.' },
      { fiche: 'cours-bash-fonctions', pourquoi: 'Fonctions et arguments d’un script.' },
      { fiche: 'cours-se-reperer', pourquoi: 'pwd, ls, cd : les bases du terminal.' },
      { fiche: 'cours-grep-wc', pourquoi: 'Chercher dans un fichier de configuration.' },
      { fiche: 'cours-liens', pourquoi: 'Liens durs et symboliques.' },
    ],
    ambiguites: [
      { id: 'amb-mo', sujet: 'B16 — « 260 Mo »', texte: 'Mo = 1 000 000 octets, ou Mio = 1 048 576 ? En blocs de 1 Kio, 260 Mio = 266 240 ; 260 Mo = environ 253 906. La fiche propose 266240 / 266250 (Mio, souple + 10 Kio). Demande à ton enseignant l’unité attendue.' },
      { id: 'amb-fichiers', sujet: 'D8.1 — deux fichiers du même nom', texte: 'L’énoncé écrit deux fois « fichier1tp2 ». Lu comme fichier1tp2 et fichier2tp2. Deux noms identiques ne transfèrent qu’un fichier.' },
      { id: 'amb-777', sujet: 'D1 — permissions 777', texte: '777 donne tous les droits à tout le monde au niveau Unix : seul Samba filtre. Acceptable pour un laboratoire isolé, jamais en production. Les fiches séparent les deux réglages.' },
      { id: 'amb-service', sujet: 'D — redémarrer Samba', texte: 'Les notes disent « systemctl restart smbd ». Sur un CONTRÔLEUR DE DOMAINE, le service s’appelle samba-ad-dc (smbd est masqué). Les fiches utilisent smbcontrol reload-config, valable des deux côtés.' },
      { id: 'amb-comptes', sujet: 'D2 — « utilisateurs Samba »', texte: 'Sur un contrôleur de domaine, les comptes se créent avec samba-tool (smbpasswd concerne un serveur de fichiers autonome). Les fiches suivent samba-tool.' },
      { id: 'amb-readwrite', sujet: 'E — réceptionniste en lecture seule', texte: 'Un compte présent dans read list ET write list reçoit l’écriture (manuel de smb.conf). Avec un groupe d’écriture distinct, le compte en lecture seule reste sans écriture.' },
      { id: 'amb-quota-ad', sujet: 'B16–B17 — compte du domaine comme propriétaire', texte: 'chown et les quotas ne fonctionnent que si le système sait résoudre le compte (winbind ou SSSD). Vérifie avec getent passwd avant ; sinon utilise un compte local.' },
      { id: 'amb-run', sujet: 'C — arrêt et relance du RAID', texte: 'Les notes relancent avec --run après --stop. Après un arrêt, la matrice n’existe plus : on la ré-assemble avec --assemble --scan. Son nom peut alors changer (md127).' },
      { id: 'amb-hdc', sujet: 'C7 — « /dev/hdc »', texte: 'L’exemple de remplacement des notes cite un disque IDE ancien (hdc). Utilise le nom réel de TON disque, lu avec lsblk : il n’est jamais présumé.' },
      { id: 'amb-quotacheck', sujet: 'B15 — quotacheck', texte: 'Les notes écrivent « quotacheck -c ». La fiche écrit « -cu » (quotas utilisateur explicitement). Sur un noyau allégé, la prise en charge des quotas peut demander un paquet de modules supplémentaires.' },
      { id: 'amb-ref', sujet: 'E — nom du document de référence', texte: 'L’énoncé renvoie à « S06-Exemple de partage… » alors que le fichier fourni s’appelle « S05-Exemple de partage… » : même document, numéro différent.' },
    ],
  },
];

export const COURS_PAR_ID = new Map(COURS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Alias de recherche
// ---------------------------------------------------------------------------

function variantes(coursCle, item) {
  // « B7 » → « tp2 b7 », « b7 », « b 7 ». Les lettres seules ne sont pas indexées (trop vagues).
  const code = item.id.toLowerCase();
  const sans = code.replace(/\./g, ' ');
  return [`${coursCle} ${sans}`, sans, `${coursCle} ${sans.replace(/^([a-z])(\d)/, '$1 $2')}`];
}

const CLE_COURS = { 'serveurs2-tp2': 'tp2' };

const ALIAS = (() => {
  const m = new Map();
  for (const c of COURS) {
    const cle = CLE_COURS[c.id] ?? c.id;
    for (const p of c.parcours) {
      for (const it of p.items) {
        for (const r of it.refs) {
          const liste = m.get(r.fiche) ?? new Set();
          variantes(cle, it).forEach((v) => liste.add(v));
          liste.add(`${cle} ${p.lettre.toLowerCase()} ${p.titre.toLowerCase()}`);
          m.set(r.fiche, liste);
        }
      }
    }
  }
  return m;
})();

/** Alias de recherche d'une fiche (lettres et numéros du travail). */
export function aliasesDe(ficheId) {
  return [...(ALIAS.get(ficheId) ?? [])];
}

// ---------------------------------------------------------------------------
// Liens
// ---------------------------------------------------------------------------

/** #/tache/<id>[/etape/<n>[/depuis/<cours>/<lettre>]] */
export function lienEtape(ref, { coursId = null, lettre = null } = {}) {
  let h = `#/tache/${ref.fiche}`;
  if (ref.etape) h += `/etape/${ref.etape}`;
  if (ref.etape && coursId && lettre) h += `/depuis/${coursId}/${lettre}`;
  return h;
}

/** Décode la partie après #/tache/ : { id, etape, coursId, lettre } ou null. */
export function lireRouteTache(hash) {
  const m = /^#\/tache\/([A-Za-z0-9_-]+)(?:\/etape\/(\d{1,3})(?:\/depuis\/([A-Za-z0-9_-]+)\/([A-Z]))?)?$/.exec(hash || '');
  if (!m) return null;
  return { id: m[1], etape: m[2] ? Number(m[2]) : null, coursId: m[3] ?? null, lettre: m[4] ?? null };
}

export function routeParcours(coursId, lettre = null) {
  return lettre ? `${ROUTE_COURS}/${coursId}/${lettre}` : (coursId ? `${ROUTE_COURS}/${coursId}` : ROUTE_COURS);
}

export function lireRouteCours(hash) {
  const m = /^#\/cours(?:\/([A-Za-z0-9_-]+)(?:\/([A-Z]))?)?$/.exec(hash || '');
  if (!m) return null;
  return { coursId: m[1] ?? null, lettre: m[2] ?? null };
}

// ---------------------------------------------------------------------------
// Contrat d'un cours — vérifié par le banc, jamais au chargement
// ---------------------------------------------------------------------------

/**
 * Anomalies d'un cours (liste vide = conforme).
 * `fiches` : (id) → { etapes: n } | null ; `assistants` : (id) → bool.
 */
export function incoherencesCours(cours, { fiches, assistants = () => true }) {
  const pb = [];
  const txt = (v) => (typeof v === 'string' ? v.trim() : '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(txt(cours.id))) pb.push('cours : id mal formé');
  if (txt(cours.titre).length < 8) pb.push('cours : titre trop court');
  if (txt(cours.source).length < 20) pb.push('cours : source absente (d’où viennent les parcours ?)');
  if (txt(cours.avertissement).length < 20) pb.push('cours : avertissement absent');
  if (!cours.parcours?.length) pb.push('cours : aucun parcours');
  const lettres = new Set(); const items = new Set();
  const verifierRef = (r, ou) => {
    const fiche = fiches(r.fiche);
    if (!fiche) { pb.push(`${ou} : fiche inconnue « ${r.fiche} »`); return; }
    if (r.etape !== null && r.etape !== undefined && (!Number.isInteger(r.etape) || r.etape < 1 || r.etape > fiche.etapes)) {
      pb.push(`${ou} : étape ${r.etape} absente de ${r.fiche} (${fiche.etapes} étape(s))`);
    }
  };
  for (const p of cours.parcours ?? []) {
    if (!/^[A-Z]$/.test(p.lettre ?? '')) pb.push(`parcours « ${p.titre} » : lettre invalide`);
    if (lettres.has(p.lettre)) pb.push(`parcours ${p.lettre} en double`);
    lettres.add(p.lettre);
    if (txt(p.titre).length < 6) pb.push(`parcours ${p.lettre} : titre trop court`);
    if (txt(p.resume).length < 20) pb.push(`parcours ${p.lettre} : résumé absent`);
    if (!p.items?.length) pb.push(`parcours ${p.lettre} : aucun élément`);
    for (const r of p.prerequis ?? []) verifierRef(r, `parcours ${p.lettre} (prérequis)`);
    for (const it of p.items ?? []) {
      const ou = `élément ${it.id}`;
      if (!new RegExp(`^${p.lettre}\\d{1,2}(\\.\\d)?$`).test(it.id ?? '')) pb.push(`${ou} : l’identifiant doit commencer par la lettre du parcours ${p.lettre}`);
      if (items.has(it.id)) pb.push(`${ou} en double`);
      items.add(it.id);
      if (txt(it.texte).length < 12) pb.push(`${ou} : texte absent`);
      const couvert = it.couvert !== false;
      if (couvert && !it.refs?.length) pb.push(`${ou} : couvert mais sans fiche (mettre couvert:false et dire pourquoi)`);
      if (!couvert) {
        if (it.refs?.length) pb.push(`${ou} : marqué non couvert mais cite une fiche`);
        if (txt(it.note).length < 20) pb.push(`${ou} : non couvert sans explication`);
      }
      for (const r of it.refs ?? []) verifierRef(r, ou);
      for (const a of it.assistants ?? []) if (!assistants(a)) pb.push(`${ou} : assistant inconnu « ${a} »`);
    }
  }
  for (const s of cours.soutien ?? []) verifierRef({ fiche: s.fiche, etape: null }, 'soutien');
  const amb = new Set();
  for (const a of cours.ambiguites ?? []) {
    if (amb.has(a.id)) pb.push(`ambiguïté ${a.id} en double`);
    amb.add(a.id);
    if (txt(a.texte).length < 30 || txt(a.sujet).length < 6) pb.push(`ambiguïté ${a.id} : sujet ou texte trop court`);
  }
  return pb;
}

// ---------------------------------------------------------------------------
// Gabarit pour un prochain TP
// ---------------------------------------------------------------------------

/**
 * Squelette à copier pour un autre travail pratique. Il suit EXACTEMENT le
 * contrat d'incoherencesCours : mêmes champs, mêmes règles. Aucune valeur
 * réelle : tout est à remplacer.
 */
export const GABARIT_TP = {
  id: 'cours-tp-exemple',
  titre: 'Nom du cours — TPn : titre du travail',
  resume: 'Une phrase sur ce que le travail demande.',
  source: 'D’où viennent ces parcours (notes, énoncé) — non republié ici.',
  avertissement: 'Les fiches expliquent comment faire ; elles ne prouvent rien et ne remplacent pas l’énoncé.',
  parcours: [{
    lettre: 'A',
    titre: 'Première partie du travail',
    points: 0,
    resume: 'Ce que cette partie demande, en une ou deux phrases.',
    prerequis: [{ fiche: 'id-d-une-fiche-du-catalogue', etape: 1, pourquoi: 'pourquoi la lire d’abord' }],
    items: [
      { id: 'A1', texte: 'Ce que la première demande exige, dans tes mots.', refs: [{ fiche: 'id-d-une-fiche-du-catalogue', etape: 1 }] },
      { id: 'A2', texte: 'Une demande que le catalogue ne couvre pas.', refs: [], couvert: false, note: 'Dire PRÉCISÉMENT ce qui manque et où le faire.' },
    ],
  }],
  soutien: [],
  ambiguites: [],
};
