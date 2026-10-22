/**
 * negatifs-lot7.mjs — LOT 7 (25/n) · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * OUTILLAGE DU BANC DES FAMILLES NÉGATIVES
 *
 * Ce module ne contient AUCUN verdict : il fournit au banc de quoi MESURER.
 *
 *   - un CLASSIFIEUR d'appels modifiants, qui dit pour chaque entrée du journal
 *     des mouchards si elle lit ou si elle écrit ;
 *   - un exécuteur de script dans un bac à sable (HOME jetable, mouchards sur
 *     toutes les commandes surveillées, `id` délégué à la vraie commande) ;
 *   - l'extraction du BLOC DE CONFIRMATION d'un script généré, pour l'éprouver
 *     seul, sans exécuter le reste du script ;
 *   - une MUTATION exacte (elle doit s'appliquer exactement une fois) ;
 *   - une copie mutilée de dist/, importable, pour éprouver les verrous du
 *     FORMULAIRE de la même manière que ceux du script ;
 *   - une empreinte des fichiers système réels, pour prouver après coup que le
 *     banc n'a rien touché de la machine qui l'exécute.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI UN CLASSIFIEUR, ET POURQUOI IL EST ÉPROUVÉ À PART
 * ---------------------------------------------------------------------------
 * « Zéro appel modifiant » ne vaut que ce que vaut la définition de
 * « modifiant ». Un classifieur trop étroit laisserait passer `systemctl
 * restart` ; trop large, il condamnerait `systemctl is-active`. Il est donc
 * lui-même soumis à des exemples positifs ET négatifs dans le banc (famille
 * N00 : ce n'est pas une des 19 familles, c'est la condition de validité de
 * toutes).
 */
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as M from './mouchards-linux.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');
// KJEMO_DIST_DIR : éprouver une COPIE mutilée de dist/ (contre-épreuves du banc lui-même).
export const DIST = process.env.KJEMO_DIST_DIR ? resolve(process.env.KJEMO_DIST_DIR) : resolve(ROOT, 'dist');

// ---------------------------------------------------------------------------
// 1. Le classifieur d'appels
// ---------------------------------------------------------------------------

const premierMot = (args) => args.trim().split(/\s+/).filter((a) => !a.startsWith('-'))[0] ?? '';
const aOption = (args, ...opts) => opts.some((o) => new RegExp(`(^|\\s)${o}(\\s|=|$)`).test(args));

/**
 * `true` si l'appel écrit quelque chose (état du système, fichier, service,
 * compte, disque, règle réseau, export, paquet). `false` s'il ne fait que lire.
 *
 * Règle de prudence : une commande surveillée dont le sous-verbe est INCONNU
 * est classée modifiante. Mieux vaut un faux positif visible qu'un appel
 * d'écriture qui passerait pour une lecture.
 */
