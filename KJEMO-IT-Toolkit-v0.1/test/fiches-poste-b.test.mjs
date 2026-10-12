#!/usr/bin/env node
/**
 * fiches-poste-b.test.mjs — LOT 6B · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Contrôle fiche par fiche des 18 assistants du LOT 6B.
 *
 * identity.test.mjs éprouve le catalogue entier avec plus de quarante mille
 * assertions ; ce banc-ci est volontairement petit et ciblé : il dit TOUT DE
 * SUITE, outil par outil, ce qui manque. Il a été écrit pendant la rédaction
 * du lot, et il reste au dépôt parce que les défauts qu'il attrape sont ceux
 * qui coûtent le plus cher quand on les découvre à la fin :
 *
 *   - une fiche incomplète (un des 22 champs du contrat absent);
 *   - un risque « caution » ou « destructive » sans requiresAdmin;
 *   - une validation qui refuse ses propres valeurs par défaut;
 *   - un generate() qui lève;
 *   - un motif interdit dans le CODE du script (commentaires retirés : un
 *     script peut DIRE ce qu'il ne fait pas, et doit pouvoir le dire);
 *   - un script que le parseur PowerShell refuse.
 *
 * Le moteur PowerShell est IMPOSÉ : --powershell <exe>. Si l'exécutable
 * demandé est absent, le banc échoue. Il ne se rabat jamais sur l'autre
 * moteur — un résultat obtenu sous PowerShell 7 ne dit rien de 5.1.
 *
 * Usage : node test/fiches-poste-b.test.mjs [--powershell pwsh] [idOutil ...]
 * Exit 0 = tout OK, exit 1 = au moins un défaut.
 */

import { resolve, dirname, join }       from 'node:path';
import { writeFileSync, mkdtempSync, rmSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync }                 from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir }                       from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const argv = process.argv.slice(2);
const iPs  = argv.indexOf('--powershell');
const PS   = iPs >= 0 ? argv[iPs + 1] : 'pwsh';
if (iPs >= 0 && !PS) {
  console.error('--powershell attend le nom ou le chemin d’un exécutable.');
  process.exit(1);
}
const cibles = argv.filter((a, i) => !a.startsWith('--') && i !== iPs + 1);

const { toolsPosteB } = await import(
  pathToFileURL(resolve(ROOT, 'dist', 'outils-poste-b.mjs')).href);

// ---------------------------------------------------------------------------
// Le contrat d'une fiche, tel que l'application l'attend.
// ---------------------------------------------------------------------------
const CHAMPS = ['id', 'icon', 'category', 'subcategory', 'title', 'risk', 'summary', 'fields',
  'validate', 'generate', 'gui', 'keywords', 'requiresAdmin', 'os', 'prereqs', 'commonErrors',
  'reversible', 'verifyAfter', 'rollback', 'checks', 'source', 'sources'];

const INTERDITS = [
  [/-Confirm:\$false/i,            '-Confirm:$false'],
  [/\bInvoke-Expression\b/i,       'Invoke-Expression'],
  [/\bSet-ExecutionPolicy\b/i,     'Set-ExecutionPolicy'],
  [/ConvertTo-SecureString/i,      'ConvertTo-SecureString'],
  [/-AsPlainText/i,                '-AsPlainText'],
  [/DownloadString|DownloadFile/i, 'téléchargement direct'],
  [/-OutFile\b/i,                  '-OutFile'],
  [/Start-BitsTransfer/i,          'Start-BitsTransfer'],
  [/^\s*exit\b/mi,                 'exit en début de ligne — fermerait la console'],
  [/\[Environment\]::Exit/i,       '[Environment]::Exit'],
  [/\bRestart-Computer\b/i,        'Restart-Computer'],
  [/\bStop-Computer\b/i,           'Stop-Computer'],
  [/’/,                       'apostrophe typographique dans le script'],
  [/-Recurse\s+-Force|-Force\s+-Recurse/i, 'Remove-Item -Recurse -Force'],
  [/Set-NetFirewallProfile[^\n]*-Enabled\s+False/i, 'désactivation d’un profil de pare-feu'],
  [/Set-MpPreference[^\n]*DisableRealtimeMonitoring\s*\$?true/i, 'désactivation de Defender'],
  [/Add-MpPreference|Remove-MpPreference/i, 'modification des exclusions Defender'],
  [/New-LocalUser|Add-LocalGroupMember|Set-LocalUser/i, 'création ou modification de compte local'],
  [/Remove-Item[^\n]*ProfileList/i, 'suppression dans ProfileList'],
  [/\bbcdedit\b[^\n]*\/set/i,       'écriture dans le BCD'],
];

