/**
 * journal.mjs — JOURNAL-LABO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * « Journal de labo » : la documentation de tes labos et projets (Cisco,
 * système, Azure, autre), au format d'un dossier d'entreprise : référence,
 * version, état, classification, historique des révisions, puis objet,
 * environnement, architecture, adressage, configuration, validation,
 * exploitation, incidents et références.
 *
 * RÈGLES
 *  1. AUCUN secret. Aucun champ ne s'appelle « mot de passe » ; tout texte qui
 *     ressemble à un mot de passe écrit (« secret Cisco123 », « password=… »,
 *     « mot de passe : … ») est REFUSÉ à l'enregistrement, avec la ligne fautive.
 *     Le document dit seulement OÙ le mot de passe est rangé.
 *  2. Rien ne part du navigateur : le stockage, l'export PDF et la sauvegarde
 *     se font sur l'ordinateur.
 *  3. Une ligne « Conforme » n'est pas une preuve : c'est toi qui l'écris.
 *
 * Module PUR : le stockage, le DOM et le téléchargement vivent dans app.js.
 */

import { normaliserSchema, schemaVide } from './schema.mjs';

export const CLE_JOURNAL = 'kjemo.journal.v1';
export const FORMAT_SAUVEGARDE = 'kjemo-journal-de-labo';
export const MAX_CAPTURES = 24;
export const JOURS_A_REVOIR = 60;

export const CATEGORIES_JOURNAL = [
  { id: 'cisco', code: 'RES', label: 'Réseau Cisco' },
  { id: 'systeme', code: 'SYS', label: 'Système (Linux, Windows)' },
  { id: 'azure', code: 'AZ', label: 'Azure' },
  { id: 'autre', code: 'GEN', label: 'Autre projet' },
];
export const ETATS_JOURNAL = [
  { id: 'brouillon', label: 'Brouillon', symbole: '…' },
  { id: 'service', label: 'En service', symbole: '✔' },
  { id: 'archive', label: 'Archivé', symbole: '■' },
];
export const CLASSIFICATIONS = ['Interne', 'Public', 'Confidentiel'];
export const RESULTATS = [
  { id: 'a-tester', label: 'À tester', symbole: '…' },
  { id: 'conforme', label: 'Conforme', symbole: '✔' },
  { id: 'non-conforme', label: 'Non conforme', symbole: '✖' },
];

/** Colonnes des tableaux du document (identifiants stables : ils sont dans les sauvegardes). */
export const TABLEAUX = {
  adressage: [
    { id: 'equipement', label: 'Équipement' }, { id: 'interface', label: 'Interface' }, { id: 'adresse', label: 'Adresse / préfixe' },
    { id: 'vlan', label: 'VLAN / zone' }, { id: 'passerelle', label: 'Passerelle' }, { id: 'note', label: 'Note' },
  ],
  configuration: [{ id: 'titre', label: 'Titre du bloc' }, { id: 'code', label: 'Commandes' }],
  validation: [{ id: 'test', label: 'Test' }, { id: 'attendu', label: 'Résultat attendu' }, { id: 'resultat', label: 'Résultat' }],
  incidents: [{ id: 'symptome', label: 'Symptôme' }, { id: 'cause', label: 'Cause' }, { id: 'solution', label: 'Solution' }],
};

/** Champs texte simples, dans l'ordre du formulaire. `long` = zone de texte. */
export const CHAMPS_TEXTE = [
  { id: 'objet', label: 'Objet : à quoi sert ce labo ou ce projet ?', long: true, max: 2000 },
  { id: 'environnement', label: 'Environnement (équipements, logiciels, versions)', long: true, max: 2000 },
  { id: 'architecture', label: 'Architecture : description en quelques phrases', long: true, max: 4000 },
  { id: 'acces', label: 'Accès : comment se connecter (sans mot de passe)', long: true, max: 2000 },
  { id: 'rangement', label: 'Où sont rangés les identifiants', long: false, max: 300, aide: 'Ex. : « gestionnaire de mots de passe, entrée SW1 ». Jamais le mot de passe lui-même.' },
  { id: 'sauvegarde', label: 'Sauvegarde de la configuration', long: true, max: 2000 },
  { id: 'retourArriere', label: 'Retour arrière : comment défaire', long: true, max: 2000 },
  { id: 'referencesTexte', label: 'Autres références (documents, liens)', long: true, max: 2000 },
];

