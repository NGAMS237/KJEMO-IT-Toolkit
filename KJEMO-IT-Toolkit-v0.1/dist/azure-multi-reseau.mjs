/**
 * azure-multi-reseau.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Méthodes « Interface graphique » (portail Azure, écrans reconstitués) et
 * « PowerShell » (module Az) des fiches DNS et appairage / routage.
 * Rien n'est exécuté dans Azure : libellés du portail et cmdlets rédigés
 * d'après la documentation ; à confirmer avec le portail ou Get-Help.
 */
import { lec, mod, des, itr, ps, gui } from './cours-outils.mjs';

const PRIV = 'Compte Azure avec le rôle Contributeur (ou Contributeur de réseau) sur le groupe de ressources ; connecté par toi-même (portail ou `Connect-AzAccount`).';
const PRIV_LECTURE = 'Compte Azure avec au moins le rôle Lecteur sur le groupe de ressources ; connecté par toi-même (portail ou `Connect-AzAccount`).';
const PRIV_DNS = 'Compte Azure avec le rôle Contributeur de zone DNS (ou Contributeur) sur le groupe de ressources ; connecté par toi-même (portail ou `Connect-AzAccount`).';
const RG = 'Groupe de ressources';
const CONNEXION = lec('Se connecter et vérifier l’abonnement', 'Connecte-toi toi-même (fenêtre de connexion) et confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
  [ps('Connect-AzAccount'), ps('Get-AzContext | Format-List Name, Subscription')], 'Le nom de l’abonnement actif.');

