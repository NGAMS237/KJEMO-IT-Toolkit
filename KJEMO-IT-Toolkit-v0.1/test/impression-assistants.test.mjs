#!/usr/bin/env node
/**
 * impression-assistants.test.mjs — LOT 9 · Imprimantes · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Banc des 15 assistants Imprimantes (11 Windows / PowerShell, 4 Linux / CUPS).
 *
 * NIVEAUX DE PREUVE, NE JAMAIS CONFONDUS
 *
 *   STATIQUE   contrats de fiche, validateurs, analyse syntaxique PowerShell
 *              (pwsh), `bash -n` et ShellCheck. Rien n'est exécuté.
 *   DOUBLES    les scripts PowerShell sont EXÉCUTÉS par PowerShell 7 sous Linux
 *              avec des doubles des cmdlets PrintManagement ; les scripts Bash
 *              sont EXÉCUTÉS par bash avec de faux binaires CUPS. Ces doubles
 *              journalisent chaque appel : le banc établit ce que le script
 *              APPELLE, dans quel ordre, et ce qu'il CONCLUT. Il n'établit rien
 *              sur un vrai spouleur, un vrai cupsd ou une vraie imprimante.
 *   RÉEL       NON EXÉCUTÉ. Aucune imprimante, aucun serveur d'impression,
 *              aucun Windows PowerShell 5.1, aucun cupsd réel n'a été utilisé.
 *              Les trois travaux pratiques de docs/labs-imprimantes/ restent
 *              à faire par l'étudiant.
 *
 * CONTRE-ÉPREUVES. Un contrôle qui n'a jamais échoué ne prouve rien : chaque
 * détecteur de ce banc (appel interdit, garde retirée, conclusion trompeuse)
 * est éprouvé sur un script volontairement fautif, et le banc exige que la
 * faute soit DÉTECTÉE.
 *
 * Une détection textuelle des secrets reste une heuristique : ce banc ne la
 * présente pas comme une garantie universelle.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0;
const echecs = [];
const assert = (cond, msg) => {
  if (cond) { ok += 1; console.log(`  [OK]    ${msg}`); }
  else { echecs.push(msg); console.log(`  [FAIL]  ${msg}`); }
};
const section = (t) => console.log(`\n--- ${t} ---`);
const imp = (f) => import(pathToFileURL(join(ROOT, f)).href);

const { tools } = await imp('dist/generators.mjs');
const V = await imp('dist/validateurs-impression.mjs');
const { SOUS_RUBRIQUES_IMPRESSION } = await imp('dist/categories.mjs');
const { VERSION_IMPRESSION, CHAMPS_IMPRESSION_BLOC } = await imp('dist/noyau-impression.mjs');
const D = await imp('test/impression-doubles.mjs');
const C = await imp('test/impression-doubles-cups.mjs');
const F = await imp('test/impression-fixtures.mjs');

const imprimantes = tools.filter((t) => t.category === 'Imprimantes');
const win = imprimantes.filter((t) => t.platform === 'Windows');
const cups = imprimantes.filter((t) => t.platform === 'Linux');
const lecturesWin = win.filter((t) => t.risk === 'diagnostic');
const actionsWin = win.filter((t) => t.risk !== 'diagnostic');
const actionsCups = cups.filter((t) => t.risk !== 'diagnostic');
const parId = Object.fromEntries(imprimantes.map((t) => [t.id, t]));

const VERBES = ['cancel', 'cupsenable', 'cupsaccept'];
const pwshDispo = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
const PWSH = pwshDispo.status === 0 ? pwshDispo.stdout.trim() : null;

// ===========================================================================
section('Catalogue : 15 assistants, 5 sous-rubriques, 22 champs de fiche');
// ===========================================================================
{
  const CHAMPS_FICHE = ['id', 'icon', 'category', 'subcategory', 'title', 'risk', 'summary',
    'fields', 'validate', 'generate', 'gui', 'keywords', 'requiresAdmin', 'os', 'prereqs',
    'commonErrors', 'reversible', 'verifyAfter', 'rollback', 'checks', 'source', 'sources'];
  assert(imprimantes.length === 15, `15 assistants Imprimantes (${imprimantes.length})`);
  assert(win.length === 11 && cups.length === 4, `11 Windows + 4 CUPS (${win.length} + ${cups.length})`);
  assert(new Set(imprimantes.map((t) => t.id)).size === 15, 'identifiants distincts');
  assert(new Set(imprimantes.map((t) => t.title)).size === 15, 'titres distincts');
  assert(SOUS_RUBRIQUES_IMPRESSION.length === 5, '5 sous-rubriques déclarées');
  assert(imprimantes.every((t) => SOUS_RUBRIQUES_IMPRESSION.includes(t.subcategory)), 'chaque assistant tient dans une sous-rubrique déclarée');
  assert(SOUS_RUBRIQUES_IMPRESSION.every((s) => imprimantes.some((t) => t.subcategory === s)), 'chaque sous-rubrique déclarée contient au moins un assistant');
  for (const t of imprimantes) {
    assert(CHAMPS_FICHE.every((k) => k in t), `${t.id} : les 22 champs du contrat de fiche sont présents`);
    assert(t.sources.length >= 2 && t.sources.every((s) => /^https:\/\//.test(s.url) && s.label), `${t.id} : au moins 2 sources HTTPS titrées`);
    assert(t.sources.every((s) => /^https:\/\/(learn\.microsoft\.com|openprinting\.github\.io|www\.cups\.org)\//.test(s.url)), `${t.id} : sources officielles Microsoft ou OpenPrinting/CUPS uniquement`);
    assert(CHAMPS_IMPRESSION_BLOC.every((k) => t.impression?.[k] !== undefined && String(t.impression[k]).length > 0), `${t.id} : bloc pédagogique complet (problème, exemple, première vérification, ce qui est lu/écrit, effets, limites)`);
    assert(Array.isArray(t.impression.limites) && t.impression.limites.length >= 2, `${t.id} : au moins deux limites déclarées`);
    assert(!t.fields.some((f) => f.type === 'password' || /mot de passe|password|secret|jeton|token/i.test(`${f.id} ${f.label}`)),
      `${t.id} : aucun champ de mot de passe, de secret ou de jeton`);
    assert(!/\brepar[ée]|\bfonctionne\b|\bgarantit/i.test(`${t.title} ${t.summary}`), `${t.id} : ni « réparé » ni « fonctionne » ni « garantit » dans le titre ou le résumé`);
    assert(t.verifyAfter.length >= 1 && t.checks.length >= 1, `${t.id} : vérifications après action et contrôles déclarés`);
  }
  assert(lecturesWin.length === 5 && actionsWin.length === 6, `5 lectures + 6 actions Windows (${lecturesWin.length} + ${actionsWin.length})`);
  assert(cups.filter((t) => t.risk === 'diagnostic').length === 2 && actionsCups.length === 2, '2 lectures + 2 actions CUPS');
  assert(actionsWin.every((t) => t.fields.some((f) => f.id === 'impMode' && f.default === 'Diagnostic')), 'toute action Windows démarre en mode Diagnostic');
  assert(actionsWin.concat(actionsCups).every((t) => t.fields.some((f) => f.id === 'impConfirmation' && f.default === '')), 'toute action démarre sans confirmation');
  assert(['imp-win-config-reseau', 'imp-win-spouleur-redemarrer'].every((id) => parId[id].requiresAdmin === true), 'création de port/imprimante et redémarrage du spouleur : administrateur');
  assert(['imp-win-connexion-partage', 'imp-win-defaut', 'imp-win-page-test', 'imp-win-annuler-travail'].every((id) => parId[id].requiresAdmin === false),
    'connexion partagée, imprimante par défaut, page de test et annulation de son travail : compte courant, jamais élevé');
  assert(['imp-win-page-test', 'imp-win-annuler-travail', 'imp-win-spouleur-redemarrer', 'imp-cups-annuler-travail'].every((id) => parId[id].reversible === false),
    'une page imprimée, un travail annulé, un spouleur redémarré ne sont PAS présentés comme réversibles');
  assert(cups.every((t) => t.output === '.sh') && win.every((t) => t.output === '.ps1'), 'sorties : .ps1 pour Windows, .sh pour CUPS');
}

// ===========================================================================
section('Validateurs : refus des entrées dangereuses, acceptation des entrées légitimes');
// ===========================================================================
{
  const refus = (fn, v, label) => assert(fn(v).ok === false, `${label} refusé : ${JSON.stringify(v).slice(0, 60)}`);
  const accepte = (fn, v, label) => assert(fn(v).ok === true, `${label} accepté : ${JSON.stringify(v).slice(0, 60)}`);
  // --- Nom d'imprimante Windows
  for (const v of ['HP LaserJet Accueil', 'Compta (Etage 2)', 'Imprimante#3', 'Xerox-WC_7845.v2', 'é Étage']) accepte(V.validerNomImprimante, v, 'nom d’imprimante');
  const hostiles = [
    '', '   ', 'HP*', 'HP?', '*', 'a;b', 'a,b', 'a|b', 'a&b', 'a`b', 'a$b', 'a$(Get-Date)', "a'b", 'a"b', 'a\nb', 'a\rb', 'a\tb', 'a\u0000b', 'a\u2028b',
    '\\\\srv\\file', 'a/b', '../x', '-Force', ' leading', '.début', 'x'.repeat(221), 'password=abc', 'ipp://user:secret@host/printers/x',
  ];
  for (const v of hostiles) {
    if (v === ' leading') continue; // rogné : validé plus bas
    refus(V.validerNomImprimante, v, 'nom d’imprimante');
  }
  assert(V.validerNomImprimante('  HP Laser  ').value === 'HP Laser', 'les espaces de tête et de queue sont rognés, pas conservés');
  // --- Port, pilote
  for (const v of ['IP_192.168.30.50', 'TCPPort:9100', 'USB001']) accepte(V.validerNomPort, v, 'nom de port');
  for (const v of ['', 'a b', 'a;b', 'a$b', 'a\nb', '-x', 'x'.repeat(65)]) refus(V.validerNomPort, v, 'nom de port');
  accepte(V.validerNomPilote, 'Microsoft IPP Class Driver', 'pilote');
  accepte(V.validerNomPilote, 'HP Universal Printing PCL 6 (v7.0.1)', 'pilote');
  for (const v of ['', 'Driver*', 'a;b', 'a$(x)', 'a"b', 'a\nb', 'a`b']) refus(V.validerNomPilote, v, 'pilote');
  // --- Hôte
  for (const v of ['192.168.30.50', '10.0.0.5', 'imprimante-accueil', 'imp01.labo.local']) accepte(V.validerHoteImprimante, v, 'hôte');
  for (const v of ['', '0.0.0.0', '127.0.0.1', '224.0.0.1', '255.255.255.255', '169.254.1.1', '999.1.1.1', '192.168.1', 'a b', 'a;b', 'a$b', 'host/x', 'user:pw@host', '-host', 'a\nb', 'a..b', 'http://192.168.1.5'])
    refus(V.validerHoteImprimante, v, 'hôte');
  // --- UNC
  for (const v of ['\\\\srv-print\\Compta', '\\\\192.168.30.60\\Compta', '\\\\srv-print.labo.local\\HP Accueil']) accepte(V.validerUncImprimante, v, 'UNC');
  for (const v of ['', 'srv-print\\Compta', '\\\\srv-print', '\\\\srv-print\\', '\\\\srv-print\\a\\b', '//srv/x', '\\\\srv;x\\a', '\\\\srv\\a$(x)', '\\\\srv\\a\nb', '\\\\srv\\*', '\\\\?\\C:\\x', '\\\\127.0.0.1\\x', '\\\\srv\\a"b'])
    refus(V.validerUncImprimante, v, 'UNC');
  // --- Identifiant de travail, port TCP, protocole
  for (const v of ['1', '42', '99999']) accepte(V.validerIdTravail, v, 'identifiant de travail');
  for (const v of ['', '0', '-1', '1.5', 'a', '1;2', '1 2', '*', '1\n2', '4294967296', '1e3']) refus(V.validerIdTravail, v, 'identifiant de travail');
  for (const v of ['9100', '515', '631', '1', '65535']) accepte(V.validerPortTcpImpression, v, 'port TCP');
  for (const v of ['', '0', '65536', '-1', '9100;1', 'abc', '9 100', '91.5']) refus(V.validerPortTcpImpression, v, 'port TCP');
  for (const p of ['RAW', 'LPR', 'IPP', 'IPPS', 'SMB']) assert(V.validerProtocoleImpression(p).ok, `protocole ${p} accepté`);
  for (const p of ['raw', 'FTP', '', 'RAW;x']) assert(V.validerProtocoleImpression(p).ok === false, `protocole refusé : ${JSON.stringify(p)}`);
  assert(V.PROTOCOLES_IMPRESSION.RAW.port === 9100 && V.PROTOCOLES_IMPRESSION.LPR.port === 515 && V.PROTOCOLES_IMPRESSION.IPP.port === 631
    && V.PROTOCOLES_IMPRESSION.IPPS.port === 443 && V.PROTOCOLES_IMPRESSION.SMB.port === 445, 'ports par défaut des protocoles : 9100, 515, 631, 443, 445');
  // --- CUPS
  for (const v of ['HP_LaserJet_Accueil', 'Compta', 'PDF.virtuel-2', 'a']) accepte(V.validerDestinationCups, v, 'destination CUPS');
  for (const v of ['', 'a b', '-o', '--all', 'a;b', 'a$(x)', 'a`b', 'a"b', "a'b", 'a\nb', 'a*', 'a/b', '../x', '.x', 'x'.repeat(130)]) refus(V.validerDestinationCups, v, 'destination CUPS');
  // --- Secrets : heuristique, jamais une garantie
  for (const v of ['ipp://admin:hunter2@192.168.1.5/ipp', 'password: abc', 'mot de passe 1234', 'token=abcd', 'Bearer abcdefghijklmnop', '-----BEGIN RSA PRIVATE KEY-----'])
    assert(V.secretsDansImpression(v).length > 0, `secret reconnu : ${v.slice(0, 40)}`);
  assert(V.secretsDansImpression('HP LaserJet Accueil').length === 0, 'un nom ordinaire n’est pas pris pour un secret');
  assert(V.secretsDansImpression('xK9#mP2$vL8@nQ4!').length === 0,
    'LIMITE DÉCLARÉE : un mot de passe aléatoire sans mot-clé N’EST PAS reconnu — la détection est une heuristique, pas une garantie');
}

// ===========================================================================
section('Validation des fiches : champ vide, hostile, injection — aucun script produit');
// ===========================================================================
{
  const hostilesNom = ['HP"; Remove-Printer -Name * #', 'HP`nRemove-Item', 'HP$(Start-Process calc)', 'HP\nRemove-Printer *', "HP' ; calc ; '", '*', 'HP*'];
  for (const t of win.filter((x) => x.fields.some((f) => f.id === 'impNom'))) {
    for (const h of hostilesNom) {
      const v = F.valeurs(t, { extra: { impNom: h, ...F.cas(t).extra } });
      assert(Object.keys(t.validate(v)).length > 0, `${t.id} : nom hostile refusé par validate (${JSON.stringify(h).slice(0, 40)})`);
      let leve = false; try { t.generate(v); } catch { leve = true; }
      assert(leve, `${t.id} : generate() refuse de produire un script (${JSON.stringify(h).slice(0, 40)})`);
    }
  }
  for (const t of cups.filter((x) => x.fields.some((f) => f.id === 'impDest'))) {
    for (const h of ['HP; cancel -a', 'HP$(id)', '-o', 'HP\nlprm -', 'a b', '*']) {
      const v = F.valeurs(t, { extra: { impDest: h } });
      let leve = false; try { t.generate(v); } catch { leve = true; }
      assert(leve && Object.keys(t.validate(v)).length > 0, `${t.id} : destination hostile refusée (${JSON.stringify(h).slice(0, 30)})`);
    }
  }
  // La phrase de confirmation ne peut pas être détournée : une phrase presque juste est refusée par la fiche elle-même.
  for (const t of actionsWin) {
    const bonne = F.phraseDe(t, F.valeurs(t, { extra: F.cas(t).extra }));
    assert(bonne !== null && bonne.length > 10, `${t.id} : la fiche annonce une phrase de confirmation nominative (« ${bonne} »)`);
    const v = F.valeurs(t, { mode: 'Appliquer', extra: F.cas(t).extra, confirmation: bonne.toLowerCase() });
    assert(t.validate(v).impConfirmation !== undefined, `${t.id} : phrase en minuscules refusée en mode Appliquer`);
    const v2 = F.valeurs(t, { mode: 'Appliquer', extra: F.cas(t).extra, confirmation: `${bonne} ` });
    assert(t.validate(v2).impConfirmation !== undefined, `${t.id} : phrase avec espace final refusée en mode Appliquer`);
    const v3 = F.valeurs(t, { mode: 'Appliquer', extra: F.cas(t).extra, confirmation: 'oui' });
    assert(t.validate(v3).impConfirmation !== undefined, `${t.id} : « oui » refusé en mode Appliquer`);
    const v4 = F.valeurs(t, { mode: 'Diagnostic', extra: F.cas(t).extra, confirmation: 'ANNULER TOUT' });
    assert(t.validate(v4).impConfirmation !== undefined, `${t.id} : une phrase qui ne correspond pas à la cible est refusée même en Diagnostic`);
  }
}

// ===========================================================================
section('Analyse statique : PowerShell (pwsh), bash -n, ShellCheck — ce n’est PAS une exécution sous Windows PowerShell 5.1');
// ===========================================================================
const DOSSIER = mkdtempSync(join(tmpdir(), 'kjemo-imp-statique-'));
const JEUX = [
  { nom: 'defaut', extra: (t) => F.cas(t).extra },
  { nom: 'espaces', extra: (t) => (t.fields.some((f) => f.id === 'impNom') ? { impNom: 'HP LaserJet Étage 2 (Compta)', ...F.cas(t).extra } : F.cas(t).extra) },
];
try {
  const fichiersPs = [];
  const fichiersSh = [];
  for (const t of imprimantes) {
    for (const j of JEUX) {
      const v = F.valeurs(t, { extra: j.extra(t) });
      const s = t.generate(v);
      const f = join(DOSSIER, `${t.id}__${j.nom}${t.output}`);
      writeFileSync(f, s, 'utf8');
      (t.output === '.ps1' ? fichiersPs : fichiersSh).push(f);
      if (t.risk !== 'diagnostic') {
        const va = F.valeurs(t, { mode: 'Appliquer', extra: j.extra(t) });
        const fa = join(DOSSIER, `${t.id}__${j.nom}__appliquer${t.output}`);
        writeFileSync(fa, t.generate(va), 'utf8');
        (t.output === '.ps1' ? fichiersPs : fichiersSh).push(fa);
      }
    }
  }
  if (PWSH) {
    writeFileSync(join(DOSSIER, 'parse.ps1'), `param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Fichiers)
$total = 0
foreach ($f in $Fichiers) {
  $tok = $null; $err = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$tok, [ref]$err)
  if ($err.Count -gt 0) { Write-Output ('ERREUR ' + $f + ' : ' + $err[0].Message) } else { $total++ }
}
Write-Output ('SYNTAXE_OK ' + $total)`);
    const r = spawnSync('pwsh', ['-NoProfile', '-File', join(DOSSIER, 'parse.ps1'), ...fichiersPs], { encoding: 'utf8' });
    assert(r.stdout.includes(`SYNTAXE_OK ${fichiersPs.length}`) && !/ERREUR/.test(r.stdout), `${fichiersPs.length} scripts PowerShell sont syntaxiquement valides (analyseur de PowerShell ${PWSH})`);
    // Contre-épreuve : l'analyseur sait dire non.
    writeFileSync(join(DOSSIER, 'casse.ps1'), 'function X { if ($a -eq ) { } ');
    const rc = spawnSync('pwsh', ['-NoProfile', '-File', join(DOSSIER, 'parse.ps1'), join(DOSSIER, 'casse.ps1')], { encoding: 'utf8' });
    assert(/ERREUR/.test(rc.stdout), 'contre-épreuve : l’analyseur signale un script PowerShell cassé');
  } else {
    console.log('  [NON EXÉCUTÉ] pwsh absent : analyse syntaxique PowerShell non faite.');
  }
  let bashOk = 0; let bashKo = 0;
  for (const f of fichiersSh) { const r = spawnSync('bash', ['-n', f], { encoding: 'utf8' }); if (r.status === 0) bashOk += 1; else { bashKo += 1; console.log(`    bash -n ${f}: ${r.stderr}`); } }
  assert(bashKo === 0 && bashOk === fichiersSh.length, `${bashOk} scripts Bash passent « bash -n »`);
  const sc = spawnSync('shellcheck', ['--version'], { encoding: 'utf8' });
  if (sc.status === 0) {
    const r = spawnSync('shellcheck', ['-s', 'bash', ...fichiersSh], { encoding: 'utf8' });
    assert(r.status === 0, `ShellCheck ne signale rien sur ${fichiersSh.length} scripts Bash${r.status === 0 ? '' : ` : ${r.stdout.slice(0, 400)}`}`);
    writeFileSync(join(DOSSIER, 'mauvais.sh'), '#!/usr/bin/env bash\nrm -rf $1/*\n');
    assert(spawnSync('shellcheck', ['-s', 'bash', join(DOSSIER, 'mauvais.sh')], { encoding: 'utf8' }).status !== 0, 'contre-épreuve : ShellCheck signale un script fautif');
  } else console.log('  [NON EXÉCUTÉ] shellcheck absent.');
} finally {
  rmSync(DOSSIER, { recursive: true, force: true });
}

// ===========================================================================
section('Contenu des scripts : arbre syntaxique PowerShell, texte Bash — aucune commande interdite, aucune écriture hors périmètre');
// ===========================================================================
// PowerShell : on lit l'ARBRE SYNTAXIQUE (commandes appelées + paramètres passés). Une phrase d'explication qui
// cite « Remove-Printer » n'est pas un appel ; un appel l'est, quelle que soit sa mise en forme.
// Bash : on retire les commentaires, puis les chaînes des lignes qui ne font qu'AFFICHER (kjemo_resultat, printf, echo),
// parce que les messages de conseil citent des commandes (« apt install cups-client », « lpadmin ») sans les appeler.
function sansTextesBash(s) {
  const lignes = s.split('\n');
  let continuation = false;
  return lignes.filter((l) => !/^\s*#/.test(l)).map((l) => {
    const affiche = continuation || /^\s*(kjemo_resultat|printf|echo)\b/.test(l);
    continuation = affiche && /\\\s*$/.test(l);
    return affiche ? l.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""') : l;
  }).join('\n');
}
const sansCommentairesSh = sansTextesBash;
const INTERDITS_SH = [
  [/\blpadmin\b/, 'lpadmin'], [/\bcupsctl\b/, 'cupsctl'], [/\blprm\b/, 'lprm'], [/\blpmove\b/, 'lpmove'], [/\bcancel\s+(-a|-x|-u)\b/, 'cancel en masse'],
  [/\/var\/spool\/cups/, 'spool CUPS'], [/\/etc\/cups\b/, '/etc/cups'], [/cupsd\.conf/, 'cupsd.conf'], [/\bListen\b|\bPort\s+631\b|WebInterface|Allow\s+@LOCAL|Browsing\s+On/, 'ouverture réseau de CUPS'],
  [/\bsystemctl\s+(restart|stop|start|reload|enable|disable|mask|kill)\b/, 'systemctl modifiant'], [/\bservice\s+cups\b/, 'service cups'],
  [/\brm\s+-[rf]+\s+(\/|\$\{?HOME)/, 'rm de zone sensible'], [/\bcurl\b|\bwget\b|\bapt(-get)?\s+install\b|\bdnf\s+install\b|\bpip\b/, 'téléchargement ou installation'],
  [/\bsudo\b|\bsu\s+-/, 'élévation dans le script'], [/\beval\b/, 'eval'], [/\bchmod\b|\bchown\b/, 'chmod/chown'], [/\bcupsdisable\b|\bcupsreject\b/, 'désactivation de file'],
];
const BLANCHE = {
  'imp-win-annuler-travail': ['Remove-PrintJob'], 'imp-win-config-reseau': ['Add-PrinterPort', 'Add-Printer'],
  'imp-win-connexion-partage': ['Add-Printer'], 'imp-win-defaut': ['Invoke-CimMethod'], 'imp-win-page-test': ['Invoke-CimMethod'],
  'imp-win-spouleur-redemarrer': ['Restart-Service'],
};
const ECRITURES_PS = /^(Add|Remove|Restart|Invoke|Set|Start|Stop|New|Clear|Export|Register|Enable|Disable|Rename|Move|Copy|Out)-/i;
const NEUTRES_PS = ['Add-KjemoResultat', 'Add-KjemoContexte', 'Add-KjemoCibleImprimante', 'Invoke-KjemoLecture', 'Invoke-KjemoControle', 'New-Object', 'Set-Content', 'Export-Csv', 'Add-Member', 'Start-Sleep', 'New-TimeSpan', 'Out-String', 'Out-Null', 'Out-File'];
const analyses = {};
{
  for (const t of win) {
    for (const mode of (t.risk === 'diagnostic' ? ['Diagnostic'] : ['Diagnostic', 'Appliquer'])) {
      const s = t.generate(F.valeurs(t, { mode, extra: F.cas(t).extra }));
      const a = D.analyserPs(s);
      analyses[`${t.id}/${mode}`] = a;
      const v = D.violationsPs(a);
      assert(v.length === 0, `${t.id} (${mode}) : arbre syntaxique sans commande ni paramètre interdit${v.length ? ` — ${v.join(' ; ')}` : ''}`);
      const ecritures = a.uniques.filter((c) => ECRITURES_PS.test(c) && !NEUTRES_PS.includes(c)).sort();
      const attendu = (BLANCHE[t.id] ?? []).slice().sort();
      assert(JSON.stringify(ecritures) === JSON.stringify(attendu), `${t.id} (${mode}) : seules les cmdlets d’écriture annoncées sont appelées : [${attendu.join(', ')}] (vu : [${ecritures.join(', ')}])`);
      assert(a.dynamiques.length >= 1 && a.dynamiques.every((d) => /^&\s*\$Action$/.test(d.trim())), `${t.id} (${mode}) : le seul appel dynamique est « & $Action » (enveloppe de lecture)`);
      assert(!/\r/.test(s), `${t.id} (${mode}) : fins de ligne LF`);
    }
  }
  for (const t of cups) {
    for (const vals of (t.risk === 'diagnostic' ? [{}] : [{ impConfirmation: '' }])) {
      const variantes = t.id === 'imp-cups-reactiver-file' ? [{ impAction: 'Reactiver' }, { impAction: 'Accepter' }] : [{}];
      for (const extra of variantes) {
        const s = t.generate(F.valeurs(t, { extra: { ...vals, ...extra } }));
        const code = sansTextesBash(s);
        const trouves = INTERDITS_SH.filter(([re]) => re.test(code)).map(([, n]) => n);
        assert(trouves.length === 0, `${t.id}${extra.impAction ? ` (${extra.impAction})` : ''} : aucune commande interdite${trouves.length ? ` — trouvé : ${trouves.join(', ')}` : ''}`);
        assert(!/[^\x00-\x7f]/.test(s), `${t.id}${extra.impAction ? ` (${extra.impAction})` : ''} : script Bash entièrement ASCII (hygiène sh)`);
        assert(!/\r/.test(s), `${t.id} : fins de ligne LF`);
      }
    }
  }
  // Verbes d'écriture CUPS, par assistant et par action.
  const verbesDe = (t, extra) => {
    const src = t.generate(F.valeurs(t, { extra }));
    const nus = sansTextesBash(src);
    // Appel direct (cancel) OU verbe choisi par la fiche dans KJEMO_VERBE, appelé via "${KJEMO_VERBE}" après contrôle de liste blanche.
    const directs = ['cancel', 'cupsenable', 'cupsaccept'].filter((c) => new RegExp(`(^|[\\s;(])${c}\\s`, 'm').test(nus));
    const m = /KJEMO_VERBE='(cupsenable|cupsaccept)'/.exec(src);
    return m ? [...directs, m[1]] : directs;
  };
  assert(JSON.stringify(verbesDe(parId['imp-cups-annuler-travail'], {})) === JSON.stringify(['cancel']), 'imp-cups-annuler-travail : seul « cancel » écrit');
  assert(JSON.stringify(verbesDe(parId['imp-cups-reactiver-file'], { impAction: 'Reactiver' })) === JSON.stringify(['cupsenable']), 'imp-cups-reactiver-file (Réactiver) : seul « cupsenable » écrit');
  assert(JSON.stringify(verbesDe(parId['imp-cups-reactiver-file'], { impAction: 'Accepter' })) === JSON.stringify(['cupsaccept']), 'imp-cups-reactiver-file (Accepter) : seul « cupsaccept » écrit');
  assert(verbesDe(parId['imp-cups-inventaire'], {}).length === 0 && verbesDe(parId['imp-cups-diagnostic-file'], {}).length === 0, 'les deux lectures CUPS n’ont aucun verbe d’écriture');
  // Annuler un travail : jamais l'option de masse, toujours un identifiant précis.
  const cancelSrc = sansTextesBash(parId['imp-cups-annuler-travail'].generate(F.valeurs(parId['imp-cups-annuler-travail'])));
  assert(/cancel "\$\{KJEMO_JOB_ID\}"/.test(cancelSrc), 'cancel est appelé avec UN identifiant exact entre guillemets');
  assert(!/cancel\s+-/.test(cancelSrc), 'cancel n’est jamais appelé avec une option');
  // Le lien sémantique avec l'arbre : le détecteur ne s'alarme pas sur les chaînes qui citent des commandes interdites.
  const citant = analyserCitation();
  assert(citant.texte.includes('Remove-Printer') && D.violationsPs(citant.analyse).length === 0, 'le détecteur d’arbre ne confond pas une phrase qui cite « Remove-Printer » avec un appel');
}
function analyserCitation() {
  const texte = "Write-Host 'Ce script n utilise jamais Remove-Printer, Stop-Service ni -Force'\n# Remove-Item serait interdit ici\n";
  return { texte, analyse: D.analyserPs(texte) };
}

// ===========================================================================
section('Windows — EXÉCUTION AVEC DOUBLES : un diagnostic ne fait AUCUN appel modifiant');
// ===========================================================================
const TOUS_MODES_DIAG = [];
if (!PWSH) {
  console.log('  [NON EXÉCUTÉ] pwsh absent : toute la section « exécution avec doubles » (Windows) est sautée.');
} else {
  const SIM_AUTORISEES = ['Add-PrinterPort', 'Remove-PrintJob', 'Restart-Service'];
  for (const t of win) {
    const c = F.cas(t);
    const r = D.executer(t.generate(F.valeurs(t, { extra: c.extra })), c.scenario);
    TOUS_MODES_DIAG.push([t.id, r]);
    assert(r.statut === 0 && r.conclusion !== null, `${t.id} : le script s’exécute jusqu’à sa conclusion (statut ${r.statut}${r.erreur ? `, stderr: ${r.erreur.slice(0, 120)}` : ''})`);
    assert(r.modifiants.length === 0, `${t.id} (défaut, Diagnostic) : ZÉRO appel modifiant${r.modifiants.length ? ` — vu : ${r.modifiants.map((a) => a.cmd).join(', ')}` : ''}`);
    assert(r.simulations.every((a) => SIM_AUTORISEES.includes(a.cmd)), `${t.id} : seules ${SIM_AUTORISEES.join('/')} sont simulées avec -WhatIf (vu : ${[...new Set(r.simulations.map((a) => a.cmd))].join(', ') || 'aucune'})`);
    assert(!r.appels.some((a) => ['Add-Printer', 'Invoke-CimMethod'].includes(a.cmd) && a.whatif), `${t.id} : aucun -WhatIf inventé sur Add-Printer ni Invoke-CimMethod`);
    assert(D.MOTS_INTERDITS_CONCLUSION.every((re) => !re.test(r.conclusion ?? '')), `${t.id} : la conclusion ne dit jamais « réparé » ni « l’imprimante fonctionne »`);
    assert(!/-Force/.test(JSON.stringify(r.appels)), `${t.id} : aucun appel avec -Force`);
  }
  // Une lecture seule ne contient aucun mode ni confirmation : elle ne peut pas agir.
  for (const t of lecturesWin) assert(!t.fields.some((f) => ['impMode', 'impConfirmation'].includes(f.id)), `${t.id} : aucune lecture ne porte de mode Appliquer ni de confirmation`);
  // Les lectures nomment explicitement ce qu'elles ne prouvent pas.
  for (const [id, r] of TOUS_MODES_DIAG) {
    if (parId[id].risk === 'diagnostic') assert(/ne prouve|ne couvre que|aucune conclusion|pas qu une page/i.test(r.conclusion) || /point\(s\) a examiner/i.test(r.conclusion), `${id} : la conclusion ne déborde pas ses preuves`);
  }
  // Nominal : ce que dit le scénario sain.
  const nominal = Object.fromEntries(TOUS_MODES_DIAG);
  assert(/n ont signale aucun point/.test(nominal['imp-win-inventaire'].conclusion), 'imp-win-inventaire : scénario sain → « aucun point », avec la réserve sur « Normal » et le ping');
  assert(/pas qu une page s imprimera/.test(nominal['imp-win-inventaire'].conclusion), 'imp-win-inventaire : la réserve « n’imprime pas forcément » est dans la conclusion');
}

// ===========================================================================
section('Windows — EXÉCUTION AVEC DOUBLES : sans confirmation exacte, aucune action (mode Appliquer)');
// ===========================================================================
const ACTION_ATTENDUE = {
  'imp-win-annuler-travail': ['Remove-PrintJob'],
  'imp-win-config-reseau': ['Add-PrinterPort', 'Add-Printer'],
  'imp-win-connexion-partage': ['Add-Printer'],
  'imp-win-defaut': ['Invoke-CimMethod'],
  'imp-win-page-test': ['Invoke-CimMethod'],
  'imp-win-spouleur-redemarrer': ['Restart-Service'],
};
if (PWSH) {
  for (const t of actionsWin) {
    const c = F.cas(t);
    const phrase = F.phraseDe(t, F.valeurs(t, { extra: c.extra }));
    // Le formulaire refuse déjà une phrase inexacte : pour éprouver le SCRIPT (le verrou est dans le script),
    // on fabrique le script en mode Appliquer avec la phrase exacte, puis on en retire la phrase saisie.
    const exact = t.generate(F.valeurs(t, { mode: 'Appliquer', extra: c.extra }));
    const b64 = (x) => Buffer.from(x, 'utf8').toString('base64');
    assert(exact.includes(`FromBase64String('${b64(phrase)}')`), `${t.id} : la phrase attendue est embarquée dans le script (le verrou est dans le script)`);
    const variantes = [
      ['phrase vide', ''], ['phrase en minuscules', phrase.toLowerCase()], ['phrase avec espace final', `${phrase} `],
      ['phrase d’un autre assistant', 'ANNULER LE TRAVAIL 1 DE AUTRE'], ['« oui »', 'oui'], ['phrase tronquée', phrase.slice(0, -2)],
    ];
    for (const [nom, saisie] of variantes) {
      const modifie = exact.replace(/(\$KjemoConfirmation = \[Text\.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\()'[^']*'/, `$1'${b64(saisie)}'`);
      assert(modifie !== exact || saisie === phrase, `${t.id} : (préparation) la confirmation saisie du script est bien remplaçable — ${nom}`);
      const r = D.executer(modifie, c.scenario);
      assert(r.modifiants.length === 0, `${t.id} : Appliquer + ${nom} → ZÉRO appel modifiant`);
      assert(/^REFUS/.test(r.conclusion ?? '') && /AUCUNE MODIFICATION/.test(r.sortie), `${t.id} : Appliquer + ${nom} → conclusion REFUS et message « AUCUNE MODIFICATION »`);
    }
    // Mode Diagnostic avec la phrase exacte : toujours rien. La phrase seule ne suffit pas.
    const diagAvecPhrase = exact.replace(/\$KjemoMode = \[Text\.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\('[^']*'\)\)/, `$KjemoMode = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64('Diagnostic')}'))`);
    const rd = D.executer(diagAvecPhrase, c.scenario);
    assert(rd.modifiants.length === 0, `${t.id} : mode Diagnostic + phrase exacte → ZÉRO appel modifiant (la phrase seule ne suffit pas)`);
    // Mode Appliquer sans les droits d'administrateur, pour les deux assistants qui l'exigent.
    if (t.requiresAdmin) {
      const r = D.executer(exact, { ...c.scenario, admin: false });
      assert(r.modifiants.length === 0 && /^REFUS/.test(r.conclusion ?? ''), `${t.id} : Appliquer sans console élevée → refus, aucun appel modifiant`);
    }
  }
}

// ===========================================================================
section('Windows — EXÉCUTION AVEC DOUBLES : contrôle positif, l’action a lieu, est relue, et la conclusion reste mesurée');
// ===========================================================================
if (PWSH) {
  for (const t of actionsWin) {
    const c = F.cas(t);
    const r = D.executer(t.generate(F.valeurs(t, { mode: 'Appliquer', extra: c.extra })), c.scenario);
    const attendu = ACTION_ATTENDUE[t.id];
    assert(r.statut === 0 && JSON.stringify(r.modifiants.map((a) => a.cmd)) === JSON.stringify(attendu), `${t.id} : confirmation exacte → exactement ${attendu.join(' puis ')} (vu : ${r.modifiants.map((a) => a.cmd).join(' puis ') || 'rien'})`);
    // Ordre : une lecture AVANT l'action, une relecture APRÈS.
    const iAction = r.appels.findIndex((a) => D.CMDLETS_MODIFIANTS.includes(a.cmd) && !a.whatif);
    const avant = r.appels.slice(0, iAction).filter((a) => a.cmd.startsWith('Get-'));
    const apres = r.appels.slice(iAction + 1).filter((a) => a.cmd.startsWith('Get-'));
    assert(avant.length >= 1, `${t.id} : au moins une lecture AVANT l’action`);
    assert(apres.length >= 1, `${t.id} : au moins une relecture APRÈS l’action`);
    assert(!/^REFUS|^ECART/.test(r.conclusion ?? ''), `${t.id} : la relecture confirme → pas de REFUS ni d’ECART (${(r.conclusion ?? '').slice(0, 70)})`);
    assert(D.MOTS_INTERDITS_CONCLUSION.every((re) => !re.test(r.conclusion ?? '')), `${t.id} : la conclusion n’annonce ni « réparé » ni « fonctionne »`);
    assert(/prouve|garantit|ne dit pas|ne confirme pas|essaie|fais un essai|regarde|va regarder|peut la changer|interrompus|n ont pas ete touches/i.test(r.conclusion ?? ''), `${t.id} : la conclusion nomme au moins une limite`);
    // Les arguments sont exacts : le nom entier, jamais un motif.
    const act = r.modifiants[0];
    const texteArgs = JSON.stringify(act.args);
    if (t.id === 'imp-win-annuler-travail') assert(act.args.PrinterName === F.NOM_IMPRIMANTE && act.args.ID === '1', `${t.id} : Remove-PrintJob reçoit le nom entier et l’identifiant exacts (${texteArgs})`);
    if (t.id === 'imp-win-config-reseau') assert(r.modifiants[0].args.PrinterHostAddress === F.HOTE && r.modifiants[1].args.DriverName === F.PILOTE && r.modifiants[1].args.Name === F.NOM_IMPRIMANTE, `${t.id} : port et imprimante créés avec l’hôte, le pilote DÉJÀ installé et le nom demandés`);
    if (t.id === 'imp-win-connexion-partage') assert(act.args.ConnectionName === F.UNC, `${t.id} : Add-Printer -ConnectionName reçoit le chemin UNC exact (${texteArgs})`);
    if (t.id === 'imp-win-defaut') assert(act.args.MethodName === 'SetDefaultPrinter' && act.args.Cible === 'HP LaserJet Accueil', `${t.id} : SetDefaultPrinter sur la cible exacte`);
    if (t.id === 'imp-win-page-test') assert(act.args.MethodName === 'PrintTestPage' && act.args.Cible === F.NOM_IMPRIMANTE, `${t.id} : PrintTestPage sur la cible exacte`);
    if (t.id === 'imp-win-spouleur-redemarrer') assert(act.args.Name === 'Spooler' && !('Force' in act.args), `${t.id} : Restart-Service Spooler, sans -Force`);
  }
}

// ===========================================================================
section('Windows — EXÉCUTION AVEC DOUBLES : cas d’erreur — droits insuffisants, service indisponible, cible absente ou ambiguë, pilote manquant, travail disparu, erreur de commande');
// ===========================================================================
if (PWSH) {
  const lancer = (id, mode, scenario, extra = {}) => {
    const t = parId[id];
    return D.executer(t.generate(F.valeurs(t, { mode, extra: { ...F.cas(t).extra, ...extra } })), scenario);
  };
  const pas = (r, msg) => assert(r.modifiants.length === 0, msg);
  const nominal = (id, plus = {}) => ({ ...F.cas(parId[id]).scenario, ...plus });

  // --- Droits insuffisants : une lecture refusée n'est JAMAIS un OK, jamais un « rien à signaler »
  for (const t of lecturesWin) {
    const cmd = { 'imp-win-inventaire': 'Get-Printer', 'imp-win-diagnostic-file': 'Get-Printer', 'imp-win-spouleur': 'Get-Service', 'imp-win-reseau': 'Get-PrinterPort', 'imp-win-partage-unc': 'Get-Printer' }[t.id];
    const c = F.cas(t);
    const r = D.executer(t.generate(F.valeurs(t, { extra: c.extra })), { ...c.scenario, errors: { [cmd]: 'Access is denied' } });
    assert(r.modifiants.length === 0, `${t.id} : accès refusé sur ${cmd} → aucun appel modifiant`);
    assert(/Lecture non aboutie|INACCESSIBLE|ATTENTION/.test(r.sortie), `${t.id} : accès refusé sur ${cmd} → la lecture est signalée non aboutie (ATTENTION)`);
    assert(!/n ont signale aucun point/.test(r.conclusion ?? ''), `${t.id} : accès refusé → la conclusion ne dit JAMAIS « aucun point » (${(r.conclusion ?? '').slice(0, 80)})`);
  }
  // --- Service indisponible (spouleur arrêté / RPC)
  {
    const r = lancer('imp-win-inventaire', 'Diagnostic', nominal('imp-win-inventaire', { errors: { 'Get-Printer': 'The RPC server is unavailable. (0x800706BA)' } }));
    assert(/SERVICE|INACCESSIBLE|Lecture non aboutie/.test(r.sortie) && !/n ont signale aucun point/.test(r.conclusion ?? ''), 'inventaire : spouleur indisponible (RPC) → classé service/inaccessible, jamais « aucun point »');
    const r2 = lancer('imp-win-spouleur', 'Diagnostic', nominal('imp-win-spouleur', { service: { Name: 'Spooler', Status: 'Stopped', StartType: 'Automatic', DependentServices: [] } }));
    assert(/Stopped/.test(r2.sortie) && /PROBLEME|ATTENTION/.test(r2.sortie) && !/n ont signale aucun point/.test(r2.conclusion ?? ''), 'spouleur : service arrêté → signalé, pas « aucun point »');
  }
  // --- Imprimante inconnue / ambiguë pour chaque assistant ciblé
  for (const id of ['imp-win-annuler-travail', 'imp-win-defaut', 'imp-win-page-test']) {
    const base = nominal(id);
    const r = lancer(id, 'Appliquer', { ...base, printers: [{ ...F.IMPRIMANTE, Name: 'Autre imprimante' }], jobs: [] });
    pas(r, `${id} : imprimante inconnue → aucun appel modifiant`);
    assert(/^REFUS/.test(r.conclusion ?? '') && /PROBLEME/.test(r.sortie), `${id} : imprimante inconnue → REFUS`);
    const amb = lancer(id, 'Appliquer', { ...base, printers: [{ ...F.IMPRIMANTE }, { ...F.IMPRIMANTE, Name: 'hp laserjet accueil' }] });
    pas(amb, `${id} : deux imprimantes qui ne diffèrent que par la casse → AMBIGU → aucun appel modifiant`);
    assert(/^REFUS/.test(amb.conclusion ?? '') && /correspondances/.test(amb.sortie), `${id} : cible ambiguë → REFUS nommant les correspondances`);
    const proche = lancer(id, 'Appliquer', { ...base, printers: [{ ...F.IMPRIMANTE, Name: 'HP LaserJet Accueil 2' }], jobs: [] });
    pas(proche, `${id} : un nom proche (suffixe) n’est pas la cible → aucun appel modifiant`);
    const lecture = lancer(id, 'Appliquer', { ...base, errors: { 'Get-Printer': 'Access is denied' } });
    pas(lecture, `${id} : liste des imprimantes illisible → aucun appel modifiant`);
    assert(/^REFUS|INCOMPLET/.test(lecture.conclusion ?? ''), `${id} : liste illisible → REFUS/INCOMPLET, jamais un succès (${(lecture.conclusion ?? '').slice(0, 60)})`);
    // Le script n'a jamais passé de joker à Get-Printer.
    assert(!lecture.appels.concat(r.appels).some((a) => a.cmd === 'Get-Printer' && 'Name' in a.args), `${id} : Get-Printer n’est jamais appelé avec -Name (jokers) : énumération puis égalité`);
  }
  // --- Travail disparu / mauvais identifiant / propriétaire
  {
    const base = nominal('imp-win-annuler-travail');
    const r = lancer('imp-win-annuler-travail', 'Appliquer', { ...base, jobs: [] });
    pas(r, 'annuler-travail : travail déjà disparu → aucun appel modifiant');
    assert(/^REFUS/.test(r.conclusion ?? '') && /introuvable/.test(r.sortie), 'annuler-travail : travail disparu → REFUS « introuvable »');
    const autre = lancer('imp-win-annuler-travail', 'Appliquer', { ...base, jobs: [{ ...F.TRAVAIL, ID: 2 }] });
    pas(autre, 'annuler-travail : seul un AUTRE travail existe → aucun appel modifiant, le 2 n’est pas annulé à la place du 1');
    const double = lancer('imp-win-annuler-travail', 'Appliquer', { ...base, jobs: [{ ...F.TRAVAIL }, { ...F.TRAVAIL }] });
    pas(double, 'annuler-travail : identifiant présent deux fois → ambigu → aucun appel modifiant');
    const sur = lancer('imp-win-annuler-travail', 'Appliquer', { ...base, jobs: [{ ...F.TRAVAIL }, { ...F.TRAVAIL, ID: 2, DocumentName: 'confidentiel.pdf' }] });
    assert(sur.modifiants.length === 1 && sur.modifiants[0].args.ID === '1', 'annuler-travail : parmi deux travaux, seul le 1 est annulé');
    assert(!/confidentiel\.pdf/.test(sur.sortie), 'annuler-travail : le nom d’un document n’est pas recopié dans le rapport (confidentialité)');
    const autreUser = lancer('imp-win-annuler-travail', 'Appliquer', { ...base, jobs: [{ ...F.TRAVAIL, UserName: 'autre.utilisateur' }] });
    assert(/AUTRE utilisateur/.test(autreUser.sortie), 'annuler-travail : le travail d’un autre utilisateur est signalé avant d’agir');
  }
  // --- Pilote manquant, port existant, imprimante existante (config-reseau)
  {
    const base = nominal('imp-win-config-reseau');
    const sansPilote = lancer('imp-win-config-reseau', 'Appliquer', { ...base, drivers: [{ Name: 'Autre pilote' }] });
    pas(sansPilote, 'config-reseau : pilote non installé → aucun appel modifiant (rien n’est téléchargé ni installé)');
    assert(/^REFUS/.test(sansPilote.conclusion ?? '') && /pas installe/.test(sansPilote.sortie), 'config-reseau : pilote absent → REFUS « ce pilote n’est pas installé »');
    const dejaImp = lancer('imp-win-config-reseau', 'Appliquer', { ...base, printers: [{ ...F.IMPRIMANTE }] });
    pas(dejaImp, 'config-reseau : une imprimante de ce nom existe déjà → aucun remplacement silencieux');
    const dejaPort = lancer('imp-win-config-reseau', 'Appliquer', { ...base, ports: [{ ...F.PORT, PrinterHostAddress: '192.168.30.99' }] });
    pas(dejaPort, 'config-reseau : un port de même nom pointe vers une AUTRE adresse → aucun appel modifiant');
    const portIdentique = lancer('imp-win-config-reseau', 'Appliquer', { ...base, ports: [{ ...F.PORT }] });
    assert(!portIdentique.modifiants.some((a) => a.cmd === 'Add-PrinterPort'), 'config-reseau : un port identique existe déjà → il est réutilisé, pas recréé');
    const droits = lancer('imp-win-config-reseau', 'Appliquer', { ...base, admin: false });
    pas(droits, 'config-reseau : console non élevée → aucun appel modifiant');
    const diag = lancer('imp-win-config-reseau', 'Diagnostic', base);
    assert(diag.simulations.some((a) => a.cmd === 'Add-PrinterPort') && !diag.appels.some((a) => a.cmd === 'Add-Printer'), 'config-reseau : en Diagnostic, Add-PrinterPort est SIMULÉ (-WhatIf) et Add-Printer n’est pas appelé du tout');
    assert(/pas de simulation native/.test(diag.sortie), 'config-reseau : le rapport dit que Add-Printer n’a pas de simulation fiable (aucun -WhatIf inventé)');
  }
  // --- Erreur de commande : l'action échoue, le script le dit et ne conclut pas au succès
  {
    const casErreur = [
      ['imp-win-annuler-travail', 'Remove-PrintJob'], ['imp-win-config-reseau', 'Add-PrinterPort'], ['imp-win-connexion-partage', 'Add-Printer'],
      ['imp-win-defaut', 'Invoke-CimMethod'], ['imp-win-page-test', 'Invoke-CimMethod'], ['imp-win-spouleur-redemarrer', 'Restart-Service'],
    ];
    for (const [id, cmd] of casErreur) {
      const r = lancer(id, 'Appliquer', nominal(id, { errors: { [cmd]: 'Access is denied' } }));
      assert(r.modifiants.length >= 1, `${id} : (préparation) la commande ${cmd} a bien été tentée`);
      assert(/^ECART|^REFUS|INCOMPLET/.test(r.conclusion ?? ''), `${id} : ${cmd} échoue → ECART/REFUS/INCOMPLET, jamais un succès (${(r.conclusion ?? '').slice(0, 60)})`);
      assert(/PROBLEME/.test(r.sortie), `${id} : ${cmd} échoue → un PROBLEME est inscrit au rapport`);
      assert(D.MOTS_INTERDITS_CONCLUSION.every((re) => !re.test(r.conclusion ?? '')), `${id} : échec → aucun mot de réussite dans la conclusion`);
    }
    // La commande « réussit » mais l'état relu ne change pas : "acceptée" n'est pas "effective".
    const sansEffet = [
      ['imp-win-annuler-travail', 'Remove-PrintJob'], ['imp-win-config-reseau', 'Add-Printer'], ['imp-win-connexion-partage', 'Add-Printer'],
      ['imp-win-defaut', 'SetDefaultPrinter'], ['imp-win-spouleur-redemarrer', 'Restart-Service'],
    ];
    for (const [id, cle] of sansEffet) {
      const r = lancer(id, 'Appliquer', nominal(id, { noEffect: { [cle]: true } }));
      assert(/^ECART/.test(r.conclusion ?? ''), `${id} : commande acceptée mais état relu inchangé → ECART (« acceptée » n’est pas « effective ») (${(r.conclusion ?? '').slice(0, 60)})`);
    }
  }
  // --- Page de test : AUCUNE relecture n'est possible (la page peut être sortie avant la lecture). Le script ne prétend donc rien.
  {
    const r = lancer('imp-win-page-test', 'Appliquer', nominal('imp-win-page-test', { noEffect: { PrintTestPage: true } }));
    assert(/^Page de test DEMANDEE/.test(r.conclusion ?? '') && /regarder l imprimante/.test(r.conclusion ?? ''), 'page-test : même sans travail visible, la conclusion reste « DEMANDÉE » et renvoie à l’observation du papier (aucune affirmation de sortie)');
    assert(/regarde le bac de sortie/.test(r.sortie), 'page-test : le rapport demande à l’utilisateur de vérifier le bac de sortie');
  }
  // --- Spouleur : mauvaise machine, état de transition, files vides lues
  {
    const base = nominal('imp-win-spouleur-redemarrer');
    const autreMachine = lancer('imp-win-spouleur-redemarrer', 'Appliquer', base, { impMachine: 'AUTRE-PC-99' });
    pas(autreMachine, 'spouleur-redemarrer : le nom saisi n’est pas celui de cette machine → aucun redémarrage');
    const transition = lancer('imp-win-spouleur-redemarrer', 'Appliquer', { ...base, service: { Name: 'Spooler', Status: 'StopPending', StartType: 'Automatic', DependentServices: [] } });
    pas(transition, 'spouleur-redemarrer : service en transition (StopPending) → aucun redémarrage');
    const illisible = lancer('imp-win-spouleur-redemarrer', 'Appliquer', { ...base, errors: { 'Get-Service': 'Access is denied' } });
    pas(illisible, 'spouleur-redemarrer : état du service illisible → aucun redémarrage');
    const dep = lancer('imp-win-spouleur-redemarrer', 'Diagnostic', { ...base, service: { Name: 'Spooler', Status: 'Running', StartType: 'Automatic', DependentServices: [{ Name: 'PrintNotify', Status: 'Running' }] } });
    assert(/PrintNotify/.test(dep.sortie), 'spouleur-redemarrer : les services dépendants en cours sont nommés avant d’agir');
    const partage = lancer('imp-win-spouleur-redemarrer', 'Diagnostic', { ...base, printers: [{ ...F.IMPRIMANTE, Shared: true, ShareName: 'Accueil' }] });
    assert(/partag/i.test(partage.sortie), 'spouleur-redemarrer : les files partagées (clients interrompus) sont signalées');
    assert(!partage.appels.some((a) => a.cmd === 'Get-ChildItem'), 'spouleur-redemarrer : le dossier du spool n’est même pas listé (aucune purge, aucune curiosité)');
  }
  // --- Page de test : annonce papier/encre, résultat décrit comme demandé
  {
    const r = lancer('imp-win-page-test', 'Diagnostic', nominal('imp-win-page-test'));
    assert(/papier|encre|toner/i.test(r.sortie), 'page-test : le rapport annonce la consommation de papier et d’encre avant d’agir');
    const rr = lancer('imp-win-page-test', 'Appliquer', nominal('imp-win-page-test', { cimReturn: { PrintTestPage: 5 } }));
    assert(!/^Page de test DEMANDEE/.test(rr.conclusion ?? ''), 'page-test : un code retour 5 (accès refusé) n’est pas présenté comme une page demandée');
  }
  // --- Imprimante par défaut : relecture dans le contexte du compte
  {
    const r = lancer('imp-win-defaut', 'Appliquer', nominal('imp-win-defaut'));
    assert(/ce compte/.test(r.conclusion ?? '') || /compte/.test(r.sortie), 'defaut : le rapport rappelle que le réglage est propre au compte');
    const elev = lancer('imp-win-defaut', 'Diagnostic', nominal('imp-win-defaut', { admin: true }));
    assert(/elev|administrateur/i.test(elev.sortie), 'defaut : exécuté en console élevée, le rapport avertit que le réglage concernerait le compte administrateur');
  }
  // --- Connexion partagée : serveur injoignable / pilote
  {
    const base = nominal('imp-win-connexion-partage');
    const ferme = lancer('imp-win-connexion-partage', 'Appliquer', { ...base, tcp: 'REFUSE' });
    pas(ferme, 'connexion-partage : le port SMB 445 du serveur refuse → aucun Add-Printer');
    const inconnue = lancer('imp-win-connexion-partage', 'Appliquer', { ...base, remotePrinters: [{ ...base.remotePrinters[0], Name: 'Autre', ShareName: 'Autre' }] });
    pas(inconnue, 'connexion-partage : la file demandée n’est pas partagée par le serveur → aucun Add-Printer');
    const dejaLa = lancer('imp-win-connexion-partage', 'Appliquer', { ...base, printers: [{ ...F.IMPRIMANTE, Name: F.UNC }] });
    pas(dejaLa, 'connexion-partage : la connexion existe déjà → aucun appel modifiant (pas de remplacement silencieux)');
  }
  // --- Réseau : chaque protocole teste le BON port ; DNS en échec
  {
    const t = parId['imp-win-reseau'];
    for (const [proto, port] of [['RAW', 9100], ['LPR', 515], ['IPP', 631], ['IPPS', 443], ['SMB', 445]]) {
      const r = D.executer(t.generate(F.valeurs(t, { extra: { impProto: proto } })), F.cas(t).scenario);
      const tcp = r.appels.find((a) => a.cmd === 'Test-KjemoTcp');
      assert(tcp && tcp.args.Port === String(port), `reseau : protocole ${proto} → test TCP sur le port ${port} (vu : ${tcp?.args.Port})`);
      assert(new RegExp(`${proto} / TCP ${port}`).test(r.sortie), `reseau : le rapport nomme le protocole ${proto} et le port ${port} réellement testés`);
    }
    const perso = D.executer(t.generate(F.valeurs(t, { extra: { impProto: 'RAW', impPort: '9101' } })), F.cas(t).scenario);
    assert(perso.appels.find((a) => a.cmd === 'Test-KjemoTcp')?.args.Port === '9101', 'reseau : un port personnalisé remplace celui du protocole');
    for (const [etat, motif] of [['REFUSE', /refusee/], ['DELAI', /delai/], ['ERREUR', /erreur/]]) {
      const r = D.executer(t.generate(F.valeurs(t)), { ...F.cas(t).scenario, tcp: etat });
      assert(motif.test(r.sortie) && !/n ont signale aucun point/.test(r.conclusion ?? ''), `reseau : port ${etat} → signalé, jamais « aucun point »`);
    }
    const ouvert = D.executer(t.generate(F.valeurs(t)), F.cas(t).scenario);
    assert(/ne prouve|pas qu une page|PAS qu une page/i.test(ouvert.sortie), 'reseau : « port ouvert » est accompagné de la réserve « cela ne prouve pas qu’une page sortira »');
    const dns = D.executer(t.generate(F.valeurs(t, { extra: { impHote: 'imprimante-introuvable.invalid' } })), F.cas(t).scenario);
    assert(/Resolution DNS/.test(dns.sortie) && /PROBLEME/.test(dns.sortie), 'reseau : un nom qui ne se résout pas est un PROBLEME DNS distinct (et non un port fermé)');
    assert(!dns.appels.some((a) => a.cmd === 'Test-KjemoTcp'), 'reseau : sans résolution DNS, aucun test TCP n’est tenté');
  }
}

// ===========================================================================
section('Linux / CUPS — EXÉCUTION AVEC FAUX BINAIRES : un diagnostic n’appelle aucune commande modifiante');
// ===========================================================================
const ETAT_SAIN = { dests: [{ nom: 'HP_LaserJet_Accueil' }, { nom: 'Compta', uri: 'ipp://srv-print/printers/Compta' }], jobs: [{ id: 'HP_LaserJet_Accueil-1', proprio: 'labo' }], tcp: 0 };
const moi = spawnSync('id', ['-un'], { encoding: 'utf8' }).stdout.trim();
const ETAT_MOI = { ...ETAT_SAIN, jobs: [{ id: 'HP_LaserJet_Accueil-1', proprio: moi }] };
const ETAT_ARRETEE = { dests: [{ nom: 'HP_LaserJet_Accueil', actif: false, accepte: false, raison: 'offline-report' }], jobs: [], tcp: 0 };
{
  for (const t of cups) {
    const r = C.executerCups(t.generate(F.valeurs(t, { extra: {} })), ETAT_SAIN);
    assert(r.statut === 0 && r.conclusion !== null, `${t.id} : le script s’exécute jusqu’à sa conclusion (statut ${r.statut}${r.erreur ? `, stderr: ${r.erreur.slice(0, 100)}` : ''})`);
    assert(r.modifiants.length === 0, `${t.id} (défaut, sans confirmation) : ZÉRO appel modifiant${r.modifiants.length ? ` — vu : ${r.modifiants.map((a) => a.cmd).join(', ')}` : ''}`);
    assert(r.appels.some((a) => a.cmd === 'lpstat'), `${t.id} : il lit bien l’état avec lpstat`);
    assert(!r.appels.some((a) => ['lpadmin', 'cupsctl', 'lprm', 'lp', 'lpmove', 'service', 'cupsdisable', 'cupsreject'].includes(a.cmd)), `${t.id} : aucune commande d’administration CUPS n’est appelée`);
    assert(!r.appels.some((a) => a.cmd === 'systemctl' && a.args[0] !== 'is-active'), `${t.id} : systemctl n’est appelé que pour is-active (lecture)`);
    assert(!/\brepar[ée]|imprimante fonctionne|imprime correctement/i.test(r.conclusion ?? ''), `${t.id} : la conclusion ne dit jamais « réparé » ni « fonctionne »`);
  }
  // Inventaire : CUPS à l'arrêt → prérequis en PROBLEME, rien d'autre.
  const inv = parId['imp-cups-inventaire'];
  const arret = C.executerCups(inv.generate(F.valeurs(inv)), { ...ETAT_SAIN, drapeaux: ['down'] });
  assert(/\[PROBLEME\]/.test(arret.sortie) && /lpstat ne joint pas le serveur CUPS/.test(arret.sortie), 'inventaire : cupsd arrêté → PROBLEME « lpstat ne joint pas le serveur CUPS »');
  assert(!/Aucun probleme detecte/.test(arret.conclusion ?? ''), 'inventaire : cupsd arrêté → la conclusion ne dit pas « aucun problème »');
  assert(arret.modifiants.length === 0 && !arret.appels.some((a) => a.cmd === 'systemctl' && a.args[0] !== 'is-active'), 'inventaire : cupsd arrêté → le script ne tente PAS de le démarrer');
  const absent = C.executerCups(inv.generate(F.valeurs(inv)), ETAT_SAIN, { absents: ['lpstat'] });
  assert(/Installe le paquet cups-client/.test(absent.sortie) && /Ce script n installe rien/.test(absent.sortie) && absent.modifiants.length === 0, 'inventaire : lpstat absent → conseil d’installer cups-client SANS l’installer, aucun appel');
  const filtre = C.executerCups(inv.generate(F.valeurs(inv, { extra: { impDest: 'Compta' } })), ETAT_SAIN);
  assert(/Destination \/ Compta/.test(filtre.sortie) && !/Destination \/ HP_LaserJet_Accueil/.test(filtre.sortie), 'inventaire : le filtre de destination ne garde que la destination demandée');
  const filtreAbsent = C.executerCups(inv.generate(F.valeurs(inv, { extra: { impDest: 'Inconnue' } })), ETAT_SAIN);
  assert(/Aucune destination ne porte exactement ce nom/.test(filtreAbsent.sortie), 'inventaire : destination demandée absente → signalée (comparaison exacte)');
  const mot = C.executerCups(inv.generate(F.valeurs(inv)), { dests: [{ nom: 'Dir', uri: 'ipp://admin:hunter2@192.168.30.77/ipp/print' }], tcp: 0 });
  assert(!/hunter2/.test(mot.sortie), 'inventaire : le mot de passe d’une URI est MASQUÉ dans le rapport');
  assert(/\[MASQUE\]/.test(mot.sortie), 'inventaire : le masque est visible, pour que le lecteur sache qu’une valeur a été retirée');
  // Genres d'URI
  const genres = C.executerCups(inv.generate(F.valeurs(inv)), { dests: [
    { nom: 'Usb1', uri: 'usb://HP/LaserJet?serial=123' }, { nom: 'Raw1', uri: 'socket://192.168.30.50:9100' },
    { nom: 'Ipp1', uri: 'ipp://192.168.30.50/ipp/print' }, { nom: 'Srv1', uri: 'ipp://srv-print/printers/Compta' },
    { nom: 'Pdf1', uri: 'cups-pdf:/' }, { nom: 'Lpd1', uri: 'lpd://192.168.30.50/queue' },
  ], tcp: 0 });
  for (const [nom, motif] of [['Usb1', /USB/], ['Raw1', /RAW/], ['Ipp1', /IPP/], ['Srv1', /autre serveur CUPS/], ['Pdf1', /virtuelle/], ['Lpd1', /LPD/]])
    assert(new RegExp(`${nom}[^\\n]*${motif.source}`).test(genres.sortie), `inventaire : la destination ${nom} est classée « ${motif.source} »`);
  assert(/heuristique/i.test(genres.sortie), 'inventaire : le rapport dit que le genre est déduit du schéma de l’URI (heuristique)');
  assert(/est une heuristique/.test(genres.sortie), 'inventaire : la synthèse répète que le genre est une heuristique');
  // Diagnostic d'une file arrêtée
  const dg = parId['imp-cups-diagnostic-file'];
  const arretee = C.executerCups(dg.generate(F.valeurs(dg)), ETAT_ARRETEE);
  assert(/disabled|desactiv/i.test(arretee.sortie) && /offline-report/.test(arretee.sortie), 'diagnostic-file : file désactivée → l’état ET la raison déclarée sont rapportés');
  assert(/PROBLEME/.test(arretee.sortie) && !/Aucun probleme detecte/.test(arretee.conclusion ?? ''), 'diagnostic-file : file désactivée → PROBLEME, jamais « aucun problème »');
  assert(arretee.modifiants.length === 0, 'diagnostic-file : file désactivée → le script ne la réactive PAS (ce n’est pas son rôle)');
  const inconnue = C.executerCups(dg.generate(F.valeurs(dg)), { dests: [{ nom: 'Autre' }], tcp: 0 });
  assert(/aucune destination ne porte exactement ce nom/i.test(inconnue.sortie), 'diagnostic-file : destination inconnue → REFUS explicite');
  const proche = C.executerCups(dg.generate(F.valeurs(dg)), { dests: [{ nom: 'HP_LaserJet_Accueil2' }], tcp: 0 });
  assert(/aucune destination ne porte exactement ce nom/i.test(proche.sortie), 'diagnostic-file : « HP_LaserJet_Accueil2 » n’est pas « HP_LaserJet_Accueil » (comparaison exacte, pas de préfixe)');
  for (const [code, motif] of [[1, /refus|ferme/i], [124, /delai|aucune reponse/i]]) {
    const r = C.executerCups(dg.generate(F.valeurs(dg)), { ...ETAT_SAIN, tcp: code });
    assert(motif.test(r.sortie) && !/Aucun probleme detecte/.test(r.conclusion ?? ''), `diagnostic-file : test TCP code ${code} → signalé, jamais « aucun problème »`);
  }
  const ok = C.executerCups(dg.generate(F.valeurs(dg)), ETAT_SAIN);
  assert(/ne prouve|PAS qu|pas qu/i.test(ok.sortie), 'diagnostic-file : « port ouvert » est accompagné de la réserve « ne prouve pas qu’une page sortira »');
  const journalRefuse = C.executerCups(dg.generate(F.valeurs(dg)), { ...ETAT_SAIN, drapeaux: ['journal_denied'] });
  assert(/inaccessible|non lu|illisible|acces/i.test(journalRefuse.sortie), 'diagnostic-file : journal de cups refusé → signalé inaccessible (et non « aucune erreur »)');
}

// ===========================================================================
section('Linux / CUPS — EXÉCUTION AVEC FAUX BINAIRES : actions refusées sans confirmation, contrôle positif, relecture');
// ===========================================================================
{
  const ann = parId['imp-cups-annuler-travail'];
  const rea = parId['imp-cups-reactiver-file'];
  const phraseCups = (t, v) => { const m = /recopie exactement : (.+)$/.exec(t.validate({ ...v, impConfirmation: 'x' }).impConfirmation ?? ''); return m ? m[1] : null; };
  const vAnn = (extra = {}) => ({ ...F.defauts(ann), ...extra });
  const vRea = (extra = {}) => ({ ...F.defauts(rea), ...extra });
  const pAnn = phraseCups(ann, vAnn());
  const pRea = phraseCups(rea, vRea({ impAction: 'Reactiver' }));
  const pAcc = phraseCups(rea, vRea({ impAction: 'Accepter' }));
  assert(pAnn === 'ANNULER LE TRAVAIL HP_LaserJet_Accueil-1', `annuler-travail : phrase nominative (« ${pAnn} »)`);
  assert(pRea === 'REACTIVER HP_LaserJet_Accueil' && pAcc === 'ACCEPTER LES TRAVAUX DE HP_LaserJet_Accueil', `reactiver-file : phrases nominatives (« ${pRea} » / « ${pAcc} »)`);

  // Le formulaire refuse déjà une phrase inexacte. Le VERROU est dans le script : on prouve donc qu'un script
  // dont la phrase saisie est fausse n'agit pas, en altérant la saisie après génération.
  const altere = (script, saisie) => script.replace(/^KJEMO_CONF_SAISIE=.*$/m, `KJEMO_CONF_SAISIE='${saisie}'`);
  for (const [nom, t, vals, phrase, etat] of [
    ['annuler-travail', ann, vAnn({ impConfirmation: pAnn }), pAnn, ETAT_MOI],
    ['reactiver-file (cupsenable)', rea, vRea({ impAction: 'Reactiver', impConfirmation: pRea }), pRea, ETAT_ARRETEE],
    ['reactiver-file (cupsaccept)', rea, vRea({ impAction: 'Accepter', impConfirmation: pAcc }), pAcc, ETAT_ARRETEE],
  ]) {
    const exact = t.generate(vals);
    assert(/^KJEMO_CONF_SAISIE=/m.test(exact), `${nom} : (préparation) la saisie figée est remplaçable`);
    for (const [var_, saisie] of [['vide', ''], ['minuscules', phrase.toLowerCase()], ['espace final', `${phrase} `], ['tronquée', phrase.slice(0, -2)], ['oui', 'oui'], ['autre file', phrase.replace('HP_LaserJet_Accueil', 'Compta')], ['sous-chaîne', phrase.slice(0, 10)]]) {
      const r = C.executerCups(altere(exact, saisie), etat);
      assert(r.modifiants.length === 0, `${nom} : confirmation « ${var_} » → ZÉRO appel modifiant`);
      assert(/AUCUNE MODIFICATION/.test(r.sortie), `${nom} : confirmation « ${var_} » → message « AUCUNE MODIFICATION »`);
    }
    const bon = C.executerCups(exact, etat);
    const attendu = nom.includes('annuler') ? ['cancel'] : nom.includes('cupsenable') ? ['cupsenable'] : ['cupsaccept'];
    assert(JSON.stringify(bon.modifiants.map((a) => a.cmd)) === JSON.stringify(attendu), `${nom} : confirmation exacte → exactement ${attendu.join('+')} (vu : ${bon.modifiants.map((a) => a.cmd).join('+') || 'rien'})`);
    const iAct = bon.appels.findIndex((a) => VERBES.includes(a.cmd));
    assert(bon.appels.slice(0, iAct).some((a) => a.cmd === 'lpstat') && bon.appels.slice(iAct + 1).some((a) => a.cmd === 'lpstat'), `${nom} : lpstat AVANT l’action et APRÈS (relecture)`);
    assert(!/\brepar[ée]|imprimante fonctionne|imprime correctement/i.test(bon.conclusion ?? '') && !/^ECART|^REFUS/.test(bon.conclusion ?? ''), `${nom} : la relecture confirme, la conclusion reste mesurée (${(bon.conclusion ?? '').slice(0, 70)})`);
    // Sans effet réel : acceptée n'est pas effective
    const drapeau = nom.includes('annuler') ? 'noeffect_cancel' : 'noeffect_verb';
    const sansEffet = C.executerCups(exact, { ...etat, drapeaux: [drapeau] });
    assert(/ECART|PROBLEME/.test(sansEffet.sortie + sansEffet.erreur) && /toujours present|encore dans la file|ne correspond pas/.test(sansEffet.sortie + sansEffet.erreur), `${nom} : commande acceptée mais état relu inchangé → ECART signalé (« acceptée » n’est pas « effective »)`);
    // Échec de la commande (droits)
    const echec = C.executerCups(exact, { ...etat, drapeaux: [nom.includes('annuler') ? 'cancel_fail' : 'verb_fail'] });
    assert(/PROBLEME/.test(echec.sortie) && /code 1|lpadmin|root/.test(echec.sortie), `${nom} : la commande échoue (droits) → PROBLEME avec le code et l’indication root/lpadmin`);
    assert(!/Aucun probleme detecte/.test(echec.conclusion ?? ''), `${nom} : la commande échoue → la conclusion ne dit pas « aucun problème »`);
    // CUPS à l'arrêt, commande absente
    const arret = C.executerCups(exact, { ...etat, drapeaux: ['down'] });
    assert(arret.modifiants.length === 0, `${nom} : cupsd arrêté → aucun appel modifiant`);
    const sansCmd = C.executerCups(exact, etat, { absents: [attendu[0]] });
    assert(sansCmd.modifiants.length === 0 && /absentes/.test(sansCmd.sortie), `${nom} : commande ${attendu[0]} absente → « commandes absentes », aucune action`);
  }
  // Cibles
  {
    const exact = ann.generate(vAnn({ impConfirmation: pAnn }));
    const sans = C.executerCups(exact, { dests: [{ nom: 'HP_LaserJet_Accueil' }], jobs: [], tcp: 0 });
    assert(sans.modifiants.length === 0 && /introuvable/.test(sans.sortie), 'annuler-travail : travail disparu → aucun cancel, « introuvable »');
    const autreDest = C.executerCups(exact, { dests: [{ nom: 'Autre' }], jobs: [], tcp: 0 });
    assert(autreDest.modifiants.length === 0 && /aucune destination ne porte exactement ce nom/i.test(autreDest.sortie), 'annuler-travail : destination inconnue → aucun cancel');
    const surNumero = C.executerCups(exact, { dests: [{ nom: 'HP_LaserJet_Accueil' }], jobs: [{ id: 'HP_LaserJet_Accueil-10', proprio: moi }, { id: 'HP_LaserJet_Accueil-11', proprio: moi }], tcp: 0 });
    assert(surNumero.modifiants.length === 0, 'annuler-travail : le travail 1 n’existe pas, seuls 10 et 11 existent → aucun cancel (pas de préfixe : 1 ≠ 10)');
    const deux = C.executerCups(exact, { dests: [{ nom: 'HP_LaserJet_Accueil' }], jobs: [{ id: 'HP_LaserJet_Accueil-1', proprio: moi }, { id: 'HP_LaserJet_Accueil-2', proprio: moi }], tcp: 0 });
    assert(deux.modifiants.length === 1 && deux.modifiants[0].args.join(' ') === 'HP_LaserJet_Accueil-1', 'annuler-travail : parmi deux travaux, un seul cancel, avec l’identifiant exact et sans option');
    assert(deux.etatFinal.jobs.includes('HP_LaserJet_Accueil-2') && !deux.etatFinal.jobs.includes('HP_LaserJet_Accueil-1|'), 'annuler-travail : le deuxième travail est intact après l’action');
    const proprio = C.executerCups(ann.generate(vAnn({ impConfirmation: pAnn, impProprio: 'quelquun-d-autre' })), ETAT_MOI);
    assert(proprio.modifiants.length === 0 && /appartient a quelqu un d autre/.test(proprio.sortie), 'annuler-travail : propriétaire attendu ≠ propriétaire réel → aucun cancel');
    const memeProprio = C.executerCups(ann.generate(vAnn({ impConfirmation: pAnn, impProprio: moi })), ETAT_MOI);
    assert(memeProprio.modifiants.length === 1, 'annuler-travail : propriétaire attendu = propriétaire réel → le cancel a lieu');
    const doc = C.executerCups(exact, ETAT_MOI);
    assert(!/document\.pdf/.test(doc.sortie) && /nom du document n est pas affiche/.test(doc.sortie), 'annuler-travail : aucun nom de document dans le rapport (et le rapport dit pourquoi)');
    // Réactiver : rien à réactiver
    const dejaActive = C.executerCups(rea.generate(vRea({ impAction: 'Reactiver', impConfirmation: pRea })), ETAT_SAIN);
    assert(dejaActive.modifiants.length === 0 && /deja activee|rien a reactiver/.test(dejaActive.sortie), 'reactiver-file : file déjà activée → aucun cupsenable');
    const accepteDeja = C.executerCups(rea.generate(vRea({ impAction: 'Accepter', impConfirmation: pAcc })), ETAT_SAIN);
    assert(accepteDeja.modifiants.length === 0 && /accepte deja/.test(accepteDeja.sortie), 'reactiver-file : file qui accepte déjà → aucun cupsaccept');
    const rai = C.executerCups(rea.generate(vRea({ impAction: 'Reactiver', impConfirmation: pRea })), ETAT_ARRETEE);
    assert(/Reactiver ne CORRIGE PAS la cause/.test(rai.sortie), 'reactiver-file : le rapport dit que réactiver ne corrige pas la cause de l’arrêt');
    assert(/offline-report/.test(rai.sortie), 'reactiver-file : la raison déclarée est montrée AVANT d’agir');
    assert(!rai.appels.some((a) => ['cupsdisable', 'cupsreject', 'lpadmin', 'cupsctl'].includes(a.cmd)), 'reactiver-file : aucun cupsdisable/cupsreject/lpadmin/cupsctl');
  }
}

// ===========================================================================
section('CONTRE-ÉPREUVES — le banc détecte un appel interdit et une garde retirée');
// ===========================================================================
if (PWSH) {
  // 1. Retirer la garde « Mode Appliquer + phrase » : le script doit alors AGIR en Diagnostic, et le banc doit le voir.
  const garde = '$KjemoAgirDemande = (($KjemoMode -ceq \'Appliquer\') -and $KjemoConfirmeOk)';
  for (const id of Object.keys(ACTION_ATTENDUE)) {
    const t = parId[id];
    const c = F.cas(t);
    const sain = t.generate(F.valeurs(t, { mode: 'Diagnostic', extra: c.extra }));
    assert(sain.includes(garde), `${id} : (préparation) la garde $KjemoAgirDemande existe exactement une fois dans le script`);
    assert(sain.split(garde).length === 2, `${id} : la garde n’apparaît qu’une fois (le remplacement ne peut pas viser autre chose)`);
    const sansGarde = sain.replace(garde, '$KjemoAgirDemande = $true');
    const r = D.executer(sansGarde, c.scenario);
    assert(r.modifiants.length > 0, `contre-épreuve ${id} : garde retirée → le banc VOIT un appel modifiant en Diagnostic (${r.modifiants.map((a) => a.cmd).join('+') || 'aucun'})`);
    // 2. Retirer la confirmation de la porte (PeutAgir) : l'action a lieu même si la cible est absente.
    const sainA = t.generate(F.valeurs(t, { mode: 'Appliquer', extra: c.extra }));
    const porte = /\$KjemoPeutAgir = \(.*\)\n/.exec(sainA);
    assert(porte !== null, `${id} : (préparation) la porte $KjemoPeutAgir existe`);
    if (porte) {
      const sansPorte = sainA.replace(porte[0], '$KjemoPeutAgir = $true\n');
      const scenarioSansCible = { ...c.scenario, printers: [{ ...F.IMPRIMANTE, Name: 'Autre' }], jobs: [], drivers: [], service: { Name: 'Spooler', Status: 'StopPending', StartType: 'Automatic', DependentServices: [] }, admin: false };
      const r2 = D.executer(sansPorte, scenarioSansCible);
      const intact = D.executer(sainA, scenarioSansCible);
      assert(intact.modifiants.length === 0, `${id} : script intact, cible absente → aucun appel modifiant`);
      assert(r2.modifiants.length > 0, `contre-épreuve ${id} : porte retirée → le banc VOIT l’action sur une cible absente (${r2.modifiants.map((a) => a.cmd).join('+') || 'aucun'})`);
    }
  }
  // 3. Un script qui appelle une cmdlet interdite : l'arbre syntaxique la trouve — et ne s'alarme pas sur le script sain.
  const lecture = parId['imp-win-inventaire'].generate(F.valeurs(parId['imp-win-inventaire']));
  const sain = D.violationsPs(D.analyserPs(lecture));
  assert(sain.length === 0, 'contre-épreuve inverse : l’arbre ne signale rien sur le script de lecture intact');
  const cas3 = [
    ['Remove-Printer injecté', lecture.replace('$KjemoFin = Get-Date', 'Remove-Printer -Name "x"\n$KjemoFin = Get-Date'), /Remove-Printer/],
    ['-Force injecté', lecture.replace('$KjemoFin = Get-Date', 'Restart-Service Spooler -Force\n$KjemoFin = Get-Date'), /Force/],
    ['-Confirm:$false injecté', lecture.replace('$KjemoFin = Get-Date', 'Remove-PrintJob -ID 1 -Confirm:$false\n$KjemoFin = Get-Date'), /Confirm/],
    ['Invoke-Expression injecté', lecture.replace('$KjemoFin = Get-Date', 'Invoke-Expression "Get-Date"\n$KjemoFin = Get-Date'), /Invoke-Expression/],
    ['téléchargement injecté', lecture.replace('$KjemoFin = Get-Date', 'Invoke-WebRequest https://exemple.invalid/x\n$KjemoFin = Get-Date'), /Invoke-WebRequest/],
    ['Get-Printer -Name injecté (jokers)', lecture.replace('$KjemoFin = Get-Date', 'Get-Printer -Name "HP*"\n$KjemoFin = Get-Date'), /Get-Printer -Name/],
    ['appel dynamique injecté', lecture.replace('$KjemoFin = Get-Date', '$c = "Remove-Printer"; & $c\n$KjemoFin = Get-Date'), /appel dynamique/],
    ['-WhatIf inventé sur Add-Printer', lecture.replace('$KjemoFin = Get-Date', 'Add-Printer -Name x -WhatIf\n$KjemoFin = Get-Date'), /WhatIf/],
    ['purge du spool', lecture.replace('$KjemoFin = Get-Date', 'Remove-Item C:\\Windows\\System32\\spool\\PRINTERS\\* -Recurse\n$KjemoFin = Get-Date'), /Remove-Item/],
  ];
  for (const [nom, faute, motif] of cas3) {
    const v = D.violationsPs(D.analyserPs(faute));
    assert(v.some((x) => motif.test(x)), `contre-épreuve : l’arbre syntaxique voit « ${nom} » (${v.join(' ; ').slice(0, 90) || 'rien'})`);
  }
  // 4. Le banc d'exécution détecte un appel modifiant dans un script de LECTURE.
  const lectureFautive = parId['imp-win-inventaire'].generate(F.valeurs(parId['imp-win-inventaire'])).replace('$KjemoFin = Get-Date', 'Restart-Service -Name Spooler\n$KjemoFin = Get-Date');
  const rf = D.executer(lectureFautive, F.scenarioNominal());
  assert(rf.modifiants.length === 1 && rf.modifiants[0].cmd === 'Restart-Service', 'contre-épreuve : le banc d’exécution voit un Restart-Service glissé dans un script de lecture');
  // 5. Le banc refuse d'exécuter un script dont le marqueur d'insertion a disparu
  let leve = false;
  try { D.composerScript('# rien'); } catch { leve = true; }
  assert(leve, 'contre-épreuve : le banc refuse un script dont le marqueur d’insertion est absent (les remplacements de contexte ne passent pas en silence)');
  leve = false;
  try { D.composerScript(`${D.MARQUEUR_INSERTION}\n${D.MARQUEUR_INSERTION}`); } catch { leve = true; }
  assert(leve, 'contre-épreuve : le banc refuse un marqueur présent deux fois');
  // 6. Mots interdits dans une conclusion
  assert(D.MOTS_INTERDITS_CONCLUSION.some((re) => re.test('L’imprimante fonctionne.')) && D.MOTS_INTERDITS_CONCLUSION.some((re) => re.test('Problème réparé.')), 'contre-épreuve : le détecteur de conclusion trompeuse reconnaît « fonctionne » et « réparé »');
  // 7. Un -WhatIf inventé sur Add-Printer serait vu (exécution en mode Appliquer : c'est là qu'Add-Printer est appelé)
  {
    const tc = parId['imp-win-config-reseau'];
    const vApp = F.valeurs(tc, { mode: 'Appliquer' });
    const sain = tc.generate(vApp);
    const whatifInvente = sain.replace('Add-Printer -Name $KjemoArgImprimante -DriverName $KjemoArgPilote -PortName $KjemoArgNomPort -ErrorAction Stop', 'Add-Printer -Name $KjemoArgImprimante -DriverName $KjemoArgPilote -PortName $KjemoArgNomPort -WhatIf -ErrorAction Stop');
    assert(whatifInvente !== sain, 'contre-épreuve : (préparation) le -WhatIf inventé est bien injecté dans le script');
    const rs = D.executer(sain, F.cas(tc).scenario);
    assert(rs.appels.some((a) => a.cmd === 'Add-Printer' && !a.whatif), 'contre-épreuve : (préparation) le script sain appelle Add-Printer sans -WhatIf');
    const rw = D.executer(whatifInvente, F.cas(tc).scenario);
    assert(rw.appels.some((a) => a.cmd === 'Add-Printer' && a.whatif), 'contre-épreuve : un -WhatIf ajouté à Add-Printer apparaît dans le journal du banc');
  }
}
// Côté Bash : garde retirée, appel interdit
{
  for (const [id, vals, etat] of [
    ['imp-cups-annuler-travail', { ...F.defauts(parId['imp-cups-annuler-travail']) }, ETAT_MOI],
    ['imp-cups-reactiver-file', { ...F.defauts(parId['imp-cups-reactiver-file']), impAction: 'Reactiver' }, ETAT_ARRETEE],
  ]) {
    const t = parId[id];
    const sain = t.generate(vals);
    const garde = /if \[ "\$\{KJEMO_MANQUANTES\}" -gt 0 \]; then/;
    assert(garde.test(sain), `${id} : (préparation) la porte finale KJEMO_MANQUANTES existe`);
    const sansPorte = sain.replace(garde, 'if false; then');
    const r = C.executerCups(sansPorte, etat);
    assert(r.modifiants.length > 0, `contre-épreuve ${id} : porte finale retirée → le banc VOIT l’action sans confirmation (${r.modifiants.map((a) => a.cmd).join('+') || 'aucun'})`);
    const sainRun = C.executerCups(sain, etat);
    assert(sainRun.modifiants.length === 0, `${id} : le script intact n’agit pas sans confirmation`);
    // Un appel interdit injecté est vu par le banc d'exécution comme par le détecteur de texte
    const injecte = sain.replace('KJEMO_FIN="$(date', 'lpadmin -x "${KJEMO_DEST}"\nKJEMO_FIN="$(date');
    const ri = C.executerCups(injecte, etat);
    assert(ri.modifiants.some((a) => a.cmd === 'lpadmin'), `contre-épreuve ${id} : un lpadmin injecté est VU par le banc d’exécution`);
    assert(INTERDITS_SH.some(([re]) => re.test(sansCommentairesSh(injecte))), `contre-épreuve ${id} : un lpadmin injecté est VU par le détecteur de texte`);
    assert(!INTERDITS_SH.some(([re]) => re.test(sansCommentairesSh(sain))), `contre-épreuve inverse ${id} : le détecteur ne s’alarme pas sur le script intact`);
  }
  // Un script de lecture qui annulerait un travail
  const inv = parId['imp-cups-inventaire'];
  const fauteInv = inv.generate(F.valeurs(inv)).replace('KJEMO_FIN="$(date', 'cancel HP_LaserJet_Accueil-1\nKJEMO_FIN="$(date');
  const rv = C.executerCups(fauteInv, ETAT_SAIN);
  assert(rv.modifiants.length === 1 && rv.modifiants[0].cmd === 'cancel', 'contre-épreuve : un cancel glissé dans l’inventaire est VU par le banc d’exécution');
  // systemctl restart
  const fauteSys = inv.generate(F.valeurs(inv)).replace('KJEMO_FIN="$(date', 'systemctl restart cups\nKJEMO_FIN="$(date');
  const rs = C.executerCups(fauteSys, ETAT_SAIN);
  assert(rs.modifiants.some((a) => a.cmd === 'systemctl'), 'contre-épreuve : un « systemctl restart cups » glissé dans l’inventaire est VU');
  assert(INTERDITS_SH.some(([re]) => re.test(fauteSys)), 'contre-épreuve : le détecteur de texte voit « systemctl restart »');
}

// ===========================================================================
section('Rapports et confidentialité : formats JSON/CSV, injection de formule, aucun secret');
// ===========================================================================
if (PWSH) {
  const t = parId['imp-win-inventaire'];
  const dossier = mkdtempSync(join(tmpdir(), 'kjemo-imp-rapport-'));
  try {
    const jeu = (format, nom) => {
      const sc = F.scenarioNominal({ printers: [{ ...F.IMPRIMANTE, Name: nom, Comment: 'x' }], jobs: [] });
      return { script: t.generate(F.valeurs(t, { extra: { impFormat: format } })), sc };
    };
    for (const fmt of ['JSON', 'CSV']) {
      const { script, sc } = jeu(fmt, '=HYPERLINK(1)');
      // Le nom commence par « = » : le validateur de la fiche le refuse pour les champs, mais une imprimante réelle pourrait le porter.
      const dir = join(dossier, fmt);
      const r = spawnSync('pwsh', ['-NoProfile', '-File', (() => { const f = join(dossier, `${fmt}.ps1`); writeFileSync(f, D.composerScript(script), 'utf8'); return f; })()], {
        cwd: (() => { spawnSync('mkdir', ['-p', dir]); return dir; })(),
        env: { ...process.env, KJEMO_SCENARIO: JSON.stringify(sc), KJEMO_LOG: join(dossier, `${fmt}.log`) }, encoding: 'utf8',
      });
      writeFileSync(join(dossier, `${fmt}.log`), '', { flag: 'a' });
      const m = /Rapport (JSON|CSV) : (.+)$/m.exec(r.stdout);
      assert(m !== null, `inventaire : le format ${fmt} écrit un fichier de rapport et l’annonce`);
      if (m) {
        const contenu = readFileSync(m[2].trim(), 'utf8');
        if (fmt === 'JSON') { let okJson = true; try { JSON.parse(contenu); } catch { okJson = false; } assert(okJson, 'inventaire : le rapport JSON est un JSON valide'); }
        else {
          assert(!/(^|,)"=HYPERLINK/m.test(contenu) && /'=HYPERLINK/.test(contenu), 'inventaire : une cellule CSV qui commence par « = » est neutralisée (anti-injection de formule)');
        }
      }
    }
  } finally { rmSync(dossier, { recursive: true, force: true }); }
}
{
  // Aucun script généré, avec valeurs par défaut ou hostiles acceptées, ne contient de secret ; les URI sont masquées.
  for (const t of imprimantes) {
    const s = t.generate(F.valeurs(t, { extra: F.cas(t).extra }));
    assert(!/password\s*=\s*['"]?[^'"\s]{3,}|ConvertTo-SecureString|-AsPlainText|BEGIN [A-Z ]*PRIVATE KEY/i.test(s), `${t.id} : aucun mot de passe ni clé privée embarqué`);
    assert(/MASQUE|Hide-KjemoSecrets|kjemo_masquer_uri/.test(s), `${t.id} : le script masque les secrets avant de les écrire dans un rapport`);
  }
  const t = parId['imp-win-reseau'];
  for (const h of ['user:pass@192.168.30.50', 'http://admin:pw@192.168.30.50']) {
    assert(Object.keys(t.validate(F.valeurs(t, { extra: { impHote: h } }))).length > 0, `reseau : hôte avec identifiants refusé (${h})`);
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== NON EXÉCUTÉ (déclaré, jamais compté PASS) ===');
console.log(`  Windows PowerShell 5.1 : NON EXÉCUTÉ (les scripts sont exécutés par PowerShell ${PWSH ?? '(absent)'} sous Linux, avec des doubles ; l'analyse syntaxique n'est pas une exécution sous 5.1).`);
console.log('  Module PrintManagement réel, spouleur réel, Win32_Printer réel : NON EXÉCUTÉ (remplacés par des doubles).');
console.log('  cupsd réel, lpstat/cancel/cupsenable/cupsaccept réels : NON EXÉCUTÉ (remplacés par de faux binaires).');
console.log('  Imprimante physique, serveur d’impression, partage UNC réel : NON EXÉCUTÉ.');
console.log('  Sortie papier : jamais constatée. Un double n’est pas une imprimante.');
console.log('  Détection de secrets : heuristique, pas une garantie universelle.');
console.log(`\nBanc des assistants Imprimantes : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
if (echecs.length) { for (const e of echecs.slice(0, 60)) console.log(`  - ${e}`); process.exit(1); }
