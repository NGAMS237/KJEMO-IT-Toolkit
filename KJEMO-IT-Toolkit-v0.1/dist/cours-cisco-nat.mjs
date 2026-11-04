/**
 * cours-cisco-nat.mjs — KJEMO-CISCO-NAT-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Cours « Architecture réseau II — NAT, PAT, types d'adresses et récapitulation »
 * rangé dans « Mes cours Cisco » : les notes de cours du jour (NAT, PAT,
 * redirection de port, sockets, NAT64, multidiffusion, anycast, types d'adresses
 * IPv6, SLAAC et DHCP, récapitulation de routes) et un rappel des sujets déjà
 * vus (VTP, VLAN, RIP, SSH, sécurité des ports, routes statiques et flottantes).
 *
 * Chaque parcours renvoie vers des fiches : il ne contient aucune commande. Les
 * fiches déjà au catalogue sont citées, jamais refaites.
 */
import { RESUME_NAT } from './cours-resume-cisco-nat.mjs';

const f = (fiche, etape = null, extra = {}) => ({ fiche, etape, ...extra });
const AVERTISSEMENT = 'Les fiches expliquent comment faire dans la console d’un équipement de laboratoire (Packet Tracer ou matériel) ; elles ne remplacent pas ton énoncé et ne prouvent rien : « coché » veut seulement dire « je l’ai fait ». Le Toolkit n’exécute aucune commande et rien n’a été essayé dans Packet Tracer ni sur du matériel réel.';

