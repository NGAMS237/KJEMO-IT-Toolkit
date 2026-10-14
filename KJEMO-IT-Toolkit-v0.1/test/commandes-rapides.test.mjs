#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — LE CONTRAT DES COMMANDES RAPIDES
//
// Le modele UX revise exige que chaque notion puisse offrir deux visages : une
// commande rapide, et un assistant guide. La commande rapide a nenf
// obligations, et une seule d'entre elles suffirait a rendre le reste
// dangereux si elle n'etait pas tenue : le bloc copiable ne contient AUCUN
// commentaire.
//
// POURQUOI CETTE REGLE EST TESTEE, ET NON SEULEMENT ECRITE
//
// Un « # » colle dans un terminal ne se comporte pas toujours en commentaire.
// Colle dans une invite qui attend une suite, il ne commente rien. Colle dans
// un fichier de configuration, il commente la ligne suivante une fois le
// retour a la ligne perdu. Et une commande copiee depuis une page web arrive
// souvent sur UNE SEULE LIGNE : tout ce qui suit le « # » est avale, et la
// personne lance une commande tronquee en croyant avoir tout copie.
//
// NIVEAU DE PREUVE : contrat de donnees. Ce banc ne lance aucune commande, et
// ne dit pas qu'elles sont justes sur un vrai Ubuntu Server. Il dit qu'aucune
// n'est publiee sans besoin, sans exemple, sans explication de chaque option,
// sans verification, sans niveau de risque, et sans retour en arriere — ou
// sans que son absence soit ecrite.
// ---------------------------------------------------------------------------
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// pathToFileURL(...).href est ecrit en toutes lettres a CHAQUE import, et non
// cache dans une fonction d'aide. La garde anti-regression d'identity.test.mjs
// — posee apres l'echec CI « ERR_UNSUPPORTED_ESM_URL_SCHEME, Received protocol
// 'd:' » sous Windows — lit le texte de l'appel. Une indirection la rendrait
// aveugle, et c'est elle qui a refuse ce fichier quand il passait par un
// raccourci. Verbeux ici vaut mieux qu'une garde qu'on contourne.
const { incoherencesCommandeRapide, optionsDe, RISQUES_COMMANDE,
        CHAMPS_COMMANDE_RAPIDE, MOTIF_JETON } =
  await import(pathToFileURL(resolve(ROOT, 'dist/commandes-rapides.mjs')).href);
const { commandesStockage } =
  await import(pathToFileURL(resolve(ROOT, 'dist/commandes-stockage.mjs')).href);
