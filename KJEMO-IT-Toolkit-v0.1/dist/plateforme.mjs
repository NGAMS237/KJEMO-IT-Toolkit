/**
 * plateforme.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le catalogue devient multiplateforme. Ce module dit COMMENT un outil
 * déclare sa plateforme et son type de sortie, et fournit les accesseurs que
 * l'interface et les bancs utilisent au lieu de deviner.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI DES VALEURS PAR DÉFAUT PLUTÔT QU'UNE MIGRATION
 * ---------------------------------------------------------------------------
 * Les 107 outils existants ne déclarent pas de plateforme : ils ont été écrits
 * quand le catalogue n'en avait qu'une. Deux chemins s'offraient :
 *
 *   1. ajouter `platform: 'Windows'` et `output: '.ps1'` aux 107 outils ;
 *   2. faire de Windows/.ps1 la valeur par défaut, et n'exiger la déclaration
 *      que des nouveaux.
 *
 * Le premier chemin touche six modules de catalogue et 856 scripts générés,
 * pour un résultat qui doit être identique octet pour octet. C'est beaucoup de
 * diff pour zéro changement de comportement, et chaque ligne touchée est une
 * occasion de casser la garde d'identité.
 *
 * Le second chemin ne touche aucun outil existant. Le défaut n'est pas une
 * approximation : au moment où ce module est écrit, les 107 outils produisent
 * effectivement du PowerShell pour Windows, et `identity.test.mjs` le vérifie
 * désormais explicitement, outil par outil. Si un jour un outil Windows
 * historique devait produire autre chose, il le déclarerait — et c'est le
 * propre d'un défaut bien choisi que la déclaration ne soit nécessaire que
 * lorsqu'on s'en écarte.
 *
 * Ce module n'importe rien : même raison que noyau.mjs, éviter tout cycle.
 */

/** Les plateformes reconnues. `Multi` existe pour les outils à venir. */
export const PLATEFORMES = ['Windows', 'Linux', 'Multi'];

/**
 * Les types de sortie reconnus.
 *
 * `Documentation` n'est pas un pis-aller : certaines procédures ne DOIVENT pas
 * être scriptées — remplacer un sshd_config complet sur un serveur dont on
 * n'a que l'accès SSH, par exemple. Un outil peut alors tout expliquer sans
 * produire de fichier exécutable, et c'est une décision de sécurité, pas un
 * manque.
 */
export const SORTIES = ['.ps1', '.sh', 'Documentation'];

/** Plateforme d'un outil. Défaut : Windows — voir l'en-tête du module. */
export function plateformeDe(outil) {
  return outil && outil.platform ? outil.platform : 'Windows';
}

/** Type de sortie d'un outil. Défaut : `.ps1`. */
export function sortieDe(outil) {
  return outil && outil.output ? outil.output : '.ps1';
}

/** `true` si l'outil produit du Bash. */
export function estBash(outil) {
  return sortieDe(outil) === '.sh';
}

/** `true` si l'outil ne produit aucun fichier exécutable. */
export function estDocumentationSeule(outil) {
  return sortieDe(outil) === 'Documentation';
}

/**
 * `true` si l'outil est en lecture seule.
 *
 * On ne le déduit PAS du niveau de risque. `risk: 'diagnostic'` dit « cet
 * outil ne casse rien » ; `readOnly: true` dit « cet outil n'écrit rien du
 * tout ». Les deux se recoupent souvent mais pas toujours : un outil peut
 * écrire un fichier de rapport dans le dossier personnel sans mériter
 * davantage que « diagnostic ». Confondre les deux ferait annoncer « lecture
 * seule » à un outil qui écrit, ce qui est exactement le genre de promesse
 * qu'on ne doit pas tenir à moitié. La déclaration est donc explicite, et le
 * défaut est le plus prudent des deux.
 */
export function estLectureSeule(outil) {
  return outil ? outil.readOnly === true : false;
}

/** Extension de fichier téléchargé, ou null si l'outil ne produit rien. */
export function extensionDe(outil) {
  const s = sortieDe(outil);
  return s === 'Documentation' ? null : s;
}

/** Nom du fichier proposé au téléchargement. */
export function nomFichierDe(outil) {
  const ext = extensionDe(outil);
  return ext ? `${outil.id}${ext}` : null;
}

