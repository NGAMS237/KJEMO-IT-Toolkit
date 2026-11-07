/**
 * azure-multi-base.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * Méthodes « gui » (portail Azure) et « powershell » (module Az) des fiches de base :
 * groupe de ressources, verrou, rôle, VNet, sous-réseau, plan d'adressage, IP, VM.
 * Les écrans sont des reconstitutions, pas des captures ; rien n'a été exécuté dans Azure.
 */
import { lec, mod, des, itr, ps, gui } from './cours-outils.mjs';

const PRIV_GUI = 'Compte Azure avec le rôle Contributeur sur le groupe de ressources visé (ou sur l’abonnement) ; connecté par toi-même au portail Azure.';
const PRIV_GUI_LECTURE = 'Compte Azure avec au moins le rôle Lecteur sur le groupe de ressources ; connecté par toi-même au portail Azure.';
const PRIV_PS = 'Module Az installé ; connecté par toi-même avec Connect-AzAccount ; rôle Contributeur sur le groupe de ressources visé.';
const PRIV_PS_LECTURE = 'Module Az installé ; connecté par toi-même avec Connect-AzAccount ; au moins le rôle Lecteur sur le groupe de ressources.';

const psContexte = () => lec('Se connecter et vérifier l’abonnement', 'Connecte-toi toi-même (fenêtre de connexion) et confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
  [ps('Connect-AzAccount'), ps('Get-AzContext | Format-List Name, Subscription')], 'Le nom de l’abonnement actif. Si ce n’est pas le bon, change-le avec Set-AzContext.');

const guiContexte = () => gui('Vérifier l’abonnement actif', 'lecture', 'Avant de créer quoi que ce soit, confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
  ['Connecte-toi au portail Azure avec ton compte.', 'En haut à droite, clique ton nom puis **Changer de répertoire** si besoin ; cherche **Abonnements** et repère celui que tu utilises.'],
  'Tu vois le nom de ton abonnement et son état « Actif ».',
  { ecran: { blade: 'Abonnements', fil: 'Accueil > Abonnements', champs: [{ label: 'Nom de l’abonnement', valeur: 'ton abonnement', genre: 'lecture', marque: true }, { label: 'État', valeur: 'Actif', genre: 'lecture' }], note: 'Reconstitution : les libellés peuvent différer légèrement de ton portail.' } });

