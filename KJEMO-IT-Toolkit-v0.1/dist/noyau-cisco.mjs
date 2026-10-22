/**
 * noyau-cisco.mjs — RESEAU-CISCO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fabrique des assistants Cisco IOS. Un assistant Cisco ne produit NI un
 * script PowerShell NI un script Bash : il produit une LISTE DE COMMANDES IOS
 * (fichier `.ios.txt`) que la personne colle, étape par étape, dans la console
 * de SON commutateur. Le Toolkit ne se connecte à aucun équipement, n'exécute
 * rien, et ne sait donc pas ce que les commandes ont produit.
 *
 * LES RÈGLES QUE LA FABRIQUE IMPOSE À TOUS LES ASSISTANTS
 *
 *   1. LECTURE SEULE PAR DÉFAUT. Un assistant qui modifie propose un champ
 *      « Mode » dont la valeur par défaut est Lecture. En Lecture, la
 *      configuration n'apparaît que sous forme de COMMENTAIRES (« ! | … ») :
 *      rien de collable ne modifie quoi que ce soit.
 *   2. CIBLE EXPLICITE. Le nom de l'équipement visé est un champ obligatoire,
 *      écrit dans l'en-tête : on ne colle pas sur « le switch qui est devant
 *      soi » sans l'avoir nommé.
 *   3. PHRASE DE CONFIRMATION. Passer en mode Configuration exige de recopier
 *      une phrase exacte qui nomme la cible (« CONFIGURER Fa0/7 »).
 *   4. JAMAIS DE SAUVEGARDE PERSISTANTE EMBARQUÉE. « copy running-config
 *      startup-config » n'est jamais une ligne collable d'un assistant qui
 *      modifie : la sauvegarde a son assistant, qui explique la différence
 *      entre running-config et startup-config.
 *   5. JAMAIS DE SECRET. Aucun champ n'en accepte ; les lignes qui demandent
 *      un mot de passe sont écrites EN COMMENTAIRE avec la mention « À TAPER À
 *      LA MAIN » : le mot de passe se saisit directement sur la console.
 *   6. SORTIE PROPRE POUR UNE CONSOLE : ASCII seul, LF, ni tabulation ni point
 *      d'interrogation (IOS les interprète à la frappe, collage compris).
 *
 * Ce module n'exécute rien et n'importe que noyau.mjs (assertValid).
 */

import { assertValid } from './noyau.mjs';
import {
  texteSur, validerChoixCisco, validerHostnameIos, validerInterfaceIos, MATERIELS_CISCO, secretsDans,
} from './validateurs-cisco.mjs';

export const VERSION_CISCO = 'RESEAU-CISCO-01 — Réseau et Cisco — 1.0.0';
export const CATEGORIE_CISCO = 'Réseau et Cisco';
export const MATERIEL_REFERENCE = 'Cisco C1000-24T-4G-L (Catalyst 1000, référence documentaire — NON testé sur matériel)';

export const OS_CISCO = [
  'Cisco IOS 15.x et IOS XE — commutateurs Catalyst 2960 / 2960-X / 1000 / 9200 (commandes issues de la documentation Cisco ; aucun matériel n’a été essayé)',
  'Cisco Packet Tracer — Catalyst 2960 (simulation : certaines commandes sont absentes ou se comportent autrement)',
];

/** Ce que chaque fiche dit de son niveau de preuve. Valable pour tous les assistants. */
export const VALIDATION_CISCO = [
  'Génération des commandes : testée localement (champs, refus, ASCII, aucun point d’interrogation, aucune tabulation, LF).',
  'Commandes rapprochées de la documentation publique de Cisco : ce n’est pas un essai sur un équipement.',
  'Packet Tracer : NON EXÉCUTÉ.',
  `Commutateur réel (${MATERIEL_REFERENCE}) : NON EXÉCUTÉ.`,
  'Aucune compatibilité universelle n’est revendiquée : la syntaxe varie selon le modèle, la version d’IOS et le simulateur.',
];

// ---------------------------------------------------------------------------
// Texte de sortie
// ---------------------------------------------------------------------------

/** Ramène un texte français à l'ASCII que la console acceptera, sans « ? ». */
export function ascii(s) {
  return String(s ?? '')
    .replace(/[‘’´]/g, "'")
    .replace(/«\s*/g, '"').replace(/\s*»/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    .replace(/×/g, 'x')
    .replace(/→/g, '->')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'Oe')
    .replace(/ | /g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^ -~\n]/g, '')
    .replace(/\?/g, ' ');
}

