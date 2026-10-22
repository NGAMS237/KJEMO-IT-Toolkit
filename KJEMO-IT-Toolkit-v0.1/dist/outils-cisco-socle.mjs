/**
 * outils-cisco-socle.mjs — RESEAU-CISCO-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * LE SOCLE CISCO (partie A) : ce qu'il faut savoir faire sur un commutateur
 * IOS AVANT de parler de VLAN, de trunk ou de VTP.
 *
 *   1. cisco-modes-ios            modes, invites, aide, erreurs de contexte
 *   2. cisco-identification       hostname, bannière, lecture matériel / version
 *   3. cisco-console-ssh          comptes locaux, prérequis SSH, lignes vty
 *   4. cisco-config-sauvegarde    running-config / startup-config, différence, sauvegarde
 *   5. cisco-interface-etat       état, description, activation ciblée d'UNE interface
 *   6. cisco-gestion-ip           adresse de gestion (SVI), passerelle, ping
 *   7. cisco-table-mac            lecture filtrée, effacement ciblé des adresses dynamiques
 *   8. cisco-port-security-etat   état, adresses, violations, diagnostic d'un port bloqué
 *   9. cisco-port-security-config configuration ciblée, remise en service
 *
 * Aucun assistant ne se connecte, n'exécute ou ne lit un équipement : chacun
 * PRODUIT des commandes. Une procédure n'est pas un diagnostic exécuté.
 */

import { outilCisco } from './noyau-cisco.mjs';
import { SRC } from './sources-cisco.mjs';
import {
  texteSur, validerChoixCisco, validerInterfaceIos, validerVlanIos, validerDomaineIos, validerUtilisateurIos,
  validerIpMasqueIos, validerPasserelleIos, validerCibleIpv4, validerMacIos,
} from './validateurs-cisco.mjs';

const F_INTERFACES = 'Interfaces, MAC et port-security';
const F_ACCES = 'Modes, identification et accès';
const F_CONFIG = 'Configuration et sauvegarde';

// Ce que toute fiche Cisco demande avant de coller.
export const PREREQ_COMMUN = [
  'Un accès console (câble console, SSH ou onglet CLI de Packet Tracer) à L’équipement nommé dans le formulaire — le Toolkit ne s’y connecte pas.',
  'Le mode privilégié (invite se terminant par #) : le mot de passe enable se tape à la main sur la console.',
  'Pour tout mode Configuration : un moyen de reprendre la main si la connexion saute (console locale, ou fenêtre de maintenance).',
];
export const ERREUR_MODE = {
  message: '% Invalid input detected at \'^\' marker.',
  cause: 'Commande tapée dans le mauvais mode (par exemple « show » depuis la configuration globale, ou « interface » depuis le mode privilégié), ou commande absente de ce modèle / de ce simulateur.',
  fix: 'Relis l’invite. Reviens au mode privilégié avec « end », puis relance l’étape. Dans la configuration, « do show … » exécute une lecture sans quitter le mode.',
  command: 'end',
};
export const ERREUR_PERTE_ACCES = {
  message: 'La session SSH se fige ou se coupe juste après une modification',
  cause: 'La modification a touché le chemin par lequel tu es connecté (VLAN de gestion, interface d’uplink, lignes vty).',
  fix: 'Reprends la main par la console et annule avec le bloc « retour en arrière ». Pour un équipement distant, prépare l’accès de secours AVANT de coller.',
};
export const RETOUR_STANDARD = (resume, diag, cmd) => ({ summary: resume, diagnostic: diag, command: cmd });

// ---------------------------------------------------------------------------
// 1. Modes et navigation
// ---------------------------------------------------------------------------
const MODES_IOS = {
  utilisateur: { invite: 'SW-LAB-01>', nom: 'mode utilisateur', sortie: ['enable'], ou: 'Lecture très limitée. Pour aller plus loin : « enable » (mot de passe à taper à la main).' },
  privilegie: { invite: 'SW-LAB-01#', nom: 'mode privilégié', sortie: ['configure terminal'], ou: 'Toutes les commandes show. Pour configurer : « configure terminal ».' },
  'config-globale': { invite: 'SW-LAB-01(config)#', nom: 'configuration globale', sortie: ['end'], ou: 'Réglages de l’équipement entier. « exit » remonte d’un niveau, « end » (ou Ctrl+Z) revient au mode privilégié.' },
  'config-interface': { invite: 'SW-LAB-01(config-if)#', nom: 'configuration d’interface', sortie: ['end'], ou: 'Réglages d’UNE interface. « exit » revient à la configuration globale, « end » au mode privilégié.' },
  'config-vlan': { invite: 'SW-LAB-01(config-vlan)#', nom: 'configuration de VLAN', sortie: ['end'], ou: 'Nom et paramètres d’UN VLAN créé par « vlan N ».' },
  'config-ligne': { invite: 'SW-LAB-01(config-line)#', nom: 'configuration de ligne', sortie: ['end'], ou: 'Lignes console / vty. Une erreur ici peut couper l’accès distant.' },
};
const ERREURS_IOS = {
  aucune: null,
  'invalid-input': { motif: '% Invalid input detected at \'^\' marker.', sens: 'Le « ^ » pointe le premier mot que IOS ne comprend pas dans CE mode. Cause la plus fréquente : mauvais mode. Ensuite : faute de frappe, ou commande inexistante sur ce modèle ou ce simulateur.' },
  incomplete: { motif: '% Incomplete command.', sens: 'La commande est valide mais il manque un mot. Retape la commande suivie du point d’interrogation pour voir les suites possibles.' },
  ambiguous: { motif: '% Ambiguous command: "..."', sens: 'L’abréviation convient à plusieurs commandes (par exemple « s » ou « sh » seul). Allonge-la.' },
  'mauvais-mode': { motif: 'L’invite n’est pas celle que le guide annonce', sens: 'Une commande de configuration tapée en mode privilégié, ou une commande show tapée en configuration. Reviens avec « end », vérifie l’invite, puis recommence.' },
  'more': { motif: '--More--', sens: 'Affichage paginé : Espace = page suivante, Entrée = ligne suivante, « q » = quitter l’affichage. « terminal length 0 » supprime la pagination pour la session en cours.' },
};

