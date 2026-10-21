#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LOT 7 (25/n) — DETTE DU LOT 6B : LE SÉLECTEUR « FORMAT DU RAPPORT » EST MORT
//
// CE BANC NE CORRIGE RIEN. Il PROUVE la dette, la CHIFFRE, et la FIGE, pour que
// le LOT 6C la traite avec une régénération de baseline explicitement auditée.
//
// LE DÉFAUT
//   blocExportRapport() branche l'export sur `$KjemoFormat` et ne le pose pas :
//   c'est à l'outil de l'affecter. Les assistants du LOT 2 le font. 18
//   assistants du LOT 6B ne le font pas : `$KjemoFormat` y vaut $null, donc
//   différent de 'Console', donc le bloc d'export s'exécute et n'entre dans
//   AUCUNE des trois branches (JSON, CSV, HTML). Aucun fichier n'est écrit, et
//   rien ne le dit. Le champ existe, s'affiche, et n'a aucun effet.
//
// CE QUE LE BANC ÉTABLIT
//   1. la liste EXACTE des assistants touchés, mesurée sur les scripts générés
//      (et non recopiée) — puis comparée à la liste écrite ci-dessous ;
//   2. leurs 144 scripts historiques (18 × 8 jeux) portent tous le défaut ;
//   3. le champ « Format du rapport » est SANS EFFET sur l'export : le format
//      choisi atteint des commentaires, l'entrée « Format » du tableau des
//      paramètres du rapport et une variable locale `$Format` jamais lue — mais
//      JAMAIS `$KjemoFormat`, la variable que le bloc d'export lit ;
//   4. CONTRÔLE POSITIF : les assistants qui posent la variable (LOT 2, jonction
//      du LOT 7) sont reconnus comme sains — le détecteur n'accuse pas tout ;
//   5. CONTRE-ÉPREUVE : retirer l'affectation d'un script sain le fait accuser ;
//      en ajouter une à un script malade le fait innocenter. Un détecteur qui
//      ne bouge pas ne détecte rien ;
//   6. aucun des 856 scripts historiques n'est modifié (empreintes de la
//      baseline) — ce banc lit, il n'écrit pas.
//
// QUAND CE BANC DOIT ÉCHOUER
//   Le jour où le LOT 6C corrige un de ces assistants, la liste mesurée ne
//   correspond plus à la liste écrite : le banc ÉCHOUE, volontairement. Il faut
//   alors régénérer la baseline des 856, auditer le diff, et retirer l'assistant
//   de la liste ICI, dans le même commit. Une dette corrigée sans que ce soit
//   consigné est une baseline qui bouge sans explication.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { tools } = await import(pathToFileURL(resolve(ROOT, 'dist/generators.mjs')).href);
const { estBash } = await import(pathToFileURL(resolve(ROOT, 'dist/plateforme.mjs')).href);

let ok = 0;
const echecs = [];
const pass = (m) => { ok += 1; if (process.env.KJEMO_VERBEUX) console.log(`  [OK]    ${m}`); };
const fail = (m) => { echecs.push(m); console.error(`  [ECHEC] ${m}`); };
const verifier = (c, m) => (c ? pass(m) : fail(m));

/** La dette, assistant par assistant : identifiant -> identifiant du champ mort. */
export const DETTE_6B = {
  'slow-boot-diagnostic': 'sbFormat',
  'bluescreen-diagnostic': 'bsFormat',
  'user-profile-diagnostic': 'upFormat',
  'workstation-performance-report': 'perfFormat',
  'local-accounts-audit': 'lacFormat',
  'windows-access-recovery': 'warFormat',
  'windows-service-control': 'svcFormat',
  'firewall-audit': 'fwFormat',
  'defender-audit': 'defFormat',
  'defender-scan': 'dsFormat',
  'sfc-repair': 'sfcFormat',
  'dism-repair': 'dsmFormat',
  'restore-point-create': 'rpFormat',
  'safe-mode-preparation': 'smeFormat',
  'workstation-storage-diagnostic': 'stoFormat',
  'temp-cleanup': 'tcFormat',
  'recycle-bin-cleanup': 'rbFormat',
  'browser-cache-diagnostic': 'bcFormat',
};