/**
 * Retire les commentaires et les lignes Write-Host.
 *
 * Un script doit pouvoir ÉCRIRE « ce script ne lance jamais Restart-Computer »
 * sans que le banc y voie un Restart-Computer. On ne juge donc que le code qui
 * s'exécute. Le banc d'identité, lui, scanne en plus le script BRUT pour une
 * courte liste de littéraux vraiment interdits : les deux strictesses se
 * complètent, et aucune des deux n'est relâchée ici.
 */
function codeSeul(s) {
  return s.split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .filter((l) => !/^\s*Write-Host\b/.test(l))
    .join('\n');
}

/**
 * Vide le CONTENU des littéraux de chaîne, en gardant les guillemets.
 *
 * Pourquoi : la première version de ce banc cherchait « bcdedit …/set » dans
 * le code débarrassé de ses commentaires, et accusait safe-mode-preparation.
 * À tort. Cet assistant n'écrit JAMAIS dans le BCD : la commande apparaît
 * uniquement comme TEXTE, dans la valeur d'un Add-KjemoResultat, en aperçu
 * documentaire, accompagnée de son annulation — ce que le lot exige
 * explicitement. La règle confondait « nommer une commande » et « l'exécuter ».
 *
 * Elle n'a pas été supprimée : elle a été rendue plus précise. On cherche
 * désormais les motifs interdits dans le code dont les chaînes sont vidées,
 * donc seulement là où ils seraient réellement exécutés. Et parce qu'une règle
 * plus précise doit rester au moins aussi protectrice, un contrôle SUPPLÉMENTAIRE
 * s'ajoute : toute mention de bcdedit /set ou /deletevalue dans le texte doit
 * être marquée « NON EXECUTE » et accompagnée de la commande d'annulation.
 *
 * Un appel interdit caché dans une chaîne puis exécuté resterait détecté :
 * il lui faudrait Invoke-Expression ou &, et le nom de la commande ne serait
 * alors pas dans une chaîne.
 */
function sansChaines(code) {
  let sortie = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === "'" || c === '"') {
      const q = c;
      sortie += q;
      i += 1;
      while (i < code.length) {
        if (code[i] === q && code[i + 1] === q) { i += 2; continue; }  // '' ou "" échappé
        if (code[i] === q) { break; }
        if (code[i] === '\n') { break; }                               // chaîne non fermée sur la ligne
        i += 1;
      }
      if (code[i] === q) { sortie += q; i += 1; }
      continue;
    }
    sortie += c;
    i += 1;
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// LE BOM DES FICHIERS TEMPORAIRES
//
// Windows PowerShell 5.1 ne devine pas l'UTF-8 : sans marque d'ordre des
// octets, il relit le fichier en CP1252. Les trois octets du tiret cadratin
// « — » (U+2014 : EF BB BF mis a part, E2 80 94) deviennent alors trois
// caracteres, dont 0x94 qui vaut U+201D — un guillemet-virgule double
// fermant. Or PowerShell accepte ce guillemet typographique comme un VRAI
// delimiteur de chaine. Le tiret cadratin ferme donc la chaine en cours, et
// le mot qui suit devient un jeton nu :
//
//   $KjemoConclusion = "... point(s) a examiner — voir la section ..."
//   Unexpected token 'voir' in expression or statement.
//
// C'est exactement l'erreur que la CI a renvoyee pour les 18 outils. Ce n'est
// PAS un defaut des 856 scripts generes : ceux-la portent un BOM et passent
// l'etape globale de parsing 5.1. C'etait ce banc-ci qui ecrivait ses
// fichiers temporaires sans BOM.
//
// PowerShell 7 lit l'UTF-8 par defaut : le defaut est donc INVISIBLE sous
// pwsh et fatal sous 5.1. D'ou la verification des octets reellement ecrits,
// qui ne depend d'aucun moteur.
// ---------------------------------------------------------------------------
const BOM_UTF8 = Buffer.from([0xEF, 0xBB, 0xBF]);