export const ciscoModes = outilCisco({
  id: 'cisco-modes-ios',
  famille: F_ACCES,
  title: 'Modes IOS, invites, aide et erreurs de contexte',
  summary: 'Reconnaître le mode dans lequel tu es, savoir en sortir, et comprendre les trois messages d’erreur les plus fréquents d’IOS.',
  keywords: ['ios', 'mode', 'invite', 'prompt', 'enable', 'configure terminal', 'aide', 'question', 'invalid input', 'incomplete command', 'ambiguous', 'cisco', 'commutateur', 'switch'],
  champs: [
    { id: 'ciscoModeDepart', label: 'Mode où tu es (selon l’invite)', type: 'select', default: 'utilisateur',
      options: Object.entries(MODES_IOS).map(([k, m]) => [k, `${m.invite} — ${m.nom}`]),
      help: 'Lis l’invite à gauche du curseur : > utilisateur, # privilégié, (config)# configuration globale…' },
    { id: 'ciscoErreurVue', label: 'Message d’erreur rencontré', type: 'select', default: 'aucune',
      options: [['aucune', 'Aucun'], ['invalid-input', '% Invalid input detected'], ['incomplete', '% Incomplete command'], ['ambiguous', '% Ambiguous command'], ['mauvais-mode', 'L’invite n’est pas celle attendue'], ['more', '--More-- (affichage paginé)']] },
  ],
  parse(v) {
    const errors = {}; const val = {};
    const m = validerChoixCisco(v.ciscoModeDepart, Object.keys(MODES_IOS), 'Le mode');
    if (!m.ok) errors.ciscoModeDepart = m.error; else val.modeDepart = m.valeur;
    const e = validerChoixCisco(v.ciscoErreurVue, Object.keys(ERREURS_IOS), 'L’erreur');
    if (!e.ok) errors.ciscoErreurVue = e.error; else val.erreurVue = e.valeur;
    return { errors, val };
  },
  lecture(val) {
    const m = MODES_IOS[val.modeDepart];
    const items = [
      { n: 'Invites a connaitre : nom> utilisateur | nom# privilegie | nom(config)# configuration globale | nom(config-if)# interface | nom(config-vlan)# VLAN | nom(config-line)# ligne.' },
      { n: `Tu es en ${m.nom}. ${m.ou}` },
    ];
    for (const c of m.sortie) items.push({ n: 'Pour avancer ou revenir :', c });
    items.push(
      { n: 'Afficher le niveau de privilege courant (lecture, sans effet) :', c: val.modeDepart === 'utilisateur' ? '! (disponible apres enable)' : 'show privilege' },
      { n: 'Lire l heure de l equipement (lecture) :', c: val.modeDepart === 'utilisateur' ? '! (disponible apres enable)' : 'show clock' },
    );
    const er = ERREURS_IOS[val.erreurVue];
    if (er) items.push({ n: `Erreur rencontree : ${er.motif}` }, { n: er.sens });
    items.push(
      { n: 'AIDE : tape le point d interrogation seul pour lister les commandes du mode ; apres un mot, il liste les suites possibles ; colle a un debut de mot, il liste les commandes qui commencent ainsi.' },
      { n: 'COMPLETION : la touche Tab complete un mot sans ambiguite. Cette fiche ne contient volontairement ni point d interrogation ni tabulation : la console les interprete des qu ils sont colles.' },
    );
    return items.filter((i) => i.c !== '! (disponible apres enable)');
  },
  verification() { return []; },
  prereqs: [...PREREQ_COMMUN.slice(0, 2), 'Aucune modification n’est faite par cet assistant : il sert à lire et à comprendre.'],
  commonErrors: [ERREUR_MODE, { message: 'Translating "sho"… domain server (255.255.255.255)', cause: 'Une commande mal tapée est prise pour un nom d’hôte à résoudre ; la console attend un DNS qui n’existe pas.', fix: 'Attends la fin, ou interromps avec Ctrl+Maj+6 puis x. « no ip domain-lookup » évite cette attente mais modifie la configuration : ce n’est pas fait ici.' }],
  gui: ['Ouvre la console : PuTTY / Tera Term (série ou SSH) ou l’onglet CLI de Packet Tracer.', 'Appuie sur Entrée jusqu’à voir une invite.', 'Repère le dernier caractère : « > » utilisateur, « # » privilégié.', 'Tape « enable » pour passer en privilégié, « configure terminal » pour configurer, « end » pour revenir.'],
  checks: ['L’invite correspond au mode décrit par l’assistant.', 'Après « end », l’invite se termine par « # ».'],
  verifyAfter: ['Tu sais nommer le mode d’après l’invite sans consulter la fiche.', 'Tu sais revenir au mode privilégié depuis n’importe quel sous-mode.'],
  rollback: RETOUR_STANDARD('Rien à annuler : naviguer entre les modes ne modifie pas la configuration.', 'show privilege', 'end'),
  source: SRC.cli.url,
  sources: [SRC.cli, SRC.systeme],
  cisco: {
    probleme: 'IOS refuse des commandes qui semblent correctes, parce qu’il est dans un autre mode que celui qu’on croit.',
    utilite: 'Reconnaître le mode à l’invite supprime la moitié des erreurs « Invalid input » avant même de chercher plus loin.',
    exemple: 'Un technicien tape « show vlan brief » depuis (config)# et obtient une erreur ; « do show vlan brief » ou « end » puis « show vlan brief » règle le problème.',
    lecture: ['Aucune lecture sur l’équipement n’est nécessaire : l’invite suffit.'],
    effets: ['Aucune configuration : les commandes de navigation ne modifient rien.'],
    attendu: ['Invite « nom> » après connexion ; « nom# » après « enable » ; « nom(config)# » après « configure terminal » ; « nom# » de nouveau après « end ».'],
    limites: ['Le texte exact des messages varie légèrement selon la version d’IOS.', 'Packet Tracer n’implémente pas toutes les commandes.'],
  },
});

// ---------------------------------------------------------------------------
// 2. Identification et configuration initiale
// ---------------------------------------------------------------------------
export const ciscoIdentification = outilCisco({
  id: 'cisco-identification',
  famille: F_ACCES,
  title: 'Identifier un commutateur et fixer son nom et sa bannière',
  summary: 'Lire le matériel et la version, puis (en mode Configuration seulement) changer le hostname et poser une bannière d’avertissement.',
  keywords: ['hostname', 'nom', 'banniere', 'banner', 'motd', 'show version', 'inventory', 'configuration initiale', 'cisco', 'switch', 'commutateur'],
  modifie: true,
  champs: [
    { id: 'ciscoNouveauNom', label: 'Nouveau nom (facultatif — laisse vide pour ne pas le changer)', type: 'text', default: '', help: 'Lettre en premier, puis lettres, chiffres, tirets. Le nom de l’invite change dès la validation.' },
    { id: 'ciscoBanniere', label: 'Texte de bannière d’avertissement (facultatif)', type: 'text', default: '', help: 'Une seule ligne, ASCII, sans « # » ni point d’interrogation. Pas de mot de bienvenue : une bannière avertit, elle n’invite pas.' },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    if (String(v.ciscoNouveauNom ?? '').trim() !== '') {
      const r = (function () { const s = String(v.ciscoNouveauNom).trim(); return /^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(s) && !s.endsWith('-') ? { ok: true, valeur: s } : { ok: false, error: 'Le nouveau nom : lettre en premier, puis lettres, chiffres ou tirets (63 caractères au plus, pas de tiret final).' }; }());
      if (!r.ok) errors.ciscoNouveauNom = r.error; else val.nouveauNom = r.valeur;
    }
    if (String(v.ciscoBanniere ?? '').trim() !== '') {
      const b = texteSur(v.ciscoBanniere, 'La bannière', { max: 200, interdits: '#' });
      if (!b.ok) errors.ciscoBanniere = b.error; else val.banniere = b.valeur;
    }
    if (ctx.mode === 'Configuration' && !val.nouveauNom && !val.banniere && !errors.ciscoNouveauNom && !errors.ciscoBanniere) {
      errors.ciscoNouveauNom = 'Mode Configuration : renseigne au moins le nouveau nom ou la bannière.';
    }
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER ${val.cible}`,
  lecture: () => [
    { n: 'Version d IOS, modele, duree de fonctionnement, image :', c: 'show version' },
    { n: 'Numero de serie et references du materiel :', c: 'show inventory' },
    { n: 'Nom actuel :', c: 'show running-config | include ^hostname' },
    { n: 'Heure de l equipement (une heure fausse fausse les journaux) :', c: 'show clock' },
  ],
  config: (val) => {
    const l = ['configure terminal'];
    if (val.nouveauNom) l.push(`hostname ${val.nouveauNom}`);
    if (val.banniere) l.push(`banner motd #${val.banniere}#`);
    l.push('end');
    return l;
  },
  verification: (val) => [
    { n: 'Le nom change dans l invite des la validation ; controle :', c: 'show running-config | include ^hostname' },
    ...(val.banniere ? [{ n: 'La banniere s affiche a la prochaine connexion ; lecture :', c: 'show running-config | begin banner motd' }] : []),
  ],
  retour: (val) => [
    ...(val.nouveauNom ? [`configure terminal`, `hostname ${val.cible}`] : ['configure terminal']),
    ...(val.banniere ? ['no banner motd'] : []),
    'end',
  ],
  prereqs: PREREQ_COMMUN,
  commonErrors: [
    { message: 'L’invite change de nom et tu ne sais plus où tu es', cause: '« hostname » prend effet immédiatement dans l’invite.', fix: 'C’est normal. Compare avec le nom de l’en-tête du fichier.' },
    { message: '% Invalid input detected at \'^\' marker. sur la ligne « banner motd »', cause: 'Le texte contient le caractère délimiteur « # », ou la ligne a été coupée à la copie.', fix: 'Supprime « # » du texte de la bannière.' },
    ERREUR_MODE,
  ],
  gui: ['Ouvre la console du commutateur.', 'Passe en mode privilégié avec « enable ».', 'Lis « show version » et « show inventory ».', 'Entre dans la configuration globale avec « configure terminal » puis tape « hostname NOUVEAU-NOM ».', 'Pose la bannière avec « banner motd # texte # » puis « end ».'],
  checks: ['« show running-config | include ^hostname » affiche le nouveau nom.', '« show version » indique la version d’IOS attendue.'],
  verifyAfter: ['L’invite porte le nouveau nom.', 'Une nouvelle connexion affiche la bannière.', 'Le changement n’est PAS durable tant que la configuration n’est pas sauvegardée.'],
  rollback: RETOUR_STANDARD('Le nom et la bannière se rétablissent par des commandes inverses ; rien n’est sauvegardé tant que tu ne le demandes pas.', 'show running-config | include ^hostname', 'configure terminal\nhostname ANCIEN-NOM\nno banner motd\nend'),
  source: SRC.systeme.url,
  sources: [SRC.systeme, SRC.cli],
  cisco: {
    probleme: 'Un commutateur sorti de la boîte s’appelle « Switch » : impossible de savoir, à l’invite, lequel on configure.',
    utilite: 'Un nom explicite évite de configurer le mauvais équipement ; la lecture du matériel et de la version dit quelles commandes existent.',
    exemple: 'DS1 et AS1 portent le même nom par défaut ; après « hostname AS1 », l’invite le dit à chaque ligne.',
    lecture: ['show version : modèle, version d’IOS, durée de fonctionnement.', 'show inventory : numéro de série.', 'show running-config | include ^hostname : nom actuel.'],
    effets: ['hostname : change l’invite, le nom dans les journaux et le nom utilisé pour la clé SSH.', 'banner motd : texte affiché avant l’ouverture d’une session.'],
    attendu: ['show version affiche la version d’IOS et le modèle.', 'Après hostname, l’invite et la ligne « hostname » de la running-config montrent le nouveau nom.'],
    limites: ['Changer le hostname après avoir généré une clé SSH n’invalide pas la clé mais peut dérouter les clients (empreinte inchangée, nom différent).', 'Sauvegarde non incluse : voir cisco-config-sauvegarde.'],
  },
});

