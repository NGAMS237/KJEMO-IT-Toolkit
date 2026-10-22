#!/usr/bin/env node
/**
 * azure-assistants.test.mjs — LOT 8 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Banc des 24 assistants Azure et Microsoft Entra ID.
 *
 * TROIS NIVEAUX DE PREUVE, NE JAMAIS CONFONDUS
 *
 *   SYNTAXE    le script est lu par l'analyseur PowerShell 7 (AST). Un script qui
 *              se lit n'est pas un script qui marche.
 *   DOUBLURES  le script est EXÉCUTÉ par pwsh contre des fonctions factices qui
 *              reproduisent les paramètres documentés des commandes Az et Graph.
 *              Cela prouve les appels, les gardes et les refus. Cela ne prouve
 *              PAS que le service réel répond comme la doublure.
 *   RÉEL       un essai sur un vrai tenant. Ce banc n'en fait AUCUN : aucune
 *              connexion, aucun tenant, aucune ressource, aucun abonnement.
 *              Il le déclare NON EXÉCUTÉ en fin de sortie, et n'écrit jamais PASS
 *              pour ce qu'il n'a pas exécuté.
 *
 * Windows PowerShell 5.1 n'est pas exécutable ici : il est déclaré NON EXÉCUTÉ.
 * Le banc contrôle seulement, par l'AST, l'absence de syntaxe réservée à
 * PowerShell 7 — un indice, pas une preuve.
 *
 * CONTRE-ÉPREUVES. Un contrôle qui n'a jamais échoué ne prouve rien. Chaque
 * garde essentielle est donc éprouvée sur un script volontairement mutilé
 * (connexion ajoutée, -ErrorAction retiré, garde de confirmation affaiblie…) et
 * le banc exige que la mutilation soit DÉTECTÉE.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const AZ = join(__dirname, 'azure');

let ok = 0;
const echecs = [];
const assert = (cond, msg) => {
  if (cond) { ok += 1; console.log(`  [OK]    ${msg}`); }
  else { echecs.push(msg); console.log(`  [FAIL]  ${msg}`); }
};
const section = (t) => console.log(`\n--- ${t} ---`);

const { tools } = await import(pathToFileURL(join(ROOT, 'dist/generators.mjs')).href);
const { CMDLETS_INTERDITES } = await import(pathToFileURL(join(ROOT, 'dist/cmdlets.mjs')).href);
const { MOTIFS_SECRETS } = await import(pathToFileURL(join(ROOT, 'dist/validateurs-azure.mjs')).href);
const azure = tools.filter((t) => t.category === 'Azure et Entra ID');
const parId = Object.fromEntries(azure.map((t) => [t.id, t]));

// ---------------------------------------------------------------------------
// Valeurs de génération
// ---------------------------------------------------------------------------
const TENANT = 'bbbbbbbb-1111-2222-3333-444444444444';
const ABONNEMENT = 'aaaaaaaa-1111-2222-3333-444444444444';
const SPECIFIQUE = {
  'azure-stockage-exposition': { azRg: 'rg-lab', azCompte: 'stlabdemo001' },
  'azure-sauvegarde-restauration': {
    azRgCoffre: 'rg-lab', azCoffre: 'rsv-lab', azRgVm: 'rg-lab', azVm: 'vm-lab-01',
    azRgCible: 'rg-lab-restore', azStockage: 'stlabtransit01', azRgStockage: 'rg-lab-restore',
  },
};
const defauts = (t) => Object.fromEntries(t.fields.map((f) => [f.id, String(f.default ?? '')]));
function valeursReelles(t, extra = {}) {
  const v = defauts(t);
  v.azTenant = TENANT;
  if (v.azAbonnement !== undefined) v.azAbonnement = ABONNEMENT;
  return { ...v, ...(SPECIFIQUE[t.id] ?? {}), ...extra };
}
const BOM = '﻿';

// ---------------------------------------------------------------------------
// pwsh
// ---------------------------------------------------------------------------
// Moteur : pwsh (PowerShell 7) par défaut ; KJEMO_POWERSHELL=powershell.exe pour
// Windows PowerShell 5.1 (CI Windows). Le moteur RÉELLEMENT utilisé est affiché
// et consigné : on n'annonce jamais 5.1 sans l'avoir exécuté.
const MOTEUR = process.env.KJEMO_POWERSHELL || 'pwsh';
const ARGS_MOTEUR = ['-NoProfile', ...(/powershell(\.exe)?$/i.test(MOTEUR) ? ['-ExecutionPolicy', 'Bypass'] : [])];
const PWSH = (() => {
  const r = spawnSync(MOTEUR, [...ARGS_MOTEUR, '-Command', '$PSVersionTable.PSVersion.ToString() + " " + $PSVersionTable.PSEdition'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
})();
const TMP = mkdtempSync(join(tmpdir(), 'kjemo-azure-'));
process.on('exit', () => { try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ } });
let compteurFichier = 0;

function ecrireScript(texte) {
  compteurFichier += 1;
  const chemin = join(TMP, `s${compteurFichier}.ps1`);
  writeFileSync(chemin, BOM + texte, 'utf8');
  return chemin;
}

/** Exécute un script contre les doublures. Retourne le résumé JSON, ou null. */
function executer(texte, scenario = {}, { csv = false } = {}) {
  const chemin = ecrireScript(texte);
  const dossier = join(TMP, `d${compteurFichier}`);
  const r = spawnSync(MOTEUR, [...ARGS_MOTEUR, '-File', join(AZ, 'executer.ps1'),
    '-Script', chemin, '-Scenario', JSON.stringify(scenario), '-Dossier', dossier],
  { encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  const m = /@@KJEMO-JSON@@([\s\S]*?)@@FIN@@/.exec(r.stdout ?? '');
  if (!m) return { echec: true, brut: (r.stdout ?? '') + (r.stderr ?? ''), dossier };
  const res = JSON.parse(m[1]);
  res.dossier = dossier;
  return res;
}

const commandesAppelees = (res) => res.appels.map((a) => a.split(' ')[0]);
const GETTERS_CONTEXTE = ['Get-AzContext', 'Get-MgContext'];

// ===========================================================================
// 1. CATALOGUE
// ===========================================================================
section('1. Catalogue — 24 assistants, six familles');

const FAMILLES = {
  'Connexion, contexte et accès': 3,
  'Microsoft Entra ID': 4,
  'Machines virtuelles': 5,
  'Réseau Azure': 4,
  'Stockage et protection': 4,
  'Surveillance et coûts': 4,
};
assert(azure.length === 24, `24 assistants Azure au catalogue (${azure.length})`);
assert(new Set(azure.map((t) => t.id)).size === 24, 'identifiants distincts');
for (const [fam, n] of Object.entries(FAMILLES)) {
  const c = azure.filter((t) => t.subcategory === fam).length;
  assert(c === n, `famille « ${fam} » : ${n} assistants (${c})`);
}
const ACTIONS = ['azure-vm-demarrage', 'azure-vm-arret', 'azure-sauvegarde-restauration'];
for (const t of azure) {
  const attendu = !ACTIONS.includes(t.id);
  assert(t.readOnly === attendu, `${t.id} : readOnly = ${attendu}`);
  assert(t.platform === 'Multi' && t.output === '.ps1', `${t.id} : plateforme Multi, sortie .ps1`);
  assert(t.requiresAdmin === false, `${t.id} : aucune élévation locale`);
  const c = t.cloud;
  assert(c && c.probleme && c.exemple && c.lit?.length && c.ecrit?.length && c.facture?.length
    && c.permissions?.length && c.licences?.length && c.limites?.length,
  `${t.id} : bloc « Dans Azure » complet (problème, exemple, lit, écrit, facturé, permissions, licences, limites)`);
  assert(/PowerShell 5\.1/.test(t.os.join(' ')) && /PowerShell 7/.test(t.os.join(' ')),
    `${t.id} : compatibilité PowerShell 5.1 ET 7 annoncée`);
  const val = (c?.validation ?? []).join(' ');
  assert(/5\.1[^.]*NON EXÉCUTÉ/.test(val) && /réel[^.]*NON EXÉCUTÉ/.test(val) && /doublures/i.test(val),
    `${t.id} : la fiche déclare 5.1 et l'essai réel NON EXÉCUTÉS et nomme les doublures (moteurs annoncés = moteurs éprouvés)`);
  assert(t.sources.length >= 2 && t.sources.every((s) => /^https:\/\/learn\.microsoft\.com\/\S+/.test(s.url)),
    `${t.id} : sources officielles Microsoft`);
  assert(t.verifyAfter.length >= 2 && t.commonErrors.length >= 1 && t.rollback && t.gui.length >= 2,
    `${t.id} : vérifications, erreurs fréquentes, retour arrière et procédure graphique`);
  if (!attendu) {
    assert(t.fields.some((f) => f.id === 'azMode' && f.default === 'Diagnostic')
      && t.fields.some((f) => f.id === 'azConfirmation' && f.default === ''),
    `${t.id} : mode Diagnostic par défaut, confirmation vide par défaut`);
  }
}

// Mots interdits dans les promesses : aucune « posture saine » ni « sauvegarde OK ».
// Les NÉGATIONS (« Ne dit JAMAIS « sauvegardes OK » ») sont des garanties, pas des promesses.
const TEXTE_COMPLET = JSON.stringify(azure.map((t) => [t.title, t.summary, t.cloud, t.checks, t.verifyAfter])).replace(/JAMAIS « sauvegardes OK »/g, '').replace(/n’annonce « sauvegardes OK »/g, '');
assert(!/MFA (est )?(sain|conforme|ok)\b|posture (saine|conforme)|sauvegardes? OK\b/i.test(TEXTE_COMPLET),
  'aucune fiche ne promet une posture MFA « saine » ni « sauvegardes OK »');

// ===========================================================================
// 2. ENTRÉES : refus, injections, secrets
// ===========================================================================
section('2. Entrées — injections, secrets, champs vides');

const INJECTIONS = [
  "'; Remove-AzVM -Name x; '", '$(Get-Process)', '`n', 'a"b', 'a|b', 'a;b', 'a\nb', 'a\u0000b', '../../etc/passwd',
  '*', '<script>', '${env:USERNAME}', "x' -or '1'='1", 'a b', '{0}', '%TEMP%',
];
const SECRETS = [
  'sv=2022-11-02&ss=b&srt=co&sp=rwdlacx&se=2030-01-01T00:00:00Z&sig=AbCdEf0123456789%2Fxyz',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc',
  '-----BEGIN PRIVATE KEY-----',
  'DefaultEndpointsProtocol=https;AccountName=x;AccountKey=abcd==',
  'MotDePasse!2026Secret',
  'p@ssw0rd=Secret123',
  'Kx7q9Zr2Lm4Pa8Vb1Nc3Yd5Wf6Hg0Jt/Ue+Is9Oy2Rk4Xl7Bz1Ca3Dv5Ew8Fq6Gh0Ji2Kn4Mo6Pp8Qr1St3Uu5Vv7Ww9Xx==',
];

function champsTexte(t) {
  return t.fields.filter((f) => f.type !== 'select' && f.type !== 'number' && f.id !== 'azFormat');
}

for (const t of azure) {
  let rejets = 0;
  let tentatives = 0;
  for (const champ of champsTexte(t)) {
    for (const charge of [...INJECTIONS, ...SECRETS]) {
      if (champ.id === 'azConfirmation' && !t.fields.some((f) => f.id === 'azMode')) continue;
      tentatives += 1;
      const v = valeursReelles(t, { [champ.id]: charge });
      const errs = t.validate(v);
      let genere = true;
      let script = '';
      try { script = t.generate(v); } catch { genere = false; }
      if (genere) {
        // Si le texte est accepté, il ne doit apparaître NULLE PART en clair.
        const clair = script.includes(charge) && charge.length > 3;
        assert(!clair, `${t.id}.${champ.id} : « ${charge.slice(0, 24).replace(/\n/g, '\\n')} » accepté mais jamais en clair dans le script`);
        const estSecret = SECRETS.includes(charge);
        assert(!estSecret, `${t.id}.${champ.id} : un secret n'est JAMAIS accepté (${charge.slice(0, 18)}…)`);
      } else {
        rejets += 1;
        assert(Object.keys(errs).length > 0, `${t.id}.${champ.id} : refus cohérent entre validate() et generate()`);
      }
    }
  }
  assert(tentatives === 0 || rejets > 0, `${t.id} : la validation refuse au moins une des charges hostiles (${rejets}/${tentatives})`);
}

// Tenant et abonnement : format strict.
for (const t of azure) {
  for (const mauvais of ['', 'pas-un-guid', '11111111-1111-1111-1111', "bbbbbbbb-1111-2222-3333-44444444444'", 'bbbbbbbb111122223333444444444444']) {
    const errs = t.validate(valeursReelles(t, { azTenant: mauvais }));
    assert(Boolean(errs.azTenant), `${t.id} : tenant « ${mauvais.slice(0, 20)} » refusé`);
  }
  if (t.fields.some((f) => f.id === 'azAbonnement')) {
    for (const mauvais of ['', 'abc', 'aaaaaaaa-1111-2222-3333-44444444444z']) {
      assert(Boolean(t.validate(valeursReelles(t, { azAbonnement: mauvais })).azAbonnement), `${t.id} : abonnement « ${mauvais.slice(0, 20)} » refusé`);
    }
  }
}

// Champs obligatoires vides : aucun script produit.
for (const t of azure) {
  const optionnel = (f) => f.optionnel === true || /facultatif/i.test(f.label);
  for (const f of t.fields.filter((x) => !optionnel(x) && x.type !== 'select' && x.id !== 'azConfirmation')) {
    const v = valeursReelles(t, { [f.id]: '' });
    let leve = false;
    try { t.generate(v); } catch { leve = true; }
    assert(leve, `${t.id} : « ${f.id} » vide ⇒ aucun script produit`);
  }
}

// Confirmations des trois actions.
const PHRASES = {
  'azure-vm-demarrage': 'DEMARRER vm-lab-01',
  'azure-vm-arret': 'ARRETER vm-lab-01',
  'azure-sauvegarde-restauration': 'RESTAURER vm-lab-01 VERS rg-lab-restore',
};
for (const id of ACTIONS) {
  const t = parId[id];
  const base = valeursReelles(t, { azMode: 'Appliquer' });
  for (const mauvaise of ['', PHRASES[id].toLowerCase(), PHRASES[id] + ' ', ' ' + PHRASES[id], PHRASES[id].replace('vm-lab-01', 'vm-lab-02'), 'OUI', PHRASES[id] + '; Remove-AzVM']) {
    assert(Boolean(t.validate({ ...base, azConfirmation: mauvaise }).azConfirmation), `${id} : confirmation « ${mauvaise.slice(0, 30)} » refusée en mode Appliquer`);
  }
  assert(Object.keys(t.validate({ ...base, azConfirmation: PHRASES[id] })).length === 0, `${id} : la phrase exacte est acceptée`);
  assert(Object.keys(t.validate(valeursReelles(t, { azMode: 'Diagnostic', azConfirmation: '' }))).length === 0, `${id} : Diagnostic ne demande aucune confirmation`);
}
// Restauration : cibles refusées.
{
  const t = parId['azure-sauvegarde-restauration'];
  const base = valeursReelles(t, { azMode: 'Diagnostic' });
  assert(Boolean(t.validate({ ...base, azRgCible: 'rg-lab' }).azRgCible), 'restauration : cible = groupe source refusée');
  assert(Boolean(t.validate({ ...base, azRgCible: 'rg-prod' }).azRgCible), 'restauration : cible hors laboratoire refusée');
  assert(Boolean(t.validate({ ...base, azRgCible: 'RG-LAB' }).azRgCible), 'restauration : cible = groupe source refusée sans égard à la casse');
}

// ===========================================================================
// 3. SCRIPTS GÉNÉRÉS : analyse statique
// ===========================================================================
section('3. Scripts générés — absence de connexion, de secrets, de commandes interdites');

const scripts = new Map();
for (const t of azure) scripts.set(t.id, t.generate(valeursReelles(t)));

const INTERDITS = Object.keys(CMDLETS_INTERDITES);
const MOTIFS_FAUTIFS = [
  [/(^|\s)-Force\b/i, '-Force'],
  [/-Confirm\s*:\s*\$false/i, '-Confirm:$false'],
  [/Invoke-Expression|\biex\b/i, 'Invoke-Expression'],
  [/ConvertTo-SecureString|PlainText/i, 'ConvertTo-SecureString / PlainText'],
  [/Set-ExecutionPolicy/i, 'Set-ExecutionPolicy'],
  [/Install-Module|Update-Module|Install-Package/i, 'installation de module'],
  [/Invoke-WebRequest|Invoke-RestMethod|\bcurl\b|\bwget\b/i, 'appel réseau sortant'],
  [/Remove-Az|Remove-Mg|New-Az|New-Mg|Set-Az|Set-Mg|Update-Az|Update-Mg|Add-Mg|Add-Az|Revoke-/i, 'commande de modification Az/Graph'],
  [/Get-AzStorageAccountKey|SASToken|AccountKey=|SharedAccessSignature/i, 'clé ou jeton de stockage'],
  [/az\s+login|Connect-Az|Connect-Mg|Login-Az|Set-AzContext|Select-AzSubscription/i, 'connexion ou changement de contexte'],
];
function fautes(texteBrut, id) {
  // La fonction de MASQUAGE des secrets cite leurs noms (AccountKey, SharedAccessSignature…)
  // pour les effacer : ce n'est pas une lecture de secret. Seule cette ligne est exclue.
  const texte = texteBrut.split('\n').filter((l) => !/\[regex\]::Replace\(.*\[MASQUE\]/.test(l)).join('\n');
  const sortie = [];
  // Les modifications autorisées : exactement les trois actions, par leurs verbes.
  const autorisees = new Set(ACTIONS.includes(id) ? ['Start-AzVM', 'Stop-AzVM', 'Restore-AzRecoveryServicesBackupItem'] : []);
  for (const [motif, nom] of MOTIFS_FAUTIFS) {
    const m = texte.match(new RegExp(motif.source, motif.flags.includes('g') ? motif.flags : motif.flags + 'g'));
    if (m) {
      if (nom === 'commande de modification Az/Graph') {
        const extra = m.filter((x) => !autorisees.has(x));
        if (extra.length) sortie.push(`${nom} : ${[...new Set(extra)].join(', ')}`);
      } else sortie.push(nom);
    }
  }
  for (const interdite of INTERDITS) {
    // Une commande interdite apparaît-elle comme APPEL (début de ligne ou après un opérateur) ?
    const re = new RegExp(`(^|[\\s|({=;])${interdite}(?=[\\s)|;]|$)`, 'm');
    const lignes = texte.split('\n').filter((l) => !/^\s*#/.test(l));
    if (lignes.some((l) => re.test(l.replace(/'[^']*'/g, "''")))) sortie.push(`commande bannie appelée : ${interdite}`);
  }
  return sortie;
}
for (const t of azure) {
  const s = scripts.get(t.id);
  const f = fautes(s, t.id);
  assert(f.length === 0, `${t.id} : aucun motif interdit (${f.join(' | ') || 'RAS'})`);
  assert(s.startsWith('#Requires -Version 5.1'), `${t.id} : plancher #Requires -Version 5.1 déclaré`);
  assert(/Test-KjemoCommandes/.test(s) && /Test-KjemoContexte(Azure|Graph)/.test(s), `${t.id} : vérifie les commandes puis le contexte avant de lire`);
  assert(/\$KjemoPret/.test(s), `${t.id} : le corps n'est exécuté que si la garde a réussi`);
  assert(!/[‘’]/.test(s), `${t.id} : aucune apostrophe typographique`);
  assert(!/\bTODO\b|\bFIXME\b/.test(s) && !/http:\/\//.test(s), `${t.id} : aucun marqueur TODO ni URL non chiffrée`);
}

// Le motif « modification » ne doit pas laisser passer les trois actions ailleurs.
for (const t of azure.filter((x) => !ACTIONS.includes(x.id))) {
  assert(!/\b(Start|Stop|Restore)-Az[A-Za-z]+/.test(scripts.get(t.id)), `${t.id} : lecture seule, aucun Start/Stop/Restore`);
}

// ---------------------------------------------------------------------------
// Syntaxe PowerShell 7 (AST) + indice 5.1
// ---------------------------------------------------------------------------
section('4. Syntaxe — analyseur PowerShell et absence de syntaxe réservée à PowerShell 7');

if (!PWSH) {
  console.log('  [NON EXÉCUTÉ] pwsh absent : syntaxe, doublures et contre-épreuves NON EXÉCUTÉES.');
} else {
  console.log(`  moteur : PowerShell ${PWSH}`);
  const liste = [...scripts.entries()].map(([id, s]) => [id, ecrireScript(s)]);
  const analyseur = join(TMP, 'analyse.ps1');
  writeFileSync(analyseur, `
param([string]$Liste)
$out = @()
foreach ($ligne in (Get-Content -LiteralPath $Liste)) {
  $id, $chemin = $ligne -split '\\|', 2
  $erreurs = $null; $jetons = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($chemin, [ref]$jetons, [ref]$erreurs)
  $ps7 = @()
  $ast.FindAll({ param($n)
    $n.GetType().Name -in @('TernaryExpressionAst', 'PipelineChainAst') -or
    $n.GetType().Name -match 'NullConditional' }, $true) | ForEach-Object { $ps7 += $_.GetType().Name }
  foreach ($j in $jetons) { if ($j.Kind -in @('QuestionQuestion','QuestionQuestionEquals','QuestionDot','QuestionLBracket')) { $ps7 += [string]$j.Kind } }
  $out += [pscustomobject]@{ id = $id; erreurs = @($erreurs | ForEach-Object { [string]$_.Message }); ps7 = $ps7 }
}
$out | ConvertTo-Json -Depth 4 -Compress
`, 'utf8');
  const fichierListe = join(TMP, 'liste.txt');
  writeFileSync(fichierListe, liste.map(([id, c]) => `${id}|${c}`).join('\n'), 'utf8');
  const r = spawnSync(MOTEUR, [...ARGS_MOTEUR, '-File', analyseur, '-Liste', fichierListe], { encoding: 'utf8', timeout: 120000 });
  let analyses = [];
  try { analyses = JSON.parse(r.stdout); } catch { analyses = []; }
  assert(analyses.length === 24, `l'analyseur a lu 24 scripts (${analyses.length})`);
  for (const a of analyses) {
    assert((a.erreurs ?? []).length === 0, `${a.id} : aucune erreur de syntaxe (PowerShell 7)`);
    assert((a.ps7 ?? []).length === 0, `${a.id} : aucune syntaxe réservée à PowerShell 7 (ternaire, ??, ?., &&, ||)`);
  }
  console.log(/Desktop/.test(PWSH) ? '  [INFO]  Moteur Windows PowerShell 5.1 (Desktop) : ce banc a été EXÉCUTÉ sous 5.1.' : '  [INFO]  Windows PowerShell 5.1 : NON EXÉCUTÉ par cette exécution (indice seulement : pas de syntaxe PowerShell 7 détectée).');

  // =========================================================================
  // 5. EXÉCUTION AVEC DOUBLURES
  // =========================================================================
  section('5. Exécution avec doublures — nominal, refus, contextes');

  for (const t of azure) {
    const s = scripts.get(t.id);
    const res = executer(s, {});
    assert(!res.echec && res.erreurs.length === 0, `${t.id} : s'exécute sans exception (doublures)`);
    if (res.echec) { console.log(res.brut.slice(0, 400)); continue; }
    assert(res.mutations.length === 0, `${t.id} : 0 commande de modification appelée (tripwires)`);
    assert(res.actions.length === 0, `${t.id} : aucune action réelle en mode par défaut`);
    assert(/Conclusion\s*:/.test(res.sortie), `${t.id} : le rapport se termine par une conclusion`);
    assert(!/Conclusion\s*:[^\n]*\b(sain|tout va bien|conforme|securise|sûr)\b/i.test(res.sortie), `${t.id} : la conclusion ne déclare jamais « sain » ou « conforme »`);
    assert(res.appels.every((a) => /-ErrorAction=Stop/.test(a) || GETTERS_CONTEXTE.includes(a.split(' ')[0]) === false && !/^Get-|^Start-|^Stop-|^Restore-/.test(a)),
      `${t.id} : chaque appel Az/Graph porte -ErrorAction Stop`);
    assert(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(res.sortie.replace(/\n/g, ' ')) ,
      `${t.id} : aucun identifiant complet affiché dans le rapport (tronqués)`);

    // Lectures refusées : INACCESSIBLE, jamais « aucun point ».
    const requises = t.commandes.obligatoires.filter((c) => !GETTERS_CONTEXTE.includes(c) && !/^(Start|Stop|Restore)-/.test(c));
    if (requises.length) {
      const refus = executer(s, { Refus: requises });
      assert(!refus.echec && refus.mutations.length === 0 && refus.actions.length === 0, `${t.id} : droits refusés ⇒ aucune mutation, aucune action`);
      assert(/INACCESSIBLE/.test(refus.sortie), `${t.id} : lecture refusée ⇒ ligne INACCESSIBLE`);
      assert(/RESULTAT INCOMPLET/.test(refus.sortie) && !/aucun point/.test(refus.sortie.split('Conclusion')[1] ?? ''),
        `${t.id} : lecture refusée ⇒ « RESULTAT INCOMPLET », jamais « aucun point »`);
    }

    // Contexte différent ou absent : REFUS, aucune lecture de ressource.
    const scenarios = t.portee === 'graph'
      ? [{ SansSessionGraph: true }, { TenantGraph: 'cccccccc-9999-8888-7777-666666666666' }, { AuthGraph: 'AppOnly' }]
      : [{ SansSessionAz: true }, { TenantAz: 'cccccccc-9999-8888-7777-666666666666' }, { AbonnementAz: 'dddddddd-9999-8888-7777-666666666666' }];
    const nomsCtx = t.portee === 'graph' ? ['sans session', 'tenant différent', 'session applicative'] : ['sans session', 'tenant différent', 'abonnement différent'];
    for (let i = 0; i < scenarios.length; i++) {
      if (t.portee === 'az' && i === 2 && !t.fields.some((f) => f.id === 'azAbonnement')) continue;
      const ctx = executer(s, scenarios[i]);
      const lu = commandesAppelees(ctx).filter((c) => !GETTERS_CONTEXTE.includes(c) && c !== 'Get-AzSubscription');
      assert(!ctx.echec && /REFUS/.test(ctx.sortie) && lu.length === 0 && ctx.mutations.length === 0 && ctx.actions.length === 0,
        `${t.id} : contexte « ${nomsCtx[i]} » ⇒ REFUS avant toute lecture de ressource (lectures : ${lu.join(',') || 'aucune'})`);
    }

    // GUID d'exemple : refusé à l'exécution.
    const exemple = t.generate({ ...defauts(t), ...(SPECIFIQUE[t.id] ?? {}) });
    const rEx = executer(exemple, {});
    assert(!rEx.echec && /REFUS/.test(rEx.sortie) && rEx.mutations.length === 0
      && commandesAppelees(rEx).filter((c) => !GETTERS_CONTEXTE.includes(c)).length === 0,
    `${t.id} : identifiants d'exemple (1111…/2222…) ⇒ REFUS à l'exécution, rien n'est lu`);
  }

  // Cas particuliers de contexte
  {
    const t = parId['azure-contexte'];
    const r = executer(scripts.get(t.id), { TenantAz: 'cccccccc-9999-8888-7777-666666666666' });
    assert(/REFUS/.test(r.sortie), 'azure-contexte : un tenant inattendu est signalé en REFUS, jamais accepté en silence');
  }
  {
    // Le premier abonnement n'est jamais choisi silencieusement : aucune commande de sélection n'est appelée.
    const toutes = azure.flatMap((t) => commandesAppelees(executer(scripts.get(t.id), {})));
    assert(!toutes.some((c) => ['Select-AzSubscription', 'Set-AzContext', 'Connect-AzAccount', 'Connect-MgGraph'].includes(c)),
      'aucun assistant ne se connecte ni ne change d\'abonnement (journal d\'appels des 24 exécutions)');
  }

  // =========================================================================
  // 6. ACTIONS : -WhatIf, confirmation, relecture
  // =========================================================================
  section('6. Actions — prévisualisation, confirmation exacte, effets');

  const EFFET = {
    'azure-vm-demarrage': /Start-AzVM rg-lab\/vm-lab-01/,
    'azure-vm-arret': /Stop-AzVM rg-lab\/vm-lab-01 Deallocate/,
    'azure-sauvegarde-restauration': /Restore-AzRecoveryServicesBackupItem vers rg-lab-restore/,
  };
  for (const id of ACTIONS) {
    const t = parId[id];
    const sc = id === 'azure-vm-demarrage' ? { VmEtat: 'VM deallocated' } : {};
    const diag = executer(t.generate(valeursReelles(t, { azMode: 'Diagnostic' })), sc);
    assert(!diag.echec && diag.actions.length === 0, `${id} : Diagnostic ⇒ aucun effet (la commande reçoit -WhatIf)`);
    assert(diag.appels.some((a) => /-WhatIf=True/.test(a)), `${id} : Diagnostic ⇒ la vraie commande est appelée avec -WhatIf (journal des paramètres)`);
    assert(diag.mutations.length === 0, `${id} : Diagnostic ⇒ aucun tripwire`);
    const app = executer(t.generate(valeursReelles(t, { azMode: 'Appliquer', azConfirmation: PHRASES[id] })), sc);
    assert(!app.echec && app.actions.length === 1 && EFFET[id].test(app.actions[0]), `${id} : Appliquer + phrase exacte ⇒ exactement un effet (${app.actions.join(' ; ')})`);
    assert(app.mutations.length === 0, `${id} : Appliquer ⇒ aucun tripwire`);
    assert(!app.appels.some((a) => /-WhatIf=True/.test(a) && /^(Start|Stop|Restore)-/.test(a)), `${id} : Appliquer ⇒ pas de -WhatIf sur l'action`);
    assert(/demande/i.test(app.sortie), `${id} : Appliquer ⇒ l'action demandée est consignée dans le rapport`);
  }
  {
    // Cible ambiguë ou absente : aucune action même avec la bonne phrase.
    const t = parId['azure-vm-arret'];
    const absente = executer(t.generate(valeursReelles(t, { azMode: 'Appliquer', azVm: 'vm-inconnue', azConfirmation: 'ARRETER vm-inconnue' })), {});
    assert(!absente.echec && absente.actions.length === 0, 'arrêt : machine introuvable ⇒ aucune action');
    const refusLecture = executer(t.generate(valeursReelles(t, { azMode: 'Appliquer', azConfirmation: PHRASES['azure-vm-arret'] })), { Refus: ['Get-AzVM'] });
    assert(!refusLecture.echec && refusLecture.actions.length === 0, 'arrêt : état non lisible ⇒ aucune action même confirmée');
    const rest = parId['azure-sauvegarde-restauration'];
    const sansPoint = executer(rest.generate(valeursReelles(rest, { azMode: 'Appliquer', azConfirmation: PHRASES['azure-sauvegarde-restauration'] })), { SansPointRecup: true });
    assert(!sansPoint.echec && sansPoint.actions.length === 0, 'restauration : aucun point de récupération ⇒ aucune action');
    const regionDiff = executer(rest.generate(valeursReelles(rest, { azMode: 'Appliquer', azStockage: 'stlabest01', azConfirmation: PHRASES['azure-sauvegarde-restauration'] })), {});
    assert(!regionDiff.echec && regionDiff.actions.length === 0 && /REFUS/.test(regionDiff.sortie), 'restauration : compte de transit d\'une autre région ⇒ REFUS, aucune action');
    const horsProtection = executer(rest.generate(valeursReelles(rest, { azMode: 'Appliquer', azVm: 'vm-lab-02', azConfirmation: 'RESTAURER vm-lab-02 VERS rg-lab-restore' })), {});
    assert(!horsProtection.echec && horsProtection.actions.length === 0, 'restauration : machine non protégée par ce coffre ⇒ aucune action');
  }

  // =========================================================================
  // 7. CONSTATS ATTENDUS (positifs et négatifs)
  // =========================================================================
  section('7. Constats — contrôles positifs et négatifs');

  const lire = (id, sc = {}, extra = {}) => {
    const t = parId[id];
    return executer(t.generate(valeursReelles(t, extra)), sc);
  };
  {
    const r = lire('azure-stockage-inventaire', { StockageOuvert: true });
    assert(/ACCES PUBLIC AUX BLOBS/.test(r.sortie) && /stlabdemo001\s+ATTENTION/.test(r.sortie), 'stockage : accès public aux blobs signalé (positif)');
    const n = lire('azure-stockage-inventaire', {});
    assert(!/stlabdemo001\s+ATTENTION/.test(n.sortie) && /TLS minimal ancien/.test(n.sortie), 'stockage : compte fermé non signalé, TLS ancien signalé sur un autre (négatif + positif)');
    const sp = lire('azure-stockage-inventaire', { StockageSansPropriete: true });
    assert(/valeur non fournie/.test(sp.sortie), 'stockage : propriété absente ⇒ « non fournie », jamais lue comme refusée');
    assert(!sp.appels.some((a) => /Key|SAS/i.test(a.split(' ')[0])), 'stockage : aucune commande de clé ni de jeton appelée');
  }
  {
    const r = lire('azure-stockage-exposition', { StockageOuvert: true });
    assert(/documents\s+(PROBLEME|ATTENTION)/.test(r.sortie), 'exposition : conteneur à accès public signalé (positif)');
    const c = lire('azure-stockage-exposition', {});
    assert(!/documents\s+(PROBLEME|ATTENTION)/.test(c.sortie), 'exposition : conteneurs privés non signalés (négatif)');
    const incomplet = lire('azure-stockage-exposition', { Refus: ['Get-AzRmStorageContainer'] });
    assert(/INACCESSIBLE/.test(incomplet.sortie) && /RESULTAT INCOMPLET/.test(incomplet.sortie), 'exposition : conteneurs illisibles ⇒ rapport incomplet');
  }
  {
    const r = lire('azure-sauvegarde-coffres', { SauvegardeAncienne: true });
    assert(/ANCIENNE/.test(r.sortie), 'sauvegardes : dernière sauvegarde ancienne signalée (positif)');
    const n = lire('azure-sauvegarde-coffres', {});
    assert(!/ANCIENNE/.test(n.sortie), 'sauvegardes : sauvegarde récente non signalée (négatif)');
    assert(/AUCUNE restauration testee/.test(n.sortie) && !/sauvegardes? (sont )?(ok|saines?)/i.test(n.sortie), 'sauvegardes : « aucune restauration testée » toujours rappelé, jamais « sauvegardes OK »');
    const sc = lire('azure-sauvegarde-coffres', { SansCoffre: true });
    assert(/Aucun coffre|aucun coffre/.test(sc.sortie), 'sauvegardes : aucun coffre ⇒ dit clairement');
  }
  {
    const r = lire('azure-alertes-diagnostics', { SansAlerte: true });
    assert(/ne conclus PAS que tout va bien/.test(r.sortie), 'alertes : aucune alerte lue ⇒ pas de conclusion rassurante');
    const n = lire('azure-alertes-diagnostics', {});
    assert(/DESACTIVEE/.test(n.sortie) && /aucun groupe d actions/.test(n.sortie), 'alertes : règle désactivée et sans groupe d\'actions signalée (positif)');
  }
  {
    const r = lire('azure-budgets', { BudgetDepasse: true });
    assert(/DEPASSE/.test(r.sortie) && /ne bloque rien/.test(r.sortie), 'budgets : dépassement signalé et « un budget ne bloque rien » rappelé');
    const v = lire('azure-budgets', { SansBudget: true });
    assert(/ne prouve PAS l absence de budget/.test(v.sortie), 'budgets : résultat vide ≠ absence de budget');
    assert(!v.appels.some((a) => /^New-|^Set-|^Remove-/.test(a)), 'budgets : aucune création de budget');
  }
  {
    const r = lire('azure-ressources-inutilisees', {});
    assert(/5 candidat/.test(r.sortie) && /Candidat n est pas a supprimer/.test(r.sortie), 'inutilisées : candidats listés et « candidat ≠ à supprimer » rappelé');
    assert(!/Remove-/.test(scripts.get('azure-ressources-inutilisees')), 'inutilisées : aucune commande de suppression générée');
  }
  {
    const r = lire('azure-reseau-nsg', { NsgSain: false });
    assert(/PROBLEME/.test(r.sortie), 'NSG : règle ouvrant l\'administration à Internet ⇒ PROBLEME (positif)');
    const n = lire('azure-reseau-nsg', { NsgSain: true });
    assert(!/PROBLEME/.test(n.sortie), 'NSG : variante sans règle d\'administration ouverte ⇒ aucun PROBLEME (négatif)');
  }
  {
    const r = lire('azure-reseau-vnets', { VnetChevauchement: true });
    assert(/chevauch/i.test(r.sortie), 'VNets : chevauchement d\'adresses signalé (positif)');
    const n = lire('azure-reseau-vnets', { VnetChevauchement: false });
    assert(!/chevauch/i.test(n.sortie.replace(/Aucun chevauchement[^\n]*/gi, '')), 'VNets : sans chevauchement non signalé (négatif)');
  }
  {
    const r = lire('azure-vm-etat', { VmEtat: 'VM stopped' });
    assert(/factur/i.test(r.sortie), 'VM : « arrêtée » sans désallocation ⇒ rappel de facturation');
    const d = lire('azure-vm-etat', { VmEtat: 'VM deallocated' });
    assert(/VM deallocated/.test(d.sortie), 'VM : état désalloué reconnu et affiché');
  }
  {
    const r = lire('azure-rbac', { RbacVide: true });
    assert(/aucune attribution|0 attribution/i.test(r.sortie) || /ATTENTION/.test(r.sortie), 'RBAC : aucune attribution ⇒ pas de conclusion rassurante');
    const m = lire('entra-mfa', {});
    assert(/enregistr/i.test(m.sortie) && !/MFA (sain|conforme|ok)\b/i.test(m.sortie), 'MFA : enregistré ≠ exigé, aucune posture « saine »');
    assert(/36 h|36 heures|retard/i.test(m.sortie), 'MFA : retard du rapport d\'enregistrement rappelé');
    const refus = lire('entra-mfa', { Refus: ['Get-MgReportAuthenticationMethodUserRegistrationDetail'] });
    assert(/INACCESSIBLE/.test(refus.sortie) && /RESULTAT INCOMPLET/.test(refus.sortie) && !/MFA (sain|conforme)/i.test(refus.sortie), 'MFA : données inaccessibles ⇒ jamais de posture « saine »');
    const scopes = lire('entra-mfa', { ScopesGraph: ['User.Read.All'] });
    assert(!scopes.echec && /AuditLog\.Read\.All/.test(scopes.sortie) && !/MFA (sain|conforme)/i.test(scopes.sortie), 'MFA : permission AuditLog.Read.All absente ⇒ signalée, rien de rassurant');
  }

  // =========================================================================
  // 8. EXPORTS
  // =========================================================================
  section('8. Exports — JSON, CSV, aucun secret, neutralisation des formules');

  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const t of azure) {
    const rc = executer(t.generate(valeursReelles(t, { azFormat: 'Console' })), {});
    assert(!rc.echec && (rc.fichiers ?? []).length === 0, `${t.id} : format Console ⇒ aucun fichier écrit`);
    const rj = executer(t.generate(valeursReelles(t, { azFormat: 'JSON' })), {});
    const fj = rj.fichiers?.filter((f) => f.toLowerCase().endsWith('.json')) ?? [];
    assert(fj.length === 1, `${t.id} : format JSON ⇒ exactement un fichier .json (${rj.fichiers?.join(',') || 'aucun'})`);
    let lignesJson = 0;
    if (fj.length === 1) {
      const texte = readFileSync(join(rj.dossier, fj[0]), 'utf8').replace(/^\ufeff/, '');
      let obj = null;
      try { obj = JSON.parse(texte); } catch { obj = null; }
      const lignes = obj?.Controles ?? null;
      assert(obj?.Outil === t.id && /LOT 8/.test(obj?.Version ?? ''), `${t.id} : le JSON identifie l'outil et la version du lot`);
      assert(Array.isArray(lignes) && lignes.length > 0, `${t.id} : le fichier JSON est un JSON valide contenant des lignes de rapport`);
      lignesJson = Array.isArray(lignes) ? lignes.length : 0;
      assert(!UUID.test(texte) && !/sig=|AccountKey|eyJ[A-Za-z0-9]{10}/.test(texte), `${t.id} : JSON sans identifiant complet ni secret`);
    }
    const rs = executer(t.generate(valeursReelles(t, { azFormat: 'CSV' })), {});
    const fs_ = rs.fichiers?.filter((f) => f.toLowerCase().endsWith('.csv')) ?? [];
    assert(fs_.length === 1, `${t.id} : format CSV ⇒ exactement un fichier .csv (${rs.fichiers?.join(',') || 'aucun'})`);
    if (fs_.length === 1) {
      const texte = readFileSync(join(rs.dossier, fs_[0]), 'utf8').replace(/^\ufeff/, '');
      const lignes = texte.split(/\r?\n/).filter(Boolean);
      assert(/Categorie/.test(lignes[0]) && /Controle/.test(lignes[0]) && /Etat/.test(lignes[0]), `${t.id} : CSV avec en-tête Categorie, Controle, Etat`);
      assert(lignes.length - 1 === lignesJson, `${t.id} : CSV et JSON portent le même nombre de lignes (${lignes.length - 1} / ${lignesJson})`);
      assert(!UUID.test(texte), `${t.id} : CSV sans identifiant complet`);
    }
  }
  {
    // Neutralisation des formules : un nom de ressource commençant par « = » ne doit jamais sortir tel quel en CSV.
    const t = parId['azure-vm-inventaire'];
    const r = executer(t.generate(valeursReelles(t, { azFormat: 'CSV' })), { NomVm: '=HYPERLINK("http://x")' });
    const f = r.fichiers?.find((x) => x.endsWith('.csv'));
    const texte = f ? readFileSync(join(r.dossier, f), 'utf8') : '';
    assert(/HYPERLINK/.test(texte), 'formule : la doublure injecte bien un nom commençant par « = » dans le rapport (mutation applicable)');
    assert(!/(^|,)"?=HYPERLINK/m.test(texte) && /'=HYPERLINK/.test(texte), 'formule : « =HYPERLINK » est neutralisé en CSV (préfixe apostrophe)');
  }

  // =========================================================================
  // 9. CONTRE-ÉPREUVES : le banc doit voir les scripts mutilés
  // =========================================================================
  section('9. Contre-épreuves — chaque garde est éprouvée sur un script mutilé');

  const vm = parId['azure-vm-arret'];
  const sArret = vm.generate(valeursReelles(vm, { azMode: 'Appliquer', azConfirmation: PHRASES['azure-vm-arret'] }));
  const sLecture = scripts.get('azure-vm-inventaire');

  // M1 : une connexion ajoutée est vue par l'analyse statique ET par les tripwires.
  const m1 = sLecture + '\nConnect-AzAccount\n';
  assert(fautes(m1, 'azure-vm-inventaire').some((f) => /connexion|bannie/.test(f)), 'contre-épreuve : Connect-AzAccount ajouté ⇒ détecté par l\'analyse statique');
  const r1 = executer(m1, {});
  assert(r1.mutations.includes('Connect-AzAccount'), 'contre-épreuve : Connect-AzAccount ajouté ⇒ détecté par le tripwire à l\'exécution');

  // M2 : -Force ajouté.
  assert(fautes(sLecture + '\nStop-AzVM -Name x -Force\n', 'azure-vm-inventaire').length > 0, 'contre-épreuve : -Force ajouté ⇒ détecté');

  // M3 : -ErrorAction Stop retiré d'une lecture ⇒ l'indicateur de journal le voit.
  const m3 = sLecture.replace(/-ErrorAction Stop/g, '');
  const r3 = executer(m3, {});
  assert(r3.echec || r3.appels.some((a) => !/-ErrorAction=Stop/.test(a) && /^Get-AzVM/.test(a)), 'contre-épreuve : -ErrorAction Stop retiré ⇒ détecté par le journal d\'appels');

  // M4 : confirmation affaiblie (-ceq → -eq) avec une phrase en minuscules : l'action ne doit pas partir.
  const faible = sArret.replace(/-ceq/g, '-eq');
  assert(faible !== sArret, 'contre-épreuve : la garde de confirmation utilise bien -ceq (mutation applicable)');
  const minuscules = vm.generate(valeursReelles(vm, { azMode: 'Diagnostic' }));
  // On injecte à la main la phrase en minuscules et le mode Appliquer dans le script de base.
  const b64 = (x) => Buffer.from(x, 'utf8').toString('base64');
  const forcer = (s, mode, phrase) => s
    .replace(/(\$KjemoMode = [^\n]*FromBase64String\(')[^']*('\)\))/, `$1${b64(mode)}$2`)
    .replace(/(\$KjemoConfirmation = [^\n]*FromBase64String\(')[^']*('\)\))/, `$1${b64(phrase)}$2`);
  const sForce = forcer(minuscules, 'Appliquer', 'arreter vm-lab-01');
  assert(sForce !== minuscules, 'contre-épreuve : injection du mode et de la phrase fautive dans le script (mutation applicable)');
  const rBon = executer(sForce, {});
  assert(!rBon.echec && rBon.actions.length === 0, 'garde : phrase en minuscules ⇒ AUCUNE action (-ceq tient)');
  const rFaible = executer(sForce.replace(/-ceq/g, '-eq'), {});
  assert(!rFaible.echec && rFaible.actions.length === 1, 'contre-épreuve : avec -eq la même phrase déclenche l\'action ⇒ le banc voit bien la différence');

  // M5 : garde de contexte supprimée ⇒ les lectures partiraient sur le mauvais tenant.
  const sansGarde = sLecture.replace(/if \(Test-KjemoContexteAzure[^\n]*\{ \$KjemoPret = \$true \}/, '$KjemoPret = $true');
assert(sansGarde !== sLecture, 'contre-épreuve : la garde de contexte est bien reconnue par la mutation (mutation applicable)');
const rCtx = executer(sansGarde, { TenantAz: 'cccccccc-9999-8888-7777-666666666666' });
assert(!rCtx.echec && commandesAppelees(rCtx).includes('Get-AzVM'), 'contre-épreuve : sans garde de contexte, la lecture part sur le mauvais tenant ⇒ la garde est bien ce qui l\'empêche');
const rCtxOk = executer(sLecture, { TenantAz: 'cccccccc-9999-8888-7777-666666666666' });
assert(!commandesAppelees(rCtxOk).includes('Get-AzVM'), 'garde de contexte intacte : mauvais tenant ⇒ Get-AzVM jamais appelé');

// M6 : un secret dans un champ est refusé, et le contrôle de secrets voit un script qui en contiendrait un.
  const fautif = sLecture + "\n$MotDePasse = ConvertTo-SecureString 'x' -AsPlainText -Force\n";
  assert(fautes(fautif, 'azure-vm-inventaire').length > 0, 'contre-épreuve : ConvertTo-SecureString / PlainText ajouté ⇒ détecté');

  // M7 : une commande de suppression ajoutée à l'assistant d'inventaire des ressources inutilisées.
  const sInut = scripts.get('azure-ressources-inutilisees') + '\nRemove-AzDisk -Name x\n';
  assert(fautes(sInut, 'azure-ressources-inutilisees').length > 0, 'contre-épreuve : Remove-AzDisk ajouté ⇒ détecté');
  const rInut = executer(sInut, {});
  assert(rInut.mutations.includes('Remove-AzDisk'), 'contre-épreuve : Remove-AzDisk ⇒ détecté par le tripwire à l\'exécution');
}

// ===========================================================================
// Bilan
// ===========================================================================
console.log('\n' + '='.repeat(72));
console.log('NIVEAUX DE PREUVE');
console.log(`  SYNTAXE   : ${PWSH ? `exécutée (PowerShell ${PWSH})` : 'NON EXÉCUTÉE (pwsh absent)'}`);
console.log(`  DOUBLURES : ${PWSH ? 'exécutées (aucune connexion, aucun tenant, aucune ressource)' : 'NON EXÉCUTÉES (pwsh absent)'}`);
console.log(/Desktop/.test(PWSH ?? '') ? '  Windows PowerShell 5.1 : EXÉCUTÉ par cette exécution.' : '  Windows PowerShell 5.1 : NON EXÉCUTÉ par cette exécution (indice AST seulement).');
console.log('  Essai réel sur un tenant / abonnement Azure : NON EXÉCUTÉ (aucun résultat réel n\'est affirmé).');
console.log(`\nBanc Azure : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
if (echecs.length) { for (const e of echecs) console.log(`  - ${e}`); process.exit(1); }
if (!PWSH) { console.log('Exécution NON EXÉCUTÉE : ce résultat ne vaut PAS PASS.'); process.exit(2); }
