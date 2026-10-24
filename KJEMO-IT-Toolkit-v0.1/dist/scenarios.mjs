/**
 * scenarios.mjs — UX-COMMANDES-PROCEDURES-02 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les SCÉNARIOS : des procédures qui relient plusieurs tâches, voire plusieurs
 * équipements, en réutilisant les étapes élémentaires par RÉFÉRENCE
 * (`reprendre`, procedures.mjs) et non par copie.
 *
 * Ce qu'est un scénario, par opposition aux autres natures de contenu :
 *   commande      une commande isolée, avec son résultat (LOT 7)
 *   procédure     une tâche en quelques étapes sur UN équipement
 *   scénario      plusieurs tâches, souvent plusieurs équipements, avec des
 *                 hypothèses de départ et une topologie
 *   assistant     le formulaire et le script complet
 *
 * Règles communes :
 *  - un secret n'est JAMAIS saisi dans le navigateur : la commande s'arrête
 *    avant le secret (`secret: true`), qui se tape sur l'équipement ;
 *  - une copie groupée n'est jamais proposée quand elle serait trompeuse
 *    (interaction, plusieurs équipements, plusieurs machines) ;
 *  - rien n'est exécuté : ces commandes sont relues contre la documentation,
 *    jamais essayées sur un équipement réel.
 */

import { reprendre } from './procedures.mjs';
import { PROCEDURES_PILOTES } from './procedures-pilotes.mjs';
import { PROCEDURES_VAGUE2 } from './procedures-vague2.mjs';
import { PROCEDURES_VAGUE3 } from './procedures-vague3.mjs';

const ELEMENTAIRES = [...PROCEDURES_PILOTES, ...PROCEDURES_VAGUE2, ...PROCEDURES_VAGUE3];
const re = (ref, surcharges) => reprendre(ELEMENTAIRES, ref, surcharges);

const V_SCENARIO = 'Scénario relu contre la documentation de l’éditeur et contre le contrat des fiches ; aucune commande n’a été exécutée sur un équipement, un serveur ou un poste réel.';
const C1000 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst1000/software/release/15-2_7_e';
const MAN = 'https://manpages.ubuntu.com/manpages/noble/en';
const MS = 'https://learn.microsoft.com';

const sw = (cmd, extra = {}) => ({ invite: 'Switch#', cmd, ...extra });
const swc = (cmd, extra = {}) => ({ invite: 'Switch(config)#', cmd, ...extra });
const swi = (cmd) => ({ invite: 'Switch(config-if)#', cmd });
const swl = (cmd) => ({ invite: 'Switch(config-line)#', cmd });
const rt = (cmd) => ({ invite: 'Router#', cmd });
const rtc = (cmd) => ({ invite: 'Router(config)#', cmd });
const rti = (cmd) => ({ invite: 'Router(config-if)#', cmd });
const rts = (cmd) => ({ invite: 'Router(config-subif)#', cmd });
const sh = (cmd) => ({ invite: '$', cmd });
const term = (cmd) => ({ invite: null, cmd });

// ===========================================================================
// A. Cisco — configurer SSH sur un commutateur
// ===========================================================================