/**
 * Une note devient UNE OU PLUSIEURS lignes de commentaire, chacune préfixée par
 * « ! ». Un saut de ligne dans le texte d'une note ne doit JAMAIS pouvoir
 * fabriquer une ligne active : sans ce découpage, une valeur lue dans une sortie
 * collée (ou un futur champ) pourrait glisser une commande après un « \n ».
 */
export function commentaire(texte) {
  return ascii(texte).split('\n').map((l) => (l === '' ? '!' : `! ${l}`));
}

/**
 * Normalise un fichier de commandes IOS : LF seul, pas de BOM, pas de
 * tabulation, pas d'espace en fin de ligne, au plus une ligne vide d'affilée,
 * un seul saut de ligne final.
 */
export function normalizeIos(texte) {
  const t = String(texte ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '');
  return `${t}\n`;
}

// Un « item » est : une chaîne (commande IOS), {c: commande, n: note affichée
// avant}, {n: commentaire seul}, ou {m: ligne À TAPER À LA MAIN}. Une ligne
// « m » n'est JAMAIS collable : elle est écrite en commentaire, parce qu'elle
// demande un secret (mot de passe, clé) ou une réponse interactive de la console.
function lignesDe(items, commente) {
  const out = [];
  for (const it of items) {
    if (typeof it === 'string') { out.push(it); continue; }
    if (it.n && commente) out.push(...commentaire(it.n));
    if (it.c !== undefined) out.push(it.c);
    if (it.m !== undefined && commente) out.push(...commentaire(`A TAPER A LA MAIN : ${it.m}`));
  }
  return out;
}

function propositionDe(items) {
  const out = [];
  for (const it of items) {
    if (typeof it === 'string') out.push(`!   | ${it}`);
    else {
      if (it.n) out.push(...commentaire(it.n));
      if (it.c !== undefined) out.push(`!   | ${it.c}`);
      if (it.m !== undefined) out.push(...commentaire(`A TAPER A LA MAIN : ${it.m}`));
    }
  }
  return out;
}

const SECTION = (n, titre) => `! --- ETAPE ${n} : ${ascii(titre)} ---`;

// ---------------------------------------------------------------------------
// Champs communs
// ---------------------------------------------------------------------------
export const PRESENTATIONS = ['Commente', 'Commandes seules'];
const MODES = ['Lecture', 'Configuration'];

function champCible() {
  return {
    id: 'ciscoCible', label: 'Nom de l’équipement visé (hostname)', type: 'text', default: 'SW-LAB-01',
    help: 'Le nom que tu vois dans l’invite (SW-LAB-01# ou SW-LAB-01>). Il figure en tête du fichier : tu sais sur quel équipement tu colles. Le Toolkit ne s’y connecte pas.',
  };
}
function champMateriel() {
  return {
    id: 'ciscoMateriel', label: 'Numérotation des ports du matériel', type: 'select', default: '2960',
    options: [
      ['2960', 'Commutateur autonome — Fa0/7, Gi0/1 (Catalyst 2960, Packet Tracer)'],
      ['pile', 'Numérotation module/slot/port — Gi1/0/7 (Catalyst 1000, 9200…)'],
    ],
    help: 'Fa0/x et Gi1/0/x ne sont pas interchangeables. Référence documentaire : C1000-24T-4G-L (Gi1/0/1 à Gi1/0/24, uplinks Gi1/0/25 à 28) — non testé.',
  };
}
function champMode(aide) {
  return {
    id: 'ciscoMode', label: 'Mode', type: 'select', default: 'Lecture',
    options: [['Lecture', 'Lecture — commandes show seulement, la configuration reste en commentaire'], ['Configuration', 'Configuration — commandes qui modifient la running-config']],
    help: aide ?? 'Lecture par défaut. Configuration exige la phrase de confirmation ci-dessous.',
  };
}
function champConfirmation(aide) {
  return {
    id: 'ciscoConfirmation', label: 'Phrase de confirmation (mode Configuration)', type: 'text', default: '',
    help: aide ?? 'Laisse vide en mode Lecture. En mode Configuration, recopie exactement la phrase indiquée.',
  };
}
function champPresentation() {
  return {
    id: 'ciscoPresentation', label: 'Format de sortie : commenté ou commandes seules', type: 'select', default: 'Commente',
    options: [['Commente', 'Commenté — explications en lignes « ! » (ignorées par IOS)'], ['Commandes seules', 'Commandes seules — sans aucune ligne de commentaire']],
    help: 'Si ta console refuse les lignes « ! » en mode utilisateur, choisis « Commandes seules ».',
  };
}