/** Le bloc d'export branché sur la variable. */
const BRANCHE = /if \(\$KjemoFormat -ne 'Console'\)/;
/** Une AFFECTATION de la variable, en début de ligne (un commentaire commence par #). */
const AFFECTE = /^[ \t]*\$KjemoFormat[ \t]*=/m;

/** Verdict du détecteur sur un texte de script. */
export function verdictFormat(texte) {
  if (!BRANCHE.test(texte)) return 'SANS_EXPORT';
  return AFFECTE.test(texte) ? 'SAIN' : 'MORT';
}

const valeursPar = (t, surcharge = {}) => ({
  ...Object.fromEntries(t.fields.map((f) => [f.id, String(f.default ?? '')])), ...surcharge,
});

// ===========================================================================
console.log('');
console.log('Passe A — la liste exacte, mesurée sur le catalogue');
// ===========================================================================
const powershell = tools.filter((t) => !estBash(t));
const mesure = powershell
  .filter((t) => verdictFormat(t.generate(valeursPar(t))) === 'MORT')
  .map((t) => t.id).sort();
const ecrite = Object.keys(DETTE_6B).sort();
verifier(mesure.length === 18, `A1 : 18 assistants portent le défaut (mesuré : ${mesure.length})`);
verifier(JSON.stringify(mesure) === JSON.stringify(ecrite),
  'A2 : la liste mesurée est EXACTEMENT la liste écrite dans ce banc'
  + (JSON.stringify(mesure) === JSON.stringify(ecrite) ? ''
    : ` — en trop : [${mesure.filter((x) => !ecrite.includes(x))}] ; en moins : [${ecrite.filter((x) => !mesure.includes(x))}]`));
for (const id of ecrite) {
  const t = tools.find((x) => x.id === id);
  verifier(Boolean(t), `A3 : « ${id} » existe au catalogue`);
  if (!t) continue;
  const champ = t.fields.find((f) => f.id === DETTE_6B[id]);
  verifier(Boolean(champ) && /Format du rapport/i.test(champ.label ?? ''),
    `A4 : ${id} expose bien le champ « Format du rapport » (${DETTE_6B[id]}) — il existe et s'affiche`);
  verifier(t.category === 'Poste de travail Windows',
    `A5 : ${id} appartient à « Poste de travail Windows » (LOT 6B)`);
}