const SSH_CISCO = {
  id: 'scenario-cisco-ssh-commutateur',
  kind: 'scenario',
  titre: 'Configurer SSH sur un commutateur Cisco',
  categorie: 'Réseau et Cisco',
  resume: 'Active l’accès SSH version 2 sur un commutateur Cisco IOS, le teste depuis un poste, puis seulement après ce test restreint les lignes à SSH. Le mot de passe se tape sur le commutateur : il ne passe jamais par cette page.',
  effet: 'interruption',
  intentions: ['configurer ssh sur un switch cisco', 'activer ssh cisco', 'ssh commutateur', 'transport input ssh', 'crypto key generate rsa', 'remplacer telnet par ssh', 'accès distant sécurisé commutateur'],
  motsCles: ['ssh', 'cisco', 'ios', 'switch', 'commutateur', 'vty', 'telnet', 'rsa', 'username', 'login local', 'scénario'],
  hypotheses: [
    'Tu es connecté **en console** au commutateur et tu gardes cette session ouverte jusqu’à la fin.',
    'Le commutateur a déjà une adresse de gestion joignable depuis ton poste (interface VLAN de gestion configurée) ; ce scénario ne la crée pas.',
    'L’image IOS contient les fonctions de chiffrement (une version « K9 ») ; l’étape 1 le vérifie.',
    'Un poste client avec la commande `ssh` (Linux, macOS, Windows 10 et suivants) est sur le même réseau.',
    'Tu choisis toi-même le nom d’hôte, le domaine et le compte : rien n’est repris d’un laboratoire.',
  ],
  topologie: 'Un poste client relié au commutateur par le réseau de gestion. Le commutateur garde sa console pendant toute la procédure ; seuls les accès à distance (lignes vty) changent.',
  params: [
    { id: 'hote', label: 'nom d’hôte du commutateur', type: 'hote', exemple: 'SW-ACCES1', aide: 'Différent de « Switch » : IOS refuse de générer la clé avec le nom par défaut.' },
    { id: 'domaine', label: 'nom de domaine', type: 'fqdn', exemple: 'lab.exemple.test', aide: 'Un domaine à toi (ex. celui de l’école ou du laboratoire) ; il entre dans le nom de la clé.' },
    { id: 'utilisateur', label: 'nom du compte administrateur', type: 'identifiant', exemple: 'admin', aide: 'Lettres, chiffres, point, tiret. Le mot de passe se tape sur le commutateur.' },
    { id: 'ipSwitch', label: 'adresse de gestion du commutateur', type: 'ipv4', exemple: '192.168.1.2', aide: 'L’adresse à laquelle le poste se connecte en SSH.' },
  ],
  methodes: [{
    id: 'scenario',
    equipements: [
      { id: 'sw', label: 'Sur le commutateur', methode: 'ios', privileges: 'Console, mode privilégié (enable).' },
      { id: 'cl', label: 'Sur le poste client', methode: 'powershell', privileges: 'Un terminal ordinaire (la commande ssh est la même partout).' },
    ],
    privileges: 'Console du commutateur en mode privilégié ; un terminal sur le poste client.',
    etapes: [
      // --- Lire ---------------------------------------------------------------
      { equipement: 'sw', phase: 'Lire l’état et les prérequis', titre: 'Lire la version, SSH et les lignes', effet: 'lecture', mode: 'Mode privilégié',
        explication: 'Trois lectures : l’image contient-elle le chiffrement, SSH est-il déjà actif, quelle plage de lignes vty existe.',
        lignes: [sw('show version | include K9'), sw('show ip ssh'), sw('show running-config | section line vty')],
        attendu: 'Une ligne avec « K9 » (image avec chiffrement). « SSH Disabled » avant la procédure. Les lignes « line vty 0 4 » et/ou « line vty 5 15 » : note la plage exacte.',
        important: 'Pas de « K9 » : cet IOS ne sait pas faire SSH, arrête-toi ici. Si ta plage vty n’est pas 0 15, adapte-la dans les étapes qui la citent (le Toolkit ne l’invente pas).' },
      // --- Configurer SSH ------------------------------------------------------
      re({ procedure: 'cisco-creer-vlan', methode: 'ios', etape: 1, titre: 'Entrer en mode de configuration' }, { equipement: 'sw', phase: 'Activer SSH sur le commutateur' }),
      { equipement: 'sw', phase: 'Activer SSH sur le commutateur', titre: 'Nommer le commutateur et son domaine', effet: 'modification', mode: 'Configuration globale',
        explication: 'La clé RSA porte le nom d’hôte et le domaine : les deux doivent exister, et le nom d’hôte ne doit plus être « Switch ».',
        lignes: [swc('hostname {{hote}}'), swc('ip domain-name {{domaine}}')],
        attendu: 'L’invite prend immédiatement le nouveau nom d’hôte. Aucun autre message.',
        important: 'Le nom d’hôte change l’invite et les journaux ; préviens les personnes qui supervisent cet équipement.' },
      { equipement: 'sw', phase: 'Activer SSH sur le commutateur', titre: 'Créer le compte local', effet: 'modification', mode: 'Configuration globale',
        explication: 'Crée un compte de niveau 15. La ligne est volontairement incomplète : tu tapes le mot de passe toi-même, juste après « secret ».',
        lignes: [swc('username {{utilisateur}} privilege 15 secret', { secret: true })],
        interactions: [{ secret: true, attend: 'La ligne copiée se termine par « secret » suivi d’une espace.', reponds: 'Tape ton mot de passe sur la console, puis Entrée. Il est stocké haché ; il s’affiche en clair pendant la frappe, vérifie que personne ne regarde.' }],
        attendu: 'Aucun message : l’invite revient. Le mot de passe n’apparaît jamais dans la configuration, seulement son empreinte.',
        important: 'Niveau 15 = accès complet. Pour un compte limité, retire « privilege 15 » (le compte devra alors passer par enable).' },
      { equipement: 'sw', phase: 'Activer SSH sur le commutateur', titre: 'Générer la clé RSA de l’hôte', effet: 'modification', mode: 'Configuration globale',
        explication: 'Génère la clé que les clients vérifieront à la première connexion. 2048 bits est le minimum raisonnable aujourd’hui.',
        lignes: [swc('crypto key generate rsa modulus 2048')],
        interactions: [{ attend: 'Do you really want to replace them? [yes/no] (seulement si une clé existe déjà)', reponds: 'no — sauf si tu veux volontairement la remplacer : tous les clients devront alors accepter la nouvelle empreinte.' }],
        attendu: '« The key modulus size is 2048 bits », puis un message de génération (quelques secondes), puis « %SSH-5-ENABLED: SSH 1.99 has been enabled ».',
        important: 'Remplacer une clé existante coupe les clients qui l’ont mémorisée : réponds « no » par défaut.' },
      { equipement: 'sw', phase: 'Activer SSH sur le commutateur', titre: 'Exiger SSH version 2 et le compte local sur les lignes', effet: 'modification', mode: 'Configuration globale',
        explication: 'SSH version 2, puis les lignes vty authentifient avec le compte local. Le transport reste inchangé pour l’instant : on teste avant de restreindre.',
        lignes: [swc('ip ssh version 2'), swc('line vty 0 15'), swl('login local'), swl('end')],
        attendu: 'Aucun message d’erreur ; l’invite revient au mode privilégié.',
        important: '« login local » s’applique aussi à Telnet : sans compte local valide, personne ne se connecte par les lignes vty. Le compte existe déjà (étape précédente).' },
      { equipement: 'sw', phase: 'Vérifier SSH sur le commutateur', titre: 'Vérifier que SSH est actif en version 2', effet: 'lecture', mode: 'Mode privilégié', verification: true,
        explication: 'Confirme l’état avant de tester depuis le poste.',
        lignes: [sw('show ip ssh')],
        attendu: '« SSH Enabled - version 2.0 » (la formulation varie légèrement selon la version d’IOS).' },
      // --- Tester --------------------------------------------------------------
      { equipement: 'cl', phase: 'Tester depuis le poste client', titre: 'Se connecter en SSH', effet: 'lecture', verification: true,
        explication: 'Première connexion de ce poste : le client affiche l’empreinte de la clé du commutateur et demande de l’accepter.',
        lignes: [term('ssh {{utilisateur}}@{{ipSwitch}}')],
        interactions: [
          { attend: 'Are you sure you want to continue connecting (yes/no)? (première connexion)', reponds: 'yes — seulement si l’adresse est bien celle du commutateur visé.' },
          { attend: 'Password:', reponds: 'Le mot de passe du compte, tapé dans le terminal (rien ne s’affiche).' },
        ],
        attendu: 'Tu obtiens l’invite du commutateur (le nom d’hôte choisi suivi de « > » ou de « # »). Garde cette session et la console ouvertes.',
        important: 'Si le client refuse de négocier (« no matching key exchange method » ou « no matching host key type »), voir « Dépanner » plus bas : ne contourne pas sans lire.' },
      // --- Restreindre ---------------------------------------------------------
      re({ procedure: 'cisco-creer-vlan', methode: 'ios', etape: 1, titre: 'Entrer en mode de configuration' }, { equipement: 'sw', phase: 'Restreindre l’accès à SSH (après le test)' }),
      { equipement: 'sw', phase: 'Restreindre l’accès à SSH (après le test)', titre: 'N’autoriser que SSH sur les lignes', effet: 'interruption', mode: 'Configuration globale',
        explication: 'À ne faire qu’une fois le test réussi. Telnet cesse de fonctionner immédiatement.',
        lignes: [swc('line vty 0 15'), swl('transport input ssh'), swl('end')],
        attendu: 'Aucun message ; l’invite revient au mode privilégié.',
        important: 'Garde la console (et la session SSH du test) ouvertes tant que la nouvelle session n’a pas réussi : un oubli ici te laisse à la porte.' },
      { equipement: 'cl', phase: 'Vérifier la restriction', titre: 'Ouvrir une NOUVELLE session SSH', effet: 'lecture', verification: true,
        explication: 'Une nouvelle connexion prouve que la restriction n’a pas coupé l’accès voulu ; l’ancienne session n’en dit rien.',
        lignes: [term('ssh {{utilisateur}}@{{ipSwitch}}')],
        interactions: [{ attend: 'Password:', reponds: 'Le mot de passe du compte, tapé dans le terminal.' }],
        attendu: 'Même résultat qu’au premier test, sans question sur l’empreinte.' },
      { equipement: 'sw', phase: 'Vérifier la restriction', titre: 'Relire les lignes et SSH', effet: 'lecture', mode: 'Mode privilégié', verification: true,
        explication: 'La configuration courante doit montrer SSH seul sur les lignes.',
        lignes: [sw('show running-config | section line vty'), sw('show ip ssh')],
        attendu: '« transport input ssh » sous les lignes vty ; « SSH Enabled - version 2.0 ».' },
      // --- Enregistrer (séparé) ------------------------------------------------
      re({ procedure: 'cisco-enregistrer-config', methode: 'ios', etape: 1, titre: 'Enregistrer' },
        { equipement: 'sw', phase: 'Enregistrer sur le commutateur', facultatif: true, persistance: true, titre: 'Enregistrer la configuration (facultatif)',
          explication: 'Sans cette commande, le nom d’hôte, le compte, la clé RSA et la restriction disparaissent au redémarrage : la clé est dans la configuration de démarrage, pas ailleurs. À faire seulement quand les deux tests ont réussi.' }),
    ],
    verification: ['Une nouvelle session SSH s’ouvre avec le compte créé.', '« transport input ssh » figure sous les lignes vty.'],
    retour: 'Pour rouvrir Telnet temporairement : « transport input ssh telnet » sous les lignes vty, avec la console ouverte. Le Toolkit ne propose pas de supprimer la clé RSA (« crypto key zeroize rsa » coupe SSH).',
    depannage: [
      { symptome: '« Please define a hostname other than Switch » ou « Please define a domain-name first »', cause: 'La clé RSA ne se génère qu’avec un nom d’hôte propre et un domaine.', action: 'Refais l’étape « Nommer le commutateur et son domaine », puis régénère la clé.' },
      { symptome: 'Le client ne se connecte pas (« Connection refused » ou délai dépassé)', cause: 'Adresse de gestion injoignable, SSH inactif ou port filtré.', action: 'Teste l’adresse avec ping depuis le poste, puis relis « show ip ssh » et l’état de l’interface de gestion.' },
      { symptome: '« no matching key exchange method found » ou « no matching host key type found »', cause: 'Un client récent refuse les algorithmes anciens d’un IOS ancien.', action: 'La bonne correction est la mise à jour d’IOS. Autoriser un algorithme ancien côté client affaiblit la négociation : limite-le à cet équipement et retire-le après la mise à jour.' },
      { symptome: '« Permission denied » ou « Access denied » au mot de passe', cause: 'Compte ou mot de passe différent, ou « login local » sans compte.', action: 'Reviens sur la console : relis « show running-config | include username » et recrée le mot de passe en retapant la commande du compte.' },
    ],
  }],
  assistant: null,
  sources: [
    { label: 'Catalyst 1000 — Configuring Secure Shell', url: `${C1000}/configuration_guides/sec/b_1527e_security_c1000_cg/configuring_secure_shell.html` },
    { label: 'Catalyst 1000 — Security Command Reference', url: `${C1000}/command_reference/b_1527e_1000_cr/security_commands.html` },
  ],
  validation: V_SCENARIO,
};