// ---------------------------------------------------------------------------
// La fabrique
// ---------------------------------------------------------------------------
function exiger(def, liste) {
  for (const c of liste) {
    if (def[c] === undefined || def[c] === null) throw new Error(`outilCisco(${def.id ?? '?'}) : champ « ${c} » manquant.`);
  }
}

export const CHAMPS_CISCO_BLOC = ['probleme', 'utilite', 'exemple', 'lecture', 'effets', 'attendu', 'limites'];

/**
 * def :
 *   id, famille, title, summary, keywords, source, sources, gui, checks, verifyAfter, rollback, prereqs, commonErrors
 *   interface: true      → champs « matériel » (+ champs propres déclarés dans `champs`)
 *   champs: []           → champs propres à l'assistant
 *   modifie: true        → ajoute Mode + Confirmation
 *   parse(v, ctx)        → { errors, val } validation propre + valeurs normalisées
 *   phrase(val)          → phrase de confirmation attendue (si modifie)
 *   lecture(val)         → items lus AVANT modification (ou seule sortie d'un outil en lecture)
 *   config(val)          → items qui modifient (si modifie)
 *   verification(val)    → items lus APRÈS
 *   retour(val)          → items de retour arrière (commentés dans le fichier)
 *   cisco                → bloc pédagogique affiché sur la fiche
 */
