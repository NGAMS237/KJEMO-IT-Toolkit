/**
 * commandes-rapides.mjs — LOT 7 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * LE DEUXIEME VISAGE D'UNE NOTION
 *
 * Un assistant guide est juste quand l'operation a plusieurs etapes, une
 * sauvegarde, une validation et une porte de confirmation. Il est lourd quand
 * la personne sait deja ce qu'elle veut et cherche la ligne a taper. Les deux
 * besoins sont reels, et le meme sujet doit pouvoir repondre aux deux.
 *
 * Une commande rapide n'est donc PAS un assistant au rabais : c'est l'autre
 * face de la meme notion, avec ses propres obligations.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI UN MODULE, ET NON UN CHAMP DANS CHAQUE FICHE
 * ---------------------------------------------------------------------------
 * Les commandes rapides doivent etre ENUMERABLES : la livraison exige une
 * matrice des commandes rapides, et un champ disperse dans quarante-six fiches
 * ne s'enumere pas proprement. Un module index par notion se compte, se trie,
 * et se verifie d'un bloc.
 *
 * ---------------------------------------------------------------------------
 * LA REGLE QUI COMMANDE TOUTES LES AUTRES : AUCUN COMMENTAIRE DANS LE BLOC
 * ---------------------------------------------------------------------------
 * Le champ `commande` est ce que la personne COPIE. Il ne contient aucun
 * commentaire, et ce n'est pas une preference de presentation.
 *
 * Un « # » colle dans un terminal fait des degats discrets : colle dans une
 * invite qui attend deja une suite, il n'est plus un commentaire ; colle dans
 * un fichier de configuration, il commente la ligne SUIVANTE une fois le
 * retour a la ligne perdu ; et surtout, une commande copiee depuis une page
 * web arrive souvent sur UNE SEULE LIGNE, ou tout ce qui suit le « # » est
 * avale. L'explication a toute sa place — a cote du bloc, jamais dedans.
 *
 * `incoherencesCommandeRapide()` le refuse, et le banc le contre-eprouve.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CE MODULE NE FAIT PAS
 * ---------------------------------------------------------------------------
 * Il n'execute rien, il ne valide pas une saisie utilisateur, et il ne
 * remplace aucun verrou. Une commande rapide classee « destructif » reste une
 * commande que la personne lance elle-meme, en connaissance de cause, apres
 * avoir lu son retour en arriere — ou l'absence de retour en arriere, qui est
 * alors ecrite noir sur blanc.
 *
 * Ce module n'importe rien : meme raison que noyau.mjs et plateforme.mjs,
 * eviter tout cycle.
 */

/**
 * Niveaux de risque d'une commande rapide.
 *
 * Volontairement DISTINCTS des quatre niveaux des fiches
 * (`diagnostic | safe | caution | destructive`). Une fiche decrit un outil
 * complet avec ses gardes ; une commande rapide decrit une ligne nue, sans
 * garde. Reutiliser le meme vocabulaire laisserait croire que « caution » veut
 * dire la meme chose des deux cotes, alors que la commande nue n'a ni
 * sauvegarde, ni validation, ni confirmation.
 */
export const RISQUES_COMMANDE = [
  'lecture',     // ne modifie rien, jamais
  'reversible',  // modifie, et une commande unique defait
  'attention',   // modifie, et le retour en arriere demande un etat connu
  'destructif',  // perte de donnees possible, retour en arriere inexistant
];

/** Les champs obligatoires, dans l'ordre des neuf exigences de la consigne. */
export const CHAMPS_COMMANDE_RAPIDE = [
  'id',
  'notion',         // l'outil ou la famille a laquelle elle se rattache
  'besoin',         // 1. le besoin, en francais naturel
  'commande',       // 2. a copier, SANS commentaire
  'exemple',        // 3. le meme, avec des valeurs realistes
  'parametres',     // 3. les jetons remplacables, nommes
  'options',        // 4. chaque option expliquee
  'resultat',       // 5. ce qu'on doit voir
  'verification',   // 6. la commande qui le confirme
  'risque',         // 7. un des RISQUES_COMMANDE
  'retourArriere',  // 8. la commande inverse, ou null
  'assistant',      // 9. l'assistant guide, ou null
  'source',         // l'editeur primaire qui documente la commande
];