// ===========================================================================
// B. Cisco — plusieurs VLAN et routage inter-VLAN (routeur « sur un bâton »)
// ===========================================================================

const COLONNES_PLAN = [
  { id: 'vlan', label: 'VLAN', type: 'vlan', exemple: '10', aide: 'De 2 à 4094 (hors 1002-1005).' },
  { id: 'nom', label: 'Nom', type: 'nomVlan', exemple: 'ADMIN', aide: 'Une lettre d’abord, sans espace.' },
  { id: 'reseau', label: 'Réseau', type: 'ipv4', exemple: '192.168.10.0', aide: 'Adresse du réseau (se termine par 0 pour /24).' },
  { id: 'prefixe', label: 'Préfixe', type: 'prefixe', exemple: '24', aide: '8 à 30.' },
  { id: 'passerelle', label: 'Passerelle', type: 'ipv4', exemple: '192.168.10.1', aide: 'Adresse du routeur dans ce VLAN.' },
  { id: 'ports', label: 'Ports d’accès', type: 'listeInterfaces', exemple: 'Fa0/1,Fa0/2', aide: 'Séparés par des virgules (ex. Fa0/1,Fa0/2).' },
  { id: 'poste', label: 'Poste de test', type: 'ipv4', exemple: '192.168.10.10', aide: 'Adresse à donner au poste de ce VLAN.' },
];

