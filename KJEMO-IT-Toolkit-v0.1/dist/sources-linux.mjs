/**
 * sources-linux.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les préfixes d'URL acceptés comme sources officielles côté Linux, et la
 * raison de chacun.
 *
 * Côté Windows, la règle était simple parce que l'éditeur est unique : une
 * source devait commencer par `https://learn.microsoft.com/`. Linux n'a pas
 * d'éditeur unique, et c'est tout l'intérêt — mais cela veut dire qu'une liste
 * de domaines doit remplacer la règle à un seul préfixe, et qu'il faut la
 * justifier domaine par domaine plutôt que de l'allonger quand une source
 * manque.
 *
 * Le critère retenu : la source doit être PRIMAIRE, c'est-à-dire publiée par
 * les gens qui écrivent le logiciel ou qui maintiennent la distribution.
 * Un blogue, un forum, un agrégateur de recettes, un site de « 10 commandes
 * Linux à connaître » ne sont jamais normatifs, même quand ils ont raison :
 * on ne peut pas s'y référer pour trancher un désaccord, et ils ne sont pas
 * maintenus avec le logiciel.
 *
 * Ajouter un préfixe ici est une décision, pas un ajustement. Celui qui en
 * ajoute un doit pouvoir dire qui le publie et pourquoi c'est primaire.
 */

export const PREFIXES_SOURCES_LINUX = [
  // Les manpages telles que la distribution les livre : la référence exacte
  // pour la version d'Ubuntu visée, et non pour « Linux en général ».
  { prefixe: 'https://manpages.ubuntu.com/', editeur: 'Canonical — manpages Ubuntu' },
  // La documentation serveur d'Ubuntu, qui décrit les choix propres à la
  // distribution (chemins, paquets, valeurs par défaut).
  { prefixe: 'https://documentation.ubuntu.com/', editeur: 'Canonical — documentation Ubuntu' },
  { prefixe: 'https://ubuntu.com/server/docs/', editeur: 'Canonical — Ubuntu Server' },
  // Debian : Ubuntu en dérive, et plusieurs comportements se documentent là.
  { prefixe: 'https://www.debian.org/doc/', editeur: 'Projet Debian' },
  { prefixe: 'https://manpages.debian.org/', editeur: 'Projet Debian — manpages' },
  // Les auteurs du shell lui-même.
  { prefixe: 'https://www.gnu.org/software/', editeur: 'Projet GNU' },
  // OpenSSH : l'implémentation de référence, et ses propres manpages.
  { prefixe: 'https://man.openbsd.org/', editeur: 'OpenBSD / OpenSSH' },
  { prefixe: 'https://www.openssh.com/', editeur: 'OpenSSH' },
  // systemd et son écosystème.
  { prefixe: 'https://www.freedesktop.org/software/systemd/', editeur: 'freedesktop — systemd' },
  { prefixe: 'https://systemd.io/', editeur: 'systemd' },
  // Samba : le wiki et la documentation du projet.
  { prefixe: 'https://wiki.samba.org/', editeur: 'Équipe Samba' },
  { prefixe: 'https://www.samba.org/samba/docs/', editeur: 'Équipe Samba' },
  // NFS côté noyau et côté utilitaires.
  { prefixe: 'https://www.kernel.org/doc/', editeur: 'Noyau Linux' },
  { prefixe: 'https://linux-nfs.org/', editeur: 'linux-nfs' },
  // Cockpit.
  { prefixe: 'https://cockpit-project.org/', editeur: 'Projet Cockpit' },
  // Netplan.
  { prefixe: 'https://netplan.readthedocs.io/', editeur: 'Canonical — Netplan' },
  // nftables, le successeur d'iptables.
  { prefixe: 'https://wiki.nftables.org/', editeur: 'Projet netfilter' },
  // Les spécifications POSIX, pour trancher ce qui est portable.
  { prefixe: 'https://pubs.opengroup.org/onlinepubs/', editeur: 'The Open Group — POSIX' },
];

/** `true` si l'URL vient d'une source primaire reconnue. */
export function sourceLinuxValide(url) {
  const u = String(url ?? '');
  return PREFIXES_SOURCES_LINUX.some((p) => u.startsWith(p.prefixe));
}

/** L'éditeur d'une URL reconnue, ou null. */
export function editeurDe(url) {
  const u = String(url ?? '');
  const trouve = PREFIXES_SOURCES_LINUX.find((p) => u.startsWith(p.prefixe));
  return trouve ? trouve.editeur : null;
}