/** Un jeton remplacable s'ecrit <EN_MAJUSCULES>. */
export const MOTIF_JETON = /<[A-Z][A-Z0-9_]*>/g;

/**
 * Les options presentes dans une commande. On ignore ce qui suit un `--`
 * isole : apres lui, `-rf` est un nom de fichier, pas une option.
 */
export function optionsDe(commande) {
  const vues = new Set();
  for (const ligne of String(commande).split('\n')) {
    const avant = ligne.split(' -- ')[0];
    for (const m of avant.matchAll(/(?:^|\s)(--?[A-Za-z][\w-]*)/g)) vues.add(m[1]);
  }
  return [...vues];
}

/**
 * Verifie le contrat d'une commande rapide. Retourne la liste des manquements,
 * vide si tout va bien — une liste et non une exception, pour la meme raison
 * qu'ailleurs dans ce depot : le banc veut TOUS les defauts d'un coup.
 */
/**
 * Les commandes dont certaines options s'ecrivent en MOT derriere un seul
 * tiret. C'est une bizarrerie historique de `find`, et elle est reelle : ses
 * « options » sont des predicats, pas des drapeaux groupables.
 *
 * La table est nominative et close. Ajouter une entree ici est une decision :
 * celui qui en ajoute une doit pouvoir dire pourquoi cette commande n'a pas
 * d'options courtes groupables.
 */
export const OPTIONS_MOT_UN_SEUL_TIRET = {
  // `ip` accepte ses options en mot derriere un seul tiret — « -brief »,
  // « -oneline », « -details » — et les abrege librement : « -br » vaut
  // « -brief ». La regle par lettre y reprochait quatre lettres a « -brief ».
  // Ajoute au commit 18/n, avec les commandes rapides du reseau.
  ip: ['-brief', '-oneline', '-details', '-statistics', '-stats', '-json',
    '-numeric', '-resolve', '-color', '-family', '-human', '-iec',
    '-timestamp', '-all', '-netns', '-batch'],
  find: ['-xdev', '-type', '-perm', '-exec', '-execdir', '-print', '-print0',
    '-printf', '-name', '-iname', '-path', '-regex', '-user', '-group',
    '-mindepth', '-maxdepth', '-size', '-mtime', '-newer', '-empty', '-depth',
    '-prune', '-quit', '-follow', '-links', '-inum', '-nouser', '-nogroup'],
};

/** Les options en mot admises pour la commande ecrite dans ce bloc copiable. */
export function optionsMotUnTiret(commande) {
  const mots = String(commande ?? '').trim().split(/\s+/).filter(Boolean);
  // « sudo » et les affectations qui le precedent ne sont pas la commande.
  const nom = (mots.find((m) => m !== 'sudo' && !m.includes('=')) ?? '').split('/').pop();
  return OPTIONS_MOT_UN_SEUL_TIRET[nom] ?? [];
}

