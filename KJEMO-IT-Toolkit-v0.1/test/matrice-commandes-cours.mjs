#!/usr/bin/env node
/**
 * matrice-commandes-cours.mjs — KJEMO-COURS-TP2-01-R1 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * MATRICE « commande des notes de cours → fiche ou commande rapide → route →
 * état réel ». Elle est RECALCULÉE : la liste des commandes retenues est
 * déclarée ici (par domaine prioritaire), mais pour chacune on vérifie
 *   1. que le catalogue la contient réellement dans une ligne à copier
 *      (fiche rédigée ou commande rapide) ;
 *   2. que la fiche existe et possède une route (#/tache/…).
 * Une commande déclarée sans route fait ÉCHOUER le banc. Ce banc ne lit PAS les
 * documents d'origine (ils ne sont pas dans le dépôt) : la colonne « notes »
 * indique seulement dans quel document de cours la commande est citée, d'après
 * la lecture faite lors de la mission.
 *   node test/matrice-commandes-cours.mjs --ecrire | --verifier
 * NE PROUVE PAS : qu'une commande marche sur une machine réelle (NON EXÉCUTÉ).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs');
const SORTIE = resolve(ROOT, 'docs', 'COURS-COMMANDES-MATRICE.md');

// domaine → [commande, document de cours où elle est citée]
const S10 = 'S10.1'; const R = 'Résumé Linux'; const F3 = 'Formatif 3'; const F4 = 'Formatif 4'; const SMB = 'Cours Samba'; const F7 = 'Formatif 7'; const S1 = 'S1'; const S2 = 'S2';
export const DOMAINES = [
  { id: 'fichiers', titre: 'Fichiers et dossiers', cmds: [['pwd', R], ['ls', R], ['cd', R], ['mkdir', R], ['touch', R], ['cp', R], ['mv', R], ['rm', R], ['rmdir', R], ['ln', 'S10.2'], ['file', S10], ['stat', F7], ['find', S10], ['locate', S10], ['which', S10], ['tar', S10], ['gzip', S10]] },
  { id: 'texte', titre: 'Lire, chercher et filtrer du texte', cmds: [['cat', R], ['more', R], ['head', R], ['tail', R], ['wc', R], ['grep', R], ['sort', R], ['cut', R], ['awk', R], ['diff', R], ['tr', R], ['echo', R]] },
  { id: 'comptes', titre: 'Comptes, groupes et droits', cmds: [['id', R], ['whoami', F7], ['who', S10], ['groups', R], ['last', S10], ['useradd', R], ['usermod', R], ['userdel', S10], ['passwd', R], ['chmod', R], ['chown', R], ['su', R], ['sudo', R]] },
  { id: 'services', titre: 'Services, processus et journaux', cmds: [['systemctl', SMB], ['service', R], ['ps', S10], ['top', S10], ['kill', S10], ['free', S10], ['shutdown', S10], ['at', S10], ['crontab', S10], ['journalctl', 'catalogue'], ['date', R]] },
  { id: 'reseau', titre: 'Réseau', cmds: [['ip', S1], ['ifconfig', S1], ['ping', S1], ['netplan', S1], ['host', S1], ['smbclient', SMB]] },
  { id: 'stockage', titre: 'Stockage, RAID et quotas', cmds: [['fdisk', F3], ['mkfs.ext4', F3], ['e2label', F3], ['tune2fs', F3], ['fsck', S10], ['blkid', F3], ['df', F3], ['du', R], ['mount', F3], ['umount', F3], ['partprobe', F3], ['mdadm', F4], ['quotacheck', F3], ['quotaon', F3], ['edquota', F3]] },
  { id: 'samba', titre: 'Samba et domaine', cmds: [['samba-tool', SMB], ['testparm', SMB], ['smbstatus', SMB], ['smbcontrol', SMB], ['wbinfo', SMB], ['net', SMB]] },
  { id: 'bash', titre: 'Bash', cmds: [['read', S2], ['exit', S2], ['printf', S2]] },
];

/** Première commande de chaque segment d'une ligne (tubes, && , ;). */
function premieres(cmd) {
  return String(cmd).split(/\s*(?:\|\||&&|\||;)\s*/).map((seg) => {
    const m = seg.match(/^\s*(?:sudo\s+(?:-\w+\s+)*)?(?:env\s+\w+=\S+\s+)?([A-Za-z][\w.-]*)/);
    return m ? m[1] : null;
  }).filter(Boolean);
}
const index = new Map(); // commande → Set d'entrées
function noter(c, id) { const s = index.get(c) ?? new Set(); s.add(id); index.set(c, s); }
for (const e of T.TOUTES_LES_ENTREES) {
  if (e.procedure) for (const m of e.procedure.methodes) for (const et of m.etapes) for (const l of et.lignes ?? []) if (typeof l.cmd === 'string') premieres(l.cmd).forEach((c) => noter(c, e.id));
  if (typeof e.commande === 'string') premieres(e.commande).forEach((c) => noter(c, e.id));
}
const sansBash = (s) => s;
const etatDe = (ids) => (ids.some((i) => i.startsWith('cours-samba-import')) ? 'Documentaire ; script d’import exécuté contre un FAUX samba-tool' : 'Documentaire : relu, non exécuté');

