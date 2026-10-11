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
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
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

const travail = mkdtempSync(join(tmpdir(), 'kjemo-fiches-6b-'));
let ko = 0, controles = 0;

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
    writeFileSync(f, script, 'utf-8');
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

rmSync(travail, { recursive: true, force: true });
console.log('');
console.log(`Fiches du LOT 6B : ${controles} outil(s) contrôlé(s), ${ko} en défaut — ${PS} (${versionPs}).`);
if (ko > 0) process.exit(1);