/** Les trois premiers octets du fichier, tels qu'ils sont sur le disque. */
function troisPremiersOctets(chemin) {
  const tete = Buffer.alloc(3);
  const fd = openSync(chemin, 'r');
  try { readSync(fd, tete, 0, 3, 0); } finally { closeSync(fd); }
  return tete;
}

/**
 * Ecrit un .ps1 temporaire avec BOM, puis RELIT le fichier pour exiger les
 * trois octets EF BB BF. On ne se contente pas d'avoir ecrit le BOM : on
 * verifie qu'il est la. Leve si ce n'est pas le cas — le banc doit echouer
 * plutot que de confier au parseur un fichier qu'il va mal lire.
 */
function ecrirePs1AvecBom(chemin, contenu) {
  writeFileSync(chemin, Buffer.concat([BOM_UTF8, Buffer.from(contenu, 'utf8')]));
  const tete = troisPremiersOctets(chemin);
  if (!tete.equals(BOM_UTF8)) {
    throw new Error(
      `BOM UTF-8 absent de ${chemin} — octets lus : ${tete.toString('hex').toUpperCase()}, `
      + 'attendus : EFBBBF');
  }
  return chemin;
}

const travail = mkdtempSync(join(tmpdir(), 'kjemo-fiches-6b-'));
let ko = 0, controles = 0, octetsVerifies = 0;

const outils = cibles.length
  ? toolsPosteB.filter((o) => cibles.includes(o.id))
  : toolsPosteB;

if (!cibles.length && outils.length !== 18) {
  console.error(`  [KO]    le LOT 6B doit exporter 18 assistants, ${outils.length} trouvé(s).`);
  ko += 1;
}
if (cibles.length && outils.length !== cibles.length) {
  console.error(`  [KO]    identifiant(s) introuvable(s) : ${
    cibles.filter((c) => !toolsPosteB.some((o) => o.id === c)).join(', ')}`);
  ko += 1;
}

// Le moteur demandé doit répondre, et dire qui il est. Pas de repli.
let versionPs = null;
try {
  versionPs = execFileSync(PS, ['-NoProfile', '-Command',
    '$PSVersionTable.PSVersion.ToString() + " / " + $PSVersionTable.PSEdition'],
    { encoding: 'utf8' }).trim();
} catch (e) {
  console.error(`  [KO]    interpréteur « ${PS} » indisponible : ${e.message}`);
  console.error('          Ce banc ne se rabat sur aucun autre moteur.');
  rmSync(travail, { recursive: true, force: true });
  process.exit(1);
}
console.log(`Moteur imposé : ${PS} (${versionPs})`);
console.log('');

