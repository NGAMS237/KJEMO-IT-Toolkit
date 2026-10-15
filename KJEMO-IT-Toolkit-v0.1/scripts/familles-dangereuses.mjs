/**
 * familles-dangereuses.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les familles de commandes qu'un script genere par ce depot ne doit pas
 * contenir sans raison ecrite, et la fonction qui isole le code REELLEMENT
 * execute.
 *
 * Deux consommateurs, une seule definition :
 *   - scripts/matrices-lot7.mjs, qui DECRIT ce qu'il trouve ;
 *   - test/scanner-bash.test.mjs, qui REFUSE ce qui n'est pas justifie.
 *
 * Les garder separes aurait produit, tot ou tard, une matrice qui surveille
 * une famille que le scanner ignore — ou l'inverse, plus grave encore.
 *
 * ---------------------------------------------------------------------------
 * CE QU'UN MOTIF PEUT ET NE PEUT PAS
 * ---------------------------------------------------------------------------
 * Une expression reguliere ne comprend pas le shell. Elle ne sait pas si
 * `rm -rf -- "${X}"` vise un dossier temporaire ou la racine. C'est voulu :
 * le motif SIGNALE, un humain JUSTIFIE, et la justification est versionnee a
 * cote du code. Un scanner qui pretendrait decider seul serait soit muet sur
 * les cas reels, soit bruyant au point qu'on l'eteindrait.
 *
 * Le motif est donc deliberement LARGE. Le cout d'un faux positif est une
 * ligne d'exception ecrite une fois ; le cout d'un faux negatif est un script
 * destructeur publie.
 */

/**
 * Chaque famille : un nom, un motif, et POURQUOI elle est surveillee.
 *
 * Le « pourquoi » n'est pas decoratif : c'est lui qui permet, dans trois ans,
 * de decider si une exception demandee est raisonnable. Une liste de motifs
 * sans raisons devient une liste qu'on allonge.
 */