export function estModifiant(nom, args = '') {
  const a = args.trim();
  switch (nom) {
    case 'systemctl':
      return /^(start|stop|restart|reload|enable|disable|mask|unmask|daemon-reload|daemon-reexec|try-restart|reload-or-restart|try-reload-or-restart|kill|reset-failed|set-property|isolate|edit|link|revert|preset|poweroff|reboot|halt|suspend|hibernate)\b/.test(premierMot(a) === '' ? '' : premierMot(a));
    case 'service':
      return /\b(start|stop|restart|reload|force-reload)\b/.test(a);
    case 'journalctl':
      return aOption(a, '--vacuum-size', '--vacuum-time', '--vacuum-files', '--rotate', '--flush', '--sync', '--relinquish-var');
    case 'useradd': case 'usermod': case 'userdel': case 'groupadd': case 'groupmod': case 'groupdel':
    case 'gpasswd': case 'chpasswd': case 'newusers':
      return true;
    case 'passwd':
      return !aOption(a, '-S', '--status');
    case 'chage':
      return !aOption(a, '-l', '--list');
    case 'chmod': case 'chown': case 'chgrp': case 'setfacl':
      return !aOption(a, '--test');
    case 'mount':
      // `mount` sans argument ou avec -l ne fait que lister.
      return a !== '' && !/^(-l|-t\s+\S+|--show-labels)$/.test(a);
    case 'umount':
      return true;
    case 'sfdisk':
      return !aOption(a, '-d', '--dump', '-l', '--list', '-J', '--json', '-V', '--version', '--help', '-h', '-s', '--show-size', '-F', '--list-free');
    case 'fdisk':
      return !aOption(a, '-l', '--list', '-s', '-V', '--version', '--help', '-h');
    case 'parted':
      return !/\b(print|p|unit)\b/.test(a) && !aOption(a, '-l', '--list', '-v', '--version', '-h', '--help');
    case 'wipefs':
      // Sans -a/-o/-f, wipefs liste seulement les signatures. -n (--no-act) annule l'écriture.
      return /(^|\s)(-a|--all|-o|--offset|-f|--force)(\s|=|$)/.test(a) && !aOption(a, '-n', '--no-act');
    case 'mkfs': case 'mkfs.ext4': case 'mkfs.xfs': case 'mke2fs':
      return true;
    case 'blockdev':
      return !aOption(a, '--getsize64', '--getsz', '--getss', '--getbsz', '--getro', '--report', '--getpbsz', '--getiomin', '--getioopt', '--getra', '--getalignoff');
    case 'quotacheck': case 'quotaon': case 'quotaoff': case 'setquota': case 'edquota':
      return true;
    case 'mdadm':
      return !(aOption(a, '--detail', '-D', '--examine', '-E', '--query', '-Q', '--version', '-V', '--help', '-h') && !aOption(a, '--create', '-C', '--add', '--remove', '--fail', '--stop', '-S', '--assemble', '-A', '--grow', '-G', '--zero-superblock'));
    case 'netplan':
      // `generate --root-dir <dossier jetable>` écrit hors de /etc et de /run :
      // c'est la validation, pas l'application.
      if (/^(apply|try|set|rebind|migrate|ip)\b/.test(a)) return true;
      if (/^generate\b/.test(a)) return !/--root-dir\s+\S+/.test(a);
      return false;
    case 'ip': {
      const verbe = a.split(/\s+/).filter((x) => !x.startsWith('-') && !/^(brief|color|json|family|inet|inet6)$/.test(x));
      return verbe.some((x) => /^(add|del|delete|replace|set|flush|change|append|prepend|save|restore)$/.test(x));
    }
    case 'ufw':
      return /^(allow|deny|reject|limit|enable|disable|reset|delete|insert|route|default|reload|logging|app|--force)\b/.test(a);
    case 'nft':
      return /\b(add|delete|flush|insert|replace|create|destroy|rename|-f|--file)\b/.test(a) && !/^(-j\s+)?list\b/.test(a);
    case 'iptables':
      return /(^|\s)-[ADIFPXNRZ]\b|--(append|delete|insert|flush|policy|delete-chain|new-chain|replace|zero)\b/.test(a);
    case 'sshd':
      // `sshd -t` (test) et `sshd -T` (dump) ne démarrent rien. Tout autre
      // appel démarre un démon.
      return !/(^|\s)-[a-zA-Z]*[tT]\b/.test(a) && !aOption(a, '-V');
    case 'ssh-keygen':
      // -l (empreinte), -F (recherche dans known_hosts) : lectures, y compris groupées (-lf).
      return !/(^|\s)-[a-zA-Z]*[lFBH][a-zA-Z]*(\s|$)/.test(a);
    case 'ssh-copy-id':
      return true;
    case 'testparm':
      return false;
    case 'samba-tool': {
      if (/\b(provision|join|demote|add|create|delete|remove|setpassword|enable|disable|move|rename|set|unlock|changepassword|import|export|backup|restore|reset-password|expire|setexpiry|addmembers|removemembers|sync|--fix)\b/.test(a)) return true;
      return false;
    }
    case 'smbpasswd': case 'pdbedit':
      return nom === 'smbpasswd' ? true : /(^|\s)-[a-zA-Z]*[axrcz]\b|--(create|delete|modify|account-policy)/.test(a);
    case 'net':
      return /\b(join|leave|changetrustpw|add|delete|set|create|remove)\b/.test(a);
    case 'exportfs':
      // -v et -s listent. -r, -a, -u, -o, ou un client:chemin appliquent.
      return !/^(-v|-s|-vs|-sv)?$/.test(a);
    case 'timedatectl':
      return /^(set-|--adjust)/.test(premierMot(a));
    case 'chronyc':
      return /\b(makestep|burst|add|delete|settime|offline|online|cyclelogs|shutdown|reselect|rekey)\b/.test(a);
    case 'ntpdate':
      return !aOption(a, '-q', '-d');
    case 'hwclock':
      return !aOption(a, '--show', '-r', '--get', '--test', '-v', '--verbose', '--version', '-V', '--help', '-h') || aOption(a, '--systohc', '-w', '--hctosys', '-s', '--set');
    case 'apt-get':
      return !aOption(a, '-s', '--simulate', '--dry-run', '-n', '--just-print', '--recon', '--no-act');
    case 'apt':
      return /^(install|remove|purge|upgrade|full-upgrade|dist-upgrade|autoremove|update|edit-sources|satisfy)\b/.test(a);
    case 'apt-mark':
      return /^(hold|unhold|manual|auto|minimize-manual)\b/.test(a);
    case 'apt-cache':
      return false;
    case 'dpkg':
      return /(^|\s)(-i|--install|-r|--remove|-P|--purge|--configure|--unpack|--set-selections|--clear-avail|--update-avail|--merge-avail|--add-architecture|--remove-architecture)\b/.test(a);
    case 'dpkg-query':
      return false;
    case 'tar':
      return (/(^|\s)-?[a-zA-Z]*[cxruA][a-zA-Z]*(\s|$)|--(create|extract|get|append|update|concatenate|delete)\b/.test(a)) && !(/(^|\s)-?[a-zA-Z]*t[a-zA-Z]*(\s|$)|--list\b/.test(a));
    default:
      // Commande surveillée inconnue du classifieur : on suppose l'écriture.
      return M.TOUTES_SURVEILLEES.includes(nom);
  }
}