/**
 * Exemples affichés dans les champs vides (indications, jamais enregistrées),
 * adaptés à la catégorie du labo. Les colonnes des tableaux ont les leurs.
 */
export const EXEMPLES_CHAMPS = {
  cisco: {
    titre: 'TP VLAN, SSH et routage inter-VLAN',
    objet: 'Séparer la gestion et les ventes sur un commutateur, administrer le commutateur par SSH et router entre les VLAN avec un routeur sur un bâton.',
    environnement: 'Packet Tracer 8.2 (ou matériel du labo B-204) : commutateur Catalyst 2960, routeur ISR 4321, deux postes Windows 11.',
    architecture: 'SW1 relie le poste de gestion (VLAN 99) et le poste des ventes (VLAN 10). Un trunk 802.1Q (Gi0/1) le relie à R1, qui porte une sous-interface par VLAN et sert de passerelle.',
    acces: 'Console du commutateur, puis ssh admin@192.168.99.2 depuis le poste de gestion. Client Windows récent : ajouter -o KexAlgorithms=+diffie-hellman-group14-sha1.',
    rangement: 'Gestionnaire de mots de passe, entrée « SW1 TP VLAN »',
    sauvegarde: 'copy running-config startup-config sur SW1 et R1 après chaque modification ; copie texte de show running-config dans le dossier du labo.',
    retourArriere: 'Étapes « Annuler » de la fiche du Toolkit, dans l’ordre inverse : routeur, trunk, ports, gestion, VLAN, SSH.',
    referencesTexte: 'Énoncé du TP2 (Moodle), Cisco Catalyst 2960 Configuration Guide.',
  },
  systeme: {
    titre: 'Jonction d’un client Ubuntu au domaine Samba AD',
    objet: 'Joindre le poste Ubuntu au domaine serveur2.lan pour que les comptes du domaine puissent ouvrir une session.',
    environnement: 'VMware Workstation 17 : SRV-DC01 (Ubuntu Server 24.04, Samba 4.19) et CLIENT01 (Ubuntu Desktop 24.04).',
    architecture: 'Les deux VM sont sur le même réseau NAT 172.27.1.0/24. Le client utilise le contrôleur de domaine comme DNS.',
    acces: 'ssh admin@172.27.1.210 (serveur), session locale sur le client.',
    rangement: 'Gestionnaire de mots de passe, entrée « Labo Samba »',
    sauvegarde: 'Instantané VMware « avant jonction » sur les deux VM.',
    retourArriere: 'realm leave, puis restaurer l’instantané si besoin.',
    referencesTexte: 'Documentation Samba « Setting up Samba as an Active Directory Domain Controller ».',
  },
  azure: {
    titre: 'Réseau virtuel et machine virtuelle web dans Azure',
    objet: 'Déployer une VM Linux dans un sous-réseau dédié, n’ouvrir que SSH (depuis le cégep) et HTTPS.',
    environnement: 'Abonnement Azure for Students, région Canada Est, groupe de ressources rg-lab-canadaeast.',
    architecture: 'vnet-lab (10.10.0.0/16) contient snet-web (10.10.1.0/24). vm-web01 y est, protégée par nsg-web.',
    acces: 'ssh azureuser@<IP publique> avec la clé SSH créée au déploiement (clé privée gardée sur le poste, jamais copiée ici).',
    rangement: 'Clé SSH dans ~/.ssh du poste ; mot de passe du compte Azure dans le gestionnaire de mots de passe.',
    sauvegarde: 'Modèle ARM exporté depuis le portail, rangé avec ce PDF.',
    retourArriere: 'Supprimer le groupe de ressources rg-lab-canadaeast (supprime tout ce qu’il contient) après vérification.',
    referencesTexte: 'Microsoft Learn : « Quickstart: Create a Linux VM with the Azure CLI ».',
  },
  autre: {
    titre: 'Réseau du bureau : box, commutateur et NAS',
    objet: 'Documenter le réseau du bureau pour pouvoir le dépanner et le refaire.',
    environnement: 'Box Internet du fournisseur, commutateur non administrable 8 ports, NAS Synology, trois postes.',
    architecture: 'La box distribue les adresses (DHCP 192.168.1.100-199). Le NAS a une adresse fixe 192.168.1.20.',
    acces: 'Interface web du NAS : https://192.168.1.20:5001 ; box : http://192.168.1.1.',
    rangement: 'Gestionnaire de mots de passe, entrées « Box » et « NAS ».',
    sauvegarde: 'Export de la configuration du NAS chaque mois.',
    retourArriere: 'Réinitialiser la box puis remettre la réservation DHCP du NAS.',
    referencesTexte: 'Guide du fournisseur Internet, manuel du NAS.',
  },
};
/** Exemples des colonnes de tableaux, par catégorie. */
export const EXEMPLES_TABLEAUX = {
  cisco: {
    adressage: { equipement: 'SW1', interface: 'Vlan99', adresse: '192.168.99.2/24', vlan: '99 (gestion)', passerelle: '192.168.99.1', note: 'Adresse de gestion' },
    configuration: { titre: 'SW1 : VLAN et trunk', code: 'vlan 99\n name GESTION\ninterface GigabitEthernet0/1\n switchport mode trunk' },
    validation: { test: 'ping 192.168.99.1 depuis le poste de gestion', attendu: 'Réponses (4/4)' },
    incidents: { symptome: '% Please define a domain-name first', cause: 'Clé RSA demandée avant ip domain-name', solution: 'ip domain-name tp.local puis crypto key generate rsa' },
  },
  systeme: {
    adressage: { equipement: 'SRV-DC01', interface: 'ens33', adresse: '172.27.1.210/24', vlan: 'NAT VMware', passerelle: '172.27.1.2', note: 'DNS du domaine' },
    configuration: { titre: 'Client : jonction', code: 'sudo realm discover serveur2.lan\nsudo realm join -U administrator serveur2.lan' },
    validation: { test: 'id administrator@serveur2.lan sur le client', attendu: 'uid et groupes du domaine' },
    incidents: { symptome: 'realm: No such realm found', cause: 'Le client n’utilise pas le DC comme DNS', solution: 'DNS 172.27.1.210 dans netplan, puis netplan apply' },
  },
  azure: {
    adressage: { equipement: 'vm-web01', interface: 'nic-web01', adresse: '10.10.1.4', vlan: 'snet-web', passerelle: '10.10.1.1', note: 'IP publique sur la NIC' },
    configuration: { titre: 'Réseau', code: 'az network vnet create -g rg-lab-canadaeast -n vnet-lab --address-prefix 10.10.0.0/16 --subnet-name snet-web --subnet-prefix 10.10.1.0/24' },
    validation: { test: 'curl -I https://<IP publique>', attendu: 'HTTP/1.1 200' },
    incidents: { symptome: 'ssh : délai dépassé', cause: 'Règle NSG limitée à une autre IP source', solution: 'Mettre à jour la source de allow-ssh-admin' },
  },
  autre: {
    adressage: { equipement: 'NAS-BUREAU', interface: 'LAN1', adresse: '192.168.1.20/24', vlan: '-', passerelle: '192.168.1.1', note: 'Réservation DHCP' },
    configuration: { titre: 'Box : réservation DHCP', code: 'Réseau local > DHCP > Baux statiques : NAS-BUREAU → 192.168.1.20' },
    validation: { test: 'Ouvrir \\\\NAS-BUREAU depuis un poste', attendu: 'Le partage s’ouvre' },
    incidents: { symptome: 'NAS introuvable après coupure', cause: 'Adresse changée par le DHCP', solution: 'Réservation DHCP sur la box' },
  },
};

