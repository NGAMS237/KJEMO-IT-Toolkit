// ===========================================================================
// LOT 9 — Imprimantes : doubles CUPS pour les scripts Bash.
//
// Même principe que impression-doubles.mjs, côté Linux : les scripts Bash
// générés sont EXÉCUTÉS (bash réel), mais les commandes de CUPS sont de FAUX
// exécutables placés en tête du PATH. Chacun journalise son appel et répond
// d'après des fichiers d'état. Ce banc prouve la LOGIQUE du script (quels
// appels, dans quel ordre, avec quelle confirmation). Il ne prouve rien sur un
// vrai cupsd, un vrai pilote ou une vraie imprimante.
//
// Les commandes qui ne doivent JAMAIS être appelées (lpadmin, cupsctl, lprm,
// lp, lpmove, service) existent aussi, en faux : leur appel est journalisé et
// le banc le constate au lieu de laisser une commande absente échouer en
// silence.
// ===========================================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, chmodSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

/** Commandes dont l'appel est une ÉCRITURE sur CUPS ou sur le système. */
export const VERBES_MODIFIANTS = ['cancel', 'cupsenable', 'cupsaccept', 'cupsdisable', 'cupsreject', 'lpadmin', 'cupsctl', 'lprm', 'lp', 'lpmove', 'service'];
/** Commandes systemctl qui modifient (ou qui n'ont rien à faire dans ces scripts). */
export const SOUS_COMMANDES_SYSTEMCTL_MODIFIANTES = /^(restart|stop|start|reload|enable|disable|mask|unmask|kill|try-restart|reload-or-restart)\b/;

// Le faux exécutable vit dans un fichier à part : un gabarit JavaScript interpréterait les ${...} du Bash.
const FAUX = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures-impression', 'faux-cups.sh'), 'utf8');

/** Prépare un dossier de faux exécutables. `absents` retire des commandes du PATH. */
function preparer(dossier, etat, absents) {
  const bin = join(dossier, 'bin');
  const fake = join(dossier, 'fake');
  mkdirSync(bin, { recursive: true });
  mkdirSync(fake, { recursive: true });
  const modele = join(bin, '_faux');
  writeFileSync(modele, FAUX);
  chmodSync(modele, 0o755);
  const noms = ['lpstat', 'cancel', 'cupsenable', 'cupsaccept', 'cupsdisable', 'cupsreject', 'systemctl',
    'journalctl', 'getent', 'timeout', 'sleep', 'lpadmin', 'cupsctl', 'lprm', 'lp', 'lpmove', 'service'];
  for (const n of noms) {
    if (absents.includes(n)) continue;
    // Un lien vers le modèle : le faux lit son propre nom via $0 (basename).
    symlinkSync(modele, join(bin, n));
  }
  writeFileSync(join(fake, 'calls.log'), '');
  // État : destinations, travaux, drapeaux.
  const dests = (etat.dests ?? []).map((x) => [x.nom, x.actif === false ? 0 : 1, x.accepte === false ? 0 : 1, x.uri ?? 'ipp://192.168.30.50/ipp/print', x.raison ?? ''].join('|')).join('\n');
  writeFileSync(join(fake, 'dests'), dests ? `${dests}\n` : '');
  const jobs = (etat.jobs ?? []).map((j) => [j.id, j.proprio ?? 'labo', j.taille ?? 2048].join('|')).join('\n');
  writeFileSync(join(fake, 'jobs'), jobs ? `${jobs}\n` : '');
  for (const drapeau of etat.drapeaux ?? []) writeFileSync(join(fake, drapeau), '');
  if (etat.tcp !== undefined) writeFileSync(join(fake, 'tcp'), String(etat.tcp));
  return { bin, fake };
}

/** Exécute un script Bash généré avec les faux CUPS. */
export function executerCups(scriptGenere, etat = {}, { absents = [], delaiMs = 60000 } = {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'kjemo-cups-'));
  try {
    const { bin, fake } = preparer(dossier, etat, absents);
    const fichier = join(dossier, 'script.sh');
    writeFileSync(fichier, scriptGenere, 'utf8');
    const home = join(dossier, 'home');
    mkdirSync(home);
    const r = spawnSync('bash', [fichier], {
      cwd: dossier,
      env: { PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`, HOME: home, FAKE_DIR: fake, LANG: 'C.UTF-8' },
      encoding: 'utf8', timeout: delaiMs,
    });
    const appels = readFileSync(join(fake, 'calls.log'), 'utf8').split('\n').filter(Boolean).map((l) => {
      const [cmd, ...args] = l.split('\t');
      return { cmd, args };
    });
    const sortie = r.stdout ?? '';
    const m = sortie.match(/^Conclusion : (.*)$/m);
    const modifiants = appels.filter((a) =>
      VERBES_MODIFIANTS.includes(a.cmd)
      || (a.cmd === 'systemctl' && SOUS_COMMANDES_SYSTEMCTL_MODIFIANTES.test(a.args.join(' '))));
    return {
      statut: r.status, sortie, erreur: r.stderr ?? '', appels, modifiants,
      conclusion: m ? m[1] : null,
      etatFinal: {
        dests: existsSync(join(fake, 'dests')) ? readFileSync(join(fake, 'dests'), 'utf8') : '',
        jobs: existsSync(join(fake, 'jobs')) ? readFileSync(join(fake, 'jobs'), 'utf8') : '',
      },
    };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