// ---------------------------------------------------------------------------
// 3. Console et SSH
// ---------------------------------------------------------------------------
export const ciscoConsoleSsh = outilCisco({
  id: 'cisco-console-ssh',
  famille: F_ACCES,
  title: 'Accès console et SSH : comptes locaux, clé, lignes vty',
  summary: 'Préparer SSH sans mot de passe dans le fichier : les secrets se tapent sur la console. Deux étapes séparées : préparation, puis restriction des lignes vty après un test SSH réussi.',
  keywords: ['ssh', 'vty', 'console', 'telnet', 'login local', 'username', 'crypto key', 'ip domain-name', 'secret', 'acces distant', 'cisco'],
  modifie: true,
  champs: [
    { id: 'ciscoEtapeSsh', label: 'Étape à préparer', type: 'select', default: 'preparation',
      options: [['preparation', '1 — Préparation : domaine, version SSH 2, utilisateur et clé (à taper à la main)'], ['restriction', '2 — Restriction des lignes vty à SSH (seulement APRÈS un test SSH réussi)']] },
    { id: 'ciscoDomaine', label: 'Nom de domaine (ip domain-name)', type: 'text', default: 'lab.local', help: 'Sert à nommer la clé RSA. Exemple : lab.local.' },
    { id: 'ciscoUtilisateur', label: 'Nom d’utilisateur local', type: 'text', default: 'admin-lab', help: 'Le NOM seulement. Le mot de passe se tape sur la console : il n’existe dans aucun champ ni fichier.' },
    { id: 'ciscoVty', label: 'Lignes vty concernées', type: 'select', default: '0 4', options: [['0 4', 'line vty 0 4 (5 sessions)'], ['0 15', 'line vty 0 15 (16 sessions)']] },
  ],
  parse(v) {
    const errors = {}; const val = {};
    const e = validerChoixCisco(v.ciscoEtapeSsh, ['preparation', 'restriction'], 'L’étape');
    if (!e.ok) errors.ciscoEtapeSsh = e.error; else val.etape = e.valeur;
    const d = validerDomaineIos(v.ciscoDomaine); if (!d.ok) errors.ciscoDomaine = d.error; else val.domaine = d.valeur;
    const u = validerUtilisateurIos(v.ciscoUtilisateur); if (!u.ok) errors.ciscoUtilisateur = u.error; else val.utilisateur = u.valeur;
    const t = validerChoixCisco(v.ciscoVty, ['0 4', '0 15'], 'Les lignes vty'); if (!t.ok) errors.ciscoVty = t.error; else val.vty = t.valeur;
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER ${val.cible}`,
  lecture: () => [
    { n: 'L image contient-elle le chiffrement (K9) ? Sans cela, SSH n existe pas :', c: 'show version | include K9' },
    { n: 'Etat du serveur SSH, version, delai :', c: 'show ip ssh' },
    { n: 'Une cle RSA existe-t-elle deja ? Ne la regenere pas a l aveugle :', c: 'show crypto key mypubkey rsa' },
    { n: 'Etat des lignes console et vty :', c: 'show line' },
    { n: 'Qui est connecte en ce moment (ne te deconnecte pas toi-meme) :', c: 'show users' },
  ],
  config: (val) => (val.etape === 'preparation' ? [
    { n: 'PREPARATION. Rien ici ne coupe l acces existant : les lignes vty ne sont pas touchees.' },
    'configure terminal',
    `ip domain-name ${val.domaine}`,
    'ip ssh version 2',
    'end',
    { n: 'Les deux lignes suivantes demandent un secret ou une reponse interactive : tape-les toi-meme.' },
    { m: `username ${val.utilisateur} privilege 15 secret  <le mot de passe se tape ici, sur la console, jamais dans un fichier>` },
    { m: 'crypto key generate rsa modulus 2048   (si une cle existe deja, la console demande confirmation : elle serait REMPLACEE)' },
    { n: 'TEST OBLIGATOIRE avant l etape 2 : depuis un poste, ouvre une session SSH avec ce compte (ssh -l NOM adresse-de-gestion). Tant que ce test echoue, ne passe pas a l etape 2.' },
  ] : [
    { n: 'RESTRICTION. A ne coller qu apres un test SSH reussi avec le compte local : sinon login local sans compte ou transport sans cle = acces distant perdu.' },
    'configure terminal',
    `line vty ${val.vty}`,
    ' login local',
    ' transport input ssh',
    'exit',
    'end',
  ]),
  verification: (val) => [
    { n: 'Etat de SSH :', c: 'show ip ssh' },
    { n: 'Les lignes vty et leur configuration :', c: 'show running-config | section line vty' },
    { n: 'Sessions ouvertes :', c: 'show users' },
  ],
  retour: (val) => (val.etape === 'preparation'
    ? ['configure terminal', 'no ip ssh version', `no username ${val.utilisateur}`, 'end', '(la cle RSA se supprime par : crypto key zeroize rsa - a ne faire que si tu es certain de ne plus en avoir besoin)']
    : ['configure terminal', `line vty ${val.vty}`, ' transport input all', ' no login local', 'exit', 'end']),
  prereqs: [
    ...PREREQ_COMMUN,
    'Une image IOS avec chiffrement (« K9 ») : sans elle, la commande de génération de clé n’existe pas.',
    'Un accès console physique pendant l’étape 2 : c’est elle qui peut te fermer la porte de SSH et de Telnet.',
    'Packet Tracer : SSH est pris en charge sur les commutateurs 2960 simulés, avec des limites de version.',
  ],
  commonErrors: [
    { message: 'Please create RSA keys (of at least 768 bits size) to enable SSH v2.', cause: 'ip ssh version 2 demandé sans clé RSA d’au moins 768 bits.', fix: 'Génère la clé à la main (« crypto key generate rsa modulus 2048 ») après avoir fixé le hostname et le domaine.' },
    { message: '% Please define a domain-name first.', cause: 'La clé RSA ne peut pas être générée sans « ip domain-name ».', fix: 'Applique d’abord l’étape de préparation.' },
    ERREUR_PERTE_ACCES,
    ERREUR_MODE,
  ],
  gui: ['Ouvre la console par le câble.', 'Passe en privilégié (« enable »).', 'Fixe le hostname et le domaine, puis génère la clé RSA.', 'Crée l’utilisateur local avec un mot de passe tapé sur la console.', 'Teste SSH depuis un poste, puis seulement après restreins les lignes vty.'],
  checks: ['« show ip ssh » affiche « SSH Enabled - version 2.0 ».', 'Une session SSH avec le compte local s’ouvre depuis un poste.', 'Après l’étape 2, Telnet est refusé et SSH fonctionne encore.'],
  verifyAfter: ['« show ip ssh » mentionne la version 2.', 'La section « line vty » contient « login local » et « transport input ssh » (étape 2 seulement).'],
  rollback: RETOUR_STANDARD('L’étape 2 s’annule en restaurant le transport par défaut ; la clé RSA et l’utilisateur se retirent séparément.', 'show ip ssh\nshow running-config | section line vty', 'configure terminal\nline vty 0 4\n transport input all\n no login local\nexit\nend'),
  source: SRC.ssh.url,
  sources: [SRC.ssh, SRC.systeme],
  cisco: {
    probleme: 'Telnet transmet tout en clair, et une configuration SSH mal ordonnée peut enfermer dehors celui qui la fait.',
    utilite: 'Séparer préparation et restriction permet de TESTER SSH avant de fermer Telnet.',
    exemple: 'Sur AS1, on crée le compte « admin-lab », on génère la clé, on se connecte en SSH depuis le PC d’administration, puis on restreint les lignes vty.',
    lecture: ['show version | include K9 : le chiffrement est-il disponible.', 'show ip ssh et show crypto key mypubkey rsa : SSH et clé existants.', 'show line / show users : lignes actives et sessions ouvertes.'],
    effets: ['ip domain-name et ip ssh version 2 : préparation du service SSH.', 'Compte local et clé RSA : tapés à la main (secret / confirmation interactive).', 'line vty … login local / transport input ssh : n’accepte plus que SSH avec le compte local.'],
    attendu: ['show ip ssh : « SSH Enabled - version 2.0 ».', 'show crypto key mypubkey rsa : une clé « General Purpose » de 2048 bits (ou plus).'],
    limites: ['Aucun mot de passe n’est généré ni stocké : ce choix est volontaire.', 'Les options de durcissement (délai, nombre d’essais, ACL sur les lignes) ne sont pas traitées ici.', 'La syntaxe de « username … secret » (algorithm-type) varie selon la version d’IOS.'],
  },
});

// ---------------------------------------------------------------------------
// 4. running-config / startup-config
// ---------------------------------------------------------------------------
export const ciscoSauvegarde = outilCisco({
  id: 'cisco-config-sauvegarde',
  famille: F_CONFIG,
  title: 'running-config et startup-config : lire, comparer, sauvegarder',
  summary: 'Distinguer la configuration active (mémoire vive) de celle qui survit au redémarrage, les comparer, et ne sauvegarder qu’en toute connaissance de cause.',
  keywords: ['running-config', 'startup-config', 'copy run start', 'write memory', 'sauvegarde', 'nvram', 'archive', 'difference', 'cisco'],
  modifie: true,
  sauvegarde: true,
  reversible: false,
  titreAction: 'SAUVEGARDE PERSISTANTE (running-config -> startup-config)',
  titreProposition: 'SAUVEGARDE PROPOSEE',
  aideMode: 'Lecture par défaut. Configuration = écrire la running-config dans la startup-config (remplace l’ancienne).',
  champs: [],
  parse() { return { errors: {}, val: {} }; },
  phrase: (val) => `SAUVEGARDER ${val.cible}`,
  lecture: () => [
    { n: 'running-config = ce qui s execute MAINTENANT (memoire vive). Elle disparait au redemarrage si elle n est pas sauvegardee.' },
    { n: 'startup-config = ce qui sera relu au prochain demarrage (memoire non volatile).' },
    { n: 'Taille et presence de la configuration sauvegardee :', c: 'show startup-config | include ^version' },
    { n: 'Compare les deux a l ecran (si la commande existe sur ton modele) :', c: 'show archive config differences nvram:startup-config system:running-config' },
    { n: 'Sans cette commande, compare a la main des sections ciblees, par exemple :', c: 'show running-config | include ^hostname' },
    { c: 'show startup-config | include ^hostname' },
    { n: 'Lecture complete (longue ; peut contenir des empreintes de mots de passe : ne la colle dans aucun message) :', c: 'show running-config' },
  ],
  config: () => [
    { n: 'La console demandera Destination filename [startup-config] : appuie sur Entree, sans rien taper.' },
    'copy running-config startup-config',
  ],
  verification: () => [
    { n: 'Apres la copie, les deux doivent concorder :', c: 'show archive config differences nvram:startup-config system:running-config' },
  ],
  retour: () => [
    { n: 'La startup-config precedente est ECRASEE : il n existe pas de retour automatique. Avant de sauvegarder, copie la configuration saine ailleurs (copy startup-config flash:ancienne-config.cfg) ou garde la sortie de show running-config.' },
    'copy flash:ancienne-config.cfg startup-config',
  ],
  prereqs: [...PREREQ_COMMUN, 'Avoir lu la différence entre running-config et startup-config, et vérifié que la configuration active est CELLE que tu veux conserver.'],
  commonErrors: [
    { message: 'Les changements disparaissent après un redémarrage', cause: 'Ils n’existaient que dans la running-config (mémoire vive).', fix: 'Sauvegarde explicitement après vérification.' },
    { message: 'Une erreur sauvegardée au démarrage suivant', cause: 'La configuration a été sauvegardée alors qu’elle contenait la faute (VLAN de gestion, trunk…).', fix: 'Vérifie avant de sauvegarder ; sinon, redémarre en cas de panne SANS avoir sauvegardé, ou restaure une copie.' },
    { message: '% Invalid input detected at \'^\' marker. sur show archive config differences', cause: 'Commande absente de ce modèle ou de ce simulateur.', fix: 'Compare les sections à la main avec « | include » ou « | section ».' },
  ],
  gui: ['Passe en mode privilégié.', 'Lis « show running-config » et « show startup-config » et compare.', 'Vérifie ta configuration (ping, show).', 'Sauvegarde avec « copy running-config startup-config », puis valide par Entrée.'],
  checks: ['La commande affiche « [OK] » après « Building configuration… ».', 'Les sorties de show startup-config et show running-config concordent sur les sections modifiées.'],
  verifyAfter: ['La configuration sauvegardée contient bien les modifications attendues.', 'Après redémarrage, l’équipement revient avec cette configuration.'],
  rollback: RETOUR_STANDARD('Il n’y a pas de retour automatique : la startup-config est écrasée. Garde une copie avant.', 'show startup-config | include ^hostname', 'copy startup-config flash:ancienne-config.cfg\n(à faire AVANT de sauvegarder)'),
  reversible: false,
  source: SRC.systeme.url,
  sources: [SRC.systeme, SRC.interfaces],
  cisco: {
    probleme: 'Confondre « la configuration marche » et « la configuration est enregistrée » : le premier redémarrage supprime tout ce qui n’a pas été sauvegardé.',
    utilite: 'Séparer consultation, modification active et sauvegarde persistante évite deux erreurs symétriques : perdre un travail, ou graver une faute.',
    exemple: 'Après avoir ajouté le VLAN 20 sur AS1 et testé avec un PC, on sauvegarde. Si le test avait échoué, un redémarrage aurait suffi à revenir en arrière.',
    lecture: ['show startup-config | include ^hostname et show running-config | include ^hostname : nom dans chaque configuration.', 'show archive config differences : écarts (si la commande existe).'],
    effets: ['copy running-config startup-config : remplace la configuration de démarrage par la configuration active.'],
    attendu: ['« Building configuration… [OK] » après la copie.', 'show archive config differences : aucune différence.'],
    limites: ['Écrase la startup-config : aucun retour automatique.', 'show archive config differences n’existe pas partout.', 'Pas de sauvegarde sur serveur TFTP/SCP : hors périmètre.'],
  },
});

// ---------------------------------------------------------------------------
// 5. Interface : état, description, activation ciblée
// ---------------------------------------------------------------------------
const ACTIONS_INTERFACE = ['description', 'desactiver', 'activer'];
export const ciscoInterfaceEtat = outilCisco({
  id: 'cisco-interface-etat',
  famille: F_INTERFACES,
  title: 'Interface : état, description, activation ou désactivation d’UN port',
  summary: 'Lire l’état d’une interface (up/down, erreurs), puis — en mode Configuration — lui donner une description ou l’activer / la désactiver. Un seul port, jamais une plage.',
  keywords: ['interface', 'show ip interface brief', 'show interfaces status', 'shutdown', 'no shutdown', 'description', 'port', 'err-disabled', 'cisco', 'fa0/7', 'gi1/0/7'],
  modifie: true,
  interface: true,
  champs: [
    { id: 'ciscoInterface', label: 'Interface (une seule)', type: 'text', default: 'Fa0/7', help: 'Fa0/7 ou Gi0/1 (commutateur autonome) ; Gi1/0/7 (numérotation module/slot/port). Aucune plage, aucune liste.' },
    { id: 'ciscoActionInterface', label: 'Action en mode Configuration', type: 'select', default: 'description',
      options: [['description', 'Poser une description'], ['desactiver', 'Désactiver (shutdown)'], ['activer', 'Activer (no shutdown)']] },
    { id: 'ciscoDescription', label: 'Description (pour l’action « Poser une description »)', type: 'text', default: 'PC-COMPTA-01', help: 'ASCII, 200 caractères au plus, sans point d’interrogation. Pas de secret.' },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel);
    if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    const a = validerChoixCisco(v.ciscoActionInterface, ACTIONS_INTERFACE, 'L’action');
    if (!a.ok) errors.ciscoActionInterface = a.error; else val.action = a.valeur;
    if (val.action === 'description' || String(v.ciscoDescription ?? '').trim() !== '') {
      const d = texteSur(v.ciscoDescription, 'La description', { max: 200 });
      if (!d.ok) errors.ciscoDescription = d.error; else val.description = d.valeur;
    }
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER ${val.interface}`,
  lecture: (val) => [
    { n: 'Vue d ensemble : une ligne par interface (Status = etat administratif, Protocol = etat de la ligne) :', c: 'show ip interface brief' },
    { n: 'Etat, VLAN, duplex, vitesse de cette interface :', c: `show interfaces ${val.interface} status` },
    { n: 'Compteurs, erreurs, description :', c: `show interfaces ${val.interface}` },
    { n: 'Ce que la configuration dit de ce port :', c: `show running-config interface ${val.interface}` },
    { n: 'Ports coupes par un mecanisme de protection (err-disabled), si la commande existe :', c: 'show interfaces status err-disabled' },
  ],
  config: (val) => {
    const l = ['configure terminal', `interface ${val.interface}`];
    if (val.action === 'description') l.push(` description ${val.description}`);
    if (val.action === 'desactiver') l.push(' shutdown');
    if (val.action === 'activer') l.push(' no shutdown');
    l.push('end');
    return l;
  },
  verification: (val) => [
    { n: 'Controle apres modification :', c: `show interfaces ${val.interface} status` },
    { c: `show running-config interface ${val.interface}` },
  ],
  retour: (val) => ['configure terminal', `interface ${val.interface}`,
    val.action === 'description' ? ' no description' : (val.action === 'desactiver' ? ' no shutdown' : ' shutdown'), 'end'],
  prereqs: PREREQ_COMMUN,
  commonErrors: [
    { message: 'Status « administratively down », Protocol « down »', cause: 'L’interface a été désactivée par « shutdown ».', fix: '« no shutdown » sur CETTE interface, après avoir compris pourquoi elle était coupée.' },
    { message: 'Status « down », Protocol « down »', cause: 'Câble absent, équipement distant éteint, ou câble incorrect.', fix: 'Vérifie le câble et l’autre extrémité avant de toucher à la configuration.' },
    { message: 'Status « err-disabled »', cause: 'Un mécanisme de protection (port-security, BPDU guard…) a coupé le port.', fix: 'Traite la cause, puis remets le port en service avec l’assistant de port-security — pas avec un « shutdown / no shutdown » à l’aveugle.' },
    ERREUR_PERTE_ACCES,
  ],
  gui: ['Ouvre la console.', 'Lis « show ip interface brief » pour trouver le port.', 'Entre dans la configuration globale puis « interface <nom> ».', 'Tape « description … », « shutdown » ou « no shutdown » selon le besoin, puis « end ».'],
  checks: ['L’état de l’interface correspond à l’action demandée.', 'La ligne « description » apparaît dans la running-config du port.'],
  verifyAfter: ['« show interfaces <port> status » montre l’état attendu (connected / disabled / notconnect).', 'La désactivation d’un port n’a pas coupé ta propre session.'],
  rollback: RETOUR_STANDARD('Chaque action a son inverse direct : no description, no shutdown ou shutdown.', 'show interfaces status', 'configure terminal\ninterface <port>\n no shutdown\nend'),
  source: SRC.interfaces.url,
  sources: [SRC.interfaces, SRC.layer2Commandes],
  cisco: {
    probleme: 'Un port « ne marche pas » : coupé volontairement, câble débranché, ou désactivé par une protection ? Les trois ne se soignent pas pareil.',
    utilite: 'Lire status et protocol, puis agir sur UN port nommé, évite de transformer un diagnostic en panne plus large.',
    exemple: 'La prise du bureau 214 est câblée sur Fa0/7 : on pose la description « PC-COMPTA-01 » pour que le prochain technicien le sache.',
    lecture: ['show ip interface brief : vue d’ensemble.', 'show interfaces <port> status : état et VLAN.', 'show interfaces <port> : compteurs d’erreurs.'],
    effets: ['description : commentaire sur le port, sans effet réseau.', 'shutdown : coupe administrativement le port (les appareils branchés perdent le réseau).', 'no shutdown : réactive le port.'],
    attendu: ['Port actif : « connected » dans show interfaces status ; coupé : « disabled » ; câble absent : « notconnect » ; protection : « err-disabled ».'],
    limites: ['Un seul port par fichier : volontairement, pas de plage « range ».', 'Le texte d’état varie selon la version d’IOS.', 'Désactiver l’uplink par lequel tu es connecté coupe ta session.'],
  },
});

// ---------------------------------------------------------------------------
// 6. Gestion IP
// ---------------------------------------------------------------------------
export const ciscoGestionIp = outilCisco({
  id: 'cisco-gestion-ip',
  famille: F_ACCES,
  title: 'Adresse de gestion du commutateur : interface VLAN, passerelle, ping',
  summary: 'Donner une adresse IP à l’interface VLAN de gestion (SVI) et une passerelle adaptée à un commutateur de niveau 2 ou de niveau 3, puis tester.',
  keywords: ['svi', 'interface vlan', 'ip address', 'default-gateway', 'ip route', 'gestion', 'management', 'ping', 'cisco', 'vlan de gestion'],
  modifie: true,
  champs: [
    { id: 'ciscoVlanGestion', label: 'VLAN de gestion', type: 'number', default: 99, min: 2, max: 4094, help: 'Le VLAN doit exister ET être actif sur au moins un port ou un trunk, sinon l’interface reste « down ».' },
    { id: 'ciscoIp', label: 'Adresse IP de gestion', type: 'text', default: '192.168.99.11', help: 'Adresse d’hôte du réseau de gestion, pas l’adresse du réseau ni de diffusion. Voir aussi l’assistant ipv4-subnet-calculator.' },
    { id: 'ciscoMasque', label: 'Masque', type: 'text', default: '255.255.255.0', help: 'Décimal pointé contigu, entre /8 et /30.' },
    { id: 'ciscoPasserelle', label: 'Passerelle (facultative)', type: 'text', default: '192.168.99.1', help: 'Dans le même sous-réseau. Laisse vide pour ne pas en poser.' },
    { id: 'ciscoNiveau', label: 'Type de commutateur', type: 'select', default: 'l2', options: [['l2', 'Niveau 2 — « ip default-gateway »'], ['l3', 'Niveau 3 avec routage actif — « ip route 0.0.0.0 0.0.0.0 »']], help: 'Un commutateur de niveau 2 pur n’a pas de table de routage.' },
    { id: 'ciscoPing', label: 'Cible du ping de contrôle (facultative)', type: 'text', default: '', help: 'IPv4. Le ping est une COMMANDE à coller : le Toolkit n’envoie rien.' },
  ],
  parse(v) {
    const errors = {}; const val = {};
    const vl = validerVlanIos(v.ciscoVlanGestion, { label: 'Le VLAN de gestion' });
    if (!vl.ok) errors.ciscoVlanGestion = vl.error; else val.vlan = vl.valeur;
    const h = validerIpMasqueIos(v.ciscoIp, v.ciscoMasque);
    if (!h.ok) errors[/masque/i.test(h.error) ? 'ciscoMasque' : 'ciscoIp'] = h.error; else val.hote = h.valeur;
    const n = validerChoixCisco(v.ciscoNiveau, ['l2', 'l3'], 'Le type de commutateur');
    if (!n.ok) errors.ciscoNiveau = n.error; else val.niveau = n.valeur;
    if (val.hote && String(v.ciscoPasserelle ?? '').trim() !== '') {
      const g = validerPasserelleIos(v.ciscoPasserelle, val.hote);
      if (!g.ok) errors.ciscoPasserelle = g.error; else val.passerelle = g.valeur;
    } else if (String(v.ciscoPasserelle ?? '').trim() !== '' && !val.hote) {
      // l'adresse est invalide : on ne peut pas vérifier le sous-réseau
    }
    if (String(v.ciscoPing ?? '').trim() !== '') {
      const p = validerCibleIpv4(v.ciscoPing, 'La cible du ping'); if (!p.ok) errors.ciscoPing = p.error; else val.ping = p.valeur;
    }
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER VLAN ${val.vlan}`,
  lecture: (val) => [
    { n: 'Le VLAN de gestion existe-t-il, et sur quels ports :', c: `show vlan id ${val.vlan}` },
    { n: 'Etat des interfaces et adresses actuelles :', c: 'show ip interface brief' },
    { n: 'Configuration actuelle de l interface de gestion (peut ne pas exister) :', c: `show running-config interface vlan ${val.vlan}` },
    { n: val.niveau === 'l2' ? 'Passerelle actuelle (niveau 2) :' : 'Routes actuelles (niveau 3) :', c: val.niveau === 'l2' ? 'show ip default-gateway' : 'show ip route' },
  ],
  config: (val) => {
    const l = [
      { n: `Reseau ${val.hote.reseau}/${val.hote.prefixe}, diffusion ${val.hote.diffusion}. Si tu es connecte par SSH sur l ancienne adresse, ta session sera perdue : garde la console.` },
      'configure terminal', `interface vlan ${val.vlan}`, ` ip address ${val.hote.ip} ${val.hote.masque}`, ' no shutdown', 'exit',
    ];
    if (val.passerelle) l.push(val.niveau === 'l2' ? `ip default-gateway ${val.passerelle}` : `ip route 0.0.0.0 0.0.0.0 ${val.passerelle}`);
    l.push('end');
    return l;
  },
  verification: (val) => [
    { n: 'L interface doit etre up/up (sinon : VLAN absent ou aucun port actif dans ce VLAN) :', c: 'show ip interface brief' },
    ...(val.passerelle ? [{ n: 'Test de la passerelle :', c: `ping ${val.passerelle}` }] : []),
    ...(val.ping ? [{ n: 'Test de la cible demandee :', c: `ping ${val.ping}` }] : []),
  ],
  retour: (val) => ['configure terminal', ...(val.passerelle ? [val.niveau === 'l2' ? 'no ip default-gateway' : `no ip route 0.0.0.0 0.0.0.0 ${val.passerelle}`] : []), `interface vlan ${val.vlan}`, ' no ip address', ' shutdown', 'exit', 'end'],
  prereqs: [...PREREQ_COMMUN, 'Le VLAN de gestion existe (voir l’assistant d’inventaire des VLAN) et au moins un port ou trunk le porte.', 'Un plan d’adressage de gestion : l’adresse, le masque et la passerelle viennent de ta documentation, pas d’un exemple.'],
  commonErrors: [
    { message: 'Vlan99 est « up, line protocol down »', cause: 'Le VLAN existe mais aucun port actif n’y est affecté, ou le VLAN manque sur le trunk.', fix: 'Affecte un port au VLAN ou autorise-le sur le trunk ; vérifie avec show vlan id.' },
    { message: '% Invalid input detected at \'^\' marker. sur ip default-gateway', cause: 'Le commutateur est de niveau 3 avec « ip routing » actif : ip default-gateway est ignoré ou refusé.', fix: 'Choisis « niveau 3 » : ip route 0.0.0.0 0.0.0.0 <passerelle>.' },
    { message: 'Ping : 5 points (.....)', cause: 'Interface down, mauvais masque, mauvaise passerelle, ou VLAN non transporté.', fix: 'Relis show ip interface brief puis l’inventaire des VLAN.' },
    ERREUR_PERTE_ACCES,
  ],
  gui: ['Ouvre la console.', 'Vérifie que le VLAN de gestion existe.', 'Entre dans « interface vlan N », pose « ip address A M » puis « no shutdown ».', 'Fixe la passerelle selon le type de commutateur et teste avec ping.'],
  checks: ['show ip interface brief : l’interface VLAN est « up / up » avec l’adresse attendue.', 'Le ping vers la passerelle répond.'],
  verifyAfter: ['Le poste d’administration joint l’adresse de gestion.', 'La passerelle répond au ping depuis le commutateur.'],
  rollback: RETOUR_STANDARD('L’adresse et la passerelle se retirent par les commandes « no ».', 'show ip interface brief\nshow ip default-gateway', 'configure terminal\ninterface vlan <N>\n no ip address\n shutdown\nexit\nno ip default-gateway\nend'),
  source: SRC.interfaces.url,
  sources: [SRC.interfaces, SRC.vlan],
  cisco: {
    probleme: 'Un commutateur sans adresse de gestion ne s’administre qu’à la console ; avec une adresse mal posée il devient injoignable.',
    utilite: 'La SVI du VLAN de gestion donne une adresse IP au commutateur ; la passerelle lui permet d’être joint depuis un autre réseau.',
    exemple: 'AS1 reçoit 192.168.99.11/24 sur l’interface VLAN 99, passerelle 192.168.99.1, pour être administré depuis le poste du technicien.',
    lecture: ['show vlan id N : existence du VLAN et ports.', 'show ip interface brief : état des interfaces.', 'show ip default-gateway ou show ip route : passerelle actuelle.'],
    effets: ['interface vlan N + ip address + no shutdown : crée l’interface virtuelle de gestion.', 'ip default-gateway (niveau 2) ou ip route 0.0.0.0 0.0.0.0 (niveau 3) : chemin vers les autres réseaux.'],
    attendu: ['« Vlan99 … up up » avec l’adresse.', 'ping : « !!!!! » (cinq réponses) vers la passerelle.'],
    limites: ['Ne vérifie pas que l’adresse est libre : ping avant de l’attribuer, ou consulte ton plan d’adressage.', 'IPv4 seulement.', 'Ne configure pas « ip routing » : si un commutateur de niveau 3 ne route pas encore, ce n’est pas cet assistant qui l’active.'],
  },
});

// ---------------------------------------------------------------------------
// 7. Table MAC
// ---------------------------------------------------------------------------
const TYPES_MAC = ['tous', 'dynamic', 'static'];
const EFFACEMENTS_MAC = ['aucun', 'interface', 'vlan', 'adresse'];
export const ciscoTableMac = outilCisco({
  id: 'cisco-table-mac',
  famille: F_INTERFACES,
  title: 'Table d’adresses MAC : lecture filtrée et effacement ciblé',
  summary: 'Lire la table MAC (par interface, par VLAN, par type) et, en mode Configuration, effacer des adresses DYNAMIQUES ciblées. Jamais d’effacement général.',
  keywords: ['mac address-table', 'table mac', 'cam', 'dynamic', 'static', 'sticky', 'clear mac', 'apprentissage', 'cisco', 'vlan', 'interface'],
  modifie: true,
  interface: true,
  champs: [
    { id: 'ciscoTypeMac', label: 'Type d’entrées à lire', type: 'select', default: 'tous', options: [['tous', 'Toutes'], ['dynamic', 'Dynamiques (apprises)'], ['static', 'Statiques (configurées)']] },
    { id: 'ciscoInterface', label: 'Interface (facultative)', type: 'text', default: 'Fa0/7', help: 'Laisse vide pour ne pas filtrer par interface.' },
    { id: 'ciscoVlanFiltre', label: 'VLAN (facultatif)', type: 'text', default: '', help: 'Laisse vide pour ne pas filtrer par VLAN.' },
    { id: 'ciscoMacFiltre', label: 'Adresse MAC (facultative)', type: 'text', default: '', help: 'aaaa.bbbb.cccc, aa:bb:cc:dd:ee:ff ou aa-bb-cc-dd-ee-ff.' },
    { id: 'ciscoEffacement', label: 'Effacement dynamique ciblé (mode Configuration)', type: 'select', default: 'aucun', options: [['aucun', 'Aucun'], ['interface', 'Par interface'], ['vlan', 'Par VLAN'], ['adresse', 'Par adresse MAC']] },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const t = validerChoixCisco(v.ciscoTypeMac, TYPES_MAC, 'Le type'); if (!t.ok) errors.ciscoTypeMac = t.error; else val.type = t.valeur;
    const e = validerChoixCisco(v.ciscoEffacement, EFFACEMENTS_MAC, 'L’effacement'); if (!e.ok) errors.ciscoEffacement = e.error; else val.effacement = e.valeur;
    if (String(v.ciscoInterface ?? '').trim() !== '') {
      const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    }
    if (String(v.ciscoVlanFiltre ?? '').trim() !== '') {
      const vl = validerVlanIos(v.ciscoVlanFiltre, { lecture: true }); if (!vl.ok) errors.ciscoVlanFiltre = vl.error; else val.vlan = vl.valeur;
    }
    if (String(v.ciscoMacFiltre ?? '').trim() !== '') {
      const m = validerMacIos(v.ciscoMacFiltre); if (!m.ok) errors.ciscoMacFiltre = m.error; else val.mac = m.valeur;
    }
    if (val.effacement && val.effacement !== 'aucun' && !errors.ciscoInterface && !errors.ciscoVlanFiltre && !errors.ciscoMacFiltre) {
      const cible = { interface: val.interface, vlan: val.vlan, adresse: val.mac }[val.effacement];
      if (cible === undefined) {
        errors[{ interface: 'ciscoInterface', vlan: 'ciscoVlanFiltre', adresse: 'ciscoMacFiltre' }[val.effacement]] = 'Cet effacement ciblé exige la valeur correspondante : aucun effacement général n’est proposé.';
      }
    }
    if (ctx.mode === 'Configuration' && val.effacement === 'aucun' && !errors.ciscoEffacement) {
      errors.ciscoEffacement = 'Mode Configuration : choisis un effacement ciblé (interface, VLAN ou adresse).';
    }
    return { errors, val };
  },
  phrase: (val) => {
    const cible = { interface: val.interface, vlan: `VLAN ${val.vlan}`, adresse: val.mac }[val.effacement];
    return `EFFACER ${cible ?? val.cible}`;
  },
  titreAction: 'EFFACEMENT CIBLE DES ADRESSES DYNAMIQUES (commande du mode privilegie)',
  titreProposition: 'EFFACEMENT CIBLE PROPOSE',
  lecture: (val) => {
    const base = `show mac address-table${val.type === 'tous' ? '' : ` ${val.type}`}`;
    const items = [{ n: 'Resume : nombre d adresses apprises et capacite de la table :', c: 'show mac address-table count' }];
    const filtres = [];
    if (val.interface) filtres.push([`Adresses vues derriere ${val.interface} :`, `${base} interface ${val.interface}`]);
    if (val.vlan) filtres.push([`Adresses du VLAN ${val.vlan} :`, `${base} vlan ${val.vlan}`]);
    if (val.mac) filtres.push([`Ou se trouve ${val.mac} :`, `${base} address ${val.mac}`]);
    if (filtres.length === 0) filtres.push(['Table complete (peut etre longue) :', base]);
    for (const [n, c] of filtres) items.push({ n, c });
    items.push({ n: 'Duree de vie des adresses dynamiques :', c: 'show mac address-table aging-time' });
    items.push({ n: 'Les adresses SECURISEES (port-security) se lisent avec : show port-security address. Une adresse sticky ne disparait PAS avec un effacement dynamique.' });
    return items;
  },
  config: (val) => {
    const cible = { interface: `interface ${val.interface}`, vlan: `vlan ${val.vlan}`, adresse: `address ${val.mac}` }[val.effacement];
    return [
      { n: 'Consequence : les adresses effacees sont reapprises a la prochaine trame ; en attendant, le commutateur diffuse les trames destinees a une adresse inconnue (inondation brève).' },
      `clear mac address-table dynamic ${cible}`,
    ];
  },
  verification: (val) => [
    { n: 'Relis la table : les adresses reapparaissent des que les machines emettent.', c: 'show mac address-table count' },
  ],
  retour: () => [{ n: 'Effacer des adresses dynamiques ne se defait pas : elles se reapprennent seules des que les machines emettent. Rien a retaper.' }],
  prereqs: [...PREREQ_COMMUN.slice(0, 2), 'Pour l’effacement : savoir POURQUOI on efface (machine déplacée, entrée obsolète) — effacer n’est pas un diagnostic.'],
  commonErrors: [
    { message: 'Une adresse réapparaît tout de suite après l’effacement', cause: 'La machine émet toujours : l’apprentissage est automatique.', fix: 'C’est le fonctionnement normal. Si l’adresse revient sur un mauvais port, cherche le branchement ou une boucle.' },
    { message: 'Une adresse sticky ou statique ne part pas', cause: 'L’effacement dynamique ne touche que les adresses apprises.', fix: 'Les adresses sécurisées se traitent avec l’assistant de port-security, ciblées une à une.' },
    { message: 'La table est vide pour un VLAN', cause: 'Aucune machine n’a émis dans ce VLAN depuis le dernier effacement ou le délai de vieillissement.', fix: 'Fais émettre la machine (ping) puis relis.' },
  ],
  gui: ['Ouvre la console.', 'Tape « show mac address-table » (avec les filtres de la fiche).', 'Repère l’adresse, le VLAN et le port.', 'Pour effacer, utilise « clear mac address-table dynamic » avec UN critère (interface, VLAN ou adresse).'],
  checks: ['L’adresse de la machine apparaît derrière le port attendu, dans le VLAN attendu.', 'Après l’effacement, l’entrée est réapprise.'],
  verifyAfter: ['La table montre la machine sur le bon port.', 'Aucun effacement général n’a été fait.'],
  rollback: RETOUR_STANDARD('Rien à retaper : les adresses dynamiques effacées se réapprennent seules.', 'show mac address-table count', '(aucune commande de retour)'),
  reversible: true,
  source: SRC.layer2Commandes.url,
  sources: [SRC.layer2Commandes, SRC.interfaces],
  cisco: {
    probleme: 'Savoir quelle machine est branchée sur quel port, dans quel VLAN, est la première question de tout diagnostic de niveau 2.',
    utilite: 'La table MAC répond à « où est cette machine ». L’effacement ciblé force un réapprentissage sans toucher au reste.',
    exemple: 'Le PC de la compta a changé de prise : on efface son adresse dynamique pour que la table reflète le nouveau port.',
    lecture: ['show mac address-table [dynamic|static] interface|vlan|address … : une commande par filtre.', 'show mac address-table count : nombre d’entrées.', 'show port-security address : adresses sécurisées (sticky comprises).'],
    effets: ['clear mac address-table dynamic interface|vlan|address : supprime les adresses APPRISES correspondantes, jamais les statiques ni les sticky.'],
    attendu: ['Une ligne par adresse : VLAN, adresse, type (DYNAMIC / STATIC), port.', 'Après effacement ciblé : l’entrée disparaît puis revient quand la machine émet.'],
    limites: ['Un seul critère d’effacement à la fois ; aucun effacement général (« clear mac address-table dynamic » seul) n’est proposé.', 'La présentation et certains mots-clés varient selon le modèle.', 'Les adresses sécurisées peuvent apparaître comme STATIC dans cette table : la distinction se lit avec show port-security address.'],
  },
});

// ---------------------------------------------------------------------------
// 8. Port-security : état et diagnostic
// ---------------------------------------------------------------------------
export const ciscoPortSecurityEtat = outilCisco({
  id: 'cisco-port-security-etat',
  famille: F_INTERFACES,
  title: 'Port-security : état, adresses sécurisées, violations et port bloqué',
  summary: 'Lire la configuration de port-security d’une interface, les adresses sécurisées et les violations, et reconnaître un port coupé par une violation. Lecture seule.',
  keywords: ['port-security', 'violation', 'sticky', 'err-disabled', 'secure-shutdown', 'show port-security', 'port bloque', 'cisco', 'errdisable'],
  interface: true,
  champs: [
    { id: 'ciscoInterface', label: 'Interface à diagnostiquer', type: 'text', default: 'Fa0/7', help: 'Une seule interface. La numérotation dépend du matériel choisi.' },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    return { errors, val };
  },
  lecture: (val) => [
    { n: 'Resume de port-security sur tout l equipement (lecture) :', c: 'show port-security' },
    { n: 'Detail pour ce port : Port Status, Violation Mode, Maximum / Total MAC Addresses, Last Source Address, Security Violation Count :', c: `show port-security interface ${val.interface}` },
    { n: 'Adresses sécurisées (configurees, sticky) :', c: 'show port-security address' },
    { n: 'Etat du port (err-disabled = coupe par une protection) :', c: `show interfaces ${val.interface} status` },
    { n: 'Ports actuellement coupes par une protection (si la commande existe) :', c: 'show interfaces status err-disabled' },
    { n: 'Causes de coupure qui se retablissent seules apres un delai (lecture) :', c: 'show errdisable recovery' },
    { n: 'Trace de la violation dans le journal :', c: 'show logging | include PORT_SECURITY' },
  ],
  verification: () => [],
  finFichier: () => [
    'LECTURE DES RESULTATS',
    'Port Status Secure-up : port actif, protection en vigueur. Secure-shutdown : le port a ete coupe par une violation (err-disabled).',
    'Total MAC Addresses = Maximum MAC Addresses : le port est plein ; une nouvelle adresse declenche la violation choisie.',
    'Last Source Address:Vlan : la derniere adresse qui a viole la regle - c est l appareil a identifier avant de remettre le port en service.',
    'Violation Mode shutdown coupe le port ; restrict ne coupe pas mais jette les trames et journalise ; protect jette sans journaliser.',
    'Cet assistant ne prouve rien sur l equipement : il te donne les lectures a faire. Le verdict vient de ce que TU lis.',
  ],
  prereqs: [...PREREQ_COMMUN.slice(0, 2), 'Aucune modification n’est faite par cet assistant : il sert à lire et à comprendre.'],
  commonErrors: [
    { message: 'Port Status « Secure-shutdown »', cause: 'Une violation a coupé le port (adresse supplémentaire ou adresse non autorisée).', fix: 'Identifie l’appareil (Last Source Address), retire-le ou autorise-le, puis remets le port en service avec l’assistant de configuration — pas avant.' },
    { message: '% Invalid input detected at \'^\' marker. sur show port-security interface', cause: 'Interface mal nommée ou port-security non pris en charge dans ce simulateur.', fix: 'Vérifie le nom du port avec show ip interface brief.' },
    { message: 'Le port est « err-disabled » mais port-security est désactivé', cause: 'Une autre protection (BPDU guard, boucle…) l’a coupé.', fix: 'Consulte show errdisable recovery et le journal.' },
  ],
  gui: ['Ouvre la console.', 'Tape « show port-security » pour voir quels ports sont protégés.', 'Tape « show port-security interface <port> » pour le détail.', 'Compare l’état à « show interfaces <port> status ».'],
  checks: ['Le mode de violation et le maximum sont ceux de la politique prévue.', 'Si le port est coupé, l’adresse fautive est identifiée.'],
  verifyAfter: ['Tu sais dire si le port est actif, plein ou coupé par violation.', 'Tu connais l’adresse en cause avant toute remise en service.'],
  rollback: RETOUR_STANDARD('Rien à annuler : l’assistant ne fait que lire.', 'show port-security', '(aucune commande de retour)'),
  source: SRC.portSecurity.url,
  sources: [SRC.portSecurity, SRC.interfaces],
  cisco: {
    probleme: 'Un poste ne communique plus depuis qu’on l’a débranché puis rebranché : port-security a peut-être coupé le port.',
    utilite: 'Lire avant d’agir : on identifie la cause (quel appareil, quelle règle) au lieu de redémarrer le port à l’aveugle.',
    exemple: 'Un technicien branche un portable personnel sur Fa0/7 ; le port passe en Secure-shutdown, et l’adresse du portable apparaît dans Last Source Address.',
    lecture: ['show port-security interface <port> : état, mode de violation, compteur.', 'show port-security address : adresses sécurisées.', 'show interfaces <port> status : err-disabled ou non.'],
    effets: ['Aucun : lecture seule.'],
    attendu: ['Port actif : « Secure-up ». Port coupé : « Secure-shutdown » et état « err-disabled ».'],
    limites: ['Les libellés exacts varient légèrement selon la version d’IOS.', 'N’analyse aucune sortie : voir l’assistant de parcours de diagnostic pour l’analyse de sorties collées (VLAN, trunk, VTP seulement).'],
  },
});

// ---------------------------------------------------------------------------
// 9. Port-security : configuration ciblée et remise en service
// ---------------------------------------------------------------------------
const VIOLATIONS = ['shutdown', 'restrict', 'protect'];
export const ciscoPortSecurityConfig = outilCisco({
  id: 'cisco-port-security-config',
  famille: F_INTERFACES,
  title: 'Port-security : configurer UN port, ou le remettre en service après correction',
  summary: 'Activer port-security sur un port d’accès (maximum, sticky, mode de violation), ou remettre en service un port coupé APRÈS avoir traité la cause. Un port à la fois, aucun nettoyage général.',
  keywords: ['port-security', 'sticky', 'maximum', 'violation', 'shutdown', 'restrict', 'protect', 'remise en service', 'err-disabled', 'cisco'],
  modifie: true,
  interface: true,
  champs: [
    { id: 'ciscoInterface', label: 'Interface (une seule)', type: 'text', default: 'Fa0/7', help: 'Un port d’accès (jamais un trunk). Fa0/7, Gi0/1 ou Gi1/0/7.' },
    { id: 'ciscoActionPs', label: 'Action', type: 'select', default: 'activer', options: [['activer', 'Activer la protection sur ce port'], ['remettre', 'Remettre ce port en service (après correction de la cause)']] },
    { id: 'ciscoMaxMac', label: 'Nombre maximum d’adresses MAC', type: 'number', default: 1, min: 1, max: 20 },
    { id: 'ciscoSticky', label: 'Apprentissage sticky (les adresses apprises sont conservées dans la configuration)', type: 'checkbox', default: true },
    { id: 'ciscoViolation', label: 'Mode de violation', type: 'select', default: 'shutdown', options: [['shutdown', 'shutdown — coupe le port (défaut)'], ['restrict', 'restrict — jette les trames et journalise'], ['protect', 'protect — jette sans journaliser']] },
    { id: 'ciscoMacFixe', label: 'Adresse MAC autorisée (facultative)', type: 'text', default: '', help: 'Une adresse déjà connue à autoriser explicitement.' },
    { id: 'ciscoNettoyage', label: 'Nettoyage ciblé avant remise en service', type: 'select', default: 'aucun', options: [['aucun', 'Aucun'], ['dynamic', 'Adresses dynamiques de CE port'], ['sticky', 'Adresses sticky de CE port']] },
  ],
  parse(v, ctx) {
    const errors = {}; const val = {};
    const i = validerInterfaceIos(v.ciscoInterface, ctx.materiel); if (!i.ok) errors.ciscoInterface = i.error; else val.interface = i.valeur;
    const a = validerChoixCisco(v.ciscoActionPs, ['activer', 'remettre'], 'L’action'); if (!a.ok) errors.ciscoActionPs = a.error; else val.action = a.valeur;
    const n = Number(v.ciscoMaxMac);
    if (!Number.isInteger(n) || n < 1 || n > 20) errors.ciscoMaxMac = 'Le maximum : un entier de 1 à 20.'; else val.max = n;
    val.sticky = v.ciscoSticky === true || v.ciscoSticky === 'true';
    const vi = validerChoixCisco(v.ciscoViolation, VIOLATIONS, 'Le mode de violation'); if (!vi.ok) errors.ciscoViolation = vi.error; else val.violation = vi.valeur;
    const nt = validerChoixCisco(v.ciscoNettoyage, ['aucun', 'dynamic', 'sticky'], 'Le nettoyage'); if (!nt.ok) errors.ciscoNettoyage = nt.error; else val.nettoyage = nt.valeur;
    if (String(v.ciscoMacFixe ?? '').trim() !== '') {
      const m = validerMacIos(v.ciscoMacFixe); if (!m.ok) errors.ciscoMacFixe = m.error; else val.mac = m.valeur;
    }
    return { errors, val };
  },
  phrase: (val) => `CONFIGURER ${val.interface}`,
  lecture: (val) => [
    { n: 'Le port doit etre un port d acces (Administrative Mode: static access) :', c: `show interfaces ${val.interface} switchport` },
    { n: 'Etat actuel de la protection :', c: `show port-security interface ${val.interface}` },
    { n: 'Adresses deja securisees :', c: 'show port-security address' },
    { n: 'Etat du port :', c: `show interfaces ${val.interface} status` },
  ],
  config: (val) => {
    if (val.action === 'remettre') {
      const l = [{ n: 'A faire seulement apres avoir identifie et retire (ou autorise) l appareil en cause. Ne vise que CE port : aucune remise en service generale.' }];
      if (val.nettoyage === 'dynamic') l.push(`clear port-security dynamic interface ${val.interface}`);
      if (val.nettoyage === 'sticky') l.push(`clear port-security sticky interface ${val.interface}`);
      l.push('configure terminal', `interface ${val.interface}`, ' shutdown', ' no shutdown', 'end');
      return l;
    }
    const l = ['configure terminal', `interface ${val.interface}`, ' switchport mode access', ' switchport port-security', ` switchport port-security maximum ${val.max}`, ` switchport port-security violation ${val.violation}`];
    if (val.sticky) l.push(' switchport port-security mac-address sticky');
    if (val.mac) l.push(` switchport port-security mac-address ${val.mac}`);
    l.push('end');
    return l;
  },
  verification: (val) => [
    { n: 'Controle apres modification :', c: `show port-security interface ${val.interface}` },
    { c: `show interfaces ${val.interface} status` },
    { c: 'show port-security address' },
  ],
  retour: (val) => (val.action === 'remettre'
    ? [{ n: 'Une remise en service ne se defait pas : si le port est de nouveau coupe, la cause est toujours la. Relis show port-security interface.' }]
    : ['configure terminal', `interface ${val.interface}`, ' no switchport port-security violation', ' no switchport port-security maximum', ' no switchport port-security mac-address sticky', ' no switchport port-security', 'end', { n: 'Les adresses sticky deja apprises restent dans la configuration : retire-les UNE PAR UNE avec « no switchport port-security mac-address sticky <adresse> » apres lecture, jamais en masse.' }]),
  prereqs: [...PREREQ_COMMUN, 'Le port est un port d’ACCÈS statique : port-security est refusé sur un port dynamique ou un trunk.', 'Pour la remise en service : la cause de la violation est connue et traitée (appareil retiré ou autorisé).'],
  commonErrors: [
    { message: 'Command rejected: FastEthernet0/7 is a dynamic port.', cause: 'Le port n’est pas en mode access statique.', fix: 'L’assistant pose « switchport mode access » avant port-security ; vérifie qu’il ne s’agit pas d’un trunk.' },
    { message: 'Le port se recoupe aussitôt après la remise en service', cause: 'L’appareil en cause est toujours branché.', fix: 'Retire-le ou autorise son adresse, puis recommence.' },
    { message: 'Le PC existant se retrouve coupé après activation', cause: 'Le maximum est dépassé (ex. PC + téléphone IP sur un maximum de 1).', fix: 'Choisis le maximum adapté (2 pour PC + téléphone) avant d’activer.' },
    ERREUR_MODE,
  ],
  gui: ['Ouvre la console.', 'Vérifie que le port est un port d’accès.', 'Entre dans « interface <port> », active port-security, règle maximum, violation et sticky.', 'Pour une remise en service : corrige la cause, puis « shutdown » et « no shutdown » sur ce port seulement.'],
  checks: ['show port-security interface <port> : « Port Security : Enabled », mode et maximum attendus.', 'Après remise en service : Port Status « Secure-up », état « connected ».'],
  verifyAfter: ['L’appareil légitime communique.', 'Un appareil non autorisé provoque la violation prévue (à tester en laboratoire).'],
  rollback: RETOUR_STANDARD('Les commandes « no » désactivent la protection ; les adresses sticky apprises se retirent une par une.', 'show port-security interface <port>\nshow port-security address', 'configure terminal\ninterface <port>\n no switchport port-security\nend'),
  source: SRC.portSecurity.url,
  sources: [SRC.portSecurity, SRC.interfaces, SRC.layer2Commandes],
  cisco: {
    probleme: 'N’importe qui peut brancher un appareil sur une prise murale ; port-security limite les adresses MAC admises par port.',
    utilite: 'Une protection par port, avec un mode de violation choisi, limite l’impact d’un branchement non autorisé sans toucher aux autres ports.',
    exemple: 'La prise du bureau 214 (Fa0/7) n’accepte qu’une adresse apprise en sticky ; un portable inconnu coupe le port, et le technicien le remet en service après avoir retiré le portable.',
    lecture: ['show interfaces <port> switchport : le port est-il en accès statique.', 'show port-security interface <port> : état actuel.', 'show port-security address : adresses déjà sécurisées.'],
    effets: ['switchport mode access + switchport port-security : active la protection sur ce port.', 'maximum, violation, mac-address sticky : politique du port.', 'Remise en service : shutdown puis no shutdown sur CE port, après nettoyage ciblé éventuel.'],
    attendu: ['« Port Security : Enabled » et le maximum choisi.', 'Après remise en service : « Port Status : Secure-up ».'],
    limites: ['Aucune fermeture automatique des autres ports, aucune suppression générale des adresses sécurisées.', 'Le comportement exact (conversion dynamique → sticky, messages) varie selon le modèle.', 'Packet Tracer implémente port-security de façon simplifiée.'],
  },
});

export const toolsCiscoSocle = [
  ciscoModes, ciscoIdentification, ciscoConsoleSsh, ciscoSauvegarde, ciscoGestionIp,
  ciscoInterfaceEtat, ciscoTableMac, ciscoPortSecurityEtat, ciscoPortSecurityConfig,
];