export const MULTI_RESEAU = {
  // =========================================================================
  'cours-az-dns-zone-publique': {
    gui: {
      privileges: PRIV_DNS,
      etapes: [
        gui('Créer la zone DNS', 'modification', 'La zone contient tous les enregistrements du domaine. Elle n’est pas visible d’Internet tant que le domaine n’est pas délégué chez ton bureau d’enregistrement.',
          ['Dans la barre de recherche du portail, tape **Zones DNS**, ouvre le service puis clique **+ Créer**.', 'Onglet **Informations de base** : choisis ton **Abonnement** et le **Groupe de ressources** de ton laboratoire.', 'Saisis le **Nom** de la zone : le domaine, par exemple `contoso.com`.', 'Clique **Vérifier + créer**, puis **Créer**.'],
          'Le déploiement se termine par « Votre déploiement est terminé » et la zone apparaît dans la liste des zones DNS.',
          { ecran: { blade: 'Créer une zone DNS', fil: 'Accueil > Zones DNS > Créer une zone DNS', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Abonnement', valeur: 'ton abonnement', genre: 'liste' }, { label: RG, valeur: 'rg-lab', genre: 'liste', marque: true }, { label: 'Nom', valeur: 'contoso.com', marque: true }], bouton: 'Vérifier + créer', note: 'Reconstitution : libellés à confirmer dans ton portail.' } }),
        gui('Lire les quatre serveurs de noms', 'lecture', 'Ce sont les quatre noms à inscrire chez le bureau d’enregistrement pour déléguer le domaine à Azure.',
          ['Ouvre la zone DNS créée (clique **Accéder à la ressource**).', 'Dans la page **Vue d’ensemble**, repère **Serveurs de noms** : quatre lignes.', 'Note-les (ou clique l’icône de copie) pour la délégation.'],
          'Quatre noms de la forme ns1-01.azure-dns.com, ns2-01.azure-dns.net, etc.',
          { ecran: { blade: 'contoso.com — Zone DNS', fil: 'Accueil > Zones DNS > contoso.com', champs: [{ label: 'Serveur de noms 1', valeur: 'ns1-01.azure-dns.com', genre: 'lecture', marque: true }, { label: 'Serveur de noms 2', valeur: 'ns2-01.azure-dns.net', genre: 'lecture', marque: true }, { label: 'Serveur de noms 3', valeur: 'ns3-01.azure-dns.org', genre: 'lecture' }, { label: 'Serveur de noms 4', valeur: 'ns4-01.azure-dns.info', genre: 'lecture' }], note: 'Les noms réels de ta zone diffèrent de cet exemple.' } }),
        gui('Déléguer le domaine chez le bureau d’enregistrement', 'modification', 'Cette étape se fait hors d’Azure : Azure DNS n’achète pas de nom de domaine. Il faut posséder le domaine.',
          ['Connecte-toi au site de ton bureau d’enregistrement.', 'Ouvre la gestion des **serveurs de noms** (ou **DNS**) du domaine.', 'Remplace les serveurs actuels par les quatre serveurs lus à l’étape précédente, puis enregistre.'],
          'Le bureau d’enregistrement affiche les quatre serveurs d’Azure ; la propagation peut prendre du temps.',
          { facultatif: true, important: 'Sans domaine acheté, tu peux t’arrêter à l’étape précédente : la zone existe et se teste en interrogeant directement un serveur de noms Azure.' }),
      ],
      verification: ['La zone existe et ses quatre serveurs de noms sont lus ; la délégation chez le bureau d’enregistrement reste à faire.'],
      retour: 'Pour défaire : ouvre la zone, clique **Supprimer** dans la barre du haut et confirme (la zone et tous ses enregistrements disparaissent).',
    },
    powershell: {
      privileges: PRIV_DNS,
      etapes: [
        CONNEXION,
        mod('Créer la zone', 'Une zone DNS contient tous les enregistrements d’un domaine ; elle n’est pas encore visible d’Internet tant que le domaine n’est pas délégué.',
          [ps('New-AzDnsZone -ResourceGroupName {{groupe}} -Name {{zone}}')], 'Un objet zone avec son nom et NumberOfRecordSets.'),
        lec('Lire les serveurs de noms', 'Les quatre noms à inscrire chez le bureau d’enregistrement pour déléguer le domaine à Azure.',
          [ps('(Get-AzDnsZone -ResourceGroupName {{groupe}} -Name {{zone}}).NameServers')], 'Quatre noms de la forme ns1-01.azure-dns.com, ns2-01.azure-dns.net, etc.', { verification: true }),
      ],
      verification: ['La zone existe et ses quatre serveurs de noms sont lus ; la délégation chez le bureau d’enregistrement reste à faire.'],
      retour: 'Pour défaire : Remove-AzDnsZone -ResourceGroupName avec -Name (la zone et tous ses enregistrements disparaissent ; ajoute -Confirm pour être invité à confirmer).',
    },
  },
  // =========================================================================
  'cours-az-dns-enregistrement-a': {
    gui: {
      privileges: PRIV_DNS,
      etapes: [
        gui('Ajouter l’enregistrement A', 'modification', 'Un jeu d’enregistrements regroupe les enregistrements de même nom et de même type ; le nom est créé s’il n’existe pas.',
          ['Ouvre ta zone DNS (cherche **Zones DNS**, clique ta zone).', 'Clique **+ Jeu d’enregistrements**.', 'Saisis le **Nom** (`www`), choisis le **Type** **A**, laisse le **TTL** par défaut.', 'Saisis l’**Adresse IP** de la cible, par exemple `203.0.113.10`, puis clique **Ajouter**.'],
          'Le jeu d’enregistrements « www » de type A apparaît dans la liste de la zone.',
          { ecran: { blade: 'Ajouter un jeu d’enregistrements', fil: 'Zones DNS > contoso.com > Jeu d’enregistrements', champs: [{ label: 'Nom', valeur: 'www', marque: true }, { label: 'Type', valeur: 'A — Enregistrement d’adresse IPv4', genre: 'liste', marque: true }, { label: 'TTL', valeur: '1 heure', genre: 'liste' }, { label: 'Adresse IP', valeur: '203.0.113.10', marque: true }], bouton: 'Ajouter', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Ajouter un alias (CNAME)', 'modification', 'Un CNAME fait pointer un nom vers un autre nom. Un nom qui porte un CNAME ne peut porter aucun autre enregistrement.',
          ['Clique **+ Jeu d’enregistrements**.', 'Saisis le **Nom** de l’alias (`blog`) et choisis le **Type** **CNAME**.', 'Dans **Alias**, saisis le nom complet visé (`www.contoso.com`), puis clique **Ajouter**.'],
          'Le jeu d’enregistrements « blog » de type CNAME apparaît dans la liste.',
          { facultatif: true, ecran: { blade: 'Ajouter un jeu d’enregistrements', fil: 'Zones DNS > contoso.com > Jeu d’enregistrements', champs: [{ label: 'Nom', valeur: 'blog', marque: true }, { label: 'Type', valeur: 'CNAME — Alias vers un autre nom', genre: 'liste', marque: true }, { label: 'Alias', valeur: 'www.contoso.com', marque: true }], bouton: 'Ajouter', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Relire les enregistrements de la zone', 'lecture', 'Vérifie que la zone contient bien le nouvel enregistrement.',
          ['Reste dans la zone DNS, page **Vue d’ensemble**.', 'Dans la liste des jeux d’enregistrements, repère `www` (type A) et, si créé, `blog` (type CNAME).'],
          'Une ligne par jeu d’enregistrements, dont le nouvel enregistrement A.'),
        gui('Interroger directement un serveur de noms Azure', 'lecture', 'nslookup avec un serveur de noms Azure en second argument contourne la délégation : il fonctionne même si le domaine n’est pas encore délégué. Cette commande se lance sur ton poste, pas dans le portail.',
          ['Dans la page **Vue d’ensemble** de la zone, copie un des **Serveurs de noms**.', 'Sur ton poste, ouvre une invite de commandes (ou PowerShell).', 'Tape `nslookup www.contoso.com ns1-01.azure-dns.com` en remplaçant par ton nom et ton serveur.'],
          'L’adresse IPv4 enregistrée dans la réponse.',
          { ecran: { blade: 'Invite de commandes (ton poste)', fil: 'Poste local > nslookup', champs: [{ label: 'Commande', valeur: 'nslookup www.contoso.com ns1-01.azure-dns.com', marque: true }, { label: 'Réponse attendue', valeur: '203.0.113.10', genre: 'lecture' }], note: 'Hors du portail : reconstitution du résultat attendu.' } }),
      ],
      verification: ['Le nom interrogé auprès d’un serveur de noms Azure répond avec l’adresse enregistrée.'],
      retour: 'Pour retirer un enregistrement : dans la liste de la zone, coche le jeu d’enregistrements puis clique **Supprimer**.',
    },
    powershell: {
      privileges: PRIV_DNS,
      etapes: [
        CONNEXION,
        mod('Ajouter l’enregistrement A', 'Un jeu d’enregistrements regroupe les enregistrements de même nom et de même type ; ici on le crée avec une adresse IPv4.',
          [ps('New-AzDnsRecordSet -ResourceGroupName {{groupe}} -ZoneName {{zone}} -Name {{nom}} -RecordType A -Ttl 3600 -DnsRecords (New-AzDnsRecordConfig -IPv4Address {{adresse}})')], 'Un objet jeu d’enregistrements avec le nom, le type A et l’adresse.'),
        mod('Ajouter un alias (CNAME)', 'Un CNAME fait pointer un nom vers un autre nom. Un nom qui porte un CNAME ne peut porter aucun autre enregistrement.',
          [ps('New-AzDnsRecordSet -ResourceGroupName {{groupe}} -ZoneName {{zone}} -Name {{alias}} -RecordType CNAME -Ttl 3600 -DnsRecords (New-AzDnsRecordConfig -Cname {{cible}})')], 'Un objet jeu d’enregistrements de type CNAME visant le nom donné.', { facultatif: true }),
        lec('Lister les enregistrements', 'Relis ce que contient la zone.', [ps('Get-AzDnsRecordSet -ResourceGroupName {{groupe}} -ZoneName {{zone}} | Format-Table Name, RecordType, Ttl')], 'Une ligne par jeu d’enregistrements, dont le nouvel enregistrement A.'),
        lec('Interroger directement Azure', 'Resolve-DnsName avec -Server interroge un serveur de noms Azure et contourne la délégation : il répond même si le domaine n’est pas délégué.',
          [ps('Resolve-DnsName -Name {{nom}}.{{zone}} -Type A -Server {{serveur}}')], 'L’adresse IPv4 enregistrée dans la réponse.', { verification: true, important: 'Cette commande se lance sur ton poste. Si Resolve-DnsName n’existe pas chez toi, utilise nslookup.' }),
      ],
      verification: ['Le nom interrogé auprès d’un serveur de noms Azure répond avec l’adresse enregistrée.'],
      retour: 'Pour retirer un enregistrement : Remove-AzDnsRecordSet avec -Name, -RecordType, -ZoneName et -ResourceGroupName.',
    },
  },
  // =========================================================================
  'cours-az-dns-zone-privee': {
    gui: {
      privileges: PRIV,
      etapes: [
        gui('Créer la zone DNS privée', 'modification', 'Une zone privée n’est jamais visible depuis Internet et n’exige aucun bureau d’enregistrement.',
          ['Dans la barre de recherche, tape **Zones DNS privées**, ouvre le service puis clique **+ Créer**.', 'Onglet **Informations de base** : choisis le **Groupe de ressources** de ton laboratoire.', 'Saisis le **Nom** de la zone, par exemple `contoso.lab`.', 'Clique **Vérifier + créer**, puis **Créer**.'],
          'La zone privée apparaît dans la liste des zones DNS privées.',
          { ecran: { blade: 'Créer une zone DNS privée', fil: 'Accueil > Zones DNS privées > Créer', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: RG, valeur: 'rg-lab', genre: 'liste', marque: true }, { label: 'Nom', valeur: 'contoso.lab', marque: true }], bouton: 'Vérifier + créer', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Lier la zone au réseau virtuel', 'modification', 'Sans lien, les machines du VNet ne voient pas la zone. L’enregistrement automatique inscrit le nom de chaque machine du VNet dans la zone (un VNet ne peut inscrire que dans une seule zone).',
          ['Ouvre la zone privée, menu **Paramètres > Liens de réseau virtuel**, clique **+ Ajouter**.', 'Saisis le **Nom du lien** (`lien-vnet1`).', 'Choisis ton **Réseau virtuel** (`vnet1`).', 'Coche **Activer l’enregistrement automatique**, puis clique **OK** (ou **Créer**).'],
          'Le lien apparaît avec l’état de lien « Terminé » (Completed).',
          { ecran: { blade: 'Ajouter un lien de réseau virtuel', fil: 'Zone DNS privée > Liens de réseau virtuel > Ajouter', champs: [{ label: 'Nom du lien', valeur: 'lien-vnet1', marque: true }, { label: 'Réseau virtuel', valeur: 'vnet1', genre: 'liste', marque: true }, { label: 'Activer l’enregistrement automatique', valeur: 'coche', genre: 'case', marque: true }], bouton: 'OK', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Ajouter un enregistrement manuel', 'modification', 'Un enregistrement A à la main, pour un service qui n’est pas une machine inscrite automatiquement.',
          ['Dans la zone privée, **Vue d’ensemble**, clique **+ Jeu d’enregistrements**.', 'Saisis le **Nom** (`db`), **Type** **A**, et l’**Adresse IP** `10.1.1.4`.', 'Clique **OK** (ou **Ajouter**).'],
          'Le jeu d’enregistrements « db » apparaît dans la zone.',
          { facultatif: true, ecran: { blade: 'Ajouter un jeu d’enregistrements', fil: 'Zone DNS privée > contoso.lab > Jeu d’enregistrements', champs: [{ label: 'Nom', valeur: 'db', marque: true }, { label: 'Type', valeur: 'A — Enregistrement d’adresse IPv4', genre: 'liste' }, { label: 'Adresse IP', valeur: '10.1.1.4', marque: true }], bouton: 'OK', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Vérifier le lien et les enregistrements', 'lecture', 'Le lien doit être terminé ; la liste montre les enregistrements automatiques et manuels.',
          ['Dans la zone privée, ouvre **Liens de réseau virtuel** : contrôle l’état du lien et l’enregistrement automatique.', 'Reviens à **Vue d’ensemble** et lis les jeux d’enregistrements.'],
          'Un lien « Terminé » et les enregistrements de la zone.',
          { ecran: { blade: 'Liens de réseau virtuel', fil: 'Zone DNS privée > contoso.lab > Liens de réseau virtuel', champs: [{ label: 'Nom du lien', valeur: 'lien-vnet1', genre: 'lecture' }, { label: 'État du lien', valeur: 'Terminé', genre: 'lecture', marque: true }, { label: 'Enregistrement automatique', valeur: 'Activé', genre: 'lecture', marque: true }] } }),
      ],
      verification: ['Le lien est terminé et une machine du VNet résout le nom d’une autre par son nom complet (par exemple vm2.contoso.lab).'],
      retour: 'Pour défaire : supprime le lien (**Liens de réseau virtuel**, coche, **Supprimer**), puis la zone privée (**Supprimer** dans sa **Vue d’ensemble**).',
    },
    powershell: {
      privileges: PRIV,
      etapes: [
        CONNEXION,
        mod('Créer la zone privée', 'Une zone privée n’est jamais visible depuis Internet et n’exige aucun bureau d’enregistrement.',
          [ps('New-AzPrivateDnsZone -ResourceGroupName {{groupe}} -Name {{zone}}')], 'Un objet zone avec son nom.'),
        mod('Lier la zone au VNet', 'Sans lien, les machines du VNet ne voient pas la zone. -EnableRegistration inscrit automatiquement le nom de chaque machine du VNet (un VNet ne peut inscrire que dans une seule zone).',
          [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'), ps('New-AzPrivateDnsVirtualNetworkLink -ResourceGroupName {{groupe}} -ZoneName {{zone}} -Name {{lien}} -VirtualNetworkId $vn.Id -EnableRegistration')],
          'Un objet lien où VirtualNetworkLinkState vaut « Completed ».'),
        mod('Ajouter un enregistrement manuel', 'Un enregistrement A à la main, pour un service qui n’est pas une machine inscrite automatiquement.',
          [ps('New-AzPrivateDnsRecordSet -ResourceGroupName {{groupe}} -ZoneName {{zone}} -Name {{nom}} -RecordType A -Ttl 3600 -PrivateDnsRecords (New-AzPrivateDnsRecordConfig -Ipv4Address {{adresse}})')], 'Un objet jeu d’enregistrements avec le nom et l’adresse.', { facultatif: true }),
        lec('Vérifier le lien et les enregistrements', 'Le lien doit être « Completed » ; la liste montre les enregistrements automatiques et manuels.',
          [ps('Get-AzPrivateDnsVirtualNetworkLink -ResourceGroupName {{groupe}} -ZoneName {{zone}} | Format-Table Name, VirtualNetworkLinkState, RegistrationEnabled'), ps('Get-AzPrivateDnsRecordSet -ResourceGroupName {{groupe}} -ZoneName {{zone}} | Format-Table Name, RecordType, Ttl')],
          'Le lien vers le VNet, puis les enregistrements de la zone.', { verification: true }),
      ],
      verification: ['Le lien est « Completed » et une machine du VNet résout le nom d’une autre par son nom complet (par exemple vm2.contoso.lab).'],
      retour: 'Pour défaire : Remove-AzPrivateDnsVirtualNetworkLink (mêmes -ResourceGroupName, -ZoneName et -Name), puis Remove-AzPrivateDnsZone.',
    },
  },
  // =========================================================================
  'cours-az-peering-creer': {
    gui: {
      privileges: PRIV,
      etapes: [
        gui('Contrôler les deux plages d’adresses', 'lecture', 'Deux VNet qui se chevauchent ne peuvent pas être appairés.',
          ['Cherche **Réseaux virtuels** et ouvre le premier VNet (`vnet1`).', 'Menu **Paramètres > Espace d’adressage** : note la plage.', 'Fais de même pour le second VNet (`vnet2`).'],
          'Deux plages différentes qui ne se recoupent pas (par exemple 10.1.0.0/16 et 10.2.0.0/16).',
          { ecran: { blade: 'vnet1 — Espace d’adressage', fil: 'Réseaux virtuels > vnet1 > Espace d’adressage', champs: [{ label: 'Espace d’adressage', valeur: '10.1.0.0/16', genre: 'lecture', marque: true }], note: 'Compare avec le second VNet : par exemple 10.2.0.0/16.' } }),
        gui('Créer le premier demi-appairage (vnet1 vers vnet2)', 'modification', 'Un appairage est un objet qui appartient à UN VNet et pointe vers le VNet distant. Le portail sait créer les deux moitiés d’un coup (voir l’étape suivante) ; ici on les montre une à une, pour comprendre.',
          ['Ouvre **vnet1**, menu **Paramètres > Appairages**, clique **+ Ajouter**.', 'Section **Ce réseau virtuel** : **Nom du lien d’appairage** `vnet1-vers-vnet2`. Garde **Autoriser l’accès à \'vnet1\' depuis le réseau virtuel appairé** coché ; laisse **Trafic transféré** et **Passerelle** non cochés.', 'Section **Réseau virtuel distant** : **Nom du lien d’appairage** `vnet2-vers-vnet1`, **Réseau virtuel** `vnet2`, accès autorisé.', 'Clique **Ajouter**.'],
          'Le portail crée les deux appairages et les affiche avec l’état « Connecté ».',
          { important: 'Libellés du portail à confirmer : ils changent selon la version. Les deux cases d’accès (« accès au VNet appairé ») sont cochées par défaut.', ecran: { blade: 'Ajouter un appairage', fil: 'vnet1 > Appairages > Ajouter', champs: [{ label: 'Nom du lien d’appairage (ce VNet)', valeur: 'vnet1-vers-vnet2', marque: true }, { label: 'Autoriser l’accès au réseau virtuel appairé', valeur: 'coche', genre: 'case', marque: true }, { label: 'Autoriser le trafic transféré', valeur: 'vide', genre: 'case' }, { label: 'Passerelle (transit)', valeur: 'vide', genre: 'case' }, { label: 'Nom du lien (VNet distant)', valeur: 'vnet2-vers-vnet1', marque: true }, { label: 'Réseau virtuel distant', valeur: 'vnet2', genre: 'liste', marque: true }], bouton: 'Ajouter', note: 'Reconstitution : libellés à confirmer dans ton portail.' } }),
        gui('Contrôler le second demi-appairage (vnet2 vers vnet1)', 'modification', 'Sans cette seconde moitié, l’état reste « Lancé » (Initiated) et rien ne circule. Si tu as utilisé le portail à l’étape précédente, elle existe déjà : vérifie-la ; sinon crée-la depuis vnet2.',
          ['Ouvre **vnet2**, menu **Paramètres > Appairages**.', 'Si `vnet2-vers-vnet1` manque, clique **+ Ajouter**, nomme le lien `vnet2-vers-vnet1`, choisis **Réseau virtuel** `vnet1`, accès autorisé, puis **Ajouter**.', 'Sinon, contrôle seulement que l’état est **Connecté**.'],
          'L’appairage depuis vnet2 existe avec l’état « Connecté ».',
          { ecran: { blade: 'Ajouter un appairage', fil: 'vnet2 > Appairages > Ajouter', champs: [{ label: 'Nom du lien d’appairage (ce VNet)', valeur: 'vnet2-vers-vnet1', marque: true }, { label: 'Réseau virtuel', valeur: 'vnet1', genre: 'liste', marque: true }, { label: 'Autoriser l’accès au réseau virtuel appairé', valeur: 'coche', genre: 'case', marque: true }, { label: 'Autoriser le trafic transféré', valeur: 'vide', genre: 'case' }], bouton: 'Ajouter', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Vérifier l’état des deux appairages', 'lecture', 'Les deux appairages doivent être « Connecté ».',
          ['Dans **vnet1 > Appairages**, lis la colonne **État de l’appairage**.', 'Fais de même dans **vnet2 > Appairages**.'],
          'Une ligne par appairage avec l’état Connecté.',
          { ecran: { blade: 'vnet1 — Appairages', fil: 'Réseaux virtuels > vnet1 > Appairages', champs: [{ label: 'Nom', valeur: 'vnet1-vers-vnet2', genre: 'lecture' }, { label: 'État de l’appairage', valeur: 'Connecté', genre: 'lecture', marque: true }, { label: 'Réseau virtuel distant', valeur: 'vnet2', genre: 'lecture' }] } }),
      ],
      verification: ['Les deux appairages sont « Connecté » et une machine d’un VNet joint la machine de l’autre par son adresse privée.'],
      retour: 'Pour défaire : dans chaque VNet, **Appairages**, coche l’appairage puis clique **Supprimer**.',
    },
    powershell: {
      privileges: PRIV,
      etapes: [
        CONNEXION,
        lec('Contrôler les deux plages', 'Deux VNet qui se chevauchent ne peuvent pas être appairés.',
          [ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet1}}).AddressSpace.AddressPrefixes'), ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet2}}).AddressSpace.AddressPrefixes')],
          'Deux plages différentes qui ne se recoupent pas (par exemple 10.1.0.0/16 et 10.2.0.0/16).'),
        mod('Créer le demi-appairage du premier vers le second', 'Un appairage appartient à UN VNet et pointe vers le VNet distant (par son identifiant). L’accès au VNet appairé est autorisé par défaut ; -AllowForwardedTraffic, -AllowGatewayTransit et -UseRemoteGateways sont des options à ajouter seulement si le sujet le demande.',
          [ps('$v1 = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet1}}'), ps('$v2 = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet2}}'), ps('Add-AzVirtualNetworkPeering -Name "{{vnet1}}-vers-{{vnet2}}" -VirtualNetwork $v1 -RemoteVirtualNetworkId $v2.Id')],
          'Un objet appairage où PeeringState vaut « Initiated » : l’autre sens manque encore.'),
        mod('Créer le demi-appairage en sens inverse', 'Sans cette seconde moitié, l’état reste « Initiated » et rien ne circule.',
          [ps('$v1 = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet1}}'), ps('$v2 = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet2}}'), ps('Add-AzVirtualNetworkPeering -Name "{{vnet2}}-vers-{{vnet1}}" -VirtualNetwork $v2 -RemoteVirtualNetworkId $v1.Id')],
          'Un objet appairage où PeeringState vaut « Connected ».'),
        lec('Vérifier', 'Les deux appairages doivent être « Connected ».',
          [ps('Get-AzVirtualNetworkPeering -ResourceGroupName {{groupe}} -VirtualNetworkName {{vnet1}} | Format-Table Name, PeeringState'), ps('Get-AzVirtualNetworkPeering -ResourceGroupName {{groupe}} -VirtualNetworkName {{vnet2}} | Format-Table Name, PeeringState')],
          'Une ligne par appairage avec PeeringState à Connected.', { verification: true }),
      ],
      verification: ['Les deux appairages sont « Connected » et une machine d’un VNet joint la machine de l’autre par son adresse privée.'],
      retour: 'Pour défaire : Remove-AzVirtualNetworkPeering dans chaque VNet, avec -Name, -VirtualNetworkName et -ResourceGroupName.',
      depannage: [
        { symptome: 'L’état reste « Initiated »', cause: 'Seul un sens de l’appairage a été créé.', action: 'Crée l’appairage dans l’autre VNet, vers le premier.' },
        { symptome: 'Azure refuse de créer l’appairage', cause: 'Les espaces d’adressage des deux VNet se chevauchent.', action: 'Relis les plages ; change celle d’un VNet vide ou recrée-le avec une autre plage.' },
      ],
    },
  },
  // =========================================================================
  'cours-az-peering-verifier': {
    gui: {
      privileges: PRIV_LECTURE,
      etapes: [
        gui('Lister les appairages du VNet', 'lecture', 'Une ligne par appairage, avec son état.',
          ['Cherche **Réseaux virtuels** et ouvre ton VNet.', 'Menu **Paramètres > Appairages**.', 'Lis le **Nom**, l’**État de l’appairage** et le **Réseau virtuel distant** de chaque ligne.'],
          'Le nom, l’état et le réseau distant de chaque appairage.',
          { ecran: { blade: 'vnet1 — Appairages', fil: 'Réseaux virtuels > vnet1 > Appairages', champs: [{ label: 'Nom', valeur: 'vnet1-vers-vnet2', genre: 'lecture' }, { label: 'État de l’appairage', valeur: 'Connecté', genre: 'lecture', marque: true }, { label: 'Réseau virtuel distant', valeur: 'vnet2', genre: 'lecture' }], note: 'États possibles : Connecté, Lancé (Initiated), Déconnecté — libellés à confirmer.' } }),
        gui('Lire le détail d’un appairage', 'lecture', 'Ouvre l’appairage pour voir ses cases : accès au réseau appairé, trafic transféré, passerelle.',
          ['Clique le nom de l’appairage dans la liste.', 'Lis l’**État de l’appairage** et les cases cochées (accès au VNet appairé, trafic transféré, passerelle).'],
          'Connecté, Lancé ou Déconnecté, et les options de l’appairage.',
          { ecran: { blade: 'Modifier l’appairage', fil: 'vnet1 > Appairages > vnet1-vers-vnet2', champs: [{ label: 'État de l’appairage', valeur: 'Connecté', genre: 'lecture', marque: true }, { label: 'Autoriser l’accès au réseau virtuel appairé', valeur: 'coche', genre: 'case', marque: true }, { label: 'Autoriser le trafic transféré', valeur: 'vide', genre: 'case' }], note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Relire la plage du VNet', 'lecture', 'Compare-la à celle du réseau distant : elles ne doivent pas se recouper.',
          ['Dans le VNet, menu **Paramètres > Espace d’adressage**.', 'Note la plage et compare-la à celle du VNet distant.'],
          'La plage du VNet (par exemple 10.1.0.0/16).',
          { ecran: { blade: 'vnet1 — Espace d’adressage', fil: 'Réseaux virtuels > vnet1 > Espace d’adressage', champs: [{ label: 'Espace d’adressage', valeur: '10.1.0.0/16', genre: 'lecture', marque: true }] } }),
      ],
      verification: ['Les deux sens de l’appairage sont « Connecté ».'],
      retour: null,
    },
    powershell: {
      privileges: PRIV_LECTURE,
      etapes: [
        CONNEXION,
        lec('Lister les appairages du VNet', 'Une ligne par appairage, avec son état.', [ps('Get-AzVirtualNetworkPeering -ResourceGroupName {{groupe}} -VirtualNetworkName {{vnet}} | Format-Table Name, PeeringState')], 'Le nom et l’état (PeeringState) de chaque appairage.'),
        lec('Lire l’état d’un appairage', 'Affiche l’état et les options de l’appairage choisi.', [ps('Get-AzVirtualNetworkPeering -ResourceGroupName {{groupe}} -VirtualNetworkName {{vnet}} -Name {{appairage}} | Format-List Name, PeeringState, AllowVirtualNetworkAccess, AllowForwardedTraffic')], 'Connected, Initiated ou Disconnected.', { verification: true, important: 'Si une propriété manque dans l’affichage, lance la commande sans Format-List et lis l’objet complet (vérifie avec Get-Help Get-AzVirtualNetworkPeering).' }),
        lec('Relire la plage du VNet', 'Compare-la à celle du réseau distant : elles ne doivent pas se recouper.', [ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}).AddressSpace.AddressPrefixes')], 'La plage du VNet (par exemple 10.1.0.0/16).'),
      ],
      verification: ['Les deux sens de l’appairage sont « Connected ».'],
      retour: null,
      depannage: [
        { symptome: 'Initiated', cause: 'Le sens inverse n’existe pas encore.', action: 'Crée l’appairage dans l’autre VNet.' },
        { symptome: 'Disconnected', cause: 'L’appairage de l’autre côté a été supprimé.', action: 'Recrée-le dans l’autre VNet, ou supprime ce côté et refais les deux.' },
      ],
    },
  },
  // =========================================================================
  'cours-az-routes-effectives': {
    gui: {
      privileges: PRIV,
      etapes: [
        gui('Repérer l’interface réseau de la machine', 'lecture', 'La machine doit être allumée : les routes effectives ne se lisent que dans ce cas.',
          ['Cherche **Machines virtuelles**, ouvre ta machine et vérifie que son état est **En cours d’exécution**.', 'Menu **Mise en réseau > Paramètres réseau** : note le nom de l’interface réseau (par exemple `vm1VMNic`).'],
          'Le nom de l’interface réseau de la machine.',
          { ecran: { blade: 'vm1 — Paramètres réseau', fil: 'Machines virtuelles > vm1 > Mise en réseau', champs: [{ label: 'Interface réseau', valeur: 'vm1VMNic', genre: 'lecture', marque: true }, { label: 'État de la machine', valeur: 'En cours d’exécution', genre: 'lecture' }], note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Ouvrir les routes effectives', 'lecture', 'Chaque ligne donne la source (Par défaut, Utilisateur, Passerelle), l’état (Actif ou Non valide), le préfixe et le tronçon suivant.',
          ['Clique l’interface réseau pour l’ouvrir.', 'Menu **Aide > Itinéraires valides** (**Routes effectives** selon la version).', 'Lis le tableau : **Source**, **État**, **Préfixes d’adresse**, **Type de tronçon suivant**.'],
          'Les routes système (le VNet, 0.0.0.0/0 vers Internet, blocs privés vers Aucun), puis celles de l’appairage et les routes personnalisées s’il y en a.',
          { important: 'La plus précise gagne : un préfixe plus long l’emporte sur 0.0.0.0/0, et une route personnalisée l’emporte sur une route système de même préfixe.', ecran: { blade: 'Itinéraires valides', fil: 'Interface réseau > Aide > Itinéraires valides', champs: [{ label: 'Source', valeur: 'Par défaut', genre: 'lecture' }, { label: 'État', valeur: 'Actif', genre: 'lecture', marque: true }, { label: 'Préfixe d’adresse', valeur: '10.1.0.0/16', genre: 'lecture', marque: true }, { label: 'Tronçon suivant', valeur: 'Réseau virtuel', genre: 'lecture', marque: true }], note: 'Libellé du menu à confirmer (Itinéraires valides ou Routes effectives).' } }),
      ],
      verification: ['La route attendue figure à l’état Actif, avec le bon tronçon suivant.'],
      retour: null,
    },
    powershell: {
      privileges: PRIV,
      etapes: [
        CONNEXION,
        lec('Lister les interfaces du groupe', 'Repère l’interface de la machine qui t’intéresse.', [ps('Get-AzNetworkInterface -ResourceGroupName {{groupe}} | Format-Table Name, Location')], 'Une ligne par interface réseau, avec sa région.'),
        lec('Lire les routes effectives', 'Chaque ligne donne la source (Default, User, VirtualNetworkGateway), l’état (Active ou Invalid), le préfixe et le tronçon suivant. La machine doit être allumée.',
          [ps('Get-AzEffectiveRouteTable -ResourceGroupName {{groupe}} -NetworkInterfaceName {{nic}} | Format-Table Source, State, AddressPrefix, NextHopType, NextHopIpAddress')],
          'Les routes système (le VNet, 0.0.0.0/0 vers Internet, blocs privés vers None), puis celles de l’appairage et les routes personnalisées s’il y en a.',
          { verification: true, important: 'La plus précise gagne : un préfixe plus long l’emporte sur 0.0.0.0/0, et une route personnalisée l’emporte sur une route système de même préfixe. Vérifie le nom du cmdlet avec Get-Help Get-AzEffectiveRouteTable.' }),
      ],
      verification: ['La route attendue figure à l’état Active, avec le bon tronçon suivant.'],
      retour: null,
      depannage: [
        { symptome: 'La commande échoue avec « machine non allumée »', cause: 'Les routes effectives ne se lisent que si la machine de l’interface est en marche.', action: 'Démarre la machine, ou lis plutôt la table de routage associée au sous-réseau.' },
        { symptome: 'Une route attendue est « Invalid »', cause: 'Une route de plus de précision ou de source prioritaire la remplace.', action: 'Compare les préfixes et les sources ; retire ou corrige la route personnalisée en cause.' },
      ],
    },
  },
  // =========================================================================
  'cours-az-route-personnalisee': {
    gui: {
      privileges: PRIV,
      etapes: [
        gui('Créer la table de routage', 'modification', 'Une table vide ne change rien tant qu’elle n’est pas associée à un sous-réseau.',
          ['Cherche **Tables de routage**, clique **+ Créer**.', 'Onglet **Informations de base** : **Groupe de ressources**, **Région** (celle du VNet), **Nom** `rt-lab`.', 'Laisse **Propager les routes de la passerelle** tel quel, puis clique **Vérifier + créer** et **Créer**.'],
          'La table de routage apparaît dans la liste.',
          { ecran: { blade: 'Créer une table de routage', fil: 'Accueil > Tables de routage > Créer', onglets: ['Informations de base', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: RG, valeur: 'rg-lab', genre: 'liste', marque: true }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste', marque: true }, { label: 'Nom', valeur: 'rt-lab', marque: true }], bouton: 'Vérifier + créer', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Ajouter la route', 'modification', 'Le type de tronçon « Appliance virtuelle » envoie le trafic vers une adresse privée. D’autres existent : Aucun (supprime le trafic), Passerelle de réseau virtuel, Internet, Réseau virtuel.',
          ['Ouvre la table de routage, menu **Paramètres > Itinéraires** (**Routes**), clique **+ Ajouter**.', 'Saisis le **Nom de l’itinéraire** `vers-db-par-pare-feu`.', 'Choisis **Destination** : **Adresses IP**, puis **Adresses IP de destination / plages CIDR** `10.1.1.0/24`.', 'Choisis **Type de tronçon suivant** : **Appliance virtuelle**, et **Adresse du tronçon suivant** `10.1.2.4`.', 'Clique **Ajouter**.'],
          'La route apparaît dans la table avec son tronçon suivant.',
          { ecran: { blade: 'Ajouter un itinéraire', fil: 'Table de routage > rt-lab > Itinéraires > Ajouter', champs: [{ label: 'Nom de l’itinéraire', valeur: 'vers-db-par-pare-feu', marque: true }, { label: 'Type de destination', valeur: 'Adresses IP', genre: 'liste' }, { label: 'Plages CIDR de destination', valeur: '10.1.1.0/24', marque: true }, { label: 'Type de tronçon suivant', valeur: 'Appliance virtuelle', genre: 'liste', marque: true }, { label: 'Adresse du tronçon suivant', valeur: '10.1.2.4', marque: true }], bouton: 'Ajouter', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Activer le transfert IP sur l’appliance', 'modification', 'Sans transfert IP, Azure jette les paquets qui ne sont pas destinés à l’appliance elle-même. Active aussi le transfert dans son système d’exploitation.',
          ['Ouvre l’interface réseau de l’appliance (par exemple `fw1VMNic`).', 'Menu **Paramètres > Paramètres IP**.', 'Coche **Activer le transfert IP**, puis clique **Enregistrer**.'],
          'La case « Activer le transfert IP » est cochée.',
          { facultatif: true, ecran: { blade: 'Paramètres IP — interface réseau', fil: 'Interface réseau > fw1VMNic > Paramètres IP', champs: [{ label: 'Transfert IP', valeur: 'coche', genre: 'case', marque: true }], bouton: 'Enregistrer', note: 'Libellé à confirmer dans ton portail.' } }),
        gui('Associer la table au sous-réseau', 'interruption', 'À partir de là, le trafic sortant du sous-réseau suit la nouvelle route. Si l’appliance est absente ou ne transmet pas, ce trafic est perdu.',
          ['Dans la table de routage, menu **Paramètres > Sous-réseaux**, clique **+ Associer**.', 'Choisis le **Réseau virtuel** (`vnet1`) et le **Sous-réseau** (`app`).', 'Clique **OK**.'],
          'Le sous-réseau figure dans la liste des sous-réseaux de la table.',
          { important: 'Teste d’abord en laboratoire. Un mauvais saut coupe le sous-réseau de la destination.', ecran: { blade: 'Associer un sous-réseau', fil: 'Table de routage > rt-lab > Sous-réseaux > Associer', champs: [{ label: 'Réseau virtuel', valeur: 'vnet1', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'app', genre: 'liste', marque: true }], bouton: 'OK', note: 'Libellés à confirmer dans ton portail.' } }),
        gui('Vérifier la route et les routes effectives', 'lecture', 'Relis la route, puis contrôle qu’elle apparaît bien dans les routes effectives d’une machine du sous-réseau.',
          ['Dans la table de routage, ouvre **Itinéraires** : contrôle la route.', 'Ouvre une machine du sous-réseau allumée, son interface réseau, puis **Aide > Itinéraires valides**.', 'Repère la ligne de source **Utilisateur**, état **Actif**.'],
          'La route avec son tronçon suivant, source Utilisateur, état Actif.',
          { ecran: { blade: 'Itinéraires valides', fil: 'Interface réseau > Aide > Itinéraires valides', champs: [{ label: 'Source', valeur: 'Utilisateur', genre: 'lecture', marque: true }, { label: 'État', valeur: 'Actif', genre: 'lecture', marque: true }, { label: 'Préfixe d’adresse', valeur: '10.1.1.0/24', genre: 'lecture' }, { label: 'Tronçon suivant', valeur: 'Appliance virtuelle (10.1.2.4)', genre: 'lecture' }], note: 'Libellé du menu à confirmer.' } }),
      ],
      verification: ['La route figure dans la table, la table est associée au sous-réseau, et les routes effectives d’une machine du sous-réseau montrent la nouvelle route (source Utilisateur, état Actif).'],
      retour: 'Pour défaire : dans la table de routage, **Sous-réseaux**, clique le sous-réseau puis **Dissocier** ; ensuite supprime la route (**Itinéraires**) et la table (**Supprimer**).',
    },
    powershell: {
      privileges: PRIV,
      etapes: [
        CONNEXION,
        mod('Créer la table de routage', 'Une table vide ne change rien tant qu’elle n’est pas associée à un sous-réseau.',
          [ps('New-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}} -Location {{region}}')], 'Un objet table avec ProvisioningState = Succeeded.'),
        mod('Ajouter la route', 'VirtualAppliance envoie le trafic vers une adresse privée. On ajoute la route à l’objet table, puis on enregistre la table.',
          [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}}'),
            ps('Add-AzRouteConfig -RouteTable $rt -Name {{route}} -AddressPrefix {{prefixe}} -NextHopType VirtualAppliance -NextHopIpAddress {{saut}}'),
            ps('Set-AzRouteTable -RouteTable $rt')],
          'La table avec sa route : préfixe, NextHopType VirtualAppliance et adresse du saut.'),
        mod('Activer le transfert IP sur l’appliance', 'Sans transfert IP, Azure jette les paquets qui ne sont pas destinés à l’appliance elle-même. Active aussi le transfert dans son système d’exploitation.',
          [ps('$nic = Get-AzNetworkInterface -ResourceGroupName {{groupe}} -Name {{nicAppliance}}'), ps('$nic.EnableIPForwarding = $true'), ps('$nic | Set-AzNetworkInterface')],
          'Un objet interface où EnableIPForwarding vaut True.', { facultatif: true }),
        itr('Associer la table au sous-réseau', 'À partir de cette commande, le trafic sortant du sous-réseau suit la nouvelle route. Si l’appliance est absente ou ne transmet pas, ce trafic est perdu. On relit le sous-réseau, on lui donne la table, puis on enregistre le VNet.',
          [ps('$rt = Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}}'),
            ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
            ps('$sn = Get-AzVirtualNetworkSubnetConfig -VirtualNetwork $vn -Name {{sousReseau}}'),
            ps('Set-AzVirtualNetworkSubnetConfig -VirtualNetwork $vn -Name {{sousReseau}} -AddressPrefix $sn.AddressPrefix -RouteTable $rt'),
            ps('$vn | Set-AzVirtualNetwork')],
          'Le VNet mis à jour ; le sous-réseau porte la table de routage.',
          { important: 'Teste d’abord en laboratoire. Si le sous-réseau a déjà des options (groupe de sécurité, délégation), vérifie avec Get-Help Set-AzVirtualNetworkSubnetConfig qu’elles sont conservées.' }),
        lec('Vérifier', 'Relis la route, puis la table associée au sous-réseau.',
          [ps('(Get-AzRouteTable -ResourceGroupName {{groupe}} -Name {{tableRoutage}}).Routes | Format-Table Name, AddressPrefix, NextHopType, NextHopIpAddress'),
            ps('(Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}} | Select-Object -ExpandProperty Subnets | Where-Object Name -eq "{{sousReseau}}").RouteTable.Id')],
          'La route avec son tronçon suivant, puis l’identifiant de la table du sous-réseau.', { verification: true }),
      ],
      verification: ['La route figure dans la table, la table est associée au sous-réseau, et les routes effectives d’une machine du sous-réseau montrent la nouvelle route (source User, état Active).'],
      retour: 'Pour défaire : dissocie la table du sous-réseau (portail : Sous-réseaux, Dissocier ; ou Set-AzVirtualNetworkSubnetConfig sans -RouteTable), puis Remove-AzRouteConfig et Remove-AzRouteTable.',
      depannage: [
        { symptome: 'Le trafic du sous-réseau ne passe plus après l’association', cause: 'L’appliance est éteinte, n’a pas le transfert IP, ou son système ne transmet pas les paquets.', action: 'Active le transfert IP sur l’interface et dans le système, ou dissocie la table pour rétablir les routes système.' },
      ],
    },
  },
};

void des;