export const FAMILLES = [
  { nom: 'rm -rf', motif: /\brm\s+-[a-z]*r[a-z]*f\b|\brm\s+-[a-z]*f[a-z]*r\b/,
    pourquoi: 'Recursif et sans confirmation : la faute de frappe ne previent pas.' },
  { nom: 'rm', motif: /\brm\s/,
    pourquoi: 'Toute suppression merite d\'etre vue, meme d\'un seul fichier.' },
  { nom: 'rmdir', motif: /\brmdir\b/,
    pourquoi: 'Suppression de dossier.' },
  { nom: 'dd vers un peripherique', motif: /\bdd\b[^\n]*of=\/dev\//,
    pourquoi: 'Ecrit directement sur le disque, sous le systeme de fichiers. Rien ne protege.' },
  { nom: 'mkfs', motif: /\bmkfs(\.|\s)/,
    pourquoi: 'Formate : les donnees presentes deviennent irrecuperables en pratique.' },
  { nom: 'wipefs', motif: /\bwipefs\b/,
    pourquoi: 'Efface les signatures de systeme de fichiers : le disque parait vide.' },
  { nom: 'fdisk / parted / sfdisk en ecriture', motif: /\b(fdisk|parted|sfdisk)\b/,
    pourquoi: 'Modifie la table de partitions. Meme `fdisk -l` est signale : le motif ne distingue pas, et c\'est l\'exception qui doit dire laquelle.' },
  { nom: 'mdadm destructif', motif: /\bmdadm\b[^\n]*(--create|--fail|--remove|--zero-superblock|--stop)/,
    pourquoi: 'Cree, casse ou demonte un ensemble RAID. `--zero-superblock` rend un membre meconnaissable.' },
  { nom: 'ecriture dans /etc/fstab', motif: /(>|>>|\btee\b)[^\n]*\/etc\/fstab/,
    pourquoi: 'Une ligne fautive dans fstab peut laisser la machine en mode de secours au prochain demarrage.' },
  { nom: 'quotaoff', motif: /\bquotaoff\b/,
    pourquoi: 'Desactive la comptabilite des quotas : les depassements cessent d\'etre comptes, en silence.' },
  // Les trois motifs ci-dessous ne voyaient que la forme COURTE. Un
  // « chown --recursive » est exactement aussi recursif qu un « chown -R »,
  // et il passait sans etre signale : angle mort trouve au commit 16/n, quand
  // les premiers assistants de permissions ont employe les formes longues.
  // Corrige au MOTIF, pas par exception.
  { nom: 'chmod -R', motif: /\bchmod\b[^\n]*(\s-[a-zA-Z]*R\b|\s--recursive\b)/,
    pourquoi: 'Recursif : efface en masse des droits qui n\'etaient pas tous identiques.' },
  { nom: 'chown -R', motif: /\bchown\b[^\n]*(\s-[a-zA-Z]*R\b|\s--recursive\b)/,
    pourquoi: 'Recursif : change la propriete de fichiers systeme si la cible est mal choisie.' },
  { nom: 'setfacl -R', motif: /\bsetfacl\b[^\n]*(\s-[a-zA-Z]*R\b|\s--recursive\b)/,
    pourquoi: 'Recursif sur une couche de droits que peu de gens relisent.' },
  // Et la forme que NI l un NI l autre ne voyait : find -exec. Parcourir une
  // arborescence avec find puis appliquer chmod a chaque entree est aussi
  // recursif qu un -R, et c est meme la facon PROPRE de le faire quand on veut
  // deux modes distincts pour les dossiers et pour les fichiers. Aussi
  // recursif veut dire aussi dangereux : la famille existe donc, et les
  // emplois legitimes passent par une exception ecrite.
  { nom: 'chmod, chown ou setfacl par find -exec',
    motif: /\bfind\b[^\n]*-exec\s+(chmod|chown|chgrp|setfacl)\b/,
    pourquoi: 'Aussi recursif qu un -R, et invisible pour les motifs qui ne cherchent que -R.' },
  { nom: 'sed -i', motif: /\bsed\s+(-[a-zA-Z]*\s+)*-i\b|\bsed\s+-i\b/,
    pourquoi: 'Modifie un fichier EN PLACE, sans copie, souvent sans sauvegarde.' },
  { nom: 'redirection vers /etc', motif: />\s*\/etc\//,
    pourquoi: 'Ecrase un fichier de configuration systeme. `>>` ajoute, `>` remplace tout.' },
  { nom: 'tee vers /etc', motif: /\btee\b[^\n]*\/etc\//,
    pourquoi: 'Meme effet qu\'une redirection, avec sudo possible au milieu du tube.' },
  { nom: 'iptables -F', motif: /\biptables\b[^\n]*-F\b/,
    pourquoi: 'Vide les regles de pare-feu : la machine devient ouverte sans que rien ne le dise.' },
  { nom: 'nft flush ruleset', motif: /\bnft\b[^\n]*flush\s+ruleset/,
    pourquoi: 'Idem, version nftables.' },
  { nom: 'ufw reset ou disable', motif: /\bufw\s+(reset|disable)\b/,
    pourquoi: 'Desactive le pare-feu. Sur une machine exposee, c\'est immediat.' },
  { nom: 'userdel / groupdel', motif: /\b(userdel|groupdel)\b/,
    pourquoi: 'Supprime un compte, et selon les options son dossier personnel.' },
  { nom: 'suppression de cle SSH', motif: /\brm\b[^\n]*(authorized_keys|id_rsa|id_ed25519)/,
    pourquoi: 'Peut verrouiller definitivement l\'acces a une machine distante.' },
  // Le motif exige que le fichier systeme soit la CIBLE de la redirection.
  // Premiere version : /(>|tee)[^\n]*\/etc\/(passwd|shadow|sudoers)/, qui
  // signalait `cat /etc/passwd > "${TMP}"` — une LECTURE redirigee vers un
  // fichier temporaire, c'est-a-dire l'inverse exact du danger surveille.
  // Corrige au motif, et non par une exception : une exception aurait rendu
  // le scanner aveugle a la vraie ecriture dans le meme outil.
  { nom: 'ecriture dans passwd/shadow/sudoers',
    motif: /(>>?\s*|\btee\b\s+(-a\s+)?)\/etc\/(passwd|shadow|sudoers)\b/,
    pourquoi: 'Un sudoers invalide rend `sudo` inutilisable, y compris pour le reparer.' },
  { nom: 'systemctl disable --now', motif: /\bsystemctl\b[^\n]*disable\s+--now/,
    pourquoi: 'Arrete ET empeche le redemarrage : un service peut disparaitre sans qu\'on le remarque.' },
  { nom: 'telechargement puis execution', motif: /\b(curl|wget)\b[^\n]*\|\s*(ba)?sh\b/,
    pourquoi: 'Execute du code qu\'on n\'a pas lu, depuis une source qui peut changer entre deux essais.' },
  { nom: 'eval', motif: /\beval\b/,
    pourquoi: 'Reinterprete une chaine comme du code : annule toute protection par citation.' },
  { nom: 'mot de passe en clair', motif: /(--password|PASSWORD=|passwd\s+--stdin)/i,
    pourquoi: 'Visible dans l\'historique du shell et dans la liste des processus.' },
  { nom: 'cle privee', motif: /(BEGIN [A-Z ]*PRIVATE KEY|id_rsa\b(?!\.pub)|id_ed25519\b(?!\.pub))/,
    pourquoi: 'Une cle privee ne s\'affiche jamais, ne se copie jamais dans un rapport.' },
  // Le motif exigeait une ESPACE avant l'etoile : `rm /srv/donnees/*` lui
  // echappait, c'est-a-dire la forme la plus courante. Trouve par la
  // contre-epreuve par famille du scanner, qui soumet a chaque motif un cas
  // fautif construit pour lui — pas par le corpus, qui n'en contient aucun.
  // Apres codeNu(), le texte cite a disparu : une etoile encore visible dans
  // une commande `rm` est donc un joker que le shell developpera.
  { nom: 'joker non borne', motif: /\brm\b[^\n]*\*/,
    pourquoi: 'Le shell developpe `*` avant que `rm` ne le voie : le resultat depend du dossier courant.' },
  { nom: 'variable non protegee dans une commande destructrice',
    motif: /\brm\b[^\n]*\$\{?[A-Za-z_][A-Za-z0-9_]*\}?(?![\w"])/,
    pourquoi: 'Une variable vide transforme `rm -rf $X/` en `rm -rf /`. Les guillemets ne suffisent pas, mais leur absence suffit a perdre.' },
  { nom: 'reboot ou shutdown', motif: /\b(reboot|shutdown|poweroff|halt)\b/,
    pourquoi: 'Aucun script genere par ce depot ne redemarre une machine : c\'est une decision humaine.' },
  { nom: 'Set-ExecutionPolicy', motif: /Set-ExecutionPolicy/,
    pourquoi: 'Abaisse une protection Windows. N\'a rien a faire dans un script Bash, et le signaler ici attrape un copier-coller entre plateformes.' },
];

/**
 * Retire les commentaires et le CONTENU des chaines : ce qui reste est le code
 * reellement execute.
 *
 * Pourquoi retirer aussi les chaines : un script pedagogique DOIT pouvoir
 * ecrire « ne lance jamais rm -rf sur / » dans un message. Sans cette
 * distinction, le scanner refuserait precisement les scripts les mieux
 * documentes, et on finirait par supprimer l'avertissement plutot que
 * l'exception. La matrice des risques, elle, consigne separement les motifs
 * vus UNIQUEMENT dans un texte : un script peut dire ce qu'il ne fait pas.
 *
 * Les chaines sont remplacees par une espace et non supprimees, pour que
 * `rm` et `-rf` ne se retrouvent pas colles apres le retrait d'une chaine
 * entre les deux.
 */
export function codeNu(src) {
  let out = '';
  // Pile de contextes : 'code', 'dquote', et le code d'une substitution
  // empilee par `$(`. Une seule variable ne suffirait pas : une substitution
  // peut contenir une chaine, qui peut contenir une substitution.
  const pile = ['code'];
  const mode = () => pile[pile.length - 1];
  let i = 0;

  while (i < src.length) {
    const c = src[i];
    const suivant = src[i + 1];

    if (mode() === 'dquote') {
      // L'antislash ECHAPPE entre guillemets doubles, contrairement aux
      // apostrophes simples.
      if (c === '\\') { out += ' '; i += 2; continue; }
      if (c === '"') { pile.pop(); out += ' '; i += 1; continue; }
      // Une substitution de commande DANS une chaine est du code. C'est tout
      // l'interet de ne pas effacer aveuglement les guillemets doubles.
      if (c === '$' && suivant === '(') { pile.push('code'); out += ' $('; i += 2; continue; }
      out += ' ';
      i += 1;
      continue;
    }

    // mode 'code'
    if (c === '#' && (i === 0 || /[\s;|&(]/.test(src[i - 1]))) {
      const fin = src.indexOf('\n', i);
      out += '\n';
      i = fin === -1 ? src.length : fin + 1;
      continue;
    }
    if (c === "'") {
      // Entre apostrophes simples, RIEN n'est echappe : on cherche la
      // prochaine apostrophe, point. La premiere version sautait deux
      // caracteres apres chaque antislash et passait par-dessus l'apostrophe
      // fermante de 's/\\\\/\\\\\\\\/g'.
      let j = i + 1;
      while (j < src.length && src[j] !== "'") j += 1;
      out += ' ';
      i = j + 1;
      continue;
    }
    if (c === '"') { pile.push('dquote'); out += ' '; i += 1; continue; }
    if (c === ')' && pile.length > 1) { pile.pop(); out += ') '; i += 1; continue; }
    out += c;
    i += 1;
  }
  return out;
}

/** Les lignes de `code` qui declenchent `famille`, avec leur numero. */
export function lignesDeclenchantes(code, famille) {
  const res = [];
  code.split('\n').forEach((ligne, i) => {
    famille.motif.lastIndex = 0;
    if (famille.motif.test(ligne)) res.push({ no: i + 1, texte: ligne.trim() });
  });
  return res;
}