/**
 * Les entrées du journal qui écrivent.
 *
 * `racinesPropres` documente la SEULE exception admise : un chmod/chown/chgrp/
 * setfacl dont TOUS les chemins sont sous une racine que le script a lui-même
 * créée (son dossier temporaire `/tmp/kjemo-…`, le HOME du bac). C'est son
 * fichier de travail, pas le système. Toute autre cible reste comptée.
 */
export function appelsModifiants(journal, racinesPropres = []) {
  return journal.filter((e) => {
    if (!estModifiant(e.nom, e.args)) return false;
    if (['chmod', 'chown', 'chgrp', 'setfacl'].includes(e.nom) && racinesPropres.length > 0) {
      const chemins = e.args.split(/\s+/).filter((t) => t.startsWith('/'));
      if (chemins.length > 0 && chemins.every((c) => racinesPropres.some((r) => c.startsWith(r)))) return false;
    }
    return true;
  });
}

/** Résumé lisible d'une liste d'appels. */
export const resume = (liste) => liste.map((e) => `${e.nom} ${e.args}`.trim()).join(' | ') || 'aucun';

// ---------------------------------------------------------------------------
// 2. Génération et exécution
// ---------------------------------------------------------------------------

/** Valeurs par défaut d'un assistant. */
export const defauts = (outil) => Object.fromEntries((outil.fields ?? []).map((f) => [f.id, f.default ?? '']));

/** Le champ de confirmation d'un assistant modifiant. */
export const champConfirmation = (outil) => (outil.fields ?? []).find((f) => /confirm/i.test(f.id))?.id ?? null;

/** La phrase exacte annoncée par un script qui refuse. */
export function phraseAnnoncee(sortie) {
  const m = /Phrase attendue : (.*)/.exec(sortie);
  return m ? m[1].trim() : null;
}