export function lignesMatrice() {
  const lignes = [];
  for (const d of DOMAINES) for (const [cmd, doc] of d.cmds) {
    const ids = [...(index.get(cmd) ?? [])].sort();
    lignes.push({ domaine: d.titre, cmd, doc, ids });
  }
  return lignes;
}

function fabriquer() {
  const lignes = lignesMatrice();
  const L = [];
  L.push('# Matrice des commandes du cours → fiche → route → état réel', '');
  L.push('Produite par `node test/matrice-commandes-cours.mjs --ecrire` ; `--verifier` échoue si ce fichier est périmé, et le banc échoue si une commande déclarée n’a aucune route dans le catalogue. **« Couverte » veut dire : une fiche rédigée à la main ou une commande rapide contient cette commande dans une ligne à copier. Ce n’est pas une exécution : aucune commande n’a été lancée sur une machine réelle** (Ubuntu, Windows, Samba, RAID : NON EXÉCUTÉ).', '');
  const sans = lignes.filter((l) => !l.ids.length);
  L.push(`Commandes suivies : ${lignes.length} · avec route : ${lignes.length - sans.length} · sans route : ${sans.length}${sans.length ? ` (${sans.map((l) => l.cmd).join(', ')})` : ''}.`, '');
  for (const d of DOMAINES) {
    L.push(`## ${d.titre}`, '', '| Commande | Citée dans | Fiches ou commandes rapides | Route | État réel |', '|---|---|---|---|---|');
    for (const l of lignes.filter((x) => x.domaine === d.titre)) {
      const routes = l.ids.slice(0, 4).map((i) => `\`#/tache/${i}\``).join(' ');
      const plus = l.ids.length > 4 ? ` (+${l.ids.length - 4})` : '';
      L.push(`| \`${l.cmd}\` | ${l.doc} | ${l.ids.length ? l.ids.slice(0, 4).map((i) => `\`${i}\``).join(', ') + plus : '**AUCUNE**'} | ${l.ids.length ? routes + plus : '—'} | ${l.ids.length ? etatDe(l.ids) : '—'} |`);
    }
    L.push('');
  }
  return `${L.join('\n')}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const attendu = fabriquer();
  const manque = lignesMatrice().filter((l) => !l.ids.length);
  if (manque.length) { console.error(`[FAIL] commande(s) sans route : ${manque.map((l) => l.cmd).join(', ')}`); }
  if (process.argv.includes('--ecrire')) { writeFileSync(SORTIE, attendu); console.log(`écrit : ${SORTIE}`); }
  else if (process.argv.includes('--verifier')) {
    let actuel = ''; try { actuel = readFileSync(SORTIE, 'utf8'); } catch { /* absent */ }
    if (actuel !== attendu) { console.error('[FAIL] docs/COURS-COMMANDES-MATRICE.md est absent ou périmé : node test/matrice-commandes-cours.mjs --ecrire'); process.exit(1); }
    console.log('[OK]   docs/COURS-COMMANDES-MATRICE.md à jour');
  } else process.stdout.write(attendu);
  process.exit(manque.length ? 1 : 0);
}
