/**
 * mouchards-linux.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * LE BANC D'ESSAI DES ASSISTANTS LINUX QUI MODIFIENT QUELQUE CHOSE
 *
 * Cote Windows, le depot eprouve ses verrous en EXECUTANT les scripts dans une
 * session ou les applets d'ecriture sont remplacees par des mouchards, puis en
 * comptant les appels. Cote Linux, il n'y avait rien : les deux assistants
 * modifiants etaient eprouves en comptant les FICHIERS crees dans un dossier
 * jetable. C'est plus faible, et la difference n'est pas theorique — compter
 * les fichiers montre qu'aucun n'apparait, pas qu'aucune commande modifiante
 * n'a ete appelee. Un script qui appellerait `mkfs` sur le mauvais disque
 * n'ecrirait aucun fichier dans le dossier surveille.
 *
 * ---------------------------------------------------------------------------
 * COMMENT UN MOUCHARD BASH FONCTIONNE
 * ---------------------------------------------------------------------------
 * Bash n'a pas de « Mock-Command ». Le levier est le PATH : un dossier place
 * en TETE de PATH contient de faux executables portant le nom des vraies
 * commandes. Le script, lui, ne sait rien : il appelle `systemctl` et obtient
 * notre script, qui journalise son nom, ses arguments, et rend le code de
 * sortie qu'on lui a demande de rendre.
 *
 * Ce levier a une limite qu'il faut connaitre pour ne pas se mentir : il
 * n'attrape que les commandes EXTERNES resolues par le PATH. Une primitive du
 * shell (`cd`, `[`, `printf`), un chemin absolu (`/sbin/mkfs`) ou un appel via
 * `command -p` passeraient a cote. Le banc le verifie plutot que de l'esperer :
 * `cheminsAbsolusSuspects()` relit le script et refuse qu'il appelle une
 * commande surveillee par un chemin absolu, ce qui contournerait le mouchard.
 *
 * ---------------------------------------------------------------------------
 * CE QU'UN TEST NE DOIT JAMAIS ETRE
 * ---------------------------------------------------------------------------
 * « Zero appel interdit » est vrai aussi quand le script n'a pas demarre, quand
 * le mouchard n'a pas ete pose, ou quand le PATH n'a pas pris. Un banc qui se
 * contente de cette phrase est vert pour la plus mauvaise des raisons.
 *
 * D'ou trois obligations, tenues par `test/mouchards-linux.test.mjs` :
 *
 *   1. un CONTROLE POSITIF : dans la passe ou tout est satisfait, l'appel
 *      attendu DOIT avoir lieu. Sans lui, on ne distingue pas un verrou qui
 *      bloque d'un script qui ne fait rien ;
 *   2. un AUTO-TEST des mouchards : chaque mouchard est invoque directement et
 *      doit apparaitre au journal. Un mouchard muet rendrait tout vert ;
 *   3. le journal doit etre NON VIDE dans chaque passe ou le script est cense
 *      au moins observer. Un journal vide signale un PATH qui n'a pas pris.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync,
         readdirSync, statSync, chmodSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

/**
 * Les commandes surveillees, par famille.
 *
 * La liste vient de la consigne, et elle couvre deliberement des commandes que
 * AUCUN assistant n'appelle encore : les assistants de stockage, de Samba AD
 * et de jonction arrivent dans les commits suivants. Un mouchard pose
 * d'avance ne prouve rien sur un assistant qui n'existe pas — mais il garantit
 * que le jour ou cet assistant arrivera, il sera surveille sans qu'on ait a y
 * penser. L'auto-test (obligation 2) verifie que chacun fonctionne REELLEMENT,
 * y compris ceux que personne n'appelle encore.
 */