const { tools } =
  await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const { sourceLinuxValide, editeurDe } =
  await import(pathToFileURL(resolve(ROOT, 'dist/sources-linux.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

const TOUTES = [...commandesStockage];

console.log('');
console.log(`Plan 1 — contrat des ${TOUTES.length} commandes rapides`);

const vus = new Set();
for (const c of TOUTES) {
  const pb = incoherencesCommandeRapide(c);
  verifier(pb.length === 0, `${c.id} : contrat tenu${pb.length ? ' — ' + pb.join(' | ') : ''}`);

  verifier(!vus.has(c.id), `${c.id} : identifiant unique`);
  vus.add(c.id);

  // La source doit venir d'un editeur primaire, comme pour les fiches. Une
  // commande rapide est lue plus vite qu'une fiche, donc plus souvent crue
  // sur parole : sa source compte au moins autant.
  verifier(sourceLinuxValide(c.source),
    `${c.id} : source d'un editeur primaire (${editeurDe(c.source) ?? 'NON RECONNU : ' + c.source})`);

  // L'assistant lie, quand il est nomme, doit exister — sinon le lien
  // promis au §9 des exigences mene nulle part. On accepte qu'il soit encore
  // a ecrire, mais on le DIT, plutot que de laisser croire qu'il existe.
  if (c.assistant !== null) {
    const existe = tools.some((t) => t.id === c.assistant);
    if (!existe) {
      console.log(`         note : ${c.id} renvoie a « ${c.assistant} », assistant pas encore ecrit`);
    }
    verifier(/^[a-z][a-z0-9-]+$/.test(c.assistant),
      `${c.id} : identifiant d'assistant bien forme (${c.assistant})`);
  }

  // La verification ne doit pas etre la commande elle-meme : se relire ne
  // prouve rien.
  verifier(c.verification.trim() !== c.commande.trim(),
    `${c.id} : la verification n'est pas la commande elle-meme`);
}

// ---------------------------------------------------------------------------
console.log('');
console.log('Plan 2 — aucun commentaire dans un bloc copiable');

for (const c of TOUTES) {
  for (const champ of ['commande', 'exemple']) {
    verifier(!/(^|\s)#/m.test(c[champ]),
      `${c.id} : ${champ} sans aucun « # »`);
  }
}

// ---------------------------------------------------------------------------
console.log('');
console.log('Plan 3 — couverture des sept commandes d\'observation exigees');

// La consigne enumere nommement sept commandes d'observation du stockage.
// Elles doivent exister ; les chercher dans le CODE evite de cocher une case
// sur une intention.
const EXIGEES = ['lsblk -f', 'blkid', 'fdisk -l', 'findmnt', 'df -hT',
                 'cat /proc/mdstat', 'mdadm --detail'];
for (const attendue of EXIGEES) {
  const trouvee = TOUTES.some((c) => c.commande.includes(attendue));
  verifier(trouvee, `la commande d'observation « ${attendue} » est couverte`);
}

// ---------------------------------------------------------------------------
console.log('');
console.log('Plan 4 — aucun peripherique code en dur dans un bloc copiable');

// Un /dev/sdb dans le champ `commande` invite a coller sans regarder. Il a sa
// place dans `exemple`, qui est separe et annonce comme un exemple.
for (const c of TOUTES) {
  verifier(!/\/dev\/(sd[a-z]|nvme\d|md\d)/.test(c.commande),
    `${c.id} : commande sans peripherique code en dur`);
}

// ---------------------------------------------------------------------------
console.log('');
console.log('Plan 5 — contre-epreuves : le contrat doit refuser');

const modele = () => ({
  id: 'cr-essai',
  notion: 'linux-storage-diagnostic',
  besoin: 'Voir les disques et leurs partitions sur la machine.',
  commande: 'lsblk -f',
  exemple: 'lsblk -f',
  parametres: [],
  options: [{ option: '-f', explication: '-f affiche le systeme de fichiers et l\'UUID.' }],
  resultat: 'Un arbre des disques avec leurs partitions et leurs UUID.',
  verification: 'blkid',
  risque: 'lecture',
  retourArriere: null,
  assistant: 'linux-storage-diagnostic',
  source: 'https://manpages.ubuntu.com/manpages/noble/en/man8/lsblk.8.html',
});

verifier(incoherencesCommandeRapide(modele()).length === 0,
  'contre-epreuve 0 : le modele propre est accepte — sinon les suivantes ne prouveraient qu\'un refus systematique');

const refus = [
  ['commentaire en fin de ligne', { commande: 'lsblk -f  # liste les disques' }],
  ['commentaire en debut de ligne', { commande: '# liste les disques\nlsblk -f' }],
  ['option non expliquee', { commande: 'lsblk -f -p', options: [{ option: '-f', explication: '-f affiche le systeme de fichiers et l\'UUID.' }] }],
  ['lettre non expliquee dans un groupe', { commande: 'df -hT', options: [{ option: '-hT', explication: '-h affiche des tailles lisibles.' }] }],
  ['jeton non declare', { commande: 'lsblk -f <DISQUE>' }],
  ['parametre declare mais absent', { parametres: [{ jeton: '<DISQUE>', role: 'le disque vise', exemple: '/dev/sdb' }] }],
  ['jeton reste dans l\'exemple', { exemple: 'lsblk -f <DISQUE>' }],
  ['besoin trop court', { besoin: 'disques' }],
  ['resultat trop court', { resultat: 'ok' }],
  ['verification absente', { verification: '' }],
  ['risque inconnu', { risque: 'moyen' }],
  ['retour en arriere tu', { risque: 'attention', retourArriere: null, assistant: 'x' }],
  ['lecture avec un retour en arriere', { retourArriere: 'rien a defaire' }],
  ['operation risquee sans assistant', { risque: 'destructif', retourArriere: null, pourquoiPasDeRetour: 'Les donnees ecrasees ne se recuperent pas.', assistant: null }],
  ['source absente', { source: '' }],
  ['commande vide', { commande: '' }],
];

for (const [nom, patch] of refus) {
  const c = { ...modele(), ...patch };
  const pb = incoherencesCommandeRapide(c);
  verifier(pb.length > 0, `contre-epreuve : « ${nom} » est refuse${pb.length ? ' (' + pb[0] + ')' : ' — IL NE L\'EST PAS'}`);
}

// Un champ entierement absent doit etre vu, pas contourne.
for (const champ of CHAMPS_COMMANDE_RAPIDE) {
  const c = modele();
  delete c[champ];
  verifier(incoherencesCommandeRapide(c).length > 0,
    `contre-epreuve : le champ absent « ${champ} » est refuse`);
}

// Le detecteur d'options doit voir ce qu'il doit voir, et ignorer ce qui suit
// un « -- » isole : apres lui, « -rf » est un nom de fichier.
verifier(JSON.stringify(optionsDe('lsblk -f -p')) === JSON.stringify(['-f', '-p']),
  'contre-epreuve : optionsDe voit les deux options');
verifier(optionsDe('rm -- -rf').length === 0,
  'contre-epreuve : optionsDe ignore ce qui suit un « -- » isole');
verifier(optionsDe('sudo mdadm --detail /dev/md1').includes('--detail'),
  'contre-epreuve : optionsDe voit une option longue');

// Et le motif de jeton ne doit pas confondre une redirection avec un jeton.
MOTIF_JETON.lastIndex = 0;
verifier(('cat < fichier'.match(MOTIF_JETON) ?? []).length === 0,
  'contre-epreuve : une redirection n\'est pas prise pour un jeton');
MOTIF_JETON.lastIndex = 0;

verifier(RISQUES_COMMANDE.length === 4,
  `les quatre niveaux de risque des commandes sont declares (${RISQUES_COMMANDE.join(', ')})`);

// ---------------------------------------------------------------------------
console.log('');
console.log(`Commandes rapides : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log(`${TOUTES.length} commande(s) sous contrat ; aucune n'a ete executee par ce banc.`);
process.exit(echecs.length === 0 ? 0 : 1);