/**
 * Étiquette affichée au-dessus de l'aperçu, et sur le bouton.
 *
 * L'étiquette est explicite parce que le contenu de l'aperçu ne suffit pas :
 * à six lignes près, un script Bash et un script PowerShell se ressemblent
 * assez pour qu'on lance le mauvais dans la mauvaise console, et c'est
 * l'utilisateur qui récolte le message d'erreur incompréhensible.
 */
export function etiquetteSortie(outil) {
  const s = sortieDe(outil);
  if (s === '.sh') return 'Script Bash';
  if (s === '.ps1') return 'Script PowerShell';
  return 'Procédure documentée';
}

/**
 * Commandes d'exécution à proposer, dans l'ordre.
 *
 * Pour Bash, les deux formes sont données parce qu'elles ne sont pas
 * équivalentes : `chmod +x` puis `./script.sh` suppose que le système de
 * fichiers autorise l'exécution, ce qui n'est pas le cas d'un montage en
 * `noexec` — un cas banal sur /tmp et sur certaines clés USB. `bash script.sh`
 * marche alors, parce que c'est bash qui est exécuté, pas le fichier.
 *
 * Aucune de ces commandes ne propose de contourner une protection. Quand root
 * est nécessaire, `sudo` est préfixé et la fiche explique pourquoi — jamais
 * « désactive SELinux » ni « passe en root pour aller plus vite ».
 */
export function commandesExecution(outil) {
  const s = sortieDe(outil);
  if (s === 'Documentation') return [];
  const nom = nomFichierDe(outil);
  if (s === '.sh') {
    const sudo = estLectureSeule(outil) ? '' : 'sudo ';
    return [
      { label: 'Rendre exécutable, puis lancer', command: `chmod +x ${nom}\n${sudo}./${nom}` },
      {
        label: 'Sans changer les permissions',
        command: `${sudo}bash ${nom}`,
        detail: 'Utile si le dossier est monté en noexec : c’est bash qui est '
          + 'exécuté, pas le fichier.',
      },
    ];
  }
  return [
    { label: 'Débloquer puis lancer', command: `Unblock-File -Path '.\\${nom}'\n.\\${nom}` },
  ];
}

/**
 * Le contrat de déclaration d'un outil Linux : les champs que `plateforme.mjs`
 * exige en plus des 22 champs du contrat de fiche commun.
 *
 * Ces champs ne sont pas décoratifs. Chacun répond à une question qu'on se
 * pose devant un serveur qu'on ne connaît pas, et à laquelle il est trop tard
 * pour répondre une fois le script lancé.
 */
export const CHAMPS_LINUX = [
  'platform',    // Windows | Linux | Multi
  'output',      // .ps1 | .sh | Documentation
  'os',          // systèmes compatibles, en clair
  'distros',     // distributions réellement visées
  'packages',    // paquets nécessaires, noms Debian/Ubuntu
  'privileges',  // 'aucun' | 'root' | 'root pour la partie modifiante'
  'readOnly',    // true si le script n'écrit rien
  'service',     // service systemd concerné, ou null
  'limites',     // ce que l'outil ne fait pas, et ne prétend pas faire
];

/**
 * Vérifie la cohérence des déclarations d'un outil. Retourne la liste des
 * incohérences, vide si tout va bien.
 *
 * Volontairement une liste et non une exception : le banc veut TOUS les
 * défauts d'un coup, outil par outil, et non le premier.
 */
export function incoherencesPlateforme(outil) {
  const pb = [];
  const p = plateformeDe(outil);
  const s = sortieDe(outil);
  if (!PLATEFORMES.includes(p)) pb.push(`plateforme inconnue : ${p}`);
  if (!SORTIES.includes(s)) pb.push(`type de sortie inconnu : ${s}`);
  if (p === 'Windows' && s === '.sh') pb.push('plateforme Windows mais sortie .sh');
  if (p === 'Linux' && s === '.ps1') pb.push('plateforme Linux mais sortie .ps1');
  if (s === 'Documentation' && typeof outil.generate === 'function') {
    pb.push('sortie Documentation mais generate() existe : l’un des deux est faux');
  }
  if (s !== 'Documentation' && typeof outil.generate !== 'function') {
    pb.push(`sortie ${s} mais aucun generate()`);
  }
  // Un outil déclaré en lecture seule qui exige root est presque toujours une
  // erreur de déclaration : lire ne demande pas root, et habituer quelqu'un à
  // taper sudo pour un diagnostic est une mauvaise habitude qu'on lui laisse.
  if (outil.readOnly === true && outil.privileges === 'root') {
    pb.push('lecture seule mais privileges root exigés : lire ne demande pas root');
  }
  return pb;
}