export const MULTI_BASE = {
  // ---------------------------------------------------------------- groupe de ressources
  'cours-az-groupe-ressources': {
    gui: {
      privileges: PRIV_GUI,
      etapes: [
        guiContexte(),
        gui('Créer le groupe de ressources', 'modification', 'La région choisie ne sert qu’à ranger les informations du groupe : les ressources qu’il contient peuvent être dans d’autres régions.',
          ['Dans la barre de recherche du portail, tape **Groupes de ressources**, ouvre le service puis clique **+ Créer**.', 'Choisis ton **Abonnement**.', 'Saisis le **Groupe de ressources** (le nom de ton groupe, par exemple `rg-lab`) et choisis la **Région** (par exemple **Canada Centre**).', 'Clique **Vérifier + créer**, puis **Créer**.'],
          'Une notification « Groupe de ressources créé » apparaît et le groupe est dans la liste.',
          { ecran: { blade: 'Créer un groupe de ressources', fil: 'Accueil > Groupes de ressources > Créer', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Abonnement', valeur: 'ton abonnement', genre: 'liste' }, { label: 'Groupe de ressources', valeur: 'rg-lab', marque: true }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste', marque: true }], bouton: 'Vérifier + créer' } }),
        gui('Vérifier le groupe', 'lecture', 'Relis le groupe tel qu’Azure le connaît.',
          ['Dans **Groupes de ressources**, clique le nom de ton groupe.', 'Sur la page **Vue d’ensemble**, regarde l’**Abonnement** et l’**Emplacement**.'],
          'Le groupe s’ouvre, vide pour l’instant, avec la bonne région.',
          { ecran: { blade: 'rg-lab', fil: 'Accueil > Groupes de ressources > rg-lab', champs: [{ label: 'Abonnement', valeur: 'ton abonnement', genre: 'lecture' }, { label: 'Emplacement', valeur: 'Canada Centre', genre: 'lecture', marque: true }, { label: 'Ressources', valeur: 'Aucune ressource', genre: 'lecture' }] } }),
      ],
      verification: ['Le groupe apparaît dans **Groupes de ressources** avec la bonne région.'],
      retour: 'Pour tout nettoyer en fin de laboratoire : ouvre le groupe, clique **Supprimer le groupe de ressources**, retape son nom pour confirmer. La suppression emporte TOUTES les ressources du groupe et ne se défait pas.',
    },
    powershell: {
      privileges: PRIV_PS,
      etapes: [
        psContexte(),
        mod('Créer le groupe', 'La région choisie ne sert qu’à ranger les informations du groupe : les ressources qu’il contient peuvent être dans d’autres régions.',
          [ps('New-AzResourceGroup -Name {{groupe}} -Location {{region}}')], 'Un objet avec ProvisioningState = Succeeded.'),
        lec('Vérifier', 'Relis le groupe tel qu’Azure le connaît.', [ps('Get-AzResourceGroup -Name {{groupe}} | Format-List ResourceGroupName, Location, ProvisioningState')], 'Le nom, la région et l’état Succeeded.', { verification: true }),
      ],
      verification: ['Get-AzResourceGroup affiche le groupe avec ProvisioningState = Succeeded.'],
      retour: 'Pour tout nettoyer en fin de laboratoire : Remove-AzResourceGroup -Name suivi du nom du groupe. PowerShell demande une confirmation ; la suppression emporte TOUTES les ressources du groupe et ne se défait pas.',
    },
  },

  // ---------------------------------------------------------------- verrou
  'cours-az-verrou-ressource': {
    gui: {
      privileges: PRIV_GUI + ' Poser un verrou demande le rôle Propriétaire ou Administrateur de l’accès utilisateur sur la ressource.',
      etapes: [
        guiContexte(),
        gui('Ouvrir les verrous du groupe', 'lecture', 'Le verrou s’applique au groupe et à tout ce qu’il contient.',
          ['Cherche **Groupes de ressources** et clique le nom de ton groupe.', 'Dans le menu de gauche, sous **Paramètres**, clique **Verrous**.'],
          'La page **Verrous** s’ouvre, vide si aucun verrou n’existe.',
          { ecran: { blade: 'Verrous', fil: 'Accueil > Groupes de ressources > rg-lab > Verrous', champs: [{ label: 'Verrous existants', valeur: 'Aucun verrou', genre: 'lecture' }], bouton: '+ Ajouter', note: 'Libellé du menu à confirmer : **Verrous** (sous Paramètres).' } }),
        gui('Poser le verrou', 'modification', 'Avec « Lecture seule », certaines opérations qui semblent des lectures (démarrer une machine, lire des clés) échouent : commence par « Supprimer ».',
          ['Clique **+ Ajouter**.', 'Saisis le **Nom du verrou** (par exemple `verrou-rg-lab`).', 'Choisis le **Type de verrou** : **Supprimer** (= CanNotDelete) ou **Lecture seule** (= ReadOnly).', 'Clique **OK**.'],
          'Le verrou apparaît dans la liste avec son type.',
          { ecran: { blade: 'Ajouter un verrou', fil: 'Groupe de ressources > Verrous > Ajouter', champs: [{ label: 'Nom du verrou', valeur: 'verrou-rg-lab', marque: true }, { label: 'Type de verrou', valeur: 'Supprimer', genre: 'liste', marque: true }, { label: 'Notes', valeur: '(facultatif)', genre: 'texte' }], bouton: 'OK', note: 'Libellés des types à confirmer : « Supprimer » = CanNotDelete, « Lecture seule » = ReadOnly.' } }),
        gui('Contrôler que la suppression est refusée', 'lecture', 'Le meilleur test d’un verrou « Supprimer » : essayer de supprimer, puis annuler.',
          ['Reviens sur la **Vue d’ensemble** du groupe et clique **Supprimer le groupe de ressources**.', 'Observe le message d’erreur ou d’avertissement lié au verrou, puis **annule** : ne confirme pas la suppression.'],
          'Azure refuse ou signale que le groupe est verrouillé ; rien n’est supprimé.',
          { important: 'N’va pas jusqu’à confirmer la suppression : si le verrou n’était pas posé, tu supprimerais tout le groupe.' }),
      ],
      verification: ['La page **Verrous** montre le verrou, et la suppression du groupe est refusée tant qu’il existe.'],
      retour: 'Pour retirer le verrou : **Groupe de ressources > Verrous**, clique **Supprimer** (icône corbeille) sur la ligne du verrou.',
    },
    powershell: {
      privileges: PRIV_PS + ' Poser un verrou demande le rôle Propriétaire ou Administrateur de l’accès utilisateur.',
      etapes: [
        psContexte(),
        mod('Poser le verrou', 'Le verrou s’applique au groupe et à tout ce qu’il contient. Avec ReadOnly, certaines opérations qui semblent des lectures (démarrer une machine, lire des clés) échouent : commence par CanNotDelete.',
          [ps('New-AzResourceLock -LockName {{verrou}} -LockLevel {{typeVerrou}} -ResourceGroupName {{groupe}} -Force')], 'Un objet qui décrit le verrou, avec son niveau (Properties.level).',
          { important: '-Force évite la demande de confirmation ; vérifie les paramètres avec Get-Help New-AzResourceLock si ta version du module diffère.' }),
        lec('Lister les verrous', 'Contrôle que le verrou est bien posé sur le groupe.', [ps('Get-AzResourceLock -ResourceGroupName {{groupe}} | Format-Table Name, @{n="Niveau";e={$_.Properties.level}}')], 'Une ligne avec le nom du verrou et son niveau (CanNotDelete ou ReadOnly).', { verification: true }),
      ],
      verification: ['Get-AzResourceLock montre le verrou, et la suppression du groupe est refusée tant qu’il existe.'],
      retour: 'Pour retirer le verrou : Remove-AzResourceLock -LockName suivi du nom du verrou et de -ResourceGroupName suivi du groupe.',
    },
  },

  // ---------------------------------------------------------------- rôle
  'cours-az-role-coequipier': {
    gui: {
      privileges: 'Compte Azure avec le rôle Propriétaire (ou Administrateur de l’accès utilisateur) sur l’abonnement ; connecté par toi-même au portail Azure.',
      etapes: [
        guiContexte(),
        gui('Ouvrir le contrôle d’accès de l’abonnement', 'lecture', 'Le rôle est donné sur l’abonnement entier (l’étendue). Pour limiter l’accès, fais la même chose depuis un groupe de ressources.',
          ['Cherche **Abonnements** et clique ton abonnement.', 'Dans le menu de gauche, clique **Contrôle d’accès (IAM)**.', 'Clique **+ Ajouter**, puis **Ajouter une attribution de rôle**.'],
          'L’assistant « Ajouter une attribution de rôle » s’ouvre.',
          { ecran: { blade: 'Contrôle d’accès (IAM)', fil: 'Accueil > Abonnements > ton abonnement > Contrôle d’accès (IAM)', onglets: ['Vérifier l’accès', 'Attributions de rôles', 'Rôles'], actif: 1, champs: [{ label: 'Ajouter', valeur: 'Ajouter une attribution de rôle', genre: 'liste', marque: true }], note: 'Libellés à confirmer selon la version du portail.' } }),
        gui('Choisir le rôle et le coéquipier', 'modification', 'Reader = lecture seule ; Contributor (Contributeur) crée et modifie les ressources sans gérer les accès. Évite Propriétaire dans un laboratoire.',
          ['Onglet **Rôle** : choisis **Contributeur** (ou **Lecteur**) parmi les **Rôles de fonction de travail**, puis clique **Suivant**.', 'Onglet **Membres** : **Attribuer l’accès à** : **Utilisateur, groupe ou principal de service**, clique **+ Sélectionner des membres** et choisis ton coéquipier (par son adresse, par exemple `prenom.nom@exemple.ca`).', 'Clique **Vérifier + attribuer**, puis de nouveau **Vérifier + attribuer**.'],
          'Une notification confirme l’ajout de l’attribution de rôle.',
          { ecran: { blade: 'Ajouter une attribution de rôle', fil: 'Abonnement > Contrôle d’accès (IAM) > Ajouter', onglets: ['Rôle', 'Membres', 'Conditions', 'Vérifier + attribuer'], actif: 1, champs: [{ label: 'Rôle sélectionné', valeur: 'Contributeur', genre: 'lecture' }, { label: 'Attribuer l’accès à', valeur: 'Utilisateur, groupe ou principal de service', genre: 'liste' }, { label: 'Membres', valeur: 'prenom.nom@exemple.ca', marque: true }], bouton: 'Vérifier + attribuer' } }),
        gui('Vérifier l’attribution', 'lecture', 'Relis les rôles de ce compte sur l’abonnement.',
          ['Dans **Contrôle d’accès (IAM)**, ouvre l’onglet **Attributions de rôles**.', 'Cherche l’adresse de ton coéquipier dans la barre de recherche.'],
          'Une ligne montre le rôle choisi et l’étendue « Cet abonnement ».',
          { ecran: { blade: 'Contrôle d’accès (IAM)', fil: 'Abonnement > Contrôle d’accès (IAM) > Attributions de rôles', onglets: ['Vérifier l’accès', 'Attributions de rôles', 'Rôles'], actif: 1, champs: [{ label: 'Recherche', valeur: 'prenom.nom@exemple.ca', marque: true }, { label: 'Rôle', valeur: 'Contributeur', genre: 'lecture' }, { label: 'Étendue', valeur: 'Cet abonnement', genre: 'lecture' }] } }),
      ],
      verification: ['L’attribution apparaît dans **Attributions de rôles** avec le bon rôle et la bonne étendue.'],
      retour: 'Pour retirer l’accès : **Contrôle d’accès (IAM) > Attributions de rôles**, coche la ligne puis clique **Supprimer**.',
    },
    powershell: {
      privileges: 'Module Az installé ; connecté par toi-même avec Connect-AzAccount ; rôle Propriétaire (ou Administrateur de l’accès utilisateur) sur l’abonnement.',
      etapes: [
        psContexte(),
        mod('Attribuer le rôle', 'Le rôle est donné sur l’abonnement entier (l’étendue). Pour limiter l’accès, remplace l’étendue par celle d’un groupe de ressources.',
          [ps('New-AzRoleAssignment -SignInName {{utilisateur}} -RoleDefinitionName {{role}} -Scope "/subscriptions/{{abonnement}}"')], 'Un objet qui décrit l’attribution, avec RoleDefinitionName et Scope.',
          { important: 'Si la commande ne trouve pas l’utilisateur (compte invité, par exemple), vérifie avec Get-Help New-AzRoleAssignment ou utilise le portail.' }),
        lec('Vérifier l’attribution', 'Liste les rôles de ce compte sur l’abonnement.', [ps('Get-AzRoleAssignment -SignInName {{utilisateur}} -Scope "/subscriptions/{{abonnement}}" | Format-Table DisplayName, RoleDefinitionName, Scope')], 'Une ligne avec le rôle choisi et l’étendue de l’abonnement.', { verification: true }),
      ],
      verification: ['L’attribution apparaît dans Get-AzRoleAssignment avec le bon rôle.'],
      retour: 'Pour retirer l’accès : Remove-AzRoleAssignment avec les mêmes options -SignInName, -RoleDefinitionName et -Scope.',
    },
  },

  // ---------------------------------------------------------------- VNet
  'cours-az-vnet-creer': {
    gui: {
      privileges: PRIV_GUI,
      etapes: [
        guiContexte(),
        gui('Lire les réseaux existants', 'lecture', 'Vérifie qu’aucun réseau existant ne chevauche la plage que tu vas choisir : un chevauchement empêchera plus tard le peering et les VPN.',
          ['Cherche **Réseaux virtuels** et ouvre le service.', 'Clique chaque réseau existant, puis **Espace d’adressage**, pour noter sa plage.'],
          'Tu connais les plages déjà prises (ou la liste est vide).',
          { ecran: { blade: 'Réseaux virtuels', fil: 'Accueil > Réseaux virtuels', champs: [{ label: 'Réseaux existants', valeur: 'Aucun réseau virtuel à afficher', genre: 'lecture' }], bouton: '+ Créer' } }),
        gui('Créer le VNet et son premier sous-réseau', 'modification', 'Un VNet exige un espace d’adressage et au moins un sous-réseau. Le sous-réseau doit tenir dans l’espace.',
          ['Clique **+ Créer**.', 'Onglet **Informations de base** : ton **Groupe de ressources**, le **Nom du réseau virtuel** (par exemple `vnet1`) et la **Région**.', 'Onglet **Adresses IP** : saisis l’**Espace d’adressage IPv4** (par exemple `10.1.0.0/16`) ; modifie le sous-réseau **default** : **Nom** `default`, plage `10.1.0.0/24`.', 'Clique **Vérifier + créer**, puis **Créer**.'],
          'Le déploiement se termine par « Votre déploiement est terminé ».',
          { ecran: { blade: 'Créer un réseau virtuel', fil: 'Accueil > Réseaux virtuels > Créer', onglets: ['Informations de base', 'Sécurité', 'Adresses IP', 'Balises', 'Vérifier + créer'], actif: 2, champs: [{ label: 'Espace d’adressage IPv4', valeur: '10.1.0.0/16', marque: true }, { label: 'Sous-réseau — nom', valeur: 'default', marque: true }, { label: 'Sous-réseau — plage', valeur: '10.1.0.0/24', marque: true }], bouton: 'Vérifier + créer', note: 'Onglet Informations de base : groupe de ressources, nom du VNet, région.' } }),
        gui('Vérifier le VNet et ses sous-réseaux', 'lecture', 'Relis le VNet puis ses sous-réseaux.',
          ['Ouvre le VNet créé, **Vue d’ensemble**.', 'Clique **Espace d’adressage** puis **Sous-réseaux** dans le menu de gauche.'],
          'Le VNet a la bonne plage ; le sous-réseau affiche sa plage et ses adresses disponibles.',
          { ecran: { blade: 'Sous-réseaux', fil: 'Réseau virtuel > vnet1 > Sous-réseaux', champs: [{ label: 'Nom', valeur: 'default', genre: 'lecture' }, { label: 'Plage d’adresses IPv4', valeur: '10.1.0.0/24', genre: 'lecture', marque: true }] } }),
      ],
      verification: ['Le VNet existe, avec le bon espace d’adressage, et son sous-réseau a la plage prévue.'],
      retour: 'Pour défaire : ouvre le VNet et clique **Supprimer** (il doit être vide de machines et d’interfaces).',
    },
    powershell: {
      privileges: PRIV_PS,
      etapes: [
        psContexte(),
        lec('Lire les réseaux existants', 'Vérifie qu’aucun réseau existant ne chevauche la plage que tu vas choisir : un chevauchement empêchera plus tard le peering et les VPN.',
          [ps('Get-AzVirtualNetwork | Format-Table Name, ResourceGroupName, Location, @{n="Espace";e={$_.AddressSpace.AddressPrefixes -join ","}}')], 'Un tableau avec le nom, le groupe, la région et la plage de chaque VNet.'),
        mod('Créer le VNet et le premier sous-réseau', 'Un VNet exige un espace d’adressage et au moins un sous-réseau. Le sous-réseau doit tenir dans l’espace.',
          [ps('$sn = New-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -AddressPrefix {{plage}}'), ps('New-AzVirtualNetwork -Name {{vnet}} -ResourceGroupName {{groupe}} -Location {{region}} -AddressPrefix {{espace}} -Subnet $sn')],
          'Un objet VNet avec ProvisioningState = Succeeded.'),
        lec('Vérifier', 'Relis le VNet puis ses sous-réseaux.',
          [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'), ps('$vn | Format-List Name, Location, ProvisioningState'), ps('$vn.Subnets | Format-Table Name, @{n="Plage";e={$_.AddressPrefix -join ","}}')],
          'Le VNet avec sa région, puis le sous-réseau avec sa plage.', { verification: true }),
      ],
      verification: ['Le VNet existe, avec le bon espace d’adressage, et son sous-réseau a la plage prévue.'],
      retour: 'Pour défaire : Remove-AzVirtualNetwork avec -ResourceGroupName et -Name (le VNet doit être vide de machines et d’interfaces).',
    },
  },

  // ---------------------------------------------------------------- sous-réseau
  'cours-az-sous-reseau-ajouter': {
    gui: {
      privileges: PRIV_GUI,
      etapes: [
        gui('Lire les sous-réseaux existants', 'lecture', 'Repère les plages déjà prises pour ne pas les chevaucher.',
          ['Cherche **Réseaux virtuels** et clique ton VNet.', 'Dans le menu de gauche, clique **Sous-réseaux**.'],
          'La liste des sous-réseaux avec leur plage.',
          { ecran: { blade: 'Sous-réseaux', fil: 'Réseau virtuel > vnet1 > Sous-réseaux', champs: [{ label: 'default', valeur: '10.1.0.0/24', genre: 'lecture', marque: true }], bouton: '+ Sous-réseau' } }),
        gui('Créer le sous-réseau', 'modification', 'Le plus petit sous-réseau IPv4 admis est un /29 (8 adresses). Azure en réserve cinq : un /29 n’offre donc que trois adresses utilisables.',
          ['Clique **+ Sous-réseau**.', 'Saisis le **Nom** (par exemple `db`) et la **Plage d’adresses de sous-réseau** (par exemple `10.1.1.0/24`) : elle doit tenir dans l’espace du VNet et ne chevaucher aucun autre sous-réseau.', 'Clique **Enregistrer** (ou **Ajouter**).'],
          'Le nouveau sous-réseau apparaît dans la liste.',
          { ecran: { blade: 'Ajouter un sous-réseau', fil: 'Réseau virtuel > vnet1 > Sous-réseaux > Ajouter', champs: [{ label: 'Nom', valeur: 'db', marque: true }, { label: 'Plage d’adresses de sous-réseau', valeur: '10.1.1.0/24', marque: true }], bouton: 'Enregistrer', note: 'Libellés à confirmer : le portail change parfois « Ajouter » et « Enregistrer ».' } }),
        gui('Vérifier', 'lecture', 'Relis la liste des sous-réseaux.', ['Actualise la page **Sous-réseaux** et compare les plages.'], 'Le nouveau sous-réseau figure dans la liste avec sa plage, sans chevauchement.',
          { ecran: { blade: 'Sous-réseaux', fil: 'Réseau virtuel > vnet1 > Sous-réseaux', champs: [{ label: 'default', valeur: '10.1.0.0/24', genre: 'lecture' }, { label: 'db', valeur: '10.1.1.0/24', genre: 'lecture', marque: true }] } }),
      ],
      verification: ['Le sous-réseau existe avec la bonne plage, et sans chevauchement.'],
      retour: 'Pour défaire : **Sous-réseaux**, coche le sous-réseau puis **Supprimer** (il doit être vide).',
    },
    powershell: {
      privileges: PRIV_PS,
      etapes: [
        psContexte(),
        lec('Lire les sous-réseaux existants', 'Repère les plages déjà prises pour ne pas les chevaucher.',
          [ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}).Subnets | Format-Table Name, @{n="Plage";e={$_.AddressPrefix -join ","}}')], 'Un tableau avec le nom et la plage de chaque sous-réseau.'),
        mod('Créer le sous-réseau', 'On ajoute le sous-réseau à l’objet VNet puis on l’enregistre avec Set-AzVirtualNetwork. Le plus petit sous-réseau IPv4 admis est un /29 ; Azure en réserve cinq adresses.',
          [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'), ps('Add-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -AddressPrefix {{plage}} -VirtualNetwork $vn | Set-AzVirtualNetwork')],
          'Le VNet mis à jour, avec le nouveau sous-réseau dans Subnets.'),
        lec('Vérifier', 'Relis la liste des sous-réseaux.', [ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}).Subnets | Format-Table Name, @{n="Plage";e={$_.AddressPrefix -join ","}}')], 'Le nouveau sous-réseau figure dans la liste avec sa plage.', { verification: true }),
      ],
      verification: ['Le sous-réseau existe avec la bonne plage, et sans chevauchement.'],
      retour: 'Pour défaire : Remove-AzVirtualNetworkSubnetConfig puis Set-AzVirtualNetwork sur le VNet (le sous-réseau doit être vide).',
    },
  },

  // ---------------------------------------------------------------- plan d'adressage (lecture seule)
  'cours-az-plan-adressage': {
    gui: {
      privileges: PRIV_GUI_LECTURE,
      etapes: [
        gui('Lister les réseaux virtuels', 'lecture', 'Tous les VNet de l’abonnement, avec leur groupe et leur région.',
          ['Cherche **Réseaux virtuels** et ouvre le service.', 'Repère la colonne **Groupe de ressources** et **Emplacement**.'],
          'Un tableau avec le nom, le groupe de ressources et la région de chaque VNet.',
          { ecran: { blade: 'Réseaux virtuels', fil: 'Accueil > Réseaux virtuels', champs: [{ label: 'vnet1', valeur: 'rg-lab — Canada Centre', genre: 'lecture', marque: true }] } }),
        gui('Lire l’espace d’adressage d’un VNet', 'lecture', 'Affiche les plages du VNet choisi.',
          ['Clique le VNet, puis **Espace d’adressage** dans le menu de gauche.'],
          'Une ou plusieurs plages CIDR, par exemple 10.1.0.0/16.',
          { ecran: { blade: 'Espace d’adressage', fil: 'Réseau virtuel > vnet1 > Espace d’adressage', champs: [{ label: 'Espace d’adressage', valeur: '10.1.0.0/16', genre: 'lecture', marque: true }] } }),
        gui('Lire les sous-réseaux', 'lecture', 'Chaque sous-réseau doit tenir dans l’espace du VNet et ne chevaucher aucun autre.',
          ['Clique **Sous-réseaux** dans le menu de gauche.', 'Compare les plages entre elles.'],
          'Une ligne par sous-réseau avec sa plage.',
          { ecran: { blade: 'Sous-réseaux', fil: 'Réseau virtuel > vnet1 > Sous-réseaux', champs: [{ label: 'default', valeur: '10.1.0.0/24', genre: 'lecture', marque: true }, { label: 'db', valeur: '10.1.1.0/24', genre: 'lecture', marque: true }] } }),
      ],
      verification: ['Aucun sous-réseau ne chevauche un autre, et aucun VNet à appairer ne chevauche l’autre.'],
      retour: 'Cette fiche est en lecture seule : il n’y a rien à défaire.',
    },
    powershell: {
      privileges: PRIV_PS_LECTURE,
      etapes: [
        psContexte(),
        lec('Lister les réseaux virtuels', 'Tous les VNet de l’abonnement, avec leur groupe et leur région.', [ps('Get-AzVirtualNetwork | Format-Table Name, ResourceGroupName, Location')], 'Un tableau avec le nom, le groupe de ressources et la région de chaque VNet.'),
        lec('Lire l’espace d’adressage d’un VNet', 'Affiche les plages du VNet choisi, une par ligne.', [ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}).AddressSpace.AddressPrefixes')], 'Une ou plusieurs plages CIDR, par exemple 10.1.0.0/16.'),
        lec('Lire les sous-réseaux', 'Chaque sous-réseau doit tenir dans l’espace du VNet et ne chevaucher aucun autre.', [ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}).Subnets | Format-Table Name, @{n="Plage";e={$_.AddressPrefix -join ","}}')], 'Une ligne par sous-réseau avec sa plage ; compare-les entre elles.', { verification: true }),
      ],
      verification: ['Aucun sous-réseau ne chevauche un autre, et aucun VNet à appairer ne chevauche l’autre.'],
      retour: 'Cette fiche est en lecture seule : il n’y a rien à défaire.',
    },
  },

  // ---------------------------------------------------------------- IP publique / privée
  'cours-az-ip-publique-privee': {
    gui: {
      privileges: PRIV_GUI,
      etapes: [
        guiContexte(),
        gui('Créer une adresse IP publique statique', 'modification', 'La référence Standard est la norme actuelle et exige l’attribution statique. Une IP publique est facturée tant qu’elle existe, même détachée.',
          ['Cherche **Adresses IP publiques**, clique **+ Créer**.', 'Choisis ton **Groupe de ressources** et la **Région**, saisis le **Nom** (par exemple `pip-lab`).', 'Choisis **Référence SKU** : **Standard** et **Attribution** : **Statique** (version IPv4).', 'Clique **Vérifier + créer**, puis **Créer**.'],
          'La ressource est créée ; son adresse apparaît dans la **Vue d’ensemble**.',
          { ecran: { blade: 'Créer une adresse IP publique', fil: 'Accueil > Adresses IP publiques > Créer', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Groupe de ressources', valeur: 'rg-lab', genre: 'liste' }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste' }, { label: 'Nom', valeur: 'pip-lab', marque: true }, { label: 'Référence SKU', valeur: 'Standard', genre: 'liste', marque: true }, { label: 'Attribution', valeur: 'Statique', genre: 'liste', marque: true }], bouton: 'Vérifier + créer', note: 'Libellés à confirmer : « Référence SKU » et « Attribution » peuvent varier.' } }),
        gui('Lire l’adresse obtenue', 'lecture', 'Repère l’adresse publique attribuée.', ['Ouvre la ressource IP publique, **Vue d’ensemble**.', 'Lis **Adresse IP**.'], 'Une adresse IPv4 publique.',
          { ecran: { blade: 'pip-lab', fil: 'Adresses IP publiques > pip-lab', champs: [{ label: 'Adresse IP', valeur: '(adresse publique attribuée)', genre: 'lecture', marque: true }, { label: 'Attribution', valeur: 'Statique', genre: 'lecture' }] } }),
        gui('Fixer l’adresse privée d’une interface', 'modification', 'Rend statique l’adresse privée de la première configuration IP de l’interface : la machine garde la même adresse à chaque démarrage.',
          ['Cherche **Interfaces réseau** et clique l’interface de la machine (par exemple `vm1VMNic`).', 'Menu **Paramètres > Configurations IP**, clique **ipconfig1**.', 'Sous **Adresse IP privée**, **Attribution** : **Statique**, puis saisis l’adresse (par exemple `10.1.0.10`).', 'Clique **Enregistrer**.'],
          'La configuration affiche l’attribution « Statique » et l’adresse choisie.',
          { important: 'L’adresse doit être libre et appartenir au sous-réseau de l’interface ; elle ne doit pas être l’une des cinq adresses réservées. L’interface peut être redémarrée par l’opération.', ecran: { blade: 'ipconfig1', fil: 'Interface réseau > Configurations IP > ipconfig1', champs: [{ label: 'Attribution (privée)', valeur: 'Statique', genre: 'liste', marque: true }, { label: 'Adresse IP privée', valeur: '10.1.0.10', marque: true }], bouton: 'Enregistrer' } }),
      ],
      verification: ['L’IP publique affiche une adresse, et l’interface visée porte l’adresse privée fixée.'],
      retour: 'Pour défaire : dissocie l’IP publique de toute interface, puis ouvre la ressource et clique **Supprimer**.',
    },
    powershell: {
      privileges: PRIV_PS,
      etapes: [
        psContexte(),
        mod('Créer une adresse IP publique statique', 'La référence Standard est la norme actuelle et exige l’attribution statique. Une IP publique est facturée tant qu’elle existe, même détachée.',
          [ps('New-AzPublicIpAddress -ResourceGroupName {{groupe}} -Name {{ipPublique}} -Location {{region}} -Sku Standard -AllocationMethod Static')], 'Un objet avec IpAddress et ProvisioningState = Succeeded.'),
        lec('Lire l’adresse obtenue', 'Affiche seulement l’adresse publique.', [ps('(Get-AzPublicIpAddress -ResourceGroupName {{groupe}} -Name {{ipPublique}}).IpAddress')], 'Une adresse IPv4 publique.'),
        mod('Fixer l’adresse privée d’une interface', 'On rend statique l’adresse privée de la première configuration IP de l’interface, puis on enregistre.',
          [ps('$nic = Get-AzNetworkInterface -ResourceGroupName {{groupe}} -Name {{nic}}'), ps('$nic.IpConfigurations[0].PrivateIpAllocationMethod = "Static"'), ps('$nic.IpConfigurations[0].PrivateIpAddress = "{{ipPrivee}}"'), ps('Set-AzNetworkInterface -NetworkInterface $nic')],
          'L’interface mise à jour, PrivateIpAllocationMethod = Static.', { facultatif: true, important: 'L’adresse doit être libre et appartenir au sous-réseau de l’interface ; pas l’une des cinq adresses réservées.' }),
        lec('Vérifier', 'Relis l’adresse privée de l’interface.', [ps('(Get-AzNetworkInterface -ResourceGroupName {{groupe}} -Name {{nic}}).IpConfigurations | Format-Table Name, PrivateIpAddress, PrivateIpAllocationMethod')], 'La configuration porte l’adresse privée fixée, en Static.', { verification: true }),
      ],
      verification: ['L’IP publique affiche une adresse, et l’interface visée porte l’adresse privée fixée.'],
      retour: 'Pour défaire : dissocie l’IP publique de toute interface, puis Remove-AzPublicIpAddress avec -ResourceGroupName et -Name.',
    },
  },

  // ---------------------------------------------------------------- VM dans un VNet existant
  'cours-az-vm-creer-vnet': {
    gui: {
      privileges: PRIV_GUI,
      etapes: [
        guiContexte(),
        gui('Créer la machine : informations de base', 'modification', 'On crée une machine Linux économique dans un VNet et un sous-réseau qui existent déjà. Aucun mot de passe : on utilise une paire de clés SSH.',
          ['Cherche **Machines virtuelles**, clique **+ Créer**, puis **Machine virtuelle Azure**.', 'Onglet **Informations de base** : ton **Groupe de ressources**, le **Nom de la machine virtuelle** (par exemple `vm1`) et la **Région** du VNet.', 'Choisis l’**Image** : **Ubuntu Server 22.04 LTS** et la **Taille** : **Standard_B1s** (si elle n’est pas offerte dans ta région, choisis une autre petite taille).'],
          'Les champs de base sont remplis ; la création n’est pas encore lancée.',
          { ecran: { blade: 'Créer une machine virtuelle', fil: 'Accueil > Machines virtuelles > Créer', onglets: ['Informations de base', 'Disques', 'Réseau', 'Gestion', 'Surveillance', 'Avancé', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Groupe de ressources', valeur: 'rg-lab', genre: 'liste' }, { label: 'Nom de la machine virtuelle', valeur: 'vm1', marque: true }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste' }, { label: 'Image', valeur: 'Ubuntu Server 22.04 LTS - x64 Gen2', genre: 'liste', marque: true }, { label: 'Taille', valeur: 'Standard_B1s', genre: 'liste', marque: true }], bouton: 'Suivant : Disques', note: 'Reconstitution : libellés exacts de l’image et de la taille à confirmer dans ton portail.' } }),
        gui('Choisir l’authentification par clé SSH', 'modification', 'La clé remplace le mot de passe : le portail génère la paire et te fait télécharger la clé privée UNE fois. Garde-la pour toi, ne la partage jamais.',
          ['Toujours dans **Informations de base**, **Type d’authentification** : **Clé publique SSH**.', 'Saisis le **Nom d’utilisateur** (par exemple `azureuser`).', '**Source de la clé publique SSH** : **Générer une nouvelle paire de clés** ; donne un **Nom de la paire de clés**.', '**Ports d’entrée publics** : **Aucun** (aucun accès entrant n’est ouvert).'],
          'L’authentification est par clé et aucun port d’entrée n’est ouvert.',
          { ecran: { blade: 'Créer une machine virtuelle', fil: 'Accueil > Machines virtuelles > Créer', onglets: ['Informations de base', 'Disques', 'Réseau', 'Gestion'], actif: 0, champs: [{ label: 'Type d’authentification', valeur: 'Clé publique SSH', genre: 'liste', marque: true }, { label: 'Nom d’utilisateur', valeur: 'azureuser', marque: true }, { label: 'Source de la clé publique SSH', valeur: 'Générer une nouvelle paire de clés', genre: 'liste', marque: true }, { label: 'Ports d’entrée publics', valeur: 'Aucun', genre: 'liste', marque: true }], bouton: 'Suivant : Disques' }, important: 'Ne saisis et ne note aucun mot de passe ici : avec une clé SSH, il n’y en a pas.' }),
        gui('Placer la machine dans le VNet et le sous-réseau existants', 'modification', 'La machine prend une adresse privée dans le sous-réseau choisi. Sans IP publique, elle n’est pas joignable depuis Internet.',
          ['Clique **Suivant** jusqu’à l’onglet **Réseau**.', 'Choisis le **Réseau virtuel** et le **Sous-réseau** existants.', '**IP publique** : **Aucun**.', 'Clique **Vérifier + créer**, puis **Créer** ; à l’invite, clique **Télécharger la clé privée et créer la ressource**.'],
          'Le déploiement se termine et la machine est à l’état « En cours d’exécution ».',
          { ecran: { blade: 'Créer une machine virtuelle', fil: 'Accueil > Machines virtuelles > Créer', onglets: ['Informations de base', 'Disques', 'Réseau', 'Gestion'], actif: 2, champs: [{ label: 'Réseau virtuel', valeur: 'vnet1', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'default (10.1.0.0/24)', genre: 'liste', marque: true }, { label: 'IP publique', valeur: 'Aucun', genre: 'liste', marque: true }], bouton: 'Vérifier + créer' }, important: 'La machine est facturée tant qu’elle n’est pas désallouée.' }),
        gui('Lire les adresses de la machine', 'lecture', 'Repère l’adresse privée à donner au ping de l’autre machine.', ['Ouvre la machine virtuelle, **Vue d’ensemble**.', 'Lis **Adresse IP privée** (et **Adresse IP publique**, s’il y en a une).'], 'L’adresse privée de la machine, dans la plage du sous-réseau.',
          { ecran: { blade: 'Machine virtuelle vm1', fil: 'Machines virtuelles > vm1', champs: [{ label: 'État', valeur: 'En cours d’exécution', genre: 'lecture' }, { label: 'Adresse IP privée', valeur: '10.1.0.4', genre: 'lecture', marque: true }, { label: 'Adresse IP publique', valeur: '-', genre: 'lecture' }] } }),
        gui('Tester un ping vers l’autre machine', 'lecture', 'Le portail fait exécuter la commande dans la machine : aucune connexion SSH n’est nécessaire. Le trafic entre deux machines d’un même VNet est permis par défaut.',
          ['Dans la machine, menu **Opérations > Exécuter la commande**.', 'Clique **RunShellScript**.', 'Dans **Script de commande Linux**, tape `ping -c 4 10.1.0.5` (l’adresse privée de l’autre machine) puis clique **Exécuter**.'],
          'La sortie contient « 4 packets transmitted, 4 received » si l’autre machine répond.',
          { ecran: { blade: 'Exécuter le script de commande Linux', fil: 'Machine virtuelle > Opérations > Exécuter la commande > RunShellScript', champs: [{ label: 'Script de commande Linux', valeur: 'ping -c 4 10.1.0.5', marque: true }], bouton: 'Exécuter', note: 'Libellés à confirmer.' }, important: 'Le ping peut échouer si un pare-feu ou un groupe de sécurité réseau (NSG) bloque l’ICMP : lis la règle avant de conclure que le réseau est en panne.' }),
      ],
      verification: ['La machine est « En cours d’exécution » et le ping vers l’autre machine reçoit ses quatre réponses.'],
      retour: 'Pour arrêter la facturation du calcul : ouvre la machine et clique **Arrêter** (elle doit être « Désallouée »). Pour tout supprimer, supprime le groupe de ressources du laboratoire.',
    },
    powershell: {
      privileges: PRIV_PS,
      etapes: [
        psContexte(),
        lec('Créer la machine (1/3) : préparer une paire de clés SSH', 'Aucun mot de passe de connexion : on utilise une clé SSH. Si tu as déjà une clé publique (fichier .pub), saute cette étape.',
          [ps('ssh-keygen -t ed25519 -f "$HOME\\.ssh\\id_ed25519"'), ps('Get-Content "$HOME\\.ssh\\id_ed25519.pub"')], 'Un fichier de clé publique (.pub) ; la clé privée reste sur ton poste.',
          { facultatif: false, important: 'ssh-keygen te demande une phrase secrète : saisis-la toi-même, ne la note nulle part. Ne partage jamais le fichier sans .pub.' }),
        mod('Créer la machine (2/3) : l’interface réseau dans le sous-réseau existant', 'La machine prend une adresse privée dans le sous-réseau ; aucune IP publique n’est créée. La région est lue depuis le VNet.',
          [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'), ps('$sn = Get-AzVirtualNetworkSubnetConfig -Name {{sousReseau}} -VirtualNetwork $vn'), ps('New-AzNetworkInterface -ResourceGroupName {{groupe}} -Name "{{vm}}-nic" -Location $vn.Location -SubnetId $sn.Id')],
          'L’interface avec une adresse privée du sous-réseau.'),
        mod('Créer la machine (3/3) : la machine virtuelle', 'Ubuntu 22.04, taille économique, clé SSH. Get-Credential ouvre une fenêtre où TU saisis le mot de passe : il n’apparaît jamais dans la commande (Azure l’exige pour créer le compte). Sans IP publique ni port ouvert, la machine n’est pas joignable de l’extérieur ; connecte-toi plus tard avec ta clé SSH.',
          [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
            ps('$nic = Get-AzNetworkInterface -ResourceGroupName {{groupe}} -Name "{{vm}}-nic"'),
            ps('$cred = Get-Credential -UserName {{admin}} -Message "Choisis un mot de passe, qui ne servira pas à te connecter (clé SSH)"'),
            ps('$cle = Get-Content "$HOME\\.ssh\\id_ed25519.pub" -Raw'),
            ps('$cfg = New-AzVMConfig -VMName {{vm}} -VMSize Standard_B1s'),
            ps('$cfg = Set-AzVMOperatingSystem -VM $cfg -Linux -ComputerName {{vm}} -Credential $cred'),
            ps('$cfg = Set-AzVMSourceImage -VM $cfg -PublisherName Canonical -Offer 0001-com-ubuntu-server-jammy -Skus 22_04-lts-gen2 -Version latest'),
            ps('$cfg = Add-AzVMNetworkInterface -VM $cfg -Id $nic.Id'),
            ps('$cfg = Add-AzVMSshPublicKey -VM $cfg -KeyData $cle -Path "/home/{{admin}}/.ssh/authorized_keys"'),
            ps('New-AzVM -ResourceGroupName {{groupe}} -Location $vn.Location -VM $cfg')],
          'La machine créée (ProvisioningState = Succeeded) ; le déploiement prend quelques minutes.',
          { important: 'Image, offre et SKU, ainsi que les paramètres de Set-AzVMOperatingSystem, sont à confirmer avec Get-Help et Get-AzVMImageSku (-Location, -PublisherName Canonical, -Offer 0001-com-ubuntu-server-jammy). Si la taille Standard_B1s n’est pas offerte dans ta région, change-la (Get-AzVMSize -Location). La machine est facturée tant qu’elle n’est pas désallouée.' }),
        lec('Lire les adresses de la machine', 'Repère l’adresse privée à donner au ping de l’autre machine.',
          [ps('(Get-AzNetworkInterface -ResourceGroupName {{groupe}} -Name "{{vm}}-nic").IpConfigurations | Format-Table Name, PrivateIpAddress')], 'L’adresse privée de la machine, dans la plage du sous-réseau.'),
        lec('Tester un ping vers l’autre machine', 'Fait exécuter « ping » dans la machine par l’agent Azure : aucune connexion SSH n’est nécessaire. Le trafic entre deux machines d’un même VNet est permis par défaut.',
          [ps('Invoke-AzVMRunCommand -ResourceGroupName {{groupe}} -VMName {{vm}} -CommandId RunShellScript -ScriptString "ping -c 4 {{ipCible}}"')],
          'Une sortie contenant « 4 packets transmitted, 4 received » si l’autre machine répond.',
          { verification: true, important: 'Le ping peut échouer si un pare-feu ou un NSG bloque l’ICMP : lis la règle avant de conclure que le réseau est en panne.' }),
      ],
      verification: ['La machine est créée (état Succeeded) et le ping vers l’autre machine reçoit ses quatre réponses.'],
      retour: 'Pour arrêter la facturation du calcul : Stop-AzVM avec -ResourceGroupName et -Name (la machine est alors désallouée). Pour tout supprimer, supprime le groupe de ressources du laboratoire.',
    },
  },
};
void des; void itr;