const MAX_LIGNES = 60;
const MAX_CODE = 20000;
const MAX_CELLULE = 1000;

/* ---------------------------------------------------------------------------
 * Garde « aucun secret »
 * ------------------------------------------------------------------------ */
const MOTIFS_SECRET = [
  // IOS : « secret Cisco123 », « password 7 0822… », « enable secret 5 $1$… ». « … secret » seul en fin de ligne est permis.
  // Les mots courants d'une phrase (« le secret est tapé… », « password recovery ») ne sont pas des mots de passe.
  { re: /\b(?:secret|password)\s+(?:[0-9]\s+)?(?![$(]|\*{3}|(?:est|et|de|du|des|le|la|les|se|sur|dans|pour|par|qui|que|ne|n['’]\S*|tap\S*|demand\S*|saisi\S*|is|for|of|to|the|and|policy|recovery|encryption|reset|tap)(?:\s|[.,;:!?)»]|$))\S+/i, quoi: 'un mot de passe après « secret » ou « password »' },
  { re: /\b(?:key-string|pre-shared-key|key\s+[0-9])\s+(?!\*{3})\S+/i, quoi: 'une clé après « key-string » ou « pre-shared-key »' },
  { re: /\bmots?\s+de\s+passe\s*[:=]\s*(?!\*{3})\S+/i, quoi: 'un mot de passe après « mot de passe : »' },
  { re: /\b(?:pwd|passwd|password|mdp|pass|passphrase)\s*[:=]\s*(?!\*{3})\S+/i, quoi: 'un mot de passe après « pass= » ou « mdp: »' },
  // Azure : clé d'un compte de stockage ou d'un espace de noms, jeton SAS (une chaîne de connexion copiée du portail).
  { re: /\b(?:AccountKey|SharedAccessKey|SharedAccessSignature)\s*=\s*(?!\*{3})[^;\s"]+/i, quoi: 'une clé Azure (AccountKey, SharedAccessKey)' },
  { re: /[?&]sig=(?!\*{3})[^&\s"]+/i, quoi: 'un jeton SAS (sig=…)' },
  { re: /--(?:admin-)?password(?:=|\s+)(?!\*{3})\S+/i, quoi: 'un mot de passe après « --password »' },
  { re: /-(?:Account)?Password\s+(?!\*{3})["']?[^\s"'$(]\S*/i, quoi: 'un mot de passe après « -Password »' },
  { re: /ConvertTo-SecureString\s+["'][^"']+["']/i, quoi: 'un mot de passe dans ConvertTo-SecureString' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, quoi: 'une clé privée' },
];

/**
 * Cherche un secret écrit dans un texte. Renvoie { ligne, quoi } ou null.
 * Remplacer la valeur par *** rend la ligne acceptable.
 */
export function secretDans(texte) {
  const lignes = String(texte ?? '').split('\n');
  for (let i = 0; i < lignes.length; i++) {
    for (const m of MOTIFS_SECRET) if (m.re.test(lignes[i])) return { ligne: i + 1, quoi: m.quoi };
  }
  return null;
}

function messageSecret(s) {
  return `Ce texte semble contenir ${s.quoi} (ligne ${s.ligne}). Remplace la valeur par *** : un mot de passe ne s’écrit jamais dans la documentation.`;
}

/* ---------------------------------------------------------------------------
 * Références, dates, versions
 * ------------------------------------------------------------------------ */
export const categorie = (id) => CATEGORIES_JOURNAL.find((c) => c.id === id) ?? CATEGORIES_JOURNAL[3];
export const etat = (id) => ETATS_JOURNAL.find((e) => e.id === id) ?? ETATS_JOURNAL[0];
export const resultat = (id) => RESULTATS.find((r) => r.id === id) ?? RESULTATS[0];

/** Date locale « AAAA-MM-JJ ». */
export function jour(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const estJour = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''));

/** Prochaine référence libre : LAB-RES-2026-001, LAB-RES-2026-002… par catégorie et par année. */
export function prochaineReference(categorieId, annee, existantes = []) {
  const code = categorie(categorieId).code;
  const prefixe = `LAB-${code}-${annee}-`;
  const pris = existantes.filter((r) => String(r).startsWith(prefixe)).map((r) => Number(String(r).slice(prefixe.length))).filter(Number.isFinite);
  const n = (pris.length ? Math.max(...pris) : 0) + 1;
  return `${prefixe}${String(n).padStart(3, '0')}`;
}

/** Version suivante : 1.2 → 1.3 (mineure) ou 2.0 (majeure). */
export function versionSuivante(v, majeure = false) {
  const m = /^(\d+)\.(\d+)$/.exec(String(v ?? ''));
  const [a, b] = m ? [Number(m[1]), Number(m[2])] : [1, 0];
  return majeure ? `${a + 1}.0` : `${a}.${b + 1}`;
}

/** Un identifiant interne court (non devinable n'est pas nécessaire : rien n'est partagé). */
export function nouvelId(maintenant = Date.now(), alea = Math.random) {
  return `j${maintenant.toString(36)}${Math.floor(alea() * 1e6).toString(36)}`;
}

/* ---------------------------------------------------------------------------
 * Entrée vide et normalisation
 * ------------------------------------------------------------------------ */
export function entreeVide({ categorieId = 'cisco', auteur = '', date = new Date(), existantes = [], id = nouvelId() } = {}) {
  const j = jour(date);
  return {
    id, reference: prochaineReference(categorieId, j.slice(0, 4), existantes), titre: '', categorie: categorie(categorieId).id,
    etat: 'brouillon', version: '1.0', auteur: String(auteur ?? '').slice(0, 120), classification: 'Interne',
    creeLe: j, modifieLe: j,
    objet: '', environnement: '', architecture: '', acces: '', rangement: '', sauvegarde: '', retourArriere: '', referencesTexte: '',
    adressage: [], configuration: [], validation: [], incidents: [],
    fiches: [], captures: [], equipements: [], schema: schemaVide(),
    revisions: [{ version: '1.0', date: j, resume: 'Création du document' }],
  };
}

const texte = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').slice(0, max);
const ligneVide = (l, cols) => cols.every((c) => !String(l[c.id] ?? '').trim());

/**
 * Valide une entrée brute (formulaire ou sauvegarde). Renvoie { entree, erreurs }.
 * `erreurs` : clé → message (« titre », « objet », « adressage.2.note »…).
 * Une entrée avec des erreurs NE DOIT PAS être enregistrée.
 */
export function normaliserEntree(brut = {}) {
  const erreurs = {};
  const b = brut && typeof brut === 'object' ? brut : {};
  const base = entreeVide({ id: String(b.id ?? '') || nouvelId(), categorieId: b.categorie, date: estJour(b.creeLe) ? new Date(`${b.creeLe}T12:00:00`) : new Date() });
  const e = { ...base };
  e.reference = /^LAB-[A-Z]{2,3}-\d{4}-\d{3,4}$/.test(String(b.reference ?? '')) ? b.reference : base.reference;
  e.titre = texte(b.titre, 120).trim();
  if (!e.titre) erreurs.titre = 'Donne un titre au document (ex. « TP VLAN, SSH et routage inter-VLAN »).';
  e.categorie = categorie(b.categorie).id;
  e.etat = etat(b.etat).id;
  e.version = /^\d{1,3}\.\d{1,3}$/.test(String(b.version ?? '')) ? b.version : '1.0';
  e.auteur = texte(b.auteur, 120).trim();
  e.classification = CLASSIFICATIONS.includes(b.classification) ? b.classification : 'Interne';
  e.creeLe = estJour(b.creeLe) ? b.creeLe : base.creeLe;
  e.modifieLe = estJour(b.modifieLe) ? b.modifieLe : e.creeLe;

  const verifierSecret = (cle, v) => { const s = secretDans(v); if (s) erreurs[cle] = messageSecret(s); };
  verifierSecret('titre', e.titre);
  verifierSecret('auteur', e.auteur);
  for (const c of CHAMPS_TEXTE) {
    e[c.id] = texte(b[c.id], c.max);
    verifierSecret(c.id, e[c.id]);
  }

  for (const [nom, cols] of Object.entries(TABLEAUX)) {
    const src = Array.isArray(b[nom]) ? b[nom] : [];
    const lignes = [];
    for (const l of src.slice(0, MAX_LIGNES)) {
      if (!l || typeof l !== 'object') continue;
      const propre = {};
      for (const c of cols) propre[c.id] = texte(l[c.id], c.id === 'code' ? MAX_CODE : MAX_CELLULE);
      if (nom === 'validation') propre.resultat = resultat(l.resultat).id;
      if (ligneVide(propre, cols.filter((c) => c.id !== 'resultat'))) continue;
      const i = lignes.length;
      for (const c of cols) { const s = secretDans(propre[c.id]); if (s) erreurs[`${nom}.${i}.${c.id}`] = messageSecret(s); }
      lignes.push(propre);
    }
    e[nom] = lignes;
  }

  // Schéma d'architecture (voir schema.mjs) : éléments mal formés écartés, mots de passe refusés.
  const sch = normaliserSchema(b.schema);
  e.schema = sch.schema; Object.assign(erreurs, sch.erreurs);
  // Équipements de l'inventaire utilisés dans ce labo, avec leur rôle ICI.
  const vus = new Set();
  e.equipements = (Array.isArray(b.equipements) ? b.equipements : [])
    .filter((x) => x && /^e[\w]{3,40}$/.test(String(x.id ?? '')) && !vus.has(x.id) && vus.add(x.id)).slice(0, 60)
    .map((x) => ({ id: String(x.id), role: texte(x.role, 200).trim() }));
  e.equipements.forEach((x, i) => { const s = secretDans(x.role); if (s) erreurs[`equipements.${i}.role`] = messageSecret(s); });
  e.fiches = [...new Set((Array.isArray(b.fiches) ? b.fiches : []).map(String).filter((x) => /^[\w-]{2,120}$/.test(x)))].slice(0, 20);
  e.captures = (Array.isArray(b.captures) ? b.captures : []).filter((c) => c && /^[\w-]{4,80}$/.test(String(c.id ?? ''))).slice(0, MAX_CAPTURES)
    .map((c) => ({ id: String(c.id), nom: texte(c.nom, 120).trim() || 'capture.jpg', legende: texte(c.legende, 300).trim() }));
  e.captures.forEach((c, i) => { const s = secretDans(c.legende); if (s) erreurs[`captures.${i}.legende`] = messageSecret(s); });

  const revs = (Array.isArray(b.revisions) ? b.revisions : [])
    .filter((r) => r && /^\d{1,3}\.\d{1,3}$/.test(String(r.version ?? '')) && estJour(r.date))
    .map((r) => ({ version: r.version, date: r.date, resume: texte(r.resume, 300).trim() || 'Mise à jour' })).slice(-100);
  e.revisions = revs.length ? revs : [{ version: e.version, date: e.creeLe, resume: 'Création du document' }];
  return { entree: e, erreurs };
}

/**
 * Publie une nouvelle version : incrémente le numéro et ajoute une ligne à
 * l'historique. Le résumé est obligatoire (c'est ce qu'on lira dans six mois).
 */
export function publierVersion(entree, { resume, majeure = false, date = new Date() } = {}) {
  const r = String(resume ?? '').trim();
  if (!r) return { entree, erreur: 'Écris en une phrase ce qui a changé dans cette version.' };
  const s = secretDans(r);
  if (s) return { entree, erreur: messageSecret(s) };
  const version = versionSuivante(entree.version, majeure);
  const j = jour(date);
  return { entree: { ...entree, version, modifieLe: j, revisions: [...entree.revisions, { version, date: j, resume: r.slice(0, 300) }] }, erreur: null };
}

/** Le labo n'a pas été revu depuis longtemps (hors archives). */
export function aRevoir(entree, aujourdhui = new Date(), jours = JOURS_A_REVOIR) {
  if (entree.etat === 'archive' || !estJour(entree.modifieLe)) return false;
  const ecart = (new Date(`${jour(aujourdhui)}T12:00:00`) - new Date(`${entree.modifieLe}T12:00:00`)) / 86400000;
  return ecart > jours;
}

/** Recherche simple (sans accents) dans le titre, la référence, l'objet, les adresses et les équipements. */
export function correspond(entree, requete) {
  const n = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = n(requete).trim();
  if (!q) return true;
  const foin = n([entree.titre, entree.reference, entree.objet, entree.environnement, entree.architecture,
    ...entree.adressage.flatMap((l) => Object.values(l)), ...entree.incidents.flatMap((l) => Object.values(l))].join(' '));
  return q.split(/\s+/).every((m) => foin.includes(m));
}

/** Liste filtrée et triée (plus récent d'abord). */
export function filtrerJournal(entrees, { categorieId = null, filtre = 'tous', requete = '', aujourdhui = new Date() } = {}) {
  return entrees
    .filter((e) => !categorieId || e.categorie === categorieId)
    .filter((e) => filtre === 'tous' ? e.etat !== 'archive' : filtre === 'a-revoir' ? aRevoir(e, aujourdhui) : e.etat === filtre)
    .filter((e) => correspond(e, requete))
    .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)) || String(b.reference).localeCompare(String(a.reference)));
}

/* ---------------------------------------------------------------------------
 * Création depuis une fiche du Toolkit
 * ------------------------------------------------------------------------ */
const PLATEFORME_VERS_CATEGORIE = { Cisco: 'cisco', Azure: 'azure', Linux: 'systeme', Windows: 'systeme' };
const COMMENTAIRE = { ios: '!', cmd: 'REM', powershell: '#', linux: '#', azure: '#' };

/** Valeurs utiles d'une évaluation (evaluerValeurs) : paramètres valides et lignes des tableaux valides. */
export function valeursPourJournal(evaluation) {
  const v = { ...(evaluation?.valides ?? {}) };
  for (const [id, t] of Object.entries(evaluation?.tables ?? {})) if (t?.ok && Array.isArray(t.lignes)) v[id] = t.lignes;
  return v;
}

/**
 * Prépare une entrée à partir d'une fiche et de ses valeurs saisies :
 * titre, catégorie, objet, adressage (tableau de VLAN et adresse de gestion
 * si la fiche en a), configuration (les commandes rendues, phase par phase,
 * hors étapes facultatives, d'annulation ou incomplètes), validation (la
 * vérification finale de la fiche, « À tester »).
 * `rendu` : résultat de rendreMethode ; `valeurs` : valeursPourJournal(evaluerValeurs(...)).
 */
export function entreeDepuisFiche(procedure, { methode, rendu, valeurs = {}, plateformes = [], auteur = '', date = new Date(), existantes = [] } = {}) {
  const cat = PLATEFORME_VERS_CATEGORIE[plateformes[0]] ?? 'autre';
  const e = entreeVide({ categorieId: cat, auteur, date, existantes });
  e.titre = String(procedure?.titre ?? '').slice(0, 120);
  e.objet = String(procedure?.resume ?? '').slice(0, 2000);
  e.fiches = procedure?.id ? [procedure.id] : [];

  // Adressage
  const v = valeurs;
  const pf = (p) => (p ? `/${p}` : '');
  if (v.gestionSwitch || v.vlanGestion) {
    e.adressage.push({ equipement: v.hoteSw ?? '', interface: v.vlanGestion ? `Vlan${v.vlanGestion}` : '', adresse: `${v.gestionSwitch ?? ''}${pf(v.gestionPrefixe)}`,
      vlan: v.vlanGestion ? `${v.vlanGestion} (gestion)` : '', passerelle: v.gestionPasserelle ?? '', note: 'Adresse de gestion' });
    if (v.gestionPoste) e.adressage.push({ equipement: 'Poste de gestion', interface: v.portGestion ?? '', adresse: `${v.gestionPoste}${pf(v.gestionPrefixe)}`, vlan: v.vlanGestion ?? '', passerelle: v.gestionPasserelle ?? '', note: '' });
  }
  for (const prm of procedure?.params ?? []) {
    if (prm.type !== 'table' || !Array.isArray(v[prm.id])) continue;
    for (const l of v[prm.id]) {
      if (!l || typeof l !== 'object') continue;
      const reseau = l.reseau ? `${l.reseau}${pf(l.prefixe)}` : '';
      e.adressage.push({ equipement: l.nom ? `VLAN ${l.vlan ?? ''} ${l.nom}`.trim() : '', interface: l.ports ?? '', adresse: reseau,
        vlan: l.vlan ?? '', passerelle: l.passerelle ?? '', note: l.poste ? `Poste de test ${l.poste}` : '' });
    }
  }

  // Configuration : une entrée par phase, commandes réellement rendues.
  const etapes = methode?.etapes ?? [];
  const prefixe = COMMENTAIRE[methode?.id] ?? '#';
  const parPhase = new Map();
  (rendu?.etapes ?? []).forEach((r, i) => {
    const src = etapes[i];
    if (!src || src.annulation || src.facultatif || r.rendu?.bloque) return;
    const lignes = (r.rendu?.lignes ?? []).map((l) => l.copie).filter(Boolean);
    if (!lignes.length) return;
    const phase = src.phase || 'Configuration';
    if (!parPhase.has(phase)) parPhase.set(phase, []);
    parPhase.get(phase).push(`${prefixe} ${i + 1}. ${src.titre}`, ...lignes, '');
  });
  for (const [phase, lignes] of parPhase) e.configuration.push({ titre: phase, code: lignes.join('\n').trim() });

  for (const t of methode?.verification ?? []) if (typeof t === 'string' && t.trim()) e.validation.push({ test: t.trim(), attendu: '', resultat: 'a-tester' });
  const ordre = /\(([^)]{3,200})\)/.exec(String(methode?.retour ?? ''))?.[1];
  if (procedure?.titre && (etapes.some((x) => x.annulation) || methode?.retour)) {
    e.retourArriere = `Étapes « Annuler » de la fiche « ${procedure.titre} » du KJEMO IT Toolkit, dans l’ordre inverse${ordre ? ` (${ordre})` : ''}.`;
  }
  // La normalisation refuse tout secret : une fiche ne doit jamais en produire, on le vérifie quand même.
  return normaliserEntree(e);
}

/* ---------------------------------------------------------------------------
 * Sauvegarde et restauration (fichier JSON)
 * ------------------------------------------------------------------------ */
/** Lit la valeur stockée : { entrees: [...] }. Les entrées invalides sont écartées, jamais réparées en silence. */
export function lireJournal(brut) {
  const liste = Array.isArray(brut?.entrees) ? brut.entrees : [];
  const entrees = []; let ecartees = 0;
  for (const x of liste) {
    const { entree, erreurs } = normaliserEntree(x);
    if (Object.keys(erreurs).length) { ecartees++; continue; }
    entrees.push(entree);
  }
  return { entrees, ecartees };
}

/** Fichier de sauvegarde : les entrées, les captures (JPEG en base64) et l'inventaire des équipements. */
export function sauvegardeJournal(entrees, captures = {}, date = new Date(), equipements = [], typesPerso = []) {
  return JSON.stringify({ format: FORMAT_SAUVEGARDE, version: 2, date: jour(date), entrees, captures, equipements, typesPerso }, null, 1);
}

/**
 * Lit un fichier de sauvegarde. Renvoie { entrees, captures, ecartees, erreur }.
 * Les références déjà présentes sont signalées dans `doublons` (l'appelant choisit).
 */
export function lireSauvegarde(texteFichier, existantes = []) {
  let d;
  try { d = JSON.parse(texteFichier); } catch { return { erreur: 'Ce fichier n’est pas un JSON lisible.' }; }
  if (d?.format !== FORMAT_SAUVEGARDE) return { erreur: 'Ce fichier n’est pas une sauvegarde du Journal de labo.' };
  const { entrees, ecartees } = lireJournal(d);
  const captures = {};
  const utiles = new Set(entrees.flatMap((e) => e.captures.map((c) => c.id)));
  for (const [id, b64] of Object.entries(d.captures ?? {})) {
    if (utiles.has(id) && typeof b64 === 'string' && /^[A-Za-z0-9+/=]+$/.test(b64) && b64.length < 8_000_000) captures[id] = b64;
  }
  const refs = new Set(existantes.map((e) => e.id));
  // L'inventaire (version 2) est rendu brut : inventaire.mjs le valide.
  const equipements = Array.isArray(d.equipements) ? d.equipements : [];
  const typesPerso = Array.isArray(d.typesPerso) ? d.typesPerso : [];
  return { entrees, captures, ecartees, equipements, typesPerso, doublons: entrees.filter((e) => refs.has(e.id)).map((e) => e.reference), erreur: null };
}

/**
 * Un labo d'EXEMPLE entièrement rempli pour une catégorie : pour voir à quoi
 * ressemble un dossier complet et son PDF. Le titre commence par « EXEMPLE » ;
 * il n'est enregistré que si la personne le décide.
 */
export function entreeExemple(categorieId, { existantes = [], auteur = '', date = new Date() } = {}) {
  const cat = categorie(categorieId).id;
  const e = entreeVide({ categorieId: cat, existantes, auteur, date });
  const ex = EXEMPLES_CHAMPS[cat];
  for (const c of CHAMPS_TEXTE) e[c.id] = ex[c.id] ?? '';
  e.titre = `EXEMPLE — ${ex.titre}`.slice(0, 120);
  const t = EXEMPLES_TABLEAUX[cat];
  e.adressage = [{ ...t.adressage }];
  e.configuration = [{ ...t.configuration }];
  e.validation = [{ ...t.validation, resultat: 'conforme' }, { test: 'Test encore à faire', attendu: 'Ce que tu dois voir', resultat: 'a-tester' }];
  e.incidents = [{ ...t.incidents }];
  e.revisions = [{ version: '1.0', date: e.creeLe, resume: 'Exemple fourni par le Toolkit : remplace les valeurs par les tiennes' }];
  return normaliserEntree(e).entree;
}