const INTER_VLAN = {
  id: 'scenario-cisco-inter-vlan-routeur',
  kind: 'scenario',
  titre: 'Routage inter-VLAN avec un routeur (plusieurs VLAN)',
  categorie: 'Réseau et Cisco',
  resume: 'Crée plusieurs VLAN sur un commutateur, affecte leurs ports d’accès, relie le commutateur à un routeur par un trunk et configure une sous-interface par VLAN sur le routeur. Le plan est validé avant de produire la moindre commande.',
  effet: 'interruption',
  intentions: ['routage inter-vlan', 'plusieurs vlan routeur', 'router on a stick', 'sous-interface dot1q', 'trunk vers routeur', 'communication entre vlan', 'encapsulation dot1q'],
  motsCles: ['vlan', 'inter-vlan', 'routeur', 'router-on-a-stick', 'trunk', 'sous-interface', 'dot1q', 'encapsulation', 'passerelle', 'cisco', 'scénario'],
  hypotheses: [
    'Topologie : **un** commutateur de niveau 2, **un** routeur relié par **un seul** lien (trunk), et un poste Windows par VLAN.',
    'Le routeur est la passerelle de chaque VLAN : une sous-interface par VLAN, numérotée comme le VLAN (convention de cette fiche). Le routage entre VLAN passe par les réseaux directement connectés, sans route statique.',
    'Le commutateur n’est pas client VTP (il crée ses VLAN lui-même) et garde son VLAN natif par défaut (1).',
    'Tu connais les interfaces de ton matériel : les noms ne sont jamais repris d’un laboratoire, tu les saisis.',
    'Variante avec un commutateur de niveau 3 (interfaces VLAN et « ip routing ») : **non développée** dans cette fiche.',
  ],
  topologie: 'Poste VLAN A et poste VLAN B → ports d’accès du commutateur → trunk (un seul lien) → interface du routeur, découpée en sous-interfaces (une par VLAN, passerelle de chaque réseau).',
  params: [
    { id: 'plan', label: 'plan des VLAN', type: 'table', min: 2, max: 6, colonnes: COLONNES_PLAN, coherence: 'planVlan', exclure: ['trunkSw'],
      agregats: [{ id: 'vlansPlan', colonne: 'vlan' }],
      exemple: [
        { vlan: '10', nom: 'ADMIN', reseau: '192.168.10.0', prefixe: '24', passerelle: '192.168.10.1', ports: 'Fa0/1,Fa0/2', poste: '192.168.10.10' },
        { vlan: '20', nom: 'LABO', reseau: '192.168.20.0', prefixe: '24', passerelle: '192.168.20.1', ports: 'Fa0/3', poste: '192.168.20.10' },
      ] },
    { id: 'trunkSw', label: 'port du commutateur vers le routeur', type: 'interfaceIos', exemple: 'Gi0/1', aide: 'Le port (Gi0/1, Gi1/0/1…) relié au routeur. Il ne doit figurer dans aucune ligne du plan.' },
    { id: 'routeurItf', label: 'interface du routeur vers le commutateur', type: 'interfaceRouteur', exemple: 'Gi0/0', aide: 'L’interface physique du routeur relié au commutateur (Gi0/0, Gi0/0/0…).' },
    { id: 'carte', label: 'nom de la carte réseau des postes', type: 'nom', exemple: 'Ethernet', aide: 'Le même nom sur chaque poste de test (voir Get-NetIPConfiguration).' },
  ],
  methodes: [{
    id: 'scenario',
    equipements: [
      { id: 'sw', label: 'Sur le commutateur', methode: 'ios', privileges: 'Mode privilégié (enable).' },
      { id: 'rt', label: 'Sur le routeur', methode: 'ios', privileges: 'Mode privilégié (enable).' },
      { id: 'pc', label: 'Sur le poste Windows', methode: 'powershell', multiple: true, privileges: 'PowerShell en administrateur, sur chaque poste de test.' },
    ],
    privileges: 'Mode privilégié sur le commutateur et sur le routeur ; PowerShell en administrateur sur chaque poste.',
    etapes: [
      // --- Lire ---------------------------------------------------------------
      re({ procedure: 'cisco-voir-vlans', methode: 'ios', etape: 0 }, { equipement: 'sw', phase: 'Lire l’état du commutateur', verification: false, titre: 'Lister les VLAN et leurs ports' }),
      re({ procedure: 'cisco-voir-trunks', methode: 'ios', etape: 0 }, { equipement: 'sw', phase: 'Lire l’état du commutateur', verification: false }),
      // --- Commutateur ---------------------------------------------------------
      re({ procedure: 'cisco-creer-vlan', methode: 'ios', etape: 1, titre: 'Entrer en mode de configuration' }, { equipement: 'sw', phase: 'Configurer le commutateur' }),
      re({ procedure: 'cisco-creer-vlan', methode: 'ios', etape: 2, lignes: [0, 1] },
        { equipement: 'sw', phase: 'Configurer le commutateur', titre: 'Créer les VLAN et les nommer', mode: 'Configuration globale',
          explication: 'Un « vlan » puis un « name » par ligne du plan. Un VLAN qui existe déjà est ouvert, et son nom est remplacé.',
          repeter: { table: 'plan', groupe: 'VLAN {{vlan}} ({{nom}})' } }),
      re({ procedure: 'cisco-affecter-port-vlan', methode: 'ios', etape: 2, lignes: [1, 2, 3] },
        { equipement: 'sw', phase: 'Configurer le commutateur', titre: 'Affecter les ports d’accès', mode: 'Configuration globale',
          explication: 'Chaque port du plan passe en mode access dans son VLAN. Les postes branchés perdent leur connexion le temps de renouveler leur adresse.',
          repeter: { table: 'plan', liste: 'ports', alias: 'interface', groupe: 'VLAN {{vlan}}' } }),
      { equipement: 'sw', phase: 'Configurer le commutateur', titre: 'Configurer le trunk vers le routeur', effet: 'interruption', mode: 'Configuration globale',
        explication: 'Le port devient un trunk qui transporte exactement les VLAN du plan, puis on revient au mode privilégié.',
        lignes: [swc('interface {{trunkSw}}'), swi('switchport mode trunk'), swi('switchport trunk allowed vlan {{vlansPlan}}'), swi('end')],
        attendu: 'Aucun message d’erreur ; l’invite revient à « Switch# ».',
        important: 'Cette commande REMPLACE la liste des VLAN autorisés sur le trunk (elle n’ajoute pas). Si le commutateur répond « Invalid input » à « switchport mode trunk », ce modèle demande d’abord « switchport trunk encapsulation dot1q » ; si tu es connecté par ce port, tu perds la session.' },
      // --- Routeur -------------------------------------------------------------
      re({ procedure: 'cisco-creer-vlan', methode: 'ios', etape: 1, titre: 'Entrer en mode de configuration', hote: 'Router' }, { equipement: 'rt', phase: 'Configurer le routeur' }),
      { equipement: 'rt', phase: 'Configurer le routeur', titre: 'Activer l’interface physique', effet: 'modification', mode: 'Configuration globale',
        explication: 'L’interface physique n’a pas d’adresse : elle porte seulement les sous-interfaces. Il suffit de l’activer.',
        lignes: [rtc('interface {{routeurItf}}'), rti('no shutdown'), rti('exit')],
        attendu: 'Un message « changed state to up » apparaît quand le lien est établi, si le commutateur est branché.',
        important: 'Ne donne pas d’adresse IP à l’interface physique : la passerelle de chaque VLAN est portée par sa sous-interface.' },
      { equipement: 'rt', phase: 'Configurer le routeur', titre: 'Créer une sous-interface par VLAN', effet: 'modification', mode: 'Configuration globale',
        explication: 'Pour chaque ligne du plan : sous-interface numérotée comme le VLAN, encapsulation 802.1Q de ce VLAN, et l’adresse de la passerelle avec son masque.',
        lignes: [rtc('interface {{routeurItf}}.{{vlan}}'), rts('encapsulation dot1Q {{vlan}}'), rts('ip address {{passerelle}} {{masque}}')],
        repeter: { table: 'plan', groupe: 'VLAN {{vlan}} — {{passerelle}}/{{prefixe}}' },
        attendu: 'Aucun message d’erreur. Un chevauchement de réseaux serait refusé par IOS (« overlaps with … ») : le plan est déjà contrôlé ici.' },
      { equipement: 'rt', phase: 'Configurer le routeur', titre: 'Sortir de la configuration', effet: 'lecture', mode: 'Configuration de sous-interface',
        explication: 'Revient au mode privilégié ; la configuration courante est déjà active.',
        lignes: [rts('end')], attendu: 'L’invite redevient « Router# ».' },
      // --- Vérifications locales ----------------------------------------------
      re({ procedure: 'cisco-voir-vlans', methode: 'ios', etape: 0 }, { equipement: 'sw', phase: 'Vérifier le commutateur', verification: true, titre: 'Relire les VLAN et leurs ports',
        attendu: 'Chaque VLAN du plan est « active » et porte ses ports d’accès.' }),
      re({ procedure: 'cisco-voir-trunks', methode: 'ios', etape: 0 }, { equipement: 'sw', phase: 'Vérifier le commutateur', verification: true, titre: 'Relire le trunk',
        attendu: 'Le port vers le routeur est « trunking » ; la liste « allowed » contient les VLAN du plan ; la liste « forwarding » les contient aussi (sinon un VLAN n’est pas transporté).' }),
      { equipement: 'rt', phase: 'Vérifier le routeur', titre: 'Relire les interfaces et les routes connectées', effet: 'lecture', mode: 'Mode privilégié', verification: true,
        explication: 'Chaque sous-interface doit être « up » avec l’adresse de sa passerelle, et chaque réseau doit apparaître comme directement connecté.',
        lignes: [rt('show ip interface brief'), rt('show ip route connected')],
        attendu: 'Les sous-interfaces portent les adresses du plan, état « up / up » ; une route « C » (connectée) par réseau.' },
      // --- Postes --------------------------------------------------------------
      re({ procedure: 'windows-ip-fixe', methode: 'powershell', etape: 1, titre: 'Désactiver DHCP sur la carte' },
        { equipement: 'pc', phase: 'Configurer les postes', repeter: { table: 'plan', separe: true, groupe: 'Poste du VLAN {{vlan}} ({{nom}}) — {{poste}}' } }),
      re({ procedure: 'windows-ip-fixe', methode: 'powershell', etape: 2, lier: { ip: 'poste' } },
        { equipement: 'pc', phase: 'Configurer les postes', repeter: { table: 'plan', separe: true, groupe: 'Poste du VLAN {{vlan}} ({{nom}}) — {{poste}}' } }),
      // --- De bout en bout -----------------------------------------------------
      re({ procedure: 'tester-ping', methode: 'powershell', etape: 0, lier: { cible: 'passerelle' } },
        { equipement: 'pc', phase: 'Tester de bout en bout', titre: 'Joindre la passerelle de son VLAN', repeter: { table: 'plan', separe: true, groupe: 'Poste du VLAN {{vlan}} → passerelle {{passerelle}}' },
          attendu: 'Les paquets reçoivent une réponse : le poste, le port d’accès, le trunk et la sous-interface fonctionnent pour ce VLAN.' }),
      re({ procedure: 'tester-ping', methode: 'powershell', etape: 0, lier: { cible: 'suivant_poste' } },
        { equipement: 'pc', phase: 'Tester de bout en bout', titre: 'Joindre le poste d’un autre VLAN', repeter: { table: 'plan', separe: true, groupe: 'Poste du VLAN {{vlan}} → poste du VLAN {{suivant_vlan}} ({{suivant_poste}})' },
          attendu: 'Les paquets reçoivent une réponse : le routage entre les deux VLAN fonctionne.',
          important: 'Si la passerelle répond mais pas l’autre poste, le pare-feu de Windows bloque très probablement la réponse au ping sur ce poste (profil réseau public) : ce n’est pas forcément le routage.' }),
      // --- Enregistrer (séparé) ------------------------------------------------
      re({ procedure: 'cisco-enregistrer-config', methode: 'ios', etape: 1, titre: 'Enregistrer' },
        { equipement: 'sw', phase: 'Enregistrer le commutateur', facultatif: true, persistance: true, titre: 'Enregistrer la configuration du commutateur (facultatif)',
          explication: 'Les ports et le trunk n’existent que dans la configuration courante ; les VLAN de la plage normale peuvent déjà être dans vlan.dat selon le mode VTP. À faire seulement quand les tests de bout en bout ont réussi.' }),
      re({ procedure: 'cisco-enregistrer-config', methode: 'ios', etape: 1, titre: 'Enregistrer', hote: 'Router' },
        { equipement: 'rt', phase: 'Enregistrer le routeur', facultatif: true, persistance: true, titre: 'Enregistrer la configuration du routeur (facultatif)',
          explication: 'Sans cette commande, les sous-interfaces disparaissent au redémarrage du routeur. À faire seulement quand les tests de bout en bout ont réussi.' }),
    ],
    verification: ['Chaque poste joint la passerelle de son VLAN, puis un poste d’un autre VLAN.', '« show interfaces trunk » liste les VLAN du plan en « forwarding ».'],
    retour: 'Le Toolkit ne supprime pas de VLAN ni de sous-interface. Pour défaire une sous-interface : « no interface <interface>.<VLAN> » sur le routeur ; pour retirer un port du VLAN : « no switchport access vlan » sur le commutateur (le port retourne au VLAN 1).',
    depannage: [
      { symptome: 'Un poste ne joint pas sa passerelle', cause: 'Port non affecté au bon VLAN, VLAN absent de la liste du trunk, ou poste mal configuré.', action: 'Relis « show vlan brief » (port dans le bon VLAN) puis « show interfaces trunk » (VLAN en « forwarding »).' },
      { symptome: 'Les passerelles répondent mais pas d’un VLAN à l’autre', cause: 'Le routeur ne route pas entre ses sous-interfaces, ou le pare-feu du poste filtre le ping.', action: 'Relis « show ip route connected » sur le routeur ; autorise la réponse au ping sur le poste visé pour le test.' },
      { symptome: 'La sous-interface reste « down »', cause: 'Interface physique éteinte ou trunk non établi.', action: 'Relis « show ip interface brief » ; l’interface physique doit être « up », et le port du commutateur « trunking ».' },
    ],
  }],
  assistant: null,
  sources: [
    { label: 'Catalyst 1000 — Configuring VLANs', url: `${C1000}/configuration_guides/vlan/b_1527e_vlan_c1000_cg/configuring_vlan.html` },
    { label: 'Catalyst 1000 — VLAN Command Reference', url: `${C1000}/command_reference/b_1527e_1000_cr/vlan_commands.html` },
    { label: 'Catalyst 1000 — Interface Characteristics (access et trunk)', url: `${C1000}/configuration_guides/int_hw/b_1527e_int_and_hw_c1000_cg/configuring_interface_characteristics.html` },
  ],
  validation: V_SCENARIO,
};

