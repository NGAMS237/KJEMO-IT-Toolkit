/**
 * azure-multi-app.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * Méthodes « gui » (portail Azure, écrans reconstitués) et « powershell »
 * (module Az) des fiches App Service et stockage du TP. Rien n'est exécuté
 * dans Azure ; les écrans sont des reconstitutions, pas des captures.
 * La chaîne de connexion du stockage n'est JAMAIS écrite : lue par cmdlet
 * dans une variable (PowerShell) ou collée par l'utilisateur (portail).
 */
import { lec, mod, des, itr, ps, gui } from './cours-outils.mjs';

const PRIV = 'Compte Azure avec le rôle Contributeur sur le groupe de ressources visé ; connecté par toi-même (portail ou `Connect-AzAccount`).';
const CTX = lec('Se connecter et vérifier l’abonnement', 'Connecte-toi toi-même (fenêtre de connexion) et confirme que tu travailles dans le bon abonnement : c’est lui qui sera facturé.',
  [ps('Connect-AzAccount'), ps('Get-AzContext | Format-List Name, Subscription')], 'Le nom de l’abonnement actif.');
const LIBELLE = 'Reconstitution du portail : libellé à confirmer à l’écran.';

// ===========================================================================
// 1. Créer l'application
// ===========================================================================
const CREER_GUI = [
  gui('Ouvrir l’assistant de création d’application web', 'lecture', 'Tout part du service App Services ; l’assistant a plusieurs onglets.',
    ['Dans la barre de recherche du portail, tape **App Services** et ouvre le service.', 'Clique **+ Créer**, puis **Application web**.'],
    'L’assistant « Créer une application web » s’ouvre sur l’onglet Informations de base.',
    { ecran: { blade: 'App Services', fil: 'Accueil > App Services', champs: [{ label: 'Menu', valeur: '+ Créer > Application web', genre: 'lecture', marque: true }], bouton: '+ Créer' } }),
  gui('Remplir les informations de base', 'modification', 'Le TP utilise une application en conteneur Linux. Le nom forme l’adresse <nom>.azurewebsites.net et doit être unique dans tout Azure.',
    ['Onglet **Informations de base** : choisis ton **Groupe de ressources**.', 'Saisis le **Nom** de l’application (ex. `webapp1-tardi`).', '**Publier** : **Conteneur** ; **Système d’exploitation** : **Linux** ; choisis la **Région**.'],
    'Les champs de base sont remplis, sans erreur rouge.',
    { ecran: { blade: 'Créer une application web', fil: 'Accueil > App Services > Créer > Application web', onglets: ['Informations de base', 'Base de données', 'Conteneur', 'Mise en réseau', 'Supervision', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Groupe de ressources', valeur: 'rg-tardi', genre: 'liste', marque: true }, { label: 'Nom', valeur: 'webapp1-tardi', marque: true }, { label: 'Publier', valeur: 'Conteneur', genre: 'liste', marque: true }, { label: 'Système d’exploitation', valeur: 'Linux', genre: 'liste', marque: true }, { label: 'Région', valeur: 'Canada Centre', genre: 'liste' }], bouton: 'Suivant : Base de données', note: LIBELLE } }),
  gui('Créer le plan et choisir son niveau', 'modification', 'Le plan fixe le niveau tarifaire. B1 (De base) permet l’intégration au VNet et les points privés ; il est facturé tant que le plan existe.',
    ['Sous **Plan tarifaire**, clique **Créer nouveau** et saisis le nom du plan (ex. `asp-tardi`).', 'Dans **Plan tarifaire**, clique **Explorer les plans tarifaires** puis choisis **De base B1** (le TP le demande) et **Sélectionner**.'],
    'Le plan et le niveau B1 apparaissent dans l’onglet.',
    { ecran: { blade: 'Créer une application web', fil: 'Accueil > App Services > Créer > Application web', onglets: ['Informations de base', 'Base de données', 'Conteneur', 'Mise en réseau', 'Supervision', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Plan Linux', valeur: 'asp-tardi (nouveau)', genre: 'liste', marque: true }, { label: 'Plan tarifaire', valeur: 'De base B1', genre: 'liste', marque: true }], note: LIBELLE } }),
  gui('Indiquer l’image du conteneur', 'modification', 'Équivalent de l’onglet « Conteneur » : l’image se tire d’un registre (Docker Hub par défaut) avec son étiquette.',
    ['Va à l’onglet **Conteneur**.', '**Source de l’image** : **Autres registres de conteneurs** ; **Type d’accès** : **Public**.', 'Saisis l’image et l’étiquette (ex. `romaric/tpasr:latest`) ; si un champ **Port** existe, mets `8080`.'],
    'Les champs Conteneur sont remplis.',
    { ecran: { blade: 'Créer une application web', fil: 'Accueil > App Services > Créer > Application web', onglets: ['Informations de base', 'Base de données', 'Conteneur', 'Mise en réseau', 'Supervision', 'Vérifier + créer'], actif: 2, champs: [{ label: 'Source de l’image', valeur: 'Autres registres de conteneurs', genre: 'liste', marque: true }, { label: 'Type d’accès', valeur: 'Public', genre: 'liste' }, { label: 'Image et étiquette', valeur: 'romaric/tpasr:latest', marque: true }, { label: 'Port', valeur: '8080', marque: true }], note: LIBELLE + ' Le champ Port peut ne pas exister : l’étape suivante règle le port de toute façon.' } }),
  gui('Vérifier et créer', 'modification', 'Le portail valide l’ensemble avant de déployer.',
    ['Clique **Vérifier + créer**, lis le résumé (région, plan B1), puis clique **Créer**.', 'Attends « Votre déploiement est terminé », puis **Accéder à la ressource**.'],
    'L’application est déployée ; la page Vue d’ensemble s’affiche.',
    { ecran: { blade: 'Créer une application web', fil: 'Accueil > App Services > Créer > Application web', onglets: ['Informations de base', 'Conteneur', 'Mise en réseau', 'Vérifier + créer'], actif: 3, champs: [{ label: 'Validation', valeur: 'Validation réussie', genre: 'lecture' }], bouton: 'Créer' } }),
  gui('Indiquer le port du conteneur', 'modification', 'App Service ne devine pas le port : le réglage WEBSITES_PORT le lui donne. Sans lui, l’application peut démarrer mais rester inaccessible.',
    ['Dans l’application, ouvre **Paramètres > Variables d’environnement**, onglet **Paramètres de l’application**.', 'Clique **+ Ajouter** : **Nom** `WEBSITES_PORT`, **Valeur** `8080`, puis **OK**.', 'Clique **Appliquer** puis **Confirmer** (l’application redémarre).'],
    'WEBSITES_PORT apparaît dans la liste avec la valeur 8080.',
    { ecran: { blade: 'Variables d’environnement', fil: 'App Service > Paramètres > Variables d’environnement', onglets: ['Paramètres de l’application', 'Chaînes de connexion'], actif: 0, champs: [{ label: 'Nom', valeur: 'WEBSITES_PORT', marque: true }, { label: 'Valeur', valeur: '8080', marque: true }], bouton: 'Appliquer', note: LIBELLE + ' Sur un portail plus ancien : Paramètres > Configuration.' } }),
  gui('Donner la chaîne de connexion du stockage', 'modification', 'La chaîne est un secret : elle n’apparaît nulle part dans cette fiche. Tu la copies toi-même depuis le compte de stockage et tu la colles ici, sans la montrer dans un rapport ou une capture.',
    ['Ouvre le compte de stockage, **Sécurité + mise en réseau > Clés d’accès**, clique **Afficher** sous **Chaîne de connexion** puis copie-la.', 'Reviens dans l’application : **Paramètres > Variables d’environnement**, onglet **Chaînes de connexion**, **+ Ajouter**.', '**Nom** : `StorageConnectionString` ; **Valeur** : colle la chaîne copiée ; **Type** : **Personnalisé**. Clique **OK**, puis **Appliquer**.'],
    'StorageConnectionString figure dans la liste (la valeur reste masquée).',
    { ecran: { blade: 'Variables d’environnement', fil: 'App Service > Paramètres > Variables d’environnement', onglets: ['Paramètres de l’application', 'Chaînes de connexion'], actif: 1, champs: [{ label: 'Nom', valeur: 'StorageConnectionString', marque: true }, { label: 'Valeur', valeur: '(collée par toi, masquée)', marque: true }, { label: 'Type', valeur: 'Personnalisé', genre: 'liste', marque: true }], bouton: 'Appliquer', note: LIBELLE }, important: 'Ne colle jamais la chaîne dans un rapport, un courriel ou une capture : elle donne accès au compte.' }),
  gui('Lire l’adresse et l’état', 'lecture', 'Ouvre l’adresse : sur le TP2, les liens Messages et Lister Blobs doivent répondre.',
    ['Sur **Vue d’ensemble**, relève l’**URL par défaut** et l’**État**.', 'Clique l’URL pour ouvrir l’application dans un navigateur.'],
    'L’adresse <nom>.azurewebsites.net et l’état « En cours d’exécution ».',
    { ecran: { blade: 'Vue d’ensemble — application web', fil: 'App Service > Vue d’ensemble', champs: [{ label: 'État', valeur: 'En cours d’exécution', genre: 'lecture' }, { label: 'URL par défaut', valeur: 'webapp1-tardi.azurewebsites.net', genre: 'lecture', marque: true }], note: LIBELLE } }),
  gui('Revenir au plan gratuit entre deux séances', 'modification', 'Un plan B1 est facturé même si l’application est arrêtée. Le niveau gratuit retire l’intégration au VNet et les points privés : ne le fais qu’à la fin du travail.',
    ['Ouvre le **plan App Service**, menu **Mise à l’échelle (plan App Service)** (ou **Augmenter la taille**).', 'Choisis **Dev/Test**, **Gratuit F1**, puis **Appliquer**.'],
    'Le plan affiche le niveau F1.',
    { ecran: { blade: 'Augmenter la taille', fil: 'Plan App Service > Mise à l’échelle', champs: [{ label: 'Niveau', valeur: 'Dev/Test', genre: 'liste' }, { label: 'Plan', valeur: 'Gratuit F1', genre: 'liste', marque: true }], bouton: 'Appliquer', note: LIBELLE }, facultatif: true }),
];

const CREER_PS = [
  CTX,
  mod('Créer le plan App Service Linux', 'Le plan fixe le système (Linux) et le niveau. Basic + Small correspond à B1 ; il est facturé tant que le plan existe.',
    [ps('New-AzAppServicePlan -ResourceGroupName {{groupe}} -Name {{plan}} -Location {{region}} -Tier Basic -WorkerSize Small -Linux')], 'Le plan avec Status = Ready et le niveau Basic.',
    { important: 'Ces lignes créent B1. Pour un autre niveau (voir le paramètre « niveau du plan »), change -Tier ; vérifie avec Get-Help New-AzAppServicePlan.' }),
  mod('Créer l’application à partir de l’image', 'Équivalent de l’onglet « Conteneur » du portail : l’image et son étiquette.',
    [ps('New-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}} -Location {{region}} -AppServicePlan {{plan}} -ContainerImageName {{image}}')], 'L’application avec State = Running et un DefaultHostName.',
    { important: 'La syntaxe du conteneur dépend de la version du module Az.Websites : si -ContainerImageName est refusé, vérifie avec Get-Help New-AzWebApp ou crée l’application dans le portail.' }),
  mod('Indiquer le port du conteneur', 'Set-AzWebApp -AppSettings REMPLACE tous les réglages : on relit donc les existants, on ajoute WEBSITES_PORT, puis on réécrit.',
    [ps('$app = Get-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}}'),
      ps('$h = @{}; foreach ($s in $app.SiteConfig.AppSettings) { $h[$s.Name] = $s.Value }'),
      ps('$h["WEBSITES_PORT"] = "{{port}}"'),
      ps('Set-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}} -AppSettings $h | Out-Null')],
    'Aucune erreur ; relis ensuite les réglages pour voir WEBSITES_PORT.', { important: 'Compare avec le portail (Variables d’environnement) : les réglages existants doivent y rester.' }),
  mod('Donner la chaîne de connexion du stockage', 'La chaîne est lue par un cmdlet dans une variable et passée à l’application sans jamais s’afficher. Set-AzWebApp -ConnectionStrings remplace aussi toute la liste existante.',
    [ps('$cpt = Get-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}}'),
      ps('$cnx = @{ StorageConnectionString = @{ Type = "Custom"; Value = $cpt.Context.ConnectionString } }'),
      ps('Set-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}} -ConnectionStrings $cnx | Out-Null')],
    'Aucune erreur ; le nom StorageConnectionString apparaît dans le portail (valeur masquée).',
    { important: 'Ne fais jamais afficher $cnx ni $cpt.Context. Si la propriété ConnectionString est vide (version du module), colle la chaîne toi-même dans le portail (Clés d’accès, puis Chaînes de connexion) ; vérifie avec Get-Help Set-AzWebApp.' }),
  lec('Lire l’adresse et l’état', 'Ouvre ensuite l’adresse dans un navigateur : sur le TP2, Messages et Lister Blobs doivent répondre.',
    [ps('Get-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}} | Format-List DefaultHostName, State')], 'L’adresse <nom>.azurewebsites.net et State = Running.', { verification: true }),
  mod('Revenir au plan gratuit entre deux séances', 'Le niveau gratuit retire l’intégration au VNet et les points privés : seulement à la fin du travail.',
    [ps('Set-AzAppServicePlan -ResourceGroupName {{groupe}} -Name {{plan}} -Tier Free')], 'Le plan au niveau Free.', { facultatif: true, important: 'Vérifie avec Get-Help Set-AzAppServicePlan si -Tier est refusé.' }),
  mod('Variante : application en code (exercice du module)', 'L’exercice Learn déploie du code .NET 8 sur Linux : plan gratuit, application sans image, puis pile d’exécution écrite dans la configuration du site.',
    [ps('New-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}} -Location {{region}} -AppServicePlan {{plan}}'),
      ps('$cfg = Get-AzResource -ResourceGroupName {{groupe}} -ResourceType Microsoft.Web/sites/config -ResourceName "{{webapp}}/web"'),
      ps('$cfg.Properties.linuxFxVersion = "DOTNETCORE|8.0"'),
      ps('$cfg | Set-AzResource -Force')],
    'Une application Running dont la page d’accueil est la page d’espace réservé d’App Service.', { facultatif: true, important: 'Valeur « DOTNETCORE|8.0 » à confirmer dans le portail (Paramètres > Configuration > Pile) ; sinon utilise le portail.' }),
];

// ===========================================================================
// 2. Restrictions d'accès
// ===========================================================================
const REST_GUI = [
  gui('Ouvrir les restrictions d’accès', 'lecture', 'Sans règle, l’application est accessible de partout. Dès la première règle « Autoriser », tout le reste est refusé (HTTP 403).',
    ['Ouvre l’application, menu **Paramètres > Mise en réseau**.', 'Sous **Configuration du trafic entrant**, clique **Accès réseau public** (ou **Restrictions d’accès**).', 'Lis les règles du **site principal** et du **site avancé (SCM)**.'],
    'La liste des règles actuelles (souvent « Autoriser tout »).',
    { ecran: { blade: 'Mise en réseau', fil: 'App Service > Paramètres > Mise en réseau', champs: [{ label: 'Accès réseau public', valeur: 'Activé sans restriction', genre: 'lecture', marque: true }], note: LIBELLE + ' Selon la version, le lien s’appelle « Restrictions d’accès ».' } }),
  gui('Autoriser une adresse IP', 'interruption', 'Dès la première règle, une règle implicite « Tout refuser » s’applique à la fin. Ajoute d’abord TA propre adresse, sinon tu te coupes de l’application.',
    ['Dans les restrictions, clique **+ Ajouter** (site principal).', '**Nom** : `developpeurs` ; **Action** : **Autoriser** ; **Priorité** : `200` ; **Type** : **IPv4**.', 'Saisis le **Bloc d’adresses IP** (ex. `130.220.0.0/27`), puis **Ajouter une règle**.', 'Clique **Enregistrer**.'],
    'La règle Autoriser apparaît avec sa priorité, suivie de « Tout refuser ».',
    { ecran: { blade: 'Ajouter une restriction', fil: 'App Service > Mise en réseau > Restrictions d’accès > Ajouter', champs: [{ label: 'Nom', valeur: 'developpeurs', marque: true }, { label: 'Action', valeur: 'Autoriser', genre: 'liste', marque: true }, { label: 'Priorité', valeur: '200', marque: true }, { label: 'Type', valeur: 'IPv4', genre: 'liste' }, { label: 'Bloc d’adresses IP', valeur: '130.220.0.0/27', marque: true }], bouton: 'Ajouter une règle', note: LIBELLE }, important: 'Vérifie que ton adresse publique figure dans la règle avant d’enregistrer.' }),
  gui('Autoriser un sous-réseau', 'modification', 'Le point de terminaison de service Microsoft.Web doit être actif sur le sous-réseau (côté réseau ET côté service) ; le portail propose de l’activer.',
    ['Clique **+ Ajouter**, **Type** : **Réseau virtuel**.', 'Choisis le **Réseau virtuel** et le **Sous-réseau**, **Priorité** `300`, **Action** **Autoriser**.', 'Valide l’activation du point de terminaison de service si on te la demande, puis **Ajouter une règle** et **Enregistrer**.'],
    'Une règle de type réseau virtuel apparaît dans la liste.',
    { ecran: { blade: 'Ajouter une restriction', fil: 'App Service > Mise en réseau > Restrictions d’accès > Ajouter', champs: [{ label: 'Type', valeur: 'Réseau virtuel', genre: 'liste', marque: true }, { label: 'Réseau virtuel', valeur: 'VNET1', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'app-gateway', genre: 'liste', marque: true }, { label: 'Priorité', valeur: '300', marque: true }], bouton: 'Ajouter une règle', note: LIBELLE }, facultatif: true }),
  gui('Autoriser Azure Front Door (étiquette de service)', 'modification', 'Une étiquette de service autorise toute une famille d’adresses Microsoft. Pour Front Door, ajoute aussi un filtre sur l’en-tête x-azure-fdid avec l’identifiant de TON profil, sinon tout client Front Door passe.',
    ['Clique **+ Ajouter**, **Type** : **Étiquette de service**.', 'Choisis **AzureFrontDoor.Backend**, **Priorité** `400`, **Action** **Autoriser**, puis **Ajouter une règle** et **Enregistrer**.'],
    'Une règle avec l’étiquette AzureFrontDoor.Backend apparaît.',
    { ecran: { blade: 'Ajouter une restriction', fil: 'App Service > Mise en réseau > Restrictions d’accès > Ajouter', champs: [{ label: 'Type', valeur: 'Étiquette de service', genre: 'liste', marque: true }, { label: 'Étiquette de service', valeur: 'AzureFrontDoor.Backend', genre: 'liste', marque: true }, { label: 'Priorité', valeur: '400', marque: true }], bouton: 'Ajouter une règle', note: LIBELLE }, facultatif: true }),
  gui('Protéger aussi le site de déploiement (SCM)', 'modification', 'Le site SCM (Kudu) a ses propres règles ; on peut lui appliquer celles du site principal.',
    ['Dans les restrictions, onglet **Site avancé** (SCM).', 'Coche **Utiliser les règles du site principal**, puis **Enregistrer**.'],
    'La case est cochée : le SCM suit les règles du site principal.',
    { ecran: { blade: 'Restrictions d’accès', fil: 'App Service > Mise en réseau > Restrictions d’accès', onglets: ['Site principal', 'Site avancé'], actif: 1, champs: [{ label: 'Utiliser les règles du site principal', valeur: 'coche', genre: 'case', marque: true }], bouton: 'Enregistrer', note: LIBELLE }, facultatif: true }),
  gui('Relire et tester', 'lecture', 'Depuis une adresse autorisée l’application répond ; depuis une autre, elle répond 403.',
    ['Relis la liste : les règles sont rangées par priorité.', 'Ouvre l’adresse de l’application depuis une adresse autorisée, puis (si possible) depuis une autre.'],
    'Les règles dans l’ordre des priorités ; un client refusé reçoit HTTP 403.',
    { ecran: { blade: 'Restrictions d’accès', fil: 'App Service > Mise en réseau > Restrictions d’accès', champs: [{ label: '200 — developpeurs', valeur: 'Autoriser 130.220.0.0/27', genre: 'lecture' }, { label: '2147483647 — Tout refuser', valeur: 'Refuser tout', genre: 'lecture', marque: true }] } }),
  gui('Retirer une règle', 'destructif', 'S’il ne reste aucune règle, l’application redevient accessible de partout.',
    ['Dans la liste, clique **…** à droite de la règle puis **Supprimer**.', 'Clique **Enregistrer**.'],
    'La règle n’est plus dans la liste.',
    { ecran: { blade: 'Restrictions d’accès', fil: 'App Service > Mise en réseau > Restrictions d’accès', champs: [{ label: '200 — developpeurs', valeur: 'Supprimer', genre: 'lecture', marque: true }], bouton: 'Enregistrer' }, facultatif: true }),
];

const REST_PS = [
  CTX,
  lec('Lire les règles actuelles', 'Sans règle, l’application est accessible de partout.',
    [ps('Get-AzWebAppAccessRestrictionConfig -ResourceGroupName {{groupe}} -Name {{webapp}}')], 'La configuration avec les règles du site principal et du site SCM.'),
  itr('Autoriser une adresse IP', 'Dès la première règle, un refus implicite s’applique à la fin : toute adresse non autorisée reçoit 403. Mets d’abord TA propre adresse.',
    [ps('Add-AzWebAppAccessRestrictionRule -ResourceGroupName {{groupe}} -WebAppName {{webapp}} -Name {{regle}} -Priority {{priorite}} -Action Allow -IpAddress {{ip}}')], 'La règle Allow avec sa priorité dans la liste.',
    { important: 'Noms de paramètres écrits d’après la documentation du module Az.Websites (page non relue ici) : vérifie avec Get-Help Add-AzWebAppAccessRestrictionRule. Sans ton adresse, tu te coupes de l’application.' }),
  mod('Autoriser un sous-réseau', 'Le point de terminaison de service Microsoft.Web doit être activé sur le sous-réseau, puis la règle pointe vers lui.',
    [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
      ps('$sn = Get-AzVirtualNetworkSubnetConfig -VirtualNetwork $vn -Name {{sousReseau}}'),
      ps('Set-AzVirtualNetworkSubnetConfig -VirtualNetwork $vn -Name {{sousReseau}} -AddressPrefix $sn.AddressPrefix -ServiceEndpoint Microsoft.Web | Out-Null'),
      ps('$vn | Set-AzVirtualNetwork | Out-Null'),
      ps('Add-AzWebAppAccessRestrictionRule -ResourceGroupName {{groupe}} -WebAppName {{webapp}} -Name {{regle}}-snet -Priority 300 -Action Allow -SubnetId $sn.Id')],
    'Une règle de type sous-réseau dans la liste.', { facultatif: true, important: 'Si le sous-réseau porte déjà une délégation ou d’autres points de terminaison, relis-les (Get-AzVirtualNetworkSubnetConfig) : le portail est plus sûr dans ce cas. Vérifie avec Get-Help.' }),
  mod('Autoriser Azure Front Door (étiquette de service)', 'Une étiquette autorise toute une famille d’adresses Microsoft. Ajoute aussi, dans le portail, le filtre x-azure-fdid avec l’identifiant de TON profil.',
    [ps('Add-AzWebAppAccessRestrictionRule -ResourceGroupName {{groupe}} -WebAppName {{webapp}} -Name frontdoor -Priority 400 -Action Allow -ServiceTag AzureFrontDoor.Backend')], 'Une règle avec l’étiquette AzureFrontDoor.Backend.',
    { facultatif: true, important: 'Paramètre -ServiceTag à confirmer avec Get-Help Add-AzWebAppAccessRestrictionRule.' }),
  mod('Protéger aussi le site de déploiement (SCM)', 'Applique au site SCM (Kudu) les règles du site principal.',
    [ps('Update-AzWebAppAccessRestrictionConfig -ResourceGroupName {{groupe}} -Name {{webapp}} -ScmSiteUseMainSiteRestrictionConfig')], 'La configuration où le SCM utilise les règles du site principal.',
    { facultatif: true, important: 'Nom du paramètre et de l’option à confirmer avec Get-Help Update-AzWebAppAccessRestrictionConfig.' }),
  lec('Relire et tester', 'Depuis une adresse autorisée l’application répond ; depuis une autre, elle répond 403.',
    [ps('Get-AzWebAppAccessRestrictionConfig -ResourceGroupName {{groupe}} -Name {{webapp}}')], 'Les règles dans l’ordre des priorités ; un client refusé reçoit HTTP 403.', { verification: true }),
  des('Retirer une règle', 'Retire la règle par son nom. S’il ne reste aucune règle, l’application redevient accessible de partout.',
    [ps('Remove-AzWebAppAccessRestrictionRule -ResourceGroupName {{groupe}} -WebAppName {{webapp}} -Name {{regle}}')], 'La liste des règles sans celle retirée.', { facultatif: true }),
];

// ===========================================================================
// 3. Intégration au VNet
// ===========================================================================
const INTEG_GUI = [
  gui('Déléguer le sous-réseau à App Service', 'modification', 'La délégation réserve le sous-réseau à App Service : on n’y met plus d’autre ressource, ni de point privé.',
    ['Ouvre le **réseau virtuel**, menu **Sous-réseaux**, clique le sous-réseau de sortie.', 'Dans **Déléguer le sous-réseau à un service**, choisis **Microsoft.Web/serverFarms**.', 'Clique **Enregistrer**.'],
    'Le sous-réseau affiche la délégation Microsoft.Web/serverFarms.',
    { ecran: { blade: 'Modifier le sous-réseau', fil: 'Réseau virtuel > Sous-réseaux > AppServiceOutboundSubnet', champs: [{ label: 'Nom', valeur: 'AppServiceOutboundSubnet', genre: 'lecture' }, { label: 'Déléguer le sous-réseau à un service', valeur: 'Microsoft.Web/serverFarms', genre: 'liste', marque: true }], bouton: 'Enregistrer' } }),
  gui('Intégrer l’application au sous-réseau', 'modification', 'À partir de là, le trafic sortant de l’application part de ce sous-réseau, avec ses routes et ses règles. Le plan doit être au moins B1.',
    ['Ouvre l’application, **Paramètres > Mise en réseau**.', 'Sous **Configuration du trafic sortant**, clique **Intégration au réseau virtuel**, puis **Ajouter une intégration de réseau virtuel**.', 'Choisis l’**Abonnement**, le **Réseau virtuel** et le **Sous-réseau**, puis clique **Connexion**.'],
    'L’intégration apparaît avec le VNet et le sous-réseau, état « Connecté ».',
    { ecran: { blade: 'Ajouter une intégration de réseau virtuel', fil: 'App Service > Mise en réseau > Intégration au réseau virtuel', champs: [{ label: 'Abonnement', valeur: 'ton abonnement', genre: 'liste' }, { label: 'Réseau virtuel', valeur: 'VNET1', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'AppServiceOutboundSubnet', genre: 'liste', marque: true }], bouton: 'Connexion', note: LIBELLE } }),
  gui('Lire l’intégration', 'lecture', 'Relis le sous-réseau branché à l’application.',
    ['Reste dans **Mise en réseau > Intégration au réseau virtuel**.', 'Contrôle le **Réseau virtuel**, le **Sous-réseau** et l’état.'],
    'Une ligne avec le VNet et le sous-réseau.',
    { ecran: { blade: 'Intégration au réseau virtuel', fil: 'App Service > Mise en réseau', champs: [{ label: 'Réseau virtuel', valeur: 'VNET1', genre: 'lecture' }, { label: 'Sous-réseau', valeur: 'AppServiceOutboundSubnet', genre: 'lecture', marque: true }, { label: 'État', valeur: 'Connecté', genre: 'lecture' }] } }),
  gui('Retirer l’intégration', 'destructif', 'L’application sort de nouveau par ses adresses publiques.',
    ['Dans **Intégration au réseau virtuel**, clique **Déconnecter**.', 'Confirme avec **Oui**.'],
    'La page n’affiche plus d’intégration.',
    { ecran: { blade: 'Intégration au réseau virtuel', fil: 'App Service > Mise en réseau', champs: [{ label: 'Intégration', valeur: 'Déconnecter', genre: 'lecture', marque: true }], bouton: 'Déconnecter', note: LIBELLE }, facultatif: true }),
];

const INTEG_PS = [
  CTX,
  mod('Déléguer le sous-réseau à App Service', 'La délégation réserve le sous-réseau à App Service.',
    [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
      ps('$sn = Get-AzVirtualNetworkSubnetConfig -VirtualNetwork $vn -Name {{sousReseau}}'),
      ps('Add-AzDelegation -Name "dlg-app" -ServiceName "Microsoft.Web/serverFarms" -Subnet $sn | Out-Null'),
      ps('$vn | Set-AzVirtualNetwork | Out-Null')],
    'Le sous-réseau porte la délégation Microsoft.Web/serverFarms.', { important: 'Vérifie avec Get-Help Add-AzDelegation si la commande diffère dans ta version du module.' }),
  mod('Intégrer l’application au sous-réseau', 'On écrit l’identifiant du sous-réseau dans la propriété virtualNetworkSubnetId de l’application ; elle sort ensuite par ce sous-réseau.',
    [ps('$sub = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}} | Select-Object -ExpandProperty Subnets | Where-Object Name -eq "{{sousReseau}}"'),
      ps('$res = Get-AzResource -ResourceGroupName {{groupe}} -ResourceType Microsoft.Web/sites -Name {{webapp}}'),
      ps('$res.Properties.virtualNetworkSubnetId = $sub.Id'),
      ps('$res | Set-AzResource -Force')],
    'La ressource mise à jour, virtualNetworkSubnetId rempli.', { important: 'Approche par propriété du site (documentée mais indirecte) : si elle est refusée, fais l’étape dans le portail.' }),
  lec('Lire l’intégration', 'Relis l’identifiant du sous-réseau branché à l’application.',
    [ps('(Get-AzResource -ResourceGroupName {{groupe}} -ResourceType Microsoft.Web/sites -Name {{webapp}}).Properties.virtualNetworkSubnetId')], 'L’identifiant se terminant par le nom du sous-réseau.', { verification: true }),
  des('Retirer l’intégration', 'Vide la propriété ; l’application sort de nouveau par ses adresses publiques.',
    [ps('$res = Get-AzResource -ResourceGroupName {{groupe}} -ResourceType Microsoft.Web/sites -Name {{webapp}}'),
      ps('$res.Properties.virtualNetworkSubnetId = $null'),
      ps('$res | Set-AzResource -Force')],
    'virtualNetworkSubnetId vide.', { facultatif: true, important: 'Comportement à confirmer : si la propriété reste, utilise « Déconnecter » dans le portail.' }),
];

// ===========================================================================
// 4. Point privé App Service
// ===========================================================================
const ZW = 'privatelink.azurewebsites.net';
const PP_GUI = [
  gui('Autoriser les règles réseau sur le sous-réseau', 'modification', 'Pour que les groupes de sécurité réseau et les tables de routage s’appliquent aux points privés du sous-réseau. Le sous-réseau ne doit PAS être celui de l’intégration (délégué).',
    ['Ouvre le **réseau virtuel**, **Sous-réseaux**, clique le sous-réseau du point privé (non délégué).', 'Dans **Stratégie de réseau des points de terminaison privés**, choisis **Groupes de sécurité réseau et tables de routage**.', 'Clique **Enregistrer**.'],
    'La stratégie est activée sur le sous-réseau.',
    { ecran: { blade: 'Modifier le sous-réseau', fil: 'Réseau virtuel > Sous-réseaux > AppServiceInboundSubnet', champs: [{ label: 'Stratégie de réseau des points de terminaison privés', valeur: 'Groupes de sécurité réseau et tables de routage', genre: 'liste', marque: true }], bouton: 'Enregistrer', note: LIBELLE }, facultatif: true }),
  gui('Créer le point de terminaison privé', 'modification', 'Le groupe « sites » désigne l’application web elle-même.',
    ['Ouvre l’application, **Paramètres > Mise en réseau**, **Points de terminaison privés** puis **+ Ajouter** (ou cherche **Points de terminaison privés** dans le portail).', 'Onglet **Informations de base** : **Nom**, **Région** (celle du VNet).', 'Onglet **Ressource** : **Sous-ressource cible** : **sites**.', 'Onglet **Réseau virtuel** : le **réseau virtuel** et le **sous-réseau** non délégué.'],
    'Les onglets sont remplis.',
    { ecran: { blade: 'Créer un point de terminaison privé', fil: 'Accueil > Points de terminaison privés > Créer', onglets: ['Informations de base', 'Ressource', 'Réseau virtuel', 'DNS', 'Balises', 'Vérifier + créer'], actif: 1, champs: [{ label: 'Nom', valeur: 'pe-webapp1', marque: true }, { label: 'Type de ressource', valeur: 'Microsoft.Web/sites', genre: 'lecture' }, { label: 'Sous-ressource cible', valeur: 'sites', genre: 'liste', marque: true }, { label: 'Sous-réseau', valeur: 'AppServiceInboundSubnet', genre: 'liste', marque: true }], bouton: 'Suivant : Réseau virtuel', note: LIBELLE }, important: 'Ne choisis pas le sous-réseau délégué de l’intégration.' }),
  gui('Créer la zone DNS privée et la lier au VNet', 'modification', 'Le nom <app>.azurewebsites.net doit se résoudre en adresse privée depuis le VNet : c’est le rôle de la zone privatelink.azurewebsites.net. L’onglet DNS de l’assistant fait les deux d’un coup.',
    ['Onglet **DNS** : **Intégrer à une zone DNS privée** : **Oui**.', 'Contrôle que la zone est `privatelink.azurewebsites.net` (le portail crée la zone et son lien au VNet).', 'Clique **Vérifier + créer**, puis **Créer**.'],
    'Le point privé est déployé, avec une zone DNS privée liée au VNet et un enregistrement pour l’application.',
    { ecran: { blade: 'Créer un point de terminaison privé', fil: 'Accueil > Points de terminaison privés > Créer', onglets: ['Informations de base', 'Ressource', 'Réseau virtuel', 'DNS', 'Balises', 'Vérifier + créer'], actif: 3, champs: [{ label: 'Intégrer à une zone DNS privée', valeur: 'Oui', genre: 'liste', marque: true }, { label: 'Zone DNS privée', valeur: ZW, genre: 'lecture' }], bouton: 'Vérifier + créer', note: LIBELLE } }),
  gui('Fermer l’accès public', 'interruption', 'À faire en dernier : l’application ne répond plus depuis Internet ; seul le VNet (et ses réseaux reliés) la joint.',
    ['Ouvre l’application, **Paramètres > Mise en réseau**, **Accès réseau public**.', 'Choisis **Désactivé**, puis **Enregistrer**.'],
    'L’accès au réseau public est « Désactivé ».',
    { ecran: { blade: 'Accès au réseau public', fil: 'App Service > Mise en réseau', champs: [{ label: 'Accès au réseau public', valeur: 'Désactivé', genre: 'liste', marque: true }], bouton: 'Enregistrer', note: LIBELLE }, important: 'Pour tester ensuite, il faut une machine DANS le VNet : depuis ton poste, l’application répond 403.' }),
  gui('Contrôler la résolution depuis le VNet', 'lecture', 'À lancer DANS une machine du VNet : le nom de l’application doit se résoudre en adresse privée.',
    ['Sur une machine du VNet, ouvre un terminal et tape `nslookup` suivi du nom de l’application (`webapp1-tardi.azurewebsites.net`).', 'Contrôle que l’adresse appartient au sous-réseau du point privé.'],
    'Un alias vers <app>.privatelink.azurewebsites.net et une adresse privée.',
    { ecran: { blade: 'Terminal — machine du VNet', fil: 'Machine virtuelle > Terminal', champs: [{ label: 'Commande', valeur: 'nslookup webapp1-tardi.azurewebsites.net', marque: true }, { label: 'Réponse attendue', valeur: 'adresse privée du sous-réseau', genre: 'lecture' }] } }),
];

const PP_PS = [
  CTX,
  mod('Autoriser les règles réseau sur le sous-réseau', 'Pour que les groupes de sécurité réseau et les tables de routage s’appliquent aux points privés du sous-réseau.',
    [ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
      ps('$sn = Get-AzVirtualNetworkSubnetConfig -VirtualNetwork $vn -Name {{sousReseau}}'),
      ps('$sn.PrivateEndpointNetworkPolicies = "Enabled"'),
      ps('$vn | Set-AzVirtualNetwork | Out-Null')],
    'La propriété PrivateEndpointNetworkPolicies vaut Enabled.', { facultatif: true, important: 'Nom de propriété à confirmer avec $sn | Format-List ; sinon coche l’option dans le portail.' }),
  mod('Créer le point de terminaison privé', 'Le groupe « sites » désigne l’application web elle-même.',
    [ps('$app = Get-AzWebApp -ResourceGroupName {{groupe}} -Name {{webapp}}'),
      ps('$sub = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}} | Select-Object -ExpandProperty Subnets | Where-Object Name -eq "{{sousReseau}}"'),
      ps('$lien = New-AzPrivateLinkServiceConnection -Name {{connexion}} -PrivateLinkServiceId $app.Id -GroupId sites'),
      ps('New-AzPrivateEndpoint -ResourceGroupName {{groupe}} -Name {{pointPrive}} -Location $app.Location -Subnet $sub -PrivateLinkServiceConnection $lien')],
    'Le point privé avec une connexion « Approved ».', { important: 'Utilise un sous-réseau NON délégué. Si $app.Location est refusé, mets le nom technique de la région du VNet.' }),
  mod('Créer la zone DNS privée, la lier au VNet et inscrire le point', `Le nom <app>.azurewebsites.net doit se résoudre en adresse privée : zone ${ZW}, lien au VNet, groupe de zones du point.`,
    [ps(`$zone = New-AzPrivateDnsZone -ResourceGroupName {{groupe}} -Name ${ZW}`),
      ps('$vn = Get-AzVirtualNetwork -ResourceGroupName {{groupe}} -Name {{vnet}}'),
      ps(`New-AzPrivateDnsVirtualNetworkLink -ResourceGroupName {{groupe}} -ZoneName ${ZW} -Name lien-{{vnet}} -VirtualNetworkId $vn.Id`),
      ps('$cfg = New-AzPrivateDnsZoneConfig -Name sites -PrivateDnsZoneId $zone.ResourceId'),
      ps('New-AzPrivateDnsZoneGroup -ResourceGroupName {{groupe}} -PrivateEndpointName {{pointPrive}} -Name groupe-dns -PrivateDnsZoneConfig $cfg')],
    'La zone, le lien (VirtualNetworkLinkState = Completed) et le groupe de zones.'),
  itr('Fermer l’accès public', 'En dernier : l’application ne répond plus depuis Internet. On écrit la propriété publicNetworkAccess du site.',
    [ps('$res = Get-AzResource -ResourceGroupName {{groupe}} -ResourceType Microsoft.Web/sites -Name {{webapp}}'),
      ps('$res.Properties.publicNetworkAccess = "Disabled"'),
      ps('$res | Set-AzResource -Force')],
    'publicNetworkAccess vaut Disabled.', { important: 'Pour tester, il faut une machine DANS le VNet. Si la propriété est refusée, utilise le portail (Mise en réseau > Accès réseau public).' }),
  lec('Contrôler le point privé', 'Lis l’état de la connexion, puis (depuis une machine du VNet) la résolution du nom.',
    [ps('(Get-AzPrivateEndpoint -ResourceGroupName {{groupe}} -Name {{pointPrive}}).PrivateLinkServiceConnections | Format-List Name, @{n="Etat";e={$_.PrivateLinkServiceConnectionState.Status}}'),
      ps('Resolve-DnsName {{webapp}}.azurewebsites.net')],
    'Connexion « Approved » ; depuis le VNet, un alias privatelink et une adresse privée.', { verification: true }),
];

// ===========================================================================
// 5. Stockage : file, conteneur, accès public fermé
// ===========================================================================
const STO_GUI = [
  gui('Créer le compte de stockage', 'modification', 'Redondance locale (LRS), accès anonyme aux blobs interdit. Le nom est unique dans tout Azure.',
    ['Cherche **Comptes de stockage**, clique **+ Créer**.', 'Onglet **Informations de base** : groupe de ressources, **Nom du compte de stockage** (ex. `sttardi01`), **Région**, **Redondance** : **Stockage localement redondant (LRS)**.', 'Onglet **Avancé** : décoche **Autoriser l’accès anonyme aux blobs**.', 'Clique **Vérifier + créer**, puis **Créer**.'],
    'Le compte est déployé.',
    { ecran: { blade: 'Créer un compte de stockage', fil: 'Accueil > Comptes de stockage > Créer', onglets: ['Informations de base', 'Avancé', 'Mise en réseau', 'Protection des données', 'Chiffrement', 'Balises', 'Vérifier + créer'], actif: 0, champs: [{ label: 'Groupe de ressources', valeur: 'rg-tardi', genre: 'liste' }, { label: 'Nom du compte de stockage', valeur: 'sttardi01', marque: true }, { label: 'Région', valeur: '(Canada) Canada Centre', genre: 'liste' }, { label: 'Redondance', valeur: 'Stockage localement redondant (LRS)', genre: 'liste', marque: true }], bouton: 'Vérifier + créer', note: LIBELLE } }),
  gui('Créer la file d’attente', 'modification', 'Écran « Fichiers » du compte : la file d’attente est créée par le plan de gestion d’Azure.',
    ['Ouvre le compte, menu **Stockage de données > Files d’attente**.', 'Clique **+ File d’attente**, saisis le **Nom de la file d’attente** `queue1`, puis **OK**.'],
    'La file queue1 apparaît dans la liste.',
    { ecran: { blade: 'Ajouter une file d’attente', fil: 'Compte de stockage > Stockage de données > Files d’attente', champs: [{ label: 'Nom de la file d’attente', valeur: 'queue1', marque: true }], bouton: 'OK', note: LIBELLE + ' Le portail peut afficher un message d’authentification : choisis la clé d’accès ou ton compte Microsoft Entra.' } }),
  gui('Créer le conteneur de blobs', 'modification', 'Même principe : accès privé, aucun accès anonyme.',
    ['Menu **Stockage de données > Conteneurs**, clique **+ Conteneur**.', '**Nom** : `blob1` ; **Niveau d’accès anonyme** : **Privé (aucun accès anonyme)** ; clique **Créer**.'],
    'Le conteneur blob1 apparaît dans la liste.',
    { ecran: { blade: 'Nouveau conteneur', fil: 'Compte de stockage > Stockage de données > Conteneurs', champs: [{ label: 'Nom', valeur: 'blob1', marque: true }, { label: 'Niveau d’accès anonyme', valeur: 'Privé (aucun accès anonyme)', genre: 'liste', marque: true }], bouton: 'Créer', note: LIBELLE } }),
  gui('Déposer un fichier dans le conteneur', 'modification', 'À faire AVANT de fermer l’accès public : ensuite ton poste n’atteint plus le contenu.',
    ['Ouvre le conteneur `blob1`, clique **Charger**.', 'Sélectionne un petit fichier de ton poste, puis clique **Charger**.'],
    'Le fichier apparaît dans la liste des blobs.',
    { ecran: { blade: 'Charger le blob', fil: 'Compte de stockage > Conteneurs > blob1', champs: [{ label: 'Fichiers', valeur: 'exemple.txt', marque: true }], bouton: 'Charger', note: LIBELLE + ' Si le portail refuse, il te manque un rôle de données (Contributeur des données Blob du stockage).' } }),
  gui('Fermer l’accès public', 'interruption', 'À faire en dernier : ensuite le contenu n’est joignable que par un point de terminaison privé.',
    ['Dans le compte, **Sécurité + mise en réseau > Mise en réseau**, onglet **Pare-feu et réseaux virtuels**.', '**Accès au réseau public** : **Désactivé**, puis **Enregistrer**.'],
    'L’accès au réseau public est « Désactivé ».',
    { ecran: { blade: 'Mise en réseau — Pare-feu et réseaux virtuels', fil: 'Compte de stockage > Mise en réseau', onglets: ['Pare-feu et réseaux virtuels', 'Connexions de point de terminaison privé', 'Accès réseau'], actif: 0, champs: [{ label: 'Accès au réseau public', valeur: 'Désactivé', genre: 'liste', marque: true }], bouton: 'Enregistrer' }, important: 'Après cette étape, ton poste n’atteint plus le compte : teste depuis une machine du VNet.' }),
  gui('Relire le compte', 'lecture', 'Contrôle l’état d’accès.',
    ['Rouvre **Sécurité + mise en réseau > Mise en réseau** et lis **Accès au réseau public**.', 'Dans **Paramètres > Configuration**, lis **Autoriser l’accès anonyme aux blobs**.'],
    'Accès public « Désactivé » et accès anonyme « Désactivé ».',
    { ecran: { blade: 'Configuration', fil: 'Compte de stockage > Paramètres > Configuration', champs: [{ label: 'Autoriser l’accès anonyme aux blobs', valeur: 'Désactivé', genre: 'lecture', marque: true }], note: LIBELLE } }),
];

const STO_PS = [
  CTX,
  mod('Créer le compte de stockage', 'Redondance locale (LRS) et accès anonyme interdit. Le nom doit être unique dans tout Azure.',
    [ps('New-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}} -Location {{region}} -SkuName Standard_LRS -Kind StorageV2 -AllowBlobPublicAccess $false')], 'Le compte avec ProvisioningState = Succeeded.'),
  mod('Créer la file d’attente', 'Création par le plan de gestion d’Azure : pas de rôle de données nécessaire.',
    [ps('New-AzRmStorageQueue -ResourceGroupName {{groupe}} -StorageAccountName {{compte}} -Name {{file}}')], 'La file avec son nom.',
    { important: 'Cmdlet écrit de mémoire : vérifie avec Get-Help New-AzRmStorageQueue ; sinon crée la file dans le portail (Stockage de données > Files d’attente).' }),
  mod('Créer le conteneur de blobs', 'Même principe : création par le plan de gestion, accès privé.',
    [ps('New-AzRmStorageContainer -ResourceGroupName {{groupe}} -StorageAccountName {{compte}} -Name {{conteneur}}')], 'Le conteneur avec son nom.'),
  mod('Déposer un fichier dans le conteneur', 'Utilise ton compte Azure (rôle « Contributeur des données Blob du stockage » requis) ; à faire AVANT la fermeture de l’accès public.',
    [ps('$ctx = New-AzStorageContext -StorageAccountName {{compte}} -UseConnectedAccount'),
      ps('Set-AzStorageBlobContent -File {{fichier}} -Container {{conteneur}} -Blob (Split-Path {{fichier}} -Leaf) -Context $ctx')], 'Le blob déposé, avec son nom et sa taille.',
    { important: 'Si l’accès est refusé (AuthorizationPermissionMismatch), il te manque le rôle de données : dépose le fichier depuis le portail.' }),
  itr('Fermer l’accès public', 'En dernier : ensuite le contenu n’est joignable que par un point de terminaison privé.',
    [ps('Set-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}} -PublicNetworkAccess Disabled')], 'PublicNetworkAccess = Disabled.', { important: 'Après cette commande, ton poste n’atteint plus le compte : teste depuis une machine du VNet.' }),
  lec('Relire le compte', 'Contrôle l’état d’accès.',
    [ps('Get-AzStorageAccount -ResourceGroupName {{groupe}} -Name {{compte}} | Format-List PublicNetworkAccess, AllowBlobPublicAccess')], 'PublicNetworkAccess « Disabled » et AllowBlobPublicAccess « False ».', { verification: true }),
];

export const MULTI_APP = {
  'cours-az-app-service-creer': {
    gui: { privileges: PRIV, etapes: CREER_GUI, verification: ['L’application est « En cours d’exécution », son adresse répond, et les pages qui utilisent le stockage (Messages, Lister Blobs dans le TP2) affichent leur contenu.'], retour: 'Pour défaire : supprime l’application puis le plan App Service dans le portail, ou supprime tout le groupe de ressources du laboratoire.' },
    powershell: { privileges: PRIV, etapes: CREER_PS, verification: ['L’application est Running, son adresse répond, et Messages / Lister Blobs affichent leur contenu.'], retour: 'Pour défaire : Remove-AzWebApp puis Remove-AzAppServicePlan (groupe et nom), ou supprime tout le groupe de ressources du laboratoire.',
      depannage: [
        { symptome: 'L’adresse affiche une erreur 503 ou « Application Error »', cause: 'Le port du conteneur n’est pas celui que l’application écoute, ou l’image n’a pas pu être tirée.', action: 'Vérifie WEBSITES_PORT puis le journal de démarrage dans le portail (Surveillance > Flux de journaux).' },
        { symptome: 'Messages ou Lister Blobs échouent', cause: 'La chaîne de connexion est absente, ou le stockage refuse l’accès (accès public fermé sans point privé).', action: 'Relis le nom StorageConnectionString puis suis les fiches du point privé et de l’intégration au VNet.' },
      ] },
  },
  'cours-az-app-service-restriction-ip': {
    gui: { privileges: PRIV, etapes: REST_GUI, verification: ['Une adresse autorisée obtient la page ; une adresse non autorisée obtient HTTP 403 ; les règles sont rangées par priorité.'], retour: 'Pour défaire : supprime chaque règle dans la liste ; sans règle, l’application est de nouveau ouverte à tous.' },
    powershell: { privileges: PRIV, etapes: REST_PS, verification: ['Une adresse autorisée obtient la page ; une adresse non autorisée obtient HTTP 403 ; Get-AzWebAppAccessRestrictionConfig liste les règles par priorité.'], retour: 'Pour défaire : Remove-AzWebAppAccessRestrictionRule pour chaque règle ; sans règle, l’application est de nouveau ouverte à tous.',
      depannage: [
        { symptome: 'Tout le monde reçoit 403, moi compris', cause: 'La règle ne contient pas ton adresse publique, ou ton trafic sort par une autre adresse.', action: 'Ajoute ton adresse publique avec une priorité plus basse, ou retire la règle depuis le portail.' },
        { symptome: 'Un paramètre de Add-AzWebAppAccessRestrictionRule est refusé', cause: 'Les noms de paramètres varient selon la version du module Az.Websites.', action: 'Lance Get-Help Add-AzWebAppAccessRestrictionRule -Full et adapte, ou fais l’étape dans le portail.' },
      ] },
  },
  'cours-az-app-service-integration-vnet': {
    gui: { privileges: PRIV, etapes: INTEG_GUI, verification: ['L’intégration montre le VNet et le sous-réseau délégué, et l’application joint la ressource privée visée.'], retour: 'Pour défaire : clique « Déconnecter » dans l’intégration, puis retire la délégation du sous-réseau si tu veux le réutiliser.' },
    powershell: { privileges: PRIV, etapes: INTEG_PS, verification: ['virtualNetworkSubnetId pointe vers le sous-réseau délégué, et l’application joint la ressource privée visée.'], retour: 'Pour défaire : vide virtualNetworkSubnetId (étape facultative) ou déconnecte l’intégration dans le portail.',
      depannage: [{ symptome: 'L’intégration est refusée', cause: 'Plan gratuit, ou sous-réseau trop petit, déjà utilisé ou non délégué.', action: 'Passe au moins à B1, utilise un sous-réseau vide d’au moins /28 délégué à Microsoft.Web/serverFarms.' }] },
  },
  'cours-az-app-service-point-prive': {
    gui: { privileges: PRIV, etapes: PP_GUI, verification: ['Depuis le VNet, le nom de l’application se résout en adresse privée et la page s’affiche ; depuis Internet, l’accès est refusé.'], retour: 'Pour défaire : rouvre l’accès réseau public, puis supprime le point de terminaison privé, le lien et la zone DNS privée.' },
    powershell: { privileges: PRIV, etapes: PP_PS, verification: ['Depuis le VNet, le nom de l’application se résout en adresse privée et la page s’affiche ; depuis Internet, l’accès est refusé.'], retour: 'Pour défaire : remets publicNetworkAccess à Enabled, puis Remove-AzPrivateEndpoint, et supprime le lien et la zone DNS privée.',
      depannage: [
        { symptome: 'Le nom se résout encore en adresse publique', cause: 'La zone privée n’est pas liée au VNet de la machine, ou le groupe de zones DNS manque.', action: 'Relis le lien de la zone et le groupe de zones du point (portail : zone DNS privée > Liens de réseau virtuel).' },
        { symptome: 'Le point privé ne peut pas être créé dans ce sous-réseau', cause: 'Le sous-réseau est délégué (intégration VNet).', action: 'Utilise un autre sous-réseau, sans délégation.' },
      ] },
  },
  'cours-az-stockage-file-conteneur': {
    gui: { privileges: PRIV, etapes: STO_GUI, verification: ['Le compte existe, la file queue1 et le conteneur blob1 sont créés, un fichier est déposé, et l’accès public est désactivé.'], retour: 'Pour défaire : supprime le compte de stockage dans le portail (tout son contenu disparaît) ; vérifie d’abord que rien d’utile n’y reste.' },
    powershell: { privileges: PRIV, etapes: STO_PS, verification: ['Le compte existe, la file et le conteneur sont créés, un fichier est déposé, et PublicNetworkAccess vaut Disabled.'], retour: 'Pour défaire : Remove-AzStorageAccount (groupe et nom) supprime le compte et tout son contenu ; vérifie d’abord que rien d’utile n’y reste.',
      depannage: [{ symptome: 'Le dépôt du fichier est refusé (AuthorizationPermissionMismatch)', cause: 'Ton compte n’a pas de rôle de données sur le compte de stockage (Contributeur ne suffit pas).', action: 'Demande le rôle « Contributeur des données Blob du stockage », ou dépose le fichier depuis le portail.' }] },
  },
};