/**
 * Exécute un texte de script dans un bac à sable. Tous les binaires surveillés
 * sont des mouchards ; `id` délègue à la vraie commande pour que le contrôle de
 * privilèges lise un vrai identifiant ; `extra(bac)` pose des réglages propres
 * au scénario (réponses de lecture, mémoire d'un mouchard).
 */
export function lancer(texteOuFabrique, { extra = null, env = {}, nom = 'neg', apres = null } = {}) {
  const bac = M.creerBac(nom);
  try {
    M.poserTousLesMouchards(bac);
    M.poserMouchard(bac, 'id', { code: 0, avant: ['exec /usr/bin/id "$@"'] });
    if (extra) extra(bac);
    const texte = typeof texteOuFabrique === 'function' ? texteOuFabrique(bac) : texteOuFabrique;
    const r = M.executer(bac, texte, { env: { HOME: bac.travail, ...env } });
    const lu = apres ? apres(bac, r) : null;
    return { ...r, bac, texte, lu, racinesPropres: ['/tmp/kjemo-', bac.travail] };
  } finally {
    M.detruireBac(bac);
  }
}

// ---------------------------------------------------------------------------
// 3. Le bloc de confirmation
// ---------------------------------------------------------------------------

const MOTIF_BLOC = /KJEMO_CONFIRMATION_OK=0\nif \[ "\$\{(\w+)\}" = ('(?:[^']|'\\'')*') \]; then\n {2}KJEMO_CONFIRMATION_OK=1\nfi/;

/** Extrait le bloc de confirmation d'un script généré (ou `null`). */
export function extraireBlocConfirmation(texte) {
  const m = MOTIF_BLOC.exec(texte);
  if (!m) return null;
  return { texte: m[0], variable: m[1], phraseLitterale: m[2] };
}

/**
 * Éprouve UNIQUEMENT le bloc : `saisie` est affectée à la variable, le bloc
 * est exécuté, et on lit KJEMO_CONFIRMATION_OK. Aucune commande du reste du
 * script n'est appelée — c'est pourquoi on peut l'appliquer à un outil qui
 * écrirait dans /etc.
 */
export function ouvreLaPorte(bloc, saisie, blocTexte = bloc.texte) {
  const bac = M.creerBac('porte');
  try {
    const sq = (v) => `'${String(v).split("'").join("'\\''")}'`;
    const prog = `#!/usr/bin/env bash\nset -u\n${bloc.variable}=${sq(saisie)}\n${blocTexte}\nprintf '%s' "\${KJEMO_CONFIRMATION_OK}"\n`;
    const r = M.executer(bac, prog);
    return r.sortie.trim() === '1';
  } finally {
    M.detruireBac(bac);
  }
}

// ---------------------------------------------------------------------------
// 4. Mutation exacte
// ---------------------------------------------------------------------------

/**
 * Remplace `de` par `vers`, en exigeant EXACTEMENT UNE occurrence. Une mutation
 * qui ne trouve pas sa cible serait un faux positif de sécurité : la
 * contre-épreuve passerait sans avoir rien désarmé.
 */
export function muter(texte, de, vers, nom = 'mutation') {
  const n = typeof de === 'string' ? texte.split(de).length - 1 : (texte.match(new RegExp(de.source, de.flags.includes('g') ? de.flags : `${de.flags}g`)) ?? []).length;
  if (n !== 1) throw new Error(`${nom} : la cible est trouvée ${n} fois (exactement 1 exigée)`);
  return typeof de === 'string' ? texte.replace(de, () => vers) : texte.replace(de, vers);
}

// ---------------------------------------------------------------------------
// 5. Copie mutilée de dist/
// ---------------------------------------------------------------------------

/**
 * Copie dist/ dans un dossier jetable, applique UNE mutation à un de ses
 * fichiers (exactement une occurrence), et rend `{ tools, dossier, nettoyer }`
 * importés depuis la copie. Les oracles restent importés depuis le dist/ intact.
 */