// ===========================================================================
// C. Linux/Bash — installer, configurer et vérifier un service SSH
// ===========================================================================

const SSH_LINUX = {
  id: 'scenario-linux-ssh',
  kind: 'scenario',
  titre: 'Installer et vérifier un serveur SSH sous Linux',
  categorie: 'Linux et services réseau',
  resume: 'Installe OpenSSH sur un Debian ou un Ubuntu, vérifie sa configuration avant de la recharger, contrôle le service et le port, puis teste la connexion depuis un poste. Ta session d’origine reste ouverte pendant toute modification d’accès.',
  effet: 'modification',
  intentions: ['installer ssh linux', 'installer openssh-server', 'configurer ssh ubuntu', 'vérifier sshd', 'serveur ssh debian', 'sshd -t', 'tester ssh depuis un client'],
  motsCles: ['ssh', 'sshd', 'openssh', 'openssh-server', 'ubuntu', 'debian', 'apt', 'systemctl', 'port 22', 'ufw', 'scénario'],
  hypotheses: [
    'Distribution **Debian ou Ubuntu** (gestionnaire apt, service « ssh »). Les autres familles de distributions ne sont pas couvertes par cette fiche.',
    'Tu as un compte avec **sudo** et une session ouverte sur le serveur (console ou SSH existant) que tu **gardes ouverte** pendant toute la procédure.',
    'Aucun réglage d’authentification n’est modifié ici : la fiche ne désactive ni les clés, ni la vérification de l’empreinte, et n’active ni le mot de passe ni la connexion de root.',
    'Le serveur a accès aux dépôts de sa distribution.',
  ],
  topologie: 'Un serveur Linux et un poste client qui se connecte à son port SSH. Le pare-feu éventuel du serveur doit laisser passer ce port.',
  params: [
    { id: 'utilisateur', label: 'compte qui se connectera', type: 'identifiant', exemple: 'etudiant', aide: 'Un compte existant sur le serveur (lettres, chiffres, point, tiret).' },
    { id: 'adresse', label: 'adresse ou nom du serveur', type: 'identifiant', exemple: '192.168.1.20', aide: 'Une adresse IP ou un nom (sans espace).' },
    { id: 'port', label: 'port SSH du serveur', type: 'port', exemple: '22', aide: '22 par défaut. Si tu l’as changé, relis-le à l’étape de lecture de la configuration.' },
  ],
  methodes: [{
    id: 'scenario',
    equipements: [
      { id: 'srv', label: 'Sur le serveur Linux', methode: 'linux', privileges: 'Un compte sudo, session ouverte et conservée.' },
      { id: 'cl', label: 'Sur le poste client', methode: 'linux', privileges: 'Un terminal ordinaire (la commande ssh est la même sous Linux, macOS et Windows).' },
    ],
    privileges: 'sudo sur le serveur ; un terminal ordinaire sur le client.',
    etapes: [
      { equipement: 'srv', phase: 'Vérifier la distribution', titre: 'Lire la distribution', effet: 'lecture',
        explication: 'Confirme que c’est un Debian ou un Ubuntu avant d’utiliser apt.',
        lignes: [sh('grep -E \'^(PRETTY_NAME|ID_LIKE|VERSION_ID)=\' /etc/os-release')],
        attendu: 'Une ligne PRETTY_NAME contenant « Debian » ou « Ubuntu ». Une autre distribution : ne continue pas avec cette fiche.' },
      { equipement: 'srv', phase: 'Installer OpenSSH', titre: 'Actualiser la liste des paquets', effet: 'modification',
        explication: 'Lit les dépôts de la distribution pour installer la version actuelle du paquet.',
        lignes: [sh('sudo apt update')],
        attendu: 'La liste se télécharge ; « All packages are up to date » ou le nombre de paquets mis à jour disponibles.' },
      { equipement: 'srv', phase: 'Installer OpenSSH', titre: 'Installer le serveur OpenSSH', effet: 'modification',
        explication: 'Installe le paquet (rien si déjà présent) et crée les clés de l’hôte à la première installation.',
        lignes: [sh('sudo apt install openssh-server')],
        interactions: [{ attend: 'Do you want to continue? [Y/n] (si des paquets s’ajoutent)', reponds: 'Y — après avoir lu la liste des paquets installés.' }],
        attendu: 'Le paquet est installé ; le service démarre de lui-même sur Debian et Ubuntu.' },
      { equipement: 'srv', phase: 'Installer OpenSSH', titre: 'Activer le service au démarrage', effet: 'modification',
        explication: 'Active le service et le démarre tout de suite, pour qu’il revienne après un redémarrage.',
        lignes: [sh('sudo systemctl enable --now ssh')],
        attendu: 'Aucun message d’erreur (Debian et Ubuntu nomment le service « ssh »).' },
      { equipement: 'srv', phase: 'Contrôler la configuration', titre: 'Tester la syntaxe sans rien recharger', effet: 'lecture', verification: true,
        explication: 'sshd -t lit la configuration et signale les erreurs sans toucher au service en cours.',
        lignes: [sh('sudo sshd -t')],
        attendu: 'Aucun affichage : la configuration est valide. Une erreur indique le fichier et la ligne à corriger — ne recharge pas avant.' },
      { equipement: 'srv', phase: 'Contrôler la configuration', titre: 'Lire la configuration réellement appliquée', effet: 'lecture', verification: true,
        explication: 'sshd -T affiche les valeurs effectives, tous fichiers confondus (y compris /etc/ssh/sshd_config.d/).',
        lignes: [sh('sudo sshd -T | grep -E \'^(port|permitrootlogin|passwordauthentication|pubkeyauthentication) \'')],
        attendu: 'Les quatre lignes avec leurs valeurs. Relis-les : la fiche ne les change pas, et n’en affaiblit aucune.' },
      { equipement: 'srv', phase: 'Contrôler la configuration', titre: 'Recharger après une modification (facultatif)', effet: 'modification', facultatif: true,
        explication: 'À faire seulement si tu as modifié la configuration. Le rechargement n’a lieu que si le test réussit (« && »), et il ne coupe pas les sessions ouvertes.',
        lignes: [sh('sudo sshd -t && sudo systemctl reload ssh')],
        attendu: 'Aucun message. Si sshd -t échoue, rien n’est rechargé.',
        important: 'Garde ta session ouverte et teste une NOUVELLE connexion depuis le client (étape suivante) avant de fermer l’ancienne.' },
      { equipement: 'srv', phase: 'Vérifier le service et le port', titre: 'Lire l’état du service', effet: 'lecture', verification: true,
        explication: 'Le service doit être actif.',
        lignes: [sh('systemctl status ssh --no-pager')],
        attendu: '« Active: active (running) ».' },
      { equipement: 'srv', phase: 'Vérifier le service et le port', titre: 'Contrôler le démarrage automatique', effet: 'lecture', verification: true,
        explication: 'Savoir si le service reviendra après un redémarrage.',
        lignes: [sh('systemctl is-enabled ssh')],
        attendu: '« enabled ».' },
      { equipement: 'srv', phase: 'Vérifier le service et le port', titre: 'Contrôler que le port écoute', effet: 'lecture', verification: true,
        explication: 'Liste ce qui écoute sur ce port TCP, avec le processus.',
        lignes: [sh('sudo ss -ltnp \'sport = :{{port}}\'')],
        attendu: 'Une ligne « LISTEN » avec le processus sshd, sur le port choisi (souvent en 0.0.0.0 et en [::]).' },
      { equipement: 'srv', phase: 'Pare-feu', titre: 'Lire l’état du pare-feu ufw', effet: 'lecture',
        explication: 'Si ufw est actif et que le port n’est pas autorisé, le client n’arrivera pas jusqu’au serveur.',
        lignes: [sh('sudo ufw status')],
        attendu: '« Status: inactive » (rien à faire) ou une liste de règles où le port SSH figure. Si ufw n’est pas installé, la commande est introuvable : ce n’est pas ton pare-feu.' },
      { equipement: 'srv', phase: 'Pare-feu', titre: 'Autoriser le port SSH dans ufw (facultatif)', effet: 'modification', facultatif: true,
        explication: 'À faire seulement si ufw est actif et que le port n’y figure pas.',
        lignes: [sh('sudo ufw allow {{port}}/tcp')],
        attendu: '« Rule added ».',
        important: 'N’active pas ufw (« ufw enable ») sans avoir autorisé le port avant : tu te couperais du serveur si tu y es connecté par SSH.' },
      { equipement: 'srv', phase: 'Empreinte de l’hôte', titre: 'Lire l’empreinte de la clé du serveur', effet: 'lecture',
        explication: 'Tu compareras cette empreinte avec celle que le client affiche à la première connexion : c’est ce qui prouve que tu parles au bon serveur.',
        lignes: [sh('ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub')],
        attendu: 'Une ligne « 256 SHA256:… (ED25519) ». Note l’empreinte. Si le fichier n’existe pas, utilise l’autre clé de /etc/ssh/ (ssh_host_*_key.pub).' },
      { equipement: 'cl', phase: 'Tester depuis le client', titre: 'Se connecter en SSH', effet: 'lecture', verification: true,
        explication: 'Le client affiche l’empreinte à la première connexion ; compare-la à celle relevée sur le serveur.',
        lignes: [{ invite: null, cmd: 'ssh -p {{port}} {{utilisateur}}@{{adresse}}' }],
        interactions: [
          { attend: 'Are you sure you want to continue connecting (yes/no/[fingerprint])?', reponds: 'yes — seulement si l’empreinte affichée est identique à celle relevée sur le serveur.' },
          { attend: 'Mot de passe ou phrase secrète de la clé', reponds: 'Tape-le dans le terminal (rien ne s’affiche). Cette fiche ne le voit pas et ne le garde pas.' },
        ],
        attendu: 'Tu obtiens l’invite du serveur, sous le compte choisi.',
        important: 'Ne désactive jamais la vérification de l’empreinte (StrictHostKeyChecking) pour « faire passer » la connexion.' },
      { equipement: 'srv', phase: 'Relire le journal', titre: 'Retrouver la connexion dans le journal', effet: 'lecture', verification: true,
        explication: 'Le journal du service confirme la connexion réussie, ou donne la raison d’un refus.',
        lignes: [sh('sudo journalctl -u ssh -n 20 --no-pager')],
        attendu: 'Une ligne « Accepted … for <compte> from <adresse> » après la connexion ; en cas d’échec, la raison (« Failed password », « Connection closed »…).' },
    ],
    verification: ['« systemctl status ssh » indique « active (running) ».', 'Le client obtient une session sous le compte choisi, empreinte vérifiée.'],
    retour: 'Pour retirer le serveur : « sudo apt remove openssh-server » (le Toolkit ne le propose pas si tu es connecté par SSH). Pour retirer la règle ufw ajoutée : « sudo ufw delete allow <port>/tcp ».',
    depannage: [
      { symptome: '« Permission denied (publickey) »', cause: 'Le serveur n’accepte que les clés, et celle du client n’y est pas.', action: 'Ajoute la clé publique du client au compte (ssh-copy-id). N’active pas PasswordAuthentication pour contourner.' },
      { symptome: '« Connection refused » ou délai dépassé', cause: 'Service arrêté, mauvais port, ou pare-feu.', action: 'Relis l’état du service, le port avec « ss -ltnp » et ufw. Teste depuis le serveur lui-même avec « ssh localhost » pour isoler le réseau.' },
      { symptome: '« WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! »', cause: 'La clé du serveur n’est plus celle mémorisée : serveur réinstallé, ou machine différente à la même adresse.', action: 'Ne supprime pas la ligne de known_hosts à l’aveugle : compare d’abord l’empreinte relevée sur le serveur ; ce n’est un changement légitime que si tu l’as provoqué.' },
    ],
  }],
  assistant: null,
  sources: [
    { label: 'sshd(8)', url: `${MAN}/man8/sshd.8.html` },
    { label: 'sshd_config(5)', url: `${MAN}/man5/sshd_config.5.html` },
    { label: 'ssh(1)', url: `${MAN}/man1/ssh.1.html` },
    { label: 'ssh-keygen(1)', url: `${MAN}/man1/ssh-keygen.1.html` },
    { label: 'ss(8)', url: `${MAN}/man8/ss.8.html` },
    { label: 'systemctl(1)', url: `${MAN}/man1/systemctl.1.html` },
  ],
  validation: V_SCENARIO,
};