export const COMMANDES_SURVEILLEES = {
  services: ['systemctl', 'service'],
  comptes: ['useradd', 'usermod', 'userdel', 'groupadd', 'groupmod', 'gpasswd', 'passwd', 'chage'],
  droits: ['chmod', 'chown', 'chgrp', 'setfacl'],
  montage: ['mount', 'umount'],
  partition: ['sfdisk', 'fdisk', 'parted', 'wipefs', 'mkfs', 'mkfs.ext4', 'mkfs.xfs', 'blockdev'],
  quotas: ['quotacheck', 'quotaon', 'quotaoff', 'setquota', 'edquota'],
  raid: ['mdadm'],
  reseau: ['netplan', 'ip', 'ufw', 'nft', 'iptables'],
  ssh: ['sshd', 'ssh-keygen', 'ssh-copy-id'],
  samba: ['testparm', 'samba-tool', 'smbpasswd', 'net', 'pdbedit'],
  nfs: ['exportfs'],
  heure: ['timedatectl', 'chronyc', 'ntpdate'],
  archives: ['tar'],
};

/** Toutes les commandes surveillees, a plat. */
export const TOUTES_SURVEILLEES = Object.values(COMMANDES_SURVEILLEES).flat();

/**
 * Les applets PowerShell que la jonction de domaine Windows devra surveiller.
 *
 * Declarees ici pour que la liste existe et soit relisible, PAS pour pretendre
 * qu'elles sont deja eprouvees : les trois assistants de jonction arrivent au
 * commit 24/n, et leur banc sera celui des mouchards Windows, qui existe deja
 * et tourne sous les deux moteurs. Aucun mouchard PowerShell n'est pose ici.
 */
export const APPLETS_WINDOWS_A_SURVEILLER = [
  'Add-Computer', 'Remove-Computer', 'Set-DnsClientServerAddress',
  'Set-TimeZone', 'Restart-Computer', 'Rename-Computer',
];

/** Un bac a sable : dossier jetable, PATH pipe, journal, racine surveillee. */
export function creerBac(nom) {
  const racine = mkdtempSync(join(tmpdir(), `kjemo-mouch-${nom}-`));
  const bin = join(racine, 'bin');
  const travail = join(racine, 'travail');
  mkdirSync(bin);
  mkdirSync(travail);
  const journal = join(racine, 'journal.tsv');
  writeFileSync(journal, '', 'utf8');
  return { racine, bin, travail, journal, nom };
}

export function detruireBac(bac) {
  rmSync(bac.racine, { recursive: true, force: true });
}

/**
 * Pose un mouchard. `code` est le code de sortie rendu ; `sortie` ce qui est
 * ecrit sur la sortie standard ; `selonArgs` permet de rendre un code different
 * selon les arguments — indispensable pour eprouver « la relecture echoue »
 * sans empecher l'ecriture de reussir.
 */
export function poserMouchard(bac, commande, { code = 0, sortie = '', selonArgs = [] } = {}) {
  // Note sur le `--` passe a grep : sans lui, un motif comme « --test-label »
  // est pris par grep pour une suite d'options, et le mouchard rend alors
  // toujours son code par defaut. La passe C du banc paraissait verte pour
  // cette seule raison — le meme piege que `printf '--- fin ---'`, qui a deja
  // coute une correction dans ce lot.
  const chemin = join(bac.bin, commande);
  const cas = selonArgs.map(({ motif, code: c, sortie: s = '' }) => `
if printf '%s' "$*" | grep -qE -- ${quote(motif)}; then
  ${s ? `printf '%s\\n' ${quote(s)}` : ':'}
  exit ${c}
fi`).join('');

  writeFileSync(chemin, `#!/usr/bin/env bash
# Mouchard KJEMO — ${commande}. Journalise, puis rend un code choisi.
printf '%s\\t%s\\n' ${quote(commande)} "$*" >> ${quote(bac.journal)}
${cas}
${sortie ? `printf '%s\\n' ${quote(sortie)}` : ':'}
exit ${code}
`, 'utf8');
  chmodSync(chemin, 0o755);
  return chemin;
}

/** Pose un mouchard pour CHAQUE commande surveillee. */
export function poserTousLesMouchards(bac, options = {}) {
  for (const c of TOUTES_SURVEILLEES) {
    if (options[c] === 'reel') continue;          // laisser passer la vraie commande
    poserMouchard(bac, c, options[c] ?? {});
  }
}