for (const o of outils) {
  controles += 1;
  const pb = [];

  for (const c of CHAMPS) {
    if (o[c] === undefined || o[c] === null) pb.push(`champ « ${c} » absent`);
  }
  if (o.category !== 'Poste de travail Windows') {
    pb.push(`catégorie « ${o.category} » au lieu de « Poste de travail Windows »`);
  }
  if (!['diagnostic', 'safe', 'caution', 'destructive'].includes(o.risk)) {
    pb.push(`risk invalide : ${o.risk}`);
  }
  if (['caution', 'destructive'].includes(o.risk) && o.requiresAdmin !== true) {
    pb.push('risque caution/destructive sans requiresAdmin');
  }
  if ((o.gui || []).length < 4)         pb.push(`${(o.gui || []).length} étape(s) graphique(s), 4 minimum`);
  if ((o.verifyAfter || []).length < 3) pb.push(`${(o.verifyAfter || []).length} vérification(s) après, 3 minimum`);
  if ((o.checks || []).length < 3)      pb.push(`${(o.checks || []).length} contrôle(s) avant, 3 minimum`);
  if ((o.keywords || []).length < 8)    pb.push(`${(o.keywords || []).length} mot(s)-clé(s), 8 minimum`);
  if ((o.commonErrors || []).length < 2) pb.push('moins de deux erreurs fréquentes');
  if ((o.prereqs || []).length < 1)     pb.push('aucun prérequis');
  if (!String(o.source || '').startsWith('https://learn.microsoft.com/')) {
    pb.push(`source hors learn.microsoft.com : ${o.source}`);
  }
  if (!(o.sources || []).length) pb.push('aucune source secondaire');
  if (!(o.os || []).some((x) => /Windows Server 2019/.test(x))) pb.push('os sans « Windows Server 2019 »');
  if (!(o.os || []).some((x) => /5\.1/.test(x)))                pb.push('os sans « 5.1 »');
  for (const k of ['summary', 'diagnostic', 'command', 'warning']) {
    if (!o.rollback || !o.rollback[k]) pb.push(`rollback.${k} absent`);
  }

  const estDiag = o.risk === 'diagnostic';
  if (estDiag && !(o.fields || []).some((f) => /Format/i.test(f.label || ''))) {
    pb.push('outil diagnostique sans champ Format');
  }
  if (!estDiag) {
    const cm = (o.fields || []).find((f) => f.id === 'mode');
    if (!cm) pb.push('outil modifiant sans champ mode');
    else if (cm.default !== 'Diagnostic') {
      pb.push(`champ mode par défaut « ${cm.default} » au lieu de Diagnostic`);
    }
  }

  // La validation doit accepter ses propres valeurs par défaut : sinon la
  // fiche s'ouvre déjà en erreur, et personne ne sait quoi corriger.
  const v    = Object.fromEntries((o.fields || []).map((f) => [f.id, String(f.default ?? '')]));
  const errs = o.validate(v);
  if (Object.keys(errs).length) {
    pb.push(`la validation refuse ses propres défauts : ${JSON.stringify(errs)}`);
  }

  let script = null;
  try { script = o.generate(v); } catch (e) { pb.push(`generate() lève : ${e.message}`); }

  if (script) {
    const nu = sansChaines(codeSeul(script));
    for (const [re, nom] of INTERDITS) {
      if (re.test(nu)) pb.push(`motif interdit dans le CODE : ${nom}`);
    }
    // Contrôle supplémentaire : le texte peut NOMMER une commande d'écriture
    // du BCD, mais seulement en aperçu marqué et avec son annulation.
    if (/bcdedit[^\n]*\/(set|deletevalue)/i.test(script)) {
      if (!/NON EXECUTE/i.test(script)) {
        pb.push('bcdedit /set ou /deletevalue cité sans la mention « NON EXECUTE »');
      }
      if (!/bcdedit[^\n]*\/deletevalue/i.test(script)) {
        pb.push('bcdedit /set cité sans la commande d’annulation /deletevalue');
      }
      if (/(^|[\s;|&(])(&\s*)?bcdedit(\.exe)?[^\n]*\/(set|deletevalue)/im.test(nu)) {
        pb.push('bcdedit /set ou /deletevalue en position d’EXÉCUTION');
      }
    }
    if (!/\$KjemoVersion = 'LOT 6 — Poste de travail Windows — 6\.0\.0'/.test(script)) {
      pb.push('ligne de version du lot absente');
    }
    const f = resolve(travail, `${o.id}.ps1`);
    // Avec BOM, et le BOM verifie sur le disque : voir ecrirePs1AvecBom.
    // Si le BOM manque, on NE confie pas le fichier au parseur : son verdict
    // ne dirait rien de la fiche, seulement de l'encodage. Mais le defaut est
    // consigne et l'outil compte comme en defaut — on ne saute pas le compte.
    let ecrit = false;
    try {
      ecrirePs1AvecBom(f, script);
      octetsVerifies += 1;
      ecrit = true;
    } catch (e) {
      pb.push(e.message);
    }
    if (ecrit) {
      const commande = '$e=$null;$t=$null;'
        + `$null=[System.Management.Automation.Language.Parser]::ParseFile(${JSON.stringify(f)},[ref]$t,[ref]$e);`
        + 'if($e.Count){ "ERR " + $e[0].Extent.StartLineNumber + " : " + $e[0].Message } else { "OK" }';
      try {
        const out = execFileSync(PS, ['-NoProfile', '-Command', commande], { encoding: 'utf8' }).trim();
        if (out !== 'OK') pb.push(`parseur PowerShell : ${out}`);
      } catch (e) {
        pb.push(`appel au parseur en échec : ${e.message}`);
      }
    }
  }

  if (pb.length === 0) {
    console.log(`  [OK]    ${o.id} — ${o.subcategory} — ${o.risk}`);
  } else {
    ko += 1;
    console.log(`  [KO]    ${o.id}`);
    pb.forEach((x) => console.log(`            ${x}`));
  }
}

// ---------------------------------------------------------------------------
// CONTRE-ÉPREUVE DU BANC
//
// Une règle assouplie qui ne détecte plus rien passe tous les tests. On
// introduit donc volontairement, dans une COPIE du script de
// safe-mode-preparation, la ligne que la règle doit attraper — un bcdedit en
// position d'exécution — et on vérifie que le banc la voit. Puis on vérifie
// qu'il voit aussi un aperçu documentaire privé de son annulation.
// Un banc qui ne trouve rien n'est pas une preuve.
// ---------------------------------------------------------------------------
{
  const sme = toolsPosteB.find((o) => o.id === 'safe-mode-preparation');
  const base = sme.generate(Object.fromEntries(
    sme.fields.map((f) => [f.id, String(f.default ?? '')])));

  const verifier = (texte) => {
    const nu = sansChaines(codeSeul(texte));
    const vus = [];
    for (const [re, nom] of INTERDITS) if (re.test(nu)) vus.push(nom);
    if (/bcdedit[^\n]*\/(set|deletevalue)/i.test(texte)) {
      if (!/NON EXECUTE/i.test(texte)) vus.push('aperçu non marqué');
      if (!/bcdedit[^\n]*\/deletevalue/i.test(texte)) vus.push('annulation absente');
      if (/(^|[\s;|&(])(&\s*)?bcdedit(\.exe)?[^\n]*\/(set|deletevalue)/im.test(nu)) {
        vus.push('exécution du BCD');
      }
    }
    return vus;
  };

  const sain = verifier(base);
  if (sain.length === 0) {
    console.log('  [OK]    contre-épreuve — le script d’origine ne déclenche aucune règle');
  } else {
    ko += 1;
    console.log(`  [KO]    contre-épreuve — le script d’origine déclenche : ${sain.join(', ')}`);
  }

  const execute = verifier(base + '\n& bcdedit.exe /set {default} safeboot minimal\n');
  if (execute.includes('exécution du BCD')) {
    console.log('  [OK]    contre-épreuve — un bcdedit /set exécuté EST détecté');
  } else {
    ko += 1;
    console.log(`  [KO]    contre-épreuve — un bcdedit /set exécuté passe inaperçu (${execute.join(', ') || 'rien'})`);
  }

  const sansAnnulation = verifier(base.split('/deletevalue').join('/enum'));
  if (sansAnnulation.includes('annulation absente')) {
    console.log('  [OK]    contre-épreuve — un aperçu privé de son annulation EST détecté');
  } else {
    ko += 1;
    console.log(`  [KO]    contre-épreuve — l’absence d’annulation passe inaperçue (${sansAnnulation.join(', ') || 'rien'})`);
  }

  const sansMarque = verifier(base.split('NON EXECUTE').join('execute'));
  if (sansMarque.includes('aperçu non marqué')) {
    console.log('  [OK]    contre-épreuve — un aperçu non marqué EST détecté');
  } else {
    ko += 1;
    console.log(`  [KO]    contre-épreuve — l’absence de marque passe inaperçue (${sansMarque.join(', ') || 'rien'})`);
  }
}

// ---------------------------------------------------------------------------
// CONTRE-ÉPREUVE DU BOM DES FICHIERS TEMPORAIRES
//
// Une garde qui ne refuse jamais rien ressemble à une garde qui passe. On
// éprouve donc les deux sens au niveau OCTET — indépendamment de tout moteur
// PowerShell — puis, si le moteur imposé est Windows PowerShell 5.1, on
// démontre en plus que l'absence de BOM reproduit vraiment l'erreur de la CI.
// ---------------------------------------------------------------------------
{
  const bac = mkdtempSync(join(tmpdir(), 'kjemo-bom-6b-'));
  try {
    // Un extrait fidèle : la ligne qui a fait tomber les 18 outils en CI.
    // Le tiret cadratin y est à l'intérieur d'une chaîne à guillemets doubles.
    const extrait = '$KjemoVersion = \'LOT 6 — Poste de travail Windows — 6.0.0\'\n'
      + '$KjemoConclusion = "1 point(s) à examiner — voir la section Avertissements."\n'
      + 'Write-Output $KjemoConclusion\n';

    // 1. La garde accepte une copie AVEC BOM.
    const avec = join(bac, 'avec-bom.ps1');
    let acceptee = true;
    let messageAcceptee = '';
    try { ecrirePs1AvecBom(avec, extrait); }
    catch (e) { acceptee = false; messageAcceptee = e.message; }
    if (acceptee && troisPremiersOctets(avec).equals(BOM_UTF8)) {
      console.log('  [OK]    contre-épreuve BOM — une copie AVEC BOM est acceptée, octets EF BB BF vérifiés');
    } else {
      ko += 1;
      console.log(`  [KO]    contre-épreuve BOM — une copie avec BOM est refusée à tort (${messageAcceptee})`);
    }

    // 2. La garde refuse une copie SANS BOM. On écrit le fichier exactement
    //    comme ce banc le faisait avant le correctif, puis on demande à la
    //    garde de se prononcer sur les octets réellement présents.
    const sans = join(bac, 'sans-bom.ps1');
    writeFileSync(sans, extrait, 'utf-8');
    const teteSans = troisPremiersOctets(sans);
    if (!teteSans.equals(BOM_UTF8)) {
      console.log(`  [OK]    contre-épreuve BOM — une copie SANS BOM est bien reconnue comme telle (octets ${teteSans.toString('hex').toUpperCase()})`);
    } else {
      ko += 1;
      console.log('  [KO]    contre-épreuve BOM — une copie sans BOM passe pour conforme');
    }

    // 3. Et la garde doit LEVER sur ce fichier-là si on le lui soumet après
    //    l'avoir réécrit sans BOM dans son dos : c'est la vérification de
    //    relecture qui doit parler, pas l'intention de l'écriture.
    let aLeve = false;
    let detail = '';
    try {
      ecrirePs1AvecBom(sans, extrait);        // réécrit AVEC BOM
      writeFileSync(sans, extrait, 'utf-8');  // quelqu'un le réécrit SANS
      const tete = troisPremiersOctets(sans);
      if (!tete.equals(BOM_UTF8)) {
        aLeve = true;
        detail = tete.toString('hex').toUpperCase();
      }
    } catch { /* la levée est le cas 2, déjà couvert */ }
    if (aLeve) {
      console.log(`  [OK]    contre-épreuve BOM — la vérification porte sur le disque, pas sur l’intention (octets ${detail})`);
    } else {
      ko += 1;
      console.log('  [KO]    contre-épreuve BOM — la vérification ne lit pas le fichier réellement écrit');
    }

    // 4. Le mécanisme lui-même, prouvé par un VRAI parseur PowerShell.
    //    On fabrique le texte que PowerShell 5.1 obtient d'un UTF-8 sans BOM
    //    — les octets réinterprétés en CP1252 — et on le soumet au moteur
    //    imposé. Cela vaut sous 5.1 comme sous 7 : le défaut n'est pas dans
    //    le moteur, il est dans le texte que le moteur reçoit.
    const CP1252_HAUT = {
      0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
      0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
      0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’',
      0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
      0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ',
      0x9e: 'ž', 0x9f: 'Ÿ',
    };
    const commeCp1252 = (texte) => Buffer.from(texte, 'utf8').toString('latin1')
      .replace(/[\u0080-\u009f]/g, (c) => CP1252_HAUT[c.charCodeAt(0)] ?? c);

    const analyser = (chemin) => {
      const cmd = '$e=$null;$t=$null;'
        + `$null=[System.Management.Automation.Language.Parser]::ParseFile(${JSON.stringify(chemin)},[ref]$t,[ref]$e);`
        + 'if($e.Count){ "ERR " + $e[0].Message } else { "OK" }';
      try {
        return execFileSync(PS, ['-NoProfile', '-Command', cmd], { encoding: 'utf8' }).trim();
      } catch (e) {
        return `APPEL EN ECHEC : ${e.message}`;
      }
    };

    // Si la garde est en panne, ecrirePs1AvecBom leve ici aussi : on le
    // consigne comme un defaut plutot que de laisser tomber le banc sur une
    // trace de pile, qui dit la meme chose en moins clair.
    const mojibake = join(bac, 'mojibake.ps1');
    let verdictMojibake = 'NON ECRIT';
    let verdictAvecBom  = 'NON ECRIT';
    try {
      ecrirePs1AvecBom(mojibake, commeCp1252(extrait));
      verdictMojibake = analyser(mojibake);
      verdictAvecBom  = analyser(avec);
    } catch (e) {
      ko += 1;
      console.log(`  [KO]    contre-épreuve BOM — impossible d’écrire les copies de démonstration : ${e.message}`);
    }

    if (verdictMojibake.startsWith('ERR')) {
      console.log(`  [OK]    contre-épreuve BOM — le texte relu en CP1252 EST refusé par ${PS} : ${verdictMojibake.slice(0, 64)}`);
    } else {
      ko += 1;
      console.log(`  [KO]    contre-épreuve BOM — le texte relu en CP1252 passe l’analyse (${verdictMojibake})`);
    }
    if (verdictAvecBom === 'OK') {
      console.log(`  [OK]    contre-épreuve BOM — le même extrait, lu en UTF-8, est accepté par ${PS}`);
    } else {
      ko += 1;
      console.log(`  [KO]    contre-épreuve BOM — l’extrait correct est refusé (${verdictAvecBom})`);
    }

    // 5. Sous Windows PowerShell 5.1 seulement, la démonstration complète :
    //    le MÊME contenu, sans BOM, relu par le moteur lui-même. Sous
    //    PowerShell 7 c'est impossible — pwsh lit l'UTF-8 par défaut et
    //    accepterait le fichier : on ne prétend donc rien dans ce cas.
    const est51 = /^5\./.test(String(versionPs ?? ''));
    if (est51) {
      const verdictSans = analyser(sans);   // le fichier est sans BOM (cas 3)
      if (verdictSans.startsWith('ERR')) {
        console.log(`  [OK]    contre-épreuve BOM — sous PowerShell 5.1, le fichier SANS BOM est refusé : ${verdictSans.slice(0, 64)}`);
      } else {
        ko += 1;
        console.log(`  [KO]    contre-épreuve BOM — sous PowerShell 5.1, un fichier sans BOM passe (${verdictSans})`);
      }
    } else {
      console.log(`  [INFO]  contre-épreuve BOM — relecture réelle d’un fichier sans BOM NON EXÉCUTÉE : ${PS} (${versionPs}) lit l’UTF-8 par défaut, seul Windows PowerShell 5.1 reproduit le défaut`);
    }

    // 6. Et le compte : chaque outil contrôlé a bien eu ses octets vérifiés.
    if (octetsVerifies === controles) {
      console.log(`  [OK]    BOM vérifié sur le disque pour les ${octetsVerifies} fichier(s) temporaire(s) soumis au parseur`);
    } else {
      ko += 1;
      console.log(`  [KO]    BOM vérifié pour ${octetsVerifies} fichier(s) seulement, sur ${controles} contrôlé(s)`);
    }
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

rmSync(travail, { recursive: true, force: true });
console.log('');
console.log(`Fiches du LOT 6B : ${controles} outil(s) contrôlé(s), ${ko} en défaut — ${PS} (${versionPs}).`);
if (ko > 0) process.exit(1);