export function incoherencesCommandeRapide(c) {
  const pb = [];
  const txt = (v) => (typeof v === 'string' ? v.trim() : '');

  for (const champ of CHAMPS_COMMANDE_RAPIDE) {
    if (!(champ in c)) pb.push(`champ « ${champ} » absent`);
  }
  if (pb.length) return pb;

  // --- 1. le besoin, en francais naturel ----------------------------------
  if (txt(c.besoin).length < 15) pb.push('besoin trop court pour etre une phrase');
  if (/^[a-z-]+$/.test(txt(c.besoin))) pb.push('besoin ecrit comme un identifiant, pas comme une phrase');

  // --- 2. aucun commentaire dans ce qui est copie -------------------------
  for (const champ of ['commande', 'exemple']) {
    const v = String(c[champ] ?? '');
    for (const ligne of v.split('\n')) {
      if (/^\s*#/.test(ligne)) pb.push(`${champ} : commentaire en debut de ligne — il doit vivre hors du bloc copiable`);
      if (/\s#(?!\{)/.test(ligne) && !/['"][^'"]*#/.test(ligne)) {
        pb.push(`${champ} : commentaire en fin de ligne — il doit vivre hors du bloc copiable`);
      }
    }
    if (v.trim() === '') pb.push(`${champ} vide`);
  }

  // --- 3. les jetons remplacables sont declares, et tous utilises ---------
  const jetonsCommande = [...new Set(String(c.commande).match(MOTIF_JETON) ?? [])];
  const declares = (c.parametres ?? []).map((p) => p.jeton);
  for (const j of jetonsCommande) {
    if (!declares.includes(j)) pb.push(`jeton ${j} present dans la commande mais non declare`);
  }
  for (const d of declares) {
    if (!jetonsCommande.includes(d)) pb.push(`parametre ${d} declare mais absent de la commande`);
  }
  for (const p of c.parametres ?? []) {
    if (!/^<[A-Z][A-Z0-9_]*>$/.test(p.jeton ?? '')) pb.push(`jeton mal forme : ${p.jeton}`);
    if (txt(p.role).length < 5) pb.push(`parametre ${p.jeton} sans role explique`);
    if (txt(p.exemple) === '') pb.push(`parametre ${p.jeton} sans exemple`);
  }

  // --- l'exemple est la meme commande, jetons remplaces -------------------
  if (MOTIF_JETON.test(String(c.exemple))) {
    pb.push('exemple : il reste un jeton <...> — un exemple se copie tel quel');
  }
  MOTIF_JETON.lastIndex = 0;

  // --- 4. CHAQUE option expliquee -----------------------------------------
  const expliquees = (c.options ?? []).map((o) => o.option);
  for (const o of optionsDe(c.commande)) {
    if (!expliquees.includes(o)) pb.push(`option ${o} utilisee mais non expliquee`);
  }
  const motUnTiret = optionsMotUnTiret(c.commande);
  for (const o of c.options ?? []) {
    if (txt(o.explication).length < 10) pb.push(`option ${o.option} : explication trop courte`);
    // Un groupe de courtes options (-hT) doit expliquer CHAQUE lettre : sinon
    // « -hT : affichage lisible » laisse le T sans reponse.
    //
    // Sauf pour les commandes dont les options s'ecrivent en MOT avec un seul
    // tiret — find et ses predicats : « -xdev » est UNE option, et non
    // « -x -d -e -v ». La regle par lettre y produisait quatre reproches
    // absurdes. La liste ci-dessous est nominative et close, exactement comme
    // les exceptions du scanner : elle dit QUELLE commande et QUELLES options,
    // au lieu d'assouplir la regle pour tout le monde.
    if (/^-[A-Za-z]{2,}$/.test(o.option ?? '') && !motUnTiret.includes(o.option)) {
      for (const lettre of o.option.slice(1)) {
        if (!o.explication.includes(`-${lettre}`)) {
          pb.push(`option ${o.option} : la lettre -${lettre} n'est pas expliquee separement`);
        }
      }
    }
  }

  // --- 5, 6. resultat attendu et verification -----------------------------
  if (txt(c.resultat).length < 15) pb.push('resultat attendu trop court');
  if (txt(c.verification).length < 2) pb.push('commande de verification absente');

  // --- 7. risque ----------------------------------------------------------
  if (!RISQUES_COMMANDE.includes(c.risque)) pb.push(`risque inconnu : ${c.risque}`);

  // --- 8. retour en arriere, ou pourquoi il n'y en a pas ------------------
  if (c.risque === 'lecture') {
    if (c.retourArriere !== null) pb.push('risque lecture : le retour en arriere doit etre null, il n\'y a rien a defaire');
  } else if (c.retourArriere === null) {
    if (txt(c.pourquoiPasDeRetour).length < 20) {
      pb.push('aucun retour en arriere et aucune explication : l\'absence se dit, elle ne se tait pas');
    }
  } else if (txt(c.retourArriere).length < 2) {
    pb.push('retour en arriere vide');
  }

  // --- 9. lien vers l'assistant quand l'operation est complexe ------------
  if (c.assistant !== null && txt(c.assistant) === '') pb.push('assistant : chaine vide — mettre null, ou un identifiant');
  if (['attention', 'destructif'].includes(c.risque) && c.assistant === null) {
    pb.push(`risque ${c.risque} sans assistant lie : une operation de ce niveau doit offrir la voie guidee`);
  }

  // --- la source -----------------------------------------------------------
  if (!/^https:\/\//.test(txt(c.source))) pb.push('source absente ou non HTTPS');

  return pb;
}