export function outilCisco(def) {
  exiger(def, ['id', 'famille', 'title', 'summary', 'keywords', 'source', 'sources', 'gui', 'checks',
    'verifyAfter', 'rollback', 'prereqs', 'commonErrors', 'lecture', 'cisco']);
  for (const c of CHAMPS_CISCO_BLOC) {
    if (def.cisco[c] === undefined) throw new Error(`outilCisco(${def.id}) : cisco.${c} manquant.`);
  }
  const modifie = def.modifie === true;
  if (modifie) exiger(def, ['config', 'phrase', 'retour', 'verification']);
  const risque = def.risk ?? (modifie ? 'caution' : 'diagnostic');

  const fields = [champCible()];
  if (def.interface) fields.push(champMateriel());
  fields.push(...(def.champs ?? []));
  if (modifie) fields.push(champMode(def.aideMode), champConfirmation(def.aideConfirmation));
  fields.push(champPresentation());

  function analyser(v) {
    const errors = {};
    const val = {};
    const c = validerHostnameIos(v.ciscoCible);
    if (!c.ok) errors.ciscoCible = c.error; else val.cible = c.valeur;
    if (def.interface) {
      const m = validerChoixCisco(v.ciscoMateriel, MATERIELS_CISCO, 'La numérotation des ports');
      if (!m.ok) errors.ciscoMateriel = m.error; else val.materiel = m.valeur;
    }
    const p = validerChoixCisco(v.ciscoPresentation, PRESENTATIONS, 'Le format de sortie');
    if (!p.ok) errors.ciscoPresentation = p.error; else val.presentation = p.valeur;
    if (modifie) {
      const m = validerChoixCisco(v.ciscoMode, MODES, 'Le mode');
      if (!m.ok) errors.ciscoMode = m.error; else val.mode = m.valeur;
    }
    if (def.parse) {
      const r = def.parse(v, val);
      Object.assign(errors, r.errors ?? {});
      Object.assign(val, r.val ?? {});
    }
    if (modifie) {
      const conf = String(v.ciscoConfirmation ?? '');
      if (/[\u0000-\u001f\u007f]/.test(conf) || secretsDans(conf).length) {
        errors.ciscoConfirmation = 'La confirmation contient un caractère interdit ou ressemble à un secret.';
      } else if (Object.keys(errors).length === 0) {
        const attendue = def.phrase(val);
        if (val.mode === 'Configuration' && conf !== attendue) {
          errors.ciscoConfirmation = `Mode Configuration : recopie exactement la phrase « ${attendue} » (majuscules comprises).`;
        } else if (val.mode === 'Lecture' && conf !== '' && conf !== attendue) {
          errors.ciscoConfirmation = 'La confirmation ne correspond pas à la cible : laisse le champ vide en mode Lecture.';
        }
      } else if (val.mode === 'Configuration' && conf === '') {
        errors.ciscoConfirmation = 'Mode Configuration : la phrase de confirmation est obligatoire (corrige d’abord les autres champs pour la connaître).';
      }
    }
    // Filet commun : aucun champ libre n'accepte un secret, même ignoré.
    for (const f of fields) {
      if (f.type === 'select' || f.type === 'number' || errors[f.id]) continue;
      if (f.type === 'textarea') continue;
      const t = String(v[f.id] ?? '');
      if (secretsDans(t).length) errors[f.id] = 'Ce champ semble contenir un secret : le Toolkit n’en accepte aucun. Tape les mots de passe directement sur la console.';
      else if (/[\u0000-\u001f\u007f]/.test(t)) errors[f.id] = 'Aucun saut de ligne ni caractère de contrôle dans ce champ (ce serait une seconde commande IOS).';
      else if (/[^ -~]/.test(t)) errors[f.id] = 'Caractères ASCII seulement dans ce champ (une console Cisco corrompt les accents).';
      else if (t.includes('?')) errors[f.id] = 'Le point d’interrogation est interdit : la console l’interprète comme une demande d’aide, même lors d’un collage.';
    }
    return { errors, val };
  }

  const outil = {
    id: def.id,
    icon: '⇄',
    category: CATEGORIE_CISCO,
    subcategory: def.famille,
    title: def.title,
    risk: risque,
    summary: def.summary,
    fields,
    validate(v) { return analyser(v).errors; },
    generate(v) {
      assertValid(this, v);
      const { val } = analyser(v);
      const commente = val.presentation === 'Commente';
      const config = modifie && val.mode === 'Configuration';
      const out = [];
      if (commente) {
        out.push(
          '! ============================================================',
          `! KJEMO IT Toolkit - ${ascii(def.title)}`,
          `! Outil ${def.id} - ${ascii(VERSION_CISCO)}`,
          `! Equipement vise : ${val.cible}`,
          config
            ? '! Mode : CONFIGURATION - ces commandes MODIFIENT la running-config'
            : (modifie ? '! Mode : LECTURE - la configuration est donnee en commentaire, rien ne modifie l equipement'
              : '! Mode : LECTURE SEULE - aucune commande de ce fichier ne modifie l equipement'),
          '! ============================================================',
          '! CE FICHIER CONTIENT DES COMMANDES CISCO IOS. Ce n est ni un script',
          '! PowerShell ni un script Bash : ne le lance pas dans Windows ni dans Linux.',
          '! Ouvre la console du commutateur (ou le CLI de Packet Tracer) et colle',
          '! les etapes UNE PAR UNE, en lisant le resultat de chacune.',
          '! Le Toolkit ne se connecte a aucun equipement et n a execute aucune de ces commandes.',
          '! Les lignes qui commencent par ! sont des commentaires IOS, ignores par le commutateur.',
          '! Aucun mot de passe ici : ce que tu dois taper toi-meme est marque A TAPER A LA MAIN.',
          '',
        );
      }
      // ETAPE 1 — lecture. En présentation compacte + configuration, la lecture
      // est omise : on suppose qu'elle a déjà été faite (voir l'en-tête de fiche).
      const lecture = def.lecture(val);
      if (!config || commente) {
        if (commente) out.push(SECTION(1, 'LECTURE (aucun changement)'), '! Invite attendue : mode privilegie (nom-de-l-equipement#)');
        out.push(...lignesDe(lecture, commente));
        if (commente) out.push('');
      }
      if (modifie) {
        const lignesConfig = def.config(val);
        if (config) {
          if (commente) out.push(SECTION(2, def.titreAction ?? 'CONFIGURATION (modifie la running-config)'), '! Ne colle ceci qu apres avoir lu le resultat de l etape 1.');
          out.push(...lignesDe(lignesConfig, commente));
          if (commente) out.push('');
        } else if (commente) {
          out.push(SECTION(2, `${def.titreProposition ?? 'CONFIGURATION PROPOSEE'} (non appliquee : mode Lecture)`),
            '! Pour la rendre collable : mode Configuration + phrase de confirmation.',
            ...propositionDe(lignesConfig), '');
        }
      }
      const verification = modifie ? def.verification(val) : (def.verification ? def.verification(val) : []);
      if (verification.length && (modifie || commente)) {
        if (commente) out.push(SECTION(3, modifie ? 'VERIFICATION (apres modification)' : 'VERIFICATIONS COMPLEMENTAIRES'));
        out.push(...lignesDe(verification, commente));
        if (commente) out.push('');
      }
      if (commente && modifie && !def.sauvegarde) {
        out.push(
          SECTION(4, 'SAUVEGARDE PERSISTANTE (jamais automatique)'),
          '! Ce qui precede modifie la running-config (memoire vive) : un redemarrage l annule.',
          '! Pour la rendre durable, utilise l assistant cisco-config-sauvegarde, qui explique',
          '! la difference entre running-config et startup-config. Rien n est sauvegarde ici.',
          '',
        );
      }
      if (commente && modifie) {
        out.push(SECTION(def.sauvegarde ? 4 : 5, 'RETOUR EN ARRIERE (commentaire : a retaper si besoin)'), ...propositionDe(def.retour(val)), '');
      }
      if (commente && def.finFichier) out.push(...def.finFichier(val).flatMap((l) => commentaire(l)));
      return normalizeIos(out.join('\n'));
    },
    gui: def.gui,
    keywords: def.keywords,
    requiresAdmin: false,
    os: OS_CISCO,
    prereqs: def.prereqs,
    commonErrors: def.commonErrors,
    reversible: def.reversible ?? true,
    verifyAfter: def.verifyAfter,
    rollback: def.rollback,
    checks: def.checks,
    source: def.source,
    sources: def.sources,
    platform: 'Cisco',
    output: '.ios.txt',
    readOnly: !modifie,
    cisco: { validation: VALIDATION_CISCO, materiel: MATERIEL_REFERENCE, ...def.cisco },
  };
  if (modifie) outil.confirmation = true;
  return outil;
}