export const COURS_CISCO_NAT_PARCOURS = [
  {
    id: 'cisco-nat-adressage-recap',
    plateformes: ['Cisco'],
    titre: 'Architecture réseau II — NAT, PAT, types d’adresses et récapitulation',
    resume: 'NAT statique, dynamique et PAT, redirection de port, sockets, NAT64, multidiffusion (télévision IP d’un hôtel), anycast, types d’adresses IPv6, SLAAC et DHCP, récapitulation de routes, et un rappel de VTP, VLAN, RIP, SSH, sécurité des ports et routes statiques.',
    source: 'Notes de cours de l’étudiant (liste de sujets du jour, sans commandes), complétées d’après la documentation Cisco IOS (NAT, routes statiques, Null0, RIP) et les standards d’adressage IPv6. Les parcours et le résumé sont écrits dans nos mots ; NAT64 est expliqué sans fiche, car sa syntaxe varie selon la plateforme.',
    avertissement: AVERTISSEMENT,
    rappelCours: RESUME_NAT,
    parcours: [
      {
        lettre: 'A',
        titre: 'NAT, PAT et redirection de port',
        resume: 'Comprendre le vocabulaire, choisir le bon type de NAT, le configurer, puis lire la table de traduction.',
        prerequis: [f('cours-rt-interface-ip', 2, { titre: 'Poser l’adresse', pourquoi: 'les interfaces interne et externe du routeur doivent déjà être adressées.' })],
        items: [
          { id: 'A1', texte: 'Expliquer le NAT et ses quatre adresses : inside local, inside global, outside global, outside local.', refs: [f('cours-nat-verifier', 1, { titre: 'Lire la table' })], note: 'Voir le schéma « Vocabulaire NAT » dans le résumé pliable.' },
          { id: 'A2', texte: 'Distinguer le NAT statique, le NAT dynamique et le PAT.', refs: [f('cours-nat-statique', 1, { titre: 'Écrire la correspondance' }), f('cours-nat-dynamique', 3, { titre: 'Relier la liste' }), f('cours-nat-pat', 2, { titre: 'en surcharge' })] },
          { id: 'A3', texte: 'Publier un serveur interne avec un NAT statique.', refs: [f('cours-nat-statique', 1, { titre: 'Écrire la correspondance' }), f('cours-nat-statique', 2, { titre: 'Marquer' })], note: 'Les deux marques « ip nat inside » et « ip nat outside » sont indispensables.' },
          { id: 'A4', texte: 'Donner l’accès à Internet à tout un réseau avec une seule adresse publique (PAT).', refs: [f('cours-nat-pat', 1, { titre: 'Désigner qui' }), f('cours-nat-pat', 2, { titre: 'en surcharge' }), f('cours-nat-pat', 3, { titre: 'Marquer' })] },
          { id: 'A5', texte: 'Ouvrir un port précis vers un serveur interne (redirection de port).', refs: [f('cours-nat-redirection-port', 1, { titre: 'Rediriger un port' })] },
          { id: 'A6', texte: 'Lire la table NAT et vider les traductions dynamiques.', refs: [f('cours-nat-verifier', 1, { titre: 'Lire la table' }), f('cours-nat-verifier', 3, { titre: 'Effacer' })] },
          { id: 'A7', texte: 'Expliquer un socket (8.8.1.1:80) et la plage des ports dynamiques.', refs: [], couvert: false, note: 'Question de cours, sans commande : une adresse IP plus un port ; les clients prennent un port entre 49152 et 65535. Voir le schéma « Socket et plages de ports ».' },
          { id: 'A8', texte: 'Décrire le routeur NAT64.', refs: [], couvert: false, note: 'Question de cours : NAT64 traduit entre IPv6 et IPv4 grâce au préfixe 64:ff9b::/96. Aucune fiche de commandes : la syntaxe change selon la plateforme et n’existe pas dans Packet Tracer.' },
        ],
      },
      {
        lettre: 'B',
        titre: 'Adresses : modes de diffusion, types IPv6, SLAAC et DHCP',
        resume: 'Monodiffusion, multidiffusion (la télévision IP d’un hôtel), anycast, les six types d’adresses IPv6 et comment un poste obtient son adresse.',
        prerequis: [],
        items: [
          { id: 'B1', texte: 'Comparer monodiffusion, diffusion, multidiffusion et anycast avec un exemple réel de chacun.', refs: [], couvert: false, note: 'Question de cours, sans commande : voir les schémas « Modes de diffusion » et « Télévision IP d’un hôtel » dans le résumé pliable.' },
          { id: 'B2', texte: 'Expliquer pourquoi un hôtel diffuse sa télévision IP en multidiffusion.', refs: [], couvert: false, note: 'Un seul flux vers le groupe, copié seulement vers les chambres qui l’ont rejoint (IGMP) ; en monodiffusion, un flux par chambre. Aucune commande.' },
          { id: 'B3', texte: 'Reconnaître les types d’adresses IPv6 : globale, link-local, bouclage, non spécifiée, locale unique, IPv4 intégré.', refs: [f('cours-ipv6-adresser-interface', 2, { titre: 'Poser les adresses' })], note: 'La fiche pose une adresse globale et une link-local ; les autres types sont à connaître pour l’examen (schéma « Types d’adresses IPv6 et leurs usages »).' },
          { id: 'B4', texte: 'Comparer SLAAC, DHCPv6 sans état et avec état.', refs: [f('cours-dhcp6-slaac', 2, { titre: 'adresse globale' }), f('cours-dhcp6-sans-etat', 1), f('cours-dhcp6-avec-etat', 1)], note: 'Détails dans le cours de la semaine 9 (indicateurs A, O et M).' },
          { id: 'B5', texte: 'Faire obtenir une adresse IPv4 par DHCP à un réseau distant.', refs: [f('cours-dhcp4-relais', 1, { titre: 'Désigner le serveur' })] },
        ],
      },
      {
        lettre: 'C',
        titre: 'Routes statiques, récapitulatives et flottantes',
        resume: 'Poser des routes statiques, les regrouper en une route récapitulative et prévoir une route de secours.',
        prerequis: [],
        items: [
          { id: 'C1', texte: 'Poser une route statique vers un réseau distant.', refs: [f('cours-rt-statique', 2, { titre: 'Ajouter la route' })] },
          { id: 'C2', texte: 'Regrouper plusieurs réseaux contigus en une route récapitulative.', refs: [f('cours-route-recap-statique', 1, { titre: 'Repérer' }), f('cours-route-recap-statique', 2, { titre: 'récapitulative' })], note: 'Recalcule la plage : quatre /24 voisins donnent un /22 (schéma « Récapitulation de routes »).' },
          { id: 'C3', texte: 'Poser la route récapitulative vers Null0 sur le routeur qui possède les réseaux.', refs: [f('cours-route-recap-statique', 3, { titre: 'Null0' })] },
          { id: 'C4', texte: 'Faire annoncer un résumé par RIPv2.', refs: [f('cours-route-recap-rip', 2, { titre: 'Annoncer le résumé' })] },
          { id: 'C5', texte: 'Poser une route flottante de secours.', refs: [f('cours-rt-defaut-flottante', 3, { titre: 'route de secours' })] },
        ],
      },
      {
        lettre: 'D',
        titre: 'Rappel express : VTP, VLAN, RIP, SSH et sécurité des ports',
        resume: 'Les cinq sujets de la liste de notes déjà couverts par des fiches : un renvoi vers chacune.',
        prerequis: [],
        items: [
          { id: 'D1', texte: 'VTP : serveur, domaine et clients.', refs: [f('cours-vtp-reseau', 2, { titre: 'Choisir le mode' })] },
          { id: 'D2', texte: 'VLAN : créer et nommer un VLAN.', refs: [f('cisco-creer-vlan', 3, { titre: 'Créer le VLAN' })] },
          { id: 'D3', texte: 'RIP : démarrer RIPv2 et annoncer les réseaux.', refs: [f('cours-rip-configurer', 1, { titre: 'Démarrer RIP' }), f('cours-rip-configurer', 2, { titre: 'Annoncer les réseaux' })] },
          { id: 'D4', texte: 'SSH : nom, domaine, clé RSA, compte et lignes.', refs: [f('scenario-cisco-ssh-commutateur', 5, { titre: 'clé RSA' })] },
          { id: 'D5', texte: 'Sécurité des ports : maximum, sticky et sanction.', refs: [f('cours-sw-portsec', 2, { titre: 'Activer la sécurité' }), f('cours-sw-portsec', 5, { titre: 'sanction' })] },
        ],
      },
    ],
    soutien: [
      { fiche: 'cours-rt-tester', pourquoi: 'ping et traceroute pour vérifier qu’une traduction ou une route récapitulative laisse passer le trafic.' },
      { fiche: 'cisco-enregistrer-config', pourquoi: 'enregistrer la configuration quand le travail est validé.' },
      { fiche: 'cours-nat-verifier', pourquoi: 'lire la table NAT quand un poste ne sort pas.' },
    ],
    ambiguites: [
      { id: 'N-1', sujet: 'Sens de « route recap »', texte: 'La note de cours dit « route recap » : nous l’avons lue comme « route récapitulative » (résumé de routes, route summary), ce que l’étudiant a confirmé. Elle n’indique ni protocole ni exemple : la fiche donne la route statique, avec la variante Null0, et la variante RIPv2.' },
      { id: 'N-2', sujet: 'Commandes NAT64', texte: 'La note mentionne un routeur NAT64 sans commande. La syntaxe change selon la plateforme (IOS ou IOS XE, routeurs de service) et NAT64 n’est pas disponible dans Packet Tracer : le cours l’explique en théorie et ne propose pas de fiche, plutôt que de présenter une syntaxe non vérifiée.' },
      { id: 'N-3', sujet: 'Adresses d’exemple', texte: 'Les adresses publiques des fiches viennent des plages de documentation (203.0.113.0/24, 198.51.100.0/24) ; l’exemple de socket 8.8.1.1:80 vient des notes. Remplace-les par celles de ton énoncé.' },
    ],
  },
];