const quote = (v) => `'${String(v).split("'").join("'\\''")}'`;

/** Le journal, en liste ordonnee : l'ordre des lignes EST l'ordre des appels. */
export function lireJournal(bac) {
  if (!existsSync(bac.journal)) return [];
  return readFileSync(bac.journal, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l, i) => {
      const [nom, ...reste] = l.split('\t');
      return { ordre: i + 1, nom, args: reste.join('\t') };
    });
}

/** Nombre d'appels d'une commande, eventuellement filtres par motif d'argument. */
export function compterAppels(journal, nom, motifArgs = null) {
  return journal.filter((e) => e.nom === nom
    && (motifArgs === null || new RegExp(motifArgs).test(e.args))).length;
}

/** La suite des noms appeles, dans l'ordre, doublons compris. */
export function ordreAppels(journal) {
  return journal.map((e) => e.nom);
}

/**
 * `true` si `avant` apparait avant `apres` dans le journal, les deux etant
 * presents. Un ordre « verifie » sur une commande absente serait vrai pour
 * rien : les deux presences sont exigees.
 */
export function appeleAvant(journal, avant, apres) {
  const i = journal.findIndex((e) => e.nom === avant);
  const j = journal.findIndex((e) => e.nom === apres);
  return i !== -1 && j !== -1 && i < j;
}

/** Instantane de l'arborescence surveillee : chemin relatif -> taille. */
export function etatFichiers(dossier) {
  const vus = {};
  const parcourir = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { parcourir(p); continue; }
      vus[relative(dossier, p)] = statSync(p).size;
    }
  };
  parcourir(dossier);
  return vus;
}

/** Ce qui est apparu, a disparu, ou a change de taille entre deux instantanes. */
export function diffFichiers(avant, apres) {
  const ajoutes = Object.keys(apres).filter((k) => !(k in avant));
  const retires = Object.keys(avant).filter((k) => !(k in apres));
  const modifies = Object.keys(apres).filter((k) => k in avant && avant[k] !== apres[k]);
  return { ajoutes, retires, modifies };
}

/**
 * Execute un script dans le bac. Le PATH du bac passe EN TETE.
 *
 * `env` complete l'environnement ; `KJEMO_JOURNAL` n'est pas utilise par les
 * mouchards (le chemin y est en dur) pour qu'un script qui viderait son
 * environnement ne puisse pas rendre les mouchards muets par accident.
 */
export function executer(bac, texteScript, { env = {}, args = [] } = {}) {
  const chemin = join(bac.racine, 'script.sh');
  writeFileSync(chemin, texteScript, 'utf8');
  chmodSync(chemin, 0o755);

  const avant = etatFichiers(bac.travail);
  let sortie = '';
  let code = 0;
  try {
    sortie = execFileSync('bash', [chemin, ...args], {
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, PATH: `${bac.bin}:${process.env.PATH}`, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    code = typeof e.status === 'number' ? e.status : -1;
    sortie = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const apres = etatFichiers(bac.travail);
  return {
    code,
    sortie,
    journal: lireJournal(bac),
    fichiers: diffFichiers(avant, apres),
    etatApres: apres,
  };
}

/**
 * Les appels d'une commande surveillee par CHEMIN ABSOLU, qui contourneraient
 * le PATH et donc le mouchard.
 *
 * Ce controle est la condition de validite de tout le banc : sans lui, « zero
 * appel interdit » pourrait vouloir dire « l'appel a eu lieu, mais hors de ma
 * vue ».
 */
export function cheminsAbsolusSuspects(texteScript) {
  const suspects = [];
  for (const c of TOUTES_SURVEILLEES) {
    const motif = new RegExp(`(^|[\\s;|&(])(/(usr/)?(s?bin)/${c.replace('.', '\\.')})\\b`, 'm');
    const m = texteScript.match(motif);
    if (m) suspects.push({ commande: c, trouve: m[2] });
  }
  if (/\bcommand\s+-p\b/.test(texteScript)) {
    suspects.push({ commande: '(toutes)', trouve: 'command -p — PATH par defaut, mouchards contournes' });
  }
  return suspects;
}
