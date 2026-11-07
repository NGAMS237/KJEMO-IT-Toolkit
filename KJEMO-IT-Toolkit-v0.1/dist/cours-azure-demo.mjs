/**
 * cours-azure-demo.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Le montage de démonstration de l'enseignant (schéma « VNETDemo ») rangé en
 * parcours à cocher. Comme les autres cours : aucune commande ici, seulement
 * des liens vers l'étape de la fiche `cours-az-tp-demo-webapp-stockage-prive`
 * (méthode CLI pour la numérotation ; la fiche a aussi le portail et PowerShell).
 */
import { versCli } from './cours-azure-cli.mjs';
const F = 'cours-az-tp-demo-webapp-stockage-prive';
const r = (etape, titre) => ({ fiche: F, etape, titre });

const COURS_AZURE_DEMO_PARCOURS_BRUT = [{
  id: 'azure-tp-demo-webapp-stockage',
  plateformes: ['Azure'],
  titre: 'Démo : application web et stockage par point privé (VNETDemo)',
  resume: 'Le montage vu en classe : l’application reçoit le trafic public, sort par un sous-réseau d’intégration, et joint un compte de stockage par un point de terminaison privé. À faire en portail d’abord, puis en PowerShell ou en CLI pour t’exercer.',
  source: 'Schéma de démonstration donné par l’enseignant (VNETDemo, WebApp, AppServiceOutboundSubnet, StorageSubnet, Private Endpoint, Storage Account) et pages Microsoft Learn sur l’intégration au réseau virtuel et les points de terminaison privés. Résumé dans nos mots.',
  avertissement: 'La fiche explique comment faire dans le portail, en PowerShell et en Azure CLI ; rien n’a été exécuté dans un abonnement Azure et les écrans sont des reconstitutions, pas des captures. « Coché » veut seulement dire « je l’ai fait ». Les ressources sont facturées tant qu’elles existent : supprime le groupe de ressources à la fin.',
  rappelCours: {
    titre: 'Rappel — entrant public, sortant et stockage privés',
    intro: 'À relire avant de commencer : quel trafic est public, quel trafic reste dans le VNet, et pourquoi il faut deux sous-réseaux.',
    essentiel: [
      'Le trafic ENTRANT vers l’application reste public : n’importe qui joint <nom>.azurewebsites.net, sauf restriction d’accès ou point privé entrant.',
      'Le trafic SORTANT passe par l’intégration au réseau virtuel : l’application sort du sous-réseau délégué à Microsoft.Web/serverFarms, avec ses routes et ses règles.',
      'Le point de terminaison privé vit dans un AUTRE sous-réseau, non délégué : il donne au compte de stockage une adresse privée dans le VNet.',
      'Le nom du compte ne se résout en adresse privée que si la zone DNS privée privatelink.blob.core.windows.net est liée au VNet : sans elle, l’application part vers l’adresse publique, qui est fermée.',
    ],
    sections: [
      { id: 'deux-sous-reseaux', titre: 'Pourquoi deux sous-réseaux', points: [
        'Un sous-réseau délégué à App Service ne peut accueillir que cette intégration : on ne peut pas y mettre de point privé.',
        'Le sous-réseau du point privé accueille une carte réseau par sous-ressource (blob, file, fichier, table) : prévois une plage suffisante.',
      ] },
      { id: 'ordre', titre: 'L’ordre qui évite de se bloquer', points: [
        'Crée le contenu (conteneur, fichier) AVANT de fermer l’accès public du compte : ensuite ton poste n’y a plus accès.',
        'Teste depuis l’application (SSH ou console) : c’est la seule machine du montage qui est dans le VNet.',
      ] },
    ],
    commandes: [
      { cmd: 'az webapp vnet-integration add', sert: 'Branche l’application sur un sous-réseau : son trafic sortant part de là.' },
      { cmd: 'az network private-endpoint create', sert: 'Crée le point privé du compte de stockage dans le sous-réseau choisi.' },
      { cmd: 'az storage account update --public-network-access Disabled', sert: 'Ferme l’accès public du compte : seul le point privé le joint.' },
    ],
    pieges: [
      'Mettre le point privé dans le sous-réseau délégué : la création est refusée.',
      'Oublier le lien de la zone DNS privée au VNet : le nom se résout encore en adresse publique.',
      'Fermer l’accès public avant de déposer le fichier : tu ne peux plus le déposer depuis ton poste.',
    ],
    questions: [
      { q: 'Quel trafic de ce montage est public, et lequel ne quitte jamais le VNet ?', r: 'Le trafic entrant vers l’application est public. Le trafic sortant vers le stockage passe par l’intégration au VNet puis par le point privé : il ne quitte jamais le réseau.' },
      { q: 'Pourquoi le point de terminaison privé ne va-t-il pas dans AppServiceOutboundSubnet ?', r: 'Ce sous-réseau est délégué à App Service et ne peut accueillir que l’intégration ; le point privé va dans un autre sous-réseau, non délégué (StorageSubnet).' },
      { q: 'Que se passe-t-il si la zone privatelink.blob.core.windows.net n’est pas liée au VNet ?', r: 'Le nom du compte se résout encore en adresse publique : l’application part vers l’adresse publique, qui est fermée, et l’accès échoue.' },
    ],
  },
  parcours: [
    { lettre: 'A', titre: 'Le réseau', resume: 'Un groupe de ressources, un VNet et ses deux sous-réseaux.', items: [
      { id: 'A1', texte: 'Créer le groupe de ressources.', refs: [r(2, 'groupe de ressources')], assistants: [] },
      { id: 'A2', texte: 'Créer VNETDemo avec AppServiceOutboundSubnet et le déléguer à App Service.', refs: [r(3, 'réseau virtuel')], assistants: [] },
      { id: 'A3', texte: 'Créer StorageSubnet, non délégué, pour le point privé.', refs: [r(4, 'sous-réseau du point privé')], assistants: [] },
    ] },
    { lettre: 'B', titre: 'L’application et le stockage', resume: 'Le compte avec son conteneur, l’application, et son branchement au VNet.', items: [
      { id: 'B1', texte: 'Créer le compte de stockage et le conteneur.', refs: [r(5, 'compte de stockage')], assistants: [] },
      { id: 'B2', texte: 'Créer le plan B1 et l’application web.', refs: [r(6, 'application web')], assistants: [] },
      { id: 'B3', texte: 'Intégrer l’application au sous-réseau de sortie.', refs: [r(7, 'Intégrer l’application')], assistants: [] },
      { id: 'B4', texte: 'Faire passer tout le trafic sortant par le VNet.', refs: [r(8, 'trafic sortant')], assistants: [] },
    ] },
    { lettre: 'C', titre: 'L’accès privé', resume: 'Le point privé, la zone DNS, le fichier, puis la fermeture de l’accès public.', items: [
      { id: 'C1', texte: 'Créer le point de terminaison privé (blob) dans StorageSubnet.', refs: [r(9, 'point de terminaison privé')], assistants: [] },
      { id: 'C2', texte: 'Créer la zone DNS privée, la lier au VNet et inscrire le point.', refs: [r(10, 'zone DNS privée')], assistants: [] },
      { id: 'C3', texte: 'Déposer un fichier dans le conteneur AVANT de fermer l’accès.', refs: [r(11, 'Déposer un fichier')], assistants: [] },
      { id: 'C4', texte: 'Fermer l’accès public du compte de stockage.', refs: [r(12, 'Fermer l’accès public')], assistants: [] },
    ] },
    { lettre: 'D', titre: 'La preuve', resume: 'Vérifier que le chemin est privé et qu’Internet est refusé.', items: [
      { id: 'D1', texte: 'Depuis l’application : le nom du compte se résout en adresse privée.', refs: [r(13, 'Contrôler la résolution')], assistants: [] },
      { id: 'D2', texte: 'Depuis ton poste : l’accès au compte est refusé.', refs: [], couvert: false, note: 'Ouvre l’adresse d’un blob dans ton navigateur : une erreur d’accès (403) prouve que le compte n’est plus public. C’est un constat à faire, pas une commande.' },
    ] },
  ],
}];

export const COURS_AZURE_DEMO_PARCOURS = versCli(COURS_AZURE_DEMO_PARCOURS_BRUT);