// ---------------------------------------------------------------------------
// Notes d'exécution propres à IOS (remplace la table PowerShell / Bash)
// ---------------------------------------------------------------------------
export const EXECUTION_NOTES_IOS = {
  title: 'Avant de coller les commandes',
  intro:
    'Ce fichier n’est pas un script : c’est une liste de commandes Cisco IOS. Il ne se lance ni '
    + 'dans PowerShell, ni dans Bash. On l’utilise dans la console du commutateur (câble console, SSH, '
    + 'ou l’onglet CLI de Packet Tracer), en collant les étapes une par une.',
  steps: [
    { label: 'Relire le fichier', detail: 'L’aperçu est exactement le contenu du fichier téléchargé. Les lignes « ! » sont des commentaires : IOS les ignore.' },
    { label: 'Vérifier l’équipement', detail: 'L’invite doit afficher le nom de l’équipement visé (celui de l’en-tête). Si ce n’est pas le cas, arrête-toi.' },
    { label: 'Passer en mode privilégié', detail: 'Les lectures se font en mode privilégié (invite se terminant par #). Le mot de passe enable se tape ici, à la main — il ne figure jamais dans le fichier.', command: 'enable' },
    { label: 'Éviter la pagination (facultatif)', detail: 'Évite l’affichage « --More-- » pendant la session en cours seulement ; rien n’est écrit dans la configuration.', command: 'terminal length 0' },
    { label: 'Coller par étapes', detail: 'Colle l’étape de lecture, lis le résultat, puis seulement l’étape suivante. Les modifications touchent la running-config (mémoire vive) : elles disparaissent au redémarrage tant qu’elles ne sont pas sauvegardées — voir l’assistant de sauvegarde.' },
  ],
  obstacles: [
    { name: 'Commande refusée', message: '% Invalid input detected at \'^\' marker.', fix: 'Le « ^ » montre l’endroit fautif. Souvent : mauvais mode (tu es en mode utilisateur >, ou hors de la configuration), commande absente de ce modèle ou de ce simulateur, faute de frappe.' },
    { name: 'Commande incomplète', message: '% Incomplete command.', fix: 'Il manque un paramètre. Tape la commande suivie de la touche point d’interrogation pour voir ce qui est attendu.' },
    { name: 'Commande ambiguë', message: '% Ambiguous command: "…"', fix: 'L’abréviation correspond à plusieurs commandes : écris-la plus longuement.' },
    { name: 'Mauvais mode', message: 'L’invite n’est pas celle attendue (>, #, (config)#, (config-if)#)', fix: 'Reviens au mode privilégié avec « end », puis relis l’invite avant de coller.' },
    { name: 'Faute de frappe qui « gèle » la console', message: 'Translating "xxxx"… domain server (255.255.255.255)', fix: 'IOS prend le mot pour un nom d’hôte à résoudre. Attends, ou interromps avec Ctrl+Maj+6 puis x.' },
  ],
  warning:
    'Une modification de configuration peut couper ta propre connexion (VLAN de gestion, trunk, SSH). '
    + 'Pour un équipement distant, garde un accès console ou un autre chemin avant de coller. '
    + 'Le Toolkit n’a exécuté aucune de ces commandes : leur effet sur TON équipement n’est pas vérifié.',
  sources: [
    { label: 'Cisco — utiliser la ligne de commande IOS', url: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960/swcli.html' },
  ],
  errors: [
    { message: 'Windows ou Linux répond « command not found » à chaque ligne', cause: 'Les commandes ont été collées dans la mauvaise console.', fix: 'Ce fichier est fait pour la console du commutateur, pas pour PowerShell ni Bash.' },
  ],
};
