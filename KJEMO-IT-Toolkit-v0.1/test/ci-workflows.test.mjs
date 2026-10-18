#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 — LE CI LINUX EST-IL RÉELLEMENT BLOQUANT ?
//
// POURQUOI CE FICHIER EXISTE
//
// « Le CI Linux est bloquant » est une affirmation sur un fichier YAML. Tant
// que personne ne lit ce fichier, c'est une intention. Un `needs:` oublié, un
// `continue-on-error: true` ajouté un soir pour débloquer une livraison, un
// `if: always()` posé sur l'étape qui compte : dans les trois cas le workflow
// reste vert et la porte ne garde plus rien.
//
// Ce banc lit les workflows et prouve quatre choses :
//
//   1. la validation Linux est déclenchée sur push ET sur pull_request ;
//   2. le déploiement Pages dépend des DEUX validations, Windows et Linux ;
//   3. aucun `continue-on-error` nulle part ;
//   4. aucune condition permissive là où elle rendrait une étape facultative.
//
// Plus l'ordre des étapes : générer avant de contrôler ce qui est généré.
//
// SUR LE LECTEUR YAML
//
// Le dépôt est sans dépendance d'exécution, et le rester vaut plus qu'un
// parseur complet : ajouter « yaml » au package.json pour lire quatre fichiers
// que nous écrivons nous-mêmes serait disproportionné. Le lecteur ci-dessous
// couvre ce que ces fichiers utilisent — tables indentées, listes, listes en
// ligne, blocs littéraux — et rien de plus.
//
// Cette limite est réelle, donc elle est éprouvée : le plan 4 soumet au
// lecteur du YAML fautif et exige qu'il le VOIE. Un lecteur approximatif qui
// n'aurait jamais rien refusé ne vaudrait pas mieux qu'une lecture à l'oeil.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Les workflows vivent à la RACINE du dépôt, un niveau au-dessus du projet.
const RACINE = resolve(__dirname, '..', '..');
const WF = join(RACINE, '.github', 'workflows');

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (cond, m) => (cond ? pass(m) : fail(m));