// ===========================================================================
// D. Windows — diagnostiquer la connexion réseau d'un poste
// ===========================================================================

const DIAG = (methode) => {
  const m = methode;
  const P = (proc, etape, lier, extra) => re({ procedure: proc, methode: m, etape, ...(lier ? { lier } : {}) }, extra);
  return [
    P('windows-voir-ip', 0, null, { phase: 'Adresse et passerelle', titre: 'Afficher la configuration IP', attendu: 'Une adresse IPv4 valide (pas en 169.254.x.x) et une passerelle. Une adresse 169.254.x.x signale que le poste n’a pas obtenu d’adresse (DHCP injoignable).' }),
    P('tester-ping', 0, { cible: 'passerelle' }, { phase: 'Joindre le réseau', titre: 'Joindre la passerelle', attendu: 'Les paquets reçoivent une réponse : le poste joint son réseau local.' }),
    P('tester-ping', 0, { cible: 'distant' }, { phase: 'Joindre le réseau', titre: 'Joindre une machine hors du réseau local', attendu: 'Les paquets reçoivent une réponse : le routage vers l’extérieur du réseau local fonctionne. Un échec ici alors que la passerelle répond oriente vers le routeur ou le pare-feu, pas vers le poste.' }),
    P('resoudre-nom-dns', 0, { nom: 'nomTest' }, { phase: 'Résoudre un nom', titre: 'Résoudre un nom', attendu: 'Le nom donne une adresse IP. Un échec alors que le ping par adresse réussit pointe vers le DNS.' }),
    P('vider-cache-dns', 0, null, { phase: 'Résoudre un nom', titre: 'Vider le cache DNS (si la résolution a échoué)', facultatif: true, explication: 'À faire seulement si la résolution échoue ou renvoie une ancienne adresse : le cache peut garder une réponse périmée. Sans effet sur la configuration réseau.' }),
    P('resoudre-nom-dns', 0, { nom: 'nomTest' }, { phase: 'Résoudre un nom', titre: 'Résoudre à nouveau le nom', verification: true, attendu: 'Le nom donne maintenant la bonne adresse.' }),
  ];
};