export async function distMutee(fichier, de, vers, nom = 'mutation') {
  const dossier = mkdtempSync(join(tmpdir(), 'kjemo-neg-dist-'));
  cpSync(DIST, dossier, { recursive: true });
  const cible = join(dossier, fichier);
  const avant = readFileSync(cible, 'utf8');
  // `de` et `vers` peuvent être des listes de même longueur : un verrou à deux étages
  // (règle dédiée + règle de repli) ne se désarme qu'en arrachant les deux.
  const des = Array.isArray(de) ? de : [de];
  const verss = Array.isArray(vers) ? vers : [vers];
  let apres = avant;
  des.forEach((d, i) => { apres = muter(apres, d, verss[i], `${nom} (${i + 1}/${des.length})`); });
  if (apres === avant) throw new Error(`${nom} : la mutation n'a rien changé`);
  writeFileSync(cible, apres, 'utf8');
  const mod = await import(`${pathToFileURL(join(dossier, 'generators.mjs')).href}?m=${Date.now()}${Math.random()}`);
  return { tools: mod.tools, dossier, nettoyer: () => rmSync(dossier, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// 6. Empreinte des fichiers système réels
// ---------------------------------------------------------------------------

export const FICHIERS_SYSTEME = [
  '/etc/passwd', '/etc/group', '/etc/shadow', '/etc/fstab', '/etc/hosts', '/etc/exports',
  '/etc/samba/smb.conf', '/etc/ssh/sshd_config', '/etc/sudoers', '/etc/crontab',
  '/etc/netplan', '/etc/ssh/sshd_config.d', '/etc/sudoers.d', '/etc/cron.d',
];

/** SHA-256 de chaque fichier (ou de la liste des entrées d'un dossier). */
export function empreinteSysteme() {
  const out = {};
  for (const p of FICHIERS_SYSTEME) {
    try {
      if (!existsSync(p)) { out[p] = 'absent'; continue; }
      const st = statSync(p);
      if (st.isDirectory()) {
        out[p] = createHash('sha256').update(readdirSync(p).sort().join('\n')).digest('hex');
      } else {
        out[p] = createHash('sha256').update(readFileSync(p)).digest('hex');
      }
    } catch (e) {
      out[p] = `illisible:${e.code ?? 'ERR'}`;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 7. Détecteur de secrets
// ---------------------------------------------------------------------------

/**
 * Motifs qui trahissent un secret en clair. Volontairement spécifiques : un
 * détecteur qui crie sur le mot « password » dans un commentaire pédagogique
 * serait désactivé au bout d'une semaine.
 */
export const MOTIFS_SECRETS = [
  { nom: 'affectation de mot de passe en clair', re: /[A-Za-z0-9_]*(password|passwd|mot_de_passe|motdepasse|secret|token|apikey|api_key)(\s*=\s*|:\s?)(?!['"]?(?:\$|\{|<|\*{3}|\.{3}|xxx|aucun|vide|non\b|oui\b|\(|['"]?\s*$))['"]?\S{4,}/i },
  { nom: 'option --password= suivie d\'une valeur', re: /--(password|passwd|adminpass|admin-password)=(?!\$|\{|<|['"]?\s*$)\S{3,}/i },
  { nom: 'bloc de clé privée', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nom: 'chaîne chpasswd user:motdepasse', re: /\bchpasswd\b.*\S+:\S{4,}|\S+:[^\s"'|]{4,}["']?\s*\|\s*chpasswd\b/ },
  { nom: 'jeton AWS / GitHub / Slack', re: /\b(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/ },
  { nom: 'URL avec identifiants', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{3,}@/i },
];

/** Les secrets trouvés dans un texte, avec la ligne fautive. */
export function secretsDans(texte) {
  const trouves = [];
  texte.split('\n').forEach((ligne, i) => {
    // Une ligne de commentaire est une explication, pas une affectation.
    if (/^\s*#/.test(ligne)) return;
    for (const m of MOTIFS_SECRETS) {
      if (m.re.test(ligne)) trouves.push({ motif: m.nom, ligne: i + 1, extrait: ligne.trim().slice(0, 100) });
    }
  });
  return trouves;
}

/** Les commandes surveillées appelées par chemin absolu (contournement du PATH). */
export const cheminsAbsolusSuspectsLocal = (texte) => M.cheminsAbsolusSuspects(texte);

/**
 * Valeurs d'un assistant dont les chemins pointent DANS le bac. Les assistants
 * qui exigent une source ou une cible existante (sauvegarde, permissions)
 * reçoivent un dossier réel et jetable : sans cela, le script s'arrêterait
 * avant la zone observée, et le test serait vert pour cette seule raison.
 */
export function valeursDansLeBac(outil, bac, surcharge = {}) {
  const v = { ...defauts(outil), format: 'Console' };
  for (const f of outil.fields ?? []) {
    if (typeof f.default === 'string' && f.default.startsWith('/srv/')) v[f.id] = f.default.replace('/srv/', `${bac.travail}/`);
  }
  if (outil.id === 'bash-backup-directory') {
    mkdirSync(`${bac.travail}/source`, { recursive: true });
    mkdirSync(`${bac.travail}/archives`, { recursive: true });
    writeFileSync(`${bac.travail}/source/a.txt`, 'contenu\n', 'utf8');
    v.source = `${bac.travail}/source`;
    v.destination = `${bac.travail}/archives`;
  }
  return { ...v, ...surcharge };
}

/** La phrase littérale du bloc de confirmation, débarrassée de ses guillemets. */
export function phraseStatique(texte) {
  const b = extraireBlocConfirmation(texte);
  if (!b) return null;
  return b.phraseLitterale.slice(1, -1).split("'\\''").join("'");
}

/**
 * Comme `muter`, mais pour une mutation qui s'applique à PLUSIEURS endroits
 * par construction (par exemple « toutes les fermetures du verrou »). Le
 * nombre attendu est exigé : une mutation qui s'applique à moins d'endroits
 * que prévu n'a pas désarmé tout le verrou.
 */
export function muterN(texte, de, vers, attendu, nom = 'mutation') {
  const re = typeof de === 'string' ? new RegExp(de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : new RegExp(de.source, de.flags.includes('g') ? de.flags : `${de.flags}g`);
  const n = (texte.match(re) ?? []).length;
  if (n !== attendu) throw new Error(`${nom} : ${n} occurrence(s) trouvée(s), ${attendu} attendue(s)`);
  return texte.replace(re, () => vers);
}

/**
 * Isole un morceau d'un script entre deux ancres, pour l'exécuter SEUL. Les
 * deux ancres doivent exister exactement une fois.
 */
export function extraireEntre(texte, debut, fin) {
  const i = texte.indexOf(debut);
  if (i === -1 || texte.indexOf(debut, i + 1) !== -1) throw new Error(`ancre de début absente ou répétée : ${debut.slice(0, 40)}`);
  const j = texte.indexOf(fin, i);
  if (j === -1) throw new Error(`ancre de fin absente : ${fin.slice(0, 40)}`);
  return texte.slice(i, j);
}

/**
 * Exécute un MORCEAU de script dans un bac, avec un `kjemo_resultat` de
 * substitution qui journalise « Catégorie|Contrôle|État ». Le morceau ne peut
 * donc appeler aucune commande du reste du script : on peut l'éprouver même
 * quand le script entier écrirait dans /etc/fstab.
 */
export function executerMorceau(morceau, { avant = '', apres = '', extra = null, env = {} } = {}) {
  const bac = M.creerBac('morceau');
  try {
    M.poserTousLesMouchards(bac);
    M.poserMouchard(bac, 'id', { code: 0, avant: ['exec /usr/bin/id "$@"'] });
    if (extra) extra(bac);
    const prog = [
      '#!/usr/bin/env bash',
      'set -u',
      `KJEMO_TMP="${bac.travail}"`,
      "kjemo_resultat() { printf 'RES|%s|%s|%s\\n' \"$1\" \"$2\" \"$3\"; }",
      avant,
      morceau,
      apres,
      '',
    ].join('\n');
    const r = M.executer(bac, prog, { env: { HOME: bac.travail, ...env } });
    return { ...r, resultats: r.sortie.split('\n').filter((l) => l.startsWith('RES|')).map((l) => l.split('|').slice(1)) };
  } finally {
    M.detruireBac(bac);
  }
}