// ===========================================================================
// Lecteur YAML minimal
// ===========================================================================
function lireYaml(texte) {
  const lignes = texte.split('\n');
  const racine = {};
  // pile de contextes : { indent, valeur }
  const pile = [{ indent: -1, valeur: racine }];

  const scalaire = (s) => {
    const t = s.trim();
    if (t === '') return '';
    if (t.startsWith('[') && t.endsWith(']')) {
      return t.slice(1, -1).split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter((x) => x !== '');
    }
    if (/^(true|false)$/.test(t)) return t === 'true';
    return t.replace(/^['"]|['"]$/g, '');
  };

  for (let i = 0; i < lignes.length; i += 1) {
    const brute = lignes[i];
    if (brute.trim() === '' || brute.trim().startsWith('#')) continue;
    const indent = brute.length - brute.trimStart().length;
    let ligne = brute.trim();

    // Bloc littéral « clef: | » : on avale les lignes plus indentées telles quelles.
    const bloc = ligne.match(/^([\w.-]+):\s*[|>][-+]?\s*$/);
    if (bloc) {
      const corps = [];
      let j = i + 1;
      while (j < lignes.length) {
        const l = lignes[j];
        const ind = l.length - l.trimStart().length;
        if (l.trim() !== '' && ind <= indent) break;
        corps.push(l.slice(indent + 2));
        j += 1;
      }
      while (pile.length > 1 && pile[pile.length - 1].indent >= indent) pile.pop();
      pile[pile.length - 1].valeur[bloc[1]] = corps.join('\n');
      i = j - 1;
      continue;
    }

    // Élément de liste
    if (ligne.startsWith('- ') || ligne === '-') {
      // « >= » et non « > » : l'objet du precedent element de liste a ete
      // empile a indent+1, il doit etre depile avant de rattacher le suivant
      // au tableau, qui est empile a l'indent de SA clef. Avec « > », le
      // deuxieme element etait rattache a l'objet du premier, puis ignore :
      // une liste de deux etapes etait lue comme une liste d'une etape. La
      // contre-epreuve 4 ter de ce fichier l'a vu.
      while (pile.length > 1 && pile[pile.length - 1].indent >= indent) pile.pop();
      const hote = pile[pile.length - 1].valeur;
      if (!Array.isArray(hote)) { continue; }
      const reste = ligne === '-' ? '' : ligne.slice(2).trim();
      if (reste.includes(':') && !reste.startsWith('"') && !reste.startsWith("'")) {
        const objet = {};
        hote.push(objet);
        // indent + 1 : strictement au-dessus du tableau (qui est a l'indent de
        // sa clef) et strictement en dessous des clefs de l'element, qui
        // commencent a indent + 2.
        pile.push({ indent: indent + 1, valeur: objet });
        ligne = reste;
        // on retombe dans le traitement « clef: valeur » ci-dessous, avec un
        // indent décalé de deux pour que les clefs frères s'y rattachent.
        const m = ligne.match(/^([^:]+):\s*(.*)$/);
        if (m) {
          const clef = m[1].trim();
          const val = m[2];
          if (val === '') { const sous = {}; objet[clef] = sous; pile.push({ indent: indent + 2, valeur: sous }); }
          else objet[clef] = scalaire(val);
        }
        continue;
      }
      hote.push(scalaire(reste));
      continue;
    }

    // clef: valeur
    const m = ligne.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const clef = m[1].trim();
    const val = m[2];

    while (pile.length > 1 && pile[pile.length - 1].indent >= indent) pile.pop();
    const hote = pile[pile.length - 1].valeur;
    if (Array.isArray(hote)) continue;

    if (val === '') {
      // La nature de l'enfant (table ou liste) se lit sur la ligne suivante.
      let j = i + 1;
      while (j < lignes.length && (lignes[j].trim() === '' || lignes[j].trim().startsWith('#'))) j += 1;
      const suivante = lignes[j] ?? '';
      const indSuiv = suivante.length - suivante.trimStart().length;
      const enfant = (suivante.trim().startsWith('- ') || suivante.trim() === '-') && indSuiv > indent ? [] : {};
      hote[clef] = enfant;
      pile.push({ indent, valeur: enfant });
    } else {
      hote[clef] = scalaire(val);
    }
  }
  return racine;
}

// ===========================================================================
// PLAN 1 — les fichiers attendus existent
// ===========================================================================
console.log('');
console.log('Plan 1 — présence des workflows');

const ATTENDUS = ['validate.yml', 'validate-linux.yml', 'ps-syntax-check.yml', 'deploy-pages.yml'];
for (const f of ATTENDUS) {
  verifier(existsSync(join(WF, f)), `${f} est présent`);
}
if (echecs.length > 0) {
  console.error('\nArrêt : un workflow attendu est absent.');
  process.exit(1);
}

const texte = Object.fromEntries(ATTENDUS.map((f) => [f, readFileSync(join(WF, f), 'utf8')]));
const yml = Object.fromEntries(ATTENDUS.map((f) => [f, lireYaml(texte[f])]));

// Les controles textuels portent sur le CODE, pas sur les commentaires.
// Premiere version de ce banc : il refusait validate-linux.yml parce qu'un
// commentaire y ecrit « aucune continue-on-error ». Une garde qui echoue sur
// la phrase qui la decrit se discredite elle-meme. Les lignes de commentaire
// sont donc blanchies, en CONSERVANT les numeros de ligne, pour que les
// messages d'echec restent utilisables.
const sansCommentaires = (t) => t.split('\n')
  .map((l) => (l.trimStart().startsWith('#') ? '' : l))
  .join('\n');
const code = Object.fromEntries(ATTENDUS.map((f) => [f, sansCommentaires(texte[f])]));

// ===========================================================================
// PLAN 2 — la validation Linux est branchée sur push ET sur pull_request
// ===========================================================================
console.log('');
console.log('Plan 2 — déclenchement sur push et sur pull_request');

const pscheck = yml['ps-syntax-check.yml'];
// « on » est interprété par YAML 1.1 comme le booléen true : on accepte les deux.
const declencheurs = pscheck.on ?? pscheck.true ?? {};
const branchesPush = declencheurs.push?.branches ?? [];
const branchesPr = declencheurs.pull_request?.branches ?? [];

verifier(branchesPush.includes('main'), 'push sur main déclenche la validation');
verifier(branchesPush.some((b) => String(b).includes('claude/')), 'push sur claude/** déclenche la validation');
verifier(branchesPr.includes('main'), 'pull_request vers main déclenche la validation');

const jobsPs = pscheck.jobs ?? {};
const usesDe = (job) => String(job?.uses ?? '');
verifier(Object.values(jobsPs).some((j) => usesDe(j).endsWith('validate.yml')),
  'ps-syntax-check appelle la validation Windows');
verifier(Object.values(jobsPs).some((j) => usesDe(j).endsWith('validate-linux.yml')),
  'ps-syntax-check appelle la validation LINUX');

// ===========================================================================
// PLAN 3 — le déploiement dépend des DEUX validations
// ===========================================================================
console.log('');
console.log('Plan 3 — dépendance réelle du déploiement');

const dep = yml['deploy-pages.yml'];
const jobsDep = dep.jobs ?? {};
const deploy = jobsDep.deploy ?? {};
const needs = Array.isArray(deploy.needs) ? deploy.needs.map(String) : [String(deploy.needs ?? '')];

verifier(Object.values(jobsDep).some((j) => usesDe(j).endsWith('validate.yml')),
  'deploy-pages déclare le job de validation Windows');
verifier(Object.values(jobsDep).some((j) => usesDe(j).endsWith('validate-linux.yml')),
  'deploy-pages déclare le job de validation LINUX');
verifier(needs.includes('validate'), 'deploy needs la validation Windows');
verifier(needs.includes('validate-linux'), 'deploy needs la validation LINUX');
verifier(deploy.if === undefined,
  'deploy ne porte AUCUNE condition `if` — une condition le ferait démarrer malgré un échec');

// Le job Linux tourne bien sur un Linux : valider du Bash sous windows-latest
// validerait un autre interpréteur que celui qui exécutera les scripts.
const jobsLin = yml['validate-linux.yml'].jobs ?? {};
const jobLin = jobsLin['validate-linux'] ?? {};
verifier(String(jobLin['runs-on']) === 'ubuntu-latest', 'la validation Linux tourne sur ubuntu-latest');
const appelable = yml['validate-linux.yml'].on ?? yml['validate-linux.yml'].true ?? {};
verifier(Object.prototype.hasOwnProperty.call(appelable, 'workflow_call'),
  'validate-linux.yml est réutilisable (workflow_call)');

// ===========================================================================
// PLAN 4 — aucune échappatoire
// ===========================================================================
console.log('');
console.log('Plan 4 — absence de continue-on-error et de condition permissive');

for (const f of ATTENDUS) {
  verifier(!/continue-on-error/i.test(code[f]), `${f} ne contient aucun continue-on-error`);
}

// `if:` n'est toléré que sur les étapes de publication d'artefact et de
// statut : celles-là doivent tourner MÊME en cas d'échec, et elles ne gardent
// rien. Partout ailleurs, une condition rend l'étape facultative.
const PERMISSIVES = /^\s*if:\s*(always\(\)|success\(\)\s*\|\||failure\(\)|cancelled\(\)|\$\{\{)/;
const ETAPES_AUTORISEES = /upload-artifact|set-status|Définir le statut|Publier les/;

for (const f of ATTENDUS) {
  const lignes = code[f].split('\n');
  const fautives = [];
  lignes.forEach((l, i) => {
    if (!PERMISSIVES.test(l)) return;
    // Contexte : les cinq lignes au-dessus décrivent l'étape.
    const contexte = lignes.slice(Math.max(0, i - 5), i + 1).join('\n');
    if (!ETAPES_AUTORISEES.test(contexte)) fautives.push(`${f}:${i + 1} ${l.trim()}`);
  });
  verifier(fautives.length === 0,
    fautives.length === 0
      ? `${f} : aucune condition permissive hors publication d'artefact`
      : `${f} : condition permissive sur une étape qui garde quelque chose — ${fautives.join(' | ')}`);
}

// La non-régression des 856 doit être jouée des DEUX côtés. Elle a vécu six
// commits hors du dépôt et hors de tout workflow ; la rattacher à un seul
// workflow laisserait la moitié du chemin sans garde.
for (const f of ['validate.yml', 'validate-linux.yml']) {
  verifier(code[f].includes('node test/baseline-856.test.mjs'),
    `${f} joue la non-régression des 856 scripts PowerShell`);
}

// Les bancs PowerShell tournent sous LES DEUX MOTEURS, et avec l'interpréteur
// IMPOSÉ. Un banc lancé sans « --powershell » retomberait sur ce qui traîne, et
// un résultat obtenu sous PowerShell 7 ne dit rien de Windows PowerShell 5.1 —
// ce qui est d'autant plus vrai pour la jonction de domaine, dont l'applet
// n'existe QUE dans 5.1.
for (const banc of ['poste-verrous', 'fiches-poste-b', 'jonction-domaine']) {
  for (const moteur of ['powershell', 'pwsh']) {
    verifier(code['validate.yml'].includes(`node test/${banc}.test.mjs --powershell ${moteur}`),
      `validate.yml joue test/${banc}.test.mjs sous ${moteur}, interpréteur imposé`);
  }
  verifier(!new RegExp(`node test/${banc}\\.test\\.mjs(?!\\s+--powershell)`).test(code['validate.yml']),
    `validate.yml ne lance jamais test/${banc}.test.mjs sans imposer l'interpréteur`);
}

// `|| true` dans un bloc run éteint le code de sortie de la commande.
for (const f of ATTENDUS) {
  verifier(!/\|\|\s*true/.test(code[f]), `${f} ne neutralise aucun code de sortie avec « || true »`);
}

// ===========================================================================
// PLAN 5 — ordre des étapes de la validation Linux
//
// Contrôler des scripts avant de les générer donnerait un contrôle sur un
// dossier vide, et un dossier vide ne fait échouer aucune grep.
// ===========================================================================
console.log('');
console.log('Plan 5 — ordre des étapes');

const lignesLin = code['validate-linux.yml'].split('\n');
const indexDe = (motif) => lignesLin.findIndex((l) => l.includes(motif));

const ORDRE = [
  ['actions/checkout', 'checkout'],
  ['actions/setup-node', 'Node.js'],
  ['npm ci', 'dépendances'],
  ['shellcheck --version', 'version de ShellCheck'],
  ['node test/generate-ps1.mjs', 'génération'],
  ['node test/baseline-856.test.mjs', 'non-régression des 856'],
  ['node test/sh-hygiene.test.mjs', 'hygiène octet'],
  ['node test/shquote.test.mjs', 'shQuote'],
  // Le motif est la COMMANDE, pas le mot : « bash -n » figure aussi dans le
  // nom du job, plus haut dans le fichier, et l'ordre s'y serait trompe.
  ['if ! bash -n', 'bash -n'],
  ['node test/sh-shellcheck.test.mjs', 'porte ShellCheck'],
  ['node test/scanner-bash.test.mjs', 'scanner de sûreté'],
  ['node test/mouchards-linux.test.mjs', 'banc à mouchards'],
  ['node test/stockage-linux.test.mjs', 'banc du stockage'],
  ['node test/quotas-linux.test.mjs', 'banc des quotas'],
  ['node test/raid-linux.test.mjs', 'banc du RAID'],
  ['node test/permissions-linux.test.mjs', 'banc des permissions'],
  ['node test/services-linux.test.mjs', 'banc des services'],
  ['node test/reseau-linux.test.mjs', 'banc du reseau'],
  ['node test/ssh-linux.test.mjs', 'banc de SSH'],
  ['node test/cockpit-linux.test.mjs', 'banc de Cockpit'],
  ['node test/samba-linux.test.mjs', 'banc du partage Samba'],
  ['node test/samba-ad-linux.test.mjs', 'banc de Samba AD'],
  ['node test/nfs-linux.test.mjs', 'banc de NFS'],
  ['node test/commandes-rapides.test.mjs', 'contrat des commandes rapides'],
  ['node test/capacites-linux.test.mjs', 'sonde des capacités'],
  ['node test/dette-6b-format.test.mjs', 'dette 6B'],
  ['node test/netplan-v2.test.mjs', 'Netplan v2'],
  ['node test/negatifs-lot7.test.mjs', 'bancs négatifs LOT 7'],
  ['node test/negatifs-lot7-contre-epreuves.test.mjs', 'contre-épreuves du banc négatif'],
  ['npx playwright install chromium', 'Chromium Playwright (Linux)'],
  ['node test/browser-lot7.test.mjs', 'navigateur LOT 7'],
  ['node test/browser-lot7-contre-epreuves.test.mjs', 'contre-épreuves du navigateur LOT 7'],
  ['node test/matrices-lot7.mjs --verifier', 'matrices du LOT 7'],
  ['node test/ci-workflows.test.mjs', 'lecture des workflows'],
];

let precedent = -1;
let precedentNom = 'début du fichier';
for (const [motif, nom] of ORDRE) {
  const i = indexDe(motif);
  if (i === -1) { fail(`étape « ${nom} » absente de validate-linux.yml`); continue; }
  verifier(i > precedent, `« ${nom} » vient après « ${precedentNom} »`);
  precedent = i;
  precedentNom = nom;
}

// Et le banc refuse un dossier vide : l'étape bash -n sort 1 si total == 0.
verifier(/total.*-eq 0/s.test(code['validate-linux.yml']),
  'l\'étape bash -n échoue si aucun script n\'a été généré');

// ===========================================================================
// PLAN 6 — contre-épreuves : le banc doit VOIR les trois fautes
//
// Chacune est injectée dans une copie en mémoire, et le contrôle correspondant
// est rejoué. S'il reste vert, c'est le contrôle qui est en cause.
// ===========================================================================
console.log('');
console.log('Plan 6 — contre-épreuves');

// 6.1 — un continue-on-error ajouté
const fauxCoe = code['validate-linux.yml'].replace(
  '      - name: Porte ShellCheck',
  '      - name: Porte ShellCheck\n        continue-on-error: true',
);
verifier(/continue-on-error/i.test(fauxCoe), 'contre-épreuve 1 : un continue-on-error injecté est bien vu');

// 6.2 — le déploiement ne dépendant plus que de Windows
const fauxNeeds = lireYaml(texte['deploy-pages.yml'].replace(
  'needs: [validate, validate-linux]', 'needs: validate',
));
const needsFaux = Array.isArray(fauxNeeds.jobs?.deploy?.needs)
  ? fauxNeeds.jobs.deploy.needs
  : [String(fauxNeeds.jobs?.deploy?.needs ?? '')];
verifier(!needsFaux.includes('validate-linux'),
  'contre-épreuve 2 : un déploiement qui perd la dépendance Linux est bien détecté');
verifier(needsFaux.includes('validate'),
  'contre-épreuve 2 bis : le lecteur lit correctement un needs scalaire (pas un faux négatif de lecture)');

// 6.3 — une condition permissive sur une étape qui garde quelque chose
const fauxIf = code['validate-linux.yml'].replace(
  '        run: node test/sh-shellcheck.test.mjs',
  '        if: always()\n        run: node test/sh-shellcheck.test.mjs',
);
const lignesFausses = fauxIf.split('\n');
const vues = [];
lignesFausses.forEach((l, i) => {
  if (!PERMISSIVES.test(l)) return;
  const contexte = lignesFausses.slice(Math.max(0, i - 5), i + 1).join('\n');
  if (!ETAPES_AUTORISEES.test(contexte)) vues.push(i + 1);
});
verifier(vues.length === 1,
  vues.length === 1
    ? 'contre-épreuve 3 : un « if: always() » posé sur la porte ShellCheck est bien refusé'
    : `contre-épreuve 3 : ${vues.length} détection(s) au lieu d'une — le filtre est mal calibré`);

// 6.4 — le lecteur YAML voit-il réellement une structure, ou dit-il oui à tout ?
const essai = lireYaml([
  'on:',
  '  push:',
  '    branches: [main, "claude/**"]',
  'jobs:',
  '  a:',
  '    uses: ./.github/workflows/validate.yml',
  '  b:',
  '    needs: [a]',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: un',
  '        run: echo un',
  '      - name: deux',
  '        run: echo deux',
].join('\n'));
verifier(JSON.stringify(essai.on?.push?.branches) === JSON.stringify(['main', 'claude/**']),
  'contre-épreuve 4 : le lecteur rend bien une liste en ligne');
verifier(essai.jobs?.a?.uses === './.github/workflows/validate.yml',
  'contre-épreuve 4 bis : le lecteur rend bien un scalaire imbriqué');
verifier(Array.isArray(essai.jobs?.b?.steps) && essai.jobs.b.steps.length === 2,
  'contre-épreuve 4 ter : le lecteur rend bien une liste d\'étapes');
verifier(essai.jobs?.b?.if === undefined,
  'contre-épreuve 4 quater : le lecteur ne fabrique pas une clef absente');

// 6.5 — un fichier de workflow nouveau ne doit pas échapper au contrôle.
const tous = readdirSync(WF).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
verifier(JSON.stringify(tous) === JSON.stringify([...ATTENDUS].sort()),
  tous.length === ATTENDUS.length
    ? 'contre-épreuve 5 : les workflows présents sont exactement ceux contrôlés'
    : `contre-épreuve 5 : workflow non contrôlé — présents ${tous.join(', ')}`);

// ===========================================================================
console.log('');
console.log(`Workflows : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
if (echecs.length > 0) {
  console.error('');
  console.error('Ce banc ne dit rien de ce que GitHub Actions fera réellement : il lit');
  console.error('des fichiers. Une exécution verte sur GitHub reste la seule preuve');
  console.error('qu\'un workflow tourne, et elle demande un push.');
}
process.exit(echecs.length === 0 ? 0 : 1);