const DIAG_WINDOWS = {
  id: 'scenario-windows-diagnostic-reseau',
  kind: 'scenario',
  titre: 'Diagnostiquer la connexion réseau d’un poste Windows',
  categorie: 'Réseau',
  resume: 'Suit le chemin de la connexion, de l’adresse du poste jusqu’au nom résolu : adresse et passerelle, ping du réseau local puis d’une machine distante, résolution de nom. La seule modification possible, vider le cache DNS, est facultative.',
  effet: 'lecture',
  intentions: ['diagnostic réseau windows', 'diagnostiquer le réseau windows', 'diagnostic réseau d’un poste', 'pas de connexion internet windows', 'dépanner le réseau d’un poste', 'ping passerelle dns', 'le poste n’a pas internet', 'ipconfig ping nslookup'],
  motsCles: ['diagnostic', 'réseau', 'ipconfig', 'ping', 'dns', 'nslookup', 'passerelle', 'windows', 'dépannage', 'scénario'],
  hypotheses: [
    'Un poste **Windows 10 ou 11** dont tu veux comprendre pourquoi une machine ou un nom est inaccessible.',
    'Tu connais l’adresse de la passerelle (elle apparaît à la première étape) et une machine distante à tester.',
    'Les étapes se lisent dans l’ordre : chaque réussite écarte une cause, et le premier échec situe le problème.',
  ],
  topologie: 'Le poste, sa passerelle (le routeur du réseau local), une machine distante et le serveur DNS qui résout les noms.',
  params: [
    { id: 'passerelle', label: 'adresse de la passerelle', type: 'ipv4', exemple: '192.168.1.1', aide: 'Lue à la première étape (« Passerelle par défaut »).' },
    { id: 'distant', label: 'machine distante à tester', type: 'identifiant', exemple: '8.8.8.8', aide: 'Une adresse IP hors du réseau local, ou un nom.' },
    { id: 'nomTest', label: 'nom à résoudre', type: 'identifiant', exemple: 'www.exemple.test', aide: 'Un nom que le poste devrait pouvoir résoudre.' },
  ],
  methodes: ['powershell', 'cmd'].map((m) => ({
    id: m,
    privileges: m === 'powershell' ? 'Utilisateur ordinaire ; le vidage du cache DNS demande un PowerShell en administrateur.' : 'Utilisateur ordinaire ; le vidage du cache DNS demande une invite en administrateur.',
    etapes: DIAG(m),
    verification: ['Le poste a une adresse valide, joint sa passerelle puis une machine distante, et résout le nom.'],
    retour: 'Aucune modification n’est faite, sauf le vidage facultatif du cache DNS, qui se reconstitue tout seul.',
  })),
  assistant: null,
  sources: [
    { label: 'Test-Connection', url: `${MS}/powershell/module/microsoft.powershell.management/test-connection` },
    { label: 'ping (Windows)', url: `${MS}/windows-server/administration/windows-commands/ping` },
    { label: 'Resolve-DnsName', url: `${MS}/powershell/module/dnsclient/resolve-dnsname` },
    { label: 'ipconfig', url: `${MS}/windows-server/administration/windows-commands/ipconfig` },
  ],
  validation: V_SCENARIO,
};

export const SCENARIOS = [SSH_CISCO, INTER_VLAN, SSH_LINUX, DIAG_WINDOWS];