// ===========================================================================
console.log('');
console.log('Passe B — le champ est SANS EFFET sur l\'export : le format n\'atteint jamais $KjemoFormat');
// ===========================================================================
for (const id of ecrite) {
  const t = tools.find((x) => x.id === id);
  if (!t) continue;
  const champ = t.fields.find((f) => f.id === DETTE_6B[id]);
  // Les options sont des paires [valeur, libellé] : on prend la VALEUR.
  const formats = (champ.options ?? []).map((o) => (Array.isArray(o) ? o[0] : (typeof o === 'string' ? o : o.value)));
  verifier(formats.length === 4 && ['Console', 'JSON', 'HTML', 'CSV'].every((f) => formats.includes(f)),
    `B0 : ${id} propose les quatre formats Console, JSON, HTML, CSV (${formats.join(', ')})`);
  const textes = formats.map((f) => t.generate(valeursPar(t, { [DETTE_6B[id]]: f })));
  const lignes = textes.map((x) => x.split('\n'));
  const memeLongueur = lignes.every((l) => l.length === lignes[0].length);
  const differentes = [];
  if (memeLongueur) {
    for (let i = 0; i < lignes[0].length; i++) {
      if (lignes.some((l) => l[i] !== lignes[0][i])) differentes.push(i);
    }
  }
  // Ce que le format choisi atteint, MESURE : (a) des lignes de commentaire,
  // (b) l'entrée « Format = ... » du tableau des paramètres du rapport, (c)
  // l'affectation d'une variable locale `$Format` qui n'est lue nulle part.
  // Ce qu'il n'atteint JAMAIS : `$KjemoFormat`, la variable que le bloc
  // d'export lit pour choisir JSON, CSV ou HTML.
  const nature = (l) => (/^\s*#/.test(l) ? 'commentaire'
    : /^\s*Format\s*=/.test(l) ? 'parametre'
    : /^\s*\$Format\s*=/.test(l) ? 'locale'
    : 'AUTRE');
  const natures = differentes.map((i) => lignes.map((l) => nature(l[i])))
    .map((ns) => (ns.every((n) => n === ns[0]) ? ns[0] : 'AUTRE'));
  verifier(memeLongueur && differentes.length >= 1 && natures.every((n) => n !== 'AUTRE'),
    `B1 : ${id} — le format change ${differentes.length} ligne(s), toutes d'une nature inoffensive `
    + `(${[...new Set(natures)].join(', ')})`);
  verifier(textes.every((x) => !/\$KjemoFormat\b/.test(differentes.map((i) => x.split('\n')[i]).join('\n'))),
    `B2 : ${id} — aucune ligne qui varie avec le format ne mentionne $KjemoFormat`);
  verifier(textes.every((x) => x.split('\n').filter((l) => /\$Format\b/.test(l) && !/^\s*#/.test(l))
    .every((l) => /^\s*\$Format\s*=/.test(l))),
    `B3 : ${id} — la variable locale $Format n'est jamais LUE : elle n'est qu'affectée`);
  verifier(textes.every((x) => verdictFormat(x) === 'MORT'),
    `B4 : ${id} — aucun des 4 formats ne pose $KjemoFormat : l'export reste débranché`);
}

// ===========================================================================
console.log('');
console.log('Passe C — les 144 scripts historiques portent le défaut (lus, jamais écrits)');
// ===========================================================================
const dossierGen = resolve(ROOT, 'test/generated');
if (!existsSync(dossierGen)) {
  fail('C0 : test/generated est absent — lancer « node test/generate-ps1.mjs » AVANT ce banc (le banc ne génère pas)');
} else {
  const fichiers = readdirSync(dossierGen).filter((n) => n.endsWith('.ps1'));
  let total = 0;
  for (const id of ecrite) {
    const siens = fichiers.filter((n) => n.startsWith(`${id}__`));
    total += siens.length;
    const morts = siens.filter((n) => verdictFormat(readFileSync(join(dossierGen, n), 'utf8')) === 'MORT');
    verifier(siens.length === 8 && morts.length === 8,
      `C1 : ${id} — ${morts.length}/${siens.length} scripts portent le défaut (8 jeux attendus)`);
  }
  verifier(total === 144, `C2 : 18 assistants × 8 jeux = 144 scripts concernés (mesuré : ${total})`);

  // Les 856 historiques : le défaut touche 144 d'entre eux, pas davantage.
  const tousMorts = fichiers.filter((n) => verdictFormat(readFileSync(join(dossierGen, n), 'utf8')) === 'MORT');
  verifier(tousMorts.length === 144,
    `C3 : sur ${fichiers.length} scripts .ps1, exactement 144 portent le défaut (mesuré : ${tousMorts.length})`);
  verifier(tousMorts.every((n) => ecrite.some((id) => n.startsWith(`${id}__`))),
    'C4 : aucun script hors de la liste ne porte le défaut');

  // La baseline des 856 n'est pas touchée : les 144 scripts en défaut y figurent,
  // avec l'empreinte du fichier écrit sur le disque (BOM compris), et le disque
  // la retrouve à l'identique. Ce banc lit — il n'écrit rien.
  const base = JSON.parse(readFileSync(resolve(ROOT, 'test/scripts-baseline-856.json'), 'utf8'));
  const sha = (n) => createHash('sha256').update(readFileSync(join(dossierGen, n))).digest('hex');
  const enDefaut = tousMorts;
  const dansBase = enDefaut.filter((n) => Object.prototype.hasOwnProperty.call(base.sha256, n));
  verifier(base.total === 856 && Object.keys(base.sha256).length === 856,
    'C5 : la baseline versionnée contient bien 856 empreintes');
  verifier(dansBase.length === 144,
    `C6 : les 144 scripts en défaut figurent TOUS dans la baseline (${dansBase.length}/144) — la comparaison n'est pas vide`);
  const ecarts = dansBase.filter((n) => base.sha256[n] !== sha(n));
  verifier(ecarts.length === 0,
    `C7 : les 144 scripts en défaut sont identiques, à l'octet, à la baseline (${ecarts.length} écart(s))`);
}

// ===========================================================================
console.log('');
console.log('Passe D — CONTRÔLE POSITIF : le détecteur reconnaît les assistants sains');
// ===========================================================================
const sains = powershell.filter((t) => verdictFormat(t.generate(valeursPar(t))) === 'SAIN').map((t) => t.id);
verifier(sains.length > 0, `D1 : ${sains.length} assistants posent la variable et sont reconnus sains`);
for (const id of ['windows-domain-join-readiness', 'windows-domain-join', 'windows-domain-join-diagnostic']) {
  verifier(sains.includes(id), `D2 : ${id} (LOT 7) pose la variable → SAIN`);
}
verifier(!sains.some((id) => ecrite.includes(id)), 'D3 : aucun assistant de la dette n\'est reconnu sain');
verifier(sains.length + ecrite.length + powershell.filter((t) => verdictFormat(t.generate(valeursPar(t))) === 'SANS_EXPORT').length === powershell.length,
  'D4 : SAIN + MORT + SANS_EXPORT couvrent tous les assistants PowerShell');

// ===========================================================================
console.log('');
console.log('Passe E — CONTRE-ÉPREUVE : le détecteur bouge quand on bouge le script');
// ===========================================================================
{
  const sain = tools.find((t) => t.id === 'windows-domain-join-diagnostic');
  const texte = sain.generate(valeursPar(sain));
  verifier(verdictFormat(texte) === 'SAIN', 'E0 : point de départ SAIN');
  const sansAffectation = texte.split('\n').filter((l) => !AFFECTE.test(l)).join('\n');
  verifier(sansAffectation !== texte, 'E1 : l\'affectation a bien été retirée (le texte a changé)');
  verifier(verdictFormat(sansAffectation) === 'MORT', 'E1 — retirer l\'affectation d\'un script sain → le détecteur ACCUSE');

  const malade = tools.find((t) => t.id === 'sfc-repair');
  const tm = malade.generate(valeursPar(malade));
  verifier(verdictFormat(tm) === 'MORT', 'E2 : point de départ MORT');
  const repare = `$KjemoFormat = 'Console'\n${tm}`;
  verifier(verdictFormat(repare) === 'SAIN', 'E2 — ajouter l\'affectation à un script mort → le détecteur INNOCENTE');

  // Un commentaire n'est pas une affectation.
  const commente = `# $KjemoFormat = 'JSON'\n${tm}`;
  verifier(verdictFormat(commente) === 'MORT', 'E3 : « $KjemoFormat = » dans un commentaire ne compte pas comme affectation');
  // Un script sans export n'est pas accusé.
  verifier(verdictFormat('Write-Host "bonjour"') === 'SANS_EXPORT', 'E4 : un script sans bloc d\'export n\'est pas accusé');
}

console.log('');
console.log(`Dette LOT 6B (format du rapport) : ${ok} OK, ${echecs.length} ÉCHEC(S).`);
console.log('Dette MESURÉE, non corrigée : 18 assistants, 144 scripts. Correction prévue au LOT 6C, baseline auditée.');
process.exit(echecs.length === 0 ? 0 : 1);
